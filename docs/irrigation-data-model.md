# Modèle de données du domaine irrigation

## Propriété et isolation

Ouvre ta ferme reste la source de référence des exploitations, parcelles,
jardins, abris et planches. Le module ne recopie ni leurs noms, ni leurs
dimensions dans ses données métier. Il conserve uniquement leurs identifiants
OTF dans les groupes, placements et historiques d'irrigation.

Chaque donnée métier appartient à un `irrigation_workspace`, isolé par
l'identifiant stable de l'utilisateur authentifié. Le champ `otf_farm_id` reste
facultatif jusqu'à ce que le contrat de lecture OTF fournisse un identifiant
d'exploitation stable. Il ne doit jamais être accepté directement depuis une
valeur libre du navigateur.

## Inventaire et réglages

Chaque ligne de `irrigation_equipment` représente un matériel physique unique.
Un matériel est de type `sprinkler` (aspersion) ou `drip` (goutte-à-goutte), et
il est fixe ou mobile. Un matériel déjà utilisé est archivé au lieu d'être
supprimé.

Les positions 1 à 10 de `irrigation_equipment_settings` limitent naturellement
chaque matériel à dix réglages :

- l'aspersion stocke des points `distance_meters → rate_mm_per_hour` séparés à
  gauche et à droite ;
- le goutte-à-goutte stocke une valeur uniforme en mm/h ;
- aucune caractéristique libre supplémentaire n'est conservée.

## Groupes et placements

Les groupes de jardins sont propres à une saison. Le lien
`copied_from_group_id` permet de mémoriser la reprise de la saison précédente.
Leurs membres référencent les jardins OTF, leur ordre, le sens des planches et
la distance en mètres qui les sépare du jardin précédent.

Un matériel ne possède qu'un placement courant par saison. L'ancrage est soit
le centre d'une planche, soit l'espace entre deux planches. Pour le
goutte-à-goutte, les planches sélectionnées sont conservées individuellement et
ne sont pas obligatoirement consécutives.

La sous-tranche 2.11 (`docs/equipment-placement-periods-contract.md`, D-043)
date cette position. Depuis la migration `0018` (27 octobre 2026), le
placement courant est la pose courante : `placed_at`, nulle pour une position
antérieure, date inconnue, et `removed_at`, nulle tant que le matériel est
posé, renseignée quand il est stocké. Chaque pose qui se ferme, par un
retrait ou un déplacement, est copiée dans
`irrigation_equipment_placement_history`, en ajout seul : matériel, saison,
dates, et en JSON l'ancrage, les planches, le réglage et son nom. Seul le
matériel posé est servi aux besoins, à la faisabilité, au planning et à la
saisie d'une irrigation.

## Planning hebdomadaire (3.5)

Depuis la migration `0017` (29 septembre 2026), le planning a son registre,
distinct de l'historique réel (`docs/planning-contract.md`) :
`irrigation_planning_settings` porte les réglages R2 à R13 en JSON — R1,
retiré le 5 octobre 2026 (D-029), n'y est plus lu s'il s'y trouve encore —,
une ligne par exploitation, et `irrigation_planning_settings_log` chaque
enregistrement ;
`irrigation_plan_calculations` garde un calcul par exécution du moteur —
saison, semaine, déclencheur (manuel, quotidien, sur événement), horizon,
réglages et résumé en JSON — ; `irrigation_plan_proposals` garde chaque
créneau proposé avec son statut (`proposed`, `validated`, `refused`,
`replaced`, `expired`), ses quantités, sa pompe et son origine, et en JSON
ses applications par planche et sa justification. Une proposition validée
pointe l'irrigation planifiée qu'elle est devenue. Aucune valeur dérivée
n'est réécrite : un nouveau calcul remplace les propositions non décidées et
en écrit de nouvelles.

Depuis la migration `0030` (8 novembre 2026, 3.8 ter,
`docs/protected-slots-contract.md`), les créneaux protégés nommés ont leur
table, `irrigation_protected_slots` : une ligne par créneau et par
exploitation, sans saison, avec le nom, sept indicateurs de jour (`monday` à
`sunday`, 0 ou 1, un au moins), le début et la fin en minutes depuis minuit
(une fin avant le début passe minuit) et l'état `active` ou `deleted`, la
suppression étant logique. Des contraintes `CHECK` refusent un nom vide ou de
plus de 80 caractères, aucun jour, une heure hors de la journée et un début
égal à la fin. `irrigation_protected_slots_log` garde chaque version entière,
avec le geste (`created`, `updated`, `deleted`), son auteur et sa date. Aucune
ligne n'est écrite par défaut.

