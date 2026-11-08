import assert from 'node:assert/strict';
import test from 'node:test';
import type { IrrigationEventRecord } from '../lib/domain/irrigation-event-record.ts';
import { millimetersForDurationSeconds } from '../lib/domain/irrigation-timer.ts';
import { planningNeedMm, realRemainingMm, type BedIrrigationNeed } from '../lib/domain/irrigation-needs.ts';
import type { PlanSuggestion, PlanningInputs } from '../lib/domain/planning/contract.ts';
import { buildWeeklyPlan } from '../lib/domain/planning/engine.ts';
import { markKeptSuggestions } from '../lib/domain/planning/suggestions.ts';
import { cubicMetersFromMillimeters } from '../lib/domain/units.ts';
import { splitVolumeAcrossLocalDays } from '../lib/domain/water-management.ts';
import { assertInvariants, BLOC_2, byEquipment, close, farm, settings, TZ, validatedIrrigation } from './support/planning-fixtures.ts';

/**
 * Les suggestions sur les arrosages validés (docs/replanning-contract.md,
 * règles 11 à 17 ; docs/planning-contract.md, « Les suggestions sur les
 * arrosages validés ») : la dose utile, « Annuler », « Réduire à X mm »,
 * jamais allonger, l'ordre du temps, le matériel retiré, la limite posée
 * après coup, « Garder ». Les exemples du contrat sont rejoués sur la ferme
 * de test ; le moteur ne touche jamais à l'arrosage validé lui-même.
 */

/** Mercredi 8 h à la ferme : la pluie de la nuit est saisie, les arrosages du soir sont à venir. */
const WEDNESDAY_8H = new Date('2026-09-30T06:00:00.000Z');
const WEDNESDAY_21H = '2026-09-30T19:00:00.000Z';
const THURSDAY_21H = '2026-10-01T19:00:00.000Z';
const SUNDAY_21H = '2026-10-04T19:00:00.000Z';
const TUNNEL_1 = Array.from({ length: 8 }, (_, index) => `T1-${index + 1}`);
const TUNNEL_2 = Array.from({ length: 8 }, (_, index) => `T2-${index + 1}`);
const GAG1_BEDS = ['B1-0', 'B1-1', 'B1-2', 'B1-3'];
/** 10 mm à 6,667 mm/h, 15 mm, et 10 mm à 10 mm/h, en secondes. */
const SPRINKLER_10MM = 5400;
const SPRINKLER_15MM = 8100;
const TUNNEL_1_10MM = 3600;
const TUNNEL_2_15MM = 2700;
/** 8 mm à 14 mm/h, à la seconde près. */
const DRIP_8MM = 2057;
/** Les doses exactes que ces durées donnent, au millième de millimètre : les besoins les reprennent telles quelles, comme la 3.3. */
const MM_SPRINKLER_10 = millimetersForDurationSeconds(6.667, SPRINKLER_10MM);
const MM_SPRINKLER_15 = millimetersForDurationSeconds(6.667, SPRINKLER_15MM);
const MM_SPRINKLER_5 = millimetersForDurationSeconds(6.667, 2700);
const MM_DRIP_8 = millimetersForDurationSeconds(14, DRIP_8MM);

/** Les termes du besoin d'une planche, cohérents entre eux comme la 3.3 les produit. */
function need(terms: { objectiveMm?: number | null; actualRainMm?: number; forecastRainMm?: number; actualIrrigationMm?: number; plannedIrrigationMm?: number; manualOverrideMm?: number }): Partial<BedIrrigationNeed> {
  const objectiveMm = terms.objectiveMm === undefined ? 20 : terms.objectiveMm;
  const actualRainMm = terms.actualRainMm ?? 0;
  const forecastRainMm = terms.forecastRainMm ?? 0;
  const actualIrrigationMm = terms.actualIrrigationMm ?? 0;
  const plannedIrrigationMm = terms.plannedIrrigationMm ?? 0;
  const raw = planningNeedMm(objectiveMm, actualRainMm, forecastRainMm, actualIrrigationMm, plannedIrrigationMm);
  return {
    objectiveMm, actualRainMm, forecastRainMm, actualIrrigationMm, plannedIrrigationMm,
    rawPlanningNeedMm: raw, calculatedNeedMm: raw, effectiveNeedMm: terms.manualOverrideMm ?? raw,
    realRemainingMm: realRemainingMm(objectiveMm, actualRainMm, actualIrrigationMm), manualOverrideMm: terms.manualOverrideMm ?? null,
  };
}

