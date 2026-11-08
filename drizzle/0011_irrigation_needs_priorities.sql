CREATE TABLE `irrigation_need_preferences` (
  `workspace_id` text PRIMARY KEY NOT NULL,
  `minimum_need_threshold_mm` real DEFAULT 0 NOT NULL,
  `actor_user_id` text NOT NULL,
  `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_irrigation_need_threshold` CHECK (`minimum_need_threshold_mm` >= 0 AND `minimum_need_threshold_mm` <= 500)
);
--> statement-breakpoint
CREATE TABLE `irrigation_bed_need_decisions` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `season` integer NOT NULL,
  `week_start` text NOT NULL,
  `otf_zone_id` text NOT NULL,
  `otf_plot_id` text NOT NULL,
  `otf_bed_id` text NOT NULL,
  `priority` text DEFAULT 'normal' NOT NULL,
  `manual_override_mm` real,
  `override_reason` text,
  `calculated_need_at_override_mm` real,
  `actor_user_id` text NOT NULL,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_irrigation_bed_need_season` CHECK (`season` BETWEEN 1900 AND 9999),
  CONSTRAINT `chk_irrigation_bed_need_priority` CHECK (`priority` IN ('low', 'normal', 'high')),
  CONSTRAINT `chk_irrigation_bed_need_override` CHECK ((`manual_override_mm` IS NULL AND `calculated_need_at_override_mm` IS NULL) OR (`manual_override_mm` >= 0 AND `manual_override_mm` <= 500 AND (`calculated_need_at_override_mm` IS NULL OR `calculated_need_at_override_mm` >= 0)))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_irrigation_bed_need_week` ON `irrigation_bed_need_decisions` (`workspace_id`, `season`, `week_start`, `otf_bed_id`);
--> statement-breakpoint
CREATE INDEX `idx_irrigation_bed_need_plot` ON `irrigation_bed_need_decisions` (`workspace_id`, `season`, `week_start`, `otf_plot_id`);
--> statement-breakpoint
CREATE TABLE `irrigation_need_decision_log` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `season` integer NOT NULL,
  `week_start` text NOT NULL,
  `otf_bed_id` text,
  `action` text NOT NULL,
  `payload` text NOT NULL,
  `actor_user_id` text NOT NULL,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_irrigation_need_log_action` CHECK (`action` IN ('threshold_set', 'priority_set', 'override_set', 'override_cleared'))
);
--> statement-breakpoint
CREATE INDEX `idx_irrigation_need_log_week` ON `irrigation_need_decision_log` (`workspace_id`, `season`, `week_start`, `created_at`);
