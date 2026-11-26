# Contrat — Simplifier l'usage du module, lot S5 : arroser en trois champs (25 novembre 2026)

Roadmap section 6 terdecies, ligne 33 de l'ordre d'exécution. Décision du
chantier : **D-327**. La décision de ce lot est **posée par sa première PR de
code**, au premier numéro libre à ce moment-là ; de même les précisions **F**
(celles de ce contrat sont nommées S5-a, S5-b… et prennent leur F en codant) et
le parcours **P** (premier numéro libre ; P61 est celui de S1, P62 celui de S2).

**À ne pas confondre.** Ce lot refait le **formulaire d'arrosage** de la page
« Arrosages ». Il ne touche **pas** l'écran de bienvenue du contrat 3.8
(`docs/feature-selection-contract.md`) : « trois façons de commencer à la place
des onze cases » (choix n° 3 du porteur) est le lot **S6**. La section 9 le dit
passage par passage ; la 3.8 elle-même reste close.

Logiciel **multi-fermes** : rien ci-dessous ne dépend de la taille ni du
contenu d'une ferme. Les exemples (« Abri des noues », 8 mm, 470 L) viennent de
la ferme de démonstration des maquettes ; les mesures se font sur les données
des parcours, jamais sur la ferme du porteur.

## 1. Origine

Le diagnostic du 25 novembre 2026
(`/mnt/project-files/audit-ergonomie/diagnostic-simplicite-2026-11-25.md`, lot
S5 de la section 5) retient « arroser en trois champs : où, combien, démarrer ;
la pompe, la note et le reste derrière « Plus d'options » », pour **lancer un
arrosage en dix secondes**. Le porteur a retenu les six lots (25 novembre 2026,
12 h 01) et demandé qu'ils s'enchaînent sans nouveau « vas-y » (12 h 03). Les
maquettes (https://claude.ai/artifact/CTM7RxB6X4UgMTHKsaha8F, écrans « AVANT ·
Arrosages » et « APRÈS · Arroser maintenant ») le dessinent.

**Constat dans le code** (`app/irrigation/irrigation-event-manager.tsx`,
`irrigation-manager/*`, sur `main` 4ec161b). La page « Arrosages » ouvre sur un
formulaire à **trois onglets** (« Irriguer maintenant — Calculer puis démarrer
le minuteur », « Planifier », « Déjà réalisée »), puis, pour arroser maintenant :

1. Matériel (liste groupée par jardin) ;
2. Réglage ;
3. une ligne sur la position (« n planches atteintes depuis la position
   enregistrée ») ;
4. Pompe, puis Origine de l'eau, puis une phrase de faisabilité hydraulique ;
5. deux boutons de mode, « Objectif en mm » et « Durée d'irrigation » ;
6. « Quantité souhaitée » en mm (et « Planche de référence » pour un
   asperseur), ou Heures et Minutes ;
7. Note ;
8. à droite (sous, au téléphone) « Résultat calculé » : durée, matériel,
   réglage, intensité, volume, un pli « Apport estimé par planche » ;
9. le bouton « Démarrer l'irrigation ».

Neuf éléments pour un geste que le maraîcher fait comme sur la vanne : *où, et
combien de temps*. Le bouton est le dernier élément, et au téléphone il est tout
en bas. Le premier champ est vers 670 px (diagnostic, section 3 ; S1 a depuis
gagné de la place en tête de page, la mesure de départ est reprise par la PR 1).
Les mots sont ceux du calcul (« Objectif en mm », « Quantité souhaitée »,
« Planche de référence », « Mode de calcul »).

**Ce que S5 fait.** Pour chaque geste de création, un **premier niveau court**
(où, combien, démarrer) et **« Plus d'options »** pour le reste.

**Ce que S5 ne fait pas.**
- Aucun calcul : la durée, l'apport par planche, le volume, la faisabilité
  hydraulique, la dose du jour, l'objectif de la semaine sont les fonctions
  existantes, appelées telles quelles.
- Aucune règle d'écriture : les actions serveur de création (irriguer
  maintenant, planifier, enregistrer une irrigation réalisée), leurs gardes, leurs
  confirmations (conflit de créneau, dépassement de l'objectif, créneau protégé)
  et leurs messages ne changent pas.
- Ni « Aujourd'hui » (S2), ni le menu (S3), ni la semaine (S4), ni la mise en
  route (S6).
- Les **irrigations en cours** et **à venir** de la page (minuteur, terminer,
  mettre en pause, modifier, annuler) : leurs gestes restent ; seuls des mots
  s'alignent (section 6).

**Dépendances.** S5 vient après S3 dans l'ordre (ligne 33 : un seul chantier de
code à la fois ; fichiers communs : la page « Arrosages » et son gabarit). Le
geste « Arroser maintenant » du « + » de S3 (`docs/simplification-s3-contract.md`,
section 4.1) ouvre « Arrosages » sur son formulaire par une demande portée par
l'adresse, **dont le nom est posé par S3 en codant** : S5 **reprend ce
mécanisme tel que S3 l'a fait** et le relève en codant ; si S3 n'est pas fini,
S5 attend. S2 laisse à S5 deux dettes (sections 6.1 et 6.2).

## 2. Livraison en trois PR, une à la fois

| PR | Contenu | Preuve |
| --- | --- | --- |
| 1 · « Arroser maintenant » en trois champs | la fonction du domaine (les durées proposées, la phrase du résultat, la règle du bouton) ; le premier niveau (où, combien de temps, démarrer) ; « Plus d'options » ; les précautions gardées visibles | tests du domaine et de l'interface ; parcours (P1 réécrit, nouveau parcours) ; mesures à 390 px |
| 2 · « Planifier » et « Déjà fait » sur le même squelette | le même « Où ? » et le même « Plus d'options » ; leurs champs de date au premier niveau ; les noms d'onglet ; le mot « C'est fait » sur la page (dette de S2) | tests ; parcours ; mesures |
| 3 · L'entrée et les mots | l'ordre de la page (l'en-cours, le formulaire, l'à-venir) ; la demande portée par l'adresse (« Arroser maintenant », « Déjà fait ») ; les ancres de la visite guidée ; les contrats de la section 9 réécrits | tests ; parcours aux deux largeurs ; recette |

