# Contrat — Accélérer le site (chantier du 28 novembre 2026)

Roadmap section 6 octodecies. Décisions D-358 (A1), D-359 (A2) et D-360 (A3). Suite du
correctif de la lenteur (section 6 duodecies,
`docs/lenteur-du-module-contract.md`, clos le 25 novembre 2026), dont la
« suite possible » était de garder d'autres lectures répétées. Ce contrat dit
le constat, les mesures et les règles des trois PR ; chacune a la sienne,
mesurée avant et après.

## 1. Le constat et le choix du porteur

Le 28 novembre 2026 au matin, à la demande du porteur (« Refais-moi un test
de performance là pour voir si ça rame ou pas »), une mesure dans son Chrome,
sur la démonstration, en lecture seule
(`/mnt/project-files/performance/mesure-2026-11-28.md`) : **le site ne rame
pas** au quotidien. Les écrans s'ouvrent en 0,3 à 1 s ; « Aujourd'hui » est
le plus lent, environ 1 s, et environ 100 lectures de la base. Trois délais
restent :

- la toute **première ouverture d'un nouvel espace de démonstration**, 4,3 s
  et 7,7 s avant l'arrivée sur « Aujourd'hui » : la préparation de la ferme
  fictive, dans la même requête ;
- **« Aujourd'hui »**, environ 1 s ;
- une **première page de la ferme réelle à 7,8 s**, vue une seule fois, à
  l'ouverture, cause non établie (« vraisemblablement le serveur à froid »).

Quatre pistes ont été proposées (gain, effort, coût). **Le 28 novembre 2026 à
13 h 44, le porteur les suit dans l'ordre recommandé** : « faire 1, puis 2
et 3 » : d'abord mesurer le temps du serveur et re-mesurer le démarrage à
froid (A1), puis la première ouverture de la démonstration (A2), puis
« Aujourd'hui » (A3). La piste du placement du Worker près de la base
(« Smart Placement » de Cloudflare) **n'est pas retenue** : aucun réglage de
Cloudflare n'est changé par ce chantier.

## 2. Les mesures de départ

