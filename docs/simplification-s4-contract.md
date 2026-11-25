# Contrat — Simplifier l'usage du module, lot S4 : la semaine sur une page (25 novembre 2026)

Roadmap section 6 terdecies, ligne 33 de l'ordre d'exécution. Décision du
chantier : **D-327**. La décision de ce lot est **posée par sa première PR de
code**, au premier numéro libre à ce moment-là ; de même les précisions **F**
(celles de ce contrat sont nommées S4-a, S4-b… et prennent leur F en codant) et
le parcours **P** (premier numéro libre : P61 est celui de S1, P62 celui de S2,
S3 et S5 prennent les leurs).

Ce contrat **change** ceux des trois pages de la semaine : le planning
(`docs/planning-contract.md`, « Interface (3.6) »), les besoins
(`docs/irrigation-needs-contract.md`) et l'historique (qui n'a pas de contrat à
lui : ses règles sont dans la roadmap 2.9, `docs/series-contract.md` pour le
suivi par série, D-036 et D-329 pour l'objectif), ainsi que la bande de la semaine de S3
(`docs/simplification-s3-contract.md`, section 3.3). La section 10 dit, passage
par passage, ce qui change ; les PR de code le réécrivent dans les leurs. Choix
n° 1 du porteur, 25 novembre 2026, 11 h 59 : « Oui, trois endroits » ; lot S4
retenu à 12 h 01.

Logiciel **multi-fermes** : rien ci-dessous ne dépend de la taille ni du
contenu d'une ferme. Les exemples (« Abri des noues », 12 mm sur 23, quatre
jardins) viennent de la ferme de démonstration des maquettes ; les mesures se
font sur les données des parcours, jamais sur la ferme du porteur. Une ferme de
trois cents planches et une de dix ont la même page : ce sont les listes à
l'intérieur qui se replient par jardin.

## 1. Origine

Le diagnostic du 25 novembre 2026
(`/mnt/project-files/audit-ergonomie/diagnostic-simplicite-2026-11-25.md`,
causes 1, 2 et 7, idées 1 et 2) constate que **trois pages parlent de la même
semaine sous trois angles** : « Planning de la semaine » (les créneaux),
« Objectifs et besoins » (les millimètres), « Historique et cumuls » (ce qui a
été fait). « Il faut savoir laquelle ouvrir » : la question du maraîcher est
« est-ce que ma semaine est bonne ? », pas « quel écran de calcul consulter ? ».

Mesuré sur la ferme réelle du porteur, le 25 novembre 2026 à 11 h 55, en
lecture seule, à 390 px (diagnostic, section 3 bis) :

| Page | Hauteur | Mots | Chiffres avec unité | Choses à toucher |
| --- | --- | --- | --- | --- |
| Planning de la semaine | 3 756 px | 607 | 19 | 29 |
| Objectifs et besoins | 3 434 px | 462 | 35 | 45 |
| Historique et cumuls | 2 091 px | 239 | 11 | 30 |
| **Les trois** | **9 281 px** | **1 308** | **65** | **104** |

Les maquettes (https://claude.ai/artifact/CTM7RxB6X4UgMTHKsaha8F, écran
« Semaine ») répondent par **une page** : la semaine qu'on regarde, une phrase,
une barre et trois chiffres, « Jour par jour » avec un bouton « Valider » sur
chaque créneau, « Jardin par jardin » en barres, et en pied « Le détail du
calcul » et « Exporter ». Les flèches changent de semaine ; les semaines passées
se lisent par les flèches (diagnostic, section 4).

**Ce que S4 fait.** Créer la page « Semaine » à son adresse, `/irrigation/semaine`,
y mettre **tout** le contenu des trois pages, **deux niveaux** : l'essentiel au
premier (une phrase, trois chiffres, les jours, les jardins), le reste derrière
« Le détail ». Remplacer la bande de liens de S3 (section 3.3 du contrat de S3,
« la bande disparaîtra avec S4 ») par cette page.

**Ce que S4 ne fait pas.** Aucun calcul (le plan, le besoin, l'objectif, l'écart,
les cumuls sont ceux d'aujourd'hui) ; aucune règle d'agronomie ; aucune
migration ; aucune fonction retirée. Ni « Aujourd'hui » (S2), ni le menu (S3),
ni le formulaire d'arrosage (S5), ni la mise en route (S6). **Les réglages ne
changent pas de place** : ceux du planning et les heures protégées restent sur
la page de la semaine, dans un pli (précision S4-n) ; ranger les réglages « à
quatre endroits » (cause 4) est un autre chantier.

**Dépendances.** S4 attend la fin du code de S3 (ligne 33 : un seul chantier de
code à la fois, et S3 pose la correspondance page → endroit, la barre et la
bande que S4 remplace) et de S5 (ordre S1, S2, S3, S5, S4, S6). Elle s'appuie sur
trois choses des lots d'avant : **la fonction unique de l'objectif de la ferme**
(S1, PR 3 et 3 bis, `lib/domain/farm-objective.ts`), **la fenêtre « Noter la
pluie »** (S2, PR 4, section 7 de son contrat) et **la barre « La semaine »**
d'« Aujourd'hui » (S2, PR 5). Si l'une manque quand une PR de S4 en a besoin, la
PR attend ; elle ne la refait pas.

## 2. Livraison en quatre PR, une à la fois

AGENTS.md interdit de mêler un refactor et une fonctionnalité : la PR 1 **range**
(une page, rien de nouveau à lire), la PR 2 **ajoute** le premier niveau, la PR 3
ajoute les gestes de la page, la PR 4 rebranche tout ce qui menait aux anciennes
pages.

| PR | Contenu | Preuve |
| --- | --- | --- |
| 1 · Une page, deux vues | la page `semaine` (adresse, accès, saison, `week`, `zone`) ; la vue « La semaine » reprend, dans l'ordre d'aujourd'hui et sans rien changer, les blocs du planning et des besoins, la vue « Les cumuls » ceux de l'historique ; les trois anciennes adresses mènent à la page, paramètres et ancre gardés ; la barre, le menu et la bande de S3 y mènent ; les lectures lourdes se font à la demande | tests du domaine (cases, vues) et de l'interface ; relevé des ancres ; parcours ; mesure du temps du serveur |
| 2 · Le premier niveau | la ligne des flèches, la phrase, la carte du bilan, « Jour par jour », « Jardin par jardin » ; les blocs d'aujourd'hui passent derrière « Le détail » | tests du domaine (phrase, jours, jardins) ; mesures de hauteur à 390 px ; parcours |
| 3 · Les gestes | « Comprendre ces chiffres », « Changer l'eau visée », « Noter la pluie » (la fenêtre de S2), les semaines passées et à venir, « Exporter », les états rares | tests ; parcours ; contre-épreuve |
| 4 · Les liens, la visite, les contrats | « Aujourd'hui » (S2) et ses liens vers la semaine, les alertes, la visite guidée de la démonstration, les parcours qui lisent les anciennes pages, les contrats réécrits | tests ; parcours ; recette |

