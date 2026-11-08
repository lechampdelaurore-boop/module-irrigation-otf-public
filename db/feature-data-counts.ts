import { db } from './binding';
import { findWorkspaceIdForUser } from './workspace-repository';
import type { FeatureDataCounts } from '@/lib/domain/features/warnings';

/**
 * Ce que la ferme a enregistré, compté pour l'avertissement avant de décocher
 * une case (docs/feature-selection-contract.md, R2). Une lecture seule, sans
 * rien créer : une ferme sans espace d'irrigation n'a rien enregistré. Les
 * comptes disent ce que la ferme reconnaît comme siens : un objectif par
 * périmètre, un plan par semaine, une alerte non supprimée.
 */

const COUNTS = {
  equipment: `SELECT COUNT(*) FROM irrigation_equipment WHERE workspace_id = ? AND status = 'active'`,
  irrigationEvents: `SELECT COUNT(*) FROM irrigation_events WHERE workspace_id = ? AND status != 'canceled'`,
  // Les objectifs se recopient de semaine en semaine : on compte les périmètres qui en ont reçu un.
  goals: `SELECT COUNT(DISTINCT scope_type || ':' || IFNULL(otf_zone_id, '') || ':' || IFNULL(otf_plot_id, '') || ':' || IFNULL(otf_bed_id, ''))
          FROM irrigation_hydric_goal_revisions WHERE workspace_id = ? AND action = 'set' AND amount_mm IS NOT NULL`,
  rainMeasures: `SELECT COUNT(*) FROM irrigation_weather_daily_values WHERE workspace_id = ? AND data_kind = 'manual_precipitation'`,
  // Un plan recalculé reste le plan de sa semaine.
  plans: `SELECT COUNT(DISTINCT season || ':' || week_start) FROM irrigation_plan_calculations WHERE workspace_id = ?`,
  // Un créneau supprimé ne compte plus : la suppression est logique, son journal reste (3.8 ter).
  protectedSlots: `SELECT COUNT(*) FROM irrigation_protected_slots WHERE workspace_id = ? AND status = 'active'`,
  resources: `SELECT COUNT(*) FROM irrigation_water_resources WHERE workspace_id = ?`,
  pumps: `SELECT COUNT(*) FROM irrigation_pumps WHERE workspace_id = ? AND status = 'active'`,
  soilRecords: `SELECT (SELECT COUNT(*) FROM irrigation_soil_records WHERE workspace_id = ?)
                     + (SELECT COUNT(*) FROM irrigation_soil_observations WHERE workspace_id = ?)`,
  cropSettings: `SELECT (SELECT COUNT(*) FROM irrigation_crop_species_links WHERE workspace_id = ?)
                      + (SELECT COUNT(*) FROM irrigation_crop_kc_overrides WHERE workspace_id = ?)
                      + (SELECT COUNT(*) FROM irrigation_soil_rooting_profiles WHERE workspace_id = ?)`,
  weatherAlertCriteria: `SELECT COUNT(*) FROM irrigation_weather_alert_criteria WHERE workspace_id = ? AND deleted_at IS NULL`,
  // Les réglages des alertes cultures sont versionnés : leur présence compte pour un, plus chaque seuil de gel propre à la ferme.
  cropAlertSettings: `SELECT (SELECT CASE WHEN EXISTS (SELECT 1 FROM irrigation_crop_alert_settings WHERE workspace_id = ?) THEN 1 ELSE 0 END)
                           + (SELECT COUNT(*) FROM irrigation_crop_frost_links WHERE workspace_id = ?)`,
  settingCalculations: `SELECT COUNT(*) FROM irrigation_equipment_setting_calculations WHERE workspace_id = ?`,
} as const satisfies Record<keyof Required<FeatureDataCounts>, string>;

export async function countFeatureDataForUser(ownerUserId: string): Promise<FeatureDataCounts> {
  const workspaceId = await findWorkspaceIdForUser(ownerUserId);
  if (workspaceId === null) return {};
  const keys = Object.keys(COUNTS) as (keyof typeof COUNTS)[];
  const results = await db.batch<{ count: number }>(
    // Chaque « ? » reçoit l'espace : des paramètres numérotés (« ?1 ») ne se lient pas partout de la même façon.
    keys.map((key) => db.prepare(`SELECT (${COUNTS[key]}) AS count`).bind(...placeholdersOf(COUNTS[key]).map(() => workspaceId))),
  );
  const counts: FeatureDataCounts = {};
  keys.forEach((key, index) => {
    counts[key] = Number(results[index]?.results[0]?.count ?? 0);
  });
  return counts;
}

function placeholdersOf(query: string): string[] {
  return query.match(/\?/g) ?? [];
}
