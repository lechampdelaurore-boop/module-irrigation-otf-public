import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { cancelPlannedIrrigationForUser } from '../../db/irrigation-event/completion';
import { createIrrigationEventForUser, updatePlannedIrrigationForUser } from '../../db/irrigation-event/create';
import { saveFeatureSelectionForUser } from '../../db/feature-selection-repository';
import { decidePlanProposalForUser } from '../../db/planning-repository';
import { createProtectedSlotForUser, deleteProtectedSlotForUser } from '../../db/protected-slots-repository';
import { listPumpConfigurationForUser, saveEquipmentDefaultPumpForUser, savePumpForUser } from '../../db/pump-repository';
import { saveHydricGoalForUser } from '../../db/water-management-repository';
import { saveResourceReservoirLinkForUser, saveWaterReservoirForUser, saveWaterResourceForUser } from '../../db/water-resource-repository';
import type { IrrigationSnapshot } from '../../lib/domain/domain';
import { FEATURE_IDS } from '../../lib/domain/features/catalogue';
import { planActionCounts } from '../../lib/domain/planning/action-summary';
import type { PlanCalculationEvent, StoredWeeklyPlan } from '../../lib/domain/planning/contract';
import { calculationTriggerLabel, summarizePlan } from '../../lib/domain/planning/presentation';
import { minutesOfDay } from '../../lib/domain/planning/settings';
import { recalculatePlanAfterEvent, recalculatePlanAfterFeatureChange } from '../../lib/services/planning-recalculation';
import { computeWeeklyPlanForUser, readWeeklyPlanForUser } from '../../lib/services/planning-service';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { FIXTURE_PLOT_ID, FIXTURE_ZONE_ID, completedDraft, createDripFixture } from '../support/irrigation-fixtures';

const ALICE = 'alice';
const BOB = 'bob';
const NOW = new Date('2026-09-29T10:52:00.000Z'); // mardi 12 h 52 à la ferme

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

const snapshot: IrrigationSnapshot = {
  configuration: { seasonFirst: 2025, seasonLast: 2026 },
  structure: { id: '17', name: 'Ferme', legalCity: 'Rennes', legalPostcode: '35000', legalCountry: 'FR' },
  zones: [{ id: FIXTURE_ZONE_ID, name: 'Zone', area: 1000, seasons: [2026] }],
  plots: [{ id: FIXTURE_PLOT_ID, zoneId: FIXTURE_ZONE_ID, name: 'Jardin', mode: 'garden', length: 40, width: 30, area: 1200, seasons: [2026] }],
  beds: [
    { id: 'bed-1', zoneId: FIXTURE_ZONE_ID, plotId: FIXTURE_PLOT_ID, name: 'P1', length: 40, width: 0.75, alleyWidth: 0.45, area: 30, seasons: [2026] },
    { id: 'bed-2', zoneId: FIXTURE_ZONE_ID, plotId: FIXTURE_PLOT_ID, name: 'P2', length: 40, width: 0.75, alleyWidth: 0.45, area: 30, seasons: [2026] },
  ],
  source: 'cache',
  lastSuccessfulReadAt: '2026-09-29T00:00:00.000Z',
};

async function farmWithWater(owner = ALICE) {
  const fixture = await createDripFixture(owner, { beds: ['bed-1', 'bed-2'], rateMmPerHour: 14, bedAreaSquareMeters: 30 });
  const resourceId = await saveWaterResourceForUser(owner, owner, null, { name: 'Forage', type: 'borehole', nominalFlowCubicMetersPerHour: 0.511, status: 'active', availableFrom: null, availableUntil: null, notes: null });
  const reservoirId = await saveWaterReservoirForUser(owner, owner, null, {
    name: 'Réserve tampon', type: 'tank', capacityCubicMeters: 60, currentVolumeCubicMeters: 30, minimumSafetyCubicMeters: 0,
    exposedSurfaceSquareMeters: 0, receivesRain: false, evaporationEnabled: false, evaporationCoefficient: 0, status: 'active', notes: null,
  }, '2026-09-29T10:00:00.000Z');
  await saveResourceReservoirLinkForUser(owner, owner, { resourceId, reservoirId, fillMode: 'automatic', active: true });
  const pumpId = await savePumpForUser(owner, owner, null, { name: 'La pompe', maximumFlowCubicMetersPerHour: 8, status: 'active', notes: null, origins: [{ sourceKind: 'reservoir', resourceId: null, reservoirId, isDefault: true }] });
  await saveEquipmentDefaultPumpForUser(owner, owner, fixture.equipment.id, pumpId);
  // L'objectif est fixé la semaine précédente : la reprise s'applique dès le lundi (docs/irrigation-needs-contract.md).
  await saveHydricGoalForUser(owner, { season: 2026, weekStart: '2026-09-21', scopeType: 'farm', otfZoneId: null, otfPlotId: null, otfBedId: null, amountMm: 20 });
  return { fixture, reservoirId, pumpId };
}

