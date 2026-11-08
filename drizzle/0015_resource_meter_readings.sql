-- Sous-tranche 3.1 bis : mesure et historique du débit des ressources
-- (docs/resource-flow-contract.md). Deux tables additives.
--
-- Les relevés du compteur d'une ressource. La durée d'arrêt est nulle sur le
-- premier relevé d'une chaîne, où elle n'a pas de sens. Un relevé marqué
-- meter_replaced coupe la chaîne : aucun débit n'est calculé entre lui et le
-- relevé qui le précède.
CREATE TABLE `irrigation_water_resource_meter_readings` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `resource_id` text NOT NULL,
  `taken_at` text NOT NULL,
  `meter_index_cubic_meters` real NOT NULL,
  `stopped_seconds` integer,
  `meter_replaced` integer DEFAULT 0 NOT NULL,
  `note` text,
  `actor_user_id` text NOT NULL,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  FOREIGN KEY (`resource_id`) REFERENCES `irrigation_water_resources`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_resource_meter_readings_index` CHECK (`meter_index_cubic_meters` >= 0),
  CONSTRAINT `chk_resource_meter_readings_stopped` CHECK (`stopped_seconds` IS NULL OR `stopped_seconds` >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_resource_meter_readings_instant` ON `irrigation_water_resource_meter_readings` (`resource_id`, `taken_at`);
--> statement-breakpoint
CREATE INDEX `idx_resource_meter_readings_workspace` ON `irrigation_water_resource_meter_readings` (`workspace_id`);
--> statement-breakpoint
-- Les décisions de débit de référence. Contrairement aux relevés, qui sont des
-- lectures et se corrigent, une révision est une décision : elle ne se réécrit
-- pas (D-006). Même patron que les révisions de limite de prélèvement.
CREATE TABLE `irrigation_water_resource_flow_revisions` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `resource_id` text NOT NULL,
  `flow_cubic_meters_per_hour` real NOT NULL,
  `valid_from` text NOT NULL,
  `valid_until` text,
  `from_reading_id` text,
  `to_reading_id` text,
  `reference_note` text,
  `actor_user_id` text NOT NULL,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  FOREIGN KEY (`resource_id`) REFERENCES `irrigation_water_resources`(`id`) ON DELETE restrict,
  FOREIGN KEY (`from_reading_id`) REFERENCES `irrigation_water_resource_meter_readings`(`id`) ON DELETE set null,
  FOREIGN KEY (`to_reading_id`) REFERENCES `irrigation_water_resource_meter_readings`(`id`) ON DELETE set null,
  CONSTRAINT `chk_resource_flow_revisions_flow` CHECK (`flow_cubic_meters_per_hour` >= 0),
  CONSTRAINT `chk_resource_flow_revisions_period` CHECK (`valid_until` IS NULL OR `valid_until` >= `valid_from`)
);
--> statement-breakpoint
CREATE INDEX `idx_resource_flow_revisions_resource_period` ON `irrigation_water_resource_flow_revisions` (`resource_id`, `valid_from`, `valid_until`, `created_at`);
--> statement-breakpoint
CREATE INDEX `idx_resource_flow_revisions_workspace` ON `irrigation_water_resource_flow_revisions` (`workspace_id`);
