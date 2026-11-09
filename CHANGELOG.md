# Journal des changements

Les changements significatifs sont regroupés ici. L'historique Git reste la
source détaillée commit par commit.

## Non publié

### Corrigé (3.9 : l'origine indisponible)

- **Une pompe archivée ou une origine indisponible ne reçoit plus rien,
  et le dit** (points ouverts 52 et 53, D-088). Un matériel dont la pompe
  habituelle est archivée n'est plus proposé « faisabilité non vérifiée »
  comme s'il n'en avait pas : il ne reçoit aucun créneau. Une chaîne dont
  rien ne peut venir d'ici dimanche — pompe archivée, réserve ou ressource
  inactive, ressource hors de sa période — n'entre dans aucun partage :
  ses planches portent « origine d'eau ou pompe indisponible », et sa
  ligne de budget dit « indisponible cette semaine, aucune eau
  mobilisable » au lieu d'un stock qu'aucun créneau ne peut prendre.
  Aucune migration.

### Corrigé (3.9 : l'eau et le temps de pompage à la fois)

- **Le manque d'eau et le temps de pompage manquant ne se mélangent
  plus** (point ouvert 56, D-087). Le manque d'une planche se partage
  entre ses motifs : ce que sa part lui retire compte en manque d'eau, le
  reste sous le motif du placement (temps de pompage, espacement, dose
  minimale). Avant, une planche coupée par les deux comptait en entier
  sous le premier motif dans l'ordre alphabétique : un dimanche soir en
  pénurie, « Manque d'eau 0 m³ » et « Temps de pompage manquant
  6,25 m³ », pour 6,95 m³ et 0,64 m³. Aucune migration.

### Corrigé (3.9 : l'eau déjà validée en pénurie)

- **Valider des propositions en pénurie ne refait plus le partage**
  (point ouvert 57, D-086). L'eau que les irrigations planifiées d'une
  chaîne donneront encore à une planche compte comme déjà placée dans sa
  part : au recalcul, les autres planches gardent leur part, et une
  planche validée ne reçoit pas une seconde proposition. Avant, sur les
  quatre tunnels pour 5 m³, valider les tunnels 1 et 2 faisait tomber les
  tunnels 3 et 4 de 9,76 à 6,46 mm et laissait 0,85 m³ dans la réserve ;
  sous un arbitrage, plus rien n'était placé. Un arrosage validé au-delà
  de la part de sa planche rejoue la conduite, cette planche servie de ce
  qu'elle a reçu : le choix du porteur, le 9 novembre 2026. Aucune
  migration.
  En ligne le 12 novembre 2026 à 16 h 14 (#20 de ce dépôt).

### Corrigé (3.9 : les limites par jour)

- **Le plan ne propose plus d'arroser plus que la limite journalière d'un
  arrêté, ni de prélever plus que l'autorisation d'une source** (points
  ouverts 58 et 54, D-085). Un créneau à cheval sur minuit se juge jour
  par jour depuis son début : il s'arrête à l'heure où le reste d'un de
  ses jours s'épuise, et part à minuit quand son premier jour est déjà
  plein, si sa plage continue. Avant, 22,10 m³ un jeudi pour une limite
  de 15, ou 4 m³ tirés d'une source un mercredi pour 2 autorisés ; la
  validation refusait déjà ces créneaux.
- **La coupe d'une source porte le nom de sa limite** (point ouvert 55,
  D-085) : « limite de prélèvement de « Source du bas » atteinte », et
  non plus « réserve au minimum de sécurité » ; un motif nouveau, compté
  en manque d'eau. Aucune migration.
  En ligne le 12 novembre 2026 à 15 h 42 (#19 de ce dépôt).

### Vérifié (3.9, lot 3 : les scénarios de pénurie en tests du moteur)

- **Les scénarios de pénurie du contrat de la 3.9 deviennent des tests du
  moteur** (lot 3, D-084), sans changer aucun comportement : la limite de
  prélèvement qui plafonne l'apport (S2), la réserve engagée sous son
  minimum par des irrigations planifiées à la main (S4), le stock inconnu
  (S7), la réserve inactive (S8), deux chaînes d'eau (S9), les motifs de
  trois niveaux (S10), la pluie prévue sur deux calculs (S23), la semaine
  entamée (S24), deux calculs à deux minutes (S26, un relevé) et
  l'isolation de deux exploitations la même semaine (S28).
- **Huit défauts relevés, aucun corrigé ici** (points ouverts 51 à 58) :
  la limite journalière d'un arrêté dépassée par un créneau à cheval sur
  minuit (22,10 m³ un jeudi pour 15) ; « Manque d'eau 0,00 m³ » sur un
  stock inconnu ; une pompe archivée qui
  laisse son matériel proposé ; une source inactive nommée « stock et
  ressources insuffisants » ; la limite de prélèvement d'une source
  dépassée un mercredi (4 m³ pour 2) ; la coupe d'une source nommée comme
  celle d'une réserve ; un manque compté en entier sous un seul motif ;
  les parts refaites sur le reste après une validation en pénurie. Chacun
  sera corrigé dans sa PR, test rouge d'abord. Aucune migration.
  En ligne le 12 novembre 2026 à 15 h 09 (#18 de ce dépôt).

### Documents (Tranche 4 : la démo guidée inscrite aux registres)

- **Le contrat de la démo guidée est inscrit** (`docs/demo-guided-contract.md`,
  validé par le porteur le 8 novembre 2026, D-096) : sous-tranche 4.0,
  ligne 25 de la roadmap, découpage D1 à D4 après la 3.9. Documents seuls,
  aucun code ; D4 (Cloudflare) attend un accord exprès du porteur.
  En ligne le 12 novembre 2026 à 14 h 42 (#16 de ce dépôt).

### Ajouté (3.9, 2 bis : l'écran d'arbitrage façon plan d'assolement)

- **L'écran d'arbitrage se lit comme un plan d'assolement** (D-078,
  précisions D-083) : quand un niveau de priorité demande un choix, ses
  planches sont rangées par parcelle, puis par jardin ou abri, chacune avec
  la frise de ses cultures sur plusieurs semaines, ce qui y pousse cette
  semaine, son besoin et la part d'eau qu'elle recevrait. Toutes les
  planches sont cochées au départ ; chaque case recalcule aussitôt le bilan
  du niveau (l'eau disponible, le besoin des planches cochées, la part de
  chacune, les planches servies), sans rien enregistrer avant « Valider la
  répartition ». Deux vues : « Planches à choisir » et « Toute la ferme ».
  Le calcul, la décision enregistrée et sa garde ne changent pas. Aucune
  migration.
  En ligne le 12 novembre 2026 à 14 h 13 (#17 de ce dépôt).

### Corrigé (parcours navigateur à l'heure de la ferme ; pluie mesurée : le dernier jour choisi)

- **Le champ « Millimètres » de la pluie mesurée suit le dernier jour
  choisi** (point ouvert 50, D-082) : choisir un jour d'une autre
  semaine, puis un autre jour avant la réponse, laissait cette réponse
  en retard vider le champ et remplacer la semaine affichée. Rare à la
  main ; le lundi, les parcours le voyaient. La réponse d'un choix
  dépassé est maintenant ignorée.
- **Les parcours navigateur ne dépendent plus de l'heure** (point ouvert
  49, D-082) : ils écrivaient leurs dates à l'heure de la machine, UTC
  en intégration continue, une à deux heures de moins qu'à la ferme, et
  P4, P9 et P31 échouaient la nuit après minuit. Ils écrivent
  maintenant à l'heure de la ferme, et une irrigation cherchée dans la
  semaine en cours finit à la minute précédente. Le dimanche soir
  (point ouvert 48) reste à traiter. Aucune migration.
  En ligne le 12 novembre 2026 à 13 h 44 (#15 de ce dépôt).

### Corrigé (3.9, correction 4 : la part du dernier jour)

- **Le dimanche, une part sous la dose minimale est placée, comme un reste
  hors pénurie** (décision 5 de la 3.9, D-052, précisions D-081) : en
  pénurie, un matériel dont le créneau verse à côté — une rampe qui arrose
  aussi la planche voisine — attendait une part plus grande dès que ce que
  ses parts paient tombait sous la dose minimale, même le dernier jour ; sa
  part fondait en attendant, et de l'eau restait dans la réserve. Sur la
  plage du dimanche, la part est maintenant placée telle qu'elle est, si
  petite soit-elle ; en semaine et le samedi, le matériel attend comme
  avant. Sous un arbitrage validé aussi : l'allocation ne reste plus non
  attribuée. Aucune migration. En ligne le 12 novembre 2026 à 13 h 14 (#14
  de ce dépôt).

### Corrigé (3.9, correction 3 : le report sans bascule)

- **Sous la conduite « report », un calcul sans événement reproduit le
  précédent** (décision 4 de la 3.9, D-052, précisions D-080) : chaque
  calcul faisait passer devant les planches que le précédent avait
  reportées, et un second clic sur « Calculer » servait les reportées et
  reportait les premières. Les reportées ne passent maintenant devant qu'au
  calcul qui suit un événement — un arrosage validé ou fait, une pluie
  saisie, un stock corrigé, tout événement qui fait recalculer — ; sans
  événement, le plan garde sa file et ne bascule plus. Le motif d'une
  planche reportée dit « passe en tête après le prochain événement », au
  lieu de « au prochain calcul ». Aucune migration. En ligne le 9 novembre
  2026 à 3 h 23 (#13 de ce dépôt).

### Corrigé (3.9, correction 2 : le budget net du manque sous le minimum, la part visée et la part placée)

- **Le budget d'une réserve sous son minimum retire d'abord le manque**
  (décision 2 de la 3.9, D-052, précisions D-079) : il comptait tous les
  apports d'ici dimanche, quand la garde en retient d'abord ce qu'il faut
  pour remonter la réserve au minimum. Les parts, prises sur ce budget trop
  grand, servaient les premières planches et laissaient les dernières sans
  rien (les tunnels 3 et 4 de la ferme de test, à 0 mm). Elles se répartissent
  maintenant entre toutes les planches ; les règles du placement ne changent
  pas. Un stock au-dessus de son minimum garde le budget d'avant.
- **La ligne de budget montre la part visée et la part placée** de chaque
  niveau de priorité, « — » pour un niveau sans demande : l'écart entre les
  deux se lit, par exemple le trop-plein d'une réserve pleine les jours de
  pluie. Sous le report, une planche reportée compte zéro dans la part visée.
  Un calcul enregistré avant garde sa ligne d'avant. Aucune migration. En
  ligne le 8 novembre 2026 à 22 h 03 (#12 de ce dépôt).

### Corrigé (3.9, correction 1 : l'arbitrage validé en parts réservées)

- **Sous un arbitrage validé, chaque allocation est réservée à sa planche**
  (décision 1 de la 3.9, D-052, précisions D-077) : le moteur prenait les
  allocations pour des cibles sans les réserver, et la dernière planche
  examinée pouvait ne rien recevoir (le tunnel 4 de la ferme de test, à
  0 mm alors que la réserve tenait les allocations). Chaque allocation
  devient une part réservée, sans redistribution entre planches ; une
  planche que l'arbitrage ne nomme pas puise dans l'eau non attribuée ;
  quand une chaîne ne peut pas fournir toutes ses allocations (une limite
  journalière), chacune est réduite dans la même proportion. Le planning le
  dit sous les cartes du résumé : l'eau allouée, sa réduction, et l'eau
  allouée que les planches ne peuvent pas recevoir, qui reste non
  attribuée. Sans arbitrage, rien ne change. Aucune migration. En ligne le
  8 novembre 2026 à 21 h 21 (#11 de ce dépôt).

### Clos (3.8, fonctionnalités à la carte)

- **La 3.8 est close par le porteur** le 8 novembre 2026 à 20 h 21, après sa
  vérification en ligne et un premier lot de retours (#278) ; ses
  modifications éventuelles passeront chacune par une PR. L'écran
  d'arbitrage d'une pénurie présenté comme un plan d'assolement est décidé
  par le porteur le 8 novembre 2026 à 20 h 40 : dans la 3.9, maquette
  d'abord.

### Changé (passage au dépôt public)

- **Le travail passe sur le dépôt public** `module-irrigation-otf-public` (licence PolyForm Shield 1.0.0, historique neuf) ; l'ancien dépôt privé devient une archive. Le déploiement Cloudflare part désormais de ce dépôt. L'économie de minutes D-075 est annulée : contrôles complets sur chaque PR et sur `main`, parcours navigateur jamais sautés. Déploiements de #301, #302 et #303 (PR 2 du lot 3) vérifiés avant la bascule. Dependabot est retiré du dépôt public (PR #9 de ce dépôt).

### Changé (audit ergonomique, lot 3, PR 2 : gestes par ligne, mots simples, accessibilité)

- **Espèces** (Réglages) : les espèces à rattacher passent en tête, avec
  « 3 espèces à rattacher sur 78 » au lieu d'un compte qui prenait « sans
  référence » pour un rattachement, et la phrase « Sans référence : le
  besoin n’est pas calculé, seul votre objectif compte. » ; une recherche
  par nom ; « Rattacher comme Tomate… » propose, d'après le nom, une seule
  culture du jeu commun et attend toujours une confirmation.
- **Réserve du sol** : « Observer » sur chaque jardin ou abri dont la jauge
  est inconnue, qui ouvre son curseur ; les jardins de plein champ au même
  pourcentage, observés le même jour, tiennent en une phrase dépliable
  (« Tous les jardins de plein champ : 50 % du plein, observé hier »).
- **Alertes météo** : sans alerte, trois modèles en un clic, modifiables
  avant l'enregistrement (gel sous 3 °C, forte chaleur au-dessus de 33 °C,
  pluie au-delà de 15 mm, sur 3 jours) ; l'état des notifications de cet
  appareil et « Activer sur cet appareil » sur la page ; la note du gel à
  2 m repliée.
- **Mots simples** : « Besoin en eau par culture » en titre, le détail
  technique (sources, courbes, formule de l'ETM, lissage des stades) dans
  des replis « Pour les experts » ; un seul tableau et un seul formulaire
  pour les K_abri ; dans « Matériel », le nom du réglage séparé des planches
  couvertes et une ligne de sens sous « Chevauchements » et « Cumul
  maximal ».
- **Accessibilité** : « Aller au contenu » en premier arrêt du clavier ;
  toute cible à 44 px au téléphone (champs, listes, segments de
  l'historique, « Saisir la pluie », plis, cases, menus des matériels) ; le contraste de chaque
  texte mesuré sur toutes les pages, deux textes corrigés. Mode sombre et
  lecteur d'écran non vérifiés. Aucun calcul changé, aucune migration.

### Corrigé (« Aujourd'hui » : la légende de la frise)

- La frise de « Votre journée » dessinait en rouge les irrigations « Non
  faites » sans que la légende le dise. La légende nomme désormais chaque
  couleur présente sur la frise du jour, et seulement celles-là, avec le
  statut des cartes ; « Déjà passé » s'y ajoute quand l'heure actuelle est
  sur la frise (contrat, précision T19). Aucun calcul changé, aucune
  migration.

### Changé (audit ergonomique, lot 3, PR 1 : le planning et les arrosages)

- **Planning** : les cartes de tête disent d'abord ce qui demande un geste,
  « À valider », « Faites », « En retard » ; les refusées et les expirées
  passent en détail. « En retard » lit l'irrigation validée telle qu'elle
  est, avec la règle de la page des arrosages.
- **Planches non servies** (l'ancien « Non placé ») rangées par motif, le
  plus gros groupe d'abord ; les planches qu'aucun matériel n'arrose sont
  dites en action au-dessus du pli (« 38 planches n’ont aucun matériel :
  les rattacher », lien vers « Matériel »), jamais en manque d'eau.
  « R13 », « arbitrage » et les autres codes quittent les libellés : ils
  restent dans l'infobulle « Pour les experts » et dans les registres.
- **Arrosages** : le formulaire s'ouvre sans matériel choisi, donc sans
  cadre rouge ; la faisabilité hydraulique se dit en phrase d'action
  (« La pompe ne peut pas alimenter ce matériel en plus des autres : il
  manque 0,26 m³/h. Raccourcissez, décalez ou changez de pompe. »), le
  détail chiffré dessous ; aucun bouton de solution, le moteur n'en
  calcule pas.
- La liste des irrigations : « À traiter » en tête (les « Non faite » puis
  les « En retard », avec « Recalculer le plan » une fois), puis une ligne
  par irrigation rangée par jour (heure, matériel, volume, état), la carte
  entière sous « Voir la fiche ». « Annuler » est rangé dans le menu « … »
  de la ligne, sa confirmation inchangée ; « Démarrer maintenant » et
  « Modifier » restent visibles.
- **« Fait comme prévu »** sur une ligne passée, sur « Arrosages » et sur
  « Aujourd'hui » : une confirmation d'une ligne répète l'heure et le volume
  et dit que l'irrigation ne se corrigera plus ; l'écriture est celle de
  « Tout est fait », rejugée par le serveur. Jamais sur une ligne future ni
  sur une irrigation démarrée.
- Contrat du lot 3 versé dans le dépôt (`docs/audit-ergonomie-lot3-contract.md`,
  D-076). Parcours P31a. Aucune migration, aucun calcul changé.
- Les PR #299 (« Tout est fait », déployée le 8 novembre 2026 à 15 h 56,
  run 42490966130) et #300 (l'économie des minutes, déployée à 16 h 13,
  run 42493646188) sont en ligne, aucune migration ; consigné ici.

### Changé (économie des minutes GitHub Actions)

- La CI ne rejoue plus, après une fusion dans `main`, les trois jobs de
  contrôle déjà verts sur la PR (la protection de `main` exige la PR à jour) :
  seul le déploiement part. Les parcours navigateur (15 min) sautent pour une
  PR qui ne change que des documents (`docs/`, fichiers `.md`). Aucun contrôle
  requis n'est retiré (D-075).

### Ajouté (« Aujourd'hui » en tableau de bord, PR 3 sur 3 : « Tout est fait »)

- **« Tout est fait (n) »** en tête de « Votre journée », pour qui a arrosé
  sans le chrono : il enregistre d'un coup les irrigations planifiées
  passées, « En retard » ou « Non faites », chacune **telle que prévue** (son
  heure de début, sa durée, son matériel, son réglage et sa dose prévus,
  choix du porteur). Jamais une irrigation à venir, pas encore finie, une
  proposition à valider ni une irrigation démarrée au chrono ; rien à
  couvrir, pas de bouton.
- **Rien n'est écrit au premier clic** : une confirmation liste par jour ce
  qui sera enregistré (nombre, heures, planches, durée, m³ ou dose), chaque
  ligne cochée, un jour entier ou une irrigation se décochant ; le bouton dit
  le nombre exact ; « Annuler » ferme sans rien écrire. Elle dit qu'une
  irrigation enregistrée ne se modifie plus (D-006).
- Le serveur rejuge chaque irrigation avant de l'écrire, tout ou rien par
  irrigation ; un refus est dit avec son nom, les autres restent
  enregistrées ; le plan de la semaine se recalcule une fois. L'historique
  dit « Planifiée, faite comme prévu ». Une seule fonction du domaine,
  `lib/domain/done-as-planned.ts`, que le geste « Fait comme prévu » du lot 3
  reprendra.
- Parcours P30 complété. Aucune migration, aucune table nouvelle.
- La PR #298 (les écrans) est déployée le 8 novembre 2026 à 15 h 24 (run
  42488341591), aucune migration ; consigné ici.

### Changé (« Aujourd'hui » en tableau de bord, PR 2 sur 3 : les écrans)

- **La page « Aujourd'hui » devient le tableau de bord** de la maquette
  validée par le porteur : la date en toutes lettres, une phrase qui résume
  le jour et des pastilles qui mènent au bloc ; quatre tuiles pour la
  semaine (objectif, eau reçue, reste à apporter, eau utilisée) ; « Votre
  journée » avec la frise de 5 h à 22 h et des cartes par heure, les jours
  passés chargés repliés en une ligne ; les trois jours de météo dessinés
  sur une échelle commune ; l'eau de la semaine et la réserve du sol par
  jardin ; les cuves qui se remplissent ; l'anneau de la fiabilité.
- **Le menu** : « Aujourd'hui » détaché en tête dans un encart blanc
  « Tableau de bord », les autres pages rangées sous « Arroser »,
  « Équiper » et « Surveiller », Réglages à part. Au téléphone, l'entrée
  « Aujourd'hui » de la barre du bas est un bouton rond vert qui dépasse.
- Parcours P29 mis à jour, parcours P30 nouveau. Aucune migration, aucun
  calcul ne change.
- La PR #297 (le contrat et le domaine) est déployée le 8 novembre 2026 à
  14 h 53 (run 42486074151), aucune migration ; consigné ici.

### Ajouté (« Aujourd'hui » en tableau de bord, PR 1 sur 3 : le contrat et le domaine)

- **Le contrat** `docs/aujourdhui-tableau-de-bord-contract.md` (D-074) :
  la page « Aujourd'hui » devient le tableau de bord du module, sur la
  maquette validée par le porteur le 8 novembre 2026 ; « Tout est fait »
  enregistrera chaque irrigation passée telle que prévue (son choix).
- **Les valeurs à dessiner**, calculées une fois dans `lib/domain/today/` :
  la frise du jour (5 h à 22 h, élargie si besoin) et le repli des retards
  d'un même jour passé au-delà de trois ; les trois jours de météo sur une
  échelle commune, avec ce qui est annoncé chaque jour ; les cuves et les
  prélèvements limités ; la semaine de la ferme et de chaque jardin
  (objectif, eau reçue, reste à apporter, pondérés par la surface, une
  valeur inconnue laissant le total inconnu) ; la réserve du sol par
  jardin et sa planche la plus sèche ; l'état de chaque donnée de
  fiabilité ; la date en toutes lettres, la phrase de résumé et ses
  pastilles.
- Le service de la page lit en plus le tableau de la semaine quand
  « Objectifs et besoins » est cochée, sans relire la météo ni Ouvre ta
  ferme. **L'écran ne change pas encore** (PR 2). Aucune migration, aucun
  calcul ne change.
- La PR #296 (« Besoin par culture ») est déployée le 8 novembre 2026 à
  14 h 03 (run 42482021262), aucune migration ; consigné ici.

### Changé (retours du porteur du 8 novembre 2026 : Besoin par culture)

- **Chaque carte de culture et d'espèce dit qu'elle s'ouvre** : « Voir le
  détail » et une flèche vers le bas, « Replier » une fois ouverte, le fond
  éclairé au survol ; une phrase sous chaque liste dit ce qu'on trouve en
  touchant une carte.
- **Le résumé de chaque culture**, à droite de son nom (sous le nom au
  téléphone) : « Kc de 0,50 à 1,10 · racines jusqu’à 0,60 m · 3 séries de
  la saison ». Les Kc qui comptent aujourd'hui, surcharges comprises ; les
  30 cm proposés sont dits comme tels ; choix du porteur.
- Parcours P20 complété. Aucune migration, aucun calcul ne change.
- La PR #295 (retours planning et matériel) est déployée le
  8 novembre 2026 à 13 h 30 (run 42479629093), aucune migration ;
  consigné ici.

### Changé (retours du porteur du 8 novembre 2026 : planning et matériel)

- **« Non placé » replié par défaut** sur le planning de la semaine : son
  titre garde le nombre de planches (« Non placé (37 planches) ») et une
  flèche vers le bas le déplie, à toutes les largeurs. Une semaine où tout
  est servi garde sa phrase.
- **Les « i » du planning** (« d'où vient ce chiffre ») restent des ronds
  de 24 px au lieu de prendre le dessin des boutons de la section : chaque
  ligne de « Non placé » en est plus courte.
- **« Matériel et placement »** : le plan de la parcelle vient en premier,
  la fiche de la planche choisie juste dessous, puis l'aperçu « Apport
  calculé par heure ».
- Parcours P0, P10, P12 et P26 mis à jour. Aucune migration, aucun calcul
  ne change.
- La PR #293 (audit ergonomique, lot 2, PR 3) est déployée le
  8 novembre 2026 à 13 h 01 (run 42477289518), aucune migration ;
  consigné ici. Le lot 2 est en ligne.

### Ajouté (3.8 quater, audit ergonomique, lot 2, PR 3 sur 3 : les écrans)

- **La page « Aujourd'hui »** (`/irrigation/aujourdhui`, D-073, F1, F31),
  première du menu et page d'arrivée du module quand l'une des huit cases
  utiles est cochée : la ligne du dernier calcul du plan, puis les blocs
  « Gel ou chaleur », « En retard », « À faire aujourd’hui », « Eau
  disponible » et « Fiabilité du calcul », chacun présent seulement si sa
  case est cochée, une phrase calme quand il n'a rien à dire. Les boutons
  existants « Démarrer maintenant » et « Recalculer le plan », et « Ouvrir »
  vers la carte. Toujours la saison du jour (F32). Une icône de soleil.
- **La zone « Fiabilité du calcul »** : cinq lignes au plus, chacune avec
  sa phrase et le bouton qui mène à la carte même (la réserve, le jardin
  du sol, la proposition, F37), « Voir les n autres » et « Voir moins » ;
  son « ? » écrit chaque seuil.
- **La pastille du menu** (F12, F33) : le nombre de lignes de fiabilité
  et de retards, en ambre, sur l'entrée « Aujourd'hui » du menu et de la
  barre du bas ; lue sans requête vers Ouvre ta ferme.
- L'avertissement « pluie réelle incomplète » du tableau des besoins dit
  la même conséquence que la zone (F9, F41). Parcours P29. Douze
  précisions de plus (F31 à F42). Aucune migration, aucun calcul ne change.
- La PR #292 (affichage du calculateur) est déployée le 8 novembre 2026 à
  12 h 30 (run 42475030420), aucune migration ; consigné ici.

### Corrigé (3.8 bis, calculateur d'irrigation)

- **Les unités du calculateur** (l/h, m, %) restent au bord droit de leur
  case, au lieu de flotter au milieu.
- **Plus d'étiquette « calculé » ou « estimé »** tant que le résultat est
  inconnu. Parcours P25 complété.
- Le calculateur est **validé par le porteur** le 8 novembre 2026, sans
  ajout.
- **La PR #291 est déployée** le 8 novembre 2026 à 12 h 01 (run
  42472817833) ; consigné ici.

### Ajouté (3.8 quater, audit ergonomique, lot 2, PR 2 sur 3 : le domaine « Aujourd'hui » et « Fiabilité »)

- **La fonction unique de la zone « Fiabilité du calcul »**
  (`lib/domain/today/reliability.ts`, D-073, F5, F8) : le volume d'une
  réserve de plus de 7 jours, la pluie réelle manquante sur les 7 derniers
  jours, le sol jamais observé, les espèces sans rattachement, le plan de
  plus de 48 heures, chacun avec sa phrase et son geste.
- **Les cinq blocs de la page « Aujourd'hui »** (`today-view.ts`,
  `today-irrigations.ts`) : gel ou chaleur des trois jours, irrigations en
  retard, à faire aujourd'hui, eau disponible, fiabilité ; la pastille du
  menu ; le service `lib/services/today-service.ts` qui rassemble les
  lectures existantes, sans requête nouvelle vers Ouvre ta ferme.
- Rien n'est encore affiché : la page vient avec la PR 3. Huit précisions de
  plus (F23 à F30). Aucune migration, aucun calcul ne change.
- La PR #290 (lot 2, PR 1) est déployée le 8 novembre 2026 à
  11 h 30 (run 42470683962), aucune migration ; consigné ici.
- Le lot 1 (#288) est relu et validé par le porteur le 8 novembre 2026
  (D-072, E4 compris) ; consigné ici.

### Ajouté (3.8 quater, audit ergonomique, lot 2, PR 1 sur 3 : le téléphone)

- **Une barre en bas de l'écran du téléphone** remplace le menu qui
  défilait en haut : quatre pages et « Plus », qui ouvre la liste entière et
  porte la pastille verte quand la page ouverte n'est pas dans la barre ; un
  menu de cinq pages ou moins y tient entier, sans « Plus » (D-073, F6).
- **La saison passe dans la ligne du titre** au téléphone (F7).
- **Le planning se replie au téléphone** : le jour du jour ouvert (ou le
  prochain jour qui a des propositions), les jours écoulés sous « Jours
  écoulés (n) » sauf celui qui porte des irrigations en retard, les autres
  jours sur « Voir les créneaux », les six tuiles de totaux en une ligne qui
  se déplie (F11).
- **Le bandeau « Alertes système non disponibles »**, déjà vu sur
  l'appareil, se replie en un point sur la cloche ; il revient quand l'état
  change, le rappel reste entier dans Réglages, et un stockage illisible le
  laisse déplié (F10).
- **Les « ? », les « i » et « Actualiser » passent à 44 px** au téléphone ;
  les tuiles de totaux de l'historique et de l'aperçu du matériel sur deux
  colonnes.
- Rien ne change à l'ordinateur ni à la tablette. Huit précisions de plus
  (F15 à F22). Parcours navigateur P28 aux deux largeurs. Aucune migration,
  aucun calcul du moteur ne change.
- La PR #289 (contrat du lot 2) est déployée le 8 novembre 2026 à 05 h 02
  (run 42444235434), aucune migration ; consigné ici.

### Documents (3.8 quater, audit ergonomique, lot 2)

- **Contrat du lot 2** (`docs/audit-ergonomie-lot2-contract.md`, D-073) :
  barre du bas du téléphone à quatre entrées et « Plus », page
  « Aujourd'hui » (gel, retards, à faire, eau) et zone « Fiabilité du
  calcul » avec le geste qui corrige chaque donnée périmée. Rien de codé.

### Ajouté (3.8 quater, audit ergonomique, lot 1)

- **Chaque page donne son nom à l'onglet** (« Planning de la semaine ·
  Irrigation »), et une adresse inconnue mène à une **page introuvable en
  français**, avec le menu et un bouton vers la première page cochée
  (D-069, D-072, point 7 de l'audit).
- **Les listes de planches se rangent dans l'ordre naturel** (B9-9 avant
  B9-10, la planche zéro en premier), et **le périmètre d'un objectif se
  cherche et se range par jardin** (point 4).
- **La saison n'est proposée que là où elle change la page** (ni dans
  Alertes météo, ni dans Réglages sans correspondance des espèces), et **la
  commune de la météo ne se change que dans Réglages** ; « Objectifs et
  besoins » y renvoie (point 9).
- **L'historique s'ouvre sur les irrigations réalisées**, avec les onglets
  « Planifiées » et « Toutes » ; l'export suit l'onglet et le dit sur son
  bouton ; « Saisir la pluie » mène au bloc de la pluie mesurée quand elle
  manque (point 11).
- Parcours navigateur P27 aux deux largeurs. Aucune migration, aucun calcul
  du moteur ne change.
- La PR #287 est déployée le 8 novembre 2026 à 03 h 29 (run 42437921213),
  aucune migration ; consigné ici. La PR #288 (lot 1) est déployée le
  8 novembre 2026 à 04 h 29 (run 42441986250), aucune migration ; consigné
  ici.

### Ajouté (3.8 ter, créneaux protégés nommés, PR 5 sur 5)

- **Les créneaux protégés se règlent à l'écran** (D-062, D-071) : dans le
  pli « Réglages du planning », la section « Créneaux protégés » les liste
  (« Lavage · mardi et jeudi · de 21:00 à 23:00 »), les crée, les modifie,
  les supprime avec confirmation et lit le journal de leurs versions ; un
  créneau vaut au prochain calcul, « Recalculer le plan » le prend tout de
  suite.
- **« Planifier » avertit d'un arrosage qui tombe dans un créneau
  protégé**, sans le bloquer : « Vous pouvez l'enregistrer quand même. »
- **Décocher le Planning compte aussi les créneaux protégés** enregistrés
  dans son avertissement ; ils restent, et valent de nouveau quand la case
  est recochée.
- **Les PR #285 et #286 sont déployées** ensemble le 8 novembre 2026 à
  03 h 06 (run 42436216237), aucune migration ; consigné ici.

### Corrigé (3.8 ter, créneaux protégés nommés : le journal)

- **Une suppression refusée n'écrit plus rien au journal des créneaux
  protégés**, même dans la même milliseconde que la suppression précédente
  (S15). Le défaut, de la PR 3, a fait échouer la CI de `main` après la
  fusion de #285, qui se déploie avec ce correctif. Aucun écran ne supprime
  encore de créneau : rien ne change sur le site.

### Ajouté (3.8 ter, créneaux protégés nommés, PR 4 sur 5)

- **Un arrosage validé qui tombe dans un créneau protégé reçoit une
  suggestion** (D-062, D-071) : « Réduire » à la partie qui tient avant le
  créneau, si elle porte la dose minimale, ou « Annuler » ; elle se combine
  aux autres raisons comme dans la 3.7, et « Garder » la fait taire jusqu'à
  ce qu'un calcul en fasse une autre.
- **Une irrigation faite pendant un créneau protégé le dit** sur sa carte de
  l'historique (« Faite pendant le créneau protégé « Lavage » »), d'après
  les créneaux en vigueur à son début ; l'export CSV ne change pas. Aucun
  créneau ne se saisit encore : rien ne change sur le site avant la PR 5.
- **La PR #284 est déployée** le 8 novembre 2026 à 02 h 07 (run
  42431986012), migration 0030 appliquée ; consigné ici.

### Ajouté (3.8 ter, créneaux protégés nommés, PR 3 sur 5)

- **Les créneaux protégés s'enregistrent par exploitation** (D-062, D-071) :
  une migration additive (0030) ajoute la table des créneaux et le journal
  de chaque version, avec son auteur et sa date ; la suppression est
  logique ; la base refuse elle-même un créneau impossible. Le calcul du
  plan relit les créneaux de l'exploitation à chaque fois, et ceux d'une
  autre exploitation n'y comptent jamais. Aucun créneau n'existe au départ
  et l'écran pour les saisir arrive avec la PR 5 : rien ne change encore sur
  le site.
- **La PR #283 est déployée** le 8 novembre 2026 à 01 h 40 (run
  42430142206) ; consigné ici.

### Ajouté (3.8 ter, créneaux protégés nommés, PR 2 sur 5)

- **Le planning évite les créneaux protégés** (D-062, D-071) : aucun
  créneau proposé, de quelque matériel, n'y commence, ne s'y poursuit ni ne
  s'y termine, même pour une planche prioritaire, même en pénurie ; le
  créneau se place après lui ou s'arrête avant, et sa justification nomme le
  créneau évité. Une planche qui ne tient nulle part se lit « non placé »,
  motif « créneau protégé : Lavage des légumes ». Sans créneau, le plan est
  celui d'avant. Rien ne change encore sur le site : les créneaux ne se
  saisissent pas encore.
- **La PR #282 est déployée** le 8 novembre 2026 à 01 h 17 (run
  42428151432) ; consigné ici.

### Ajouté (3.8 ter, créneaux protégés nommés, PR 1 sur 5)

- **Le module de domaine des créneaux protégés** (D-062, D-071) : la
  vérification d'un créneau saisi (un nom, un jour au moins, deux heures
  différentes à la minute), ses instants chaque semaine aux heures de la
  ferme, passage de minuit et changement d'heure compris, l'union des
  créneaux qui se chevauchent ou se touchent, et le découpage d'une plage
  horaire autour d'eux. Rien n'est encore branché : le plan, la base et
  l'écran ne changent pas.

