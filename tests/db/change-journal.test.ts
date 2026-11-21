import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { db } from '../../db/binding';
import { countChangeJournalForUser, listChangeJournalForUser } from '../../db/change-journal/read';
import { journalCreation, journalDeletion, journalUpdate, type JournalField, type JournalLine } from '../../db/change-journal/statements';
import { ensureWorkspaceForUser } from '../../db/workspace-repository';
import { CHANGE_JOURNAL_PAGE_SIZE } from '../../lib/domain/change-journal/entry';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { crossSpaceReferences } from '../support/space-coherence';
import { ALICE, BOB } from '../support/spaces';

/**
 * La règle du journal des modifications (amélioration n° 7,
 * docs/ameliorations-6-2-3-7-contract.md, §5.2 et §5.3 ; D-285, F706 à
 * F709, F715) : une ligne par changement, écrite dans le même lot que lui et à
 * ses conditions ; les champs qui changent seulement ; rien pour un
 * changement refusé ni pour un geste qui ne change rien ; jamais réécrite ni
 * effacée, sauf avec la ferme ; chaque ferme ne lit que son journal.
 *
 * Les écrivains du module y sont branchés par les PR suivantes ; ici, la
 * règle est éprouvée sur la table des créneaux protégés, par des lots écrits
 * comme un écrivain les écrit.
 */

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

const AT = '2026-11-21T10:00:00.000Z';
const LATER = '2026-11-21T10:05:00.000Z';
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const journalRows = () => database.sqlite.prepare('SELECT * FROM irrigation_change_journal ORDER BY rowid').all() as Record<string, unknown>[];

type Slot = { name: string; start: number; end: number };

function insertSlot(workspaceId: string, id: string, slot: Slot, at = AT) {
  return db.prepare(`INSERT INTO irrigation_protected_slots
    (id, workspace_id, name, ${DAYS.join(', ')}, start_minute, end_minute, status, actor_user_id, created_at, updated_at)
    VALUES (?, ?, ?, 1, 0, 0, 0, 0, 0, 0, ?, ?, 'active', 'x', ?, ?)`).bind(id, workspaceId, slot.name, slot.start, slot.end, at, at);
}

function updateSlot(workspaceId: string, id: string, slot: Slot) {
  return db.prepare(`UPDATE irrigation_protected_slots SET name = ?, start_minute = ?, end_minute = ?, updated_at = ?
    WHERE id = ? AND workspace_id = ? AND status = 'active'`).bind(slot.name, slot.start, slot.end, LATER, id, workspaceId);
}

const line = (workspaceId: string, objectId: string, actor = ALICE, at = AT): JournalLine => ({
  workspaceId, actorUserId: actor, at, subject: 'creneau-protege', objectId, context: { name: { sql: 'current.name' } },
});
const target = (workspaceId: string, id: string) => ({ table: 'irrigation_protected_slots', where: "current.id = ? AND current.workspace_id = ? AND current.status = 'active'", params: [id, workspaceId] });
const columns = (): JournalField[] => [
  { key: 'name', current: 'current.name' },
  { key: 'startMinute', current: 'current.start_minute' },
  { key: 'endMinute', current: 'current.end_minute' },
];
const changes = (slot: Slot): JournalField[] => [
  { key: 'name', current: 'current.name', next: slot.name },
  { key: 'startMinute', current: 'current.start_minute', next: slot.start },
  { key: 'endMinute', current: 'current.end_minute', next: slot.end },
];

const lavage: Slot = { name: 'Lavage', start: 1260, end: 1380 };

async function created(workspaceId: string, id = 'slot-1', slot = lavage) {
  await db.batch([insertSlot(workspaceId, id, slot), journalCreation(line(workspaceId, id), target(workspaceId, id), columns())]);
}

test('une création : une ligne « créé », sans avant, chaque champ dans l’après, la famille lue du sujet', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  await created(workspaceId);
  const [entry] = await listChangeJournalForUser(ALICE);
  assert.equal(entry.action, 'cree');
  assert.equal(entry.family, 'reglage');
  assert.equal(entry.subject, 'creneau-protege');
  assert.equal(entry.objectId, 'slot-1');
  assert.deepEqual(entry.context, { name: 'Lavage' });
  assert.equal(entry.before, null);
  assert.deepEqual(entry.after, { name: 'Lavage', startMinute: 1260, endMinute: 1380 });
  assert.equal(entry.actorUserId, ALICE);
  assert.equal(entry.createdAt, AT);
});

