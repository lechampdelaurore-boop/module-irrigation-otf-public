# Contrat court — audit ergonomique du 19 novembre 2026, lot H : « Aujourd'hui » dit vrai (24 sexdecies)

Écrit le 19 novembre 2026, avant tout code, en Opus 5.5 · Élevé (la ligne
24 sexdecies de la roadmap), après le lot G (24 quindecies). Il couvre les
constats **n° 3, n° 4, n° 2, n° 14 et n° 13** du rapport
`audit-ergonomie-2026-11-19.md`, retenus par le porteur le 19 novembre 2026
à 11 h 39. Le n° 2 change le contrat de la page « Aujourd'hui » validé le
8 novembre (`docs/aujourdhui-tableau-de-bord-contract.md`, D-074) : ce
changement est compris dans le choix n° 1 du rapport, que le porteur a
retenu. Le porteur est en autonomie totale depuis 11 h 44 : chaque
précision ci-dessous, aucune agronomique, suit l'option recommandée du
rapport et reste modifiable par lui. **Aucune règle de calcul ne change** :
ni le besoin, ni la pluie comptée (D-019), ni le reste à apporter (D-010),
ni la jauge du sol ; aucune migration. Logiciel multi-fermes : les règles
visent une situation, jamais une ferme.

Registres : décisions **D-173 et suivantes**, précisions **F429 et
suivantes**, parcours **P38** (P37 est le dernier).

## 1. Livraison en cinq PR, une à la fois

| PR | Point | Fichiers principaux | Preuve |
| --- | --- | --- | --- |
| 1 · La pluie dit d'où elle vient | n° 3 | `lib/domain/irrigation-needs.ts` (origine des jours déjà lue), `lib/domain/today/week.ts`, `app/irrigation/today/today-gauges.tsx` | tests du domaine, P38 |
| 2 · Les jardins qui comptent | n° 4 | `lib/domain/today/week.ts`, `lib/domain/today/soil.ts`, `docs/aujourdhui-tableau-de-bord-contract.md` (T9) | tests du domaine, P38 étendu |
| 3 · En cours et reliquat | n° 2 | `lib/domain/today/today-irrigations.ts`, `day-plan.ts`, `headline.ts`, `all-done.ts`, `app/irrigation/today/today-day.tsx`, le contrat d'« Aujourd'hui » | tests du domaine, P38 étendu (390 et 1440 px) |
| 4 · L'ordre naturel partout | n° 14 | les tris par nom du code, la liste « Matériel » d'« Arrosages » | test de garde sur les tris, P38 étendu |
| 5 · Petits défauts de lecture | n° 13 | `app/irrigation/today/`, `lib/domain/today/`, « Historique » pour le reste de R2 | tests du domaine, P38 étendu |

Chaque PR : `lint`, `typecheck`, `test`, `build`, `knip`, `push:check`,
`weather:check`, `site:check` collés ; `e2e` joué en local sur les
parcours touchés, la suite complète par la CI de la PR ; registres dans la
même PR. L'ordre suit le gain sur l'effort : deux petites corrections
fortes d'abord, puis le changement de contrat, puis le reste.

## 2. Ce qui ne change pas