### Ajouté (3.8 bis, calculateur d'irrigation)

- **Une onzième case, « Calculateur d'irrigation »** (D-061, D-070) : elle
  coche aussi Matériel et placement et arrive décochée sur une ferme qui
  avait déjà fait son choix (le bandeau de Réglages l'annonce).
- **« Calculer depuis le matériel »** dans le formulaire d'un réglage :
  goutte-à-goutte par planche ou par vanne, aspersion en pluviométrie
  moyenne ou en profil en cône. Le résultat montre les millimètres par heure
  reçus, l'eau pompée, les avertissements et, sur demande, le calcul pas à
  pas ; rien n'est enregistré avant « Ajouter le réglage » ou
  « Enregistrer ».
- **Quatre exemples de fiches techniques** (NaanDanJain 427 et Hadar 7110,
  AmnonDrip, Netafim SuperNet) avec leur source et leur date de lecture, et
  la correction du débit par la pression.
- **L'étiquette de chaque réglage** : « calculé », « estimé », « mesuré »
  (case du pluviomètre) ou « saisi ». Une valeur retouchée à la main
  redevient « saisie ». Elle est gardée dans une table à part (migration
  additive 0029) ; le moteur ne change pas.
- Parcours navigateur P25.
- **La PR #280 est déployée** le 7 novembre 2026 à 23 h 57 (run
  42422143822) ; consigné ici.
- **La PR #281 est déployée** le 8 novembre 2026 à 00 h 24 (run
  42424125065, migration 0029 appliquée) ; consigné ici.

### Documents (audit ergonomique, 3.8 quater)

- **Les quatorze améliorations de l'audit du 7 novembre 2026 sont inscrites
  dans la roadmap** comme décidées (D-069), sous-tranche 3.8 quater, après la
  3.8 ter et avant la 3.9, en trois lots. Aucun code ne change.
- **La PR #279 est déployée** le 7 novembre 2026 à 23 h 34 (run 42420295533) ;
  consigné ici.

### Changé (refonte ergonomique, deuxième passe : R4)

- **Le module prend l'allure d'Ouvre ta ferme** (7 novembre 2026, D-068),
  d'après la maquette validée par le porteur : à l'ordinateur, une barre du
  haut blanche avec la pastille verte à goutte et un menu en colonne collée
  au bord gauche ; au téléphone, la barre gris foncé d'OTF avec le nom, la
  cloche des notifications et l'initiale.
- **Le titre de chaque page** passe à la taille d'OTF, avec son « ? » au
  trait ; l'état des données d'OTF tient en une ligne sous le titre.
- **Le plan** perd son bandeau vert foncé : chaque parcelle est un bloc
  blanc simple, l'étiquette Jardin ou Abri une pastille douce, et la
  planche choisie montre ses mesures en tuiles vert pâle.
- **Les étiquettes** s'écrivent normalement au lieu de petites majuscules
  grises, sur toutes les pages.
- **Moins de cadres dans les cadres** : un bloc blanc ne contient plus de
  bloc encadré ; les sous-parties se lisent à leur fond. L'eau du jour
  passe en tuile vert pâle. Aucun calcul, aucune page, aucun texte de
  contenu ne change.
- **La PR #278 est déployée** le 7 novembre 2026 à 22 h 28 (run
  42415089479, migration 0028 appliquée) ; consigné ici.

### Changé (3.8, PR 7 : premier lot de retours de visite)

- **L'ordre du menu** suit l'usage, du geste de chaque jour à l'installation
  (7 novembre 2026, P36).
- **« Reposer » le matériel stocké** se fait depuis sa carte, dans Matériel
  et placement, et plus depuis les arrosages (P37).
- **L'inventaire du matériel est compact**, sur deux colonnes en grand
  écran (P39) ; **le curseur de la réserve du sol** n'a plus que ses quatre
  crans, sec 25 %, frais 50 %, humide 75 %, détrempé 100 % (P40).
- **Les marges de gel d'Alertes cultures se règlent** par la ferme, 3 °C
  pour une culture sensible et 2 °C pour une rustique par défaut, de 0 à
  5 °C (P44, migration additive 0028) ; **« Alertes cultures envoyées » est
  replié** au chargement (P45).
- **La semaine du planning est un tableau** à partir de 1 360 px : les jours
  en colonnes, une ligne par matériel, chaque créneau compact qui s'ouvre
  par-dessus (P46). Sur téléphone, rien ne change.

### Ajouté (3.8, PR 7 : premier lot de retours de visite)

- **Le « ? » des groupes de jardins alignés**, avec un schéma, et **celui du
  K_abri** (P38, P42).
- **Les dessins des espèces d'Ouvre ta ferme** à côté des cultures de
  « Besoin par culture » et des espèces des réglages, lus chez Ouvre ta
  ferme par la route `/irrigation/especes.svg` (P41).
- **Alertes météo explique la marge** : prévision à 2 m, 2 à 3 °C de moins
  au ras du sol, aucune marge ajoutée au seuil, renvoi au gel par culture
  (P43).
- **La PR #277 est déployée** le 7 novembre 2026 à 20 h 34 (run
  42405904652) ; consigné ici.

### Ajouté (registres : deuxième passe de la refonte ergonomique)

- **La deuxième passe de la refonte inscrite à la feuille de route**
  (7 novembre 2026, D-068) : à sa relecture, le porteur trouvait la refonte
  lisible mais trop proche d'avant. Sur une maquette validée par lui, le
  plan perd son bandeau vert foncé, les cadres s'allègent, les étiquettes
  s'écrivent normalement, le titre prend la taille d'OTF et le téléphone
  reçoit la barre gris foncé d'OTF. Code juste après la 3.8 ; rien n'est
  codé.
- **La PR #276 est déployée** le 7 novembre 2026 à 18 h 20 (run
  42394736692) ; consigné ici.

### Ajouté (3.8, PR 6 : d'où vient ce chiffre)

- **La bulle « d'où vient ce chiffre »** (7 novembre 2026, D-067) : sur les
  chiffres principaux des pages, un « i » dit le calcul avec les valeurs de
  la ferme (« Objectif 20 mm − (arrosé 5 mm + pluie 3 mm) = 12 mm à apporter
  cette semaine »).
- **La PR #275 est déployée** le 7 novembre 2026 à 17 h 50 (run
  42392529016) ; consigné ici.

### Ajouté (3.8, PR 5 : le « ? » de chaque page)

- **Le « ? » de chaque page** (7 novembre 2026, D-067) : à quoi sert la page,
  comment la lire, par où commencer.
- **Les notifications ouvrent la page** de la fonctionnalité qui les envoie.
- **La PR #274 est déployée** le 7 novembre 2026 à 17 h 27 (run
  42390377633), Worker de notification compris ; consigné ici.

### Changé (3.8, PR 4 : les traitements et les notifications suivent le choix)

- **Une case décochée n'est plus prise en compte** (7 novembre 2026, D-067) :
  les traitements du matin (relevé météo, ETM, état du sol, plan et
  notification du matin, séchage avant récolte) et les alertes ne visent que
  les fermes qui ont coché leur case.
- **Sans Ressources et pompes**, le planning fait ce qu'il fait pour une
  ferme sans pompe, et une irrigation saisie n'est plus bloquée par la
  pompe ; **sans Arrosages**, les alarmes à venir du téléphone sont retirées.
- **Changer ses cases** recalcule le plan de la semaine aussitôt.
- **La PR #273 est déployée** le 7 novembre 2026 à 17 h 00 (run
  42388264208) ; consigné ici.

### Ajouté (3.8, PR 3 : le choix des fonctionnalités à l'écran)

- **Choisir ses fonctionnalités** (7 novembre 2026, D-067,
  `docs/feature-selection-contract.md`) : à la première ouverture, sur la
  page Bienvenue ; ensuite dans Réglages, une case d'un geste. Cocher une
  case coche ce dont elle a besoin, après l'avoir nommé ; décocher une case
  qui a des données avertit de ce qui reste enregistré.
- **Une case décochée** n'est plus affichée : sa page, son entrée du menu et
  ses blocs sur les autres pages disparaissent ; ses données restent, et
  reviennent quand on la recoche.
- **Les fermes d'avant la 3.8** gardent tout coché, avec un bandeau qui
  invite à choisir.
- **La PR #272 est déployée** le 7 novembre 2026 à 16 h 30 (run
  42385826439) ; consigné ici.

### Changé (3.8, PR 2 : une page par fonctionnalité)

- **Une page par fonctionnalité** (7 novembre 2026, D-067,
  `docs/feature-selection-contract.md`, section 5) : Matériel et placement,
  Arrosages, Objectifs et besoins, Planning de la semaine, Ressources et
  pompes, Réserve du sol, Besoin par culture, Alertes météo, Alertes cultures,
  Historique et cumuls, Réglages. Menu de la charte à gauche sur ordinateur,
  bande de pages en bas sur téléphone ; saison et parcelle gardées d'une page
  à l'autre ; chaque page ne charge que ses données.
- **Les anciennes adresses** (`/irrigation#…`, celles des notifications déjà
  reçues) mènent à la page qui porte le bloc, avec la même semaine.
- **La PR #271 est déployée** le 7 novembre 2026 à 16 h 05 (run
  42383665657), migration 0027 appliquée ; consigné ici.

### Ajouté (3.8, PR 1 : la liste des fonctionnalités et l'enregistrement du choix)

- **Les dix cases et leurs règles** (7 novembre 2026, D-067,
  `docs/feature-selection-contract.md`) : les dépendances, cocher entraîne le
  nécessaire, une case nécessaire ou la dernière ne se décoche pas, la
  première ouverture, la ferme d'avant la 3.8 toute cochée avec le bandeau,
  la case nouvelle annoncée, le texte des avertissements, les adresses des
  pages. Sans effet visible : rien ne lit encore le choix.
- **Le choix s'enregistre** par une migration additive
  (`drizzle/0027_feature_selections.sql`), une ligne par ferme.
- **La PR #270 est déployée** le 7 novembre 2026 à 15 h 36 (run
  42381207173) ; consigné ici.

### Ajouté (contrat de la 3.8)

- **Le contrat des fonctionnalités à la carte** (7 novembre 2026, D-067,
  `docs/feature-selection-contract.md`) : un seul mode, dix cases à cocher
  pour toute la ferme, une page par case, l'aide contextuelle ; douze
  réponses du porteur, vingt et une précisions tranchées par la
  recommandation, sept PR prévues.
- **La PR #269 est déployée** le 7 novembre 2026 à 14 h 57 (run
  42378028989) ; consigné ici.

### Corrigé (eau : le champ « Millimètres » de la pluie mesurée)

- **Le champ montre la mesure déjà saisie du jour choisi** (7 novembre 2026,
  choix du porteur) : « 0 » compris, vide sans mesure ; il suit le changement
  de date, l'enregistrement et le retrait de la mesure.
- **La PR #268 est déployée** le 7 novembre 2026 à 14 h 14 (run
  42375107865) ; consigné ici.

### Corrigé (planning : les cartes « Annulée » et les pastilles pâles)

- **Les cartes « Annulée » se rangent avec les refusées** (7 novembre 2026,
  choix du porteur) : trait gauche gris, texte atténué ; les pastilles
  Expirée, Refusée, Remplacée et Annulée, du planning comme des arrosages
  enregistrés, passent en gris moyen bordé, lisibles sur la carte blanche.
- **La PR #267 est déployée** le 7 novembre 2026 à 13 h 42 (run
  42372809720) ; consigné ici.

### Corrigé (refonte ergonomique : l'icône de la page)

- **Plus d'icône de page demandée en vain** (7 novembre 2026) : depuis le
  troisième temps de la refonte, le composant des icônes portait un nom que
  le cadre lit comme l'image de l'onglet ; chaque page la demandait et
  recevait une erreur 404. Renommé ; un test interdit ces noms, et le
  parcours P0 vérifie désormais que les icônes et le manifeste déclarés par
  la page répondent.
- **La PR #266 est déployée** le 7 novembre 2026 à 13 h 03 (run
  42369666507) ; consigné ici.

### Ajouté (5 quinquies, alertes météo par culture : la recette réelle)

- **La recette réelle des alertes météo par culture** (6 et 7 novembre
  2026, `docs/recette-5-quinquies.md`) : ses 24 légumes rattachés au jeu
  commun sur les réponses du porteur, les seuils justes à la main, la vraie
  alerte de gel du dimanche 8 novembre reçue sur son téléphone verrouillé, à
  l'heure et avec le son, et la toucher ouvre le module. Trois défauts
  trouvés, corrigés et constatés ; jugement au porteur.
- **Les PR #264 et #265 sont déployées** le 7 novembre 2026 à 03 h 05 (run
  42326030102) et à 12 h 31 (run 42367368734) ; consigné ici.

### Ajouté (registres : banc commun avec Tlaloc et idées sans engagement)

- **Le banc commun de saisons rejouées avec Tlaloc inscrit à la feuille de
  route** (7 novembre 2026, D-065, section 6 ter) : après la 3.9, en
  recherche, un contrat d'abord et aucun code sans l'accord du porteur. Quatre
  idées rangées sans engagement : archivage des prévisions J+1, formule du
  tensiomètre pour C2, heures de silence des notifications, ET0 horaire.
  Rien n'est codé.
- **Partage des rôles avec Tlaloc** (7 novembre 2026, D-066, section 6
  quater) : Tlaloc prend l'automatisation (C1 à C3 confiés, recherches
  conservées) ; chantier de fusion des deux moteurs avant la Tranche 4, qui
  absorbe le banc commun ; fonctionnalités cochées à la connexion, intention
  rattachée à la 3.8. Rien n'est codé ni cadré.

### Modifié (refonte ergonomique, troisième temps : couleurs d'état, bleu eau et icônes)

- **La charte du module appliquée, troisième temps** (6 novembre 2026, R3
  de la refonte ergonomique) : les messages d'attention, d'erreur, de
  réussite et d'information aux couleurs de la charte ; un seul bleu, celui
  de l'eau ; la coche des données protégées et le « + » des boutons d'ajout
  dessinés au trait. Le plan garde ses couleurs. Habillage seulement.

### Modifié (refonte ergonomique, deuxième temps : boutons, onglets, tableaux et tuiles)

- **La charte du module appliquée, deuxième temps** (6 novembre 2026, R2 de
  la refonte ergonomique) : quatre sortes de boutons (principal vert,
  secondaire au contour vert, outil au contour anthracite, destructif
  rouge), les boutons bleus devenus verts ; l'onglet choisi souligné d'un
  trait vert ; les tableaux à lignes alternées, chiffres alignés ; les tuiles
  de totaux vert pâle, celles de la pluie en bleu eau. Habillage seulement.

