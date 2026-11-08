import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { listWeatherDailyValuesForUser, upsertWeatherDailyValuesForUser } from '../../db/water-management-repository';
import {
  createWeatherAlertCriterionForUser,
  deleteWeatherAlertCriterionForUser,
  updateWeatherAlertCriterionForUser,
} from '../../db/weather-alert-repository';
import { ensureWorkspaceForUser } from '../../db/workspace-repository';
import type { WeatherAlertCriterionSettings } from '../../lib/domain/weather/weather-alerts';
import type { WeatherDailyValue } from '../../lib/domain/weather/weather-provider';
import { evaluateWeatherAlertsAfterForecastWrite } from '../../lib/services/weather-alerts-service';
import { readWeatherAlertsView } from '../../lib/services/weather-alerts-view';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';

/**
 * L'encart « Alertes météo » (docs/weather-alerts-contract.md, « L'écran »,
 * PR 3) : chaque critère avec sa phrase, les jours sans prévision et sa
 * dernière alerte ; l'historique, plus récente en premier, garde le critère
 * tel qu'il était à l'envoi (D-006) ; rien ne passe d'une exploitation à
 * l'autre.
 */

const ALICE = 'alice';
const BOB = 'bob';
const LOCATION = 'custom:tronget:03240';
const MORNING = new Date('2026-11-02T05:15:00.000Z');
const AFTERNOON = new Date('2026-11-02T13:00:00.000Z');
const FROST: WeatherAlertCriterionSettings = {
  field: 'minimum-temperature', direction: 'below', threshold: 5, horizonDays: 3, active: true, label: 'Gel sur les tomates',
};

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

const sent = async () => ({ status: 'sent' as const });
const silent = () => undefined;

async function writeForecast(owner: string, minimums: readonly (number | null)[], at: Date) {
  const dates = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'];
  const values: WeatherDailyValue[] = minimums.map((minimum, index) => ({
    date: dates[index], precipitationMm: 0, et0Mm: 1.2, minimumTemperatureCelsius: minimum, maximumTemperatureCelsius: 13.8,
  }));
  await upsertWeatherDailyValuesForUser(owner, LOCATION, 'forecast', values, 'visual-crossing', at.toISOString());
}

test('sans alerte : le critère a sa phrase, signale le jour sans prévision et n’a pas encore d’alerte', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  await createWeatherAlertCriterionForUser(ALICE, FROST);
  await writeForecast(ALICE, [7, null, 6], MORNING);
  const view = await readWeatherAlertsView({ workspaceId, locationKey: LOCATION, now: MORNING });
  assert.equal(view.criteria.length, 1);
  const [{ summary, unavailableMessage, lastAlert }] = view.criteria;
  assert.equal(summary, 'Température minimale prévue en dessous de 5 °C (5 °C non compris), sur 3 jours, aujourd’hui compris');
  assert.equal(unavailableMessage, 'Prévision indisponible pour le mardi 3 novembre.');
  assert.equal(lastAlert, null);
  assert.deepEqual(view.history, []);
});

test('l’historique, plus récente en premier, garde le critère tel qu’il était à l’envoi ; la dernière alerte suit le critère', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  const criterion = await createWeatherAlertCriterionForUser(ALICE, FROST);
  await writeForecast(ALICE, [7, 4, 6], MORNING);
  await evaluateWeatherAlertsAfterForecastWrite({ workspaceId, locationKey: LOCATION, now: MORNING, send: sent, log: silent });
  await updateWeatherAlertCriterionForUser(ALICE, criterion.id, { ...FROST, threshold: 6.5, label: null });
  await evaluateWeatherAlertsAfterForecastWrite({ workspaceId, locationKey: LOCATION, now: AFTERNOON, send: sent, log: silent });

  const view = await readWeatherAlertsView({ workspaceId, locationKey: LOCATION, now: AFTERNOON });
  assert.deepEqual(view.history.map((entry) => [entry.sentAt, entry.criterionVersion, entry.targetDate, entry.forecastValue, entry.label]), [
    [AFTERNOON.toISOString(), 2, '2026-11-03', '4 °C', null],
    [AFTERNOON.toISOString(), 2, '2026-11-04', '6 °C', null],
    [MORNING.toISOString(), 1, '2026-11-03', '4 °C', 'Gel sur les tomates'],
  ]);
  const first = view.history[2];
  assert.equal(first.criterionSummary, 'Température minimale prévue en dessous de 5 °C (5 °C non compris), sur 3 jours, aujourd’hui compris');
  assert.equal(first.deliveryLabel, 'Envoyée');
  assert.equal(first.url, '/irrigation/alertes-meteo?season=2026&week=2026-11-02');
  assert.equal(view.criteria[0].criterion.version, 2);
  assert.equal(view.criteria[0].lastAlert?.criterionVersion, 2);
  assert.equal(view.criteria[0].lastAlert?.targetDate, '2026-11-03');
});

test('un critère supprimé quitte la liste ; ses alertes restent dans l’historique', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  const criterion = await createWeatherAlertCriterionForUser(ALICE, FROST);
  await writeForecast(ALICE, [7, 4, 6], MORNING);
  await evaluateWeatherAlertsAfterForecastWrite({ workspaceId, locationKey: LOCATION, now: MORNING, send: sent, log: silent });
  assert.equal(await deleteWeatherAlertCriterionForUser(ALICE, criterion.id), true);
  const view = await readWeatherAlertsView({ workspaceId, locationKey: LOCATION, now: AFTERNOON });
  assert.deepEqual(view.criteria, []);
  assert.equal(view.history.length, 1);
});

test('l’exploitation B ne voit ni les critères ni l’historique de l’exploitation A', async () => {
  const workspaceA = await ensureWorkspaceForUser(ALICE);
  const workspaceB = await ensureWorkspaceForUser(BOB);
  await createWeatherAlertCriterionForUser(ALICE, FROST);
  await writeForecast(ALICE, [7, 4, 6], MORNING);
  await evaluateWeatherAlertsAfterForecastWrite({ workspaceId: workspaceA, locationKey: LOCATION, now: MORNING, send: sent, log: silent });
  assert.deepEqual(await readWeatherAlertsView({ workspaceId: workspaceB, locationKey: LOCATION, now: MORNING }), { criteria: [], history: [] });
  assert.deepEqual(await readWeatherAlertsView({ workspaceId: null, locationKey: LOCATION, now: MORNING }), { criteria: [], history: [] });
});

test('la semaine de la météo montre les températures prévues ; une valeur absente reste nulle', async () => {
  await ensureWorkspaceForUser(ALICE);
  await writeForecast(ALICE, [2.6, null], MORNING);
  const rows = await listWeatherDailyValuesForUser(ALICE, LOCATION, '2026-11-02', '2026-11-03');
  assert.deepEqual(rows.map((row) => [row.date, row.minimumTemperatureCelsius, row.maximumTemperatureCelsius]), [
    ['2026-11-02', 2.6, 13.8],
    ['2026-11-03', null, 13.8],
  ]);
});
