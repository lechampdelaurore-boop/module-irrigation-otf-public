/**
 * Adaptateur de test : l'interface D1 de Cloudflare au-dessus de `node:sqlite`.
 *
 * Il reproduit le sous-ensemble utilisé par les dépôts (`prepare`, `bind`,
 * `first`, `all`, `run`, `raw`, `batch`, `exec`) avec la sémantique de D1 :
 * résultats `{ success, results, meta }`, `first` qui rend `null` sans ligne,
 * `batch` atomique, booléens convertis en 0/1, `undefined` refusé, erreurs
 * préfixées `D1_ERROR`. Le SQL des dépôts s'exécute tel quel sur une base en
 * mémoire migrée par les fichiers de `drizzle/`. Contrat :
 * `docs/persistence-tests-contract.md`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { overrideDatabase } from '../../db/binding';

type SqliteParameter = null | number | bigint | string | Uint8Array;
type Row = Record<string, unknown>;

const MIGRATION_FILE = /^\d{4}_.+\.sql$/;
const STATEMENT_BREAKPOINT = '--> statement-breakpoint';
const READ_STATEMENT = /^\s*(?:--[^\n]*\n\s*)*(?:SELECT|WITH|PRAGMA|EXPLAIN|VALUES)\b/i;
const RETURNING_CLAUSE = /\bRETURNING\b/i;

/** Base SQLite en mémoire, clés étrangères actives, migrations rejouées dans l'ordre. */
export function createMigratedSqliteDatabase(migrationsDir = 'drizzle', upToMigration?: string): DatabaseSync {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = ON');
  for (const migration of listMigrations(migrationsDir)) {
    if (upToMigration !== undefined && migration > upToMigration) break;
    applyMigration(database, migrationsDir, migration);
  }
  return database;
}

/** Applique les migrations qui suivent `afterMigration` : un test y éprouve ce qu'une migration fait aux lignes existantes. */
export function applyMigrationsAfter(database: DatabaseSync, afterMigration: string, migrationsDir = 'drizzle'): void {
  for (const migration of listMigrations(migrationsDir)) {
    if (migration > afterMigration) applyMigration(database, migrationsDir, migration);
  }
}

function listMigrations(migrationsDir: string): string[] {
  return readdirSync(migrationsDir).filter((name) => MIGRATION_FILE.test(name)).sort();
}

function applyMigration(database: DatabaseSync, migrationsDir: string, migration: string): void {
  database.exec(readFileSync(path.join(migrationsDir, migration), 'utf8').replaceAll(STATEMENT_BREAKPOINT, ''));
}

export function createD1FromSqlite(database: DatabaseSync): D1Database {
  return new SqliteD1Database(database) as unknown as D1Database;
}

export type TestDatabase = {
  sqlite: DatabaseSync;
  d1: D1Database;
  /** Rend la main à la liaison du Worker et ferme la base. */
  dispose: () => void;
};

/** Base migrée neuve, installée comme base courante des dépôts. */
export function installTestDatabase(): TestDatabase {
  const sqlite = createMigratedSqliteDatabase();
  const d1 = createD1FromSqlite(sqlite);
  overrideDatabase(d1);
  return {
    sqlite,
    d1,
    dispose: () => {
      overrideDatabase(null);
      sqlite.close();
    },
  };
}

function d1Error(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`D1_ERROR: ${message}`, { cause: error });
}

function toSqliteParameter(value: unknown, index: number): SqliteParameter {
  if (value === null) return null;
  switch (typeof value) {
    case 'number':
    case 'bigint':
    case 'string':
      return value;
    case 'boolean':
      return value ? 1 : 0;
    case 'object':
      if (value instanceof Uint8Array) return value;
      if (value instanceof ArrayBuffer) return new Uint8Array(value);
      break;
    default:
      break;
  }
  throw new Error(`D1_TYPE_ERROR: Type '${value === undefined ? 'undefined' : typeof value}' not supported for value at position ${index + 1}`);
}

