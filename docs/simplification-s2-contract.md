# Contrat — Simplifier l'usage du module, lot S2 : « Aujourd'hui » où l'on fait tout (25 novembre 2026)

Roadmap section 6 terdecies, ligne 33 de l'ordre d'exécution. Décision du
chantier : **D-327**. La décision de ce lot est **posée par sa première PR
de code**, au premier numéro libre à ce moment-là (D-328 est celui de S1) ;
de même les précisions **F** (à partir du premier numéro libre ; celles de
ce contrat sont nommées S2-a, S2-b… et prennent leur F en codant) et le
parcours **P62** (P61 est celui de S1, que ses PR 2 et 3 étendent).

Ce contrat **change** celui de la page, `docs/aujourdhui-tableau-de-bord-contract.md`,
et la règle « une proposition se valide au planning » (choix n° 2 du porteur,
25 novembre 2026, 12 h 00 : « Oui, tout depuis la carte »). La section 10 dit,
passage par passage, ce qui change ; les PR de code le réécrivent dans la
leur.

Logiciel **multi-fermes** : rien ci-dessous ne dépend de la taille ni du
contenu d'une ferme. Les exemples (« Abri des noues », 8 mm, 3 planches)
viennent de la ferme de démonstration des maquettes ; les mesures se font sur
les données des parcours, jamais sur la ferme du porteur.

## 1. Origine

Le diagnostic du 25 novembre 2026
(`/mnt/project-files/audit-ergonomie/diagnostic-simplicite-2026-11-25.md`,
causes 1 et 2, idée 3) a joué le matin d'un maraîcher : « Aujourd'hui » →
« Valider au planning » → page « Planning » → « Valider » → retour sur
« Aujourd'hui » → « Démarrer maintenant ». **Trois écrans pour dire « oui,
j'arrose ».** Sur la ferme réelle du porteur, le même jour à 11 h 55, la page
fait 5 123 px, 792 mots, 66 chiffres et 56 choses à toucher pour deux
arrosages (un à rattraper, un à valider) ; « Valider au planning » est à
1 057 px du haut ; la carte « à rattraper » porte trois boutons et celle du
jour un quatrième. Les maquettes
(https://claude.ai/artifact/CTM7RxB6X4UgMTHKsaha8F, écrans « Aujourd'hui »,
« Arrosage en cours » et « Le bouton + ») montrent la réponse : la carte de
l'arrosage porte **un seul bouton qui change de nom** (Valider, Démarrer,
Terminer), « Autres choix » range le reste, la pluie se note d'un geste, la
page tient en un écran et demi.

Le porteur a répondu « oui » à ce choix (12 h 00) puis retenu les six lots,
dont S2 en deuxième (12 h 01), et demandé qu'ils s'enchaînent sans nouveau
« vas-y » (12 h 03). La maquette **n'a pas dessiné l'arrosage « à rattraper »**
(prévu avant, non fait), vu sur sa ferme réelle : la section 4 le prévoit.

Ce que S2 ne fait pas : la barre du bas et le « + » (S3), le formulaire
d'arrosage « où, combien, démarrer » (S5), « Semaine » (S4). S2 les prépare
sans les attendre (sections 7 et 8).

## 2. Livraison en cinq PR, une à la fois

| PR | Contenu | Preuve |
| --- | --- | --- |
| 1 · Valider et démarrer | la carte d'une proposition : « Valider », « Démarrer tout de suite », « Autres choix » ; la carte d'une irrigation planifiée : « Démarrer » ; la règle du bouton unique dans le domaine | tests du domaine et de l'action ; P62 |
| 2 · Terminer et reprendre | la carte d'une irrigation en cours, en pause, à durée atteinte, d'un reliquat : « Terminer », « Reprendre », « Mettre en pause » | tests ; P62 étendu |
| 3 · L'arrosage à rattraper | la carte « Je le fais maintenant » / « C'est fait » / « Ne pas le faire » | tests ; P62 étendu |
| 4 · Noter la pluie | la fenêtre « Noter la pluie » et ses entrées depuis la page | tests du domaine, de l'action et de la base ; P62 étendu |
| 5 · La page à l'essentiel | deux niveaux : le premier niveau en un écran et demi, le reste derrière « Le détail » ; les contrats de la section 10 réécrits | mesures de hauteur ; P29, P30, P38 mis à jour ; P62 étendu |

Les PR 1 à 4 ne déplacent aucun bloc : elles changent des cartes. La PR 5
range. **Chaque PR garde la page entière utilisable** : jamais de bloc
retiré sans que la PR 5 lui ait donné sa place (section 8).

Chaque PR : `lint`, `typecheck`, `test`, `build`, `knip`, `push:check`,
`weather:check`, `site:check` collés ; `e2e` joué en local sur les parcours
touchés, la suite complète par la CI ; registres à jour dans la même PR
(roadmap : tableau de la section 1, ordre de la section 2, bloc détaillé).
Avant d'écrire, chaque PR relève l'état de départ (contrôles, mesures à
390 px) et le colle dans sa description (consigne 6 du projet).

**Avant la PR 1** : le code de S1 est fini (ligne 33 de la roadmap : S2 attend
la fin du code de S1, fichiers communs). La barre « La semaine » de la PR 5
appelle la fonction unique de l'objectif de la PR 3 de S1 ; si elle n'est pas
là, la PR 5 attend, ou reprend le chiffre des tuiles et le dit.