test('le service assemble les entrées réelles, fait tourner le moteur et enregistre le calcul avec ses propositions', async () => {
  const { fixture } = await farmWithWater();
  const stored = await computeWeeklyPlanForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: NOW, trigger: 'manual', actorUserId: ALICE });
  assert.equal(stored.calculation.weekStart, '2026-09-28');
  assert.equal(stored.calculation.trigger, 'manual');
  // 20 mm d'objectif sur deux planches de goutte-à-goutte à 14 mm/h : deux créneaux de 10 mm, 43 min, 0,6 m³ chacun, à 24 h d'écart.
  assert.equal(stored.proposals.length, 2);
  const [first, second] = stored.proposals;
  assert.equal(first.equipmentId, fixture.equipment.id);
  assert.equal(first.kind, 'drip');
  assert.equal(first.durationSeconds, 2571);
  assert.ok(Math.abs((first.volumeCubicMeters ?? 0) - 0.6) < 0.001, `${first.volumeCubicMeters} m³`);
  assert.equal(first.startAt, '2026-09-29T10:52:00.000Z', 'dès maintenant, dans la plage du goutte-à-goutte');
  assert.ok(Date.parse(second.startAt) - Date.parse(first.startAt) >= 24 * 3_600_000);
  assert.equal(first.justification.hydraulicallyVerified, true);
  assert.equal(first.justification.supply?.originName, 'Réserve tampon');
  assert.equal(first.pumpId !== null, true);
  assert.deepEqual(stored.calculation.summary.beds.map((bed) => [bed.bedId, bed.needMm, bed.placedMm, bed.deficitMm]), [['bed-1', 20, 20, 0], ['bed-2', 20, 20, 0]]);
  assert.equal(stored.calculation.summary.deficit.bedCount, 0);
  assert.equal(stored.calculation.settings.forecastRainShare, 1);

  const read = await readWeeklyPlanForUser({ ownerUserId: ALICE, season: 2026, now: NOW });
  assert.deepEqual(read, stored, 'la lecture rend ce qui vient d’être enregistré');
});