const only = (plan: { suggestions: PlanSuggestion[] }, eventId: string) => plan.suggestions.filter((suggestion) => suggestion.eventId === eventId);
const usefulCause = (suggestion: PlanSuggestion) => {
  const cause = suggestion.causes.find((candidate) => candidate.kind === 'useful-dose');
  assert.ok(cause && cause.kind === 'useful-dose', 'une raison « dose utile »');
  return cause;
};

test('règle 13, l’exemple du contrat : 10 mm validés pour mercredi soir, 8 mm au pluviomètre le matin, dose utile 2 mm — « Annuler »', () => {
  const soir = validatedIrrigation('bloc-2-mercredi', 'rampe-bloc-2', WEDNESDAY_21H, SPRINKLER_10MM, BLOC_2);
  const { inputs } = farm({ now: WEDNESDAY_8H, events: [soir], plotNeeds: { 'bloc-2': need({ objectiveMm: 10, actualRainMm: 8, plannedIrrigationMm: MM_SPRINKLER_10 }) } });
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);

  const [suggestion, ...others] = only(plan, 'bloc-2-mercredi');
  assert.equal(others.length, 0);
  assert.equal(suggestion.suggestion, 'cancel');
  assert.equal(suggestion.doseMm, null);
  assert.equal(suggestion.eventEquipmentId, soir.equipment.id);
  assert.equal(suggestion.equipmentName, 'rampe-bloc-2');
  assert.equal(suggestion.kind, 'sprinkler');
  assert.equal(suggestion.plannedStartAt, WEDNESDAY_21H);
  close(suggestion.plannedDoseMm, 10, 0.01, 'dose prévue');
  const cause = usefulCause(suggestion);
  assert.equal(cause.objectiveMm, 10);
  assert.equal(cause.actualRainMm, 8);
  assert.equal(cause.earlierPlannedMm, 0);
  close(cause.needBeforeMm, 2, 1e-6, 'besoin avant');
  close(cause.usefulMm, 2, 0.01, 'dose utile');
  assert.equal(cause.minimumMm, 5);
  assert.equal(cause.lastDay, false);
  // L'arrosage validé n'est ni modifié ni remplacé : le moteur n'a rien à placer sur le bloc 2.
  assert.equal(byEquipment(plan, 'rampe-bloc-2').length, 0);
  assert.deepEqual(plan.overcommittedDays, []);
});

test('règle 14, l’exemple du contrat : un goutte-à-goutte validé à 8 mm, objectif baissé à 4 mm — « Réduire à 4 mm », la durée au prorata ; à 6 mm, rien', () => {
  const gag = validatedIrrigation('gag1-mercredi', 'gag1', '2026-09-30T06:00:00.000Z', DRIP_8MM, GAG1_BEDS, { kind: 'drip' });
  const reduced = farm({ now: new Date('2026-09-30T05:00:00.000Z'), events: [gag], needs: Object.fromEntries(GAG1_BEDS.map((id) => [id, need({ objectiveMm: 4, plannedIrrigationMm: MM_DRIP_8 })])) });
  const plan = buildWeeklyPlan(reduced.inputs, settings);
  assertInvariants(plan, reduced.inputs);
  const [suggestion] = only(plan, 'gag1-mercredi');
  assert.equal(suggestion.suggestion, 'reduce');
  close(suggestion.doseMm, 4, 0.01, 'réduire à 4 mm');
  assert.equal(suggestion.durationSeconds, 1029, '4 mm à 14 mm/h');
  assert.equal(suggestion.endAt, new Date(Date.parse(suggestion.plannedStartAt) + 1029 * 1000).toISOString(), 'la fin suit le début');
  close(suggestion.plannedDoseMm, 8, 0.01, 'dose prévue');
  assert.equal(suggestion.priority, 'normal');
  close(usefulCause(suggestion).needBeforeMm, 4, 1e-6, 'besoin avant');

  const kept = farm({ now: new Date('2026-09-30T05:00:00.000Z'), events: [gag], needs: Object.fromEntries(GAG1_BEDS.map((id) => [id, need({ objectiveMm: 6, plannedIrrigationMm: MM_DRIP_8 })])) });
  assert.equal(only(buildWeeklyPlan(kept.inputs, settings), 'gag1-mercredi').length, 0, 'un écart de 2 mm, sous les 3 mm minimum, ne fait rien suggérer');
});

