CREATE TABLE `irrigation_season_geometry` (
	`workspace_id` text NOT NULL,
	`season` integer NOT NULL,
	`copied_from_season` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	PRIMARY KEY(`workspace_id`, `season`),
	FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chk_season_geometry_season" CHECK("irrigation_season_geometry"."season" BETWEEN 1900 AND 9999),
	CONSTRAINT "chk_season_geometry_copied_from" CHECK("irrigation_season_geometry"."copied_from_season" IS NULL OR ("irrigation_season_geometry"."copied_from_season" BETWEEN 1900 AND 9999 AND "irrigation_season_geometry"."copied_from_season" < "irrigation_season_geometry"."season"))
);