## Planification et historique

Depuis l'étape 5.0 (29 septembre 2026, migration `0016`), une application
d'irrigation (`irrigation_bed_applications`) porte deux surfaces, jamais
confondues (`docs/wetted-surface-contract.md`) : `bed_area_square_meters`, la
surface de la planche, qui pondère les millimètres ; et
`wetted_area_square_meters`, la surface mouillée par le matériel de cette
irrigation — la planche seule en goutte-à-goutte, la planche et son
passe-pied en aspersion —, qui convertit les millimètres en volume et en
débit. Elle est `NULL` quand le passe-pied n'était pas connu à
l'enregistrement, et le volume est alors inconnu, jamais zéro. Les lignes
antérieures à la migration ont reçu leur surface de planche (D-023).

Une irrigation peut regrouper plusieurs matériels. Chaque utilisation possède
ses propres horaires prévus et réels, sa durée et son état. Les chevauchements
d'horaires d'un même matériel restent possibles en base : l'interface devra les
signaler par un avertissement sans bloquer l'utilisateur.

Au moment d'enregistrer ou de planifier une irrigation, les informations du
matériel, du réglage et du placement sont figées en JSON. Les apports par
planche figent également les références OTF, le débit, la surface et les mm
prévus ou réellement apportés. Une modification ultérieure du matériel ou de
la structure OTF ne réécrit donc jamais l'historique.

Les irrigations terminées ou annulées sont immuables. Une irrigation
partiellement réalisée conserve sa partie restante comme planifiée ; son
annulation éventuelle est enregistrée séparément afin de préserver la quantité
réellement apportée.

`irrigation_event_log` constitue le journal append-only des changements
importants et conserve l'identifiant de l'utilisateur à l'origine de l'action.

## Objectifs, météo et limite journalière (2.8)

Les objectifs hydriques sont des valeurs directes en `mm/semaine`, propres à
une semaine civile du lundi au dimanche et à une saison. Ils peuvent viser la
ferme, une parcelle, un jardin/abri ou une planche. Ces périmètres sont
indépendants et non cumulatifs. Les révisions sont append-only : modifier un
objectif ou utiliser « Tout vider » n’efface jamais l’historique. Si une
nouvelle semaine ne possède encore aucune révision, ses objectifs sont repris
de la dernière semaine configurée ; une semaine explicitement vidée ne les
recrée pas.

La météo utilise une préférence de localisation (`otf` ou `custom`) et un cache
de géocodage. Le mode OTF ne recopie pas l’adresse administrative : la clé est
recalculée à partir de l’instantané OTF courant. Les valeurs quotidiennes
séparent strictement :

- `forecast` : précipitations et ET0 prévues ;
- `reanalysis` : estimation météorologique du passé, jamais présentée comme
  une mesure de station ;
- `manual_precipitation` : pluie mesurée par l’utilisateur, prioritaire pour
  la date et jamais écrasée par une actualisation automatique.

Les dernières données valides restent lisibles en cas d’échec du fournisseur.
Le fournisseur est isolé derrière `WeatherProvider` afin de pouvoir remplacer
un service sans modifier le domaine ni l’interface. La configuration gratuite
actuelle utilise Visual Crossing pour les prévisions et Open-Meteo pour le
géocodage français et la réanalyse historique.
La préférence mémorise aussi `refresh_not_before_at` lorsqu’un fournisseur
renvoie une limite temporaire. Avec `last_refresh_attempt_at`, ce champ sert de
verrou partagé et empêche les doubles clics ou consultations concurrentes de
multiplier les appels externes.
Elle conserve séparément la dernière tentative, la dernière réussite et la
dernière erreur de la synchronisation automatique. La table
`irrigation_background_jobs` porte le verrou global et l’état de la tâche
quotidienne. Le planificateur ne modifie jamais `manual_precipitation` et
déduplique les workspaces partageant les mêmes coordonnées avant les appels aux
fournisseurs.

