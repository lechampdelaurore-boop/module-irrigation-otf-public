# Contrat — Simplifier l'usage du module, lot S3 : trois endroits (25 novembre 2026)

Roadmap section 6 terdecies, ligne 33 de l'ordre d'exécution. Décision du
chantier : **D-327**. La décision de ce lot est **posée par sa première PR de
code**, au premier numéro libre à ce moment-là ; de même les précisions **F**
(celles de ce contrat sont nommées S3-a, S3-b… et prennent leur F en codant) et
le parcours **P** (premier numéro libre ; P61 est celui de S1, P62 celui de
S2).

Ce contrat **change** celui de la barre du bas et du menu
(`docs/audit-ergonomie-lot2-contract.md`, section 4, F6 ;
`docs/aujourdhui-tableau-de-bord-contract.md`, section 3.1, T1) et la liste
des pages de `docs/feature-selection-contract.md`, section 5. La section 10 dit,
passage par passage, ce qui change ; les PR de code le réécrivent dans les
leurs. Choix n° 1 du porteur, 25 novembre 2026, 11 h 59 : « Oui, trois
endroits ».

Logiciel **multi-fermes** : rien ci-dessous ne dépend de la taille ni du
contenu d'une ferme. Le rangement est le même pour dix planches et pour
trois cents ; ce sont les listes à l'intérieur des pages qui se replient. Les
mesures se font sur les données des parcours, jamais sur la ferme du porteur.

## 1. Origine

Le diagnostic du 25 novembre 2026
(`/mnt/project-files/audit-ergonomie/diagnostic-simplicite-2026-11-25.md`,
causes 1 et 4, idée 1) constate que le module est **rangé comme son calcul,
pas comme la journée** : treize pages au même rang, quatre dans la barre du
bas, neuf derrière « Plus », une liste que rien n'ordonne par la question du
maraîcher. Quatre pages du menu (Matériel et placement, Ressources et pompes,
Réserve du sol, Besoin par culture) sont surtout des réglages, qu'on ouvre à
l'installation, et elles ont le même rang que les pages de tous les jours. Trois
pages (planning, objectifs et besoins, historique) parlent de la même semaine
sous trois angles : il faut savoir laquelle ouvrir.

La proposition, retenue par le porteur : **trois endroits** qui répondent
chacun à une question, et un « + » pour les gestes qu'on fait sans y penser.
Les maquettes
(https://claude.ai/artifact/CTM7RxB6X4UgMTHKsaha8F, écrans « Le bouton + »,
« Semaine » et « Ma ferme ») les dessinent.

| Endroit | La question | Ce qu'on y trouve |
| --- | --- | --- |
| **Aujourd'hui** | Qu'est-ce que je fais maintenant ? | « Aujourd'hui », « Arrosages » |
| **Semaine** | Est-ce que ma semaine est bonne ? | « Planning de la semaine », « Objectifs et besoins », « Historique et cumuls » |
| **Ma ferme** | Qu'est-ce que le module sait de ma ferme ? | « Matériel et placement », « Ressources et pompes », « Besoin par culture », « Réserve du sol », « Alertes météo », « Alertes cultures », « Réglages » |

Le porteur a retenu les six lots (12 h 01) et demandé qu'ils s'enchaînent sans
nouveau « vas-y » (12 h 03).

**Ce que S3 ne fait pas.** Fusionner le contenu des trois pages de la semaine
(S4) ; refaire le formulaire d'arrosage en trois champs (S5) ; la mise en route
en cinq étapes, les trois façons de commencer et les chiffres d'état des
fiches de « Ma ferme » (S6) ; raccourcir « Aujourd'hui » (S2). S3 **range** :
aucune page n'est retirée, aucune adresse n'est changée, aucun calcul ne bouge.

