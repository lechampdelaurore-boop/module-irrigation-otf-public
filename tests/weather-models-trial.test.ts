import assert from 'node:assert/strict';
import test from 'node:test';
import {
  readTrialResponse,
  TRIAL_CALLS,
  TRIAL_DAILY_VARIABLES,
  TRIAL_MAXIMUM_CALLS,
  trialReport,
  trialUrl,
  usefulHeaders,
} from '../scripts/weather-models/trial-read.ts';

// L'essai A de la météo multi-modèles (docs/weather-models-contract.md, § 7) :
// ce qu'il demande et comment il lit, sans réseau.

test('essai A : au plus dix appels, aucune clé, deux lieux quelconques', () => {
  assert.ok(TRIAL_CALLS.length <= TRIAL_MAXIMUM_CALLS);
  for (const call of TRIAL_CALLS) {
    const url = trialUrl(call, '2026-11-26', '2026-12-10');
    assert.equal(url.origin, 'https://api.open-meteo.com');
    assert.equal(url.searchParams.get('apikey'), null);
    assert.equal(url.searchParams.get('daily'), TRIAL_DAILY_VARIABLES.join(','));
    assert.equal(url.searchParams.get('timezone'), 'Europe/Paris');
    assert.equal(url.searchParams.get('models'), call.models ? call.models.join(',') : null);
  }
  assert.deepEqual(new Set(TRIAL_CALLS.map((call) => call.place.name)).size, 2);
});

test('essai A : une série suffixée par le modèle est lue pour ce modèle, une valeur nulle ne compte pas', () => {
  const reading = readTrialResponse({
    latitude: 47.08,
    longitude: 2.4,
    daily_units: { precipitation_sum_meteofrance_seamless: 'mm' },
    daily: {
      time: ['2026-11-26', '2026-11-27', '2026-11-28'],
      precipitation_sum_meteofrance_seamless: [0, 1.2, null],
      precipitation_sum_best_match: [0, 1, 3],
      cape_max: [1, 2, 3],
    },
  }, ['meteofrance_seamless', 'best_match']);
  assert.ok(reading);
  const meteoFrance = reading.models[0]?.series.find((series) => series.variable === 'precipitation_sum');
  assert.deepEqual(meteoFrance, {
    variable: 'precipitation_sum',
    key: 'precipitation_sum_meteofrance_seamless',
    unit: 'mm',
    days: 3,
    nonNullDays: 2,
    firstValueDate: '2026-11-26',
    lastValueDate: '2026-11-27',
  });
  assert.equal(reading.models[1]?.series[0]?.lastValueDate, '2026-11-28');
  // Une série absente est dite absente, jamais lue comme des zéros (D-003).
  const missing = reading.models[0]?.series.find((series) => series.variable === 'et0_fao_evapotranspiration');
  assert.equal(missing?.key, null);
  assert.equal(missing?.nonNullDays, 0);
  assert.deepEqual(reading.unclaimedKeys, ['cape_max']);
});

test('essai A : sans paramètre models, la série nue est lue ; une réponse sans daily ne se lit pas', () => {
  const reading = readTrialResponse({ daily: { time: ['2026-11-26'], precipitation_sum: [2] } }, null);
  assert.equal(reading?.models[0]?.series[0]?.key, 'precipitation_sum');
  assert.equal(readTrialResponse({ error: true, reason: 'Invalid model' }, ['x']), null);
});

test('essai A : la pluie heure par heure dit combien d’heures chaque jour a une valeur', () => {
  const reading = readTrialResponse({
    daily: { time: ['2026-11-29'], precipitation_sum_meteofrance_seamless: [2.8] },
    hourly: {
      time: ['2026-11-29T00:00', '2026-11-29T01:00', '2026-11-29T02:00', '2026-11-30T00:00'],
      precipitation_meteofrance_seamless: [0.1, 0.2, null, null],
    },
  }, ['meteofrance_seamless']);
  assert.deepEqual(reading?.models[0]?.hourlyRain, {
    key: 'precipitation_meteofrance_seamless',
    hoursWithValueByDate: { '2026-11-29': 2, '2026-11-30': 0 },
    lastValueHour: '2026-11-29T01:00',
  });
  const call = TRIAL_CALLS[0];
  assert.ok(call);
  assert.match(trialReport([{
    call, status: 200, failure: null, headers: {}, providerReason: null, reading,
  }], '2026-11-29', '2026-11-30'), /dernière heure 2026-11-29T01:00 ; 11-29 2 h, 11-30 0 h\./);
});

test('essai A : seuls les en-têtes de type et de limite sont gardés', () => {
  assert.deepEqual(usefulHeaders([
    ['Content-Type', 'application/json'],
    ['Set-Cookie', 'a=b'],
    ['X-RateLimit-Remaining', '599'],
    ['Retry-After', '60'],
  ]), { 'content-type': 'application/json', 'x-ratelimit-remaining': '599', 'retry-after': '60' });
});

test('essai A : le compte rendu dit le refus, sa raison, et le tableau des séries', () => {
  const first = TRIAL_CALLS[0];
  const refused = TRIAL_CALLS.find((call) => call.models?.includes('modele_inexistant'));
  assert.ok(first && refused);
  const report = trialReport([
    {
      call: first,
      status: 200,
      failure: null,
      headers: {},
      providerReason: null,
      reading: readTrialResponse({ daily: { time: ['2026-11-26'], precipitation_sum: [2] } }, null),
    },
    { call: refused, status: 400, failure: 'refus', headers: {}, providerReason: 'Invalid model', reading: null },
  ], '2026-11-26', '2026-12-10');
  assert.match(report, /\| \(sans paramètre models\) \| precipitation_sum \| `precipitation_sum` \| — \| 1 \/ 1 \| 11-26 \| 11-26 \|/);
  assert.match(report, /Réponse : 400 \(refus\), raison : « Invalid model »/);
});
