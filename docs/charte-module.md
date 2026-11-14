# Charte graphique du module d'irrigation (validée par François le 6/11/2026)

Inspirée de la charte d'Ouvre ta ferme (étude : `docs/charte-otf.md`). Huit éléments validés un par un par le porteur, option recommandée à chaque fois. Le module reste multi-fermes. Appliquée par la refonte ergonomique, en trois temps (voir « Application » en fin de document).

## 1. Polices
Titres : Bricolage Grotesque léger (300), 22,75 px ordinateur. Sous-titres, boutons, onglets, menus : DM Sans (500). Texte courant : Open Sans (13 px ordinateur, 12 px téléphone). Plus de Georgia ni d'Aptos. Repli sans-serif. Hébergées chez nous (`public/fonts/`) ; licence SIL OFL 1.1 confirmée le 6/11 pour les trois polices (hébergement permis ; `OFL.txt` et copyright joints à chaque police, `public/fonts/README.md`).

## 2. Fond et blocs
Feuille #f8f8f8, blocs blancs, ombre 0 4px 20px rgba(0,0,0,.06) (légère : 0 1px 3px rgba(0,0,0,.06)). Menu latéral #e7f1ee. Texte #111, secondaire #5f5f5f, bordures #ddd. Un seul rayon : 0,75 rem. Plus de fond verdâtre ni de halo.

## 3. Boutons et vert d'action
Action principale : plein #0b694d, texte blanc. Secondaire : contour vert sur fond #cce2d1. Outils : contour #373737. Destructif : rouge (#dc3545, texte #8f1d2a sur fond #fbe5e8). Rayon ≈ 14,6 px, DM Sans 13 px / 500. Pastille d'univers #0f8c66. Cibles tactiles ≥ 44 px sur téléphone. Le bleu #167eae quitte les boutons.

## 4. Onglets
Ordinateur : libellé DM Sans 14 px / 500, onglet choisi blanc avec trait vert de 5 px, angles hauts arrondis. Téléphone : onglets en pilule (« À faire / Fait »), 44 px de haut.

## 5. Tableaux et tuiles de totaux
Lignes alternées #fcfcfe / #f2f2f5, en-têtes 11,7 px #5f5f5f, chiffres à droite en chiffres tabulaires, survol #cce2d1. Totaux en tuiles pâles #e3f2ee (grille de 2 colonnes sur téléphone). Pluie et eau en tuile bleu eau.

## 6. Couleurs d'état et bleu eau
Succès #198754, attention #cb6503, danger #dc3545, info #e1eaff ; texte assombri de 28 % sur fond clair (contraste 4,5:1). Eau et pluie : bleu #1f6fb2, fond #dcebf7, jamais sur un bouton. Le bleu précis peut être affiné à l'application.

## 7. Navigation
Ordinateur : menu à gauche #e7f1ee, entrée choisie en #0b694d texte blanc (rayon 9,75 px, hauteur 33 px). Téléphone : barre du haut anthracite #373737 (36 px, nom de la ferme, cloche, avatar) ; barre du bas fixe à **quatre entrées et « Plus »** (audit ergonomique, point 2, 3.8 quater lot 2, D-073, F6) : l'icône au-dessus d'un nom court, la page courante en pilule verte, « Plus » ouvrant le menu entier en feuille au-dessus de la barre, avec une pastille verte quand la page ouverte n'est pas dans la barre ; un menu de cinq pages ou moins tient entier dans la barre. La deuxième bande des 4 pastilles d'univers d'Ouvre ta ferme (Production vert, Vente #4E5FC0, Gestion #22829f, Paramètres #8747b1) n'est pas construite dans le module : l'en-tête d'Ouvre ta ferme la coiffe. Entre 601 et 980 px (tablette), la bande de pages qui défile reste. L'entrée « Aujourd'hui », première du menu et de la barre du bas, porte une petite pastille ronde au nombre de choses à regarder, aux couleurs « attention » (fond #fbe6cf, texte #6d3602), jamais au rouge du danger (audit ergonomique, 3.8 quater lot 2, D-073, F12, F33) ; aucune pastille quand il n'y a rien. Le nom de la ferme reste en haut (multi-fermes). Dans OTF, l'en-tête OTF coiffe le module.

