# Contrat — « Aujourd'hui », le tableau de bord du module (3.8 quater, retours du porteur)

Écrit le 8 novembre 2026, avant le code, en Opus 5.5 · Très élevé (le
réglage choisi par le porteur le même jour, « Oui, Très élevé »). Il prolonge
la page « Aujourd'hui » du lot 2 de l'audit ergonomique
(`docs/audit-ergonomie-lot2-contract.md`, D-073) sans en changer les règles ;
sa décision est **D-074**. Les précisions non agronomiques (T1 à T9,
section 7) sont tranchées par l'option recommandée, selon la consigne du
porteur du 7 novembre 2026, et restent modifiables à sa relecture en ligne.

Le logiciel est **multi-fermes** : chaque bloc se construit à partir des
fonctionnalités cochées de la ferme (3.8, D-067). Les chiffres cités ici
(21 retards, 20 mm, 8 jardins) sont des exemples, pas des règles.

## 1. Objet et origine

Le 8 novembre 2026, à 12 h 09 et 12 h 15, le porteur a relu la page
« Aujourd'hui » en ligne (#293, lot 2 de l'audit). Elle ne lui plaît pas : il
la veut « beaucoup plus graphique et agréable à regarder, tout en étant plus
compréhensible ». Il veut aussi qu'elle serve de « véritable » tableau de
bord du module, et que son entrée de menu soit « détachée et avec un encart
différent ». Sur sa ferme, la page a montré 21 irrigations en retard d'un
coup. À 12 h 50, il a demandé en plus un bouton « Tout est fait » pour
l'utilisateur qui a arrosé sans se servir du chrono.

Maquette : https://claude.ai/artifact/3iLqs9LuMxCnduyPM4UmoZ (copie hors
dépôt : `/mnt/project-files/aujourdhui-tableau-de-bord/maquette-aujourdhui.html`).
**Validée par le porteur le 8 novembre 2026 à 12 h 25** (« ok je valide »).
Elle fait foi pour l'aspect ; les noms et les chiffres y sont des exemples.