test('règle 12 : les arrosages validés sont examinés dans l’ordre du temps ; une pluie qui rend inutile l’un de deux arrosages fait suggérer sur le dernier', () => {
  const mercredi = validatedIrrigation('bloc-2-mercredi', 'rampe-bloc-2', WEDNESDAY_21H, SPRINKLER_10MM, BLOC_2);
  const jeudi = validatedIrrigation('bloc-2-jeudi', 'rampe-bloc-2', THURSDAY_21H, SPRINKLER_10MM, BLOC_2);
  // Dans le désordre, pour que l'ordre vienne du temps et non de la liste.
  const { inputs } = farm({ now: WEDNESDAY_8H, events: [jeudi, mercredi], plotNeeds: { 'bloc-2': need({ objectiveMm: 20, actualRainMm: 8, plannedIrrigationMm: 2 * MM_SPRINKLER_10 }) } });
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  assert.equal(only(plan, 'bloc-2-mercredi').length, 0, 'le plus tôt reste servi : 12 mm utiles pour 10 prévus');
  const [suggestion] = only(plan, 'bloc-2-jeudi');
  assert.equal(suggestion.suggestion, 'cancel');
  const cause = usefulCause(suggestion);
  close(cause.earlierPlannedMm, 10, 0.01, 'l’arrosage de mercredi compte avant celui de jeudi');
  close(cause.needBeforeMm, 2, 0.01, 'il reste 2 mm');
  assert.deepEqual(plan.suggestions.map((item) => item.eventId), ['bloc-2-jeudi']);
});

test('règle 15 : un arrosage validé devenu insuffisant n’est jamais allongé ; le reste est proposé à part', () => {
  const court = validatedIrrigation('bloc-2-court', 'rampe-bloc-2', WEDNESDAY_21H, 2700, BLOC_2);
  const { inputs } = farm({ now: WEDNESDAY_8H, events: [court], plotNeeds: { 'bloc-2': need({ objectiveMm: 20, plannedIrrigationMm: MM_SPRINKLER_5 }) } });
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  assert.equal(plan.suggestions.length, 0);
  const proposals = byEquipment(plan, 'rampe-bloc-2');
  assert.ok(proposals.length >= 1, 'le reste du besoin est proposé par une proposition ordinaire');
  close(proposals.reduce((sum, proposal) => sum + proposal.doseMm, 0), 15, 0.05, 'les 15 mm restants');
});

test('règle 12 : une irrigation en cours, en retard ou sans besoin calculable ne reçoit jamais de suggestion', () => {
  const useless = need({ objectiveMm: 10, actualRainMm: 8, plannedIrrigationMm: MM_SPRINKLER_10 });
  const running: IrrigationEventRecord = (() => {
    const base = validatedIrrigation('bloc-2-en-cours', 'rampe-bloc-2', '2026-09-30T05:30:00.000Z', SPRINKLER_10MM, BLOC_2);
    return { ...base, equipment: { ...base.equipment, actualStartAt: '2026-09-30T05:30:00.000Z', timerState: 'running', timerStartedAt: '2026-09-30T05:30:00.000Z', timerResumedAt: '2026-09-30T05:30:00.000Z' } };
  })();
  const late = validatedIrrigation('bloc-2-en-retard', 'rampe-bloc-2', '2026-09-30T04:00:00.000Z', SPRINKLER_10MM, BLOC_2);
  const elsewhere = validatedIrrigation('ailleurs', 'rampe-bloc-2', WEDNESDAY_21H, SPRINKLER_10MM, ['planche-inconnue']);
  const { inputs } = farm({ now: WEDNESDAY_8H, events: [running, late, elsewhere], plotNeeds: { 'bloc-2': useless } });
  const plan = buildWeeklyPlan(inputs, settings);
  assert.equal(plan.suggestions.length, 0);

  // Sans objectif, la dose utile est inconnue : rien n'est suggéré, pas même « Annuler ».
  const soir = validatedIrrigation('bloc-2-mercredi', 'rampe-bloc-2', WEDNESDAY_21H, SPRINKLER_10MM, BLOC_2);
  const noObjective = farm({ now: WEDNESDAY_8H, events: [soir], plotNeeds: { 'bloc-2': { ...need({ objectiveMm: null, plannedIrrigationMm: MM_SPRINKLER_10 }), effectiveNeedMm: null, realRemainingMm: null } } });
  assert.equal(buildWeeklyPlan(noObjective.inputs, settings).suggestions.length, 0);
});

