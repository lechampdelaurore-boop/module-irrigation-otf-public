# Contrat — Simplifier l'usage du module, lot S6 : la mise en route guidée (25 novembre 2026)

Roadmap section 6 terdecies, ligne 33 de l'ordre d'exécution. Décision du
chantier : **D-327**. La décision de ce lot est **posée par sa première PR de
code**, au premier numéro libre à ce moment-là ; de même les précisions **F**
(celles de ce contrat sont nommées S6-a, S6-b… et prennent leur F en codant) et
le parcours **P** (premier numéro libre ; P61 est celui de S1, P62 celui de
S2). La migration, une seule, additive, prend elle aussi **le premier numéro
libre** (section 4).

Ce contrat **change** l'écran de première ouverture du contrat des
fonctionnalités à la carte (3.8, `docs/feature-selection-contract.md`,
règle R5, section 5 et précision P7) : **trois façons de commencer à la place
des onze cases**. C'est le choix n° 3 du porteur, 25 novembre 2026, 12 h 00 :
« Oui, trois façons de commencer ». **La 3.8 reste close** : ses dix cases, ses
dépendances, ses règles R1 à R4 et R6 à R10 ne bougent pas ; la section 11 dit,
passage par passage, ce qui change. Il ajoute « la mise en route » (cinq étapes
dans « Ma ferme ») et les **chiffres d'état des fiches de « Ma ferme »**, que
le lot S3 a laissés exprès à ce lot (S3, précision S3-g).

Logiciel **multi-fermes** : rien ci-dessous ne dépend de la taille ni du
contenu d'une ferme. Les exemples (« Ferme du Pré Neuf », « Bassin des noues »,
« 4 goutte-à-goutte ») viennent des maquettes ; les mesures se font sur les
données des parcours et des fermes de démonstration, jamais sur la ferme du
porteur.

## 1. Origine

Le diagnostic du 25 novembre 2026
(`/mnt/project-files/audit-ergonomie/diagnostic-simplicite-2026-11-25.md`,
cause 5, idée 4, lot S6 de la section 5) constate que **la première ouverture
demande de choisir avant d'avoir rien vu** : un écran de **onze cases**, 365
mots, des dépendances écrites (« Cochera aussi Arrosages, Objectifs et besoins,
Besoin par culture et Matériel et placement, dont elle a besoin »), des noms de
pages qu'on ne connaît pas encore. « Commencer par l'essentiel » existe (lot I,
F452) et c'est bien, mais on coche quand même des noms de pages. **Ensuite il
n'y a pas de chemin** : pour obtenir une première proposition d'arrosage, il
faut créer un matériel, lui donner un réglage, le poser sur des planches,
donner un objectif aux planches ; pour un calcul fiable, ajouter la source
d'eau, le sol de chaque parcelle, les espèces. Rien ne dit dans quel ordre. Le
bloc « Fiabilité du calcul » de « Aujourd'hui » (« 3/5 à jour ») en est
l'ébauche, mais il dit l'état d'une ferme **déjà réglée**, pas ce qu'il reste à
faire pour la régler.

La proposition, retenue par le porteur (maquettes
https://claude.ai/artifact/CTM7RxB6X4UgMTHKsaha8F, écrans « Première
ouverture » et « Ma ferme ») :

1. **À la première ouverture, trois façons de commencer** au lieu de onze cases :
   « Je note mes arrosages », « Le module me propose quoi arroser », « Tout :
   sol, cultures et alertes ». Chaque façon coche les cases qu'il faut. Les onze
   cases restent, dans « Ma ferme » (Réglages), pour qui veut choisir finement.
2. **Une « mise en route »**, visible dans « Ma ferme » tant qu'elle n'est pas
   finie : le matériel, où il est posé, d'où vient l'eau, combien on vise par
   semaine, le sol. Chaque étape dit ce qu'elle débloque.
3. **Des fiches qui disent leur état** (« 4 goutte-à-goutte, tous posés »,
   « Bassin des noues : 30 m³ sur 40, relevé ce matin ») au lieu d'une ligne
   fixe qui dit seulement à quoi la page sert.

**Ce que S6 ne fait pas.** Retirer une fonction ou une case ; changer un
calcul, un seuil ou une règle d'agronomie ; refaire les pages elles-mêmes (S1,
S2, S4, S5 l'ont fait) ni le menu (S3) ; remplacer **l'accueil de la 4.4**
(commune, jardins à classer, sol, espèces, réglages du planning) : il reste, et
la mise en route **se lit sur les mêmes données** (section 6) sans rien
confirmer à la place de la personne ; refondre la visite guidée de la
démonstration au-delà des phrases qui parlent de l'écran de bienvenue
(section 10).

**Dépendances.** S6 est le dernier lot de l'ordre (S1, S2, S3, S5, S4, S6) ;
il peut passer devant si le pilote démarre avant (ligne 33). Son code
**s'appuie sur** :

- S3 : la page « Ma ferme » (`/irrigation/ma-ferme`), ses fiches et leurs
  lignes fixes (S3, section 5), la marque « À faire » qui vient de l'accueil
  de la 4.4 ;
- S1 : la fonction de l'objectif de la ferme (`farmObjective`,
  `farmObjectiveText`, `lib/domain/farm-objective.ts`), dont l'étape 4 reprend
  le compte et la phrase ;
- S2 : « Aujourd'hui » raccourci, dont la ligne d'état vide reçoit la ligne de
  la section 8 ;
