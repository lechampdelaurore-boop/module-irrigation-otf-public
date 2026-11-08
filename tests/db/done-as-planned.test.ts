import assert from 'node:assert/strict';
import test, { afterEach, beforeEach, mock } from 'node:test';
import { recordDoneAsPlannedForUser } from '../../db/irrigation-event/completion';
import { createIrrigationEventForUser, updatePlannedIrrigationForUser } from '../../db/irrigation-event/create';
import { IrrigationEventNotFoundError, IrrigationEventStateError } from '../../db/irrigation-event/errors';
import { getIrrigationPushScheduleForUser } from '../../db/irrigation-event/push-schedule';
import { listIrrigationEventsForUser } from '../../db/irrigation-event/read';
import { startIrrigationEventForUser } from '../../db/irrigation-event/timer';
import { readHydraulicRevisionForUser, readWaterBudgetRevisionForUser } from '../../db/workspace-repository';
import { doneAsPlanned, type DoneAsPlannedRecord } from '../../lib/domain/done-as-planned';
import type { IrrigationEventRecord } from '../../lib/domain/irrigation-event-record';
import { recordDoneAsPlannedForOwner } from '../../lib/services/done-as-planned-service';
import { IrrigationPushCancellationError } from '../../lib/services/irrigation-push-orchestration';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { createDripFixture, plannedDraft, type IrrigationFixture } from '../support/irrigation-fixtures';

/**
 * « Tout est fait » dans la base (docs/aujourdhui-tableau-de-bord-contract.md,
 * section 3.4) : chaque irrigation devient réalisée telle que prévue, tout ou
 * rien ; une irrigation changée depuis l'affichage, démarrée ou d'un autre
 * propriétaire n'est pas écrite ; les autres le sont, et chaque refus garde
 * son nom. Maintenant = lundi 15 juin 2026, 8 h UTC.
 */

const ALICE = 'alice';
const BOB = 'bob';
const T0 = '2026-06-15T08:00:00.000Z';

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
  mock.timers.enable({ apis: ['Date'], now: new Date(T0) });
});
afterEach(() => {
  mock.timers.reset();
  database.dispose();
});

async function plan(fixture: IrrigationFixture, startAt: string, minutes: number, lateToleranceMinutes?: number): Promise<IrrigationEventRecord> {
  const endAt = new Date(Date.parse(startAt) + minutes * 60_000).toISOString();
  const created = await createIrrigationEventForUser(
    fixture.ownerUserId,
    plannedDraft(fixture, { startAt, endAt, durationSeconds: minutes * 60 }),
    lateToleranceMinutes === undefined ? {} : { lateToleranceMinutes },
  );
  const event = (await listIrrigationEventsForUser(fixture.ownerUserId)).find((item) => item.equipment.id === created.eventEquipmentId);
  if (!event) throw new Error('irrigation planifiée introuvable après création');
  return event;
}

function recordOf(event: IrrigationEventRecord): DoneAsPlannedRecord {
  const result = doneAsPlanned(event, new Date());
  if (!result.ok) throw new Error(`refus inattendu : ${result.refusal}`);
  return result.record;
}

async function reread(ownerUserId: string, eventEquipmentId: string, history = false) {
  const event = (await listIrrigationEventsForUser(ownerUserId, undefined, history)).find((item) => item.equipment.id === eventEquipmentId);
  assert.ok(event, 'irrigation relue');
  return event;
}