**Chaque PR garde le module entier utilisable** : jamais un bloc retiré sans que
la PR suivante lui ait donné sa place (section 7). Les anciennes adresses
servent dès la PR 1 et ne sont jamais retirées.

Chaque PR : `lint`, `typecheck`, `test`, `build`, `knip`, `push:check`,
`weather:check`, `site:check` collés ; `e2e` joué en local sur les parcours
touchés, la suite complète par la CI ; registres à jour dans la même PR
(roadmap : tableau de la section 1, ordre de la section 2, bloc détaillé).
Avant d'écrire, chaque PR relève l'état de départ (contrôles, mesures à
390 px et temps du serveur) et le colle dans sa description (consigne 6).

**Essai des cinq tâches** (diagnostic, section 6) : « votre semaine est-elle
bonne ? » et « vous avez changé un goutte-à-goutte, où le dites-vous ? » se
posent sur cette maquette. Conseillé avant la mise en ligne de la PR 2, la seule
qui change ce qu'on voit ; il dépend du porteur et **ne bloque pas le code**.
Le porteur est prévenu à l'ouverture de la PR 2 ; le résultat règle les mots et
l'ordre, jamais la structure.

## 3. La page « Semaine »

### 3.1 Adresse, existence, accès

- **Adresse** : `/irrigation/semaine`, avec les paramètres existants : `season`,
  `week` (un jour quelconque de la semaine, `AAAA-MM-JJ`, comme aujourd'hui sur
  les alertes), `zone`, `refresh`, `absente`. Un nouveau : **`vue`**, `cumuls`
  pour la seconde vue, rien pour la première (précision S4-b).
- **Existence.** « Semaine » n'est pas une case de plus : elle **existe quand l'une
  des trois cases Planning, Objectifs et besoins, Historique est cochée** (S3,
  section 3.2). Les trois cases, leur page de réglage et leurs dépendances ne
  changent pas (une case décochée retire ce qu'elle apporte, comme aujourd'hui).
  Une ferme qui n'en coche aucune n'a pas la page.
- **Une fonction du domaine** (`lib/domain/features/`, à côté de celle de S3) dit,
  pour une sélection de cases, **quelles vues et quelles sections** la page
  contient (section 3.2). La page, la barre, le menu, les liens et la visite
  l'appellent ; aucun ne copie la liste (AGENTS.md : une règle vit en un seul
  endroit).
- **Accès** : comme les autres pages cochées ; une première visite conduit à
  l'écran de bienvenue ; une ferme qui ne coche aucune des trois cases demandant
  `/irrigation/semaine` arrive sur sa page d'arrivée avec la ligne « page non
  cochée » (inchangé, P14).
- **Saison** : le choix de la saison reste, comme sur les trois pages d'aujourd'hui
  (S1, section 3, règle 4) ; une autre saison s'ouvre depuis la page (F825 de S1
  tient). Elle reste dans l'adresse.
- **Endroit** : « Semaine » dans le rangement de S3 ; l'entrée de la barre, du
  menu de l'ordinateur et du « Retour » ouvre cette page.

### 3.2 Ce que la page contient selon les cases

Les dépendances (3.8) font que six combinaisons existent : le planning exige
« Objectifs et besoins », qui exige « Arrosages » ; l'historique exige
« Arrosages ».

| Cases cochées (parmi les trois) | Vue « La semaine » | Vue « Les cumuls » | Page ouverte sur |
| --- | --- | --- | --- |
| aucune | — (pas de page) | — | — |
| Objectifs et besoins | phrase, bilan, jours (faits, pluie), jardins ; détail : besoins, objectifs, météo, pluie | — | La semaine |
| Objectifs et besoins + Planning | + les créneaux proposés à valider, le plan, ses budgets, ses réglages | — | La semaine |
| Historique | — | tout l'historique | Les cumuls |
| Objectifs et besoins + Historique | comme « Objectifs et besoins » | oui | La semaine |
| les trois | tout | oui | La semaine |

**Le sélecteur de vue** (deux liens au téléphone comme à l'ordinateur, « La
semaine » et « Les cumuls », 44 px, `aria-current="page"` sur la vue ouverte)
n'existe que quand les deux vues existent. Il se place sous le titre, dans la
ligne que S3 réservait à la bande, et la vue change **sans recharger** (le menu
suit le routeur, N1 de la lenteur). La vue « Les cumuls » garde sa propre
navigation de période ; les flèches de la semaine n'y sont pas.

### 3.3 Les anciennes adresses

`/irrigation/planning`, `/irrigation/besoins` et `/irrigation/historique`
**gardent leur effet** : chacune ouvre `/irrigation/semaine` (redirection du
serveur) **avec tous ses paramètres** (`season`, `week`, `zone`, `refresh`) et son
**ancre** (le navigateur garde l'ancre d'une redirection), sur la vue qui portait
son contenu (`historique` mène à `vue=cumuls`). Si la case de la page demandée
n'est pas cochée, la conduite d'avant tient : la page d'arrivée et sa ligne
(P14). L'adresse `/irrigation/historique.csv` ne change pas. Les anciennes
adresses `/irrigation#…` gardent la conduite de `legacyRedirect` : ses règles
désignent désormais « Semaine » pour les ancres qui désignaient l'une des trois
pages (section 9).

Les trois anciens identifiants de page restent ceux des **cases** (menu des
fonctionnalités, `pageAccess`) ; `semaine` est l'identifiant de la **page**
(précision S4-a).

### 3.4 Le temps du serveur

La page lit moins, pas plus, que les trois. **Règle** : à l'ouverture, le serveur
lit ce qu'il faut au premier niveau (le tableau de l'eau de la semaine, le plan
enregistré, les irrigations de la saison) ; **les besoins par planche, les cumuls
et l'écart du prévu ne se lisent qu'à la demande** (ouverture du pli ou de la
vue), par les actions de lecture qui existent (la lenteur du module a coûté cher,
N1 à N3). **Budget** : le temps du serveur à l'ouverture, mesuré comme le contrat
de la lenteur (copie construite, 20 ms par lecture), ne dépasse pas celui de la
plus lente des deux pages d'aujourd'hui (planning, besoins) de plus de 20 % ; la
mesure avant/après est collée dans la PR 1 et dans la section 12. Une page n'est
calculée qu'une fois par requête (`renderOncePerRequest`).

