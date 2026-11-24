# Contrat de l'adaptateur du moteur commun

Fusion des deux moteurs, étape 3 : le branchement de la jauge d'OTF sur le
moteur hydrique commun (`docs/ROADMAP.md`, section 6 quater ; D-270). Écrit le
20 novembre 2026, avant le code, en Opus 5.5 · Max (contrat de fusion,
décision 11 du porteur du 14 novembre 2026).

Sources : le plan de la fusion validé par le porteur le 14 novembre 2026
(étape 3 et non-régression, § 4 et § 5 : « un adaptateur remplace le cœur de
`gauge.ts` par le moteur, derrière un interrupteur ; l'ancien code reste
jusqu'à preuve d'égalité ; la version du moteur est figée dans notre dépôt ») ;
le contrat fusionné du dépôt commun (`docs/contrat-moteur-fusionne.md`, MC-18,
MC-20, MC-22, MC-26, MC-28, MC-30) et le mode d'emploi du moteur
(`docs/moteur.md`, « Comment OTF s'en servira ») ; dans ce dépôt,
`docs/soil-reserve-contract.md` (« Quand la jauge est inconnue », « Le calcul
de la jauge »), dont les règles ne changent pas.

## Objet

Faire calculer le bilan de la jauge d'une planche par le moteur commun, jeu
« OTF », **sans changer un seul chiffre**. Rien d'autre : ni l'écran, ni le
planning, ni la base (aucune migration), ni les signaux, ni l'eau arrosée en
trop. La jauge reste une information (D-028, D-047).

## Ce qui passe par le moteur, ce qui reste au module

**Par le moteur** : le bilan à un compartiment, celui d'une planche cultivée
et celui d'un engrais vert ou d'une planche enherbée (« un seul compartiment,
comme une culture », D-053) : le départ, l'observation qui recale, le jour qui
ne compte qu'après l'heure de l'observation, les apports, la consommation,
les bornes 0 et capacité, le drainage, le départ par un apport, le jour
inconnu et le jour qu'il nomme, la conservation du % du plein quand la
capacité change (règle 7), estimé et prévu.

**Au module, hors moteur (MC-18)** : l'ETM et la consommation d'un couvert,
la profondeur, la capacité, p et le seuil, le sol et ses révisions, l'état de
surface, **le sol nu et ses deux compartiments** (FAO-56, chapitre 7 ; nue,
bâchée, paillée, engrais vert détruit), la pluie du jour et sa nature, le
choix des observations qui couvrent la planche, les jours sans sol, les
phrases des raisons, la confiance, l'eau arrosée en trop, les signaux.

## La traduction

Le module appelle `suivre(entree, jeu)` sur chaque **tronçon** : une suite de
jours consécutifs à un compartiment (cultures et couverts mêlés), avec un sol.

| Entrée du moteur | Ce que le module passe |
|---|---|
| `jeu` | `JEU_OTF`, la part de la pluie prévue réglée sur R2 du planning |
| `aujourdhui` | aujourd'hui à la ferme |
| `jours[].etc_mm` | culture : l'ETM de la planche, le jour calculé ; couvert : ET0 × K_abri × Kc du couvert ; sinon `null`, et le module garde sa raison du jour (ET0 manquante, jour bloqué et ses problèmes, cultures sans ETM) |
| `jours[].sol` | θu = capacité ÷ profondeur ÷ part de référence ; zr = la profondeur du jour, plafond compris ; p = la plus petite part p des cultures (0,5 pour un engrais vert, aucune pour l'enherbée) ; plancher = la capacité, d'où **Dmax = la capacité**, le plein d'OTF (MC-22) ; `null` quand la capacité est inconnue (culture sans profondeur) |
| `jours[].abri` | la planche est sous abri : pluie 0, jamais lue |
| `jours[].pluie` | pluviomètre, réanalyse, prévision enregistrée d'un jour passé : `{ type: 'jour', mm }` ; prévision : `{ type: 'prevue', mm }` ; aucune pluie connue ce jour-là : `null` (inconnue) |
| `jours[].part_paillage` | planche cultivée sous paillage plastique : la part de la pluie réglée par l'exploitation ; sinon 1 |
| `arrosages` | les apports de la planche (réels, planifiés, proposés), tels que le besoin les compte ; un apport sans fin lisible, ou qui finit avant son début, est ponctuel ; un apport sans mm positif ou sans début lisible ne compte pas, comme avant |
| `observations` | les réglages du curseur qui couvrent la planche, les jours du tronçon, triés par heure puis par enregistrement : **manque = capacité du jour × (1 − % ÷ 100)**, le % borné de 0 à 100 |
| `etat_initial` | l'état du soir de la veille quand la veille est un jour de sol nu suivi : manque = capacité − état, rapporté à sa capacité ; sinon absent (inconnu) |

| Sortie du module | Ce que le moteur rend |
|---|---|
| état, % du plein | capacité − manque ; le % du plein du moteur |
| état de départ | capacité − manque de départ |
| drainage | le drainage du moteur ; **0 un jour inconnu**, comme avant (le moteur le dit inconnu, MC-09) |
| pluie, irrigation, consommation comptées, part du jour | celles du moteur |
| départ | `observation`, ou `inflow` pour un départ par un apport (`remplissage`) |
| raison d'une jauge inconnue | pluie inconnue : `missing-rain` ; consommation inconnue : la raison du module ce jour-là ; sol inconnu : `crop-without-etm`, sans culture, comme avant ; pas encore de départ : **la raison d'avant le tronçon**, sinon `not-started` |
| estimé, prévu | la nature du moteur |

Le reste du jour (mode, état de surface, profondeur, capacité, p, seuil,
cultures, arrêt d'irrigation, mentions, nature de la pluie, l'observation du
jour) vient du module, comme avant.

## Les passages

1. Les jours consécutifs à un compartiment passent en **un seul appel** : le
   changement de capacité d'une culture à l'autre, ou d'une culture à un
   couvert, y garde le % du plein (conservation `pourcent`, MC-11 ; règle 7).
2. Un jour de **sol nu** est calculé par le module, à partir de l'état du
   dernier jour du tronçon, qui garde son % du plein, comme avant.
3. Après un jour de sol nu, le tronçon suivant **part de son état** (son %
   du plein, `etat_initial`) ; d'une jauge inconnue, il part inconnu.
4. Un jour **sans sol** coupe le suivi : le tronçon suivant part inconnu,
   « pas encore de départ », comme avant.
5. La **raison** d'une jauge inconnue passe d'un tronçon au suivant et au sol
   nu, comme avant : un jour inconnu sans rien pour partir garde la raison
   d'avant.

## Ce qui change : deux données impossibles

Le moteur refuse ce qui ne peut pas être (une erreur de programme chez lui).
Deux données que le module laissait passer n'arrivent que par une faute de
saisie ou de météo ; avec le moteur, elles disent « inconnue » au lieu d'un
chiffre faux. Ce sont les deux seuls cas où un chiffre change ; ils sont dits
au porteur avec la PR qui bascule l'interrupteur, avec les deux valeurs.

1. **Un sol qui ne retient rien.** Une RFU du sol de **0 mm/m** n'arrive
   qu'avec une RFU du laboratoire sous 0,5 mm/m, ou sous 50 mm/m avec 99 % de
   cailloux (l'arrondi au mm/m entier). Le moteur refuse θu = 0 ; **un tel sol
   vaut un sol absent** : « Inconnue : aucune RFU saisie pour sa parcelle »,
   qui renvoie à la saisie à corriger. Avant : un état de 0 mm, un % du plein
   inconnu et tout l'apport compté en drainage.
2. **Une consommation impossible sous un couvert.** La consommation d'un
   engrais vert ou d'une planche enherbée est ET0 × K_abri × Kc du couvert ;
   l'ET0 d'un jour sans culture n'est pas bornée comme celle d'une culture
   (« ET0 hors bornes », qui bloque le jour). Une ET0 négative ou illisible
   donnerait une consommation négative, que le moteur refuse : **le jour est
   inconnu, « ET0 manquante »**, jusqu'au prochain départ. Avant : la jauge
   montait sans eau.

## L'interrupteur et la preuve d'égalité

`GAUGE_ENGINE` (`lib/domain/soil-reserve/gauge-switch.ts`) choisit le calcul
de la jauge : `module`, l'ancien code, ou `commun`, le moteur. L'ancien code
reste tel quel tant que l'égalité n'est pas prouvée. Une PR par bloc :

1. **PR 1** : le moteur figé, l'adaptateur, l'interrupteur sur `module` :
   **rien ne change en ligne**. La preuve :
   - tous les tests du module, **rejoués une seconde fois l'interrupteur sur
     `commun`** (`pnpm test:jauge-moteur-commun`, dans `pnpm test`), sans
     modifier un seul test ;
   - une comparaison des deux calculs sur des suites de jours tirées au
     hasard (graines fixes) : cultures, couverts et sol nu mêlés, jours sans
     sol, observations, apports, pluies et ETM manquantes, abri, paillage,
     changements d'heure ; chaque grandeur de chaque jour, à 0,000001 mm ;
   - les cas O01 à O10 et les cas limites du script de l'étape 1, joués sur
     les deux calculs ;
   - **chaque matin**, l'enregistrement de la jauge calcule aussi l'autre
     chemin et écrit une ligne au journal : planches et jours comparés,
     écarts au-delà de 0,01 mm (MC-30) par grandeur, le plus grand écart,
     **sans aucune donnée de la ferme** (ni nom, ni identifiant, ni date).
     C'est le rejeu comparé sur la ferme réelle du plan de la fusion (§ 5) :
     lu, sans rien écrire. Une erreur de cette comparaison n'arrête jamais
     l'enregistrement : elle est comptée, sa raison gardée, dates masquées.
     **Au plus 50 000 jours comparés par matin**, toutes fermes comprises
     (environ trois secondes de calcul ; une planche suivie trois mois compte
     une centaine de jours) : au-delà, les planches suivantes ne sont pas
     comparées et leur nombre est dit (`skippedBeds`). La mesure ne met
     jamais en péril le matin, dont le temps de calcul est borné à
     30 secondes (`wrangler.jsonc`).
     La ligne : `{"event":"soil_reserve_engine_comparison","reference":"module",
     "compared":"commun","engineVersion":…,"toleranceMm":0.01,"beds":…,
     "days":…,"daysWithGap":…,"gapsByField":{…},"maxGap":…,"failures":…,
     "firstFailure":…,"skippedBeds":…}`, en information sans écart ni échec,
     en avertissement sinon (`lib/domain/soil-reserve/gauge-comparison.ts`,
     `lib/services/soil-reserve-record.ts`).
2. **PR 2** : l'interrupteur sur `commun`, après trois matins de suite sans
   écart, sans échec et sans planche laissée de côté sur la ferme réelle, lus
   au journal ; le journal compare alors dans l'autre sens. Les deux données
   impossibles (ci-dessus) y sont dites au porteur, avec leurs deux valeurs.
   **Faite le 24 novembre 2026** (D-301), après les matins des 22, 23 et
   24 novembre 2026, lus le 24 au journal du Worker : chaque matin
   164 planches, 5 084, 6 068 puis 5 904 jours comparés, aucun écart, aucun
   échec, aucune planche laissée de côté (le plus grand écart :
   2,8e-14 mm). Tous les tests sont rejoués une seconde fois l'interrupteur
   sur `module` (`pnpm test:jauge-ancien-calcul`, dans `pnpm test`, qui
   remplace `pnpm test:jauge-moteur-commun`), sans en modifier un seul hors
   celui de l'interrupteur ; la ligne du matin dit désormais
   `"reference":"commun","compared":"module"`.
3. **PR 3** : l'ancien code et la comparaison du matin retirés, après une
   semaine sur `commun` sans écart.

Un écart trouvé en chemin arrête la suite : il est listé et présenté au
porteur avec les deux valeurs, jamais corrigé en silence (plan de la fusion,
§ 5).

## Le moteur figé

- `lib/domain/soil-reserve/shared-engine/` : `moteur-hydrique.mjs` et ses
  types (`moteur-hydrique.d.mts`, `types/`), **copiés tels quels** du dossier
  `dist/` du dépôt commun, à un commit de sa branche principale, et son
  `NOTICE` (les mentions requises par la licence, François et Nicolas) ;
  jamais modifiés à la main. Le lint et l'analyse des exports ne les lisent
  pas ; le compilateur, si.
- `lib/domain/soil-reserve/shared-engine/version.ts` dit la version, le
  commit et l'empreinte SHA-256 de chaque fichier copié ; un test les
  vérifie, et qu'aucun autre fichier n'est dans le dossier.
- Une nouvelle version entre par sa propre PR, après sa fusion dans le dépôt
  commun ; une version qui change un résultat du jeu OTF est une version
  majeure (MC-26) et se présente au porteur avec les deux valeurs.
- Licence : PolyForm Shield 1.0.0, comme le dépôt commun ; la bannière du
  fichier reste en tête.

## Choix faits en écrivant

1. **Les couverts passent par le moteur.** Un engrais vert levé ou couvrant
   et une planche enherbée suivent un compartiment « comme une culture »
   (D-053) : le module calcule leur consommation, le moteur le bilan. Les
   laisser au module aurait gardé deux copies du même bilan (AGENTS.md :
   une règle vit en un seul endroit). Le contrat du moteur range « sol nu et
   couverts » hors moteur au sens de leurs modèles (le Kc du couvert, les
   deux compartiments du sol nu) : c'est respecté.
2. **Un tronçon, un appel.** Le moteur suit des jours consécutifs ; le sol
   nu et les jours sans sol coupent les tronçons, le module fait le lien.
3. **L'interrupteur est une constante** du domaine, changée par une PR ; le
   rejeu des tests sur `commun` remplace ce fichier par un passage de test,
   comme les passages d'isolation de la 4.2. Aucune variable
   d'environnement, aucune migration.
4. **La comparaison du matin** couvre tous les jours calculés (passés et
   prévus) de toutes les planches des fermes qui suivent la réserve du sol,
   dans la limite de 50 000 jours par matin.
5. **Égalité à 0,000001 mm** dans les tests (le critère du contrat est 0,01 mm,
   MC-30) : les deux calculs ne diffèrent que d'arrondis de l'ordre de
   1e-14 mm.
6. **Les types viennent de `dist/`.** Le dépôt commun construit et vérifie
   les types du module ES avec ses deux fichiers (sa PR n° 13) : la copie
   vient entière de `dist/`, sans rien fabriquer ici.
7. **Le temps de calcul.** Par le moteur, la jauge d'une planche prend
   1,3 à 1,6 fois le temps de l'ancien calcul (mesuré sur 3 000 planches
   tirées au hasard : environ 40 microsecondes par jour pour l'ancien,
   50 pour le moteur, 5 pour comparer un jour) : sans effet visible à
   l'écran. La comparaison du matin ajoute donc environ une fois et demie le
   temps de la jauge, d'où sa limite ; à remesurer avec la PR 2. **Remesuré
   avec la PR 2** (24 novembre 2026, les mêmes 3 000 planches, médiane de
   sept passages) : 34 microsecondes par jour pour l'ancien calcul, 50 pour
   le moteur (1,46 fois, de 1,25 à 1,83 selon le passage), 4 pour comparer
   un jour. Le matin rejoue désormais l'ancien calcul, le plus rapide : au
   plus 50 000 jours, environ deux secondes de plus que la jauge seule.

## Preuve de fin de la PR 1

`pnpm lint`, `pnpm typecheck`, `pnpm test` (avec le rejeu sur `commun`),
`pnpm build`, `pnpm knip` réussis ; `pnpm push:check`, `pnpm weather:check`,
`pnpm site:check` et `pnpm e2e` sans rapport (ni l'interface ni les Workers
ne changent : l'interrupteur reste sur `module`), joués par la CI ; la
comparaison tirée au hasard et le script de l'étape 1 lancés, leurs sorties
collées dans la PR :

```text
node --experimental-strip-types --import ./tests/support/register.mjs scripts/shared-engine-compare.ts 1 10 2000
node --experimental-strip-types --import ./tests/support/register.mjs scripts/shared-engine-cases.ts --json
node --experimental-strip-types --import ./tests/support/register.mjs --import ./tests/support/jauge-moteur-commun.mjs scripts/shared-engine-cases.ts --json
```

Les tests : `tests/soil-reserve-shared-engine.test.ts` (la copie figée,
l'interrupteur, l'égalité sur 600 planches tirées au hasard, les passages,
les deux données impossibles, le bilan du matin) et
`tests/db/soil-reserve-engine-comparison.test.ts` (la comparaison du matin
sur une ferme de test, sa ligne au journal) ; le tirage est dans
`tests/support/soil-reserve-draw.ts`.

## Preuve de fin de la PR 2

Les mêmes contrôles, le second passage des tests tourné vers l'ancien
calcul (`pnpm test:jauge-ancien-calcul`, dans `pnpm test`) ; la comparaison
tirée au hasard et le script de l'étape 1 relancés, le script sans passage
de test jouant désormais le moteur commun :

```text
node --experimental-strip-types --import ./tests/support/register.mjs scripts/shared-engine-compare.ts 1 10 2000
node --experimental-strip-types --import ./tests/support/register.mjs scripts/shared-engine-cases.ts --json
node --experimental-strip-types --import ./tests/support/register.mjs --import ./tests/support/jauge-ancien-calcul.mjs scripts/shared-engine-cases.ts --json
```
