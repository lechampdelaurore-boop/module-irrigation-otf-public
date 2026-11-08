# Audit du dépôt — 18 septembre 2026

Audit en lecture seule réalisé sur un clone local de
`lechampdelaurore-boop/module-irrigation-otf`, branche `main`, commit `7c320d1`
(« Merge pull request #14 … codex/next-eslint-next-16.3.5 »). Aucun fichier du
dépôt n'a été modifié ; ce rapport est le seul fichier ajouté, non suivi par Git.

Objectif : établir l'état réel du code avant de rédiger une nouvelle roadmap et
un socle qualité, conformément au cahier des charges simplifié et à la roadmap
Word du 18 septembre 2026.

## 1. Verdict en une page

Le dépôt est nettement plus sain que ce que la roadmap Word laissait craindre.
La documentation de pilotage dit la vérité : chaque affirmation du registre
`docs/ETAT_DU_PROJET.md` a été reproduite localement.

| Contrôle | Résultat local | Registre du projet |
| --- | --- | --- |
| `pnpm lint` | réussi | réussi |
| `pnpm typecheck` | réussi | réussi |
| `pnpm test` | 303 réussis, 0 échec, 2,8 s | 303 réussis |
| `pnpm build` (Vinext) | réussi | réussi |
| `pnpm push:check` | typage, 9 tests, déploiement à blanc réussis | 9 réussis |
| `pnpm weather:check` | typage, 2 tests, déploiement à blanc réussis | 2 réussis |

Points forts structurels : gouvernance écrite et appliquée, hygiène de code
exemplaire, schéma D1 fortement contraint, historique immuable testé, frontières
serveur respectées, secrets hors dépôt.

Faiblesses principales, par ordre d'importance :

1. la couche de persistance (6 000 lignes, 196 requêtes SQL préparées) n'a
   aucun test d'exécution ; les invariants d'isolation et d'immuabilité qu'elle
   porte ne sont vérifiés que par la recette manuelle ;
2. l'interface (8 500 lignes de composants, 5 100 lignes de CSS) n'a aucun test
   automatisé, ni de composant ni de parcours ;
3. quatre fichiers dépassent 1 100 lignes et deux composants client approchent
   1 500 lignes ; ils concentreront les prochaines évolutions (planning) ;
4. les frontières d'architecture tiennent par discipline, pas par outillage ;
5. quelques décisions de dépendances restent en suspens (Tailwind installé mais
   quasi inutilisé, framework Vinext en bêta, deux versions de Wrangler, quatre
   PR Dependabot ouvertes).

Aucune de ces faiblesses n'est un défaut constaté ; ce sont des risques de
dérive dans le temps, exactement ceux qu'un socle qualité doit fermer avant la
tranche de planification.

## 2. Photographie du dépôt

### Volume et rythme

| Mesure | Valeur |
| --- | --- |
| Commits | 75 depuis le 26 août 2026 (Codex 65, Dependabot 7, propriétaire 7 fusions) |
| Code applicatif `app/` | 8 490 lignes TS/TSX + 5 137 lignes CSS |
| Domaine et services `lib/` | 8 268 lignes, 52 modules |
| Persistance `db/` | 6 053 lignes, 15 dépôts + schéma de 1 114 lignes |
| Tests | 4 954 lignes, 31 fichiers, 303 tests + 11 tests Workers |
| Workers Cloudflare | environ 850 lignes de code réel, plus 28 900 lignes de types générés suivis par Git |
| Migrations D1 | 14 fichiers SQL, 898 lignes, journal complet |
| Tables | 38, avec 72 `CHECK`, 71 clés étrangères, 22 `UNIQUE`, 60 index, aucun `DROP` |

### Pile technique constatée

- Next 16.3.5 exécuté par Vinext 1.0.0-beta.3 sur Vite 8, React 19.2.6,
  TypeScript 5.9 strict, ESLint 9 avec la configuration Next uniquement.
- Hébergement OpenAI Sites (`.openai/hosting.json`, domaine `chatgpt.site`),
  authentification par en-têtes `oai-authenticated-user-*`, base Cloudflare D1
  via la liaison `DB`.
- Deux Workers Cloudflare : `irrigation-push` (Durable Objects, Web Push) et
  `irrigation-weather-scheduler` (cron 4 h 15 et 5 h 15).
- Météo : Visual Crossing par défaut, repli Open-Meteo, ET0 FAO-56.
- Tests : exécuteur natif `node --test` avec `--experimental-strip-types`,
  SQLite en mémoire via `node:sqlite` pour rejouer les migrations.
- pnpm 11.19.0 épinglé par `packageManager`, Node ≥ 22.13, CI sur 22.13.0.

### Gouvernance en place

- `AGENTS.md` : procédure de reprise, règles Git, contrôles obligatoires,
  invariants de sécurité et métier, format du compte rendu.
- `docs/ETAT_DU_PROJET.md` : registre d'état daté et exact.
- `docs/ROADMAP.md` : roadmap Markdown minimale et fiable.
- `docs/DECISIONS.md` : neuf décisions d'architecture (D-001 à D-009).
- `CHANGELOG.md`, modèle de PR avec liste de contrôles, Dependabot hebdomadaire
  avec exclusion des majeures de `@types/node`.
- CI GitHub : deux jobs (application, Workers) sur `push` et `pull_request`
  vers `main` : lint, typage, tests, compilation, contrôles Workers.
- Sept contrats métier et techniques dans `docs/` (OTF, météo, données,
  ressources, pompes, besoins, faisabilité) et une recette de tranche 2.

## 3. Ce qui est solide

### Hygiène de code

Sur `app/`, `lib/`, `db/` et les sources des Workers : zéro `any`, zéro
`@ts-ignore` ou `@ts-expect-error`, zéro `eslint-disable`, zéro `TODO`, zéro
`catch` vide. Aucun secret dans l'arbre de travail. Les 17 appels `console.*`
sont des journaux JSON structurés côté serveur.

### Frontières respectées

- Aucun module de `lib/` n'importe React ou Next.
- Les onze composants client (`'use client'`) n'importent depuis `db/` que des
  types (`import type`), jamais de code exécutable.
- Toutes les écritures passent par des actions serveur (`'use server'`) qui
  authentifient l'utilisateur, valident les entrées et délèguent aux dépôts
  (exemple : `app/irrigation/irrigation-need-actions.ts`).
- Le connecteur OTF est serveur, `GET` uniquement, liste blanche de routes.

### Données

- Historique immuable vérifié par test (« une irrigation réalisée ou annulée
  devient immuable », « une seconde confirmation retrouve un état final »).
- Isolation par `owner_user_id` et espace de travail dans chaque requête ;
  verrous optimistes par révision (`water_budget_revision`,
  `hydraulic_revision`) intégrés au même lot D1 que la mutation.
- Migrations additives, jamais de `DROP`, journal Drizzle complet, test qui
  rejoue les 14 migrations sur une base vide avec clés étrangères actives.
- Statuts d'irrigation exprimés en unions discriminées, pas en booléens.

### Règles du cahier des charges déjà encodées et testées

| Règle du cahier des charges | Preuve |
| --- | --- |
| mm pondérés par la surface, 100 m² à 10 mm + 300 m² à 30 mm = 25 mm | `tests/irrigation-history.test.ts:105-113` |
| Objectifs de plusieurs planches pondérés par surface | `tests/irrigation-history.test.ts:199` |
| Écart = objectif − (irrigation + pluie), donnée absente jamais assimilée à zéro | `README.md`, décision D-003 |
| 1 mm sur 1 m² = 1 L ; L/h jusqu'à 1 000 puis m³/h | `tests/irrigation-calculations.test.ts` |
| Semaines lundi-dimanche, fuseau Europe/Paris | décision D-004, `lib/water-management.ts` |
| Limite journalière bloque le nouveau, jamais le réel | recette tranche 2, `db/water-management-repository.ts` |
| Faisabilité 3.4 : déficit quantifié, jamais masqué, arbitrage manuel | 30 tests `tests/irrigation-feasibility.test.ts` |

### Sécurité

Comparaison de jeton en temps constant (`lib/weather/internal-auth.ts`),
chemins de retour assainis contre les redirections ouvertes
(`app/chatgpt-auth.ts`), contournement `LOCAL_DEMO_USER` neutralisé en
production, secrets requis déclarés dans les `wrangler.jsonc` sans valeur.

## 4. Écarts et risques, classés

### R1 — Persistance sans test d'exécution (priorité haute)

Les quinze dépôts de `db/` totalisent 6 053 lignes et 196 appels
`env.DB.prepare(...)` en SQL brut. Aucun test ne les exécute : les tests ne les
importent qu'en `import type`. Le test de migration valide le schéma, pas les
requêtes. Or ces requêtes portent les invariants les plus sensibles : filtrage
par propriétaire, immuabilité, révisions optimistes, limite journalière
atomique. Une régression y serait invisible pour la CI.

Même constat pour les modules d'orchestration de `lib/` qui dépendent de D1 :
`irrigation-service`, `irrigation-history-service`, `irrigation-needs-service`,
`irrigation-feasibility-service`, `pump-service`, `irrigation-push-service`,
`irrigation-push-orchestration`, `water-resource-dashboard`, `pump-dashboard`,
`weather/configured-provider` (environ 1 000 lignes).

Le plus gros fichier du dépôt, `db/irrigation-event-repository.ts`
(1 354 lignes, 31 requêtes, cycle de vie complet des irrigations), est dans ce
cas.

Piste : un adaptateur minimal reproduisant l'interface D1 (`prepare`, `bind`,
`first`, `all`, `run`, `batch`) au-dessus de `node:sqlite`, déjà utilisé par le
test de migration, permettrait de tester les dépôts sur le vrai SQL sans
Miniflare ni réseau.

