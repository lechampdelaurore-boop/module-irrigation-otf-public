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
import { INTRADAY_FORECAST_DAYS, intradayWeatherRequestRanges, readsForecastAlerts } from '../lib/domain/weather/intraday-alerts.ts';
import { intradayWeatherOutcome } from '../lib/domain/operations/morning-task-outcomes.ts';

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

test('4.5 (F600, F602) : la réanalyse en panne se compte à part des prévisions, par classe d’erreur et sans message', async () => {
  const provider = new FakeProvider();
  provider.readReanalysis = async () => {
    throw new WeatherProviderError('fetch failed https://archive-api.open-meteo.com/v1/archive?latitude=46.42', { kind: 'network', endpoint: 'reanalysis' });
  };
  const result = await runAutomaticWeatherSync({
    repository: new FakeRepository([target('a'), target('b', { locationKey: 'ailleurs', latitude: 45 })]),
    provider,
    now: new Date('2026-11-14T05:15:00Z'),
    retry: { sleep: async () => undefined },
    log: () => undefined,
  });
  assert.equal(result.locations, 2);
  assert.deepEqual(result.forecastFailures, [], 'les prévisions sont passées');
  assert.deepEqual(result.reanalysisFailures, ['network', 'network'], 'une classe par lieu, jamais le message');
  assert.equal(result.failedTargets, 2, 'la synchronisation, elle, reste manquée comme avant');
});

test('archive des prévisions (D-297) : un seul appel pour deux exploitations au même lieu, une photographie par exploitation', async () => {
  const repository = new FakeRepository([target('a'), target('b')]);
  const provider = new FakeProvider({ forecast: [
    { date: '2026-09-16', precipitationMm: 0.2, et0Mm: 2.8 },
    { date: '2026-09-17', precipitationMm: 1.4, et0Mm: 2.1 },
    { date: '2026-09-24', precipitationMm: 9, et0Mm: 1 },
  ] });
  const result = await runAutomaticWeatherSync({
    repository, provider, now: new Date('2026-09-16T04:15:00Z'), retry: { sleep: async () => undefined }, log: () => undefined,
  });
  assert.equal(provider.forecastCalls.length, 1, 'aucun appel externe de plus (règle 6)');
  assert.equal(result.forecastRequests, 1);
  assert.deepEqual(repository.archived.map((snapshot) => [snapshot.workspaceId, snapshot.issuedOn, snapshot.rows.map((row) => row.targetDate)]), [
    ['a', '2026-09-16', ['2026-09-17']],
    ['b', '2026-09-16', ['2026-09-17']],
  ], 'J0 et J+8 ne sont pas gardés ; chaque exploitation reçoit sa propre ligne');
  assert.equal(repository.archived[0].source, 'fake');
  assert.equal(repository.archived[0].fetchedAt, '2026-09-16T04:15:00.000Z');
});

test('archive des prévisions (D-297) : son échec ne fait échouer ni la synchronisation ni ce qu’elle enregistre', async () => {
  const repository = new FakeRepository([target('a')]);
  repository.archiveFails = true;
  const provider = new FakeProvider({ forecast: [{ date: '2026-09-17', precipitationMm: 1.4, et0Mm: 2.1 }] });
  const lines: Record<string, unknown>[] = [];
  const result = await runAutomaticWeatherSync({
    repository, provider, now: new Date('2026-09-16T04:15:00Z'), retry: { sleep: async () => undefined }, log: (_level, entry) => lines.push(entry),
  });
  assert.equal(result.successfulTargets, 1);
  assert.equal(result.failedTargets, 0);
  assert.equal(repository.values.get('a:forecast:2026-09-17'), 1.4, 'les prévisions sont écrites comme avant');
  assert.equal(repository.recorded[0].successful, true);
  assert.equal(repository.finished[0].successful, true);
  assert.deepEqual(lines.filter((line) => line.event === 'weather_forecast_archive_failed').map((line) => Object.keys(line).sort()), [['event', 'failedAt', 'service', 'status']]);
});

test('C1 (D-303) : la relecture de la journée lit 7 jours de prévisions, jamais la réanalyse, pour les seules fermes retenues, sans archiver', async () => {
  const repository = new FakeRepository([target('a'), target('b', { locationKey: 'ailleurs', latitude: 45 }), target('c')]);
  const provider = new FakeProvider();
  const written: string[] = [];
  const result = await runAutomaticWeatherSync({
    repository,
    provider,
    now: new Date('2026-11-24T11:30:00Z'),
    mode: 'intraday',
    includeTarget: async (candidate) => candidate.workspaceId !== 'b',
    onForecastWritten: async (input) => { written.push(input.workspaceId); },
    retry: { sleep: async () => undefined },
    log: () => undefined,
  });
  assert.equal(INTRADAY_FORECAST_DAYS, 7, 'le plus long horizon des alertes météo et du gel');
  assert.deepEqual(provider.forecastCalls.map((call) => [call.startDate, call.endDate]), [['2026-11-24', '2026-11-30']], 'un appel pour le lieu partagé par a et c ; b, sans alerte, n’est pas relue');
  assert.equal(provider.reanalysisCalls.length, 0, 'la réanalyse reste au matin');
  assert.deepEqual(repository.archived, [], 'l’archive garde la lecture du matin (D-297)');
  assert.deepEqual(written, ['a', 'c'], 'les alertes s’évaluent après l’écriture, ferme par ferme');
  assert.deepEqual([result.targets, result.locations, result.forecastRequests, result.reanalysisRequests], [2, 1, 1, 0]);
  assert.deepEqual(intradayWeatherRequestRanges({ today: '2026-11-24' }), { forecast: { startDate: '2026-11-24', endDate: '2026-11-30' }, reanalysis: null });
});

