import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { listAdoptionsForBedForUser, saveAdoptedGoalForUser } from '../../db/crop-water/adoptions';
import { addStageDeclarationForUser, saveSpeciesCorrespondenceForUser } from '../../db/crop-water/entries';
import { listHydricGoalRevisionsThroughWeekForUser, saveHydricGoalForUser, upsertWeatherDailyValuesForUser, type WeatherDailyRecord } from '../../db/water-management-repository';
import type { IrrigationSnapshot } from '../../lib/domain/domain';
import { adoptionRevision } from '../../lib/domain/crop-water/proposal';
import { objectiveForBed } from '../../lib/domain/irrigation-needs';
import { weekDateKeys } from '../../lib/domain/water-management';
import { weatherLocationKey } from '../../lib/domain/weather/location';
import { getBedCropWaterSheetForUser } from '../../lib/services/crop-water-bed';
import { et0Readings } from '../../lib/services/crop-water-week';
import { createIrrigationEventForUser } from '../../db/irrigation-event/create';
import { EARLY_SPRINKLER_WARNING } from '../../lib/domain/crop-water/proposal';
import { cultivation, series, task } from '../support/crop-water-references';
import { completedDraft, createDripFixture } from '../support/irrigation-fixtures';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';

/**
 * La fiche de la planche lue depuis la base (5 quater, PR 3b) : le stade, le
 * Kc et l'ETM du jour, l'objectif proposé face à l'objectif applicable lu par
 * la règle du besoin, et l'adoption, une révision ordinaire de l'objectif de
 * la planche qui garde son origine (D-039, migration 0024).
 */

const ALICE = 'alice';
const BOB = 'bob';
const BED = 'planche-a';
const SHELTER = 'jardin-serre';
const WEEK = '2026-05-11';
const WEEK_END = '2026-05-17';
const MONDAY_MORNING = new Date('2026-05-11T05:00:00.000Z');

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

const tomatoSeries = series('tomate', [cultivation('tomate-c', 'plant-tomate', 'Tomate', { expected: ['2026-W27', '2026-W40'] })]);
const bed = { id: BED, zoneId: 'parcelle', plotId: SHELTER, name: 'A', length: 10, width: 0.8, alleyWidth: 0.4, area: 8, seasons: [2026] };

const snapshot: IrrigationSnapshot = {
  configuration: { seasonFirst: 2025, seasonLast: 2027 },
  structure: { id: '17', name: 'Ferme', legalCity: 'Rennes', legalPostcode: '35000', legalCountry: 'FR' },
  zones: [{ id: 'parcelle', name: 'Parcelle', area: null, seasons: [2026] }],
  plots: [{ id: SHELTER, zoneId: 'parcelle', name: 'Serre', mode: 'greenhouse', length: 10, width: 8, area: 80, seasons: [2026] }],
  beds: [bed],
  cropPlan: {
    series: [tomatoSeries],
    places: [{ id: 'place-tomate', seriesId: 'tomate', bedId: BED, lengthMeters: null }],
    implantationTasks: [task('tomate', 'planting', '2026-W17')],
    readSummary: { seriesRead: 1, placesRead: 1, tasksRead: 1, tasksRetained: 1, placesWithoutSeries: 0, placesOfUnknownSeries: 0, placesWithUnknownBed: 0 },
  },
  source: 'cache',
  lastSuccessfulReadAt: '2026-05-11T00:00:00.000Z',
};

async function prepareFarm(owner: string) {
  await saveSpeciesCorrespondenceForUser(owner, { plantId: 'plant-tomate', seriesId: null, target: { kind: 'reference', referenceCropId: 'criiam-tomate', analogy: false } });
  const location = weatherLocationKey({ locationMode: 'otf', customCity: null, customPostcode: null }, snapshot.structure);
  assert.ok(location);
  await upsertWeatherDailyValuesForUser(owner, location, 'forecast', weekDateKeys(WEEK).map((date) => ({ date, precipitationMm: 0, et0Mm: 7.3 })), 'test', '2026-05-11T04:00:00.000Z');
  await saveHydricGoalForUser(owner, { season: 2026, weekStart: WEEK, scopeType: 'bed', otfZoneId: 'parcelle', otfPlotId: SHELTER, otfBedId: BED, amountMm: 20 });
  // L'objectif saisi a été posé avant la semaine : il en couvre chaque jour (D-034).
  database.sqlite.exec(`UPDATE irrigation_hydric_goal_revisions SET created_at = '2026-05-04T08:00:00.000Z' WHERE origin IS NULL`);
}

