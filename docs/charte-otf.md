# Charte graphique d'Ouvre ta ferme (OTF) et recommandations pour notre module

Date : 6/11/2026. Méthode et limites d'abord, car elles bornent la fiabilité de ce relevé.

## 0. Ce qui a été vu (mis à jour après connexion, 6/11/2026 08 h)

- **Parcouru en lecture seule dans votre session** (aucun clic sur un bouton d'action, aucun champ rempli) : Nouveau planning (semaine), ancien planning hebdomadaire, Plan de culture, Plan d'assolement, Prévisionnel financier, Semences et plants, Itinéraires techniques, Plan de la ferme (carte), Bibliothèque de cultures, Variétés préférées, Boîte à outils, Temps de travail, Analyse des cultures. Mesures faites sur les styles réellement appliqués par le navigateur.
- **Vieilles / nouvelles pages** : l'ancien planning affiche lui-même « Un nouveau planning est disponible en bêta… il remplacera ce planning le 7 novembre ». Les pages « Bibliothèque », « Variétés » et « Boîte à outils » (encadré vert cerné d'un trait rugueux, étiquette « Nouveau ») sont les plus récentes. Les autres pages de production gardent le même cadre (menu à gauche, onglets, tableaux).
- **Ce que j'avais trouvé en ligne (feuille de style publique) est exact pour les polices, rayons, ombres, gris, bordures. Il fallait corriger trois points** (voir ci-dessous, marqués ⚠) : la couleur de fond du menu, le vert réellement utilisé pour les actions, et la police du texte courant.
- Non vu : les pages Vente et Gestion (hors production), les fenêtres de saisie (cliquer sur « + » ou un bouton ouvre un formulaire : refusé par prudence).

## 1. La charte OTF

### 1.1 Typographie
| Rôle | Police | Détail |
|---|---|---|
| Titres | **Bricolage Grotesque** | page connectée : h1 22,75 px / **300 (léger)**, gris très foncé `#1e1e1e` ; accueil public : h1 39 px / 700 vert-bleu `#1d4b53`. Sous-titres h3 en DM Sans 19,5 px / 500 |
| Texte courant (tableaux, formulaires) | **Open Sans** ⚠ | 13 px, 400. DM Sans sert aux boutons, onglets, menus, libellés (500) ; Open Sans au corps des pages connectées |
| Texte d'accroche | **Bitter** (serif) | rare, éditorial |
| Chiffres techniques | Roboto Mono | |
| Ancien site | Open Sans | encore chargée |

Taille de base : `html { font-size: 13px }` (12 px sur téléphone). Tout est en `rem` : les tailles en px figés sont l'exception.

