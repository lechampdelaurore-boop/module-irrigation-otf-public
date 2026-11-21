# Contrat court — améliorations n° 6, 2, 3 et 7 (24 septies, section 6 septies)

Écrit le 21 novembre 2026, avant tout code, en Sonnet 5.5 · Moyen (la grille
des contrats, AGENTS.md, « Économie de jetons »). Il couvre les quatre
améliorations validées le 21 novembre 2026 (D-280) qui ne demandent pas
l'avis agronomique du porteur : **n° 6** panneau « données manquantes »,
**n° 2** rappel du soir, **n° 3** un seul message du matin, **n° 7** journal
des modifications. Les n° 4 et 5 sont réservées à son avis agronomique : aucun
contrat ici. La n° 1 existe déjà.

**Le porteur a avancé le démarrage le 21 novembre 2026** (« Vas-y », à
9 h 52, après avoir fait remarquer qu'aucun chantier de code n'était en
cours) : ces améliorations n'attendent plus la fin de la Tranche 4. Rien de
technique ne l'empêche ; leur code se fait sur sa propre branche, une PR à la
fois, et **ne se fusionne qu'après la file de fusion en cours** (4.5, 4.4,
moteur commun), pour ne pas se mêler à elle. Ordre du code : 6, puis 2 et 3,
puis 7.

Logiciel multi-fermes : chaque règle se règle ou se lit **par ferme**, à
partir des fonctionnalités cochées (3.8, D-067) ; rien n'est propre à la ferme
du porteur. Aucune règle de calcul du besoin, du planning ni de la répartition
ne change. Une donnée inconnue reste `null` ou « inconnue », jamais zéro
(D-003) ; l'historique reste immuable (D-006).

Registres : décisions **D-281 et suivantes**, précisions **F700 et suivantes**,
parcours **P52 et suivants**. Ces numéros sont pris au-dessus de ceux des PR
ouvertes de la 4.5, de la 4.6, du moteur commun et de #162 (D-280) ; à
renuméroter à la fusion si la file préfère une suite sans trou. Les numéros de
migration ne sont pas fixés ici : ils se prennent au moment du code, après
ceux de la file (la 4.5 jusqu'à 0041, l'ET0 de la 4.4 ensuite).

## 1. Livraison en sept PR, une à la fois

| PR | Point | Contenu | Réglage | Preuve |
| --- | --- | --- | --- | --- |
| 1 | n° 6 | Le panneau « données manquantes » par planche | Opus 5.5 · Élevé | tests du domaine, P52 (390 et 1440 px) |
| 2 | n° 3 | Le message unique du matin, sa règle et le réglage par ferme | Opus 5.5 · Élevé | tests du domaine et du service, parcours |
| 3 | n° 2 | Le rappel du soir : déclencheur, registre des tâches, route, réglage de l'heure | Opus 5.5 · Élevé | tests du registre, du domaine, du service ; parcours |
| 4 | n° 7 | La table du journal, la règle, la preuve d'isolation, l'effacement | Opus 5.5 · Très élevé | tests de persistance, d'isolation, d'effacement |
| 5 | n° 7 | Les écrivains des objectifs et des réglages branchés sur le journal | Opus 5.5 · Très élevé | test de couverture (§5.4), tests de persistance |
| 6 | n° 7 | Les écrivains du matériel et des ressources, puis le test « aucun écrivain oublié » | Opus 5.5 · Très élevé | idem |
| 7 | n° 7 | La lecture : section « Journal des modifications » de « Réglages » | Opus 5.5 · Très élevé | P-n°, 390 et 1440 px |

Les n° 2 et 3 partagent leur chaîne (notification, alarme du Worker,
registre des tâches) : un seul contrat les couvre, une PR par point, la 2 avant
la 3 parce qu'elle pose le réglage de ferme que la 3 complète. Chaque PR :
`lint`, `typecheck`, `test`, `build`, `knip`, `push:check`, `weather:check`,
`site:check` collés ; `e2e` joué en local sur les parcours touchés, la suite
complète par la CI de la PR ; registres dans la même PR (AGENTS.md).
Le « retour en arrière » du journal n'est **pas** livré ici (§5.8).

