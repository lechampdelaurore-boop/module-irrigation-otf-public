# Contrat du script des cas de test du moteur commun

Fusion des deux moteurs, étape 1 (`docs/ROADMAP.md`, ligne 24 sexies,
section 6 quater ; D-114). Écrit le 14 novembre 2026, avant le script.

## Objet

Savoir si les valeurs calculées **à la main** des dix cas OTF du dépôt commun
(`lechampdelaurore-boop/moteur-hydrique-commun-public`, `cas/cas-otf.json`,
cas O01 à O10) sont celles que donne **le code actuel du module**, et ajouter
les cas limites que le contrat de fusion demande (§ 5 : jour inconnu puis
remplissage, observation à midi, changement de capacité, arrosage proposé,
abri sans pluie, ET0 hors bornes, plancher atteint puis pluie).

Le script **mesure**. Il ne modifie ni le module ni ses tests, ne lit ni la
ferme réelle ni la base, n'appelle aucun réseau. **Une valeur fausse se
corrige dans le contrat du moteur commun, jamais dans le code du module** ;
cette correction, comme tout message à Nicolas, attend l'accord du porteur
(contrat de fusion § 9 bis).

## Ce que le script lit et appelle

- **Les cas** : une copie de `cas/cas-otf.json` du dépôt commun, figée au
  commit `43c9de7` du 12 novembre 2026, dans
  `scripts/shared-engine/cas-otf.json` ; `--cas <chemin>` en lit une autre.
  Les valeurs attendues sont **lues dans ce fichier**, jamais recopiées dans
  le script.
- **Le code OTF**, tel quel, par ses fonctions publiques :

| Cas | Ce qui est appelé |
|---|---|
| O01 ETM | `cropWaterDay` (`lib/domain/crop-water/etm.ts`), une culture d'essai au Kc 1,0, abri, paillage plastique, filet d'ombrage avec l'option |
| O02 sol | `soilRfuMmPerMeter` (`soil-reserve/soil.ts`) |
| O03 capacité, seuil | `bedSoilReserve` (`soil-reserve/gauge.ts`), seuil selon la culture puis seuil de la ferme à 50 % |
| O04 plancher | `bedSoilReserve` sur trois jours |
| O05 observation à midi | `bedSoilReserve`, observation à 12 h à Paris un jour de 24 heures |
| O06 changement de capacité | `bedSoilReserve`, une révision du sol qui fait passer la capacité de 15,3 à 30 mm |
| O07 jour inconnu | `bedSoilReserve`, ET0 manquante puis 16 mm d'apports |
| O08 surface inconnue | `buildWeeklyPlan` (`planning/engine.ts`) sur la ferme des tests de D-097 (`tests/support/planning-fixtures.ts`, quatre tunnels de huit planches), le passe-pied de T1-1 effacé ; le cas ne donne ni besoins ni surfaces : joué au budget du cas, rapporté, puis à 5 m³, le budget des tests de D-097, où la pénurie existe ; A et B se vérifient sur ce second jeu |
| O09 sol nu | `bareSoilDay` (`soil-reserve/bare-soil.ts`) |
| O10 eau perdue | `bedSoilReserve` puis `waterSurplus` (`soil-reserve/water-surplus.ts`) |

## Les verdicts

Chaque valeur attendue reçoit un verdict, et un seul :

- **conforme** : un nombre à 0,01 près (la tolérance du fichier des cas),
  `null` pour `null`, un texte ou un booléen égal ;
- **conforme, déduit** : la grandeur n'existe pas dans le code (la RU, la RAW,
  le manque Dr, Kr) ; le script la déduit des sorties du code par
  l'équivalence du contrat, et le dit ;
- **écart** : la valeur du code et la valeur écrite diffèrent ; les deux sont
  affichées ;
- **non joué** : le code n'a pas cette règle (une variante du jeu Tlaloc), ou
  le cas ne se traduit pas en entrées du code ; la raison est écrite.

Un cas est conforme quand toutes ses valeurs le sont ; il est en écart dès
qu'une l'est. Le script finit toujours sans erreur quand il a pu tout jouer :
un écart est un résultat, pas une panne. Il s'arrête en erreur seulement si
le fichier des cas manque, est illisible ou ne contient pas O01 à O10.

## Les cas limites (contrat de fusion § 5)

Écrits ici avant le script, d'après `docs/soil-reserve-contract.md` et
`docs/crop-water-need-contract.md`, sur le sol de la ferme (62 mm/m,
18 % de cailloux, 51 mm/m) et une culture à 30 cm, capacité 15,3 mm, en
juin 2026 (jours de 24 heures), plein champ sauf mention :

