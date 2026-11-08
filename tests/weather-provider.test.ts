import assert from 'node:assert/strict';
import test from 'node:test';
import { OpenMeteoWeatherProvider } from '../lib/adapters/weather/open-meteo-provider.ts';
import {
  calculateFao56Et0Mm,
  VisualCrossingWeatherProvider,
} from '../lib/adapters/weather/visual-crossing-provider.ts';
import { WeatherProviderError } from '../lib/domain/weather/weather-provider.ts';

test('le fournisseur météo géocode seulement des résultats exploitables', async () => {
  const provider = new OpenMeteoWeatherProvider(async (input) => {
    const url = new URL(input);
    assert.equal(url.hostname, 'geocoding-api.open-meteo.com');
    assert.equal(url.searchParams.get('countryCode'), 'FR');
    assert.equal(url.searchParams.get('name'), 'Rennes');
    return Response.json({ results: [{
      name: 'Rennes', postcodes: ['35000', '35200'], admin1: 'Bretagne',
      latitude: 48.11, longitude: -1.68, timezone: 'Europe/Paris', country_code: 'FR',
    }, {
      name: 'Rennes-le-Château', postcodes: ['11190'],
      latitude: 42.92, longitude: 2.26, timezone: 'Europe/Paris', country_code: 'FR',
    }, { name: 'Incomplet' }] });
  });
  const results = await provider.searchLocations('Rennes', '35000');
  assert.equal(results.length, 1);
  assert.equal(results[0].postcode, '35000');
  assert.match(results[0].displayName, /Rennes/);
});

test('les valeurs météo manquantes restent nulles et ne deviennent jamais zéro', async () => {
  let calls = 0;
  const provider = new OpenMeteoWeatherProvider(async (input, init) => {
    calls += 1;
    const url = new URL(input);
    assert.equal(url.hostname, 'api.open-meteo.com');
    assert.equal(url.searchParams.get('daily'), 'precipitation_sum,et0_fao_evapotranspiration');
    assert.equal((init as RequestInit & { cf?: { cacheEverything?: boolean } }).cf?.cacheEverything, true);
    return Response.json({ daily: {
      time: ['2026-09-02', '2026-09-03'],
      precipitation_sum: [2.5, null],
      et0_fao_evapotranspiration: [3.2, 3.4],
    } });
  });
  const values = await provider.readForecast({
    latitude: 48.11,
    longitude: -1.68,
    timezone: 'Europe/Paris',
    startDate: '2026-09-02',
    endDate: '2026-09-03',
  });
  assert.deepEqual(values, [
    { date: '2026-09-02', precipitationMm: 2.5, et0Mm: 3.2 },
    { date: '2026-09-03', precipitationMm: null, et0Mm: 3.4 },
  ]);
  assert.equal(calls, 1, 'la pluie et l’ET0 partagent une seule requête');
});

test('un quota météo respecte Retry-After, conserve la raison et ne relance pas la requête', async () => {
  let calls = 0;
  const logs: Record<string, unknown>[] = [];
  const provider = new OpenMeteoWeatherProvider(async () => {
    calls += 1;
    return Response.json(
      { error: true, reason: 'Daily API request limit exceeded. Please try again tomorrow.' },
      { status: 429, headers: { 'Retry-After': '90' } },
    );
  }, (_level, entry) => logs.push(entry));
  await assert.rejects(
    provider.readForecast({
      latitude: 48.11,
      longitude: -1.68,
      timezone: 'Europe/Paris',
      startDate: '2026-09-02',
      endDate: '2026-09-03',
    }),
    (error) => error instanceof WeatherProviderError
      && error.kind === 'rate-limit'
      && error.status === 429
      && error.retryAfterSeconds === 90
      && /temporairement limité/.test(error.message)
      && /Daily API request limit exceeded/.test(error.providerReason ?? ''),
  );
  assert.equal(calls, 1);
  assert.equal(logs.length, 1);
  assert.deepEqual(logs[0], {
    event: 'weather_external_response',
    provider: 'open-meteo',
    endpoint: 'forecast',
    requestedAt: logs[0].requestedAt,
    status: 429,
    retryAfterSeconds: 90,
    providerReason: 'Daily API request limit exceeded. Please try again tomorrow.',
  });
});