## 8. Icônes
Au trait, une seule couleur, épaisseur ≈ 1,7 px, sans emoji ni picto coloré (la cloche de la maquette est un emoji provisoire à remplacer). Jeu de départ : goutte, calendrier, pousse, pluie, jauge, réglages, alerte, plus, coche.

Exception voulue (3.8, P41, 7 novembre 2026) : les cultures et les espèces portent le dessin en couleur de leur espèce, celui d'Ouvre ta ferme, lu chez elle (`docs/crop-water-need-contract.md`). Ce sont des illustrations d'espèces, à côté d'un nom, 28 px, pas des icônes d'interface : aucun bouton ni repère n'en prend un.

## Jetons à déclarer à l'application
Couleurs ci-dessus, espacements 0,25 · 0,5 · 0,75 · 1 · 1,5 · 2 · 3 rem, rayons 0,75 / 1 / 1,5 rem, ombres, cible tactile 44 px, anneau de focus 3 px vert à 70 %. Tailles de texte en rem, objectif ≥ 13 px (lisibilité téléphone : au jugement de François).

## Ordre d'application conseillé (chantier à planifier, CSS seul)
(1)+(2) jetons, polices, fond, rayons ; puis (3)+(4)+(5) ; puis (6)–(8). Aucun effet sur les calculs ; chaque temps passe par une PR comme les autres.

## Application

La refonte ergonomique applique la charte au code, CSS seul, en trois temps
qui suivent l'ordre ci-dessus ; elle est réalisée sur le mandat du porteur
du 6 novembre 2026 (D-060), chaque question tranchée par l'option
recommandée et consignée ici.

### Premier temps : jetons, polices, fond, blocs et rayons (précisions du 6 novembre 2026)

