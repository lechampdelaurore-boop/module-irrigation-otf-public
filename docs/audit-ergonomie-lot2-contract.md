# Contrat — audit ergonomique, lot 2 : téléphone, « Aujourd'hui » et « Fiabilité du calcul » (3.8 quater)

Écrit le 8 novembre 2026, avant tout code, en Sonnet 5.5 · Moyen (grille du travail sans code, AGENTS.md, « Économie de jetons ») ; le code se fait en **Opus 5.5 · Très élevé** (ligne 3.8 quater de la roadmap, lots 2 et 3). Il couvre les points **2, 1 et 3** du rapport `/mnt/project-files/audit-ergonomie/audit-ergonomie-module-2026-11-07.md`, que le porteur a retenus et voulus en entier (D-069). **Mandat du porteur, 7 novembre 2026, 22 h 18** : « Cette nuit, je veux que tu enchaînes les chantiers en autonomie. » Chaque précision non agronomique (F1 à F14, section 9) est donc tranchée par l'option recommandée et consignée (D-073) ; elles restent modifiables à sa relecture en ligne. **Aucune question agronomique n'est réservée au porteur** : aucune règle de calcul ne change, et les seuils de la zone « Fiabilité » (F8) ne touchent que l'affichage. Rien n'est codé.

Le logiciel est **multi-fermes** : chaque bloc se construit à partir des fonctionnalités cochées (3.8, D-067) ; rien n'est propre à la ferme du porteur. Les chiffres de l'audit (132 planches, 33 jours, six abris) sont des exemples tirés de sa ferme, pas des règles.

## 1. Objet

1. **Point 2 — le téléphone.** Faire monter l'écran utile, et rendre toutes les pages atteignables sans geste caché.
2. **Point 1 — une page « Aujourd'hui »**, entrée du module : ce qu'il y a à faire, ce qui est en retard, le gel ou la chaleur des trois prochains jours, l'eau disponible, en réponse à la question du matin, en cinq secondes.
3. **Point 3 — une zone « Fiabilité du calcul »** : les données périmées ou manquantes qui rendent le plan douteux, dites dans les mêmes mots, chacune avec le geste qui la corrige, placée sur « Aujourd'hui ».

## 2. Ce qui ne change pas

