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
 *
 * Chaque appel à la base, lecture, écriture, lot ou `exec`, passe aussi par
 * l'observateur des appels (accélérer le site, A1, D-358) : le point d'entrée
 * du Worker y pose le chronomètre des requêtes ; sans observateur, l'appel
 * part tel quel. Un lot compte pour un appel : un seul aller-retour.
 */
let override: D1Database | null = null;

/** Ce qui accompagne chaque appel à la base : il reçoit l'appel, le lance lui-même et rend son résultat tel quel. */
export type DatabaseCallObserver = <T>(call: () => Promise<T>) => Promise<T>;

const unobserved: DatabaseCallObserver = (call) => call();
let observer: DatabaseCallObserver = unobserved;

/** Posé une fois par le point d'entrée du Worker (`lib/services/request-timing.ts`) ; `null` le retire (tests). */
export function observeDatabaseCalls(next: DatabaseCallObserver | null): void {
  observer = next ?? unobserved;
}

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
/** Chaque instruction préparée par `db`, et l'instruction de la base qu'elle enveloppe, que `batch` lui rend. */
const preparedStatements = new WeakMap<D1PreparedStatement, D1PreparedStatement>();
/** Celles qui écrivent. */
const preparedWrites = new WeakSet<D1PreparedStatement>();

/** Une instruction de `db` : son exécution passe par l'observateur ; celle d'une écriture, par la mémoire de la requête. */
function preparedStatement(statement: D1PreparedStatement, writes: boolean): D1PreparedStatement {
  const prepared = new Proxy(statement, {
    get(target, property) {
      const value = Reflect.get(target, property) as unknown;
      if (typeof value !== 'function') return value;
      const method = value as (...args: unknown[]) => unknown;
      if (property === 'bind') return (...values: unknown[]) => preparedStatement(method.apply(target, values) as D1PreparedStatement, writes);
      if (EXECUTIONS.has(property)) {
        return (...args: unknown[]) => {
          const execute = () => observer(() => method.apply(target, args) as Promise<unknown>);
          return writes ? duringWrite(execute) : execute();
        };
      }
      return method.bind(target);
    },
  });
  preparedStatements.set(prepared, statement);
  if (writes) preparedWrites.add(prepared);
  return prepared;
}

function prepare(database: D1Database, sql: string): D1PreparedStatement {
  return preparedStatement(database.prepare(sql), !READ_STATEMENT.test(sql));
}

function batch(database: D1Database, statements: D1PreparedStatement[]): Promise<D1Result[]> {
  const unwrapped = statements.map((statement) => preparedStatements.get(statement) ?? statement);
  const execute = () => observer(() => database.batch(unwrapped));
  return statements.some((statement) => preparedWrites.has(statement)) ? duringWrite(execute) : execute();
}

/** Façade stable : `db.prepare(...)`, `db.batch(...)` s'adressent à la base courante. */
export const db: D1Database = new Proxy({} as D1Database, {
  get(_target, property) {
    const database = currentDatabase();
    if (property === 'prepare') return (sql: string) => prepare(database, sql);
    if (property === 'batch') return (statements: D1PreparedStatement[]) => batch(database, statements);
    if (property === 'exec') return (sql: string) => duringWrite(() => observer(() => database.exec(sql)));
    const value = Reflect.get(database, property) as unknown;
    return typeof value === 'function'
      ? (value as (...args: unknown[]) => unknown).bind(database)
      : value;
  },
});