test('une modification : seuls les champs qui changent, avant et après ; le repère dit le nom d’avant', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  await created(workspaceId);
  const night = { ...lavage, name: 'Nuit calme', end: 1400 };
  await db.batch([journalUpdate(line(workspaceId, 'slot-1', ALICE, LATER), target(workspaceId, 'slot-1'), changes(night)), updateSlot(workspaceId, 'slot-1', night)]);
  const [entry] = await listChangeJournalForUser(ALICE);
  assert.equal(entry.action, 'modifie');
  assert.deepEqual(entry.before, { name: 'Lavage', endMinute: 1380 });
  assert.deepEqual(entry.after, { name: 'Nuit calme', endMinute: 1400 });
  assert.deepEqual(entry.context, { name: 'Lavage' });
  assert.equal(entry.createdAt, LATER);
});

test('un geste qui ne change rien n’écrit aucune ligne', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  await created(workspaceId);
  await db.batch([journalUpdate(line(workspaceId, 'slot-1'), target(workspaceId, 'slot-1'), changes(lavage)), updateSlot(workspaceId, 'slot-1', lavage)]);
  assert.equal(journalRows().length, 1, 'la seule création');
});

test('un changement refusé n’écrit rien : l’objet d’une autre ferme, introuvable ou déjà supprimé', async () => {
  const alice = await ensureWorkspaceForUser(ALICE);
  const bob = await ensureWorkspaceForUser(BOB);
  await created(alice);
  const night = { ...lavage, name: 'Nuit calme' };
  // BOB vise le créneau d'ALICE : la condition du geste porte son espace, la ligne du journal aussi.
  const refused = await db.batch([journalUpdate(line(bob, 'slot-1', BOB), target(bob, 'slot-1'), changes(night)), updateSlot(bob, 'slot-1', night)]);
  assert.equal(refused[1].meta.changes, 0);
  await db.batch([journalUpdate(line(alice, 'absent'), target(alice, 'absent'), changes(night)), updateSlot(alice, 'absent', night)]);
  database.sqlite.prepare("UPDATE irrigation_protected_slots SET status = 'deleted' WHERE id = 'slot-1'").run();
  await db.batch([journalDeletion(line(alice, 'slot-1'), target(alice, 'slot-1'), columns())]);
  assert.equal(journalRows().length, 1, 'la seule création');
  assert.equal(await countChangeJournalForUser(BOB), 0);
});

test('une suppression : l’avant de chaque champ, sans après', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  await created(workspaceId);
  await db.batch([
    journalDeletion(line(workspaceId, 'slot-1', ALICE, LATER), target(workspaceId, 'slot-1'), columns()),
    db.prepare("UPDATE irrigation_protected_slots SET status = 'deleted' WHERE id = ? AND workspace_id = ? AND status = 'active'").bind('slot-1', workspaceId),
  ]);
  const [entry] = await listChangeJournalForUser(ALICE);
  assert.equal(entry.action, 'supprime');
  assert.deepEqual(entry.before, { name: 'Lavage', startMinute: 1260, endMinute: 1380 });
  assert.equal(entry.after, null);
});

test('jamais l’un sans l’autre : un lot qui échoue ne garde ni le changement ni sa ligne', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  await created(workspaceId);
  const wrong = { ...lavage, name: 'Tard', end: -5 };
  // La base refuse une fin négative : tout le lot est rendu, la ligne du journal comprise.
  await assert.rejects(db.batch([journalUpdate(line(workspaceId, 'slot-1'), target(workspaceId, 'slot-1'), changes(wrong)), updateSlot(workspaceId, 'slot-1', wrong)]));
  assert.equal(journalRows().length, 1, 'la seule création');
  assert.equal((database.sqlite.prepare("SELECT name FROM irrigation_protected_slots WHERE id = 'slot-1'").get() as { name: string }).name, 'Lavage');
  // Une création refusée par la base n'écrit pas non plus sa ligne.
  await assert.rejects(created(workspaceId, 'slot-2', { ...lavage, start: -1 }));
  assert.equal(journalRows().length, 1);
});

