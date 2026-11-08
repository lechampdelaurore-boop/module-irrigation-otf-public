# Contrat de la pose datée et du stockage du matériel (2.11)

Écrit le 27 octobre 2026, sur le « vas-y » du porteur, à partir de son constat
du jour et de ses réponses ; sous-tranche 2.11 de `ROADMAP.md`, décision
D-043, point ouvert 43 de `ETAT_DU_PROJET.md`. Il fixe les règles avant tout
code ; relu et confirmé par le porteur le jour même, les choix faits en
l'écrivant étant rassemblés à la fin.

## Le constat

Le porteur pose un goutte-à-goutte sur des planches pour quelques semaines,
l'enlève, le range, le repose ailleurs trois semaines plus tard. Le logiciel
ne sait pas le dire :

- un matériel n'a qu'**une position par saison**, sans date
  (`docs/irrigation-data-model.md`, « Groupes et placements ») : « Déplacer »
  la réécrit, « Retirer la position » l'efface ;
- **« Retirer la position » est refusé dès qu'une irrigation a utilisé le
  matériel** (`deleteEquipmentPlacementForUser`,
  `db/equipment-placement-repository.ts`) : la barre de placement répond
  « Cette position a déjà servi à une irrigation et doit rester dans
  l'historique » et le matériel reste posé. Un goutte-à-goutte qui a arrosé
  une fois ne peut plus jamais être retiré ;
- le retrait, quand il passe, vaut pour toute la saison et ne laisse aucune
  trace.

Le refus voulait protéger l'historique ; il confond « garder la trace des
arrosages passés » et « laisser le matériel posé ». L'historique n'a pas
besoin de la position courante : chaque irrigation garde déjà sa propre copie
de la position et ses apports planche par planche
(`irrigation_event_equipment.placement_snapshot`,
`irrigation_bed_applications`, D-006).

## Objet

La pose d'un matériel suit la réalité, datée : posé sur ces planches depuis
telle date, retiré et stocké depuis telle date, reposé ailleurs. Les calculs
ne comptent un matériel sur une planche que pendant qu'il y est posé. Rien
n'est jamais effacé.

La règle vaut pour **tout le matériel**, goutte-à-goutte et aspersion, rampes
mobiles comprises (choix du porteur du 27 octobre 2026).

## Vocabulaire

- **Pose** : une période pendant laquelle un matériel est installé à un
  endroit précis — son ancrage, ses planches, son réglage appliqué —, avec
  une **date de pose** et, une fois retiré, une **date de retrait**.
- **Posé** : le matériel a une pose sans date de retrait.
- **Stocké** : le matériel n'a aucune pose ouverte ; il existe, garde ses
  réglages, et n'arrose rien.
- **Retirer** : fermer la pose ouverte à une date ; le matériel devient
  stocké.
- **Reposer** : ouvrir une nouvelle pose, au même endroit ou ailleurs.
- **Déplacer** : fermer la pose ouverte et en ouvrir une nouvelle ailleurs,
  à la même date.

## Les règles

### États et dates

1. Un matériel a **au plus une pose ouverte** à un instant donné.
2. Une date de pose ou de retrait est un instant, saisi à la minute en heure
   de Paris (D-004). Par défaut : maintenant.
3. **Une date peut être reportée dans le passé, jamais dans le futur**,
   sans limite de durée, à l'intérieur de la saison de la pose (règle 15).
   Les règles 4 et 5 suffisent à refuser une date incohérente (décision du
   porteur du 27 octobre 2026 : pas de limite de jours).
   Une date qui ne dépasse l'heure du serveur que de deux minutes au plus vaut
   maintenant, et s'enregistre à l'heure du serveur (précision du 30 octobre
   2026, point ouvert 47, ci-dessous).
4. Une date de pose n'est jamais antérieure à la date de retrait de la pose
   précédente du même matériel ; une date de retrait n'est jamais antérieure
   à la date de pose de la même pose.
5. **Une date de retrait n'est jamais antérieure à la fin de la dernière
   irrigation enregistrée sur cette pose**, réalisée, partielle ou en cours.
   L'écran refuse et nomme cette irrigation.
6. **Un retrait est refusé tant qu'une irrigation est en cours sur ce
   matériel** : on l'arrête ou on la termine d'abord.
