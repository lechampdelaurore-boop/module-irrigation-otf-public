# Contrat — l'ET0 horaire, la forme de la journée (6 septendecies)

Écrit le 26 novembre 2026, sans code, en Sonnet 5.5 · Moyen (grille du travail
sans code). L'idée est rangée sans engagement depuis le 7 novembre 2026
(D-065, roadmap section 6 ter : « une évapotranspiration calculée à l'heure et
non plus au jour »). Le porteur la fait avancer le 26 novembre 2026
(« Et tu enchaînes avec les chantiers 3 et 4 »).

**Ce que ce contrat n'est pas.** Il ne lance aucun code. Il ne change aucun
chiffre de la jauge, de l'objectif, du besoin ni des alertes tant que le
porteur n'a pas répondu à la question 1 (section 10) dans ce sens. Il ne
demande aucun budget (section 5). Il n'ouvre aucune porte à un mode horaire du
calcul d'OTF : le module reste journalier (MC-19 du moteur commun).

Le module est un logiciel pour plusieurs fermes : rien ici ne dépend de la
ferme du porteur, de sa commune ni de son fuseau (sections 4 et 9).

## 1. Ce qui existe

- **L'ET0 est journalière partout.** Une valeur par lieu et par jour
  (`et0_mm`, tables météo de `db/schema.ts`), avec sa nature (`reanalysis`,
  `forecast`, `estimated`). En production, le fournisseur de prévision est
  Visual Crossing : l'ET0 du jour est calculée par le module (FAO-56
  Penman-Monteith, `calculateFao56Et0Mm`) à partir des champs du jour ; la
  réanalyse vient d'Open-Meteo, qui donne sa propre ET0 du jour
  (`docs/weather-contract.md`).
- **L'ET0 n'entre dans aucun besoin ni aucun écart (D-010).** Exceptions
  écrites : l'ETM (ET0 × Kc, D-045 et D-047) qui nourrit la jauge du sol, et
  l'objectif automatique, éteint par défaut (D-309).