test('un second calcul remplace les propositions non décidées ; une validée reste, et son irrigation planifiée réduit le besoin', async () => {
  const { fixture } = await farmWithWater();
  const first = await computeWeeklyPlanForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: NOW });
  // Le maraîcher valide la proposition de demain : elle devient une irrigation planifiée ordinaire (2.7),
  // entièrement à venir, donc déduite en entier du besoin par la 3.3.
  const validated = first.proposals[1];
  const created = await createIrrigationEventForUser(ALICE, {
    ...completedDraft(fixture, { startAt: validated.startAt, endAt: validated.endAt, durationSeconds: validated.durationSeconds }),
    kind: 'planned', actualStartAt: null, actualEndAt: null, actualDurationSeconds: 0,
    plannedStartAt: validated.startAt, plannedEndAt: validated.endAt, plannedDurationSeconds: validated.durationSeconds,
  });
  assert.equal(await decidePlanProposalForUser(ALICE, { proposalId: validated.storedId, status: 'validated', validatedEventId: created.eventId, actorUserId: ALICE }), true);

  const second = await computeWeeklyPlanForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: new Date('2026-09-29T11:00:00.000Z'), trigger: 'event' });
  assert.notEqual(second.calculation.id, first.calculation.id);
  const statuses = second.proposals.map((p) => [p.calculationId === first.calculation.id ? 'premier' : 'second', p.status]);
  assert.deepEqual(statuses, [['premier', 'validated'], ['second', 'proposed']], 'la validée reste ; la première du premier calcul a été remplacée par une nouvelle');
  assert.equal(second.proposals[0]?.irrigationStatus, 'planned', 'la validée lit l’état réel de son irrigation');
  assert.equal(summarizePlan(second, new Date('2026-09-29T11:00:00.000Z')).counts.validated, 1);

  // L'irrigation planifiée annulée (2.7) : la carte validée lit le réel — « Annulée », hors du compte des validées —
  // et le besoin, revenu au plan, est replacé (statuts du contrat ; recette réelle du 31 octobre 2026).
  await cancelPlannedIrrigationForUser(ALICE, created.eventEquipmentId);
  const third = await computeWeeklyPlanForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: new Date('2026-09-29T11:30:00.000Z'), trigger: 'event', triggerEvent: 'irrigation-canceled' });
  const canceled = third.proposals.find((p) => p.storedId === validated.storedId);
  assert.equal(canceled?.status, 'validated', 'le registre garde la décision du maraîcher');
  assert.equal(canceled?.irrigationStatus, 'canceled', 'et lit que son irrigation est annulée');
  assert.equal(summarizePlan(third, new Date('2026-09-29T11:30:00.000Z')).counts.validated, 0, 'elle ne compte plus parmi les validées');
  const replaced = third.proposals.filter((p) => p.status === 'proposed');
  assert.ok(replaced.length >= 1, 'le besoin est revenu au plan');
  assert.ok(Math.abs(replaced.reduce((sum, p) => sum + p.doseMm, 0) - 20) < 0.05, `${replaced.map((p) => p.doseMm).join(' + ')} mm : les 20 mm sont de nouveau à placer`);
  const remaining = second.proposals.find((p) => p.status === 'proposed');
  assert.ok(remaining);
  assert.ok(Math.abs(remaining.doseMm - 10) < 0.05, remaining.doseMm + ' mm restent à placer une fois l’irrigation planifiée déduite');
  // R7 : 24 h de début à début, dans les deux sens — aujourd'hui serait à moins de 24 h de l'irrigation validée de demain.
  assert.ok(Date.parse(remaining.startAt) >= Date.parse(validated.startAt) + 24 * 3_600_000, 'placée après l’irrigation validée, à 24 h au moins');
  assert.deepEqual(second.calculation.summary.beds.map((bed) => [bed.bedId, Math.round(bed.needMm * 100) / 100]), [['bed-1', 10], ['bed-2', 10]], 'le besoin de la 3.3 déduit l’irrigation planifiée');
});

