import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import {
  D1_EXPORT_FORMAT,
  D1_EXPORT_VERSION,
  buildCountQuery,
  buildImportPlan,
  buildInsertStatements,
  buildOwnerRemapStatement,
  compareCounts,
  countsFromRow,
  isExportableTable,
  orderTablesForImport,
  quoteIdentifier,
  quoteLiteral,
  validateExport,
  type D1Export,
  type ForeignKeyEdge,
} from '../lib/services/d1-export-import.ts';

function migratedDatabase(): DatabaseSync {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = ON');
  for (const migration of readdirSync('drizzle').filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort()) {
    database.exec(readFileSync(`drizzle/${migration}`, 'utf8').replaceAll('--> statement-breakpoint', ''));
  }
  return database;
}

function schemaTables(database: DatabaseSync): string[] {
  return (database.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name").all() as { name: string }[])
    .map((row) => row.name)
    .filter(isExportableTable);
}

function foreignKeyEdges(database: DatabaseSync, tables: readonly string[]): ForeignKeyEdge[] {
  return tables.flatMap((name) =>
    (database.prepare(`PRAGMA foreign_key_list(${quoteIdentifier(name)})`).all() as { table: string }[])
      .map((row) => ({ from: name, to: row.table })),
  );
}

function exportDatabase(database: DatabaseSync, source: string): D1Export {
  const tables = schemaTables(database).map((name) => {
    const rows = database.prepare(`SELECT * FROM ${quoteIdentifier(name)}`).all() as Record<string, string | number | null>[];
    const columns = (database.prepare(`PRAGMA table_info(${quoteIdentifier(name)})`).all() as { name: string }[]).map((column) => column.name);
    return { name, columns, rows };
  });
  return { format: D1_EXPORT_FORMAT, version: D1_EXPORT_VERSION, exportedAt: '2026-09-19T00:00:00.000Z', source, tables };
}

test('les littéraux SQL sont échappés et les identifiants contrôlés', () => {
  assert.equal(quoteLiteral(null), 'NULL');
  assert.equal(quoteLiteral(12.5), '12.5');
  assert.equal(quoteLiteral(true), '1');
  assert.equal(quoteLiteral("l'eau ; DROP TABLE x"), "'l''eau ; DROP TABLE x'");
  assert.equal(quoteLiteral('émoji 💧'), "'émoji 💧'");
  assert.throws(() => quoteLiteral(Number.NaN));
  assert.throws(() => quoteLiteral({}));
  assert.equal(quoteIdentifier('irrigation_events'), '"irrigation_events"');
  assert.throws(() => quoteIdentifier('events; DROP'));
});

test('les tables techniques sont exclues', () => {
  assert.equal(isExportableTable('irrigation_events'), true);
  assert.equal(isExportableTable('sqlite_sequence'), false);
  assert.equal(isExportableTable('_cf_KV'), false);
  assert.equal(isExportableTable('d1_migrations'), false);
  assert.equal(isExportableTable('__appgarden_migrations'), false, 'table de migrations de la plateforme Sites');
});

test('l’ordre d’import place les tables référencées avant celles qui les référencent', () => {
  const order = orderTablesForImport(['c', 'a', 'b'], [{ from: 'b', to: 'a' }, { from: 'c', to: 'b' }]);
  assert.deepEqual(order, ['a', 'b', 'c']);
  assert.deepEqual(orderTablesForImport(['y', 'x'], []), ['x', 'y']);
  assert.throws(() => orderTablesForImport(['a', 'b'], [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }]), /circulaires/);
});

test('les insertions sont regroupées par lots avec les colonnes explicites', () => {
  const statements = buildInsertStatements({
    name: 't', columns: ['id', 'label', 'amount'],
    rows: [{ id: 'a', label: 'un', amount: 1 }, { id: 'b', label: null, amount: 2.5 }, { id: 'c', label: "l'x", amount: 3 }],
  }, { maxRows: 2 });
  assert.equal(statements.length, 2);
  assert.match(statements[0], /^INSERT INTO "t" \("id", "label", "amount"\) VALUES\n  \('a', 'un', 1\),\n  \('b', NULL, 2\.5\);$/);
  assert.match(statements[1], /\('c', 'l''x', 3\);$/);
  assert.deepEqual(buildInsertStatements({ name: 't', columns: ['id'], rows: [] }), []);
});

