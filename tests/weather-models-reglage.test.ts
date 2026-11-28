import assert from 'node:assert/strict';
import test from 'node:test';
import { demonstrationModelForecastReader, demonstrationWeatherProvider } from '../lib/adapters/weather/demonstration-provider.ts';
import { CHANGE_AUTHOR_MODULE, changeJournalCard } from '../lib/domain/change-journal/card.ts';
import { MODULE_ACTOR_ID, type ChangeJournalEntry } from '../lib/domain/change-journal/entry.ts';
import {
  forecastModelChoiceMessage,
  forecastModelChoiceRefusal,
  modelReadingProof,
  proofFailureOf,
  type ForecastModelChoiceOutcome,
} from '../lib/domain/weather/forecast-model-choice.ts';
import {
  COMPLETION_FORECAST_MODEL_ID,
  FORECAST_MODELS,
  forecastDaysBySource,
  forecastModel,
  forecastModelSource,
  forecastModelToRead,
  forecastReadingsAtPlace,
  resolveForecastModelChoice,
  type ModelForecastDay,
  type ModelForecastReader,
} from '../lib/domain/weather/forecast-models.ts';
import { WeatherProviderError, type WeatherDailyValue, type WeatherProvider, type WeatherReadInput } from '../lib/domain/weather/weather-provider.ts';
import { runAutomaticWeatherSync, type AutomaticWeatherSyncRepository, type AutomaticWeatherTarget } from '../lib/services/weather/automatic-sync.ts';
import { weatherAttribution } from '../lib/services/weather/configured-provider.ts';

/**
 * La météo multi-modèles, PR 2 : le réglage de la ferme et la lecture par lieu
 * et par modèle (docs/weather-models-contract.md, § 3 règles 1, 3, 6 à 10 et
 * 13, § 5, § 6, § 8 points 1, 3, 5 et 7 ; D-346). Ici, sans base : les règles
 * du domaine, la synchronisation avec un fournisseur et un lecteur factices,
 * la réponse fixe des parcours automatisés et l'attribution. La base est
 * éprouvée par `tests/db/forecast-model-reglage.test.ts`.
 */

const BOURGES = { latitude: 47.08, longitude: 2.4 };
const MONTREAL = { latitude: 45.5, longitude: -73.57 };
const METEO_FRANCE = 'meteofrance_seamless';
const ICON = 'icon_seamless';
const READ: WeatherReadInput = { ...BOURGES, timezone: 'Europe/Paris', startDate: '2026-11-26', endDate: '2026-12-10' };

const day = (date: string, precipitationMm: number | null, source?: string) => ({ date, precipitationMm, et0Mm: 1, ...(source ? { source } : {}) });

// --- Le domaine ---------------------------------------------------------------------

test('regroupement (§ 5) : une lecture par modèle au même lieu, « Automatique » à part, dans l’ordre de la première ferme', () => {
  const farms = [
    { id: 'a', model: null },
    { id: 'b', model: METEO_FRANCE },
    { id: 'c', model: ICON },
    { id: 'd', model: METEO_FRANCE },
    { id: 'e', model: null },
  ];
  const readings = forecastReadingsAtPlace(farms, (farm) => farm.model);
  assert.deepEqual(readings.map((reading) => [reading.modelId, reading.members.map((farm) => farm.id)]), [
    [null, ['a', 'e']],
    [METEO_FRANCE, ['b', 'd']],
    [ICON, ['c']],
  ], 'deux fermes de même modèle partagent une lecture ; deux modèles, deux lectures');
  assert.deepEqual(forecastReadingsAtPlace([], () => null), []);
});

test('ce que lit une ferme (règles 1, 9 et 13) : son modèle s’il est proposé, couvre le lieu et se lit ; sinon « Automatique »', () => {
  const model = resolveForecastModelChoice(METEO_FRANCE, BOURGES);
  assert.equal(forecastModelToRead(model, true), METEO_FRANCE);
  assert.equal(forecastModelToRead(model, false), null, 'un déploiement qui ne lit pas les modèles lit « Automatique »');
  assert.equal(forecastModelToRead(resolveForecastModelChoice(null, BOURGES), true), null);
  assert.equal(forecastModelToRead(resolveForecastModelChoice('modele_retire', BOURGES), true), null);
  assert.equal(forecastModelToRead(resolveForecastModelChoice(METEO_FRANCE, MONTREAL), true), null);
});

