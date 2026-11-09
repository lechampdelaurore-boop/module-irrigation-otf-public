import assert from 'node:assert/strict';
import test from 'node:test';
import type { WeeklyPlan } from '../lib/domain/planning/contract.ts';
import { buildWeeklyPlan } from '../lib/domain/planning/engine.ts';
import { doseReasonLabel, timingReasonLabel, unplacedReasonLabel } from '../lib/domain/planning/presentation.ts';
import { splitVolumeAcrossLocalDays } from '../lib/domain/water-management.ts';
import { assertInvariants, farm, largeFarm, settings, TZ, withDirectChain } from './support/planning-fixtures.ts';

/**
 * Les limites par jour (docs/planning-contract.md, « Où placer les
 * créneaux », point 6 ; points ouverts 54, 55 et 58, D-085). La limite
 * journalière d'irrigation et la limite de prélèvement d'une ressource se
 * vérifient jour civil par jour civil : un créneau qui passe minuit s'arrête
 * à l'heure où le reste d'un de ses jours s'épuise, jamais en retirant à sa
 * fin ce qu'un jour plus tôt a de trop ; le premier jour plein, il part à
 * minuit si sa plage continue. La coupe d'une limite de prélèvement porte son
 * nom, jamais celui d'une réserve.
 */

/** Ce que les créneaux prennent, jour civil par jour civil, à toutes les chaînes ou à celles que l'on garde. */
function drawnByDate(plan: WeeklyPlan, keep: (originKey: string | null) => boolean = () => true): Map<string, number> {
  const byDate = new Map<string, number>();
  for (const proposal of plan.proposals) {
    if (proposal.volumeCubicMeters === null || !keep(proposal.justification.supply?.originKey ?? null)) continue;
    for (const [date, volume] of splitVolumeAcrossLocalDays({ startAt: proposal.startAt, endAt: proposal.endAt, cubicMeters: proposal.volumeCubicMeters, timeZone: TZ })) {
      byDate.set(date, (byDate.get(date) ?? 0) + volume);
    }
  }
  return byDate;
}

const clock = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
const startsAtMidnight = (startAt: string) => clock.format(new Date(startAt)) === '00:00';

test('S5, limite journalière d’un arrêté : un créneau à cheval sur minuit ne dépasse pas son premier jour ; le premier jour plein, il part à minuit (point ouvert 58)', () => {
  // La ferme en taille, réglages par défaut, 15 m³ par jour : le jeudi se remplissait à 15 m³ avec quatre rampes de bloc,
  // puis cinq créneaux partis de 22 h 42 à 23 h 33 y ajoutaient 7,10 m³, raccourcis par leur fin du trop du jeudi.
  const { inputs } = largeFarm({ dailyLimit: 15 });
  const plan = buildWeeklyPlan(inputs, settings);
  for (const [date, volume] of drawnByDate(plan)) assert.ok(volume <= 15 + 1e-6, `${date} : ${volume.toFixed(3)} m³ pour une limite de 15 m³`);
  assertInvariants(plan, inputs);
  const atMidnight = plan.proposals.filter((proposal) => startsAtMidnight(proposal.startAt) && proposal.justification.timingReason === 'daily-limit');
  assert.ok(atMidnight.length > 0, 'le premier jour plein, un créneau part à minuit, sur le reste du jour suivant');
  for (const proposal of atMidnight) assert.equal(proposal.justification.limitingConstraint, 'limite journalière d’irrigation atteinte', proposal.id);
});

test('S5, la petite ferme : un créneau de 21 h qui finit après minuit garde sous la limite la part de son premier jour (point ouvert 58)', () => {
  // Besoins de 40 mm et dose maximale de 40 mm, 3 m³ par jour : la rampe du bloc 2 partait mardi à 21 h jusqu'à 0 h 01,
  // raccourcie de ce que le mardi avait de trop, mais par sa fin : 3,054 m³ le mardi.
  const need = { rawPlanningNeedMm: 40, effectiveNeedMm: 40 };
  const plotNeeds = { 'bloc-1': need, 'bloc-2': need, 'tunnel-1': need, 'tunnel-2': need, 'tunnel-3': need, 'tunnel-4': need };
  const used = { ...settings, doses: { ...settings.doses, sprinkler: { ...settings.doses.sprinkler, maximumMm: 40 } } };
  const { inputs } = farm({ extraTunnels: true, dailyLimit: 3, plotNeeds });
  const plan = buildWeeklyPlan(inputs, used);
  for (const [date, volume] of drawnByDate(plan)) assert.ok(volume <= 3 + 1e-6, `${date} : ${volume.toFixed(3)} m³ pour une limite de 3 m³`);
  assertInvariants(plan, inputs, used);
});