test('une panne réseau reste distincte d’un refus HTTP', async () => {
  const offline = new OpenMeteoWeatherProvider(async () => {
    throw new TypeError('network down');
  });
  await assert.rejects(
    offline.searchLocations('Rennes', '35000'),
    (error) => error instanceof WeatherProviderError
      && error.kind === 'network'
      && /ne répond pas/.test(error.message),
  );
});

test('les refus 401/403, les erreurs 5xx et le délai dépassé restent distinguables', async (t) => {
  for (const [status, kind] of [[401, 'client'], [403, 'client'], [503, 'server']] as const) {
    await t.test(`statut ${status}`, async () => {
      const provider = new OpenMeteoWeatherProvider(async () => new Response('erreur', { status }));
      await assert.rejects(
        provider.readForecast({
          latitude: 46.4225, longitude: 3.068, timezone: 'Europe/Paris',
          startDate: '2026-09-15', endDate: '2026-09-20',
        }),
        (error) => error instanceof WeatherProviderError
          && error.status === status
          && error.kind === kind,
      );
    });
  }
  await t.test('délai dépassé', async () => {
    const provider = new OpenMeteoWeatherProvider(async () => {
      throw new DOMException('aborted', 'AbortError');
    });
    await assert.rejects(
      provider.readForecast({
        latitude: 46.4225, longitude: 3.068, timezone: 'Europe/Paris',
        startDate: '2026-09-15', endDate: '2026-09-20',
      }),
      (error) => error instanceof WeatherProviderError && error.kind === 'timeout',
    );
  });
});

test('une actualisation forcée contourne le cache de bord sans multiplier les requêtes', async () => {
  let calls = 0;
  const provider = new OpenMeteoWeatherProvider(async (_input, init) => {
    calls += 1;
    const request = init as RequestInit & { cf?: unknown };
    assert.equal(request.cache, 'no-cache');
    assert.equal(request.cf, undefined);
    return Response.json({ daily: {
      time: ['2026-09-15', '2026-09-16'],
      precipitation_sum: [0, null],
      et0_fao_evapotranspiration: [3.1, 3.2],
    } });
  }, () => undefined);
  assert.deepEqual(await provider.readForecast({
    latitude: 46.4225, longitude: 3.068, timezone: 'Europe/Paris',
    startDate: '2026-09-15', endDate: '2026-09-16', bypassCache: true,
  }), [
    { date: '2026-09-15', precipitationMm: 0, et0Mm: 3.1 },
    { date: '2026-09-16', precipitationMm: null, et0Mm: 3.2 },
  ]);
  assert.equal(calls, 1);
});

test('deux lectures identiques simultanées sont dédupliquées', async () => {
  let calls = 0;
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const provider = new OpenMeteoWeatherProvider(async () => {
    calls += 1;
    await gate;
    return Response.json({ daily: {
      time: ['2026-09-03'],
      precipitation_sum: [1.2],
      et0_fao_evapotranspiration: [3.1],
    } });
  }, () => undefined);
  const input = {
    latitude: 46.4225,
    longitude: 3.068,
    timezone: 'Europe/Paris',
    startDate: '2026-09-03',
    endDate: '2026-09-03',
  };
  const first = provider.readForecast(input);
  const second = provider.readForecast(input);
  release();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(calls, 1);
  assert.deepEqual(a, b);
});

