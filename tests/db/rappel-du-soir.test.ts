import assert from 'node:assert/strict';
import test, { afterEach, beforeEach, mock } from 'node:test';
import { requestFarmErasure } from '../../db/farm-erasure-repository';
import { saveFeatureSelectionForUser } from '../../db/feature-selection-repository';
import { createIrrigationEventForUser } from '../../db/irrigation-event/create';
import { readPhoneNoticeSettingsForUser, saveEveningReminderForUser, saveMorningMessageForUser } from '../../db/phone-notice-repository';
import { readTaskRuns } from '../../db/task-run-repository';
import { ensureWorkspaceForUser } from '../../db/workspace-repository';
import { FEATURE_IDS } from '../../lib/domain/features/catalogue';
import { DEFAULT_QUIET_HOURS } from '../../lib/domain/notification-quiet-hours';
import type { IrrigationPushAlarmRequest } from '../../lib/domain/irrigation-push-contract';
import { runEveningReminders } from '../../lib/services/evening-reminder';
import type { PlanningAlarmScheduler } from '../../lib/services/morning-message';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { createDripFixture, plannedDraft, type IrrigationFixture } from '../support/irrigation-fixtures';
import { ALICE, BOB } from '../support/spaces';

/**
 * Le passage du rappel du soir (amélioration n° 2,
 * docs/ameliorations-6-2-3-7-contract.md, sections 4.3 et 4.4, F704, F705,
 * F714, F744, F745) : chaque heure, les fermes dont le rappel est dû
 * reçoivent, par l'alarme à échéance immédiate du Worker de notification,
 * sous l'identifiant de leur espace et du jour, les arrosages validés du
 * jour jamais confirmés ; une fois par jour au plus ; rien pour une ferme
 * sans « Arrosages », coupée ou figée par une demande d'effacement ; une
 * panne se journalise sans nom et se rend ; le passage est une tâche du
 * registre.
 */

const MORNING = new Date('2026-09-30T04:00:00.000Z'); // 6 h à la ferme : les arrosages se planifient
const EVENING = new Date('2026-09-30T17:05:00.000Z'); // 19 h 05 à la ferme
const HOUR_MS = 3_600_000;

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
  mock.timers.enable({ apis: ['Date'], now: MORNING });
});
afterEach(() => {
  mock.timers.reset();
  database.dispose();
});

async function planIrrigation(fixture: IrrigationFixture, startAt: string, minutes = 60): Promise<void> {
  const endAt = new Date(Date.parse(startAt) + minutes * 60_000).toISOString();
  await createIrrigationEventForUser(fixture.ownerUserId, plannedDraft(fixture, { startAt, endAt, durationSeconds: minutes * 60 }));
}

type Line = { level: string; entry: Record<string, unknown> };

function recorder(status: 'ok' | 'failed' | 'disabled' | 'stale' | 'throw' = 'ok') {
  const requests: IrrigationPushAlarmRequest[] = [];
  const lines: Line[] = [];
  return {
    requests,
    lines,
    schedule: async (request: IrrigationPushAlarmRequest) => {
      requests.push(request);
      if (status === 'throw') throw new Error('réseau coupé');
      if (status === 'failed') return { status: 'failed' as const, message: 'Le service d’alerte a répondu 500.' };
      return { status };
    },
    log: (level: string, entry: Record<string, unknown>) => { lines.push({ level, entry }); },
  };
}

