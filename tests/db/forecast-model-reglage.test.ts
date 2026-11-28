import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { automaticWeatherRepository, listAutomaticWeatherTargets } from '../../db/automatic-weather-repository';
import { listChangeJournalForUser } from '../../db/change-journal/read';
import { SPACE_TABLES } from '../../db/farm-erasure-plan';
import { requestFarmErasure } from '../../db/farm-erasure-repository';
import { listForecastArchive } from '../../db/forecast-archive-repository';
import { returnForecastModelToAutomatic, saveForecastModelForUser } from '../../db/forecast-model-repository';
import {
  listWeatherDailyValuesForUser,
  readWeatherPreferenceForUser,
  saveWeatherGeocodeForUser,
  saveWeatherPreferenceForUser,
  upsertWeatherDailyValuesForUser,
} from '../../db/water-management-repository';
import { listWeatherAlertForecastDays } from '../../db/weather-alert-repository';
import { findWorkspaceIdForUser } from '../../db/workspace-repository';
import { changeJournalCard } from '../../lib/domain/change-journal/card';
import type { ChangeJournalEntry } from '../../lib/domain/change-journal/entry';
import type { IrrigationSnapshot } from '../../lib/domain/domain';
import { addDaysToDateKey } from '../../lib/domain/water-management';
import { forecastModelChoiceMessage } from '../../lib/domain/weather/forecast-model-choice';
import { COMPLETION_FORECAST_MODEL_ID, forecastModelSource, type ModelForecastDay, type ModelForecastReader } from '../../lib/domain/weather/forecast-models';
import { customWeatherLocationKey } from '../../lib/domain/weather/location';
import { evaluateWeatherAlertCriterion } from '../../lib/domain/weather/weather-alerts';
import { WeatherProviderError, type WeatherDailyValue, type WeatherProvider, type WeatherReadInput } from '../../lib/domain/weather/weather-provider';
import { buildInsertStatements, quoteIdentifier } from '../../lib/services/d1-export-import';
import { runDueFarmErasures } from '../../lib/services/farm-erasure';
import { getWaterDashboardForUser } from '../../lib/services/water-dashboard';
import { weatherAttribution } from '../../lib/services/weather/configured-provider';
import { runAutomaticWeatherSync } from '../../lib/services/weather/automatic-sync';
import { saveForecastModelChoiceForUser } from '../../lib/services/weather/forecast-model-choice';
import { fieldsWithoutWords } from '../support/change-journal-words';
import { applyMigrationsAfter, createMigratedSqliteDatabase, installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { ALICE, BOB } from '../support/spaces';

/**
 * La météo multi-modèles, PR 2, sur la base de test (docs/weather-models-contract.md,
 * § 3 règles 1, 2, 6 à 9, 11 et 12, § 6, § 8 points 3, 4, 5 et 7 ; D-346 ;
 * migration 0053) : la colonne du réglage, ses écritures et leur journal, la
 * règle « jamais un mélange », la lecture par lieu et par modèle de la tâche
 * du matin et de l'écran, et l'enregistrement vérifié. Chaque ferme ne voit
 * que ses lignes : le contrôle de cohérence des espaces relit la base après
 * chaque test, et `pnpm test` rejoue le fichier dans les trois passages
 * d'isolation.
 */

const METEO_FRANCE = 'meteofrance_seamless';
const ICON = 'icon_seamless';
const BOURGES = customWeatherLocationKey('Bourges', '18000');
const MONTREAL = customWeatherLocationKey('Montréal', 'H2X');
const place = (city: string, postcode: string, latitude: number, longitude: number) => ({ displayName: city, city, postcode, latitude, longitude, timezone: 'Europe/Paris', countryCode: 'FR' });

/** Jeudi 26 novembre 2026, 6 h 15 à Paris : la tâche du matin ; 10 h : le choix à l'écran. */
const WEDNESDAY = new Date('2026-11-25T05:15:00.000Z');
const MORNING = new Date('2026-11-26T05:15:00.000Z');
const TEN = new Date('2026-11-26T09:00:00.000Z');

const SNAPSHOT: IrrigationSnapshot = {
  configuration: { seasonFirst: 2026, seasonLast: 2026 },
  structure: { id: '4394', name: 'Ferme v2', legalCity: 'Saint-Aubin', legalPostcode: '03160', legalCountry: 'FR' },
  zones: [], plots: [], beds: [], source: 'cache', lastSuccessfulReadAt: '2026-11-26T05:00:00.000Z',
};

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

async function farmAt(owner: string, where: 'Bourges' | 'Montréal'): Promise<string> {
  const [city, postcode, key, latitude, longitude] = where === 'Bourges'
    ? ['Bourges', '18000', BOURGES, 47.08, 2.4] as const
    : ['Montréal', 'H2X', MONTREAL, 45.5, -73.57] as const;
  await saveWeatherPreferenceForUser(owner, { locationMode: 'custom', customCity: city, customPostcode: postcode });
  await saveWeatherGeocodeForUser(owner, key, place(city, postcode, latitude, longitude), 'open-meteo');
  return (await findWorkspaceIdForUser(owner))!;
}

/** « Automatique » : Visual Crossing, J0 à J+14, la même pluie chaque jour, températures comprises. */
class AutomaticProvider implements WeatherProvider {
  readonly id = 'visual-crossing';
  forecastCalls = 0;
  failing = false;
  rainMm: number;
  constructor(rainMm = 5) {
    this.rainMm = rainMm;
  }
  async searchLocations() { return []; }
  async readForecast(input: WeatherReadInput): Promise<WeatherDailyValue[]> {
    this.forecastCalls += 1;
    if (this.failing) throw new WeatherProviderError('panne', { kind: 'network', endpoint: 'forecast' });
    const days: WeatherDailyValue[] = [];
    for (let date = input.startDate; date <= input.endDate; date = addDaysToDateKey(date, 1)) {
      days.push({ date, precipitationMm: this.rainMm, et0Mm: 1.5, minimumTemperatureCelsius: 2, maximumTemperatureCelsius: 11, solarEnergyMegajoulesPerSquareMeter: 6 });
    }
    return days;
  }
  async readReanalysis() { return []; }
}

/**
 * Un lecteur de modèles : quatre jours du modèle (1 mm, sans ET0 ni
 * températures, que le modèle ne donnerait pas), puis « Automatique
 * d'Open-Meteo » (2 mm). `failure` fait échouer la lecture ; `noRain` ne
 * rend que des jours complétés.
 */
class ModelReader implements ModelForecastReader {
  calls: { modelId: string; startDate: string; endDate: string }[] = [];
  failure: WeatherProviderError | null = null;
  noRain = false;
  async readModelForecast(input: WeatherReadInput, modelId: string): Promise<ModelForecastDay[]> {
    this.calls.push({ modelId, startDate: input.startDate, endDate: input.endDate });
    if (this.failure) throw this.failure;
    const days: ModelForecastDay[] = [];
    for (let date = input.startDate, index = 0; date <= input.endDate; date = addDaysToDateKey(date, 1), index += 1) {
      days.push(index < 4 && !this.noRain
        ? { date, precipitationMm: 1, et0Mm: null, minimumTemperatureCelsius: null, maximumTemperatureCelsius: null, solarEnergyMegajoulesPerSquareMeter: null, source: forecastModelSource(modelId) }
        : { date, precipitationMm: 2, et0Mm: 0.5, minimumTemperatureCelsius: 3, maximumTemperatureCelsius: 9, solarEnergyMegajoulesPerSquareMeter: 4, source: forecastModelSource(COMPLETION_FORECAST_MODEL_ID) });
    }
    return days;
  }
}

const sync = (provider: WeatherProvider, now: Date, modelReader: ModelForecastReader | null = null) => runAutomaticWeatherSync({
  repository: automaticWeatherRepository, provider, modelReader, now, retry: { sleep: async () => undefined }, log: () => undefined,
});

const choose = (owner: string, modelId: string | null, options: { now?: Date; provider?: WeatherProvider; modelReader?: ModelForecastReader | null } = {}) => saveForecastModelChoiceForUser({
  ownerUserId: owner,
  snapshot: SNAPSHOT,
  modelId,
  now: options.now ?? TEN,
  provider: options.provider ?? new AutomaticProvider(),
  modelReader: options.modelReader === undefined ? new ModelReader() : options.modelReader,
  retry: { sleep: async () => undefined },
  log: () => undefined,
});

/** Les prévisions d'une ferme : [jour, pluie, ET0, minimum, source]. */
async function forecastRows(owner: string, key = BOURGES, from = '2026-11-25', to = '2026-12-10') {
  return (await listWeatherDailyValuesForUser(owner, key, from, to))
    .filter((row) => row.dataKind === 'forecast')
    .map((row) => [row.date, row.precipitationMm, row.et0Mm, row.minimumTemperatureCelsius ?? null, row.source]);
}

async function journal(owner: string): Promise<ChangeJournalEntry[]> {
  const entries = (await listChangeJournalForUser(owner, { limit: 200 })).filter((entry) => entry.subject === 'modele-meteo');
  assert.deepEqual(fieldsWithoutWords(entries), []);
  return entries.sort((left, right) => left.sequence - right.sequence);
}

const PREFERENCE_COLUMNS = `SELECT name, "notnull" AS required, dflt_value AS fallback FROM pragma_table_info('irrigation_weather_preferences') WHERE name = 'forecast_model'`;

// --- Persistance (§ 8.4) ---------------------------------------------------------------

test('migration 0053 : une colonne qui accepte « Automatique » (vide), la forme d’un identifiant seulement ; rien d’existant ne change', () => {
  const before = createMigratedSqliteDatabase('drizzle', '0052_off_season_revisions.sql');
  before.exec(`INSERT INTO irrigation_workspaces (id, owner_user_id) VALUES ('ferme-a', 'alice'), ('ferme-b', 'bob')`);
  before.exec(`INSERT INTO irrigation_weather_preferences (workspace_id, location_mode, custom_city, custom_postcode, last_successful_refresh_at, updated_at)
    VALUES ('ferme-a', 'custom', 'Bourges', '18000', '2026-11-25T05:15:00.000Z', '2026-11-25T05:15:00.000Z'), ('ferme-b', 'otf', NULL, NULL, NULL, '2026-11-20T10:00:00.000Z')`);
  const rows = () => before.prepare('SELECT * FROM irrigation_weather_preferences ORDER BY workspace_id').all() as Record<string, unknown>[];
  const existing = rows();
  applyMigrationsAfter(before, '0052_off_season_revisions.sql', 'drizzle', '0053_weather_forecast_model.sql');
  assert.deepEqual(rows().map(({ forecast_model: model, ...rest }) => [model, rest]), existing.map((row) => [null, { ...row }]), 'les lignes existantes restent, en « Automatique » (règle 1)');
  assert.deepEqual({ ...(before.prepare(PREFERENCE_COLUMNS).get() as object) }, { name: 'forecast_model', required: 0, fallback: null });
  before.prepare(`UPDATE irrigation_weather_preferences SET forecast_model = ? WHERE workspace_id = 'ferme-a'`).run(METEO_FRANCE);
  for (const refused of ['Meteo-France', 'icon seamless', '', 'x'.repeat(65), 'arome;drop']) {
    assert.throws(() => before.prepare(`UPDATE irrigation_weather_preferences SET forecast_model = ? WHERE workspace_id = 'ferme-b'`).run(refused), /CHECK constraint failed/, refused);
  }
  before.close();
  const empty = createMigratedSqliteDatabase();
  assert.deepEqual({ ...(empty.prepare(PREFERENCE_COLUMNS).get() as object) }, { name: 'forecast_model', required: 0, fallback: null }, 'sur une base vide aussi');
  empty.close();
});

test('le réglage s’enregistre avec sa ligne du journal ; le même modèle n’écrit rien ; chaque ferme lit le sien', async () => {
  await farmAt(ALICE, 'Bourges');
  await farmAt(BOB, 'Bourges');
  assert.equal((await readWeatherPreferenceForUser(ALICE)).forecastModel, null, '« Automatique » par défaut');
  assert.equal(await saveForecastModelForUser(ALICE, METEO_FRANCE, '2026-11-26T09:00:00.000Z'), true);
  assert.equal(await saveForecastModelForUser(ALICE, METEO_FRANCE, '2026-11-26T09:05:00.000Z'), false, 'rien ne change');
  assert.equal(await saveForecastModelForUser(BOB, ICON, '2026-11-26T09:10:00.000Z'), true);
  assert.equal((await readWeatherPreferenceForUser(ALICE)).forecastModel, METEO_FRANCE);
  assert.equal((await readWeatherPreferenceForUser(BOB)).forecastModel, ICON);
  const targets = await listAutomaticWeatherTargets();
  const alice = await findWorkspaceIdForUser(ALICE);
  assert.deepEqual(targets.map((entry) => [entry.workspaceId === alice ? 'alice' : 'bob', entry.forecastModel]).sort(), [['alice', METEO_FRANCE], ['bob', ICON]]);

  const entries = await journal(ALICE);
  assert.deepEqual(entries.map((entry) => [entry.action, entry.before, entry.after, entry.actorUserId === ALICE]), [['modifie', { forecastModel: null }, { forecastModel: METEO_FRANCE }, true]]);
  const card = changeJournalCard(entries[0], { viewerUserId: ALICE, nameOf: () => null });
  assert.deepEqual([card.who, card.subject, card.lines], ['Vous', 'Modèle de prévision', [{ label: 'Modèle de prévision', text: '« Automatique » → Météo-France (AROME puis ARPEGE)' }]]);
  assert.equal((await journal(BOB)).length, 1, 'le choix de Bob reste à Bob');
});

test('règle 9 : le module ramène la ferme à « Automatique » seulement si elle a encore ce modèle, et le dit au journal', async () => {
  const alice = await farmAt(ALICE, 'Bourges');
  await saveForecastModelForUser(ALICE, METEO_FRANCE, '2026-11-26T09:00:00.000Z');
  assert.equal(await returnForecastModelToAutomatic({ workspaceId: alice, savedModelId: ICON, at: '2026-11-27T05:15:00.000Z' }), false, 'la personne a choisi un autre modèle entre-temps : il reste');
  assert.equal((await readWeatherPreferenceForUser(ALICE)).forecastModel, METEO_FRANCE);
  assert.equal(await returnForecastModelToAutomatic({ workspaceId: alice, savedModelId: METEO_FRANCE, at: '2026-11-27T05:15:00.000Z' }), true);
  assert.equal(await returnForecastModelToAutomatic({ workspaceId: alice, savedModelId: METEO_FRANCE, at: '2026-11-27T05:16:00.000Z' }), false, 'une fois');
  assert.equal((await readWeatherPreferenceForUser(ALICE)).forecastModel, null);
  const entries = await journal(ALICE);
  assert.equal(entries.length, 2, 'le choix de la personne, puis le retour du module ; rien pour les deux appels sans effet');
  const card = changeJournalCard(entries[1], { viewerUserId: ALICE, nameOf: () => null });
  assert.deepEqual([card.who, card.lines[0].text], ['Le module', 'Météo-France (AROME puis ARPEGE) → « Automatique »']);
});

test('jamais un mélange (règle 6, F1016) : à source égale une réponse partielle garde les champs connus ; une autre source remplace le jour entier', async () => {
  await farmAt(ALICE, 'Bourges');
  await farmAt(BOB, 'Bourges');
  const full = { date: '2026-11-27', precipitationMm: 4, et0Mm: 1.5, minimumTemperatureCelsius: 2, maximumTemperatureCelsius: 11, solarEnergyMegajoulesPerSquareMeter: 6 };
  for (const owner of [ALICE, BOB]) await upsertWeatherDailyValuesForUser(owner, BOURGES, 'forecast', [full], 'visual-crossing', '2026-11-26T05:15:00.000Z');
  await upsertWeatherDailyValuesForUser(ALICE, BOURGES, 'forecast', [{ date: '2026-11-27', precipitationMm: 3, et0Mm: null }], 'visual-crossing', '2026-11-26T08:00:00.000Z');
  const read = async (owner: string) => (await listWeatherDailyValuesForUser(owner, BOURGES, '2026-11-27', '2026-11-27')).map((row) => [row.precipitationMm, row.et0Mm, row.minimumTemperatureCelsius, row.source, row.fetchedAt]);
  assert.deepEqual(await read(ALICE), [[3, 1.5, 2, 'visual-crossing', '2026-11-26T05:15:00.000Z']], 'comme avant : l’ET0 connue reste, avec l’instant de la lecture qui l’a donnée');
  await upsertWeatherDailyValuesForUser(ALICE, BOURGES, 'forecast', [{ date: '2026-11-27', precipitationMm: 1, et0Mm: null, minimumTemperatureCelsius: null }], forecastModelSource(METEO_FRANCE), '2026-11-26T09:00:00.000Z');
  assert.deepEqual(await read(ALICE), [[1, null, null, 'open-meteo:meteofrance_seamless', '2026-11-26T09:00:00.000Z']], 'ni l’ET0 ni la température de Visual Crossing sous la source du modèle');
  assert.deepEqual(await read(BOB), [[4, 1.5, 2, 'visual-crossing', '2026-11-26T05:15:00.000Z']], 'la ligne de Bob, au même lieu et au même jour, ne bouge pas');
});

test('export, import et effacement : la colonne suit la ligne de la ferme ; l’effacement d’une ferme garde le réglage des autres', async () => {
  await farmAt(ALICE, 'Bourges');
  await farmAt(BOB, 'Bourges');
  await saveForecastModelForUser(ALICE, METEO_FRANCE, '2026-11-26T09:00:00.000Z');
  await saveForecastModelForUser(BOB, ICON, '2026-11-26T09:00:00.000Z');
  assert.ok(SPACE_TABLES.some(({ table }) => table === 'irrigation_weather_preferences'), 'au plan d’effacement');
  // L'export et l'import de la base (lib/services/d1-export-import.ts), table par table, colonnes explicites.
  const exported = (name: string) => ({
    name,
    columns: (database.sqlite.prepare(`PRAGMA table_info(${quoteIdentifier(name)})`).all() as { name: string }[]).map((column) => column.name),
    rows: database.sqlite.prepare(`SELECT * FROM ${quoteIdentifier(name)}`).all() as Record<string, string | number | null>[],
  });
  const preferences = exported('irrigation_weather_preferences');
  assert.equal(preferences.columns.length, 13, 'comptes de colonnes : les douze d’avant, plus le modèle');
  const copy = createMigratedSqliteDatabase();
  for (const statement of [...buildInsertStatements(exported('irrigation_workspaces')), ...buildInsertStatements(preferences)]) copy.exec(statement);
  const imported = copy.prepare('SELECT forecast_model AS model FROM irrigation_weather_preferences ORDER BY model').all() as { model: string | null }[];
  assert.deepEqual(imported.map((row) => row.model), [ICON, METEO_FRANCE], 'le réglage de chaque ferme passe l’export puis l’import');
  copy.close();
  await requestFarmErasure(ALICE, new Date('2026-11-26T10:00:00.000Z'));
  const report = await runDueFarmErasures({ now: new Date('2026-12-04T05:15:00.000Z'), log: () => undefined });
  assert.equal(report.erased, 1);
  assert.equal((await readWeatherPreferenceForUser(BOB)).forecastModel, ICON);
  assert.equal(await findWorkspaceIdForUser(ALICE), null);
});

// --- Lecture par lieu et par modèle (§ 8.3) ------------------------------------------------

test('tâche du matin : deux fermes au même lieu, deux modèles, deux lectures ; chacune écrit ses lignes, sous leur source, et sa photographie', async () => {
  const alice = await farmAt(ALICE, 'Bourges');
  const bob = await farmAt(BOB, 'Bourges');
  await saveForecastModelForUser(ALICE, METEO_FRANCE, '2026-11-25T09:00:00.000Z');
  const provider = new AutomaticProvider();
  const reader = new ModelReader();
  const result = await sync(provider, MORNING, reader);
  assert.deepEqual([provider.forecastCalls, reader.calls.map((call) => call.modelId), result.forecastRequests, result.locations], [1, [METEO_FRANCE], 2, 1]);
  assert.deepEqual((await forecastRows(ALICE)).slice(0, 5), [
    ['2026-11-26', 1, null, null, 'open-meteo:meteofrance_seamless'],
    ['2026-11-27', 1, null, null, 'open-meteo:meteofrance_seamless'],
    ['2026-11-28', 1, null, null, 'open-meteo:meteofrance_seamless'],
    ['2026-11-29', 1, null, null, 'open-meteo:meteofrance_seamless'],
    ['2026-11-30', 2, 0.5, 3, 'open-meteo:best_match'],
  ]);
  assert.ok((await forecastRows(BOB)).every((row) => row[1] === 5 && row[4] === 'visual-crossing'), 'Bob, en « Automatique », lit comme avant');
  const archive = await listForecastArchive(alice, BOURGES, { startDate: '2026-01-01', endDate: '2027-12-31' });
  assert.deepEqual(archive.map((row) => [row.targetDate, row.source]), [
    ['2026-11-27', 'open-meteo:meteofrance_seamless'], ['2026-11-28', 'open-meteo:meteofrance_seamless'], ['2026-11-29', 'open-meteo:meteofrance_seamless'],
    ['2026-11-30', 'open-meteo:best_match'], ['2026-12-01', 'open-meteo:best_match'], ['2026-12-02', 'open-meteo:best_match'], ['2026-12-03', 'open-meteo:best_match'],
  ], 'l’archive dit, jour par jour, qui a donné la prévision');
  assert.ok((await listForecastArchive(bob, BOURGES, { startDate: '2026-01-01', endDate: '2027-12-31' })).every((row) => row.source === 'visual-crossing'));
});

test('tâche du matin, règle 9 : un modèle qui ne couvre pas le lieu ramène la ferme à « Automatique », dit « Le module », et elle lit « Automatique »', async () => {
  await farmAt(ALICE, 'Montréal');
  await saveForecastModelForUser(ALICE, METEO_FRANCE, '2026-11-25T09:00:00.000Z');
  const reader = new ModelReader();
  await sync(new AutomaticProvider(), MORNING, reader);
  assert.deepEqual(reader.calls, []);
  assert.equal((await readWeatherPreferenceForUser(ALICE)).forecastModel, null);
  assert.ok((await forecastRows(ALICE, MONTREAL)).every((row) => row[4] === 'visual-crossing'));
  const entries = await journal(ALICE);
  assert.equal(changeJournalCard(entries.at(-1)!, { viewerUserId: ALICE, nameOf: () => null }).who, 'Le module');
});

// --- L'enregistrement vérifié (§ 8.5) -------------------------------------------------------

test('règle 8 : une lecture en échec, ou sans la pluie du modèle, n’enregistre rien et dit pourquoi ; la ferme garde son réglage et ses lignes', async () => {
  await farmAt(ALICE, 'Bourges');
  await sync(new AutomaticProvider(), MORNING);
  const before = await forecastRows(ALICE);
  const reader = new ModelReader();
  reader.failure = new WeatherProviderError('Too many requests', { kind: 'rate-limit', status: 429, endpoint: 'forecast' });
  const limited = await choose(ALICE, METEO_FRANCE, { modelReader: reader });
  assert.deepEqual(limited, { kind: 'not-proved', reason: 'rate-limit' });
  assert.match(forecastModelChoiceMessage(limited), /limite les lectures.*rien n’est enregistré, la ferme garde son réglage actuel/);
  const dry = new ModelReader();
  dry.noRain = true;
  assert.deepEqual(await choose(ALICE, METEO_FRANCE, { modelReader: dry, now: new Date('2026-11-26T09:01:00.000Z') }), { kind: 'not-proved', reason: 'no-rain' });
  assert.equal((await readWeatherPreferenceForUser(ALICE)).forecastModel, null);
  assert.deepEqual(await journal(ALICE), [], 'aucune ligne au journal');
  assert.deepEqual(await forecastRows(ALICE), before, 'aucune ligne réécrite');
  assert.equal((await readWeatherPreferenceForUser(ALICE)).lastRefreshError, null, 'l’état de la météo de la ferme ne change pas');
});

test('règle 11 : un modèle vérifié remplace les prévisions d’aujourd’hui et des jours suivants ; les jours passés et l’archive restent', async () => {
  const alice = await farmAt(ALICE, 'Bourges');
  await sync(new AutomaticProvider(4), WEDNESDAY);
  await sync(new AutomaticProvider(5), MORNING);
  const archiveBefore = await listForecastArchive(alice, BOURGES, { startDate: '2026-01-01', endDate: '2027-12-31' });
  const reader = new ModelReader();
  const outcome = await choose(ALICE, METEO_FRANCE, { modelReader: reader });
  assert.equal(outcome.kind, 'saved');
  assert.deepEqual(reader.calls, [{ modelId: METEO_FRANCE, startDate: '2026-11-26', endDate: '2026-12-10' }], 'une lecture immédiate, à partir d’aujourd’hui, sans la réanalyse');
  assert.equal(forecastModelChoiceMessage(outcome), 'La ferme lit désormais « Météo-France (AROME puis ARPEGE) » : ses prévisions à venir sont relues, les jours passés gardent les leurs. Après le dim. 29 nov., les jours viennent d’« Automatique d’Open-Meteo ».');
  const rows = await forecastRows(ALICE);
  assert.deepEqual(rows[0], ['2026-11-25', 4, 1.5, 2, 'visual-crossing'], 'hier garde sa ligne et sa source');
  assert.deepEqual(rows.slice(1, 3), [['2026-11-26', 1, null, null, 'open-meteo:meteofrance_seamless'], ['2026-11-27', 1, null, null, 'open-meteo:meteofrance_seamless']]);
  assert.ok(rows.slice(5).every((row) => row[4] === 'open-meteo:best_match'), 'au-delà de sa portée, « Automatique d’Open-Meteo »');
  assert.deepEqual(await listForecastArchive(alice, BOURGES, { startDate: '2026-01-01', endDate: '2027-12-31' }), archiveBefore, 'l’archive n’est jamais réécrite');
  assert.equal((await readWeatherPreferenceForUser(ALICE)).forecastModel, METEO_FRANCE);
  assert.equal((await journal(ALICE)).length, 1);
});

test('refus avant toute lecture, délai entre deux enregistrements, et « Automatique » qui ne se prouve pas', async () => {
  await farmAt(BOB, 'Montréal');
  const reader = new ModelReader();
  assert.deepEqual(await choose(ALICE, METEO_FRANCE, { modelReader: reader }), { kind: 'refused', reason: 'no-place' }, 'aucune commune localisée');
  assert.deepEqual(await choose(BOB, METEO_FRANCE, { modelReader: reader }), { kind: 'refused', reason: 'outside-zone' });
  assert.deepEqual(await choose(BOB, 'modele_inconnu', { modelReader: reader }), { kind: 'refused', reason: 'not-offered' });
  assert.deepEqual(await choose(BOB, ICON, { modelReader: null }), { kind: 'refused', reason: 'absent' }, 'démonstration');
  assert.deepEqual(reader.calls, [], 'aucune lecture pour un refus');

  await farmAt(ALICE, 'Bourges');
  assert.equal((await choose(ALICE, METEO_FRANCE, { modelReader: reader })).kind, 'saved');
  assert.deepEqual(await choose(ALICE, METEO_FRANCE, { modelReader: reader, now: new Date('2026-11-26T09:20:00.000Z') }), { kind: 'unchanged', modelId: METEO_FRANCE });
  assert.deepEqual(await choose(ALICE, ICON, { modelReader: reader, now: new Date('2026-11-26T09:00:10.000Z') }), { kind: 'refused', reason: 'too-soon' }, 'dix secondes après : le délai de la ferme');
  assert.equal(reader.calls.length, 1);

  const provider = new AutomaticProvider();
  provider.failing = true;
  const back = await choose(ALICE, null, { modelReader: reader, provider, now: new Date('2026-11-26T09:00:31.000Z') });
  assert.deepEqual(back, { kind: 'saved', modelId: null, days: [] }, '« Automatique » s’enregistre même si sa lecture échoue');
  assert.match(forecastModelChoiceMessage(back), /seront relues à la prochaine lecture/);
  assert.equal((await readWeatherPreferenceForUser(ALICE)).forecastModel, null);
  const again = await choose(ALICE, ICON, { modelReader: reader, now: new Date('2026-11-26T09:01:10.000Z') });
  assert.equal(again.kind, 'saved');
  const automatic = await choose(ALICE, null, { modelReader: reader, now: new Date('2026-11-26T09:02:00.000Z') });
  assert.equal(automatic.kind, 'saved');
  assert.ok((await forecastRows(ALICE, BOURGES, '2026-11-26')).every((row) => row[4] === 'visual-crossing'), 'le retour à « Automatique » relit les jours à venir');
  assert.deepEqual((await journal(ALICE)).map((entry) => entry.after?.forecastModel ?? null), [METEO_FRANCE, null, ICON, null]);
});

// --- L'actualisation à l'écran -------------------------------------------------------------

test('à l’écran : la ferme lit son modèle et le crédite ; un modèle hors du lieu revient à « Automatique » avant la lecture', async () => {
  await farmAt(ALICE, 'Bourges');
  await saveForecastModelForUser(ALICE, ICON, '2026-11-25T09:00:00.000Z');
  const reader = new ModelReader();
  const provider = new AutomaticProvider();
  const dashboard = await getWaterDashboardForUser({ ownerUserId: ALICE, season: 2026, snapshot: SNAPSHOT, now: TEN, provider, modelReader: reader, forceWeatherRefresh: true, includeForecastModelSetting: true });
  assert.deepEqual(reader.calls.map((call) => call.modelId), [ICON]);
  // L'écran relit la semaine, que le modèle couvre : aucun jour complété à dire (règle 6 ; D-347).
  assert.deepEqual(dashboard.weather.forecastModelSetting, { completion: null, returnNotice: null });
  assert.equal(provider.forecastCalls, 0, 'la prévision vient du modèle ; la réanalyse, elle, du fournisseur');
  assert.match(dashboard.weather.attribution, /^Prévisions : DWD, par Open-Meteo/);
  // L'écran offre le réglage quand le déploiement lit les modèles (D-347).
  assert.equal(dashboard.weather.forecastModelsAvailable, true);
  assert.equal((await forecastRows(ALICE, BOURGES, '2026-11-26', '2026-11-26'))[0][4], 'open-meteo:icon_seamless');

  await farmAt(BOB, 'Montréal');
  await saveForecastModelForUser(BOB, METEO_FRANCE, '2026-11-25T09:00:00.000Z');
  const bobReader = new ModelReader();
  const bobDashboard = await getWaterDashboardForUser({ ownerUserId: BOB, season: 2026, snapshot: SNAPSHOT, now: TEN, provider, modelReader: bobReader, forceWeatherRefresh: true, includeForecastModelSetting: true });
  // Le retour du module se dit sur la carte de cette ferme seulement (règle 9 ; D-347).
  assert.deepEqual(bobDashboard.weather.forecastModelSetting, {
    completion: null,
    returnNotice: '« Météo-France (AROME puis ARPEGE) » ne couvre pas le lieu de la ferme : depuis le jeu. 26 nov., la ferme lit de nouveau « Automatique ».',
  });
  // Un jour complété au-delà, comme la tâche du matin l'écrit : la carte dit le dernier jour du modèle, chez Alice seulement.
  const completed = { date: '2026-11-30', precipitationMm: 2, et0Mm: 0.5, minimumTemperatureCelsius: 3, maximumTemperatureCelsius: 9 };
  await upsertWeatherDailyValuesForUser(ALICE, BOURGES, 'forecast', [completed], forecastModelSource(COMPLETION_FORECAST_MODEL_ID), TEN.toISOString());
  const aliceAgain = await getWaterDashboardForUser({ ownerUserId: ALICE, season: 2026, snapshot: SNAPSHOT, now: TEN, provider, modelReader: reader, includeForecastModelSetting: true });
  assert.deepEqual(aliceAgain.weather.forecastModelSetting, {
    completion: 'Prévisions gardées : ce modèle jusqu’au dim. 29 nov., puis « Automatique d’Open-Meteo ».',
    returnNotice: null,
  });
  assert.deepEqual(bobReader.calls, []);
  assert.equal((await readWeatherPreferenceForUser(BOB)).forecastModel, null);
  assert.equal(changeJournalCard((await journal(BOB)).at(-1)!, { viewerUserId: BOB, nameOf: () => null }).who, 'Le module');
  assert.equal(bobDashboard.weather.attribution, weatherAttribution(provider), '« Automatique » est crédité comme avant');
  // Sans lecteur des modèles (la démonstration, règle 13), l'écran n'offre pas le réglage (D-347).
  const withoutModels = await getWaterDashboardForUser({ ownerUserId: BOB, season: 2026, snapshot: SNAPSHOT, now: TEN, provider, modelReader: null });
  assert.equal(withoutModels.weather.forecastModelsAvailable, false);
  assert.equal(withoutModels.weather.forecastModelSetting, null, 'ni lecture de la carte');
});

// --- Alertes et besoins (§ 8.7) ---------------------------------------------------------------

test('à données égales, les mêmes alertes quel que soit le modèle : la règle ne lit pas la source (règle 12)', async () => {
  const alice = await farmAt(ALICE, 'Bourges');
  const bob = await farmAt(BOB, 'Bourges');
  const days = [
    { date: '2026-11-26', precipitationMm: 0, et0Mm: null, minimumTemperatureCelsius: 1.5, maximumTemperatureCelsius: 8 },
    { date: '2026-11-27', precipitationMm: 12, et0Mm: null, minimumTemperatureCelsius: 4, maximumTemperatureCelsius: 10 },
    { date: '2026-11-28', precipitationMm: 3, et0Mm: null, minimumTemperatureCelsius: -1, maximumTemperatureCelsius: 6 },
  ];
  await upsertWeatherDailyValuesForUser(ALICE, BOURGES, 'forecast', days, 'visual-crossing', '2026-11-26T05:15:00.000Z');
  await upsertWeatherDailyValuesForUser(BOB, BOURGES, 'forecast', days, forecastModelSource(METEO_FRANCE), '2026-11-26T05:15:00.000Z');
  const decisions = async (workspaceId: string) => {
    const forecasts = await listWeatherAlertForecastDays(workspaceId, BOURGES, '2026-11-26', '2026-11-28');
    return ([['minimum-temperature', 'below', 2], ['precipitation', 'above', 10]] as const).map(([field, direction, threshold]) => evaluateWeatherAlertCriterion({
      criterion: { field, direction, threshold, horizonDays: 3, active: true, label: null }, forecasts, today: '2026-11-26', alertedDates: new Set(),
    }));
  };
  const forAlice = await decisions(alice);
  assert.deepEqual(forAlice.map((evaluation) => evaluation.crossings.map((crossing) => crossing.date)), [['2026-11-26', '2026-11-28'], ['2026-11-27']]);
  assert.deepEqual(await decisions(bob), forAlice);
});