### 1.2 Couleurs (valeurs mesurées sur les pages de production)
- **Menu de gauche** (largeur 247 px) : fond **vert très pâle `#e7f1ee`** ⚠ (teinte de l'univers Production). Entrée choisie : fond **`#0b694d`** (vert sombre), texte blanc, rayon 9,75 px, hauteur 33 px.
- **Feuille de contenu** (page, en-tête, pied de page) : **`#f8f8f8`** ; blocs et cartes blancs ; lignes de tableau `#fcfcfe` / `#f2f2f5`.
- **Texte** `#111`, secondaire `#5F5F5F` (en-têtes de tableau 11,7 px, graisse 550, `#5F5F5F`).
- **Vert d'action de la production : `#0b694d`** ⚠ (et non `#0f8c66`, qui est sa version claire) : boutons pleins (« Nouvelle série », « Assoler mes séries »), entrée de menu choisie, liens actifs. Pastille ronde de l'univers en haut du menu : `#0f8c66`. Teinte douce `#CCE2D1` / `#cadbd8` pour le fond des boutons en contour, des tuiles de totaux (prévisionnel) et du survol.
- **Boutons** : « Nouvelle … » en **plein vert** `#0b694d` texte blanc ; boutons d'outil en **contour gris foncé** `#373737`, fond transparent ; boutons secondaires en contour vert sur fond teinté. Rayon **14,6 px** (presque en pilule), texte DM Sans 13 px / 500. Anthracite `#373737` reste la couleur « neutre » ; le bouton noir du site public n'existe pas dans l'application.
- **Champs** : fond blanc, bordure `rgba(0,0,0,.13)`, rayon 9,75 px, marges 5×10 px (+32 px à droite pour la flèche d'un select).
- **Onglets** (Séries, Récoltes, Temps de travail, 3D) : fond gris `#f8f8f8`, rayon haut 9,75 px, filet fin.
- **Bords et gris** `#ddd`, `#F2F2F2`.
- **Autres univers** : Vente = bleu-violet `#4E5FC0` / `#3b4790` ; Gestion = bleu canard `#22829f` ; Réglages = violet `#8747b1`. Pastilles rondes en haut du menu, une couleur chacune.
- **Sémantique** : info `#e1eaff`, succès `#198754`, attention `#d4aa00`, avertissement `#cb6503`, danger `#dc3545`, avec versions assombries de 28 % pour le texte sur fond clair (contraste 4,5:1 vérifié par OTF).
- **Couleurs de données** : chaque famille de culture a une couleur propre (diagrammes de plan de culture : barres vertes, violettes, bleues). Étiquettes de séries en pastilles colorées (`#17`, `#44`…).
- Accueil public : `#1d4b53` (titres), `#1f8a5a` (accent).

### 1.3 Espacements, formes, ombres
- Échelle d'espacement : 0,25 · 0,5 · 0,75 · 1 · 1,5 · 2 · 3 rem (`--space-xxs…xxl`).
- Rayons : **.75 rem** (standard : boutons, cartes, champs), 1 rem, 1.5 rem ; un bouton fait 6,5×9,75 px de marge, rayon 9,75 px.
- Ombres très douces : carte `0 1px 3px rgba(0,0,0,.06)` ; v2 `0 4px 20px rgba(0,0,0,.06)` (survol/sélection `.18`) ; panneau flottant `0 0 0 1px bordure, 0 1px 3px, 0 10px 28px`.
- Cartes : blanches, ombre `0 4px 20px rgba(0,0,0,.06)`, rayon 9,75 px, marges 10×13 px (mesuré sur le Nouveau planning).
- Cible tactile **44 px** minimum (`--touch-target`), hauteur de pastille 2,25 rem.
- Anneau de focus **3 px** de la couleur de l'univers (70 %).

### 1.4 Composants et navigation
- **Barre du haut** blanche : logo (croix + « Ouvretaferme » en Bricolage), menus, bouton **« Se connecter » noir arrondi** à droite. Hauteur 3–3,75 rem.
- **Gabarit « structure »** : menu d'univers à gauche (jeton de l'univers ouvert coloré), grande **feuille grise** où le contenu se pose en blocs blancs.
- **Onglets** : libellé 1,1 rem, 1 rem de marge, **trait de 5 px** sous l'onglet choisi, de la couleur de l'univers.
- **Tableaux** : lignes alternées (#fcfcfe / #f2f2f5), survol et sélection teintés de la couleur de l'univers, groupes de lignes, hachures grises pour les absences.
- **Cartes** : blanches, bordure fine, rayon .75 rem, ombre très légère ; sur l'accueil, grandes tuiles avec **icônes au trait** bleu-vert foncé et libellé centré.
- **Icônes** : au trait, monochromes (couleur du texte/de l'univers), pas de pictos colorés ni d'emojis. Illustrations : feuilles et fleurs en pastel, décoratives.
- **Tons** : phrases courtes, ton direct, vouvoiement.

## 1bis. Version téléphone (mesurée à 375 px de large, 6/11/2026)

Pages vues : Nouveau planning, Plan de culture, Prévisionnel financier. Pas de défilement horizontal de la page (375 pour 375 px).

- **Taille du texte** : la base descend à **12 px** (13 px sur ordinateur).
- **Barre du haut** : bandeau **anthracite `#373737`**, 36 px de haut, avec le nom de la ferme et une flèche, la cloche (pastille de notifications) et l'avatar. Elle défile avec la page.
- **Barre du bas fixe en deux étages** :
  1. 4 pastilles d'univers rondes avec libellé dessous : Production (vert), Vente (bleu-violet), Gestion (bleu canard), Paramètres (violet). L'univers ouvert a un anneau ; fond blanc, 57 px de haut.
  2. Au-dessus, une **bande de sous-menu qui défile en largeur** : pages de l'univers sous forme de texte, la page courante en **pilule verte pleine `#0b694d`** texte blanc. Le menu latéral de l'ordinateur n'existe pas sur téléphone.
- **Titre de page** en Bricolage Grotesque léger, avec à droite des boutons ronds (PDF, « + » vert plein).
- **Onglets** de page : 42 px de haut, trait vert sous l'onglet actif ; le sélecteur de période est une pilule en contour vert.
- **Tableaux** : les colonnes de gauche restent, le reste se lit en faisant défiler le tableau ; les en-têtes de familles sont des bandeaux gris avec icône de culture ; les totaux deviennent des **tuiles pâles `#e3f2ee` en grille de 2 colonnes** (la 3e passe dessous).
- **Planning** : les cartes « À faire / Fait » passent en onglets pilule (« À faire 13 », « Fait 37 ») au lieu de deux colonnes ; une carte par catégorie d'intervention, cases à cocher, pastille ronde à droite pour valider.
- **Cibles tactiles** : onglets 42 px, boutons ronds ≈ 27-36 px, cases à cocher 12 px : **OTF reste en dessous de 44 px à plusieurs endroits** ; nous pouvons faire mieux (44 px) sans jurer.

## 2. Notre module aujourd'hui (d'après le dépôt, `app/globals.css` et `app/irrigation/styles/*.css`)

| Sujet | Notre module | OTF |
|---|---|---|
| Police du texte | Aptos / Segoe UI (selon le poste) | Open Sans (corps), DM Sans (boutons, onglets, menus) |
| Titres | **Georgia (serif)**, ~20 usages | Bricolage Grotesque (sans-serif) |
| Fond | `#f3f6f0` verdâtre + halo lime en dégradé | feuille `#f8f8f8`, blocs blancs, menu vert pâle `#e7f1ee` |
| Texte | `#17312c` (vert très foncé) | `#111111` |
| Couleur d'accent | vert `#176b4a` partout, + bleu `#167eae` | vert **`#0b694d`** (boutons pleins, menu choisi), contour gris `#373737` pour les outils |
| Bordures | `#dbe4df` teintées de vert | `#ddd` neutre |
| Rayons | 8 à 14 px, dispersés (9, 10, 11, 12…) | un seul : .75 rem (≈ 10 px à 13 px de base) |
| Tailles de texte | ~230 déclarations en **px** de 8 à 13 px | `rem`, base 13 px |
| Jetons | 9 variables seulement, couleurs en dur ailleurs (~25 teintes de gris-vert) | ~150 variables nommées |
| Cible tactile | 44 px par endroits (formulaires), pas systématique | 44 px partout |

Points forts à garder : nous avons déjà le vert OTF de la production, un focus visible, des cibles de 44 px sur les formulaires, et des contrastes soignés.

## 3. Recommandations pour harmoniser (par ordre de rentabilité)

1. **Remplacer le serif Georgia par Bricolage Grotesque** pour les titres, et Aptos par **Open Sans** pour le texte, **DM Sans** pour boutons, onglets et menus (polices libres, à héberger chez nous). C'est le changement qui se voit le plus, et ce que OTF fait de plus reconnaissable. Garder un repli `sans-serif`.
2. **Fond neutre** : passer de `#f3f6f0` + halo lime à la feuille `#f8f8f8`, supprimer le dégradé de `body`, poser le contenu en **blocs blancs** ; si le module a un menu latéral, le teinter `#e7f1ee` ; texte `#111`, secondaire `#5F5F5F`/`#6b6b70`, bordures `#ddd`.
3. **Vert d'action = `#0b694d`** (tinté `#CCE2D1`) pour boutons pleins, entrée de menu choisie, survol et focus ; **boutons d'outil en contour `#373737`**, boutons secondaires en contour vert sur fond teinté ; rayon de bouton ≈ 14,6 px (1,125 rem). Garder nos `--green*` comme alias de ces valeurs le temps de la transition.
4. **Un seul rayon** `.75rem` (variable), 1 rem pour les grands blocs ; ombres OTF (`0 1px 3px rgba(0,0,0,.06)` ; `0 4px 20px rgba(0,0,0,.06)`).
5. **Onglets** : libellé 14,3 px DM Sans 500, fond `#f8f8f8`, angles hauts arrondis (.75 rem), onglet choisi relié à la feuille ; titres de page en Bricolage Grotesque **léger (300)**.
6. **Tableaux** : lignes alternées `#fcfcfe` / `#f2f2f5`, survol teinté `#CCE2D1`.
7. **Couleurs d'état** : reprendre succès `#198754`, avertissement `#cb6503`, danger `#dc3545` et leurs versions « sur fond clair » (−28 % de clarté) pour le texte. Pour l'eau, garder un bleu à part, mais le sortir de la palette OTF (pas de bleu `#167eae` pour les boutons).
8. **Variables et unités** : déclarer les jetons (couleurs, espacements 0,25 → 3 rem, rayons, ombres, 44 px) en tête de `globals.css` ; passer progressivement les `px` de texte en `rem`. Attention : les 9–13 px actuels sont plus petits que le 13 px de base d'OTF ; l'objectif est ≥ 13 px (lisibilité sur téléphone, point resté au jugement de François).
9. **Icônes au trait** monochromes (pas d'emojis), de l'épaisseur et du style de celles de l'accueil OTF.
10. **Intégration** : un module qui s'ouvre dans OTF devrait reprendre l'en-tête OTF (blanc, logo, bouton noir) ; s'il reste sur un autre site, au minimum le même bandeau et les mêmes polices.

11. **Téléphone** : base 12 px ; barre du haut anthracite `#373737` ; barre du bas fixe avec les pastilles d'univers puis une bande de pages qui défile (page courante en pilule verte `#0b694d`) ; cartes en pile, onglets « À faire / Fait » ; cibles ≥ 44 px.

Ordre de mise en œuvre conseillé : (1)+(2)+(4) en un lot « jetons », puis (3)+(5)+(6), puis (7)–(9). Ce sont des changements de CSS sans effet sur les calculs ; ils passent par une PR comme les autres, à planifier dans la roadmap avec votre accord (rien n'a été modifié ici).

## 4. Intérêt direct pour notre module
- OTF a déjà dans sa **Boîte à outils** « Consommation d'eau » (suivi de l'eau consommée à la ferme) et « Pluviométrie » : notre module devrait s'y présenter comme un complément, avec le même encadré d'accueil vert à trait rugueux et la même carte-lien (icône, titre, une ligne de description, flèche).
- Les bandeaux de totaux du Prévisionnel (tuiles teintées `#CCE2D1`, chiffre grand) sont un bon modèle pour nos synthèses d'eau.

## 5. Doutes à lever
- Fenêtres de saisie (formulaires ouverts par « + ») non vues : prudence, elles auraient pu enregistrer.
- Pages Vente et Gestion non parcourues ; téléphone : seulement 3 pages (planning, plan de culture, prévisionnel), émulé à 375 px dans un navigateur de bureau, pas sur un vrai téléphone.
- La licence des polices (open source, SIL OFL) est à confirmer avant de les embarquer.
