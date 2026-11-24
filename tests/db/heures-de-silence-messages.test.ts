import assert from 'node:assert/strict';
import test, { afterEach, beforeEach, mock } from 'node:test';
import { createIrrigationEventForUser } from '../../db/irrigation-event/create';
import { getIrrigationPushScheduleForUser } from '../../db/irrigation-event/push-schedule';
import { saveEveningReminderForUser, saveQuietHoursForUser } from '../../db/phone-notice-repository';
import { readTaskRuns } from '../../db/task-run-repository';
import { ensureWorkspaceForUser } from '../../db/workspace-repository';
import type { IrrigationSnapshot } from '../../lib/domain/domain';
import { FEATURE_IDS } from '../../lib/domain/features/catalogue';
import type { IrrigationPushAlarmRequest } from '../../lib/domain/irrigation-push-contract';
import type { QuietHoursSettings } from '../../lib/domain/notification-quiet-hours';
import type { StoredPlanSuggestion } from '../../lib/domain/planning/contract';
import { runEveningReminders } from '../../lib/services/evening-reminder';
import type { PhoneNoticeAlarmResult } from '../../lib/services/irrigation-push-service';
import {
  cancelUpcomingIrrigationAlarmsForUser,
  pushAlarmRequest,
  synchronizeIrrigationPushSchedule,
} from '../../lib/services/irrigation-push-orchestration';
import { sendMorningMessage } from '../../lib/services/morning-message';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { createDripFixture, type IrrigationFixture, plannedDraft, runningDraft } from '../support/irrigation-fixtures';
import { ALICE, BOB } from '../support/spaces';

/**
 * Les heures de silence et les messages à alarme (6 undecies, PR H2,
 * docs/heures-de-silence-contract.md, sections 3, 5 et 8 ; D-322) : le
 * message du matin et le retard d'une irrigation planifiée gardent leur
 * propre alarme, à échéance de la fin de la plage (F800) ; le retard se juge
 * à son échéance (F797) ; la fin d'un minuteur ne lit pas le réglage (S3) ;
 * le rappel du soir dans la plage ne part pas et n'est pas retenu (S5) ; une
 * retenue refusée part tout de suite et un réglage illisible ne retient rien
 * (S8). Le Worker de notification est simulé.
 */

const SAVED_AT = '2026-09-29T12:00:00.000Z';
/** Mercredi 30 septembre 2026, 6 h 15 à Paris : le calcul du matin. */
const MORNING = new Date('2026-09-30T04:15:00.000Z');
/** 7 h à Paris : la fin d'une plage de 22 h à 7 h. */
const MORNING_END = '2026-09-30T05:00:00.000Z';
const HOUR_MS = 3_600_000;
const SNAPSHOT = { structure: null, zones: [], plots: [], beds: [] } as unknown as IrrigationSnapshot;
const quiet = (start: string, end: string): QuietHoursSettings => ({ enabled: true, start, end, frostPasses: true });

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
  mock.timers.reset();
  mock.restoreAll();
  database.dispose();
});

type Line = { level: string; entry: Record<string, unknown> };

/** Le Worker simulé pour les alarmes du matin et du soir : ce qu'il reçoit, et sa réponse, une par appel. */
function alarms(...answers: PhoneNoticeAlarmResult[]) {
  const requests: IrrigationPushAlarmRequest[] = [];
  const lines: Line[] = [];
  return {
    requests,
    lines,
    schedule: async (request: IrrigationPushAlarmRequest): Promise<PhoneNoticeAlarmResult> => {
      requests.push(request);
      return answers[requests.length - 1] ?? { status: 'ok' };
    },
    log: (level: string, entry: Record<string, unknown>) => { lines.push({ level, entry }); },
  };
}