test('C1 (D-303) : un filtre qui échoue écarte la ferme de ce passage sans arrêter les autres ; aucune ferme retenue, aucun appel', async () => {
  const provider = new FakeProvider();
  const result = await runAutomaticWeatherSync({
    repository: new FakeRepository([target('a'), target('b', { locationKey: 'ailleurs' })]),
    provider,
    now: new Date('2026-11-24T11:30:00Z'),
    mode: 'intraday',
    includeTarget: async (candidate) => {
      if (candidate.workspaceId === 'a') throw new Error('D1_ERROR');
      return true;
    },
    retry: { sleep: async () => undefined },
    log: () => undefined,
  });
  assert.equal(result.targets, 1);
  assert.equal(provider.forecastCalls.length, 1);

  const idle = new FakeProvider();
  const none = await runAutomaticWeatherSync({
    repository: new FakeRepository([target('a')]), provider: idle, now: new Date('2026-11-24T11:30:00Z'),
    mode: 'intraday', includeTarget: async () => false, log: () => undefined,
  });
  assert.equal(idle.forecastCalls.length + idle.reanalysisCalls.length, 0, 'une ferme sans alerte active n’appelle pas le fournisseur');
  assert.deepEqual(intradayWeatherOutcome({ weather: none }), [{ task: 'weather-intraday', successful: true, error: null }], 'rien à relire : le passage est réussi');
});

test('C1 (D-303) : un refus du fournisseur (429) est compté, sans message, et la relecture ne lève pas', async () => {
  const provider = new FakeProvider();
  provider.readForecast = async () => {
    throw new WeatherProviderError('Too many requests https://weather.visualcrossing.com/?key=secret', { kind: 'rate-limit', status: 429, endpoint: 'forecast' });
  };
  const repository = new FakeRepository([target('a')]);
  const result = await runAutomaticWeatherSync({
    repository, provider, now: new Date('2026-11-24T11:30:00Z'), mode: 'intraday', includeTarget: async () => true,
    retry: { sleep: async () => undefined }, log: () => undefined,
  });
  assert.deepEqual(result.forecastFailures, ['rate-limit']);
  const [outcome] = intradayWeatherOutcome({ weather: result });
  assert.equal(outcome.successful, false);
  assert.equal(outcome.error, '1 lieu sur 1 sans prévisions (limite du fournisseur)');
  assert.ok(!/secret|http/.test(outcome.error ?? ''), 'jamais l’adresse ni la clé');
  assert.equal(repository.recorded[0].successful, false, 'la ferme garde sa dernière lecture réussie');
  assert.deepEqual(intradayWeatherOutcome({ weather: { ...result, status: 'already-running' } }), [], 'une relecture déjà en cours parle pour elle');
  assert.deepEqual(intradayWeatherOutcome({ interruptedBy: 'TypeError' }), [{ task: 'weather-intraday', successful: false, error: 'interrompu avant la fin (erreur TypeError)' }]);
});

test('C1 (D-303) : une ferme est relue dans la journée seulement si une de ses alertes lit les prévisions', () => {
  const crop = { frostActive: false, sprinklerActive: false };
  assert.equal(readsForecastAlerts({ enabled: ['alertes-meteo'], activeWeatherCriteria: 1, cropAlerts: null }), true, 'un critère météo actif');
  assert.equal(readsForecastAlerts({ enabled: ['alertes-meteo'], activeWeatherCriteria: 0, cropAlerts: null }), false, 'aucun critère actif');
  assert.equal(readsForecastAlerts({ enabled: ['arrosages'], activeWeatherCriteria: 2, cropAlerts: null }), false, 'case « Alertes météo » décochée');
  assert.equal(readsForecastAlerts({ enabled: ['alertes-cultures'], activeWeatherCriteria: 0, cropAlerts: { ...crop, frostActive: true } }), true, 'le gel actif');
  assert.equal(readsForecastAlerts({ enabled: ['arrosages'], activeWeatherCriteria: 0, cropAlerts: { ...crop, frostActive: true } }), false, 'case « Alertes cultures » décochée');
  assert.equal(readsForecastAlerts({ enabled: ['alertes-cultures'], activeWeatherCriteria: 0, cropAlerts: { ...crop, sprinklerActive: true } }), false, 'les aspersions demandent aussi le Planning');
  assert.equal(readsForecastAlerts({ enabled: ['alertes-cultures', 'planning'], activeWeatherCriteria: 0, cropAlerts: { ...crop, sprinklerActive: true } }), true, 'aspersions avec le Planning');
  assert.equal(readsForecastAlerts({ enabled: ['alertes-cultures'], activeWeatherCriteria: 0, cropAlerts: crop }), false, 'séchage seul : il reste au matin');
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
  archived: Array<Parameters<AutomaticWeatherSyncRepository['archiveForecast']>[0]> = [];
  archiveFails = false;
  async archiveForecast(input: Parameters<AutomaticWeatherSyncRepository['archiveForecast']>[0]) {
    if (this.archiveFails) throw new Error('D1_ERROR: écriture refusée');
    this.archived.push(input);
    return input.rows.length;
  }
  async recordWorkspaceResult(input: Parameters<AutomaticWeatherSyncRepository['recordWorkspaceResult']>[0]) {
    this.recorded.push(input);
  }
}
