# Module Irrigation — Ouvre ta ferme

Application externe privée destinée à être ouverte depuis le menu
**Production** d’Ouvre ta ferme. Le plan de la ferme se parcourt selon la
hiérarchie :

`Saison → Parcelle → Jardin ou abri → Planche`

Le projet se trouve volontairement dans son propre dossier et ne modifie pas
l’application `calculatrice` présente à côté.

## Reprendre le développement

Après une interruption, commencer par
[`docs/ETAT_DU_PROJET.md`](docs/ETAT_DU_PROJET.md), puis consulter la
[`roadmap`](docs/ROADMAP.md) et le
[`registre des décisions`](docs/DECISIONS.md). Les consignes de travail et les
contrôles obligatoires sont regroupés dans [`AGENTS.md`](AGENTS.md).

## Lecture du plan OTF — tranche 1

- connexion obligatoire par Cloudflare Access, code à usage unique envoyé au
  courriel autorisé ;
- choix d’une saison construite à partir de `seasonFirst` et `seasonLast` ;
- navigation responsive entre parcelles, jardins/abris et planches ;
- affichage des dimensions, de la surface et de `alleyWidth`, avec deux
  décimales fixes pour la largeur de planche et le passe-pied ;
- site privé publié en mode `live` avec les données OTF réelles ;
- données de démonstration réservées au développement local sans configuration
  `live` ;
- connecteur OTF exclusivement serveur et exclusivement `GET` ;
- pagination bornée à 500 éléments par page ;
- validation atomique des cinq lectures de la saison consultée avant
  remplacement du cache ;
- cache D1 de la dernière lecture complète, daté et isolé par utilisateur et
  par saison ;
- réutilisation automatique d’un cache âgé de moins de quatre heures et
  actualisation manuelle forçant une nouvelle lecture ;
- état explicite avec ou sans cache lorsque l’API est indisponible ou que sa
  limite de requêtes est atteinte ;
- rejet explicite d’une saison hors de la plage OTF, avec retour vers la saison
  valide la plus proche ;
- migration SQL et tests de sécurité/comportement.

La lecture OTF s’arrête volontairement au plan physique : parcelles, jardins,
abris et planches. Les cultures, séries et assolements ne sont pas importés.
Les données propres à l’irrigation sont enregistrées séparément dans le module.

## Fondations de la deuxième tranche

Le modèle D1 prépare désormais les données propres au domaine irrigation :

- inventaire des matériels physiques, archivage et dix réglages maximum ;
- duplication complète d’un matériel avec ses réglages, débits et profils ;
- profils d’aspersion par distance et débits uniformes du goutte-à-goutte ;
- groupes de jardins et placements saisonniers référencés par identifiants OTF ;
- irrigations planifiées, partielles, réalisées ou annulées ;
- instantanés historiques des réglages, placements et apports par planche ;
- journal des modifications importantes attribué à l’utilisateur authentifié.

Ces tables ne recopient pas le plan de la ferme. Le contrat détaillé se trouve
dans `docs/irrigation-data-model.md`. L’interface permet déjà de gérer
l’inventaire et ses réglages, de décrire les groupes de jardins alignés, puis de
placer un matériel sur une planche ou entre deux planches pour chaque saison.
Le goutte-à-goutte accepte une sélection de plusieurs planches. Ces écritures
restent propres au module d’irrigation et ne modifient jamais OTF.

Le plan calcule également un aperçu horaire : les profils d’aspersion sont
interpolés à la distance du centre de chaque planche, en tenant compte des
passe-pieds, de l’ordre physique des planches et des distances entre jardins
alignés. Les apports de plusieurs matériels sont cumulés sur les planches qui
se chevauchent et les consommations sont affichées en L/h ou m³/h.

Le module permet également d’enregistrer, de planifier ou de démarrer une
irrigation, avec calcul de durée, minuteur persistant, pause, reprise, arrêt
anticipé, confirmation de fin et archivage des apports réellement effectués.

La sous-tranche 2.8 ajoute sur la même page les objectifs hydriques
hebdomadaires, les prévisions de pluie et d’ET0, les pluies mesurées, ainsi
qu’une limite journalière en m³. Les cumuls séparent toujours réalisé, planifié,
réanalyse et prévision. La sous-tranche 3.3 réutilise ces données pour calculer
le besoin restant de chaque planche, sans décider de sa faisabilité hydraulique.

