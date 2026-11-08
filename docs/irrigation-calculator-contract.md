# Contrat — calculateur d'irrigation (code du catalogue de matériel)

Écrit le 6 novembre 2026, avant tout code, d'après le cahier des charges validé par le porteur le 6 novembre 2026 à 14 h 12 (`cahier-des-charges-calculateur-irrigation.md`, dont les 80 % d'eau sur la zone par défaut en aspersion), la recherche documentaire, l'inventaire du matériel de la ferme et l'avis de Francis (Nutri-O). Sous-tranche placée par la roadmap **après la 3.8 et avant la 3.9**, code en **Opus 5.5 · Élevé** ; ce contrat est du travail sans code (Sonnet 5.5 · Moyen, AGENTS.md, « Économie de jetons »). **Les cinq questions de la section 14 ont été tranchées par le porteur le 6 novembre 2026 (21 h 35 à 21 h 37 UTC), chaque fois sur la recommandation** : le contrat est donc validé tel qu'écrit. **Codé le 7 novembre 2026 la nuit, sous le mandat du porteur** (D-070) : neuf précisions faites en codant, tranchées par la recommandation, en section 16.

Le logiciel est **multi-fermes** : rien ici ne suppose la ferme du porteur. Les matériels de sa ferme ne servent que d'exemples chiffrés. Aucun pilotage de programmateur n'est prévu.

## 1. Objet

Aider l'utilisateur à **remplir un réglage de matériel** (le débit en mm/h d'un goutte-à-goutte, le profil mm/h par distance d'une aspersion) à partir de ce qu'il connaît — débit, nombre, espacement, largeur —, au lieu de le deviner. Pas de base de produits (avis de Francis, orientation du 6 novembre 2026) : le calculateur est un **assistant de saisie** qui montre son calcul et dit d'où vient chaque chiffre.

## 2. Ce qui ne change pas

Le calculateur **n'ajoute aucune règle au moteur**. Un réglage reste ce qu'il est (`irrigation-data-model.md`) : un goutte-à-goutte porte une valeur uniforme en mm/h, une aspersion porte deux profils « distance en m → mm/h ». Le calculateur ne fait que **produire ces valeurs**, que l'utilisateur relit et enregistre par l'écran de réglage existant. Couverture (`irrigation-coverage.ts`), surface mouillée (D-022), débit demandé à la pompe, volumes, historique immuable (D-006) et snapshots sont inchangés.

## 3. Vocabulaire

- **Théorique** : ce que le matériel distribuerait, sans perte, sur la surface qu'on lui attribue.
- **Reçu** : ce qui arrive vraiment au sol de la planche, en mm/h, ce que lirait un pluviomètre. **C'est la seule grandeur que le moteur connaît et que le calculateur enregistre.**
- **Efficacité** ou **part d'eau sur la zone** : reçu ÷ théorique, en %. Le 64 % de la fiche Netafim de Francis en est un exemple.
- **Nominal** : le débit du matériel à sa pression, en l/h ou m³/h, ce que la pompe fournit (« eau pompée »).

## 4. Trois niveaux et quatre étiquettes