test('une ligne absente que le geste crée : « créé » la première fois, puis « modifié » sur les seuls champs changés', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  const save = (enabled: number, time: string, at: string) => db.batch([
    journalUpdate({ workspaceId, actorUserId: ALICE, at, subject: 'rappel-du-soir', objectId: null }, {
      table: 'irrigation_phone_notice_settings', where: 'current.workspace_id = ?', params: [workspaceId],
    }, [
      { key: 'eveningReminder', current: 'current.evening_reminder', next: enabled },
      { key: 'eveningTime', current: 'current.evening_time', next: time },
    ], 'create'),
    db.prepare(`INSERT INTO irrigation_phone_notice_settings (workspace_id, evening_reminder, evening_time, actor_user_id, updated_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (workspace_id) DO UPDATE SET evening_reminder = excluded.evening_reminder, evening_time = excluded.evening_time, updated_at = excluded.updated_at`)
      .bind(workspaceId, enabled, time, ALICE, at),
  ]);
  await save(1, '19:00', AT);
  await save(1, '20:30', LATER);
  await save(1, '20:30', LATER);
  const [second, first] = await listChangeJournalForUser(ALICE);
  assert.equal(first.action, 'cree');
  assert.deepEqual(first.after, { eveningReminder: 1, eveningTime: '19:00' });
  assert.equal(second.action, 'modifie');
  assert.deepEqual(second.before, { eveningTime: '19:00' });
  assert.deepEqual(second.after, { eveningTime: '20:30' });
  assert.equal(journalRows().length, 2, 'le troisième geste ne change rien');
});

test('une ligne absente qui vaut les défauts : « modifié », du défaut à la nouvelle valeur', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  const save = (enabled: number) => db.batch([
    journalUpdate({ workspaceId, actorUserId: ALICE, at: AT, subject: 'message-du-matin', objectId: null }, {
      table: 'irrigation_phone_notice_settings', where: 'current.workspace_id = ?', params: [workspaceId],
    }, [{ key: 'morningMessage', current: 'COALESCE(current.morning_message, 1)', next: enabled }], 'defaults'),
    db.prepare(`INSERT INTO irrigation_phone_notice_settings (workspace_id, morning_message, actor_user_id, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT (workspace_id) DO UPDATE SET morning_message = excluded.morning_message`).bind(workspaceId, enabled, ALICE, AT),
  ]);
  await save(1);
  assert.equal(journalRows().length, 0, 'garder le défaut ne change rien');
  await save(0);
  const [entry] = await listChangeJournalForUser(ALICE);
  assert.equal(entry.action, 'modifie');
  assert.deepEqual(entry.before, { morningMessage: 1 });
  assert.deepEqual(entry.after, { morningMessage: 0 });
});

test('une ligne du journal ne se modifie jamais ni ne s’efface, sauf pendant l’effacement de sa ferme', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  await created(workspaceId);
  assert.throws(() => database.sqlite.prepare("UPDATE irrigation_change_journal SET after_values = '{}'").run(), /CHANGE_JOURNAL_IMMUTABLE/);
  assert.throws(() => database.sqlite.prepare('DELETE FROM irrigation_change_journal').run(), /CHANGE_JOURNAL_IMMUTABLE/);
  database.sqlite.prepare(`INSERT INTO irrigation_farm_erasures (id, workspace_id, state, requested_at, erase_after, started_at)
    VALUES ('e1', ?, 'erasing', ?, ?, ?)`).run(workspaceId, AT, AT, AT);
  database.sqlite.prepare('DELETE FROM irrigation_change_journal WHERE workspace_id = ?').run(workspaceId);
  assert.equal(journalRows().length, 0);
});

test('la base refuse une ligne mal formée : famille, action, avant ou après qui ne vont pas avec l’action', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  const insert = (family: string, action: string, before: string | null, after: string | null) => () => database.sqlite.prepare(`INSERT INTO irrigation_change_journal
    (id, workspace_id, family, subject, action, before_values, after_values, actor_user_id, created_at) VALUES (?, ?, ?, 'materiel', ?, ?, ?, 'x', ?)`)
    .run(crypto.randomUUID(), workspaceId, family, action, before, after, AT);
  assert.throws(insert('autre', 'cree', null, '{}'), /CHECK/);
  assert.throws(insert('materiel', 'renomme', '{}', '{}'), /CHECK/);
  assert.throws(insert('materiel', 'cree', '{}', '{}'), /CHECK/, 'une création n’a pas d’avant');
  assert.throws(insert('materiel', 'supprime', '{}', '{}'), /CHECK/, 'une suppression n’a pas d’après');
  assert.throws(insert('materiel', 'modifie', null, '{}'), /CHECK/, 'une modification a son avant');
  assert.throws(insert('materiel', 'modifie', '{', '{}'), /CHECK/, 'du JSON valide');
  assert.doesNotThrow(insert('materiel', 'modifie', '{"a":1}', '{"a":2}'));
});