test('la recherche de Tronget utilise le géocodage français et les coordonnées attendues', async () => {
  const provider = new OpenMeteoWeatherProvider(async (input) => {
    const url = new URL(input);
    assert.equal(url.searchParams.get('name'), 'Tronget');
    assert.equal(url.searchParams.get('countryCode'), 'FR');
    return Response.json({ results: [{
      name: 'Tronget', postcodes: ['03240'], admin1: 'Auvergne-Rhône-Alpes',
      latitude: 46.4225, longitude: 3.068, timezone: 'Europe/Paris', country_code: 'FR',
    }] });
  }, () => undefined);
  const [tronget] = await provider.searchLocations('Tronget', '03240');
  assert.equal(tronget.latitude, 46.4225);
  assert.equal(tronget.longitude, 3.068);
  assert.equal(tronget.postcode, '03240');
});

test('Visual Crossing fournit en une requête gratuite la pluie et les données du calcul ET0', async () => {
  let calls = 0;
  const provider = new VisualCrossingWeatherProvider('secret-test', async (input, init) => {
    calls += 1;
    const url = new URL(input);
    assert.equal(url.hostname, 'weather.visualcrossing.com');
    assert.match(url.pathname, /\/timeline\/46\.4225%2C3\.068\/2026-09-05\/2026-09-06$/);
    assert.equal(url.searchParams.get('unitGroup'), 'metric');
    assert.equal(url.searchParams.get('include'), 'days');
    assert.equal(
      url.searchParams.get('elements'),
      'datetime,precip,tempmax,tempmin,temp,dew,windspeedmean,solarenergy,elevation',
    );
    assert.equal(url.searchParams.get('key'), 'secret-test');
    assert.equal((init as RequestInit & { cf?: { cacheEverything?: boolean } }).cf?.cacheEverything, true);
    return Response.json({ elevation: 430, days: [
      {
        datetime: '2026-09-05', precip: 2.4, tempmax: 27, tempmin: 15.7,
        temp: 21.3, dew: 13.2, windspeedmean: 6.8, solarenergy: 20.4,
      },
      {
        datetime: '2026-09-06', precip: null, tempmax: 24.1, tempmin: 14.2,
        temp: 19.1, dew: 12.1, windspeedmean: 7.2, solarenergy: 17.8,
      },
    ] });
  }, { searchLocations: async () => [] });

  const values = await provider.readForecast({
    latitude: 46.4225,
    longitude: 3.068,
    timezone: 'Europe/Paris',
    startDate: '2026-09-05',
    endDate: '2026-09-06',
  });

  assert.equal(calls, 1);
  // Les températures prévues sont gardées pour les alertes météo (docs/weather-alerts-contract.md).
  assert.deepEqual(values, [
    { date: '2026-09-05', precipitationMm: 2.4, minimumTemperatureCelsius: 15.7, maximumTemperatureCelsius: 27, solarEnergyMegajoulesPerSquareMeter: 20.4, et0Mm: 3.91 },
    { date: '2026-09-06', precipitationMm: null, minimumTemperatureCelsius: 14.2, maximumTemperatureCelsius: 24.1, solarEnergyMegajoulesPerSquareMeter: 17.8, et0Mm: 3.35 },
  ]);
});

test('une température absente chez Visual Crossing reste absente, jamais 0', async () => {
  const provider = new VisualCrossingWeatherProvider('secret-test', async () => Response.json({ days: [
    { datetime: '2026-09-05', precip: 0, tempmax: null, temp: 18 },
  ] }), { searchLocations: async () => [] });
  const [value] = await provider.readForecast({
    latitude: 46.4225, longitude: 3.068, timezone: 'Europe/Paris', startDate: '2026-09-05', endDate: '2026-09-05',
  });
  assert.equal(value.minimumTemperatureCelsius, null);
  assert.equal(value.maximumTemperatureCelsius, null);
  assert.equal(value.et0Mm, null);
});

