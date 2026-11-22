import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { automaticWeatherRepository } from '../../db/automatic-weather-repository';
import { OUTSIDE_JOURNAL } from '../../db/change-journal/inventory';
import { SPACE_TABLES } from '../../db/farm-erasure-plan';
import { requestFarmErasure } from '../../db/farm-erasure-repository';
import { listForecastArchive, writeForecastArchive } from '../../db/forecast-archive-repository';
import { RETENTION_PLAN, SPACE_RETENTION_TABLES } from '../../db/retention-plan';
import {
  listWeatherDailyValuesForUser,
  saveWeatherGeocodeForUser,
  saveWeatherPreferenceForUser,
} from '../../db/water-management-repository';
import { ensureWorkspaceForUser, findWorkspaceIdForUser } from '../../db/workspace-repository';
import type { IrrigationSnapshot } from '../../lib/domain/domain';
import { addDaysToDateKey } from '../../lib/domain/water-management';
import { forecastArchiveRows } from '../../lib/domain/weather/forecast-archive';
import { customWeatherLocationKey } from '../../lib/domain/weather/location';
import type { WeatherDailyValue, WeatherProvider, WeatherReadInput } from '../../lib/domain/weather/weather-provider';
import { runDueFarmErasures } from '../../lib/services/farm-erasure';
import { runRetentionPurges } from '../../lib/services/retention-purge';
import { getWaterDashboardForUser } from '../../lib/services/water-dashboard';
import { runAutomaticWeatherSync } from '../../lib/services/weather/automatic-sync';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { ALICE, BOB } from '../support/spaces';

/**
 * L'archive des prévisions J+1 à J+7, sur la base de test
 * (docs/forecast-archive-contract.md, §5, D-297 ; migration 0046) : la
 * tâche de 6 h 15 et l'actualisation à l'écran écrivent la photographie du
 * jour, la première reste, la suivante ne change rien ; deux exploitations au
 * même lieu ont chacune la leur pour un seul appel ; l'effacement, la purge
 * des 24 mois et un changement de commune.
 */

const VANNES = customWeatherLocationKey('Vannes', '56000');
const AURAY = customWeatherLocationKey('Auray', '56400');
const candidate = (city: string, postcode: string) => ({ displayName: city, city, postcode, latitude: 47.66, longitude: -2.76, timezone: 'Europe/Paris', countryCode: 'FR' });

/** Lundi 23 novembre 2026, 6 h 15 à Paris : la tâche du matin. */
const MONDAY = new Date('2026-11-23T05:15:00.000Z');
const TUESDAY = new Date('2026-11-24T05:15:00.000Z');

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

/** Un fournisseur qui compte ses appels et rend J0 à J+14 ; la pluie de chaque jour vaut `rainMm`. */
class ArchiveProvider implements WeatherProvider {
  readonly id = 'visual-crossing';
  forecastCalls: WeatherReadInput[] = [];
  rainMm: number;
  constructor(rainMm: number) {
    this.rainMm = rainMm;
  }
  async searchLocations() { return []; }
  async readForecast(input: WeatherReadInput): Promise<WeatherDailyValue[]> {
    this.forecastCalls.push(input);
    const days: WeatherDailyValue[] = [];
    for (let date = input.startDate; date <= input.endDate; date = addDaysToDateKey(date, 1)) {
      days.push({ date, precipitationMm: this.rainMm, et0Mm: 1.5, minimumTemperatureCelsius: 2, maximumTemperatureCelsius: 11 });
    }
    return days;
  }
  async readReanalysis() { return []; }
}

async function farmAt(owner: string, city: string, postcode: string, key: string): Promise<string> {
  await saveWeatherPreferenceForUser(owner, { locationMode: 'custom', customCity: city, customPostcode: postcode });
  await saveWeatherGeocodeForUser(owner, key, candidate(city, postcode), 'open-meteo');
  return (await findWorkspaceIdForUser(owner))!;
}

const sync = (provider: WeatherProvider, now: Date) => runAutomaticWeatherSync({
  repository: automaticWeatherRepository, provider, now, retry: { sleep: async () => undefined }, log: () => undefined,
});

