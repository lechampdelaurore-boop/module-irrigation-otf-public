# Contrat du planificateur météo

## Responsabilités

Le Worker `irrigation-otf-weather-scheduler` déclenche une synchronisation à
06 h 15 dans le fuseau `Europe/Paris`, y compris lors des changements d’heure.
Cloudflare Cron étant exprimé en UTC, deux créneaux (`04:15` et `05:15` UTC)
sont enregistrés ; le Worker n’exécute que celui correspondant réellement à
06 h 15 à Paris.

Le Worker ne connaît ni les utilisateurs, ni les workspaces, ni la clé météo,
ni la base D1. Il appelle uniquement `POST /api/internal/weather-sync`, par la
liaison de service Cloudflare `IRRIGATION_SITE` vers le Worker du site : un
Worker ne peut pas joindre un autre Worker du même compte par son adresse
publique `workers.dev`, l’appel reste donc interne au compte. Le site
authentifie cet appel avec un secret partagé et utilise ensuite le même moteur
de synchronisation que le bouton manuel.

## Sécurité

- la route interne refuse tout appel sans `WEATHER_SYNC_SERVICE_TOKEN` valide ;
- la route `/api/internal/*` du site est derrière Cloudflare Access comme le
  reste du site depuis le 13 novembre 2026 (D-100) : la liaison de service ne
  traverse pas Access, aucun jeton d’hébergement n’est nécessaire, et le secret
  partagé ci-dessus protège la route ; la règle de contournement qui l’en
  excluait depuis la phase 1 est retirée ;
- aucun de ces secrets n’est présent dans Git, une URL ou les journaux ;
- l’endpoint manuel du Worker est un `POST /run` protégé par le même secret et
  sert uniquement à la recette et au diagnostic ;
- les autres routes du Worker répondent `404`.

## Tolérance aux pannes

Le Worker et le moteur métier appliquent des tentatives bornées aux erreurs
temporaires (`429`, `5xx`, réseau). Les refus permanents ne sont
pas retentés. Le planificateur laisse 90 secondes à la route du site, qui
enchaîne la météo et les calculs du matin ; un délai dépassé n'est **jamais**
retenté par le planificateur : la route a reçu la demande et travaille encore,
la relancer refaisait toute la synchronisation une seconde fois (constat du
19 novembre 2026, D-166). Le délai dépassé d'un appel au fournisseur météo,
lui, reste retenté par le moteur, dans la limite de trois tentatives. Un verrou D1 de dix minutes rend l’opération idempotente en cas de
double déclenchement. Chaque workspace conserve sa dernière tentative, sa
dernière réussite et sa dernière erreur automatique.

La synchronisation écrit uniquement les provenances `forecast` et
`reanalysis`. Une pluie manuelle, y compris `0 mm`, ne peut pas être écrasée.

## La veille de l’exploitant (depuis la 4.5, PR 2)

Le même Worker porte un second déclencheur, distinct de celui qu’elle
surveille (docs/tranche-4-contract.md, F566, R5) : la veille de 09 h 00 à
Paris, inscrite sur les deux créneaux `07:00` et `08:00` UTC
(`0 7,8 * * *`) ; le Worker n’exécute que celui qui tombe à 9 h à Paris,
comme pour la météo. Il appelle `POST /api/internal/operator-watch`, par la
même liaison de service et avec le même secret partagé : aucun secret
nouveau. La route lit le registre des tâches, envoie la notification due à
l’exploitant et enregistre l’exécution de la veille comme celle de toute
tâche du registre (`task:operator-watch`).

- Le planificateur lui laisse 30 secondes ; ses lignes de journal portent le
  préfixe `operator_watch_scheduler` (`_completed`, `_retry_scheduled`,
  `_timeout_not_retried`, `_network_retry`, `_failed`), celles de la météo
  gardent le leur (`weather_scheduler`).
- La route répond 200 dès que la veille a tourné, même manquée : une réponse
  5xx ferait relancer la veille trois fois, et trois échecs du même matin
  compteraient pour trois matins (R2). Seule une panne du site la fait
  relancer, et la notification du jour n’est jamais envoyée deux fois.
- L’endpoint manuel `POST /run-watch`, protégé par le même secret, relance
  la veille pour la recette et le diagnostic.