test('règle 12 : le dernier jour tolère une dose utile sous le minimum — « Réduire » plutôt qu’« Annuler », sauf quand il ne reste rien', () => {
  const dimanche = validatedIrrigation('bloc-2-dimanche', 'rampe-bloc-2', SUNDAY_21H, SPRINKLER_10MM, BLOC_2);
  const small = farm({ now: new Date('2026-10-04T08:00:00.000Z'), events: [dimanche], plotNeeds: { 'bloc-2': need({ objectiveMm: 13, actualRainMm: 10, plannedIrrigationMm: MM_SPRINKLER_10 }) } });
  const plan = buildWeeklyPlan(small.inputs, settings);
  const [suggestion] = only(plan, 'bloc-2-dimanche');
  assert.equal(suggestion.suggestion, 'reduce', '3 mm utiles un dimanche : sous les 5 mm, mais le dernier jour les place');
  close(suggestion.doseMm, 3, 0.01, 'réduire à 3 mm');
  assert.equal(usefulCause(suggestion).lastDay, true);

  const nothing = farm({ now: new Date('2026-10-04T08:00:00.000Z'), events: [dimanche], plotNeeds: { 'bloc-2': need({ objectiveMm: 10, actualRainMm: 12, plannedIrrigationMm: MM_SPRINKLER_10 }) } });
  assert.equal(only(buildWeeklyPlan(nothing.inputs, settings), 'bloc-2-dimanche')[0]?.suggestion, 'cancel', 'zéro reste zéro, même le dernier jour');
});

test('règle 12 : la dose utile suit R11 et R13 — la planche la mieux arrosée fixe la dose, plafonnée par la dose maximale', () => {
  // La rampe arrose aussi une planche de bord à un taux trop faible pour la commander : son besoin, même grand, ne compte pas.
  const base = validatedIrrigation('bloc-2-mercredi', 'rampe-bloc-2', WEDNESDAY_21H, SPRINKLER_15MM, BLOC_2);
  const edge = { ...base.equipment.applications[0], otfBedId: 'B1-0', rateMmPerHour: 2, plannedAmountMm: 4.5 };
  const withEdge: IrrigationEventRecord = { ...base, equipment: { ...base.equipment, applications: [...base.equipment.applications, edge] } };
  // Le goutte-à-goutte a déjà arrosé le bloc : 14 mm partout, 11 mm sur B2-1 ; la planche de bord, elle, manque de 35 mm.
  const { inputs } = farm({
    now: WEDNESDAY_8H,
    events: [withEdge],
    plotNeeds: { 'bloc-2': need({ actualIrrigationMm: 14, plannedIrrigationMm: MM_SPRINKLER_15 }) },
    needs: { 'B2-1': need({ actualIrrigationMm: 11, plannedIrrigationMm: MM_SPRINKLER_15 }), 'B1-0': need({ objectiveMm: 40, plannedIrrigationMm: 4.5 }) },
  });
  const plan = buildWeeklyPlan(inputs, settings);
  const [suggestion] = only(plan, 'bloc-2-mercredi');
  assert.equal(suggestion.suggestion, 'reduce', 'si la planche de bord comptait, 35 mm utiles ne feraient rien suggérer');
  const cause = usefulCause(suggestion);
  assert.equal(cause.bedId, 'B2-1', 'à taux égal, le besoin le plus élevé des planches qui commandent (R11) : 9 mm, pas 6');
  close(cause.needBeforeMm, 9, 1e-6);
  close(suggestion.doseMm, 9, 0.01, 'réduire à 9 mm : 15 prévus, écart 6, au moins les 5 mm minimum');
  close(cause.actualIrrigationMm, 11, 1e-6);
});

