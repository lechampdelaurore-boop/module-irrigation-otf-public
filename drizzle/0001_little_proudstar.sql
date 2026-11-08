CREATE TABLE `drip_setting_rates` (
	`setting_id` text PRIMARY KEY NOT NULL,
	`rate_mm_per_hour` real NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`setting_id`) REFERENCES `irrigation_equipment_settings`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "chk_drip_setting_rate_non_negative" CHECK("drip_setting_rates"."rate_mm_per_hour" >= 0)
);
--> statement-breakpoint
CREATE TABLE `irrigation_equipment_placements` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`equipment_id` text NOT NULL,
	`setting_id` text NOT NULL,
	`season` integer NOT NULL,
	`garden_group_id` text,
	`otf_zone_id` text NOT NULL,
	`otf_plot_id` text NOT NULL,
	`anchor_type` text NOT NULL,
	`anchor_bed_otf_id` text,
	`before_bed_otf_id` text,
	`after_bed_otf_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`equipment_id`) REFERENCES `irrigation_equipment`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`setting_id`) REFERENCES `irrigation_equipment_settings`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`garden_group_id`) REFERENCES `irrigation_garden_groups`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "chk_equipment_placements_season" CHECK("irrigation_equipment_placements"."season" BETWEEN 1900 AND 9999),
	CONSTRAINT "chk_equipment_placements_anchor" CHECK(("irrigation_equipment_placements"."anchor_type" = 'bed_center' AND "irrigation_equipment_placements"."anchor_bed_otf_id" IS NOT NULL AND "irrigation_equipment_placements"."before_bed_otf_id" IS NULL AND "irrigation_equipment_placements"."after_bed_otf_id" IS NULL) OR ("irrigation_equipment_placements"."anchor_type" = 'between_beds' AND "irrigation_equipment_placements"."anchor_bed_otf_id" IS NULL AND "irrigation_equipment_placements"."before_bed_otf_id" IS NOT NULL AND "irrigation_equipment_placements"."after_bed_otf_id" IS NOT NULL)),
	CONSTRAINT "chk_equipment_placements_anchor_type" CHECK("irrigation_equipment_placements"."anchor_type" IN ('bed_center', 'between_beds'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_equipment_placements_equipment_season` ON `irrigation_equipment_placements` (`equipment_id`,`season`);--> statement-breakpoint