### Ajouté (contrat : pilotage des électrovannes)

- **Le contrat du pilotage des électrovannes** (7 novembre 2026, D-064,
  `docs/valve-control-contract.md`) : interface commune, quinze règles de
  sécurité testables, simulateur de pannes, vingt-quatre cas chiffrés. Rien
  n'est codé, acheté ni exécuté sur la ferme.

### Ajouté (registres : connexions matériel)

- **Trois fonctions inscrites à la feuille de route** (7 novembre 2026,
  D-063) : la connexion à une station météo locale, la connexion à des
  tensiomètres et le pilotage d'électrovannes, après la 3.9. Elles sont à
  l'état « recherche en cours » : rien n'est décidé ni codé, et le pilotage
  ne s'exécute pas sur la ferme réelle.

### Modifié (refonte ergonomique, premier temps : jetons, polices, fond et blocs)

- **La charte du module appliquée, premier temps** (6 novembre 2026, R1 de
  la refonte ergonomique) : les polices de la charte (Bricolage Grotesque
  pour les titres, DM Sans pour les boutons et les sous-titres, Open Sans
  pour le texte), servies par le module lui-même avec leur licence ; le texte
  courant à 13 px ; un fond de page gris très clair, les grandes sections
  blanches posées par une ombre légère ; les gris et les verts ramenés à ceux
  de la charte ; un seul rayon, deux ombres ; un anneau de focus vert.
  Habillage seulement : rien ne change dans les calculs ni dans les textes.

### Corrigé (notifications : la réception sur le téléphone)

- **Les notifications arrivent sur un téléphone en veille, et les toucher
  ouvre le module** (6 novembre 2026) : une alerte de gel envoyée à 00 h 02
  n'est apparue qu'à 00 h 09, au réveil du téléphone, et la toucher fermait
  la notification sans rien ouvrir. Chaque notification part désormais en
  priorité haute, et le toucher amène le module au premier plan avant
  d'ouvrir la page annoncée. Vaut pour toutes les notifications du module,
  fins d'irrigation comprises. Trouvé à la recette réelle de la 5 quinquies.

### Corrigé (5 quinquies, alertes météo par culture : l'envoi)

- **Les alertes par culture partent vraiment** (6 novembre 2026) : une
  alerte de gel qui nommait plusieurs cultures, une aspersion à
  reconsidérer, des séchages groupés étaient refusés par le service d'envoi
  et enregistrés « Échec du service de notification ». Le texte tient
  désormais dans 160 caractères et l'étiquette ne porte plus que des
  caractères admis. Trouvé à la recette réelle.

### Ajouté (contrat des créneaux protégés nommés)

- **Le contrat des créneaux protégés nommés** (6 novembre 2026,
  `docs/protected-slots-contract.md`, D-062) : plages horaires nommées,
  chaque semaine par jours, pour tout le matériel, interdites sans exception,
  suggestions sur les arrosages déjà validés, dix-sept cas chiffrés. Validé
  par le porteur ; rien de codé, aucun contrôle de code rejoué.

### Ajouté (contrat du calculateur d'irrigation)

- **Le contrat du calculateur d'irrigation** (6 novembre 2026,
  `docs/irrigation-calculator-contract.md`, D-061) : formules du
  goutte-à-goutte et de l'aspersion, correction de pression, étiquettes de
  provenance, quatre exemples sourcés, cas chiffrés de la preuve de fin.
  Validé par le porteur ; rien de codé, aucun contrôle de code rejoué.

### Corrigé (5 ter, réserve du sol : la recette réelle)

- **« Maintenant » accepté pour une observation du sol** (6 novembre 2026)
  quand l'horloge de l'appareil avance de quelques secondes sur celle du
  serveur : jusqu'à deux minutes d'avance, l'observation prend l'heure du
  serveur ; au-delà, elle reste refusée comme future. Trouvé à la recette
  réelle.
- **La recette réelle de la 5 ter et de la pastille « eau arrosée en
  trop »** (6 novembre 2026, `docs/recette-5-ter.md`) : le sol de la
  Clémentière et une observation de 50 % enregistrés sur les réponses du
  porteur, cinq planches justes à la main, affichage sans débordement à
  390 px ; jugement au porteur.
- **La PR #254 est déployée** le 6 novembre 2026 à 22 h 04 (run
  42291571299) ; consigné ici.

### Ajouté (5 quinquies, alertes météo par culture : l'écran)

- **L'encart « Alertes cultures »** (6 novembre 2026, PR 3 de la
  5 quinquies), sous les alertes météo : activer chaque alerte, l'horizon du
  gel, le curseur de microclimat de −5 à +5 °C et les seuils des
  aspersions ; les seuils de gel des cultures présentes ou à venir, leur
  rattachement au jeu commun et leur correction par la ferme ; les cultures
  sans seuil ; les délais d'arrêt d'arrosage avant récolte ; les prochaines
  échéances si la prévision se confirme ; l'historique des alertes avec
  leurs valeurs. Information seulement.

### Ajouté (5 quinquies, alertes météo par culture : la persistance et l'envoi)

- **Les alertes par culture envoyées** (6 novembre 2026, PR 2 de la
  5 quinquies) : après chaque prévision lue, une notification par jour de
  gel qui nomme les cultures présentes concernées, et une par jour où une
  aspersion de jour sous abri serait à reconsidérer ; chaque matin, une pour
  les séries dont il est temps d'arrêter l'arrosage avant la récolte.
  Chaque alerte part une seule fois et reste dans l'histoire avec ses
  valeurs. Le réglage à l'écran viendra ensuite.
- **L'énergie solaire prévue du jour** est conservée avec les températures.

### Ajouté (5 quinquies, alertes météo par culture : le domaine)

- **Les règles des alertes par culture** (6 novembre 2026, PR 1 de la
  5 quinquies), sans écran ni envoi : le seuil de gel de chaque espèce ou
  série, sa marge et le curseur de microclimat, la présence d'une culture au
  jour visé ; l'arrêt d'arrosage avant récolte ; les aspersions de jour sous
  abri à reconsidérer par temps frais ou couvert ; les réglages et les
  textes des notifications.

### Ajouté (pastille « eau arrosée en trop »)

- **L'eau arrosée en trop** (6 novembre 2026) : en tête du bloc « Réserve du
  sol », l'eau d'irrigation des sept derniers jours que le sol n'a pas pu
  retenir, perdue sous les racines, en tout et planche par planche, en mm et
  en m³. Une planche dont la jauge était inconnue un jour d'arrosage est dite
  à part. Information seulement.

### Ajouté (5 ter, réserve du sol : l'état du jour et la dose au-delà du sol, PR 3d)

- **La dose au-delà de ce que le sol retient** (6 novembre 2026, PR 3d de la
  5 ter) : sous une proposition du planning, chaque planche dont la dose
  dépasse ce que le sol peut encore retenir le dit, avec les mm perdus en
  drainage. Information seulement : la dose du plan ne change pas.
- **L'état du jour de la jauge enregistré chaque matin**, après la météo et
  l'ETM, pour les sept jours d'avant de chaque planche.

### Ajouté (5 ter, réserve du sol : les profils racinaires, PR 3c)

- **Les profils racinaires** (6 novembre 2026, PR 3c de la 5 ter) : dans la
  page « Coefficients culturaux », la carte de chaque culture montre sa part
  utilisable p et la profondeur de ses racines à chaque stade, fixe ou qui
  augmente, avec leur source ; la ferme enregistre son propre profil à partir
  d'un jour, le jeu commun restant rappelé à côté, et peut le reprendre.

### Ajouté (5 ter, réserve du sol : la jauge par jardin, PR 3b)

- **La jauge de la réserve du sol** (6 novembre 2026, PR 3b de la 5 ter) :
  dans le bloc « Réserve du sol », par parcelle, son curseur, qui règle ses
  jardins de plein champ ; par jardin ou abri, le % du plein de maintenant,
  la planche la plus basse, le prévu jour par jour jusqu'à dimanche et son
  propre curseur, de 0 à 100 % avec ses quatre repères, maintenant ou plus
  tôt dans la journée ou la veille ; par planche, son état en mm sur sa
  capacité, son seuil, le jour du seuil ou les jours avant, la dose
  conseillée ou « arrêt avant récolte », la réserve épuisée, le drainage du
  jour, les cultures et les mentions ; sans culture, son état de surface,
  qui se déclare à partir d'un jour. Une jauge inconnue dit le jour et la
  donnée qui manquent. Information seulement : rien ne change un besoin, un
  plan ni une dose.

### Ajouté (5 ter, réserve du sol : les réglages du sol, PR 3a)

- **Les réglages du sol** (6 novembre 2026, PR 3a de la 5 ter) : dans la
  section « Planning de la semaine », un bloc « Réserve du sol » et son pli
  « Réglages du sol ». Par parcelle, la RFU du laboratoire en mm/m, la part
  de cailloux et la RFU du sol calculée pendant la saisie (62 mm/m et 18 % :
  51 mm/m), la part de référence, TEW, REW, Ze, la profondeur de sol, la
  provenance et la source ; par jardin ou abri, une valeur propre ; pour
  l'exploitation, le seuil d'arrosage (selon la culture, ou de 20 à 80 % du
  plein), les coefficients des états de surface et la part de pluie sous
  paillage plastique. Chaque enregistrement vaut à partir d'un jour et reste
  dans l'histoire. La jauge viendra ensuite.

### Ajouté (5 ter, réserve du sol : la persistance)

- **La réserve du sol en base** (6 novembre 2026, PR 2 de la 5 ter,
  migration 0025) : le sol de chaque parcelle et la valeur propre d'un
  jardin ou d'un abri, les profils racinaires (jeu commun de trente et une
  cultures, révisions de la ferme), les états de surface des planches, les
  réglages de l'exploitation, les observations du curseur et l'état du jour.
  Chaque saisie est conservée, jamais modifiée. Rien ne s'affiche encore.

### Ajouté (5 ter, réserve du sol : le domaine)

- **La jauge de la réserve du sol, calculée** (6 novembre 2026, PR 1 de la
  5 ter, sur le mandat du porteur, D-060) : la RFU du sol corrigée des
  cailloux, la profondeur racinaire par stade et la part p, le seuil selon
  la culture ou un seuil réglé par l'exploitation en % du plein (D-059), la
  jauge jour par jour d'une planche cultivée et d'une planche sans culture
  (sol nu en deux compartiments, bâches, paillage, engrais vert, enherbée),
  l'observation au curseur, l'inconnue et son redémarrage, les jours avant
  le seuil, la dose conseillée, le drainage et la moyenne du jardin. Rien
  ne s'affiche encore ; la jauge reste une information, hors besoin,
  planning et priorités.

### Ajouté (5 quater, besoin en eau par culture et par stade : la recette réelle)

- **La recette réelle de la 5 quater** (6 novembre 2026,
  `docs/recette-5-quater.md`), en lecture seule sur la ferme du porteur :
  stades, Kc et ETM de quatre séries justes à la main, affichage sans
  débordement à 390 px, puis, sur son accord, quatre gestes d'écriture
  éprouvés et défaits (paillage, options, durées, adoption). Les réponses du
  porteur aux trois choix de la PR 3e sont consignées dans le contrat.
- **La PR #243 est déployée** le 6 novembre 2026 à 12 h 48 (run
  42211436687) ; consigné ici.

### Ajouté (5 quater, besoin en eau par culture et par stade : l'écran, PR 3e)

- **Les durées propres à la ferme** (6 novembre 2026, PR 3e) : sur la page
  « Coefficients culturaux », « Régler les durées de la ferme » règle, pour
  une culture du jeu commun, les délais de levée, le début des stades en
  jours, les phases et l'abattement de la FAO, ou les jours d'un
  calendrier ; la valeur commune reste rappelée sous chaque champ, et
  « Revenir aux durées communes » rétablit le jeu commun. Les Kc ne
  changent pas ici.
- **La fiche de la série** : dans la vue « Par série », la carte d'une
  série montre, sur chacune de ses planches, le stade, le Kc et l'ETM du
  jour de ses cultures et la proposition de la planche face à son
  objectif ; un stade s'y déclare pour toute la série.
- **Les PR #241 et #242 sont déployées** le 6 novembre 2026 à 12 h 20
  (run 42207955953) ; consigné ici.

### Ajouté (5 quater, besoin en eau par culture et par stade : l'écran, PR 3c)

- **Les surcharges de Kc** (6 novembre 2026, PR 3c) : sur la page
  « Coefficients culturaux », chaque culture de référence montre la valeur
  de la ferme à côté de celle de la source, stade par stade (ou ses trois Kc
  pour la FAO), avec l'histoire des surcharges ; « Surcharger un Kc » ajoute
  une révision datée, ou revient à la valeur de la source. Rien n'est
  effacé.
- **Les réglages du calcul** : les options (lissage des passages de stade,
  ombrage) avec une phrase qui dit ce que chacune fait ; le K_abri de chaque
  jardin sous abri, 0,80 par défaut, réglable de 0,60 à 1 à partir d'un
  jour ; le paillage plastique des planches de la saison ; les filets
  d'ombrage, posés et retirés avec leurs dates. Aucune migration. Parcours
  navigateur P16 aux deux largeurs.
- **La correspondance des 78 espèces de la ferme du porteur est saisie** le
  6 novembre 2026 sur son « vas-y », selon sa table relue le jour même.
- **La PR #239 est fusionnée et déployée** le 6 novembre 2026 (`0946a61`,
  déploiement terminé à 10 h 49, run 42194501098, migration 0024 appliquée) ;
  consignée ici.

### Ajouté (5 quater, besoin en eau par culture et par stade : l'écran, PR 3d)

- **L'ETM enregistrée chaque matin** (6 novembre 2026, PR 3d) : après la
  météo et le planning, l'ETM de chaque planche est recalculée et
  enregistrée pour aujourd'hui et les sept jours d'avant, avec ce qui l'a
  produite ; la réanalyse remplace la prévision quand elle arrive. Les jours
  à venir ne s'enregistrent pas. Un échec d'une ferme est compté à part.
- **L'avertissement de l'aspersion en début de cycle** dans la fiche de la
  planche : « besoin probablement sous-estimé » quand une aspersion est
  posée sur la planche, qu'une culture est au premier stade d'une table du
  CRIIAM et que deux irrigations sont à trois jours ou moins. Le Kc ne
  change pas.
- **Corrigé : la bulle d'aide de la faisabilité ne se referme plus
  d'elle-même au téléphone.** Ouverte d'un clic ou d'un toucher, elle reste
  ouverte jusqu'à « Fermer » ou Échap ; le survol seul l'ouvre et la ferme
  comme avant.
- **La PR #241 est fusionnée** le 6 novembre 2026 (`995b1fb`) ; consignée ici.

### Ajouté (contrat des alertes météo par culture, 5 quinquies)

- **Le contrat des alertes météo par culture** (6 novembre 2026,
  `docs/weather-crop-alerts-contract.md`, D-058) : gel selon l'espèce avec
  marge et curseur de microclimat, arrêt d'arrosage avant récolte, aspersions
  de jour sous abri à reconsidérer. Rien de codé. Placement des idées Tlaloc
  inscrit dans la roadmap (D-059).

### Ajouté (5 quater, besoin en eau par culture et par stade : l'écran, PR 3b)

- **La fiche de la planche montre le besoin de la culture** (6 novembre 2026,
  PR 3b) : sous le plan, pour chaque culture de la planche choisie, le stade
  du jour, observé ou calculé, et la date du prochain changement, le Kc,
  l'ETM et ce qui les a produits ; pour la semaine, l'objectif proposé face
  à l'objectif applicable, leur écart, les jours et les cultures qui
  manquent. « Déclarer un stade », pour la planche ou toute la série, le
  jour où il est atteint. « Adopter la proposition » : recalculée par le
  serveur, pour une semaine qui n'est pas finie, elle devient l'objectif de
  la planche par une révision ordinaire qui garde son origine (migration
  additive `0024_adopted_goal_origin`), et le plan se recalcule.
- **« Objectif proposé » sous l'objectif de chaque planche** dans « Besoins
  d'irrigation », place choisie par le porteur : une information, que ni le
  besoin ni le planning ne lisent.
- **Des carottes de démonstration en place le jour même** sur V01, pour le
  parcours navigateur P15 aux deux largeurs.
- **La PR #237 est fusionnée et déployée** le 6 novembre 2026 (`030e628`,
  déploiement terminé à 09 h 56, run 42190102920) ; consignée ici.

### Ajouté (5 quater, besoin en eau par culture et par stade : l'écran, PR 3a)

- **La page « Coefficients culturaux »** (6 novembre 2026, PR 3a) : les
  tables des 32 cultures de référence de la ferme, telles qu'elle les lit
  (source, Kc stade par stade, débuts de stade par saison, durées de la
  FAO, calendriers, délais de levée, source et date du relevé), la
  correspondance des espèces de la saison, par espèce avec une exception
  possible par série et l'analogie dite, et la liste des espèces « sans
  référence Kc », qui gardent leur objectif saisi. Rien n'est deviné ni
  pré-rempli. Parcours navigateur P14 aux deux largeurs.
- **La 5 bis, alertes météo, est close** : recette réelle sur la ferme
  validée par le porteur le 6 novembre 2026.
- **La PR #236 est fusionnée et déployée** le 6 novembre 2026 (`0bb0fe1`,
  déploiement terminé à 01 h 24, run 42135652593, migration 0023 appliquée) ;
  consignée ici.

### Ajouté (5 quater, besoin en eau par culture et par stade : la persistance)

- **La base garde le besoin par culture et par stade** (6 novembre 2026,
  PR 2, migration additive `0023_crop_water_need`) : le jeu commun de
  32 cultures de référence (dix-neuf du CRIIAM Sud, treize de la FAO-56),
  avec leurs Kc, leurs dates par défaut, leurs jeux de saison, leurs délais
  de levée et leurs calendriers, l'adresse de la source et la date du relevé ;
  la version d'une ferme d'une culture commune, sans en changer les Kc, ou sa
  propre culture ; les surcharges de Kc, les stades déclarés et les K_abri,
  datés, que la base refuse de modifier ou d'effacer ; la correspondance des
  espèces par espèce et par série ; le paillage, les filets d'ombrage et les
  options ; l'ETM du jour par planche avec ce qui l'a produite, sans jamais
  écraser la dernière valeur valide par un jour bloqué. Rien n'est encore à
  l'écran ; aucune donnée de la ferme n'est écrite.
- **La PR #235 est fusionnée et déployée** le 6 novembre 2026 (`01227cd`,
  déploiement terminé à 00 h 41, run 42129119461) ; consignée ici.

### Ajouté (5 quater, besoin en eau par culture et par stade : le domaine)

- **Le calcul du besoin de chaque culture à son stade** (5 novembre 2026,
  PR 1, #235, D-054, D-057) : le stade du jour, calculé depuis la semaine
  d'implantation (escalier du CRIIAM, trapèze de la FAO, calendrier des
  cultures pluriannuelles, délais de levée, dates à rebours depuis la
  récolte, mi-récolte calée sur Ouvre ta ferme) ou déclaré par le maraîcher,
  qui recale alors la suite du calendrier ; le Kc avec ses surcharges datées
  et le coefficient d'abattement de la FAO ; l'ETM du jour, ET0 × K_abri × Kc
  × K_paillage × K_ombrage, avec l'ET0 réanalysée, estimée ou prévue, jamais
  0 quand elle manque ; la planche à plusieurs cultures, qui prend la plus
  assoiffée ; l'objectif proposé de la semaine, son écart à l'objectif
  applicable, ses alertes de cohérence et son adoption par une révision
  ordinaire de l'objectif de la planche ; l'avertissement d'aspersion en
  début de cycle ; la liste des espèces sans référence. Rien n'est encore
  branché : ni base, ni écran.
- **Deux réponses du porteur en cours de code** (D-057) : un stade déclaré
  recale le calendrier au lieu de durer jusqu'à la déclaration suivante ; la
  culture reste sur sa planche jusqu'à la plus tardive de ses semaines de
  récolte, réalisées ou attendues, pour la 5 quater et la jauge de la 5 ter.
- **Les PR #228 et #229 sont fusionnées et déployées** : #228 le 1er novembre
  2026 (`88f348d`, déploiement terminé à 22 h 44, run 41352670417), #229 le
  3 novembre 2026 (`eabea44`, déploiement terminé à 12 h 42, run
  41628297795) ; consignées ici.

### Modifié (5 ter : profondeurs racinaires par stade)

- **Le contrat de la réserve du sol passe à une profondeur par stade**
  (3 novembre 2026, D-056) : règle de construction à vérifier à la tarière à la
  place de la moitié au premier stade, tomate 0,65 m et courgette 0,50 m
  remises à leur place, melon et asperge plafonnés à 0,60 m, plafond de sol
  facultatif par parcelle, quarante et un scénarios. Rien de codé.

### Modifié (gouvernance : Fable interdit)

- **Le modèle Fable est interdit** (1er novembre 2026, D-055) : la roadmap, la
  grille et les contrats à venir passent de Fable 5.1 à Opus 5.5 · Max,
  quel que soit l'effort d'avant ; règle ajoutée aux interdits d'`AGENTS.md`.
- **La PR #227 est déployée** (`831c052`, 31 octobre 2026, 15 h 52, run
  41211363412) ; consignée ici.

### Ajouté (5 bis, alertes météo : l'écran)

- **L'encart « Alertes météo »** (31 octobre 2026, PR 3) : sous la semaine
  de la météo, les critères de l'exploitation se règlent, s'activent, se
  modifient et se suppriment ; un seuil refusé dit pourquoi ; l'historique
  montre chaque alerte, sa valeur prévue et le résultat de l'envoi ; un
  rappel dit quels appareils reçoivent les alertes. La semaine montre les
  températures minimale et maximale prévues ; le clic sur une alerte ouvre
  la semaine du jour visé.
- **La PR #226 est fusionnée et déployée** le 31 octobre 2026, fusion à
  15 h 18 (`6f66c57`), déploiement terminé à 15 h 25, migration
  0022 appliquée.

### Ajouté (5 bis, alertes météo : l'enregistrement et l'envoi)

- **Les alertes météo s'évaluent et partent** (31 octobre 2026, PR 2b) :
  températures prévues conservées (migration 0022), critères de
  l'exploitation et leurs versions, une alerte au plus par version et par
  jour visé, évaluation après la synchronisation de 06 h 15 et après chaque
  actualisation, envoi immédiat vers les appareils abonnés, résultat
  enregistré. Sans écran encore, aucun critère ne peut être saisi.
- **La PR #225 est fusionnée et déployée** le 31 octobre 2026, fusion à
  14 h 54 (`35f60cc`), déploiement terminé à 15 h 04, Worker Push
  redéployé.

### Ajouté (5 bis, alertes météo : l'envoi immédiat du Worker Web Push)

- **Route d'envoi immédiat** du Worker Web Push (31 octobre 2026, PR 2a) :
  la notification part tout de suite vers les appareils de l'exploitation,
  avec les mêmes contrôles et la même déduplication que les alarmes ; le
  Worker dit à l'application si elle est envoyée, sans appareil abonné, en
  nouvelle tentative ou en échec. L'application ne l'appelle pas encore.
- **La PR #224 est fusionnée et déployée** le 31 octobre 2026, fusion à
  14 h 35 (`81da489`), déploiement terminé à 14 h 44.

### Ajouté (5 bis, alertes météo paramétrables : le domaine)

- **Le calcul des alertes météo** (31 octobre 2026, PR 1 sur 3, D-050) :
  validation d'un critère de l'exploitation (température minimale,
  température maximale ou pluie prévues, en dessous ou au-dessus d'un seuil,
  sur 1 à 7 jours), évaluation stricte sur la prévision la plus récente,
  jamais sur une valeur absente, une seule alerte par critère et par jour
  visé, texte de la notification. Rien n'est encore enregistré, envoyé ni
  affiché.
- **La PR #223 est fusionnée et déployée** le 31 octobre 2026, fusion à
  14 h 06 (`1009e54`), déploiement terminé à 14 h 15, documents seuls.

### Documenté (règles d'économie de jetons)

- **Les règles d'économie du porteur sont inscrites dans `AGENTS.md`**
  (31 octobre 2026) : grille Sonnet 5.5 · Moyen pour le travail sans code,
  pas de PR pour un déploiement seul, surveillance au plus toutes les cinq
  minutes, pas de fil d'avance à vide, reprise allégée par la section « Où on
  en est » (nouvelle, en tête de `docs/ETAT_DU_PROJET.md`), questions une par
  message numérotées « n sur N ». Aucun code.

### Documenté (5 quater, la relecture du besoin par culture et par stade)

