ALTER TABLE `irrigation_event_equipment` ADD `planned_duration_seconds` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `irrigation_event_equipment` ADD `actual_duration_seconds` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `irrigation_event_equipment` ADD `timer_state` text;--> statement-breakpoint
ALTER TABLE `irrigation_event_equipment` ADD `timer_started_at` text;--> statement-breakpoint
ALTER TABLE `irrigation_event_equipment` ADD `timer_resumed_at` text;--> statement-breakpoint
ALTER TABLE `irrigation_event_equipment` ADD `timer_paused_at` text;--> statement-breakpoint
ALTER TABLE `irrigation_event_equipment` ADD `timer_theoretical_end_at` text;--> statement-breakpoint
ALTER TABLE `irrigation_event_equipment` ADD `timer_accumulated_seconds` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_irrigation_event_equipment_active_equipment` ON `irrigation_event_equipment` (`equipment_id`) WHERE `timer_state` IS NOT NULL;
