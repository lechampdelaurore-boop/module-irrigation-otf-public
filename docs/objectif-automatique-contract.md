# Contrat court — l'objectif automatique : l'objectif de la semaine suit l'ET0 (6 decies)

Écrit le 24 novembre 2026, sans code, sur la demande du porteur du jour
(13 h 25, heure de Paris) : « Normalement, avec la météo, tu arrives à
calculer l'ET0. Je pense qu'il faudrait qu'il y ait un bouton pour que on
puisse, par défaut, régler les objectifs de la semaine sur l'ET0. Et qu'on
le modifie si besoin. »

Contrat écrit en Fable 5.2 · Élevé, **par exception expresse du porteur
pour ce seul fil** ; D-055 reste la règle, et le code se fait dans un autre
fil, jamais en Fable.

**Ce contrat change une règle métier.** Depuis le 18 septembre 2026, l'ET0
est une information, jamais un terme du besoin (D-010). Le 30 octobre, le
besoin par culture (ETM) est devenu un objectif **proposé**, adopté par un
geste (D-045) ; le 31 octobre, le porteur a écarté le mode automatique, à
reconsidérer « après une saison de comparaison, par une décision nouvelle »
(D-054, `docs/crop-water-need-contract.md`, « Le mode automatique »). Les
choix du 24 novembre ci-dessous sont cette décision nouvelle (D-309), prise
avant la saison de comparaison : la contradiction avec D-054 a été signalée
au porteur le jour même (question 5 ci-dessous).

## 1. Les choix du porteur (24 novembre 2026, heure de Paris)

Sur des cartes de décision, une question par message.

