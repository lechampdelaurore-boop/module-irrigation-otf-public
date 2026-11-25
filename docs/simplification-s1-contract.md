# Contrat — Simplifier l'usage du module, lot S1 : le chapeau et les mots (25 novembre 2026)

Roadmap section 6 terdecies, ligne 33 de l'ordre d'exécution. Décisions
**D-327** (le chantier : six lots retenus) et **D-328** (ce lot, à écrire par
sa première PR, comme D-326 pour H3). Précisions **F822 et suivantes**,
parcours **P61** (P60 est le dernier).

À ne pas confondre avec le lot « S1 — Style un peu plus joli » de la section
5 sexies (R5, close) : ici, « S1 » est le premier des six lots de la
simplification.

## 1. Origine

Le 25 novembre 2026 à 9 h 26, le porteur écrit que le logiciel « est très
complexe à utiliser » et demande de le simplifier. Le diagnostic
(`/mnt/project-files/audit-ergonomie/diagnostic-simplicite-2026-11-25.md`,
sans code, sur `main` ecddc14, complété le jour même sur la ferme réelle dans
le Chrome du porteur, en lecture seule) pose sept causes et propose « trois
endroits, deux niveaux, un chemin ». Le porteur répond « oui » aux quatre
choix entre 11 h 59 et 12 h 01 (cartes de décision) ; **il retient les six
lots S1 à S6, dans l'ordre S1, S2, S3, S5, S4, S6, et les mots du tableau de
la section 5 tels que proposés** (D-327). Il demande ensuite que les lots
s'enchaînent sans nouveau « vas-y » : contrat, registres, puis code.

S1 est le plus petit lot. Il touche les causes 3 (les mots), 6 (le chapeau
de chaque page) et 7 (un même chiffre qui change d'une page à l'autre). Il ne
change aucun contrat de page validé : ce sont des textes et de la mise en
page.

Logiciel multi-fermes : rien ci-dessous ne dépend de la taille ni du contenu
d'une ferme ; les mesures se font sur les données des parcours (dix-huit
jardins au plus), jamais sur la ferme du porteur.

## 2. Livraison en trois PR, une à la fois

| PR | Contenu | Cause | Preuve |
| --- | --- | --- | --- |
| 1 · Le chapeau d'une ligne | la ligne « Dernière lecture réussie… Actualiser » n'apparaît que si la lecture a échoué ou date ; la saison seulement là où elle sert ; les explications fixes de tête de page passent dans le « ? » | 6 | tests, P61 (390 et 1440 px) |
| 2 · Les mots | les titres, boutons et phrases du tableau de la section 5, un seul endroit pour ces libellés | 3 | test de garde, P61 étendu |
| 3 · Un seul objectif | une seule façon de dire l'objectif de la ferme, partout ; l'écart des 2,7 et 5,2 mm établi d'abord (point ouvert S1-O1) | 7 | tests du domaine, P61 étendu |
| 3 bis · L'Historique comme « Aujourd'hui » | l'objectif d'une période sur les seules planches qui en ont un, l'écart sur ces mêmes planches, et la page dit combien n'en ont pas (D-329, section 5 bis) ; Opus 5.5 · Max | 7 | tests du domaine et de la persistance à deux fermes, démonstration rejouée, P61 étendu |

Chaque PR : `lint`, `typecheck`, `test`, `build`, `knip`, `push:check`,
`weather:check`, `site:check` collés ; `e2e` joué en local sur les parcours
touchés, la suite complète par la CI ; registres à jour dans la même PR
(roadmap : tableau de la section 1, ordre de la section 2, bloc détaillé).
Avant d'écrire, chaque PR relève l'état de départ (contrôles, mesures à
390 px) et le colle dans sa description (consigne 6 du projet).

## 3. PR 1 — Le chapeau d'une ligne

**Constat** (diagnostic, causes 2 et 6) : avant le contenu, chaque page porte
la barre de la ferme, le titre, le choix de la saison, la ligne « Dernière
lecture réussie le … · Actualiser » (`.sync-card` de
`app/irrigation/shell/irrigation-shell.tsx`), puis un paragraphe
d'explication. Sur « Arrosages », le premier champ commence vers 670 px ; sur
« Aujourd'hui », la carte vers 480 px.

**Règles.**

1. **Le titre et son « ? », rien d'autre.** Le chapeau garde le titre de la
   page, le bouton « ? » (`PageTitle`, qui existe) et, quand elle sert, la
   saison dans la ligne du titre au téléphone (F7 existant).
2. **La ligne de lecture ne se montre que pour dire un problème.** Elle
   apparaît quand la lecture d'Ouvre ta ferme a échoué (la ferme tourne sur
   son cache, `warning` existant) ou quand la dernière lecture réussie date de
   plus de 24 heures (F822, option recommandée, modifiable). Sinon elle
   disparaît. Le bloc « Données en cache » (`cache-warning`) reste tel quel.
3. **« Actualiser » ne disparaît pas.** Le geste passe dans le menu du compte
   (`app/irrigation/shell/account-menu.tsx`), avec la date de la dernière
   lecture réussie (F823) ; quand la ligne de lecture s'affiche, elle garde
   son lien. L'adresse `?refresh=1` et son nettoyage restent inchangés.