## 4. Le premier niveau, de haut en bas (PR 2)

Le gabarit des pages est celui de S1 (chapeau d'une ligne, titre, « ? »). La
maquette est suivie sauf aux endroits que la section 4.7 liste.

1. **Les flèches et le titre.** « ‹ [Cette semaine] › » : le titre est « Cette
   semaine » quand la semaine contient aujourd'hui, sinon « Semaine du 8 au 14
   juin » ; dessous, « du lundi 15 au dimanche 21 juin » (lundi au dimanche,
   `Europe/Paris`, D-004). Flèches de 44 px, noms accessibles « Semaine
   précédente » et « Semaine suivante » (ceux des besoins d'aujourd'hui) ; un
   raccourci « Cette semaine » quand on est ailleurs, sans effet sur la semaine
   en cours (F470 des besoins tient). **L'adresse dit la semaine** (`week`) : un
   rechargement, le bouton retour et un lien envoyé retrouvent la même semaine
   (précision S4-g).
2. **La ligne du plan et une phrase.** Pour la semaine en cours seulement : « Plan
   calculé aujourd'hui à 6 h 02 · Recalculer » (le bouton « Recalculer le plan »
   d'aujourd'hui, mêmes mots que S2, mêmes états : « Calcul en cours… ») ; puis
   **une phrase qui dit la situation** (4.2).
3. **L'encadré d'attention**, quand il y a lieu, avant tout le reste, comme sur
   « Aujourd'hui » (S2, section 8, points 2 et 6 ; mêmes fonctions, jamais
   refaites ici) : « L'eau manque » quand une répartition attend (phrase du
   planning et lien « Répartir l'eau ») ; **une seule** ligne « Calcul
   approximatif » (la première donnée qui manque, dans l'ordre de
   `lib/domain/today/reliability.ts`, avec son geste existant et « + 2 autres »).
   Un minuteur qui attend la confirmation de ses horaires reste dit en une ligne
   (état, pas explication). Pas de manque : rien.
4. **Le bilan** (une carte) : la barre de progression (nom accessible « 12 mm reçus
   sur 23 mm visés »), **trois chiffres** (4.3), et deux liens de 44 px :
   « Comprendre ces chiffres » et « Changer l'eau visée » (PR 3).
5. **« Jour par jour »** (section 5).
6. **« Jardin par jardin »** (section 6).
7. **Le pied** : « Le détail » (section 7) et « Exporter » (4.6).

### 4.1 Les états de la semaine

| Semaine affichée | Titre | Ce qu'elle montre |
| --- | --- | --- |
| En cours | « Cette semaine » | tout : plan, créneaux à valider, bilan |
| Passée | « Semaine du … au … » | le bilan, les jours (ce qui s'est fait, la pluie), les jardins ; pas de plan |
| À venir | idem | l'eau visée, la pluie annoncée quand elle l'est ; pas de plan, rien d'arrosé encore |
| Autre saison | idem | les mêmes états, la saison dite dans le titre ; pas de plan |

**Le plan ne couvre que la semaine en cours** (`docs/planning-contract.md`, hors
périmètre : « le plan au-delà de la semaine courante ») : pour toute autre
semaine, « Jour par jour » ne montre aucun créneau à valider et la ligne du
plan n'existe pas ; une ligne le dit une fois (« Le plan ne couvre que la
semaine en cours »). Une semaine sans objectif posé : « Aucune eau visée cette
semaine » et « Poser un objectif » ; jamais un zéro inventé (D-003).

### 4.2 La phrase

Une fonction de `lib/domain/` (nouveau dossier `semaine/`), testée sans
navigateur. Elle **dit des faits, jamais un jugement** : l'objectif est fixé en
millimètres par semaine, « il n'existe pas de niveaux qualitatifs » (AGENTS.md).
Les mots qui existent sont repris (S1 : « Eau visée cette semaine », « Il manque
encore », origine de la pluie « dont 2,4 mm de pluie prévue, non mesurée »,
F429) ; seul ce qui n'a pas de mot (semaine passée ou à venir) en reçoit un, dans
`lib/domain/simple-words.ts`, sous le test de garde de S1.

| Cas | Exemple |
| --- | --- |
| En cours, il manque | « 12 mm reçus sur 23 mm visés. Il manque encore 11 mm d'ici dimanche. » |
| En cours, atteint ou dépassé | « 25 mm reçus sur 23 mm visés. » (jamais « il manque » négatif) |
| En cours, une action attend | la phrase + « Deux arrosages restent à valider. » (le nombre du plan) |
| Passée | « 21 mm reçus sur 23 mm visés : il a manqué 2 mm. » |
| À venir | « 23 mm visés. 14 mm de pluie annoncés. » ; pluie inconnue : « Pluie annoncée non disponible. » |
| Objectif inconnu | « Aucune eau visée cette semaine. » |
| Eau reçue inconnue | dite inconnue, jamais zéro (D-003) |

**Prévu, estimé et mesuré ne se confondent jamais** (D-006) : la phrase, la barre
et le titre de chaque chiffre gardent l'origine de la pluie comptée ; la pluie
**annoncée** n'est jamais ajoutée à ce qui a été **reçu** sans le dire. L'ET0 est
une information (la « soif de la semaine »), jamais un terme du besoin ni de
l'écart (D-010) : elle n'est pas dans la phrase.

### 4.3 Les trois chiffres

| Chiffre | Source | Mot |
| --- | --- | --- |
| Reçus | « Eau reçue » d'« Aujourd'hui » (irrigation réelle + pluie réelle ou estimée, même fonction que S2, section 8) | « reçus » |
| Visés | `farmObjective` (S1, PR 3), la phrase de l'objectif de la ferme : « 23 mm visés sur les 7 planches qui ont un objectif » | « visés » |
| Arrosés | le volume de l'irrigation réalisée de la semaine (m³) | « arrosés » |