/** Le Worker simulé derrière le réseau, pour les alarmes d'irrigation, qui garde chaque alarme reçue. */
function pushService(): { path: string; body: IrrigationPushAlarmRequest }[] {
  delete process.env.DEMO_MODE;
  process.env.IRRIGATION_PUSH_SERVICE_URL = 'https://irrigation-otf-push.exemple.workers.dev';
  process.env.IRRIGATION_PUSH_SERVICE_TOKEN = 'jeton-de-test-sans-valeur';
  const received: { path: string; body: IrrigationPushAlarmRequest }[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    received.push({ path: new URL(String(input)).pathname, body: JSON.parse(String(init?.body)) as IrrigationPushAlarmRequest });
    return Response.json({ status: 'scheduled' });
  }) as typeof fetch;
  return received;
}

function noticeRows(): { workspaceId: string; kind: string; parisDay: string; sent: boolean }[] {
  return database.sqlite.prepare('SELECT workspace_id, kind, paris_day, sent_at FROM irrigation_phone_notices ORDER BY kind, workspace_id').all()
    .map((row) => ({ workspaceId: String(row.workspace_id), kind: String(row.kind), parisDay: String(row.paris_day), sent: row.sent_at !== null }));
}

function suggestion(eventEquipmentId: string): StoredPlanSuggestion {
  const plannedStartAt = new Date(MORNING.getTime() + 2 * HOUR_MS).toISOString();
  return {
    eventId: `event-${eventEquipmentId}`, eventEquipmentId, equipmentId: 'asp1', equipmentName: 'Rampe bloc 2', kind: 'sprinkler', priority: 'normal',
    plannedStartAt, plannedEndAt: new Date(Date.parse(plannedStartAt) + 2 * HOUR_MS).toISOString(), plannedDurationSeconds: 7200, plannedDoseMm: 12,
    suggestion: 'cancel', doseMm: null, durationSeconds: null, endAt: null, causes: [], kept: false,
  };
}

function morning(ownerUserId: string, calls: ReturnType<typeof alarms>) {
  return sendMorningMessage({
    ownerUserId,
    season: 2026,
    snapshot: SNAPSHOT,
    enabled: [...FEATURE_IDS],
    plan: { suggestions: [suggestion('ee-1')] },
    events: [],
    forecastRainMm: null,
    now: MORNING,
    schedule: calls.schedule,
    log: calls.log,
    countAlerts: async () => 0,
  });
}

function withoutIds(lines: readonly Line[], ids: readonly string[]): boolean {
  const text = JSON.stringify(lines);
  return ids.every((id) => !text.includes(id));
}

test('scénario 11 : le message du matin composé à 6 h 15, plage de 22 h à 7 h, est retenu jusqu’à 7 h par sa propre alarme et compte comme envoyé ; B, sans plage, le reçoit tout de suite (S4, S6, S10)', async () => {
  const alice = await ensureWorkspaceForUser(ALICE);
  const bob = await ensureWorkspaceForUser(BOB);
  await saveQuietHoursForUser(ALICE, ALICE, quiet('22:00', '07:00'), SAVED_AT);
  const calls = alarms();
  await morning(ALICE, calls);
  await morning(BOB, calls);

  assert.deepEqual(calls.requests.map((request) => [request.eventEquipmentId, request.recipientKey, request.dueAt]), [
    [`morning:${alice}:2026-09-30`, alice, MORNING_END],
    [`morning:${bob}:2026-09-30`, bob, MORNING.toISOString()],
  ], 'la même alarme du jour, à échéance de la fin de la plage pour A ; immédiate pour B');
  const [held, immediate] = calls.requests;
  assert.equal(held.notification.tag, `morning-${alice}-2026-09-30`);
  assert.deepEqual({ ...held.notification, tag: '' }, { ...immediate.notification, tag: '' }, 'le texte composé au calcul du matin, inchangé (S6)');
  assert.deepEqual(calls.lines, [
    { level: 'info', entry: { event: 'morning_message_held', parisDay: '2026-09-30', irrigations: 0, alerts: 0, suggestions: 1, heldUntil: MORNING_END, sentAt: MORNING.toISOString() } },
    { level: 'info', entry: { event: 'morning_message_sent', parisDay: '2026-09-30', irrigations: 0, alerts: 0, suggestions: 1, sentAt: MORNING.toISOString() } },
  ]);
  assert.ok(withoutIds(calls.lines, [ALICE, BOB, alice, bob]), 'le journal ne nomme ni ferme ni personne');
  assert.deepEqual(noticeRows().map((row) => [row.workspaceId === alice ? 'A' : 'B', row.sent]).sort(), [['A', true], ['B', true]], 'gardée par le Worker, la retenue compte comme envoyée (F745)');

  await morning(ALICE, calls);
  assert.equal(calls.requests.length, 2, 'un seul message par jour : le passage suivant du matin ne renvoie rien');
});