| Niveau | L'utilisateur saisit | Produit | Étiquette |
| --- | --- | --- | --- |
| 1. Calcul | débit, nombre, espacement, largeur | mm/h théorique | **calculé** |
| 2. Efficacité | un % d'eau sur la zone (défaut proposé, modifiable) ou un profil en cône | mm/h reçu estimé | **estimé** |
| 3. Mesure | des mesures au pluviomètre à plusieurs distances (écran existant) | profil réel | **mesuré** |
| — | un réglage sans provenance connue (tous ceux d'avant ce lot) | — | **saisi** |

Règles :

1. Chaque réglage affiche son étiquette ; elle n'est jamais plus fine que sa source. Le goutte-à-goutte à efficacité 100 % est « calculé » ; dès que l'efficacité saisie est autre, ou en aspersion, il est « estimé ».
2. « Mesuré » ne s'obtient que par un geste de l'utilisateur : une case « Ces valeurs viennent de mes mesures au pluviomètre » dans l'écran de réglage. Le logiciel ne classe jamais de lui-même un chiffre en « mesuré ».
3. Un réglage existant sans provenance est **« saisi »**, jamais « mesuré » ni « calculé » : on ne devine pas (D-003).
4. Le logiciel ne bloque jamais faute de donnée : un champ manquant rend le résultat concerné **inconnu** (`null`, « — »), pas zéro, et l'écran dit lequel manque.

## 5. Goutte-à-goutte

Deux saisies, un même résultat (mm/h uniforme, étiquette « calculé » à 100 %).

**a) Par planche.** Entrées : nombre de lignes par planche `n`, débit par goutteur `q` (l/h), espacement des goutteurs `e` (m), **largeur de la planche** `w` (m), efficacité `η` (défaut 100 %, le tuyau ne mouille que la planche, D-022). Autorégulant : oui ou non (section 7).

    mm/h théorique = n × (q ÷ e) ÷ w
    mm/h reçu      = théorique × η

(1 mm sur 1 m² = 1 litre : la conversion passe par une fonction nommée de `units.ts`, aucun `1000` dans le calcul.) Exemple de la ferme : n = 2, q = 1,6, e = 0,30, w = 0,75 → 14,22 mm/h.

**b) Par vanne** (saisie de Francis). Entrées : nombre de lignes `N`, longueur de chaque ligne `L` (m), espacement `e`, débit `q`, et **écartement entre lignes** `g` (m).

    débit de la vanne (l/h) = N × L × q ÷ e          → affiché aussi en m³/h
    mm/h reçu               = q ÷ (e × g) × η

Sans `g`, le **débit de la vanne** s'affiche seul et le mm/h reste inconnu, avec « écartement entre lignes manquant ». Le nombre de goutteurs est pris en continu (`L ÷ e`, au plus un goutteur par ligne d'écart, moins de 1,5 % sur 25 m à 0,33 m) : c'est une estimation, étiquetée comme telle dans « Voir le calcul ».

**Écart avec le réglage actuel.** Quand le calculateur est ouvert depuis un réglage existant et que le résultat diffère de la valeur enregistrée, l'écran affiche « Réglage actuel 8 mm/h, calculé 14,2 mm/h ». **Le calculateur n'écrase jamais** : seule la validation du formulaire de réglage enregistre (cas de la ferme, qui garde 8 mm/h, décision du 6 novembre 2026).

**Limite écrite.** Un réglage de goutte-à-goutte est une valeur unique appliquée à toutes les planches où le matériel est posé : la largeur `w` est celle d'une planche typique, et une planche plus large ou plus étroite aura en réalité un autre mm/h. L'écran le dit sous le champ. Un mm/h par planche est hors de ce lot.

## 6. Aspersion

Le moteur a besoin d'un **profil par distance** (la rampe est posée entre ou sur des planches). Deux manières de l'estimer, au choix de l'utilisateur ; les deux sont étiquetées **estimé**.

Entrées communes : débit par asperseur `Q` (l/h ou m³/h), pression (section 7), nombre `k` d'asperseurs et espacement `s` (m) le long de la rampe, **portée** `R` (m, rayon mouillé ; le diamètre mouillé de la fiche se divise par deux).

### 6.1 Pluviométrie moyenne, avec efficacité (niveaux 1 et 2)

Pour les micro-asperseurs et asperseurs qui arrosent une bande de largeur connue (serre, SuperNet, Hadar). Entrées en plus : largeur arrosée `w` (m), efficacité `η` (**défaut 80 %**, la cible de Francis, modifiable de 1 à 100 %).

    mm/h théorique = Q ÷ (s × w)
    mm/h reçu      = théorique × η
    profil         = mm/h reçu de la distance 0 à w ÷ 2, de chaque côté (2 points par côté), 0 au-delà

**Avertissement, pas refus** : si `w` < 2 × `R`, le jet est plus large que la bande, l'eau tombe surtout à côté et cette moyenne est trompeuse ; l'écran propose le profil en cône.

