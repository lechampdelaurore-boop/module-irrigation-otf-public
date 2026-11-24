import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { saveCropAlertSettingsForUser } from '../../db/crop-alerts/inputs';
import { readTaskRuns } from '../../db/task-run-repository';
import {
  readWeatherPreferenceForUser,
  saveWeatherGeocodeForUser,
  saveWeatherPreferenceForUser,
} from '../../db/water-management-repository';
import { createWeatherAlertCriterionForUser, listWeatherAlertsForWorkspace } from '../../db/weather-alert-repository';
import { ensureWorkspaceForUser } from '../../db/workspace-repository';
import type { IrrigationPushSendRequest } from '../../lib/domain/irrigation-push-contract';
import { customWeatherLocationKey } from '../../lib/domain/weather/location';
import { WeatherProviderError, type WeatherDailyValue, type WeatherProvider, type WeatherReadInput } from '../../lib/domain/weather/weather-provider';
import { evaluateCropAlertsAfterForecastWrite } from '../../lib/services/crop-alerts-service';
import { runIntradayWeatherAlerts } from '../../lib/services/intraday-weather-alerts';
import { evaluateWeatherAlertsAfterForecastWrite } from '../../lib/services/weather-alerts-service';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { ALICE, BOB } from '../support/spaces';

/**
 * C1 (D-303, docs/weather-scheduler-contract.md, « La relecture de la
 * journée ») : un gel apparu dans les prévisions après 6 h 15 alerte à la
 * relecture suivante, sans que personne ouvre le module ; une même alerte ne
 * part jamais deux fois ; une ferme sans alerte active n'appelle pas le
 * fournisseur, et rien d'elle ne se mêle à l'autre ferme.
 */

const TRONGET = customWeatherLocationKey('Tronget', '03240');
const VANNES = customWeatherLocationKey('Vannes', '56000');
const candidate = (city: string, latitude: number) => ({ displayName: city, city, postcode: null, latitude, longitude: 3.07, timezone: 'Europe/Paris', countryCode: 'FR' });
// Mardi 24 novembre 2026, heure de Paris : 9 h 30, 12 h 30, 15 h 30.
const AT_0930 = new Date('2026-11-24T08:30:00.000Z');
const AT_1230 = new Date('2026-11-24T11:30:00.000Z');
const AT_1530 = new Date('2026-11-24T14:30:00.000Z');

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

class ScriptedProvider implements WeatherProvider {
  readonly id = 'scripted';
  minimums: number[] = [6, 6, 6, 6, 6, 6, 6];
  failure: WeatherProviderError | null = null;
  calls: WeatherReadInput[] = [];
  async searchLocations() { return []; }
  async readForecast(input: WeatherReadInput): Promise<WeatherDailyValue[]> {
    this.calls.push(input);
    if (this.failure) throw this.failure;
    const dates = ['2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29', '2026-11-30'];
    return dates.map((date, index) => ({ date, precipitationMm: 0, et0Mm: 0.6, minimumTemperatureCelsius: this.minimums[index], maximumTemperatureCelsius: 9 }));
  }
  async readReanalysis(): Promise<WeatherDailyValue[]> {
    throw new Error('la relecture de la journée ne lit jamais la réanalyse');
  }
}

async function twoFarms() {
  // Alice : un critère de gel actif (sous 3 °C, 3 jours). Bob : aucun critère, gel et aspersions éteints.
  await saveWeatherPreferenceForUser(ALICE, { locationMode: 'custom', customCity: 'Tronget', customPostcode: '03240' });
  await saveWeatherGeocodeForUser(ALICE, TRONGET, candidate('Tronget', 46.42), 'open-meteo');
  await saveWeatherPreferenceForUser(BOB, { locationMode: 'custom', customCity: 'Vannes', customPostcode: '56000' });
  await saveWeatherGeocodeForUser(BOB, VANNES, candidate('Vannes', 47.66), 'open-meteo');
  await createWeatherAlertCriterionForUser(ALICE, {
    field: 'minimum-temperature', direction: 'below', threshold: 3, horizonDays: 3, active: true, label: 'Gel',
  });
  const saved = await saveCropAlertSettingsForUser(BOB, { frostActive: false, sprinklerActive: false });
  assert.ok(saved.ok);
  return { alice: await ensureWorkspaceForUser(ALICE), bob: await ensureWorkspaceForUser(BOB) };
}