**Chaque PR garde la page entière utilisable.** La PR 1 ne change que l'onglet
« Arroser maintenant » : « Planifier » et « Déjà fait » gardent leur formulaire
d'avant jusqu'à la PR 2. Le composant `irrigation-event-manager.tsx` fait 640
lignes (la limite est 600, lignes vides et commentaires exclus,
`docs/file-splitting-contract.md`) : la PR 1 sépare le formulaire dans son
propre fichier, ce qui est aussi ce qui rend les PR suivantes lisibles.

Chaque PR : `lint`, `typecheck`, `test`, `build`, `knip`, `push:check`,
`weather:check`, `site:check` collés ; `e2e` joué en local sur les parcours
touchés, la suite complète par la CI ; registres à jour dans la même PR
(roadmap : tableau de la section 1, ordre de la section 2, bloc détaillé).
Avant d'écrire, chaque PR relève l'état de départ (contrôles, mesures à
390 px) et le colle dans sa description (consigne 6 du projet).

## 3. Le premier niveau : « Arroser maintenant »

L'onglet s'appelle **« Arroser maintenant »** (le mot du « + » de S3 et de la
maquette), à la place de « Irriguer maintenant » (S5-a). Le titre de la page
reste « Arrosages ». Quand on y arrive par le « + » ou par « Tous les arrosages »,
on voit **le formulaire d'abord** (section 7).

Trois blocs, dans l'ordre de la maquette :

### 3.1 « 1. Où ? »

La liste du **matériel utilisable** (la règle existante, sans changement : actif,
au moins un réglage, une position ; pour « Déjà fait », posé à l'heure de début,
règle 12 de la 2.11). Chaque ligne : une **case ronde** (un seul choix), le nom
du matériel, et dessous « *Type* · *n* planche(s) » (« Goutte-à-goutte · 3
planches ») : le type est celui du matériel, le nombre celui des planches que
la position enregistrée atteint, par la **même fonction** que la ligne
d'aujourd'hui (« n planches atteintes depuis la position enregistrée »), jamais
recopiée. Les lignes restent **groupées par jardin**, comme aujourd'hui
(`equipmentByGarden`) : un titre de jardin, ses lignes dessous.

- **Aucun matériel présélectionné** quand il y en a plusieurs : la règle du lot 3
  de l'audit (point 6, cas 3 : « rien ne se calcule, aucun cadre rouge avant un
  choix ») tient, et D-028 aussi (rien de choisi à la place du maraîcher). La
  maquette dessine un choix fait ; c'est un exemple. **Un seul matériel
  utilisable** : il est choisi d'office, la ligne le dit (S5-b).
- **Plus de six lignes** : la liste devient la **liste déroulante groupée**
  d'aujourd'hui (une ferme de trois cents planches n'a pas à défiler vingt cases
  rondes) ; le premier niveau garde le même sens, un seul champ « Où ? » (S5-c).
- **Le réglage** (`Réglage` d'aujourd'hui) reste au premier niveau **seulement
  quand le matériel choisi en a plusieurs** : une ligne « Réglage : *nom* » sous
  la ligne choisie, qui ouvre la liste. Il change l'intensité, donc la durée :
  ce n'est pas une option. Le réglage de départ est celui de la position
  enregistrée, sinon le premier, **comme aujourd'hui**
  (`useIrrigationPreview`, `selectedSetting`).
- **Le choix d'un matériel** propose la dose du jour pour lui, **comme
  aujourd'hui** (F409) : le jour de l'irrigation, la première du jour,
  sinon rien. Ce qui est déjà tapé n'est remplacé qu'au changement de matériel.

### 3.2 « 2. Combien de temps ? »

Un **réglage de durée comme sur la vanne** : un grand nombre (« 1 h 20 »), un
bouton « − » et un bouton « + » ronds de 52 px (« Cinq minutes de moins », « Cinq
minutes de plus »), et trois pastilles de 44 px.