- S4 : la page « Semaine » (S6 n'y touche pas ; l'étape 4 mène à la page qui
  porte l'objectif, par son adresse d'aujourd'hui, redirigée par S4 si besoin) ;
- le vocabulaire de S1 (`lib/domain/simple-words.ts`) et son test de garde.

## 2. Livraison en quatre PR, une à la fois

| PR | Contenu | Preuve |
| --- | --- | --- |
| 1 · Les trois façons de commencer | l'écran de première ouverture ; la table des trois façons dans le domaine ; la migration additive (deux colonnes) ; l'action qui enregistre le choix ; l'arrivée sur « Ma ferme » ; « Choisir moi-même » (les onze cases, comme avant) | tests du domaine et de l'action ; test de base ; parcours ; mesures |
| 2 · La mise en route | la fonction du domaine (étapes, états, ce qu'elles débloquent) ; la lecture, une seule, de ce qu'elle compte ; la carte « Mise en route » en tête de « Ma ferme » ; « Plus tard » et « Terminer » ; la ligne de « Aujourd'hui » quand rien n'est proposé | tests du domaine (toutes les cases, tous les états) ; tests de base à deux fermes ; parcours ; mesure du temps serveur |
| 3 · Les chiffres d'état des fiches | la ligne d'état de chaque fiche de « Ma ferme », à la place de la ligne fixe quand la donnée est connue ; la ligne fixe de S3 en repli | tests du domaine (chaque ligne, chaque repli) ; test de vocabulaire ; mesure du temps serveur |
| 4 · Les visites, les contrats, la recette | la visite guidée et la ferme vierge de la démonstration ; les phrases qui parlent de « onze cases » ; les contrats réécrits (section 11) ; la recette | tests ; parcours ; recette dans le Chrome du porteur |

**Chaque PR garde le module entier utilisable.** La PR 1 ne change que
l'écran vu **une seule fois par ferme** (la première ouverture) : une ferme qui
a déjà ouvert le module ne le revoit jamais, et rien d'autre ne change pour
elle avant la PR 2. La PR 2 n'ajoute une carte qu'aux fermes qui sont passées
par le nouvel écran (section 4) : les fermes d'avant S6 ne voient aucune carte.
La PR 3 touche les lignes de « Ma ferme » et rien d'autre.

Chaque PR : `lint`, `typecheck`, `test`, `build`, `knip`, `push:check`,
`weather:check`, `site:check` collés ; `e2e` joué en local sur les parcours
touchés, la suite complète par la CI ; registres à jour dans la même PR
(roadmap : tableau de la section 1, ordre de la section 2, bloc détaillé).
Avant d'écrire, chaque PR relève l'état de départ (contrôles, mesures) et le
colle dans sa description (consigne 6 du projet). Pour la PR 1 : l'état de
départ comprend le relevé des tests et parcours qui lisent « Commencer par
l'essentiel », « Choisissez vos fonctionnalités » ou l'écran de bienvenue
(section 13).

## 3. Les trois façons de commencer (PR 1)

### 3.1 L'écran

L'écran de la maquette « Première ouverture, proposition », à la même adresse
(`/irrigation/bienvenue`), avec la barre du haut et le lien « Aller au
contenu » d'aujourd'hui (F71, F257), jamais la barre du bas (la ferme n'a pas
encore de pages). De haut en bas :

1. « Bienvenue » (petit titre) puis **« Comment voulez-vous commencer ? »** ;
2. « Choisissez ce qui vous ressemble. Vous pourrez changer à tout moment, sans
   rien perdre. » ;
3. **trois choix**, un par ligne, pleine largeur, une icône, un nom en gras, une
   phrase ; **un seul à la fois** ;
4. une phrase qui dit **ce qui suit** (3.3) ;
5. **« Continuer »** (50 px de haut, pleine largeur), grisé tant qu'aucun choix
   n'est fait ;
6. le lien **« Choisir moi-même les fonctionnalités »** (44 px au moins).

| Choix | Phrase (celle de la maquette) | Cases cochées |
| --- | --- | --- |
| **Je note mes arrosages** | « Je décide seul. Le module lance le minuteur et compte l'eau donnée à chaque planche. » | Arrosages, Historique et cumuls |
| **Le module me propose quoi arroser**, étiquette « Conseillé » | « Chaque matin, une proposition selon la météo et l'eau que je vise. Je valide, rien ne part sans moi. » | Planning de la semaine, Ressources et pompes, Historique et cumuls |
| **Tout : sol, cultures et alertes** | « En plus : ce que le sol retient, la soif de chaque culture selon son stade, les alertes de gel et de chaleur. » | les onze cases |

**Les cases qu'entraîne chaque choix** sont celles de la fermeture de la 3.8
(R3, `checkFeature`) : la deuxième façon coche aussi Objectifs et besoins,
Arrosages et Matériel et placement, dont le Planning a besoin ; la première coche
aussi Matériel et placement. Un test calcule la liste complète de chaque façon
et la vérifie contre la fermeture.

### 3.2 Les règles

- **Rien n'est choisi d'avance.** La maquette montre la deuxième façon
  enfoncée pour illustrer ; le code **ne la coche pas à la place de la
  personne** : l'étiquette « Conseillé » la désigne, « Continuer » attend un
  appui (3.8, F452 : « rien n'est coché d'office » ; consigne : rien ne se
  confirme à la place de la personne). **Écart voulu avec la maquette**, dit au
  porteur (S6-a).
- **Un choix exclusif** : trois boutons radio natifs (`radiogroup`), le nom de
  chaque choix en étiquette, le texte en description (`aria-describedby`),
  flèches du clavier, cible de 72 px au moins. Le choix retenu porte la bordure
  verte épaisse de la maquette **et** une coche : la couleur seule ne le dit pas.
- **Rien n'est écrit avant « Continuer »** (D-028) ; l'appui enregistre, puis la
  page s'ouvre (3.4). « Continuer » dit « Enregistrement… » pendant l'appel, et
  l'erreur du serveur s'affiche sous le bouton, le choix gardé.
- **Même mots que le reste du module** : les noms des choix et leurs phrases sont
  des constantes du domaine (`lib/domain/features/start.ts`, nouveau fichier),
  relues par le test de vocabulaire de S1. Aucune phrase ne contient « RFU »,
  « ET0 », « objectif hydrique »…
- **« Choisir moi-même les fonctionnalités »** remplace les trois choix, **sur
  la même page**, par la liste des onze cases d'aujourd'hui (`FeatureChoiceList`,
  3.8 R3 et P7 : au moins une case pour continuer, rien coché d'avance). Si un
  des trois choix était enfoncé, ses cases sont déjà cochées (la personne les
  ajuste) ; un lien « ‹ Revenir aux trois façons » les referme sans rien
  enregistrer. « Commencer par l'essentiel » (F452) **disparaît** : les trois
  façons font son travail.
- **Le texte de l'écran de la 3.8** (« Cochez ce dont votre ferme a besoin… »)
  passe sur la liste « Choisir moi-même », où il garde son sens.
- **Aucune lecture d'Ouvre ta ferme** avant le choix (3.8, R5, inchangé) : les
  trois choix ne lisent rien.

### 3.3 La phrase qui dit ce qui suit

Sous les choix, une phrase qui **suit le choix** (la maquette, qui dit toujours
« cinq », se trompe pour deux des trois façons ; **écart dit**, S6-b) :

| Choix | Phrase |
| --- | --- |
| aucun | « Ensuite, quelques étapes pour décrire votre ferme, en plusieurs fois si vous voulez. » |
| Je note mes arrosages | « Ensuite, deux étapes pour décrire votre ferme : le matériel et où il est posé. En plusieurs fois si vous voulez. » |
| Le module me propose quoi arroser | « Ensuite, quatre étapes pour décrire votre ferme : le matériel, où il est posé, d'où vient l'eau, combien vous visez. En plusieurs fois si vous voulez. » |
| Tout | « Ensuite, cinq étapes pour décrire votre ferme : le matériel, où il est posé, d'où vient l'eau, combien vous visez, votre sol. En plusieurs fois si vous voulez. » |

Le nombre vient de la même fonction que la carte de la mise en route
(section 5 : une étape existe quand sa case est cochée), **jamais écrit en
double** : un test échoue si l'écran et la carte divergent. Dans « Choisir
moi-même », la phrase n'est pas montrée.

### 3.4 Après « Continuer »

L'action `saveFeatureSelectionAction` (3.8) reçoit `{ startMode, enabled }` :

- `startMode` : `notes` (je note), `proposals` (le module propose), `all`
  (tout) ou `custom` (« Choisir moi-même ») ;
- pour les trois premières, **le serveur calcule lui-même les cases** depuis la
  table de 3.1 (le `enabled` du client, s'il y en a un, est ignoré : un client ne
  fait pas la liste) ; pour `custom`, il valide `enabled` comme avant (au moins
  une case connue, fermeture appliquée).
- Elle n'écrit **que pour une ferme à sa première ouverture** (`firstVisit`) ;
  appelée ensuite, elle refuse avec la phrase d'aujourd'hui. Mêmes contrôles
  d'isolation par utilisateur et exploitation que la 3.8.

**La page d'arrivée** est **« Ma ferme »** quand la mise en route a au moins une
étape, **sinon la page d'arrivée d'aujourd'hui** (S3-j, F31 : « Aujourd'hui »
quand elle existe). Une ferme qui ne coche que des alertes (`custom`) n'a aucune
étape et arrive là où elle arrivait. **C'est la seule fois où l'on arrive sur
« Ma ferme »** : les ouvertures suivantes gardent la page d'arrivée de F31.

## 4. Ce que la ferme garde du choix (PR 1)

**Une seule migration, additive**, sur `irrigation_feature_selections`
(`drizzle/0027_feature_selections.sql`, 3.8, PR 1) — deux colonnes, **sans
valeur par défaut écrite** pour les lignes existantes, rien d'autre touché :

| Colonne | Valeurs | Dit |
| --- | --- | --- |
| `start_mode` | `null`, `notes`, `proposals`, `all`, `custom` (contrainte `CHECK`) | comment la ferme a commencé ; `null` : **une ferme d'avant S6** (elle n'est jamais passée par le nouvel écran) |
| `route_state` | `null`, `later`, `done` (contrainte `CHECK`) | l'état de la carte « Mise en route » : visible, remise à plus tard par la personne, terminée par la personne |

- **`start_mode` nul = aucune carte, jamais.** Une ferme qui utilisait déjà le
  module garde tout ce qu'elle a (3.8, R6) et **ne voit pas la carte de la mise
  en route**, comme la 4.4 garde les réglages d'avant l'accueil tels quels
  (F426). Elle voit en revanche les lignes d'état des fiches (PR 3), qui ne
  demandent aucune colonne.
- `start_mode` **n'est lu que pour décider si la carte existe** (et pour la
  ligne de Réglages, section 9). Les cases cochées plus tard, dans Réglages,
  ne le changent pas : c'est un fait, pas un réglage.
