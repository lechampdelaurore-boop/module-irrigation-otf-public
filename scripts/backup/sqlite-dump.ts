/**
 * Une base SQLite écrite en SQL (4.5, PR 4 ; docs/tranche-4-contract.md,
 * 10 bis.15), de deux façons.
 *
 * - **L'export de D1** (`dumpStatements`), tel que l'écrit `wrangler d1
 *   export` (même code que celui de D1, lu dans Miniflare) : chaque table
 *   dans l'ordre de sa création, suivie de ses lignes ; les compteurs ; puis
 *   les index, les déclencheurs et les vues. Une table refaite par une
 *   migration plus récente vient donc après les tables qui la désignent.
 * - **L'import** (`restorableStatements`) : les mêmes données, rangées pour
 *   entrer dans une base vide où les clés étrangères sont actives, comme
 *   dans D1. Toutes les tables d'abord ; les lignes ensuite, chaque table
 *   après celles qu'elle désigne ; les compteurs ; les index, déclencheurs et
 *   vues en dernier, pour que rejouer les lignes ne déclenche rien.
 *
 * Elles servent à remplir la base d'essai de données fictives, à imiter
 * l'export de D1 dans la fausse base des essais, à réinsérer les lignes
 * d'une seule ferme, et à rendre importable un export reçu.
 */
import type { DatabaseSync } from 'node:sqlite';

export function quoteSqlIdentifier(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

/**
 * Une valeur écrite comme D1 l'écrit : chaîne entre apostrophes (doublées
 * dedans), retours à la ligne rendus par `char(10)` et `char(13)` pour que
 * chaque ligne de données tienne sur une ligne, nombre infini en `9e999`,
 * octets en hexadécimal.
 */
export function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return String(value);
    return value > 0 ? '9e999' : '-9e999';
  }
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'string') return d1String(value);
  if (value instanceof Uint8Array) return `X'${Buffer.from(value).toString('hex')}'`;
  throw new Error(`Type de valeur non pris en charge : ${typeof value}`);
}

function d1String(value: string): string {
  let lineFeeds = false;
  let carriageReturns = false;
  const escaped = value.replace(/'|(\n)|(\r)/g, (_quote: string, lineFeed: string | undefined, carriageReturn: string | undefined) => {
    if (lineFeed) {
      lineFeeds = true;
      return '\\n';
    }
    if (carriageReturn) {
      carriageReturns = true;
      return '\\r';
    }
    return "''";
  });
  let text = `'${escaped}'`;
  if (carriageReturns) text = `replace(${text},'\\r',char(13))`;
  if (lineFeeds) text = `replace(${text},'\\n',char(10))`;
  return text;
}

/** `INSERT INTO "table" ("a","b") VALUES(…);` pour une ligne. */
export function insertStatement(table: string, row: Record<string, unknown>): string {
  const columns = Object.keys(row);
  return `INSERT INTO ${quoteSqlIdentifier(table)} (${columns.map(quoteSqlIdentifier).join(',')}) VALUES(${columns.map((column) => sqlLiteral(row[column])).join(',')});`;
}

type SchemaRow = { name: string; sql: string };

const SKIPPED_TABLE = /^(?:_cf_|sqlite_)/;

function rowsOf(database: DatabaseSync, table: string): string[] {
  const columns = (database.prepare(`PRAGMA table_info(${quoteSqlIdentifier(table)})`).all() as { name: string }[]).map(({ name }) => name);
  const select = `SELECT ${columns.map(quoteSqlIdentifier).join(', ')} FROM ${quoteSqlIdentifier(table)}`;
  return (database.prepare(select).all() as Record<string, unknown>[]).map((row) => insertStatement(table, row));
}

