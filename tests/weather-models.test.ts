import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { afterEach } from 'node:test';
import { OpenMeteoWeatherProvider, openMeteoWeatherProvider } from '../lib/adapters/weather/open-meteo-provider.ts';
import {
  COMPLETION_FORECAST_MODEL_ID,
  FORECAST_MODELS,
  forecastCompletion,
  forecastDaysForModel,
  forecastModel,
  forecastModelSource,
  forecastModelsCovering,
  resolveForecastModelChoice,
} from '../lib/domain/weather/forecast-models.ts';
import { WeatherProviderError, type WeatherDailyValue } from '../lib/domain/weather/weather-provider.ts';
import { getModelForecastReader } from '../lib/services/weather/configured-provider.ts';

/**
 * La météo multi-modèles, PR 1 : la liste des modèles, le choix du jour et la
 * lecture stricte d'Open-Meteo (docs/weather-models-contract.md, § 3, § 4,
 * § 5, § 8 points 1 et 2 ; D-345). Les réponses figées viennent de l'essai A
 * du 26 novembre 2026 (§ 14, run 45827275586), à Bourges : rien d'une ferme.
 * La liste n'est pas recopiée ici (§ 4) : les tests en vérifient les
 * propriétés.
 */

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`./fixtures/open-meteo-models/${name}.json`, import.meta.url), 'utf8'));
}

const BOURGES = { latitude: 47.08, longitude: 2.4 };
const MONTREAL = { latitude: 45.5, longitude: -73.57 };
const READ = { ...BOURGES, timezone: 'Europe/Paris', startDate: '2026-11-26', endDate: '2026-12-10' };
const ZONED = FORECAST_MODELS.filter((model) => model.zone !== null);
const METEO_FRANCE = 'meteofrance_seamless';

const SETTINGS = ['OPEN_METEO_API_BASE_URL', 'OPEN_METEO_API_KEY', 'WEATHER_DATA_SOURCE', 'DEMO_MODE'] as const;
const savedSettings = Object.fromEntries(SETTINGS.map((key) => [key, process.env[key]]));
const savedFetch = globalThis.fetch;
afterEach(() => {
  for (const key of SETTINGS) {
    if (savedSettings[key] === undefined) delete process.env[key];
    else process.env[key] = savedSettings[key];
  }
  globalThis.fetch = savedFetch;
});

function answering(payload: unknown, sent: URL[] = [], status = 200) {
  return async (input: string | URL | Request) => {
    sent.push(new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url));
    return Response.json(payload, { status });
  };
}

const quiet = () => undefined;

function day(date: string, values: Partial<WeatherDailyValue>): WeatherDailyValue {
  return {
    date,
    precipitationMm: null,
    et0Mm: null,
    minimumTemperatureCelsius: null,
    maximumTemperatureCelsius: null,
    solarEnergyMegajoulesPerSquareMeter: null,
    ...values,
  };
}

// --- La liste (§ 4) ------------------------------------------------------------

test('la liste : identifiants uniques, Automatique d’Open-Meteo partout, libellés en mots du maraîcher', () => {
  assert.equal(new Set(FORECAST_MODELS.map((model) => model.id)).size, FORECAST_MODELS.length);
  const automatic = forecastModel(COMPLETION_FORECAST_MODEL_ID);
  assert.ok(automatic?.offered);
  assert.equal(automatic.zone, null);
  for (const model of FORECAST_MODELS) {
    assert.doesNotMatch(model.label, /_/, `${model.id} : un libellé n’est pas un identifiant`);
    // Règle 10 : des faits, jamais une affirmation de qualité.
    for (const text of [model.label, model.resolution]) assert.doesNotMatch(text, /meilleur|plus précis|fiable|recommand/i, model.id);
    assert.ok(model.measuredRangeDays >= 1 && model.measuredRangeDays <= 16, model.id);
    if (model.zone) {
      assert.ok(model.zone.southLatitude < model.zone.northLatitude, model.id);
      assert.ok(model.zone.westLongitude < model.zone.eastLongitude, model.id);
    }
  }
  assert.equal(forecastModel('modele_inexistant'), null);
});