test('les jours rangés par source (§ 6) : un modèle choisi garde la sienne, un jour sans source prend celle du fournisseur', () => {
  const groups = forecastDaysBySource([
    day('2026-11-26', 1, forecastModelSource(METEO_FRANCE)),
    day('2026-11-27', 2, forecastModelSource(METEO_FRANCE)),
    day('2026-11-28', 3, forecastModelSource(COMPLETION_FORECAST_MODEL_ID)),
    day('2026-11-29', 4),
  ], 'visual-crossing');
  assert.deepEqual(groups.map((group) => [group.source, group.values.map((value) => value.date)]), [
    ['open-meteo:meteofrance_seamless', ['2026-11-26', '2026-11-27']],
    ['open-meteo:best_match', ['2026-11-28']],
    ['visual-crossing', ['2026-11-29']],
  ]);
  assert.ok(groups.every((group) => group.values.every((value) => !('source' in value))), 'la source vit dans la colonne, jamais dans la valeur écrite');
  assert.deepEqual(forecastDaysBySource([], 'visual-crossing'), []);
});

test('ce qui peut s’enregistrer (règles 1 et 3) : « Automatique » toujours ; un modèle proposé qui couvre le lieu localisé', () => {
  assert.equal(forecastModelChoiceRefusal(null, null), null, '« Automatique » sans lieu');
  assert.equal(forecastModelChoiceRefusal(METEO_FRANCE, BOURGES), null);
  assert.equal(forecastModelChoiceRefusal(COMPLETION_FORECAST_MODEL_ID, MONTREAL), null, '« Automatique d’Open-Meteo » couvre tout lieu');
  assert.equal(forecastModelChoiceRefusal('modele_inconnu', BOURGES), 'not-offered');
  assert.equal(forecastModelChoiceRefusal(METEO_FRANCE, null), 'no-place');
  assert.equal(forecastModelChoiceRefusal(METEO_FRANCE, MONTREAL), 'outside-zone');
  assert.equal(forecastModelChoiceRefusal(ICON, MONTREAL), 'outside-zone');
  for (const model of FORECAST_MODELS.filter((entry) => entry.zone === null)) {
    assert.equal(forecastModelChoiceRefusal(model.id, MONTREAL), null, `${model.id} : partout`);
  }
});

test('la preuve (règle 8) : au moins un jour avec la pluie du modèle lui-même ; un jour complété ou sans pluie ne prouve rien', () => {
  const own = forecastModelSource(METEO_FRANCE);
  const completed = forecastModelSource(COMPLETION_FORECAST_MODEL_ID);
  assert.equal(modelReadingProof(METEO_FRANCE, [day('2026-11-26', 0, own), day('2026-11-27', 2, completed)]), null, 'une pluie nulle (0 mm) est une valeur');
  assert.equal(modelReadingProof(METEO_FRANCE, [day('2026-11-26', 2, completed)]), 'no-rain', 'tout complété par « Automatique d’Open-Meteo »');
  assert.equal(modelReadingProof(METEO_FRANCE, [day('2026-11-26', null, own)]), 'no-rain', 'le jour du modèle sans pluie');
  assert.equal(modelReadingProof(METEO_FRANCE, []), 'no-rain', 'aucun jour');
  assert.equal(modelReadingProof(COMPLETION_FORECAST_MODEL_ID, [day('2026-11-26', 1, completed)]), null);
});

test('la classe d’une lecture en échec, jamais son message', () => {
  assert.equal(proofFailureOf('rate-limit'), 'rate-limit');
  assert.equal(proofFailureOf('client'), 'refused');
  assert.equal(proofFailureOf('invalid-response'), 'invalid-response');
  for (const kind of ['timeout', 'network', 'server', null] as const) assert.equal(proofFailureOf(kind), 'unavailable', String(kind));
});