Place dans la file : juste après la PR « Besoin par culture » (#296), avant
le lot 3 de l'audit et les correctifs de la 3.9.

## 2. Ce qui ne change pas

- **Aucun calcul.** Le besoin, l'écart, le plan, la jauge du sol, les alertes
  et les seuils de fiabilité restent ceux du code actuel. La page lit des
  valeurs déjà calculées par les services existants ; elle ne crée aucune
  règle métier (AGENTS.md, « Duplication d'une règle métier »).
- Les gestes : « Démarrer maintenant », « Ouvrir », « Recalculer le plan »,
  « Voir les alertes » et les gestes de la fiabilité restent les mêmes
  actions, aux mêmes adresses et ancres (F36, F37, F39).
  **Réécrit par la simplification, lot S2**
  (`docs/simplification-s2-contract.md`, section 10 ; D-330) : les actions restent les mêmes ; les mots sont ceux de
  la carte à un bouton, « Valider » et « Démarrer » s'y ajoutent sur la carte
  d'une proposition et d'une irrigation planifiée (PR 1), « Terminer »,
  « Reprendre », « Mettre en pause » et « Reprendre ce qui reste » sur ce qui
  coule ou attend d'être repris (PR 2), « Je le fais maintenant » et « C’est
  fait » sur l'arrosage à rattraper (PR 3) ; « Noter la pluie », de la tuile
  « Eau reçue » et de la ligne « Pluie réelle incomplète », ouvre sa fenêtre
  sur la page au lieu de mener à « Objectifs et besoins » (PR 4).
- L'adresse, la place de première page et de page d'arrivée (F1, F31), la
  saison du jour (F2, F32), la pastille du menu et son compte (F12, F33).
- La règle de présence : un bloc n'existe que si sa fonctionnalité est
  cochée, pour chaque ferme ; un bloc vide dit une phrase calme et n'est
  jamais caché parce qu'il est vide ; une donnée inconnue n'est jamais
  dessinée comme « tout va bien » (D-003).
- Prévu, estimé et observé ne se confondent pas (D-006) : la pluie prévue de
  la météo, la pluie mesurée de la semaine et la réserve du sol estimée
  portent chacune leur mot.
- La réserve du sol reste une information (D-041, D-047) : sa jauge ne dit
  pas d'arroser, elle ne règle rien.
- Le logiciel ne démarre et n'enregistre rien seul (D-028) : « Tout est
  fait » n'écrit qu'après une confirmation qui liste ce qu'il écrit.
- Rien n'est lu d'Ouvre ta ferme de plus qu'aujourd'hui ; aucune nouvelle
  table pour les PR 1 et 2.

## 3. Ce qui change

### 3.1 Le menu

- « Aujourd'hui » est **détaché** : un encart blanc à part, en tête du menu
  latéral, avec une pastille ronde verte et l'icône du soleil, le mot
  « Aujourd'hui » et, dessous, « Tableau de bord » (dans le menu seulement :
  la page ne le redit plus, J13) ; la pastille du nombre à
  regarder à droite. Un trait le sépare des autres pages.
- Les autres pages se rangent en trois groupes titrés (T1) : **Arroser**
  (Arrosages, Planning de la semaine, Objectifs et besoins, Réserve du sol,
  Besoin par culture), **Équiper** (Matériel et placement, Ressources et
  pompes), **Surveiller** (Alertes météo, Alertes cultures, Historique et
  cumuls). Réglages reste en bas, à part. Un groupe sans page cochée
  disparaît.
- Au téléphone, l'onglet « Aujourd'hui » de la barre du bas est un bouton
  rond vert qui dépasse de la barre, séparé des autres par un filet.
  **Réécrit par la simplification S3, PR 2 (D-331)** : le rond vert du
  centre de la barre est le « + » ; « Aujourd'hui » est une entrée comme
  « Semaine » et « Ma ferme », avec sa pastille. Les groupes du menu de
  l'ordinateur changent à la PR 3 du lot.

### 3.2 La page, de haut en bas

| Bloc | Cases requises | Contenu dessiné |
| --- | --- | --- |
| En-tête | toujours | sous le seul titre de la page, la date du jour en toutes lettres en sous-titre (« Jeudi 12 novembre » ; « Tableau de bord » n'y est plus redit, audit final, lot A, J13, D-141), la ligne du plan (« Plan calculé aujourd'hui à 6 h 02 · Recalculer »), une phrase de résumé (3.5) et des pastilles cliquables qui mènent au bloc : n à rattraper, n à faire (le chiffre seul, la phrase dit le reste, J13), le gel ou l'alerte annoncés, la prévision à vérifier, n données à rafraîchir ; rien de tout cela : des pastilles vertes (« Rien à arroser », « Rien d'annoncé sur trois jours », « Données à jour ») ; la ligne du plan, calculé ou non, mène au planning de la semaine (`docs/aujourdhui-liens-contract.md`, L3, D-312) |
| La semaine | Objectifs et besoins | quatre tuiles : objectif de la semaine (ferme entière, pondéré par la surface), eau reçue (irrigation réelle + pluie comptée, avec le détail ; la pluie dit d'où elle vient, mesurée, estimée après coup ou prévue, audit du 19 novembre 2026, lot H, F429, D-173), reste à apporter (l'écart existant, jamais négatif), eau utilisée en m³ (et celle du jour, « rien aujourd'hui » quand il n'y en a pas) quand le tableau de l'eau existe, « au moins » quand une surface mouillée manque ; chaque tuile mène à son menu d'« Objectifs et besoins », son mot d'action écrit (`docs/aujourdhui-liens-contract.md`, L1, D-310) |
| Votre journée | Planning ou Arrosages | tout en tête, « En cours (n) » : chaque irrigation dont le minuteur tourne, est en pause ou attend sa confirmation (« depuis 9 h 40, fin prévue à 13 h 50 », « en pause depuis 10 h 05 », « Durée atteinte : fermer la vanne »), avec, depuis la simplification S2, PR 2 (D-330), « Terminer », qui ouvre sur la page la fenêtre de fin d'« Arrosages », « Mettre en pause » rangé dans « Autres choix », « Reprendre » une pause, le compte à rebours « Reste 52 min » ou « Fermez la vanne, puis appuyez sur « Terminer ». » (avant : « Arrêter / Terminer », qui ouvrait sa carte sur « Arrosages »), et chaque reliquat d'une irrigation partielle (« reste 3 h 10 · 1,52 m³ ») avec « Reprendre ce qui reste » ; la phrase et les pastilles les comptent, jamais « Rien à arroser » vanne ouverte (audit du 19 novembre 2026, lot H, n° 2, F433 à F435, D-175) ; puis les anciens blocs « En retard » et « À faire aujourd'hui » réunis : à l'ordinateur, une frise de 5 h à 22 h avec l'heure actuelle et une barre par irrigation du jour (couleur du statut, longueur = durée) ; puis « À rattraper (n) » et « À faire aujourd'hui (n) », en cartes par heure (heure en grand, matériel et réglage, planches, durée et millimètres en étiquettes, statut, boutons) ; une carte « À valider » porte « Valider », « Démarrer tout de suite » et « Autres choix » (« Changer l'heure ou la dose », « Pas à cette heure »), une carte planifiée « Démarrer » et « Autres choix » (« Modifier ou annuler sur « Arrosages » ») (simplification, lot S2, PR 1, D-330) ; rien à faire : « Voir le planning de la semaine » (« Planning » coché) ou « Planifier un arrosage » (« Arrosages » seul) (L3, D-312) |
| Gel ou chaleur | Alertes cultures et/ou Alertes météo | les trois jours en cartes : icône, minimale et maximale sur une échelle commune avec le trait de 0 °C, pluie prévue ; le jour d'une alerte encadré en rouge avec ses cultures ou son alerte ; prévision absente : la carte du jour dit « inconnue » et le bloc « Prévision indisponible : à vérifier » en ambre ; une minimale prévue à 0 °C ou moins sans alerte de gel active ni gel des cultures annoncé, « Alertes météo » coché : « −2,4 °C annoncé le mer. 18 nov. et aucune alerte de gel posée. » en ambre, avec le lien « Poser « Gel : moins de 3 °C » » vers le modèle, et la pastille « Gel sans alerte posée » au lieu de « Rien d'annoncé sur trois jours » (audit final, lot A, J14, D-140) ; un jour en alerte est un lien entier vers la page de son alerte, « Voir l’alerte » écrit dessous, le gel des cultures d'abord ; un jour calme reste inerte (L3, D-312, F761) |
| Eau de la semaine | Objectifs et besoins | une barre par jardin (et une pour la ferme) : irrigation et pluie empilées (la légende nomme l'origine de la pluie, F429), trait de l'objectif, « 8 / 20 mm » ; huit jardins d'emblée, les autres derrière « Voir les n autres jardins » ; la ligne de la ferme mène au tableau des besoins, celle d'un jardin à son pli dans ce tableau (`docs/aujourdhui-liens-contract.md`, L2, D-311) |
| Réserve du sol | Réserve du sol | une jauge par jardin : part de la réserve facilement utilisable estimée maintenant (celle de la page « Réserve du sol »), et la planche la plus sèche du jardin (T7) ; jardin jamais observé : « inconnue », barre vide hachurée ; huit jardins d'emblée ; chaque ligne mène au pli de son jardin sur « Réserve du sol » (L2, D-311) |
| Eau disponible | Ressources et pompes | une cuve dessinée par réserve, remplie à son niveau, avec volume, capacité et date ; relevé de plus de 7 jours ou volume jamais saisi : cuve grise hachurée et date en ambre ; une barre par prélèvement limité (prélevé, restant, limite) ; lien d'en-tête « Ressources et pompes » ; chaque cuve mène à sa carte, où son volume se corrige, chaque ressource limitée à la liste des ressources (L2, D-311, F759) |
| Fiabilité du calcul | au moins une donnée suivie | un anneau en n parts (une par donnée suivie : à jour en vert, à rafraîchir en ambre) avec « 3/5 à jour » ; la liste montre aussi les données à jour, cochées (T6), et chaque manque garde sa phrase, sa conséquence et son bouton ; plus de cinq manques : « Voir les n autres » (F38) ; une donnée à jour mène à la page où elle se saisit (L3, D-312, F762) |

À l'ordinateur, la page est une grille : la semaine sur toute la largeur ;
« Votre journée » (deux tiers) à côté de « Gel ou chaleur » (un tiers), sauf
sans rien à rattraper ni à faire : la journée est courte et « Gel ou chaleur »
passe dessous, pour ne pas laisser de grand vide (J13, D-141) ;
« Eau de la semaine » à côté de « Réserve du sol » ; « Eau disponible » à
côté de « Fiabilité du calcul ». Au téléphone : une colonne, dans le même
ordre, la frise remplacée par les cartes seules, chaque bouton à 44 px ;
la page peut dépasser deux écrans (T10).

**Réécrit par la simplification, lot S2, PR 5** (`docs/simplification-s2-contract.md`,
sections 8 et 10 ; D-330) : la page a **deux niveaux**, dans le même ordre à
toutes les largeurs. Au premier niveau : l'en-tête (les pastilles quittent le
téléphone, la phrase les redit ; elles restent à l'ordinateur) ; « Votre
journée », sans la frise ; « Gel ou chaleur » seulement pour un jour **en
alerte** (en carte), la prévision qui manque ou le gel sans alerte posée (J14) ;
« La semaine » en **une barre** pour la ferme entière, avec la phrase de
l'objectif de S1, l'eau reçue et ce qui manque, « Voir la semaine » et « Noter
la pluie » (sans objectif : « Aucun objectif posé pour cette semaine. » et
« Poser un objectif ») ; une seule ligne « Calcul approximatif » quand une
donnée manque (la première, son geste, « + n autres ») ; une ligne d'eau
seulement quand une réserve ou une limite le demande. Tout le reste est dans
un seul pli fermé, **« Le détail »**, dont la ligne de résumé compte ce qu'il
contient (« 4 chiffres · 3 jardins · 2 données à rafraîchir ») : les quatre
tuiles de la semaine, « Eau de la semaine », « Réserve du sol », « Eau
disponible », « Fiabilité du calcul », « Gel ou chaleur » en entier et la frise
du jour, chaque bloc avec ses liens, ses boutons et ses réponses. Aucun bloc
n'est retiré. Les ancres existantes (`#today-weather`, `#today-reliability`,
`#today-water`, `#today-week-water`, `#today-soil`…) ouvrent le pli sur leur
bloc, à l'arrivée sur la page comme d'un clic ; une pastille de l'ordinateur
aussi. La règle de ce que garde le premier niveau vit dans
`lib/domain/today/essential.ts`.

### 3.3 Beaucoup de retards

Plus de trois irrigations à rattraper d'un même jour passé (T2) se replient
en **une ligne par jour** : le nombre en grand, le jour (« Hier : 5
irrigations à rattraper »), la plage d'heures et le nombre de planches
(« de 5 h à 20 h, sur 4 planches »), et « Voir les n sur « Arrosages » »
(sur « Planning de la semaine » quand « Arrosages » n'est pas cochée). Les
retards du jour même restent en cartes. L'ordre reste celui de l'heure.

### 3.4 « Tout est fait » (demande du porteur, 8 novembre 2026 à 12 h 50)

Pour l'utilisateur qui a arrosé sans se servir du chrono, un bouton
**« Tout est fait (n) »** en tête de « Votre journée » enregistre d'un coup
les irrigations faites hors du module. Il fait ce que le geste « Fait comme
prévu » du lot 3 (point 6.5 de l'audit) fera pour une ligne, mais pour toutes
à la fois ; les deux reposeront sur une seule fonction du domaine, écrite par
la PR 3 de ce contrat et reprise par le lot 3.

- **Ce qu'il couvre** : les irrigations planifiées « En retard » et « Non
  faite », et celles du jour dont l'heure de début est passée, **une fois
  leur heure de fin prévue passée** (T15). **Jamais** une irrigation dont
  l'heure n'est pas encore venue, ni une proposition « À valider » (elle n'a
  pas été retenue), ni une irrigation déjà démarrée au chrono (elle se
  termine par son propre bouton). Rien à couvrir : pas de bouton.
- **Ce qui est enregistré** : chaque irrigation devient réalisée **telle que
  prévue**, à son heure de début prévue, avec sa durée, son matériel, son
  réglage et sa dose prévus (le volume en découle comme pour une saisie
  « Déjà réalisée »). **Choix du porteur, le 8 novembre 2026** (« Tel que
  prévu »), parce que ce point touche les données réelles qui entrent dans
  l'écart.
- **Garde-fou** : rien n'est enregistré au premier clic. Le bouton ouvre une
  confirmation qui liste ce qui sera enregistré, regroupé par jour (nombre,
  plage d'heures, planches, durée totale, m³ ou mm), chaque ligne cochée ;
  on décoche ce qui n'a pas été fait ; le bouton dit le nombre exact
  (« Enregistrer 21 irrigations ») ; « Annuler » ferme sans rien écrire. La
  confirmation rappelle pourquoi les irrigations à venir n'y sont pas.
- **Après** : un message « n irrigations enregistrées comme faites », sous
  le bouton, en tête de « Votre journée » (`docs/aujourdhui-liens-contract.md`,
  L4, D-313 ; sous sa carte pour « Fait comme prévu », qui se dit « C’est
  fait » sur la carte depuis la simplification S2, PR 3, D-330, la règle, la
  confirmation et la fonction inchangées) ; la page se relit,
  la pastille du menu baisse. L'historique dit chacune
  « Planifiée, faite comme prévu ». Une irrigation enregistrée **ne se
  modifie plus** (D-006, T16) : la confirmation le dit en gras, et c'est
  pourquoi chaque ligne s'y décoche.
- **Règles inchangées** : l'historique est immuable (D-006), une irrigation
  réelle reste toujours enregistrable même sous restriction, son dépassement
  d'une limite ou d'un stock signalé, jamais bloqué ni corrigé (AGENTS.md).
  L'enregistrement est tout ou rien par irrigation : un refus du serveur pour
  l'une est dit avec son nom, les autres restent enregistrées et la liste le
  montre.
- **Tests** : sélection (passé, futur, proposition, démarrée, non faite),
  enregistrement à l'heure et à la dose prévues, isolation par ferme et
  saison, décocher un jour, refus partiel ; parcours navigateur sur une
  ferme propre au parcours, jamais sur la ferme réelle sans le « vas-y » du
  porteur et la remise en l'état.

### 3.5 La phrase de résumé

Elle est composée par le domaine, à partir des blocs présents seulement,
dans cet ordre : les retards, ce qui reste à faire aujourd'hui (« dont k à
valider »), les arrosages de demain à valider, le gel ou l'alerte annoncés
(ou la prévision indisponible), puis les données à rafraîchir. Sans retard,
sans irrigation du jour, sans annonce, **sans rien à valider demain ni eau
qui manque à la semaine** : « Rien d'urgent aujourd'hui. », suivi de la
phrase calme de la météo quand le bloc existe. Une case décochée n'y parle
pas.

**Changé le 15 novembre 2026** (audit ergonomique final, lot A, R1, choix
n° 2 du rapport confirmé par le porteur, D-137 et D-138 ;
`docs/audit-ergonomie-final-lot-a-contract.md`, précisions F274 à F279).
Quand « Planning » est coché, et seulement alors, la page dit aussi ce qui
attend après le jour, lu sur le plan enregistré de la semaine, sans rien
recalculer :

- **l'eau qui manque à la semaine** : un encadré de l'en-tête redit la
  phrase d'action du planning mot pour mot (`shortageAction`), suivie du
  même lien « Répartir l'eau » ou « Revoir la répartition » vers l'écran de
  répartition quand la faisabilité est active ; la pastille orange
  « L'eau manque » se met en tête tant qu'une répartition attend. La phrase
  de résumé ne redit pas le manque ;
- **les arrosages de demain à valider**, de 0 h à minuit le lendemain : la
  pastille « n à valider demain », la phrase « 3 arrosages sont à valider
  demain à 6 h. » après celles du jour, et au pied de « Votre journée » la
  ligne « Demain à 6 h : 3 arrosages à valider », avec « Voir au planning »
  vers la première ;
- la pastille verte « Rien à arroser » ne s'affiche plus tant que l'un des
  deux est dit.

Le bloc « Eau disponible » dit aussi, en orange et en mots, une réserve
dont le volume connu est sous son minimum de sécurité (« sous son minimum
de 2 m³ »).

## 4. Architecture

- `lib/domain/today/` reste l'unique endroit des règles de la page. Le modèle
  de vue gagne, à côté des phrases, les **valeurs à dessiner**, une fonction
  pure par bloc :
  - `day-plan.ts` : la frise du jour et le repli des retards par jour ;
  - `weather-days.ts` : les trois jours, leur échelle commune et ce qui y
    est annoncé ;
  - `water.ts` : le bloc de l'eau (sorti de `today-view.ts`), les cuves et
    les prélèvements limités ;
  - `week.ts` : la semaine de la ferme et de chaque jardin ;
  - `soil.ts` : la réserve du sol par jardin ;
  - `reliability.ts` : en plus, l'état de chaque donnée suivie (l'anneau) ;
  - `headline.ts` : la date, la phrase de résumé et les pastilles.
  Les phrases existantes restent (lecteurs d'écran, téléphone, tests).
- `lib/services/today-service.ts` lit en plus, seulement si la case
  « Objectifs et besoins » est cochée, ce que lit déjà cette page (le
  tableau de l'eau de la semaine et les besoins par planche, sans relire la
  météo), et passe la jauge de la réserve du sol qu'il lisait déjà pour la
  fiabilité. Aucune requête vers Ouvre ta ferme ; aucune nouvelle table,
  aucune migration.
- Les millimètres ne s'additionnent pas entre surfaces : ils se pondèrent
  par la surface, Σ(mm × m²) / Σ(m²) ; une valeur inconnue d'une planche
  laisse le total du jardin et de la ferme inconnu (D-003).
- Les échelles des dessins (5 h à 22 h ; −4 à 20 °C élargie aux valeurs des
  trois jours ; 10 mm au moins, arrondie aux 5 mm au-dessus de la plus
  haute valeur) sont des réglages d'affichage nommés dans le domaine,
  testés, sans nombre magique dans l'interface.
- Les dessins sont du HTML et du CSS (barres, jauges) et de petits SVG
  (anneau, icônes au trait de `line-icon.tsx`), sans bibliothèque nouvelle.
  Chaque dessin porte un texte équivalent pour les lecteurs d'écran.
- Le style suit la charte (polices, couleurs, rayons, ombres) et, une fois
  en ligne, les touches de #294 (pastilles rondes, tuiles à filet, états
  vides illustrés).

## 5. Livraison en trois PR, une à la fois

| PR | Contenu | Preuves |
| --- | --- | --- |
| 1 | Ce contrat et le **domaine** : les valeurs à dessiner, le service qui les lit ; l'écran actuel ne change pas | `tests/aujourdhui-tableau-de-bord.test.ts`, P29 inchangé |
| 2 | Les **écrans** : la page en tableau de bord, le menu détaché et ses groupes, le bouton rond du téléphone | P29 mis à jour, parcours P30 |
| 3 | **« Tout est fait »** : la fonction du domaine, l'action serveur, la confirmation | tests du domaine et de la base, P30 complété |

## 6. Tests et preuves

- Domaine : les valeurs à dessiner pour chaque bloc, les cas vides et
  inconnus (prévision absente, cuve jamais saisie, jardin jamais observé,
  pluie ou objectif inconnus), le repli des retards par jour (3 et 4 le même
  jour, deux jours), la phrase de résumé et ses pastilles, l'anneau (n parts
  = données suivies cochées), les cases décochées.
- Parcours P29 mis à jour (les blocs, leur ordre, les gestes) et un parcours
  nouveau P30 : menu détaché à l'ordinateur et au téléphone, retards
  repliés, page tenant à 390 px sans défilement de côté, « Tout est fait »
  sur une ferme propre au parcours.
- Contrôles complets (lint, typage, tests, build, knip, push:check,
  weather:check, e2e). Captures dans
  `/mnt/project-files/aujourdhui-tableau-de-bord/`.
- Relecture en ligne par le porteur après déploiement.

## 7. Précisions tranchées par l'option recommandée (non agronomiques)

| N° | Précision | Choix |
| --- | --- | --- |
| T1 | Groupes du menu | Arroser, Équiper, Surveiller ; Réglages à part en bas |
| T2 | Seuil de repli des retards | plus de trois le même jour passé |
| T3 | Bornes de la frise | 5 h à 22 h, élargies à l'heure ronde si une irrigation du jour en sort |
| T4 | « Eau de la semaine » | la semaine en cours, du lundi au dimanche (D-004), par jardin, comme « Objectifs et besoins » |
| T5 | Ordre des blocs | celui du 3.2 ; le gel annoncé n'est plus remonté en tête, il est déjà en tête à droite et dans les pastilles ; **au téléphone** (page de 620 px ou moins), « Votre journée » et « Gel ou chaleur » passent juste après l'en-tête, avant les tuiles de la semaine, toujours, à l'écran comme dans l'ordre de lecture ; à l'ordinateur, l'ordre ne change pas (`docs/aujourdhui-liens-contract.md`, L6, D-315, 24 novembre 2026). **Réécrit par S2, PR 5 (D-330)** : l'ordre de la section 8 du contrat S2, le même à toutes les largeurs : l'en-tête, « Votre journée » et « Gel ou chaleur » (alerte seule), « La semaine » en une barre, « Calcul approximatif », la ligne d'eau, puis « Le détail » ; L6 tient |
| T6 | Fiabilité | les données à jour s'affichent, cochées en vert |
| T7 | Réserve du sol | pas de trait de seuil par jardin : les seuils de la réserve sont par planche, un seuil de jardin serait une règle nouvelle ; la planche la plus sèche du jardin est nommée à la place |
| T8 | Icône de la pluie | un jour de 1 mm de pluie prévue ou plus porte la goutte ; le gel prime |
| T9 | Jardins montrés | huit d'emblée dans « Eau de la semaine » et « Réserve du sol », les autres derrière « Voir les n autres jardins ». Depuis le 19 novembre 2026 (audit, lot H, n° 4, F430 à F432, D-174), les huit sont ceux qui comptent : d'abord les jardins qui ont une irrigation aujourd'hui ; puis, pour l'eau, les plus loin de leur objectif, puis ceux sans objectif ; pour le sol, les plus secs, puis les « inconnue », puis « aucune planche cultivée » ; à égalité, l'ordre naturel. Les autres, repliés, dans l'ordre naturel (« bloc 2 » avant « bloc 10 ») |

**Précisions de la PR 2 (les écrans)**, tranchées en codant par la même
consigne :

| N° | Précision | Choix |
| --- | --- | --- |
| T10 | Hauteur au téléphone | la limite de deux écrans de la page du lot 2 (F42) est levée : la maquette validée met tous les blocs en une colonne. La date, la ligne du plan, les pastilles et la phrase du jour tiennent dans le premier écran ; chaque pastille mène à son bloc. **Réécrit par S2, PR 5 (D-330)** : le budget de la section 8 du contrat S2, à 390 px, pour une proposition à valider : le premier niveau au plus 1 600 px, le bouton principal de la première carte à moins de 600 px du haut, au plus 12 choses à toucher ; P62 le mesure |
| T11 | « Recalculer » dans l'en-tête | quand le plan existe, un lien-geste « Recalculer » (nommé « Recalculer le plan ») suit la ligne du plan : la même action que le bouton de la fiabilité ; sans plan, la ligne mène au planning comme avant |
| T12 | Phrases des blocs dessinés | les phrases de « Gel ou chaleur » (quand une alerte est dessinée) et d'« Eau disponible » restent dans la page pour un lecteur d'écran, cachées à l'œil ; la phrase calme ou le manque de prévision restent visibles. Depuis S2, PR 5 (D-330), cela tient dans « Le détail » ; au premier niveau, « Gel ou chaleur » dit le jour en alerte par sa carte et la prévision qui manque en clair |
| T13 | Fiabilité | un manque montré dit sa propre phrase sous le nom de la donnée ; le résumé (« 5 jours manquants : … ») ne reste que pour une donnée à jour ou dont les lignes sont repliées |
| T14 | Menu de la tablette | entre 600 et 980 px, la bande du bas garde une seule rangée de pilules : « Aujourd'hui » y garde sa pastille ronde, les titres des groupes s'effacent |

**Précisions de la PR 3 (« Tout est fait »)**, tranchées en codant par la
même consigne :

| N° | Précision | Choix |
| --- | --- | --- |
| T15 | Irrigation commencée, pas encore finie | elle n'est pas couverte tant que son heure de fin prévue n'est pas passée : enregistrée « telle que prévue », elle finirait dans le futur, ce que la saisie « Déjà réalisée » refuse déjà. La confirmation la nomme (« Pas encore finie : …, jusqu'à 18 h 30 ») ; elle y entre après sa fin. « En retard » et « Non faite » restent couvertes dès que leur créneau est fini |
| T16 | Corriger après coup | le texte d'origine renvoyait à un chemin de correction sur « Arrosages » qui n'existe pas : une irrigation réalisée ne se modifie pas (D-006). La phrase est corrigée ; la confirmation, qui liste tout et se décoche, reste le garde-fou |
| T17 | Ce que retient l'historique | le journal de l'irrigation porte « faite comme prévu » ; le mode de création se lit « Planifiée, faite comme prévu » et la chronologie « Faite comme prévu », à l'heure de fin prévue |
| T18 | Au téléphone | la confirmation garde ses boutons en vue au pied, « Enregistrer n irrigations » au-dessus d'« Annuler » ; le bouton « Tout est fait » prend toute la largeur sous le titre de « Votre journée » |

**Retour du porteur après la mise en ligne** (8 novembre 2026, « ça veut
dire quoi les carrés rouges ? ») :

| N° | Précision | Choix |
| --- | --- | --- |
| T19 | Légende de la frise | elle oubliait « Non faite », la barre rouge d'une irrigation dont tout le créneau est passé sans démarrage. Elle dit désormais chaque couleur présente sur la frise du jour, et seulement celles-là, avec le statut des cartes (« Non faite », « En retard », « Planifiée », « À valider ») ; « Déjà passé » s'y ajoute quand l'heure actuelle est sur la frise |

**Audit ergonomique du 19 novembre 2026, lot H** (D-175), compris dans
le choix du porteur du 19 novembre 2026 à 11 h 39 :

| N° | Précision | Choix |
| --- | --- | --- |
| T20 | En cours et reliquat | la page connaissait quatre états (non faite, en retard, planifiée, à valider) ; elle en lit deux de plus, en tête de « Votre journée » : l'irrigation en cours (en pause, ou durée atteinte) et le reliquat à reprendre, comme les lit « Arrosages ». L'arrêt garde son geste et sa confirmation sur « Arrosages » (D-028) ; « Reprendre le reliquat » est le même geste que là-bas. « Tout est fait » ne les coche jamais (T15) |

## 8. Risques

- La page lit davantage de données : le temps d'affichage est regardé sur la
  ferme de démonstration avant et après ; s'il double, les blocs de la
  semaine se chargent après la page.
- La refonte du menu touche toutes les pages : les parcours qui comptent les
  entrées du menu (P14, P23, P27, P28) sont relus par la PR 2.
- #294 (style) touche les mêmes feuilles que la PR 2 : la seconde des deux à
  passer se rebase.