La sous-tranche 2.9 exploite l’historique immuable pour produire des cumuls par
semaine, mois, saison ou période personnalisée. Les résultats peuvent être
filtrés à l’échelle de la ferme, d’une parcelle, d’un jardin/abri ou d’une
planche. Le volume repose uniquement sur l’eau réellement appliquée, les mm
sont pondérés par les surfaces physiques aux niveaux supérieurs et la surface
irriguée n’est comptée qu’une fois par planche. La pluie réelle, l’ET0,
l’objectif historique proratisé et l’écart `objectif − (irrigation + pluie)`
sont présentés sans assimiler une donnée absente à zéro. L’historique paginé,
son détail chronologique et l’export CSV restent strictement en lecture seule.

La sous-tranche 2.10 clôt la tranche 2 par une recette de non-régression sur
ordinateur et smartphone, l’audit des frontières serveur et de l’isolation des
données, la validation de toutes les migrations et les suites de tests de
l’application et du Worker Push. Le compte rendu reproductible se trouve dans
[`docs/recette-tranche-2.md`](docs/recette-tranche-2.md). Le suivi par séries
culturales reste une extension séparée, bloquée tant que le contrat OTF ne
fournit pas l’occupation datée des planches par série.

La météo utilise par défaut la commune du siège OTF, avec une autre commune
sélectionnable et un retour au siège. Une mesure de pluie manuelle reste
prioritaire. Une synchronisation serveur quotidienne met à jour les prévisions
et rattrape les réanalyses manquantes même si personne n’ouvre le site. La
restriction en m³/jour bloque une nouvelle irrigation dépassant
le budget, mais ne bloque jamais la saisie d’une irrigation réellement effectuée.
Voir [le contrat météo](docs/weather-contract.md) et
[le modèle de données](docs/irrigation-data-model.md) pour la provenance, le cache,
les migrations et le périmètre exact de « Tout vider ».

## Démarrage local

Prérequis : Node.js 22.13 ou supérieur et pnpm.

```bash
pnpm install
pnpm dev
```

Le mode `mock` est utilisé si `OTF_DATA_SOURCE` n’est pas défini. En
développement local, `LOCAL_DEMO_USER=true` (dans `.dev.vars`) fournit un
utilisateur de démonstration ; ce contournement est neutralisé en production,
où Cloudflare Access authentifie chaque requête.

## Configuration de l’API réelle

Ne jamais coller un jeton dans le code, le navigateur, une URL, Git ou une
conversation. Créer un nouveau jeton après révocation de tout jeton déjà exposé,
puis le déposer dans le gestionnaire de secrets du serveur :

```dotenv
OTF_DATA_SOURCE=live
OTF_API_BASE_URL=https://api.ouvretaferme.org/0.1beta
OTF_API_TOKEN=valeur-secrete
```

La prévision météo gratuite utilise une seconde clé, conservée elle aussi
uniquement dans les secrets du serveur :

```dotenv
VISUAL_CROSSING_API_KEY=valeur-secrete
```

Sans cette clé, le repli Open-Meteo reste actif pour faciliter le développement
local, mais son service Forecast est actuellement limité depuis l’hébergement
partagé et ne doit pas être considéré comme la configuration publiée finale.

Le jeton doit posséder uniquement les portées suivantes :

- `general:read` pour `/configuration` et `/me` ;
- `production:read` pour `/zoneList`, `/plotList` et `/bedList`.

Sous Windows, `scripts/save-otf-token.ps1` permet de saisir le jeton dans une
invite masquée. Il est enregistré hors du projet et hors OneDrive, dans les
données locales de l’application, avec des permissions limitées au compte
Windows courant. Les scripts `run-otf-smoke-test.ps1` et `start-live.ps1` le
chargent uniquement dans l’environnement du processus qui contacte OTF. Ils
utilisent le magasin de certificats Windows avec `--use-system-ca` ; la
vérification TLS reste active.