test('règle 16 : un matériel retiré ou reposé ailleurs — « Annuler », avec le matériel et la date du retrait ; un arrosage passé n’a plus de suggestion', () => {
  const stored = validatedIrrigation('bloc-2-stocke', 'rampe-bloc-2', WEDNESDAY_21H, SPRINKLER_10MM, BLOC_2);
  const moved = validatedIrrigation('gag1-deplace', 'gag1', '2026-09-30T06:00:00.000Z', DRIP_8MM, GAG1_BEDS, { kind: 'drip' });
  const past = validatedIrrigation('bloc-2-passe', 'rampe-bloc-2', '2026-09-29T19:00:00.000Z', SPRINKLER_10MM, BLOC_2);
  const inputs: PlanningInputs = {
    ...farm({ now: WEDNESDAY_8H }).inputs,
    blockedIrrigations: [
      { event: stored, block: { code: 'equipment_stored', removedAt: '2026-09-29T15:00:00.000Z' } },
      { event: moved, block: { code: 'equipment_moved' } },
      { event: past, block: { code: 'equipment_moved' } },
    ],
  };
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  assert.deepEqual(plan.suggestions.map((suggestion) => [suggestion.eventId, suggestion.suggestion]), [['gag1-deplace', 'cancel'], ['bloc-2-stocke', 'cancel']], 'dans l’ordre du temps');
  assert.deepEqual(only(plan, 'bloc-2-stocke')[0].causes, [{ kind: 'equipment-stored', equipmentName: 'rampe-bloc-2', removedAt: '2026-09-29T15:00:00.000Z' }]);
  assert.deepEqual(only(plan, 'gag1-deplace')[0].causes, [{ kind: 'equipment-moved', equipmentName: 'gag1' }]);
  close(only(plan, 'bloc-2-stocke')[0].plannedDoseMm, 10, 0.01);
});

/** Trois arrosages validés mercredi soir, haute, normale et basse priorité : 1,98 + 2,475 + 1,32 = 5,775 m³. */
function overcommittedWednesday(options: { dailyLimit: number; lowWettedArea?: number | null; bloc2ObjectiveMm?: number }) {
  const high = validatedIrrigation('tunnel-2', 'rampe-tunnel-2', WEDNESDAY_21H, TUNNEL_2_15MM, TUNNEL_2, { rate: 20 });
  const normal = validatedIrrigation('bloc-2', 'rampe-bloc-2', WEDNESDAY_21H, SPRINKLER_15MM, BLOC_2);
  const low = validatedIrrigation('tunnel-1', 'rampe-tunnel-1', WEDNESDAY_21H, TUNNEL_1_10MM, TUNNEL_1, { rate: 10, wettedAreaSquareMeters: options.lowWettedArea });
  const { inputs } = farm({
    now: WEDNESDAY_8H,
    dailyLimit: options.dailyLimit,
    dailyLimitFrom: '2026-09-30',
    priorities: { 'tunnel-2': 'high', 'tunnel-1': 'low' },
    events: [low, normal, high],
    plotNeeds: {
      'tunnel-2': need({ plannedIrrigationMm: 15 }),
      'bloc-2': need({ objectiveMm: options.bloc2ObjectiveMm ?? 20, plannedIrrigationMm: MM_SPRINKLER_15 }),
      'tunnel-1': need({ plannedIrrigationMm: 10 }),
    },
  });
  return { inputs, high, normal, low };
}

