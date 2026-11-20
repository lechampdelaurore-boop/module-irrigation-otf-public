-- Tranche 4, sous-tranche 4.5, PR 3 : l'effacement d'une ferme
-- (docs/tranche-4-contract.md, section 10 bis, F563, et section 10 bis.17,
-- F640 à F648).
--
-- Une personne demande l'effacement de son espace sur une ferme : sept jours
-- après, annulable entre-temps, le matin efface par lots tout ce que
-- l'espace garde, puis l'espace lui-même. Cette table est l'enregistrement
-- minimal de la demande, qui reste après l'effacement pour prouver qu'il a
-- été fait : l'identifiant interne de l'espace, l'état, et des dates. Ni
-- nom, ni personne, ni ferme, ni contenu ; pas de clé étrangère, l'espace
-- disparaissant. Une seule demande ouverte (en attente ou en cours) par
-- espace.
--
-- Les tables que le module garde immuables (déclarations du sol, révisions
-- des alertes, coefficients corrigés…) refusent tout effacement de ligne.
-- Leurs déclencheurs sont recréés à l'identique, avec une seule exception :
-- les lignes d'un espace dont l'effacement est en cours (`erasing`). Un
-- `DROP TRIGGER` ne touche à aucune donnée ; chaque déclencheur est recréé
-- dans la même migration, et le code n'efface jamais dans ces tables
-- ailleurs que dans l'effacement d'une ferme (procédure exceptionnelle des
-- migrations, justifiée par D-246).
--
-- Migration additive pour les données (docs/migrations-contract.md) : une
-- table et un index ; aucune ligne n'est écrite, aucune ligne existante ne
-- change.
CREATE TABLE `irrigation_farm_erasures` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `state` text DEFAULT 'pending' NOT NULL,
  `requested_at` text NOT NULL,
  `erase_after` text NOT NULL,
  `cancelled_at` text,
  `started_at` text,
  `erased_at` text,
  CONSTRAINT "chk_irrigation_farm_erasures_state" CHECK("irrigation_farm_erasures"."state" IN ('pending', 'erasing', 'erased', 'cancelled')),
  CONSTRAINT "chk_irrigation_farm_erasures_cancelled" CHECK(("irrigation_farm_erasures"."state" = 'cancelled') = ("irrigation_farm_erasures"."cancelled_at" IS NOT NULL)),
  CONSTRAINT "chk_irrigation_farm_erasures_erased" CHECK(("irrigation_farm_erasures"."state" = 'erased') = ("irrigation_farm_erasures"."erased_at" IS NOT NULL)),
  CONSTRAINT "chk_irrigation_farm_erasures_started" CHECK(("irrigation_farm_erasures"."state" IN ('erasing', 'erased')) = ("irrigation_farm_erasures"."started_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_irrigation_farm_erasures_open` ON `irrigation_farm_erasures` (`workspace_id`) WHERE `state` IN ('pending', 'erasing');
--> statement-breakpoint
DROP TRIGGER `trg_crop_alert_settings_no_delete`;
--> statement-breakpoint
CREATE TRIGGER `trg_crop_alert_settings_no_delete` BEFORE DELETE ON `irrigation_crop_alert_settings`
WHEN NOT EXISTS (SELECT 1 FROM `irrigation_farm_erasures` WHERE `workspace_id` = OLD.`workspace_id` AND `state` = 'erasing')
BEGIN
  SELECT RAISE(ABORT, 'CROP_ALERT_REVISION_IMMUTABLE');
END;
--> statement-breakpoint
DROP TRIGGER `trg_crop_drying_revisions_no_delete`;
--> statement-breakpoint
CREATE TRIGGER `trg_crop_drying_revisions_no_delete` BEFORE DELETE ON `irrigation_crop_drying_revisions`
WHEN NOT EXISTS (SELECT 1 FROM `irrigation_farm_erasures` WHERE `workspace_id` = OLD.`workspace_id` AND `state` = 'erasing')
BEGIN
  SELECT RAISE(ABORT, 'CROP_ALERT_REVISION_IMMUTABLE');
END;
--> statement-breakpoint
DROP TRIGGER `trg_crop_frost_links_no_delete`;
--> statement-breakpoint
CREATE TRIGGER `trg_crop_frost_links_no_delete` BEFORE DELETE ON `irrigation_crop_frost_links`
WHEN NOT EXISTS (SELECT 1 FROM `irrigation_farm_erasures` WHERE `workspace_id` = OLD.`workspace_id` AND `state` = 'erasing')
BEGIN
  SELECT RAISE(ABORT, 'CROP_ALERT_REVISION_IMMUTABLE');
END;
--> statement-breakpoint
DROP TRIGGER `trg_crop_kc_overrides_no_delete`;
--> statement-breakpoint
CREATE TRIGGER `trg_crop_kc_overrides_no_delete` BEFORE DELETE ON `irrigation_crop_kc_overrides`
WHEN NOT EXISTS (SELECT 1 FROM `irrigation_farm_erasures` WHERE `workspace_id` = OLD.`workspace_id` AND `state` = 'erasing')
BEGIN
  SELECT RAISE(ABORT, 'CROP_KC_OVERRIDE_IMMUTABLE');
END;
--> statement-breakpoint
DROP TRIGGER `trg_crop_shelter_factors_no_delete`;
--> statement-breakpoint
CREATE TRIGGER `trg_crop_shelter_factors_no_delete` BEFORE DELETE ON `irrigation_crop_shelter_factors`
WHEN NOT EXISTS (SELECT 1 FROM `irrigation_farm_erasures` WHERE `workspace_id` = OLD.`workspace_id` AND `state` = 'erasing')
BEGIN
  SELECT RAISE(ABORT, 'CROP_SHELTER_FACTOR_IMMUTABLE');
END;
--> statement-breakpoint
DROP TRIGGER `trg_crop_stage_declarations_no_delete`;
--> statement-breakpoint
CREATE TRIGGER `trg_crop_stage_declarations_no_delete` BEFORE DELETE ON `irrigation_crop_stage_declarations`
WHEN NOT EXISTS (SELECT 1 FROM `irrigation_farm_erasures` WHERE `workspace_id` = OLD.`workspace_id` AND `state` = 'erasing')
BEGIN
  SELECT RAISE(ABORT, 'CROP_STAGE_DECLARATION_IMMUTABLE');
END;
--> statement-breakpoint
DROP TRIGGER `trg_soil_observations_no_delete`;
--> statement-breakpoint
CREATE TRIGGER `trg_soil_observations_no_delete` BEFORE DELETE ON `irrigation_soil_observations`
WHEN NOT EXISTS (SELECT 1 FROM `irrigation_farm_erasures` WHERE `workspace_id` = OLD.`workspace_id` AND `state` = 'erasing')
BEGIN
  SELECT RAISE(ABORT, 'SOIL_OBSERVATION_IMMUTABLE');
END;
--> statement-breakpoint
DROP TRIGGER `trg_soil_records_no_delete`;
--> statement-breakpoint
CREATE TRIGGER `trg_soil_records_no_delete` BEFORE DELETE ON `irrigation_soil_records`
WHEN NOT EXISTS (SELECT 1 FROM `irrigation_farm_erasures` WHERE `workspace_id` = OLD.`workspace_id` AND `state` = 'erasing')
BEGIN
  SELECT RAISE(ABORT, 'SOIL_RECORD_IMMUTABLE');
END;
--> statement-breakpoint
DROP TRIGGER `trg_soil_rooting_profiles_no_delete`;
--> statement-breakpoint
CREATE TRIGGER `trg_soil_rooting_profiles_no_delete` BEFORE DELETE ON `irrigation_soil_rooting_profiles`
WHEN OLD.`workspace_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `irrigation_farm_erasures` WHERE `workspace_id` = OLD.`workspace_id` AND `state` = 'erasing')
BEGIN
  SELECT RAISE(ABORT, 'SOIL_ROOTING_PROFILE_IMMUTABLE');
END;
--> statement-breakpoint
DROP TRIGGER `trg_soil_rooting_stages_no_delete`;
--> statement-breakpoint
CREATE TRIGGER `trg_soil_rooting_stages_no_delete` BEFORE DELETE ON `irrigation_soil_rooting_stages`
WHEN (SELECT `workspace_id` FROM `irrigation_soil_rooting_profiles` WHERE `id` = OLD.`profile_id`) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM `irrigation_farm_erasures` AS erasure
    JOIN `irrigation_soil_rooting_profiles` AS profile ON profile.`workspace_id` = erasure.`workspace_id`
    WHERE profile.`id` = OLD.`profile_id` AND erasure.`state` = 'erasing'
  )
BEGIN
  SELECT RAISE(ABORT, 'SOIL_ROOTING_PROFILE_IMMUTABLE');
END;
--> statement-breakpoint
DROP TRIGGER `trg_soil_settings_no_delete`;
--> statement-breakpoint
CREATE TRIGGER `trg_soil_settings_no_delete` BEFORE DELETE ON `irrigation_soil_settings`
WHEN NOT EXISTS (SELECT 1 FROM `irrigation_farm_erasures` WHERE `workspace_id` = OLD.`workspace_id` AND `state` = 'erasing')
BEGIN
  SELECT RAISE(ABORT, 'SOIL_SETTINGS_IMMUTABLE');
END;
--> statement-breakpoint
DROP TRIGGER `trg_soil_surface_declarations_no_delete`;
--> statement-breakpoint
CREATE TRIGGER `trg_soil_surface_declarations_no_delete` BEFORE DELETE ON `irrigation_soil_surface_declarations`
WHEN NOT EXISTS (SELECT 1 FROM `irrigation_farm_erasures` WHERE `workspace_id` = OLD.`workspace_id` AND `state` = 'erasing')
BEGIN
  SELECT RAISE(ABORT, 'SOIL_SURFACE_DECLARATION_IMMUTABLE');
END;
