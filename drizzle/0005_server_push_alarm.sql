ALTER TABLE `irrigation_event_equipment` ADD `timer_alarm_revision` text;--> statement-breakpoint
ALTER TABLE `irrigation_event_equipment` ADD `timer_alarm_status` text;--> statement-breakpoint
ALTER TABLE `irrigation_event_equipment` ADD `timer_alarm_synced_at` text;--> statement-breakpoint
CREATE INDEX `idx_irrigation_event_equipment_alarm_status` ON `irrigation_event_equipment` (`timer_alarm_status`) WHERE `timer_state` IS NOT NULL;