7. Une pose existante, créée avant cette sous-tranche, n'a pas de date de
   pose connue : elle reste posée, et l'écran dit « date de pose non
   renseignée » (D-003). Elle ne prend pas une date inventée.

### Ce qui ne s'efface jamais

8. Retirer, déplacer ou reposer **ne supprime ni ne réécrit rien** : chaque
   pose fermée reste lisible avec ses dates, ses planches et son réglage.
9. Les irrigations enregistrées gardent la position qu'elles ont utilisée,
   comme aujourd'hui (D-006) ; aucun cumul, aucun historique par planche ou
   par série ne change quand un matériel est retiré.

### Ce que les calculs voient

10. **Besoins, faisabilité et planning** de la semaine en cours (3.3, 3.4,
    3.5) ne comptent que le matériel **posé au moment du calcul**. Un
    matériel stocké ne couvre aucune planche : la surface mouillée d'une
    planche qu'il était seul à arroser revient à la planche seule, et le
    planning la dit « aucun matériel ne l'arrose ».
11. **Irriguer maintenant** et **planifier une irrigation** ne proposent que
    le matériel posé. Un matériel stocké n'y paraît pas : il se repose depuis
    sa carte, dans Matériel et placement (amendée le 7 novembre 2026, précision
    P37 de `docs/feature-selection-contract.md` ; avant, il s'affichait
    « stocké », non sélectionnable, avec « Reposer »).
12. **Saisir une irrigation déjà réalisée** utilise la pose qui était ouverte
    à l'heure de début saisie. Si le matériel était stocké à cette heure,
    l'enregistrement est refusé et le message donne les dates de pose et de
    retrait qui l'entourent, pour que l'utilisateur corrige l'heure ou les
    dates de pose (règles 3 et 4).

### Ce qui était prévu sur un matériel retiré

13. **Une irrigation planifiée n'est jamais supprimée par un retrait** (choix
    du porteur). Elle reste dans « À venir ou à terminer », signalée
    « matériel stocké depuis le … ». Elle ne peut pas démarrer tant que le
    matériel est stocké : le démarrage est refusé avec ce motif ;
    l'utilisateur l'annule ou repose le matériel. Reposé au même endroit,
    mêmes planches, elle redevient démarrable ; reposé ailleurs, elle garde
    ses planches d'origine et reste refusée au démarrage, « matériel reposé
    ailleurs » : on l'annule et on en planifie une nouvelle. **Tant qu'elle
    ne peut pas démarrer, elle ne compte dans aucun calcul** : ni dans les
    besoins, la faisabilité et le planning, ni dans les réserves, la limite
    journalière et la pompe ; elle reste affichée et signalée. Reposé au
    même endroit, le matériel la fait compter de nouveau (D-044, décision du
    porteur du 29 octobre 2026).
14. **Une proposition du planning** qui utilise un matériel retiré depuis le
    calcul ne peut pas être validée. **Le refus s'explique toujours**, sous la
    carte de la proposition, en nommant le matériel, sa date de retrait,
    l'heure du calcul et ce qu'il faut faire, par exemple : « Validation
    impossible : rampe bloc 3 a été retirée et stockée le 28 octobre à
    18 h 40, après le calcul de ce plan (28 octobre, 6 h 15). Recalculez le
    plan pour obtenir des propositions à jour. » Une validation de la journée
    ou de la semaine valide les autres propositions et liste, avec ce même
    motif, celles qu'elle a laissées. Le prochain calcul, du matin ou à la
    demande, ne les propose plus. Le recalcul déclenché par l'événement
    lui-même relève de la 3.7. (Exigence du porteur du 27 octobre 2026.)

### Saison

15. Une pose appartient à la saison où elle est ouverte, comme aujourd'hui.
    Le passage d'une saison à l'autre n'est pas traité ici.

## L'écran

- Sur la carte de chaque matériel, dans « Matériel d'irrigation », l'état en
  clair : « Posé sur … depuis le … », « Stocké depuis le … » ou « Jamais posé
  cette saison ».
- Un bouton **« Retirer (stocker) »** directement sur la carte d'un matériel
  posé, avec la date proposée à maintenant et modifiable selon les règles 3
  à 5 ; confirmation avant l'enregistrement.
