import { env } from 'cloudflare:workers';

/**
 * Point d'accès unique à la base D1 (sous-tranche Q2).
 *
 * Les dépôts n'importent plus `env` : ils passent par `db`, qui délègue à la
 * liaison `DB` du Worker au moment de l'appel. Les tests d'exécution de la
 * persistance remplacent la base par un adaptateur SQLite en mémoire avec
 * `overrideDatabase`, sans modifier le code des dépôts ni leur SQL.
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

/** Façade stable : `db.prepare(...)`, `db.batch(...)` s'adressent à la base courante. */
export const db: D1Database = new Proxy({} as D1Database, {
  get(_target, property) {
    const database = currentDatabase();
    const value = Reflect.get(database, property) as unknown;
    return typeof value === 'function'
      ? (value as (...args: unknown[]) => unknown).bind(database)
      : value;
  },
});
