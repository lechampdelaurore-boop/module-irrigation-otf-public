# Contrat court — audit ergonomique du 19 novembre 2026, lot K : finitions de charte (24 undevicies)

Écrit le 19 novembre 2026, avant tout code, en Opus 5.5 · Élevé (la ligne
24 undevicies de la roadmap), après le lot J (24 duodevicies). Il couvre
les constats **n° 16, n° 17 et n° 19 à n° 24** du rapport
`audit-ergonomie-2026-11-19.md`, retenus par le porteur le 19 novembre 2026
à 11 h 39 (choix n° 1 du rapport : les cinq lots, dans l'ordre G, H, I, J,
K). Le porteur est en autonomie totale depuis 11 h 44 : chaque précision
ci-dessous, aucune agronomique, suit l'option recommandée du rapport et
reste modifiable par lui. **Aucune règle de calcul ne change**, aucun
chiffre n'est recalculé : le lot range ce qui s'affiche selon la charte
(`docs/charte-module.md`) ; aucune migration. Logiciel multi-fermes : chaque
règle vaut pour toute ferme, les noms de jardins serrés de la ferme du
porteur n'en sont que l'exemple.

Registres : décisions **D-190 et suivantes** (jusqu'à D-199), précisions
**F463 et suivantes** (jusqu'à F499), parcours **P41** (P40 est le
dernier).

## 1. Livraison en sept PR, une à la fois

| PR | Point | Fichiers principaux | Preuve |
| --- | --- | --- | --- |
| 1 · Planning : le rouge pour le manque d'eau seul | n° 17 | `planning/weekly-plan-view.tsx` et ses blocs, `lib/domain/planning/` (lecture seule) | tests du domaine, P41 |
| 2 · Vue satellite : des numéros quand les noms se chevauchent | n° 16 | `hierarchy/satellite-*`, `lib/domain/` (placement des étiquettes) | tests du domaine, P41 |
| 3 · Un bouton plein par écran, un seul dessin de pli, plus de geste muet | n° 21 | feuilles `styles/`, les boutons et plis relevés | test de garde, P41 |
| 4 · Mots et formats | n° 22 | `lib/domain/` (heures, durées, pluriels), « Ressources », « Réglages » | tests du domaine |
| 5 · Une échelle de tailles de texte, rien sous 12 px | n° 19 | `styles/` (jetons), le plan de « Matériel » | test de garde des feuilles, P41 |
| 6 · Rayons et couleurs de la charte | n° 20 | `styles/` | test de garde des feuilles |
| 7 · Grand écran, 320 px et tablette | n° 23, n° 24 | `shell/`, `styles/` | P41 (320, 768, 1 920 px) |

Chaque PR : `lint`, `typecheck`, `test`, `build`, `knip`, `push:check`,
`weather:check`, `site:check` collés ; `e2e` joué en local sur les
parcours touchés, la suite complète par la CI de la PR ; registres dans la
même PR. L'ordre suit le gain sur l'effort : les deux constats « gain
moyen » d'abord, puis les règles de la charte, page par page.

## 2. Ce qui ne change pas

Le calcul, les données, les gestes et leurs confirmations (lot G), le
contrat d'« Aujourd'hui » (lot H), les budgets de hauteur au téléphone
(lot J : aucune page ne grandit de plus de 10 % sans le dire), les ancres
des liens existants, les couleurs de la charte elle-même. Le rouge reste
au manque d'eau, à l'erreur et à ce qui efface.

## 3. n° 17 — Planning : le rouge pour le manque d'eau seul (PR 1)

1. Une planche « non servie » parce que son besoin est **sous la dose
   minimale** (elle attend qu'il grandisse) est une information : la tuile
   qui ne compte qu'elles est neutre, et dit « en attente » ; le rouge
   reste à la planche non servie faute d'eau, de pompe ou de créneau.
2. Un même chiffre, un seul arrondi : la dose de référence de « Ajuster »
   s'affiche comme sur la carte (une décimale) ; la saisie garde sa
   précision.
3. La ligne d'état de la semaine se lit en deux lignes au plus : la
   semaine et l'heure du calcul d'abord ; la source météo et la réserve
   tampon dans une seconde ligne, plus discrète.
4. Un jour à une seule proposition n'a qu'un bouton « Valider » ; le pli
   « Réglages du planning » porte le signe des autres plis.

## 4. n° 16 — Vue satellite : des numéros quand les noms se chevauchent (PR 2)

1. Une étiquette de jardin qui chevaucherait une autre, ou sortirait de
   son jardin, devient un **numéro** dans une pastille ; la légende sous la
   carte associe chaque numéro à son nom, dans l'ordre naturel des noms.
2. Une étiquette qui tient garde son nom. Le calcul se refait au zoom : un
   numéro redevient nom quand la place le permet.
3. Le nom complet reste le nom accessible du jardin sur la carte.

## 5. n° 21 — Un bouton plein par écran, un seul dessin de pli, plus de geste muet (PR 3)

1. Le bouton plein reste **le** geste de la page : « Cette semaine » quand
   on y est déjà, les choix « 24 h / 48 h / 7 jours », « Créer un groupe »
   passent en secondaire ou en onglets (l'option choisie se lit à son fond,
   pas à un liseré) ; « Groupes de jardins alignés » ne s'ouvre pas avec
   un bouton plein sur une ferme sans asperseur.
2. Un seul dessin de pli dans le module : le chevron à droite de la
   charte, qui tourne à l'ouverture ; plus de triangle du navigateur ni de
   boîte grise sans signe.
3. Plus de geste muet : « Retirer la mesure » indisponible sans mesure à
   retirer ; un menu « … » qui ne contiendrait qu'un geste devient ce
   geste ; « Heure réelle de fin » sans secondes ; un seul mot pour finir
   un arrosage (« Terminer l'irrigation »).

## 6. n° 22 — Mots et formats (PR 4)

1. Heures « 8 h 50 », durées « 1 h 21 », partout où le module les écrit
   (l'export CSV garde son format de tableur).
2. Plus de pluriel entre parenthèses : « 1 jour », « 7 jours ».
3. « Ressources » et « Réglages » en mots simples : les libellés relevés
   par le rapport sont réécrits, le sens et les chiffres inchangés ;
   « Faisabilité recalculée. » prend le style d'un message, pas d'un lien.

## 7. n° 19 — Une échelle de tailles de texte, rien sous 12 px (PR 5)

1. Six tailles de texte en jetons (12, 13, 14, 16, 20 et 28 px environ,
   en rem) ; plus rien sous 12 px ; quatre graisses (300, 400, 500, 700).
2. Le plan de « Matériel » : noms et sigles à 12 px au moins ; la pastille
   chiffrée du plan dit ce qu'elle compte (bulle et légende), ou se retire
   si elle ne dit rien d'utile.
3. Les grands chiffres (durée calculée, tuiles) gardent leur taille de
   titre.

## 8. n° 20 — Rayons et couleurs de la charte (PR 6)

Les rayons hors charte (3 à 14 px) reviennent aux trois rayons de la
charte (bloc 0,75 rem, bouton `--radius-button`, entrée du menu 9,75 px) ;
les cercles restent des cercles. Les deux couleurs de texte hors palette
reviennent au texte (`#111`) ou au secondaire (`#5f5f5f`).

## 9. n° 23 et n° 24 — Grand écran, 320 px et tablette (PR 7)

1. Grand écran : le contenu se centre au-delà de sa largeur maximale ; le
   fond du menu de gauche va jusqu'en bas ; la grille d'« Aujourd'hui »
   ne laisse plus de trou ; le bandeau de la démonstration tient sur une
   ligne quand la place le permet.
2. 320 px : les noms de la barre du bas ne se coupent plus au milieu d'un
   mot (nom court ou passage à la ligne entre les mots).
3. Tablette (601 à 980 px) : la barre du bas suit celle du téléphone
   (quatre entrées et « Plus ») au lieu de défiler ; les cibles de 44 px
   valent jusqu'à 980 px.

## 10. Tests et preuves

Tests du domaine pour chaque règle qui se calcule (tuile neutre ou rouge,
placement des étiquettes, formats d'heure et de durée, pluriels). Tests de
garde des feuilles de style (aucune taille sous 12 px, aucun rayon hors
charte, aucune couleur de texte hors palette). Parcours **P41** « Finitions
de charte », à 390 et 1 280 px, et aux tailles limites (320, 768,
1 920 px) pour la PR 7.

## 11. Risques

- Les règles de la charte touchent toutes les pages : chaque PR mesure
  les hauteurs de P40 et le contraste de P31c, qui restent verts.
- Des parcours existants lisent des libellés réécrits (PR 4) : ils suivent
  le mot nouveau, aucun parcours n'est retiré.
- Le placement des étiquettes de la vue satellite dépend de la taille de
  la carte : le test du domaine le chiffre sur des rectangles, P41 le
  vérifie à 390 px.

## 12. Précisions

Chaque précision faite en codant, numérotée à la suite du registre.

- **F463** « En attente » : une planche dont **tous** les motifs sont « besoin sous la dose minimale » ; avec un autre motif (espacement, plage…), elle reste un manque. Comptée à part des planches sans objectif : « · 2 sans objectif et 1 en attente d'un besoin plus grand, pour information » dans le détail de la tuile ; « Planches non servies (n) · 2 sans objectif · 1 en attente », ou « Planches en attente (n) » quand rien d'autre, dans le titre du pli. Le détail « avec un manque chiffré » ne les compte plus.
- **F464** La dose d'« Ajuster » s'écrit comme sur la carte (une décimale au plus) ; laissée telle quelle, c'est la dose exacte de la proposition qui part, jamais l'arrondi ; tapée, elle se lit à sa précision.
- **F465** La ligne d'état : « Semaine du … au … · calculé le … (déclencheur) », puis dessous, à 12 px en gris, « Prévision météo sur n jours » et les réserves observées.
- **F466** « Valider les propositions du jour » paraît à partir de deux propositions à valider ; « Valider toute la semaine » ne change pas.
- **F467** « Réglages du planning » prend le chevron à droite des plis des lots D et J, qui tourne à l'ouverture ; l'unification de tous les plis suit à la PR 3.

- **F468** Vue satellite : un nom se compare aux noms déjà posés, dans l'ordre de la liste ; « chevaucher » veut dire moins de deux pixels d'air entre deux rectangles ; le premier garde son nom, le suivant devient son numéro (pastille ronde de 24 px au moins). Le numéro est celui de la ligne dans la liste, devant le nom, caché au lecteur d'écran (la liste dit déjà le nom). Un nom qui sortirait de son jardin sans gêner un voisin le garde : la bulle et la liste suffisent. Le calcul se refait au chargement, au zoom et quand la carte ou le dessin change de taille. La preuve est dans le domaine (`tests/audit-ergonomie-2026-11-19-lot-k-satellite.test.ts`) et dans P34 étendu, plutôt que dans P41 : P34 a déjà la carte et son dessin de secours.

Les précisions de la PR 3 suivent, F469 et au-delà.
