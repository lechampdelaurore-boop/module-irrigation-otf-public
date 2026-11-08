import { db } from '../binding';
import type { SurfaceState } from '@/lib/domain/soil-reserve/bare-soil';
import type { SoilDayRecord } from '@/lib/domain/soil-reserve/records';

/**
 * L'état du jour passé de chaque planche (docs/soil-reserve-contract.md,
 * « Découpage et preuve de fin », migration 0025) : De, la réserve profonde,
 * le mode, la profondeur de référence, les apports, la consommation, le
 * drainage et la confiance. Un état recalculé remplace le précédent du même
 * jour, comme l'ETM du jour ; il ne réécrit aucune observation ni aucune
 * saisie. Les jours prévus ne s'enregistrent pas (`soilDayRecord`).
 */

export type StoredSoilDay = SoilDayRecord & { computedAt: string };

/** Enregistre les états d'un seul lot : chaque ligne remplace celle du même jour de la même planche. */
export async function saveSoilDaysForWorkspace(workspaceId: string, records: readonly SoilDayRecord[], now = new Date()): Promise<void> {
  if (records.length === 0) return;
  const computedAt = now.toISOString();
  await db.batch(records.map((record) => db.prepare(
    `INSERT INTO irrigation_soil_days
       (workspace_id, otf_bed_id, date, mode, surface_state, depth_m, capacity_mm, threshold_mm, start_mm, state_mm,
        depletion_mm, deep_mm, rain_mm, irrigation_mm, consumption_mm, drainage_mm, restart, unknown_kind, unknown_date, computed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (workspace_id, otf_bed_id, date) DO UPDATE SET
       mode = excluded.mode, surface_state = excluded.surface_state, depth_m = excluded.depth_m,
       capacity_mm = excluded.capacity_mm, threshold_mm = excluded.threshold_mm, start_mm = excluded.start_mm,
       state_mm = excluded.state_mm, depletion_mm = excluded.depletion_mm, deep_mm = excluded.deep_mm,
       rain_mm = excluded.rain_mm, irrigation_mm = excluded.irrigation_mm, consumption_mm = excluded.consumption_mm,
       drainage_mm = excluded.drainage_mm, restart = excluded.restart, unknown_kind = excluded.unknown_kind,
       unknown_date = excluded.unknown_date, computed_at = excluded.computed_at`,
  ).bind(
    workspaceId, record.bedId, record.date, record.mode, record.surfaceState, record.depthM, record.capacityMm,
    record.thresholdMm, record.startMm, record.stateMm, record.depletionMm, record.deepMm, record.rainMm,
    record.irrigationMm, record.consumptionMm, record.drainageMm, record.restart, record.unknownKind, record.unknownDate,
    computedAt,
  )));
}

/** Les états de `from` à `to` compris, par jour puis par planche. */
export async function listSoilDaysForWorkspace(workspaceId: string, from: string, to: string): Promise<StoredSoilDay[]> {
  const result = await db.prepare(
    `SELECT otf_bed_id, date, mode, surface_state, depth_m, capacity_mm, threshold_mm, start_mm, state_mm, depletion_mm,
            deep_mm, rain_mm, irrigation_mm, consumption_mm, drainage_mm, restart, unknown_kind, unknown_date, computed_at
     FROM irrigation_soil_days
     WHERE workspace_id = ? AND date BETWEEN ? AND ?
     ORDER BY date, otf_bed_id`,
  ).bind(workspaceId, from, to).all<DayRow>();
  return result.results.map((row) => ({
    bedId: row.otf_bed_id,
    date: row.date,
    mode: row.mode,
    surfaceState: row.surface_state,
    depthM: row.depth_m,
    capacityMm: row.capacity_mm,
    thresholdMm: row.threshold_mm,
    startMm: row.start_mm,
    stateMm: row.state_mm,
    depletionMm: row.depletion_mm,
    deepMm: row.deep_mm,
    rainMm: row.rain_mm,
    irrigationMm: row.irrigation_mm,
    consumptionMm: row.consumption_mm,
    drainageMm: row.drainage_mm,
    restart: row.restart,
    unknownKind: row.unknown_kind,
    unknownDate: row.unknown_date,
    computedAt: row.computed_at,
  }));
}

type DayRow = {
  otf_bed_id: string;
  date: string;
  mode: SoilDayRecord['mode'];
  surface_state: SurfaceState | null;
  depth_m: number | null;
  capacity_mm: number | null;
  threshold_mm: number | null;
  start_mm: number | null;
  state_mm: number | null;
  depletion_mm: number | null;
  deep_mm: number | null;
  rain_mm: number | null;
  irrigation_mm: number;
  consumption_mm: number | null;
  drainage_mm: number;
  restart: SoilDayRecord['restart'];
  unknown_kind: SoilDayRecord['unknownKind'];
  unknown_date: string | null;
  computed_at: string;
};