4. **La saison se choisit là où elle sert.** Elle reste sur les pages qui
   montrent une semaine, un historique ou une configuration de saison :
   planning, besoins, historique, sol, cultures, matériel, ressources, alertes
   cultures, réglages (quand l'espèce en dépend) ; elle quitte « Arrosages »,
   où l'on travaille presque toujours dans la saison en cours (F824). Elle
   reste dans l'adresse : tous les liens existants (notifications comprises)
   gardent leur effet ; une autre saison s'ouvre depuis « Historique » (F825).
   Le regroupement en « Semaine » et « Ma ferme » vient avec S3 : S1 ne déplace
   aucune page. (S3 l'a fait : trois endroits, D-331,
   `docs/simplification-s3-contract.md`.)
5. **Les explications fixes passent dans le « ? ».** Un paragraphe qui dit
   chaque jour la même chose (exemple : « L'eau que le sol de chaque planche
   tient à la disposition des racines… », `soil-reserve-section.tsx`) quitte le
   corps de la page ; ce qu'il dit et que `lib/domain/features/help.ts` ne dit
   pas encore y est ajouté (F826). Un texte qui dépend de la donnée du jour
   (« 7 planches : pluie réelle incomplète… », une restriction, une donnée
   manquante) **reste en place** : c'est un état, pas une explication.
6. **Inventaire d'abord.** La PR 1 relève, page par page, les paragraphes de
   tête (douze pages) et dit pour chacun : déplacé dans le « ? », ou gardé et
   pourquoi. L'inventaire est collé dans la PR et ajouté à ce contrat
   (section 9).

**Budget.** La PR mesure, à 390 px, la position du premier bloc utile de
chaque page (premier champ, première carte, premier tableau) avant et après.
Visé : au plus 400 px du haut de la page pour toutes les pages sauf
« Aujourd'hui », dont la carte d'arrosage reste du ressort de S2 ; sur
« Aujourd'hui », le gain est au moins la hauteur de la ligne de lecture
retirée. P61 fixe chaque borne sur la mesure faite, comme le lot J (contrat
`audit-ergonomie-2026-11-19-lot-j-contract.md`, section 2) ; une page qui la
dépasse le dit.

## 4. PR 2 — Les mots

**Principe.** Le premier niveau (titres, boutons, phrases d'en-tête, noms du
menu) parle comme le champ. Le mot du calcul reste là où il informe : dans
le « ? » et dans le détail repliable, à côté du mot simple, pour que le
maraîcher qui lit un document d'Ouvre ta ferme ou de Tlaloc retrouve son
terme. « RFU » et « ET0 » ne disparaissent pas du module.

**Les mots** (tableau du diagnostic, section 3, cause 3, **accepté tel quel
par le porteur le 25 novembre 2026**) :

| Le module dit | Il dira |
| --- | --- |
| Objectifs hydriques, objectif hebdomadaire | Eau visée cette semaine |
| Reste à apporter | Il manque encore |
| Besoins d'irrigation | Ce qu'il reste à arroser |
| Faisabilité et répartition de l'eau | Y a-t-il assez d'eau ? |
| Volume mobilisable, disponibilité physique | Eau utilisable |
| Réserve utile (RFU) | Ce que votre sol retient (« RFU » dans le détail) |
| ET0 | Soif du jour (« ET0 » dans le détail) |
| Culture de référence, correspondance des espèces | À quelle culture ressemble cette espèce ? |
| Coefficients culturaux, profils racinaires | Réglages fins des cultures (pour les experts) |
| Réglage (d'un matériel), apport horaire | Ce que ce matériel apporte en une heure |
| Créneaux protégés | Heures où l'on n'arrose pas |
| Reliquat | Ce qui reste d'un arrosage arrêté |
| Par périmètre, journées-planche, historisés, réanalyse, totaux partiels | décrits en mots simples ou rangés dans le détail (F827) |

**Règles.**

1. **Un seul endroit.** Les libellés concernés sont rassemblés dans un module
   de libellés du domaine (`lib/domain/`), appelé par l'interface : une
   règle d'écriture ne se copie pas (AGENTS.md, interdits). La PR dit où.
2. **Relevé d'abord.** Avant d'écrire, la PR relève par recherche dans le
   code chaque occurrence visible de la colonne de gauche. Relevé indicatif
   du 25 novembre 2026, en nombre de fichiers de `app/` et `lib/` qui portent
   le mot : « Objectif hydrique » 4, « Reste à apporter » 1, « Faisabilité et
   répartition » 1, « Volume mobilisable » 1, « Réserve utile » 1, « Culture de
   référence » 5, « Correspondance des espèces » 2, « Coefficients culturaux »
   6, « Créneaux protégés » 2, « Reliquat » 3, « journées-planche » 6 ; l'ET0
   est partout (48 fichiers) : seul son premier niveau change.
3. **Ce qui ne change pas de nom.** Les identifiants du code, les adresses
   des pages, les en-têtes de l'export CSV de l'historique, les ancres
   existantes et les textes des notifications (déjà validés par leurs
   contrats) gardent leurs mots (F828). L'écart entre les mots de l'écran et
   ceux d'une notification est noté comme dette à traiter après S6.
4. **Les noms de pages du menu** changent seulement si le tableau les nomme
   (« Objectifs et besoins », « Ressources et pompes »…) ; le rangement du
   menu est S3 (fait : trois endroits, D-331).
5. **Test de garde.** Un test échoue si un mot de la colonne de gauche
   réapparaît dans un titre, un bouton ou une phrase de premier niveau ; la
   liste des endroits où il est permis (le « ? », les replis de détail) est
   écrite dans le test, avec sa raison.
6. **La visite guidée et l'écran de bienvenue** utilisent les mêmes mots.
   Les parcours qui lisent un libellé (e2e) sont réécrits avec lui.

## 5. PR 3 — Un seul objectif, partout

**Constat** (cause 7) : sur la démonstration, la même semaine, « Aujourd'hui »
dit 23,4 mm, « Historique » 16,5 mm et « Objectifs et besoins » « objectif non
défini ». Sur la ferme réelle du porteur, « Aujourd'hui » et « Historique »
disent le même chiffre (5,2 mm), **mais la ligne de résumé d'« Objectifs et
besoins » dit « objectif 2,7 mm · irrigué 2,8 mm » quand « Aujourd'hui » dit
5,2 mm et 2,1 mm d'irrigation** (constat du 25 novembre 2026, 11 h 55, lecture
seule ; cause non vérifiée, piste : deux façons de faire la moyenne entre les
jardins).

**Point ouvert S1-O1 — inscrit, non examiné.** La PR 3 commence par établir
la cause dans le code, avant toute modification, et la consigne ici
(section 9). Trois issues :

- **les pages disent le même chiffre, mais l'une l'arrondit ou le prend sur
  un autre périmètre** : on aligne le texte ;
- **une page moyenne les jardins sans pondérer par la surface** : c'est un
  défaut de calcul contre la règle de l'AGENTS.md (« Σ(mm × m²) / Σ(m²) ») ;
  il se corrige dans la PR 3, avec test à deux fermes, et se dit au porteur ;
- **la différence tient à une décision d'agronomie ou de périmètre qui n'est
  pas écrite** : la PR 3 s'arrête, le dit, et le porteur tranche (une
  question, avec recommandation). Le reste du lot n'attend pas.

