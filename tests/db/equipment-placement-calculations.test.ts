import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { removeEquipmentPlacementForUser, saveEquipmentPlacementForUser } from '../../db/equipment-placement-repository';
import { listIrrigationEventsForUser } from '../../db/irrigation-event/read';
import { saveEquipmentDefaultPumpForUser, savePumpForUser } from '../../db/pump-repository';
import { saveDailyWaterLimitForUser, saveHydricGoalForUser } from '../../db/water-management-repository';
import { saveResourceReservoirLinkForUser, saveWaterReservoirForUser, saveWaterResourceForUser } from '../../db/water-resource-repository';
import type { IrrigationSnapshot } from '../../lib/domain/domain';
import { IrrigationDailyLimitExceededError, enforceDailyLimitForCreation } from '../../lib/services/irrigation-limits';
import { getIrrigationNeedsDashboardForUser } from '../../lib/services/irrigation-needs-service';
import { computeWeeklyPlanForUser } from '../../lib/services/planning-service';
import { validatePlanProposalForUser } from '../../lib/services/planning-validation-service';
import { validatePumpAssignmentForUser } from '../../lib/services/pump-service';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { FIXTURE_PLOT_ID, FIXTURE_ZONE_ID, createDripFixture, type IrrigationFixture } from '../support/irrigation-fixtures';

/**
 * Pose datée et stockage du matériel, ce que voient les calculs (sous-tranche
 * 2.11, PR 3a ; docs/equipment-placement-periods-contract.md, règles 10 et
 * 14, décision D-044). Fin septembre 2026, la ferme est à UTC+2 : 06:00Z se
 * lit 8 h 00.
 */

const ALICE = 'alice';
const SEASON = 2026;

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

// Deux goutte-à-goutte, chacun sur sa planche, à 14 mm/h sur 30 m² : 0,42 m³/h chacun.

const NOW = new Date('2026-09-29T10:52:00.000Z'); // mardi 12 h 52 à la ferme
const AFTER_CALCULATION = '2026-09-29T11:00:00.000Z';

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

async function farmWithTwoDrips(pumpMaximumCubicMetersPerHour = 8) {
  const first = await createDripFixture(ALICE, { name: 'Goutte-à-goutte P1', beds: ['bed-1'], rateMmPerHour: 14, bedAreaSquareMeters: 30 });
  const second = await createDripFixture(ALICE, { name: 'Goutte-à-goutte P2', beds: ['bed-2'], rateMmPerHour: 14, bedAreaSquareMeters: 30 });
  const resourceId = await saveWaterResourceForUser(ALICE, ALICE, null, { name: 'Forage', type: 'borehole', nominalFlowCubicMetersPerHour: 0.511, status: 'active', availableFrom: null, availableUntil: null, notes: null });
  const reservoirId = await saveWaterReservoirForUser(ALICE, ALICE, null, {
    name: 'Réserve tampon', type: 'tank', capacityCubicMeters: 60, currentVolumeCubicMeters: 30, minimumSafetyCubicMeters: 0,
    exposedSurfaceSquareMeters: 0, receivesRain: false, evaporationEnabled: false, evaporationCoefficient: 0, status: 'active', notes: null,
  }, '2026-09-29T10:00:00.000Z');
  await saveResourceReservoirLinkForUser(ALICE, ALICE, { resourceId, reservoirId, fillMode: 'automatic', active: true });
  const pumpId = await savePumpForUser(ALICE, ALICE, null, { name: 'La pompe', maximumFlowCubicMetersPerHour: pumpMaximumCubicMetersPerHour, status: 'active', notes: null, origins: [{ sourceKind: 'reservoir', resourceId: null, reservoirId, isDefault: true }] });
  await saveEquipmentDefaultPumpForUser(ALICE, ALICE, first.equipment.id, pumpId);
  await saveEquipmentDefaultPumpForUser(ALICE, ALICE, second.equipment.id, pumpId);
  await saveHydricGoalForUser(ALICE, { season: 2026, weekStart: '2026-09-21', scopeType: 'farm', otfZoneId: null, otfPlotId: null, otfBedId: null, amountMm: 20 });
  return { first, second, pumpId };
}