test('les phrases du retour (règles 6, 8 et 10) : pourquoi rien n’est enregistré, et jusqu’où le modèle donne ses jours', () => {
  const own = forecastModelSource(METEO_FRANCE);
  const completed = forecastModelSource(COMPLETION_FORECAST_MODEL_ID);
  const saved = forecastModelChoiceMessage({ kind: 'saved', modelId: METEO_FRANCE, days: [day('2026-11-26', 1, own), day('2026-11-29', 1, own), day('2026-11-30', 1, completed)] });
  assert.equal(saved, 'La ferme lit désormais « Météo-France (AROME puis ARPEGE) » : ses prévisions à venir sont relues, les jours passés gardent les leurs. Après le dim. 29 nov., les jours viennent d’« Automatique d’Open-Meteo ».');
  assert.equal(
    forecastModelChoiceMessage({ kind: 'saved', modelId: COMPLETION_FORECAST_MODEL_ID, days: [day('2026-11-26', 1, completed)] }),
    'La ferme lit désormais « Automatique d’Open-Meteo » : ses prévisions à venir sont relues, les jours passés gardent les leurs.',
    'aucun jour complété pour « Automatique d’Open-Meteo » lui-même',
  );
  assert.match(forecastModelChoiceMessage({ kind: 'saved', modelId: null, days: [day('2026-11-26', 1)] }), /de nouveau « Automatique » : ses prévisions à venir sont relues/);
  assert.match(forecastModelChoiceMessage({ kind: 'saved', modelId: null, days: [] }), /seront relues à la prochaine lecture/);
  assert.equal(forecastModelChoiceMessage({ kind: 'unchanged', modelId: ICON }), 'La ferme lit déjà « DWD (ICON) » : rien ne change.');
  const failures: ForecastModelChoiceOutcome[] = [
    { kind: 'not-proved', reason: 'rate-limit' },
    { kind: 'not-proved', reason: 'unavailable' },
    { kind: 'not-proved', reason: 'refused' },
    { kind: 'not-proved', reason: 'invalid-response' },
    { kind: 'not-proved', reason: 'no-rain' },
    { kind: 'refused', reason: 'not-offered' },
    { kind: 'refused', reason: 'outside-zone' },
  ];
  for (const outcome of failures) assert.match(forecastModelChoiceMessage(outcome), /rien n’est enregistré, la ferme garde son réglage actuel\.$/, JSON.stringify(outcome));
  assert.match(forecastModelChoiceMessage({ kind: 'refused', reason: 'no-place' }), /Choisissez d’abord la commune/);
  assert.match(forecastModelChoiceMessage({ kind: 'refused', reason: 'too-soon' }), /Rien n’est enregistré\.$/);
  assert.match(forecastModelChoiceMessage({ kind: 'refused', reason: 'absent' }), /démonstration/);
  const every = [...failures, { kind: 'saved', modelId: METEO_FRANCE, days: [] } as const].map(forecastModelChoiceMessage).join(' ');
  assert.ok(!/meilleur|plus précis|plus fiable|recommand/i.test(every), 'aucune affirmation de qualité (règle 10)');
});

test('le journal des modifications : un retour à « Automatique » fait par le module se lit « Le module », avec le nom du modèle', () => {
  const entry: ChangeJournalEntry = {
    id: 'ligne-1', family: 'reglage', subject: 'modele-meteo', objectId: null, context: {}, action: 'modifie',
    before: { forecastModel: METEO_FRANCE }, after: { forecastModel: null }, actorUserId: MODULE_ACTOR_ID, createdAt: '2026-11-26T05:15:00.000Z', sequence: 1,
  };
  const card = changeJournalCard(entry, { viewerUserId: 'alice', nameOf: () => null });
  assert.equal(card.who, CHANGE_AUTHOR_MODULE);
  assert.equal(card.subject, 'Modèle de prévision');
  assert.deepEqual(card.lines, [{ label: 'Modèle de prévision', text: 'Météo-France (AROME puis ARPEGE) → « Automatique »' }]);
  const withdrawn = changeJournalCard({ ...entry, before: { forecastModel: 'modele_retire' } }, { viewerUserId: 'alice', nameOf: () => null });
  assert.equal(withdrawn.lines[0].text, 'un modèle qui n’est plus proposé → « Automatique »', 'jamais l’identifiant d’un modèle retiré');
  assert.equal(changeJournalCard({ ...entry, actorUserId: 'alice' }, { viewerUserId: 'alice', nameOf: () => null }).who, 'Vous');
});

// --- La réponse fixe des parcours automatisés -----------------------------------------

