-- Extension 5 quater : le besoin en eau par culture et par stade, la
-- persistance (docs/crop-water-need-contract.md, « Les données », D-045,
-- D-054, D-057).
--
-- 1. Les cultures de référence : une ligne par culture, ses stades, ses jeux
--    de saison, les mois de chaque jeu et le début de chaque stade dans un
--    jeu. Le jeu commun (exploitation nulle) est écrit ici, avec l'adresse de
--    la source et la date du relevé : les dix-neuf cultures du CRIIAM Sud
--    (dix-sept légumes, l'artichaut et le fraisier en deux types) et les
--    treize cultures de la FAO-56 que la correspondance des espèces utilise
--    (relecture du 31 octobre 2026). Une exploitation peut enregistrer sa
--    propre version d'une culture commune — dates, jeux de saison, délais de
--    levée, calendrier, abattement — ou une culture saisie par elle ; sa
--    version remplace la commune pour elle seule. Une durée se dit en jours
--    ou en degrés-jours ; les degrés-jours restent hors de cette extension.
-- 2. Les surcharges de Kc, les stades déclarés et les K_abri sont des
--    révisions datées, jamais modifiées ni effacées (D-006).
-- 3. La correspondance des espèces : par espèce d'Ouvre ta ferme, avec une
--    exception possible par série ; aucune n'est écrite ici, la ferme la
--    saisit.
-- 4. Les réglages : paillage plastique par planche et par saison, filets
--    d'ombrage datés, options de la ferme (lissage, ombrage, désactivés).
-- 5. L'ETM du jour par planche, avec ce qui l'a produite ; un jour bloqué
--    par une valeur hors bornes n'est pas écrit, la dernière valeur valide
--    reste.
--
-- Migration additive (docs/migrations-contract.md) : treize tables, leurs
-- index, six déclencheurs d'immuabilité et les lignes du jeu commun ; aucune
-- table existante n'est touchée.
CREATE TABLE `irrigation_crop_reference_crops` (
  `id` text PRIMARY KEY NOT NULL,
  `crop_key` text NOT NULL,
  `workspace_id` text,
  `name` text NOT NULL,
  `source` text NOT NULL,
  `curve_shape` text NOT NULL,
  `kc_initial` real,
  `kc_mid` real,
  `kc_end` real,
  `abatement` real,
  `calendar_end` text,
  `emergence_sowing_days` integer NOT NULL,
  `emergence_planting_days` integer NOT NULL,
  `source_url` text,
  `surveyed_on` text,
  `dates_source` text,
  `actor_user_id` text,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_crop_reference_key` CHECK (length(`crop_key`) BETWEEN 1 AND 80),
  CONSTRAINT `chk_crop_reference_name` CHECK (length(`name`) BETWEEN 1 AND 80),
  CONSTRAINT `chk_crop_reference_source` CHECK (`source` IN ('criiam', 'fao56', 'local')),
  CONSTRAINT `chk_crop_reference_shape` CHECK (
    `curve_shape` IN ('steps', 'trapezoid', 'calendar')
    AND (`source` != 'fao56' OR `curve_shape` = 'trapezoid')
    AND (`source` != 'criiam' OR `curve_shape` != 'trapezoid')),
  CONSTRAINT `chk_crop_reference_trapezoid` CHECK (
    (`curve_shape` = 'trapezoid'
      AND `kc_initial` IS NOT NULL AND `kc_initial` >= 0 AND `kc_initial` <= 1.3
      AND `kc_mid` IS NOT NULL AND `kc_mid` >= 0 AND `kc_mid` <= 1.3
      AND `kc_end` IS NOT NULL AND `kc_end` >= 0 AND `kc_end` <= 1.3
      AND `abatement` IS NOT NULL AND `abatement` > 0 AND `abatement` <= 1)
    OR (`curve_shape` != 'trapezoid'
      AND `kc_initial` IS NULL AND `kc_mid` IS NULL AND `kc_end` IS NULL AND `abatement` IS NULL)),
  CONSTRAINT `chk_crop_reference_calendar` CHECK (
    (`curve_shape` = 'calendar' AND `calendar_end` IS NOT NULL AND `calendar_end` GLOB '[01][0-9]-[0-3][0-9]')
    OR (`curve_shape` != 'calendar' AND `calendar_end` IS NULL)),
  CONSTRAINT `chk_crop_reference_emergence` CHECK (`emergence_sowing_days` >= 0 AND `emergence_planting_days` >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_crop_reference_common_key` ON `irrigation_crop_reference_crops` (`crop_key`) WHERE `workspace_id` IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_crop_reference_farm_key` ON `irrigation_crop_reference_crops` (`workspace_id`, `crop_key`) WHERE `workspace_id` IS NOT NULL;
--> statement-breakpoint
CREATE TABLE `irrigation_crop_reference_stages` (
  `reference_id` text NOT NULL,
  `rank` integer NOT NULL,
  `label` text NOT NULL,
  `kc` real NOT NULL,
  `calendar_start` text,
  `estimated` integer DEFAULT 0 NOT NULL,
  `establishment_months` integer,
  PRIMARY KEY (`reference_id`, `rank`),
  FOREIGN KEY (`reference_id`) REFERENCES `irrigation_crop_reference_crops`(`id`) ON DELETE cascade,
  CONSTRAINT `chk_crop_stage_rank` CHECK (`rank` >= 1),
  CONSTRAINT `chk_crop_stage_label` CHECK (length(`label`) BETWEEN 1 AND 120),
  CONSTRAINT `chk_crop_stage_kc` CHECK (`kc` >= 0 AND `kc` <= 1.3),
  CONSTRAINT `chk_crop_stage_estimated` CHECK (`estimated` IN (0, 1)),
  CONSTRAINT `chk_crop_stage_calendar` CHECK (`calendar_start` IS NULL OR `calendar_start` GLOB '[01][0-9]-[0-3][0-9]'),
  CONSTRAINT `chk_crop_stage_establishment` CHECK (
    `establishment_months` IS NULL OR (`establishment_months` >= 1 AND `calendar_start` IS NULL))
);
--> statement-breakpoint
CREATE TABLE `irrigation_crop_reference_seasons` (
  `reference_id` text NOT NULL,
  `set_number` integer NOT NULL,
  `initial_days` integer,
  `development_days` integer,
  `mid_days` integer,
  `late_days` integer,
  PRIMARY KEY (`reference_id`, `set_number`),
  FOREIGN KEY (`reference_id`) REFERENCES `irrigation_crop_reference_crops`(`id`) ON DELETE cascade,
  CONSTRAINT `chk_crop_season_number` CHECK (`set_number` BETWEEN 1 AND 12),
  CONSTRAINT `chk_crop_season_phases` CHECK (
    (`initial_days` IS NULL AND `development_days` IS NULL AND `mid_days` IS NULL AND `late_days` IS NULL)
    OR (`initial_days` IS NOT NULL AND `initial_days` >= 0
      AND `development_days` IS NOT NULL AND `development_days` >= 0
      AND `mid_days` IS NOT NULL AND `mid_days` >= 0
      AND `late_days` IS NOT NULL AND `late_days` >= 0))
);
--> statement-breakpoint
CREATE TABLE `irrigation_crop_reference_season_months` (
  `reference_id` text NOT NULL,
  `month` integer NOT NULL,
  `set_number` integer NOT NULL,
  PRIMARY KEY (`reference_id`, `month`),
  FOREIGN KEY (`reference_id`, `set_number`) REFERENCES `irrigation_crop_reference_seasons`(`reference_id`, `set_number`) ON DELETE cascade,
  CONSTRAINT `chk_crop_season_month` CHECK (`month` BETWEEN 1 AND 12)
);
--> statement-breakpoint
CREATE TABLE `irrigation_crop_reference_stage_starts` (
  `reference_id` text NOT NULL,
  `set_number` integer NOT NULL,
  `rank` integer NOT NULL,
  `anchor` text NOT NULL,
  `duration` integer,
  `duration_unit` text DEFAULT 'days' NOT NULL,
  `estimated` integer DEFAULT 0 NOT NULL,
  PRIMARY KEY (`reference_id`, `set_number`, `rank`),
  FOREIGN KEY (`reference_id`, `set_number`) REFERENCES `irrigation_crop_reference_seasons`(`reference_id`, `set_number`) ON DELETE cascade,
  FOREIGN KEY (`reference_id`, `rank`) REFERENCES `irrigation_crop_reference_stages`(`reference_id`, `rank`) ON DELETE cascade,
  CONSTRAINT `chk_crop_start_anchor` CHECK (
    (`anchor` IN ('implantation', 'emergence', 'before-harvest') AND `duration` IS NOT NULL AND `duration` >= 0)
    OR (`anchor` IN ('first-harvest', 'mid-harvest') AND `duration` IS NULL)),
  CONSTRAINT `chk_crop_start_unit` CHECK (`duration_unit` IN ('days', 'degree-days')),
  CONSTRAINT `chk_crop_start_estimated` CHECK (`estimated` IN (0, 1))
);
--> statement-breakpoint
CREATE TABLE `irrigation_crop_kc_overrides` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `crop_key` text NOT NULL,
  `stage_rank` integer,
  `fao_point` text,
  `kc` real,
  `effective_from` text NOT NULL,
  `recorded_at` text NOT NULL,
  `actor_user_id` text,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_crop_kc_override_target` CHECK (
    (`stage_rank` IS NOT NULL AND `stage_rank` >= 1 AND `fao_point` IS NULL)
    OR (`stage_rank` IS NULL AND `fao_point` IS NOT NULL AND `fao_point` IN ('initial', 'mid', 'end'))),
  CONSTRAINT `chk_crop_kc_override_value` CHECK (`kc` IS NULL OR (`kc` >= 0 AND `kc` <= 1.3)),
  CONSTRAINT `chk_crop_kc_override_date` CHECK (`effective_from` GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]')
);
--> statement-breakpoint
CREATE INDEX `idx_crop_kc_overrides_workspace` ON `irrigation_crop_kc_overrides` (`workspace_id`, `crop_key`);
--> statement-breakpoint
CREATE TRIGGER `trg_crop_kc_overrides_no_update` BEFORE UPDATE ON `irrigation_crop_kc_overrides`
BEGIN
  SELECT RAISE(ABORT, 'CROP_KC_OVERRIDE_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_crop_kc_overrides_no_delete` BEFORE DELETE ON `irrigation_crop_kc_overrides`
BEGIN
  SELECT RAISE(ABORT, 'CROP_KC_OVERRIDE_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TABLE `irrigation_crop_species_links` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `plant_id` text NOT NULL,
  `series_id` text,
  `target_kind` text NOT NULL,
  `crop_key` text,
  `analogy` integer DEFAULT 0 NOT NULL,
  `actor_user_id` text,
  `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_crop_species_link_target` CHECK (
    (`target_kind` = 'reference' AND `crop_key` IS NOT NULL AND `analogy` IN (0, 1))
    OR (`target_kind` IN ('without-reference', 'surface-state') AND `crop_key` IS NULL AND `analogy` = 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_crop_species_link_species` ON `irrigation_crop_species_links` (`workspace_id`, `plant_id`) WHERE `series_id` IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_crop_species_link_series` ON `irrigation_crop_species_links` (`workspace_id`, `plant_id`, `series_id`) WHERE `series_id` IS NOT NULL;
--> statement-breakpoint
CREATE TABLE `irrigation_crop_stage_declarations` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `season` integer NOT NULL,
  `series_id` text NOT NULL,
  `otf_bed_id` text,
  `crop_key` text NOT NULL,
  `stage_rank` integer NOT NULL,
  `stage_date` text NOT NULL,
  `recorded_at` text NOT NULL,
  `actor_user_id` text,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_crop_stage_declaration_season` CHECK (`season` BETWEEN 1900 AND 9999),
  CONSTRAINT `chk_crop_stage_declaration_rank` CHECK (`stage_rank` >= 1),
  CONSTRAINT `chk_crop_stage_declaration_date` CHECK (`stage_date` GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]')
);
--> statement-breakpoint
CREATE INDEX `idx_crop_stage_declarations_series` ON `irrigation_crop_stage_declarations` (`workspace_id`, `season`, `series_id`);
--> statement-breakpoint
CREATE TRIGGER `trg_crop_stage_declarations_no_update` BEFORE UPDATE ON `irrigation_crop_stage_declarations`
BEGIN
  SELECT RAISE(ABORT, 'CROP_STAGE_DECLARATION_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_crop_stage_declarations_no_delete` BEFORE DELETE ON `irrigation_crop_stage_declarations`
BEGIN
  SELECT RAISE(ABORT, 'CROP_STAGE_DECLARATION_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TABLE `irrigation_crop_shelter_factors` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `otf_plot_id` text NOT NULL,
  `factor` real NOT NULL,
  `effective_from` text NOT NULL,
  `recorded_at` text NOT NULL,
  `actor_user_id` text,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_crop_shelter_factor_value` CHECK (`factor` >= 0.6 AND `factor` <= 1),
  CONSTRAINT `chk_crop_shelter_factor_date` CHECK (`effective_from` GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]')
);
--> statement-breakpoint
CREATE INDEX `idx_crop_shelter_factors_plot` ON `irrigation_crop_shelter_factors` (`workspace_id`, `otf_plot_id`);
--> statement-breakpoint
CREATE TRIGGER `trg_crop_shelter_factors_no_update` BEFORE UPDATE ON `irrigation_crop_shelter_factors`
BEGIN
  SELECT RAISE(ABORT, 'CROP_SHELTER_FACTOR_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_crop_shelter_factors_no_delete` BEFORE DELETE ON `irrigation_crop_shelter_factors`
BEGIN
  SELECT RAISE(ABORT, 'CROP_SHELTER_FACTOR_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TABLE `irrigation_crop_bed_mulch` (
  `workspace_id` text NOT NULL,
  `season` integer NOT NULL,
  `otf_bed_id` text NOT NULL,
  `plastic_mulch` integer NOT NULL,
  `actor_user_id` text,
  `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  PRIMARY KEY (`workspace_id`, `season`, `otf_bed_id`),
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_crop_bed_mulch_season` CHECK (`season` BETWEEN 1900 AND 9999),
  CONSTRAINT `chk_crop_bed_mulch_value` CHECK (`plastic_mulch` IN (0, 1))
);
--> statement-breakpoint
CREATE TABLE `irrigation_crop_shade_nets` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `otf_bed_id` text NOT NULL,
  `rate` real NOT NULL,
  `placed_on` text NOT NULL,
  `removed_on` text,
  `actor_user_id` text,
  `recorded_at` text NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_crop_shade_net_rate` CHECK (`rate` >= 0 AND `rate` < 1),
  CONSTRAINT `chk_crop_shade_net_dates` CHECK (
    `placed_on` GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]'
    AND (`removed_on` IS NULL OR `removed_on` >= `placed_on`))
);
--> statement-breakpoint
CREATE INDEX `idx_crop_shade_nets_bed` ON `irrigation_crop_shade_nets` (`workspace_id`, `otf_bed_id`);
--> statement-breakpoint
CREATE TABLE `irrigation_crop_water_options` (
  `workspace_id` text PRIMARY KEY NOT NULL,
  `smoothing` integer DEFAULT 0 NOT NULL,
  `shading` integer DEFAULT 0 NOT NULL,
  `actor_user_id` text,
  `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_crop_water_options` CHECK (`smoothing` IN (0, 1) AND `shading` IN (0, 1))
);
--> statement-breakpoint
CREATE TABLE `irrigation_crop_etm_days` (
  `workspace_id` text NOT NULL,
  `season` integer NOT NULL,
  `otf_bed_id` text NOT NULL,
  `date` text NOT NULL,
  `status` text NOT NULL,
  `etm_mm` real,
  `et0_mm` real,
  `et0_nature` text,
  `irrigation_stop` integer DEFAULT 0 NOT NULL,
  `series_id` text,
  `cultivation_id` text,
  `plant_id` text,
  `crop_key` text,
  `kc_source` text,
  `stage_rank` integer,
  `stage_origin` text,
  `kc` real,
  `reference_kc` real,
  `kc_overridden` integer,
  `abatement` real,
  `kc_smoothed` integer,
  `shelter_factor` real,
  `mulch_factor` real,
  `shade_factor` real,
  `shade_net_rate` real,
  `computed_at` text NOT NULL,
  PRIMARY KEY (`workspace_id`, `season`, `otf_bed_id`, `date`),
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_crop_etm_season` CHECK (`season` BETWEEN 1900 AND 9999),
  CONSTRAINT `chk_crop_etm_date` CHECK (`date` GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]'),
  CONSTRAINT `chk_crop_etm_status` CHECK (
    (`status` = 'no-crop' AND `etm_mm` IS NOT NULL AND `etm_mm` = 0)
    OR (`status` IN ('computed', 'partial') AND `etm_mm` IS NOT NULL AND `etm_mm` >= 0 AND `et0_mm` IS NOT NULL AND `crop_key` IS NOT NULL)
    OR (`status` = 'no-etm' AND `etm_mm` IS NULL)
    OR (`status` = 'unknown' AND `etm_mm` IS NULL AND `et0_mm` IS NULL)),
  CONSTRAINT `chk_crop_etm_et0` CHECK (
    (`et0_mm` IS NULL AND `et0_nature` IS NULL)
    OR (`et0_mm` IS NOT NULL AND `et0_mm` >= 0 AND `et0_mm` <= 12
      AND `et0_nature` IS NOT NULL AND `et0_nature` IN ('reanalysis', 'estimated', 'forecast'))),
  CONSTRAINT `chk_crop_etm_stop` CHECK (`irrigation_stop` IN (0, 1)),
  CONSTRAINT `chk_crop_etm_trace` CHECK (
    (`crop_key` IS NULL AND `series_id` IS NULL AND `cultivation_id` IS NULL AND `plant_id` IS NULL
      AND `kc_source` IS NULL AND `stage_rank` IS NULL AND `stage_origin` IS NULL AND `kc` IS NULL
      AND `reference_kc` IS NULL AND `kc_overridden` IS NULL AND `abatement` IS NULL AND `kc_smoothed` IS NULL
      AND `shelter_factor` IS NULL AND `mulch_factor` IS NULL AND `shade_factor` IS NULL AND `shade_net_rate` IS NULL)
    OR (`crop_key` IS NOT NULL AND `series_id` IS NOT NULL AND `cultivation_id` IS NOT NULL AND `plant_id` IS NOT NULL
      AND `kc_source` IS NOT NULL AND `kc_source` IN ('criiam', 'fao56', 'local')
      AND `stage_rank` IS NOT NULL AND `stage_rank` >= 1
      AND `stage_origin` IS NOT NULL AND `stage_origin` IN ('calculated', 'observed')
      AND `kc` IS NOT NULL AND `kc` >= 0 AND `kc` <= 1.3
      AND `reference_kc` IS NOT NULL AND `reference_kc` >= 0
      AND `kc_overridden` IS NOT NULL AND `kc_overridden` IN (0, 1)
      AND `abatement` IS NOT NULL AND `abatement` > 0 AND `abatement` <= 1
      AND `kc_smoothed` IS NOT NULL AND `kc_smoothed` IN (0, 1)
      AND `shelter_factor` IS NOT NULL AND `shelter_factor` >= 0.5 AND `shelter_factor` <= 1
      AND `mulch_factor` IS NOT NULL AND `mulch_factor` > 0 AND `mulch_factor` <= 1
      AND `shade_factor` IS NOT NULL AND `shade_factor` > 0 AND `shade_factor` <= 1
      AND (`shade_net_rate` IS NULL OR (`shade_net_rate` >= 0 AND `shade_net_rate` < 1))))
);
--> statement-breakpoint
CREATE INDEX `idx_crop_etm_days_date` ON `irrigation_crop_etm_days` (`workspace_id`, `season`, `date`);
--> statement-breakpoint
-- Le jeu commun : les cultures du CRIIAM Sud, relevées le 29 octobre 2026, et
-- de la FAO-56, tableaux 11 et 12, relus le 31 octobre 2026 ; dates par défaut,
-- délais de levée et calendriers validés par le porteur le 31 octobre 2026
-- (D-054), sources des dates dans `dates_source`.
INSERT INTO `irrigation_crop_reference_crops`
  (`id`, `crop_key`, `workspace_id`, `name`, `source`, `curve_shape`, `kc_initial`, `kc_mid`, `kc_end`, `abatement`, `calendar_end`,
   `emergence_sowing_days`, `emergence_planting_days`, `source_url`, `surveyed_on`, `dates_source`, `created_at`, `updated_at`)
VALUES
  ('criiam-ail', 'criiam-ail', NULL, 'Ail', 'criiam', 'steps', NULL, NULL, NULL, NULL, NULL, 30, 30,
   'https://www.criiamsud.fr/coefficients_culturaux', '2026-10-29',
   'Bulletins de santé du végétal Ail, Occitanie, 2016-2026 ; CTEM, 2021 ; levée : bulletins Ail, 2016-2022', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'),
  ('criiam-artichaut-remontant', 'criiam-artichaut-remontant', NULL, 'Artichaut remontant', 'criiam', 'calendar', NULL, NULL, NULL, NULL, '05-31', 0, 0,
   'https://www.criiamsud.fr/coefficients_culturaux', '2026-10-29',
   'Cahier des charges de l''IGP Artichaut du Roussillon ; montée des capitules estimée', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'),
  ('criiam-artichaut-non-remontant', 'criiam-artichaut-non-remontant', NULL, 'Artichaut non remontant', 'criiam', 'calendar', NULL, NULL, NULL, NULL, '05-31', 0, 0,
   'https://www.criiamsud.fr/coefficients_culturaux', '2026-10-29',
   'Cahier des charges de l''IGP Artichaut du Roussillon ; montée des capitules estimée', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'),
  ('criiam-asperge', 'criiam-asperge', NULL, 'Asperge', 'criiam', 'calendar', NULL, NULL, NULL, NULL, '09-07', 0, 0,
   'https://www.criiamsud.fr/coefficients_culturaux', '2026-10-29',
   'Chambre d''agriculture des Bouches-du-Rhône, 2015 ; Chambre de la Gironde, 2024 ; semaine avant le débuttage estimée', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'),
  ('criiam-aubergine', 'criiam-aubergine', NULL, 'Aubergine', 'criiam', 'steps', NULL, NULL, NULL, NULL, NULL, 0, 0,
   'https://www.criiamsud.fr/coefficients_culturaux', '2026-10-29',
   'Université du Missouri, guide G 6369 ; 3e étage : estimation sans source', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'),
  ('criiam-betterave', 'criiam-betterave', NULL, 'Betterave', 'criiam', 'steps', NULL, NULL, NULL, NULL, NULL, 10, 0,
   'https://www.criiamsud.fr/coefficients_culturaux', '2026-10-29',
   'FAO-56, Méditerranée, avril-mai et février-mars ; levée : Harrington, 15 °C', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'),
  ('criiam-carotte', 'criiam-carotte', NULL, 'Carotte', 'criiam', 'steps', NULL, NULL, NULL, NULL, NULL, 10, 0,
   'https://www.criiamsud.fr/coefficients_culturaux', '2026-10-29',
   'CRIIAM ; levée : Harrington, 15 °C', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'),
  ('criiam-chou-fleur', 'criiam-chou-fleur', NULL, 'Chou-fleur', 'criiam', 'steps', NULL, NULL, NULL, NULL, NULL, 0, 0,
   'https://www.criiamsud.fr/coefficients_culturaux', '2026-10-29',
   'Booij, 1987 (J50 estimé) ; FAO-56 « Crucifères », octobre-novembre', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'),
  ('criiam-courgette', 'criiam-courgette', NULL, 'Courgette', 'criiam', 'steps', NULL, NULL, NULL, NULL, NULL, 0, 0,
   'https://www.criiamsud.fr/coefficients_culturaux', '2026-10-29',
   'FAO-56, mai-juin ; Chambre d''agriculture PACA, 2018', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'),
  ('criiam-fraisier', 'criiam-fraisier', NULL, 'Fraisier non remontant', 'criiam', 'calendar', NULL, NULL, NULL, NULL, '06-30', 0, 0,
   'https://www.criiamsud.fr/coefficients_culturaux', '2026-10-29',
   'Estimation sans source', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'),
  ('criiam-fraisier-remontant', 'criiam-fraisier-remontant', NULL, 'Fraisier remontant', 'criiam', 'calendar', NULL, NULL, NULL, NULL, '09-30', 0, 0,
   'https://www.criiamsud.fr/coefficients_culturaux', '2026-10-29',
   'Estimation sans source', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'),
  ('criiam-haricot', 'criiam-haricot', NULL, 'Haricot', 'criiam', 'steps', NULL, NULL, NULL, NULL, NULL, 16, 0,
   'https://www.criiamsud.fr/coefficients_culturaux', '2026-10-29',
   'SUAMME, 2012 ; CROPTIME, Oregon State, 2020 ; J50 estimé ; levée : Harrington, 15 °C', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'),
  ('criiam-melon', 'criiam-melon', NULL, 'Melon', 'criiam', 'steps', NULL, NULL, NULL, NULL, NULL, 0, 0,
   'https://www.criiamsud.fr/coefficients_culturaux', '2026-10-29',
   'FAO-56, mai ; Civam Bio 66, 2025 ; Utah State, 2020', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'),
  ('criiam-oignon', 'criiam-oignon', NULL, 'Oignon', 'criiam', 'steps', NULL, NULL, NULL, NULL, NULL, 7, 0,
   'https://www.criiamsud.fr/coefficients_culturaux', '2026-10-29',
   'CRIIAM ; FAO-56, phase de fin de 40 j ; levée : Harrington, 15 °C', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'),
  ('criiam-poireau', 'criiam-poireau', NULL, 'Poireau', 'criiam', 'steps', NULL, NULL, NULL, NULL, NULL, 0, 0,
   'https://www.criiamsud.fr/coefficients_culturaux', '2026-10-29',
   'CRIIAM', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'),
  ('criiam-poivron', 'criiam-poivron', NULL, 'Poivron', 'criiam', 'steps', NULL, NULL, NULL, NULL, NULL, 0, 0,
   'https://www.criiamsud.fr/coefficients_culturaux', '2026-10-29',
   'FAO-56, avril-juin ; 3e étage : estimation sans source', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'),
  ('criiam-pomme-de-terre', 'criiam-pomme-de-terre', NULL, 'Pomme de terre', 'criiam', 'steps', NULL, NULL, NULL, NULL, NULL, 25, 25,
   'https://www.criiamsud.fr/coefficients_culturaux', '2026-10-29',
   'CRIIAM ; FAO-56, phase de fin de 30 j ; Chambre d''agriculture du Rhône, 2013 ; levée : Université de l''Idaho, bulletin 789', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'),
  ('criiam-salade-ete', 'criiam-salade-ete', NULL, 'Salade d''été', 'criiam', 'steps', NULL, NULL, NULL, NULL, NULL, 4, 0,
   'https://www.criiamsud.fr/coefficients_culturaux', '2026-10-29',
   'FAO-56 laitue, Méditerranée, avril, novembre-janvier, février ; levée : Harrington, 15 °C', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'),
  ('criiam-tomate', 'criiam-tomate', NULL, 'Tomate', 'criiam', 'steps', NULL, NULL, NULL, NULL, NULL, 0, 0,
   'https://www.criiamsud.fr/coefficients_culturaux', '2026-10-29',
   'de Koning, Wageningen, 1994 ; J30 estimé', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'),
  ('fao-brocoli', 'fao-brocoli', NULL, 'Brocoli', 'fao56', 'trapezoid', 0.7, 1.05, 0.95, 1, NULL, 0, 0,
   'https://www.fao.org/4/X0490E/x0490e0b.htm', '2026-10-31',
   'FAO-56 « Crucifères », Méditerranée, avril et octobre-novembre', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'),
  ('fao-celeri', 'fao-celeri', NULL, 'Céleri', 'fao56', 'trapezoid', 0.7, 1.05, 1, 1, NULL, 0, 0,
   'https://www.fao.org/4/X0490E/x0490e0b.htm', '2026-10-31',
   'FAO-56, avril, Méditerranée', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'),
  ('fao-concombre', 'fao-concombre', NULL, 'Concombre', 'fao56', 'trapezoid', 0.6, 1, 0.75, 1, NULL, 0, 0,
   'https://www.fao.org/4/X0490E/x0490e0b.htm', '2026-10-31',
   'FAO-56, juin-août, région aride seulement', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'),
  ('fao-cruciferes', 'fao-cruciferes', NULL, 'Crucifères (choux)', 'fao56', 'trapezoid', 0.7, 1.05, 0.95, 1, NULL, 0, 0,
   'https://www.fao.org/4/X0490E/x0490e0b.htm', '2026-10-31',
   'FAO-56 « Crucifères », Méditerranée, avril et octobre-novembre', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'),
  ('fao-epinard', 'fao-epinard', NULL, 'Épinard', 'fao56', 'trapezoid', 0.7, 1, 0.95, 1, NULL, 7, 0,
   'https://www.fao.org/4/X0490E/x0490e0b.htm', '2026-10-31',
   'FAO-56, avril ou septembre-octobre, Méditerranée ; levée : Harrington, 15 °C', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'),
  ('fao-feve', 'fao-feve', NULL, 'Fève', 'fao56', 'trapezoid', 0.5, 1.15, 1.1, 1, NULL, 0, 0,
   'https://www.fao.org/4/X0490E/x0490e0b.htm', '2026-10-31',
   'FAO-56, novembre, Europe', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'),
  ('fao-navet', 'fao-navet', NULL, 'Navet', 'fao56', 'trapezoid', 0.5, 1.1, 0.95, 1, NULL, 3, 0,
   'https://www.fao.org/4/X0490E/x0490e0b.htm', '2026-10-31',
   'FAO-56, durées de la betterave potagère, avril-mai et février-mars (D-054) ; levée : Harrington, 15 °C', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'),
  ('fao-oignon-vert', 'fao-oignon-vert', NULL, 'Oignon vert', 'fao56', 'trapezoid', 0.7, 1, 1, 1, NULL, 0, 0,
   'https://www.fao.org/4/X0490E/x0490e0b.htm', '2026-10-31',
   'FAO-56, avril-mai, Méditerranée', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'),
  ('fao-pasteque', 'fao-pasteque', NULL, 'Pastèque', 'fao56', 'trapezoid', 0.4, 1, 0.75, 1, NULL, 0, 0,
   'https://www.fao.org/4/X0490E/x0490e0b.htm', '2026-10-31',
   'FAO-56, avril, Italie', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'),
  ('fao-patate-douce', 'fao-patate-douce', NULL, 'Patate douce', 'fao56', 'trapezoid', 0.5, 1.15, 0.65, 1, NULL, 0, 0,
   'https://www.fao.org/4/X0490E/x0490e0b.htm', '2026-10-31',
   'FAO-56, avril, Méditerranée', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'),
  ('fao-petit-pois', 'fao-petit-pois', NULL, 'Petit pois', 'fao56', 'trapezoid', 0.5, 1.15, 1.1, 1, NULL, 9, 0,
   'https://www.fao.org/4/X0490E/x0490e0b.htm', '2026-10-31',
   'FAO-56, mai, Europe ; levée : Harrington, 15 °C', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'),
  ('fao-potiron', 'fao-potiron', NULL, 'Potiron, courge d''hiver', 'fao56', 'trapezoid', 0.5, 1, 0.8, 1, NULL, 0, 0,
   'https://www.fao.org/4/X0490E/x0490e0b.htm', '2026-10-31',
   'FAO-56, mars ou août, Méditerranée', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'),
  ('fao-radis', 'fao-radis', NULL, 'Radis', 'fao56', 'trapezoid', 0.7, 0.9, 0.85, 1, NULL, 6, 0,
   'https://www.fao.org/4/X0490E/x0490e0b.htm', '2026-10-31',
   'FAO-56, mars-avril, Méditerranée et Europe ; levée : Harrington, 15 °C', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z');
--> statement-breakpoint
INSERT INTO `irrigation_crop_reference_stages` (`reference_id`, `rank`, `label`, `kc`, `calendar_start`, `estimated`, `establishment_months`)
VALUES
  ('criiam-ail', 1, 'Fin levée → Formation bulbe', 0.5, NULL, 0, NULL),
  ('criiam-ail', 2, 'Formation bulbe → Grossissement maxi', 0.9, NULL, 0, NULL),
  ('criiam-ail', 3, 'Grossissement maxi → 20 j avant récolte', 0.6, NULL, 0, NULL),
  ('criiam-ail', 4, '20 j avant récolte → Récolte', 0, NULL, 0, NULL),
  ('criiam-artichaut-remontant', 1, 'Plantation-reprise → 2 mois après', 0.5, NULL, 0, 2),
  ('criiam-artichaut-remontant', 3, 'Montée des capitules → 15 j avant 1re récolte', 0.8, '08-01', 1, NULL),
  ('criiam-artichaut-remontant', 4, '15 j avant 1re récolte → Fin 1re récolte', 1.1, '08-15', 0, NULL),
  ('criiam-artichaut-remontant', 5, 'Fin 1re → Fin 2e récolte', 0.6, '01-01', 0, NULL),
  ('criiam-artichaut-non-remontant', 1, 'Plantation-reprise → 2 mois après', 0.5, NULL, 0, 2),
  ('criiam-artichaut-non-remontant', 3, 'Montée des capitules → 15 j avant 1re récolte', 0.8, '02-01', 1, NULL),
  ('criiam-artichaut-non-remontant', 4, '15 j avant 1re récolte → Fin 1re récolte', 1.1, '02-15', 0, NULL),
  ('criiam-asperge', 1, 'Fin récolte → Débuttage', 0.5, '05-31', 1, NULL),
  ('criiam-asperge', 2, 'Débuttage → 1 mois après', 0.9, '06-07', 0, NULL),
  ('criiam-asperge', 3, '1 → 2 mois après', 0.7, '07-07', 0, NULL),
  ('criiam-asperge', 4, '2 → 3 mois après', 0.5, '08-07', 0, NULL),
  ('criiam-aubergine', 1, 'Plantation → Début floraison', 0.5, NULL, 0, NULL),
  ('criiam-aubergine', 2, 'Début floraison → Croissance 3e étage', 0.6, NULL, 0, NULL),
  ('criiam-aubergine', 3, 'Croissance 3e étage → Mi-récolte', 0.9, NULL, 0, NULL),
  ('criiam-aubergine', 4, 'Mi-récolte → Fin culture', 0.6, NULL, 0, NULL),
  ('criiam-betterave', 1, 'Semis → 30 j après', 0.5, NULL, 0, NULL),
  ('criiam-betterave', 2, '30 j → Début tubérisation', 0.7, NULL, 0, NULL),
  ('criiam-betterave', 3, 'Début tubérisation → Récolte', 1, NULL, 0, NULL),
  ('criiam-carotte', 1, 'Semis → 30 j après', 0.5, NULL, 0, NULL),
  ('criiam-carotte', 2, '30 j → Récolte', 1, NULL, 0, NULL),
  ('criiam-chou-fleur', 1, 'Plantation → Apparition inflorescences', 0.5, NULL, 0, NULL),
  ('criiam-chou-fleur', 2, 'Apparition inflorescences → Début formation des choux', 1, NULL, 0, NULL),
  ('criiam-chou-fleur', 3, 'Début formation des choux → Récolte', 1.3, NULL, 0, NULL),
  ('criiam-courgette', 1, 'Plantation → Floraison', 0.5, NULL, 0, NULL),
  ('criiam-courgette', 2, 'Floraison → Mi-récolte', 1, NULL, 0, NULL),
  ('criiam-courgette', 3, 'Mi-récolte → Fin récolte', 0.7, NULL, 0, NULL),
  ('criiam-fraisier', 1, 'Départ végétation → Début floraison', 0.4, '02-15', 1, NULL),
  ('criiam-fraisier', 2, 'Début floraison → Floraison', 0.6, '03-20', 1, NULL),
  ('criiam-fraisier', 3, 'Floraison → Grossissement fruits', 0.9, '04-10', 1, NULL),
  ('criiam-fraisier', 4, 'Grossissement fruits → Récolte', 0.7, '05-01', 1, NULL),
  ('criiam-fraisier-remontant', 1, 'Départ végétation → Début floraison', 0.4, '02-15', 1, NULL),
  ('criiam-fraisier-remontant', 2, 'Début floraison → Floraison', 0.6, '03-20', 1, NULL),
  ('criiam-fraisier-remontant', 3, 'Floraison → Grossissement fruits', 0.9, '04-10', 1, NULL),
  ('criiam-fraisier-remontant', 4, 'Grossissement fruits → Récolte', 0.7, '05-01', 1, NULL),
  ('criiam-haricot', 1, '30 j après levée → Floraison', 0.6, NULL, 0, NULL),
  ('criiam-haricot', 2, 'Floraison → Formation gousses', 0.8, NULL, 0, NULL),
  ('criiam-haricot', 3, 'Formation gousses → Récolte', 1, NULL, 0, NULL),
  ('criiam-melon', 1, 'Plantation → Début floraison', 0.4, NULL, 0, NULL),
  ('criiam-melon', 2, 'Début floraison → Nouaison', 0.6, NULL, 0, NULL),
  ('criiam-melon', 3, 'Nouaison → Grossissement fruits', 1, NULL, 0, NULL),
  ('criiam-melon', 4, 'Grossissement fruits → En cours de récolte', 0.65, NULL, 0, NULL),
  ('criiam-oignon', 1, 'Levée → 30 j', 0.6, NULL, 0, NULL),
  ('criiam-oignon', 2, '30 → 60 j', 0.8, NULL, 0, NULL),
  ('criiam-oignon', 3, '60 j → Début maturité', 1, NULL, 0, NULL),
  ('criiam-oignon', 4, 'Début maturité → 20 j avant récolte', 1.1, NULL, 0, NULL),
  ('criiam-oignon', 5, '20 j avant récolte → Récolte', 0.5, NULL, 0, NULL),
  ('criiam-poireau', 1, 'Reprise → Récolte', 0.7, NULL, 0, NULL),
  ('criiam-poivron', 1, 'Plantation → Début floraison', 0.5, NULL, 0, NULL),
  ('criiam-poivron', 2, 'Début floraison → Croissance 3e étage', 0.6, NULL, 0, NULL),
  ('criiam-poivron', 3, 'Croissance 3e étage → Mi-récolte', 0.7, NULL, 0, NULL),
  ('criiam-poivron', 4, 'Mi-récolte → Fin récolte', 0.6, NULL, 0, NULL),
  ('criiam-pomme-de-terre', 1, 'Levée → 20 j', 0.5, NULL, 0, NULL),
  ('criiam-pomme-de-terre', 2, '20 j → Fin tubérisation', 1.1, NULL, 0, NULL),
  ('criiam-pomme-de-terre', 3, 'Fin tubérisation → 20 j avant récolte', 0.6, NULL, 0, NULL),
  ('criiam-pomme-de-terre', 4, '20 j avant récolte → Récolte', 0, NULL, 0, NULL),
  ('criiam-salade-ete', 1, 'Plantation → Début croissance active', 0.4, NULL, 0, NULL),
  ('criiam-salade-ete', 2, 'Début croissance active → Récolte', 0.7, NULL, 0, NULL),
  ('criiam-tomate', 1, 'Plantation → Reprise', 0.2, NULL, 0, NULL),
  ('criiam-tomate', 2, 'Reprise → Floraison 3e bouquet', 0.6, NULL, 0, NULL),
  ('criiam-tomate', 3, 'Floraison 3e bouquet → Mi-récolte', 0.9, NULL, 0, NULL),
  ('criiam-tomate', 4, 'Mi-récolte → Fin culture', 0.7, NULL, 0, NULL);
--> statement-breakpoint
INSERT INTO `irrigation_crop_reference_seasons` (`reference_id`, `set_number`, `initial_days`, `development_days`, `mid_days`, `late_days`)
VALUES
  ('criiam-ail', 1, NULL, NULL, NULL, NULL),
  ('criiam-aubergine', 1, NULL, NULL, NULL, NULL),
  ('criiam-betterave', 1, NULL, NULL, NULL, NULL),
  ('criiam-betterave', 2, NULL, NULL, NULL, NULL),
  ('criiam-carotte', 1, NULL, NULL, NULL, NULL),
  ('criiam-chou-fleur', 1, NULL, NULL, NULL, NULL),
  ('criiam-chou-fleur', 2, NULL, NULL, NULL, NULL),
  ('criiam-courgette', 1, NULL, NULL, NULL, NULL),
  ('criiam-haricot', 1, NULL, NULL, NULL, NULL),
  ('criiam-melon', 1, NULL, NULL, NULL, NULL),
  ('criiam-oignon', 1, NULL, NULL, NULL, NULL),
  ('criiam-poireau', 1, NULL, NULL, NULL, NULL),
  ('criiam-poivron', 1, NULL, NULL, NULL, NULL),
  ('criiam-pomme-de-terre', 1, NULL, NULL, NULL, NULL),
  ('criiam-salade-ete', 1, NULL, NULL, NULL, NULL),
  ('criiam-salade-ete', 2, NULL, NULL, NULL, NULL),
  ('criiam-salade-ete', 3, NULL, NULL, NULL, NULL),
  ('criiam-tomate', 1, NULL, NULL, NULL, NULL),
  ('fao-brocoli', 1, 20, 30, 20, 10),
  ('fao-brocoli', 2, 30, 35, 90, 40),
  ('fao-celeri', 1, 25, 40, 45, 15),
  ('fao-concombre', 1, 20, 30, 40, 15),
  ('fao-cruciferes', 1, 20, 30, 20, 10),
  ('fao-cruciferes', 2, 30, 35, 90, 40),
  ('fao-epinard', 1, 20, 20, 15, 5),
  ('fao-feve', 1, 90, 45, 40, 0),
  ('fao-navet', 1, 15, 25, 20, 10),
  ('fao-navet', 2, 25, 30, 25, 10),
  ('fao-oignon-vert', 1, 25, 30, 10, 5),
  ('fao-pasteque', 1, 20, 30, 30, 30),
  ('fao-patate-douce', 1, 20, 30, 60, 40),
  ('fao-petit-pois', 1, 15, 25, 35, 15),
  ('fao-potiron', 1, 20, 30, 30, 20),
  ('fao-radis', 1, 5, 10, 15, 5);
--> statement-breakpoint
-- Les mois de chaque jeu : un seul jeu par mois et par culture (clé primaire).
-- Betterave et navet : avril à août, puis septembre à mars ; chou-fleur et
-- crucifères : mars à août, puis septembre à février ; salade d'été : mars à
-- octobre, novembre à janvier, février.
WITH RECURSIVE `months`(`month`) AS (SELECT 1 UNION ALL SELECT `month` + 1 FROM `months` WHERE `month` < 12),
`single_set`(`reference_id`) AS (VALUES
  ('criiam-ail'), ('criiam-aubergine'), ('criiam-carotte'), ('criiam-courgette'), ('criiam-haricot'), ('criiam-melon'),
  ('criiam-oignon'), ('criiam-poireau'), ('criiam-poivron'), ('criiam-pomme-de-terre'), ('criiam-tomate'),
  ('fao-celeri'), ('fao-concombre'), ('fao-epinard'), ('fao-feve'), ('fao-oignon-vert'), ('fao-pasteque'),
  ('fao-patate-douce'), ('fao-petit-pois'), ('fao-potiron'), ('fao-radis')),
`spring_from_april`(`reference_id`) AS (VALUES ('criiam-betterave'), ('fao-navet')),
`spring_from_march`(`reference_id`) AS (VALUES ('criiam-chou-fleur'), ('fao-brocoli'), ('fao-cruciferes'))
INSERT INTO `irrigation_crop_reference_season_months` (`reference_id`, `month`, `set_number`)
SELECT `reference_id`, `month`, 1 FROM `single_set` CROSS JOIN `months`
UNION ALL
SELECT `reference_id`, `month`, CASE WHEN `month` BETWEEN 4 AND 8 THEN 1 ELSE 2 END FROM `spring_from_april` CROSS JOIN `months`
UNION ALL
SELECT `reference_id`, `month`, CASE WHEN `month` BETWEEN 3 AND 8 THEN 1 ELSE 2 END FROM `spring_from_march` CROSS JOIN `months`
UNION ALL
SELECT 'criiam-salade-ete', `month`, CASE WHEN `month` BETWEEN 3 AND 10 THEN 1 WHEN `month` = 2 THEN 3 ELSE 2 END FROM `months`;
--> statement-breakpoint
INSERT INTO `irrigation_crop_reference_stage_starts` (`reference_id`, `set_number`, `rank`, `anchor`, `duration`, `duration_unit`, `estimated`)
VALUES
  ('criiam-ail', 1, 1, 'implantation', 0, 'days', 0),
  ('criiam-ail', 1, 2, 'before-harvest', 45, 'days', 0),
  ('criiam-ail', 1, 3, 'before-harvest', 25, 'days', 0),
  ('criiam-ail', 1, 4, 'before-harvest', 20, 'days', 0),
  ('criiam-aubergine', 1, 1, 'implantation', 0, 'days', 0),
  ('criiam-aubergine', 1, 2, 'implantation', 21, 'days', 0),
  ('criiam-aubergine', 1, 3, 'implantation', 45, 'days', 1),
  ('criiam-aubergine', 1, 4, 'mid-harvest', NULL, 'days', 0),
  ('criiam-betterave', 1, 1, 'implantation', 0, 'days', 0),
  ('criiam-betterave', 1, 2, 'implantation', 30, 'days', 0),
  ('criiam-betterave', 1, 3, 'implantation', 60, 'days', 0),
  ('criiam-betterave', 2, 1, 'implantation', 0, 'days', 0),
  ('criiam-betterave', 2, 2, 'implantation', 30, 'days', 0),
  ('criiam-betterave', 2, 3, 'implantation', 80, 'days', 0),
  ('criiam-carotte', 1, 1, 'implantation', 0, 'days', 0),
  ('criiam-carotte', 1, 2, 'implantation', 30, 'days', 0),
  ('criiam-chou-fleur', 1, 1, 'implantation', 0, 'days', 0),
  ('criiam-chou-fleur', 1, 2, 'implantation', 35, 'days', 0),
  ('criiam-chou-fleur', 1, 3, 'implantation', 50, 'days', 1),
  ('criiam-chou-fleur', 2, 1, 'implantation', 0, 'days', 0),
  ('criiam-chou-fleur', 2, 2, 'implantation', 30, 'days', 0),
  ('criiam-chou-fleur', 2, 3, 'implantation', 155, 'days', 0),
  ('criiam-courgette', 1, 1, 'implantation', 0, 'days', 0),
  ('criiam-courgette', 1, 2, 'implantation', 20, 'days', 0),
  ('criiam-courgette', 1, 3, 'mid-harvest', NULL, 'days', 0),
  ('criiam-haricot', 1, 1, 'implantation', 0, 'days', 0),
  ('criiam-haricot', 1, 2, 'implantation', 40, 'days', 0),
  ('criiam-haricot', 1, 3, 'implantation', 50, 'days', 1),
  ('criiam-melon', 1, 1, 'implantation', 0, 'days', 0),
  ('criiam-melon', 1, 2, 'implantation', 25, 'days', 0),
  ('criiam-melon', 1, 3, 'implantation', 45, 'days', 0),
  ('criiam-melon', 1, 4, 'first-harvest', NULL, 'days', 0),
  ('criiam-oignon', 1, 1, 'emergence', 0, 'days', 0),
  ('criiam-oignon', 1, 2, 'emergence', 30, 'days', 0),
  ('criiam-oignon', 1, 3, 'emergence', 60, 'days', 0),
  ('criiam-oignon', 1, 4, 'before-harvest', 40, 'days', 0),
  ('criiam-oignon', 1, 5, 'before-harvest', 20, 'days', 0),
  ('criiam-poireau', 1, 1, 'implantation', 0, 'days', 0),
  ('criiam-poivron', 1, 1, 'implantation', 0, 'days', 0),
  ('criiam-poivron', 1, 2, 'implantation', 30, 'days', 0),
  ('criiam-poivron', 1, 3, 'implantation', 50, 'days', 1),
  ('criiam-poivron', 1, 4, 'mid-harvest', NULL, 'days', 0),
  ('criiam-pomme-de-terre', 1, 1, 'emergence', 0, 'days', 0),
  ('criiam-pomme-de-terre', 1, 2, 'emergence', 20, 'days', 0),
  ('criiam-pomme-de-terre', 1, 3, 'before-harvest', 30, 'days', 0),
  ('criiam-pomme-de-terre', 1, 4, 'before-harvest', 20, 'days', 0),
  ('criiam-salade-ete', 1, 1, 'implantation', 0, 'days', 0),
  ('criiam-salade-ete', 1, 2, 'implantation', 20, 'days', 0),
  ('criiam-salade-ete', 2, 1, 'implantation', 0, 'days', 0),
  ('criiam-salade-ete', 2, 2, 'implantation', 30, 'days', 0),
  ('criiam-salade-ete', 3, 1, 'implantation', 0, 'days', 0),
  ('criiam-salade-ete', 3, 2, 'implantation', 35, 'days', 0),
  ('criiam-tomate', 1, 1, 'implantation', 0, 'days', 0),
  ('criiam-tomate', 1, 2, 'implantation', 15, 'days', 0),
  ('criiam-tomate', 1, 3, 'implantation', 30, 'days', 1),
  ('criiam-tomate', 1, 4, 'mid-harvest', NULL, 'days', 0);
