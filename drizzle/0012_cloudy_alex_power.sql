CREATE TABLE `irrigation_arbitration_log` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`request_id` text NOT NULL,
	`season` integer NOT NULL,
	`week_start` text NOT NULL,
	`priority` text NOT NULL,
	`action` text NOT NULL,
	`payload` text NOT NULL,
	`actor_user_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_arbitration_request` ON `irrigation_arbitration_log` (`workspace_id`,`request_id`);
--> statement-breakpoint
CREATE INDEX `idx_arbitration_log_week` ON `irrigation_arbitration_log` (`workspace_id`,`season`,`week_start`);
--> statement-breakpoint
CREATE TABLE `irrigation_arbitrations` (
	`workspace_id` text NOT NULL,
	`season` integer NOT NULL,
	`week_start` text NOT NULL,
	`priority` text NOT NULL,
	`selected_bed_ids` text NOT NULL,
	`candidate_bed_ids` text NOT NULL,
	`actor_user_id` text NOT NULL,
	`decided_at` text NOT NULL,
	`invalidated_at` text,
	PRIMARY KEY(`workspace_id`, `season`, `week_start`, `priority`),
	FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chk_arbitration_priority" CHECK("irrigation_arbitrations"."priority" IN ('high', 'normal', 'low')),
	CONSTRAINT "chk_arbitration_season" CHECK("irrigation_arbitrations"."season" BETWEEN 1900 AND 9999),
	CONSTRAINT "chk_arbitration_arrays" CHECK(json_valid("irrigation_arbitrations"."selected_bed_ids") AND json_type("irrigation_arbitrations"."selected_bed_ids") = 'array' AND json_valid("irrigation_arbitrations"."candidate_bed_ids") AND json_type("irrigation_arbitrations"."candidate_bed_ids") = 'array')
);
--> statement-breakpoint
ALTER TABLE `irrigation_workspaces` ADD `feasibility_revision` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TRIGGER guard_feasibility_revision BEFORE UPDATE OF feasibility_revision ON irrigation_workspaces WHEN NEW.feasibility_revision != OLD.feasibility_revision + 1 BEGIN SELECT RAISE(ABORT, 'stale_feasibility_revision'); END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_need_preferences_insert AFTER INSERT ON irrigation_need_preferences BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = NEW.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_need_preferences_update AFTER UPDATE ON irrigation_need_preferences BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = NEW.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_need_preferences_delete AFTER DELETE ON irrigation_need_preferences BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = OLD.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_bed_need_decisions_insert AFTER INSERT ON irrigation_bed_need_decisions BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = NEW.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_bed_need_decisions_update AFTER UPDATE ON irrigation_bed_need_decisions BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = NEW.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_bed_need_decisions_delete AFTER DELETE ON irrigation_bed_need_decisions BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = OLD.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_hydric_goal_revisions_insert AFTER INSERT ON irrigation_hydric_goal_revisions BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = NEW.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_hydric_goal_revisions_update AFTER UPDATE ON irrigation_hydric_goal_revisions BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = NEW.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_hydric_goal_revisions_delete AFTER DELETE ON irrigation_hydric_goal_revisions BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = OLD.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_weather_preferences_insert AFTER INSERT ON irrigation_weather_preferences BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = NEW.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_weather_preferences_update AFTER UPDATE ON irrigation_weather_preferences BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = NEW.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_weather_preferences_delete AFTER DELETE ON irrigation_weather_preferences BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = OLD.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_weather_daily_values_insert AFTER INSERT ON irrigation_weather_daily_values BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = NEW.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_weather_daily_values_update AFTER UPDATE ON irrigation_weather_daily_values BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = NEW.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_weather_daily_values_delete AFTER DELETE ON irrigation_weather_daily_values BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = OLD.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_water_resources_insert AFTER INSERT ON irrigation_water_resources BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = NEW.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_water_resources_update AFTER UPDATE ON irrigation_water_resources BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = NEW.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_water_resources_delete AFTER DELETE ON irrigation_water_resources BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = OLD.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_water_reservoirs_insert AFTER INSERT ON irrigation_water_reservoirs BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = NEW.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_water_reservoirs_update AFTER UPDATE ON irrigation_water_reservoirs BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = NEW.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_water_reservoirs_delete AFTER DELETE ON irrigation_water_reservoirs BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = OLD.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_water_resource_limit_revisions_insert AFTER INSERT ON irrigation_water_resource_limit_revisions BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = NEW.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_water_resource_limit_revisions_update AFTER UPDATE ON irrigation_water_resource_limit_revisions BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = NEW.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_water_resource_limit_revisions_delete AFTER DELETE ON irrigation_water_resource_limit_revisions BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = OLD.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_water_stock_movements_insert AFTER INSERT ON irrigation_water_stock_movements BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = NEW.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_water_stock_movements_update AFTER UPDATE ON irrigation_water_stock_movements BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = NEW.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_water_stock_movements_delete AFTER DELETE ON irrigation_water_stock_movements BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = OLD.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_water_supply_defaults_insert AFTER INSERT ON irrigation_water_supply_defaults BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = NEW.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_water_supply_defaults_update AFTER UPDATE ON irrigation_water_supply_defaults BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = NEW.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_water_supply_defaults_delete AFTER DELETE ON irrigation_water_supply_defaults BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = OLD.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_water_resource_reservoir_links_insert AFTER INSERT ON irrigation_water_resource_reservoir_links BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = NEW.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_water_resource_reservoir_links_update AFTER UPDATE ON irrigation_water_resource_reservoir_links BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = NEW.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_water_resource_reservoir_links_delete AFTER DELETE ON irrigation_water_resource_reservoir_links BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = OLD.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_water_reservoir_links_insert AFTER INSERT ON irrigation_water_reservoir_links BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = NEW.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_water_reservoir_links_update AFTER UPDATE ON irrigation_water_reservoir_links BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = NEW.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_water_reservoir_links_delete AFTER DELETE ON irrigation_water_reservoir_links BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = OLD.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_pumps_insert AFTER INSERT ON irrigation_pumps BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = NEW.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_pumps_update AFTER UPDATE ON irrigation_pumps BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = NEW.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_pumps_delete AFTER DELETE ON irrigation_pumps BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = OLD.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_pump_origins_insert AFTER INSERT ON irrigation_pump_origins BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = NEW.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_pump_origins_update AFTER UPDATE ON irrigation_pump_origins BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = NEW.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_pump_origins_delete AFTER DELETE ON irrigation_pump_origins BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = OLD.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_equipment_pump_defaults_insert AFTER INSERT ON irrigation_equipment_pump_defaults BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = NEW.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_equipment_pump_defaults_update AFTER UPDATE ON irrigation_equipment_pump_defaults BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = NEW.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_equipment_pump_defaults_delete AFTER DELETE ON irrigation_equipment_pump_defaults BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = OLD.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_equipment_insert AFTER INSERT ON irrigation_equipment BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = NEW.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_equipment_update AFTER UPDATE ON irrigation_equipment BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = NEW.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_equipment_delete AFTER DELETE ON irrigation_equipment BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = OLD.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_equipment_placements_insert AFTER INSERT ON irrigation_equipment_placements BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = NEW.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_equipment_placements_update AFTER UPDATE ON irrigation_equipment_placements BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = NEW.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_equipment_placements_delete AFTER DELETE ON irrigation_equipment_placements BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = OLD.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_garden_groups_insert AFTER INSERT ON irrigation_garden_groups BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = NEW.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_garden_groups_update AFTER UPDATE ON irrigation_garden_groups BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = NEW.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_garden_groups_delete AFTER DELETE ON irrigation_garden_groups BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = OLD.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_events_insert AFTER INSERT ON irrigation_events BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = NEW.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_events_update AFTER UPDATE ON irrigation_events BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = NEW.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_events_delete AFTER DELETE ON irrigation_events BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = OLD.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_event_equipment_insert AFTER INSERT ON irrigation_event_equipment BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id IN (SELECT workspace_id FROM irrigation_events WHERE id=NEW.event_id); END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_event_equipment_update AFTER UPDATE ON irrigation_event_equipment BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id IN (SELECT workspace_id FROM irrigation_events WHERE id=NEW.event_id); END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_event_equipment_delete AFTER DELETE ON irrigation_event_equipment BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id IN (SELECT workspace_id FROM irrigation_events WHERE id=OLD.event_id); END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_bed_applications_insert AFTER INSERT ON irrigation_bed_applications BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id IN (SELECT e.workspace_id FROM irrigation_event_equipment ee JOIN irrigation_events e ON e.id=ee.event_id WHERE ee.id=NEW.event_equipment_id); END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_bed_applications_update AFTER UPDATE ON irrigation_bed_applications BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id IN (SELECT e.workspace_id FROM irrigation_event_equipment ee JOIN irrigation_events e ON e.id=ee.event_id WHERE ee.id=NEW.event_equipment_id); END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_bed_applications_delete AFTER DELETE ON irrigation_bed_applications BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id IN (SELECT e.workspace_id FROM irrigation_event_equipment ee JOIN irrigation_events e ON e.id=ee.event_id WHERE ee.id=OLD.event_equipment_id); END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_garden_group_members_insert AFTER INSERT ON irrigation_garden_group_members BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id IN (SELECT workspace_id FROM irrigation_garden_groups WHERE id=NEW.group_id); END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_garden_group_members_update AFTER UPDATE ON irrigation_garden_group_members BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id IN (SELECT workspace_id FROM irrigation_garden_groups WHERE id=NEW.group_id); END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_garden_group_members_delete AFTER DELETE ON irrigation_garden_group_members BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id IN (SELECT workspace_id FROM irrigation_garden_groups WHERE id=OLD.group_id); END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_placement_selected_beds_insert AFTER INSERT ON irrigation_placement_selected_beds BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id IN (SELECT workspace_id FROM irrigation_equipment_placements WHERE id=NEW.placement_id); END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_placement_selected_beds_update AFTER UPDATE ON irrigation_placement_selected_beds BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id IN (SELECT workspace_id FROM irrigation_equipment_placements WHERE id=NEW.placement_id); END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_placement_selected_beds_delete AFTER DELETE ON irrigation_placement_selected_beds BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id IN (SELECT workspace_id FROM irrigation_equipment_placements WHERE id=OLD.placement_id); END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_equipment_settings_insert AFTER INSERT ON irrigation_equipment_settings BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id IN (SELECT workspace_id FROM irrigation_equipment WHERE id=NEW.equipment_id); END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_equipment_settings_update AFTER UPDATE ON irrigation_equipment_settings BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id IN (SELECT workspace_id FROM irrigation_equipment WHERE id=NEW.equipment_id); END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_equipment_settings_delete AFTER DELETE ON irrigation_equipment_settings BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id IN (SELECT workspace_id FROM irrigation_equipment WHERE id=OLD.equipment_id); END;
--> statement-breakpoint
CREATE TRIGGER feasibility_sprinkler_profile_points_insert AFTER INSERT ON sprinkler_profile_points BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id IN (SELECT e.workspace_id FROM irrigation_equipment_settings s JOIN irrigation_equipment e ON e.id=s.equipment_id WHERE s.id=NEW.setting_id); END;
--> statement-breakpoint
CREATE TRIGGER feasibility_sprinkler_profile_points_update AFTER UPDATE ON sprinkler_profile_points BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id IN (SELECT e.workspace_id FROM irrigation_equipment_settings s JOIN irrigation_equipment e ON e.id=s.equipment_id WHERE s.id=NEW.setting_id); END;
--> statement-breakpoint
CREATE TRIGGER feasibility_sprinkler_profile_points_delete AFTER DELETE ON sprinkler_profile_points BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id IN (SELECT e.workspace_id FROM irrigation_equipment_settings s JOIN irrigation_equipment e ON e.id=s.equipment_id WHERE s.id=OLD.setting_id); END;
--> statement-breakpoint
CREATE TRIGGER feasibility_drip_setting_rates_insert AFTER INSERT ON drip_setting_rates BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id IN (SELECT e.workspace_id FROM irrigation_equipment_settings s JOIN irrigation_equipment e ON e.id=s.equipment_id WHERE s.id=NEW.setting_id); END;
--> statement-breakpoint
CREATE TRIGGER feasibility_drip_setting_rates_update AFTER UPDATE ON drip_setting_rates BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id IN (SELECT e.workspace_id FROM irrigation_equipment_settings s JOIN irrigation_equipment e ON e.id=s.equipment_id WHERE s.id=NEW.setting_id); END;
--> statement-breakpoint
CREATE TRIGGER feasibility_drip_setting_rates_delete AFTER DELETE ON drip_setting_rates BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id IN (SELECT e.workspace_id FROM irrigation_equipment_settings s JOIN irrigation_equipment e ON e.id=s.equipment_id WHERE s.id=OLD.setting_id); END;
--> statement-breakpoint
CREATE TRIGGER feasibility_otf_snapshot_insert AFTER INSERT ON otf_snapshots WHEN json_valid(NEW.cache_key) BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE owner_user_id = json_extract(NEW.cache_key, '$[1]'); END;
--> statement-breakpoint
CREATE TRIGGER feasibility_otf_snapshot_update AFTER UPDATE ON otf_snapshots WHEN json_valid(NEW.cache_key) AND NEW.payload != OLD.payload BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE owner_user_id = json_extract(NEW.cache_key, '$[1]'); END;
--> statement-breakpoint
CREATE TRIGGER feasibility_otf_snapshot_delete AFTER DELETE ON otf_snapshots WHEN json_valid(OLD.cache_key) BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE owner_user_id = json_extract(OLD.cache_key, '$[1]'); END;