**Règles.**

1. **Une seule phrase** dit l'objectif de la ferme sur toutes les pages qui en
   parlent, par exemple « 23,4 mm visés sur les 7 planches qui ont un
   objectif » ; les planches sans objectif sont comptées à voix haute, jamais
   à zéro (D-003).
2. **Un seul calcul.** La phrase vient d'une fonction unique de `lib/domain/`,
   appelée par « Aujourd'hui », « Historique et cumuls », « Objectifs et
   besoins » et le planning ; aucune page ne refait sa moyenne (AGENTS.md,
   duplication d'une règle).
3. **Rien ne change dans le besoin.** L'objectif, l'écart, l'ET0 (information
   seulement, D-010) et l'objectif automatique (D-309) sont ceux d'aujourd'hui.

## 5 bis. PR 3 bis — L'Historique compte l'objectif comme « Aujourd'hui » (D-329)

**Origine.** La PR 3 a établi pourquoi, sur la démonstration, « Historique
et cumuls » disait 16,5 mm quand « Aujourd'hui » disait 23,4 mm la même
semaine : l'Historique divisait par toute la surface du périmètre, les
planches sans objectif comptées à zéro (D-036), et le disait sous son
chiffre (F444). Le porteur a choisi le 25 novembre 2026 à 13 h 35 de compter
comme « Aujourd'hui » (D-329, qui remplace D-036 sur ce point). Règle de
calcul sensible (l'objectif et l'écart d'une période) : une PR à part, en
Opus 5.5 · Max (section 10). Cette section l'écrit avant le code, l'écart
compris, comme D-329 le demande.

**Règles.**

1. **L'objectif de chaque planche sur la période ne change pas.** Jour par
   jour, un septième de l'objectif saisi le plus précis qui la couvre,
   compté à partir de son jour de pose (D-034, D-039) ; un jour sans
   objectif saisi, la valeur de l'objectif automatique, quand la ferme l'a
   allumé (D-309) ; rien sinon. Une planche **a un objectif sur la
   période** dès qu'un de ses jours en a un, même de 0 mm ; une planche
   dont aucun jour n'en a n'a pas d'objectif sur la période (un jour où
   l'objectif automatique s'applique sans valeur n'en donne pas, F778).
2. **L'objectif du périmètre** (ferme, parcelle, jardin ou planche, dans la
   vue « Par lieu » ; chaque série, dans la vue « Par série ») est la
   moyenne pondérée par la surface des objectifs de ses planches, **sur les
   seules planches qui en ont un** : la fonction unique de la PR 3,
   `farmObjective` (`lib/domain/farm-objective.ts`), la surface occupée
   pesant pour une série. Une planche sans objectif n'entre ni dans la somme
   ni dans la surface : elle n'est jamais comptée à zéro (D-003), elle est
   dite (règle 5). Aucune planche avec un objectif : ni objectif ni écart,
   comme avant. Sur une semaine, le chiffre est celui d'« Aujourd'hui » et
   d'« Objectifs et besoins » pour cette semaine : même objectif de planche
   (`objectiveForBed`), même moyenne.
