-- Sous-tranche 3.7 : « Garder » une suggestion
-- (docs/replanning-contract.md, règle 17 et « Données » ;
-- docs/planning-contract.md, « Les suggestions sur les arrosages validés »).
--
-- À chaque calcul, le moteur suggère « Annuler » ou « Réduire à X mm » sur
-- un arrosage validé devenu inutile ou trop grand ; les suggestions vivent
-- dans le résumé du calcul. « Garder » fait taire une suggestion : le
-- registre retient, par irrigation planifiée, la suggestion tue avec sa dose,
-- pour qu'elle ne revienne que si un calcul suivant en fait une autre — une
-- autre dose, ou « Annuler » après « Réduire ». Ce n'est pas un événement :
-- rien ne se recalcule. Aucun identifiant de personne autre que l'auteur du
-- geste, comme sur les réglages.
--
-- Migration additive (docs/migrations-contract.md) : une table, un index.
CREATE TABLE `irrigation_plan_suggestion_keeps` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `season` integer NOT NULL,
  `event_equipment_id` text NOT NULL,
  `suggestion` text NOT NULL,
  `dose_mm` real,
  `actor_user_id` text,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  FOREIGN KEY (`event_equipment_id`) REFERENCES `irrigation_event_equipment`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_plan_keep_season` CHECK (`season` BETWEEN 1900 AND 9999),
  CONSTRAINT `chk_plan_keep_suggestion` CHECK (`suggestion` IN ('cancel', 'reduce')),
  CONSTRAINT `chk_plan_keep_dose` CHECK (
    (`suggestion` = 'cancel' AND `dose_mm` IS NULL)
    OR (`suggestion` = 'reduce' AND `dose_mm` IS NOT NULL AND `dose_mm` > 0))
);
--> statement-breakpoint
CREATE INDEX `idx_plan_suggestion_keeps_season` ON `irrigation_plan_suggestion_keeps` (`workspace_id`, `season`, `event_equipment_id`);
