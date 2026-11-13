# Q0 — Hébergement pilotable sur Cloudflare

Contrat de la sous-tranche, rédigé le 18 septembre 2026, à valider par le
porteur de projet avant toute ligne de code. Décision associée : D-016.

## Pourquoi

La publication sur OpenAI Sites est manuelle et passe par une conversation
avec Codex. Notre méthode repose sur des PR petites et fréquentes, chacune
suivie d'une recette sur le site réel : elle exige qu'une fusion dans `main`
publie le site sans geste humain. Par ailleurs la roadmap prévoyait déjà de
quitter la connexion par compte ChatGPT pour ouvrir le module à d'autres
fermes (4.7). Cette sous-tranche avance ce chantier et le limite à ce qui rend
la publication pilotable.

## Ce qui ne change pas

- Le métier, la persistance SQL, le schéma D1 et les 14 migrations : aucune
  règle, aucune table, aucune requête ne change. La base reste une base D1.
- Vinext, Vite, React et Next restent les outils d'exécution ; Cloudflare
  Workers est la cible de déploiement principale de Vinext.
- Les deux Workers existants, Push et planificateur météo, gardent leur code
  métier ; seuls leur adresse cible et un secret changent.
- Les règles d'`AGENTS.md` : PR obligatoire, CI verte, aucun secret dans Git.

## Cible

| Élément | Cible |
| --- | --- |
| Application | Worker Cloudflare `module-irrigation-otf` dans le compte du porteur, adresse `https://module-irrigation-otf.<sous-domaine>.workers.dev` |
| Base | D1 `module-irrigation-otf`, liaison `DB`, migrations du dossier `drizzle/` appliquées par Wrangler |
| Connexion | Cloudflare Access devant le Worker : code à usage unique envoyé au courriel du porteur ; identité transmise à l'application par le jeton `Cf-Access-Jwt-Assertion`, vérifié côté serveur |
| Route interne météo | `/api/internal/*` derrière Access comme le reste du Worker depuis le 13 novembre 2026 (D-100), la règle de contournement de la phase 1 retirée : le planificateur la joint par la liaison de service `IRRIGATION_SITE`, qui ne traverse pas Access ; elle reste protégée par son jeton partagé comparé en temps constant |
| Publication | GitHub Actions : à chaque fusion dans `main`, après les contrôles, application des migrations puis déploiement ; les Workers ne sont redéployés que si leur dossier a changé |
| Secrets | Dans Cloudflare, saisis par le porteur ; dans GitHub, un jeton d'API Cloudflare et l'identifiant de compte pour le déploiement |
| Développement local | Base D1 locale migrée par `wrangler d1 migrations apply --local`, utilisateur de démonstration hors production ; débloque la sous-tranche Q5 |

