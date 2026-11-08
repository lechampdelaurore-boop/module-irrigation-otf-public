import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { saveSpeciesCorrespondenceForUser } from '../../db/crop-water/entries';
import { listSoilDaysForWorkspace } from '../../db/soil-reserve/days';
import { addSoilObservationForUser, addSoilRecordForUser } from '../../db/soil-reserve/entries';
import { upsertWeatherDailyValuesForUser } from '../../db/water-management-repository';
import { findWorkspaceIdForUser } from '../../db/workspace-repository';
import type { IrrigationSnapshot } from '../../lib/domain/domain';
import { addDaysToDateKey } from '../../lib/domain/water-management';
import type { SoilRecord } from '../../lib/domain/soil-reserve/soil';
import { weatherLocationKey } from '../../lib/domain/weather/location';
import { recordSoilDaysForUser } from '../../lib/services/soil-reserve-record';
import { cultivation, series, task } from '../support/crop-water-references';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { FARM_SOIL } from '../support/soil-reserve-fixtures';

/**
 * L'état du jour de la jauge enregistré chaque matin (5 ter, PR 3d) : les
 * jours passés de la semaine écoulée, depuis le départ de la jauge, jamais
 * aujourd'hui ni les jours prévus ; un recalcul remplace l'état du même jour.
 */

const ALICE = 'alice';
const BED = 'planche-a';
const EMPTY_BED = 'planche-b';
const SHELTER = 'jardin-serre';
const NOW = new Date('2026-05-11T05:00:00.000Z');

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

const tomatoSeries = series('tomate', [cultivation('tomate-c', 'plant-tomate', 'Tomate', { expected: ['2026-W27', '2026-W40'] })]);
const bed = (id: string, name: string) => ({ id, zoneId: 'parcelle', plotId: SHELTER, name, length: 10, width: 0.8, alleyWidth: 0.4, area: 8, seasons: [2026] });

const snapshot: IrrigationSnapshot = {
  configuration: { seasonFirst: 2025, seasonLast: 2027 },
  structure: { id: '17', name: 'Ferme', legalCity: 'Rennes', legalPostcode: '35000', legalCountry: 'FR' },
  zones: [{ id: 'parcelle', name: 'Parcelle', area: null, seasons: [2025, 2026] }],
  plots: [{ id: SHELTER, zoneId: 'parcelle', name: 'Serre', mode: 'greenhouse', length: 10, width: 8, area: 80, seasons: [2025, 2026] }],
  beds: [bed(BED, 'A'), bed(EMPTY_BED, 'B')],
  cropPlan: {
    series: [tomatoSeries],
    places: [{ id: 'place-tomate', seriesId: 'tomate', bedId: BED, lengthMeters: null }],
    implantationTasks: [task('tomate', 'planting', '2026-W17')],
    readSummary: { seriesRead: 1, placesRead: 1, tasksRead: 1, tasksRetained: 1, placesWithoutSeries: 0, placesOfUnknownSeries: 0, placesWithUnknownBed: 0 },
  },
  source: 'cache',
  lastSuccessfulReadAt: '2026-05-11T00:00:00.000Z',
};

const location = weatherLocationKey({ locationMode: 'otf', customCity: null, customPostcode: null }, snapshot.structure)!;
const days = (from: string, count: number) => Array.from({ length: count }, (_, index) => addDaysToDateKey(from, index));
/** Le sol de la ferme du porteur tel qu'il se saisit : l'heure d'enregistrement vient de la base. */
const SOIL_ENTRY = Object.fromEntries(Object.entries({ ...FARM_SOIL, zoneId: 'parcelle', plotId: null }).filter(([key]) => key !== 'recordedAt')) as Omit<SoilRecord, 'recordedAt'>;

async function prepare(): Promise<void> {
  await saveSpeciesCorrespondenceForUser(ALICE, { plantId: 'plant-tomate', seriesId: null, target: { kind: 'reference', referenceCropId: 'criiam-tomate', analogy: false } });
  await upsertWeatherDailyValuesForUser(ALICE, location, 'forecast', days('2026-04-01', 47).map((date) => ({ date, precipitationMm: 0, et0Mm: 5 })), 'test', '2026-04-01T04:00:00.000Z');
}

test('les jours passés depuis l’observation sont enregistrés, ni aujourd’hui ni les jours prévus, et un recalcul les remplace', async () => {
  await prepare();
  assert.equal((await addSoilRecordForUser(ALICE, SOIL_ENTRY, NOW)).ok, true);
  const observedNow = new Date('2026-05-08T05:00:00.000Z');
  assert.equal((await addSoilObservationForUser(ALICE, { zoneId: 'parcelle', plotId: SHELTER, percent: 60, observedAt: '2026-05-08T04:30:00.000Z' }, observedNow)).ok, true);

  const recorded = await recordSoilDaysForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: NOW });
  const workspaceId = (await findWorkspaceIdForUser(ALICE))!;
  const stored = await listSoilDaysForWorkspace(workspaceId, '2026-04-01', '2026-05-31');
  assert.equal(stored.length, recorded);
  const tomato = stored.filter((day) => day.bedId === BED);
  assert.deepEqual(tomato.map((day) => day.date), ['2026-05-08', '2026-05-09', '2026-05-10'], 'depuis le départ de la jauge, le jour de l’observation, jamais aujourd’hui');
  assert.equal(tomato.find((day) => day.date === '2026-05-08')?.restart, 'observation');
  assert.ok(tomato.filter((day) => day.date >= '2026-05-08').every((day) => day.stateMm !== null && day.mode === 'crop'));
  assert.ok(stored.some((day) => day.bedId === EMPTY_BED), 'la planche sans culture aussi');

  const again = await recordSoilDaysForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: NOW });
  assert.equal(again, recorded);
  assert.equal((await listSoilDaysForWorkspace(workspaceId, '2026-04-01', '2026-05-31')).length, recorded, 'remplacés, pas ajoutés');
});

test('sept jours au plus : une observation plus ancienne ne fait pas remonter l’enregistrement', async () => {
  await prepare();
  assert.equal((await addSoilRecordForUser(ALICE, SOIL_ENTRY, NOW)).ok, true);
  assert.equal((await addSoilObservationForUser(ALICE, { zoneId: 'parcelle', plotId: SHELTER, percent: 60, observedAt: '2026-04-28T04:30:00.000Z' }, new Date('2026-04-28T05:00:00.000Z'))).ok, true);
  await recordSoilDaysForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: NOW });
  const stored = await listSoilDaysForWorkspace((await findWorkspaceIdForUser(ALICE))!, '2026-04-01', '2026-05-31');
  assert.deepEqual([...new Set(stored.map((day) => day.date))], ['2026-05-04', '2026-05-05', '2026-05-06', '2026-05-07', '2026-05-08', '2026-05-09', '2026-05-10']);
});

test('rien n’est enregistré pour une autre saison, sans plan de culture lu, ni pour une ferme sans espace', async () => {
  await prepare();
  assert.equal(await recordSoilDaysForUser({ ownerUserId: ALICE, season: 2025, snapshot, now: NOW }), 0);
  assert.equal(await recordSoilDaysForUser({ ownerUserId: ALICE, season: 2026, snapshot: { ...snapshot, cropPlan: undefined }, now: NOW }), 0);
  assert.equal(await recordSoilDaysForUser({ ownerUserId: 'bob', season: 2026, snapshot, now: NOW }), 0);
});