### 6.2 Profil estimé en cône (niveau 2, pour les rampes à grande portée)

Chaque asperseur répartit son débit en cône : `p(r) = 3Q ÷ (π R²) × (1 − r ÷ R)` pour `r` < `R`. Sur une rampe longue d'asperseurs régulièrement espacés de `s`, la pluviométrie à la distance `d` de la rampe est la somme continue le long de la rampe, avec `a = √(R² − d²)` :

    P(d) = 3Q ÷ (π R² s) × [ 2a − ( a×R + d² × ln((a + R) ÷ d) ) ÷ R ]      (d > 0)
    P(0) = 3Q ÷ (π R s)                                                     P(d ≥ R) = 0

Cette forme conserve l'eau : l'intégrale de `P` sur les deux côtés vaut `Q ÷ s`. Points du profil : 11 points également espacés de 0 à `R` (distance arrondie au centimètre, mm/h au centième), profil **identique à gauche et à droite**. Avertissement si `s` > `R` : la moyenne le long de la rampe n'a plus de sens.

**Pas d'efficacité ici.** La forme du cône contient déjà l'eau qui tombe hors des planches : l'appliquer encore compterait la perte deux fois. L'écran affiche à la place, **à titre d'information**, la part d'eau qui tombe sur la largeur d'une planche et de son passe-pied (`∫ P` sur cette largeur ÷ `Q ÷ s`), ce qui répond à la question de Francis, sans rien changer au profil. Le cône ne modélise ni vent, ni dérive, ni évaporation : c'est dit sous le profil.

### 6.3 Ce que le calculateur ne fait pas en aspersion

