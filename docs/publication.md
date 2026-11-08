# Publication du site et des Workers

Procédure en vigueur depuis le 19 septembre 2026, phase 3 de la sous-tranche
Q0 (décision D-016). Elle remplace la publication manuelle sur OpenAI Sites.
GitHub reste la source de vérité du code (D-011) et, désormais, une fusion
dans `main` publie l'application.

## 1. Fusionner le code sur GitHub

Toute modification passe par une PR sur `main`, protégée : les deux jobs de
contrôle, « Application » et « Workers Cloudflare », doivent être verts.
L'assistant la fusionne lui-même une fois prête, une PR à la fois (D-048).

## 2. Déploiement automatique par GitHub Actions

Le job « Déploiement Cloudflare » du workflow `.github/workflows/ci.yml`
s'exécute à chaque poussée sur `main`, après la réussite des deux jobs de
contrôle, et seulement si la variable de dépôt `CLOUDFLARE_DEPLOY` vaut
`true`. Il enchaîne :

1. `pnpm build`, compilation Vinext ciblant le Worker ;
2. `pnpm db:migrate:remote`, application des migrations du dossier `drizzle/`
   encore inconnues de la base D1 distante ;
3. `pnpm deploy`, déploiement de l'application ;
4. redéploiement du Worker Push et du planificateur météo, chacun seulement si
   son dossier a changé depuis la version précédente de `main` ; les deux sont
   redéployés quand l'historique ne permet pas la comparaison.

Le job lit deux valeurs du dépôt GitHub, jamais présentes dans le code : le
secret `CLOUDFLARE_API_TOKEN`, jeton d'API Cloudflare créé par le porteur avec
les permissions Workers Scripts (édition), D1 (édition) et Account Settings
(lecture), et la variable `CLOUDFLARE_ACCOUNT_ID`. Tant que la variable
`CLOUDFLARE_DEPLOY` n'est pas à `true`, le job est ignoré et la publication se
fait à la main.

### Publication manuelle de secours

Depuis un poste connecté par `wrangler login`, à la racine du dépôt :

```text
pnpm build
pnpm db:migrate:remote
pnpm deploy
pnpm push:deploy                                      # cloudflare/irrigation-push
pnpm --dir cloudflare/irrigation-weather-scheduler deploy
```

Wrangler 4.127 au minimum : les versions antérieures échouent sur les
déclencheurs SQL des migrations.

## 3. Cible

- Application : Worker `module-irrigation-otf`, adresse
  `https://module-irrigation-otf.lechampdelaurore.workers.dev`, décrit par
  `wrangler.jsonc` à la racine. Compte sur le plan Workers payant (D-017) ;
  `limits.cpu_ms` est fixé explicitement à 30 000 : un Worker déployé sous
  le plan gratuit gardait sa limite de 10 ms jusqu'au redéploiement.
- Base : D1 `module-irrigation-otf`, liaison `DB`, migrations suivies par
  Wrangler.
- Connexion : Cloudflare Access, équipe `damp-wind-3566`, application
  « Module irrigation » sur le Worker, session d'un mois, courriel du porteur
  autorisé par code à usage unique ; variables `ACCESS_TEAM_DOMAIN` et
  `ACCESS_AUD` dans `wrangler.jsonc`. Une application Access « Module
  irrigation - route interne » en Bypass sur `/api/internal` date de la
  phase 1 ; la route y reste protégée par son jeton applicatif.
- Liaisons de service entre Workers, obligatoires : un Worker ne peut pas
  joindre un autre Worker du même compte par son adresse publique
  `workers.dev`. L'application appelle le Worker Push par la liaison
  `IRRIGATION_PUSH` ; le planificateur météo appelle l'application par la
  liaison `IRRIGATION_SITE`. Les variables d'adresse (`IRRIGATION_PUSH_SERVICE_URL`,
  `IRRIGATION_SITE_URL`) servent à construire l'URL des requêtes.
