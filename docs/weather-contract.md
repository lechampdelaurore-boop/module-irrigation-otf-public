# Contrat météo de la sous-tranche 2.8

## Fournisseur et abstraction

Le domaine dépend de l’interface `WeatherProvider`, jamais du JSON brut du
fournisseur. Depuis le 27 novembre 2026 (météo multi-modèles,
`docs/weather-models-contract.md`, D-339 et D-345 à D-347), la prévision d’une
ferme dépend de son réglage « Modèle de prévision » (« Réglages », carte
« Lieu de la météo ») :

- **« Automatique »**, le défaut, que gardent toutes les fermes qui ne
  choisissent rien : la lecture d’avant, inchangée. En production, l’offre
  gratuite Visual Crossing Timeline
  (`https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/...`),
  ses champs quotidiens gratuits groupés (pluie, températures, point de rosée,
  vent moyen et énergie solaire), avec le réglage serveur
  `VISUAL_CROSSING_API_KEY` ; sans cette clé, le pilote Open-Meteo de
  toujours (`api.open-meteo.com/v1/forecast`, sans paramètre `models`) ;
- **un modèle choisi** dans la liste tenue dans le code
  (`lib/domain/weather/forecast-models.ts` : Météo-France, DWD, centre
  européen, NOAA, « Automatique d’Open-Meteo »), lu chez Open-Meteo
  (`/v1/forecast`, `models=<choisi>,best_match`, une seule requête) : la
  pluie, les températures, l’énergie solaire et l’ET0 du modèle ; au-delà de
  sa portée, le jour entier vient de `best_match` et l’écran le dit. La
  `source` de chaque ligne de prévision et de l’archive dit le modèle qui
  l’a écrite.

L’adresse de base de l’API de prévision par modèle et la clé éventuelle du
palier payant sont des réglages serveur (`OPEN_METEO_API_BASE_URL`,
`OPEN_METEO_API_KEY`) ; sans eux, l’adresse gratuite
`https://api.open-meteo.com` est lue sans clé. La clé, si elle existe un
jour, est saisie par le porteur lui-même ; elle n’est jamais dans Git, ni
dans le navigateur, ni dans les journaux.

Le géocodage français et la réanalyse historique restent assurés par
Open-Meteo, quel que soit le réglage :

- géocodage : `https://geocoding-api.open-meteo.com/v1/search` ;
- réanalyse historique : `https://archive-api.open-meteo.com/v1/archive`.

**Essai B, 27 novembre 2026 vers 23 h 55 (heure de Paris).** Le premier
enregistrement d’un modèle en production (Météo-France, sur la ferme du
porteur, avec son accord, puis retour à « Automatique ») a réussi :
l’endpoint Forecast d’Open-Meteo répond au Worker déployé. La phrase
d’avant, qui disait qu’il refusait les requêtes de l’infrastructure partagée
du site, est donc retirée : la panne du 14 au 19 novembre 2026 venait du
`fetch` appelé comme méthode (D-164), pas d’un refus d’Open-Meteo.

Les appels partent exclusivement du serveur, utilisent HTTPS, sont limités par
un délai d’attente et n’exposent aucune clé dans le navigateur. Pluie et ET0
sont demandées ensemble avec `include=days`, dans une seule requête par
service et par période.

## Sens des valeurs

- `precip` de la période prévisionnelle est enregistré comme **pluie prévue** ;
- `precipitation_sum` de l’API Historical Weather est enregistré comme
  **réanalyse**, donc comme estimation du passé et non comme observation d’une
  station située sur la ferme ;
- l’ET0 prévisionnelle est calculée côté serveur selon FAO-56 Penman–Monteith à
  partir des champs gratuits Visual Crossing (`temp`, `tempmin`, `tempmax`,
  `dew`, `windspeedmean`, `solarenergy`) et de l’altitude renvoyée ;
- depuis la 5 bis (31 octobre 2026, migration 0022), les températures
  minimale et maximale prévues (`tempmin`, `tempmax`) sont aussi conservées,
  pour les alertes météo (`docs/weather-alerts-contract.md`) ; absentes, elles
  restent nulles et n’effacent pas une valeur déjà connue ;
