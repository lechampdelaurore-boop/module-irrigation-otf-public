import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { ensureWorkspaceForUser } from '../../db/workspace-repository';
import type { IrrigationPushAlarmRequest } from '../../lib/domain/irrigation-push-contract';
import type { StoredPlanSuggestion } from '../../lib/domain/planning/contract';
import { notifyMorningSuggestions } from '../../lib/services/planning-notifications';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';

/**
 * La notification du matin passe par l'alarme existante du Worker de
 * notification (docs/replanning-contract.md, règles 21 à 24) : une alarme à
 * échéance immédiate, sous un identifiant du calcul, pour la clé de
 * l'exploitation ; une panne n'altère rien et se journalise sans nommer
 * personne (règle 23).
 */

const ALICE = 'alice';
const NOW = new Date('2026-09-30T04:15:00.000Z'); // mercredi 6 h 15 à la ferme
const HOUR_MS = 3_600_000;

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

function suggestion(overrides: Partial<StoredPlanSuggestion> & Pick<StoredPlanSuggestion, 'eventEquipmentId'>): StoredPlanSuggestion {
  const plannedStartAt = overrides.plannedStartAt ?? new Date(NOW.getTime() + 2 * HOUR_MS).toISOString();
  return {
    eventId: `event-${overrides.eventEquipmentId}`, equipmentId: 'asp1', equipmentName: 'Rampe bloc 2', kind: 'sprinkler', priority: 'normal',
    plannedStartAt, plannedEndAt: new Date(Date.parse(plannedStartAt) + 2 * HOUR_MS).toISOString(), plannedDurationSeconds: 7200, plannedDoseMm: 12,
    suggestion: 'cancel', doseMm: null, durationSeconds: null, endAt: null, causes: [], kept: false,
    ...overrides,
  };
}

function plan(suggestions: StoredPlanSuggestion[]) {
  return { calculation: { id: 'calc-1', season: 2026 }, suggestions };
}

type Line = { level: string; entry: Record<string, unknown> };

test('le matin, une alarme immédiate regroupe les suggestions des prochaines 24 heures, sous un identifiant du calcul et la clé de l’exploitation', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  const requests: IrrigationPushAlarmRequest[] = [];
  const lines: Line[] = [];
  await notifyMorningSuggestions({
    ownerUserId: ALICE,
    plan: plan([
      suggestion({ eventEquipmentId: 'ee-2', plannedStartAt: new Date(NOW.getTime() + 10 * HOUR_MS).toISOString(), suggestion: 'reduce', doseMm: 8, durationSeconds: 4800, equipmentName: 'Goutte-à-goutte' }),
      suggestion({ eventEquipmentId: 'ee-1' }),
    ]),
    now: NOW,
    schedule: async (request) => { requests.push(request); return { status: 'ok' }; },
    log: (level, entry) => { lines.push({ level, entry }); },
  });
  assert.equal(requests.length, 1, 'une seule alarme par calcul');
  const [request] = requests;
  assert.equal(request.eventEquipmentId, 'plan:calc-1');
  assert.equal(request.recipientKey, workspaceId);
  assert.equal(request.dueAt, NOW.toISOString(), 'à échéance immédiate');
  assert.match(request.revision, /^\d{13}-[0-9a-f-]{36}$/u, 'la révision des alarmes, datée');
  assert.deepEqual(request.notification, {
    title: 'Suggestions du planning',
    body: '2 suggestions sur vos arrosages des prochaines 24 heures · Annuler Rampe bloc 2 · Réduire Goutte-à-goutte à 8 mm',
    tag: 'planning-suggestions-calc-1',
    data: { url: '/irrigation/planning?season=2026' },
  });
  assert.deepEqual(lines, [{ level: 'info', entry: { event: 'planning_suggestion_notification_sent', calculationId: 'calc-1', suggestions: 2, sentAt: NOW.toISOString() } }]);
  assert.ok(!JSON.stringify(lines).includes(ALICE), 'jamais d’identifiant de personne');
});

test('rien à dire, rien d’envoyé ; une panne du Worker se journalise sans lever ; sans service configuré, silence', async () => {
  let calls = 0;
  const counting = async () => { calls += 1; return { status: 'ok' as const }; };
  await notifyMorningSuggestions({ ownerUserId: ALICE, plan: plan([suggestion({ eventEquipmentId: 'ee-1' })]), now: NOW, schedule: counting });
  assert.equal(calls, 0, 'sans espace d’irrigation, personne à prévenir');
  await ensureWorkspaceForUser(ALICE);
  await notifyMorningSuggestions({ ownerUserId: ALICE, plan: plan([]), now: NOW, schedule: counting });
  await notifyMorningSuggestions({ ownerUserId: ALICE, plan: plan([suggestion({ eventEquipmentId: 'ee-1', kept: true })]), now: NOW, schedule: counting });
  assert.equal(calls, 0, 'sans suggestion à dire, aucune alarme');

  const lines: Line[] = [];
  const log = (level: string, entry: Record<string, unknown>) => { lines.push({ level, entry }); };
  const noisy = plan([suggestion({ eventEquipmentId: 'ee-1' })]);
  await notifyMorningSuggestions({ ownerUserId: ALICE, plan: noisy, now: NOW, schedule: async () => { throw new Error('réseau coupé'); }, log });
  await notifyMorningSuggestions({ ownerUserId: ALICE, plan: noisy, now: NOW, schedule: async () => ({ status: 'failed', message: 'Le service d’alerte a répondu 500.' }), log });
  await notifyMorningSuggestions({ ownerUserId: ALICE, plan: noisy, now: NOW, schedule: async () => ({ status: 'disabled' }), log });
  assert.deepEqual(
    lines.map((line) => [line.level, line.entry.event, line.entry.error, line.entry.suggestions]),
    [
      ['warn', 'planning_suggestion_notification_failed', 'réseau coupé', 1],
      ['warn', 'planning_suggestion_notification_failed', 'Le service d’alerte a répondu 500.', 1],
    ],
    'deux pannes journalisées, le service non configuré se tait',
  );
});