- Secrets, saisis par `wrangler secret put` et jamais dans Git :
  - application : `OTF_API_TOKEN`, `VISUAL_CROSSING_API_KEY`,
    `WEATHER_SYNC_SERVICE_TOKEN`, `IRRIGATION_PUSH_SERVICE_TOKEN` ;
  - Worker Push : `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
    `IRRIGATION_PUSH_SERVICE_TOKEN` ;
  - planificateur météo : `WEATHER_SYNC_SERVICE_TOKEN`.

  Les jetons partagés et la paire VAPID ont été régénérés le 19 septembre
  2026 par un script qui les pose sur chaque Worker sans jamais les afficher ;
  la clé publique VAPID est la variable `IRRIGATION_PUSH_VAPID_PUBLIC_KEY` de
  `wrangler.jsonc`. Les clés de fournisseurs externes (OTF, Visual Crossing)
  sont saisies par le porteur seul.

## 4. Développement local

`pnpm db:migrate:local` puis `pnpm dev`, valeurs dans `.dev.vars`
d'après `.dev.vars.example`. Sans liaison de service locale, l'application
appelle le Worker Push par le réseau ordinaire à l'adresse configurée.

## 5. Ancien hébergement OpenAI Sites

Le site `https://<ancien-site>.chatgpt.site` n'est
plus utilisé depuis le 19 septembre 2026 : ses données ont été importées dans
la base D1 Cloudflare et toute saisie qui y serait faite serait perdue. Le code
propre à Sites (`@openai/sites-vite-plugin`, `.openai/hosting.json`,
fournisseur d'identité `sites`, route d'export) a été retiré du dépôt le
19 septembre 2026 (phase 4). Le porteur a supprimé le site Sites lui-même le
3 octobre 2026, après quatorze jours sans incident ; l'adresse répond 404.

## 6. Lire les journaux du Worker

Les journaux de durée du recalcul (`docs/planning-contract.md`, « Les durées
du recalcul », point ouvert 34) se lisent dans le tableau de bord Cloudflare,
par le porteur lui-même ou, sur son mot, par l'assistant dans le navigateur où
le porteur est connecté, sans jamais voir ni saisir d'identifiant (lecture du
9 octobre 2026 au soir). Les trois Workers ont l'observabilité activée
(`observability` dans chaque `wrangler.jsonc`, tout est conservé) ; Cloudflare
garde les journaux sept jours.

1. Ouvrir `https://dash.cloudflare.com` et se connecter.
2. Dans le menu de gauche, « Workers & Pages », puis, dans la vue d'ensemble,
   cliquer sur le Worker `module-irrigation-otf`.
3. Ouvrir l'onglet « Observability » (« Observabilité »), vue « Events ». La
   liste montre, du plus récent au plus ancien, une ligne par invocation —
   l'heure de sa fin, la méthode et l'adresse de la requête — et une ligne par
   message écrit par le Worker, sans adresse. Les événements arrivent avec
   quelques minutes de retard ; quand « Run Query » ne les montre pas encore,
   recharger la page.
4. Sur le site, faire le recalcul à chronométrer : « Calculer » dans le
   planning de la semaine, montre en main depuis le navigateur.
5. Revenir aux journaux et cliquer sur l'invocation `POST /irrigation` de
   l'heure du clic : son détail donne le statut, `$workers.wallTimeMs`, le
   temps total, et `$workers.cpuTimeMs`, le temps CPU ; « View invocation »
   montre tout ce qu'elle a écrit, deux lignes JSON :
   `planning_calculation_completed`, les phases du calcul, et
   `irrigation_page_loaded`, les phases du nouvel affichage ; `totalMs` est le
   total de chacune, en millisecondes, et `durationsMs` le détail par phase.
6. Comparer : la montre donne le temps vu du navigateur ; la somme des deux
   `totalMs` donne le temps serveur ; l'écart est le réseau et le rendu. La
   phase la plus longue nomme le coupable ; une phase qui varie d'une fois à
   l'autre pour le même plan désigne l'extérieur — lecture OTF, base D1,
   isolat froid. Le temps CPU de l'invocation donne le calcul pur, que
   l'horloge du Worker ne mesure pas : elle n'avance qu'aux entrées-sorties.
7. Pour filtrer, les champs des lignes JSON sont indexés : `event` égal à
   `planning_calculation_completed` montre tous les calculs des sept derniers
   jours, recalculs du matin compris (`trigger` à `daily`).
8. Copier les lignes dans le compte rendu de recette : elles ne contiennent ni
   identifiant de personne, ni jeton, ni cookie.

Les intitulés exacts du tableau de bord peuvent différer selon sa langue et sa
version ; le chemin est celui de la documentation Cloudflare, « Workers
Logs ».

## État de publication

Le registre d'état, `ETAT_DU_PROJET.md`, indique la dernière version publiée
connue et les écarts avec `main`. Le compte rendu de fin de tâche mentionne
toujours si une publication manuelle est nécessaire, par exemple tant que le
déploiement automatique n'est pas activé.
