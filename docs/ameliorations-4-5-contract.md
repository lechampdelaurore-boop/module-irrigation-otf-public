# Contrat court — améliorations n° 4 et 5 (24 septies, section 6 septies)

Écrit le 21 novembre 2026, avant tout code, **dans le fil de leur code**, en
Opus 5.5 · Max : le réglage que la roadmap donne à ces deux points (section
6 septies), parce que leur règle est neuve, que le porteur en est le seul juge
et que leur erreur serait silencieuse. Précédent : les contrats de la 4.1 et de
la 4.2, écrits dans leur fil de code.

Il ne fait que mettre en règles **les réponses agronomiques du porteur du
21 novembre 2026** (`/mnt/project-files/ameliorations/avis-agronomique-4-et-5-2026-11-21.md`) :
« a » aux questions 1 et 2, l'option recommandée aux questions 3 à 9 (« on part
du principe que je suis d'accord avec toutes tes recommandations »), le
récapitulatif des questions 4 à 9 validé à 22 h 14 (« Ok, je valide »). Le
code part le même soir, sur son mot (« Allons-y pour le point numéro 1 »,
22 h 12). Ce qui n'est pas dans ses réponses est une précision de code,
choisie sur l'option la plus prudente, consignée ici et modifiable par lui.

**Le n° 4** conseille, en pénurie, de servir d'abord les planches dont une
culture est à un stade sensible au manque d'eau. **Le n° 5** dit, planche par
planche, quand l'eau apportée s'écarte de l'eau prévue trois semaines de
suite, la cause que les données soutiennent, et propose un ajustement. Ni
l'un ni l'autre ne change rien tout seul.

Logiciel multi-fermes : chaque règle se lit **par ferme**, à partir des
fonctionnalités cochées (3.8, D-067) ; rien n'est propre à la ferme du
porteur. Une donnée inconnue reste inconnue, jamais zéro (D-003) ;
l'historique reste immuable (D-006).