test('une validée se lit avec son irrigation, heures modifiées comprises : le planning compte « En retard » comme la page des arrosages, chez son exploitation seulement (lot 3, point 5, cas 1 et 14)', async () => {
  const { fixture } = await farmWithWater();
  await farmWithWater(BOB);
  const first = await computeWeeklyPlanForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: NOW });
  await computeWeeklyPlanForUser({ ownerUserId: BOB, season: 2026, snapshot, now: NOW });
  const validated = first.proposals[1];
  const planned = (startAt: string, endAt: string) => ({
    ...completedDraft(fixture, { startAt, endAt, durationSeconds: validated.durationSeconds }),
    kind: 'planned' as const, actualStartAt: null, actualEndAt: null, actualDurationSeconds: 0,
    plannedStartAt: startAt, plannedEndAt: endAt, plannedDurationSeconds: validated.durationSeconds,
  });
  const created = await createIrrigationEventForUser(ALICE, planned(validated.startAt, validated.endAt));
  assert.equal(await decidePlanProposalForUser(ALICE, { proposalId: validated.storedId, status: 'validated', validatedEventId: created.eventId, actorUserId: ALICE }), true);
  const read = await readWeeklyPlanForUser({ ownerUserId: ALICE, season: 2026, now: NOW });
  assert.deepEqual(read?.proposals.find((p) => p.storedId === validated.storedId)?.irrigation, {
    status: 'planned',
    equipment: {
      status: 'planned', plannedStartAt: validated.startAt, plannedEndAt: validated.endAt,
      timerState: null, timerStartedAt: null, remainingCanceledAt: null, canceledAt: null,
    },
  }, 'la validée porte l’irrigation telle que la règle du retard la lit');
  assert.ok(read?.proposals.filter((p) => p.status !== 'validated').every((p) => p.irrigation === null), 'une proposition non validée n’en porte aucune');

  // Le maraîcher décale l'irrigation de quatre heures sur « Arrosages » : le planning lit les nouvelles heures.
  const shift = 4 * 3_600_000;
  const startAt = new Date(Date.parse(validated.startAt) + shift).toISOString();
  const endAt = new Date(Date.parse(validated.endAt) + shift).toISOString();
  await updatePlannedIrrigationForUser(ALICE, created.eventEquipmentId, planned(startAt, endAt));
  const afterFirstSlot = new Date(Date.parse(validated.endAt) + 30 * 60_000);
  const moved = await readWeeklyPlanForUser({ ownerUserId: ALICE, season: 2026, now: afterFirstSlot });
  assert.ok(moved);
  assert.equal(moved.proposals.find((p) => p.storedId === validated.storedId)?.irrigation?.equipment.plannedStartAt, startAt);
  const counts = (now: Date) => planActionCounts(moved, summarizePlan(moved, now), 30, now);
  assert.equal(counts(afterFirstSlot).late, 0, 'l’ancien créneau est passé, le nouveau n’est pas commencé : rien en retard');
  const afterTolerance = new Date(Date.parse(startAt) + 30 * 60_000);
  assert.deepEqual([counts(afterTolerance).late, counts(afterTolerance).missed], [1, 0], 'la tolérance de 30 min passée sur le nouveau créneau : en retard');
  const afterSecondSlot = new Date(Date.parse(endAt) + 60_000);
  assert.deepEqual([counts(afterSecondSlot).late, counts(afterSecondSlot).missed], [1, 1], 'tout le créneau passé sans démarrage : non faite');

  // Cas 14 : l'exploitation de Bob ne lit rien de l'irrigation d'Alice.
  const bob = await readWeeklyPlanForUser({ ownerUserId: BOB, season: 2026, now: NOW });
  assert.ok(bob && bob.proposals.length > 0);
  assert.ok(bob.proposals.every((p) => p.status !== 'validated' && p.irrigation === null), 'aucune validée, aucune irrigation chez Bob');
});

test('une proposition refusée exclut son matériel sur ses heures au calcul suivant ; le besoin est placé ailleurs (D-030, point ouvert 31)', async () => {
  const { fixture } = await farmWithWater();
  const first = await computeWeeklyPlanForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: NOW });
  // Le maraîcher refuse la proposition de tout de suite : 12 h 52 → 13 h 34 min 51 s, le matériel à ces heures.
  const refused = first.proposals[0];
  assert.equal(refused.startAt, '2026-09-29T10:52:00.000Z');
  assert.equal(await decidePlanProposalForUser(ALICE, { proposalId: refused.storedId, status: 'refused', validatedEventId: null, actorUserId: ALICE }), true);

  const second = await computeWeeklyPlanForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: new Date('2026-09-29T11:00:00.000Z'), trigger: 'manual', actorUserId: ALICE });
  const stillRefused = second.proposals.find((proposal) => proposal.storedId === refused.storedId);
  assert.equal(stillRefused?.status, 'refused', 'la carte refusée reste lisible avec le calcul suivant');
  const proposed = second.proposals.filter((proposal) => proposal.status === 'proposed');
  assert.equal(proposed.length, 2, 'le besoin reste entier : deux créneaux de 10 mm');
  for (const proposal of proposed) {
    assert.equal(proposal.equipmentId, fixture.equipment.id);
    const overlapping = Date.parse(proposal.startAt) < Date.parse(refused.endAt) && Date.parse(proposal.endAt) > Date.parse(refused.startAt);
    assert.ok(!overlapping, `${proposal.startAt} → ${proposal.endAt} ne recouvre pas le créneau refusé`);
  }
  // Placé juste après le créneau refusé, à la minute ronde, et le second 24 h plus tard (R7).
  assert.equal(proposed[0].startAt, '2026-09-29T11:35:00.000Z', 'le calcul de 13 h part à 13 h 35, après le créneau refusé');
  assert.equal(proposed[0].justification.timingReason, 'after-refused-slot');
  assert.equal(proposed[0].justification.limitingConstraint, 'créneau refusé évité (D-030)');
  assert.ok(Date.parse(proposed[1].startAt) - Date.parse(proposed[0].startAt) >= 24 * 3_600_000);
  assert.deepEqual(second.calculation.summary.beds.map((bed) => [bed.bedId, bed.needMm, bed.placedMm, bed.deficitMm]), [['bed-1', 20, 20, 0], ['bed-2', 20, 20, 0]]);
});

