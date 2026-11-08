# Contrat du besoin en eau par culture et par stade

Écrit le 30 octobre 2026 à partir du document de travail fourni par le
porteur le même jour (« calcul automatique du besoin en eau (ETM) par légume
et par stade », préparé par lui avec un autre assistant à partir des
références du CRIIAM Sud et de la FAO), sur son mot ; extension 5 quater de
`ROADMAP.md`, décision D-045. Il fixe les règles avant tout code. Il reste à
relire par le porteur : les points qu'il doit trancher et les choix faits en
l'écrivant sont rassemblés à la fin. Complété le même jour par le complément
« jauge RFU » du porteur : l'ETM devient la consommation de la jauge de la
réserve du sol (5 ter, D-047, section datée à la fin). **Relu et tranché par
le porteur le 31 octobre 2026 (D-054)** : ses réponses, les dates de stade
par défaut, les délais de levée, les calendriers des cultures pluriannuelles
et la correspondance des espèces sont dans la section « Relecture du porteur
du 31 octobre 2026 », qui prime sur le reste du contrat là où ils diffèrent.
**Complété le 5 novembre 2026 par deux réponses du porteur en cours de code
(D-057)** : un stade déclaré recale le calendrier, et la culture reste sur sa
planche jusqu'à la plus tardive de ses récoltes ; section « Réponses du
porteur en cours de code, le 5 novembre 2026 », qui prime à son tour.

Le document du porteur a été relu contre le dépôt. Là où il supposait une
chose que le logiciel fait autrement, le contrat suit le dépôt et le dit dans
la section « Ce que le contrat adapte du document de départ ».

## Objet

Calculer, pour chaque planche portant une culture et pour chaque jour, le
besoin en eau de cette culture à son stade, puis en tirer un **objectif
hebdomadaire proposé**, affiché à côté de l'objectif saisi à la main.

C'est la porte laissée ouverte par le cadrage du planning (D-024, point 11) :
un besoin calculé par culture et par stade qui remplace, planche par planche,
l'objectif à l'entrée de la 3.3, sans que le moteur de placement change.

La proposition est d'abord une **information**. Elle n'entre dans le besoin
que lorsque l'utilisateur l'adopte, par une révision d'objectif ordinaire.
L'écart, les cumuls, les priorités, la faisabilité et la pénurie ne changent
pas : ils lisent l'objectif, d'où qu'il vienne. L'ET0 n'entre toujours dans
aucune formule du besoin (D-010) ; elle entre dans le calcul de la
proposition, qui n'est pas le besoin.

## Vocabulaire

- **ET0** : l'évapotranspiration de référence d'un gazon, en mm/j. Donnée
  climatique, la même pour toutes les cultures. Le logiciel la connaît déjà
  (`docs/weather-contract.md`).
- **Kc** ou **coefficient cultural** : nombre sans unité qui dit combien une
  culture consomme par rapport au gazon de référence, selon son stade.
- **ETM** (évapotranspiration maximale, aussi appelée ETc) : le besoin en eau
  de la culture, en mm/j. C'est ce que le contrat calcule. ETM = ET0 × Kc ×
  les facteurs de la section « Le calcul du jour ».
- **Stade** : une période du cycle de la culture qui porte un Kc, par exemple
  « Floraison 3e bouquet → Mi-récolte » pour la tomate.
- **Stade observé** : un stade déclaré par le maraîcher, daté.
- **Stade calculé** : un stade déduit de la date d'implantation et des durées
  par défaut.
- **Durée par défaut** : le nombre de jours qu'un stade dure quand rien
  n'a été observé.
- **Culture de référence** : une culture des tables du CRIIAM ou de la FAO,
  à laquelle une espèce d'Ouvre ta ferme est rattachée.
- **Objectif proposé** : la somme des ETM des sept jours d'une semaine, en
  mm/semaine.
- **Délai de levée** : le nombre de jours entre l'implantation et la levée,
  par culture ; il ne décale que les stades que le CRIIAM compte depuis la
  levée (D-054).
- **Calendrier de stades** : pour une culture pluriannuelle, les dates de
  l'année où commence chaque stade (D-054).
- **J-n** : le jour situé n jours avant le dimanche de la dernière semaine
  de récolte ; un stade qui commence à J-n inclut ce jour.

## Les sources

### Source principale : CRIIAM Sud