test('scénario 8 : la validation du jour valide les autres propositions et refuse, en l’expliquant, celles du matériel retiré depuis le calcul', async () => {
  const { first, second } = await farmWithTwoDrips();
  const plan = await computeWeeklyPlanForUser({ ownerUserId: ALICE, season: SEASON, snapshot, now: NOW, actorUserId: ALICE });
  assert.deepEqual([...new Set(plan.proposals.map((proposal) => proposal.equipmentId))].sort(), [first.equipment.id, second.equipment.id].sort());

  await removeEquipmentPlacementForUser(ALICE, second.equipment.id, SEASON, AFTER_CALCULATION);

  const results = [];
  for (const proposal of plan.proposals) {
    results.push({ proposal, result: await validatePlanProposalForUser({ ownerUserId: ALICE, season: SEASON, snapshot, proposalId: proposal.storedId, actorUserId: ALICE, now: NOW }) });
  }
  for (const { proposal, result } of results) {
    if (proposal.equipmentId === first.equipment.id) {
      assert.ok(result.ok, result.ok ? '' : result.message);
      continue;
    }
    assert.deepEqual(result, {
      ok: false,
      proposalId: proposal.storedId,
      message: 'Validation impossible : le matériel « Goutte-à-goutte P2 » a été retiré et stocké le 29 septembre à 13 h 00, '
        + 'après le calcul de ce plan (29 septembre, 12 h 52). Recalculez le plan pour obtenir des propositions à jour.',
    });
  }
  const events = await listIrrigationEventsForUser(ALICE, SEASON, true);
  assert.ok(events.length > 0 && events.every((event) => event.equipment.equipmentId === first.equipment.id), 'seul le matériel posé est planifié');
});

test('scénario 6 : après le retrait, la planche revient à sa surface seule et le planning la dit « aucun matériel ne l’arrose »', async () => {
  const { first, second } = await farmWithTwoDrips();
  await removeEquipmentPlacementForUser(ALICE, second.equipment.id, SEASON, AFTER_CALCULATION);
  const later = new Date('2026-09-29T11:05:00.000Z');

  const plan = await computeWeeklyPlanForUser({ ownerUserId: ALICE, season: SEASON, snapshot, now: later, actorUserId: ALICE });
  assert.ok(plan.proposals.length > 0);
  assert.ok(plan.proposals.every((proposal) => proposal.equipmentId === first.equipment.id), 'le calcul suivant ne propose plus le matériel stocké');
  const bedTwo = plan.calculation.summary.beds.find((bed) => bed.bedId === 'bed-2');
  assert.deepEqual(bedTwo?.reasons, ['no-equipment']);
  assert.equal(bedTwo?.placedMm, 0);

  const needs = await getIrrigationNeedsDashboardForUser({ ownerUserId: ALICE, season: SEASON, snapshot, now: later });
  const beds = needs.gardens.flatMap((garden) => garden.beds);
  assert.equal(beds.find((bed) => bed.bedId === 'bed-2')?.wettedAreaSource, 'bed-only', 'plus aucun matériel posé : la planche seule');
  assert.notEqual(beds.find((bed) => bed.bedId === 'bed-1')?.wettedAreaSource, 'bed-only');
});

// D-044 : une irrigation planifiée que la règle 13 empêche de démarrer ne compte plus dans les calculs.

/** La première proposition du matériel, validée : une irrigation planifiée ordinaire, avec sa pompe. */
async function plannedFromPlan(fixture: IrrigationFixture) {
  const plan = await computeWeeklyPlanForUser({ ownerUserId: ALICE, season: SEASON, snapshot, now: NOW, actorUserId: ALICE });
  const proposal = plan.proposals.find((candidate) => candidate.equipmentId === fixture.equipment.id);
  assert.ok(proposal);
  const result = await validatePlanProposalForUser({ ownerUserId: ALICE, season: SEASON, snapshot, proposalId: proposal.storedId, actorUserId: ALICE, now: NOW });
  assert.ok(result.ok, result.ok ? '' : result.message);
  const event = (await listIrrigationEventsForUser(ALICE, SEASON, true)).find((candidate) => candidate.id === result.eventId);
  assert.ok(event);
  return event;
}

