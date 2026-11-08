CREATE TABLE `irrigation_planning_settings` (
  `workspace_id` text PRIMARY KEY NOT NULL,
  `payload` text NOT NULL,
  `actor_user_id` text NOT NULL,
  `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_planning_settings_payload` CHECK (json_valid(`payload`) AND json_type(`payload`) = 'object')
);
--> statement-breakpoint
CREATE TABLE `irrigation_planning_settings_log` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `payload` text NOT NULL,
  `actor_user_id` text NOT NULL,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_planning_settings_log_payload` CHECK (json_valid(`payload`) AND json_type(`payload`) = 'object')
);
--> statement-breakpoint
CREATE INDEX `idx_planning_settings_log_workspace` ON `irrigation_planning_settings_log` (`workspace_id`, `created_at`);
--> statement-breakpoint
CREATE TABLE `irrigation_plan_calculations` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `season` integer NOT NULL,
  `week_start` text NOT NULL,
  `trigger` text NOT NULL,
  `computed_at` text NOT NULL,
  `horizon_start_at` text NOT NULL,
  `horizon_end_at` text NOT NULL,
  `settings` text NOT NULL,
  `summary` text NOT NULL,
  `actor_user_id` text,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_plan_calculation_season` CHECK (`season` BETWEEN 1900 AND 9999),
  CONSTRAINT `chk_plan_calculation_trigger` CHECK (`trigger` IN ('manual', 'daily', 'event')),
  CONSTRAINT `chk_plan_calculation_horizon` CHECK (`horizon_end_at` >= `horizon_start_at`),
  CONSTRAINT `chk_plan_calculation_json` CHECK (json_valid(`settings`) AND json_valid(`summary`))
);
--> statement-breakpoint
CREATE INDEX `idx_plan_calculations_week` ON `irrigation_plan_calculations` (`workspace_id`, `season`, `week_start`, `computed_at`);
--> statement-breakpoint
CREATE TABLE `irrigation_plan_proposals` (
  `id` text PRIMARY KEY NOT NULL,
  `calculation_id` text NOT NULL,
  `workspace_id` text NOT NULL,
  `season` integer NOT NULL,
  `week_start` text NOT NULL,
  `local_id` text NOT NULL,
  `equipment_id` text NOT NULL,
  `equipment_name` text NOT NULL,
  `kind` text NOT NULL,
  `setting_id` text NOT NULL,
  `setting_name` text NOT NULL,
  `placement_id` text NOT NULL,
  `start_at` text NOT NULL,
  `end_at` text NOT NULL,
  `duration_seconds` integer NOT NULL,
  `dose_mm` real NOT NULL,
  `volume_cubic_meters` real,
  `flow_cubic_meters_per_hour` real,
  `pump_id` text,
  `pump_origin_id` text,
  `status` text DEFAULT 'proposed' NOT NULL,
  `payload` text NOT NULL,
  `validated_event_id` text,
  `replaced_by_calculation_id` text,
  `decided_at` text,
  `actor_user_id` text,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (`calculation_id`) REFERENCES `irrigation_plan_calculations`(`id`) ON DELETE restrict,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_plan_proposal_season` CHECK (`season` BETWEEN 1900 AND 9999),
  CONSTRAINT `chk_plan_proposal_kind` CHECK (`kind` IN ('sprinkler', 'drip')),
  CONSTRAINT `chk_plan_proposal_status` CHECK (`status` IN ('proposed', 'validated', 'refused', 'replaced', 'expired')),
  CONSTRAINT `chk_plan_proposal_interval` CHECK (`end_at` > `start_at` AND `duration_seconds` > 0),
  CONSTRAINT `chk_plan_proposal_quantities` CHECK (`dose_mm` >= 0 AND (`volume_cubic_meters` IS NULL OR `volume_cubic_meters` >= 0) AND (`flow_cubic_meters_per_hour` IS NULL OR `flow_cubic_meters_per_hour` >= 0)),
  CONSTRAINT `chk_plan_proposal_payload` CHECK (json_valid(`payload`) AND json_type(`payload`) = 'object'),
  CONSTRAINT `chk_plan_proposal_decision` CHECK ((`status` IN ('validated', 'refused') AND `decided_at` IS NOT NULL) OR (`status` NOT IN ('validated', 'refused') AND `validated_event_id` IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_plan_proposal_local` ON `irrigation_plan_proposals` (`calculation_id`, `local_id`);
--> statement-breakpoint
CREATE INDEX `idx_plan_proposals_week_status` ON `irrigation_plan_proposals` (`workspace_id`, `season`, `week_start`, `status`);