- **« Reposer »** sur la carte d'un matériel stocké, qui ouvre l'éditeur de
  placement habituel, ancrage et planches présélectionnés comme à la dernière
  pose, réglage appliqué repris de la dernière pose.
- **« Déplacer »** garde son rôle ; il ferme et ouvre une pose à la même
  date, proposée à maintenant.
- Un pli **« Historique des poses »** sur la carte : les poses fermées, de la
  plus récente à la plus ancienne, avec leurs dates, leurs planches et leur
  réglage.
- Le bouton actuel « Retirer la position » de la barre de placement devient
  « Retirer (stocker) » et suit les mêmes règles.
- Le compteur de l'inventaire distingue posés et stockés.
- Ordinateur et 390 px de large.

## Ce qui ne change pas

- Le modèle d'une irrigation, ses copies de matériel, de réglage et de
  position, ses apports par planche.
- Les cumuls, l'historique, le suivi par série : ils lisent les apports
  enregistrés, pas les poses.
- L'archivage d'un matériel (2.x), hors périmètre.

## Données

Migration additive (`docs/migrations-contract.md`), sans suppression ni
réécriture :

- la ligne de position actuelle reste la **pose courante** du matériel pour
  la saison ; elle gagne une date de pose (`placed_at`, nulle pour les
  lignes existantes, règle 7) et une date de retrait (`removed_at`, nulle
  tant que le matériel est posé) ;
- chaque pose fermée est copiée, au moment où elle se ferme, dans un registre
  des poses en ajout seul : matériel, saison, ancrage, planches, réglage,
  dates de pose et de retrait ;
- l'index unique « une position par matériel et par saison » reste en
  place : la pose courante se met à jour, l'historique vit dans le registre.

Les déclencheurs de révision de la faisabilité existants couvrent déjà la
ligne de position : un retrait, une pose ou un déplacement invalident les
calculs en cours, comme aujourd'hui.

Précisions arrêtées en écrivant la persistance (PR 2, 27 octobre 2026), sans
changer une règle :

- enregistrer un matériel posé **au même endroit** — mêmes planches pour un
  goutte-à-goutte, dans n'importe quel ordre, même ancrage pour une
  aspersion — n'est pas un déplacement : la pose reste ouverte et garde sa
  date ; seuls le réglage et le groupe suivent ;
- une irrigation est **en cours** tant que son minuteur tourne ou est en
  pause (règle 6), y compris démarrée depuis une irrigation planifiée ;
- le registre garde, avec la pose fermée, le **nom du réglage** qu'elle
  appliquait, pour rester lisible si le réglage est renommé ;
- le réglage d'un matériel stocké ne se change pas : il se choisit en le
  reposant ;
- le registre ne s'efface qu'avec son matériel, quand celui-ci est supprimé
  sans avoir jamais arrosé ; une pose qui se ferme deux fois en même temps
  (double clic) n'y est copiée qu'une fois.

## Découpage et preuve de fin

En PR courtes, tests d'abord :

1. **Le domaine** : états, contrôles de dates (règles 1 à 7), pose ouverte à
   un instant, ce que voient les calculs (règles 10 à 14), avec les scénarios
   ci-dessous.
2. **La persistance** : la migration, le registre des poses, le retrait
   devenu fermeture, les tests de persistance — dont le retrait d'un matériel
   qui a déjà arrosé, refusé aujourd'hui.
3. **Les calculs et l'écran** : besoins, faisabilité, planning, saisie des
   irrigations, carte du matériel, historique des poses, parcours navigateur
   aux deux largeurs. Découpée en deux le 29 octobre 2026, sur la
   recommandation de l'assistant acceptée par le porteur : **3a, les
   calculs** (règles 10 et 14, décision D-044, scénarios 6 et 8 en tests de
   persistance), puis **3b, l'écran** (états, dates de pose et de retrait,
   « Retirer (stocker) », « Reposer », historique des poses, signal des
   irrigations planifiées, parcours navigateur) **avec la saisie après coup
   (règle 12, scénario 9)**. La règle 12 suit l'écran parce qu'elle a besoin
   de lui : tant qu'une pose ne peut pas se dater dans le passé, une pose
   enregistrée aujourd'hui refuserait une irrigation saisie pour hier, ce que
   le parcours P3 a montré en écrivant la 3a.

