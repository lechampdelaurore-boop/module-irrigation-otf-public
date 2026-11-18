-- Tranche 4, sous-tranche 4.3, PR 1 : le compteur partagé des appels à Ouvre
-- ta ferme (docs/tranche-4-contract.md, section 6.3, F359, F361 à F363, et
-- section 6.3 bis, F381 à F390).
--
-- Le quota d'OTF est celui de la ferme, toutes applications confondues. Le
-- module le comptait dans chaque instance du serveur ; il le compte désormais
-- dans la base, la même pour toutes les instances :
-- - `otf_call_starts` : une ligne par départ vers OTF, ou par place réservée
--   par une lecture complète (`reserved` = 1), gardée deux jours ;
-- - `otf_daily_calls` : les appels de chaque ferme par jour de Paris, tenus
--   par deux déclencheurs à chaque départ réel, gardés trente jours ;
-- - `otf_call_pauses` : la pause d'une ferme après une limite d'OTF, ou du
--   module entier (`*`) après des refus d'accès répétés ;
-- - `otf_authentication_failures` : les `401`, quinze minutes ;
-- - `otf_farm_reads` : le bail de la lecture complète en cours de chaque
--   ferme, et la base de la réserve de la suivante.
-- Aucune de ces tables ne contient de jeton, d'adresse ni de personne : des
-- fermes (leur identifiant OTF), des heures et des nombres.
--
-- Migration additive (docs/migrations-contract.md) : cinq tables, leurs index
-- et deux déclencheurs ; aucune ligne existante ne change.
CREATE TABLE `otf_call_starts` (
  `id` integer PRIMARY KEY NOT NULL,
  `pace_key` text NOT NULL,
  `started_at_ms` integer NOT NULL,
  `paris_day` text NOT NULL,
  `read_id` text,
  `reserved` integer DEFAULT 0 NOT NULL,
  CONSTRAINT "chk_otf_call_starts_reserved" CHECK("otf_call_starts"."reserved" IN (0, 1))
);
--> statement-breakpoint
CREATE INDEX `idx_otf_call_starts_pace` ON `otf_call_starts` (`pace_key`, `started_at_ms`);
--> statement-breakpoint
CREATE INDEX `idx_otf_call_starts_started_at` ON `otf_call_starts` (`started_at_ms`);
--> statement-breakpoint
CREATE INDEX `idx_otf_call_starts_read` ON `otf_call_starts` (`read_id`, `reserved`);
--> statement-breakpoint
CREATE TABLE `otf_daily_calls` (
  `pace_key` text NOT NULL,
  `paris_day` text NOT NULL,
  `calls` integer DEFAULT 0 NOT NULL,
  PRIMARY KEY(`pace_key`, `paris_day`)
);
--> statement-breakpoint
CREATE INDEX `idx_otf_daily_calls_day` ON `otf_daily_calls` (`paris_day`);
--> statement-breakpoint
CREATE TRIGGER `trg_otf_call_starts_count_insert`
AFTER INSERT ON `otf_call_starts`
WHEN NEW.reserved = 0
BEGIN
  INSERT OR IGNORE INTO otf_daily_calls (pace_key, paris_day, calls) VALUES (NEW.pace_key, NEW.paris_day, 0);
  UPDATE otf_daily_calls SET calls = calls + 1 WHERE pace_key = NEW.pace_key AND paris_day = NEW.paris_day;
END;
--> statement-breakpoint
CREATE TRIGGER `trg_otf_call_starts_count_reserved_start`
AFTER UPDATE OF `reserved` ON `otf_call_starts`
WHEN OLD.reserved = 1 AND NEW.reserved = 0
BEGIN
  INSERT OR IGNORE INTO otf_daily_calls (pace_key, paris_day, calls) VALUES (NEW.pace_key, NEW.paris_day, 0);
  UPDATE otf_daily_calls SET calls = calls + 1 WHERE pace_key = NEW.pace_key AND paris_day = NEW.paris_day;
END;
--> statement-breakpoint
CREATE TABLE `otf_call_pauses` (
  `scope` text PRIMARY KEY NOT NULL,
  `paused_until_ms` integer NOT NULL,
  `reason` text NOT NULL,
  CONSTRAINT "chk_otf_call_pauses_reason" CHECK("otf_call_pauses"."reason" IN ('rate-limit', 'day-limit', 'authentication-limit', 'authentication-brake'))
);
--> statement-breakpoint
CREATE TABLE `otf_authentication_failures` (
  `id` integer PRIMARY KEY NOT NULL,
  `failed_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_otf_authentication_failures_at` ON `otf_authentication_failures` (`failed_at_ms`);
--> statement-breakpoint
CREATE TABLE `otf_farm_reads` (
  `pace_key` text PRIMARY KEY NOT NULL,
  `lease_id` text,
  `lease_until_ms` integer DEFAULT 0 NOT NULL,
  `reserve_basis` integer,
  `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