/** Le volume du jour des arrosages validés une fois les suggestions suivies, en m³. */
function wednesdayVolumeAfter(plan: { suggestions: PlanSuggestion[] }, irrigations: IrrigationEventRecord[]): number {
  return irrigations.reduce((sum, irrigation) => {
    const suggestion = plan.suggestions.find((candidate) => candidate.eventId === irrigation.id);
    if (suggestion?.suggestion === 'cancel') return sum;
    const fraction = suggestion?.durationSeconds ? suggestion.durationSeconds / irrigation.equipment.plannedDurationSeconds : 1;
    const cubicMeters = irrigation.equipment.applications.reduce((total, application) => total + cubicMetersFromMillimeters(application.plannedAmountMm * fraction, application.wettedAreaSquareMeters ?? 0), 0);
    const endAt = new Date(Date.parse(irrigation.equipment.plannedStartAt!) + (suggestion?.durationSeconds ?? irrigation.equipment.plannedDurationSeconds) * 1000);
    return sum + (splitVolumeAcrossLocalDays({ startAt: irrigation.equipment.plannedStartAt!, endAt, cubicMeters, timeZone: TZ }).get('2026-09-30') ?? 0);
  }, 0);
}

test('règle 16 : une limite journalière posée après coup — le jour est signalé, la priorité haute servie, la normale réduite à la limite, la basse annulée', () => {
  const { inputs, high, normal, low } = overcommittedWednesday({ dailyLimit: 3 });
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  assert.equal(plan.overcommittedDays.length, 1);
  assert.equal(plan.overcommittedDays[0].date, '2026-09-30');
  assert.equal(plan.overcommittedDays[0].limitCubicMeters, 3);
  close(plan.overcommittedDays[0].committedCubicMeters, 5.775, 0.01, 'ce que le jour porte');

  assert.equal(only(plan, 'tunnel-2').length, 0, 'la priorité haute tient sous la limite : rien');
  const [reduced] = only(plan, 'bloc-2');
  assert.equal(reduced.suggestion, 'reduce');
  assert.equal(reduced.priority, 'normal');
  close(reduced.doseMm, 6.18, 0.02, '1,02 m³ restants sur 2,475 : 41 % de 15 mm');
  assert.equal(reduced.durationSeconds, 3338);
  assert.deepEqual(reduced.causes, [{ kind: 'daily-limit', date: '2026-09-30', limitCubicMeters: 3, committedCubicMeters: plan.overcommittedDays[0].committedCubicMeters }]);
  const [canceled] = only(plan, 'tunnel-1');
  assert.equal(canceled.suggestion, 'cancel');
  assert.equal(canceled.priority, 'low');
  assert.equal(canceled.causes[0].kind, 'daily-limit');
  assert.ok(wednesdayVolumeAfter(plan, [high, normal, low]) <= 3 + 1e-6, 'suivies, les suggestions ramènent le jour sous la limite');
  assert.ok(wednesdayVolumeAfter(plan, [high, normal, low]) > 2.99, 'et au plus près d’elle');
  // Le moteur, lui, ne place rien mercredi : le jour est plein.
  assert.ok(plan.proposals.every((proposal) => !proposal.startAt.startsWith('2026-09-30T19') && !proposal.startAt.startsWith('2026-09-30T2')), 'aucune proposition mercredi soir');
});

test('règle 16 : une réduction sous la dose minimale devient « Annuler » ; un volume invérifiable est signalé à part', () => {
  const tight = overcommittedWednesday({ dailyLimit: 2.5 });
  const plan = buildWeeklyPlan(tight.inputs, settings);
  assert.equal(only(plan, 'tunnel-2').length, 0);
  assert.equal(only(plan, 'bloc-2')[0].suggestion, 'cancel', '0,52 m³ restants : 3,15 mm, sous les 5 mm minimum');
  assert.equal(only(plan, 'tunnel-1')[0].suggestion, 'cancel');
  close(wednesdayVolumeAfter(plan, [tight.high, tight.normal, tight.low]), 1.98, 1e-6, 'il reste la seule priorité haute');

  const unknown = overcommittedWednesday({ dailyLimit: 3, lowWettedArea: null });
  const second = buildWeeklyPlan(unknown.inputs, settings);
  const [flagged] = only(second, 'tunnel-1');
  assert.equal(flagged.suggestion, 'cancel');
  assert.deepEqual(flagged.causes, [{ kind: 'volume-unknown', date: '2026-09-30' }]);
  close(second.overcommittedDays[0].committedCubicMeters, 4.455, 0.01, 'le volume inconnu ne compte pas, le jour reste dépassé');
  close(only(second, 'bloc-2')[0].doseMm, 6.18, 0.02, 'la normale est réduite comme avant');
});

