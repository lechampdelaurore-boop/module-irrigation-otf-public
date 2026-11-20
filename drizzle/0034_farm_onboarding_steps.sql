-- Tranche 4, sous-tranche 4.4, PR 1 : l'état de l'accueil d'une ferme
-- (docs/tranche-4-contract.md, section 8 bis, F417 et F426 ; précision F581).
--
-- Le numéro 0034, que F417 disait réservé à la 4.3, PR 3, est pris ici : les
-- migrations se suivent sans trou (tests/irrigation-migration.test.ts), et
-- la 4.3, PR 3 prendra le numéro libre au moment de son code (F581).
--
-- `irrigation_onboarding_steps` : une ligne par espace et par étape de
-- l'accueil que la personne confirme (où est la ferme, parcelles et abris,
-- sol, cultures, réglages à relire). Son état (`todo`, `proposed`,
-- `confirmed`, `skipped`), la date de la confirmation, et la valeur
-- proposée gardée, pour montrer ce qui a été proposé et ce qui a été
-- confirmé. Une étape sans ligne est « à faire » : un espace créé après
-- cette migration commence l'accueil, et rien n'y est confirmé à sa place.
--
-- Le marquage de l'espace existant (F426) : chaque espace qui existe au
-- moment de la migration reçoit ses cinq étapes « confirmées », d'origine
-- `before-onboarding` (« réglage d'avant l'accueil »). Aucune autre table
-- n'est touchée et aucune valeur ne change : la commune, le classement des
-- abris, le sol et les réglages restent ceux d'avant. Aucun identifiant de
-- ferme ni de personne n'est écrit ici (règle n° 16 de l'inventaire).
--
-- Migration additive (docs/migrations-contract.md) : une table, et ses
-- lignes de marquage.
CREATE TABLE `irrigation_onboarding_steps` (
  `workspace_id` text NOT NULL,
  `step` text NOT NULL,
  `state` text NOT NULL,
  `origin` text NOT NULL,
  `proposed_value` text,
  `confirmed_at` text,
  `updated_at` text NOT NULL,
  PRIMARY KEY(`workspace_id`, `step`),
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_onboarding_step` CHECK (`step` IN ('location', 'plots', 'soil', 'crops', 'settings')),
  CONSTRAINT `chk_onboarding_state` CHECK (`state` IN ('todo', 'proposed', 'confirmed', 'skipped')),
  CONSTRAINT `chk_onboarding_origin` CHECK (`origin` IN ('onboarding', 'before-onboarding')),
  CONSTRAINT `chk_onboarding_confirmed_at` CHECK ((`state` = 'confirmed') = (`confirmed_at` IS NOT NULL)),
  CONSTRAINT `chk_onboarding_before` CHECK (`origin` = 'onboarding' OR `state` = 'confirmed'),
  CONSTRAINT `chk_onboarding_proposed_value` CHECK (`proposed_value` IS NULL OR json_valid(`proposed_value`))
);
--> statement-breakpoint
INSERT INTO `irrigation_onboarding_steps` (`workspace_id`, `step`, `state`, `origin`, `proposed_value`, `confirmed_at`, `updated_at`)
SELECT `workspace`.`id`, `steps`.`step`, 'confirmed', 'before-onboarding', NULL,
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `irrigation_workspaces` AS `workspace`
CROSS JOIN (
  SELECT 'location' AS `step`
  UNION ALL SELECT 'plots'
  UNION ALL SELECT 'soil'
  UNION ALL SELECT 'crops'
  UNION ALL SELECT 'settings'
) AS `steps`;