- `route_state` est écrit **par un appui** (« Plus tard », « Reprendre »,
  « Terminer », section 5.4), jamais par une lecture.
- **Isolation** : la table est déjà à une ligne par espace d'irrigation ; aucun
  index ni clé nouveau. Un test à deux fermes (Alice, Bob) vérifie que le choix
  de l'une n'apparaît pas chez l'autre, aux quatre passages d'isolation du
  dépôt.
- **Démonstration** : les trois fermes fictives sont des fermes d'avant S6
  (`start_mode` nul, leur choix déjà posé) ; la **ferme vierge** passe par
  l'écran, et son choix s'écrit dans la base de démonstration comme aujourd'hui.
- **Export et effacement** : les deux colonnes suivent la ligne (export des
  données, demande d'effacement de la 4.5) sans code propre ; un test le vérifie
  pour l'export.

## 5. La mise en route (PR 2)

Une carte en tête de « Ma ferme », sous le titre, au-dessus des fiches (la
« place » que S3 a gardée, S3, section 5). Elle **se lit sur les données de la
ferme** : aucune étape n'est « cochée » par la personne, aucune ne s'enregistre.
Une étape est faite quand **ce qu'elle décrit existe**.

### 5.1 Les cinq étapes

Une étape **existe quand sa case est cochée** (3.2 de S3 : une case décochée
retire sa page, donc sa fiche, donc son étape) :

| N° | Étape | Existe si | Faite quand | Ce que la ligne dit une fois faite | Ce qu'elle débloque (dit dans la carte) | Où elle mène |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **Mon matériel** | Matériel et placement | au moins un matériel a au moins un réglage | « 4 goutte-à-goutte » (ou « 2 goutte-à-goutte et 1 aspersion ») | « Après cette étape, vous pouvez noter un arrosage. » | « Matériel et placement », le formulaire d'ajout |
| 2 | **Où il est posé** | Matériel et placement | au moins une planche de la saison a un matériel posé | « 10 planches arrosées sur 18 » | « Après cette étape, le module sait quelles planches vous arrosez. » | « Matériel et placement », la pose |
| 3 | **D'où vient l'eau** | Ressources et pompes | au moins une ressource en eau est enregistrée | « un puits, un bassin » (leurs noms, jusqu'à deux, puis « et 1 autre ») | « Après cette étape, le module vérifie qu'il y a assez d'eau. » | « Ressources et pompes », l'ajout d'une ressource |
| 4 | **Combien je vise par semaine** | Objectifs et besoins | **toutes** les planches de la saison ont une eau visée (objectif posé ou automatique) | « 7 planches sur 10 ont un objectif » → faite : « ferme entière » | « Après cette étape, le module vous propose vos arrosages. » | la page qui porte l'objectif (« Objectifs et besoins »), le premier objectif manquant |
| 5 | **Mon sol** | Réserve du sol | toutes les parcelles de la saison ont un sol saisi | « sol de 6 parcelles » | « Après cette étape, le module sait ce que votre sol retient. » | « Réserve du sol », la première parcelle sans sol |

Lectures, **une règle en un seul endroit** (AGENTS.md, interdits) : l'étape 4
**appelle** `farmObjective` et sa phrase (`farmObjectiveScopeText`, S1,
section 5) : le compte « 7 planches sur 10 » est **exactement** celui de
« Aujourd'hui » (la cause 7 du diagnostic : un même chiffre ne change pas d'une
page à l'autre). L'étape 5 **appelle** `parcelsWithoutSoil` (4.4, F584) : même
parcelles, même ancre de la première (`soilToEnter.anchor`), même texte
(« sol de n parcelles ») que la ligne du bandeau « À finir ». L'étape 3 compte
les ressources de la saison et ne regarde **pas** leur volume : la fraîcheur d'un
relevé est « Fiabilité du calcul » (`RESERVOIR_VOLUME_MAX_AGE_DAYS`, inchangé),
pas la mise en route. Les étapes 1 et 2 lisent l'inventaire et la pose
existants (`lib/domain/equipment-*`, `equipment-placement-state.ts`) ; **le
domaine relève, en PR 2, la fonction exacte de chaque lecture**, la colle dans la
description et la section 14, et n'en écrit aucune nouvelle si une existe.

**Étape faite, étape à faire, étape en cours.** La **première étape non faite
est « en cours »** (rond blanc à bord vert, son numéro, une ligne qui dit ce
qu'il manque, le bouton « Continuer l'étape n ») ; les suivantes sont « à
faire » (rond gris, numéro) ; les faites portent une coche verte
(`aria-label` « fait »). **Rien n'oblige à l'ordre** : chaque ligne est un lien
vers sa page, 44 px au moins, et une étape faite plus loin que la première non
faite est dite faite. L'étape 4 attend l'étape 2 (« Posez d'abord le matériel
sur vos planches ») : sans planche arrosée, « combien je vise » n'a pas de
sens pour le module ; elle est « à faire » et ne mène nulle part avant.

**Ce qu'elles débloquent** n'est dit que pour l'étape en cours (une ligne en
gris), pas pour toutes : c'est la raison de faire l'étape maintenant.

### 5.2 La carte

La carte de la maquette « Ma ferme, proposition » : « Mise en route » ; à
droite « 3 étapes sur 5 » ; une **barre** de progression (`role="img"` avec le
même texte, jamais la couleur seule) ; la liste des étapes (5.1) ; le bouton
principal « Continuer l'étape n » (48 px, pleine largeur) ; sous lui, le lien
« Plus tard » (44 px).

- **Le total est celui des étapes qui existent**, pas cinq d'office (« 2 étapes
  sur 2 » pour la première façon).