test('parcours automatisés (règle 13, F1022) : une réponse fixe par modèle, sa portée, puis « Automatique d’Open-Meteo »', async () => {
  const meteoFrance = await demonstrationModelForecastReader.readModelForecast(READ, METEO_FRANCE);
  assert.equal(meteoFrance.length, 15);
  const range = forecastModel(METEO_FRANCE)!.measuredRangeDays;
  assert.deepEqual(meteoFrance.map((entry) => entry.source), [
    ...Array<string>(range).fill('open-meteo:meteofrance_seamless'),
    ...Array<string>(15 - range).fill('open-meteo:best_match'),
  ]);
  assert.deepEqual(await demonstrationModelForecastReader.readModelForecast(READ, METEO_FRANCE), meteoFrance, 'sans hasard ni horloge');
  const icon = await demonstrationModelForecastReader.readModelForecast(READ, ICON);
  assert.notDeepEqual(icon.slice(0, range).map((entry) => entry.precipitationMm), meteoFrance.slice(0, range).map((entry) => entry.precipitationMm), 'deux modèles, deux réponses');
  const automatic = await demonstrationModelForecastReader.readModelForecast(READ, COMPLETION_FORECAST_MODEL_ID);
  assert.ok(automatic.every((entry) => entry.source === 'open-meteo:best_match'));
  assert.deepEqual(meteoFrance.slice(range).map((entry) => ({ ...entry, source: null })), automatic.slice(range).map((entry) => ({ ...entry, source: null })), 'le complément est la réponse d’« Automatique d’Open-Meteo »');
  await assert.rejects(
    demonstrationModelForecastReader.readModelForecast(READ, 'modele_inconnu'),
    (error) => error instanceof WeatherProviderError && error.kind === 'client',
  );
});

test('attribution (§ 6) : Open-Meteo et le producteur du modèle choisi ; la démonstration jamais créditée à un fournisseur réel', () => {
  const openMeteo = { id: 'open-meteo' } as WeatherProvider;
  const free = { id: 'free-weather-stack' } as WeatherProvider;
  assert.equal(weatherAttribution(free), 'Prévisions : Visual Crossing Weather. ET0 calculée selon FAO-56. Réanalyses : Open-Meteo (CC BY 4.0).', '« Automatique » ne change pas');
  assert.equal(weatherAttribution(free, null), weatherAttribution(free));
  const meteoFrance = weatherAttribution(free, METEO_FRANCE);
  assert.match(meteoFrance, /^Prévisions : Météo-France, par Open-Meteo \(CC BY 4\.0\)/);
  assert.match(meteoFrance, /Automatique d’Open-Meteo/);
  assert.ok(!meteoFrance.includes('Visual Crossing'), 'le modèle choisi ne lit pas Visual Crossing (règle 4)');
  assert.match(weatherAttribution(openMeteo, 'ecmwf_ifs025'), /Centre européen pour les prévisions météorologiques à moyen terme/);
  assert.equal(weatherAttribution(free, COMPLETION_FORECAST_MODEL_ID), 'Prévisions et réanalyses : Open-Meteo (CC BY 4.0).');
  assert.match(weatherAttribution(demonstrationWeatherProvider, METEO_FRANCE), /^Données météo de démonstration/);
});

// --- La synchronisation par lieu et par modèle ------------------------------------------

const target = (workspaceId: string, forecastModelId: string | null, overrides: Partial<AutomaticWeatherTarget> = {}): AutomaticWeatherTarget => ({
  workspaceId,
  locationKey: 'custom:bourges:18000',
  ...BOURGES,
  timezone: 'Europe/Paris',
  refreshNotBeforeAt: null,
  forecastModel: forecastModelId,
  ...overrides,
});

class FakeProvider implements WeatherProvider {
  readonly id = 'fake';
  forecastCalls = 0;
  reanalysisCalls = 0;
  async searchLocations() { return []; }
  async readForecast(input: WeatherReadInput): Promise<WeatherDailyValue[]> {
    this.forecastCalls += 1;
    return [{ date: input.startDate, precipitationMm: 9, et0Mm: 1 }];
  }
  async readReanalysis(input: WeatherReadInput): Promise<WeatherDailyValue[]> {
    this.reanalysisCalls += 1;
    return [{ date: input.startDate, precipitationMm: 0, et0Mm: 1 }];
  }
}

