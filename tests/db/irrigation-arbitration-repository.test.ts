import assert from 'node:assert/strict';
import test, { afterEach, beforeEach, mock } from 'node:test';
import {
  invalidateIrrigationArbitrationsForUser,
  listIrrigationArbitrationsForUser,
  readFeasibilityRevisionForUser,
  saveIrrigationArbitrationForUser,
  wasIrrigationArbitrationSavedForUser,
} from '../../db/irrigation-arbitration-repository';
import { saveIrrigationNeedThresholdForUser } from '../../db/irrigation-need-repository';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';

const ALICE = 'alice';
const BOB = 'bob';
const SEASON = 2026;
const WEEK = '2026-06-15';

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-06-15T08:00:00.000Z') });
});
afterEach(() => {
  mock.timers.reset();
  database.dispose();
});

const arbitration = (overrides: Partial<Parameters<typeof saveIrrigationArbitrationForUser>[1]> = {}) => ({
  season: SEASON, weekStart: WEEK, priority: 'high' as const,
  selectedBedIds: ['bed-2', 'bed-1'], candidateBedIds: ['bed-3', 'bed-2', 'bed-1'],
  expectedRevision: 0, requestId: 'req-1',
  ...overrides,
});

test('la révision de faisabilité part de zéro et avance dès qu’une source du calcul change', async () => {
  assert.equal(await readFeasibilityRevisionForUser(ALICE), 0, 'lire crée l’espace au besoin');
  await saveIrrigationNeedThresholdForUser(ALICE, SEASON, WEEK, 5);
  assert.equal(await readFeasibilityRevisionForUser(ALICE), 1, 'déclencheur sur les préférences de besoin');
  assert.equal(await readFeasibilityRevisionForUser(BOB), 0);
});

test('enregistrer un arbitrage : sélection triée, révision attendue vérifiée par la base, relecture idempotente', async () => {
  await saveIrrigationArbitrationForUser(ALICE, arbitration());
  const [saved] = await listIrrigationArbitrationsForUser(ALICE, SEASON, WEEK);
  assert.deepEqual(saved, {
    priority: 'high', selectedBedIds: ['bed-1', 'bed-2'], candidateBedIds: ['bed-1', 'bed-2', 'bed-3'],
    decidedAt: '2026-06-15T08:00:00.000Z', invalidatedAt: null,
  });
  assert.equal(await readFeasibilityRevisionForUser(ALICE), 1, 'la décision elle-même consomme la révision attendue');
  assert.equal(await wasIrrigationArbitrationSavedForUser(ALICE, { requestId: 'req-1', season: SEASON, weekStart: WEEK, priority: 'high', selectedBedIds: ['bed-1', 'bed-2'] }), true);
  assert.equal(await wasIrrigationArbitrationSavedForUser(ALICE, { requestId: 'inconnue', season: SEASON, weekStart: WEEK, priority: 'high', selectedBedIds: ['bed-1'] }), false);
  await assert.rejects(
    wasIrrigationArbitrationSavedForUser(ALICE, { requestId: 'req-1', season: SEASON, weekStart: WEEK, priority: 'high', selectedBedIds: ['bed-1'] }),
    /déjà été utilisée/,
  );

  mock.timers.tick(60_000);
  await saveIrrigationArbitrationForUser(ALICE, arbitration({ expectedRevision: 99 }));
  assert.deepEqual(await listIrrigationArbitrationsForUser(ALICE, SEASON, WEEK), [saved], 'même requête, même sélection : rien ne bouge, même avec une révision fantaisiste');
  assert.equal(await readFeasibilityRevisionForUser(ALICE), 1);
  await assert.rejects(saveIrrigationArbitrationForUser(ALICE, arbitration({ selectedBedIds: ['bed-3'], expectedRevision: 1 })), /déjà été utilisée/);

  await assert.rejects(saveIrrigationArbitrationForUser(ALICE, arbitration({ requestId: 'req-2', selectedBedIds: ['bed-3'], expectedRevision: 0 })), /stale_feasibility_revision/);
  assert.deepEqual(await listIrrigationArbitrationsForUser(ALICE, SEASON, WEEK), [saved], 'une révision périmée n’écrit rien');

  await saveIrrigationArbitrationForUser(ALICE, arbitration({ requestId: 'req-2', selectedBedIds: ['bed-3'], expectedRevision: 1 }));
  const [redecided] = await listIrrigationArbitrationsForUser(ALICE, SEASON, WEEK);
  assert.deepEqual(redecided.selectedBedIds, ['bed-3']);
  assert.equal(redecided.decidedAt, '2026-06-15T08:01:00.000Z');
  assert.equal((await listIrrigationArbitrationsForUser(ALICE, SEASON, WEEK)).length, 1, 'une décision par priorité et semaine');
  assert.deepEqual(await listIrrigationArbitrationsForUser(BOB, SEASON, WEEK), []);
  assert.deepEqual(await listIrrigationArbitrationsForUser(ALICE, SEASON, '2026-06-22'), []);
});

test('invalider : les décisions des priorités visées sont marquées, une nouvelle décision les réactive', async () => {
  await saveIrrigationArbitrationForUser(ALICE, arbitration({ requestId: 'high-1' }));
  await saveIrrigationArbitrationForUser(ALICE, arbitration({ requestId: 'normal-1', priority: 'normal', selectedBedIds: ['bed-4'], candidateBedIds: ['bed-4', 'bed-5'], expectedRevision: 1 }));

  await invalidateIrrigationArbitrationsForUser(ALICE, SEASON, WEEK, [], 2);
  assert.equal(await readFeasibilityRevisionForUser(ALICE), 2, 'sans priorité : aucun geste');
  await assert.rejects(invalidateIrrigationArbitrationsForUser(ALICE, SEASON, WEEK, ['high'], 0), /stale_feasibility_revision/);

  mock.timers.tick(60_000);
  await invalidateIrrigationArbitrationsForUser(ALICE, SEASON, WEEK, ['high'], 2);
  const afterInvalidation = await listIrrigationArbitrationsForUser(ALICE, SEASON, WEEK);
  assert.deepEqual(
    afterInvalidation.map((entry) => [entry.priority, entry.invalidatedAt]).sort(),
    [['high', '2026-06-15T08:01:00.000Z'], ['normal', null]],
  );
  assert.equal(await readFeasibilityRevisionForUser(ALICE), 3);

  mock.timers.tick(60_000);
  await invalidateIrrigationArbitrationsForUser(ALICE, SEASON, WEEK, ['high'], 3);
  const high = (await listIrrigationArbitrationsForUser(ALICE, SEASON, WEEK)).find((entry) => entry.priority === 'high');
  assert.equal(high?.invalidatedAt, '2026-06-15T08:01:00.000Z', 'une décision déjà invalidée garde sa première date');

  await saveIrrigationArbitrationForUser(ALICE, arbitration({ requestId: 'high-2', expectedRevision: 4 }));
  const revived = (await listIrrigationArbitrationsForUser(ALICE, SEASON, WEEK)).find((entry) => entry.priority === 'high');
  assert.equal(revived?.invalidatedAt, null, 'une nouvelle décision efface l’invalidation');
  const logActions = (database.sqlite.prepare('SELECT action FROM irrigation_arbitration_log ORDER BY created_at, rowid').all() as { action: string }[]).map((row) => row.action);
  assert.deepEqual(logActions, ['selected', 'selected', 'invalidated', 'invalidated', 'selected']);
});