function returnsRows(query: string): boolean {
  return READ_STATEMENT.test(query) || RETURNING_CLAUSE.test(query);
}

type Meta = D1Result['meta'];

function meta(changes: number, lastRowId: number, rowsRead: number): Meta {
  return {
    duration: 0,
    size_after: 0,
    rows_read: rowsRead,
    rows_written: changes,
    last_row_id: lastRowId,
    changed_db: changes > 0,
    changes,
  };
}

class SqliteD1PreparedStatement {
  // Champs déclarés explicitement : `--experimental-strip-types` ne prend pas
  // en charge les propriétés de paramètre de constructeur.
  private readonly database: DatabaseSync;
  private readonly query: string;
  private readonly parameters: readonly SqliteParameter[];

  constructor(database: DatabaseSync, query: string, parameters: readonly SqliteParameter[]) {
    this.database = database;
    this.query = query;
    this.parameters = parameters;
  }

  bind(...values: unknown[]): SqliteD1PreparedStatement {
    return new SqliteD1PreparedStatement(this.database, this.query, values.map(toSqliteParameter));
  }

  async first<T = Row>(column?: string): Promise<T | null> {
    const row = this.execute().results[0] as Row | undefined;
    if (!row) return null;
    if (column === undefined) return row as T;
    if (!(column in row)) throw new Error(`D1_COLUMN_NOTFOUND: Column not found (${column})`);
    return row[column] as T;
  }

  async all<T = Row>(): Promise<D1Result<T>> {
    const executed = this.execute();
    return { success: true, results: executed.results as T[], meta: executed.meta };
  }

  async run<T = Row>(): Promise<D1Result<T>> {
    return this.all<T>();
  }

  async raw<T = unknown[]>(options?: { columnNames?: boolean }): Promise<T[]> {
    const rows = this.execute().results as Row[];
    const values = rows.map((row) => Object.values(row) as unknown as T);
    if (options?.columnNames && rows[0]) values.unshift(Object.keys(rows[0]) as unknown as T);
    return values;
  }

  /** Exécution synchrone commune ; `batch` l'utilise à l'intérieur d'une transaction. */
  execute(): { results: unknown[]; meta: Meta } {
    try {
      const statement = this.database.prepare(this.query);
      if (returnsRows(this.query)) {
        // node:sqlite rend des objets sans prototype ; D1 rend des objets ordinaires.
        const results = (statement.all(...this.parameters) as Row[]).map((row) => ({ ...row }));
        return { results, meta: meta(0, 0, results.length) };
      }
      const outcome = statement.run(...this.parameters);
      return { results: [], meta: meta(Number(outcome.changes), Number(outcome.lastInsertRowid), 0) };
    } catch (error) {
      throw d1Error(error);
    }
  }
}

class SqliteD1Database {
  private readonly database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.database = database;
  }

  prepare(query: string): SqliteD1PreparedStatement {
    return new SqliteD1PreparedStatement(this.database, query, []);
  }

  /** Comme D1 : tout le lot réussit ou aucune écriture n'est conservée. */
  async batch<T = Row>(statements: readonly SqliteD1PreparedStatement[]): Promise<D1Result<T>[]> {
    this.database.exec('BEGIN');
    try {
      const results = statements.map((statement) => {
        const executed = statement.execute();
        return { success: true as const, results: executed.results as T[], meta: executed.meta };
      });
      this.database.exec('COMMIT');
      return results;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  async exec(query: string): Promise<D1ExecResult> {
    try {
      this.database.exec(query);
      // `count` approximé par le nombre d'instructions non vides, D1 comptant celles exécutées.
      return { count: query.split(';').filter((statement) => statement.trim().length > 0).length, duration: 0 };
    } catch (error) {
      throw d1Error(error);
    }
  }

  async dump(): Promise<ArrayBuffer> {
    throw new Error('D1 dump() n’est pas pris en charge par l’adaptateur de test.');
  }

  withSession(): never {
    throw new Error('D1 withSession() n’est pas pris en charge par l’adaptateur de test.');
  }
}