CREATE INDEX `idx_equipment_placements_workspace_season` ON `irrigation_equipment_placements` (`workspace_id`,`season`);--> statement-breakpoint
CREATE TABLE `irrigation_garden_group_members` (
	`group_id` text NOT NULL,
	`otf_zone_id` text NOT NULL,
	`otf_plot_id` text NOT NULL,
	`position` integer NOT NULL,
	`bed_order` text DEFAULT 'normal' NOT NULL,
	`gap_before_meters` real DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	PRIMARY KEY(`group_id`, `otf_plot_id`),
	FOREIGN KEY (`group_id`) REFERENCES `irrigation_garden_groups`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "chk_garden_group_members_position" CHECK("irrigation_garden_group_members"."position" >= 1),
	CONSTRAINT "chk_garden_group_members_gap_non_negative" CHECK("irrigation_garden_group_members"."gap_before_meters" >= 0),
	CONSTRAINT "chk_garden_group_members_bed_order" CHECK("irrigation_garden_group_members"."bed_order" IN ('normal', 'reversed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_garden_group_members_group_position` ON `irrigation_garden_group_members` (`group_id`,`position`);--> statement-breakpoint
CREATE INDEX `idx_garden_group_members_plot` ON `irrigation_garden_group_members` (`otf_plot_id`);--> statement-breakpoint
CREATE TABLE `irrigation_garden_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`season` integer NOT NULL,
	`name` text NOT NULL,
	`position` integer NOT NULL,
	`copied_from_group_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chk_garden_groups_season" CHECK("irrigation_garden_groups"."season" BETWEEN 1900 AND 9999),
	CONSTRAINT "chk_garden_groups_position" CHECK("irrigation_garden_groups"."position" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_garden_groups_workspace_season_name` ON `irrigation_garden_groups` (`workspace_id`,`season`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_garden_groups_workspace_season_position` ON `irrigation_garden_groups` (`workspace_id`,`season`,`position`);--> statement-breakpoint
CREATE INDEX `idx_garden_groups_workspace_season` ON `irrigation_garden_groups` (`workspace_id`,`season`);--> statement-breakpoint
CREATE TABLE `irrigation_bed_applications` (
	`event_equipment_id` text NOT NULL,
	`otf_zone_id` text NOT NULL,
	`otf_plot_id` text NOT NULL,
	`otf_bed_id` text NOT NULL,
	`rate_mm_per_hour` real NOT NULL,
	`bed_area_square_meters` real NOT NULL,
	`planned_amount_mm` real DEFAULT 0 NOT NULL,
	`actual_amount_mm` real DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	PRIMARY KEY(`event_equipment_id`, `otf_bed_id`),
	FOREIGN KEY (`event_equipment_id`) REFERENCES `irrigation_event_equipment`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chk_irrigation_bed_applications_non_negative" CHECK("irrigation_bed_applications"."rate_mm_per_hour" >= 0 AND "irrigation_bed_applications"."bed_area_square_meters" > 0 AND "irrigation_bed_applications"."planned_amount_mm" >= 0 AND "irrigation_bed_applications"."actual_amount_mm" >= 0)
);
--> statement-breakpoint
CREATE INDEX `idx_irrigation_bed_applications_otf_bed` ON `irrigation_bed_applications` (`otf_bed_id`);--> statement-breakpoint
CREATE TABLE `irrigation_equipment` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`mobility` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`archived_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chk_irrigation_equipment_archive_state" CHECK(("irrigation_equipment"."status" = 'active' AND "irrigation_equipment"."archived_at" IS NULL) OR ("irrigation_equipment"."status" = 'archived' AND "irrigation_equipment"."archived_at" IS NOT NULL)),
	CONSTRAINT "chk_irrigation_equipment_kind" CHECK("irrigation_equipment"."kind" IN ('sprinkler', 'drip')),
	CONSTRAINT "chk_irrigation_equipment_mobility" CHECK("irrigation_equipment"."mobility" IN ('fixed', 'mobile'))
);
--> statement-breakpoint
CREATE INDEX `idx_irrigation_equipment_workspace_status` ON `irrigation_equipment` (`workspace_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_irrigation_equipment_workspace_name` ON `irrigation_equipment` (`workspace_id`,`name`);--> statement-breakpoint
CREATE TABLE `irrigation_equipment_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`equipment_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`equipment_id`) REFERENCES `irrigation_equipment`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chk_irrigation_settings_position" CHECK("irrigation_equipment_settings"."position" BETWEEN 1 AND 10)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_irrigation_settings_equipment_position` ON `irrigation_equipment_settings` (`equipment_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_irrigation_settings_equipment_name` ON `irrigation_equipment_settings` (`equipment_id`,`name`);--> statement-breakpoint
CREATE TABLE `irrigation_event_equipment` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`equipment_id` text NOT NULL,
	`setting_id` text NOT NULL,
	`placement_id` text NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`planned_start_at` text,
	`planned_end_at` text,
	`actual_start_at` text,
	`actual_end_at` text,
	`planned_duration_minutes` integer DEFAULT 0 NOT NULL,
	`actual_duration_minutes` integer DEFAULT 0 NOT NULL,
	`equipment_snapshot` text NOT NULL,
	`setting_snapshot` text NOT NULL,
	`placement_snapshot` text NOT NULL,
	`remaining_canceled_at` text,
	`canceled_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `irrigation_events`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`equipment_id`) REFERENCES `irrigation_equipment`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`setting_id`) REFERENCES `irrigation_equipment_settings`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`placement_id`) REFERENCES `irrigation_equipment_placements`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chk_irrigation_event_equipment_durations" CHECK("irrigation_event_equipment"."planned_duration_minutes" >= 0 AND "irrigation_event_equipment"."actual_duration_minutes" >= 0),
	CONSTRAINT "chk_irrigation_event_equipment_planned_dates" CHECK(("irrigation_event_equipment"."planned_start_at" IS NULL AND "irrigation_event_equipment"."planned_end_at" IS NULL) OR ("irrigation_event_equipment"."planned_start_at" IS NOT NULL AND "irrigation_event_equipment"."planned_end_at" IS NOT NULL AND "irrigation_event_equipment"."planned_end_at" > "irrigation_event_equipment"."planned_start_at")),
	CONSTRAINT "chk_irrigation_event_equipment_actual_dates" CHECK(("irrigation_event_equipment"."actual_start_at" IS NULL AND "irrigation_event_equipment"."actual_end_at" IS NULL) OR ("irrigation_event_equipment"."actual_start_at" IS NOT NULL AND "irrigation_event_equipment"."actual_end_at" IS NOT NULL AND "irrigation_event_equipment"."actual_end_at" > "irrigation_event_equipment"."actual_start_at")),
	CONSTRAINT "chk_irrigation_event_equipment_cancel_state" CHECK(("irrigation_event_equipment"."status" = 'canceled' AND "irrigation_event_equipment"."canceled_at" IS NOT NULL) OR ("irrigation_event_equipment"."status" != 'canceled' AND "irrigation_event_equipment"."canceled_at" IS NULL)),
	CONSTRAINT "chk_irrigation_event_equipment_remaining_cancel_state" CHECK("irrigation_event_equipment"."remaining_canceled_at" IS NULL OR "irrigation_event_equipment"."status" = 'partially_completed'),
	CONSTRAINT "chk_irrigation_event_equipment_status" CHECK("irrigation_event_equipment"."status" IN ('planned', 'partially_completed', 'completed', 'canceled'))
);
--> statement-breakpoint
CREATE INDEX `idx_irrigation_event_equipment_event` ON `irrigation_event_equipment` (`event_id`);--> statement-breakpoint
CREATE INDEX `idx_irrigation_event_equipment_equipment_schedule` ON `irrigation_event_equipment` (`equipment_id`,`planned_start_at`,`planned_end_at`);--> statement-breakpoint
CREATE TABLE `irrigation_event_log` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`actor_user_id` text NOT NULL,
	`action` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `irrigation_events`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chk_irrigation_event_log_action" CHECK("irrigation_event_log"."action" IN ('created', 'updated', 'partially_completed', 'completed', 'canceled'))
);
--> statement-breakpoint
CREATE INDEX `idx_irrigation_event_log_event` ON `irrigation_event_log` (`event_id`);--> statement-breakpoint
CREATE TABLE `irrigation_events` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`season` integer NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`note` text,
	`remaining_canceled_at` text,
	`canceled_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chk_irrigation_events_season" CHECK("irrigation_events"."season" BETWEEN 1900 AND 9999),
	CONSTRAINT "chk_irrigation_events_cancel_state" CHECK(("irrigation_events"."status" = 'canceled' AND "irrigation_events"."canceled_at" IS NOT NULL) OR ("irrigation_events"."status" != 'canceled' AND "irrigation_events"."canceled_at" IS NULL)),
	CONSTRAINT "chk_irrigation_events_remaining_cancel_state" CHECK("irrigation_events"."remaining_canceled_at" IS NULL OR "irrigation_events"."status" = 'partially_completed'),
	CONSTRAINT "chk_irrigation_events_status" CHECK("irrigation_events"."status" IN ('planned', 'partially_completed', 'completed', 'canceled'))
);
--> statement-breakpoint
CREATE INDEX `idx_irrigation_events_workspace_season_status` ON `irrigation_events` (`workspace_id`,`season`,`status`);--> statement-breakpoint
CREATE TABLE `irrigation_workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`otf_farm_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_irrigation_workspaces_owner` ON `irrigation_workspaces` (`owner_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_irrigation_workspaces_owner_otf_farm` ON `irrigation_workspaces` (`owner_user_id`,`otf_farm_id`) WHERE "irrigation_workspaces"."otf_farm_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_irrigation_workspaces_owner_pending_farm` ON `irrigation_workspaces` (`owner_user_id`) WHERE "irrigation_workspaces"."otf_farm_id" IS NULL;--> statement-breakpoint
CREATE TABLE `irrigation_placement_selected_beds` (
	`placement_id` text NOT NULL,
	`otf_zone_id` text NOT NULL,
	`otf_plot_id` text NOT NULL,
	`otf_bed_id` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	PRIMARY KEY(`placement_id`, `otf_bed_id`),
	FOREIGN KEY (`placement_id`) REFERENCES `irrigation_equipment_placements`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "chk_placement_selected_beds_position" CHECK("irrigation_placement_selected_beds"."position" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_placement_selected_beds_position` ON `irrigation_placement_selected_beds` (`placement_id`,`position`);--> statement-breakpoint
CREATE INDEX `idx_placement_selected_beds_otf_bed` ON `irrigation_placement_selected_beds` (`otf_bed_id`);--> statement-breakpoint
CREATE TABLE `sprinkler_profile_points` (
	`id` text PRIMARY KEY NOT NULL,
	`setting_id` text NOT NULL,
	`side` text NOT NULL,
	`distance_meters` real NOT NULL,
	`rate_mm_per_hour` real NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`setting_id`) REFERENCES `irrigation_equipment_settings`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "chk_sprinkler_points_distance_non_negative" CHECK("sprinkler_profile_points"."distance_meters" >= 0),
	CONSTRAINT "chk_sprinkler_points_rate_non_negative" CHECK("sprinkler_profile_points"."rate_mm_per_hour" >= 0),
	CONSTRAINT "chk_sprinkler_points_side" CHECK("sprinkler_profile_points"."side" IN ('left', 'right'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_sprinkler_points_setting_side_distance` ON `sprinkler_profile_points` (`setting_id`,`side`,`distance_meters`);--> statement-breakpoint
CREATE INDEX `idx_sprinkler_points_setting_side` ON `sprinkler_profile_points` (`setting_id`,`side`);