**Dépendance.** S3 attend la fin du code de S2 (ligne 33 : un seul chantier
de code à la fois ; fichiers communs : le gabarit des pages et « Aujourd'hui »).
Le « + » monte la fenêtre « Noter la pluie » de la PR 4 de S2
(`docs/simplification-s2-contract.md`, section 7) : S3 ne la refait pas.

## 2. Livraison en quatre PR, une à la fois

| PR | Contenu | Preuve |
| --- | --- | --- |
| 1 · Le rangement et « Ma ferme » | la correspondance page → endroit dans le domaine ; la page « Ma ferme » en fiches, à son adresse, ajoutée à l'ancien menu comme une page de plus ; son « ? » | tests du domaine (toutes les cases) et de l'interface ; parcours |
| 2 · La barre du bas, le « + » et le chemin de retour | au téléphone : trois endroits et le « + » à la place des quatre entrées et de « Plus » ; la feuille « Que voulez-vous faire ? » ; la bande des trois pages de la semaine ; le retour « ‹ Ma ferme » | tests ; parcours aux deux largeurs ; mesures de hauteur et de touches |
| 3 · Le menu de l'ordinateur | trois groupes à la place d'« Arroser, Équiper, Surveiller » ; le bouton « + » en tête | tests ; parcours à 1 440 px |
| 4 · Les liens et les visites | la visite guidée de la démonstration, les liens qui disent « menu » ou « Plus », les parcours qui lisent l'ancien menu ; contrats réécrits | tests ; parcours ; recette |

**Chaque PR garde le module entier utilisable.** La PR 1 ne retire rien : « Ma
ferme » s'ajoute à l'ancien menu. La PR 2 ne touche que le téléphone : le
menu de l'ordinateur et celui du téléphone sont le même composant
(`FeatureMenu`), mais la feuille « Plus » n'existe qu'au téléphone. La PR 3 ne
touche que l'ordinateur. Entre la PR 2 et la PR 3, l'ordinateur garde son menu
d'avant ; les deux sont cohérents avec le même rangement (section 3).

Chaque PR : `lint`, `typecheck`, `test`, `build`, `knip`, `push:check`,
`weather:check`, `site:check` collés ; `e2e` joué en local sur les parcours
touchés, la suite complète par la CI ; registres à jour dans la même PR
(roadmap : tableau de la section 1, ordre de la section 2, bloc détaillé).
Avant d'écrire, chaque PR relève l'état de départ (contrôles, mesures à
390 px) et le colle dans sa description (consigne 6 du projet).

**Avant le code, conseillé par le diagnostic (section 6) : l'essai des cinq
tâches** avec le premier volontaire du pilote sur les maquettes (« que devez-vous
arroser ce matin ? », « lancez cet arrosage », « notez 8 mm de pluie », « votre
semaine est-elle bonne ? », « vous avez changé un goutte-à-goutte, où le
dites-vous ? »). Il dépend du porteur et **ne bloque pas le code** : les PR sont
réversibles et une à la fois. Le porteur est prévenu à l'ouverture de la PR 2,
la seule qui change ce qu'on voit au téléphone, et peut demander l'essai avant
sa fusion ; le résultat règle les noms et l'ordre, jamais la structure.

## 3. Les trois endroits

### 3.1 Où va chaque page

Une seule fonction du domaine (`lib/domain/features/`, nouveau fichier) dit,
pour chaque identifiant de page, son endroit. **Une règle vit en un seul
endroit** (AGENTS.md) : la barre du bas, le menu de l'ordinateur, le retour, la
bande de la semaine, « Ma ferme » et la visite guidée l'appellent, aucun ne
copie la liste. Un test échoue pour une page sans endroit ou avec deux : ajouter
une page au module oblige à la ranger.

| Page | Adresse | Endroit | Dans l'endroit |
| --- | --- | --- | --- |
| Aujourd'hui | `/irrigation/aujourdhui` | Aujourd'hui | l'entrée de l'endroit |
| Arrosages | `/irrigation/arrosages` | Aujourd'hui | par le « + » et par un lien de « Aujourd'hui » (3.4) |
| Planning de la semaine | `/irrigation/planning` | Semaine | la bande de la semaine (3.3) |
| Objectifs et besoins | `/irrigation/besoins` | Semaine | id. |
| Historique et cumuls | `/irrigation/historique` | Semaine | id. |
| Matériel et placement | `/irrigation/materiel` | Ma ferme | une fiche |
| Ressources et pompes | `/irrigation/ressources` | Ma ferme | une fiche |
| Besoin par culture | `/irrigation/cultures` | Ma ferme | une fiche |
| Réserve du sol | `/irrigation/sol` | Ma ferme | une fiche |
| Alertes météo | `/irrigation/alertes-meteo` | Ma ferme | une fiche (l'alerte du jour reste sur « Aujourd'hui ») |
| Alertes cultures | `/irrigation/alertes-cultures` | Ma ferme | une fiche |
| Réglages | `/irrigation/reglages` | Ma ferme | une fiche, plus « à part en bas » |
| **Ma ferme** (nouvelle) | `/irrigation/ma-ferme` | Ma ferme | l'entrée de l'endroit |

La page d'accueil du module, l'écran de bienvenue, la page introuvable et la
page d'état de l'exploitant ne sont dans aucun endroit : ils n'ont pas
d'entrée de barre et gardent leur comportement.

### 3.2 Quand un endroit existe

Les fonctionnalités à la carte restent (choix n° 3 du contrat 3.8) : **une case
décochée retire sa page, comme aujourd'hui**, et un endroit qui n'a plus aucune
page disparaît.

- **Aujourd'hui** existe quand l'une des huit cases de F1 est cochée
  (`hasTodayPage`, inchangé).
- **Semaine** existe quand l'une des cases Planning, Objectifs et besoins,
  Historique est cochée.
- **Ma ferme** existe toujours : « Réglages » n'a pas de case.

Une ferme qui n'a qu'un endroit ne montre que lui dans la barre, sans « + »
s'il n'a aucun geste (3.4). Une page non cochée garde son comportement
(`pageAccess`, ligne d'avertissement, adresse conservée).

### 3.3 La semaine, avant S4

S4 réunira les trois pages en une. En attendant, **« Semaine » n'a pas de page à
elle** : son entrée de barre ouvre la première page cochée dans l'ordre
Planning, Objectifs et besoins, Historique, avec la saison, la semaine et la
parcelle de la page courante. Sur chacune des trois, une **bande de liens**
(« La semaine ») sous le titre : un lien par page cochée, au nom court qui
existe déjà dans la barre d'aujourd'hui (« Planning », « Besoins »,
« Historique ») ; la page ouverte porte `aria-current="page"`. Moins de deux
pages cochées : pas de bande. Les liens gardent saison, jour et parcelle dans
l'adresse. La bande mesure 44 px au moins ; elle disparaîtra avec S4, qui crée
`/irrigation/semaine` et la prend pour page d'entrée.

### 3.4 « Arrosages » et son entrée

« Arrosages » est dans l'endroit « Aujourd'hui » : on y arrose. Au téléphone elle
n'a plus d'entrée de barre ; on y va par **« Arroser maintenant »** du « + » (3.5)
et par un lien **« Tous les arrosages »** en pied du bloc « Votre journée » de
« Aujourd'hui » (S3 l'ajoute s'il n'y est pas, en une ligne de 44 px ; il garde
l'adresse et la saison courante). C'est la seule page dont le chemin passe par
« Aujourd'hui » plutôt que par la barre ; S5 la refondra.

## 4. La barre du bas et le « + » (téléphone)

**Règles.**

1. **Quatre places, dans cet ordre** : Aujourd'hui, Semaine, **+**, Ma ferme. Une
   place sans objet disparaît et les autres se répartissent la largeur ; le « + »
   reste au centre de ce qui reste.
2. **« Plus » n'existe plus** : la feuille des douze pages, le point vert « page
   ouverte absente de la barre » (F287) et la règle « cinq pages ou moins » (F6)
   disparaissent. Toute page est à **deux touches au plus** : un endroit, puis une
   fiche ou une bande (sauf « Arrosages », 3.4, qui passe par le « + » ou par
   « Aujourd'hui »). Le bilan, honnête : « Planning » reste à une touche (la barre
   ouvre la semaine) ; « Objectifs et besoins », « Historique », « Matériel » et
   les autres restent à deux ; **« Ressources et pompes » passe d'une touche à
   deux** (elle était dans la barre) ; « Arrosages » passe d'une touche à deux.
   C'est le prix du rangement que le porteur a retenu ; la mesure est collée
   dans la PR 2 (section 11).
3. **Le nom accessible** de chaque entrée est le nom de l'endroit. L'endroit
   qui contient la page ouverte porte la marque visuelle de la barre d'aujourd'hui
   (couleur et épaisseur) ; `aria-current="page"` quand la page ouverte est
   l'entrée même de l'endroit (« Aujourd'hui », la page de la semaine ouverte par
   la barre, « Ma ferme »), `aria-current="true"` sur l'endroit quand la page
   ouverte est une autre page de cet endroit. **Ce choix est une précision (S3-e)** :
   lecteur d'écran et marque visuelle disent la même chose.
4. **La pastille de « Aujourd'hui »** (F12) reste sur son entrée, avec la
   même règle de comptage et la même lecture après l'affichage ; elle ne passe sur
   aucun autre endroit.
5. **Le « + » est un bouton**, pas un lien : il ouvre une feuille. Rond, 52 px, au
   centre de la barre ; nom accessible « Arroser ou noter ». Il n'existe que si au
   moins un geste de 4.1 existe.
6. **La barre garde ses mesures** (hauteur, cibles de 44 px, contrastes, 320 px
   sans débord). Les noms tiennent sur une ligne à 320 px : « Aujourd'hui »,
   « Semaine », « Ma ferme ».
7. **Le menu des pages de l'ordinateur et la page introuvable** : `FeatureMenu`
   sert toujours à la page introuvable ; elle garde la même barre.

### 4.1 La feuille du « + » : « Que voulez-vous faire ? »

Une feuille qui monte du bas (écran de la maquette « Le bouton + »), modale :
focus piégé dedans, **Échap** et un geste hors de la feuille la ferment, le focus
revient sur le « + ». Trois gestes, chacun une cible de 72 px au moins ; **aucun
n'écrit rien tant qu'on n'a pas appuyé sur son bouton** (D-028).

| Geste | Texte | Ce qu'il fait | Existe si |
| --- | --- | --- | --- |
| **Arroser maintenant** | « Je choisis où et combien de temps » | ouvre « Arrosages » sur son formulaire « Irriguer maintenant » (demande portée par l'adresse, lue une fois puis retirée, comme `?planifier=1` ; le nom du paramètre est posé en codant) | « Arrosages » cochée |
| **Noter la pluie** | « Ce que dit votre pluviomètre » | monte **dans la feuille** la fenêtre de la PR 4 de S2 (jour, millimètres, bouton qui dit le chiffre, réponse sous le bouton), sans changer de page | « Objectifs et besoins » cochée et ferme pas toute sous abri (la règle de S2, section 7, appelée, jamais recopiée) |
| **Noter un arrosage déjà fait** | « J'ai arrosé sans le module » | ouvre « Arrosages » sur son formulaire « Déjà réalisée » (même mécanisme) | « Arrosages » cochée |

La feuille ne dit jamais que quelque chose est enregistré avant que le serveur
l'ait dit : la réponse de la fenêtre de la pluie est celle de S2. Après un
enregistrement, la page derrière la feuille se relit pour que le plan et les
chiffres montrent la nouvelle pluie. Aucune règle de pluie ne change : la
mesure au pluviomètre, y compris 0 mm, prime et n'est jamais écrasée (S2,
section 7).

## 5. « Ma ferme » : la page en fiches

La page de la maquette « Ma ferme », à son adresse, avec le gabarit des pages (S1 :
un chapeau d'une ligne, titre, « ? », saison).

- **Les fiches**, dans l'ordre de la maquette : Matériel et placement, Ressources et
  pompes, Besoin par culture, Réserve du sol, Alertes météo, Alertes cultures,
  Réglages ; **seules les cases cochées** (Réglages toujours). Chaque fiche : l'icône
  de la page (la table des icônes existe), son nom, **une ligne fixe**, un chevron ;
  cible de 68 px au moins ; le lien garde la saison de la page.
- **Les lignes fixes** sont un tableau du domaine, relues par les tests du
  vocabulaire de S1 (aucun mot du calcul dans une ligne), une ligne à 390 px :

  | Fiche | Ligne |
  | --- | --- |
  | Matériel et placement | Vos goutte-à-goutte et vos aspersions, et où ils sont posés |
  | Ressources et pompes | D'où vient l'eau, les pompes, et s'il y en a assez |
  | Besoin par culture | Ce que chaque culture demande, stade par stade |
  | Réserve du sol | Ce que le sol de chaque parcelle retient |
  | Alertes météo | Gel, chaleur et pluie annoncés |
  | Alertes cultures | Aspersion, séchage, arrêt avant la récolte |
  | Réglages | Météo, messages du téléphone, fonctionnalités |

  Chaque ligne est relue contre le « ? » de sa page au moment du code ; une ligne
  qui la contredit se corrige (précision S3-f).
- **La marque « À faire »** sur une fiche vient de l'accueil de la ferme, que le
  gabarit a déjà : une étape à finir (4.4) a sa page (`UnfinishedStep.page` : le
  sol sur « Réserve du sol », la commune, les jardins à classer, les espèces et
  les réglages du planning sur « Réglages »). La fiche dit « À faire » en orange,
  comme la maquette, avec le texte de l'étape (« sol de 3 parcelles »). **Aucune
  donnée nouvelle n'est lue** : « Ma ferme » ne coûte pas un appel de plus que
  n'importe quelle page. Le bandeau « À finir » reste tel quel.
- **Pas de chiffres d'état** dans les lignes (« 4 goutte-à-goutte, tous posés »,
  « 30 m³ sur 40 »), que la maquette montre : ils demandent des lectures que
  « Ma ferme » n'a pas aujourd'hui, et la lenteur du module (N1 à N3) a été
  payée cher. S6 les ajoute avec la mise en route, qui lit les mêmes données ; S3
  garde la place (précision S3-g, écart voulu avec la maquette, dit au porteur).
- **La phrase de bas de page** de la maquette : « Le module lit le plan de votre
  ferme dans Ouvre ta ferme, sans jamais le modifier. »
- **« Mise en route » (cinq étapes)** : la place est en tête de page, vide en S3 ;
  c'est S6.
- **Son « ? »** (`PAGE_HELP`) dit à quoi sert l'endroit, comme les autres pages.
- **Saison** : la page la montre et la transmet à chaque fiche (elle sert à presque
  toutes), comme « Réglages » quand l'espèce en dépend (`pageUsesSeason`).
- **Accès** : comme « Réglages », toujours ouverte, sauf la première visite, qui
  conduit à l'écran de bienvenue (S6 le réécrira).

### 5.1 Le chemin de retour

Sur toute page de « Ma ferme » **hors « Ma ferme » elle-même**, un bouton « ‹ »
de 44 × 44 px au début de la ligne du titre, nom accessible « Retour à Ma
ferme », mène à la page « Ma ferme » avec la saison. Au téléphone seulement : à
l'ordinateur, le menu de gauche montre déjà l'endroit. Il n'ajoute aucune
hauteur au chapeau. **Si le titre et la saison ne tiennent pas avec lui à
320 px**, le titre passe sur deux lignes ; la borne de P61 de la page est
alors **redite avec sa mesure** (S1, section 9.2), jamais cachée. Une page de
« Semaine » n'a pas de retour : sa bande suffit (3.3).

## 6. Le menu de l'ordinateur

Le menu de gauche remplace les groupes « Arroser, Équiper, Surveiller » par les
trois endroits, **tous dépliés** : à l'ordinateur la place existe, et un clic de
moins pour changer de page est le contraire de ce que cherche S3.

1. En tête, un bouton **« + Arroser ou noter »** : il ouvre la même feuille que
   le téléphone (4.1), en boîte de dialogue au-dessus de la page.
2. **Aujourd'hui** : la page « Aujourd'hui » dans son encart, avec sa pastille
   (F12), puis « Arrosages ».
3. **Semaine** : un titre qui est un lien vers la première page cochée de la
   semaine, puis Planning de la semaine, Objectifs et besoins, Historique et
   cumuls.
4. **Ma ferme** : un titre qui est un lien vers la page « Ma ferme », puis ses
   fiches dans l'ordre de la section 5, **Réglages comprise** (elle n'est plus à
   part en bas).

Un groupe sans page cochée disparaît. Les cases à cocher n'ont aucun autre effet :
une page décochée sort du menu, de la barre et de « Ma ferme ». Ce rangement et
celui de la barre viennent de la même fonction (3.1).

## 7. Adresses et notifications : rien ne se perd

- **Toute adresse d'aujourd'hui s'ouvre**, avec ses paramètres (`season`, `zone`,
  `week`, `refresh`, `absente`, `onglet`) et ses ancres. S3 n'en change aucune ;
  elle en ajoute une, `/irrigation/ma-ferme`.