test('les créneaux protégés de l’exploitation sont relus à chaque calcul et ne valent que pour elle (3.8 ter, règles 7 et 8, cas 15)', async () => {
  const { fixture } = await farmWithWater();
  await farmWithWater(BOB);
  // Mardi 12 h – 14 h 30 chez Alice : le goutte-à-goutte de 12 h 52 attend la fin du créneau.
  const lavage = await createProtectedSlotForUser(ALICE, ALICE, { name: 'Lavage des légumes', weekdays: ['tuesday'], startMinute: minutesOfDay(12), endMinute: minutesOfDay(14, 30) });
  const alice = await computeWeeklyPlanForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: NOW });
  assert.equal(alice.proposals[0].equipmentId, fixture.equipment.id);
  assert.equal(alice.proposals[0].startAt, '2026-09-29T12:30:00.000Z', 'mardi 14 h 30, à la fin du créneau protégé');
  assert.equal(alice.proposals[0].justification.timingReason, 'after-protected-slot');
  assert.equal(alice.proposals[0].justification.limitingConstraint, 'créneau protégé « Lavage des légumes » évité');
  const bob = await computeWeeklyPlanForUser({ ownerUserId: BOB, season: 2026, snapshot, now: NOW });
  assert.equal(bob.proposals[0].startAt, '2026-09-29T10:52:00.000Z', 'chez Bob, aucun créneau protégé : dès maintenant');

  // Supprimé, le créneau ne compte plus au calcul suivant ; rien ne recalcule de lui-même (règle 8).
  await deleteProtectedSlotForUser(ALICE, ALICE, lavage.id);
  const after = await computeWeeklyPlanForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: new Date('2026-09-29T10:53:00.000Z') });
  assert.equal(after.proposals.filter((proposal) => proposal.status === 'proposed')[0].startAt, '2026-09-29T10:53:00.000Z');
});

/** Le recalcul sur événement avec l'instantané du test, sans lecture d'Ouvre ta ferme. */
function computeWithSnapshot({ ownerUserId, season, now, triggerEvent }: { ownerUserId: string; season: number; now: Date; triggerEvent: PlanCalculationEvent }) {
  return computeWeeklyPlanForUser({ ownerUserId, season, snapshot, now, trigger: 'event', triggerEvent });
}

function planEvents() {
  // Les lignes de node:sqlite sont sans prototype : copiées pour la comparaison.
  return (database.sqlite.prepare('SELECT kind, week_start, status, calculation_id FROM irrigation_plan_events ORDER BY rowid').all() as { kind: string; week_start: string; status: string; calculation_id: string | null }[]).map((row) => ({ ...row }));
}

test('un événement de la semaine courante fait recalculer le plan, qui nomme son déclencheur ; l’événement est réglé par le calcul (3.7, règles 4, 6 et 7)', async () => {
  await farmWithWater();
  const lines: Record<string, unknown>[] = [];
  await recalculatePlanAfterEvent(ALICE, { kind: 'rain-recorded', season: 2026, at: '2026-09-29' }, { now: NOW, compute: computeWithSnapshot, log: (_level, entry) => { lines.push(entry); } });
  const stored = await readWeeklyPlanForUser({ ownerUserId: ALICE, season: 2026, now: NOW });
  assert.ok(stored);
  assert.equal(stored.calculation.trigger, 'event');
  assert.equal(stored.calculation.triggerEvent, 'rain-recorded');
  assert.equal(stored.calculation.computedAt, NOW.toISOString());
  assert.equal(stored.proposals.length, 2);
  assert.equal(stored.pendingEvent, null, 'le plan est à jour de l’événement');
  assert.deepEqual(planEvents(), [{ kind: 'rain-recorded', week_start: '2026-09-28', status: 'recalculated', calculation_id: stored.calculation.id }]);
  assert.deepEqual(lines, [], 'rien à signaler');
});