### R2 — Interface sans aucun test automatisé (priorité haute)

`app/irrigation` compte 24 fichiers, dont deux composants client de
1 458 et 1 412 lignes (`irrigation-event-manager.tsx` : 23 `useState`,
5 `useEffect`, 27 fonctions internes ; `hierarchy-browser.tsx` : 22 fonctions
internes). Aucun test de composant, aucun parcours navigateur automatisé. La
non-régression repose sur la recette manuelle décrite dans
`docs/recette-tranche-2.md`, sérieuse mais non rejouable par la CI.

Piste : quelques parcours Playwright en mode `mock` + `LOCAL_DEMO_USER`, sur
ordinateur et à 390 px, pour les cas critiques déjà listés dans la recette
(irriguer maintenant, planifier, saisir a posteriori, cumuls et export).

### R3 — Fichiers concentrateurs (priorité haute avant la tranche planning)

| Fichier | Lignes | Rôle |
| --- | --- | --- |
| `app/irrigation/irrigation-event-manager.tsx` | 1 458 | formulaire, minuteur, conflits, alertes |
| `app/irrigation/hierarchy-browser.tsx` | 1 412 | navigation, plan, placements, tableaux de bord |
| `db/irrigation-event-repository.ts` | 1 354 | cycle de vie des irrigations |
| `db/schema.ts` | 1 114 | 38 tables (acceptable pour un schéma) |
| `app/irrigation/irrigation.css` | 5 137 | 297 sélecteurs, 17 media queries |

