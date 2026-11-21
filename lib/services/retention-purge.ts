import { RETENTION_PURGES } from '@/db/retention-plan';
import { runRetentionPurgeBatch } from '@/db/retention-purge-repository';
import { logJsonLine } from '../adapters/log';
import {
  RETENTION_LIMITS,
  RETENTION_PURGE_BATCH_ROWS,
  RETENTION_PURGE_RUN_STATEMENTS,
  type RetentionPurgeRunReport,
} from '../domain/operations/retention';

/**
 * La tâche du matin qui purge les données à durée limitée (4.5, PR 5 ;
 * docs/tranche-4-contract.md, F562, et 10 bis.18, F650 et F651).
 *
 * Chaque table du plan de conservation qui a une durée perd, par lots
 * bornés, les lignes plus vieilles que sa limite, calculée à l'instant du
 * passage. Une purge qui échoue n'arrête pas les autres ; une purge arrêtée
 * par la borne du passage reprend au suivant : chaque lot ne vise que des
 * lignes trop vieilles, il n'efface jamais rien d'autre.
 *
 * Le journal ne porte que des noms de table, des nombres et des classes
 * d'erreur (F564).
 */

type RunOptions = {
  now?: Date;
  statements?: number;
  log?: typeof logJsonLine;
};

export async function runRetentionPurges({
  now = new Date(),
  statements = RETENTION_PURGE_RUN_STATEMENTS,
  log = logJsonLine,
}: RunOptions = {}): Promise<RetentionPurgeRunReport> {
  const atMs = now.getTime();
  const report = { purged: 0, unfinished: 0, failures: [] as string[] };
  let left = statements;
  for (const purge of RETENTION_PURGES) {
    const bound = RETENTION_LIMITS[purge.table](atMs);
    let rows = 0;
    try {
      for (;;) {
        if (left <= 0) {
          report.unfinished += 1;
          break;
        }
        left -= 1;
        const erased = await runRetentionPurgeBatch(purge, bound, RETENTION_PURGE_BATCH_ROWS);
        rows += erased;
        if (erased < RETENTION_PURGE_BATCH_ROWS) break;
      }
    } catch (error) {
      report.failures.push(errorClass(error));
      log('warn', { event: 'retention_purge_failed', table: purge.table, error: errorClass(error) });
    }
    if (rows > 0) log('info', { event: 'retention_purge_step', table: purge.table, rows });
    report.purged += rows;
  }
  return report;
}

/** Le nom de la classe d'erreur, jamais son message (F604). */
function errorClass(error: unknown): string {
  return error instanceof Error && /^[A-Za-z_]{1,40}$/.test(error.name) ? error.name : 'unknown';
}