- `et0_fao_evapotranspiration` d’Open-Meteo est l’ET0 de la réanalyse. Les deux
  valeurs sont exprimées en mm. La provenance
  `forecast` ou `reanalysis` est conservée ;
- une mesure de pluviomètre saisie par l’utilisateur est
  `manual_precipitation`, reste distincte et prend la priorité d’affichage sans
  supprimer les autres sources.

La pluie mesurée concerne la ferme et reste lisible après un changement de
commune de prévision. Les dates futures et les dates civiles impossibles sont
refusées pour une mesure réelle. Les réanalyses arrivent avec environ cinq jours
de retard ; une journée non disponible reste explicitement manquante.

Une valeur absente reste `NULL`. Elle ne devient jamais zéro. Les prévisions et
réanalyses sont stockées séparément avec la date de récupération, la source et
la clé de localisation. La dernière lecture valide reste disponible en cas de
panne.

## Cache et localisation

La commune du siège issue de `GET /me` est le choix par défaut. Sa clé normalisée
inclut le nom et le code postal. Le résultat de géocodage (nom affichable,
latitude, longitude et fuseau) est mis en cache par workspace et par clé. Une
commune personnalisée est une préférence du module ; l’action de retour au
siège supprime cette préférence sans modifier OTF.
Le géocodeur reçoit le nom seul puis filtre les codes postaux retournés, afin
de distinguer les communes homonymes.

Une tâche Cloudflare planifiée s’exécute chaque jour à 06 h 15, heure de Paris,
indépendamment de l’ouverture du site et de toute session utilisateur. Elle
récupère les prévisions de J0 à J+14 et tente à nouveau les réanalyses sur une
fenêtre glissante de J-10 à J-5. Une journée encore indisponible reste `NULL` et
sera retentée lors des passages suivants. Les données de la semaine courante
peuvent aussi être rafraîchies au plus toutes les trois heures lors d’une
consultation, ou à la demande. Elles sont signalées anciennes après six heures. Une
semaine historique n’est récupérée que si son cache est vide ou si
l’utilisateur force l’actualisation.
Une erreur impose cinq minutes avant une nouvelle tentative automatique. Les
modifications d’objectif, de pluie manuelle et de limite ne lancent pas d’appel
météo. Une réponse partielle conserve les champs déjà connus de la même source ;
une lecture d’une autre source (un modèle de prévision choisi, ou le retour à
« Automatique », `docs/weather-models-contract.md`) remplace le jour entier,
jamais un mélange de deux sources dans un jour (D-346, F1016). Si un des deux
services (prévision/réanalyse) échoue, l’autre peut tout de même être enregistré.
La date affichée correspond à la plus ancienne lecture fournisseur encore
utilisée dans la semaine, pas à une consultation d’une autre semaine. Sont
encore utilisées les réanalyses, quelle que soit leur date, et les prévisions
des jours à venir, aujourd’hui compris. La prévision d’un jour déjà passé reste
stockée et sert encore à l’ET0 informative, mais aucune actualisation ne la
renouvellerait : son âge n’entre ni dans cette date ni dans la mention
« données anciennes ». Constat de la recette 3.4 du 20 septembre 2026 : le
code comptait ces prévisions figées et annonçait des données anciennes le
matin même d’une synchronisation réussie.

Le planificateur Cloudflare appelle une route interne authentifiée du site. Il
ne possède aucun accès direct à la base et ne reçoit ni session utilisateur ni
clé fournisseur. Le service partagé avec le bouton manuel sélectionne tous les
workspaces dont la localisation a déjà été résolue, regroupe ceux qui utilisent
les mêmes coordonnées et ne fait qu’une lecture externe par lieu et par modèle
de prévision (depuis le 26 novembre 2026, D-346) : une pour les fermes en
« Automatique », une par modèle choisi à ce lieu, la réanalyse une fois par
lieu ; chaque ferme écrit ensuite ses propres lignes. Le cache
métier est durable dans D1. Un verrou global D1 empêche deux tâches planifiées
de s’exécuter en parallèle ; un verrou par workspace espace d’au moins 30 secondes deux opérations météo
pour une même exploitation, y compris lorsqu’elles atteignent deux instances du
site. Les requêtes identiques simultanées dans une même instance sont aussi
dédupliquées. Le bouton est désactivé pendant l’appel et le même délai est rendu
visible dans l’interface.