test('la liste filtrée par le lieu : en France tout est proposé, loin de l’Europe seuls les modèles sans zone', () => {
  assert.deepEqual(forecastModelsCovering(BOURGES).map((model) => model.id), FORECAST_MODELS.filter((model) => model.offered).map((model) => model.id));
  assert.ok(ZONED.length > 0);
  assert.deepEqual(
    forecastModelsCovering(MONTREAL).map((model) => model.id),
    FORECAST_MODELS.filter((model) => model.offered && model.zone === null).map((model) => model.id),
  );
  // Les bords de la zone sont dedans.
  for (const model of ZONED) {
    assert.ok(model.zone);
    const corner = { latitude: model.zone.northLatitude, longitude: model.zone.westLongitude };
    assert.ok(forecastModelsCovering(corner).some((covering) => covering.id === model.id), model.id);
  }
});

test('règle 1 et règle 9 : sans choix « Automatique » ; un modèle retiré ou hors zone ramène à « Automatique », jamais en silence', () => {
  assert.deepEqual(resolveForecastModelChoice(null, BOURGES), { kind: 'automatic' });
  assert.deepEqual(resolveForecastModelChoice('arome_disparu', BOURGES), { kind: 'back-to-automatic', savedModelId: 'arome_disparu', reason: 'withdrawn' });
  const zoned = ZONED[0];
  assert.ok(zoned);
  assert.deepEqual(resolveForecastModelChoice(zoned.id, MONTREAL), { kind: 'back-to-automatic', savedModelId: zoned.id, reason: 'outside-zone' });
  assert.deepEqual(resolveForecastModelChoice(zoned.id, BOURGES), { kind: 'model', model: zoned });
  // Sans lieu, rien n'est lu : le choix reste.
  assert.deepEqual(resolveForecastModelChoice(zoned.id, null), { kind: 'model', model: zoned });
});

// --- Le choix du jour (règles 5 et 6) -------------------------------------------

test('règle 6 : le jour du modèle tant qu’il donne la pluie, sinon le jour entier d’Automatique, jamais un mélange', () => {
  const days = forecastDaysForModel(METEO_FRANCE, [
    day('2026-11-28', { precipitationMm: 0, minimumTemperatureCelsius: 1, et0Mm: null }),
    // La pluie manque, les températures non : tout le jour vient quand même d'Automatique.
    day('2026-11-29', { precipitationMm: null, minimumTemperatureCelsius: -3 }),
    day('2026-11-30', {}),
  ], [
    day('2026-11-28', { precipitationMm: 5, minimumTemperatureCelsius: 4, et0Mm: 0.4 }),
    day('2026-11-29', { precipitationMm: 2, minimumTemperatureCelsius: 2, et0Mm: 0.3 }),
    day('2026-11-30', { precipitationMm: 0, solarEnergyMegajoulesPerSquareMeter: 3.1 }),
  ]);
  assert.deepEqual(days, [
    // Règle 5 : l'ET0 absente du modèle reste nulle, elle n'est pas prise chez Automatique.
    { ...day('2026-11-28', { precipitationMm: 0, minimumTemperatureCelsius: 1 }), source: 'open-meteo:meteofrance_seamless' },
    { ...day('2026-11-29', { precipitationMm: 2, minimumTemperatureCelsius: 2, et0Mm: 0.3 }), source: 'open-meteo:best_match' },
    { ...day('2026-11-30', { precipitationMm: 0, solarEnergyMegajoulesPerSquareMeter: 3.1 }), source: 'open-meteo:best_match' },
  ]);
  assert.deepEqual(forecastCompletion(METEO_FRANCE, days), { lastModelDate: '2026-11-28', firstCompletedDate: '2026-11-29' });
});

test('Automatique d’Open-Meteo choisi : ses jours portent sa source, rien n’est « complété »', () => {
  const days = forecastDaysForModel(COMPLETION_FORECAST_MODEL_ID, [day('2026-11-26', { precipitationMm: 1 })], [day('2026-11-26', { precipitationMm: 1 })]);
  assert.deepEqual(days.map((value) => value.source), ['open-meteo:best_match']);
  assert.deepEqual(forecastCompletion(COMPLETION_FORECAST_MODEL_ID, days), { lastModelDate: '2026-11-26', firstCompletedDate: null });
  assert.equal(forecastModelSource(METEO_FRANCE), 'open-meteo:meteofrance_seamless');
});

// --- La lecture d'Open-Meteo (§ 5), sur les réponses de l'essai A ----------------

