import assert from 'node:assert/strict';
import test from 'node:test';
import {
  runAutomaticWeatherSync,
  type AutomaticWeatherSyncRepository,
  type AutomaticWeatherTarget,
} from '../lib/services/weather/automatic-sync.ts';
import { automaticWeatherRequestRanges } from '../lib/domain/weather/cache-policy.ts';
import {
  fetchWeatherForLocation,
  type WeatherSyncRanges,
} from '../lib/services/weather/sync-engine.ts';
import {
  WeatherProviderError,
  type WeatherDailyValue,
  type WeatherProvider,
  type WeatherReadInput,
} from '../lib/domain/weather/weather-provider.ts';
import { verifyWeatherSyncToken } from '../lib/services/weather/internal-auth.ts';

const target = (workspaceId: string, overrides: Partial<AutomaticWeatherTarget> = {}): AutomaticWeatherTarget => ({
  workspaceId,
  locationKey: `custom:tronget:03240`,
  latitude: 46.4225,
  longitude: 3.068,
  timezone: 'Europe/Paris',
  refreshNotBeforeAt: null,
  ...overrides,
});

test('le cron s’exécute sans utilisateur connecté et déduplique les exploitations au même lieu', async () => {
  const repository = new FakeRepository([target('a'), target('b')]);
  const provider = new FakeProvider();
  const result = await runAutomaticWeatherSync({
    repository,
    provider,
    now: new Date('2026-09-16T04:15:00Z'),
    retry: { sleep: async () => undefined },
    log: () => undefined,
  });
  assert.equal(result.status, 'completed');
  assert.equal(result.targets, 2);
  assert.equal(result.locations, 1);
  assert.equal(provider.forecastCalls.length, 1);
  assert.equal(provider.reanalysisCalls.length, 1);
  assert.deepEqual(repository.recorded.map((row) => row.workspaceId).sort(), ['a', 'b']);
});

test('deux exécutions concurrentes sont bloquées par le verrou partagé', async () => {
  const repository = new FakeRepository([target('a')]);
  repository.claimed = false;
  const result = await runAutomaticWeatherSync({
    repository,
    provider: new FakeProvider(),
    now: new Date('2026-09-16T04:15:00Z'),
    log: () => undefined,
  });
  assert.equal(result.status, 'already-running');
  assert.equal(repository.finished.length, 0);
});

test('une seconde exécution est idempotente et conserve une mesure manuelle, y compris zéro', async () => {
  const repository = new FakeRepository([target('a')]);
  repository.values.set('a:manual_precipitation:2026-09-15', 0);
  const provider = new FakeProvider({
    forecast: [{ date: '2026-09-16', precipitationMm: 0, et0Mm: 2.4 }],
  });
  for (let index = 0; index < 2; index += 1) {
    await runAutomaticWeatherSync({
      repository,
      provider,
      now: new Date('2026-09-16T04:15:00Z'),
      retry: { sleep: async () => undefined },
      log: () => undefined,
    });
  }
  assert.equal(repository.values.get('a:manual_precipitation:2026-09-15'), 0);
  assert.equal(repository.values.get('a:forecast:2026-09-16'), 0);
  assert.equal([...repository.values.keys()].filter((key) => key === 'a:forecast:2026-09-16').length, 1);
});

test('une date passe de prévision à réanalyse sans écraser sa provenance', async () => {
  const repository = new FakeRepository([target('a')]);
  const provider = new FakeProvider({
    forecast: [{ date: '2026-09-10', precipitationMm: 1.2, et0Mm: 3 }],
    reanalysis: [{ date: '2026-09-10', precipitationMm: 0.8, et0Mm: 2.7 }],
  });
  await repository.upsertValues({
    target: target('a'), kind: 'forecast', values: provider.forecast,
    source: 'forecast-source', fetchedAt: '2026-09-10T06:00:00Z',
  });
  await runAutomaticWeatherSync({
    repository,
    provider,
    now: new Date('2026-09-16T04:15:00Z'),
    retry: { sleep: async () => undefined },
    log: () => undefined,
  });
  assert.equal(repository.values.get('a:forecast:2026-09-10'), 1.2);
  assert.equal(repository.values.get('a:reanalysis:2026-09-10'), 0.8);
});

test('une réanalyse encore indisponible reste absente puis est rattrapée au passage suivant', async () => {
  const repository = new FakeRepository([target('a')]);
  const provider = new FakeProvider({ reanalysis: [] });
  await runAutomaticWeatherSync({
    repository, provider, now: new Date('2026-09-16T04:15:00Z'),
    retry: { sleep: async () => undefined }, log: () => undefined,
  });
  assert.equal(repository.values.has('a:reanalysis:2026-09-11'), false);
  provider.reanalysis = [{ date: '2026-09-11', precipitationMm: 0, et0Mm: 2.1 }];
  await runAutomaticWeatherSync({
    repository, provider, now: new Date('2026-09-17T04:15:00Z'),
    retry: { sleep: async () => undefined }, log: () => undefined,
  });
  assert.equal(repository.values.get('a:reanalysis:2026-09-11'), 0);
});

test('J0, J+1 et J+5 gardent une fenêtre future et une fenêtre glissante de rattrapage', () => {
  assert.deepEqual(automaticWeatherRequestRanges({ today: '2026-09-16' }), {
    forecast: { startDate: '2026-09-16', endDate: '2026-09-30' },
    reanalysis: { startDate: '2026-09-06', endDate: '2026-09-11' },
  });
  assert.equal(automaticWeatherRequestRanges({ today: '2026-09-17' }).reanalysis.endDate, '2026-09-12');
  assert.equal(automaticWeatherRequestRanges({ today: '2026-09-21' }).reanalysis.endDate, '2026-09-16');
});

