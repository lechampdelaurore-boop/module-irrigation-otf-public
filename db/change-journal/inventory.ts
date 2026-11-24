import type { ChangeSubject } from '@/lib/domain/change-journal/subjects';

/**
 * L'inventaire du journal des modifications (amélioration n° 7,
 * docs/ameliorations-6-2-3-7-contract.md, §5.4 ; D-285, F717).
 *
 * Le piège de ce chantier est le changement qui ne passe pas par le journal.
 * Deux listes, relues en revue et tenues par
 * `tests/change-journal-inventory.test.ts`, comme le plan d'effacement
 * (F563) :
 *
 * 1. **Chaque table de la base** est rangée une fois : une table d'objectifs,
 *    de réglages ou de matériel (`JOURNAL_TABLES`, avec ses sujets), ou une
 *    table hors du journal (`OUTSIDE_JOURNAL`, avec sa raison). Une table
 *    ajoutée plus tard sans être rangée fait échouer le test.
 * 2. **Chaque endroit du code qui écrit** dans une table du journal
 *    (`JOURNAL_WRITE_SITES`, « fichier › fonction › table ») est « branché »
 *    sur le journal, sous son sujet, ou « sans objet » avec sa raison. Le
 *    test relit le code : un écrivain nouveau, absent de la liste, le fait
 *    échouer, et un écrivain branché doit nommer son sujet dans son code
 *    (F720).
 */

/** Les tables d'objectifs, de réglages et de matériel, avec les sujets que leurs écrivains portent au journal. */
export const JOURNAL_TABLES: Readonly<Record<string, readonly ChangeSubject[]>> = {
  // Objectifs.
  irrigation_hydric_goal_revisions: ['objectif-hydrique', 'objectif-adopte'],
  irrigation_automatic_objective_revisions: ['objectif-automatique'],
  irrigation_need_preferences: ['seuil-de-besoin'],
  irrigation_bed_need_decisions: ['decision-de-planche'],
  // Réglages.
  irrigation_planning_settings: ['reglages-du-planning'],
  irrigation_protected_slots: ['creneau-protege'],
  irrigation_daily_water_limit_revisions: ['limite-d-eau-du-jour'],
  irrigation_water_resource_limit_revisions: ['limite-de-ressource'],
  irrigation_soil_records: ['sol-de-parcelle'],
  irrigation_soil_settings: ['reglages-du-sol'],
  irrigation_soil_rooting_profiles: ['profil-racinaire'],
  irrigation_soil_rooting_stages: ['profil-racinaire'],
  irrigation_weather_alert_criteria: ['critere-meteo'],
  irrigation_weather_alert_criterion_versions: ['critere-meteo'],
  irrigation_crop_alert_settings: ['alertes-de-culture'],
  irrigation_crop_frost_links: ['seuil-de-gel'],
  irrigation_crop_drying_revisions: ['jours-de-sechage'],
  irrigation_crop_sensitive_stages: ['stade-sensible'],
  irrigation_feature_selections: ['fonctionnalites'],
  irrigation_phone_notice_settings: ['message-du-matin', 'rappel-du-soir'],
  // Réglages que la liste du contrat ne nommait pas, au journal depuis D-289 (F718).
  irrigation_crop_kc_overrides: ['kc-corrige'],
  irrigation_crop_reference_crops: ['culture-de-reference'],
  irrigation_crop_reference_seasons: ['culture-de-reference'],
  irrigation_crop_reference_season_months: ['culture-de-reference'],
  irrigation_crop_reference_stages: ['culture-de-reference'],
  irrigation_crop_reference_stage_starts: ['culture-de-reference'],
  irrigation_crop_species_links: ['correspondance-d-espece'],
  irrigation_crop_shelter_factors: ['k-abri'],
  irrigation_crop_bed_mulch: ['paillage-plastique'],
  irrigation_crop_shade_nets: ['filet-d-ombrage'],
  irrigation_crop_water_options: ['options-du-besoin'],
  irrigation_plot_shelters: ['jardin-sous-abri'],
  irrigation_garden_groups: ['groupe-de-jardins'],
  irrigation_garden_group_members: ['groupe-de-jardins'],
  irrigation_weather_preferences: ['lieu-meteo'],
  // Matériel et ressources.
  irrigation_equipment: ['materiel'],
  irrigation_equipment_settings: ['reglage-de-materiel'],
  drip_setting_rates: ['reglage-de-materiel'],
  sprinkler_profile_points: ['reglage-de-materiel'],
  irrigation_pumps: ['pompe'],
  irrigation_pump_origins: ['pompe'],
  irrigation_equipment_pump_defaults: ['pompe-par-defaut'],
  irrigation_water_resources: ['ressource'],
  irrigation_water_reservoirs: ['reserve'],
  irrigation_water_resource_reservoir_links: ['liaison-ressource-reserve'],
  irrigation_water_reservoir_links: ['liaison-entre-reserves'],
  irrigation_water_supply_defaults: ['alimentation-par-defaut'],
  irrigation_equipment_placements: ['pose'],
  irrigation_placement_selected_beds: ['pose'],
};