**Écart assumé avec la maquette** (précision S4-d, dit au porteur) : la maquette
écrit « 2,5 m³ pris au bassin ». Le module sait combien d'eau a été **arrosée**,
pas toujours **d'où** elle vient (ressource ou réseau) : le troisième chiffre dit
ce qu'il sait, « m³ arrosés ». Le dire autrement promettrait une origine que la
donnée n'a pas. La part tirée de chaque ressource reste dans « Eau disponible »
(« Aujourd'hui », « Ressources »).

L'objectif **est celui d'« Aujourd'hui »**, partout (D-328, D-329) : une seule
fonction, pondérée par la surface, sur les seules planches qui en ont un, et la
page le dit comme le fait la phrase de S1 (« 7 planches sur 10 ont un objectif »).

### 4.4 La barre

Une barre de 14 px, pleine largeur de la carte, qui montre reçus sur visés ;
au-delà de 100 %, elle reste pleine et le chiffre dit le dépassement. Jamais une
couleur seule : le chiffre est écrit (contraste mesuré, charte gardée). Sans
objectif : pas de barre, la phrase et « Poser un objectif ».

### 4.5 Les liens du bilan

« Comprendre ces chiffres » ouvre l'explication de la section 8.1 ; « Changer
l'eau visée » ouvre le pli des objectifs (8.2). Aucun n'écrit : D-028.

### 4.6 « Exporter »

Le lien du pied de page exporte la semaine affichée au format CSV de l'historique
(`/irrigation/historique.csv`, route et format **inchangés**), avec la période
« semaine » de cette semaine ; le constructeur d'adresse de l'historique
(`irrigation-history-dashboard.tsx`) est appelé, pas recopié. Il n'existe que si
la case Historique est cochée.

### 4.7 Ce que la maquette dit et que le module ne peut pas dire, ou autrement

| La maquette | Le module | Précision |
| --- | --- | --- |
| « La semaine est à moitié arrosée » | un fait chiffré, pas un jugement | S4-c |
| « 2,5 m³ pris au bassin » | « m³ arrosés » | S4-d |
| « 4 arrosages faits · 12 mm » par jour | « n arrosages faits · x m³ » par jour (le tableau des jours porte des m³, pas des mm par jour) ; un mm par jour seulement si une fonction du domaine le donne déjà, relevé en PR 2, sinon rien de nouveau n'est calculé | S4-e |
| « Valider toute la semaine (2) » | tient : l'action « Valider toute la semaine » d'aujourd'hui | — |
| « Jardin par jardin : 12 mm sur 20 » | tient : les lignes d'« Eau de la semaine » d'« Aujourd'hui » (T4), une fonction | S4-f |

## 5. « Jour par jour » (PR 2)

Sept lignes, du lundi au dimanche, **aujourd'hui marqué** (« aujourd'hui »,
couleur et épaisseur de la charte). Chaque ligne : le jour, ce qui s'y est passé
ou s'y passera, et **au plus un bouton**. Une ligne mesure 52 px au moins ; le
bouton, 44 px.

**Ce que dit une ligne** (dans cet ordre, ce qui existe) :

1. **Fait** : « 4 arrosages faits · 0,9 m³ » (volumes de réalisé, S4-e) ; un volume
   incomplet (une planche sans surface mouillée connue) le dit, jamais une somme
   fausse.
2. **En cours** : « En cours · Abri des noues » avec un lien « Aujourd'hui » : on
   **ne démarre ni ne termine pas ici**, c'est la carte de « Aujourd'hui »
   (précision S4-h : un seul endroit pour faire avancer un arrosage, S2).
3. **À valider** (semaine en cours, case Planning cochée) : l'heure, le matériel,
   la durée et la dose (« 9 h 29 · Abri des noues · 1 h 21 · 8 mm »), le bouton
   **« Valider »**, et un lien « Autres choix » qui ouvre la carte existante de
   la proposition (**`ProposalCard`, réutilisée telle quelle**) : justification,
   « Changer l'heure ou la dose », « Pas à cette heure ». Mêmes actions
   serveur, mêmes gardes que le planning d'aujourd'hui (S2, section 5) :
   restriction d'eau, limite journalière, créneau protégé, pompe, matériel changé.
   Un refus s'écrit sous la ligne avec son motif ; jamais masqué.
4. **Validé, planifié** : « Planifié · 7 h » sans bouton ; le jour même, le lien
   « Aujourd'hui » (le « Démarrer » est là-bas).
5. **Pluie** : la pluie mesurée du jour (« pluie 4 mm, mesurée ») ou, à défaut, la
   réanalyse ou la prévision **avec son mot** (« estimée », « annoncée »).
   Mesurée, estimée et annoncée ne se confondent pas (D-006).
6. **Rien** : « Rien de prévu » ; plusieurs jours de suite sans rien se **regroupent
   en une ligne** (« mer. 17 au ven. 19 · Rien de prévu · 14 mm de pluie
   annoncés », comme la maquette ; F301 des besoins tient : un jour calme n'est
   jamais masqué, il est compté).
7. **Limite** : « limite dépassée » quand la limite journalière l'est (existant).

**En pied de liste** : « Valider toute la semaine (n) » quand n ≥ 1 créneaux sont à
valider (action existante, même confirmation ; le nombre est celui du plan).
Une proposition qui **n'est plus** celle du calcul affiché (calcul plus récent)
se dit comme aujourd'hui (« calcul du … »). **Les planches non servies** (le plan
n'a pu les placer) restent au premier niveau en **une ligne** quand il y en a
(« 3 planches non servies · Voir ») qui ouvre leur liste dans le détail
(S4-i) : le plan ne promet jamais ce qu'il ne place pas, et ne le cache pas.

**À l'ordinateur**, la semaine garde son **tableau** (les jours en colonnes, une
ligne par matériel, précision P46 du planning) à la place de la liste : la place
existe, et c'est le composant d'aujourd'hui, réutilisé. Le premier niveau y tient
donc le même contenu que le téléphone sous une autre forme, et chaque bouton y a
la même règle.

**Au téléphone**, les jours écoulés de la semaine en cours se replient sous
« Jours écoulés (n) » comme aujourd'hui (`phone-week.ts`, F11) : un jour qui
porte une irrigation validée dont l'heure est passée sans être faite **reste
ouvert**. Aucun jour ne se cache derrière un repli sans le compter.

**Sans la case Planning** : les lignes 1, 2, 5, 6 et 7 (ce qui s'est fait, la
pluie) ; aucun « À valider ». **Pour une autre semaine** : les lignes 1, 5, 6 et 7.

## 6. « Jardin par jardin » (PR 2)

