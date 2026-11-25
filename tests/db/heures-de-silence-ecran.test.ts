import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { createIrrigationEventForUser } from '../../db/irrigation-event/create';
import { getIrrigationPushScheduleForUser } from '../../db/irrigation-event/push-schedule';
import {
  InvalidQuietHoursError,
  lastAlertFoundNoDeviceForUser,
  readPhoneNoticeSettingsForUser,
  saveQuietHoursForUser,
} from '../../db/phone-notice-repository';
import { createWeatherAlertCriterionForUser } from '../../db/weather-alert-repository';
import { ensureWorkspaceForUser } from '../../db/workspace-repository';
import type { IrrigationPushAlarmRequest } from '../../lib/domain/irrigation-push-contract';
import { DEFAULT_QUIET_HOURS, type QuietHoursSettings } from '../../lib/domain/notification-quiet-hours';
import type { WeatherAlertCriterionSettings } from '../../lib/domain/weather/weather-alerts';
import { pushAlarmRequest, rescheduleLateAlarmsForQuietHours, synchronizeIrrigationPushSchedule } from '../../lib/services/irrigation-push-orchestration';
import type { IrrigationPushServiceResult } from '../../lib/services/irrigation-push-service';
import { saveQuietHoursSettingForUser } from '../../lib/services/quiet-hours-setting';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { createDripFixture, plannedDraft, runningDraft } from '../support/irrigation-fixtures';
import { ALICE, BOB } from '../support/spaces';

/**
 * L'écran des heures de silence (6 undecies, PR H3,
 * docs/heures-de-silence-contract.md, section 4 et section 13 ; D-326) :
 * l'enregistrement depuis l'écran reprogramme les retards d'irrigation
 * encore à venir de la ferme (F807, F820), jamais ceux d'une autre ferme ni
 * la fin d'un minuteur ; la ligne « aucun appareil » se lit au dernier envoi
 * d'une alerte (F818). Le Worker de notification est simulé.
 */

/** Lundi 15 juin 2099, 22 h à 23 h à Paris : une irrigation planifiée, dont le retard tombe à 22 h 15. */
const NIGHT_PERIOD = { startAt: '2099-06-15T20:00:00.000Z', endAt: '2099-06-15T21:00:00.000Z', durationSeconds: 3600 };
const NIGHT_LATE_DUE = '2099-06-15T20:15:00.000Z';
/** 6 h à Paris, le lendemain : la fin d'une plage de 22 h à 6 h. */
const NIGHT_END = '2099-06-16T04:00:00.000Z';
/** 12 h à 13 h à Paris, le même jour : un retard à 12 h 15, hors de toute plage. */
const DAY_PERIOD = { startAt: '2099-06-15T10:00:00.000Z', endAt: '2099-06-15T11:00:00.000Z', durationSeconds: 3600 };
/** 14 h à Paris : la ferme règle ses heures de silence. */
const AFTERNOON = new Date('2099-06-15T12:00:00.000Z');
const quiet = (start: string, end: string, enabled = true): QuietHoursSettings => ({ enabled, start, end, frostPasses: true });

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});

const PUSH_KEYS = ['DEMO_MODE', 'IRRIGATION_PUSH_SERVICE_URL', 'IRRIGATION_PUSH_SERVICE_TOKEN'] as const;
const savedEnv = Object.fromEntries(PUSH_KEYS.map((key) => [key, process.env[key]]));
const savedFetch = globalThis.fetch;
afterEach(() => {
  for (const key of PUSH_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  globalThis.fetch = savedFetch;
  database.dispose();
});

/** Le Worker simulé derrière le réseau, pour la première programmation des alarmes. */
function pushService(): IrrigationPushAlarmRequest[] {
  delete process.env.DEMO_MODE;
  process.env.IRRIGATION_PUSH_SERVICE_URL = 'https://irrigation-otf-push.exemple.workers.dev';
  process.env.IRRIGATION_PUSH_SERVICE_TOKEN = 'jeton-de-test-sans-valeur';
  const received: IrrigationPushAlarmRequest[] = [];
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    received.push(JSON.parse(String(init?.body)) as IrrigationPushAlarmRequest);
    return Response.json({ status: 'scheduled' });
  }) as typeof fetch;
  return received;
}

type Line = { level: string; entry: Record<string, unknown> };

