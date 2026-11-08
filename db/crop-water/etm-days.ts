import { db } from '../binding';
import type { Season } from '@/lib/domain/domain';
import type { Et0Nature } from '@/lib/domain/crop-water/etm';
import type { EtmDayRecord, EtmDayTrace } from '@/lib/domain/crop-water/records';
import type { KcSource } from '@/lib/domain/crop-water/reference';

/**
 * Persistance de l'ETM du jour par planche (docs/crop-water-need-contract.md,
 * « La traçabilité », migration 0023) : l'ETM, l'ET0 et sa nature, et ce qui
 * l'a produite. Une ETM recalculée remplace la précédente pour le calcul ;
 * elle ne réécrit aucune irrigation ni aucun cumul. Les jours bloqués n'ont
 * pas de ligne (`etmDayRecord`) : la dernière valeur valide reste.
 */

type EtmRow = {
  otf_bed_id: string;
  date: string;
  status: EtmDayRecord['status'];
  etm_mm: number | null;
  et0_mm: number | null;
  et0_nature: Et0Nature | null;
  irrigation_stop: number;
  series_id: string | null;
  cultivation_id: string | null;
  plant_id: string | null;
  crop_key: string | null;
  kc_source: KcSource | null;
  stage_rank: number | null;
  stage_origin: EtmDayTrace['stageOrigin'] | null;
  kc: number | null;
  reference_kc: number | null;
  kc_overridden: number | null;
  abatement: number | null;
  kc_smoothed: number | null;
  shelter_factor: number | null;
  mulch_factor: number | null;
  shade_factor: number | null;
  shade_net_rate: number | null;
  computed_at: string;
};

export type StoredEtmDay = EtmDayRecord & { computedAt: string };

/** Enregistre les ETM d'une saison, d'un seul lot : chaque ligne remplace celle du même jour de la même planche. */
export async function saveEtmDaysForWorkspace(
  workspaceId: string,
  season: Season,
  records: readonly EtmDayRecord[],
  now = new Date(),
): Promise<void> {
  if (records.length === 0) return;
  const computedAt = now.toISOString();
  await db.batch(records.map((record) => {
    const trace = record.trace;
    return db.prepare(
      `INSERT INTO irrigation_crop_etm_days
         (workspace_id, season, otf_bed_id, date, status, etm_mm, et0_mm, et0_nature, irrigation_stop,
          series_id, cultivation_id, plant_id, crop_key, kc_source, stage_rank, stage_origin, kc, reference_kc,
          kc_overridden, abatement, kc_smoothed, shelter_factor, mulch_factor, shade_factor, shade_net_rate, computed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (workspace_id, season, otf_bed_id, date) DO UPDATE SET
         status = excluded.status, etm_mm = excluded.etm_mm, et0_mm = excluded.et0_mm, et0_nature = excluded.et0_nature,
         irrigation_stop = excluded.irrigation_stop, series_id = excluded.series_id, cultivation_id = excluded.cultivation_id,
         plant_id = excluded.plant_id, crop_key = excluded.crop_key, kc_source = excluded.kc_source,
         stage_rank = excluded.stage_rank, stage_origin = excluded.stage_origin, kc = excluded.kc,
         reference_kc = excluded.reference_kc, kc_overridden = excluded.kc_overridden, abatement = excluded.abatement,
         kc_smoothed = excluded.kc_smoothed, shelter_factor = excluded.shelter_factor, mulch_factor = excluded.mulch_factor,
         shade_factor = excluded.shade_factor, shade_net_rate = excluded.shade_net_rate, computed_at = excluded.computed_at`,
    ).bind(
      workspaceId, season, record.bedId, record.date, record.status, record.etmMm, record.et0Mm, record.et0Nature,
      record.irrigationStop ? 1 : 0,
      trace?.seriesId ?? null, trace?.cultivationId ?? null, trace?.plantId ?? null, trace?.referenceCropId ?? null,
      trace?.source ?? null, trace?.stageRank ?? null, trace?.stageOrigin ?? null, trace?.kc ?? null,
      trace?.referenceKc ?? null, trace ? flag(trace.kcOverridden) : null, trace?.abatement ?? null,
      trace ? flag(trace.kcSmoothed) : null, trace?.shelterFactor ?? null, trace?.mulchFactor ?? null,
      trace?.shadeFactor ?? null, trace?.shadeNetRate ?? null, computedAt,
    );
  }));
}

/** Les ETM d'une saison de `from` à `to` compris, par jour puis par planche. */
export async function listEtmDaysForWorkspace(
  workspaceId: string,
  season: Season,
  from: string,
  to: string,
): Promise<StoredEtmDay[]> {
  const result = await db.prepare(
    `SELECT otf_bed_id, date, status, etm_mm, et0_mm, et0_nature, irrigation_stop, series_id, cultivation_id, plant_id,
            crop_key, kc_source, stage_rank, stage_origin, kc, reference_kc, kc_overridden, abatement, kc_smoothed,
            shelter_factor, mulch_factor, shade_factor, shade_net_rate, computed_at
     FROM irrigation_crop_etm_days
     WHERE workspace_id = ? AND season = ? AND date BETWEEN ? AND ?
     ORDER BY date, otf_bed_id`,
  ).bind(workspaceId, season, from, to).all<EtmRow>();
  return result.results.map((row) => ({
    bedId: row.otf_bed_id,
    date: row.date,
    status: row.status,
    etmMm: row.etm_mm,
    et0Mm: row.et0_mm,
    et0Nature: row.et0_nature,
    irrigationStop: row.irrigation_stop === 1,
    trace: traceOf(row),
    computedAt: row.computed_at,
  }));
}

function traceOf(row: EtmRow): EtmDayTrace | null {
  if (row.crop_key === null || row.kc_source === null || row.stage_origin === null) return null;
  return {
    seriesId: row.series_id ?? '',
    cultivationId: row.cultivation_id ?? '',
    plantId: row.plant_id ?? '',
    referenceCropId: row.crop_key,
    source: row.kc_source,
    stageRank: row.stage_rank ?? 0,
    stageOrigin: row.stage_origin,
    kc: row.kc ?? Number.NaN,
    referenceKc: row.reference_kc ?? Number.NaN,
    kcOverridden: row.kc_overridden === 1,
    abatement: row.abatement ?? Number.NaN,
    kcSmoothed: row.kc_smoothed === 1,
    shelterFactor: row.shelter_factor ?? Number.NaN,
    mulchFactor: row.mulch_factor ?? Number.NaN,
    shadeFactor: row.shade_factor ?? Number.NaN,
    shadeNetRate: row.shade_net_rate,
  };
}

function flag(value: boolean): number {
  return value ? 1 : 0;
}