const archiveOf = (workspaceId: string, key = VANNES) => listForecastArchive(workspaceId, key, { startDate: '2026-01-01', endDate: '2027-12-31' });

test('tests 1 et 4 : la première lecture du jour écrit J+1 à J+7 ; une seconde le même jour n’ajoute rien et ne change rien', async () => {
  const alice = await farmAt(ALICE, 'Vannes', '56000', VANNES);
  await sync(new ArchiveProvider(3), MONDAY);
  const first = await archiveOf(alice);
  assert.deepEqual(first.map((row) => [row.issuedOn, row.targetDate, row.horizonDays]), [
    ['2026-11-23', '2026-11-24', 1], ['2026-11-23', '2026-11-25', 2], ['2026-11-23', '2026-11-26', 3], ['2026-11-23', '2026-11-27', 4],
    ['2026-11-23', '2026-11-28', 5], ['2026-11-23', '2026-11-29', 6], ['2026-11-23', '2026-11-30', 7],
  ], 'ni J0 (le 23) ni J+8 à J+14');
  assert.deepEqual(
    { rain: first[0].precipitationMm, et0: first[0].et0Mm, min: first[0].minimumTemperatureCelsius, max: first[0].maximumTemperatureCelsius, solar: first[0].solarEnergyMegajoulesPerSquareMeter, source: first[0].source, fetchedAt: first[0].fetchedAt },
    { rain: 3, et0: 1.5, min: 2, max: 11, solar: null, source: 'visual-crossing', fetchedAt: '2026-11-23T05:15:00.000Z' },
  );

  // Midi : la même journée, une lecture plus fraîche, d'autres valeurs.
  await sync(new ArchiveProvider(8), new Date('2026-11-23T11:00:00.000Z'));
  assert.deepEqual(await archiveOf(alice), first, 'la photographie du matin reste telle quelle');
  const forecast = await listWeatherDailyValuesForUser(ALICE, VANNES, '2026-11-24', '2026-11-24');
  assert.equal(forecast.find((row) => row.dataKind === 'forecast')?.precipitationMm, 8, 'la table des prévisions, elle, suit la lecture la plus fraîche');
});

test('test 2 : le lendemain, une photographie s’ajoute ; celle de la veille reste, quand la table des prévisions est écrasée', async () => {
  const alice = await farmAt(ALICE, 'Vannes', '56000', VANNES);
  await sync(new ArchiveProvider(3), MONDAY);
  await sync(new ArchiveProvider(6), TUESDAY);
  const rows = await archiveOf(alice);
  assert.equal(rows.length, 14);
  const forTuesdayWednesday = rows.filter((row) => row.targetDate === '2026-11-25').map((row) => [row.issuedOn, row.horizonDays, row.precipitationMm]);
  assert.deepEqual(forTuesdayWednesday, [['2026-11-23', 2, 3], ['2026-11-24', 1, 6]], 'le mercredi vu de lundi et vu de mardi');
  const wednesday = await listWeatherDailyValuesForUser(ALICE, VANNES, '2026-11-25', '2026-11-25');
  assert.equal(wednesday.find((row) => row.dataKind === 'forecast')?.precipitationMm, 6, 'la prévision de lundi pour mercredi n’existe plus que dans l’archive');
});

test('test 6 : deux exploitations au même lieu, un seul appel, deux jeux de lignes ; chacune ne lit que le sien', async () => {
  const alice = await farmAt(ALICE, 'Vannes', '56000', VANNES);
  const bob = await farmAt(BOB, 'Vannes', '56000', VANNES);
  const provider = new ArchiveProvider(3);
  await sync(provider, MONDAY);
  assert.equal(provider.forecastCalls.length, 1, 'aucun appel externe de plus');
  assert.equal((await archiveOf(alice)).length, 7);
  assert.equal((await archiveOf(bob)).length, 7);
  const owners = database.sqlite.prepare('SELECT workspace_id, COUNT(*) AS n FROM irrigation_weather_forecast_archive GROUP BY workspace_id ORDER BY workspace_id').all() as { workspace_id: string; n: number }[];
  assert.deepEqual(owners.map((row) => Number(row.n)), [7, 7]);
  assert.deepEqual(new Set(owners.map((row) => row.workspace_id)), new Set([alice, bob]));
  assert.deepEqual(await listForecastArchive('un-autre-espace', VANNES, { startDate: '2026-01-01', endDate: '2027-12-31' }), [], 'rien sans la bonne exploitation');
});