- **Hauteur** : la carte tient au téléphone dans **380 px** avec cinq étapes dont
  quatre faites en une ligne (la maquette en fait 330) ; la mesure est collée
  dans la PR (section 12). Les étapes **faites** se replient en une ligne
  (« 3 étapes faites » avec un pli) dès que la carte a plus de trois étapes
  faites ; un pli ne cache jamais l'étape en cours.
- **Moins d'une étape** (aucune case d'étape cochée) : **pas de carte**.
- **Le bandeau « À finir » de la 4.4 n'est pas répété sur « Ma ferme » quand
  la carte est visible** : ses lignes sont déjà sur les fiches avec « À faire »
  (S3) et l'étape 5 reprend le sol. Sur toute autre page il reste tel quel.
  **Écart de présentation dit** (S6-d) ; la 4.4 n'en change pas la règle.

### 5.3 Les états de la carte

| Cas | Ce que la carte montre |
| --- | --- |
| Étapes à faire, `route_state` nul | la carte (5.2) |
| `route_state` = `later` | pas de carte ; **une ligne** en tête de « Ma ferme » : « Reprendre la mise en route · 3 étapes sur 5 » (lien de 44 px ; il remet `route_state` à nul par un appui) |
| Toutes les étapes faites, `route_state` nul | la carte en une ligne : « Votre ferme est décrite. » et le bouton **« Terminer la mise en route »** ; l'appui écrit `route_state` = `done` |
| `route_state` = `done` | rien, jamais ; les fiches gardent leur ligne d'état et leur « À faire » |
| `start_mode` nul (ferme d'avant S6) | rien, jamais |
| Une étape devient fausse après `done` (une planche neuve sans objectif) | rien : la fiche le dit (« À faire »), la carte ne revient pas ; **pas de rappel qui revient** |
| Une case est cochée ou décochée dans Réglages | les étapes suivent (S6-e) : la carte gagne ou perd la ligne de cette case ; un `done` reste `done` |

### 5.4 Les gestes de la carte

- **Chaque écriture suit un appui** (D-028) : « Plus tard », « Reprendre la mise
  en route », « Terminer la mise en route ». Ils écrivent `route_state`, rien
  d'autre, par **une** action du serveur qui vérifie l'espace de l'utilisateur ;
  la réponse s'affiche à côté du bouton (F404) et la page se relit.
- « Continuer l'étape n » est un **lien** (page de l'étape, ancre, saison, jardin
  gardés), pas une action.
- **La mise en route ne confirme rien à la place de la personne** : elle ne
  coche aucune étape de la 4.4, ne pose aucun objectif, ne choisit aucun sol.
  Elle montre ce qui existe.

## 6. La lecture de la mise en route : une seule, et peu chère (PR 2)

La lenteur du module a été payée cher (N1 à N3, 24 et 25 novembre 2026 ;
`docs/lenteur-du-module-contract.md`). **« Ma ferme » ne doit pas ralentir.**

- **Une fonction du domaine** (`lib/domain/onboarding/route.ts`, nouveau
  fichier) construit les étapes **à partir de nombres déjà lus**, sans accès à la
  base : le service lui passe un petit objet de comptes (matériels avec réglage,
  planches posées, ressources, planches avec objectif, parcelles sans sol).
- **Une lecture, une fois par page**, lancée **en même temps** que le plan et
  l'accueil de la ferme (`Promise.all`, comme `page-context.ts`), **seulement
  quand la carte existe** (`start_mode` non nul, `route_state` nul ou `later`) et
  **seulement sur « Ma ferme » et sur « Aujourd'hui »** (section 8). Aucune autre
  page ne la charge.
- **Des comptes, jamais des lignes** : chaque nombre est un `COUNT` ou un compte
  fait sur ce que la page a déjà (le plan, l'inventaire de matériel que le gabarit
  lit) ; **aucune requête par planche ni par jardin** (isolation et coût : 300
  planches coûtent comme dix).