## 3. La carte à un bouton

**Règle.** Une carte d'arrosage porte **un bouton principal**, un lien
d'appoint au plus et un seul « Autres choix ». Le bouton principal est
toujours le geste qui fait avancer l'arrosage d'un cran ; son nom dit lequel.
Aucun geste n'est retiré : ceux qui quittent la carte passent dans « Autres
choix » ou restent sur « Arrosages » et sur le planning, qui ne changent pas.

| État de la carte | Mot de l'état | Bouton principal | Lien sous le bouton | « Autres choix » |
| --- | --- | --- | --- | --- |
| Proposition du plan | À valider | **Valider** | Démarrer tout de suite | Changer l'heure ou la dose · Pas à cette heure |
| Irrigation planifiée (à venir) | Planifiée | **Démarrer** | — | Modifier ou annuler (sur « Arrosages ») |
| Irrigation en retard ou non faite | En retard · Non faite | **Je le fais maintenant** | C'est fait | Ne pas le faire · Ouvrir sur « Arrosages » |
| Irrigation en cours | En cours | **Terminer** | — | Mettre en pause · Ouvrir sur « Arrosages » |
| Irrigation en pause | En pause | **Reprendre** | Terminer | Ouvrir sur « Arrosages » |
| Durée atteinte | Durée atteinte | **Terminer** | — | Ouvrir sur « Arrosages » |
| Reliquat d'une irrigation partielle | Reliquat | **Reprendre le reliquat** | — | Ouvrir sur « Arrosages » |

- **La règle est dans le domaine.** Une fonction de `lib/domain/today/`
  (nouveau fichier, `card-action.ts`) dit, pour chaque ligne de la page, son
  bouton, son lien et ses « Autres choix » avec leurs mots ; le composant
  les dessine sans rien décider. Une règle d'écriture ne se copie pas
  (AGENTS.md, interdits). Les lignes existantes (`TodayIrrigationLine`,
  `TodayNowLine`) portent déjà le statut, la clé et les ancres : la fonction
  s'appuie dessus.
- **Rien ne se démarre ni ne s'enregistre seul** (D-028) : chaque écriture
  suit un appui. Les gestes qui changent l'historique gardent leur
  confirmation (section 4 pour « C'est fait » et « Ne pas le faire »).
- **Mots.** « Démarrer » remplace « Démarrer maintenant » sur « Aujourd'hui » ;
  « Terminer » remplace « Terminer l'irrigation ». Le nom complet reste dans le
  nom lu par un lecteur d'écran (« Démarrer : Goutte-à-goutte B · Réglage 1,
  7 h »). Les textes des notifications gardent leurs mots (F828 de S1 : dette
  notée, après S6).
- **Cibles.** Bouton principal : 50 px de haut, pleine largeur de la carte au
  téléphone (maquette) ; lien d'appoint et « Autres choix » : 44 px au moins.
  « Autres choix » est un bouton qui déplie une courte liste en dessous
  (`aria-expanded`), se referme à Échap et après un geste.
- **Un seul geste à la fois.** Pendant qu'un geste tourne, tous les boutons de
  la page sont désactivés (comme aujourd'hui, `pending`) ; un second appui
  n'est pas possible. Le serveur refuse de toute façon une proposition déjà
  validée.
- **La réponse s'écrit sous la carte** (L4 de `aujourdhui-liens-contract.md`,
  qui tient) ; un refus aussi, avec son motif. Quand la carte change de place
  ou de nature (une proposition validée devient une irrigation planifiée), la
  réponse la suit ; si le serveur ne donne pas l'identifiant de la nouvelle
  carte, elle se lit en tête du bloc (mécanisme existant, `DAY_REPLY`).
  Le focus reste sur le nouveau bouton principal de la carte.

## 4. L'arrosage « à rattraper »

**Constat** (ferme réelle, 25 novembre 2026, 11 h 55) : un arrosage prévu hier
n'a pas été marqué ni démarré. La page ne sait pas s'il a été fait à la main
sans passer par le module (cas le plus courant : on a arrosé sans chrono) ou
oublié. Elle doit donc **poser la question, pas deviner** : c'est le seul cas
où une carte montre deux boutons de même taille. Deux réponses honnêtes et
une troisième :

- **« Je le fais maintenant »** : bouton principal, vert. Démarre l'arrosage
  par l'action existante (`startIrrigationEventAction`), mêmes gardes. Il est
  le principal parce qu'il n'écrit rien dans l'historique que le module ne
  puisse tenir : un arrosage qui démarre maintenant est mesuré par son
  chrono.
- **« C'est fait »** : bouton de même taille, bordé. Enregistre l'arrosage
  **tel que prévu** (même heure, même durée, même dose), c'est l'action de
  « Fait comme prévu » du lot 3 de l'audit et de « Tout est fait » :
  `recordDoneAsPlannedAction`, la fonction `doneAsPlanned`, **sans changer
  leur règle** (choix du porteur du 8 novembre 2026, précisions T15 et T16 de
  `aujourdhui-tableau-de-bord-contract.md`). Rien n'est écrit au premier
  appui : la confirmation existante dit l'heure, le volume et que
  l'enregistrement **ne se corrige plus** (D-006). Elle gagne une ligne :
  « Fait autrement (une autre durée, un autre moment) ? Notez-le sur
  « Arrosages » », avec le lien, quand « Arrosages » est coché. Le bouton
  n'existe que si la règle de `doneAsPlanned` l'accepte (heure de fin prévue
  passée, T15) ; une irrigation « En retard » dont le créneau n'est pas fini
  n'a donc que « Je le fais maintenant » (la phrase de la carte dit « Prévu à
  7 h, pas encore démarré »). Une irrigation réelle déjà faite reste toujours
  enregistrable, même sous restriction d'eau ; son dépassement est signalé,
  jamais bloqué (AGENTS.md).