- **Contrat du besoin en eau par culture et par stade relu et tranché par le
  porteur** le 31 octobre 2026 (D-054), avec une recherche documentaire :
  dates de stade par défaut des dix-sept cultures du CRIIAM, mi-récolte calée
  sur les semaines de récolte d'OTF, ail, oignon et fin de pomme de terre à
  rebours, délais de levée par culture, un jeu de dates par saison,
  calendriers fixes de l'artichaut, de l'asperge et du fraisier restés sur
  leur planche après la récolte (exception à D-022), correspondance des
  79 espèces de la ferme avec exceptions par série, K_abri 0,8, paillage
  × 0,9, lissage désactivé, ombrage codé désactivé ; mode automatique non
  retenu ; contrat corrigé (tomate, potiron, ligne « Crucifères ») ; sept
  scénarios ajoutés. Aucun code.
- **La PR #221 est fusionnée et déployée** le 31 octobre 2026, fusion à
  12 h 43, déploiement terminé à 12 h 52, documents seuls.
- **La PR #222 est fusionnée et déployée** le 31 octobre 2026, fusion à
  13 h 49 (`332c645`), déploiement terminé à 13 h 56, documents seuls.

### Clos (3.7, suivi d'exécution et replanification)

- **La 3.7 est close par le porteur** le 31 octobre 2026 à 12 h 23 : contrat
  validé le 30 octobre (D-051), huit PR de code fusionnées et déployées le 31
  octobre (#208 à #215), recette réelle sur la ferme le jour même
  (`docs/recette-3.7.md`), quatre corrections fusionnées et déployées sur son
  mot (#220) et vérifiées sur la ferme, les 3 mm de pluie fabriqués par la
  recette retirés par « Retirer la mesure » ; le point 31 (créneau refusé
  reproposé) est fermé.
- **La PR #219 est fusionnée et déployée** le 31 octobre 2026 à 12 h 32,
  l'application seule, aucune migration.

### Documenté (5 ter, la réserve du sol relue et validée)

- **Le contrat de la réserve du sol est relu et validé par le porteur**
  (31 octobre 2026, D-053), avant tout code : seuils sur une part de
  référence de 2/3 (CRIIAM), p de la FAO-56 pour toutes les cultures qui en
  ont une, profondeurs racinaires de trente cultures de référence (ITAB et
  recherche documentaire du jour), abri sans analyse à la RFU de sa parcelle
  sans mention, curseur de parcelle limité au plein champ avec quatre
  repères, jauge continue sur une planche sans culture par le modèle de sol
  nu de la FAO-56 et six états de surface réglables, jauge inconnue
  seulement au départ et sur un trou de données, aucun conseil d'arrosage
  avant plantation. Trente-sept scénarios recalculés. Aucun code ; le domaine
  de la 5 ter se code après celui de la 5 quater.
- **La PR #220 est fusionnée et déployée** le 31 octobre 2026 à 12 h 14,
  l'application seule, aucune migration.

### Corrigé (3.7, les quatre défauts de la recette réelle)

- **La carte d'un arrosage validé lit l'état réel de l'irrigation** :
  « Annulée », « Réalisée » ou « Partielle » selon ce qu'elle est devenue ;
  une annulée ne compte plus parmi les validées ni dans leur volume. Le plan
  relistait les cartes validées sans lire l'irrigation, d'où les cartes
  « Validée » fantômes et les doublons après une annulation (défaut
  antérieur à la 3.7, révélé par la recette du 31 octobre 2026). Aucune
  migration.
- **Le message « Suggestion appliquée » reste lisible** dans le bandeau de
  la section, que la suggestion s'en aille ou non avec le recalcul.
- **« Proposition déplacée » se juge à la minute**, comme l'écran montre les
  heures : une durée qui change de quelques secondes avec la dose n'est plus
  un déplacement.
- **« Retirer la mesure »** dans « Pluie mesurée » : la mesure manuelle du
  jour s'efface et le plan se réanalyse comme après une pluie saisie.
- **La PR #218 est fusionnée et déployée** le 31 octobre 2026 à 11 h 33,
  l'application seule, aucune migration.

### Documenté (3.7, la recette réelle)

- **Recette réelle de la 3.7 faite sur la ferme** le 31 octobre 2026, de
  10 h 44 à 10 h 51, dans le Chrome du porteur, sur son « vas-y »
  (`docs/recette-3.7.md`) : recalculs sur événement, en-tête, pli « Ce qui a
  changé », refus lu par le moteur (point 31 prouvé sur le site), suggestions
  « Annuler » sous une limite posée après coup, « Garder » et « Appliquer »
  conformes au contrat ; trois défauts et une trace de données au jugement
  du porteur — cartes « Validée » fantômes après annulation, message
  « Suggestion appliquée » fugace, « déplacée » à l'identique à la minute,
  pluie saisie qui ne se retire pas —, corrections proposées sur son mot.
- **Les PR #216 et #217 sont fusionnées et déployées** le 31 octobre 2026,
  #216 à 07 h 00 et #217 à 11 h 06, l'application seule, aucune migration.

### Sécurité (dépendances de développement, 25 alertes Dependabot)

- **Vingt-cinq alertes Dependabot fermées** (31 octobre 2026), toutes sur les
  outils de développement, aucune sur le site en ligne : `undici` 7.30.1 et
  `sharp` 0.35.5 (miniflare), `fast-uri` 3.1.9 (webpack), `brace-expansion`
  1.1.21 et 5.0.12, `js-yaml` 4.3.2 et `zod` 4.6.7 (eslint), `fflate` 0.7.5
  (vinext), épinglés dans `pnpm-workspace.yaml` avec leur raison et leur
  condition de retrait.

### Documenté (3.9, les scénarios de pénurie, la recette et la publication)

- **Contrat des scénarios de pénurie, de la recette et de la publication de
  la tranche 3** (30 octobre 2026, D-052), validé par le porteur le jour
  même : vingt-huit scénarios chiffrés, trois jeux de données, non-régression
  complète, revue de sécurité des frontières et de l'isolation, recette
  finale en pénurie fabriquée sur la ferme, publication en `v0.2.0` ; quatre
  règles précisées — arbitrage validé en parts réservées, budget net du
  manque sous le minimum avec la part placée affichée, report sans bascule,
  part sous la dose minimale placée le dimanche — à coder en PR `fix/` quand
  la 3.9 s'ouvre. Aucun code.
- **La PR #215 est fusionnée et déployée** le 31 octobre 2026 à 06 h 39,
  l'application seule, aucune migration.

### Ajouté (3.7, l'écran du suivi et le parcours P12)

- **L'écran du suivi** (31 octobre 2026, cinquième et dernière PR de code
  de la 3.7, « L'écran » du contrat), dans la section « Planning de la
  semaine », sans réorganisation : le pli « Ce qui a changé depuis le calcul
  du … », une lecture ; les suggestions sur les arrosages validés, chacune
  avec sa raison et ses deux boutons — « Appliquer » passe par l'annulation
  ordinaire ou la modification en mode durée de l'irrigation planifiée,
  « Garder » la fait taire jusqu'à un autre calcul — ; le signal « En
  retard » ou « Non faite » sur la carte de l'irrigation planifiée dans « À
  venir ou à terminer », avec le bouton « Recalculer le plan ». Lisible sur
  ordinateur et à 390 px.
- **Le parcours P12**, aux deux largeurs : une pluie saisie et le plan
  recalculé seul, un refus et le besoin replacé, une limite journalière
  posée après coup et la suggestion « Annuler » appliquée, la remise en
  état ; 28 parcours.

### Ajouté (3.7, les notifications)

- **Deux notifications, et deux seulement** (31 octobre 2026, PR 4b de la
  3.7, règles 21 à 24 du contrat), par l'alarme existante du Worker Push,
  inchangé : l'arrosage en retard — une irrigation planifiée reçoit, à sa
  création ou à sa modification, une alarme pour son début plus R14, que le
  démarrage efface et que l'annulation ou la modification annule d'abord —
  et les suggestions du calcul du matin — après le calcul du matin
  seulement, quand une suggestion non gardée porte sur un arrosage des
  prochaines 24 heures, une par calcul, jamais après un geste à l'écran. Les
  irrigations planifiées avant n'ont pas d'alarme de retard ; un changement
  de R14 ne touche que les suivantes.
- **La PR #214 est fusionnée et déployée** le 31 octobre 2026 à 06 h 17,
  l'application seule, la migration 0021 appliquée.

### Ajouté (3.7, le retard et le réglage R14)

- **Le retard d'une irrigation planifiée** (31 octobre 2026, PR 4a de la
  3.7, règles 18 à 20 du contrat) : non démarrée une tolérance après son
  heure, elle est « en retard » ; tout son créneau passé sans démarrage,
  « non faite ». La tolérance est le réglage R14, 30 minutes au départ, dans
  le pli « Réglages du planning », avec son historique. Le signal se calcule
  à la lecture ; son eau ne change pas ; le logiciel n'annule jamais. Le
  libellé sur la carte et les notifications viennent avec les PR suivantes.
- **La PR #213 est fusionnée et déployée** le 31 octobre 2026 à 03 h 38,
  l'application seule, aucune migration.

### Ajouté (3.7, « Ce qui a changé »)

- **Ce qui a changé depuis le calcul précédent** (31 octobre 2026, PR 3 bis
  de la 3.7, règle 25 du contrat) : après chaque calcul, le service compare
  le nouveau plan au dernier enregistré de la semaine et garde la lecture
  dans le résumé du calcul : les propositions apparues, retirées, déplacées
  ou de dose changée, les suggestions nouvelles sur les arrosages validés,
  les planches entrées dans « Non placé » ou sorties, le manque d'eau avant
  et après. Rien au premier calcul de la semaine ; les calculs antérieurs se
  relisent sans réécriture. Aucune migration. Le pli à l'écran vient avec la
  cinquième PR.
- **La PR #212 est fusionnée et déployée** le 31 octobre 2026 à 03 h 20,
  l'application seule, aucune migration.

### Ajouté (3.7, les suggestions sur les arrosages validés)

- **Le moteur suggère sur les arrosages validés** (31 octobre 2026,
  troisième PR de code de la 3.7, règles 11 à 17 du contrat) : à chaque
  calcul, pour chaque arrosage validé encore à venir, la dose utile est
  recalculée avec les règles du jour ; sous la dose minimale, « Annuler » ;
  quand la dose prévue dépasse la dose utile d'au moins la dose minimale,
  « Réduire à X mm » ; jamais allongé. Un matériel retiré ou reposé ailleurs
  fait suggérer « Annuler » avec la date du retrait ; une limite journalière
  posée après coup signale le jour et fait suggérer de réduire jusqu'à la
  limite, priorité basse d'abord. « Garder » tait une suggestion jusqu'à ce
  qu'un calcul en fasse une autre. Les suggestions sont enregistrées avec le
  calcul ; l'écran qui les montre vient avec la cinquième PR.
- **La PR #211 est fusionnée et déployée** le 31 octobre 2026 à 03 h 01,
  l'application seule, la migration 0020 appliquée.

### Ajouté (3.7, le recalcul sur événement)

- **Le plan se recalcule de lui-même après chaque événement** (31 octobre
  2026, deuxième PR de code de la 3.7, règles 4 à 10 du contrat) :
  irrigation planifiée, modifiée, démarrée, saisie après coup, terminée,
  partielle, reliquat annulé, annulée ; pluie saisie au pluviomètre ; niveau
  de réserve observé, débit appliqué ; limite journalière, objectif, seuil,
  priorité ou besoin à la main, arbitrage ; matériel posé, réglage changé,
  retiré ; proposition refusée ou validée. Le calcul se fait après la
  réponse ; l'en-tête nomme l'événement (« calculé le … (après la pluie
  saisie au pluviomètre) ») ; une proposition reproduite à l'identique garde
  son identité, une carte restée ouverte se valide encore ; un échec laisse
  l'événement enregistré et l'écran dit « Plan antérieur à : …, le … — le
  recalcul a échoué, recalculez. ». Un événement d'une autre semaine, la
  pause ou la reprise d'un minuteur, un réglage du planning et la météo ne
  font pas recalculer.
- **La PR #210 est fusionnée et déployée** le 31 octobre 2026 à 02 h 34,
  l'application seule, la migration 0019 appliquée.

### Données

- Migration `0019_plan_events` : `irrigation_plan_calculations.trigger_event`
  et la table `irrigation_plan_events` (46 tables).
- Migration `0020_plan_suggestion_keeps` : la table
  `irrigation_plan_suggestion_keeps` (47 tables).
- Migration `0021_late_alarm` : la colonne `late_alarm_due_at` sur
  `irrigation_event_equipment` (47 tables).

### Ajouté (3.7, la lecture des refus, D-030)

- **Le moteur de planning lit les refus de la semaine** (31 octobre 2026,
  première PR de code de la 3.7, point ouvert 31) : un créneau refusé — ce
  matériel, à ces heures — n'est plus proposé de la semaine, même en
  partie ; le besoin se place ailleurs ou se lit « non placé » avec le motif
  « créneau refusé » ; la carte dit « après un créneau refusé », « ce qui
  tient avant un créneau refusé », « créneau refusé évité ». Le cas de la
  rampe du tunnel 4 du 5 octobre 2026 est rejoué en test. Aucune migration,
  aucun changement d'écran.
- **La PR #209 est fusionnée et déployée** le 31 octobre 2026 à 02 h 17,
  l'application seule.

### Modifié (3.7, préparation du code)

- **La description de la contrainte limitante sort du moteur de planning**
  (31 octobre 2026, préparation de la première PR de code de la 3.7) : le
  type `PumpConstraint` et la fonction `describeLimitingConstraint` passent
  de `lib/domain/planning/engine.ts` à `lib/domain/planning/justification.ts`,
  sans changement ; le moteur comptait 593 lignes de code pour une limite de
  600, la lecture des refus le porterait à 607 ; il en compte 556. Aucune
  règle ne change, aucun test n'est modifié.
- **La PR #208 est fusionnée et déployée** le 31 octobre 2026 à 02 h 02,
  l'application seule.

### Documenté (3.7, le suivi d'exécution et la replanification)

- **Contrat du suivi d'exécution et de la replanification** (30 octobre
  2026, D-051), validé par le porteur le jour même : le moteur lit les refus
  de la semaine (D-030, point 31) ; le plan se recalcule de lui-même après
  chaque événement réel ; sur un arrosage validé, il suggère « Réduire » ou
  « Annuler » au seuil de la dose minimale, sans jamais agir seul ; un
  arrosage non démarré 30 minutes après son heure est « en retard »
  (réglage R14) ; deux notifications seulement. Aucun code.
- **La PR #207 est fusionnée et déployée** le 31 octobre 2026 à 01 h 29,
  l'application seule.

### Modifié (dépendance de développement, Dependabot #185)

- **`wrangler` 4.154.0** (30 octobre 2026), à la racine et dans les deux
  Workers, en une PR qui remplace la PR Dependabot #185 ; aucune dépendance
  d'exécution touchée.
- **La PR #206 est fusionnée et déployée** le 30 octobre 2026 à 23 h 11,
  l'application et les deux Workers.
- **La PR #205 est fusionnée et déployée** le 30 octobre 2026 à 22 h 53,
  l'application seule.

### Documenté (5 bis, les alertes météo)

- **Contrat des alertes météo paramétrables** (30 octobre 2026, D-050),
  validé par le porteur le jour même : critères de l'exploitation sur la
  température minimale, la température maximale et la pluie prévues, horizon
  de 1 à 7 jours, une alerte par critère et par jour visé, information
  seulement. Aucun code.
- **La PR #202 est fusionnée et déployée** le 30 octobre 2026 à 22 h 37,
  l'application seule.

### Documenté (5 ter et 5 quater, la jauge de la réserve du sol par l'ETM)

- **La jauge de la réserve du sol suit l'ETM de la culture** (30 octobre
  2026, D-047) : sur le complément « jauge RFU » du porteur, la consommation
  devient l'ETM de la 5 quater au lieu de l'ET0 × coefficient ; RFU du sol
  corrigée des cailloux (51 mm/m pour la ferme) ; profondeurs racinaires de
  départ ; seuil de déclenchement par culture, formule du complément
  corrigée ; jours avant le seuil, dose conseillée et drainage affichés, sans
  toucher aux priorités. La 5 quater passe en 18 de l'ordre, la 5 ter en 19.
  Aucun code.
- **La PR #204 est fusionnée et déployée** le 30 octobre 2026 à 22 h 21,
  l'application seule.

### Clos (sous-tranche 2.11) et modifié (façon de travailler, D-049)

- **La 2.11, pose datée et stockage du matériel, est close** par le porteur le
  30 octobre 2026.
- **Le modèle et l'effort de chaque conversation suivent la roadmap**
  (D-049) ; tout écart se demande au porteur avant. Chaque conversation
  surveille elle-même la fin des contrôles de ses PR.
- **La PR #203 est fusionnée et déployée** le 30 octobre 2026 à 22 h 05,
  l'application et les deux Workers.

### Modifié (dépendances de développement, lot Dependabot #184 et #185)

- **`@cloudflare/workers-types` 5.20261027.1 et `wrangler` 4.153.0** (30
  octobre 2026), à la racine et dans les deux Workers pour `wrangler`, en une
  seule PR qui remplace les PR Dependabot #184 et #185 ; aucune dépendance
  d'exécution touchée.
- **La PR #201 est fusionnée et déployée** le 30 octobre 2026 à 21 h 13,
  l'application seule.

### Fermé (points ouverts 45, 46 et 47)

- **Points ouverts 45, 46 et 47 fermés** par le porteur le 30 octobre 2026,
  leurs corrections constatées sur le site le jour même.
- **La PR #200 est fusionnée et déployée** le 30 octobre 2026 à 21 h 00,
  l'application seule.

### Modifié (façon de travailler, D-048)

- **L'assistant fusionne désormais les PR lui-même** (30 octobre 2026, D-048),
  sur la décision du porteur : une à la fois, dans l'ordre, seulement prêtes,
  la suivante après le déploiement vérifié de la précédente ; jamais une PR
  Dependabot seule ni une PR qui attend une décision du porteur. `AGENTS.md`
  et `docs/publication.md` mis à jour.
- **La PR #199 est fusionnée et déployée** le 30 octobre 2026 à 20 h 12,
  l'application seule.

### Vérifié (points ouverts 45, 46 et 47, sur le site)

- **Les corrections des points ouverts 45, 46 et 47 tiennent sur le site** (30
  octobre 2026) : dans le Chrome du porteur, le volume estimé dit « Inconnu »
  sans date lisible, « Planifier l'irrigation » est grisé sans date, et un
  retrait daté de la minute qui vient est accepté et enregistré à l'heure du
  serveur ; rien enregistré sur les vrais matériels (`docs/recette-2.11.md`).
- **La PR #198 est fusionnée et déployée** le 30 octobre 2026 à 15 h 46.

### Documenté (5 ter, la RFU en mm par mètre ; points ouverts 42 et 43)

- **La RFU s'exprime en mm par mètre de sol** (30 octobre 2026, D-046) : le
  contrat de la réserve du sol la saisit en mm/m ; la profondeur de calcul et
  son statut « hypothèse » disparaissent. La ferme se saisira 62 mm/m, valeur
  confirmée par le laboratoire. Aucun code.
- **Points ouverts 42 et 43 fermés** par le porteur le 30 octobre 2026, le 43
  après le retrait réel de son goutte-à-goutte par l'écran.

### Corrigé (point ouvert 46)

- **Le bouton « Planifier l'irrigation » reste grisé tant que la date de
  début est vide ou incomplète** (30 octobre 2026), comme celui de « Déjà
  réalisée » ; avant, il restait actif et le serveur refusait la
  planification après le clic.
- **La PR #197 est fusionnée et déployée** le 30 octobre 2026 à 15 h 24,
  l'application seule.

### Corrigé (point ouvert 47)

- **Une date de pose ou de retrait saisie « maintenant » n'est plus refusée
  comme future** (30 octobre 2026) : quand l'horloge de l'ordinateur ou du
  téléphone avance de quelques secondes sur celle du serveur, une date en
  avance de deux minutes au plus vaut maintenant et s'enregistre à l'heure du
  serveur ; au-delà, le refus tient.
- **La PR #196 est fusionnée et déployée** le 30 octobre 2026 à 15 h 17,
  l'application seule.

### Corrigé (point ouvert 45)

- **Le volume estimé d'une irrigation déjà réalisée n'affiche plus « 0 L »
  quand ses dates ne se lisent pas** (30 octobre 2026) : début ou fin vide,
  incomplet, ou fin avant le début, l'aperçu écrit « Inconnu — vérifiez le
  début et la fin » et l'apport par planche « inconnu » (D-003).
- **La PR #195 est fusionnée et déployée** le 30 octobre 2026 à 14 h 56,
  l'application seule, les deux Workers n'ayant pas changé.

### Modifié (dépendances)

- **Lot de dépendances du 30 octobre 2026** (cinq PR Dependabot, #182 à #186,
  reprises en une seule) : `react`, `react-dom` et `react-server-dom-webpack`
  19.3.1, montés ensemble ; `@types/node` 22.20.5, `@cloudflare/workers-types`
  5.20261025.1, `wrangler` 4.144.0, `vite` 8.3.5. Aucun code du logiciel ne
  change.
- **La PR #193 est fusionnée et déployée** le 30 octobre 2026 à 13 h 54.
- **La PR #194 est fusionnée et déployée** le 30 octobre 2026 à 14 h 10,
  l'application et les deux Workers.

### Vérifié (point ouvert 44, sur le site)

- **La correction du point ouvert 44 tient sur le site** (30 octobre 2026) :
  dans le Chrome du porteur, date de début vidée ou tapée chiffre par chiffre,
  dans « Déjà réalisée » comme dans « Planifier », la page d'irrigation reste
  là ; rien enregistré (`docs/recette-2.11.md`). La PR #190 est fusionnée et
  déployée le 30 octobre 2026 à 13 h 01.
- **Deux écarts mineurs relevés au passage**, sans rien d'enregistré à tort :
  le volume estimé à 0 L quand la date de début ne se lit pas (point ouvert
  45) et le bouton « Planifier l'irrigation » actif sans date, le serveur
  refusant au clic (point ouvert 46).
- **Point ouvert 44 fermé** par le porteur le 30 octobre 2026. La PR #192, qui
  consigne le constat, est fusionnée et déployée le même jour à 13 h 40.

### Documenté (5 quater, besoin en eau par culture et par stade)

- **Contrat du besoin en eau par culture et par stade** (30 octobre 2026) :
  à la demande du porteur, son document de travail (références du CRIIAM Sud
  et de la FAO-56) devient le contrat `docs/crop-water-need-contract.md`, relu
  contre le dépôt, avec quatorze scénarios chiffrés ; ETM = ET0 × Kc selon la
  culture et son stade, objectif hebdomadaire proposé à côté de l'objectif
  saisi, adopté à la main. Extension 5 quater placée en 20 de l'ordre,
  décision D-045, une règle invariante ajoutée à `AGENTS.md`. Aucun code ; à
  relire par le porteur avant tout code.

### Corrigé (point ouvert 44)

- **Une date de début vide ou incomplète ne ferme plus la page
  d'irrigation** (30 octobre 2026) : dans « Déjà réalisée » ou « Planifier »,
  vider la date de début, ou la taper au clavier chiffre par chiffre, fermait
  toute la page ; l'aperçu de faisabilité part désormais de maintenant tant
  que la date ne se lit pas. Défaut ancien, trouvé par la recette de la 2.11.

### Vérifié (2.11, recette réelle sur la ferme)

- **La pose datée tient sur la ferme** (30 octobre 2026) : recette réelle
  dans le Chrome du porteur, sur un matériel d'essai supprimé à la fin,
  treize vérifications conformes sur ordinateur et à 390 px
  (`docs/recette-2.11.md`). Le réglage « minimal » des treize rampes était
  déjà celui de la rampe bloc 1.
- **Un défaut ancien trouvé** : une date de début incomplète ou vide, dans
  « Déjà réalisée » ou « Planifier », ferme la page d'irrigation ; rien n'est
  enregistré (point ouvert 44).
- **La PR #188 est fusionnée et déployée** le 29 octobre 2026 à 22 h 48.

### Ajouté (2.11, l'écran de la pose datée)

- **La carte d'un matériel dit s'il est posé ou stocké, et depuis quand**
  (29 octobre 2026, PR 3b de la 2.11) : « Posé sur … depuis le … »,
  « Stocké depuis le … » ou « Jamais posé cette saison », avec le pli
  « Historique des poses ». Le compteur de l'inventaire distingue posés et
  stockés.
- **Retirer, c'est stocker, à la date choisie** : « Retirer (stocker) », sur
  la carte comme dans la barre de placement, ouvre une confirmation avec la
  date du retrait, maintenant par défaut, reportable dans le passé ; un refus
  s'y explique. La pose, la repose et le déplacement se datent de même dans
  la barre de placement. « Reposer » rouvre l'éditeur sur la dernière pose.
- **Un matériel stocké n'est plus proposé à l'irrigation** : il est listé
  « stocké », avec « Reposer » ; une irrigation planifiée sur lui reste
  affichée, signalée, et ne démarre pas.