test('la lecture demande le modèle et Automatique en un appel, les cinq séries, sans clé par défaut', async () => {
  const sent: URL[] = [];
  const provider = new OpenMeteoWeatherProvider(answering(fixture('meteofrance-et-best-match'), sent), quiet);
  await provider.readModelForecast(READ, METEO_FRANCE);
  assert.equal(sent.length, 1);
  const [url] = sent;
  assert.ok(url);
  assert.equal(url.origin, 'https://api.open-meteo.com');
  assert.equal(url.pathname, '/v1/forecast');
  assert.equal(url.searchParams.get('models'), 'meteofrance_seamless,best_match');
  assert.equal(url.searchParams.get('daily'), 'precipitation_sum,temperature_2m_min,temperature_2m_max,et0_fao_evapotranspiration,shortwave_radiation_sum');
  assert.equal(url.searchParams.get('timezone'), 'Europe/Paris');
  assert.equal(url.searchParams.get('start_date'), '2026-11-26');
  assert.equal(url.searchParams.get('end_date'), '2026-12-10');
  assert.equal(url.searchParams.get('apikey'), null);
});

test('la réponse de l’essai A : 4 jours de Météo-France, puis 11 jours entiers d’Automatique', async () => {
  const provider = new OpenMeteoWeatherProvider(answering(fixture('meteofrance-et-best-match')), quiet);
  const days = await provider.readModelForecast(READ, METEO_FRANCE);
  assert.equal(days.length, 15);
  assert.deepEqual(days.slice(0, 5).map((value) => [value.date, value.source, value.precipitationMm]), [
    ['2026-11-26', 'open-meteo:meteofrance_seamless', 0.9],
    ['2026-11-27', 'open-meteo:meteofrance_seamless', 0.4],
    ['2026-11-28', 'open-meteo:meteofrance_seamless', 0],
    ['2026-11-29', 'open-meteo:meteofrance_seamless', 2.8],
    ['2026-11-30', 'open-meteo:best_match', 0],
  ]);
  const meteoFranceDay = days[3];
  assert.ok(meteoFranceDay);
  for (const value of [meteoFranceDay.et0Mm, meteoFranceDay.minimumTemperatureCelsius, meteoFranceDay.maximumTemperatureCelsius, meteoFranceDay.solarEnergyMegajoulesPerSquareMeter]) {
    assert.equal(typeof value, 'number');
  }
  assert.deepEqual(forecastCompletion(METEO_FRANCE, days), { lastModelDate: '2026-11-29', firstCompletedDate: '2026-11-30' });
});

test('un seul modèle demandé : les séries ne sont pas suffixées, et se lisent quand même', async () => {
  const sent: URL[] = [];
  const provider = new OpenMeteoWeatherProvider(answering(fixture('meteofrance-seul'), sent), quiet);
  const days = await provider.readModelForecast(READ, COMPLETION_FORECAST_MODEL_ID);
  assert.equal(sent[0]?.searchParams.get('models'), 'best_match');
  assert.equal(days.length, 15);
  assert.equal(days[0]?.precipitationMm, 0.9);
  // Une valeur nulle reste nulle (D-003) : les jours sans pluie rendue ne deviennent pas des zéros.
  assert.equal(days[10]?.precipitationMm, null);
});

test('analyse stricte : une série absente ou incomplète refuse toute la réponse, jamais un zéro', async () => {
  const complete = fixture('meteofrance-et-best-match') as { daily: Record<string, unknown[]> };
  const withoutRain = structuredClone(complete);
  delete withoutRain.daily.precipitation_sum_meteofrance_seamless;
  const shortened = structuredClone(complete);
  shortened.daily.et0_fao_evapotranspiration_best_match = shortened.daily.et0_fao_evapotranspiration_best_match?.slice(0, 3) ?? [];
  for (const [label, payload, series] of [
    ['pluie du modèle absente', withoutRain, 'precipitation_sum_meteofrance_seamless'],
    ['ET0 d’Automatique coupée', shortened, 'et0_fao_evapotranspiration_best_match'],
  ] as const) {
    await assert.rejects(
      new OpenMeteoWeatherProvider(answering(payload), quiet).readModelForecast(READ, METEO_FRANCE),
      (error) => error instanceof WeatherProviderError && error.kind === 'invalid-response' && error.message.includes(series),
      label,
    );
  }
  await assert.rejects(
    new OpenMeteoWeatherProvider(answering({ latitude: 47 }), quiet).readModelForecast(READ, METEO_FRANCE),
    (error) => error instanceof WeatherProviderError && error.kind === 'invalid-response',
  );
});