| Élément | Règle |
| --- | --- |
| Pastilles | « 30 min », « 1 h », et **« Conseillé : *durée* »** quand le jour a une dose pour ce matériel (3.1) : c'est la durée qui apporte cette dose, calculée par le **mode existant « Objectif en mm »**, jamais une règle de plus. Sans dose du jour, **pas de pastille « Conseillé »** et rien n'est dit à sa place. |
| Premier état | avec une dose du jour, « Conseillé » est choisi (le champ de dose d'aujourd'hui était déjà rempli) ; sans dose, **rien n'est choisi** et le nombre dit « — ». Aucune durée n'est inventée (D-028). |
| « + » et « − » | pas de cinq minutes ; sur « — », le premier « + » donne 30 min, « − » est inactif ; plancher 5 min, plafond 744 h (le plafond d'aujourd'hui). Une durée plus fine (une minute) se règle dans « Plus d'options » (3.4). |
| Ce que chaque geste écrit dans le formulaire | « Conseillé » : mode « Objectif en mm » avec la dose, **la valeur enregistrée est exactement celle d'aujourd'hui** (pas d'arrondi à la minute qui change le millimètre). Une pastille fixe, « − » et « + » : mode « Durée d'irrigation », heures et minutes entières. |
| Sous le nombre | **une phrase de résultat**, section 3.3. |

### 3.3 La phrase du résultat

Sous la durée, une phrase, calculée par une fonction du domaine à partir des
chiffres que le formulaire calcule déjà (`previewApplications`,
`previewVolumeLiters`, `previewOrigin`) :

> Soit **8 mm** sur les 3 planches, et **470 L** pris au bassin.

- **Les millimètres.** Une seule valeur (arrondie au dixième) quand toutes les
  planches atteintes reçoivent la même ; sinon « de *a* à *b* mm selon les
  planches », *a* et *b* étant le plus petit et le plus grand apport (un
  asperseur n'arrose pas toutes ses planches pareil). Un apport inconnu pour une
  planche (surface mouillée absente) est dit : « apport inconnu sur *n*
  planche(s) » (D-003 : jamais zéro faute de donnée).
- **Les litres.** Le volume estimé ; « pris au *origine* » **seulement quand
  l'origine de l'eau est connue** (pompe et origine renseignées, ou origine par
  défaut). Volume inconnu : la raison, comme aujourd'hui (« passe-pied non
  renseigné »), jamais « 0 L ».
- **La pompe**, quand une est réglée (par défaut du matériel ou choisie dans
  « Plus d'options ») : « Avec la pompe *nom*. » Un réglage qui s'applique
  sans qu'on le voie est un piège : il est dit.
- **Le détail** d'aujourd'hui, « Apport estimé par planche », reste un pli sous
  la phrase (« Voir planche par planche »), et le pli « d'où vient ce chiffre »
  (`FigureOrigin`) reste à côté de la durée. Les chiffres restent distingués
  par le mot : estimé, jamais « mesuré ».

### 3.4 Le bouton, et les précautions qui ne se cachent pas

**Le bouton** est pleine largeur, 52 px, et **dit ce qu'il fait** :
« Démarrer · fin vers 10 h 50 ». L'heure est l'heure du formulaire plus la durée,
à l'heure de la ferme, relue chaque minute par l'horloge de la page
(`useFarmClock`) ; **« vers »** parce que le minuteur démarre à l'appui, pas à
l'ouverture. Il est inactif (mêmes conditions qu'aujourd'hui : aucun matériel
choisi, durée inconnue ou nulle, aucune planche atteinte) et une ligne dessous
dit **la seule chose qui manque** : « Choisissez où arroser. », puis « Choisissez
une durée. » (S5-d). La réponse du module s'affiche **sous le bouton** (F404) et
le formulaire se vide après une réussite (F406), comme aujourd'hui.

**Ce qui ne passe jamais derrière « Plus d'options »** : ce sont des
précautions, pas des réglages.

| Précaution | Aujourd'hui | Dans S5 |
| --- | --- | --- |
| Créneau protégé qui chevauche | phrase d'avertissement dans le résultat (3.8 ter, règle 12) | la même phrase, au premier niveau, sous la phrase du résultat |
| Débit ou pression dépassés (« exceeded ») | cadre de faisabilité hydraulique | la même phrase d'action, au premier niveau, **seulement** quand la faisabilité est dépassée ; les états « ok » et « inconnu » se lisent dans « Plus d'options » |
| Conflit de créneau, dépassement de l'objectif | fenêtres du module (F407, F410) | inchangées : une fenêtre au moment du bouton |
| Notifications non prêtes | bloc sous le formulaire | inchangé |

**Plus d'options.** Un lien-pli de 44 px, « Plus d'options (pompe, note, saisir en
mm) », `aria-expanded`, fermé par défaut ; il s'ouvre seul si l'on arrive avec
une valeur déjà posée dedans par une autre voie (par exemple la modification
d'une irrigation planifiée, section 5). Il contient, dans cet ordre :

1. **« Saisir en mm »** : bascule la saisie vers « Objectif en mm ». Le champ
   « Combien ? » du premier niveau devient alors un champ de millimètres
   (« Quantité souhaitée », pavé décimal), et la durée devient le résultat
   (« soit 1 h 20 »). Pour un asperseur, la **planche de référence** apparaît
   avec sa phrase (« La durée est calculée pour atteindre l'objectif sur cette
   planche ») ; elle n'a de sens que dans ce mode.
2. **« Durée exacte »** : les champs Heures et Minutes d'aujourd'hui, pour une
   durée que le pas de cinq minutes ne donne pas.
3. **Pompe** et **Origine de l'eau** (si « Ressources et pompes » est coché), et
   les états « ok » et « inconnu » de la faisabilité hydraulique.
4. **Note** (facultative, 500 caractères).

**Rien n'est retiré** : chacun des champs d'aujourd'hui a sa place, au premier
niveau ou dans « Plus d'options » (relevé complet en 9.3).

## 4. « Planifier » et « Déjà fait » (PR 2)

Même squelette, mêmes règles ; seul le deuxième bloc change.

| Onglet | « Où ? » | Deuxième bloc | Bouton |
| --- | --- | --- | --- |
| **Arroser maintenant** | 3.1 | « Combien de temps ? » (3.2) | « Démarrer · fin vers *h* » |
| **Planifier** (nom gardé) | 3.1 ; le matériel posé à la date de début | « Quand ? » (date et heure de début, le champ d'aujourd'hui, proposé une heure plus tard) puis « Combien de temps ? » | « Planifier · le *jour* à *h* » |
| **Déjà fait** (« Déjà réalisée » aujourd'hui, S5-e) | le matériel **posé à l'heure de début** (règle 12) : donc **« De quand à quand ? » vient avant « Où ? »** | « De quand à quand ? » : début réel et fin réelle (les champs d'aujourd'hui) ; pas de « Combien de temps ? », la durée se lit des dates | « Enregistrer cet arrosage » |

- Au changement de la date de début de « Déjà fait », la liste « Où ? » se
  recalcule (règle 12) ; un matériel choisi qui n'était plus posé est désélectionné,
  et la phrase le dit.
- Pour « Déjà fait », la phrase du résultat (3.3) dit **ce que le formulaire
  enregistrera** : la durée tirée des dates, les mm et les litres estimés. Une
  irrigation réelle déjà faite reste toujours enregistrable, même sous
  restriction d'eau ; le dépassement est signalé, jamais bloqué (AGENTS.md).
  L'enregistrement définitif garde sa règle : rien ne s'écrit avant l'appui.
- Les trois onglets restent un `tablist` ; au téléphone, trois onglets de 44 px
  sur une ligne, sans les phrases de description d'aujourd'hui (« Calculer puis
  démarrer le minuteur »… sont des mots du calcul ; S5-e).

## 5. Modifier une irrigation planifiée

« Modifier » d'une carte « à venir » ouvre aujourd'hui le formulaire, rempli,
avec un bandeau « Modification d'une irrigation planifiée ». **Le geste est
inchangé** : il ouvre l'onglet « Planifier » **dans le nouveau squelette**, rempli,
avec le même bandeau ; « Plus d'options » s'ouvre seul quand une valeur y est
posée (pompe, note, mode en mm). L'action serveur, sa garde et ses messages sont
ceux d'aujourd'hui.

## 6. Les mots à aligner et les dettes de S2

Ce qui change de mot, et rien d'autre. Les textes des notifications gardent les
leurs (dette F828 de S1).

| Aujourd'hui | Devient | Où |
| --- | --- | --- |
| « Irriguer maintenant » (onglet) | « Arroser maintenant » | l'onglet, les titres, le « ? » de la page, les tests et parcours |
| « Déjà réalisée » (onglet) | « Déjà fait » | id. ; le bouton « Enregistrer l'irrigation réalisée » devient « Enregistrer cet arrosage » |
| « Démarrer l'irrigation » | « Démarrer · fin vers *h* » | le bouton ; le nom lu par un lecteur d'écran reste complet : « Démarrer l'arrosage de *matériel* » |
| « Planifier l'irrigation » | « Planifier · le *jour* à *h* » | id. |
| « Objectif en mm », « Quantité souhaitée » | « Saisir en mm », « Combien ? » (en mm) | dans « Plus d'options » et le champ |
| « Résultat calculé » | la phrase du résultat | l'encart n'existe plus ; « Apport estimé par planche » reste, sous « Voir planche par planche » |
| « Fait comme prévu » (sur « Arrosages ») | « C'est fait » | **dette de S2, section 6.1** |
| « Planche de référence » | gardé, dans « Plus d'options » | un terme de la ligne d'asperseur |

### 6.1 Dette de S2 : « Fait comme prévu » devient « C'est fait » (PR 3)

S2 (section 10) met « C'est fait » sur la carte d'« Aujourd'hui » et laisse « Fait
comme prévu » sur « Arrosages » (dette : S5). **S5 la solde : le même mot, sur la
page « Arrosages » aussi.** La règle, la fonction `doneAsPlanned`, la
confirmation (heure, volume, « ne se corrige plus », D-006) et les précisions
T15 et T16 de `aujourdhui-tableau-de-bord-contract.md` ne changent pas.

### 6.2 Dette de S2 : « Ajuster » une proposition (S2-d)

S2 laisse à S5 de décider si l'ajustement d'une proposition du plan « remonte »
(un lien vers le formulaire du planning, pas une copie). **Décision : non.**
Ajuster une proposition et créer une irrigation sont deux actions différentes
(la première modifie la proposition du plan et son recalcul, la seconde écrit
une irrigation) : les confondre ferait écrire à un geste ce que l'autre propose.
Le lien « Changer l'heure ou la dose » reste vers le planning ; S5 n'y touche
pas (S5-f).

## 7. L'entrée de la page et son ordre

- **Arriver par un geste du « + »** (S3, section 4.1) : « Arroser maintenant »
  ouvre le formulaire, onglet « Arroser maintenant » ; « Noter un arrosage déjà
  fait », l'onglet « Déjà fait ». Une demande portée par l'adresse, lue une fois
  puis retirée (le mécanisme de `useUrlIntent` ; `?planifier=1` du planning
  continue d'ouvrir « Planifier »). Aucune demande n'écrit quoi que ce soit.
- **Le haut de page de ce geste** : un retour « ‹ Aujourd'hui » de 44 px, le
  titre de l'onglet, puis le premier bloc « 1. Où ? » (l'écran de la maquette).
- **L'ordre des blocs de la page**, avec ou sans demande : les irrigations **en
  cours** d'abord (rien n'est plus pressé qu'un minuteur ouvert), puis le
  formulaire, puis les irrigations **à venir**, puis le résumé et l'eau du jour
  d'aujourd'hui. Sans irrigation en cours, **le bloc « Où ? » commence sous
  400 px à 390 px de large** (budget, mesuré par la PR 1 ; la maquette
  « AVANT » le mettait vers 670 px) ; **avec une irrigation en cours, sous
  700 px** (tenu depuis le 26 novembre 2026, D-337 ; voir section 13).
- **Après « Démarrer »**, la page **reste**, la réponse est sous le bouton, et
  l'irrigation apparaît en cours en tête de page, comme aujourd'hui (F404) ;
  une ligne « Voir l'arrosage en cours sur Aujourd'hui » mène à la carte de
  S2, qui porte « Terminer ». On ne saute pas de page : la réponse du serveur
  se lit où l'on a appuyé (S5-g).

## 8. États rares et cas limites

| Cas | Ce qui se passe |
| --- | --- |
| Aucun matériel utilisable | l'encart d'aujourd'hui (« Aucun matériel prêt à irriguer », « Un matériel doit posséder au moins un réglage et une position sur le plan ») avec le lien vers « Matériel et placement » ; pas de formulaire vide |
| Aucune dose du jour | pas de « Conseillé » ; rien de choisi ; le bouton le dit (3.4) |
| Pompes non cochées | ni pompe ni origine ; la phrase du résultat sans « Avec la pompe » ; aucune faisabilité hydraulique |
| Asperseur | la planche de référence dans « Plus d'options » ; la phrase des millimètres en fourchette quand les planches diffèrent |
| Surface mouillée inconnue | volume « inconnu », raison dite ; l'apport en mm reste affiché s'il se calcule |
| Planification décochée | « Planifier » n'est pas proposé, comme aujourd'hui |
| Restriction d'eau, pénurie | les dépassements sont signalés, jamais bloqués ; l'enregistrement d'une irrigation réelle déjà faite n'est jamais refusé pour cela |
| Une seconde irrigation du même matériel sur un créneau planifié | la fenêtre de confirmation (F407), inchangée |
| Au-delà de l'objectif de la semaine | la fenêtre d'avertissement (F410), inchangée |
| Notifications non prêtes | le bloc d'aujourd'hui, inchangé |
| Plusieurs fermes, plusieurs saisons | chaque formulaire lit la ferme et la saison de la page ; la liste « Où ? » ne montre que le matériel de la ferme et de la saison courantes |

## 9. Ce que S5 change des contrats validés

S5 ne change **aucune règle** : ses changements sont des présentations et des
mots. La roadmap le dit « non » pour la colonne « touche un contrat validé » ; les
contrats ci-dessous **citent des mots ou une mise en page** que les PR de code
réécrivent dans la leur.

### 9.1 Passages modifiés

| Contrat | Passage | Devient |
| --- | --- | --- |
| `audit-ergonomie-2026-11-19-lot-g-contract.md`, n° 1 (F404), n° 3 (F406), n° 4 (F407), n° 9 (F409, F410) | « formulaire « Irriguer maintenant », « Planifier », « Déjà réalisée » » ; « Démarrer quand même » pour « Irriguer maintenant » | les **règles tiennent** (réponse sous le bouton, formulaire vidé après une réussite, confirmation du second créneau, dose du jour, dépassement) ; les **noms** deviennent « Arroser maintenant », « Planifier », « Déjà fait » ; le bouton de la fenêtre de conflit devient « Démarrer quand même » (inchangé), le geste qui la déclenche dit « Démarrer » |
| id., F409 (la dose du jour) | « le champ de quantité prend la dose » | la dose du jour est **préchoisie en pastille « Conseillé »**, même valeur enregistrée ; sans dose, aucune durée n'est choisie (3.2) |
| `audit-ergonomie-lot3-contract.md`, point 6 (cas 3 et 4) | aucun matériel présélectionné ; la faisabilité en phrase d'action | tient ; un matériel unique est présélectionné (S5-b) ; la phrase d'action reste visible quand elle dit « dépassé » (3.4) |
| `equipment-placement-periods-contract.md`, règles 11 et 12 | « Irriguer maintenant et planifier ne listent que le matériel posé » ; la saisie après coup | **inchangées** ; seul le mot de l'onglet change ; « De quand à quand ? » vient avant « Où ? » pour « Déjà fait » (4) |
| `aujourdhui-tableau-de-bord-contract.md`, T15 et T16 | « Fait comme prévu » sur « Arrosages » | « C'est fait » (6.1) ; règle, confirmation et fonction inchangées |
| `simplification-s2-contract.md`, sections 10 et 13 | « Arrosages garde « Fait comme prévu » (dette : S5) » ; « S5 décidera s'il remonte » | soldées (6.1 et 6.2) |
| `simplification-s3-contract.md`, sections 3.4 et 4.1 | « S5 la refondra » ; le geste « Arroser maintenant » ouvre « Irriguer maintenant » | l'onglet s'appelle « Arroser maintenant » ; le geste « Noter un arrosage déjà fait » ouvre « Déjà fait » ; le mécanisme de la demande est celui de S3 |
| `browser-journeys-contract.md` | P1, P11, P24, P37, P38, P40 lisent « Irriguer maintenant », « Démarrer l'irrigation », « Résultat calculé », « Objectif en mm » | réécrits avec les nouveaux mots dans la PR qui les change ; un parcours nouveau ajouté |
| `charte-module.md`, ligne des trois onglets (« Irriguer maintenant / Planifier / … ») | les trois onglets au téléphone | les noms de la section 6 |
| `recette-2.11.md`, R8 | « Irriguer maintenant » et « Planifier » | le mot de l'onglet |
| `demo-guided-contract.md` et `lib/domain/demo/tours.ts` | les ancres `arrosage-actions`, `arrosage-champs`, `arrosage-resultat` et leurs phrases | les ancres suivent les trois blocs (« Où ? », « Combien de temps ? », le bouton) ; les phrases de la visite les nomment |

### 9.2 Ce qui ne change pas

- **D-028** : rien ne s'arrose, ne démarre et ne s'enregistre sans un appui.
  Aucune durée n'est choisie à la place du maraîcher quand il n'y a pas de dose du
  jour ; la pastille « Conseillé » est un choix de départ que l'on voit et
  qu'on peut changer avant d'appuyer.
- **D-006** (l'historique est immuable), **D-003** (une donnée inconnue reste
  inconnue), **D-010**, **D-032**, la règle de la pluie mesurée, celle de la
  restriction d'eau, celle des créneaux protégés.
- Les **actions serveur** de création, de démarrage, de fin, de modification, de
  pause, d'annulation ; leurs gardes et leurs messages.
- Les **calculs** : la durée à partir d'une quantité ou d'une durée, l'apport par
  planche, la surface mouillée, le volume, la faisabilité hydraulique, la dose du
  jour, le dépassement de l'objectif.
- L'**isolation** par utilisateur, exploitation et saison ; la saison de la page.
- Les cases des fonctionnalités à la carte et leurs dépendances ; la charte
  graphique (polices, vert, bleu de l'eau, cibles de 44 px, contrastes mesurés) ;
  S1 (chapeau d'une ligne, mots du tableau).
- **L'écran de bienvenue et le contrat 3.8** (S6) ; le menu (S3) ; « Aujourd'hui »
  (S2) ; la semaine (S4).

### 9.3 Où va chaque champ d'aujourd'hui

À relever en code et à coller dans la PR 1 ; ce contrat fixe la destination.

| Champ ou élément d'aujourd'hui | Destination |
| --- | --- |
| Les trois onglets | trois onglets, mots de la section 6, sans phrase de description (au téléphone) |
| Matériel | « 1. Où ? » |
| Réglage | « Où ? », sous la ligne choisie, **quand il y en a plusieurs** |
| Ligne « n planches atteintes depuis la position » | dans chaque ligne de « Où ? » (« · n planches ») |
| Pompe, Origine de l'eau | « Plus d'options » ; la pompe dite dans la phrase du résultat |
| Indicateur hydraulique | premier niveau si « dépassé » ; « Plus d'options » sinon |
| Boutons « Objectif en mm » / « Durée d'irrigation » | « Saisir en mm » / « Durée exacte » dans « Plus d'options » ; le premier niveau règle une durée |
| Quantité souhaitée, Planche de référence | « Combien ? » en mm, et la planche, dans « Plus d'options » |
| Heures, Minutes | « Combien de temps ? » (nombre, « − », « + », pastilles) ; la saisie exacte dans « Plus d'options » |
| Date et heure de début (Planifier) | « Quand ? », premier niveau |
| Début réel, Fin réelle (Déjà fait) | « De quand à quand ? », premier niveau |
| Note | « Plus d'options » |
| « Résultat calculé » : durée, matériel, réglage, intensité, étendue, volume | la durée au premier niveau ; la phrase du résultat ; matériel et réglage sont les lignes choisies ; l'**intensité** (mm/h) et l'étendue passent dans « Voir planche par planche » |
| « Apport estimé par planche » | « Voir planche par planche », pli sous la phrase |
| Avertissement de créneau protégé | premier niveau, sous la phrase |
| Réponse du module | sous le bouton (F404) |
| « Le minuteur retrouvera son état après une actualisation » | gardé, sous le bouton (promesse de l'écran, vérifiée par P1) |

## 10. Précisions tranchées (option recommandée, modifiables à la relecture)

| N° | Précision | Choix |
| --- | --- | --- |
| S5-a | Le nom de l'onglet | « Arroser maintenant », le mot du « + » et de la maquette, à la place de « Irriguer maintenant » |
| S5-b | Un seul matériel utilisable | présélectionné et dit ; avec plusieurs, rien de choisi (règle du lot 3 de l'audit) |
| S5-c | Beaucoup de matériel | au-delà de six lignes, la liste déroulante groupée d'aujourd'hui, au même endroit |
| S5-d | Bouton inactif | la ligne dessous dit la seule chose qui manque, dans l'ordre : où, puis combien de temps |
| S5-e | « Déjà réalisée » | « Déjà fait », le mot du « + » (« Noter un arrosage déjà fait ») ; les phrases de description des onglets sont retirées au téléphone |
| S5-f | « Ajuster une proposition » (S2-d) | ne remonte pas : deux actions différentes ; le lien vers le planning reste |
| S5-g | Après « Démarrer » | la page reste, la réponse est sous le bouton, un lien mène à la carte d'« Aujourd'hui » ; pas de saut de page |
| S5-h | Les pastilles de durée | « 30 min », « 1 h » et « Conseillé » ; pas de cinq minutes ; plancher 5 min (la minute exacte dans « Plus d'options ») ; une autre série ne change que ce contrat |
| S5-i | Le premier « + » sans durée | donne 30 min |
| S5-j | « fin vers *h* » sur le bouton | l'heure du formulaire plus la durée, à l'heure de la ferme, « vers » parce que le minuteur démarre à l'appui |
| S5-k | La pompe réglée par défaut | dite dans la phrase du résultat (« Avec la pompe… ») : un réglage qui s'applique ne se cache pas |
| S5-l | Les millimètres d'un asperseur | une fourchette « de *a* à *b* mm selon les planches » quand elles diffèrent |
| S5-m | L'ordre de la page | en cours, formulaire, à venir, résumé ; budget de hauteur de la section 7 |

**Aucune de ces précisions n'est agronomique** : aucune ne touche une dose, un
seuil, un coefficient, la lecture d'une donnée ou une règle du plan. Les
durées proposées (30 min, 1 h, cinq minutes) sont un geste de saisie, pas une
recommandation d'arrosage ; la seule recommandation affichée est « Conseillé »,
qui est la dose du jour que le plan propose déjà. Si une question agronomique se
pose en codant (par exemple une dose du jour qui contredit l'objectif), la PR
s'arrête, le dit, et le porteur tranche, une question par message.

## 11. Tests et preuves

- **Domaine** (nouveau fichier de `lib/domain/`) : la liste des durées (pastilles,
  « Conseillé » présent ou absent selon la dose, pas de cinq minutes, plancher,
  plafond, premier « + ») ; la phrase du résultat (une valeur ou une fourchette,
  apport inconnu, volume inconnu, origine connue ou non, pompe dite) ; la règle
  du bouton (libellé avec l'heure de fin, la ligne qui dit ce qui manque, dans
  l'ordre) ; l'heure de fin à l'heure de la ferme, autour de minuit et d'un
  changement d'heure ; la règle de ce qui reste au premier niveau
  (précautions) et de ce qui va dans « Plus d'options ».
- **Interface** : chaque champ d'aujourd'hui retrouvé (tableau 9.3, un test par
  ligne), la liste « Où ? » (cases rondes, liste groupée au-delà de six, un seul
  matériel présélectionné, le nombre de planches par ligne), le réglage visible
  seulement avec plusieurs réglages, « Plus d'options » (clavier, `aria-expanded`,
  ouverture seule quand une valeur y est), le stepper (pas, plancher, plafond,
  noms lus), l'enregistrement exact de « Conseillé » (la même valeur qu'avant),
  le bouton inactif et sa ligne, la réponse sous le bouton, le formulaire vidé après
  une réussite, les trois onglets, la modification d'une irrigation planifiée,
  « De quand à quand ? » avant « Où ? », les cases décochées (pompes, planification).
- **Parcours**, à 390 et 1440 px, sur une ferme propre au parcours (jamais la
  ferme réelle sans le « vas-y » du porteur et la remise en l'état) : **P1
  réécrit** (créer, démarrer, retrouver le minuteur après rechargement, terminer) ;
  **un parcours nouveau** : arroser maintenant en trois gestes (choisir où,
  « + » sur la durée, démarrer), avec la **mesure** de la position du premier
  bloc et du nombre de touches, planifier, noter un arrosage déjà fait, « Saisir en
  mm » sur un asperseur, une pompe dépassée dite au premier niveau, un créneau
  protégé dit sous la phrase ; P11, P24, P37, P38 et P40 suivent les mots.
- **Contre-épreuve** (habitude du dépôt) : des altérations de « Conseillé » (une
  durée arrondie qui change le millimètre), de la fourchette des millimètres, de
  la présence de « Avec la pompe », du premier niveau des précautions (une
  précaution qui passe derrière le pli) et de l'heure de fin font chacune
  échouer un test.
- **Recette** après la mise en ligne de chaque PR, dans le Chrome du porteur, avec
  son accord : le constat est à l'assistant, le jugement des mots et du geste au
  porteur (D-014). **Rien ne s'écrit sur la ferme réelle sans son « vas-y »
  exprès** (AGENTS.md, ferme réelle) ; sur la démonstration, on peut tout jouer.
  L'essai de la tâche « lancez cet arrosage » avec le premier volontaire du
  pilote (diagnostic, section 6) dépend du porteur et **ne bloque pas le code**.

## 12. Risques

| Risque | Parade |
| --- | --- |
| Une précaution (pompe dépassée, créneau protégé) passe derrière « Plus d'options » | la table de la section 3.4 ; un test et une contre-épreuve par précaution |
| La durée « Conseillé » arrondie à la minute change le millimètre enregistré | « Conseillé » garde le mode « Objectif en mm » avec la dose exacte ; test de la valeur écrite |
| Une pompe par défaut s'applique sans qu'on la voie | dite dans la phrase du résultat (S5-k) |
| Le stepper donne une durée aberrante (zéro, des jours) | plancher 5 min, plafond 744 h, mêmes bornes que la validation serveur ; le serveur garde ses gardes |
| Un tableau des champs oublie un champ (la note, la planche de référence) | le relevé 9.3, un test par ligne, le parcours de l'asperseur |
| Beaucoup de matériel : vingt cases rondes | liste déroulante au-delà de six lignes (S5-c) |
| Les parcours qui lisent un mot changent | relevé d'abord (P1, P11, P24, P37, P38, P40, la visite guidée) ; ils suivent dans la PR qui change le mot |
| S3 pas fini quand S5 commence | S5 attend la fin du code de S3 (ligne 33) ; la demande portée par l'adresse est celle que S3 a posée |
| Deux vocabulaires (écran « C'est fait », notification « Fait comme prévu ») | dette notée avec F828 de S1, traitée après S6 |
| « Voir l'arrosage en cours sur Aujourd'hui » mène à une carte qui change de forme | le lien va à la page, sans ancre fragile ; le texte ne promet pas de carte précise |

## 13. À remplir par les PR

- Relevé des champs d'aujourd'hui et de leur destination (PR 1, tableau 9.3
  complété), et des tests, parcours et visites qui lisent un mot de la section 6.
- Mesures avant/après : position du premier bloc « Où ? », nombre de touches pour
  démarrer un arrosage (aucun matériel choisi → arrosage en cours), hauteur de
  l'onglet, à 390 px (PR 1) ; id. pour « Planifier » et « Déjà fait » (PR 2).
- Décision de ce lot, précisions F, parcours : numéros pris en codant (PR 1).
- Le nom de la demande portée par l'adresse, tel que S3 l'a posé (PR 3).

### 13.1 Relevé de la PR 1

**Où est allé chaque champ de « Irriguer maintenant »** (tableau 9.3 ; la PR 1
ne refait que cet onglet, « Planifier » et « Déjà réalisée » gardent leur
formulaire jusqu'à la PR 2) :

| Champ d'avant | Dans la PR 1 |
| --- | --- |
| Onglet « Irriguer maintenant » | « Arroser maintenant » ; la phrase de description reste aux trois onglets jusqu'à la PR 2 (onglets d'une ligne) |
| Matériel (liste déroulante) | « 1. Où ? » : cases rondes groupées par jardin jusqu'à 6, liste « Où arroser ? » au-delà (S5-c) ; un seul matériel prêt est choisi d'office et la ligne le dit (S5-b) |
| Réglage | sous « Où ? », seulement quand le matériel en a plusieurs |
| « n planches atteintes depuis la position » | le détail de chaque ligne : « Goutte-à-goutte · 3 planches » |
| Pompe, Origine de l'eau | « Plus d'options » ; la pompe dite dans la phrase du résultat |
| Indicateur hydraulique | premier niveau s'il est dépassé, « Plus d'options » sinon |
| « Objectif en mm » / « Durée d'irrigation » | « Saisir en mm » (case de « Plus d'options ») ; « Durée exacte » (Heures, Minutes) dans « Plus d'options » ; le premier niveau règle une durée |
| Quantité souhaitée | « Quantité souhaitée » au premier niveau quand « Saisir en mm » est coché, suivie de « soit 30 min » |
| Planche de référence | « Plus d'options », pour un asperseur |
| Heures, Minutes | « 2. Combien de temps ? » : « − », la durée, « + », pastilles « 30 min », « 1 h », « Conseillé : … » s'il y a une dose du jour |
| Note | « Plus d'options » |
| « Résultat calculé » | la phrase « Soit 8 mm sur les 3 planches, et 470 L pris à « Bassin ». » ; intensité, étendue et « Apport estimé par planche » sous « Voir planche par planche » |
| Créneau protégé | premier niveau, sous la phrase |
| « Démarrer l'irrigation » | « Démarrer · fin vers 11 h 50 », lu « Démarrer l'arrosage de *matériel*, fin vers 11 h 50 » ; ce qui manque est dit dessous (« Choisissez où arroser. », « Choisissez une durée. ») |
| Réponse du module, promesse du minuteur | sous le bouton, inchangées |

**Ce qui lisait un mot de la section 6** et suit dans la PR 1 : P1, P11, P24,
P37, P38, P40, P63 (nom de l'onglet, nouveau formulaire) ;
`lib/domain/features/help.ts`, `lib/domain/features/catalogue.ts`,
`lib/domain/demo/tours.ts` (« Arroser maintenant ») ; les aides des parcours
(`e2e/support/materiel.ts`). **Restent pour la PR 2** : « Déjà réalisée » (onglet,
Historique, P2, P3, P4, P9, P11, P63) et le libellé de l'Historique
`irrigationModeLabel` (« Irriguer maintenant », « Déjà réalisée »), qui changeront
ensemble ; « Résultat calculé » de « Planifier » et « Déjà réalisée »
(`irrigation-form.tsx`, test du lot J, P37) ; « Planifier l'irrigation ».
**PR 3** : « Fait comme prévu » (P31, tests du lot 3, de S2 et des liens).

**Mesures, même ferme neuve, même script, deux matériels posés** (la base
e027002 contre la PR 1, Chromium, projets « ordinateur » et « telephone » à
390 px) :

| | Avant | PR 1 |
| --- | --- | --- |
| Haut du premier bloc (« Matériel », puis « 1. Où ? »), ordinateur | 437 px | 437 px |
| id., téléphone | 603 px | 603 px |
| Hauteur des onglets, téléphone | 206 px | 206 px |
| Gestes d'« aucun matériel choisi » à « arrosage en cours », sans dose du jour | 3, dont une liste déroulante (2 touches au téléphone) et le passage en « Durée d'irrigation » | 3 touches : la case ronde, « + » (30 min), « Démarrer · fin vers … » |

Le premier bloc n'a **pas encore remonté** : ce qui le précède (onglets de trois
lignes, compteurs, bandeau « À finir ») est le travail des PR 2 et 3 ; le
budget de la section 7 (sous 400 px au téléphone) y sera vérifié. P64 relève
aussi ces hauteurs en annotation, dans son propre état de ferme.

**Numéros pris** : D-332 ; F894 à F901 ; parcours P64.

### 13.2 Relevé de la PR 2

**Où sont allés les champs de « Planifier » et « Déjà réalisée »** : ceux
de la PR 1 (tableau 13.1) pour « Où ? », « Combien de temps ? » et « Plus
d'options » ; « Date et heure de début » dans « 2. Quand ? » ; « Début
réel » et « Fin réelle » dans « 1. De quand à quand ? », la durée lue
dessous (« soit 30 min ») ; « Planifier l'irrigation » devient « Planifier ·
demain à 6 h », « Enregistrer l'irrigation réalisée » devient « Enregistrer
cet arrosage ». Pour « Déjà fait », « Plus d'options » ne range que la
pompe et la note. L'ancien formulaire, l'encart « Résultat calculé » et sa
règle d'attente (lot J, F462) sont retirés.

**Ce qui lisait un mot de la section 6** et suit dans la PR 2 : P2, P3, P4,
P9, P11, P26, P30, P31, P37, P38, P57, P62, P63 ; le test du lot J
(`tests/audit-ergonomie-2026-11-19-lot-j.test.ts`), celui de l'Historique ;
`help.ts`, `tours.ts`, `plus-sheet.ts`, `items.ts` (l'Historique et la
colonne « Mode » de l'export disent « Arroser maintenant » et « Déjà
fait »). **Reste pour la PR 3** : « Fait comme prévu » (P31, tests du lot 3,
de S2 et des liens).

**Mesures, même ferme neuve, même script, deux matériels posés** (la base
e027002 contre la PR 2) :

| | Avant | PR 2 |
| --- | --- | --- |
| Hauteur des onglets, téléphone 390 px | 206 px | 54 px |
| id., ordinateur | 72 px | 72 px |
| Haut du premier bloc des trois onglets, téléphone | 603 px (« Matériel ») | 451 px (« 1. Où ? » ; « 1. De quand à quand ? » pour « Déjà fait ») |
| id., ordinateur | 437 px | 457 px |
| « Planifier » d'un matériel neuf, sans dose du jour, d'aucun matériel choisi à « planifié » | une liste déroulante (2 touches au téléphone), « Durée d'irrigation », la date, « Planifier l'irrigation » | la case ronde (ou rien, s'il est seul), la date, « + », « Planifier · … » |

Le premier bloc remonte de 152 px au téléphone, pas encore sous 400 px :
le bandeau, les compteurs et l'ordre de la page sont le travail de la PR 3.
À l'ordinateur, le titre du bloc et la marge du formulaire le descendent de
20 px, sans changer ce qui se voit sans défiler.

**Numéros pris** : D-333 ; F902 à F907 ; parcours P65.

### 13.3 Relevé de la PR 3

**L'entrée.** La demande du « + » porte le nom que S3 a posé :
`?arroser=maintenant` et `?arroser=fait` (`WATERING_INTENT` et
`WATERING_INTENT_VALUES`, `lib/domain/features/plus-sheet.ts`), lue une fois
puis retirée par `useUrlIntent` ; `?planifier=1` du planning ouvre toujours
« Planifier », sans retour. S5 n'y ajoute que le retour « ‹ Aujourd'hui »
(F911) et le lien après « Démarrer » (F912).

**L'ordre de la page** : le titre « Arroser ou noter », les irrigations en
cours, le formulaire, les alertes du téléphone (tous leurs états, F908), les
irrigations à venir, le résumé des compteurs. **Mots** : « C'est fait » sur
« Arrosages » (F913), la visite guidée en trois blocs (F914), les contrats
de la section 9.1 (F915).

**Mesures, même ferme neuve, même script, deux matériels posés, sans
irrigation en cours** (la base e027002 contre les PR 1 à 3) :

| | Avant | PR 1 | PR 2 | PR 3 |
| --- | --- | --- | --- | --- |
| Haut du premier bloc, téléphone 390 px | 603 px | 603 px | 451 px | **298 px** |
| id., ordinateur | 437 px | 437 px | 457 px | 374 px |
| Hauteur des onglets, téléphone | 206 px | 206 px | 54 px | 54 px |

**Budget de la section 7**, mesuré par P64 au téléphone dans son propre état
(« Recevoir les alertes » à l'écran, noms longs du parcours) : sans
irrigation en cours, « 1. Où ? » sous 400 px, **tenu** (469 px avec les
alertes en tête, avant F908) ; avec une irrigation en cours, **800 px, non
tenu** (1 011 px avant F909, budget 700 px) : la carte en cours, raccourcie
au téléphone sans rien retirer, mesure encore environ 430 px. La raccourcir
davantage retirerait une information du premier niveau, ce que la section 1
exclut ; dette dite dans D-334 (F910), P64 borne à 820 px.

**Budget tenu, 26 novembre 2026** (D-337, F983, F984), sur le choix du
porteur de reprendre F910 : au téléphone, la carte en cours se range plus
serré sans rien retirer (le nom à gauche du minuteur, l'état à droite du
réglage, des marges plus courtes, le bloc « Irrigations en cours » sans
cadre bleu), et « Fin estimée » dit l'heure seule le jour même, comme la
carte d'« Aujourd'hui ». Avec une irrigation en cours, « 1. Où ? » à
**653 px** dans P64 (800 px avant), **sous 700 px, tenu** ; P64 borne à
700 px. Sans irrigation en cours, 298 px, inchangé. La phrase ci-dessus
sur ce qu'il faudrait retirer ne vaut plus : la mise en page a suffi.

**Numéros pris** : D-334 ; F908 à F915 ; aucun parcours nouveau (P31, P61,
P63 et P64 suivent).

## 14. Réglage du code

**Opus 5.5 · Élevé** pour les trois PR (ligne 33 de la roadmap, quatrième cas de
la grille, comme S1 et S2) : écran sous contrat écrit, qui appelle des calculs et
des actions existants sans les changer ; les tests et la CI jugent. Si une PR
doit **changer** un calcul ou une règle d'écriture (ce que ce contrat exclut), elle
s'arrête, le dit, et passe en Très élevé après le mot du porteur.