Le moteur, le planificateur, les objectifs, la pluie comptée pour un jour
passé (pluviomètre, sinon réanalyse, sinon prévision : D-019, une question
d'agronomie hors de ce lot), le reste à apporter, la jauge du sol ; les
gestes de démarrage, d'arrêt et de reprise, qui restent ceux
d'« Arrosages » (D-028) ; les autres pages, sauf l'ordre des noms (n° 14)
et le libellé de portée d'« Historique » (n° 13, reste de R2).

## 3. n° 3 — La pluie dit d'où elle vient (PR 1)

**Cause établie dans le code.** Pour un jour passé, la pluie comptée est
celle du pluviomètre, sinon la réanalyse, sinon la prévision enregistrée
(`irrigation-needs.ts`, D-019). La tuile « Eau reçue » écrit « de pluie
mesurée » dans tous les cas (`today/week.ts`), et la légende d'« Eau de la
semaine » dit « Pluie mesurée » (`today-gauges.tsx`).

1. Le tableau des besoins expose, pour la semaine écoulée jusqu'à
   aujourd'hui, la pluie extérieure par origine : **mesurée** (pluviomètre),
   **estimée après coup** (réanalyse), **prévue** (prévision reprise pour un
   jour passé). La somme des trois est la pluie déjà comptée : rien ne
   change dans le calcul.
2. La tuile « Eau reçue » le dit : « 30,7 mm de pluie prévue, non
   mesurée » quand tout vient de la prévision ; « 12 mm de pluie mesurée »
   quand tout vient du pluviomètre ; « 8 mm de pluie estimée après coup »
   pour la réanalyse seule ; mêlée, « 30,7 mm de pluie, dont 12 mm mesurés
   et 18,7 mm prévus » (les seules origines présentes, dans l'ordre
   mesurée, estimée, prévue). Une ferme dont toutes les planches sont sous
   abri garde « 0 mm de pluie, sous abri ».
3. La légende d'« Eau de la semaine » nomme les mêmes origines : « Pluie
   mesurée », « Pluie estimée après coup », « Pluie prévue, non mesurée »,
   ou mêlées, « Pluie mesurée et prévue » ; « Pluie » seule sans origine
   connue.
4. Le mot « mesurée » n'est plus écrit sur « Aujourd'hui » pour une pluie
   qui ne vient pas du pluviomètre ; un test de garde le vérifie sur les
   textes du domaine.

## 4. n° 4 — Les jardins qui comptent (PR 2)

**Cause établie dans le code.** « Eau de la semaine » et « Réserve du sol »
gardent les huit premiers jardins de la liste (`today/week.ts`,
`today/soil.ts`) ; le contrat (T9) dit « huit » sans dire lesquels.

1. **« Eau de la semaine »** montre d'emblée, dans cet ordre : les jardins
   qui ont une irrigation aujourd'hui (en cours, planifiée ou à valider,
   par l'une de leurs planches) ; puis ceux qui ont un objectif, du plus
   loin de leur objectif au plus près (reste à apporter rapporté à
   l'objectif, puis le reste en mm) ; puis ceux sans objectif ; à égalité,
   l'ordre naturel. Toujours huit au plus.
2. **« Réserve du sol »** montre d'emblée : les jardins qui ont une
   irrigation aujourd'hui, puis les plus secs (le plus petit %), puis les
   « inconnue », puis « aucune planche cultivée » ; à égalité, l'ordre
   naturel.
3. Les jardins derrière « Voir les n autres jardins » sont rangés dans
   l'ordre naturel (« bloc 2 » avant « bloc 10 »).
4. T9 du contrat d'« Aujourd'hui » est réécrite en conséquence.

## 5. n° 2 — En cours et reliquat (PR 3, change le contrat de la page)

**Cause établie dans le code.** La page ne connaît que quatre états :
manqué, en retard, planifié, proposé (`today/today-irrigations.ts`). Une
irrigation dont le minuteur tourne ou est en pause, et le reliquat d'une
irrigation partielle encore planifié, n'y apparaissent pas : la page dit
« Rien à arroser » vanne ouverte.

1. **En tête de « Votre journée »**, avant les retards, une ligne par
   irrigation **en cours** : « En cours · Goutte-à-goutte de l'abri ·
   Réglage 1 — depuis 9 h 40, fin prévue à 13 h 50 », « En pause depuis
   10 h 05 » pour une pause, « Durée atteinte : fermer la vanne » quand le
   minuteur attend sa confirmation. Son geste est un lien « Arrêter /
   Terminer », qui ouvre la carte de l'irrigation sur « Arrosages » : le
   geste d'arrêt, avec sa durée réelle à confirmer, reste là-bas (D-028).
2. Une ligne par **reliquat à reprendre** : « Reliquat à reprendre ·
   Goutte-à-goutte B · 1,3 m³ » (ou en mm sans surface mouillée connue),
   avec « Reprendre le reliquat », le même geste qu'« Arrosages », et le
   lien vers sa carte. Un reliquat annulé n'y est plus.
3. La phrase du jour, les pastilles et l'en-tête comptent ces lignes :
   jamais « Rien à arroser » ni « Rien à faire aujourd'hui » quand une
   irrigation est en cours ou qu'un reliquat attend. « Tout est fait » ne
   les coche jamais (T15 inchangée).
4. Le contrat d'« Aujourd'hui » gagne ces deux états dans sa section 3.2
   et ses précisions.

## 6. n° 14 — L'ordre naturel partout (PR 4)

**Cause établie dans le code.** L'ordre naturel existe
(`lib/domain/bed-order.ts`) mais ne sert qu'à une partie des tris par nom.

1. Chaque tri d'un nom affiché (planche, jardin, parcelle, matériel,
   réglage, culture) passe par `compareNamesNaturally` ; un test de garde
   refuse un `localeCompare` sur un nom affiché hors de cette règle.
2. La liste « Matériel » des formulaires d'« Arrosages » est regroupée par
   jardin : le jardin où le matériel est posé, ou le nom du groupe de
   jardins pour un matériel posé sur un groupe, « Sans jardin » en dernier
   quand le jardin n'est plus connu ; les groupes et les matériels dans
   l'ordre naturel.
4. Restent hors de cette règle les tris du moteur du planning
   (`engine.ts`, `demand.ts`, `protected-slots.ts`) : ils fixent l'ordre
   du calcul, jamais un affichage, et les changer changerait des plans.
3. Les planches d'une carte du planning suivent l'ordre naturel, comme sur
   « Aujourd'hui ».

## 7. n° 13 — Petits défauts de lecture (PR 5)

1. **La page se relit seule** : toutes les cinq minutes tant qu'elle est
   à l'écran, et au retour sur l'onglet quand sa dernière lecture a plus
   d'une minute ; jamais pendant qu'une fenêtre ou un formulaire de la page
   est ouvert.
2. **« Reste à apporter »** dit pour qui : quand une partie seulement des
   jardins qui ont un objectif reste en dessous, « pour les jardins encore
   sous leur objectif : T1, T2, T3 et T4 » (trois noms au plus, puis « et
   n autres »), à la place de « objectif moins l'eau reçue, jamais
   négatif ».
3. La tuile « Reste à apporter » garde la couleur neutre des autres
   tuiles : c'est une quantité, pas une alerte.
4. L'heure d'une carte ne se coupe plus sur deux lignes au téléphone.
5. Une proposition porte l'icône de son matériel (goutte-à-goutte ou
   aspersion), lue dans la liste des matériels de la ferme ; l'icône neutre
   seulement quand le matériel n'y est plus.