const IRRIGATION = 'Une irrigation et ce qui la compose : un fait immuable (D-006), déjà tracé par son propre journal ; le contrat la laisse hors du journal général (§5.1).';
const OBSERVATION = 'Une observation ou une mesure du maraîcher, pas un réglage : le contrat la laisse hors du journal (§5.1).';
const CALCULATION = 'Un calcul du module ou ce qu’il produit, refait à chaque passage : le contrat le laisse hors du journal (§5.1).';
const WEATHER = 'Une synchronisation météo et ce qu’elle garde : le contrat la laisse hors du journal (§5.1).';
const DOMAIN_LOG = 'Un journal de domaine, écrit en même temps que le réglage qu’il garde et inchangé : le journal général s’écrit en plus, il ne le relit pas (F706).';
const OTF = 'Une lecture d’Ouvre ta ferme, son raccordement ou son rythme : des copies et des compteurs, aucun geste du maraîcher sur ses réglages.';
const COMMON = 'Une table de l’exploitant du service ou commune à toutes les fermes : le contrat laisse ses actes hors du journal (§5.1).';

/** Les tables hors du journal, chacune avec sa raison. */
export const OUTSIDE_JOURNAL: Readonly<Record<string, string>> = {
  irrigation_change_journal: 'Le journal lui-même : ses lignes ne se modifient jamais ni ne s’effacent, sauf avec la ferme.',
  irrigation_workspaces: 'L’espace lui-même : son identité et ses compteurs de révision, que le module tient.',
  irrigation_farm_erasures: 'La demande d’effacement de la ferme et son traitement : un acte sur l’espace entier, qui part avec lui.',
  irrigation_onboarding_steps: 'L’avancement de l’accueil (4.4) : des étapes confirmées ; les réglages que l’accueil fait passent par leurs propres écrivains.',
  irrigation_phone_notices: 'La prise du jour d’un message du téléphone : un envoi, pas un réglage ; le réglage des messages est au journal.',
  // Irrigations.
  irrigation_events: IRRIGATION,
  irrigation_event_equipment: IRRIGATION,
  irrigation_event_log: IRRIGATION,
  irrigation_bed_applications: IRRIGATION,
  // Observations et mesures.
  irrigation_soil_observations: OBSERVATION,
  irrigation_soil_surface_declarations: OBSERVATION,
  irrigation_crop_stage_declarations: OBSERVATION,
  irrigation_water_resource_meter_readings: OBSERVATION,
  irrigation_water_resource_flow_revisions: `${OBSERVATION} Son effet sur le débit nominal de la ressource est, lui, au journal.`,
  irrigation_water_stock_movements: OBSERVATION,
  // Calculs.
  irrigation_plan_calculations: CALCULATION,
  irrigation_plan_proposals: 'Une proposition du planning et la décision du maraîcher sur elle : validée, elle devient une irrigation, tracée par son journal ; refusée, elle reste au plan. Pas un réglage (§5.1).',
  irrigation_plan_events: 'Les événements qui demandent un recalcul (3.7) : des faits que le module relève, pas un réglage.',
  irrigation_plan_suggestion_keeps: 'Une suggestion du planning laissée telle quelle : une décision sur le plan de la semaine, pas un réglage.',
  irrigation_arbitrations: 'Un arbitrage de pénurie : une décision sur le plan de la semaine, gardée par son propre journal, pas un réglage.',
  irrigation_arbitration_log: DOMAIN_LOG,
  irrigation_crop_etm_days: CALCULATION,
  irrigation_crop_alerts: CALCULATION,
  irrigation_weather_alerts: CALCULATION,
  irrigation_soil_days: CALCULATION,
  irrigation_equipment_setting_calculations: 'La provenance d’un réglage de matériel (calculateur ou mesure), écrite avec lui : la ligne du réglage garde ses valeurs.',
  // Météo.
  irrigation_weather_daily_values: `${WEATHER} La pluie mesurée y est aussi : une observation.`,
  irrigation_weather_forecast_archive: `${WEATHER} L’archive des prévisions J+1 à J+7, jamais écrasée (D-297).`,
  irrigation_weather_geocodes: WEATHER,
  // Journaux de domaine.
  irrigation_planning_settings_log: DOMAIN_LOG,
  irrigation_protected_slots_log: DOMAIN_LOG,
  irrigation_pump_log: DOMAIN_LOG,
  irrigation_water_infrastructure_log: DOMAIN_LOG,
  irrigation_need_decision_log: DOMAIN_LOG,
  irrigation_equipment_placement_history: `${DOMAIN_LOG} Le registre des poses (2.11) garde chaque période posée.`,
  irrigation_season_geometry: 'Le repère d’une saison des groupes de jardins (créée, ou copiée de la saison d’avant) : un état que le module tient, pas un réglage ; les groupes eux-mêmes sont au journal (D-289).',
  // Tables communes, de l'exploitant, et lectures d'Ouvre ta ferme.
  irrigation_background_jobs: COMMON,
  irrigation_operator_notices: COMMON,
  irrigation_crop_alert_common: COMMON,
  irrigation_crop_sensitive_stage_common: `${COMMON} La liste préremplie des stades sensibles, que seule une migration écrit.`,
  irrigation_support_accesses: COMMON,
  irrigation_cost_readings: COMMON,
  otf_snapshots: OTF,
  otf_farm_connections: OTF,
  otf_farm_reads: OTF,
  otf_call_starts: OTF,
  otf_call_outcomes: OTF,
  otf_daily_calls: OTF,
  otf_call_pauses: OTF,
  otf_authentication_failures: OTF,
  otf_deployment_farm: OTF,
};