test('deux suggestions sur le même arrosage : la plus forte l’emporte et leurs raisons s’ajoutent', () => {
  // L'objectif du bloc 2 baissé à 10 mm : la dose utile dit « Réduire à 10 mm », la limite dit 6,18 mm.
  const { inputs } = overcommittedWednesday({ dailyLimit: 3, bloc2ObjectiveMm: 10 });
  const plan = buildWeeklyPlan(inputs, settings);
  const [suggestion] = only(plan, 'bloc-2');
  assert.equal(suggestion.suggestion, 'reduce');
  close(suggestion.doseMm, 6.18, 0.02);
  assert.deepEqual(suggestion.causes.map((cause) => cause.kind).sort(), ['daily-limit', 'useful-dose']);
  close(usefulCause(suggestion).usefulMm, 10, 0.01);
});

test('règle 17, « Garder » : une suggestion gardée se tait, et ne revient que pour une autre dose ou « Annuler » après « Réduire »', () => {
  const gag = validatedIrrigation('gag1-mercredi', 'gag1', '2026-09-30T06:00:00.000Z', DRIP_8MM, GAG1_BEDS, { kind: 'drip' });
  const soir = validatedIrrigation('bloc-2-mercredi', 'rampe-bloc-2', WEDNESDAY_21H, SPRINKLER_10MM, BLOC_2);
  const { inputs } = farm({
    now: new Date('2026-09-30T05:00:00.000Z'),
    events: [gag, soir],
    needs: Object.fromEntries(GAG1_BEDS.map((id) => [id, need({ objectiveMm: 4, plannedIrrigationMm: MM_DRIP_8 })])),
    plotNeeds: { 'bloc-2': need({ objectiveMm: 10, actualRainMm: 8, plannedIrrigationMm: MM_SPRINKLER_10 }) },
  });
  const { suggestions } = buildWeeklyPlan(inputs, settings);
  assert.deepEqual(suggestions.map((suggestion) => suggestion.suggestion), ['reduce', 'cancel']);
  const kept = (keeps: Parameters<typeof markKeptSuggestions>[1]) => markKeptSuggestions(suggestions, keeps).map((suggestion) => suggestion.kept);
  assert.deepEqual(kept([]), [false, false]);
  assert.deepEqual(kept([{ eventEquipmentId: gag.equipment.id, suggestion: 'reduce', doseMm: 4 }]), [true, false], '4,0017 mm et 4 mm s’affichent pareil');
  assert.deepEqual(kept([{ eventEquipmentId: gag.equipment.id, suggestion: 'reduce', doseMm: 4.1 }]), [false, false], 'une autre dose');
  assert.deepEqual(kept([{ eventEquipmentId: gag.equipment.id, suggestion: 'cancel', doseMm: null }]), [false, false], '« Annuler » gardé ne tait pas « Réduire »');
  assert.deepEqual(kept([{ eventEquipmentId: soir.equipment.id, suggestion: 'cancel', doseMm: null }, { eventEquipmentId: gag.equipment.id, suggestion: 'reduce', doseMm: 3.98 }]), [true, true]);
  assert.deepEqual(kept([{ eventEquipmentId: 'autre', suggestion: 'cancel', doseMm: null }]), [false, false], 'un autre arrosage');
});

test('mêmes entrées, mêmes suggestions : deux calculs sans événement entre eux proposent la même chose (règle 9)', () => {
  const { inputs } = overcommittedWednesday({ dailyLimit: 3, bloc2ObjectiveMm: 10 });
  const first = buildWeeklyPlan(inputs, settings);
  const second = buildWeeklyPlan(inputs, settings);
  assert.deepEqual(second.suggestions, first.suggestions);
  assert.deepEqual(second.overcommittedDays, first.overcommittedDays);
});