test('les lots respectent aussi un budget de taille, comme le cache OTF de 34 Ko par ligne', () => {
  const payload = 'x'.repeat(30_000);
  const rows = Array.from({ length: 11 }, (_, index) => ({ cache_key: `k${index}`, payload }));
  const statements = buildInsertStatements({ name: 'otf_snapshots', columns: ['cache_key', 'payload'], rows }, { maxBytes: 64_000 });
  assert.equal(statements.length, 6, 'deux lignes de 30 Ko par instruction, la onzième seule');
  for (const statement of statements) assert.ok(new TextEncoder().encode(statement).length < 100_000);
  assert.equal(statements.join('\n').match(/\('k\d+'/g)?.length, 11);
  assert.throws(
    () => buildInsertStatements({ name: 'trop', columns: ['p'], rows: [{ p: 'y'.repeat(120_000) }] }),
    /trop volumineuse/,
  );
});

test('la requête de comptage couvre chaque table et le remappage vise la seule colonne propriétaire', () => {
  const query = buildCountQuery(['a', 'b']);
  assert.equal(query, 'SELECT (SELECT count(*) FROM "a") AS "a",\n  (SELECT count(*) FROM "b") AS "b"');
  assert.deepEqual(countsFromRow({ a: 2, b: '0' }), { a: 2, b: 0 });
  assert.equal(
    buildOwnerRemapStatement('ancien', 'nouveau'),
    `UPDATE "irrigation_workspaces" SET "owner_user_id" = 'nouveau' WHERE "owner_user_id" = 'ancien';`,
  );
  assert.throws(() => buildOwnerRemapStatement('', 'x'));
});

test('un export inconnu ou d’une autre version est refusé', () => {
  assert.throws(() => validateExport({ format: 'autre', version: 1, tables: [] }), /format/);
  assert.throws(() => validateExport({ format: D1_EXPORT_FORMAT, version: 2, tables: [] }), /Version/);
  assert.throws(() => validateExport({ format: D1_EXPORT_FORMAT, version: 1, tables: [{ name: 'x; y', columns: [], rows: [] }] }));
});

test('un export du vrai schéma se réimporte dans une base neuve avec des comptages identiques', () => {
  const source = migratedDatabase();
  source.exec(`INSERT INTO irrigation_workspaces (id, owner_user_id) VALUES ('ws-1', 'ancien-proprietaire')`);
  source.exec(`INSERT INTO irrigation_equipment (id, workspace_id, name, kind, mobility) VALUES ('eq-1', 'ws-1', 'Rampe d''essai', 'sprinkler', 'mobile')`);
  const exported = exportDatabase(source, 'test');
  exported.tables.push({ name: '__appgarden_migrations', columns: ['id', 'name'], rows: [{ id: 1, name: '0000' }] });
  const data = validateExport(JSON.parse(JSON.stringify(exported)));
  const tables = schemaTables(source);
  assert.equal(tables.length, 79); // 47 + les trois tables des alertes météo (0022) + les treize du besoin par culture (0023) + les sept de la réserve du sol (0025) + les cinq des alertes par culture (0026) + le choix des fonctionnalités (0027) + la provenance des réglages (0029) + les deux des créneaux protégés (0030)

  const target = migratedDatabase();
  target.exec(`INSERT INTO irrigation_workspaces (id, owner_user_id) VALUES ('ws-auto', 'nouveau-proprietaire')`);
  const plan = buildImportPlan({
    data,
    edges: foreignKeyEdges(target, tables),
    schemaTables: tables,
    ownerRemap: { previousOwner: 'ancien-proprietaire', newOwner: 'nouveau-proprietaire' },
  });
  assert.equal(plan.orderedTables.indexOf('irrigation_workspaces') < plan.orderedTables.indexOf('irrigation_equipment'), true);
  assert.equal(plan.expectedCounts.irrigation_workspaces, 1);
  assert.equal(plan.expectedCounts.irrigation_equipment, 1);

  for (const statement of plan.statements) target.exec(statement);
  const counts = countsFromRow(target.prepare(buildCountQuery(plan.orderedTables)).get() as Record<string, unknown>);
  assert.deepEqual(compareCounts(plan.expectedCounts, counts), []);
  const workspace = (target.prepare('SELECT id, owner_user_id FROM irrigation_workspaces').all() as { id: string; owner_user_id: string }[])
    .map((row) => ({ id: row.id, owner_user_id: row.owner_user_id }));
  assert.deepEqual(workspace, [{ id: 'ws-1', owner_user_id: 'nouveau-proprietaire' }]);
  assert.equal((target.prepare('SELECT name FROM irrigation_equipment').get() as { name: string }).name, "Rampe d'essai");
});

test('la comparaison des comptages signale chaque écart', () => {
  assert.deepEqual(compareCounts({ a: 2, b: 0 }, { a: 2, b: 1 }), [{ table: 'b', expected: 0, actual: 1 }]);
  assert.deepEqual(compareCounts({ a: 2 }, { a: 2 }), []);
});
