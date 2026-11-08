-- 5 quater, PR 3b (docs/crop-water-need-contract.md, « Adopter la proposition ») :
-- l'origine d'une révision d'objectif. NULL : saisie à la main, comme toutes
-- les révisions d'avant ; 'adopted-proposal' : la proposition de la semaine
-- adoptée par l'utilisateur. Migration additive (D-018) : aucune ligne n'est
-- réécrite.
ALTER TABLE `irrigation_hydric_goal_revisions` ADD `origin` text CHECK (`origin` IS NULL OR `origin` = 'adopted-proposal');