- **« Ne pas le faire »**, dans « Autres choix » : annule l'irrigation
  planifiée (`cancelPlannedIrrigationAction`, le plan se recalcule). Elle
  demande d'abord une confirmation d'une ligne (« Cet arrosage ne sera pas
  fait. Le module recalcule la semaine. »), parce qu'une annulation ne se
  défait pas.

**La phrase de la carte** vient du domaine et dit le jour : « Prévu hier à
7 h. L'avez-vous fait ? » (« Non faite », créneau passé) ; « Prévu à 7 h, pas
encore démarré. » (« En retard », créneau en cours) ; « Prévu avant-hier à
7 h » pour un autre jour. Le mot d'état reste « Non faite » ou « En retard ».

**Beaucoup de retards.** Le repli existant (plus de trois le même jour passé,
une ligne par jour, T2) ne change pas ; « Tout est fait (n) » en tête de
« Votre journée » non plus. La ligne repliée garde « Voir les n sur « Arrosages » ».
Une carte « À rattraper » n'est montrée en entier que pour les retards du jour
même et les jours qui ne sont pas repliés.

**Pourquoi pas un seul bouton ici.** Le bouton unique suppose que le module
connaît le prochain cran. Pour un retard, il ne le connaît pas : choisir à la
place du maraîcher « c'est fait » écrirait une donnée réelle sans sa parole,
choisir « démarrer » arroserait deux fois ce qui a été fait à la main. La
question est donc posée, en deux gestes, dont aucun n'est caché.

## 5. Valider depuis la carte

**Règle.** « Valider » est **le même geste que sur le planning** : la même
action serveur (`validatePlanProposalsAction`, pour une seule proposition),
donc les mêmes gardes, sans une ligne de règle nouvelle : le matériel, son
réglage et sa position tels qu'ils sont à cet instant ; la pompe vérifiée ; la
limite journalière ; le recalcul du plan autour de la nouvelle irrigation
planifiée (3.7, règle 4). Une proposition validée est une irrigation planifiée
ordinaire (`planning-contract.md`, « Interface (3.6) ») : la carte passe à « Planifiée »
avec le bouton « Démarrer ». **Le planning ne change pas** : il garde ses
gestes (valider, ajuster, refuser, « Tout valider »).

- **Un refus reste sur la carte**, avec son motif existant (« Le matériel a
  changé : recalculez le plan », « Limite journalière dépassée… », « Cette
  proposition a été remplacée par un calcul plus récent »…). La proposition
  reste « À valider ». Une restriction d'eau bloque la validation et le
  démarrage comme aujourd'hui (AGENTS.md, règles invariantes) ; le motif s'écrit
  sous le bouton, jamais masqué.
- **Une réserve s'affiche à côté** (« ce matériel a déjà une irrigation sur ce
  créneau », « faisabilité non vérifiée ») : le `warning` de la réponse
  existante, dit sous la carte.
