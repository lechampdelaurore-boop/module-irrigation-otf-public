-- L'objectif automatique sur l'ET0, PR O2 (docs/objectif-automatique-contract.md,
-- section 3, règle 1 ; D-309, D-317) : le réglage « Objectif automatique »
-- d'une ferme, éteint au départ. L'allumer ou l'éteindre est un geste daté :
-- une ligne par geste, qui compte à partir de son jour, en heure de Paris,
-- comme une révision d'objectif (D-034) ; les jours d'avant gardent ce qu'ils
-- avaient. Sans ligne, le réglage est éteint : aucune ferme ne change sans son
-- geste (D-028).
--
-- Une ligne ne s'écrit que si elle change l'état en vigueur ; le journal des
-- modifications la dit dans le même lot (sujet `objectif-automatique`). Les
-- lignes se gardent autant que la ferme et partent avec elle (plan
-- d'effacement, `SPACE_TABLES`).
--
-- Comme les objectifs, le réglage change le besoin : chaque geste rend la
-- faisabilité à refaire (`feasibility_revision`, 3.4), par les trois
-- déclencheurs de la migration 0012 pour les tables qui changent le besoin.
--
-- Migration additive (docs/migrations-contract.md) : une table, un index,
-- trois déclencheurs ; aucune ligne existante ne change.
CREATE TABLE `irrigation_automatic_objective_revisions` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `enabled` integer NOT NULL,
  `actor_user_id` text NOT NULL,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_automatic_objective_enabled` CHECK (`enabled` IN (0, 1))
);
--> statement-breakpoint
CREATE INDEX `idx_automatic_objective_workspace_created` ON `irrigation_automatic_objective_revisions` (`workspace_id`, `created_at`);
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_automatic_objective_revisions_insert AFTER INSERT ON irrigation_automatic_objective_revisions BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = NEW.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_automatic_objective_revisions_update AFTER UPDATE ON irrigation_automatic_objective_revisions BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = NEW.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_automatic_objective_revisions_delete AFTER DELETE ON irrigation_automatic_objective_revisions BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = OLD.workspace_id; END;
