import { env } from 'cloudflare:workers';
import { duringWrite } from './request-memo';

/**
 * Point d'accès unique à la base D1 (sous-tranche Q2).
 *
 * Les dépôts n'importent plus `env` : ils passent par `db`, qui délègue à la
 * liaison `DB` du Worker au moment de l'appel. Les tests d'exécution de la
 * persistance remplacent la base par un adaptateur SQLite en mémoire avec
 * `overrideDatabase`, sans modifier le code des dépôts ni leur SQL.
 *
 * Toute écriture passe par la mémoire de la requête (`db/request-memo.ts`),
 * vidée quand elle commence et quand elle finit : une instruction qui n'est
 * pas une lecture, un lot qui en contient une, et `exec`. Les lectures
 * passent telles quelles.
 */
let override: D1Database | null = null;

function currentDatabase(): D1Database {
  const database = override ?? env.DB;
  if (!database) {
    throw new Error(
      'Liaison D1 `DB` indisponible : déclarer `d1_databases` dans wrangler.jsonc pour que l’exécution l’injecte.',
    );
  }
  return database;
}

/** Réservé aux tests : remplace la base courante ; `null` rend la main à la liaison du Worker. */
export function overrideDatabase(database: D1Database | null): void {
  override = database;
}

/** Une lecture commence par `SELECT`, après d'éventuels commentaires ; tout le reste compte pour une écriture, `WITH` compris. */
const READ_STATEMENT = /^\s*(?:--[^\n]*\n\s*)*SELECT\b/i;
const EXECUTIONS: ReadonlySet<PropertyKey> = new Set(['first', 'all', 'run', 'raw']);
/** Chaque écriture préparée, et l'instruction de la base qu'elle enveloppe, que `batch` lui rend. */
const preparedWrites = new WeakMap<D1PreparedStatement, D1PreparedStatement>();

function watchedWrite(statement: D1PreparedStatement): D1PreparedStatement {
  const watched = new Proxy(statement, {
    get(target, property) {
      const value = Reflect.get(target, property) as unknown;
      if (typeof value !== 'function') return value;
      const method = value as (...args: unknown[]) => unknown;
      if (property === 'bind') return (...values: unknown[]) => watchedWrite(method.apply(target, values) as D1PreparedStatement);
      if (EXECUTIONS.has(property)) return (...args: unknown[]) => duringWrite(() => method.apply(target, args) as Promise<unknown>);
      return method.bind(target);
    },
  });
  preparedWrites.set(watched, statement);
  return watched;
}

function prepare(database: D1Database, sql: string): D1PreparedStatement {
  const statement = database.prepare(sql);
  return READ_STATEMENT.test(sql) ? statement : watchedWrite(statement);
}

function batch(database: D1Database, statements: D1PreparedStatement[]): Promise<D1Result[]> {
  const unwrapped = statements.map((statement) => preparedWrites.get(statement) ?? statement);
  return statements.some((statement) => preparedWrites.has(statement))
    ? duringWrite(() => database.batch(unwrapped))
    : database.batch(unwrapped);
}

/** Façade stable : `db.prepare(...)`, `db.batch(...)` s'adressent à la base courante. */
export const db: D1Database = new Proxy({} as D1Database, {
  get(_target, property) {
    const database = currentDatabase();
    if (property === 'prepare') return (sql: string) => prepare(database, sql);
    if (property === 'batch') return (statements: D1PreparedStatement[]) => batch(database, statements);
    if (property === 'exec') return (sql: string) => duringWrite(() => database.exec(sql));
    const value = Reflect.get(database, property) as unknown;
    return typeof value === 'function'
      ? (value as (...args: unknown[]) => unknown).bind(database)
      : value;
  },
});
