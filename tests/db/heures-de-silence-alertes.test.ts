import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { listCropAlertHistory } from '../../db/crop-alerts/alerts';
import { saveDryingDaysForUser, saveFrostLinkForUser } from '../../db/crop-alerts/inputs';
import { saveQuietHoursForUser } from '../../db/phone-notice-repository';
import { upsertWeatherDailyValuesForUser } from '../../db/water-management-repository';
import { createWeatherAlertCriterionForUser, listWeatherAlertsForWorkspace } from '../../db/weather-alert-repository';
import { ensureWorkspaceForUser } from '../../db/workspace-repository';
import type { IrrigationPushAlarmRequest, IrrigationPushSendRequest } from '../../lib/domain/irrigation-push-contract';
import { quietHoldAlarmId, type QuietHoursSettings } from '../../lib/domain/notification-quiet-hours';
import { addDaysToDateKey, dateKeyInTimeZone, FARM_TIME_ZONE, localDateTimeUtc } from '../../lib/domain/water-management';
import type { WeatherAlertCriterionSettings } from '../../lib/domain/weather/weather-alerts';
import type { WeatherDailyValue } from '../../lib/domain/weather/weather-provider';
import { evaluateCropAlertsAfterForecastWrite, evaluateCropDryingForAllWorkspaces } from '../../lib/services/crop-alerts-service';
import { readCropAlertsView } from '../../lib/services/crop-alerts-view';
import { readCachedIrrigationSnapshot } from '../../lib/services/irrigation-service';
import { evaluateWeatherAlertsAfterForecastWrite } from '../../lib/services/weather-alerts-service';
import { readWeatherAlertsView } from '../../lib/services/weather-alerts-view';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { ALICE, BOB } from '../support/spaces';

/**
 * Les heures de silence et les alertes (6 undecies, PR H2,
 * docs/heures-de-silence-contract.md, sections 3, 5 et 8 ; D-322) : les
 * alertes météo et par culture lisent la règle à l'instant de leur envoi,
 * avec le réglage de leur ferme. Dans la plage, le message est retenu par
 * une alarme du Worker, simulé ici, à échéance de la fin de la plage, sous
 * un identifiant qui porte l'espace (S10) ; le gel passe, case cochée (S3) ;
 * l'alerte est enregistrée à son heure et l'historique dit jusqu'à quand son
 * message attend (S9) ; une retenue refusée part tout de suite (S8).
 */

const LOCATION = 'custom:tronget:03240';
/** Lundi 2 novembre 2026, 21 h 30 à Paris : la lecture des prévisions du soir. */
const AT_21_30 = new Date('2026-11-02T20:30:00.000Z');
/** Lundi 2 novembre 2026, 23 h à Paris. */
const AT_23_00 = new Date('2026-11-02T22:00:00.000Z');
/** Mardi 3 novembre 2026, 7 h à Paris : la fin d'une plage de 21 h à 7 h. */
const END_7_00 = '2026-11-03T06:00:00.000Z';
const SAVED_AT = '2026-11-02T12:00:00.000Z';
const NIGHT: QuietHoursSettings = { enabled: true, start: '21:00', end: '07:00', frostPasses: true };

const criterion = (settings: Pick<WeatherAlertCriterionSettings, 'field' | 'direction' | 'threshold'>): WeatherAlertCriterionSettings =>
  ({ ...settings, horizonDays: 3, active: true, label: null });
/** S3 : du gel, la minimale « en dessous de ». */
const FROST = criterion({ field: 'minimum-temperature', direction: 'below', threshold: 5 });
/** Une maximale haute : jamais du gel (scénario 8). */
const HEAT = criterion({ field: 'maximum-temperature', direction: 'above', threshold: 10 });
/** Une maximale basse : pas du gel, même pour un seuil bas, le module ne devine pas l'intention. */
const COLD_DAY = criterion({ field: 'maximum-temperature', direction: 'below', threshold: 15 });
/** Une minimale haute : pas du gel. */
const WARM_NIGHT = criterion({ field: 'minimum-temperature', direction: 'above', threshold: 6 });

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

async function writeForecast(owner: string, minimums: readonly number[], at: Date) {
  const values: WeatherDailyValue[] = minimums.map((minimum, index) => ({
    date: addDaysToDateKey('2026-11-02', index), precipitationMm: 0, et0Mm: 1.2, minimumTemperatureCelsius: minimum, maximumTemperatureCelsius: 12,
  }));
  await upsertWeatherDailyValuesForUser(owner, LOCATION, 'forecast', values, 'visual-crossing', at.toISOString());
}