3. **L'écart, sur le même périmètre.** L'écart reste `objectif − (irrigation
   réelle + pluie réelle)`, positif en déficit ; l'ET0 n'y entre pas
   (D-010). Quand une partie seulement des planches a un objectif,
   l'irrigation et la pluie de l'écart sont celles de **ces seules
   planches** : l'eau que chacune a reçue sur la période, pondérée par sa
   surface, Σ(mm × m²) / Σ(m²), la pluie à zéro sous abri (D-032), inconnue
   sur un jardin à classer (F583) ; c'est ainsi qu'« Aujourd'hui » chiffre
   l'eau reçue (F280). Quand toutes les planches ont un objectif, l'écart
   est celui d'avant, au millimètre près. Une pluie réelle incomplète sur
   ces planches laisse l'écart indisponible, comme avant ; elle ne le rend
   pas indisponible quand ces planches sont toutes sous abri.
4. **Ce qui tient de D-036.** Un objectif posé en cours de période ne
   compte que pour ses jours couverts, et l'eau reçue sur toute la période
   se compare à l'objectif de ces jours ; le nombre de journées-planche
   couvertes reste dit, désormais sur les seules planches qui ont un
   objectif, quand des jours leur manquent. Une journée-planche où
   l'objectif automatique s'applique sans valeur n'est jamais comptée pour
   zéro et reste dite dans les avertissements (F778).
5. **Ce que la page dit.** Vue « Par lieu », sous l'objectif : la phrase de
   la PR 3, « 7 planches sur 10 ont un objectif », quand toutes n'en ont
   pas (rien quand toutes en ont un), puis, quand des jours manquent à ces
   planches, « objectif posé sur 40/49 journées-planche » ; « Aucun objectif
   sur la période » sans aucun. La phrase « Moyenne sur toute la surface,
   les planches sans objectif comptées à 0 » (F444) disparaît. Sous
   l'écart, quand une partie seulement des planches a un objectif : « Eau
   reçue par ces 7 planches : 12,4 mm » (« par cette planche » pour une
   seule), pour que l'écart se relise « objectif moins eau reçue ». Un
   avertissement ne dit l'écart indisponible que s'il l'est (règle 3, sous
   abri). Vue « Par série » : la ligne des planches de la carte ajoute
   « 2 planches sur 3 ont un objectif » quand toutes n'en ont pas ; le
   tableau des planches garde « — » pour une planche sans objectif.
6. **L'export CSV garde ses colonnes.** « Objectif hydrique » et « Écart à
   l'objectif » suivent les règles 2 et 3 ; « Irrigation + pluie réelle »
   est l'eau que l'écart compare à l'objectif, sur les mêmes planches
   (règle 3) : l'écart est toujours l'objectif moins cette colonne.
   « Volume irrigation », « Apport irrigation », « Surface irriguée » et
   « Pluie réelle » restent les cumuls de tout le périmètre.

**Ne change pas.** Les cumuls de tout le périmètre (volume, apport
d'irrigation en mm, surface irriguée, pluie réelle, soif de la période) ;
l'objectif de chaque planche, et donc le tableau des planches d'une série ;
l'objectif restant d'une série (F779) ; le besoin, « Aujourd'hui »,
« Objectifs et besoins », le planning, l'objectif automatique (D-309,
D-317, D-318) ; aucune donnée, aucune migration. Logiciel multi-fermes :
la règle vaut pour toute ferme et tout périmètre, quelle que soit sa
taille.

**Preuve.** Tests du domaine (deux fermes : chaque planche avec un
objectif, rien ne change ; une partie seulement, le chiffre d'« Aujourd'hui »
et l'écart sur ces planches ; une semaine égale à « Aujourd'hui » quels que
soient les objectifs posés en cours de semaine, retirés ou automatiques ;
la vue « Par série ») ; test de persistance à deux fermes par le service de
l'Historique et celui des besoins, et chaque ferme de démonstration rejouée
à son moment ; parcours P61 étendu : sur la ferme des parcours, la carte
« Objectif » de l'Historique (semaine en cours, toute la ferme) dit le
chiffre et la portée de la tuile « Eau visée cette semaine »
d'« Aujourd'hui ». Contre-épreuve.

## 6. Ce qui ne change pas

- Aucun calcul, aucune règle d'agronomie, aucune donnée, aucune migration ; la
  seule correction de calcul possible est celle de la section 5, deuxième
  issue, dite au porteur, et le seul calcul changé est celui que le porteur
  a décidé pour l'Historique (D-329, section 5 bis, PR 3 bis).
- Aucune fonction retirée, aucune page déplacée, aucune adresse changée ; les
  cases des fonctionnalités à la carte restent.
- Les contrats validés des pages (« Aujourd'hui », planning, besoins,
  historique, 3.8) ne changent pas : S2, S3, S4 et S6 les modifieront, chacun
  par son contrat. L'Historique ne change que par D-329 : son objectif et son
  écart (section 5 bis).
- La charte graphique, les cibles de 44 px, les contrastes mesurés.
- L'honnêteté du calcul : une donnée manquante reste dite, prévu, estimé et
  observé restent distingués par le mot.

## 7. Tests et preuves

- **Domaine** : la fonction de l'objectif de la ferme à plusieurs fermes et
  plusieurs jardins (pondération par la surface, planches sans objectif) ;
  le module de libellés.
- **Interface** : la ligne de lecture selon la source et l'âge de la lecture
  (absente, échec, plus de 24 h), « Actualiser » dans le menu du compte, la
  saison présente ou non page par page, le test de garde des mots.
- **Parcours P61**, à 390 et 1440 px : une page sans ligne de lecture, le
  geste « Actualiser » depuis le menu du compte, l'ouverture de « Arrosages »
  sans saison puis d'« Historique » sur une autre saison, la position du
  premier bloc utile de chaque page contre son budget, les mêmes mots dans la
  visite guidée.
