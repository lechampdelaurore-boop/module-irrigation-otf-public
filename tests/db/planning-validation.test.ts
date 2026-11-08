import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { updateEquipmentPlacementSettingForUser } from '../../db/equipment-placement-repository';
import { saveEquipmentSettingForUser } from '../../db/equipment/settings';
import { listIrrigationEventsForUser } from '../../db/irrigation-event/read';
import { readLatestPlanForUser } from '../../db/planning-repository';
import { saveEquipmentDefaultPumpForUser, savePumpForUser } from '../../db/pump-repository';
import { saveDailyWaterLimitForUser, saveHydricGoalForUser } from '../../db/water-management-repository';
import { saveResourceReservoirLinkForUser, saveWaterReservoirForUser, saveWaterResourceForUser } from '../../db/water-resource-repository';
import { listWorkspaceOwnerIds } from '../../db/workspace-repository';
import type { IrrigationSnapshot } from '../../lib/domain/domain';
import { computeWeeklyPlanForUser } from '../../lib/services/planning-service';
import { refusePlanProposalForUser, validatePlanProposalForUser } from '../../lib/services/planning-validation-service';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { FIXTURE_PLOT_ID, FIXTURE_ZONE_ID, createDripFixture } from '../support/irrigation-fixtures';

const ALICE = 'alice';
const BOB = 'bob';
const NOW = new Date('2026-09-29T10:52:00.000Z');

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

async function farmWithPlan(owner = ALICE) {
  const fixture = await createDripFixture(owner, { beds: ['bed-1', 'bed-2'], rateMmPerHour: 14, bedAreaSquareMeters: 30 });
  const resourceId = await saveWaterResourceForUser(owner, owner, null, { name: 'Forage', type: 'borehole', nominalFlowCubicMetersPerHour: 0.511, status: 'active', availableFrom: null, availableUntil: null, notes: null });
  const reservoirId = await saveWaterReservoirForUser(owner, owner, null, {
    name: 'Réserve tampon', type: 'tank', capacityCubicMeters: 60, currentVolumeCubicMeters: 30, minimumSafetyCubicMeters: 0,
    exposedSurfaceSquareMeters: 0, receivesRain: false, evaporationEnabled: false, evaporationCoefficient: 0, status: 'active', notes: null,
  }, '2026-09-29T10:00:00.000Z');
  await saveResourceReservoirLinkForUser(owner, owner, { resourceId, reservoirId, fillMode: 'automatic', active: true });
  const pumpId = await savePumpForUser(owner, owner, null, { name: 'La pompe', maximumFlowCubicMetersPerHour: 8, status: 'active', notes: null, origins: [{ sourceKind: 'reservoir', resourceId: null, reservoirId, isDefault: true }] });
  await saveEquipmentDefaultPumpForUser(owner, owner, fixture.equipment.id, pumpId);
  await saveHydricGoalForUser(owner, { season: 2026, weekStart: '2026-09-21', scopeType: 'farm', otfZoneId: null, otfPlotId: null, otfBedId: null, amountMm: 20 });
  const plan = await computeWeeklyPlanForUser({ ownerUserId: owner, season: 2026, snapshot, now: NOW, actorUserId: owner });
  return { fixture, plan, pumpId };
}