- **Les anciennes adresses `/irrigation#…`** gardent la conduite de
  `legacyRedirect` et ses règles ; l'application installée garde `start_url`
  `/irrigation` et la page d'arrivée (« Aujourd'hui ») ; le script de la page
  d'arrivée (D-323) est inchangé.
- **Les liens des notifications** (message du matin, rappel du soir, fin
  d'arrosage, alertes), ceux des pages entre elles (« Ouvrir », « Valider au
  planning », « Voir les besoins »…) et ceux du journal des modifications
  mènent aux **mêmes pages**. Le texte des notifications ne change pas.
- **Aucune migration, aucun nouvel appel à la base** : « Ma ferme » et la bande
  n'en lisent aucun de plus (5).
- **Le service worker** des notifications n'est pas touché.

## 8. Les états rares

| Cas | Ce que ça devient |
| --- | --- |
| Ferme qui n'a coché que les alertes | Ma ferme (alertes et Réglages) ; ni « Aujourd'hui » ni « Semaine » ni « + » ; une barre d'une entrée |
| Ferme sans « Arrosages » ni « Objectifs et besoins » | pas de « + » |
| Ferme toute sous abri | « + » sans « Noter la pluie » (la pluie y vaut 0, D-032) |
| Première visite | l'écran de bienvenue, pas de barre (inchangé) |
| Page non cochée demandée par une ancienne adresse | la page d'arrivée et sa ligne (inchangé) |
| Démonstration (fermes fictives, date simulée) | mêmes endroits ; la visite guidée suit (PR 4) ; le « + » écrit dans la base de démonstration comme aujourd'hui |
| Hors ligne ou serveur en erreur au « + » | la feuille dit l'erreur de l'action et laisse la saisie ; rien ne se perd en silence |
| Une page de « Ma ferme » ouverte par notification | la barre marque « Ma ferme », le retour mène à ses fiches |
| Une ferme à trois cents planches | rien à replier : « Ma ferme » et la bande ne listent que des pages |