6. Les phrases : « 3 irrigations à valider aujourd'hui » quand toutes sont
   à valider (jamais « dont 3 » sur 3) ; « irrigation » partout, jamais
   « arrosage » pour la même chose dans la même phrase ; « 15 / 26,7 mm
   (5 planches de 10 ont un objectif) », sans deux « sur ».
7. **Reste de R2** : la cause de l'écart entre « Objectif de la semaine »
   d'« Aujourd'hui » et « Objectif » d'« Historique » est d'abord établie
   dans le code ; la correction porte sur le libellé de portée (F280), pas
   sur le calcul. **Cause établie le 19 novembre 2026**
   (`lib/domain/irrigation-history/summary.ts`) : « Historique » divise par
   la surface de toutes les planches, celles sans objectif comptées à 0 ;
   « Aujourd'hui » chiffre les seules planches qui ont un objectif (F280).
   « Historique » le dit désormais sous son chiffre : « Moyenne sur toute
   la surface, les planches sans objectif comptées à 0 ».

## 8. Tests et preuves

Tests du domaine pour chaque règle (origine de la pluie, rangement des
jardins, lignes en cours et reliquat, phrases). Parcours **P38**
« Aujourd'hui dit vrai », à 390 et 1440 px, sur la démonstration : la pluie
prévue dite prévue ; un jardin à arroser aujourd'hui montré d'emblée ; une
irrigation démarrée lue en tête de « Votre journée », arrêtée en route, son
reliquat lu puis annulé ; la liste « Matériel » regroupée et dans l'ordre
naturel ; puis la remise en état.

## 9. Risques

- Les jours d'une semaine sans pluviomètre ni réanalyse disent « prévue,
  non mesurée » presque toute la semaine : c'est vrai, et c'est le but.
- La relecture toutes les cinq minutes ajoute une lecture de la base par
  onglet ouvert ; elle s'arrête quand l'onglet est caché.
- Le n° 14 touche beaucoup de fichiers sans changer de comportement hors
  de l'ordre : le test de garde et la suite complète des parcours le
  couvrent.

## 10. Précisions

- **F429** la pluie dit d'où elle vient, sur la tuile et la légende ; le calcul ne change pas (section 3).
- **F430** « Eau de la semaine » : les jardins qui ont une irrigation aujourd'hui, puis les plus loin de leur objectif (section 4.1).
- **F431** « Réserve du sol » : les jardins qui ont une irrigation aujourd'hui, puis les plus secs, puis les inconnus (section 4.2).
- **F432** les jardins repliés dans l'ordre naturel ; T9 réécrite (sections 4.3 et 4.4).
- **F433** une irrigation en cours, en pause ou à confirmer, en tête de « Votre journée » (section 5.1).
- **F434** le reliquat à reprendre, avec « Reprendre le reliquat » (section 5.2).
- **F435** la phrase du jour, les pastilles et l'en-tête comptent l'en-cours et le reliquat (section 5.3).
- **F436** l'ordre naturel pour chaque nom affiché, gardé par un test (section 6.1).
- **F437** la liste « Matériel » regroupée par jardin (section 6.2).
- **F438** la page se relit seule (section 7.1).
- **F439** « Reste à apporter » dit pour quels jardins (section 7.2).
- **F440** la tuile « Reste à apporter » en couleur neutre (section 7.3).
- **F441** l'heure d'une carte d'un seul tenant (section 7.4).
- **F442** l'icône d'une proposition, celle de son matériel (section 7.5).
- **F443** les phrases du jour : un seul mot, pas de « dont 3 » sur 3, un seul « sur » (section 7.6).
- **F444** l'objectif d'« Historique » dit sa portée (section 7.7).

Ce que le lot ne prouve pas : un vrai téléphone, un lecteur d'écran, la
ferme réelle (relue après chaque déploiement, sans rien y écrire).