- **Aucun calcul ne change** : ni le moteur, ni la pompe, ni la réserve, ni la pénurie, ni les alertes (qui, chaque jour, produisent ce qu'elles produisent déjà). Le lot 2 **lit** ce qui existe et le range autrement.
- Une donnée inconnue reste `null`, jamais zéro (D-003) ; les dates métier sont en `Europe/Paris` (D-004). « Aujourd'hui » est le jour calendaire de `Europe/Paris`.
- Le logiciel **n'annule ni ne démarre jamais seul** (D-028) : les boutons de la page « Aujourd'hui » reprennent les actions existantes, avec leurs confirmations.
- **Rien n'est lu d'Ouvre ta ferme de plus** qu'aujourd'hui (OTF en lecture seule, 4 requêtes par seconde au plus) ; aucune migration prévue (la migration 0031 reste libre).
- Les onze pages, leurs adresses et leurs contenus actuels restent. Les avertissements propres à une page restent sur elle (F9) ; aucun n'est supprimé sans équivalent.
- La mise en page de la **version ordinateur** ne change pas, sauf l'entrée « Aujourd'hui » du menu et sa page.
- Les textes d'aide (« ? ») et les bulles de la 3.8 existent pour la page « Aujourd'hui » comme pour les autres (même mécanisme).

## 3. Livraison en trois PR, une à la fois

| PR | Contenu | Parcours |
| --- | --- | --- |
| 1 | **Téléphone** (point 2) : barre du bas, saison, bandeau d'alertes système, tuiles, planning replié | P28 |
| 2 | **Domaine « Fiabilité » et « Aujourd'hui »** : fonctions pures sans écran (`lib/domain/today/`), données lues par un service | — (tests) |
| 3 | **Écrans** : page « Aujourd'hui », zone « Fiabilité », pastille du menu, entrée du module | P29 |

Chaque PR met les registres à jour ; la PR 1 consigne le déploiement de la PR du contrat. Le parcours de la PR 1 se déroule à 390 px et à l'ordinateur ; celui de la PR 3 aux deux largeurs aussi. Avant la PR 1, l'état de départ est **mesuré de nouveau à 390 px** sur la ferme de démonstration (hauteur de chaque page longue, position du premier champ), parce que l'audit a été fait avant la deuxième passe (#279) : on ne refait que ce qui reste.

## 4. Point 2 — le téléphone (largeur ≤ 600 px, PR 1)

1. **Barre du bas : quatre entrées et « Plus » (F6).** Quatre entrées prises, dans cet ordre de priorité, parmi les pages de la ferme : Aujourd'hui, Arrosages, Planning de la semaine, Ressources et pompes. Les pages absentes (case décochée) laissent la place à la suivante de la liste complète du menu. « Plus » ouvre une feuille avec **toutes** les pages du menu, Réglages comprise, chacune ≥ 44 px ; il porte la pastille verte quand la page courante n'est pas dans la barre. Une ferme dont le menu compte cinq pages ou moins les montre toutes, sans « Plus ». Le menu de l'ordinateur ne change pas. `FeatureMenu` sert aussi à la page introuvable : les deux gardent le même menu (même composant, un seul test de rendu pour les deux).
2. **Ligne d'état** : déjà faite par la deuxième passe (D-068) ; à vérifier à la mesure, rien à refaire.
3. **Saison (F7)** : sur téléphone, le choix de la saison passe **dans la ligne du titre**, à côté du « ? », en un petit menu de 44 px de haut, au lieu d'un bloc « Saison » sous le titre. Il suit les règles de la 3.8 quater lot 1 (`pageUsesSeason`).
4. **Bandeau « Alertes système non disponibles » (F10)** : après un premier affichage, il se replie en une pastille dans la barre du haut (la cloche existante prend un point) ; le rappel complet reste dans Réglages, au bloc des notifications. L'état « vu » est gardé **sur l'appareil** (stockage du navigateur, illisible = bandeau affiché), pas en base. Il revient si l'état change (par exemple du « limité » au « refusé »).
5. **Tuiles en deux colonnes** (charte, « Totaux en tuiles pâles… grille de 2 colonnes sur téléphone »).
6. **Planning de la semaine (F11)** : au téléphone, les six tuiles de totaux tiennent en **une ligne de résumé** (dépliable) ; le jour du jour est ouvert ; les jours écoulés sont repliés sous « Jours écoulés (n) » ; les jours à venir sont repliés avec leur nombre de propositions. Le jour à venir le plus proche reste ouvert quand aujourd'hui n'a rien. Un jour contenant une proposition « En retard » ou « Non faite » ne se replie jamais (rien ne se cache derrière un repli).
7. **Objectifs de mesure** (à constater avant la PR, puis à tenir) : sur « Arrosages », le premier champ de saisie dans le premier écran de 844 px ; le planning par défaut ≤ 8 écrans (contre environ 37) ; aucune page n'a de défilement horizontal ; chaque cible ≥ 44 px (les « ? » et les pastilles de l'audit qui font moins sont portés à 44 px dans la PR 1, avec le point 14 du lot 3 pour le reste).
8. **Charte** : `docs/charte-module.md` (point « barre du bas ») est modifiée dans la PR 1 pour dire « quatre entrées et Plus » ; la deuxième bande d'univers d'Ouvre ta ferme n'est pas construite dans le module (l'en-tête d'Ouvre ta ferme la coiffe).

## 5. Point 1 — la page « Aujourd'hui » (PR 2 et 3)

**Place et existence (F1).** Une page de plein droit, **sans case propre** (comme « Réglages »), adresse `/irrigation/aujourdhui`, **première du menu** et page d'arrivée de `/irrigation`. Elle existe quand au moins l'une de ces cases est cochée : Arrosages, Planning de la semaine, Objectifs et besoins, Réserve du sol, Besoin par culture, Ressources et pompes, Alertes météo, Alertes cultures ; une ferme qui n'a coché que Matériel, Calculateur ou Historique arrive, comme avant, sur sa première page cochée. L'adresse `/irrigation/aujourdhui` d'une ferme où elle n'existe pas se comporte comme une page non cochée (la première page cochée, avec la ligne qui le dit, P14). La page introuvable « Revenir à… » (lot 1, E2) pointe sur « Aujourd'hui » quand elle existe. `pageUsesSeason` la classe : **la saison n'y est pas proposée** (F2) ; elle montre toujours le jour du jour, de la saison courante, et la saison reste dans l'adresse pour les liens qui en sortent.

