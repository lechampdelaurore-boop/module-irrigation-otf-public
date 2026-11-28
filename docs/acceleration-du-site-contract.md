# Contrat — Accélérer le site (chantier du 28 novembre 2026)

Roadmap section 6 octodecies. Décision D-358 (A1). Suite du correctif de la
lenteur (section 6 duodecies, `docs/lenteur-du-module-contract.md`, clos le
25 novembre 2026), dont la « suite possible » était de garder d'autres
lectures répétées. Ce contrat dit le constat, les mesures et les règles des
trois PR ; chacune a la sienne, mesurée avant et après.

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

## 4. A2 — La première ouverture d'un espace de démonstration

Écrite avec sa PR, après la mise en ligne de A1 et la mesure en ligne du
nombre d'appels et de leur coût. Objectif : 1 à 2 s au lieu de 4 à 8 s, par
l'écriture de la ferme fictive en lots, ou par un espace déjà prêt. Ce qui
est écrit reste exactement ce qu'écrit la préparation d'aujourd'hui, ligne
pour ligne (`docs/demo-guided-contract.md`, sections 5 et 6) ; la règle des
deux requêtes simultanées et de la préparation interrompue (F450) tient.

## 5. A3 — « Aujourd'hui »

Écrite avec sa PR, après A2. Objectif : environ 0,6 s au lieu d'environ 1 s,
en regroupant les lectures et en gardant le temps de la requête celles qui
se répètent (la mémoire de la requête, section 5 sexies du contrat de la
tranche 4, F810 à F816). **Aucun chiffre affiché ne change** : la page est
comparée avant et après sur les mêmes données.

## 6. Ce qui ne change pas

Aucun réglage de Cloudflare (ni placement, ni plan, ni journaux), aucune
migration, aucun calcul, aucun texte de l'interface dans A1 ; toutes les
fermes voient les mêmes pages.
