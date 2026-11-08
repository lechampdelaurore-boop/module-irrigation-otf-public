import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { upsertWeatherDailyValuesForUser } from '../../db/water-management-repository';
import {
  createWeatherAlertCriterionForUser,
  deleteWeatherAlertCriterionForUser,
  listWeatherAlertCriteriaForWorkspace,
  listWeatherAlertForecastDays,
  listWeatherAlertsForWorkspace,
  updateWeatherAlertCriterionForUser,
} from '../../db/weather-alert-repository';
import { saveFeatureSelectionForUser } from '../../db/feature-selection-repository';
import { ensureWorkspaceForUser } from '../../db/workspace-repository';
import type { IrrigationPushSendRequest } from '../../lib/domain/irrigation-push-contract';
import type { WeatherAlertCriterionSettings } from '../../lib/domain/weather/weather-alerts';
import type { WeatherDailyValue } from '../../lib/domain/weather/weather-provider';
import type { IrrigationPushSendResult } from '../../lib/services/irrigation-push-service';
import { evaluateWeatherAlertsAfterForecastWrite } from '../../lib/services/weather-alerts-service';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';

/**
 * Alertes météo, persistance et envoi (docs/weather-alerts-contract.md,
 * D-050, PR 2) : les critères et leurs versions, les températures prévues
 * conservées, l'évaluation après une écriture de prévisions, la règle de
 * répétition tenue par la base, l'isolation entre exploitations (scénario 8)
 * et l'enregistrement sans appareil abonné (scénario 9).
 */

const ALICE = 'alice';
const BOB = 'bob';
const LOCATION = 'custom:tronget:03240';
// Lundi 2 novembre 2026 : lecture de 06 h 15 et actualisation de 14 h à la ferme.
const MORNING = new Date('2026-11-02T05:15:00.000Z');
const AFTERNOON = new Date('2026-11-02T13:00:00.000Z');

const FROST: WeatherAlertCriterionSettings = {
  field: 'minimum-temperature', direction: 'below', threshold: 5, horizonDays: 3, active: true, label: null,
};

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

function forecast(minimums: readonly (number | null)[]): WeatherDailyValue[] {
  const dates = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'];
  return minimums.map((minimum, index) => ({
    date: dates[index], precipitationMm: 0, et0Mm: 1.2, minimumTemperatureCelsius: minimum, maximumTemperatureCelsius: 12,
  }));
}

async function writeForecast(owner: string, minimums: readonly (number | null)[], at: Date) {
  await upsertWeatherDailyValuesForUser(owner, LOCATION, 'forecast', forecast(minimums), 'visual-crossing', at.toISOString());
}

function recordingSender(result: IrrigationPushSendResult = { status: 'sent' }) {
  const requests: IrrigationPushSendRequest[] = [];
  const send = async (request: IrrigationPushSendRequest) => {
    requests.push(request);
    return result;
  };
  return { requests, send };
}

const silent = () => undefined;

test('les températures prévues sont conservées ; une valeur absente reste nulle et n’efface pas la précédente', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  await writeForecast(ALICE, [7, null], MORNING);
  assert.deepEqual(await listWeatherAlertForecastDays(workspaceId, LOCATION, '2026-11-02', '2026-11-04'), [
    { date: '2026-11-02', minimumTemperatureCelsius: 7, maximumTemperatureCelsius: 12, precipitationMm: 0, forecastedAt: MORNING.toISOString() },
    { date: '2026-11-03', minimumTemperatureCelsius: null, maximumTemperatureCelsius: 12, precipitationMm: 0, forecastedAt: MORNING.toISOString() },
  ]);
  await writeForecast(ALICE, [6.5], AFTERNOON);
  const [monday] = await listWeatherAlertForecastDays(workspaceId, LOCATION, '2026-11-02', '2026-11-02');
  assert.equal(monday.minimumTemperatureCelsius, 6.5);
  assert.equal(monday.forecastedAt, AFTERNOON.toISOString());
});

