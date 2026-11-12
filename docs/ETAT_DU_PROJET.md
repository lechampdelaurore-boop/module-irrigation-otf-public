# État du projet

Dernière mise à jour : 12 novembre 2026.

Ce document est le point d'entrée d'une reprise de travail. Il décrit l'état
constaté du dépôt, pas une intention. Pour le détail fonctionnel, consulter
`ROADMAP.md` et les contrats spécialisés du dossier `docs`.

## Où on en est

Section courte à lire d'abord à la reprise (AGENTS.md, « Économie de jetons »).
Toute PR qui change l'état du projet la met à jour ; elle ne remplace pas les
registres, elle y renvoie.

- 3.9, scénarios, tests de pénurie, recette et publication : **code
  commencé le 8 novembre 2026 au soir**, en Opus 5.5 · Max, sur le dépôt
  public. Lot 2, une PR `fix/` par règle tranchée (D-052), contrat du
  planning précisé avant le code et test rouge d'abord : **correction 1 sur
  4 en ligne** (#11 de ce dépôt), l'arbitrage validé en parts réservées
  (décision 1, D-077, précisions F72 à F75) ; **correction 2 en ligne** (#12), le
  budget net du manque sous le minimum, la part visée et la part placée
  (décision 2, D-079, précisions F76 à F79, aucune migration) ;
  **correction 3 en ligne** (#13), le report sans bascule d'un calcul à
  l'autre (décision 4, D-080, précisions F80 à F83, aucune migration) ;
  **correction 4 en ligne** (#14), la part du dernier jour (décision 5, D-081,
  précisions F84 à F87, aucune migration). Ensuite l'écran d'arbitrage
  présenté comme un plan d'assolement (2 bis, D-078) : maquette validée par
  le porteur le 9 novembre 2026 à 11 h 40, **en ligne** (#17, D-083,
  précisions F92 à F97, aucune migration). Puis les lots 3 à 7. Ni
  recette finale ni tag `v0.2.0` sans le porteur. Les tests des scénarios
  vont dans `tests/planning-shortage.test.ts` et
  `tests/planning-shortage-scenarios.test.ts` (F98).
- 3.9, lot 3, les scénarios de pénurie en tests du moteur : **en ligne**
  (#18), écrits le 9 novembre 2026 (D-084, F98 à F102), sans changer aucun
  comportement. S2, S4, S10 étendu, S23, S24, S26 et l'isolation S28
  tiennent ; S7, S8 et S9 en partie ; S6 et S20 non. **Huit défauts
  relevés, points ouverts 51 à 58**, à corriger avant la recette finale,
  chacun dans sa PR `fix/`, le contrat précisé et le test rouge d'abord,
  après la PR de ce lot, qui suit celle de l'écran d'arbitrage. Le plus
  sérieux d'abord : la limite journalière d'un arrêté (58) et celle d'une
  ressource (54) dépassées par un créneau à cheval sur minuit. **58, 54 et
  55 corrigés, en ligne** (#19 ; le 9 novembre 2026, D-085, F103 à F107) :
  les limites par jour se jugent depuis le début du
  créneau, qui part à minuit quand son premier jour est plein, et la coupe
  d'une source se nomme « limite de prélèvement ». **57 corrigé, en ligne**
  (#20 ; le 9 novembre 2026, D-086, F108 à F112) : l'eau déjà validée
  compte comme placée dans les parts, et
  valider en pénurie ne refait plus le partage ; le cas limite, un
  arrosage validé au-delà de la part de sa planche, est tranché par le
  porteur le jour même : selon la conduite choisie, l'option codée.
  **56 corrigé, en ligne** (#21 ; le 9 novembre 2026, D-087, F113 à
  F115) : le manque
  d'une planche se partage entre la coupe de sa part, en manque d'eau, et
  son placement. **52 et 53 corrigés, en ligne** (#22 ; le
  9 novembre 2026, D-088, F116 à F119) : une chaîne dont rien ne peut
  venir d'ici dimanche — pompe habituelle archivée, origine inactive ou
  hors de sa période — n'entre dans aucun partage ; ses planches portent
  « origine d'eau ou pompe indisponible », et sa ligne de budget le dit.
  **51 corrigé le 9 novembre 2026** (D-089, F120 à F122), dans une PR qui
  suit celle de 52 et 53 : quand l'eau d'une chaîne servie est inconnue,
  la carte « Manque d'eau » dit « non chiffré », ou « au moins X m³ », au
  lieu d'un zéro. Les huit défauts du lot 3 sont corrigés ; un neuvième,
  relevé en chemin (point 59, le pli des changements d'un recalcul), reste
  à corriger à part.
- Tranche 4, démo guidée (4.0, D-096) : contrat `docs/demo-guided-contract.md`
  **validé par le porteur le 8 novembre 2026**, inscrit aux registres le
  12 novembre 2026 (documents seuls). Code D1 à D4 **après la 3.9**, un seul
  chantier de code à la fois ; D4 (Cloudflare) sur accord exprès du porteur.
- Parcours navigateur : ils écrivent leurs dates à l'heure de la ferme et
  le champ de la pluie mesurée suit le dernier jour choisi (D-082, en ligne
  le 12 novembre 2026, #15) : les points ouverts 49 et 50 sont corrigés. Reste le dimanche soir (point
  ouvert 48) : ni PR ouverte ni contrôle relancé le dimanche après 21 h à
  la ferme, jusqu'à la PR à part qui l'en libérera.
- 3.8, fonctionnalités à la carte : **close par le porteur le 8 novembre
  2026 à 20 h 21**, des modifications restant possibles plus tard, chacune
  par une PR (détail plus bas).
- Économie des minutes GitHub Actions (D-075, #300) : **annulée le
  8 novembre 2026** au passage sur le dépôt public (`866ae13`), dont les
  minutes sont gratuites : contrôles complets sur chaque PR et sur `main`,
  parcours navigateur jamais sautés.
- « Aujourd'hui » en tableau de bord (D-074) : la légende de la frise oubliait
  « Non faite » (retour du porteur du 8 novembre 2026) ; corrigée, elle dit
  seulement les couleurs présentes sur la frise du jour (précision T19).
- Audit ergonomique, lot 3 (3.8 quater, D-076) : contrat validé par le porteur
  le 8 novembre 2026 (`docs/audit-ergonomie-lot3-contract.md`) ; PR 1, le
  planning et les arrosages (points 5 et 6), en ligne (#301, P31a, F52 à
  F61) ; **PR 2, les PR 2 et 3 réunies (points 12, 13, 10, 8 et 14), en
  ligne le 8 novembre 2026 à 18 h 57** (#303 de l'archive, codée en
  Opus 5.5 · Très élevé, parcours P31b et P31c, précisions F62 à F71,
  aucune migration) : espèces à rattacher en tête et « Rattacher comme… »,
  « Observer » sur la réserve du sol, modèles d'alerte et état de
  l'appareil, mots simples, « Aller au contenu », cibles de 44 px et
  contraste mesurés. Le lot 3 est complet ; ses écrans, relus en ligne par
  le porteur, sont validés le 8 novembre 2026 à 19 h 20 (« ça me semble
  bon ») ; ensuite les corrections de la 3.9. Le mode sombre et un lecteur
  d'écran ne sont pas vérifiés (F50).
- Fusionné et déployé sur `main` du dépôt public au 12 novembre 2026 : la
  PR #22 (`e8e2db2`, la correction de l'origine indisponible, points ouverts
  52 et 53, D-088, fusionnée le 12 novembre à 17 h 02 et déployée à 17 h 13,
  run 43254267435, les quatre jobs réussis, aucune migration, Workers
  inchangés). Avant elle : la
  PR #21 (`6ff25e1`, la correction du manque partagé entre l'eau et
  le placement, point ouvert 56, D-087, fusionnée le 12 novembre à 16 h 31
  et déployée à 16 h 45, run 43248783998, les quatre jobs réussis, aucune
  migration, Workers inchangés). Avant elle : la
  PR #20 (`8e3cca4`, la correction de l'eau déjà validée en pénurie, point
  ouvert 57, D-086, fusionnée le 12 novembre à 15 h 59 et déployée
  à 16 h 14, run 43242971980, les quatre jobs réussis, aucune migration,
  Workers inchangés). Avant elle : la
  PR #19 (`833d092`, la correction des limites par jour, points ouverts 54,
  55 et 58, D-085, fusionnée le 12 novembre à 15 h 27 et déployée à 15 h 42,
  run 43237426130, les quatre jobs réussis, aucune migration, Workers
  inchangés). Avant elle : la
  PR #18 (`395b99e`, le lot 3 de la 3.9, les scénarios de pénurie en tests
  du moteur, D-084, fusionnée le 12 novembre à 14 h 58 et déployée
  à 15 h 09, run 43232464948, les quatre jobs réussis, aucune migration,
  Workers inchangés). Avant elle : la
  PR #16 (`77a2c0e`, le contrat de la démo guidée inscrit aux registres,
  Tranche 4, D-096, documents seuls, fusionnée le 12 novembre à 14 h 29 et
  déployée à 14 h 42, run 43227755893, les quatre jobs réussis, aucune
  migration, Workers inchangés). Avant elle : la
  PR #17 (`8d72b49`, l'écran d'arbitrage façon plan d'assolement, 2 bis de
  la 3.9, fusionnée le 12 novembre à 14 h 02 et déployée à 14 h 13,
  run 43223463035, les quatre jobs réussis, aucune migration, Workers
  inchangés). Avant elle : la
  PR #15 (`268adc9`, les parcours à l'heure de la ferme et la pluie du
  dernier jour choisi, points ouverts 49 et 50, fusionnée le 12 novembre
  à 13 h 31 et déployée à 13 h 44, run 43218749629, les quatre jobs réussis,
  aucune migration, Workers inchangés). Avant elle : la
  PR #14 (`5522a04`, la correction 4 de la 3.9, la part du dernier jour,
  fusionnée le 12 novembre à 13 h 02 et déployée à 13 h 14, run 43214382568,
  les quatre jobs réussis, aucune migration, Workers inchangés). Avant elle : la
  PR #13 (`a15f150`, la correction 3 de la 3.9, le report sans bascule d'un
  calcul à l'autre, fusionnée le 9 novembre à 2 h 51 et déployée à
  3 h 23, run 42547789030, les quatre jobs réussis après une relance des
  parcours navigateur (point ouvert 50), aucune migration, Workers
  inchangés). Avant elle : la PR #12 (`87e4ab0`, la correction 2
  de la 3.9, le budget net du manque sous le minimum, la part visée et la
  part placée, fusionnée le 8 novembre à 21 h 49 et déployée à 22 h 03,
  run 42522030186, les quatre jobs réussis, aucune migration, Workers
  inchangés) ; la PR #11 (`187ff6e`, la
  correction 1 de la 3.9, l'arbitrage validé en parts réservées, fusionnée à
  21 h 07 et déployée à 21 h 21, run 42518503747, les quatre jobs réussis,
  aucune migration, Workers inchangés) ; la PR #10 (`775c7cd`, la clôture de
  la 3.8 dans les registres, fusionnée à 20 h 37 et déployée à 20 h 50, run
  42515943412, les quatre jobs réussis, aucune migration, Workers
  inchangés) ; la PR #9 (`fa45281`, le retrait de Dependabot, fusionnée à
  20 h 18 et déployée à 20 h 32, run 42514364088, les quatre jobs réussis,
  aucune migration, Workers inchangés) ; avant elle, `866ae13` (la
  synchronisation avec l'archive au `d350c06` et l'annulation de D-075,
  déployé à 19 h 45, run 42508561331, les quatre jobs réussis, premier
  déploiement depuis le dépôt public). Les numéros de PR du dépôt public
  repartent de #1 ; ceux qui suivent sont de l'archive.
- Fusionné et déployé sur `main` de l'archive, jusqu'à la bascule : toutes
  les PR jusqu'à #303 (`d350c06`, l'audit ergonomique, lot 3, PR 2 : les
  gestes par ligne, les mots simples et l'accessibilité, D-076, fusionnée le
  8 novembre à 18 h 56 et déployée à 18 h 57, run 42507465264, le job de
  déploiement réussi, les contrôles sautés comme le voulait D-075, aucune
  migration, Workers inchangés). Avant elle :
  #302 (`e542313`, la légende de la frise d'« Aujourd'hui », T19, fusionnée
  le 8 novembre à 17 h 50 et déployée à 17 h 51, run 42501901101, le job de
  déploiement réussi, les contrôles sautés comme le veut D-075, aucune
  migration, Workers inchangés). Avant elle :
  #301 (`db8d342`, l'audit ergonomique, lot 3, PR 1 : le planning et les
  arrosages, D-076, fusionnée le 8 novembre à 17 h 23 et déployée à
  17 h 24, run 42499644714, le job de déploiement réussi, les contrôles
  sautés comme le veut D-075, aucune migration, Workers inchangés). Avant
  elle :
  #300 (`dda513c`, l'économie des minutes GitHub Actions, D-075, fusionnée
  le 8 novembre à 16 h 12 et déployée à 16 h 13, run 42493646188, le job de
  déploiement réussi, les trois jobs de contrôle sautés comme le veut
  D-075, aucune migration, Workers inchangés). Avant elle :
  #299 (`ce5c10e`, « Aujourd'hui » en tableau de bord, PR 3 sur 3 : « Tout
  est fait », D-074, fusionnée le 8 novembre à 15 h 40 et déployée à
  15 h 56, run 42490966130, quatre jobs réussis, aucune migration, Workers
  inchangés). Avant elle :
  #298 (`d2cec5f`, « Aujourd'hui » en tableau de bord, PR 2 sur 3 : les
  écrans, D-074, fusionnée le 8 novembre à 15 h 08 et déployée à 15 h 24,
  run 42488341591, quatre jobs réussis, aucune migration, Workers
  inchangés). Avant elle :
  #297 (`77ddaca`, « Aujourd'hui » en tableau de bord, PR 1 sur 3 : le
  contrat et le domaine, D-074, fusionnée le 8 novembre à 14 h 40 et
  déployée à 14 h 53, run 42486074151, quatre jobs réussis, aucune
  migration, Workers inchangés). Avant elle :
  #296 (`fa907af`, les retours du porteur du 8 novembre : « Besoin par
  culture », « Voir le détail » et le résumé de chaque culture, fusionnée
  le 8 novembre à 13 h 49 et déployée à 14 h 03, run 42482021262, quatre
  jobs réussis, aucune migration, Workers inchangés). Avant elle :
  #295 (`a0051fd`, les retours du porteur du 8 novembre :
  « Non placé » replié et l'ordre de « Matériel et placement », fusionnée
  le 8 novembre à 13 h 18 et déployée à 13 h 30, run
  42479629093, quatre jobs réussis, aucune migration, Workers inchangés).
  Avant elle : #293 (`86177d9`, l'audit ergonomique, lot 2, PR 3 : la page
  « Aujourd'hui », la zone « Fiabilité du calcul » et la pastille, 3.8
  quater, D-073, fusionnée le 8 novembre à 12 h 47 et déployée à
  13 h 01, run 42477289518, quatre jobs réussis, aucune migration,
  Workers inchangés). Avant elle : #292 (`8f87145`, l'affichage du
  calculateur, 3.8 bis, D-070, fusionnée le 8 novembre à 12 h 16 et
  déployée à 12 h 30, run 42475030420, quatre jobs réussis, aucune
  migration, Workers inchangés).
  Avant elle : #291 (`8079e0e`, l'audit ergonomique, lot 2, PR 2 : le domaine
  « Aujourd'hui » et « Fiabilité du calcul », 3.8 quater, D-073, fusionnée
  le 8 novembre à 11 h 46 et déployée à 12 h 01, run 42472817833, quatre
  jobs réussis, aucune migration, Workers inchangés). Avant elle :
  #290 (`5fe18a2`, l'audit ergonomique, lot 2, PR 1 : le téléphone,
  3.8 quater, D-073, fusionnée le 8 novembre à 11 h 15 et déployée à
  11 h 30, run 42470683962, quatre jobs réussis, aucune
  migration, Workers inchangés). Avant elle : #289 (`eec491e`, le contrat du lot 2 de l'audit ergonomique, 3.8 quater,
  D-073, documents seuls, fusionnée le 8 novembre à 04 h 48 et déployée à
  05 h 02, run 42444235434, quatre jobs réussis, aucune migration). Avant
  elle : #288 (`777879b`, l'audit ergonomique, 3.8 quater, lot 1, D-072, fusionnée le
  8 novembre à 04 h 16 et déployée à 04 h 29, run 42441986250, quatre jobs
  réussis, aucune migration, Workers inchangés). Avant elle : #287 (`c6c4948`, les créneaux protégés, PR 5 sur 5 : l'écran et le geste
  manuel, 3.8 ter, D-071, fusionnée le 8 novembre à 03 h 17 et déployée à
  03 h 29, run 42437921213, quatre jobs réussis, aucune migration, Workers
  inchangés). Avant elle : #286 (`f9f00ec`, le correctif du journal des
  créneaux protégés, 3.8 ter, fusionnée le 8 novembre à 02 h 54 et déployée à
  03 h 06, run
  42436216237, quatre jobs réussis, aucune migration, Workers inchangés),
  qui a déployé avec elle #285 (`3de7f0b`, les créneaux protégés, PR 4
  sur 5 : les arrosages validés et le réel, 3.8 ter, D-071, fusionnée à
  02 h 27, son passage sur `main` arrêté au job « Application », run
  42434356565, par le défaut que #286 corrige). Avant elles : #284
  (`bd8fb08`, les créneaux protégés, PR 3 sur 5 : la persistance, 3.8 ter,
  D-071, fusionnée le 8 novembre à 01 h 55 et déployée à 02 h 07, run
  42431986012, quatre jobs réussis, migration 0030 appliquée, Workers
  inchangés). Avant elle : #283 (`0343f5a`, les créneaux protégés,
  PR 2 sur 5 : le placement, 3.8 ter, D-071, fusionnée le 8 novembre à
  01 h 31 et déployée à 01 h 40, run 42430142206, quatre jobs réussis,
  aucune migration, Workers inchangés). Avant elle : #282 (`fd1b3d8`, les
  créneaux protégés, PR 1 sur 5 : le module de domaine, 3.8 ter, D-071,
  fusionnée le 8 novembre à 01 h 05 et déployée à 01 h 17, run
  42428151432, quatre jobs réussis, aucune migration, Workers inchangés).
  Avant elle : #281 (`aaa37d1`, le
  calculateur d'irrigation, 3.8 bis, D-070, fusionnée le 8 novembre à
  00 h 11 et déployée à 00 h 24, run 42424125065, quatre jobs réussis,
  migration 0029 appliquée, Workers inchangés). Avant elle : #280
  (`879b84e`, l'audit ergonomique inscrit dans la roadmap, 3.8 quater,
  D-069, documents seuls, fusionnée à 23 h 46 et déployée à 23 h 57, run
  42422143822, quatre jobs réussis). Avant elle : #279 (`bbceef6`, la deuxième passe de la refonte, R4, D-068, fusionnée à
  23 h 22 et déployée à 23 h 34, run 42420295533, quatre jobs réussis,
  aucune migration nouvelle, Workers inchangés ; relecture du porteur le
  8 novembre). Avant elle : #278 (`bd2bc42`, la 3.8, PR 7 : le premier lot de retours du porteur,
  fusionnée à 22 h 16 et déployée à 22 h 28, run 42415089479, quatre jobs
  réussis, migration 0028 appliquée, Workers inchangés). Avant elle : #277
  (`5960c9f`, la deuxième passe de la refonte, D-068, documents et
  maquette seulement, fusionnée à 20 h 22 et déployée à 20 h 34, run
  42405904652, quatre jobs réussis). Avant elle : #276 (`8869646`, la 3.8,
  PR 6 : les bulles « d'où vient ce chiffre »,
  fusionnée à 18 h 07 et déployée à 18 h 20, run 42394736692, quatre jobs
  réussis, aucune migration nouvelle, Workers inchangés). Avant elle : #275
  (`74bd1a7`, la 3.8, PR 5 : le « ? » de chaque page, fusionnée à
  17 h 41 et déployée à 17 h 50, run 42392529016, quatre jobs réussis,
  aucune migration nouvelle, Workers inchangés). Avant elle : #274 (`497d5f5`, la 3.8, PR 4 : les traitements et les notifications suivent
  le choix, fusionnée à 17 h 15 et déployée à 17 h 27, run 42390377633,
  quatre jobs réussis, aucune migration nouvelle, Worker de notification
  redéployé). Avant elle : #273 (`839f9a3`, la 3.8, PR 3 : le choix des fonctionnalités à l'écran,
  fusionnée à 16 h 49 et déployée à 17 h 00, run 42388264208, quatre jobs
  réussis, aucune migration nouvelle, Workers inchangés). Avant elle : #272 (`1378c5b`, la 3.8, PR 2 : une page par fonctionnalité, fusionnée à
  16 h 19 et déployée à 16 h 30, run 42385826439, quatre jobs réussis,
  aucune migration nouvelle, Workers inchangés). Avant elle : #271
  (`3a5ca35`, la 3.8, PR 1 : la liste des fonctionnalités et
  l'enregistrement du choix, fusionnée à 15 h 52 et déployée à 16 h 05, run
  42383665657, migration 0027 appliquée) ; #270 (`735a83c`, le contrat de la 3.8,
  fusionnée à 15 h 21 et déployée à 15 h 36, run 42381207173) ; #269 (`2358846`, la correction du champ
  « Millimètres », fusionnée à 14 h 40 et déployée à 14 h 57, run
  42378028989) ; #268 (`a9ea3e8`, la
  correction des cartes « Annulée », fusionnée à 14 h 02 et déployée à
  14 h 14, run 42375107865) ; #267
  (`32a9d4c`, la correction de l'icône de la page, fusionnée à 13 h 30 et
  déployée à 13 h 42, run 42372809720) ; #266 (`64c2e87`, la
  recette réelle de la 5 quinquies finie, fusionnée à 12 h 47 et déployée à
  13 h 03, run 42369666507) ; #265
  (`14e1998`, le banc commun avec Tlaloc et le partage des rôles,
  fusionnée à 12 h 14 et déployée à 12 h 31, run 42367368734) ; #264 (la refonte, troisième temps, fusionnée à 02 h 48, déployée à
  03 h 05, run 42326030102) ; #263 (`bbde430`, la refonte, deuxième temps,
  fusionnée à 02 h 08 et déployée à 02 h 29, run 42322386746). Les
  précédentes, la même nuit :
  #259 (le contrat des créneaux protégés, déployée à 00 h 27, run
  42306966483, son parcours navigateur arrêté une première fois par sa
  limite de 25 minutes après une installation du navigateur de 11 minutes,
  réussi à la relance) ; #260 (la réception des notifications sur le
  téléphone, fusionnée à 00 h 28, déployée à 00 h 41 avec le Worker Push,
  run 42312105962) ; #257 (la refonte, premier temps, fusionnée à 00 h 42,
  déployée à 00 h 59, run 42313686422) ; #261 (les connexions matériel
  inscrites à la feuille de route, fusionnée à 01 h 08, déployée à 01 h 24,
  run 42316364507) ; #262 (le contrat du pilotage des électrovannes,
  fusionnée à 01 h 33, déployée à 01 h 49, run 42318952452) ; quatre jobs
  réussis chacune. La 3.7 est close par le porteur le 31 octobre 2026, le
  point 31 fermé.
- 3.8, fonctionnalités à la carte et réorganisation de l'interface :
  **redéfinie par le porteur le 7 novembre 2026** (D-067) : un seul mode,
  dix cases à cocher pour toute la ferme, une case décochée ni affichée ni
  prise en compte, ses données gardées ; une page par case. Contrat écrit
  (`docs/feature-selection-contract.md`), douze réponses du porteur, P1 à
  P21 tranchées par la recommandation. **Mandat du porteur (13 h 47)** :
  toute la 3.8 construite en autonomie jusqu'au déploiement, sans maquette ;
  il juge l'ergonomie sur le site en ligne. Les trois petites corrections
  qu'il a voulues avant elle sont faites (#267, #268, #269). Code : sept PR
  (section 10 du contrat), une à la fois. PR 1 (#271, déployée) : la liste
  des cases, leurs règles et l'enregistrement du choix (migration additive
  0027). PR 2 (#272, déployée) : une page par case sous `/irrigation/…`, le
  menu de la charte, saison et parcelle dans l'adresse, les anciennes
  adresses conduites. PR 3 (#273, déployée) : le choix des cases à l'écran
  (première ouverture, Réglages, bandeau, avertissement, pages et blocs
  retirés, données gardées). PR 4 (#274, déployée) : les traitements du
  matin et les notifications lisent le choix de la ferme. PR 5 (#275,
  déployée) : le « ? » de chaque page et les notifications qui ouvrent la
  page de leur case. PR 6 (#276, déployée) : les bulles « d'où vient ce
  chiffre » sur les neuf pages de la section 6. PR 7 (#278, déployée) : le
  premier lot de retours de la visite du porteur en ligne, le 7 novembre au
  soir (P36 à P46 du contrat) : l'ordre du menu, « Reposer » retiré des
  arrosages, le « ? » des groupes de jardins avec un schéma et celui du
  K_abri, l'inventaire du matériel compact, le curseur de la réserve à
  quatre crans, les dessins des espèces d'Ouvre ta ferme, la marge expliquée
  dans Alertes météo, les marges de gel réglables (migration additive 0028)
  et l'historique replié dans Alertes cultures, la semaine du planning en
  tableau sur grand écran ; le porteur a confirmé le 8 novembre que les
  dessins d'Ouvre ta ferme s'affichent en ligne. La deuxième passe de la
  refonte (D-068) a suivi, codée et déployée le 7 novembre au soir (#279).
  **3.8 ✅ close par le porteur le 8 novembre 2026 à 20 h 21** (« On va
  clôturer la 3.8 pour l'instant, quitte à ce que je fasse des modifications
  ultérieurement ») : ses modifications éventuelles passeront chacune par
  une PR. L'écran d'arbitrage d'une pénurie présenté comme un plan
  d'assolement (retour du 7 novembre) est décidé par le porteur le
  8 novembre 2026 à 20 h 40 : dans la 3.9, maquette d'abord.
- 3.8 bis, calculateur d'irrigation : contrat validé par le porteur le
  6 novembre 2026 (`docs/irrigation-calculator-contract.md`, D-061). **Codé
  la nuit du 7 au 8 novembre 2026 sur le mandat du porteur** (« enchaîner les
  chantiers en autonomie »), en une PR (#281, déployée), Opus 5.5 · Élevé :
  une onzième case « Calculateur d'irrigation », qui entraîne Matériel et
  placement et arrive décochée ; le bouton « Calculer depuis le matériel »
  dans le formulaire d'un réglage (goutte-à-goutte par planche ou par vanne,
  aspersion en pluviométrie moyenne ou en profil en cône) ; quatre exemples
  de fiches techniques ; la correction de pression ; l'étiquette « calculé »,
  « estimé », « mesuré » ou « saisi » de chaque réglage, enregistrée dans une
  table à part (migration additive 0029) ; le moteur ne change pas. Neuf
  précisions tranchées sur la recommandation (C1 à C9, D-070). Parcours P25.
  **Validé par le porteur le 8 novembre 2026 à 11 h 25**, après l'avoir vu
  en ligne : « Ok, ça me paraît réaliste. Je valide comme ça. » Les ajouts
  de réalisme proposés (pertes, sol, pompe, hydraulique) sont écartés par
  lui. Deux défauts d'affichage vus sur sa capture sont corrigés (#292,
  déployée le 8 novembre à 12 h 30) : les unités au bord droit des cases,
  et plus d'étiquette tant que le résultat est inconnu.
- 3.8 ter, créneaux protégés nommés : contrat validé par le porteur le
  6 novembre 2026 (`docs/protected-slots-contract.md`, D-062), sept questions
  tranchées. **Code commencé la nuit du 7 au 8 novembre 2026 sur le même
  mandat**, en cinq PR (section 11 du contrat), Opus 5.5 · Max, chaque
  question tranchée par l'option recommandée (section 13 du contrat, D-071).
  PR 1 (#282, déployée) : le module de domaine
  (`lib/domain/planning/protected-slots.ts`) : la saisie d'un créneau, ses
  instants chaque semaine (passage de minuit, veille comprise, changement
  d'heure), l'union des créneaux, le découpage d'une plage horaire autour
  d'eux ; six précisions (S1 à S6). PR 2 (#283, déployée) : le placement,
  qui évite les créneaux, nomme le créneau évité dans la justification et
  donne le motif « créneau protégé : <nom> » d'un besoin non placé ; sept
  précisions (S7 à S13) ; sans créneau, le plan est celui d'avant. PR 3
  (#284, déployée) : la persistance, migration 0030, l'historique de chaque
  version, la suppression logique, le service qui relit les créneaux à
  chaque calcul ; six précisions (S14 à S19). PR 4 (#285, fusionnée le
  8 novembre à 02 h 27, déployée avec le correctif qui suit) : « Réduire »
  ou « Annuler » suggéré sur un arrosage validé qui tombe dans un créneau
  protégé, le signal sur l'irrigation réelle faite pendant l'un d'eux ; six
  précisions (S20 à S25). Correctif du journal (#286, déployée) : après la
  fusion de #285, le job « Application » de `main` a échoué sur un test de
  la PR 3 et le déploiement ne s'est pas fait ; le test montrait un vrai
  défaut, une suppression refusée dans la même milliseconde que la
  précédente écrivant une version de trop au journal (contre S15). PR 5
  (#287, déployée) : l'écran, la section « Créneaux protégés » du pli « Réglages
  du planning » avec leur journal, l'avertissement de « Planifier » sans
  blocage (cas 14), les créneaux comptés quand on décoche le Planning, le
  parcours P26 ; sept précisions (S26 à S32). Le code des créneaux protégés
  est terminé. **À vérifier par le porteur à son retour** : comme pour le
  calculateur, ni sa relecture en ligne ni une recette avec sa session sur
  la ferme réelle n'ont pu se faire cette nuit ; aucun créneau n'existe sur
  sa ferme tant qu'il n'en pose pas.
- 3.8 quater, audit ergonomique : **audit du 7 novembre 2026 retenu en entier
  par le porteur le jour même** (D-069), quatorze améliorations voulues, en
  trois lots (petits points 7, 4, 9, 11 ; téléphone, « Aujourd'hui » et
  « Fiabilité du calcul » ; le reste). Après la 3.8 ter, avant la 3.9 ;
  Opus 5.5, Élevé puis Très élevé. **Lot 1 codé la nuit du 7 au 8 novembre
  2026 sur le mandat du porteur** (#288, Opus 5.5 · Élevé, D-072) : un
  titre d'onglet par page et une page introuvable en français avec le menu
  et le lien de retour (point 7) ; l'ordre naturel des noms dans les listes
  de planches et de matériel, le périmètre d'un objectif rangé par jardin
  avec une recherche tapée (point 4) ; la saison cachée sur Alertes météo et
  sur Réglages quand rien n'y dépend d'elle, la commune changée dans
  Réglages seulement (point 9) ; l'historique ouvert sur les irrigations
  réalisées, « Planifiées » et « Toutes » en onglets, l'export qui dit ce
  qu'il exporte, « Saisir la pluie » à la place d'une pluie qui manque
  (point 11). Neuf précisions tranchées sur la recommandation (E1 à E9,
  bloc 3.8 quater de la roadmap). Parcours P27. **Lot 1 en ligne** (#288,
  déployée le 8 novembre à 04 h 29). **Relu et validé par le porteur le
  8 novembre 2026** (E4 compris : au téléphone aussi, le périmètre garde
  ses groupes par jardin et sa recherche). **Lot 2 : contrat écrit le 8 novembre
  2026** (`docs/audit-ergonomie-lot2-contract.md`, Sonnet 5.5 · Moyen, D-073) :
  points 2, 1 et 3, quatorze précisions F1 à F14 tranchées sur la
  recommandation (mandat de la nuit), trois PR (téléphone, domaine, écrans),
  parcours P28 et P29, aucune migration ; **contrat en ligne** (#289,
  déployée le 8 novembre à 05 h 02). **Lot 2, PR 1 sur 3 codée le
  8 novembre 2026** (#290, Opus 5.5 · Très élevé, D-073) : le
  téléphone. Une barre en bas de l'écran (quatre pages et « Plus », ou le
  menu entier s'il tient en cinq), la saison dans la ligne du titre, le
  planning replié (le jour du jour ouvert, les jours écoulés sous « Jours
  écoulés (n) » sauf celui qui porte un retard, les six tuiles en une ligne
  qui se déplie), le bandeau « Alertes système non disponibles » montré une
  fois puis replié en un point sur la cloche, les « ? », « i » et
  « Actualiser » à 44 px. Huit précisions de plus (F15 à F22). Parcours P28.
  Rien ne change à l'ordinateur ni à la tablette. **PR 1 en ligne** (#290,
  déployée le 8 novembre à 11 h 30). **PR 2 sur 3 codée le
  8 novembre 2026** (#291, Opus 5.5 · Très élevé, D-073) : le domaine,
  sans écran. La fonction unique de la zone « Fiabilité du calcul »
  (`lib/domain/today/reliability.ts` : volume des réserves, pluie réelle,
  sol jamais observé, espèces sans rattachement, plan à recalculer) et les
  cinq blocs de la page « Aujourd'hui » (gel ou chaleur, en retard, à faire,
  eau, fiabilité), la pastille du menu, le service qui rassemble les
  lectures existantes. Huit précisions de plus (F23 à F30). **PR 2 en
  ligne** (#291, déployée le 8 novembre à 12 h 01). **PR 3 sur 3
  codée le 8 novembre 2026** (#293, Opus 5.5 · Très élevé, D-073) : les
  écrans.
  La page « Aujourd'hui », première du menu et page d'arrivée, toujours sur
  le jour du jour : la ligne du dernier calcul du plan, les cinq blocs, une
  phrase calme pour un bloc sans rien à dire, les boutons existants
  « Démarrer maintenant » et « Recalculer le plan », « Ouvrir » vers chaque
  carte ; la zone « Fiabilité du calcul », dont chaque geste mène à la
  carte même ; la pastille ambrée du menu, lue sans requête vers Ouvre ta
  ferme. Seul l'avertissement « pluie réelle incomplète » des besoins
  doublait la zone : il reste sur sa page, avec la même conséquence. Douze
  précisions de plus (F31 à F42). Parcours P29. **PR 3 en ligne**
  (#293, déployée le 8 novembre à 13 h 01) : **lot 2 en ligne**,
  relecture en ligne du porteur à son retour. Lot 3 : un contrat court
  d'abord. **Retours du porteur du 8 novembre 2026** (#295, Opus 5.5 ·
  Très élevé, déployée le 8 novembre à 13 h 30) : « Non placé » replié
  par défaut sur le planning de la semaine, son nombre de planches dans
  le titre et une flèche pour le déplier ; les « i » du planning gardent
  leur taille ; sur « Matériel et placement », le plan de la parcelle d'abord, la fiche de la planche
  choisie, puis l'aperçu instantané. Puis, sur « Besoin par culture » :
  « Voir le détail » et une flèche sur chaque carte de culture
  et d'espèce, et à droite du nom de chaque culture son résumé (Kc du
  jour, racine la plus profonde, séries de la saison), choix du porteur
  (#296, déployée le 8 novembre à 14 h 03). **« Aujourd'hui » devient le
  tableau de bord du module** (D-074, `docs/aujourdhui-tableau-de-bord-contract.md`,
  Opus 5.5 · Très élevé) : maquette validée par le porteur le 8 novembre à
  12 h 25, plus graphique (frise du jour, météo dessinée, eau de la
  semaine et réserve du sol par jardin, cuves, anneau de la fiabilité),
  entrée de menu détachée, pages en trois groupes, et un bouton « Tout est
  fait » qui enregistre les irrigations passées telles que prévues (choix
  du porteur). Trois PR : **PR 1, le contrat et le domaine** (#297, en
  ligne), sans changement d'écran ; **PR 2, les écrans** (#298, en ligne) :
  la page en grille, l'encart « Aujourd'hui · Tableau de bord » en tête du
  menu et les pages en groupes « Arroser », « Équiper », « Surveiller », le
  bouton rond de la barre du téléphone, parcours P29 mis à jour et P30 ;
  **PR 3, « Tout est fait »** (#299, en ligne) : le bouton en tête de « Votre
  journée », la confirmation par jour qui se décoche, l'écriture telle que
  prévue tout ou rien par irrigation, rejugée par le serveur, une seule
  fonction du domaine (`lib/domain/done-as-planned.ts`) pour le lot 3, P30
  complété ; une irrigation enregistrée ne se modifie plus (D-006, T16).
  Dix-huit précisions T1 à T18. Relecture en ligne du porteur ensuite.
  **Lot 3 : contrat court validé par le porteur le 8 novembre 2026**
  (`docs/audit-ergonomie-lot3-contract.md`, D-076), trois PR. **PR 1, le
  planning et les arrosages** (#301, en ligne) : les cartes de tête « À valider »,
  « Faites », « En retard », le retard lu sur l'irrigation validée ; les
  planches non servies rangées par motif, celles sans matériel dites en
  action vers « Matériel » ; les codes des règles dans l'infobulle « Pour
  les experts » ; le formulaire sans présélection, la faisabilité en phrase
  d'action sans bouton ; « À traiter » en tête puis une ligne par
  irrigation et par jour, « Annuler » dans le menu « … », « Fait comme
  prévu » avec une confirmation d'une ligne, sur « Arrosages » et sur
  « Aujourd'hui ». **PR 2, les PR 2 et 3 réunies** (#303 de l'archive, en
  ligne le 8 novembre 2026 à 18 h 57) : les gestes par ligne, les mots
  simples et l'accessibilité. Lot 3 complet, validé par le porteur le
  8 novembre 2026 à 19 h 20.
- Connexions matériel (C1 station météo locale, C2 tensiomètres, C3
  électrovannes) : **demandées par le porteur le 7 novembre 2026**
  (roadmap section 6 bis, D-063), après la 3.9, avant la tranche 4 ; trois
  recherches documentaires sans code en cours, rien de décidé ni de codé ;
  l'électrovanne touche la ferme réelle, rien n'est exécuté. **C3 : contrat
  écrit le 7 novembre 2026** (`docs/valve-control-contract.md`, D-064), le
  module doit piloter, confirmation du porteur à chaque ouverture, quatre
  questions tranchées sur la recommandation ; rien de codé ni acheté ; le
  réglage du code, le montant du banc et la passerelle restent à valider.
  Aucun contrôle rejoué (PR de registres seule).
- Banc commun de saisons rejouées avec Tlaloc : **décidé par le porteur le
  7 novembre 2026** (roadmap section 6 ter, ligne 24 ter, D-065), après la
  3.9, en recherche : un contrat d'abord, aucun code sans son accord. Quatre
  idées rangées sans engagement (archivage des prévisions J+1, formule du
  tensiomètre pour C2, heures de silence des notifications, ET0 horaire).
  Rien de codé. Aucun contrôle rejoué (PR de registres seule).
- Partage des rôles avec Tlaloc : **accord du porteur le 7 novembre 2026**
  (roadmap section 6 quater, ligne 24 quater, D-066) : il termine la
  Tranche 3 ; Tlaloc prend l'automatisation (C1 à C3 confiés, recherches
  conservées) ; chantier de fusion des deux moteurs avant la Tranche 4, qui
  absorbe le banc commun ; fonctionnalités cochées à la connexion (intention,
  3.8). Rien de codé ni cadré. Aucun contrôle rejoué (PR de registres seule).
- 5 bis, alertes météo : ✅ close ; PR 1 à 3 (#224 à #227) fusionnées et
  déployées, recette réelle sur la ferme validée par le porteur le
  6 novembre 2026.
- 5 quater, besoin en eau par culture et par stade : code commencé le
  5 novembre 2026 sur le « vas-y » du porteur, en Opus 5.5 · Max ; PR 1, le
  domaine (#235, `lib/domain/crop-water/`), avec deux règles du contrat tranchées
  par lui en codant (D-057) : un stade déclaré recale le calendrier des
  stades suivants, la culture reste sur sa planche jusqu'à la plus tardive
  de ses semaines de récolte ; quinze précisions faites en codant, validées
  par lui le 6 novembre 2026. PR 2, la persistance (#236, migration additive
  0023, `db/crop-water/`, jeu commun de 32 cultures), fusionnée et déployée ;
  ses dix précisions validées par lui le 6 novembre 2026. PR 3, l'écran, commencée le
  6 novembre 2026 sur son « vas-y », en Opus 5.5 · Élevé, en cinq PR : 3a, la
  page « Coefficients culturaux » et la correspondance des espèces (#237) ;
  3b, la fiche de la planche et l'adoption (migration 0024, parcours P15,
  #239, déployée) ; 3c, les surcharges de Kc et les réglages (parcours
  P16, #241, déployée) ; 3d, l'ETM enregistrée chaque matin et
  l'avertissement de l'aspersion (#242, déployée) ; 3e, les durées propres
  à la ferme et la fiche de la série (parcours P17, #243, déployée). Recette
  réelle faite le 6 novembre 2026 en lecture seule (`docs/recette-5-quater.md`),
  jugement au porteur. La
  correspondance des 78 espèces de la ferme est saisie le 6 novembre 2026.
- 5 ter, réserve du sol : **code commencé le 6 novembre 2026 sur le mandat
  du porteur** de réaliser seul la 5 ter, la pastille « eau en trop », la
  5 quinquies et la refonte ergonomique, chaque question tranchée par
  l'option recommandée et consignée (D-060) ; la 3.8 reste hors du mandat.
  PR 1 (#245, fusionnée et déployée le 6 novembre 2026), le domaine
  (`lib/domain/soil-reserve/`), les quarante et un
  scénarios du contrat en tests, le seuil d'arrosage réglable (D-059) et
  dix-sept précisions consignées dans le contrat ; PR 2 (#246, fusionnée et
  déployée le 6 novembre 2026), la persistance (migration additive 0025,
  `db/soil-reserve/`, jeu commun de 31 profils racinaires, dix
  précisions) ; PR 3, l'écran, en quatre : 3a, les réglages
  du sol (#247, fusionnée et déployée le 6 novembre 2026 ; parcours P18,
  huit précisions) ; 3b, le bloc « Réserve du sol » par jardin (#248,
  fusionnée et déployée le 6 novembre 2026 ; parcours P19, neuf
  précisions) ; 3c, les profils racinaires dans la page « Coefficients
  culturaux » (#249, fusionnée et déployée le 6 novembre 2026 ; parcours
  P20, cinq précisions) ; 3d, l'état du jour enregistré chaque matin et la
  dose au-delà de ce que le sol retient sur les propositions (#250,
  fusionnée et déployée le 6 novembre 2026 ; deux précisions) ; puis la
  pastille « eau arrosée en trop » (#251, fusionnée et déployée le
  6 novembre 2026 ; sept points) ; **recette réelle faite le 6 novembre 2026**
  sur son « vas-y » (`docs/recette-5-ter.md`) : le sol de la Clémentière et
  une observation de 50 % enregistrés sur ses réponses, cinq planches justes
  à la main, affichage sans débordement à 390 px ; un défaut trouvé, l'heure
  « maintenant » d'une observation refusée par une horloge en avance de
  13 s, corrigé le soir même (#255, fusionnée et déployée le 6 novembre
  2026) ; jugement au porteur (D-014), contrôle des
  racines à la bêche sous abri à faire par lui.
- 5 quinquies, alertes météo par culture : contrat écrit et relu par le porteur
  le 6 novembre 2026 (`docs/weather-crop-alerts-contract.md`, D-058) ; en 21
  de l'ordre, après la 5 ter, avant la refonte ergonomique et la 3.8.
  Placement des idées Tlaloc validé le même jour (D-059 : le seuil
  d'arrosage réglable entre dans la 5 ter). **Code commencé le 6 novembre
  2026 sur le même mandat (D-060)** : PR 1, le domaine (#252, fusionnée et
  déployée le 6 novembre 2026 ; `lib/domain/crop-alerts/`), dix-neuf des
  vingt scénarios du contrat en tests, huit précisions consignées dans le
  contrat ; PR 2, la persistance et l'envoi (#253, fusionnée et déployée le
  6 novembre 2026 ; migration additive 0026, `db/crop-alerts/`, le scénario
  13 en test, huit précisions) ; PR 3, l'écran (#254, fusionnée et déployée
  le 6 novembre 2026 ; l'encart « Alertes cultures », parcours P21, huit
  précisions). **Recette réelle faite les 6 et 7 novembre 2026** sur son
  « vas-y » (`docs/recette-5-quinquies.md`) : ses 24 légumes rattachés au
  jeu commun sur sa réponse, les
  fleurs, l'endive et l'engrais vert laissés sans seuil ; la vraie alerte
  de gel du dimanche 8 novembre (1,9 °C, patate douce et tomate sous abri)
  produite mais refusée par le service d'envoi (étiquette à virgule),
  défaut corrigé le soir même (#258, fusionnée et déployée le 6 novembre
  2026) ; l'alerte reçue ensuite sur son téléphone, à 23 h 56 puis à
  00 h 02, avec deux défauts de réception : apparue seulement au réveil du
  téléphone (00 h 09 pour 00 h 02), et le toucher n'ouvrant rien ; corrigés
  le soir même (#260 ; priorité haute, premier plan d'abord) ; à l'essai
  final du 7 novembre 2026, l'alerte arrive à la minute de l'envoi sur son
  téléphone verrouillé et sonne (12 h 18), et la toucher ouvre le module ;
  jugement au porteur (D-014).
- Refonte ergonomique, charte du module validée par le porteur le 6 novembre
  2026 (`docs/charte-module.md`) : **code commencé le 6 novembre 2026 sur le
  même mandat (D-060)**, CSS seul, en trois temps : R1, les jetons, les
  polices hébergées, le fond, les blocs et les rayons (neuf précisions
  consignées dans la charte ; #257, fusionnée et déployée le 7 novembre
  2026) ; R2, les boutons, les onglets, les tableaux et les tuiles de
  totaux (cinq précisions ; #263, fusionnée et déployée le 7 novembre
  2026) ; R3, les couleurs d'état, le bleu eau et les
  icônes au trait (cinq précisions ; la navigation de la charte revient à
  la 3.8 ; #264, fusionnée et déployée le 7 novembre 2026) ; un défaut de
  R3 trouvé au contrôle de départ de la 3.8 et corrigé le 7 novembre 2026,
  sur le choix du porteur, avant la 3.8 : l'icône de la page demandée en
  vain (404), le composant des icônes renommé `line-icon.tsx`. **Relecture
  visuelle du porteur le 7 novembre 2026** : lisible et à son goût, mais
  trop proche d'avant et pas assez « OTF » ; **deuxième passe (R4) décidée
  le jour même sur une maquette validée par lui** (D-068, `docs/charte-module.md`,
  « Deuxième passe ») : plan sans bandeau vert foncé, moins de cadres,
  étiquettes écrites normalement, titre de page à la taille de la charte,
  barre anthracite au téléphone ; code juste après la 3.8, avant la 3.8 bis,
  Opus 5.5 · Élevé. **R4 codée le 7 novembre 2026 au soir, après le
  déploiement de la PR 7 de la 3.8 (cette PR)** : en-tête blanc allégé et
  menu en colonne collée au bord gauche à l'ordinateur, barre anthracite
  avec la cloche au téléphone (une barre commune, `shell/topbar.tsx`),
  titre à 22,75 px et 20 px avec son « ? » au trait, état des données d'OTF
  en une ligne, plan sans bandeau, planche choisie en tuiles vert pâle,
  vingt-neuf étiquettes en petites majuscules écrites normalement, l'eau du
  jour en tuile vert pâle, les cadres dans les blocs remplacés par des fonds
  alternés gris et blanc. Aucun calcul, aucune page, aucun texte de contenu
  ne change ; reste la relecture du porteur.
- Contrats relus et validés sur `main` : 3.9 (D-052), 5 ter (D-053,
  profondeurs par stade D-056, fin de culture D-057) et 5 quater (D-054,
  D-057).
- Code suivant, d'après l'ordre de `docs/ROADMAP.md` (section 2) : le
  mandat du 6 novembre 2026 (D-060) est entièrement codé ; reste, avec le
  porteur, son jugement sur les recettes de la 5 ter et de la 5 quinquies.
  Après la 3.8, close par le porteur : la deuxième passe de la refonte
  (D-068, codée, à relire par le porteur), la 3.8 bis (codée, #281), la
  3.8 ter (cinq PR), la 3.8 quater (trois lots, en ligne), puis la 3.9, en
  cours : lot 2, quatre PR `fix/`, une à la fois, toutes les quatre en
  ligne (#11 à #14).
- Modèle Fable interdit depuis le 1er novembre 2026 (D-055) : tout ce qui était
  prévu en Fable passe en Opus 5.5 · Max, quel que soit l'effort d'avant
  (3.9, domaine de la 5 quater, tranche 4).
- Réglage de chaque tâche : la colonne « Modèle · effort » de la roadmap, et
  Sonnet 5.5 · Moyen pour le travail sans code.
- Reste au jugement du porteur : la lisibilité sur téléphone ; l'alerte
  minimatch (eslint 10) est un lot à part, sur son « vas-y ».
- Charte graphique d'Ouvre ta ferme relevée le 6 novembre 2026 :
  `docs/charte-otf.md` (couleurs, polices, composants, téléphone, onze
  recommandations pour harmoniser le module). Aucun contrôle rejoué ; le lot
  d'harmonisation n'est pas planifié, il attend le « vas-y » du porteur.
- PR de Dependabot ouvertes (#230 à #234) : jamais fusionnées seules.

## Référence Git

- Branche stable : `main`.
- Dernier socle fonctionnel avant la mise en place du dispositif de reprise :
  `c654426` (`fix: synchronize irrigation needs week`).
- Source de vérité unique depuis le 18 septembre 2026 : le dépôt GitHub privé
  `lechampdelaurore-boop/module-irrigation-otf` (décision D-011). Le dépôt
  interne de l'environnement Codex n'est plus un lieu d'écriture.
- **Depuis le 8 novembre 2026**, le travail et le déploiement passent par le
  dépôt public `lechampdelaurore-boop/module-irrigation-otf-public` (licence
  PolyForm Shield 1.0.0, historique neuf) ; le dépôt privé devient une
  archive en lecture seule, jamais rendue publique. `main` y est protégée :
  PR obligatoire, jobs « Application », « Workers Cloudflare » et
  « Parcours navigateur » requis, branche à jour exigée, ni forçage ni
  suppression.
- `main` est protégée depuis le 18 septembre 2026 (décision D-013) : PR
  obligatoire, jobs « Application », « Workers Cloudflare » et, depuis le
  2 octobre 2026 (D-026), « Parcours navigateur » requis, branche à jour
  exigée, aucun contournement administrateur, ni forçage ni suppression.
- La commande `git log -1 --oneline` reste la référence du dernier commit ;
  ce document ne doit pas provoquer un commit uniquement pour recopier son
  propre identifiant.

## État fonctionnel constaté

- Tranche 1 terminée : lecture OTF GET-only, cache, saisons, plan physique et
  gestion des états d'erreur.
- Tranche 2 terminée : matériels, réglages, placements, calculs d'apport,
  irrigations, météo, objectifs, historique, notifications et recette.
- Tranche 3.1 terminée : ressources et réserves.
- Tranche 3.2 terminée : pompes et contraintes hydrauliques.
- Tranche 3.3 terminée et stabilisée : besoins par planche et priorités.
- Socle qualité Q0 à Q6 terminé le 21 septembre 2026 : hébergement Cloudflare,
  gouvernance, tests de persistance, frontières outillées, dépendances,
  parcours navigateur et découpage des fichiers. Q0 et la décision D-016
  sont closes formellement le 3 octobre 2026, avec la suppression de l'ancien
  site OpenAI Sites par le porteur.
- Tranche 3.4 terminée le 25 septembre 2026 : faisabilité, répartition des
  déficits et arbitrage manuel, recette utilisateur entièrement passée sans
  défaut bloquant.
- Sous-tranche 3.1 bis terminée le 25 septembre 2026 : mesure et historique du
  débit des ressources, recette réelle close sur le forage de la ferme.
- Sous-tranche 3.3.1 terminée le 18 septembre 2026 : l'ET0 est retirée du
  calcul du besoin (décision D-010) et reste affichée pour information ;
  recette sur le site faite le 9 octobre 2026 par l'assistant dans le Chrome
  du porteur ; point 4 fermé par lui le 10 octobre 2026.
- Sous-tranche 3.5 close le 10 octobre 2026 par le porteur : moteur de
  planning hebdomadaire, avec son interface 3.6 close le 29 septembre 2026 ;
  six recettes réelles sur la ferme, dont trois en pénurie fabriquée ; le
  point 31 fermé le 31 octobre 2026 par la 3.7 (D-030) ; reste le point 34
  en veille, non bloquant.
- Sous-tranche 3.7 cadrée le 30 octobre 2026 : contrat
  `docs/replanning-contract.md` validé par le porteur le soir même (D-051) ;
  code commencé le 31 octobre 2026 en Fable 5.1 · Très élevé : PR 0, le
  déplacement de la justification hors du moteur (#208), fusionnée et
  déployée ; PR 1 sur 5, la lecture des refus (point 31, #209), fusionnée
  et déployée ; PR 2 sur 5, le recalcul sur événement (#210), fusionnée et
  déployée ; PR 3 sur 5, les suggestions sur les arrosages validés (#211),
  fusionnée et déployée ; PR 3 bis, le pli « Ce qui a changé » (règle 25,
  #212), fusionnée et déployée ; PR 4a, le retard et le réglage R14
  (#213), fusionnée et déployée ; PR 4b, les deux notifications (#214),
  fusionnée et déployée ; PR 5 sur 5, l'écran et le parcours P12 (#215),
  fusionnée et déployée ; recette réelle faite le 31 octobre 2026
  (`docs/recette-3.7.md`), conforme, point 31 prouvé sur le site ; trois
  défauts et une trace de données au jugement du porteur, les quatre
  corrigés le jour même sur son mot (#220) : carte « Annulée » hors du
  compte et du volume, message durable dans le bandeau, « déplacée » à la
  minute, « Retirer la mesure » (#220, fusionnée sur son mot et déployée,
  vérifiée sur la ferme le jour même) ; **3.7 close par le porteur le
  31 octobre 2026**, point 31 fermé.
- Extension 5 bis, alertes météo paramétrables : contrat validé le
  30 octobre 2026 (D-050) ; code commencé le 31 octobre 2026 : PR 1 sur 3, le
  domaine (critère, validation, évaluation, répétition, texte de la
  notification, #224), PR 2a, la route d'envoi immédiat du Worker Web Push
  (#225), et PR 2b, l'enregistrement et l'envoi après chaque écriture de
  prévisions (#226), fusionnées et déployées ; PR 3, l'encart « Alertes
  météo » : critères saisis, activés, modifiés, supprimés, historique des
  alertes, températures prévues dans la semaine, clic ouvrant la semaine du
  jour visé ; recette réelle sur la ferme validée par le porteur le
  6 novembre 2026 : close.

## Derniers changements fonctionnels

Les deux commits postérieurs à `origin/main` au début de cette mise en place
sont :

- `d7ff000` : synchronisation automatique de la météo côté serveur ;
- `c654426` : synchronisation des besoins avec la semaine sélectionnée.

Ils ne doivent pas être refaits. Ils doivent être vérifiés avec les contrôles
normaux puis publiés avec l'historique complet.

Le 17 septembre 2026, les Actions GitHub `checkout`, `setup-node` et
`pnpm/action-setup` ont été mises à jour. La recette a également révélé puis
corrigé une course de minuterie : les départs OTF concurrents sont maintenant
sérialisés et espacés d'au moins 200 ms.

Le 18 septembre 2026, `tailwindcss` et `@tailwindcss/postcss` ont été alignés en
version `4.3.3`. React, Next/ESLint et les types Node devaient alors être
traités séparément.

Le 18 septembre 2026, la migration de `@types/node` vers une nouvelle version
majeure a été différée. Le projet conserve la génération 22, cohérente avec le
runtime Node `22.13.0` de la CI. Dependabot reste autorisé à proposer les
correctifs et versions mineures de cette génération, mais ignore désormais les
mises à jour majeures de `@types/node`.

Le 18 septembre 2026, `next` et `eslint-config-next` ont été mis à jour
ensemble de `16.2.6` vers `16.3.5`. Vinext reste en `1.0.0-beta.3` et React
reste en `19.2.6` ; aucun autre chantier de dépendances n'a été inclus.

Le 18 septembre 2026 en fin de journée, un audit complet du dépôt en lecture
seule a été réalisé depuis un poste Windows nouvellement outillé (Git 2.55,
Node 22.23.2, pnpm 11.19.0, GitHub CLI 2.101) ; tous les contrôles y ont été
reproduits avec les mêmes résultats. Le rapport est dans
`audit-depot-2026-09-18.md`. La roadmap a été réécrite et validée par le
porteur de projet : socle qualité Q1 à Q6 préalable au moteur de planning,
sous-tranche corrective 3.3.1, cadrage 3.5.0, sous-tranche 4.7. Six décisions
ont été consignées, D-010 à D-015. Le compte propriétaire est passé en GitHub
Pro et `main` est protégée. Aucun code applicatif n'a été modifié.

Le 18 septembre 2026, sous-tranche 3.3.1 : la demande hebdomadaire d'une
planche est désormais son objectif applicable, sans plafonnement par l'ET0. Le
champ « demande retenue » a disparu du modèle et de l'écran ; le déficit
relatif et le contrôle du remplacement manuel se rapportent à l'objectif ; une
ET0 incomplète ne rend plus le besoin incalculable et reste signalée avec ses
jours manquants. Aucune migration ; les remplacements manuels existants restent
valides. Effet attendu au champ : en semaine fraîche ou pluvieuse, le besoin
affiché remonte au niveau de l'objectif au lieu d'être réduit à l'ET0.

Le 18 septembre 2026 en soirée, phase 1 de la sous-tranche Q0 : base D1
`module-irrigation-otf` créée dans le compte Cloudflare du porteur, quatorze
migrations appliquées et suivies par Wrangler, Worker déployé à
`https://module-irrigation-otf.lechampdelaurore.workers.dev` avec une base
vide ; sans Access configuré, la page redirige vers la connexion Access et la
route interne météo refuse toute requête non autorisée. Authentification par
jeton Access écrite et testée, compilation Sites inchangée.

Le 19 septembre 2026, Cloudflare Access configuré : équipe Zero Trust
`damp-wind-3566` sur l'offre gratuite, application « Module irrigation »
protégeant le Worker (session d'un mois, politique Allow sur le seul courriel
du porteur, code à usage unique), application « Module irrigation - route
interne » en Bypass sur le chemin `/api/internal`. Variables
`ACCESS_TEAM_DOMAIN` et `ACCESS_AUD` inscrites dans `wrangler.jsonc`, Worker
redéployé et sondé : `/irrigation` redirige vers la connexion Access, la route
interne reçoit bien les requêtes et répond 401 sans jeton applicatif. Les
secrets `OTF_API_TOKEN` et `VISUAL_CROSSING_API_KEY` ont été saisis par le
porteur le 19 septembre ; les jetons partagés avec les Workers et la paire
VAPID seront régénérés en phase 3. Reste pour clore la phase 1 : recette
technique de connexion par le porteur.

Le 19 septembre 2026, la cadence des lectures OTF passe à 250 ms minimum
entre deux départs, quatre appels par seconde au plus : l'API OTF n'en accepte
pas davantage, et l'ancien espacement de 200 ms en autorisait cinq. Sans
rapport avec les refus `401` observés sur le nouvel hébergement, qui
signalent un jeton refusé.

Le 19 septembre 2026, phase 2 préparée, sans exécution : route temporaire
`GET /api/export` réservée au propriétaire authentifié, module pur
`lib/d1-export-import.ts` et script `scripts/import-d1-export.ts`
(ordre par clés étrangères, vidage, insertions par lots, remappage du
propriétaire, comparaison des comptages). Procédure dans
`hosting-migration-contract.md`.

Le 19 septembre 2026 en matinée, phase 2 exécutée. Le porteur a publié `main`
sur Sites une dernière fois via Codex, puis téléchargé l'export complet
(39 tables dont la table de plateforme `__appgarden_migrations`, 375 lignes
applicatives, exporté à 09:19 UTC). Import dans la base D1 du compte
Cloudflare avec remappage de l'identité du propriétaire vers son identité
Access, puis comptages identiques sur les 38 tables applicatives. Deux limites
de D1 rencontrées et prises en compte dans le script : 100 000 octets par
instruction SQL, d'où des lots bornés en taille pour le cache OTF de 34 Ko par
ligne, et un nombre limité de termes dans un `UNION ALL`, d'où une requête de
comptage en sous-requêtes scalaires. À partir de cet export, toute saisie faite
sur le site Sites serait perdue : le site Sites ne doit plus être utilisé, ou
l'export et l'import doivent être rejoués, l'import vidant la base cible avant
de la recharger.

Le 19 septembre 2026 en fin de matinée, phase 3 : jetons partagés
(`IRRIGATION_PUSH_SERVICE_TOKEN`, `WEATHER_SYNC_SERVICE_TOKEN`) et paire
VAPID régénérés et posés sur chaque Worker par script, sans affichage ; secret
`IRRIGATION_SITE_BYPASS_TOKEN` supprimé du planificateur ; `VAPID_SUBJECT`
et `IRRIGATION_SITE_URL` repointés sur la nouvelle adresse. Premier
déclenchement manuel du planificateur : 404 sans qu'aucune requête n'atteigne
le site, car un Worker ne peut pas joindre un autre Worker du même compte par
son adresse publique `workers.dev`. Liaisons de service ajoutées :
`IRRIGATION_SITE` du planificateur vers l'application, `IRRIGATION_PUSH` de
l'application vers le Worker Push (repli réseau hors Cloudflare). Après
redéploiement, le déclenchement manuel répond 200 et l'application exécute la
synchronisation ; celle-ci échoue toutefois avec « Requête météo refusée
(statut 401) » : la clé `VISUAL_CROSSING_API_KEY` saisie sur le nouvel
hébergement est refusée par le fournisseur et doit être ressaisie par le
porteur. Job « Déploiement Cloudflare » ajouté à la CI, conditionné à la
variable de dépôt `CLOUDFLARE_DEPLOY` en attendant le jeton d'API Cloudflare.
Sites n'est plus utilisé ; la clé publique VAPID ayant changé, les
abonnements aux notifications doivent être refaits sur la nouvelle adresse.

Le 19 septembre 2026 en début d'après-midi, PR #26 fusionnée. Le porteur a
ressaisi `VISUAL_CROSSING_API_KEY` : la synchronisation déclenchée ensuite
par le planificateur a réussi (une cible sur une, aucune erreur, réussite
automatique enregistrée à 10:53 UTC). Le porteur a créé le jeton d'API
Cloudflare (Workers Scripts et D1 en écriture, paramètres du compte et
détails utilisateur en lecture) et l'a posé dans le secret GitHub
`CLOUDFLARE_API_TOKEN` ; la variable `CLOUDFLARE_DEPLOY` est passée à
`true`. La fusion de la présente PR est la première exécution réelle du job
« Déploiement Cloudflare » : son résultat est à consigner ici.

Le 19 septembre 2026 à 11:15 UTC, fusion de la PR #27 : première exécution
réelle du job « Déploiement Cloudflare », réussie de bout en bout
(compilation, migrations D1 distantes, déploiement de l'application ; les
deux Workers ignorés, dossiers inchangés). La preuve de fin « une fusion dans
`main` déploie l'application sans geste humain » est acquise. Dans la
minute qui a suivi, première écriture réelle du porteur sur la nouvelle base :
fin d'une irrigation en cours, enregistrée à 11:16:21 UTC (point de
non-retour franchi), puis erreur Cloudflare 1102 au réaffichage de la page.
Journal du Worker : `exceededCpu`, « Worker exceeded CPU time limit »,
intermittent sur `GET /irrigation`. Cause : plan Workers gratuit, dix
millisecondes de calcul par requête, rendu de la page à la limite avec les
données réelles. Décision D-017 : plan Workers payant souscrit par le porteur
le jour même. La souscription seule n'a pas suffi, le Worker déployé gardant
son ancienne limite : `limits.cpu_ms` fixé à 30 000 dans `wrangler.jsonc`
et redéploiement. Vérifié ensuite par le journal du Worker : six
rechargements consécutifs de `/irrigation` en 200, aucun dépassement.

Le 19 septembre 2026 en début d'après-midi, le porteur confirme sur la
nouvelle adresse : réabonnement aux notifications réussi, alertes reçues ;
contrôle visuel des données importées satisfaisant. Phase 4 exécutée dans la
foulée : greffon Sites, `.openai/hosting.json`, fournisseur d'identité par
en-têtes Sites, constante `__AUTH_PROVIDER__`, script d'enrobage
`build:cloudflare` et route `GET /api/export` retirés ; `vite.config.ts`
à cible unique ; scripts `build`, `dev`, `deploy` ; CI et procédure de
publication alignées. Le module et le script d'import D1 restent comme outil
de reprise. Il reste au porteur à supprimer le site Sites à partir du
3 octobre 2026.

Le 19 septembre 2026 en fin d'après-midi, sous-tranche Q1, gouvernance et
règles : `AGENTS.md` réécrit avec les règles métier invariantes du cahier des
charges, les interdits, la définition de « terminé » (qui fait désormais foi,
la section 10 de la roadmap y renvoyant), les règles de sécurité et de PR ;
modèle de PR aligné sur cette définition ; `.nvmrc` à 22.13.0 ;
`.gitattributes` imposant LF ; tag `v0.1.0` posé sur `main` après Q0 ;
neuf branches distantes déjà fusionnées supprimées et suppression automatique
des branches fusionnées activée sur le dépôt GitHub. Aucun code applicatif
modifié.

Le 19 septembre 2026 en soirée, sous-tranche Q2 engagée, première PR :
contrat `docs/persistence-tests-contract.md` ; `db/binding.ts`, point
d'accès unique à D1 (façade `db`, `overrideDatabase` pour les tests),
remplaçant `env.DB` dans les quatorze dépôts par un changement mécanique
(198 occurrences, aucun SQL modifié) ; résolveur de modules
`tests/support/resolve-hooks.mjs` (`cloudflare:workers` remplacé, alias
`@/`, extensions `.ts`) chargé par `node --import` ; adaptateur D1 sur
`node:sqlite` (`tests/support/d1-sqlite.ts`) rejouant les quatorze
migrations par test ; sept tests de l'adaptateur, six tests couvrant les six
fonctions exportées de `workspace-repository` sur le vrai SQL, un test de
dérive entre `db/schema.ts` et la base migrée. Ce dernier a révélé deux
écarts, corrigés dans `db/schema.ts` seul, la base faisant foi :
`irrigation_equipment_pump_defaults.pump_id` est NOT NULL dans la migration
0010 mais était déclaré nullable, et `irrigation_pump_log.pump_id` est
nullable dans la même migration mais était déclaré NOT NULL. Aucun effet à
l'exécution, drizzle ne servant qu'à générer les migrations ; une prochaine
génération n'aurait plus produit de migration parasite. Découvertes d'outillage :
`--experimental-strip-types` refuse les propriétés de paramètre de
constructeur ; `node:sqlite` rend des lignes sans prototype, converties en
objets ordinaires comme le fait D1 ; la règle ESLint des hooks React interdit
un nom de fonction commençant par `use` hors composant.

Le 19 septembre 2026 en soirée, Q2 deuxième PR : seize tests sur
`irrigation-event-repository`, couvrant ses treize fonctions exportées et
ses quatre classes d'erreur, sur le vrai SQL. Fixtures créées par les dépôts
de matériel (`tests/support/irrigation-fixtures.ts`) : matériel
goutte-à-goutte, réglage, position de saison. Horloge simulée par les
minuteurs factices de `node:test` pour le cycle complet : planifiée,
démarrée, pause à cinq minutes, reprise, arrêt anticipé à dix minutes
(`partially_completed`, 2 mm sur 4 par planche), reprise du reliquat, fin
(`completed`), puis immuabilité : plus aucune mutation n'est acceptée et
terminer de nouveau rend le statut sans rien changer. Vérifiés aussi :
isolation complète entre deux propriétaires, filtres de saison et de période,
avertissements de conflit d'horaire et de planches déjà arrosées, annulation
d'une planifiée et du reliquat, contrôles de l'heure de fin, marquage de
l'alarme Push conditionné à la révision et au propriétaire, et surtout le
rejet par les déclencheurs SQL d'une révision attendue périmée
(`WATER_BUDGET_CHANGED`, `HYDRAULIC_CHANGED`) avec annulation de tout le
lot, message que l'action serveur reconnaît. Aucun défaut de comportement
trouvé ; aucun code applicatif modifié.

Le 19 septembre 2026 en soirée, Q2 troisième PR : dix tests sur
`water-management-repository` (seize fonctions) et quatre sur
`snapshot-cache`. Vérifiés sur le vrai SQL : la dernière révision « set » de
chaque périmètre d'objectif fait foi et un effacement la masque ; la
récurrence copie les objectifs de la dernière semaine renseignée une seule
fois et respecte une semaine volontairement vidée ; les contraintes SQL
refusent un périmètre incohérent, un montant négatif, un mode météo
personnalisé sans ville, une limite active sans volume ou à période
inversée ; la préférence météo remet l'état d'actualisation à zéro quand le
lieu change ; la dernière réussite d'actualisation survit à un échec ; le
verrou d'actualisation n'accorde qu'une prise par intervalle et respecte la
date de report (il repose sur `meta.changes` de D1, que l'adaptateur
reproduit) ; les valeurs météo connues ne sont jamais écrasées par une
absence et la pluie manuelle, y compris 0 mm, reste à côté des réanalyses
sans être remplacée ; la limite journalière fait avancer la révision du
budget d'eau dans le même lot, annulé si la base refuse ; le cache OTF est
isolé par clé, remplacé à la relecture et ignoré s'il est illisible ou d'un
ancien format. Aucun défaut trouvé ; aucun code applicatif modifié.
Observation : l'ordre des révisions est `created_at` puis identifiant, deux
révisions écrites dans la même milliseconde et le même lot n'ont donc pas
d'ordre relatif garanti ; sans conséquence pour les cas d'usage (un seul
« set » par périmètre et par geste), noté pour Q3.

Le 19 septembre 2026 en soirée, Q2 quatrième PR : douze tests sur quatre
dépôts. Besoins (`irrigation-need-repository`) : seuil minimal remplacé et
journalisé, une décision par planche et semaine, action du journal distinguant
un remplacement posé, retiré ou un simple changement de priorité, bornes
refusées par la base. Arbitrages (`irrigation-arbitration-repository`) : la
révision de faisabilité avance par déclencheur dès qu'une source du calcul
change, une décision consomme la révision attendue et la base refuse une
révision périmée (`stale_feasibility_revision`), une requête rejouée est
acceptée sans rien réécrire mais refusée si sa sélection diffère,
l'invalidation marque les priorités visées et une nouvelle décision les
réactive. Historique (`irrigation-history-repository`) : période appliquée
aux dates réelles, prévues ou d'annulation selon l'état, chevauchement de
borne inclus, périmètre zone, parcelle ou planche, applications limitées au
périmètre, isolation. Météo nocturne (`automatic-weather-repository`) : une
cible par espace selon le mode de localisation, verrou du travail à jeton
unique libéré par le bon jeton ou par expiration, valeurs écrites sans écraser
une valeur connue, état automatique par espace avec réussite conservée après
un échec. Aucun défaut de comportement ; aucun code applicatif modifié.
Observation à traiter dans une correction séparée : la contrainte
`chk_irrigation_bed_need_override` compare `manual_override_mm` à des
bornes ; quand cette colonne est NULL et que `calculated_need_at_override_mm`
est renseigné, la comparaison vaut NULL et SQLite laisse passer le CHECK. Le
code applicatif n'écrit jamais cet état, mais la base ne l'interdit pas ;
migration corrective à prévoir (candidate : `IS NOT NULL` explicite).

Le 19 septembre 2026 en soirée, Q2 cinquième PR : dix tests sur le matériel
(`equipment-repository`, huit fonctions et six classes d'erreur) et les
positions (`equipment-placement-repository`, trois fonctions et deux
classes d'erreur). Vérifiés sur le vrai SQL : noms de matériel uniques sans
tenir compte de la casse et propres à chaque espace, actifs classés avant les
archivés ; réglages avec positions attribuées puis réutilisées après
suppression, renommage conservant l'identifiant, courbes d'aspersion
remplacées et non fusionnées, dix réglages au plus, refus d'un nom pris ou
d'un type discordant ; type verrouillé dès qu'un réglage existe ; matériel
archivé ni modifiable ni configurable ; duplication copiant réglages,
positions et courbes sous de nouveaux identifiants ; suppression d'un
réglage ou d'un matériel refusée tant qu'une irrigation s'y réfère, sinon
position et planches retirées ensemble. Positions : une par matériel et
saison, remplacée en place avec ses planches dans l'ordre choisi ;
l'aspersion se place sans planche, le goutte-à-goutte exige ses planches et
son ancrage parmi elles ; groupe de jardins inconnu refusé ; rien n'est écrit
pour un matériel introuvable, archivé, d'un autre propriétaire ou avec le
réglage d'un autre matériel ; suppression protégée par l'historique. Aucun
défaut trouvé ; aucun code applicatif modifié.

Le 19 septembre 2026 en soirée, Q2 sixième et dernière PR : douze tests sur
les groupes de jardins, les ressources en eau et les pompes. Groupes : position
croissante, membres ordonnés, renommage et remplacement des membres, nom unique
par saison, un jardin dans un seul groupe, copie de la saison précédente une
seule fois avec les seuls jardins encore présents et la zone reprise du plan
courant, suppression détachant les positions de matériel. Ressources et
réserves : noms uniques par liste et par espace, modification sans toucher au
volume observé, limites de prélèvement historisées, correction de volume avec
mouvement de stock et bornes, liaisons ressource → réserve et réserve → réserve
avec propriété vérifiée, auto-liaison et cycle refusés, alimentation par défaut
unique. Pompes : origines remplacées et non fusionnées, une origine par défaut
au plus, révision hydraulique avancée, archivage et réactivation, pompe par
défaut d'un matériel exigée active, usages sur une période (planifiées non
annulées et minuteurs en cours). **Défaut révélé** : retirer la pompe par
défaut d'un matériel échoue, le journal recevant « none » comme identifiant
de pompe, refusé par la clé étrangère de `irrigation_pump_log` ; test marqué
« à corriger » (todo), correction dans une PR séparée. Q2 close : les quinze
dépôts ont au moins un test par fonction exportée.

Le 19 septembre 2026, correction des deux défauts révélés par Q2, dans une
PR distincte des tests. Pompes : le journal de `irrigation_pump_log` reçoit
`NULL` et non « none » quand la pompe par défaut d'un matériel est retirée ;
la colonne est nullable et sa clé étrangère l'accepte ; le test « à corriger »
est levé et vérifie le journal. Besoins par planche : migration
`0014_bed_need_override_guard`, deux déclencheurs BEFORE INSERT et BEFORE
UPDATE sur `irrigation_bed_need_decisions` refusant un besoin calculé
mémorisé sans remplacement (`bed_need_override_inconsistent`), SQLite ne
permettant pas de modifier une contrainte CHECK sans recréer la table ; le
test correspondant vérifie le refus à l'insertion et à la mise à jour. La
migration est appliquée à la base distante par le déploiement automatique.

Le 19 septembre 2026, sous-tranche Q3 engagée, première PR : contrat
`docs/boundaries-contract.md`, puis `lib/` réparti en trois zones selon
ses imports réels, constatés fichier par fichier : `lib/domain` (32 modules
sans dépendance à React, Next, l'exécution Cloudflare ni aux dépôts),
`lib/services` (16 modules d'orchestration qui lisent et écrivent par les
dépôts ou appellent l'exécution), `lib/adapters` (5 modules d'échange avec
OTF, les fournisseurs météo et les données de démonstration) ; les
sous-dossiers `weather/` et `otf/` sont conservés dans chaque zone.
Déplacement par `git mv` (historique conservé) et réécriture mécanique de
222 chemins d'import, alias et relatifs ; deux corrections à la main après le
typage : l'ancien module `lib/domain.ts`, devenu `lib/domain/domain.ts`,
entrait en collision avec le nom du dossier (18 imports), et deux tests de
fuseau horaire chargeaient un module par un chemin écrit en chaîne. Exception
assumée et consignée au contrat : six modules du domaine importent en type
seulement des enregistrements définis dans `db/`, déplacement prévu en Q6
(fait le 21 septembre 2026, décision D-020).
Aucun code métier modifié ; les documents vivants citant des chemins sont mis
à jour.

Le 19 septembre 2026, Q3 deuxième PR : les frontières deviennent des règles.
`eslint.config.mjs` porte, par zone, des interdictions d'import
(`@typescript-eslint/no-restricted-imports`, alias et chemins relatifs) :
`lib/domain` n'importe que `lib/domain` et les enregistrements de `db/`
en type seulement ; `lib/adapters` ni `db/`, ni les services, ni
l'exécution ; `lib/services` ni React ni Next ; `db/` que le domaine ;
les composants clients (tout `.tsx` de `app/` hors `page.tsx` et
`layout.tsx`) `db/` en type seulement et jamais l'exécution ; rien
n'importe `app/`. `max-lines` à 600 lignes utiles en avertissement, sept
fichiers signalés. Test `tests/lint-boundaries.test.ts` : ESLint exécuté
sur des extraits placés virtuellement dans chaque zone, un import interdit
refusé avec un message renvoyant au contrat, un import permis accepté, un
fichier de 620 lignes averti et non refusé, et tout `.tsx` hors page et
layout déclaré `'use client'`. Pour que la matrice tienne sans exception
nouvelle, quatre déclarations ont été rapatriées dans le domaine : l'erreur
d'API OTF et l'extraction de collection (`lib/domain/otf/api-contract.ts`),
`WaterDashboardDay`, `IrrigationHistoryExportData` et le contrat de la
synchronisation météo automatique (`lib/domain/weather/automatic-sync-contract.ts`)
que `db/automatic-weather-repository.ts` importait depuis un service. Le
lint a aussitôt signalé trois imports devenus inutiles, retirés. Le contrat
est amendé : le serveur `app/` peut importer les adaptateurs, ce que la page
et une action faisaient déjà.

Le 19 septembre 2026, Q3 troisième PR : `lib/domain/units.ts`, module
unique de conversion d'unités (litres et mètres cubes, millimètres sur
surface, débits et durées, secondes, minutes, heures, jours et
millisecondes), dont les fonctions n'arrondissent pas et reproduisent l'ordre
des opérations d'origine ; un test le vérifie sur des valeurs non entières.
Soixante-deux facteurs remplacés dans vingt-six fichiers d'`app/`, `lib/`
et `db/` par remplacements exacts ; l'arrondi à trois décimales du CSV
devient `roundToDecimals` dans `lib/domain/irrigation-format.ts`. Règle
`no-restricted-syntax` : `3600` et `60000` interdits partout, `1000`
comme facteur d'une multiplication ou d'une division seulement, car il sert
aussi de borne de saisie et de longueur de texte ; tests et Workers hors
champ. La règle a révélé treize occurrences que la recherche textuelle avait
manquées, dont neuf conversions de temps remplacées et quatre bornes
légitimes laissées. Les facteurs écrits dans le SQL des dépôts restent hors
de portée du lint. Aucun changement de résultat : typage, 417 tests et
compilation.

Le 19 septembre 2026, Q3 quatrième et dernière PR : journaliseur unique
`lib/adapters/log.ts` remplaçant cinq copies identiques ; `knip` 6.37.0
en dépendance exacte, configuré pour le dépôt et les deux Workers, exécuté
par `pnpm knip`, dans `pnpm check` et dans le job « Application » de la CI.
Son rapport, une fois les entrées déclarées, ne montrait aucun fichier
inutilisé hors `db/index.ts` (ORM jamais appelé, supprimé) et 69
exports jamais importés ailleurs : leur mot-clé `export` est retiré, puis le
lint a désigné neuf symboles que plus rien n'utilisait, supprimés (un type
d'instantané, une référence de planche, trois validateurs et trois types
d'anciens échanges Push, une requête SQL, une fonction de prélèvement) ; deux
listes de statuts qui ne servaient plus qu'à typer deviennent des unions de
littéraux. `tailwindcss` était alors ignoré par knip, son import se faisant
dans la feuille de style. Q3 close : les six sous-tranches du socle se
poursuivent avec Q4.

Le 19 septembre 2026, Q4 première PR : retrait de Tailwind (D-012).
`tailwindcss` et `@tailwindcss/postcss` quittent les dépendances, la
configuration PostCSS quitte `vite.config.ts`, et `app/globals.css` importe
`app/preflight.css`, copie figée des couches « theme » et « base » que
Tailwind 4.3.3 compilait pour ce projet (remise à zéro des styles du
navigateur, provenance et licence en en-tête). Trois noms de classes sans
règle (`feasibility-priorities`, `weather-location-form`, `compact`) sont
retirés du balisage, `tailwindcss` sort de la liste des dépendances ignorées
par knip. Preuve d'équivalence : page `/irrigation` en données de
démonstration servie localement, 1 561 éléments comparés avant et après à
1 280 px et à 390 px, cinquante-six propriétés calculées et position de chaque
élément identiques ; la feuille de la page est identique octet pour octet et
la feuille globale ne diffère que par les couches Tailwind inutilisées
(utilitaires, propriétés `--tw-*`). Constat annexe : `pnpm dev` ne démarre
pas sur la machine du porteur (point ouvert 8) ; la comparaison a utilisé le
runtime de wrangler 4.127 et une date de compatibilité abaissée localement,
non versionnée. Les réglages du dépôt prévus en Q4 sont faits le même jour :
suppression automatique des branches fusionnées, alertes Dependabot et
correctifs de sécurité automatiques.

Le 19 septembre 2026, Q4 deuxième PR : Drizzle et migrations (D-018).
`drizzle-orm` passe en dépendance de développement, seul `db/schema.ts`
l'importe pour le test de dérive. Une sonde hors dépôt a montré que
`drizzle-kit generate`, appuyé sur des instantanés incomplets (six sur quinze)
et périmés, proposerait une migration recréant deux tables pour un écart
inexistant : `drizzle-kit`, le script `db:generate`, `drizzle.config.ts` et
`drizzle/meta/` sont retirés. La politique est écrite dans
`docs/migrations-contract.md` : SQL manuscrit, additif, relu, jamais modifié
après fusion, `db/schema.ts` tenu à jour dans la même PR et vérifié par le
test de dérive ; un interdit correspondant entre dans `AGENTS.md`. Les
textes Q2 et Q3 sont redatés au 19 septembre 2026, date de leurs fusions
GitHub, et non au 20.

Le 20 septembre 2026, recette 3.4, premier matin (`docs/recette-3.4.md`) :
A1 réussie, la synchronisation automatique a eu lieu à 06 h 15 comme programmé.
A2 en échec : le panneau météo affichait « Dernière mise à jour : 15/09/2026
18:24 · données anciennes » le matin même d’une synchronisation réussie, parce
que la date retenait les prévisions figées des jours passés, que plus aucune
actualisation ne renouvelle. Correction : la règle est précisée dans
`docs/weather-contract.md` (lectures encore utilisées : réanalyses et
prévisions des jours à venir), portée par `oldestWeatherReadingInUse` dans
`lib/domain/weather/cache-policy.ts`, testée, et appelée par le tableau de
bord. A3 conforme à l’attendu, avec un constat annexe : la pluie réelle des
16, 17 et 18 septembre est absente (réanalyses à J-5, aucune consultation du
15 au 19), donc le besoin de la semaine est non calculable ; limite documentée,
décision du porteur attendue. Une irrigation réelle de 598,2 mm sur une planche
de 16,5 m² est à vérifier par le porteur. Le point ouvert 2 reste ouvert
jusqu’au second matin (A4).

Le 20 septembre 2026, décision D-019 prise par le porteur devant cette semaine
entièrement non calculable : un besoin est désormais toujours chiffré. La pluie
d’un jour écoulé est la mesure du pluviomètre, sinon la réanalyse, sinon la
prévision enregistrée pour ce jour, sinon zéro ; celle d’un jour à venir est sa
prévision, sinon zéro. Les jours sans pluie réelle restent listés, et ceux
repris de la prévision sont distingués de ceux comptés zéro ; l’interface
affiche le besoin suivi de « partiel » et de ces dates, comme pour l’ET0. Seul
un objectif absent laisse encore un besoin non calculable, puisqu’il n’y a
alors aucune cible. Défaut corrigé au passage : le jour courant appartenait à
la fois aux jours écoulés et aux jours à venir, sa pluie pouvait donc être
déduite deux fois ; chaque jour compte maintenant une seule fois, le jour
courant étant rattaché au réel. Contrat `docs/irrigation-needs-contract.md`
mis à jour.

Le 20 septembre 2026, Q4 troisième PR : les types Cloudflare Workers passent de
`4.20260515.1` à `5.20260916.1`, version exacte, seule dépendance modifiée.
Ces types décrivent l'environnement d'exécution pour le compilateur et ne
produisent aucun code ; ils sont déclarés une fois dans `tsconfig.json` et
couvrent l'application comme les deux Workers. Aucun ajustement de code n'a été
nécessaire. La PR Dependabot correspondante est fermée, le dépôt portant le
changement dans sa propre branche.

Le 20 septembre 2026, le porteur de projet demande que le modèle et l'effort
soient adaptés à chaque tâche plutôt qu'alignés sur le plus capable. La colonne
« Modèle · effort » de la roadmap est revue : la version du 18 septembre
plaçait Fable 5.1 sur presque toutes les lignes, ce qui était une prudence par
défaut et non une allocation réfléchie. Quatre critères sont désormais écrits
et seuls eux décident : qui juge le résultat, ce que coûte une erreur non vue,
la liberté de conception, l'étendue du contexte. Le volume de modifications
mécaniques n'entre plus en compte. Cinq cas en découlent, de Fable 5.1 · Max
pour les règles agronomiques à Sonnet 5 · Moyen pour la documentation seule.
Chaque sous-tranche à venir porte maintenant sa justification en clair. Q4, Q5,
Q6, 3.1 bis, 3.4, 3.6, 3.8, 4.1, 4.4 et 4.5 passent à Opus 5 ; le cadrage et le
moteur du planning, la replanification, les scénarios de pénurie, l'isolation
des données et l'identité restent en Fable 5.1. Les lignes terminées gardent le
relevé de ce qui a été réellement employé.

Le 20 septembre 2026, Q4 quatrième PR : lot Vite. `vite` `8.0.13` vers `8.3.0`,
`vinext` `1.0.0-beta.3` vers `1.0.0-beta.10`, `@cloudflare/vite-plugin` `1.37.1`
vers `1.56.0`, `@vitejs/plugin-rsc` `0.5.26` vers `0.5.35`, `wrangler` `4.127.1`
vers `4.135.0` à la racine et dans les deux Workers, types Workers
`5.20260918.1` pour satisfaire Wrangler. Ces paquets ne se mettent à jour qu'en
bloc : montés séparément, leurs types se contredisent, ce qui expliquait l'échec
`TS2321` de la PR Dependabot #13. Montés ensemble, le typage passe. Le point
ouvert 8 est résolu au passage : le greffon `1.56.0` embarque un runtime du
18 septembre 2026, donc `pnpm dev` démarre avec la date de compatibilité réelle
du Worker et sert `/irrigation` en HTTP 200, sans le contournement mis en place
la veille. Quatre alertes de vulnérabilité sur `vite` sont levées. Celles qui
restent sur `undici` et `ws` proviennent de Wrangler et Miniflare, outils de
développement qui ne partent jamais dans le Worker déployé.

Le 20 septembre 2026, Q4 cinquième PR : lot React. `react`, `react-dom`,
`react-server-dom-webpack`, `@types/react` et `@types/react-dom` passent
ensemble en `19.3.0`. Ces cinq paquets forment une famille dont les versions
doivent rester alignées, ce qui explique l'échec de compilation de la PR
Dependabot #4, qui n'en montait que deux. Recette visuelle sur la page
`/irrigation` servie localement : l'arbre des 1 575 éléments est identique
avant et après, sans un seul écart de style calculé ni de position, à 1 280 px
comme à 390 px, et sans erreur de console. Les treize éléments ajoutés sont des
balises de script d'amorçage, invisibles et de dimension nulle. Deux alertes de
vulnérabilité sur `react-server-dom-webpack` sont levées.

Le 20 septembre 2026, le porteur relève dans le journal des appels d'Ouvre ta
ferme un `429` sur `/bedList` à 18 h 12, « Rate limit exceeded (max 4 par
second) ». Cause trouvée : le régulateur de débit vivait dans chaque
`OtfReadClient`, or le service en construit un neuf à chaque lecture. Une seule
lecture respectait bien les 250 ms, mais deux lectures simultanées, lancées par
exemple par la page et par une action serveur, disposaient chacune de leur
propre compteur et pouvaient cumuler jusqu'à huit appels par seconde. Le quota
étant celui du jeton et non de l'objet qui appelle, le régulateur devient unique
pour tout le module. Un `429` impose en outre une seconde de silence vers OTF,
sans jamais retenter l'appel. Le contrat est complété et deux tests encodent la
règle : quatre départs lancés par deux clients différents restent espacés d'au
moins 250 ms, et rien ne repart pendant une seconde après une limite.

Le 20 septembre 2026, Q4 sixième PR : `@block65/webcrypto-web-push` passe de
`1.0.2` à `2.0.0` dans le Worker Push. La version majeure ne change rien à
l'usage qu'en fait `delivery.ts` : la bibliothèque accepte toujours une chaîne
JSON telle quelle, et les en-têtes produits gardent la même forme. Aucun
ajustement de code n'a été nécessaire, contrairement à ce que laissait craindre
l'échec de la PR Dependabot #6, antérieur à tout le socle qualité. Manque
comblé au passage : les tests de livraison remplaçaient la construction du
message par un leurre, si bien que le chiffrement n'était jamais exercé. Deux
tests l'appellent désormais pour de bon, avec des clés engendrées à la volée.
L'essai réel de notification sur téléphone reste à la charge du porteur ; il ne
peut pas être automatisé et ne doit jamais être annoncé comme tel. Fait le
20 septembre 2026 : notification reçue et lisible. Un premier essai avait été
mené avant la fusion, donc sur la version précédente encore déployée, et ne
prouvait rien de la mise à jour ; le porteur l'a signalé de lui-même et l'essai
a été refait après déploiement. Aucun verdict n'a été consigné entre-temps.
Enseignement retenu pour les recettes suivantes : dire explicitement qu'une
vérification ne vaut qu'après la mise en ligne de la version concernée.

Q4 est close le 20 septembre 2026. Les six sous-tranches du socle qualité sont
désormais acquises pour Q0 à Q4 ; restent Q5, parcours navigateur automatisés,
et Q6, découpage des fichiers concentrateurs.

Le 20 septembre 2026, le porteur de projet décide de les faire passer devant
3.1 bis et 3.5.0, qui les précédaient dans l'ordre d'exécution. Motif : finir le
socle avant d'écrire du code nouveau, pour que tout ce qui suit soit protégé dès
sa première ligne. L'ordre devient Q5, Q6, 3.1 bis, 3.5.0, puis le moteur. Coût
assumé : la mesure du débit et le cadrage du planning sont retardés d'autant.
Deux réserves consignées dans la roadmap : le cadrage 3.5.0 n'écrit aucun code
et peut être avancé à tout moment, d'autant qu'il demande sa propre validation
agronomique ; l'interface 3.6 attend Q6 dans tous les cas.

Le 20 septembre 2026, Q5 engagée, première PR : le socle des parcours
navigateur, sans parcours métier encore. Contrat
`docs/browser-journeys-contract.md` écrit avant le code. Trois sources de
hasard sont fermées pour qu'un parcours prouve quelque chose : les données
Ouvre ta ferme de démonstration et l'utilisateur de démonstration existaient
déjà, la météo manquait. Un fournisseur météo de démonstration, sans réseau et
dont les valeurs ne dépendent que de la date, est retenu par
`WEATHER_DATA_SOURCE=mock`, sur le modèle de `OTF_DATA_SOURCE` ; la valeur par
défaut reste `live` et la production ne pose jamais ce réglage. L'attribution
affichée est corrigée au passage : une donnée de démonstration était créditée à
Open-Meteo, ce qui faisait dire faux à l'écran sur l'origine de ses valeurs.
La manière d'appliquer les migrations à la base locale, qui n'était pas
documentée, l'est désormais et `pnpm e2e:reset` la remet à zéro avant chaque
exécution. Le harnais Playwright joue chaque parcours à 1 280 px et à 390 px et
ajoute deux contrôles transverses, aucun débordement horizontal et aucune
erreur de console. Un job d'intégration continue séparé, « Parcours
navigateur », les joue à chaque PR et conserve traces et captures en cas
d'échec ; le déploiement en dépend désormais.

Le 20 septembre 2026, Q5 deuxième PR : le premier parcours métier, irriguer
maintenant avec minuteur. Il crée un matériel, son réglage et sa position sur
le plan, calcule une irrigation d'une minute, démarre le minuteur, recharge la
page pour vérifier qu'il survit, puis termine l'irrigation. Deux pièges méritent
d'être notés pour les parcours suivants. Le titre de la page vient du serveur et
paraît bien avant que React ne reprenne la main : un clic envoyé dans cet
intervalle ne déclenche rien, d'où un premier clic réessayé jusqu'à ce que la
fenêtre s'ouvre, à ne pas généraliser aux boutons qui basculent. Et l'écran
refuse une durée réelle nulle : un arrêt à l'instant du démarrage est rejeté, le
parcours attend donc que le minuteur ait visiblement avancé.

Le 20 septembre 2026, Q5 troisième PR : les parcours de planification et de
saisie après coup. Planifier puis annuler vérifie qu'une irrigation à venir
apparaît, puis qu'elle disparaît sans laisser d'irrigation réalisée. Saisir une
irrigation déjà réalisée vérifie qu'une fin antérieure au début est refusée,
l'écran désactivant l'enregistrement plutôt que d'accepter puis de se plaindre,
puis que la saisie correcte passe. Deux corrections de méthode en découlent :
les matériels créés portent désormais le nom du parcours en plus de la largeur,
deux parcours retombant sinon sur le matériel l'un de l'autre ; et chaque
parcours ne juge que ce qu'il a créé, une première version ayant exigé une
liste vide alors qu'un autre parcours y avait laissé un reliquat à terminer.

Le 20 septembre 2026, Q5 quatrième PR et clôture : le parcours des cumuls et de
l'export. Il enregistre une irrigation, change de période, ouvre un détail et
suit le lien d'export jusqu'au fichier, dont il vérifie le type, l'encodage et
la présence des accents. Une troisième correction de méthode s'imposait : les
compteurs de la page additionnent ce que tous les parcours ont laissé sur la
même base et ne prouvent donc rien d'un enregistrement précis ; l'attente porte
maintenant sur le champ de note, que seule la réussite de cette soumission-là
vide. Sans elle, le parcours rechargeait la page avant la fin de l'action
serveur et l'irrigation n'existait jamais. Deux constats sans correction de
code : les cumuls ne se recalculent pas quand une irrigation est enregistrée
ailleurs dans la page, un retour sur la page suffisant ; et l'écran désactive
l'enregistrement d'une irrigation dont la fin précède le début, plutôt que
d'accepter puis de se plaindre. Q5 est close ; reste Q6 avant le moteur.

Le 21 septembre 2026, Q6 engagée, première PR : le contrat de découpage
(`docs/file-splitting-contract.md`), écrit avant le code comme les précédents.
Il pose ce qu'un découpage ne change jamais — aucun comportement, aucune
correction opportuniste, aucune règle métier déplacée vers l'interface, aucun
renommage de confort —, la méthode propre à chaque famille de fichier, et la
preuve exigée à chaque PR : `pnpm check`, les quatre parcours navigateur aux
deux largeurs, et pour la feuille de style la comparaison des styles calculés
qui avait servi au retrait de Tailwind. Six fichiers dépassent la limite de 600
lignes et la feuille de style en concentre 5 137 ; huit PR sont prévues. La
décision D-020 ferme l'exception laissée par Q3 : les types d'enregistrement
descendent de `db/` vers `lib/domain`, le domaine cessant de dépendre de la
base même en type seulement.

Le 21 septembre 2026, Q6 deuxième PR : la décision D-020 appliquée. Quatre
modules de types créés dans le domaine — `equipment-record`,
`equipment-placement-record`, `garden-group-record`, `irrigation-event-record`
— et les déclarations qui y sont déplacées, sans qu'un seul champ change.
Trente et un fichiers réécrivent leurs imports ; la tolérance ESLint qui
autorisait le domaine à lire `db/` en type disparaît, et le test de frontières
qui la vérifiait devient un cas de refus. Les dépôts perdent au passage
119 lignes nettes de déclarations : celui des irrigations tombe de 1 292 à
1 228 lignes comptées par ESLint, celui des matériels de 731 à 709. Aucun composant client n'importe plus `db/`,
la tolérance qui le permet en type restant en place pour les retours d'actions
serveur. Constat sans correction, conformément au contrat : `IrrigationTimerState`
est déclaré à l'identique dans `irrigation-domain.ts` et dans
`irrigation-timer.ts`, à traiter dans sa propre PR.

Le 21 septembre 2026, Q6 troisième PR : le dépôt des irrigations découpé. Un
fichier de 1 284 lignes devient dix modules dans `db/irrigation-event/`,
rangés selon le cycle de vie d'une irrigation plutôt que selon la forme des
requêtes : `rows` (lignes SQL et lecture d'une ligne, 189), `ownership` (à qui
appartient l'irrigation, 76), `conflicts` (avertissements rendus avec chaque
écriture, 77), `event-log` (journal, 53), `push-schedule` (alarmes, 80),
`read` (180), `create` (273), `timer` (démarrage, pause, reprise, 193),
`completion` (fin et annulations, 178), `errors` (29). Le fichier d'origine
disparaît : pas de module tonneau, chaque importateur nomme le module réel,
quatorze fichiers réécrivent leurs imports. Vérification décisive : le corps
de l'ancien fichier et la réunion des nouveaux contiennent exactement les
mêmes lignes, au mot-clé `export` près ; aucune ligne perdue, dupliquée ni
réécrite. Le test de dépôt est renommé `tests/db/irrigation-event.test.ts` et
le test de migration lit désormais le filtre de période dans `read.ts`. La
méthode de comparaison ligne à ligne est ajoutée au contrat comme première
vérification de chaque découpage.

Le 21 septembre 2026, Q6 quatrième PR : le dépôt des matériels et le module
d'historique découpés. `db/equipment/` en sept modules — `read` (145),
`equipment` (création, modification, archivage, suppression, 168), `settings`
(218), `duplication` (132), `ownership` (55), `rows` (31), `errors` (43).
`lib/domain/irrigation-history/` en six — `contract` (le vocabulaire :
périodes, portées, cumuls, lignes, 150), `dates` (54), `period` (69), `scope`
(99), `summary` (224), `items` (173). Comparaison ligne à ligne sans écart
dans les deux cas. `knip` a signalé neuf fonctions rendues publiques par le
découpage alors qu'elles ne franchissent aucune frontière de fichier : elles
redeviennent locales, et un cycle d'import entre les cumuls et les lignes a
été évité en plaçant la date représentative d'une irrigation avec les autres
fonctions de date. Les deux tests de dépôt concernés sont renommés. Restent
trois fichiers trop longs, tous dans `app/irrigation/`.

Le 21 septembre 2026, Q6 cinquième PR : les actions d'irrigation. Le fichier
passe de 648 à 299 lignes ; cinq modules partent dans
`app/irrigation/irrigation-event/` — `contract` (le vocabulaire des actions,
25), `validation` (31), `timing` (les horaires et les durées, 118), `limits`
(limite journalière et contrainte hydraulique, 155), `messages` (63). Un point
propre au cadre : un fichier portant `'use server'` ne peut exporter que des
fonctions asynchrones, or plusieurs des fonctions extraites ne le sont pas. La
directive reste donc sur le seul fichier d'actions, et les modules extraits
sont des modules ordinaires. Comparaison ligne à ligne sans écart. La
sous-tranche passe à neuf PR : le composant d'irrigation, 1 394 lignes, prend
la sienne, une PR de près de deux mille lignes déplacées allant contre l'objet
même du découpage.

Le 21 septembre 2026, Q6 sixième PR : le composant d'irrigation, 1 459 lignes,
ramené à 545. Neuf modules dans `app/irrigation/irrigation-manager/` : trois
hooks — `use-farm-clock` (l'heure de l'écran, 38), `use-irrigation-preview`
(les calculs du formulaire, 231), `use-irrigation-notifications` (205) —, les
formats d'affichage (`presentation`, 143), le signal de fin
(`completion-signal`, 44) et quatre fichiers de composants (`irrigation-cards`
239, `irrigation-form` 119, `notification-readiness` 61,
`finish-irrigation-dialog` 52).

Méthode retenue pour un composant React : le hook plutôt que le sous-composant.
Un hook est un simple appel de fonction, les `useState` s'exécutent dans la même
instance et le comportement est identique ; déplacer l'état vers un
sous-composant aurait été une réécriture. La déstructuration reprend les noms
d'origine, si bien que ni les calculs ni les 320 lignes d'affichage ne changent
d'une ligne. La comparaison montre que rien n'a disparu de l'original ; les
seuls ajouts sont le raccordement des hooks, ce que le contrat autorise
désormais explicitement pour ce cas.

Un changement consigné, sans effet observable : l'écoute du retour à l'écran et
l'enregistrement du service worker sont deux effets indépendants, et leur ordre
s'inverse. Les listes d'irrigations, simples filtres sur une propriété,
remontent au-dessus des appels de hooks.

Les modules clients sans JSX sont désormais visés par la règle ESLint des
composants clients et par le test qui exige la déclaration `'use client'` :
sans cela, extraire un hook aurait ouvert un trou dans une frontière de Q3.

Le 21 septembre 2026, Q6 septième PR : l'explorateur du plan, 1 409 lignes,
ramené à 454. Six modules dans `app/irrigation/hierarchy/` :
`use-placement-editor` (le placement d'un matériel sur le plan, 295),
`plot-plan-card` (la carte du plan, son glisser-déposer et son menu, 421),
`placement-toolbar` (155), `coverage-overview` (85), `presentation` (76) et
`selected-bed-details` (37). Même méthode que pour le composant d'irrigation :
le hook plutôt que le sous-composant, la déstructuration reprenant les noms
d'origine. L'ordre des effets est cette fois conservé à l'identique, les
valeurs dérivées dont le hook a besoin ayant été remontées avant son appel.

Plus aucun fichier du projet ne dépasse 600 lignes. Il reste la feuille de
style, que la règle ne couvre pas, puis le durcissement de la règle.

Le 21 septembre 2026, Q6 huitième PR : la feuille de style, 5 137 lignes,
devient dix-huit fichiers dans `app/irrigation/styles/`, un par composant :
`shell`, `placement`, `coverage`, `plan`, `irrigation-events`,
`irrigation-form`, `irrigation-records`, `history`, `water-resources`,
`water-dashboard`, `plan-details`, `garden-groups`, `equipment`,
`equipment-settings`, `responsive`, `pumps`, `needs`, `feasibility`. Le point
d'entrée ne garde que la liste des `@import`, dans l'ordre d'origine.

Les coupures tombent aux frontières de blocs de premier niveau et le texte est
tranché aux décalages réels, pas aux numéros de ligne : la première tentative,
qui coupait à la ligne, est tombée au milieu d'un sélecteur écrit sur deux
lignes et la compilation l'a refusée. La concaténation des dix-huit fichiers
redonne l'original caractère pour caractère.

Preuve obtenue, plus forte que celle prévue au contrat : la feuille produite
par la compilation est identique octet pour octet avant et après, empreinte du
fichier comprise. Le navigateur reçoit exactement les mêmes octets ; la
comparaison des styles calculés devient inutile et reste la vérification de
repli si un jour les deux feuilles diffèrent.

Deux tests gardent le découpage, ESLint ne lisant pas le CSS : le point
d'entrée ne contient que des `@import` et leur liste couvre exactement les
fichiers présents ; aucun fichier de styles ne dépasse 600 lignes. Le test
d'accessibilité, qui vérifie la cible tactile des menus, lit désormais
l'ensemble des fichiers dans l'ordre d'assemblage.

Le 21 septembre 2026, Q6 neuvième PR et clôture : la règle `max-lines` passe
d'avertissement en erreur. S'y ajoute un test qui lit le dépôt réel et non un
extrait : la limite n'est pas seulement configurée, elle est constatée. Le cas
de lint qui vérifiait la sévérité de la règle attend maintenant une erreur.

Bilan de la sous-tranche. Sept fichiers découpés en soixante et un modules
nouveaux, plus quatre modules de types descendus dans le domaine (D-020). Le
plus long fichier du projet passe de 1 459 à 545 lignes ; la feuille de style,
5 137 lignes, devient dix-huit fichiers. Aucune ligne de code modifiée,
vérifié à chaque PR par comparaison ligne à ligne, et la feuille compilée est
identique octet pour octet. Vingt-neuf déclarations rendues publiques par un
découpage sont redevenues locales. Deux constats consignés sans correction :
`IrrigationTimerState` déclaré deux fois à l'identique dans le domaine, et
deux effets indépendants du composant d'irrigation qui ont changé d'ordre.

**Le socle qualité est entier, de Q0 à Q6.** Tout le code écrit à partir de
maintenant est protégé dès sa première ligne : tests de persistance sur SQLite,
frontières entre zones tenues par le lint, parcours navigateur aux deux
largeurs, taille maximale des fichiers en erreur, code mort détecté. La suite
de la roadmap reprend : 3.1 bis, puis le cadrage 3.5.0.

Le 21 septembre 2026, 3.1 bis engagée, première PR : le contrat de mesure du
débit des ressources (`docs/resource-flow-contract.md`). Première fonctionnalité
écrite sous le socle complet. Quatre décisions du porteur : durée d’arrêt entre
deux relevés saisie à la main ; une mesure ne change jamais la référence toute
seule, un bouton « Mettre à jour le débit de la ressource » placé sous le
résultat l’applique ; le débit appliqué remplace le débit nominal de la
ressource ; un index qui recule est refusé sauf changement de compteur déclaré.

Point tranché par le contrat : c’est le débit **en fonctionnement** qui fait
référence, et non le débit moyen sur la période. `resourcePotentialForSegment`
multiplie le débit de la ressource par ses heures de disponibilité, si bien
qu’un débit incluant les arrêts rendrait les projections pessimistes pour une
raison sans rapport avec le forage.

Le contrat a été repris deux fois en séance, sur le même sujet : qui décide du
débit de référence, et quand.

J’avais d’abord retenu une promotion explicite depuis l’historique, plus un
avertissement au-delà de 20 % d’écart, en invoquant le risque d’une mesure
faussée par un désamorçage. Le porteur a corrigé sur les deux plans : une pompe
de forage correctement réalisée ne se désamorce pas, et si la mesure est bonne,
la référence est bonne. J’ai alors basculé vers une mise à jour automatique,
dont l’argument était qu’une validation séparée s’oublie et laisse la
faisabilité tourner sur un chiffre périmé. Le porteur a tranché la synthèse :
**un bouton « Mettre à jour le débit de la ressource » placé sous le résultat
de la mesure**. La décision lui revient, mais elle se prend là où la valeur
s’affiche, en un geste, et non dans un écran séparé qu’on oublie.

Conséquences. La référence redevient une décision, donc une révision datée et
immuable (D-006), sur le modèle des révisions de limite de prélèvement ; le
débit de la ressource reste la valeur matérialisée que cette révision justifie.
Corriger un relevé ne réécrit donc pas silencieusement la référence : si la
correction rend une mesure appliquée fausse, il faut la réappliquer, le bouton
restant disponible sur toute mesure de l’historique. L’écart en pourcentage
subsiste comme mise en évidence, non comme barrière. Une référence par saison
reste écartée, à rouvrir si une année de mesures montre une saisonnalité nette.

Le 22 septembre 2026, 3.1 bis deuxième PR : le module de calcul
(`lib/domain/resource-flow.ts`, 198 lignes) et ses quatorze tests. Domaine pur,
sans base ni écran. Il porte la validation d'un relevé, la mesure d'une paire
de relevés, la série complète d'une ressource et le changement de référence
qu'une mesure entraînerait. L'exemple du cahier des charges est figé par un
test : 1,125 m³/h en fonctionnement, 0,375 m³/h en moyenne sur la période, pour
le même forage.

Deux précisions apportées par l'écriture du code et reportées au contrat.
D'abord, une pompe restée à l'arrêt toute la période donne un débit moyen nul
et **aucun** débit en fonctionnement : zéro serait un chiffre inventé, et cette
mesure ne peut donc pas être appliquée à la ressource. Ensuite, un relevé
rattrapé après coup est vérifié des deux côtés : en s'intercalant, il
raccourcit l'intervalle du relevé suivant, et une durée d'arrêt qui tenait dans
l'ancien intervalle peut ne plus tenir dans le nouveau. Un test échoué a révélé
ce cas, et il révélait le code juste et le test faux.

Le 22 septembre 2026, 3.1 bis troisième PR : la persistance. Migration additive
`0015_resource_meter_readings.sql` créant `irrigation_water_resource_meter_readings`
et `irrigation_water_resource_flow_revisions` ; `db/schema.ts` complété et test
de dérive vert ; dépôt `db/water-resource-flow-repository.ts` (294 lignes) et
ses treize tests d'exécution sur SQLite. Le dépôt sait lire, écrire, corriger et
supprimer un relevé, lire les révisions, et appliquer un débit — ce dernier
geste fermant la révision en vigueur, en ouvrant une nouvelle et remplaçant le
débit de la ressource, le tout dans un seul lot.

Deux points relevés à l'exécution. La contrainte d'unicité de la base attrapait
bien deux relevés au même instant, mais avec un message de base de données :
la recherche du voisin précédent compare désormais avec `<=`, si bien que le
domaine refuse le doublon pour durée écoulée nulle et que le message reste
lisible. Et le piège de Q2 s'est représenté : Node exécute les tests en mode
« strip-types », qui refuse une propriété déclarée dans la signature d'un
constructeur.

Trois tests existants ont été mis à jour, non parce qu'ils avaient tort mais
parce que le dépôt a changé : le nombre de tables applicatives passe de 38 à 40,
dans le test d'adaptateur, celui de l'export-import et la liste nommée du test
de migration.

Le 22 septembre 2026, 3.1 bis quatrième PR : l'écran et son parcours. Panneau
`app/irrigation/resource-flow-panel.tsx` ouvert depuis la fiche d'une
ressource, graphique `resource-flow-chart.tsx`, service
`lib/services/resource-flow-history.ts`, actions ajoutées à
`water-resource-actions.ts`, feuille de style `styles/resource-flow.css`
importée à sa place dans l'ordre.

Deux décisions de conception prises pendant l'écriture. Le débit appliqué est
**recalculé côté serveur** à partir des deux relevés désignés : le navigateur
ne dit que sur quels relevés porter la décision, jamais quelle valeur écrire.
Et les actions de relevé renvoient le **tableau de bord complet** comme les
autres, au lieu d'un historique isolé : appliquer un débit change la référence
de la ressource, donc les projections ; ne rafraîchir que l'historique laissait
l'écran afficher l'ancien débit.

Le cinquième parcours navigateur est livré **avec** l'écran et non dans la PR
suivante : un écran qu'aucun parcours ne traverse est précisément ce que Q5
existe pour empêcher, ne fût-ce que le temps d'une PR. Il a payé tout de suite,
en révélant deux défauts avant toute relecture : la ressource affichée par le
panneau était une copie figée à l'ouverture, donc elle gardait l'ancien débit
après la mise à jour, et le rafraîchissement partiel décrit plus haut. Il a
aussi reproduit deux pièges déjà connus de Q5, l'hydratation du premier clic et
un libellé ambigu — « Nom » correspondant aussi à « Débit nominal ».

Correction d'accessibilité avant publication : le panneau portait
`role="dialog"` alors qu'il s'affiche dans la page. Un lecteur d'écran
attendrait un piège de focus qui n'existe pas ; c'est devenu une `section`
nommée, et le parcours la désigne comme telle.

Le 22 septembre 2026, 3.1 bis cinquième PR : le protocole de recette réelle
(`docs/recette-3.1bis.md`) et les registres. Dix-sept vérifications en deux
passages au forage, séparés de quelques heures : le premier relevé et la tenue
de l'écran sur téléphone, le second la mesure et ses chiffres, puis la mise à
jour du débit et son effet sur la faisabilité. Trois lignes portent sur les
refus, à noter si l'occasion se présente plutôt qu'à provoquer.

Deux manques relevés par le porteur à la lecture de cette recette, et corrigés
dans la même PR pour l'un, portés en sixième PR pour l'autre. Le tableau des
relevés n'était pas vraiment vérifié : la première version se contentait de
constater qu'un relevé apparaissait dans la liste, sans contrôler l'ordre, les
index, la note ni la suppression. Cinq lignes ont été ajoutées, portant la
recette à vingt-deux vérifications.

Le second manque est réel et porte sur la fonctionnalité : **il n'existe aucun
historique des consommations**. Le volume produit est calculé pour chaque
mesure mais cumulé nulle part, si bien que rien ne dit ce que le forage a sorti
dans le mois. Or l'application connaît déjà la limite de prélèvement autorisée
en m³/jour, et ne s'en sert que pour les projections : elle n'a jamais pu la
comparer au prélèvement réel, faute de le mesurer. Maintenant qu'elle le
mesure, la comparaison devient possible, et pour un forage elle relève souvent
de l'obligation déclarative. Une sixième PR l'ajoute.

Le 22 septembre 2026, 3.1 bis sixième PR : le suivi des consommations. Sous le
graphique, le volume réellement sorti est cumulé par mois civil, avec un total
sur la période affichée et, quand une limite de prélèvement est active, la part
qu'il occupe dans le volume autorisé. Deux fonctions ajoutées au domaine,
`resourceConsumptionByMonth` et `authorisedEnvelope`, avec quatre tests ; un
bloc dans le panneau ; quatre lignes de recette ; le cinquième parcours étendu.

Deux règles écrites au contrat plutôt que laissées implicites. Le volume d'une
mesure est porté au mois de son relevé d'arrivée, **sans répartition au
prorata** quand elle chevauche deux mois : répartir supposerait un débit
constant sur l'intervalle, ce qui est faux puisque la pompe tourne par
à-coups ; relever une fois par mois rend le rattachement exact, et l'écran le
dit. Et la part de l'autorisé est une **enveloppe, pas une preuve de
conformité** : une limite journalière peut être dépassée un jour sans que le
total du mois le montre. L'écran l'écrit, parce qu'un chiffre rassurant qui ne
prouve rien est pire qu'une absence de chiffre.

La sous-tranche est **développée**, non close : la recette réelle est la seule
partie de la preuve de fin que ni les 458 tests ni les quatorze vérifications
navigateur ne peuvent faire à la place du porteur, aucun d'eux n'ayant jamais
lu un compteur. Elle se clôt à son compte rendu.

Y figure aussi la demande restée sans réponse : les chiffres de l'exemple du
cahier des charges. Le contrat retient 9 m³ produits en vingt-quatre heures
dont seize d'arrêt, soit 1,125 m³/h ; seul le résultat figurait dans la
roadmap, le reste est reconstitué. Une correction ne coûterait qu'une ligne de
test.

Le 24 septembre 2026 au soir, **recette 3.4, parties B et C**
(`docs/recette-3.4.md`) : vingt vérifications sur vingt-deux passent, aucun
défaut. B2.2 et C2 n'ont pas de cas à observer sur cette ferme cette semaine,
B6 reste au porteur. L'arbitrage manuel tient sur tous les points délicats :
même fraction du besoin pour chaque planche retenue au centième près,
20,83 mm · 0,50 m³ chacune ; reliquat redescendu à la priorité inférieure
quand rien n'est retenu ; décision conservée à l'identique après rechargement ;
et allocations remises à zéro dès qu'un changement de priorité rend la décision
caduque, avec le message « L'ancien arbitrage Haute n'est plus applicable ; les
exclusions ne seront pas réactivées automatiquement ».

Ce qui a changé dans la méthode : le porteur a donné à l'assistant l'accès à
son navigateur et l'autorisation de modifier les données, le logiciel n'étant
pas en service opérationnel. **Les constats de B1 à B5 et de C ont donc été
relevés par l'assistant**, non par le porteur. Cela vaut pour le constat, pas
pour le jugement : une recette éprouve deux choses distinctes, ce que le
logiciel affiche — qu'un observateur attentif vérifie mieux, notamment quand il
faut resommer 164 planches — et si ce qu'il affiche est juste pour la ferme,
que le porteur seul peut dire. La recette nomme qui a constaté quoi.

Deux écarts au protocole, motivés dans la recette. La prémisse de B3 ne tenait
pas : avec des planches de 24 m² et 114 m³ d'eau, deux besoins manuels de 60 mm
ne créent aucune pénurie, et il aurait fallu inscrire 2 400 mm. La rareté a
donc été créée par l'autre bout, forage indisponible et réserve à 1 m³, un été
sec. Et les deux planches ont été montées en priorité haute, faute de quoi,
toutes les priorités étant à « normale », il n'existait aucune priorité
inférieure pour B3.4. Tout a été remis en état et revérifié après rechargement :
besoins totaux 54,645 m³, mobilisable 30,00 m³, déficit 0,00 m³, couverture
100 % — les chiffres du début.

Trois constats annexes, non bloquants. **139 planches sur 164 n'avaient ni
pompe, ni origine, ni liaison définie**, d'où une couverture confirmée de
15,44 % là où la couverture volumétrique atteignait 100 % : non un défaut, le
logiciel le disait planche par planche, mais un manque de données. L'en-tête de
la section mêle deux formats de date. Et **aucun parcours navigateur ne couvre
l'écran d'arbitrage**, à aucune largeur, alors que c'est l'écran où un clic
engage de l'eau.

Le 24 septembre 2026 dans la foulée, **le matériel réel de la ferme a été saisi
et la couverture hydraulique est passée à 100 %**, à la demande du porteur et
avec le seul outil existant : aucune ligne de code, aucune requête ad hoc. Ont
été créés douze rampes d'aspersion mobiles, une par jardin de plein champ non
encore couvert — les blocs 2 et 3 l'étaient déjà par rampe 1 et rampe 2 —,
quinze goutte-à-goutte mobiles à 14 mm/h répartis sur les blocs, et quatre
goutte-à-goutte **fixes à 10 mm/h**, un par tunnel, couvrant chacun ses huit
planches. Les trente-quatre matériels sont rattachés à « La pompe ». Inventaire
final : 14 en aspersion, 20 en goutte-à-goutte, 34 positionnés ; faisabilité
recalculée, « Dont chaîne connue : 54,645 m³ » soit la totalité du besoin,
**couverture confirmée 100 %, zéro planche sans chaîne sur 164**.

**Corrigé le 24 septembre au soir, sur relecture du porteur : l'irrigation sous
serre est de l'aspersion, non du goutte-à-goutte.** J'avais compris
« goutte-à-goutte » là où il fallait une rampe. Le porteur a créé le matériel
« Rampe de serre » — aspersion, fixe, portée 8 m ; il a été posé sur le tunnel 1
et dupliqué pour les trois autres. Mes quatre goutte-à-goutte de tunnel ont été
retirés : trois archivés, donc récupérables, et un supprimé définitivement par
le porteur lui-même sur la fenêtre de confirmation. Inventaire final :
**34 matériels actifs, 18 en aspersion, 16 en goutte-à-goutte**, couverture
confirmée toujours **100 %**, zéro planche sans chaîne sur 164. Les débits sont
inchangés, 960 L/h sur le tunnel 1 et 1,92 m³/h sur les trois autres : c'est la
nature du matériel qui était fausse, pas le volume.

Trois questions du porteur, tranchées le même soir. **Le chevauchement sur la
planche B6-10 n'est pas un défaut d'affichage** : la bulle donne « rampe bloc 6 :
2 mm/h · rampe BF3 : 1,16 mm/h », et le groupe de jardins alignés « Ouest »
déclare Bloc Fleurs 3 adjacent au bloc 6 à un mètre — une portée de 7,8 m
franchit donc la limite du jardin, ce qui est précisément la raison d'être des
groupes alignés. **Les réglages sont bien modifiables après la pose** : sur
rampe bloc 6 déjà positionnée, le débit à 0,6 m porté de 7,5 à 9 mm/h a fait
passer B6-5 de 7,5 à 9 mm/h aussitôt, sans retoucher la position ; valeur
remise dans la foulée. La crainte était infondée, mais elle a révélé un vrai
manque et le protocole `docs/recette-materiel-reglages.md` a été ouvert : ni
recette ni parcours navigateur n'éprouvaient cette capacité.

La vérification la plus importante — qu'une modification de réglage ne
réécrive pas une irrigation déjà enregistrée (D-006) — a été **éprouvée par un
test de persistance** le soir même, à la demande expresse du porteur :
« vérifie que ce soit éprouvé ». Une irrigation réalisée sous un
goutte-à-goutte à 10 mm/h, puis le même réglage porté à 25 mm/h ; les
millimètres apportés ne bougent pas, chaque planche garde son débit d'origine,
et la copie du réglage archivée avec l'événement vaut toujours 10 mm/h. La base
stocke `equipment_snapshot` et `setting_snapshot` en JSON, colonnes
obligatoires depuis la migration `0001`. Le commentaire du modèle l'affirmait
déjà ; c'est maintenant un test que la CI exécute.

Le renommage des matériels a suivi, à sa demande, pour rendre l'inventaire
homogène : « rampe 1 » et « rampe 2 » deviennent « rampe bloc 2 » et « rampe
bloc 3 », d'après le bloc où elles sont posées, et « Rampe de serre » devient
« Rampe de serre tunnel 1 ». L'inventaire se lit désormais d'un coup d'œil :
rampe bloc 1 à 11, rampe BF, BF2, BF3, Rampe de serre tunnel 1 à 4, gag1 à
gag16.

Deux constats mineurs de plus. **Archiver un matériel affiche « Ce matériel est
introuvable » alors que l'archivage réussit**, trois fois sur trois : l'action
aboutit, mais le message pousserait l'utilisateur à recommencer. Et l'inventaire
compte « 34 matériels actifs … 37 positionnés », les archivés gardant leur
position — plus de positions que de matériels actifs.

Deux points de méthode. La base impose **une position par matériel et par
saison** (`uq_equipment_placements_equipment_season`) : couvrir quatorze
jardins en même temps demande donc quatorze fiches, là où le porteur ne possède
physiquement que quelques rampes qu'il déplace. Il a tranché en connaissance de
cause, et les a voulues **mobiles** : « en général elle reste dans le même bloc
mais elle bouge de quelques planches ». Et les vérifications de débit tombent
juste : 10 mm/h sur les 96 m² du tunnel 1 donnent 960 L/h, sur les 192 m² des
tunnels 2 à 4 donnent 1,92 m³/h.

Le 24 septembre 2026 au soir, **changer le réglage appliqué sans passer par
« Déplacer »**, demandé par le porteur : « en général, une rampe d'aspersion
n'est pas déplacée lorsqu'on modifie le réglage. Ça doit être deux actions
distinctes. » Contrat écrit avant le code
(`docs/equipment-setting-change-contract.md`), puis une liste « Réglage
appliqué » sur la fiche d'un matériel posé qui possède au moins deux réglages.

La difficulté redoutée n'existait pas. Les planches couvertes ne sont pas
recopiées au moment du placement : `calculateIrrigationCoverage` les déduit de
l'ancrage et du profil pour une aspersion, et de la sélection pour un
goutte-à-goutte, que le réglage ne touche pas. Changer le seul `setting_id` de
la position suffit donc, et passer d'une portée de 7,8 m à 4 m rétrécit
l'arrosage sans rien recalculer d'autre.

Livré : `updateEquipmentPlacementSettingForUser` qui n'écrit que `setting_id` et
`updated_at`, l'action `changeEquipmentPlacementSettingAction`, le composant
`app/irrigation/equipment-setting-picker.tsx` placé dans son propre fichier —
l'inventaire était à 586 lignes comptées sur 600 —, et `applyPlacementUpdate`
exposé par le hook de placement pour que la faisabilité soit prévenue, leçon de
la 3.1 bis. Deux tests de persistance et **un sixième parcours navigateur**.

Le parcours a servi tout de suite : il a révélé que la liste faisait déborder la
page à 390 px, largeur du document portée à 444 px, la fiche étant une grille à
colonnes fixes où le sélecteur s'ajoutait comme une colonne de plus. Corrigé
avant la fusion par `grid-column: 1 / -1`. Une régression que ni le typage ni la
relecture n'auraient vue.

À la clôture de la soirée du 24 septembre 2026, une fois les cinq PR fusionnées :
**461 tests, 16 vérifications navigateur**, lint, typage, compilation et knip
verts.

Dette : l'inventaire est à 586 lignes comptées sur 600 ; la prochaine
fonctionnalité qui le touche devra le découper, dans sa propre PR.

Le 25 septembre 2026, **septième parcours navigateur : l'écran d'arbitrage de la
pénurie** (`e2e/p7-arbitrage-penurie.spec.ts`). Il prend la part mesurable de la
ligne B6 de la recette 3.4, qui restait à faire à la main faute de parcours sur
cet écran — celui où un clic engage de l'eau. **18 vérifications navigateur.**

Ce que le parcours éprouve, aux deux largeurs : la pénurie s'affiche avec sa
phrase « … disponibles au maximum pour … de besoins », les cases « Servir »
existent sans quantité à saisir, la décision s'enregistre et se date, aucun
débordement horizontal à aucune des six étapes, et les cibles tactiles — bouton
de validation, étiquette « Servir » — font au moins 44 px de haut.

Ce qu'il n'éprouve pas, et qu'il ne faut pas laisser croire : le projet
`telephone` est un navigateur de bureau à 390 px, `isMobile: false`. Il envoie
des clics, pas des touchers. B6.1 et B6.2 passent donc à « partiel » : la mise
en page est tenue par la CI, le geste sur l'appareil reste au porteur.

Trois obstacles ont été levés en l'écrivant, tous instructifs. Le besoin manuel
est **plafonné à 500 mm** par l'écran : trois planches de démonstration ne
peuvent donc pas épuiser l'eau que le parcours P5 crée avant. Le parcours coupe
donc ses propres ressources, comme un été sec, et les rétablit — un parcours
doit créer sa situation, non hériter de celle du voisin. Ensuite, ouvrir le pli
d'un jardin **avant que React n'ait repris la main** provoque un avertissement
d'hydratation sur l'attribut `open`, qui fait échouer le contrôle de console :
le premier geste vise désormais une bulle d'aide, dont l'effet n'existe que sous
React. Enfin la seconde largeur hérite de la décision d'arbitrage de la
première, d'où « Arbitrage à valider de nouveau » au lieu de « Arbitrage manuel
nécessaire » : l'assertion accepte les deux. Ces trois leçons sont écrites dans
`docs/browser-journeys-contract.md`, qui liste maintenant les sept parcours.

Le 25 septembre 2026, **la recette 3.4 est close**. Le groupe B6, dernier
restant, a été mené le jour même : l'assistant a provoqué la pénurie sur la
ferme réelle à la demande du porteur — forage rendu indisponible, réserve
corrigée à 1 m³, soit **1,00 m³ disponible pour 54,645 m³ de besoins et 164
cases « Servir »** —, le porteur a vérifié sur son propre téléphone, puis
l'assistant a tout rétabli et revérifié : forage disponible à 1,125 m³/h,
réserve à 30 m³, besoins couverts à 100 %, aucun arbitrage en attente.

Le partage est celui qu'on s'est donné : la part mesurable au parcours P7, qui
la revérifie à chaque exécution, et le geste sur l'appareil au porteur, que rien
n'émule. Verdict : « tout va bien ».

**La recette 3.4 est donc entièrement passée, sans un seul défaut bloquant**,
sur quatre séances du 20 au 25 septembre. Le point ouvert 1 est fermé. Il ne
reste plus, pour clore D-016 et la sous-tranche Q0, que la suppression de
l'ancien site OpenAI Sites à partir du 3 octobre.

Le 25 septembre 2026, **huitième parcours navigateur : poser, déplacer et
retirer une aspersion** (`e2e/p8-placer-une-aspersion.spec.ts`). Le placement
était le dernier écran sans filet, relevé par la recette 3.4. Il éprouve aussi
ce qu'aucun autre parcours ne touchait : l'ancrage **entre deux planches** et la
portée qui décide seule des planches atteintes — le profil s'arrête à 1 m, les
voisines immédiates sont arrosées, la troisième non. **464 tests, 20
vérifications navigateur.**

**Et il a trouvé un défaut, plus large que lui.** Retirer la position répondait
« Aucune position enregistrée pour ce matériel » alors que la ligne était bien
partie de la base — vérifié par rechargement. Un seul appel réseau, donc pas de
double soumission. La cause : les dépôts décidaient du succès d'une écriture en
lisant `meta.changes`, que **le D1 réel ne renseigne pas toujours** là où
l'adaptateur SQLite des tests le fait. Les tests de persistance ne pouvaient
donc pas le voir : l'adaptateur était plus complaisant que le vrai moteur.

C'est aussi l'explication du défaut d'archivage constaté le 24 septembre —
« Ce matériel est introuvable » alors que l'archivage réussissait. Le même
piège avait déjà été rencontré et contourné sur place dans
`weatherRefreshClaimed`, sans être nommé. Il l'est désormais :
`db/write-result.ts` porte `aEcritUneLigne`, qui consulte `changes` **et**
`rows_written`, et les cinq endroits qui lisaient `meta.changes` l'utilisent —
archivage et renommage d'un matériel, suppression d'un matériel, d'un réglage,
d'une position et d'un groupe de jardins. Deux tests unitaires pour le module,
un test de persistance pour la suppression d'une position d'aspersion, qui n'en
avait aucun, et le parcours P8 qui prouve la correction de bout en bout.

Le 25 septembre 2026, **les deux derniers constats mineurs de la recette 3.4
sont corrigés**. L'en-tête de la faisabilité mêlait deux formats de date : la
semaine en format brut à côté d'une date de calcul déjà à la française. Les deux
le sont désormais, formatées à midi UTC pour que la date métier ne glisse pas
d'un jour selon le fuseau. Et l'inventaire ne compte plus les matériels
**archivés** parmi les « positionnés » : un matériel archivé garde sa position,
d'où l'affichage « 34 matériels actifs … 37 positionnés », qui se lisait mal.

Les deux sont tenus par les parcours : P7 vérifie le format des deux dates, P8
archive un matériel encore posé et contrôle que le compteur le retire. P8
éprouve du même coup l'archivage et la restauration, donc la correction de
`meta.changes` du même jour, vue depuis l'écran.

**La dette signalée par la recette 3.4 est entièrement soldée.**

Le 25 septembre 2026, **la recette réelle du forage, 3.1 bis, a été relue sur la
version déployée** : le porteur avait relevé son compteur quatre fois — les 11,
15, 19 et 24 septembre — appliqué la mesure du 24 comme référence, et jugé le
résultat correct. Les vingt-six lignes du protocole ont été reprises une à une,
chaque chiffre affiché recalculé, et les cas que le porteur ne pouvait pas
provoquer — refus d'index, changement de compteur, limite de prélèvement — ont
été provoqués par des relevés de contrôle, tous supprimés ensuite. Vingt-quatre
lignes sans défaut. Les chiffres tiennent : 60,8 m³ produits en 119 h de marche,
0,511 m³/h, et la faisabilité annonce 26,152 m³ attendus du forage d'ici
dimanche soir, soit exactement 51 h 11 min à ce débit.

**Deux lignes en défaut, une seule cause.** Le champ « date et heure » ne porte
pas de fuseau, et l'action qui enregistre le relevé tourne dans le Worker, en
UTC : elle y lisait « 06:00 » comme de l'UTC. L'été, un relevé fait à l'instant
était donc daté deux heures plus tard et **refusé comme daté dans le futur** —
le geste normal au forage ne passait pas — et un relevé plus ancien était
enregistré deux heures trop tard. Les débits, eux, restent justes : le décalage
est le même partout et s'annule dans les différences.

Aucun contrôle automatique ne pouvait le voir. Les tests et le parcours P5
tournent sur une machine à l'heure de la ferme, où serveur et navigateur
partagent le fuseau ; seul le Worker déployé est en UTC. C'est la première fois
que la règle « une vérification ne compte que si elle porte sur la version
déployée » rapporte quelque chose qu'aucun test n'aurait trouvé, et elle est
désormais écrite comme telle dans le contrat des parcours.

La correction du même jour lit la saisie à l'heure de la ferme, par l'exact
inverse du pré-remplissage. La conversion « heure d'horloge de la ferme →
instant » n'existe qu'en un seul endroit, `localDateTimeUtc`, où elle servait
déjà à minuit. Le garde-fou est un test qui rejoue la conversion dans un
processus **forcé en UTC**, donc dans les conditions du Worker, plus un test de
source qui vérifie que l'action passe bien par elle.

Le soir même, le porteur a essayé le geste avant que la correction ne soit en
ligne, et **en a révélé un second** : « ce que j'ai rempli dans l'index du
compteur disparaît, par contre mon relevé n'apparaît pas dans la liste ». La
réponse de l'action s'affiche en haut de la section « Ressources en eau »,
617 px au-dessus du bouton sur ordinateur, et le formulaire vidait l'index dans
tous les cas, succès ou refus. Du point de vue du maraîcher, le relevé était
pris puis perdu. La réponse est désormais reprise sous le bouton, et les champs
ne se vident qu'une fois le relevé accepté. Le parcours P5 enregistre un relevé
refusé et vérifie les deux ; le contrôle échoue bien sans la correction,
vérifié. Au passage, son assertion « le champ se vide au succès » ne prouvait
rien jusque-là : le champ se vidait de toute façon.

**Revérification faite le 25 septembre 2026 à 21:39**, PR 93 fusionnée et
déploiement Cloudflare terminé : heure proposée 21:39 non modifiée, relevé
accepté alors qu'il était refusé une heure plus tôt, affiché dans le tableau à
21:39 — l'heure même qui était proposée — et confirmation seize pixels sous le
bouton. Sur un refus, le message paraît au même endroit et l'index saisi reste
en place. Le relevé de contrôle a été supprimé : le forage retrouve ses quatre
relevés, 166,9 m³ en septembre et 0,511 m³/h de référence.

**La sous-tranche 3.1 bis est close le 25 septembre 2026**, ses vingt-six
lignes constatées. Trois défauts trouvés et corrigés le même jour ; aucun
n'était visible autrement qu'en faisant le geste sur le site.

**Les quatre relevés ont été remis à l'heure le soir même**, à la demande du
porteur. Les valeurs exactes ont été relevées avant toute suppression :
l'écran arrondit les index à une décimale, et les retaper tels qu'affichés
aurait introduit jusqu'à cinq litres d'écart par relevé — les index réels sont
519,69, 575,85, 625,79 et 686,58 m³. Les quatre s'affichent désormais à 11:00,
18:42, 15:48 et 14:48, les heures que le porteur avait tapées. Les intervalles
étant décalés du même pas, les trois débits mesurés sont identiques au dernier
chiffre, le volume de septembre reste 166,9 m³ et la dernière mesure est
toujours exactement le débit de référence.

Une conséquence sans effet visible : la révision de débit garde sa valeur et sa
date, mais ses deux liens vers les relevés qui l'ont produite sont devenus nuls,
comme le prescrit le schéma (`ON DELETE set null`). C'était le prix de la
suppression-ressaisie, seul chemin qu'offrait alors l'écran.

Le soir même, à la demande du porteur, **le bouton « Corriger » a été ajouté**.
Le contrat le promettait depuis le 21 septembre — « un relevé se modifie et se
supprime : c'est une lecture, et une lecture fautive n'a pas à survivre au nom
de la fidélité » — et la persistance savait le faire depuis la même date, avec
deux tests à l'appui. Seuls manquaient l'identifiant dans l'action et le bouton
dans le tableau. Corriger recharge le relevé dans le formulaire avec son index
**non arrondi**, annonce quel relevé est en cours de correction et offre
d'abandonner. La décision de débit déjà prise ne bouge pas : le parcours P5
corrige un relevé, vérifie que la mesure suit — 8 h de marche deviennent 8 h 30,
1,125 m³/h devient 1,059 — et que la ressource porte toujours 1,125 m³/h, l'écran
proposant seulement d'appliquer la nouvelle mesure.

Le 26 septembre 2026, **l'extension « suivi par série culturale » est
débloquée**. Le porteur signale que l'API d'Ouvre ta ferme donne désormais
accès aux séries ; la documentation, introuvable depuis le site, est sur
GitBook (`https://ouvretaferme.gitbook.io/ouvretaferme`). Lecture complète
des pages utiles, puis du code source public d'OTF pour ce que la
documentation tait : le sens des deux entiers `bedStartCalculated` et
`bedStopCalculated` (semaine + (année − saison) × 100), la règle qui les
calcule, les identifiants `fqn` des interventions standard, et la formule
de la surface d'un emplacement.

Reconnaissance sur la ferme du porteur, par un script du dossier de travail,
le jeton posé dans l'environnement du seul processus Node par le mécanisme
existant (`scripts/otf-secret.ps1`) et jamais affiché : cinq routes en
200, saison 2026, 21 interventions dont 16 personnalisées, 254 séries, 397
emplacements, 174 planches. **Le recalcul de la semaine d'implantation
depuis les tâches retrouve la valeur d'OTF sur les trois séries testées.**
Unités confirmées identiques à celles des planches. Enseignements pour le
contrat : 132 planches sur 161 portent plusieurs séries dans la saison — la
période d'occupation est le cœur, pas un raffinement ; 107 emplacements
occupent une planche partiellement ; `area` d'un emplacement inclut
l'allée de la série et ne sert pas à la pondération ; 11 séries sans
implantation et 2 séries « en bloc » sans emplacement, à présenter comme
telles.

Trois décisions du porteur (D-021) et le contrat `docs/series-contract.md`,
à valider avant tout code. Le point ouvert 3 change d'état après huit jours
de blocage.

Le 28 septembre 2026, **la ligne A5 de la recette 3.4 est vérifiée**, dernière
lecture en attente de la partie A. Constat de l'assistant dans le navigateur du
porteur, à sa demande, sur la version déployée (`5c2265a`, déploiement du 26
réussi). Semaine du 21 au 27 septembre : le 21 affiche « 5 mm · mesurée »,
alors que l'ET0 du même jour est marquée « réanalyse » — la réanalyse du 21 est
donc arrivée — et le « Pourquoi ? » de B1-1 retient « Pluie réelle : 5 mm »,
d'où un besoin de 15 mm pour 20 mm d'objectif. Open-Meteo, interrogé
directement pour ce jour et ces coordonnées, donne 0 mm : la mesure a survécu à
une réanalyse différente, la lecture est concluante. Aucune donnée modifiée,
aucun code touché ; contrôles de code sans objet pour une PR de registres.

Constat annexe, non bloquant, sans lien avec A5 : pour la même semaine, la
pluie réelle des 24 au 27 septembre est encore reprise de la prévision, alors
que l'archive Open-Meteo interrogée le 28 au soir renvoie déjà une valeur pour
le 24. Cohérent avec un délai de cinq jours appliqué au moment de la
synchronisation de 06:15 ; à observer, rien à corriger en l'état.

Le 28 septembre 2026, **le contrat des séries est validé par le porteur**
(D-022), point par point, en conversation. Fin de période à la dernière
récolte, réalisée sinon attendue ; surface mouillée selon le matériel — planche
et passe-pied en aspersion, planche seule en goutte-à-goutte, chaque irrigation
selon le sien ; séries sans implantation et en bloc ignorées sans affichage ;
lecture des tâches en une passe, le porteur ayant rappelé que la limite de
quatre appels par seconde n'a pas d'exception.

La règle de surface a fait apparaître un écart dans l'existant : le module
compte la planche seule en aspersion, donc sous-estime les m³ demandés à la
ressource et la faisabilité — une série aurait consommé plus que sa planche.
Le porteur a tranché : **on aligne aussi les planches**, chantier séparé placé
avant les séries (roadmap 5.0, contrat à écrire). Aucun code touché ce jour ;
contrôles de code sans objet pour une PR de registres.

Le 28 septembre 2026, toujours, **le contrat de l'étape 5.0 est écrit**
(`docs/wetted-surface-contract.md`) et le porteur a tranché le sort des
volumes existants : ils restent tels quels (D-023). Relevé fait avant
d'écrire : la surface OTF d'une planche est bien longueur × largeur sans
passe-pied (B1-1 : 22 m × 0,75 m = 16,5 m²), tous les passe-pieds de la ferme
sont renseignés (0,45 m ou 0,25 m), et huit calculs convertissent des
millimètres en volume ou en débit à partir de `Bed.area` ou de
`bedAreaSquareMeters` — l'apport par heure, le débit demandé à la pompe, les
volumes d'irrigation, la limite journalière, le volume du besoin et la dose
d'une allocation — quand deux autres, la pondération des millimètres et les
réserves, ne doivent pas changer. Le contrat sépare donc deux surfaces, ajoute
une colonne additive `wetted_area_square_meters` remplie pour les lignes
existantes. Ses trois points de mise en œuvre ont été validés par le porteur
le soir même : le code peut s'écrire. Débit total relevé sur le site le
28 septembre au soir, à comparer après mise en ligne : 29,35 m³/h.

Le 28 septembre 2026 au soir, **la première PR de code de l'étape 5.0 est
ouverte**, sur deux. Tests d'abord : huit nouveaux, qui encodent la règle sur
B1-1 (16,5 m² en goutte-à-goutte, 26,4 m² en aspersion) et sur la planche de
démonstration N01 (22,5 m² et 36 m²), le passe-pied inconnu qui rend la surface
inconnue et jamais nulle, le zéro reçu qui reste un zéro, la plus grande
surface quand les deux matériels sont posés, et l'aller-retour mm → m³ → mm de
la faisabilité. Un test existant a changé d'attendu — 120 L/h devient 192 L/h
pour une aspersion à 8 mm/h sur 15 m² de planche et 9 m² de passe-pied — parce
qu'il encodait l'ancienne règle. Puis le code : la règle en un seul endroit
du domaine, la couverture qui porte la nature de chaque contribution et
compte les planches sans passe-pied connu, les besoins qui reçoivent la
couverture et portent surface mouillée et provenance, la faisabilité qui
convertit sur cette surface, les services et la page qui transmettent la
couverture, deux lignes d'écran, et le tableau des besoins qui se recalcule
après un placement — sans quoi le volume affiché aurait été périmé jusqu'au
rechargement. Aucune migration, aucun enregistrement touché : c'est la seconde
PR. Entre les deux, les besoins sont en surface mouillée et les irrigations
encore en surface de planche, écart transitoire dans le sens prudent.

Ce qui n'a pas été fait : la vérification visuelle sur un serveur local. La
session qui a écrit ce code est issue d'une tâche planifiée et ne peut pas
démarrer le serveur de développement ; les parcours P1 et P8 tiennent la
place, aux deux largeurs, sur le texte affiché. La recette visuelle se fera sur
la version déployée, comme le contrat le prévoit, avec le relevé du débit total
avant et après.

Le 28 septembre 2026, plus tard dans la soirée, **la première PR est fusionnée
par le porteur et déployée** (`67ac0a6`, quatre jobs réussis, déploiement
compris). Constat de l'assistant sur la version déployée, dans le navigateur du
porteur : débit total **29,35 → 39,57 m³/h** ; les quatre rampes de serre à
1,28 m³/h (tunnel 1) et 2,56 m³/h (tunnels 2 à 4), soit 10 et 20 mm/h sur huit
planches de 16 m² mouillés — 16 m × 0,75 m et un passe-pied de 0,25 m — là où
la planche seule fait 12 m² ; « Voir le calcul » : B1-1 26,4 m² « aspersion,
planche et passe-pied » — une rampe la couvre en plus du goutte-à-goutte, la
plus grande surface l'emporte —, T1-1 16 m², BF-1 18 m². Aucune mention
« incomplet » : tous les passe-pieds de la ferme sont connus. Reste la lecture
à 390 px sur la version déployée, à la reprise.

Le 29 septembre 2026, **la seconde PR de code de l'étape 5.0 est ouverte** :
la persistance. Tests d'abord, comme pour la première. La migration additive
0016 ajoute `wetted_area_square_meters` aux applications d'irrigation, avec la
contrainte `NULL OR > 0`, et remplit les lignes existantes avec leur surface
de planche (D-023) ; un test rejoue ce remplissage sur une base arrêtée à la
0015 où une application existe déjà, et le test de dérive passe. Chaque
irrigation enregistre désormais la surface mouillée de son matériel, calculée
à la création par la fonction unique du domaine ; les dépôts l'écrivent et la
relisent telle quelle, `NULL` compris.

Tout ce qui dérivait un volume de la surface de planche lit la surface
mouillée : le débit demandé à la pompe, les volumes des cartes d'irrigation et
du formulaire, le journal d'eau quotidien, les cumuls et l'historique, la
limite journalière à la création, l'eau planifiée des projections, le candidat
de limite au démarrage. La pondération des millimètres reste sur la surface de
planche, et deux tests le prouvent en creux : les millimètres d'une irrigation
ne bougent pas quand sa surface mouillée change ou manque.

Une planche sans passe-pied connu ne donne jamais un volume sur la planche
seule (D-003) : débit demandé **inconnu** et faisabilité « non vérifiée »
plutôt qu'un débit trop léger, volume « — » sur la carte et dans l'historique
avec le motif, total de cumuls marqué incomplet, jour du journal d'eau marqué
incomplet, planche laissée hors de l'eau planifiée. Une irrigation planifiée ou
démarrée est refusée quand une limite journalière s'applique à l'un de ses
jours ; une irrigation réelle reste enregistrable. Le détail d'une irrigation
montre la surface mouillée retenue et la nature du matériel.

Ce qui n'a pas été fait : la lecture à 390 px de la première PR sur la version
déployée, notée « à la reprise » — la fenêtre Chrome du porteur ne se laisse
pas redimensionner depuis l'outil ; les parcours P1 et P8 tiennent la place à
cette largeur en local. La recette réelle de l'étape, prévue par le contrat,
se fera après la mise en ligne de cette seconde PR.

Le 29 septembre 2026 au matin, **la seconde PR est fusionnée par le porteur et
déployée** (`cfacdf5`, quatre jobs réussis, déploiement compris), puis **la
recette réelle de l'étape 5.0 est passée et l'étape est close**. Constats de
l'assistant sur la version déployée, dans le navigateur du porteur : une
aspersion d'une heure sur la rampe de serre du tunnel 1 enregistrée « déjà
réalisée » donne 10 mm sur 8 planches, 96 m² de surface concernée, 128 m² de
surface mouillée « aspersion, planche et passe-pied » et 1,28 m³ — à la main,
8 × 16 m² × 10 mm = 1 280 L, là où la planche seule aurait donné 0,96 m³ ; un
goutte-à-goutte d'une heure sur gag1 donne 14 mm sur quatre planches de
16,5 m², 66 m² mouillés « planche seule » et 0,924 m³ — 66 × 14 = 924 L. Le
cumul de la semaine fait 2,204 m³ pour 162 m² irrigués, la surface de planche.
Les vingt-deux irrigations antérieures, toutes en goutte-à-goutte sur gag1,
affichent 66 m² mouillés égaux à leur surface concernée et le même volume
qu'avant — leurs millimètres × 66 m², 45,134 m³ pour 683,84 mm le 1er
septembre. Aucune mention « inconnue » sur la page : tous les passe-pieds sont
connus. La ferme n'avait pas d'aspersion enregistrée avant l'étape : le
remplissage D-023 n'est prouvé sur données réelles qu'en goutte-à-goutte, en
aspersion par le test de migration.

La lecture à 390 px, demandée par le porteur, est faite le même matin. La
fenêtre de l'extension refuse toujours de se redimensionner, même une fois la
fenêtre du porteur remise en mode normal ; la page a été chargée dans un cadre
de 390 px de large à l'intérieur de l'onglet, qui lui applique les règles
d'affichage d'un téléphone sans en avoir le tactile. Constaté : aucun
débordement horizontal, panneau d'apport, formulaire « Déjà réalisée » et son
résultat « 8 planches · 1,28 m³ », cartes de cumuls et détail des deux
irrigations en une colonne, avec les lignes « Surface mouillée 128 m² —
aspersion, planche et passe-pied » et « 66 m² — goutte-à-goutte, planche
seule ». Les deux irrigations d'essai restent dans l'historique de la ferme,
l'historique étant immuable (D-006) ; le porteur l'a accepté d'avance tant
que le logiciel n'est pas en service. Prochaine étape, sur son mot : le
développement des séries (5.1).

Le 29 septembre 2026, sur le « vas-y » du porteur, **le développement des
séries (5.1) commence**, en trois PR : le connecteur et l'instantané, le
domaine, la vue. **La première PR est ouverte le jour même.** Contrats
d'abord : la liste blanche de `docs/otf-contract.md` gagne cinq routes, et
`docs/series-contract.md` la cinquième, `/plantList`, parce qu'une mise en
culture ne porte que l'identifiant de son espèce et que la ligne d'une série
doit la nommer. Tests ensuite, seize nouveaux : le connecteur n'envoie que
les paramètres écrits dans son code et jamais `season` aux tâches, refuse
une lecture au-delà du plafond de pages, garde les routes voisines hors
liste ; la lecture d'une saison enchaîne dix routes dans l'ordre ; le
mappeur retient les séries de la saison avec leurs espèces nommées, les
emplacements en mètres sur des planches connues, les seules tâches de semis
direct et de plantation réduites aux champs utiles, compte ce qu'il écarte
et refuse une semaine mal formée ; les semaines ISO se calculent et se
retrouvent aux bords d'année, aller-retour vérifié sur les 365 jours de
2026 ; le cache porte le plan de culture et refuse un plan tronqué ; les
données de démonstration portent les cas que les parcours attendront. Puis
le code : `cropPlan` dans l'instantané, nouvelle version de clé de cache,
restriction par saison dans le domaine, plan de démonstration dont la
plantation à venir suit la date du jour, test de fumée qui compte les
séries. Aucune période ni cumul encore.

Le 29 septembre 2026, **la première PR des séries est fusionnée et déployée
par le porteur (#104), et la seconde — domaine et service — est ouverte le
jour même.** Tests d'abord, vingt-deux : la période d'occupation retrouve la
semaine d'implantation des trois séries relevées sur la ferme le 26 septembre,
prend la semaine planifiée d'une tâche non cochée, fait valoir une tâche sans
mise en culture pour toutes, prend la dernière récolte réalisée sinon
attendue, court du lundi au dimanche sans borne d'année civile, distingue à
venir, en cours et fin inconnue, ignore en bloc et sans implantation avec le
motif, ramène une pérenne au 1er janvier ; les cumuls n'attribuent que la
période, en entier, à chaque série — deux séries la même semaine sur une
planche reçoivent chacune tout —, pondèrent les millimètres par la surface
de planche occupée et additionnent les volumes sur la surface mouillée au
prorata du linéaire, disent un volume inconnu sans le mettre à zéro,
refusent la moyenne sans largeur, prennent le pluviomètre avant la réanalyse
et zéro sous abri, signalent la pluie absente, proratisent l'objectif et
calculent l'écart, mettent les séries à venir à part et comptent les
ignorées ; la période commence à minuit à la ferme, pas en UTC. Puis le
code : `lib/domain/series/occupation.ts` et `water.ts`, le service
`lib/services/series-water-service.ts` qui lit les irrigations par instants
toutes saisons confondues — le dépôt d'historique accepte une saison nulle,
un test de persistance prouve que « toutes saisons » ne veut pas dire « tous
propriétaires » — et les objectifs de la saison et de la précédente ; un test
de persistance cumule un aillet implanté en novembre 2025 : 20 mm sur ses
deux saisons, 238 mm d'objectif sur 196 jours, rien avant l'implantation ni
après la dernière récolte. Le contrat des séries est corrigé de ce que 5.0 a
tranché entre-temps : la surface de planche pondère les millimètres, la
surface mouillée convertit en volume ; la pluie absente reste absente ; deux
cas limites ajoutés. Aucun écran : troisième PR.

Le 29 septembre 2026, **la seconde PR des séries est fusionnée et déployée
par le porteur (#105), et la troisième — la vue « Séries », l'export et le
parcours P9 — est ouverte le jour même.** L'écran des cumuls gagne un
commutateur « Par périmètre / Par série » posé au-dessus des deux vues, pour
que chacune garde son état ; la vue par série se charge à la demande par une
action serveur et se recalcule à chaque ouverture. Une carte par série avec
implantation, dernière récolte, planches, période observée et cumuls ; le
détail par planche ; les séries à venir à part ; les ignorées comptées dans
un avertissement ; sans plan lu, un message qui renvoie à « Actualiser ».
L'export CSV gagne la colonne « Séries », calculée par une fonction du domaine
qui cherche les séries occupant les planches arrosées le jour de l'irrigation
— pour cela, une ligne d'historique porte désormais les identifiants de ses
planches. Les styles vivent dans une feuille à part, la feuille de
l'historique ayant atteint la limite de 600 lignes. Vérifié sur le serveur
local dans le navigateur intégré : la vue montre carottes et tomates avec leurs
libellés, la mâche à venir, ni radis ni endives ; à 375 px le tableau des
planches devient une liste et rien ne déborde ; à 1 280 px, aucun débordement
au DOM — le volet n'a pas rendu la capture bureau, le parcours P9 tient cette
largeur. Reste la recette réelle sur trois séries de la ferme, après mise en
ligne : leurs cumuls comparés à la main aux cumuls des planches, leur période
comparée à celle qu'affiche Ouvre ta ferme.

Le 29 septembre 2026 au soir, **la troisième PR des séries est fusionnée et
déployée par le porteur (#106), et la recette réelle est passée le jour même
sur la version déployée** (`docs/recette-series.md`). Constats de
l'assistant dans le navigateur du porteur, après une actualisation forcée qui
a lu le plan de culture : 223 séries suivies, 18 à venir, 13 non suivies — les
11 sans implantation et les 2 en bloc de la reconnaissance. Trois séries
comparées à la main : Mâche #1 (T1-8, en cours) — période 37 → 43 comme dans
Ouvre ta ferme, 10 mm et 0,16 m³ pour l'aspersion du matin, pluie zéro sous
abri, objectif 80,7 mm et ET0 81,6 mm égaux à la vue par périmètre sur la même
planche et la même période, écart +70,7 mm, objectif restant 74,3 mm ;
Cosmos 2 (10 m de B1-2, terminée) — période 19 → 38, 1 289,5 mm comme la
planche, 9,671 m³ soit 21,277 × 10/22, pluie absente et signalée (17 jours sur
140) ; Tomates primeurs à Chloé (T1-1, T1-2, terminée) — période 13 → 31,
0 mm. **Un défaut trouvé et corrigé le soir même** : la ligne d'une planche
affichait une pluie partielle — 22,7 mm sur 17 jours — comme un total ; la
planche ne montre plus la pluie que complète, un test l'encode. **Un point
ouvert au jugement du porteur** (point 11) : la vue par périmètre compte la
pluie sur une planche sous abri. **L'extension séries est close.** Prochaine
étape, sur le mot du porteur : le cadrage 3.5.0, Fable 5.1 · Max.

Le 29 septembre 2026 au soir, sur le « vas-y » du porteur et après passage de
la session à Fable 5.1 · Max, **le contrat du planning hebdomadaire est écrit**
(`docs/planning-contract.md`, cadrage 3.5.0), sans code. Sources relues avant
d'écrire : le cahier des charges (sections 21 à 27), les contrats des besoins,
de la faisabilité, des ressources, des pompes et de la météo, les décisions
D-010, D-014 et D-019, les blocs 3.5 à 3.9 de la roadmap ; chiffres relevés
sur la version déployée à 12 h 52 — forage à 0,511 m³/h, réserve de 60 m³ à
30 m³, pompe 8 m³/h, objectif 20 mm, 132 planches avec un besoin, 79,2 m³ à
planifier, 97 m³ prévisionnels, rampes de bloc à 1,8 m³/h, rampes de serre à
1,28 et 2,56 m³/h. Le contrat pose le vocabulaire, ce qu'il reprend tel quel,
l'objet planifié (une irrigation planifiée 2.7 dès validation), cinq statuts,
le cycle (semaine, recalcul quotidien à 06 h 30, à la demande, sur événement),
la quantité à placer (besoin 3.3, pluie prévue réglable, doses), le placement
des créneaux (plages, répartition au plus tôt, ordre de service, simultanéité
3.2, projection du stock 3.1, limites), la liste fermée des contraintes
opposables, la conduite en pénurie, l'explicabilité, ce que le maraîcher peut
faire, ce que le planning ne fait jamais, quinze cas limites, douze réglages
avec valeur de départ, onze scénarios chiffrés et douze questions à trancher
avec une recommandation chacune. Rien n'est décidé : le porteur valide, ses
réponses deviennent des décisions, puis seulement le moteur.

Le soir même, **le porteur répond aux douze questions** : onze sont tranchées
et consignées (D-024) — pluie prévue à 100 % sauf sous abri, attente d'une
pluie de plus de 5 mm, dose d'une rampe au besoin le plus élevé,
goutte-à-goutte d'abord, au plus tôt, plages horaires réglables à l'écran,
prioritaires d'abord puis part égale, pas de report, un arrêté préfectoral est
toujours une limite en m³/jour que la 2.8 modélise déjà, validation une par
une, par jour ou par semaine, aucun indicateur à ajouter avec la perspective
d'algorithmes de besoin par stade de culture en entrée de la 3.3. La question
des doses par arrosage (Q3) est tranchée après explication, aux valeurs de
départ — aspersion 5 à 15 mm, goutte-à-goutte 3 à 10 mm, un arrosage par jour,
24 h entre deux —, réglables à l'écran. Le contrat est corrigé de ces
réponses, ses scénarios reçoivent leurs valeurs exactes, et **le cadrage
3.5.0 est validé en entier**. Sur le « vas-y » du porteur, **le moteur 3.5
commence le soir même** : reconnaissance du code à réutiliser — besoins et
couverture, eau, pompes, limites, faisabilité —, puis le domaine du moteur
avec les scénarios du contrat en tests.

Le 29 septembre 2026 au soir, **la première PR du moteur de planning est
ouverte** : le domaine seul, `lib/domain/planning/`, sans persistance ni
écran. Reconnaissance d'abord, par deux relectures du code — besoins et
couverture, eau, pompes, limites, faisabilité — pour réutiliser les règles
existantes plutôt que les réécrire ; trois défauts préexistants trouvés au
passage, consignés en points ouverts 12 à 14. Tests d'abord : les scénarios
du contrat sur une ferme de test aux chiffres de la ferme réelle, avec leurs
valeurs exactes ; deux cents semaines tirées au hasard sous invariants — plage
horaire, pompe sous 8 m³/h, limite journalière, réserve jamais sous son
minimum, dose maximale, espacement, déficit égal au besoin non couvert — ;
une semaine de 138 planches en 330 ms. Puis le code : sept modules, tous sous
600 lignes. Deux ajouts au domaine existant : `pumpUsagesFromEvents` dans
`pumps.ts`, la règle « quelles irrigations occupent une pompe » qui ne vivait
qu'en SQL et deux fois dans des composants clients ; l'export de trois
fonctions privées de la projection 3.1 pour l'apport journalier d'une
ressource. Le contrat reçoit des notes de mise en œuvre. Ce qui n'a pas été
fait : les parcours navigateur, sans rapport — aucun écran ni service touché.

Le 29 septembre 2026, plus tard dans la soirée, **la première PR du moteur
est fusionnée (#109) et la seconde est ouverte : le registre et le service.**
Migration additive `0017`, quatre tables — réglages et journal, calculs,
propositions — avec leurs contraintes ; `db/schema.ts` à jour, dérive nulle,
migration appliquée en local. Le dépôt (`db/planning-repository.ts`) lit et
enregistre les réglages avec leur journal, enregistre un calcul et ses
propositions en un lot qui remplace les proposées du calcul précédent, relit
le dernier calcul avec les décidées des calculs antérieurs, et décide d'une
proposition une seule fois. Le service (`lib/services/planning-service.ts`)
assemble les entrées réelles à la manière de la faisabilité et fait tourner
le moteur. Tests de persistance d'abord, sept, dont un service complet sur une
ferme en base : deux créneaux de 10 mm à 24 h d'écart, un second calcul qui
garde la validée et déduit son irrigation planifiée du besoin. Trois tests
existants qui comptent les tables passent de 40 à 44. Corrigé au passage,
parce que le test l'exigeait : `lib/services/weather/configured-provider.ts`
utilisait une propriété de paramètre TypeScript que Node en mode
« strip-only » refuse, ce qui rendait intestable sous Node tout service qui
lit le tableau de bord de l'eau ; un champ explicite le remplace, sans
changement de comportement. Ce qui n'a pas été fait : les parcours
navigateur, sans rapport — aucun écran. Reste : les actions et la validation
d'une proposition en irrigation planifiée (troisième PR).

Le 29 septembre 2026, tard dans la soirée, **la seconde PR du moteur est
fusionnée (#110) et la troisième est ouverte : les actions, la validation
d'une proposition en irrigation planifiée, le recalcul quotidien.** La
validation emprunte le circuit de « Planifier » — matériel, réglage et
position tels qu'ils sont à cet instant, couverture recalculée et comparée à
la proposition, pompe vérifiée par la 3.2, limite journalière vérifiée par la
2.8 — et relie la proposition à l'irrigation créée ; expirée, remplacée,
décidée ou d'un autre propriétaire, elle refuse sans rien créer. Les actions
serveur calculent, lisent, règlent, valident une, plusieurs ou toutes les
propositions données, chacune avec sa réponse, et refusent. Le recalcul
quotidien suit la synchronisation météo du matin, exploitation par
exploitation. Deux gestes sur l'existant, sans changement de comportement :
la garde de la limite journalière à la création passe de `app/` à un
service (`lib/services/irrigation-limits.ts`), l'action l'important comme
avant, pour que la validation du planning s'y soumette et se teste sous Node ;
le résultat de création d'une irrigation nomme l'irrigation créée. Quatre
tests de persistance, 547 au total. Le fichier des actions est inscrit aux
entrées de `knip` tant qu'aucun écran ne l'appelle ; la 3.6 retirera cette
entrée. Ce qui n'a pas été fait : le réglage R1 de l'heure du recalcul
n'a pas d'effet, le recalcul suivant la météo à 06 h 15 ; un planificateur
propre viendra avec la replanification (3.7).

Le 29 septembre 2026 dans la nuit, **la troisième PR du moteur est fusionnée
(#111) et l'interface du planning (3.6) est ouverte en PR**, sur le « vas-y »
du porteur. Contrat d'abord : la section « Interface (3.6) » de
`docs/planning-contract.md` dit ce que l'écran montre et ce que le maraîcher
peut faire ; les notes de mise en œuvre disent ce que le code a précisé. La
présentation pure vit dans `lib/domain/planning/presentation.ts`, cinq tests :
la semaine en jours à la ferme, le résumé, les planches non servies,
l'ajustement d'une proposition — la durée suit la dose au prorata, la fin suit
le début —, le formulaire des réglages dans les deux sens. L'écran
(`app/irrigation/planning/`) : le dernier calcul avec son déclencheur et ses
hypothèses, six cartes de résumé, le budget d'eau par chaîne, les sept jours
avec leurs propositions et leur justification d'un clic, « Valider »,
« Ajuster », « Refuser », la validation d'un jour ou de toute la semaine,
« Ajouter un créneau à la main » qui ouvre le formulaire « Planifier », la
liste « Non placé », les réglages R1 à R12 avec leur historique. La page sert
le dernier plan et les réglages ; rien ne se recalcule sans un clic ou le
recalcul du matin. Le service de validation accepte un ajustement par les
mêmes gardes — un créneau déjà terminé ou qui finit après dimanche minuit est
refusé —, un test de persistance de plus ; deux actions de plus. Parcours
P10 aux deux largeurs. Trois gestes sur l'existant, sans changement de
comportement : la mesure de cible tactile de P7 passe dans le support des
parcours, le formulaire d'irrigation écoute la demande du planning, et P9
retrouve sa propre ligne dans l'export au lieu de prendre la première. Deux
observations consignées aux points ouverts 15 et 16. Ce qui n'a pas été
fait : la recette réelle du moteur sur la ferme avec cet écran, qui reste la
preuve de fin de la 3.5 et se fera après la mise en ligne.

Le 29 septembre 2026 entre 19 h 49 et 20 h 10, **recette réelle du planning
sur la ferme**, sur la version déployée après la fusion de l'interface (#112,
déploiement terminé à 19 h 48), semaine du 28 septembre
(`docs/recette-planning.md`). L'écran : 60 propositions en 4,0 s depuis le
navigateur ; une proposition ajustée à 5 mm et validée en 2,0 s, visible dans
« À venir ou à terminer » avec sa note « ajustée », 165 L recalculés à la
main ; un refus en 0,8 s ; l'irrigation créée annulée en 3,0 s ; à 390 px dans
un cadre sur la version déployée, document de 373 px pour 388, bouton
« Valider » de 44 px. **L'interface 3.6 est close.** Le moteur : les
goutte-à-goutte et les rampes de serre justes au litre et à la minute, la
pompe jamais au-dessus de 8 m³/h, la réserve jamais sous 0 ni au-dessus de
60, les plages et l'espacement respectés, une plage qui passe minuit sous
son jour. Mais les rampes de bloc au réglage « 5 planches » arrosent à
7,5 mm/h au centre et 2 mm/h au bord, et la règle R11 poursuit le besoin des
planches de bord : 60 mm au centre du bloc 10 pour 17,2 demandés, 130,956 m³
proposés pour 84,178 m³ demandés, réserve projetée vide dès vendredi, blocs
3, 8 et fleurs 3 sans créneau par l'espacement d'une planche partagée. Le
constat est de l'assistant, le jugement du porteur : une question R13 lui est
posée (point ouvert 17), deux défauts d'explication sont consignés (point
18). **Le moteur 3.5 reste 🟡 🔶.** Rien n'a été modifié dans le code ; les
données de la ferme portent un calcul, une proposition validée dont
l'irrigation est annulée, et une proposition refusée, que le recalcul du
matin remplacera.

Le 29 septembre 2026 dans la nuit, **R13 tranchée par le porteur (D-025) et
PR de la portée ouverte.** Le porteur a lu la recette, demandé l'explication
de la décision en termes simples — la rampe du bloc 10 arrose 15 mm au centre
et 4 mm au bord en 2 h ; faut-il courir après le bord ? — et tranché : non,
une planche arrosée à moins de la moitié du centre ne commande plus le
créneau, 50 % réglable. Contrat d'abord, puis le moteur : « commander »
calculé par matériel, matériel de service choisi parmi ceux que la planche
commande, la planche la mieux arrosée fixe la dose, R6 et R7 ne comptent que
les planches qui commandent, réel ou proposé, motifs vrais — « portée du
matériel insuffisante », « sous la dose minimale », « espacement », « plus
de plage » — et niveau de réserve relu sur le plan fini. Ce dernier point a
révélé un accesseur de la chronologie de réserve qui rendait l'heure du
minimum au lieu du niveau, inutilisé jusque-là, corrigé. Réglage R13 à
l'écran ; un réglage enregistré avant R13 prend sa valeur de départ. Cinq
tests de la portée sur les chiffres de la ferme, les treize tests du moteur
inchangés. Ce qui n'a pas été fait : la seconde recette réelle, après la mise
en ligne — elle dira si le plan de la ferme tient dans la réserve.

Le 29 septembre 2026 à 21 h 20, **seconde recette réelle du planning, après
la mise en ligne de la portée (#114, déployée à 20 h 56)**, sur les mêmes
données que la première, réserve à 30 m³ laissée telle quelle pour comparer.
La portée fait ce qui a été décidé : 49 propositions au lieu de 60, 69,243 m³
au lieu de 130,956, le bloc 10 avec son unique créneau de 2 h à 15 mm et
3,648 m³, chaque bloc de même, les blocs 3, 8 et fleurs 3 servis la première
nuit, 72 planches « portée du matériel insuffisante » et 27 « sous la dose
minimale », temps de pompage manquant à zéro, pompe, plages et espacement
tenus, calcul en 3 s, les deux corrections d'explication vérifiées. Mais le
rejeu à la main des créneaux sur la réserve montre qu'elle est à sec
mercredi 01 h 25 et que le plan tire 21,12 m³ qui n'existent pas jusqu'à
06 h 42, sept rampes et douze goutte-à-goutte affichés « 0,00 m³ projetés »,
pendant que le résumé dit « Manque d'eau 0,00 m³ ». Cause lue dans
`supply.ts` : le niveau projeté est borné à zéro avant d'être comparé au
minimum de sécurité, 0 sur la ferme, donc le manque vaut toujours 0 ; le
test d'invariant lit le même niveau borné et ne peut pas échouer ; la
première recette montrait déjà le symptôme, rangé alors sous le sur-apport.
Point 19 ouvert, le moteur reste 🟡. Ce qui n'a pas été fait : la correction
— sur le mot du porteur — et la troisième recette ; la lecture à 390 px et
les gestes de validation, inchangés depuis la PR de l'écran et couverts par
P10, n'ont pas été rejoués.

Le 1er octobre 2026, **les parcours navigateur échouent à 390 px sans
qu'aucun code du logiciel ait changé** : P4 trois fois sur quatre (deux fois
sur la PR Dependabot #118, une fois en local), P5 sur `main` après la fusion
de #117, dont le déploiement a été sauté. Deux défauts des parcours, pas du
logiciel. P4 ne regardait que la première page de l'historique : seize
irrigations laissées par les parcours précédents dans la semaine, douze par
page, et l'irrigation de P4 commence à la même minute que celle de P3,
l'ordre entre les deux dépendant d'un identifiant aléatoire — vérifié dans la
base locale après une exécution complète. P5 lisait l'horloge à chaque
saisie : une minute écoulée entre le premier relevé et la correction du
second, et le débit attendu de 1,059 m³/h sur 8 h 30 devient 1,057 sur
8 h 31 ; P3, P4 et P9 avaient la même fragilité. Correction dans la PR
`fix/parcours-pagination-horodatage` : deux règles ajoutées au contrat des
parcours, `horodatageLocal` reçoit la référence « maintenant » relevée une
fois par parcours, et `trouverLaFiche` feuillette l'historique jusqu'à la
fiche, après la preuve que la période demandée est arrivée. Rien ne change
dans `lib/`, `app/` ni `db/`.

Le 1er octobre 2026, **vinext passe de 1.0.0-beta.10 à 1.0.0** (PR
`chore/vinext-1-0`, qui remplace la PR Dependabot #116, rouge). Depuis la
beta.13, `vinext dev` ne fait plus que relayer vers `vite dev` et refuse
l'option `--hostname` que la configuration Playwright lui passait pour
démarrer le serveur des parcours : la commande passe à `--host`, seul
changement hors `package.json` et `pnpm-lock.yaml`. vinext conseille
désormais d'appeler `vite dev` et `vite build` directement ; idée notée,
pas faite, les scripts restent `vinext dev` et `vinext build`. vinext
1.0.1, publié le jour même, n'a pas été retenu : la politique d'âge minimal
des paquets de pnpm exigeait une exclusion explicite dans
`pnpm-workspace.yaml`. Constat annexe : les alertes de vulnérabilité sur
`undici` et `ws` ne tiennent pas qu'à Wrangler et Miniflare, contrairement
à ce que les registres disaient depuis le 20 septembre — `pnpm-workspace.yaml`
épingle `undici` à 7.24.8 et `ws` à 8.18.0 depuis le 1er septembre 2026,
et ces épinglages empêchent Dependabot de corriger ; point 20 ouvert.

Le 1er octobre 2026 au soir, **six PR Dependabot sont fusionnées par le
porteur**, une à la fois, après les PR #120 et #121 :
`@cloudflare/workers-types` 5.20260918.1 → 5.20260927.1 (#117) ; `next`
16.3.5 → 16.3.6 (#119, correctif de sécurité de `next/og`, que le logiciel
n'utilise pas ; le verrou y gagne `sharp` 0.35.5 à côté du 0.35.4 que garde
Miniflare) ; `@vitejs/plugin-react` 6.0.2 → 6.1.1 (#81) ; `@types/node`
22.19.19 → 22.20.4 (#78) ; `actions/upload-artifact` 5 → 7 (#118 — l'étape
ne tourne qu'en cas d'échec des parcours, un job vert ne la joue pas, sa
compatibilité repose sur les notes de version : Node 24, exécuteur 2.327.1 au
moins, aucune entrée retirée) ; TypeScript 5.9.3 → 6.0.3 à la racine et dans
les deux Workers (#79, examinée avant fusion : `tsc` joué sur les trois
paquets en CI, aucun avertissement de typescript-eslint, aucune option retirée
dans les trois `tsconfig`). Aucun code du logiciel ne change ; chaque PR
avait ses trois jobs verts sur son dernier commit, et `main` a été
redéployée après chaque fusion, sauf celle de #120 dont l'exécution a été
annulée par celle de #121, sept minutes plus tard. Mécanique apprise : chaque
fusion d'une PR npm remet les autres en conflit sur `pnpm-lock.yaml`, et
Dependabot les refait seul en une à deux minutes ; une PR seulement en retard
sur `main`, sans conflit, attend le bouton « Update branch » ; « Resolve
conflicts » ne s'emploie pas sur un verrou Dependabot. Alertes après la
série : 34, point 20 mis à jour. Lu dans la protection de `main` : le job
« Parcours navigateur » n'y est pas exigé, point 21 ouvert. La liste des PR
ouvertes est vide.

Le 2 octobre 2026, **le job « Parcours navigateur » est exigé par la
protection de `main`** (D-026, point 21 fermé). Le porteur a tranché le
matin ; le réglage a été fait dans son navigateur — l'ajout du job à la liste
des contrôles requis par l'assistant, la confirmation d'identité demandée par
GitHub par le porteur lui-même — et GitHub a enregistré la règle. Relecture
par l'API : trois jobs requis, branche à jour exigée, aucun contournement.
`AGENTS.md` nomme désormais les trois jobs. Aucun code ne change.

Le 2 octobre 2026 au soir, **les épinglages d'`undici` et de `ws` sont
levés** (point 20 fermé). Retrouvé dans l'historique : le commit 4fc9a32 du
1er septembre 2026, qui ajoutait le Worker des alertes avec son propre
Wrangler 4.127.1 à côté du 4.92.0 de la racine, a posé les deux épinglages
sans en écrire la raison. Son verrou la montre : le miniflare
5.20260828.0-alpha du nouveau Wrangler demandait `undici` 7.29.0 et `ws`
8.21.0, et les épinglages l'ont ramené aux versions du miniflare 4.20260515.0
de la racine, 7.24.8 et 8.18.0 — un seul exemplaire de chaque paquet pour
deux générations de Wrangler, selon toute vraisemblance. Les trois
`package.json` déclarent aujourd'hui le même Wrangler 4.135.0 et un seul
miniflare : la raison a disparu. L'épinglage de `ws` est retiré, miniflare
5.20260918.0-alpha et le greffon Vite 1.56.0 demandant eux-mêmes 8.21.0, qui
ferme les deux alertes ; celui d'`undici` est relevé à 7.29.1, correctif du
4 septembre 2026 sur le 7.29.0 que miniflare demande, qui ferme les vingt et
une alertes — à retirer quand le lot Cloudflare suivant apportera miniflare
5.20261001.0-alpha, qui demande 7.29.1 lui-même. L'épinglage restant porte
dans `pnpm-workspace.yaml` sa raison et sa condition de retrait. Le verrou
perd au passage deux doublons que `pnpm install` a résorbés : `caniuse-lite`
passe de 1.0.30001810 à 1.0.30001814 sous `browserslist`, `source-map-js` de
1.2.1 à 1.2.2 sous `postcss` 8.5.28, versions qui s'y trouvaient déjà pour
`next` et `postcss` 8.5.23. Aucun code du logiciel ne change ; contrôles
complets, parcours compris, le serveur des parcours tournant sous miniflare.
Les vingt-trois alertes `undici` et `ws` doivent se fermer à la fusion ;
onze resteront, toutes transitives et de développement (`brace-expansion`
×6, `fast-uri` ×3, `js-yaml` ×1, `fflate` ×1), à suivre avec les lots
Dependabot.

Le 2 octobre 2026 au soir, **la garde de la réserve est corrigée** (point 19,
PR ouverte ; troisième recette après fusion et déploiement). Contrat
d'abord — `docs/planning-contract.md`, point 5 « L'eau » précisé et note
« La garde de la réserve » —, tests ensuite : la grande ferme du test de
performance devient une fixture, et un test sur les chiffres de la ferme
— 30 m³ à 12 h 52, 0,511 m³/h, minimum 0, sans goutte-à-goutte sur les
blocs pour que l'espacement R7 ne repousse pas leurs rampes à jeudi — échoue
avant la correction, 48,51 m³ tirés d'ici mercredi 8 h pour 39,78
disponibles, et passe après. Dans `supply.ts`, la projection qui juge n'est
plus bornée par zéro, seulement par la capacité ; `evaluate` court du début
du créneau à la fin de l'horizon et ne propose d'attendre l'apport que si
le point le plus bas tombe dans le créneau ; le niveau affiché (`levelAt`)
reste borné par zéro. Dans `engine.ts`, un créneau qu'attendre ne sauve pas
est raccourci à la plus longue durée que la réserve accepte, par bissection
sur les secondes entières — le raccourcissement au prorata du manque
laissait la fin du créneau sous le minimum —, sinon refusé « réserve au
minimum ». L'invariant du test lit désormais la projection non bornée et
peut échouer. Au passage, le défaut d'écran de la seconde recette : une
carte validée ou refusée relue avec un calcul plus récent porte la date de
son calcul — « Proposition p-12 du calcul du 29/09/2026 19:51, gag11 » —,
lue par jointure (`calculatedAt`), règle pure `earlierCalculationDate`
testée, parcours P10 étendu d'un recalcul. Contrôles complets : lint sans
avertissement, typage sans erreur, 560 tests réussis, compilation, `pnpm
knip` code 0, `pnpm push:check` 11 et `pnpm weather:check` 2 réussis,
parcours navigateur joués deux fois : à 23 h 06, 22 réussis et P10 échoué
aux deux largeurs par l'heure, sans rapport avec la PR (point 22) ; rejoués
à 23 h 43, 24 réussis aux deux largeurs (3 min 48 s), serveur sous
miniflare ; la carte datée relue en local sur le serveur de développement,
nom accessible et ligne du matériel conformes aux parcours, sans débordement
à 375 px. Noté sans y toucher : le test de performance
tourne entre 620 et 910 ms sur ce poste selon sa charge, pour une limite de
1 000 ms, avant comme après la correction (832 ms avant, 883 après, même
poste, même minute) ; `minimumLevel` recalcule par `Intl` la date de chaque
rupture à chaque appel — 147 appels, 617 ms sur 861 à la sonde — et des
bornes de jour calculées une fois l'allégeraient, dans une PR à part.

Le 3 octobre 2026, **l'ancien site OpenAI Sites est supprimé ; Q0 et D-016
sont closes** (point 5 fermé). Quatorze jours se sont écoulés depuis la
bascule du 19 septembre sans qu'aucune donnée ne manque sur la nouvelle
adresse. Le rappel prévu a été adressé au porteur le matin ; le porteur a
supprimé le site lui-même, dans la gestion des sites de son compte ChatGPT,
et l'a annoncé le soir. Constaté par l'assistant à 23 h 15 : l'ancienne
adresse répond 404, la nouvelle répond 302 vers la connexion Cloudflare
Access. Aucun code ne change.

Le 4 octobre 2026, les registres rattrapent la fusion de la PR #125 de la
garde de la réserve (point 19) : fusionnée le 3 octobre à 0 h 07 (commit
7a2b1ae), déployée à 0 h 14 ; reste la troisième recette. Le même jour, **P10
ne dépend plus de l'heure** (point 22 corrigé, PR `fix/p10-heure`). Entre
23 h 00 et 23 h 41, la plage du goutte-à-goutte ouverte jusqu'à 23 h 59 laisse
moins d'une heure et plus que les 18 minutes de la dose minimale : le moteur
propose aujourd'hui un créneau raccourci à la plage, et la première carte
n'était plus celle des 10 mm que le parcours attendait — en échec aux deux
largeurs en local le 2 octobre à 23 h 06 et en CI le 3 à 23 h 21, les 22
autres parcours verts. Le parcours lit désormais la première carte à la dose
entière et, quand le calendrier n'en offre aucune — un dimanche à cette
heure —, la carte raccourcie, dont il vérifie le motif « ce qui tient dans la
plage horaire » et non la dose ; la suite du parcours est inchangée,
l'ajustement à 6 mm valant pour toute carte. Règle « un parcours ne dépend pas
non plus de l'heure où il tourne » ajoutée au contrat des parcours, ligne P10
complétée. Rien ne change dans `lib/`, `app/` ni `db/`. La branche de repli a
été exercée en local en fermant la plage à 11 h 20, moins d'une heure après le
calcul : 2 réussis en 45 s à 10 h 29, sur une carte « 10:30 → 11:20 », 50 min,
8,33 mm, motif « ce qui tient dans la plage horaire », relue en base locale,
sans aucune carte à 10 mm. Reste connu et non couvert : le dimanche de 23 h 42
à 23 h 59, où plus aucun créneau de la semaine ne tient, P10 n'a rien à lire.

Le 4 octobre 2026 au soir, **le refus d'une irrigation au volume
invérifiable sous une limite journalière est levé, plus rendu** (point 12
corrigé, PR `fix/limite-volume-inconnu`). La garde de la création
(`lib/services/irrigation-limits.ts`) rendait le texte « Irrigation
refusée… » au lieu de lancer `IrrigationDailyLimitExceededError` : l'action
« Planifier » enregistrait l'irrigation en affichant ce texte en
avertissement, quand la validation d'une proposition du planning, elle,
lisait le message et refusait. La garde lève désormais l'erreur, que l'action
rend en échec par `handledError` et la validation en refus par son `catch` ;
la ligne de la validation qui écoutait le message rendu est retirée. Contrat
précisé (`docs/wetted-surface-contract.md`). Quatre tests de persistance
(`tests/db/irrigation-limits.test.ts`), le premier en échec avant la
correction. L'action n'est pas exécutée sous Node, qui n'a ni `next/headers`
ni `next/cache` : la preuve passe par la garde et par `handledError`. Trouvé
au passage, non corrigé : la garde du démarrage ignore le volume inconnu
(point 24). Rien ne change dans l'interface ni dans `db/`.

Le 4 octobre 2026 au soir, **P10 ne manque plus d'eau un dimanche soir**
(point 25 corrigé, PR `fix/p10-eau-dimanche`). Deux parcours laissaient dans
la base partagée ce que le logiciel avait déduit de leur geste : P10,
l'objectif de 70 mm copié sur la semaine courante quand « Tout vider » ne
retirait que la précédente ; P7, sa décision d'arbitrage — servir N01
seule —, prise parmi les sept planches, l'objectif de P10 leur donnant à
toutes un besoin. Les jours de semaine, l'eau suffisant, le recalcul de la
faisabilité déclarait la décision caduque et l'invalidait. Un dimanche soir,
l'eau mobilisable d'ici minuit ne couvre plus les besoins : la décision
restait valide, T01 et T02 « Non retenue lors de l'arbitrage manuel »,
allocation nulle transmise au moteur, qui s'incline devant un arbitrage
validé (`applyShortage`) et dit « stock et ressources insuffisants d'ici
dimanche » ; le plan de P10 à 390 px n'avait rien à proposer. Cause relue
dans la base locale laissée par la suite arrêtée au premier échec, à 20 h 14.
P10 pose et retire désormais son objectif sur les deux semaines ; P7, ses
besoins et ses ressources rendus, recalcule la faisabilité et vérifie à
l'écran que son arbitrage est « plus applicable ». Règle « ce que le logiciel
déduit d'un geste fait partie de la situation à rendre » ajoutée au contrat
des parcours, lignes P7 et P10 complétées. Rien ne change dans `lib/`, `app/`
ni `db/`. Suite entière rejouée un dimanche soir, à l'heure du défaut : 24
réussis aux deux largeurs, de 20 h 41 à 20 h 44, après l'échec de P10 à
390 px à 20 h 14 avec les parcours d'avant.

Le 4 octobre 2026, plus tard dans la soirée, **l'ordre des journaux et des
révisions ne dépend plus d'un identifiant tiré au sort** (point 27 corrigé,
PR `fix/ordre-des-journaux`). Le run de `main` lancé à 20 h 59 par la fusion
de la PR #130 avait rougi sur le test du journal des réglages du planning,
« le plus récent d'abord » : 559 tests verts, un rouge, déploiement sauté.
Le test était juste. Le journal se lisait par `created_at`, posé à la
milliseconde, puis par `id`, un UUID tiré au sort : deux enregistrements dans
la même milliseconde sortaient dans un ordre aléatoire. Le poste local, plus
lent, n'avait jamais produit l'égalité ; la machine de la CI, si, pour la
première fois en quarante runs de `main`. Une sonde qui enchaîne les deux
enregistrements sans rien entre eux l'a reproduit ici : sur 40 essais, 36
dans la même milliseconde, 15 historiques inversés. Quatre lectures
partageaient le défaut, celles où la dernière révision fait foi : le journal
des réglages, les objectifs hydriques de la semaine et leur histoire rejouée,
les limites journalières, les limites de prélèvement des ressources ; le
domaine des besoins, en remettant les révisions en ordre, départageait lui
aussi par l'identifiant. Règle écrite dans `docs/revision-order-contract.md`
: l'ordre d'enregistrement fait foi, deux lignes de la même milliseconde
gardent l'ordre d'insertion, départagé par `rowid` et jamais par `id` ; le
domaine trie de façon stable sans l'identifiant. Cinq tests posent l'égalité
au lieu de l'attendre d'une horloge, quatre de persistance et un du domaine,
tous rouges avant la correction, verts après. Le délai de 5 ms qu'un test
des limites de ressource s'imposait pour la même raison est retiré. Hors
portée, notés : les ordres d'affichage départagés par l'identifiant,
placements, liaisons, éléments de l'historique, où rien ne fait foi. Schéma,
migrations et écritures inchangés.

Le 4 octobre 2026, vers 22 h 30, **le test de performance du planning tolère
deux secondes** (décision D-027, point 23 tranché, PR
`fix/perf-planning-deux-secondes`). Le test bornait à 1 000 ms de temps réel
le calcul d'une semaine complète sur la grande ferme de test ; il a rougi
quatre fois en deux jours sur les machines de GitHub, 1 004 à 1 022 ms, deux
fois sur `main` avec déploiement sauté, deux fois sur des PR, et en local sur
un poste chargé. Mesuré ce soir sur le poste libre, trois processus de
suite : 643 à 651 ms à froid, 581 à 611 ms à chaud, l'échauffement ne retire
que 8 % ; la machine de GitHub est environ 1,6 fois plus lente. La limite
passe à 2 000 ms, constante nommée et commentée dans le test, qui est dit
pour ce qu'il est : une garde contre une régression de complexité, non une
mesure de confort. Contrat du planning et roadmap portent la nouvelle preuve
de fin ; l'allègement de `minimumLevel` pour revenir sous la seconde devient
le point ouvert 28. Rien ne change dans `lib/`, `app/` ni `db/`.

Le 4 octobre 2026, à 22 h 26 puis 22 h 34, **les PR #131 et #132 sont
fusionnées par le porteur et déployées** (`2602d41` puis `4b83563`, quatre
jobs réussis chacune, déploiement compris, à 22 h 32 et 22 h 41). Les deux
runs de `main` sont passés du premier coup, celui de #131 encore sous
l'ancienne limite d'une seconde du test de performance. Aucun Worker annexe
redéployé, leurs dossiers n'ayant pas changé ; aucune migration D1 à
appliquer. Le site répond par la redirection vers Access à la racine et sur
`/irrigation`, sondé vers 22 h 45. Il porte donc tout `main` : la limite sur
un volume inconnu (point 12, en ligne depuis 22 h 08), l'ordre des journaux
et des révisions (point 27) et la décision D-027, qui ne change rien au
logiciel. Aucune publication manuelle nécessaire. Constat de l'assistant dans
les journaux de la CI et par une sonde HTTP ; la troisième recette du plan,
dans le navigateur du porteur, est prévue le 5 octobre à 9 h sur cette
version.

Le 5 octobre 2026, de 13 h 57 à 14 h 19, **troisième recette réelle du
planning, dans le navigateur du porteur, sur la version déployée**
(`6305803` ; moteur, registre, service et écran du planning inchangés
depuis la garde, PR #125), précédée d'une lecture seule le 4 octobre à
17 h 20 (`docs/recette-planning.md`, « Troisième recette »). Prouvé : le
recalcul du matin — plans « recalcul du matin » de 06 h 15 les 4 et
5 octobre, par le Worker planificateur de la météo —, le lundi d'une
nouvelle semaine, le recalcul à la demande en 1,99 puis 1,90 s depuis le
navigateur, le refus et la carte datée d'un calcul antérieur, les 37
créneaux du plan de 06 h 15 rejoués à la main sur la réserve — de 25,619 à
59,997 m³, jamais sous 0 ni au-dessus de 60, « Manque d'eau 0,00 m³ » vrai
cette fois —, la pluie prévue au-dessus de R3 laissée passer, R6, R7, la
pompe jamais au-dessus de 8 m³/h, le seuil de planification. Non prouvé :
la pénurie, hors d'atteinte cette semaine (36,716 m³ demandés pour 112,62
mobilisables) — la garde reste prouvée par le test des chiffres de la ferme
seul — ; la limite journalière, aucune sur la ferme ; 390 px, impossible
dans ce Chrome, couvert par P10. Cinq constats au jugement du porteur,
points 29 à 33 : la météo actualisée à l'ouverture de la page a porté la
pluie prévue de 14,2 à 15,7 mm, le reste brut de plein champ à 4,3 mm sous
le seuil de 5 mm, et les 26 créneaux de plein champ ont disparu du plan
recalculé sans trace ; la réserve part de l'observation du 25 septembre
prise telle quelle, sans l'apport des dix jours écoulés ; une proposition
refusée est reproposée à l'identique, contre la lettre du contrat ; le
réglage R1 « recalcul à 06:30 » n'agit pas, le calcul se faisant à 06 h 15 ;
deux motifs d'explication inexacts. Le sur-apport goutte-à-goutte puis
rampe de la seconde recette est revu, réduit à 1,5 mm par la portée. Aucun
code modifié ; les données de la ferme portent le calcul de 14 h 11 et une
proposition refusée. **Le moteur 3.5 reste 🟡 ; sa clôture est au jugement
du porteur.**

Le 5 octobre 2026 à 14 h 48, **PR #134 fusionnée par le porteur** (troisième
recette, registres seuls) ; déploiement de `main` à `7577ee7` réussi à
14 h 55, quatre jobs verts du premier coup, aucun Worker redéployé, aucune
migration ; le site répond par la redirection vers Access. Le logiciel en
ligne reste celui de `4b83563`. Constat de l'assistant dans les journaux de
la CI.

Le 5 octobre 2026 vers 20 h 20, **le porteur répond aux constats de la
troisième recette** : les données de la ferme sont expérimentales,
l'assistant peut les modifier pour tester à charge de les remettre en état ;
la réserve est observée à 25 m³ (point 30) ; le seuil et la pluie prévue
restent tels quels, le logiciel expose les faits annoncés et l'utilisateur
décide (point 29, D-028) ; le point 31 est à réexpliquer ; la pénurie est à
fabriquer pour prouver le moteur (point 19) ; le réglage R1 est à retirer
(point 32, D-029). De 20 h 24 à 20 h 48, **quatrième recette réelle du
planning, la pénurie fabriquée, dans le navigateur du porteur, sur la
version déployée** (`7577ee7`, logiciel de `4b83563`) : observation de
25 m³ saisie, puis six calculs à l'attendu écrit avant — forage
indisponible, minimum de sécurité à 20 puis 40 m³, limite de prélèvement du
forage à 10 m³/jour, limite journalière d'irrigation à 10 m³/jour du mardi
au dimanche (scénario 4 du contrat), R2 à 0 % pour ramener le plein champ
dans le besoin — et la ferme remise en état, le recalcul final retrouvant le
plan du départ (`docs/recette-planning.md`, « Quatrième recette »). Prouvé :
la garde de la réserve en pénurie — jamais sous le minimum, 0,001 m³ quand
il vaut 0, 20,00 et 40,00 exactement quand il est relevé —, le stock
consommé au litre près, les créneaux raccourcis ou décalés à l'heure exacte
où l'apport comble le manque, les vagues décalées aux nuits suivantes au
rythme du forage, le budget stock − minimum + apport plafonné par la limite
de prélèvement, la part égale R9 comme cible, la limite journalière comme
règle forte, aucun jour limité au-dessus de 10 m³. **Le point 19 se
ferme.** Trois constats nouveaux, points 34 à 36 : le temps de calcul sur
le site varie de 3 s à plus de 45 s pour le même état ; sous limite
journalière, la coupe est nommée « stock et ressources insuffisants » et la
cible ignore le lundi sans limite, contre le scénario 4 du contrat ; la part
égale est une cible, la dernière planche examinée reçoit 0 % quand les
autres ont 30 %, et « Manque d'eau » ne vaut pas « demandés moins placé ».
Aucun code modifié ; les données de la ferme portent l'observation de
25 m³, le calcul de 20 h 47 et trois enregistrements de limite journalière,
dont deux désactivés. **Le moteur 3.5 reste 🟡, sa clôture au jugement du
porteur.**

Le 5 octobre 2026 vers 21 h 40, **PR `fix/retrait-reglage-r1` ouverte sur la
décision D-029**, empilée sur la PR #135 : le réglage R1 « heure du recalcul
quotidien » est retiré du contrat (`docs/planning-contract.md`), des
réglages (`lib/domain/planning/settings.ts`), de la présentation et du
formulaire ; le pli « Réglages du planning » dit que le recalcul du matin
suit la météo, à 06 h 15, et ne se règle pas ; un enregistrement qui porte
encore l'heure se lit sans elle, prouvé par un test de persistance ; aucune
migration. Deux tests ajoutés, 571 au total. En local, le parcours P10 a
d'abord refusé la note du pli, qui réutilisait la classe de la ligne
« calculé le » ; corrigé avant la PR. **Le point 32 reste 🟡 jusqu'à la
fusion, le déploiement et la recette sur la version déployée, sur
ordinateur et à 390 px.**

Le 5 octobre 2026 vers 21 h 50, **le porteur a tranché le point 31
(D-030)** : « Le créneau refusé est exclu. Pour le reste de la semaine. »
Le créneau, c'est le matériel de la proposition pendant ses heures ; le
besoin reste et se place ailleurs ; le refus ne vaut que pour la semaine
de son plan. Contrat corrigé le soir même : statut « refusée », règle sous
les statuts, événement du cycle, note de mise en œuvre et décision 14 ;
PR `docs/d030-creneau-refuse` ouverte, empilée sur la PR #136. Le moteur
ne lit pas encore les refus : **le point 31 reste 🟡 jusqu'à ce que le
moteur applique la règle**, dans la 3.7 ou par une correction à part sur le
mot du porteur. Aucun code modifié.

Le 5 octobre 2026 vers 22 h 30, **PR `fix/planning-temps-de-calcul` ouverte
sur le point 28**, empilée sur la PR #137 : profil CPU du calcul de la grande
ferme, 73 % du temps dans `minimumLevel`, presque tout à construire un
formateur de fuseau horaire neuf à chaque rupture de la projection ;
correction dans `lib/domain/water-management.ts`, un formateur par fuseau
et par usage, construit une fois ; le calcul passe de 788 à 1 052 ms à 209 à
237 ms sur le poste du porteur, pour le même plan ; un test ajouté, 572 au
total ; aucune règle métier touchée, budget D-027 inchangé. **Le point 28
reste 🟡 jusqu'à la lecture de la mesure sur la CI et au déploiement.**
Les contrôles ont montré le parcours P9 à la largeur ordinateur en échec deux
fois sur deux dans la suite complète, au clic sur l'onglet « Par série » qui
suit le rechargement, parti avant la fin du chargement des modules ; rejoué
seul, il réussit : point 37, sans lien avec la correction, à corriger à part.

Le 6 octobre 2026 vers 14 h, **mesure de la CI lue pour le point 28** : le job
« Application » de la PR #138 a calculé la grande ferme en 101 ms la veille au
soir, contre environ 1 000 ms avant la correction ; le budget de 2 000 ms ne
redescend que par une décision du porteur, 500 ms recommandés, cinq fois la
mesure. Le même soir, les jobs « Application » et « Workers Cloudflare » des
PR #136 et #137 et le job « Workers Cloudflare » de #138 ont été annulés sans
avoir démarré, aucun journal, quinze minutes après leur mise en file :
exécuteurs GitHub indisponibles à cette heure, rien dans le dépôt. La poussée
du présent commit rejoue toute la CI de #138, dont la branche contient les
trois PR précédentes.

Le 8 octobre 2026 vers 21 h 15, **les quatre PR du 5 octobre fusionnées et
déployées, le point 28 fermé, D-031 prise, la recette du retrait de R1
faite**. Le porteur a fusionné la PR #138 vers 20 h 58, ce qui a marqué
fusionnées les PR #135, #136 et #137 qu'elle contenait ; le déploiement de
`main` (`3e51899`) a été vérifié : les quatre jobs réussis, « Déploiement
Cloudflare » terminé à 21 h 05. Le point 28 est fermé, 101 ms sur la CI, et le
porteur a ramené le budget du test à 500 ms (D-031) : constante du test,
contrat du planning, roadmap, PR `fix/budget-planning-500-ms` ouverte avec les
présents registres. Recette du retrait de R1 (point 32) dans le navigateur du
porteur, page rechargée après le déploiement, sur ordinateur à 1 920 px : le
pli « Réglages du planning » s'ouvre d'un clic, dix-neuf champs R2 à R13,
aucun champ R1 ni « recalcul à 06:30 », la ligne de résumé du pli sans heure
de recalcul, la note « Le recalcul du matin suit la météo, à 06 h 15 ; il ne
se règle pas. Un réglage enregistré vaut au prochain calcul. » affichée sous
le titre, aucun débordement horizontal ; l'en-tête du planning dit « calculé
le 08/10/2026 06:15 (recalcul du matin) ». À 390 px, la fenêtre Chrome
maximisée sur le second écran ayant ignoré trois demandes de
redimensionnement, la page a été rendue dans un cadre de 390 px de large
inséré dans la page elle-même (mêmes cookies, mêmes règles d'affichage par
largeur), le pli ouvert d'un clic : note lisible sur trois lignes, aucun
débordement horizontal, 375 px de défilement pour 375 px visibles, le champ le
plus large à 312 px ; cadre retiré, onglet fermé. Constat de l'assistant,
captures dans le compte rendu ; point 32 fermé, au jugement du porteur. Le
porteur a aussi autorisé la correction du point 37, PR à part.

Le 8 octobre 2026 vers 22 h, **point 37 corrigé, PR
`fix/p9-clic-apres-rechargement` ouverte sur le mot du porteur**, empilée sur
la PR #144. Après son rechargement, le parcours P9 clique l'onglet « Par
série » par `ouvrirParClic`, jusqu'à ce que l'onglet soit sélectionné,
l'onglet n'étant pas une bascule ; l'aide dit qu'elle vaut aussi pour le
premier clic qui suit un rechargement, et le contrat des parcours en fait une
règle. Les parcours P1, P4 et P6, qui rechargent aussi la page, ont été
vérifiés : P1 attend que son minuteur avance avant de cliquer, preuve
équivalente ; P6 ne fait que lire ; P4, dont le premier geste pouvait être de
feuilleter l'historique, ouvre et ferme d'abord la bulle d'aide, comme P7 à
son départ, corrigé dans la même PR. Contrôles : lint sans avertissement
(10 s), typage sans erreur (3 s), 572 tests réussis en 8 s, `pnpm knip` sans
code mort (4 s), parcours navigateur 24 sur 24 réussis en 3 min 4 s (et 24 sur
24 en 3 min 10 s avant la retouche de P4), douze aux deux largeurs ;
compilation, `pnpm push:check` et `pnpm weather:check` omis : ni le code livré
ni les Workers ne changent.

Le 8 octobre 2026 vers 22 h 06, **PR #144 et #145 fusionnées par le porteur et
déployées**. La PR #144 (budget D-031, registres) fusionnée à 21 h 51 : les
quatre jobs de `main` (`eca1440`) réussis, « Déploiement Cloudflare » terminé
à 21 h 57. La PR #145 (point 37, roadmap), mise à jour sur `main` par le
porteur puis fusionnée à 21 h 59 : les quatre jobs de `main` (`bc08c87`)
réussis, « Déploiement Cloudflare » terminé à 22 h 06. Ni l'une ni l'autre ne
change le code livré. Points 28 et 37 fermés et déployés ; dépôt local revenu
sur `main`, branches fusionnées supprimées. Suite de la file du porteur :
point 26. Contrôles de la présente PR de registres : lint sans avertissement
(9 s), typage sans erreur (2 s), 572 tests réussis en 9 s ; compilation, `pnpm
knip`, `pnpm push:check`, `pnpm weather:check` et parcours omis : registres
seuls.

Le 8 octobre 2026 vers 22 h 35, **lot de dépendances du 8 octobre : quatre PR
Dependabot reprises en une seule PR du dépôt, avec `next` 16.3.8**. Dependabot
avait ouvert le 7 octobre cinq PR de dépendances de développement, toutes aux
trois jobs verts. Le porteur a fusionné #142 (`knip` 6.37.0 → 6.39.0) à
22 h 21 puis, les autres se remettant en conflit sur le verrou à chaque
fusion, a demandé une seule PR pour un seul déploiement. La PR
`chore/dependances-8-octobre`, empilée sur la PR #146, monte
`eslint-config-next` 16.3.5 → 16.3.8 (#139), `drizzle-orm` 0.45.2 → 0.45.3
(#140), `vite` 8.3.0 → 8.3.2 (#141) et `vinext` 1.0.0 → 1.0.1 (#143), versions
exactes, verrou refait par `pnpm install` : il suit `rolldown` 1.2.9 → 1.2.13
et `@napi-rs/wasm-runtime` 1.2.4 avec Vite, `@vinext/types` 1.0.1, et perd
`zod` 4.4.3 (`zod-validation-error` lit le 4.6.5 déjà présent) et
`@tybys/wasm-util`. Notes de version lues : vinext 1.0.1 corrige le serveur de
développement, les shims de `NextRequest` et la mise en cache Cloudflare ;
vite 8.3.1 et 8.3.2, dépendances et sourcemaps ; drizzle-orm 0.45.3 ajoute un
pilote Netlify, sans effet ici ; eslint-config-next suit `next`. S'y ajoute
**`next` 16.3.6 → 16.3.8** (#147, ouverte par Dependabot à 22 h 23, dès que la
fusion de #142 a libéré une place sous sa limite de cinq PR ouvertes) : la
16.3.8 du 30 septembre 2026 corrige sept avis de sécurité, une SSRF haute dans
l'optimisation d'images, cinq moyens sur le cache et les métadonnées, un bas
sur le serveur de développement, soit douze des vingt-cinq alertes ouvertes
sur `main` ; dépendance d'exécution, mise dans la même PR pour le même
déploiement, à l'appréciation du porteur à la fusion. Aucun code du logiciel
ne change. Contrôles : lint sans avertissement (9 s), typage sans erreur
(6 s), 572 tests réussis en 9 s (planning 67 ms), compilation réussie (4 s),
`pnpm knip` sans code mort (4 s, l'indication de configuration de `knip.json`
connue, inchangée), `pnpm push:check` et `pnpm weather:check` à blanc réussis
(4 s et 3 s), parcours navigateur 24 sur 24 réussis en 2 min 49 s, douze aux
deux largeurs ; la même suite, verte aussi, avait été jouée sur les quatre
montées seules, parcours 24 sur 24 en 2 min 57 s. Après la fusion : Dependabot
ferme seul ses PR #139, #140, #141, #143 et #147 ; treize alertes devraient
rester, toutes de développement (`sharp` 0.35.4 gardé par Miniflare,
`brace-expansion` ×6, `fast-uri` ×3, `braces`, `js-yaml`, `fflate`) ; recette
rapide du site déployé à faire, vinext changeant l'outil de construction.

Le 8 octobre 2026 vers 22 h 50, **PR #148 fusionnée par le porteur et
déployée : lot de dépendances du 8 octobre livré**. Fusionnée à 22 h 41
(`7de22f8`), elle emporte la PR #146, registres de #144 et #145, sur laquelle
elle était empilée. Les quatre jobs de `main` réussis, « Déploiement
Cloudflare » terminé à 22 h 46 : application seule redéployée, 1 505,91 Kio
envoyés (430,39 Kio compressés), démarrage du Worker en 14 ms, contre
1 505,36 Kio (429,73 Kio) et 14 ms au déploiement précédent, la construction
par vinext 1.0.1 donnant la même taille. Dependabot a fermé seul ses PR #139,
#140, #141, #143 et #147 à 22 h 42 ; plus aucune PR ouverte. Alertes ouvertes
à 22 h 47 : treize, toutes de développement, comme attendu (`brace-expansion`
×6, `fast-uri` ×3, `sharp`, `braces`, `js-yaml`, `fflate`) ; la mise à jour de
sécurité de `sharp` tentée dans la foulée par Dependabot a échoué,
« security_update_not_possible », dernière version résoluble 0.35.4, comme
noté le 1er octobre. Recette rapide du site déployé, constat de l'assistant
dans le Chrome du porteur : la page `/irrigation` se charge, saison 2026 et
parcelle Clémentière affichées avec l'apport par heure, les objectifs
hebdomadaires et la dernière lecture, aucune erreur de console après
rechargement ; largeur 390 px et parcours manuels non rejoués, le lot ne
changeant aucun code du logiciel. Dépôt local revenu sur `main`, branches
fusionnées supprimées. Pause demandée par le porteur ; suite de sa file :
point 26. Contrôles de la présente PR de registres : lint sans avertissement
(9 s), typage sans erreur (3 s), 572 tests réussis en 8 s ; compilation, `pnpm
knip`, `pnpm push:check`, `pnpm weather:check` et parcours omis : registres
seuls.

Le 9 octobre 2026 vers 08 h 50, **PR #149 fusionnée par le porteur et
déployée ; point 26 corrigé, PR `fix/arbitrage-vide` ouverte**. La PR #149
(registres de #148) fusionnée à 08 h 31 (`b15c5bd`) : les quatre jobs de
`main` réussis, « Déploiement Cloudflare » terminé à 08 h 37, registres seuls.
Sur son mot (« continue la suite »), point 26 repris dans l'ordre du dépôt :
la règle d'abord dans `docs/planning-contract.md` — un arbitrage absent ou
vide ne s'impose pas, la conduite en pénurie s'applique comme s'il n'existait
pas, budgets compris —, puis un test du moteur rouge avant la correction
(`tests/planning-engine.test.ts`) : sous une limite de 1 m³ par jour, le plan
calculé avec un arbitrage vide n'avait aucun budget et aucune cible bornée, le
plan sans arbitrage en avait ; une première version du test à 6 m³ par jour ne
faisait naître aucune pénurie et a été resserrée. Correction dans
`lib/domain/planning/shortage.ts` : `applyShortage` ne tient pour un arbitrage
qu'une liste non vide ; commentaire du contrat de types ajusté ;
`planning-service` inchangé, la règle vivant dans le domaine. Contrôles : lint
sans avertissement (12 s), typage sans erreur (5 s), 573 tests réussis en 8 s
(planning 67 ms), compilation réussie (5 s), `pnpm knip` sans code mort (4 s),
`pnpm push:check` et `pnpm weather:check` à blanc réussis (6 s et 4 s),
parcours navigateur 24 sur 24 réussis en 3 min 1 s, douze aux deux largeurs.
Point 26 ✅. Suite de la file du porteur : point 24.

Le 9 octobre 2026 vers 09 h 20, **PR #150 fusionnée par le porteur et
déployée ; point 24 corrigé, PR `fix/limite-demarrage-volume-inconnu`
ouverte**. La PR #150 (point 26) fusionnée à 08 h 55 (`471a3b4`) : les quatre
jobs de `main` réussis, « Déploiement Cloudflare » terminé à 09 h 01. Sur son
mot (« continue la suite »), point 24 repris dans l'ordre du dépôt : la règle
d'abord dans `docs/wetted-surface-contract.md` — le démarrage et la reprise
obéissent à la règle de la création, refus d'un volume invérifiable sous une
limite active, même pour une irrigation planifiée avant la limite —, puis cinq
tests de la garde du démarrage dans `tests/db/irrigation-limits.test.ts`,
l'horloge arrêtée au début prévu : deux rouges avant la correction, « Missing
expected rejection », une planche inconnue puis toutes ; trois verts qui
fixent ce qui ne change pas, accepté sans limite ou limite désactivée, volume
connu toujours jugé sur son volume, sous la limite comme au-dessus.
Correction : le jour limité se cherche en un seul endroit du domaine,
`firstLimitedDay` dans `lib/domain/water-management.ts`, testé à cheval sur
minuit ; la garde du démarrage l'appelle dès que `irrigationVolumeIncomplete`
le dit, la garde à la création l'appelle à la place de son calcul en ligne,
comportement et message inchangés. Contrôles : `pnpm lint`, `pnpm typecheck`,
`pnpm test` (579 tests, six de plus : cinq de la garde du démarrage, un du
domaine), `pnpm build`, `pnpm knip`, `pnpm push:check` et `pnpm weather:check`
verts ; `pnpm e2e` 24 parcours réussis aux deux largeurs en 2,8 min. Point 24
✅. Suite de la file du porteur : point 14.

Le 9 octobre 2026 vers 10 h 30, **PR #151 fusionnée par le porteur et
déployée ; demande d'alertes météo paramétrables consignée dans la roadmap ;
point 14 corrigé, PR `fix/limite-prelevement-jour-ferme` ouverte**. La PR #151
(point 24) fusionnée à 10 h 10 (`3bc676b`) : les quatre jobs de `main`
réussis, « Déploiement Cloudflare » terminé à 10 h 17. Sur son mot (« continue
la suite », et « consigne aux endroits conçus pour » sa demande nouvelle),
deux choses. La demande d'abord : paramétrer des alertes météo selon des
critères renseignés par l'utilisateur, par exemple une notification quand la
température minimale prévue descend sous 5 °C ; consignée en section 5 bis de
la roadmap, dans le tableau d'état et dans l'ordre d'exécution, place proposée
après la 3.7, en 17, les étapes suivantes décalées d'un rang, et laissée à sa
décision 🔶 ; ce qui existe déjà y est relevé — la synchronisation de 06 h 15
lit les températures de Visual Crossing mais ne conserve que pluie et ET0, le
Worker Push ne sert que les alarmes du minuteur — avec les questions qu'un
contrat devra trancher. Le point 14 ensuite, dans l'ordre du dépôt : la règle
au contrat hydraulique 3.2, le jour d'un créneau et d'un prélèvement est celui
de la ferme (D-004) ; test du domaine rouge d'abord (`tests/pumps.test.ts`),
un créneau de 0 h 30 heure de Paris, un prélèvement de 0 h 00 et une période
de disponibilité, tous lus la veille en UTC, « expected unavailable, actual
available » ; correction dans `resolvePumpOriginAvailability` par
`dateKeyInTimeZone`, fuseau de la ferme par défaut, les deux appelants
inchangés. Relevé en relisant, consigné au point 38 pour son jugement : la 3.2
ne compte dans la limite du jour que les prélèvements directs quand le
planning y compte aussi les apports vers une réserve. Contrôles : lint,
typecheck, test (580 tests réussis, un de plus), build, knip, push:check et
weather:check tous à zéro ; parcours navigateur `pnpm e2e` 24 sur 24 réussis
en 2,9 min. Point 14 ✅. Suite de la file du porteur : 11, 15, 16, 13.

Le 9 octobre 2026 vers 11 h 20, **PR #152 fusionnée par le porteur et
déployée ; quatre décisions D-032 à D-035 ; points 11, 15, 16 et 38 corrigés,
PR `fix/points-11-15-16-38` ouverte**. La PR #152 (point 14) fusionnée à
10 h 56 (`6df3609`) : les quatre jobs de `main` réussis, « Déploiement
Cloudflare » terminé à 11 h 03. Le porteur a tranché les quatre points en
attente de son jugement — point 11, « il ne pleut jamais sous abri, donc il
faut aligner la règle » (D-032) ; point 15, « elle est servie par la
faisabilité » (D-033) ; point 16, oui (D-034) ; point 38, oui (D-035) — et les
quatre corrections vont dans une seule PR, pour un seul déploiement, comme il
l'avait demandé le 8 octobre pour une série du même genre. Dans l'ordre du
dépôt pour chacun : la règle au contrat — hydraulique 3.2, planning, besoins,
séries —, le test du domaine rouge d'abord (`expected 'unavailable', actual
'available'` ; motif `no-objective` ; `expected 25, actual null` ; `expected
0, actual 8`), puis la correction : la 3.2 compte les prélèvements du jour par
`actualWithdrawalsByResourceAndDate`, comme le planning ; le moteur lit le
remplacement manuel avant l'objectif ; `objectiveForBed` tient l'objectif pour
applicable dès qu'un jour est couvert, la demande étant la somme des septièmes
sur ces jours ; le résumé « Par périmètre » reçoit les parcelles et pondère la
pluie par la surface, zéro sous abri. Cinq commits, un de décisions et un par
point. Contrôles complets, parcours compris. Relevé en corrigeant le point 16,
consigné au point 39 : la vue « Par périmètre » de l'historique demande encore
un objectif sur chaque jour-planche de la période pour calculer l'écart. Point
13 à suivre, PR `fix/` à part.

Le 9 octobre 2026 vers 11 h 45, **PR #153 fusionnée par le porteur et
déployée ; point 39 tranché (D-036) et corrigé, PR
`fix/objectif-historique-jours-couverts` ouverte ; deux consignes de
travail**. La PR #153 (points 11, 15, 16 et 38) fusionnée à 11 h 26
(`eaada66`) : les quatre jobs de `main` réussis, « Déploiement Cloudflare »
terminé à 11 h 33. Sur le point 39, le porteur a tranché : « il faut aligner
l'historique » (D-036). Dans l'ordre du dépôt : la règle au contrat des
séries, pour les deux vues de l'historique ; tests rouges d'abord — résumé par
périmètre, sept jours couverts sur quatorze et deux planches dont une seule
avec objectif, `expected 35, actual null` ; série au premier objectif posé
deux semaines après l'implantation, `expected 32, actual null` — ;
`aggregateHydricObjective` rend l'objectif dès qu'une journée-planche est
couverte, les cumuls par série comptent zéro une planche sans journée
couverte, l'avertissement « incomplet, l'écart n'est pas calculé » est retiré
parce qu'il serait faux, la carte « Objectif » affiche le nombre de
journées-planche couvertes. Deux commits. Contrôles complets, parcours
compris. Relevé en passant, consigné au point 40 : l'historique applique un
objectif à toute sa semaine, même posé le mercredi, là où la 3.3 ne le compte
qu'à partir de son jour (D-034). Deux consignes du porteur pendant la tâche,
parce qu'il avait perdu le fil de la roadmap après la série de PR `fix/` :
chaque compte rendu de PR situe désormais l'avancement sur la roadmap
(`AGENTS.md`, fin de tâche) ; la 3.8 ne commence qu'après un avertissement
explicite, la 3.5 et la 3.7 terminées, parce qu'il veut la vérifier lui-même
de fond en comble (roadmap, trois endroits). Point 13 à suivre, PR `fix/` à
part.

Le 9 octobre 2026 vers 12 h 25, **PR #154 fusionnée par le porteur et
déployée ; point 13 confirmé et corrigé, PR
`fix/limite-journaliere-modification-planifiee` ouverte ; liste des points
ouverts remise au porteur**. La PR #154 (point 39) fusionnée à 12 h 05
(`7324850`) : les quatre jobs de `main` réussis, « Déploiement Cloudflare »
terminé à 12 h 12. Point 13, sur son « continue avec le point 13 » : confirmé
à la lecture, l'action de modification d'une irrigation planifiée passait
l'irrigation modifiée à la validation hydraulique pour l'exclure, mais pas à
la garde de la limite journalière, qui comptait son ancien volume planifié en
plus du nouveau. Dans l'ordre du dépôt : la règle au modèle de données (2.8) ;
trois tests de persistance rouges d'abord — à volume égal sous une limite de
1 m³, la garde refusait « 0,75 m³ planifiés, 0,75 m³ pour cette irrigation,
limite 1 m³, dépassement 0,5 m³ » — ; la garde reçoit l'irrigation modifiée et
la retire du journal, par le mécanisme qu'utilise déjà la garde du démarrage ;
l'action la lui passe. Contrôles complets, parcours compris. À sa demande, la
liste des points encore ouverts est remise dans le compte rendu : 4 (recette
3.3.1, à lui), 31 (moteur à faire, 3.7), 33 et 35 (corrigibles sur son mot),
34 (à mesurer sur le site), 36 et 40 (à son jugement). Plus aucun point
confirmé en attente de correction : la 3.7 attend son « vas-y ».

Le 9 octobre 2026 vers 13 h 25, **PR #155 fusionnée par le porteur et
déployée ; douze réponses du porteur, trois décisions (D-037 à D-039) ; points
33 et 35 corrigés, PR `fix/explications-planning-et-limite-journaliere`
ouverte**. La PR #155 (point 13) fusionnée à 12 h 25 (`e684eb8`) : les quatre
jobs de `main` réussis, « Déploiement Cloudflare » terminé à 12 h 31. Sur la
liste des points en attente de son jugement, le porteur répond d'un coup :
point 36, fraction réservée à chaque planche en pénurie (D-037) et écart du
manque d'eau expliqué à l'écran sans changer le calcul (D-038) ; point 40,
aligner l'historique sur le jour de pose de l'objectif (D-039) ; points 33 et
35, « oui, tu corriges » ; point 31, moteur dans la 3.7 ; point 34, mesure par
journaux côté serveur, lecture à lui expliquer pas à pas ; point 4, recette
par l'assistant sur une planche dont l'objectif est relevé au-dessus de l'ET0
puis remis, sans toucher à l'ET0 ; points 3, 17 et 18 cochés ; clôture de la
3.5 après les points 33, 35 et 36 ; place de la 5 bis confirmée après la 3.7 ;
3.7 ensuite, sur son mot. Points 33 et 35 dans l'ordre du dépôt : règles au
contrat du planning (« Ce que chaque proposition explique », « Pénurie ») ;
quatre tests du moteur rouges d'abord — « saturée avant 21:47 : aucun » pour
une rampe validée tenant la pompe jusqu'à 21 h 46 min 12 s,
« after-forecast-rain » là où l'espacement depuis une irrigation validée du
vendredi matin fixait le samedi, « B1-0 : water-budget » sous une limite de
1 m³/jour que le stock et le forage dépassent largement, reste de limite 5 m³
avec un mardi sans limite — et le sous-titre du manque d'eau sans fonction ;
la pompe nomme ce qui la tenait au départ voulu ou la prend à la fin, lu au
moment du conflit ; le motif du moment reste celui qui a fixé le jour ; le
reste de limite ne borne plus la semaine dès qu'un jour est sans limite ; la
coupe sous limite porte le motif `daily-limit` et le résumé le dit ; un test
du point 26, qui attendait « stock et ressources » pour une coupe par la
limite, est aligné. Contrôles complets, parcours compris.

Le 9 octobre 2026 vers 14 h 05, **PR #156 fusionnée par le porteur et
déployée ; ferme de test du moteur déplacée dans `tests/support/`, PR
`chore/ferme-de-test-du-moteur` ouverte**. La PR #156 (points 33 et 35)
fusionnée à 13 h 31 (`58c4447`) : les quatre jobs de `main` réussis,
« Déploiement Cloudflare » terminé à 13 h 38. Avant le correctif du point 36
(D-037, D-038), `tests/planning-engine.test.ts` est à 594 lignes comptées pour
une limite de 600 (règle `max-lines`) : les constantes, la ferme de test aux
chiffres de la ferme, les aides de lecture d'un plan et les invariants du
contrat passent dans `tests/support/planning-fixtures.ts`, exportés tels
quels, sans changer une ligne de test ni de code du logiciel ; le fichier de
tests garde le budget de temps du calcul et ses tests, 383 lignes.
Restructuration seule, dans une PR à part du correctif (« une PR restructure
ou une PR ajoute, jamais les deux »). Contrôles complets hors parcours
navigateur, sans rapport avec un déplacement de tests.

Le 9 octobre 2026 vers 14 h 50, **point 36 corrigé sur le mot du porteur : la
part réservée en pénurie (D-037) et la note du manque d'eau (D-038), PR
`fix/part-reservee-et-manque-explique` ouverte à la suite de la PR #157**.
Mécanisme écrit au contrat avant le code (`docs/planning-contract.md`,
« Pénurie », « La part réservée », et sa section de mise en œuvre) : un
registre des parts par chaîne d'eau au budget fini
(`lib/domain/planning/shares.ts`), chaque planche y ayant sa cible en m³ au
prix de la surface que son propre matériel mouille ; un créneau est borné par
bissection à ce que ses parts paient, imputé aux parts des planches arrosées
utilement, son débordement à l'eau non attribuée puis aux parts de ses propres
planches ; ce qu'une planche ne peut pas recevoir est libéré en fin de tour et
redistribué par la conduite, quatre tours au plus. Motif de dose « la part de
la semaine réservée à ses planches », contrainte « part de la semaine
atteinte, le reste est réservé aux autres planches » ; la ligne du budget dit
« part réservée » au lieu de « servi ». Tests rouges d'abord : les trois de
`tests/planning-shares.test.ts` et la note dans
`tests/planning-presentation.test.ts` échouent à l'import, `does not provide
an export named 'waterDeficitExplanation'` ; rejoués sur une copie sans la
note, « B1-0 : espacement respecté » (l'invariant d'espacement de la ferme de
test comptait les planches de bord, plus strict que D-025 : corrigé), « T1-1 :
9.999999999999996 mm, plus que sa part de départ » et « une note explique
l'écart ». La première borne écrite ne faisait payer aux planches servies que
l'eau utile reçue : « B2-1 : 0 mm, sous sa part par son propre débordement »,
« manque d'eau 14.929800000000007 m³, demandé moins placé
14.93013000000001 m³ » ; corrigée, les planches servies paient toute leur part
restante. Après correction, sur une réserve à 30 % de la demande, la dernière
planche examinée reçoit sa part comme la première : bloc 2 à 5,678 mm et
tunnel 1 à 5,542 mm, coupés à leur part, le débordement de leurs rampes sur
les planches de bord du bloc 1 (0,148 m³) pris sur leurs propres parts, les
autres à 6 mm, 5,348 m³ placés pour 5,348 mobilisables. La note du manque
(`waterDeficitExplanation`) chiffre sous les cartes l'écart entre demandé,
placé et manque d'eau — l'eau placée sans couvrir de besoin compté, le manque
pour une autre raison que l'eau — sur le plan enregistré, sans changer le
calcul ; la cause pressentie au point 36, l'eau d'une rampe comptée sur une
surface plus large que celle du propre matériel de la planche, est confirmée
par le test : 12,628 m³ de manque pour 17,828 demandés moins 5,348 placés. Un
invariant de budget s'ajoute à la ferme de test : la somme des volumes d'une
chaîne ne dépasse jamais son budget. Deux limites vues en chemin et laissées
telles quelles, à trancher à part : l'arbitrage 3.4 validé, dont les
allocations ne sont pas encore des parts réservées ; le budget d'une chaîne,
qui compte les apports jusqu'à dimanche minuit même après la dernière plage,
et zéro, non le manque, quand le stock est sous le minimum de sécurité. La
recette sur le site, après fusion et déploiement, reste à faire par le
porteur : en pénurie, chaque planche reçoit sa part, et la note sous les
cartes explique l'écart. Contrôles complets, parcours navigateur compris.

Le 9 octobre 2026 vers 15 h 40, **PR #157 et PR #158 fusionnées par le porteur
et déployées ; point 40 corrigé sur son mot : l'historique compte un objectif
à partir de son jour de pose (D-039), PR
`fix/historique-objectif-jour-de-pose` ouverte**. La PR #157 (ferme de test du
moteur) fusionnée à 15 h 13 (`8532a08`), la PR #158 (point 36) à 15 h 14
(`b431b79`) ; l'exécution de `main` de la première annulée par le groupe de
concurrence au profit de la seconde, dont les quatre jobs ont réussi,
« Déploiement Cloudflare » terminé à 15 h 22 : le site porte la part réservée
en pénurie et la note du manque d'eau, la recette du point 36 sur le site
reste à faire par le porteur. Point 40 : la règle du jour de pose, écrite au
contrat des séries avant le code (D-034, D-039), vit en un seul endroit,
`goalRevisionFirstDate` dans `lib/domain/hydric-goal-revisions.ts` — une
reprise automatique compte dès le lundi, une révision posée dans sa semaine
dès son jour de pose en heure de Paris, une révision posée après sa semaine
dès le lundi suivant ; le tableau des besoins l'appelle sans changer de
résultat (ses 31 tests inchangés), l'historique « Par périmètre » et les
cumuls par série la suivent (`aggregateHydricObjective`) et ne départagent
plus deux révisions de la même milliseconde par l'identifiant, ce que le
contrat de l'ordre des révisions interdisait sans nommer l'historique dans sa
portée : portée complétée. Test rouge d'abord dans
`tests/irrigation-history.test.ts` : « expected: 25, actual: 35 » sur la
semaine d'un objectif de 35 mm posé le mercredi ; le même test fixe la semaine
suivante à 35, la reprise automatique à 35, l'objectif posé après sa semaine à
« indisponible », le jour de pose lu à Paris (22 h 30 UTC la veille, mercredi
0 h 30 à la ferme) à 25, et la seconde de deux révisions de la même
milliseconde comme faisant foi. Le test de persistance des séries, qui
enregistre aujourd'hui des objectifs pour des semaines passées, attend
désormais 224 mm sur 189 journées couvertes des 196 au lieu de 238 sur
toutes : ces objectifs comptent dès le lundi suivant leur semaine. Sur le
site, la semaine du premier objectif lira 25 mm dans l'historique comme dans
la 3.3. Contrôles complets, parcours navigateur compris.

Le 9 octobre 2026 vers 19 h 50, **PR #159 fusionnée par le porteur et
déployée ; point 34 instrumenté sur son mot : journaux de durée du recalcul
côté serveur, PR `feat/journaux-de-duree-du-recalcul` ouverte, lecture
expliquée pas à pas**. La PR #159 (point 40) fusionnée à 19 h 23 (`ca3ca79`),
les quatre jobs de `main` réussis, « Déploiement Cloudflare » terminé à
19 h 30 : sur le site, l'historique compte un objectif à partir de son jour de
pose, comme le tableau des besoins. Point 34 : la mesure que le porteur a
choisie, avant toute piste moteur. Chaque calcul de la semaine écrit une ligne
JSON `planning_calculation_completed` — déclencheur, saison, semaine, source
de l'instantané, nombres de planches et de propositions, millisecondes
entières par phase : `snapshot` (la lecture de l'instantané, mesurée par
l'action « Calculer » ou par le recalcul du matin), `inputs`, `needs`,
`arbitration` sous arbitrage validé, `engine`, `save`, `reread`, et le total
— ; chaque affichage de la page écrit `irrigation_page_loaded`
(`snapshotAndLists`, `dashboards`, `needs`, total) ; aucune ligne ne porte
d'identifiant de personne, de nom de planche, de jeton ni de cookie. Le
chronomètre, `lib/adapters/stopwatch.ts`, a une horloge injectable ; dans un
Worker Cloudflare, l'horloge n'avance qu'aux entrées-sorties, si bien qu'une
phase de calcul pur mesure 0 ms et que le calcul réel se lit dans le temps CPU
de l'invocation, donné à part par les journaux Cloudflare. Règle au contrat du
planning avant le code (« Les durées du recalcul »), deux tests rouges
d'abord : `tests/stopwatch.test.ts`, « ERR_MODULE_NOT_FOUND » sur le module
absent ; `tests/db/planning-service.test.ts`, « une ligne
planning_calculation_completed » absente, 3 réussis et 1 échec ; puis 2 et 4
réussis, la ligne émise en test donnant par exemple
`{"inputs":5,"needs":2,"engine":7,"save":0,"reread":1}` pour 15 ms. Guide de
lecture pas à pas dans `docs/publication.md`, « Lire les journaux du
Worker » : tableau de bord Cloudflare, Worker `module-irrigation-otf`, onglet
« Observability », invocation `POST /irrigation` de l'heure du clic, les deux
lignes et leurs totaux, montre en main depuis le navigateur ; la lecture
revient au porteur, l'assistant ne voyant jamais son compte, et c'est elle qui
nommera la phase coupable du 3 s à 45 s. Contrôles complets, parcours
navigateur compris.

Le 9 octobre 2026 vers 21 h 15, **PR #160 fusionnée par le porteur et
déployée ; journaux de durée du point 34 lus le soir même par l'assistant dans
le Chrome du porteur, sur son mot : le recalcul à la demande tient en 2,3 s vu
du navigateur, dont 1,0 s de serveur chronométré, aucune phase longue ni
variable, le 3 s à 45 s du 5 octobre non reproduit**. La PR #160 fusionnée à
20 h 41 (`5982ba0`), les quatre jobs de `main` réussis, « Déploiement
Cloudflare » terminé à 20 h 48. Lecture dans le tableau de bord Cloudflare —
Worker `module-irrigation-otf`, « Observability », vue « Events » —, dans le
navigateur où le porteur était connecté, sans voir ni saisir d'identifiant ;
les chiffres à l'assistant, le jugement au porteur (D-014). Premier affichage
de la page à 20 h 48, après le déploiement : 576 ms chronométrés côté page
(`snapshotAndLists` 102, `dashboards` 410, `needs` 64) pour une invocation de
2 557 ms et 1 589 ms de CPU, page reçue à 2,97 s et chargée à 3,31 s vu du
navigateur, 1,76 Mo décodés. Trois recalculs à la demande sur la ferme — 164
planches, 9 propositions, semaine du 5 octobre, instantané en cache de la
lecture OTF réussie de 20 h 42 — : un calcul à 20 h 52 que l'assistant n'a pas
déclenché, sans doute un clic du porteur, puis deux clics de l'assistant à
20 h 54 et 20 h 58, mesurés depuis le navigateur.
`planning_calculation_completed` : 455, 501 et 545 ms (`snapshot` 27, 78, 68 ;
`inputs` 275, 276, 315 ; `needs` 35, 27, 34 ; `engine` 0 ; `save` 92, 82, 94 ;
`reread` 26, 38, 34) ; `irrigation_page_loaded` dans la même requête : 498,
537 et 577 ms (`snapshotAndLists` 84, 83, 94 ; `dashboards` 381, 422, 425 ;
`needs` 33, 32, 58) ; invocations de 1 653, 1 679 et 1 826 ms pour 600, 407 et
562 ms de CPU ; vu du navigateur, 2,29 s et 2,25 s du clic à la fin de
« Calcul en cours » (requête du calcul 2,05 s et 1,97 s, puis une seconde
requête de 0,59 s et 1,05 s). Le temps se répartit donc en 1,0 à 1,1 s
chronométrés — `inputs` et `dashboards` les plus lourdes, `engine` à 0 ms
parce que l'horloge du Worker ne bouge pas pendant le calcul pur, lu dans le
CPU —, 0,6 à 0,7 s hors chronomètre (Access, rendu et sérialisation de la
page) et 0,4 à 0,6 s de réseau et de navigateur ; d'une fois à l'autre, moins
de 60 ms d'écart par phase. Actualisation forcée depuis OTF
(`/irrigation?refresh=1`, 20 h 59) : OTF a répondu 429 sur `/bedList` au bout
de 1,2 s (ligne d'erreur à 20:59:16.934), la page a repris le cache de 20 h 42
avec son avertissement, `snapshotAndLists` 1 205 ms, total 1 694 ms,
invocation de 2 708 ms et 920 ms de CPU, 3,1 s vu du navigateur. Chaque retour
sur l'onglet du site relit le plan et la faisabilité : des invocations `POST`
de 535 ms pour 137 ms de CPU. Le 3 s à 45 s n'est pas reproduit ce soir, tous
les instantanés venant du cache ; la piste la plus vraisemblable reste une
lecture OTF en direct au moment du clic — le cache de l'instantané vaut quatre
heures, après quoi « Calculer » relit Ouvre ta ferme à quatre appels par
seconde, huit secondes d'attente par appel et jusqu'à trois essais sur erreur
serveur, et le 429 est arrivé ce soir dès la première lecture forcée —, puis
l'isolat froid et le réseau du porteur ; les mêmes journaux la trancheront à
la prochaine occurrence : `snapshotSource` à `live` et une phase `snapshot`
longue. PR de registres et de documentation seule, aucun contrôle rejoué ; le
guide de lecture de `docs/publication.md` corrigé sur ce qui a été vu : vue
« Events », une ligne par message, retard d'ingestion, temps total et CPU dans
le détail de l'invocation.

Le 9 octobre 2026 vers 22 h, **PR #161 fusionnée par le porteur et déployée ;
point 34 tranché par lui : attendre une occurrence dans les journaux ;
recettes des points 4 et 7 faites le soir même par l'assistant dans le Chrome
du porteur, sur son mot, sur le site déployé : le besoin suit l'objectif seul
et l'ET0 reste informative, le retrait d'une pompe par défaut tient au
rechargement ; jugement au porteur**. La PR #161, registres de la lecture des
journaux, fusionnée à 21 h 40 (`32c0d88`), les quatre jobs de `main` réussis,
« Déploiement Cloudflare » terminé à 21 h 45. Sur la liste des points ouverts,
le porteur tranche le point 34 — attendre une occurrence du 3 s à 45 s dans
les journaux, aucune correction avant — et demande les recettes des points 4
et 7. Point 4, règle 3.3.1 (D-010), semaine du 5 au 11 octobre, besoins
calculés à 21 h 47 : un seul objectif posé, « Toute la ferme » à 20 mm par
semaine ; l'ET0 de la semaine, 12,4 mm, est affichée dans le calcul de chaque
planche comme « Information · hors calcul », inférieure à l'objectif sans
qu'il faille relever celui-ci ni toucher à l'ET0 : aucune donnée modifiée.
Sous abri — tunnels 1 à 4, huit planches chacun —, pluie réelle 0 (« abri =
0 »), irrigation réelle 0 : reste réel 20 mm, l'objectif entier, déficit
relatif 100 %, reste brut à planifier 20 mm, inchangé après le seuil de 5 mm,
volume 0,32 m³ pour 16 m² mouillés (T1-1) et 0,64 m³ pour 32 m² (T2-1 à T4-1),
2,56 m³ pour le tunnel 1 et 5,12 m³ pour chacun des tunnels 2 à 4 ; l'ancienne
règle, demande plafonnée par l'ET0, aurait affiché 12,4 mm. En plein champ,
23,2 mm de pluie réelle sur la semaine ramènent le reste réel à 0 mm, ce qui
ne départage pas les deux règles. Constat à l'assistant, jugement au porteur
(D-014) ; le point 4 passe ✅. Point 7, recette légère : dans « Pompe
habituelle du matériel », la pompe de `gag1` passée de « La pompe » à « Aucune
pompe · non vérifié » vers 21 h 50, avis « La pompe habituelle du matériel a
été enregistrée. », rechargement complet de la page : `gag1` toujours sans
pompe, les 33 autres matériels toujours sur « La pompe » ; pompe remise à
21 h 52, même avis, les 34 matériels sur « La pompe » après rechargement.
Données remises en état ; le point 7 est fermé. Largeur 390 px non rejouée,
l'interface ne changeant pas. PR de registres seule, aucun contrôle rejoué.

Le 10 octobre 2026 vers 12 h 30, **PR #162 fusionnée par le porteur et
déployée la veille au soir ; recette du point 36 faite sur le site, par
l'assistant dans le Chrome du porteur, sur son « reprends le travail »,
pénurie fabriquée et données remises en état : la part réservée tient, la note
du manque d'eau s'affiche pour un résidu d'arrondi des secondes sous un
libellé qui nomme une autre cause, point 41 ouvert ; jugement et clôture de la
3.5 au porteur**. La PR #162, registres des recettes des points 4 et 7,
fusionnée le 9 octobre à 22 h 19 (`2c7fb8b`), les quatre jobs de `main`
réussis, « Déploiement Cloudflare » terminé à 22 h 25. Recette (cinquième
recette de `docs/recette-planning.md`) de 12 h 11 à 12 h 24, sur la semaine du
5 au 11 octobre, où les quatre tunnels demandent 17,92 m³ à 20 mm et le plein
champ rien : forage mis Indisponible, minimum de sécurité de la réserve de
25 m³ relevé à 16 puis 20 m³, l'attendu écrit avant chaque calcul. T1, budget
9,00 m³, « part réservée : normale 50 % » : quatre propositions à 10 mm,
9,00 m³, les tunnels 1 à 3 à 21 h 00 et le tunnel 4 — dernier examiné, qui
restait sec le 5 octobre — à 22 h 01 dès que la pompe est libre, 2,571 m³,
réserve à 16,00 m³ exactement ; manque 8,92 m³ ; pas de note. T2, budget
5,00 m³, part 28 % : quatre propositions à 5,6 mm, 4,998 m³, le tunnel 4 à
21 h 34, réserve à 20,002 m³ ; manque 12,92 m³ ; la note s'affiche, « l'écart
tient à 0,002 m³ de besoin couverts par une eau comptée sur une surface plus
petite que celle de leur propre matériel » : cause fausse, les 2 L sont
l'arrondi des créneaux à la seconde entière (2 008 s pour 2 008,9 voulues,
0,0026 mm par planche que le moteur crédite comme reçus, sous le centième de
millimètre), aucune surface n'est en cause ; le seuil d'un litre de la note
est sous ce résidu, qui peut atteindre 9 L sur les quatre tunnels. Aucun motif
« part réservée » ni libération de parts en fin de tour observables sur cette
ferme cette semaine, le plein champ ne demandant rien. Remise en état par
l'écran à 12 h 23, recalcul final : les huit propositions du matin, 17,92 m³,
manque 0, « 43,193 m³ mobilisables ». Trois recalculs en 1,83 à 2,50 s, le 3 s
à 45 s du point 34 ne s'est pas produit. Largeur 390 px non émulée, l'outil
répondant « fait » sans effet sur la page ; couverte par P10. Le point 36
passe en recette faite, jugement au porteur ; point 41 ouvert pour la note ;
la clôture de la 3.5 reste au porteur. PR de registres seule, aucun contrôle
rejoué.

Le 10 octobre 2026 vers 13 h 10, **PR #163 fusionnée par le porteur et
déployée ; point 41 tranché par lui (D-040, « je suis ta recommandation pour
le point 41 ») et corrigé le jour même : la note du manque d'eau tolère le
résidu d'arrondi des secondes que le moteur tient déjà pour reçu, contrat
précisé avant le code, deux tests rouges d'abord ; PR `fix/` ouverte ; recette
sur le site après la fusion ; clôture de la 3.5 au porteur**. La PR #163,
registres de la recette du point 36, fusionnée à 12 h 43 (`bbd2ff5`), les
quatre jobs de `main` réussis, « Déploiement Cloudflare » terminé à 12 h 50.
Contrat (`docs/planning-contract.md`, « Interface (3.6) », la note du manque
d'eau) : la note ne paraît, pour l'eau placée à côté en plus ou en moins,
qu'au-delà du résidu d'arrondi des secondes — un centième de millimètre par
planche et par créneau qui l'arrose, au prix de la surface mouillée de
l'application, et au moins un litre — ; le manque pour une autre raison garde
son seuil d'un litre. Deux tests écrits avant le correctif et rouges sur
l'ancien code : dans `tests/planning-presentation.test.ts`, les chiffres de la
ferme (quatre créneaux de 2 008 s à 10 mm/h sur 896 m², 4,998 m³ placés pour
5,000 comptés), attendu `null`, reçu « Demandés 17,92 m³, placés 4,998 m³,
manque d'eau 12,92 m³ : l'écart tient à 0,002 m³ de besoin couverts par une
eau comptée sur une surface plus petite que celle de leur propre matériel » ;
dans `tests/planning-shares.test.ts`, la ferme de test du moteur (5,12256 m³
de budget pour les 10,24 m³ des tunnels, 10,005 mm par planche, un résidu de
2 L entre le litre et le centième de millimètre sur 512 m²), attendu `null`,
reçu le même libellé sur « Demandés 17,828 m³, placés 5,12 m³, manque d'eau
12,705 m³ » ; `# tests 13 # pass 11 # fail 2` sur les deux fichiers. Correctif
dans `lib/domain/planning/presentation.ts` : `roundingResidueCubicMeters`
somme un centième de millimètre sur la surface mouillée de chaque application
arrosée du calcul, la tolérance vaut le plus grand d'un litre et de ce résidu,
les deux branches de l'eau placée à côté la comparent ; le calcul du manque,
la ligne de budget et les parts ne changent pas. Le test de la ferme vérifie
aussi que la note reparaît au-delà du résidu, à 0,022 m³, les 9 L des quatre
tunnels dépassés. Contrôles joués sur la branche, consignés ci-dessous. Reste,
après la fusion, la recette sur le site : la pénurie de T2 refaite, forage
indisponible et minimum à 20 m³, la note absente, données remises en état ; la
clôture de la 3.5 reste au porteur.

Le 10 octobre 2026 vers 14 h 10, **PR #164 fusionnée par le porteur et
déployée ; recette du point 41 faite sur le site par l'assistant dans le
Chrome du porteur, la note absente ; points 4, 36 et 41 fermés par le porteur,
point 34 laissé en veille, non bloquant ; sous-tranche 3.5 close par lui.** À
sa demande du jour — clôturer proprement les points ouverts entre deux
sous-tranches —, en quatre étapes guidées. La PR #164, correctif du point 41,
fusionnée à 13 h 15 (`aea861f`), les quatre jobs de `main` réussis,
« Déploiement Cloudflare » terminé à 13 h 21. Recette du point 41 de 13 h 23 à
13 h 34, sous sa consigne du 5 octobre, sur la version déployée (sixième
recette de `docs/recette-planning.md`) : la pénurie de T2 du matin refaite à
l'identique, forage indisponible et minimum de sécurité à 20 m³, 5,00 m³
mobilisables : mêmes quatre créneaux de 5,6 mm pour 4,998 m³, même réserve à
20,002 m³ au plus bas, même manque de 12,92 m³, même part de 28 %, et aucune
note sous les cartes là où la version du matin écrivait « l'écart tient à
0,002 m³ de besoin couverts par une eau comptée sur une surface plus petite
que celle de leur propre matériel » ; données remises en état par l'écran,
plan du matin retrouvé, deux recalculs en 1,5 s ; 42,598 m³ mobilisables au
dernier calcul, les 43,193 de 12 h 23 moins 1 h 10 de forage. La fenêtre de
Chrome qui portait l'onglet de l'extension étant réduite, les captures d'écran
et les clics réels sont restés sans effet : les boutons de la page ont été
actionnés par script et chaque étape vérifiée sur le texte de la page ; un
onglet sorti du groupe de l'extension a pu rester ouvert dans son Chrome. À
13 h 55, sur quatre questions posées par l'assistant, le porteur tranche :
point 4 fermé (« Fermer le point 4 »), points 36 et 41 fermés (« Fermer les
deux »), point 34 laissé en veille, non bloquant, à rouvrir à la première
occurrence dans les journaux (« Le laisser en veille, non bloquant »),
sous-tranche 3.5 close (« Oui, clore la 3.5 »). Restent ouverts le point 31,
moteur à faire dans la 3.7 (D-030), et le point 34 en veille. La sous-tranche
suivante est la 3.7, suivi d'exécution et replanification, qui ne commence que
sur son « vas-y » ; la 5 bis vient après elle ; la 3.8 n'est jamais commencée
sans un avertissement explicite. Procédure de reprise rapide relue, inchangée.
PR de registres seule, aucun contrôle rejoué.

Le 10 octobre 2026 vers 14 h 30, **PR #165 fusionnée par le porteur et
déployée ; roadmap mise à jour à sa demande ; développement arrêté sur ce
compte.** La PR #165, registres de la clôture de la 3.5, fusionnée à 14 h 19
(`a83f1b0`), les quatre jobs de `main` réussis, « Déploiement Cloudflare »
terminé à 14 h 25. Roadmap : Opus 5.5 et Sonnet 5.5 remplacent Opus 5 et
Sonnet 5 dans la légende, la grille et les lignes à venir (3.8, 4.1, 4.4,
4.5) ; les lignes terminées gardent le modèle employé ; la 3.7 reste
recommandée en Fable 5.1 · Très élevé, à confirmer avec le porteur avant de
commencer. Le porteur arrête le développement sur ce compte Claude ; la
reprise, sur un autre compte, part de `AGENTS.md` et de ce registre : la 3.5
est close, la 3.7 attend son « vas-y », restent ouverts les points 31 et 34.
PR de registres seule, aucun contrôle rejoué.

Le 10 octobre 2026 vers 14 h 45, **PR #166 fusionnée par le porteur et
déployée ; consignes du porteur et notes techniques reportées dans le dépôt, à
sa demande, avant l'arrêt sur ce compte.** La PR #166, noms des modèles de la
roadmap, fusionnée à 14 h 39 (`f1f9f76`), les quatre jobs de `main` réussis,
« Déploiement Cloudflare » terminé à 14 h 45. Le porteur demande si le
paramétrage de l'assistant est consigné dans GitHub pour la reprise : non, une
partie de ses consignes et les pièges techniques du poste n'existaient que
dans les notes de travail de l'assistant, sur ce poste et pour ce compte. Sur
son « oui, vas-y, fais cette PR » : `AGENTS.md` reçoit une section « Consignes
du porteur » — à qui l'on parle, rien ne démarre sans son mot, la 3.8 préparée
avec lui, modèle et effort, après chaque fusion, fin de PR, recette,
navigateur et poste du porteur, une PR par point ouvert — et
`docs/notes-techniques.md` rassemble les pièges et leur remède — l'heure de
Paris, la forme des registres, le serveur de développement, le verrou des
parcours, le navigateur du porteur, la documentation de l'API OTF. Règles
réécrites, pas de notes brutes recopiées ; aucune donnée personnelle ni
secret. Le dossier `.claude/` du projet reste hors du dépôt : lanceur propre
au poste et autorisations locales. PR de documentation seule, aucun contrôle
rejoué.

Le 10 octobre 2026 vers 15 h 35, **PR #167 fusionnée par le porteur et
déployée ; deux heures du journal du jour corrigées ; dépôt vérifié avant la
reprise sur un autre compte.** La PR #167, consignes du porteur et notes
techniques, fusionnée à 15 h 24 (`63648d1`), les quatre jobs de `main`
réussis, « Déploiement Cloudflare » terminé à 15 h 29. Deux paragraphes de ce
journal portaient une heure écrite de mémoire au lieu d'être convertie depuis
l'UTC : celui de la PR #164 passe de 14 h 20 à 14 h 10, celui de la PR #165 de
14 h 50 à 14 h 30, d'après l'heure de leurs commits (14 h 12 et 14 h 31).
Vérification demandée par le porteur avant l'arrêt sur ce compte : `main`
propre, aucune PR ni ticket ouvert, les rappels planifiés de septembre et
d'octobre tous désactivés, registres datés du jour, `AGENTS.md` renvoie à
`docs/notes-techniques.md`. Treize alertes Dependabot restent ouvertes, toutes
sur des dépendances indirectes de développement : les onze relevées le 2
octobre (bloc Q4 de la roadmap) et deux du 8 octobre, `sharp` tiré par
Miniflare, corrigé en 0.35.5, et `braces` tiré par l'outillage d'ESLint et de
vinext, sans correctif publié. Aucune ne s'exécute dans le Worker déployé ; à
suivre avec les lots Dependabot. La reprise part de `AGENTS.md` et de ce
registre : 3.5 close, 3.7 sur le « vas-y » du porteur, points 31 et 34
ouverts. PR de registres seule, aucun contrôle rejoué.

Le 10 octobre 2026 vers 16 h 45, **PR #168 fusionnée par le porteur et
déployée ; reprise du projet sur un nouveau compte Claude, dans une session
distante.** La PR #168, deux heures du journal et alertes Dependabot,
fusionnée à 15 h 38 (`b168dc3`), les quatre jobs de `main` réussis,
« Déploiement Cloudflare » terminé à 15 h 43, application seule redéployée.
Reprise obligatoire faite d'après `AGENTS.md` : registres lus, état de Git et
de la CI relevés sur GitHub ; les registres concordent avec l'historique,
aucune PR ouverte. Un oubli de la PR #166 relevé et corrigé ici : la section
5 bis de la roadmap recommandait encore « Opus 5 · Élevé », passée à « Opus
5.5 · Élevé » comme les autres lignes à venir. La session tourne dans un
conteneur distant : la branche de travail est imposée par l'environnement
(`claude/fervent-cannon-l03tco`), gardée sur le mot du porteur au lieu d'une
branche `docs/` ; l'extension Chrome du porteur n'y est pas joignable, aucun
outil de navigateur n'étant chargé dans la session, si bien que les recettes
sur le site dans son Chrome demandent une session lancée sur son poste
(application Claude de bureau, ou `claude remote-control` dans le dossier du
dépôt). La 3.5 est close, la 3.7 attend le « vas-y » du porteur, restent
ouverts les points 31 et 34. Sur le mot du porteur, `AGENTS.md` reçoit une
consigne nouvelle : l'assistant suit chaque PR qu'il ouvre jusqu'à sa fusion,
CI, commentaires et conflits compris, sans jamais fusionner lui-même. PR de
registres seule, aucun contrôle rejoué.

Le 27 octobre 2026, **PR #169 fusionnée par le porteur et déployée le 10
octobre ; réserve du sol (RFU) demandée par le porteur et cadrée le jour même,
contrat écrit, extension 5 ter ajoutée à la roadmap, décision D-041 ; aucun
code.** La PR #169, reprise sur un nouveau compte et consigne de suivi des PR,
fusionnée le 10 octobre à 16 h 57 (`7f12169`), les quatre jobs de `main`
réussis, « Déploiement Cloudflare » terminé à 17 h 04, application seule
redéployée. La 3.7 n'a pas commencé. Dependabot a ouvert six PR du 14 au 21
octobre, #170 à #175 (`next` 16.3.8 → 16.4.0 et cinq dépendances de
développement). Le porteur a fusionné la PR #170 (`@vitejs/plugin-react` 6.1.1
→ 6.1.2, développement) le 27 octobre à 14 h 33 (`49eb84d`), les quatre jobs
de `main` réussis, « Déploiement Cloudflare » terminé à 14 h 40, puis mis la
présente PR à jour sur `main` ; #171 à #175 restent ouvertes, à reprendre en
un lot sur son mot. Le 27 octobre, le porteur demande si la réserve utile du
sol est prévue : elle ne l'est nulle part, ni dans le code ni dans les
documents, le seul mot voisin étant « enracinement » dans le « Hors périmètre
» du contrat du planning. Sur sa demande, l'assistant recommande une
introduction en deux temps et une place après la 3.7 ; le porteur fournit son
analyse de sol (Celesta-lab, 31 mars 2025 : RFU de 62 mm « estimée »,
échantillon sur 0-20 cm, profondeur de calcul non dite), fixe la saisie par
parcelle avec la profondeur, le raisonnement en mm/cm fois la profondeur
racinaire de chaque culture, la jauge sous abri sans pluie, l'ET0 brute par
défaut avec un coefficient réglable, un curseur d'observation par parcelle et
par jardin, jamais par planche, et suit les autres recommandations. Contrat
écrit (`docs/soil-reserve-contract.md`) avec neuf scénarios chiffrés et huit
choix faits en l'écrivant, à confirmer à sa relecture ; roadmap mise à jour
aux trois endroits (tableau, ordre d'exécution où la 5 ter prend la place 17
et décale la 5 bis, la 3.8, la 3.9 et la tranche 4 d'un rang, section 5 ter),
ainsi que la section 8 ; décision D-041 ; une règle invariante ajoutée à
`AGENTS.md` ; renvoi depuis le « Hors périmètre » du contrat du planning ;
point ouvert 42 pour la profondeur de calcul. Contrat écrit en Opus 5.5 sur le
mot du porteur, sans Fable. PR de documents seule, aucun contrôle rejoué.

Le 27 octobre 2026 vers 15 h, **PR #176 fusionnée par le porteur et déployée ;
lot de dépendances du 27 octobre : les six PR Dependabot ouvertes reprises en
une seule PR, que l'assistant fusionne lui-même sur le mot du porteur.** La PR
#176, cadrage de la réserve du sol, fusionnée à 14 h 40 (`4053528`), les
quatre jobs de `main` réussis, « Déploiement Cloudflare » terminé à 14 h 47,
application seule redéployée. Le porteur demande ensuite à l'assistant de
s'occuper des six PR Dependabot en attente et de les fusionner lui-même : « je
n'ai pas besoin de le faire moi-même ». Une seule PR les reprend, pour un seul
déploiement et sans conflit de verrou : `next` et `eslint-config-next` 16.3.8
→ 16.4.3 (#171, que Dependabot avait portée à 16.4.3, et #177 à 16.4.1),
`vite` 8.3.2 → 8.3.3 (#175), `knip` 6.39.0 → 6.43.0 (#174),
`@vitejs/plugin-rsc` 0.5.35 → 0.5.38 (#173), `@playwright/test` 1.63.0 →
1.64.1 (#172), versions exactes, verrou refait par `pnpm install`. `next` est
la seule dépendance d'exécution ; vinext 1.0.1 accepte ces versions de Vite et
du greffon RSC. Contrôles joués dans la session distante : lint sans
avertissement (20 s), typage sans erreur (16 s), 604 tests réussis en 19 s,
compilation réussie (10 s), `pnpm knip` sans code mort (6 s, les dix
indications de configuration de `knip.json` identiques avant et après), `pnpm
push:check` et `pnpm weather:check` réussis (7 s et 6 s). Parcours navigateur
non concluants dans la session : Playwright 1.64.1 y attend un Chromium que
l'environnement n'a pas, et le Chromium installé, imposé par une configuration
temporaire non versionnée, fait échouer les 24 parcours sur une erreur de
console « 404 » au chargement, la même avec les versions de `main` ;
l'environnement est en cause, pas le lot. Les parcours sont jugés par le job «
Parcours navigateur » de la CI, qui installe son navigateur. Fusion par
l'assistant une fois les trois jobs requis verts, sur mandat du porteur pour
ce lot (D-042) ; Dependabot ferme seul ses PR devenues sans objet.

Le 27 octobre 2026 en soirée, **PR #178 fusionnée par l'assistant sur mandat
du porteur (D-042) et déployée après une relance ; pose datée et stockage du
matériel demandée par le porteur et cadrée, sous-tranche 2.11, contrat écrit,
décision D-043, point ouvert 43 ; aucun code.** La PR #178, lot de
dépendances, fusionnée à 15 h 23 (`551713d`), après ses trois jobs verts sur
la branche à jour. Sur `main`, « Application » et « Workers Cloudflare »
réussis, mais « Parcours navigateur » annulé à 15 h 38 dans l'étape
d'installation du navigateur, au bout de la limite de quinze minutes du job :
le miroir Ubuntu de GitHub servait un paquet toutes les trois secondes
environ, aucun parcours n'avait démarré ; « Déploiement Cloudflare » sauté.
Relance unique du job à 15 h 54 : navigateur installé en 24 s, 24 parcours
réussis, « Déploiement Cloudflare » terminé à 16 h 01, application seule
redéployée. Dependabot a fermé seul ses six PR, #171 à #175 et #177 ; plus
aucune PR ouverte. Le même jour, le porteur demande de modifier dans le site
le réglage « minimal » de treize rampes (blocs 2 à 11, BF, BF2, BF3) sur le
modèle de la rampe bloc 1 : non fait, la session distante n'atteignant pas son
Chrome ; une consigne à coller dans une séance lancée sur son poste lui a été
remise. Le porteur signale ensuite que « Retirer la position » d'un
goutte-à-goutte le laisse en place : vérifié dans le code, le retrait est
refusé dès qu'une irrigation a utilisé la position
(`deleteEquipmentPlacementForUser`), et le modèle ne connaît qu'une position
par saison, sans date (point ouvert 43). Sur ses réponses et son « vas-y »,
réglé en Opus 5.5 · Très élevé : contrat écrit
(`docs/equipment-placement-periods-contract.md`) avec onze scénarios et six
choix faits en l'écrivant, à confirmer à sa relecture ; un septième, la limite
de sept jours pour dater dans le passé, écarté par lui à la relecture ; les
six autres confirmés par lui le même soir, avec une exigence : un message
explique toujours le refus de valider une proposition dont le matériel a été
retiré ; roadmap mise à jour aux trois endroits, la 2.11 prenant la place 16
avant la 3.7 et décalant la 3.7, la 5 ter, la 5 bis, la 3.8, la 3.9 et la
tranche 4 d'un rang ; décision D-043 ; renvoi depuis
`docs/irrigation-data-model.md`. PR de documents seule, aucun contrôle rejoué.

Le 27 octobre 2026 vers 20 h 45, **PR #179 fusionnée par le porteur et
déployée ; code de la 2.11 commencé sur son « vas-y », PR 1 sur 3 : le domaine
des poses, ouverte.** La PR #179, cadrage de la pose datée, fusionnée à 20 h
35 (`a782350`), les quatre jobs de `main` réussis, « Déploiement Cloudflare »
terminé à 20 h 42, application seule redéployée. Sur son « C'est fusionné.
Vas-y pour le code », en Opus 5.5 · Très élevé, la première PR de code ne
touche ni la base ni l'écran : `lib/domain/equipment-placement-periods.ts`
porte l'état d'un matériel (posé, stocké, jamais posé), les contrôles des
dates de pose et de retrait (règles 1 à 6 : jamais dans le futur, dans l'année
de la saison, ni avant le retrait précédent, ni avant la pose, ni avant la fin
de la dernière irrigation, aucun retrait pendant une irrigation en cours), les
irrigations d'une pose, la pose ouverte à un instant et le stockage qui
l'entoure (règle 12), le blocage d'une irrigation planifiée (règle 13) et
d'une proposition du planning (règle 14), et leurs messages, dont celui exigé
par le porteur. Treize tests dans
`tests/equipment-placement-periods.test.ts`, tirés des onze scénarios du
contrat. Un test a d'abord échoué : un goutte-à-goutte reposé sur les mêmes
planches cochées dans un autre ordre était dit « reposé ailleurs », son
ancrage n'étant que sa première planche cochée ; le goutte-à-goutte se compare
désormais par ses planches, l'aspersion par son ancrage. La saison d'Ouvre ta
ferme est lue comme l'année civile, celle que suit déjà `dateKeyInSeason`.
Contrôles : lint sans avertissement, typage sans erreur, 617 tests réussis en
14 s, compilation réussie (10 s, avec l'avertissement
`INEFFECTIVE_DYNAMIC_IMPORT` de vinext, déjà émis sur `main`), `pnpm knip`
sans code mort après trois fonctions rendues internes, `pnpm push:check` et
`pnpm weather:check` réussis ; parcours navigateur sans rapport, aucun écran
ni service appelé ne change, et non jouables dans la session distante
(Chromium de Playwright 1.64.1 absent). Restent la PR 2, la persistance, puis
la PR 3, les calculs et l'écran.

Le 27 octobre 2026 vers 21 h 25, **PR #180 fusionnée par le porteur et
déployée ; PR 2 sur 3 de la 2.11, l'enregistrement en base, ouverte.** La PR
#180, domaine des poses, fusionnée à 20 h 56 (`38f8b7d`), les quatre jobs de
`main` réussis, « Déploiement Cloudflare » terminé à 21 h 02, application
seule redéployée. La PR 2, en Opus 5.5 · Très élevé, écrit les poses en base
sans toucher l'écran, hors deux textes. Migration additive 0018 : la ligne de
position, pose courante, gagne `placed_at` (nulle pour les positions
existantes, règle 7) et `removed_at` ; nouvelle table
`irrigation_equipment_placement_history`, registre des poses fermées, en
ajout seul (un déclencheur refuse toute modification) ; l'index « une
position par matériel et par saison » reste. Le dépôt
(`db/equipment-placement-repository.ts`, la lecture des poses et du registre
passant dans `db/equipment-placement-poses.ts` pour tenir sous 600 lignes) :
`removeEquipmentPlacementForUser` remplace la suppression — la pose se ferme
à la date donnée, copiée au registre, même après une irrigation, refusée
pendant une irrigation en cours ou avant la fin de la dernière ;
l'enregistrement d'une position ouvre une pose, repose un matériel stocké,
garde la pose et sa date au même endroit, ou ferme puis ouvre une pose
ailleurs ; la copie et la fermeture partent dans un même lot, conditionné à
la pose lue, si bien qu'un double clic ne copie pas deux fois. La lecture
servie aux besoins, à la faisabilité, au planning et à la saisie ne rend que
le matériel posé ; créer une irrigation sur un matériel stocké est refusé en
base ; supprimer un matériel qui n'a jamais arrosé efface ses poses fermées ;
le réglage d'un matériel stocké ne se change pas. Relevé en relisant le diff :
avant cette PR, un matériel portant une irrigation planifiée ne se retirait
pas ; désormais il se retire, et l'irrigation planifiée, jamais supprimée, ne
doit pas démarrer sur un matériel stocké. La règle 13, déjà dans le domaine,
est donc branchée dès cette PR au démarrage du minuteur
(`assertPlannedPlacementStillPosed`, `db/irrigation-event/ownership.ts`) :
refus « Matériel stocké depuis le … » ou « Matériel reposé ailleurs », départ
possible de nouveau une fois reposé sur les mêmes planches ; `main` ne garde
pas ce trou entre la PR 2 et la PR 3. L'action d'écran date le
retrait et la pose à « maintenant » jusqu'à la PR 3 ; la confirmation du
retrait dit désormais que le matériel sera stocké, et le message de succès
que ses irrigations restent dans l'historique. En écrivant le dépôt, un
défaut de la PR 1 : une irrigation démarrée au minuteur depuis une irrigation
planifiée n'a pas encore de début réel enregistré, et la règle ne la voyait
pas « en cours » ; elle se reconnaît désormais à son minuteur, en marche ou en
pause, test ajouté. Le compte des tests de la PR 1 était faux dans les
registres, quatorze pour treize : corrigé. Précisions arrêtées en écrivant,
sans changer de règle, ajoutées au contrat (section « Données ») : même
endroit n'est pas un déplacement, minuteur, nom du réglage gardé au registre,
réglage d'un matériel stocké. Tests : onze nouveaux tests de persistance
(`tests/db/equipment-placement-periods-repository.test.ts`), dont le retrait
d'un goutte-à-goutte qui a déjà arrosé, refusé jusqu'ici, et le démarrage
d'une irrigation planifiée (scénario 7) ; tests existants
adaptés (date de pose des positions de test, comptes de tables à 45).
`tests/irrigation-migration.test.ts` était à 600 lignes, la limite : la
nouvelle table y partage la ligne de sa voisine plutôt que de restructurer ce
fichier dans une PR de fonctionnalité (dette notée). Contrôles : lint sans
avertissement, typage sans erreur, 629 tests réussis en 14 s, compilation
réussie (avec l'avertissement `INEFFECTIVE_DYNAMIC_IMPORT` de vinext, déjà émis
sur `main`), `pnpm knip` sans code mort, `pnpm push:check` et
`pnpm weather:check` réussis ; parcours navigateur non jouables dans la
session distante (Chromium de Playwright 1.64.1 absent), jugés par le job
« Parcours navigateur » de la CI, P8 retirant une position.

Le 27 octobre 2026, **PR #181 fusionnée par le porteur et déployée** à 21 h 33
(`ad0c717`) : les quatre jobs de `main` réussis, « Application »,
« Workers Cloudflare », « Parcours navigateur » et « Déploiement Cloudflare »,
migration 0018 appliquée ; vérifié job par job à la reprise du 29 octobre.

Le 29 octobre 2026 au soir, **PR 3a de la 2.11, les calculs, ouverte**, sur
le « vas-y » du porteur, en Opus 5.5 · Très élevé. Reprise faite d'abord :
dépôt propre sur `main`, lint et typage sans erreur, 629 tests réussis. Le
porteur a accepté de découper la PR 3 en deux, les calculs puis l'écran, et
de regrouper les cinq PR Dependabot ouvertes (#182 à #186) en une PR après la
recette, qu'il fusionnera. La 3a branche la règle 14 : la validation d'une
proposition dont le matériel a été retiré, ou reposé, depuis le calcul est
refusée avec le message du domaine, qui nomme le matériel, la date du retrait
et l'heure du calcul (`lib/services/planning-validation-service.ts`, qui lit
désormais la pose courante, posée ou stockée) ; une validation de la journée
valide les autres et rend ce motif sur la carte. En écrivant, un cas que le
contrat ne tranchait pas : une irrigation planifiée sur un matériel retiré ne
démarre pas (règle 13), mais besoins, faisabilité et planning la comptaient
comme de l'eau à venir. Porté au porteur sur une carte de décision, tranché
par lui le soir même (D-044) : elle ne compte plus dans aucun calcul tant que
le matériel est stocké ou reposé ailleurs, et compte de nouveau reposé au
même endroit. La règle est dans le domaine (`irrigationsThatCount`) ; les
services la lisent par `lib/services/counted-irrigation-events.ts` —
planning, besoins, faisabilité, tableau de l'eau, réserves, limite
journalière à la création et au démarrage, pompe —, les listes et
l'historique gardent `listIrrigationEventsForUser`. La saisie après coup sur
la pose de son heure (règle 12) a d'abord été écrite dans la 3a : le parcours
P3 l'a refusée, l'écran posant encore un matériel à « maintenant », si bien
qu'une irrigation saisie pour une heure antérieure tombait sur un matériel
« stocké ». Elle passe dans la 3b, avec les dates de pose à l'écran ; le
contrat le dit (« Découpage »). Tests : un test du domaine (D-044), quatre
tests de persistance et de service
(`tests/db/equipment-placement-calculations.test.ts`) — scénario 8, la
validation refusée et expliquée ; scénario 6, la planche à sa surface seule,
« aucun matériel ne l'arrose » ; D-044 dans les besoins, le planning, la
limite journalière et la pompe, rouges avant le code. La faisabilité lit la
même fonction mais n'a pas de test propre : son service lit l'instantané
Ouvre ta ferme. Contrôles : lint sans avertissement, typage sans erreur,
634 tests réussis en 15 s, compilation réussie (avec l'avertissement
`INEFFECTIVE_DYNAMIC_IMPORT` de vinext, déjà émis sur `main`), `pnpm knip`
sans code mort, `pnpm push:check` et `pnpm weather:check` réussis ;
`pnpm e2e` joué dans la session distante : 24 parcours réussis sur 24, aux
deux largeurs, avec le Chromium préinstallé de la session (révision 1243
servie sous le nom attendu par Playwright 1.64.1). Restent la PR 3b, puis la
recette sur la ferme.

Le 29 octobre 2026, **PR #187 (3a) fusionnée par le porteur et déployée** à
22 h 17 (`4988d9c`) : les quatre jobs de `main` réussis, « Workers
Cloudflare », « Application », « Parcours navigateur » et « Déploiement
Cloudflare », sans migration ; vérifié job par job le soir même.

Le 29 octobre 2026 au soir, **PR 3b de la 2.11, l'écran et la saisie après
coup, ouverte**, sur le même « vas-y » du porteur, en Opus 5.5 · Très élevé.
La saisie après coup prend la pose ouverte à l'heure de début, même fermée
depuis (règle 12, `poseForCompletedIrrigation` dans le domaine,
`lib/services/irrigation-placement-service.ts`) ; elle est refusée, avec
l'intervalle en clair, si le matériel était stocké à cette heure, ou si
l'irrigation finit après le retrait ; la base refuse aussi une position qui
n'est pas celle de la pose de l'heure de début
(`db/irrigation-event/create.ts`). À l'écran : la carte du matériel dit « Posé
sur … depuis le … », « Stocké depuis le … » ou « Jamais posé cette saison »,
avec « Retirer (stocker) », le pli « Historique des poses » et « Reposer » ;
le retrait se confirme dans une fenêtre qui porte sa date ; la barre de
placement porte la date de pose, de repose ou du déplacement ; le compteur de
l'inventaire distingue posés et stockés ; le formulaire d'irrigation liste le
matériel stocké avec « Reposer », et, en saisie après coup, ne propose que le
matériel posé à l'heure de début ; la carte d'une irrigation planifiée bloquée
porte son signal et ne démarre pas. Les mots de l'écran sont dans le domaine
(`lib/domain/equipment-pose-presentation.ts`). Précisions arrêtées en
écrivant, ajoutées au contrat, dont une aspersion « Posé entre P3 et P4 » et
non « Posé sur ». En écrivant le parcours P11, un défaut de l'écran trouvé et
corrigé avant l'ouverture : en saisie après coup, une heure de début où rien
n'était posé faisait disparaître le formulaire, champ de l'heure compris ; il
le dit désormais et garde ce champ. Tests : treize nouveaux, trois du domaine
(règle 12), quatre de persistance
(`tests/db/equipment-placement-completed-irrigation.test.ts`, dont le scénario
9) et six des mots de l'écran (`tests/equipment-pose-presentation.test.ts`).
Parcours : P11 ajouté — retirer, stocker, reposer un goutte-à-goutte, aux deux
largeurs ; P6 et P8 suivent les nouveaux textes, P8 retirant par la nouvelle
confirmation ; le matériel des parcours est posé au 1er janvier de la saison,
pour que P3, P4 et P9 le trouvent posé à l'heure de début de leur saisie
(`docs/browser-journeys-contract.md`). Contrôles : lint sans avertissement,
typage sans erreur, 647 tests réussis en 15 s, compilation réussie (avec
l'avertissement `INEFFECTIVE_DYNAMIC_IMPORT` de vinext, déjà émis sur `main`),
`pnpm knip` sans code mort, `pnpm push:check` et `pnpm weather:check`
réussis ; `pnpm e2e` joué dans la session distante : 26 parcours réussis sur
26, aux deux largeurs. Un test de minutage sans rapport avec la PR, « les
lectures simultanées restent espacées les unes des autres »
(`tests/read-client.test.ts`), a échoué une fois pendant l'écriture sur la
machine chargée de la session, puis réussi trois fois de suite : noté, non
corrigé. Restent la recette sur la ferme, avec le réglage « minimal » des
rampes, puis la PR qui regroupe les cinq PR Dependabot.

Le 29 octobre 2026, **PR #188 (3b) fusionnée par le porteur et déployée** à
22 h 48 (`def3453`) : les quatre jobs de `main` réussis, « Workers
Cloudflare », « Application », « Parcours navigateur » et « Déploiement
Cloudflare », sans migration ; vérifié job par job le soir même.

Le 30 octobre 2026, **recette réelle de la 2.11 faite sur la ferme**, sur le
« vas-y » du porteur, de 10 h 17 à 10 h 38, dans son Chrome, par une séance
lancée sur son ordinateur (`docs/recette-2.11.md`, protocole et attendus
écrits le matin même avant tout geste). La 2.11 n'effaçant rien, les essais
ont porté sur un matériel d'essai, posé, retiré, reposé et déplacé à des
dates choisies puis supprimé avec son registre des poses ; aucun vrai
matériel n'a été retiré. Treize vérifications conformes sur treize : poses
anciennes « date de pose non renseignée », « Posé entre » des rampes,
compteur des posés et des stockés, retrait refusé dans le futur et avant la
pose avec leur motif, retrait, repose et déplacement datés, historique des
poses, matériel stocké absent des formulaires et proposé à « Reposer »,
saisie après coup selon la pose de l'heure de début, sans rien enregistrer,
et lecture à 390 px dans un cadre de cette largeur, sans débordement. La
ferme est revenue à l'état de départ : compteurs, 34 cartes, irrigations et
planning identiques. Le réglage « minimal » des rampes blocs 2 à 11, BF, BF2
et BF3, demandé le 27 octobre sur le modèle de la rampe bloc 1, était déjà
identique sur les treize : rien enregistré. La rampe bloc 1 posée entre B2-2
et B2-3 est voulue par le porteur, pour ses essais. Un incident : pendant la
frappe au clavier de l'heure de début, dans « Déjà réalisée », la page s'est
fermée deux fois ; rien n'a été enregistré. Reproduit par l'assistant sur son
poste : un défaut ancien, de fin septembre 2026, sans lien avec la 2.11
(point ouvert 44). Restent au jugement du porteur la lisibilité au pouce sur
son téléphone, le retrait réel de son goutte-à-goutte (point 43) et la
clôture de la 2.11. PR de registres et de compte rendu, aucun contrôle de
code rejoué.

Le 30 octobre 2026, **point ouvert 44 corrigé**, sur le choix du porteur
« Corriger maintenant », dans une PR à part qui suit celle de la recette. Le
créneau de l'aperçu de faisabilité se calcule désormais dans le domaine
(`previewSlot`, `lib/domain/irrigation-timer.ts`) : un début illisible, champ
vide ou incomplet, part de maintenant, une fin illisible ou antérieure laisse
un créneau d'une seconde ; plus aucune date invalide n'atteint `toISOString`.
Tests d'abord : un test du domaine, et une étape du parcours P3 qui vide le
début réel et vérifie que la page reste là, rouge avant la correction
(« element(s) not found », la page fermée), verte après. Contrôles : lint sans
avertissement, typage sans erreur, 648 tests réussis en 16 s, compilation
réussie (avec l'avertissement `INEFFECTIVE_DYNAMIC_IMPORT` de vinext, déjà
émis sur `main`), `pnpm knip` sans code mort, `pnpm push:check` et `pnpm
weather:check` réussis ; `pnpm e2e` joué dans la session distante : 26
parcours réussis sur 26, aux deux largeurs. À fusionner après la PR de la
recette, sur laquelle elle s'appuie.

Le 30 octobre 2026, **PR #189 et #190 fusionnées par le porteur et
déployées ; besoin en eau par culture et par stade cadré sur sa demande,
contrat écrit, extension 5 quater ajoutée à la roadmap, décision D-045 ; aucun
code.** La PR #189, recette de la 2.11, fusionnée à 12 h 53 (`58fb3a8`), puis
la PR #190, correction du point 44, à 12 h 53 (`fdfbc59`) ; les quatre jobs de
`main` réussis sur `fdfbc59`, « Déploiement Cloudflare » terminé à 13 h 01.
La correction du point 44 reste à constater sur le site. Le porteur demande où
la roadmap range le calcul du besoin selon la culture et son stade : nulle
part en sous-tranche, seulement la ligne « Paramètres culturaux » de la
section 8, D-024 point 11 et la « porte laissée ouverte » du contrat du
planning. Il fournit un document de travail, préparé avec un autre assistant
à partir des références du CRIIAM Sud et de la FAO-56, et demande de le verser
au dépôt sans code. Contrat écrit (`docs/crop-water-need-contract.md`) après
relecture du document contre le dépôt : huit adaptations, dont les dates
d'Ouvre ta ferme qui ne sont que des semaines, l'ET0 prévue déjà synchronisée
(la 5 quater ne dépend pas de la 5 bis), l'ET0 manquante traitée comme la
pluie (D-019) et la planche à plusieurs cultures ; quatorze scénarios
chiffrés, recalculés ; six questions du document et deux décisions imposées
par le dépôt, le mode automatique (D-010) et la jauge de la 5 ter (D-041), à
trancher par le porteur ; neuf choix faits en l'écrivant. Roadmap mise à jour
aux trois endroits (tableau, ordre d'exécution où la 5 quater prend la place
20, choisie par le porteur, et décale la 3.8, la 3.9 et la tranche 4 d'un
rang, section 5 quater), ainsi que la section 8 ; décision D-045 ; une règle
invariante ajoutée à `AGENTS.md` ; renvoi depuis le contrat du planning.
Contrat écrit en Opus 5.5 sur le mot du porteur. PR de documents seule ;
contrôles joués quand même, résultats dans la PR, `pnpm e2e` omis, sans
rapport avec une PR qui ne touche ni l'interface ni ses services.

Le 30 octobre 2026, **correction du point 44 constatée sur le site ; deux
points ouverts nouveaux, 45 et 46.** Sur le « vas-y » du porteur, l'assistant
fait le constat de 13 h 08 à 13 h 14 dans son Chrome, par une séance lancée
sur son ordinateur, les attendus écrits avant tout geste : dans « Déjà
réalisée » puis dans « Planifier », date de début vidée, puis retapée chiffre
par chiffre en passant par des valeurs incomplètes, une fois même avec une
année à six chiffres : la page reste là, sans erreur dans la console ; les
compteurs des irrigations, 0 en cours, 0 à venir, 25 archivées, identiques
avant et après, rien enregistré (`docs/recette-2.11.md`). Deux écarts mineurs
relevés, ouverts sur l'accord du porteur (« ok pour tes recommandations ») :
le volume estimé à 0 L quand la date ne se lit pas (point 45, D-003) et le
bouton « Planifier l'irrigation » actif sans date, le serveur refusant au clic
(point 46). PR de registres et de compte rendu, aucun contrôle de code rejoué.

Le 30 octobre 2026, **PR #192 fusionnée par le porteur et déployée ; point
ouvert 44 fermé par lui.** La PR #192, constat du point 44 sur le site et
points 45 et 46, fusionnée à 13 h 32 (`cb2e1bf`) ; les quatre jobs de `main`
réussis, « Déploiement Cloudflare » terminé à 13 h 40. Le porteur ferme le
point 44 le jour même : « ferme le point 44 tu viens de le tester ». PR de
registres seule, aucun contrôle de code rejoué.

Le 30 octobre 2026, **PR #193 fusionnée par le porteur et déployée ; les cinq
PR Dependabot ouvertes, #182 à #186, reprises en une seule PR sur son
« vas-y ».** La PR #193, fermeture du point 44, fusionnée à 13 h 48
(`3dc896c`) ; les quatre jobs de `main` réussis, « Déploiement Cloudflare »
terminé à 13 h 54. Le lot : `react`, `react-dom` et `react-server-dom-webpack`
19.3.0 → 19.3.1, montés ensemble. La PR #182 ne montait que `react`, ce que
React refuse, les trois paquets devant porter exactement la même version : ses
jobs « Application » et « Parcours navigateur » étaient rouges, et fusionnée
seule elle aurait cassé le site. La 19.3.1 améliore le protocole de transport
des composants serveur, qui vit dans `react-server-dom-webpack`. Avec eux,
`@types/node` 22.20.4 → 22.20.5 (#183), `@cloudflare/workers-types`
5.20260927.1 → 5.20261025.1 (#184), `wrangler` 4.135.0 → 4.144.0 à la racine
et dans les deux Workers (#185), `vite` 8.3.3 → 8.3.5 (#186). Versions
exactes, verrou refait par `pnpm install` ; `react` et `react-dom` sont les
seules dépendances d'exécution touchées. Contrôles joués dans la session
distante : lint sans avertissement, typage sans erreur, 648 tests réussis en
16 s, compilation réussie (avec l'avertissement `INEFFECTIVE_DYNAMIC_IMPORT`
de vinext, déjà émis sur `main`), `pnpm knip` sans code mort (les dix
indications de configuration de `knip.json` identiques avant et après), `pnpm
push:check` et `pnpm weather:check` réussis ; `pnpm e2e` : 26 parcours réussis
sur 26, aux deux largeurs, en 5,7 min. Fusion par le porteur ; Dependabot
fermera seul ses PR devenues sans objet.

Le 30 octobre 2026, **PR #194 fusionnée par le porteur et déployée ; points
ouverts 45 et 46 tranchés par lui, point 45 corrigé.** La PR #194, lot de
dépendances, fusionnée à 14 h 02 (`887a772`) ; les quatre jobs de `main`
réussis, « Déploiement Cloudflare » terminé à 14 h 10, l'application et les
deux Workers redéployés, Wrangler ayant changé. Dependabot ferme seul #182,
#183 et #186 et rouvre #184 et #185 sur des versions plus récentes
(`@cloudflare/workers-types` 5.20261027.1, `wrangler` 4.153.0), à reprendre
dans un lot suivant, jamais seules. Le porteur répond le même après-midi sur
les points ouverts : point 43, le retrait réel de son goutte-à-goutte fait par
l'écran ; un retrait daté de la minute même refusé « dans le futur », accepté
une minute plus tôt, cause probable l'horloge de son ordinateur en avance de
quelques secondes sur celle du serveur, correction proposée ; point 45, « il
faut marquer inconnu » ; point 46, « rendre le bouton inactif sans date ».
Point 45 corrigé dans une PR `fix/` à part, test d'abord : un test du domaine
(`completedDurationSeconds`) et deux vérifications du parcours P3, rouges
avant la correction (« 0 L » lu aux deux largeurs), vertes après. Contrôles :
lint sans avertissement, typage sans erreur, 649 tests réussis en 15 s,
compilation réussie (avec l'avertissement `INEFFECTIVE_DYNAMIC_IMPORT` de
vinext, déjà émis sur `main`), `pnpm knip` sans code mort, `pnpm push:check`
et `pnpm weather:check` réussis ; `pnpm e2e` : 26 parcours réussis sur 26, aux
deux largeurs, en 5,3 min.

Le 30 octobre 2026, **point ouvert 47 ouvert et corrigé le jour même, sur le
mot du porteur.** Le retrait daté de la minute même, refusé « dans le futur »
(constat du porteur sur le point 43), devient le point 47 ; « vas-y pour le
point 47 ». Correction dans une PR `fix/` à part, posée sur celle du point 45
pour ne pas croiser les registres : une date de pose, de repose, de
déplacement ou de retrait en avance de deux minutes au plus sur l'heure du
serveur vaut maintenant et s'enregistre à l'heure du serveur (`poseDateAt`,
`lib/domain/equipment-placement-periods.ts`) ; au-delà, le refus de la règle 3
tient. Le contrat de la 2.11 reçoit une précision datée, sans réécrire ses
règles. Test d'abord : un test du domaine et un test de persistance, celui-ci
rouge avant la correction avec le message vu par le porteur, vert après.
Contrôles : lint sans avertissement, typage sans erreur, 651 tests réussis en
15 s, compilation réussie (avec l'avertissement `INEFFECTIVE_DYNAMIC_IMPORT`
de vinext, déjà émis sur `main`), `pnpm knip` sans code mort, `pnpm
push:check` et `pnpm weather:check` réussis ; `pnpm e2e` : 26 parcours réussis
sur 26, aux deux largeurs, en 5,1 min.

Le 30 octobre 2026, **PR #195 fusionnée par le porteur et déployée ; point
ouvert 46 corrigé sur son mot.** La PR #195, point 45, fusionnée à 14 h 49
(`de054bd`) ; les quatre jobs de `main` réussis, « Déploiement Cloudflare »
terminé à 14 h 56, l'application redéployée, les deux Workers inchangés donc
non redéployés. La protection de `main` exigeant une branche à jour, la PR du
point 47 reçoit `main` par une fusion, sans réécrire son historique. Point 46
corrigé dans une PR `fix/` à part, posée sur celle du point 47 : une
irrigation planifiée sans date de début lisible ne s'enregistre pas
(`plannedStartKnown`, `lib/domain/irrigation-timer.ts`), le bouton « Planifier
l'irrigation » reste grisé. Test d'abord : un test du domaine et deux
vérifications du parcours P2 ; le test et la première vérification rouges
avant la correction (bouton actif lu aux deux largeurs), tous verts après.
Contrôles : lint sans avertissement, typage sans erreur, 652 tests réussis en
15 s, compilation réussie (avec l'avertissement `INEFFECTIVE_DYNAMIC_IMPORT`
de vinext, déjà émis sur `main`), `pnpm knip` sans code mort, `pnpm
push:check` et `pnpm weather:check` réussis ; `pnpm e2e` : 26 parcours réussis
sur 26, aux deux largeurs, en 5,7 min.

Le 30 octobre 2026, **points ouverts 42 et 43 fermés par le porteur, en une PR
sur sa demande ; décision D-046.** Point 42 : les 20 cm ne sont que la
profondeur de l'échantillon ; le porteur ferme le point en retenant d'abord
62 mm sur 60 cm, puis transmet la réponse du laboratoire, 62 mm sur 1 m, et
rappelle que « la RFU s'exprime toujours en mm par mètre ». L'assistant en
tire que la profondeur de calcul et son statut deviennent inutiles et
recommande de saisir la RFU en mm/m ; le porteur retient ce choix (D-046). Le
contrat de la réserve du sol est précisé en conséquence, avec une section
datée ; ses scénarios chiffrés gardent leurs résultats, la culture d'exemple
passant de 30 à 50 cm. Point 43 : retrait réel du goutte-à-goutte fait par
l'écran, confirmé par le porteur (« 43 oui »). PR de registres et de contrat
seuls : aucun contrôle rejoué, la 5 ter n'étant pas codée.

Le 30 octobre 2026, **PR #196 et #197 fusionnées par le porteur et
déployées.** La PR #196, point 47, fusionnée à 15 h 09 (`7773fe3`) : ses trois
jobs de contrôle réussis, l'application redéployée à 15 h 17 ; « Déploiement
Cloudflare » marqué annulé à la toute fin, toutes ses étapes réussies, la
fusion de la #197 ayant lancé un nouveau passage sur `main`. La PR #197, point
46, fusionnée à 15 h 17 (`65b3e5b`) : les quatre jobs de `main` réussis,
« Déploiement Cloudflare » terminé à 15 h 24, l'application redéployée, les
deux Workers inchangés donc non redéployés. Les corrections des points 45, 46
et 47 restent à constater sur le site.

Le 30 octobre 2026, **PR #198 fusionnée par le porteur et déployée ;
corrections des points 45, 46 et 47 constatées sur le site.** La PR #198
fusionnée à 15 h 40 (`dd75954`) ; les quatre jobs de `main` réussis,
« Déploiement Cloudflare » terminé à 15 h 46, l'application redéployée, les
deux Workers inchangés donc non redéployés. Sur le « vas-y » du porteur,
constat de 15 h 56 à 16 h 17 dans son Chrome, par une séance lancée sur son
ordinateur (`docs/recette-2.11.md`, K0 à K4, attendus écrits avant les
gestes) : cinq vérifications conformes sur cinq. Point 45, volume « Inconnu —
vérifiez le début et la fin » sans date lisible ; point 46, « Planifier
l'irrigation » grisé sans date ; point 47, sur un matériel d'essai, retrait
daté de la minute qui vient accepté et enregistré à 16 h 02, l'heure du
serveur, retrait daté de cinq minutes plus tard refusé. Matériel d'essai
supprimé ensuite, la fenêtre de confirmation du navigateur validée par le
porteur ; irrigations et inventaire revenus à l'état de départ, aucune
irrigation enregistrée. L'heure de l'ordinateur concordait avec celle du
serveur : la cause probable du point 47 n'est pas confirmée. Console lue au
seul rechargement final, sans erreur. Deux détails relevés, sans rien
d'enregistré à tort : « Supprimer définitivement » passe par une fenêtre du
navigateur que la séance ne peut pas fermer, et « Ajouter un matériel » coche
« Aspersion » par défaut. Fermeture des points 45 à 47 au jugement du porteur.
PR de registres seuls : aucun contrôle rejoué.

Le 30 octobre 2026, **PR #199 fusionnée par le porteur et déployée ;
l'assistant fusionne désormais les PR lui-même (D-048).** La PR #199, qui
consigne le constat des points 45, 46 et 47, fusionnée à 20 h 04 (`79bd1a9`) ;
les quatre jobs de `main` réussis, « Déploiement Cloudflare » terminé à
20 h 12, l'application redéployée, les deux Workers inchangés donc non
redéployés. Le porteur décide le soir même que l'assistant fusionne désormais
les PR lui-même, dans le bon ordre, pour n'en oublier aucune, puis dit « Oui,
vas-y » pour l'inscrire dans le dépôt : décision D-048, `AGENTS.md` et
`docs/publication.md` mis à jour. Cette PR est la dernière qu'il fusionne
lui-même. PR de registres seuls : aucun contrôle rejoué.

Le 30 octobre 2026, **PR #200 fusionnée par le porteur et déployée ; points
ouverts 45, 46 et 47 fermés par lui.** La PR #200, décision D-048, la dernière
que le porteur fusionne lui-même, fusionnée à 20 h 52 (`b872704`) ; les quatre
jobs de `main` réussis, « Déploiement Cloudflare » terminé à 21 h 00,
l'application redéployée, les deux Workers inchangés donc non redéployés. Plus
tôt dans la soirée, le porteur demande ce que sont les points 45, 46 et 47,
puis les ferme : « Ok, tu peux fermer ces trois points ». PR de registres
seuls : aucun contrôle rejoué.

Le 30 octobre 2026, **PR #201 fusionnée par l'assistant et déployée ; les deux
PR Dependabot ouvertes, #184 et #185, reprises en une seule PR sur le
« vas-y » du porteur.** La PR #201, fermeture des points 45, 46 et 47, la
première fusionnée par l'assistant selon D-048, fusionnée à 21 h 07
(`4ecf281`) ; les quatre jobs de `main` réussis, « Déploiement Cloudflare »
terminé à 21 h 13, l'application redéployée, les deux Workers inchangés donc
non redéployés. Le lot : `@cloudflare/workers-types` 5.20261025.1 →
5.20261027.1 (#184), définitions de types qui ne servent qu'à vérifier le
code ; `wrangler` 4.144.0 → 4.153.0 à la racine et dans les deux Workers
(#185), l'outil qui publie le site et les Workers. Deux dépendances de
développement seulement, versions exactes, verrou refait par `pnpm install` ;
aucune dépendance d'exécution touchée. Effort réglé sur « Élevé » par le
porteur, comme le recommande la feuille de route pour les dépendances (Q4).
Contrôles joués dans la session distante : lint sans avertissement, typage
sans erreur, 652 tests réussis en 16 s, compilation réussie (avec
l'avertissement `INEFFECTIVE_DYNAMIC_IMPORT` de vinext, déjà émis sur `main`),
`pnpm knip` sans code mort (les dix indications de configuration de
`knip.json` inchangées), `pnpm push:check` et `pnpm weather:check` réussis ;
`pnpm e2e` : 26 parcours réussis sur 26, aux deux largeurs, en 5,5 min.
Dependabot fermera seul ses PR devenues sans objet.

Le 30 octobre 2026, **PR #203 fusionnée par l'assistant et déployée ;
sous-tranche 2.11 close par le porteur ; règle du modèle et de l'effort
inscrite (D-049).** La PR #203, lot Dependabot, fusionnée à 21 h 59
(`88307d5`), environ 35 min après que ses contrôles sont passés au vert :
l'avis de GitHub ne parvenant pas à la session, la PR prête est restée en
attente jusqu'à ce que le porteur s'en étonne. Les quatre jobs de `main`
réussis, « Déploiement Cloudflare » terminé à 22 h 05, l'application et les
deux Workers redéployés, Wrangler ayant changé. Dependabot ferme seul #184,
devenue sans objet. Le porteur close la 2.11 le soir même : « Ok, vas-y,
ferme-la », sans constat séparé de la lisibilité sur son téléphone ; roadmap
mise à jour aux trois endroits. Il demande aussi que le modèle et l'effort de
chaque conversation suivent la colonne « Modèle · effort » de la roadmap, tout
écart demandé avant : décision D-049, `AGENTS.md` mis à jour. Après le retard
de #203, il demande que chaque conversation surveille elle-même la fin des
contrôles de ses PR plutôt que de se fier au seul avis de GitHub : consigne
ajoutée à `AGENTS.md`. PR de registres seuls : aucun contrôle rejoué.

Le 30 octobre 2026 au soir, **PR #204 fusionnée par l'assistant et
déployée ; jauge de la réserve du sol révisée sur le complément « jauge RFU »
du porteur, contrats 5 ter et 5 quater, décision D-047, ordre d'exécution
changé ; aucun code.** La PR #204, clôture de la 2.11 et règle D-049,
fusionnée à 22 h 14 (`181c2b3`) ; les quatre jobs de `main` réussis,
« Déploiement Cloudflare » terminé à 22 h 21, l'application redéployée, les
deux Workers inchangés donc non redéployés. Le porteur fournit un
complément à son document de travail du besoin par culture et par stade, et
demande de l'intégrer quand ce sera possible sans conflit ; il est versé après
la PR #199. Relu contre le dépôt, il change sept choix de la 5 ter. Trois
sont posés au porteur sur des cartes de décision : la jauge sous son seuil ne
change pas les priorités (« Information seulement », contre le complément qui
les faisait remonter), la formule du seuil, inversée dans le complément, est
corrigée en capacité × (1 − min(1 ; p / 0,5)), la 5 quater passe en 18 et la
5 ter en 19, la 5 bis en 20. La part de cailloux de 18 % est une estimation
du porteur, l'analyse en comptant 0 % sur l'échantillon tamisé : la RFU du sol
de la ferme vaut 62 × 0,82, arrondie à 51 mm/m. Contrat de la 5 ter révisé :
consommation par l'ETM au lieu de l'ET0 × coefficient, RFU du laboratoire et
part de cailloux, abri sans analyse « non mesuré », profondeurs racinaires de
l'ITAB et moitié au premier stade, part utilisable p et seuil, jours avant le
seuil, dose conseillée et drainage affichés, départ par un apport qui remplit,
neuf scénarios nouveaux recalculés (dix-huit en tout), section datée.
Contrat de la 5 quater complété : l'ETM sert aussi à la jauge, la page des
coefficients reçoit profondeur et p, la décision 8 tranchée. Roadmap aux
trois endroits et section 8 ; D-047 ; règle invariante de la réserve du sol
complétée dans `AGENTS.md`. Restent à valider avant le code : la moitié de la
profondeur au premier stade, la RFU des abris sans analyse, les seuils des
cultures sensibles, le départ de la jauge en début de saison. Écrit en Opus
5.5. PR de documents seule ; contrôles joués, `pnpm e2e` omis, sans rapport
avec une PR qui ne touche ni l'interface ni ses services.

Le 30 octobre 2026 au soir, **PR #202 fusionnée et déployée ; contrat des
alertes météo (5 bis) écrit et validé par le porteur, décision D-050 ; aucun
code.** La PR #202, jauge de la réserve du sol par l'ETM (D-047), fusionnée à
22 h 30 (`465fc3d`) ; les quatre jobs de `main` réussis, « Déploiement
Cloudflare » terminé à 22 h 37, l'application redéployée, les deux Workers
inchangés donc non redéployés. Sur le « vas-y » du porteur, contrat
`docs/weather-alerts-contract.md` écrit : critères de l'exploitation sur la
température minimale, la température maximale et la pluie prévues, sens
stricts, horizon de 1 à 7 jours, évaluation après chaque écriture de
prévisions, une alerte par critère et par jour visé, alertes enregistrées,
températures prévues conservées par une migration additive, route d'envoi
immédiat au Worker Web Push, encart près de la météo de la semaine, neuf
scénarios chiffrés. Huit questions posées au porteur avec une
recommandation ; il les accepte toutes le jour même (« D'accord pour tout »).
Le cahier des charges n'étant pas dans le dépôt, le contrat part de la
section 5 bis de la roadmap et des contrats météo et Web Push. Roadmap aux
trois endroits ; D-050. Écrit en Opus 5.5 · Moyen. PR de documents seule :
contrôles joués, `pnpm e2e` omis, sans rapport avec une PR qui ne touche ni
l'interface ni ses services.

Le 30 octobre 2026 au soir, **PR #205 fusionnée par l'assistant et déployée ;
la PR Dependabot #185, `wrangler` 4.153.0 → 4.154.0, reprise dans une PR de
lot sur le « vas-y » du porteur.** La PR #205, contrat des alertes météo (D-050),
fusionnée à 22 h 47 (`da814fd`) ; les quatre jobs de `main` réussis,
« Déploiement Cloudflare » terminé à 22 h 53, l'application redéployée, les
deux Workers inchangés donc non redéployés. Après le lot #203, Dependabot a
réutilisé #185 pour une version plus récente de `wrangler`, l'outil qui publie
le site et les Workers ; dépendance de développement seule, à la racine et
dans les deux Workers, version exacte, verrou refait par `pnpm install`.
Effort « Élevé », comme le recommande la feuille de route pour les dépendances
(Q4). Contrôles joués dans la session distante : lint sans avertissement,
typage sans erreur, 652 tests réussis en 15 s, compilation réussie (avec
l'avertissement `INEFFECTIVE_DYNAMIC_IMPORT` de vinext, déjà émis sur `main`),
`pnpm knip` sans code mort (les dix indications de configuration de
`knip.json` inchangées), `pnpm push:check` et `pnpm weather:check` réussis ;
`pnpm e2e` : 26 parcours réussis sur 26, aux deux largeurs, en 5,5 min.
Dependabot fermera seul #185 devenue sans objet.

Le 30 octobre 2026 au soir, **PR #206 fusionnée par l'assistant et déployée ;
contrat de la 3.7 écrit et validé par le porteur, décision D-051 ; aucun
code.** La PR #206, `wrangler` 4.154.0, fusionnée à 23 h 03 (`b2e3708`) ;
les quatre jobs de `main` réussis, « Déploiement Cloudflare » terminé à
23 h 11, ses étapes « Déployer l'application », « Déployer le Worker Push »
et « Déployer le planificateur météo » réussies ; le journal détaillé du job
n'a pas pu être téléchargé depuis la session, le redéploiement effectif des
deux Workers est déduit du changement de leur `wrangler`, non lu. Le
contrat `docs/replanning-contract.md` (suivi d'exécution et replanification,
17ᵉ de l'ordre) part du constat du code de `main` : le plan ne se recalcule
que le matin et à la demande, le déclencheur « événement » existe au registre
sans être écrit, le moteur ne lit pas les refus (point 31), aucune suggestion
n'existe sur un arrosage validé, « en retard » n'existe pas. Il fixe la
lecture des refus (D-030), la liste fermée des événements qui font
recalculer, l'identité des propositions reproduites, les suggestions
« Réduire » ou « Annuler » sur les arrosages validés au seuil de la dose
minimale, le retard à 30 minutes (réglage R14), deux notifications par
l'alarme existante du Worker, le pli « Ce qui a changé », un découpage en
cinq PR et le parcours P12. Six questions posées au porteur avec une
recommandation chacune, toutes tranchées à 21 h 19 : « Je suis d'accord avec
toutes tes suggestions. » Brouillon commencé en Opus 5.5 · Élevé par le
choix du coordinateur, écart signalé au porteur à l'ouverture ; sur son mot
à 21 h 04, passage en Fable 5.1 · Très élevé, le réglage de la roadmap, avant
la relecture (D-049). Roadmap aux trois endroits ; D-051 ; point 31 mis à
jour. PR de registres seule : **aucun contrôle rejoué**, sans rapport avec
une PR qui ne touche ni le code ni l'interface ; les trois jobs de la PR
tiennent lieu de contrôle.

Le 31 octobre 2026, **PR #207 fusionnée par l'assistant et déployée ; le code
de la 3.7 se prépare : la description de la contrainte limitante sort du
moteur, sans changement.** La PR #207, registres du cadrage 3.7 (D-051),
fusionnée à 01 h 22 (`3418648`) ; les quatre jobs de `main` réussis,
« Déploiement Cloudflare » terminé à 01 h 29, ses étapes « Appliquer les
migrations D1 distantes » et « Déployer l'application » réussies, les deux
Workers non redéployés, inchangés. Première PR de code de la 3.7 préparée :
le type `PumpConstraint` et la fonction `describeLimitingConstraint` passent
de `lib/domain/planning/engine.ts` à `lib/domain/planning/justification.ts`,
sans changement, parce que le moteur comptait 593 lignes de code pour une
limite de 600 (Q6) et que la lecture des refus le porterait à 607 ;
`AGENTS.md` séparant restructuration et fonctionnalité, le déplacement est
une PR à part, fusionnée juste avant la PR de code qui la suit. Aucune règle
ne change, aucun test n'est modifié ; le moteur passe à 556 lignes de code.
Contrôles rejoués après rebasage sur `main` (`wrangler` 4.154.0 installé) :
`pnpm lint` 0 erreur ; `pnpm typecheck` 0 erreur ; `pnpm test` 652 tests
réussis ; `pnpm build` réussi ; `pnpm knip` 0 export inutilisé ;
`pnpm push:check` 11 tests et déploiement à blanc réussis ;
`pnpm weather:check` 2 tests et déploiement à blanc réussis ; `pnpm e2e`
26 parcours réussis en 5,0 min, avec le Chromium 1243 du conteneur pour
1248 attendu, la CI faisant foi. Registres : cette entrée et le journal ; roadmap
inchangée, la PR n'ajoute rien de fonctionnel ; la lecture des refus, PR
suivante, y consignera le début du code.

Le 31 octobre 2026, **PR #208 fusionnée par l'assistant et déployée ;
première PR de code de la 3.7 ouverte : le moteur lit les refus de la
semaine (D-030, point ouvert 31).** La PR #208, le déplacement sans
changement de la description de la contrainte limitante hors du moteur,
fusionnée à 01 h 54 (`a57227f`) ; les quatre jobs de `main` réussis,
« Déploiement Cloudflare » terminé à 02 h 02, « Déployer l'application »
réussi, les deux Workers non redéployés, inchangés. La lecture des refus,
règles 1 à 3 de `docs/replanning-contract.md` : le service passe au moteur
les créneaux refusés de la semaine du plan (`PlanningInputs.refusedSlots`),
chaque proposition refusée de n'importe quel calcul de la semaine, par son
matériel, son début et sa fin, le lundi repartant sans eux ; le placement
découpe les plages du matériel autour de chaque refus qui les recouvre,
même en partie, quelle que soit la dose (`lib/domain/planning/refusals.ts`),
et place le créneau dans ce qui reste, à la minute ronde après un refus ou
coupé avant lui si la dose minimale y tient ; le besoin reste entier et se
place ailleurs, ou se lit « non placé » avec le motif « créneau refusé »
quand les seuls créneaux possibles ont été refusés, une autre contrainte
qui aurait suffi se nommant à sa place ; la justification dit « après un
créneau refusé », « ce qui tient avant un créneau refusé », « créneau refusé
évité ». Le cas de la rampe du tunnel 4 du 5 octobre 2026 est rejoué en
test (`tests/planning-refusals.test.ts`, dix tests), la persistance du
refus d'un calcul à l'autre aussi (`tests/db/planning-service.test.ts`).
Aucune règle agronomique nouvelle, aucune migration, aucun changement
d'écran. Contrôles rejoués après rebasage sur `main` : `pnpm lint` 0 erreur ; `pnpm typecheck` 0 erreur ; `pnpm test` 663 réussis ; `pnpm build` réussi ; `pnpm knip` 0 export inutilisé ; `pnpm push:check` 11 tests réussis et déploiement à blanc réussi ; `pnpm weather:check` 2 tests réussis et déploiement à blanc réussi ; `pnpm e2e` 26 parcours réussis (4,8 min), avec le Chromium 1243 du conteneur pour 1248 attendu, la CI faisant foi.
Registres : roadmap aux quatre endroits (tableau, ordre, bloc 3.7, tableau
des modèles), état fonctionnel, point 31, journal. Le point 31 reste 🟡
jusqu'à la recette sur le site, sur la version déployée.

Le 31 octobre 2026, **PR #214 fusionnée par l'assistant et déployée ;
cinquième et dernière PR de code de la 3.7 ouverte : l'écran du suivi et le
parcours P12.** La PR #214, les deux notifications, fusionnée à 06 h 09
(`203e036acf5dc18e2bb3252faddcc72102bcb2fc`) ; les quatre jobs de `main` réussis, « Déploiement Cloudflare »
terminé à 06 h 17, « Appliquer les migrations D1 distantes » réussi (migration
0021), « Déployer l'application » réussi, les deux Workers non redéployés,
inchangés ; les alarmes de retard et la notification du matin sont en
ligne. L'écran (`app/irrigation/planning/follow-up-blocks.tsx`,
`weekly-plan-view.tsx`, `irrigation-cards.tsx`), dans la section « Planning
de la semaine », sans réorganisation : le pli « Ce qui a changé depuis le
calcul du … », après les cartes de résumé, le nombre de changements dans
son titre ou « rien », une ligne par changement, une lecture ; les
suggestions sur les arrosages validés, après les budgets, chacune avec
« Annuler » ou « Réduire à X mm », le matériel, le créneau, la dose prévue,
ses raisons et ses deux boutons — « Appliquer » relit la suggestion du
dernier calcul et passe par l'annulation ordinaire de l'irrigation planifiée
ou par sa modification en mode durée, le message dit ce qui a été fait, les
autres sections relisent et le plan se recalcule après la réponse ;
« Garder » enregistre la suggestion avec sa dose, elle se tait jusqu'à un
autre calcul, les gardées repliées — ; le signal « En retard : non démarrée
35 min après l'heure prévue… » ou « Non faite : le créneau est passé sans
démarrage… » sur la carte de l'irrigation planifiée dans « À venir ou à
terminer », avec le bouton « Recalculer le plan », qui demande un calcul à la
demande à la section du planning. Les libellés et les listes vivent dans
`lib/domain/planning/follow-up.ts`, testés (cinq tests) ; aucune règle dans
les composants ; les styles nouveaux dans `planning-follow-up.css`,
`planning.css` tenant la limite de 600 lignes. Le parcours P12
(`e2e/p12-replanification.spec.ts`), aux deux largeurs, sur le dispositif de
P10 sous abri : une pluie saisie au pluviomètre et le plan recalculé seul,
le déclencheur nommé dans l'en-tête et le pli présent ; une proposition
refusée et le besoin replacé hors du créneau refusé, ou « Non placé » pour
créneau refusé dans la dernière heure d'un dimanche ; une proposition
validée ; une limite journalière posée après coup d'aujourd'hui sans fin, à
0,01 m³, la suggestion « Annuler » avec la limite et le volume engagé pour
raison, listée dans le pli, la cible tactile de « Valider » et
d'« Appliquer » ; la suggestion appliquée jusqu'à la disparition de
l'irrigation dans « À venir » et le recalcul après l'annulation ; la limite
levée ; la remise en état. Les gestes du planning que P10 et P12 partagent
passent dans `e2e/support/planning.ts`, P10 inchangé ; 28 parcours. Reste
la recette réelle sur la ferme (contrat, décision 6), sur le « vas-y » du
porteur. Contrôles rejoués après rebasage sur `main` : `pnpm lint` 0
erreur ; `pnpm typecheck` 0 erreur ; `pnpm test` 723 réussis ; `pnpm build`
réussi ; `pnpm knip` 0 export inutilisé ; `pnpm push:check` 11 tests réussis
et déploiement à blanc réussi ; `pnpm weather:check` 2 tests réussis et
déploiement à blanc réussi ; `pnpm e2e` 28 parcours réussis (6,8 min), avec
le Chromium 1243 du conteneur pour 1248 attendu, la CI faisant foi. Registres :
roadmap aux quatre endroits, état fonctionnel, journal.

Le 31 octobre 2026, **PR #213 fusionnée par l'assistant et déployée ;
PR 4b de la 3.7 ouverte : les deux notifications (règles 21 à 24).** La PR
#213, le retard et le réglage R14, fusionnée à 03 h 29 (`10b394f`) ; les
quatre jobs de `main` réussis, « Déploiement Cloudflare » terminé à 03 h 38,
« Appliquer les migrations D1 distantes » réussi (aucune migration
nouvelle), « Déployer l'application » réussi, les deux Workers non
redéployés, inchangés ; R14 est en ligne dans le pli « Réglages du
planning ». Les notifications : l'alarme « en retard » (règle 24) — une
irrigation planifiée reçoit, à sa création ou à sa modification, une alarme
pour son début plus R14 (`lateAlarmDueAt`, nulle si le créneau est passé ou
si la tolérance dépasse le créneau), colonne `late_alarm_due_at` (migration
0021, additive, 47 tables) ; l'alarme porte sa sorte, fin ou retard ; au
démarrage, l'alarme de fin, de révision plus récente, remplace celle du
retard, effacée ; l'annulation et la modification d'une irrigation planifiée
annulent d'abord l'alarme, comme la pause et la fin ; la notification dit
« Irrigation en retard — matériel · réglage, non démarrée à l'heure
prévue » ; les actions et la validation d'une proposition lisent R14 des
réglages ; service non configuré, silence ; panne, « L'irrigation est
enregistrée, mais l'alerte de retard n'a pas pu être programmée. » — et la
notification du matin (règles 21 à 23, `lib/domain/planning/notifications.ts`,
`lib/services/planning-notifications.ts`) — après le calcul du matin
seulement, une alarme immédiate `plan:<calcul>` pour l'exploitation quand
une suggestion non gardée porte sur un arrosage des prochaines 24 heures,
« N suggestions sur vos arrosages des prochaines 24 heures · Annuler … ·
Réduire … à 8 mm », une par calcul, jamais après un geste à l'écran ni après
un recalcul sur événement ; journaux `planning_suggestion_notification_sent`
et `_failed` ; une panne ne fait jamais échouer le calcul. Le Worker Push ne
change pas. Les irrigations planifiées avant cette PR n'ont pas d'alarme de
retard : elle vient avec leur prochaine modification ; un changement de R14
ne touche que les irrigations créées ou modifiées ensuite. Tests du
domaine, de la persistance (deux cycles d'alarme) et du service (calcul du
matin avec et sans suggestion). Contrôles rejoués après rebasage sur
`main` : `pnpm lint` 0 erreur ; `pnpm typecheck` 0 erreur ; `pnpm test` 718 réussis ;
`pnpm build` réussi ; `pnpm knip` 0 export inutilisé ; `pnpm push:check` 11
tests réussis et déploiement à blanc réussi ; `pnpm weather:check` 2 tests
réussis et déploiement à blanc réussi ; `pnpm e2e` 26 parcours réussis (4,9
min), avec le Chromium 1243 du conteneur pour 1248 attendu, la CI faisant
foi. Registres : roadmap aux quatre endroits, état fonctionnel,
journal.

Le 31 octobre 2026, **PR #212 fusionnée par l'assistant et déployée ;
PR 4a de la 3.7 ouverte : le retard d'une irrigation planifiée et le
réglage R14 (règles 18 à 20).** La PR #212, « Ce qui a changé », fusionnée
à 03 h 14 (`feac350`) ; les quatre jobs de `main` réussis, « Déploiement
Cloudflare » terminé à 03 h 20, « Appliquer les migrations D1 distantes »
réussi (aucune migration nouvelle, 47 tables), « Déployer l'application »
réussi, les deux Workers non redéployés, inchangés ; la version en ligne
enregistre « ce qui a changé » avec chaque calcul. Le retard
(`lib/domain/planned-irrigation.ts`, `plannedIrrigationLateness`) : une
irrigation planifiée non démarrée une tolérance après son heure est « en
retard » ; tout son créneau passé sans démarrage, « non faite ». La
tolérance est le réglage R14 (`lateToleranceMinutes`), 30 minutes au départ,
par exploitation, avec son historique comme les autres réglages, réglable
dans le pli « Réglages du planning » (champ « R14 · Tolérance du retard, en
min après l'heure prévue ») ; un réglage enregistré avant la PR se lit avec
30, sans réécriture ni migration. Le signal se calcule à la lecture, rien
n'est enregistré, le passage en retard ne lance aucun calcul ; son eau ne
change pas (règle 19, encodée en test) : la part du créneau qui reste à
venir, puis plus rien ; le logiciel n'annule jamais (règle 20). Quatre tests
du domaine, deux de la persistance du réglage, un de la présentation. Rien
sur la carte encore : le libellé « En retard » ou « Non faite » et le bouton
« Recalculer le plan » viennent avec la cinquième PR ; les notifications
avec la suivante. Contrôles rejoués après rebasage sur `main` : `pnpm lint` 0 erreur ; `pnpm typecheck` 0 erreur ; `pnpm test` 707 réussis ;
`pnpm build` réussi ; `pnpm knip` 0 export inutilisé ; `pnpm push:check` 11
tests réussis et déploiement à blanc réussi ; `pnpm weather:check` 2 tests
réussis et déploiement à blanc réussi ; `pnpm e2e` 26 parcours réussis (4,8
min), avec le Chromium 1243 du conteneur pour 1248 attendu, la CI faisant
foi.
Registres : roadmap aux quatre endroits, état fonctionnel, journal.

Le 31 octobre 2026, **PR #211 fusionnée par l'assistant et déployée ;
PR 3 bis de la 3.7 ouverte : « Ce qui a changé » depuis le calcul précédent
(règle 25).** La PR #211, les suggestions sur les arrosages validés,
fusionnée à 02 h 53 (`c67f602`) ; les quatre jobs de `main` réussis,
« Déploiement Cloudflare » terminé à 03 h 01, « Appliquer les migrations D1
distantes » réussi (migration 0020, 47 tables), « Déployer l'application »
réussi, les deux Workers non redéployés, inchangés ; la version en ligne
enregistre les suggestions avec chaque calcul. « Ce qui a changé »
(`lib/domain/planning/changes.ts`) : après chaque calcul, le service compare
le nouveau plan au dernier enregistré de la semaine et garde la lecture dans
le résumé du calcul (`changes`) : les propositions apparues, retirées,
déplacées ou de dose changée — appariées par matériel et réglage, la plus
proche en heure d'abord ; seules les propositions encore proposées se
comparent —, les suggestions nouvelles sur les arrosages validés, les
planches entrées dans « Non placé » ou sorties, le manque d'eau avant et
après. Nul au premier calcul de la semaine et pour les calculs antérieurs,
relus sans réécriture. « Non placé » se lit d'une seule règle
(`isBedUnplaced`), que l'écran appelle désormais. Aucune migration : le
résumé est déjà un JSON. Douze tests du domaine, la persistance et le
service. Rien à l'écran : le pli vient avec la cinquième PR. Contrôles
rejoués après rebasage sur `main` : `pnpm lint` 0 erreur ; `pnpm typecheck` 0 erreur ; `pnpm test` 702
réussis ; `pnpm build` réussi ; `pnpm knip` 0 export inutilisé ; `pnpm
push:check` 11 tests réussis et déploiement à blanc réussi ; `pnpm
weather:check` 2 tests réussis et déploiement à blanc réussi ; `pnpm e2e`
26 parcours réussis (4,8 min), avec le Chromium 1243 du conteneur pour 1248
attendu, la CI faisant foi. Registres : roadmap aux quatre
endroits, état fonctionnel, journal.

Le 31 octobre 2026, **PR #210 fusionnée par l'assistant et déployée ;
troisième PR de code de la 3.7 ouverte : les suggestions sur les arrosages
validés (règles 11 à 17).** La PR #210, le recalcul sur événement, fusionnée
à 02 h 28 (`3a30282`) ; les quatre jobs de `main` réussis, « Déploiement
Cloudflare » terminé à 02 h 34, « Appliquer les migrations D1 distantes »
réussi (migration 0019, 46 tables), « Déployer l'application » réussi, les
deux Workers non redéployés, inchangés ; la version en ligne recalcule le
plan après chaque événement. Les suggestions
(`lib/domain/planning/suggestions.ts`) : à chaque calcul, pour chaque
arrosage validé encore à venir, examiné dans l'ordre du temps, la dose
utile est recalculée avec les règles du jour ; sous la dose minimale R4,
« Annuler » ; quand la dose prévue dépasse la dose utile d'au moins la dose
minimale, « Réduire à X mm », avec la durée au prorata ; jamais allonger ;
la raison expose les termes du besoin de la planche de référence. Un
matériel retiré ou reposé ailleurs fait suggérer « Annuler » avec la date
du retrait ; une limite journalière posée après coup signale le jour en
défaut (`overcommittedDays`) et fait suggérer de réduire jusqu'à la limite,
priorité basse d'abord, puis normale, puis haute, par bissection sur les
volumes du jour ; une planche sans besoin calculable ne compte pas et, si
aucune ne l'a, rien n'est suggéré. « Garder » tait une suggestion, avec sa
dose, jusqu'à ce qu'un calcul en fasse une autre (table
`irrigation_plan_suggestion_keeps`, migration 0020, additive, 47 tables) ;
ce n'est pas un événement. Les suggestions sont enregistrées dans le résumé
du calcul et relues avec lui, les gardées marquées ; un calcul antérieur à
la 3.7 se relit sans suggestion. Rien à l'écran : les boutons, leur action
et les libellés viennent avec la cinquième PR. Dix-sept tests du domaine et
la persistance. Contrôles rejoués après rebasage sur `main` :
`pnpm lint` 0 erreur ; `pnpm typecheck` 0 erreur ; `pnpm test` 689 réussis ; `pnpm build` réussi ; `pnpm knip` 0 export inutilisé ; `pnpm push:check` 11 tests réussis et déploiement à blanc réussi ; `pnpm weather:check` 2 tests réussis et déploiement à blanc réussi ; `pnpm e2e` 26 parcours réussis (4,8 min), avec le Chromium 1243 du conteneur pour 1248 attendu, la CI faisant foi. Registres : roadmap aux quatre endroits, état
fonctionnel, journal.

Le 31 octobre 2026, **PR #209 fusionnée par l'assistant et déployée ;
deuxième PR de code de la 3.7 ouverte : le plan se recalcule de lui-même
après chaque événement (règles 4 à 10).** La PR #209, la lecture des refus,
fusionnée à 02 h 10 (`98144a1`) ; les quatre jobs de `main` réussis,
« Déploiement Cloudflare » terminé à 02 h 17, « Déployer l'application »
réussi, les deux Workers non redéployés, inchangés ; la version en ligne lit
les refus, la recette du point 31 sur le site attend le « vas-y » du
porteur. Le recalcul sur événement : après chaque événement de la règle 4,
l'action serveur appelle `recalculatePlanAfterEvent`
(`lib/services/planning-recalculation.ts`), qui inscrit l'événement dans la
table `irrigation_plan_events` (migration 0019, additive, 46 tables) puis
confie le calcul à `waitUntil` de `cloudflare:workers`, après la réponse au
maraîcher — hors Worker, avant elle ; un événement d'une autre semaine ne
fait rien, un événement durable compte dès qu'il n'est pas à venir ; la
pause, la reprise, les réglages du planning et la météo n'appellent pas. Un
échec marque l'événement « échoué », écrit
`planning_event_recalculation_failed` sans nommer personne, et l'écran dit
« Plan antérieur à : …, le … — le recalcul a échoué, recalculez. » ; le
service ne lève jamais. Le déclencheur est nommé (colonne `trigger_event`,
en-tête « calculé le … (après la pluie saisie au pluviomètre) »,
`planning_calculation_completed` porte `triggerEvent`). Une proposition
refaite à l'identique — même matériel, réglage, début, fin, dose — garde
son identifiant de registre et passe au nouveau calcul (règle 10) ; deux
calculs sans événement ne remplacent rien (règle 9) ; deux calculs croisés
ne se détruisent pas, chaque écriture étant conditionnée à l'absence d'un
calcul plus récent (règle 8). L'écran relit le plan à intervalles
croissants après les signaux d'événement des autres sections, affiche
l'avis « Plan antérieur à … », et la carte porte `data-proposal-id`, que le
parcours P10 retrouve à travers un recalcul. Contrôles rejoués après
rebasage sur `main` : `pnpm lint` 0 erreur ; `pnpm typecheck` 0 erreur ; `pnpm test` 672 réussis ; `pnpm build` réussi ; `pnpm knip` 0 export inutilisé ; `pnpm push:check` 11 tests réussis et déploiement à blanc réussi ; `pnpm weather:check` 2 tests réussis et déploiement à blanc réussi ; `pnpm e2e` 26 parcours réussis (4,9 min), avec le Chromium 1243 du conteneur pour 1248 attendu, la CI faisant foi. Registres : roadmap aux quatre
endroits, état fonctionnel, points 31 et 34, journal.

Le 31 octobre 2026, **PR #215 fusionnée par l'assistant et déployée ; contrat
des scénarios de pénurie, de la recette et de la publication de la tranche 3
(3.9) écrit et validé par le porteur, décision D-052 ; aucun code.** La PR
#215, l'écran du suivi et le parcours P12 de la 3.7, fusionnée à 06 h 30 (`ebd29e9`) ; les
quatre jobs de `main` réussis, « Déploiement Cloudflare » terminé à 06 h 39 :
« Appliquer les migrations D1 distantes » réussi sans migration nouvelle,
« Déployer l'application » réussi, les deux Workers non redéployés, inchangés
(run `41172869372`, lu par l'API GitHub). Le
contrat `docs/shortage-contract.md`, écrit le 30 octobre 2026 sur la règle du
point 17 (tout contrat à écrire s'écrit sans attendre), en Fable 5.1 · Max, le
réglage de la roadmap vérifié à l'ouverture : vingt-huit scénarios chiffrés S1
à S28 sur la ferme de test (les sources du manque, les trois conduites R9, la
part réservée, la semaine qui avance, l'isolation), trois jeux de données, la
non-régression complète, la revue de sécurité en sept points, la recette
finale `docs/recette-tranche-3.md`, la publication en `v0.2.0`. Huit questions
posées au porteur avec une recommandation ; il les accepte toutes le soir
même à 22 h 54 (« d'accord avec tout. ») : arbitrage validé en parts
réservées, budget net du manque sous le minimum avec la part placée
affichée, report sans bascule entre deux calculs sans événement, part sous la
dose minimale placée le dimanche, recette finale en pénurie fabriquée sur la
ferme réelle sur son « vas-y », priorités posées par lui ce jour-là, R2 et R9
informations, rien de nouveau entre abri et plein champ ; les quatre règles
précisées se codent en PR `fix/` quand la 3.9 s'ouvre, 22ᵉ de l'ordre, après
la 3.8. Roadmap aux quatre endroits ; D-052 ; journal. PR de documents seule,
rebasée sur `main` (`ebd29e9`) : `pnpm lint` 0 erreur ; `pnpm typecheck`
0 erreur ; `pnpm test` 723 réussis sur 723 ; `pnpm build` réussi
(avertissements `INEFFECTIVE_DYNAMIC_IMPORT` de vinext, déjà émis sur `main`) ;
`pnpm knip` 0 export inutilisé (les dix indications de configuration de
`knip.json` inchangées) ; `pnpm push:check` 11 tests réussis et déploiement à
blanc réussi ; `pnpm weather:check` 2 tests réussis et déploiement à blanc
réussi ; `pnpm e2e` omis, sans
rapport avec une PR qui ne touche ni l'interface ni ses services.

Le 31 octobre 2026, **PR #216 et #217 fusionnées par l'assistant et déployées ;
recette réelle de la 3.7 faite sur la ferme, point 31 prouvé sur le site.**
La PR #216, le contrat de la 3.9, fusionnée à 06 h 53 (`80e00b7`), « Déploiement
Cloudflare » terminé à 07 h 00, l'application seule, aucune migration ; la
PR #217, le lot correctif des 25 alertes Dependabot des outils de
développement, fusionnée à 10 h 58 (`4a48f69`), les quatre jobs de `main`
réussis, « Déploiement Cloudflare » terminé à 11 h 06, l'application seule,
aucune migration, les deux Workers inchangés (run `41190812439`) ; une alerte
modérée nouvelle sur `minimatch`, outil de développement, laissée de côté.
La recette réelle de la 3.7 (`docs/recette-3.7.md`), de 10 h 44 à 10 h 51,
dans le Chrome du porteur par une séance lancée sur son ordinateur, sur son
« vas-y » de 10 h 38, protocole K0 à K7 et attendus écrits avant les gestes,
sur la version déployée (`80e00b7`, le code de la 3.7 celui de #215) : aucune
irrigation réelle ce jour-là, les événements fabriqués sur les vraies
planches et défaits par l'écran. Prouvé : le plan se recalcule de lui-même
après une pluie saisie, un refus, deux validations, une limite journalière
posée après coup et une annulation, l'en-tête nommant chaque déclencheur ; le
pli « Ce qui a changé » avec son nombre de changements ; le moteur lit les
refus — la rampe de serre du tunnel 1 refusée à 21 h 00 n'est pas reproposée,
le besoin replacé le même soir à 22 h 19, le tunnel 4 prenant l'heure
libérée (point 31) — ; sous une limite de 0,01 m³, une suggestion « Annuler »
par arrosage validé, avec la limite et le volume engagé pour raison,
« Garder » qui la fait taire, « Appliquer » qui annule par le circuit
ordinaire et fait recalculer ; recalculs en 0 à 4 s. Au jugement du porteur :
les cartes des deux arrosages annulés restées « Validée », comptées dans le
résumé et reproposées en double par le dernier calcul — le registre garde le
statut sans lire l'état de l'irrigation, défaut antérieur à la 3.7 révélé
par elle — ; le message « Suggestion appliquée » affiché dans la carte de la
suggestion, qui disparaît au recalcul ; « Proposition déplacée » à
l'identique à la minute, la comparaison se faisant à la milliseconde ; les
3 mm de pluie saisis pour le 31 octobre, qu'aucun écran ne retire, restés sur
la ferme ; la fenêtre du navigateur du bouton « Annuler » (antérieure) ; la
dose des tunnels montée après la pluie par les parts en pénurie. Non
observé : les notifications sur le téléphone, le signal de retard, « Réduire ».
Corrections proposées le jour même, sur le mot du porteur ; la fermeture du
point 31 et de la 3.7 à son jugement. PR de documents seule, rebasée sur
`main` (`4a48f69`) : `pnpm lint` 0 erreur ; `pnpm typecheck` 0 erreur ;
`pnpm test` 723 réussis ; `pnpm build` réussi ; `pnpm knip` 0 export
inutilisé ; `pnpm push:check` 11 tests réussis et déploiement à blanc
réussi ; `pnpm weather:check` 2 tests réussis et déploiement à blanc réussi. Registres : roadmap aux quatre endroits, état
fonctionnel, point 31, journal.

Le 31 octobre 2026, **PR #218 fusionnée par l'assistant et déployée ; les
quatre défauts de la recette réelle de la 3.7 corrigés le jour même sur le mot
du porteur.** La PR #218, les registres de la recette, fusionnée à 11 h 24
(`5933d1a`), « Déploiement Cloudflare » terminé à 11 h 33, l'application
seule, aucune migration (run `41192613944`). Le porteur a choisi « Oui, les
quatre » à 11 h 15 ; la PR de correction (#220), fusion sur son mot : la carte
d'un arrosage validé lit l'état réel de l'irrigation — le registre du plan
joint `irrigation_events` à la proposition validée et porte son statut ;
« Annulée », « Réalisée », « Partielle » sur la carte, une annulée hors du
compte des validées et de leur volume dans le résumé ; sans migration — ; le
message « Suggestion appliquée » posé dans le bandeau de la section, où il
reste quand la suggestion s'en va avec le recalcul ; « Proposition déplacée »
jugée à la minute, comme l'écran montre les heures, la durée au dixième de
millimètre près n'étant plus un déplacement ; « Retirer la mesure » dans
« Pluie mesurée », qui efface la mesure manuelle du jour et fait réanalyser le
plan comme une pluie saisie (`removeManualRainfallAction`). Contrats mis à
jour : les statuts du contrat de planification, les règles 4 et 25 du contrat
de replanification, le contrat des besoins (la mesure retirée), le parcours
P12 du contrat des parcours. Tests : 725 réussis — la présentation des quatre
états d'une proposition validée, « déplacée » à la minute, le second calcul
après annulation (statut `canceled`, « 0 validée », dose revenue au plan), le
retrait d'une mesure ; P12 vérifie la carte « Annulée », « 0 validée » et le
message dans le bandeau, aux deux largeurs. Contrôles : `pnpm lint` 0 erreur ;
`pnpm typecheck` 0 erreur ; `pnpm test` 725 réussis ; `pnpm build` réussi ;
`pnpm knip` 0 export inutilisé ; `pnpm push:check` 11 tests réussis et
déploiement à blanc réussi ; `pnpm weather:check` 2 tests réussis et
déploiement à blanc réussi ; `pnpm e2e` 28 parcours réussis (9,8 min) sur
l'arbre d'avant le second commit (un export inutile signalé par knip retiré,
seul changement depuis), la chaîne rapide rejouée ensuite, la CI faisant foi.
Registres : roadmap aux quatre endroits, état fonctionnel, journal ; le point
31 reste 🟡 jusqu'au jugement du porteur. Sur la ferme restent les 3 mm de
pluie fabriqués du 31 octobre, à remplacer par la vraie mesure ou à retirer
une fois la PR déployée, sur le mot du porteur.

Le 31 octobre 2026, **PR #220 fusionnée par l'assistant et déployée ;
contrat de la réserve du sol (5 ter) relu et validé par le porteur, décision
D-053 ; aucun code.** La PR #220, les quatre corrections de la recette
réelle de la 3.7, fusionnée sur le mot du porteur à 12 h 05 (`ad16be2`) ;
les quatre jobs de `main` réussis, « Déploiement Cloudflare » terminé à
12 h 14 : « Appliquer les migrations D1 distantes » réussi sans migration
nouvelle, « Déployer l'application » réussi, les deux Workers non
redéployés, inchangés (run `41195399263`, lu par l'API GitHub). Relecture
de la 5 ter préparée et menée
dans la conversation « Préparer la relecture du contrat 5 ter », en Opus 5.5
· Très élevé, au réglage du domaine de la 5 ter : le porteur répond question
par question, puis « oui à toutes tes recommandations », et confirme avant
la fusion le chou kale à 0,45 et les sept précisions faites en écrivant
(« ok pour le chou kale, ok pour les précisions »). Seuils sur une part
de référence de 2/3 (CRIIAM) au lieu de 0,5 ; p de la FAO-56 pour toutes les
cultures qui en ont une (pomme de terre, carotte et concombre ajoutés),
poireau 0,30 et chou kale 0,45 par leur famille, 0,5 sans valeur ;
profondeurs des vingt cultures de référence absentes de la fiche ITAB tirées
d'une recherche documentaire faite le même jour à sa demande (Geisenheim
surtout), trente cultures en tout ; pas de profondeur réduite sous abri ;
moitié au premier stade sauf poireau (30 jours), asperge et fraisier ; abri
sans analyse à la RFU de sa parcelle sans mention ; curseur de parcelle
limité au plein champ, repères sec, frais, humide, détrempé ; jauge continue
sur une planche sans culture par le modèle de sol nu de la FAO-56 (TEW 14 mm,
REW 7 mm, six états de surface réglables), sur un complément du porteur
préparé avec un autre assistant, relu contre le dépôt : jauge inconnue
seulement au départ et sur un trou de données (D-003), curseur gardé, aucun
conseil d'arrosage avant plantation (« ne l'affiche pas »), deux erreurs de
calcul du complément corrigées ; erreur du contrat corrigée (15,3 mm, non
18,6 mm, sur 30 cm à 51 mm/m). Trente-sept scénarios, recalculés aux 2/3.
Contrat de la 5 quater complété sur le lien avec la jauge ; roadmap aux
quatre endroits ; D-053. Le code du domaine de la 5 ter reste après celui de
la 5 quater, 19ᵉ de l'ordre. PR de documents seule, rebasée sur `main`
(`ad16be2`) : `pnpm lint` 0 erreur ; `pnpm typecheck` 0 erreur ; `pnpm test`
725 réussis sur 725 ; `pnpm build` réussi (avertissements
`INEFFECTIVE_DYNAMIC_IMPORT` de vinext, déjà émis sur `main`) ; `pnpm knip` 0 export inutilisé
(les dix indications de configuration de `knip.json` inchangées) ;
`pnpm push:check` 11 tests réussis et déploiement à blanc réussi ;
`pnpm weather:check` 2 tests réussis et déploiement à blanc réussi ;
`pnpm e2e` omis, sans rapport avec une PR qui ne touche ni l'interface ni ses
services.

Le 31 octobre 2026, **PR #219 fusionnée par l'assistant et déployée ;
vérification sur la ferme après #220 ; 3.7 close par le porteur, point 31
fermé.** La PR #220, les quatre corrections de la recette, fusionnée à 12 h 05
(`ad16be2`) sur le « vas-y » écrit par le porteur à 12 h 04 et déployée à 12 h
14 (consignée par #219, entrée précédente). La PR #219, la relecture du
contrat de la réserve du sol (5 ter, D-053), fusionnée à 12 h 23 (`df560f9`),
les quatre jobs de `main` réussis, « Déploiement Cloudflare » terminé à 12 h
32, l'application seule, aucune migration, les deux Workers inchangés (run
`41196652836`). Puis la vérification sur la ferme de 12 h 15 à 12 h 17 dans le
Chrome du porteur : les deux cartes des arrosages annulés lisent « Annulée »
et sortent du compte (« 0 validée », 39,52 m³ au lieu de 45,504 m³), les 3 mm
fabriqués du 31 octobre retirés par « Retirer la mesure » (semaine revenue à
0,9 mm, plan recalculé à 12 h 16 « après la pluie saisie au pluviomètre »),
plus aucune ligne « déplacée » à heures identiques, rien d'autre changé ; état
final 27 propositions · 0 validée · 1 refusée (le tunnel 1 de la recette,
valable la semaine, D-030) · 0 expirée, 42,365 m³, manque d'eau 39,929 m³, 164
planches non servies ; un seul geste sur la ferme, le retrait ; l'accès à
l'ordinateur refermé. Deux détails au jugement du porteur, non bloquants : le
fond très clair des cartes « Annulée » ; le champ « Millimètres » qui ne
montre pas la valeur déjà saisie pour le jour choisi, lisible dans la liste.
**Le porteur a clos la 3.7 à 12 h 23** (« vas-y ») ; le point 31 est fermé. Le
point 6 (la dose des tunnels montée après une pluie saisie) reste une lecture
de l'assistant conforme à D-038, sans décision nouvelle du porteur. Reste à
lui la vraie mesure du pluviomètre du jour, à saisir dans « Pluie mesurée ».
PR de documents seule, rebasée sur `main` (`ad16be2`) : `pnpm lint` 0 erreur ;
`pnpm typecheck` 0 erreur ; `pnpm test` 725 réussis ; `pnpm build` réussi ;
`pnpm knip` 0 export inutilisé ; `pnpm push:check` 11 tests réussis et
déploiement à blanc réussi ; `pnpm weather:check` 2 tests réussis et
déploiement à blanc réussi. Registres : roadmap aux quatre endroits, état
fonctionnel, point 31, journal, compte rendu de la recette.

Le 31 octobre 2026, **PR #221 fusionnée et déployée ; contrat du besoin en eau
par culture et par stade (5 quater) relu et tranché par le porteur (D-054) ;
PR 0 des données de départ ; aucun code.** La PR #221, la clôture de la 3.7,
fusionnée à 12 h 43 (`d2d20a8`), « Déploiement Cloudflare » terminé à
12 h 52, documents seuls (run `41198036255`, quatre jobs réussis). Relecture préparée par l'assistant le matin, en Opus 5.5 ·
Élevé (réglage de la PR 0 dans la roadmap), puis posée au porteur question par
question sur des cartes de décision, de 11 h 17 à 12 h 20 environ. Sur son
« vas-y », lecture seule des espèces de la ferme dans son Chrome (« Cumuls et
historique », onglet « Par série », une seule page chargée, sans
synchronisation ni appel direct à OTF) : 79 espèces sur 239 séries, ni
artichaut, ni asperge, ni fraisier, ni pomme de terre, ni chou-fleur. Il
rappelle que le logiciel servira à d'autres fermes et demande une recherche
documentaire pour chiffrer les dates sans source : faite le jour même dans
une conversation à part (FAO-56, Harrington, Université de l'Idaho, Chambres
d'agriculture, bulletins de santé du végétal Ail d'Occitanie, Wageningen,
Civam Bio 66, IGP Artichaut du Roussillon…). Tranché : règle stricte des
phases FAO corrigée par les sources (tomate 15 et 30 jours, melon 25 et 45,
haricot 40 et 50, ail J-45 et J-25, chou-fleur 35 et 50 au printemps,
aubergine 21 et 45, poivron 30 et 50) ; mi-récolte calée sur les récoltes
d'OTF ; à rebours pour l'ail, l'oignon et la fin de pomme de terre ; délais
de levée ; un jeu par saison ; calendriers fixes des pluriannuelles, restées
sur leur planche après la récolte (exception à D-022) ; correspondance des
espèces par espèce avec exceptions par série ; K_abri 0,8, paillage × 0,9,
lissage désactivé, ombrage codé désactivé ; mode automatique non retenu,
D-010 inchangée. Contrat corrigé : contradiction de la tomate, durées du
potiron que la FAO donne, ligne « Crucifères », semaines de récolte d'OTF ;
sept scénarios ajoutés. Registres : roadmap aux trois endroits, décision
D-054, journal. PR de documents seule ; contrôles joués quand même sur la
branche : `pnpm lint` 0 erreur ; `pnpm typecheck` 0 erreur ; `pnpm test`
725 réussis ; `pnpm build` réussi ; `pnpm knip` 0 export inutilisé ;
`pnpm push:check` et `pnpm weather:check` réussis, déploiement à blanc
réussi ; `pnpm e2e` omis, sans rapport avec une PR qui ne touche ni
l'interface ni ses services.

Le 31 octobre 2026, les règles d'économie de jetons du porteur sont inscrites
dans `AGENTS.md` (« Consignes du porteur », « Économie de jetons ») : grille
Sonnet 5.5 · Moyen pour le travail sans code, pas de PR pour un déploiement
seul, surveillance des jobs au plus toutes les cinq minutes, pas de fil
d'avance à vide, reprise allégée par la section « Où on en est » en tête de ce
document, questions posées une par message et numérotées « n sur N ». PR de
documents seule : aucun contrôle rejoué, hors `pnpm lint`, `pnpm typecheck`,
`pnpm test` et `pnpm build`, rejoués avant l'ouverture. **La PR #222 est
fusionnée et déployée** le 31 octobre 2026 : fusion à 13 h 49 (`332c645`),
déploiement terminé à 13 h 56 (run `41202801236`), documents seuls ; le
déploiement de #223 sera consigné par la PR suivante qui a un vrai contenu
(AGENTS.md).

Le 31 octobre 2026, **la PR #223 est fusionnée et déployée** : fusion à
14 h 06 (`1009e54`), déploiement terminé à 14 h 15 (run `41204073174`),
quatre jobs réussis, application déployée, Workers inchangés donc non
redéployés, documents seuls.

Le 31 octobre 2026, la 5 bis, alertes météo paramétrables, commence sur le
« vas-y » du porteur, en Opus 5.5 · Élevé, le réglage de la section 5 bis de
la roadmap. PR 1 sur 3, le domaine (`lib/domain/weather/weather-alerts.ts`,
`tests/weather-alerts.test.ts`) : validation d'un critère (champ parmi
température minimale, température maximale et pluie prévues ; sens ; seuil
dans les bornes du contrat, saisi avec une virgule ou un point ; horizon
entier de 1 à 7 jours, 3 par défaut ; libellé facultatif de 60 caractères au
plus, pour tenir dans le titre de 80 caractères du Worker Web Push), chaque
refus disant pourquoi ; évaluation sur la prévision la plus récente de
chaque jour de l'horizon, aujourd'hui compris, comparaisons strictes, valeur
absente jamais lue comme 0 et signalée (« Prévision indisponible pour le
mardi 3 novembre. ») ; une seule alerte par version de critère et par jour
visé ; une notification par critère qui nomme le premier jour visé et compte
les autres, avec le mot « prévue », le seuil et l'heure de la prévision à la
ferme, vérifiée au plus long contre les limites du Worker Web Push ; une
alerte à enregistrer par jour visé ; le clic ouvre
`/irrigation?season=…&week=<lundi>#weather`, que l'écran (PR 3) saura
ouvrir. Choix fait en codant, dans la ligne du contrat qui distingue la
modification de l'activation : activer ou désactiver un critère n'en fait
pas une nouvelle version, ses jours déjà alertés le restent ; toute autre
modification, libellé compris, en fait une. Scénarios chiffrés 1 à 7 du
contrat joués par les tests ; les scénarios 8 (isolation entre
exploitations) et 9 (aucun appareil abonné) le seront par les tests de
persistance de la PR 2. Rien n'est encore branché : ni base, ni envoi, ni
écran. Contrôles de départ sur `main` (`1009e54`) : lint, typage, 725 tests
et knip réussis. Contrôles sur la branche :
`pnpm lint` 0 erreur ; `pnpm typecheck` 0 erreur ; `pnpm test` 750 réussis
(725 au départ, 25 nouveaux) ; `pnpm build` réussi ; `pnpm knip` 0 export
inutilisé ; `pnpm push:check` 11 tests réussis et déploiement à blanc réussi ;
`pnpm weather:check` 2 tests réussis et déploiement à blanc réussi ;
`pnpm e2e` omis, sans rapport : la PR n'ajoute qu'un module de calcul que ni
l'interface ni ses services n'appellent encore.

Le 31 octobre 2026, **la PR #224 (5 bis, PR 1, le domaine) est fusionnée et
déployée** : fusion à 14 h 35 (`81da489`), déploiement terminé à 14 h 44
(run `41206298369`), quatre jobs réussis, application déployée, aucune migration,
Workers inchangés donc non redéployés.

Le 31 octobre 2026, 5 bis, PR 2a : la route d'envoi immédiat du Worker Web
Push (`/v1/notifications/send`, `docs/push-worker-contract.md`, « Envoi
immédiat »), demandée par le contrat des alertes météo. Authentifiée comme
les autres, mêmes limites de texte, même liste blanche d'adresses, même
déduplication par révision et par abonnement ; une première livraison tout
de suite, dont le résultat revient à l'application (`sent`, `no-subscriber`,
`retrying`, `failed`, avec le décompte par appareil) ; un échec transitoire
retenté par une alarme sous la même révision, douze tentatives au plus. Le
Worker compte désormais aussi les appareils déjà servis sous une révision.
Découpage : la PR 2 du contrat est faite en deux, le Worker d'abord, pour
qu'il soit déployé avant que l'application l'appelle. L'application ne
l'appelle pas encore (PR 2b). Contrôles sur la branche, partie de `main` à
`81da489` : `pnpm lint` 0 erreur ; `pnpm typecheck` 0 erreur ; `pnpm test`
750 réussis ; `pnpm build` réussi ; `pnpm knip` 0 export inutilisé ;
`pnpm push:check` 15 tests réussis (11 + 4 nouveaux) et déploiement à blanc
réussi ; `pnpm weather:check` 2 tests réussis et déploiement à blanc
réussi ; `pnpm e2e` omis, sans rapport : ni l'interface ni les services de
l'application ne changent.

Le 31 octobre 2026, **la PR #225 (5 bis, PR 2a) est fusionnée et déployée** :
fusion à 14 h 54 (`35f60cc`), déploiement terminé à 15 h 04 (run `41207698346`),
quatre jobs réussis, application et Worker Push redéployés, aucune migration.

Le 31 octobre 2026, 5 bis, PR 2b : l'enregistrement et l'envoi des alertes
météo. Migration `0022_weather_alerts` (additive, 50 tables) : températures
minimale et maximale prévues conservées dans
`irrigation_weather_daily_values`, nulles quand absentes et sans effacer une
valeur connue ; `irrigation_weather_alert_criteria` (exploitation, version
courante, actif, supprimé), `irrigation_weather_alert_criterion_versions`
(réglages immuables, bornes du contrat en contraintes) et
`irrigation_weather_alerts` (une par version et par jour visé, clé unique ;
valeur prévue, unité, date de la prévision, heure d'envoi, résultat).
`db/weather-alert-repository.ts` : critères (création en version 1,
modification en nouvelle version, activation sans version, suppression
logique), prévisions à évaluer, jours déjà alertés, alertes enregistrées en
attente avant l'envoi puis leur résultat. `lib/services/weather-alerts-service.ts` :
évaluation après chaque écriture réussie de prévisions, branchée sur la
synchronisation de 06 h 15 (`onForecastWritten`) et sur l'actualisation de
la météo de la semaine ; envoi par la route immédiate du Worker ; une panne
ne lève jamais et se journalise sans nommer personne. Le fournisseur de
démonstration donne désormais des températures (nuits à 2,6 et 4,2 °C) pour
le parcours de la PR 3. Contrats complétés : `docs/weather-contract.md`
(températures conservées), `docs/weather-alerts-contract.md` (activation sans
nouvelle version, résultat « nouvelle tentative », alerte enregistrée avant
l'envoi). Tests : `tests/db/weather-alerts.test.ts` (13, scénarios 1, 3, 4,
5, 7, 8 et 9, croisement de deux évaluations, panne de la base), sync
automatique, fournisseur, comptes de tables. Contrôles sur la branche :
`pnpm lint` 0 erreur ; `pnpm typecheck` 0 erreur ; `pnpm test` 765
réussis (750 + 15) ; `pnpm build` réussi ; `pnpm knip` 0 export
inutilisé ; `pnpm push:check` 15 tests réussis et déploiement à blanc
réussi ; `pnpm weather:check` 2 tests réussis et déploiement à blanc
réussi ; `pnpm e2e` 28 parcours réussis (ordinateur et 390 px), joué parce
que l'actualisation de la météo de la semaine change.

Le 31 octobre 2026, **la PR #226 (5 bis, PR 2b) est fusionnée et déployée** :
fusion à 15 h 18 (`6f66c57`), déploiement terminé à 15 h 25 (run `41209519645`),
quatre jobs réussis, migration `0022_weather_alerts` appliquée à la base
distante, application et Worker Push redéployés.

Le 31 octobre 2026, 5 bis, PR 3 : l'encart « Alertes météo », sous la
semaine de la météo (`app/irrigation/weather-alerts-panel.tsx`). La liste
des critères de l'exploitation, chacun dit en une phrase (« Température
minimale prévue en dessous de 5 °C (5 °C non compris), sur 3 jours,
aujourd'hui compris »), actif ou non, avec les jours de son horizon sans
prévision et sa dernière alerte ; l'ajout, la modification, l'activation et
la suppression, avec les refus du domaine champ par champ ; le rappel que
les alertes partent vers les appareils où elles sont activées, avec le lien
vers la carte d'activation quand cet appareil ne les reçoit pas
(`notification-status-signal.ts` partage l'état de l'appareil, la carte dit
désormais « fin du minuteur et alertes météo ») ; l'historique, plus récente
en premier, le critère tel qu'il était à l'envoi (D-006). La semaine de la
météo gagne la colonne « Températures prévues » et l'ancre `#weather` ; la
page lit `?week=` (`parseIrrigationWeek`), ce qu'ouvre le clic sur une
alerte. `lib/services/weather-alerts-view.ts` et l'historique de
`db/weather-alert-repository.ts` lisent l'encart ; `getWaterDashboardForUser`
ne le lit que pour l'écran de la météo (`includeWeatherAlerts`). Limite
constatée : l'actualisation manuelle ne lit la prévision que jusqu'au
dimanche de la semaine affichée ; un samedi ou un dimanche, les jours de
l'horizon au-delà sont dits « prévision indisponible » jusqu'à la
synchronisation de 06 h 15, qui lit 14 jours. Parcours navigateur P13
(`e2e/p13-alertes-meteo.spec.ts`, docs/browser-journeys-contract.md). Tests :
`tests/db/weather-alerts-view.test.ts` (5), phrase et libellés du domaine,
`parseIrrigationWeek`. Contrôles sur la branche :
`npm run lint` 0 erreur ; `npm run typecheck` sans erreur ; `npm test`
772 tests réussis sur 772 ; `npm run build` réussi ; `npm run knip` sans
signalement ; `npm run push:check` 15 sur 15 ; `npm run weather:check` 2 sur
2 ; `npx playwright test` 30 parcours réussis sur 30, P13 compris, sur
ordinateur et à 390 px.

Le 31 octobre 2026, **la PR #227 (5 bis, PR 3, l'écran) est fusionnée et
déployée** : fusion à 15 h 42 (`831c052`), déploiement terminé à 15 h 52
(run `41211363412`), quatre jobs réussis, aucune migration. Le code de la
5 bis est fait ; reste la recette réelle sur la ferme, sur le « vas-y » du
porteur.

Le 1er novembre 2026, **la PR #228 (D-055, le modèle Fable interdit, Opus 5.5
le remplace) est fusionnée et déployée** : fusion à 22 h 34 (`88f348d`),
déploiement terminé à 22 h 44 (run `41352670417`), quatre jobs réussis,
registres seulement.

Le 3 novembre 2026, **la PR #229 (D-056, profondeurs racinaires par stade
pour la réserve du sol) est fusionnée et déployée** : fusion à 12 h 32
(`eabea44`), déploiement terminé à 12 h 42 (run `41628297795`), quatre jobs
réussis, contrat et registres seulement.

Le 5 novembre 2026, 5 quater, PR 1 : le domaine du besoin en eau par culture
et par stade, codé le soir même sur le « vas-y » du porteur, en Opus 5.5 ·
Max, comme le prescrit la roadmap (#235, `lib/domain/crop-water/`, sept
modules).
`reference.ts` : les cultures de référence et leurs courbes (escalier du
CRIIAM, trapèze de la FAO-56 avec son coefficient d'abattement, calendrier
des pluriannuelles avec l'installation de l'artichaut), leurs jeux de saison
et leurs contrôles, chaque refus dit en phrase ; `species.ts` : la
correspondance des espèces, l'exception de la série primant sur l'espèce, la
liste « sans référence Kc » ; `crop-calendar.ts` : le jour 0, la présence, la
première, la dernière et la mi-récolte tirées des semaines d'Ouvre ta ferme ;
`stage.ts` : le stade du jour, calculé ou déclaré, avec son origine, sa date,
son changement suivant et l'attente d'une récolte inconnue ; `kc.ts` : le Kc
du jour, les surcharges de la ferme datées, l'abattement, le lissage ;
`etm.ts` : l'ET0 du jour et sa nature (réanalyse, estimée, prévue, jamais 0
quand elle manque), K_abri daté par abri, paillage, ombrage, l'ETM du jour
avec sa trace, les bornes qui bloquent le jour en le nommant ; `proposal.ts` :
le jour de planche (la plus haute ETM de ses cultures, partiel, inconnu ou
bloqué), la proposition de la semaine, son écart et ses alertes de
cohérence, la révision d'objectif de planche que crée l'adoption, valable
dès son jour, l'avertissement d'aspersion. Rien n'est encore branché : ni
base, ni écran, ni service ; aucun module existant ne change.

Deux règles du contrat se sont révélées contraires à l'intention du porteur
en codant ; posées une à une sur des cartes de décision, elles ont été
tranchées par lui le soir même, chaque fois sur l'option recommandée
(D-057) : un stade déclaré recale le calendrier des stades suivants au lieu
de le figer (23 h 27) ; la culture reste sur sa planche jusqu'au dimanche de
la plus tardive de ses semaines de récolte, réalisées ou attendues, aussi
pour la jauge de la 5 ter, le suivi par série gardant sa règle (23 h 30).
Contrats corrigés : `docs/crop-water-need-contract.md` (réponses, quinze
précisions faites en codant, scénarios 22 à 24) et
`docs/soil-reserve-contract.md` (fin d'une culture). Tests :
`tests/crop-water-stage.test.ts` (24), `tests/crop-water-etm.test.ts` (15),
`tests/crop-water-proposal.test.ts` (15), avec les cultures de référence des
scénarios dans `tests/support/crop-water-references.ts` ; les scénarios 1 à
13 et 15 à 24 du contrat joués, le 14, la non-régression, par la suite
existante, inchangée. Contrôles de départ sur `main` (`eabea44`) : lint,
typage, 772 tests et knip réussis. Contrôles sur la branche, le 6 novembre
2026 : `pnpm lint` 0 erreur ; `pnpm typecheck` 0 erreur ; `pnpm test` 826
réussis sur 826 (772 + 54) ; `pnpm build` réussi ; `pnpm knip` 0 export
inutilisé ; `pnpm push:check` 15 tests réussis et déploiement à blanc
réussi ; `pnpm weather:check` 2 tests réussis et déploiement à blanc réussi ;
`pnpm e2e` omis, sans rapport : la PR n'ajoute qu'un module de calcul que ni
l'interface ni ses services n'appellent encore.

Le 6 novembre 2026, **la PR #235 (5 quater, le domaine) est fusionnée et
déployée** : fusion à 00 h 25 (`01227cd`), déploiement terminé à 00 h 41
(run `42129119461`), quatre jobs réussis ; aucune migration, Workers
inchangés.

Le 6 novembre 2026, 5 quater, PR 2 : la persistance du besoin en eau par
culture et par stade, en Opus 5.5 · Élevé, comme le prescrit la roadmap.
Migration additive `0023_crop_water_need` : treize tables (cultures de
référence, leurs stades, jeux de saison, mois et débuts de stade ;
surcharges de Kc ; correspondance des espèces ; stades déclarés ; K_abri ;
paillage ; filets d'ombrage ; options ; ETM du jour), leurs contraintes,
six déclencheurs qui refusent de modifier ou d'effacer une surcharge, un
stade déclaré ou un K_abri, et le jeu commun de 32 cultures (dix-neuf du
CRIIAM, l'artichaut et le fraisier en deux types ; treize de la FAO-56) avec
la source, la date du relevé et la source des dates par défaut. Aucune table
existante n'est touchée, aucune donnée de la ferme n'est écrite. Dépôts :
`db/crop-water/references.ts` (le jeu commun, la version d'une ferme d'une
culture commune, ses Kc inchangés, ou sa culture saisie),
`db/crop-water/entries.ts` (surcharges, correspondances, stades déclarés),
`db/crop-water/settings.ts` (K_abri, paillage, filets, options),
`db/crop-water/etm-days.ts` (l'ETM du jour et sa trace),
`db/crop-water/inputs.ts` (ce que le calcul lit pour une exploitation et
une saison) ; règles d'enregistrement dans `lib/domain/crop-water/records.ts`
(ce qui empêche d'enregistrer une saisie, la ligne d'ETM d'un jour de
planche, rien pour un jour bloqué). Dix précisions faites en écrivant la
persistance, consignées dans le contrat, modifiables avant la PR de l'écran.
Tests de persistance : `tests/db/crop-water-references.test.ts` (10 : le
jeu commun relu chiffre pour chiffre contre le contrat et contre les
cultures des tests du domaine, la version d'une ferme, l'isolation, les
contraintes), `tests/db/crop-water-entries.test.ts` (6 : surcharges,
correspondances, déclarations et réglages, immuabilité, isolation),
`tests/db/crop-water-etm-days.test.ts` (6 : scénarios 1, 8 et 12 rejoués
depuis la base, ETM recalculée, jour bloqué, jours inconnus, contraintes) ;
le décompte des tables passe de 50 à 63 dans trois tests existants.
Migration appliquée aussi à une base locale par `pnpm db:migrate:local`
(Wrangler) : 32 cultures, 324 mois, 56 débuts de stade. Contrôles de départ
sur `main` (`01227cd`) : lint et typage réussis, 826 tests réussis.
Contrôles sur la branche, le 6 novembre 2026 : `pnpm lint` 0 erreur ;
`pnpm typecheck` 0 erreur ; `pnpm test` 848 réussis sur 848 (826 + 22) ;
`pnpm build` réussi ; `pnpm knip` 0 export inutilisé ; `pnpm push:check`
15 tests réussis et déploiement à blanc réussi ; `pnpm weather:check`
2 tests réussis et déploiement à blanc réussi ; `pnpm e2e` omis, sans
rapport : ni l'interface ni ses services ne changent (le job « Parcours
navigateur » de la PR le joue quand même, sur la base migrée).

Le 6 novembre 2026, **la PR #236 (5 quater, la persistance) est fusionnée et
déployée** : fusion à 01 h 16 (`0bb0fe1`), déploiement terminé à 01 h 24
(run `42135652593`), quatre jobs réussis, migration `0023_crop_water_need`
appliquée à la base en ligne. Le même jour, le porteur valide les quinze
précisions du domaine, posées une par une en seize questions, toutes sur la
recommandation de l'assistant (contrat, « Précisions faites en codant ») ;
rien n'est recodé.

Le 6 novembre 2026, **la recette réelle de la 5 bis (alertes météo) est
validée par le porteur** (« Oui, c'est bon, ça marche », 09 h 18, dans le fil
de la 5 bis) : critère franchi par la prévision, alerte reçue sur le
téléphone, clic ouvrant la bonne semaine. La 5 bis est close. L'alerte de
test « Recette 5 bis » est à supprimer par le porteur dans l'encart.

Le 6 novembre 2026, 5 quater, PR 3a : la page « Coefficients culturaux »,
sur le « vas-y » du porteur, en Opus 5.5 · Élevé, comme le prescrit la
roadmap. L'écran est découpé en trois PR (3a, 3b, 3c ; roadmap, section
5 quater). Cette première PR ajoute, en bas de la page d'irrigation, les
tables des cultures de référence de la ferme (source, Kc stade par stade,
débuts de stade par saison, durées des phases de la FAO, calendriers,
délais de levée, adresse et date du relevé, raisons d'une culture
inutilisable), la correspondance des espèces de la saison, par espèce avec
une exception possible par série et une analogie dite, et la liste « sans
référence Kc ». Aucune migration ; aucune donnée de la ferme n'est écrite.
Fichiers : `lib/services/crop-water-coefficients.ts`,
`app/irrigation/crop-water-actions.ts`,
`app/irrigation/crop-water/crop-coefficients-panel.tsx`,
`app/irrigation/crop-water/reference-crop-card.tsx`,
`app/irrigation/styles/crop-water.css`,
`lib/domain/crop-water/presentation.ts`, `seasonSpecies` dans
`lib/domain/crop-water/species.ts`. Quatre précisions faites en codant,
consignées dans le contrat (section datée de la PR 3a). Tests :
`tests/crop-water-presentation.test.ts` (4), `tests/db/crop-water-coefficients.test.ts`
(3), parcours `e2e/p14-coefficients-culturaux.spec.ts` aux deux largeurs.
Contrôles de départ sur `main` (`0bb0fe1`) : lint et typage réussis,
848 tests réussis. Contrôles sur la branche : voir la PR.

Le 6 novembre 2026, 5 quater, PR 3b : la fiche de la planche, dans la foulée
de la 3a, en Opus 5.5 · Élevé. Sous le plan, la planche choisie a son bloc
« Besoin de la culture » : stade du jour et prochain changement, Kc, ETM et
leur trace pour chaque culture ; objectif proposé de la semaine face à
l'objectif applicable, lu par la règle du besoin ; « Déclarer un stade » ;
« Adopter la proposition », recalculée par le serveur, pour une semaine qui
n'est pas finie, enregistrée comme révision ordinaire de l'objectif de la
planche avec son origine (migration additive `0024_adopted_goal_origin`),
suivie du recalcul du plan. « Objectif proposé » paraît sous l'objectif de
chaque planche dans « Besoins d'irrigation », place choisie par le porteur
le jour même (09 h 34) plutôt qu'une colonne du planning. La ferme de
démonstration porte des carottes en place le jour même sur V01. Fichiers :
`lib/services/crop-water-week.ts`, `lib/services/crop-water-bed.ts`,
`db/crop-water/adoptions.ts`, `app/irrigation/crop-water/bed-crop-water-panel.tsx`,
actions dans `app/irrigation/crop-water-actions.ts`. Sept précisions
consignées dans le contrat (section datée de la PR 3b). Tests :
`tests/db/crop-water-bed-sheet.test.ts` (6), libellés ajoutés à
`tests/crop-water-presentation.test.ts`, parcours
`e2e/p15-fiche-besoin-de-la-culture.spec.ts` aux deux largeurs ; 862 tests
réussis. Contrôles sur la branche : voir la PR.

Le 6 novembre 2026, **la PR #237 (5 quater, PR 3a) est fusionnée et
déployée** : fusion à 09 h 46 (`030e628`), déploiement terminé à 09 h 56 (run
`42190102920`, quatre jobs réussis, aucune migration). Sur la PR, le job des
parcours avait dépassé ses 15 minutes une fois : l'installation du
navigateur y a pris neuf minutes et demie au lieu de quinze secondes
d'habitude ; relancé une fois, il est passé. Le porteur a relu la table des
espèces le jour même sur une page de suggestions (09 h 41) ; les chicorées
ont fait l'objet d'une recherche documentaire
(`/mnt/project-files/besoin-par-culture/chicorees-kc-sources.md`).

Le 6 novembre 2026, **la correspondance des espèces de la ferme du porteur
est saisie**, dans son navigateur et sur son « vas-y » (10 h 15 à 10 h 20) :
ses 78 espèces, vérifiées après rechargement de la page. Les chicorées
frisée et scarole suivent la salade d'été par analogie, sur sa réponse
(10 h 15) à la recherche documentaire, qui leur donne les Kc de la laitue.
L'espèce « Ammi majus » de la table du 31 octobre n'existe pas dans ses
espèces d'Ouvre ta ferme. Le déploiement de #238 est arrivé pendant la
saisie (09 h 14 UTC) : la page ouverte a refusé un enregistrement, rejoué
après rechargement.

Le 6 novembre 2026, **la PR #238 (copie de la charte d'Ouvre ta ferme) est
fusionnée** à 10 h 03 (`0e7b367`) **et déployée** à 10 h 14 (run
`42192191159`, quatre jobs réussis), puis **la PR #239 (5 quater, PR 3b) est
fusionnée** à 10 h 22 (`0946a61`), une fois remise à jour de `main` et ses
trois jobs réussis, **et déployée** à 10 h 49 (run `42194501098`, quatre
jobs réussis, migration `0024_adopted_goal_origin` appliquée en ligne). Le
job des parcours y avait dépassé ses 15 minutes, l'installation du
navigateur ayant pris dix minutes et demie chez GitHub ; relancé une fois,
il est passé.

Le 6 novembre 2026, 5 quater, PR 3c : les surcharges de Kc et les réglages
du calcul, dans la foulée de la 3b, en Opus 5.5 · Élevé. Ce qui restait de
l'écran est découpé en 3c et 3d (durées propres à la ferme, fiche de la
série, avertissement de l'aspersion, ETM enregistrée chaque jour). Sur la
page « Coefficients culturaux », chaque culture de référence montre ses
surcharges à côté des valeurs de la source et se surcharge à partir d'un
jour, ou revient à la source ; « Réglages du calcul » règle les options,
le K_abri de chaque abri, le paillage plastique des planches de la saison
et les filets d'ombrage. Aucune migration : les dépôts de #236 servent tels
quels. Fichiers : `lib/domain/crop-water/settings-view.ts`,
`app/irrigation/crop-water/kc-overrides.tsx`,
`app/irrigation/crop-water/crop-water-settings.tsx`, actions dans
`app/irrigation/crop-water-actions.ts`. Huit précisions consignées dans le
contrat (section datée de la PR 3c). Tests :
`tests/crop-water-settings-view.test.ts` (6), un test ajouté à
`tests/db/crop-water-coefficients.test.ts`, parcours
`e2e/p16-surcharges-et-reglages.spec.ts` aux deux largeurs ; 869 tests
réussis. Contrôles sur la branche : voir la PR.

Le 6 novembre 2026, **la PR #240 (contrat des alertes météo par culture)
est fusionnée et déployée** (`d96b3f2`, déploiement terminé à 11 h 02, run
`42198493747`), puis **la PR #241 (5 quater, PR 3c) est fusionnée** à
11 h 15 (`995b1fb`). Sur #241, le job des parcours avait échoué une fois
sur P7 au téléphone (la bulle d'aide « Faisabilité préliminaire » détachée
à chaque clic), un parcours que la PR ne touche pas ; relancé une fois, il
est passé. **Son déploiement est bloqué** : sur `main`, le même job a
échoué sur la même bulle, P4 au téléphone, puis, relancé une fois, P4 à
l'ordinateur (run `42201231156`) ; le déploiement a été sauté. La
correction de la bulle part avec la PR 3d, et #241 se déploie avec elle.

Le 6 novembre 2026, 5 quater, PR 3d : l'ETM enregistrée chaque matin et
l'avertissement de l'aspersion en début de cycle, en Opus 5.5 · Élevé. Ce
qui restait de l'écran est découpé en 3d et 3e (fiche de la série, durées
propres à la ferme). Après la météo et le planning du matin, l'appel
interne de synchronisation enregistre l'ETM de chaque planche de chaque
ferme pour aujourd'hui et les sept jours d'avant (`recordEtmDaysForAllWorkspaces`,
`lib/services/crop-water-etm-record.ts`) ; la fiche de la planche avertit
d'un besoin probablement sous-estimé quand une aspersion arrose une
culture au premier stade du CRIIAM tous les trois jours ou moins
(`lib/services/crop-water-bed.ts`). Aucune migration. Cinq précisions
consignées dans le contrat (section datée de la PR 3d). Tests :
`tests/db/crop-water-etm-record.test.ts` (3), un test ajouté à
`tests/db/crop-water-bed-sheet.test.ts` ; 873 tests réussis. La PR corrige
aussi la bulle d'aide de la faisabilité (`FeasibilityHelp`,
`app/irrigation/irrigation-feasibility-dashboard.tsx`) : au téléphone, le
pointeur « quittait » la bulle dès que la page bougeait sous lui, et la
bulle se refermait avant le clic sur « Fermer » ; ouverte d'un clic ou d'un
toucher, elle reste maintenant ouverte jusqu'à « Fermer » ou Échap. C'est
ce qui faisait échouer par moments P4 et P7 au téléphone. Contrôles sur la
branche : voir la PR.

Le 6 novembre 2026, **la PR #242 (5 quater, PR 3d) est fusionnée** à
12 h 08 (`877019e`) **et déployée avec #241** : déploiement terminé à
12 h 20, les quatre jobs de `main` verts (run `42207955953`).

Le 6 novembre 2026, 5 quater, PR 3e : les durées propres à la ferme et la
fiche de la série, en Opus 5.5 · Élevé ; l'écran est complet. Sur la page
« Coefficients culturaux », « Régler les durées de la ferme » enregistre la
version de la ferme d'une culture commune
(`lib/domain/crop-water/farm-durations.ts`,
`lib/services/crop-water-durations.ts`,
`app/irrigation/crop-water/farm-durations.tsx`) ; dans la vue « Par
série », la carte d'une série montre la fiche de la série
(`lib/services/crop-water-series.ts`,
`app/irrigation/crop-water/series-crop-water-panel.tsx`). Aucune
migration. Huit précisions consignées dans le contrat (section datée de la
PR 3e). Tests : `tests/crop-water-farm-durations.test.ts` (5),
`tests/db/crop-water-durations.test.ts` (3),
`tests/db/crop-water-series-sheet.test.ts` (3), parcours
`e2e/p17-durees-et-fiche-de-la-serie.spec.ts` aux deux largeurs. Contrôles
sur la branche : voir la PR.

Le 6 novembre 2026, **la PR #243 (5 quater, PR 3e) est fusionnée** à
12 h 35 (`dfcfa09`) **et déployée** à 12 h 48, les quatre jobs de `main`
verts (run `42211436687`). Les trois précisions qui appelaient le choix du
porteur sont tranchées par lui de 13 h 35 à 13 h 37, dans le sens codé
(contrat, section de la PR 3e). Sur son « vas-y » de 15 h 04, **la recette
réelle de la 5 quater** est faite en lecture seule, dans le navigateur de
l'application sur son ordinateur (`docs/recette-5-quater.md`) : 32 cultures
utilisables, 78 espèces sur 78 rattachées, stades, Kc et ETM de quatre
séries justes à la main, rien qui déborde à 390 px. À juger par lui : en
novembre, ses objectifs saisis de 20 mm par semaine sont quatre à dix fois
plus hauts que le besoin calculé ; il répond à 15 h 11 qu'il ne s'en sert
pas ce mois-ci. Sur son accord, quatre gestes d'écriture sont ensuite
éprouvés dans le module puis défaits (paillage, options, durées du céleri,
adoption), état final relu identique ; un défaut d'affichage relevé : la
fiche de la planche ouverte n'est pas rafraîchie après un réglage.

Le 6 novembre 2026 à 15 h 07, **le porteur donne mandat** de réaliser seul
les quatre chantiers suivants de l'ordre — la 5 ter avec le seuil
d'arrosage réglable, la pastille « eau en trop », la 5 quinquies et la
refonte ergonomique —, en répondant lui-même à chaque question par l'option
recommandée (D-060) ; la 3.8 reste à faire avec lui, les règles de sécurité
restent entières. 5 ter, PR 1, le domaine, en une seule PR
(`lib/domain/soil-reserve/` : `soil.ts`, `rooting.ts`, `bare-soil.ts`,
`gauge.ts`, `signals.ts`) : la RFU du sol et la valeur propre d'un jardin,
la profondeur par stade et p, le seuil selon la culture ou réglé par
l'exploitation (D-059), la jauge jour par jour sur une planche cultivée et
sur une planche sans culture (modèle de sol nu en deux compartiments, états
de surface, engrais vert et enherbée), le départ, l'inconnue et son
redémarrage, les signaux (jour ou jours avant le seuil, dose conseillée,
arrêt avant récolte, drainage, dose au-delà de ce que le sol retient,
confiance, moyenne du jardin). Les quarante et un scénarios du contrat en
tests (`tests/soil-reserve-crop.test.ts`, 36 tests ;
`tests/soil-reserve-bare.test.ts`, 22 tests). Dix-sept précisions
consignées dans le contrat. Aucune migration, aucun écran. La PR rend aussi
plus sûrs P4 et P7 au téléphone, qui échouaient encore par moments sur la
bulle d'aide « Faisabilité préliminaire » (deux fois de suite sur sa
branche) : quand la page bouge encore sous le pointeur, le bouton enfoncé
n'est plus sous lui au relâché, il n'y a pas de clic, la bulle n'est ouverte
que par le survol et se referme au premier défilement. Les deux parcours
écartent maintenant le pointeur et ne continuent qu'avec une bulle restée
ouverte, donc épinglée (`epinglerLaBulle`, `e2e/support/parcours.ts`).
Le job des parcours passe enfin de 15 à 25 minutes : sur cette branche, il a
été coupé deux fois de suite, l'installation du navigateur ayant pris dix
minutes chez GitHub, et les parcours en prennent onze ; le même retard
l'avait coupé sur #237, #239 et #178.
Contrôles sur la branche : voir la PR.

Le 6 novembre 2026, 5 ter, PR 2, la persistance, sur le même mandat :
migration additive 0025 (`drizzle/0025_soil_reserve.sql`), sept tables —
le sol par parcelle et les valeurs propres, les profils racinaires et leurs
lignes par stade, les états de surface, les réglages de l'exploitation, les
observations du curseur, l'état du jour —, douze déclencheurs d'immuabilité
et le jeu commun de trente et un profils racinaires (D-053, D-056) ; aucune
valeur de sol écrite, chaque ferme saisit la sienne. Dépôts
`db/soil-reserve/entries.ts`, `inputs.ts`, `days.ts` ; règles
d'enregistrement dans `lib/domain/soil-reserve/records.ts`. Dix précisions
consignées dans le contrat. Tests :
`tests/db/soil-reserve-persistence.test.ts` (13). Aucun écran. Contrôles
sur la branche : voir la PR.

Le 6 novembre 2026, 5 ter, PR 3a, les réglages du sol, sur le même mandat :
un pli « Réglages du sol » dans un bloc « Réserve du sol » de la section
« Planning de la semaine » (`app/irrigation/soil-reserve/`), avec ses deux
actions (`app/irrigation/soil-reserve-actions.ts`), la vue
(`lib/domain/soil-reserve/settings-view.ts`) et son service
(`lib/services/soil-reserve-view.ts`). Par parcelle de la saison : la RFU du
laboratoire, les cailloux et la RFU du sol calculée pendant la saisie,
l'avertissement de vraisemblance, la part de référence en fraction, TEW, REW,
Ze, le plafond de sol, la provenance, la source, le jour à partir duquel la
saisie vaut ; par jardin ou abri, sa valeur propre ; pour l'exploitation, le
seuil d'arrosage (D-059), les coefficients des états de surface et la part de
pluie sous paillage plastique. Huit précisions consignées dans le contrat.
Tests : `tests/soil-reserve-settings-view.test.ts` (3) ; parcours P18 aux
deux largeurs (`e2e/p18-reglages-du-sol.spec.ts`). Aucune migration.
Contrôles sur la branche : voir la PR.

Le 6 novembre 2026, 5 ter, PR 3b, le bloc « Réserve du sol » par jardin, sur
le même mandat : la jauge de chaque planche de la saison en cours, d'un départ
jusqu'à dimanche (`lib/services/soil-reserve-view.ts`), à partir de ce
qu'elle lit des autres modules (`lib/domain/soil-reserve/gauge-inputs.ts` :
la pluie du jour, les irrigations réalisées, planifiées et proposées, le
premier jour à suivre) et la vue par parcelle, jardin et planche
(`lib/domain/soil-reserve/gauge-view.ts`) ; à l'écran
(`app/irrigation/soil-reserve/soil-gauge.tsx`, `soil-bed.tsx`), le curseur
de la parcelle et celui de chaque jardin ou abri, le % du plein de
maintenant, le prévu jusqu'à dimanche, le détail d'une planche avec ses
signaux et ses mentions, l'état de surface d'une planche sans culture, avec
deux actions de plus. Une précision du domaine : un jour qui manque est nommé
sur une planche observée. Neuf précisions consignées dans le contrat. Tests :
`tests/soil-reserve-gauge-inputs.test.ts` (4),
`tests/db/soil-reserve-view.test.ts` (4) ; parcours P19 aux deux largeurs
(`e2e/p19-jauge-du-sol.spec.ts`) ; P18 ne vérifie plus l'état de départ
« Aucune RFU saisie », que P19 laisse rempli. Aucune migration. Contrôles sur
la branche : voir la PR.

Le 6 novembre 2026, 5 ter, PR 3c, les profils racinaires, sur le même
mandat : dans la carte de chaque culture utilisable de la page « Coefficients
culturaux », un bloc « Racines et part utilisable »
(`app/irrigation/crop-water/rooting-profile.tsx`) avec la part p et la
profondeur de chaque stade qui comptent, le jeu commun rappelé à côté d'un
profil de la ferme, l'histoire de ses profils et un formulaire qui enregistre
un profil entier à partir d'un jour ; la vue
(`lib/domain/soil-reserve/rooting-view.ts`), les profils dans le service de
la page et une action de plus. Cinq précisions consignées dans le contrat.
Tests : `tests/soil-reserve-rooting-view.test.ts` (3),
`tests/db/crop-water-coefficients.test.ts` (un de plus) ; parcours P20 aux
deux largeurs (`e2e/p20-profils-racinaires.spec.ts`). Aucune migration.
Contrôles sur la branche : voir la PR.

Le 6 novembre 2026, 5 ter, PR 3d, l'état du jour et la dose au-delà du sol,
sur le même mandat, qui termine l'écran de la 5 ter : chaque matin, après la
météo et l'ETM, l'état des sept jours d'avant de chaque planche est
enregistré (`lib/services/soil-reserve-record.ts`, appelé par la route
interne de la météo) ; sous chaque proposition encore proposée du plan de la
semaine, les mm qui dépassent ce que le sol peut encore retenir, perdus en
drainage (`lib/domain/soil-reserve/proposal-soil.ts`, calculés par le
service de la réserve du sol au chargement de la page). Deux précisions
consignées dans le contrat. Tests : `tests/soil-reserve-proposal-soil.test.ts`
(3), `tests/db/soil-reserve-record.test.ts` (3),
`tests/db/soil-reserve-view.test.ts` (un de plus). Aucune migration, aucun
parcours nouveau. Contrôles sur la branche : voir la PR.

Le 6 novembre 2026, la pastille « eau arrosée en trop », sur le même mandat
(idée 8 de la comparaison avec Tlaloc, placée par le porteur juste après la
5 ter) : en tête du bloc « Réserve du sol »
(`app/irrigation/soil-reserve/water-surplus.tsx`), l'eau d'irrigation des
sept derniers jours que le sol n'a pas pu retenir, en tout et par planche, en
mm et en m³ (`lib/domain/soil-reserve/water-surplus.ts`), le drainage d'un
jour partagé entre la pluie et l'irrigation au prorata de leurs mm ; une
planche arrosée un jour de jauge inconnue dite à part. Sept points consignés
dans le contrat de la 5 ter. Tests : `tests/soil-reserve-water-surplus.test.ts`
(4), `tests/soil-reserve-gauge-inputs.test.ts` et
`tests/db/soil-reserve-view.test.ts` complétés. Aucune migration. Contrôles
sur la branche : voir la PR.

Le 6 novembre 2026, 5 quinquies, PR 1, le domaine des alertes météo par
culture, sur le même mandat (`lib/domain/crop-alerts/` : `thresholds.ts`,
`settings.ts`, `presence.ts`, `frost.ts`, `drying.ts`, `sprinkler.ts`,
`text.ts`) : le seuil de gel d'un sujet, espèce ou exception de série, par
la révision la plus récente de son rattachement, la marge de 3 ou 2 °C et le
curseur de microclimat ; la présence d'une culture au jour visé ; les jours
de gel de l'horizon, la clé qui empêche la répétition et les textes ; l'arrêt
d'arrosage avant récolte, la semaine de récolte encore attendue et les
séries échues ; le lever et le coucher du soleil (FAO-56) et les aspersions
de jour sous abri à reconsidérer ; les réglages par défaut et leurs bornes.
Huit précisions consignées dans le contrat. Tests :
`tests/crop-alerts-frost.test.ts` (15),
`tests/crop-alerts-harvest-sprinkler.test.ts` (11),
`tests/crop-alerts-settings.test.ts` (6). Aucune migration, aucun écran,
aucun envoi. Contrôles sur la branche : voir la PR.

Le 6 novembre 2026, 5 quinquies, PR 2, la persistance et l'envoi, sur le même
mandat : migration additive 0026 (`drizzle/0026_crop_alerts.sql`), cinq
tables — le jeu commun des seuils, les rattachements de la ferme, ses délais
de séchage, ses réglages, les alertes enregistrées — et la colonne de
l'énergie solaire prévue du jour, lue chez Visual Crossing avec les
températures ; les trois tables de la ferme refusent toute modification ou
effacement (D-006). Dépôts `db/crop-alerts/inputs.ts` et `alerts.ts` ;
service `lib/services/crop-alerts-service.ts`, appelé par la route interne
de la météo après chaque écriture de prévisions (gel, aspersions) et chaque
matin (séchage), et par le recalcul du planning (aspersions). Une alerte est
enregistrée avant l'envoi, sous des clés uniques, puis reçoit le résultat de
l'envoi ; aucun appel nouveau vers Ouvre ta ferme, les séries étant lues
dans le dernier instantané en cache. Huit précisions consignées dans le
contrat. Tests : `tests/db/crop-alerts.test.ts` (8, dont le scénario 13) ;
nombre de tables passé à 75 dans les tests d'export et de migration. Aucun
écran. Contrôles sur la branche : voir la PR.

Le 6 novembre 2026, 5 quinquies, PR 3, l'écran, sur le même mandat : l'encart
« Alertes cultures » (`app/irrigation/crop-alerts-panel.tsx`) sous l'encart
« Alertes météo », lu avec le tableau de bord de l'eau
(`lib/services/crop-alerts-view.ts`, `lib/domain/crop-alerts/view.ts`) :
les réglages et le curseur de microclimat, les prochaines échéances calculées
sur les prévisions conservées (gel, arrêt d'arrosage, aspersions), les seuils
de gel des cultures présentes ou à venir de la saison avec leur correction,
les cultures sans seuil et leur rattachement, les délais de séchage, et
l'historique des vingt dernières alertes. Trois actions de plus
(`app/irrigation/water-actions.ts`), qui refusent une espèce ou une série
absente du plan de culture lu. Huit précisions consignées dans le contrat.
Tests : `tests/crop-alerts-view.test.ts` (4), `tests/db/crop-alerts.test.ts`
(un de plus) ; parcours P21 aux deux largeurs
(`e2e/p21-alertes-cultures.spec.ts`). Aucune migration. Contrôles sur la
branche : voir la PR.

Le 6 novembre 2026, recette réelle de la 5 ter et de la pastille « eau
arrosée en trop », sur le « vas-y » du porteur, dans le navigateur de
l'application Claude sur son ordinateur (`docs/recette-5-ter.md`) : Ouvre
ta ferme en lecture seule ; deux enregistrements faits sur ses réponses et
gardés, le sol de la parcelle Clémentière (62 mm/m, 18 % de cailloux,
51 mm/m) et une observation de 50 % du plein champ ; cinq planches
recalculées à la main, justes. Défaut trouvé : « maintenant » refusé comme
futur, l'horloge de l'ordinateur avançant de 13 s sur celle du serveur.
Corrigé le soir même, option recommandée de la question posée au porteur
(D-060) (`soilObservationTimeAt` dans
`lib/domain/soil-reserve/records.ts`, appelée par
`addSoilObservationForUser`) : comme pour la date d'une pose (point ouvert
47), une avance de deux minutes au plus vaut l'heure du serveur ; au-delà,
l'heure reste refusée. Test dans `tests/db/soil-reserve-persistence.test.ts`.
Aucune migration. Contrôles sur la branche : voir la PR.

Le 6 novembre 2026, recette réelle de la 5 quinquies, commencée sur le
« vas-y » du porteur : à sa réponse, ses 24 légumes rattachés au jeu commun
(gardés) ; la vraie alerte de gel du dimanche 8 novembre, produite par
« Actualiser la météo » à 22 h 47, a été refusée par le Worker Push et
enregistrée « Échec du service de notification » : l'étiquette d'une
notification nommant plusieurs cultures portait une virgule, et les textes
de l'aspersion et des séchages groupés pouvaient dépasser 160 caractères.
Corrigé le soir même (`lib/domain/crop-alerts/push.ts`) : l'étiquette est
le préfixe suivi d'une empreinte stable des sujets ; le texte tient dans
160 caractères (note d'abri raccourcie, puis effacée devant les noms ;
seuils de l'aspersion retirés ; sinon coupe au dernier mot). Tests :
`tests/crop-alerts-push.test.ts` (5), chaque notification passée au
contrat du service d'envoi. Aucune migration ; le Worker Push ne change
pas. Contrôles sur la branche : voir la PR.

Le 6 novembre 2026, toujours à la recette réelle de la 5 quinquies, la
réception sur le téléphone du porteur : l'alerte de gel, renvoyée à 23 h 56
puis à 00 h 02 (rattachement de la tomate réenregistré à l'identique, à sa
demande), arrive, mais seulement au réveil du téléphone (00 h 09 pour
00 h 02, sans sonnerie), et la toucher ferme la notification sans ouvrir le
module. Corrigé : le Worker Web Push envoie chaque notification avec
l'en-tête `Urgency: high` de la RFC 8030 (`PUSH_DELIVERY_OPTIONS` dans
`cloudflare/irrigation-push/src/delivery.ts`) ; le service worker
(`public/irrigation-notifications-sw.js`) amène le module au premier plan
avant de charger la page annoncée, avec repli sur une nouvelle fenêtre.
Tests : le service worker tourne dans un bac à sable
(`tests/irrigation-notifications-sw.test.ts`, cinq des six tests échouent
sur l'ancien code) ; l'option et l'en-tête `Urgency` sont vérifiés côté
Worker. Contrats : `docs/push-worker-contract.md` (« Priorité et toucher »)
et `docs/weather-crop-alerts-contract.md` (points 4 et 5 des précisions de
la recette). Le Worker Push est redéployé ; aucune migration. Contrôles sur
la branche : voir la PR.

Le 6 novembre 2026, refonte ergonomique, premier temps (R1), sur le même
mandat : les jetons de la charte du module dans `app/globals.css`, les trois
polices hébergées (`public/fonts/`, chacune avec son `OFL.txt`, déclarées
dans `app/fonts.css`), le fond de page, les grandes sections blanches sans
bordure (`app/irrigation/styles/charte.css`, importée en dernier), les gris
et les verts ramenés à ceux de la charte, le rayon unique et les deux ombres
dans les feuilles de `app/irrigation/styles/`. Charte et neuf précisions
consignées dans `docs/charte-module.md`. Aucun changement de calcul ni de
texte, aucune migration. Contrôles sur la branche : voir la PR.

Le 6 novembre 2026, refonte ergonomique, deuxième temps (R2), sur le même
mandat : les quatre sortes de boutons de la charte (principal, secondaire,
outil, destructif) dans les feuilles de `app/irrigation/styles/`, les
onglets, les tableaux et les tuiles de totaux ; les deux tuiles de pluie du
tableau de bord de l'eau en bleu eau (classe `is-water` dans
`app/irrigation/water-management-dashboard.tsx`). Cinq précisions
consignées dans `docs/charte-module.md`. Aucun changement de calcul ni de
texte, aucune migration. Contrôles sur la branche : voir la PR.

Le 6 novembre 2026, refonte ergonomique, troisième temps (R3), sur le même
mandat : les couleurs d'état de la charte (attention, erreur, réussite,
information) et le bleu eau dans les feuilles de `app/irrigation/styles/`,
hors feuilles du plan ; les icônes au trait (`app/irrigation/icon.tsx`) pour
la coche des données protégées et le « + » des boutons d'ajout. La
navigation de la charte revient à la 3.8. Cinq précisions consignées dans
`docs/charte-module.md`. Aucun changement de calcul ni de texte, aucune
migration. Contrôles sur la branche : voir la PR.

Le 7 novembre 2026, fin de la recette réelle de la 5 quinquies, sur la
demande du porteur de retenter l'alerte (`docs/recette-5-quinquies.md`) :
après #260, la même alerte « Gel · Tomate » du dimanche 8 novembre est
renvoyée trois fois (rattachement de la tomate réenregistré à l'identique,
puis « Actualiser la météo »). À 12 h 02, la toucher ouvre le module ; à
12 h 04, elle arrive sur le téléphone verrouillé à la minute de l'envoi, mais
sans son ; à 12 h 18, quatorze minutes plus tard, elle arrive et sonne. Les
réglages du téléphone, regardés par le porteur entre-temps, étaient déjà
bons : le silence de 12 h 04 vient sans doute de deux notifications de
Chrome en deux minutes, non vérifié. Les trois défauts de la recette sont
corrigés et constatés ; aucun code changé. Contrôles sur la branche : voir
la PR.

Le 7 novembre 2026, sur le choix du porteur de corriger trois petits défauts
avant la 3.8, chacun dans sa PR, le premier : l'icône de la page. Trouvé au
contrôle de départ de la 3.8, dans un navigateur complet : nommé
`app/irrigation/icon.tsx` depuis #264, le composant des icônes au trait
suivait la convention des fichiers de métadonnées du cadre (Next, repris
par vinext). Le build en faisait une route d'image `/irrigation/icon` et
chaque page y renvoyait par `<link rel="icon">` ; la route répondait 404.
Le navigateur sans tête des parcours ne demande pas les icônes : aucun
contrôle ne le voyait. Avant #264, la page ne déclarait aucune icône ; elle
n'en déclare de nouveau aucune. Le composant devient
`app/irrigation/line-icon.tsx`, ses trois imports suivent ; un test
(`tests/app-metadata-files.test.ts`) interdit ces noms sous `app/`, rouge
avant le renommage ; P0 demande lui-même les icônes et le manifeste que la
page déclare et exige une réponse 200 (contrat des parcours complété), rouge
avec l'ancien fichier (« /irrigation/icon… ne répond pas, attendu 200, reçu
404 »). Aucun calcul, texte ni migration changé. Contrôles sur la branche :
lint 0, typecheck 0, test 1040/1040, build, knip 0, push:check et
weather:check réussis (déploiement à blanc), parcours navigateur 46/46
(navigateur sans tête préinstallé du conteneur, la version épinglée n'y
étant pas). Le constat sur le site, que la page ne déclare plus d'icône,
reste à faire dans le Chrome du porteur, avec son accord.

Le 7 novembre 2026, deuxième des trois petites corrections choisies par le
porteur avant la 3.8 : les cartes « Annulée » du planning. Détail relevé à la
recette de la 3.7 : une proposition validée dont l'arrosage a été annulé
gardait le trait vert des validées, et sa pastille avait le gris de la feuille
(`--sheet`), presque blanc sur la carte. Choix du porteur : « comme une
refusée, pastille visible », puis « toutes pareilles » pour les autres
pastilles pâles. CSS seul : la carte annulée prend le trait gauche gris et le
texte atténué des refusées ; les pastilles Expirée, Refusée, Remplacée et
Annulée du planning, et Annulée des arrosages enregistrés, passent en gris
moyen (`--line`), bordées (`--line-strong`), texte `--ink2` (contraste
4,7:1) ; leur règle quitte `planning.css` (599 lignes) pour
`planning-follow-up.css`. Deux tests dans
`tests/irrigation-accessibility.test.ts`, rouges sur `main`. La pastille
« Planifiée » des arrosages à venir garde le gris de la feuille : elle compte
encore, elle reste hors de ce choix. Aucun calcul, texte ni migration changé.
Contrôles sur la branche : lint 0, typecheck 0, test 1042/1042, build, knip 0,
push:check et weather:check réussis (déploiement à blanc), parcours
navigateur 46/46 (navigateur sans tête préinstallé du conteneur). Le constat
sur le site reste à faire dans le Chrome du porteur, avec son accord.

Le 7 novembre 2026, troisième et dernière des petites corrections choisies
par le porteur avant la 3.8 : le champ « Millimètres » de la pluie mesurée.
Détail relevé à la recette de la 3.7 : pour un jour déjà mesuré, le champ
restait vide, la valeur ne se lisant que dans le tableau de la semaine. Choix
du porteur : « la mesure déjà saisie ». `manualRainInput`
(`lib/domain/water-management.ts`) donne la mesure du jour à la virgule,
« 0 » compris, vide sans mesure, et rien hors de la semaine chargée ; le
champ la montre à l'ouverture, au changement de date et après « Enregistrer »
ou « Retirer la mesure » ; pour un jour d'une autre semaine, la semaine
affichée suit. Un test à quatre cas dans `tests/water-management.test.ts`,
rouge sur `main` ; P12 vérifie le champ à la fin de sa remise en état (contrat des
parcours complété). Aucun calcul ni migration changé. Contrôles sur la
branche, après #268 : lint 0, typecheck 0, test 1043/1043, knip 0 ;
parcours navigateur 46/46 avant la fusion de #268, qui ne touche que des
styles (navigateur sans tête préinstallé du conteneur). Le constat sur le
site reste à faire dans le Chrome du porteur, avec son accord.

Le 7 novembre 2026, la 3.8, PR 6 : les bulles « d'où vient ce chiffre »
(`docs/feature-selection-contract.md`, section 6, P34, P35). Un petit « i »
à côté d'un chiffre principal ouvre le calcul dit avec les valeurs de la
ferme : le besoin réel d'une planche et la pluie réelle du jour ; la durée,
la part de chaque planche et le volume d'une proposition du planning, et le
manque d'une planche non placée ; le % du plein et le seuil d'une planche ;
l'ETM du jour et l'objectif proposé ; le seuil de gel d'une culture ;
l'apport horaire d'une planche ; la durée d'un arrosage en préparation ; le
débit en fonctionnement d'une ressource et le disponible après planification
d'une réserve ; l'apport d'irrigation en mm de l'historique. La bulle ne
refait aucun calcul : son texte est écrit dans le domaine du calcul, avec
les valeurs qu'il a gardées et les arrondis de l'écran ; un test par bulle
(`tests/figure-origin.test.ts`). Sur ordinateur, elle se pose sous son
bouton dans la fenêtre et le suit ; sur téléphone, au-dessus de la bande de
pages. Parcours P24 : le « ? » des onze pages et deux bulles. #275 (PR 5)
fusionnée à 17 h 41 et déployée à 17 h 50, run 42392529016.

Le 7 novembre 2026, la 3.8, PR 5 : le « ? » de chaque page et les
notifications vers les pages (`docs/feature-selection-contract.md`,
section 6, P32, P33). À côté du titre de chaque page, un « ? » ouvre à quoi
sert la page, comment la lire et par où commencer ; il se referme par le
même bouton, « Fermer » ou Échap. Les onze textes sont réunis dans
`lib/domain/features/help.ts`, à relire par le porteur en ligne. Chaque
notification ouvre la page de la case qui l'envoie : la fin d'un arrosage
ouvre Arrosages, le gel et le séchage Alertes cultures, une alerte météo
Alertes météo, l'aspersion à reconsidérer et la notification du matin le
Planning (P32) ; les anciennes adresses restent conduites. #274 (PR 4)
fusionnée à 17 h 15 et déployée à 17 h 27, run 42390377633, Worker de
notification redéployé.

Le 7 novembre 2026, la 3.8, PR 4 : les traitements et les notifications
suivent le choix (`docs/feature-selection-contract.md`, section 7, P4, P8,
P28 à P31). Chaque traitement du matin ne vise que les fermes qui ont coché
sa case (`listFarmsWithFeature`) : le relevé météo (P4), l'ETM (Besoin par
culture), l'état du sol (Réserve du sol), le recalcul du plan et la
notification du matin (Planning), le séchage avant récolte (Alertes
cultures) ; les alertes météo et les alertes cultures d'une ferme qui a
décoché leur case ne partent plus, ni la reconsidération des aspersions
sans sa partie. Ressources et pompes décochée, le planning reçoit des
ressources et des pompes vides et fait ce qu'il fait pour une ferme sans
pompe, et une irrigation saisie ne reçoit ni pompe par défaut ni blocage
hydraulique (P30). Décocher Arrosages retire les alarmes à venir du Worker
de notification (P29). Un changement des cases recalcule le plan de la
semaine avant la réponse, sans passer par la file des événements du plan
(P28). Le Worker de notification et le service worker acceptent les
adresses `/irrigation/<page>` (P31) ; les adresses changent avec la PR 5.
#273 (PR 3) fusionnée à 16 h 49 et déployée à 17 h 00, run 42388264208.

Le 7 novembre 2026, la 3.8, PR 3 : le choix des fonctionnalités à l'écran
(`docs/feature-selection-contract.md`, sections 3 et 4, R1 à R9, P22 à P27).
Une ferme qui ouvre le module pour la première fois choisit ses cases sur la
page Bienvenue avant d'entrer ; une ferme d'avant la 3.8 garde tout coché et
voit le bandeau qui l'invite à choisir, fermé d'un geste. Dans Réglages,
chaque case s'applique d'un geste (cocher nomme d'abord ce qu'elle entraîne,
décocher une case qui a des données ouvre l'avertissement qui dit ce qui
reste enregistré, `db/feature-data-counts.ts`). Une case décochée retire sa
page, son entrée du menu et ses blocs sur les autres pages (P26) ; ses
données restent. Une page non cochée ouverte par son adresse renvoie vers
la première page cochée, avec un avis. La correspondance des espèces et les
notifications du téléphone se règlent dans Réglages (P24, P25). Parcours
P22 (première ouverture et choix) et P23 (décocher puis recocher avec une
dépendance). #272 (PR 2) fusionnée à 16 h 19 et déployée à
16 h 30, run 42385826439.

Le 7 novembre 2026, la 3.8, PR 2 : une page par fonctionnalité
(`docs/feature-selection-contract.md`, section 5). Onze pages sous
`/irrigation/…` et un gabarit commun (`app/irrigation/shell/`) : l'en-tête,
le menu de la charte à gauche sur ordinateur, la bande de pages en bas sur
téléphone, la lecture d'Ouvre ta ferme, la saison et la parcelle gardées dans
l'adresse (P12). Chaque page ne charge que ses données
(`app/irrigation/page-loaders.ts`) ; temps serveur médian mesuré en local
(journal `irrigation_page_loaded`) : 178,5 ms pour l'ancienne page unique,
20,5 ms pour Matériel et placement, de 17 à 82 ms pour les autres pages. Les
blocs gardent leur ordre (P13) ; le tableau de l'eau se partage entre
Objectifs et besoins, Arrosages et Réglages (P15 à P17) ; les gestes d'une
page à l'autre passent par l'adresse, lue une fois (P18) ; les anciennes
adresses `/irrigation#…` mènent à la bonne page (P14, P21) ; le planning
relit un recalcul en cours à son ouverture (P20). Les 21 parcours vont à la
page qui porte leur bloc. #271 (PR 1) fusionnée à 15 h 52 et déployée
à 16 h 05, run 42383665657, migration 0027 appliquée.

Le 7 novembre 2026, la 3.8, PR 1 : la liste des fonctionnalités et
l'enregistrement du choix (`docs/feature-selection-contract.md`, sections 2 à
4 et 7). `lib/domain/features/` porte les dix cases et leurs dépendances, la
fermeture (« cocher entraîne le nécessaire »), le refus de décocher une case
nécessaire ou la dernière, la résolution du choix (première ouverture, ferme
d'avant la 3.8 toute cochée avec le bandeau, case nouvelle décochée et
annoncée), le socle et les parties de case, le texte des avertissements, les
adresses des pages et la conduite des anciennes adresses des notifications
(l'ancre `#weather` mène d'abord aux besoins, P21). Migration additive
`drizzle/0027_feature_selections.sql` : une ligne par espace d'irrigation,
cases cochées, cases connues, date du dernier choix, date de la fermeture du
bandeau (P9). `db/feature-selection-repository.ts` lit sans rien créer ;
`lib/services/feature-selection-service.ts` rend le choix résolu. Sans effet
visible : rien ne le lit encore. #270 (le contrat) déployée à 15 h 36,
run 42381207173. Contrôles : `pnpm lint`, `typecheck`, `test` (1063 sur 1063),
`knip`, `build`, `push:check`, `weather:check` réussis ; parcours navigateur
46 sur 46.

Le 7 novembre 2026, le contrat de la 3.8 (D-067). Le porteur redéfinit la
3.8 à 12 h 24 : plus de mode simple ou complet, un seul mode, des
fonctionnalités à la carte, « un logiciel avec un affichage et des
fonctionnalités à la carte » ; il répond à douze questions (annexe A du
contrat), confie les autres à la recommandation (13 h 16), puis demande que
toute la 3.8 soit construite en autonomie jusqu'au déploiement, sans
maquette (13 h 47) : il juge l'ergonomie sur le site en ligne. Le contrat
(`docs/feature-selection-contract.md`) fixe les dix cases et leurs
dépendances, le socle, les règles du choix, les pages et la navigation, l'aide
contextuelle, la preuve de fin, le découpage en sept PR et vingt et une
précisions. `docs/DECISIONS.md` (D-067), `docs/ROADMAP.md` (la 3.8 commencée,
le point 23, le bloc de la 3.8, le point 4 de la section 6 quater) et
`docs/irrigation-calculator-contract.md` (le calculateur deviendra une case)
suivent. Aucun code. Contrôles : PR de documentation seule, aucun rejoué
localement ; la CI les rejoue.

Le 7 novembre 2026, relecture visuelle de la refonte ergonomique par le
porteur, et deuxième passe décidée (D-068). Son retour : l'ensemble lui
plaît et se lit bien, mais il ne voit pas de vrai changement, ni le
rapprochement attendu avec la charte d'Ouvre ta ferme. Vérifié le jour
même : sur le site en ligne, les trois polices de la charte sont chargées,
le fond est gris neutre, les titres en Bricolage Grotesque ; des captures de
la même page avant la refonte (`e4a4d0d`), après elle (`dc9ae36`) et après
la 3.8, PR 6 (`8869646`), prises par les parcours navigateur sur les données
de démonstration (`/mnt/project-files/refonte-avant-apres/`), montrent que
seuls le grand titre et la teinte du fond changent à l'œil : le module avait
déjà un vert presque identique à celui d'OTF, et la refonte, CSS seul, ne
déplaçait rien. Sur son choix « maquette d'abord, code après la 3.8 », une
maquette de la page « Matériel et placement » à l'ordinateur et au téléphone
(canvas « Module d'irrigation à la manière d'OTF », sources dans
`/mnt/project-files/refonte-avant-apres/maquette/`), validée par lui telle
quelle (« Oui, comme ça »). Rien n'est codé ; aucun contrôle de code
rejoué : voir la PR.

Le 7 novembre 2026 au soir, deuxième passe de la refonte (R4, D-068) codée,
une fois la PR 7 de la 3.8 déployée (#278, 22 h 28), en Opus 5.5 sur le choix
du porteur (« juste après la clôture de la 3.8 »). Une barre du haut commune
(`app/irrigation/shell/topbar.tsx`), le reste dans les feuilles de style ;
précisions du code consignées dans `docs/charte-module.md`, « Deuxième
passe ». Les onze pages capturées aux deux largeurs sur les données de
démonstration, et la page « Matériel et placement » comparée à la maquette
(`/mnt/project-files/refonte-avant-apres/r4/`). Contrôles rejoués
localement : lint, typage, tests (1 107 réussis), compilation, knip, Worker
Push (18 réussis) et planificateur météo (2 réussis) ; parcours navigateur :
56 réussis aux deux largeurs (lancés avec le navigateur installé dans le
conteneur). Au premier passage, le parcours P24 a refusé le « ? » de la page
à 28 px, sous la cible de 44 px : le rond est désormais dessiné dans un
bouton de 44 px, et le parcours passe. Reste la relecture du porteur.

Le 8 novembre 2026, la nuit, la 3.8 ter, PR 1 sur 5 : le module de domaine
des créneaux protégés nommés (`lib/domain/planning/protected-slots.ts`), sur
le mandat du porteur (« Cette nuit, je veux que tu enchaînes les chantiers en
autonomie »), en Opus 5.5 · Max, le réglage de la ligne 3.8 ter de la
roadmap. La vérification d'un créneau saisi (règles 1 et 3), ses instants
chaque semaine aux heures de la ferme (passage de minuit rattaché au jour du
début, veille comprise, changement d'heure d'octobre : cas 5 et 16), l'union
des créneaux qui se chevauchent ou se touchent (règle 4, cas 6) et le
découpage d'une plage R8 autour d'eux (règle 6) ; six précisions tranchées
par la recommandation (S1 à S6 du contrat, D-071). Rien n'est branché : le
moteur, la base et l'écran ne changent pas, aucune migration. Contrôles
rejoués localement : lint, typage, tests (1 142 réussis), compilation,
knip, Worker Push (18 réussis) et planificateur météo (2 réussis) ; parcours
navigateur omis, sans rapport avec un module que rien n'appelle encore
(AGENTS.md, « Contrôles avant clôture ») : la CI les rejoue.

Le 8 novembre 2026, la nuit, la 3.8 ter, PR 2 sur 5 : le placement évite
les créneaux protégés (`lib/domain/planning/engine.ts`), même mandat, même
réglage. Chaque plage R8 est découpée autour des créneaux protégés de
l'exploitation, puis autour des refus ; la justification dit « après un
créneau protégé », « ce qui tient avant un créneau protégé » et nomme le
créneau évité ; une planche qui ne tient nulle part se lit « non placé »,
motif « créneau protégé : Lavage » (règles 5 et 6, cas 1 à 8, 16 et 17) ;
sept précisions tranchées par la recommandation (S7 à S13, D-071). Sept
plans de référence de la ferme de test, comparés avant et après le
changement, sont identiques octet pour octet. Le service ne passe encore
aucun créneau : rien ne change sur le site. Contrôles rejoués localement :
lint, typage, tests (1 155 réussis), compilation, knip, Worker Push
(18 réussis), planificateur météo (2 réussis) et parcours navigateur
(58 réussis aux deux largeurs).

Le 8 novembre 2026, la nuit, la 3.8 ter, PR 3 sur 5 : la persistance des
créneaux protégés, même mandat, même réglage. Migration additive 0030 : la
table des créneaux d'une exploitation et le journal de chaque version, avec
des contraintes qui refusent un créneau impossible jusque dans la base
(`db/protected-slots-repository.ts`) ; création, modification, suppression
logique, historique des valeurs, isolation par exploitation ; le service du
planning relit les créneaux à chaque calcul, pour l'exploitation du calcul
seulement (règles 7 et 8, cas 15) ; six précisions tranchées par la
recommandation (S14 à S19, D-071). Aucun créneau n'existe au départ et
aucun ne se saisit encore : rien ne change sur le site. Contrôles rejoués
localement : lint, typage, tests (1 163 réussis), compilation, knip,
Worker Push (18 réussis), planificateur météo (2 réussis), migrations
appliquées à une base D1 locale, et parcours navigateur (58 réussis aux deux
largeurs).

Le 8 novembre 2026, la nuit, la 3.8 ter, PR 4 sur 5 : les arrosages validés
et le réel, même mandat, même réglage. Un arrosage validé, planifié et pas
encore commencé, qui tombe dans un créneau protégé reçoit « Réduire » à la
partie avant, comptée à la minute entière, si elle porte la dose minimale
de sa nature, ou « Annuler » sinon ; la suggestion se combine aux autres
raisons comme dans la 3.7, et « Garder » la fait taire jusqu'à un calcul
qui en fait une autre (règles 9 et 10, cas 9 à 11). Une irrigation réelle
faite pendant un créneau en vigueur à son début réel porte le signal
« Faite pendant le créneau protégé « Lavage » » sur sa carte de
l'historique, pauses exclues, Planning coché seulement (3.8, R1) ; une
irrigation en cours ne reçoit rien (règle 11, cas 12 et 13). Six
précisions tranchées par la recommandation (S20 à S25, D-071). Neuf plans
de référence de la ferme de test, comparés avant et après le changement,
sont identiques octet pour octet. Aucun
créneau ne se saisit encore : rien ne change sur le site. Contrôles
rejoués localement : lint, typage, tests (1 175 réussis), compilation,
knip, Worker Push (18 réussis), planificateur météo (2 réussis) et
parcours navigateur (58 réussis aux deux largeurs).

Le 8 novembre 2026, la nuit, la 3.8 ter, correctif du journal des créneaux
protégés, même mandat, même réglage. La PR #285 fusionnée à 02 h 27, le job
« Application » de `main` (run 42434356565) a échoué sur un test du dépôt
des créneaux (`tests/db/protected-slots-repository.test.ts`, 4 versions au
journal pour 3 attendues), et le déploiement ne s'est pas fait. Le test
disait vrai : la version d'une suppression se recopiait après le geste,
d'après son seul instant, et une seconde suppression, refusée parce que la
première venait de se faire dans la même milliseconde, recopiait encore la
ligne supprimée, contre S15. Sur ce passage de la CI, les gestes du test
tombaient dans la même milliseconde ; en local et sur les CI des PR 3 et 4,
non. La version d'une suppression s'écrit désormais avant le geste, à sa
condition même, la ligne encore active ; un test à l'horloge arrêtée
reproduit le défaut (échec avant la correction, réussite après). Rien ne
change sur le site : aucun écran ne supprime encore de créneau. Contrôles
rejoués localement : lint, typage, tests (1 176 réussis), compilation,
knip, Worker Push (18 réussis), planificateur météo (2 réussis) ; parcours
navigateur laissés à la CI, aucun écran de `main` ne touchant au dépôt des
créneaux.

Le 8 novembre 2026, la nuit, la 3.8 ter, PR 5 sur 5 : l'écran et le geste
manuel, même mandat, même réglage. Dans le pli « Réglages du planning », la
section « Créneaux protégés » liste chaque créneau sur une ligne
(« Lavage · mardi et jeudi · de 21:00 à 23:00 », « le lendemain » quand il
passe minuit), le crée, le modifie, le supprime avec confirmation, et lit
le journal de ses versions sans nommer personne ; un créneau nouveau ne
devine rien, et aucun geste ne recalcule le plan (règle 8). « Planifier »
avertit d'un arrosage qui tombe dans un créneau, sans le bloquer (règle 12,
cas 14) ; « Démarrer maintenant » et « Déjà réalisée » n'avertissent pas,
leur carte de l'historique le dit. Décocher le Planning compte aussi les
créneaux enregistrés (3.8, R2). Sept précisions tranchées par la
recommandation (S26 à S32, D-071). Parcours P26 aux deux largeurs : un
créneau qui vaut au calcul suivant, le motif « créneau protégé » d'un
besoin non placé, l'avertissement de « Planifier », la suggestion
« Annuler » appliquée sur un arrosage planifié, le journal, puis la remise
en état. Contrôles rejoués localement : lint, typage, tests (1 179
réussis), compilation, knip, Worker Push (18 réussis), planificateur météo
(2 réussis) et parcours navigateur (60 réussis aux deux largeurs). Le code des
créneaux protégés est terminé ; la relecture en ligne et la recette réelle
attendent le porteur.

Le 8 novembre 2026, la nuit, la 3.8 quater, lot 1 de l'audit ergonomique
(points 7, 4, 9 et 11, D-069), même mandat, en Opus 5.5 · Élevé, la ligne
3.8 quater de la roadmap, en une PR. Chaque page donne son nom à l'onglet,
et une adresse inconnue répond « Page introuvable » (404) en français, avec
le menu de la ferme et un bouton vers sa première page cochée. Les listes de
choix se rangent dans l'ordre naturel (B9-9 avant B9-10) ; le périmètre d'un
objectif se range par jardin et se cherche. La saison quitte Alertes météo
et Réglages quand elle n'y change rien ; la commune ne se change plus que
dans Réglages. L'historique s'ouvre sur « Réalisées », avec « Planifiées » et
« Toutes » ; l'export suit l'onglet et le dit ; « Saisir la pluie » mène au
bloc de la pluie mesurée. Neuf précisions tranchées par la recommandation
(E1 à E9, D-072). Aucune migration, aucun calcul du moteur ne change. Le
déploiement de #287 est consigné par cette PR. Contrôles rejoués
localement : lint, typage, tests (1 190 réussis), compilation, knip, Worker
Push (18 réussis), planificateur météo (2 réussis) et parcours navigateur
(62 réussis aux deux largeurs, P27 compris). La relecture en ligne et
l'affichage sur la ferme réelle attendent le porteur.

Le 8 novembre 2026, la nuit, la 3.8 quater, lot 2 de l'audit ergonomique,
PR 1 sur 3 : le téléphone (point 2, D-073), même mandat, en Opus 5.5 · Très
élevé, sur le contrat `docs/audit-ergonomie-lot2-contract.md` en ligne
depuis #289. Le module est d'abord mesuré à 390 px sur la ferme de
démonstration (aucun défilement horizontal ; le premier champ d'Arrosages à
942 px, sous le premier écran ; le planning à 6,3 écrans ; les « D'où vient
ce chiffre ? » à 24 px et « Actualiser » à 18 px). Le menu qui
défilait en haut devient une barre en bas : quatre pages et « Plus », qui
ouvre la liste entière et porte la pastille quand la page ouverte n'est pas
dans la barre ; un menu de cinq pages ou moins y tient entier. La saison
passe dans la ligne du titre. Le planning se replie au téléphone : le jour du
jour ouvert (ou, s'il n'a rien, le prochain jour qui a des propositions),
les jours écoulés rangés sous « Jours écoulés (n) » sauf celui qui porte des
irrigations en retard, les autres jours repliés sur « Voir les créneaux »,
les six tuiles en une ligne qui se déplie ; le planning mesuré passe à
4,8 écrans, le premier champ d'Arrosages à 771 px. Le bandeau des alertes système, déjà vu sur l'appareil, se replie en
un point sur la cloche ; il revient quand l'état change, et le rappel reste
entier dans Réglages ; un stockage illisible le laisse déplié. Les « ? »,
les « i » et « Actualiser » passent à 44 px. Huit précisions tranchées par
la recommandation (F15 à F22, contrat et D-073). Rien ne change à
l'ordinateur ni à la tablette ; aucune migration, aucun calcul du moteur ne
change. Le déploiement de #289 est consigné par cette PR. Contrôles rejoués
localement : lint, typage, tests (1 202 réussis), compilation, knip, Worker
Push (18 réussis), planificateur météo (2 réussis) et parcours navigateur
(66 réussis aux deux largeurs, P28 compris). Un vrai téléphone, un lecteur
d'écran et la ferme réelle n'ont pas été essayés ; la relecture en ligne
attend le porteur.

Le 8 novembre 2026, la nuit, la 3.8 quater, lot 2 de l'audit ergonomique,
PR 2 sur 3 : le domaine de la page « Aujourd'hui » et de la zone
« Fiabilité du calcul » (points 1 et 3, D-073), même mandat, en Opus 5.5 ·
Très élevé, sans écran. Une seule fonction dit, pour cinq données, si elle
est à rafraîchir, dans quels mots et par quel geste : le volume d'une
réserve de plus de 7 jours ou jamais saisi, la pluie réelle qui manque un
des 7 derniers jours, le sol d'un jardin jamais observé, les espèces sans
rattachement, le plan de plus de 48 heures ; cinq lignes montrées, les
autres derrière « Voir les n autres », et « Rien à rafraîchir » quand tout
est à jour. Les cinq blocs de la page « Aujourd'hui » se construisent à
partir des cases cochées : le gel des cultures et les alertes de
l'exploitation des trois jours, sans jamais lire une prévision absente
comme un temps calme ; les irrigations en retard et non faites ; ce qui
est à faire aujourd'hui, par heure ; l'eau des réserves et des ressources
limitées ; la fiabilité. La pastille du menu compte les lignes de
fiabilité et les retards. Le service rassemble les lectures qui existent
déjà, sans requête nouvelle vers Ouvre ta ferme. Huit précisions tranchées
par la recommandation (F23 à F30, contrat et D-073). Aucune migration,
aucun calcul ne change ; rien n'est encore affiché. Le déploiement de #290
est consigné par cette PR. Contrôles rejoués localement : lint, typage,
tests (1221 réussis), compilation, knip, Worker Push (18 réussis),
planificateur météo (2 réussis) et parcours navigateur (66 réussis
aux deux largeurs). La page elle-même vient avec la PR 3 (P29). Le lot 1
(#288) est relu et validé par le porteur le 8 novembre 2026, E4 compris ;
consigné par cette PR.

Le 8 novembre 2026, la nuit, la 3.8 quater, lot 2 de l'audit ergonomique,
PR 3 sur 3 : les écrans (points 1 et 3, D-073), même mandat, en Opus 5.5 ·
Très élevé. Le module s'ouvre désormais sur « Aujourd'hui », la réponse à
la question du matin : la ligne qui dit quand le plan a été calculé, puis
le gel ou la chaleur des trois jours (barre rouge quand un gel est
annoncé), les irrigations en retard, ce qui est à faire aujourd'hui par
heure, l'eau des réserves et des ressources limitées, et la zone
« Fiabilité du calcul », chacun présent seulement si sa case est cochée.
Une ferme qui n'a coché que Matériel, Calculateur ou Historique arrive,
comme avant, sur sa première page. La page n'a ni formulaire ni calcul :
ses boutons sont ceux qui existent, et chaque ligne mène à la carte même,
à un clic (la réserve, le jardin du sol déplié, la proposition,
l'irrigation). La pastille du menu, en ambre, compte les lignes de la zone
et les retards ; ailleurs, elle se lit après l'affichage, dans les données
déjà gardées, sans requête vers Ouvre ta ferme. L'inventaire des
avertissements des pages (F9) n'a trouvé qu'un doublon, la pluie réelle
incomplète du tableau des besoins, qui garde sa place et dit la même
conséquence que la zone. Douze précisions tranchées par la recommandation
(F31 à F42, contrat et D-073). Aucune migration, aucun calcul ne change.
Le déploiement de #292 (affichage du calculateur) est consigné par cette
PR. Contrôles
rejoués localement : lint, typage, tests (1226 réussis),
compilation, knip, Worker Push (18 réussis), planificateur météo
(2 réussis) et parcours navigateur (68 réussis aux deux largeurs,
P29 compris). Non vérifié : la relecture du porteur, sa ferme réelle, un
vrai téléphone, le lecteur d'écran.

Le 8 novembre 2026, à midi, deux retours du porteur après sa relecture en
ligne, en une petite PR (Opus 5.5 · Très élevé). Sur le planning de la
semaine, la liste « Non placé » était trop longue : elle est repliée par
défaut derrière son titre, qui garde le nombre de planches (« Non placé
(37 planches) »), et une flèche vers le bas la déplie, à toutes les
largeurs ; une semaine où tout est servi garde sa phrase. Les « i » du
planning prenaient le dessin des boutons de la section (une pilule de
44 px de haut) : ils redeviennent des ronds de 24 px, et chaque ligne de la
liste raccourcit. Sur « Matériel et placement », le plan de la parcelle
vient en premier, comme demandé ; la fiche de la planche choisie reste
juste dessous, pour ne pas tomber sous l'aperçu, qui vient ensuite. Aucune
migration, aucun calcul ne change. Le déploiement de #293 (lot 2,
PR 3) est consigné par cette PR. Contrôles rejoués localement : lint,
typage, tests (1227 réussis), compilation, knip, Worker Push
(18 réussis), planificateur météo (2 réussis) et parcours navigateur
(68 réussis aux deux largeurs). Non vérifié : sa ferme réelle
(190 périmètres), un vrai téléphone.

Le 8 novembre 2026, toujours à midi, le troisième retour du porteur, sur
« Besoin par culture », en une petite PR (Opus 5.5 · Très élevé). Rien ne
disait qu'il fallait toucher une culture pour voir ses Kc : chaque carte de
culture et d'espèce porte désormais « Voir le détail » et une flèche vers
le bas (« Replier » et la flèche retournée une fois ouverte), son fond
s'éclaire au survol, et une phrase sous chaque liste dit ce que l'on trouve
en touchant une carte. La place vide à droite du nom porte le résumé de la
culture, choisi par le porteur entre trois propositions : l'étendue des Kc
qui comptent aujourd'hui, surcharges comprises (« Kc de 0,50 à 1,10 »), la
racine la plus profonde de son profil (« racines jusqu’à 0,60 m », ou
« 0,30 m proposés » sans profil) et le nombre de séries de la saison qui
s'y rattachent, une exception de série comprise. Au téléphone, il passe
sous le nom. Rien de calculé de plus que la carte ouverte ; aucune
migration. Le déploiement de #295 est consigné par cette PR.
Contrôles rejoués localement : lint, typage, tests (1231 réussis),
compilation, knip, Worker Push (18 réussis), planificateur météo
(2 réussis) et parcours navigateur (68 réussis aux deux largeurs).
Non vérifié : sa ferme réelle, un vrai téléphone.

## Contrôles de référence du 16 septembre 2026

- Typage principal : réussi.
- Tests principaux : 302 réussis.
- Compilation de production : réussie.
- Tests Worker Push : 9 réussis.
- Tests planificateur météo : 2 réussis.
- Lint : réussi après correction de trois alertes React et exclusion du fichier
  Cloudflare généré.
- Constructions à blanc Wrangler des deux Workers : réussies.
- Première exécution de la CI GitHub sur `main` : réussie le 16 septembre 2026
  (lint, typage, tests, compilation et contrôles des deux Workers).
- Recette locale du correctif d'espacement OTF le 17 septembre 2026 : lint,
  typage et compilation réussis, 303 tests principaux réussis et test ciblé
  répété dix fois sans échec.
- Recette locale Tailwind/PostCSS `4.3.3` le 18 septembre 2026 : lint, typage,
  303 tests principaux, compilation de production, 9 tests Push, 2 tests
  météo et constructions Wrangler à blanc réussis ; affichages ordinateur et
  mobile vérifiés sans erreur navigateur.
- Validation du report de `@types/node` majeur le 18 septembre 2026 : syntaxe
  YAML et règle Dependabot vérifiées, `git diff --check` réussi. Le lint, le
  typage, les tests, la compilation et les contrôles Workers n'ont pas été
  rejoués, car ni le code applicatif ni les dépendances installées n'ont changé
  depuis la recette Tailwind/PostCSS ci-dessus.
- Recette locale Next/ESLint Next `16.3.5` le 18 septembre 2026 : lint, typage,
  303 tests principaux, compilation Vinext, 9 tests Push, 2 tests météo et
  constructions Wrangler à blanc réussis ; affichages ordinateur et mobile
  vérifiés sans régression visible.
- Audit du 18 septembre 2026 sur poste Windows, Node 22.23.2 : lint, typage,
  303 tests principaux, compilation Vinext, 9 tests Push, 2 tests météo et
  constructions Wrangler à blanc réussis, sans modification du code.
- PR de documentation du 18 septembre 2026 (roadmap, audit, décisions) :
  `pnpm test` rejoué car un test lit la documentation, `git diff --check`
  réussi ; lint, typage, compilation et contrôles Workers non rejoués, aucun
  fichier de code ni de configuration modifié.
- Sous-tranche 3.3.1 le 18 septembre 2026, sur poste Windows Node 22.23.2 :
  lint, typage, 303 tests principaux dont huit tests du besoin réécrits ou
  ajustés, compilation Vinext, 9 tests Push, 2 tests météo et constructions
  Wrangler à blanc réussis. L'écran des besoins n'a pas été vérifié
  visuellement en local, la base D1 locale n'étant pas migrée (sous-tranche
  Q5) ; la recette se fait sur le site privé (point ouvert 4).
- Q0 phase 1 le 18 septembre 2026 : lint, typage, 317 tests principaux dont
  quatorze sur le jeton Access, compilation Sites, compilation Cloudflare et
  déploiement à blanc, 9 tests Push, 2 tests météo réussis. Worker déployé et
  sondé : la racine redirige vers `/irrigation`, qui redirige vers la
  connexion Access ; la route interne météo répond 405 hors POST. Quatorze
  migrations appliquées à la base distante, 38 tables présentes.

- Q0 phase 2 (préparation) le 19 septembre 2026 : lint, typage, 325 tests
  principaux dont huit sur l'export et l'import, compilation Sites, compilation
  Cloudflare, 9 tests Push, 2 tests météo réussis. Aucun export réel exécuté.
- Q0 phase 3 le 19 septembre 2026 : lint, typage, 326 tests principaux,
  compilation Cloudflare, 9 tests Push, 2 tests météo, déploiements à blanc
  des deux Workers réussis. Application et planificateur déployés ;
  déclenchement manuel du planificateur reçu par l'application (HTTP 200), la
  synchronisation elle-même refusée par le fournisseur météo (clé à
  ressaisir). Job de déploiement automatique non encore exercé.
- Q0 phase 4 le 19 septembre 2026 : lint, typage, 326 tests principaux,
  compilation (cible Cloudflare unique) et déploiement à blanc, 9 tests Push,
  2 tests météo réussis. Aucun test ne couvrait le fournisseur Sites retiré.
- Q1 le 19 septembre 2026 : documentation et configuration seules ; lint,
  typage, 326 tests principaux, compilation réussis ; renormalisation des fins
  de ligne vérifiée sans changement de contenu ; contrôles des Workers sans
  rapport, non relancés.
- Q2 première PR le 19 septembre 2026 : lint, typage, 340 tests dont
  quatorze nouveaux sous `tests/db/` exécutant le vrai code des dépôts,
  compilation Cloudflare réussis ; les 326 tests antérieurs inchangés ;
  contrôles des Workers sans rapport, non relancés.
- Q2 deuxième PR le 19 septembre 2026 : lint, typage, 356 tests dont seize
  nouveaux sur le dépôt des irrigations, compilation réussis ; aucun fichier
  de production modifié ; contrôles des Workers sans rapport, non relancés.
- Q2 troisième PR le 19 septembre 2026 : lint, typage, 370 tests dont
  quatorze nouveaux (gestion de l'eau, cache OTF), compilation réussis ;
  aucun fichier de production modifié ; contrôles des Workers sans rapport,
  non relancés.
- Q2 quatrième PR le 19 septembre 2026 : lint, typage, 382 tests dont douze
  nouveaux (besoins, arbitrages, historique, météo nocturne), compilation
  réussis ; aucun fichier de production modifié ; contrôles des Workers sans
  rapport, non relancés.
- Q2 cinquième PR le 19 septembre 2026 : lint, typage, 392 tests dont dix
  nouveaux (matériel, positions), compilation réussis ; aucun fichier de
  production modifié ; contrôles des Workers sans rapport, non relancés.
- Q2 sixième PR le 19 septembre 2026 : lint, typage, 404 tests dont douze
  nouveaux (groupes, ressources en eau, pompes), un marqué « à corriger »,
  compilation réussis ; aucun fichier de production modifié ; contrôles des
  Workers sans rapport, non relancés.
- Corrections Q2 le 19 septembre 2026 : lint, typage, 404 tests tous verts
  (le « à corriger » levé), migration 0014 rejouée par les tests sur base
  neuve, compilation et déploiement à blanc réussis ; contrôles des Workers
  sans rapport, non relancés.
- Q3 première PR le 19 septembre 2026 : lint, typage, 404 tests, compilation
  réussis après le déplacement de 53 modules et la réécriture de 222 imports ;
  contrôles des Workers sans rapport (aucun import de `lib/`), non relancés.
- Q3 deuxième PR le 19 septembre 2026 : lint (0 erreur, 7 avertissements
  `max-lines` attendus), typage, 412 tests dont huit sur les frontières,
  compilation réussis ; contrôles des Workers sans rapport, non relancés.
- Q3 troisième PR le 19 septembre 2026 : lint (0 erreur, 7 avertissements
  attendus), typage, 417 tests dont quatre sur le module d'unités et un
  sur la règle, compilation réussis ; contrôles des Workers sans rapport, non
  relancés.
- Q3 quatrième PR le 19 septembre 2026 : lint (0 erreur, 6 avertissements
  `max-lines`, la liste de Q6), typage, 417 tests, `pnpm knip` sans signalement,
  compilation, `pnpm push:check` et `pnpm weather:check` réussis (le
  Worker Push est touché par le retrait d'un export).
- Q4 première PR le 19 septembre 2026 : lint (0 erreur, 6 avertissements
  `max-lines` attendus), typage, 417 tests, `pnpm knip` sans signalement,
  compilation réussis ; comparaison avant et après de `/irrigation` à 1 280 px
  et 390 px : 1 561 éléments, aucune différence de styles calculés ni de
  géométrie ; feuilles compilées comparées bloc par bloc ; contrôles des
  Workers sans rapport, non relancés.
- Q4 deuxième PR le 19 septembre 2026 : lint (0 erreur, 6 avertissements
  attendus), typage, 417 tests dont le test de dérive rejouant les quinze
  migrations, `pnpm knip` sans signalement, compilation réussis ; contrôles
  des Workers sans rapport, non relancés.
- Correction A2 de la recette 3.4 le 20 septembre 2026 : lint (0 erreur, 6
  avertissements attendus), typage, 418 tests dont un nouveau sur la date
  météo affichée, `pnpm knip` sans signalement, compilation réussis ;
  contrôles des Workers sans rapport, non relancés.
- Besoin toujours calculable (D-019) le 20 septembre 2026 : lint (0 erreur, 6
  avertissements attendus), typage, 422 tests dont quatre nouveaux sur la
  reprise de la prévision, le zéro signalé, l’objectif absent et le jour
  courant compté une seule fois, `pnpm knip` sans signalement, compilation
  réussis ; contrôles des Workers sans rapport, non relancés.
- Types Workers `5.20260916.1` le 20 septembre 2026 : lint (0 erreur, 6
  avertissements attendus), typage, 422 tests, `pnpm knip` sans signalement,
  compilation, `pnpm push:check` et `pnpm weather:check` réussis. Les deux
  Workers sont contrôlés ici, les types étant partagés.
- Lot Vite le 20 septembre 2026 : lint (0 erreur, 6 avertissements attendus),
  typage, 422 tests, `pnpm knip` sans signalement, compilation,
  `pnpm push:check` et `pnpm weather:check` réussis ; `pnpm peers check` sans
  conflit ; `pnpm dev` démarré sans contournement, `/irrigation` servie en
  HTTP 200, page complète sur ordinateur et à 390 px sans défilement
  horizontal ni erreur de console.
- Lot React le 20 septembre 2026 : lint (0 erreur, 6 avertissements attendus),
  typage, 422 tests, `pnpm knip` sans signalement, compilation,
  `pnpm push:check` et `pnpm weather:check` réussis ; `pnpm peers check` sans
  conflit ; comparaison avant et après de `/irrigation` à 1 280 px et 390 px :
  1 575 éléments, zéro écart de style calculé, zéro écart de géométrie.
- 3.1 bis sixième PR le 22 septembre 2026 : lint sans avertissement, typage,
  458 tests dont quatre nouveaux sur les consommations, `pnpm knip` sans
  signalement ; `pnpm e2e` vert, quatorze vérifications aux deux largeurs, le
  cinquième parcours couvrant désormais le cumul des volumes.
- 3.1 bis cinquième PR le 22 septembre 2026 : lint sans avertissement, typage,
  454 tests, `pnpm knip` sans signalement. PR de documents, sans code
  applicatif.
- 3.1 bis quatrième PR le 22 septembre 2026 : lint sans avertissement, typage,
  454 tests, `pnpm knip` sans signalement ; `pnpm e2e` vert, quatorze
  vérifications aux deux largeurs, le cinquième parcours compris.
- 3.1 bis troisième PR le 22 septembre 2026 : lint sans avertissement, typage,
  454 tests dont treize nouveaux sur la persistance des relevés et le test de
  dérive de schéma vert, `pnpm knip` sans signalement ; `pnpm e2e` vert, douze
  vérifications aux deux largeurs, la migration s'appliquant à la base locale
  recréée.
- 3.1 bis deuxième PR le 22 septembre 2026 : lint sans avertissement, typage,
  441 tests dont quatorze nouveaux sur le calcul du débit, `pnpm knip` sans
  signalement.
- Q6 neuvième PR et clôture le 21 septembre 2026 : lint sans erreur avec
  `max-lines` en erreur, typage, 427 tests dont le contrôle de taille sur le
  dépôt réel, `pnpm knip` sans signalement ; `pnpm e2e` vert, douze
  vérifications aux deux largeurs.
- Q6 huitième PR le 21 septembre 2026 : lint sans avertissement, typage,
  426 tests dont deux nouveaux sur la feuille de style, `pnpm knip` sans
  signalement ; feuille compilée identique octet pour octet avant et après ;
  `pnpm e2e` vert, douze vérifications aux deux largeurs en 72 secondes.
- Q6 septième PR le 21 septembre 2026 : lint sans aucun avertissement, plus un
  seul fichier au-dessus de la limite ; typage, 424 tests, `pnpm knip` sans
  signalement ; aucune ligne de l’original disparue ; `pnpm e2e` vert, douze
  vérifications aux deux largeurs en 72 secondes, placement compris.
- Q6 sixième PR le 21 septembre 2026 : lint (0 erreur, 1 avertissement
  `max-lines`), typage, 424 tests dont le contrôle étendu de la déclaration
  `use client`, `pnpm knip` sans signalement ; aucune ligne de l’original
  disparue à la comparaison ; `pnpm e2e` vert, douze vérifications aux deux
  largeurs en 78 secondes, minuteur et boîte de fin compris.
- Q6 cinquième PR le 21 septembre 2026 : lint (0 erreur, 2 avertissements
  `max-lines`), typage, 424 tests, `pnpm knip` sans signalement ; comparaison
  ligne à ligne sans écart ; `pnpm e2e` vert, douze vérifications aux deux
  largeurs en 72 secondes.
- Q6 quatrième PR le 21 septembre 2026 : lint (0 erreur, 3 avertissements
  `max-lines`, deux de moins), typage, 424 tests, `pnpm knip` sans
  signalement ; comparaison ligne à ligne sans écart pour les deux fichiers
  découpés ; `pnpm e2e` vert, douze vérifications aux deux largeurs en
  72 secondes.
- Q6 troisième PR le 21 septembre 2026 : lint (0 erreur, 5 avertissements
  `max-lines`, un de moins), typage, 424 tests, `pnpm knip` sans signalement ;
  comparaison ligne à ligne sans écart entre l'ancien dépôt et les dix
  modules ; `pnpm e2e` vert, douze vérifications aux deux largeurs en
  72 secondes.
- Q6 deuxième PR le 21 septembre 2026 : lint (0 erreur, 6 avertissements
  `max-lines` attendus), typage, 424 tests dont le cas de frontières devenu un
  refus, `pnpm knip` sans signalement ; `pnpm e2e` vert, douze vérifications
  aux deux largeurs en 84 secondes.
- Q6 première PR le 21 septembre 2026 : lint (0 erreur, 6 avertissements
  attendus), typage, 424 tests, `pnpm knip` sans signalement. PR de documents,
  sans code applicatif.
- Q5 quatrième PR et clôture le 20 septembre 2026 : lint (0 erreur, 6
  avertissements attendus), typage, 424 tests, `pnpm knip` sans signalement,
  compilation réussis ; `pnpm e2e` vert, douze vérifications aux deux largeurs
  en 90 secondes, les quatre parcours du contrat étant couverts.
- Q5 troisième PR le 20 septembre 2026 : lint (0 erreur, 6 avertissements
  attendus), typage, 424 tests, `pnpm knip` sans signalement, compilation
  réussis ; `pnpm e2e` vert, dix vérifications aux deux largeurs en 84 secondes.
- Q5 deuxième PR le 20 septembre 2026 : lint (0 erreur, 6 avertissements
  attendus), typage, 424 tests, `pnpm knip` sans signalement, compilation
  réussis ; `pnpm e2e` vert, six vérifications aux deux largeurs dont le
  parcours complet d'irrigation au minuteur, en 42 secondes.
- Q5 première PR le 20 septembre 2026 : lint (0 erreur, 6 avertissements
  attendus), typage, 424 tests, `pnpm knip` sans signalement, compilation
  réussis ; `pnpm e2e` vert, quatre vérifications de socle aux deux largeurs en
  45 secondes, serveur et base locale compris.
- Web Push `2.0.0` le 20 septembre 2026 : lint (0 erreur, 6 avertissements
  attendus), typage, 424 tests applicatifs, `pnpm knip` sans signalement,
  compilation, `pnpm weather:check` et `pnpm push:check` réussis, ce dernier
  avec 11 tests dont deux nouveaux sur le chiffrement réel.
- Quota OTF le 20 septembre 2026 : lint (0 erreur, 6 avertissements attendus),
  typage, 424 tests dont deux nouveaux sur le partage du quota et le silence
  après un `429`, `pnpm knip` sans signalement, compilation réussis ; contrôles
  des Workers sans rapport, non relancés.
- Correction du fuseau des relevés le 25 septembre 2026 : lint sans
  avertissement, typage, 470 tests dont six nouveaux — la conversion d'une
  heure de la ferme, les jours de changement d'heure, l'aller-retour avec le
  pré-remplissage, les saisies refusées et la lecture de l'action —
  compilation, `pnpm knip` sans signalement, `pnpm push:check`,
  `pnpm weather:check` et les 20 parcours navigateur réussis. Le parcours P5
  a été rejoué **sans la correction** pour vérifier que son nouveau contrôle
  échoue bien : il échoue.
- Étape 5.0, première PR de code (projections) le 28 septembre 2026 : lint
  sans avertissement, typage, 479 tests réussis dont huit nouveaux,
  compilation Vinext réussie, `pnpm knip` sans signalement de code (dix
  indications de configuration, identiques sans la modification),
  `pnpm push:check` et `pnpm weather:check` à blanc réussis, et les
  20 parcours navigateur réussis aux deux largeurs — P1 et P8 vérifient
  désormais 225 L/h et 22,5 m² en goutte-à-goutte, 604,8 L/h et 36 m² en
  aspersion sur N01. Première exécution : P1 et P8 en échec sur le repérage
  de la carte de besoin dans l'aide de test, corrigé, puis 4 puis 20 réussis.
  Vérification visuelle sur serveur local **non faite** : serveur de
  développement non démarrable depuis une session issue d'une tâche
  planifiée ; à faire sur la version déployée.
- Étape 5.0, seconde PR de code (persistance) le 29 septembre 2026 : lint sans
  avertissement, typage, 486 tests réussis dont quinze nouveaux — migration
  rejouée sur une base avec des lignes existantes, surface mouillée enregistrée
  et relue `NULL` compris, débit inconnu, volume incomplet, historique sur la
  surface mouillée et millimètres sur la planche —, compilation, `pnpm knip`
  sans signalement, `pnpm push:check` et `pnpm weather:check` réussis, et les
  20 parcours navigateur aux deux largeurs. Migration appliquée en local.
- Correction du point 41, 10 octobre 2026 (note du manque d'eau tolérante au
  résidu d'arrondi des secondes, D-040), contrôles joués en local sur la
  branche, sur le code du commit : `pnpm lint`, `pnpm typecheck`, `pnpm test`
  (604 tests réussis, deux de plus), `pnpm build`, `pnpm knip` (code 0, quatre
  indications de configuration sur `knip.json`, déjà connues), `pnpm
  push:check` (11 tests) et `pnpm weather:check` (2 tests) tous à zéro ; `pnpm
  e2e` : `24 passed (2.8m)`, sortie 0, à la seconde exécution, la première
  sans démarrage : le verrou `.vinext/dev/lock.json` laissé par le serveur des
  parcours de la veille à 19 h 43 désignait un PID repris depuis par un autre
  programme, que vinext a cru vivant ; verrou périmé supprimé, rien de plus.

- Journaux de durée du point 34, 9 octobre 2026 (chronomètre, lignes
  `planning_calculation_completed` et `irrigation_page_loaded`), contrôles
  joués en local sur la branche, sur le code du commit : `pnpm lint`, `pnpm
  typecheck`, `pnpm test` (602 tests réussis, trois de plus), `pnpm build`,
  `pnpm knip`, `pnpm push:check` (11 tests) et `pnpm weather:check` (2 tests)
  tous à zéro ; `pnpm e2e` : `24 passed (3.1m)`, le serveur des parcours ayant
  écrit 4 lignes `planning_calculation_completed` et 108 lignes
  `irrigation_page_loaded`, sans identifiant de personne.
- Correction du point 40, 9 octobre 2026 (historique aligné sur le jour de
  pose de l'objectif, D-039), contrôles joués en local sur la branche, sur le
  code du commit : `pnpm lint`, `pnpm typecheck`, `pnpm test` (599 tests
  réussis, un de plus), `pnpm build`, `pnpm knip`, `pnpm push:check` (11
  tests) et `pnpm weather:check` (2 tests) tous à zéro ; `pnpm e2e` : `24
  passed (3.2m)`.
- Correction du point 36, 9 octobre 2026 (part réservée D-037, note du manque
  d'eau D-038), contrôles joués en local sur la branche, sur le code du
  commit : `pnpm lint`, `pnpm typecheck`, `pnpm test` (598 tests réussis,
  quatre de plus), `pnpm build`, `pnpm knip`, `pnpm push:check` (11 tests) et
  `pnpm weather:check` (2 tests) tous à zéro ; `pnpm e2e` : `24 passed
  (2.8m)`.
- Déplacement de la ferme de test du moteur, 9 octobre 2026
  (`tests/support/planning-fixtures.ts`, aucune ligne de test ni de code du
  logiciel changée), contrôles joués en local sur la branche après le commit :
  `pnpm lint`, `pnpm typecheck`, `pnpm test` (594 tests réussis, autant
  qu'avant), `pnpm build`, `pnpm knip`, `pnpm push:check` (11 tests) et `pnpm
  weather:check` (2 tests) tous à zéro ; `pnpm e2e` omis, la PR ne touchant ni
  l'interface ni les services qu'elle appelle.
- Correction des points 33 et 35, 9 octobre 2026 (explications du planning,
  pénurie sous limite journalière), contrôles joués en local sur la branche
  après le commit de code : `pnpm lint`, `pnpm typecheck`, `pnpm test` (594
  tests réussis, cinq de plus), `pnpm build`, `pnpm knip`, `pnpm push:check`
  (11 tests) et `pnpm weather:check` (2 tests) tous à zéro ; parcours
  navigateur `pnpm e2e` `24 passed (2.9m)`, sortie 0.
- Correction du point 13, 9 octobre 2026 (limite journalière à la modification
  d'une irrigation planifiée), contrôles joués en local sur la branche après
  le commit de code : `pnpm lint`, `pnpm typecheck`, `pnpm test` (589 tests
  réussis, trois de plus), `pnpm build`, `pnpm knip`, `pnpm push:check` (11
  tests) et `pnpm weather:check` (2 tests) tous à zéro ; parcours navigateur
  `pnpm e2e` 24 parcours réussis en 3,0 min (douze parcours à deux largeurs).
- Correction du point 39, 9 octobre 2026 (décision D-036, objectif de
  l'historique sur les journées-planche couvertes), contrôles joués en local
  sur la branche après les commits de code : `pnpm lint`, `pnpm typecheck`,
  `pnpm test` (586 tests réussis, deux de plus), `pnpm build`, `pnpm knip`,
  `pnpm push:check` (11 tests) et `pnpm weather:check` (2 tests) tous à zéro ;
  parcours navigateur `pnpm e2e` 24 parcours réussis en 3,0 min (douze
  parcours à deux largeurs).
- Correction des points 11, 15, 16 et 38, 9 octobre 2026 (décisions D-032 à
  D-035), contrôles joués en local sur la branche après les commits de code :
  `pnpm lint`, `pnpm typecheck`, `pnpm test` (584 tests réussis, quatre de
  plus, un par point), `pnpm build`, `pnpm knip`, `pnpm push:check` (11 tests)
  et `pnpm weather:check` (2 tests) tous à zéro ; parcours navigateur `pnpm
  e2e` 24 sur 24 réussis en 2,9 min.
- Correction du point 14, 9 octobre 2026 (limite de prélèvement au jour de la
  ferme), contrôles joués en local sur la branche : lint, typecheck, test (580
  tests réussis, un de plus), build, knip, push:check et weather:check tous à
  zéro ; parcours navigateur `pnpm e2e` 24 sur 24 réussis en 2,9 min.
- Correction du point 24, 9 octobre 2026 (démarrage sous limite, volume
  invérifiable), contrôles joués en local sur la branche : `pnpm lint`, `pnpm
  typecheck`, `pnpm test` (579 tests, six de plus : cinq de la garde du
  démarrage, un du domaine), `pnpm build`, `pnpm knip`, `pnpm push:check` et
  `pnpm weather:check` verts ; `pnpm e2e` 24 parcours réussis aux deux
  largeurs en 2,8 min.
- Correction du point 26, 9 octobre 2026 (arbitrage vide), contrôles joués en
  local sur la branche : lint sans avertissement (12 s), typage sans erreur
  (5 s), 573 tests réussis en 8 s (planning 67 ms), compilation réussie (5 s),
  `pnpm knip` sans code mort (4 s), `pnpm push:check` et `pnpm weather:check`
  à blanc réussis (6 s et 4 s), parcours navigateur 24 sur 24 réussis en 3 min
  1 s, douze aux deux largeurs.
- Registres de la fusion et du déploiement de la PR #148, 8 octobre 2026 au
  soir, contrôles joués en local sur la branche : lint sans avertissement
  (9 s), typage sans erreur (3 s), 572 tests réussis en 8 s ; compilation,
  `pnpm knip`, `pnpm push:check`, `pnpm weather:check` et parcours omis :
  registres seuls.
- Lot de dépendances du 8 octobre 2026, quatre PR Dependabot et `next` 16.3.8
  en une seule PR, contrôles joués en local sur la branche, sur le lot
  complet : lint sans avertissement (9 s), typage sans erreur (6 s), 572 tests
  réussis en 9 s, compilation réussie (4 s), `pnpm knip` sans code mort (4 s),
  `pnpm push:check` et `pnpm weather:check` à blanc réussis (4 s et 3 s),
  parcours navigateur 24 sur 24 réussis en 2 min 49 s, douze aux deux
  largeurs ; la même suite verte sur les quatre montées seules, parcours 24
  sur 24 en 2 min 57 s.
- Registres de la fusion des PR #144 et #145, 8 octobre 2026 au soir,
  contrôles joués en local sur la branche : lint sans avertissement (9 s),
  typage sans erreur (2 s), 572 tests réussis en 9 s ; compilation, `pnpm
  knip`, `pnpm push:check`, `pnpm weather:check` et parcours omis : registres
  seuls.
- Correction du parcours P9 après rechargement, 8 octobre 2026 au soir (point
  37), contrôles joués en local sur la branche : lint sans avertissement
  (10 s), typage sans erreur (3 s), 572 tests réussis en 8 s, `pnpm knip` sans
  code mort (4 s), parcours navigateur 24 sur 24 réussis en 3 min 4 s (et 24
  sur 24 en 3 min 10 s avant la retouche de P4), douze aux deux largeurs ;
  compilation, `pnpm push:check` et `pnpm weather:check` omis : ni le code
  livré ni les Workers ne changent.
- Budget du test de performance à 500 ms, 8 octobre 2026 (D-031, point 28),
  constante de test, contrat et registres, contrôles joués en local sur la
  branche : lint sans avertissement (11 s), typage sans erreur (4 s), 572
  tests réussis en 9 s, le planning de la grande ferme calculé en 70 ms ;
  compilation, `pnpm knip`, `pnpm push:check`, `pnpm weather:check` et
  parcours navigateur omis, le code livré ne changeant pas.
- Temps de calcul du planning, 5 octobre 2026 au soir (point 28), contrôles
  joués en local sur la branche : lint sans avertissement (28 s), typage
  sans erreur (7 s), 572 tests réussis en 23 s — un ajouté —, compilation
  réussie (15 s), `pnpm knip` sans code mort (13 s), `pnpm push:check` et
  `pnpm weather:check` réussis (9 et 10 s) ; parcours navigateur joués deux
  fois, 23 sur 24 chaque fois (7 min 0 s et 6 min 54 s), le P9 à la largeur
  ordinateur échouant au même clic : la trace montre l'onglet « Par série »
  cliqué deux secondes après le rechargement, les modules se chargeant encore
  trois dixièmes de seconde plus tard ; le P9 rejoué seul réussit en 34 s ;
  point 37, sans lien avec la correction.
- Décision D-030 consignée le 5 octobre 2026 au soir (point 31), contrat et
  registres seuls : lint sans avertissement (11 s), typage sans erreur
  (3 s), 571 tests réussis en 37 s ; compilation, `pnpm knip`,
  `pnpm push:check`, `pnpm weather:check` et parcours navigateur omis,
  aucun code modifié.
- Retrait du réglage R1 le 5 octobre 2026 au soir (D-029), contrôles joués
  en local sur la branche : lint sans avertissement (26 s), typage sans
  erreur (8 s), 571 tests réussis en 1 min 41 s — deux ajoutés, dont un de
  persistance —, compilation réussie (11 s), `pnpm knip` sans code mort
  (10 s, les indications de configuration connues), `pnpm push:check`
  et `pnpm weather:check` réussis (8 et 7 s). Parcours navigateur : 22 sur
  24 au premier passage, P10 arrêté aux deux largeurs par la note du pli
  qui réutilisait la classe de la ligne « calculé le » ; classe propre, puis
  24 parcours réussis, douze aux deux largeurs, en 5 min 38 s.
- Quatrième recette réelle du planning le 5 octobre 2026 au soir, registres,
  recette et deux décisions seuls, contrôles joués en local sur la branche :
  lint sans avertissement (31 s), typage sans erreur (10 s), 569 tests
  réussis en 87 s. Compilation, `pnpm knip`, `pnpm push:check`,
  `pnpm weather:check` et parcours navigateur non joués : aucun fichier hors
  `docs/` et `CHANGELOG.md` modifié ; la CI de la PR les joue tous.
- Troisième recette réelle du planning le 5 octobre 2026, registres et
  recette seuls, contrôles joués en local sur la branche, machine libre :
  lint sans avertissement (12 s), typage sans erreur (4 s), 569 tests
  réussis en 35 s. Compilation, `pnpm knip`, `pnpm push:check`,
  `pnpm weather:check` et parcours navigateur non joués : aucun fichier hors
  `docs/` et `CHANGELOG.md` modifié ; la CI de la PR les joue tous.
- Registres des fusions et déploiements des PR #131 et #132 le 4 octobre
  2026, contrôles joués en local sur la branche, machine libre : lint sans
  avertissement (9 s), typage sans erreur (3 s), 569 tests réussis en 37 s.
  Compilation, `pnpm knip`, `pnpm push:check`, `pnpm weather:check` et
  parcours navigateur non joués : registres seuls, aucun fichier hors
  `docs/` modifié ; la CI de la PR les joue tous.
- Test de performance du planning à deux secondes le 4 octobre 2026 (D-027,
  point 23), contrôles joués en local sur la branche, machine libre : lint
  sans avertissement (10 s), typage sans erreur (3 s), 569 tests réussis en
  36 s, la semaine complète calculée en 562 ms, compilation (« Build
  complete », 5 s), `pnpm knip` code 0 (les dix mêmes indications de
  configuration), `pnpm push:check` 11 tests et `pnpm weather:check` 2 tests
  réussis. Parcours navigateur non joués : ni l'interface ni les services
  qu'elle appelle ne changent, un test et des registres seulement.
- Ordre des journaux et des révisions départagé par `rowid` le 4 octobre
  2026 (point 27), contrôles joués en local sur la branche : lint sans
  avertissement (27 s), typage sans erreur (16 s), 569 tests réussis en
  51 s, rejoués seuls après une première passe à 568 sur 569 en 86 s où le
  test de performance du planning (point 23) avait dépassé la seconde,
  1 421 ms, la machine chargée à 58 % par d'autres programmes ; compilation
  (« Build complete », 13 s), `pnpm knip` code 0 (les dix mêmes indications
  de configuration), `pnpm push:check` 11 tests et `pnpm weather:check`
  2 tests réussis ; parcours navigateur : la
  suite entière jouée seule, 24 réussis aux deux largeurs (2 min 53, de
  21 h 52 à 21 h 55), serveur sous miniflare. Avant la correction, les
  cinq tests nouveaux étaient rouges : quatre de persistance (8 au lieu de
  5, 20 au lieu de 25, 60 au lieu de 40, 20 au lieu de 15) et un du domaine
  (14 au lieu de 35).
- P10 sans manque d'eau le dimanche soir, le 4 octobre 2026 (point 25),
  contrôles joués en local sur la branche, la machine à peu près libre : lint
  sans avertissement, typage sans erreur, 560 tests réussis (40 s),
  compilation (« Build complete », `dist/server/wrangler.json` présent),
  `pnpm knip` code 0 (les dix mêmes indications de configuration),
  `pnpm push:check` 11 tests et `pnpm weather:check` 2 tests réussis ;
  parcours navigateur : la suite entière un dimanche soir, 24 réussis aux
  deux largeurs (3 min 24, de 20 h 41 à 20 h 44), P7 avec sa vérification de
  l'arbitrage caduc et P10 à 390 px compris, après l'échec de P10 à 390 px à
  20 h 14 dans la suite arrêtée au premier échec avec les parcours d'avant ;
  serveur sous miniflare.
- Refus levé du volume invérifiable sous limite le 4 octobre 2026 (point 12),
  contrôles joués en local sur la branche, la machine chargée par un autre
  programme à plus de la moitié du processeur : lint sans avertissement,
  typage sans erreur, 564 tests dont 563 réussis et 1 échec à deux passages
  (1 min 24 puis 1 min 23) — le test de performance du planning du point 23,
  1 461 ms pour une limite de 1 000 ms, sans lien avec la correction, qui ne
  touche pas le moteur —, compilation (« Build complete »,
  `dist/server/wrangler.json` présent), `pnpm knip` code 0 (les dix mêmes
  indications de configuration), `pnpm push:check` 11 tests et
  `pnpm weather:check` 2 tests réussis ; parcours navigateur : 23 réussis
  sur 24 (5 min 12), P10 à 390 px en échec à 18 h 05 faute d'eau un dimanche
  soir (point 25), réussi seul à 18 h 11 ; serveur sous miniflare.
- P10 indépendant de l'heure le 4 octobre 2026 (point 22), contrôles joués en
  local sur la branche : lint sans avertissement, typage sans erreur,
  560 tests réussis, compilation (« Build complete »,
  `dist/server/wrangler.json` présent), `pnpm knip` code 0 (les dix mêmes
  indications de configuration), `pnpm push:check` 11 tests et
  `pnpm weather:check` 2 tests réussis ; parcours navigateur : P10 seul aux
  deux largeurs avec la plage fermée à 11 h 20 pour forcer la carte
  raccourcie, 2 réussis en 45 s à 10 h 29, sur une carte « 10:30 → 11:20 »,
  50 min, 8,33 mm, motif « ce qui tient dans la plage horaire », relue en base
  locale, sans aucune carte à 10 mm ; puis la suite entière, plage rendue à
  23 h 59, 24 réussis aux deux largeurs (2 min 42 s, de 10 h 31 à 10 h 34),
  serveur sous miniflare.
- Clôture de D-016 le 3 octobre 2026, PR de documentation seule : lint sans
  avertissement, typage sans erreur, 560 tests réussis, compilation (« Build
  complete »), `pnpm knip` code 0 (les mêmes indications de configuration),
  `pnpm push:check` 11 tests et `pnpm weather:check` 2 tests réussis.
  `pnpm e2e` omis : seuls `docs/` et `CHANGELOG.md` changent ; le job des
  parcours, requis, le joue sur la PR.
- Garde de la réserve corrigée le 2 octobre 2026 (point 19), contrôles joués
  en local sur la branche : lint sans avertissement, typage sans erreur,
  560 tests réussis dont celui des chiffres de la ferme, qui échouait avant
  la correction, compilation (« Build complete », `dist/server/wrangler.json`
  présent), `pnpm knip` code 0 (les dix mêmes indications de
  configuration), `pnpm push:check` 11 tests et `pnpm weather:check` 2 tests
  réussis, parcours navigateur joués deux fois : à 23 h 06, 22 réussis et
  P10 échoué aux deux largeurs par l'heure, sans rapport avec la PR (point
  22) ; rejoués à 23 h 43, 24 réussis aux deux largeurs (3 min 48 s), serveur
  sous miniflare ; la carte datée relue en local sur le serveur de
  développement, nom accessible et ligne du matériel conformes aux parcours,
  sans débordement à 375 px.
- Épinglages d'`undici` et de `ws` levés le 2 octobre 2026, verrou de `main`
  plus `undici` 7.29.1 et `ws` 8.21.0, contrôles joués en local : lint sans
  avertissement, typage sans erreur, 558 tests réussis, compilation (« Build
  complete », `dist/server/wrangler.json` présent), `pnpm knip` code 0 (les
  dix mêmes indications de configuration), `pnpm push:check` 11 tests et
  `pnpm weather:check` 2 tests réussis, `pnpm e2e` 24 parcours réussis aux
  deux largeurs en 3 min 24 s, le serveur des parcours tournant sous le
  miniflare qui reçoit les nouvelles versions.
- Protection de `main` complétée le 2 octobre 2026, PR de documentation
  seule : lint sans avertissement, typage sans erreur, 558 tests réussis,
  compilation (« Build complete », `dist/server/wrangler.json` présent),
  `pnpm knip` code 0 (les dix mêmes indications de configuration),
  `pnpm push:check` 11 tests et `pnpm weather:check` 2 tests réussis.
  `pnpm e2e` omis : aucun fichier hors `docs/`, `AGENTS.md` et
  `CHANGELOG.md` ne change ; le job des parcours, désormais requis, le
  joue sur la PR.
- Registres des dépendances du 1er octobre 2026, PR de documentation seule,
  contrôles joués en local sur le verrou de `main` après la série
  (TypeScript 6.0.3, next 16.3.6) : lint sans avertissement, typage sans
  erreur, 558 tests réussis, compilation (« Build complete »,
  `dist/server/wrangler.json` présent), `pnpm knip` code 0 sans code
  inutilisé mais dix indications de configuration sur `knip.json` — entrées
  et motifs d'exclusion que knip juge redondants —, présentes en CI dès #120
  et absentes du contrôle local du 29 septembre ; les deux entrées
  précédentes de ce registre qui en comptaient quatre se trompaient, le
  nettoyage de `knip.json` est à faire dans une PR `chore/` ;
  `pnpm push:check` 11 tests et `pnpm weather:check` 2 tests réussis.
  `pnpm e2e` omis : aucun fichier hors `docs/` et `CHANGELOG.md` ne
  change, et les parcours ont tourné en CI sur chacune des six PR.
- Montée de vinext en 1.0.0 le 1er octobre 2026 : lint sans avertissement,
  typage, 558 tests réussis, compilation (« Build complete »,
  `dist/server/wrangler.json` présent), `pnpm knip` code 0 (indications
  de configuration sur `knip.json`, dix en CI), `pnpm push:check` 11 tests et
  `pnpm weather:check` 2 tests réussis, les 24 exécutions des parcours
  navigateur en 3,1 min avec la nouvelle commande de démarrage.
- Correction des parcours P4 et P5 le 1er octobre 2026 : lint sans
  avertissement, typage, 558 tests réussis, compilation, `pnpm knip` sans
  code inutilisé (indications de configuration sur `knip.json`, dix en CI,
  déjà présentes sur `main`), `pnpm push:check` 11 tests et
  `pnpm weather:check` 2 tests réussis, les 24 exécutions des parcours
  navigateur deux fois de suite (2,9 min puis 3,0 min) ; à la seconde passe,
  la fiche de P4 téléphone était bien en page 2, et le parcours l’a feuilletée.
- Seconde recette du planning, PR de documentation le 29 septembre 2026 dans
  la nuit : lint sans avertissement, typage, 558 tests réussis, exécutés sur
  `main` inchangé ; compilation, `pnpm knip`, `pnpm push:check`,
  `pnpm weather:check` et parcours navigateur omis : seuls des fichiers de
  `docs/` et `CHANGELOG.md` changent.
- Moteur 3.5, PR de la portée (R13) le 29 septembre 2026 dans la nuit : lint
  sans avertissement, typage, 558 tests réussis dont cinq de la portée
  nouveaux, compilation, `pnpm knip` sans signalement, `pnpm push:check` et
  `pnpm weather:check` réussis, 24 parcours navigateur aux deux largeurs —
  le formulaire des réglages gagne un champ, P10 le traverse.
- Interface 3.6, PR de l'écran le 29 septembre 2026 dans la nuit : lint sans
  avertissement, typage, 553 tests réussis dont cinq de présentation et un de
  persistance nouveaux, compilation, `pnpm knip` sans signalement,
  `pnpm push:check` et `pnpm weather:check` réussis, 24 parcours navigateur
  aux deux largeurs dont le nouveau P10. Les premiers passages ont corrigé deux
  parcours, pas l'écran : un filtre de P10 mal ancré, et P9 qui jugeait la
  première ligne de l'export au lieu de la sienne — les irrigations que P10
  valide puis annule restent dans l'historique (D-006) et y passent devant.
  Une relecture de l'écran par l'assistant sur le serveur local, à 1 280 px et
  à 390 px, a corrigé deux détails de style que les parcours ne voient pas :
  six cartes de résumé sur une ligne à 1 280 px, et l'en-tête d'une carte à
  390 px où l'heure chevauchait le nom du matériel ; compilation et les 24
  parcours rejoués après.
- Moteur 3.5, troisième PR (actions et validation) le 29 septembre 2026 tard
  dans la soirée : lint sans avertissement, typage, 547 tests réussis dont
  quatre nouveaux de persistance, compilation, `pnpm knip` sans signalement,
  `pnpm push:check` et `pnpm weather:check` réussis, 22 parcours navigateur
  aux deux largeurs — la garde de la limite journalière ayant changé de
  fichier, les parcours qui planifient et démarrent une irrigation la
  traversent.
- Moteur 3.5, seconde PR (registre et service) le 29 septembre 2026 au soir :
  lint sans avertissement, typage, 543 tests réussis dont sept nouveaux de
  persistance, compilation, `pnpm knip` sans signalement, `pnpm push:check`
  et `pnpm weather:check` réussis, `pnpm db:migrate:local` (0017 appliquée).
  Parcours navigateur **non relancés, sans rapport** : aucun écran.
- Moteur 3.5, première PR (domaine) le 29 septembre 2026 au soir : lint sans
  avertissement, typage, 537 tests réussis dont dix-sept nouveaux — treize du
  moteur, quatre des réglages et plages —, compilation, `pnpm knip` sans
  signalement, `pnpm push:check` et `pnpm weather:check` réussis. Parcours
  navigateur **non relancés, sans rapport** : aucun écran ni service touché.
- Cadrage 3.5.0 le 29 septembre 2026 : aucun contrôle relancé, sans rapport —
  la PR n'ajoute qu'un contrat et met les registres à jour, aucun fichier de
  production ni de test.
- Extension séries 5.1, recette réelle et correction le 29 septembre 2026 au
  soir : lint sans avertissement, typage, 520 tests réussis (deux assertions
  ajoutées), compilation, `pnpm knip` sans signalement, `pnpm push:check`
  et `pnpm weather:check` réussis, 22 parcours navigateur aux deux largeurs.
- Extension séries 5.1, troisième PR (vue, export, parcours) le 29 septembre
  2026 : lint sans avertissement, typage, 520 tests réussis dont deux
  nouveaux — les séries présentes sur une planche un jour donné, la colonne
  « Séries » du CSV —, compilation, `pnpm knip` sans signalement,
  `pnpm push:check` et `pnpm weather:check` réussis, 22 parcours navigateur
  aux deux largeurs dont le nouveau P9.
- Extension séries 5.1, seconde PR (domaine et service) le 29 septembre 2026 :
  lint sans avertissement, typage, 518 tests réussis dont vingt-deux
  nouveaux, compilation, `pnpm knip` sans signalement, `pnpm push:check` et
  `pnpm weather:check` réussis, 20 parcours navigateur aux deux largeurs
  (le dépôt d'historique change, aucun écran encore).
- Extension séries 5.1, première PR (connecteur et instantané) le 29 septembre
  2026 : lint sans avertissement, typage, 502 tests réussis dont seize
  nouveaux, compilation, `pnpm knip` sans signalement, `pnpm push:check` et
  `pnpm weather:check` réussis, 20 parcours navigateur aux deux largeurs
  (les données de démonstration changent, aucun écran encore). Test de fumée
  sur la ferme du porteur, clé exposée au seul processus Node : dix routes,
  254 séries lues dont 2 en bloc, 397 emplacements tous rattachés, 6 103
  tâches lues en treize pages, 245 tâches d'implantation retenues.
- Recette réelle de l'étape 5.0 le 29 septembre 2026 : aucun contrôle relancé,
  sans rapport — la PR ne touche que les registres ; la recette elle-même est
  consignée dans le journal ci-dessus et dans le bloc 5.0 de la roadmap.
- Contrat de l'extension séries le 26 septembre 2026 : lint, typage et 471
  tests réussis. Compilation, `knip`, contrôles des Workers et parcours
  navigateur **non relancés, sans rapport** : la PR n'ajoute qu'un contrat et
  met les registres à jour, aucun fichier de production ni de test.
- Bouton « Corriger » d'un relevé le 25 septembre 2026 : lint sans
  avertissement, typage, 471 tests dont un nouveau sur le découpage d'une durée
  en heures et minutes, compilation, `pnpm knip` sans signalement,
  `pnpm push:check`, `pnpm weather:check` et les 20 parcours navigateur
  réussis, P5 éprouvant désormais la correction aux deux largeurs.
- Clôture de la recette 3.1 bis le 25 septembre 2026 : lint, typage et 470
  tests réussis. Compilation, `knip`, contrôles des Workers et parcours
  navigateur **non relancés, sans rapport** : la PR ne touche que les quatre
  registres et le protocole de recette, aucun fichier de production ni de test.

## Points ouverts réels

1. **Fermé le 25 septembre 2026.** La recette utilisateur de la sous-tranche 3.4
   est entièrement passée sur le site privé, **sans un seul défaut bloquant**.
   Partie A close le 21 septembre, parties B et C le 24, groupe B6 le 25 : sa
   part mesurable est tenue par le parcours automatisé P7 — mise en page,
   absence de débordement, cibles tactiles — et le geste sur l'appareil a été
   constaté par le porteur sur son propre téléphone, sur une pénurie réelle
   provoquée puis rétablie. Deux lignes seulement, B2.2 et C2, n'avaient pas de
   cas à observer sur cette ferme cette semaine-là. Détail et écarts au
   protocole dans `docs/recette-3.4.md`.
2. **Fermé le 21 septembre 2026.** La synchronisation météo automatique alimente
   bien la semaine sélectionnée sans action manuelle : lignes A1 et A4 de la
   recette réussies deux matins consécutifs, les 20 et 21 septembre, à 06:15
   chacun. La ligne A2, en échec le premier matin, est corrigée et revérifiée
   le 21. La ligne A5 est vérifiée le 28 septembre : une pluie saisie au
   pluviomètre survit à l'arrivée de la réanalyse du même jour (5 mm saisis
   le 21, réanalyse à 0 mm, 5 mm retenus).
3. ✅ **Débloqué le 26 septembre 2026.** L'API d'Ouvre ta ferme expose
   désormais l'occupation des planches par série, les séries, les tâches et
   les interventions. Reconnaissance faite sur la ferme du porteur, règle
   d'occupation vérifiée sur trois séries, décisions consignées (D-021) et
   contrat écrit (`docs/series-contract.md`). **Contrat validé par le porteur
   le 28 septembre 2026** (D-022). Reste, dans l'ordre : l'alignement des
   planches sur la surface mouillée en aspersion (roadmap 5.0 ; contrat
   `docs/wetted-surface-contract.md` écrit et validé le 28 septembre ; **close
   le 29 septembre 2026**, deux PR de code fusionnées et déployées, recette
   réelle passée sur la ferme), puis le développement des séries (5.1, **close
   le 29 septembre 2026** : trois PR fusionnées et déployées, recette réelle
   passée sur trois séries de la ferme sans écart, `docs/recette-series.md`),
   puis le cadrage 3.5.0 : **contrat écrit le 29 septembre 2026
   (`docs/planning-contract.md`), **validé en entier par le porteur le soir
   même (D-024)** ; **le moteur 3.5 est développé** : trois PR fusionnées et
   déployées le 29 septembre 2026 (#109, #110, #111), sa recette réelle se
   fera avec l'écran ; **l'interface 3.6 est close** le 29 septembre au soir
   (#112, recette réelle passée sur la ferme) ; **la recette réelle du
   moteur** (`docs/recette-planning.md`) montre les goutte-à-goutte et les
   rampes de serre justes, mais les rampes de bloc à profil sur-arrosées par
   la règle R11 : **R13 tranchée le soir même (D-025, point 17)**, PR de la
   portée #114 fusionnée et déployée avec les deux corrections d'explication
   (point 18) ; **seconde recette réelle à 21 h 20 : la portée tient, mais la
   garde de la réserve est inopérante (point 19)** ; correction, puis
   troisième recette.
4. ✅ **Recette faite le 9 octobre 2026 au soir par l'assistant dans le Chrome
   du porteur, sur son mot, sur le site déployé, sans modifier aucune donnée ;
   fermé par le porteur le 10 octobre 2026.** Recette utilisateur de la
   sous-tranche 3.3.1 sur le site privé, sur une semaine où l'ET0 est
   inférieure à l'objectif : le besoin affiché doit valoir l'objectif moins
   les pluies et irrigations, l'ET0 restant affichée pour information. — Le 9
   octobre 2026, le porteur demande si l'assistant peut modifier l'ET0 pour le
   test puis la remettre : inutile et déconseillé, l'ET0 venant du fournisseur
   météo ; la condition s'obtient en relevant l'objectif d'une planche
   au-dessus de l'ET0 de la semaine, constat par l'assistant dans son
   navigateur sur le site déployé, objectif remis ensuite, jugement à lui
   (D-014). Faite le 9 octobre 2026 vers 21 h 47, après les PR des points 36,
   40 et 34, sur la semaine du 5 au 11 octobre : un seul objectif, « Toute la
   ferme » à 20 mm par semaine, et une ET0 de la semaine de 12,4 mm affichée
   « Information · hors calcul », donc inférieure à l'objectif sans rien
   relever ni toucher. Sous abri (tunnels 1 à 4), pluie réelle 0 et irrigation
   réelle 0 : reste réel 20 mm, l'objectif entier, déficit relatif 100 %,
   reste brut à planifier 20 mm après le seuil de 5 mm, volume 0,32 m³ pour
   16 m² mouillés et 0,64 m³ pour 32 m² ; l'ancienne règle, demande plafonnée
   par l'ET0, aurait affiché 12,4 mm. En plein champ, 23,2 mm de pluie réelle
   ramènent le reste réel à 0 mm, sans départager les deux règles. Largeur
   390 px non rejouée, l'interface ne changeant pas. Fermé par le porteur le
   10 octobre 2026 (« Fermer le point 4 »).
5. **Fermé le 3 octobre 2026.** Hébergement : Cloudflare depuis le
   19 septembre 2026 (D-016, procédure `publication.md`), déploiement
   automatique à chaque fusion, plan Workers payant (D-017), code Sites retiré
   (phase 4), recette 3.4 close le 25 septembre. Le porteur a supprimé le site
   Sites le 3 octobre 2026, après quatorze jours sans incident ; l'ancienne
   adresse répond 404. **D-016 et Q0 sont closes.**
6. Résolu le 20 septembre 2026 : les PR Dependabot sont traitées par lots et
   toutes fermées. Restent une quinzaine d'alertes de vulnérabilité, toutes
   issues de dépendances de développement tirées par Wrangler et Miniflare,
   qui ne partent jamais dans le Worker déployé ; leur correction dépend d'une
   version de Wrangler qui ne les embarque plus, à surveiller.
7. ✅ **Fermé le 9 octobre 2026 : recette légère du retrait de la pompe par
   défaut faite sur le site.** Corrigé le 19 septembre 2026 : les deux défauts
   révélés par les tests de persistance (retrait de la pompe par défaut,
   contrainte des besoins par planche) ; voir le journal des changements.
   Recette légère faite le 9 octobre 2026 au soir par l'assistant dans le
   Chrome du porteur, sur son mot, sur le site déployé : dans « Pompe
   habituelle du matériel », la pompe de `gag1` passée de « La pompe » à
   « Aucune pompe · non vérifié », avis « La pompe habituelle du matériel a
   été enregistrée. », retrait conservé après rechargement complet de la page,
   les 33 autres matériels inchangés ; pompe remise ensuite, même avis, les 34
   matériels sur « La pompe » après rechargement. Données remises en état.
8. Résolu le 20 septembre 2026 : `pnpm dev` ne démarrait pas en local, le
   runtime du greffon Cloudflare `1.37.1` datant du 15 mai 2026, antérieur à la
   date de compatibilité du Worker. Le lot Vite de Q4 a monté le greffon en
   `1.56.0`, dont le runtime est du 18 septembre 2026 : le serveur démarre avec
   la date de compatibilité réelle, sans aucun contournement, et sert
   `/irrigation` en HTTP 200.
9. **Fermé le 25 septembre 2026, le jour de son ouverture.** Les lignes R3 et
   R20 de la recette 3.1 bis ont été revérifiées sur la version déployée à
   21:39, PR 93 fusionnée et déploiement terminé : l'heure proposée est
   acceptée sans y toucher, le relevé s'affiche à l'heure même qui était
   proposée, et la réponse de l'écran paraît seize pixels sous le bouton. **La
   sous-tranche 3.1 bis est close.**
10. **Ouvert puis fermé le 25 septembre 2026.** Le contrat promettait une
   correction de relevé que l'écran n'offrait pas ; chaque ligne du tableau
   porte désormais « Corriger », et le parcours P5 l'éprouve. Énoncé
   d'origine : `docs/resource-flow-contract.md` pose qu'« un
   relevé se modifie et se supprime ». La persistance sait le faire —
   `saveResourceMeterReadingForUser` accepte un identifiant et écrit un
   `UPDATE`, et un test de persistance vérifie qu'une correction ne touche pas
   la révision — mais l'action de l'écran ne transmet pas cet identifiant, et le
   tableau n'offre que « Supprimer ». Corriger une heure oblige donc à
   supprimer puis ressaisir, ce qui coupe le lien entre la révision et ses
   relevés. Comblé le soir même.
11. ✅ **Ouvert le 29 septembre 2026, au jugement du porteur ; tranché et
   corrigé le 9 octobre 2026 (D-032), PR #153 fusionnée et déployée le 9
   octobre 2026.** La vue « Par périmètre » des cumuls compte la pluie réelle
   sur une planche sous abri — 27,7 mm sur T1-8 du 7 au 29 septembre — alors
   que la vue « Par série » applique la règle « sous abri, la pluie vaut
   zéro » du cahier des charges et que le tableau des besoins l'applique
   aussi. Le résumé de l'historique par périmètre date de la tranche 2 et n'a
   jamais connu l'abri. Faut-il l'aligner ? Une règle en un seul endroit le
   voudrait ; c'est un changement de comportement d'un écran existant, donc
   une décision. — Tranché le 9 octobre 2026 par le porteur, « il ne pleut
   jamais sous abri, donc il faut aligner la règle » (D-032) : règle écrite au
   contrat des séries ; test du domaine rouge d'abord
   (`tests/irrigation-history.test.ts`, périmètre sous abri avec et sans
   météo, périmètre mixte de 100 m² sous abri et 300 m² de plein champ :
   `expected 0, actual 8`) ; `buildIrrigationHistorySummary` reçoit les
   parcelles et pondère la pluie réelle par la surface des planches, zéro sur
   celles d'un jardin sous abri — un périmètre entièrement sous abri lit 0 mm,
   complet, quelle que soit la météo ; l'écart suit — ; le service passe
   `snapshot.plots`. Contrôles complets, parcours compris. Recette sur T1-8 à
   faire après déploiement.
12. ✅ **Ouvert le 29 septembre 2026, trouvé en relisant le code pour le
   moteur ; corrigé le 4 octobre 2026 (PR `fix/limite-volume-inconnu`).**
   `lib/services/irrigation-limits.ts` — la garde avait quitté
   `app/irrigation/irrigation-event/limits.ts` le 29 septembre — : une
   irrigation planifiée ou démarrée dont le volume est inconnu sous une
   limite journalière active n'était pas refusée — la fonction *rendait* le
   message de refus au lieu de le *lancer*, et l'action enregistrait
   l'irrigation avec ce texte en avertissement ; la validation d'une
   proposition du planning, elle, lisait ce message et refusait.
   `docs/wetted-surface-contract.md` dit qu'elle doit être refusée. —
   Corrigé le 4 octobre 2026 : la garde lève
   `IrrigationDailyLimitExceededError`, que l'action rend en échec par
   `handledError` et que la validation du planning rend « refusée » par son
   `catch` ; la ligne de la validation qui écoutait le message rendu est
   retirée, le contrat précisé. Tests : `tests/db/irrigation-limits.test.ts`,
   quatre tests — refus levé pour une irrigation planifiée et pour une
   démarrée, acceptation sans limite ou limite désactivée, dépassement par
   volume connu inchangé (refusé planifié, signalé réel) et irrigation réelle
   toujours enregistrable, traduction du refus en échec par l'action —, le
   premier échouant avant la correction (« Missing expected rejection »).
   L'action elle-même n'est pas exécutée sous Node : elle lit `next/headers`
   et `next/cache`, que l'outillage de test ne remplace pas ; la preuve passe
   par la garde et par `handledError`, le chemin entre les deux se lisant dans
   `saveIrrigationEventAction`. Trouvé au passage : la garde du démarrage
   ignore le volume inconnu (point 24). **Clos.**
13. ✅ **Ouvert le 29 septembre 2026, même relecture ; confirmé et corrigé le 9
   octobre 2026, PR #155 fusionnée et déployée le 9 octobre 2026.** À la
   modification d'une irrigation planifiée, le journal d'eau journalier compte
   probablement l'ancien volume planifié en plus du nouveau :
   `buildDailyWaterLedger` est appelé sans exclure l'irrigation modifiée. À
   vérifier par un test puis corriger. — Confirmé à la lecture le 9 octobre
   2026 : `saveIrrigationEventAction` passait l'irrigation modifiée à la
   validation hydraulique (`excludedEventEquipmentId`) mais pas à la garde
   journalière. Règle écrite au modèle de données (2.8) ; trois tests de
   persistance rouges d'abord (`tests/db/irrigation-limits.test.ts` : à volume
   égal sous 1 m³, « 0,75 m³ planifiés, 0,75 m³ pour cette irrigation,
   dépassement 0,5 m³ ») ; `enforceDailyLimitForCreation` reçoit l'irrigation
   modifiée et la retire du journal (`buildDailyWaterLedger`, même mécanisme
   que la garde du démarrage), l'action la lui passe. Contrôles complets,
   parcours compris. Recette sur le site après déploiement : modifier une
   irrigation planifiée sous une limite journalière, sans changer son volume,
   doit passer.
14. ✅ **Ouvert le 29 septembre 2026, même relecture ; corrigé le 9 octobre
   2026, PR `fix/limite-prelevement-jour-ferme` ouverte.**
   `resolvePumpOriginAvailability` (`lib/domain/pumps.ts`) prend le jour d'un
   créneau en UTC (`startsAt.slice(0, 10)`) et non à la ferme : un créneau de
   0 h 30 heure de Paris est compté la veille pour la limite de prélèvement
   d'une ressource directe. Le moteur de planning, lui, raisonne en jours de
   la ferme (D-004). À aligner. — Corrigé le 9 octobre 2026 sur le mot du
   porteur (« continue la suite ») : règle écrite au contrat hydraulique 3.2 ;
   test du domaine rouge d'abord, trois cas lus la veille en UTC — un créneau
   de 0 h 30 heure de Paris sous une limite entamée le matin même, un
   prélèvement de 0 h 00, une période de disponibilité ouverte le jour même
   — ; `resolvePumpOriginAvailability` prend désormais le jour par
   `dateKeyInTimeZone`, fuseau de la ferme par défaut, ses deux appelants
   inchangés. Relevé en passant, consigné au point 38 : la 3.2 ne compte dans
   la limite du jour que les prélèvements directs. Contrôles complets,
   parcours compris. PR #152 fusionnée par le porteur à 10 h 56 et déployée à
   11 h 03 le 9 octobre 2026.
15. ✅ **Ouvert le 29 septembre 2026, trouvé en écrivant le parcours P10, au
   jugement du porteur ; tranché et corrigé le 9 octobre 2026 (D-033), PR #153
   fusionnée et déployée le 9 octobre 2026.** Une planche sans objectif mais
   avec un besoin manuel est servie par la faisabilité 3.4 — le besoin manuel
   remplace le calcul — mais le moteur de planning la dit « non planifiable :
   aucun objectif applicable » (`remainingNeedMm`,
   `lib/domain/planning/demand.ts`, teste l'objectif avant le remplacement).
   Le contrat écrit « planche sans objectif : non planifiable » ; la
   faisabilité dit autre chose. Aligner l'un ou l'autre est une décision. —
   Tranché le 9 octobre 2026 par le porteur, « elle est servie par la
   faisabilité » (D-033) : contrat du planning aligné — le remplacement manuel
   tient lieu d'objectif, seule une planche sans objectif ni besoin manuel est
   non planifiable — ; test du moteur rouge d'abord
   (`tests/planning-engine.test.ts`, planche sans objectif au besoin manuel de
   12 mm, motif `no-objective`) ; `remainingNeedMm` lit le remplacement manuel
   avant l'objectif. Contrôles complets, parcours compris.
16. ✅ **Ouvert le 29 septembre 2026, même parcours, au jugement du porteur ;
   tranché et corrigé le 9 octobre 2026 (D-034), PR #153 fusionnée et déployée
   le 9 octobre 2026.** Un objectif posé en cours de semaine ne vaut pas pour
   la semaine : la 3.3 ne tient l'objectif d'une semaine pour complet que si
   un objectif s'applique à ses sept jours (`objectiveForBed`,
   `lib/domain/irrigation-needs.ts`), un objectif posé un mercredi ne couvrant
   que du mercredi au dimanche. Une ferme qui pose son premier objectif un
   mercredi lit donc « aucun objectif applicable » jusqu'au lundi suivant, et
   le planning ne propose rien. C'est le comportement de la tranche 2, sans
   effet sur la ferme du porteur, dont les objectifs datent ; le parcours P10
   pose le sien sur la semaine précédente pour cette raison. — Tranché le 9
   octobre 2026 par le porteur, « oui » (D-034) : règle écrite au contrat des
   besoins — la demande de la semaine est la somme des septièmes de l'objectif
   sur les jours qu'il couvre, seule une semaine sans aucun jour couvert est
   sans objectif, les jours sans objectif ne sont pas une donnée manquante — ;
   test du domaine rouge d'abord (`tests/irrigation-needs.test.ts`, 35 mm
   posés le mercredi donnent 25 mm sans donnée manquante, un objectif posé
   après la semaine ne la couvre pas : `expected 25, actual null`) ;
   `objectiveForBed` tient l'objectif pour applicable dès qu'un jour est
   couvert. Relevé en passant, consigné au point 39 : la vue « Par périmètre »
   de l'historique demande encore un objectif sur chaque jour-planche.
   Contrôles complets, parcours compris.
17. ✅ **Tranché le 29 septembre 2026 au soir (D-025), PR de la portée
   ouverte dans la nuit.** Ouvert le même soir par la recette réelle du
   planning. Sur les rampes de bloc à profil, la règle
   R11 (D-024, point 4) prend pour référence une planche de bord arrosée à
   2 mm/h et propose un créneau chaque nuit pour son reste : le centre reçoit
   le triple de son besoin, la réserve se vide, trois blocs restent secs
   (`docs/recette-planning.md`). Proposition de l'assistant : un réglage
   R13, part du débit nominal en dessous de laquelle une planche ne commande
   pas l'arrosage — ni référence de dose, ni R6, ni R7 —, son eau comptée,
   son reste affiché « portée du matériel insuffisante », 50 % au départ.
   Le porteur a retenu la proposition telle quelle ; la seconde recette
   réelle du même soir la vérifie : un créneau de 2 h par bloc, 69,243 m³
   pour 92,661 mobilisables, blocs 3, 8 et fleurs 3 servis, motifs justes.
   **Clos**, sous réserve de la troisième recette qui suivra le point 19.
18. ✅ **Ouvert le 29 septembre 2026, même recette ; corrigé dans la PR de la
   portée.** Deux défauts
   d'explication du moteur, à corriger dans la PR de R13 ou seuls : le motif
   « temps de pompage insuffisant » est mis par défaut quand aucune plage ne
   reste à un matériel (`placeCandidate`, `intervals.length === 0`), y
   compris quand l'espacement R7 l'a repoussé après dimanche — il manque un
   motif « espacement », et le résumé range ce manque dans « temps de
   pompage » ; le niveau projeté de la réserve sur chaque proposition est
   celui du moment du placement, non du plan fini — 57,4 m³ dimanche à côté
   de 0,00 m³ vendredi —, alors que le contrat demande « son niveau projeté
   à la fin ». Vérifié à la seconde recette du même soir : plus de « temps de
   pompage » par défaut, niveaux relus sur le plan fini — et c'est cette
   relecture qui rend le point 19 visible. **Clos.**
19. ✅ **Ouvert le 29 septembre 2026 à 21 h 20 par la seconde recette réelle du
   planning ; corrigé le 2 octobre 2026, fusionné et déployé le 3 (#125) ;
   fermé le 5 octobre 2026 au soir par la quatrième recette.** La garde de la
   réserve était inopérante avec un minimum de sécurité à zéro.
   `ReservoirTimeline.minimumLevel` (`lib/domain/planning/supply.ts`) borne le
   niveau à zéro à chaque rupture ; `evaluate` compare ce niveau borné au
   minimum de sécurité, 0 sur la ferme : le manque vaut toujours 0, le créneau
   passe. Sur la ferme, le plan tire 21,12 m³ qui n'existent pas entre
   mercredi 01 h 25 et 06 h 42 — 55,7 m³ prélevés la première nuit pour 34,8
   disponibles — et le résumé dit « Manque d'eau 0,00 m³ ». Le test
   d'invariant (`tests/planning-engine.test.ts`, « réserve : jamais sous le
   minimum ») lit le même niveau borné et ne peut pas échouer. Second trou :
   `evaluate` ne regarde que la durée du candidat, alors que le moteur ne
   place pas dans l'ordre du temps. Correction faite le 2 octobre 2026, comme
   prescrit : niveau affiché borné par zéro et par la capacité ; faisabilité
   jugée sur le niveau borné par la capacité seule, du début du créneau à la
   fin de l'horizon ; test sur les chiffres de la ferme qui a échoué d'abord
   (48,51 m³ tirés d'ici mercredi 8 h pour 39,78 disponibles) ; invariant
   rejoué sans la borne. Deux précisions en l'écrivant : un créneau
   qu'attendre l'apport ne sauve pas est raccourci par bissection sur les
   secondes entières, le prorata du manque laissant sa fin sous le minimum ;
   l'attente n'est proposée que si le point le plus bas tombe dans le créneau.
   Le défaut d'écran est pris au passage : deux cartes pouvaient porter le
   même nom (« Proposition p-12 » du calcul refusé et du nouveau calcul), la
   carte relue d'un calcul précédent porte désormais la date du sien. **PR
   #125 fusionnée le 3 octobre 2026 à 0 h 07 et déployée à 0 h 14. Troisième
   recette faite le 5 octobre 2026** : la carte datée est vérifiée, les 37
   créneaux du plan de 06 h 15 rejoués à la main sur la réserve, jamais sous 0
   (point bas 25,619 m³ lundi minuit), « Manque d'eau 0,00 » vrai ; mais la
   semaine ne met pas la réserve en pénurie (36,716 m³ demandés pour 112,62
   mobilisables), la garde n'est donc prouvée que par le test des chiffres de
   la ferme. Reste 🟡 jusqu'à une semaine sèche, ou une observation basse de la
   réserve si le porteur le décide. **Quatrième recette le 5 octobre 2026 au
   soir, pénurie fabriquée sur le mot du porteur** : forage indisponible, puis
   minimum de sécurité à 20 et à 40 m³ ; la réserve n'est jamais passée sous
   son minimum — 0,001 m³ quand il vaut 0, 20,00 et 40,00 exactement quand il
   est relevé —, les créneaux sont raccourcis ou décalés à l'heure exacte où
   l'apport comble le manque, les vagues décalées aux nuits suivantes au
   rythme du forage, une réserve déjà sous son minimum ne propose rien avant
   d'être remontée. La garde est prouvée sur la ferme. Fermé.

20. ✅ **Ouvert le 1er octobre 2026 en montant vinext, fermé le 2 octobre
   2026.** GitHub signalait ce soir-là, avant la série de fusions, 35 alertes
   de vulnérabilité sur `main` (2 critiques, 14 hautes, 14 moyennes,
   5 basses) ; après la série, 34 (0 critique, 14 hautes, 15 moyennes,
   5 basses) : `undici` ×21, `brace-expansion` ×6, `fast-uri` ×3, `ws` ×2,
   `js-yaml` ×1 et `fflate` ×1, arrivé avec `satori` 0.33.5 que tire vinext
   1.0.0. Toutes sur des dépendances de développement.
   Les registres disaient depuis le 20 septembre qu'aucune action n'était
   possible, les versions d'`undici` et de `ws` venant de Wrangler et
   Miniflare. C'est inexact : `pnpm-workspace.yaml` les épingle lui-même
   (`undici: 7.24.8`, `ws: 8.18.0`, commit 4fc9a32 du 1er septembre
   2026), et Dependabot échoue à les corriger pour cette raison. Les
   versions corrigées sont `undici` 7.29.1 et `ws` 8.21.0 ; `js-yaml`
   (eslint) et `fast-uri` (webpack via vinext) sont transitives. À faire,
   sur le mot du porteur, dans une PR `chore/` : lever ou relever les deux
   épinglages, laisser les contrôles dire si Wrangler et Miniflare les
   acceptent, et retrouver pourquoi ils avaient été posés. — Fait le
   2 octobre 2026 : `ws` n'est plus épinglé, miniflare et le greffon Vite
   demandant eux-mêmes 8.21.0 ; `undici` est relevé à 7.29.1, avec sa raison
   et sa condition de retrait écrites dans `pnpm-workspace.yaml`. Pourquoi ils
   avaient été posés : le commit ne le dit pas ; son verrou montre qu'ils
   ramenaient le miniflare 5 du Wrangler 4.127.1 du nouveau Worker aux
   versions du miniflare 4 du Wrangler 4.92.0 de la racine, un seul
   exemplaire de chaque paquet pour deux générations — raison disparue, les
   trois `package.json` déclarant le même Wrangler 4.135.0. Contrôles
   complets verts, parcours compris. Vingt-trois alertes attendues fermées à
   la fusion, onze transitives restantes, à suivre avec les lots Dependabot.
   **Clos.**

21. ✅ **Ouvert le 1er octobre 2026 en relisant la protection de `main`,
   fermé le 2 octobre 2026 (D-026).**
   La règle (D-013) n'exige que les jobs « Application » et « Workers
   Cloudflare ». Le job « Parcours navigateur », ajouté par Q5 le
   20 septembre 2026, n'y est pas : une PR aux parcours rouges reste
   fusionnable, et rien ne l'empêche sinon la lecture. Décision du porteur
   attendue : exiger ce job ou non. Le réglage est le sien (Settings,
   Branches, `main`, « Require status checks ») ; D-013 serait alors
   complétée, ainsi que `AGENTS.md`, qui ne nomme que les deux jobs. —
   Tranché et réglé le 2 octobre 2026 : le job est requis, la règle relue par
   l'API, D-013 complétée par D-026, `AGENTS.md` nomme les trois jobs.
22. ✅ **Ouvert le 2 octobre 2026 à 23 h 06 en jouant les parcours avant la PR
   de la garde ; corrigé le 4 octobre 2026 (PR `fix/p10-heure`).** P10 dépend
   de l'heure : entre 23 h 00 et 23 h 41, la plage ouverte jusqu'à 23 h 59
   laisse moins d'une heure et plus que les 18 minutes de la dose minimale, le
   moteur propose aujourd'hui un créneau raccourci à la plage — 53 min, 8,8 mm
   à 23 h 06 — et la première carte n'est plus celle des « 10 mm » que le
   parcours attend. Les deux largeurs ont échoué à 23 h 06 et 23 h 07, sans
   rapport avec la PR : le matériel du parcours n'a pas de pompe et n'entre
   pas dans la garde. Le contrat des parcours promet qu'un parcours ne dépend
   pas du jour ni de la minute, il ne dit rien de l'heure. À corriger dans une
   PR de parcours : désigner la carte à 10 mm plutôt que la première, ou
   n'attendre un créneau du jour qu'avant 23 h ;
   `docs/browser-journeys-contract.md` à compléter. Rejoués à 23 h 43 le même
   soir, après la fenêtre : 24 réussis. **Reproduit en CI le 3 octobre 2026**
   sur la PR de clôture de D-016, documentation seule : job lancé à 23 h 21,
   P10 seul en échec aux deux largeurs, « 23:22 → 23:59 » au lieu de la carte
   attendue, les 22 autres réussis. Le job étant désormais requis (D-026), ce
   défaut bloque toute PR poussée dans la fenêtre ; rejoué hors fenêtre. —
   Corrigé le 4 octobre 2026 : le parcours lit la première carte à la dose
   entière et, un dimanche à cette heure, la carte raccourcie avec son motif
   « ce qui tient dans la plage horaire » ; règle ajoutée à
   `docs/browser-journeys-contract.md`, branche de repli exercée en local en
   fermant la plage moins d'une heure après le calcul. Reste connu : le
   dimanche de 23 h 42 à 23 h 59, aucun créneau ne tient et le parcours n'a
   rien à lire. **Clos.**
23. ✅ **Ouvert le 3 octobre 2026 à 23 h 45 par la CI de la PR de clôture
   de D-016**, documentation seule. Le test de performance du planning
   (`tests/planning-engine.test.ts`, « une semaine complète […] en moins
   d'une seconde ») a échoué dans le job « Application » : 1 016 ms pour
   une limite de 1 000 ms. Le même job était vert vingt minutes plus tôt
   sur la même PR. La suite entière y a duré 97 s, contre 36 s sur le poste
   du porteur : la machine de GitHub était lente. Ce test mesure un temps
   réel sur une machine partagée, et sa marge était déjà notée faible le
   2 octobre (620 à 910 ms sur le poste). Le job étant requis, ce test peut
   bloquer une PR sans défaut. À trancher dans une PR à part : alléger
   `minimumLevel`, piste notée le 2 octobre, ou revoir la mesure. Ne pas
   relever la limite sans décision. **Reproduit sur `main`** à la fusion de
   cette PR, le 3 octobre à 23 h 56 : 1 014 ms, job « Application » rouge,
   déploiement sauté. Le job seul a été relancé et il est passé, déploiement
   compris, le 4 octobre à 0 h 16. **Reproduit en local** le 4 octobre vers
   18 h, sur le poste du porteur chargé par un autre programme à plus de la
   moitié de ses douze cœurs logiques, à deux passages de `pnpm test` sur la
   branche `fix/limite-volume-inconnu` : 1 461 ms ; 1 253 ms le fichier joué
   seul. Le test est donc sensible à la charge de n'importe quelle machine,
   pas seulement à celle de GitHub. **Reproduit de nouveau sur `main`** à la
   fusion de la PR #129, le 4 octobre à 21 h 37 : 1 004 ms, job
   « Application » rouge, déploiement sauté, le second de la soirée après
   le run rouge du point 27 ; le site n'a donc pas reçu la correction du
   point 12. Et en local le même soir, 1 421 ms, la machine chargée à 58 %.
   Le job seul a été relancé sur le mot du porteur à 22 h 05 et il est passé,
   déploiement compris, à 22 h 08. **Reproduit sur la PR #131** du point 27,
   le 4 octobre à 21 h 59 : 1 022 ms, job « Application » rouge, les 568
   autres tests verts dont les cinq nouveaux. Quatre échecs en deux jours
   sur quatre machines de GitHub différentes : le point est à trancher
   avant toute autre PR. **Tranché le 4 octobre 2026 vers 22 h 30** par la
   décision D-027 : la limite du test passe à 2 000 ms, garde de complexité
   et non mesure de confort ; l'allègement de `minimumLevel` devient le
   point 28. PR #132 fusionnée par le porteur et déployée le 4 octobre à
   22 h 41. **Clos.**
24. ✅ **Ouvert le 4 octobre 2026, trouvé en corrigeant le point 12 ; corrigé
   le 9 octobre 2026, PR #151 fusionnée et déployée.**
   `enforceDailyLimitForStart` (`app/irrigation/irrigation-event/limits.ts`)
   juge le démarrage d'une irrigation planifiée sur
   `remainingIrrigationForStart`, dont le volume exclut les planches sans
   surface mouillée connue (`irrigationVolumeCubicMeters`) : une aspersion
   planifiée sans limite, dont une planche n'a pas de passe-pied, démarre sous
   une limite activée entre-temps, alors que le contrat dit « planifiée ou
   démarrée, refusée si une limite journalière est active ». La reprise passe
   par la même garde. — Corrigé le 9 octobre 2026 sur le mot du porteur
   (« continue la suite ») : règle précisée au contrat de la surface mouillée,
   le démarrage et la reprise refusent comme la création un volume
   invérifiable sous une limite active ; tests de la garde du démarrage rouges
   d'abord, une planche inconnue puis toutes, verts après, les cas inchangés
   fixés avec eux. Le jour limité se cherche désormais en un seul endroit,
   `firstLimitedDay` dans le domaine, testé à cheval sur minuit ; la garde à
   la création l'appelle à la place de son calcul en ligne, comportement et
   message inchangés. Contrôles complets, parcours compris. PR #151 fusionnée
   et déployée le 9 octobre 2026.
25. ✅ **Ouvert le 4 octobre 2026 vers 18 h, en jouant `pnpm e2e` pour le
   point 12 ; corrigé le soir même (PR `fix/p10-eau-dimanche`).** P10 à
   390 px, seizième parcours de la suite, a échoué un dimanche soir : le plan
   recalculé à 18 h 05 ne proposait rien pour sa planche T02, motif « stock
   et ressources insuffisants d'ici dimanche », manque d'eau 2,73 m³, soit
   tout le besoin de T01 et T02. P10 seul à 390 px a réussi à 18 h 11, et le
   job « Parcours navigateur » était vert le matin même à la fusion de la
   PR #128 (point 22). **Reproduit en CI** sur la PR #129 à 18 h 19, ce seul
   parcours rouge, « Application » et « Workers Cloudflare » verts.
   L'hypothèse du moment — la réserve de démonstration épuisée par les
   parcours précédents — était fausse : le matériel de P10 n'a pas de pompe,
   aucun budget d'eau ne le borne. Cause relue dans la base locale laissée par
   la suite arrêtée au premier échec, à 20 h 14 : P7 à l'ordinateur, dixième
   parcours, enregistre un arbitrage de la priorité Normale — servir N01
   seule — dont les candidates sont les sept planches, parce que l'objectif
   de 70 mm que P10 avait posé sur la semaine précédente a été copié sur la
   semaine courante et que « Tout vider » ne retirait que la précédente. Une
   décision n'est invalidée que par un recalcul de la faisabilité qui la
   trouve caduque, l'eau suffisant, ou dont les candidates ont changé. Les
   jours de semaine, l'eau suffit : la décision tombe, P10 passe. Un dimanche
   soir, l'eau mobilisable d'ici minuit — le forage de P5, 1,125 m³/h sur les
   heures qui restent — ne couvre plus les besoins : la décision reste valide,
   T01 et T02 sont « Non retenue lors de l'arbitrage manuel », allocation
   nulle, et le moteur, qui s'incline devant un arbitrage validé
   (`applyShortage`), ne propose rien. Sans lien avec le point 12 : aucune
   limite journalière n'est active dans ce parcours, et l'étape échouée
   précède toute validation. — Corrigé le 4 octobre au soir, dans les
   parcours seuls : P10 pose son objectif sur la semaine courante et sur la
   précédente et le retire des deux, chaque pose lue à la pastille qui
   apparaît ; P7, ses besoins et ses ressources rendus, recalcule la
   faisabilité et attend que l'écran déclare son arbitrage « plus
   applicable ». Règle ajoutée à `docs/browser-journeys-contract.md`. Suite
   entière rejouée un dimanche soir : 24 réussis aux deux largeurs de 20 h 41
   à 20 h 44, après l'échec de P10 à 390 px à 20 h 14 avec les parcours
   d'avant. **Clos.**
26. ✅ **Ouvert le 4 octobre 2026 au soir, trouvé en relisant le moteur pour le
   point 25 ; corrigé le 9 octobre 2026, PR #150 fusionnée et déployée.**
   Quand une décision d'arbitrage de la semaine existe encore mais qu'aucun
   niveau n'est « validé » — décision caduque ou à valider de nouveau —,
   `planning-service` passe au moteur un arbitrage vide (`[]`) et non nul ;
   `applyShortage` le tient pour un arbitrage, ne touche aucune cible et saute
   la conduite de pénurie R9 : les budgets des réserves et des ressources ne
   bornent plus les cibles de ce calcul. Sans effet sur les parcours, le
   matériel de P10 n'ayant pas de pompe ; effet possible sur la ferme la
   semaine où un arbitrage validé devient caduc, non constaté, non cherché. —
   Corrigé le 9 octobre 2026 sur le mot du porteur (« continue la suite ») :
   phrase ajoutée au contrat du planning, un arbitrage absent ou vide ne
   s'impose pas ; test du moteur rouge d'abord, le plan calculé avec un
   arbitrage vide contre le plan sans arbitrage sous une limite de 1 m³ par
   jour, budgets absents et cibles non bornées avant la correction, plans
   identiques après ; `applyShortage` tient désormais un arbitrage vide pour
   absent. Corrigé dans le moteur plutôt que dans le service, comme d'abord
   envisagé : la règle vit en un seul endroit, `lib/domain/`, et aucun
   appelant ne peut plus la contourner ; `planning-service` inchangé. Noté
   sans être corrigé : un arbitrage validé sur un seul niveau laisse les
   autres niveaux sans budget de pénurie, conception de la 3.5 antérieure à ce
   point, à trancher à part. Contrôles complets, parcours compris. PR #150
   fusionnée et déployée le 9 octobre 2026.

27. ✅ **Ouvert le 4 octobre 2026 vers 21 h, par le run de `main` lancé par la
   fusion de la PR #130.** Le job « Application » a rougi sur le test 87,
   `tests/db/planning-repository.test.ts`, « le plus récent d'abord » : 8 au
   lieu de 5, 559 tests verts, déploiement sauté sans conséquence, la PR ne
   touchant que la documentation et les parcours. Cause : les journaux et
   les révisions se lisaient par `created_at`, à la milliseconde, puis par
   `id`, un UUID tiré au sort, ou un identifiant préfixé par l'heure qui
   redevient un tirage au sort dans la même milliseconde. Deux
   enregistrements dans la même milliseconde sortaient donc dans un ordre
   aléatoire ; en local, le fichier de tests joué douze fois restait vert,
   et une sonde sans rien entre les deux enregistrements donnait 36 égalités
   et 15 inversions sur 40 essais. Quatre lectures concernées, celles où la
   dernière révision fait foi, et la remise en ordre du domaine des besoins.
   **Corrigé le soir même** (PR `fix/ordre-des-journaux`) : contrat
   `docs/revision-order-contract.md`, départage par `rowid`, tri stable du
   domaine, cinq tests rouges avant la correction. Reste, noté sans être
   corrigé : les ordres d'affichage départagés par l'identifiant, placements
   de matériel, liaisons entre ressources et réserves, éléments de
   l'historique, où aucune valeur en vigueur n'en dépend. PR #131 fusionnée
   par le porteur et déployée le 4 octobre à 22 h 32. **Clos.**

28. ✅ **Ouvert le 4 octobre 2026 vers 22 h 30 par la décision D-027 ; profilé
   et corrigé le 5 octobre 2026 au soir, 101 ms sur la CI ; PR #138 fusionnée
   et déployée le 8 octobre 2026, budget du test ramené à 500 ms le même jour
   (D-031), PR #144 fusionnée et déployée le soir même.** Le calcul d'une
   semaine complète sur la grande ferme de test durait 580 à 650 ms sur le
   poste du porteur le 4 octobre et environ 1 000 ms sur les machines de
   GitHub ; l'objectif reste la seconde partout. Piste notée le 2 octobre :
   alléger `minimumLevel` (`lib/domain/planning/supply.ts`), appelé pour
   chaque candidat par le moteur. Profil CPU du 5 octobre au soir, sur le test
   du budget : 73 % du temps du moteur dans `minimumLevel`, et presque tout ce
   temps à construire un formateur `Intl.DateTimeFormat` neuf à chaque rupture
   de la projection (`localDateStartUtc`, `dateKeyInTimeZone` de
   `lib/domain/water-management.ts`), 584 ms sur 812 ; un formateur neuf coûte
   176 µs, réutilisé 10 µs. Correction : un formateur par fuseau et par usage,
   construit une fois, dans `water-management.ts` ; `minimumLevel` ne change
   pas. Sur le poste du porteur, trois mesures avant : 788, 864 et 1 052 ms ;
   après : 209, 230 et 237 ms, pour le même plan. Un test garde que deux
   fuseaux restent deux fuseaux. Sur la machine de la CI, le job
   « Application » de la PR #138 a mesuré 101 ms le 5 octobre au soir, contre
   environ 1 000 ms avant. PR #138 fusionnée et déployée le 8 octobre 2026 ;
   le même jour, le porteur a ramené le budget du test à 500 ms (D-031), cinq
   fois la mesure de la CI, deux fois celle de son poste, garde de complexité
   et non mesure de confort ; PR #144 fusionnée et déployée le soir même.
   Fermé. Constat du 5 octobre 2026 au soir, quatrième recette : sur le site,
   le même état se calcule en 6,6 puis 41,9 s ; point 34, à profiler côté
   serveur d'abord, le moteur n'y pesant que quelques centaines de
   millisecondes.

29. ✅ **Ouvert le 5 octobre 2026 à 14 h 04 par la troisième recette réelle du
   planning ; tranché par le porteur le soir même (D-028).** La météo
   actualisée à l'ouverture de la page a porté la pluie prévue de la semaine
   de 14,2 à 15,7 mm ; le reste brut de plein champ tombe à 4,3 mm, sous le
   seuil de planification de 5 mm réglé sur la ferme, et le plan recalculé ne
   garde que les tunnels : 8 créneaux au lieu de 37, « Planches non servies
   0 », « Toutes les planches qui ont un besoin sont servies en entier »,
   pendant que le tableau des besoins affiche « Besoin réel : 20 mm » et
   « Déficit relatif 100 % » sur les quatorze blocs. Conforme au contrat —
   besoin restant après seuil, pluie prévue déduite à 100 % (R2, D-019). Au
   jugement du porteur : si 1,5 mm de prévision en plus doivent retirer 20 m³
   d'arrosage du plan, et si le plan doit lister les planches passées sous le
   seuil, avec leur reste brut, plutôt que de les taire. Aucun code modifié.
   **Tranché par le porteur le 5 octobre 2026 au soir (D-028)** : « le
   logiciel doit simplement exposer les faits tels qu'ils sont annoncés, et
   c'est à l'utilisateur de prendre les décisions » ; la règle reste, pluie
   prévue déduite selon R2 et seuil de la 3.3, l'utilisateur qui estime un
   déficit du sol baisse R2 ou arrose à la main. Fermé ; l'idée de lister dans
   « Non placé » les planches sous le seuil avec leur reste brut est notée,
   non demandée.
30. ✅ **Ouvert le 5 octobre 2026 par la troisième recette réelle du planning ;
   fermé le soir même par l'observation du porteur.** Le niveau de départ de
   la réserve est l'observation prise telle quelle, quelle que soit son
   ancienneté : 112,62 m³ mobilisables = 30 + 0,511 × 161,7 h, l'observation
   du 25 septembre à 13 h 05 servant de niveau le 5 octobre à 06 h 15, sans
   l'apport des dix jours écoulés — près de 120 m³ au débit de référence. Le
   logiciel ne connaît pas le niveau réel et affiche la date de l'observation.
   À trancher : projeter l'apport depuis l'observation, borné par la capacité,
   ou demander une observation récente avant de calculer ; en attendant, le
   porteur observe la réserve avant de se fier au plan. **Fermé le 5 octobre
   2026 à 20 h 24** : le porteur a observé la réserve, 25 m³, saisis dans le
   logiciel ; la pratique retenue est d'observer la réserve avant de se fier
   au plan. Projeter l'apport depuis l'observation reste une idée sans
   décision, à reprendre si l'observation vient à manquer.
31. ✅ **Ouvert le 5 octobre 2026 à 14 h 11 par la troisième recette réelle du
   planning ; tranché par le porteur le soir même (D-030) ; contrat corrigé le
   soir même, moteur à faire dans la 3.7, confirmé par le porteur le 9 octobre
   2026.** Une proposition refusée est reproposée à l'identique par le calcul
   suivant : p-8 (rampe de serre tunnel 4, mardi 22 h 30 → 23 h 00, 5 mm,
   1,28 m³), refusée à 14 h 04, revient à 14 h 11 au même créneau, à la même
   dose, par le même matériel, à côté de la carte refusée datée. Le contrat
   (`docs/planning-contract.md`, statuts) disait « le moteur ne la représente
   plus telle quelle » ; la seconde recette l'avait vue revenir à une autre
   heure, par hasard d'horaire. Le moteur ne lit pas les refus. Réexpliqué au
   porteur le soir même, à sa demande, avec une recommandation ; **tranché
   vers 21 h 50 : le créneau refusé — ce matériel, à ces heures — est exclu
   pour le reste de la semaine ; le besoin reste et se place ailleurs ; le
   lundi repart sans le refus.** Contrat corrigé le soir même (statut
   « refusée », règle sous les statuts, événement du cycle, note de mise en
   œuvre, décision 14), PR `docs/d030-creneau-refuse` ouverte. Reste 🟡 : le
   moteur ne lit pas encore les refus ; mise en œuvre dans la 3.7, ou par une
   correction à part sur le mot du porteur, avec un test qui rejoue le cas du
   tunnel 4. **30 octobre 2026 au soir** : le contrat de la 3.7
   (`docs/replanning-contract.md`) est validé par le porteur (D-051) ; la
   lecture des refus en est la première PR, le test du tunnel 4 compris ;
   reste 🟡 jusqu'à la recette sur le site. **31 octobre 2026 : moteur
   fait, première PR de code de la 3.7** : le service passe au moteur les
   créneaux refusés de la semaine, le placement les évite comme une plage
   horaire (R8), le besoin reste entier et se place ailleurs ou se lit « non
   placé » avec le motif « créneau refusé » ; le cas du tunnel 4 est rejoué
   en test (`tests/planning-refusals.test.ts`), la persistance d'un calcul à
   l'autre aussi (`tests/db/planning-service.test.ts`). Reste 🟡 : la recette
   sur le site, sur la version déployée. **PR #209 fusionnée et déployée le
   31 octobre 2026 à 02 h 17** : la version en ligne lit les refus ; la
   recette sur le site, sur les données de la ferme, attend le « vas-y » du
   porteur.
   **31 octobre 2026, recette sur le site faite** (`docs/recette-3.7.md`,
   K2) : la rampe de serre du tunnel 1 refusée à 21 h 00 n'est pas
   reproposée, le besoin replacé le même soir à 22 h 19, le tunnel 4 prenant
   l'heure libérée ; aucune planche en « créneau refusé », le besoin ayant
   trouvé place. **Fermé par le porteur le 31 octobre 2026 à 12 h 23**, avec la
   clôture de la 3.7, après la vérification sur la ferme du même jour.
32. ✅ **Ouvert le 5 octobre 2026 par la troisième recette réelle du planning ;
   tranché par le porteur le soir même (D-029) ; corrigé le soir même ; PR
   #136 fusionnée et déployée le 8 octobre 2026 ; fermé le soir même par la
   recette sur la version déployée, sur ordinateur et à 390 px.** Le réglage
   R1 « heure du recalcul quotidien », affiché « recalcul à 06:30 » dans les
   réglages du planning et modifiable à l'écran, n'agit sur rien : le recalcul
   du matin suit la synchronisation météo du Worker
   `irrigation-otf-weather-scheduler`, à 06 h 15 (cron de 04 h 15 et 05 h 15
   UTC), et aucun code ne lit `dailyRecalculation` hors des réglages, du
   formulaire et de la présentation. Soit le réglage pilote l'heure, soit
   l'écran dit que l'heure est celle de la météo. Petit, sur le mot du
   porteur. **Tranché par le porteur le 5 octobre 2026 au soir (D-029) : le
   réglage R1 est retiré** ; l'écran dira que le recalcul du matin suit la
   météo, à 06 h 15. **PR #136 (`fix/retrait-reglage-r1`) ouverte le soir
   même**, empilée sur la PR #135 : contrat, réglages, présentation et
   formulaire, deux tests dont un de persistance sur un enregistrement qui
   porte encore l'heure ; aucune migration. **Fusionnée et déployée le 8
   octobre 2026, recette faite le soir même** dans le navigateur du porteur,
   sur la version déployée : sur ordinateur, le pli « Réglages du planning »
   ouvert d'un clic montre dix-neuf champs R2 à R13, aucun champ R1, la note
   « Le recalcul du matin suit la météo, à 06 h 15 ; il ne se règle pas. Un
   réglage enregistré vaut au prochain calcul. » et un résumé sans heure de
   recalcul ; à 390 px, rendu dans un cadre de 390 px inséré dans la page, la
   fenêtre maximisée ayant ignoré le redimensionnement : note lisible, aucun
   débordement horizontal. Fermé, constat de l'assistant au jugement du
   porteur.
33. ✅ **Ouvert le 5 octobre 2026 par la troisième recette réelle du planning ;
   corrigé le 9 octobre 2026 sur le mot du porteur, PR #156 fusionnée et
   déployée le jour même.** Deux motifs d'explication inexacts. « pompe « La
   pompe » saturée avant 21:47 : aucun », et « avant 22:34 : aucun », sur les
   deuxième et troisième vagues de rampes de vendredi : la contrainte est
   vraie, la vague précédente tenant la pompe à 7,94 m³/h jusqu'à 21 h 46,
   mais la liste des occupants est vide, `describeLimitingConstraint`
   (`lib/domain/planning/engine.ts`) lisant les conflits une milliseconde
   avant le départ, dans le creux d'une minute entre deux vagues. Et la rampe
   du bloc 1, placée samedi 21 h 00, dit « après la pluie prévue » alors que
   vendredi soir est aussi après la pluie et que la pompe y avait de la
   place ; cause vraisemblable, à confirmer dans le code : l'espacement R7
   depuis les goutte-à-goutte gag1 et gag16 de vendredi 06 h 00 sur ses
   planches. Explication seule, le placement est juste. — Confirmé le 9
   octobre 2026 par deux tests rouges (`tests/planning-engine.test.ts`) : une
   rampe validée tenant 7 m³/h jusqu'à 21 h 46 min 12 s donnait « pompe « La
   pompe » saturée avant 21:47 : aucun » ; une irrigation validée du vendredi
   06 h sur les planches du bloc 2 donnait « after-forecast-rain » au créneau
   de samedi 21 h, la cause pressentie, l'espacement R7. Corrigé sur le mot du
   porteur : la contrainte limitante nomme les matériels qui tenaient la pompe
   au départ voulu, ou ceux qui la prennent à l'heure de fin, lus quand le
   moteur recule ou raccourcit le créneau, jamais une milliseconde avant le
   départ (`describeLimitingConstraint`, `lib/domain/planning/engine.ts`) ; le
   motif du moment reste celui qui a fixé le jour, pluie ou espacement,
   « plage horaire » ne se disant que si rien d'autre n'a contraint. Règles au
   contrat (« Ce que chaque proposition explique »).
34. 🟡 **Ouvert le 5 octobre 2026 au soir par la quatrième recette réelle du
   planning ; mesure décidée par le porteur le 9 octobre 2026 et posée le jour
   même : journaux de durée côté serveur, PR #160 fusionnée et déployée le
   jour même ; journaux lus le soir même par l'assistant dans le Chrome du
   porteur, sur son mot : 2,3 s par recalcul vu du navigateur, 1,0 s de
   serveur chronométré, aucune phase longue ni variable, le 3 s à 45 s non
   reproduit, tous les instantanés en cache ; cause encore à nommer, piste de
   la lecture OTF en direct au moment du clic ; tranché par le porteur le soir
   même : attendre une occurrence dans les journaux ; laissé en veille par lui
   le 10 octobre 2026, non bloquant pour la clôture de la 3.5, à rouvrir à la
   première occurrence.** Le temps du recalcul à la demande sur le site varie
   sans rapport avec le plan : pour le même état — forage actif, minimum de
   sécurité 20 m³, 48 créneaux —, 33,3 s, puis plus de 45 s, 6,6 s et 41,9 s ;
   3,2 s pour 8 créneaux, 11,9 s pour 42, 6,9 s pour 63. Le moteur seul tient
   la semaine en moins d'une seconde sur le poste du porteur (point 28) : la
   variation est du côté du serveur — lectures et écritures D1, isolat,
   limites du Worker. Mesure posée le 9 octobre 2026 : chaque calcul de la
   semaine et chaque affichage de la page écrivent leurs durées par phase, en
   millisecondes entières, sans identifiant de personne
   (`docs/planning-contract.md`, « Les durées du recalcul ») ; lecture faite
   le soir même par l'assistant dans le Chrome du porteur, sur son mot, dans
   les journaux du Worker (`docs/publication.md`, « Lire les journaux du
   Worker ») : trois recalculs à la demande — 164 planches, 9 propositions,
   instantané en cache — en 455, 501 et 545 ms de calcul (`snapshot` 27 à 78,
   `inputs` 275 à 315, `needs` 27 à 35, `engine` 0, `save` 82 à 94, `reread`
   26 à 38) et 498, 537 et 577 ms de ré-affichage (`dashboards` 381 à 425),
   invocations de 1 653 à 1 826 ms pour 407 à 600 ms de CPU, 2,25 et 2,29 s
   vus du navigateur ; moins de 60 ms d'écart par phase d'une fois à l'autre,
   rien qui ressemble au 3 s à 45 s. Actualisation forcée depuis OTF : 429 sur
   `/bedList` au bout de 1,2 s, repli sur le cache. Reste à nommer la cause :
   la piste la plus vraisemblable est une lecture OTF en direct au moment du
   clic — le cache de l'instantané vaut quatre heures, après quoi « Calculer »
   relit Ouvre ta ferme à quatre appels par seconde, huit secondes d'attente
   par appel et jusqu'à trois essais sur erreur serveur —, puis l'isolat froid
   et le réseau ; les mêmes journaux la trancheront à la prochaine occurrence
   (`snapshotSource` à `live`, phase `snapshot` longue). Tranché par le
   porteur le 9 octobre 2026 au soir : attendre une occurrence dans les
   journaux, aucune correction avant. Le 10 octobre 2026, à la clôture de la
   3.5, le porteur le laisse en veille (« Le laisser en veille, non
   bloquant ») : le point reste 🟡 sans bloquer la 3.5 ni la 3.7, et se rouvre
   à la première occurrence dans les journaux ; les deux recalculs de la
   sixième recette du 10 octobre, 1,5 s chacun, n'en ont pas produit.
   Depuis le 31 octobre 2026 (3.7, PR 2), chaque recalcul sur événement
   écrit `planning_calculation_completed` avec `triggerEvent` : une occasion
   de plus d'observer le 3 s à 45 s.
35. ✅ **Ouvert le 5 octobre 2026 au soir par la quatrième recette réelle du
   planning, scénario 4 du contrat ; corrigé le 9 octobre 2026 sur le mot du
   porteur, PR #156 fusionnée et déployée le jour même.** Sous une limite
   journalière d'irrigation de 10 m³/jour du mardi au dimanche, le moteur
   tient la règle forte — aucun jour limité au-dessus de 10 m³, chacun rempli
   exactement — mais nomme mal la coupe : `applyShortage`
   (`lib/domain/planning/shortage.ts`) prend pour budget le plus petit du
   stock disponible et du reste de limite journalière, 60 m³ pour 86,671
   disponibles, et met le motif `water-budget`, « stock et ressources
   insuffisants d'ici dimanche », sur chaque planche réduite, alors que le
   stock et les ressources suffisent ; le résumé dit « Manque d'eau 45,485 m³
   · ce que le stock et les ressources ne couvrent pas ». Le contrat attend un
   manque « nommé « limite journalière » ». De plus le reste de limite ne
   compte que les jours limités : le lundi, sans limite, pouvait prendre 13 m³
   de plus que la cible de 60. À corriger : motif `daily-limit` quand la
   limite est le terme qui borne, cible = jours sans limite + reste des jours
   limités, libellé du résumé ; tests sur le scénario 4. — Corrigé le 9
   octobre 2026, deux tests rouges d'abord : sous 1 m³/jour que le stock et le
   forage dépassent largement, « B1-0 : water-budget » ; limite à partir de
   mercredi, reste de limite 5 m³ au lieu de « sans borne ». `applyShortage`
   nomme la coupe d'après le terme qui borne, `daily-limit` quand la limite
   laisse moins que l'eau ; `remainingBetween`
   (`lib/domain/planning/supply.ts`) rend `null` dès qu'un jour de l'horizon
   est sans limite — la capacité d'un tel jour n'est pas un nombre connu
   d'avance, ce sont ses plages et la pompe qui la fixent au placement, la
   limite restant vérifiée créneau par créneau sur les jours limités — ; le
   sous-titre du manque d'eau nomme la limite journalière quand c'est elle qui
   coupe (`waterDeficitDetail`, `lib/domain/planning/presentation.ts`). Règle
   au contrat (« Pénurie »). Un test du point 26 attendait « stock et
   ressources » pour une coupe par la limite : aligné. Recette sur le site
   après déploiement : sous une limite journalière qui borne, les planches
   réduites doivent lire « limite journalière d'irrigation atteinte » et le
   résumé « Ce que la limite journalière ne laisse pas placer ».
36. ✅ **Ouvert le 5 octobre 2026 au soir par la quatrième recette réelle du
   planning ; tranché par le porteur le 9 octobre 2026 (D-037, D-038) ;
   corrigé le jour même sur son mot, PR #158 fusionnée et déployée le jour
   même ; recette sur le site faite le 10 octobre 2026 par l'assistant dans le
   Chrome du porteur : la part réservée tient, la note du manque d'eau se
   trompe de cause sur un résidu d'arrondi (point 41) ; fermé par le porteur
   le 10 octobre 2026.** Deux écarts entre le contrat « Pénurie » et le plan.
   La part égale est une cible, non un résultat : à 30 % pour toutes (T1), les
   planches servies reçoivent 6 mm et les huit du tunnel 4 rien, « réserve au
   minimum de sécurité au moment voulu », parce que le moteur ne place pas
   dans l'ordre du temps et que les derniers litres sont promis aux créneaux
   de vendredi et samedi, examinés avant lui. Et « Manque d'eau » n'est pas
   « demandés moins placé » : 62,187 m³ pour 82,70 − 24,999 = 57,70 ; le
   manque est la somme planche par planche du besoin non couvert fois la
   surface mouillée de la planche par son matériel (`summarizeDeficit`,
   `lib/domain/planning/engine.ts`), le placé est le volume des créneaux ;
   cause vraisemblable, à confirmer : une planche arrosée par son
   goutte-à-goutte et par le bord d'une rampe, l'eau de la rampe comptée sur
   la surface mouillée en aspersion, le manque sur celle du goutte-à-goutte.
   Au jugement du porteur pour la part égale — servir dans l'ordre du temps,
   ou réserver à chaque planche sa fraction — ; à expliquer à l'écran pour le
   manque. — Tranché le 9 octobre 2026 : la fraction attribuée à une planche
   lui est réservée, le créneau d'une autre ne peut pas la consommer (D-037) ;
   le calcul du manque ne change pas, l'écart avec « demandé moins placé »
   sera expliqué à l'écran une fois la cause confirmée dans le code (D-038).
   Mécanisme écrit au contrat avant le code (« La part réservée »), tests
   rouges d'abord, correctif dans `lib/domain/planning/shares.ts` et le
   moteur ; la cause pressentie est confirmée par le test, la note du manque
   l'explique sous les cartes ; recette sur le site, sur la version déployée,
   faite le 10 octobre 2026 par l'assistant dans le Chrome du porteur, sur son
   « reprends le travail », pénurie fabriquée et données remises en état
   (cinquième recette de `docs/recette-planning.md`) : à 50 % puis 28 % de
   part, les quatre tunnels reçoivent chacun leur fraction, le dernier examiné
   compris, la somme des créneaux ne dépasse pas le budget, la réserve
   s'arrête exactement à son minimum ; la note du manque d'eau s'affiche pour
   0,002 m³, un résidu d'arrondi des secondes, sous un libellé qui nomme une
   autre cause : point 41, corrigé le jour même (D-040). Fermé par le porteur
   le 10 octobre 2026 (« Fermer les deux », points 36 et 41) ; la 3.5 close
   par lui le même jour.

37. ✅ **Ouvert le 5 octobre 2026 au soir par les contrôles de la PR du point
   28 ; corrigé le 8 octobre 2026 sur le mot du porteur, suite complète 24 sur
   24 réussis en local, PR #145 fusionnée et déployée le soir même.** Le
   parcours P9 (`e2e/p9-suivi-par-serie.spec.ts`), à la largeur ordinateur, a
   échoué deux fois sur deux dans la suite complète, au même clic : après le
   rechargement de la page, il clique l'onglet « Par série » dès que le titre
   est visible, et l'onglet reste sur « Par périmètre » pendant les 15 s
   d'attente. La trace Playwright de la seconde passe montre le clic envoyé
   2,0 s après le rechargement alors que les modules de la page se chargeaient
   encore 0,3 s plus tard : le clic part avant que React n'ait repris la main,
   piège connu de Q5 depuis sa deuxième PR, que l'aide `ouvrirParClic`
   (`e2e/support/parcours.ts`) évite au premier clic d'un parcours mais que ce
   clic, premier après un rechargement, ne reprend pas. Le même parcours
   rejoué seul réussit en 34 s, et il réussit à 390 px dans la suite complète,
   sans doute parce que le défilement vers l'historique y laisse le temps à la
   page. Aucun lien avec la correction du point 28, qui ne touche ni ce
   commutateur, purement client, ni les parcours ; le job « Parcours
   navigateur » de la CI a réussi le même jour sur les PR #136, #137 et #138.
   Le job étant exigé à la fusion (D-026), un tel aléa bloque une PR saine
   jusqu'à une relance. Autorisée par le porteur le 8 octobre 2026 et
   **corrigée le soir même** dans une PR à part, empilée sur la PR #144 :
   après son rechargement, P9 clique l'onglet par `ouvrirParClic` jusqu'à ce
   qu'il soit sélectionné, l'onglet n'étant pas une bascule ; l'aide et le
   contrat des parcours disent qu'un rechargement remet le parcours dans la
   situation du premier clic. Les parcours P1, P4 et P6, qui rechargent aussi
   la page, ont été vérifiés : P1 attend que son minuteur avance avant de
   cliquer, preuve équivalente ; P6 ne fait que lire ; P4, dont le premier
   geste pouvait être de feuilleter l'historique, ouvre et ferme d'abord la
   bulle d'aide, comme P7 à son départ, corrigé dans la même PR. Suite
   complète jouée en local : 24 sur 24 réussis en 3 min 4 s (et 24 sur 24 en
   3 min 10 s avant la retouche de P4) ; PR #145 fusionnée et déployée le soir
   même, après mise à jour sur `main` par le porteur. Fermé.
38. ✅ **Ouvert le 9 octobre 2026, en corrigeant le point 14, au jugement du
   porteur ; tranché et corrigé le jour même (D-035), PR #153 fusionnée et
   déployée le 9 octobre 2026.** `resolvePumpOriginAvailability` (3.2,
   `lib/domain/pumps.ts`) ne compte dans la limite de prélèvement du jour que
   les prélèvements directs d'irrigation (`direct_irrigation_withdrawal`),
   alors que le moteur de planning compte aussi, par
   `actualWithdrawalsByResourceAndDate` (`lib/domain/water-resources.ts`), les
   apports de la ressource vers une réserve (`resource_input`). Un forage
   limité à 10 m³ par jour qui a rempli la réserve de 8 m³ le matin est
   annoncé « 10 m³ encore disponibles » à la saisie d'une irrigation directe,
   quand le planning ne lui laisse que 2 m³. À trancher : la limite de
   prélèvement couvre-t-elle tout ce que la ressource fournit, apports compris
   — lecture du contrat du planning, « plafonne ce que la ressource peut
   fournir ce jour-là » —, ou les seuls prélèvements directs ? Dans le premier
   cas, la 3.2 doit appeler la même fonction que le planning, dans une PR
   `fix/` à part, sur le mot du porteur. — Tranché le 9 octobre 2026 par le
   porteur, « oui » (D-035) : règle écrite au contrat hydraulique 3.2 ; test
   du domaine rouge d'abord (`tests/pumps.test.ts`, forage limité à 5 m³ ayant
   rempli la réserve de 4 m³ le matin, irrigation directe de 2 m³ : `expected
   'unavailable', actual 'available'`) ; `resolvePumpOriginAvailability`
   compte les prélèvements du jour par `actualWithdrawalsByResourceAndDate`,
   comme le planning. Contrôles complets, parcours compris.
39. ✅ **Ouvert le 9 octobre 2026, en corrigeant le point 16, au jugement du
   porteur ; tranché et corrigé le jour même (D-036), PR #154 fusionnée et
   déployée le 9 octobre 2026.** La vue « Par périmètre » de l'historique
   (`aggregateHydricObjective`, `lib/domain/irrigation-history/summary.ts`) ne
   calcule l'objectif et l'écart d'une période que si un objectif couvre
   chaque jour de chaque planche du périmètre ; sinon l'objectif est
   « indisponible » et l'écart absent. Depuis D-034, le tableau des besoins
   tient un objectif posé en cours de semaine pour applicable à ses jours
   restants ; une période d'historique qui commence avant le premier objectif
   de la ferme lit, elle, encore « objectif indisponible ». Faut-il aligner —
   objectif de la période égal à la somme des septièmes pondérés par la
   surface sur les jours-planches couverts, complet dès qu'un jour-planche
   l'est, le nombre de jours couverts affiché — ou garder l'exigence, l'écart
   d'une période partiellement couverte comparant sinon un objectif partiel à
   une irrigation et une pluie entières ? Décision du porteur ; dans le
   premier cas, une PR `fix/` à part. — Tranché le 9 octobre 2026 par le
   porteur, « il faut aligner l'historique » (D-036) : règle écrite au contrat
   des séries pour les deux vues ; tests rouges d'abord
   (`tests/irrigation-history.test.ts`, sept jours couverts sur quatorze, deux
   planches dont une seule avec objectif, aucune journée couverte : `expected
   35, actual null` ; `tests/series-water.test.ts`, premier objectif posé deux
   semaines après l'implantation, seize jours sur trente : `expected 32,
   actual null`) ; `aggregateHydricObjective` rend l'objectif dès qu'une
   journée-planche est couverte, les cumuls par série comptent zéro une
   planche sans journée couverte, l'avertissement « incomplet, l'écart n'est
   pas calculé » est retiré parce qu'il serait faux, la carte « Objectif »
   affiche le nombre de journées-planche couvertes. Contrôles complets,
   parcours compris. Recette sur le site à faire après déploiement : une
   période de saison commencée avant le premier objectif doit lire un objectif
   et un écart.
40. ✅ **Ouvert le 9 octobre 2026, en corrigeant le point 39, au jugement du
   porteur ; tranché le jour même (D-039, aligner l'historique) ; corrigé le
   jour même sur son mot, PR #159 fusionnée et déployée le jour même.**
   L'historique relit les objectifs par semaine (`aggregateHydricObjective`,
   `lib/domain/irrigation-history/summary.ts`) : un objectif posé un mercredi
   y vaut pour toute sa semaine, dès le lundi, quand le tableau des besoins ne
   le compte, depuis D-034, qu'à partir du jour où il a été posé (contrat des
   besoins : « une modification en milieu de semaine s'applique à partir de
   son jour civil »). Sur la semaine du premier objectif, l'historique lit
   35 mm là où la 3.3 lit 25. Faut-il aligner l'historique sur la 3.3 —
   l'objectif compte de son jour de pose, comme le tableau des besoins — ou
   garder la lecture par semaine entière, celle du contrat des séries, plus
   simple ? Décision du porteur ; dans le premier cas, une PR `fix/` à part. —
   Tranché le 9 octobre 2026 : « oui, aligne l'historique » (D-039). Contrat
   des séries corrigé avant le code ; la règle du jour de pose vit en un seul
   endroit, `goalRevisionFirstDate` dans
   `lib/domain/hydric-goal-revisions.ts`, appelée par le tableau des besoins
   et par l'historique ; test rouge d'abord, 35 mm lus pour 25 attendus ;
   l'historique ne départage plus deux révisions de la même milliseconde par
   l'identifiant (contrat de l'ordre des révisions, portée complétée). Sur le
   site, l'historique et les cumuls par série liront 25 mm sur la semaine du
   premier objectif, comme la 3.3.

41. ✅ **Ouvert le 10 octobre 2026 par la cinquième recette du planning : la
   note du manque d'eau se déclenchait sur un résidu d'arrondi des secondes et
   lui donnait une autre cause ; tranché par le porteur le jour même (D-040)
   et corrigé le jour même sur son mot, la note tolère le résidu que le moteur
   tolère déjà ; PR #164 fusionnée et déployée le jour même ; recette sur le
   site faite le jour même par l'assistant dans le Chrome du porteur, la note
   absente ; fermé par le porteur le 10 octobre 2026.** La note (D-038,
   `waterDeficitExplanation`, `lib/domain/planning/presentation.ts`)
   s'affichait dès que « placés » s'écartait de plus d'un litre de « demandés
   moins manque compté ». Or le moteur coupe chaque créneau à la seconde
   entière (`lib/domain/planning/engine.ts`), puis crédite à chaque planche le
   reste de sa cible quand il est sous un centième de millimètre
   (`commitProposal`, `NEGLIGIBLE_MM`) : la planche est comptée servie de sa
   part entière, le créneau livre un peu moins, et le manque, compté planche
   par planche sur la part entière, ne retrouve pas le volume des créneaux.
   L'écart vaut jusqu'à 0,01 mm fois la surface mouillée de chaque planche
   servie — 9 L sur les quatre tunnels de la ferme —, au-dessus du seuil d'un
   litre dès que les créneaux sont plusieurs ou longs. Sur la ferme, à 28 % de
   part : « l'écart tient à 0,002 m³ de besoin couverts par une eau comptée
   sur une surface plus petite que celle de leur propre matériel », quand les
   2 L sont les 0,9 s rognées sur chacun des quatre créneaux (2 008 s pour
   2 008,9 voulues, 0,0026 mm par planche sur 896 m²) et qu'aucune surface
   n'est en cause ; à 50 % de part, le résidu de 0,2 L reste sous le seuil et
   la note n'apparaissait pas. Le calcul du manque, la ligne de budget et les
   parts sont justes ; seule la note se trompait de cause. Trois voies :
   tolérer dans la note le résidu que le moteur tolère déjà, un centième de
   millimètre par planche servie au prix de sa surface mouillée ; créditer aux
   planches ce que les secondes livrent plutôt que la part entière ; nommer le
   résidu dans le libellé. Recommandation de l'assistant : la première, la
   règle vivant déjà dans le moteur, en une PR `fix/` à part, contrat
   « Interface » précisé avant le code, test rouge d'abord sur les chiffres de
   la ferme (896 m² à 10 mm/h pour 5 m³ de budget). Suivie par le porteur le
   jour même (D-040, « je suis ta recommandation pour le point 41 »).
   Correctif du jour même, PR `fix/` à part : la note ne paraît, pour l'eau
   placée à côté en plus ou en moins, qu'au-delà du résidu d'arrondi des
   secondes — un centième de millimètre par planche et par créneau qui
   l'arrose, au prix de la surface mouillée de l'application, et au moins un
   litre — ; le manque pour une autre raison garde son seuil d'un litre ; la
   tolérance vaut le plus grand d'un litre et du résidu sommé sur les
   applications du calcul (`roundingResidueCubicMeters`) ; le calcul du
   manque, la ligne de budget et les parts ne changent pas. Contrat précisé
   avant le code ; deux tests rouges d'abord, sur les chiffres de la ferme
   (quatre créneaux de 2 008 s à 10 mm/h sur 896 m², 4,998 m³ placés pour
   5,000 comptés : la note doit se taire, et reparaître à 0,022 m³, au-delà
   des 9 L de résidu) et sur la ferme de test du moteur (5,12256 m³ de budget
   pour les tunnels, 10,005 mm par planche, un résidu de 2 L entre le litre et
   le centième de millimètre sur 512 m²), rouges sur l'ancien code avec le
   libellé « 0,002 m³ de besoin couverts par une eau comptée sur une surface
   plus petite », verts après. PR #164 fusionnée à 13 h 15 et déployée à
   13 h 21. Recette sur le site faite de 13 h 23 à 13 h 34 (sixième recette de
   `docs/recette-planning.md`) : la pénurie de T2 du matin refaite à
   l'identique, forage indisponible et minimum de sécurité à 20 m³, 5,00 m³
   mobilisables : mêmes quatre créneaux de 5,6 mm pour 4,998 m³, même réserve
   à 20,002 m³ au plus bas, même manque de 12,92 m³, même part de 28 %, et
   aucune note sous les cartes là où la version du matin écrivait « l'écart
   tient à 0,002 m³ de besoin couverts par une eau comptée sur une surface
   plus petite que celle de leur propre matériel » ; données remises en état
   par l'écran, plan du matin retrouvé, deux recalculs en 1,5 s. Fermé par le
   porteur le 10 octobre 2026 (« Fermer les deux », points 36 et 41).

42. ✅ **Ouvert le 27 octobre 2026 par le cadrage de la réserve du sol (5 ter,
   D-041) ; à confirmer par le porteur auprès du laboratoire ; fermé par le
   porteur le 30 octobre 2026, le laboratoire confirmant 62 mm sur 1 m, et la
   RFU s'exprimant toujours en mm par mètre (D-046).** Le rapport Celesta-lab
   du 31 mars 2025 donne une RFU « estimée » de 62 mm sur un échantillon
   prélevé sur 0-20 cm, sans dire la profondeur de calcul ni la méthode. Sur
   20 cm, 3,1 mm/cm, au-delà du vraisemblable pour un sable argilo-limoneux à
   59 % de sables ; sur une profondeur d'enracinement par défaut d'environ
   60 cm, environ 1 mm/cm, hypothèse non confirmée. L'écart va du simple au
   triple sur la capacité de chaque planche. D'ici la réponse du laboratoire
   (04 67 20 10 90), la valeur se saisira 62 mm sur 60 cm au statut
   « hypothèse », rappelé à côté de chaque jauge ; le contrat n'en est pas
   bloqué. Le 30 octobre 2026, le porteur précise que les 20 cm ne sont que la
   profondeur de l'échantillon et ferme le point (« 42 ferme le point »), en
   retenant d'abord 62 mm sur 60 cm. Le même après-midi, il transmet la
   réponse du laboratoire (« après confirmation avec le labo, c'est 62mm sur
   1m ») et rappelle que « la RFU s'exprime toujours en mm par mètre ». La
   ferme se saisira 62 mm/m, soit 0,62 mm/cm : une culture enracinée sur 30 cm
   y dispose de 18,6 mm. Sur son choix, le contrat saisit désormais la RFU en
   mm/m, sans profondeur de calcul ni statut « hypothèse » (D-046,
   `docs/soil-reserve-contract.md`). Rien n'était codé.

43. ✅ **Ouvert le 27 octobre 2026 par le porteur : « Retirer la position »
   d'un goutte-à-goutte le laisse en place ; cadré le jour même en
   sous-tranche 2.11 (D-043), contrat relu et confirmé par lui le jour même ;
   fermé par le porteur le 30 octobre 2026, après le retrait réel de son
   goutte-à-goutte par l'écran.** Le retrait d'une position est refusé dès
   qu'une irrigation l'a utilisée (`deleteEquipmentPlacementForUser`,
   `db/equipment-placement-repository.ts`) ; la barre de placement répond
   « Cette position a déjà servi à une irrigation et doit rester dans
   l'historique » et le matériel reste posé. Le refus protège une clé
   étrangère, pas l'historique : chaque irrigation garde déjà sa copie de la
   position et ses apports par planche. Plus largement, un matériel n'a qu'une
   position par saison, sans date de pose ni de retrait, quand le porteur
   pose, range et repose son matériel au fil de la saison. Correction par la
   2.11 : pose datée, matériel stocké, rien d'effacé
   (`docs/equipment-placement-periods-contract.md`). La PR 2 de la 2.11 lève
   le refus dans le code le 27 octobre 2026 : retirer stocke le matériel, même
   après une irrigation ; à constater sur le site après son déploiement, le
   point restant ouvert jusqu'à la recette de la 2.11. PR 2 (#181) déployée le
   27 octobre 2026 à 21 h 33 ; PR 3a ouverte le 29, déployée le même soir à
   22 h 17 (#187) ; PR 3b, l'écran, ouverte le même soir et déployée à 22 h 48
   (#188). Recette réelle de la 2.11 passée le 30 octobre 2026
   (`docs/recette-2.11.md`), sur un matériel d'essai ; fermeture au jugement
   du porteur, après le retrait réel de son goutte-à-goutte s'il le souhaite.
   Le 30 octobre 2026, le porteur retire pour de vrai son goutte-à-goutte par
   l'écran. Daté de la minute même, le retrait est refusé comme futur, puis
   accepté daté une minute plus tôt (point ouvert 47, corrigé le jour même).
   Il confirme le retrait (« 43 oui ») et ferme le point le jour même.

44. ✅ **Ouvert le 30 octobre 2026 par la recette de la 2.11 : la page
   d'irrigation se ferme quand la date de début d'une irrigation devient
   incomplète ou vide ; corrigé le jour même sur le choix du porteur, PR #190
   fusionnée et déployée le jour même ; correction constatée sur le site le
   jour même par l'assistant dans le Chrome du porteur ; fermé par le porteur
   le 30 octobre 2026.** Dans « Déjà réalisée », la frappe au clavier de
   l'heure de début a remplacé deux fois la page par « This page couldn't
   load », dans le Chrome du porteur ; rien n'a été enregistré. Reproduit le
   jour même par l'assistant en tapant la date chiffre par chiffre : une date
   incomplète vide le champ, et l'aperçu de faisabilité
   (`app/irrigation/irrigation-manager/use-irrigation-preview.ts`,
   `hydraulicPreview`) calcule la fin du créneau depuis un début illisible ;
   `toISOString` lève « RangeError: Invalid time value » et tout l'écran
   s'arrête. « Planifier » partage ce calcul : vider sa date de début a le
   même effet. Défaut ancien, la ligne datant de la fin septembre 2026, sans
   lien avec la 2.11. Correction proposée au porteur le jour même, choisie par
   lui et écrite le jour même (`previewSlot`, test du domaine, étape ajoutée
   au parcours P3) ; à constater sur le site après son déploiement. Correction
   fusionnée et déployée le 30 octobre 2026 à 13 h 01 (#190, `fdfbc59`),
   constatée sur le site le jour même de 13 h 08 à 13 h 14 par l'assistant
   dans le Chrome du porteur, sur son « vas-y » (`docs/recette-2.11.md`,
   « Après la correction du point 44 ») : date de début vidée, tapée chiffre
   par chiffre ou d'une année absurde, dans « Déjà réalisée » comme dans
   « Planifier », la page reste là, sans erreur dans la console ; rien
   enregistré. Fermé par le porteur le jour même : « ferme le point 44 tu
   viens de le tester ». La même vérification relève deux écarts mineurs, sans
   rien d'enregistré à tort (points 45 et 46).

45. ✅ **Ouvert le 30 octobre 2026 par le constat du point 44 sur le site :
   dans « Déjà réalisée », une date de début illisible donne un volume estimé
   de 0 L ; tranché par le porteur le jour même (« il faut marquer inconnu »)
   et corrigé le jour même ; correction constatée sur le site le jour même ;
   fermé par le porteur le jour même.** Début réel vidé, l'aperçu affiche la
   durée « — » mais « Volume estimé : 0 L ». La durée de l'aperçu
   (`previewDurationSeconds`,
   `app/irrigation/irrigation-manager/use-irrigation-preview.ts`) vaut 0 quand
   le début ou la fin ne se lit pas, ou quand la fin précède le début ; le
   volume et l'apport par planche se calculent depuis ce 0. Une durée inconnue
   devient un volume nul, ce que D-003 interdit. Rien n'est enregistré à
   tort : le bouton reste grisé tant que la durée vaut 0. Correction possible,
   dans une PR `fix/` à part, test d'abord : une durée inconnue rend le volume
   et les apports inconnus. Tranché par le porteur le jour même : « il faut
   marquer inconnu ». Corrigé le jour même, dans une PR `fix/` à part : la
   durée d'une irrigation déjà réalisée se lit dans le domaine
   (`completedDurationSeconds`, `lib/domain/irrigation-timer.ts`), inconnue
   tant que le début ou la fin ne se lit pas ou que la fin ne suit pas le
   début ; l'aperçu écrit alors « Volume estimé : Inconnu — vérifiez le début
   et la fin » et l'apport par planche « inconnu ». Test du domaine et deux
   vérifications ajoutées au parcours P3, rouges avant la correction (« 0 L »
   lu), vertes après. À constater sur le site après son déploiement. Fusionné
   et déployé le 30 octobre 2026 à 14 h 56 (#195, `de054bd`). Correction
   constatée sur le site le 30 octobre 2026 de 15 h 56 à 16 h 17 par
   l'assistant dans le Chrome du porteur, sur son « vas-y »
   (`docs/recette-2.11.md`, K1) : « Inconnu — vérifiez le début et la fin » et
   « inconnu » par planche, jamais « 0 L ». Fermeture au jugement du porteur.
   Fermé par le porteur le 30 octobre 2026 (« Ok, tu peux fermer ces trois
   points »).

46. ✅ **Ouvert le 30 octobre 2026 par le constat du point 44 sur le site :
   dans « Planifier », le bouton « Planifier l'irrigation » reste actif quand
   la date de début est vide ; tranché par le porteur le jour même (« rendre
   le bouton inactif sans date ») et corrigé le jour même ; correction
   constatée sur le site le jour même ; fermé par le porteur le jour même.**
   Dans « Déjà réalisée », une date de début vide grise le bouton ; dans
   « Planifier », la durée venant de l'objectif ou de la durée saisie, il
   reste vert : sa condition ne regarde que la durée, les planches et l'envoi
   en cours (`app/irrigation/irrigation-manager/irrigation-form.tsx`). Un clic
   n'enregistre rien : le serveur refuse avec « Indiquez la date et l'heure de
   l'irrigation planifiée. » (`app/irrigation/irrigation-event/timing.ts`),
   message rendu sous le formulaire ; lu dans le code, le bouton n'a pas été
   cliqué sur la ferme. Écart de cohérence entre les deux onglets, sans risque
   pour les données. Correction possible, dans une PR `fix/` à part : griser
   le bouton tant que la date ne se lit pas. Tranché par le porteur le jour
   même : « rendre le bouton inactif sans date ». Corrigé le jour même, dans
   une PR `fix/` à part : la règle vit dans le domaine (`plannedStartKnown`,
   `lib/domain/irrigation-timer.ts`), une irrigation planifiée sans date de
   début lisible ne s'enregistre pas ; le bouton « Planifier l'irrigation »
   reste grisé tant que le champ est vide ou incomplet, comme dans « Déjà
   réalisée ». Test du domaine, rouge avant la correction, et deux
   vérifications ajoutées au parcours P2, la première rouge avant la
   correction (bouton actif lu aux deux largeurs) ; toutes vertes après. À
   constater sur le site après son déploiement. Fusionné et déployé le 30
   octobre 2026 à 15 h 24 (#197, `65b3e5b`). Correction constatée sur le site
   le 30 octobre 2026 de 15 h 56 à 16 h 17 par l'assistant dans le Chrome du
   porteur, sur son « vas-y » (`docs/recette-2.11.md`, K2) : bouton grisé sans
   date, actif avec une date. Fermeture au jugement du porteur. Fermé par le
   porteur le 30 octobre 2026 (« Ok, tu peux fermer ces trois points »).

47. ✅ **Ouvert le 30 octobre 2026 par le porteur, en retirant pour de vrai son
   goutte-à-goutte : un retrait daté de la minute même est refusé « dans le
   futur » ; correction choisie par lui le jour même (« vas-y pour le point
   47 ») et écrite le jour même ; correction constatée sur le site le jour
   même ; fermé par le porteur le jour même.** Le retrait est refusé « Une
   date de pose ou de retrait ne peut pas être dans le futur. », puis accepté
   daté une minute plus tôt. Les dates se saisissent à la minute sur
   l'appareil, et le serveur les compare à sa propre heure, à la seconde
   (`checkCommonDate`, `lib/domain/equipment-placement-periods.ts`) : une
   horloge d'appareil en avance de quelques secondes fait paraître
   « maintenant » dans le futur, y compris la date proposée par défaut. Cause
   tenue pour probable, l'heure de l'ordinateur du porteur n'ayant pas été
   relevée. Correction : une date de pose, de repose, de déplacement ou de
   retrait en avance de deux minutes au plus sur l'heure du serveur vaut
   maintenant et s'enregistre à l'heure du serveur (`poseDateAt`, contrat de
   la 2.11, règle 3 et précision du 30 octobre 2026) ; au-delà, le refus
   tient. Tests d'abord : un test du domaine, et un test de persistance rouge
   avant la correction avec le message vu par le porteur, vert après. À
   constater sur le site après son déploiement. Fusionné et déployé le 30
   octobre 2026 à 15 h 17 (#196, `7773fe3`). Correction constatée sur le site
   le 30 octobre 2026 de 15 h 56 à 16 h 17 par l'assistant dans le Chrome du
   porteur, sur son « vas-y » (`docs/recette-2.11.md`, K3) : un retrait daté
   de la minute qui vient est accepté et enregistré à l'heure du serveur ;
   daté de cinq minutes plus tard, il reste refusé. L'heure de l'ordinateur du
   porteur concordait avec celle du serveur : la cause tenue pour probable
   n'est pas confirmée, la correction vaut quelle qu'en soit la cause.
   Fermeture au jugement du porteur. Fermé par le porteur le 30 octobre 2026
   (« Ok, tu peux fermer ces trois points »).
48. **Ouvert le 8 novembre 2026, en vérifiant la correction 3 de la 3.9 ;
   non bloquant.** Le parcours P28 (`e2e/p28-telephone.spec.ts`, « au
   téléphone, la barre du bas… ») attend une proposition du planning après
   « Recalculer le plan », la plage du goutte-à-goutte réglée de 00:00 à
   23:59. Ce dimanche soir, entre 22 h et 22 h 07 à la ferme, le plan n'en
   avait aucune (« Demandés 1,365 m³, placés 0 m³, manque d'eau 0 m³ »,
   l'écart tenant à « une autre raison que l'eau ») : le parcours a échoué
   sur la branche de la correction 3, à l'ordinateur dans la suite entière
   puis aux deux largeurs seul, et sur `main` (`87e4ab0`), à l'ordinateur
   seul. Il est passé à 22 h 30 sur `main`, aux deux largeurs, comme sur
   les contrôles de `main` à 21 h 49. L'échec dépend donc de l'heure, sans
   tenir à la seule fin de semaine ; la cause reste à établir (les heures
   restantes, l'espacement, la dose minimale, la prévision). Le même soir à
   23 h, sur la branche de la correction 4, la suite entière a vu échouer
   P12 à l'ordinateur (« temps de pompage insuffisant dans les plages
   horaires » au lieu de « créneau refusé »), puis huit autres parcours, la
   plupart par contagion : un parcours interrompu laisse son objectif ou
   son choix, que le suivant trouve. Seuls, P7 et P12 sont passés à
   23 h 12 sur `main` et à 23 h 15 sur la branche ; P28 a échoué à 23 h 13
   sur `main`, à l'ordinateur, et il est passé à 23 h 16 sur la branche.
   Plus la fin de la semaine approche, plus de parcours du planning
   dépendent de l'heure. Recommandation : une PR à part, pour que les
   parcours ne dépendent plus de l'heure ; en attendant, une PR ouverte le
   dimanche soir attend le lundi pour ses contrôles.
49. **Ouvert le 9 novembre 2026, en vérifiant la PR de la correction 3 de
   la 3.9 ; non bloquant ; corrigé le jour même (D-082) ; fermeture au
   jugement du porteur.** Ce lundi peu après minuit à la ferme, trois
   parcours ont échoué aux deux largeurs : P4
   (`e2e/p4-cumuls-export.spec.ts`), P9 (`e2e/p9-suivi-par-serie.spec.ts`)
   et P31 (`e2e/p31-planning-et-arrosages.spec.ts`, les arrosages), sur les
   contrôles de la PR #13 de ce dépôt de 0 h 10 à 0 h 12, puis seuls sur
   `main` (`87e4ab0`) de 0 h 19 à 0 h 23. Cause : `horodatageLocal`
   (`e2e/support/materiel.ts`) écrit l'heure du processus des parcours, en
   temps universel sur la CI comme en local, dans des champs que la page
   lit à l'heure de Paris ; l'heure saisie recule d'une heure en hiver, de
   deux en été. P4 et P9 enregistrent une irrigation finie il y a une
   demi-heure et la cherchent dans la semaine en cours : le lundi, jusqu'à
   1 h 30 (2 h 30 en été), elle finit dans la semaine précédente ; avant
   0 h 30, elle y finirait même à la bonne heure. P31 planifie une
   irrigation « demain, même heure » : chaque nuit, de minuit à 1 h (2 h en
   été), elle tombe aujourd'hui. Après 2 h 30, tout est passé : la suite
   entière sur la branche de la correction 4 en local, 84 parcours sur 84,
   de 2 h 36 à 2 h 47, et les contrôles de la PR #13, relancés une fois à
   2 h 36, 84 sur 84. Recommandation : la même PR à part que pour le point
   48, qui écrira ces horodatages à l'heure de Paris et éloignera ces
   irrigations des bornes du jour et de la semaine ; en attendant, ni PR
   ouverte ni parcours relancé entre minuit et 2 h 30. Corrigé le
   9 novembre 2026 dans la PR qui suit la correction 4 (D-082, F88 et
   F89) : `horodatageLocal` écrit à l'heure de la ferme, par le formateur
   de l'application, quel que soit le fuseau de la machine
   (`tests/parcours-heure.test.ts`, rouge avant : une machine en UTC
   écrivait 23:30 pour 0 h 30 à la ferme) ; P4 et P9 finissent leur
   irrigation à la minute précédente, qu'une période compte dès qu'elle
   la chevauche. Seul reste le passage d'une période à la suivante, à une
   ou deux minutes près.
50. **Ouvert le 9 novembre 2026, en vérifiant le déploiement de la
   correction 3 de la 3.9 ; non bloquant ; corrigé le jour même (D-082) ;
   fermeture au jugement du porteur.** Sur les contrôles de `main`
   après la fusion de #13 (`a15f150`, run 42547789030), P12 a échoué à
   l'ordinateur à 2 h 54 à la ferme, sur sa dernière étape : la pluie du
   jour remise à 0 mm, le champ « Millimètres » de « Pluie mesurée », ramené
   de la veille à aujourd'hui, est resté vide au lieu de montrer « 0 ». Le
   déploiement a attendu ; les parcours, relancés une fois à 3 h 09, sont
   passés, 84 sur 84, et le déploiement a suivi à 3 h 23. Cause probable,
   une course dans `chooseRainDate`
   (`app/irrigation/water-management-dashboard.tsx`) : un jour hors de la
   semaine affichée fait charger sa semaine ; si un autre jour est choisi
   avant la réponse, celle-ci arrive quand même, remplace la semaine
   affichée et vide le champ. Le lundi, la veille est dans la semaine
   précédente : le parcours, plus rapide que la réponse, la déclenche selon
   les délais du serveur. Rare à la main, mais réelle : la semaine affichée
   et le champ ne suivent plus le jour choisi. Recommandation : ne garder
   que la réponse du dernier jour choisi, test d'abord, dans la PR à part
   des points 48 et 49. Corrigé le 9 novembre 2026 dans cette PR (D-082,
   F90 et F91) : chaque choix de jour est numéroté, et la réponse d'un
   choix dépassé est ignorée (`docs/irrigation-needs-contract.md`). P12
   joue maintenant la course à chaque passage, quel que soit le jour : il
   retient la réponse d'un jour de la semaine passée jusqu'après le
   retour à aujourd'hui ; rouge avant la correction, aux deux largeurs
   (« Expected: "0" », « Received: "" »).
51. **Ouvert le 9 novembre 2026, en écrivant les tests des scénarios de
   pénurie (lot 3 de la 3.9, D-084) ; corrigé le jour même (D-089) ;
   fermeture au jugement du porteur.** S7, stock inconnu : la réserve sans jauge, le moteur fait ce
   que le contrat attend — créneaux « eau non vérifiée », aucun budget
   chiffré, aucune coupe, la note du manque d'eau se tait —, mais la tuile
   « Manque d'eau » du résumé (`app/irrigation/planning/weekly-plan-view.tsx`)
   écrit « 0,00 m³ », un zéro que rien ne prouve (D-003), au lieu de dire
   que le manque d'eau ne peut pas être chiffré. Recommandation : la tuile
   le dit dès qu'une chaîne servie n'a pas de stock connu ; une correction
   d'affichage seule, dans sa PR `fix/`, le contrat précisé et le test
   rouge d'abord. Corrigé le 9 novembre 2026 (D-089, F120 à F122), comme
   recommandé : la carte écrit « non chiffré » quand aucune autre chaîne
   ne chiffre de manque d'eau, « au moins X m³ » sinon, et son sous-titre
   compte les chaînes à l'eau inconnue — un matériel sans pompe ou sans
   origine compte aussi —, la ligne de résumé du téléphone de même
   (`tests/planning-shortage-scenarios.test.ts`, rouge avant).
52. **Ouvert le 9 novembre 2026, en écrivant les tests des scénarios de
   pénurie (lot 3 de la 3.9, D-084) ; corrigé le jour même (D-088) ;
   fermeture au jugement du porteur.** S8, pompe archivée : sur la ferme de test, sa seule pompe
   archivée, les cinq matériels qu'elle sert restent proposés « sans
   pompe », eau non vérifiée, 12,71 m³ placés comme si elle servait
   encore ; une seconde chaîne dont la pompe est archivée fait de même (la
   rampe du bloc 2, 4,21 m³). Le contrat (S8) attend aucun créneau sur
   cette chaîne et le motif « origine d'eau ou pompe indisponible ».
   Cause : `buildPlanningEquipment` (`lib/domain/planning/demand.ts`)
   écarte une pompe archivée comme si le matériel n'en avait pas, et le
   matériel prend le chemin « sans pompe habituelle ». Recommandation : un
   matériel dont la pompe habituelle est archivée n'a aucun créneau, avec
   ce motif ; « non vérifié » reste pour le matériel sans pompe habituelle.
   Dans la même PR `fix/` que le point 53, le contrat précisé et le test
   rouge d'abord. Corrigé le 9 novembre 2026 (D-088, F117 et F118), comme
   recommandé : les matériels dont la pompe habituelle est archivée forment,
   pompe par pompe, une chaîne à part, « La pompe (pompe archivée) », sans
   créneau, leurs planches sous ce motif ; sur le même cas, aucun créneau,
   12,71 m³ de manque d'eau sous ce motif, la réserve inchangée quand c'est
   la pompe d'une seconde chaîne (`tests/planning-shortage-scenarios.test.ts`,
   rouge avant).
53. **Ouvert le 9 novembre 2026, en écrivant les tests des scénarios de
   pénurie (lot 3 de la 3.9, D-084) ; corrigé le jour même (D-088) ;
   fermeture au jugement du porteur.** S8, ressource inactive : la rampe du bloc 2 servie par une
   source prélevée directement, la source inactive, ou hors de sa période
   de disponibilité toute la semaine, ne reçoit aucun créneau, comme
   attendu ; mais ses dix planches portent « stock et ressources
   insuffisants d'ici dimanche », 5,61 m³ comptés en manque d'eau, au lieu
   de « origine d'eau ou pompe indisponible » : le budget de la source vaut
   zéro, et sa part, prise avant le placement, nomme la coupe. À l'inverse,
   une réserve inactive donne le bon motif à ses planches, mais sa ligne de
   budget annonce « 97,01 m³ mobilisables » qu'aucun créneau ne peut
   prendre. Recommandation : une chaîne dont l'origine est indisponible
   pour la semaine le dit sur sa ligne de budget, sans eau mobilisable, et
   ses planches portent ce motif avant tout partage ; une ressource
   disponible une partie de la semaine garde son budget (8 m³ du jeudi au
   dimanche, déjà juste). Avec le point 52. Corrigé le 9 novembre 2026
   (D-088, F116, F118 et F119), comme recommandé : la source inactive ou
   hors de sa période porte ce motif sur ses dix planches avant tout
   partage, et la ligne de budget d'une chaîne indisponible dit
   « indisponible cette semaine, aucune eau mobilisable » (zéro, au lieu
   des 97,01 m³ de la réserve inactive) ; disponible une partie de la
   semaine, la source garde ses 8 m³. Sous un arbitrage, ces planches ne
   portent plus « stock et ressources » en plus, et leurs allocations
   restent non attribuées (`tests/planning-shortage-scenarios.test.ts`,
   rouges avant).
54. **Ouvert le 9 novembre 2026, en écrivant les tests des scénarios de
   pénurie (lot 3 de la 3.9, D-084) ; corrigé le jour même (D-085) ;
   fermeture au jugement du porteur : le plan proposait de prélever plus
   que l'autorisation.** S9, deux chaînes : sur la ferme en taille, les rampes des blocs 3 et 4 sur une
   source à sa pompe de 3 m³/h, la limite de prélèvement à 2 m³ par jour,
   la source donne 2 m³ le mardi, 4 m³ le mercredi — le bloc 3 de 21 h à
   22 h 05, le bloc 4 de 22 h 05 à 23 h 10 —, 2 m³ le jeudi. Cause : le
   moteur vérifie ce qui reste à la ressource sur les jours du créneau
   entier (le mercredi, rien ; le jeudi, 2 m³), le raccourcit à 2 m³, puis
   place ce créneau raccourci, fini avant minuit, sur le seul mercredi
   (`lib/domain/planning/engine.ts`, la vérification de la ressource
   directe). Les invariants des tests vérifient les limites journalières
   d'irrigation, pas les limites de prélèvement. Recommandation : vérifier
   le créneau raccourci jour par jour, comme la limite journalière, et
   ajouter aux invariants la limite de prélèvement de chaque ressource,
   jour par jour ; une PR `fix/` avec les points 55 et 58, le test rouge
   d'abord. Corrigé le 9 novembre 2026 dans la PR des limites par jour
   (D-085, F103, F106 et F107) : le créneau se juge jour par jour depuis son
   début et s'arrête là où le reste de la source pour un de ses jours
   s'épuise ; ce qu'il prend à la source se compte à la part de sa durée
   tombée chaque jour, non plus à parts égales entre ses jours ; les
   invariants des tests vérifient la limite de prélèvement jour par jour.
   Sur le même cas, la source donne au plus 2,00 m³ chaque jour, pour le
   même volume placé, 28,00 m³ (`tests/planning-daily-limits.test.ts`,
   rouge avant : 4,000 m³ le mercredi).
55. **Ouvert le 9 novembre 2026, en écrivant les tests des scénarios de
   pénurie (lot 3 de la 3.9, D-084) ; corrigé le jour même (D-085) ;
   fermeture au jugement du porteur.** S9 encore : la coupe d'une
   ressource directe se nomme comme celle d'une réserve. Un créneau raccourci par la limite de prélèvement
   de la source dit « réserve « Source du bas » au minimum de sécurité »,
   sa dose « ce que la réserve fournit sans passer sous son minimum », et
   un créneau qu'elle empêche, « réserve au minimum de sécurité au moment
   voulu ». Une source n'a ni réserve ni minimum : ce qui la borne, c'est
   sa limite de prélèvement du jour. Recommandation : nommer cette limite
   (« limite de prélèvement de « Source du bas » atteinte ce jour-là ») ;
   c'est un motif nouveau, donc le contrat du planning précisé d'abord.
   Avec les points 54 et 58. Corrigé le 9 novembre 2026 dans la même PR
   (D-085, F105) : le motif nouveau « limite de prélèvement ». La carte dit
   « limite de prélèvement de « Source du bas » atteinte », la dose « ce
   que la limite de prélèvement laisse », le moment « un jour où la limite
   de prélèvement le permet », et une planche qu'elle empêche « limite de
   prélèvement de la ressource atteinte », comptée en manque d'eau ;
   « ce jour-là » est tombé, comme pour la limite journalière. Une source
   trop petite pour la dose minimale de la rampe du bloc 2 (0,3 m³ par
   jour pour 1,4 m³) le dit (rouge avant : « réserve au minimum de
   sécurité au moment voulu »).
56. **Ouvert le 9 novembre 2026, en écrivant les tests des scénarios de
   pénurie (lot 3 de la 3.9, D-084) ; corrigé le jour même (D-087) ;
   fermeture au jugement du porteur.** S6, l'eau et le temps de pompage ensemble : le résumé compte
   tout le manque d'une planche sous le premier de ses motifs dans l'ordre
   alphabétique (`summarizeDeficit`, `lib/domain/planning/engine.ts`).
   Une planche coupée à la fois par sa part et par le temps de pompage, ou
   par l'espacement, voit son manque entier compté en temps de pompage, ou
   hors des deux tuiles. Sur la ferme de test, dimanche 21 h, la plage des
   asperseurs réduite à 21 h – 21 h 30, les tunnels prioritaires, les blocs
   bas, la réserve à 4,48 m³ et le forage arrêté : 12,07 m³ demandés,
   4,01 m³ placés ; le résumé dit « Manque d'eau 0 m³ » et « Temps de
   pompage manquant 6,25 m³ », dont les 5,61 m³ du bloc 2, que sa part à
   0 % prive de tout. Le contrat (S6) veut deux manques distincts, ni l'un
   dans l'autre, et une note du manque d'eau (D-038) qui n'impute au temps
   de pompage que ce qui lui revient. Recommandation : la part coupée
   (besoin moins part) compte en manque d'eau, le reste (part moins placé)
   sous le motif du placement ; sa PR `fix/` porte le test entier de S6.
   Corrigé le 9 novembre 2026 (D-087, F113 à F115), comme recommandé, la
   part étant celle de la fin du calcul : sur le même cas, 6,95 m³ de
   manque d'eau, 0,64 m³ de temps de pompage (le tunnel 1, dont le bloc 1 a
   reçu la part) et 0,47 m³ d'espacement (le bloc 1)
   (`tests/planning-shortage-scenarios.test.ts`, rouge avant : 0 m³ et
   6,25 m³).
57. **Ouvert le 9 novembre 2026, en écrivant les tests des scénarios de
   pénurie (lot 3 de la 3.9, D-084) ; corrigé le jour même (D-086) ;
   fermeture au jugement du porteur ; le cas limite tranché par lui le
   jour même.** S20, validation en
   pénurie : les quatre tunnels pour 5 m³ (la pénurie de la cinquième
   recette), chacun reçoit 9,76 mm ; les propositions des tunnels 1 et 2
   validées, le recalcul refait les parts sur le reste du budget (2,50 m³)
   et le reste des besoins : les tunnels 3 et 4 tombent à 6,46 mm, 0,85 m³
   restent dans la réserve, et chaque tunnel validé garde une part de
   1,42 mm qu'aucun créneau ne lui donne. Le contrat (S20) attend que les
   irrigations validées comptent comme prélèvements placés et que les
   tunnels 3 et 4 gardent leur part, mêmes doses qu'avant. Cause : les
   parts se calculent sur les besoins nets de l'eau planifiée
   (`lib/domain/planning/shortage.ts`) et sur un budget net des
   prélèvements planifiés (`lib/domain/planning/chains.ts`).
   Recommandation : les parts sur le besoin entier et le budget entier,
   l'eau planifiée comptée comme déjà placée pour ses planches. Cas
   limite : une irrigation validée au-delà de la part de sa planche ;
   prendre l'excédent sur les parts des autres est un choix agronomique,
   à poser au porteur quand ce point se code. Sa PR `fix/` porte le test
   entier de S20. Corrigé le 9 novembre 2026 (D-086, F108 à F112), comme
   recommandé : l'eau que les irrigations planifiées de la chaîne d'une
   planche lui donneront encore compte comme déjà placée dans sa part ;
   après la validation des tunnels 1 et 2, les tunnels 3 et 4 gardent
   leurs 9,76 mm et rien ne reste dans la réserve
   (`tests/planning-shortage-scenarios.test.ts`, rouge avant : 6,46 mm),
   et le service le vérifie de la validation au recalcul
   (`tests/db/planning-validation.test.ts`). Sous un arbitrage,
   l'allocation compte l'eau validée. Le cas limite, posé au porteur le
   9 novembre 2026, est tranché par lui le jour même à 16 h 22 : « selon la
   conduite choisie », l'option recommandée, déjà codée : la conduite se
   rejoue, la planche servie
   au-delà gardant ce qu'elle a reçu, et l'eau libérée en fin de tour suit
   la même règle.
58. **Ouvert le 9 novembre 2026, en reproduisant le point 54 (lot 3 de la
   3.9, D-084) ; corrigé le jour même (D-085) ; fermeture au jugement du
   porteur : le plan proposait d'arroser plus que la limite journalière,
   celle d'un arrêté.** S5, la limite journalière d'irrigation : un créneau à cheval sur minuit dont le
   premier jour est déjà plein y garde sa part. Sur la ferme des tests à la
   taille de la ferme réelle, aux réglages par défaut, une limite de 15 m³
   par jour : le jeudi, quatre rampes de bloc remplissent la journée à
   15,00 m³, puis cinq créneaux partent de 22 h 42 à 23 h 33 et y ajoutent
   7,10 m³, soit 22,10 m³ le jeudi et 17,99 m³ le vendredi ; à 18 m³ par
   jour, 22,12 m³ le jeudi. Cause : `DailyLimitLedger.evaluate`
   (`lib/domain/planning/supply.ts`) rend le dépassement du premier jour
   qui dépasse, et le moteur raccourcit le créneau de ce volume par sa fin
   (`lib/domain/planning/engine.ts`, « La limite journalière ») : quand le
   premier jour est celui qui borne, la coupe retire l'eau du lendemain, et
   le premier jour reste au-dessus. Le même défaut que le point 54, par un
   autre chemin. La garde de la validation, elle, compte jour par jour :
   elle refuse ces créneaux (« Limite journalière dépassée le … ») ; rien
   ne part donc au-delà de la limite par le module, mais le plan propose
   ce qui ne peut pas être validé. Les tests existants ne le voyaient pas :
   leurs créneaux passent rarement minuit, alors que le test d'invariants
   vérifie déjà la limite jour par jour. Recommandation : une seule
   correction pour 54 et 58, dans la même PR `fix/` que 55 : couper le
   créneau jour par jour depuis son début, à l'heure où le reste du jour
   s'épuise ; un créneau qui ne peut plus rien prendre le premier jour
   part à minuit si sa plage continue ; le test rouge d'abord, la ferme en
   taille à 15 m³. Corrigé le 9 novembre 2026 dans la même PR (D-085, F103
   et F104), comme recommandé. Sur la ferme en taille à 15 m³, aucun jour
   ne passe 15,00 m³ ; deux créneaux partent à minuit le vendredi, trois
   le samedi, et tout le besoin est placé, 71,29 m³ au lieu de 70,60. La
   petite ferme à 3 m³ ne passe plus 3,00 m³ le mardi (rouge avant :
   3,054 m³). Un balayage de limites ne trouve plus aucun jour au-delà de
   la sienne, quand cinq plans sur dix dépassaient avant.
59. **Ouvert le 9 novembre 2026, en corrigeant le point 51 (D-089) ; à
   corriger avant la recette finale.** Le pli des changements d'un
   recalcul (3.7, `lib/domain/planning/changes.ts` et
   `lib/domain/planning/follow-up.ts`) compare le manque d'eau chiffré des
   deux calculs : « Manque d'eau : de 3 à 0 m³ (−3 m³) ». Quand l'eau d'une
   chaîne servie devient inconnue entre les deux — un matériel qui perd sa
   pompe habituelle, une réserve sans stock observé —, son manque n'est
   plus chiffré, et le pli lit une baisse que rien ne prouve (D-003), alors
   que la carte dit désormais « non chiffré » ; l'inverse se lit comme une
   hausse. Rare, mais trompeur le jour où il arrive. Recommandation : le
   calcul retient, pour chacun des deux, s'il avait une chaîne servie à
   l'eau inconnue, et le pli écrit alors « non chiffré » de ce côté-là,
   comme la carte ; une PR `fix/` à part, le contrat précisé et le test
   rouge d'abord.

## Procédure de reprise rapide

```text
git status --short --branch
git log -5 --oneline --decorate
pnpm lint
pnpm typecheck
pnpm test
```

Lire ensuite le dernier point ouvert pertinent de `ROADMAP.md`. Ne modifier
le code fonctionnel que si la tâche en cours l'exige ou si un contrôle révèle
un défaut réel.
