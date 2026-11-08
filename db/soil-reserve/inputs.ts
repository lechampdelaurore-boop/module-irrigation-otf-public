import { db } from '../binding';
import type { SurfaceDeclaration, SurfaceState } from '@/lib/domain/soil-reserve/bare-soil';
import type { SoilObservation } from '@/lib/domain/soil-reserve/gauge';
import type { RootingProfile } from '@/lib/domain/soil-reserve/rooting';
import type { SoilRecord, SoilSettingsRevision } from '@/lib/domain/soil-reserve/soil';
import { addDaysToDateKey } from '@/lib/domain/water-management';

/**
 * Ce que la jauge de la réserve du sol lit en base pour une exploitation
 * (docs/soil-reserve-contract.md, migration 0025) : le sol de ses parcelles
 * et de ses jardins, ses réglages, les profils racinaires — le jeu commun et
 * ses révisions —, ses observations et les états de surface de ses
 * planches. Toutes les révisions sont rendues : le domaine choisit celle qui
 * vaut chaque jour.
 */
export type SoilReserveInputs = {
  soilRecords: SoilRecord[];
  settings: SoilSettingsRevision[];
  rootingProfiles: StoredRootingProfile[];
  observations: SoilObservation[];
  surfaceDeclarations: SurfaceDeclaration[];
};

/** Un profil racinaire et son origine : `common`, le jeu commun ; `farm`, une révision de la ferme. */
export type StoredRootingProfile = RootingProfile & { origin: 'common' | 'farm' };

/** Les entrées de la jauge ; les observations depuis la veille de `from`, l'heure étant en UTC. */
export async function readSoilReserveInputsForWorkspace(workspaceId: string, from: string): Promise<SoilReserveInputs> {
  const [soil, settings, observations, declarations] = await db.batch([
    db.prepare(
      `SELECT otf_zone_id, otf_plot_id, lab_rfu_mm_per_meter, stone_share_percent, reference_share, provenance, sampled_depth_cm,
              source, tew_mm, rew_mm, surface_layer_cm, soil_depth_ceiling_m, effective_from, recorded_at
       FROM irrigation_soil_records WHERE workspace_id = ? ORDER BY recorded_at, rowid`,
    ).bind(workspaceId),
    db.prepare(
      `SELECT threshold_mode, threshold_percent, permeable_tarp_evaporation, mulched_evaporation, green_manure_emergence_kc,
              green_manure_partial_kc, green_manure_full_kc, grass_kc, plastic_mulch_rain_share, effective_from, recorded_at
       FROM irrigation_soil_settings WHERE workspace_id = ? ORDER BY recorded_at, rowid`,
    ).bind(workspaceId),
    db.prepare(
      `SELECT otf_zone_id, otf_plot_id, percent, observed_at, recorded_at
       FROM irrigation_soil_observations WHERE workspace_id = ? AND observed_at >= ? ORDER BY observed_at, recorded_at, rowid`,
    ).bind(workspaceId, addDaysToDateKey(from, -1)),
    db.prepare(
      `SELECT otf_bed_id, date, state, recorded_at
       FROM irrigation_soil_surface_declarations WHERE workspace_id = ? ORDER BY date, recorded_at, rowid`,
    ).bind(workspaceId),
  ]);
  return {
    soilRecords: (soil.results as SoilRow[]).map(soilRecordOf),
    settings: (settings.results as SettingsRow[]).map(settingsOf),
    rootingProfiles: await listRootingProfilesForWorkspace(workspaceId),
    observations: (observations.results as ObservationRow[]).map((row) => ({
      zoneId: row.otf_zone_id,
      plotId: row.otf_plot_id,
      percent: row.percent,
      observedAt: row.observed_at,
      recordedAt: row.recorded_at,
    })),
    surfaceDeclarations: (declarations.results as DeclarationRow[]).map((row) => ({
      bedId: row.otf_bed_id,
      date: row.date,
      state: row.state,
      recordedAt: row.recorded_at,
    })),
  };
}

