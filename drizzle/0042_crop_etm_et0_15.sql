-- Borne haute de l'ET0 du jour portée de 12 à 15 mm/j, pour toutes les
-- fermes (docs/tranche-4-contract.md, F424 réponse Q11 ; précision F591,
-- D-232 ; contrat commun MC-37, accepté par Nicolas le 20 novembre 2026).
--
-- La contrainte `chk_crop_etm_et0` de la table des ETM du jour (migration
-- 0023) borne l'ET0 à 12 : SQLite ne modifie pas une contrainte en place, la
-- table est recréée (règle 3 de docs/migrations-contract.md : exceptionnel,
-- PR dédiée, après export de la base, justifié par D-232). Les lignes sont
-- copiées telles quelles, colonne par colonne ; l'index est recréé. Aucune
-- table ne pointe vers celle-ci ; aucune valeur ne change.
CREATE TABLE `irrigation_crop_etm_days_new` (
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
    OR (`et0_mm` IS NOT NULL AND `et0_mm` >= 0 AND `et0_mm` <= 15
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
INSERT INTO `irrigation_crop_etm_days_new` (`workspace_id`, `season`, `otf_bed_id`, `date`, `status`, `etm_mm`, `et0_mm`, `et0_nature`, `irrigation_stop`, `series_id`, `cultivation_id`, `plant_id`, `crop_key`, `kc_source`, `stage_rank`, `stage_origin`, `kc`, `reference_kc`, `kc_overridden`, `abatement`, `kc_smoothed`, `shelter_factor`, `mulch_factor`, `shade_factor`, `shade_net_rate`, `computed_at`)
  SELECT `workspace_id`, `season`, `otf_bed_id`, `date`, `status`, `etm_mm`, `et0_mm`, `et0_nature`, `irrigation_stop`, `series_id`, `cultivation_id`, `plant_id`, `crop_key`, `kc_source`, `stage_rank`, `stage_origin`, `kc`, `reference_kc`, `kc_overridden`, `abatement`, `kc_smoothed`, `shelter_factor`, `mulch_factor`, `shade_factor`, `shade_net_rate`, `computed_at` FROM `irrigation_crop_etm_days`;
--> statement-breakpoint
DROP TABLE `irrigation_crop_etm_days`;
--> statement-breakpoint
ALTER TABLE `irrigation_crop_etm_days_new` RENAME TO `irrigation_crop_etm_days`;
--> statement-breakpoint
CREATE INDEX `idx_crop_etm_days_date` ON `irrigation_crop_etm_days` (`workspace_id`, `season`, `date`);