Variables et secrets de l'application, tous existants sauf les deux derniers :
`OTF_DATA_SOURCE=live`, `OTF_API_BASE_URL`, `OTF_API_TOKEN`,
`VISUAL_CROSSING_API_KEY`, `WEATHER_SYNC_SERVICE_TOKEN`,
`IRRIGATION_PUSH_SERVICE_URL`, `IRRIGATION_PUSH_SERVICE_TOKEN`,
`IRRIGATION_PUSH_VAPID_PUBLIC_KEY`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`.

## Changements de code

- `app/chatgpt-auth.ts` devient `app/access-auth.ts` : lecture et vérification
  du jeton Access (émetteur, audience, signature par les clés publiques du
  domaine Access, expiration) ; identifiant utilisateur = sujet du jeton,
  courriel affiché ; déconnexion par `/cdn-cgi/access/logout`. Les treize
  fichiers qui importent `getChatGPTUser` changent d'import, rien d'autre.
- `vite.config.ts` : retrait du greffon Sites et de `.openai/hosting.json` ;
  `wrangler.jsonc` à la racine porte la liaison D1, les variables non
  secrètes et `nodejs_compat`.
- `package.json` : retrait de `@openai/sites-vite-plugin` ; script `deploy`.
- Planificateur météo : la variable `IRRIGATION_SITE_URL` pointe sur la
  nouvelle adresse ; l'en-tête `OAI-Sites-Authorization` et le secret
  `IRRIGATION_SITE_BYPASS_TOKEN` disparaissent, le contrat du Worker est mis à
  jour. Worker Push : `VAPID_SUBJECT` pointe sur la nouvelle adresse.
- Liaisons de service, ajoutées en phase 3 après constat : un Worker ne peut
  pas joindre un autre Worker du même compte par son adresse publique
  `workers.dev` (la requête n'arrive jamais, réponse 404). Le planificateur
  appelle l'application par la liaison `IRRIGATION_SITE`, l'application
  appelle le Worker Push par la liaison `IRRIGATION_PUSH`, avec repli sur le
  réseau ordinaire hors Cloudflare.
- Export des données : route `GET /api/internal/export`, réservée au
  propriétaire authentifié, renvoyant toutes les lignes de toutes les tables
  en JSON. Elle est temporaire et retirée en phase 4.
- `.github/workflows/ci.yml` : job `deploy` conditionné à `main` et à la
  réussite des deux jobs existants.
- `db/index.ts`, `README.md`, `docs/publication.md`, contrats des Workers :
  textes alignés.

## Données

La base D1 de Sites n'est pas accessible depuis l'extérieur. Les données y
sont exportées une fois par la route d'export, publiée sur Sites par une
**dernière** publication via Codex. L'import dans la nouvelle base se fait par
un script qui rejoue les lignes table par table dans l'ordre des migrations,
identifiants conservés, contraintes différées le temps de l'import. La colonne
`owner_user_id` de `irrigation_workspaces`, seule table qui porte l'identité
du propriétaire, est remappée vers le nouvel identifiant Access. Les colonnes
d'attribution des journaux gardent l'ancien identifiant : l'historique n'est
pas réécrit.

Vérification : nombre de lignes identique par table entre l'export et la
nouvelle base ; contrôle visuel de la dernière irrigation, des objectifs de la
semaine, des pluies manuelles et des ressources.

### Procédure d'export et d'import

1. Publier `main` sur Sites une dernière fois (route `GET /api/export`).
2. Connecté au site Sites, ouvrir `/api/export?mode=counts` pour lire les
   comptages, puis `/api/export` : le navigateur télécharge
   `module-irrigation-otf-<date>.d1-export.json`. Le fichier contient toutes
   les lignes de toutes les tables et l'identifiant du propriétaire Sites ; il
   n'est jamais versionné (`*.d1-export.json` est ignoré par Git).
3. Se connecter une première fois au nouvel hébergement, ce qui crée l'espace
   de travail du propriétaire Access dans la base cible, encore vide.
4. Lancer l'import à blanc puis pour de vrai :

```text
node --experimental-strip-types scripts/import-d1-export.ts --file <export> --remote --owner-from-existing --dry-run
node --experimental-strip-types scripts/import-d1-export.ts --file <export> --remote --owner-from-existing
```

   Le script rejoue les migrations en mémoire pour ordonner les tables selon
   leurs clés étrangères, ignore les tables de plateforme dont le nom commence
   par `__`, vide la base cible, insère par lots bornés à 50 lignes et 64 Ko
   (D1 refuse toute instruction de plus de 100 000 octets), remappe
   `irrigation_workspaces.owner_user_id` de l'ancien identifiant vers celui de
   l'espace créé à l'étape 3, puis compare les comptages par table en une
   requête à sous-requêtes scalaires : tout écart fait échouer le script.
   `--verify-only` refait seulement la comparaison.

   Exécuté le 19 septembre 2026 : 375 lignes, 38 tables, comptages identiques.
5. Contrôle visuel sur la nouvelle adresse : dernière irrigation, objectifs de
   la semaine, pluies manuelles, ressources.

## Phases et points de non-retour

1. **Préparation, sans effet sur Sites.** Worker, base et migrations créés
   dans le compte du porteur ; Access configuré ; authentification réécrite ;
   déploiement sur l'adresse `.workers.dev` avec une base vide ; recette
   technique : connexion par code courriel, page vide fonctionnelle, lecture
   OTF réelle une fois les secrets saisis. Rien n'est irréversible.
2. **Export et import.** Route d'export fusionnée, dernière publication Sites
   par Codex, export, import, remappage, vérification des comptages. Sites
   reste la référence tant que l'étape 3 n'est pas prononcée.
3. **Bascule.** Workers repointés et redéployés, déploiement automatique
   activé, recette utilisateur sur la nouvelle adresse, dont le protocole de
   la 3.4. **Point de non-retour : la première écriture faite sur la nouvelle
   base.** À partir de là, Sites n'est plus utilisé.

   Exécutée le 19 septembre 2026 : jetons partagés et paire VAPID régénérés
   et posés sans affichage, secret `IRRIGATION_SITE_BYPASS_TOKEN` supprimé,
   Workers repointés et redéployés, liaisons de service en place,
   déclenchement manuel du planificateur reçu par l'application (HTTP 200).
   Clé météo ressaisie par le porteur, synchronisation réussie. Jeton d'API
   Cloudflare créé par le porteur et posé dans les secrets GitHub, job de
   déploiement automatique activé (`CLOUDFLARE_DEPLOY=true`) et exercé avec
   succès à la fusion de la PR #27. Première écriture réelle à 11:16 UTC :
   point de non-retour franchi. Erreur 1102 (limite de calcul du plan
   gratuit) résolue par le plan Workers payant, D-017. Sites n'est plus
   utilisé.
4. **Décommission.** Retrait du code Sites et de la route d'export, mise à
   jour de la documentation, suppression du site Sites après quatorze jours
   sans incident, décision D-016 close.

   Exécutée le 19 septembre 2026 : greffon `@openai/sites-vite-plugin`,
   `.openai/hosting.json`, fournisseur d'identité Sites, constante
   `__AUTH_PROVIDER__`, script d'enrobage `build:cloudflare` et route
   `GET /api/export` retirés ; `vite.config.ts` ne connaît plus qu'une
   cible ; scripts `build`, `dev` et `deploy`. Le module
   `lib/services/d1-export-import.ts` et le script d'import sont conservés comme
   outil de reprise d'un export au même format. Site Sites supprimé par le
   porteur le 3 octobre 2026, après quatorze jours sans incident ; l'ancienne
   adresse répond 404. D-016 close.

## Ce qui reste au porteur, une seule fois

- Se connecter à Cloudflare depuis ce poste par `wrangler login`, dans le
  navigateur, comme pour GitHub CLI.
- Créer un jeton d'API Cloudflare limité aux Workers, D1 et Access, et le
  coller dans les secrets GitHub avec l'identifiant de compte.
- Saisir les secrets de production par `wrangler secret put`, ou dans le
  tableau de bord Cloudflare.
- Donner l'adresse courriel autorisée par Access.
- Accepter la dernière publication Sites pour l'export.

## Preuve de fin

- Une fusion dans `main` déploie l'application sans geste humain, visible
  dans GitHub Actions ; la CI reste bloquante avant le déploiement.
- Connexion par code courriel réussie ; une adresse non autorisée est refusée.
- Comptages par table identiques entre l'export et la nouvelle base.
- Le lendemain matin, « Dernière synchronisation automatique » porte la date
  du jour sur la nouvelle adresse ; une notification Push de test arrive.
- Protocole `recette-3.4.md` déroulé sur la nouvelle adresse.
- `docs/publication.md` réécrit, `ETAT_DU_PROJET.md`, `CHANGELOG.md`,
  `DECISIONS.md` à jour ; site Sites supprimé à l'issue de la phase 4.

## Risques

- Le chemin de déploiement Vinext vers un Worker autonome n'a pas encore été
  exercé sur ce projet : la phase 1 commence par ce test, à blanc.
- Access devant des actions serveur et un service worker : à vérifier en
  phase 1, cookie de session inclus dans les requêtes de même origine.
- Format des migrations pour Wrangler : testé sur la base vide en phase 1.
- Complétude de l'export : garantie par les comptages, jamais supposée.
- Vinext reste en bêta, risque accepté par D-015, inchangé.

Effort : Fable 5.1 · Très élevé, plusieurs séances. La recette de la 3.4
attend la phase 3.