test('scénario 16, S8 : la retenue du matin refusée, le message part tout de suite sous la même alarme et la même révision, et l’incident se dit sans nom', async () => {
  const alice = await ensureWorkspaceForUser(ALICE);
  await saveQuietHoursForUser(ALICE, ALICE, quiet('22:00', '07:00'), SAVED_AT);
  const calls = alarms({ status: 'failed', message: 'Le service d’alerte a répondu 500.' });
  await morning(ALICE, calls);
  assert.deepEqual(calls.requests.map((request) => request.dueAt), [MORNING_END, MORNING.toISOString()], 'la retenue, puis l’envoi immédiat');
  const [held, immediate] = calls.requests;
  assert.deepEqual({ ...immediate, dueAt: '' }, { ...held, dueAt: '' }, 'même identifiant, même révision : une retenue gardée malgré l’erreur est remplacée, jamais doublée');
  assert.deepEqual(calls.lines.map((line) => [line.level, line.entry.event, line.entry.error]), [
    ['warn', 'quiet_hold_failed', 'Le service d’alerte a répondu 500.'],
    ['info', 'morning_message_sent', undefined],
  ]);
  assert.ok(withoutIds(calls.lines, [ALICE, alice]));
  assert.deepEqual(noticeRows().map((row) => row.sent), [true]);
});

async function planToday(fixture: IrrigationFixture): Promise<void> {
  await createIrrigationEventForUser(fixture.ownerUserId, plannedDraft(fixture, {
    startAt: '2026-09-30T05:00:00.000Z', endAt: '2026-09-30T06:00:00.000Z', durationSeconds: 3600,
  }));
}

test('scénario 10, S5 : le rappel du soir qui tomberait dans la plage ne part pas, n’est pas retenu et ne compte pas la ferme en panne ; hors de la plage, il part', async () => {
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-30T04:00:00.000Z') });
  const aliceFixture = await createDripFixture(ALICE, { name: 'Rampe A' });
  const bobFixture = await createDripFixture(BOB, { name: 'Rampe B' });
  const alice = await ensureWorkspaceForUser(ALICE);
  const bob = await ensureWorkspaceForUser(BOB);
  for (const fixture of [aliceFixture, bobFixture]) {
    await planToday(fixture);
    await saveEveningReminderForUser(fixture.ownerUserId, fixture.ownerUserId, { enabled: true, time: '21:00' }, SAVED_AT);
  }
  await saveQuietHoursForUser(ALICE, ALICE, quiet('21:00', '06:00'), SAVED_AT);

  const at21h05 = new Date('2026-09-30T19:05:00.000Z');
  const calls = alarms();
  assert.deepEqual(await runEveningReminders({ now: at21h05, schedule: calls.schedule, log: calls.log }), { due: 2, sent: 1, alreadySent: 0, silenced: 1, failed: 0, successful: true });
  assert.deepEqual(calls.requests.map((request) => [request.recipientKey, request.dueAt]), [[bob, at21h05.toISOString()]], 'B seul, tout de suite ; rien de retenu pour A');
  assert.deepEqual(noticeRows().map((row) => row.workspaceId), [bob], 'rien n’est pris pour A');
  assert.equal((await readTaskRuns(['evening-reminder'])).get('evening-reminder')?.lastSuccessAt, at21h05.toISOString(), 'le passage est réussi');
  const at22h05 = new Date(at21h05.getTime() + HOUR_MS);
  assert.deepEqual(await runEveningReminders({ now: at22h05, schedule: calls.schedule, log: calls.log }), { due: 2, sent: 0, alreadySent: 1, silenced: 1, failed: 0, successful: true }, 'à 22 h 05, toujours dû, toujours dans la plage');
  assert.ok(withoutIds(calls.lines, [ALICE, BOB, alice, bob]));

  await saveQuietHoursForUser(ALICE, ALICE, quiet('22:00', '06:00'), SAVED_AT);
  assert.deepEqual(await runEveningReminders({ now: at21h05, schedule: calls.schedule, log: calls.log }), { due: 2, sent: 1, alreadySent: 1, silenced: 0, failed: 0, successful: true }, 'la plage commence à 22 h : à 21 h 05, le rappel de A part');
  assert.deepEqual(calls.requests.at(-1)?.recipientKey, alice);
});