- **Une irrigation saisie après coup prend la pose de son heure de début**
  (règle 12) : le matériel posé à cette heure, même retiré depuis ; refus
  expliqué s'il était stocké, ou si l'irrigation finit après son retrait.
- **La PR #187 est fusionnée et déployée** le 29 octobre 2026 à 22 h 17.

### Ajouté (2.11, ce que voient les calculs)

- **Une proposition dont le matériel a été rangé se refuse en s'expliquant**
  (29 octobre 2026, PR 3a de la 2.11) : la validation d'une proposition du
  planning dont le matériel a été retiré, ou reposé, depuis le calcul est
  refusée avec un message qui nomme le matériel, la date du retrait, l'heure
  du calcul et dit de recalculer (règle 14) ; valider la journée valide les
  autres propositions et donne ce motif sur la carte de celle-ci.
- **Une irrigation planifiée qui ne peut pas démarrer ne compte plus**
  (D-044, décision du porteur du 29 octobre 2026) : tant que son matériel est
  stocké, ou reposé ailleurs, elle reste affichée mais n'entre plus dans les
  besoins, la faisabilité, le planning, les réserves, la limite journalière
  ni la pompe ; reposé au même endroit, elle compte de nouveau.
- **La PR #181 est fusionnée et déployée** le 27 octobre 2026 à 21 h 33,
  migration 0018 appliquée.

### Ajouté (2.11, enregistrement de la pose datée)

- **Un matériel retiré est stocké, même s'il a déjà arrosé** (27 octobre
  2026, PR 2 sur 3 de la 2.11) : migration 0018, la pose courante gagne une
  date de pose et une date de retrait, et chaque pose fermée est copiée dans
  un registre en ajout seul (`irrigation_equipment_placement_history`).
  « Retirer la position » ferme la pose au lieu de la supprimer ; il n'est
  plus refusé après une irrigation (point ouvert 43), mais l'est pendant une
  irrigation en cours ou avant la fin de la dernière. Déplacer ferme la pose
  et en ouvre une ; un matériel stocké n'est plus vu par les besoins, la
  faisabilité, le planning ni la saisie d'une irrigation. Une irrigation
  planifiée sur un matériel retiré reste à sa place mais ne démarre pas tant
  qu'il est stocké, ni s'il est reposé ailleurs (règle 13). Dates à
  « maintenant » tant que l'écran ne les propose pas (PR 3).
- **Une irrigation en cours se reconnaît à son minuteur** : la règle de la
  PR 1 ne voyait pas une irrigation démarrée depuis une irrigation planifiée.
- **La PR #180 est fusionnée et déployée** le 27 octobre 2026.

### Ajouté (2.11, domaine de la pose datée)

