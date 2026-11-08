-- Extension 5 ter : la réserve du sol, la persistance
-- (docs/soil-reserve-contract.md, « Découpage et preuve de fin », PR 2,
-- D-041, D-046, D-047, D-053, D-056, D-059, D-060).
--
-- 1. Le sol : par parcelle, et la valeur propre d'un jardin ou d'un abri
--    (`otf_plot_id` renseigné) ; RFU du laboratoire, cailloux, part de
--    référence, provenance, profondeur prélevée, source, TEW, REW, Ze et
--    plafond de sol. Chaque saisie est une révision datée, jamais modifiée ni
--    effacée (D-006) ; la plus récente vaut à partir de son jour. Aucune
--    valeur n'est écrite ici : chaque ferme saisit la sienne.
-- 2. Les profils racinaires : la part p et une profondeur par stade, fixe ou
--    progressive, par culture de référence. Le jeu commun (exploitation
--    nulle) est écrit ici avec sa source, valable depuis toujours
--    (`1900-01-01`) ; une ferme enregistre ses révisions datées, qui
--    remplacent la commune pour elle seule à partir de leur jour.
-- 3. Les états de surface déclarés d'une planche sans culture, datés.
-- 4. Les réglages de l'exploitation : seuil d'arrosage (D-059), coefficients
--    des états de surface et part de pluie sous paillage plastique,
--    révisions datées.
-- 5. Les observations du curseur, par parcelle (plein champ) ou par jardin
--    ou abri, horodatées.
-- 6. L'état du jour passé de chaque planche, recalculé et remplacé comme
--    l'ETM du jour : il garde De, la réserve profonde, le mode, la
--    profondeur de référence et la confiance.
--
-- Migration additive (docs/migrations-contract.md) : sept tables, leurs
-- index, douze déclencheurs d'immuabilité et les lignes du jeu commun ;
-- aucune table existante n'est touchée.
CREATE TABLE `irrigation_soil_records` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `otf_zone_id` text NOT NULL,
  `otf_plot_id` text,
  `lab_rfu_mm_per_meter` real NOT NULL,
  `stone_share_percent` real,
  `reference_share` real NOT NULL,
  `provenance` text NOT NULL,
  `sampled_depth_cm` real,
  `source` text NOT NULL,
  `tew_mm` real NOT NULL,
  `rew_mm` real NOT NULL,
  `surface_layer_cm` real NOT NULL,
  `soil_depth_ceiling_m` real,
  `effective_from` text NOT NULL,
  `recorded_at` text NOT NULL,
  `actor_user_id` text,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_soil_record_zone` CHECK (length(`otf_zone_id`) >= 1 AND (`otf_plot_id` IS NULL OR length(`otf_plot_id`) >= 1)),
  CONSTRAINT `chk_soil_record_rfu` CHECK (`lab_rfu_mm_per_meter` > 0),
  CONSTRAINT `chk_soil_record_stones` CHECK (`stone_share_percent` IS NULL OR (`stone_share_percent` >= 0 AND `stone_share_percent` <= 99)),
  CONSTRAINT `chk_soil_record_reference_share` CHECK (`reference_share` > 0 AND `reference_share` < 1),
  CONSTRAINT `chk_soil_record_provenance` CHECK (`provenance` IN ('analysis', 'estimate', 'default')),
  CONSTRAINT `chk_soil_record_sampled_depth` CHECK (`sampled_depth_cm` IS NULL OR `sampled_depth_cm` > 0),
  CONSTRAINT `chk_soil_record_source` CHECK (length(`source`) <= 500),
  CONSTRAINT `chk_soil_record_evaporation` CHECK (`tew_mm` > 0 AND `rew_mm` > 0 AND `rew_mm` < `tew_mm` AND `surface_layer_cm` > 0),
  CONSTRAINT `chk_soil_record_ceiling` CHECK (`soil_depth_ceiling_m` IS NULL OR `soil_depth_ceiling_m` > 0),
  CONSTRAINT `chk_soil_record_date` CHECK (`effective_from` GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]')
);
--> statement-breakpoint
CREATE INDEX `idx_soil_records_zone` ON `irrigation_soil_records` (`workspace_id`, `otf_zone_id`);
--> statement-breakpoint
CREATE TRIGGER `trg_soil_records_no_update` BEFORE UPDATE ON `irrigation_soil_records`
BEGIN
  SELECT RAISE(ABORT, 'SOIL_RECORD_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_soil_records_no_delete` BEFORE DELETE ON `irrigation_soil_records`
