# Contrat des migrations de schéma

Rédigé le 19 septembre 2026 (sous-tranche Q4, décision D-018). Il fixe comment
le schéma de la base D1 évolue, ce qui fait foi et ce que les tests
garantissent.

## Ce qui fait foi

- Les fichiers SQL de `drizzle/`, appliqués dans l'ordre de leur numéro, sont
  la seule vérité du schéma. En production, Wrangler les applique à la base D1
  (`pnpm db:migrate:remote`, exécuté par le job de déploiement avant la mise en
  ligne du Worker) et retient ceux déjà passés dans sa table `d1_migrations`.
  En local, `pnpm db:migrate:local` fait de même dans `.wrangler/state`.
- `db/schema.ts` décrit les mêmes tables pour les tests, dans le langage de
  `drizzle-orm`. Il ne sert à rien à l'exécution : la persistance passe par des
  requêtes SQL préparées (`docs/persistence-tests-contract.md`). `drizzle-orm`
  est donc une dépendance de développement, épinglée, importée par
  `db/schema.ts` et les tests seulement.
- Le test de dérive `tests/db/schema-drift.test.ts` rejoue toutes les
  migrations sur une base SQLite neuve et compare le résultat à `db/schema.ts` :
  mêmes tables, mêmes colonnes, mêmes `NOT NULL`, mêmes clés primaires, y
  compris composées. Il tient le rôle que tenaient les instantanés de
  drizzle-kit, désormais retirés.

## Règles

1. Une migration par changement, dans un fichier `drizzle/00NN_<sujet>.sql` au
   numéro suivant, nommé d'après ce qu'il fait (`0014_bed_need_override_guard`),
   les instructions séparées par la ligne `--> statement-breakpoint`.
2. SQL écrit à la main et relu, jamais généré (voir plus bas).
3. Additive : on ajoute des tables, des colonnes acceptant `NULL` ou munies
   d'une valeur par défaut, des index, des déclencheurs. On ne supprime ni ne
   renomme rien qui contienne des données. Un changement qui exige de recréer
   une table (SQLite ne modifie pas une contrainte en place) est exceptionnel :
   il copie les lignes dans la nouvelle table, se fait dans une PR dédiée,
   après export de la base, et se justifie dans le registre des décisions.
4. Une migration fusionnée ne se modifie plus. Une erreur se corrige par une
   nouvelle migration.
5. `db/schema.ts` change dans la même PR que le SQL ; le test de dérive doit
   passer, et les dépôts touchés reçoivent leurs tests dans `tests/db/`.
6. Wrangler 4.127 au minimum, racine et Workers à la même version : les
   versions antérieures échouent sur les déclencheurs.

## Procédure pour une nouvelle migration

1. Écrire le fichier SQL, additif, avec les points d'arrêt.
2. Mettre `db/schema.ts` à jour.
3. `pnpm test` : les tests rejouent toutes les migrations sur une base neuve,
   la nouvelle comprise ; le test de dérive liste chaque écart en une seule
   exécution.
4. `pnpm db:migrate:local`, puis essai local si l'interface est concernée.
5. PR. À la fusion, le déploiement applique la migration avant de publier le
   nouveau code : pendant les secondes qui séparent les deux étapes, l'ancien
   code tourne sur le nouveau schéma. La règle additive garantit qu'il
   continue de fonctionner.

## Pourquoi la génération est retirée

drizzle-kit avait produit les premières migrations à partir de `db/schema.ts`
et d'instantanés `drizzle/meta/*_snapshot.json`. Ces instantanés n'existaient
que pour six migrations sur quinze, et le dernier (0013) ne reflétait pas le
SQL réellement appliqué. Sonde du 19 septembre 2026, exécutée hors dépôt sur
une copie : `drizzle-kit generate` proposait une migration 0015 recréant deux
tables (`irrigation_equipment_pump_defaults`, `irrigation_pump_log`) pour
« corriger » des écarts qui n'existent pas dans la base, une opération
destructive et fausse. Retirés : `drizzle-kit`, le script `db:generate`,
`drizzle.config.ts` et `drizzle/meta/`. Le journal et les instantanés ne
servaient qu'à drizzle-kit ; Wrangler et les tests lisent les fichiers SQL.

## Interdits

- Modifier une migration fusionnée.
- Instruction destructive (`DROP`, suppression de colonne, réécriture de
  table) hors la procédure exceptionnelle ci-dessus.
- Laisser `db/schema.ts` diverger du SQL : le test de dérive échoue.
- Importer `drizzle-orm` ailleurs que dans `db/schema.ts` et les tests.