Les sous-requêtes réussies utilisent en plus le cache de bord Cloudflare : 30
jours pour le géocodage Open-Meteo, 30 minutes pour les prévisions (Visual
Crossing, ou Open-Meteo pour un modèle choisi, dont l’adresse contient le
modèle : deux modèles n’ont jamais la même entrée) et 7 jours pour la
réanalyse. La lecture qui vérifie un modèle à son enregistrement contourne
ce cache. Les réponses d’erreur ne sont jamais mises en cache. Les erreurs
réseau, `5xx` et `429` peuvent être retentées au maximum trois fois avec une
attente exponentielle bornée à deux secondes. L’en-tête `Retry-After`, lorsqu’il
existe, est ensuite mémorisé et bloque toute nouvelle tentative jusqu’à
l’échéance ; sans en-tête, une minute de repli est appliquée. La dernière valeur
valide en D1 reste affichée.

Nombre maximal d’appels externes avec une commune déjà géocodée (décompte
réécrit à la mise en ligne de la météo multi-modèles, le 27 novembre 2026 ;
une lecture d’un modèle choisi coûte environ 1,07 appel au compteur
d’Open-Meteo, essai A du 26 novembre 2026, contre une limite gratuite de
600 par minute, 5 000 par heure et 10 000 par jour) :

- passage planifié quotidien : **1** Forecast par lieu distinct et par
  modèle de prévision choisi à ce lieu (« Automatique » compte pour un), et
  **1** Historical par lieu distinct, quel que soit le nombre de workspaces
  partageant ce lieu, hors tentatives bornées après erreur temporaire ;
- relecture de la journée (depuis le 24 novembre 2026, C1, D-303) : **1**
  Forecast de 7 jours par lieu distinct et par modèle à 9 h 30, 12 h 30,
  15 h 30, 18 h 30 et 21 h 30, seulement pour les fermes qui ont une alerte
  active ; aucune réanalyse (`docs/weather-scheduler-contract.md`) ;
- chargement de la semaine courante avec cache frais : **0** ;
- chargement avec cache météo absent ou périmé : **1** appel Forecast ;
- recherche explicite d’une commune : **1** appel Geocoding ;
- clic sur « Actualiser la météo » : **1** appel Forecast pour la semaine
  courante ;
- enregistrement d’un modèle de prévision : **1** appel Forecast chez
  Open-Meteo, la lecture qui le vérifie (`docs/weather-models-contract.md`,
  règle 8) ; **0** pour le modèle déjà enregistré ; le retour à
  « Automatique » relit ses prévisions à venir : **1** appel Forecast ;
- enregistrement d’un objectif, d’une pluie manuelle ou d’une limite : **0**.

Pour une ancienne semaine qui recouvre à la fois une période réanalysable et une
période encore couverte par Forecast, une opération logique peut nécessiter un
appel à chacun des deux services. Aucun appel n’est lancé en boucle ou à la suite
d’un nouvel affichage causé par une action sans rapport avec la météo.

Les journaux serveur exposent uniquement le service logique, le statut, la date,
`Retry-After` et une raison fournisseur bornée. Un appel qui échoue sans réponse
ajoute la nature de l'échec (réseau ou délai dépassé), le temps écoulé, le nom
et le message de l'erreur et de sa cause, bornés, toute adresse retirée (D-164).
Ils ne consignent ni coordonnées, ni URL complète, ni secret.