La base officielle est limitée par le connecteur à
`https://api.ouvretaferme.org/0.1beta`. Les tests automatisés utilisent des
réponses simulées et ne contactent jamais OTF. Le test manuel suivant utilise
uniquement les cinq routes GET autorisées et ne révèle pas la clé :

```powershell
$node = (Get-Command node).Source
.\scripts\run-otf-smoke-test.ps1 -NodePath $node -Season 2026 -VerifyErrorStates
```

Le test s’arrête immédiatement si OTF répond `429` et doit alors être relancé
seulement après la réinitialisation du quota.

Pour contrôler plusieurs saisons, relancer la commande avec chaque valeur
annoncée par `/configuration`. Le dernier contrôle réel consigné se trouve dans
`docs/otf-contract.md`.

## Commandes de contrôle

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm knip
```

## Organisation

- `app/irrigation` : page protégée et navigation utilisateur ;
- `lib/otf` : liste blanche des routes, lecture GET, pagination et adaptation ;
- `lib/domain/snapshot-policy.ts` : politique « lecture réelle ou dernier cache » ;
- `lib/weather` : contrat fournisseur, géocodage et lecture météo côté serveur ;
- `cloudflare/irrigation-weather-scheduler` : déclenchement quotidien autonome de la météo ;
- `lib/domain/water-management.ts` : semaines, volumes, minuit et limite journalière ;
- `lib/domain/water-resources.ts` : ressources, réserves, topologie et projections de disponibilité ;
- `lib/domain/irrigation-history.ts` : périodes, filtres et agrégations historiques ;
- `lib/domain/irrigation-history-csv.ts` : export tabulaire de la sélection courante ;
- `db/snapshot-cache.ts` : persistance D1 par requêtes préparées ;
- `db/irrigation-history-repository.ts` : projection en lecture seule de l’historique 2.7 ;
- `drizzle` : migration SQL versionnée ;
- `tests` : contrats GET-only, pagination, mapping et repli sur cache ;
- `docs/otf-contract.md` : contrat technique pour l’intégration OTF.
- `docs/push-worker-contract.md` : frontière de sécurité et garanties du Worker Push.
- `docs/weather-scheduler-contract.md` : horaire, authentification et reprise de la météo serveur.
- `docs/recette-tranche-2.md` : matrice de recette finale de la tranche 2.
- `docs/water-resources-contract.md` : contrat métier et limites de la sous-tranche 3.1.
- `docs/pumps-hydraulic-contract.md` : pompes, origines multiples et contrôle de débit de la sous-tranche 3.2.
- `docs/irrigation-needs-contract.md` : besoins hebdomadaires par planche, seuil, priorités et remplacements manuels de la sous-tranche 3.3.
- `docs/publication.md` : fusion GitHub, déploiement automatique sur Cloudflare et redéploiement des Workers.
- `docs/persistence-tests-contract.md` : exécution du vrai SQL des dépôts sur SQLite en mémoire dans les tests (Q2).
- `docs/boundaries-contract.md` : zones `lib/domain`, `lib/services`, `lib/adapters`, règles d'import, unités, taille des fichiers, code mort (Q3).
- `docs/migrations-contract.md` : migrations SQL manuscrites et additives, `db/schema.ts` vérifié par le test de dérive, génération retirée (Q4).
- `docs/browser-journeys-contract.md` : parcours navigateur automatisés, mode déterministe, base locale et job d'intégration continue (Q5).
- `docs/revision-order-contract.md` : ordre des journaux et des révisions, départage par `rowid`, jamais par un identifiant tiré au sort (point ouvert 27).

## Intégration ultérieure dans OTF

L’application conserve un adaptateur OTF séparé de l’interface. Si le
développeur d’Ouvre ta ferme souhaite ensuite intégrer le module au serveur
principal, cet adaptateur pourra être remplacé par un service métier interne
sans réécrire la navigation ni les règles de cache.

## Licence

Ce code est publié sous la licence [PolyForm Shield 1.0.0](LICENSE) : vous pouvez l'utiliser, l'étudier et le modifier, y compris dans votre ferme, mais pas le revendre, ni l'offrir en service concurrent. Les polices de `public/fonts` gardent leur propre licence (SIL OFL 1.1).
