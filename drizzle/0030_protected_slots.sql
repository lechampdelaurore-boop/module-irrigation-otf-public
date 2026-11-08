-- Sous-tranche 3.8 ter : les créneaux protégés nommés
-- (docs/protected-slots-contract.md, section 5, D-062, précisions D-071).
--
-- Une ligne par créneau d'une exploitation : son nom, ses jours de la semaine
-- (sept indicateurs, un au moins), son début et sa fin en minutes depuis
-- minuit, comme une plage horaire du planning (une fin avant le début passe
-- minuit, début et fin différents), son état actif ou supprimé — la
-- suppression est logique — et ses dates. Le journal garde chaque version,
-- valeurs comprises : la création, chaque modification, la suppression.
--
-- Migration additive (docs/migrations-contract.md) : deux tables et deux
-- index ; aucun créneau par défaut n'est écrit, aucune ligne existante ne
-- change.
CREATE TABLE `irrigation_protected_slots` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `name` text NOT NULL,
  `monday` integer NOT NULL,
  `tuesday` integer NOT NULL,
  `wednesday` integer NOT NULL,
  `thursday` integer NOT NULL,
  `friday` integer NOT NULL,
  `saturday` integer NOT NULL,
  `sunday` integer NOT NULL,
  `start_minute` integer NOT NULL,
  `end_minute` integer NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `actor_user_id` text NOT NULL,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_protected_slot_name` CHECK (length(trim(`name`)) BETWEEN 1 AND 80),
  CONSTRAINT `chk_protected_slot_days` CHECK (
    `monday` IN (0, 1) AND `tuesday` IN (0, 1) AND `wednesday` IN (0, 1) AND `thursday` IN (0, 1)
    AND `friday` IN (0, 1) AND `saturday` IN (0, 1) AND `sunday` IN (0, 1)
    AND `monday` + `tuesday` + `wednesday` + `thursday` + `friday` + `saturday` + `sunday` >= 1
  ),
  CONSTRAINT `chk_protected_slot_minutes` CHECK (
    `start_minute` BETWEEN 0 AND 1439 AND `end_minute` BETWEEN 0 AND 1439 AND `start_minute` != `end_minute`
  ),
  CONSTRAINT `chk_protected_slot_status` CHECK (`status` IN ('active', 'deleted'))
);
--> statement-breakpoint
CREATE INDEX `idx_protected_slots_workspace` ON `irrigation_protected_slots` (`workspace_id`, `status`);
--> statement-breakpoint
CREATE TABLE `irrigation_protected_slots_log` (
  `id` text PRIMARY KEY NOT NULL,
  `slot_id` text NOT NULL,
  `workspace_id` text NOT NULL,
  `change` text NOT NULL,
  `name` text NOT NULL,
  `monday` integer NOT NULL,
  `tuesday` integer NOT NULL,
  `wednesday` integer NOT NULL,
  `thursday` integer NOT NULL,
  `friday` integer NOT NULL,
  `saturday` integer NOT NULL,
  `sunday` integer NOT NULL,
  `start_minute` integer NOT NULL,
  `end_minute` integer NOT NULL,
  `actor_user_id` text NOT NULL,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (`slot_id`) REFERENCES `irrigation_protected_slots`(`id`) ON DELETE restrict,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_protected_slot_log_change` CHECK (`change` IN ('created', 'updated', 'deleted'))
);
--> statement-breakpoint
CREATE INDEX `idx_protected_slots_log_workspace` ON `irrigation_protected_slots_log` (`workspace_id`, `created_at`);