Le CRIIAM Sud (Centre de ressource et d'innovation pour l'irrigation et
l'agrométéorologie en Région Sud) publie des Kc par stade, mesurés dans le
Sud-Est : https://www.criiamsud.fr/coefficients_culturaux. C'est la
référence à utiliser **en priorité**. Dix-sept légumes, relevés le 29 octobre
2026 :

| Culture | Stades successifs et Kc | Kc max |
| --- | --- | --- |
| Ail | Fin levée → Formation bulbe : 0,5 · Formation bulbe → Grossissement maxi : 0,9 · Grossissement maxi → 20 j avant récolte : 0,6 · 20 j avant récolte → Récolte : 0 | 0,9 |
| Artichaut | Plantation-reprise → 2 mois après : 0,5 · 2 mois → Montée des capitules : 0,6 · Montée des capitules → 15 j avant 1re récolte : 0,8 · 15 j avant 1re récolte → Fin 1re récolte : 1,1 · Fin 1re → Fin 2e récolte : 0,6 | 1,1 |
| Asperge | Fin récolte → Débuttage : 0,5 · Débuttage → 1 mois après : 0,9 · 1 → 2 mois après : 0,7 · 2 → 3 mois après : 0,5 | 0,9 |
| Aubergine | Plantation → Début floraison : 0,5 · Début floraison → Croissance 3e étage : 0,6 · Croissance 3e étage → Mi-récolte : 0,9 · Mi-récolte → Fin culture : 0,6 | 0,9 |
| Betterave | Semis → 30 j après : 0,5 · 30 j → Début tubérisation : 0,7 · Début tubérisation → Récolte : 1 | 1 |
| Carotte | Semis → 30 j après : 0,5 · 30 j → Récolte : 1 | 1 |
| Chou-fleur | Plantation → Apparition inflorescences : 0,5 · Apparition inflorescences → Début formation des choux : 1 · Début formation → Récolte : 1,3 | 1,3 |
| Courgette | Plantation → Floraison : 0,5 · Floraison → Mi-récolte : 1 · Mi-récolte → Fin récolte : 0,7 | 1 |
| Fraisier | Départ végétation → Début floraison : 0,4 · Début floraison → Floraison : 0,6 · Floraison → Grossissement fruits : 0,9 · Grossissement fruits → Récolte : 0,7 | 0,9 |
| Haricot | 30 j après levée → Floraison : 0,6 · Floraison → Formation gousses : 0,8 · Formation gousses → Récolte : 1 | 1 |
| Melon | Plantation → Début floraison : 0,4 · Début floraison → Nouaison : 0,6 · Nouaison → Grossissement fruits : 1 · Grossissement → En cours de récolte : 0,65 | 1 |
| Oignon | Levée → 30 j : 0,6 · 30 → 60 j : 0,8 · 60 j → Début maturité : 1 · Début maturité → 20 j avant récolte : 1,1 · 20 j avant récolte → Récolte : 0,5 | 1,1 |
| Poireau | Reprise → Récolte : 0,7 | 0,7 |
| Poivron | Plantation → Début floraison : 0,5 · Début floraison → Croissance 3e étage : 0,6 · Croissance 3e étage → Mi-récolte : 0,7 · Mi-récolte → Fin récolte : 0,6 | 0,7 |
| Pomme de terre | Levée → 20 j : 0,5 · 20 j → Fin tubérisation : 1,1 · Fin tubérisation → 20 j avant récolte : 0,6 · 20 j avant récolte → Récolte : 0 | 1,1 |
| Salade d'été | Plantation → Début croissance active : 0,4 · Début croissance active → Récolte : 0,7 | 0,7 |
| Tomate | Plantation → Reprise : 0,2 · Reprise → Floraison 3e bouquet : 0,6 · Floraison 3e bouquet → Mi-récolte : 0,9 · Mi-récolte → Fin culture : 0,7 | 0,9 |

Ce que cette source impose :

- le Kc est **en escalier** : une valeur fixe par stade, sans interpolation ;
- les stades sont **phénologiques** (floraison, nouaison, tubérisation) ou
  **relatifs** (« 30 j après semis », « 20 j avant récolte ») ; le CRIIAM ne
  donne **aucune durée en jours** pour les stades phénologiques ;
- elle ne distingue ni plein champ et abri, ni mode d'irrigation ; ses
  valeurs de début de cycle, faibles, correspondent à un goutte-à-goutte qui
  mouille peu le sol ;
- un **Kc de 0** (ail et pomme de terre, 20 derniers jours) veut dire « arrêt
  de l'irrigation avant récolte », pas « besoin inconnu ».

Méthode du CRIIAM (support de formation « Irrigation en maraîchage », Simon
Cordier) : ET0 sous serre = 0,8 × ET0 extérieure, puis ETM = ET0 × Kc. Son
exemple : tomate sous serre le 10 juin, Kc 0,6, ET0 7,3 mm/j ; 7,3 × 0,8 =
5,84 ; × 0,6 = 3,50 mm/j.

Le même support donne des repères de sol génériques — une réserve utile de
50 à 200 mm par mètre, une RFU d'environ 2/3 de la réserve utile, de l'ordre
de 1 mm par cm de sol. Ils restent indicatifs : la RFU mesurée sur la ferme,
51 mm/m après correction des cailloux, soit 0,51 mm par cm, prime
(`docs/soil-reserve-contract.md`, D-046, D-047).

### Source de repli : FAO-56

La FAO-56 (Allen et al., 1998, chapitre 6, tableaux 11 et 12 :
https://www.fao.org/4/X0490E/x0490e0b.htm) donne trois Kc par culture
(début, pleine saison, fin) et des durées de phases. Elle sert à trois
choses : le **repli** pour les légumes absents du CRIIAM, la **source des
durées par défaut** que le CRIIAM ne publie pas, et la référence pour les
corrections.

| Culture | Kc début | Kc pleine saison | Kc fin | Durées début / développement / pleine saison / fin (j) | Total (j) | Ligne FAO |
| --- | --- | --- | --- | --- | --- | --- |
| Ail | 0,7 | 1,00 | 0,70 | non donné | — | — |
| Artichaut | 0,5 | 1,00 | 0,95 | 40 / 40 / 250 / 30 | 360 | avril, Californie (1re année) |
| Asperge | 0,5 | 0,95 | 0,30 | 90 / 30 / 200 / 45 | 365 | février, Méditerranée |
| Aubergine | 0,6 | 1,05 | 0,90 | 30 / 45 / 40 / 25 | 140 | mai-juin, Méditerranée |
| Betterave potagère | 0,5 | 1,05 | 0,95 | 15 / 25 / 20 / 10 | 70 | avril-mai, Méditerranée |
| Brocoli | 0,7 | 1,05 | 0,95 | 20 / 30 / 20 / 10 | 80 | avril, Méditerranée |
| Carotte | 0,7 | 1,05 | 0,95 | 30 / 40 / 60 / 20 | 150 | février-mars, Méditerranée |
| Céleri | 0,7 | 1,05 | 1,00 | 25 / 40 / 45 / 15 | 125 | avril, Méditerranée |
| Chou | 0,7 | 1,05 | 0,95 | 20 / 30 / 20 / 10 | 80 | avril, Méditerranée |
| Chou-fleur | 0,7 | 1,05 | 0,95 | 20 / 30 / 20 / 10 | 80 | avril, Méditerranée |
| Concombre (frais) | 0,6 | 1,00 | 0,75 | 20 / 30 / 40 / 15 | 105 | juin-août, région aride |
| Courgette | 0,5 | 0,95 | 0,75 | 20 / 30 / 25 / 15 | 90 | mai-juin, Méditerranée et Europe |
| Épinard | 0,7 | 1,00 | 0,95 | 20 / 20 / 15 à 25 / 5 | 60 à 70 | avril ou sept.-oct., Méditerranée |
| Fève (fraîche) | 0,5 | 1,15 | 1,10 | 90 / 45 / 40 / 0 | 175 | novembre, Europe |
| Fraisier | 0,4 | 0,85 | 0,75 | non donné | — | — |
| Haricot vert | 0,5 | 1,05 | 0,90 | 20 / 30 / 30 / 10 | 90 | février-mars, Méditerranée |
| Laitue | 0,7 | 1,00 | 0,95 | 20 / 30 / 15 / 10 | 75 | avril, Méditerranée |
| Melon cantaloup | 0,5 | 0,85 | 0,60 | 30 / 45 / 35 / 10 | 120 | janvier, Californie |
| Melon doux | 0,5 | 1,05 | 0,75 | 25 / 35 / 40 / 20 | 120 | mai, Méditerranée |
| Navet | 0,5 | 1,10 | 0,95 | non donné (durées de la betterave, D-054) | — | — |
| Oignon (bulbe) | 0,7 | 1,05 | 0,75 | 15 / 25 / 70 / 40 | 150 | avril, Méditerranée |
| Oignon vert | 0,7 | 1,00 | 1,00 | 25 / 30 / 10 / 5 | 70 | avril-mai, Méditerranée |
| Pastèque | 0,4 | 1,00 | 0,75 | 20 / 30 / 30 / 30 | 110 | avril, Italie |
| Petit pois (frais) | 0,5 | 1,15 | 1,10 | 15 / 25 / 35 / 15 | 90 | mai, Europe |
| Poireau | non listé | — | — | — | — | — |
| Poivron | 0,6 | 1,05 | 0,90 | 25 à 30 / 35 / 40 / 20 | 125 | avril-juin, Europe et Méditerranée |
| Patate douce | 0,5 | 1,15 | 0,65 | 20 / 30 / 60 / 40 | 150 | avril, Méditerranée |
| Pomme de terre | 0,5 | 1,15 | 0,75 | 30 / 35 / 50 / 30 | 145 | avril, Europe |
| Potiron, courge d'hiver | 0,5 | 1,00 | 0,80 | 20 / 30 / 30 / 20 | 100 | mars ou août, Méditerranée |
| Radis | 0,7 | 0,90 | 0,85 | 5 / 10 / 15 / 5 | 35 | mars-avril, Méditerranée et Europe |
| Tomate | 0,6 | 1,15 | 0,70 à 0,90 | 30 / 40 / 45 / 30 | 145 | avril-mai, Méditerranée |

Ce que cette source impose :

- une courbe en **trapèze** : Kc début constant pendant la phase de début,
  montée en ligne droite pendant le développement, Kc pleine saison constant,
  descente en ligne droite vers Kc fin pendant la dernière phase ;
- ses valeurs valent pour un climat assez humide et un couvert complet ; elles
  sont en général **plus hautes que celles du CRIIAM** en pleine saison
  (poivron 1,05 contre 0,7, tomate 1,15 contre 0,9), le chou-fleur faisant
  exception (1,3 au CRIIAM contre 1,05) ;
- les durées sont indicatives, liées à une date et une région ; la FAO
  demande de les caler sur l'observation locale. Les durées du brocoli, du
  chou et du chou-fleur sont celles de la ligne commune « Crucifères » de la
  FAO pour la Méditerranée (avril) ; la même ligne donne 25 / 35 / 25 / 10
  pour une plantation de février et 30 / 35 / 90 / 40 (195 j) pour
  octobre-novembre (relevé du 31 octobre 2026). Le tableau 11 donne aussi le
  potiron, que la première version disait sans durée : corrigé le 31 octobre
  2026. Pour l'aubergine, la page de
  la FAO affiche un total de 40 j alors que la somme des phases fait 140 j :
  erreur de la source, 140 j est retenu.

**On ne mélange jamais les deux sources pour une même culture dans un même
cycle.**

### Le jeu de référence est une donnée

Les deux tables entrent dans la base par une **migration versionnée**, avec
l'adresse de la source et la date du relevé, jamais écrites en dur dans la
logique. Chaque Kc de référence peut être **surchargé** par l'utilisateur, par
culture et par stade ; la valeur d'origine et sa source restent conservées et
lisibles, et chaque surcharge est une révision datée (D-006).

## Quelle source pour quelle espèce

Les cultures du logiciel sont les espèces d'Ouvre ta ferme (`GET /plantList`,
81 espèces sur la ferme, `docs/series-contract.md`). Une **table de
correspondance** rattache chaque espèce à une culture de référence, par
exemple « Laitue batavia » et « Laitue feuille de chêne » à « Salade d'été »,
« Chou brocoli » à « Brocoli » de la FAO.

1. Espèce rattachée à l'une des dix-sept cultures du CRIIAM : **CRIIAM**,
   obligatoirement.
2. Sinon, espèce rattachée à une culture de la FAO : **FAO-56** en trapèze,
   avec ses durées. L'écran avertit que ces valeurs sont en général plus
   hautes que les références régionales, et propose un coefficient
   d'abattement, 1 par défaut.
3. Sinon : **pas de proposition**. L'objectif saisi reste seul, et l'espèce
   figure dans une liste « sans référence Kc », où l'utilisateur peut saisir
   ses propres Kc par stade.

Une correspondance manquante est signalée, **jamais devinée**. La table est
remplie avec le porteur avant la mise en service : l'assistant propose,
le porteur valide. Elle rattache **par espèce**, avec une **exception
possible par série**, quand une même espèce d'OTF porte des cultures conduites
différemment (l'espèce « Ail » porte l'ail sec, l'aillet et l'allium
ornemental) ; une espèce peut être rattachée **par analogie** à une culture
proche, ce que la table dit (D-054). La table validée le 31 octobre 2026 est
dans la section de relecture.

## Le stade d'une culture

### Les dates que le logiciel connaît

Ouvre ta ferme ne donne **que des semaines** : la semaine d'implantation, par
semis direct ou plantation, et les semaines de récolte, réalisées sinon
attendues ; les dates au jour sont nulles sur toute la ferme
(`docs/series-contract.md`). Le contrat compte donc :

- **le jour 0** au lundi de la semaine d'implantation de la culture ;
- **la récolte** au dimanche de la plus tardive de ses semaines de récolte,
  réalisées ou attendues (D-057 ; le suivi par série garde sa règle, la
  dernière réalisée sinon la dernière attendue, D-022) ;
- **la première récolte** au lundi de sa première semaine de récolte,
  réalisée sinon attendue (D-054) ;
- **la mi-récolte** au lundi de la première semaine de récolte plus la moitié,
  arrondie au jour inférieur, du nombre de jours entre ce lundi et le
  dimanche de la dernière semaine de récolte, inclus (D-054).

Le stade calculé peut donc se tromper de quelques jours ; le stade observé
sert à le corriger.

### L'ordre de priorité

1. **Le stade observé.** Le maraîcher déclare, pour une série ou pour une
   planche, « tel stade atteint tel jour », en trois gestes au plus depuis la
   fiche de la planche ou de la série. Un stade déclaré commence le jour dit ;
   les stades suivants arrivent seuls, décalés d'autant s'ils se comptent
   depuis l'implantation ou la levée, à leur date s'ils dépendent de la
   récolte ou du calendrier (D-057, qui remplace « le stade dure jusqu'à la
   déclaration suivante »). La déclaration la plus récente fait foi. Une
   déclaration sur la planche prime sur celle de la série. Une déclaration
   n'est jamais effacée ; une correction est une déclaration nouvelle.
2. **Le stade calculé.** À partir du jour 0, on avance dans les stades selon
   les durées par défaut :
   - un stade dit en jours après un repère (« 30 j après semis ») utilise ce
     nombre ;
   - un stade dit en jours avant la récolte (« 20 j avant récolte ») se compte
     depuis la récolte ;
   - un stade défini par la récolte (« mi-récolte », « 1re récolte », « en
     cours de récolte ») se cale sur les semaines de récolte d'OTF (D-054) ;
   - un stade phénologique (« Floraison ») utilise sa **date par défaut**,
     validée par le porteur le 31 octobre 2026 (D-054, table de la section de
     relecture) : la règle stricte — chaque stade prend, dans l'ordre, une
     phase de la FAO, début, développement, pleine saison, fin —, corrigée
     culture par culture par les sources trouvées ; la tomate garde sa reprise
     de 15 jours ;
   - pour l'ail, l'oignon et la fin de cycle de la pomme de terre, les dates
     se comptent **à rebours** depuis la récolte (J-n), parce que le bulbe et
     la fin de tubérisation suivent la saison et non l'âge de la plante ;
   - une culture pluriannuelle (artichaut, asperge, fraisier) suit un
     **calendrier de stades** fixe dans l'année ;
   - les dates par défaut sont **fixes**, avec un jeu par saison quand la FAO
     en donne plusieurs, choisi selon le mois d'implantation ; le dernier
     stade court jusqu'à la récolte d'OTF.

   Exemple, tomate : Plantation → Reprise, jours 0 à 15, Kc 0,2 ; Reprise →
   Floraison 3e bouquet, jours 15 à 30, Kc 0,6 ; Floraison 3e bouquet →
   Mi-récolte, du jour 30 à la mi-récolte d'OTF, Kc 0,9 ; Mi-récolte → Fin,
   jusqu'à la dernière récolte, Kc 0,7. Carotte : jours 0 à 30, Kc 0,5 ;
   jour 30 à la récolte, Kc 1.

   Les dates par défaut sont enregistrées en base, visibles dans la fiche de
   la culture et modifiables par chaque ferme.
3. **Plus tard, hors de cette extension** : des durées en degrés-jours au lieu
   de jours. Le modèle de données le permet dès le départ : la durée d'un stade
   se dit en jours **ou** en degrés-jours.

### Les passages d'un stade à l'autre

Par défaut, escalier strict : le Kc change le jour du changement de stade.
Une option lisse le passage en ligne droite sur cinq jours ; elle est
désactivée par défaut.

### Les cas où le stade ne se calcule pas

- **Série sans semaine d'implantation** (aucune tâche de semis direct ni de
  plantation) : pas de stade, pas de proposition ; l'écran le dit, comme le
  suivi par série le dit déjà.
- **Stade « N j avant récolte » sans récolte connue** : on reste au stade
  précédent, et l'écran le signale.
- **Avant le premier stade de la table** (par exemple l'ail avant la « fin
  levée », le haricot avant « 30 j après levée ») : le premier stade s'applique
  dès le jour 0, délai de levée compris (confirmé le 31 octobre 2026, D-054).
