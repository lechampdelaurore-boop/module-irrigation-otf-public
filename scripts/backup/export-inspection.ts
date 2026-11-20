/**
 * Ce qu'un export de la base dit de lui-même, sans montrer une donnée (4.5,
 * PR 4 ; docs/tranche-4-contract.md, F561, et 10 bis.14, F621). L'export de
 * `wrangler d1 export` est du SQL ; il est rejoué en mémoire dans une base
 * vide, comme le ferait une restauration, puis contrôlé :
 *
 * - il se rejoue jusqu'au bout, contraintes de chaque table comprises ;
 * - la base obtenue est intègre et ses clés étrangères désignent des lignes ;
 * - son schéma est celui que donnent les migrations du dépôt qu'il dit avoir
 *   reçues : une table retirée, une colonne en moins, une migration oubliée
 *   se voient ;
 * - chaque table a son nombre de lignes et une empreinte de son contenu,
 *   indépendante de l'ordre des lignes : deux bases se comparent table par
 *   table sans rien afficher de ce qu'elles contiennent.
 *
 * Les problèmes se disent avec des noms de tables, de colonnes et de
 * contraintes, jamais avec une valeur.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type TableSummary = { name: string; rows: number; digest: string };

export type ExportInspection = {
  /** Les tables de données, par nom ; la liste des migrations et les compteurs internes de SQLite à part. */
  tables: TableSummary[];
  totalRows: number;
  /** L'empreinte de toute la base : celle de chaque table, dans l'ordre des noms. */
  digest: string;
  migrations: { applied: string[]; missingFromExport: string[]; unknownToRepository: string[] };
  /** Ce qui empêcherait une restauration fidèle ; vide quand l'export est bon. */
  problems: string[];
};

const MIGRATION_FILE = /^\d{4}_.+\.sql$/;
const INTERNAL_TABLE = /^(?:sqlite_|_cf_)/;
const MIGRATIONS_TABLE = 'd1_migrations';