- **« Démarrer tout de suite »** valide, puis démarre : une action serveur qui
  appelle les deux services existants l'un après l'autre (nouveau fichier
  d'actions, aucune règle nouvelle). Si la validation réussit et le démarrage
  est refusé, le message le dit sans détour : « Validé, mais pas démarré :
  <motif>. L'arrosage reste planifié. » Rien n'est annulé.
- **« Changer l'heure ou la dose »** : un lien vers la carte de la proposition
  sur le planning (ancre `proposal-<id>` qui existe), où le formulaire
  « Ajuster » existe déjà avec ses gardes. S2 ne recopie pas ce formulaire ;
  le reprendre sur la carte est du ressort de S5 s'il y a lieu.
- **« Pas à cette heure »** est le refus du planning (`refusePlanProposalAction`,
  D-030 et `replanning-contract.md`) : le matériel n'est plus proposé à ces
  heures cette semaine et le plan cherche **une autre place** pour le besoin,
  ou le dit « non placé ». Le mot « Pas aujourd'hui » de la maquette est
  écarté : il promettrait un report au lendemain que le plan ne garantit pas ;
  le mot choisi dit ce qui est vrai. Une confirmation d'une ligne précède :
  « Le module cherchera une autre place pour cet arrosage. »
- **Pas de validation de masse sur la carte.** « Tout valider » reste sur le
  planning. « Aujourd'hui » ne valide qu'une proposition à la fois.

## 6. Terminer, mettre en pause, reprendre depuis la carte

- **« Terminer »** (irrigation en cours ou à durée atteinte, ou en pause) ouvre
  la fenêtre existante `FinishIrrigationDialog` : « Vérifiez que la vanne est
  fermée, puis confirmez l'heure réelle », l'heure de fin pré-remplie comme
  sur « Arrosages » (maintenant, ou l'heure de la pause pour une irrigation en
  pause), puis l'action existante `finishIrrigationEventAction`. Une fin avant
  la durée prévue enregistre une irrigation **partielle** : le message le dit
  (« L'irrigation partielle a été enregistrée. Le reliquat reste planifié. ») et
  la carte devient « Reliquat ». Aucune règle de durée réelle ne change.
- La fenêtre ne dépend plus de la page des arrosages : elle reçoit le nom du
  matériel et l'heure proposée, pas toute la fiche de l'irrigation. Si cela
  oblige à toucher le composant de « Arrosages », le changement se fait sans
  modifier son comportement, et **sans mêler refactor et fonctionnalité**
  (AGENTS.md, interdits) : une petite PR de restructuration passe d'abord, ou
  la fenêtre reçoit les deux valeurs en plus.
- **« Mettre en pause » et « Reprendre »** sont les actions existantes
  (`pauseIrrigationEventAction`, `resumeIrrigationEventAction`) ; la pause ne
  fait pas recalculer le plan (3.7, règle 5).
- **« Reprendre le reliquat »** garde son geste (même action que sur
  « Arrosages »). L'abandon du reliquat reste sur « Arrosages ».
- **Une irrigation en cours** garde le compte à rebours de la maquette
  (« Reste 52 min », « Fin prévue à 10 h 50 · 8 mm au total ») ; ces valeurs
  viennent du minuteur existant (`lib/domain/irrigation-timer.ts`), jamais
  d'un calcul de la page. Une durée atteinte dit « Fermez la vanne, puis
  appuyez » : l'état existant « fermer la vanne ».

## 7. Noter la pluie d'un geste

**Constat** (cause 1 du diagnostic) : le champ est dans « Objectifs et
besoins », sous un pli fermé « Pluie mesurée » ; quatre liens y mènent. C'est
le geste que le maraîcher refait chaque matin.

**Règle.** Une fenêtre **« Noter la pluie »**, ouverte depuis « Aujourd'hui »,
qui écrit par l'action existante `saveManualRainfallAction` : **aucune règle
de pluie ne change**. La pluie mesurée au pluviomètre, y compris 0 mm, prime
sur la réanalyse et la prévision et n'est jamais écrasée par une
synchronisation ; l'enregistrement fait recalculer le plan de sa semaine (3.7,
règle 4) ; le plan se relit après.

- **Quel jour ?** une liste : « Aujourd'hui », « Hier », « Avant-hier », puis
  les jours précédents de la saison jusqu'à sept jours en arrière, jamais un
  jour futur (l'action le refuse). **Par défaut : hier** (précision S2-e, voir
  section 11 : la pluie lue le matin tombée dans les vingt-quatre heures
  d'avant ; modifiable, et non une règle agronomique : un maraîcher qui lit
  le soir change la liste d'un geste). La semaine de la date choisie est
  celle du lundi au dimanche, à l'heure de la ferme (D-004).
- **Combien ?** un champ décimal en millimètres, virgule ou point acceptés,
  « mm » écrit à côté, de 0 à 1 000 comme l'action le vérifie. Un champ vide
  n'est **jamais** lu comme 0 (D-003) : le bouton reste inactif. Sous le
  champ : « Pas de pluie ? Notez 0 : c'est une vraie mesure, elle compte. »
- **Une mesure existe déjà ce jour-là** : la fenêtre la dit (« 8 mm déjà
  notés pour hier ») et le bouton devient « Remplacer par 5 mm » au lieu
  d'« Enregistrer 5 mm » : jamais d'écrasement silencieux. Retirer une mesure
  reste sur « Objectifs et besoins » (« Retirer la mesure »).
- **Le bouton dit le chiffre** (« Enregistrer 8 mm »), comme la confirmation
  de « Tout est fait » dit le nombre exact.
- **La réponse** s'écrit dans la fenêtre puis sous le bouton qui l'a ouverte :
  « Pluie enregistrée : 8 mm le lundi 15 juin. Le plan se recalcule. » Un refus
  de l'action est dit avec son motif.
- **Une ferme toute sous abri** n'a pas ce geste : la pluie y vaut
  explicitement 0 (D-032) ; la tuile existante dit déjà « Voir jour par jour ».
- **Entrées.** (1) Le bouton « Noter la pluie » de la ligne d'avertissement
  « Calcul approximatif » quand la donnée qui manque est la pluie mesurée
  (aujourd'hui le lien « Noter la pluie de la semaine » vers « Objectifs et
  besoins » : il devient ce bouton). (2) Le lien « Noter la pluie » de
  « La semaine ». (3) **Le « + » de S3** montera la même fenêtre : S2 la
  construit comme composant partagé de `app/irrigation/`, sans rien en
  supposer de la page « Aujourd'hui ». Elle n'existe que si « Objectifs et
  besoins » est cochée (l'endroit où la pluie compte, comme la tuile de L1).
- **Domaine** : la liste des jours, le jour par défaut, la lecture du chiffre
  (« 8,5 » → 8,5), le texte du bouton et l'état « déjà notée » sont une
  fonction de `lib/domain/today/` (`rain-entry.ts`), testée sans navigateur.

**Depuis S4 (lot S4, D-335, `docs/simplification-s4-contract.md`, PR 4).** Le lien de la fenêtre, « Retirer une mesure,
voir jour par jour », mène à « Pluie mesurée » de « Semaine » et dit « sur
« Semaine », dans « Pluie mesurée » ». La fenêtre est la même sur « Semaine »,
appelée par le bilan, la ligne « Calcul approximatif » et la ligne d'un jour
passé (S4, PR 3, F935).

## 8. La page à l'essentiel : deux niveaux

**Règle.** Le premier niveau tient en un écran et demi au téléphone ; le reste
est derrière **un seul pli « Le détail »**, fermé. Les blocs ne sont pas
retirés : « Semaine » (S4) et « Ma ferme » (S3) leur donneront leur place ;
**jusque-là, ils sont sur la page, dans le pli.** Rien ne disparaît entre
deux lots.

**Premier niveau, de haut en bas**

1. **L'en-tête** : la date, la ligne du plan (« Plan calculé aujourd'hui à
   6 h 02 · Recalculer »), une phrase qui dit la situation (la phrase de
   résumé existante, F277 et F278 tiennent). **Au téléphone, les pastilles
   quittent le premier niveau** : la phrase dit déjà la même chose ; à
   l'ordinateur elles restent (ancres, de la place). Le choix de la saison et
   la ligne de lecture sont déjà réglés par S1.
2. **« L'eau manque »** quand une répartition attend (l'encadré existant,
   phrase du planning et lien « Répartir l'eau ») : c'est une action.
3. **« Votre journée »** : les cartes de la section 3, dans l'ordre : en cours
   et reliquats, à rattraper, à faire aujourd'hui ; le compte à rebours de
   l'en-cours en tête. « Tout est fait (n) » reste en tête de bloc. Les arrosages
   de demain à valider : la ligne de pied existante (« Demain à 6 h : 3
   arrosages à valider », « Voir au planning »). Rien à faire : l'état vide
   existant et son lien (L3). **Depuis S6** (lot S6, D-336, `docs/simplification-s6-contract.md`, section 11) : pour une ferme qui n'est pas
   encore prête (la mise en route a une étape en cours), l'état vide devient
   le bloc de l'étape en cours (« Votre ferme n’est pas encore prête à
   proposer des arrosages. », la phrase de l'étape, « Continuer l'étape n »,
   F965) ; « Plus tard » sur « Ma ferme » rend l'état vide.
4. **Le gel ou la chaleur annoncés** : seulement un jour **en alerte**, en carte,
   comme aujourd'hui ; « Prévision indisponible : à vérifier » en ambre ; le
   « gel annoncé sans alerte posée » (J14) avec son lien « Poser… ». Un jour
   calme n'est pas au premier niveau : la phrase de l'en-tête le dit.
5. **« La semaine »** : **une barre**, pour la ferme entière : « 12 mm reçus sur
   23 mm visés. Il manque encore 11 mm d'ici dimanche. », avec « Voir la
   semaine » (vers « Objectifs et besoins » jusqu'à S4) et « Noter la pluie ».
   Les chiffres sont ceux des tuiles existantes (objectif pondéré par la
   surface, eau reçue, reste à apporter, jamais négatif) ; **la phrase de
   l'objectif est celle de la PR 3 de S1** (une seule fonction, jamais
   refaite ici). L'origine de la pluie comptée garde son mot (« dont 2,4 mm de
   pluie prévue, non mesurée », F429) : prévu, estimé et mesuré ne se
   confondent pas (D-006). Objectif inconnu : pas de barre, « Aucun objectif
   posé pour cette semaine » et « Poser un objectif » ; reçu ou reste inconnu :
   dit inconnu, jamais zéro (D-003).