## 2. Ce qui ne change pas

Le moteur, le planificateur, les objectifs, la pluie, la répartition ; la
règle du refus d'une proposition ; « Fait comme prévu » (n° 1, D-076) ; les
alertes météo et de culture et leurs critères ; la notification de fin
d'irrigation et « Irrigation en retard » (3.7). La page « Aujourd'hui » garde
son contenu ; elle sert de cible aux notifications.

## 3. n° 6 — Panneau « données manquantes »

**Aujourd'hui.** La zone « Fiabilité du calcul »
(`lib/domain/today/reliability.ts`, 3.8 quater lot 2) dit, pour **cinq
données** et pour la ferme entière, ce qui est à rafraîchir : volume des
réserves, pluie réelle, réserve du sol d'un jardin jamais observé, espèces à
rattacher, plan à recalculer. La 4.4 (PR 5a et 5b) dit à la fin de l'accueil ce
qui reste inconnu. Rien ne dit, **planche par planche**, ce qui manque.

**Règles.**

1. **La liste fermée s'allonge de trois données par planche**, calculées dans
   `lib/domain/today/` et nulle part ailleurs, chacune avec sa phrase, sa
   conséquence en clair et le geste qui la corrige (même forme que
   `ReliabilityLine`) (F700) :
   - **Réserve du sol non saisie** : une planche de plein champ ou sous abri
     dont la jauge du sol est inconnue faute d'observation ou de RFU (la règle
     existante `neverObservedSoilGardens` en est la source, regroupée par
     planche et plus seulement par jardin) ; geste : le formulaire du sol.
   - **Stade deviné** : une culture en cours dont le stade n'a **pas été
     déclaré** par le maraîcher et que le module place d'après la date de
     plantation et le calendrier de référence ; la conséquence dit « le besoin
     proposé suit le calendrier, pas votre constat » ; geste : déclarer le
     stade. *Sens retenu sur l'option recommandée « stade déduit du
     calendrier »* (l'autonomie du porteur sur les questions non agronomiques,
     19 novembre 2026) ; il le corrige à la relecture du contrat s'il le
     souhaite.
   - **Pluviomètre absent** : aucune pluie **mesurée** saisie sur la ferme
     depuis 30 jours alors que des cultures dépendent de la pluie ; la
     conséquence dit « la pluie vient de la réanalyse, qui peut s'écarter du
     terrain » ; geste : saisir une pluie mesurée (même `0 mm`, qui compte).
     Rien si toutes les planches sont sous abri (la pluie vaut `0`).
2. **Une donnée dont la case n'est pas cochée ne compte pas** (3.8, F3, F5) :
   la planche sans la case « sol » ne reçoit pas la ligne du sol, etc. Chaque
   ligne dépend d'une case, déclarée comme `RELIABILITY_FEATURE`.
3. **Un panneau, pas une page de plus** : la zone « Fiabilité du calcul »
   gagne un dépliant « Par planche » qui regroupe les lignes par culture puis
   par planche, avec le total (« 7 planches ont une donnée manquante »). La
   même liste sert **après l'accueil** : le lien « Ce qui manque » de la fin
   de l'accueil (4.4) ouvre ce panneau. Au plus 5 lignes d'emblée, les autres
   derrière « Voir les n autres » (seuil existant).