const sheetFor = (owner: string, now = MONDAY_MORNING) => getBedCropWaterSheetForUser({ ownerUserId: owner, season: 2026, snapshot, bedId: BED, weekStart: WEEK, now });

test('scénarios 1 et 8 dans la fiche : tomate sous abri, stade 2 calculé, Kc 0,6, 3,50 mm aujourd\'hui, 24,5 mm proposés face à 20 mm', async () => {
  await prepareFarm(ALICE);
  const sheet = await sheetFor(ALICE);
  assert.equal(sheet.available, true);
  if (!sheet.available) return;
  assert.equal(sheet.today, WEEK);
  assert.equal(sheet.weekEnd, WEEK_END);
  assert.equal(sheet.weekOpen, true);
  const [crop] = sheet.bed.today.crops;
  assert.equal(crop.status, 'computed');
  if (crop.status !== 'computed') return;
  assert.equal(crop.trace.stage.rank, 2);
  assert.equal(crop.trace.stage.origin, 'calculated');
  assert.equal(crop.trace.kc.kc, 0.6);
  assert.equal(crop.trace.shelterFactor, 0.8, 'le jardin sous abri donne K_abri');
  assert.equal(crop.etmMm.toFixed(2), '3.50');
  assert.equal(sheet.bed.week.status, 'complete');
  assert.equal(sheet.bed.week.proposedMm?.toFixed(1), '24.5');
  assert.equal(sheet.bed.week.objectiveMm, 20, 'l\'objectif applicable est celui que le besoin lit');
  assert.equal(sheet.bed.week.differenceMm?.toFixed(1), '4.5');
  assert.equal(sheet.bed.week.adoptable, true);
  assert.deepEqual(sheet.bed.stageChoices.map((choice) => [choice.seriesId, choice.referenceCropId, choice.stages.length]), [['tomate', 'criiam-tomate', 4]]);
  assert.deepEqual(sheet.adoptions, []);
});

test('une adoption est une révision de l\'objectif de la planche, avec son origine : le besoin la lit, l\'autre ferme ne la voit pas', async () => {
  await prepareFarm(ALICE);
  await prepareFarm(BOB);
  const sheet = await sheetFor(ALICE);
  assert.ok(sheet.available);
  const revision = adoptionRevision(sheet.bed.week, bed, MONDAY_MORNING.toISOString());
  assert.ok(revision);
  await saveAdoptedGoalForUser(ALICE, 2026, revision);

  const revisions = await listHydricGoalRevisionsThroughWeekForUser(ALICE, 2026, WEEK);
  assert.equal(revisions.length, 2, 'l\'objectif saisi reste dans l\'historique');
  assert.equal(objectiveForBed(revisions, bed, WEEK, WEEK_END).value?.toFixed(1), '24.5', 'adoptée le lundi, elle vaut pour toute la semaine');
  assert.deepEqual(await listAdoptionsForBedForUser(ALICE, 2026, BED), [{ weekStart: WEEK, amountMm: 24.5, adoptedAt: MONDAY_MORNING.toISOString() }]);
  assert.deepEqual(await listAdoptionsForBedForUser(BOB, 2026, BED), []);
  assert.deepEqual(await listAdoptionsForBedForUser(ALICE, 2027, BED), []);
  assert.deepEqual(await listAdoptionsForBedForUser(ALICE, 2026, 'planche-b'), []);

  const after = await sheetFor(ALICE);
  assert.ok(after.available);
  assert.equal(after.bed.week.objectiveMm?.toFixed(1), '24.5');
  assert.equal(after.bed.week.differenceMm?.toFixed(1), '0.0', 'l\'adoption garde le dixième de millimètre');
  assert.equal(after.adoptions.length, 1);
  const bob = await sheetFor(BOB);
  assert.ok(bob.available);
  assert.equal(bob.bed.week.objectiveMm, 20);
});

test('la base refuse une origine inconnue : seule « proposition adoptée » s\'enregistre', async () => {
  await prepareFarm(ALICE);
  assert.throws(() => database.sqlite.exec(`UPDATE irrigation_hydric_goal_revisions SET origin = 'manual'`), /CHECK constraint failed/);
  database.sqlite.exec(`UPDATE irrigation_hydric_goal_revisions SET origin = 'adopted-proposal'`);
});

