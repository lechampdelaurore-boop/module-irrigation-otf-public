/**
 * Le plan d'effacement d'un espace (4.5, PR 3 ; docs/tranche-4-contract.md,
 * F563, et 10 bis.17, F641 à F643).
 *
 * Trois listes, relues en revue, couvrent chaque table de la base :
 *
 * 1. `SPACE_TABLES` : les tables d'un espace, **les dépendantes d'abord**,
 *    pour que chaque effacement trouve ses lignes filles déjà parties (D1
 *    garde les clés étrangères actives). Une table sans `workspace_id` prend
 *    l'espace de la ligne qu'elle complète (`via`), comme le contrôle de
 *    cohérence des espaces (F380).
 * 2. `FARM_TABLES` : les tables communes qui gardent des lignes d'une ferme
 *    ou d'un espace (instantanés, raccordement et jetons, journal des appels)
 *    et la règle qui dit lesquelles partent.
 * 3. `KEPT_TABLES` : les tables qui restent, chacune avec sa raison.
 *
 * `tests/farm-erasure-plan.test.ts` lit la base migrée et échoue si une
 * table n'est dans aucune liste, si elle est dans deux, ou si l'ordre laisse
 * une ligne fille derrière sa mère : une table ajoutée plus tard sans règle
 * d'effacement casse la CI (F563, preuve 1).
 */

export type SpaceTable = {
  table: string;
  /** La ligne que complète une table sans `workspace_id` : sa colonne, et la table de cette ligne. */
  via?: { column: string; parent: string };
};

/** Les tables d'un espace, les dépendantes d'abord ; l'espace lui-même (`irrigation_workspaces`) part en dernier, à part. */
export const SPACE_TABLES: readonly SpaceTable[] = [
  { table: 'sprinkler_profile_points', via: { column: 'setting_id', parent: 'irrigation_equipment_settings' } },
  { table: 'irrigation_weather_preferences' },
  { table: 'irrigation_weather_geocodes' },
  { table: 'irrigation_weather_daily_values' },
  { table: 'irrigation_weather_alerts' },
  { table: 'irrigation_weather_alert_criterion_versions', via: { column: 'criterion_id', parent: 'irrigation_weather_alert_criteria' } },
  { table: 'irrigation_weather_alert_criteria' },
  { table: 'irrigation_water_supply_defaults' },
  { table: 'irrigation_water_stock_movements' },
  { table: 'irrigation_water_resource_reservoir_links' },
  { table: 'irrigation_water_resource_limit_revisions' },
  { table: 'irrigation_water_resource_flow_revisions' },
  { table: 'irrigation_water_resource_meter_readings' },
  { table: 'irrigation_water_reservoir_links' },
  { table: 'irrigation_water_infrastructure_log' },
  { table: 'irrigation_soil_surface_declarations' },
  { table: 'irrigation_soil_settings' },
  { table: 'irrigation_soil_rooting_stages', via: { column: 'profile_id', parent: 'irrigation_soil_rooting_profiles' } },
  { table: 'irrigation_soil_rooting_profiles' },
  { table: 'irrigation_soil_records' },
  { table: 'irrigation_soil_observations' },
  { table: 'irrigation_soil_days' },
  { table: 'irrigation_season_geometry' },
  { table: 'irrigation_pump_log' },
  { table: 'irrigation_protected_slots_log' },
  { table: 'irrigation_protected_slots' },
  { table: 'irrigation_planning_settings_log' },
  { table: 'irrigation_planning_settings' },
  { table: 'irrigation_plan_suggestion_keeps' },
  { table: 'irrigation_plan_proposals' },
  { table: 'irrigation_plan_events' },
  { table: 'irrigation_plan_calculations' },
  { table: 'irrigation_placement_selected_beds', via: { column: 'placement_id', parent: 'irrigation_equipment_placements' } },
  { table: 'irrigation_need_preferences' },
  { table: 'irrigation_need_decision_log' },
  { table: 'irrigation_hydric_goal_revisions' },
  { table: 'irrigation_garden_group_members', via: { column: 'group_id', parent: 'irrigation_garden_groups' } },
  { table: 'irrigation_feature_selections' },
  { table: 'irrigation_event_log', via: { column: 'event_id', parent: 'irrigation_events' } },
  { table: 'irrigation_equipment_setting_calculations' },
  { table: 'irrigation_equipment_pump_defaults' },
  { table: 'irrigation_equipment_placement_history' },
  { table: 'irrigation_daily_water_limit_revisions' },
  { table: 'irrigation_crop_water_options' },
  { table: 'irrigation_crop_stage_declarations' },
  { table: 'irrigation_crop_species_links' },
  { table: 'irrigation_crop_shelter_factors' },
  { table: 'irrigation_crop_shade_nets' },
  { table: 'irrigation_crop_reference_stage_starts', via: { column: 'reference_id', parent: 'irrigation_crop_reference_crops' } },
  { table: 'irrigation_crop_reference_stages', via: { column: 'reference_id', parent: 'irrigation_crop_reference_crops' } },
  { table: 'irrigation_crop_reference_season_months', via: { column: 'reference_id', parent: 'irrigation_crop_reference_crops' } },
  { table: 'irrigation_crop_reference_seasons', via: { column: 'reference_id', parent: 'irrigation_crop_reference_crops' } },
  { table: 'irrigation_crop_reference_crops' },
  { table: 'irrigation_crop_kc_overrides' },
  { table: 'irrigation_crop_frost_links' },
  { table: 'irrigation_crop_etm_days' },
  { table: 'irrigation_crop_drying_revisions' },
  { table: 'irrigation_crop_bed_mulch' },
  { table: 'irrigation_crop_alerts' },
  { table: 'irrigation_crop_alert_settings' },
  { table: 'irrigation_bed_need_decisions' },
  { table: 'irrigation_bed_applications', via: { column: 'event_equipment_id', parent: 'irrigation_event_equipment' } },
  { table: 'irrigation_event_equipment', via: { column: 'event_id', parent: 'irrigation_events' } },
  { table: 'irrigation_pump_origins' },
  { table: 'irrigation_pumps' },
  { table: 'irrigation_water_resources' },
  { table: 'irrigation_water_reservoirs' },
  { table: 'irrigation_events' },
  { table: 'irrigation_equipment_placements' },
  { table: 'irrigation_garden_groups' },
  { table: 'irrigation_arbitrations' },
  { table: 'irrigation_arbitration_log' },
  { table: 'drip_setting_rates', via: { column: 'setting_id', parent: 'irrigation_equipment_settings' } },
  { table: 'irrigation_equipment_settings', via: { column: 'equipment_id', parent: 'irrigation_equipment' } },
  { table: 'irrigation_equipment' },
];

