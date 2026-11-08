ALTER TABLE `irrigation_workspaces` ADD `hydraulic_revision` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TRIGGER `trg_irrigation_workspaces_hydraulic_revision`
BEFORE UPDATE OF `hydraulic_revision` ON `irrigation_workspaces`
WHEN NEW.`hydraulic_revision` != OLD.`hydraulic_revision` + 1
BEGIN
  SELECT RAISE(ABORT, 'HYDRAULIC_CHANGED');
END;
--> statement-breakpoint
CREATE TABLE `irrigation_pumps` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `name` text NOT NULL,
  `maximum_flow_cubic_meters_per_hour` real NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `archived_at` text,
  `notes` text,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_irrigation_pumps_flow` CHECK (`maximum_flow_cubic_meters_per_hour` > 0),
  CONSTRAINT `chk_irrigation_pumps_status` CHECK (`status` IN ('active', 'archived')),
  CONSTRAINT `chk_irrigation_pumps_archive_state` CHECK ((`status` = 'active' AND `archived_at` IS NULL) OR (`status` = 'archived' AND `archived_at` IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `idx_irrigation_pumps_workspace_status` ON `irrigation_pumps` (`workspace_id`, `status`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_irrigation_pumps_workspace_name` ON `irrigation_pumps` (`workspace_id`, `name`);
--> statement-breakpoint
CREATE TABLE `irrigation_pump_origins` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `pump_id` text NOT NULL,
  `source_kind` text NOT NULL,
  `resource_id` text,
  `reservoir_id` text,
  `is_default` integer DEFAULT 0 NOT NULL,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  FOREIGN KEY (`pump_id`) REFERENCES `irrigation_pumps`(`id`) ON DELETE cascade,
  FOREIGN KEY (`resource_id`) REFERENCES `irrigation_water_resources`(`id`) ON DELETE restrict,
  FOREIGN KEY (`reservoir_id`) REFERENCES `irrigation_water_reservoirs`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_irrigation_pump_origin_source` CHECK ((`source_kind` = 'resource' AND `resource_id` IS NOT NULL AND `reservoir_id` IS NULL) OR (`source_kind` = 'reservoir' AND `resource_id` IS NULL AND `reservoir_id` IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `idx_irrigation_pump_origins_workspace` ON `irrigation_pump_origins` (`workspace_id`);
--> statement-breakpoint
CREATE INDEX `idx_irrigation_pump_origins_pump` ON `irrigation_pump_origins` (`pump_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_irrigation_pump_origin_resource` ON `irrigation_pump_origins` (`pump_id`, `resource_id`) WHERE `resource_id` IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_irrigation_pump_origin_reservoir` ON `irrigation_pump_origins` (`pump_id`, `reservoir_id`) WHERE `reservoir_id` IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_irrigation_pump_origin_default` ON `irrigation_pump_origins` (`pump_id`) WHERE `is_default` = 1;
--> statement-breakpoint
CREATE TABLE `irrigation_equipment_pump_defaults` (
  `equipment_id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `pump_id` text NOT NULL,
  `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (`equipment_id`) REFERENCES `irrigation_equipment`(`id`) ON DELETE cascade,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  FOREIGN KEY (`pump_id`) REFERENCES `irrigation_pumps`(`id`) ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_irrigation_equipment_pump_defaults_workspace` ON `irrigation_equipment_pump_defaults` (`workspace_id`);
--> statement-breakpoint
CREATE INDEX `idx_irrigation_equipment_pump_defaults_pump` ON `irrigation_equipment_pump_defaults` (`pump_id`);
--> statement-breakpoint
CREATE TABLE `irrigation_pump_log` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `pump_id` text,
  `action` text NOT NULL,
  `payload` text NOT NULL,
  `actor_user_id` text NOT NULL,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  FOREIGN KEY (`pump_id`) REFERENCES `irrigation_pumps`(`id`) ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_irrigation_pump_log_entity` ON `irrigation_pump_log` (`workspace_id`, `pump_id`, `created_at`);
--> statement-breakpoint
ALTER TABLE `irrigation_event_equipment` ADD `pump_id` text REFERENCES `irrigation_pumps`(`id`) ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE `irrigation_event_equipment` ADD `pump_origin_id` text REFERENCES `irrigation_pump_origins`(`id`) ON DELETE set null;
--> statement-breakpoint
ALTER TABLE `irrigation_event_equipment` ADD `requested_flow_cubic_meters_per_hour` real;
--> statement-breakpoint
ALTER TABLE `irrigation_event_equipment` ADD `pump_snapshot` text;
--> statement-breakpoint
ALTER TABLE `irrigation_event_equipment` ADD `pump_origin_snapshot` text;
--> statement-breakpoint
CREATE INDEX `idx_irrigation_event_equipment_pump_schedule` ON `irrigation_event_equipment` (`pump_id`, `planned_start_at`, `planned_end_at`);
