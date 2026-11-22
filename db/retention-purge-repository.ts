import { db } from './binding';
import type { RetentionPurge } from './retention-plan';

/**
 * Une purge par durée, en SQL (4.5, PR 5 ; docs/tranche-4-contract.md, F562,
 * et 10 bis.18, F650). Le service `lib/services/retention-purge.ts` enchaîne
 * les lots et tient la borne d'un passage ; ce dépôt efface un lot à la fois :
 * au plus `limit` lignes plus vieilles que `bound`, et rend leur nombre.
 */
export async function runRetentionPurgeBatch(purge: RetentionPurge, bound: number | string, limit: number): Promise<number> {
  const result = await db.prepare(
    `DELETE FROM "${purge.table}" WHERE rowid IN (SELECT rowid FROM "${purge.table}" WHERE ${purge.condition} LIMIT ?)`,
  ).bind(bound, limit).run();
  return result.meta.changes ?? 0;
}