## 9. Ce que S3 change des contrats validés

| Contrat | Passage | Devient |
| --- | --- | --- |
| `audit-ergonomie-lot2-contract.md`, section 4, F6 | « quatre entrées et « Plus » ; cinq pages ou moins : toutes » | trois endroits et le « + » ; « Plus » retiré |
| id., F12 | la pastille sur « Aujourd'hui » | tient (sur l'entrée « Aujourd'hui ») |
| `audit-ergonomie-final-lot-a-contract.md`, J13, F287 | « Plus » porte la marque de la page ouverte | l'endroit de la page ouverte porte la marque |
| `aujourdhui-tableau-de-bord-contract.md`, section 3.1, T1 | groupes « Arroser, Équiper, Surveiller » ; Réglages à part ; « Aujourd'hui » détaché en tête, son entrée de barre en bouton rond | trois endroits ; Réglages dans « Ma ferme » ; le bouton rond est le « + » |
| `feature-selection-contract.md`, section 5 | la liste des pages et du menu | + « Ma ferme » ; le menu suit les endroits ; les adresses ne changent pas |
| `simplification-s1-contract.md`, sections 3 et 6 | « le regroupement en « Semaine » et « Ma ferme » vient avec S3 : S1 ne déplace aucune page » | S3 le fait |
| `browser-journeys-contract.md` | P0, P28, P29, P30, P41, P59 lisent « Plus de pages », « Pages du module » et le menu d'avant | réécrits dans la PR qui les change ; un parcours nouveau ajouté |
| `demo-guided-contract.md`, visites | l'ancre « menu » et les phrases « le menu ne montre que… » | l'ancre désigne la barre ou le menu ; les phrases suivent les endroits |