- **Budget** : le temps serveur de « Ma ferme » avec la carte ne dépasse pas
  de plus de **20 %** celui de « Réglages » (la page de « Ma ferme » la plus
  proche), mesuré avant/après sur la ferme A de la démonstration **et** sur une
  ferme de 300 planches générée par le test ; au-delà, la PR s'arrête et dit
  quelle lecture est trop chère. Les mesures sont collées (section 14).
- **Les lectures d'« Aujourd'hui »** : aucune de plus quand la carte
  n'existe pas ; quand elle existe, **la même lecture, pas une seconde** (la
  fonction est appelée une fois par requête, `renderOncePerRequest`).
- **Hors ligne ou erreur de lecture** : la carte est omise et la page dit
  « La mise en route n'a pas pu être lue » en une ligne ; la page ne tombe pas.
  Une donnée inconnue reste inconnue : une étape dont le compte est inconnu est
  « à vérifier », jamais « faite » ni « à zéro » (D-003).

## 7. Les chiffres d'état des fiches de « Ma ferme » (PR 3)

S3 a rangé « Ma ferme » en fiches avec **une ligne fixe** et la marque « À
faire », sans chiffres d'état (S3-g, écart voulu avec la maquette : aucune lecture
de plus). S6 les ajoute, **avec la mise en route, qui lit les mêmes données**.

### 7.1 La règle

- **Une fiche dit son état en une ligne** (une ligne à 390 px ; à 320 px elle
  peut passer sur deux, la fiche grandit, aucun texte coupé, cible de 68 px au
  moins). **La ligne d'état remplace la ligne fixe** quand la donnée est connue ;
  **la ligne fixe de S3 revient** quand la donnée est inconnue, indisponible ou
  hors budget (6) : jamais une ligne qui dit « 0 » pour un inconnu (D-003).