type Line = { level: string; entry: Record<string, unknown> };

/** Le Worker de notification simulé : l'envoi immédiat, et l'alarme qui retient, avec sa réponse. */
function worker(alarm: 'ok' | 'stale' | 'failed' | 'disabled' | 'throw' = 'ok') {
  const sent: IrrigationPushSendRequest[] = [];
  const held: IrrigationPushAlarmRequest[] = [];
  const lines: Line[] = [];
  return {
    sent,
    held,
    lines,
    send: async (request: IrrigationPushSendRequest) => { sent.push(request); return { status: 'sent' as const }; },
    schedule: async (request: IrrigationPushAlarmRequest) => {
      held.push(request);
      if (alarm === 'throw') throw new Error('réseau coupé');
      if (alarm === 'failed') return { status: 'failed' as const, message: 'Le service d’alerte a répondu 500.' };
      return { status: alarm };
    },
    log: (level: string, entry: Record<string, unknown>) => { lines.push({ level, entry }); },
  };
}

async function evaluate(workspaceId: string, now: Date, calls: ReturnType<typeof worker>) {
  await evaluateWeatherAlertsAfterForecastWrite({ workspaceId, locationKey: LOCATION, now, send: calls.send, schedule: calls.schedule, log: calls.log });
}

async function recorded(workspaceId: string) {
  return (await listWeatherAlertsForWorkspace(workspaceId)).map((alert) => [alert.targetDate, alert.sentAt, alert.deliveryStatus, alert.heldUntil]);
}

function events(lines: readonly Line[]): string[] {
  return lines.map((line) => String(line.entry.event));
}

test('scénario 13 : la même alerte de chaleur à 21 h 30 ; A, plage de 21 h à 7 h, la retient jusqu’à 7 h sous un identifiant à son espace, B la reçoit tout de suite (S4, S9, S10)', async () => {
  const alice = await ensureWorkspaceForUser(ALICE);
  const bob = await ensureWorkspaceForUser(BOB);
  await saveQuietHoursForUser(ALICE, ALICE, NIGHT, SAVED_AT);
  const heat = await createWeatherAlertCriterionForUser(ALICE, HEAT);
  await createWeatherAlertCriterionForUser(BOB, HEAT);
  await writeForecast(ALICE, [7, 8, 9], AT_21_30);
  await writeForecast(BOB, [7, 8, 9], AT_21_30);
  const calls = worker();
  await evaluate(alice, AT_21_30, calls);
  await evaluate(bob, AT_21_30, calls);

  assert.deepEqual(calls.sent.map((request) => request.recipientKey), [bob], 'B : tout de suite, comme avant');
  assert.equal(calls.held.length, 1, 'A : une seule retenue');
  const [hold] = calls.held;
  const tag = `weather-alert:${heat.id}:v1:2026-11-02`;
  assert.equal(hold.notification.tag, tag, 'sous son étiquette');
  assert.equal(hold.eventEquipmentId, quietHoldAlarmId(alice, tag));
  assert.ok(hold.eventEquipmentId.startsWith(`quiet:${alice}:`), 'l’identifiant porte l’espace de A (S10)');
  assert.equal(hold.recipientKey, alice);
  assert.equal(hold.dueAt, END_7_00, 'à la fin de la plage, 7 h à Paris');
  assert.match(hold.revision, /^\d{13}-[0-9a-f-]{36}$/u, 'une révision neuve, datée');
  const [bobs] = calls.sent;
  assert.deepEqual({ ...hold.notification, tag: '' }, { ...bobs.notification, tag: '' }, 'même titre, même texte, même page ouverte au toucher');

  const night = [AT_21_30.toISOString(), 'sent', END_7_00];
  assert.deepEqual(await recorded(alice), [['2026-11-02', ...night], ['2026-11-03', ...night], ['2026-11-04', ...night]], 'enregistrée à son heure (S9)');
  assert.deepEqual(await recorded(bob), ['2026-11-02', '2026-11-03', '2026-11-04'].map((date) => [date, AT_21_30.toISOString(), 'sent', null]));
  const aliceLine = calls.lines.find((line) => line.entry.heldUntil !== undefined);
  assert.deepEqual([aliceLine?.level, aliceLine?.entry.event, aliceLine?.entry.deliveryStatus, aliceLine?.entry.heldUntil], ['info', 'weather_alert_evaluated', 'sent', END_7_00]);
  const logged = JSON.stringify(calls.lines);
  assert.ok(![ALICE, BOB, alice, bob].some((id) => logged.includes(id)), 'le journal ne nomme ni ferme ni personne');

  const label = async (workspaceId: string, now: Date) => (await readWeatherAlertsView({ workspaceId, locationKey: LOCATION, now })).history[0]?.deliveryLabel;
  assert.equal(await label(alice, AT_21_30), 'Retenue jusqu’à 7 h (heures de silence)');
  assert.equal(await label(alice, new Date(Date.parse(END_7_00) - 60_000)), 'Retenue jusqu’à 7 h (heures de silence)');
  assert.equal(await label(alice, new Date(END_7_00)), 'Envoyée à 7 h, à la fin des heures de silence');
  assert.equal(await label(bob, new Date(END_7_00)), 'Envoyée');
});