- **Culture pluriannuelle hors de son calendrier** (l'asperge pendant sa
  récolte, l'artichaut en juin et juillet) : pas de proposition ; l'objectif
  saisi reste seul. Elle reste sur sa planche après sa dernière récolte
  jusqu'à la fin de son calendrier, pour l'ETM et la proposition : exception à
  D-022 pour les seules cultures pluriannuelles (D-054).

## Le calcul du jour

Le calcul vit dans `lib/domain/` et s'y teste ; l'écran et la persistance
l'appellent. Pour une planche `p` qui porte une culture ce jour-là, et un jour
`j` en heure de Paris (D-004) :

```text
ETM(p, j) = ET0(j) × K_abri(p) × Kc(culture, stade du jour) × K_paillage(p) × K_ombrage(p, j)
```

### L'ET0 du jour

Le logiciel la connaît déjà : la réanalyse pour les jours passés, la prévision
pour aujourd'hui et jusqu'à quatorze jours, synchronisées chaque matin à 6 h
15 (`docs/weather-contract.md`). Pour un jour :

- **passé** : la réanalyse ; sinon la prévision enregistrée pour ce jour-là,
  marquée **estimée** ;
- **aujourd'hui ou à venir** : la prévision, marquée **prévue** ;
- **aucune des deux** : l'ETM du jour est **inconnue**. L'objectif proposé de
  la semaine devient « partiel » et nomme les jours qui manquent ; il ne
  compte jamais un jour inconnu pour zéro (D-003).

Observé, estimé et prévu ne sont jamais confondus dans une même valeur ni un
même libellé (D-006).

### Les facteurs

- **K_abri** : 1 en plein champ ; **0,8 par défaut sous abri**, valeur du
  CRIIAM, réglable par abri entre 0,6 et 1 (des mesures en serre bien
  ventilée donnent 0,6). Le logiciel sait déjà qu'une planche est sous abri
  (la pluie y vaut 0).
- **Kc** : celui du stade du jour, de la source retenue pour la culture.
- **K_paillage** : 0,9 si la planche porte un paillage plastique, sinon 1.
  La FAO dit « retirer 0,10 au Kc » ; un facteur qui multiplie ne donne
  jamais un Kc négatif. Le paillage est une donnée nouvelle, réglée par
  planche et par saison.
- **K_ombrage** : 1, option désactivée par défaut. Activée, avec un filet de
  taux `o` posé ce jour-là sur la planche : `√(1 − o)`, soit 0,87 pour un
  filet de 25 %, 0,74 pour 45 %, 0,63 pour 60 %. C'est une **hypothèse**
  tirée des formules de serre, cohérente avec les baisses d'arrosage mesurées
  par le Ctifl en 2026, pas une norme ; l'écran l'affiche comme telle. Le
  logiciel ne connaît aucun filet aujourd'hui : c'est une donnée nouvelle,
  datée.

### Plusieurs cultures sur une même planche

Deux séries qui se chevauchent, ou une série à plusieurs espèces, peuvent
occuper la même planche le même jour. La planche prend l'**ETM la plus
élevée** de ses cultures : celle qui a le plus soif fixe le besoin, comme la
planche la plus demandeuse fixe la dose d'une rampe (D-024). Une culture sans
proposition parmi elles rend la proposition de la planche partielle, et
l'écran nomme la culture.

### La traçabilité

Chaque ETM est enregistrée avec ce qui l'a produite : la source du Kc, le
stade retenu et comment il a été obtenu (observé ou calculé), chaque facteur
appliqué, l'ET0 et sa nature (réanalyse, estimée, prévue). Une ETM recalculée
remplace la précédente pour le calcul, sans réécrire aucune irrigation ni
aucun cumul déjà réalisé.

## L'objectif proposé

```text
objectif proposé(p, semaine) = Σ ETM(p, j) sur les sept jours, du lundi au dimanche
```

- Les jours passés prennent l'ET0 du passé, les jours à venir l'ET0 prévue.
  La proposition se recalcule donc chaque matin après la synchronisation.
- Une planche sans culture un jour de la semaine compte 0 ce jour-là : elle
  n'avait rien à nourrir. Ce n'est pas une donnée manquante.
- L'écran montre côte à côte l'objectif applicable, l'objectif proposé et
  leur écart en mm et en %.

### Adopter la proposition

Un bouton « Adopter la proposition » enregistre la valeur comme **objectif de
la planche**, par une révision ordinaire : au niveau de la planche, qui prime
sur un objectif de jardin, de parcelle ou de ferme, ajoutée à l'historique
sans rien effacer, valable à partir du jour de l'adoption (D-039). Son
origine, « proposition adoptée », est conservée.

Tant que rien n'est adopté, l'objectif saisi reste le seul utilisé par le
besoin, l'écart, la faisabilité et le planning.

### Le mode automatique

Le document de départ prévoit un mode, par planche ou par série, où
l'objectif suit la proposition chaque semaine sans geste de l'utilisateur.
L'ET0 entrerait alors dans le besoin par l'objectif, ce que D-010 interdit
sans décision nouvelle. **Non retenu par le porteur le 31 octobre 2026
(D-054)** : seule l'adoption à la main existe ; D-010 ne change pas. Il pourra
être reconsidéré après une saison de comparaison, par une décision
nouvelle.

## Les garde-fous

- **Kc de 0** (ail et pomme de terre, vingt derniers jours) : ETM et
  proposition à 0, et la planche est marquée « arrêt d'irrigation avant
  récolte ». Ce n'est pas une anomalie.
- **Aspersion en début de cycle** : les Kc du CRIIAM de début de cycle
  supposent un sol peu mouillé. Si le matériel posé sur la planche
  (`docs/equipment-placement-periods-contract.md`) est une aspersion et que
  les arrosages sont rapprochés, trois jours ou moins, l'écran avertit :
  « besoin probablement sous-estimé en début de cycle ». Le Kc n'est pas
  modifié.
- **Goutte-à-goutte** : aucune correction ; les Kc du CRIIAM la contiennent
  déjà. La fraction de sol mouillé de la FAO n'est pas appliquée aux valeurs
  du CRIIAM : ce serait compter deux fois la même réduction.
- **Bornes** : 0 ≤ Kc ≤ 1,3 ; 0 ≤ ET0 ≤ 12 mm/j ; 0,5 ≤ K_abri ≤ 1. Une
  valeur hors bornes bloque le calcul du jour avec un message qui la nomme ;
  la dernière valeur valide n'est pas écrasée.
- **Alerte de cohérence** : une ETM au-delà de 8 mm/j, ou une proposition qui
  s'écarte de plus de 50 % de l'objectif applicable, est signalée dans la vue
  de la semaine. Ce n'est pas forcément une erreur, mais l'utilisateur doit
  le voir.
- **Stade corrigé en arrière** : les ETM passées se recalculent ; aucune
  irrigation enregistrée, aucun cumul réalisé n'est modifié.

## Les données

Noms indicatifs ; la migration est additive (D-018) et ses tests de
persistance l'accompagnent.

- **Kc de référence** : source (CRIIAM, FAO-56, saisie locale), culture de
  référence, rang du stade, libellés de début et de fin, Kc, durée par défaut
  en jours ou en degrés-jours, nature de la durée (jours après un repère,
  jours avant récolte, phénologique), adresse et date du relevé.
- **Surcharges de Kc** : par culture et par stade, révisions datées.
- **Correspondance des espèces** : espèce d'Ouvre ta ferme, culture de
  référence, source.
- **Stades observés** : série, planche facultative, rang du stade, jour,
  auteur.
- **Réglages de planche** : paillage plastique par saison ; filet d'ombrage
  et son taux, daté, si l'option est retenue.
- **Réglages d'abri** : K_abri, révisions datées.
- **ETM du jour** : planche, jour, ET0 et sa nature, source du Kc, stade et
  sa provenance, Kc, chaque facteur, ETM, heure du calcul.

## L'écran

- **Fiche de la planche et fiche de la série** : le stade du jour, observé ou
  calculé, avec la date prévue du prochain changement ; le Kc et l'ETM du
  jour ; l'objectif proposé de la semaine face à l'objectif applicable ; les
  boutons « Déclarer un stade » et « Adopter la proposition ».
- **Planning de la semaine** : une colonne « proposé » à côté de
  « objectif ».
- **Page « Coefficients culturaux »** : les tables du CRIIAM et de la FAO,
  les surcharges, les durées par défaut modifiables, la liste des espèces
  sans correspondance ; à côté des Kc, la profondeur racinaire et la part
  utilisable p de chaque culture, avec leur source (ITAB, recherche
  documentaire du 31 octobre 2026, FAO-56 ; `docs/soil-reserve-contract.md`,
  D-053) et leur surcharge, qui servent à la jauge de la 5 ter.
- **Réglages** : K_abri par abri, paillage par planche, options (lissage,
  ombrage) avec leur état et une phrase qui dit ce que chacune fait.
- Ordinateur et 390 px de large ; la 3.8 rangera ensuite ces écrans avec le
  reste de l'interface.

## Lien avec la réserve du sol (5 ter)

Tranché le 30 octobre 2026 par le complément « jauge RFU » du porteur
(D-047) : la jauge de la réserve du sol consomme l'**ETM du jour** de la
planche, calculée ici, au lieu de « ET0 × coefficient réglable »
(`docs/soil-reserve-contract.md`). Conséquences :

- l'ETM se calcule pour chaque jour, passé et prévu, que la proposition
  d'objectif soit adoptée ou non ; la jauge en a besoin même quand
  l'objectif reste saisi à la main ;
- une planche sans ETM, culture sans Kc ou ET0 absente, rend sa jauge
  inconnue ce jour-là, la culture ou le jour nommés (D-003) ;
- la 5 ter se code après le domaine de la 5 quater ;
- la culture reste sur sa planche, pour la jauge comme pour l'ETM, jusqu'à la
  plus tardive de ses semaines de récolte, réalisées ou attendues (D-057) ;
- sur une planche sans culture, la jauge ne lit pas d'ETM : elle calcule
  elle-même l'évaporation du sol nu ou la consommation de l'état de surface
  à partir de l'ET0, avec les règles de nature de l'ET0 de ce contrat
  (relecture de la 5 ter du 31 octobre 2026, D-053) ;
- pendant le délai de levée, le Kc du premier stade s'applique : l'ETM, et
  donc la jauge, n'est jamais inconnue faute de levée (relecture du
  31 octobre 2026, D-054) ;
- les deux extensions partagent les cultures de référence et la table de
  correspondance des espèces : le Kc d'un côté, la profondeur racinaire et la
  part utilisable p de l'autre, sur la même page.

La jauge reste une information : elle ne change ni l'objectif proposé, ni
les priorités, ni la dose (D-041, D-047).

## Hors périmètre