test('le calcul ET0 gratuit suit FAO-56 et refuse les données incomplètes', () => {
  assert.equal(calculateFao56Et0Mm({
    date: '2026-09-05',
    latitude: 46.4225,
    elevationMeters: 430,
    meanTemperatureCelsius: 21.3,
    minimumTemperatureCelsius: 15.7,
    maximumTemperatureCelsius: 27,
    dewPointCelsius: 13.2,
    meanWindSpeedKilometersPerHour: 6.8,
    solarEnergyMegajoulesPerSquareMeter: 20.4,
  }), 3.91);
  assert.equal(calculateFao56Et0Mm({
    date: '2026-09-05',
    latitude: 46.4225,
    elevationMeters: 430,
    meanTemperatureCelsius: 21.3,
    minimumTemperatureCelsius: 15.7,
    maximumTemperatureCelsius: 27,
    dewPointCelsius: null,
    meanWindSpeedKilometersPerHour: 6.8,
    solarEnergyMegajoulesPerSquareMeter: 20.4,
  }), null);
});

test('Visual Crossing délègue le géocodage sans consommer de donnée météo', async () => {
  let weatherCalls = 0;
  let geocodingCalls = 0;
  const candidate = {
    displayName: 'Tronget · 03240 · Auvergne-Rhône-Alpes',
    city: 'Tronget',
    postcode: '03240',
    latitude: 46.4225,
    longitude: 3.068,
    timezone: 'Europe/Paris',
    countryCode: 'FR',
  };
  const provider = new VisualCrossingWeatherProvider('secret-test', async () => {
    weatherCalls += 1;
    return Response.json({ days: [] });
  }, {
    searchLocations: async (query, postcode) => {
      geocodingCalls += 1;
      assert.equal(query, 'Tronget');
      assert.equal(postcode, '03240');
      return [candidate];
    },
  });

  assert.deepEqual(await provider.searchLocations('Tronget', '03240'), [candidate]);
  assert.equal(geocodingCalls, 1);
  assert.equal(weatherCalls, 0);
});

test('Visual Crossing déduplique les lectures et ne journalise jamais la clé', async () => {
  let calls = 0;
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const logs: Record<string, unknown>[] = [];
  const provider = new VisualCrossingWeatherProvider('cle-tres-secrete', async () => {
    calls += 1;
    await gate;
    return Response.json({ elevation: 430, days: [{
      datetime: '2026-09-05', precip: 1.2, tempmax: 27, tempmin: 15.7,
      temp: 21.3, dew: 13.2, windspeedmean: 6.8, solarenergy: 20.4,
    }] });
  }, { searchLocations: async () => [] }, (_level, entry) => logs.push(entry));
  const input = {
    latitude: 46.4225,
    longitude: 3.068,
    timezone: 'Europe/Paris',
    startDate: '2026-09-05',
    endDate: '2026-09-05',
  };

  const first = provider.readForecast(input);
  const second = provider.readForecast(input);
  release();
  await Promise.all([first, second]);

  assert.equal(calls, 1);
  assert.equal(JSON.stringify(logs).includes('cle-tres-secrete'), false);
  assert.ok(logs.some((entry) => entry.event === 'weather_external_request_deduplicated'));
});

test('Visual Crossing respecte un quota sans relancer la requête', async () => {
  let calls = 0;
  const provider = new VisualCrossingWeatherProvider('secret-test', async () => {
    calls += 1;
    return new Response('Quota exceeded', {
      status: 429,
      headers: { 'Retry-After': '120' },
    });
  }, { searchLocations: async () => [] }, () => undefined);

  await assert.rejects(
    provider.readForecast({
      latitude: 46.4225,
      longitude: 3.068,
      timezone: 'Europe/Paris',
      startDate: '2026-09-05',
      endDate: '2026-09-06',
    }),
    (error) => error instanceof WeatherProviderError
      && error.kind === 'rate-limit'
      && error.status === 429
      && error.retryAfterSeconds === 120
      && error.providerReason === 'Quota exceeded',
  );
  assert.equal(calls, 1);
});