| N° | Question | Choix du porteur | Heure |
| --- | --- | --- | --- |
| 1 | Ce que fait le bouton | **L'objectif suit l'ET0 tout seul** (mode automatique), contre la recommandation de l'assistant (un bouton qui préremplit, validé à la main) | 13 h 30 |
| 2 | Quand l'objectif suit l'ET0 | **Mis à jour chaque matin** | 13 h 32 |
| 3 | Sous abri | **L'ET0 corrigée par l'abri** (ET0 × K_abri de l'abri) | 13 h 33 |
| 4 | Quand le besoin de la culture est connu | **Le besoin de la culture, sinon l'ET0** | 13 h 35 |
| 5 | Maintenir ce mode, écarté le 31 octobre (D-054) | **question posée à 13 h 43, réponse attendue** ; aucun code de ce contrat avant elle | — |

Deux garde-fous posés par l'assistant en cadrant, annoncés au porteur :

- **éteint tant que la ferme ne l'allume pas** : aucune ferme ne change sans
  son geste (D-028) ;
- **un objectif saisi passe toujours avant** l'objectif automatique.

## 2. Ce qui ne change pas

- Réglage éteint, rien ne change : le besoin part de l'objectif saisi seul,
  l'ET0 et l'objectif proposé restent des informations (D-010, D-045).
- Réglage allumé, l'ET0 n'entre que par l'objectif. L'écart reste
  « objectif − (irrigation réelle + pluie réelle) » ; il n'y a toujours pas
  de bilan hydrique, et la réserve du sol reste une information (D-041,
  D-047).
- Le calcul de l'ETM, ses coefficients, ses bornes et ses garde-fous
  (`docs/crop-water-need-contract.md`) : lus, jamais changés.
- La pluie comptée (D-019), la pénurie (3.9), les priorités, la faisabilité
  et la règle du planning : ils lisent l'objectif applicable, comme avant.
- Une irrigation planifiée ou validée n'est jamais réécrite par un objectif
  qui bouge (`docs/planning-contract.md`, « Le cycle »).
- Inconnu n'est jamais zéro (D-003) ; observé, estimé et prévu ne se
  confondent pas (D-006) ; un historique ne bouge plus (D-006, D-039).

## 3. La règle

**Cause établie dans le code.** L'objectif applicable d'une planche vient
d'une seule fonction, `objectiveForBed` (`lib/domain/irrigation-needs.ts`) :
jour par jour, la révision saisie la plus précise qui couvre la planche
(planche, puis jardin, puis parcelle, puis ferme) apporte un septième de sa
valeur ; un jour sans révision n'apporte rien. Le tableau des besoins,
l'historique, les séries, le planning, la faisabilité, l'écart et la page
« Aujourd'hui » lisent tous cette fonction. L'ET0 du jour et l'ETM du jour
existent déjà (`lib/domain/crop-water/proposal.ts`, `bedWaterDays`), avec
leur nature et leurs jours manquants.

**Règles.**

1. **Le réglage.** Une ferme a un réglage « Objectif automatique », éteint
   au départ. L'allumer ou l'éteindre est un geste daté, écrit au journal
   des modifications. Il compte **à partir de son jour**, en heure de Paris,
   comme une révision d'objectif (D-034) : les jours d'avant gardent ce
   qu'ils avaient.
2. **La priorité.** Un jour où une révision saisie couvre la planche, à
   n'importe quel niveau, c'est elle qui compte. L'objectif automatique ne
   remplit que les jours **sans objectif saisi**. Une ferme qui a un
   objectif de ferme doit donc le vider pour que l'automatique s'applique :
   l'écran le dit et propose le geste, il ne le fait jamais seul.
3. **La valeur d'un jour**, pour une planche de la saison :
   - si « Besoin par culture » est coché et que l'ETM du jour de la planche
     est calculée : **l'ETM du jour** (choix 4) ;
   - si « Besoin par culture » est coché et que la planche ne porte aucune
     culture ce jour-là : **0**, elle n'a rien à nourrir (la règle de
     l'objectif proposé) ;
   - sinon, c'est-à-dire case décochée, ou ETM du jour non calculable
     (espèce sans culture de référence, stade inconnu, calcul bloqué) :
     **l'ET0 du jour**, multipliée par le **K_abri** de l'abri quand le
     jardin est sous abri (choix 3) ;
   - si l'ET0 du jour est inconnue : **le jour n'a pas de valeur**. La
     semaine est dite incomplète et nomme ses jours ; aucun jour inconnu
     n'est compté pour zéro en silence, aucun n'est inventé.
4. **La semaine.** L'objectif de la semaine d'une planche est la somme de
   ses sept jours : le septième de l'objectif saisi les jours qu'il couvre,
   la valeur automatique les autres jours. Son origine se dit : « saisi »,
   « automatique » ou « les deux ». Une planche sans culture de toute la
   semaine, case « Besoin par culture » cochée, n'a pas d'objectif
   automatique.
5. **Chaque matin** (choix 2). Rien n'est enregistré jour après jour : la
   valeur se relit depuis la météo enregistrée. Les jours passés prennent
   l'ET0 du passé, les jours à venir l'ET0 prévue ; la synchronisation de
   6 h 15, puis le recalcul quotidien du plan, donnent l'objectif du matin.
6. **Une semaine finie ne bouge plus.** L'objectif automatique d'une
   semaine close est enregistré par planche, avec ses jours par nature
   d'ET0, et l'historique lit cet enregistrement : relire la météo, corriger
   un Kc ou un stade après coup ne change pas une semaine close.
7. **Une seule règle, un seul endroit.** `objectiveForBed` reçoit la source
   automatique ; aucun lecteur ne recalcule de son côté.

**Cas chiffrés.** Semaine du lundi au dimanche, ET0 des sept jours :
4,0 · 4,2 · 3,8 · 4,5 · 5,0 · 4,6 · 3,9 mm, soit 30,0 mm. Réglage allumé
depuis une semaine antérieure, sauf mention.

| Cas | Planche | Objectif de la semaine | Origine dite |
| --- | --- | --- | --- |
| 1 | plein champ, « Besoin par culture » décoché, aucun objectif saisi | 30,0 mm | automatique, ET0 |
| 2 | sous abri, K_abri 0,8, même ferme | 24,0 mm | automatique, ET0 sous abri (× 0,8) |
| 3 | plein champ, ETM calculée, Kc 0,7 toute la semaine, sans paillage ni ombrage | 21,0 mm | automatique, besoin de la culture |
| 4 | plein champ, une espèce sans culture de référence | 30,0 mm | automatique, ET0 faute de besoin connu |
| 5 | objectif de ferme saisi, 20 mm | 20,0 mm | saisi ; l'écran dit que la planche garde son objectif saisi |
| 6 | objectif de planche de 20 mm, vidé le jeudi | 3 × 20 / 7 + (4,5 + 5,0 + 4,6 + 3,9) = 26,6 mm | les deux |
| 7 | réglage allumé le mercredi, aucun objectif saisi | 3,8 + 4,5 + 5,0 + 4,6 + 3,9 = 21,8 mm | automatique, à partir du mercredi |
| 8 | cas 1, ET0 du dimanche inconnue | 26,1 mm, « incomplet : 1 jour sans ET0 » | automatique, ET0 |
| 9 | « Besoin par culture » coché, aucune culture de la semaine | pas d'objectif | « pas de culture cette semaine » |
| 10 | culture plantée le jeudi, Kc 0,5 | 0,5 × 18,0 = 9,0 mm | automatique, besoin de la culture |
| 11 | réglage éteint | l'objectif saisi, ou aucun | comme aujourd'hui |
| 12 | cas 1, le mardi matin la prévision du vendredi passe de 5,0 à 6,0 mm | 31,0 mm | automatique, ET0 |

## 4. Livraison en quatre PR, une à la fois

| PR | Objet | Fichiers principaux | Preuve |
| --- | --- | --- | --- |
| O1 · La règle | la valeur du jour et la somme de la semaine, sans écran ni stockage : réglage toujours éteint, rien ne change | `lib/domain/irrigation-needs.ts` (`objectiveForBed`), un module nouveau du domaine, `lib/domain/crop-water/proposal.ts` (lu) | tests du domaine : les douze cas |
| O2 · Le réglage et ses lecteurs | le réglage par ferme, daté ; tous les lecteurs de l'objectif reçoivent la source automatique ; journal des modifications | une migration, `db/`, les services des besoins, du planning, de l'historique, des séries, de la faisabilité, de l'écart et d'« Aujourd'hui » | tests de persistance à deux fermes ; aucun écran ne l'allume encore |
| O3 · Les semaines closes | l'enregistrement de l'objectif automatique d'une semaine finie, par la tâche du matin, rattrapé si elle a manqué ; l'historique le lit | migration, tâche du matin, `lib/domain/irrigation-history/` | test : un Kc corrigé ou une météo relue ne change pas une semaine close |
| O4 · Les écrans | le réglage dans le volet « Objectifs de la semaine », l'origine dite partout, la ligne de « Fiabilité du calcul », les aides | `app/irrigation/water-management-dashboard.tsx`, `irrigation-needs-dashboard.tsx`, `app/irrigation/today/`, planning, historique, `lib/domain/objective-reading.ts`, `lib/domain/features/help.ts` | parcours nouveau aux deux largeurs : allumer, lire l'origine, saisir un objectif qui passe avant, éteindre |

Ordre : O1, O2, O3, puis O4. Le réglage ne devient visible qu'avec O4,
quand la règle, les lecteurs et les semaines closes sont en ligne.

Code : règle du besoin, persistance et planificateur, Opus 5.5 · Max
recommandé pour O1 à O3, Opus 5.5 · Élevé pour O4 ; le coordinateur tranche
à la lecture de la ligne de la roadmap.

La PR O1 corrige les deux phrases d'`AGENTS.md` qui portent D-010 et D-045,
`docs/irrigation-needs-contract.md` et la section « Le mode automatique » de
`docs/crop-water-need-contract.md` : tant qu'elle n'est pas fusionnée, ces
textes disent vrai du code.

## 5. Les écrans (O4)

1. Le réglage vit dans le volet « Objectifs de la semaine » de « Objectifs
   et besoins », là où mène la tuile « Objectif de la semaine »
   d'« Aujourd'hui » (`docs/aujourdhui-liens-contract.md`, L1). Il dit en
   une phrase ce qu'il fait : « Sans objectif saisi, l'objectif d'une
   planche suit chaque matin le besoin de sa culture, ou l'ET0 quand ce
   besoin n'est pas connu. »
2. En l'allumant, l'écran compte les planches qui gardent un objectif saisi
   et propose « Vider les objectifs », le geste existant.
3. Partout où un objectif se lit (tableau des besoins, tuile et lignes
   d'« Aujourd'hui », planning, historique), son origine se lit aussi :
   saisi, automatique d'après la culture, automatique d'après l'ET0,
   automatique d'après l'ET0 sous abri, ou les deux. La bulle d'origine
   donne les jours par nature d'ET0 (passé, estimé, prévu).
4. Une planche dont l'objectif automatique est déjà le besoin de la culture
   ne propose plus « Adopter la proposition » : elle l'applique déjà.
5. « Fiabilité du calcul », réglage allumé : une ligne « Objectif
   automatique » dit les jours sans ET0 et mène à la météo ; une espèce
   sans culture de référence reste dite par la ligne « Espèces ».

## 6. Précisions proposées

| Sujet | Option recommandée |
| --- | --- |
| Où vit le réglage | par ferme, un seul ; pas par planche ni par série : l'objectif saisi fait déjà l'exception |
| Part de l'ET0 | 100 % ; pas de pourcentage réglable : un objectif saisi sert à s'en écarter |
| Planche sans culture, « Besoin par culture » coché | 0 ce jour-là, pas d'objectif si la semaine entière est sans culture ; la règle de l'objectif proposé |
| ETM d'un jour partiellement connue (une culture sur deux) | l'ET0 du jour pour toute la planche, jamais une demi-ETM |
| K_abri quand « Besoin par culture » est décoché | la valeur enregistrée de l'abri, sinon la valeur par défaut ; l'écran la dit (à confirmer en codant : où elle se règle alors) |
| Semaine close avant l'arrivée de la réanalyse des derniers jours | enregistrée le lundi matin avec les natures connues ce matin-là, dites dans la bulle |
| Tâche du matin manquée | la suivante rattrape les semaines closes non enregistrées ; d'ici là l'historique dit « provisoire » |
| Démonstration | le réglage y reste éteint ; l'allumer dans un profil de démonstration est une décision à part |

## 7. Ce que le contrat ne prouve pas

- Qu'un objectif égal à l'ET0 ou à l'ETM convient à une ferme : c'est le
  choix de la ferme qui allume le réglage, et l'objectif proposé reste
  affiché à côté pour comparer.
- Le coût de calcul sur une grande ferme : l'ETM de chaque planche est lue
  par tous les lecteurs de l'objectif ; à mesurer en O2, sans requête de
  plus vers Ouvre ta ferme.
- Le planning de la semaine suivante : l'ET0 prévue n'y couvre pas toujours
  les sept jours ; l'objectif y est alors incomplet et le dit (cas 8).