Une ligne par jardin : son nom, « 12 mm sur 20 », une barre de 10 px. Les chiffres
sont ceux d'« Eau de la semaine » d'« Aujourd'hui » (T4 de son contrat, S2 les
garde au premier niveau) : **une seule fonction pour les deux pages**, pas deux
façons de faire la moyenne (c'est la cause de S1-O1, déjà établie par S1). Trier
comme « Aujourd'hui » ; un jardin sans objectif n'a pas de barre : « pas d'eau
visée » et le lien « Lui en donner une » (précision S4-f). Un lien par ligne :
l'ancre de ce jardin dans « Ce qu'il reste à arroser » (7.1), qui ouvre le pli.
« n planches n'ont pas d'eau visée : elles ne sont pas comptées » se dit une
fois, sous la liste, avec le lien de l'objectif.

**Multi-fermes** : à plus de dix jardins, la liste montre les dix premiers (ordre
naturel, `compareNamesNaturally`) puis « Voir les n autres » ; aucun jardin
n'est perdu, et la liste est la même pour tout le monde (précision S4-j).

## 7. « Le détail » (PR 2 et PR 3)

**Règle.** Tout ce que les trois pages montrent aujourd'hui et que le premier
niveau ne reprend pas est **dans un seul pli « Le détail »**, fermé, dont la ligne
de résumé dit ce qu'il contient (« 3 jardins · 2 réglages · 1 donnée à
rafraîchir »), **chaque section étant elle-même un pli fermé** avec sa ligne.
Rien n'est retiré (« Aucune fonction retirée »). Les plis suivent le mécanisme
`AnchoredFold` d'aujourd'hui : **chaque ancre existante ouvre le pli parent et le
sien** (7.4).

### 7.1 Les sections du détail

Dans l'ordre (de ce qui sert le plus à ce qui se règle une fois), avec leur case :

| # | Section | D'où elle vient | Case | Lue |
| --- | --- | --- | --- | --- |
| 1 | **Ce qu'il reste à arroser** : le besoin par planche, par jardin (« Pour les experts », « Voir le calcul », « Pourquoi ? » compris) | « Objectifs et besoins », `IrrigationNeedsDashboardView` | Objectifs et besoins | à la demande |
| 2 | **Le plan, chaîne par chaîne** : l'explication du calcul, les changements depuis le calcul précédent, le budget d'eau, les suggestions du plan, les planches non servies | « Planning », `PlanSummaryCards`, `ChangesFold`, `BudgetList`, `SuggestionList`, `UnplacedList` | Planning | avec le plan |
| 3 | **Eau visée** : les objectifs, l'objectif automatique, le choix du lieu | pli « Objectifs de la semaine » | Objectifs et besoins | avec la semaine |
| 4 | **Pluie mesurée** : saisir un autre jour, remplacer, retirer | pli « Pluie mesurée » | Objectifs et besoins | avec la semaine |
| 5 | **Météo de référence** : le lieu, l'actualisation, la mise à jour automatique | pli « Météo de référence » | Objectifs et besoins | avec la semaine |
| 6 | **Jours de la semaine, un par un** : le tableau des jours (pluie, ET0, volumes, limite) | tableau de la semaine des besoins | Objectifs et besoins | avec la semaine |
| 7 | **Écart du prévu des trois dernières semaines** | `AppliedWaterGapBlock` | Planning | à la demande |
| 8 | **Réglages de la semaine** : les réglages du planning et les heures où l'on n'arrose pas | `PlanningSettingsForm`, `ProtectedSlotsSection`, `PageSettingsFold` | Planning | avec le plan |

**Les lignes de résumé de chaque pli sont celles d'aujourd'hui** (F460 : objectifs,
météo, pluie mesurée) ou leur équivalent pour les sections qui n'en avaient pas ;
un texte qui dépend de la donnée du jour (« pluie réelle incomplète », une
restriction) **reste en place** comme un état, pas une explication (S1).

Les « suivis » qui n'étaient ni dans le planning ni dans les besoins ne bougent
pas : le suivi par série reste dans la vue « Les cumuls » (S4-k).

### 7.2 La vue « Les cumuls »

La vue **est la page « Historique et cumuls » d'aujourd'hui**, dans le gabarit de
la nouvelle page : « Par périmètre · Par série », la période (semaine, mois,
saison, dates à la main) et ses flèches, le filtre, les cartes de cumul, la
liste des événements, le suivi par série, l'export. **Rien n'y est simplifié par
S4** (S1 a fait l'objectif et le chapeau) ; ce qui change, c'est l'adresse et le
voisinage : un seul geste la relie à la semaine. Elle ne lit ses données qu'à
l'ouverture de la vue.

### 7.3 Ce qui n'est pas dans le détail

« L'eau du jour » (limite journalière, alertes du jour) et les alertes météo
n'étaient pas des pages de la semaine : elles restent où elles sont (« Aujourd'hui »,
« Arrosages », « Alertes météo »).

### 7.4 Ancres

Toute ancre qu'un lien existant vise **existe sur la page et ouvre le pli qui la
porte** : au minimum `weather`, `manual-rain` (`MEASURED_RAIN_ANCHOR`),
`objectifs-de-la-semaine`, `meteo-de-reference`, `planning`, `planning-title`,
`series-water-title`, `proposal-<id>` (qui ouvre en plus la carte de la
proposition), l'ancre de chaque jardin de « Ce qu'il reste à arroser »
(`needsGardenAnchor`) et celles des lignes d'« Eau de la semaine » (`today/week.ts`).
La PR 1 en fait le **relevé complet** (tout identifiant cité par un lien, une
notification, une visite ou un test) et un test échoue pour une ancre
manquante.

## 8. Les gestes de la page (PR 3)

### 8.1 « Comprendre ces chiffres »

Un pli sous la carte du bilan, qui dit **d'où viennent les trois chiffres**, en
phrases du champ : l'eau visée et sa provenance (saisie, automatique, « 7
planches sur 10 »), l'irrigation faite (mm et m³), la pluie comptée (mesurée,
estimée, annoncée, chacune avec son mot), ce qui manque ; puis, en information
seulement, la soif de la semaine (ET0, D-010). **Ce sont les tuiles de résumé
d'aujourd'hui** (« Eau visée cette semaine », « Irrigation réalisée », « Pluie
réelle / estimée », « Pluie encore prévue », « Soif de la semaine »), réutilisées
avec leurs bulles d'origine, **sans un calcul de plus**. Le mot du calcul reste
dans le « ? » et le détail (S1).

### 8.2 « Changer l'eau visée »

Ouvre la section 3 du détail (« Eau visée »), au bon pli, sans changer de page ;
le focus passe au premier champ. L'objectif automatique et sa règle (D-309 :
éteint par défaut, l'objectif saisi passe toujours avant) **ne changent pas**.
Sans case Objectifs et besoins : le lien n'existe pas.