4. **Rien ne bloque.** Le panneau informe, il n'écrit rien, ne change aucun
   calcul et ne devient jamais un terme du besoin (règles métier de
   l'AGENTS.md). Une ferme sans donnée manquante affiche une phrase
   « Tout est à jour », jamais une zone vide.
5. **Ordre et texte.** Les planches se classent par effet sur le plan (réserve
   du sol, puis stade, puis pluviomètre), ensuite par ordre naturel des noms
   (`compareNamesNaturally`). Le « ? » de la zone écrit chaque seuil (30 jours
   pour le pluviomètre, F701).

**Preuves.** Tests du domaine (une planche par cas, la case décochée, la ferme
tout sous abri, le seuil de 30 jours à la veille et au jour, la ferme sans
donnée manquante) ; P52 : au téléphone et à 1440 px, le dépliant s'ouvre, le
geste d'une ligne mène au bon formulaire, la ligne disparaît après la
correction. Aucune migration.

**Précisions du code (21 novembre 2026, D-282).** F710 : le dépliant vit sous
l'anneau de la zone, fermé ; il ne compte ni dans la pastille du menu ni dans
l'anneau, qui gardent leurs cinq données ; le geste du stade ouvre
« Matériel » sur la planche par l'ancre `#bed-stage-<planche>`, le formulaire
du stade ouvert ; les planches se rangent par culture, puis par l'effet de
leur première planche. F711 : le stade deviné est celui d'une culture dont
le stade et le Kc sont connus sans déclaration qui la place ; la réserve du
sol non saisie suit la règle du jardin (`gardenBedUnknown`) ; le pluviomètre
lit la pluie mesurée de J − 30 à aujourd'hui, `0 mm` compris, pour une
planche hors abri qui porte une culture ce jour-là ; une donnée non lue ne
donne aucune ligne. Le dépliant s'ouvre aussi par son ancre
`#donnees-manquantes`.

## 4. n° 3 et n° 2 — Le message du matin et le rappel du soir

**Aujourd'hui.** Une notification du matin existe : les suggestions du
planning, groupées, envoyées après le calcul quotidien quand il y a une
suggestion sur un arrosage des 24 prochaines heures
(`lib/domain/planning/notifications.ts`,
`lib/services/planning-notifications.ts`, docs/replanning-contract.md, règles
21 à 24). La page « Aujourd'hui » est le résumé en écran. Rien ne relance un
arrosage validé jamais confirmé.

### 4.1 Le réglage de ferme (PR 2)

Un réglage **par ferme**, enregistré avec la personne qui le change et la date
(comme les autres réglages, `actor_user_id`), dans « Réglages » sous
« Notifications du téléphone » (F702) :

- **Message du matin** : activé par défaut pour une ferme qui a déjà au moins
  un appareil inscrit ; une case pour le désactiver.
- **Rappel du soir** : activé par défaut pour une ferme qui coche
  « Arrosages » ; une case pour le désactiver ; **l'heure** à choisir de 17 h
  à 22 h, au quart d'heure, **19 h par défaut**, heure de Paris (D-004).

Une migration ajoute la table des réglages (une ligne par espace) ; elle entre
dans le plan d'effacement (`SPACE_TABLES` de `db/farm-erasure-plan.ts`), sans
quoi la CI de la 4.5 échoue (F563). Pas de valeur par défaut écrite en base :
une ferme sans ligne reçoit les défauts ci-dessus.

### 4.2 Le message unique du matin (PR 2)

**Choix du porteur à soumettre : remplacer ou compléter la notification des
suggestions. Option recommandée, retenue par défaut : la remplacer.** Un seul
message par jour et par ferme est plus lisible qu'un second ; les suggestions
y sont une phrase du message (F703).

1. **Quand.** Dans le calcul du matin, après le plan, dans le même appel que
   l'envoi des suggestions d'aujourd'hui : aucun nouveau déclencheur. Un
   calcul lancé ou provoqué par le maraîcher n'envoie rien (règle 22 : il a le
   plan sous les yeux).