function recording() {
  const requests: IrrigationPushSendRequest[] = [];
  const send = async (request: IrrigationPushSendRequest) => {
    requests.push(request);
    return { status: 'sent' as const };
  };
  const onForecastWritten = async (input: { workspaceId: string; locationKey: string; now: Date }) => {
    await evaluateWeatherAlertsAfterForecastWrite({ ...input, send, log: () => undefined });
    await evaluateCropAlertsAfterForecastWrite({ ...input, send, log: () => undefined });
  };
  return { requests, onForecastWritten };
}

const silent = () => undefined;
const noWait = async () => undefined;

test('un gel apparu à midi alerte à 12 h 30 sans ouverture du module, une seule fois ; la ferme sans alerte n’appelle pas le fournisseur', async () => {
  const farms = await twoFarms();
  const provider = new ScriptedProvider();
  const { requests, onForecastWritten } = recording();

  const morning = await runIntradayWeatherAlerts({ now: AT_0930, provider, onForecastWritten, sleep: noWait, log: silent });
  assert.deepEqual([morning.status, morning.targets, morning.locations, morning.forecastRequests, morning.successful], ['completed', 1, 1, 1, true]);
  assert.equal(requests.length, 0, 'aucun gel prévu à 9 h 30');
  assert.deepEqual(provider.calls.map((call) => [call.latitude, call.startDate, call.endDate]), [[46.42, '2026-11-24', '2026-11-30']], 'seul le lieu d’Alice est relu, sur 7 jours');

  provider.minimums = [6, 1.5, 6, 6, 6, 6, 6];
  await runIntradayWeatherAlerts({ now: AT_1230, provider, onForecastWritten, sleep: noWait, log: silent });
  assert.equal(requests.length, 1, 'le gel de mercredi alerte à 12 h 30');
  assert.equal(requests[0].recipientKey, farms.alice, 'vers la seule ferme d’Alice');
  assert.match(requests[0].notification.body, /1,5 °C mercredi 25 novembre/);
  const alerts = await listWeatherAlertsForWorkspace(farms.alice);
  assert.deepEqual(alerts.map((alert) => [alert.targetDate, alert.sentAt, alert.deliveryStatus]), [['2026-11-25', AT_1230.toISOString(), 'sent']]);

  provider.minimums = [6, 1, 6, 6, 6, 6, 6];
  await runIntradayWeatherAlerts({ now: AT_1530, provider, onForecastWritten, sleep: noWait, log: silent });
  assert.equal(requests.length, 1, 'la même alerte ne part jamais deux fois (critère, version, jour visé)');
  assert.equal(provider.calls.length, 3);
  assert.deepEqual(await listWeatherAlertsForWorkspace(farms.bob), [], 'rien chez Bob');

  const alice = await readWeatherPreferenceForUser(ALICE);
  assert.equal(alice.lastSuccessfulRefreshAt, AT_1530.toISOString(), 'la dernière lecture d’Alice est celle de 15 h 30');
  assert.equal(alice.lastAutomaticRefreshSuccessAt, null, 'l’état de la mise à jour du matin n’est pas touché (D-165)');
  assert.equal((await readWeatherPreferenceForUser(BOB)).lastSuccessfulRefreshAt, null, 'Bob n’a pas été relu');
  const run = (await readTaskRuns(['weather-intraday'])).get('weather-intraday')!;
  assert.equal(run.lastSuccessAt, AT_1530.toISOString());
  assert.equal(run.consecutiveFailures, 0);
});

test('un refus du fournisseur (429) ne lève pas : la tâche est manquée, sans message, et la ferme garde sa dernière lecture', async () => {
  await twoFarms();
  const provider = new ScriptedProvider();
  const { requests, onForecastWritten } = recording();
  await runIntradayWeatherAlerts({ now: AT_0930, provider, onForecastWritten, sleep: noWait, log: silent });
  provider.failure = new WeatherProviderError('Too many requests', { kind: 'rate-limit', status: 429, endpoint: 'forecast', retryAfterSeconds: 3600 });
  const result = await runIntradayWeatherAlerts({ now: AT_1230, provider, onForecastWritten, sleep: noWait, log: silent });
  assert.deepEqual([result.status, result.failedTargets, result.successful], ['completed', 1, false]);
  assert.equal(requests.length, 0);
  const run = (await readTaskRuns(['weather-intraday'])).get('weather-intraday')!;
  assert.equal(run.lastSuccessAt, AT_0930.toISOString());
  assert.equal(run.lastError, '1 lieu sur 1 sans prévisions (limite du fournisseur)');
  const alice = await readWeatherPreferenceForUser(ALICE);
  assert.equal(alice.lastSuccessfulRefreshAt, AT_0930.toISOString());
  assert.ok(alice.refreshNotBeforeAt && Date.parse(alice.refreshNotBeforeAt) > AT_1230.getTime(), 'l’attente demandée par le fournisseur est tenue');
});