test('un critère se crée en version 1 ; le modifier en fait une version 2, l’activer ou le désactiver non ; le supprimer le retire', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  const created = await createWeatherAlertCriterionForUser(ALICE, FROST);
  assert.equal(created.version, 1);
  assert.deepEqual(await listWeatherAlertCriteriaForWorkspace(workspaceId), [created]);

  const paused = await updateWeatherAlertCriterionForUser(ALICE, created.id, { ...FROST, active: false });
  assert.deepEqual(paused, { ...created, active: false });
  const changed = await updateWeatherAlertCriterionForUser(ALICE, created.id, { ...FROST, threshold: 3, label: 'Gel' });
  assert.deepEqual(changed, { ...FROST, threshold: 3, label: 'Gel', id: created.id, version: 2 });
  assert.deepEqual(await listWeatherAlertCriteriaForWorkspace(workspaceId), [changed]);
  const versions = database.sqlite.prepare(
    'SELECT version, threshold, label FROM irrigation_weather_alert_criterion_versions WHERE criterion_id = ? ORDER BY version',
  ).all(created.id).map((row) => ({ ...row }));
  assert.deepEqual(versions, [{ version: 1, threshold: 5, label: null }, { version: 2, threshold: 3, label: 'Gel' }], 'la version 1 reste telle quelle');

  assert.equal(await deleteWeatherAlertCriterionForUser(ALICE, created.id), true);
  assert.deepEqual(await listWeatherAlertCriteriaForWorkspace(workspaceId), []);
  assert.equal(await deleteWeatherAlertCriterionForUser(ALICE, created.id), false);
  assert.equal(await updateWeatherAlertCriterionForUser(ALICE, created.id, FROST), null, 'un critère supprimé ne se modifie plus');
});

test('un utilisateur ne modifie ni ne supprime le critère d’une autre exploitation', async () => {
  await ensureWorkspaceForUser(BOB);
  const alices = await createWeatherAlertCriterionForUser(ALICE, FROST);
  assert.equal(await updateWeatherAlertCriterionForUser(BOB, alices.id, { ...FROST, threshold: 0 }), null);
  assert.equal(await deleteWeatherAlertCriterionForUser(BOB, alices.id), false);
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  assert.deepEqual(await listWeatherAlertCriteriaForWorkspace(workspaceId), [alices]);
});

test('la base refuse un critère hors des bornes du contrat', async () => {
  await assert.rejects(createWeatherAlertCriterionForUser(ALICE, { ...FROST, threshold: 51 }));
  await assert.rejects(createWeatherAlertCriterionForUser(ALICE, { ...FROST, field: 'precipitation', threshold: -1 }));
  await assert.rejects(createWeatherAlertCriterionForUser(ALICE, { ...FROST, horizonDays: 8 }));
});

test('scénarios 1 et 4 : l’alerte du matin part une fois pour mardi ; l’actualisation de l’après-midi n’en renvoie pas', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  const criterion = await createWeatherAlertCriterionForUser(ALICE, FROST);
  const { requests, send } = recordingSender();

  await writeForecast(ALICE, [7, 4, 6], MORNING);
  await evaluateWeatherAlertsAfterForecastWrite({ workspaceId, locationKey: LOCATION, now: MORNING, send, log: silent });
  assert.equal(requests.length, 1);
  const [request] = requests;
  assert.equal(request.recipientKey, workspaceId);
  assert.equal(request.notificationId, `weather-alert:${criterion.id}:v1:2026-11-03`);
  assert.deepEqual(request.notification, {
    title: 'Alerte météo',
    body: 'Température minimale prévue 4 °C mardi 3 novembre (seuil : sous 5 °C). Prévision du 2 novembre, 06 h 15.',
    tag: `weather-alert:${criterion.id}:v1:2026-11-03`,
    data: { url: '/irrigation/alertes-meteo?season=2026&week=2026-11-02' },
  });
  assert.deepEqual((await listWeatherAlertsForWorkspace(workspaceId)).map((alert) => ({ ...alert, id: 'x' })), [{
    id: 'x', criterionId: criterion.id, criterionVersion: 1, targetDate: '2026-11-03', forecastValue: 4, unit: '°C',
    forecastedAt: MORNING.toISOString(), sentAt: MORNING.toISOString(), deliveryStatus: 'sent',
  }]);

  await writeForecast(ALICE, [7, 3, 6], AFTERNOON);
  await evaluateWeatherAlertsAfterForecastWrite({ workspaceId, locationKey: LOCATION, now: AFTERNOON, send, log: silent });
  assert.equal(requests.length, 1, 'aucune nouvelle alerte pour mardi');
  assert.equal((await listWeatherAlertsForWorkspace(workspaceId)).length, 1);
});