/** Un lecteur de modèles qui rend le modèle pour le premier jour et « Automatique d’Open-Meteo » pour le second. */
class FakeModelReader implements ModelForecastReader {
  calls: string[] = [];
  failing = new Set<string>();
  async readModelForecast(input: WeatherReadInput, modelId: string): Promise<ModelForecastDay[]> {
    this.calls.push(modelId);
    if (this.failing.has(modelId)) throw new WeatherProviderError('limite', { kind: 'rate-limit', status: 429, retryAfterSeconds: 120, endpoint: 'forecast' });
    return [
      { date: input.startDate, precipitationMm: modelId === METEO_FRANCE ? 1 : 2, et0Mm: 1, source: forecastModelSource(modelId) },
      { date: '2026-11-27', precipitationMm: 3, et0Mm: 1, source: forecastModelSource(COMPLETION_FORECAST_MODEL_ID) },
    ];
  }
}

type Written = { workspaceId: string; kind: string; date: string; precipitationMm: number | null; source: string };

class FakeRepository implements AutomaticWeatherSyncRepository {
  written: Written[] = [];
  archived: { workspaceId: string; source: string; targetDates: string[] }[] = [];
  recorded: { workspaceId: string; successful: boolean; notBeforeAt: string | null }[] = [];
  returned: { workspaceId: string; savedModelId: string }[] = [];
  private readonly targets: AutomaticWeatherTarget[];
  constructor(targets: AutomaticWeatherTarget[]) {
    this.targets = targets;
  }
  async claimJob() { return 'jeton'; }
  async finishJob() {}
  async listTargets() { return this.targets; }
  async upsertValues(input: Parameters<AutomaticWeatherSyncRepository['upsertValues']>[0]) {
    for (const value of input.values) {
      this.written.push({ workspaceId: input.target.workspaceId, kind: input.kind, date: value.date, precipitationMm: value.precipitationMm, source: input.source });
    }
  }
  async archiveForecast(input: Parameters<AutomaticWeatherSyncRepository['archiveForecast']>[0]) {
    this.archived.push({ workspaceId: input.workspaceId, source: input.source, targetDates: input.rows.map((row) => row.targetDate) });
    return input.rows.length;
  }
  async recordWorkspaceResult(input: Parameters<AutomaticWeatherSyncRepository['recordWorkspaceResult']>[0]) {
    this.recorded.push({ workspaceId: input.workspaceId, successful: input.successful, notBeforeAt: input.notBeforeAt });
  }
  async returnForecastModelToAutomatic(input: { workspaceId: string; savedModelId: string; at: string }) {
    this.returned.push({ workspaceId: input.workspaceId, savedModelId: input.savedModelId });
    return true;
  }
}

const MORNING = new Date('2026-11-26T05:15:00.000Z');
const quiet = () => undefined;

test('isolation (§ 8.3) : au même lieu, une lecture par modèle ; chaque ferme n’écrit que les lignes de sa lecture, sous leur source', async () => {
  const repository = new FakeRepository([target('a', null), target('b', METEO_FRANCE), target('c', ICON), target('d', METEO_FRANCE)]);
  const provider = new FakeProvider();
  const reader = new FakeModelReader();
  const written: string[] = [];
  const result = await runAutomaticWeatherSync({
    repository, provider, modelReader: reader, now: MORNING, log: quiet, retry: { sleep: async () => undefined },
    onForecastWritten: async (input) => { written.push(input.workspaceId); },
  });
  assert.deepEqual([provider.forecastCalls, reader.calls.length, provider.reanalysisCalls], [1, 2, 1], '« Automatique », Météo-France et ICON ; la réanalyse une fois pour le lieu');
  assert.deepEqual(reader.calls, [METEO_FRANCE, ICON]);
  assert.deepEqual([result.locations, result.forecastRequests, result.reanalysisRequests, result.successfulTargets], [1, 3, 1, 4]);
  const forecastOf = (workspaceId: string) => repository.written.filter((row) => row.workspaceId === workspaceId && row.kind === 'forecast').map((row) => [row.date, row.precipitationMm, row.source]);
  assert.deepEqual(forecastOf('a'), [['2026-11-26', 9, 'fake']], 'la ferme en « Automatique » n’est pas touchée par le choix des autres');
  assert.deepEqual(forecastOf('b'), [['2026-11-26', 1, 'open-meteo:meteofrance_seamless'], ['2026-11-27', 3, 'open-meteo:best_match']]);
  assert.deepEqual(forecastOf('d'), forecastOf('b'), 'même modèle, même lecture');
  assert.deepEqual(forecastOf('c'), [['2026-11-26', 2, 'open-meteo:icon_seamless'], ['2026-11-27', 3, 'open-meteo:best_match']]);
  assert.deepEqual(repository.written.filter((row) => row.kind === 'reanalysis').map((row) => row.workspaceId).sort(), ['a', 'b', 'c', 'd'], 'chaque ferme écrit sa réanalyse');
  assert.deepEqual(repository.archived.filter((entry) => entry.workspaceId === 'b'), [{ workspaceId: 'b', source: 'open-meteo:best_match', targetDates: ['2026-11-27'] }], 'l’archive garde la source de chaque jour (J+1)');
  assert.deepEqual(written.sort(), ['a', 'b', 'c', 'd'], 'les alertes s’évaluent pour chaque ferme après son écriture');
});