test('scénarios 5 à 8 (S3) : à 23 h, le critère de gel part tout de suite, case cochée ; les autres critères attendent 7 h ; case décochée, le gel attend aussi', async () => {
  const alice = await ensureWorkspaceForUser(ALICE);
  const bob = await ensureWorkspaceForUser(BOB);
  await saveQuietHoursForUser(ALICE, ALICE, NIGHT, SAVED_AT);
  await saveQuietHoursForUser(BOB, BOB, { ...NIGHT, frostPasses: false }, SAVED_AT);
  const frost = await createWeatherAlertCriterionForUser(ALICE, FROST);
  const coldDay = await createWeatherAlertCriterionForUser(ALICE, COLD_DAY);
  const warmNight = await createWeatherAlertCriterionForUser(ALICE, WARM_NIGHT);
  const bobsFrost = await createWeatherAlertCriterionForUser(BOB, FROST);
  await writeForecast(ALICE, [7, 4, 6], AT_23_00);
  await writeForecast(BOB, [7, 4, 6], AT_23_00);
  const calls = worker();
  await evaluate(alice, AT_23_00, calls);
  await evaluate(bob, AT_23_00, calls);

  const criterionOf = (tag: string) => tag.split(':')[1];
  assert.deepEqual(calls.sent.map((request) => criterionOf(request.notification.tag)), [frost.id], 'le gel de A passe');
  assert.deepEqual(
    calls.held.map((request) => [criterionOf(request.notification.tag), request.recipientKey, request.dueAt]).sort(),
    [[coldDay.id, alice, END_7_00], [warmNight.id, alice, END_7_00], [bobsFrost.id, bob, END_7_00]].sort(),
    'une maximale basse et une minimale haute ne sont pas du gel ; le gel de B, case décochée, attend',
  );
  const byCriterion = async (workspaceId: string) => new Map((await listWeatherAlertsForWorkspace(workspaceId)).map((alert) => [alert.criterionId, alert.heldUntil]));
  const alices = await byCriterion(alice);
  assert.deepEqual([alices.get(frost.id), alices.get(coldDay.id), alices.get(warmNight.id)], [null, END_7_00, END_7_00]);
  assert.equal((await byCriterion(bob)).get(bobsFrost.id), END_7_00);
});