test('S9, limite de prélèvement d’une source : jamais plus de 2 m³ un jour, et la coupe porte le nom de la limite, pas celui d’une réserve (points ouverts 54 et 55)', () => {
  // La ferme en taille, les rampes des blocs 3 et 4 sur une source à sa pompe de 3 m³/h, 2 m³ par jour : la source donnait
  // 4 m³ le mercredi, le bloc 4 vérifié sur le mercredi et le jeudi puis placé sur le seul mercredi, et sa coupe se disait
  // « réserve « Source du bas » au minimum de sécurité ».
  const inputs = withDirectChain(largeFarm({ blocDrips: false, forageFlow: 0, reservoirCubicMeters: 20 }).inputs, { equipmentIds: ['rampe-bloc-3', 'rampe-bloc-4'], dailyLimitCubicMeters: 2 });
  const plan = buildWeeklyPlan(inputs, settings);
  for (const [date, volume] of drawnByDate(plan, (key) => key === 'resource:source')) assert.ok(volume <= 2 + 1e-6, `${date} : ${volume.toFixed(3)} m³ de la source pour 2 m³ autorisés`);
  assertInvariants(plan, inputs);
  const fromSource = plan.proposals.filter((proposal) => proposal.justification.supply?.originKey === 'resource:source');
  assert.ok(fromSource.length > 0, 'la source sert ses rampes');
  for (const proposal of fromSource) {
    assert.notEqual(proposal.justification.doseReason, 'reserve-level', proposal.id);
    assert.doesNotMatch(proposal.justification.limitingConstraint ?? '', /réserve|minimum de sécurité/, proposal.id);
  }
  const cut = fromSource.filter((proposal) => proposal.justification.doseReason === 'withdrawal-limit');
  assert.ok(cut.length > 0, 'un créneau coupé par la limite de prélèvement');
  for (const proposal of cut) assert.equal(proposal.justification.limitingConstraint, 'limite de prélèvement de « Source du bas » atteinte', proposal.id);
});

test('S9, une source trop petite pour la dose minimale : ses planches disent « limite de prélèvement », comptée en manque d’eau, jamais la réserve (point ouvert 55)', () => {
  // 0,3 m³ par jour pour la rampe du bloc 2, dont la dose minimale demande 1,4 m³ : aucun jour ne la tient.
  const inputs = withDirectChain(farm().inputs, { equipmentIds: ['rampe-bloc-2'], dailyLimitCubicMeters: 0.3 });
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  const bloc2 = plan.beds.filter((bed) => bed.equipmentId === 'rampe-bloc-2' && bed.needMm > 0);
  assert.ok(bloc2.length > 0, 'les planches du bloc 2');
  for (const bed of bloc2) {
    assert.ok(bed.reasons.includes('withdrawal-limit'), `${bed.bedName} : ${bed.reasons.join(', ')}`);
    assert.ok(!bed.reasons.includes('reserve-timing'), `${bed.bedName} : ${bed.reasons.join(', ')}`);
  }
  assert.ok(plan.deficit.waterCubicMeters > 0, 'le manque est un manque d’eau');
  assert.equal(plan.deficit.pumpTimeCubicMeters, 0);
});

test('les mots de la limite de prélèvement, au motif, à la dose et au moment', () => {
  assert.equal(unplacedReasonLabel('withdrawal-limit'), 'limite de prélèvement de la ressource atteinte');
  assert.equal(doseReasonLabel('withdrawal-limit'), 'ce que la limite de prélèvement laisse');
  assert.equal(timingReasonLabel('withdrawal-limit'), 'un jour où la limite de prélèvement le permet');
});