test('règle 9 : un modèle retiré ou hors du lieu ramène la ferme à « Automatique », dit une fois, et elle lit « Automatique » dès ce passage', async () => {
  const repository = new FakeRepository([
    target('a', 'modele_retire'),
    target('b', METEO_FRANCE, { locationKey: 'custom:montreal', ...MONTREAL, timezone: 'America/Toronto' }),
    target('c', METEO_FRANCE),
  ]);
  const reader = new FakeModelReader();
  const provider = new FakeProvider();
  const lines: Record<string, unknown>[] = [];
  await runAutomaticWeatherSync({ repository, provider, modelReader: reader, now: MORNING, log: (_level, entry) => lines.push(entry), retry: { sleep: async () => undefined } });
  assert.deepEqual(repository.returned, [{ workspaceId: 'a', savedModelId: 'modele_retire' }, { workspaceId: 'b', savedModelId: METEO_FRANCE }]);
  assert.deepEqual(reader.calls, [METEO_FRANCE], 'seule la ferme c lit son modèle');
  assert.equal(provider.forecastCalls, 2, 'a et b lisent « Automatique », chacune à son lieu');
  const returned = lines.filter((line) => line.event === 'weather_forecast_model_returned_to_automatic');
  assert.deepEqual(returned.map((line) => [line.forecastModel, line.reason]), [['modele_retire', 'withdrawn'], [METEO_FRANCE, 'outside-zone']]);
  assert.ok(!JSON.stringify(lines).includes('-73.57') && !JSON.stringify(returned).includes('"a"'), 'ni coordonnée ni exploitation dans le journal technique');
});

test('règle 13 : sans lecteur des modèles, toutes les fermes lisent « Automatique », une lecture par lieu comme avant', async () => {
  const repository = new FakeRepository([target('a', null), target('b', METEO_FRANCE)]);
  const provider = new FakeProvider();
  const result = await runAutomaticWeatherSync({ repository, provider, modelReader: null, now: MORNING, log: quiet, retry: { sleep: async () => undefined } });
  assert.equal(provider.forecastCalls, 1);
  assert.equal(result.forecastRequests, 1);
  assert.deepEqual(repository.written.filter((row) => row.kind === 'forecast').map((row) => [row.workspaceId, row.source]), [['a', 'fake'], ['b', 'fake']]);
  assert.deepEqual(repository.returned, [], 'le modèle enregistré reste : il n’est ni retiré ni hors du lieu');
});

test('l’échec d’une lecture d’un modèle suit le chemin existant : ses fermes sont remises à plus tard, les autres lisent ; le lieu compte une fois', async () => {
  const repository = new FakeRepository([target('a', null), target('b', METEO_FRANCE), target('c', ICON)]);
  const reader = new FakeModelReader();
  reader.failing.add(METEO_FRANCE);
  reader.failing.add(ICON);
  const result = await runAutomaticWeatherSync({ repository, provider: new FakeProvider(), modelReader: reader, now: MORNING, log: quiet, retry: { sleep: async () => undefined } });
  assert.deepEqual(result.forecastFailures, ['rate-limit'], 'un lieu en échec, une seule classe, jamais le message');
  assert.deepEqual([result.successfulTargets, result.failedTargets], [1, 2]);
  assert.deepEqual(repository.recorded.map((entry) => [entry.workspaceId, entry.successful, entry.notBeforeAt !== null]), [['a', true, false], ['b', false, true], ['c', false, true]]);
  assert.deepEqual(repository.written.filter((row) => row.kind === 'forecast').map((row) => row.workspaceId), ['a'], 'rien d’écrit pour une lecture en échec');
});
