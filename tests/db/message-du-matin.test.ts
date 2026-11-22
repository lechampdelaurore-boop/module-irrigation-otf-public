import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { readPhoneNoticeSettingsForUser, saveMorningMessageForUser } from '../../db/phone-notice-repository';
import { ensureWorkspaceForUser } from '../../db/workspace-repository';
import type { IrrigationSnapshot } from '../../lib/domain/domain';
import { FEATURE_IDS } from '../../lib/domain/features/catalogue';
import type { IrrigationPushAlarmRequest } from '../../lib/domain/irrigation-push-contract';
import type { StoredPlanSuggestion } from '../../lib/domain/planning/contract';
import { sendMorningMessage, STALE_ALARM_WORDS, type PlanningAlarmScheduler } from '../../lib/services/morning-message';
import { countTodayAlertsForUser } from '../../lib/services/today-weather';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { ALICE, BOB } from '../support/spaces';

/**
 * Le message unique du matin passe par l'alarme existante du Worker de
 * notification (amélioration n° 3, docs/ameliorations-6-2-3-7-contract.md,
 * sections 4.2 et 4.4, F703, F712, F744, F745 ; docs/replanning-contract.md,
 * règles 21 à 24) : une alarme à échéance immédiate, sous l'identifiant de
 * l'espace et du jour de Paris, pour la clé de l'exploitation ; un seul message par jour et par ferme, la prise
 * gardée en base avant l'envoi et rendue s'il échoue ; rien si la ferme l'a
 * coupé ; une panne n'altère rien et se journalise sans nommer personne
 * (règle 23).
 */

const NOW = new Date('2026-09-30T04:15:00.000Z'); // mercredi 6 h 15 à la ferme
const HOUR_MS = 3_600_000;
const SNAPSHOT = { structure: null, zones: [], plots: [], beds: [] } as unknown as IrrigationSnapshot;

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

function suggestion(eventEquipmentId: string, overrides: Partial<StoredPlanSuggestion> = {}): StoredPlanSuggestion {
  const plannedStartAt = new Date(NOW.getTime() + 2 * HOUR_MS).toISOString();
  return {
    eventId: `event-${eventEquipmentId}`, eventEquipmentId, equipmentId: 'asp1', equipmentName: 'Rampe bloc 2', kind: 'sprinkler', priority: 'normal',
    plannedStartAt, plannedEndAt: new Date(Date.parse(plannedStartAt) + 2 * HOUR_MS).toISOString(), plannedDurationSeconds: 7200, plannedDoseMm: 12,
    suggestion: 'cancel', doseMm: null, durationSeconds: null, endAt: null, causes: [], kept: false,
    ...overrides,
  };
}

type Line = { level: string; entry: Record<string, unknown> };

function recorder() {
  const requests: IrrigationPushAlarmRequest[] = [];
  const lines: Line[] = [];
  return {
    requests,
    lines,
    schedule: async (request: IrrigationPushAlarmRequest) => { requests.push(request); return { status: 'ok' as const }; },
    log: (level: string, entry: Record<string, unknown>) => { lines.push({ level, entry }); },
  };
}

function send(ownerUserId: string, options: {
  now?: Date;
  suggestions?: StoredPlanSuggestion[];
  alerts?: number;
  forecastRainMm?: number | null;
  schedule: PlanningAlarmScheduler;
  log?: (level: string, entry: Record<string, unknown>) => void;
}) {
  return sendMorningMessage({
    ownerUserId,
    season: 2026,
    snapshot: SNAPSHOT,
    enabled: [...FEATURE_IDS],
    plan: { suggestions: options.suggestions ?? [suggestion('ee-1')] },
    events: [],
    forecastRainMm: options.forecastRainMm ?? null,
    now: options.now ?? NOW,
    schedule: options.schedule,
    log: options.log ?? (() => undefined),
    countAlerts: async () => options.alerts ?? 0,
  });
}

function noticeRows() {
  return database.sqlite.prepare('SELECT kind, paris_day, sent_at FROM irrigation_phone_notices ORDER BY workspace_id').all()
    .map((row) => ({ kind: row.kind, parisDay: row.paris_day, sent: row.sent_at !== null }));
}