6. **Une seule ligne d'avertissement « Calcul approximatif »** quand des données
   manquent : la **première** manque dans l'ordre existant de
   `lib/domain/today/reliability.ts` (la pluie mesurée d'abord, puis l'objectif
   automatique, les espèces, le sol, les réserves, le plan), avec sa phrase,
   sa conséquence et son geste existants, et « + 2 autres » qui ouvre le pli
   sur « Fiabilité du calcul ». Pas de manque : rien (jamais de « tout va
   bien » dessiné sans donnée).
7. **Une ligne d'eau**, seulement quand elle dit quelque chose : une réserve
   sous son minimum de sécurité, un relevé de plus de 7 jours, un volume
   jamais saisi, un prélèvement limité atteint ; sinon l'eau est dans le pli.
8. **« Le détail »** : un pli fermé, dont la ligne de résumé compte ce qu'il
   contient (« 4 chiffres · 3 jardins · 2 données à rafraîchir »).

**Dans « Le détail »**, dans l'ordre d'aujourd'hui : les quatre tuiles de la
semaine ; « Eau de la semaine » par jardin ; « Réserve du sol » par jardin ;
« Eau disponible » ; « Fiabilité du calcul » en entier ; « Gel ou chaleur », les
trois jours ; la frise du jour à l'ordinateur (un avant-goût que les cartes
rendent inutile au premier niveau, précision S2-f). Chaque bloc garde ses
liens, ses boutons et ses réponses (L1 à L4).

- **Les ancres existantes ouvrent le pli.** Les liens des notifications, les
  pastilles de l'ordinateur et les liens d'autres pages qui visent `#today-weather`,
  `#today-reliability`, `#today-shortage` ou un bloc du pli l'ouvrent seul,
  comme `AnchoredFold` le fait ailleurs : aucun lien existant ne perd son effet.
