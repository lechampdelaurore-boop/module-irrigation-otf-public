import assert from 'node:assert/strict';
import test, { afterEach, beforeEach, mock } from 'node:test';
import {
  ProtectedSlotInvalidError,
  ProtectedSlotNotFoundError,
  createProtectedSlotForUser,
  deleteProtectedSlotForUser,
  listProtectedSlotHistoryForUser,
  listProtectedSlotsForUser,
  updateProtectedSlotForUser,
} from '../../db/protected-slots-repository';
import { ensureWorkspaceForUser } from '../../db/workspace-repository';
import { minutesOfDay } from '../../lib/domain/planning/settings';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';

/**
 * Le registre des créneaux protégés (docs/protected-slots-contract.md,
 * section 5 et règle 7, migration 0030, précisions D-071) : création,
 * modification, suppression logique, historique des valeurs, isolation par
 * exploitation, refus des valeurs absurdes jusque dans la base, et aucune
 * ligne écrite ni créneau par défaut tant que personne n'en saisit.
 */

const ALICE = 'alice';
const BOB = 'bob';

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

const lavage = { name: 'Lavage des légumes', weekdays: ['thursday', 'tuesday'], startMinute: minutesOfDay(21), endMinute: minutesOfDay(23) };
const count = (table: string) => (database.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

test('sans créneau saisi : aucun créneau, aucune ligne, pour une exploitation neuve comme pour qui n’a pas d’espace de travail', async () => {
  assert.deepEqual(await listProtectedSlotsForUser(ALICE), []);
  await ensureWorkspaceForUser(ALICE);
  assert.deepEqual(await listProtectedSlotsForUser(ALICE), []);
  assert.deepEqual(await listProtectedSlotHistoryForUser(ALICE), []);
  assert.equal(count('irrigation_protected_slots'), 0, 'la migration n’écrit aucun créneau par défaut');
  assert.equal(count('irrigation_protected_slots_log'), 0);
});

test('créer un créneau : nom nettoyé, jours dans l’ordre de la semaine, une version au journal', async () => {
  const created = await createProtectedSlotForUser(ALICE, ALICE, { ...lavage, name: '  Lavage   des légumes ' });
  assert.equal(created.name, 'Lavage des légumes');
  assert.deepEqual(created.weekdays, ['tuesday', 'thursday']);
  assert.deepEqual(await listProtectedSlotsForUser(ALICE), [created]);
  const history = await listProtectedSlotHistoryForUser(ALICE);
  assert.equal(history.length, 1);
  assert.equal(history[0].change, 'created');
  assert.equal(history[0].actorUserId, ALICE);
  assert.deepEqual({ ...history[0], change: undefined, actorUserId: undefined, createdAt: undefined }, { ...created, change: undefined, actorUserId: undefined, createdAt: undefined });
});

test('modifier puis supprimer : la ligne reste, supprimée, et le journal garde chaque version avec ses valeurs', async () => {
  const created = await createProtectedSlotForUser(ALICE, ALICE, lavage);
  const night = await updateProtectedSlotForUser(ALICE, ALICE, created.id, { name: 'Nuit calme', weekdays: ['friday'], startMinute: minutesOfDay(22), endMinute: minutesOfDay(2) });
  assert.deepEqual(night, { id: created.id, name: 'Nuit calme', weekdays: ['friday'], startMinute: minutesOfDay(22), endMinute: minutesOfDay(2) });
  assert.deepEqual(await listProtectedSlotsForUser(ALICE), [night]);

  await deleteProtectedSlotForUser(ALICE, ALICE, created.id);
  assert.deepEqual(await listProtectedSlotsForUser(ALICE), [], 'un créneau supprimé n’est plus lu par le moteur');
  assert.equal(count('irrigation_protected_slots'), 1, 'suppression logique : la ligne reste');
  const row = database.sqlite.prepare('SELECT status FROM irrigation_protected_slots WHERE id = ?').get(created.id) as { status: string };
  assert.equal(row.status, 'deleted');

  const history = await listProtectedSlotHistoryForUser(ALICE);
  assert.deepEqual(history.map((version) => [version.change, version.name, version.weekdays, version.startMinute, version.endMinute]), [
    ['deleted', 'Nuit calme', ['friday'], minutesOfDay(22), minutesOfDay(2)],
    ['updated', 'Nuit calme', ['friday'], minutesOfDay(22), minutesOfDay(2)],
    ['created', 'Lavage des légumes', ['tuesday', 'thursday'], minutesOfDay(21), minutesOfDay(23)],
  ]);
  await assert.rejects(updateProtectedSlotForUser(ALICE, ALICE, created.id, lavage), ProtectedSlotNotFoundError, 'un créneau supprimé ne se modifie plus');
  await assert.rejects(deleteProtectedSlotForUser(ALICE, ALICE, created.id), ProtectedSlotNotFoundError);
  assert.equal((await listProtectedSlotHistoryForUser(ALICE)).length, 3, 'un geste refusé n’écrit rien au journal');
});

test('un geste refusé dans la même milliseconde que le geste d’avant n’écrit rien au journal (S15)', async () => {
  // L'horloge arrêtée : tous les gestes portent le même instant, comme deux
  // gestes rapprochés sur une machine rapide. La CI de main a rougi ainsi le
  // 8 novembre 2026 : la seconde suppression, refusée, ajoutait une version.
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-29T08:00:00.000Z') });
  try {
    const created = await createProtectedSlotForUser(ALICE, ALICE, lavage);
    await ensureWorkspaceForUser(BOB);
    await assert.rejects(deleteProtectedSlotForUser(BOB, BOB, created.id), ProtectedSlotNotFoundError);
    await assert.rejects(updateProtectedSlotForUser(BOB, BOB, created.id, lavage), ProtectedSlotNotFoundError);
    await deleteProtectedSlotForUser(ALICE, ALICE, created.id);
    await assert.rejects(deleteProtectedSlotForUser(ALICE, ALICE, created.id), ProtectedSlotNotFoundError);
    await assert.rejects(updateProtectedSlotForUser(ALICE, ALICE, created.id, lavage), ProtectedSlotNotFoundError);
    assert.deepEqual((await listProtectedSlotHistoryForUser(ALICE)).map((version) => [version.change, version.name]), [
      ['deleted', 'Lavage des légumes'],
      ['created', 'Lavage des légumes'],
    ]);
    assert.equal(count('irrigation_protected_slots_log'), 2, 'ni Bob ni la seconde suppression n’écrivent au journal');
  } finally {
    mock.timers.reset();
  }
});

test('isolation par exploitation : Bob ne lit, ne modifie ni ne supprime le créneau d’Alice', async () => {
  const alice = await createProtectedSlotForUser(ALICE, ALICE, lavage);
  await ensureWorkspaceForUser(BOB);
  assert.deepEqual(await listProtectedSlotsForUser(BOB), []);
  assert.deepEqual(await listProtectedSlotHistoryForUser(BOB), []);
  await assert.rejects(updateProtectedSlotForUser(BOB, BOB, alice.id, { ...lavage, name: 'Pris' }), ProtectedSlotNotFoundError);
  await assert.rejects(deleteProtectedSlotForUser(BOB, BOB, alice.id), ProtectedSlotNotFoundError);
  assert.deepEqual(await listProtectedSlotsForUser(ALICE), [alice], 'le créneau d’Alice est intact');
  assert.equal((await listProtectedSlotHistoryForUser(ALICE)).length, 1);
  const bob = await createProtectedSlotForUser(BOB, BOB, { ...lavage, name: 'Passage' });
  assert.deepEqual(await listProtectedSlotsForUser(BOB), [bob]);
  assert.deepEqual(await listProtectedSlotsForUser(ALICE), [alice]);
});

test('plusieurs créneaux, même de même nom, se lisent dans l’ordre de la journée', async () => {
  const evening = await createProtectedSlotForUser(ALICE, ALICE, lavage);
  const morning = await createProtectedSlotForUser(ALICE, ALICE, { ...lavage, startMinute: minutesOfDay(6), endMinute: minutesOfDay(7) });
  assert.deepEqual((await listProtectedSlotsForUser(ALICE)).map((slot) => slot.id), [morning.id, evening.id]);
});

test('une valeur absurde est refusée avec ses messages, sans rien écrire', async () => {
  await assert.rejects(createProtectedSlotForUser(ALICE, ALICE, { name: ' ', weekdays: [], startMinute: 600, endMinute: 600 }), (error: unknown) => {
    assert.ok(error instanceof ProtectedSlotInvalidError);
    assert.deepEqual(error.errors, [
      'Donnez un nom au créneau protégé.',
      'Choisissez au moins un jour de la semaine.',
      'Le début et la fin doivent être différents ; pour une journée entière, déclarez 00 h 00 – 23 h 59.',
    ]);
    return true;
  });
  const created = await createProtectedSlotForUser(ALICE, ALICE, lavage);
  await assert.rejects(updateProtectedSlotForUser(ALICE, ALICE, created.id, { ...lavage, endMinute: 1440 }), ProtectedSlotInvalidError);
  assert.deepEqual(await listProtectedSlotsForUser(ALICE), [created]);
  assert.equal((await listProtectedSlotHistoryForUser(ALICE)).length, 1);
});

test('la base refuse elle-même un créneau impossible écrit sans passer par le registre', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  const insert = (values: { name: string; monday: number; tuesday: number; start: number; end: number; status?: string }) => database.sqlite.prepare(`INSERT INTO irrigation_protected_slots
    (id, workspace_id, name, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_minute, end_minute, status, actor_user_id)
    VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0, 0, ?, ?, ?, ?)`).run(crypto.randomUUID(), workspaceId, values.name, values.monday, values.tuesday, values.start, values.end, values.status ?? 'active', ALICE);
  assert.throws(() => insert({ name: '', monday: 1, tuesday: 0, start: 60, end: 120 }), /CHECK/);
  assert.throws(() => insert({ name: 'x'.repeat(81), monday: 1, tuesday: 0, start: 60, end: 120 }), /CHECK/);
  assert.throws(() => insert({ name: 'Aucun jour', monday: 0, tuesday: 0, start: 60, end: 120 }), /CHECK/);
  assert.throws(() => insert({ name: 'Deux', monday: 2, tuesday: 0, start: 60, end: 120 }), /CHECK/);
  assert.throws(() => insert({ name: 'Vide', monday: 1, tuesday: 0, start: 60, end: 60 }), /CHECK/);
  assert.throws(() => insert({ name: 'Hors journée', monday: 1, tuesday: 0, start: 60, end: 1440 }), /CHECK/);
  assert.throws(() => insert({ name: 'Statut', monday: 1, tuesday: 0, start: 60, end: 120, status: 'archived' }), /CHECK/);
  insert({ name: 'Passe minuit', monday: 0, tuesday: 1, start: minutesOfDay(22), end: minutesOfDay(2) });
  assert.deepEqual((await listProtectedSlotsForUser(ALICE)).map((slot) => [slot.name, slot.weekdays]), [['Passe minuit', ['tuesday']]]);
});