Le moteur de planning (3.5), son interface (3.6) et la replanification (3.7)
viendront naturellement s'y greffer. Sans découpage préalable, ces fichiers
deviendront illisibles pour un assistant comme pour un humain.

### R4 — Frontières non outillées (priorité moyenne)

La propreté constatée (lib sans React, clients en `import type`) n'est garantie
par aucune règle ESLint. Le dossier `lib/` mélange sans distinction des modules
purs (`irrigation-calculations`, `water-resources`, `irrigation-feasibility`) et
des services qui appellent D1 (`*-service.ts`, `*-dashboard.ts`). Une seule
configuration ESLint, celle de Next, sans règle d'import, sans Prettier, sans
détection de code mort.

Indice de duplication : l'arithmétique d'unités (`* 1000`, `/ 3600`, `/ 60000`)
apparaît dans une vingtaine de fichiers, dont 13 occurrences dans
`app/irrigation`, alors que `lib/irrigation-calculations.ts` existe. Le petit
journaliseur « warn ou info » est recopié à l'identique dans cinq modules.

### R5 — Choix de dépendances en suspens (priorité moyenne)

- **Tailwind 4.3.3 installé mais inutilisé** : 311 noms de classes distincts
  dans les écrans, 308 définis dans la feuille maison, 3 sans aucune règle,
  aucune classe utilitaire Tailwind ; le style vit dans `irrigation.css` et
  Tailwind ne sert que par sa remise à zéro des styles du navigateur. Il faut
  choisir : retirer Tailwind ou l'adopter. Payer les deux fait dériver.
