# Contrat court — audit ergonomique final, lot C : gestes sûrs (24 octies)

Écrit le 14 novembre 2026 au soir, avant tout code, en Opus 5.5 · Élevé (la
ligne 24 octies de la roadmap), sur le mandat d'autonomie de nuit du
porteur (« pousse du code en autonomie toute la nuit si nécessaire ») :
chaque précision, aucune agronomique, suit l'option recommandée et reste
modifiable par lui. Il couvre les points **R6, A3 et J10** du rapport
`audit-ergonomie-final-2026-11-14.md` (D-117). Aucune règle de calcul ne
change ; aucune donnée, aucune migration. Logiciel multi-fermes : les
règles visent un geste ou une classe de boutons, jamais une ferme.

Registres : décision **D-119**, précisions **F236 et suivantes**, parcours
**P35** (P34 est pris) et P10 étendu.

## 1. Livraison en trois PR, une à la fois

| PR | Point | Fichiers principaux | Preuve |
| --- | --- | --- | --- |
| 1 · Gestes risqués | R6 | `water-management-dashboard.tsx`, `planning/weekly-plan-view.tsx`, `planning/proposal-card.tsx`, une feuille `gestes-surs.css` | P35 (pluie), P10 étendu (planning) |
| 2 · Boutons indisponibles lisibles | A3 | `gestes-surs.css`, `arbitration-plan.tsx`, mesure de contraste des parcours | P31c (toutes les pages, deux largeurs), P7 (répartition validée) |
| 3 · Le bouton « i » | J10 | `styles/help.css` | P35 (toutes les pages, deux largeurs) |

Chaque PR : `lint`, `typecheck`, `test`, `build`, `knip`, `push:check`,
`weather:check` et `e2e` collés ; registres dans la même PR ; la première
verse ce contrat et consigne le déploiement de #52.

## 2. Ce qui ne change pas

Le moteur, le planificateur, les objectifs, la pluie, la répartition ; la
page « Aujourd'hui » et la démonstration (lots A et F) ; les textes des
boutons, leurs noms pour un lecteur d'écran et ce qu'ils font. Aucune
fenêtre de confirmation n'est ajoutée ni retirée.

## 3. R6 — Trois gestes où l'on peut se tromper

**Cause établie dans le code.** « Retirer la mesure » porte bien la classe
du bouton secondaire, mais la règle du formulaire en ligne
(`.water-inline-form > button`, plus forte) le repeint en vert plein,
comme « Enregistrer ». Au planning, « Replier le jour » et « Valider les
n propositions du jour » reçoivent la même règle générale du planning
(vert pâle bordé de vert), l'un sous l'autre à 12 px ; chaque proposition
empile au téléphone trois boutons pleine largeur.

1. **« Retirer la mesure »** (pluie mesurée) : un geste qui efface, dessiné
   comme tel, en contour rouge sur fond blanc (le rouge du « Refuser » du
   planning), écarté du geste courant : à l'ordinateur poussé au bout de la
   ligne, au téléphone 24 px sous « Enregistrer » (F236).
2. **« Replier le jour »** devient un bouton neutre (fond blanc, contour
   gris, texte noir) ; **« Valider les n propositions du jour »** garde son
   vert et se pose **24 px plus bas** au téléphone. À l'ordinateur, le pli
   n'existe pas : rien ne change (F237).
3. **Chaque proposition** : « Valider » seul en grand sur toute la largeur,
   « Ajuster » et « Refuser » côte à côte en dessous, plus petits, chacun
   gardant 44 px de haut, à toutes les largeurs (F238).

**Hors du lot** (rapport, R6) : « Tout vider » (objectifs), déjà rouge,
reste à sa place ; les fenêtres de confirmation, non ouvertes par
l'audit, ne sont pas vérifiées ici.

## 4. A3 — Les boutons indisponibles se lisent