/** Une irrigation planifiée le 15 juin 2099 de 22 h à 23 h à Paris : son retard, tolérance de 15 minutes, tombe à 22 h 15. */
const NIGHT_PERIOD = { startAt: '2099-06-15T20:00:00.000Z', endAt: '2099-06-15T21:00:00.000Z', durationSeconds: 3600 };
const NIGHT_LATE_DUE = '2099-06-15T20:15:00.000Z';
/** 6 h à Paris, le lendemain : la fin d'une plage de 22 h à 6 h. */
const NIGHT_END = '2099-06-16T04:00:00.000Z';

async function planNight(ownerUserId: string, period = NIGHT_PERIOD, name = 'Rampe de nuit') {
  const fixture = await createDripFixture(ownerUserId, { name });
  const planned = await createIrrigationEventForUser(ownerUserId, plannedDraft(fixture, period), { lateToleranceMinutes: 15 });
  assert.equal(planned.pushSchedule?.kind, 'late');
  return planned;
}

test('F797 : le retard se juge à son échéance ; à 22 h 15 dans la plage, le Worker reçoit la fin de la plage, même identifiant, même révision, même texte ; la base garde l’échéance d’origine ; de jour, ou sans plage, rien ne change (S4, S10)', async () => {
  const received = pushService();
  await saveQuietHoursForUser(ALICE, ALICE, quiet('22:00', '06:00'), SAVED_AT);
  const night = await planNight(ALICE);
  assert.equal(night.pushSchedule?.dueAt, NIGHT_LATE_DUE);
  assert.equal(await synchronizeIrrigationPushSchedule(ALICE, night), undefined, 'rien à dire à la ferme');
  assert.ok(night.pushSchedule);
  assert.deepEqual(received, [{ path: '/v1/alarms/schedule', body: { ...pushAlarmRequest(night.pushSchedule), dueAt: NIGHT_END } }]);
  const stored = await getIrrigationPushScheduleForUser(ALICE, night.eventEquipmentId);
  assert.deepEqual([stored?.dueAt, stored?.status], [NIGHT_LATE_DUE, 'scheduled'], 'l’échéance d’origine, en base ; la fin de la plage, au Worker');

  const day = await planNight(ALICE, { startAt: '2099-06-15T10:00:00.000Z', endAt: '2099-06-15T11:00:00.000Z', durationSeconds: 3600 }, 'Rampe de jour');
  await synchronizeIrrigationPushSchedule(ALICE, day);
  assert.equal(received[1]?.body.dueAt, '2099-06-15T10:15:00.000Z', 'à 12 h 15, hors de la plage : l’échéance d’origine');

  const bobs = await planNight(BOB);
  await synchronizeIrrigationPushSchedule(BOB, bobs);
  assert.equal(received[2]?.body.dueAt, NIGHT_LATE_DUE, 'B, sans plage : à 22 h 15, comme avant');
});