### 8.3 « Noter la pluie »

La fenêtre « Noter la pluie » de S2 (section 7 de son contrat) est **appelée, pas
refaite** : le même composant partagé, le même domaine (`rain-entry.ts`). Entrées :
le lien « Noter la pluie » du bilan, celui de la ligne « Calcul approximatif »
quand la pluie manque, celui d'un jour sans mesure dans « Jour par jour ». **Le
jour choisi par un lien de la ligne d'un jour est celui de cette ligne.**
« Retirer la mesure » et la saisie d'un jour plus ancien que la liste de la
fenêtre restent dans la section 4 du détail (« Pluie mesurée »), qui reçoit
l'ancre `manual-rain` : la règle de D-082 (la semaine affichée suit le dernier
jour choisi, la réponse d'un jour choisi plus tôt est ignorée) y tient. Après un
enregistrement, la semaine se relit et le plan se recalcule (3.7, règle 4) :
la page ne dit rien d'enregistré avant que le serveur l'ait dit. Une ferme
toute sous abri n'a pas ce geste (D-032).

### 8.4 Aller et venir entre les semaines

Les flèches changent de semaine **sans quitter la page** ; la semaine est dans
l'adresse (S4-g). **Mécanisme au choix du code**, deux critères : l'adresse dit
toujours la semaine, et la réponse n'est pas plus lente que celle des flèches
de « Objectifs et besoins » d'aujourd'hui (mesure collée). Le plan et ses
créneaux n'existent que pour la semaine en cours (4.1). **Aux limites d'une
saison**, la flèche se comporte comme celle de « Objectifs et besoins »
d'aujourd'hui : le comportement est relevé et redit en PR 3, S4 ne l'invente pas.

### 8.5 Les états rares

| Cas | Ce que ça devient |
| --- | --- |
| Pas d'eau visée posée | « Aucune eau visée cette semaine » et « Poser un objectif » ; jours et jardins sans barre |
| Plan jamais calculé | « Aucun calcul pour cette semaine. Le plan se calcule chaque matin après la météo, ou maintenant d'un clic. » ; « Calculer le plan de la semaine » ; les jours disent le fait et la pluie |
| Un calcul est en cours ou a échoué | la phrase d'aujourd'hui (`pendingEventNotice`), en alerte pour l'échec ; les boutons se désactivent comme avant |
| Pénurie, répartition qui attend | l'encadré « L'eau manque » au premier niveau (S2) ; le planning garde sa conduite (priorités d'abord, puis part égale) |
| Restriction d'eau | elle **bloque** « Valider » et le motif s'écrit sous la ligne (AGENTS.md) ; une irrigation réelle déjà faite reste enregistrable |
| Météo indisponible | « Prévision indisponible : à vérifier » en ambre, comme « Aujourd'hui » ; jamais un zéro |
| Pluie mesurée manquante | une seule ligne « Calcul approximatif » avec « Noter la pluie » |
| Ferme toute sous abri | pas de « Noter la pluie » ; la pluie y vaut 0 (D-032) |
| Une seule case (Historique seul) | la page s'ouvre sur « Les cumuls », sans sélecteur ni flèches de la semaine |
| Sans le planning | « Jour par jour » dit ce qui s'est fait ; aucun « Valider » |
| Une ferme à trois cents planches | « Jardin par jardin » : les dix premiers puis « Voir les n autres » ; « Ce qu'il reste à arroser » se replie par jardin comme aujourd'hui |
| Démonstration (fermes fictives, date simulée) | mêmes états ; « Valider » écrit dans la base de démonstration comme aujourd'hui ; la visite guidée suit (PR 4) |
| Hors ligne ou serveur en erreur | la ligne qui a échoué le dit et laisse la saisie ; rien ne se perd en silence |

## 9. Adresses, notifications, liens : rien ne se perd (PR 1 et PR 4)

- **Toute adresse d'aujourd'hui s'ouvre** (3.3), avec ses paramètres et ses ancres.
  S4 en ajoute une, `/irrigation/semaine`.
- **`legacyRedirect`** (`lib/domain/features/pages.ts`) : les ancres `weather`,
  `planning`, `planning-title` et `series-water-title` désignent « Semaine » (la
  vue « Les cumuls » pour la dernière) quand la case qui portait leur contenu est
  cochée ; une case décochée garde la conduite d'avant (page d'arrivée et sa
  ligne). Ses tests sont réécrits dans la PR 1.