test('Alertes météo décochée : rien ne s’évalue ni ne part ; recochée, l’alerte du jour part (3.8, R1, P5)', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  await createWeatherAlertCriterionForUser(ALICE, FROST);
  await saveFeatureSelectionForUser(ALICE, ['materiel', 'arrosages'], MORNING);
  const { requests, send } = recordingSender();
  await writeForecast(ALICE, [7, 4, 6], MORNING);
  await evaluateWeatherAlertsAfterForecastWrite({ workspaceId, locationKey: LOCATION, now: MORNING, send, log: silent });
  assert.equal(requests.length, 0);
  assert.deepEqual(await listWeatherAlertsForWorkspace(workspaceId), [], 'aucune alerte enregistrée');

  await saveFeatureSelectionForUser(ALICE, ['materiel', 'arrosages', 'alertes-meteo'], AFTERNOON);
  await evaluateWeatherAlertsAfterForecastWrite({ workspaceId, locationKey: LOCATION, now: AFTERNOON, send, log: silent });
  assert.equal(requests.length, 1, 'le critère, gardé, alerte de nouveau');
});

test('scénario 5 : trois jours de gel, une notification et trois alertes enregistrées', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  await createWeatherAlertCriterionForUser(ALICE, FROST);
  const { requests, send } = recordingSender();
  await writeForecast(ALICE, [2, 1, 3], MORNING);
  await evaluateWeatherAlertsAfterForecastWrite({ workspaceId, locationKey: LOCATION, now: MORNING, send, log: silent });
  assert.equal(requests.length, 1);
  assert.match(requests[0].notification.body, /lundi 2 novembre, et 2 autres jours/);
  assert.deepEqual((await listWeatherAlertsForWorkspace(workspaceId)).map((alert) => [alert.targetDate, alert.forecastValue, alert.deliveryStatus]), [
    ['2026-11-02', 2, 'sent'], ['2026-11-03', 1, 'sent'], ['2026-11-04', 3, 'sent'],
  ]);
});

test('modifier le critère remet ses jours à zéro : la nouvelle version peut alerter de nouveau', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  const criterion = await createWeatherAlertCriterionForUser(ALICE, FROST);
  const { requests, send } = recordingSender();
  await writeForecast(ALICE, [7, 4, 6], MORNING);
  await evaluateWeatherAlertsAfterForecastWrite({ workspaceId, locationKey: LOCATION, now: MORNING, send, log: silent });
  await updateWeatherAlertCriterionForUser(ALICE, criterion.id, { ...FROST, threshold: 4.5 });
  await evaluateWeatherAlertsAfterForecastWrite({ workspaceId, locationKey: LOCATION, now: AFTERNOON, send, log: silent });
  assert.deepEqual(requests.map((request) => request.notificationId), [
    `weather-alert:${criterion.id}:v1:2026-11-03`, `weather-alert:${criterion.id}:v2:2026-11-03`,
  ]);

  await updateWeatherAlertCriterionForUser(ALICE, criterion.id, { ...FROST, threshold: 4.5, active: false });
  await updateWeatherAlertCriterionForUser(ALICE, criterion.id, { ...FROST, threshold: 4.5, active: true });
  await evaluateWeatherAlertsAfterForecastWrite({ workspaceId, locationKey: LOCATION, now: AFTERNOON, send, log: silent });
  assert.equal(requests.length, 2, 'désactiver puis réactiver ne fait pas renvoyer');
});

test('scénarios 3 et 7 : une prévision absente, un critère inactif ou supprimé ne déclenchent rien', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  const criterion = await createWeatherAlertCriterionForUser(ALICE, FROST);
  const { requests, send } = recordingSender();
  await writeForecast(ALICE, [7, null, 6], MORNING);
  await evaluateWeatherAlertsAfterForecastWrite({ workspaceId, locationKey: LOCATION, now: MORNING, send, log: silent });
  assert.equal(requests.length, 0, 'une température absente n’est pas 0 °C');

  await writeForecast(ALICE, [2, 1, 3], AFTERNOON);
  await updateWeatherAlertCriterionForUser(ALICE, criterion.id, { ...FROST, active: false });
  await evaluateWeatherAlertsAfterForecastWrite({ workspaceId, locationKey: LOCATION, now: AFTERNOON, send, log: silent });
  await updateWeatherAlertCriterionForUser(ALICE, criterion.id, FROST);
  await deleteWeatherAlertCriterionForUser(ALICE, criterion.id);
  await evaluateWeatherAlertsAfterForecastWrite({ workspaceId, locationKey: LOCATION, now: AFTERNOON, send, log: silent });
  assert.equal(requests.length, 0);
  assert.deepEqual(await listWeatherAlertsForWorkspace(workspaceId), []);
});