const plannedMmOn = async (bedId: string, now: Date) => {
  const needs = await getIrrigationNeedsDashboardForUser({ ownerUserId: ALICE, season: SEASON, snapshot, now });
  return needs.gardens.flatMap((garden) => garden.beds).find((bed) => bed.bedId === bedId)?.plannedIrrigationMm;
};

test('D-044 : rangé, le matériel ne sert plus la planche dans les besoins ni dans le planning ; reposé au même endroit, son irrigation recompte', async () => {
  const { second } = await farmWithTwoDrips();
  const planned = await plannedFromPlan(second);
  assert.ok(Math.abs((await plannedMmOn('bed-2', NOW) ?? 0) - 10) < 0.01, 'posé : 10 mm planifiés sur la planche 2');

  await removeEquipmentPlacementForUser(ALICE, second.equipment.id, SEASON, AFTER_CALCULATION);
  assert.equal(await plannedMmOn('bed-2', NOW), 0, 'rangé : l’irrigation planifiée ne compte plus');
  // Un calcul plus tard que le premier : à la même minute, le dernier calcul de la semaine serait ambigu.
  const plan = await computeWeeklyPlanForUser({ ownerUserId: ALICE, season: SEASON, snapshot, now: new Date('2026-09-29T11:05:00.000Z'), actorUserId: ALICE });
  const bedTwo = plan.calculation.summary.beds.find((bed) => bed.bedId === 'bed-2');
  assert.ok(Math.abs((bedTwo?.needMm ?? 0) - 20) < 0.01, 'le besoin de la planche 2 reste entier');
  assert.deepEqual(bedTwo?.reasons, ['no-equipment']);
  const [stillListed] = (await listIrrigationEventsForUser(ALICE, SEASON, true)).filter((event) => event.id === planned.id);
  assert.equal(stillListed?.status, 'planned', 'elle reste dans la liste des irrigations, jamais supprimée');

  await saveEquipmentPlacementForUser(ALICE, { ...second.placement, id: undefined } as never, '2026-09-29T11:10:00.000Z');
  assert.ok(Math.abs((await plannedMmOn('bed-2', NOW) ?? 0) - 10) < 0.01, 'reposé au même endroit : elle recompte');
});

test('D-044 : la limite journalière et la pompe ne comptent plus une irrigation planifiée qui ne peut pas démarrer', async () => {
  const { first, second, pumpId } = await farmWithTwoDrips(0.5);
  const planned = await plannedFromPlan(second);
  const slot = { startAt: planned.equipment.plannedStartAt!, endAt: planned.equipment.plannedEndAt!, durationSeconds: planned.equipment.plannedDurationSeconds };
  const timing = { plannedStartAt: slot.startAt, plannedEndAt: slot.endAt, actualStartAt: null, actualEndAt: null, plannedDurationSeconds: slot.durationSeconds, actualDurationSeconds: 0 };
  const pumpCheck = () => validatePumpAssignmentForUser({ ownerUserId: ALICE, pumpId, pumpOriginId: null, applications: first.applications, startsAt: slot.startAt, endsAt: slot.endAt });
  await saveDailyWaterLimitForUser(ALICE, { season: SEASON, enabled: true, maxCubicMetersPerDay: 0.5, validFrom: '2026-09-01', validUntil: null, note: 'arrêté' });

  // Posé : 0,42 + 0,42 m³/h dépassent les 0,5 m³/h de la pompe, et 0,3 + 0,3 m³ les 0,5 m³ du jour.
  assert.equal((await pumpCheck()).feasibility.possible, false);
  await assert.rejects(enforceDailyLimitForCreation(ALICE, 'planned', timing, first.applications), IrrigationDailyLimitExceededError);

  await removeEquipmentPlacementForUser(ALICE, second.equipment.id, SEASON, AFTER_CALCULATION);
  assert.equal((await pumpCheck()).feasibility.possible, true, 'rangé : la pompe est libre');
  await enforceDailyLimitForCreation(ALICE, 'planned', timing, first.applications);
});
