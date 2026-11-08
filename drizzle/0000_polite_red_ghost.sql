CREATE TABLE `otf_snapshots` (
	`cache_key` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`last_successful_read_at` text NOT NULL,
	`updated_at` text NOT NULL
);