La limite journalière est également versionnée. Une révision indique si elle
est active, son maximum en m³/jour, sa période d’application et une note
facultative. Le volume repose sur l’identité `1 mm × 1 m² = 1 litre`. Une
irrigation traversant minuit est répartie au prorata du temps entre les jours
locaux de la ferme. Les nouvelles irrigations planifiées ou démarrées sont
bloquées en cas de dépassement ; une irrigation historique déjà réalisée est
toujours enregistrable et son dépassement est signalé, afin de ne jamais
falsifier la réalité. La modification d’une irrigation planifiée et non
démarrée est jugée comme une création, son propre volume planifié retiré du
déjà engagé de ses jours : seul le volume modifié est comparé à la limite,
jamais l’ancien en plus du nouveau (point ouvert 13, corrigé le 9 octobre
2026).

La restriction et son budget s’appliquent à toute l’exploitation, toutes saisons
confondues, selon la date civile Europe/Paris. Le champ `season` d’une révision
conserve le contexte de saisie, sans permettre de contourner la restriction en
changeant de saison. Le résumé hebdomadaire d’irrigation conserve, lui, la saison
sélectionnée. Le résumé « Eau aujourd’hui » reste au jour courant même lorsqu’on
consulte une autre semaine.

Le journal immuable 2.7 permet de reconstruire les plages réellement actives,
hors pauses et intervalles entre deux reprises. Le volume total confirmé reste
la référence et est distribué au prorata de ces plages. Pour une saisie manuelle
ou un ancien enregistrement sans journal détaillé, le prorata utilise les
horaires de début et de fin disponibles. Les mm du résumé sont une moyenne sur
la surface totale des planches de la saison, et non un apport uniforme à chacune.
Un minuteur non confirmé ne transforme pas une estimation en réalisé : son
volume en cours est présenté séparément et réservé dans le budget réglementaire.
Les cumuls réalisés utilisent uniquement les apports confirmés, même lorsque
le minuteur reste ouvert après son heure théorique de fin.

Les migrations nouvelles sont `0006_water_objectives_weather_limits` (cinq
tables), `0007_atomic_daily_water_budget` (révision de budget et garde SQL) et
`0008_weather_refresh_guard`. Cette dernière ajoute aux préférences météo
`last_refresh_attempt_at` et `refresh_not_before_at` : le premier champ porte
le verrou atomique qui déduplique les rafraîchissements concurrents, le second
mémorise la prochaine tentative autorisée, notamment après un `Retry-After` du
fournisseur.
La migration `0013_moaning_omega_sentinel` ajoute l’état de synchronisation
automatique aux préférences ainsi que le verrou durable de la tâche planifiée.
La validation d’une nouvelle irrigation et sa mutation partagent une révision
optimiste, vérifiée dans le même batch D1 : deux validations concurrentes ne
peuvent pas réserver le même budget. Une révision obsolète demande un nouvel
essai ; l’enregistrement de la réalité reste toujours autorisé.

« Tout vider » retire uniquement les objectifs de la semaine affichée après
confirmation, en ajoutant des révisions `cleared`. Les autres semaines déjà
configurées, la météo, les restrictions, les irrigations et leurs événements
ne sont pas supprimés. Les semaines encore vierges reprennent la dernière
semaine configurée, éventuellement vide.

`getWaterDashboardForUser`, `buildDailyWaterLedger`, `latestApplicableLimit` et
`evaluateDailyWaterLimit` forment l’interface métier disponible pour la future
tranche 3. Aucun moteur de planning ou bilan agronomique n’est introduit.

## Cumuls et historique (2.9)

La sous-tranche 2.9 ne crée aucune table d’historique supplémentaire. Le
repository `db/irrigation-history-repository.ts` est une projection en lecture
seule des événements, applications par planche, instantanés et journaux
append-only créés par la 2.7. Toutes ses lectures sont isolées par utilisateur,
saison, période et périmètre OTF.

Les quatre périodes disponibles sont la semaine civile, le mois, la saison et
une plage personnalisée. En l’absence de dates saisonnières plus précises dans
le contrat OTF actuel, une saison couvre du 1er janvier au 31 décembre. Les
filtres suivent la hiérarchie ferme → parcelle → jardin/abri → planche.

