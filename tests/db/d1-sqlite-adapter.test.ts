import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { createD1FromSqlite, createMigratedSqliteDatabase } from '../support/d1-sqlite';

function scratchDatabase(): D1Database {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  sqlite.exec(`CREATE TABLE parent (id TEXT PRIMARY KEY, label TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE child (id TEXT PRIMARY KEY, parent_id TEXT NOT NULL REFERENCES parent(id), amount REAL);`);
  return createD1FromSqlite(sqlite);
}

test('first rend la première ligne, une colonne, ou null sans ligne', async () => {
  const d1 = scratchDatabase();
  await d1.prepare('INSERT INTO parent (id, label) VALUES (?, ?)').bind('p1', 'un').run();
  assert.deepEqual(await d1.prepare('SELECT id, label FROM parent WHERE id = ?').bind('p1').first(), { id: 'p1', label: 'un' });
  assert.equal(await d1.prepare('SELECT label FROM parent WHERE id = ?').bind('p1').first('label'), 'un');
  assert.equal(await d1.prepare('SELECT label FROM parent WHERE id = ?').bind('absent').first(), null);
  await assert.rejects(d1.prepare('SELECT label FROM parent WHERE id = ?').bind('p1').first('inconnue'), /D1_COLUMN_NOTFOUND/);
});

test('all et run rendent la forme D1 : success, results, meta', async () => {
  const d1 = scratchDatabase();
  const inserted = await d1.prepare('INSERT INTO parent (id, label) VALUES (?, ?), (?, ?)').bind('a', 'A', 'b', 'B').run();
  assert.equal(inserted.success, true);
  assert.deepEqual(inserted.results, []);
  assert.equal(inserted.meta.changes, 2);
  assert.equal(inserted.meta.changed_db, true);
  const listed = await d1.prepare('SELECT id FROM parent ORDER BY id').all<{ id: string }>();
  assert.deepEqual(listed.results.map((row) => row.id), ['a', 'b']);
  assert.equal(listed.meta.rows_read, 2);
  const updated = await d1.prepare('UPDATE parent SET label = ? WHERE id = ?').bind('AA', 'a').run();
  assert.equal(updated.meta.changes, 1);
  const untouched = await d1.prepare('UPDATE parent SET label = ? WHERE id = ?').bind('x', 'absent').run();
  assert.equal(untouched.meta.changes, 0);
  assert.equal(untouched.meta.changed_db, false);
});

test('RETURNING et raw rendent des lignes même par run', async () => {
  const d1 = scratchDatabase();
  const returned = await d1.prepare('INSERT INTO parent (id, label) VALUES (?, ?) RETURNING id, label').bind('r', 'R').run<{ id: string }>();
  assert.deepEqual(returned.results, [{ id: 'r', label: 'R' }]);
  assert.deepEqual(await d1.prepare('SELECT id, label FROM parent').raw(), [['r', 'R']]);
  assert.deepEqual(await d1.prepare('SELECT id, label FROM parent').raw({ columnNames: true }), [['id', 'label'], ['r', 'R']]);
});

test('bind convertit les booléens et refuse undefined, comme D1', async () => {
  const d1 = scratchDatabase();
  await d1.prepare('INSERT INTO parent (id, label, active) VALUES (?, ?, ?)').bind('p', 'P', false).run();
  assert.equal(await d1.prepare('SELECT active FROM parent WHERE id = ?').bind('p').first('active'), 0);
  assert.throws(() => d1.prepare('SELECT ?').bind(undefined), /D1_TYPE_ERROR.*undefined/);
  assert.throws(() => d1.prepare('SELECT ?').bind({ objet: true }), /D1_TYPE_ERROR/);
});

test('les erreurs SQL sont préfixées D1_ERROR et les clés étrangères sont appliquées', async () => {
  const d1 = scratchDatabase();
  await assert.rejects(
    d1.prepare('INSERT INTO child (id, parent_id) VALUES (?, ?)').bind('c', 'absent').run(),
    /D1_ERROR: FOREIGN KEY constraint failed/,
  );
  await d1.prepare('INSERT INTO parent (id, label) VALUES (?, ?)').bind('p', 'P').run();
  await assert.rejects(
    d1.prepare('INSERT INTO parent (id, label) VALUES (?, ?)').bind('p', 'doublon').run(),
    /D1_ERROR: UNIQUE constraint failed/,
  );
});

test('batch est atomique : un échec annule les écritures précédentes du lot', async () => {
  const d1 = scratchDatabase();
  await assert.rejects(
    d1.batch([
      d1.prepare('INSERT INTO parent (id, label) VALUES (?, ?)').bind('ok', 'OK'),
      d1.prepare('INSERT INTO child (id, parent_id) VALUES (?, ?)').bind('c', 'absent'),
    ]),
    /FOREIGN KEY constraint failed/,
  );
  assert.equal(await d1.prepare('SELECT count(*) AS n FROM parent').first('n'), 0);
  const results = await d1.batch([
    d1.prepare('INSERT INTO parent (id, label) VALUES (?, ?)').bind('p', 'P'),
    d1.prepare('SELECT count(*) AS n FROM parent'),
  ]);
  assert.equal(results.length, 2);
  assert.equal(results[0].meta.changes, 1);
  assert.deepEqual(results[1].results, [{ n: 1 }]);
});

test('la base migrée porte les 79 tables applicatives et applique leurs contraintes', async () => {
  const d1 = createD1FromSqlite(createMigratedSqliteDatabase());
  const tables = await d1.prepare("SELECT count(*) AS n FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").first<number>('n');
  assert.equal(tables, 79);
  await assert.rejects(
    d1.prepare("INSERT INTO irrigation_events (id, workspace_id, season, status) VALUES ('e', 'ws-absent', 2026, 'planned')").run(),
    /FOREIGN KEY constraint failed/,
  );
  await d1.prepare("INSERT INTO irrigation_workspaces (id, owner_user_id) VALUES ('ws', 'owner')").run();
  await assert.rejects(
    d1.prepare("INSERT INTO irrigation_events (id, workspace_id, season, status) VALUES ('e', 'ws', 2026, 'inconnu')").run(),
    /CHECK constraint failed/,
  );
});