test('une écriture refaite par une autre exploitation ne touche pas aux lignes de la première, même au même lieu et au même jour', async () => {
  const alice = await ensureWorkspaceForUser(ALICE);
  const bob = await ensureWorkspaceForUser(BOB);
  const values = [{ date: '2026-11-24', precipitationMm: 3, et0Mm: 1 }];
  const snapshot = { locationKey: VANNES, issuedOn: '2026-11-23', source: 'visual-crossing', fetchedAt: '2026-11-23T05:15:00.000Z' };
  assert.equal(await writeForecastArchive({ ...snapshot, workspaceId: alice, rows: forecastArchiveRows('2026-11-23', values) }), 1);
  assert.equal(await writeForecastArchive({ ...snapshot, workspaceId: bob, rows: forecastArchiveRows('2026-11-23', [{ ...values[0], precipitationMm: 9 }]) }), 1);
  assert.equal(await writeForecastArchive({ ...snapshot, workspaceId: alice, rows: forecastArchiveRows('2026-11-23', [{ ...values[0], precipitationMm: 5 }]) }), 0, 'une seconde écriture d’Alice : rien de neuf');
  assert.equal((await archiveOf(alice))[0].precipitationMm, 3);
  assert.equal((await archiveOf(bob))[0].precipitationMm, 9);
});

test('l’actualisation à l’écran photographie aussi, sans appel de plus, quand elle est la première lecture du jour', async () => {
  await farmAt(ALICE, 'Vannes', '56000', VANNES);
  const provider = new ArchiveProvider(4);
  const snapshot: IrrigationSnapshot = {
    configuration: { seasonFirst: 2026, seasonLast: 2026 },
    structure: { id: '4394', name: 'Ferme v2', legalCity: 'Saint-Aubin', legalPostcode: '03160', legalCountry: 'FR' },
    zones: [], plots: [], beds: [], source: 'cache', lastSuccessfulReadAt: '2026-11-23T08:00:00.000Z',
  };
  // Lundi 9 h à Paris : la semaine affichée va jusqu'au dimanche 29, la lecture aussi.
  await getWaterDashboardForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: new Date('2026-11-23T08:00:00.000Z'), provider, forceWeatherRefresh: true });
  assert.equal(provider.forecastCalls.length, 1);
  const alice = (await findWorkspaceIdForUser(ALICE))!;
  assert.deepEqual((await archiveOf(alice)).map((row) => [row.issuedOn, row.horizonDays, row.precipitationMm]), [
    ['2026-11-23', 1, 4], ['2026-11-23', 2, 4], ['2026-11-23', 3, 4], ['2026-11-23', 4, 4], ['2026-11-23', 5, 4], ['2026-11-23', 6, 4],
  ], 'jusqu’au dimanche : J+1 à J+6');
});

test('test 5 : la table de l’archive en panne, la lecture météo réussit et rien ne remonte', async () => {
  const alice = await farmAt(ALICE, 'Vannes', '56000', VANNES);
  database.sqlite.exec(`CREATE TRIGGER archive_en_panne BEFORE INSERT ON irrigation_weather_forecast_archive BEGIN SELECT RAISE(ABORT, 'panne simulée'); END`);
  const lines: Record<string, unknown>[] = [];
  const result = await runAutomaticWeatherSync({
    repository: automaticWeatherRepository, provider: new ArchiveProvider(3), now: MONDAY, retry: { sleep: async () => undefined }, log: (_level, entry) => lines.push(entry),
  });
  database.sqlite.exec('DROP TRIGGER archive_en_panne');
  assert.equal(result.successfulTargets, 1);
  assert.equal(result.failedTargets, 0);
  assert.equal((await listWeatherDailyValuesForUser(ALICE, VANNES, '2026-11-24', '2026-11-24')).length, 1, 'les prévisions sont écrites');
  assert.deepEqual(await archiveOf(alice), [], 'la photographie manque ce jour-là');
  const failures = lines.filter((line) => line.event === 'weather_forecast_archive_failed');
  assert.equal(failures.length, 1);
  assert.ok(!JSON.stringify(failures).includes('panne simulée'), 'ni le message de la base');
  assert.ok(!JSON.stringify(failures).includes('47.66'), 'ni les coordonnées');
});