/** Le Worker simulé pour la reprogrammation : ce qu'il reçoit, et sa réponse, une par appel. */
function worker(...answers: IrrigationPushServiceResult[]) {
  const requests: IrrigationPushAlarmRequest[] = [];
  const lines: Line[] = [];
  return {
    requests,
    lines,
    options: (now: Date) => ({
      now,
      schedule: async (request: IrrigationPushAlarmRequest): Promise<IrrigationPushServiceResult> => {
        requests.push(request);
        return answers[requests.length - 1] ?? { status: 'ok' };
      },
      log: (level: string, entry: Record<string, unknown>) => { lines.push({ level, entry }); },
    }),
  };
}

async function planned(ownerUserId: string, period = NIGHT_PERIOD, name = 'Rampe de nuit') {
  const fixture = await createDripFixture(ownerUserId, { name });
  const event = await createIrrigationEventForUser(ownerUserId, plannedDraft(fixture, period), { lateToleranceMinutes: 15 });
  assert.equal(event.pushSchedule?.kind, 'late');
  await synchronizeIrrigationPushSchedule(ownerUserId, event);
  return event;
}

test('F807, F820 : la plage allumée à 14 h, le retard de 22 h 15 prend pour échéance 6 h, même identifiant, même révision, même texte ; celui de 12 h 15, la fin d’un minuteur et la ferme B ne bougent pas', async () => {
  const first = pushService();
  const night = await planned(ALICE);
  const day = await planned(ALICE, DAY_PERIOD, 'Rampe de jour');
  const running = await createIrrigationEventForUser(ALICE, runningDraft(await createDripFixture(ALICE, { name: 'Rampe minuteur' }), 600));
  await synchronizeIrrigationPushSchedule(ALICE, running);
  const bobs = await planned(BOB);
  assert.deepEqual(first.map((request) => request.dueAt).filter((dueAt) => dueAt === NIGHT_LATE_DUE).length, 2, 'sans plage, les deux fermes à 22 h 15');

  const calls = worker();
  const saved = await saveQuietHoursSettingForUser(ALICE, ALICE, quiet('22:00', '06:00'), calls.options(AFTERNOON));
  assert.deepEqual(saved.lateAlarms, { rescheduled: 1, failed: 0 });
  assert.deepEqual(saved.settings.quietHours, quiet('22:00', '06:00'));
  assert.ok(night.pushSchedule);
  assert.deepEqual(calls.requests, [{ ...pushAlarmRequest(night.pushSchedule), dueAt: NIGHT_END }]);
  const stored = await getIrrigationPushScheduleForUser(ALICE, night.eventEquipmentId);
  assert.deepEqual([stored?.dueAt, stored?.status, stored?.revision], [NIGHT_LATE_DUE, 'scheduled', night.pushSchedule.revision], 'la base garde l’échéance d’origine');
  assert.ok(!calls.requests.some((request) => [day.eventEquipmentId, running.eventEquipmentId, bobs.eventEquipmentId].includes(request.eventEquipmentId)));
  assert.deepEqual(calls.lines.map((line) => [line.level, line.entry.event, line.entry.rescheduled]), [['info', 'quiet_hours_late_alarms_rescheduled', 1]]);
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  assert.ok(![ALICE, workspaceId, night.eventEquipmentId].some((id) => JSON.stringify(calls.lines).includes(id)), 'le journal ne nomme rien');

  const later = worker();
  assert.deepEqual((await saveQuietHoursSettingForUser(ALICE, ALICE, quiet('22:00', '06:00'), later.options(AFTERNOON))).lateAlarms, { rescheduled: 0, failed: 0 });
  assert.deepEqual(later.requests, [], 'la même plage enregistrée de nouveau : rien n’est envoyé');
  assert.deepEqual(later.lines, []);

  const moved = worker();
  assert.deepEqual((await saveQuietHoursSettingForUser(ALICE, ALICE, quiet('23:00', '06:00'), moved.options(AFTERNOON))).lateAlarms, { rescheduled: 1, failed: 0 });
  assert.deepEqual(moved.requests.map((request) => [request.eventEquipmentId, request.revision, request.dueAt]), [[night.eventEquipmentId, night.pushSchedule.revision, NIGHT_LATE_DUE]],
    'la plage commence à 23 h : le retard de 22 h 15 retrouve son échéance');

  const bobCalls = worker();
  await saveQuietHoursSettingForUser(BOB, BOB, quiet('21:00', '07:00'), bobCalls.options(AFTERNOON));
  assert.deepEqual(bobCalls.requests.map((request) => [request.eventEquipmentId, request.dueAt]), [[bobs.eventEquipmentId, '2099-06-16T05:00:00.000Z']], 'B : son seul retard, à 7 h');
});

