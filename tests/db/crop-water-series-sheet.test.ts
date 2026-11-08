import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { addStageDeclarationForUser, saveSpeciesCorrespondenceForUser } from '../../db/crop-water/entries';
import { upsertWeatherDailyValuesForUser } from '../../db/water-management-repository';
import type { IrrigationSnapshot } from '../../lib/domain/domain';
import { addDaysToDateKey } from '../../lib/domain/water-management';
import { weatherLocationKey } from '../../lib/domain/weather/location';
import { getSeriesCropWaterSheetForUser } from '../../lib/services/crop-water-series';
import { cultivation, series, task } from '../support/crop-water-references';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';

/**
 * La fiche de la série (5 quater, PR 3e, « L'écran ») : sur chacune de ses
 * planches, le stade, le Kc et l'ETM du jour de ses cultures, et la
 * proposition de la planche entière, qui compte aussi les autres séries
 * présentes (l'ETM d'une planche est celle de sa culture la plus exigeante) ; un stade déclaré pour toute la série vaut sur chaque planche.
 */

const ALICE = 'alice';
const TODAY = '2026-05-13';
const NOW = new Date('2026-05-13T08:00:00.000Z');

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

const bed = (id: string, name: string, plotId: string) => ({ id, zoneId: 'parcelle', plotId, name, length: 10, width: 0.8, alleyWidth: 0.4, area: 8, seasons: [2026] });

const snapshot: IrrigationSnapshot = {
  configuration: { seasonFirst: 2025, seasonLast: 2027 },
  structure: { id: '17', name: 'Ferme', legalCity: 'Rennes', legalPostcode: '35000', legalCountry: 'FR' },
  zones: [{ id: 'parcelle', name: 'Parcelle', area: null, seasons: [2026] }],
  plots: [
    { id: 'serre', zoneId: 'parcelle', name: 'Serre', mode: 'greenhouse', length: 10, width: 8, area: 80, seasons: [2026] },
    { id: 'champ', zoneId: 'parcelle', name: 'Champ', mode: 'garden', length: 10, width: 8, area: 80, seasons: [2026] },
  ],
  beds: [bed('a', 'A', 'serre'), bed('b', 'B', 'champ'), bed('c', 'C', 'champ')],
  cropPlan: {
    series: [
      series('tomates', [cultivation('tomate-c', 'plant-tomate', 'Tomate', { expected: ['2026-W27', '2026-W40'] })], { name: 'Tomates rondes' }),
      series('salades', [cultivation('salade-c', 'plant-salade', 'Laitue', { expected: ['2026-W24'] })], { name: 'Salades' }),
    ],
    places: [
      { id: 'p1', seriesId: 'tomates', bedId: 'a', lengthMeters: null },
      { id: 'p2', seriesId: 'tomates', bedId: 'b', lengthMeters: null },
      { id: 'p3', seriesId: 'salades', bedId: 'b', lengthMeters: null },
      { id: 'p4', seriesId: 'salades', bedId: 'c', lengthMeters: null },
    ],
    implantationTasks: [task('tomates', 'planting', '2026-W17'), task('salades', 'planting', '2026-W18')],
    readSummary: { seriesRead: 2, placesRead: 4, tasksRead: 2, tasksRetained: 2, placesWithoutSeries: 0, placesOfUnknownSeries: 0, placesWithUnknownBed: 0 },
  },
  source: 'cache',
  lastSuccessfulReadAt: '2026-05-13T00:00:00.000Z',
};

const location = weatherLocationKey({ locationMode: 'otf', customCity: null, customPostcode: null }, snapshot.structure)!;

async function prepare() {
  await saveSpeciesCorrespondenceForUser(ALICE, { plantId: 'plant-tomate', seriesId: null, target: { kind: 'reference', referenceCropId: 'criiam-tomate', analogy: false } });
  await saveSpeciesCorrespondenceForUser(ALICE, { plantId: 'plant-salade', seriesId: null, target: { kind: 'reference', referenceCropId: 'criiam-salade-ete', analogy: false } });
  const days = Array.from({ length: 7 }, (_, index) => addDaysToDateKey('2026-05-11', index));
  await upsertWeatherDailyValuesForUser(ALICE, location, 'forecast', days.map((date) => ({ date, precipitationMm: 0, et0Mm: 4 })), 'test', '2026-05-11T04:00:00.000Z');
}

test('la fiche de la série montre ses cultures sur chacune de ses planches, et la proposition de la planche entière', async () => {
  await prepare();
  const sheet = await getSeriesCropWaterSheetForUser({ ownerUserId: ALICE, season: 2026, snapshot, seriesId: 'tomates', now: NOW });
  assert.ok(sheet.available);
  assert.equal(sheet.today, TODAY);
  assert.equal(sheet.seriesName, 'Tomates rondes');
  assert.deepEqual(sheet.beds.map((item) => [item.bedName, item.plotName, item.crops.map((crop) => crop.plantName), item.otherSeries]), [
    ['A', 'Serre', ['Tomate'], []],
    ['B', 'Champ', ['Tomate'], ['Salades']],
  ]);
  const sheltered = sheet.beds[0].crops[0];
  assert.equal(sheltered.status, 'computed');
  assert.equal(sheltered.status === 'computed' && sheltered.trace.shelterFactor, 0.8);
  const shared = sheet.beds[1];
  // L'ETM d'une planche est celle de sa culture la plus exigeante du jour, salades comprises.
  assert.ok(shared.bedEtmMm !== null && shared.crops[0].status === 'computed' && shared.bedEtmMm >= shared.crops[0].etmMm);
  assert.equal(shared.week.status, 'complete');
  assert.deepEqual(sheet.stageChoices.map((choice) => [choice.seriesId, choice.referenceCropId]), [['tomates', 'criiam-tomate']]);
});

test('un stade déclaré pour toute la série vaut sur chacune de ses planches', async () => {
  await prepare();
  const declared = await addStageDeclarationForUser(ALICE, 2026, { seriesId: 'tomates', bedId: null, referenceCropId: 'criiam-tomate', rank: 3, date: '2026-05-12' });
  assert.equal(declared.ok, true);
  const sheet = await getSeriesCropWaterSheetForUser({ ownerUserId: ALICE, season: 2026, snapshot, seriesId: 'tomates', now: NOW });
  assert.ok(sheet.available);
  for (const item of sheet.beds) {
    const crop = item.crops[0];
    assert.ok(crop.status === 'computed', item.bedName);
    assert.equal(crop.trace.stage.rank, 3, item.bedName);
    assert.equal(crop.trace.stage.origin, 'observed', item.bedName);
  }
});

test('une série inconnue ou un plan non lu se disent, plutôt qu’une fiche vide', async () => {
  assert.deepEqual(
    await getSeriesCropWaterSheetForUser({ ownerUserId: ALICE, season: 2026, snapshot, seriesId: 'inconnue', now: NOW }),
    { available: false, season: 2026, seriesId: 'inconnue', reason: 'unknown-series' },
  );
  assert.deepEqual(
    await getSeriesCropWaterSheetForUser({ ownerUserId: ALICE, season: 2026, snapshot: { ...snapshot, cropPlan: undefined }, seriesId: 'tomates', now: NOW }),
    { available: false, season: 2026, seriesId: 'tomates', reason: 'crop-plan-not-read' },
  );
});