**Cause établie dans le code.** Un bouton indisponible est rendu
transparent (opacité de 0,25 à 0,8 selon le bloc, une vingtaine de règles) : le
blanc sur vert devient blanc sur `#78AC9C`, 2,4 pour 1. La mesure de
contraste des parcours (P31c) écartait les boutons indisponibles, et
n'appliquait la transparence qu'au texte, pas au fond.

1. **Une seule règle pour tous les boutons indisponibles** du module :
   plus de transparence ; fond gris clair, texte gris foncé, contour gris,
   au moins 4,5 pour 1 ; le curseur de chaque page est gardé (F239).
2. **« Répartition validée »** n'est plus un bouton grisé : c'est un état,
   dit par une pastille verte « ✓ Répartition validée » à la place du
   bouton, tant que rien ne change ; « Valider la répartition » revient dès
   qu'une case change (F240).
3. **La mesure des parcours** compte les boutons indisponibles et la
   transparence de tout l'élément, fond compris (F241).

## 5. J10 — Le bouton « i » ne recouvre plus le texte

**Cause établie dans le code.** Le « i » (`FigureOrigin`) est un rond de
24 px, dont la zone tactile grandit à 44 px au téléphone sans grandir le
dessin. Mais dans un bloc dont la règle peint tous ses boutons (le besoin
de la culture d'une planche, `.bed-crop-water button` ; d'autres blocs
pareils), cette règle, plus forte, lui donne fond vert, marge intérieure et
44 px de haut : au téléphone un carré vert de 44 px qui déborde sur
« ET0 » et le chiffre voisin, à l'ordinateur une pilule verte haute. Le
planning s'en gardait déjà par une exception ; les autres blocs non.

1. **Le dessin du « i » ne dépend plus du bloc qui l'accueille** : ses
   règles passent au-dessus de toute règle de bloc ; le même rond partout,
   aux deux largeurs (F242).

## 6. Cas chiffrés (la preuve de fin les met en parcours)

| Cas | Entrée | Attendu |
| --- | --- | --- |
| 1 | « Pluie mesurée », deux largeurs | « Retirer la mesure » sur fond blanc, texte rouge foncé, contour rouge ; « Enregistrer » vert plein ; au téléphone, 24 px au moins entre les deux |
| 2 | Un jour du planning à 390 px avec des propositions | « Replier le jour » fond blanc ; « Valider les n… » vert pâle ; 24 px au moins entre les deux |
| 3 | Une proposition, deux largeurs | « Valider » sur toute la largeur de la ligne ; « Ajuster » et « Refuser » sur une même ligne, en dessous, 44 px de haut chacun |
| 4 | Toutes les pages, deux largeurs, plis ouverts | aucun texte de bouton, indisponible compris, sous 4,5 pour 1 |
| 5 | Répartition validée, rien de changé | pastille « ✓ Répartition validée », aucun bouton « Répartition validée » ; une case décochée fait revenir « Valider la répartition » |
| 6 | Toutes les pages, deux largeurs | chaque « i » : un rond de 24 px, fond blanc (vert une fois ouvert), jamais de marge intérieure ni de fond vert fermé |

## 7. Précisions

- **F236** « Retirer la mesure » : contour rouge, écarté (section 3.1).
- **F237** « Replier le jour » neutre, la validation du jour écartée de 24 px (section 3.2).
- **F238** « Valider » seul en grand, « Ajuster » et « Refuser » côte à côte (section 3.3).
- **F239** une seule règle des boutons indisponibles, sans transparence (section 4.1).
- **F240** « Répartition validée » dite par une pastille, pas un bouton (section 4.2).
- **F241** la mesure de contraste compte les boutons indisponibles et la transparence entière (section 4.3).
- **F242** le « i » garde son dessin dans tout bloc (section 5).

Ce que le lot ne prouve pas : un vrai téléphone au soleil, le mode sombre
(absent, choix n° 5), un lecteur d'écran.