/**
 * Ce que fait un écrivain d'une table du journal :
 * - `branche` : il écrit sa ligne du journal, dans le même lot, sous ce sujet ;
 * - `sans-objet` : il n'a rien à y écrire, pour la raison dite.
 */
export type WriteSiteStatus =
  | { status: 'branche'; subject: ChangeSubject }
  | { status: 'sans-objet'; reason: string };

const branche = (subject: ChangeSubject) => ({ status: 'branche', subject }) as const;
const sansObjet = (reason: string) => ({ status: 'sans-objet', reason }) as const;

/** Une table fille, écrite par la même fonction que sa mère : la ligne de la mère dit son changement. */
const CHILD_OF = (parent: string) => sansObjet(`Table fille, écrite dans le même lot que ${parent} : la ligne de journal de la mère porte son changement.`);

const WEATHER_SYNC = sansObjet('L’état d’une synchronisation météo (tentative, réussite, erreur, attente) : le module le tient, ce n’est pas un réglage (§5.1).');
const GROUPS_CARRIED = sansObjet('Les groupes de la saison d’avant reportés sur une saison neuve, par le module, à la première lecture : les mêmes groupes, aucun geste.');

/**
 * Chaque endroit qui écrit dans une table du journal, « fichier › fonction ›
 * table » : la fonction est la fonction de premier niveau du fichier qui
 * contient l'instruction.
 */