test('valider une proposition crée une irrigation planifiée ordinaire, avec sa pompe, et la relie ; on ne valide pas deux fois', async () => {
  const { fixture, plan, pumpId } = await farmWithPlan();
  const [first, second] = plan.proposals;
  const result = await validatePlanProposalForUser({ ownerUserId: ALICE, season: 2026, snapshot, proposalId: first.storedId, actorUserId: ALICE, now: NOW });
  assert.ok(result.ok, result.ok ? '' : result.message);
  assert.equal(result.warning, undefined);

  const events = await listIrrigationEventsForUser(ALICE, 2026, true);
  assert.equal(events.length, 1);
  const event = events[0];
  assert.equal(event.id, result.eventId);
  assert.equal(event.status, 'planned');
  assert.equal(event.equipment.equipmentId, fixture.equipment.id);
  assert.equal(event.equipment.plannedStartAt, first.startAt);
  assert.equal(event.equipment.plannedEndAt, first.endAt);
  assert.equal(event.equipment.plannedDurationSeconds, first.durationSeconds);
  assert.equal(event.equipment.pumpId, pumpId, 'la pompe habituelle, vérifiée par la 3.2');
  assert.ok(Math.abs((event.equipment.requestedFlowCubicMetersPerHour ?? 0) - 0.84) < 0.001, '14 mm/h sur 60 m²');
  assert.deepEqual(event.equipment.applications.map((application) => [application.otfBedId, application.wettedAreaSquareMeters]).sort(), [['bed-1', 30], ['bed-2', 30]]);
  assert.match(event.note ?? '', /Planning du .* · proposition p-1/);

  const stored = await readLatestPlanForUser(ALICE, 2026, '2026-09-28');
  const validated = stored?.proposals.find((proposal) => proposal.storedId === first.storedId);
  assert.equal(validated?.status, 'validated');
  assert.equal(validated?.validatedEventId, event.id);
  assert.equal(validated?.actorUserId, ALICE);

  const again = await validatePlanProposalForUser({ ownerUserId: ALICE, season: 2026, snapshot, proposalId: first.storedId, actorUserId: ALICE, now: NOW });
  assert.deepEqual(again, { ok: false, proposalId: first.storedId, message: 'Cette proposition a déjà été validée.' });
  assert.equal((await listIrrigationEventsForUser(ALICE, 2026)).length, 1, 'aucune seconde irrigation');

  // Refuser la seconde : elle reste lisible, refusée, sans irrigation.
  assert.equal(await refusePlanProposalForUser({ ownerUserId: ALICE, proposalId: second.storedId, actorUserId: ALICE }), true);
  assert.equal(await refusePlanProposalForUser({ ownerUserId: ALICE, proposalId: second.storedId, actorUserId: ALICE }), false);
  assert.equal((await readLatestPlanForUser(ALICE, 2026, '2026-09-28'))?.proposals.find((proposal) => proposal.storedId === second.storedId)?.status, 'refused');
  assert.equal((await listIrrigationEventsForUser(ALICE, 2026)).length, 1);
});

test('une proposition expirée, remplacée, d’un autre propriétaire ou sur une position changée est refusée sans rien créer', async () => {
  const { fixture, plan } = await farmWithPlan();
  const [first] = plan.proposals;

  const expired = await validatePlanProposalForUser({ ownerUserId: ALICE, season: 2026, snapshot, proposalId: first.storedId, actorUserId: ALICE, now: new Date('2026-09-30T06:00:00.000Z') });
  assert.equal(expired.ok, false);
  assert.match(expired.ok ? '' : expired.message, /passé/);

  await farmWithPlan(BOB);
  const other = await validatePlanProposalForUser({ ownerUserId: BOB, season: 2026, snapshot, proposalId: first.storedId, actorUserId: BOB, now: NOW });
  assert.equal(other.ok, false, 'la proposition d’Alice n’existe pas pour Bob');

  // Le réglage appliqué au matériel change après le calcul : la proposition est périmée.
  const otherSetting = await saveEquipmentSettingForUser(ALICE, fixture.equipment.id, null, { name: 'Réglage 2', kind: 'drip', rateMmPerHour: 7 });
  assert.ok(otherSetting);
  await updateEquipmentPlacementSettingForUser(ALICE, fixture.equipment.id, 2026, otherSetting);
  const stale = await validatePlanProposalForUser({ ownerUserId: ALICE, season: 2026, snapshot, proposalId: first.storedId, actorUserId: ALICE, now: NOW });
  assert.equal(stale.ok, false);
  assert.match(stale.ok ? '' : stale.message, /a changé depuis le calcul/);
  assert.equal((await listIrrigationEventsForUser(ALICE, 2026)).length, 0, 'rien n’a été créé');

  // Un nouveau calcul remplace l'ancienne proposition : elle ne se valide plus.
  await computeWeeklyPlanForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: new Date('2026-09-29T11:00:00.000Z') });
  const replaced = await validatePlanProposalForUser({ ownerUserId: ALICE, season: 2026, snapshot, proposalId: first.storedId, actorUserId: ALICE, now: new Date('2026-09-29T11:00:00.000Z') });
  assert.equal(replaced.ok, false);
  assert.match(replaced.ok ? '' : replaced.message, /remplacée|n’existe plus/);
});

