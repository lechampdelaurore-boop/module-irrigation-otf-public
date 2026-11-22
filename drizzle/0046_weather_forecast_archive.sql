-- L'archive des prévisions J+1 à J+7 (docs/forecast-archive-contract.md,
-- D-297). Migration additive : une table neuve et deux index, aucune ligne
-- existante ne change, aucune table n'est recréée.
--
-- Une ligne par exploitation, lieu, jour d'émission (jour civil de Paris) et
-- jour visé : ce que le fournisseur annonçait, à la première lecture réussie
-- du jour d'émission, pour un jour de J+1 à J+7. Elle ne s'écrase jamais :
-- les écritures sont des `INSERT … ON CONFLICT DO NOTHING`, la première ligne
-- reste. Seules la purge des 24 mois (jour d'émission) et l'effacement d'une
-- ferme en retirent. Une valeur absente reste NULL, jamais 0.
--
-- L'index du jour d'émission sert la purge du matin, qui parcourt toutes
-- les exploitations ; celui du jour visé sert la lecture de domaine.
CREATE TABLE `irrigation_weather_forecast_archive` (
  `workspace_id` text NOT NULL,
  `location_key` text NOT NULL,
  `issued_on` text NOT NULL,
  `target_date` text NOT NULL,
  `horizon_days` integer NOT NULL,
  `precipitation_mm` real,
  `et0_mm` real,
  `minimum_temperature_celsius` real,
  `maximum_temperature_celsius` real,
  `solar_energy_mj_per_square_meter` real,
  `source` text NOT NULL,
  `fetched_at` text NOT NULL,
  PRIMARY KEY (`workspace_id`, `location_key`, `issued_on`, `target_date`),
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_forecast_archive_issued_on` CHECK (`issued_on` GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]'),
  CONSTRAINT `chk_forecast_archive_horizon` CHECK (`horizon_days` BETWEEN 1 AND 7),
  CONSTRAINT `chk_forecast_archive_target` CHECK (`target_date` = date(`issued_on`, '+' || `horizon_days` || ' days')),
  CONSTRAINT `chk_forecast_archive_non_negative` CHECK ((`precipitation_mm` IS NULL OR `precipitation_mm` >= 0) AND (`et0_mm` IS NULL OR `et0_mm` >= 0)),
  CONSTRAINT `chk_forecast_archive_source` CHECK (length(`source`) >= 1)
);
--> statement-breakpoint
CREATE INDEX `idx_forecast_archive_issued_on` ON `irrigation_weather_forecast_archive` (`issued_on`);
--> statement-breakpoint
CREATE INDEX `idx_forecast_archive_target` ON `irrigation_weather_forecast_archive` (`workspace_id`, `location_key`, `target_date`);
