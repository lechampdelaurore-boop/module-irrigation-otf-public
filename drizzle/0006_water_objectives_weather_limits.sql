CREATE TABLE `irrigation_hydric_goal_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`season` integer NOT NULL,
	`week_start` text NOT NULL,
	`scope_type` text NOT NULL,
	`otf_zone_id` text,
	`otf_plot_id` text,
	`otf_bed_id` text,
	`amount_mm` real,
	`action` text NOT NULL,
	`copied_from_goal_id` text,
	`actor_user_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chk_hydric_goals_season" CHECK(`season` BETWEEN 1900 AND 9999),
	CONSTRAINT "chk_hydric_goals_action" CHECK((`action` = 'set' AND `amount_mm` IS NOT NULL AND `amount_mm` >= 0) OR (`action` = 'cleared' AND `amount_mm` IS NULL)),
	CONSTRAINT "chk_hydric_goals_scope" CHECK((`scope_type` = 'farm' AND `otf_zone_id` IS NULL AND `otf_plot_id` IS NULL AND `otf_bed_id` IS NULL) OR (`scope_type` = 'zone' AND `otf_zone_id` IS NOT NULL AND `otf_plot_id` IS NULL AND `otf_bed_id` IS NULL) OR (`scope_type` = 'plot' AND `otf_zone_id` IS NOT NULL AND `otf_plot_id` IS NOT NULL AND `otf_bed_id` IS NULL) OR (`scope_type` = 'bed' AND `otf_zone_id` IS NOT NULL AND `otf_plot_id` IS NOT NULL AND `otf_bed_id` IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `idx_hydric_goals_workspace_week` ON `irrigation_hydric_goal_revisions` (`workspace_id`,`season`,`week_start`,`created_at`);
--> statement-breakpoint
CREATE TABLE `irrigation_weather_preferences` (
	`workspace_id` text PRIMARY KEY NOT NULL,
	`location_mode` text DEFAULT 'otf' NOT NULL,
	`custom_city` text,
	`custom_postcode` text,
	`last_refresh_attempt_at` text,
	`last_successful_refresh_at` text,
	`last_refresh_error` text,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chk_weather_preferences_location" CHECK((`location_mode` = 'otf' AND `custom_city` IS NULL AND `custom_postcode` IS NULL) OR (`location_mode` = 'custom' AND `custom_city` IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE `irrigation_weather_geocodes` (
	`workspace_id` text NOT NULL,
	`location_key` text NOT NULL,
	`display_name` text NOT NULL,
	`city` text NOT NULL,
	`postcode` text,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`timezone` text NOT NULL,
	`source` text NOT NULL,
	`resolved_at` text NOT NULL,
	PRIMARY KEY(`workspace_id`, `location_key`),
	FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chk_weather_geocode_latitude" CHECK(`latitude` BETWEEN -90 AND 90),
	CONSTRAINT "chk_weather_geocode_longitude" CHECK(`longitude` BETWEEN -180 AND 180)
);
--> statement-breakpoint
CREATE TABLE `irrigation_weather_daily_values` (
	`workspace_id` text NOT NULL,
	`location_key` text NOT NULL,
	`date` text NOT NULL,
	`data_kind` text NOT NULL,
	`precipitation_mm` real,
	`et0_mm` real,
	`source` text NOT NULL,
	`fetched_at` text NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	PRIMARY KEY(`workspace_id`, `location_key`, `date`, `data_kind`),
	FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chk_weather_daily_values_non_negative" CHECK((`precipitation_mm` IS NULL OR `precipitation_mm` >= 0) AND (`et0_mm` IS NULL OR `et0_mm` >= 0)),
	CONSTRAINT "chk_weather_daily_manual" CHECK(`data_kind` != 'manual_precipitation' OR (`precipitation_mm` IS NOT NULL AND `et0_mm` IS NULL))
);
--> statement-breakpoint
CREATE INDEX `idx_weather_daily_workspace_date` ON `irrigation_weather_daily_values` (`workspace_id`,`date`);
--> statement-breakpoint
CREATE TABLE `irrigation_daily_water_limit_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`season` integer NOT NULL,
	`enabled` integer NOT NULL,
	`max_cubic_meters_per_day` real,
	`valid_from` text NOT NULL,
	`valid_until` text,
	`note` text,
	`actor_user_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chk_daily_limit_season" CHECK(`season` BETWEEN 1900 AND 9999),
	CONSTRAINT "chk_daily_limit_period" CHECK(`valid_until` IS NULL OR `valid_until` >= `valid_from`),
	CONSTRAINT "chk_daily_limit_amount" CHECK((`enabled` = 1 AND `max_cubic_meters_per_day` IS NOT NULL AND `max_cubic_meters_per_day` > 0) OR (`enabled` = 0 AND `max_cubic_meters_per_day` IS NULL))
);
--> statement-breakpoint
CREATE INDEX `idx_daily_limit_workspace_period` ON `irrigation_daily_water_limit_revisions` (`workspace_id`,`season`,`valid_from`,`valid_until`,`created_at`);