Pas de hauteur du jet, pas de recouvrement entre deux rampes (l'utilisateur pose deux rampes, le moteur additionne déjà leurs contributions), pas de secteur partiel, pas d'enrouleur en déplacement. Un profil publié ou mesuré se saisit à la main (niveau 3).

## 7. Pression et débit

Le débit réel dépend de la pression, et il est souvent plus bas que la fiche. Règles :

1. **Une mesure prime toujours.** Si l'utilisateur saisit un débit mesuré, il est utilisé tel quel, sans correction (il contient déjà la pression réelle).
2. Sinon, avec un débit de référence `Qref` à une pression `Pref` (bar) lus sur la fiche, et la pression réelle `Pr` si l'utilisateur la connaît : `Q = Qref × (Pr ÷ Pref)^x`. Exposant `x` : **0** pour un goutteur ou un asperseur autorégulant (dans sa plage), **0,5** par défaut sinon (buse), modifiable.
3. Sans pression réelle, `Q = Qref` ; l'écran dit « débit de la fiche, à la pression de la fiche ».
4. Une plage de pression conseillée (facultative, fournie par l'exemple ou par l'utilisateur) déclenche un avertissement si `Pr` est dehors. Rien n'est refusé.

Vérification : le Naan 427 (450 l/h à 2 bars, `x` = 0,5) à 0,35 bar donne 188,2 l/h, proche des 191 l/h mesurés par le porteur en 2025 : le calcul retrouve l'écart que l'inventaire avait déduit.

## 8. Eau pompée et eau reçue : la règle

**Le calculateur enregistre de l'eau reçue (mm/h) ; l'efficacité s'applique une seule fois, dans le calculateur, jamais dans le moteur.** Un profil mesuré porte déjà la perte ; un profil en cône aussi ; une moyenne reçoit `η`. Aucune de ces trois valeurs n'est ensuite multipliée ou divisée : pas de double compte, par construction.

Le **débit nominal** (nombre × `Q`, en l/h et m³/h) s'affiche à côté du résultat, étiqueté « eau pompée », sans entrer dans le moteur. Le débit demandé à la pompe, les volumes de réserve et la limite journalière restent `mm/h reçu × surface mouillée` (D-022). Conséquence connue : ils sous-estiment la part d'eau qui tombe hors de la planche et du passe-pied (par exemple 36 % pour la fiche Netafim). Les faire suivre l'eau nominale toucherait D-022, le débit enregistré des irrigations (immuable, D-006) et tous les volumes : c'est une **décision séparée**, posée à la question 1 de la section 14, jamais glissée dans ce lot.

## 9. Exemples de départ (pas une base)

Une courte liste **dans le code**, au domaine, non stockée en base, identique pour toutes les fermes. Un exemple ne préremplit que des champs de la section 5 ou 6 ; l'utilisateur les modifie librement. Chaque exemple porte sa source, la date de lecture et ses réserves, affichées à l'écran.

| Exemple | Champs préremplis | Source et réserve |
| --- | --- | --- |
| NaanDanJain 427 B-AG, buse orange 2,8 mm | `Qref` 450 l/h à 2 bars, `x` 0,5, `R` 11 m, plage 2 à 4 bars | fiche Bosta type 427 ; 550 l/h à 3 bars et 630 à 4 bars en note |
| NaanDanJain Hadar 7110 inversé, buse 1,8 mm | `Qref` 166 l/h à 2 bars, `x` 0,5, `R` 5,3 m, plage 1,5 à 3 bars | fiche Bosta, article 0610025 ; valeurs de l'inventaire **confirmées sur la fiche le 7 novembre 2026** (C5) |
| NaanDanJain AmnonDrip PC AS Ø16 | `q` 1,6 l/h, `e` 0,30 m, `x` 0, plage 0,5 à 3,5 bars | fiche technique longue NDJ (9 août 2018) ; autorégulant de 0,5 à 4 bars, mais tuyau Ø16 de 2,5 à 3,5 bars au plus selon sa paroi : **plage retenue de 0,5 à 3,5 bars** (C4, 7 novembre 2026) |
| Netafim SuperNet SR 30 l/h | `Q` 30 l/h, `s` 1 m, `w` 3 m, `η` 64 % | fiche de simulation de Francis (Nutri-O), hauteur 0,5 m, 2,5 bars |

MAMKAD, 5022 et 5035 ne sont **pas** dans la liste : aucune valeur sourcée n'est en main, et rien n'est inventé (question 4). Pas de copie en masse de données de fabricant : pas de question de licence de données ; les noms de marque sont des références, sans partenariat suggéré.

## 10. Données

Les valeurs enregistrées sont celles du réglage existant : aucune colonne n'est ajoutée à `irrigation_equipment_settings`. La **provenance** s'enregistre à côté, dans une table nouvelle (migration additive, prochain numéro libre au moment du code, D-018), `irrigation_equipment_setting_calculations`, une ligne au plus par réglage :

- identifiant du réglage (suppression en cascade avec lui), identifiant de l'espace de travail (isolation par utilisateur, comme toute donnée) ;
- `level` (`calculated` ou `estimated`), `method` (`drip_per_bed`, `drip_per_valve`, `sprinkler_mean`, `sprinkler_cone`) ;
- `inputs_json` : les entrées saisies et la version de la formule, pour rouvrir le calculateur prérempli ;
- `theoretical_rate_mm_per_hour` et `zone_share_percent` (nuls quand sans objet), `nominal_flow_liters_per_hour`, date de calcul.

L'étiquette « mesuré » est une colonne de la même table (`level = 'measured'`, sans entrées) ; « saisi » est l'absence de ligne. **Modifier à la main** les valeurs d'un réglage calculé supprime la ligne de provenance : il redevient « saisi » (ou « mesuré » si la case est cochée), le logiciel n'affirme pas qu'un chiffre retouché vient encore de la formule. Les snapshots d'irrigation copient le réglage comme aujourd'hui, sans l'étiquette ; l'ajouter est hors de ce lot.

## 11. Écran

Dans la fenêtre « Configurer les réglages » du matériel (`equipment-settings-dialog.tsx`), un bouton **« Calculer depuis le matériel »** ouvre le calculateur selon la nature du matériel (goutte-à-goutte : par planche ou par vanne ; aspersion : moyenne ou profil en cône), avec la liste d'exemples. Il montre :

- le résultat en direct, avec son **étiquette** (calculé, estimé) et les champs qui manquent ;
- **« Voir le calcul »** : la formule avec les nombres de l'utilisateur ;
- le débit nominal (l/h et m³/h), l'écart avec le réglage actuel, les avertissements (jet plus large que la bande, `s` > `R`, pression hors plage, valeur supérieure à 100 mm/h, vraisemblablement une faute d'unité) ;
- le profil en cône sous forme de petit graphique, avec la part d'eau sur une planche.