**Blocs, dans cet ordre, chacun présent seulement si sa fonctionnalité est cochée (F3).** Un bloc sans rien à dire écrit une phrase calme (« Rien à faire aujourd'hui. ») ; il n'est caché que par une case décochée, jamais parce qu'il est vide.

| Bloc | Cases requises | Contenu |
| --- | --- | --- |
| a. Gel ou chaleur | Alertes cultures et/ou Alertes météo | les **trois prochains jours** (aujourd'hui compris) ; lit les mêmes prévisions et seuils que les alertes (aucun seuil nouveau) : la température minimale la plus basse prévue, la date, les cultures qui descendent sous leur seuil (nombre et trois premiers noms, « et 2 autres ») avec « Voir les alertes » ; s'il n'y a que les alertes météo, les alertes de l'exploitation qui se déclencheraient dans les trois jours ; sinon « Pas de gel ni de chaleur annoncés d'ici le <jour> » ; prévision indisponible : « Prévision indisponible : à vérifier » (jamais « tout va bien » sur une donnée inconnue) |
| b. En retard | Planning ou Arrosages | les irrigations « En retard » et « Non faite » (R14, 3.7) avec leur planche, matériel et heure prévue, et les boutons **existants** « Démarrer maintenant » ou « Ouvrir » vers sa carte ; rien n'est annulé de soi |
| c. À faire aujourd'hui | Planning ou Arrosages | les irrigations planifiées ou validées **du jour** et les propositions du jour **à valider**, par heure de début ; « Démarrer maintenant » (existant) et « Ouvrir » ; chaque ligne dit planche, matériel, durée, millimètres |
| d. Eau disponible | Ressources et pompes | une ligne par ressource suivie : volume actuel, date de la dernière observation, et, pour un prélèvement limité, la part restante de la période ; la date est écrite (« observé le 5 oct. 2026 ») |
| e. Fiabilité du calcul | au moins une donnée suivie (section 6) | voir la section 6 |

Précisions :

- **Pas de « Fait » en un geste ici (F4).** Le geste « Fait comme prévu » est le point 6 (lot 3, idée n° 1) ; il s'ajoutera aux blocs b et c quand il existera. Au lot 2, une irrigation « à saisir comme faite » se fait par « Ouvrir » (la carte avec « Déjà réalisée »).
- **Un clic de plus que la carte, pas deux** : chaque ligne ouvre la carte de l'irrigation dans « Arrosages » ou « Planning » à l'ancre de la carte ; la page « Aujourd'hui » ne duplique pas les formulaires.
- **Ordre fixe** : le gel d'abord si une alerte est active (barre rouge de la charte), sinon l'ordre du tableau. Les blocs vides se replient en une ligne pour garder la page courte (≤ 2 écrans au téléphone sur la ferme de test).
- **Dernière mise à jour** : la page dit en une ligne quand le plan a été calculé (« Plan calculé aujourd'hui à 06 h 02 ») ; plan absent : « Plan non calculé : ouvrir le planning » (lien).
- La page ne contient ni formulaire de saisie ni calcul : elle lit un modèle de vue construit côté serveur (`lib/domain/today/`).
- Les notifications existantes (calcul du matin, retard, gel) ne changent pas ; « Aujourd'hui » en est la version écran, sans en créer de nouvelle (idée n° 3 des améliorations, qui cesse d'être mise de côté).

## 6. Point 3 — la zone « Fiabilité du calcul » (PR 2 et 3)

**Principe (F5).** Une liste **fermée** de données dont l'état dégrade le plan, calculée par **une seule fonction** (`lib/domain/today/reliability.ts`) qui dit pour chacune : si elle est à rafraîchir, la phrase, la conséquence en clair, et le lien-geste. Chaque page qui signale aujourd'hui l'un de ces manques **garde son avertissement mais le lit dans cette fonction** (mêmes mots partout, F9).

| Donnée | Case requise | À rafraîchir quand… (F8) | Phrase | Geste (bouton) |
| --- | --- | --- | --- | --- |
| Volume de la réserve ou de la cuve | Ressources et pompes | la dernière observation date de **plus de 7 jours**, ou n'existe pas | « Le volume de <ressource> date du <date> (n jours). Le plan s'en sert pour ne pas tirer plus qu'il n'y a. » | « Saisir le volume de <ressource> » → le formulaire de la ressource |
| Pluie mesurée | Objectifs et besoins | au moins **un jour sans pluie réelle dans les 7 derniers jours** | « Pluie réelle incomplète : n jours manquants. Sans elle, le besoin est surévalué. » (le sens est écrit : surévalué si la pluie est inconnue) | « Noter la pluie de la semaine » → bloc « Pluie mesurée » |
| Réserve du sol | Réserve du sol | des zones sont **« inconnue »** | « Le sol de <n> zones n'a jamais été observé. » (trois noms, puis « et n autres ») | « Observer le sol de <zone> » → la jauge de la zone (point 13 du lot 3 en fera un bouton par ligne ; le lot 2 mène à la page) |
| Espèces sans référence | Besoin par culture | des espèces plantées sont **« Sans référence Kc »** | « n espèces sans référence : leur besoin n'est pas calculé, seul l'objectif compte. » | « Rattacher les espèces » → Réglages, correspondance des espèces (le tri des non rattachées d'abord est le point 12 du lot 3) |
| Plan non calculé | Planning | aucun calcul de la semaine, ou plus vieux que **48 h** | « Le plan n'a pas été recalculé depuis le <date>. » | « Recalculer le plan » (existant) |

- **Cinq lignes au plus affichées**, les autres derrière « Voir les n autres ». Ordre : par effet sur le plan, dans l'ordre du tableau. Chaque ligne est un bouton ≥ 44 px.
- **Aucune ligne si tout est à jour** : « Rien à rafraîchir : le plan s'appuie sur des données récentes. » La zone ne sort jamais d'une case décochée ; elle ne compte pas une donnée dont la fonctionnalité n'est pas cochée.
- **Jamais de seuil caché** : chaque seuil (7 jours, 48 h) est écrit dans la phrase du « ? » de la zone. Les seuils sont des **réglages d'affichage du module**, non agronomiques, modifiables à la relecture du porteur ; aucun ne touche le moteur.
- **Pastille du menu (F12).** Le menu (et la barre du bas) affiche sur « Aujourd'hui » un petit nombre : le nombre de lignes de fiabilité + des irrigations en retard ou non faites. Zéro : pas de pastille. Elle prend la couleur de la charte pour « à regarder », jamais celle d'une alarme.
- **Le reste des avertissements ambrés (F9).** Aucun avertissement d'une page n'est supprimé ; ceux qui disent la même chose que la zone sont remplacés par **une ligne d'une phrase avec la pastille de la zone** et un lien « Voir sur Aujourd'hui » ; ceux qui concernent la page seule (pluie incomplète sur le tableau des besoins) restent en place, mais dans les mots de la fonction. La liste précise des avertissements touchés se fait en lisant le code au début de la PR 3 et se consigne dans le bloc de la roadmap.
- **« Non vérifié 0 »** (audit) n'est pas une donnée à rafraîchir : il s'écrit « Non vérifié : aucune » en mots, sur sa page, rien d'autre.

## 7. Cas chiffrés (la preuve de fin les met en tests)

Sur la ferme de test du planning (aspersion, goutte-à-goutte, cuve, trois jardins), aujourd'hui = jeudi 12 novembre 2026, 06 h 00 :

| Cas | Entrée | Attendu |
| --- | --- | --- |
| 1 | cases : toutes ; barre du bas au téléphone | quatre entrées (Aujourd'hui, Arrosages, Planning, Ressources) et « Plus » listant les douze pages |
| 2 | cases : Arrosages et Historique | le menu compte quatre pages (Aujourd'hui, Arrosages, Historique, Réglages) : aucune entrée « Plus », les quatre entrées |
| 3 | la page courante est « Sol », toutes cases | « Plus » porte la pastille verte |
| 4 | aucune case d'« Aujourd'hui » (Matériel et Calculateur seuls) | pas d'entrée « Aujourd'hui » ; `/irrigation` va à Matériel ; `/irrigation/aujourdhui` : la première page cochée avec sa ligne |
| 5 | gel prévu 1,2 °C le samedi 14, deux cultures sous leur seuil | bloc a : « Gel annoncé le sam. 14 nov. : 1,2 °C. 2 cultures : Laitue, Fenouil. » + lien ; barre rouge |
| 6 | prévision indisponible (aucune ligne lue) | bloc a : « Prévision indisponible : à vérifier » (jamais « pas de gel ») |
| 7 | trois irrigations « Non faite » hier et une « En retard » ce matin | bloc b : quatre lignes, chacune avec « Ouvrir » ; aucune annulation ; la pastille du menu les compte |
| 8 | deux irrigations validées aujourd'hui à 07 h et 18 h, une proposition à valider à 20 h | bloc c : trois lignes dans l'ordre horaire ; « Démarrer maintenant » seulement pour les validées |
| 9 | aucune irrigation ni proposition aujourd'hui | bloc c : « Rien à faire aujourd'hui. » |
| 10 | cuve observée le 5 oct. 2026, aujourd'hui = 12 nov. | bloc d : « observé le 5 oct. 2026 (38 jours) » ; fiabilité : ligne « Saisir le volume de la cuve » |
| 11 | cuve observée il y a 7 jours exactement | pas de ligne (le seuil est « plus de 7 jours ») ; à 8 jours : la ligne |
| 12 | pluie réelle manquante 5 jours sur les 7 derniers | ligne « Pluie réelle incomplète : 5 jours manquants » ; bouton → bloc « Pluie mesurée » |
| 13 | sol : trois zones « inconnue », cinq au total | ligne « Le sol de 3 zones n'a jamais été observé » avec les noms ; zones observées non comptées |
| 14 | Réserve du sol décochée | aucune ligne sur le sol ; la zone ne montre rien à son sujet |
| 15 | six manques à la fois | cinq lignes + « Voir les 1 autres » ; pastille = 6 plus les retards |
| 16 | tout est à jour, aucun retard | « Rien à rafraîchir… » ; pas de pastille ; page ≤ 2 écrans à 390 px |
| 17 | planning : jour du jour ouvert, cinq jours écoulés, 3 propositions « En retard » dans un jour écoulé | à 390 px : « Jours écoulés (5) » replié, mais le jour contenant le retard est ouvert |
| 18 | bandeau « Alertes système non disponibles » vu une fois | réduit à un point sur la cloche ; le bloc des notifications de Réglages le dit en entier |
| 19 | stockage du navigateur illisible | bandeau toujours affiché, aucune erreur |
| 20 | autre utilisateur, autre ferme | aucune ligne, aucun nom, aucun volume d'un autre (isolation, comme `tests/db`) |

## 8. Architecture, tests et preuves

- **Domaine** : `lib/domain/today/` (`reliability.ts`, `today-view.ts`, fonctions pures qui ne dépendent que de `lib/domain/`) ; **service** `lib/services/today-service.ts` qui rassemble les lectures existantes (planning, irrigations, prévisions, ressources, réserve du sol, correspondance) sans nouvelle requête vers OTF ; **écran** `app/irrigation/aujourdhui/` (composant serveur de page, comme les autres) ; la barre du bas reste un composant client dans `app/irrigation/shell/`. Frontières et taille des fichiers (600 lignes) comme partout ; aucun nombre magique d'unité (`units.ts`).
- **Tests** : les vingt cas ci-dessus en tests du domaine et du service (le cas 20 en test de base, comme l'isolation existante) ; un test de rendu pour la barre du bas et la page introuvable ; la liste fermée des cinq données testée (une donnée ajoutée demande une ligne du tableau).
- **Parcours** : P28 (téléphone : barre du bas, « Plus », saison, bandeau, planning replié, cibles ≥ 44 px, à 390 px et sur ordinateur) ; P29 (« Aujourd'hui » : les cinq blocs sur la ferme de démonstration, le bloc gel avec une prévision fabriquée en test, un manque de fiabilité corrigé par son bouton, la ligne qui disparaît ensuite). Les données fabriquées sont remises en l'état.
- **Preuve de fin** : tests verts, `pnpm lint`, `typecheck`, `test`, `build`, `knip`, `push:check`, `weather:check`, `e2e` collés dans chaque PR ; recette à 390 px sur la version déployée ; mesures avant et après de la section 3 collées dans la PR 1 ; relecture du porteur en ligne.
- **Non vérifié par le lot** (à dire dans les PR) : l'affichage sur la ferme réelle de 190 périmètres, le lecteur d'écran, le mode sombre, le contraste mesuré (point 14 du lot 3).

## 9. Précisions tranchées (D-073), toutes modifiables à la relecture du porteur

| N° | Précision | Choix retenu (recommandé) |
| --- | --- | --- |
| F1 | Statut de « Aujourd'hui » | page sans case, première du menu et page d'arrivée, présente quand une des huit cases utiles est cochée |
| F2 | Saison sur « Aujourd'hui » | non proposée ; la page montre le jour du jour |
| F3 | Blocs vides | une phrase calme, jamais cachés sauf case décochée |
| F4 | « Fait » en un geste | reporté au lot 3 (point 6) ; « Ouvrir » vers la carte au lot 2 |
| F5 | Fiabilité | liste fermée de cinq données, une fonction unique, mêmes mots partout |
| F6 | Barre du bas | quatre entrées (Aujourd'hui, Arrosages, Planning, Ressources) et « Plus » ; cinq pages ou moins : toutes |
| F7 | Saison au téléphone | petit menu dans la ligne du titre, à côté du « ? » |
| F8 | Seuils d'affichage | 7 jours (volume), 7 jours (pluie), 48 h (plan) ; réglages d'affichage non agronomiques |
| F9 | Avertissements des pages | aucun supprimé sans équivalent ; ceux qui doublent la zone deviennent une ligne qui y renvoie |
| F10 | Bandeau « alertes système » | se replie en point sur la cloche après un affichage ; état gardé sur l'appareil ; rappel dans Réglages |
| F11 | Planning au téléphone | résumé en une ligne, jour du jour ouvert, jours écoulés repliés, jamais un jour portant un retard |
| F12 | Pastille du menu | nombre de lignes de fiabilité plus irrigations en retard, couleur de la charte « à regarder » |
| F13 | Migration | aucune ; 0031 reste libre ; l'état « vu » du bandeau est sur l'appareil |
| F14 | Ordre des PR | téléphone, puis domaine, puis écrans (trois PR, une à la fois, chacune après le déploiement vérifié de la précédente) |

### Précisions de la PR 1 (le téléphone), tranchées en codant (D-073)

Le code de la PR 1 a demandé huit précisions de plus, non agronomiques, tranchées par l'option recommandée sous le même mandat ; elles restent modifiables à la relecture du porteur.

| N° | Précision | Choix retenu (recommandé) |
| --- | --- | --- |
| F15 | Largeur de la barre du bas | jusqu'à 600 px ; entre 601 et 980 px (tablette), la bande de pages qui défile reste |
| F16 | Nom sous l'icône | un nom court quand le nom entier ne tient pas : Planning, Besoins, Sol, Cultures, Matériel, Ressources, Historique ; le nom entier reste le nom du lien pour un lecteur d'écran |
| F17 | « Aujourd'hui » avant sa page | tant que la page n'existe pas (PR 3), sa place va à la page suivante du menu : « Objectifs et besoins » sur une ferme qui a tout coché |
| F18 | Ce qui compte comme « en retard » dans le planning | une irrigation validée, toujours planifiée, dont l'heure de début est passée (« En retard » ou « Non faite » sur la page des arrosages) ; son jour reste ouvert, et « Jours écoulés (n) » ne compte que les jours qu'il range |
| F19 | « Aujourd'hui n'a rien » | aucune proposition à valider ni validée non annulée ; le jour à venir le plus proche **qui a des propositions** reste alors ouvert |
| F20 | Un jour replié | il garde son en-tête (jour, comptes, volume, « Tout valider (n) ») ; « Voir les créneaux (n) » le déplie, « Replier le jour » le replie ; la ligne de résumé dit les propositions, les validées, le volume, puis le manque d'eau, le pompage manquant, les planches non servies et le non vérifié quand ils comptent |
| F21 | Le bandeau replié | seulement sur la page des arrosages, au téléphone ; à l'ordinateur et dans Réglages, il reste entier ; le point de la cloche paraît sur toutes les pages dès que l'appareil a vu l'état limité, et s'efface quand les alertes deviennent possibles |
| F22 | Cibles portées à 44 px dans la PR 1 | les pastilles d'aide « i » (d'où vient ce chiffre, besoins, faisabilité) et « Actualiser » ; le reste de la mesure (champs de 38 à 40 px, segments de période de l'historique, « Saisir la pluie », plis, boutons d'archive et de suppression du matériel, cloche et initiale qui tiennent leurs 44 px par une zone invisible) va au point 14 du lot 3 |

Le « test de rendu » de la barre du bas et de la page introuvable (section 8) se fait dans le parcours P28 : les tests du dépôt tournent sous Node sans rendu de composant ; P28 lit la même barre et le même menu sur une page et sur la page introuvable.

### Précisions de la PR 2 (le domaine « Aujourd'hui » et « Fiabilité »), tranchées en codant (D-073)

Le domaine de la PR 2 (`lib/domain/today/`, `lib/services/today-service.ts`) a demandé huit précisions de plus, non agronomiques, tranchées par l'option recommandée sous le même mandat ; elles restent modifiables à la relecture du porteur. Aucune ne touche un calcul.

| N° | Précision | Choix retenu (recommandé) |
| --- | --- | --- |
| F23 | Volume d'une réserve jamais saisi | une ligne aussi : « Le volume de <réserve> n'a jamais été saisi. » ; une ligne par réserve ou cuve **active** ; le bloc « Eau disponible » dit « volume jamais saisi » |
| F24 | Les jours de la pluie réelle | les sept jours avant aujourd'hui (J−7 à J−1, aujourd'hui pas encore fini) ; un jour compte quand la pluie saisie ou la réanalyse le donne ; une ferme dont toutes les planches de la saison sont sous abri n'a pas de ligne (la pluie y vaut zéro, D-032) |
| F25 | Le « sol d'une zone » | se lit par jardin ou abri, là où la jauge et l'observation valent : un jardin compte quand ni lui ni sa parcelle (en plein champ) n'ont été observés et qu'aucune de ses planches n'est connue ; un jardin observé mais inconnu depuis un jour de pluie manquante ne compte pas, la ligne de la pluie le dit ; la phrase dit « jardins » (« Le sol de 3 jardins n'a jamais été observé : … ») |
| F26 | Les espèces « sans référence » | celles des séries de la saison posées sur des planches qui n'ont **aucun rattachement** ; une espèce rattachée exprès à « Sans référence Kc » est un choix fait, pas une donnée à rafraîchir ; une espèce : « 1 espèce sans référence : son besoin… » |
| F27 | Plan jamais calculé, ligne cachée seule | « Le plan de la semaine n'a pas été calculé. » avec « Recalculer le plan » ; une seule ligne derrière le pli : « Voir l'autre » (« Voir les n autres » au-delà) |
| F28 | Le bloc « Gel ou chaleur » | une ligne pour le gel des cultures : la minimale la plus basse des trois jours, son jour et toutes les cultures touchées sur les trois jours ; avec « Alertes météo », chaque critère de l'exploitation qui se déclencherait dans les trois jours ajoute sa ligne, même déjà notifié (les deux quand les deux cases sont cochées) ; la phrase calme ne dit que ce qui a été regardé (« Pas de gel annoncé pour vos cultures… », « Aucune de vos alertes météo ne se déclenche… ») ; un jour sans prévision s'écrit « Prévision indisponible le <jour> : à vérifier » |
| F29 | Les blocs « En retard » et « À faire » | ils lisent les irrigations de la saison comme la page des arrosages, avec la tolérance R14 ; « En retard » et « Non faite » de tout jour, les plus anciennes d'abord ; « À faire » : les irrigations planifiées du jour pas encore en retard et les propositions du jour encore à valider, par heure ; une irrigation en cours n'y est pas ; la carte s'ouvre sur « Arrosages », ou sur le planning quand « Arrosages » n'est pas cochée |
| F30 | Le bloc « Eau disponible » | chaque réserve active (volume sur capacité, date d'observation et nombre de jours) et chaque ressource dont une limite journalière vaut aujourd'hui (ce qui reste à prélever, la limite, ce qui a déjà été prélevé) ; rien de suivi : « Aucune réserve ni ressource limitée suivie. » |

### Précisions de la PR 3 (les écrans), tranchées en codant (D-073)

Les écrans de la PR 3 (la page `app/irrigation/aujourdhui/`, la zone « Fiabilité du calcul », la pastille du menu, l'entrée du module) ont demandé douze précisions de plus, non agronomiques, tranchées par l'option recommandée sous le même mandat ; elles restent modifiables à la relecture du porteur. Aucune ne touche un calcul.

| N° | Précision | Choix retenu (recommandé) |
| --- | --- | --- |
| F31 | La page d'arrivée | « Aujourd'hui » quand elle existe, sinon la première page cochée (Matériel, Calculateur ou Historique seuls : comme avant) ; elle vaut pour `/irrigation`, pour une page non cochée et une ancienne adresse (avec la ligne qui le dit), pour « Continuer » au premier choix des cases, pour l'écran de bienvenue déjà passé et pour « Revenir à… » de la page introuvable |
| F32 | La saison sur « Aujourd'hui » | la page lit toujours la saison du jour (l'année du jour à Paris) ; la saison de l'adresse est gardée pour les liens du menu, qui ramènent à la saison choisie ailleurs ; les liens du contenu (cartes, planning, ressources, sol, alertes) portent la saison du jour ; quand Ouvre ta ferme n'a pas encore la saison du jour (un 1er janvier), l'écran « saison indisponible » renvoie à la première page cochée, qui propose les saisons |
| F33 | La pastille hors d'« Aujourd'hui » | sur « Aujourd'hui », la page la compte ; sur les autres pages, elle est lue après l'affichage, dans les données d'Ouvre ta ferme déjà gardées seulement (jamais une requête vers Ouvre ta ferme ; la météo n'est pas relue, elle ne compte pas dans la pastille) ; rien en cas d'erreur ni avant le premier choix des cases ; le nombre est dit dans le nom du lien (« Aujourd’hui, 3 à regarder ») ; couleur ambrée de la charte (`--warn`), jamais le rouge |
| F34 | « Voir les alertes » du bloc « Gel ou chaleur » | mène à la page de ce qui est annoncé : le gel des cultures à « Alertes cultures », les seules alertes de l'exploitation à « Alertes météo » ; bloc calme : « Alertes cultures » quand elle est cochée, sinon « Alertes météo » |
| F35 | La météo de la page | une météo périmée est relue avant la page, comme sur les pages qui la lisent déjà : le gel des trois jours et la pluie réelle ne se lisent jamais d'une météo d'hier |
| F36 | Après un bouton | après « Démarrer maintenant » ou « Recalculer le plan », la page relit son modèle et la pastille de tous les menus se met à jour ; après un départ, le message offre « Suivre sur « Arrosages » » ; un refus s'écrit en rouge avec le message du serveur |
| F37 | Les gestes de la zone | chacun mène à la carte même, à un clic : la réserve sur « Ressources et pompes », le jardin sur « Réserve du sol » (déplié et amené à l'écran), la proposition sur le planning, l'irrigation sur « Arrosages », la pluie au bloc « Pluie mesurée », les espèces à la correspondance de Réglages |
| F38 | Le pli de la zone | « Voir les n autres » devient « Voir moins » une fois ouvert, et replie |
| F39 | « Démarrer maintenant » sur un retard | une irrigation en retard encore planifiée garde le bouton existant, comme sur « Arrosages » ; une « Non faite » et une proposition n'ont que « Ouvrir » ; rien ne démarre seul (D-028) |
| F40 | Le gel annoncé | la barre rouge de la charte (`--danger`) sur le bord gauche du bloc ; une prévision indisponible en ambre ; un bloc calme sans barre |
| F41 | Les avertissements des pages (F9) | lus dans le code au début de la PR 3 : seul l'avertissement « pluie réelle incomplète » du tableau des besoins dit la même chose qu'une ligne de la zone ; il concerne la page seule et reste en place, avec la conséquence de la fonction (« Sans elle, le besoin est surévalué. ») ; aucun n'est remplacé par « Voir sur Aujourd'hui », faute de doublon : le planning sans calcul, « Non renseigné » des ressources, le sol « inconnue » et la liste « sans référence Kc » de Réglages sont des états de leur page, pas des avertissements |
| F42 | Au téléphone | une colonne, les boutons sous le texte de la ligne, chaque bouton et lien à 44 px ; la page tient en deux écrans de 844 px sur une ferme neuve qui coche tout ; la pastille au coin de l'icône (un soleil) dans la barre du bas |

## 10. Risques

- **Doublon avec la deuxième passe** : la ligne d'état et le nom de la ferme dans l'en-tête sont faits (#279) ; la PR 1 mesure d'abord, ne reprend que ce qui reste.
- **Le calculateur** et l'écran de réglage du matériel ne sont pas touchés par ce lot.
- **Les points 5, 6, 12, 13** (lot 3) se branchent plus tard sur les mêmes liens : « Fait comme prévu » sur les blocs b et c, « Observer » par ligne sur la ligne du sol, tri des espèces sur la ligne des espèces.
- **Une prévision absente** ne doit jamais se lire comme « pas de gel » : cas 6.