**Ne changent pas** : D-028 (rien ne s'écrit sans un appui), D-006, D-032,
D-003, D-010, la règle de la pluie mesurée, celle de la restriction d'eau ; les
cases des fonctionnalités à la carte et leurs dépendances ; l'isolation par
utilisateur, exploitation et saison ; la charte graphique (polices, vert, bleu
de l'eau, cibles de 44 px, contrastes mesurés) ; les pages elles-mêmes (S3 ne
modifie ni leur contenu ni leur titre ; S1, S2, S4, S5 et S6 le font).

## 10. Ce qui ne change pas

- Aucun calcul, aucune règle d'agronomie, aucune donnée, aucune migration, aucune
  action serveur nouvelle : chaque geste du « + » est une action ou un formulaire
  qui existe (ou que S2 crée).
- Aucune fonction retirée, aucune page retirée ; toutes les adresses valent.
- Le nom des pages (« Matériel et placement », « Ressources et pompes »…) : S3 range,
  S6 retouchera les noms avec les cases (précision S3-b).

### Précisions tranchées (option recommandée, modifiables à la relecture)

| N° | Précision | Choix |
| --- | --- | --- |
| S3-a | « Semaine » avant S4 | pas de page à elle ; la barre ouvre la première page cochée ; une bande de liens sur les trois pages ; `/irrigation/semaine` est créée par S4 |
| S3-b | Noms des fiches | les noms des pages, tels quels, plus une ligne ; les noms courts de la maquette (« Eau », « Sol », « Cultures ») attendent S6, qui retouche aussi les cases : deux noms pour une même page, le temps d'un lot, seraient pires |
| S3-c | « Arrosages » | dans l'endroit « Aujourd'hui » ; chemin par le « + » et par « Tous les arrosages » |
| S3-d | Les alertes | « Alertes météo » et « Alertes cultures » dans « Ma ferme » ; l'alerte du jour reste sur « Aujourd'hui » |
| S3-e | `aria-current` | `page` sur l'entrée même de l'endroit, `true` sur l'endroit d'une autre page |
| S3-f | Les lignes des fiches | fixes, relues contre le « ? » de la page ; la marque « À faire » vient de l'accueil de la ferme |
| S3-g | Chiffres d'état des fiches | pas en S3 (aucune lecture de plus) ; S6, avec la mise en route |
| S3-h | Retour « ‹ Ma ferme » | dans la ligne du titre, au téléphone seulement ; pas de retour dans « Semaine » |
| S3-i | Menu de l'ordinateur | les trois groupes dépliés, Réglages dans « Ma ferme » |
| S3-j | Dernier endroit retenu | non : on arrive toujours sur « Aujourd'hui » (page d'arrivée de F1) |
| S3-k | Touches | toute page à deux touches au plus ; « Ressources et pompes » passe d'une à deux ; « Planning » reste à une |
| S3-l | Le « + » de l'ordinateur | un bouton en tête du menu, même feuille en boîte de dialogue |
| S3-m | L'essai des cinq tâches | conseillé avant la mise en ligne de la PR 2, jamais bloquant pour le code |