test('F820 : à 1 h, la plage éteinte fait partir tout de suite le retard qu’elle retenait ; à 7 h, parti à 6 h, il ne se reprogramme plus', async () => {
  pushService();
  await saveQuietHoursForUser(ALICE, ALICE, quiet('22:00', '06:00'), AFTERNOON.toISOString());
  const night = await planned(ALICE);

  const off = worker();
  const at1h = new Date('2099-06-15T23:00:00.000Z');
  assert.deepEqual((await saveQuietHoursSettingForUser(ALICE, ALICE, quiet('22:00', '06:00', false), off.options(at1h))).lateAlarms, { rescheduled: 1, failed: 0 });
  assert.deepEqual(off.requests.map((request) => [request.eventEquipmentId, request.dueAt]), [[night.eventEquipmentId, NIGHT_LATE_DUE]],
    'l’échéance d’origine, passée : le Worker l’envoie tout de suite');

  await saveQuietHoursForUser(ALICE, ALICE, quiet('22:00', '06:00'), at1h.toISOString());
  const morning = worker();
  const at7h = new Date('2099-06-16T05:00:00.000Z');
  assert.deepEqual((await saveQuietHoursSettingForUser(ALICE, ALICE, quiet('22:00', '06:00', false), morning.options(at7h))).lateAlarms, { rescheduled: 0, failed: 0 });
  assert.deepEqual(morning.requests, [], 'retenu jusqu’à 6 h, il est parti : rien à reprogrammer');
});

test('F820, S8 : un Worker qui refuse laisse le réglage enregistré, l’alarme à son échéance d’avant, et le journal le dit sans nom ; un réglage hors des bornes n’écrit rien et n’envoie rien', async () => {
  pushService();
  const night = await planned(ALICE);
  const refused = worker({ status: 'failed', message: 'unreachable' });
  const saved = await saveQuietHoursSettingForUser(ALICE, ALICE, quiet('22:00', '06:00'), refused.options(AFTERNOON));
  assert.deepEqual(saved.lateAlarms, { rescheduled: 0, failed: 1 });
  assert.equal((await readPhoneNoticeSettingsForUser(ALICE)).quietHours.enabled, true, 'le réglage reste enregistré');
  assert.equal((await getIrrigationPushScheduleForUser(ALICE, night.eventEquipmentId))?.status, 'scheduled');
  assert.deepEqual(refused.lines.map((line) => [line.level, line.entry.event, line.entry.failed]), [['warn', 'quiet_hours_late_alarms_rescheduled', 1]]);
  assert.ok(!JSON.stringify(refused.lines).includes(night.eventEquipmentId));

  const invalid = worker();
  await assert.rejects(saveQuietHoursSettingForUser(BOB, BOB, quiet('15:00', '06:00'), invalid.options(AFTERNOON)), InvalidQuietHoursError);
  assert.deepEqual(invalid.requests, []);
  assert.deepEqual((await readPhoneNoticeSettingsForUser(BOB)).quietHours, DEFAULT_QUIET_HOURS);
});

test('F820, S8 : le réglage d’avant illisible, chaque retard à venir est reprogrammé selon la plage nouvelle ; un retard échu, qu’on ne sait plus retenu, compte pour parti', async () => {
  pushService();
  const night = await planned(ALICE);
  const day = await planned(ALICE, DAY_PERIOD, 'Rampe de jour');
  const calls = worker();
  assert.deepEqual(await rescheduleLateAlarmsForQuietHours(ALICE, null, quiet('22:00', '06:00'), calls.options(AFTERNOON)), { rescheduled: 1, failed: 0 });
  assert.deepEqual(calls.requests.map((request) => [request.eventEquipmentId, request.dueAt]), [[night.eventEquipmentId, NIGHT_END]],
    'le retard de 12 h 15, échu à 14 h, ne se reprogramme pas');
  assert.ok(!calls.requests.some((request) => request.eventEquipmentId === day.eventEquipmentId));
});