- **Le moteur commun** (dépôt `moteur-hydrique-commun-public`, Nicolas) a deux
  pas de temps : le jeu OTF est **journalier** (MC-19 : « OTF reste
  journalier ; l'horaire est dans le moteur, mesuré plus tard sur le banc »),
  le jeu Tlaloc est **horaire**, mais sa consommation y est **continue et
  uniforme** entre deux apports (`ETc × (f2 − f1)`, contrat § 4.1) : l'heure
  de la journée ne pèse que par l'heure des apports, jamais par la forme de la
  consommation.
- **Le banc** (MC-36) lit déjà de l'ET0 horaire d'Open-Meteo de son côté
  (`banc/src/open-meteo.ts`) pour le jeu Tlaloc ; le module n'en lit pas.
- **Les relectures de la journée** (C1, D-303) relisent les prévisions à
  9 h 30, 12 h 30, 15 h 30, 18 h 30 et 21 h 30, seulement pour les fermes qui
  ont une alerte active : un appel de plus par lieu est donc déjà possible
  sans déclencheur nouveau.

Ce que l'on ne sait pas faire aujourd'hui : dire, à 12 h, **combien de la
consommation du jour est déjà passée et combien reste à venir**, ni à quelles
heures le sol et les plantes perdent le plus.

## 2. Les choix faits par Claude (26 novembre 2026)

Choix techniques, pris sur ma recommandation (consigne du porteur : « le reste
par l'option recommandée »). Aucun n'est agronomique ; le porteur peut les
défaire d'un mot.

1. **Le total du jour reste LA valeur de référence.** L'ET0 horaire ne
   remplace jamais l'ET0 du jour. Elle ne fournit que la **forme** : la part
   de la journée qui tombe dans chaque heure. Deux sources qui ne s'additionnent
   pas dans le même total ne se contredisent donc jamais à l'écran.
2. **On stocke des parts, pas des millimètres horaires.** Une journée = 24
   parts (23 ou 25 les jours de changement d'heure) dont la somme est 1.
   L'heure en mm se calcule : `part × ET0 du jour` (ou `part × ETM du jour`
   pour une planche).
3. **Trois sources, de la plus fine à la plus simple**, la meilleure
   disponible gagnant, et la nature dite partout :
   - `provider-hourly` : le fournisseur donne l'ET0 horaire (Open-Meteo,
     `hourly=et0_fao_evapotranspiration`) ;
   - `computed-hourly` : le module calcule l'ET0 horaire FAO-56 (équation 53)
     à partir des heures du fournisseur (température, humidité, vent,
     rayonnement), si le fournisseur de la ferme les donne ;
   - `theoretical` : la forme du soleil seule, calculée sans réseau (section
     4.4), toujours disponible, dite « forme théorique ».
4. **Horizon : aujourd'hui, demain et après-demain (J0 à J+2).** La forme de
   la journée ne sert qu'à la journée en cours et aux deux suivantes ; au-delà,
   les prévisions horaires ne sont pas fiables et l'écran n'en parle pas. Le
   passé n'est pas conservé en heures (le banc lit ses propres données).
5. **Par lieu, pas par ferme** : comme la météo du jour, la forme est lue une
   fois par lieu partagé et utilisée par toutes les fermes de ce lieu.
6. **Aucune case, aucun réglage, aucun écran de plus au premier niveau.** La
   forme s'affiche dans le pli « Le détail » d'« Aujourd'hui » (S2, D-330),
   jamais au premier niveau : la simplification du module (D-327) interdit d'y
   ajouter. Pas de réglage par ferme (un réglage ne se justifierait que si la
   question 1 allait au-delà de l'information).
7. **Un échec ne casse jamais la météo.** Comme l'archive des prévisions
   (F750) : une lecture ou une écriture horaire qui échoue est journalisée
   (statut, date, jamais les coordonnées) et la lecture du jour, les alertes
   de gel et de météo se font comme avant.
8. **Aucun appel de plus quand le fournisseur donne l'heure avec le jour.** La
   lecture horaire est demandée dans le même appel que la lecture du jour
   quand le fournisseur le permet ; sinon, un seul appel de plus par lieu et
   par lecture (section 5).

## 3. Ce que l'ET0 horaire change, et ne change pas

| Sujet | Ce qui change | Ce qui ne change pas |
| --- | --- | --- |
| ET0 et ETM du jour | rien | total, Kc, K_abri, bornes : intacts |
| Jauge du sol, jours avant le seuil | **rien** tant que la question 1 reste « informer seulement » | le pas est le jour (MC-19) |
| Objectif automatique (D-309) | rien | somme des ETM ou ET0 des jours |
| Alertes météo et de gel | rien | température, pluie : jamais l'ET0 |
| « Aujourd'hui », pli « Le détail » | une ligne et une petite courbe de la journée (section 7) | les trois champs, la page à l'essentiel |
| Moteur commun | une proposition à Nicolas, séparée (section 8) | le jeu OTF journalier |

## 4. La règle de la forme de la journée

### 4.1 Les heures d'une journée

La journée est la **journée civile du fuseau du lieu** (celui de la ferme,
jamais Paris par défaut : D-028, logiciel multi-fermes). Elle compte 24
heures, 23 le jour du passage à l'heure d'été, 25 le jour du retour à l'heure
d'hiver (même règle que `bornesDuJour` du moteur commun). Une heure est
identifiée par son début local ; l'heure répétée du jour de 25 h est comptée
deux fois, dans l'ordre.

### 4.2 Les parts

À partir de 24 (ou 23, ou 25) valeurs d'ET0 horaire `e_h ≥ 0` :

```
S = somme des e_h
si S > 0 :           part_h = e_h / S          (somme des parts = 1)
si S = 0 ou inconnue : pas de forme du fournisseur → forme théorique (4.4)
```

Les valeurs négatives ou illisibles d'une heure sont lues comme **absentes**,
pas comme 0 (D-003) : une seule heure absente suffit à refuser la forme du
fournisseur pour ce jour et à passer à la source suivante (3.), jamais à
« boucher » le trou par un zéro. Les petites valeurs négatives de nuit que
certains calculs horaires donnent sont ramenées à 0 **avant** l'addition, et
cette correction est la seule permise.

### 4.3 Ce que l'on en tire (domaine pur, `lib/domain/weather/hourly-et0.ts`)

Pour un jour, un total du jour `T` (ET0 ou ETM d'une planche) et un instant `t` :

- `consommé_jusqu'à(t)` = `T × (somme des parts des heures terminées avant t +
  part de l'heure en cours × fraction écoulée de cette heure)` ;
- `reste_à_venir(t)` = `T − consommé_jusqu'à(t)` ;
- `heures_de_forte_demande` = les heures dont `e_h ≥ 75 %` du maximum de la
  journée, regroupées en une plage (question 3) ;
- les trois valeurs sont `inconnues` (jamais 0) si le total `T` du jour est
  inconnu (ET0 manquante, jour bloqué : mêmes raisons qu'aujourd'hui).

### 4.4 La forme théorique (sans réseau)

Quand ni le fournisseur ni son calcul horaire ne sont disponibles, la forme est
celle de la hauteur du soleil : pour chaque heure, `e_h ∝ max(0, sin β)`, où
`sin β = sin φ · sin δ + cos φ · cos δ · cos ω` (équation FAO-56 28, au milieu
de l'heure), `φ` la latitude du lieu, `δ` la déclinaison du jour, `ω` l'angle
horaire solaire (la longitude du lieu et le fuseau donnent l'heure solaire ;
l'équation du temps, moins de 17 minutes, est négligée). Un jour sans soleil
au-dessus de l'horizon (nuit polaire) donne `inconnue`, jamais une forme.

Limite dite à l'écran (le « ? ») : cette forme est **symétrique autour du midi
solaire**, alors que l'ET0 réelle culmine un peu plus tard (vent et déficit de
vapeur de l'après-midi). Elle est nommée « forme théorique » ; elle n'est pas
présentée comme une prévision.

### 4.5 La nature et la fraîcheur

Chaque jour porte sa nature (`provider-hourly`, `computed-hourly`,
`theoretical`), la source et l'heure de lecture. Une forme lue il y a plus de
6 heures un jour de prévision est dite « ancienne » comme la météo du jour
(`docs/weather-contract.md`) ; l'heure de lecture ne change pas la forme d'un
jour passé.

## 5. Stockage, coût et conservation

- **Une table neuve**, par lieu, jour et heure (ou : une ligne par lieu et par
  jour, 24 parts en JSON borné ; **choix laissé au code HR2**, le contrat fixe
  seulement le contenu) : jour civil du lieu, index de l'heure, part, nature,
  source, heure de lecture. Migration **additive**, aucune table recréée,
  aucun export de la base demandé avant la fusion (comme 0046). Numéro de
  migration : le premier libre au moment du code.
- **Écriture** à la lecture du matin (6 h 15) et aux relectures de la journée
  quand elles ont lieu : au plus 3 jours × 24 heures = **72 lignes par lieu et
  par lecture** ; avec les cinq relectures, 432 lignes par lieu et par jour au
  pire, loin sous le quota de D1 pour des centaines de lieux. **Aucun coût.**
  Le quota est relu à la PR de code (comme F754).
- **Aucun appel de plus** pour Open-Meteo quand `hourly` se demande avec
  `daily` dans la même requête. Pour Visual Crossing, les heures (`include=hours`)
  comptent peut-être comme des enregistrements de plus sur l'offre gratuite :
  **à vérifier par la PR HR2 sur la page de tarification, non vérifié ici**.
  Si le coût est réel, la source du lieu reste `theoretical` et rien d'autre
  ne change.
- **Conservation** : 8 jours (les 3 jours lus plus la veille et de la marge),
  purgés par la tâche « Purges de conservation » du matin ; inscrite au plan
  de conservation et à l'inventaire du journal des modifications, comme
  chaque table. Une table par lieu et non par ferme : elle n'est pas dans le
  plan d'effacement d'une ferme, mais le plan dit pourquoi.

## 6. Ce que le code touche, et ce qu'il ne touche pas

Il touche : un domaine pur de la forme de la journée ; l'interface
`WeatherProvider` (une lecture horaire **facultative**, un fournisseur qui ne
la fournit pas reste valide) ; le service de lecture météo et ses relectures ;
une table ; la page « Aujourd'hui », pli « Le détail ».

Il ne touche pas : les calculs de la jauge, de l'ETM, de l'objectif, des
alertes ; le moteur commun ; le Worker de notification ; l'archive des
prévisions (la forme n'est pas archivée, section 9) ; les fichiers d'OTF.

## 7. L'écran (information seulement)

Dans « Aujourd'hui », pli « Le détail » (fermé par défaut, S2), sous la ligne
« Calcul approximatif » :

- une **phrase** : « D'ici ce soir, il reste environ 1,7 mm à consommer sur
  2,4 mm » (ET0 de la ferme) ;
- une **petite courbe** de la journée, 24 barres, l'heure d'aujourd'hui
  marquée ; l'heure et la part en infobulle ;
- si la question 3 est acceptée : « Évaporation la plus forte entre 11 h et
  16 h » ;
- le « ? » dit la nature (« forme du fournisseur », « calculée à l'heure »,
  « forme théorique du soleil ») et ce que la courbe n'est pas : « Elle ne
  change pas le besoin de vos planches ni l'objectif ; elle montre à quelle
  heure la journée consomme. »

Trois états : forme connue ; forme théorique (la phrase le dit) ; jour sans
total (ET0 manquante : « Pas de courbe : l'ET0 du jour manque », jamais une
courbe à 0). Le texte garde les mots du tableau (`lib/domain/simple-words.ts`,
D-328). Parcours navigateur : un nouveau, aux deux largeurs (320 et 1440 px).

## 8. Articulation avec le moteur commun

**Rien n'est écrit dans le dépôt commun par cette ligne.** Les règles du dépôt
commun (README, règles 1 et 3) imposent une PR relue par Nicolas et une
discussion avant tout changement qui touche le comportement d'un logiciel.

Ce que l'ET0 horaire suggère au moteur commun, à proposer à Nicolas **après
la PR 2 du banc** (MC-36, rapport de rejeu) et seulement si le banc le justifie :

- une entrée **facultative** du pas horaire, `profil_consommation` : la part
  cumulée de la consommation du jour en fonction de la fraction du jour `f`
  (aujourd'hui, la consommation est linéaire en `f`, contrat § 4.1) ;
- **par défaut linéaire** : sans profil, tous les cas Tlaloc (T01 à T12) et OTF
  restent exacts à 0,01 mm ;
- le jeu OTF (journalier) l'ignore, sans effet (MC-19) ;
- numéro de version : mineur ; contrat et journal du dépôt commun mis à jour
  dans la même PR, relue par Nicolas.

La forme de ce contrat (parts sur 23, 24 ou 25 heures, jamais 0 pour un jour
inconnu) est **déjà** celle des fonctions de temps du moteur commun
(`bornesDuJour`, `fractionDuJour`) : aucune conversion à inventer.

Le banc mesurera si un profil change les indicateurs (jours sous le seuil, eau
perdue). **Un résultat du banc, jamais une opinion, décidera** si la question
1 doit un jour être rouverte vers « caler la jauge ».

## 9. Articulation avec la météo multi-modèles et avec « prévu contre réalisé »

- **Multi-modèles** (contrat `docs/weather-models-contract.md`, D-339, ligne 36,
  écrit en parallèle ; ses règles font foi dès qu'il est fusionné). Sa version 1
  donne **un seul modèle par ferme**, sans règle de combinaison (moyenne et
  prudent sont rangés hors version). Règles posées ici : **l'ET0 horaire d'une
  ferme est lue avec le modèle de la ligne du jour de la ferme**, donné par la
  colonne `source` de `irrigation_weather_daily_values` (`open-meteo:<modèle>`,
  `open-meteo:best_match` au-delà de la portée du modèle, `visual-crossing` en
  « Automatique ») ; jamais un autre modèle, jamais un mélange. Total du jour
  et forme viennent donc du même modèle. Si ce modèle ne donne pas l'heure, la
  forme du fournisseur manque : la source suivante (section 2, choix 3) est
  prise et **dite à l'écran** (« forme théorique »), jamais un repli silencieux
  ni une forme d'un autre modèle. L'interface `WeatherProvider` garde son nom ;
  la lecture horaire s'y ajoute en facultatif. La PR HR2 relit ce contrat
  avant d'être écrite.
- **Prévu contre réalisé** (contrat écrit en parallèle). Cette ligne **n'archive
  pas** la forme : l'archive des prévisions garde des valeurs du jour (D-297).
  Si ce chantier veut comparer les heures, il demandera l'archive horaire et
  son contrat la décrira ; elle ne se fait pas ici par précaution.
- **Alertes.** L'ET0 horaire n'est lue par aucune alerte.

## 10. Questions pour le porteur

Trois questions agronomiques, posées **une par message** (consigne 18), chacune
avec sa recommandation. La recommandation s'applique en attendant la réponse.

1. **1 sur 3 — L'ET0 heure par heure sert-elle à calculer ou à informer ?**
   Recommandation : **informer seulement** (aucun chiffre de la jauge, de
   l'objectif ni du besoin ne change ; l'horaire se mesure d'abord sur le banc
   avec Nicolas, section 8). Posée le 26 novembre 2026.
2. **2 sur 3 — Sous abri, la forme de la journée est-elle celle du plein champ ?**
   **Réponse du porteur, le 26 novembre 2026 : « Oui, même forme »** (option
   recommandée). Raison : le K_abri est un facteur du total du jour et ne
   déplace pas les heures ; une forme propre à l'abri (plus plate, plus
   tardive) demanderait des mesures que le module n'a pas.
3. **3 sur 3 — Faut-il dire à quelles heures l'évaporation est la plus
   forte, et à quel seuil ?** **Réponse du porteur, le 26 novembre 2026 :
   « Oui, en information (75 %) »** (option recommandée) : les
   heures à 75 % ou plus du maximum du jour (11 h à 16 h dans l'exemple de la
   section 11), sans aucune interdiction ni alerte : une aspersion en pleine
   chaleur reste décidée par la personne ; le seuil est une constante du code.

## 11. Scénarios chiffrés (fuseau Europe/Paris, jour de 24 h)

Jour d'exemple : ET0 horaire du fournisseur, en mm, par heure de début (les
heures 0 à 5 et 20 à 23 valent 0) :

| Heure | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mm | 0,01 | 0,03 | 0,07 | 0,13 | 0,20 | 0,27 | 0,31 | 0,33 | 0,31 | 0,26 | 0,19 | 0,11 | 0,05 | 0,01 |

La somme `S` est **2,28 mm**. L'ET0 du jour du fournisseur de la ferme est
**2,4 mm** (la somme des heures n'a pas à l'égaler : section 2, choix 1).

1. **Part d'une heure.** Heure 14 : 0,31 / 2,28 = **13,6 %** ; en mm sur le jour
   de 2,4 mm : 0,33 mm.
2. **Consommé et reste à 12 h 00** (heures 0 à 11 terminées) : 0,71 / 2,28 =
   **31,1 %** ; consommé 0,75 mm, **reste 1,65 mm**, dit « environ 1,7 mm ».
3. **Une planche à ETM de 3,0 mm** (Kc 1,25 × 2,4) : à 12 h 00 il reste
   0,689 × 3,0 = **2,07 mm**, dit « environ 2,1 mm ».
4. **À 12 h 30** (la moitié de l'heure 12) : 31,1 % + 0,5 × 13,6 % = **37,9 %**.
5. **Forte demande à 75 % du maximum** : maximum 0,33 → seuil 0,2475 : heures
   11, 12, 13, 14 et 15, soit **11 h à 16 h**.
6. **Jour de 23 h** (passage à l'heure d'été) : 23 parts, somme 1 ; la forme
   d'une heure qui n'existe pas ce jour-là n'est pas inventée.
7. **Une heure absente** (13 h sans valeur) : la forme du fournisseur est
   refusée pour ce jour ; la source suivante est prise (`computed-hourly` puis
   `theoretical`) ; jamais 0 pour 13 h.
8. **ET0 du jour manquante** : « Pas de courbe : l'ET0 du jour manque » ; la
   forme existe mais aucune valeur en mm n'est calculée ni affichée.
9. **Fournisseur sans heures** (rien dans la réponse) : `theoretical`, la phrase
   le dit, la courbe est symétrique autour du midi solaire du lieu.
10. **Écriture qui échoue** : la lecture du jour est écrite, les alertes
    s'évaluent comme avant, le journal dit le statut et la date seulement.
11. **Deux fermes sur un lieu** : une lecture, la même forme pour les deux ; un
    K_abri différent change le total de chaque planche, pas les heures.
12. **Aucun chiffre existant ne change** : les tests du domaine de la jauge,
    de l'ETM, de l'objectif et des alertes passent à l'identique, sans
    modification.

## 12. Livraison en trois PR, une à la fois

| PR | Contenu | Réglage |
| --- | --- | --- |
| HR1 | le domaine pur `lib/domain/weather/hourly-et0.ts` (parts, journées de 23 et 25 h, consommé et reste, forte demande, forme théorique) et ses tests : les scénarios 1 à 6, 8 et 9 de la section 11 ; aucune base, aucun appel | Opus 5.5 · Élevé |
| HR2 | la lecture horaire facultative de l'interface fournisseur, son service, la table (migration additive), l'écriture à la lecture du matin et aux relectures, la purge, le plan de conservation et l'inventaire du journal ; scénarios 7, 10 et 11 ; le coût de Visual Crossing vérifié | Opus 5.5 · Élevé |
| HR3 | l'écran du pli « Le détail » d'« Aujourd'hui », le « ? », le parcours navigateur aux deux largeurs, les contrats d'écran mis à jour | Opus 5.5 · Élevé |

Réglage : **Opus 5.5 · Élevé pour les trois**, sur le précédent de l'archivage
des prévisions (D-297, une table, une tâche, un échec jamais bloquant). Aucun
effort supérieur n'est justifié tant que la forme n'entre dans aucun calcul ;
**si la question 1 est tranchée vers « caler la jauge », ce contrat est
rouvert** avant toute PR et la ligne passe en Opus 5.5 · Max (une jauge fausse
affiche un faux conseil d'arrosage).

Ordre : HR1, HR2, HR3. Les lignes sont indépendantes de la fusion des PR de
registres en file ; une seule fusion à la fois, mise à jour par fusion de
`main`, jamais rebase. Place dans l'ordre : ligne 37, **après** la fin du code
de la simplification (S4 et S6, ligne 33) et **sans attendre** le contrat
multi-modèles (la règle de la section 9 s'y adapte).

## 13. Hors périmètre

- caler la jauge, l'objectif ou le besoin sur l'heure (question 1, ouverte
  seulement sur un résultat du banc) ;
- un mode horaire du calcul d'OTF (MC-19) ;
- l'ET0 horaire passée (réanalyse horaire), l'archive horaire ;
- une alerte « chaleur de l'après-midi » ;
- l'avis d'arroser tôt ou tard : la courbe informe, elle ne conseille pas ;
- l'ET0 mesurée par une station ou un capteur (C1, confié à Nicolas) ;
- le moteur commun (proposition séparée, section 8).

## 14. Ce que le contrat ne prouve pas

- Que la forme théorique ressemble à l'ET0 réelle : elle ne le prétend pas
  (symétrique, section 4.4).
- Que le fournisseur de production donne l'heure à un coût nul : non vérifié
  (section 5).
- Que Open-Meteo répond depuis l'infrastructure partagée de Cloudflare : le
  contrat météo note que sa prévision refusait ces requêtes ; la PR HR2 le
  mesure avant de compter sur `provider-hourly`.
- Que la forme change un jour une décision agronomique : seul le banc le dira.