- **Contre-épreuve** (habitude du dépôt) : des altérations du chapeau, des
  libellés et de la phrase de l'objectif font chacune échouer un test.
- **Recette** après la mise en ligne de chaque PR, dans le Chrome du porteur,
  avec son accord, en lecture seule : les douze pages à 390 px, hauteur et
  position du premier bloc ; le constat est à l'assistant, le jugement des mots
  au porteur (D-014).

## 8. Risques

| Risque | Parade |
| --- | --- |
| Un parcours ou un test lit un libellé qui change | relevé d'abord ; les tests suivent le libellé dans la même PR |
| Une explication déplacée dans le « ? » faisait aussi office d'avertissement | règle 5 : seul le texte fixe bouge ; l'inventaire est relu page par page |
| La ligne de lecture masquée cache une panne | elle s'affiche dès l'échec ou après 24 h ; le bloc « Données en cache » est inchangé |
| Les mots simples dérivent du sens du calcul | le mot technique reste dans le « ? » et le détail ; le porteur a accepté le tableau |
| Deux vocabulaires (écran, notification) | dette notée, traitée après S6 (F828) |
| Une saison ne se choisit plus depuis « Arrosages » | l'adresse la garde, « Historique » ouvre les autres saisons (F825) |

## 9. À remplir par les PR

- Inventaire des paragraphes de tête, page par page (PR 1) : ci-dessous.
- Positions du premier bloc utile avant et après, page par page (PR 1) :
  ci-dessous.
- Occurrences relevées des mots du tableau et ce qu'elles deviennent (PR 2).
- Cause établie du point ouvert S1-O1 et issue choisie (PR 3).
- Précisions tranchées en codant l'Historique comme « Aujourd'hui » (PR 3 bis,
  D-329).

### 9.1 PR 1 — Inventaire des paragraphes de tête (25 novembre 2026)

Relevé à 390 px sur les données des parcours (ferme de démonstration, toutes
les pages), puis dans le code. « Déplacé » : la phrase quitte la page, le
« ? » dit ce qu'elle disait (`lib/domain/features/help.ts`, F826).

| Page | Paragraphe de tête | Sort |
| --- | --- | --- |
| Aujourd'hui | l'en-tête du jour (« Mercredi 25 novembre », état du plan, pastilles) | gardé : c'est l'état du jour, et la carte est du ressort de S2 |
| Arrosages | « Calculez l'apport, lancez un minuteur fiable ou conservez une irrigation déjà réalisée. » | déplacé (le « ? » le disait déjà) ; les compteurs « en cours, à venir, archivées » restent : un état |
| Planning de la semaine | « Des propositions de créneaux, du calcul à dimanche, que vous validez une par une, par jour ou toutes ensemble. Rien n'est arrosé sans vous. » | déplacé ; « du calcul jusqu'à dimanche », « une par une, par jour ou toutes ensemble » et « Rien n'est arrosé sans vous » ajoutés au « ? » |
| Objectifs et besoins | « Suivi hebdomadaire du lundi au dimanche. Ces données alimentent le calcul des besoins affiché ensuite. » | déplacé ; « La semaine va du lundi au dimanche » ajouté au « ? » ; la phrase des planches à pluie incomplète, plus bas, reste (un état) |
| Historique et cumuls | « Analysez l'eau réellement appliquée, la météo observée et les objectifs historisés. » | déplacé ; « l'eau réellement apportée, la météo observée et les objectifs de chaque semaine » ajouté au « ? » |
| Réserve du sol | « L'eau que le sol de chaque planche tient à la disposition des racines, estimée jour par jour à partir de la réserve utile (RFU) de sa parcelle. C'est une information : elle ne change ni le besoin, ni le plan, ni les priorités. » | déplacé ; la RFU et la phrase d'honnêteté (D-041) ajoutées au « ? » |
| Besoin par culture | « Une culture ne boit pas autant à la levée qu'en pleine saison. Le module suit le stade… choisie dans Réglages. » | déplacé ; la levée et le stade suivi ajoutés au « ? », qui disait déjà « Vérifiez dans Réglages… » |
| Matériel et placement | aucun paragraphe de tête (choix de la parcelle, fil d'Ariane, onglets) | rien à déplacer |
| Ressources et pompes | « Origines, réserves, connexions et estimation du volume mobilisable. » | déplacé ; les connexions et « L'eau des jours à venir » ajoutées au « ? » ; le surtitre « Disponibilité physique » attend la PR 2 (les mots) |
| Alertes météo | « Une notification quand la prévision de la commune franchit le seuil que vous choisissez, sans marge ajoutée. » | déplacé (le « ? » le disait) ; le repli « Pour le gel : la prévision est celle de l'air à 2 m » **reste** : une mise en garde (F830) |
| Alertes cultures | « Le gel selon chaque culture, l'arrêt d'arrosage… à reconsidérer. Les seuils sont des repères ; la prévision est celle de l'air à 2 m… » | la première phrase déplacée (le « ? » la disait) ; **la seconde reste** : une mise en garde sur le gel (F830) |
| Réglages | « Seules les fonctionnalités cochées s'affichent et tournent… Décocher n'efface rien… » | déplacé (le « ? » le disait) ; décocher une case dit déjà, dans sa confirmation, ce qui reste enregistré |

### 9.2 PR 1 — Premier bloc utile à 390 px, avant et après

Mesuré le 25 novembre 2026 sur les données des parcours, bandeau du choix des
fonctionnalités fermé, depuis le haut de la page ; le parcours P61 fixe ces
bornes.

| Page | Premier bloc utile | Avant | Après | Borne P61 |
| --- | --- | --- | --- | --- |
| Aujourd'hui | l'en-tête du jour | 152 px | 108 px | 120 px (gain : la ligne de lecture, 44 px) |
| Arrosages | « Recevoir les alertes » ou le formulaire | 393 px | 287 px | 400 px |
| Planning de la semaine | « Calculer le plan de la semaine » | 309 px | 203 px | 400 px |
| Objectifs et besoins | la ligne de résumé de la semaine | 470 px | 391 px | 400 px |
| Historique et cumuls | « Par périmètre · Par série » | 283 px | 203 px | 400 px |
| Réserve du sol | la jauge | 417 px | 270 px | 400 px |
| Besoin par culture | les cultures de référence | 316 px | 169 px | 400 px |
| Matériel et placement | le choix de la parcelle | 212 px | 168 px | 400 px |
| Ressources et pompes | « Ressources · Réserves » | 340 px | 252 px | 400 px |
| Alertes météo | « Ajouter une alerte » | 166 px | 122 px | 400 px |
| Alertes cultures | le premier pli, « Réglages » | 395 px | 315 px | 400 px |
| Réglages | les cases des fonctionnalités | 297 px | 199 px | 400 px |

Aucune page ne dépasse sa borne. Sur « Arrosages », le premier bloc est
l'invitation « Recevoir les alertes sur cet appareil » quand le navigateur
n'a pas encore répondu (458 px pour le formulaire qui la suit, dans les
parcours) : c'est un geste utile, compté comme tel.

