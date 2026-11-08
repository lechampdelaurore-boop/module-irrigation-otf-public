import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { createIrrigationEventForUser } from '../../db/irrigation-event/create';
import { saveHydricGoalForUser } from '../../db/water-management-repository';
import type { IrrigationSnapshot } from '../../lib/domain/domain';
import { getSeriesWaterDashboardForUser } from '../../lib/services/series-water-service';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { FIXTURE_PLOT_ID, FIXTURE_ZONE_ID, completedDraft, createDripFixture } from '../support/irrigation-fixtures';

const ALICE = 'alice';
const NOW = new Date('2026-09-29T10:00:00.000Z');

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

const snapshot = (cropPlan?: IrrigationSnapshot['cropPlan']): IrrigationSnapshot => ({
  configuration: { seasonFirst: 2025, seasonLast: 2026 },
  structure: { id: '17', name: 'Ferme', legalCity: 'Rennes', legalPostcode: '35000', legalCountry: 'FR' },
  zones: [{ id: FIXTURE_ZONE_ID, name: 'Zone', area: 1000, seasons: [2026] }],
  plots: [{ id: FIXTURE_PLOT_ID, zoneId: FIXTURE_ZONE_ID, name: 'Jardin', mode: 'garden', length: 40, width: 30, area: 1200, seasons: [2026] }],
  beds: [
    { id: 'bed-1', zoneId: FIXTURE_ZONE_ID, plotId: FIXTURE_PLOT_ID, name: 'P1', length: 40, width: 0.75, alleyWidth: 0.45, area: 30, seasons: [2026] },
    { id: 'bed-2', zoneId: FIXTURE_ZONE_ID, plotId: FIXTURE_PLOT_ID, name: 'P2', length: 40, width: 0.75, alleyWidth: 0.45, area: 30, seasons: [2026] },
  ],
  cropPlan,
  source: 'cache',
  lastSuccessfulReadAt: '2026-09-29T00:00:00.000Z',
});

const cropPlan: NonNullable<IrrigationSnapshot['cropPlan']> = {
  series: [
    { id: 'aillet', name: 'Aillet', season: 2026, use: 'bed', cycle: 'annual', cultivations: [{ id: 'c1', plantId: 'p', plantName: 'Ail', harvestWeeks: ['2026-W20'], harvestWeeksExpected: [] }] },
    { id: 'radis', name: 'Radis', season: 2026, use: 'bed', cycle: 'annual', cultivations: [] },
  ],
  places: [{ id: 'pl-1', seriesId: 'aillet', bedId: 'bed-1', lengthMeters: 40 }, { id: 'pl-2', seriesId: 'radis', bedId: 'bed-2', lengthMeters: 40 }],
  implantationTasks: [{ id: 't1', seriesId: 'aillet', cultivationId: 'c1', kind: 'direct-sowing', plannedWeek: '2025-W45', doneWeek: '2025-W45', status: 'done' }],
  readSummary: { seriesRead: 3, placesRead: 3, tasksRead: 10, tasksRetained: 1, placesWithoutSeries: 1, placesOfUnknownSeries: 0, placesWithUnknownBed: 0 },
};

test('sans plan de culture lu, le tableau des séries se dit indisponible plutôt que vide', async () => {
  const dashboard = await getSeriesWaterDashboardForUser({ ownerUserId: ALICE, season: 2026, snapshot: snapshot(undefined), now: NOW });
  assert.deepEqual(dashboard, { available: false, season: 2026, reason: 'crop-plan-not-read' });
});

test('une série implantée l’année précédente cumule ses irrigations des deux saisons et l’objectif des deux saisons, sur sa seule période', async () => {
  const autumn = await createDripFixture(ALICE, { season: 2025, beds: ['bed-1'], name: 'Goutte 2025' });
  const spring = await createDripFixture(ALICE, { season: 2026, beds: ['bed-1'], name: 'Goutte 2026' });
  // Avant l'implantation (la semaine 45 commence le lundi 3 novembre) : hors période.
  await createIrrigationEventForUser(ALICE, completedDraft(autumn, { startAt: '2025-10-20T06:00:00.000Z', endAt: '2025-10-20T07:00:00.000Z', durationSeconds: 3600 }));
  await createIrrigationEventForUser(ALICE, completedDraft(autumn, { startAt: '2025-11-10T06:00:00.000Z', endAt: '2025-11-10T07:00:00.000Z', durationSeconds: 3600 }));
  await createIrrigationEventForUser(ALICE, completedDraft(spring, { startAt: '2026-04-10T06:00:00.000Z', endAt: '2026-04-10T07:00:00.000Z', durationSeconds: 3600 }));
  // Après la dernière récolte (la semaine 20 finit le dimanche 17 mai) : hors période.
  await createIrrigationEventForUser(ALICE, completedDraft(spring, { startAt: '2026-06-10T06:00:00.000Z', endAt: '2026-06-10T07:00:00.000Z', durationSeconds: 3600 }));
  // 7 mm/semaine sous la saison 2025 depuis novembre, 14 mm/semaine sous la saison 2026 depuis le 6 avril.
  await saveHydricGoalForUser(ALICE, { season: 2025, weekStart: '2025-11-03', scopeType: 'farm', otfZoneId: null, otfPlotId: null, otfBedId: null, amountMm: 7 });
  await saveHydricGoalForUser(ALICE, { season: 2026, weekStart: '2026-04-06', scopeType: 'farm', otfZoneId: null, otfPlotId: null, otfBedId: null, amountMm: 14 });

  const dashboard = await getSeriesWaterDashboardForUser({ ownerUserId: ALICE, season: 2026, snapshot: snapshot(cropPlan), now: NOW });
  assert.ok(dashboard.available);
  assert.equal(dashboard.today, '2026-09-29');
  const [aillet] = dashboard.report.series;
  assert.equal(aillet.name, 'Aillet');
  assert.deepEqual(aillet.observedPeriod, { startDate: '2025-11-03', endDate: '2026-05-17' });
  assert.equal(aillet.irrigationMm, 20, 'une heure à 10 mm/h en novembre 2025 et une en avril 2026 ; rien avant ni après');
  assert.equal(aillet.irrigationCubicMeters, 0.6, '20 mm × 30 m²');
  // Enregistrés aujourd'hui pour des semaines passées, les objectifs comptent dès le lundi suivant leur semaine
  // (D-039) : 7 jours sans objectif, puis 154 jours à 1 mm/jour (10 novembre → 12 avril) et 35 jours à 2 mm/jour
  // (13 avril → 17 mai) = 224 mm, sur 189 journées couvertes des 196 de la période.
  assert.equal(aillet.objectiveMm, 224);
  assert.deepEqual(aillet.objectiveAvailability, { availableBedDays: 189, totalBedDays: 196, complete: false });
  assert.equal(aillet.rainMm, null, 'aucune météo enregistrée : la pluie reste absente');
  assert.equal(aillet.gapToObjectiveMm, null);
  assert.deepEqual(dashboard.report.ignored, { block: 0, noImplantation: 1 });
  assert.equal(dashboard.warnings.length, 3, 'série non suivie, emplacement écarté, pluie manquante');
  assert.match(dashboard.warnings[0], /1 série d’Ouvre ta ferme non suivie : 1 sans semis direct ni plantation/);
});