Aucune de ces précisions n'est agronomique : aucune ne touche une dose, un
seuil, un coefficient, la lecture d'une donnée ou une règle du plan. **Aucune
question n'est réservée au porteur.** Si une question agronomique se pose en
codant, la PR s'arrête, le dit, et le porteur tranche, une question par message.

## 11. Tests et preuves

- **Domaine** (sans navigateur) : chaque page a un endroit et un seul ; pour chaque
  choix de cases valide (parmi les 2 048 parties des onze cases, celles que la
  fermeture des dépendances accepte), les endroits qui existent, la page qu'ouvre
  chaque entrée, les fiches de « Ma ferme », la présence de chaque geste du « + » ;
  la ferme toute sous abri ; la bande de la semaine (zéro, une, deux, trois pages) ;
  `pageAccess`, `pageUsesSeason`, `pageFromPathname` pour `ma-ferme` ; les lignes
  des fiches (une ligne, aucun mot du calcul).
- **Interface** : la barre aux quatre variantes de la section 8 ; le « + » (nom,
  focus piégé, Échap, retour du focus, cible de 72 px) ; la fenêtre de la pluie
  montée dans la feuille ; la bande (`aria-current`, saison gardée) ; le retour ;
  les fiches et la marque « À faire » ; le menu de l'ordinateur à trois groupes.