### 9.3 PR 1 — Précisions tranchées en codant

- F829 : les données de démonstration (source `mock`, démonstration en ligne
  et parcours) ne viennent d'aucune lecture d'Ouvre ta ferme : la ligne de
  lecture ne s'y montre jamais ; « Actualiser » reste dans le menu du compte,
  qui dit « Données de démonstration » avant la date.
- F830 : une phrase fixe qui met en garde (la prévision prise à 2 m, les
  seuils qui ne sont que des repères) reste en place, comme un état : seule
  l'explication de ce que montre la page passe dans le « ? ».
- F831 : « Actualiser » s'appelle « Actualiser les données d'Ouvre ta
  ferme » dans le menu du compte, au-dessus de « Se déconnecter », avec la
  date de la dernière lecture réussie dessous ; l'avis « montrer la ligne »
  se calcule côté serveur, à l'ouverture de la page ; une date illisible
  compte comme ancienne (D-003).

### 9.4 PR 2 — Les mots relevés et ce qu'ils deviennent (25 novembre 2026)

Le module des mots : `lib/domain/simple-words.ts` (`SIMPLE_WORDS`, règle 1),
avec la liste des mots du calcul que cherche le test de garde
(`TECHNICAL_WORDS`, règle 5). Relevé dans `app/` et `lib/domain/`, lignes
hors commentaire, avant la PR (branche de la PR 1) puis après.

