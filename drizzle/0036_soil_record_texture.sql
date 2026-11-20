-- Tranche 4, sous-tranche 4.4, PR 3 : le sol à l'accueil
-- (docs/tranche-4-contract.md, section 8 bis, F421 ; précision F584).
--
-- `texture` : la texture de sol choisie avec une saisie du sol, l'une des
-- neuf classes du tableau 19 de la FAO-56, d'où l'eau évaporable de la
-- couche de surface (TEW) et l'eau facilement évaporable (REW) ont été
-- proposées. Elle dit d'où viennent TEW et REW ; elle ne change aucun calcul,
-- qui lit TEW et REW tels qu'enregistrés. Nulle : non dite, comme pour toute
-- saisie d'avant cette migration (F426 : aucune valeur ne change).
--
-- Migration additive (docs/migrations-contract.md) : une colonne, nulle pour
-- les lignes déjà là ; aucun identifiant de ferme ni de personne.
ALTER TABLE `irrigation_soil_records` ADD COLUMN `texture` text
  CONSTRAINT `chk_soil_record_texture` CHECK (`texture` IS NULL OR `texture` IN (
    'sand', 'loamy-sand', 'sandy-loam', 'loam', 'silt-loam', 'silt', 'silty-clay-loam', 'silty-clay', 'clay'
  ));
