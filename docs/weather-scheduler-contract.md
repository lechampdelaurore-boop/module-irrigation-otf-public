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
- la route `/api/internal/*` du site est exclue de Cloudflare Access par une
  règle de contournement ; aucun jeton d’hébergement n’est nécessaire, seul le
  secret partagé ci-dessus protège la route ;
- aucun de ces secrets n’est présent dans Git, une URL ou les journaux ;
- l’endpoint manuel du Worker est un `POST /run` protégé par le même secret et
  sert uniquement à la recette et au diagnostic ;
- les autres routes du Worker répondent `404`.

## Tolérance aux pannes

Le Worker et le moteur métier appliquent des tentatives bornées aux erreurs
temporaires (`429`, `5xx`, réseau et délai dépassé). Les refus permanents ne sont
pas retentés. Un verrou D1 de dix minutes rend l’opération idempotente en cas de
double déclenchement. Chaque workspace conserve sa dernière tentative, sa
dernière réussite et sa dernière erreur automatique.

La synchronisation écrit uniquement les provenances `forecast` et
`reanalysis`. Une pluie manuelle, y compris `0 mm`, ne peut pas être écrasée.
