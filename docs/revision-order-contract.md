# Contrat de l'ordre des journaux et des révisions

Rédigé le 4 octobre 2026, avant le code, pour le point ouvert 27 de
`docs/ETAT_DU_PROJET.md`. Le run de `main` lancé par la fusion de la PR #130
a rougi sur un test juste : l'historique des réglages du planning, lu « le
plus récent d'abord », rendait l'ordre inverse quand deux enregistrements
tombaient dans la même milliseconde. Le test l'avait toujours dit ; la
machine de la CI est seulement la première à avoir produit l'égalité.

## Règle

Un journal ou une table de révisions se lit dans l'ordre d'enregistrement :
le plus récent d'abord quand la lecture cherche la valeur en vigueur, du
plus ancien au plus récent quand elle rejoue l'histoire. Deux lignes
enregistrées dans la même milliseconde gardent l'ordre dans lequel la base
les a reçues.

L'ordre est donc `created_at` puis, pour départager, `rowid`, l'identifiant
de ligne que SQLite attribue à l'insertion. Jamais `id` : c'est un UUID tiré
au sort, et un identifiant préfixé par l'heure redevient un tirage au sort
dans la même milliseconde. `rowid` convient parce qu'une nouvelle ligne reçoit
toujours un identifiant supérieur à toutes celles présentes et que ces tables
ne connaissent pas la suppression ; D1 est SQLite, la base de test aussi.

Le domaine qui reçoit des révisions les tient pour déjà ordonnées. S'il les
trie de nouveau, il trie de façon stable sur les mêmes clés, semaine puis
date, sans départager par l'identifiant : deux révisions reçues dans la même
milliseconde restent dans l'ordre reçu, et la seconde fait foi.

## Ce qui ne change pas

Le schéma, les migrations, les écritures et la forme des identifiants. Seules
les clauses de tri des lectures changent, et la remise en ordre du domaine.

## Portée

Les lectures où le plus récent fait foi :

- le journal des réglages du planning, `irrigation_planning_settings_log`,
  lu par `listPlanningSettingsHistoryForUser` ;
- le journal des créneaux protégés, `irrigation_protected_slots_log`, lu par
  `listProtectedSlotHistoryForUser` (3.8 ter, depuis le 8 novembre 2026) ;
- les révisions d'objectif hydrique, `irrigation_hydric_goal_revisions`, lues
  pour une semaine par `listHydricGoalsForUser`, rejouées jusqu'à une semaine
  par `listHydricGoalRevisionsThroughWeekForUser`, et remises en ordre par
  `objectiveForBed` dans `lib/domain/irrigation-needs.ts` et, depuis le 9
  octobre 2026 (point ouvert 40), par `aggregateHydricObjective` dans
  `lib/domain/irrigation-history/summary.ts`, qui départageait par
  l'identifiant ;
- les révisions de limite journalière,
  `irrigation_daily_water_limit_revisions`, lues par
  `listDailyWaterLimitsForUser` ;
- les révisions de limite de prélèvement d'une ressource,
  `irrigation_water_resource_limit_revisions`, lues par
  `listWaterInfrastructureForUser`.

Hors portée, notés sans être corrigés : les ordres d'affichage départagés par
l'identifiant, placements de matériel, liaisons entre ressources et réserves,
éléments de l'historique des irrigations. L'ordre y est cosmétique, aucune
valeur en vigueur n'en dépend.

## Tests

Pour chaque lecture, un test de persistance insère deux révisions avec le
même `created_at` et des identifiants dont l'ordre alphabétique contredit
l'ordre d'insertion, puis vérifie que la seconde fait foi. Il échoue avant la
correction, à coup sûr, parce que l'égalité est posée et non attendue d'une
horloge. Un test du domaine fait de même avec deux révisions reçues dans la
même milliseconde.