- **Les règles de la pose datée sont dans le domaine** (27 octobre 2026, PR 1
  sur 3 de la 2.11) : `lib/domain/equipment-placement-periods.ts`, treize
  tests tirés des scénarios du contrat (« quatorze » écrit par erreur à
  l'ouverture, corrigé par la PR 2). Rien ne change encore à l'écran ni
  dans la base.
- **La PR #179 est fusionnée et déployée** le 27 octobre 2026.

### Ajouté (cadrage de la pose datée)

- **La pose datée et le stockage du matériel sont cadrés** (27 octobre 2026, à
  la demande du porteur, sans code) : contrat
  `docs/equipment-placement-periods-contract.md`, sous-tranche 2.11 placée
  avant la 3.7, décision D-043. Un matériel se pose, se retire et reste
  stocké, se repose ailleurs, avec des dates ; rien n'est effacé ; les calculs
  ne comptent que le matériel posé. Point ouvert 43 : « Retirer la position »
  est aujourd'hui refusé dès qu'un matériel a arrosé.
- **La PR #178 est fusionnée et déployée** le 27 octobre 2026, après une
  relance du job « Parcours navigateur » arrêté par un miroir Ubuntu lent.

### Modifié (dépendances)

- **Lot de dépendances du 27 octobre 2026** (six PR Dependabot reprises en une
  seule, fusionnée par l'assistant sur mandat du porteur, D-042) : `next` et
  `eslint-config-next` 16.4.3, `vite` 8.3.3, `knip` 6.43.0,
  `@vitejs/plugin-rsc` 0.5.38, `@playwright/test` 1.64.1. Aucun code du
  logiciel ne change.
- **La PR #176 est fusionnée et déployée** le 27 octobre 2026.

### Ajouté (cadrage de la réserve du sol)

- **La réserve du sol (RFU) est cadrée** (27 octobre 2026, à la demande du
  porteur, sans code) : contrat `docs/soil-reserve-contract.md`, extension
  5 ter de la roadmap, décision D-041. La RFU des analyses de sol se saisit
  par parcelle avec sa profondeur de calcul ; une jauge par jardin, réglée
  par l'observation du maraîcher, suit la pluie, l'irrigation et l'ET0 ; elle
  reste une information, hors besoin et planning. Point ouvert 42 : la
  profondeur de calcul de l'analyse de la ferme, à confirmer auprès du
  laboratoire.
- **La PR #169 est fusionnée et déployée** le 10 octobre 2026.
- **`@vitejs/plugin-react` 6.1.1 → 6.1.2** (PR #170 de Dependabot,
  dépendance de développement), fusionnée et déployée le 27 octobre 2026.

### Corrigé (journal de l'état)

- **Deux heures du journal du 10 octobre 2026 corrigées** dans
  `docs/ETAT_DU_PROJET.md` : 14 h 20 devient 14 h 10 et 14 h 50 devient
  14 h 30, d'après l'heure des commits ; elles avaient été écrites de mémoire
  au lieu d'être converties depuis l'UTC. PR #168, de registres seule,
  fusionnée et déployée le 10 octobre 2026.
- **Modèle de la section 5 bis de la roadmap à jour** (10 octobre 2026, à la
  reprise sur un nouveau compte) : « Opus 5 · Élevé » devient « Opus 5.5 ·
  Élevé », comme les autres lignes à venir ; oubli de la PR #166. PR de
  registres seule.
- **Consigne du porteur ajoutée à `AGENTS.md`** (10 octobre 2026) :
  l'assistant suit chaque PR qu'il ouvre jusqu'à sa fusion — CI,
  commentaires, conflits —, sans jamais fusionner lui-même.

### Ajouté (consignes du porteur)

- **Les consignes du porteur et les notes techniques sont dans le dépôt** (10
  octobre 2026, à sa demande, avant l'arrêt du développement sur ce compte) :
  section « Consignes du porteur » dans `AGENTS.md`, pièges du poste et des
  outils avec leur remède dans `docs/notes-techniques.md`. Elles n'existaient
  que dans les notes de travail de l'assistant, sur un seul poste. PR #167, de
  documentation seule, fusionnée et déployée le 10 octobre 2026.

### Modifié (roadmap)

- **Noms des modèles mis à jour** (10 octobre 2026, à la demande du porteur) :
  Opus 5.5 et Sonnet 5.5 remplacent Opus 5 et Sonnet 5 dans la légende, la
  grille et les lignes à venir de `docs/ROADMAP.md` ; les lignes terminées
  gardent le modèle employé. PR #166, de registres seule, fusionnée et
  déployée le 10 octobre 2026.

### Vérifié (recette de la note du manque d'eau, clôture de la 3.5)

- **La note du manque d'eau vérifiée sur le site déployé, la 3.5 close**
  (point ouvert 41, 10 octobre 2026, par l'assistant dans le Chrome du
  porteur, le constat à l'assistant et le jugement au porteur ; sixième
  recette de `docs/recette-planning.md`) : PR #164 fusionnée à 13 h 15 et
  déployée à 13 h 21 ; la pénurie de T2 du matin refaite à l'identique, forage
  indisponible et minimum de sécurité à 20 m³, 5,00 m³ mobilisables : mêmes
  quatre créneaux de 5,6 mm pour 4,998 m³, même réserve à 20,002 m³ au plus
  bas, même manque de 12,92 m³, même part de 28 %, et aucune note sous les
  cartes là où la version du matin écrivait « l'écart tient à 0,002 m³ de
  besoin couverts par une eau comptée sur une surface plus petite que celle de
  leur propre matériel » ; données remises en état par l'écran, plan du matin
  retrouvé, deux recalculs en 1,5 s. Le porteur tranche le jour même : points
  4, 36 et 41 fermés, point 34 laissé en veille, non bloquant, à rouvrir à la
  première occurrence, **sous-tranche 3.5 close**. Restent ouverts le point
  31, au moteur de la 3.7 (D-030), et le point 34 en veille ; la 3.7 ne
  commence que sur son « vas-y ». PR #165, de registres seule, fusionnée et
  déployée le 10 octobre 2026.

### Corrigé (note du manque d'eau)

- **La note du manque d'eau tolère le résidu d'arrondi des secondes** (point
  ouvert 41, 10 octobre 2026, tranché par le porteur, D-040) : le moteur coupe
  chaque créneau à la seconde entière et tient pour reçu un reste sous un
  centième de millimètre ; la note (D-038) paraissait dès un litre d'écart
  entre l'eau placée et le besoin compté et nommait une autre cause — sur la
  ferme, « 0,002 m³ de besoin couverts par une eau comptée sur une surface
  plus petite » pour 0,9 s rognées sur chacun des quatre créneaux. Désormais
  la note ne paraît, pour l'eau placée à côté en plus ou en moins, qu'au-delà
  du résidu d'arrondi des secondes — un centième de millimètre par planche et
  par créneau qui l'arrose, au prix de la surface mouillée de l'application,
  et au moins un litre — ; le manque pour une autre raison garde son seuil
  d'un litre ; le calcul du manque, la ligne de budget et les parts ne
  changent pas. Contrat précisé avant le code, deux tests rouges d'abord (les
  chiffres de la ferme, la ferme de test du moteur). PR #164 fusionnée et
  déployée le 10 octobre 2026 ; recette sur le site faite le jour même, la
  note absente (ci-dessus).

### Vérifié (recette de la part réservée)

- **La part réservée vérifiée sur le site déployé** (point ouvert 36, 10
  octobre 2026, par l'assistant dans le Chrome du porteur sur son « reprends
  le travail », le constat à l'assistant et le jugement au porteur ; cinquième
  recette de `docs/recette-planning.md`) : pénurie fabriquée sur la semaine du
  5 au 11 octobre, forage indisponible et minimum de sécurité relevé à 16 puis
  20 m³ ; à 50 % puis 28 % de part, chaque planche des quatre tunnels reçoit
  sa fraction, la dernière examinée comprise, la somme des créneaux ne dépasse
  pas le budget, la réserve s'arrête exactement à son minimum, la ligne de
  budget dit « part réservée : normale 50 % » puis « 28 % ». La note du manque
  d'eau s'affiche à 28 % pour 0,002 m³ qui sont un résidu d'arrondi des
  créneaux à la seconde entière, sous un libellé qui nomme une autre cause :
  point ouvert 41, au jugement du porteur. Trois recalculs en 1,83 à 2,50 s ;
  données remises en état par l'écran, plan du matin retrouvé. La clôture de
  la 3.5 reste au porteur. PR #163, de registres seule, fusionnée et déployée
  le 10 octobre 2026.

### Vérifié (recettes des points 4 et 7)

- **Règle 3.3.1 vérifiée sur le site déployé** (point ouvert 4, 9 octobre 2026
  au soir, par l'assistant dans le Chrome du porteur sur son mot, le constat à
  l'assistant et le jugement au porteur) : semaine du 5 au 11 octobre,
  objectif « Toute la ferme » à 20 mm, ET0 de la semaine de 12,4 mm affichée
  « Information · hors calcul » ; sous abri, pluie à 0 et sans irrigation, le
  reste réel vaut l'objectif entier, 20 mm, là où l'ancienne règle aurait
  affiché 12,4 ; en plein champ, 23,2 mm de pluie réelle ramènent le reste à
  0 ; volumes justes, 0,32 m³ pour 16 m² mouillés et 0,64 m³ pour 32 m².
  Aucune donnée modifiée.
- **Retrait d'une pompe par défaut vérifié sur le site déployé** (reste du
  point 7, recette légère, même soir et même cadre) : la pompe habituelle de
  `gag1` retirée dans « Pompe habituelle du matériel », avis d'enregistrement,
  retrait conservé après rechargement complet de la page, les 33 autres
  matériels inchangés ; pompe remise ensuite et conservée. Point 7 fermé. PR
  #162, de registres seule, fusionnée et déployée le 9 octobre 2026.

### Vérifié (lecture des journaux de durée)

- **Journaux de durée du recalcul lus sur le site déployé** (point ouvert 34,
  9 octobre 2026 au soir, par l'assistant dans le Chrome du porteur sur son
  mot, les chiffres à l'assistant et le jugement au porteur) : trois recalculs
  à la demande sur la ferme — 164 planches, 9 propositions, instantané en
  cache — en 455 à 545 ms de calcul (`inputs` 275 à 315 ms, `engine` 0 ms,
  l'horloge du Worker ne bougeant pas pendant le calcul pur) et 498 à 577 ms
  de ré-affichage (`dashboards` 381 à 425 ms), soit 1 653 à 1 826 ms
  d'invocation pour 407 à 600 ms de CPU, 2,3 s vus du navigateur ; aucune
  phase longue ni variable, le 3 s à 45 s du 5 octobre non reproduit.
  Actualisation forcée depuis OTF : 429 sur `/bedList` au bout de 1,2 s, repli
  sur le cache, 1 694 ms de page. Cause encore à nommer ; piste de la lecture
  OTF en direct au moment du clic, à surveiller dans les mêmes journaux ; le
  porteur tranche le soir même : attendre une occurrence, aucune correction
  avant. Guide de lecture de `docs/publication.md` corrigé sur ce qui a été
  vu. PR #161, de registres seule, fusionnée et déployée le 9 octobre 2026.

### Ajouté (journaux de durée)

- **Chaque calcul de la semaine et chaque affichage de la page écrivent leurs
  durées** (point ouvert 34, mesure décidée par le porteur le 9 octobre 2026,
  avant toute piste moteur) : une ligne JSON `planning_calculation_completed`
  par calcul — déclencheur, saison, semaine, source de l'instantané, nombres
  de planches et de propositions, millisecondes entières par phase
  (`snapshot`, `inputs`, `needs`, `arbitration` sous arbitrage validé,
  `engine`, `save`, `reread`) et total — et une ligne `irrigation_page_loaded`
  par affichage (`snapshotAndLists`, `dashboards`, `needs`, total), sans
  identifiant de personne, de nom de planche, de jeton ni de cookie.
  Chronomètre à horloge injectable dans `lib/adapters/stopwatch.ts` ; dans un
  Worker Cloudflare, l'horloge n'avance qu'aux entrées-sorties, le calcul pur
  se lit dans le temps CPU de l'invocation. Règle au contrat du planning avant
  le code, deux tests rouges d'abord ; guide de lecture pas à pas dans
  `docs/publication.md`, « Lire les journaux du Worker ». PR #160 fusionnée et
  déployée le 9 octobre 2026.

### Modifié (dépôt)

- **Trois décisions du porteur le 9 octobre 2026** sur les points en attente
  de son jugement : D-037, en pénurie la part attribuée à une planche lui est
  réservée, le créneau d'une autre ne peut pas la consommer ; D-038, le manque
  d'eau reste calculé planche par planche et l'écart avec « demandé moins
  placé » sera expliqué à l'écran ; D-039, l'historique compte un objectif à
  partir de son jour de pose, comme le tableau des besoins. Ses autres
  réponses du même jour : points 33 et 35 à corriger (cette PR) ; point 31
  dans la 3.7 ; point 34 mesuré par des journaux côté serveur, lecture à lui
  expliquer pas à pas ; recette du point 4 par l'assistant, sur une planche
  dont l'objectif est relevé au-dessus de l'ET0 puis remis, sans toucher à
  l'ET0 ; points 3, 17 et 18 cochés ; clôture de la 3.5 après les points 33,
  35 et 36 ; place de l'extension 5 bis confirmée après la 3.7 et avant la
  3.8 ; 3.7 ensuite, sur son mot.
- **Décision D-036 du porteur le 9 octobre 2026** sur le point 39 :
  l'historique somme l'objectif d'une période sur les journées-planche
  couvertes, comme le tableau des besoins ne demande plus la semaine entière
  depuis D-034. Deux consignes de travail reçues le même jour, inscrites dans
  `AGENTS.md` et la roadmap : chaque compte rendu de PR situe l'avancement sur
  la roadmap ; la 3.8 ne commence qu'après un avertissement explicite au
  porteur, la 3.5 et la 3.7 terminées, parce qu'il veut la vérifier lui-même
  de fond en comble.
- **Quatre décisions du porteur le 9 octobre 2026** sur les points en attente
  de son jugement : D-032, sous abri la pluie vaut zéro dans toutes les vues,
  l'historique par périmètre compris ; D-033, un besoin fixé à la main rend
  une planche planifiable sans objectif ; D-034, un objectif posé en cours de
  semaine vaut pour ses jours restants ; D-035, la limite de prélèvement d'une
  ressource couvre tout ce qu'elle fournit, apports à une réserve compris. Les
  quatre corrections suivent dans la même PR, pour un seul déploiement : PR
  #153 fusionnée et déployée le 9 octobre 2026.
- **Demande du porteur consignée dans la roadmap** le 9 octobre 2026 : des
  alertes météo paramétrables selon des critères renseignés par l'utilisateur,
  par exemple une notification quand la température minimale prévue descend
  sous 5 °C. Section 5 bis, ligne du tableau d'état et place proposée dans
  l'ordre d'exécution (17, après la 3.7, les étapes suivantes décalées d'un
  rang), à décider par lui ; ce qui existe déjà et ce qu'un contrat devra
  trancher y sont relevés. Aucun code modifié.
- **Trois décisions du porteur le 5 octobre 2026 au soir** : D-028, le
  planning expose les faits annoncés — pluie prévue, seuil, reste — et
  l'utilisateur décide, la règle R2 et le seuil restent (point ouvert 29
  fermé) ; D-029, le réglage R1 « heure du recalcul quotidien » est retiré, le
  recalcul du matin suivant la météo à 06 h 15 (point 32, PR #136 fusionnée et
  déployée le 8 octobre 2026, recette faite le soir même) ; D-030, un créneau
  refusé — ce matériel, à ces heures — est exclu des calculs suivants de la
  semaine, le besoin restant placé ailleurs (point 31 ; contrat corrigé, le
  moteur ne lit pas encore les refus, mise en œuvre dans la 3.7). Registres et
  contrat seuls.
- **Ancien site OpenAI Sites supprimé, décision D-016 et sous-tranche Q0
  closes** le 3 octobre 2026 : après quatorze jours sans incident sur
  Cloudflare, le porteur a supprimé le site depuis son compte ChatGPT ;
  l'ancienne adresse répond 404. Registres, contrat de migration et procédure
  de publication à jour. Aucun code modifié.
- **Le job « Parcours navigateur » est requis par la protection de `main`**
  depuis le 2 octobre 2026 (D-026, point ouvert 21 fermé) : une PR aux
  parcours rouges ne se fusionne plus, la garde de `main` garantit ce que le
  déploiement demande. `AGENTS.md` nomme les trois jobs. Aucun code modifié.

### Modifié (outillage)

- **vinext 1.0.0**, depuis 1.0.0-beta.10 : `vinext dev` relaie désormais vers
  `vite dev` et refuse `--hostname` ; la commande de démarrage des parcours
  navigateur passe à `--host`. Remplace la PR Dependabot #116. Aucun code du
  logiciel modifié. **Constaté** : les alertes de vulnérabilité sur `undici`
  et `ws` tiennent aux épinglages de `pnpm-workspace.yaml`, pas seulement à
  Wrangler (point ouvert 20).
- **Dépendances du 1er octobre 2026**, six PR Dependabot fusionnées par le
  porteur, une à la fois : `@cloudflare/workers-types` 5.20260927.1 (#117),
  `next` 16.3.6 (#119, correctif de sécurité de `next/og`, que le logiciel
  n'utilise pas), `@vitejs/plugin-react` 6.1.1 (#81), `@types/node` 22.20.4
  (#78), `actions/upload-artifact` 7 (#118) et **TypeScript 6.0.3** à la
  racine et dans les deux Workers (#79), examinée avant fusion : aucune option
  retirée dans nos `tsconfig`, aucun avertissement de typescript-eslint.
  Aucun code du logiciel modifié ; les trois jobs de la CI verts sur chaque
  PR, `main` redéployée après chaque fusion. **Constaté** : la protection de
  `main` n'exige pas le job « Parcours navigateur » (point ouvert 21).
- **Épinglages d'`undici` et de `ws` dans `pnpm-workspace.yaml`** (point
  ouvert 20 fermé) : celui de `ws` 8.18.0 est retiré, miniflare et le greffon
  Vite demandant eux-mêmes 8.21.0 ; celui d'`undici` passe de 7.24.8 à 7.29.1
  et porte désormais sa raison et sa condition de retrait. Posés le
  1er septembre 2026 sans raison écrite, ils ramenaient le miniflare du
  Wrangler le plus récent aux versions du plus ancien, quand la racine et le
  Worker des alertes n'avaient pas le même ; les trois `package.json`
  déclarent aujourd'hui le même. Aucun code du logiciel modifié ; contrôles
  complets, parcours compris. **Attendu** : vingt-trois alertes de
  vulnérabilité fermées à la fusion, onze transitives restantes.
- **Dépendances du 8 octobre 2026** : `knip` 6.39.0 (#142, fusionnée par le
  porteur), puis, en une seule PR du dépôt pour un seul déploiement, les
  quatre autres PR Dependabot du 7 octobre — `eslint-config-next` 16.3.8
  (#139), `drizzle-orm` 0.45.3 (#140), `vite` 8.3.2 (#141), `vinext` 1.0.1
  (#143) — et **`next` 16.3.8**, correctif de sécurité (sept avis, dont une
  SSRF haute dans l'optimisation d'images), PR #147 de Dependabot ; PR #148
  fusionnée et déployée le soir même. Aucun code du logiciel modifié ;
  contrôles complets, parcours compris. **Constaté à la fusion** : douze
  alertes `next` fermées, treize alertes de développement restantes ;
  Dependabot a fermé seul ses cinq PR.

### Modifié (tests)

- **Les invariants de la ferme de test du moteur** (9 octobre 2026, avec le
  point 36) : l'espacement ne compte que les planches qui commandent le
  matériel, comme le contrat (D-025), l'invariant étant plus strict ; un
  invariant de budget vérifie que la somme des volumes d'une chaîne ne dépasse
  jamais son budget (D-037) ; la ferme accepte des planches de bord arrosées
  sous la part R13 (`edges`).
- **La ferme de test du moteur de planning vit dans
  `tests/support/planning-fixtures.ts`** (9 octobre 2026) : constantes, ferme
  aux chiffres de la ferme réelle, aides de lecture d'un plan et invariants du
  contrat sortent de `tests/planning-engine.test.ts`, à 594 lignes comptées
  pour une limite de 600, exportés tels quels ; le fichier de tests garde ses
  tests et le budget de temps du calcul. Aucune ligne de test ni de code du
  logiciel modifiée ; restructuration seule, avant le correctif du point 36,
  dont les tests iront dans un fichier neuf.
- **Le test de performance du planning tolère deux secondes** (décision
  D-027, point ouvert 23 tranché, 4 octobre 2026) : la limite de 1 000 ms de
  temps réel a rougi quatre fois en deux jours sur les machines de GitHub,
  1 004 à 1 022 ms, deux fois sur `main` avec déploiement sauté. Le calcul
  dure 580 à 650 ms sur le poste du porteur, environ 1,6 fois plus sur la
  CI ; l'échauffement n'y change que 8 %. Limite portée à 2 000 ms, constante
  nommée, le test étant une garde contre une régression de complexité et non
  une mesure de confort. Roadmap et contrat du planning portent la nouvelle
  preuve de fin ; l'allègement de `minimumLevel` devient le point ouvert 28.
  Aucun code du logiciel modifié.

### Corrigé (persistance)

- **L'ordre des journaux et des révisions dépendait d'un identifiant tiré au
  sort** (point ouvert 27, 4 octobre 2026) : les lectures où la dernière
  révision fait foi, journal des réglages du planning, objectifs hydriques
  de la semaine et leur histoire rejouée, limites journalières, limites de
  prélèvement des ressources, départageaient deux lignes de même
  `created_at`, posé à la milliseconde, par `id`, un UUID ; le domaine des
  besoins faisait de même en remettant les révisions en ordre. Deux
  enregistrements dans la même milliseconde sortaient dans un ordre
  aléatoire : le run de `main` lancé par la fusion de la PR #130 a rougi
  ainsi sur un test juste, déploiement sauté. Le départage se fait par
  `rowid`, l'ordre d'insertion, et le domaine trie de façon stable sans
  l'identifiant (`docs/revision-order-contract.md`). Cinq tests posent
  l'égalité de milliseconde, tous rouges avant la correction. Schéma,
  migrations et écritures inchangés. **Constaté**, non corrigé : les ordres
  d'affichage départagés par l'identifiant, placements, liaisons,
  historique, où rien ne fait foi.

### Corrigé (irrigations)

- **L'historique compte un objectif à partir de son jour de pose** (point
  ouvert 40, décision D-039 du 9 octobre 2026) : le résumé « Par périmètre »
  et les cumuls par série relisaient les objectifs par semaine, un objectif
  posé un mercredi valant pour toute sa semaine dès le lundi, quand le tableau
  des besoins ne le compte, depuis D-034, qu'à partir de son jour civil :
  35 mm lus là où la 3.3 lit 25. La règle vit désormais en un seul endroit,
  `goalRevisionFirstDate` dans `lib/domain/hydric-goal-revisions.ts`, appelée
  par les besoins et par l'historique : un objectif compte dans sa semaine à
  partir de son jour de pose en heure de Paris, dès le lundi s'il reprend
  automatiquement la semaine précédente, jamais pour une semaine déjà passée ;
  les semaines suivantes le comptent dès le lundi. L'historique ne départage
  plus deux révisions de la même milliseconde par l'identifiant (contrat de
  l'ordre des révisions). Règle au contrat des séries, test rouge d'abord. PR
  #159 fusionnée et déployée le 9 octobre 2026.
- **Modifier une irrigation planifiée ne compte plus son ancien volume dans la
  limite journalière** (point ouvert 13) : à la modification d'une irrigation
  planifiée et non démarrée, la garde de la limite journalière (2.8) comptait
  l'ancien volume planifié en plus du nouveau et pouvait refuser une
  modification qui tenait dans la limite ; la validation hydraulique, elle,
  excluait déjà l'irrigation modifiée. La modification est jugée comme une
  création, son propre volume planifié retiré du journal du jour : seul le
  volume modifié est comparé à la limite. Règle au modèle de données, trois
  tests de persistance rouges d'abord. PR #155 fusionnée et déployée le 9
  octobre 2026.
- **L'objectif d'une période se somme sur les journées-planche couvertes**
  (point ouvert 39, décision D-036 du 9 octobre 2026) : le résumé « Par
  périmètre » et les cumuls par série ne calculaient l'objectif, donc l'écart,
  que si un objectif couvrait chaque jour de chaque planche ; une période
  commencée avant le premier objectif de la ferme lisait « objectif
  indisponible ». L'objectif se somme désormais sur les journées-planche
  couvertes, pondéré par la surface ; une journée-planche sans objectif compte
  zéro, sans être une donnée manquante ; seule une période sans aucune
  journée-planche couverte est sans objectif ni écart. La carte « Objectif »
  affiche le nombre de journées-planche couvertes ; l'avertissement
  « incomplet, l'écart n'est pas calculé » est retiré. Règle au contrat des
  séries, tests rouges d'abord. PR #154 fusionnée et déployée le 9 octobre
  2026.
- **Sous abri, la pluie du périmètre vaut zéro dans l'historique** (point
  ouvert 11, décision D-032 du 9 octobre 2026) : le résumé « Par périmètre »,
  écrit avant que l'abri n'existe, comptait la pluie extérieure sur toute
  surface, à l'inverse du tableau des besoins, du planning et de la vue « Par
  série ». La pluie réelle d'un périmètre est pondérée par la surface de ses
  planches, zéro sur celles d'un jardin sous abri : un périmètre entièrement
  sous abri lit 0 mm, explicite et complet ; un périmètre mixte lit la pluie
  extérieure au prorata de sa surface de plein champ ; l'écart suit. Règle au
  contrat des séries, test rouge d'abord. PR #153 fusionnée et déployée le 9
  octobre 2026.
- **Un objectif posé en cours de semaine vaut pour ses jours restants** (point
  ouvert 16, décision D-034 du 9 octobre 2026) : la 3.3 ne tenait l'objectif
  d'une semaine pour applicable que s'il couvrait ses sept jours ; un premier
  objectif posé un mercredi laissait la semaine « sans objectif » et le
  planning sans proposition. La demande de la semaine est la somme des
  septièmes de l'objectif sur les jours qu'il couvre ; seule une semaine sans
  aucun jour couvert est sans objectif, et les jours sans objectif ne sont pas
  une donnée manquante. Règle au contrat des besoins, test rouge d'abord. PR
  #153 fusionnée et déployée le 9 octobre 2026.
- **La limite de prélèvement d'une ressource compte aussi ses apports à une
  réserve** (point ouvert 38, décision D-035 du 9 octobre 2026) : la
  vérification de disponibilité d'une origine de pompe ne comptait dans la
  limite du jour que les prélèvements directs, quand le planning y compte
  aussi ce que la ressource verse dans une réserve ; elle appelle désormais la
  même fonction du domaine. Règle au contrat hydraulique, test rouge d'abord.
  PR #153 fusionnée et déployée le 9 octobre 2026.
- **La limite de prélèvement d'une ressource se juge au jour de la ferme**
  (point ouvert 14, 9 octobre 2026) : `resolvePumpOriginAvailability` prenait
  le jour d'un créneau et des prélèvements déjà faits en UTC ; un créneau de
  0 h 30 heure de Paris était compté la veille pour la période de
  disponibilité, la limite en vigueur et les prélèvements du jour, à l'inverse
  du planning (D-004). Règle écrite au contrat hydraulique, test du domaine
  rouge d'abord, jour pris dans le fuseau de la ferme ; appelants inchangés.
  PR #152 fusionnée et déployée le 9 octobre 2026.
- **Le démarrage et la reprise refusent un volume invérifiable sous une
  limite** (point ouvert 24, 9 octobre 2026) : la garde du démarrage ne
  jugeait que le volume connu, nul quand toutes les planches sont inconnues ;
  une aspersion planifiée avant la limite, dont une planche n'a pas de
  passe-pied renseigné, démarrait sous une limite activée entre-temps. Règle
  précisée au contrat de la surface mouillée, tests de la garde rouges
  d'abord, le jour limité cherché en un seul endroit du domaine
  (`firstLimitedDay`), que la garde à la création appelle aussi sans changer
  de comportement. PR #151 fusionnée et déployée le 9 octobre 2026.
- **Une irrigation planifiée ou démarrée au volume invérifiable sous une
  limite journalière n'était pas refusée** (point ouvert 12, 4 octobre
  2026) : la garde de la création rendait le texte du refus au lieu de le
  lancer, et « Planifier » enregistrait l'irrigation en l'affichant en
  avertissement ; la validation d'une proposition du planning, elle, lisait
  le message et refusait. La garde lève désormais
  `IrrigationDailyLimitExceededError`, rendue en échec par l'action et en
  refus par la validation, qui n'a plus à écouter un message. Contrat
  précisé ; quatre tests de persistance, le premier en échec avant la
  correction. Rien ne change dans l'interface ni dans `db/`. **Constaté** :
  la garde du démarrage ignore encore le volume inconnu (point ouvert 24),
  et le parcours P10 à 390 px manquait d'eau un dimanche soir dans la suite
  complète des parcours (point 25, corrigé le soir même par la PR #130).

### Corrigé (planning)

- **La part réservée en pénurie et la note du manque d'eau** (9 octobre 2026,
  point ouvert 36, D-037 et D-038) : en pénurie, la fraction attribuée à une
  planche lui est réservée — un registre des parts par chaîne d'eau
  (`lib/domain/planning/shares.ts`), le créneau borné à ce que ses parts
  paient, son débordement pris sur l'eau non attribuée puis sur les parts de
  ses propres planches, ce qu'une planche ne peut pas recevoir libéré en fin
  de tour et redistribué par la conduite ; la dernière planche examinée reçoit
  sa part comme la première. Motif de dose « la part de la semaine réservée à
  ses planches », contrainte « part de la semaine atteinte, le reste est
  réservé aux autres planches » ; la ligne du budget dit « part réservée ».
  Sous les cartes, une note chiffre l'écart entre demandé, placé et manque
  d'eau — l'eau placée sans couvrir de besoin compté, le manque pour une autre
  raison que l'eau —, le calcul du manque ne changeant pas. Contrat d'abord,
  tests rouges d'abord. PR #158 fusionnée et déployée le 9 octobre 2026.
- **La pompe nomme ce qui la tenait, et l'espacement l'emporte sur la pluie
  dans le motif du moment** (point ouvert 33) : le motif « pompe saturée avant
  21:47 : aucun » lisait les occupants de la pompe une milliseconde avant le
  départ, dans le creux d'une minute entre deux vagues ; un créneau repoussé
  au samedi par l'espacement R7 disait « après la pluie prévue ». La
  contrainte limitante nomme désormais les matériels qui tenaient la pompe au
  départ voulu, ou ceux qui la prennent à l'heure de fin, lus au moment du
  conflit ; le motif du moment reste celui qui a fixé le jour, « plage
  horaire » ne se disant que si rien d'autre n'a contraint. Contrat précisé,
  deux tests rouges d'abord. PR #156 fusionnée et déployée le 9 octobre 2026.
- **La coupe sous limite journalière porte son nom** (point ouvert 35,
  scénario 4 du contrat) : la pénurie bornait le budget au reste de limite
  journalière des seuls jours limités et nommait la coupe « stock et
  ressources insuffisants ». Le motif est « limite journalière » quand c'est
  elle qui laisse moins que l'eau, le résumé du plan le dit (« Ce que la
  limite journalière ne laisse pas placer »), et dès qu'un jour de l'horizon
  est sans limite, la limite ne borne plus le budget de la semaine, ce jour
  prenant ce que ses plages et la pompe permettent, la limite restant vérifiée
  créneau par créneau. Contrat précisé, deux tests rouges d'abord ; un test du
  point 26 aligné. Même PR.
- **Un besoin fixé à la main rend la planche planifiable sans objectif**
  (point ouvert 15, décision D-033 du 9 octobre 2026) : le moteur testait
  l'objectif avant le remplacement manuel et disait « non planifiable : aucun
  objectif applicable » une planche que la faisabilité 3.4 sert déjà. Le
  remplacement manuel tient lieu d'objectif ; seule une planche sans objectif
  ni besoin manuel reste non planifiable. Contrat du planning aligné, test
  rouge d'abord. PR #153 fusionnée et déployée le 9 octobre 2026.
- **Un arbitrage vide ne s'impose plus au moteur** (point ouvert 26, 9 octobre
  2026) : quand une décision d'arbitrage existait encore sans qu'aucun niveau
  soit validé, le service transmettait une liste vide que `applyShortage`
  tenait pour un arbitrage, sautant la conduite en pénurie R9 ; les budgets
  des réserves et des ressources ne bornaient plus les cibles. Règle écrite au
  contrat du planning, test du moteur rouge d'abord, correction dans le
  domaine ; service inchangé. PR #150 fusionnée et déployée le 9 octobre 2026.
- **Budget du test de performance du planning ramené à 500 ms** le 8 octobre
  2026 (D-031, point ouvert 28) : après la correction du 5 octobre, le job
  « Application » mesure 101 ms sur les machines de GitHub et le poste du
  porteur 209 à 237 ms ; la limite, cinq fois la mesure de la CI, reste une
  garde de complexité et non une mesure de confort. Constante du test, contrat
  du planning et roadmap ; PR #144 fusionnée et déployée le soir même.
- **Calcul du planning quatre fois plus rapide** le 5 octobre 2026 au soir
  (point ouvert 28) : le profil montrait 73 % du temps dans la projection de
  la réserve, à construire un formateur de fuseau horaire neuf à chaque
  rupture ; `lib/domain/water-management.ts` en construit un par fuseau et par
  usage, une fois. La grande ferme de test passe de 788 à 1 052 ms à 209 à
  237 ms sur le poste du porteur, pour le même plan ; un test garde que deux
  fuseaux restent deux fuseaux. Aucune règle métier touchée, budget D-027
  inchangé ; 101 ms sur la machine de la CI le soir même. PR #138 fusionnée et
  déployée le 8 octobre 2026, point 28 fermé.
- **Réglage R1 « heure du recalcul quotidien » retiré** le 5 octobre 2026 au
  soir (D-029, point ouvert 32) : il affichait « recalcul à 06:30 » sans agir,
  le recalcul du matin suivant la synchronisation météo à 06 h 15. Retiré du
  contrat, des réglages, de la présentation et du formulaire ; le pli
  « Réglages du planning » dit que le recalcul du matin suit la météo et ne se
  règle pas, la numérotation R2 à R13 est conservée ; un enregistrement qui
  porte encore l'heure se lit sans elle, prouvé par un test de persistance ;
  aucune migration. PR #136 fusionnée et déployée le 8 octobre 2026 ; recette
  faite le soir même sur la version déployée, sur ordinateur et à 390 px : pli
  ouvert d'un clic, aucun champ R1, note affichée, aucun débordement ; point
  32 fermé.
- **La garde de la réserve était inopérante avec un minimum de sécurité à 0**
  (point ouvert 19, seconde recette du 29 septembre 2026) : la projection qui
  juge un créneau n'est plus bornée par zéro, seulement par la capacité, et
  court du début du créneau à la fin de l'horizon ; un créneau qu'attendre
  l'apport ne sauve pas est raccourci par bissection à la plus longue durée
  que la réserve accepte, sinon refusé « réserve au minimum » ; le niveau
  affiché reste le niveau physique, borné par zéro. Test sur les chiffres de
  la ferme — 30 m³, 0,511 m³/h, minimum 0 — qui échouait avant la correction
  (48,51 m³ tirés la première nuit pour 39,78 disponibles) ; l'invariant de
  la réserve lit la projection non bornée et peut échouer. Règle précisée
  dans `docs/planning-contract.md` (point 5 « L'eau », note « La garde de la
  réserve »). **Attendu sur la ferme** : les vagues des blocs décalées aux
  nuits suivantes au rythme du forage ; une irrigation déjà planifiée qui
  dépasse le stock fait refuser les créneaux qui précèdent ce manque,
  « réserve au minimum de sécurité au moment voulu ». **Constaté** en jouant
  les parcours à 23 h 06 : P10 dépend de l'heure entre 23 h 00 et 23 h 41,
  sans rapport avec la correction (point ouvert 22). Troisième recette
  après fusion et déploiement.
- **Deux cartes pouvaient porter le même nom** (« Proposition p-12 » du
  calcul refusé et du nouveau calcul, les numéros repartant de p-1 à chaque
  calcul) : une carte validée ou refusée relue avec un calcul plus récent
  porte la date de son calcul, dans son nom et sous le matériel —
  « Proposition p-12 du calcul du 29/09/2026 19:51, gag11 ». Date lue par
  jointure (`calculatedAt`), règle pure `earlierCalculationDate` testée,
  parcours P10 étendu d'un recalcul.

### Corrigé (parcours navigateur)

- **P9 cliquait l'onglet « Par série » avant que la page n'ait repris la main
  après son rechargement** (point ouvert 37, 5 octobre 2026) : une fois sur
  vingt-quatre dans la suite complète sur le poste du porteur, jamais sur la
  CI, la trace montrant les modules de la page encore en chargement 0,3 s
  après le clic. Corrigé le 8 octobre 2026 : le clic passe par `ouvrirParClic`
  jusqu'à ce que l'onglet soit sélectionné ; l'aide et le contrat des parcours
  disent qu'un rechargement remet le parcours dans la situation du premier
  clic. Les parcours P1, P4 et P6, qui rechargent aussi la page, ont été
  vérifiés : P1 attend que son minuteur avance avant de cliquer, preuve
  équivalente ; P6 ne fait que lire ; P4, dont le premier geste pouvait être
  de feuilleter l'historique, ouvre et ferme d'abord la bulle d'aide, comme P7
  à son départ, corrigé dans la même PR. Suite complète 24 sur 24 réussis en
  local ; PR #145 fusionnée et déployée le soir même.
- **P10 à 390 px manquait d'eau un dimanche soir dans la suite complète des
  parcours, sans changement du logiciel** (point ouvert 25 : en local et en
  CI le 4 octobre 2026) : P7 laissait dans la base partagée une décision
  d'arbitrage — servir N01 seule parmi les sept planches, l'objectif que P10
  avait laissé sur la semaine courante leur donnant à toutes un besoin — que
  le recalcul de la faisabilité n'invalide que si l'eau suffit ; un dimanche
  soir, l'eau mobilisable d'ici minuit ne suffisant plus, la planche de P10
  restait « Non retenue lors de l'arbitrage manuel » et le plan n'avait rien
  à proposer. P10 pose et retire désormais son objectif sur les deux
  semaines ; P7 fait recalculer la faisabilité après sa remise en état et
  vérifie que son arbitrage est déclaré « plus applicable ». Règle ajoutée à
  `docs/browser-journeys-contract.md`. Aucun code du logiciel modifié.
  **Constaté** en relisant le moteur : une décision existante mais plus
  validée est passée au moteur comme un arbitrage vide, qui saute la conduite
  de pénurie (point ouvert 26).
- **P10 échouait de 23 h 00 à 23 h 41, sans changement du logiciel** (point
  ouvert 22 : en local le 2 octobre 2026, en CI le 3) : à moins d'une heure de
  la fin de la plage ouverte jusqu'à 23 h 59, le moteur propose un créneau du
  jour raccourci à la plage, et la première carte n'était plus celle des 10 mm
  attendus. Le parcours lit désormais la première carte à la dose entière, ou
  la carte raccourcie avec son motif quand le calendrier n'en offre pas
  d'autre. Règle ajoutée à `docs/browser-journeys-contract.md`. Aucun code du
  logiciel modifié.
- **P4 et P5 échouaient à 390 px depuis le 1er octobre 2026, sans changement
  du logiciel** : P4 ne regardait que la première page de l'historique alors
  que les parcours précédents laissent seize irrigations dans la semaine,
  douze par page, et que son irrigation commence à la même minute que celle
  de P3 ; P5 lisait l'horloge à chaque saisie, et une minute écoulée
  changeait le débit attendu (1,059 devenu 1,057 m³/h). Les parcours
  relèvent désormais un seul « maintenant » (P2, P3, P4, P5, P9) et P4
  feuillette l'historique jusqu'à sa fiche (`trouverLaFiche`). Deux règles
  ajoutées à `docs/browser-journeys-contract.md`. Aucun code du logiciel
  modifié.

### Vérifié

- **Quatrième recette réelle du planning, 5 octobre 2026 au soir, la pénurie
  fabriquée** (`docs/recette-planning.md`) sur le mot du porteur, données
  expérimentales remises en état : forage indisponible, minimum de sécurité
  à 20 puis 40 m³, limites de prélèvement et journalière à 10 m³/jour, R2 à
  0 %. La garde de la réserve tient sur la ferme — jamais sous le minimum,
  0,001 m³ quand il vaut 0, 20,00 et 40,00 exactement quand il est relevé —,
  le stock est consommé au litre près, les vagues sont décalées au rythme du
  forage, aucun jour limité ne dépasse 10 m³ : point ouvert 19 fermé.
  **Révélé** (points ouverts 34 à 36) : le temps de calcul sur le site varie
  de 3 s à plus de 45 s pour le même état ; sous limite journalière, la
  coupe est nommée « stock et ressources insuffisants » et la cible ignore
  le lundi sans limite ; la part égale est une cible, la dernière planche
  examinée reçoit 0 %, et « Manque d'eau » ne vaut pas « demandés moins
  placé ». Aucun code modifié.
- **Troisième recette réelle du planning, 5 octobre 2026, sur la version
  déployée** (`docs/recette-planning.md`) : recalcul du matin et lundi
  d'une nouvelle semaine constatés, recalcul à la demande en 2 s, refus et
  carte datée vérifiés, 37 créneaux rejoués à la main sur la réserve,
  jamais sous 0, « Manque d'eau 0,00 » vrai. La pénurie reste hors
  d'atteinte cette semaine : la garde (point ouvert 19) n'est prouvée que
  par le test des chiffres de la ferme. **Révélé**, au jugement du porteur
  (points ouverts 29 à 33) : le seuil de planification efface le plein
  champ du plan sans trace après 1,5 mm de pluie prévue en plus ; la
  réserve part de l'observation telle quelle, sans l'apport des jours
  écoulés ; une proposition refusée revient à l'identique ; le réglage R1
  n'agit pas ; deux motifs inexacts. Aucun code modifié.
- **Seconde recette réelle du planning, 29 septembre 2026 à 21 h 20, après
  la portée (R13, PR #114)** : un créneau de 2 h par bloc, 69,243 m³ pour
  92,661 mobilisables au lieu de 130,956, blocs 3, 8 et fleurs 3 servis,
  motifs « portée » et « sous la dose minimale », temps de pompage manquant à
  zéro, calcul en 3 s. **Révélé** : la garde de la réserve est inopérante avec
  un minimum de sécurité à 0 — 21,12 m³ tirés d'une réserve à sec la nuit de
  mercredi, « manque d'eau 0,00 » (point ouvert 19) ; corrigée le 2 octobre
  2026, troisième recette après fusion. Aucun code modifié.

- **Interface du planning 3.6 close le 29 septembre 2026** : recette réelle
  sur la ferme (`docs/recette-planning.md`) — calcul en 4 s, ajustement
  validé jusque dans les irrigations à venir, refus, annulation, 390 px sans
  débordement. **Le moteur 3.5 attendait une décision**, tranchée le soir
  même (D-025) : sur les rampes de
  bloc à profil, la règle R11 sur-arrose le centre, vide la réserve et
  laisse trois blocs sans créneau ; question R13 posée au porteur, deux
  défauts d'explication consignés (points ouverts 17 et 18). Aucun code
  modifié.

- **Extension séries 5.1 close le 29 septembre 2026** : recette réelle passée
  sur trois séries de la ferme (`docs/recette-series.md`), périodes égales
  à celles d'Ouvre ta ferme, cumuls égaux à ceux des planches. Corrigé le jour
  même : la ligne d'une planche affichait une pluie partielle comme un total ;
  elle ne montre plus la pluie que complète.

- **Étape 5.0 close le 29 septembre 2026** : recette réelle passée sur la
  ferme après la mise en ligne de la seconde PR — une aspersion d'une heure
  sur le tunnel 1 à 1,28 m³ sur 128 m² mouillés, un goutte-à-goutte d'une
  heure sur gag1 à 0,924 m³ sur 66 m², les deux recalculés à la main, et les
  vingt-deux irrigations antérieures au même volume qu'avant, et la lecture à
  390 px faite dans un cadre de cette largeur : aucun débordement, détail des
  irrigations en une colonne avec sa ligne « Surface mouillée ».

### Ajouté (portée du matériel, moteur de planning)

- **R13, la portée d'un matériel** (D-025). Une planche arrosée à moins de
  50 % du débit le plus fort d'un matériel ne commande pas son arrosage : ni
  référence de dose, ni « un arrosage par jour », ni espacement, pour les
  propositions comme pour les irrigations réelles ; son eau reste comptée,
  son reste est affiché « portée du matériel insuffisante ». La planche la
  mieux arrosée fixe la dose : une rampe à profil tourne une fois pour son
  centre et ne revient pas pour ses bords. Réglable à l'écran.

### Corrigé

- Le motif d'un reste sans cause dit désormais la vraie cause — portée du
  matériel, dose sous le minimum qui attend, espacement, plus de plage —
  et non « temps de pompage » par défaut ; le niveau projeté de la réserve
  sur une proposition est celui du plan fini, et l'accesseur du niveau à un
  instant rendait l'heure du minimum au lieu du niveau.

### Ajouté (interface du planning, en cours)

- **L'écran « Planning de la semaine »** (3.6). Le dernier calcul avec son
  déclencheur et ses hypothèses, six cartes de résumé, le budget d'eau par
  chaîne, les sept jours avec leurs propositions : créneau, matériel, dose,
  volume ou « volume inconnu », pompe ou « non vérifiée », statut, et d'un
  clic la justification et les planches avec leur besoin avant et après.
  « Valider », « Ajuster » — déplacer le début, réduire ou augmenter la dose,
  la durée suit — et « Refuser » par proposition ; « Valider les N
  propositions du jour » ; « Valider toute la semaine » ; « Ajouter un
  créneau à la main » qui ouvre le formulaire « Planifier ». La liste « Non
  placé » donne chaque planche non servie avec son motif. Les réglages R1 à
  R12 se règlent à l'écran, avec leur historique. Parcours navigateur P10 aux
  deux largeurs. Le moteur (3.5) attend encore sa recette réelle avec cet
  écran.

### Ajouté (moteur de planning, en cours)

- **Valider une proposition, refuser, calculer, régler, et le recalcul
  quotidien** (3.5, troisième PR). Une proposition validée devient une
  irrigation planifiée ordinaire par le circuit de « Planifier » : pompe
  vérifiée, limite journalière vérifiée, matériel et position tels qu'ils
  sont à cet instant — sinon « recalculez le plan » ; le registre retient
  l'irrigation créée. Les actions serveur valident une, plusieurs ou toutes
  les propositions données, chacune avec sa réponse. Le planning se
  recalcule chaque matin après la météo, exploitation par exploitation.
  Aucun écran ne les appelle encore : c'est l'interface du planning (3.6).

- **Le registre du planning et son service** (3.5, seconde PR, migration
  `0017`) : réglages avec leur journal, calculs, propositions avec leurs cinq
  statuts. Un calcul remplace les propositions non décidées du précédent et
  garde les décidées ; une proposition se décide une fois. Le service
  assemble les irrigations de la semaine, la météo, l'eau, les pompes, le
  matériel, les limites, les réglages et l'arbitrage validé, et fait tourner
  le moteur. Rien n'est encore affiché ni validable à l'écran.

### Corrigé

- Le fournisseur météo configuré utilisait une propriété de paramètre
  TypeScript que Node ne sait pas retirer : tout service lisant le tableau de
  bord de l'eau était intestable sous Node. Champ explicite, sans changement
  de comportement.

- **Le domaine du moteur de planning hebdomadaire** (3.5, première PR,
  `lib/domain/planning/`) : réglages R1 à R12 avec leurs valeurs de départ,
  plages horaires, demande par planche et par matériel, réserve et pompe dans
  le temps, limite journalière, pénurie selon les trois conduites et
  l'arbitrage 3.4, placement des créneaux avec justification et motif de
  chaque manque. Fonction pure et déterministe ; treize tests dont deux cents
  semaines d'invariants et une semaine de 138 planches en 330 ms. Rien n'est
  encore enregistré ni affiché.

### Ajouté (cadrage du planning)

- **Contrat du planning hebdomadaire** (`docs/planning-contract.md`, cadrage
  3.5.0, sans code), écrit le 29 septembre 2026 pour le porteur avec les
  chiffres de la ferme : ce que le planning propose, à partir de quoi, dans
  quel ordre, sous quelles contraintes opposables, comment il se conduit en
  pénurie, ce qu'il explique, ce qu'il ne fait jamais ; douze réglages, onze
  scénarios chiffrés, douze questions à trancher. Les douze tranchées par le
  porteur le jour même (D-024) : le cadrage est validé, le moteur commence.

### Ajouté (extension séries)

- **La vue « Séries » des cumuls** (5.1, troisième PR) : un commutateur « Par
  périmètre / Par série » dans « Cumuls et historique » ; une carte par série
  en cours ou terminée avec implantation, dernière récolte, planches, période
  observée, irrigation, pluie, objectif, écart et ET0, et son détail par
  planche ; les séries à venir à part ; les séries en bloc et sans
  implantation absentes mais comptées ; un message quand le plan de culture
  n'a pas été lu. L'export CSV gagne la colonne « Séries ». Le parcours P9
  joue le tout aux deux largeurs.

- **Les périodes d'occupation et les cumuls par série se calculent** (5.1,
  seconde PR) : implantation à la plus précoce des tâches de semis direct ou
  de plantation, réalisée si cochée sinon planifiée ; fin à la dernière
  récolte, réalisée sinon attendue ; à venir, en cours, terminée ; en bloc et
  sans implantation ignorées et comptées. Chaque série reçoit la totalité des
  millimètres de ses planches sur sa seule période ; les millimètres se
  pondèrent par la surface de planche occupée, les volumes s'additionnent sur
  la surface mouillée de chaque irrigation au prorata du linéaire ; pluie au
  pluviomètre sinon réanalyse, zéro sous abri, absente signalée ; objectif
  proratisé par jour, écart, ET0 à côté. Le service lit les irrigations par
  instants toutes saisons confondues et les objectifs de la saison et de la
  précédente. Rien n'est stocké, rien n'est encore affiché.

- **Le connecteur lit le plan de culture** (5.1, première PR,
  `docs/series-contract.md`) : cinq routes `GET` de plus dans la liste
  blanche — interventions, espèces, séries avec leurs mises en culture,
  emplacements, tâches —, mêmes règles de rythme et de pages, jamais de
  paramètre non écrit dans le code, refus d'une lecture au-delà du plafond de
  pages. L'instantané de la saison porte désormais `cropPlan` : séries et
  espèces nommées, emplacements en mètres, tâches de semis direct et de
  plantation réduites aux champs utiles, compteurs de ce qui a été écarté.
  Les semaines ISO `AAAA-Wss` ont leur module. Les données de démonstration
  portent une succession, une série à venir, une série sans implantation et
  une série en bloc. Rien n'est encore calculé ni affiché.

### Ajouté

- **Chaque irrigation enregistre la surface mouillée de son matériel**, et ses
  volumes s'en déduisent (étape 5.0, seconde PR). La migration additive 0016
  ajoute `wetted_area_square_meters` aux applications d'irrigation et remplit
  les lignes existantes avec leur surface de planche : les volumes déjà
  enregistrés ne bougent pas (D-023). Débit demandé à la pompe, volumes des
  cartes, du journal d'eau, des cumuls et de l'historique, limite journalière
  et eau planifiée des projections lisent désormais cette surface. Une planche
  sans passe-pied renseigné donne un volume inconnu et signalé — jamais un
  volume sur la planche seule — et une irrigation planifiée ou démarrée est
  refusée quand une limite journalière s'applique à ses jours. Le détail d'une
  irrigation montre la surface mouillée retenue et la nature du matériel.

- **Surface mouillée en aspersion, première partie : les projections**
  (étape 5.0, `docs/wetted-surface-contract.md`, D-022). La règle vit en un
  seul endroit du domaine : planche seule en goutte-à-goutte, planche et
  passe-pied en aspersion, inconnue — jamais zéro — sans passe-pied renseigné.
  Le panneau « Apport calculé par heure » compte désormais le passe-pied pour
  une aspersion et signale les planches qu'il ne peut pas compter ; le volume
  du besoin d'une planche se calcule sur la surface du matériel positionné, la
  plus grande quand les deux y sont, la planche seule quand rien n'y est posé ;
  la dose de la faisabilité fait l'aller-retour sur la même surface ; « Voir le
  calcul » et le « Pourquoi ? » montrent la surface retenue et sa provenance ;
  le tableau des besoins se recalcule quand un placement change. Les
  millimètres et leur pondération par la surface de la planche ne bougent pas.
  Les irrigations enregistrées ne bougent pas non plus : leur surface mouillée
  est la seconde partie.

- **Contrat de l'étape 5.0, surface mouillée en aspersion**
  (`docs/wetted-surface-contract.md`), écrit le 28 septembre 2026 : la
  surface de la planche pondère les millimètres, la surface mouillée — planche
  et passe-pied en aspersion, planche seule en goutte-à-goutte — convertit en
  volumes et en débits ; une fonction unique du domaine, une colonne additive
  sur les applications d'irrigation. Les volumes déjà enregistrés restent tels
  quels (D-023). Validé par le porteur le jour même ; aucun code encore.

- **Contrat des séries validé par le porteur le 28 septembre 2026** (D-022) :
  fin de période à la dernière récolte ; surface mouillée selon le matériel,
  planche et passe-pied en aspersion, planche seule en goutte-à-goutte ;
  séries sans implantation et en bloc ignorées sans affichage ; tâches lues
  en une passe sous les quatre appels par seconde. La règle de surface vaut
  aussi pour les planches : un chantier préalable, roadmap 5.0, alignera les
  volumes d'aspersion, qui comptent aujourd'hui la planche seule.

- **Recette 3.4, ligne A5, vérifiée le 28 septembre 2026** sur la version
  déployée : les 5 mm saisis au pluviomètre le 21 septembre sont toujours
  retenus, marqués « mesurée », après l'arrivée de la réanalyse du même jour,
  qui vaut 0 mm. La règle « une mesure de pluviomètre n'est jamais écrasée »
  est éprouvée sur les données réelles ; plus rien n'est en attente dans la
  partie A.

- **Contrat de l'extension « suivi par série culturale »**
  (`docs/series-contract.md`), écrit le 26 septembre 2026 après le déblocage
  de l'API d'Ouvre ta ferme et une reconnaissance sur la ferme du porteur.
  Routes ajoutées à la liste blanche, période d'occupation recalculée depuis
  les tâches (D-021), totalité des millimètres de la planche à chaque série,
  pondération par surface occupée, cas limites rencontrés. Aucun code : le
  contrat précède, et attend la validation du porteur.

- **Un relevé de compteur se corrige depuis l'écran.** Chaque ligne du tableau
  porte « Corriger » à côté de « Supprimer ». Le relevé revient dans le
  formulaire avec son index **non arrondi** — le tableau n'en montre qu'une
  décimale, et recopier ce qu'il affiche perdait des litres — le formulaire
  annonce quel relevé il corrige et offre d'abandonner. La décision de débit
  déjà prise ne bouge pas ; si la correction la rend fausse, le bouton de mise à
  jour reste disponible sur la mesure.

  Le contrat le promettait depuis le 21 septembre 2026 et la persistance savait
  le faire, avec deux tests à l'appui ; seuls manquaient l'identifiant du relevé
  dans l'action de l'écran et le bouton dans le tableau. L'écart a été trouvé en
  ressaisissant les quatre relevés du forage, faute de pouvoir les corriger.

### Corrigé

- **L'heure d'un relevé de compteur était lue en UTC, pas à l'heure de la
  ferme.** Le champ « date et heure » ne porte aucun fuseau, et l'action qui
  enregistre le relevé tourne dans le Worker, dont le fuseau est UTC : « 06:00 »
  y devenait six heures UTC, soit huit heures à la ferme. L'été, un relevé fait
  à l'instant était donc refusé comme **daté dans le futur** — le geste normal
  au forage ne passait pas — et un relevé plus ancien était enregistré deux
  heures trop tard. Les débits restent justes, le décalage étant le même sur
  tous les relevés.

  La saisie est désormais lue à l'heure de la ferme par
  `instantFromIrrigationDateTimeInput`, exact inverse du pré-remplissage. La
  conversion « heure d'horloge de la ferme → instant » n'existe qu'en un seul
  endroit, `localDateTimeUtc`, où elle servait déjà à minuit. Un test la rejoue
  dans un processus forcé en UTC, c'est-à-dire dans les conditions du Worker.

  Constaté par la recette réelle du forage, 3.1 bis, le 25 septembre 2026.
  Aucun test ni parcours ne pouvait le voir : ils tournent tous sur une machine
  à l'heure de la ferme, où serveur et navigateur partagent le fuseau.

- **Un relevé refusé ne disait pas qu'il l'était.** La réponse de l'écran
  s'affiche en haut de la section « Ressources en eau », six cents pixels
  au-dessus du bouton sur ordinateur et bien plus loin sur téléphone ; et le
  formulaire vidait l'index dans tous les cas, succès ou refus. Le relevé
  semblait avoir été pris, puis perdu. La réponse est désormais reprise sous le
  bouton, et les champs ne se vident qu'une fois le relevé accepté. Le parcours
  P5 enregistre un relevé refusé et vérifie les deux.

- **Deux formats de date mêlés dans l'en-tête de la faisabilité.** La semaine
  s'affichait en format brut, `2026-09-21 au 2026-09-27`, à côté d'une date de
  calcul déjà à la française. Les deux le sont désormais, à midi UTC pour que la
  date métier ne glisse pas d'un jour selon le fuseau. Le parcours P7 le
  vérifie.

- **Les matériels archivés ne comptent plus comme « positionnés ».** Un matériel
  archivé garde sa position, et l'inventaire annonçait donc plus de positions
  que de matériels actifs — « 34 matériels actifs … 37 positionnés ». Le
  parcours P8 le vérifie en archivant un matériel encore posé.

- **Une écriture réussie pouvait être annoncée comme un échec.** Archiver un
  matériel affichait « Ce matériel est introuvable », retirer la position d'une
  aspersion répondait « Aucune position enregistrée » — dans les deux cas
  l'opération avait bien eu lieu en base. Les dépôts décidaient du succès en
  lisant `meta.changes`, que le D1 réel ne renseigne pas toujours là où
  l'adaptateur SQLite des tests le fait : aucun test de persistance ne pouvait
  le voir, l'adaptateur étant plus complaisant que le vrai moteur.

  `db/write-result.ts` nomme le piège et le désamorce : `aEcritUneLigne`
  consulte `changes` **et** `rows_written`. Les cinq endroits concernés
  l'utilisent — archivage et renommage d'un matériel, suppression d'un
  matériel, d'un réglage, d'une position et d'un groupe de jardins. Le même
  contournement existait déjà dans `weatherRefreshClaimed`, écrit sans être
  nommé ; il a maintenant un nom et une raison écrite.

### Ajouté

- **Huitième parcours navigateur : poser, déplacer et retirer une aspersion**
  (`e2e/p8-placer-une-aspersion.spec.ts`). Le placement était le dernier écran
  sans filet. Il éprouve l'ancrage entre deux planches et la portée qui décide
  seule des planches atteintes — le profil s'arrête à 1 m, les voisines
  immédiates sont arrosées, la troisième non —, le déplacement qui libère les
  anciennes planches, et le retrait de la position. C'est lui qui a révélé le
  défaut corrigé ci-dessus.

### Vérifié

- **La recette réelle du forage, sous-tranche 3.1 bis, est close**, le
  25 septembre 2026. Le porteur a relevé son compteur quatre fois entre le 11 et
  le 24 septembre et appliqué la mesure du 24 comme référence ; les vingt-six
  lignes ont été relues sur la version déployée, chaque chiffre recalculé. Trois
  défauts y ont été trouvés, tous corrigés le même jour, et les deux lignes
  qu'ils tenaient en échec revérifiées après déploiement. C'est la première fois
  qu'une recette rapporte un défaut qu'aucun test ni parcours ne pouvait voir.

- **La recette utilisateur de la sous-tranche 3.4 est close**, le 25 septembre
  2026, entièrement passée en quatre séances du 20 au 25 septembre et **sans un
  seul défaut bloquant**. Partie A le 21, parties B et C le 24, groupe B6 le 25.
  Deux lignes seulement, B2.2 et C2, n'avaient pas de cas à observer sur cette
  ferme à cette période.

  B6, la faisabilité à 390 px, a été partagée selon la règle qu'on s'est donnée :
  la part mesurable au parcours P7, qui la revérifie à chaque exécution, et le
  geste sur l'appareil au porteur, que rien n'émule. L'assistant a provoqué la
  pénurie sur la ferme réelle à sa demande — 1,00 m³ disponible pour 54,645 m³
  de besoins, 164 cases « Servir » —, le porteur a vérifié sur son téléphone,
  puis tout a été rétabli et revérifié.

  Le point ouvert 1 du registre d'état est fermé. Il ne reste, pour clore D-016
  et la sous-tranche Q0, que la suppression de l'ancien site OpenAI Sites à
  partir du 3 octobre.

### Ajouté

- **Septième parcours navigateur : l'écran d'arbitrage de la pénurie**
  (`e2e/p7-arbitrage-penurie.spec.ts`), le 25 septembre 2026. C'est l'écran où
  un clic engage de l'eau, et il n'avait aucun filet : la recette 3.4 l'avait
  constaté, et sa ligne B6 restait à faire à la main. Le parcours provoque la
  pénurie, la rend, et vérifie aux deux largeurs la phrase de disponibilité, les
  cases « Servir », la décision datée, l'absence de débordement horizontal à
  chaque étape et des cibles tactiles d'au moins 44 px. B6 passe de « à faire »
  à « partiel » : la mise en page est tenue par la CI, le geste sur l'appareil
  reste au porteur, les parcours envoyant des clics et non des touchers.

  Trois leçons écrites au contrat des parcours : un parcours crée sa propre
  situation au lieu d'hériter de celle du voisin — celui-ci coupe ses propres
  ressources puis les rétablit, le besoin manuel étant plafonné à 500 mm ; son
  premier geste doit viser un élément qui ne répond que sous React, un
  `<details>` natif s'ouvrant même avant l'hydratation et déclenchant alors un
  avertissement qui fait échouer le contrôle de console ; et la seconde largeur
  hérite de la décision de la première, ce que l'assertion doit admettre.

### Fonctionnalité

- **Changer le réglage appliqué à un matériel sans passer par « Déplacer »**,
  demandé par le porteur : « en général, une rampe d'aspersion n'est pas
  déplacée lorsqu'on modifie le réglage. Ça doit être deux actions distinctes. »
  Une liste « Réglage appliqué » sur la fiche d'un matériel posé qui possède au
  moins deux réglages ; le choix s'applique aussitôt et la faisabilité se
  recalcule. Contrat écrit avant le code
  (`docs/equipment-setting-change-contract.md`).

  Le point qui aurait pu tout compliquer ne se pose pas : les planches couvertes
  ne sont pas recopiées au placement. Une aspersion les déduit de l'ancrage et
  du profil, un goutte-à-goutte les tient de sa sélection, que le réglage ne
  touche pas. Changer le seul `setting_id` suffit donc, et la couverture suit.

  Deux tests de persistance — seul le réglage bouge, et les refus tiennent :
  réglage étranger au matériel, matériel sans position, autre propriétaire,
  autre saison. Et un sixième parcours navigateur, `p6-changer-le-reglage`, qui
  a immédiatement servi : il a révélé que la liste faisait déborder la page à
  390 px, la fiche étant une grille à colonnes fixes. Corrigé avant la fusion.

### Données

- Couverture hydraulique de la ferme portée à **100 %** le 24 septembre 2026,
  à la demande du porteur, après le constat de la recette 3.4 : 139 planches
  sur 164 n'avaient ni pompe, ni origine, ni liaison. Le matériel réel a été
  saisi **avec le seul outil existant**, sans une ligne de code ni aucune
  requête ad hoc — douze rampes d'aspersion mobiles (une par jardin de plein
  champ non encore couvert), quinze goutte-à-goutte mobiles à 14 mm/h, et
  quatre goutte-à-goutte fixes à 10 mm/h, un par tunnel. Trente-quatre
  matériels actifs, tous positionnés et rattachés à la pompe ; « Dont chaîne
  connue » égale désormais la totalité du besoin. Le moteur de planning 3.5
  travaillera sur une ferme entièrement raccordée.

- Correction le même soir, sur relecture du porteur : **l'irrigation sous serre
  est de l'aspersion, non du goutte-à-goutte**. Son matériel « Rampe de serre »
  (aspersion, fixe, portée 8 m) est posé sur le tunnel 1 et dupliqué pour les
  trois autres ; mes quatre goutte-à-goutte de tunnel sont retirés. Inventaire
  final : 34 matériels actifs, 18 en aspersion, 16 en goutte-à-goutte,
  couverture confirmée toujours 100 %.

### Ajouté

- Test de persistance : **modifier le réglage d'un matériel ne réécrit pas une
  irrigation déjà enregistrée** (D-006). Une irrigation réalisée sous un
  goutte-à-goutte à 10 mm/h, puis le même réglage porté à 25 mm/h : les
  millimètres apportés ne bougent pas, chaque planche garde son débit d'origine,
  et la copie du réglage archivée avec l'événement vaut toujours 10 mm/h.
  Demandé par le porteur, qui a voulu que la règle soit éprouvée et non
  seulement affirmée sur la foi d'un commentaire. Ligne M7 de
  `docs/recette-materiel-reglages.md`.

### Constaté

- **Les réglages d'un matériel sont modifiables après sa pose**, et la
  modification se propage au plan sans nouvelle position : vérifié le
  24 septembre 2026 sur une rampe positionnée. La crainte du porteur était
  infondée, mais elle a révélé que ni recette ni parcours navigateur
  n'éprouvaient cette capacité. Nouveau protocole
  `docs/recette-materiel-reglages.md` ; la vérification décisive reste à faire —
  qu'une modification de réglage ne réécrive pas une irrigation déjà
  enregistrée (D-006).
- Deux défauts mineurs, non bloquants, consignés en D de la recette 3.4 :
  archiver un matériel affiche « Ce matériel est introuvable » alors que
  l'archivage réussit ; et les matériels archivés restent comptés dans
  « positionnés », d'où plus de positions que de matériels actifs.
- Le chevauchement d'aspersion sur une planche à la frontière de deux jardins
  n'est **pas** un défaut : il découle des groupes de jardins alignés, et
  l'écran l'explique matériel par matériel.

### Vérifié

- Recette 3.4, parties B et C, le 24 septembre 2026 sur le site privé et les
  données réelles de la ferme : **vingt vérifications sur vingt-deux passent,
  aucun défaut**. L'arbitrage manuel de la pénurie tient sur tous ses points
  délicats — même fraction du besoin pour chaque planche retenue, reliquat
  redescendu aux priorités inférieures quand rien n'est retenu, décision
  conservée après rechargement, allocations remises à zéro dès qu'un changement
  de priorité rend la décision caduque. B2.2 et C2 n'ont pas de cas à observer
  sur cette ferme cette semaine ; la ligne B6, à 390 px sur un vrai téléphone,
  reste au porteur et ferme le point ouvert 1.

  Les constats ont été relevés par l'assistant dans le navigateur du porteur,
  qui lui en avait donné l'accès et l'autorisation de modifier les données, le
  logiciel n'étant pas en service opérationnel. La recette nomme qui a constaté
  quoi : l'assistant prend le constat, le porteur garde le jugement.

  Deux écarts au protocole y sont motivés : la pénurie a dû être créée en
  vidant la réserve et en rendant le forage indisponible, des planches de 24 m²
  ne pouvant pas produire de pénurie par un besoin manuel réaliste ; et les deux
  planches ont été montées en priorité haute, faute de priorité inférieure
  observable. Tout a été remis en état et revérifié.

  Trois constats annexes non bloquants : 139 planches sur 164 sans chaîne
  hydraulique définie, deux formats de date mêlés dans l'en-tête de la section,
  et aucun parcours navigateur sur l'écran d'arbitrage.

### Ajouté

- 3.1 bis, sixième PR le 22 septembre 2026 : le suivi des consommations, ajouté
  à la demande du porteur. Sous le graphique, le volume réellement sorti de la
  ressource est cumulé par mois civil, avec un total sur la période affichée et,
  quand une limite de prélèvement est active, la part qu'il occupe dans le
  volume autorisé. Le volume d'une mesure est porté au mois de son relevé
  d'arrivée sans répartition au prorata : répartir supposerait un débit constant
  sur l'intervalle, ce qui est faux. La part de l'autorisé est présentée comme
  une enveloppe et non comme une preuve de conformité, une limite journalière
  pouvant être dépassée un jour sans que le total du mois le montre. Quatre
  tests, quatre lignes de recette, et le cinquième parcours navigateur étendu.

- 3.1 bis, cinquième PR le 22 septembre 2026 : protocole de recette réelle
  (`docs/recette-3.1bis.md`), vingt-deux vérifications sur le forage de la
  ferme en deux passages. C'est la seule partie de la preuve de fin que ni les
  tests ni les parcours ne peuvent faire à la place du porteur. Cinq
  vérifications portent sur le tableau des relevés lui-même, ajoutées à la
  demande du porteur : la première version se contentait de constater qu'un
  relevé apparaissait. Une sixième PR ajoutera le suivi des consommations,
  également à sa demande.

- 3.1 bis, quatrième PR le 22 septembre 2026 : l'écran de saisie et son
  parcours navigateur. Panneau « Relevés de débit » ouvert depuis la fiche
  d'une ressource : saisie pensée pour le forage, résultat de la mesure, bouton
  « Mettre à jour le débit de la ressource » portant l'écart en clair,
  graphique du débit au fil du temps et historique des relevés. Le débit
  appliqué est recalculé côté serveur à partir des deux relevés désignés,
  jamais repris du navigateur. Le cinquième parcours navigateur rejoue
  l'exemple du cahier des charges dans un vrai navigateur, aux deux largeurs ;
  il est livré avec l'écran plutôt que dans la PR suivante, et il a révélé deux
  défauts avant toute relecture.

- 3.1 bis, troisième PR le 22 septembre 2026 : la persistance des relevés.
  Migration additive `0015_resource_meter_readings.sql` (deux tables),
  `db/schema.ts` mis à jour et test de dérive vert, dépôt
  `db/water-resource-flow-repository.ts` et ses treize tests d'exécution sur
  SQLite. Un relevé se corrige et se supprime ;
  une révision de débit, qui est une décision, ne se réécrit pas. Deux
  vérifications d'isolation : les relevés d'un propriétaire restent invisibles
  aux autres, et appliquer un débit sur la ressource d'un tiers est refusé.

- 3.1 bis, deuxième PR le 22 septembre 2026 : le module de calcul du débit
  (`lib/domain/resource-flow.ts`) et ses quatorze tests. Domaine pur, sans base
  ni écran. L'exemple du cahier des charges est figé par un test : 9 m³ en huit
  heures de marche sur vingt-quatre écoulées donnent 1,125 m³/h en
  fonctionnement et 0,375 m³/h en moyenne sur la période. Précision ajoutée au
  contrat : un relevé rattrapé après coup est vérifié des deux côtés, parce
  qu'en s'intercalant il raccourcit l'intervalle du relevé suivant.

- Sous-tranche 3.1 bis engagée le 21 septembre 2026, première PR : contrat de
  mesure du débit des ressources (`docs/resource-flow-contract.md`), écrit
  avant le code. Il fixe ce qu'on relève, les calculs, les cas refusés, le
  débit de référence, l'historique sur douze mois ou plus et son graphique, la
  persistance et la preuve de fin. Quatre décisions du porteur y sont
  consignées, dont la plus structurante porte sur la place de la décision :
  une mesure ne change jamais le débit de référence toute seule, et un bouton
  « Mettre à jour le débit de la ressource » placé sous le résultat l'applique.
  Une validation dans un écran séparé s'oublierait et laisserait la faisabilité
  tourner sur un chiffre périmé ; au moment de la mesure, elle ne s'oublie pas.

- Recette 3.4, partie A close le 21 septembre 2026 : la synchronisation météo
  automatique est confirmée en conditions réelles, deux matins consécutifs à
  06:15 sans aucune action du porteur. La date trompeuse de la ligne A2 est
  revérifiée et corrigée. La règle D-019 est éprouvée sur les données réelles
  de la ferme : un besoin chiffré remplace « Non calculable ». Le point ouvert
  2 du registre d'état est fermé. Reste en attente, vers le 26 septembre : la
  conservation d'une pluie saisie au pluviomètre à l'arrivée de la réanalyse.

- Sous-tranche Q6 close le 21 septembre 2026, en neuf PR : la règle des 600
  lignes passe en erreur, avec un test qui lit le dépôt réel et non un extrait.
  Sept fichiers ont été découpés en soixante et un modules, plus quatre modules
  de types descendus dans le domaine. Aucune ligne de code modifiée.
  **Le socle qualité est entier, de Q0 à Q6** : tout le code écrit à partir de
  maintenant est protégé dès sa première ligne par les tests de persistance,
  les frontières outillées, les parcours navigateur et la limite de taille.

- Q6, huitième PR le 21 septembre 2026 : la feuille de style, 5 137 lignes,
  devient dix-huit fichiers dans `app/irrigation/styles/`, un par composant.
  Aucune déclaration modifiée, aucune règle déplacée : le point d'entrée ne
  garde que la liste des `@import`, dans l'ordre d'origine. La feuille produite
  par la compilation est identique octet pour octet, empreinte du fichier
  comprise — le navigateur reçoit exactement les mêmes octets qu'avant. Deux
  tests gardent le découpage : la liste des imports couvre exactement les
  fichiers présents, et aucun ne dépasse 600 lignes.

- Q6, septième PR le 21 septembre 2026 : l'explorateur du plan passe de 1 409 à
  454 lignes. Six modules dans `app/irrigation/hierarchy/` : le hook de
  placement, la carte du plan avec son glisser-déposer et son menu, le bandeau
  de placement, la vue de couverture, le détail d'une planche et les formats.
  Plus aucun fichier du projet ne dépasse la limite de 600 lignes. Aucune ligne
  de l'original n'a disparu ; les seuls ajouts sont le raccordement du hook.

- Q6, sixième PR le 21 septembre 2026 : le composant d'irrigation passe de
  1 459 à 545 lignes. Neuf modules dans `app/irrigation/irrigation-manager/` :
  trois hooks (horloge de la ferme, notifications, calculs du formulaire), les
  formats d'affichage, le signal de fin, et quatre fichiers de composants.
  L'état reste la propriété du composant principal ; les hooks reprennent les
  noms d'origine à la déstructuration, si bien que ni les calculs ni l'affichage
  ne changent d'une ligne. Aucune ligne de l'original n'a disparu ; les seuls
  ajouts sont le raccordement des hooks. Un changement consigné et sans effet
  observable : deux effets indépendants s'exécutent désormais dans l'ordre
  inverse, l'écoute du retour à l'écran avant l'enregistrement du service
  worker.

- Q6, cinquième PR le 21 septembre 2026 : les actions d'irrigation allégées de
  cinq modules extraits dans `app/irrigation/irrigation-event/` — vocabulaire,
  validation, horaires, limites, messages. La directive `'use server'` reste
  sur le seul fichier d'actions ; les modules extraits sont des modules
  ordinaires, ce qui permet d'y garder des fonctions non asynchrones. Aucune
  ligne de code modifiée, vérifié par comparaison ligne à ligne. La
  sous-tranche passe à neuf PR : le composant d'irrigation prend la sienne,
  une PR de deux mille lignes déplacées n'étant pas relisible.

- Q6, quatrième PR le 21 septembre 2026 : le dépôt des matériels devient sept
  modules dans `db/equipment/` (lecture, matériel, réglages, duplication,
  propriété, lignes, erreurs) et le module d'historique six modules dans
  `lib/domain/irrigation-history/` (vocabulaire, dates, période, portée,
  cumuls, lignes). Aucune ligne de code modifiée, vérifié par comparaison
  ligne à ligne. Neuf fonctions devenues inutilement publiques redeviennent
  locales, `knip` les ayant signalées. Les trois fichiers restants sont tous
  dans l'interface.

- Q6, troisième PR le 21 septembre 2026 : le dépôt des irrigations, 1 284
  lignes, devient dix modules dans `db/irrigation-event/`, rangés selon le
  cycle de vie d'une irrigation : lignes SQL, propriété, conflits, journal,
  alarmes Push, lecture, création, minuteur, fin. Aucune ligne de code
  modifiée, vérifié par comparaison ligne à ligne entre l'ancien fichier et la
  réunion des nouveaux.

- Q6, deuxième PR le 21 septembre 2026 : les types d'enregistrement descendent
  de `db/` vers `lib/domain` (décision D-020). Quatre modules de types créés
  dans le domaine, trente et un fichiers réécrivant leurs imports, aucun champ
  modifié. La tolérance ESLint qui autorisait le domaine à lire `db/` en type
  est retirée et le test de frontières devient un cas de refus ; les dépôts
  perdent 119 lignes nettes de déclarations.

- Q6, première PR le 21 septembre 2026 : contrat de découpage des fichiers
  concentrateurs (`docs/file-splitting-contract.md`), rédigé avant le code.
  Il fixe ce qu'un découpage ne change jamais, la méthode propre à chaque
  famille de fichier (dépôts, composants React, domaine, feuille de style), la
  preuve exigée à chaque PR et l'ordre des huit PR de la sous-tranche.
  Décision D-020 : les types d'enregistrement descendent de `db/` vers
  `lib/domain`, ce qui ferme l'exception laissée par Q3.

- Sous-tranche Q5 close le 20 septembre 2026 : les quatre parcours navigateur
  du contrat sont écrits et joués à chaque PR, aux deux largeurs, avec remise à
  zéro de la base locale, météo de démonstration et conservation des traces en
  cas d'échec. Dernier parcours ajouté : cumuls, changement de période, détail
  et export CSV vérifié jusqu'à son encodage.

- Q5, troisième PR le 20 septembre 2026 : parcours navigateur « planifier puis
  annuler » et « saisir une irrigation déjà réalisée », avec le cas refusé
  d'une fin antérieure au début.

- Q5, deuxième PR le 20 septembre 2026 : premier parcours navigateur métier,
  irriguer maintenant avec minuteur, de la création du matériel jusqu'à
  l'irrigation terminée, en passant par un rechargement de page qui vérifie que
  le minuteur survit.

- Q5, première PR le 20 septembre 2026 : socle des parcours navigateur.
  Contrat `docs/browser-journeys-contract.md`, mode déterministe avec le
  fournisseur météo de démonstration derrière `WEATHER_DATA_SOURCE=mock`,
  remise à zéro scriptée de la base locale (`pnpm e2e:reset`), harnais
  Playwright à 1 280 px et 390 px avec contrôle du débordement horizontal et
  des erreurs de console, job d'intégration continue séparé conservant traces
  et captures.

- Ordre d'exécution modifié le 20 septembre 2026, à la demande du porteur : Q5
  et Q6 passent devant 3.1 bis et 3.5.0, afin que le socle soit entier avant
  qu'une ligne de code nouvelle ne s'écrive.

- Sous-tranche Q4 close le 20 septembre 2026 : Tailwind retiré, migrations et
  Drizzle tranchés (D-018), types Workers, chaîne Vite et Vinext, React et Web
  Push montés par lots, serveur de développement local réparé, six PR
  Dependabot fermées. Le socle qualité est acquis de Q0 à Q4 ; restent Q5 et
  Q6.

- Q4, sixième PR le 20 septembre 2026 : `@block65/webcrypto-web-push` `2.0.0`
  dans le Worker Push, sans changement de code, et deux tests appelant le vrai
  chiffrement, jusque-là remplacé par un leurre. PR Dependabot #6 fermée.

- Q4, cinquième PR le 20 septembre 2026 : lot React. `react`, `react-dom`,
  `react-server-dom-webpack`, `@types/react` et `@types/react-dom` en `19.3.0`.
  Rendu vérifié identique avant et après, 1 575 éléments à 1 280 px et à
  390 px. Deux alertes de vulnérabilité levées. PR Dependabot #4 et #43 fermées.

- Q4, quatrième PR le 20 septembre 2026 : lot Vite. `vite` `8.3.0`, `vinext`
  `1.0.0-beta.10`, `@cloudflare/vite-plugin` `1.56.0`, `@vitejs/plugin-rsc`
  `0.5.35`, `wrangler` `4.135.0` partout et types Workers `5.20260918.1`. Le
  serveur de développement local redémarre sans contournement et quatre alertes
  de vulnérabilité sur `vite` sont levées. PR Dependabot #13 fermée.

- Roadmap le 20 septembre 2026 : colonne « Modèle · effort » revue à la demande
  du porteur. Quatre critères écrits décident du modèle et de l'effort, chaque
  sous-tranche à venir porte sa justification, et dix d'entre elles passent de
  Fable 5.1 à Opus 5. Les règles agronomiques, l'isolation des données et
  l'identité restent en Fable 5.1.

- Q4, troisième PR le 20 septembre 2026 : types Cloudflare Workers
  `4.20260515.1` vers `5.20260916.1`, sans changement de code. PR Dependabot
  #12 fermée au profit de cette branche.

- Recette 3.4, décision D-019 du 20 septembre 2026 : un besoin est toujours
  chiffré. La pluie d’un jour écoulé est la mesure du pluviomètre, sinon la
  réanalyse, sinon la prévision enregistrée pour ce jour, sinon zéro ; celle
  d’un jour à venir est sa prévision, sinon zéro. Les jours sans pluie réelle
  sont listés, ceux repris de la prévision étant distingués, et l’interface
  affiche « partiel » avec ces dates. Seul un objectif absent laisse un besoin
  non calculable.

- Q4, deuxième PR le 19 septembre 2026 : contrat des migrations
  `docs/migrations-contract.md` (D-018) ; `drizzle-orm` en dépendance de
  développement ; interdit « migration fusionnée modifiée ou destructive »
  dans `AGENTS.md`.

- Q3, quatrième PR le 19 septembre 2026 : journaliseur unique
  `lib/adapters/log.ts`, `knip` en dépendance de développement et en CI
  (fichiers, exports et dépendances inutilisés bloquants). Q3 close.
- Q3, troisième PR le 19 septembre 2026 : module unique de conversion
  d'unités `lib/domain/units.ts`, soixante-deux facteurs remplacés sans
  changement de résultat, règle interdisant les facteurs d'unités hors du
  module avec ses tests.
- Q3, deuxième PR le 19 septembre 2026 : règles ESLint d'import par zone
  avec message renvoyant au contrat, `max-lines` à 600 en avertissement,
  huit tests exécutant ESLint sur des cas négatifs et positifs ; erreur d'API
  OTF, journée du tableau de bord, export d'historique et contrat de
  synchronisation météo rapatriés dans le domaine.
- Q3, première PR le 19 septembre 2026 : contrat des frontières
  (`docs/boundaries-contract.md`) et `lib/` réparti en trois zones,
  `lib/domain` (règles pures), `lib/services` (orchestration) et
  `lib/adapters` (OTF, météo, démonstration), par déplacement des modules et
  réécriture des chemins d'import, sans changement de comportement.

- Registre de reprise (`ETAT_DU_PROJET.md`), roadmap Markdown et décisions
  d'architecture versionnées.
- Consignes `AGENTS.md` pour reprendre une tâche après interruption sans
  rejouer le travail terminé.
- Contrôles continus GitHub pour le lint, le typage, les tests, la compilation
  et les deux Workers Cloudflare.
- Miroir GitHub privé publié avec l'historique complet ; première exécution de
  la CI réussie sur `main`.
- Dépôt interne et miroir GitHub resynchronisés sur la même branche `main`.
- Audit complet du dépôt du 18 septembre 2026
  (`docs/audit-depot-2026-09-18.md`) : contrôles reproduits, écarts classés
  R1 à R7, socle qualité recommandé.
- Roadmap réécrite et validée le 18 septembre 2026 : socle qualité Q1 à Q6,
  sous-tranches 3.3.1, 3.5.0 et 4.7, règle de clôture avec preuves,
  correspondance avec la roadmap Word.
- Roadmap : colonne « Modèle · effort » indiquant, pour chaque sous-tranche, le
  modèle Claude et le niveau d'effort recommandés.
- Q2, sixième PR le 19 septembre 2026 : douze tests d'exécution sur les
  groupes de jardins (copie de saison en saison), les ressources en eau
  (ressources, réserves, limites, corrections de volume, liaisons sans cycle,
  alimentation par défaut) et les pompes (origines, archivage, pompe par
  défaut, usages). Les quinze dépôts sont couverts : Q2 close. Défaut révélé,
  corrigé séparément : retrait de la pompe par défaut d'un matériel refusé par
  une clé étrangère.
- Q2, cinquième PR le 19 septembre 2026 : dix tests d'exécution sur le
  matériel (création, réglages et courbes, modification, archivage,
  duplication, suppressions protégées par l'historique) et les positions (une
  par matériel et saison, règles de type, suppression protégée).
- Q2, quatrième PR le 19 septembre 2026 : douze tests d'exécution sur les
  besoins par planche, les arbitrages (révision de faisabilité, relecture
  idempotente, invalidation), l'historique par période et périmètre, et la
  synchronisation météo nocturne (cibles, verrou, résultat par espace).
- Q2, troisième PR le 19 septembre 2026 : quatorze tests d'exécution sur
  `water-management-repository` (seize fonctions : objectifs hydriques et
  récurrence, préférence et verrou météo, géocodage, valeurs quotidiennes,
  pluie manuelle, limite journalière) et `snapshot-cache` (isolation par
  clé, remplacement, cache illisible ignoré).
- Q2, deuxième PR le 19 septembre 2026 : seize tests d'exécution sur
  `irrigation-event-repository` (treize fonctions exportées) : cycle complet
  au minuteur avec horloge simulée, immuabilité, isolation entre
  propriétaires, révisions optimistes rejetées par les déclencheurs SQL,
  alarmes Push, avertissements ; fixtures créées par les dépôts de matériel.
- Q2, première PR le 19 septembre 2026 : tests d'exécution de la persistance.
  Point d'accès unique à D1 `db/binding.ts` remplaçant `env.DB` dans les
  dépôts, résolveur de modules pour exécuter le code applicatif sous Node,
  adaptateur D1 sur `node:sqlite` rejouant les migrations, tests de
  l'adaptateur, de `workspace-repository` et de dérive de schéma. Contrat
  `docs/persistence-tests-contract.md`.
- Q1 le 19 septembre 2026 : `AGENTS.md` complété avec les règles métier
  invariantes du cahier des charges, les interdits, la définition de
  « terminé » exigeant les preuves, les règles de sécurité et de PR ; modèle
  de PR aligné ; `.nvmrc` (22.13.0) et `.gitattributes` (LF) ; tag
  `v0.1.0` ; branches fusionnées supprimées et suppression automatique
  activée.
- Q0 phase 3, suite du 19 septembre 2026 : premier déploiement automatique
  réussi à la fusion de la PR #27 ; première écriture réelle sur la nouvelle
  base ; plan Workers payant souscrit après une erreur 1102 de limite de
  calcul du plan gratuit (D-017).
- Q0 phase 3 le 19 septembre 2026 : Workers Push et planificateur météo
  repointés sur l'hébergement Cloudflare, jetons partagés et paire VAPID
  régénérés, liaisons de service entre Workers (`IRRIGATION_SITE`,
  `IRRIGATION_PUSH`) car un Worker ne joint pas un autre Worker du même
  compte par son adresse publique, job GitHub Actions « Déploiement
  Cloudflare » après les contrôles sur `main`, procédure de publication
  réécrite. Le site OpenAI Sites n'est plus utilisé.
- Q0 phase 2 exécutée le 19 septembre 2026 : 375 lignes importées de Sites
  vers la base D1 Cloudflare, comptages identiques sur 38 tables, identité du
  propriétaire remappée. Script d'import : tables de plateforme (`__…`)
  ignorées, lots d'insertion bornés à 64 Ko pour respecter la limite D1 de
  100 000 octets par instruction, comptage en sous-requêtes scalaires,
  option `--verify-only`.
- Q0 phase 2 : route temporaire `GET /api/export` réservée au propriétaire
  authentifié (toutes les tables, ou les comptages avec `?mode=counts`),
  module pur `lib/d1-export-import.ts` (format d'échange, ordre d'import par
  clés étrangères, SQL par lots, remappage du propriétaire, comparaison des
  comptages, huit tests dont un aller-retour sur le vrai schéma) et script
  `scripts/import-d1-export.ts` exécutant l'import par Wrangler avec
  vérification des comptages.
- Q0 phase 1 : cible de déploiement Cloudflare à côté de Sites,
  `wrangler.jsonc`, scripts `build:cloudflare`, `deploy:cloudflare`,
  `dev:cloudflare`, `db:migrate:remote` et `db:migrate:local`, fichier
  `.dev.vars.example` ; authentification par Cloudflare Access
  (`app/access-auth.ts`, vérification du jeton dans `lib/access-jwt.ts`,
  quatorze tests), les en-têtes Sites restant acceptés uniquement dans la
  compilation Sites ; Wrangler racine aligné en 4.127.1, version requise pour
  appliquer les migrations comportant des déclencheurs.
- Contrat de la sous-tranche Q0, hébergement pilotable sur Cloudflare
  (`docs/hosting-migration-contract.md`) et décision D-016 : Worker et D1 dans
  le compte du porteur, Cloudflare Access, déploiement par GitHub Actions,
  migration des données et décommission d'OpenAI Sites en quatre phases.
- Procédure de publication (`docs/publication.md`) : fusion GitHub, publication
  manuelle du site sur OpenAI Sites en mode `live`, redéploiement Wrangler des
  Workers uniquement lorsqu'ils changent ; le site en ligne est signalé en
  retard sur `main` dans le registre d'état.
- Protocole de recette utilisateur de la sous-tranche 3.4
  (`docs/recette-3.4.md`) : synchronisation météo automatique, faisabilité,
  arbitrage, revalidation, seuil, smartphone et vérification de la 3.3.1.
- Décisions D-010 à D-015 : ET0 hors du besoin, GitHub source de vérité
  unique, retrait de Tailwind, protection de `main`, validation agronomique
  par le porteur, risque Vinext accepté.
- Protection de la branche `main` activée après passage du compte en GitHub
  Pro ; la CI est désormais bloquante.

### Retiré

- Q4, deuxième PR le 19 septembre 2026 : `drizzle-kit`, le script
  `db:generate`, `drizzle.config.ts` et les instantanés `drizzle/meta/`. La
  génération reposait sur des instantanés incomplets et périmés ; une sonde a
  montré qu'elle proposerait une migration destructive fausse. Les fichiers
  SQL de `drizzle/` restent la vérité du schéma.

- Q4, première PR le 19 septembre 2026 : Tailwind (D-012), soit `tailwindcss`,
  `@tailwindcss/postcss` et la configuration PostCSS de Vite ; la remise à
  zéro des styles du navigateur est recopiée, figée, dans `app/preflight.css` ;
  trois noms de classes sans règle retirés du balisage. Rendu vérifié
  identique avant et après (1 561 éléments à 1 280 px et à 390 px).

- Q3 le 19 septembre 2026 : `db/index.ts` (accès ORM jamais appelé), neuf
  symboles que plus rien n'utilisait et 69 exports jamais importés
  ailleurs, ramenés à des déclarations locales ; cinq copies du journaliseur
  météo.

- Q0 phase 4 le 19 septembre 2026 : code propre à l'hébergement OpenAI Sites
  retiré (`@openai/sites-vite-plugin`, `.openai/hosting.json`, fournisseur
  d'identité par en-têtes Sites, constante `__AUTH_PROVIDER__`, script
  `build:cloudflare`) et route temporaire `GET /api/export` supprimée.
  `vite.config.ts` ne connaît plus qu'une cible, Cloudflare ; scripts
  `build`, `dev`, `deploy`.

### Corrigé

- Quota Ouvre ta ferme le 20 septembre 2026 : le régulateur de débit vivait
  dans chaque client, reconstruit à chaque lecture, si bien que deux lectures
  simultanées cumulaient leurs quotas et dépassaient les quatre appels par
  seconde. Le régulateur est désormais unique pour le module, et une réponse
  `429` impose une seconde de silence sans nouvel essai.

- Recette 3.4, ligne A2, le 20 septembre 2026 : la ligne « Dernière mise à
  jour » du panneau météo comptait les prévisions figées de jours passés et
  annonçait « données anciennes » le matin même d’une synchronisation réussie.
  Elle ne retient plus que les lectures encore utilisées, réanalyses et
  prévisions des jours à venir ; règle précisée dans `docs/weather-contract.md`
  et portée par le domaine.

- Dates des textes Q2 (corrections) et Q3 : les fusions GitHub datent du
  19 septembre 2026, non du 20.

- Retirer la pompe par défaut d'un matériel échouait : le journal des pompes
  recevait « none » comme identifiant, refusé par sa clé étrangère ; il reçoit
  désormais l'absence de pompe. Défaut révélé par les tests de persistance
  (Q2), corrigé le 19 septembre 2026.
- La contrainte `chk_irrigation_bed_need_override` laissait passer un besoin
  calculé mémorisé sans remplacement (comparaison avec NULL indéterminée) :
  migration `0014_bed_need_override_guard`, déclencheurs refusant cet état à
  l'insertion et à la mise à jour.

- Cadence des lectures OTF : au moins 250 ms entre deux départs de requêtes,
  soit quatre appels par seconde au plus, la limite annoncée par l'API, au lieu
  de 200 ms qui en autorisaient cinq.
- Le besoin hebdomadaire par planche repart de l'objectif seul : le
  plafonnement par l'ET0 introduit par la sous-tranche 3.3 est retiré
  (décision D-010, sous-tranche 3.3.1). L'ET0 reste affichée pour information,
  avec sa part réanalysée, sa part prévue et ses jours manquants, et une ET0
  incomplète ne rend plus le besoin incalculable.
- Mise à jour coordonnée de `next` et `eslint-config-next` de `16.2.6` vers
  `16.3.5`, validée avec Vinext par la recette complète et les affichages
  ordinateur et mobile.
- Maintien de `@types/node` sur la génération 22 : Dependabot continue de
  proposer les correctifs et versions mineures compatibles, mais diffère les
  changements de version majeure.
- Alignement de `tailwindcss` et `@tailwindcss/postcss` en version `4.3.3`
  afin d'éviter un compilateur CSS et un module PostCSS de versions
  différentes.
- Sérialisation fiable des départs de requêtes OTF : l'intervalle minimal de
  200 ms est désormais respecté même si le minuteur se réveille une
  milliseconde trop tôt ou si plusieurs lectures sont lancées simultanément.
- Synchronisation des formulaires de besoins et des placements sans
  déclencher les alertes React de mise à jour synchrone dans un effet.
- Expiration du délai d'actualisation météo sans mise à jour synchrone d'effet.
- Exclusion du fichier de types Cloudflare généré du lint.

### Ajouté (documentation : charte graphique d'Ouvre ta ferme)

- **`docs/charte-otf.md`** (6 novembre 2026) : relevé, en lecture seule, de la
  charte graphique des pages de production d'Ouvre ta ferme (ordinateur et
  téléphone), comparé au style actuel du module, avec onze recommandations
  d'harmonisation. Aucun code modifié ; rien n'est encore planifié.

## 2026-09 — Tranche 3 en cours

- Ressources en eau et réserves tampon.
- Pompes, origines et contraintes hydrauliques.
- Besoins hebdomadaires par planche et priorités.
- Faisabilité hydrique et arbitrage manuel des pénuries.
- Synchronisation météo automatique côté serveur et cohérence de la semaine
  sélectionnée.

## 2026-09 — Tranche 2 clôturée

- Inventaire, réglages, placements et calculs d'apport.
- Enregistrement, planification et minuteur persistant.
- Notifications Web Push, objectifs, météo, limites, historique et export.
- Recette de sécurité et de non-régression.

## 2026-08 — Tranche 1 clôturée

- Lecture sécurisée GET-only du plan OTF, cache, saisons et dimensions.
- Navigation hiérarchique et représentation graphique du plan de ferme.