test('un événement d’une autre semaine ne fait rien ; un événement durable compte dès qu’il n’est pas à venir (3.7, règle 5)', async () => {
  await farmWithWater();
  const options = { now: NOW, compute: computeWithSnapshot };
  await recalculatePlanAfterEvent(ALICE, { kind: 'rain-recorded', season: 2026, at: '2026-09-27' }, options);
  await recalculatePlanAfterEvent(ALICE, { kind: 'irrigation-planned', season: 2026, at: '2026-10-05T06:00:00.000Z' }, options);
  await recalculatePlanAfterEvent(ALICE, { kind: 'objective-changed', season: 2026, at: '2026-10-05', lasting: true }, options);
  assert.equal(await readWeeklyPlanForUser({ ownerUserId: ALICE, season: 2026, now: NOW }), null, 'la pluie de dimanche dernier, l’irrigation et l’objectif de la semaine prochaine ne changent pas ce plan');
  assert.deepEqual(planEvents(), []);
  await recalculatePlanAfterEvent(ALICE, { kind: 'daily-limit-changed', season: 2026, at: '2026-09-14', lasting: true }, options);
  assert.equal((await readWeeklyPlanForUser({ ownerUserId: ALICE, season: 2026, now: NOW }))?.calculation.triggerEvent, 'daily-limit-changed', 'une limite posée il y a deux semaines vaut encore : le plan se recalcule');
});

test('l’échec du recalcul ne touche pas à l’événement : journalisé sans nommer personne, et le plan se dit antérieur à l’événement (3.7, règle 6)', async () => {
  await farmWithWater();
  const first = await computeWeeklyPlanForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: NOW });
  const lines: { level: string; entry: Record<string, unknown> }[] = [];
  const later = new Date('2026-09-29T11:10:00.000Z');
  await recalculatePlanAfterEvent(ALICE, { kind: 'proposal-refused', season: 2026, at: later }, {
    now: later,
    compute: async () => { throw new Error('D1_ERROR: trop de connexions'); },
    log: (level, entry) => { lines.push({ level, entry }); },
  });
  const stored = await readWeeklyPlanForUser({ ownerUserId: ALICE, season: 2026, now: later });
  assert.equal(stored?.calculation.id, first.calculation.id, 'le plan d’avant reste en vigueur');
  assert.deepEqual(stored?.pendingEvent, { kind: 'proposal-refused', occurredAt: later.toISOString(), status: 'failed' });
  assert.deepEqual(planEvents().map((row) => row.status), ['failed']);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].level, 'warn');
  assert.equal(lines[0].entry.event, 'planning_event_recalculation_failed');
  assert.equal(lines[0].entry.kind, 'proposal-refused');
  assert.ok(!JSON.stringify(lines[0].entry).includes(ALICE), 'jamais d’identifiant de personne');
});

test('le calcul se fait après la réponse : l’événement est inscrit d’abord, le plan se dit antérieur à lui jusqu’au recalcul (3.7, règle 6)', async () => {
  await farmWithWater();
  await computeWeeklyPlanForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: NOW });
  const deferred: (() => Promise<void>)[] = [];
  const later = new Date('2026-09-29T11:10:00.000Z');
  await recalculatePlanAfterEvent(ALICE, { kind: 'reservoir-level-observed', season: 2026, at: later, lasting: true }, {
    now: later, compute: computeWithSnapshot, runAfterResponse: async (work) => { deferred.push(work); },
  });
  assert.deepEqual((await readWeeklyPlanForUser({ ownerUserId: ALICE, season: 2026, now: later }))?.pendingEvent, { kind: 'reservoir-level-observed', occurredAt: later.toISOString(), status: 'pending' }, 'la réponse partie, l’écran sait qu’un recalcul est en cours');
  assert.equal(deferred.length, 1);
  await deferred[0]();
  const stored = await readWeeklyPlanForUser({ ownerUserId: ALICE, season: 2026, now: later });
  assert.equal(stored?.pendingEvent, null);
  assert.equal(stored?.calculation.triggerEvent, 'reservoir-level-observed');
});

