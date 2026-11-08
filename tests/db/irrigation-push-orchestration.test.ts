import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { createIrrigationEventForUser } from '../../db/irrigation-event/create';
import { getIrrigationPushScheduleForUser } from '../../db/irrigation-event/push-schedule';
import type { IrrigationPushScheduleRecord } from '../../lib/domain/irrigation-event-record';
import { pushAlarmRequest, synchronizeIrrigationPushSchedule } from '../../lib/services/irrigation-push-orchestration';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { createDripFixture, plannedDraft, runningDraft } from '../support/irrigation-fixtures';

/**
 * Les deux alarmes qu'une irrigation confie au Worker de notification
 * (docs/push-worker-contract.md ; docs/replanning-contract.md, règles 21 et
 * 24) : la fin du minuteur, et le retard d'une irrigation planifiée.
 */

const ALICE = 'alice';

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

const SCHEDULE: Omit<IrrigationPushScheduleRecord, 'kind'> = {
  workspaceId: 'ws-1', eventEquipmentId: 'ee-1', season: 2026, revision: '0000000000001-r1',
  dueAt: '2026-06-15T10:30:00.000Z', status: 'pending', equipmentName: 'Goutte-à-goutte', settingName: 'Réglage 1',
};

test('la fin du minuteur et le retard : même identifiant, même révision, titres et étiquettes distincts, un clic ouvre l’irrigation', () => {
  assert.deepEqual(pushAlarmRequest({ ...SCHEDULE, kind: 'late' }), {
    eventEquipmentId: 'ee-1', recipientKey: 'ws-1', revision: '0000000000001-r1', dueAt: '2026-06-15T10:30:00.000Z',
    notification: {
      title: 'Irrigation en retard',
      body: 'Goutte-à-goutte · Réglage 1, non démarrée à l’heure prévue',
      tag: 'irrigation-late-ee-1-0000000000001-r1',
      data: { url: '/irrigation/arrosages?season=2026#irrigation-ee-1' },
    },
  });
  assert.deepEqual(pushAlarmRequest({ ...SCHEDULE, kind: 'finished' }).notification, {
    title: 'Irrigation terminée',
    body: 'Goutte-à-goutte · Réglage 1',
    tag: 'irrigation-finished-ee-1-0000000000001-r1',
    data: { url: '/irrigation/arrosages?season=2026#irrigation-ee-1' },
  });
});

test('sans service configuré : l’alerte de retard se tait et la ligne est marquée « disabled » ; l’alerte de fin du minuteur prévient (règle 23)', async () => {
  const fixture = await createDripFixture(ALICE);
  const planned = await createIrrigationEventForUser(
    ALICE,
    plannedDraft(fixture, { startAt: '2099-06-15T10:00:00.000Z', endAt: '2099-06-15T11:00:00.000Z', durationSeconds: 3600 }),
    { lateToleranceMinutes: 30 },
  );
  assert.equal(planned.pushSchedule?.kind, 'late');
  assert.equal(await synchronizeIrrigationPushSchedule(ALICE, planned), undefined, 'rien à dire : l’irrigation est planifiée, le retard se lit à l’écran');
  assert.equal((await getIrrigationPushScheduleForUser(ALICE, planned.eventEquipmentId))?.status, 'disabled');

  const running = await createIrrigationEventForUser(ALICE, runningDraft(fixture, 600));
  assert.equal(running.pushSchedule?.kind, 'finished');
  assert.equal(await synchronizeIrrigationPushSchedule(ALICE, running), 'Le minuteur fonctionne, mais l’alerte serveur n’est pas encore configurée.');
});