Sur `main` (`dc83ae1`), en local (`vinext dev`, base locale, démonstration
locale ; une lecture locale coûte bien moins qu'une lecture D1 en ligne :
seuls les nombres d'appels se comparent à la production), relevées par
l'en-tête de la section 3 :

- « Aujourd'hui » de la ferme de démonstration des parcours : **101 appels à
  la base** à chaque ouverture (126 à la première du jour, qui écrit la
  météo) ; « Semaine » par le menu : 64.
- La **première ouverture d'un espace de démonstration** (« Ferme des Trois
  Noues », début de l'été, parcours V13) : **935 appels à la base** dans une
  seule requête ; à 5 à 8 ms l'appel en ligne, c'est 4,7 à 7,5 s, l'ordre de
  grandeur mesuré le matin.
- **Ouvre ta ferme**, sur la ferme réelle : le plan lu est gardé 4 heures
  (`maxCacheAgeMs`, `lib/services/irrigation-service.ts`) ; au-delà, la page
  qui l'ouvre relit Ouvre ta ferme elle-même, appel par appel, au plus quatre
  par seconde (D-002), une dizaine d'appels pour une saison. C'est une
  **hypothèse** pour les 7,8 s, à côté du démarrage à froid : la mesure de A1
  le dira (l'entrée `otf` de l'en-tête).

## 3. A1 — Le serveur dit son temps (D-358)

**Pourquoi d'abord.** Corriger sans mesurer serait corriger au hasard : la
cause des 7,8 s n'est pas établie, et les gains de A2 et A3 doivent se
mesurer en ligne, avant et après, sans lire les journaux de Cloudflare (que
seul le porteur peut ouvrir).

**F1101. Ce qui est compté.** Pendant chaque requête servie par le Worker du
module, en production comme en démonstration, sont comptés et chronométrés :
chaque appel à la base D1 (une lecture, une écriture, un lot, qui ne fait
qu'un aller-retour et compte pour un appel, un `exec`), et chaque appel
sortant, rangé par sorte (F1103). Le temps d'une sorte est celui pendant
lequel au moins un de ses appels était en cours : deux appels simultanés ne
comptent pas deux fois le même instant. Le temps `app` va du début du
traitement de la requête par le code du module au départ de sa réponse ; le
travail que le Worker poursuit après elle (`waitUntil`, ainsi le recalcul du
planning après une écriture) n'y figure pas, l'en-tête étant déjà parti.
L'horloge d'un Worker n'avance qu'aux entrées-sorties : le calcul pur après le
dernier appel n'est pas compté (`lib/adapters/stopwatch.ts`), et le démarrage
d'une instance neuve a lieu avant que le code du module ne tourne : la mesure
ne le chronomètre pas, elle le signale (`instance`).

**F1102. L'en-tête `Server-Timing`.** Chaque réponse porte l'en-tête
`Server-Timing` (norme W3C), six entrées, toujours dans cet ordre :

```text
app;dur=812, d1;dur=640;desc="98 appels", otf;dur=0;desc="0 appel", meteo;dur=0;desc="0 appel", autres;dur=35;desc="1 appel", instance;desc="neuve"
```

Des millisecondes entières ; `instance` vaut `neuve` à la première requête
d'une instance du Worker, `chaude` ensuite. Rien que des caractères ASCII,
des nombres et ces mots : ni adresse, ni chemin, ni paramètre, ni
identifiant. Le navigateur le lit tel quel (outils de développement,
`performance.getEntriesByType('navigation')` et `resource`), sur le document
comme sur un changement de page par le menu.

**F1103. Les sortes d'appels sortants**, d'après le seul nom de l'hôte,
sous-domaines compris : `ouvretaferme.org` → `otf` (l'API et l'image des
plantes) ; `open-meteo.com` et `visualcrossing.com` → `meteo` ; tout autre
hôte (les certificats de Cloudflare Access, le Worker de notification appelé
par son adresse…) → `autres`. Un nom qui ne fait que ressembler
(`pasouvretaferme.org`, `ouvretaferme.org.exemple.net`) est `autres`. Un
appel par liaison de service (le Worker de notification par `IRRIGATION_PUSH`)
n'est pas un appel sortant : il n'est pas compté.

**F1104. Le journal.** Chaque requête mesurée écrit une ligne
`irrigation_request_timing` : la sorte de la requête (`page`, `rsc` pour un
changement de page, `action`, `route` pour une route d'API, `autre`), la
méthode, le chemin, le statut (`null` pour une requête en erreur),
l'instance, le nombre de requêtes que l'instance a servies, `appMs`, et pour
chaque sorte le nombre d'appels et leur temps (`d1Calls`, `d1Ms`, `otfCalls`,
`otfMs`, `weatherCalls`, `weatherMs`, `otherCalls`, `otherMs`). Le chemin
est celui d'une page ou d'une route du module, sans rien après lui (une
adresse peut porter un code de connexion) ; tout autre chemin, que n'importe
qui peut écrire, devient `(autre)`. Jamais d'identifiant de personne ni
d'adresse d'appel (F564).

**F1105. Une requête, ses comptes.** Les comptes vivent dans le contexte de
la requête, jamais dans une variable commune : deux requêtes simultanées ne
mêlent pas leurs appels, la suivante repart de zéro. Hors d'une requête
mesurée (une tâche planifiée, les tests), rien n'est compté et chaque appel
part tel quel. Seul le nombre de requêtes servies par l'instance est commun
à l'instance, pour dire `neuve` ou `chaude`.

**F1106. La mesure ne change rien d'autre.** Le corps, le statut et les
autres en-têtes d'une réponse sont ceux de vinext ; une réponse aux en-têtes
figés (relayée d'un `fetch`) repart en copie, même corps, même statut, mêmes
en-têtes, avec le sien ; une réponse qui ouvre un WebSocket n'est pas
touchée. Un appel part au même moment, son résultat ou son erreur revient tel
quel ; une erreur de la requête repart telle quelle, après sa ligne du
journal. La mémoire de la requête (`db/request-memo.ts`) et sa vidange par
toute écriture ne changent pas.

**Où.** Le domaine pur (`lib/domain/server-timing.ts`) compte, met en forme et
range ; le service (`lib/services/request-timing.ts`) lit l'horloge, tient le
contexte de chaque requête, chronomètre les appels sortants par un `fetch`
qui les enveloppe, comme la démonstration enveloppe déjà le sien
(`lib/services/deployment-mode.ts`), et pose l'observateur des appels à la
base (`db/binding.ts`, `observeDatabaseCalls`). Le point d'entrée de la
production devient `site-worker.ts`, celui de vinext sous ce chronomètre
(`wrangler.jsonc`, `main`) ; celui de la démonstration (`demo-worker.ts`)
passe par le même. Aucun autre réglage du Worker ne change.

**Tests.** `tests/server-timing.test.ts` (le décompte, l'en-tête, les sortes,
le chemin), `tests/db/request-timing.test.ts` (base de test, `fetch` simulé :
les appels de chaque sorte, deux requêtes simultanées, une réponse figée, le
journal ; rejoué dans les trois passages d'isolation), parcours P75 (la page
et le changement de page portent l'en-tête, que le navigateur lit) et V13
(la démonstration aussi).

**Le re-mesurage du démarrage à froid**, après la mise en ligne : trois ou
quatre ouvertures de « Aujourd'hui », chacune après au moins une heure sans
visite, dans le Chrome du porteur ; pour chacune, l'heure, le temps jusqu'au
premier octet de la réponse (entrée de navigation), et les six entrées de
l'en-tête. Sur la démonstration ; sur la ferme réelle, en lecture seule,
seulement sur l'accord exprès du porteur (consignes, point 4). Le résultat
dit la part du démarrage de l'instance (`instance=neuve`, le temps jusqu'au
premier octet bien au-delà de `app`), celle d'Ouvre ta ferme (`otf`) et celle
de la base (`d1`), et ce qu'il convient de faire ensuite : rien n'est
corrigé dans A1.

## 4. A2 — La première ouverture d'un espace de démonstration (D-359)

**Pourquoi.** Préparer l'espace d'un invité (`lib/services/demo-space.ts` ;
`docs/demo-guided-contract.md`, sections 5 et 6) passe par les dépôts
ordinaires, comme si la ferme avait tout saisi : chaque arrosage passé,
chaque matin de prévisions archivé, chaque adoption, chaque rattachement
d'espèce allait seul à la base, après ses propres vérifications. Mesuré sur
`main` (`dc83ae1`), base de test, mémoire de la requête posée comme en ligne
(section 5 sexies du contrat de la tranche 4) : pour la « Ferme des Trois
Noues », **512 appels** au gel de printemps, **794** au début de l'été, **923**
en pénurie, **1 275** en automne ; 260 et 512 pour la petite ferme, 118 pour
la ferme aux vannes ; rien pour la ferme vierge. Au début de l'été : le
matériel et ses arrosages passés 352, la météo et l'archive des prévisions
78, les objectifs adoptés 231 (une fiche de planche entière lue pour chaque
planche), les espèces 56, le plan de la semaine 74. À 5 ou 6 ms l'appel en
ligne, c'est les 4 à 8 s mesurés le matin. En automne, la préparation et la
page d'arrivée dépassaient de plus le millier d'appels dans une même
requête, la limite que D1 donne à une invocation du Worker (un lot y compte
pour une requête) : une préparation pouvait ne pas aboutir.

**Le choix : écrire la ferme fictive en lots.** Un espace déjà prêt, préparé
d'avance, ne porterait ni l'identité de l'invité ni l'heure de son arrivée :
ses lignes ne seraient pas celles de la préparation d'aujourd'hui, et il
faudrait un stock à tenir. Les lots gardent chaque ligne.

**F1107. Les mêmes lignes, dans le même ordre.** La préparation écrit
exactement ce qu'elle écrivait, toutes tables, ligne pour ligne, dans le
même ordre (le journal des modifications compris). Quatre écritures
deviennent groupées ; chacune est faite des instructions mêmes du geste
ordinaire, construites par le même code, et lit ses vérifications une fois
pour toutes ses lignes au lieu d'une fois par ligne :

- les arrosages passés : `createCompletedIrrigationEventsForUser`
  (`db/irrigation-event/create.ts`), les vérifications de
  `createIrrigationEventForUser` (le matériel actif, son réglage et sa pose
  dans l'espace, la pose ouverte à l'heure du début, au moins une planche),
  lues une fois par matériel ; les avertissements, que personne ne voit à la
  préparation, ne sont pas lus ;
- l'archive des prévisions des semaines passées :
  `writeForecastArchivesForUser`, qui n'écrase rien (D-297) ;
- les objectifs adoptés : `getBedWeekProposalsForUser`
  (`lib/services/crop-water-bed.ts`) lit ensemble la proposition de la
  semaine de toutes les planches, celle que la fiche de chacune montrerait,
  face à l'objectif lu de la même façon ; `saveAdoptedGoalsForUser` les
  adopte, journal compris, dans l'ordre du plan ;
- les espèces : `saveDemoSpeciesForUser` (`db/demo-seed-repository.ts`),
  pour chaque espèce son rattachement à sa culture de référence puis son
  seuil de gel, les cultures de référence et le jeu commun lus une fois.

Le matériel, l'eau, les alertes météo, le plan de la semaine et les cases
cochées restent écrits geste par geste : une soixantaine d'appels, des
identifiants qui s'enchaînent (le réglage attend son matériel, la pose son
réglage), et le plan est le calcul même de la tâche de nuit.

**F1108. Un lot ne coupe jamais un geste.** Les gestes partent dans leur
ordre, en lots d'au plus 100 instructions (`db/batches.ts`) ; un geste plus
grand part dans un lot à lui. Un lot de D1 est une transaction : chaque
geste est écrit en entier ou pas du tout, comme seul, et son journal, dans le
lot du geste, lit pour « avant » ce que les gestes d'avant viennent
d'écrire.

**F1109. Un refus n'écrit rien.** Chaque ligne d'une écriture groupée est
vérifiée avant la première écriture : une ligne refusée arrête tout, sans
rien écrire de son groupe, et chaque problème est dit. La préparation qui
échoue ainsi n'est pas finie, et se reprend comme avant (F450).

**F1110. Le budget.** Préparer l'espace d'un invité demande **au plus 300
appels à la base**, quel que soit le profil ou le moment. Mesuré en local
après la PR : 206 au gel de printemps, 229 au début de l'été, 231 en pénurie
et 235 en automne pour la « Ferme des Trois Noues » ; 66 et 69 pour la petite
ferme ; 42 pour la ferme aux vannes ; rien pour la ferme vierge. Un retour à
l'écriture ligne par ligne le dépasse aussitôt.

**Ce qui ne change pas.** La règle des deux requêtes simultanées et de la
préparation interrompue (F450 : les cases cochées en dernier, l'attente de
deux secondes au plus, la reprise d'une préparation commencée depuis plus de
deux minutes), la ferme vierge, la remise à zéro (D4), toutes les pages, et
chaque geste ordinaire de la ferme : son code, ses vérifications et ses
lignes restent les siens ; seul ce qui construit ses instructions est mis à
part, pour servir aux deux.

**Tests.** `tests/db/demo-space-en-lots.test.ts` : chaque écriture groupée
comparée au geste ordinaire répété, dans deux bases neuves, toutes tables,
identifiants tirés dans l'ordre et horloge arrêtée (F1107) ; les lots (F1108)
; les refus (F1109) ; le budget, pour chaque profil et chaque moment (F1110).
Une fois, à l'écriture de la PR, les neuf couples profil × moment préparés
avant (sur `main`, `dc83ae1`) et après, de la même façon : les mêmes lignes,
table par table, octet pour octet. Les tests de la démonstration
(`tests/db/demo-space.test.ts` et les suivants) et ses parcours restent
verts sans changement.

**La mesure.** En local, par l'en-tête de A1, la première ouverture
d'« Aujourd'hui » d'un espace neuf (« Ferme des Trois Noues », début de
l'été ; parcours V13 seul, base neuve) passe de 935 appels à la base à 370 :
229 pour préparer l'espace, le reste pour la page, que vise A3. En ligne,
avant la fusion puis après la mise en ligne, par le même en-tête : la
première ouverture d'un espace neuf de la « Ferme des Trois Noues », au
début de l'été et en automne, dans le Chrome du porteur (le temps jusqu'au
premier octet, `app`, `d1` et son nombre d'appels). Objectif : 1 à 2 s au
lieu de 4 à 8 s. Mesuré en ligne avant la fusion, le 28 novembre 2026 à
18 h 15 (`/mnt/project-files/performance/mesure-2026-11-28-soir-avant.md`) :
l'été était déjà prêt pour l'invité ; l'automne, espace neuf, demande
36 366 ms jusqu'au premier octet de `/irrigation`, entièrement à attendre
la base (1 278 appels, environ 28 ms chacun), puis 2 231 ms pour
« Aujourd'hui » (143 appels) : environ 38 s. La pénurie est gardée neuve
pour la mesure après la mise en ligne.

## 5. A3 — « Aujourd'hui » (D-360)

**Pourquoi.** « Aujourd'hui » rassemble des lectures qui existent déjà
(`lib/services/today-service.ts`) : le plan de la semaine, les arrosages, la
météo, la réserve du sol, le besoin par culture, les besoins de la semaine,
les alertes. Chaque service lit pour lui ce dont il a besoin : plusieurs
lisent la même chose, et un même dépôt lit en plusieurs appels ce qu'il rend
d'un bloc. Mesuré sur `main` (`dc83ae1`), base de test, mémoire de la
requête posée comme en ligne : le modèle de la page demande **101 appels à
la base** pour la « Ferme des Trois Noues » au début de l'été, en pénurie et
en automne, 95 au gel de printemps, 47 pour la petite ferme, 4 pour la ferme
aux vannes. Au début de l'été, 34 de ces appels refont à l'identique une
lecture déjà faite, la même instruction avec les mêmes valeurs : le dernier
plan de la semaine, lu trois fois en 4 appels ; les entrées du besoin par
culture, trois fois en 6 appels ; les poses du matériel et la
correspondance des espèces, quatre fois ; la météo de la semaine, trois
fois ; les réglages du planning, l'objectif automatique et le lieu de la
météo, deux fois. Et l'eau se lit en 7 appels, le matériel en 4, chaque
liste d'arrosages en 2 ou 3. À 5 à 8 ms l'appel en ligne, c'est l'ordre de
la seconde mesurée le matin.

**Le choix : lire une fois, et d'un bloc.** Rien du calcul ne change : les
lectures changent de forme, jamais ce qu'elles lisent ni ce qu'on en fait.

**F1111. Les mêmes chiffres.** Le modèle d'« Aujourd'hui » est exactement
celui d'avant, pour toute ferme et tout moment. Prouvé à chaque
`pnpm test` : le modèle calculé avec la mémoire de la requête, comme en
ligne, et sans elle, chaque lecture allant à la base, est le même pour
chaque profil et chaque moment de la démonstration ; et une fois, à
l'écriture de la PR, avant (`main`) et après, sur les mêmes données : le
même modèle, octet pour octet.

**F1112. Huit lectures de plus, gardées le temps de la requête.** La
section 5 sexies du contrat de la tranche 4 le prévoyait (F814 : « une PR
suivante pourra en ajouter, mesurée en ligne d'abord et avec les mêmes
preuves »). S'ajoutent aux trois lectures de F814 :

- le dernier plan d'une semaine (`readLatestPlanForUser`), rangé par
  l'espace, la saison et la semaine ;
- les entrées du besoin par culture (`readCropWaterInputsForWorkspace`), par
  l'espace et la saison, et la correspondance des espèces
  (`listSpeciesCorrespondencesForWorkspace`), par l'espace ;
- les poses du matériel d'une saison (`listEquipmentPosesForUser`), par
  l'espace et la saison ;
- les valeurs météo de la ferme entre deux dates
  (`listWeatherDailyValuesForUser`), par l'espace, le lieu et les deux dates ;
- le lieu trouvé de la météo (`readWeatherGeocodeForUser`), par l'espace et
  le lieu ;
- les réglages du planning (`readPlanningSettingsForUser`) et les gestes de
  l'objectif automatique (`listAutomaticObjectiveRevisionsForUser`), par
  l'espace.

Elles suivent les règles des premières (F810 à F813) : une mémoire par
requête, jamais d'une requête à l'autre ; rangées sous l'espace entier, la
personne et la ferme, deux fermes faisant deux entrées ; vidées par toute
écriture, une lecture qui croise une écriture n'étant pas gardée ; une
copie par appelant. Hors d'une requête (la tâche du matin, les tests),
chaque lecture va à la base, comme avant. Les autres lectures ne sont
toujours pas gardées : les arrosages, l'eau, le matériel, les décisions, et
ce que F814 exclut.

**F1113. Un calcul qui recommence relit la base.** Un seul calcul relit
pour attendre l'écriture d'une autre requête : la faisabilité
(`lib/services/irrigation-feasibility-service.ts`), qui recommence quand
une de ses sources a changé pendant son calcul (sa révision,
`feasibility_revision`, a bougé). Avant de recommencer, elle oublie ce que
la requête a lu (`forgetRequestReads`, `db/request-memo.ts`), comme après
une écriture : tout se relit à la base, le hors saison, gardé pour la
requête depuis B2 (D-352), compris. L'attente de la démonstration (F450)
relit le choix des fonctionnalités, que rien ne garde (F814).

**F1114. Les lectures d'un même dépôt partent ensemble.** Un dépôt qui
lisait en plusieurs appels indépendants ce qu'il rend d'un bloc les envoie
en un seul lot de lectures (`readTogether`, `db/batches.ts`) : les mêmes
instructions, les mêmes lignes dans le même ordre, un aller-retour au lieu
d'un par lecture. Un lot de lectures n'écrit rien et ne vide pas la mémoire
de la requête (F812) ; une lecture en échec fait échouer le lot, comme le
premier refus d'un `Promise.all`. Sont concernés l'eau
(`listWaterInfrastructureForUser`, 7 lectures), le matériel
(`listEquipmentForUser`, 4), les arrosages (`listIrrigationEventsForUser`,
2 ou 3), les poses (`listEquipmentPosesForUser`, 2), les groupes de jardins
(`listGardenGroupConfigurationForUser`, 2 par saison lue) et les réglages
des besoins (`readIrrigationNeedSettingsForUser`, 2). Les lectures qui
s'enchaînent, comme les propositions du plan, qui attendent son calcul,
restent à la suite.

**F1115. Le budget.** Le modèle d'« Aujourd'hui » demande **au plus 60
appels à la base**, pour chaque profil et chaque moment de la
démonstration. Mesuré en local après la PR, de la même façon qu'avant : 49
pour la « Ferme des Trois Noues » à chacun de ses moments (101, et 95 au
gel de printemps, avant), 27 pour la petite ferme (47 avant), 4 pour la
ferme aux vannes et 2 pour la ferme vierge, comme avant. Un retour à la
lecture par service le dépasse aussitôt.

**Ce qui ne change pas.** Aucun calcul, aucun texte, aucune page, aucune
migration, aucun réglage de Cloudflare ; les écritures, leurs vérifications
et leur journal ; la tâche du matin. Les autres pages lisent par les mêmes
dépôts et y gagnent aussi, sans rien changer de ce qu'elles montrent.

**Tests.** `tests/db/aujourdhui-lectures.test.ts`, rejoué dans les
passages d'isolation (F336, F379) : le modèle avec et sans la mémoire de la
requête, pour chaque profil et chaque moment (F1111) ; pour chacune des huit
lectures, une seule lecture de la base par clé même demandée en parallèle,
une lecture par espace et par argument (une autre saison, une autre
semaine, une autre date, un autre lieu), une copie par appelant, une
relecture après une écriture, aucune mémoire hors d'une requête (F1112) ;
la faisabilité qui recommence et relit ses sources (F1113) ; chaque dépôt
groupé en un appel, toutes ses lignes rendues, comptées dans la base
(F1114) ; le budget (F1115). Chacun de ces tests a été éprouvé une fois en
cassant le code exprès (une clé sans sa saison, sa semaine, ses dates ou
son lieu ; une mémoire sans l'espace ; une valeur partagée sans copie ; une
faisabilité qui n'oublie rien ; un dépôt relu en plusieurs appels ; une
lecture du bloc perdue) : chaque cassure le fait échouer. Les tests des
dépôts et des pages restent verts sans changement.

**La mesure.** En local, par la ligne de journal de A1 : les 25 ouvertures
d'« Aujourd'hui » des parcours de la démonstration, joués avant (sur la
branche de A2) et après. La page de la « Ferme des Trois Noues » passe de
118 appels à la base à 59 (15 ouvertures), le temps du serveur de 379 à
243 ms en médiane, celui de la base de 214 à 112 ms ; 1 438 appels en tout
au lieu de 2 599. En ligne, avant la fusion (F814 : mesurée en ligne d'abord)
puis après la mise en ligne, par l'en-tête de A1 : trois ouvertures
d'« Aujourd'hui » de la démonstration, dans le Chrome du porteur (le temps
jusqu'au premier octet, `app`, `d1` et son nombre d'appels). Objectif :
environ 0,6 s au lieu d'environ 1 s. Mesuré en ligne avant la fusion, le
28 novembre 2026 à 18 h 15, sur un espace déjà prêt de la « Ferme des
Trois Noues » : 1 317 à 1 500 ms jusqu'au premier octet, dont 1 007 à
1 170 ms de serveur, **entièrement à attendre la base** (110 appels au gel
de printemps, 118 au début de l'été, environ 9 à 10 ms chacun) ; 1 995 ms
sur une instance neuve.

## 6. Ce qui ne change pas

Aucun réglage de Cloudflare (ni placement, ni plan, ni journaux), aucune
migration, aucun calcul, aucun texte de l'interface dans A1 ; toutes les
fermes voient les mêmes pages.