test('idempotence : deux calculs sans événement entre eux gardent les mêmes propositions, aucune remplacée (3.7, règles 9 et 10)', async () => {
  await farmWithWater();
  const first = await computeWeeklyPlanForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: NOW });
  const second = await computeWeeklyPlanForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: NOW });
  assert.notEqual(second.calculation.id, first.calculation.id);
  assert.deepEqual(second.proposals.map((p) => [p.id, p.storedId, p.status, p.calculationId === second.calculation.id]), first.proposals.map((p) => [p.id, p.storedId, 'proposed', true]), 'mêmes identifiants, toujours proposées, du dernier calcul');
  assert.deepEqual(second.proposals.map((p) => [p.startAt, p.endAt, p.doseMm]), first.proposals.map((p) => [p.startAt, p.endAt, p.doseMm]));
  const replaced = database.sqlite.prepare("SELECT COUNT(*) AS n FROM irrigation_plan_proposals WHERE status = 'replaced'").get() as { n: number };
  assert.equal(replaced.n, 0, 'rien n’a changé : rien n’est remplacé');
});

test('sans rien à planifier, le calcul s’enregistre vide et le dit', async () => {
  await createDripFixture(ALICE, { beds: ['bed-1'] });
  const stored = await computeWeeklyPlanForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: NOW });
  assert.equal(stored.proposals.length, 0);
  assert.ok(stored.calculation.summary.beds.every((bed) => bed.reasons.includes('no-objective')), 'sans objectif, aucune planche n’est planifiable, et le motif est donné');
});

test('chaque calcul écrit une ligne de journal avec la durée de ses phases, sans identifiant de personne (point ouvert 34)', async () => {
  await farmWithWater();
  const lines: { level: string; entry: Record<string, unknown> }[] = [];
  await computeWeeklyPlanForUser({
    ownerUserId: ALICE, season: 2026, snapshot, now: NOW, trigger: 'manual', actorUserId: ALICE,
    log: (level, entry) => { lines.push({ level, entry }); },
  });
  const completed = lines.find((line) => line.entry.event === 'planning_calculation_completed');
  assert.ok(completed, 'une ligne planning_calculation_completed');
  assert.equal(completed.level, 'info');
  const { durationsMs, totalMs, completedAt, ...rest } = completed.entry as { durationsMs: Record<string, number>; totalMs: number; completedAt: string };
  assert.deepEqual(Object.keys(durationsMs), ['inputs', 'needs', 'engine', 'save', 'reread'], 'les phases du service, dans l’ordre ; l’instantané est mesuré par l’appelant');
  for (const [phase, ms] of Object.entries(durationsMs)) assert.ok(Number.isInteger(ms) && ms >= 0, `${phase} : ${ms} ms`);
  assert.ok(Number.isInteger(totalMs) && totalMs >= 0, `total : ${totalMs} ms`);
  assert.ok(Number.isFinite(Date.parse(completedAt)), 'une date de fin');
  assert.deepEqual(rest, { event: 'planning_calculation_completed', trigger: 'manual', season: 2026, weekStart: '2026-09-28', snapshotSource: 'cache', beds: 2, proposals: 2 });
  assert.ok(!JSON.stringify(completed.entry).includes(ALICE), 'jamais d’identifiant de personne');
});

test('le calcul du matin prévient le Worker de notification seulement s’il a une suggestion à dire ; sans arrosage validé, rien (3.7, règles 21 et 22)', async () => {
  await farmWithWater();
  let calls = 0;
  const scheduleAlarm = async () => { calls += 1; return { status: 'ok' as const }; };
  const daily = await computeWeeklyPlanForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: NOW, trigger: 'daily', scheduleAlarm });
  assert.equal(daily.calculation.trigger, 'daily');
  assert.equal(daily.suggestions.length, 0, 'aucun arrosage validé : rien à suggérer');
  assert.equal(calls, 0, 'sans suggestion, pas de notification');
  await computeWeeklyPlanForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: NOW, trigger: 'manual', actorUserId: ALICE, scheduleAlarm });
  assert.equal(calls, 0, 'un calcul à la demande ne notifie jamais');
});