test('à 19 h 05, la ferme reçoit le rappel de ses arrosages non confirmés, sous la clé de son espace ; le passage est réussi au registre', async () => {
  const fixture = await createDripFixture(ALICE, { name: 'Rampe 1' });
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  await planIrrigation(fixture, '2026-09-30T05:00:00.000Z');
  const calls = recorder();
  const result = await runEveningReminders({ now: EVENING, schedule: calls.schedule, log: calls.log });
  assert.deepEqual(result, { due: 1, sent: 1, alreadySent: 0, silenced: 0, failed: 0, successful: true });
  assert.equal(calls.requests.length, 1);
  const [request] = calls.requests;
  assert.equal(request.eventEquipmentId, `evening:${workspaceId}:2026-09-30`);
  assert.equal(request.recipientKey, workspaceId);
  assert.equal(request.dueAt, EVENING.toISOString(), 'à échéance immédiate');
  assert.deepEqual(request.notification, {
    title: 'Arrosages à confirmer',
    body: '1 arrosage prévu aujourd’hui n’est pas confirmé : Rampe 1. L’avez-vous fait ?',
    tag: `evening-${workspaceId}-2026-09-30`,
    data: { url: '/irrigation/aujourdhui' },
  });
  assert.equal((await readTaskRuns(['evening-reminder'])).get('evening-reminder')?.lastSuccessAt, EVENING.toISOString());
  assert.ok(!JSON.stringify(calls.lines).includes(ALICE) && !JSON.stringify(calls.lines).includes(workspaceId), 'jamais d’identifiant');
});

test('un seul rappel par jour : le passage suivant se tait ; jamais avant l’heure réglée ; rien quand tout est confirmé', async () => {
  const fixture = await createDripFixture(ALICE, { name: 'Rampe 1' });
  await ensureWorkspaceForUser(ALICE);
  await planIrrigation(fixture, '2026-09-30T05:00:00.000Z');
  const calls = recorder();
  assert.deepEqual(await runEveningReminders({ now: new Date(EVENING.getTime() - HOUR_MS), schedule: calls.schedule, log: calls.log }), { due: 0, sent: 0, alreadySent: 0, silenced: 0, failed: 0, successful: true }, '18 h 05 : trop tôt');
  await runEveningReminders({ now: EVENING, schedule: calls.schedule, log: calls.log });
  assert.deepEqual(await runEveningReminders({ now: new Date(EVENING.getTime() + HOUR_MS), schedule: calls.schedule, log: calls.log }), { due: 1, sent: 0, alreadySent: 1, silenced: 0, failed: 0, successful: true }, '20 h 05 : déjà parti');
  assert.equal(calls.requests.length, 1);

  await saveEveningReminderForUser(BOB, BOB, { enabled: true, time: '19:00' }, MORNING.toISOString());
  await createDripFixture(BOB, { name: 'Tunnel B' });
  const bob = recorder();
  await runEveningReminders({ now: new Date('2026-10-01T17:05:00.000Z'), schedule: bob.schedule, log: bob.log });
  assert.deepEqual(bob.requests, [], 'le lendemain, rien à rappeler chez personne : la veille ne se rappelle pas');
});