test('scénario 8 : le critère franchi de l’exploitation A n’envoie rien vers l’exploitation B', async () => {
  const alice = await ensureWorkspaceForUser(ALICE);
  const bob = await ensureWorkspaceForUser(BOB);
  await createWeatherAlertCriterionForUser(ALICE, FROST);
  await createWeatherAlertCriterionForUser(BOB, FROST);
  const { requests, send } = recordingSender();
  await writeForecast(ALICE, [7, 4, 6], MORNING);
  await writeForecast(BOB, [7, 8, 9], MORNING);
  await evaluateWeatherAlertsAfterForecastWrite({ workspaceId: alice, locationKey: LOCATION, now: MORNING, send, log: silent });
  await evaluateWeatherAlertsAfterForecastWrite({ workspaceId: bob, locationKey: LOCATION, now: MORNING, send, log: silent });
  assert.deepEqual(requests.map((request) => request.recipientKey), [alice]);
  assert.equal((await listWeatherAlertsForWorkspace(bob)).length, 0);
  assert.equal((await listWeatherAlertsForWorkspace(alice)).length, 1);
});

test('scénario 9 : sans appareil abonné, l’alerte est enregistrée « aucun appareil abonné » et rien ne lève', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  await createWeatherAlertCriterionForUser(ALICE, FROST);
  const { send } = recordingSender({ status: 'no-subscriber' });
  await writeForecast(ALICE, [7, 4, 6], MORNING);
  await evaluateWeatherAlertsAfterForecastWrite({ workspaceId, locationKey: LOCATION, now: MORNING, send, log: silent });
  assert.deepEqual((await listWeatherAlertsForWorkspace(workspaceId)).map((alert) => alert.deliveryStatus), ['no-subscriber']);
});

test('une panne du service de notification est enregistrée comme échec, sans lever ni renvoyer ensuite', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  await createWeatherAlertCriterionForUser(ALICE, FROST);
  await writeForecast(ALICE, [7, 4, 6], MORNING);
  const lines: Array<{ level: string; entry: Record<string, unknown> }> = [];
  let calls = 0;
  await evaluateWeatherAlertsAfterForecastWrite({
    workspaceId, locationKey: LOCATION, now: MORNING,
    send: async () => { calls += 1; throw new Error('réseau'); },
    log: (level, entry) => { lines.push({ level, entry }); },
  });
  assert.deepEqual((await listWeatherAlertsForWorkspace(workspaceId)).map((alert) => alert.deliveryStatus), ['failed']);
  assert.equal(lines[0]?.level, 'warn');
  assert.equal(JSON.stringify(lines).includes(ALICE), false, 'le journal ne nomme personne');
  await evaluateWeatherAlertsAfterForecastWrite({
    workspaceId, locationKey: LOCATION, now: AFTERNOON, send: async () => { calls += 1; return { status: 'sent' }; }, log: silent,
  });
  assert.equal(calls, 1, 'les tentatives sont celles du Worker, pas une relance de l’application');

  for (const result of [{ status: 'disabled' }, { status: 'unreachable', message: 'Le service d’alerte a répondu 404.' }] as const) {
    database.sqlite.exec('DELETE FROM irrigation_weather_alerts');
    await evaluateWeatherAlertsAfterForecastWrite({ workspaceId, locationKey: LOCATION, now: AFTERNOON, send: async () => result, log: silent });
    assert.deepEqual((await listWeatherAlertsForWorkspace(workspaceId)).map((alert) => alert.deliveryStatus), ['failed'], result.status);
  }
});

test('deux évaluations qui se croisent n’envoient qu’une notification pour le même jour', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  await createWeatherAlertCriterionForUser(ALICE, FROST);
  await writeForecast(ALICE, [7, 4, 6], MORNING);
  const { requests, send } = recordingSender();
  await Promise.all([
    evaluateWeatherAlertsAfterForecastWrite({ workspaceId, locationKey: LOCATION, now: MORNING, send, log: silent }),
    evaluateWeatherAlertsAfterForecastWrite({ workspaceId, locationKey: LOCATION, now: MORNING, send, log: silent }),
  ]);
  assert.equal(requests.length, 1);
  assert.equal((await listWeatherAlertsForWorkspace(workspaceId)).length, 1);
});

test('une panne de la base pendant l’évaluation ne lève pas : la synchronisation météo n’en souffre pas', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  await createWeatherAlertCriterionForUser(ALICE, FROST);
  database.sqlite.exec('DROP TABLE irrigation_weather_alerts');
  await writeForecast(ALICE, [7, 4, 6], MORNING);
  const lines: string[] = [];
  await evaluateWeatherAlertsAfterForecastWrite({
    workspaceId, locationKey: LOCATION, now: MORNING, send: async () => ({ status: 'sent' }), log: (_level, entry) => { lines.push(String(entry.event)); },
  });
  assert.deepEqual(lines, ['weather_alert_evaluation_failed']);
});