Preuve de fin : les scénarios en tests, les tests de persistance, le parcours
navigateur, puis une recette réelle sur la ferme, sur ordinateur et à 390 px,
le constat à l'assistant et le jugement au porteur (D-014), données remises
en état.

### Scénarios

1. **Retirer un goutte-à-goutte qui a déjà arrosé** : posé, une irrigation
   réalisée et terminée lundi 10 h ; retrait mardi 9 h accepté ; le matériel
   est stocké ; l'irrigation de lundi garde ses planches et ses mm.
2. **Retrait antérieur à une irrigation** : même cas, retrait daté lundi 9 h :
   refusé, l'irrigation de lundi est nommée.
3. **Retrait pendant une irrigation en cours** : refusé tant que le minuteur
   tourne.
4. **Reposer ailleurs** : stocké mardi, reposé vendredi sur d'autres
   planches ; deux poses dans l'historique, la première fermée mardi, la
   seconde ouverte vendredi.
5. **Dates incohérentes** : une date dans le futur, ou hors de la saison de
   la pose, refusée ; une pose datée avant le retrait précédent, refusée ;
   un retrait daté trois semaines en arrière, après la dernière irrigation de
   la pose, accepté.
6. **Besoins** : une planche arrosée par ce seul goutte-à-goutte ; après le
   retrait, sa surface mouillée revient à la planche seule et le planning la
   dit « aucun matériel ne l'arrose ».
7. **Irrigation planifiée** : planifiée jeudi sur le matériel, retrait
   mercredi : l'irrigation reste, signalée « matériel stocké depuis
   mercredi » ; son démarrage est refusé.
8. **Proposition du planning** : calculée lundi avec le matériel, retrait
   mardi : la validation est refusée, et le message sous la carte nomme le
   matériel, sa date de retrait, l'heure du calcul et dit de recalculer ; une
   validation de la journée valide les autres propositions et liste celle-ci
   avec ce motif ; le calcul suivant ne la propose plus.
9. **Saisie après coup** : stocké du mardi au vendredi ; une irrigation
   saisie mercredi 8 h est refusée, le message donne « retiré mardi, reposé
   vendredi ».
10. **Pose ancienne** : une position créée avant la migration reste posée,
    « date de pose non renseignée », et se retire normalement.
11. **Rampe d'aspersion** : les scénarios 1 et 4 rejoués sur une rampe
    mobile.

## Choix faits en écrivant, confirmés à la relecture

Le porteur a suivi les trois recommandations de l'assistant le 27 octobre
2026 : la règle vaut pour les rampes, une irrigation planifiée est signalée
et jamais supprimée, un retrait se date dans le passé. À la relecture, le
même jour, il a écarté la limite de sept jours en arrière d'abord proposée :
une date se reporte dans le passé sans limite de durée, dans la saison.
Ces points-ci ont été précisés en écrivant, puis confirmés par lui le même
jour, les points 1 à 5 un par un ; au point 3, il exige que le refus
s'explique toujours par un message (règle 14). Le point 6, technique et sans
effet visible, est retenu faute d'objection :

1. le refus d'un retrait daté avant la fin de la dernière irrigation de la
   pose, et pendant une irrigation en cours ;
2. le refus d'une irrigation saisie après coup sur une période où le
   matériel était stocké ;
3. le refus de valider une proposition dont le matériel a été retiré depuis
   le calcul, sans recalcul automatique avant la 3.7 ;
4. la reprise, à la repose, des planches et du réglage de la dernière pose ;
   une irrigation planifiée redevenue démarrable seulement si le matériel est
   reposé sur les mêmes planches ;
5. les poses anciennes laissées « date de pose non renseignée » ;
6. la pose courante gardée dans la ligne existante, les poses fermées
   copiées dans un registre à part, sans toucher à l'index unique.

## Précisions arrêtées en écrivant les calculs (PR 3a, 29 octobre 2026)

- Une irrigation planifiée ne compte plus dès que la règle 13 l'empêche de
  démarrer, et seulement elle : une irrigation en cours, au minuteur en
  marche ou en pause, ou déjà faite, compte toujours. Une irrigation dont la
  copie de position n'a pas d'ancrage compte, comme elle démarre (règle 13).
- Les listes d'irrigations à l'écran et l'historique la montrent toujours :
  seuls les calculs l'écartent.