test('les erreurs 5xx et 429 sont retentées avec une attente bornée', async (t) => {
  for (const kind of ['server', 'rate-limit'] as const) {
    await t.test(kind, async () => {
      let calls = 0;
      const delays: number[] = [];
      const provider = new FakeProvider();
      provider.readForecast = async () => {
        calls += 1;
        if (calls < 3) throw new WeatherProviderError('temporaire', {
          kind,
          status: kind === 'rate-limit' ? 429 : 503,
          retryAfterSeconds: kind === 'rate-limit' ? 60 : null,
          endpoint: 'forecast',
        });
        return [{ date: '2026-09-16', precipitationMm: 0, et0Mm: 2 }];
      };
      const ranges: WeatherSyncRanges = {
        forecast: { startDate: '2026-09-16', endDate: '2026-09-17' },
        reanalysis: null,
      };
      const outcome = await fetchWeatherForLocation({
        location: target('a'), ranges, provider, bypassCache: true,
        retry: { maxAttempts: 3, sleep: async (delay) => { delays.push(delay); } },
        log: () => undefined,
      });
      assert.equal(outcome.forecast.status, 'fulfilled');
      assert.equal(calls, 3);
      assert.equal(delays.length, 2);
      assert.ok(delays.every((delay) => delay <= 2_000));
    });
  }
});

test('les alertes météo sont évaluées après chaque écriture de prévisions, et seulement alors', async () => {
  const calls: string[] = [];
  const onForecastWritten = async (input: { workspaceId: string; locationKey: string; now: Date }) => {
    calls.push(`${input.workspaceId}:${input.locationKey}:${input.now.toISOString()}`);
  };
  const now = new Date('2026-09-16T04:15:00Z');
  await runAutomaticWeatherSync({
    repository: new FakeRepository([target('a'), target('b')]), provider: new FakeProvider(), now,
    retry: { sleep: async () => undefined }, log: () => undefined, onForecastWritten,
  });
  assert.deepEqual(calls, [`a:custom:tronget:03240:${now.toISOString()}`, `b:custom:tronget:03240:${now.toISOString()}`]);

  calls.length = 0;
  const failing = new FakeProvider();
  failing.readForecast = async () => { throw new WeatherProviderError('panne', { kind: 'client', status: 400, endpoint: 'forecast' }); };
  await runAutomaticWeatherSync({
    repository: new FakeRepository([target('a')]), provider: failing, now,
    retry: { sleep: async () => undefined }, log: () => undefined, onForecastWritten,
  });
  assert.deepEqual(calls, [], 'une synchronisation en échec n’évalue rien');

  await runAutomaticWeatherSync({
    repository: new FakeRepository([target('a')]), provider: new FakeProvider({ forecast: [] }), now,
    retry: { sleep: async () => undefined }, log: () => undefined, onForecastWritten,
  });
  assert.deepEqual(calls, [], 'aucune prévision écrite, rien à évaluer');
});

test('la route interne refuse un secret absent ou différent', async () => {
  assert.equal(await verifyWeatherSyncToken(null, 'attendu'), false);
  assert.equal(await verifyWeatherSyncToken('incorrect', 'attendu'), false);
  assert.equal(await verifyWeatherSyncToken('attendu', 'attendu'), true);
});

class FakeProvider implements WeatherProvider {
  readonly id = 'fake';
  forecast: WeatherDailyValue[];
  reanalysis: WeatherDailyValue[];
  forecastCalls: WeatherReadInput[] = [];
  reanalysisCalls: WeatherReadInput[] = [];

  constructor(values: { forecast?: WeatherDailyValue[]; reanalysis?: WeatherDailyValue[] } = {}) {
    this.forecast = values.forecast ?? [{ date: '2026-09-16', precipitationMm: 0.2, et0Mm: 2.8 }];
    this.reanalysis = values.reanalysis ?? [{ date: '2026-09-11', precipitationMm: 0, et0Mm: 2.4 }];
  }

  async searchLocations() { return []; }
  async readForecast(input: WeatherReadInput) {
    this.forecastCalls.push(input);
    return this.forecast;
  }
  async readReanalysis(input: WeatherReadInput) {
    this.reanalysisCalls.push(input);
    return this.reanalysis;
  }
}

class FakeRepository implements AutomaticWeatherSyncRepository {
  claimed = true;
  values = new Map<string, number | null>();
  recorded: Array<Parameters<AutomaticWeatherSyncRepository['recordWorkspaceResult']>[0]> = [];
  finished: Array<Parameters<AutomaticWeatherSyncRepository['finishJob']>[0]> = [];
  private readonly targets: AutomaticWeatherTarget[];

  constructor(targets: AutomaticWeatherTarget[]) {
    this.targets = targets;
  }

  async claimJob() { return this.claimed ? crypto.randomUUID() : null; }
  async finishJob(input: Parameters<AutomaticWeatherSyncRepository['finishJob']>[0]) {
    this.finished.push(input);
  }
  async listTargets() { return this.targets; }
  async upsertValues(input: Parameters<AutomaticWeatherSyncRepository['upsertValues']>[0]) {
    for (const value of input.values) {
      if (value.precipitationMm === null && value.et0Mm === null) continue;
      this.values.set(
        `${input.target.workspaceId}:${input.kind}:${value.date}`,
        value.precipitationMm,
      );
    }
  }
  async recordWorkspaceResult(input: Parameters<AutomaticWeatherSyncRepository['recordWorkspaceResult']>[0]) {
    this.recorded.push(input);
  }
}
