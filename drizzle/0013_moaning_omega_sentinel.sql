CREATE TABLE `irrigation_background_jobs` (
	`job_key` text PRIMARY KEY NOT NULL,
	`lock_token` text,
	`lock_expires_at` text,
	`last_started_at` text,
	`last_completed_at` text,
	`last_successful_at` text,
	`last_error` text,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `irrigation_weather_preferences` ADD `last_automatic_refresh_attempt_at` text;--> statement-breakpoint
ALTER TABLE `irrigation_weather_preferences` ADD `last_automatic_refresh_success_at` text;--> statement-breakpoint
ALTER TABLE `irrigation_weather_preferences` ADD `last_automatic_refresh_error` text;