Les règles d’agrégation sont centralisées dans
`lib/domain/irrigation-history/` (découpé par Q6 le 21 septembre 2026,
les cumuls dans `summary.ts`, les lignes dans `items.ts`) :

- seuls les apports réels confirmés contribuent au volume et aux mm ;
- une irrigation partielle contribue selon ses valeurs réelles, tandis qu’une
  planification ou une annulation contribue à zéro ;
- au niveau d’une planche, les mm réels sont additionnés ; aux niveaux
  supérieurs, ils sont pondérés par la surface physique du périmètre ;
- une planche réellement irriguée plusieurs fois ne compte qu’une fois dans la
  surface physique unique ;
- la pluie manuelle mesurée est prioritaire sur la réanalyse du même jour ;
- l’absence de pluie, d’ET0 ou d’objectif reste distincte d’une mesure valide à
  zéro ;
- l’objectif applicable est reconstruit depuis les révisions historiques, puis
  proratisé à la journée (`objectif hebdomadaire / 7`) et pondéré par surface ;
- l’écart vaut `objectif − (irrigation réelle + pluie réelle)` ; l’ET0 est
  affichée séparément et n’entre pas dans cette formule.

La liste compacte est paginée par douze irrigations. Son détail conserve les
noms, réglages, placements et apports figés, ainsi que les événements de
démarrage, pause, reprise, arrêt, confirmation et annulation. L’export CSV
reprend exactement la saison, les dates et le périmètre sélectionnés ; il reste
utile même lorsque la période ne contient aucune irrigation. Aucune action de
la 2.9 ne modifie l’historique ni ne déclenche une actualisation météo.

## Ressources en eau et réserves (3.1)

La migration `0009_water_resources_reservoirs` ajoute les ressources, les
réserves, les limites de prélèvement, les liaisons plusieurs-à-plusieurs,
l’alimentation d’irrigation par défaut, les mouvements de stock et le journal
de configuration. Toutes ces tables sont isolées par `workspace_id`.

Le volume courant d’une réserve est nullable : `NULL` représente une valeur
inconnue. Les corrections manuelles sont atomiques et laissent un mouvement
append-only avec ancien et nouveau volumes. Les liaisons ressource → réserve et
réserve → réserve sont séparées afin de conserver de vraies clés étrangères et
une topologie explicable. Une alimentation d’irrigation par défaut peut
référencer soit une réserve, soit une ressource directe, sans introduire de
pompe virtuelle.

Les limites de prélèvement utilisent une table de révisions propre et ne
remplacent jamais la limite journalière d’irrigation de 2.8. Le journal
`irrigation_water_infrastructure_log` conserve les changements de configuration
qui influencent les calculs futurs.

## Pompes et contraintes hydrauliques (3.2)

La migration `0010_pumps_hydraulic_constraints` ajoute les pompes d’irrigation,
leurs origines multiples, la pompe habituelle facultative du matériel et les
snapshots de pompe portés par chaque irrigation. Les références ajoutées aux
irrigations sont nullables afin de préserver tout l’historique antérieur.

Une origine référence exactement une ressource directe ou une réserve de la
3.1. Une pompe peut n’avoir aucune origine et une même réserve peut alimenter
plusieurs pompes. `hydraulic_revision` protège atomiquement les validations
simultanées sans fusionner cette contrainte avec le budget d’eau journalier.

Le débit historisé est calculé depuis les applications par planche existantes.
Les snapshots de pompe et d’origine sont immuables ; les modifications futures
de l’inventaire ne réécrivent donc pas l’histoire.

## Besoins planifiables et priorités (3.3)

La migration `0011_irrigation_needs_priorities` ajoute une préférence de seuil
minimal par espace de travail, une décision hebdomadaire par planche et un
journal append-only. La décision porte uniquement la priorité manuelle, le
remplacement manuel facultatif, sa justification et la valeur calculée au
moment du remplacement. Les ET0, pluies, objectifs, irrigations, besoins et
volumes restent dérivés dynamiquement et ne sont pas recopiés dans D1.

L’unicité `(workspace_id, season, week_start, otf_bed_id)` isole les décisions
par exploitation et par semaine. Les identifiants OTF sont validés côté serveur
avant l’écriture. Voir `docs/irrigation-needs-contract.md` pour les formules,
les états incomplets et le contrat destiné aux sous-tranches suivantes.