- **Vinext 1.0.0-beta.3** : le moteur qui exécute Next sur Vite et Cloudflare
  est en bêta. C'est le point de fragilité unique de la pile ; à surveiller et
  à documenter comme risque accepté.
- **Deux Wrangler** : 4.92.0 à la racine, 4.127.1 dans les Workers.
- **Une seule dépendance non épinglée** : `@openai/sites-vite-plugin`
  (`^0.1.0 || ^0.2.0`), figée par le lockfile.
- **Drizzle ORM** : dépendance d'exécution dont seul `db/index.ts` se sert
  (`getDb()`, appelé nulle part). Le schéma Drizzle sert uniquement à générer
  les migrations ; huit migrations écrites à la main (0003 à 0006, 0008 à 0011)
  n'ont pas d'instantané dans `drizzle/meta`. Décider : soit Drizzle devient un
  simple outil de génération en devDependency avec un contrôle
  `drizzle-kit check` en CI, soit il est retiré.
- **Quatre PR Dependabot ouvertes** : `@block65/webcrypto-web-push` 1.0.2 →
  2.0.0 (majeure, Worker Push), `@cloudflare/workers-types`, React +
  `@types/react`, Vite 8.0.13 → 8.3.0. Quatre branches déjà fusionnées non
  supprimées (`codex/*`, `fix/otf-rate-limit-spacing`). Aucun tag de version.
- Ni `.nvmrc` ni `.node-version` alors que la CI épingle 22.13.0.

### R6 — Gouvernance GitHub (priorité moyenne, coût faible)

- `docs/ROADMAP.md` et `ETAT_DU_PROJET.md` indiquent que la protection de
  `main` exigerait une organisation Team ou Enterprise. À vérifier sur ton
  offre : les règles de protection de branche sur dépôt privé sont incluses
  dans l'offre individuelle GitHub Pro. Tant que `main` n'est pas protégée, la
  CI verte n'est pas bloquante : c'est la discipline qui l'impose.
- Décision D-007 : `origin` désigne le dépôt interne de l'environnement Codex et
  `github` le miroir. Le registre note que le dépôt interne « reste en retard ».
  Avec un clone local qui pointe directement sur GitHub, il faut désigner une
  seule source de vérité pour éviter deux historiques divergents.

### R7 — CI incomplète (priorité basse)

Pas de rapport de couverture, pas de détection de code mort, pas de contrôle
`drizzle-kit`, pas d'audit de vulnérabilités, pas de vérification que les
types Workers générés sont à jour. Aucun de ces manques n'est grave isolément.

### Vérifications GitHub, complément du 18 septembre 2026 en fin de journée

Après installation et connexion de GitHub CLI sur le poste du porteur :

- CI sur `main` : dernière exécution des « Contrôles du module » réussie sur
  la fusion de la PR #14.
- Quatre PR Dependabot ouvertes. #12 (`@cloudflare/workers-types`) : CI verte,
  fusionnable. #13 (Vite 8.0.13 → 8.3.0) : échec au typage, erreur TS2321
  « profondeur de types excessive » dans `vite.config.ts`, incompatibilité de
  types entre Vite 8.3 et les greffons Vinext ou Cloudflare, à traiter avec
  eux. #4 (React et `@types/react`) : échec à la compilation, cohérent avec la
  nécessité de monter `react-server-dom-webpack` en même temps. #6
  (`@block65/webcrypto-web-push` 2.0.0) : échec des tests de l'application,
  cause à établir avant fusion ; branche en retard sur `main`.
