# Contrat court — audit ergonomique final, lot E : mots et chiffres (24 duodecies)

Écrit le 15 novembre 2026 au matin, avant tout code, en Opus 5.5 · Élevé (la
ligne 24 duodecies de la roadmap), sur le mandat d'autonomie du porteur
(« pousse du code en autonomie toute la nuit si nécessaire ») : chaque
précision, aucune agronomique, suit l'option recommandée et reste
modifiable par lui. Il couvre les points **J8, J9, J11, J12, J15, A1 et A2**
du rapport `audit-ergonomie-final-2026-11-14.md` (D-117). **Affichage
seul** : aucun calcul ne change, l'arrondi n'est qu'un affichage ; aucune
donnée, aucune migration. Logiciel multi-fermes : les règles visent un mot
ou un nombre, jamais une ferme.

Registres : décisions **D-130 et suivantes** (une par PR), précisions
**F257 et suivantes** ; parcours étendus, sans parcours nouveau.

**Hors du lot** : sur « Aujourd'hui », seulement les retouches de surface
(arrondi, mots, bandeau de J11), sans toucher au contrat de la page (lot A,
en attente du porteur) ; les noms de la ferme de démonstration (« Ferme de
démonstration », « Maraîchage diversifié », « Ferme des Trois Noues »,
J9) vont avec le lot F.

## 1. Livraison en sept PR, une à la fois

| PR | Point | Fichiers principaux | Preuve |
| --- | --- | --- | --- |
| 1 · Aller au contenu | A1 | `bienvenue/welcome-choice.tsx`, `app/not-found.tsx` | P22, P27 |
| 2 · Des nombres lisibles | J8 | `lib/domain/display-numbers.ts` (nouveau) et chaque page qui affiche un volume ou des millimètres | tests du domaine ; parcours qui lisent un volume |
| 3 · Les mêmes mots | J9 | `lib/domain/today/reliability.ts`, `irrigation-history-dashboard.tsx`, `planning/weekly-plan-view.tsx`, `hierarchy/coverage-overview.tsx`, `lib/domain/planning/phone-week.ts` | tests du domaine ; P10, P29 |
| 4 · La page non cochée | J11 | `lib/domain/features/pages.ts`, `page-context.ts`, `shell/irrigation-shell.tsx` | tests du domaine ; P22, P23 |
| 5 · Les alertes système | J12 | `irrigation-event-manager.tsx`, la feuille du bandeau | P1 ou P28 |
| 6 · La vue satellite | J15 | `hierarchy/satellite/*`, `hierarchy-browser.tsx` | tests du domaine ; P34 |
| 7 · Les petites cibles | A2 | les feuilles concernées, `e2e/support/accessibilite.ts` | P31c |

Chaque PR : `lint`, `typecheck`, `test`, `build`, `knip`, `push:check`,
`weather:check` et `e2e` collés ; registres dans la même PR ; la première
verse ce contrat et consigne le déploiement de #63.

## 2. Ce qui ne change pas

Tous les calculs et leurs nombres ; les valeurs enregistrées, dont la note
qu'une validation du planning écrit sur l'arrosage ; les champs de saisie
(une valeur saisie ou proposée dans un champ garde sa précision) ; l'export
CSV de l'historique (il garde la précision du calcul) ; l'index d'un
compteur (une lecture, écrite comme sur le compteur) ; les débits (m³/h,
L/h), les vitesses d'arrosage (mm/h), les réglages rappelés tels que saisis
(paramètres du sol, doses du planning), les Kc, les surfaces et les
distances ; les contrats des pages déjà validées, dont celui
d'« Aujourd'hui ».

## 3. A1 — « Aller au contenu » sur les deux pages qui l'ont perdu

**Cause établie dans le code.** Le lien d'évitement vit dans le gabarit des
pages du module (`IrrigationShell`) ; la première ouverture
(`WelcomeChoice`) et la page introuvable (`app/not-found.tsx`) ont leur
propre gabarit, sans lui.

1. **Le lien en premier arrêt du clavier** sur ces deux pages, comme
   ailleurs : « Aller au contenu », vers le bloc principal de la page
   (`#contenu`), qui reçoit le focus (F257).

## 4. J8 — Des nombres lisibles

