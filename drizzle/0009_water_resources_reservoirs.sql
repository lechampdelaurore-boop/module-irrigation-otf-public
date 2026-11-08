CREATE TABLE `irrigation_water_resources` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `name` text NOT NULL,
  `type` text NOT NULL,
  `nominal_flow_cubic_meters_per_hour` real NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `available_from` text,
  `available_until` text,
  `notes` text,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_water_resources_flow` CHECK (`nominal_flow_cubic_meters_per_hour` >= 0),
  CONSTRAINT `chk_water_resources_status` CHECK (`status` IN ('active', 'inactive')),
  CONSTRAINT `chk_water_resources_period` CHECK (`available_until` IS NULL OR `available_from` IS NULL OR `available_until` >= `available_from`)
);
--> statement-breakpoint
CREATE INDEX `idx_water_resources_workspace_status` ON `irrigation_water_resources` (`workspace_id`, `status`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_water_resources_workspace_name` ON `irrigation_water_resources` (`workspace_id`, `name`);
--> statement-breakpoint
CREATE TABLE `irrigation_water_resource_limit_revisions` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `resource_id` text NOT NULL,
  `enabled` integer NOT NULL,
  `max_cubic_meters_per_day` real,
  `valid_from` text NOT NULL,
  `valid_until` text,
  `reference_note` text,
  `actor_user_id` text NOT NULL,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  FOREIGN KEY (`resource_id`) REFERENCES `irrigation_water_resources`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_water_resource_limits_period` CHECK (`valid_until` IS NULL OR `valid_until` >= `valid_from`),
  CONSTRAINT `chk_water_resource_limits_amount` CHECK ((`enabled` = 1 AND `max_cubic_meters_per_day` IS NOT NULL AND `max_cubic_meters_per_day` > 0) OR (`enabled` = 0 AND `max_cubic_meters_per_day` IS NULL))
);
--> statement-breakpoint
CREATE INDEX `idx_water_resource_limits_resource_period` ON `irrigation_water_resource_limit_revisions` (`resource_id`, `valid_from`, `valid_until`, `created_at`);
--> statement-breakpoint
CREATE INDEX `idx_water_resource_limits_workspace` ON `irrigation_water_resource_limit_revisions` (`workspace_id`);
--> statement-breakpoint
CREATE TABLE `irrigation_water_reservoirs` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `name` text NOT NULL,
  `type` text NOT NULL,
  `capacity_cubic_meters` real NOT NULL,
  `current_volume_cubic_meters` real,
  `current_volume_observed_at` text,
  `minimum_safety_cubic_meters` real DEFAULT 0 NOT NULL,
  `exposed_surface_square_meters` real DEFAULT 0 NOT NULL,
  `receives_rain` integer DEFAULT 0 NOT NULL,
  `evaporation_enabled` integer DEFAULT 0 NOT NULL,
  `evaporation_coefficient` real DEFAULT 1 NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `notes` text,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_water_reservoirs_capacity` CHECK (`capacity_cubic_meters` > 0),
  CONSTRAINT `chk_water_reservoirs_current_volume` CHECK (`current_volume_cubic_meters` IS NULL OR (`current_volume_cubic_meters` >= 0 AND `current_volume_cubic_meters` <= `capacity_cubic_meters`)),
  CONSTRAINT `chk_water_reservoirs_observation` CHECK ((`current_volume_cubic_meters` IS NULL AND `current_volume_observed_at` IS NULL) OR (`current_volume_cubic_meters` IS NOT NULL AND `current_volume_observed_at` IS NOT NULL)),
  CONSTRAINT `chk_water_reservoirs_minimum` CHECK (`minimum_safety_cubic_meters` >= 0 AND `minimum_safety_cubic_meters` <= `capacity_cubic_meters`),
  CONSTRAINT `chk_water_reservoirs_surface` CHECK (`exposed_surface_square_meters` >= 0),
  CONSTRAINT `chk_water_reservoirs_coefficient` CHECK (`evaporation_coefficient` >= 0),
  CONSTRAINT `chk_water_reservoirs_status` CHECK (`status` IN ('active', 'inactive'))
);
--> statement-breakpoint
CREATE INDEX `idx_water_reservoirs_workspace_status` ON `irrigation_water_reservoirs` (`workspace_id`, `status`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_water_reservoirs_workspace_name` ON `irrigation_water_reservoirs` (`workspace_id`, `name`);
--> statement-breakpoint
CREATE TABLE `irrigation_water_resource_reservoir_links` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `resource_id` text NOT NULL,
  `reservoir_id` text NOT NULL,
  `fill_mode` text NOT NULL,
  `active` integer DEFAULT 1 NOT NULL,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  FOREIGN KEY (`resource_id`) REFERENCES `irrigation_water_resources`(`id`) ON DELETE restrict,
  FOREIGN KEY (`reservoir_id`) REFERENCES `irrigation_water_reservoirs`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_water_resource_links_mode` CHECK (`fill_mode` IN ('automatic', 'manual'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_water_resource_reservoir_link` ON `irrigation_water_resource_reservoir_links` (`resource_id`, `reservoir_id`);
--> statement-breakpoint
CREATE INDEX `idx_water_resource_links_workspace` ON `irrigation_water_resource_reservoir_links` (`workspace_id`);
--> statement-breakpoint
CREATE INDEX `idx_water_resource_links_reservoir` ON `irrigation_water_resource_reservoir_links` (`reservoir_id`);
--> statement-breakpoint
CREATE TABLE `irrigation_water_reservoir_links` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `upstream_reservoir_id` text NOT NULL,
  `downstream_reservoir_id` text NOT NULL,
  `transfer_mode` text NOT NULL,
  `active` integer DEFAULT 1 NOT NULL,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  FOREIGN KEY (`upstream_reservoir_id`) REFERENCES `irrigation_water_reservoirs`(`id`) ON DELETE restrict,
  FOREIGN KEY (`downstream_reservoir_id`) REFERENCES `irrigation_water_reservoirs`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_water_reservoir_links_distinct` CHECK (`upstream_reservoir_id` != `downstream_reservoir_id`),
  CONSTRAINT `chk_water_reservoir_links_mode` CHECK (`transfer_mode` IN ('automatic', 'manual'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_water_reservoir_link` ON `irrigation_water_reservoir_links` (`upstream_reservoir_id`, `downstream_reservoir_id`);
--> statement-breakpoint
CREATE INDEX `idx_water_reservoir_links_workspace` ON `irrigation_water_reservoir_links` (`workspace_id`);
--> statement-breakpoint
CREATE INDEX `idx_water_reservoir_links_downstream` ON `irrigation_water_reservoir_links` (`downstream_reservoir_id`);
--> statement-breakpoint
CREATE TABLE `irrigation_water_supply_defaults` (
  `workspace_id` text PRIMARY KEY NOT NULL,
  `source_kind` text NOT NULL,
  `resource_id` text,
  `reservoir_id` text,
  `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  FOREIGN KEY (`resource_id`) REFERENCES `irrigation_water_resources`(`id`) ON DELETE restrict,
  FOREIGN KEY (`reservoir_id`) REFERENCES `irrigation_water_reservoirs`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_water_supply_default_source` CHECK ((`source_kind` = 'resource' AND `resource_id` IS NOT NULL AND `reservoir_id` IS NULL) OR (`source_kind` = 'reservoir' AND `resource_id` IS NULL AND `reservoir_id` IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE `irrigation_water_stock_movements` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `reservoir_id` text,
  `resource_id` text,
  `kind` text NOT NULL,
  `volume_delta_cubic_meters` real NOT NULL,
  `occurred_at` text NOT NULL,
  `previous_volume_cubic_meters` real,
  `resulting_volume_cubic_meters` real,
  `reason` text,
  `actor_user_id` text,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  FOREIGN KEY (`reservoir_id`) REFERENCES `irrigation_water_reservoirs`(`id`) ON DELETE restrict,
  FOREIGN KEY (`resource_id`) REFERENCES `irrigation_water_resources`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_water_stock_movements_non_zero` CHECK (`volume_delta_cubic_meters` != 0 OR `kind` = 'manual_correction'),
  CONSTRAINT `chk_water_stock_movements_target` CHECK (`reservoir_id` IS NOT NULL OR (`kind` = 'direct_irrigation_withdrawal' AND `resource_id` IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `idx_water_stock_movements_reservoir_time` ON `irrigation_water_stock_movements` (`reservoir_id`, `occurred_at`);
--> statement-breakpoint
CREATE INDEX `idx_water_stock_movements_resource_time` ON `irrigation_water_stock_movements` (`resource_id`, `occurred_at`);
--> statement-breakpoint
CREATE INDEX `idx_water_stock_movements_workspace` ON `irrigation_water_stock_movements` (`workspace_id`);
--> statement-breakpoint
CREATE TABLE `irrigation_water_infrastructure_log` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `entity_type` text NOT NULL,
  `entity_id` text NOT NULL,
  `action` text NOT NULL,
  `payload` text NOT NULL,
  `actor_user_id` text NOT NULL,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_water_infrastructure_log_entity` ON `irrigation_water_infrastructure_log` (`workspace_id`, `entity_type`, `entity_id`);