test('isolation : chaque ferme ne lit, ne compte que son journal ; une ligne qui désignerait l’objet d’une autre ferme est relevée', async () => {
  const alice = await ensureWorkspaceForUser(ALICE);
  const bob = await ensureWorkspaceForUser(BOB);
  await created(alice, 'slot-a');
  await created(bob, 'slot-b', { ...lavage, name: 'Traite' });
  assert.deepEqual((await listChangeJournalForUser(ALICE)).map((entry) => entry.objectId), ['slot-a']);
  assert.deepEqual((await listChangeJournalForUser(BOB)).map((entry) => entry.context.name), ['Traite']);
  assert.equal(await countChangeJournalForUser(ALICE), 1);
  assert.deepEqual(await listChangeJournalForUser('personne'), []);
  assert.equal(await countChangeJournalForUser('personne'), 0);
  assert.deepEqual(crossSpaceReferences(database.sqlite), []);
  // Une ligne d'ALICE qui désignerait le créneau de BOB : le contrôle de cohérence des espaces la relève.
  database.sqlite.prepare(`INSERT INTO irrigation_change_journal (id, workspace_id, family, subject, object_id, action, before_values, after_values, actor_user_id, created_at)
    VALUES ('mauvaise', ?, 'reglage', 'creneau-protege', 'slot-b', 'modifie', '{}', '{}', 'x', ?)`).run(alice, AT);
  assert.equal(crossSpaceReferences(database.sqlite).length, 1);
  // Sans effacement en cours, la ligne fabriquée ne peut pas être retirée : le test la laisse, et le contrôle de fin la verrait.
  database.sqlite.prepare(`INSERT INTO irrigation_farm_erasures (id, workspace_id, state, requested_at, erase_after, started_at)
    VALUES ('e1', ?, 'erasing', ?, ?, ?)`).run(alice, AT, AT, AT);
  database.sqlite.prepare("DELETE FROM irrigation_change_journal WHERE id = 'mauvaise'").run();
});

test('lecture : de la plus récente à la plus ancienne, par famille, et « Voir plus » reprend sans doublon ni oubli', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  const total = CHANGE_JOURNAL_PAGE_SIZE + 5;
  for (let index = 0; index < total; index += 1) {
    // Toutes au même instant : l'ordre d'écriture départage.
    await db.batch([insertSlot(workspaceId, `slot-${index}`, { ...lavage, name: `Créneau ${index}` }),
      journalCreation(line(workspaceId, `slot-${index}`), target(workspaceId, `slot-${index}`), columns())]);
  }
  const first = await listChangeJournalForUser(ALICE);
  assert.equal(first.length, CHANGE_JOURNAL_PAGE_SIZE);
  assert.equal(first[0].context.name, `Créneau ${total - 1}`);
  const last = first.at(-1)!;
  const second = await listChangeJournalForUser(ALICE, { after: { createdAt: last.createdAt, sequence: last.sequence } });
  assert.equal(second.length, 5);
  assert.equal(new Set([...first, ...second].map((entry) => entry.id)).size, total);
  assert.equal(second.at(-1)!.context.name, 'Créneau 0');
  assert.equal((await listChangeJournalForUser(ALICE, { family: 'materiel' })).length, 0);
  assert.equal((await listChangeJournalForUser(ALICE, { family: 'reglage', limit: 3 })).length, 3);
});

test('les noms de champ et de table viennent du code : un nom inattendu est refusé avant toute écriture', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  assert.throws(() => journalCreation(line(workspaceId, 'x'), target(workspaceId, 'x'), [{ key: "name') --", current: 'current.name' }]), /Champ du journal invalide/);
  assert.throws(() => journalCreation(line(workspaceId, 'x'), { ...target(workspaceId, 'x'), table: 'x; DROP TABLE y' }, columns()), /Table du journal invalide/);
  assert.throws(() => journalUpdate(line(workspaceId, 'x'), target(workspaceId, 'x'), []), /au moins un champ/);
  assert.throws(() => journalDeletion(line(workspaceId, 'x'), target(workspaceId, 'x'), [...columns(), { key: 'name', current: 'current.name' }]), /en double/);
});