**Cause établie dans le code.** Chaque page a son propre format : trois
décimales au plus (`formatWaterVolumeForMessage`, `waterText`,
l'historique, la vue par série, les ressources), deux décimales fixes
(« 0,00 m³ »), deux décimales pour des millimètres (l'historique, la
faisabilité).

1. **Un volume** (F258) se lit en m³ à deux décimales au plus, sans zéro
   inutile : « 3,14 m³ », « 12 m³ », « 1,5 m³ ». Sous 1 m³, en litres
   entiers : « 425 L ». Un volume plus petit qu'un demi-litre, non nul, se
   lit « moins de 1 L », jamais « 0 L » (un manque ne disparaît pas à
   l'arrondi, D-003). Zéro se lit « 0 m³ ». Un volume qui s'arrondit à
   1 000 L se lit « 1 m³ ». Le signe d'un écart se garde. Une limite
   journalière écrite dans une phrase est un volume comme un autre
   (« limite 10 L »).
2. **Des millimètres** (F259) se lisent à une décimale au plus : « 16,5 mm »,
   « 12 mm ».
3. **Une seule règle**, dans `lib/domain/display-numbers.ts`, que toutes les
   pages appellent ; les litres se calculent par une fonction nommée de
   `lib/domain/units.ts`, jamais par un « 1000 » écrit dans l'interface
   (F260). Hors de la règle : section 2.

## 5. J9 — Les mêmes mots d'une page à l'autre

**Causes établies dans le code.**

1. **Un geste, un mot** (F261) : « Noter la pluie » sur l'historique, comme
   « Noter la pluie de la semaine » sur « Aujourd'hui » (au lieu de
   « Saisir la pluie »).
2. **Les accords** (F262) : « Valider la proposition du jour » quand il n'y
   en a qu'une (au lieu de « Valider les 1 proposition du jour ») ;
   « Observer le sol d'Abri des noues » : « de » s'élide devant une voyelle,
   accentuée ou non (au lieu de « de Abri des noues ») ; jamais devant un h,
   qui peut être aspiré (« de Haut Champ »).
3. **Le réglage nommé une fois** (F263) : l'étiquette d'un matériel dit
   « Réglage habituel » et non « Réglage Réglage habituel » quand le nom du
   réglage commence déjà par « Réglage » ; sinon « Réglage » suivi du nom,
   comme avant.
4. **« Temps de pompage manquant », exprimé en m³** (rapport, R3, laissé à
   J9 par le lot B) (F264) devient « Eau non pompée faute de temps » sur la
   tuile du planning, et « non pompé faute de temps » dans sa ligne du
   téléphone. Le nombre et sa règle ne changent pas.

## 6. J11 — Le bandeau « non cochée » dit laquelle et où la cocher

**Cause établie dans le code.** Une page non cochée renvoie à la page
d'arrivée avec `?absente=1` : l'adresse ne dit pas quelle page était
demandée, et le bandeau ne peut dire que « Cette fonctionnalité n'est pas
cochée pour votre ferme. »

1. **L'adresse nomme la page demandée** (`?absente=arrosages`) ; le bandeau
   dit « La page « Arrosages » n'est pas cochée pour votre ferme. » et
   porte le lien « La cocher dans Réglages », vers le bloc « Fonctionnalités
   de la ferme ». Pour « Aujourd'hui », qui n'a pas de case : « La page
   « Aujourd'hui » n'a aucune de ses fonctionnalités cochées pour votre
   ferme. », lien « Les cocher dans Réglages ». Une ancienne adresse
   `?absente=1`, ou une page inconnue, garde la phrase d'avant, avec le même
   lien (F265).

## 7. J12 — « Alertes système non disponibles » ne passe plus avant le formulaire

**Cause établie dans le code.** Sur « Arrosages », le bandeau vient entre
le titre et le formulaire ; il ne se replie, une fois vu, qu'au téléphone
(F10). Le rapport le note : sur un appareil où les notifications sont
permises, il n'apparaît pas.

1. **Sur « Arrosages », le bandeau d'un état limité vient sous le
   formulaire** « Enregistrer ou planifier », texte inchangé ; les états
   « Recevoir les alertes » et « Alertes activées » gardent leur place
   (F266).
   **Amendé par la simplification S5 (D-334, F908)** : tous les états
   viennent sous le formulaire, à une seule place, pour que « 1. Où ? »
   commence sous 400 px au téléphone ; le texte et le repli ne changent pas.
2. **Replié une fois vu à toutes les largeurs** (F267), avec le point sur la
   cloche ; Réglages le garde en entier.

## 8. J15 — La vue satellite, dans son repli

**Causes établies dans le code.**

1. **Le bouton du fond suit le fond affiché** (F268) : quand le fond
   satellite est indisponible ou non configuré, c'est « Contours » qui est
   enfoncé ; toucher « Photo » le redemande.
2. **Un seul niveau de mots** (F269) : la bascule du fond dit « Photo » et
   « Contours » (au lieu de « Satellite » et « Dessin ») ; les messages de
   repli disent « les contours seuls ». Les onglets « Plan » et « Vue
   satellite » ne changent pas.
3. **Le nom de la parcelle n'est plus posé sur la carte** (F270) : il est
   déjà le titre du bloc au-dessus des onglets, et l'étiquette posée au
   milieu de la parcelle chevauchait celle d'un jardin. Les jardins gardent
   la leur.
4. **Au téléphone, choisir « Vue satellite » amène les onglets en haut de
   l'écran** (F271) quand la carte commence sous l'écran, pour que la carte
   se voie sans chercher.

## 9. A2 — Les cibles de moins de 44 px

**Cause établie par la mesure.** Mesurées à 390 px, sur la démonstration
« maraîchage diversifié » comme sur la ferme des parcours, avec les règles
de P31c (une case se mesure par son étiquette, un lien pris dans une phrase
est exclu, la zone élargie de la cloche et de l'initiale compte), il ne
reste que trois défauts : les flèches « ← » et « → » de la semaine
d'« Objectifs et besoins » (38 px de large, et sans nom lisible par un
lecteur d'écran), « + Ajouter une pompe » (43,8 px de haut), et la case
« Par analogie (culture proche, pas la même) » de la correspondance des
espèces dans « Réglages » (19 px de haut). Les grands nombres du rapport
(143 sur « Besoin par culture ») comptaient la case elle-même, ses 16 px,
plutôt que son étiquette, et les liens pris dans une phrase.

1. **Les trois cibles font 44 px** dans les deux sens ; les flèches portent
   « Semaine précédente » et « Semaine suivante » (F272).
2. **P31c mesure aussi la largeur**, et toute étiquette qui contient une
   case, même enveloppée (F273).

**Trouvé au code (D-136).** La mesure élargie, jouée sur toute la suite, a
trouvé une quatrième cible que l'audit n'avait pas vue faute d'alerte
envoyée sur sa ferme : « Voir » dans l'historique des alertes (cultures et
météo), 25 px de large au téléphone ; elle passe à 44 px avec les trois
autres. La mesure se fait au dixième de pixel, pour que 43,5 px ne
s'arrondisse pas à 44.

## 10. Cas chiffrés (la preuve de fin les met en tests et en parcours)

| Cas | Entrée | Attendu |
| --- | --- | --- |
| 1 | Volume 3,138 m³ | « 3,14 m³ » |
| 2 | Volume 0,425 m³ | « 425 L » |
| 3 | Volume 0,0004 m³ | « moins de 1 L » |
| 4 | Volume 0 | « 0 m³ » |
| 5 | Volume 0,9996 m³ | « 1 m³ » |
| 6 | Volume 12 m³ | « 12 m³ » |
| 7 | Volume −0,3 m³ | « -300 L » |
| 8 | 16,54 mm | « 16,5 mm » |
| 9 | Un jour à une seule proposition | « Valider la proposition du jour » |
| 10 | Jardin « Abri des noues » sans observation | « Observer le sol d'Abri des noues » |
| 11 | Réglage nommé « Réglage habituel » | « Réglage habituel », une fois |
| 12 | « Arrosages » décochée, adresse `/irrigation/arrosages` | « La page « Arrosages » n'est pas cochée pour votre ferme. » et « La cocher dans Réglages » |
| 13 | Fond satellite injoignable | « Contours » enfoncé, message « les contours seuls » |
| 14 | Les trois cibles à 390 px | 44 px au moins dans les deux sens |

## 11. Précisions

- **F257** « Aller au contenu » sur la première ouverture et la page introuvable (section 3).
- **F258** un volume en m³ à deux décimales, en litres sous 1 m³ (section 4.1).
- **F259** des millimètres à une décimale (section 4.2).
- **F260** une seule règle d'affichage, et ce qu'elle ne touche pas (section 4.3).
- **F261** un geste, un mot (section 5.1).
- **F262** les accords (section 5.2).
- **F263** le réglage nommé une fois (section 5.3).
- **F264** « Eau non pompée faute de temps » (section 5.4).
- **F265** le bandeau nomme la page non cochée et mène à Réglages (section 6).
- **F266** le bandeau des alertes limitées sous le formulaire (section 7.1).
- **F267** replié une fois vu à toutes les largeurs (section 7.2).
- **F268** le bouton du fond suit le fond affiché (section 8.1).
- **F269** « Photo » et « Contours » (section 8.2).
- **F270** le nom de la parcelle hors de la carte (section 8.3).
- **F271** la carte amenée à l'écran au téléphone (section 8.4).
- **F272** les trois cibles à 44 px (section 9.1).
- **F273** P31c mesure la largeur et toute étiquette de case (section 9.2).

Ce que le lot ne prouve pas : la vue satellite avec les vraies photos de
l'IGN (fonds injoignables d'ici) ; un lecteur d'écran ; un vrai téléphone ;
la lecture de ces nombres sur la ferme réelle, qui se fera à la recette.
