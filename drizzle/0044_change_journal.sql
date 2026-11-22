-- Amélioration n° 7 (docs/ameliorations-6-2-3-7-contract.md, section 5,
-- F706 à F709 ; D-285) : le journal des modifications, général, d'une
-- ferme. Qui a changé quoi, quand, de quoi à quoi, pour trois familles :
-- les objectifs (`objectif`), les réglages (`reglage`), le matériel et les
-- ressources (`materiel`).
--
-- Une ligne par changement, écrite **dans le même lot** que le changement
-- lui-même, à ses conditions mêmes : jamais l'un sans l'autre (F709). Les
-- journaux de domaine (créneaux, pompes, infrastructure de l'eau…) restent
-- tels quels ; celui-ci est la lecture d'ensemble (F706).
--
-- - `subject` : un code court et stable (`objectif-hydrique`,
--   `creneau-protege`…), la liste fermée de
--   `lib/domain/change-journal/subjects.ts` ;
-- - `object_id` : l'identifiant de la ligne touchée, quand l'objet en a un
--   (un créneau, un matériel) ; vide pour un réglage de toute la ferme ;
-- - `object_context` : le repère de l'objet au moment du changement (son
--   nom, la planche et la semaine d'un objectif), en JSON ;
-- - `action` : `cree`, `modifie` ou `supprime` ;
-- - `before_values` et `after_values` : en JSON, **les champs qui changent
--   seulement**, jamais l'objet entier ; vide avant une création, vide
--   après une suppression ;
-- - `actor_user_id` : la personne qui a fait le geste, l'identifiant déjà
--   gardé par les journaux de domaine ; jamais une adresse électronique.
--
-- Une ligne ne se modifie jamais ni ne s'efface : un journal qui se réécrit
-- ne prouve rien (comme D-006). Les deux déclencheurs le refusent, avec la
-- seule exception de l'effacement de la ferme en cours (`erasing`, 4.5,
-- D-246) : le journal se garde autant que la ferme et part avec elle
-- (F709 ; plan d'effacement, `SPACE_TABLES`).
--
-- Migration additive (docs/migrations-contract.md) : une table, un index,
-- deux déclencheurs ; aucune ligne existante ne change. Le journal commence
-- à sa mise en service : rien n'est reconstitué depuis les journaux de
-- domaine (§5.6). Numéro provisoire, à reprendre après la file de fusion
-- (0041 de la 4.5 est sur main, 0042 des messages du téléphone, et l'ET0
-- de la 4.4 à placer).
CREATE TABLE `irrigation_change_journal` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `family` text NOT NULL,
  `subject` text NOT NULL,
  `object_id` text,
  `object_context` text,
  `action` text NOT NULL,
  `before_values` text,
  `after_values` text,
  `actor_user_id` text NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_change_journal_family` CHECK (`family` IN ('objectif', 'reglage', 'materiel')),
  CONSTRAINT `chk_change_journal_action` CHECK (`action` IN ('cree', 'modifie', 'supprime')),
  CONSTRAINT `chk_change_journal_before` CHECK ((`action` = 'cree') = (`before_values` IS NULL)),
  CONSTRAINT `chk_change_journal_after` CHECK ((`action` = 'supprime') = (`after_values` IS NULL)),
  CONSTRAINT `chk_change_journal_json` CHECK ((`before_values` IS NULL OR json_valid(`before_values`)) AND (`after_values` IS NULL OR json_valid(`after_values`)) AND (`object_context` IS NULL OR json_valid(`object_context`)))
);
--> statement-breakpoint
CREATE INDEX `idx_change_journal_workspace_created` ON `irrigation_change_journal` (`workspace_id`, `created_at`);
--> statement-breakpoint
CREATE TRIGGER `trg_change_journal_no_update` BEFORE UPDATE ON `irrigation_change_journal`
BEGIN
  SELECT RAISE(ABORT, 'CHANGE_JOURNAL_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_change_journal_no_delete` BEFORE DELETE ON `irrigation_change_journal`
WHEN NOT EXISTS (SELECT 1 FROM `irrigation_farm_erasures` WHERE `workspace_id` = OLD.`workspace_id` AND `state` = 'erasing')
BEGIN
  SELECT RAISE(ABORT, 'CHANGE_JOURNAL_IMMUTABLE');
END;