test('le matin, une alarme immédiate sous l’identifiant de l’espace et du jour, et la clé de l’exploitation ; un clic ouvre « Aujourd’hui »', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  const alice = recorder();
  await send(ALICE, { ...alice, alerts: 1, forecastRainMm: 3 });
  assert.equal(alice.requests.length, 1, 'un seul message');
  const [request] = alice.requests;
  assert.equal(request.eventEquipmentId, `morning:${workspaceId}:2026-09-30`);
  assert.equal(request.recipientKey, workspaceId);
  assert.equal(request.dueAt, NOW.toISOString(), 'à échéance immédiate');
  assert.match(request.revision, /^\d{13}-[0-9a-f-]{36}$/u, 'la révision des alarmes, datée');
  assert.deepEqual(request.notification, {
    title: 'Votre journée',
    body: 'Pluie prévue aujourd’hui : 3 mm. 1 alerte en cours. 1 suggestion sur un arrosage des prochaines 24 heures : Annuler Rampe bloc 2.',
    tag: `morning-${workspaceId}-2026-09-30`,
    data: { url: '/irrigation/aujourdhui' },
  });
  assert.deepEqual(alice.lines, [{ level: 'info', entry: { event: 'morning_message_sent', parisDay: '2026-09-30', irrigations: 0, alerts: 1, suggestions: 1, sentAt: NOW.toISOString() } }]);
  assert.ok(!JSON.stringify(alice.lines).includes(ALICE), 'jamais d’identifiant de personne');
  assert.deepEqual(noticeRows(), [{ kind: 'morning', parisDay: '2026-09-30', sent: true }]);
});

test('un seul message par jour et par ferme : un second calcul du même jour ne renvoie rien ; le lendemain, si', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  const alice = recorder();
  await send(ALICE, alice);
  await send(ALICE, { ...alice, now: new Date(NOW.getTime() + 3 * HOUR_MS) });
  assert.equal(alice.requests.length, 1, 'le second calcul du jour se tait');
  assert.deepEqual(alice.lines.map((line) => line.entry.event), ['morning_message_sent', 'morning_message_already_sent']);
  const tomorrow = new Date(NOW.getTime() + 24 * HOUR_MS);
  await send(ALICE, { ...alice, now: tomorrow, suggestions: [suggestion('ee-2', { plannedStartAt: new Date(tomorrow.getTime() + HOUR_MS).toISOString(), plannedEndAt: new Date(tomorrow.getTime() + 2 * HOUR_MS).toISOString() })] });
  assert.deepEqual(alice.requests.map((request) => request.eventEquipmentId), [`morning:${workspaceId}:2026-09-30`, `morning:${workspaceId}:2026-10-01`]);
  assert.deepEqual(noticeRows(), [{ kind: 'morning', parisDay: '2026-10-01', sent: true }], 'une ligne par espace et par genre, réécrite chaque jour');
});

test('la ferme coupe le message : rien ne part ; le réglage est d’elle seule et se rallume', async () => {
  await ensureWorkspaceForUser(ALICE);
  const bobSpace = await ensureWorkspaceForUser(BOB);
  assert.equal((await readPhoneNoticeSettingsForUser(ALICE)).morningMessage, true, 'activé par défaut, sans ligne écrite');
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) AS n FROM irrigation_phone_notice_settings').get()?.n, 0);
  assert.equal((await saveMorningMessageForUser(ALICE, ALICE, false, NOW.toISOString())).morningMessage, false);
  const row = database.sqlite.prepare('SELECT morning_message, evening_reminder, evening_time, actor_user_id, updated_at FROM irrigation_phone_notice_settings').get();
  assert.deepEqual({ ...row }, { morning_message: 0, evening_reminder: null, evening_time: null, actor_user_id: ALICE, updated_at: NOW.toISOString() }, 'la personne et l’heure ; le soir reste au défaut');

  const calls = recorder();
  await send(ALICE, calls);
  assert.equal(calls.requests.length, 0, 'coupé : rien');
  await send(BOB, calls);
  assert.deepEqual(calls.requests.map((request) => request.eventEquipmentId), [`morning:${bobSpace}:2026-09-30`], 'B garde son message');
  assert.equal((await readPhoneNoticeSettingsForUser(BOB)).morningMessage, true);

  await saveMorningMessageForUser(ALICE, ALICE, true, NOW.toISOString());
  await send(ALICE, calls);
  assert.equal(calls.requests.length, 2, 'rallumé, il repart');
});

test('rien à dire, rien d’envoyé ni pris ; sans espace, personne à prévenir', async () => {
  const calls = recorder();
  await send(ALICE, calls);
  assert.equal(calls.requests.length, 0, 'sans espace d’irrigation, personne à prévenir');
  await ensureWorkspaceForUser(ALICE);
  await send(ALICE, { ...calls, suggestions: [] });
  await send(ALICE, { ...calls, suggestions: [suggestion('ee-1', { kept: true })], forecastRainMm: 8 });
  assert.equal(calls.requests.length, 0, 'ni arrosage, ni alerte, ni suggestion : aucune alarme, même avec de la pluie');
  assert.deepEqual(noticeRows(), [], 'aucune prise du jour');
});