- Les gardes qui protègent le démarrage d'une irrigation, limite journalière
  et pompe, l'écartent aussi pour les autres irrigations ; démarrer
  l'irrigation écartée elle-même est refusé par la règle 13, avec son motif.

## Précisions arrêtées en écrivant l'écran (PR 3b, 29 octobre 2026)

La saisie après coup (règle 12) :

- une pose **sans date de pose connue** (règle 7) vaut depuis toujours ; une
  pose couvre l'instant de sa pose jusqu'à celui de son retrait, exclu ;
- une irrigation saisie après coup utilise la pose ouverte à son heure de
  début **même si elle est fermée depuis** : on peut consigner le lundi soir
  l'arrosage du matin d'une ligne retirée à midi ;
- elle ne peut pas **se terminer après le retrait** de cette pose : « Ce
  matériel a été retiré le … : une irrigation commencée avant ne peut pas se
  terminer après. Corrigez l'heure de fin de l'irrigation. » ;
- le refus d'un matériel stocké à l'heure de début dit l'intervalle :
  « retiré le …, reposé le … », « retiré le …, pas reposé depuis », « posé
  seulement le … » avant sa première pose de la saison, ou « Ce matériel n'a
  jamais été posé cette saison : posez-le avant de saisir une irrigation. » ;
- la base refuse aussi une position qui n'est pas celle de la pose ouverte à
  l'heure de début : « Ce matériel n'était pas posé à cet endroit à l'heure de
  début : recommencez la saisie. »

L'écran :

- une aspersion ancrée sur le trait entre deux planches est « Posé entre P3 et
  P4 depuis le … », et non « Posé sur » ;
- les dates se saisissent à la minute ; « maintenant » est la minute où
  s'ouvre l'éditeur de placement ou la confirmation du retrait ;
- la barre de placement porte la date : « Date de pose », « Date de repose »
  pour un matériel stocké, « Date du déplacement » pour un matériel posé,
  sans effet s'il reste au même endroit (PR 2) ;
- « Retirer (stocker) » sur la carte et dans la barre de placement ouvrent la
  même confirmation, « Retirer et stocker … », avec la date du retrait ; un
  refus s'y affiche et la fenêtre reste ouverte ;
- la carte d'une irrigation planifiée bloquée dit « Matériel stocké depuis
  le … : reposez-le ou annulez cette irrigation. » ou « Matériel reposé
  ailleurs : annulez cette irrigation et planifiez-en une nouvelle. », et son
  bouton « Démarrer maintenant » est grisé ;
- « Irriguer maintenant » et « Planifier » ne listent que le matériel posé
  (règle 11, précision P37) ; « Déjà réalisée » propose le
  matériel posé à l'heure de début saisie, et, si aucun ne l'était, le dit
  (« Aucun matériel n'était posé à cette heure de début ») en gardant le champ
  de l'heure de début ;
- une ligne de l'historique des poses se lit « Du … au … · planches ·
  réglage », ou « Jusqu'au …, date de pose non renseignée · … » ;
- le compteur de l'inventaire compte, parmi les matériels actifs, les posés
  et les stockés ; un matériel jamais posé n'est ni l'un ni l'autre.

## Précision du 30 octobre 2026 : la minute en cours (point ouvert 47)

Constat du porteur, en retirant pour de vrai son goutte-à-goutte : un retrait
daté de la minute même est refusé « Une date de pose ou de retrait ne peut pas
être dans le futur. », accepté une minute plus tôt. Les dates se saisissent à
la minute sur l'ordinateur ou le téléphone, et le serveur les compare à sa
propre heure, à la seconde : l'horloge d'un appareil qui avance de quelques
secondes sur celle du serveur fait paraître « maintenant » dans le futur, y
compris la date proposée par défaut.

Décision du porteur du 30 octobre 2026 (« vas-y pour le point 47 ») : une date
de pose, de repose, de déplacement ou de retrait qui dépasse l'heure du
serveur de deux minutes au plus vaut maintenant ; elle est enregistrée à
l'heure du serveur, si bien qu'aucune date du registre n'est jamais dans le
futur. Au-delà de deux minutes, le refus de la règle 3 tient, avec son
message. La marge vit dans le domaine (`poseDateAt`,
`lib/domain/equipment-placement-periods.ts`), appliquée par la base avant les
contrôles des règles 3 à 5.