test('fait comme prévu : réalisée aux heures, à la durée et aux doses prévues, l’alerte de retard retirée, le journal le dit', async () => {
  // Planifiée hier à 5 h pour 6 h à 6 h 45, avec son alerte de retard ; enregistrée aujourd'hui à 8 h.
  mock.timers.setTime(Date.parse('2026-06-14T05:00:00.000Z'));
  const fixture = await createDripFixture(ALICE, { rateMmPerHour: 12, beds: ['bed-1', 'bed-2'] });
  const planned = await plan(fixture, '2026-06-14T06:00:00.000Z', 45, 30);
  assert.equal((await getIrrigationPushScheduleForUser(ALICE, planned.equipment.id))?.kind, 'late', 'l’alerte de retard existe avant');
  mock.timers.setTime(Date.parse(T0));
  const revision = await readWaterBudgetRevisionForUser(ALICE);
  const hydraulic = await readHydraulicRevisionForUser(ALICE);

  await recordDoneAsPlannedForUser(ALICE, recordOf(planned));

  const done = await reread(ALICE, planned.equipment.id, true);
  assert.equal(done.status, 'completed');
  assert.equal(done.equipment.status, 'completed');
  assert.equal(done.equipment.actualStartAt, '2026-06-14T06:00:00.000Z');
  assert.equal(done.equipment.actualEndAt, '2026-06-14T06:45:00.000Z');
  assert.equal(done.equipment.actualDurationSeconds, 2700);
  assert.deepEqual(
    done.equipment.applications.map((application) => [application.otfBedId, application.plannedAmountMm, application.actualAmountMm]),
    [['bed-1', 9, 9], ['bed-2', 9, 9]],
    '12 mm/h pendant 45 min : la dose prévue devient la dose reçue',
  );
  // Le matériel, le réglage et la position restent ceux de l'irrigation.
  assert.deepEqual(done.equipment.settingSnapshot, planned.equipment.settingSnapshot);
  assert.deepEqual(done.equipment.placementSnapshot, planned.equipment.placementSnapshot);
  assert.deepEqual(done.timerHistory?.map((entry) => [entry.action, entry.payload.asPlanned ?? null]), [['created', null], ['completed', true]]);
  assert.equal(await getIrrigationPushScheduleForUser(ALICE, planned.equipment.id), null, 'l’alerte de retard part avec elle');
  assert.equal(await readWaterBudgetRevisionForUser(ALICE), revision + 1);
  assert.equal(await readHydraulicRevisionForUser(ALICE), hydraulic + 1);

  // Une seconde fois : déjà enregistrée, rien ne bouge (D-006).
  await assert.rejects(recordDoneAsPlannedForUser(ALICE, recordOf(planned)), IrrigationEventStateError);
  assert.equal((await reread(ALICE, planned.equipment.id, true)).timerHistory?.length, 2);
});

test('fait comme prévu : une irrigation modifiée depuis l’affichage n’est pas écrite, ni à l’ancienne heure ni à la nouvelle', async () => {
  const fixture = await createDripFixture(ALICE);
  const planned = await plan(fixture, '2026-06-14T06:00:00.000Z', 60);
  const shown = recordOf(planned);
  await updatePlannedIrrigationForUser(ALICE, planned.equipment.id, plannedDraft(fixture, {
    startAt: '2026-06-14T07:00:00.000Z', endAt: '2026-06-14T07:30:00.000Z', durationSeconds: 1800,
  }));
  await assert.rejects(recordDoneAsPlannedForUser(ALICE, shown), IrrigationEventStateError);
  const untouched = await reread(ALICE, planned.equipment.id, true);
  assert.equal(untouched.status, 'planned');
  assert.equal(untouched.equipment.plannedStartAt, '2026-06-14T07:00:00.000Z');
  assert.equal(untouched.equipment.actualStartAt, null);
  assert.ok(untouched.equipment.applications.every((application) => application.actualAmountMm === 0));
  assert.ok(!untouched.timerHistory?.some((entry) => entry.action === 'completed'));
});

test('fait comme prévu : refusé à une irrigation démarrée au chrono, et introuvable pour un autre propriétaire', async () => {
  const fixture = await createDripFixture(ALICE);
  const planned = await plan(fixture, '2026-06-14T06:00:00.000Z', 60);
  const shown = recordOf(planned);
  await assert.rejects(recordDoneAsPlannedForUser(BOB, shown), IrrigationEventNotFoundError);
  await startIrrigationEventForUser(ALICE, planned.equipment.id);
  await assert.rejects(recordDoneAsPlannedForUser(ALICE, shown), IrrigationEventStateError);
  const running = await reread(ALICE, planned.equipment.id);
  assert.equal(running.equipment.timerState, 'running');
  assert.equal(running.equipment.actualEndAt, null);
});