export const JOURNAL_WRITE_SITES: Readonly<Record<string, WriteSiteStatus>> = {
  // Objectifs.
  'db/water-management-repository.ts › saveHydricGoalForUser › irrigation_hydric_goal_revisions': branche('objectif-hydrique'),
  'db/water-management-repository.ts › clearHydricGoalsForUser › irrigation_hydric_goal_revisions': branche('objectif-hydrique'),
  'db/water-management-repository.ts › ensureRecurringHydricGoalsForUser › irrigation_hydric_goal_revisions': sansObjet('Le report des objectifs de la semaine d’avant sur une semaine neuve, par le module : les mêmes valeurs, aucun geste ni changement.'),
  'db/crop-water/adoptions.ts › saveAdoptedGoalForUser › irrigation_hydric_goal_revisions': branche('objectif-adopte'),
  'db/automatic-objective-repository.ts › saveAutomaticObjectiveForUser › irrigation_automatic_objective_revisions': branche('objectif-automatique'),
  'db/irrigation-need-repository.ts › saveIrrigationNeedThresholdForUser › irrigation_need_preferences': branche('seuil-de-besoin'),
  'db/irrigation-need-repository.ts › saveIrrigationBedNeedDecisionForUser › irrigation_bed_need_decisions': branche('decision-de-planche'),
  // Réglages.
  'db/planning-repository.ts › savePlanningSettingsForUser › irrigation_planning_settings': branche('reglages-du-planning'),
  'db/protected-slots-repository.ts › createProtectedSlotForUser › irrigation_protected_slots': branche('creneau-protege'),
  'db/protected-slots-repository.ts › updateProtectedSlotForUser › irrigation_protected_slots': branche('creneau-protege'),
  'db/protected-slots-repository.ts › deleteProtectedSlotForUser › irrigation_protected_slots': branche('creneau-protege'),
  'db/water-management-repository.ts › saveDailyWaterLimitForUser › irrigation_daily_water_limit_revisions': branche('limite-d-eau-du-jour'),
  'db/water-resource-repository.ts › saveWaterResourceLimitForUser › irrigation_water_resource_limit_revisions': branche('limite-de-ressource'),
  'db/soil-reserve/entries.ts › addSoilRecordForUser › irrigation_soil_records': branche('sol-de-parcelle'),
  'db/soil-reserve/entries.ts › addSoilSettingsForUser › irrigation_soil_settings': branche('reglages-du-sol'),
  'db/soil-reserve/entries.ts › addRootingProfileForUser › irrigation_soil_rooting_profiles': branche('profil-racinaire'),
  'db/soil-reserve/entries.ts › addRootingProfileForUser › irrigation_soil_rooting_stages': CHILD_OF('irrigation_soil_rooting_profiles'),
  'db/weather-alert-repository.ts › createWeatherAlertCriterionForUser › irrigation_weather_alert_criteria': branche('critere-meteo'),
  'db/weather-alert-repository.ts › updateWeatherAlertCriterionForUser › irrigation_weather_alert_criteria': branche('critere-meteo'),
  'db/weather-alert-repository.ts › deleteWeatherAlertCriterionForUser › irrigation_weather_alert_criteria': branche('critere-meteo'),
  'db/weather-alert-repository.ts › versionStatement › irrigation_weather_alert_criterion_versions': CHILD_OF('irrigation_weather_alert_criteria'),
  'db/crop-alerts/inputs.ts › saveCropAlertSettingsForUser › irrigation_crop_alert_settings': branche('alertes-de-culture'),
  'db/crop-alerts/inputs.ts › saveFrostLinkForUser › irrigation_crop_frost_links': branche('seuil-de-gel'),
  'db/crop-alerts/inputs.ts › saveDryingDaysForUser › irrigation_crop_drying_revisions': branche('jours-de-sechage'),
  'db/crop-water/sensitive-stages.ts › saveSensitiveStagesForUser › irrigation_crop_sensitive_stages': branche('stade-sensible'),
  'db/feature-selection-repository.ts › saveFeatureSelectionForUser › irrigation_feature_selections': branche('fonctionnalites'),
  'db/feature-selection-repository.ts › dismissFeatureBannerForUser › irrigation_feature_selections': sansObjet('Le bandeau des fonctionnalités fermé : ni case cochée ni décochée.'),
  'db/phone-notice-repository.ts › saveMorningMessageForUser › irrigation_phone_notice_settings': branche('message-du-matin'),
  'db/phone-notice-repository.ts › saveEveningReminderForUser › irrigation_phone_notice_settings': branche('rappel-du-soir'),
  // Matériel et ressources.
  'db/equipment/equipment.ts › createEquipmentForUser › irrigation_equipment': branche('materiel'),
  'db/equipment/equipment.ts › updateEquipmentForUser › irrigation_equipment': branche('materiel'),
  'db/equipment/equipment.ts › setEquipmentArchivedForUser › irrigation_equipment': branche('materiel'),
  'db/equipment/equipment.ts › deleteEquipmentForUser › irrigation_equipment': branche('materiel'),
  'db/equipment/equipment.ts › deleteEquipmentForUser › irrigation_equipment_settings': CHILD_OF('irrigation_equipment'),
  'db/equipment/equipment.ts › deleteEquipmentForUser › irrigation_equipment_placements': CHILD_OF('irrigation_equipment'),
  'db/equipment/equipment.ts › deleteEquipmentForUser › irrigation_placement_selected_beds': CHILD_OF('irrigation_equipment'),
  'db/equipment/duplication.ts › duplicateEquipmentForUser › irrigation_equipment': branche('materiel'),
  'db/equipment/duplication.ts › duplicateEquipmentForUser › irrigation_equipment_settings': branche('reglage-de-materiel'),
  'db/equipment/duplication.ts › duplicateEquipmentForUser › drip_setting_rates': CHILD_OF('irrigation_equipment_settings'),
  'db/equipment/duplication.ts › duplicateEquipmentForUser › sprinkler_profile_points': CHILD_OF('irrigation_equipment_settings'),
  'db/equipment/settings.ts › saveEquipmentSettingForUser › irrigation_equipment_settings': branche('reglage-de-materiel'),
  'db/equipment/settings.ts › saveEquipmentSettingForUser › drip_setting_rates': CHILD_OF('irrigation_equipment_settings'),
  'db/equipment/settings.ts › saveEquipmentSettingForUser › sprinkler_profile_points': CHILD_OF('irrigation_equipment_settings'),
  'db/equipment/settings.ts › deleteEquipmentSettingForUser › irrigation_equipment_settings': branche('reglage-de-materiel'),
  'db/equipment/settings.ts › deleteEquipmentSettingForUser › drip_setting_rates': CHILD_OF('irrigation_equipment_settings'),
  'db/equipment/settings.ts › deleteEquipmentSettingForUser › sprinkler_profile_points': CHILD_OF('irrigation_equipment_settings'),
  'db/equipment/settings.ts › deleteEquipmentSettingForUser › irrigation_equipment_placements': CHILD_OF('irrigation_equipment_settings'),
  'db/equipment/settings.ts › deleteEquipmentSettingForUser › irrigation_placement_selected_beds': CHILD_OF('irrigation_equipment_settings'),
  'db/pump-repository.ts › savePumpForUser › irrigation_pumps': branche('pompe'),
  'db/pump-repository.ts › savePumpForUser › irrigation_pump_origins': CHILD_OF('irrigation_pumps'),
  'db/pump-repository.ts › setPumpArchivedForUser › irrigation_pumps': branche('pompe'),
  'db/pump-repository.ts › saveEquipmentDefaultPumpForUser › irrigation_equipment_pump_defaults': branche('pompe-par-defaut'),
  'db/water-resource-repository.ts › saveWaterResourceForUser › irrigation_water_resources': branche('ressource'),
  'db/water-resource-flow-repository.ts › applyResourceFlowForUser › irrigation_water_resources': branche('ressource'),
  'db/water-resource-repository.ts › saveWaterReservoirForUser › irrigation_water_reservoirs': branche('reserve'),
  'db/water-resource-repository.ts › correctWaterReservoirVolumeForUser › irrigation_water_reservoirs': sansObjet('Le volume observé d’une réserve : une mesure, gardée avec son mouvement de stock (§5.1), pas un réglage.'),
  'db/water-resource-repository.ts › saveResourceReservoirLinkForUser › irrigation_water_resource_reservoir_links': branche('liaison-ressource-reserve'),
  'db/water-resource-repository.ts › saveReservoirLinkForUser › irrigation_water_reservoir_links': branche('liaison-entre-reserves'),
  'db/water-resource-repository.ts › saveDefaultWaterSupplyForUser › irrigation_water_supply_defaults': branche('alimentation-par-defaut'),
  'db/equipment-placement-repository.ts › saveEquipmentPlacementForUser › irrigation_equipment_placements': branche('pose'),
  'db/equipment-placement-repository.ts › saveEquipmentPlacementForUser › irrigation_placement_selected_beds': CHILD_OF('irrigation_equipment_placements'),
  'db/equipment-placement-repository.ts › updateEquipmentPlacementSettingForUser › irrigation_equipment_placements': branche('pose'),
  'db/equipment-placement-repository.ts › removeEquipmentPlacementForUser › irrigation_equipment_placements': branche('pose'),
  'db/garden-group-repository.ts › deleteGardenGroupForUser › irrigation_equipment_placements': sansObjet('Une pose détachée du groupe de jardins qu’on supprime : la conséquence d’un geste sur les groupes, que la ligne du groupe supprimé dit (D-289) ; la pose elle-même ne change pas.'),
  // Réglages que la liste du contrat ne nommait pas (F718 ; D-289).
  'db/crop-water/entries.ts › addKcOverrideForUser › irrigation_crop_kc_overrides': branche('kc-corrige'),
  'db/crop-water/references.ts › saveFarmReferenceCropForUser › irrigation_crop_reference_crops': branche('culture-de-reference'),
  'db/crop-water/references.ts › deleteFarmReferenceCropForUser › irrigation_crop_reference_crops': branche('culture-de-reference'),
  'db/crop-water/references.ts › partStatements › irrigation_crop_reference_stages': CHILD_OF('irrigation_crop_reference_crops'),
  'db/crop-water/references.ts › partStatements › irrigation_crop_reference_seasons': CHILD_OF('irrigation_crop_reference_crops'),
  'db/crop-water/references.ts › partStatements › irrigation_crop_reference_season_months': CHILD_OF('irrigation_crop_reference_crops'),
  'db/crop-water/references.ts › partStatements › irrigation_crop_reference_stage_starts': CHILD_OF('irrigation_crop_reference_crops'),
  'db/crop-water/entries.ts › linkStatements › irrigation_crop_species_links': branche('correspondance-d-espece'),
  'db/crop-water/entries.ts › deleteSpeciesCorrespondenceForUser › irrigation_crop_species_links': branche('correspondance-d-espece'),
  'db/crop-water/settings.ts › addShelterFactorForUser › irrigation_crop_shelter_factors': branche('k-abri'),
  'db/crop-water/settings.ts › saveBedMulchForUser › irrigation_crop_bed_mulch': branche('paillage-plastique'),
  'db/crop-water/settings.ts › addShadeNetForUser › irrigation_crop_shade_nets': branche('filet-d-ombrage'),
  'db/crop-water/settings.ts › removeShadeNetForUser › irrigation_crop_shade_nets': branche('filet-d-ombrage'),
  'db/crop-water/settings.ts › saveCropWaterOptionsForUser › irrigation_crop_water_options': branche('options-du-besoin'),
  'db/plot-shelter-repository.ts › savePlotSheltersForUser › irrigation_plot_shelters': branche('jardin-sous-abri'),
  'db/garden-group-repository.ts › saveGardenGroupForUser › irrigation_garden_groups': branche('groupe-de-jardins'),
  'db/garden-group-repository.ts › saveGardenGroupForUser › irrigation_garden_group_members': CHILD_OF('irrigation_garden_groups'),
  'db/garden-group-repository.ts › deleteGardenGroupForUser › irrigation_garden_groups': branche('groupe-de-jardins'),
  'db/garden-group-repository.ts › deleteGardenGroupForUser › irrigation_garden_group_members': CHILD_OF('irrigation_garden_groups'),
  'db/garden-group-repository.ts › listGardenGroupConfigurationForUser › irrigation_garden_groups': GROUPS_CARRIED,
  'db/garden-group-repository.ts › listGardenGroupConfigurationForUser › irrigation_garden_group_members': GROUPS_CARRIED,
  'db/water-management-repository.ts › saveWeatherPreferenceForUser › irrigation_weather_preferences': branche('lieu-meteo'),
  'db/water-management-repository.ts › recordWeatherRefreshForUser › irrigation_weather_preferences': WEATHER_SYNC,
  'db/water-management-repository.ts › tryClaimWeatherRefreshForUser › irrigation_weather_preferences': WEATHER_SYNC,
  'db/automatic-weather-repository.ts › recordAutomaticWeatherWorkspaceResult › irrigation_weather_preferences': WEATHER_SYNC,
  'db/automatic-weather-repository.ts › recordIntradayWeatherWorkspaceResult › irrigation_weather_preferences': WEATHER_SYNC,
};
