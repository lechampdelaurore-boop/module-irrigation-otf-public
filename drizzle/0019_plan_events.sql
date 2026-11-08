-- Sous-tranche 3.7 : le recalcul sur événement
-- (docs/replanning-contract.md, règles 4 à 10 ; docs/planning-contract.md,
-- « Le recalcul sur événement »).
--
-- Un calcul lancé par un événement retient le nom de cet événement, pour que
-- l'en-tête du plan dise « recalculé à 7 h 10 après la pluie saisie au
-- pluviomètre » (règle 7). Les calculs antérieurs n'en ont pas : NULL.
--
-- Chaque événement de la règle 4 est inscrit avant le recalcul, dans la
-- semaine et la saison qu'il concerne, puis marqué « recalculé » avec le
-- calcul qu'il a produit, ou « échoué ». L'événement lui-même — la pluie,
-- l'irrigation, le refus — vit dans sa propre table ; cette ligne ne porte
-- que le nom, l'heure et le sort du recalcul, pour que l'écran puisse dire
-- « plan antérieur à : pluie saisie mardi 7 h 10 — recalculez » quand le
-- recalcul n'a pas abouti (règle 6). Aucun identifiant de personne.
--
-- Migration additive (docs/migrations-contract.md) : une colonne nullable,
-- une table, un index.
ALTER TABLE `irrigation_plan_calculations` ADD COLUMN `trigger_event` text;
--> statement-breakpoint
CREATE TABLE `irrigation_plan_events` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `season` integer NOT NULL,
  `week_start` text NOT NULL,
  `kind` text NOT NULL,
  `occurred_at` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `calculation_id` text,
  `settled_at` text,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  FOREIGN KEY (`calculation_id`) REFERENCES `irrigation_plan_calculations`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_plan_event_season` CHECK (`season` BETWEEN 1900 AND 9999),
  CONSTRAINT `chk_plan_event_kind` CHECK (`kind` IN (
    'irrigation-planned', 'irrigation-updated', 'irrigation-started', 'irrigation-recorded', 'irrigation-completed',
    'irrigation-partially-completed', 'irrigation-remaining-canceled', 'irrigation-canceled',
    'rain-recorded', 'reservoir-level-observed', 'resource-flow-applied', 'daily-limit-changed',
    'objective-changed', 'threshold-changed', 'bed-need-decided', 'arbitration-validated',
    'equipment-placed', 'equipment-setting-changed', 'equipment-removed',
    'proposal-refused', 'proposal-validated')),
  CONSTRAINT `chk_plan_event_status` CHECK (`status` IN ('pending', 'recalculated', 'failed')),
  CONSTRAINT `chk_plan_event_settlement` CHECK (
    (`status` = 'pending' AND `calculation_id` IS NULL AND `settled_at` IS NULL)
    OR (`status` = 'recalculated' AND `calculation_id` IS NOT NULL AND `settled_at` IS NOT NULL)
    OR (`status` = 'failed' AND `calculation_id` IS NULL AND `settled_at` IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `idx_plan_events_week` ON `irrigation_plan_events` (`workspace_id`, `season`, `week_start`, `occurred_at`);
