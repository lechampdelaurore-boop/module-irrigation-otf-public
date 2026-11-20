/**
 * Les gestes de l'essai de restauration sur une base D1 (4.5, PR 4 ;
 * docs/tranche-4-contract.md, F561, et 10 bis.15, F628) : créer, remplir,
 * exporter, noter un signet, revenir à un signet, détruire. L'essai ne parle
 * qu'à cette interface : la vraie, par Wrangler, chez Cloudflare ; une
 * fausse, en mémoire, dans les essais du dépôt.
 *
 * Garde-fou : la vraie refuse toute base dont le nom ne commence pas par
 * celui de la base d'essai. La base des fermes et celle de la démonstration
 * ne peuvent pas être touchées, même par erreur de saisie.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { captureWranglerExport, runWranglerCommand, wranglerJson } from './wrangler-export.ts';

export const REHEARSAL_DATABASE = 'module-irrigation-otf-essai-restauration';

export type D1Operations = {
  exists(database: string): Promise<boolean>;
  create(database: string): Promise<void>;
  destroy(database: string): Promise<void>;
  /** Exécute un fichier SQL d'un bloc : tout ou rien. */
  executeSql(database: string, sql: string): Promise<void>;
  /** Les tables de la base (celles de D1 comprises). */
  tableNames(database: string): Promise<string[]>;
  /** L'export, en mémoire, et sa durée. */
  exportSql(database: string): Promise<{ sql: string; durationMs: number }>;
  /** Le signet de l'état présent (Time Travel). */
  currentBookmark(database: string): Promise<string>;
  /** Le signet de l'état à un instant passé (Time Travel), tel que Cloudflare le retrouve. */
  bookmarkAt(database: string, instant: string): Promise<string>;
  /** Revient au signet donné ; rend le signet de l'état d'avant, pour pouvoir y revenir. */
  restore(database: string, bookmark: string): Promise<{ previousBookmark: string }>;
};

/** Le garde-fou : une base d'essai, jamais une autre. */
export function assertRehearsalDatabase(database: string): void {
  if (database !== REHEARSAL_DATABASE && !database.startsWith(`${REHEARSAL_DATABASE}-`)) {
    throw new Error(`L’essai ne touche qu’aux bases « ${REHEARSAL_DATABASE}… » : « ${database} » est refusée.`);
  }
}

type Relay = (line: string) => void;

/**
 * Les gestes par Wrangler, chez Cloudflare, avec la connexion du lanceur
 * (CLOUDFLARE_API_TOKEN et CLOUDFLARE_ACCOUNT_ID en CI). `cwd` est un dossier
 * sans fichier de réglages de Wrangler : un nom de base n'y peut désigner
 * aucune liaison du module, seulement la base de ce nom.
 */
export function wranglerD1Operations({ cwd, relay, guard = assertRehearsalDatabase }: { cwd: string; relay: Relay; guard?: (database: string) => void }): D1Operations {
  const run = (args: string[]) => runWranglerCommand(args, { cwd, relay });
  const guarded = <A extends unknown[], R>(action: (database: string, ...rest: A) => Promise<R>) =>
    async (database: string, ...rest: A): Promise<R> => {
      guard(database);
      return action(database, ...rest);
    };
  return {
    exists: guarded(async (database) => {
      const list = wranglerJson<{ name: string }[]>(await run(['d1', 'list', '--json']));
      return list.some((entry) => entry.name === database);
    }),
    // Sans toucher au fichier de réglages du dépôt : la base d'essai n'y entre jamais.
    create: guarded(async (database) => { await run(['d1', 'create', database, '--update-config=false']); }),
    destroy: guarded(async (database) => { await run(['d1', 'delete', database, '--skip-confirmation']); }),
    executeSql: guarded(async (database, sql: string) => {
      // Le temps de l'envoi seulement, dans un dossier privé effacé aussitôt, même en cas d'échec :
      // `wrangler d1 execute --remote` ne lit qu'un fichier.
      const directory = mkdtempSync(path.join(tmpdir(), 'essai-restauration-'));
      try {
        const file = path.join(directory, 'lot.sql');
        writeFileSync(file, sql, { mode: 0o600 });
        await run(['d1', 'execute', database, '--remote', `--file=${file}`, '--yes', '--json']);
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    }),
    tableNames: guarded(async (database) => {
      const query = "SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name";
      const [result] = wranglerJson<{ results: { name: string }[] }[]>(await run(['d1', 'execute', database, '--remote', `--command=${query}`, '--json']));
      return (result?.results ?? []).map(({ name }) => name);
    }),
    exportSql: guarded(async (database) => {
      const captured = await captureWranglerExport({ database, location: 'remote' }, { cwd, relay });
      try {
        return { sql: captured.sql.toString('utf8'), durationMs: captured.durationMs };
      } finally {
        captured.sql.fill(0);
      }
    }),
    currentBookmark: guarded(async (database) => {
      const { bookmark } = wranglerJson<{ bookmark: string }>(await run(['d1', 'time-travel', 'info', database, '--json']));
      return bookmark;
    }),
    bookmarkAt: guarded(async (database, instant: string) => {
      const { bookmark } = wranglerJson<{ bookmark: string }>(await run(['d1', 'time-travel', 'info', database, `--timestamp=${instant}`, '--json']));
      return bookmark;
    }),
    restore: guarded(async (database, bookmark: string) => {
      const result = wranglerJson<{ previous_bookmark: string }>(await run(['d1', 'time-travel', 'restore', database, `--bookmark=${bookmark}`, '--json']));
      return { previousBookmark: result.previous_bookmark };
    }),
  };
}