test('tout est fait : les finies s’enregistrent, chaque refus garde son nom, le plan se recalcule une fois', async () => {
  const fixture = await createDripFixture(ALICE, { name: 'Rampe nord' });
  const yesterday = await plan(fixture, '2026-06-14T06:00:00.000Z', 60);
  const earlier = await plan(fixture, '2026-06-13T18:00:00.000Z', 30);
  const notOver = await plan(fixture, '2026-06-15T07:30:00.000Z', 60);
  const running = await plan(fixture, '2026-06-15T05:00:00.000Z', 60);
  await startIrrigationEventForUser(ALICE, running.equipment.id);
  const lastSeason = await plan(await createDripFixture(ALICE, { season: 2025, name: 'Ancienne rampe' }), '2025-06-14T06:00:00.000Z', 60);
  const bobs = await plan(await createDripFixture(BOB), '2026-06-14T06:00:00.000Z', 60);

  const cancelled: string[] = [];
  const recalculations: { kind: string; season: number; at: string | Date }[] = [];
  const outcome = await recordDoneAsPlannedForOwner(
    { ownerUserId: ALICE, season: 2026, eventEquipmentIds: [yesterday.equipment.id, notOver.equipment.id, running.equipment.id, earlier.equipment.id, lastSeason.equipment.id, bobs.equipment.id, yesterday.equipment.id] },
    {
      cancelPushSchedule: async (_owner, id) => { cancelled.push(id); },
      recalculatePlan: async (_owner, event) => { recalculations.push(event); },
    },
  );

  assert.equal(outcome.recorded, 2, 'hier et avant-hier ; un doublon ne compte qu’une fois');
  assert.deepEqual(outcome.refused.map((item) => [item.eventEquipmentId, item.title, item.reason]), [
    [notOver.equipment.id, 'Rampe nord · Réglage 1', 'Son heure de fin prévue n’est pas encore passée.'],
    [running.equipment.id, 'Rampe nord · Réglage 1', 'Elle a déjà été démarrée, enregistrée ou annulée.'],
    [lastSeason.equipment.id, 'Une irrigation', 'Cette irrigation est introuvable.'],
    [bobs.equipment.id, 'Une irrigation', 'Cette irrigation est introuvable.'],
  ]);
  assert.deepEqual(cancelled, [yesterday.equipment.id, earlier.equipment.id]);
  assert.deepEqual(recalculations, [{ kind: 'irrigation-completed', season: 2026, at: new Date('2026-06-14T06:00:00.000Z') }], 'une fois, datée par la plus récente');
  assert.equal((await reread(ALICE, yesterday.equipment.id)).status, 'completed');
  assert.equal((await reread(ALICE, earlier.equipment.id)).status, 'completed');
  assert.equal((await reread(ALICE, notOver.equipment.id)).status, 'planned');
  assert.equal((await reread(ALICE, lastSeason.equipment.id)).status, 'planned', 'une autre saison n’est pas touchée');
  assert.equal((await reread(BOB, bobs.equipment.id)).status, 'planned', 'une autre ferme n’est pas touchée');
});

test('tout est fait : une alerte qui ne se retire pas refuse son irrigation, les autres restent enregistrées', async () => {
  const fixture = await createDripFixture(ALICE);
  const first = await plan(fixture, '2026-06-14T06:00:00.000Z', 60);
  const second = await plan(fixture, '2026-06-14T09:00:00.000Z', 60);
  let recalculated = 0;
  const outcome = await recordDoneAsPlannedForOwner(
    { ownerUserId: ALICE, season: 2026, eventEquipmentIds: [first.equipment.id, second.equipment.id] },
    {
      cancelPushSchedule: async (_owner, id) => { if (id === first.equipment.id) throw new IrrigationPushCancellationError(); },
      recalculatePlan: async () => { recalculated += 1; },
    },
  );
  assert.equal(outcome.recorded, 1);
  assert.deepEqual(outcome.refused.map((item) => [item.eventEquipmentId, item.reason]), [[first.equipment.id, new IrrigationPushCancellationError().message]]);
  assert.equal((await reread(ALICE, first.equipment.id)).status, 'planned');
  assert.equal((await reread(ALICE, second.equipment.id)).status, 'completed');
  assert.equal(recalculated, 1);

  // Rien d'enregistré : pas de recalcul.
  const none = await recordDoneAsPlannedForOwner(
    { ownerUserId: ALICE, season: 2026, eventEquipmentIds: [second.equipment.id] },
    { cancelPushSchedule: async () => {}, recalculatePlan: async () => { recalculated += 1; } },
  );
  assert.equal(none.recorded, 0);
  assert.equal(recalculated, 1);
});
