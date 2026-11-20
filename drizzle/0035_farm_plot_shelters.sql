-- Tranche 4, sous-tranche 4.4, PR 2b : parcelles et abris
-- (docs/tranche-4-contract.md, section 8 bis, F420 ; précision F583).
--
-- `irrigation_plot_shelters` : le classement d'un jardin (parcelle d'Ouvre ta
-- ferme), abri ou plein champ, tel que la personne l'a confirmé, une ligne
-- par espace et par jardin. `proposed_sheltered` garde ce qui lui avait été
-- proposé (le type du jardin dans Ouvre ta ferme, sinon son nom), pour dire
-- d'où vient le classement : la proposition confirmée, ou corrigée. Un
-- jardin sans ligne est « à classer » pour un espace qui fait l'accueil :
-- son besoin en eau n'est pas calculé.
--
-- Un espace d'avant l'accueil (migration 0034) n'a aucune ligne ici et garde
-- son classement d'avant, lu d'Ouvre ta ferme (F426) : aucune ligne n'est
-- écrite pour lui, aucune valeur ne change. Aucun identifiant de ferme ni de
-- personne n'est écrit ici ; `otf_plot_id` est l'identifiant du jardin dans
-- Ouvre ta ferme, comme partout ailleurs dans le module.
--
-- Migration additive (docs/migrations-contract.md) : une table, vide.
CREATE TABLE `irrigation_plot_shelters` (
  `workspace_id` text NOT NULL,
  `otf_plot_id` text NOT NULL,
  `sheltered` integer NOT NULL,
  `proposed_sheltered` integer,
  `confirmed_at` text NOT NULL,
  `updated_at` text NOT NULL,
  PRIMARY KEY(`workspace_id`, `otf_plot_id`),
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_plot_shelter_sheltered` CHECK (`sheltered` IN (0, 1)),
  CONSTRAINT `chk_plot_shelter_proposed` CHECK (`proposed_sheltered` IS NULL OR `proposed_sheltered` IN (0, 1)),
  CONSTRAINT `chk_plot_shelter_plot` CHECK (length(`otf_plot_id`) > 0)
);