La pluie efficace (la pluie reste comptée à 100 %) ; l'efficience
d'irrigation, brut et net ; le stress hydrique volontaire ; une restriction
avant récolte autre que les Kc à 0 du CRIIAM ; la correction climatique des
Kc de la FAO (équation 62 : vent à 2 m et humidité minimale, que le logiciel
ne conserve pas aujourd'hui) ; les durées en degrés-jours ; le planning par
série ; l'écriture vers Ouvre ta ferme.

## Découpage et preuve de fin

En PR courtes, tests d'abord :

0. **Les données de départ, sans code** : la correspondance des espèces de la
   ferme et les durées par défaut des dix-sept cultures, proposées par
   l'assistant avec leur source, validées par le porteur, consignées ici.
   Faite le 31 octobre 2026 (D-054), section de relecture.
1. **Le domaine**, codé le 5 novembre 2026 (`lib/domain/crop-water/`,
   D-057) : le stade calculé et observé, la source du Kc, l'escalier
   et le trapèze, les facteurs, l'ET0 et sa nature, la planche à plusieurs
   cultures, la proposition de la semaine, les garde-fous ; les scénarios
   ci-dessous en tests.
2. **La persistance**, codée le 6 novembre 2026 (migration
   `0023_crop_water_need`, `db/crop-water/`) : la migration (références,
   surcharges, correspondances, stades, réglages, ETM) et ses tests de
   persistance ; précisions dans la section datée à la fin.
3. **L'écran**, commencé le 6 novembre 2026 en trois PR (3a, la page des
   coefficients et la correspondance des espèces ; 3b, les fiches,
   l'objectif proposé et l'adoption ; 3c, les réglages, les surcharges et
   l'ETM enregistrée ; section datée à la fin) : les fiches, la colonne « proposé », l'adoption, la page des
   coefficients, les réglages ; un parcours navigateur aux deux largeurs.
4. ~~**Le mode automatique**, seulement si le porteur le retient~~ : non
   retenu le 31 octobre 2026 (D-054).

Preuve de fin : les scénarios en tests, les tests de persistance, le parcours
navigateur, aucun résultat changé dans les tests existants d'écart, de cumul,
de priorité, de faisabilité et de planning, puis une recette réelle sur la
ferme, sur ordinateur et à 390 px, le constat à l'assistant et le jugement au
porteur (D-014).

### Scénarios chiffrés

1. **Tomate sous abri**, K_abri 0,8, stade « Reprise → Floraison 3e
   bouquet », Kc 0,6, ET0 7,3 : 7,3 × 0,8 = 5,84 ; × 0,6 = **3,50 mm/j**,
   l'exemple du CRIIAM.
2. **Carotte en plein champ, jour 45**, ET0 5,0 : Kc 1, **5,0 mm/j**.
3. **Carotte en plein champ, jour 10**, ET0 5,0 : Kc 0,5, **2,5 mm/j**.
4. **Ail, dix jours avant sa récolte** : Kc 0, **0 mm/j**, planche marquée
   « arrêt d'irrigation avant récolte ».
5. **Chou-fleur, stade observé hier** « Début formation des choux » : Kc
   **1,3** aujourd'hui, même si le stade calculé donne encore 1.
6. **Brocoli, absent du CRIIAM, jour 35**, durées FAO 20 / 30 / 20 / 10 :
   phase de développement, 15 jours sur 30, Kc = 0,7 + (1,05 − 0,7) × 15 / 30
   = **0,875**.
7. **Poivron en plein champ, filet de 45 %**, Kc 0,7, ET0 6,0 : option
   activée, K_ombrage = √0,55 = 0,742, ETM **3,1 mm/j** ; option désactivée,
   **4,2 mm/j**.
8. **Semaine** : sept jours à 3,5 mm/j, proposition **24,5 mm/semaine** ;
   tant qu'elle n'est pas adoptée, l'écart continue d'utiliser l'objectif
   saisi.
9. **ET0 du mercredi sans réanalyse** : la prévision enregistrée pour mercredi
   sert, l'ETM du mercredi est marquée « estimée ». Sans réanalyse ni
   prévision : ETM du mercredi inconnue, proposition « partielle », mercredi
   nommé ; jamais 0.
10. **Espèce sans correspondance** : aucune ETM, la planche garde son
    objectif, l'espèce figure dans la liste « sans référence Kc », rien ne
    s'arrête.
11. **Semaine d'implantation** : carotte semée en semaine 2026-W10 ; le jour 0
    est le lundi 2 mars 2026 ; le jour 30, mercredi 1er avril, le Kc passe
    de 0,5 à 1.
12. **Deux cultures sur une planche** : une salade d'été à 2,8 mm/j et une
    tomate à 3,5 mm/j le même jour : la planche prend **3,5 mm/j**.
13. **Adoption** : proposition de 24,5 mm adoptée le mercredi sur une planche
    dont le jardin porte un objectif de 20 mm : une révision de planche de
    24,5 mm s'ajoute, valable dès mercredi ; l'objectif de 20 mm du jardin
    reste dans l'historique et vaut encore pour lundi et mardi.
14. **Non-régression** : tous les tests existants passent sans changement des
    résultats d'écart, de cumul, de priorité, de faisabilité et de planning.

## Ce que le contrat adapte du document de départ

Relu contre le dépôt le 30 octobre 2026 :

1. **Les dates sont des semaines.** Le document parle de date de plantation
   et de date de fin ; Ouvre ta ferme ne donne que des semaines. Le jour 0 est
   le lundi de la semaine d'implantation, la récolte le dimanche de la
   dernière semaine de récolte.
2. **L'ET0 prévue existe déjà.** Le document la croyait apportée par les
   alertes météo (5 bis) et prévoyait sinon la moyenne des sept derniers
   jours ; le logiciel synchronise déjà la prévision jusqu'à quatorze jours.
   La 5 quater ne dépend donc pas de la 5 bis.
3. **L'ET0 manquante.** Le document proposait la moyenne des trois derniers
   jours ; le contrat suit la règle déjà en place pour la pluie (D-019) :
   réanalyse, sinon prévision enregistrée marquée estimée, sinon inconnue,
   jamais zéro (D-003).
4. **Plusieurs cultures sur une planche** : cas absent du document, réglé par
   l'ETM la plus élevée.
5. **L'objectif peut viser la ferme, une parcelle, un jardin ou une
   planche.** L'adoption crée une révision au niveau de la planche, la plus
   précise, qui prime sur les autres sans les effacer.
6. **Le mode automatique** demande une décision nouvelle, à cause de D-010.
7. **La correction climatique** passe hors périmètre : le logiciel ne
   conserve ni le vent à 2 m ni l'humidité minimale.
8. **Le paillage et le filet d'ombrage** sont des données que le logiciel ne
   connaît pas encore ; elles sont ajoutées.

## À trancher par le porteur à la relecture

Tranchées le 31 octobre 2026 (D-054, section de relecture). Les six questions
du document de départ :

1. les durées par défaut des dix-sept cultures, proposées à part (PR 0) ;
2. la valeur de K_abri de chaque abri : 0,8 du CRIIAM, ou 0,6 à 0,7 pour un
   tunnel bien ventilé ;
3. le paillage : facteur 0,9 ou retrait de 0,10 au Kc ;
4. le lissage des passages de stade : activé ou non ;
5. la correspondance des espèces d'Ouvre ta ferme, notamment salades, choux
   et courges (PR 0) ;
6. l'option d'ombrage : la garder comme hypothèse affichée, ou attendre des
   mesures sur la ferme.

Et deux décisions que le dépôt impose :

7. **le mode automatique** : le retenir, ce qui fait entrer l'ET0 dans le
   besoin par l'objectif et demande une décision explicite (D-010), ou s'en
   tenir à l'adoption à la main ;
8. ~~**la jauge de la réserve du sol** : garder « ET0 × coefficient » (D-041)
   ou lui donner l'ETM~~ : tranché le 30 octobre 2026, l'ETM (D-047).

## Choix faits en écrivant, à confirmer à la relecture

Confirmés le 31 octobre 2026 (D-054) ; le 3 avec le délai de levée, le 9 sans
objet, le mode automatique n'étant pas retenu.

1. le jour 0 au lundi de la semaine d'implantation, la récolte au dimanche de
   la dernière semaine de récolte ;
2. l'ET0 manquante traitée comme la pluie (D-019), au lieu de la moyenne des
   trois derniers jours ;
3. le premier stade appliqué dès le jour 0 quand la table commence plus tard
   (« fin levée », « 30 j après levée ») ;
4. la planche à plusieurs cultures qui prend l'ETM la plus élevée ;
5. le stade observé sur la planche qui prime sur celui de la série ;
6. l'adoption valable à partir de son jour, au niveau de la planche ;
7. l'avertissement d'aspersion en début de cycle seul, sans Kc relevé
   (le document proposait en option un Kc d'au moins 0,7) ;
8. la correction climatique hors périmètre ;
9. le mode automatique, s'il est retenu, révisé le lundi seulement.

## Complément du 30 octobre 2026 : la jauge de la réserve du sol (D-047)

Le porteur complète son document de travail le jour même par une section
« jauge RFU ». Ce qui touche ce contrat :

1. l'ETM calculée ici devient la consommation de la jauge de la 5 ter ;
   l'ETM se calcule donc pour chaque planche portant une culture, que la
   proposition soit adoptée ou non ;
2. les repères de sol génériques du CRIIAM restent indicatifs, la RFU
   mesurée sur la ferme prime ;
3. la page « Coefficients culturaux » reçoit la profondeur racinaire et la
   part utilisable p de chaque culture ;
4. le point 8 des décisions à prendre est tranché.

Le reste du complément — la RFU corrigée des cailloux, les profondeurs, le
seuil de déclenchement, le bilan, la dose conseillée, le drainage, les
données et les tests de la jauge — est écrit dans
`docs/soil-reserve-contract.md`. Le complément faisait remonter une planche
sous son seuil dans les priorités ; le porteur a choisi « Information
seulement ».

## Relecture du porteur du 31 octobre 2026 (D-054)

Le porteur a relu le contrat point par point le 31 octobre 2026, de 11 h 17 à
12 h 20 environ (heure de Paris), à partir d'un document de relecture préparé
par l'assistant, réponse par réponse sur des cartes de décision. Il a demandé
une recherche documentaire pour chiffrer ce qui n'avait pas de source. Il a
rappelé que le logiciel servira à d'autres fermes : chaque règle vaut pour
toutes les cultures, même celles qu'il ne cultive pas. Cette section prime sur
le reste du contrat là où ils diffèrent.

### Ce que la relecture a corrigé

1. Le contrat se contredisait sur la tomate (règle : 30 jours de reprise ;
   exemple : 15). Tranché : 15 jours (ci-dessous).
2. La FAO donne des durées pour le potiron (20 / 30 / 30 / 20) : tableau
   corrigé.
3. Les durées des choux sont celles de la ligne FAO « Crucifères » : précisé,
   avec les lignes de février et d'octobre-novembre.
4. Les stades de l'asperge du CRIIAM tombent tous après sa récolte, quand
   D-022 retire une culture de sa planche : exception pour les cultures
   pluriannuelles (ci-dessous).
5. OTF donne toutes les semaines de récolte, pas seulement la dernière : la
   première et la mi-récolte s'en déduisent.

### La méthode des dates de stade

1. **Règle stricte** : chaque stade phénologique prend, dans l'ordre, une
   phase de la FAO (début, développement, pleine saison, fin), puis la date
   est corrigée culture par culture quand une source le justifie (table
   ci-dessous). La tomate garde une reprise de 15 jours.
2. **Mi-récolte, première récolte et « en cours de récolte »** se calent sur
   les semaines de récolte d'OTF (section « Les dates que le logiciel
   connaît »).
3. **À rebours depuis la récolte** pour l'ail, l'oignon et la fin de
   tubérisation de la pomme de terre.
4. **Délai de levée** par culture (table ci-dessous), modifiable par chaque
   ferme ; pendant ce délai, le Kc du premier stade s'applique, pour que
   l'ETM ne soit jamais inconnue faute de levée. Il ne décale que les stades
   que le CRIIAM compte depuis la levée : en pratique l'oignon semé
   (« Levée → 30 j », « 30 → 60 j ») et la pomme de terre (« Levée → 20 j ») ;
   pour l'ail et le haricot, le premier stade s'applique de toute façon dès
   le jour 0 ; pour les autres cultures, le délai est enregistré sans effet
   sur le Kc.
5. **Dates fixes, un jeu par saison** quand la FAO en donne plusieurs, choisi
   selon le mois d'implantation ; le dernier stade court jusqu'à la récolte
   d'OTF ; le stade déclaré corrige le reste.
6. **Cultures pluriannuelles** (artichaut, asperge, fraisier) : un
   **calendrier fixe** de stades dans l'année, modifiable par chaque ferme,
   corrigé par le stade déclaré ; hors de son calendrier, pas de proposition.
   Elles restent sur leur planche après leur dernière récolte jusqu'à la fin
   de leur calendrier, pour l'ETM, la proposition et la jauge de la 5 ter
   (exception à D-022 pour elles seules ; effet sur la jauge écrit dans
   `docs/soil-reserve-contract.md`).

### Les délais de levée par défaut

Semis direct : valeurs du tableau de Harrington (Université de Californie à
Davis, repris par UCCE Sacramento, *Garden Notes* GN 154, 2015, et Oregon
State University) pour un sol à 15 °C.

| Culture et mode d'implantation | Délai de levée | Source |
| --- | --- | --- |
| Pomme de terre (plants) | 25 j | Université de l'Idaho, bulletin 789 (20 à 35 j) ; Chambre d'agriculture du Rhône, 2013 (70 % de levée à 20-30 j) ; milieu des fourchettes |
| Ail planté à l'automne | 30 j | Bulletins de santé du végétal Ail, Occitanie, 2016-2022 (3 à 6 semaines, déduit des dates observées) |
| Haricot (semis) | 16 j | Harrington, 15 °C |
| Panais (semis) | 19 j | Harrington, 15 °C (reprise Oregon State, à vérifier sur l'original) |
| Persil (semis) | 17 j | idem |
| Betterave (semis) | 10 j | Harrington, 15 °C |
| Carotte (semis) | 10 j | idem |
| Pois (semis) | 9 j | idem |
| Oignon (semis) | 7 j | idem |
| Épinard (semis) | 7 j | idem |
| Radis (semis) | 6 j | idem |
| Laitue (semis) | 4 j | idem |
| Navet (semis) | 3 j | idem |
| Plants repiqués, toutes cultures | 0 j | la plante est déjà levée |
| Oignon en bulbilles | 0 j | aucune source trouvée ; modifiable |

### Les dates par défaut des dix-sept cultures du CRIIAM

Jours comptés depuis le jour 0 ; J-n à rebours depuis la récolte ; « OTF » =
calé sur les semaines de récolte d'Ouvre ta ferme. Les Kc sont ceux du CRIIAM
(section « Les sources »).

| Culture | Dates par défaut (Kc du stade qui commence) | Source |
| --- | --- | --- |
| Ail | J0 (0,5) · J-45 formation du bulbe (0,9) · J-25 grossissement maximal (0,6) · J-20 arrêt (0) | Bulletins de santé du végétal Ail, Occitanie, 2016-2026 : bulbe visible 30 à 45 j avant la récolte ; arrêt de l'eau 2 à 3 semaines avant (CTEM, 2021) |
| Artichaut | calendrier (ci-dessous) ; la 1re année, Kc 0,5 deux mois après la plantation | IGP Artichaut du Roussillon |
| Asperge | calendrier (ci-dessous) | Chambre d'agriculture des Bouches-du-Rhône, 2015 |
| Aubergine | J0 (0,5) · J21 début de floraison (0,6) · J45 croissance du 3e étage (0,9, estimation) · mi-récolte OTF (0,6) | Université du Missouri, guide G 6369 (1re fleur vers 3 semaines) ; 3e étage : estimation sans source |
| Betterave | J0 (0,5) · J30 (0,7) · début de tubérisation J60 pour un semis d'avril à août, J80 de septembre à mars (1) | FAO-56, Méditerranée, avril-mai et février-mars |
| Carotte | J0 (0,5) · J30 (1) | CRIIAM |
| Chou-fleur | J0 (0,5) · inflorescence J35, pomme J50 (1 puis 1,3) pour une plantation de mars à août ; J30 et J155 de septembre à février | Booij, 1987 (initiation à 25-46 j, croissance de la pomme 37-55 j ; J50 estimé) ; FAO-56 « Crucifères », octobre-novembre |
| Courgette | J0 (0,5) · J20 floraison (1) · mi-récolte OTF (0,7) | FAO-56, mai-juin ; Chambre d'agriculture PACA, 2018 (1re récolte vers J40) |
| Fraisier | calendrier estimé (ci-dessous) | aucune source |
| Haricot | J0 (0,6) · J40 floraison (0,8) · J50 formation des gousses (1) | SUAMME, 2012 (récolte vers 60 j) ; CROPTIME, Oregon State, 2020 (1re fleur J38-J44) ; J50 estimé |
| Melon | J0 (0,4) · J25 début de floraison (0,6) · J45 nouaison (1) · 1re récolte OTF (0,65) | FAO-56, mai ; Civam Bio 66, 2025 (récolte 60-80 j après plantation) ; Utah State, 2020 (35-45 j de la fleur au fruit) |
| Oignon | levée (0,6) · levée + 30 j (0,8) · levée + 60 j (1) · J-40 début de maturité (1,1) · J-20 (0,5) | CRIIAM ; FAO-56, phase de fin de 40 j |
| Poireau | un seul stade (0,7) | CRIIAM |
| Poivron | J0 (0,5) · J30 début de floraison (0,6) · J50 croissance du 3e étage (0,7, estimation) · mi-récolte OTF (0,6) | FAO-56, avril-juin ; 3e étage : estimation sans source |
| Pomme de terre | levée (0,5) · levée + 20 j (1,1) · J-30 fin de tubérisation (0,6) · J-20 arrêt (0) | CRIIAM ; FAO-56, phase de fin de 30 j ; Chambre d'agriculture du Rhône, 2013 |
| Salade d'été | J0 (0,4) · début de croissance active J20 de mars à octobre, J30 de novembre à janvier, J35 en février (0,7) | FAO-56 laitue, Méditerranée, avril, novembre-janvier, février |
| Tomate | J0 (0,2) · J15 reprise (0,6) · J30 floraison du 3e bouquet (0,9) · mi-récolte OTF (0,7) | de Koning, Wageningen, 1994 (un bouquet tous les 7 à 9 j) ; J30 estimé, prudent pour un plant non fleuri en plein champ |

Une date marquée « estimation » s'affiche comme telle dans la fiche de la
culture.

Jeux de saison, selon le mois d'implantation, modifiables par chaque ferme :
chou-fleur et choux rattachés aux « Crucifères » de la FAO, jeu de printemps
(ligne d'avril) de mars à août, jeu d'automne (ligne d'octobre-novembre) de
septembre à février ; betterave, navet et radis rave, ligne d'avril-mai pour
un semis d'avril à août, ligne de février-mars de septembre à mars ; salade,
ligne d'avril de mars à octobre, ligne de novembre-janvier de novembre à
janvier, ligne de février en février. Les autres cultures n'ont qu'un jeu.

### Les calendriers des cultures pluriannuelles

Calendriers par défaut, valables d'abord pour le Sud-Est, modifiables par
chaque ferme ; dates de début de stade, Kc du CRIIAM.

- **Asperge** : 31 mai, fin de récolte (0,5) ; 7 juin, débuttage (0,9) ;
  7 juillet (0,7) ; 7 août (0,5) ; fin le 7 septembre. Hors de ces dates, pas
  de proposition. Source : Chambre d'agriculture des Bouches-du-Rhône, 2015,
  reprise par la Chambre de la Gironde, 2024 (récolte mars-mai, végétation
  irriguée juin-octobre) ; la semaine entre fin de récolte et débuttage est
  estimée.
- **Artichaut remontant** : 1er août, montée des capitules (0,8) ; 15 août,
  15 j avant la 1re récolte (1,1) ; 1er janvier, fin de la 1re récolte (0,6) ;
  fin le 31 mai. **Non remontant** : 1er février (0,8) ; 15 février (1,1) ;
  fin le 31 mai. Juin et juillet : repos, pas de proposition. La ferme
  choisit le type. Source : cahier des charges de l'IGP Artichaut du
  Roussillon (récolte septembre-mai pour le remontant, mars-mai pour le non
  remontant) ; montée des capitules estimée à un mois avant la 1re récolte.
- **Fraisier**, non remontant, plein champ : 15 février, départ de
  végétation (0,4) ; 20 mars, début de floraison (0,6) ; 10 avril, floraison
  (0,9) ; 1er mai, grossissement des fruits (0,7) ; fin le 30 juin, le
  30 septembre pour un remontant. **Estimation sans source**, affichée comme
  telle.

### La correspondance des espèces

Règles : rattachement par espèce d'OTF ; exception possible par série ;
analogie permise et signalée ; une espèce sans référence garde son objectif
saisi, et la ferme peut saisir ses propres Kc. Table validée pour les
79 espèces relevées sur la ferme du porteur le 31 octobre 2026 (« Cumuls et
historique », onglet « Par série », lecture seule, sur son « vas-y ») :

| Espèces d'OTF | Culture de référence |
| --- | --- |
| Ail (série d'ail sec) | Ail, CRIIAM |
| Ail, **exception** série d'aillet | Oignon vert, FAO |
| Ail, **exception** série d'allium ornemental | sans référence |
| Aubergine ; Betterave ; Carotte (primeurs comprises) ; Courgette ; Haricot ; Melon ; Poireau | la culture du même nom, CRIIAM |
| Laitue (toute l'année) | Salade d'été, CRIIAM |
| Tomate ; Tomate cerise ; Tomate ancienne pop mélange | Tomate, CRIIAM |
| Chicorée frisée ; Chicorée scarole ; Mesclun ; Mâche | Salade d'été, CRIIAM, par analogie |
| Panais | Carotte, CRIIAM, par analogie |
| Chou blanc ; Chou rouge ; Chou de Milan ; Chou pointu ; Chou kale ; Chou pë-tsaï | Crucifères, FAO |
| Concombre | Concombre, FAO, avec l'avertissement que la FAO ne le donne que pour des régions arides |
| Courge (butternut, potimarron, courge ornementale) | Potiron, FAO |
| Épinard ; Fève ; Pastèque ; Patate douce | la culture du même nom, FAO |
| Oignon (oignons en botte) | Oignon vert, FAO |
| Pois | Petit pois, FAO |
| Radis botte | Radis, FAO |
| Céleri branche | Céleri, FAO |
| Céleri-rave ; Fenouil ; Persil | Céleri, FAO, par analogie |
| Blette ; Arroche | Épinard, FAO, par analogie |
| Navet ; Radis rave | Navet, FAO (Kc 0,5 / 1,10 / 0,95), avec les durées de la betterave de la FAO par saison ; radis rave par analogie |
| Fleurs, aromatiques vivaces et divers : Achillée millefeuille, Ageratum, Amarante, Reine marguerite, Bupleurum, Campanule, Celosie Spicata, Celosie Cristata, Cerinthe, Molucella, Cosmos, Delphinium, Dianthus, Didiscus, Digitale, Gypsophila, Lagure, Lavatera, Lin, Lunaria, Muflier, Narcisses, Nielle des blés, Nigelle, Millet, Coquelicot, Pois de senteur, Renoncule, Scabieuse, Sorgho, Statice, Tournesol, Tulipe, Zinnia, Ammi majus, Menthe, Verveine officinale, Rhubarbe | sans référence |
| Engrais vert | pas une culture à Kc : état de la surface d'une planche nue (5 ter) |

Le catalogue d'OTF compte 81 espèces ; les deux qui manquent ne portent
aucune série suivie cette saison. Une espèce nouvelle reste sans référence
jusqu'à ce qu'un rattachement soit saisi.

### Les facteurs et les options

- **K_abri** : 0,8 pour tous les abris au départ, réglable abri par abri
  entre 0,6 et 1.
- **Paillage plastique** : Kc × 0,9, réglé par planche et par saison.
- **Lissage** des changements de stade : désactivé par défaut, l'option
  restant disponible.
- **Ombrage** : l'option est codée, désactivée par défaut, affichée comme
  hypothèse, avec le filet et son taux saisis par planche et datés.
- **Mode automatique** : non retenu ; adoption à la main seulement.

### Scénarios ajoutés

15. **Mi-récolte calée sur OTF** : tomate plantée en 2026-W17 (jour 0, lundi
    20 avril 2026), récoltes de 2026-W27 à 2026-W40 ; première récolte le
    lundi 29 juin, dernière le dimanche 4 octobre, 98 jours ; mi-récolte le
    29 juin + 49 jours, **lundi 17 août** : Kc 0,9 le 16 août, **0,7** le 17.
    Floraison du 3e bouquet au jour 30, mercredi 20 mai : Kc 0,6 le 19 mai,
    0,9 le 20.
16. **Ail à rebours** : dernière récolte en 2026-W28, dimanche 12 juillet
    2026 ; J-45, jeudi 28 mai : Kc 0,9 ; J-25, mercredi 17 juin : 0,6 ; J-20,
    lundi 22 juin : **0**, planche marquée « arrêt d'irrigation avant
    récolte ».
17. **Délai de levée** : pomme de terre plantée en 2026-W12 (lundi 16 mars
    2026), délai 25 jours, levée le vendredi 10 avril ; Kc 0,5 du 16 mars au
    29 avril ; **1,1** dès le jeudi 30 avril (levée + 20 j). Carotte du
    scénario 11, délai 10 jours : le passage à Kc 1 reste au 1er avril, son
    stade se comptant depuis le semis.
18. **Calendrier de l'asperge** : le 15 juillet, Kc 0,7 ; le 31 mai, 0,5 ; le
    20 septembre, pas de proposition ; une ETM existe le 15 juillet bien que
    la dernière récolte soit en mai (exception à D-022).
19. **Exception par série** : l'espèce Ail porte une série d'ail sec et une
    série d'aillet récoltées la même semaine ; dix jours avant cette récolte,
    l'ail sec a un Kc de 0, l'aillet suit l'oignon vert de la FAO et garde un
    Kc positif.
20. **Jeu de saison** : chou-fleur planté en 2026-W42 (lundi 12 octobre),
    jeu d'automne : Kc 1 dès le 11 novembre (J30), **1,3** dès le mardi
    16 mars 2027 (J155) ; planté en 2026-W14 (lundi 30 mars), jeu de
    printemps : Kc 1 dès le lundi 4 mai (J35), 1,3 dès le mardi 19 mai (J50).
21. **Espèce sans référence** : une planche de zinnia n'a pas d'ETM ; son
    objectif saisi reste seul ; la jauge de la 5 ter y est inconnue, la
    culture nommée.

### Sources de la relecture

FAO-56, tableaux 11 et 12, relus le 31 octobre 2026 ; Harrington, UC Davis,
via UCCE Sacramento GN 154 (https://oc4h.ucanr.edu/sites/default/files/2021-01/343966.pdf)
et Oregon State University Extension ; Université de l'Idaho, bulletin 789,
1997 ; Chambre d'agriculture du Rhône, *La pomme de terre*, 2013 ; bulletins
de santé du végétal Ail, Midi-Pyrénées et Occitanie, 2016-2026 ; CTEM, *Ail*,
2021 ; de Koning, thèse, Wageningen, 1994 (https://edepot.wur.nl/205947) ;
SUAMME, *Le haricot vert de plein champ*, 2012 ; CROPTIME, Oregon State,
2017 et 2020 ; Civam Bio 66, *Le melon charentais*, 2025 ; Utah State
University, 2020 ; Booij, *Netherlands Journal of Agricultural Science* 35,
1987 ; Université du Missouri, guide G 6369 ; Chambre d'agriculture PACA,
2018 ; cahier des charges de l'IGP Artichaut du Roussillon ; Chambre
d'agriculture des Bouches-du-Rhône, 2015, et de la Gironde, 2024. Le CRIIAM
Sud et les monographies du Ctifl n'ont pas pu être relus en accès libre.

## Réponses du porteur en cours de code, le 5 novembre 2026 (D-057)

En codant le domaine (PR 1), deux règles du contrat se sont révélées
contraires à l'intention du porteur ou ambiguës. Elles lui ont été posées une
à une, sur des cartes de décision, le 5 novembre 2026 au soir ; ses deux
réponses suivent l'option recommandée. Cette section prime sur le reste du
contrat là où ils diffèrent.

### 1. Un stade déclaré recale le calendrier (« Recaler le calendrier », 23 h 27)

Un stade déclaré commence le jour dit. Les stades suivants arrivent seuls :
décalés d'autant s'ils se comptent depuis la plantation ou la levée, à leur
date s'ils dépendent de la récolte (J-n, première récolte, mi-récolte) ou du
calendrier d'une culture pluriannuelle. Le contrat disait « le stade dure
jusqu'à la déclaration suivante » : une déclaration aurait figé la culture
dans son stade jusqu'à la suivante, et l'ail déclaré en formation du bulbe
n'aurait jamais atteint son arrêt d'irrigation avant récolte.

### 2. La culture reste jusqu'à la plus tardive de ses récoltes (« Jusqu'à la plus tardive des récoltes », 23 h 30)

Pour la 5 quater et la jauge de la 5 ter, la culture reste sur sa planche
jusqu'au dimanche de la plus tardive de ses semaines de récolte, réalisées ou
attendues. La mi-récolte et les dates J-n se comptent depuis ce dimanche. Le
contrat reprenait la règle du suivi par série (D-022 : la dernière semaine
réalisée, sinon la dernière attendue) : une tomate récoltée en juillet et
encore attendue jusqu'en octobre aurait quitté sa planche après sa dernière
semaine de récolte réalisée, en juillet. Le suivi par série garde sa règle.

### Précisions faites en codant

Dans le prolongement de ces deux réponses, le 5 novembre 2026. **Validées
par le porteur le 6 novembre 2026**, posées une par une en seize questions
(la 7 dédoublée), toutes tranchées sur la recommandation de l'assistant :
rien n'est recodé.

1. **Une déclaration vaut à partir de son jour** : avant, le stade calculé,
   ou la déclaration précédente, s'applique ; une déclaration datée dans le
   passé recalcule les ETM de ces jours-là, sans toucher aux irrigations ni
   aux cumuls réalisés (« Stade corrigé en arrière »).
2. **Un stade suivant dont la date est déjà passée au jour déclaré ne vient
   pas seul** : l'ail déclaré en formation du bulbe le 18 juin, après la date
   du grossissement maximal (J-25, le 17 juin), reste au Kc 0,9 jusqu'à J-20,
   qui garde sa date.
3. **Une correction** : pour un même stade, au même niveau (planche ou
   série), la dernière déclaration enregistrée remplace les précédentes, même
   si sa date est plus tardive ; entre stades différents, la plus récente par
   sa date fait foi, et à date égale la dernière enregistrée.
4. **La planche prime sur la série** : dès qu'une planche a une déclaration
   en vigueur, celles de la série ne valent plus pour elle.
5. **Une déclaration porte sa culture de référence** : elle ne vaut que pour
   elle ; une série à deux espèces se déclare espèce par espèce, et un
   rattachement changé laisse de côté les déclarations de l'ancien.
6. **Le trapèze de la FAO** : déclarer une phase déplace l'origine du
   trapèze, toutes les phases suivantes se décalent ; après la dernière
   phase, le Kc de fin vaut jusqu'à la récolte ; une phase de durée nulle
   (la fin de la fève) passe directement au point suivant.
7. **Le calendrier d'une culture pluriannuelle** : son dernier jour est
   compris ; une déclaration ne vaut que pour son cycle ; faite hors du
   calendrier, elle ouvre le cycle suivant dès son jour (une fin de récolte
   de l'asperge déclarée le 20 mai). La culture reste sur sa planche jusqu'à
   la fin du cycle qui contient sa dernière récolte, ou du cycle qui commence
   après elle la même année (l'asperge récoltée jusqu'en mai reste jusqu'au
   7 septembre) ; à défaut, jusqu'à sa dernière récolte. L'installation de
   l'artichaut, Kc 0,5 deux mois civils après la plantation, prime sur le
   calendrier ; un stade du calendrier déclaré y met fin.
8. **Le jeu de saison** se choisit selon le mois du jour 0, lundi de la
   semaine d'implantation.
9. **La proposition de la semaine** : une semaine sans aucune culture à Kc
   n'a pas de proposition ; une proposition partielle ne s'adopte pas, elle
   compterait pour zéro les jours qui manquent (D-003) ; l'adoption enregistre
   la proposition arrondie au dixième de millimètre ; l'écart en mm et en %
   et l'alerte d'écart ne se calculent que sur une proposition complète ; face
   à un objectif de 0, toute proposition positive est signalée.
10. **Un jour de planche** est bloqué si l'une de ses cultures l'est, inconnu
    si l'ET0 manque ; une culture sans ETM parmi d'autres le rend partiel.
11. **Le lissage**, désactivé par défaut, commence le jour du changement de
    stade et atteint le nouveau Kc le cinquième jour ; il ne s'applique
    jamais vers un Kc de 0, ni au trapèze, déjà en ligne droite.
12. **Le coefficient d'abattement** s'applique aux Kc de la FAO, pas aux
    surcharges de la ferme ; une surcharge vaut à partir de son jour, sans
    réécrire les jours d'avant (D-006).
13. **Le paillage « par saison »** est celui de l'année civile du jour.
14. **L'engrais vert** compte comme une planche sans culture pour la
    proposition ; la 5 ter lit son état de surface.
15. **L'avertissement d'aspersion** vaut au premier stade d'une table du
    CRIIAM, quand deux arrosages sont à trois jours ou moins l'un de l'autre.

### Scénarios ajoutés

22. **Levée déclarée** : la pomme de terre du scénario 17 déclarée levée le
    mercredi 15 avril au lieu du 10 : Kc 0,5 jusqu'au 4 mai, **1,1 dès le
    mardi 5 mai** ; J-30 et J-20 gardent leur date, l'arrêt avant récolte
    reste au 15 juin pour une récolte en 2026-W27.
23. **Reprise déclarée en retard** : la tomate du scénario 15 déclarée en
    reprise le dimanche 10 mai au lieu du 5 : la floraison du 3e bouquet
    arrive seule le **lundi 25 mai** au lieu du 20 ; la mi-récolte reste le
    17 août.
24. **Récoltes réalisées et attendues** : la tomate du scénario 15 récoltée
    de 2026-W27 à 2026-W30 et encore attendue jusqu'en 2026-W40 est toujours
    sur sa planche en 2026-W32 (Kc 0,9) ; sa mi-récolte reste le 17 août ; le
    suivi par série la dit finie le dimanche 26 juillet (D-022).

## Précisions faites en écrivant la persistance, le 6 novembre 2026

PR 2 du découpage (migration `0023_crop_water_need`, dépôts de
`db/crop-water/`, règles d'enregistrement dans
`lib/domain/crop-water/records.ts`). Elles prolongent le contrat sans rien
trancher à la place du porteur ; comme les précisions du domaine, elles
restent modifiables. Elles lui sont posées une par une à partir du
6 novembre 2026, pendant le code de l'écran, et **validées par lui le jour
même** (réponses ci-dessous).

1. **Le jeu commun** est écrit par la migration, avec l'adresse de la source,
   la date du relevé et la source des dates par défaut : les dix-sept légumes
   du CRIIAM, l'artichaut et le fraisier chacun en deux cultures
   (remontant et non remontant, « la ferme choisit le type » par la
   correspondance), soit dix-neuf ; et les treize cultures de la FAO-56 que la
   correspondance utilise : brocoli, céleri, concombre, crucifères (les
   choux), épinard, fève, navet, oignon vert, pastèque, patate douce, petit
   pois, potiron, radis. Les lignes de la FAO des légumes du CRIIAM ne sont
   pas écrites : le CRIIAM s'impose pour eux (« Quelle source pour quelle
   espèce »).
2. **Trois lectures du tableau de la FAO.** L'épinard prend la ligne
   « Méditerranée », 15 jours de pleine saison (le tableau du contrat
   disait « 15 à 25 », 25 étant la ligne « région aride »). Le navet prend
   les durées de la betterave potagère de la FAO : 15 / 25 / 20 / 10 d'avril
   à août, 25 / 30 / 25 / 10 de septembre à mars, ligne de février-mars, celle
   qui donne déjà le J80 de la betterave du CRIIAM. Le brocoli et les
   crucifères ont, comme le chou-fleur, le jeu de printemps (20 / 30 / 20 /
   10) de mars à août et le jeu d'automne (30 / 35 / 90 / 40) de septembre à
   février.
3. **Les délais de levée** sont ceux du tableau de la relecture ; une culture
   de la FAO que le tableau ne nomme pas a 0 jour, sans effet sur son Kc
   (le trapèze se compte depuis le jour 0). Le délai appartient à la culture
   de référence : le panais, rattaché à la carotte par analogie, prend ses
   10 jours au lieu de ses 19, sans effet sur le Kc, la carotte se comptant
   depuis le semis.
4. **Une ferme modifie une culture commune en enregistrant sa version** :
   dates, jeux de saison, délais de levée, calendrier, coefficient
   d'abattement. Sa version remplace la commune pour elle seule ; la retirer
   rend la commune. La source, la forme et les Kc d'une culture commune ne
   changent pas dans sa version : un Kc se change par une surcharge datée,
   la valeur d'origine restant lisible (« Le jeu de référence est une
   donnée »). Une culture saisie par la ferme, pour une espèce sans
   référence, est de source « saisie locale ».
5. **Une durée en degrés-jours** a sa place dans la base, mais une culture
   qui en porte une est rendue « inutilisable », la raison dite, tant que le
   calcul ne les connaît pas (« Hors périmètre »).
6. **Surcharges de Kc, stades déclarés et K_abri** sont des révisions datées
   que la base refuse de modifier ou d'effacer (D-006) ; une correction est
   une révision nouvelle. Un stade déclaré porte sa saison ; une surcharge et
   un K_abri valent pour la ferme, toutes saisons.
7. **La correspondance des espèces** n'est pas écrite par la migration : elle
   se rattache aux identifiants d'espèce d'Ouvre ta ferme de chaque ferme ; la
   table validée le 31 octobre 2026 sera saisie à l'écran (PR 3). Un
   rattachement nouveau remplace le précédent au même niveau, espèce ou
   série ; il ne vise qu'une culture de référence que la ferme connaît.
8. **Le paillage** se règle par planche et par année civile, le dernier
   réglage faisant foi ; **un filet d'ombrage** retiré garde ses dates ;
   **les options** de la ferme valent « désactivé » tant que rien n'est
   enregistré.
9. **L'ETM du jour** : une ligne par planche, jour et saison, remplacée quand
   l'ETM est recalculée, avec l'ET0 et sa nature, l'arrêt d'irrigation avant
   récolte et la trace de la culture retenue (la plus assoiffée ; à égalité,
   la première ; un jour inconnu garde la trace de la culture dont l'ET0
   manque). Une planche sans culture s'écrit 0, un jour inconnu ou sans ETM
   s'écrit sans valeur, jamais 0 (D-003). Un jour bloqué ne s'écrit pas : la
   dernière valeur valide reste.
10. **L'origine « proposition adoptée »** d'une révision d'objectif sera
    enregistrée avec l'adoption, par la PR de l'écran, qui ajoutera sa colonne
    à la table des objectifs.

### Réponses du porteur

Posées une par une, le 6 novembre 2026 :

- **1 sur 10, le jeu commun** : « Garder les 32 cultures » (09 h 12),
  l'artichaut et le fraisier restant en deux cultures chacun.
- **2 sur 10, les lectures du tableau de la FAO** : « Garder les trois
  lectures » (09 h 13) : épinard à 15 jours, navet aux durées de la
  betterave, brocoli et crucifères en jeux de printemps et d'automne.
- **3 à 10 sur 10** : à 09 h 14, le porteur se dit « d'accord avec toutes
  [les] recommandations » ; la carte 3 est close sur l'option recommandée
  (« Garder les deux règles » des délais de levée), et les précisions 4 à 10
  sont validées telles qu'elles sont écrites ci-dessus, chacune étant la
  recommandation de l'assistant. Rien n'est recodé.

## L'écran, PR 3a : la page « Coefficients culturaux », le 6 novembre 2026

Commencée sur le « vas-y » du porteur, en Opus 5.5 · Élevé. La page montre
les tables des cultures de référence de la ferme (le jeu commun, ou sa
version), la correspondance des espèces de la saison et la liste « sans
référence Kc ». Précisions faites en la codant :

1. **Les espèces à rattacher** sont celles des séries de la saison posées
   sur des planches. Une série en bloc n'a pas de planche (D-022, règle 3) et
   une série d'une autre saison n'est pas à rattacher pour celle-ci : leurs
   espèces n'y figurent pas.
2. **Une culture de référence inutilisable** (une valeur hors bornes, une
   durée en degrés-jours) se lit avec ses raisons mais ne se choisit pas : un
   rattachement vers elle ne donnerait aucune ETM, sans le dire.
3. **Rien n'est pré-rempli** : la correspondance d'une ferme se saisit à
   l'écran, espèce par espèce, et une exception par série. La table validée
   le 31 octobre 2026 pour la ferme du porteur se saisit à la recette, dans
   son navigateur et sur son « vas-y » (données de la ferme réelle).
   Posée au porteur le 6 novembre 2026 : « Je la saisis à la recette »
   (09 h 15), l'option recommandée ; pas de bouton de pré-remplissage.
   Relue par lui le jour même (09 h 41) sur une page de suggestions, une
   ligne par espèce : d'accord avec la table du 31 octobre 2026, sauf deux
   changements. L'aillet et l'allium ornemental suivent l'ail (Ail, CRIIAM) :
   l'espèce « Ail » n'a plus d'exception de série. Les chicorées frisée et
   scarole ne sont pas rattachées à la salade d'été sans vérification : il
   pense qu'elles se comportent autrement et demande une recherche
   documentaire dans des sources scientifiques ; elles restent non
   rattachées jusqu'à son résultat.
   La recherche (sources FAO-56, CRIIAM, tables publiées) donne aux
   chicorées les Kc de la laitue ; posée au porteur le jour même, il répond
   (10 h 15) : « si les chicorées, c'est le même coefficient que la laitue,
   on avance » ; elles suivent la salade d'été, par analogie.
   **Saisie faite le 6 novembre 2026** (10 h 15 à 10 h 20), dans son
   navigateur, sur son « vas-y » : ses 78 espèces sont rattachées et
   vérifiées après rechargement de la page. L'espèce « Ammi majus » de la
   table du 31 octobre n'existe pas dans ses espèces d'Ouvre ta ferme (78
   et non 79) ; « Lunaria » y porte le nom « Lunaria (monnaie-du-pape) ».
4. **La profondeur racinaire et la part utilisable p** de chaque culture
   s'ajouteront à cette page avec la 5 ter, qui les apporte en base.

## L'écran, PR 3b : la fiche de la planche, le 6 novembre 2026

Commencée dans la foulée de la 3a, en Opus 5.5 · Élevé. Sous le plan, la
planche choisie a son bloc « Besoin de la culture » : pour chaque culture,
le stade du jour, observé ou calculé, avec la date prévue du prochain
changement, le Kc, l'ETM et ce qui les a produits ; pour la semaine,
l'objectif proposé face à l'objectif applicable, leur écart en mm et en %,
les jours et les cultures qui manquent ; « Déclarer un stade » ; « Adopter
la proposition » ; les propositions déjà adoptées. Dans « Besoins
d'irrigation », « Voir le calcul » de chaque planche montre l'objectif
proposé juste sous l'objectif. L'origine « proposition adoptée » s'enregistre
dans la colonne `origin` que la migration additive `0024_adopted_goal_origin`
ajoute à la table des objectifs, et la base refuse toute autre valeur
(précision 10 de la persistance). Précisions faites en la codant :

1. **L'objectif applicable de la fiche** est lu par la règle même du besoin
   (`objectiveForBed`, D-034, D-039) : la fiche et « Besoins d'irrigation »
   ne peuvent pas montrer deux objectifs différents pour une même semaine.
2. **La proposition adoptée est recalculée par le serveur** au moment du
   clic, jamais reprise de l'écran : une page restée ouverte depuis la
   veille n'adopte pas une valeur périmée.
3. **Seule une semaine qui n'est pas finie s'adopte.** Une révision compte à
   partir de son jour de pose (D-034) : adoptée après le dimanche, elle ne
   compterait pour aucun jour. Une semaine à venir s'adopte, et ne vaut que
   pour elle.
4. **Un stade se déclare le jour où il est atteint, aujourd'hui ou avant**,
   pour la planche ou pour toute la série, et seulement pour une série posée
   sur cette planche. Le formulaire ne propose que les cultures de la fiche
   qui ont une culture de référence, avec les stades de sa table. Une
   correction est une déclaration nouvelle (D-057).
5. **La valeur « proposé » est placée dans « Besoins d'irrigation »**, sous
   l'objectif de chaque planche, plutôt que dans le planning de la semaine :
   c'est là que l'objectif de la planche se lit, et le planning ne montre
   que des apports. Elle reste une information : ni le besoin, ni l'écart,
   ni la faisabilité, ni le planning ne la lisent (D-010).
   Posée au porteur le 6 novembre 2026 : « Dans “Besoins d'irrigation” »
   (09 h 34), l'option recommandée ; pas de colonne dans le planning.
6. **La fiche de la série et l'avertissement de l'aspersion en début de
   cycle passent à la 3c**, avec les réglages : la 3b reste relisible.
   Puis à la 3d, la 3c ayant été découpée à son tour (voir ci-dessous).
7. **La ferme de démonstration porte des carottes en place le jour même**,
   sur V01, semées trois semaines plus tôt : sans culture en place, la fiche
   ne montrerait rien quel que soit le jour du parcours P15. Le parcours
   n'adopte pas la proposition — une adoption ne s'efface pas et les
   parcours partagent une base — ; l'adoption est prouvée par les tests de
   la base.

## L'écran, PR 3c : les surcharges de Kc et les réglages, le 6 novembre 2026

Commencée dans la foulée de la 3b, en Opus 5.5 · Élevé. Ce qui restait de
l'écran est découpé en deux PR pour rester relisible : la **3c**, les
surcharges de Kc et les réglages du calcul ; la **3d**, les durées propres
à la ferme, la fiche de la série, l'avertissement de l'aspersion en début de
cycle et l'ETM enregistrée chaque jour. Sur la page « Coefficients
culturaux », chaque culture de référence montre ses surcharges à côté des
valeurs de la source, avec un formulaire « Surcharger un Kc » ; une partie
« Réglages du calcul » regroupe les options, le K_abri de chaque abri, le
paillage plastique des planches de la saison et les filets d'ombrage. Les
dépôts de la persistance (#236) servent tels quels ; aucune migration.
Précisions faites en la codant :

1. **Les réglages sont sur la page « Coefficients culturaux »**, sous les
   cultures de référence, plutôt que sur une page à eux : tout ce qui règle
   le besoin de la culture se lit au même endroit.
2. **Une surcharge et un K_abri valent à partir du jour choisi**,
   aujourd'hui par défaut ; un jour passé est accepté. Les ETM depuis ce jour
   se recalculent ; aucun arrosage enregistré, aucun cumul réalisé n'est
   modifié (« Les garde-fous »).
3. **Revenir à la valeur de la source** est une surcharge nouvelle, sans
   valeur, datée elle aussi : l'histoire reste lisible, rien n'est effacé
   (D-006). Un K_abri revient à 0,80 par une révision à 0,80.
4. **Une culture de la FAO se surcharge par ses trois Kc** (début, pleine
   saison, fin) ; la valeur de la source y est montrée avant le coefficient
   d'abattement, et la valeur de la ferme le remplace (« Le jeu de référence
   est une donnée »). Une culture inutilisable ne se surcharge pas.
5. **Un abri est un jardin sous abri d'Ouvre ta ferme** pour la saison
   affichée, comme pour la pluie ; une planche de ce jardin prend son
   K_abri.
6. **Le paillage plastique** se coche planche par planche, jardin par
   jardin, et s'enregistre dès que la case change, pour la saison affichée
   (l'année civile, précision 8 de la persistance).
7. **Un filet d'ombrage se pose même quand l'option est désactivée** : il
   est gardé avec ses dates, et la page dit qu'il ne change pas le calcul
   tant que l'option reste désactivée. Un filet posé sans date de retrait se
   retire « aujourd'hui » : il compte jusqu'à ce jour compris.
8. **Chaque option dit ce qu'elle fait** : le lissage fait passer le Kc
   d'un stade au suivant en ligne droite sur cinq jours ; l'ombrage
   multiplie l'ETM par √(1 − taux), une hypothèse tirée des formules de
   serre, pas une norme.

### Réponses du porteur (PR 3c)

Posées une par une, le 6 novembre 2026 :

- **1 sur 3, la place des réglages** : « Sur la page des coefficients »
  (11 h 48) ; la précision 1 est gardée.
- **2 sur 3, un jour passé** : « Oui, un jour passé est accepté » (11 h 53) ;
  la précision 2 est gardée.
- **3 sur 3, un filet sans l'option** : « Oui, gardé sans effet »
  (11 h 53) ; la précision 7 est gardée. Rien n'est recodé.

## L'écran, PR 3d : l'ETM enregistrée chaque jour et l'aspersion en début de cycle, le 6 novembre 2026

Dans la foulée de la 3c, en Opus 5.5 · Élevé. Ce qui reste de l'écran est
découpé une dernière fois pour rester relisible : la **3d**, l'ETM
enregistrée chaque matin et l'avertissement de l'aspersion en début de
cycle ; la **3e**, la fiche de la série et les durées propres à la ferme.
Aucune migration : la table `irrigation_crop_etm_days` et la règle
`earlySprinklerWarning` existent depuis #235 et #236. Précisions faites en
la codant :

1. **L'ETM s'enregistre chaque matin, après la météo et le planning**, par
   l'appel interne qui synchronise la météo (`/api/internal/weather-sync`) :
   pour chaque ferme, chaque planche de la saison, aujourd'hui et les sept
   jours d'avant. Sept jours, parce que la réanalyse d'un jour arrive
   quelques jours après lui : l'ETM d'abord calculée sur la prévision
   enregistrée (« estimée ») est remplacée par celle de la réanalyse.
2. **Les jours à venir ne s'enregistrent pas** : leur prévision change
   chaque matin, et la fiche de la planche les calcule à la demande. Une
   ETM enregistrée est donc toujours celle d'un jour arrivé.
3. **Une saison est une année civile** : du 1er au 7 janvier, les jours de
   décembre restent à la saison d'avant et ne sont plus recalculés.
4. **Un échec d'une ferme n'arrête pas les autres** ; il est journalisé et
   compté à part dans la réponse de la synchronisation, comme le planning. La
   météo n'échoue pas pour autant.
5. **L'avertissement de l'aspersion** paraît dans la semaine de la fiche de
   la planche quand une aspersion est posée sur la planche pour la saison
   (un matériel stocké ne compte pas), qu'une de ses cultures est au premier
   stade d'une table du CRIIAM cette semaine-là, et que deux irrigations de
   la planche, quel que soit leur matériel et sans les annulées, sont à
   trois jours ou moins l'une de l'autre, de trois jours avant la semaine à
   son dimanche. Le Kc n'est pas modifié.


## L'écran, PR 3e : les durées propres à la ferme et la fiche de la série, le 6 novembre 2026

Dernière partie de l'écran, en Opus 5.5 · Élevé. Sur la page « Coefficients
culturaux », chaque culture du jeu commun a un formulaire « Régler les
durées de la ferme » ; dans la vue « Par série » de « Cumuls et
historique », la carte de chaque série montre la fiche de la série. Aucune
migration : la version de la ferme d'une culture commune existe depuis
#236 (« Le jeu de référence est une donnée »). Précisions faites en la
codant :

1. **Ce que la ferme règle** : les deux délais de levée, le début de
   chaque stade compté en jours (après l'implantation, après la levée,
   avant la dernière récolte), les durées des quatre phases de la FAO et le
   coefficient d'abattement, les jours de début et de fin d'un calendrier
   et les mois d'installation. La forme de la courbe, les Kc, les repères
   (un stade qui commence à la première récolte ou à la mi-récolte n'a pas
   de durée) et les mois des jeux de saison restent ceux du jeu commun ; un
   Kc se règle par une surcharge datée (PR 3c).
2. **Les durées de la ferme ne sont pas datées** : la version de la ferme
   remplace la culture commune pour tous les jours, passés compris, dans le
   calcul affiché. Les ETM déjà enregistrées ne changent que pour les sept
   derniers jours, recalculés chaque matin (PR 3d). Un arrosage enregistré
   ou un cumul réalisé n'est jamais modifié (« Les garde-fous »).
3. **Revenir aux durées communes** retire la version de la ferme ; des
   durées saisies égales à celles du jeu commun la retirent aussi : la
   carte dit alors « jeu commun ».
4. **Une durée changée par la ferme n'est plus « estimée »** : c'est la
   ferme qui la donne. Une durée inchangée garde sa marque. Sous chaque
   champ qui diffère, la valeur du jeu commun reste lisible.
5. **La fiche de la série est dans la carte de la série**, vue « Par
   série », calculée à l'ouverture de la carte : pour chaque planche de la
   série, le stade, le Kc et l'ETM du jour de ses cultures, l'ETM de la
   planche et les autres séries présentes ce jour-là.
6. **La proposition d'une planche couvre toutes ses cultures** : la fiche
   de la série la montre face à l'objectif applicable de la planche, mais
   elle s'adopte dans la fiche de la planche, où toutes ses cultures se
   lisent.
7. **Un stade déclaré depuis la fiche de la série vaut pour toute la
   série**, sur chacune de ses planches ; pour une seule planche, il se
   déclare dans la fiche de la planche.
8. **Une culture saisie par la ferme** (ses propres Kc par stade, pour une
   espèce sans référence, « La correspondance ») **n'a pas encore son
   formulaire** : les 78 espèces de la ferme sont rattachées, et la base
   l'accepte déjà (source « saisie locale »).

### Réponses du porteur (PR 3e)

Posées une par une, le 6 novembre 2026 ; rien n'est recodé :

- **1 sur 3, des durées non datées** : « Oui, pour toute la saison »
  (13 h 35) ; la précision 2 est gardée.
- **2 sur 3, où adopter la proposition** : « Seulement dans la fiche de la
  planche » (13 h 35) ; la précision 6 est gardée.
- **3 sur 3, une culture saisie par la ferme** : « Plus tard, à la
  demande » (13 h 37) ; la précision 8 est gardée, le formulaire sera fait
  quand une espèce en aura besoin.

## Recette réelle, le 6 novembre 2026

Faite sur le « vas-y » du porteur, en lecture seule, puis, sur son accord,
quatre gestes d'écriture éprouvés dans le module et défaits aussitôt : voir
`docs/recette-5-quater.md`. Les constats sont de l'assistant ; le jugement
reste au porteur (D-014).

## Retours de visite du porteur, 7 novembre 2026 (3.8, P41 et P42)

1. **Le dessin de l'espèce à côté du nom** (« les petites illustrations
   qu'il y a sur Ouvre ta ferme ») : chaque culture de référence de « Besoin
   par culture » et chaque espèce des réglages porte le dessin d'Ouvre ta
   ferme, quand il en a un. Ouvre ta ferme les range dans un fichier public,
   sans clé, hors de son API (`plants.svg`, un symbole par `fqn` d'espèce,
   183 au 7 novembre 2026). Le module ne le copie pas : sa route
   `/irrigation/especes.svg` le lit chez Ouvre ta ferme (gardé quinze jours
   au bord du réseau, comme Ouvre ta ferme le demande à un navigateur, soit
   au plus une lecture par quinzaine et par point de présence), ne garde que
   les symboles que la page demande et seulement s'ils ne portent que des
   formes (une liste fermée de balises et d'attributs : ni script, ni lien,
   ni `url(`), et les sert avec une politique de contenu qui n'y laisse
   courir aucun script. La page les appelle par `<use>`.
   - Une culture de référence a son dessin par une table (« Salade d'été »
     → laitue, « Crucifères » → chou blanc), une espèce par son nom écrit
     comme un `fqn` ; seul un symbole relevé dans le fichier est appelé.
   - Sans dessin, ou si le fichier ne se lit pas (la route répond 503), la
     culture s'affiche sans, comme avant : rien ne bloque la page.
   - Les noms des symboles sont relevés dans `lib/domain/crop-water/plant-vignettes.ts` ;
     un dessin ajouté plus tard chez Ouvre ta ferme s'y ajoute.
   - Avec les données de démonstration (développement, parcours navigateur),
     la route ne lit rien chez Ouvre ta ferme : elle sert une feuille verte
     pour chaque symbole demandé (`lib/services/plant-sprite-service.ts`).
2. **Le K_abri a son « ? »** (« il faut un point d'interrogation pour
   expliquer ce que ça fait »), à côté du titre « K_abri, par abri » des
   réglages du calcul : ce qu'il fait (la bâche filtre une partie du soleil
   et coupe le vent, le besoin de chaque planche de l'abri est multiplié par
   lui), la valeur par défaut (0,80 du CRIIAM, 0,60 à 0,70 pour un tunnel
   bien ventilé, réglage de 0,60 à 1), un exemple chiffré (5 mm en plein
   champ, 4 mm à 0,80, 3,5 mm à 0,70), et quand le changer (planches d'un
   abri trop humides ou trop sèches avec les propositions ; la valeur vaut à
   partir du jour choisi).

Ne changent pas : les calculs, les bornes, D-053, D-057.
