/**
 * Une fausse D1, en mémoire (4.5, PR 4 ; docs/tranche-4-contract.md,
 * 10 bis.15) : les essais du dépôt et la simulation de `pnpm backup:rehearse`
 * jouent l'essai de restauration contre elle, sans Cloudflare.
 *
 * Elle fait ce que fait D1 pour l'essai : des clés étrangères actives, un
 * fichier SQL joué d'un bloc (tout ou rien), un export dans la forme de
 * `wrangler d1 export`, et un signet par état, auquel on revient par une
 * restauration qui rend le signet de l'état d'avant. Ses sabotages font
 * échouer l'essai : c'est la preuve qu'un défaut ne passe pas.
 */
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { assertRehearsalDatabase, type D1Operations } from './d1-operations.ts';
import { dumpDatabase, dumpStatements } from './sqlite-dump.ts';

type Snapshot = { bookmark: string; at: number; dump: string };
type MemoryBase = { database: DatabaseSync; history: Snapshot[] };

export type MemorySabotage = {
  /** La restauration rend un signet, mais la base ne bouge pas. */
  restoreDoesNothing?: boolean;
  /** Chaque export oublie cette table (sa création et ses lignes). */
  exportDropsTable?: string;
  /** Dans cette base, un fichier SQL perd sa dernière insertion en route. */
  importLosesLastRowIn?: string;
};

export type MemoryD1 = D1Operations & {
  /** Les bases qui existent encore. */
  names(): string[];
  /** Les fichiers SQL reçus, par base, dans l'ordre : l'essai vérifie ce qui a été envoyé. */
  received(database: string): string[];
};

function emptyDatabase(): DatabaseSync {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = ON');
  return database;
}

/** Joue un fichier d'un bloc, comme D1 : une erreur, et rien n'est gardé. */
function runAtomically(database: DatabaseSync, sql: string): void {
  database.exec('BEGIN');
  try {
    database.exec(sql);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

/** L'export sans une table : ni sa création, ni ses lignes, ni ses index, ni son compteur. */
function exportWithoutTable(database: DatabaseSync, table: string): string {
  return dumpStatements(database)
    .filter((statement) => !statement.includes(`"${table}"`) && !statement.includes(`\`${table}\``) && !statement.includes(`'${table}'`))
    .join('\n');
}

/** Le fichier sans sa dernière insertion de données (les compteurs de SQLite exceptés). */
function withoutLastInsert(sql: string): string {
  const starts = [...sql.matchAll(/^INSERT INTO "(?!sqlite_sequence")/gm)].map((match) => match.index);
  const start = starts.at(-1);
  if (start === undefined) return sql;
  const end = sql.indexOf(');\n', start);
  return end < 0 ? sql.slice(0, start) : sql.slice(0, start) + sql.slice(end + 3);
}

export function memoryD1Operations({ sabotage = {}, clock = () => Date.now() }: { sabotage?: MemorySabotage; clock?: () => number } = {}): MemoryD1 {
  const bases = new Map<string, MemoryBase>();
  const sent = new Map<string, string[]>();
  let counter = 0;

  const baseOf = (name: string): MemoryBase => {
    assertRehearsalDatabase(name);
    const base = bases.get(name);
    if (!base) throw new Error(`Base inconnue : ${name}.`);
    return base;
  };
  const remember = (base: MemoryBase): string => {
    counter += 1;
    const dump = dumpDatabase(base.database);
    const bookmark = `${String(counter).padStart(8, '0')}-${createHash('sha256').update(dump).digest('hex').slice(0, 16)}`;
    base.history.push({ bookmark, at: clock(), dump });
    return bookmark;
  };
  const current = (base: MemoryBase): Snapshot => base.history[base.history.length - 1];

  return {
    names: () => [...bases.keys()].sort(),
    received: (name) => [...(sent.get(name) ?? [])],
    exists: async (name) => {
      assertRehearsalDatabase(name);
      return bases.has(name);
    },
    create: async (name) => {
      assertRehearsalDatabase(name);
      if (bases.has(name)) throw new Error(`La base ${name} existe déjà.`);
      const base = { database: emptyDatabase(), history: [] };
      bases.set(name, base);
      remember(base);
    },
    destroy: async (name) => {
      baseOf(name).database.close();
      bases.delete(name);
    },
    executeSql: async (name, sql) => {
      const base = baseOf(name);
      sent.set(name, [...(sent.get(name) ?? []), sql]);
      runAtomically(base.database, sabotage.importLosesLastRowIn === name ? withoutLastInsert(sql) : sql);
      remember(base);
    },
    tableNames: async (name) => (baseOf(name).database.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name").all() as { name: string }[]).map(({ name: table }) => table),
    exportSql: async (name) => {
      const started = clock();
      const { database } = baseOf(name);
      const sql = sabotage.exportDropsTable ? exportWithoutTable(database, sabotage.exportDropsTable) : dumpDatabase(database);
      return { sql, durationMs: Math.max(0, clock() - started) };
    },
    currentBookmark: async (name) => current(baseOf(name)).bookmark,
    bookmarkAt: async (name, instant) => {
      const moment = Date.parse(instant);
      const snapshot = baseOf(name).history.findLast((entry) => entry.at <= moment);
      if (!snapshot) throw new Error('Aucun signet à cet instant.');
      return snapshot.bookmark;
    },
    restore: async (name, bookmark) => {
      const base = baseOf(name);
      const target = base.history.find((entry) => entry.bookmark === bookmark);
      if (!target) throw new Error('Signet inconnu.');
      const previousBookmark = current(base).bookmark;
      if (!sabotage.restoreDoesNothing) {
        // Time Travel remet les pages de la base telles qu'elles étaient : rien n'est rejoué ni contrôlé.
        const restored = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false });
        restored.exec(target.dump);
        restored.exec('PRAGMA foreign_keys = ON');
        base.database.close();
        base.database = restored;
      }
      remember(base);
      return { previousBookmark };
    },
  };
}