1. **Jetons.** Déclarés dans `app/globals.css` (`:root`) avec les noms de la
   maquette (`--sheet`, `--card`, `--ink`, `--ink2`, `--line`, `--green`,
   `--green-soft`, `--menu`, `--tile`, `--anthracite`, couleurs d'état, bleu
   eau, espacements, rayons, ombres, cible tactile, anneau de focus). Les
   anciens noms (`--canvas`, `--paper`, `--muted`) restent des alias des
   nouveaux. Trois jetons ajoutés à ceux de la charte, faute de valeur
   prévue : `--line-soft` `#eee` (les séparateurs très pâles, comme les
   lignes de la maquette téléphone), `--line-strong` `#bbb` (les bordures
   appuyées, curseurs et pastilles d'aide) et `--shadow-raised`
   `0 8px 24px rgb(0 0 0 / 14%)` (menus et éléments qui flottent au-dessus
   des blocs) ; les fenêtres de dialogue gardent une ombre plus forte.
2. **Polices.** Les polices variables du dépôt `google/fonts`, réduites aux
   caractères latins et à la ponctuation du français et converties en WOFF2,
   servies avec leur `OFL.txt` ; `font-display: swap` affiche aussitôt le
   texte dans la police de repli. Aucun appel du navigateur vers un tiers.
3. **Texte courant à 13 px aux deux largeurs.** La charte dit 12 px au
   téléphone mais fixe l'objectif « ≥ 13 px, au jugement du porteur » :
   13 px partout, la lecture au téléphone dans le champ passant avant la
   densité. Les tailles déjà écrites en pixels dans les feuilles des
   composants (étiquettes de 8 à 12 px) ne bougent pas dans ce temps-ci.
4. **Titres.** Titre de section (h2) et titre de fenêtre de dialogue en
   Bricolage Grotesque 300, 22,75 px à l'ordinateur et 20 px au téléphone
   (la maquette téléphone) ; titre de la page (h1) dans la même police, de
   26 px au téléphone à 36 px. Sous-titres (h3, h4) en DM Sans 500 ; ceux
   qui étaient en Georgia passent à 18 px. Le grand chiffre de la durée
   calculée garde sa taille, en Bricolage Grotesque 300. Boutons, onglets et
   plis (`summary`) en DM Sans.
5. **Couleurs neutres.** Les gris teintés de vert disparaissent, ramenés à
   leur rôle : texte secondaire `#5f5f5f`, texte très foncé `#111`, bordures
   `#ddd` (pâles : `#eee` ; appuyées : `#bbb`), fonds de bloc blancs, fonds
   intérieurs teintés `#f8f8f8`, fonds vert pâle de mise en avant `#e3f2ee`
   (la tuile de la charte), verts d'action et textes verts `#0b694d`. Le
   remplacement suit la teinte, la saturation et la clarté de chaque valeur
   et la propriété qui l'emploie ; il ne touche ni les couleurs d'état
   (ambre, rouge), ni les bleus de l'eau, ni ceux des boutons, qui viennent
   avec les temps suivants.
6. **Blocs.** Les grandes sections de la page sont blanches, sans bordure,
   posées sur la feuille `#f8f8f8` par l'ombre de la charte
   (`app/irrigation/styles/charte.css`, importée en dernier). Le halo lime
   du fond est retiré.
7. **Rayons.** Tous les rayons de 12 à 22 px deviennent le rayon unique de
   0,75 rem ; les petits rayons des champs, boutons et pastilles (7 à 11 px)
   attendent le temps des boutons.
8. **Ombres.** Les ombres teintées de vert deviennent les deux ombres de la
   charte (légère `0 1px 3px`, de bloc `0 4px 20px`, 6 % de noir) selon leur
   flou ; les anneaux de mise en évidence et les ombres internes restent.
9. **Focus et sélection.** Anneau de focus de 3 px vert à 70 % ; sélection
   de texte sur `#cce2d1` ; cases, boutons radio et curseurs en vert
   d'action (`accent-color`).

### Deuxième temps : boutons, onglets, tableaux et tuiles (précisions du 6 novembre 2026)

1. **Quatre sortes de boutons**, reconnues à l'habillage qu'ils avaient :
   plein vert → **principal** (`#0b694d`, texte blanc, sans ombre) ; blanc à
   texte vert, ou bleu → **secondaire** (contour vert sur `#cce2d1`) ; blanc
   à texte foncé → **outil** (contour anthracite `#373737`, sans fond) ;
   rouge → **destructif** (contour `#dc3545`, texte `#8f1d2a` sur
   `#fbe5e8`). Les boutons bleus deviennent verts : le bleu quitte les
   boutons.
2. **Forme et texte.** Rayon de 14,6 px (`--radius-button`), DM Sans 500 ;
   les libellés de 9 à 12 px passent à 13 px. Les cibles de 44 px au
   téléphone ne changent pas. Restent à part, avec leur seule police : les
   entrées des menus contextuels, les boutons de fermeture, les pastilles
   d'aide, les segments « Jour / Semaine / … » de l'historique et le choix du
   mode de calcul.
3. **Onglets.** À l'ordinateur, l'onglet choisi est blanc, souligné d'un
   trait vert de 5 px, les autres sur la feuille ; libellé DM Sans 14 px /
   500. Au téléphone, les trois onglets « Irriguer maintenant / Planifier /
   Déjà réalisée » restent empilés, chacun avec sa ligne d'explication :
   l'onglet choisi y prend un trait vert de 5 px à gauche plutôt que la
   pilule de la maquette, faite pour deux libellés courts. Les segments de
   période de l'historique sont déjà des pilules vertes.
4. **Tableaux.** Lignes alternées `#fcfcfe` / `#f2f2f5`, en-têtes gris de
   11,7 px, chiffres tabulaires, survol vert pâle ; dans le tableau de la
   semaine, les colonnes de valeurs sont alignées à droite. Au-dessous de
   761 px, ces tableaux deviennent des listes et gardent leur habillage.
5. **Tuiles de totaux.** Les tuiles de la semaine, de l'historique, du
   planning et de la faisabilité sont vert pâle `#e3f2ee`, sans bordure ; les
   deux tuiles de pluie sont en bleu eau (fond `#dcebf7`, chiffre `#1f6fb2`),
   seul changement du code de l'écran (une classe `is-water`). Les tuiles
   d'un écart (déficit, excédent) gardent leur couleur d'état. Le chiffre
   d'une tuile de la semaine est en Bricolage Grotesque 500.

### Troisième temps : couleurs d'état, bleu eau, navigation et icônes (précisions du 6 novembre 2026)

1. **Couleurs d'état.** Les ambres, rouges et bleus des messages, avertissements
   et erreurs deviennent les jetons de la charte, avec la teinte des
   messages de la maquette : attention sur `#fbe6cf`, texte `#6d3602`,
   bordure `#efc49b` ; erreur sur `#fbe5e8` (le fond du bouton destructif,
   un seul rose pour les deux), texte `#8f1d2a`, bordure `#f1b3bb` ;
   réussite sur `#d6ecdf`, texte `#0f4d2b` ; information sur `#e1eaff`, texte
   `#2a3f8a` (la date de la dernière mise à jour de la météo).
2. **Bleu eau.** Les autres bleus (fonds pâles, textes, traits) deviennent
   le bleu eau `#1f6fb2`, son fond `#dcebf7`, son texte `#144f82` et son
   trait `#a9c8e4`.
3. **Le plan garde ses couleurs.** Les feuilles du plan (plan, couverture,
   placement, détail de planche) ne changent pas de teinte : la couleur y
   dit une nature (un abri, la couverture d'un matériel), pas un état.
4. **Navigation.** Le module n'a ni menu latéral ni barre du bas : c'est une
   seule page, ouverte depuis Ouvre ta ferme, dont l'en-tête la coiffe.
   Construire la navigation de la charte, c'est réorganiser l'interface :
   elle revient à la 3.8, qui reste hors de ce mandat.
5. **Icônes.** Le module n'affichait ni emoji ni picto coloré ; les flèches
   et symboles typographiques restent du texte, d'une seule couleur. Les
   deux symboles dessinés (la coche des données protégées, le « ＋ » des
   boutons d'ajout) deviennent des icônes au trait de 1,7 px
   (`app/irrigation/line-icon.tsx`, renommé le 7 novembre 2026 : sous le nom
   `icon.tsx`, le cadre le prenait pour l'image de l'onglet de la page et la
   faisait demander en vain) ; le reste du jeu de départ (goutte,
   calendrier, pousse, pluie, jauge, réglages, alerte) viendra avec les
   écrans qui en auront l'usage, la 3.8 au premier chef.

### Deuxième passe (R4), validée le 7 novembre 2026 (D-068)

À sa relecture, le porteur trouvait la refonte lisible mais trop proche
d'avant. La deuxième passe suit une maquette validée par lui telle quelle :
canvas « Module d'irrigation à la manière d'OTF » (https://claude.ai/artifact/G9t1YyQCmPEBNNjeznMasG),
sources dans `/mnt/project-files/refonte-avant-apres/maquette/`
(`Main.dc.html` pour l'ordinateur, `Telephone.dc.html` pour le téléphone).
Codée le 7 novembre 2026 au soir, juste après la 3.8, CSS et habillage
seulement :

1. **Le plan sans bandeau vert foncé.** Chaque parcelle est un bloc blanc
   (ombre de bloc, rayon 0,75 rem), son nom en Bricolage Grotesque 300 de
   20 px et ses chiffres en gris `#5f5f5f` sur la même ligne. Chaque jardin
   ou abri : son nom en DM Sans 500, son étiquette en pastille douce (jardin
   `#e3f2ee` / `#0b694d`, abri `#fbe6cf` / `#6d3602`), les planches sur un fond
   `#f8f8f8` sans cadre. Les couleurs des planches ne changent pas.
2. **Moins de cadres.** Plus de bordure autour des jardins ni des mesures ; un
   bloc blanc ne contient pas d'autre bloc encadré.
3. **Les étiquettes écrites normalement.** « Saison », « Parcelle »,
   « Longueur »… en DM Sans 500 de 13 px, gris `#5f5f5f`, au lieu des petites
   majuscules grises.
4. **Le titre de la page à la taille de la charte** : 22,75 px à
   l'ordinateur, 20 px au téléphone (remplace R1, point 4), avec le « ? » de
   la page en bouton rond au trait anthracite.
5. **Au téléphone, la barre du haut anthracite** `#373737`, 36 px : le nom de
   la ferme et sa flèche, la cloche, l'initiale ; la bande de pages en bas
   reste celle de la 3.8.
6. **L'en-tête de l'ordinateur allégé** : barre blanche de 52 px, une
   pastille ronde verte `#0f8c66` à goutte au lieu du carré « OTF », le nom
   de la ferme et l'initiale à droite ; **l'état des données d'OTF en une
   ligne** sous le titre (pastille, date, « Actualiser ») ; **les mesures de
   la planche en tuiles vert pâle** `#e3f2ee`.

Précisions du code (7 novembre 2026), sur la recommandation :

- **Une barre du haut commune** à toutes les pages, y compris la première
  ouverture et la page d'indisponibilité (`app/irrigation/shell/topbar.tsx`).
  Elle garde l'intitulé de la session à la place du nom de la ferme, sans
  la flèche de la maquette : le module ne choisit pas encore de ferme (la
  flèche viendra avec la tranche 4). « Ouvre ta ferme » et « Session
  active », sous les noms, disparaissent.
- **La cloche, au téléphone seulement**, comme sur la maquette : elle mène
  aux réglages des notifications du téléphone, et n'apparaît que si une case
  cochée envoie des notifications. L'initiale reste le lien de déconnexion.
  La cloche et l'initiale gardent une cible de 44 px, qui déborde un peu
  sous la barre de 36 px.
- **Le menu de l'ordinateur** est une colonne de 247 px collée au bord
  gauche, du haut en bas de la page ; ses entrées restent visibles au
  défilement. La page à côté s'arrête à 1 200 px de contenu.
- **Le « ? » de la page** fait 28 px à l'œil, dessiné dans un bouton de
  44 px, la cible tactile mesurée par les parcours.
- **L'état des données d'OTF** garde ses mots (« Dernière lecture
  réussie le… ») sur une seule ligne, qui se replie au téléphone.
- **Les étiquettes** : vingt-neuf règles en petites majuscules passent en
  écriture normale, DM Sans 500, 13 px pour les champs et les surtitres,
  12 px pour les tuiles, les en-têtes de tableau et les pastilles.
- **Moins de cadres** : ce qui était un cadre dans un bloc blanc perd sa
  bordure et se pose en gris feuille ; ce qui était un cadre dans ce cadre
  revient au blanc, et ainsi de suite. Un fond de couleur d'état (attention,
  pluie) reste, seule sa bordure part. Les cases des fonctionnalités se
  lisent à leur fond : gris non cochée, vert pâle cochée.
- **L'eau du jour** (Arrosages) passe du bandeau vert foncé à une tuile vert
  pâle : le vert foncé reste aux boutons et au menu.

### Troisième passe (R5), choisie le 8 novembre 2026 (D-108)

Le 8 novembre 2026, le porteur trouve le style « plutôt austère » et
demande qu'il soit « un tout petit peu plus joli, sans trop dénoter avec la
charte graphique d'Ouvre ta ferme ». Il choisit les cinq touches d'une
maquette (https://claude.ai/artifact/L1Sm7H6dCsZXMEk8kqrzyx, source dans
`/mnt/project-files/style-plus-joli/`). Mêmes couleurs, mêmes polices, même
disposition ; aucun calcul ni aucun texte ne change. Le code est dans
`app/irrigation/styles/finitions.css`, importée après `charte.css`, et
`tests/style-finitions.test.ts` le tient.

1. **Une pastille ronde devant le titre de chaque bloc** : 38 px (32 px au
   téléphone), fond `#e3f2ee` et icône verte au trait, ou fond `#dcebf7` et
   icône `#1f6fb2` pour l'eau et la pluie. C'est la pastille d'univers d'OTF
   en plus petit.
2. **Des tuiles de totaux plus vivantes** : un filet de 3 px en haut (vert
   d'univers `#0f8c66`, bleu eau pour la pluie, orange d'attention pour un
   manque), une icône au trait devant le libellé, le chiffre un peu plus
   grand en Bricolage Grotesque 500.
3. **Le bandeau d'annonce comme les encarts « Nouveau » de la Boîte à outils
   d'OTF** : cadre vert en pointillé et étiquette « Nouveau ».
4. **Les cartes qu'on ouvre d'un clic répondent au survol** de la souris.
5. **Les grands états vides illustrés** d'un petit dessin au trait.

Précisions du code (8 novembre 2026 sur l'archive, refaites le
14 novembre 2026 sur le dépôt public), sur la recommandation :

- **Les pastilles sont en CSS**, en image de fond posée devant le titre :
  aucun composant ne change, les lecteurs d'écran ne les lisent pas. Les
  icônes sont celles de `line-icon.tsx`, recopiées en image ; un test
  vérifie qu'elles n'en divergent pas et que chaque titre visé existe.
  Vingt titres en ont une : les h2 des blocs et les titres des pages
  Réserve du sol, Alertes météo et Alertes cultures. Les sous-blocs
  (« Les Prés », « Planche N01 », « Besoin de la culture ») et la barre de
  placement n'en ont pas ; l'aperçu « Apport calculé par heure » garde son
  symbole « ≈ ». Les blocs de « Aujourd'hui » ont déjà la leur, dans leur
  composant.
- **Les icônes des tuiles** sont sur les tuiles de « Objectifs et besoins »
  (objectif, irrigation, pluie, pluie prévue, ET0) et du planning (à
  valider, faites, en retard, volume, non vérifié, manque d'eau, temps de
  pompage, planches non servies). La cible s'ajoute au jeu ; le soleil
  (ET0) et l'horloge y étaient déjà. Les tuiles de l'historique et de la
  faisabilité reçoivent le filet et le chiffre, sans icône : leurs
  libellés changent selon le cas. Une tuile de geste en retard garde au
  filet du haut le rouge de son filet gauche.
- **Le survol sans soulèvement** : la maquette montrait des lignes blanches
  qui se soulèvent. Une carte blanche dans un bloc blanc contredirait la
  deuxième passe (« un bloc blanc ne contient pas d'autre bloc encadré »),
  et un déplacement dérangerait les bulles d'aide placées dans la carte. La
  carte fermée prend donc au survol le fond vert pâle `#e3f2ee` et l'ombre
  légère de la charte ; à la souris seulement, sans effet au téléphone.
  Cartes concernées : les jardins des besoins, les irrigations de
  l'historique, les jardins de la réserve du sol. Les cultures de référence
  et les espèces de la saison gardent le survol qu'elles ont depuis le
  retour du porteur du 8 novembre 2026 (le fond vert de leur résumé) : deux
  fonds l'un sur l'autre feraient double emploi.
- **Le dessin des états vides** (deux buttes et une goutte, au trait
  `#0f8c66`) va sur les grands états vides centrés : « Aucun matériel prêt
  à irriguer », « Aucun groupe configuré », « Aucun matériel enregistré »
  (il remplace le signe « ⌁ »), le réglage du matériel et le plan vides.
  Les messages d'une ligne (planning, historique, ressources) restent sans
  dessin.
- **L'étiquette « Nouveau »** est décorative (texte de remplacement vide) :
  le bandeau dit déjà ce qui est nouveau.
- **Un jeton de plus**, `--green-universe: #0f8c66`, le vert de la pastille
  d'univers d'OTF, pour les filets et le pointillé.