test('une panne du Worker se journalise sans lever et rend la prise : un calcul relancé réessaie ; le service non configuré se tait', async () => {
  await ensureWorkspaceForUser(ALICE);
  const lines: Line[] = [];
  const log = (level: string, entry: Record<string, unknown>) => { lines.push({ level, entry }); };
  await send(ALICE, { schedule: async () => { throw new Error('réseau coupé'); }, log });
  await send(ALICE, { schedule: async () => ({ status: 'failed', message: 'Le service d’alerte a répondu 500.' }), log });
  await send(ALICE, { schedule: async () => ({ status: 'disabled' }), log });
  assert.deepEqual(
    lines.map((line) => [line.level, line.entry.event, line.entry.error, line.entry.suggestions]),
    [
      ['warn', 'morning_message_failed', 'réseau coupé', 1],
      ['warn', 'morning_message_failed', 'Le service d’alerte a répondu 500.', 1],
    ],
    'deux pannes journalisées, le service non configuré se tait',
  );
  assert.deepEqual(noticeRows(), [], 'chaque prise rendue');
  const retry = recorder();
  await send(ALICE, retry);
  assert.equal(retry.requests.length, 1, 'le calcul relancé le même jour envoie le message');
});

/**
 * Le Worker de notification tel qu'il range les alarmes
 * (`cloudflare/irrigation-push/src/index.ts`, `IrrigationAlarm.schedule`) :
 * une seule alarme par identifiant ; une révision plus ancienne que celle
 * qu'il garde est refusée (`stale`), une plus récente la remplace. Le vrai
 * Worker est éprouvé de même dans `cloudflare/irrigation-push/test/`.
 */
function workerAlarms() {
  const kept = new Map<string, IrrigationPushAlarmRequest>();
  const schedule: PlanningAlarmScheduler = async (request) => {
    const current = kept.get(request.eventEquipmentId);
    if (current && current.revision > request.revision) return { status: 'stale' };
    kept.set(request.eventEquipmentId, request);
    return { status: 'ok' };
  };
  return { kept, schedule };
}

test('deux fermes le même matin : chacune son alarme, chaque message gardé pour son espace (§4.4, F744, revue de l’isolation du 22 novembre 2026, constat A)', async () => {
  const aliceSpace = await ensureWorkspaceForUser(ALICE);
  const bobSpace = await ensureWorkspaceForUser(BOB);
  const worker = workerAlarms();
  await send(ALICE, { schedule: worker.schedule, alerts: 1 });
  await send(BOB, { schedule: worker.schedule, alerts: 2, now: new Date(NOW.getTime() + 60_000) });
  assert.deepEqual(
    [...worker.kept.values()].map((alarm) => [alarm.eventEquipmentId, alarm.recipientKey, alarm.notification.tag]).sort(),
    [
      [`morning:${aliceSpace}:2026-09-30`, aliceSpace, `morning-${aliceSpace}-2026-09-30`],
      [`morning:${bobSpace}:2026-09-30`, bobSpace, `morning-${bobSpace}-2026-09-30`],
    ].sort(),
    'deux alarmes gardées par le Worker, chacune pour son espace : aucune ne remplace l’autre',
  );
  assert.deepEqual(noticeRows(), [
    { kind: 'morning', parisDay: '2026-09-30', sent: true },
    { kind: 'morning', parisDay: '2026-09-30', sent: true },
  ]);
});

test('un refus du Worker (« stale ») n’est jamais compté comme parti : la prise est rendue, le refus journalisé, un calcul relancé réessaie (F745)', async () => {
  await ensureWorkspaceForUser(ALICE);
  const lines: Line[] = [];
  const log = (level: string, entry: Record<string, unknown>) => { lines.push({ level, entry }); };
  await send(ALICE, { schedule: async () => ({ status: 'stale' }), log });
  assert.deepEqual(
    lines.map((line) => [line.level, line.entry.event, line.entry.error]),
    [['warn', 'morning_message_failed', STALE_ALARM_WORDS]],
    'jamais « morning_message_sent »',
  );
  assert.deepEqual(noticeRows(), [], 'la prise du jour est rendue');
  assert.ok(!JSON.stringify(lines).includes(ALICE), 'jamais d’identifiant de personne');
  const retry = recorder();
  await send(ALICE, retry);
  assert.equal(retry.requests.length, 1, 'le calcul relancé le même jour envoie le message');
  assert.deepEqual(noticeRows(), [{ kind: 'morning', parisDay: '2026-09-30', sent: true }]);
});

test('les alertes en cours ne se lisent pas sans « Alertes météo » ni « Alertes cultures »', async () => {
  await ensureWorkspaceForUser(ALICE);
  assert.equal(await countTodayAlertsForUser({ ownerUserId: ALICE, snapshot: SNAPSHOT, season: 2026, enabled: ['planning', 'arrosages'], now: NOW }), 0);
  assert.equal(await countTodayAlertsForUser({ ownerUserId: ALICE, snapshot: SNAPSHOT, season: 2026, enabled: [...FEATURE_IDS], now: NOW }), 0, 'sans prévision conservée ni critère, aucune alerte');
});