function createStatement({ sql }: SchemaRow): string {
  return /CREATE TABLE ['"].*/.test(sql) ? `CREATE TABLE IF NOT EXISTS ${sql.substring('CREATE TABLE '.length)};` : `${sql};`;
}

function restOfSchema(database: DatabaseSync): string[] {
  return (database.prepare("SELECT name, sql FROM sqlite_schema WHERE sql NOT NULL AND type IN ('index', 'trigger', 'view') ORDER BY type COLLATE NOCASE").all() as SchemaRow[])
    .map(({ sql }) => `${sql};`);
}

/** L'export de D1, instruction par instruction. */
export function dumpStatements(database: DatabaseSync): string[] {
  const tables = database.prepare("SELECT name, sql FROM sqlite_schema WHERE type = 'table' AND sql NOT NULL ORDER BY tbl_name = 'sqlite_sequence', rowid").all() as SchemaRow[];
  const statements = ['PRAGMA defer_foreign_keys=TRUE;'];
  for (const table of tables) {
    if (table.name === 'sqlite_sequence') statements.push('DELETE FROM sqlite_sequence;');
    else if (SKIPPED_TABLE.test(table.name)) continue;
    else statements.push(createStatement(table));
    statements.push(...rowsOf(database, table.name));
  }
  statements.push(...restOfSchema(database));
  return statements;
}

export function dumpDatabase(database: DatabaseSync): string {
  return dumpStatements(database).join('\n');
}

/** Les tables rangées pour l'import : chacune après celles qu'elle désigne (clés étrangères déclarées). */
export function tablesParentsFirst(database: DatabaseSync, tables: readonly string[]): string[] {
  const wanted = new Set(tables);
  const parents = new Map(tables.map((table) => [table, (database.prepare(`PRAGMA foreign_key_list(${quoteSqlIdentifier(table)})`).all() as { table: string }[])
    .map((key) => key.table)
    .filter((parent) => wanted.has(parent) && parent !== table)]));
  const ordered: string[] = [];
  const placed = new Set<string>();
  const visit = (table: string, path: Set<string>) => {
    if (placed.has(table) || path.has(table)) return;
    path.add(table);
    for (const parent of parents.get(table) ?? []) visit(parent, path);
    path.delete(table);
    placed.add(table);
    ordered.push(table);
  };
  for (const table of [...tables].sort()) visit(table, new Set());
  return ordered;
}

/** Les mêmes données, rangées pour entrer dans une base vide aux clés étrangères actives. */
function restorableStatements(database: DatabaseSync): string[] {
  const tables = (database.prepare("SELECT name, sql FROM sqlite_schema WHERE type = 'table' AND sql NOT NULL ORDER BY rowid").all() as SchemaRow[])
    .filter((table) => !SKIPPED_TABLE.test(table.name));
  const statements = ['PRAGMA defer_foreign_keys=TRUE;', ...tables.map(createStatement)];
  for (const table of tablesParentsFirst(database, tables.map(({ name }) => name))) statements.push(...rowsOf(database, table));
  const hasCounters = database.prepare("SELECT 1 AS present FROM sqlite_schema WHERE name = 'sqlite_sequence'").get() !== undefined;
  if (hasCounters) statements.push('DELETE FROM sqlite_sequence;', ...rowsOf(database, 'sqlite_sequence'));
  statements.push(...restOfSchema(database));
  return statements;
}

export function restorableDump(database: DatabaseSync): string {
  return restorableStatements(database).join('\n');
}

/** La table où D1 inscrit les migrations reçues, telle que Wrangler la crée. */
const D1_MIGRATIONS_TABLE = `CREATE TABLE IF NOT EXISTS "d1_migrations"(
\t\tid         INTEGER PRIMARY KEY AUTOINCREMENT,
\t\tname       TEXT UNIQUE,
\t\tapplied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
)`;

/** Inscrit les migrations nommées comme reçues, comme le fait `wrangler d1 migrations apply`. */
export function recordD1Migrations(database: DatabaseSync, names: readonly string[], appliedAt: string): void {
  database.exec(D1_MIGRATIONS_TABLE);
  const insert = database.prepare('INSERT INTO d1_migrations (name, applied_at) VALUES (?, ?)');
  for (const name of names) insert.run(name, appliedAt);
}