test('un modèle hors de la liste n’est jamais demandé ; un refus d’Open-Meteo garde sa raison', async () => {
  const sent: URL[] = [];
  await assert.rejects(
    new OpenMeteoWeatherProvider(answering({}, sent), quiet).readModelForecast(READ, 'modele_inexistant'),
    (error) => error instanceof WeatherProviderError && error.kind === 'client',
  );
  assert.equal(sent.length, 0);
  // La forme du refus relevée par l'essai A, si un modèle de la liste venait à disparaître chez Open-Meteo.
  await assert.rejects(
    new OpenMeteoWeatherProvider(answering(fixture('modele-inconnu'), [], 400), quiet).readModelForecast(READ, METEO_FRANCE),
    (error) => error instanceof WeatherProviderError && error.kind === 'client' && error.status === 400
      && /MultiDomains/.test(error.providerReason ?? ''),
  );
});

test('la réponse à cinq modèles se lit pour chacun : chaque modèle de la liste rend ses cinq séries', async () => {
  const payload = fixture('cinq-modeles') as { daily: Record<string, unknown> };
  for (const model of FORECAST_MODELS) {
    for (const variable of ['precipitation_sum', 'temperature_2m_min', 'temperature_2m_max', 'et0_fao_evapotranspiration', 'shortwave_radiation_sum']) {
      assert.ok(Array.isArray(payload.daily[`${variable}_${model.id}`]), `${variable}_${model.id}`);
    }
  }
});

// --- L'offre payante, par réglage serveur (§ 10) ----------------------------------

test('une offre payante change l’adresse et ajoute la clé, sans jamais l’écrire au journal', async () => {
  const sent: URL[] = [];
  const logs: string[] = [];
  const provider = new OpenMeteoWeatherProvider(answering(fixture('meteofrance-et-best-match'), sent), (_level, entry) => {
    logs.push(JSON.stringify(entry));
  }, { baseUrl: 'https://customer-api.open-meteo.com', apiKey: 'cle-d-essai-123' });
  await provider.readModelForecast(READ, METEO_FRANCE);
  assert.equal(sent[0]?.origin, 'https://customer-api.open-meteo.com');
  assert.equal(sent[0]?.searchParams.get('apikey'), 'cle-d-essai-123');
  assert.ok(logs.length > 0);
  assert.ok(logs.every((line) => !line.includes('cle-d-essai-123') && !line.includes('customer-api')));
});

test('une adresse non chiffrée ou illisible n’est jamais appelée', async () => {
  for (const baseUrl of ['http://customer-api.open-meteo.com', 'pas une adresse', 'https://nom:secret@customer-api.open-meteo.com']) {
    const sent: URL[] = [];
    await assert.rejects(
      new OpenMeteoWeatherProvider(answering({}, sent), quiet, { baseUrl }).readModelForecast(READ, METEO_FRANCE),
      (error) => error instanceof WeatherProviderError && error.kind === 'client' && /OPEN_METEO_API_BASE_URL/.test(error.message),
      baseUrl,
    );
    assert.equal(sent.length, 0, baseUrl);
  }
});

test('le lecteur des modèles : l’offre gratuite sans réglage, l’offre payante par réglage, absent en démonstration et pour les parcours', async () => {
  for (const key of SETTINGS) delete process.env[key];
  assert.equal(getModelForecastReader(), openMeteoWeatherProvider);

  process.env.OPEN_METEO_API_BASE_URL = 'https://customer-api.open-meteo.com';
  process.env.OPEN_METEO_API_KEY = 'cle-d-essai-456';
  const sent: URL[] = [];
  globalThis.fetch = answering(fixture('meteofrance-et-best-match'), sent) as typeof fetch;
  const paid = getModelForecastReader();
  assert.ok(paid && paid !== openMeteoWeatherProvider);
  assert.equal(getModelForecastReader(), paid);
  await paid.readModelForecast({ ...READ, bypassCache: true }, METEO_FRANCE);
  assert.equal(sent[0]?.origin, 'https://customer-api.open-meteo.com');
  assert.equal(sent[0]?.searchParams.get('apikey'), 'cle-d-essai-456');

  process.env.WEATHER_DATA_SOURCE = 'mock';
  assert.equal(getModelForecastReader(), null);
  delete process.env.WEATHER_DATA_SOURCE;
  delete process.env.OPEN_METEO_API_KEY;
  process.env.DEMO_MODE = 'true';
  assert.equal(getModelForecastReader(), null);
});
