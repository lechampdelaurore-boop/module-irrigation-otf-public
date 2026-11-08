import assert from 'node:assert/strict';
import test from 'node:test';
import { is } from 'drizzle-orm';
import { SQLiteTable, getTableConfig } from 'drizzle-orm/sqlite-core';
import * as schema from '../../db/schema';
import { createMigratedSqliteDatabase } from '../support/d1-sqlite';

type ColumnInfo = { name: string; notnull: number; pk: number };

/**
 * `db/schema.ts` décrit les tables dans le langage de drizzle-orm, pour ce
 * test ; les migrations de `drizzle/` sont la vérité de la base. Ce test
 * empêche les deux de diverger : mêmes tables, mêmes colonnes, mêmes
 * contraintes NOT NULL et clés primaires.
 */
test('les tables et colonnes de db/schema.ts correspondent exactement à la base migrée', () => {
  const database = createMigratedSqliteDatabase();
  const migratedTables = (database.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[])
    .map((row) => row.name);

  const declared: ReturnType<typeof getTableConfig>[] = [];
  for (const value of Object.values(schema)) {
    if (is(value, SQLiteTable)) declared.push(getTableConfig(value));
  }
  assert.deepEqual(declared.map((table) => table.name).sort(), migratedTables, 'liste des tables');

  // Tous les écarts sont collectés avant de conclure : une seule exécution suffit à les lire.
  const differences: string[] = [];
  for (const table of declared) {
    const migratedColumns = database.prepare(`PRAGMA table_info("${table.name}")`).all() as ColumnInfo[];
    // Une clé primaire composée est déclarée à part dans drizzle, colonne par colonne dans SQLite.
    const primaryColumns = new Set([
      ...table.columns.filter((column) => column.primary).map((column) => column.name),
      ...table.primaryKeys.flatMap((key) => key.columns.map((column) => column.name)),
    ]);
    const expected = table.columns
      .map((column) => ({ name: column.name, notNull: column.notNull || primaryColumns.has(column.name), primary: primaryColumns.has(column.name) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const actual = migratedColumns
      .map((column) => ({ name: column.name, notNull: column.notnull === 1 || column.pk > 0, primary: column.pk > 0 }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const describe = (columns: typeof actual) => new Map(columns.map((column) => [column.name, `notNull=${column.notNull} primary=${column.primary}`]));
    const expectedByName = describe(expected);
    const actualByName = describe(actual);
    for (const name of new Set([...expectedByName.keys(), ...actualByName.keys()])) {
      const declaredColumn = expectedByName.get(name) ?? 'absente de db/schema.ts';
      const migratedColumn = actualByName.get(name) ?? 'absente de la base migrée';
      if (declaredColumn !== migratedColumn) {
        differences.push(`${table.name}.${name} : schéma ${declaredColumn} · base ${migratedColumn}`);
      }
    }
  }
  assert.deepEqual(differences, []);
});