function quoteIdentifier(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

/** Une erreur de SQLite dite par sa contrainte, jamais par la valeur qui l'a heurtée. */
function sqliteProblem(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  const constraint = /(CHECK|UNIQUE|NOT NULL|FOREIGN KEY|PRIMARY KEY) constraint failed(?:: ([\w.]+))?/.exec(message);
  if (constraint) return `contrainte ${constraint[1]}${constraint[2] ? ` (${constraint[2]})` : ''} refusée`;
  const missing = /no such (table|column): ([\w.]+)/.exec(message);
  if (missing) return `${missing[1] === 'table' ? 'table' : 'colonne'} ${missing[2]} inconnue`;
  return 'instruction SQL illisible';
}

function migrationFiles(migrationsDir: string): string[] {
  return readdirSync(migrationsDir).filter((name) => MIGRATION_FILE.test(name)).sort();
}

/** Une base en mémoire où les migrations nommées ont été appliquées, dans l'ordre du dépôt. */
export function migratedReference(migrationsDir: string, names: readonly string[]): DatabaseSync {
  const reference = new DatabaseSync(':memory:');
  for (const name of migrationFiles(migrationsDir).filter((file) => names.includes(file))) {
    reference.exec(readFileSync(path.join(migrationsDir, name), 'utf8').replaceAll('--> statement-breakpoint', ''));
  }
  return reference;
}

type SchemaObject = { type: string; name: string; tbl_name: string };

function schemaOf(database: DatabaseSync): Map<string, Map<string, string>> {
  const objects = (database.prepare("SELECT type, name, tbl_name FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all() as SchemaObject[])
    .filter((object) => !INTERNAL_TABLE.test(object.name) && object.name !== MIGRATIONS_TABLE);
  const schema = new Map<string, Map<string, string>>();
  for (const object of objects) {
    if (object.type === 'table') {
      const columns = database.prepare(`PRAGMA table_info(${quoteIdentifier(object.name)})`).all() as { name: string; type: string; notnull: number; pk: number }[];
      schema.set(`table ${object.name}`, new Map(columns.map((column) => [column.name, `${column.type.toUpperCase()} notnull=${column.notnull} pk=${column.pk}`])));
    } else {
      schema.set(`${object.type === 'index' ? 'index' : object.type === 'trigger' ? 'déclencheur' : 'vue'} ${object.name}`, new Map([['sur', object.tbl_name]]));
    }
  }
  return schema;
}

function schemaDifferences(expected: DatabaseSync, actual: DatabaseSync): string[] {
  const wanted = schemaOf(expected);
  const found = schemaOf(actual);
  const differences: string[] = [];
  for (const [object, columns] of wanted) {
    const present = found.get(object);
    if (!present) {
      differences.push(`${object} absente de l’export`);
      continue;
    }
    for (const [column, description] of columns) {
      const other = present.get(column);
      if (other === undefined) differences.push(`${object} : colonne ${column} absente de l’export`);
      else if (other !== description) differences.push(`${object} : colonne ${column} différente (${other} au lieu de ${description})`);
    }
    for (const column of present.keys()) if (!columns.has(column)) differences.push(`${object} : colonne ${column} inconnue des migrations`);
  }
  for (const object of found.keys()) if (!wanted.has(object)) differences.push(`${object} inconnue des migrations`);
  return differences;
}

function canonicalValue(value: unknown): unknown {
  if (value instanceof Uint8Array) return { blob: Buffer.from(value).toString('hex') };
  if (typeof value === 'bigint') return { entier: value.toString() };
  return value;
}

/** Une ligne écrite d'une seule façon, colonnes rangées : la même ligne donne la même chaîne, où qu'elle soit lue. */
export function canonicalRow(columns: readonly string[], row: Record<string, unknown>): string {
  return JSON.stringify(columns.map((column) => canonicalValue(row[column])));
}

/** Le nombre de lignes et l'empreinte du contenu d'une table, indépendante de l'ordre des lignes et des colonnes. */
function tableSummary(database: DatabaseSync, name: string): TableSummary {
  const columns = (database.prepare(`PRAGMA table_info(${quoteIdentifier(name)})`).all() as { name: string }[]).map((column) => column.name).sort();
  const rows = (database.prepare(`SELECT * FROM ${quoteIdentifier(name)}`).all() as Record<string, unknown>[])
    .map((row) => canonicalRow(columns, row))
    .sort();
  const hash = createHash('sha256').update(`${name}\n${JSON.stringify(columns)}\n`);
  for (const row of rows) hash.update(`${row}\n`);
  return { name, rows: rows.length, digest: hash.digest('hex') };
}

/** Les tables de données d'une base, et l'empreinte de chacune. */
export function summarizeDatabase(database: DatabaseSync): { tables: TableSummary[]; totalRows: number; digest: string } {
  const names = (database.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name").all() as { name: string }[])
    .map(({ name }) => name)
    .filter((name) => !INTERNAL_TABLE.test(name) && name !== MIGRATIONS_TABLE);
  const tables = names.map((name) => tableSummary(database, name));
  const digest = createHash('sha256').update(tables.map((table) => `${table.name} ${table.rows} ${table.digest}`).join('\n')).digest('hex');
  return { tables, totalRows: tables.reduce((sum, table) => sum + table.rows, 0), digest };
}

/** Rejoue l'export dans une base vide, en mémoire, et dit s'il restaurerait la base fidèlement. */
export function inspectExport(sql: string, migrationsDir = 'drizzle'): ExportInspection {
  // Les clés étrangères se contrôlent après coup, table par table : rejouées
  // avec elles, la première ligne orpheline arrêterait tout sans dire où.
  const database = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false });
  const problems: string[] = [];
  try {
    database.exec(sql);
  } catch (error) {
    database.close();
    return {
      tables: [],
      totalRows: 0,
      digest: '',
      migrations: { applied: [], missingFromExport: [], unknownToRepository: [] },
      problems: [`L’export ne se rejoue pas jusqu’au bout : ${sqliteProblem(error)}.`],
    };
  }
  try {
    const integrity = (database.prepare('PRAGMA integrity_check').all() as { integrity_check: string }[]).map((row) => row.integrity_check);
    if (integrity.join() !== 'ok') problems.push(`La base rejouée n’est pas intègre (${integrity.length} défaut${integrity.length > 1 ? 's' : ''}).`);
    const orphans = database.prepare('PRAGMA foreign_key_check').all() as { table: string }[];
    for (const table of [...new Set(orphans.map((row) => row.table))].sort()) {
      const count = orphans.filter((row) => row.table === table).length;
      problems.push(`${table} : ${count} ligne${count > 1 ? 's désignent' : ' désigne'} une ligne absente.`);
    }

    const hasMigrations = (database.prepare("SELECT 1 AS present FROM sqlite_schema WHERE type = 'table' AND name = ?").get(MIGRATIONS_TABLE) as { present: number } | undefined) !== undefined;
    const applied = hasMigrations
      ? (database.prepare(`SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY id`).all() as { name: string }[]).map((row) => row.name)
      : [];
    if (!hasMigrations) problems.push('L’export n’a pas la liste des migrations reçues par la base (d1_migrations).');
    const repository = migrationFiles(migrationsDir);
    const missingFromExport = repository.filter((name) => !applied.includes(name));
    const unknownToRepository = applied.filter((name) => !repository.includes(name));
    if (unknownToRepository.length > 0) {
      problems.push(`L’export a reçu ${unknownToRepository.length} migration${unknownToRepository.length > 1 ? 's' : ''} que ce dépôt ne connaît pas : mettez le dépôt à jour avant de le contrôler.`);
    } else if (hasMigrations) {
      const reference = migratedReference(migrationsDir, applied);
      problems.push(...schemaDifferences(reference, database).map((difference) => `Schéma : ${difference}.`));
      reference.close();
    }
    return { ...summarizeDatabase(database), migrations: { applied, missingFromExport, unknownToRepository }, problems };
  } finally {
    database.close();
  }
}

export type TableDifference = { table: string; expected: TableSummary | null; actual: TableSummary | null };

/** Les tables dont le nombre de lignes ou le contenu diffère entre deux bases ; vide quand elles sont identiques. */
export function compareSummaries(expected: readonly TableSummary[], actual: readonly TableSummary[]): TableDifference[] {
  const names = [...new Set([...expected, ...actual].map((table) => table.name))].sort();
  return names
    .map((table) => ({ table, expected: expected.find((entry) => entry.name === table) ?? null, actual: actual.find((entry) => entry.name === table) ?? null }))
    .filter(({ expected: wanted, actual: found }) => wanted?.rows !== found?.rows || wanted?.digest !== found?.digest);
}

/** Une différence en mots, sans valeur : « irrigation_events : 12 lignes attendues, 11 trouvées ». */
export function differenceWords({ table, expected, actual }: TableDifference): string {
  if (!expected) return `${table} : table en trop`;
  if (!actual) return `${table} : table absente`;
  if (expected.rows !== actual.rows) return `${table} : ${expected.rows} ligne${expected.rows > 1 ? 's' : ''} attendue${expected.rows > 1 ? 's' : ''}, ${actual.rows} trouvée${actual.rows > 1 ? 's' : ''}`;
  return `${table} : même nombre de lignes (${actual.rows}), contenu différent`;
}