« Utiliser ce résultat » remplit le formulaire de réglage (nom suggéré, valeur ou points) ; **rien n'est enregistré avant la validation du formulaire**. Le style suit la charte du module (refonte ergonomique). Aide contextuelle : celle de la 3.8, qui précède ; le calculateur y devient une fonctionnalité à cocher (D-067, `docs/feature-selection-contract.md`, section 2). À 390 px, le calculateur tient en une colonne.

## 12. Validation

Nombres finis, strictement positifs pour débit, espacement, largeur, portée, pression ; nombre de lignes et d'asperseurs entiers ≥ 1 ; `η` de 1 à 100 ; message clair par champ, en français, sans bloquer l'ouverture du calculateur. Toutes les conversions d'unités passent par `lib/domain/units.ts` ; les constantes (11 points, 80 %, 0,5, 100 mm/h d'alerte) sont nommées et commentées. Le domaine (`lib/domain/irrigation-calculator/`) n'importe que le domaine ; l'écran et la persistance l'appellent, la formule vit une seule fois.

## 13. Hors périmètre

Base de produits ou de buses ; pilotage des programmateurs ; pertes de charge, HMT et pompe (`pumps-hydraulic-contract.md`) ; vent, évaporation, hauteur du jet ; enrouleurs en mouvement ; lance manuelle ; correction du moteur pour l'eau nominale (question 1) ; mm/h par planche en goutte-à-goutte ; valeurs de MAMKAD, 5022, 5035.

## 14. Questions pour le porteur

Une par message, chacune avec sa recommandation. Le contrat est écrit sur ces recommandations ; une autre réponse le modifie avant tout code.

1. **Eau perdue hors zone.** Faut-il que le débit demandé à la pompe et les volumes de réserve suivent l'eau pompée (nominale), au lieu de l'eau reçue ? Recommandé : **pas dans ce lot**, décision séparée (section 8).
2. **Deux manières en aspersion.** Moyenne avec efficacité 80 % (micro-asperseurs, serre) et profil en cône sans efficacité (rampes à grande portée) ? Recommandé : **oui, les deux**, parce que la moyenne est fausse pour un 427 sur une planche de 0,75 m.
3. **Correction de pression.** Inclure dans ce lot le calcul du débit selon la pression (section 7), facultatif ? Recommandé : **oui**, car la ferme mesure 191 l/h là où la fiche donne 450 l/h.
4. **Exemples de départ.** Quatre exemples sourcés, MAMKAD, 5022 et 5035 hors du lot tant que Francis ne fournit pas de valeurs relevées ? Recommandé : **oui**.
5. **Largeur de référence en goutte-à-goutte.** Une largeur de planche typique par réglage, avec la limite écrite à l'écran, plutôt qu'un mm/h par planche ? Recommandé : **oui** ; le mm/h par planche demanderait de changer le moteur.

## 15. Preuve de fin

Tests de domaine, valeurs attendues écrites avant le code :