BEGIN
  SELECT RAISE(ABORT, 'SOIL_RECORD_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TABLE `irrigation_soil_rooting_profiles` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text,
  `crop_key` text NOT NULL,
  `p` real,
  `source` text NOT NULL,
  `note` text,
  `effective_from` text NOT NULL,
  `recorded_at` text NOT NULL,
  `actor_user_id` text,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_soil_rooting_key` CHECK (length(`crop_key`) BETWEEN 1 AND 80),
  CONSTRAINT `chk_soil_rooting_p` CHECK (`p` IS NULL OR (`p` > 0 AND `p` < 1)),
  CONSTRAINT `chk_soil_rooting_source` CHECK (length(`source`) BETWEEN 1 AND 500 AND (`note` IS NULL OR length(`note`) <= 500)),
  CONSTRAINT `chk_soil_rooting_date` CHECK (`effective_from` GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_soil_rooting_common_key` ON `irrigation_soil_rooting_profiles` (`crop_key`) WHERE `workspace_id` IS NULL;
--> statement-breakpoint
CREATE INDEX `idx_soil_rooting_farm` ON `irrigation_soil_rooting_profiles` (`workspace_id`, `crop_key`);
--> statement-breakpoint
CREATE TRIGGER `trg_soil_rooting_profiles_no_update` BEFORE UPDATE ON `irrigation_soil_rooting_profiles`
BEGIN
  SELECT RAISE(ABORT, 'SOIL_ROOTING_PROFILE_IMMUTABLE');
END;
--> statement-breakpoint
-- Le jeu commun appartient aux migrations : seules les révisions d'une ferme
-- sont gardées contre l'effacement, pour que l'import d'un export
-- (`scripts/import-d1-export.ts`) puisse vider puis réécrire la table.
CREATE TRIGGER `trg_soil_rooting_profiles_no_delete` BEFORE DELETE ON `irrigation_soil_rooting_profiles`
WHEN OLD.`workspace_id` IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'SOIL_ROOTING_PROFILE_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TABLE `irrigation_soil_rooting_stages` (
  `profile_id` text NOT NULL,
  `position` integer NOT NULL,
  `stage_rank` integer,
  `depth_m` real NOT NULL,
  `end_depth_m` real,
  `progression_days` integer,
  PRIMARY KEY (`profile_id`, `position`),
  FOREIGN KEY (`profile_id`) REFERENCES `irrigation_soil_rooting_profiles`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_soil_rooting_stage_position` CHECK (`position` >= 1),
  CONSTRAINT `chk_soil_rooting_stage_rank` CHECK (`stage_rank` IS NULL OR `stage_rank` >= 1),
  CONSTRAINT `chk_soil_rooting_stage_depth` CHECK (`depth_m` > 0 AND `depth_m` <= 3),
  CONSTRAINT `chk_soil_rooting_stage_progressive` CHECK (
    (`end_depth_m` IS NULL AND `progression_days` IS NULL)
    OR (`end_depth_m` IS NOT NULL AND `end_depth_m` > 0 AND `end_depth_m` <= 3
      AND `progression_days` IS NOT NULL AND `progression_days` >= 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_soil_rooting_stage_rank` ON `irrigation_soil_rooting_stages` (`profile_id`, coalesce(`stage_rank`, 0));
--> statement-breakpoint
CREATE TRIGGER `trg_soil_rooting_stages_no_update` BEFORE UPDATE ON `irrigation_soil_rooting_stages`
BEGIN
  SELECT RAISE(ABORT, 'SOIL_ROOTING_PROFILE_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_soil_rooting_stages_no_delete` BEFORE DELETE ON `irrigation_soil_rooting_stages`
WHEN (SELECT `workspace_id` FROM `irrigation_soil_rooting_profiles` WHERE `id` = OLD.`profile_id`) IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'SOIL_ROOTING_PROFILE_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TABLE `irrigation_soil_surface_declarations` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `otf_bed_id` text NOT NULL,
  `date` text NOT NULL,
  `state` text NOT NULL,
  `recorded_at` text NOT NULL,
  `actor_user_id` text,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_soil_surface_state` CHECK (`state` IN (
    'bare', 'impermeable-tarp', 'permeable-tarp', 'mulched', 'green-manure-emergence',
    'green-manure-partial', 'green-manure-full', 'green-manure-destroyed', 'grass')),
  CONSTRAINT `chk_soil_surface_date` CHECK (`date` GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]')
);
--> statement-breakpoint
CREATE INDEX `idx_soil_surface_declarations_bed` ON `irrigation_soil_surface_declarations` (`workspace_id`, `otf_bed_id`);
--> statement-breakpoint
CREATE TRIGGER `trg_soil_surface_declarations_no_update` BEFORE UPDATE ON `irrigation_soil_surface_declarations`
BEGIN
  SELECT RAISE(ABORT, 'SOIL_SURFACE_DECLARATION_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_soil_surface_declarations_no_delete` BEFORE DELETE ON `irrigation_soil_surface_declarations`
BEGIN
  SELECT RAISE(ABORT, 'SOIL_SURFACE_DECLARATION_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TABLE `irrigation_soil_settings` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `threshold_mode` text NOT NULL,
  `threshold_percent` integer,
  `permeable_tarp_evaporation` real NOT NULL,
  `mulched_evaporation` real NOT NULL,
  `green_manure_emergence_kc` real NOT NULL,
  `green_manure_partial_kc` real NOT NULL,
  `green_manure_full_kc` real NOT NULL,
  `grass_kc` real NOT NULL,
  `plastic_mulch_rain_share` real NOT NULL,
  `effective_from` text NOT NULL,
  `recorded_at` text NOT NULL,
  `actor_user_id` text,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_soil_settings_threshold` CHECK (
    (`threshold_mode` = 'crop' AND `threshold_percent` IS NULL)
    OR (`threshold_mode` = 'farm' AND `threshold_percent` BETWEEN 20 AND 80 AND `threshold_percent` % 5 = 0)),
  CONSTRAINT `chk_soil_settings_shares` CHECK (
    `permeable_tarp_evaporation` >= 0 AND `permeable_tarp_evaporation` <= 1
    AND `mulched_evaporation` >= 0 AND `mulched_evaporation` <= 1
    AND `plastic_mulch_rain_share` >= 0 AND `plastic_mulch_rain_share` <= 1),
  CONSTRAINT `chk_soil_settings_kc` CHECK (
    `green_manure_emergence_kc` >= 0 AND `green_manure_emergence_kc` <= 1.3
    AND `green_manure_partial_kc` >= 0 AND `green_manure_partial_kc` <= 1.3
    AND `green_manure_full_kc` >= 0 AND `green_manure_full_kc` <= 1.3
    AND `grass_kc` >= 0 AND `grass_kc` <= 1.3),
  CONSTRAINT `chk_soil_settings_date` CHECK (`effective_from` GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]')
);
--> statement-breakpoint
CREATE INDEX `idx_soil_settings_workspace` ON `irrigation_soil_settings` (`workspace_id`);
--> statement-breakpoint
CREATE TRIGGER `trg_soil_settings_no_update` BEFORE UPDATE ON `irrigation_soil_settings`
BEGIN
  SELECT RAISE(ABORT, 'SOIL_SETTINGS_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_soil_settings_no_delete` BEFORE DELETE ON `irrigation_soil_settings`
BEGIN
  SELECT RAISE(ABORT, 'SOIL_SETTINGS_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TABLE `irrigation_soil_observations` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `otf_zone_id` text NOT NULL,
  `otf_plot_id` text,
  `percent` real NOT NULL,
  `observed_at` text NOT NULL,
  `recorded_at` text NOT NULL,
  `actor_user_id` text,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_soil_observation_zone` CHECK (length(`otf_zone_id`) >= 1 AND (`otf_plot_id` IS NULL OR length(`otf_plot_id`) >= 1)),
  CONSTRAINT `chk_soil_observation_percent` CHECK (`percent` >= 0 AND `percent` <= 100)
);
--> statement-breakpoint
CREATE INDEX `idx_soil_observations_zone` ON `irrigation_soil_observations` (`workspace_id`, `otf_zone_id`, `observed_at`);
--> statement-breakpoint
CREATE TRIGGER `trg_soil_observations_no_update` BEFORE UPDATE ON `irrigation_soil_observations`
BEGIN
  SELECT RAISE(ABORT, 'SOIL_OBSERVATION_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_soil_observations_no_delete` BEFORE DELETE ON `irrigation_soil_observations`
BEGIN
  SELECT RAISE(ABORT, 'SOIL_OBSERVATION_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TABLE `irrigation_soil_days` (
  `workspace_id` text NOT NULL,
  `otf_bed_id` text NOT NULL,
  `date` text NOT NULL,
  `mode` text,
  `surface_state` text,
  `depth_m` real,
  `capacity_mm` real,
  `threshold_mm` real,
  `start_mm` real,
  `state_mm` real,
  `depletion_mm` real,
  `deep_mm` real,
  `rain_mm` real,
  `irrigation_mm` real DEFAULT 0 NOT NULL,
  `consumption_mm` real,
  `drainage_mm` real DEFAULT 0 NOT NULL,
  `restart` text,
  `unknown_kind` text,
  `unknown_date` text,
  `computed_at` text NOT NULL,
  PRIMARY KEY (`workspace_id`, `otf_bed_id`, `date`),
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_soil_day_mode` CHECK (`mode` IS NULL OR `mode` IN ('crop', 'bare', 'cover')),
  CONSTRAINT `chk_soil_day_restart` CHECK (`restart` IS NULL OR `restart` IN ('observation', 'inflow')),
  CONSTRAINT `chk_soil_day_unknown` CHECK (`unknown_kind` IS NULL OR `unknown_kind` IN (
    'no-soil', 'not-started', 'missing-rain', 'missing-et0', 'crop-without-etm', 'blocked')),
  CONSTRAINT `chk_soil_day_date` CHECK (`date` GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]')
);
--> statement-breakpoint
CREATE INDEX `idx_soil_days_date` ON `irrigation_soil_days` (`workspace_id`, `date`);
--> statement-breakpoint
-- Le jeu commun des profils racinaires (D-053, D-056) : p du tableau 22 de la
-- FAO-56 ; profondeurs construites par stade le 3 novembre 2026, à vérifier à
-- la tarière. Le céleri n'a pas de profondeur (30 cm proposés avec
-- avertissement) ; la patate douce n'a pas de profil (30 cm proposés, p 0,5).
INSERT INTO `irrigation_soil_rooting_profiles` (`id`, `workspace_id`, `crop_key`, `p`, `source`, `note`, `effective_from`, `recorded_at`)
VALUES
  ('soil-criiam-ail', NULL, 'criiam-ail', 0.3, 'Maximum : FAO 0,3-0,5 m. p : FAO-56, tableau 22. Construit par stade le 3 novembre 2026 (D-056), à vérifier à la tarière.', 'Source faible : à vérifier à la bêche.', '1900-01-01', '2026-11-03T00:00:00.000Z'),
  ('soil-criiam-artichaut-remontant', NULL, 'criiam-artichaut-remontant', 0.45, 'Maximum : FAO 0,6-0,9 m. p : FAO-56, tableau 22. Construit par stade le 3 novembre 2026 (D-056), à vérifier à la tarière.', 'À partir de la 2e année : 0,60 m à tous les stades. Source faible : à vérifier à la bêche.', '1900-01-01', '2026-11-03T00:00:00.000Z'),
  ('soil-criiam-artichaut-non-remontant', NULL, 'criiam-artichaut-non-remontant', 0.45, 'Maximum : FAO 0,6-0,9 m. p : FAO-56, tableau 22. Construit par stade le 3 novembre 2026 (D-056), à vérifier à la tarière.', 'À partir de la 2e année : 0,60 m à tous les stades. Source faible : à vérifier à la bêche.', '1900-01-01', '2026-11-03T00:00:00.000Z'),
  ('soil-criiam-asperge', NULL, 'criiam-asperge', 0.45, 'Maximum : plafond du porteur, 0,60 m (D-056). p : FAO-56, tableau 22.', 'Culture installée. FAO 1,2-1,8 m non retenue tant que la tarière ne la confirme pas.', '1900-01-01', '2026-11-03T00:00:00.000Z'),
  ('soil-criiam-aubergine', NULL, 'criiam-aubergine', 0.45, 'Maximum : ITAB tomate-poivron par analogie (FAO 0,7-1,2 m). p : FAO-56, tableau 22. Construit par stade le 3 novembre 2026 (D-056), à vérifier à la tarière.', 'Source faible : à vérifier à la bêche.', '1900-01-01', '2026-11-03T00:00:00.000Z'),
  ('soil-criiam-betterave', NULL, 'criiam-betterave', 0.5, 'Maximum : ITAB 60-80 cm. p : FAO-56, tableau 22. Construit par stade le 3 novembre 2026 (D-056), à vérifier à la tarière.', NULL, '1900-01-01', '2026-11-03T00:00:00.000Z'),
  ('soil-criiam-carotte', NULL, 'criiam-carotte', 0.35, 'Maximum : ITAB 60-80 cm. p : FAO-56, tableau 22. Construit par stade le 3 novembre 2026 (D-056), à vérifier à la tarière.', NULL, '1900-01-01', '2026-11-03T00:00:00.000Z'),
  ('soil-criiam-chou-fleur', NULL, 'criiam-chou-fleur', 0.45, 'Maximum : FAO 0,4-0,7 m. p : FAO-56, tableau 22. Construit par stade le 3 novembre 2026 (D-056), à vérifier à la tarière.', NULL, '1900-01-01', '2026-11-03T00:00:00.000Z'),
  ('soil-criiam-courgette', NULL, 'criiam-courgette', 0.5, 'Maximum : ITAB 40-60 cm. p : FAO-56, tableau 22. Construit par stade le 3 novembre 2026 (D-056), à vérifier à la tarière.', NULL, '1900-01-01', '2026-11-03T00:00:00.000Z'),
  ('soil-criiam-fraisier', NULL, 'criiam-fraisier', 0.2, 'Maximum : FAO 0,2-0,3 m. p : FAO-56, tableau 22. Construit par stade le 3 novembre 2026 (D-056), à vérifier à la tarière.', 'Culture installée. Année de plantation : 0,15 m au stade 1, à saisir par une révision de la ferme.', '1900-01-01', '2026-11-03T00:00:00.000Z'),
  ('soil-criiam-fraisier-remontant', NULL, 'criiam-fraisier-remontant', 0.2, 'Maximum : FAO 0,2-0,3 m. p : FAO-56, tableau 22. Construit par stade le 3 novembre 2026 (D-056), à vérifier à la tarière.', 'Culture installée. Année de plantation : 0,15 m au stade 1, à saisir par une révision de la ferme.', '1900-01-01', '2026-11-03T00:00:00.000Z'),
  ('soil-criiam-haricot', NULL, 'criiam-haricot', 0.45, 'Maximum : FAO 0,5-0,7 m. p : FAO-56, tableau 22. Construit par stade le 3 novembre 2026 (D-056), à vérifier à la tarière.', NULL, '1900-01-01', '2026-11-03T00:00:00.000Z'),
  ('soil-criiam-melon', NULL, 'criiam-melon', 0.4, 'Maximum : plafond du porteur, 0,60 m (D-056). p : FAO-56, tableau 22. Construit par stade le 3 novembre 2026, à vérifier à la tarière.', 'FAO melon doux 0,8-1,5 m non retenue. Source faible : à vérifier à la bêche.', '1900-01-01', '2026-11-03T00:00:00.000Z'),
  ('soil-criiam-oignon', NULL, 'criiam-oignon', 0.3, 'Maximum : ITAB 30-40 cm. p : FAO-56, tableau 22. Construit par stade le 3 novembre 2026 (D-056), à vérifier à la tarière.', NULL, '1900-01-01', '2026-11-03T00:00:00.000Z'),
  ('soil-criiam-poireau', NULL, 'criiam-poireau', 0.3, 'Maximum : ITAB 30-40 cm (absent de la FAO). p : famille de l''oignon et de l''ail (D-053). Construit par stade le 3 novembre 2026 (D-056), à vérifier à la tarière.', NULL, '1900-01-01', '2026-11-03T00:00:00.000Z'),
  ('soil-criiam-poivron', NULL, 'criiam-poivron', 0.3, 'Maximum : ITAB 50-80 cm. p : FAO-56, tableau 22. Construit par stade le 3 novembre 2026 (D-056), à vérifier à la tarière.', NULL, '1900-01-01', '2026-11-03T00:00:00.000Z'),
  ('soil-criiam-pomme-de-terre', NULL, 'criiam-pomme-de-terre', 0.35, 'Maximum : ITAB 40-60 cm. p : FAO-56, tableau 22. Construit par stade le 3 novembre 2026 (D-056), à vérifier à la tarière.', NULL, '1900-01-01', '2026-11-03T00:00:00.000Z'),
  ('soil-criiam-salade-ete', NULL, 'criiam-salade-ete', 0.3, 'Maximum : ITAB 20-30 cm. p : FAO-56, tableau 22 (laitue). Construit par stade le 3 novembre 2026 (D-056), à vérifier à la tarière.', NULL, '1900-01-01', '2026-11-03T00:00:00.000Z'),
  ('soil-criiam-tomate', NULL, 'criiam-tomate', 0.4, 'Maximum : ITAB 50-80 cm, 0,65 m choisi par le porteur (D-056). p : FAO-56, tableau 22. Construit par stade le 3 novembre 2026, à vérifier à la tarière.', NULL, '1900-01-01', '2026-11-03T00:00:00.000Z'),
  ('soil-fao-brocoli', NULL, 'fao-brocoli', 0.45, 'Maximum : FAO 0,4-0,6 m. p : FAO-56, tableau 22. Progressif sur début + développement de la FAO-56, 3 novembre 2026 (D-056), à vérifier à la tarière.', NULL, '1900-01-01', '2026-11-03T00:00:00.000Z'),
  ('soil-fao-celeri', NULL, 'fao-celeri', 0.2, 'p : FAO-56, tableau 22. Profondeur sans source : 30 cm proposés, avec avertissement (D-056).', NULL, '1900-01-01', '2026-11-03T00:00:00.000Z'),
  ('soil-fao-concombre', NULL, 'fao-concombre', 0.5, 'Maximum : ITAB 40-60 cm, comme la courgette. p : FAO-56, tableau 22. Progressif sur début + développement de la FAO-56, 3 novembre 2026 (D-056), à vérifier à la tarière.', NULL, '1900-01-01', '2026-11-03T00:00:00.000Z'),
  ('soil-fao-cruciferes', NULL, 'fao-cruciferes', 0.45, 'Maximum : FAO 0,5-0,8 m (chou pommé, chou kale). p : FAO-56, tableau 22 ; chou kale : famille des choux (D-053). Progressif sur début + développement de la FAO-56, 3 novembre 2026 (D-056), à vérifier à la tarière.', 'Chou de Bruxelles : de 0,20 à 0,40 m sur 50 j, à saisir par une révision de la ferme s''il a sa propre culture de référence. Source faible : à vérifier à la bêche.', '1900-01-01', '2026-11-03T00:00:00.000Z'),
  ('soil-fao-epinard', NULL, 'fao-epinard', 0.2, 'Maximum : ITAB 20-30 cm. p : FAO-56, tableau 22. Progressif sur début + développement de la FAO-56, 3 novembre 2026 (D-056), à vérifier à la tarière.', 'Vaut aussi pour la mâche, par analogie.', '1900-01-01', '2026-11-03T00:00:00.000Z'),
  ('soil-fao-feve', NULL, 'fao-feve', 0.45, 'Maximum : FAO 0,5-0,7 m. p : FAO-56, tableau 22. Progressif sur début + développement de la FAO-56, 3 novembre 2026 (D-056), à vérifier à la tarière.', NULL, '1900-01-01', '2026-11-03T00:00:00.000Z'),
  ('soil-fao-navet', NULL, 'fao-navet', 0.5, 'Maximum : ITAB 60-80 cm, comme la betterave. p : celui de la betterave, FAO-56, tableau 22. Progressif sur début + développement de la FAO-56, 3 novembre 2026 (D-056), à vérifier à la tarière.', NULL, '1900-01-01', '2026-11-03T00:00:00.000Z'),
  ('soil-fao-oignon-vert', NULL, 'fao-oignon-vert', 0.3, 'Maximum : FAO 0,3-0,6 m. p : FAO-56, tableau 22. Progressif sur début + développement de la FAO-56, 3 novembre 2026 (D-056), à vérifier à la tarière.', NULL, '1900-01-01', '2026-11-03T00:00:00.000Z'),
  ('soil-fao-pasteque', NULL, 'fao-pasteque', 0.4, 'Maximum : ITAB de la courgette par analogie, sources en désaccord (FAO 0,8-1,5 m non retenue). p : FAO-56, tableau 22. Progressif sur début + développement de la FAO-56, 3 novembre 2026 (D-056), à vérifier à la tarière.', 'Source faible : à vérifier à la bêche.', '1900-01-01', '2026-11-03T00:00:00.000Z'),
  ('soil-fao-petit-pois', NULL, 'fao-petit-pois', 0.35, 'Maximum : FAO 0,6-1,0 m. p : FAO-56, tableau 22. Progressif sur début + développement de la FAO-56, 3 novembre 2026 (D-056), à vérifier à la tarière.', NULL, '1900-01-01', '2026-11-03T00:00:00.000Z'),
  ('soil-fao-potiron', NULL, 'fao-potiron', 0.35, 'Maximum : ITAB de la courgette par analogie, sources en désaccord (FAO 0,8-1,5 m non retenue). p : FAO-56, tableau 22. Progressif sur début + développement de la FAO-56, 3 novembre 2026 (D-056), à vérifier à la tarière.', 'Source faible : à vérifier à la bêche.', '1900-01-01', '2026-11-03T00:00:00.000Z'),
  ('soil-fao-radis', NULL, 'fao-radis', 0.3, 'Maximum : FAO 0,3-0,5 m. p : FAO-56, tableau 22. Progressif sur début + développement de la FAO-56, 3 novembre 2026 (D-056), à vérifier à la tarière.', NULL, '1900-01-01', '2026-11-03T00:00:00.000Z');
--> statement-breakpoint
-- Une ligne par stade ; `stage_rank` nul : tous les stades sans ligne propre
-- (pour la FAO-56, compté depuis l'origine du cycle). Profondeur progressive :
-- jusqu'à `end_depth_m` en `progression_days` jours, puis constante.
INSERT INTO `irrigation_soil_rooting_stages` (`profile_id`, `position`, `stage_rank`, `depth_m`, `end_depth_m`, `progression_days`)
VALUES
  ('soil-criiam-ail', 1, 1, 0.2, NULL, NULL),
  ('soil-criiam-ail', 2, 2, 0.3, NULL, NULL),
  ('soil-criiam-ail', 3, 3, 0.3, NULL, NULL),
  ('soil-criiam-ail', 4, 4, 0.3, NULL, NULL),
  ('soil-criiam-artichaut-remontant', 1, 1, 0.3, NULL, NULL),
  ('soil-criiam-artichaut-remontant', 2, NULL, 0.6, NULL, NULL),
  ('soil-criiam-artichaut-non-remontant', 1, 1, 0.3, NULL, NULL),
  ('soil-criiam-artichaut-non-remontant', 2, NULL, 0.6, NULL, NULL),
  ('soil-criiam-asperge', 1, NULL, 0.6, NULL, NULL),
  ('soil-criiam-aubergine', 1, 1, 0.3, NULL, NULL),
  ('soil-criiam-aubergine', 2, 2, 0.55, NULL, NULL),
  ('soil-criiam-aubergine', 3, 3, 0.65, NULL, NULL),
  ('soil-criiam-aubergine', 4, 4, 0.65, NULL, NULL),
  ('soil-criiam-betterave', 1, 1, 0.2, NULL, NULL),
  ('soil-criiam-betterave', 2, 2, 0.5, NULL, NULL),
  ('soil-criiam-betterave', 3, 3, 0.7, NULL, NULL),
  ('soil-criiam-carotte', 1, 1, 0.2, NULL, NULL),
  ('soil-criiam-carotte', 2, 2, 0.4, 0.7, 40),
  ('soil-criiam-chou-fleur', 1, 1, 0.3, NULL, NULL),
  ('soil-criiam-chou-fleur', 2, 2, 0.4, NULL, NULL),
  ('soil-criiam-chou-fleur', 3, 3, 0.4, NULL, NULL),
  ('soil-criiam-courgette', 1, 1, 0.3, NULL, NULL),
  ('soil-criiam-courgette', 2, 2, 0.5, NULL, NULL),
  ('soil-criiam-courgette', 3, 3, 0.5, NULL, NULL),
  ('soil-criiam-fraisier', 1, NULL, 0.25, NULL, NULL),
  ('soil-criiam-fraisier-remontant', 1, NULL, 0.25, NULL, NULL),
  ('soil-criiam-haricot', 1, 1, 0.35, NULL, NULL),
  ('soil-criiam-haricot', 2, 2, 0.5, NULL, NULL),
  ('soil-criiam-haricot', 3, 3, 0.5, NULL, NULL),
  ('soil-criiam-melon', 1, 1, 0.3, NULL, NULL),
  ('soil-criiam-melon', 2, 2, 0.55, NULL, NULL),
  ('soil-criiam-melon', 3, 3, 0.6, NULL, NULL),
  ('soil-criiam-melon', 4, 4, 0.6, NULL, NULL),
  ('soil-criiam-oignon', 1, 1, 0.2, NULL, NULL),
  ('soil-criiam-oignon', 2, 2, 0.35, NULL, NULL),
  ('soil-criiam-oignon', 3, 3, 0.35, NULL, NULL),
  ('soil-criiam-oignon', 4, 4, 0.35, NULL, NULL),
  ('soil-criiam-oignon', 5, 5, 0.35, NULL, NULL),
  ('soil-criiam-poireau', 1, 1, 0.2, 0.35, 60),
  ('soil-criiam-poivron', 1, 1, 0.3, NULL, NULL),
  ('soil-criiam-poivron', 2, 2, 0.55, NULL, NULL),
  ('soil-criiam-poivron', 3, 3, 0.65, NULL, NULL),
  ('soil-criiam-poivron', 4, 4, 0.65, NULL, NULL),
  ('soil-criiam-pomme-de-terre', 1, 1, 0.25, NULL, NULL),
  ('soil-criiam-pomme-de-terre', 2, 2, 0.5, NULL, NULL),
  ('soil-criiam-pomme-de-terre', 3, 3, 0.5, NULL, NULL),
  ('soil-criiam-pomme-de-terre', 4, 4, 0.5, NULL, NULL),
  ('soil-criiam-salade-ete', 1, 1, 0.15, NULL, NULL),
  ('soil-criiam-salade-ete', 2, 2, 0.25, NULL, NULL),
  ('soil-criiam-tomate', 1, 1, 0.2, NULL, NULL),
  ('soil-criiam-tomate', 2, 2, 0.45, NULL, NULL),
  ('soil-criiam-tomate', 3, 3, 0.65, NULL, NULL),
  ('soil-criiam-tomate', 4, 4, 0.65, NULL, NULL),
  ('soil-fao-brocoli', 1, NULL, 0.2, 0.4, 50),
  ('soil-fao-concombre', 1, NULL, 0.2, 0.5, 50),
  ('soil-fao-cruciferes', 1, NULL, 0.2, 0.5, 50),
  ('soil-fao-epinard', 1, NULL, 0.15, 0.25, 40),
  ('soil-fao-feve', 1, NULL, 0.15, 0.5, 135),
  ('soil-fao-navet', 1, NULL, 0.15, 0.7, 40),
  ('soil-fao-oignon-vert', 1, NULL, 0.15, 0.3, 55),
  ('soil-fao-pasteque', 1, NULL, 0.2, 0.5, 50),
  ('soil-fao-petit-pois', 1, NULL, 0.15, 0.6, 40),
  ('soil-fao-potiron', 1, NULL, 0.2, 0.5, 50),
  ('soil-fao-radis', 1, NULL, 0.15, 0.3, 15);
