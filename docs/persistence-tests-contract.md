# Contrat des tests d'exécution de la persistance (Q2)

Rédigé le 19 septembre 2026, avant le code de la sous-tranche. Il répond à
l'écart R1 de l'audit : les dépôts de `db/` (quinze fichiers, environ 6 000
lignes, près de deux cents requêtes SQL brutes) n'étaient exécutés par aucun
test. Or ils portent les invariants les plus sensibles du module : filtrage
par propriétaire, immuabilité de l'historique, révisions optimistes, limite
journalière atomique.

## Objectif

Exécuter le vrai code des dépôts et leur vrai SQL dans la CI, sur une base
SQLite en mémoire migrée par les fichiers de `drizzle/`, sans Miniflare ni
réseau, et sans changer le comportement de production. Une régression dans une
requête doit faire échouer `pnpm test`.

## Ce qui ne change pas

- Le SQL des dépôts, leurs signatures et leur comportement : la sous-tranche ne
  corrige aucune règle métier. Un défaut révélé par un test devient une
  correction séparée, dans sa propre branche.
- Le schéma et les migrations.
- La CI : `pnpm test` reste la commande ; seule sa définition change.

## Point d'accès unique à D1

`db/binding.ts` remplace l'import direct de `env` dans les dépôts :

- `db` est une façade vers la base courante : `db.prepare(...)`,
  `db.batch(...)` s'adressent à la liaison `DB` du Worker au moment de l'appel.
  Le remplacement `env.DB` → `db` dans les dépôts est mécanique, vérifié par
  le typage ; aucun autre changement n'y est fait.
- `overrideDatabase(base)` est réservé aux tests : il substitue une base à la
  liaison du Worker ; `overrideDatabase(null)` rend la main.
- `currentDatabase()` expose la base courante aux rares usages qui ne passent
  pas par la façade (`db/index.ts`).

## Exécution du code applicatif sous Node

Le code est écrit pour Vite et le Worker. Un résolveur de modules,
`tests/support/resolve-hooks.mjs`, chargé par `node --import` avant les tests,
comble trois écarts, et seulement ceux-là :

| Écart | Traitement |
| --- | --- |
| `cloudflare:workers` n'existe que dans le Worker | remplacé par `tests/support/cloudflare-workers.mjs`, qui exporte un `env` vide et modifiable |
| alias `@/` de `tsconfig.json` | résolu vers la racine du dépôt |
| imports relatifs sans extension (`./schema`) | extension `.ts` (puis `.mts`, `.js`, `.mjs`, `index.ts`) ajoutée si le fichier existe |

Node exécute les fichiers TypeScript tels quels grâce à
`--experimental-strip-types` ; les fichiers `.tsx` ne sont pas concernés, les
dépôts n'en importent aucun.

## Adaptateur D1 sur `node:sqlite`

`tests/support/d1-sqlite.ts` reproduit le sous-ensemble de l'interface D1
utilisé par les dépôts, avec la sémantique de D1 :

| Méthode | Comportement reproduit |
| --- | --- |
| `prepare(sql).bind(...valeurs)` | instruction immuable ; `null`, nombres, chaînes, `bigint`, `Uint8Array` transmis ; booléens convertis en `1`/`0` ; `undefined` et objets refusés (`D1_TYPE_ERROR`) |
| `first()` / `first(colonne)` | première ligne ou `null` ; colonne absente → `D1_COLUMN_NOTFOUND` |
| `all()` / `run()` | `{ success: true, results, meta }` ; `meta.changes`, `meta.last_row_id`, `meta.changed_db`, `meta.rows_read` renseignés ; durées à `0` |
| `raw({ columnNames })` | lignes sous forme de tableaux, en-tête facultatif |
| `batch([...])` | transaction : tout le lot réussit ou aucune écriture n'est conservée ; résultats dans l'ordre |
| `exec(sql)` | exécution directe, `{ count, duration }` |
| erreurs SQL | message préfixé `D1_ERROR:` et cause conservée |
| `dump()`, `withSession()` | non pris en charge, erreur explicite |

Écarts assumés avec D1, sans effet sur les dépôts actuels : les statistiques
`duration`, `size_after` et `rows_written` sont approximatives ; la
distinction lecture/écriture d'une instruction repose sur son premier mot-clé
ou une clause `RETURNING` ; `raw` sans ligne ne rend pas d'en-tête ; les
limites de taille de D1 (100 000 octets par instruction) ne sont pas
appliquées. Les clés étrangères sont actives, comme dans D1.

`installTestDatabase()` crée une base migrée neuve, l'installe comme base
courante et rend `{ sqlite, d1, dispose }`. Chaque test repart d'une base
vide : pas d'état partagé entre tests.

## Fixtures

Les données de test sont créées par les dépôts eux-mêmes chaque fois qu'une
fonction publique le permet (`ensureWorkspaceForUser`, création de matériels,
d'irrigations…) ; l'insertion SQL directe est réservée aux états que les
dépôts ne produisent pas. Les tests d'isolation utilisent toujours deux
propriétaires et vérifient qu'aucune lecture ni écriture ne franchit la
frontière.

## Périmètre des tests, par ordre de priorité

1. Adaptateur : sémantique ci-dessus, base migrée (38 tables, clés
   étrangères et contraintes `CHECK` appliquées).
2. `workspace-repository` : espace par propriétaire, espace « en attente »
   distinct d'un espace rattaché à une ferme, révisions budget d'eau et
   hydraulique, annulation d'un lot en échec.
3. `irrigation-event-repository` (découpé en `db/irrigation-event/` par Q6,
   le 21 septembre 2026) : isolation entre propriétaires ; cycle
   complet planifiée, démarrée, pause, reprise, arrêt anticipé, confirmation
   partielle ; immuabilité d'une irrigation terminée ou annulée ; limite
   journalière atomique.
4. `water-management-repository` : révisions optimistes avec rejet d'une
   écriture périmée, préférences météo et verrou de synchronisation, pluie
   manuelle jamais écrasée, limite journalière.
5. Cache OTF par utilisateur et saison (`snapshot-cache`), puis les autres
   dépôts.
6. Dérive de schéma : les tables et colonnes de `db/schema.ts` correspondent
   exactement à la base migrée.

Livraison en plusieurs PR, chacune verte en CI ; la première pose le point
d'accès, le résolveur, l'adaptateur et les points 1 et 2.

## Preuve de fin

`tests/db/*.test.ts` verts en CI ; au moins un test par fonction exportée de
`db/irrigation-event/`, `water-management-repository` et
`workspace-repository` ; test de dérive de schéma en place ; aucun changement
de comportement en production, vérifié par le passage inchangé des 326 tests
existants et de la compilation.

Effort : Fable 5.1 · Très élevé, plusieurs séances.

Atteinte le 19 septembre 2026 en six PR : les quinze dépôts de `db/` ont
au moins un test par fonction exportée, le test de dérive de schéma est en
place, les 326 tests antérieurs sont inchangés et la compilation passe. Deux
défauts ont été révélés et corrigés le 19 septembre 2026 dans une PR séparée,
conformément à ce contrat : le retrait de la pompe par défaut d'un matériel
écrivait « none » comme identifiant de pompe dans le journal, refusé par la
clé étrangère (le journal reçoit désormais `NULL`) ; la contrainte
`chk_irrigation_bed_need_override` laissait passer un besoin calculé
mémorisé sans remplacement (déclencheurs de la migration 0014).