| Cas | Attendu |
| --- | --- |
| SuperNet 30 l/h, `s` 1 m, `w` 3 m | théorique 10 mm/h ; à 64 % : **6,4 mm/h** (Francis annonce 6,8 : écart à comprendre, sans doute le profil réel ; le test n'est pas plié à 6,8) |
| AmnonDrip, 1 ligne, `w` 0,75 m | 7,11 mm/h ; 2 lignes : **14,22 mm/h** |
| Vanne de Francis, 30 lignes de 25 m, 1 l/h tous les 33 cm | débit **2 272,7 l/h = 2,27 m³/h** ; sans `g` : mm/h inconnu ; avec `g` = 0,5 m : 6,06 mm/h |
| Hadar 7110, 166 l/h, `s` 2,475 m, `w` 4 m | 16,77 mm/h (l'inventaire, avec 26 asperseurs sur 260 m², dit 16,6 : écart des extrémités) |
| Cône 427, 450 l/h, `R` 11 m, `s` 6,4 m | à 0 · 1 · 2 · 3 · 4 · 6 · 8 · 10 m : **6,10 · 5,92 · 5,52 · 4,98 · 4,34 · 2,91 · 1,47 · 0,31 mm/h** (à ± 0,01) ; `P(11)` = 0 |
| Cône Hadar, 166 l/h, `R` 5,3 m, `s` 2,48 m | à 0 · 1 · 2 · 3 · 4 · 5 m : **12,06 · 10,83 · 8,37 · 5,42 · 2,51 · 0,30 mm/h** |
| Conservation | pour chaque cône, intégrale de `P` sur les deux côtés = `Q ÷ s` à 0,5 % |
| Pression | 450 l/h à 2 bars, `x` 0,5, 0,35 bar → **188,2 l/h** ; débit mesuré saisi → utilisé tel quel ; `x` 0 → inchangé |
| Pas de double compte | en cône, `η` est ignorée (test avec 50 %) ; en moyenne, `η` s'applique une fois ; `calculateIrrigationCoverage` sur un réglage issu du calculateur rend exactement la valeur enregistrée |
| Données inconnues | champ manquant → `null`, jamais 0, avec le nom du champ manquant |

Tests de persistance : provenance écrite à l'enregistrement par le calculateur ; modification manuelle des valeurs la supprime (« saisi ») ; case « mesuré » ; suppression du réglage la supprime ; isolation par espace de travail ; migration additive sans toucher aux réglages existants ; aucun réglage existant ne change de valeur. Parcours navigateur (prochain numéro libre après P21) : ouvrir le calculateur, choisir un exemple, voir le calcul, utiliser le résultat, enregistrer, vérifier l'étiquette ; recette à 390 px. Recette réelle sur la ferme **sur le « vas-y » du porteur**, en lecture seule ou avec remise en l'état (AGENTS.md). Registres à jour dans la PR de code : roadmap en trois endroits, état du projet, décisions, journal des modifications.

## 16. Précisions faites en codant (7 novembre 2026, D-070)

Tranchées par la recommandation sous le mandat de nuit du porteur ; le détail
et les raisons sont dans D-070.

| N° | Précision |
| --- | --- |
| C1 | Le calculateur est la onzième case, sans page ni adresse ni entrée du menu, après « Matériel et placement », dont il a besoin ; une ferme qui avait choisi le trouve décoché, annoncé par le bandeau (R7). |
| C2 | Décoché : ni bouton, ni étiquette, ni case « mesuré », provenance non lue ; enregistrer un réglage la garde si ses valeurs ne changent pas. |
| C3 | La provenance se décide au serveur (`decideProvenance`) : « mesuré » coché l'emporte ; un calcul s'écrit seulement si, refait au serveur, il retrouve exactement les valeurs ; valeurs retouchées ou « mesuré » décoché : « saisi » ; valeurs inchangées : la provenance reste. |
| C4 | AmnonDrip Ø16 : plage de 0,5 à 3,5 bars (pression maximale du tuyau), la réserve donne les parois plus minces. |
| C5 | Hadar 7110, buse 1,8 mm : 166 l/h et 5,3 m à 2 bars, de 1,5 à 3 bars, confirmés sur la fiche. |
| C6 | Un exemple préremplit la manière choisie ; sa manière conseillée est dite ; il vide d'abord le débit, la pression et la plage de l'exemple précédent. |
| C7 | En cône, la part d'eau sur la planche se lit sur une bande centrée sur la rampe, d'une largeur saisie à part (planche et passe-pied), sans effet sur le profil. |
| C8 | Dupliquer un matériel ne copie pas la provenance : la copie est « saisie ». |
| C9 | Le nom suggéré par « Utiliser ce résultat » ne remplace jamais un nom déjà saisi. |