test('scénario 16, S8 : une retenue refusée ou un service injoignable, l’alerte part tout de suite et l’incident se dit sans nom ; une retenue plus récente déjà gardée (stale) la retient ; sans service configuré, elle part comme avant', async () => {
  const alice = await ensureWorkspaceForUser(ALICE);
  await saveQuietHoursForUser(ALICE, ALICE, NIGHT, SAVED_AT);
  await createWeatherAlertCriterionForUser(ALICE, HEAT);
  await writeForecast(ALICE, [7, 8, 9], AT_23_00);

  for (const [answer, error] of [['failed', 'Le service d’alerte a répondu 500.'], ['throw', 'réseau coupé']] as const) {
    database.sqlite.exec('DELETE FROM irrigation_weather_alerts');
    const calls = worker(answer);
    await evaluate(alice, AT_23_00, calls);
    assert.equal(calls.held.length, 1, `${answer} : la retenue est tentée`);
    assert.equal(calls.sent.length, 1, `${answer} : puis l’alerte part tout de suite, plutôt que perdue`);
    assert.deepEqual(calls.sent[0].notification, calls.held[0].notification, `${answer} : la même notification`);
    assert.deepEqual((await recorded(alice)).map((row) => row.slice(2)), [['sent', null], ['sent', null], ['sent', null]], `${answer} : enregistrée comme partie, sans retenue`);
    const incident = calls.lines.find((line) => line.entry.event === 'quiet_hold_failed');
    assert.deepEqual([incident?.level, incident?.entry.error], ['warn', error], `${answer} : l’incident se dit`);
    assert.ok(![ALICE, alice].some((id) => JSON.stringify(calls.lines).includes(id)), `${answer} : sans nom`);
  }

  database.sqlite.exec('DELETE FROM irrigation_weather_alerts');
  const stale = worker('stale');
  await evaluate(alice, AT_23_00, stale);
  assert.deepEqual([stale.held.length, stale.sent.length], [1, 0], 'stale : le Worker garde déjà une retenue plus récente de la même étiquette');
  assert.deepEqual((await recorded(alice)).map((row) => row.slice(2)), [['sent', END_7_00], ['sent', END_7_00], ['sent', END_7_00]]);
  assert.ok(!events(stale.lines).includes('quiet_hold_failed'));

  database.sqlite.exec('DELETE FROM irrigation_weather_alerts');
  const unconfigured = worker('disabled');
  await evaluate(alice, AT_23_00, unconfigured);
  assert.deepEqual([unconfigured.held.length, unconfigured.sent.length], [1, 1], 'sans service configuré : l’envoi immédiat, comme avant');
  assert.ok(!events(unconfigured.lines).includes('quiet_hold_failed'), 'rien à dire : il n’y a pas d’incident');
});

test('S2, scénario 12 : une plage éteinte ou jamais réglée ne change rien, l’alerte de 23 h part tout de suite', async () => {
  const alice = await ensureWorkspaceForUser(ALICE);
  const bob = await ensureWorkspaceForUser(BOB);
  await saveQuietHoursForUser(ALICE, ALICE, { ...NIGHT, enabled: false }, SAVED_AT);
  await createWeatherAlertCriterionForUser(ALICE, HEAT);
  await createWeatherAlertCriterionForUser(BOB, HEAT);
  await writeForecast(ALICE, [7, 8, 9], AT_23_00);
  await writeForecast(BOB, [7, 8, 9], AT_23_00);
  const calls = worker();
  await evaluate(alice, AT_23_00, calls);
  await evaluate(bob, AT_23_00, calls);
  assert.deepEqual(calls.sent.map((request) => request.recipientKey), [alice, bob]);
  assert.deepEqual(calls.held, [], 'aucune retenue');
  assert.ok(!events(calls.lines).some((event) => event.startsWith('quiet_')), 'aucun message de plus');
});

test('S17 et S8 : un réglage corrompu en base ou illisible, l’alerte part tout de suite et le défaut se dit sans nom', async () => {
  const alice = await ensureWorkspaceForUser(ALICE);
  await saveQuietHoursForUser(ALICE, ALICE, NIGHT, SAVED_AT);
  await createWeatherAlertCriterionForUser(ALICE, HEAT);
  await writeForecast(ALICE, [7, 8, 9], AT_23_00);
  database.sqlite.exec('PRAGMA ignore_check_constraints = ON');
  try {
    database.sqlite.prepare("UPDATE irrigation_phone_notice_settings SET quiet_start = '15:00' WHERE workspace_id = ?").run(alice);
  } finally {
    database.sqlite.exec('PRAGMA ignore_check_constraints = OFF');
  }
  const corrupted = worker();
  await evaluate(alice, AT_23_00, corrupted);
  assert.deepEqual([corrupted.sent.length, corrupted.held.length], [1, 0], 'le réglage corrompu est ignoré comme éteint');
  const defect = corrupted.lines.find((line) => line.entry.event === 'quiet_hours_defect');
  assert.deepEqual([defect?.level, defect?.entry.defect], ['warn', 'invalid-setting']);

  database.sqlite.exec('DELETE FROM irrigation_weather_alerts');
  database.sqlite.exec('DROP TABLE irrigation_phone_notice_settings');
  const unreadable = worker();
  await evaluate(alice, AT_23_00, unreadable);
  assert.deepEqual([unreadable.sent.length, unreadable.held.length], [1, 0], 'illisible, la plage compte pour éteinte');
  assert.deepEqual((await recorded(alice)).map((row) => row.slice(2)), [['sent', null], ['sent', null], ['sent', null]]);
  assert.equal(unreadable.lines.find((line) => line.entry.event === 'quiet_hours_unreadable')?.level, 'warn');
  assert.ok(![ALICE, alice].some((id) => JSON.stringify([...corrupted.lines, ...unreadable.lines]).includes(id)), 'sans nom');
});