2. **Contenu**, dans cet ordre, une phrase chacune, jamais plus de quatre :
   - *Quoi arroser* : « 3 arrosages prévus aujourd'hui : Rampe 1 (6 h 30),
     Goutte-à-goutte nord (8 h), … » ; ce sont les irrigations planifiées
     d'aujourd'hui, au plus trois nommées, puis « et 2 autres » ;
   - *La pluie prévue* : la pluie des prochaines 24 heures de la ferme, en mm,
     seulement si elle est connue et supérieure à 0 (pluie prévue comptée à
     100 %, règle existante) ; jamais « 0 mm » inventé quand elle manque ;
   - *Les alertes en cours* : le nombre d'alertes météo et de culture
     actives, avec le mot « alerte » ;
   - *Les suggestions* : la phrase actuelle (« 2 suggestions sur vos arrosages
     des prochaines 24 heures »), reprise telle quelle.
3. **Se tait quand il n'y a rien** : ni arrosage prévu, ni alerte, ni
   suggestion ; la pluie seule ne justifie pas un message.
4. **Un seul message par jour et par ferme** : l'identifiant d'alarme et
   l'étiquette portent le jour de Paris (`morning:<jour>`), de sorte qu'une
   seconde exécution du calcul du même jour ne renvoie rien (même principe que
   `claimOperatorNotice`) ; la prise du jour se garde en base avant l'envoi.
5. **Un clic ouvre « Aujourd'hui »**, au lieu du planning.
6. **Une panne n'altère jamais le plan** : la fonction ne lève pas, elle
   journalise sans nommer personne (règle 23).
7. **Un seuil d'« arrosage prévu » n'est pas ajouté** : tout arrosage
   planifié d'aujourd'hui compte, comme sur la page « Aujourd'hui ».

**Précisions du code (21 novembre 2026, D-283).** F712 : le réglage vit dans
une table d'un espace (migration 0043), activé par défaut, une colonne vide
valant le défaut ; la prise du jour (`irrigation_phone_notices`) se garde
avant l'envoi, se marque envoyée après, se rend en cas d'échec, et une prise
sans envoi de plus de 5 minutes se reprend. F713 : au plus quatre phrases,
titre « Votre journée » ; les irrigations planifiées d'aujourd'hui qui
attendent un geste, trois nommées avec leur heure ; les propositions encore
à valider ne comptent pas ; la pluie prévue d'aujourd'hui, celle que lit le
plan, dite seulement si elle dépasse 0 une fois arrondie ; les alertes
comptées comme le bloc « Gel ou chaleur » de « Aujourd'hui ». F715 : la case
vit dans le pli fermé « Messages de la ferme » de « Notifications du
téléphone », dont la ligne dit le réglage ; l'ancre `#message-du-matin`
l'ouvre.

### 4.3 Le rappel du soir (PR 3)

Pour chaque arrosage **validé du jour jamais confirmé** (F704) : une
irrigation planifiée dont l'heure de fin prévue est passée aujourd'hui, qui
attend encore (`isWaitingPlannedIrrigation` : ni démarrée, ni enregistrée, ni
annulée).

1. **Un message par jour et par ferme**, à l'heure réglée : « 2 arrosages
   prévus aujourd'hui ne sont pas confirmés : Rampe 1, Goutte-à-goutte nord.
   Les avez-vous faits ? ». Au plus trois noms, puis « et n autres ».
2. **Un clic ouvre « Aujourd'hui »**, où « Fait comme prévu » et
   « Tout est fait » existent déjà ; la notification ne confirme jamais rien
   elle-même (D-006 : une irrigation réalisée est un fait que le maraîcher
   enregistre, jamais une supposition).
3. **Rien si tout est confirmé**, si la case « Arrosages » est décochée, si
   l'espace est figé par une demande d'effacement (4.5), ou si l'heure réglée
   est passée de plus de deux heures au moment du passage (un déclencheur en
   panne ne rattrape pas un rappel tardif en pleine nuit).
