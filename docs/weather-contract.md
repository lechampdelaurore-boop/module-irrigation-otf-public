# Contrat météo de la sous-tranche 2.8

## Fournisseur et abstraction

Le domaine dépend de l’interface `WeatherProvider`, jamais du JSON brut du
fournisseur. En production, le pilote de prévision utilise l’offre gratuite
Visual Crossing Timeline :

- prévisions :
  `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/...` ;
- champs quotidiens gratuits groupés : pluie, températures, point de rosée,
  vent moyen et énergie solaire ;
- configuration serveur obligatoire : `VISUAL_CROSSING_API_KEY`.

Le géocodage français et la réanalyse historique restent assurés par Open-Meteo :

- géocodage : `https://geocoding-api.open-meteo.com/v1/search` ;
- réanalyse historique : `https://archive-api.open-meteo.com/v1/archive`.

En l’absence de la clé Visual Crossing, l’ancien pilote Open-Meteo reste un
repli de transition. Il ne constitue pas la configuration de production visée,
car son endpoint Forecast refuse actuellement les requêtes provenant de
l’infrastructure partagée du site.

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
météo. Une réponse partielle conserve les champs déjà connus ; si un des deux
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
les mêmes coordonnées et ne fait qu’une lecture externe par lieu. Le cache
métier est durable dans D1. Un verrou global D1 empêche deux tâches planifiées
de s’exécuter en parallèle ; un verrou par workspace espace d’au moins 30 secondes deux opérations météo
pour une même exploitation, y compris lorsqu’elles atteignent deux instances du
site. Les requêtes identiques simultanées dans une même instance sont aussi
dédupliquées. Le bouton est désactivé pendant l’appel et le même délai est rendu
visible dans l’interface.

Les sous-requêtes réussies utilisent en plus le cache de bord Cloudflare : 30
jours pour le géocodage Open-Meteo, 30 minutes pour les prévisions Visual Crossing et 7 jours pour la
réanalyse. Les réponses d’erreur ne sont jamais mises en cache. Les erreurs
réseau, `5xx` et `429` peuvent être retentées au maximum trois fois avec une
attente exponentielle bornée à deux secondes. L’en-tête `Retry-After`, lorsqu’il
existe, est ensuite mémorisé et bloque toute nouvelle tentative jusqu’à
l’échéance ; sans en-tête, une minute de repli est appliquée. La dernière valeur
valide en D1 reste affichée.

Nombre maximal d’appels externes avec une commune déjà géocodée :

- passage planifié quotidien : **1** Forecast et **1** Historical par lieu
  distinct, quel que soit le nombre de workspaces partageant ce lieu, hors
  tentatives bornées après erreur temporaire ;
- chargement de la semaine courante avec cache frais : **0** ;
- chargement avec cache météo absent ou périmé : **1** appel Forecast ;
- recherche explicite d’une commune : **1** appel Geocoding ;
- clic sur « Actualiser la météo » : **1** appel Forecast pour la semaine
  courante ;
- enregistrement d’un objectif, d’une pluie manuelle ou d’une limite : **0**.

Pour une ancienne semaine qui recouvre à la fois une période réanalysable et une
période encore couverte par Forecast, une opération logique peut nécessiter un
appel à chacun des deux services. Aucun appel n’est lancé en boucle ou à la suite
d’un nouvel affichage causé par une action sans rapport avec la météo.

Les journaux serveur exposent uniquement le service logique, le statut, la date,
`Retry-After` et une raison fournisseur bornée. Ils ne consignent ni coordonnées,
ni URL complète, ni secret.

La mesure manuelle, y compris la valeur explicite `0`, reste dans la ligne
`manual_precipitation`. La tâche automatique n’écrit que `forecast` et
`reanalysis` ; elle ne peut donc ni remplacer ni effacer une mesure utilisateur.

## Licence et déploiement

Visual Crossing est crédité dans l’interface. Son offre gratuite fournit 1 000
enregistrements par jour et convient au prototype privé actuel avec le cache
durable et les lectures quotidiennes groupées. La consommation devra être
réévaluée avant l’ouverture à de nombreuses exploitations. La clé est un secret
serveur : elle ne figure ni dans Git, ni dans le navigateur, ni dans les journaux.

Documentation officielle :

- [Visual Crossing Timeline Weather API](https://www.visualcrossing.com/resources/documentation/weather-api/timeline-weather-api/)
- [Éléments agricoles et ET0](https://www.visualcrossing.com/resources/documentation/weather-api/agriculture-elements-in-the-timeline-weather-api/)
- [Méthode FAO-56](https://www.fao.org/fileadmin/user_upload/faowater/docs/ReferenceManualV32.pdf)
- [Offre gratuite Visual Crossing](https://www.visualcrossing.com/resources/documentation/visual-crossing-weather-free-plan-free-weather-data-for-analysts-and-api-developers/)
- [Geocoding API Open-Meteo](https://open-meteo.com/en/docs/geocoding-api)