test('les alertes par culture à 22 h 30 : le gel part, case cochée ; retenu case décochée ; l’arrêt d’arrosage avant récolte attend 7 h, et l’encart le dit (S3, S4, S9)', async () => {
  const today = dateKeyInTimeZone(new Date(), FARM_TIME_ZONE);
  const at = localDateTimeUtc(today, { hour: 22, minute: 30, second: 0 }, FARM_TIME_ZONE);
  const end = localDateTimeUtc(addDaysToDateKey(today, 1), { hour: 7, minute: 0, second: 0 }, FARM_TIME_ZONE).toISOString();
  const alice = await ensureWorkspaceForUser(ALICE);
  const bob = await ensureWorkspaceForUser(BOB);
  await saveQuietHoursForUser(ALICE, ALICE, NIGHT, SAVED_AT);
  await saveQuietHoursForUser(BOB, BOB, { ...NIGHT, frostPasses: false }, SAVED_AT);
  for (const owner of [ALICE, BOB]) {
    assert.equal((await saveFrostLinkForUser(owner, { plantId: 'plante-carotte', seriesId: null, commonKey: 'carotte' })).ok, true);
    await upsertWeatherDailyValuesForUser(owner, LOCATION, 'forecast', [6, -5, 2].map((minimum, index) => ({
      date: addDaysToDateKey(today, index), precipitationMm: 0, et0Mm: 1, minimumTemperatureCelsius: minimum, maximumTemperatureCelsius: 15,
    })), 'visual-crossing', at.toISOString());
  }
  assert.equal((await saveDryingDaysForUser(ALICE, { plantId: 'plante-carotte', dryingDays: '60' })).ok, true);

  const calls = worker();
  await evaluateCropAlertsAfterForecastWrite({ workspaceId: alice, locationKey: LOCATION, now: at, send: calls.send, schedule: calls.schedule, log: calls.log });
  await evaluateCropAlertsAfterForecastWrite({ workspaceId: bob, locationKey: LOCATION, now: at, send: calls.send, schedule: calls.schedule, log: calls.log });
  assert.deepEqual(calls.sent.map((request) => [request.recipientKey, request.notification.title]), [[alice, 'Alerte gel']], 'le gel de A passe');
  assert.deepEqual(calls.held.map((request) => [request.recipientKey, request.notification.title, request.dueAt]), [[bob, 'Alerte gel', end]], 'case décochée, le gel de B attend 7 h');
  assert.equal(calls.held[0].eventEquipmentId, quietHoldAlarmId(bob, calls.held[0].notification.tag));

  assert.deepEqual(await evaluateCropDryingForAllWorkspaces({ now: at, send: calls.send, schedule: calls.schedule, log: calls.log }), { evaluated: 2, failed: 0 });
  assert.deepEqual(calls.held.slice(1).map((request) => [request.recipientKey, request.notification.title, request.dueAt]), [[alice, 'Alerte récolte', end]], 'le séchage n’est pas du gel');
  assert.equal(calls.sent.length, 1);

  const history = async (workspaceId: string) => (await listCropAlertHistory(workspaceId, 10)).map((alert) => [alert.kind, alert.sentAt, alert.deliveryStatus, alert.heldUntil]).sort();
  assert.deepEqual(await history(alice), [['drying', at.toISOString(), 'sent', end], ['frost', at.toISOString(), 'sent', null]]);
  assert.deepEqual(await history(bob), [['frost', at.toISOString(), 'sent', end]]);

  const season = Number(today.slice(0, 4));
  const snapshot = await readCachedIrrigationSnapshot(ALICE, season);
  assert.ok(snapshot);
  const labels = async (now: Date) => new Map((await readCropAlertsView({ ownerUserId: ALICE, workspaceId: alice, locationKey: LOCATION, snapshot, season, now }))
    ?.history.map((entry) => [entry.kind, entry.deliveryLabel]));
  assert.deepEqual([...(await labels(at))].sort(), [['drying', 'Retenue jusqu’à 7 h (heures de silence)'], ['frost', 'Envoyée']]);
  assert.equal((await labels(new Date(end))).get('drying'), 'Envoyée à 7 h, à la fin des heures de silence');
  assert.ok(![ALICE, BOB, alice, bob].some((id) => JSON.stringify(calls.lines).includes(id)), 'le journal ne nomme ni ferme ni personne');
});