4. **Le déclencheur.** Une ligne de plus dans `TASK_TRIGGERS` du registre des
   tâches (`lib/domain/operations/task-registry.ts`) et une tâche attendue
   `evening-reminder`, **inscrites avec leur rythme, leurs seuils et leur
   raison** : `tests/task-registry.test.ts` échoue sinon (AGENTS.md, F560,
   F569). Rythme : **un passage par heure** (`cron` « 5 * * * * » dans
   `cloudflare/irrigation-weather-scheduler`), parce que l'heure se règle par
   ferme ; chaque passage ne traite que les fermes dont l'heure réglée tombe
   dans l'heure de Paris en cours (F705). Seuils : orange après 3 heures sans
   passage réussi, rouge après 6 ; raison écrite. Un jour d'heure d'été ou
   d'hiver ne double ni ne saute un rappel : la prise du jour (§4.2.4) l'en
   empêche.
5. **Le message part par la chaîne existante** : alarme à échéance immédiate du
   Worker de notification, sous la clé du récepteur de la ferme
   (`recipientKey = workspaceId`), comme celle du matin.
6. **Pas de relance** : un seul rappel par jour, jamais un second le lendemain
   pour la veille.

**Précisions du code (21 novembre 2026, D-284).** F714 : le rappel part au
premier passage horaire où l'heure de Paris a atteint l'heure réglée, et
dans les deux heures qui suivent, jamais avant ; il nomme les irrigations
planifiées dont la fin prévue est passée aujourd'hui et qui attendent un
geste, chaque matériel une fois, trois noms puis « et n autres » ; le
réglage (case, heure de 17 h à 22 h au quart d'heure, 19 h par défaut) vit
dans le pli « Messages de la ferme » (F715), l'ancre `#rappel-du-soir`
l'ouvre ; une ferme en panne fait manquer le passage au registre sans
arrêter les autres. Aucune migration de plus : les colonnes du soir viennent
de la 0043.

**Preuves (PR 2 et 3).** Tests du domaine (chaque règle ci-dessus, dont la
ferme sans appareil, la ferme sans rien à dire, le jour d'une seconde
exécution du calcul, le changement d'heure), du service (panne du Worker
journalisée sans nom), du registre des tâches (déclencheur déclaré) et de
l'effacement ; parcours : le réglage se change et se relit à 390 et 1440 px.
L'envoi réel d'une notification se prouve en simulation (le Worker de
notification est simulé, comme pour la fin d'irrigation) ; l'essai sur
appareil réel est une recette du porteur, jamais jouée sans son accord
(ferme réelle).

## 5. n° 7 — Journal des modifications

**Aujourd'hui.** Il y a des révisions et des journaux **par domaine**
(`irrigation_event_log`, `irrigation_planning_settings_log`,
`irrigation_protected_slots_log`, `irrigation_pump_log`,
`irrigation_water_infrastructure_log`, `irrigation_arbitration_log`,
`irrigation_need_decision_log`, `irrigation_hydric_goal_revisions`,
`irrigation_equipment_placement_history`…), chacun avec sa forme, certains
avec « avant » et « après », d'autres sans. Aucun journal général ne dit « qui a
changé quoi, quand, de quoi à quoi ».

**Choix. Option recommandée, retenue : une seule table de journal général,
écrite en plus des journaux de domaine, dans la même opération qu'eux**
(F706). Les journaux de domaine ne changent pas : ils gardent leur usage
(historique des objectifs, des créneaux…), le journal général est la **lecture
d'ensemble**. Écarté : relire l'ensemble des journaux de domaine par une
requête d'union, qui dépend de neuf formes différentes et n'a pas toujours
l'« avant ».

### 5.1 Ce qui entre dans le journal

Les changements de **trois familles**, par ferme (F707) :

- **Objectifs** : objectif hydrique hebdomadaire (révision), seuil minimal de
  besoin, décisions d'objectif d'une planche, objectif proposé adopté ;
- **Réglages** : réglages de planification, créneaux protégés, limites d'eau
  (jour, ressource), réglages du sol (RFU, profondeur, seuil), alertes
  météo et de culture (critères), fonctionnalités cochées, réglage du message
  du matin et du rappel du soir (n° 2, 3), curseur de microclimat ;
- **Matériel et ressources** : matériel, réglages de matériel, pompes,
  ressources, réserves, poses de matériel sur les planches.

**N'y entre pas** : une irrigation (immuable, D-006, déjà tracée par son
journal), une pluie ou un volume mesuré (une observation, pas un réglage), un
calcul, une synchronisation météo, un acte de l'exploitant du service (4.5).

### 5.2 Une ligne du journal

`identifiant`, `espace`, `famille` (objectif, réglage, matériel), `sujet` (un
code court stable, ex. « objectif-hydrique », avec l'identifiant de l'objet
touché), `action` (créé, modifié, supprimé), `avant` et `après` (JSON, **les
champs qui changent seulement**, jamais l'objet entier), `auteur`
(`actor_user_id`, l'identifiant déjà utilisé par les journaux existants),
`date`. Une ligne ne se modifie jamais ni ne se supprime : un journal qui se
réécrit ne prouve rien (comme D-006).

**Qui.** L'écran dit « Vous » pour la personne connectée et « Une autre
personne connectée » pour tout autre auteur ; **aucune adresse électronique
n'est écrite ni affichée** (rôles d'utilisateur écartés, F708). Une ferme de
plusieurs personnes n'a pas de gestion de rôles : le journal dit seulement que
ce n'est pas soi.

### 5.3 Atomicité et isolation

1. **Le changement et sa ligne de journal s'écrivent dans la même opération**
   de base (un seul lot D1) : jamais l'un sans l'autre (F709). Un changement
   refusé n'écrit rien.
2. **Isolation entre fermes** : toute lecture et toute écriture portent
   l'espace ; **une preuve d'isolation** (test de persistance à deux espaces)
   montre qu'une ferme ne lit jamais, ne compte jamais, ne purge jamais le
   journal d'une autre.
3. **Effacement et export** : la table entre dans `SPACE_TABLES` (effacement
   d'une ferme, 4.5) ; la CI de la 4.5 échoue si elle n'y est pas. Elle est
   dans l'export hebdomadaire chiffré comme toute table d'espace.
4. **Conservation** : le journal se garde **autant que la ferme** et part avec
   elle ; aucune purge séparée n'est ajoutée. La page de confidentialité
   gagne une phrase qui le dit (« le journal des modifications garde qui a
   changé quoi et quand, tant que la ferme existe »), relue par l'assistant et
   publiée, comme l'a demandé le porteur pour les textes de la 4.5.

### 5.4 Aucun écrivain oublié

Le piège de ce chantier est le changement qui ne passe pas par le journal. Deux
garde-fous, tous deux en test :

1. **L'inventaire** : la PR 4 commence par dresser, dans le compte rendu et
   dans un test, la liste de **chaque endroit qui écrit un réglage, un objectif
   ou du matériel** (fichiers `db/*-repository.ts`, `db/irrigation-event/*`,
   etc.). Chaque écrivain y est « branché au journal » ou « sans objet »
   avec sa raison.
2. **Le test de couverture** (PR 6) lit la liste et **échoue** si une table
   de réglages, d'objectifs ou de matériel gagne un écrivain sans ligne au
   journal, comme `tests/farm-erasure-plan.test.ts` échoue pour une table sans
   règle d'effacement (F563). Les PR 5 et 6 branchent les écrivains par
   familles, **une à la fois**, chacune avec ses tests avant et après.

### 5.5 La lecture (PR 7)

Une section « **Journal des modifications** » dans « Réglages », **lecture
seule** : les 50 dernières lignes, une carte par ligne (« 18 nov., 14 h 12 ·
Vous · Objectif hydrique : 30 mm → 35 mm »), filtre par famille, « Voir plus »
par 50. Le texte de l'avant et de l'après se compose dans `lib/domain/` (une
règle, un endroit) ; l'écran ne fait que l'afficher. Pas une case de
fonctionnalité : le journal se lit toujours. Au téléphone (390 px), une carte
par ligne, jamais de tableau ; une section vide dit « Aucune modification
enregistrée depuis le <date de mise en service> ».

### 5.6 Le passé

**Le journal commence à sa mise en service.** Rien n'est reconstitué depuis les
journaux de domaine ; leur contenu reste lisible là où il est. Une phrase en
tête de la section le dit.

### 5.7 Registres et décisions

Une décision D-28x pose le choix « table générale, écrite en plus » et
« journal gardé autant que la ferme ».

### 5.8 Le retour en arrière : hors de ce contrat

**Second temps, non cadré ici.** Il changerait une règle métier sensible
(rejouer un réglage, un objectif) : **Opus 5.5 · Max** et un contrat à part,
décidé avec le porteur. Il ne défera **jamais** une irrigation réalisée
(D-006). Rien dans le code de la n° 7 ne doit le rendre impossible : les
lignes gardent l'« avant » complet des champs changés.

**Précisions du code (21 novembre 2026, D-285 à D-288).** F716 : la ligne
du journal s'écrit dans le lot même du changement, à sa condition même ;
l'avant se lit dans la base (avant l'écriture pour une modification ou une
suppression, après pour une création), seuls les champs qui changent, rien
pour un geste refusé ou sans changement. F717 : l'inventaire
(`db/change-journal/inventory.ts`) range chaque table et chaque écrivain,
relu par un test. F718 : les réglages que §5.1 ne nomme pas restent hors du
journal, sur le mot du porteur. F719 : un réglage jamais enregistré vaut ses
valeurs de départ ; son premier enregistrement dit « modifié ». F720 :
chaque écrivain branché nomme son sujet. F721 : une valeur désignée par un
identifiant s'écrit par son nom, lu en SQL des deux côtés ; une valeur
composée, en texte trié. F722 : les mots de chaque champ, avec son unité,
et la carte vivent dans `lib/domain/change-journal/` ; l'auteur se lit
« Vous » ou « Une autre personne connectée », jamais une adresse. F723 : le
journal commence au plus tard de sa mise en service (migration
`…_change_journal.sql`, la 0044) et de la création de l'espace. F724 : la
section est un pli fermé en bas de « Réglages », juste avant « Supprimer ma
ferme et mes données » ; le budget de hauteur au téléphone passe à
3 750 px ; parcours P55.

**Preuves (PR 4 à 7).** Tests de persistance (atomicité, un changement refusé
n'écrit rien, immuabilité), d'isolation entre deux fermes, d'effacement, de
couverture ; tests du domaine (le texte de chaque famille) ; P-n° à 390 et
1440 px : un réglage change, la ligne apparaît avec « Vous » et l'avant et
l'après. Une migration, prise au moment du code.

## 6. Questions pour le porteur

Aucune ne bloque le code. Les choix de ce contrat suivent l'option
recommandée et restent modifiables par le porteur à la relecture : le sens de
« stade deviné » (stade déduit du calendrier, §3), remplacer la notification des suggestions (§4.2), 19 h
par défaut (§4.1), table générale du journal (§5), journal gardé autant que
la ferme (§5.3.4).

## 7. Réglages de code

Rappel de la roadmap (6 septies) : n° 6, 2, 3 — Opus 5.5 · Élevé ;
n° 7 — Opus 5.5 · Très élevé. Les n° 4 et 5 — Opus 5.5 · Max, après l'avis du
porteur. Le « vas-y » du porteur du 21 novembre 2026 couvre le démarrage du
code des n° 6, 2, 3 et 7 dans cet ordre.