test('S3 et S8 : la fin d’un minuteur ne lit pas le réglage ; un réglage illisible laisse au retard son échéance, et le journal le dit sans nom', async () => {
  const received = pushService();
  await saveQuietHoursForUser(ALICE, ALICE, quiet('22:00', '06:00'), SAVED_AT);
  const night = await planNight(ALICE);
  const fixture = await createDripFixture(ALICE, { name: 'Rampe minuteur' });
  const running = await createIrrigationEventForUser(ALICE, runningDraft(fixture, 600));
  assert.equal(running.pushSchedule?.kind, 'finished');
  database.sqlite.exec('DROP TABLE irrigation_phone_notice_settings');
  const warnings: string[] = [];
  mock.method(console, 'warn', (line: string) => { warnings.push(line); });

  await synchronizeIrrigationPushSchedule(ALICE, running);
  assert.deepEqual(warnings, [], 'la fin d’un arrosage démarré part sans lire le réglage');
  assert.equal(received[0]?.body.dueAt, running.pushSchedule?.dueAt);

  await synchronizeIrrigationPushSchedule(ALICE, night);
  assert.equal(received[1]?.body.dueAt, NIGHT_LATE_DUE, 'illisible, la plage compte pour éteinte : le retard part à son heure');
  assert.deepEqual(warnings.map((line) => JSON.parse(line).event), ['quiet_hours_unreadable']);
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  assert.ok(![ALICE, workspaceId].some((id) => warnings.join('\n').includes(id)), 'sans nom');
});

test('Arrosages décochée dans la nuit : le retard retenu dont l’échéance est passée, pas la fin de la plage, est retiré ; passé 6 h, il est parti et ne se retire plus ; celui d’une ferme sans plage non plus (P29)', async () => {
  pushService();
  await saveQuietHoursForUser(ALICE, ALICE, quiet('22:00', '06:00'), SAVED_AT);
  const night = await planNight(ALICE);
  await synchronizeIrrigationPushSchedule(ALICE, night);
  const bobs = await planNight(BOB);
  await synchronizeIrrigationPushSchedule(BOB, bobs);
  const silent = () => undefined;
  const at1h = new Date('2099-06-15T23:00:00.000Z');

  assert.deepEqual(await cancelUpcomingIrrigationAlarmsForUser(BOB, { now: at1h, cancel: async () => assert.fail('B : le retard est parti à 22 h 15'), log: silent }), { canceled: 0, failed: 0 });
  assert.deepEqual(await cancelUpcomingIrrigationAlarmsForUser(ALICE, {
    now: new Date('2099-06-16T04:30:00.000Z'), cancel: async () => assert.fail('A : parti à 6 h, il ne se retire plus'), log: silent,
  }), { canceled: 0, failed: 0 });

  const canceled: { eventEquipmentId: string; revision: string }[] = [];
  assert.deepEqual(await cancelUpcomingIrrigationAlarmsForUser(ALICE, {
    now: at1h, cancel: async (request) => { canceled.push(request); return { status: 'ok' }; }, log: silent,
  }), { canceled: 1, failed: 0 });
  assert.deepEqual(canceled, [{ eventEquipmentId: night.eventEquipmentId, revision: night.pushSchedule?.revision }], 'à 1 h, retenu jusqu’à 6 h : il n’est pas parti, il est retiré');
  assert.equal((await getIrrigationPushScheduleForUser(ALICE, night.eventEquipmentId))?.status, 'disabled');
});

