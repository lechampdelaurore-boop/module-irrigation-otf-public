-- Tranche 4, sous-tranche 4.5, PR 1 : le registre des tâches attendues
-- (docs/tranche-4-contract.md, section 10 bis, F560, et section 10 bis.11,
-- F600 à F607).
--
-- Chaque tâche du registre (`lib/domain/operations/task-registry.ts`) garde
-- ses exécutions dans une ligne de `irrigation_background_jobs`, de clé
-- `task:<tâche>` : la fin de la dernière exécution, la dernière réussite et
-- le résumé du dernier échec existaient déjà. Deux colonnes s'y ajoutent :
-- le nombre d'exécutions manquées depuis la dernière réussite (trois de
-- suite font une panne, R2) et la fin de la première d'entre elles (« en
-- panne depuis »). Une réussite les remet à zéro.
--
-- Migration additive (docs/migrations-contract.md) : deux colonnes, l'une
-- avec une valeur par défaut, l'autre acceptant `NULL` ; aucune ligne
-- existante ne change de sens (le verrou de la météo les ignore).
ALTER TABLE `irrigation_background_jobs` ADD `consecutive_failures` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `irrigation_background_jobs` ADD `failing_since` text;
