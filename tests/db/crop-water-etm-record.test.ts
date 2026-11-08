import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { listEtmDaysForWorkspace } from '../../db/crop-water/etm-days';
import { saveSpeciesCorrespondenceForUser } from '../../db/crop-water/entries';
import { upsertWeatherDailyValuesForUser } from '../../db/water-management-repository';
import { findWorkspaceIdForUser } from '../../db/workspace-repository';
import type { IrrigationSnapshot } from '../../lib/domain/domain';
import { addDaysToDateKey } from '../../lib/domain/water-management';
import { weatherLocationKey } from '../../lib/domain/weather/location';
import { etmRecordDates, recordEtmDaysForUser } from '../../lib/services/crop-water-etm-record';
import { cultivation, series, task } from '../support/crop-water-references';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';

/**
 * L'ETM enregistrée chaque matin (5 quater, PR 3d, « La traçabilité ») :
 * aujourd'hui et les sept jours d'avant, chaque planche, avec ce qui l'a
 * produite ; recalculée le lendemain, la ligne d'un jour est remplacée — la
 * réanalyse arrivée entre-temps prend la place de la prévision.
 */

const ALICE = 'alice';
const BED = 'planche-a';
const EMPTY_BED = 'planche-b';
const SHELTER = 'jardin-serre';
const TODAY = '2026-05-11';
const MONDAY_MORNING = new Date('2026-05-11T05:00:00.000Z');
const TUESDAY_MORNING = new Date('2026-05-12T05:00:00.000Z');

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
  zones: [{ id: 'parcelle', name: 'Parcelle', area: null, seasons: [2026] }],
  plots: [{ id: SHELTER, zoneId: 'parcelle', name: 'Serre', mode: 'greenhouse', length: 10, width: 8, area: 80, seasons: [2026] }],
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

test('les jours enregistrés sont aujourd’hui et les sept d’avant, sans déborder sur la saison d’avant', () => {
  assert.deepEqual(etmRecordDates(TODAY, 2026), days('2026-05-04', 8));
  assert.deepEqual(etmRecordDates('2026-01-03', 2026), ['2026-01-01', '2026-01-02', '2026-01-03']);
});

test('chaque matin, l’ETM de chaque planche s’enregistre pour huit jours avec sa trace, et le lendemain la réanalyse remplace la prévision', async () => {
  await saveSpeciesCorrespondenceForUser(ALICE, { plantId: 'plant-tomate', seriesId: null, target: { kind: 'reference', referenceCropId: 'criiam-tomate', analogy: false } });
  await upsertWeatherDailyValuesForUser(ALICE, location, 'forecast', days('2026-05-04', 9).map((date) => ({ date, precipitationMm: 0, et0Mm: 5 })), 'test', '2026-05-04T04:00:00.000Z');
  await upsertWeatherDailyValuesForUser(ALICE, location, 'reanalysis', [{ date: '2026-05-04', precipitationMm: 0, et0Mm: 4 }], 'test', '2026-05-10T04:00:00.000Z');
  const workspaceId = await findWorkspaceIdForUser(ALICE);
  assert.ok(workspaceId);

  assert.equal(await recordEtmDaysForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: MONDAY_MORNING }), 16);
  const monday = await listEtmDaysForWorkspace(workspaceId, 2026, '2026-05-01', '2026-05-31');
  const tomato = monday.filter((row) => row.bedId === BED);
  assert.deepEqual(tomato.map((row) => row.date), days('2026-05-04', 8), 'demain n’est pas enregistré');
  assert.deepEqual(tomato.map((row) => row.et0Nature), ['reanalysis', 'estimated', 'estimated', 'estimated', 'estimated', 'estimated', 'estimated', 'forecast']);
  const today = tomato.at(-1)!;
  assert.equal(today.status, 'computed');
  assert.equal(today.trace?.referenceCropId, 'criiam-tomate');
  assert.equal(today.trace?.shelterFactor, 0.8);
  assert.equal(today.etmMm?.toFixed(2), (5 * 0.8 * today.trace!.kc).toFixed(2), 'ETM = ET0 × K_abri × Kc');
  assert.ok(monday.filter((row) => row.bedId === EMPTY_BED).every((row) => row.status === 'no-crop' && row.etmMm === 0), 'une planche sans culture compte 0');

  await upsertWeatherDailyValuesForUser(ALICE, location, 'reanalysis', [{ date: '2026-05-05', precipitationMm: 0, et0Mm: 3 }], 'test', '2026-05-11T04:00:00.000Z');
  await recordEtmDaysForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: TUESDAY_MORNING });
  const tuesday = (await listEtmDaysForWorkspace(workspaceId, 2026, '2026-05-01', '2026-05-31')).filter((row) => row.bedId === BED);
  assert.deepEqual(tuesday.map((row) => row.date), days('2026-05-04', 9), 'le jour du 4 mai reste, il n’est plus recalculé');
  const fifth = tuesday.find((row) => row.date === '2026-05-05')!;
  assert.equal(fifth.et0Nature, 'reanalysis');
  assert.equal(fifth.et0Mm, 3);
  assert.equal(fifth.computedAt, TUESDAY_MORNING.toISOString());
  assert.equal(tuesday.find((row) => row.date === '2026-05-04')!.computedAt, MONDAY_MORNING.toISOString());
});

test('une ferme sans espace ni plan lu n’enregistre rien', async () => {
  assert.equal(await recordEtmDaysForUser({ ownerUserId: 'bob', season: 2026, snapshot, now: MONDAY_MORNING }), 0);
  assert.equal(await recordEtmDaysForUser({ ownerUserId: ALICE, season: 2026, snapshot: { ...snapshot, cropPlan: undefined }, now: MONDAY_MORNING }), 0);
});
