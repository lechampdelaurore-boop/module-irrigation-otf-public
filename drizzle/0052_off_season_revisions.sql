-- Ignorer l'irrigation hors saison, PR B2 (docs/objectif-automatique-saison-contract.md,
-- sections 4.3 à 4.5 et 6 ; D-337, D-341, D-352) : les gestes « Mettre hors
-- saison » et « Reprendre » d'une ferme, une ligne par geste, datée. Une
-- portée est une planche, un jardin ou un abri, une parcelle (chacun par son
-- identifiant OTF, qui le suit d'une saison à l'autre), tout le plein champ ou
-- tout le sous-abri (`mode`, au vocabulaire de `PlotMode`). Le geste compte à
-- partir de son jour, en heure de Paris, comme une révision d'objectif
-- (D-034) ; seul « Reprendre » lève une portée, rien ne la lève seul. Sans
-- ligne, rien n'est hors saison : aucune ferme ne change sans son geste
-- (D-028).
--
-- Une ligne ne s'écrit que si elle change l'état de sa portée ; le journal des
-- modifications la dit dans le même lot (sujets `jardin-hors-saison` et
-- `reprise-saison`). Rien n'est jamais réécrit ni effacé, sauf avec la ferme
-- (plan d'effacement, `SPACE_TABLES`).
--
-- Comme un objectif, un geste change le besoin : il rend la faisabilité à
-- refaire (`feasibility_revision`, 3.4), par les trois déclencheurs de la
-- migration 0012 pour les tables qui changent le besoin.
--
-- Migration additive (docs/migrations-contract.md) : une table, un index,
-- trois déclencheurs ; aucune ligne existante ne change. Son numéro suit le
-- dernier de `main` : il se recale au numéro libre en fusionnant `main`.
CREATE TABLE `irrigation_off_season_revisions` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `scope_level` text NOT NULL,
  `scope_id` text NOT NULL,
  `off_season` integer NOT NULL,
  `actor_user_id` text NOT NULL,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_off_season_scope_level` CHECK (`scope_level` IN ('bed', 'plot', 'zone', 'mode')),
  CONSTRAINT `chk_off_season_scope_id` CHECK (length(`scope_id`) > 0 AND (`scope_level` <> 'mode' OR `scope_id` IN ('garden', 'greenhouse'))),
  CONSTRAINT `chk_off_season_value` CHECK (`off_season` IN (0, 1))
);
--> statement-breakpoint
CREATE INDEX `idx_off_season_workspace_created` ON `irrigation_off_season_revisions` (`workspace_id`, `created_at`);
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_off_season_revisions_insert AFTER INSERT ON irrigation_off_season_revisions BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = NEW.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_off_season_revisions_update AFTER UPDATE ON irrigation_off_season_revisions BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = NEW.workspace_id; END;
--> statement-breakpoint
CREATE TRIGGER feasibility_irrigation_off_season_revisions_delete AFTER DELETE ON irrigation_off_season_revisions BEGIN UPDATE irrigation_workspaces SET feasibility_revision = feasibility_revision + 1 WHERE id = OLD.workspace_id; END;