- **Les liens des notifications** (message du matin, rappel du soir, fin
  d'arrosage, alertes météo et cultures, aspersions à reconsidérer) mènent aux
  **mêmes endroits** : celles qui visaient `/irrigation/planning?week=…` (les
  alertes cultures) visent `/irrigation/semaine?week=…` dès la PR 4 ; **les
  notifications déjà envoyées gardent leur lien**, que la redirection sert
  sans limite de durée. Le texte des notifications ne change pas.
- **Les liens des pages entre elles** (« Voir la semaine » et la ligne de pied
  « Voir au planning » de S2, « Objectifs et besoins » de « Eau de la semaine »,
  « Noter la pluie de la semaine » de la fiabilité, « Répartir l'eau », les liens
  de « Matériel » vers les besoins…) visent la nouvelle page et son ancre.
  **La pluie** : `reliability.ts` (page `besoins`, ancre `manual-rain`) passe à
  la page `semaine`, qui ouvre la fenêtre de 8.3.
- **Le service worker** des notifications n'est pas touché. L'application
  installée garde `start_url` `/irrigation` et sa page d'arrivée (D-323).
- **Aucune migration, aucun appel à la base de plus** que ceux d'aujourd'hui
  pour une même semaine ; le journal `irrigation_page_loaded` nomme la page
  `semaine` (une ligne de plus dans le relevé des mesures de la lenteur).

## 10. Ce que S4 change des contrats validés

| Contrat | Passage | Devient |
| --- | --- | --- |
| `planning-contract.md`, « Interface (3.6) » | la page « Planning de la semaine » : plan, résumé, jours, cartes, « Valider toute la semaine », réglages | **les mêmes blocs** sur « Semaine » : jours au premier niveau, le reste dans le détail ; gestes et gardes inchangés |
| `replanning-contract.md` | les liens vers le planning (`?recalculer=1`, bouton « Recalculer ») | vers « Semaine » ; le mécanisme `useUrlIntent` est gardé |
| `irrigation-needs-contract.md`, la semaine, la pluie mesurée et D-082 | la page « Objectifs et besoins » | la section 4 du détail ; la règle de la semaine affichée tient |
| règles de l'historique (roadmap 2.9, D-036, D-329, `series-contract.md`) | la page « Historique et cumuls » | la vue « Les cumuls » ; ses règles ne changent pas |
| `audit-ergonomie-2026-11-19-lot-j-contract.md`, F460 (plis fermés) ; `audit-ergonomie-final-lot-d-contract.md`, J3 (jours au téléphone) | objectifs, météo, pluie en plis ; les jours en une ligne | gardés, dans le détail ; les jours passent au premier niveau (section 5) |
| `aujourdhui-tableau-de-bord-contract.md`, T4, et `aujourdhui-liens-contract.md` | « Eau de la semaine » mène à « Objectifs et besoins » ; « Voir au planning » | mène à « Semaine » |
| `simplification-s1-contract.md`, section 3 (budget P61 de chaque page) | une borne par page, pour le planning, les besoins et l'historique | une borne pour « Semaine » (section 12) ; les trois anciennes bornes disparaissent avec les pages |
| `simplification-s2-contract.md`, sections 7 et 8 | « Voir la semaine » mène à « Objectifs et besoins » jusqu'à S4 ; « Tout valider reste sur le planning » ; « Changer l'heure ou la dose » mène au planning | mène à « Semaine » ; « Valider toute la semaine » est sur « Semaine » ; l'ajustement s'ouvre sur « Semaine » |
| `simplification-s3-contract.md`, section 3.3 | la bande de liens « La semaine » ; la barre ouvre la première page cochée | la bande est retirée ; la barre ouvre la page « Semaine » ; le menu de l'ordinateur a « La semaine » et « Les cumuls » |
| `simplification-s5-contract.md`, sections 6 et 10 | le lien « Changer l'heure ou la dose » vers le planning | vers la proposition sur « Semaine » |
| `feature-selection-contract.md`, section 5 | les pages et le menu | + la page `semaine`, qui n'est pas une case ; les trois cases gardent leur sens |
| `browser-journeys-contract.md` | les parcours qui lisent « Planning de la semaine », « Objectifs et besoins », « Historique et cumuls » | réécrits dans la PR qui les change ; un parcours nouveau ajouté |
| `demo-guided-contract.md`, visites | les étapes `planning-semaine`, `planning-creneaux`, `planning-propositions`, `planning-non-servies` | gardées ou ré-ancrées sur la nouvelle page ; une étape dont l'élément manque est sautée (règle existante) |

**Ne changent pas** : le plan et son calcul (priorités, part égale, report,
« même entrée, même plan ») ; le besoin, l'objectif, l'écart, l'ET0 (D-010) ;
D-003 (une donnée inconnue reste inconnue), D-004 (lundi au dimanche,
`Europe/Paris`), D-006, D-028 (rien ne s'écrit sans un appui), D-030 (un refus
vaut pour toute la semaine), D-032 (sous abri), la pluie mesurée qui prime, la
restriction d'eau ; les cases des fonctionnalités à la carte ; l'isolation par
utilisateur, exploitation et saison ; la charte graphique (polices, vert, bleu
de l'eau, cibles de 44 px, contrastes mesurés) ; l'export CSV (route, colonnes) ;
les heures de silence ; le contenu de la vue « Les cumuls ».

### Précisions tranchées (option recommandée, modifiables à la relecture)

| N° | Précision | Choix |
| --- | --- | --- |
| S4-a | Identifiants | `semaine` est la page ; `planning`, `besoins`, `historique` restent les identifiants des **cases** et des anciennes adresses |
| S4-b | Les cumuls | **une seconde vue de la même page** (`?vue=cumuls`), pas une page à part : la semaine répond à « est-ce que ma semaine est bonne ? », les cumuls (mois, saison, dates à la main, filtres, série) sont une analyse qu'on fait rarement ; rien n'y est retiré |
| S4-c | « À moitié arrosée » | pas de jugement : l'objectif est en millimètres, « pas de niveaux qualitatifs » (AGENTS.md) ; la phrase dit les chiffres |
| S4-d | Troisième chiffre | « m³ arrosés », jamais « pris au bassin » (origine non connue) ; écart voulu avec la maquette |
| S4-e | Un jour | « n arrosages · x m³ » (les volumes existent) ; un mm par jour seulement s'il existe déjà dans le domaine ; aucun calcul nouveau |
| S4-f | Un jardin | la même fonction que « Eau de la semaine » d'« Aujourd'hui » ; un jardin sans objectif dit « pas d'eau visée » |
| S4-g | La semaine dans l'adresse | `week=AAAA-MM-JJ` toujours ; retour du navigateur et lien envoyé retrouvent la semaine |
| S4-h | Démarrer, terminer | pas sur « Semaine » : un seul endroit pour faire avancer un arrosage, « Aujourd'hui » (S2) ; « Valider » y est |
| S4-i | Planches non servies | une ligne au premier niveau qui ouvre leur liste dans le détail |
| S4-j | Beaucoup de jardins | les dix premiers, puis « Voir les n autres » |
| S4-k | Le suivi par série | reste dans la vue « Les cumuls » |
| S4-l | Le plan et les autres semaines | le plan ne couvre que la semaine en cours ; une ligne le dit, aucun créneau ailleurs |
| S4-m | Le menu de l'ordinateur | le groupe « Semaine » a deux lignes, « La semaine » et « Les cumuls » (selon les cases) |
| S4-n | Les réglages du planning | restent sur « Semaine », dans le pli « Réglages de la semaine » ; les ranger est un autre chantier |
| S4-o | Les anciennes adresses | redirection du serveur, paramètres et ancre gardés, **jamais retirées** |
| S4-p | Le temps de la page | à la demande pour les besoins par planche, les cumuls et l'écart du prévu ; budget +20 % au plus (3.4) |
| S4-q | L'essai des cinq tâches | conseillé avant la PR 2, jamais bloquant pour le code |

**Aucune de ces précisions n'est agronomique** : aucune ne touche une dose, un
seuil, un coefficient, la lecture d'une donnée ni une règle du plan. **Aucune
question n'est réservée au porteur.** Si une question agronomique se pose en
codant, la PR s'arrête, le dit, et le porteur tranche, une question par message.

## 11. Tests et preuves

- **Domaine** (sans navigateur) : pour chacune des six combinaisons de la section
  3.2, les vues et les sections (Cases décochées : rien ne reste) ; la phrase à
  chaque cas de 4.2 ; la semaine (lundi au dimanche, `Europe/Paris`, une
  semaine qui change d'heure, une semaine à cheval sur deux années, un jour
  quelconque donné par `week`) ; les lignes de « Jour par jour » (chaque jour a
  une ligne et une seule, le regroupement des jours calmes, le volume
  incomplet, le jour ouvert d'une irrigation en retard) ; l'objectif et les
  jardins sont **la même valeur que sur « Aujourd'hui »** pour la même ferme
  (un test les lit ensemble) ; les mots des phrases sous le test de garde de S1 ;
  la route des anciennes adresses et celle de `legacyRedirect`.
- **Base de données, à deux fermes** (Alice, Bob) : la page de l'une ne lit rien
  de l'autre (planning, besoins, cumuls, écart du prévu) ; une semaine sans objectif ;
  une ferme sans plan.
- **Interface** : le sélecteur de vue ; les flèches et la semaine dans l'adresse ;
  les plis du détail (clavier, `aria-expanded`, ancres) ; « Valider » et
  « Valider toute la semaine » aux gardes qui refusent (restriction, limite,
  matériel changé) : le motif est lu sous la ligne ; « Noter la pluie » montée
  depuis chacune de ses trois entrées ; la ferme toute sous abri ; la ligne
  « Le plan ne couvre que la semaine en cours ».
- **Parcours** (numéro pris en codant), aux deux largeurs : le lundi matin sur
  « Semaine » (phrase, bilan, valider un créneau, valider la semaine, la réponse) ;
  la pluie notée 8 mm et le bilan qui bouge ; « Changer l'eau visée » ; une semaine
  passée par les flèches et le retour du navigateur ; « Les cumuls » et
  « Exporter » (l'adresse du CSV) ; **chacune des trois anciennes adresses**, avec
  ses paramètres et son ancre, ouvre le bon pli de la nouvelle page ;
  **chaque ancre du relevé 7.4** ; une ferme qui n'a coché que l'historique ;
  320 px sans débord ; cibles de 44 px.
- **Contre-épreuve** (habitude du dépôt) : une ancre qui n'ouvre plus son pli, un
  chiffre du bilan différent de celui d'« Aujourd'hui », « Valider » montré pour
  une semaine passée, un jour calme masqué, la pluie annoncée comptée comme
  reçue, « m³ pris au bassin » écrit, une redirection qui perd la saison ou
  l'ancre, une section montrée à une ferme qui n'a pas la case : chaque
  altération fait échouer un test.
- **Mesures**, à 390 px, sur les données des parcours, collées dans chaque PR et
  dans la section 13 : la hauteur de la page avant (les trois pages côte à côte)
  et après ; **le premier niveau de « La semaine » tient au plus 1 700 px** pour
  une semaine en cours avec un créneau à valider, aucune alerte et trois jardins
  (la maquette fait 1 280 px) ; la phrase et la barre à moins de 400 px du haut ;
  le premier « Valider » à moins de 900 px ; **au plus 24 choses à toucher** au
  premier niveau ; la hauteur dépliée du détail, dite, sans borne ; le temps du
  serveur (3.4). Une page qui dépasse sa borne le dit, comme au lot J ; P61/P-nouveau
  fixe chaque borne sur la mesure faite.
- **Recette** après la mise en ligne de chaque PR, dans le Chrome du porteur, avec
  son accord, en lecture seule : le constat est à l'assistant (les trois
  anciennes adresses, la nouvelle page à 390 px, la hauteur), le jugement des mots
  et de l'ordre au porteur (D-014). « Valider » et « Noter la pluie » s'essaient
  sur la démonstration en ligne, jamais sur la ferme réelle.

## 12. Risques

| Risque | Parade |
| --- | --- |
| Une page de plus en lecture, donc plus lente : le serveur lit les trois | lectures à la demande (3.4) ; budget +20 % ; mesure avant/après dans la PR 1 |
| On ne retrouve plus un bloc rangé dans le détail | section 7.1 : table de **chaque** bloc, ancres qui ouvrent le pli, ligne de résumé de chaque pli ; test d'ancres |
| Un lien de notification, une alerte ou une visite ne trouve plus sa page | aucune adresse n'est retirée (S4-o) ; relevé des liens (PR 1) et test de chaque ancre |
| La phrase dit « bonne » ou « mauvaise » et sort de l'agronomie | faits chiffrés seulement (S4-c) ; test de garde des mots |
| La pluie annoncée se lit comme reçue | l'origine de chaque chiffre est dite, la prévue jamais ajoutée au reçu sans le dire (D-006) ; contre-épreuve |
| « Valider » ici contourne une garde du planning | la même action serveur ; un test par garde (S2, section 5) |
| Deux écrans pour démarrer un arrosage | « Démarrer » est sur « Aujourd'hui » seulement (S4-h) |
| Les tests et parcours qui lisent les trois pages | relevé d'abord (au moins 34 fichiers de tests et de parcours lisent leurs noms ou leurs adresses) ; ils suivent dans la PR qui les change ; les redirections les gardent verts entre-temps |
| Le premier niveau reste long sur une grande ferme | dix jardins puis « Voir les n autres » ; budget de hauteur mesuré |
| S3 ou S5 pas finis quand S4 commence | S4 attend la fin du code de S5 (ordre de la ligne 33) ; elle appelle la barre de S3 et la fenêtre de S2 |
| Le porteur ne retrouve pas sa vue des cumuls | « Les cumuls » à un geste de « La semaine », au menu de l'ordinateur ; recette |
| Le porteur ne reconnaît pas les habitudes | le diagnostic le prévoit ; chaque ancienne adresse marche ; le « ? » de la page dit où est chaque chose |

## 13. À remplir par les PR

- Relevé des tests, parcours, liens, notifications et ancres qui lisent les trois
  anciennes pages (PR 1, complété par les PR 2 à 4).
- Mesures avant/après : hauteur, mots, choses à toucher, premier bloc utile, temps
  du serveur (PR 1 et 2).
- Décision de ce lot, précisions F, parcours : numéros pris en codant (PR 1).
- Ce que la PR 2 a trouvé sur le « mm par jour » (S4-e).

## 14. Réglage du code

**Opus 5.5 · Très élevé** pour les quatre PR (ligne 33 de la roadmap, troisième
cas de la grille) : le lot refond trois pages en une, touche tous les liens, les
notifications, les parcours et la visite guidée, et son contexte est étendu.
Aucune règle d'agronomie ni d'isolation n'est touchée ; si une PR devait en
changer une, elle s'arrête et le dit.