test('l’heure réglée, la case coupée, une ferme sans « Arrosages » ou figée : chacun chez soi', async () => {
  const alice = await createDripFixture(ALICE, { name: 'Rampe A' });
  const bob = await createDripFixture(BOB, { name: 'Rampe B' });
  await planIrrigation(alice, '2026-09-30T05:00:00.000Z');
  await planIrrigation(bob, '2026-09-30T05:00:00.000Z');
  assert.deepEqual(
    await saveEveningReminderForUser(ALICE, ALICE, { enabled: true, time: '20:30' }, MORNING.toISOString()),
    { morningMessage: true, eveningReminder: true, eveningTime: '20:30', quietHours: DEFAULT_QUIET_HOURS },
  );
  const calls = recorder();
  await runEveningReminders({ now: EVENING, schedule: calls.schedule, log: calls.log });
  assert.deepEqual(calls.requests.map((request) => request.notification.body), ['1 arrosage prévu aujourd’hui n’est pas confirmé : Rampe B. L’avez-vous fait ?'], 'à 19 h 05, B seul (19 h par défaut)');
  await runEveningReminders({ now: new Date('2026-09-30T19:05:00.000Z'), schedule: calls.schedule, log: calls.log });
  assert.equal(calls.requests.at(-1)?.notification.body, '1 arrosage prévu aujourd’hui n’est pas confirmé : Rampe A. L’avez-vous fait ?', 'à 21 h 05, A');

  await saveEveningReminderForUser(ALICE, ALICE, { enabled: false, time: '19:00' }, MORNING.toISOString());
  await saveMorningMessageForUser(ALICE, ALICE, false, MORNING.toISOString());
  assert.deepEqual(await readPhoneNoticeSettingsForUser(ALICE), { morningMessage: false, eveningReminder: false, eveningTime: '19:00', quietHours: DEFAULT_QUIET_HOURS }, 'le matin et le soir se règlent chacun, sans toucher aux heures de silence');
  await assert.rejects(saveEveningReminderForUser(ALICE, ALICE, { enabled: true, time: '23:00' }, MORNING.toISOString()), /de 17 h à 22 h/);

  const nextDay = new Date('2026-10-01T17:05:00.000Z');
  mock.timers.setTime(Date.parse('2026-10-01T04:00:00.000Z'));
  await planIrrigation(alice, '2026-10-01T05:00:00.000Z');
  await planIrrigation(bob, '2026-10-01T05:00:00.000Z');
  await saveFeatureSelectionForUser(BOB, ['alertes-meteo'], new Date());
  const quiet = recorder();
  assert.deepEqual(await runEveningReminders({ now: nextDay, schedule: quiet.schedule, log: quiet.log }), { due: 0, sent: 0, alreadySent: 0, silenced: 0, failed: 0, successful: true });
  assert.deepEqual(quiet.requests, [], 'A a coupé, B a décoché « Arrosages »');

  await saveFeatureSelectionForUser(BOB, [...FEATURE_IDS], new Date());
  await requestFarmErasure(BOB, new Date());
  assert.deepEqual(await runEveningReminders({ now: nextDay, schedule: quiet.schedule, log: quiet.log }), { due: 0, sent: 0, alreadySent: 0, silenced: 0, failed: 0, successful: true });
  assert.deepEqual(quiet.requests, [], 'B, figé par sa demande d’effacement, ne reçoit plus rien');
});

test('une panne du Worker se journalise sans nom, rend la prise et marque le passage en échec ; le passage suivant réessaie', async () => {
  const fixture = await createDripFixture(ALICE, { name: 'Rampe 1' });
  await ensureWorkspaceForUser(ALICE);
  await planIrrigation(fixture, '2026-09-30T05:00:00.000Z');
  const broken = recorder('throw');
  assert.deepEqual(await runEveningReminders({ now: EVENING, schedule: broken.schedule, log: broken.log }), { due: 1, sent: 0, alreadySent: 0, silenced: 0, failed: 1, successful: false });
  const failed = recorder('failed');
  assert.equal((await runEveningReminders({ now: new Date(EVENING.getTime() + 60_000), schedule: failed.schedule, log: failed.log })).failed, 1);
  const pass = broken.lines.find((line) => line.entry.event === 'evening_reminder_pass_failed');
  assert.equal(pass?.level, 'warn');
  assert.equal(pass?.entry.summary, '1 ferme sans rappel (panne du service de notification ou de la lecture)');
  assert.ok(!JSON.stringify([...broken.lines, ...failed.lines]).includes(ALICE));
  const run = (await readTaskRuns(['evening-reminder'])).get('evening-reminder');
  assert.equal(run?.lastSuccessAt ?? null, null, 'aucune réussite');

  const disabled = recorder('disabled');
  assert.deepEqual(await runEveningReminders({ now: new Date(EVENING.getTime() + 2 * 60_000), schedule: disabled.schedule, log: disabled.log }), { due: 1, sent: 0, alreadySent: 0, silenced: 0, failed: 0, successful: true }, 'le service non configuré n’est pas une panne');
  const retry = recorder();
  assert.equal((await runEveningReminders({ now: new Date(EVENING.getTime() + HOUR_MS), schedule: retry.schedule, log: retry.log })).sent, 1, 'chaque prise rendue : 20 h 05 réessaie');
});