Registres : décisions **D-290 et suivantes**, précisions **F730 et
suivantes**, parcours **P56 et suivants**, vérifiés libres le 21 novembre 2026
au-dessus des PR ouvertes de la file (#157, #158, #164 à #169, #171).
Migration **0045**, provisoire : 0043 et 0044 sont prises par les PR de la file,
le numéro se recale à la fusion si la file en a besoin.

## 1. Livraison en deux PR, une à la fois

| PR | Point | Contenu | Réglage | Preuve |
| --- | --- | --- | --- | --- |
| 1 | n° 4 | Ce contrat ; les stades sensibles (tables, liste préremplie validée par le porteur, réglage par culture) ; le conseil en pénurie et « Adopter » ; le constat de la remise à zéro de nuit de la démonstration (ligne 4.0) | Opus 5.5 · Max | tests du domaine, de persistance, d'isolation, d'effacement, de la migration ; P56 (390 et 1440 px) |
| 2 | n° 5 | L'écart prévu/réel par planche, ses causes, l'ajustement | Opus 5.5 · Max | tests du domaine et du service ; P57 (390 et 1440 px) |

La PR 2 s'empile sur la PR 1. Chaque PR : `lint`, `typecheck`, `test`, `build`,
`knip`, `push:check`, `weather:check`, `site:check` collés ; `e2e` joué en
local sur les parcours touchés, la suite complète par la CI de la PR ;
registres dans la même PR (AGENTS.md). Fusion **après la file en cours**
(#164, #165, la n° 7, #157, #158), une à la fois, branches mises à jour par
fusion de `main`, jamais par rebase. Quand le journal des modifications
(n° 7) sera sur `main`, la mise à jour de la branche y fait entrer le choix
d'un stade sensible (famille « réglages ») : son inventaire échoue sinon.

## 2. Ce qui ne change pas

Le besoin (3.3), la répartition (3.4) et le planning (3.5) : aucune règle de
calcul ne change. La priorité d'une planche reste le choix du maraîcher, par
semaine ; l'objectif et le réglage d'un matériel aussi. Un conseil ou une
proposition n'entre dans **aucun terme** du besoin, de la répartition ni du
planning ; seul le geste du maraîcher change une valeur, par le chemin qu'il
emprunte déjà à la main (AGENTS.md, règles métier sur la réserve du sol et sur
l'objectif proposé : même esprit). Une irrigation passée garde sa copie du
matériel et du réglage (D-006). Aucun appel à Ouvre ta ferme, aucun réglage de
Cloudflare.

## 3. n° 4 — Priorité conseillée selon le stade sensible

**Aujourd'hui.** Le stade et le Kc du jour de chaque culture sont calculés
(5 quater) et affichés sur l'écran d'arbitrage (`lib/domain/arbitration-crops.ts`,
2 bis) ; la priorité d'une planche (haute, normale, basse) est choisie par
semaine par le maraîcher (3.3) ; rien ne relie les deux.

### 3.1 Les stades sensibles (réponse 1) — F730

1. **Une liste par culture de référence**, celle qui sert la ferme : la
   commune, ou la version de la ferme qui la remplace. Chaque stade de sa
   table (`curveStages` : les étapes du CRIIAM, les quatre phases de la FAO,
   les étapes d'un calendrier fixe) est **sensible ou non**.
2. **La valeur en vigueur** d'un stade : le choix de la ferme s'il existe,
   sinon la liste préremplie, sinon « non sensible ». Un choix et une ligne de
   la liste préremplie désignent un stade par son rang **et son nom** : quand
   la table des stades d'une culture change (une version de la ferme, une
   correction du jeu commun), un choix dont le nom ne correspond plus au stade
   de ce rang ne s'applique pas, et le stade se règle de nouveau. Un conseil
   ne s'appuie jamais sur un stade qui a changé de sens.
3. **La liste préremplie** est une donnée commune, en base, comme le jeu de
   référence : une ligne par stade sensible, avec sa source, sa confiance
   (« source directe » ou « analogie ») et sa date. Elle devait être relue
   par le porteur avant toute mise en service : proposée avec ses sources
   (le tableau 2 « Periods sensitive to water shortages » du manuel de la
   FAO sur le calendrier d'irrigation, la fiche tomate de la FAO, et des
   analogies dites comme telles,
   `/mnt/project-files/ameliorations/stades-sensibles-proposition-2026-11-21.md`),
   elle a été **validée telle quelle le 21 novembre 2026 à 22 h 51**
   (« Valider telle quelle »). La migration de la PR 1 l'écrit, ligne pour
   ligne ; rien n'y est ajouté. Une culture sans proposition (poireau,
   oignon vert, patate douce, asperge) n'a aucun stade sensible tant que la
   ferme n'en coche pas. La reprise après plantation n'est cochée nulle part
   (choix proposé, validé avec la liste).
4. **Le réglage par ferme** : sur « Besoin par culture », dans la fiche de
   chaque culture de référence, un bloc « Stades sensibles au manque d'eau » :
   une case par stade, qui dit d'où vient sa valeur (« d'après les
   références » ou « choisi par la ferme »). Un choix s'enregistre par ferme
   avec la personne qui le fait et la date ; il ne vaut que pour cette ferme.
   Une culture d'une autre ferme ne se désigne pas.

### 3.2 Quand conseiller (réponses 3 et 4) — F731

1. **Seulement en pénurie**, jamais par anticipation : la répartition de la
   semaine en cours (3.4) est en pénurie quand **l'eau disponible est connue**
   (aucune ressource sans prévision) et qu'**au moins un niveau de priorité
   ne peut pas être servi en entier** — la règle que le calcul applique déjà
   (le plus grand partage commun d'un niveau est inférieur à 1). Une eau
   inconnue n'est pas une pénurie (D-003).
2. **Une planche reçoit un conseil** quand les trois conditions tiennent :
   - sa priorité de la semaine n'est pas « haute » ;
   - la répartition ne la sert pas en entier (besoin partiellement satisfait,
     non satisfait, non retenue, choix nécessaire, en attente de la priorité
     précédente, allocation sous le seuil) et une alimentation compatible
     existe (une planche sans aucune alimentation compatible n'a rien à
     gagner d'une priorité) ;
   - au moins une de ses cultures du jour a un **stade connu** (calculé ou
     déclaré, Kc connu) et **sensible**.
3. **Un stade inconnu ne donne aucun conseil.** Un stade que le module place
   d'après la date d'implantation et le calendrier, sans déclaration qui le
   place, donne le conseil avec la mention **« stade d'après le
   calendrier »** : la règle du « stade deviné » de la n° 6 (F711), par la
   même fonction.

### 3.3 L'affichage et le geste (réponses 2 et 5) — F732

1. **Où** : sur « Ressources et pompes », dans « Faisabilité et répartition
   de l'eau » (`#repartition`), après les tuiles de tête et avant les niveaux
   de priorité : un bloc « Conseil : servir d'abord les stades sensibles ».
   Rien hors pénurie, rien sans planche conseillée.
2. **Tous les conseils**, regroupés **par culture de référence** ; dans un
   groupe, les planches par **déficit relatif décroissant** (le déficit
   relatif du besoin de la semaine ; un déficit inconnu en dernier, puis
   l'ordre naturel des noms) ; les groupes par le plus fort déficit de leurs
   planches. Une planche qui porte deux cultures sensibles paraît dans les
   deux groupes ; un seul geste la sert.
3. **Une ligne** : la planche et son jardin, la culture et la série, le stade
   (avec sa mention), le déficit relatif, la priorité de la semaine, et le
   bouton **« Adopter »**. Une phrase dit que rien ne change sans ce geste et
   que la priorité vaut pour la semaine en cours seulement.
4. **« Adopter »** enregistre la **priorité haute de cette planche pour la
   semaine en cours seulement**, par le chemin d'un changement de priorité à
   la main (`irrigation_bed_need_decisions`, qui est par semaine : la semaine
   suivante reprend sa propre priorité, « normale » si rien n'est choisi) ;
   le besoin manuel de la semaine, s'il y en a un, est gardé ; le plan se
   recalcule comme après tout changement de priorité ; la répartition se
   relit. Le serveur vérifie d'abord que le conseil tient encore ; sinon il
   n'écrit rien et le dit. Le journal des décisions garde l'origine du geste
   (« conseil de stade »).
5. **Jamais appliqué seul, jamais un terme** : le conseil se calcule après la
   répartition, qu'il lit sans la changer.
6. **Le planning à parts égales** : quand la ferme a choisi la part égale
   pour toutes (3.5, réglage du planning), une phrase dit que la priorité
   haute change la répartition de cet écran, pas celle du planning.
7. **Les cases** : le conseil est une partie de « Ressources et pompes » qui
   demande « Besoin par culture » (le socle, P1). Sans elle, en pénurie, une
   ligne le dit à la place du bloc.

**Précisions du code (21 novembre 2026, D-290).** F736 : la liste
préremplie dans une table commune que seule une migration écrit (41 lignes,
28 cultures), les choix de la ferme dans une table d'un espace ; la culture
désignée par sa clé commune, que la version de la ferme garde ; la ferme
n'enregistre que ce qui diffère de la liste, et cocher comme elle efface la
ligne. Migration 0044 sur la branche depuis la fusion de la n° 3 (0043),
0045 si celle de la n° 7 passe avant. F737 : le pli « Stades sensibles au
manque d'eau », fermé, dans la fiche de chaque culture utilisable, sa ligne
qui compte les stades sensibles, l'analogie dite, les sources dans un pli,
« Reprendre la liste préremplie » quand la ferme a un choix ; enregistrer ne
recalcule rien. F738 : une culture dont l'ET0 du jour manque garde son stade
et compte ; un déficit inconnu se lit « Non calculable » avec sa raison ; un
échec de lecture laisse l'écran sans conseil, jamais en panne. F739 :
« Adopter » passe par le service, qui relit la répartition, refuse une
semaine changée, n'écrit rien pour une planche déjà haute ou un conseil qui
ne tient plus, garde le besoin manuel, sa raison et le besoin calculé qu'il
remplaçait, et met `origin: "stage-advice"` au journal des décisions.

**Preuves.** Tests du domaine : hors pénurie, eau inconnue, priorité déjà
haute, planche servie en entier ou sans alimentation compatible, stade
inconnu, stade d'après le calendrier, stade déclaré, choix de la ferme contre
liste préremplie, nom de stade changé, deux cultures sur une planche, ordre
des groupes et des planches. Tests de persistance : un choix de la ferme A ne
se lit pas chez B ; B ne désigne pas la culture propre de A ; l'effacement
d'une ferme emporte ses choix ; la liste commune reste. P56, à 390 et
1440 px : un stade coché sur « Besoin par culture », la pénurie provoquée, le
conseil sur « Ressources et pompes », « Adopter », la priorité haute, le
conseil disparu.

## 4. n° 5 — Écart prévu/réel expliqué

**Aujourd'hui.** Le module dit l'écart du manque d'eau avant et après une
replanification (`lib/domain/planning/changes.ts`) et l'écart d'un plan à la
faisabilité (`lib/domain/feasibility-plan-gap.ts`), jamais l'écart entre
l'eau prévue et l'eau apportée sur plusieurs semaines.

### 4.1 Ce qui se compare (réponses 6 et 9) — F733

1. **La période** : les **trois dernières semaines complètes** (lundi à
   dimanche, heure de Paris), avant la semaine en cours.
2. **L'eau prévue** d'une semaine, par planche : la somme des quantités
   prévues des irrigations de la planche qui **commencent** dans la semaine
   (le début prévu, sinon le début réel d'une irrigation saisie après coup,
   dont la quantité prévue est 0), **sauf les irrigations annulées** : une
   annulation, du maraîcher ou d'une suggestion du plan qu'il applique, est un
   choix de ne pas arroser, que le module ne sait pas distinguer (le journal
   des irrigations les écrit de la même façon). Les compter inventerait un
   écart chaque fois que la pluie fait annuler un arrosage.
3. **L'eau apportée** : la somme des quantités réelles des mêmes irrigations
   faites (en entier ou en partie).
4. **Une semaine jugée** a une eau apportée connue et une eau prévue
   supérieure à 0. Une semaine où une irrigation prévue de la planche attend
   encore d'être confirmée (ni faite, ni annulée) n'est pas jugée : l'eau
   apportée n'y est pas connue (D-003). Une semaine sans eau prévue n'est pas
   jugée : l'écart n'y a pas de sens.
5. **Le signal**, par planche (réponse 6) : l'écart d'une semaine est
   (apportée − prévue) / prévue ; il y a signal quand **chacune des trois
   semaines est jugée, avec un écart de plus de 20 % dans le même sens**.
6. **Les données minimales** (réponse 9) : au moins **trois irrigations
   faites** de la planche sur la période. Sinon, **silence** : ni ligne, ni
   « 0 ».

### 4.2 Les causes (réponse 7) — F734

Une cause n'est dite **que si les données la soutiennent** ; sinon la ligne
dit **« cause non déterminée »**. Plusieurs causes soutenues se disent
toutes.

1. **« Débit réel du matériel plus faible que celui réglé »** — quand plus
   d'eau a été apportée que prévu. Les données : au moins trois irrigations de
   la planche sur la période, prévues puis faites en entier **avec le même
   réglage**, chacune **plus de 20 % plus longue que prévu** : le maraîcher
   arrose plus longtemps que le plan pour apporter ce qu'il faut. Proposition :
   le débit du réglage multiplié par la médiane des rapports « durée prévue /
   durée réelle » de ces irrigations (la médiane : une minuterie oubliée une
   fois ne fait pas la proposition) ; en goutte-à-goutte le débit, en
   aspersion chaque point du profil ; arrondi au dixième de mm/h.
2. **« Objectif plus haut que le besoin de la culture »** — quand moins d'eau
   a été apportée que prévu. Les données : l'objectif proposé de la semaine en
   cours (5 quater) est adoptable et **plus bas de plus de 20 %** que
   l'objectif de la planche. Proposition : adopter l'objectif proposé, par le
   geste de la 5 quater. Demande « Besoin par culture ».
3. **« Pluie mesurée différente de la réanalyse »** — une planche hors abri.
   Les données : sur la période, les jours qui ont à la fois une pluie mesurée
   et une réanalyse ; leurs sommes diffèrent **de plus de 20 % et d'au moins
   5 mm**, dans le sens de l'écart (la pluie mesurée plus forte quand moins
   d'eau a été apportée que prévu, plus faible quand plus d'eau a été
   apportée) ; et au moins un jour de la période **sans pluie mesurée**, où le
   plan a compté la réanalyse. Pas de valeur à adopter : le lien « Saisir la
   pluie mesurée ».

### 4.3 L'ajustement et l'affichage (réponse 8) — F735

1. **Une proposition à adopter d'un geste** — le débit du réglage, ou
   l'objectif —, **jamais appliquée seule**. Le serveur recalcule l'écart et
   vérifie que la proposition tient encore ; sinon il n'écrit rien et le dit.
2. **Le débit** s'enregistre comme un réglage changé à la main (provenance
   « saisi » : le module ne mesure pas le débit, D-003) ; **l'objectif**
   comme l'adoption d'un objectif proposé (origine « proposition adoptée ») ;
   le plan se recalcule comme après ces gestes à la main. **L'historique reste
   immuable** (D-006) : les irrigations passées gardent leur copie du
   réglage, l'objectif garde ses révisions.
3. **Où** : sur « Planning de la semaine », un bloc « L'eau apportée s'écarte
   du prévu », présent **seulement** quand une planche a un signal : par
   planche, les trois semaines (prévu, apporté, écart), la cause ou « cause
   non déterminée », la proposition et son bouton.
4. **Les cases** : le bloc demande « Planning de la semaine » (le prévu) ; la
   cause de l'objectif demande « Besoin par culture » ; sans elle, cette cause
   ne se cherche pas.

**Précisions du code (22 novembre 2026, D-291).** F740 : les irrigations de
la période se lisent par date, quelle que soit leur saison ; le bloc ne se
calcule que pour la saison du jour ; les quantités se comparent en
centièmes de millimètre entiers ; « hors abri » est le jardin classé en
plein champ, la pluie n'est pas une cause sous abri ni dans un jardin à
classer ; la cause de l'objectif est une partie de « Planning de la
semaine » qui demande « Besoin par culture », dite par une ligne quand elle
manque (P1) ; un échec de lecture laisse le planning sans bloc, jamais en
panne. F741 : une semaine ne se juge qu'avec les réglages d'aujourd'hui ;
après un débit adopté, un réglage retouché ou un matériel retiré, la
planche se juge sur les semaines qui suivent ; après un objectif proposé
adopté cette semaine, plus bas de plus de 20 %, la planche qui reçoit moins
que prévu se tait. F742 : le bloc après les suggestions du plan et avant la
semaine ; par planche le sens, le tableau des trois semaines, les causes
ou « Cause non déterminée » ; le débit dit la médiane de l'allongement, le
réglé et le proposé ; le lien « Saisir la pluie mesurée » quand la ferme
coche « Objectifs et besoins ». F743 : « Adopter » passe par le service, qui
relit l'écart, refuse une semaine changée et n'écrit rien pour une
proposition qui ne tient plus ; le débit par le chemin d'un réglage changé
à la main, puis le plan recalculé sous « un réglage appliqué changé » ;
l'objectif par le geste de la 5 quater, puis le plan recalculé sous « un
objectif hydrique changé ».

**Preuves.** Tests du domaine : moins de trois irrigations, une semaine non
jugée (irrigation non confirmée, rien de prévu), écarts de 20 % tout juste et
au-delà, sens mêlés, irrigations annulées, irrigation saisie après coup,
chaque cause soutenue et non soutenue (minuterie oubliée une fois comprise),
planche sous abri, « cause non déterminée ». Tests du service : la lecture
des trois semaines, la vérification avant d'adopter. P57, à 390 et 1440 px :
trois semaines d'irrigations plus longues que prévu, le bloc, la cause du
débit, « Adopter », le réglage changé, le bloc disparu.

## 5. Questions pour le porteur

Aucune n'est ouverte : **la liste préremplie des stades sensibles** (§3.1.3)
lui a été présentée avec ses sources et validée telle quelle le 21 novembre
2026 à 22 h 51. Les précisions de ce contrat qui ne sont pas dans ses
réponses suivent l'option la plus prudente et restent modifiables par lui :
le nom du stade qui garde un choix (§3.1.2), la pénurie à eau connue
(§3.2.1), les irrigations annulées hors du prévu (§4.1.2), la médiane et les
trois irrigations du débit (§4.2.1), l'objectif proposé de la semaine en
cours (§4.2.2), les 5 mm de la pluie (§4.2.3).
