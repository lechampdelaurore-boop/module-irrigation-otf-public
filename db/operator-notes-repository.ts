import { db } from './binding';
import type { SupportAccess } from '@/lib/domain/operations/support-access';
import type { StoredCostReading } from '@/lib/domain/operations/costs';

/**
 * Ce que la page d'état note de la main de l'exploitant, hors des tâches du
 * registre (4.5, PR 5 ; docs/tranche-4-contract.md, 10 bis.21, F660 à F663) :
 * le journal d'accès du support (12 mois, puis la purge du matin) et le
 * relevé des coûts du mois. Deux tables communes, d'aucun espace.
 */

export async function recordSupportAccess(access: SupportAccess, at: string): Promise<void> {
  await db.prepare('INSERT INTO irrigation_support_accesses (id, otf_farm_id, accessed_on, reason, recorded_at) VALUES (?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), access.otfFarmId, access.accessedOn, access.reason, at)
    .run();
}

/** Les accès gardés, du plus récent au plus ancien ; ceux d'avant `oldestDay` attendent la purge du matin et ne se montrent plus. */
export async function listSupportAccesses(oldestDay: string): Promise<(SupportAccess & { id: string })[]> {
  const result = await db.prepare(
    `SELECT id, otf_farm_id AS otfFarmId, accessed_on AS accessedOn, reason
     FROM irrigation_support_accesses WHERE accessed_on >= ? ORDER BY accessed_on DESC, recorded_at DESC`,
  ).bind(oldestDay).all<SupportAccess & { id: string }>();
  return result.results;
}

/** Note le relevé du mois ; rend `true` s'il en remplace un. */
export async function recordCostReading(reading: Omit<StoredCostReading, 'recordedAt'>, at: string): Promise<boolean> {
  const existing = await db.prepare('SELECT 1 AS found FROM irrigation_cost_readings WHERE month = ?').bind(reading.month).first<{ found: number }>();
  await db.prepare(
    `INSERT INTO irrigation_cost_readings (month, workers_requests, workers_cpu_ms, d1_rows_read, d1_rows_written, d1_storage_mb, billed_usd, recorded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (month) DO UPDATE SET workers_requests = excluded.workers_requests, workers_cpu_ms = excluded.workers_cpu_ms,
       d1_rows_read = excluded.d1_rows_read, d1_rows_written = excluded.d1_rows_written, d1_storage_mb = excluded.d1_storage_mb,
       billed_usd = excluded.billed_usd, recorded_at = excluded.recorded_at`,
  ).bind(reading.month, reading.workersRequests, reading.workersCpuMs, reading.d1RowsRead, reading.d1RowsWritten, reading.d1StorageMb, reading.billedUsd, at).run();
  return existing !== null;
}

/** Les douze derniers relevés, le plus récent d'abord. */
export async function listCostReadings(): Promise<StoredCostReading[]> {
  const result = await db.prepare(
    `SELECT month, workers_requests AS workersRequests, workers_cpu_ms AS workersCpuMs, d1_rows_read AS d1RowsRead,
       d1_rows_written AS d1RowsWritten, d1_storage_mb AS d1StorageMb, billed_usd AS billedUsd, recorded_at AS recordedAt
     FROM irrigation_cost_readings ORDER BY month DESC LIMIT 12`,
  ).all<StoredCostReading>();
  return result.results;
}