/** Ce que le plan dit, sans les identifiants propres à chaque ferme : son matériel est nommé « matériel ». */
function planShape(plan: StoredWeeklyPlan, equipmentId: string) {
  return JSON.parse(JSON.stringify({
    proposals: plan.proposals.map((proposal) => ({
      startAt: proposal.startAt, endAt: proposal.endAt, durationSeconds: proposal.durationSeconds, doseMm: proposal.doseMm,
      volumeCubicMeters: proposal.volumeCubicMeters, pumpId: proposal.pumpId, pump: proposal.justification.pump,
      supply: proposal.justification.supply, hydraulicallyVerified: proposal.justification.hydraulicallyVerified,
    })),
    beds: plan.calculation.summary.beds,
    deficit: plan.calculation.summary.deficit,
    budgets: plan.calculation.summary.budgets,
  }).replaceAll(equipmentId, 'matériel'));
}

test('3.8 : Ressources et pompes décochée, le plan est celui d’une ferme sans pompe ni ressource ; ses pompes restent enregistrées', async () => {
  const { fixture } = await farmWithWater();
  await saveFeatureSelectionForUser(ALICE, FEATURE_IDS.filter((id) => id !== 'ressources'), NOW);
  const bob = await createDripFixture('bob', { beds: ['bed-1', 'bed-2'], rateMmPerHour: 14, bedAreaSquareMeters: 30 });
  await saveHydricGoalForUser('bob', { season: 2026, weekStart: '2026-09-21', scopeType: 'farm', otfZoneId: null, otfPlotId: null, otfBedId: null, amountMm: 20 });
  const alices = await computeWeeklyPlanForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: NOW });
  const bobs = await computeWeeklyPlanForUser({ ownerUserId: 'bob', season: 2026, snapshot, now: NOW });
  assert.deepEqual(planShape(alices, fixture.equipment.id), planShape(bobs, bob.equipment.id));
  assert.equal(alices.proposals.length, 2);
  assert.deepEqual(alices.proposals.map((proposal) => [proposal.pumpId, proposal.justification.hydraulicallyVerified]), [[null, false], [null, false]]);
  assert.equal((await listPumpConfigurationForUser(ALICE)).pumps.length, 1, 'rien n’est effacé (R1)');
});

test('3.8 : le Planning décoché, un événement n’inscrit rien et ne recalcule pas (R1)', async () => {
  await farmWithWater();
  await saveFeatureSelectionForUser(ALICE, ['materiel', 'arrosages', 'besoins'], NOW);
  await recalculatePlanAfterEvent(ALICE, { kind: 'rain-recorded', season: 2026, at: '2026-09-29' }, {
    now: NOW, compute: async () => assert.fail('aucun calcul'), log: () => assert.fail('rien à journaliser'),
  });
  assert.deepEqual(planEvents(), []);
  assert.equal(await readWeeklyPlanForUser({ ownerUserId: ALICE, season: 2026, now: NOW }), null);
});

test('3.8 : un changement des fonctionnalités qui touche le plan le recalcule, nommé dans l’en-tête, sans passer par le registre des événements (R9, P8)', async () => {
  await farmWithWater();
  const after: string[] = [];
  await recalculatePlanAfterFeatureChange(ALICE, 2026, { now: NOW, compute: computeWithSnapshot, afterPlan: async (owner) => { after.push(owner); }, log: () => assert.fail('rien à journaliser') });
  const stored = await readWeeklyPlanForUser({ ownerUserId: ALICE, season: 2026, now: NOW });
  assert.ok(stored);
  assert.deepEqual([stored.calculation.trigger, stored.calculation.triggerEvent], ['event', 'features-changed']);
  assert.equal(calculationTriggerLabel(stored.calculation), 'après un changement des fonctionnalités');
  assert.deepEqual(planEvents(), []);
  assert.deepEqual(after, [ALICE], 'les aspersions sont jugées de nouveau');

  const lines: Record<string, unknown>[] = [];
  await recalculatePlanAfterFeatureChange(ALICE, 2026, { now: NOW, compute: async () => { throw new Error('panne'); }, log: (_level, entry) => { lines.push(entry); } });
  assert.deepEqual(lines.map((line) => [line.event, line.error]), [['planning_features_recalculation_failed', 'panne']], 'l’échec se journalise sans lever');
});