Les adaptateurs météo lisent le `fetch` global au moment de chaque appel et
appellent un `fetch` injecté seul, jamais comme leur propre méthode : le
`fetch` natif d'un Worker refuse d'être appelé ainsi, ce qui faisait échouer
aussitôt la réanalyse d'Open-Meteo depuis le 14 novembre 2026 (D-164). Un délai
dépassé se reconnaît au signal d'abandon de l'appel, quel que soit le type de
l'erreur levée.

La date de la dernière mise à jour automatique réussie s'affiche en vert tant
qu'elle a moins de 36 heures (la tâche passe chaque jour à 6 h 15). Au-delà, ou
quand des tentatives n'ont jamais réussi, l'écran dit « Mise à jour automatique
de la météo en retard », la date de la dernière réussite et la dernière erreur
enregistrée, sur le fond des avertissements ; les valeurs déjà enregistrées
restent affichées (D-165). Constat du 19 novembre 2026 : la date du 13 novembre
restait affichée en vert, sans alerte, six jours après la dernière réussite.

La mesure manuelle, y compris la valeur explicite `0`, reste dans la ligne
`manual_precipitation`. La tâche automatique n’écrit que `forecast` et
`reanalysis` ; elle ne peut donc ni remplacer ni effacer une mesure utilisateur.

## Archive des prévisions

Depuis le 22 novembre 2026 (D-297, `docs/forecast-archive-contract.md`,
migration 0046), la première lecture réussie des prévisions d'un jour civil
de Paris est aussi recopiée, pour J+1 à J+7, dans une archive par
exploitation qui ne s'écrase jamais (`irrigation_weather_forecast_archive`) :
la prévision faite la veille pour aujourd'hui reste lisible quand la table
des prévisions l'a remplacée. Aucun appel externe de plus : les nombres
d'appels ci-dessus ne changent pas. L'archive est gardée 24 mois, n'a aucun
écran et n'entre dans aucun calcul ; un échec de son écriture ne fait jamais
échouer la lecture météo.

## Licence et déploiement

Visual Crossing est crédité dans l’interface. Son offre gratuite fournit 1 000
enregistrements par jour et convient au prototype privé actuel avec le cache
durable et les lectures quotidiennes groupées. La consommation devra être
réévaluée avant l’ouverture à de nombreuses exploitations. Sa clé est un
secret serveur : elle ne figure ni dans Git, ni dans le navigateur, ni dans
les journaux.

Open-Meteo est crédité (CC BY 4.0) partout où ses données s’affichent ; pour
un modèle choisi, le crédit nomme aussi le fournisseur du modèle
(« Prévisions : Météo-France, par Open-Meteo »). Aucune donnée de
démonstration n’est créditée à un fournisseur réel. L’offre gratuite
d’Open-Meteo est « non commerciale » : **décision du porteur du
26 novembre 2026 à 12 h 47** (`docs/weather-models-contract.md`, § 10),
tout reste gratuit pendant le pilote ; une licence payante est probable
ensuite, financée par la société qui gère Ouvre ta ferme, et elle ne
demandera que les deux réglages serveur ci-dessus, sans changer une règle.
Tant que l’offre gratuite est utilisée, Open-Meteo ne garantit pas sa
disponibilité : l’enregistrement vérifié d’un modèle et le retour à
« Automatique » protègent les fermes.

Documentation officielle :

- [Visual Crossing Timeline Weather API](https://www.visualcrossing.com/resources/documentation/weather-api/timeline-weather-api/)
- [Éléments agricoles et ET0](https://www.visualcrossing.com/resources/documentation/weather-api/agriculture-elements-in-the-timeline-weather-api/)
- [Méthode FAO-56](https://www.fao.org/fileadmin/user_upload/faowater/docs/ReferenceManualV32.pdf)
- [Offre gratuite Visual Crossing](https://www.visualcrossing.com/resources/documentation/visual-crossing-weather-free-plan-free-weather-data-for-analysts-and-api-developers/)
- [Geocoding API Open-Meteo](https://open-meteo.com/en/docs/geocoding-api)
- [Forecast API Open-Meteo](https://open-meteo.com/en/docs)
- [Conditions et licence Open-Meteo](https://open-meteo.com/en/terms)