/** L'espace lui-même : il part en dernier, avec l'enregistrement de la demande qui passe à « faite », d'un bloc. */
export const SPACE_ROOT_TABLE = 'irrigation_workspaces';

/**
 * Qui, dans une table commune, appartient à l'espace effacé :
 * - `space-snapshots` : ses instantanés, sous sa clé d'espace (F643) ;
 * - `farm-connection` : le raccordement de sa ferme à Ouvre ta ferme et ses
 *   jetons, si la personne l'a fait, ou si aucun autre espace ne garde la ferme ;
 * - `farm-calls` : le journal des appels de sa ferme, et le journal d'accès
 *   du support à ses données (F660), quand aucun autre espace ne la garde
 *   (ils valent pour la ferme, pour tous ses espaces).
 */
export type FarmTableRule = 'space-snapshots' | 'farm-connection' | 'farm-calls';

export const FARM_TABLES: Readonly<Record<string, { rule: FarmTableRule; column: string }>> = {
  otf_snapshots: { rule: 'space-snapshots', column: 'cache_key' },
  otf_farm_connections: { rule: 'farm-connection', column: 'otf_farm_id' },
  otf_farm_reads: { rule: 'farm-calls', column: 'pace_key' },
  otf_call_starts: { rule: 'farm-calls', column: 'pace_key' },
  otf_daily_calls: { rule: 'farm-calls', column: 'pace_key' },
  otf_call_outcomes: { rule: 'farm-calls', column: 'pace_key' },
  otf_call_pauses: { rule: 'farm-calls', column: 'scope' },
  irrigation_support_accesses: { rule: 'farm-calls', column: 'otf_farm_id' },
};

/** Les tables qui restent après l'effacement d'un espace, chacune avec sa raison (F563 : « ce qui reste »). */
export const KEPT_TABLES: Readonly<Record<string, string>> = {
  irrigation_farm_erasures: 'L\'enregistrement minimal de la demande, qui prouve qu\'elle a été traitée : l\'identifiant interne de l\'espace, l\'état et des dates ; ni nom, ni personne, ni ferme, ni contenu.',
  irrigation_background_jobs: 'Les exécutions des tâches du module (le registre) : des heures, des nombres et des classes d\'erreur, communes à toutes les fermes.',
  irrigation_operator_notices: 'La notification du jour de la veille de l\'exploitant : un genre, un nombre et des heures.',
  irrigation_crop_alert_common: 'Les seuils de gel communs, les mêmes pour toutes les fermes : aucune ligne n\'est d\'une ferme.',
  otf_deployment_farm: 'La ferme de la clé du déploiement, un identifiant d\'Ouvre ta ferme et une heure : le réglage du déploiement, réécrit à chaque lecture, pas une donnée de la personne.',
  otf_authentication_failures: 'Les refus d\'authentification du module entier, quinze minutes : des heures seules, d\'aucune ferme.',
  irrigation_cost_readings: 'Le relevé des coûts du mois, copié du tableau de bord de Cloudflare : des nombres du déploiement, d\'aucune ferme.',
};

/**
 * La condition SQL qui retient les lignes de l'espace dans une table de
 * `SPACE_TABLES`, avec un seul paramètre : l'identifiant de l'espace. Les
 * lignes communes (`workspace_id` nul : cultures et profils racinaires de
 * référence) ne sont jamais retenues.
 */
export function spaceRowsCondition(table: string): string {
  const step = SPACE_TABLES.find((candidate) => candidate.table === table);
  if (!step) throw new Error(`Table absente du plan d'effacement : ${table}`);
  if (!step.via) return 'workspace_id = ?';
  return `"${step.via.column}" IN (SELECT id FROM "${step.via.parent}" WHERE ${spaceRowsCondition(step.via.parent)})`;
}