test('la limite journalière et la pompe gardent la validation comme elles gardent « Planifier »', async () => {
  const { plan } = await farmWithPlan();
  const [first] = plan.proposals;
  await saveDailyWaterLimitForUser(ALICE, { season: 2026, enabled: true, maxCubicMetersPerDay: 0.1, validFrom: '2026-09-01', validUntil: null, note: 'arrêté' });
  const blocked = await validatePlanProposalForUser({ ownerUserId: ALICE, season: 2026, snapshot, proposalId: first.storedId, actorUserId: ALICE, now: NOW });
  assert.equal(blocked.ok, false);
  assert.match(blocked.ok ? '' : blocked.message, /Limite journalière dépassée/);
  assert.equal((await listIrrigationEventsForUser(ALICE, 2026)).length, 0);
  const stored = await readLatestPlanForUser(ALICE, 2026, '2026-09-28');
  assert.equal(stored?.proposals.find((proposal) => proposal.storedId === first.storedId)?.status, 'proposed', 'refusée par la limite, elle reste proposée');
});

test('le recalcul quotidien connaît chaque exploitation', async () => {
  await farmWithPlan(ALICE);
  await farmWithPlan(BOB);
  assert.deepEqual(await listWorkspaceOwnerIds(), [ALICE, BOB]);
});

test('un ajustement déplace le début et fait suivre la durée à la dose, par les mêmes gardes ; hors de la semaine ou dans le passé, il est refusé', async () => {
  const { fixture, plan } = await farmWithPlan();
  const [first] = plan.proposals;
  assert.ok(Math.abs(first.doseMm - 10) < 0.01, 'la dose appliquée suit la durée entière en secondes');
  assert.equal(first.durationSeconds, 2571, '10 mm à 14 mm/h');

  const past = await validatePlanProposalForUser({ ownerUserId: ALICE, season: 2026, snapshot, proposalId: first.storedId, actorUserId: ALICE, now: NOW, adjustment: { startAt: '2026-09-29T08:00:00.000Z', doseMm: 6 } });
  assert.deepEqual(past, { ok: false, proposalId: first.storedId, message: 'Le créneau ajusté est déjà terminé : choisissez un début plus tard.' });
  const nextWeek = await validatePlanProposalForUser({ ownerUserId: ALICE, season: 2026, snapshot, proposalId: first.storedId, actorUserId: ALICE, now: NOW, adjustment: { startAt: '2026-10-04T21:50:00.000Z', doseMm: 6 } });
  assert.equal(nextWeek.ok, false);
  assert.match(nextWeek.ok ? '' : nextWeek.message, /dimanche minuit/);
  const unreadable = await validatePlanProposalForUser({ ownerUserId: ALICE, season: 2026, snapshot, proposalId: first.storedId, actorUserId: ALICE, now: NOW, adjustment: { startAt: '2026-09-29T16:00:00.000Z', doseMm: 0 } });
  assert.equal(unreadable.ok, false);
  assert.equal((await listIrrigationEventsForUser(ALICE, 2026)).length, 0, 'rien n’a été créé');

  const result = await validatePlanProposalForUser({ ownerUserId: ALICE, season: 2026, snapshot, proposalId: first.storedId, actorUserId: ALICE, now: NOW, adjustment: { startAt: '2026-09-29T16:00:00.000Z', doseMm: 6 } });
  assert.ok(result.ok, result.ok ? '' : result.message);
  const [event] = await listIrrigationEventsForUser(ALICE, 2026, true);
  assert.equal(event.equipment.equipmentId, fixture.equipment.id);
  assert.equal(event.equipment.plannedStartAt, '2026-09-29T16:00:00.000Z');
  assert.equal(event.equipment.plannedDurationSeconds, 1543, '6 mm : la durée suit la dose au prorata, à la seconde');
  assert.equal(event.equipment.plannedEndAt, '2026-09-29T16:25:43.000Z');
  assert.ok(event.equipment.applications.every((application) => Math.abs(application.plannedAmountMm - 6) < 0.01), 'chaque planche reçoit 6 mm au taux du réglage');
  assert.match(event.note ?? '', /proposition p-1 ajustée \(6 mm, début le 29\/09\/2026 18:00\)/);
  const stored = await readLatestPlanForUser(ALICE, 2026, '2026-09-28');
  assert.equal(stored?.proposals.find((proposal) => proposal.storedId === first.storedId)?.validatedEventId, event.id);
});
