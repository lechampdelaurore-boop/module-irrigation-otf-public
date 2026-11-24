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

## Le rappel du soir (depuis l’amélioration n° 2)

Un troisième déclencheur, `5 * * * *`, appelle chaque heure à la minute 5
`POST /api/internal/evening-reminder`, par la même liaison de service et
avec le même secret partagé (docs/ameliorations-6-2-3-7-contract.md,
section 4.3, F705 ; D-284, F714). Chaque ferme règle son heure, de 17 h à
22 h au quart d’heure : le Worker ne trie rien, le site envoie les rappels
dus. Avant 17 h, heure de Paris, la route ne lit rien. Le passage est une
tâche du registre (`task:evening-reminder`, orange à 3 heures, rouge à 6).

- Le planificateur lui laisse 30 secondes ; ses lignes de journal portent le
  préfixe `evening_reminder_scheduler`.
- La route répond 200 dès que le passage a tourné, même manqué, comme la
  veille ; un rappel n’est jamais envoyé deux fois le même jour (la prise du
  jour en base).
- L’endpoint manuel `POST /run-evening`, protégé par le même secret, relance
  le passage pour la recette et le diagnostic.

## La relecture de la journée (depuis le 24 novembre 2026, C1, D-303)

Constat du 24 novembre 2026 : une alerte de gel n'est arrivée sur le
téléphone du porteur qu'à la réouverture du module. Les alertes météo et de
gel ne s'évaluaient qu'à la lecture de 06 h 15 et à l'ouverture du module
(lecture de plus de 3 heures) : un gel apparu dans les prévisions après
06 h 15 n'alertait que si quelqu'un ouvrait le module, derrière Cloudflare
Access.

Un quatrième déclencheur, `30 7,8,10,11,13,14,16,17,19,20 * * *`, appelle
`POST /api/internal/weather-intraday` à **9 h 30, 12 h 30, 15 h 30, 18 h 30 et
21 h 30, heure de Paris**, par la même liaison de service et avec le même
secret partagé : aucun secret nouveau. Les dix créneaux UTC couvrent l'hiver
et l'été ; le Worker n'exécute que celui qui tombe à la bonne heure de Paris.

- **Qui est relu.** Seules les fermes qui lisent la météo (comme le matin) et
  ont au moins une alerte qui lit les prévisions : un critère d'alerte météo
  actif avec la case « Alertes météo », ou le gel ou les aspersions actifs
  avec la case « Alertes cultures » (les aspersions demandent aussi le
  Planning). Une ferme sans alerte active n'appelle pas le fournisseur. La
  règle vit dans `lib/domain/weather/intraday-alerts.ts`.
- **Ce qui est lu.** Les prévisions seules, d'aujourd'hui à J+6 (7 jours : le
  plus long horizon d'une alerte météo comme du gel), un appel par lieu
  partagé, comme le matin ; jamais la réanalyse, qui reste au matin. Rien
  n'est archivé : l'archive des prévisions garde la première lecture du jour
  (D-297).
- **Ce qui suit.** Après chaque écriture, les alertes météo puis par culture
  (gel, aspersions) s'évaluent exactement comme après la lecture du matin ;
  la règle de répétition de chacune (critère ou culture, version, jour visé)
  empêche tout second envoi d'une même alerte. Le séchage ne lit pas les
  prévisions : il reste au matin.
- **Ce qui est noté.** La dernière lecture de la ferme (celle qui évite une
  relecture à l'ouverture du module) et, en cas de refus du fournisseur,
  l'attente qu'il demande, partagée avec le bouton « Actualiser la météo ».
  L'état de la mise à jour automatique du matin, qui lit aussi la réanalyse
  (D-165), n'est pas touché. Un verrou D1 propre (`intraday-weather-sync`)
  rend la relecture idempotente sans gêner le matin.
- **Coût** (chiffré le 24 novembre 2026) : 5 lectures de prévisions de plus
  par jour et par lieu relu. Visual Crossing compte une lecture de prévisions
  pour un enregistrement, quel que soit le nombre de jours : 5 sur les 1 000
  enregistrements gratuits par jour. Sans clé Visual Crossing, Open-Meteo :
  5 appels sur les 10 000 gratuits par jour. Aucun service payant nouveau.
- **Surveillance.** Le passage est une tâche du registre
  (`task:weather-intraday`) : réussi quand chaque lieu relu a reçu ses
  prévisions, ou qu'aucune ferme n'avait d'alerte active ; orange à 16 heures
  (deux passages de suite manqués, la nuit en dure douze), rouge à 27 heures
  (une journée entière manquée), ou à trois échecs de suite.
- Le planificateur lui laisse 60 secondes ; ses lignes de journal portent le
  préfixe `weather_intraday_scheduler`. La route répond 200 dès que le
  passage a tourné, même manqué, comme la veille et le rappel du soir.
- L'endpoint manuel `POST /run-intraday`, protégé par le même secret, relance
  le passage pour la recette et le diagnostic.