test('test 9 : un changement de commune ouvre une série distincte, sans rien perdre', async () => {
  const alice = await farmAt(ALICE, 'Vannes', '56000', VANNES);
  await sync(new ArchiveProvider(3), MONDAY);
  await farmAt(ALICE, 'Auray', '56400', AURAY);
  await sync(new ArchiveProvider(5), TUESDAY);
  assert.equal((await archiveOf(alice, VANNES)).length, 7, 'la série de Vannes reste');
  assert.deepEqual((await archiveOf(alice, AURAY)).map((row) => [row.issuedOn, row.precipitationMm]).slice(0, 1), [['2026-11-24', 5]]);
  assert.equal((await archiveOf(alice, AURAY)).length, 7);
});

test('test 8 : la purge du matin retire une ligne émise il y a 24 mois et un jour, garde celle de 23 mois et celle du jour exact', async () => {
  const alice = await ensureWorkspaceForUser(ALICE);
  const bob = await ensureWorkspaceForUser(BOB);
  const write = (workspaceId: string, issuedOn: string) => writeForecastArchive({
    workspaceId, locationKey: VANNES, issuedOn, source: 'visual-crossing', fetchedAt: `${issuedOn}T05:15:00.000Z`,
    rows: forecastArchiveRows(issuedOn, [{ date: addDaysToDateKey(issuedOn, 1), precipitationMm: 1, et0Mm: null }]),
  });
  for (const workspaceId of [alice, bob]) {
    await write(workspaceId, '2024-11-22');
    await write(workspaceId, '2024-11-23');
    await write(workspaceId, '2024-12-23');
  }
  const report = await runRetentionPurges({ now: MONDAY, log: () => undefined });
  assert.equal(report.failures.length, 0);
  for (const workspaceId of [alice, bob]) {
    assert.deepEqual((await listForecastArchive(workspaceId, VANNES, { startDate: '2024-01-01', endDate: '2025-12-31' })).map((row) => row.issuedOn), ['2024-11-23', '2024-12-23']);
  }
});

test('test 7 : l’effacement d’une ferme retire ses lignes et garde celles des autres ; les plans et l’inventaire connaissent la table', async () => {
  const alice = await farmAt(ALICE, 'Vannes', '56000', VANNES);
  const bob = await farmAt(BOB, 'Vannes', '56000', VANNES);
  await sync(new ArchiveProvider(3), MONDAY);
  await requestFarmErasure(ALICE, new Date('2026-11-23T10:00:00.000Z'));
  const report = await runDueFarmErasures({ now: new Date('2026-12-01T05:15:00.000Z'), log: () => undefined });
  assert.equal(report.erased, 1);
  assert.deepEqual(await archiveOf(alice), []);
  assert.equal((await archiveOf(bob)).length, 7, 'Bob garde les siennes');

  assert.ok(SPACE_TABLES.some(({ table }) => table === 'irrigation_weather_forecast_archive'), 'au plan d’effacement');
  assert.equal(RETENTION_PLAN.irrigation_weather_forecast_archive.purge, 'issued_on < ?', 'au plan de conservation, avec sa purge');
  assert.ok(!SPACE_RETENTION_TABLES.includes('irrigation_weather_forecast_archive'), 'une seule règle de conservation');
  assert.match(OUTSIDE_JOURNAL.irrigation_weather_forecast_archive ?? '', /archive des prévisions/, 'à l’inventaire du journal des modifications, hors du journal');
});