test('un stade déclaré pour la planche se lit dans la fiche : « déclaré », et les stades suivants se recalent', async () => {
  await prepareFarm(ALICE);
  const result = await addStageDeclarationForUser(ALICE, 2026, { seriesId: 'tomate', bedId: BED, referenceCropId: 'criiam-tomate', rank: 3, date: '2026-05-08' });
  assert.equal(result.ok, true);
  const sheet = await sheetFor(ALICE);
  assert.ok(sheet.available);
  const [crop] = sheet.bed.today.crops;
  assert.equal(crop.status, 'computed');
  if (crop.status !== 'computed') return;
  assert.equal(crop.trace.stage.rank, 3);
  assert.equal(crop.trace.stage.origin, 'observed');
  assert.equal(crop.trace.kc.kc, 0.9);
});

test('semaine finie, planche inconnue, plan non lu : la fiche le dit, rien ne s\'adopte', async () => {
  await prepareFarm(ALICE);
  const finished = await sheetFor(ALICE, new Date('2026-05-19T05:00:00.000Z'));
  assert.ok(finished.available);
  assert.equal(finished.weekOpen, false);
  assert.deepEqual(
    await getBedCropWaterSheetForUser({ ownerUserId: ALICE, season: 2026, snapshot, bedId: 'inconnue', weekStart: WEEK, now: MONDAY_MORNING }),
    { available: false, season: 2026, bedId: 'inconnue', reason: 'unknown-bed' },
  );
  assert.deepEqual(
    await getBedCropWaterSheetForUser({ ownerUserId: ALICE, season: 2026, snapshot: { ...snapshot, cropPlan: undefined }, bedId: BED, weekStart: WEEK, now: MONDAY_MORNING }),
    { available: false, season: 2026, bedId: BED, reason: 'crop-plan-not-read' },
  );
});

test('l\'ET0 de chaque jour : la dernière réanalyse et la dernière prévision lues, la pluie saisie ignorée', () => {
  const record = (date: string, dataKind: WeatherDailyRecord['dataKind'], et0Mm: number | null, fetchedAt: string) => ({ date, dataKind, et0Mm, fetchedAt }) as WeatherDailyRecord;
  assert.deepEqual(et0Readings([
    record('2026-05-12', 'forecast', 4, '2026-05-10T00:00:00.000Z'),
    record('2026-05-11', 'forecast', 3, '2026-05-10T00:00:00.000Z'),
    record('2026-05-11', 'forecast', 3.4, '2026-05-11T00:00:00.000Z'),
    record('2026-05-11', 'reanalysis', 3.1, '2026-05-12T00:00:00.000Z'),
    record('2026-05-11', 'manual_precipitation', null, '2026-05-12T00:00:00.000Z'),
    record('2026-05-13', 'reanalysis', null, '2026-05-14T00:00:00.000Z'),
  ]), [
    { date: '2026-05-11', reanalysisMm: 3.1, forecastMm: 3.4 },
    { date: '2026-05-12', reanalysisMm: null, forecastMm: 4 },
  ]);
});

test('aspersion en début de cycle : une aspersion posée sur la planche et deux arrosages à trois jours ou moins avertissent, le Kc ne change pas', async () => {
  // Semaine du 20 avril : la tomate plantée cette semaine-là est au premier stade de sa table du CRIIAM.
  const firstWeek = '2026-04-20';
  const monday = new Date('2026-04-20T05:00:00.000Z');
  await prepareFarm(ALICE);
  const fixture = await createDripFixture(ALICE, { beds: [BED] });
  await createIrrigationEventForUser(ALICE, completedDraft(fixture, { startAt: '2026-04-17T06:00:00.000Z', endAt: '2026-04-17T07:00:00.000Z', durationSeconds: 3600 }));
  await createIrrigationEventForUser(ALICE, completedDraft(fixture, { startAt: '2026-04-20T04:00:00.000Z', endAt: '2026-04-20T04:30:00.000Z', durationSeconds: 1800 }));
  const sheet = () => getBedCropWaterSheetForUser({ ownerUserId: ALICE, season: 2026, snapshot, bedId: BED, weekStart: firstWeek, now: monday });

  const withDrip = await sheet();
  assert.ok(withDrip.available);
  assert.equal(withDrip.sprinklerWarning, null, 'un goutte-à-goutte n’avertit pas');

  database.sqlite.exec(`UPDATE irrigation_equipment SET kind = 'sprinkler' WHERE id = '${fixture.equipment.id}'`);
  const withSprinkler = await sheet();
  assert.ok(withSprinkler.available);
  assert.equal(withSprinkler.sprinklerWarning, EARLY_SPRINKLER_WARNING);

  const later = await sheetFor(ALICE);
  assert.ok(later.available);
  assert.equal(later.sprinklerWarning, null, 'au deuxième stade, plus d’avertissement');
});