const HEAT: WeatherAlertCriterionSettings = { field: 'maximum-temperature', direction: 'above', threshold: 35, horizonDays: 3, label: null, active: true };

test('S3 : la fin d’un minuteur qui tourne ne se reprogramme jamais, quelle que soit la plage', async () => {
  pushService();
  const running = await createIrrigationEventForUser(ALICE, runningDraft(await createDripFixture(ALICE, { name: 'Rampe minuteur' }), 600));
  assert.equal(running.pushSchedule?.kind, 'finished');
  await synchronizeIrrigationPushSchedule(ALICE, running);
  const now = new Date();
  const calls = worker();
  const result = await rescheduleLateAlarmsForQuietHours(ALICE, null, quiet('20:00', '09:00'), calls.options(now));
  assert.deepEqual([result, calls.requests], [{ rescheduled: 0, failed: 0 }, []]);
});

/** Une alerte météo enregistrée, telle que l'envoi la laisse, sur le critère de chaleur de la ferme, un jour cible par alerte. */
async function weatherAlert(ownerUserId: string, id: string, sentAt: string, status: string, heldUntil: string | null = null) {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const criterion = await createWeatherAlertCriterionForUser(ownerUserId, HEAT);
  database.sqlite.prepare(`INSERT INTO irrigation_weather_alerts
    (id, workspace_id, criterion_id, criterion_version, target_date, forecast_value, unit, forecasted_at, sent_at, delivery_status, held_until)
    VALUES (?, ?, ?, ?, '2099-06-16', 36, '°C', ?, ?, ?, ?)`).run(id, workspaceId, criterion.id, criterion.version, sentAt, sentAt, status, heldUntil);
}

/** Une alerte par culture enregistrée. */
function cropAlert(workspaceId: string, id: string, sentAt: string, status: string) {
  database.sqlite.prepare(`INSERT INTO irrigation_crop_alerts
    (id, workspace_id, kind, subject_key, subject_version, name, target_date, sent_at, delivery_status)
    VALUES (?, ?, 'frost', ?, '1', 'Tomate', '2099-06-16', ?, ?)`).run(id, workspaceId, `sujet-${id}`, sentAt, status);
}

test('F818 : la ligne « aucun appareil » suit la dernière alerte partie tout de suite, météo ou par culture ; une retenue, un échec ou une autre ferme n’y comptent pas', async () => {
  assert.equal(await lastAlertFoundNoDeviceForUser(ALICE), false, 'une ferme sans espace : rien à dire');
  const alice = await ensureWorkspaceForUser(ALICE);
  await ensureWorkspaceForUser(BOB);
  assert.equal(await lastAlertFoundNoDeviceForUser(ALICE), false, 'aucune alerte : rien à dire');

  await weatherAlert(ALICE, 'a1', '2099-06-10T08:00:00.000Z', 'no-subscriber');
  assert.equal(await lastAlertFoundNoDeviceForUser(ALICE), true);
  assert.equal(await lastAlertFoundNoDeviceForUser(BOB), false, 'B n’a rien envoyé');

  await weatherAlert(ALICE, 'a2', '2099-06-10T20:30:00.000Z', 'sent', '2099-06-11T04:00:00.000Z');
  await weatherAlert(ALICE, 'a3', '2099-06-10T21:00:00.000Z', 'failed');
  cropAlert(alice, 'a4', '2099-06-10T21:30:00.000Z', 'retrying');
  assert.equal(await lastAlertFoundNoDeviceForUser(ALICE), true, 'une retenue, un échec, une nouvelle tentative ne disent rien des appareils');

  cropAlert(alice, 'a5', '2099-06-11T08:00:00.000Z', 'sent');
  assert.equal(await lastAlertFoundNoDeviceForUser(ALICE), false, 'une alerte par culture a trouvé un appareil depuis');

  cropAlert(alice, 'a6', '2099-06-13T08:00:00.000Z', 'no-subscriber');
  await weatherAlert(BOB, 'b1', '2099-06-14T08:00:00.000Z', 'sent');
  assert.equal(await lastAlertFoundNoDeviceForUser(ALICE), true, 'la dernière alerte de A n’a trouvé aucun appareil ; l’envoi de B ne compte pas pour A');
  assert.equal(await lastAlertFoundNoDeviceForUser(BOB), false);
});