- Les alertes de vulnérabilités Dependabot sont désactivées sur le dépôt ;
  seules les mises à jour de versions sont actives.
- La suppression automatique des branches fusionnées est désactivée, ce qui
  explique les quatre branches mortes.
- Protection de `main` appliquée et relue par l'API le même jour : PR
  obligatoire, jobs « Application » et « Workers Cloudflare » requis, branche
  à jour exigée, aucun contournement administrateur, ni forçage ni
  suppression. Les trois PR à CI rouge apparaissent désormais « bloquées ».

## 5. Documents et code : les écarts

| Sujet | Roadmap Word (18 sept.) | Dépôt |
| --- | --- | --- |
| 3.4 Faisabilité et déficits | terminée | développée, recette utilisateur en cours |
| 2.10 Recette de la tranche 2 | partiellement terminée | terminée, compte rendu dans `docs/recette-tranche-2.md` |
| 3.1 bis Relevés compteur et débit | à faire avant 3.5 | absente de `docs/ROADMAP.md` |
| 3.5 à 3.9, tranche 4 | détaillées | « étape suivante : à cadrer » |
| Maintenance du dépôt (3.4.1) | Tailwind fait, Node 26 différé, Next/ESLint à faire, React à faire | Tailwind, Node types et Next/ESLint fusionnés le 18 sept. ; React et Web Push en PR Dependabot ouvertes |
| Audit du dépôt, AGENTS.md, PROJECT_STATUS.md (3.3.2, 3.3.3) | à faire | `AGENTS.md` et `ETAT_DU_PROJET.md` existent déjà ; le présent audit couvre 3.3.2 |
| Remotes Git | non mentionné | `origin` interne + `github` miroir (D-007), miroir en avance |

Les règles du cahier des charges absentes de `AGENTS.md` et qu'un futur
assistant pourrait donc réinventer : distinction prévu / estimé / observé,
pondération des mm par la surface, formule d'écart et ET0 volontairement hors
formule, mesure pluviomètre prioritaire, restriction qui bloque le nouveau mais
jamais le réel, série culturale recevant la totalité des mm de la planche,
trois contraintes distinctes pour les ressources.

## 6. Recommandation : une sous-tranche « socle qualité » avant la 3.5

Ordre proposé, chaque point livrable séparément et vérifiable par la CI :

1. **Tests des dépôts D1 sur SQLite en mémoire** (R1) : adaptateur D1 minimal,
   puis tests d'isolation, d'immuabilité, de révision et de limite journalière
   sur `irrigation-event-repository`, `water-management-repository` et
   `workspace-repository` en premier.
2. **Frontières outillées** (R4) : règles ESLint d'import (pas de React dans
   `lib/`, pas de code `db/` dans les composants client, pas de nombre magique
   d'unité hors module de conversion), séparation `lib/domain` pur et
   `lib/services`, détection de code mort en CI.
3. **Parcours navigateur automatisés** (R2) : Playwright en mode démonstration
   sur les quatre parcours critiques, ordinateur et 390 px, en CI.
4. **Découpage des deux composants de 1 400 lignes** (R3) sans changement de
   comportement, protégé par les parcours du point 3.
5. **Décisions de dépendances** (R5) : Tailwind, Drizzle, Wrangler unique,
   `.nvmrc`, traitement des quatre PR Dependabot par lots, suppression des
   branches fusionnées, premier tag.
6. **Gouvernance** (R6, section 5) : vérifier la protection de `main`, fixer la
   source de vérité Git, compléter `AGENTS.md` avec les invariants du cahier des
   charges et une définition de « terminé » exigeant les preuves.

Le point 1 est celui qui protège le plus le code existant ; le point 2 est celui
qui empêche le plus la dérive future. Les deux précèdent tout développement du
moteur de planning.

## 7. Environnement local mis en place pour cet audit

Sur ce poste : Git 2.55, nvm-windows 1.2.2, Node 22.23.2 activé, pnpm 11.19.0
via corepack, dépendances installées. Clone dans
`C:\Users\<utilisateur>\Projets\module-irrigation-otf`. Aucun fichier du dépôt modifié.