/** Les profils racinaires que voit une exploitation : le jeu commun, puis ses révisions ; sans espace, le jeu commun seul. */
export async function listRootingProfilesForWorkspace(workspaceId: string | null): Promise<StoredRootingProfile[]> {
  const [profiles, stages] = await db.batch([
    db.prepare(
      `SELECT id, workspace_id, crop_key, p, source, note, effective_from, recorded_at
       FROM irrigation_soil_rooting_profiles
       WHERE workspace_id IS NULL OR workspace_id = ?
       ORDER BY workspace_id IS NOT NULL, crop_key, recorded_at, rowid`,
    ).bind(workspaceId),
    db.prepare(
      `SELECT stage.profile_id, stage.stage_rank, stage.depth_m, stage.end_depth_m, stage.progression_days
       FROM irrigation_soil_rooting_stages AS stage
       JOIN irrigation_soil_rooting_profiles AS profile ON profile.id = stage.profile_id
       WHERE profile.workspace_id IS NULL OR profile.workspace_id = ?
       ORDER BY stage.profile_id, stage.position`,
    ).bind(workspaceId),
  ]);
  const stagesByProfile = new Map<string, RootingProfile['stages'][number][]>();
  for (const row of stages.results as StageRow[]) {
    const list = stagesByProfile.get(row.profile_id) ?? [];
    list.push({ rank: row.stage_rank, depthM: row.depth_m, endDepthM: row.end_depth_m, progressionDays: row.progression_days });
    stagesByProfile.set(row.profile_id, list);
  }
  return (profiles.results as ProfileRow[]).map((row) => ({
    referenceCropId: row.crop_key,
    p: row.p,
    stages: stagesByProfile.get(row.id) ?? [],
    source: row.source,
    note: row.note,
    effectiveFrom: row.effective_from,
    recordedAt: row.recorded_at,
    origin: row.workspace_id === null ? 'common' : 'farm',
  }));
}

type SoilRow = {
  otf_zone_id: string;
  otf_plot_id: string | null;
  lab_rfu_mm_per_meter: number;
  stone_share_percent: number | null;
  reference_share: number;
  provenance: SoilRecord['provenance'];
  sampled_depth_cm: number | null;
  source: string;
  tew_mm: number;
  rew_mm: number;
  surface_layer_cm: number;
  soil_depth_ceiling_m: number | null;
  effective_from: string;
  recorded_at: string;
};

type SettingsRow = {
  threshold_mode: 'crop' | 'farm';
  threshold_percent: number | null;
  permeable_tarp_evaporation: number;
  mulched_evaporation: number;
  green_manure_emergence_kc: number;
  green_manure_partial_kc: number;
  green_manure_full_kc: number;
  grass_kc: number;
  plastic_mulch_rain_share: number;
  effective_from: string;
  recorded_at: string;
};

type ObservationRow = { otf_zone_id: string; otf_plot_id: string | null; percent: number; observed_at: string; recorded_at: string };
type DeclarationRow = { otf_bed_id: string; date: string; state: SurfaceState; recorded_at: string };
type ProfileRow = {
  id: string;
  workspace_id: string | null;
  crop_key: string;
  p: number | null;
  source: string;
  note: string | null;
  effective_from: string;
  recorded_at: string;
};
type StageRow = { profile_id: string; stage_rank: number | null; depth_m: number; end_depth_m: number | null; progression_days: number | null };

function soilRecordOf(row: SoilRow): SoilRecord {
  return {
    zoneId: row.otf_zone_id,
    plotId: row.otf_plot_id,
    labRfuMmPerMeter: row.lab_rfu_mm_per_meter,
    stoneSharePercent: row.stone_share_percent,
    referenceShare: row.reference_share,
    provenance: row.provenance,
    sampledDepthCm: row.sampled_depth_cm,
    source: row.source,
    tewMm: row.tew_mm,
    rewMm: row.rew_mm,
    surfaceLayerCm: row.surface_layer_cm,
    soilDepthCeilingM: row.soil_depth_ceiling_m,
    effectiveFrom: row.effective_from,
    recordedAt: row.recorded_at,
  };
}

function settingsOf(row: SettingsRow): SoilSettingsRevision {
  return {
    threshold: row.threshold_mode === 'farm' && row.threshold_percent !== null
      ? { mode: 'farm', percent: row.threshold_percent }
      : { mode: 'crop' },
    surface: {
      permeableTarpEvaporation: row.permeable_tarp_evaporation,
      mulchedEvaporation: row.mulched_evaporation,
      greenManureEmergenceKc: row.green_manure_emergence_kc,
      greenManurePartialKc: row.green_manure_partial_kc,
      greenManureFullKc: row.green_manure_full_kc,
      grassKc: row.grass_kc,
    },
    plasticMulchRainShare: row.plastic_mulch_rain_share,
    effectiveFrom: row.effective_from,
    recordedAt: row.recorded_at,
  };
}
