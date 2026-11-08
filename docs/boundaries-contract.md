# Contrat des frontières outillées (Q3)

Rédigé le 19 septembre 2026, avant le code de la sous-tranche. Il répond à
l'écart R4 de l'audit : la propreté des dépendances (bibliothèque sans React,
composants clients n'important la persistance qu'en type) n'était garantie par
aucune règle, `lib/` mélangeait modules purs et services appelant la base, les
facteurs d'unités étaient dispersés et un petit journaliseur recopié cinq fois.

## Objectif

Que la séparation des couches soit vérifiée par le lint à chaque PR, et non
par la relecture : un import interdit fait échouer `pnpm lint`, une conversion
d'unités hors du module dédié aussi, un fichier ou un export mort est signalé.
Aucun comportement ne change : les modules sont déplacés et renommés, jamais
réécrits, et le typage, les 404 tests et la compilation le vérifient.

## Zones de `lib/`

| Zone | Rôle | Peut importer |
| --- | --- | --- |
| `lib/domain/` | règles métier pures, calculs, formats, contrats de données | `lib/domain/` seulement |
| `lib/services/` | orchestration : lit et écrit par les dépôts, appelle les adaptateurs, journalise | `lib/domain/`, `lib/services/`, `lib/adapters/`, `db/`, `cloudflare:workers` |
| `lib/adapters/` | échanges avec l'extérieur : API OTF, fournisseurs météo, données de démonstration | `lib/domain/`, `lib/adapters/` |
| `db/` | persistance D1, SQL brut | `lib/domain/`, `db/`, `cloudflare:workers` (le seul point d'accès `db/binding.ts`), `drizzle-orm` |
| `app/` serveur (pages, actions, routes) | Next côté serveur | tout : domaine, services, adaptateurs, dépôts |
| `app/` client (`'use client'` : tout `.tsx` hors `page.tsx`, `layout.tsx` et `not-found.tsx` (la page introuvable, serveur, depuis la 3.8 quater), plus les modules sans JSX de `app/irrigation/irrigation-manager/`) | interface | `lib/domain/`, `lib/services/` par les actions serveur, et `db/` en `import type` uniquement ; jamais `cloudflare:workers` |

Interdits partout : `app/` depuis `lib/` ou `db/` ; React et Next hors de
`app/` ; `cloudflare:workers` hors de `lib/services/`, `db/` et du serveur
`app/`.

Ce qui a été rapatrié dans le domaine pour que la matrice tienne sans
exception nouvelle : l'erreur d'API OTF et l'extraction de collection
(`lib/domain/otf/api-contract.ts`, importés par le mapper, la politique
d'instantané et l'adaptateur), la forme d'une journée du tableau de bord de
l'eau (`WaterDashboardDay`, dans `lib/domain/water-management.ts`), les
données d'export de l'historique (`IrrigationHistoryExportData`, dans
`lib/domain/irrigation-history/contract.ts`) et le contrat de la synchronisation météo
automatique (`lib/domain/weather/automatic-sync-contract.ts`, réalisé par
`db/automatic-weather-repository.ts`). Déplacements de déclarations, sans
changement de comportement.

Les sous-dossiers `weather/` et `otf/` sont conservés à l'intérieur de chaque
zone : `lib/domain/weather/cache-policy.ts`, `lib/adapters/weather/open-meteo-provider.ts`,
`lib/services/weather/sync-engine.ts`.

### Répartition, constatée par les imports réels

- **domain** : `bed-order`, `domain`, `equipment-duplication`,
  `equipment-placement-domain`, `equipment-placement-state`,
  `feasibility-hydraulics`, `feasibility-notifications`, `garden-group-domain`,
  `irrigation-calculations`, `irrigation-coverage`, `irrigation-domain`,
  `irrigation-feasibility`, `irrigation-format`, `irrigation-history`,
  `irrigation-history-csv`, `irrigation-layout`, `irrigation-navigation`,
  `irrigation-needs`, `irrigation-notifications`, `irrigation-push-contract`,
  `irrigation-timer`, `planned-irrigation`, `pumps`, `snapshot-policy`,
  `snapshot-validation`, `water-management`, `water-resources`,
  `weather/cache-policy`, `weather/location`, `weather/refresh-control`,
  `weather/weather-provider`, `otf/mapper`.
- **services** : `irrigation-service`, `irrigation-feasibility-service`,
  `irrigation-needs-service`, `irrigation-history-service`,
  `irrigation-push-service`, `irrigation-push-orchestration`, `pump-service`,
  `pump-dashboard`, `water-dashboard`, `water-resource-dashboard`,
  `access-jwt`, `d1-export-import`, `weather/sync-engine`,
  `weather/automatic-sync`, `weather/configured-provider`,
  `weather/internal-auth`.
- **adapters** : `otf/read-client`, `otf/snapshot-reader`,
  `weather/open-meteo-provider`, `weather/visual-crossing-provider`,
  `mock-data`.

### Exception levée en Q6 : les enregistrements sont descendus dans le domaine

Jusqu'au 21 septembre 2026, six modules du domaine importaient **en type
seulement** des enregistrements définis dans `db/`. La dépendance était à
l'envers, et la règle la tolérait faute de mieux.

Q6 l'a fermée (décision D-020). Les descriptions vivent maintenant dans
`lib/domain` : `equipment-record`, `equipment-placement-record`,
`garden-group-record` et `irrigation-event-record`. Ce sont des modules de
types, sans aucun calcul ; `db/` les importe pour dire ce qu'il lit et ce
qu'il écrit. `lib/domain` n'importe donc plus rien de `db/`, même en type, et
un retour en arrière fait échouer le lint.

Subsiste une tolérance, sur une autre frontière : un composant client de
`app/` peut importer `db/` **en type seulement**, pour nommer ce qu'une action
serveur lui renvoie. Aucun n'en use aujourd'hui.

## Règles ESLint

Toutes portées par `eslint.config.mjs`, avec un message qui renvoie à ce
contrat :

1. **Imports par zone** (`no-restricted-imports` et sa variante TypeScript
   qui distingue les imports de type) selon la matrice ci-dessus, par motif
   de fichiers.
2. **Unités** : `lib/domain/units.ts` est le module unique de conversion
   (millimètres sur surface, litres et mètres cubes ; secondes, minutes,
   heures et jours ; millisecondes). Ses fonctions n'arrondissent pas et
   reproduisent l'ordre des opérations d'origine, pour des résultats en
   virgule flottante identiques. La règle `no-restricted-syntax` interdit
   ailleurs les littéraux `3600` et `60000` partout, et `1000` comme facteur
   d'une multiplication ou d'une division (une borne de saisie ou une
   longueur de texte de 1 000 restent libres). Les tests et les deux
   Workers, qui n'ont pas accès au module, sont hors du champ de la règle ;
   les facteurs écrits dans le SQL des dépôts (`/ 1000.0`, `/ 3600.0`)
   sont hors de portée du lint et restent commentés dans la requête. Les
   soixante-deux occurrences existantes, dans vingt-six fichiers, passent
   par les fonctions nommées ; l'arrondi à trois décimales du CSV devient
   `roundToDecimals` dans `lib/domain/irrigation-format.ts`.
3. **Taille des fichiers** : `max-lines` à 600 lignes hors lignes vides et
   commentaires, exceptions listées (`db/schema.ts`, types générés) ;
   **en erreur depuis la clôture de Q6**, le 21 septembre 2026, avec un test
   qui lit le dépôt réel pour que la limite reste tenue.
   Six fichiers dépassaient au
   19 septembre 2026 : `irrigation-event-manager.tsx` (1 395),
   `hierarchy-browser.tsx` (1 343), `irrigation-event-repository.ts`
   (1 292), `equipment-repository.ts` (731), `irrigation-history.ts`
   (674) et `irrigation-event-actions.ts` (602) : la liste de travail de
   Q6. Tous sont découpés depuis le 21 septembre 2026 :
   `db/irrigation-event/` (dix modules), `db/equipment/` (sept),
   `lib/domain/irrigation-history/` (six), `app/irrigation/irrigation-event/`
   (cinq modules extraits des actions), `app/irrigation/irrigation-manager/`
   (neuf modules extraits du composant, dont trois hooks) et
   `app/irrigation/hierarchy/` (six modules extraits de l’explorateur du
   plan). Aucun fichier ne dépasse plus la limite. La feuille de style, qu’ESLint
   ne lit pas, est tenue par ses propres tests (dix-huit fichiers dans
   `app/irrigation/styles/`).
4. **Journaliseur** : `lib/adapters/log.ts` (`logJsonLine`) remplace les
   cinq copies de la fonction « warn ou info » ; il vit dans les adaptateurs,
   écrire sur la console étant un échange avec l'extérieur, et services comme
   adaptateurs peuvent l'importer.

Cas négatif documenté et automatisé : `tests/lint-boundaries.test.ts` fait
tourner ESLint sur des extraits placés virtuellement dans chaque zone et
vérifie qu'un import interdit est refusé et qu'un import permis passe.

## Code mort et dépendances

`knip` (6.37.0, exact) est une dépendance de développement, configuré par
`knip.json` : espaces de travail du dépôt et des deux Workers, entrées de
l'application Next détectées, tests, fichiers de support du résolveur, scripts,
configurations Vite et ESLint (celle de drizzle a disparu avec drizzle-kit, Q4) ; `public/` ignoré (service worker
chargé par URL) ; dépendance ignorée `cloudflare` (le spécificateur
`cloudflare:workers`) ; `tailwindcss`, ignoré un temps parce qu'importé par la
feuille de style, a quitté le dépôt le 19 septembre 2026 (D-012, Q4). `pnpm knip`
fait partie de `pnpm check`
et du job « Application » de la CI : un fichier, un export ou une dépendance
inutilisés font échouer la PR. Nettoyage du 19 septembre 2026 : `db/index.ts`
(ORM jamais appelé) supprimé ; 69 exports jamais importés ailleurs
ramenés à des déclarations locales ; neuf symboles que plus rien n'utilisait
supprimés (types d'anciens échanges Push, validateurs sans appelant, une
requête SQL, une fonction de prélèvement). Un export conservé pour un usage
futur est retiré : le dépôt est la source, Git garde l'historique.

## Ce qui ne change pas

Aucune règle métier, aucun SQL, aucune signature exportée, aucun texte
d'interface. Les tests existants ne sont modifiés que dans leurs chemins
d'import. Les contrats de `docs/` qui citent un chemin sont mis à jour.

## Livraison

1. Ce contrat et le déplacement des modules en zones, chemins d'import
   réécrits ; typage, tests et compilation inchangés.
2. Règles d'import par zone, `max-lines`, test négatif.
3. Module d'unités et règle associée ; remplacement des facteurs.
4. Journaliseur unique ; `knip`, nettoyage du code mort, étape de CI.

## Preuve de fin

Un import interdit fait échouer le lint, prouvé par le test négatif ; un
littéral d'unité hors du module aussi ; `pnpm knip` vert en CI ; CI verte ;
404 tests inchangés hors chemins ; aucune modification de comportement.

Effort : Fable 5.1 · Très élevé, plusieurs séances.
