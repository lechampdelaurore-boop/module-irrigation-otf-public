-- Extension 5 quinquies : les alertes météo par culture, la persistance
-- (docs/weather-crop-alerts-contract.md, « Les données », PR 2, D-058,
-- D-060).
--
-- 1. L'énergie solaire prévue du jour, en MJ/m², conservée à côté des
--    températures pour juger les aspersions ; absente, elle reste nulle
--    (D-003).
-- 2. Le jeu commun des seuils de gel et des délais de séchage, avec sa source,
--    la date du relevé et la confiance, écrit ici ; il appartient aux
--    migrations et n'est gardé ni contre la modification ni contre
--    l'effacement, pour que l'import d'un export puisse le réécrire.
-- 3. Le rattachement d'une espèce d'Ouvre ta ferme au jeu commun, par espèce
--    ou par exception de série, avec le seuil de dégâts propre à la ferme ;
--    révisions datées, jamais modifiées ni effacées (D-006).
-- 4. Le délai de séchage corrigé d'une espèce, ou retiré ; révisions.
-- 5. Les réglages de l'exploitation : alertes actives, horizon, curseur de
--    microclimat, seuils de l'aspersion ; révisions.
-- 6. Les alertes enregistrées, une au plus par sujet et par jour visé (gel,
--    aspersion) ou par série (séchage), avec les valeurs appliquées à
--    l'envoi et le résultat de l'envoi.
--
-- Migration additive (docs/migrations-contract.md) : une colonne nulle, cinq
-- tables, leurs index, six déclencheurs d'immuabilité et les lignes du jeu
-- commun ; rien d'autre n'est touché.
ALTER TABLE `irrigation_weather_daily_values` ADD COLUMN `solar_energy_mj_per_square_meter` real;
--> statement-breakpoint
CREATE TABLE `irrigation_crop_alert_common` (
  `key` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `damage_celsius` real,
  `drying_days` integer,
  `confidence` text NOT NULL,
  `source` text NOT NULL,
  `recorded_on` text NOT NULL,
  CONSTRAINT `chk_crop_alert_common_damage` CHECK (`damage_celsius` IS NULL OR `damage_celsius` BETWEEN -30 AND 10),
  CONSTRAINT `chk_crop_alert_common_drying` CHECK (`drying_days` IS NULL OR `drying_days` BETWEEN 1 AND 60)
);
--> statement-breakpoint
CREATE TABLE `irrigation_crop_frost_links` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `plant_id` text NOT NULL,
  `series_id` text,
  `common_key` text,
  `damage_celsius` real,
  `actor_user_id` text,
  `recorded_at` text NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  FOREIGN KEY (`common_key`) REFERENCES `irrigation_crop_alert_common`(`key`) ON DELETE restrict,
  CONSTRAINT `chk_crop_frost_link_ids` CHECK (length(`plant_id`) >= 1 AND (`series_id` IS NULL OR length(`series_id`) >= 1)),
  CONSTRAINT `chk_crop_frost_link_damage` CHECK (`damage_celsius` IS NULL OR (`damage_celsius` BETWEEN -30 AND 10 AND `damage_celsius` * 2 = round(`damage_celsius` * 2)))
);
--> statement-breakpoint
CREATE INDEX `idx_crop_frost_links_plant` ON `irrigation_crop_frost_links` (`workspace_id`, `plant_id`, `recorded_at`);
--> statement-breakpoint
CREATE TRIGGER `trg_crop_frost_links_no_update` BEFORE UPDATE ON `irrigation_crop_frost_links`
BEGIN
  SELECT RAISE(ABORT, 'CROP_ALERT_REVISION_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_crop_frost_links_no_delete` BEFORE DELETE ON `irrigation_crop_frost_links`
BEGIN
  SELECT RAISE(ABORT, 'CROP_ALERT_REVISION_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TABLE `irrigation_crop_drying_revisions` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `plant_id` text NOT NULL,
  `drying_days` integer,
  `actor_user_id` text,
  `recorded_at` text NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_crop_drying_plant` CHECK (length(`plant_id`) >= 1),
  CONSTRAINT `chk_crop_drying_days` CHECK (`drying_days` IS NULL OR `drying_days` BETWEEN 1 AND 60)
);
--> statement-breakpoint
CREATE INDEX `idx_crop_drying_revisions_plant` ON `irrigation_crop_drying_revisions` (`workspace_id`, `plant_id`, `recorded_at`);
--> statement-breakpoint
CREATE TRIGGER `trg_crop_drying_revisions_no_update` BEFORE UPDATE ON `irrigation_crop_drying_revisions`
BEGIN
  SELECT RAISE(ABORT, 'CROP_ALERT_REVISION_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_crop_drying_revisions_no_delete` BEFORE DELETE ON `irrigation_crop_drying_revisions`
BEGIN
  SELECT RAISE(ABORT, 'CROP_ALERT_REVISION_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TABLE `irrigation_crop_alert_settings` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `frost_active` integer NOT NULL,
  `drying_active` integer NOT NULL,
  `sprinkler_active` integer NOT NULL,
  `horizon_days` integer NOT NULL,
  `frost_offset_celsius` real NOT NULL,
  `sprinkler_max_temperature_celsius` real NOT NULL,
  `sprinkler_radiation_w_per_square_meter` integer NOT NULL,
  `actor_user_id` text,
  `recorded_at` text NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_crop_alert_settings_flags` CHECK (`frost_active` IN (0, 1) AND `drying_active` IN (0, 1) AND `sprinkler_active` IN (0, 1)),
  CONSTRAINT `chk_crop_alert_settings_horizon` CHECK (`horizon_days` BETWEEN 1 AND 7),
  CONSTRAINT `chk_crop_alert_settings_offset` CHECK (`frost_offset_celsius` BETWEEN -5 AND 5 AND `frost_offset_celsius` * 2 = round(`frost_offset_celsius` * 2)),
  CONSTRAINT `chk_crop_alert_settings_sprinkler` CHECK (`sprinkler_max_temperature_celsius` BETWEEN 0 AND 40 AND `sprinkler_radiation_w_per_square_meter` BETWEEN 50 AND 1000)
);
--> statement-breakpoint
CREATE INDEX `idx_crop_alert_settings_workspace` ON `irrigation_crop_alert_settings` (`workspace_id`, `recorded_at`);
--> statement-breakpoint
CREATE TRIGGER `trg_crop_alert_settings_no_update` BEFORE UPDATE ON `irrigation_crop_alert_settings`
BEGIN
  SELECT RAISE(ABORT, 'CROP_ALERT_REVISION_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_crop_alert_settings_no_delete` BEFORE DELETE ON `irrigation_crop_alert_settings`
BEGIN
  SELECT RAISE(ABORT, 'CROP_ALERT_REVISION_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TABLE `irrigation_crop_alerts` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `kind` text NOT NULL,
  `subject_key` text NOT NULL,
  `subject_version` text NOT NULL,
  `plant_id` text,
  `series_id` text,
  `name` text NOT NULL,
  `target_date` text NOT NULL,
  `damage_celsius` real,
  `margin_celsius` real,
  `offset_celsius` real,
  `drying_days` integer,
  `forecast_value` real,
  `unit` text,
  `forecasted_at` text,
  `detail` text,
  `sent_at` text NOT NULL,
  `delivery_status` text DEFAULT 'pending' NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_crop_alert_kind` CHECK (`kind` IN ('frost', 'drying', 'sprinkler')),
  CONSTRAINT `chk_crop_alert_unit` CHECK (`unit` IS NULL OR `unit` IN ('°C', 'W/m²')),
  CONSTRAINT `chk_crop_alert_date` CHECK (`target_date` GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]'),
  CONSTRAINT `chk_crop_alert_status` CHECK (`delivery_status` IN ('pending', 'sent', 'no-subscriber', 'retrying', 'failed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_crop_alert_subject_day` ON `irrigation_crop_alerts` (`workspace_id`, `kind`, `subject_key`, `subject_version`, `target_date`) WHERE `kind` != 'drying';
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_crop_alert_drying_series` ON `irrigation_crop_alerts` (`workspace_id`, `subject_key`) WHERE `kind` = 'drying';
--> statement-breakpoint
CREATE INDEX `idx_crop_alerts_workspace_sent` ON `irrigation_crop_alerts` (`workspace_id`, `sent_at`);
--> statement-breakpoint
INSERT INTO `irrigation_crop_alert_common` (`key`, `name`, `damage_celsius`, `drying_days`, `confidence`, `source`, `recorded_on`) VALUES
  ('ail', 'Ail', -10, 15, 'bonne', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source ; séchage : Tlaloc, non recoupée (proposition à valider, question 7 du contrat)', '2026-11-06'),
  ('aubergine', 'Aubergine', 0, NULL, 'bonne', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('betterave-rouge', 'Betterave rouge', -7, NULL, 'bonne', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('blette', 'Blette', -6, NULL, 'bonne', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('carotte', 'Carotte', -6, NULL, 'bonne', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('celeri-branche', 'Céleri branche', -2, NULL, 'moyenne', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('celeri-rave', 'Céleri-rave', -2, NULL, 'moyenne', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('chou-pomme', 'Chou pommé (blanc, rouge, Milan, pointu)', -3, NULL, 'choix du porteur, 6 nov. (le plus prudent)', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('chou-fleur', 'Chou-fleur', 0, NULL, 'choix du porteur, 6 nov. (le plus prudent)', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('concombre', 'Concombre', 0, NULL, 'bonne', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('courge', 'Courge', 0, 10, 'bonne', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source ; séchage : Tlaloc, non recoupée (proposition à valider, question 7 du contrat)', '2026-11-06'),
  ('courgette', 'Courgette', 0, NULL, 'bonne', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('epinard', 'Épinard', -8, NULL, 'bonne', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('fenouil', 'Fenouil', -2, NULL, 'moyenne', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('haricot', 'Haricot', 0, NULL, 'bonne', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('laitue-mesclun', 'Laitue, mesclun', -2, NULL, 'choix du porteur, 6 nov.', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('navet', 'Navet', -7, NULL, 'bonne', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('oignon-jaune', 'Oignon jaune', -6, NULL, 'bonne', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('petit-pois', 'Petit pois', -4, NULL, 'bonne', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('poireau', 'Poireau', -8, NULL, 'bonne', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('poivron', 'Poivron', 0, NULL, 'bonne', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('pomme-de-terre', 'Pomme de terre', 0, 14, 'choix du porteur, 6 nov. (le plus prudent)', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source ; séchage : Tlaloc, non recoupée (proposition à valider, question 7 du contrat)', '2026-11-06'),
  ('radis', 'Radis rond, radis botte, radis rave, radis noir', -4, NULL, 'bonne', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('tomate', 'Tomate', 0, NULL, 'bonne', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('mache', 'Mâche', -5, NULL, 'moyenne', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('roquette', 'Roquette', -4, NULL, 'moyenne', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('chicoree-frisee-scarole', 'Chicorée frisée, scarole', -4, NULL, 'moyenne', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('chicoree-pain-de-sucre', 'Chicorée pain de sucre', -3, NULL, 'moyenne', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('radicchio', 'Radicchio', -4, NULL, 'moyenne', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('panais', 'Panais', -6, NULL, 'décision François', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('rutabaga', 'Rutabaga', -9.5, NULL, 'moyenne', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('chou-kale', 'Chou kale', -9.5, NULL, 'moyenne', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('chou-de-bruxelles', 'Chou de Bruxelles', -7, NULL, 'moyenne', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('brocoli', 'Brocoli', -2, NULL, 'choix du porteur, 6 nov. (le plus prudent)', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('chou-rave', 'Chou-rave', -2, NULL, 'choix du porteur, 6 nov. (le plus prudent)', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('chou-chinois', 'Chou chinois, pë-tsaï', -4, NULL, 'moyenne', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('pak-choi', 'Pak choï', 0, NULL, 'faible', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('moutarde-mizuna', 'Moutarde, mizuna, légumes asiatiques', -4, NULL, 'moyenne', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('feve', 'Fève', -4, NULL, 'moyenne', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('oignon-botte-aillet', 'Oignon botte, aillet', -4, NULL, 'moyenne', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('persil', 'Persil', -7, NULL, 'moyenne', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('coriandre', 'Coriandre', -9.5, NULL, 'moyenne', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('aneth-cerfeuil', 'Aneth, cerfeuil', -4, NULL, 'moyenne', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('oseille', 'Oseille', -9.5, NULL, 'moyenne', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('rhubarbe', 'Rhubarbe', -4, NULL, 'moyenne', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('basilic', 'Basilic', 2, NULL, 'moyenne', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('mais-doux', 'Maïs doux', 0, NULL, 'bonne', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('melon', 'Melon', 0, 7, 'bonne', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source ; séchage : Tlaloc, non recoupée (proposition à valider, question 7 du contrat)', '2026-11-06'),
  ('pasteque', 'Pastèque', 0, NULL, 'moyenne', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('patate-douce', 'Patate douce', 0, NULL, 'moyenne', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('artichaut', 'Artichaut', -2, NULL, 'faible, acceptée', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('arroche', 'Arroche (comme l''épinard)', -8, NULL, 'analogie', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('fraisier', 'Fraisier', NULL, NULL, 'aucune valeur trouvée', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('asperge', 'Asperge', NULL, NULL, 'aucune valeur trouvée', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('topinambour', 'Topinambour', NULL, NULL, 'récolte en sol, pas d''alerte utile', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('claytonia', 'Claytonia', NULL, NULL, 'source de seconde main, inutilisable', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('cresson-de-terre', 'Cresson de terre', NULL, NULL, 'source de seconde main, inutilisable', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06'),
  ('oseille-feuilles-etroites', 'Oseille à feuilles étroites', NULL, NULL, 'source de seconde main, inutilisable', 'Fiche FRAB AuRA (SMACC 2), ITAB, CA 82, GRAB et références nord-américaines, relevé du 6 novembre 2026 (seuils-gel-legumes-etendus.md), valeurs à recontrôler à la source', '2026-11-06');
