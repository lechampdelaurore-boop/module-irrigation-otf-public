-- Extension 5 bis : les alertes météo paramétrables
-- (docs/weather-alerts-contract.md, D-050).
--
-- 1. Les températures minimale et maximale prévues du jour sont conservées à
--    côté de la pluie et de l'ET0, pour évaluer les alertes après chaque
--    écriture de prévisions et montrer la valeur prévue à l'écran. Absentes,
--    elles restent nulles (D-003) ; jamais saisies à la main.
-- 2. Un critère appartient à une exploitation. Ses réglages vivent dans des
--    versions immuables : modifier le critère en ajoute une (D-006), l'activer
--    ou le désactiver ne touche que le critère, le supprimer le marque
--    supprimé sans effacer son historique.
-- 3. Une alerte par version de critère et par jour visé, au plus : la clé
--    unique est la règle de répétition, et elle tient même quand deux
--    évaluations se croisent. L'alerte retient la valeur prévue, son unité, la
--    date de la prévision, l'heure d'envoi et le résultat de l'envoi.
--
-- Migration additive (docs/migrations-contract.md) : deux colonnes nulles,
-- trois tables, deux index.
ALTER TABLE `irrigation_weather_daily_values` ADD COLUMN `minimum_temperature_celsius` real;
--> statement-breakpoint
ALTER TABLE `irrigation_weather_daily_values` ADD COLUMN `maximum_temperature_celsius` real;
--> statement-breakpoint
CREATE TABLE `irrigation_weather_alert_criteria` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `current_version` integer NOT NULL,
  `active` integer DEFAULT 1 NOT NULL,
  `deleted_at` text,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_weather_alert_criteria_version` CHECK (`current_version` >= 1),
  CONSTRAINT `chk_weather_alert_criteria_active` CHECK (`active` IN (0, 1))
);
--> statement-breakpoint
CREATE INDEX `idx_weather_alert_criteria_workspace` ON `irrigation_weather_alert_criteria` (`workspace_id`, `deleted_at`);
--> statement-breakpoint
CREATE TABLE `irrigation_weather_alert_criterion_versions` (
  `criterion_id` text NOT NULL,
  `version` integer NOT NULL,
  `field` text NOT NULL,
  `direction` text NOT NULL,
  `threshold` real NOT NULL,
  `horizon_days` integer NOT NULL,
  `label` text,
  `actor_user_id` text,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  PRIMARY KEY (`criterion_id`, `version`),
  FOREIGN KEY (`criterion_id`) REFERENCES `irrigation_weather_alert_criteria`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_weather_alert_version_number` CHECK (`version` >= 1),
  CONSTRAINT `chk_weather_alert_version_field` CHECK (`field` IN ('minimum-temperature', 'maximum-temperature', 'precipitation')),
  CONSTRAINT `chk_weather_alert_version_direction` CHECK (`direction` IN ('below', 'above')),
  CONSTRAINT `chk_weather_alert_version_threshold` CHECK (
    (`field` = 'precipitation' AND `threshold` BETWEEN 0 AND 300)
    OR (`field` != 'precipitation' AND `threshold` BETWEEN -30 AND 50)),
  CONSTRAINT `chk_weather_alert_version_horizon` CHECK (`horizon_days` BETWEEN 1 AND 7),
  CONSTRAINT `chk_weather_alert_version_label` CHECK (`label` IS NULL OR length(`label`) BETWEEN 1 AND 60)
);
--> statement-breakpoint
CREATE TABLE `irrigation_weather_alerts` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `criterion_id` text NOT NULL,
  `criterion_version` integer NOT NULL,
  `target_date` text NOT NULL,
  `forecast_value` real NOT NULL,
  `unit` text NOT NULL,
  `forecasted_at` text NOT NULL,
  `sent_at` text NOT NULL,
  `delivery_status` text DEFAULT 'pending' NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  FOREIGN KEY (`criterion_id`, `criterion_version`) REFERENCES `irrigation_weather_alert_criterion_versions`(`criterion_id`, `version`) ON DELETE restrict,
  CONSTRAINT `chk_weather_alert_unit` CHECK (`unit` IN ('°C', 'mm')),
  CONSTRAINT `chk_weather_alert_status` CHECK (`delivery_status` IN ('pending', 'sent', 'no-subscriber', 'retrying', 'failed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_weather_alert_criterion_day` ON `irrigation_weather_alerts` (`criterion_id`, `criterion_version`, `target_date`);
--> statement-breakpoint
CREATE INDEX `idx_weather_alerts_workspace_sent` ON `irrigation_weather_alerts` (`workspace_id`, `sent_at`);