test('deux fermes au même passage : chacune son alarme, aucune ne remplace l’autre (§4.4, F744, revue de l’isolation du 22 novembre 2026, constat A)', async () => {
  const alice = await createDripFixture(ALICE, { name: 'Rampe A' });
  const bob = await createDripFixture(BOB, { name: 'Rampe B' });
  const aliceSpace = await ensureWorkspaceForUser(ALICE);
  const bobSpace = await ensureWorkspaceForUser(BOB);
  await planIrrigation(alice, '2026-09-30T05:00:00.000Z');
  await planIrrigation(bob, '2026-09-30T05:00:00.000Z');
  // Le Worker tel qu'il range les alarmes : une seule par identifiant, une révision plus ancienne refusée (`stale`).
  const kept = new Map<string, IrrigationPushAlarmRequest>();
  const schedule: PlanningAlarmScheduler = async (request) => {
    const current = kept.get(request.eventEquipmentId);
    if (current && current.revision > request.revision) return { status: 'stale' };
    kept.set(request.eventEquipmentId, request);
    return { status: 'ok' };
  };
  assert.deepEqual(await runEveningReminders({ now: EVENING, schedule, log: () => undefined }), { due: 2, sent: 2, alreadySent: 0, silenced: 0, failed: 0, successful: true });
  assert.deepEqual(
    [...kept.values()].map((alarm) => [alarm.eventEquipmentId, alarm.recipientKey, alarm.notification.body]).sort(),
    [
      [`evening:${aliceSpace}:2026-09-30`, aliceSpace, '1 arrosage prévu aujourd’hui n’est pas confirmé : Rampe A. L’avez-vous fait ?'],
      [`evening:${bobSpace}:2026-09-30`, bobSpace, '1 arrosage prévu aujourd’hui n’est pas confirmé : Rampe B. L’avez-vous fait ?'],
    ].sort(),
    'deux alarmes gardées par le Worker, chacune pour son espace et avec ses seuls arrosages',
  );
});

test('un refus du Worker (« stale ») n’est jamais compté comme parti : la prise est rendue, le passage en échec, le suivant réessaie (F745)', async () => {
  const fixture = await createDripFixture(ALICE, { name: 'Rampe 1' });
  await ensureWorkspaceForUser(ALICE);
  await planIrrigation(fixture, '2026-09-30T05:00:00.000Z');
  const refused = recorder('stale');
  assert.deepEqual(await runEveningReminders({ now: EVENING, schedule: refused.schedule, log: refused.log }), { due: 1, sent: 0, alreadySent: 0, silenced: 0, failed: 1, successful: false });
  assert.equal((await readTaskRuns(['evening-reminder'])).get('evening-reminder')?.lastSuccessAt ?? null, null, 'aucune réussite au registre');
  const retry = recorder();
  assert.deepEqual(await runEveningReminders({ now: new Date(EVENING.getTime() + HOUR_MS), schedule: retry.schedule, log: retry.log }), { due: 1, sent: 1, alreadySent: 0, silenced: 0, failed: 0, successful: true }, 'la prise rendue : 20 h 05 envoie le rappel');
});

test('avant 17 h, le passage ne lit rien et réussit', async () => {
  await ensureWorkspaceForUser(ALICE);
  const calls = recorder();
  assert.deepEqual(await runEveningReminders({ now: new Date('2026-09-30T10:05:00.000Z'), schedule: calls.schedule, log: calls.log }), { due: 0, sent: 0, alreadySent: 0, silenced: 0, failed: 0, successful: true });
  assert.equal((await readTaskRuns(['evening-reminder'])).get('evening-reminder')?.lastSuccessAt, '2026-09-30T10:05:00.000Z');
});