- **Parcours** (numéro pris en codant), aux deux largeurs : depuis « Aujourd'hui »,
  le « + » puis « Noter la pluie » 8 mm, la réponse, la page relue ; « Arroser
  maintenant » mène au formulaire ; « Noter un arrosage déjà fait » à l'autre ;
  « Semaine » puis les trois pages par la bande, la saison gardée ; « Ma ferme »,
  chaque fiche, le retour ; **chacune des douze pages s'ouvre par son ancienne
  adresse** et marque le bon endroit ; **chaque page est à deux touches au plus**
  de n'importe quelle autre ; la page introuvable garde sa barre ; cibles de 44 px
  et pas de débord à 320 px.
- **Contre-épreuve** (habitude du dépôt) : une page oubliée de la correspondance,
  « Plus » qui reparaît, le « + » montré à une ferme toute sous abri, la bande qui
  perd la saison, le retour absent, une fiche d'une page décochée, une ancienne
  adresse qui ne s'ouvre plus : chaque altération fait échouer un test.
- **Mesures** : à 390 px, hauteur de la barre, position du premier bloc utile de
  chaque page avant et après (bornes de P61 redites si la bande ou le retour les
  déplacent), nombre de touches pour joindre chaque page avant et après, avec
  l'ancienne barre à côté. Collées dans la PR et dans la section 12.
- **Recette** après la mise en ligne de chaque PR, dans le Chrome du porteur, avec
  son accord, en lecture seule : le constat est à l'assistant, le jugement des
  noms et de l'ordre au porteur (D-014). Le « + » s'essaie sur la démonstration
  en ligne, jamais sur la ferme réelle.

## 12. Risques