- **La marque « À faire » de S3 reste** (orange, texte de l'étape). Elle ne
  vient que de l'accueil de la 4.4 ; la ligne d'état dit ce qui **est**, la marque
  ce qui **manque**.
- **Une ligne d'état n'invente rien** : chaque nombre est une valeur que la page
  de la fiche montre déjà, sous le même mot (prévu, estimé, mesuré ne se
  confondent pas, D-006). Une ligne qui dirait plus que sa page est refusée.
- **Mêmes lectures que la mise en route** : la ligne de « Matériel » et les
  étapes 1 et 2 sortent des mêmes comptes ; celle d'« Eau » et l'étape 3 ; celle
  de « Sol » et l'étape 5. **Une seule lecture, plusieurs phrases**, jamais deux
  comptes qui peuvent différer.
- **Les noms** : S3-b gardait les noms des pages (« Matériel et placement »,
  « Ressources et pompes », « Besoin par culture », « Réserve du sol », deux
  fiches d'alertes) en attendant S6, qui devait « retoucher les noms avec les
  cases ». **S6 ne les change pas** (S6-f) : le diagnostic a déjà réglé les mots
  des **titres** avec S1 (« Y a-t-il assez d'eau ? », « Eau utilisable »…), la
  ligne d'état dit ce que la fiche contient, et renommer une page touche le
  menu, le « ? », la visite guidée, les cases de Réglages, vingt tests et
  parcours pour un gain que la ligne d'état donne déjà. **Écarts voulus avec la
  maquette, dits au porteur** : pas de noms courts (« Eau », « Sol »,
  « Cultures »), et **deux fiches d'alertes** (météo, cultures) au lieu d'une,
  parce qu'il y a deux cases et deux pages.

### 7.2 Les lignes

Chaque ligne est un gabarit du domaine (`lib/domain/farm-home/lines.ts`,
nouveau fichier), relue par le test de vocabulaire de S1. Les exemples
viennent de la maquette.

| Fiche | Ligne d'état | Données | Repli (ligne fixe de S3) quand |
| --- | --- | --- | --- |
| Matériel et placement | « 4 goutte-à-goutte, tous posés » ; « 4 goutte-à-goutte, 1 pas posé » ; « 2 goutte-à-goutte et 1 aspersion, tous posés » | matériels par type, posés ou non (étapes 1 et 2) | aucun matériel |
| Ressources et pompes | « Bassin des noues : 30 m³ sur 40, relevé ce matin » (une ressource) ; « 3 ressources, 2 relevées cette semaine » (plusieurs) ; « Bassin des noues : volume jamais relevé » | ressources, dernier relevé, **le relevé à sa date** (jamais un volume plus récent que sa date) | aucune ressource |
| Besoin par culture | « 8 cultures cette saison, toutes reconnues » ; « 8 cultures cette saison, 2 pas encore reconnues » | espèces plantées, rattachées à une culture de référence (la lecture de `speciesWithoutReference`, F587) | aucune espèce plantée |
| Réserve du sol | « Sol connu pour 6 parcelles sur 6 » ; « À renseigner pour 3 parcelles » (aussi la marque) | `parcelsWithoutSoil` (4.4) | aucune parcelle |
| Alertes météo | « 2 alertes réglées » ; « Aucune alerte réglée » | critères d'alerte météo enregistrés de la ferme | lecture indisponible |
| Alertes cultures | « Gel suivi pour 8 cultures » ; « Réglages d'origine » | cultures plantées dont un seuil de gel existe ; les réglages sont-ils ceux d'origine | lecture indisponible |
| Réglages | « Météo de Nantes · 11 fonctionnalités cochées » ; « Commune de la météo à confirmer » (marque) | commune retenue pour la météo ; nombre de cases cochées | commune inconnue |

- **Ce qui n'y est pas** : l'état des **messages du téléphone** (l'autorisation
  se lit dans le navigateur, pas sur le serveur : la fiche ne le dit pas, S6-g ;
  la ligne de la maquette « Réglages : Météo de Nantes, messages du téléphone,
  fonctionnalités » est **raccourcie** pour cette raison, écart dit) ; aucune
  somme de volumes entre ressources de natures différentes (un puits et un
  bassin ne s'additionnent pas dans une ligne : plusieurs ressources se **comptent**).
- **« Alertes cultures » et « Alertes météo »** : si la lecture d'un seuil ou
  d'un critère n'existe qu'au prix d'un calcul de la page (hors budget), la
  ligne fixe de S3 reste ; la PR 3 le dit dans sa description et dans la
  section 14, ligne par ligne (« ligne d'état faite » ou « repli gardé »).
- **Aucun chiffre agronomique n'est calculé** : ce sont des comptes et des dates
  déjà posés ; le contrat ne touche ni dose, ni seuil, ni coefficient, ni règle du
  plan.

## 8. « Aujourd'hui » quand la ferme n'est pas prête (PR 2)

Aujourd'hui, une ferme neuve ouvre sur une page vide qui ne dit pas quoi faire.
S6 y met **une seule chose** : quand il n'y a **aucune carte d'arrosage** à
montrer, que la carte de la mise en route existe (`start_mode` non nul,
`route_state` nul, au moins une étape non faite), la **ligne d'état vide** de la
page (celle de S2, relevée en PR 2) devient un bloc :

- « **Votre ferme n'est pas encore prête à proposer des arrosages.** » (ou, pour la
  première façon, « Votre ferme n'est pas encore décrite. »)
- la **phrase de l'étape en cours** (« Combien vous visez par semaine : 3 planches
  n'ont pas encore d'eau visée. »),
- le bouton **« Continuer l'étape n »** (lien vers la page de l'étape).

Dès qu'il y a **une carte d'arrosage** (prévu, à rattraper, en cours), ce bloc
**n'est pas montré** : le travail du jour passe avant la description de la
ferme. **« Aujourd'hui » ne gagne donc aucune hauteur** pour une ferme réglée,
et le bloc remplace une ligne vide pour une ferme neuve. La phrase et le bouton
viennent de la **même fonction** que la carte (section 5) : un test échoue si
les deux disent deux étapes différentes.

## 9. Réglages et la place des onze cases

- Les **onze cases restent** dans « Réglages » (section « Fonctionnalités » de
  la 3.8, R8), avec R2 et R3, **sans changement** : on y coche et décoche à tout
  moment. S3 les a rangées sous « Ma ferme ».
- **Une ligne en tête de cette section** dit comment la ferme a commencé :
  « Vous avez commencé par : « Le module me propose quoi arroser » » (le nom du
  choix, `start_mode` ; « Vous avez choisi vous-même vos fonctionnalités » pour
  `custom`). Pas de ligne pour une ferme d'avant S6. **Elle ne propose pas de
  « refaire le choix de départ »** : la liste fait déjà ce travail.
- **Le bandeau de la 3.8** (R6, R7) est inchangé : il annonce l'arrivée d'un
  choix aux fermes d'avant, et les cases nouvelles aux autres.

## 10. La visite guidée et la démonstration (PR 4)

- **La visite « Bienvenue »** (F193, sept étapes) et les visites « Le module à la
  carte » et « Et pour ma ferme ? » parlent de la liste de cases à la première
  ouverture. Leurs **phrases** suivent l'écran des trois façons ; **aucune étape
  n'est ajoutée ni retirée**, leur règle de saut (F177 : l'élément manque, l'étape
  est sautée sans message) tient.
- **La ferme vierge de la démonstration** s'ouvre sur l'écran des trois façons ;
  son moment de catalogue (« La première ouverture : la liste des fonctionnalités
  à cocher, et rien de réglé ») dit « les trois façons de commencer ». Son choix
  s'écrit dans la base de démonstration (4) ; la remise à zéro de la démonstration
  la rend vierge de nouveau, `start_mode` et `route_state` compris.
- **Les trois fermes fictives** (A, B, C) sont des fermes d'avant S6 : elles
  n'ont pas de carte de mise en route. Leurs **lignes d'état** (7) se voient.
  La visite n'a donc pas à parler de la carte pour elles ; la ferme vierge la
  montre.

## 11. Ce que S6 change des contrats validés

| Contrat | Passage | Devient |
| --- | --- | --- |
| `feature-selection-contract.md`, R5 | « à la première ouverture, la liste, rien coché d'avance, avant toute autre page ; il faut cocher au moins une case » | **trois façons de commencer** ; rien choisi d'avance ; « Continuer » attend un choix ; la liste devient « Choisir moi-même », où il faut toujours au moins une case (P7) |
| id., section 5, tableau | `/irrigation/bienvenue` : « la liste, rien coché » | « les trois façons de commencer, ou la liste » |
| id., section 5, « première page » | la première page est la première case cochée de la liste | la première arrivée est « Ma ferme » quand la mise en route a une étape ; les suivantes, la page d'arrivée de F31 |
| id., section 7, « La persistance » | « une table `irrigation_feature_selections` (…) : cases cochées, date du choix, date de la fermeture du bandeau, dernières cases annoncées » | + `start_mode`, `route_state` (4) |
| `audit-ergonomie-lot2-contract.md`, F31 | page d'arrivée | inchangée, sauf la première arrivée (ci-dessus) |
| `audit-ergonomie-2026-11-19-lot-i-contract.md`, n° 25, F452 | « Commencer par l'essentiel » | **retiré** : remplacé par les trois façons |
| `tranche-4-contract.md`, 4.4 (section 8 bis) | le bandeau « À finir » sur chaque page | + **non répété sur « Ma ferme »** quand la carte de la mise en route est visible ; règle et lignes inchangées |
| `simplification-s3-contract.md`, sections 5 et 12 | « pas de chiffres d'état » ; « Mise en route : place vide » ; S3-b (noms) | les lignes d'état et la carte, par S6 ; **les noms ne changent pas** (S6-f) |
| `simplification-s2-contract.md`, section sur la ligne d'état vide | la ligne vide d'« Aujourd'hui » | + le bloc de la section 8, pour une ferme qui n'est pas prête |
| `demo-guided-contract.md`, F178, F193 | les phrases qui parlent des cases à la première ouverture | les trois façons ; mêmes étapes, même règle de saut |
| `browser-journeys-contract.md` | les parcours qui lisent « Choisissez vos fonctionnalités » et « Commencer par l'essentiel » | réécrits dans la PR 1 ; un parcours nouveau ajouté |

**Ne changent pas** : les dix cases et leurs dépendances (3.8, sections 2 à 4,
R1 à R4, R6 à R10) ; D-028 (rien ne s'écrit sans un appui) ; D-003 (un inconnu
n'est jamais zéro) ; D-006 (prévu, estimé, mesuré ne se confondent pas) ; la
règle de l'accueil de la 4.4 (rien n'est confirmé à la place de la personne) ;
le calcul de l'objectif de la ferme (S1) ; l'isolation par utilisateur,
exploitation et saison ; la charte graphique (polices, vert, bleu de l'eau,
cibles de 44 px, contrastes mesurés).

## 12. États rares

| Cas | Ce que ça devient |
| --- | --- |
| Première ouverture, aucun choix | « Continuer » grisé ; rien n'est écrit |
| Première ouverture, « Choisir moi-même », une case | `start_mode` = `custom`, les cases comme avant, la mise en route selon les cases |
| `custom` avec seulement des alertes | aucune étape, aucune carte ; arrivée sur la page d'arrivée de F31 |
| Hors ligne ou serveur en erreur à « Continuer » | l'erreur sous le bouton, le choix gardé, rien écrit |
| Deux appuis sur « Continuer » | un seul enregistrement ; le second est refusé « déjà choisi » et la page s'ouvre (`firstVisit` faux) |
| Ferme d'avant S6 | pas de carte, jamais ; lignes d'état des fiches (PR 3) |
| Ferme neuve, rien dans Ouvre ta ferme (aucune planche) | l'étape 2 est « à faire » (« aucune planche dans votre plan »), les étapes 4 et 5 attendent, le bouton mène au plan d'Ouvre ta ferme dit en une phrase (le module ne le modifie jamais, D-001) |
| Ferme toute sous abri | étape 3 inchangée ; les phrases ne parlent pas de pluie |
| Matériel sans réglage | étape 1 « en cours » : « Un matériel n'a pas encore de réglage » |
| Ressource sans volume | étape 3 faite (la ressource existe) ; la fiche dit « volume jamais relevé » ; « Fiabilité du calcul » garde la fraîcheur |
| Case décochée | l'étape, la fiche, la ligne disparaissent ; les données restent (R1) |
| Une ferme à trois cents planches | rien à replier : la carte et les fiches ne listent que cinq lignes ; les comptes sont des `COUNT` |
| Lecture impossible (hors ligne, base lente) | carte omise, une ligne le dit ; les fiches gardent leur ligne fixe |
| Démonstration (date simulée) | la ferme vierge fait le parcours ; ses données de départ sont celles du catalogue ; la remise à zéro la rend vierge |

## 13. Ce qui ne change pas

- Aucun calcul, aucune règle d'agronomie, aucune donnée de la ferme : deux
  colonnes de présentation sur une table qui existe, écrites par un appui.
- Aucune fonction retirée, aucune page retirée, aucune adresse changée ; les
  onze cases restent.
- Ouvre ta ferme reste lu **sans jamais être modifié** (D-001) ; aucune requête
  de plus vers lui ; à quatre appels par seconde au plus.
- Le texte des notifications n'est pas touché.

### Précisions tranchées (option recommandée, modifiables à la relecture)

| N° | Précision | Choix |
| --- | --- | --- |
| S6-a | Le choix « Conseillé » est-il enfoncé d'avance ? | non : l'étiquette le désigne, « Continuer » attend un appui (écart avec la maquette, dit) |
| S6-b | Le nombre d'étapes dit à l'écran | celui du choix (2, 4 ou 5), pas « cinq » partout (écart avec la maquette, dit) |
| S6-c | Les cases de chaque façon | 1 : Arrosages et Historique ; 2 : Planning, Ressources et pompes, Historique ; 3 : les onze ; fermeture de la 3.8 appliquée |
| S6-d | Le bandeau « À finir » sur « Ma ferme » | non répété quand la carte est visible ; inchangé ailleurs |
| S6-e | Une case change après le choix | les étapes suivent les cases ; `start_mode` ne change pas |
| S6-f | Les noms des pages et des cases | **inchangés** ; pas de noms courts ; deux fiches d'alertes (écart avec la maquette et avec S3-b, dits) |
| S6-g | Les messages du téléphone dans la ligne de Réglages | non dits (l'autorisation vit dans le navigateur) |
| S6-h | Une étape faite | une donnée **existe** ; rien ne s'enregistre ; jamais confirmée à la place de la personne |
| S6-i | L'étape 4 et l'étape 5 | comptent comme « Aujourd'hui » et comme le bandeau « À finir » : `farmObjective` et `parcelsWithoutSoil`, jamais un nouveau compte |
| S6-j | Ferme d'avant S6 | aucune carte, jamais ; lignes d'état des fiches seulement |
| S6-k | Le rappel après « Terminer » | aucun : la carte ne revient pas, la fiche dit « À faire » |
| S6-l | Une carte « Plus tard » | une ligne « Reprendre la mise en route · n étapes sur N » en tête de « Ma ferme » |
| S6-m | L'essai des cinq tâches avec le premier volontaire | conseillé **avant la mise en ligne de la PR 1**, jamais bloquant pour le code ; la première ouverture est ce que le pilote verra en premier |
| S6-n | S6 devant les autres lots | possible si le pilote démarre avant (ligne 33) ; elle ne demande alors que S3 (page « Ma ferme ») et S1 (objectif) |

Aucune de ces précisions n'est agronomique : aucune ne touche une dose, un
seuil, un coefficient, la lecture d'une donnée du plan ou une règle du plan.
**Aucune question n'est réservée au porteur.** Si une question agronomique se
pose en codant, la PR s'arrête, le dit, et le porteur tranche, une question par
message.

## 14. Tests et preuves

- **Domaine** (sans navigateur) : chaque façon de commencer coche exactement la
  fermeture attendue (les trois, plus `custom`) ; le nombre d'étapes pour chaque
  choix valide parmi les parties des onze cases que la fermeture accepte ;
  chaque étape dans chacun de ses états (faite, en cours, à faire, à vérifier) ;
  l'étape en cours est la première non faite ; l'étape 4 attend l'étape 2 ;
  `later`, `done`, `start_mode` nul ; la phrase de l'écran et le total de la
  carte identiques ; la phrase de « Aujourd'hui » et celle de la carte
  identiques ; chaque ligne d'état et son repli ; **aucun mot du calcul** dans
  aucune phrase (test de vocabulaire de S1) ; aucun inconnu dit zéro (D-003).
- **Action et base** (`tests/db/`) : `saveFeatureSelectionAction` pour chaque
  `startMode` ; le client qui envoie un `enabled` qui ne correspond pas (ignoré
  pour les trois façons) ; un second appel refusé ; **Alice et Bob** (le choix de
  l'une n'apparaît pas chez l'autre, aux quatre passages d'isolation) ; la
  migration additive sur une base qui a déjà des lignes (leurs colonnes valent
  `null`) ; l'export contient les deux colonnes ; `route_state` écrit par une
  action qui vérifie l'espace.
- **Interface** : l'écran (trois choix, radio natifs, clavier, coche et bordure,
  étiquette, « Continuer » grisé puis actif, l'erreur sous le bouton) ; « Choisir
  moi-même » et « ‹ Revenir » ; la carte (cinq états de la section 5.3, les
  étapes faites repliées, `aria-label`, barre en `role="img"`, 44 px) ; le bloc
  d'« Aujourd'hui » ; les lignes des fiches ; **le bandeau « À finir » non
  répété** sur « Ma ferme » seulement.
- **Parcours** (numéro pris en codant), aux deux largeurs : la ferme vierge de la
  démonstration, les trois façons une à une, l'arrivée sur « Ma ferme » avec le
  bon nombre d'étapes ; une étape faite (un matériel créé) passe de « en cours » à
  « faite » après relecture ; « Plus tard » puis « Reprendre » ; « Terminer » ;
  « Choisir moi-même » ; une ferme d'avant S6 (la ferme A) n'a **aucune carte** ;
  les lignes d'état de la ferme A ; la ligne de « Aujourd'hui » pour une ferme
  neuve, absente quand un arrosage est prévu ; aucun débord à 320 px, cibles de
  44 px.
- **Contre-épreuve** (habitude du dépôt) : une façon qui coche une case de moins ;
  un client qui impose ses cases ; une carte montrée à une ferme d'avant S6 ; le
  bandeau « À finir » qui reste doublé sur « Ma ferme » ; une étape faite sans
  donnée ; un compte de l'étape 4 qui diffère de « Aujourd'hui » ; une ligne
  d'état qui dit zéro pour un inconnu ; la carte qui revient après « Terminer » ;
  « Commencer par l'essentiel » qui reparaît ; une lecture par planche : chaque
  altération fait échouer un test.
- **Mesures** : hauteur de la carte à 390 px (borne 380 px) ; temps serveur de
  « Ma ferme » avant/après sur la ferme A et sur une ferme de 300 planches
  (borne +20 %, section 6) ; hauteur de l'écran de première ouverture avant
  (11 cases, 365 mots) et après ; nombre de mots avant/après. Collées dans la PR
  et dans la section 15.
- **Recette** après la mise en ligne de chaque PR, dans le Chrome du porteur,
  avec son accord, en lecture seule : le constat est à l'assistant, le jugement
  des mots et de l'ordre au porteur (D-014). **La première ouverture ne s'essaie
  que sur la ferme vierge de la démonstration en ligne**, jamais sur la ferme
  réelle (qui n'y repasse pas).

## 15. À remplir par les PR

- Relevé des tests, parcours et liens qui lisent « Commencer par l'essentiel »,
  « Choisissez vos fonctionnalités » ou l'écran de bienvenue (PR 1).
- Décision de ce lot, précisions F, parcours, numéro de la migration : pris en
  codant (PR 1).
- Les lectures exactes de chaque compte de la mise en route et de chaque ligne
  d'état, avec leur coût (PR 2 et PR 3), et, pour chaque ligne, « ligne d'état
  faite » ou « repli gardé ».
- Mesures avant/après (section 14) et temps serveur (PR 2, PR 3).

**PR 1, 26 novembre 2026** (D-336, F947 à F957) :

- **Relevé de départ** (F956) : « Commencer par l'essentiel » n'était lu que
  par `lib/domain/features/choice.ts` et l'écran ; « Choisissez vos
  fonctionnalités » par l'écran, le titre de la page, la visite, P22 et
  l'aide des parcours ; l'écran de bienvenue par P22, P23, P25, P28, P29,
  P30, P63, P66, vingt et un parcours par l'aide `ouvrirUneFermeToutCochee`,
  V6, V8, neuf fichiers de tests et les deux étapes de « Le module à la
  carte » posées sur `bienvenue`. Tous suivent dans la PR 1, sauf les
  phrases de ces deux étapes (PR 4, section 10).
- **Pris en codant** : décision D-336 ; précisions F947 à F957 ; migration
  `drizzle/0051_start_mode_route_state.sql` ; parcours P69 (nouveau).
- **Mesures** (F957) : à 390 px, en local, ferme neuve, hauteur de la page
  et mots de l'écran comptés de la même façon : avant, 2 227 px et 343 mots
  (onze cases) ; après, 920 px et 108 mots (les trois façons) ; « Choisir
  moi-même », 2 230 px et 332 mots. Huit contre-épreuves, chacune rouge.

## 16. Risques

| Risque | Parade |
| --- | --- |
| Une ferme neuve ne trouve pas « sa » façon | « Choisir moi-même » reste à un appui ; les trois façons se changent à tout moment par les cases ; l'essai avec le premier volontaire, conseillé |
| La deuxième façon, « Conseillé », est prise par tous sans réflexion | elle n'est pas enfoncée d'avance (S6-a) ; son nom et sa phrase disent ce qu'elle fait ; les cases se changent dans Réglages |
| La carte devient un rappel qui revient | `later` et `done` sont écrits par un appui et ne reviennent pas (S6-k) ; une ferme d'avant S6 n'en a jamais |
| Une étape se dit faite sans l'être | « faite » = la donnée existe (comptée) ; un compte inconnu est « à vérifier » ; contre-épreuve |
| « Ma ferme » devient lente | une lecture, des `COUNT`, lancée avec le plan, seulement quand la carte existe ; borne +20 % mesurée, la PR s'arrête sinon |
| Deux chiffres différents pour la même chose (objectif, sol) | l'étape 4 et l'étape 5 appellent `farmObjective` et `parcelsWithoutSoil` (S6-i) ; un test les compare à « Aujourd'hui » et au bandeau |
| Le client impose des cases | le serveur recalcule les cases des trois façons ; contre-épreuve |
| La migration casse une base existante | deux colonnes nullables, `CHECK` sur les valeurs, aucune écriture ; testée sur une base qui a des lignes |
| La visite guidée ou un parcours lit l'ancien écran | relevé d'abord (PR 1) ; ils suivent dans la PR qui les change ; la visite saute une étape dont l'élément manque (F177) |
| Une personne perd la liste des onze cases | elle est dans « Choisir moi-même » à la première ouverture et dans « Ma ferme » → Réglages ensuite, sans changement |
| Le bandeau « À finir » disparaît de « Ma ferme » et un manque passe inaperçu | ses lignes sont sur les fiches (« À faire ») et dans l'étape 5 ; la carte les dit ; le bandeau reste sur toutes les autres pages |
| S6 avant S3 (S6-n) | elle ne demande que la page « Ma ferme » et l'objectif de S1 ; sinon S3 d'abord |

## 17. Réglage du code

**Opus 5.5 · Très élevé** pour les quatre PR (ligne 33 de la roadmap, troisième
cas de la grille) : le lot change l'écran de première ouverture d'un contrat
validé (3.8), ajoute un état de mise en route par ferme (migration additive,
action, lecture) et réécrit des parcours et des visites qui lisent l'ancien
écran ; son contexte est étendu. Aucune règle d'agronomie ni d'isolation n'est
touchée ; si une PR devait en changer une, elle s'arrête et le dit.
