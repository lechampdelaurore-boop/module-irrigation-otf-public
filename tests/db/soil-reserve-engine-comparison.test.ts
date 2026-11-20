import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { saveSpeciesCorrespondenceForUser } from '../../db/crop-water/entries';
import { addSoilObservationForUser, addSoilRecordForUser } from '../../db/soil-reserve/entries';
import { upsertWeatherDailyValuesForUser } from '../../db/water-management-repository';
import type { IrrigationSnapshot } from '../../lib/domain/domain';
import { emptyGaugeComparison, otherGaugeEngine } from '../../lib/domain/soil-reserve/gauge-comparison';
import { GAUGE_ENGINE } from '../../lib/domain/soil-reserve/gauge-switch';
import type { SoilRecord } from '../../lib/domain/soil-reserve/soil';
import { addDaysToDateKey } from '../../lib/domain/water-management';
import { weatherLocationKey } from '../../lib/domain/weather/location';
import { recordSoilDaysForAllWorkspaces, recordSoilDaysForUser } from '../../lib/services/soil-reserve-record';
import { cultivation, series, task } from '../support/crop-water-references';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { confirmFarmLocation } from '../support/onboarding';
import { FARM_SOIL } from '../support/soil-reserve-fixtures';
import { ALICE } from '../support/spaces';

/**
 * La comparaison du matin des deux calculs de la jauge
 * (docs/shared-engine-adapter-contract.md, « L'interrupteur et la preuve
 * d'égalité ») : l'enregistrement rejoue l'autre calcul sur chaque planche,
 * sans rien changer à ce qu'il enregistre, et écrit une seule ligne au
 * journal, sans aucune donnée de la ferme.
 */

const SHELTER = 'jardin-serre';
const NOW = new Date('2026-05-11T05:00:00.000Z');

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

const bed = (id: string, name: string) => ({ id, zoneId: 'parcelle', plotId: SHELTER, name, length: 10, width: 0.8, alleyWidth: 0.4, area: 8, seasons: [2026] });

const snapshot: IrrigationSnapshot = {
  configuration: { seasonFirst: 2025, seasonLast: 2027 },
  structure: { id: '17', name: 'Ferme', legalCity: 'Rennes', legalPostcode: '35000', legalCountry: 'FR' },
  zones: [{ id: 'parcelle', name: 'Parcelle', area: null, seasons: [2025, 2026] }],
  plots: [{ id: SHELTER, zoneId: 'parcelle', name: 'Serre', mode: 'greenhouse', length: 10, width: 8, area: 80, seasons: [2025, 2026] }],
  beds: [bed('planche-a', 'A'), bed('planche-b', 'B')],
  cropPlan: {
    series: [series('tomate', [cultivation('tomate-c', 'plant-tomate', 'Tomate', { expected: ['2026-W27', '2026-W40'] })])],
    places: [{ id: 'place-tomate', seriesId: 'tomate', bedId: 'planche-a', lengthMeters: null }],
    implantationTasks: [task('tomate', 'planting', '2026-W17')],
    readSummary: { seriesRead: 1, placesRead: 1, tasksRead: 1, tasksRetained: 1, placesWithoutSeries: 0, placesOfUnknownSeries: 0, placesWithUnknownBed: 0 },
  },
  source: 'cache',
  lastSuccessfulReadAt: '2026-05-11T00:00:00.000Z',
};

const location = weatherLocationKey({ locationMode: 'otf', customCity: null, customPostcode: null, locationConfirmed: true }, snapshot.structure)!;
const SOIL_ENTRY = Object.fromEntries(Object.entries({ ...FARM_SOIL, zoneId: 'parcelle', plotId: null }).filter(([key]) => key !== 'recordedAt')) as Omit<SoilRecord, 'recordedAt'>;

test('le matin rejoue l’autre calcul de la jauge sur chaque planche, sans écart et sans rien changer à l’enregistrement', async () => {
  await saveSpeciesCorrespondenceForUser(ALICE, { plantId: 'plant-tomate', seriesId: null, target: { kind: 'reference', referenceCropId: 'criiam-tomate', analogy: false } });
  await confirmFarmLocation(ALICE, snapshot.structure);
  const days = Array.from({ length: 47 }, (_, index) => addDaysToDateKey('2026-04-01', index));
  await upsertWeatherDailyValuesForUser(ALICE, location, 'forecast', days.map((date) => ({ date, precipitationMm: 0, et0Mm: 5 })), 'test', '2026-04-01T04:00:00.000Z');
  assert.equal((await addSoilRecordForUser(ALICE, SOIL_ENTRY, NOW)).ok, true);
  const observed = { zoneId: 'parcelle', plotId: SHELTER, percent: 60, observedAt: '2026-05-08T04:30:00.000Z' };
  assert.equal((await addSoilObservationForUser(ALICE, observed, new Date('2026-05-08T05:00:00.000Z'))).ok, true);

  const plain = await recordSoilDaysForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: NOW });
  const comparison = emptyGaugeComparison();
  assert.equal(await recordSoilDaysForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: NOW, comparison }), plain);
  assert.equal(comparison.beds, 2, 'la planche cultivée et la planche sans culture');
  assert.ok(comparison.days > 2 * 7);
  assert.deepEqual([comparison.daysWithGap, comparison.gapsByField, comparison.failures, comparison.firstFailure, comparison.skippedBeds], [0, {}, 0, null, 0]);
  assert.ok(comparison.maxGap < 1e-9);
});

test('une seule ligne au journal chaque matin, même sans ferme à suivre, faite de nombres et de noms de grandeurs', async () => {
  const lines: Record<string, unknown>[] = [];
  const failures: string[] = [];
  const result = await recordSoilDaysForAllWorkspaces({ now: NOW, log: (line) => failures.push(line), logComparison: (entry) => lines.push(entry) });
  assert.deepEqual(result, { recorded: 0, failed: 0 });
  assert.deepEqual(failures, []);
  assert.deepEqual(lines, [{
    event: 'soil_reserve_engine_comparison',
    reference: GAUGE_ENGINE,
    compared: otherGaugeEngine(GAUGE_ENGINE),
    engineVersion: '0.3.0',
    toleranceMm: 0.01,
    beds: 0,
    days: 0,
    daysWithGap: 0,
    gapsByField: {},
    maxGap: 0,
    failures: 0,
    firstFailure: null,
    skippedBeds: 0,
  }]);
});

test('le journal de la comparaison ne fait jamais échouer le matin', async () => {
  const result = await recordSoilDaysForAllWorkspaces({
    now: NOW,
    log: () => undefined,
    logComparison: () => {
      throw new Error('journal indisponible');
    },
  });
  assert.deepEqual(result, { recorded: 0, failed: 0 });
});