- **Le même ordre au clavier qu'à l'écran** (L6 de `aujourdhui-liens-contract.md`
  tient : au téléphone, « Votre journée » juste après l'en-tête, avant « La
  semaine »).
- **Budget** à 390 px (le contrat de S1 en a posé l'habitude ; P62 fixe chaque
  borne sur la mesure faite) : la hauteur du premier niveau pour **une**
  proposition à valider, aucune alerte, aucun manque, au plus **1 600 px**
  (deux écrans de 780 px, quand la page du jour fait 3 888 px sur la
  démonstration et 5 123 px sur la ferme réelle) ; le bouton principal de la
  première carte à moins de **600 px** du haut (il est à 1 057 px sur la ferme
  réelle) ; au plus **12** choses à toucher au premier niveau (39 à 56
  aujourd'hui). Une page qui dépasse sa borne le dit, comme au lot J.

**Depuis S4 (lot S4, D-335, `docs/simplification-s4-contract.md`, PR 4).** « Voir la semaine » mène à « Semaine » ; la
ligne de pied « Voir au planning » devient « Voir la semaine », vers la même
proposition ; « Valider toute la semaine » est sur « Semaine » ; « Changer
l'heure ou la dose » ouvre la proposition sur « Semaine ».

## 9. États rares : ce que chacun devient

| État | Au premier niveau | Dans le pli |
| --- | --- | --- |
| Pénurie (l'eau manque) | l'encadré « L'eau manque » et son lien ; les cartes gardent leurs gestes ; la phrase de l'en-tête la dit | « Eau disponible » |
| Gel ou chaleur annoncés | la carte du jour en alerte, avec son lien ; la phrase | les autres jours |
| Gel annoncé sans alerte posée | la ligne ambre et « Poser… » (J14) | — |
| Prévision indisponible | la ligne ambre « Prévision indisponible : à vérifier » | — |
| Restriction d'eau (limite journalière, pompe) | le motif sous le bouton qui l'a rencontrée ; « Valider » et « Démarrer » refusés, « C'est fait » accepté (AGENTS.md) | « Eau disponible » |
| Plan pas calculé | la ligne du plan, « Calculer », puis la ligne « Calcul approximatif » | « Fiabilité du calcul » |
| Ni arrosage ni retard | l'état vide existant et son lien ; la phrase « Rien d'urgent aujourd'hui. » | tout |
| Ferme sans « Planning » ni « Arrosages » | pas de cartes (le bloc n'existe pas, R1 de la page) | les blocs des cases cochées |
| Ferme sans « Objectifs et besoins » | pas de barre « La semaine », pas de « Noter la pluie » | — |

Une case décochée retire sa carte, sa ligne et son entrée, comme aujourd'hui
(D-067 ; R1 de `aujourdhui-tableau-de-bord-contract.md`). Un état rare que
cette liste ne nomme pas reste montré au premier niveau tant que la PR 5 ne
l'a pas rangé : jamais caché par défaut.

## 10. Ce que S2 change des contrats validés

| Contrat | Passage | Devient |
| --- | --- | --- |
| `aujourdhui-tableau-de-bord-contract.md`, section 2 | « Les gestes : « Démarrer maintenant », « Ouvrir »… restent les mêmes actions, aux mêmes adresses » | les actions sont les mêmes ; les mots sont ceux de la section 3 ci-dessus, « Valider », « Terminer » et « C'est fait » s'y ajoutent sur la carte |
| id., section 3.2, « Votre journée » | « une carte « À valider » dit « Valider au planning », une carte planifiée « Ouvrir » » | la carte porte un bouton qui change de nom (section 3) |
| id., section 3.2, « La semaine » | « quatre tuiles » | une barre au premier niveau ; les quatre tuiles dans « Le détail » (section 8) |
| id., section 3.2, les autres blocs | tous au premier niveau, en grille | « Gel ou chaleur » (alerte seule), l'eau (ligne conditionnelle) et la fiabilité (une ligne) au premier niveau ; le reste dans « Le détail » |
| id., T5, T10, T12 | ordre des blocs, « la page peut dépasser deux écrans » | l'ordre de la section 8 ; le budget de hauteur de la section 8 |
| id., section 3.4 | « Fait comme prévu » (le mot) | « C'est fait » sur la carte d'« Aujourd'hui » ; la règle, la confirmation et la fonction sont inchangées ; « Arrosages » garde « Fait comme prévu » (dette : S5) |
| `aujourdhui-liens-contract.md`, L1 | le mot « Noter une pluie mesurée » sur la tuile, menant à « Objectifs et besoins » | ouvre la fenêtre « Noter la pluie » ; le lien vers « Objectifs et besoins » reste pour retirer ou voir jour par jour |
| id., L3, règle 5 | « Valider au planning » : rien n'est validé par le lien | le **bouton** valide ; le lien vers le planning devient « Changer l'heure ou la dose » ; **rien n'est validé par un lien** (D-028 tient) |
| id., L4 | la réponse sous le bouton | tient ; elle suit la carte quand une proposition devient une irrigation |
| id., L6 | « Votre journée » en tête au téléphone | tient |
| `planning-contract.md`, « Les gestes » | valider, ajuster, refuser se font sur le planning | se font aussi sur « Aujourd'hui » (valider, refuser ; ajuster y mène) ; le planning ne change pas |
| `browser-journeys-contract.md` | P29, P30, P38 lisent « Démarrer maintenant », « Valider au planning », « Fait comme prévu » | réécrits avec les nouveaux mots dans la PR qui les change ; P62 ajouté |

**Ne changent pas** : D-028 (le logiciel n'arrose, ne démarre et n'enregistre
rien seul : chaque écriture suit un appui, et les enregistrements définitifs
gardent leur confirmation), D-006 (l'historique est immuable), D-030 (un refus
exclut ce créneau), D-003, D-010, D-032, la règle de la pluie mesurée, celle de
la restriction d'eau et celle du « Fait comme prévu » (T15, T16). Les textes
des notifications gardent leurs mots.

## 11. Ce qui ne change pas

- Aucun calcul, aucune règle d'agronomie, aucune donnée, aucune migration :
  chaque geste de la carte est une **action serveur qui existe déjà**
  (validation, démarrage, pause, reprise, fin, enregistrement « tel que
  prévu », annulation, refus, pluie mesurée). Les deux seuls nouveaux fichiers
  d'actions composent des actions existantes : « valider puis démarrer », et la
  fenêtre de la pluie qui appelle l'action de la pluie.
- La page des arrosages, le planning, « Objectifs et besoins » : aucun écran n'y
  change ; ils gardent tous leurs gestes.
- L'isolation par utilisateur, exploitation et saison ; la saison du jour de la
  page (F2).
- La charte graphique, les cibles de 44 px, les contrastes mesurés ; S1 (le
  chapeau d'une ligne, les mots du tableau).
- Une proposition ne se valide jamais seule : sans appui, rien n'est écrit.

### Précisions tranchées (option recommandée, modifiables à la relecture)

| N° | Précision | Choix |
| --- | --- | --- |
| S2-a | Un retard : deux boutons | « Je le fais maintenant » (principal) et « C'est fait » (bordé), parce que le module ne sait pas lequel est vrai (section 4) |
| S2-b | Refuser un créneau | « Pas à cette heure », pas « Pas aujourd'hui » : le plan ne reporte pas, il cherche une autre place (D-030) |
| S2-c | « Démarrer tout de suite » sur une proposition | valide puis démarre ; si le démarrage est refusé, la validation tient et le message le dit |
| S2-d | Ajuster une proposition depuis « Aujourd'hui » | un lien vers le formulaire du planning, pas une copie ; **S5 a décidé qu'il ne remonte pas** (S5-f, section 6.2) |
| S2-e | Jour par défaut de la pluie | hier, avec « Aujourd'hui » et les jours d'avant dans la liste ; jamais d'écrasement sans le dire |
| S2-f | La frise du jour | passe dans « Le détail » : les cartes disent déjà la journée |
| S2-g | Les pastilles de l'en-tête | quittent le téléphone (la phrase les redit), restent à l'ordinateur |
| S2-h | La ligne d'eau du premier niveau | seulement quand elle dit quelque chose (minimum, relevé ancien, volume jamais saisi, limite atteinte) |
| S2-i | Pause et reprise sur la carte | dans « Autres choix » (pause) et en bouton principal d'une irrigation en pause (« Reprendre ») |
| S2-j | Un seul jour de pluie à la fois | oui ; plusieurs jours d'un coup restent sur « Objectifs et besoins » |

Aucune de ces précisions n'est agronomique : aucune ne touche une dose, un
seuil, un coefficient, la lecture d'une donnée ou une règle du plan. Si une
question agronomique se pose en codant (par exemple, la pluie d'un jour de la
semaine précédente), la PR s'arrête, le dit et le porteur tranche, une
question par message.

## 12. Tests et preuves

- **Domaine** (`card-action.ts` et ses voisins) : pour chaque état de la
  section 3, le bouton, le lien et les « Autres choix » avec leurs mots ;
  la phrase du retard (hier, avant-hier, aujourd'hui, pas encore démarré) ;
  « C'est fait » absent quand le créneau n'est pas fini ; la phrase d'une
  carte qui n'a plus de bouton (terminée entre-temps) ; la fenêtre de la pluie
  (jours, jour par défaut, lecture « 8,5 », champ vide, 0 accepté, hors bornes,
  mesure déjà notée) ; la barre « La semaine » (inconnus dits inconnus,
  objectif inconnu, reste jamais négatif, origine de la pluie) ; le choix de
  la ligne « Calcul approximatif » dans l'ordre de la fiabilité ; la ligne
  d'eau conditionnelle.
- **Actions** : valider une proposition (réussie, refusée par chacune des
  gardes, déjà validée, expirée, d'un autre propriétaire) ; valider puis
  démarrer, avec le démarrage refusé après une validation réussie ; terminer
  (complet, partiel, reliquat) ; « C'est fait » ; annuler ; refuser ;
  enregistrer la pluie (jour futur refusé, hors bornes, remplacement) ;
  **isolation par ferme et saison** pour chacune.
- **Interface** : le nom du bouton à chaque état, un seul bouton principal par
  carte, aucun bouton actif pendant un geste, la réponse sous la bonne carte
  après une validation, « Autres choix » au clavier (Entrée, Échap, focus), la
  fenêtre de la pluie au clavier et à 390 px, le pli « Le détail » qui s'ouvre
  par chaque ancre existante, les cases décochées.
- **Parcours P62**, à 390 et 1440 px, sur une ferme propre au parcours (jamais la
  ferme réelle sans le « vas-y » du porteur et la remise en l'état) : le matin
  de bout en bout **sur la page seule** (valider → démarrer → terminer sans
  quitter « Aujourd'hui »), « Démarrer tout de suite », « Pas à cette heure »,
  un retard (« Je le fais maintenant » ; « C'est fait » avec sa confirmation ;
  « Ne pas le faire »), un refus de garde dit sous le bouton, noter 8 mm puis
  0 mm puis remplacer, les mesures de la section 8 contre leurs bornes.
  P29, P30 et P38 suivent les mots.
- **Contre-épreuve** (habitude du dépôt) : des altérations de la règle du bouton
  (un état qui prend le mauvais bouton), de « C'est fait » (proposé avant la
  fin du créneau), du jour par défaut de la pluie, du chiffre lu (virgule) et
  de l'ancre du pli font chacune échouer un test.
- **Recette** après la mise en ligne de chaque PR, dans le Chrome du porteur,
  avec son accord : le constat est à l'assistant, le jugement des mots et du
  geste au porteur (D-014). **Rien ne s'écrit sur la ferme réelle sans son
  « vas-y » exprès** (AGENTS.md, ferme réelle) ; sur la démonstration, on peut
  tout jouer. Avant S3 et S4, le diagnostic conseille de montrer la maquette à
  un premier maraîcher du pilote avec cinq tâches ; S2 n'en dépend pas, et ce
  parcours (« lancez cet arrosage », « notez 8 mm de pluie ») la teste.

## 13. Risques

| Risque | Parade |
| --- | --- |
| Valider un créneau que le planning aurait refusé | c'est la même action et les mêmes gardes ; le test de chaque garde passe par la carte |
| « C'est fait » enregistre une donnée réelle sans que l'arrosage ait eu lieu | la confirmation existante, l'immuabilité dite en gras, le bouton absent avant la fin du créneau, la phrase « L'avez-vous fait ? » |
| Un double appui valide ou démarre deux fois | boutons désactivés pendant le geste ; le serveur refuse une proposition déjà validée et un démarrage déjà fait |
| « Démarrer tout de suite » laisse une irrigation validée mais pas démarrée | le message le dit ; la carte devient « Planifiée » avec « Démarrer » ; rien n'est annulé |
| Un lien d'une notification ne trouve plus son bloc | les ancres ouvrent le pli ; test de chaque ancre existante |
| La pluie notée un mauvais jour | jour par défaut dit, jamais un jour futur, « déjà notée » dit, retrait sur « Objectifs et besoins » ; le jugement du porteur à la recette |
| Plusieurs fermes, plusieurs matériels : une carte par irrigation devient longue | les retards d'un même jour passé se replient (T2, inchangé) ; au-delà, c'est le planning qui sert |
| Les tests et parcours qui lisent un mot changent | relevé d'abord (six fichiers de parcours et cinq fichiers de tests lisent « Démarrer maintenant », « Valider au planning » ou « Fait comme prévu ») ; ils suivent dans la PR qui change le mot |
| S1 pas fini quand S2 commence | S2 attend la fin du code de S1 (ligne 33) ; la barre de la PR 5 attend la fonction de l'objectif de la PR 3 de S1 |
| La page « Arrosages » dit « Fait comme prévu » et « Aujourd'hui » dit « C'est fait » | dette notée, **soldée par S5** (section 6.1, D-334 : « C'est fait » sur « Arrosages ») |

## 14. À remplir par les PR

- Relevé des mots lus par les tests et les parcours (PR 1).
- Hauteur du premier niveau, position du premier bouton, nombre de choses à
  toucher, avant et après (PR 5).
  **Relevé de la PR 5** (25 novembre 2026, P62 à 390 px, une ferme neuve
  propre au parcours, une proposition à valider, trois données à rafraîchir
  et l'encart « À finir » de S1 au-dessus) : **avant**, les mesures de la
  section 1 (la page du jour 3 888 px sur la démonstration, 5 123 px sur la
  ferme réelle ; le premier bouton à 1 057 px ; 39 à 56 choses à toucher) ;
  **après**, le premier niveau finit à **1 384 px** (borne 1 600), le bouton
  principal de la première carte est à **539 px** (borne 600 ; 623 px tel quel,
  dont 84 px de nom de matériel que le titre du test étire sur quatre
  lignes, F867), **11** choses à toucher (borne 12). L'avant n'a pas été
  remesuré sur la même ferme de parcours : le parcours n'existait pas avant
  cette PR.
- Décision de ce lot, précisions F, parcours P62 : numéros pris en codant.

## 15. Réglage du code

Opus 5.5 · Élevé pour les cinq PR : écrans sous contrat écrit, qui réutilisent
les actions existantes sans changer aucune règle (grille de la roadmap,
quatrième cas, comme S1 et S5) ; les tests et la CI jugent. Si une PR doit
**changer** une règle de validation, de démarrage, de fin ou de pluie (ce que
ce contrat exclut), elle s'arrête et passe en Très élevé après le mot du
porteur, selon la ligne de la roadmap.
