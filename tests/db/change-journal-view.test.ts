import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { createEquipmentForUser } from '../../db/equipment/equipment';
import { saveMorningMessageForUser } from '../../db/phone-notice-repository';
import { CHANGE_AUTHOR_SELF } from '../../lib/domain/change-journal/card';
import { getChangeJournalPageForUser, getChangeJournalViewForUser } from '../../lib/services/change-journal-view';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { ALICE, BOB } from '../support/spaces';

/**
 * La lecture du journal des modifications pour « Réglages » (amélioration
 * n° 7, §5.5 et §5.6 ; D-288, F723) : 50 cartes d'abord, de la plus récente,
 * « Voir plus » reprend où la page s'arrête, le filtre par famille, le début
 * du journal ; une ferme ne lit jamais le journal d'une autre.
 */

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

const instant = (minute: number) => new Date(Date.UTC(2026, 10, 21, 8, minute)).toISOString();

/** 53 changements du message du matin (activé au départ), une minute d’écart, puis un matériel. */
async function fiftyFourChanges(): Promise<void> {
  for (let minute = 0; minute < 53; minute += 1) await saveMorningMessageForUser(ALICE, ALICE, minute % 2 === 1, instant(minute));
  await createEquipmentForUser(ALICE, { name: 'Rampe 1', kind: 'drip', mobility: 'fixed' });
}

test('50 cartes d’abord, la plus récente en tête ; « Voir plus » donne la suite, puis plus rien', async () => {
  await fiftyFourChanges();
  const view = await getChangeJournalViewForUser(ALICE, null);
  assert.equal(view.total, 54);
  assert.equal(view.cards.length, 50);
  assert.equal(view.cards[0].subject, 'Matériel');
  assert.equal(view.latestAt, view.cards[0].at);
  assert.ok(view.cards.every((card) => card.who === CHANGE_AUTHOR_SELF));
  assert.ok(view.next !== null);
  const more = await getChangeJournalPageForUser({ ownerUserId: ALICE, snapshot: null, after: view.next });
  assert.equal(more.cards.length, 4);
  assert.equal(more.next, null);
  assert.deepEqual(more.cards.map((card) => card.when), ['21/11/2026 à 9 h 03', '21/11/2026 à 9 h 02', '21/11/2026 à 9 h 01', '21/11/2026 à 9 h']);
  const seen = new Set([...view.cards, ...more.cards].map((card) => card.id));
  assert.equal(seen.size, 54, 'aucune carte deux fois, aucune oubliée');
});

test('le filtre par famille : une seule famille, sa suite à elle ; une famille sans ligne', async () => {
  await fiftyFourChanges();
  const equipment = await getChangeJournalPageForUser({ ownerUserId: ALICE, snapshot: null, family: 'materiel' });
  assert.deepEqual(equipment.cards.map((card) => [card.family, card.subject, card.action]), [['materiel', 'Matériel', 'Création']]);
  assert.equal(equipment.next, null);
  const settings = await getChangeJournalPageForUser({ ownerUserId: ALICE, snapshot: null, family: 'reglage' });
  assert.equal(settings.cards.length, 50);
  assert.ok(settings.cards.every((card) => card.family === 'reglage'));
  const rest = await getChangeJournalPageForUser({ ownerUserId: ALICE, snapshot: null, family: 'reglage', after: settings.next });
  assert.equal(rest.cards.length, 3);
  assert.deepEqual((await getChangeJournalPageForUser({ ownerUserId: ALICE, snapshot: null, family: 'objectif' })).cards, []);
});

test('une ferme ne lit jamais le journal d’une autre ; qui n’a pas d’espace n’a pas de journal', async () => {
  await fiftyFourChanges();
  const other = await getChangeJournalViewForUser(BOB, null);
  assert.deepEqual([other.total, other.cards.length, other.next, other.latestAt], [0, 0, null, null]);
  const nobody = await getChangeJournalViewForUser('personne-sans-espace', null);
  assert.deepEqual([nobody.total, nobody.cards, nobody.startedAt], [0, [], null]);
});

test('le début du journal : la mise en service lue dans les migrations reçues, ou la création de l’espace si elle est plus tardive', async () => {
  await saveMorningMessageForUser(ALICE, ALICE, false, instant(0));
  const created = (database.sqlite.prepare('SELECT created_at FROM irrigation_workspaces').get() as { created_at: string }).created_at;
  // Sans la liste des migrations (les essais en local), la création de l'espace.
  assert.equal((await getChangeJournalViewForUser(ALICE, null)).startedAt, created);
  database.sqlite.exec(`CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL);
    INSERT INTO d1_migrations (name, applied_at) VALUES ('0043_phone_notices.sql', '2026-11-20 08:00:00'), ('0044_change_journal.sql', '2999-01-02 03:04:05');`);
  assert.equal((await getChangeJournalViewForUser(ALICE, null)).startedAt, '2999-01-02T03:04:05.000Z');
  database.sqlite.exec(`UPDATE d1_migrations SET applied_at = '2000-01-01 00:00:00' WHERE name = '0044_change_journal.sql'`);
  assert.equal((await getChangeJournalViewForUser(ALICE, null)).startedAt, created);
  database.sqlite.exec('DROP TABLE d1_migrations');
});

test('la ligne du pli dit toutes les familles, quels que soient le filtre et la suite (F746)', async () => {
  await fiftyFourChanges();
  const all = await getChangeJournalViewForUser(ALICE, null);
  // Le matériel, créé en dernier, est la ligne la plus récente : la ligne du pli la garde sous le filtre « Réglages ».
  const settings = await getChangeJournalViewForUser(ALICE, null, { family: 'reglage' });
  assert.equal(settings.family, 'reglage');
  assert.ok(settings.cards.every((card) => card.family === 'reglage'));
  assert.deepEqual([settings.total, settings.latestAt, settings.startedAt], [54, all.latestAt, all.startedAt]);
  assert.notEqual(settings.cards[0].at, all.latestAt, 'la première carte du filtre n’est pas la dernière ligne');
  // « Voir plus » : la suite, et la même ligne du pli.
  const more = await getChangeJournalViewForUser(ALICE, null, { after: all.next });
  assert.equal(more.cards.length, 4);
  assert.deepEqual([more.total, more.latestAt, more.next], [54, all.latestAt, null]);
  // Une famille sans ligne : aucune carte, mais la ligne du pli dit toujours tout.
  const goals = await getChangeJournalViewForUser(ALICE, null, { family: 'objectif' });
  assert.deepEqual([goals.cards.length, goals.total, goals.latestAt], [0, 54, all.latestAt]);
  // Une autre ferme ne voit rien de celle-ci, filtre ou non.
  const other = await getChangeJournalViewForUser(BOB, null, { family: 'reglage' });
  assert.deepEqual([other.total, other.cards.length, other.latestAt], [0, 0, null]);
});

test('relue après un changement, la section dit la ligne nouvelle, en tête et dans la ligne du pli (F746)', async () => {
  await saveMorningMessageForUser(ALICE, ALICE, false, instant(0));
  const before = await getChangeJournalViewForUser(ALICE, null, { family: 'reglage' });
  assert.equal(before.total, 1);
  await saveMorningMessageForUser(ALICE, ALICE, true, instant(5));
  const after = await getChangeJournalViewForUser(ALICE, null, { family: 'reglage' });
  assert.equal(after.total, 2);
  assert.equal(after.latestAt, instant(5));
  assert.equal(after.cards[0].at, instant(5));
  assert.deepEqual(after.cards[0].lines.map((line) => line.text), ['non → oui']);
});