test('S8 : un réglage illisible n’empêche pas de retirer les alarmes à venir ; le retard échu, qu’on ne sait plus retenu, compte pour parti, et le journal le dit sans nom', async () => {
  pushService();
  await saveQuietHoursForUser(ALICE, ALICE, quiet('22:00', '06:00'), SAVED_AT);
  const night = await planNight(ALICE);
  await synchronizeIrrigationPushSchedule(ALICE, night);
  const tomorrow = await planNight(ALICE, { startAt: '2099-06-16T10:00:00.000Z', endAt: '2099-06-16T11:00:00.000Z', durationSeconds: 3600 }, 'Rampe du lendemain');
  await synchronizeIrrigationPushSchedule(ALICE, tomorrow);
  database.sqlite.exec('DROP TABLE irrigation_phone_notice_settings');
  const canceled: string[] = [];
  const lines: Line[] = [];
  const result = await cancelUpcomingIrrigationAlarmsForUser(ALICE, {
    now: new Date('2099-06-15T23:00:00.000Z'),
    cancel: async (request) => { canceled.push(request.eventEquipmentId); return { status: 'ok' }; },
    log: (level, entry) => { lines.push({ level, entry }); },
  });
  assert.deepEqual(result, { canceled: 1, failed: 0 });
  assert.deepEqual(canceled, [tomorrow.eventEquipmentId], 'l’alarme du lendemain est retirée ; celle de la nuit, échue, ne l’est pas');
  assert.deepEqual(lines.map((line) => [line.level, line.entry.event]), [['warn', 'quiet_hours_unreadable'], ['info', 'irrigation_alarms_feature_canceled']]);
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  assert.ok(withoutIds(lines, [ALICE, workspaceId]));
});

test('S17 : un réglage corrompu en base ne retient ni le message du matin, ni le rappel du soir, ni le retard ; chaque envoyeur dit le défaut, sans nom', async () => {
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-30T04:00:00.000Z') });
  const received = pushService();
  const fixture = await createDripFixture(ALICE, { name: 'Rampe A' });
  const alice = await ensureWorkspaceForUser(ALICE);
  await planToday(fixture);
  await saveEveningReminderForUser(ALICE, ALICE, { enabled: true, time: '21:00' }, SAVED_AT);
  await saveQuietHoursForUser(ALICE, ALICE, quiet('21:00', '07:00'), SAVED_AT);
  database.sqlite.exec('PRAGMA ignore_check_constraints = ON');
  try {
    database.sqlite.prepare("UPDATE irrigation_phone_notice_settings SET quiet_end = '12:00' WHERE workspace_id = ?").run(alice);
  } finally {
    database.sqlite.exec('PRAGMA ignore_check_constraints = OFF');
  }
  const defects = (lines: readonly Line[]) => lines.filter((line) => line.entry.event === 'quiet_hours_defect').map((line) => [line.level, line.entry.defect]);

  const calls = alarms();
  await morning(ALICE, calls);
  assert.equal(calls.requests[0]?.dueAt, MORNING.toISOString(), 'le matin part tout de suite');
  assert.deepEqual(defects(calls.lines), [['warn', 'invalid-setting']]);

  const evening = alarms();
  assert.equal((await runEveningReminders({ now: new Date('2026-09-30T19:05:00.000Z'), schedule: evening.schedule, log: evening.log })).sent, 1, 'le soir part');
  assert.deepEqual(defects(evening.lines), [['warn', 'invalid-setting']]);

  const warnings: string[] = [];
  mock.method(console, 'warn', (line: string) => { warnings.push(line); });
  const night = await planNight(ALICE);
  await synchronizeIrrigationPushSchedule(ALICE, night);
  assert.equal(received.at(-1)?.body.dueAt, NIGHT_LATE_DUE, 'le retard garde son échéance');
  assert.deepEqual(warnings.map((line) => [JSON.parse(line).event, JSON.parse(line).defect]), [['quiet_hours_defect', 'invalid-setting']]);
  assert.ok(withoutIds([...calls.lines, ...evening.lines, { level: 'warn', entry: { warnings } }], [ALICE, alice]), 'sans nom');
});