| Mot du calcul | Avant | Devenu | Où il reste, et pourquoi |
| --- | --- | --- | --- |
| Objectif(s) hydrique(s), objectif hebdomadaire | 6 lignes | « Eau visée cette semaine » : titres d'« Objectifs et besoins », tuile d'« Aujourd'hui », message d'enregistrement, « 7 planches : aucune eau visée cette semaine », « Aucune eau visée n'est enregistrée sur cette période » (historique) | la bulle de la colonne, dans le détail d'une planche ; le journal des modifications ; l'en-tête de l'export CSV (F828) |
| Reste à apporter | 1 | « Il manque encore » (tuile d'« Aujourd'hui ») | nulle part |
| Besoins d'irrigation | 1 | « Ce qu'il reste à arroser » (titre de la section) | le nom du menu « Objectifs et besoins » ne change pas (F834) |
| Faisabilité et répartition | 1 | « Y a-t-il assez d'eau ? » (titre de la section) | nulle part |
| Volume mobilisable, disponibilité physique | 3 | « Eau utilisable » (surtitre de « Ressources et pompes », phrase des pompes) | nulle part |
| Réserve utile, RFU | 2 phrases de premier niveau | « Ce que le sol de la parcelle retient (sa RFU) n'est pas saisi » : jauge, « Aujourd'hui », données manquantes | « réserve utile (RFU) » dans le « ? » de « Réserve du sol » |
| ET0 | tuiles « Évaporation de la semaine (ET0) », « ET0 » | « Soif de la semaine », « Soif de la période » ; la ligne de résumé au téléphone dit « soif de la semaine » (F833) | « ET0, l'évaporation de référence » dans le détail de la tuile ; la colonne du tableau des jours et la mesure du suivi par série, qui sont du détail |
| Culture(s) de référence, correspondance des espèces | 10 | « À quelle culture ressemble chaque espèce ? » (titre), « … cette espèce ? » (le choix de chaque espèce, F832), « Espèces qui ne ressemblent encore à aucune culture », « Cultures inutilisables », « Les autres cultures (32) », les phrases de « Besoin par culture » et de « Réglages » | le journal des modifications (nom du réglage tel qu'enregistré) ; deux erreurs techniques d'identifiant inconnu, jamais attendues d'un geste |
| Coefficients culturaux, profils racinaires | titre du repli | « Réglages fins des cultures (pour les experts) » ; résumé de l'écran de bienvenue | nulle part au premier niveau |
| Apport horaire | 1 libellé de la fiche d'une planche, 1 phrase du cumul maximal (« Matériel et placement ») | « Ce que ce matériel apporte en une heure » ; « Ce que les matériels apportent en une heure, additionnés, sur la planche qui en reçoit le plus » | la bulle « d'où vient ce chiffre » (détail) |
| Créneaux protégés | 3 | « Heures où l'on n'arrose pas » (titre, liste, résumé du plan, visite guidée) | nulle part |
| Reliquat, reliquats | 14 | statut « Ce qui reste d'un arrosage arrêté » ; « à reprendre » dans la phrase et les pastilles d'« Aujourd'hui » ; boutons « Reprendre ce qui reste », « Annuler ce qui reste » ; historique « la suite annulée » (F836) | « Reliquat non vérifiable » : le solde d'un bilan d'eau, dans le détail de la faisabilité, pas le reste d'un arrosage |
| Par périmètre | 1 | « Par lieu » (onglet de l'historique) | nulle part |
| totaux partiels | 1 | « totaux incomplets » | nulle part |
| réanalyse, historisé | 5 au premier niveau | « pluie estimée par la météo », « estimée », « l'estimation météo », « Non enregistré » (F835) | les causes d'écart, les bulles, les replis de diagnostic et la page d'état de l'exploitant, qui sont du détail |
| journées-planche | 1 | inchangé ici : la phrase de l'objectif de l'historique est réécrite par la PR 3 bis (D-329, section 9.7) | — |

Deux gardes. Le test de garde (`tests/simplification-s1-mots.test.ts`) lit
le code : il échoue si l'un de ces mots, écrit comme un titre, reparaît hors
des neuf endroits permis, écrits dans le test avec
leur raison, et si une permission ne sert plus. Les titres et étiquettes du
tableau prennent leur mot dans le module, sans le recopier (seize usages
vérifiés). Le parcours P61 lit l'écran : sur les douze pages, replis et
« ? » fermés, aucun de ces mots ne se lit, en majuscule ou non ; c'est lui
qui a trouvé les phrases de « Besoin par culture », de « Réglages », de
l'historique et l'avertissement des besoins. Dans une phrase d'un repli
(justification d'un créneau du plan, fiabilité d'« Aujourd'hui », journal),
le mot du calcul reste : c'est le détail. L'écran de bienvenue et la visite
guidée sont lus avec les mêmes mots (règle 6).

### 9.5 PR 2 — Précisions tranchées en codant

- F832 : le titre de la liste des espèces dit « À quelle culture ressemble
  chaque espèce ? » ; le choix d'une espèce garde la question du tableau,
  « … cette espèce ? ». Le même mot, au nombre du sens.
- F833 : l'ET0 se dit « soif du jour », « de la semaine » ou « de la
  période » selon ce que la tuile compte ; « ET0, l'évaporation de
  référence » reste dans son détail. Le tableau des jours et le suivi par
  série, déjà du détail, gardent « ET0 ».
- F834 : le tableau ne nomme aucun nom de page : les noms du menu ne
  changent pas (« Objectifs et besoins », « Ressources et pompes »…) ; leur
  rangement est S3 (fait, D-331 : les noms n'ont pas changé).
- F835 : « réanalyse » et « historisé » sont dits en mots simples là où ils
  paraissaient au premier niveau (le message après le retrait d'une mesure
  de pluie, la phrase du panneau de pluie, la colonne de pluie du tableau des
  jours, la conséquence « pluviomètre absent », l'objectif initial d'un
  arrosage) ; ils restent dans les causes d'écart et les replis de
  diagnostic.
- F836 : un arrosage arrêté en cours de route a « ce qui reste » ; les
  boutons disent « Reprendre ce qui reste » et « Annuler ce qui reste », la
  phrase d'« Aujourd'hui » « Un arrosage arrêté est à reprendre » et la
  pastille « 1 à reprendre ».
- F837 : « RFU » s'explique toujours à sa première occurrence d'une page
  (F312), désormais par le mot du tableau : « Ce que le sol de la parcelle
  retient (sa RFU) » ; « réserve utile (RFU) » reste dans le « ? » de
  « Réserve du sol ».

### 9.6 PR 3 — Cause du point S1-O1 et issue choisie (25 novembre 2026)

**Cause, établie dans le code** (lecture seule ; pas relue sur la ferme
réelle, qui demande l'accord du porteur) :

| Page | Objectif de la ferme | Irrigation |
| --- | --- | --- |
| « Aujourd'hui » (`lib/domain/today/week.ts`) | moyenne pondérée par la surface des objectifs **applicables** de chaque planche (`objectiveForBed` : le plus précis des objectifs saisis, sinon l'objectif automatique), sur les planches qui en ont un | moyenne pondérée de l'eau reçue par chaque planche, sur les mêmes planches |
| « Objectifs et besoins », ligne de résumé et tuile « Objectif ferme » | l'objectif « Toute la ferme » **saisi** (`goals.find(scopeType === 'farm')`), un réglage que l'objectif d'un jardin ou d'une planche remplace là où il est posé | le volume sorti des pompes dans la semaine, réparti sur toute la surface des planches de la saison |
| « Historique et cumuls » | la somme, sur les journées-planche, des objectifs applicables pondérés par la surface, **les planches sans objectif comptées à zéro** (D-036) | l'eau réelle de la période |

Les trois pondèrent par la surface : **ce n'est pas la deuxième issue** (une
moyenne sans pondération). Les 2,7 mm de la ferme réelle sont
vraisemblablement l'objectif « Toute la ferme » saisi, et ses 5,2 mm la
moyenne avec des objectifs plus hauts posés sur des jardins ; le test rejoue
ce cas. **Première issue** : un autre périmètre, on aligne. L'irrigation
(2,8 mm contre 2,1 mm) compte deux choses différentes, chacune dite dans son
détail (« répartis sur la surface totale des planches ») : elle ne change
pas.

**L'Historique** (23,4 mm contre 16,5 mm sur la démonstration) tient à une
décision écrite du porteur, D-036 : la question lui a été posée ; il a
choisi le 25 novembre 2026 à 13 h 35 de compter comme « Aujourd'hui »
(D-329). Règle de calcul sensible : PR 3 bis, à part, en Opus 5.5 · Max.

**Ce que fait la PR 3.** `lib/domain/farm-objective.ts` : `farmObjective`
(la moyenne pondérée sur les planches qui ont un objectif, leur nombre et
le total), `farmObjectiveScopeText` (« ferme entière », « 7 planches sur 10
ont un objectif ») et `farmObjectiveText`, la phrase (« 5,2 mm visés, ferme
entière », « aucune eau visée »). « Aujourd'hui » l'appelle pour la ferme et
chaque jardin ; les besoins de la semaine la calculent
(`IrrigationNeedsDashboard.farmObjective`), et la ligne de résumé et la
tuile « Eau visée cette semaine » d'« Objectifs et besoins » la reprennent,
pour la semaine affichée seulement (« eau visée en cours de lecture » le
temps que les besoins d'une autre semaine soient relus). Le pli « Eau visée
cette semaine » garde « Toute la ferme : 2,7 mm », qui dit l'objectif saisi
à ce niveau. Le planning ne dit pas d'objectif de ferme : rien à aligner.

### 9.7 PR 3 bis — Précisions tranchées en codant (25 novembre 2026)

- **Où vit la règle.** `aggregateHydricObjective` garde son parcours jour
  par jour (règle 1) et somme l'objectif de chaque planche ; `farmObjective`
  en fait la moyenne (règle 2). Les planches qui ont un objectif servent à
  l'écart dans `buildIrrigationHistorySummary` (règle 3). La vue « Par
  série » appelle la même fonction sur ses planches, pondérées par leur
  surface occupée. Les phrases de la page (règle 5) :
  `lib/domain/irrigation-history/objective-scope.ts`.
- **Une planche arrosée hors du plan de la saison** n'a pas d'objectif :
  son eau compte dans les cumuls du périmètre, comme avant, et pas dans
  l'écart quand une partie seulement des planches a un objectif. Quand
  toutes en ont un, l'écart garde l'eau d'avant, cette planche comprise
  (« au millimètre près », règle 3).
- **Les journées-planche** se comptent sur les planches qui ont un
  objectif : « objectif posé sur 8/14 journées-planche » pour deux planches
  couvertes quatre jours sur sept. La donnée d'avant (toutes les planches du
  périmètre) reste dans le résumé ; la page ne la dit plus.
- **Une planche de surface nulle** qui a un objectif compte parmi les
  planches qui en ont un, sans poids ; quand aucune des planches de
  l'objectif n'a de surface, il n'y a pas de moyenne (D-003), comme sur
  « Aujourd'hui ».
- **La pluie qui manque.** L'Historique dit l'écart indisponible quand la
  pluie réelle manque un jour sur une planche de plein champ qui a un
  objectif (règle 3) ; « Aujourd'hui » compte la pluie connue et dit le
  manque dans « Fiabilité du calcul ». Deux façons de dire un même manque,
  déjà là avant D-329 : rien ne change ici.
- **La démonstration**, à la semaine de chaque moment : la Ferme des Trois
  Noues dit 10,6 mm (5 planches sur 10 ont un objectif) au gel de
  printemps, 23,4 mm (7 sur 10) au début de l'été, 26,7 mm (5 sur 10) en
  pénurie et 11,3 mm (2 sur 10) à l'automne, au lieu de 5,2, 16,5, 13,1 et
  2,6 mm, et chaque fois le chiffre d'« Aujourd'hui » ; les trois autres
  fermes n'ont pas d'objectif ces semaines-là. L'écart y reste indisponible :
  la démonstration ne mesure pas la pluie.

## 10. Réglage du code

Opus 5.5 · Élevé pour les trois PR : fonctionnalité délimitée sous contrat
écrit, textes et mise en page, les tests et la CI jugent (grille de la
roadmap, quatrième cas, comme O4, H3 et les lots G à K). Si la cause du
point S1-O1 est un défaut de calcul de l'objectif, la correction relève du
premier cas de la grille (règle de calcul sensible, erreur silencieuse) :
elle se fait en Opus 5.5 · Max, dans une PR à part, sans autre question au
porteur, qui en est informé. Le changement de l'Historique décidé par le
porteur (D-329, section 5 bis) relève du même cas : PR 3 bis, à part, en
Opus 5.5 · Max.
