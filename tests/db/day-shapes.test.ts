import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { automaticWeatherRepository } from '../../db/automatic-weather-repository';
import { OUTSIDE_JOURNAL } from '../../db/change-journal/inventory';
import { listDayShapes, listDayShapesOfDay, writeDayShapes } from '../../db/day-shape-repository';
import { KEPT_TABLES, SPACE_TABLES } from '../../db/farm-erasure-plan';
import { RETENTION_PLAN } from '../../db/retention-plan';
import { saveWeatherGeocodeForUser, saveWeatherPreferenceForUser, upsertWeatherDailyValuesForUser } from '../../db/water-management-repository';
import type { IrrigationSnapshot } from '../../lib/domain/domain';
import { FEATURE_IDS } from '../../lib/domain/features/catalogue';
import { addDaysToDateKey } from '../../lib/domain/water-management';
import type { RecordedDayShape } from '../../lib/domain/weather/hourly-et0';
import { customWeatherLocationKey } from '../../lib/domain/weather/location';
import type { WeatherDailyValue, WeatherProvider, WeatherReadInput } from '../../lib/domain/weather/weather-provider';
import { runRetentionPurges } from '../../lib/services/retention-purge';
import { getTodayViewForUser } from '../../lib/services/today-service';
import { runAutomaticWeatherSync } from '../../lib/services/weather/automatic-sync';
import { applyMigrationsAfter, createMigratedSqliteDatabase, installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { ALICE, BOB } from '../support/spaces';

/**
 * La forme de la journée de l'ET0 horaire, sur la base de test
 * (docs/et0-horaire-contract.md, § 5 ; D-349 ; migration 0052) : la
 * migration additive, l'écriture par lieu et par source, une lecture plus
 * récente qui remplace, la lecture du matin qui écrit une fois pour deux
 * fermes du même lieu, la purge des 8 jours, les plans.
 */

const PLACE = '47.660000:-2.760000:Europe/Paris';
const VANNES = customWeatherLocationKey('Vannes', '56000');
const candidate = { displayName: 'Vannes', city: 'Vannes', postcode: '56000', latitude: 47.66, longitude: -2.76, timezone: 'Europe/Paris', countryCode: 'FR' };
/** Lundi 15 juin 2026, 6 h 15 à Paris : la tâche du matin. */
const MORNING = new Date('2026-06-15T04:15:00.000Z');

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

const flat = (count = 24) => Array.from({ length: count }, () => 1 / count);
const row = (date: string, nature: RecordedDayShape['nature'] = 'provider-hourly', shares = flat()): RecordedDayShape => ({ date, nature, shares });

test('migration 0052 : une table neuve, rien d’existant ne change ; ses contraintes refusent une forme mal formée', () => {
  const before = createMigratedSqliteDatabase('drizzle', '0051_weather_forecast_model.sql');
  const tablesBefore = before.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`).all().map((item) => item.name);
  applyMigrationsAfter(before, '0051_weather_forecast_model.sql', 'drizzle', '0052_weather_day_shapes.sql');
  const tablesAfter = before.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`).all().map((item) => item.name);
  assert.deepEqual(tablesAfter.filter((name) => !tablesBefore.includes(name)), ['irrigation_weather_day_shapes']);
  const insert = before.prepare(`INSERT INTO irrigation_weather_day_shapes (place_key, day, source, nature, hour_count, shares, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  insert.run(PLACE, '2026-06-15', 'visual-crossing', 'computed-hourly', 24, JSON.stringify(flat()), '2026-06-15T04:15:00.000Z');
  assert.throws(() => insert.run(PLACE, '2026-06-16', 'visual-crossing', 'theoretical', 24, JSON.stringify(flat()), 'x'), /CHECK/, 'la forme théorique ne s’écrit pas');
  assert.throws(() => insert.run(PLACE, '2026-06-16', 'visual-crossing', 'provider-hourly', 24, JSON.stringify(flat(23)), 'x'), /CHECK/, 'autant de parts que d’heures');
  assert.throws(() => insert.run(PLACE, '2026-06-16', 'visual-crossing', 'provider-hourly', 22, JSON.stringify(flat(22)), 'x'), /CHECK/, '23 à 25 heures');
  assert.throws(() => insert.run(PLACE, '16/06/2026', 'visual-crossing', 'provider-hourly', 24, JSON.stringify(flat()), 'x'), /CHECK/);
  before.close();
});

test('écrire et relire une forme par lieu et par source ; une lecture plus récente remplace celle du même jour', async () => {
  await writeDayShapes({ placeKey: PLACE, source: 'open-meteo:meteofrance_seamless', fetchedAt: 'avant', rows: [row('2026-06-15'), row('2026-03-29', 'provider-hourly', flat(23))] });
  await writeDayShapes({ placeKey: PLACE, source: 'visual-crossing', fetchedAt: 'avant', rows: [row('2026-06-15', 'computed-hourly')] });
  const later = flat().map((share, index) => (index === 13 ? share + 0.01 : index === 2 ? share - 0.01 : share));
  await writeDayShapes({ placeKey: PLACE, source: 'open-meteo:meteofrance_seamless', fetchedAt: 'après', rows: [row('2026-06-15', 'provider-hourly', later)] });

  const meteoFrance = await listDayShapes(PLACE, 'open-meteo:meteofrance_seamless', ['2026-03-29', '2026-06-15', '2026-06-16']);
  assert.deepEqual(meteoFrance.map((shape) => [shape.date, shape.shares.length, shape.fetchedAt]), [['2026-03-29', 23, 'avant'], ['2026-06-15', 24, 'après']]);
  assert.equal(meteoFrance[1].shares[13], later[13]);
  const visualCrossing = await listDayShapes(PLACE, 'visual-crossing', ['2026-06-15']);
  assert.deepEqual(visualCrossing.map((shape) => [shape.nature, shape.fetchedAt]), [['computed-hourly', 'avant']], 'une source ne lit jamais la forme d’une autre');
  assert.deepEqual(await listDayShapes('autre-lieu', 'visual-crossing', ['2026-06-15']), []);
  assert.deepEqual(await listDayShapes(PLACE, 'visual-crossing', []), []);
});

class HourlyProvider implements WeatherProvider {
  readonly id = 'visual-crossing';
  calls = 0;
  async searchLocations() { return []; }
  async readForecast(input: WeatherReadInput): Promise<WeatherDailyValue[]> {
    this.calls += 1;
    const days: WeatherDailyValue[] = [];
    for (let date = input.startDate; date <= input.endDate; date = addDaysToDateKey(date, 1)) {
      days.push({ date, precipitationMm: 0, et0Mm: 4, hourlyEt0: { nature: 'computed-hourly', valuesMm: Array.from({ length: 24 }, (_, hour) => (hour >= 6 && hour < 20 ? 0.3 : 0)) } });
    }
    return days;
  }
  async readReanalysis() { return []; }
}

test('scénario 11 sur la base : deux fermes à Vannes, une lecture, trois formes écrites pour le lieu, aucune pour une ferme', async () => {
  for (const owner of [ALICE, BOB]) {
    await saveWeatherPreferenceForUser(owner, { locationMode: 'custom', customCity: 'Vannes', customPostcode: '56000' });
    await saveWeatherGeocodeForUser(owner, VANNES, candidate, 'open-meteo');
  }
  const provider = new HourlyProvider();
  await runAutomaticWeatherSync({ repository: automaticWeatherRepository, provider, now: MORNING, retry: { sleep: async () => undefined }, log: () => undefined });
  assert.equal(provider.calls, 1);
  const shapes = await listDayShapes(PLACE, 'visual-crossing', ['2026-06-14', '2026-06-15', '2026-06-16', '2026-06-17', '2026-06-18']);
  assert.deepEqual(shapes.map((shape) => [shape.date, shape.nature]), [
    ['2026-06-15', 'computed-hourly'], ['2026-06-16', 'computed-hourly'], ['2026-06-17', 'computed-hourly'],
  ], 'J0 à J+2 seulement');
  assert.equal(Math.round(shapes[0].shares.reduce((total, share) => total + share, 0) * 1e9), 1e9);
  const count = database.sqlite.prepare('SELECT count(*) AS n FROM irrigation_weather_day_shapes').get() as { n: number };
  assert.equal(count.n, 3);
});

test('la purge du matin garde 8 jours : la forme d’il y a 9 jours part, celle d’il y a 8 jours reste', async () => {
  await writeDayShapes({ placeKey: PLACE, source: 'visual-crossing', fetchedAt: 'x', rows: [row('2026-06-06'), row('2026-06-07'), row('2026-06-15')] });
  const report = await runRetentionPurges({ now: MORNING, log: () => undefined });
  assert.equal(report.failures.length, 0);
  assert.deepEqual((await listDayShapes(PLACE, 'visual-crossing', ['2026-06-06', '2026-06-07', '2026-06-15'])).map((shape) => shape.date), ['2026-06-07', '2026-06-15']);
});

test('les plans connaissent la table : conservation avec sa purge, gardée hors de l’effacement d’une ferme avec sa raison, inventaire', () => {
  assert.equal(RETENTION_PLAN.irrigation_weather_day_shapes.purge, 'day < ?');
  assert.ok(!SPACE_TABLES.some(({ table }) => table === 'irrigation_weather_day_shapes'), 'aucune ligne n’est d’une ferme');
  assert.match(KEPT_TABLES.irrigation_weather_day_shapes ?? '', /aucune ligne d'une ferme/);
  assert.match(OUTSIDE_JOURNAL.irrigation_weather_day_shapes ?? '', /forme de la journée/);
});

/** Une ferme à Vannes, sans planche : la page « Aujourd'hui » n'a besoin que du lieu et de l'ET0 du jour. */
const SNAPSHOT: IrrigationSnapshot = {
  configuration: { seasonFirst: 2026, seasonLast: 2026 },
  structure: { id: '17', name: 'Ferme', legalCity: 'Vannes', legalPostcode: '56000', legalCountry: 'FR' },
  zones: [],
  plots: [],
  beds: [],
  source: 'cache',
  lastSuccessfulReadAt: '2026-06-14T00:00:00.000Z',
};
/** Midi à Paris, le 15 juin 2026. */
const NOON = new Date('2026-06-15T10:00:00.000Z');

async function vannesFarm(owner: string, source: string) {
  await saveWeatherPreferenceForUser(owner, { locationMode: 'custom', customCity: 'Vannes', customPostcode: '56000' });
  await saveWeatherGeocodeForUser(owner, VANNES, candidate, 'open-meteo');
  await upsertWeatherDailyValuesForUser(owner, VANNES, 'forecast', [{ date: '2026-06-15', precipitationMm: 0, et0Mm: 2.4 }], source, MORNING.toISOString());
}

test('HR3 : « Aujourd’hui » lit la forme du lieu pour la source de l’ET0 du jour de la ferme, jamais celle d’un autre modèle', async () => {
  const peaked = flat().map((_, hour) => (hour >= 8 && hour < 18 ? 0.1 : 0));
  await writeDayShapes({ placeKey: PLACE, source: 'open-meteo:meteofrance_seamless', fetchedAt: MORNING.toISOString(), rows: [row('2026-06-15', 'provider-hourly', peaked)] });
  await writeDayShapes({ placeKey: PLACE, source: 'visual-crossing', fetchedAt: MORNING.toISOString(), rows: [row('2026-06-15', 'computed-hourly')] });
  assert.deepEqual((await listDayShapesOfDay(PLACE, '2026-06-15')).map((shape) => shape.source), ['open-meteo:meteofrance_seamless', 'visual-crossing']);

  await vannesFarm(ALICE, 'open-meteo:meteofrance_seamless');
  const alice = await getTodayViewForUser({ ownerUserId: ALICE, season: 2026, snapshot: SNAPSHOT, enabled: [...FEATURE_IDS], now: NOON });
  assert.equal(alice.dayCurve?.state, 'shown');
  assert.ok(alice.dayCurve?.state === 'shown');
  assert.equal(alice.dayCurve.nature, 'provider-hourly');
  assert.equal(alice.dayCurve.strongest, 'Évaporation la plus forte entre 8 h et 18 h');
  assert.equal(alice.dayCurve.sentence, 'D’ici ce soir, il reste environ 1,4 mm à consommer sur 2,4 mm.');

  // Bob, au même lieu, lit avec « Automatique » (Visual Crossing) : la forme calculée à l’heure, la sienne.
  await vannesFarm(BOB, 'visual-crossing');
  const bob = await getTodayViewForUser({ ownerUserId: BOB, season: 2026, snapshot: SNAPSHOT, enabled: [...FEATURE_IDS], now: NOON });
  assert.ok(bob.dayCurve?.state === 'shown');
  assert.equal(bob.dayCurve.nature, 'computed-hourly');
  assert.equal(bob.dayCurve.sentence, 'D’ici ce soir, il reste environ 1,2 mm à consommer sur 2,4 mm.');
});

test('HR3 : sans forme écrite, la forme théorique ; sans ET0 du jour, pas de courbe ; « Objectifs et besoins » décochée ne la lit pas', async () => {
  await vannesFarm(ALICE, 'open-meteo:meteofrance_seamless');
  const theoretical = await getTodayViewForUser({ ownerUserId: ALICE, season: 2026, snapshot: SNAPSHOT, enabled: [...FEATURE_IDS], now: NOON });
  assert.ok(theoretical.dayCurve?.state === 'shown');
  assert.equal(theoretical.dayCurve.nature, 'theoretical');
  assert.match(theoretical.dayCurve.sentence, /d’après la forme théorique du soleil\.$/);

  const tomorrow = await getTodayViewForUser({ ownerUserId: ALICE, season: 2026, snapshot: SNAPSHOT, enabled: [...FEATURE_IDS], now: new Date('2026-06-16T10:00:00.000Z') });
  assert.deepEqual(tomorrow.dayCurve && { state: tomorrow.dayCurve.state, text: 'text' in tomorrow.dayCurve ? tomorrow.dayCurve.text : null }, { state: 'missing', text: 'Pas de courbe : l’ET0 du jour manque.' });

  const withoutNeeds = await getTodayViewForUser({ ownerUserId: ALICE, season: 2026, snapshot: SNAPSHOT, enabled: FEATURE_IDS.filter((feature) => feature !== 'besoins'), now: NOON });
  assert.equal(withoutNeeds.dayCurve, null);
});