| N° | Cas | Attendu |
|---|---|---|
| L1 | Jour inconnu puis remplissage : plein à minuit le jour 1 (ETM 3, sans pluie), pluie inconnue le jour 2, 10 mm d'apports le jour 3, 20 mm le jour 4 (ETM 3) | jour 1 : 12,3 mm ; jour 2 : inconnue, « pluie manquante » ; jour 3 : inconnue, même raison (10 < 15,3) ; jour 4 : 15,3 mm, départ par un apport |
| L2 | Observation à midi : 50 % à 12 h, ETM 4, arrosage de 10 mm de 8 h à 9 h et de 5 mm de 18 h à 19 h | fraction 0,5 ; départ 7,65 mm ; irrigation comptée 5 mm ; fin 7,65 + 5 − 2 = 10,65 mm |
| L3 | Changement de capacité par le stade : 60 % à minuit le jour 1 au stade 1 (30 cm), stade 2 (60 cm) le jour 2, ETM 0 | jour 1 : 9,18 mm sur 15,3 ; jour 2 : capacité 30,6, départ et fin 18,36 mm (60 % conservé) |
| L3 bis | Capacité qui baisse : 60 % de 30,6 mm le jour 1 (60 cm), 30 cm le jour 2 | jour 2 : départ 9,18 mm (60 % conservé) |
| L4 | Arrosage proposé, jour prévu : plein à minuit, ETM 4, un créneau `proposed` de 3 mm et un `planned` de 2 mm | jour « prévu » ; irrigation 5 mm ; fin 15,3 (16,3 bornée), drainage 1 mm |
| L5 | Abri sans pluie : planche sous abri, plein à minuit, ETM 2, 20 mm au pluviomètre ; puis un jour sans aucune pluie enregistrée | jour 1 : pluie comptée 0, fin 13,3 mm ; jour 2 : jauge connue, fin 11,3 mm (aucune pluie à lire sous abri) |
| L6 | ET0 hors bornes : ET0 de 12, 12,5 et −0,1 mm/j | 12 : ETM calculée (bornes comprises) ; 12,5 et −0,1 : jour bloqué, message qui nomme l'ET0 ; dans la jauge, un jour bloqué rend la jauge inconnue, raison « bloqué » |
| L7 | Plancher atteint puis pluie : 2 mm à la fin du jour 0, ETM 5 les jours 1 et 2, 3 mm de pluie et ETM 1 le jour 3 | 0 ; 0 ; 2 mm (rien du déficit n'est retenu) |

## Ce que le script rend

Un compte rendu en texte, en français, lisible par le porteur : pour chaque
cas, son titre, chaque valeur attendue, la valeur du code et le verdict ; à
la fin, la liste des cas conformes, des cas en écart et des valeurs non
jouées. `--json` rend la même chose en JSON.

Commande :
`node --experimental-strip-types --import ./tests/support/register.mjs scripts/shared-engine-cases.ts`

## La preuve

- `tests/shared-engine-cases.test.ts`, écrit rouge avant le script : la
  règle des verdicts (tolérance, `null`, texte), l'arrêt sur un fichier sans
  O01 à O10, et que chaque cas et chaque cas limite reçoit un verdict. Il ne
  fige pas les résultats de la mesure.
- Le script lancé, sa sortie collée dans la PR.

## Première mesure, 14 novembre 2026 (D-116)

Sur le code de `main` au commit `360a73e`, les cas du commit `43c9de7` du
dépôt commun : **17 cas conformes** (O01 à O06, O08 à O10, L1 à L7, L3 bis),
**un écart** et **deux valeurs non jouées**.

- **O07, `drainage_jour2`** : écrit `null` (inconnu), le code rend
  **0,7 mm**. Au jour qui fait repartir une jauge inconnue par un apport, le
  code compte le drainage comme `apports − capacité` (16 − 15,3), sans la
  consommation du jour ni l'état de la veille, qu'il ne connaît pas. C'est
  donc un minimum : le vrai drainage est au moins de 0,7 mm. Ce drainage
  entre dans la pastille de l'eau arrosée en trop quand l'apport est un
  arrosage. Le cas a été écrit d'après la règle du code (`restart:
  'inflow'`) sans relire cette ligne : **c'est le cas qui se trompe sur le
  jeu OTF** ; correction proposée au contrat commun : `drainage_jour2 =
  0,7`, avec la mention « au moins, compté depuis la capacité » (jeu OTF),
  le choix « inconnu » restant possible comme paramètre d'un autre jeu. Rien
  n'est corrigé dans le dépôt commun sans l'accord du porteur.
- **O06, conservation « manque »** (deux valeurs) : variante du jeu Tlaloc
  (MC-11), que le code OTF n'a pas ; non jouée.
- **O08** : conforme, mais son statut « cible, pas le comportement actuel
  d'OTF » est périmé depuis la correction du point ouvert 63 (#30, D-097) :
  c'est le comportement actuel. Et ses entrées ne suffisent pas : au budget
  écrit, 10 m³, la ferme des tests n'est pas en pénurie (demande connue
  9,92 m³). Correction proposée : statut « exécuté », entrées complétées
  (besoin, surfaces, budget sous la demande).
- **Valeurs déduites** : la RU et la RAW (O03), le manque Dr (O04) et Kr
  (O09) n'existent pas dans le code ; le script les déduit de ses sorties et
  elles concordent.