| Risque | Parade |
| --- | --- |
| On ne retrouve plus une page rangée dans un endroit qu'on n'attendait pas | deux touches au plus ; fiches dont la ligne dit la question ; l'essai des cinq tâches, conseillé ; les noms de pages inchangés |
| « Ressources et pompes » et « Matériel » étaient plus près (barre ou « Plus ») | c'est le prix du rangement, dit (S3-k) ; la mesure des touches est collée |
| Le « + » enregistre une pluie par erreur | la fenêtre de S2 : jour dit, « déjà notée » dit, bouton qui dit le chiffre, jamais un jour futur ; la feuille ne s'ouvre pas sur un champ rempli |
| Un lien de notification ne trouve plus sa page | aucune adresse ne change ; test de chaque adresse et de chaque ancre existantes |
| La bande et le retour déplacent le premier bloc utile (budget de S1) | mesure avant/après ; la borne redite avec sa mesure |
| Le menu et la barre partagent un composant : un changement du téléphone casse l'ordinateur | quatre PR ; la PR 2 ne touche que le téléphone, la PR 3 que l'ordinateur ; les parcours aux deux largeurs |
| La page introuvable perd son menu | même composant, un seul test de rendu pour les deux (contrat du lot 2) |
| Les tests et parcours qui lisent « Plus » ou l'ancien menu | relevé d'abord (sept fichiers de parcours et de tests au moins) ; ils suivent dans la PR qui les change |
| La visite guidée parle d'un menu qui n'existe plus | PR 4 ; la visite saute une étape dont l'élément manque (règle existante) |
| S2 pas fini quand S3 commence | S3 attend la fin du code de S2 (ligne 33) ; le « + » appelle sa fenêtre |
| Le porteur ne reconnaît pas ses habitudes (« Plus ») | le diagnostic le prévoit ; nouveau chemin dit dans la recette ; le « ? » de chaque endroit |

## 13. À remplir par les PR

- Relevé des tests, parcours et liens qui lisent « Plus », « Pages du module » et
  l'ancien menu (PR 1, complété par les PR 2 à 4).
- Mesures avant/après : hauteur de la barre, premier bloc utile par page, touches
  pour joindre chaque page (PR 2).
- Décision de ce lot, précisions F, parcours : numéros pris en codant (PR 1).

**Rempli par la PR 1 (25 novembre 2026).**

- **Numéros.** Décision **D-331** ; précisions **F868 à F875** pour la PR 1
  (S3-f est F871 et F872 ; les autres S3-x prennent leur F avec la PR qui les
  code) ; parcours **P63**, « Les trois endroits ».
- **Relevé de ce qui lit « Plus », « Pages du module » ou l'ancien menu**,
  à suivre dans la PR qui change ce qu'ils lisent :
  - tests : `audit-ergonomie-lot2-telephone` (F6, F12, F17), `aujourdhui-menu`
    (T1), `audit-ergonomie-final-lot-a` (F287), `audit-ergonomie-lot3-gestes`,
    `audit-ergonomie-2026-11-19-lot-k` (F481), `demo-tours`,
    `feature-selection`, `audit-ergonomie-lot2-aujourdhui`,
    `audit-ergonomie-lot1` ;
  - parcours : `e2e/support/parcours.ts` (`ouvrirLeMenuDesPages`,
    `nomsDesPagesDuMenu`), P0, P22, P23, P27, P28, P29, P30, P41, P59, P61 ;
  - visite guidée : `e2e-demo/support/visite.ts`, V1 (l'ancre « menu »), V6
    (« Le menu suit vos cases ») ; les phrases de `lib/domain/demo/tours.ts`
    qui parlent du menu ;
  - liens et textes : le « ? » d'« Aujourd'hui » (« dans le menu »).
  La PR 1 a suivi ceux que « Ma ferme » touche (une page de plus dans le
  menu) : `audit-ergonomie-lot2-telephone`, `aujourdhui-menu`,
  `feature-selection`, `audit-ergonomie-lot2-aujourdhui`, `page-help`,
  P0, P22, P24, P27, P28, P30, P59 et P61 par la liste des titres.
- **Lignes des fiches** (section 5, « une ligne à 390 px ») : les lignes du
  contrat mesurent de 182 à 350 px en Open Sans à 13 px, pour environ 238 px
  de place à 390 px ; la maquette les passe déjà à la ligne. Gardées, sur
  deux lignes au plus au téléphone et une à l'ordinateur (F870), mesurées
  par P63 : à 390 px, deux lignes tiennent sur une (Réserve du sol, Alertes
  météo) et cinq sur deux ; à 1 440 px, les sept sur une. La ligne
  d'« Alertes cultures » est corrigée contre le « ? » de sa page (F871).

## 14. Réglage du code

**Opus 5.5 · Très élevé** pour les quatre PR (ligne 33 de la roadmap, troisième cas
de la grille) : le lot refonde l'organisation de tout le module (barre, menu, page
nouvelle, tous les parcours qui lisent le menu) et son contexte est étendu. Aucune
règle d'agronomie ni d'isolation n'est touchée ; si une PR devait en changer une,
elle s'arrête et le dit.
