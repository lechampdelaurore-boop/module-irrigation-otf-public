-- Sous-tranche 3.8 : les fonctionnalités à la carte, le choix de la ferme
-- (docs/feature-selection-contract.md, sections 4 et 7, PR 1, D-067).
--
-- Une ligne par espace d'irrigation : les cases cochées, les cases que la
-- ferme connaissait à son dernier choix (une case ajoutée ensuite arrive
-- décochée et s'annonce, R7), la date du dernier choix (R10 : la date, pas
-- l'historique des choix, précision P9) et celle de la fermeture du bandeau.
-- Pas de ligne : une ferme d'avant la 3.8, tout coché (R6). Les listes sont
-- des tableaux JSON d'identifiants ; le domaine écarte un identifiant
-- inconnu et complète les dépendances à la lecture.
--
-- Migration additive (docs/migrations-contract.md) : une table ; rien
-- d'autre n'est touché, aucune ligne écrite.
CREATE TABLE `irrigation_feature_selections` (
  `workspace_id` text PRIMARY KEY NOT NULL,
  `enabled_features` text NOT NULL,
  `known_features` text NOT NULL,
  `chosen_at` text,
  `banner_dismissed_at` text,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `irrigation_workspaces`(`id`) ON DELETE restrict,
  CONSTRAINT `chk_feature_selection_enabled` CHECK (json_valid(`enabled_features`) AND json_type(`enabled_features`) = 'array'),
  CONSTRAINT `chk_feature_selection_known` CHECK (json_valid(`known_features`) AND json_type(`known_features`) = 'array')
);
