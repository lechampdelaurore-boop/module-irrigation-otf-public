# Contrat — fonctionnalités à la carte et réorganisation de l'interface (3.8)

Écrit le 7 novembre 2026, avant tout code, en Opus 5.5 · Très élevé (ligne 23
de `docs/ROADMAP.md` ; écrit ici et non en Sonnet 5.5 · Moyen, sur le choix écrit
du porteur, question 12). Il s'appuie sur la définition donnée par le porteur
le 7 novembre 2026 à 12 h 24, issue de son accord avec le développeur de Tlaloc
(D-066), et sur ses réponses aux douze questions (annexe A). Les précisions
suivantes sont tranchées par la recommandation, sur sa consigne de 13 h 16
(« répond à toutes les autres questions tout seul en prenant ta
recommandation ») ; elles sont toutes listées en section 11 pour sa relecture.
**Mandat du porteur, 7 novembre 2026, 13 h 47** : « Fini de construire toute la
3.8 en autonomie. Donc tu réponds aux questions par tes recommandations, si
jamais. Et je revérifierai ensuite en direct sur la version en ligne
l'ergonomie, comment elle est. » La 3.8 se construit donc jusqu'au déploiement
sans maquette préalable ni relecture avant fusion ; toute question nouvelle est
tranchée par la recommandation et consignée en section 11 ; le porteur juge
l'ergonomie sur le site en ligne et fait son retour. Décision : D-067.
**Codée en sept PR (#271 à #276, #278) et close par le porteur le
8 novembre 2026** (section 9, « État de la preuve à la clôture »).

Le logiciel est **multi-fermes** : aucune case n'est pensée pour une ferme
particulière, et une ferme nouvelle ne voit rien coché d'avance. Les exemples
du porteur (une ferme qui ne veut que le pilotage des électrovannes, une
autre que le calculateur) disent l'usage visé, pas une ferme.

## 1. Ce que la 3.8 change, et ce qu'elle ne change pas

**La définition du porteur.** Il n'y a plus de mode simple ni de mode complet :
un seul mode. Le logiciel propose une liste de fonctionnalités à cocher ;
chaque ferme ne voit et ne fait tourner que ce qu'elle a coché. « Un logiciel
avec un affichage et des fonctionnalités à la carte. » Certaines
fonctionnalités ont besoin d'autres données, qu'il faut alors afficher et
renseigner.

La 3.8 apporte, dans cet ordre :

1. la **liste des fonctionnalités** (dix cases), avec leurs dépendances ;
2. **une page par case**, avec la navigation de la charte : menu à gauche sur
   ordinateur, bande de pages en bas sur téléphone ;
3. le **choix des cases** à la première ouverture, puis dans « Réglages » ;
4. la **prise en compte** : une case décochée n'est ni affichée ni calculée ;
5. l'**aide contextuelle** : un « ? » par page et, sur les chiffres
   principaux, une bulle « d'où vient ce chiffre ».

Elle **ne change pas** :

- les règles métier des contrats existants : aucun calcul de besoin, de
  planning, de réserve du sol, d'alerte ou de volume n'est modifié ; une case
  décochée retire une source de données ou un traitement, jamais une formule ;
- la charte du module et la refonte ergonomique déjà livrée (conservées, D-066) ;
- Ouvre ta ferme, toujours lu sans jamais être modifié, à quatre requêtes par
  seconde au plus (D-001, D-002) ;
- les données : décocher n'efface rien (section 4, R1).

## 2. Les dix cases

Les noms sont ceux validés par le porteur (question 2). L'identifiant sert au
code et à la base ; il ne s'affiche pas. Le numéro sert aux dépendances ; il
ne dit plus l'ordre d'affichage, qui commence par Arrosages depuis la
précision P36.

| N° | Case | Identifiant | Ce qu'elle contient aujourd'hui | Ce qu'elle fait tourner sans qu'on regarde | A besoin de |
| --- | --- | --- | --- | --- | --- |
| 1 | Matériel et placement | `materiel` | le plan des parcelles, jardins et planches, la fiche de la planche, l'apport calculé par heure, le matériel et ses réglages, la pose, le retrait, le stockage, les groupes de jardins alignés | rien | — |
| 2 | Arrosages | `arrosages` | irriguer maintenant, planifier, déjà réalisée, les irrigations à venir ou à terminer, la limite journalière d'irrigation | la notification de fin d'arrosage | 1 |
| 3 | Objectifs et besoins | `besoins` | les objectifs en mm par semaine, la météo de la semaine, la pluie mesurée, le tableau des jours, les besoins et priorités par planche | rien (les besoins se calculent à l'ouverture) | 2 |
| 4 | Planning de la semaine | `planning` | les propositions, leurs réglages, le suivi (« À venir », « Ce qui a changé »), les retards, les suggestions, les créneaux protégés (3.8 ter) | le calcul du plan chaque matin, la notification du matin | 3 |
| 5 | Ressources et pompes | `ressources` | les ressources en eau, leurs relevés et leur débit, les pompes, la faisabilité et la répartition en cas de manque | rien | 2 |
| 6 | Réserve du sol | `sol` | les réglages du sol, la jauge par jardin et par planche, les observations, l'eau arrosée en trop, la dose au-delà de ce que le sol retient sur les propositions | l'état du jour enregistré chaque matin | 7, 2 |
| 7 | Besoin par culture | `cultures` | les coefficients culturaux, les profils racinaires, les durées propres à la ferme, l'objectif proposé sur la fiche de la planche et de la série, l'avertissement de l'aspersion | l'ETM enregistrée chaque matin | 3 |
| 8 | Alertes météo | `alertes-meteo` | l'encart des alertes météo et leurs réglages | l'envoi des alertes après chaque prévision | — |
| 9 | Alertes cultures | `alertes-cultures` | l'encart des alertes cultures : gel selon la culture, arrêt d'arrosage avant récolte, aspersions à reconsidérer ; le curseur de microclimat | l'envoi de ces alertes | — |
| 10 | Historique et cumuls | `historique` | les cumuls, l'historique, le suivi par série, l'export CSV | rien | 2 |

« A besoin de » se lit de proche en proche : cocher le Planning (4) coche
Objectifs et besoins (3), donc Arrosages (2), donc Matériel et placement (1).

**Pourquoi ces dépendances** (relevées dans le code le 7 novembre 2026) :

- Arrosages → Matériel : un arrosage se fait avec un matériel posé et son réglage.
- Objectifs et besoins → Arrosages : le besoin retire l'eau réellement arrosée
  (écart = objectif − (irrigation réelle + pluie réelle)) ; sans les arrosages,
  l'irrigation réelle serait inconnue, et une valeur inconnue ne devient jamais
  zéro (D-003).
- Planning → Objectifs et besoins : le plan répartit les besoins.
- Ressources et pompes → Arrosages : le débit des pompes se lit sur les
  arrosages qu'elles servent.
- Réserve du sol → Besoin par culture et Arrosages : la jauge consomme l'ETM et
  les profils racinaires de la culture, et compte les arrosages.
- Besoin par culture → Objectifs et besoins : son objectif proposé ne compte
  que par une révision d'objectif adoptée (D-045).
- Historique → Arrosages : l'historique est celui des arrosages.
- Alertes météo et Alertes cultures n'ont besoin d'aucune autre case
  (seulement du socle, section 3).

**Les parties qui dépendent d'une autre case** (précision P1). Deux parties de
case ont besoin d'une case que la leur n'exige pas : les **aspersions à
reconsidérer** (case 9) lisent les créneaux du Planning (4), et la
**faisabilité et la répartition** (case 5) lisent les besoins (3). Sans la case
dont elles ont besoin, elles ne s'affichent pas et ne tournent pas, et une
ligne le dit à leur place (« Les aspersions à reconsidérer demandent le
Planning de la semaine »). On n'impose pas tout le Planning à une ferme qui ne
veut que l'alerte de gel.

**Les cases à venir.** Le calculateur d'irrigation (3.8 bis) et le pilotage des
électrovannes (que Tlaloc apporte avec la fusion des deux moteurs) deviennent
des cases quand ils existent. Une ferme qui a déjà fait son choix trouve une
case nouvelle décochée, annoncée une fois par le bandeau de la section 4 (R7)
(précision P2).

## 3. Le socle : ce qui n'est pas une case

Certaines choses servent à plusieurs cases ; elles ne se cochent pas et
s'affichent dès qu'une case cochée en a besoin.

- **Toujours** : l'en-tête (nom de la ferme, session), la lecture d'Ouvre ta
  ferme (source, date de la dernière lecture, « Actualiser »), le choix de la
  saison, la navigation, « Réglages » et la mention « Données OTF protégées ».
- **Le choix de la parcelle** : sur les pages qui montrent des planches.
- **Dans Réglages**, chacun avec la condition qui le fait paraître :
  - la **liste des cases** (toujours) ;
  - le **lieu de la météo** (commune du siège d'Ouvre ta ferme ou commune
    choisie) : dès que la case 3, 6, 7, 8 ou 9 est cochée ;
  - les **notifications du téléphone** (l'autorisation et son état) : dès que
    la case 2, 4, 8 ou 9 est cochée ;
  - la **correspondance des espèces** d'Ouvre ta ferme avec les cultures du jeu
    commun : dès que la case 7 ou 9 est cochée. Elle quitte la page des
    coefficients culturaux pour Réglages, parce que les alertes de gel en ont
    besoin sans les coefficients (précision P3).

**La météo de la ferme** est relevée chaque matin dès qu'une case cochée
l'utilise (3, 6, 7, 8 ou 9) ; une ferme qui n'en coche aucune n'est plus
relevée (précision P4).

## 4. Les règles du choix

- **R1 — Décochée, ignorée, données gardées** (question 1). Une case décochée
  n'a plus de page, plus de bloc dans les autres pages, plus de calcul
  d'arrière-plan, plus de notification, et n'entre plus dans les calculs des
  autres cases. Ses données restent enregistrées telles quelles, sans
  suppression ni migration destructive, et reviennent à l'identique quand on la
  recoche. Ce qui aurait dû tourner pendant qu'elle était décochée ne se
  rattrape pas : par exemple, l'ETM des matins passés n'est pas enregistrée
  après coup (précision P5).
- **R2 — L'avertissement.** Décocher une case qui a des données ouvre une
  fenêtre de confirmation qui dit ce qui disparaît et ce qui change ailleurs.
  Exemple, pour Ressources et pompes : « Vos 2 ressources et 1 pompe restent
  enregistrées. Le planning ne tiendra plus compte de leurs débits ni de leurs
  stocks : il se calculera comme pour une ferme sans pompe ni ressource
  déclarée. » Sans données, pas de fenêtre. Le texte de chaque case est écrit
  dans le code et testé (section 9).
- **R3 — Cocher entraîne le nécessaire** (question 3). Cocher une case coche
  aussi les cases dont elle a besoin, chacune avec la ligne « nécessaire pour
  … ». Une case nécessaire à une case cochée ne peut pas être décochée : elle
  est grisée et dit pour laquelle ; on décoche d'abord la case qui en a
  besoin. Décocher une case ne décoche jamais d'elle-même celles qu'elle avait
  entraînées (précision P6).
- **R4 — Pour toute la ferme** (question 4). Le choix vaut pour l'exploitation
  (l'espace d'irrigation) : écrans, calculs, alertes. Aujourd'hui, un compte
  est une ferme. La Tranche 4 pourra ajouter un masque d'affichage par
  personne, avec les rôles ; le « pris en compte » restera celui de la ferme.
- **R5 — À la première ouverture** (question 5). Une ferme qui ouvre le module
  pour la première fois (aucun espace d'irrigation encore créé) voit la liste,
  rien coché d'avance, avant toute autre page. Il faut cocher au moins une case
  pour continuer (précision P7). Le choix enregistré, elle arrive sur sa
  première page.
- **R6 — Les fermes qui utilisent déjà le module** (question 5). Tout reste
  coché : rien ne disparaît sans prévenir. Un bandeau, affiché une seule fois
  et fermé d'un geste, dit : « Vous pouvez maintenant choisir les
  fonctionnalités affichées, dans Réglages. »
- **R7 — Une case nouvelle** (P2) : décochée chez une ferme qui a déjà
  choisi, annoncée une fois par le même bandeau.
- **R8 — Dans Réglages**, la liste se change à tout moment, avec R2 et R3.
- **R9 — Le changement prend effet tout de suite.** La page se recharge sur le
  nouveau choix ; les traitements du matin suivent le choix du moment où ils
  tournent. Si le Planning est coché et que le changement touche ses données
  (Ressources et pompes, ou Réserve du sol pour ses notes), le plan de la
  semaine est recalculé, avec dans son en-tête la raison « après un changement
  des fonctionnalités » (précision P8 ; même mécanique que les recalculs sur
  événement de la 3.7, D-051).
- **R10 — Le choix est daté et conservé** : la date de chaque changement est
  enregistrée, sans historique des choix précédents (précision P9).

## 5. Les pages et la navigation

**Une page par case cochée** (question 6), plus « Réglages ». L'ordre des
pages est celui de la liste. La première page, celle qu'ouvre
« Irrigation », est la première case cochée de la liste (précision P10) : pour
une ferme qui a tout coché, Arrosages (précision P36).

| Page | Adresse | Contenu |
| --- | --- | --- |
| Matériel et placement | `/irrigation/materiel` | plan, fiche de la planche, apport par heure, groupes de jardins, matériel |
| Arrosages | `/irrigation/arrosages` | enregistrer ou planifier, à venir ou à terminer, limite journalière |
| Objectifs et besoins | `/irrigation/besoins` | objectifs, météo de la semaine, pluie mesurée, tableau des jours, besoins et priorités |
| Planning de la semaine | `/irrigation/planning` | le plan, ses réglages, son suivi |
| Ressources et pompes | `/irrigation/ressources` | ressources, relevés, pompes, faisabilité et répartition |
| Réserve du sol | `/irrigation/sol` | réglages du sol, jauges, observations, eau en trop |
| Besoin par culture | `/irrigation/cultures` | coefficients culturaux, profils racinaires, durées |
| Alertes météo | `/irrigation/alertes-meteo` | l'encart et ses réglages |
| Alertes cultures | `/irrigation/alertes-cultures` | l'encart, ses réglages, le microclimat |
| Historique et cumuls | `/irrigation/historique` | cumuls, historique, séries, export |
| Réglages | `/irrigation/reglages` | la liste des cases et le socle de la section 3 |
| (première ouverture) | `/irrigation/bienvenue` | la liste, rien coché |

- **Ordinateur** : menu à gauche, fond `#e7f1ee`, page choisie en vert `#0b694d`
  texte blanc (charte, section 7). **Téléphone** : barre du haut anthracite
  (nom de la ferme, avatar) et barre du bas fixe, une bande de pages qui
  défile, la page courante en pilule verte. Les quatre pastilles d'univers de
  la maquette (Production, Vente, Gestion, Paramètres) sont celles d'Ouvre ta
  ferme : le module ne les reproduit pas (précision P11). Cibles tactiles de
  44 px.
- **La saison et la parcelle** suivent d'une page à l'autre, dans l'adresse
  (`?season=…&zone=…`) ; la parcelle choisie n'est plus perdue en changeant de
  page (précision P12).
- **Dans chaque page, les blocs gardent leur ordre d'aujourd'hui** : la 3.8
  range les blocs dans leurs pages, elle ne les réécrit pas (précision P13).
  Les icônes au trait de la charte (goutte, calendrier, pousse, pluie, jauge,
  réglages, alerte) marquent les entrées du menu.
- **La fiche de la planche** (page Matériel et placement) montre les blocs des
  cases cochées seulement : le besoin de la culture si la case 7 est cochée.
- **Les anciennes adresses continuent de marcher** (précision P14). Les
  notifications déjà reçues ouvrent `/irrigation?…#…` (alertes météo, alertes
  cultures, arrosages) : l'ancre désigne la page qui porte ce bloc, et le
  module y conduit, avec la même semaine. Si la page est décochée, il conduit à
  la première page avec la ligne « Cette fonctionnalité n'est pas cochée pour
  votre ferme. » Les nouvelles notifications donnent l'adresse de la page.
- **Chaque page ne lit que ses données** : la page d'aujourd'hui charge tous les
  tableaux de bord à chaque ouverture ; chaque page ne chargera que les siens.

## 6. L'aide contextuelle

Choix du porteur, question 7 : le « ? » par page **et** l'origine des chiffres.

- **Le « ? » de chaque page**, à côté de son titre, ouvre une courte
  explication : à quoi sert la page, comment la lire, ce qu'on y fait en
  premier. Les textes sont réunis en un seul fichier, écrits en phrases simples ;
  le porteur les relit sur le site en ligne (mandat du 7 novembre 2026) et
  ses corrections passent par une PR.
- **La bulle « d'où vient ce chiffre »**, sur les chiffres principaux, dit le
  calcul avec les valeurs de la ferme. Exemple, sur le besoin d'une planche :
  « Objectif 20 mm − (arrosé 5 mm + pluie mesurée 3 mm) = 12 mm à apporter
  cette semaine. »
- **Une seule source pour le chiffre et sa bulle.** La bulle ne refait jamais
  le calcul : elle met en mots les valeurs intermédiaires que le calcul a déjà
  produites, dans le même module que lui (interdit de dupliquer une règle,
  AGENTS.md). Un test par bulle vérifie que les nombres de la bulle sont ceux
  du chiffre affiché.
- **Les chiffres qui reçoivent une bulle** (liste de départ, chacun renvoyé à
  son contrat) :

| Page | Chiffre | Contrat |
| --- | --- | --- |
| Matériel et placement | l'apport par heure d'un matériel posé (mm/h) | `docs/irrigation-feasibility-contract.md`, `docs/wetted-surface-contract.md` |
| Arrosages | la durée et le volume d'un arrosage pour une dose en mm | `docs/irrigation-needs-contract.md` |
| Objectifs et besoins | le besoin de la semaine d'une planche ; la pluie réelle du jour (mesurée ou réanalyse) | `docs/irrigation-needs-contract.md`, `docs/weather-contract.md` |
| Planning de la semaine | la durée, le volume et la part servie d'une proposition ; la raison d'un « Non placé » | `docs/planning-contract.md` |
| Ressources et pompes | le débit mesuré entre deux relevés ; le stock disponible | `docs/resource-flow-contract.md`, `docs/water-resources-contract.md` |
| Réserve du sol | le pourcentage de la jauge ; le seuil d'arrosage | `docs/soil-reserve-contract.md` |
| Besoin par culture | l'ETM du jour ; l'objectif proposé de la semaine | `docs/crop-water-need-contract.md` |
| Alertes cultures | le seuil de gel d'une culture (seuil, marge, microclimat) | `docs/weather-crop-alerts-contract.md` |
| Historique et cumuls | un cumul en mm à l'échelle d'un jardin ou de la ferme (pondéré par la surface) | `docs/irrigation-data-model.md`, `docs/series-contract.md` |

  La liste peut s'allonger en codant ; chaque ajout est consigné dans ce
  contrat.

## 7. Pour le code

- **Le domaine** : `lib/domain/features/` porte la liste des cases, leurs
  dépendances, la fermeture (« cocher entraîne »), le refus de décocher une
  case nécessaire, la condition d'affichage des éléments du socle et des
  parties de case (P1), et le texte des avertissements (R2). Rien d'autre ne
  sait quelles cases dépendent de quelles autres.
- **La persistance** : une table `irrigation_feature_selections` (une ligne par
  espace d'irrigation : cases cochées, date du choix, date de la fermeture du
  bandeau, dernières cases annoncées), par une migration additive. Pas de
  ligne = ferme d'avant la 3.8 : tout coché, bandeau à montrer. Pas d'espace
  d'irrigation = première ouverture.
- **La prise en compte** : chaque traitement du matin (plan, notification du
  matin, ETM, état du sol, relevé météo, alertes météo, alertes cultures, arrêt
  avant récolte) et chaque envoi de notification lit le choix de la ferme avant
  de tourner ; le planning reçoit des ressources et des pompes vides quand la
  case 5 est décochée, et le moteur fait alors ce qu'il fait déjà pour une
  ferme sans pompe déclarée (« sans pompe », propositions non vérifiées
  hydrauliquement) ; aucune ligne du moteur ne change.
- **L'interface** : une route par page sous `app/irrigation/`, un gabarit
  commun (en-tête, navigation, saison, parcelle) ; les composants des blocs
  restent ceux d'aujourd'hui, déplacés sans réécriture.
- **Les fichiers** restent sous 600 lignes (code) et 600 lignes (styles).

## 8. Ce qui reste interdit

- Effacer ou modifier une donnée parce qu'une case est décochée.
- Changer une formule, un seuil ou une règle d'un contrat existant.
- Une bulle qui recalcule ce que le calcul a déjà fait.
- Un appel de plus à Ouvre ta ferme, ou une écriture vers lui.
- Une case cochée ou décochée sans le geste de la ferme (hors R6 et R7).

## 9. Preuve de fin

Remplace celle du bloc 3.8 de la roadmap (« aucune modification dans `lib/` ni
`db/` » ne tient plus : le choix des cases s'enregistre et se lit).

1. **Tests du domaine** : la fermeture des dépendances pour chaque case, le
   refus de décocher une case nécessaire, les conditions du socle et des
   parties de case, le texte de chaque avertissement, la case nouvelle (R7).
2. **Tests de persistance** : le choix enregistré et relu par ferme, l'absence
   de ligne lue comme « tout coché », l'isolation entre fermes.
3. **Tests des traitements** : pour chaque traitement du matin et chaque
   notification, une ferme qui a décoché la case ne le reçoit pas, et une ferme
   qui l'a cochée le reçoit comme avant ; le planning d'une ferme sans la case 5
   est identique à celui d'une ferme sans pompe ni ressource.
4. **Tests des bulles** : une par bulle, les nombres de la bulle égaux au
   chiffre affiché.
5. **Parcours navigateur** : les 23 parcours existants, adaptés seulement pour
   aller à la bonne page, verts aux deux largeurs ; trois parcours nouveaux :
   la première ouverture et le choix ; décocher (avertissement, page et blocs
   disparus, données intactes) puis recocher (données revenues) avec une
   dépendance ; le « ? » et une bulle par page.
6. **Temps de chargement** de la première page mesuré avant et après (journal
   `irrigation_page_loaded`), sans dégradation.
7. **Vérification par le porteur** après déploiement, sur le site en ligne,
   sur ordinateur et à 390 px (mandat du 7 novembre 2026) : sa ferme toute
   cochée et le bandeau ; décocher puis recocher une case et retrouver ses
   données ; un ancien lien de notification ; la relecture des textes d'aide ;
   l'ergonomie. Le porteur juge (D-014) et fait son retour ; ses retours
   passent par des PR.
8. **Registres** à jour.

### État de la preuve à la clôture (8 novembre 2026)

La 3.8 est **close par le porteur le 8 novembre 2026 à 20 h 21** (« On va
clôturer la 3.8 pour l'instant, quitte à ce que je fasse des modifications
ultérieurement »).

1. à 4. Les tests du domaine, de la persistance, des traitements et des
   bulles existent et passent (PR 1 à 6, #271 à #276).
5. Les parcours existants adaptés et les trois nouveaux (P22, P23, P24) sont
   verts aux deux largeurs ; P10, P11, P14, P19 et P21 adaptés aux retours du
   porteur (#278).
6. Le temps serveur de la première page est mesuré en local dans la PR 2
   (#272, journal `irrigation_page_loaded`) : 178,5 ms médians pour
   l'ancienne page unique, 20,5 ms pour Matériel et placement et de 17 à
   82 ms pour les autres pages ; il n'a pas été relevé sur le site en ligne.
7. Le porteur a vérifié le site en ligne le 7 novembre 2026 au soir ; le
   premier lot de ses retours (P36 à P46) est en ligne depuis le 7 novembre
   à 22 h 28 (#278), et il a confirmé le 8 novembre que les dessins des
   espèces d'Ouvre ta ferme s'affichent. Il clôt sans second lot ; ses
   modifications éventuelles passeront chacune par une PR.
8. Registres à jour par la PR de clôture.

Reste posée, sans code : l'écran d'arbitrage d'une pénurie présenté comme un
plan d'assolement (retour du porteur du 7 novembre), recommandé dans la 3.9,
maquette d'abord ; le choix revient au porteur.

## 10. Le découpage en PR

Une PR à la fois, chacune fusionnée et déployée avant la suivante :

1. le domaine et la persistance du choix (migration additive) ;
2. les pages et la navigation, toutes les cases visibles, les anciennes
   adresses conduites (les parcours adaptés) ;
3. le choix des cases : première ouverture, Réglages, bandeau, avertissements,
   pages et blocs filtrés (parcours nouveaux) ;
4. la prise en compte dans les traitements et les notifications ;
5. le « ? » de chaque page et ses textes ;
6. les bulles « d'où vient ce chiffre », en une ou plusieurs PR ;
7. la PR de clôture, après la vérification du porteur en ligne.

Pas de maquette avant la 1 : le porteur a demandé le 7 novembre 2026 que la
3.8 soit construite en autonomie jusqu'au déploiement et jugera l'ergonomie
en ligne.

## 11. Précisions tranchées par la recommandation (délégation du 7 novembre 2026, 13 h 16)

Tranchées par la recommandation, sous la délégation de 13 h 16 puis le mandat
de 13 h 47 ; le porteur les juge sur le site en ligne et son retour peut en
changer chacune par une PR.

- **P1** Les parties de case qui ont besoin d'une autre case (aspersions à
  reconsidérer, faisabilité) ne s'affichent qu'avec elle, une ligne le dit ;
  elles n'imposent pas cette case.
- **P2** Une case nouvelle arrive décochée chez une ferme qui a déjà choisi,
  annoncée une fois.
- **P3** La correspondance des espèces passe dans Réglages (cases 7 et 9).
- **P4** La météo d'une ferme n'est plus relevée si aucune case cochée ne
  l'utilise.
- **P5** Ce qui n'a pas tourné pendant qu'une case était décochée ne se
  rattrape pas.
- **P6** Décocher une case ne décoche pas celles qu'elle avait entraînées.
- **P7** Au moins une case pour continuer, à la première ouverture.
- **P8** Un changement de cases qui touche le Planning le recalcule, raison
  dite dans l'en-tête.
- **P9** La date du dernier changement est gardée, pas l'historique des choix.
- **P10** La première page est la première case cochée de la liste.
- **P11** Les quatre pastilles d'univers d'Ouvre ta ferme ne sont pas
  reproduites.
- **P12** Saison et parcelle dans l'adresse, gardées d'une page à l'autre.
- **P13** Les blocs gardent leur ordre d'aujourd'hui dans leur page.
- **P14** Les anciennes adresses des notifications conduisent à la bonne page.
- **P15** La limite journalière d'irrigation est rangée dans Arrosages, ce
  qu'elle bloque : une ferme qui arrose la voit toujours.
- **P16** La météo de référence (son lieu, « Actualiser la météo ») se lit
  dans Objectifs et besoins, à côté de la météo de la semaine, et se règle
  aussi dans Réglages, pour une ferme qui n'a pas coché cette case.
- **P17** « L'eau du jour » (l'eau engagée aujourd'hui, avec la limite
  journalière) suit les arrosages en cours, dans Arrosages.
- **P18** Un geste qui mène à une autre page (« Reposer » un matériel stocké,
  « Ajouter un créneau à la main » du planning, « Recalculer le plan » d'un
  arrosage en retard) ouvre cette page avec la demande dans l'adresse, lue une
  fois puis retirée : un rechargement ne la rejoue pas.
- **P19** Le titre de chaque page est le nom de sa case ; le choix de la
  parcelle se pose à côté de la saison, sur la page Matériel et placement, et
  le chemin « ferme › parcelle » reste au-dessus du plan.
- **P20** Une pluie, une limite ou un arrosage saisi sur une autre page fait
  recalculer le planning sur le serveur, comme avant ; ouvert pendant ce
  recalcul, le planning le relit de lui-même quand il est prêt.
- **P21** L'ancienne adresse d'une alerte météo (`#weather`) conduit d'abord
  à Objectifs et besoins, qui porte le tableau des jours, puis, sans cette
  case, à Alertes météo, qui garde l'historique des alertes.

Tranchées en codant le choix à l'écran (PR 3, 7 novembre 2026), sous le même
mandat :

- **P22** Dans Réglages, chaque case s'applique d'un geste et la page se
  recharge sur le nouveau choix (R8, R9) : cocher une case qui en entraîne
  d'autres demande d'abord une confirmation qui les nomme ; décocher une case
  qui a des données ouvre l'avertissement (R2) ; sinon rien ne s'interpose. À
  la première ouverture, rien ne s'enregistre avant « Continuer ».
- **P23** Sous chaque case, une ligne dit pourquoi elle reste cochée
  (« Nécessaire pour … ») ou ce que la cocher cochera avec elle.
- **P24** La correspondance des espèces arrive dans Réglages avec la liste
  « Espèces sans référence Kc » ; la page « Besoin par culture » y renvoie par
  un lien (P3).
- **P25** Les notifications du téléphone se règlent dans Réglages ; la page
  des arrosages garde aussi les siennes, près du minuteur.
- **P26** Les blocs d'une case décochée qui paraissent sur d'autres pages
  disparaissent avec elle (R1) : le choix de la pompe et la faisabilité
  hydraulique du formulaire des arrosages (case 5), l'objectif proposé des
  besoins, le besoin de la culture sur la fiche de la planche et sur celle de
  la série (case 7), les notes du sol des propositions du planning (case 6) ;
  une partie de case sans la case dont elle a besoin laisse sa ligne, avec un
  lien vers Réglages (P1).
- **P27** Le bandeau se ferme d'un geste ; faire son choix dans Réglages le
  ferme aussi. Le recalcul du planning après un changement des cases (R9, P8)
  vient avec la prise en compte dans les traitements (PR 4), quand le
  planning lit le choix.

Tranchées en codant la prise en compte dans les traitements (PR 4,
7 novembre 2026), sous le même mandat :

- **P28** Un changement des cases recalcule le plan de la semaine (R9, P8)
  quand le Planning est coché après lui et qu'il vient de l'être ou que
  Ressources et pompes a changé. Le recalcul se fait avant la réponse, pour
  que la page rechargée montre le plan à jour, et ne s'inscrit pas au
  registre des événements de la 3.7, dont la base ferme la liste (l'ouvrir
  demanderait de recréer une table, `docs/migrations-contract.md`, règle 3).
  Les notes du sol se lisent à l'ouverture de la page : cocher ou décocher la
  Réserve du sol les fait paraître ou disparaître sans recalcul.
- **P29** Décocher Arrosages retire du Worker de notification les alarmes
  encore à venir de la ferme (fin d'un minuteur, retard d'une irrigation
  planifiée) ; les irrigations restent telles quelles, et recocher ne les
  reprogramme pas (P5).
- **P30** Ressources et pompes décochée, une irrigation saisie ne reçoit plus
  la pompe par défaut de son matériel, et la faisabilité hydraulique ne
  bloque plus ni la saisie ni le démarrage ; une irrigation modifiée garde la
  pompe qu'elle avait.
- **P31** Les notifications donnent l'adresse de leur page à partir de la
  PR 5 : la PR 4 apprend d'abord au Worker de notification et au service
  worker des téléphones à ouvrir une page du module, pour qu'aucune
  notification ne soit refusée pendant le déploiement ; d'ici là, l'ancienne
  adresse conduit à la bonne page (P14).

Tranchées en codant l'aide et les adresses des notifications (PR 5,
7 novembre 2026), sous le même mandat :

- **P32** Chaque notification ouvre la page de la case qui l'envoie : la fin
  et le retard d'un arrosage, Arrosages, sur la carte de l'arrosage ; la
  notification du matin et les aspersions à reconsidérer, le Planning, sur la
  semaine visée ; une alerte météo, Alertes météo ; le gel et l'arrêt
  d'arrosage avant la récolte, Alertes cultures. Les liens de l'historique
  des alertes sont les mêmes. Une ancienne adresse reste conduite selon P14
  et P21.
- **P33** Le « ? » ouvre l'aide sous le titre, en trois parties (à quoi sert
  la page, comment la lire, par où commencer) ; elle se referme par le même
  bouton, par « Fermer » ou par la touche Échap, et rien n'est retenu d'une
  visite à l'autre. Les textes sont dans `lib/domain/features/help.ts`.
- **P34** La bulle « d'où vient ce chiffre » est un petit « i » à côté du
  chiffre ; elle s'ouvre et se ferme par ce bouton, par sa croix ou par la
  touche Échap. Sur ordinateur, elle se pose sous son bouton, dans la fenêtre
  (un tableau qui défile ne la coupe pas, la page ne déborde jamais) et le
  suit quand la page défile ; sur téléphone, elle se pose au-dessus de la
  bande de pages, sur toute la largeur. Son texte est écrit dans le domaine
  du calcul : dans le fichier du calcul, ou à côté quand il est plein
  (`lib/domain/planning/origins.ts`, `lib/domain/reservoir-origin.ts`),
  avec les arrondis de l'écran. Les chiffres de la section 6 la portent tous :
  le besoin réel d'une planche et la pluie réelle du jour ; la carte d'une
  proposition (durée, part de chaque planche, volume) et le manque d'une
  planche non placée ; le % du plein et le seuil d'une planche ; l'ETM du jour
  et l'objectif proposé ; le seuil de gel ; l'apport horaire d'une planche ;
  la durée d'un arrosage en préparation ; le débit en fonctionnement et le
  disponible après planification d'une réserve ; l'apport d'irrigation en mm
  de l'historique.
- **P35** Le troisième parcours nouveau (P24) ouvre le « ? » des onze pages
  et la bulle des deux pages où une ferme d'essai a son chiffre sans une
  semaine de météo ni de relevés (l'apport horaire d'une planche, la durée
  d'un arrosage) ; chaque autre bulle est prouvée par son test
  (`tests/figure-origin.test.ts`, un par bulle) et sera vue par le porteur en
  ligne.
- **P36** L'ordre de la liste, choisi par le porteur en ligne le 7 novembre
  2026 au soir (« il faut mettre l'arrosage tout en haut, parce que c'est le
  truc qui va être le plus utilisé ») : du geste de chaque jour à
  l'installation. Arrosages, Planning de la semaine, Objectifs et besoins,
  Réserve du sol, Besoin par culture, Matériel et placement, Ressources et
  pompes, Alertes météo, Alertes cultures, Historique et cumuls, puis
  Réglages. Le menu, la liste de Réglages et de la première ouverture suivent
  cet ordre ; « Irrigation » ouvre Arrosages pour une ferme qui a tout coché.
  Un choix déjà enregistré se relit sans changement : seules les cases
  comptent, il se relit dans l'ordre de la liste.

Les précisions P37 à P46 viennent de la même visite en ligne du porteur, le
7 novembre 2026 au soir ; elles sont toutes dans la PR de clôture.

- **P37** « Reposer » le matériel stocké n'est plus proposé dans le
  formulaire des arrosages (« il n'a rien à foutre ici ») : il se repose
  depuis sa carte, dans Matériel et placement, seul endroit où il est rangé.
  La règle 11 de `docs/equipment-placement-periods-contract.md` est amendée
  en ce sens ; l'adresse `?poser=` qui y menait est retirée.
- **P38** « Groupes de jardins alignés » a son « ? », à côté de son titre :
  à quoi sert un groupe, comment le module s'en sert, ce qu'il faut
  renseigner, quand s'en passer, et un schéma (deux jardins côte à côte, une
  aspersion au bout du premier qui arrose aussi la première planche du
  voisin), décrit pour un lecteur d'écran. Le même bouton sert à toute partie
  de page qui en a besoin (`app/irrigation/shell/section-help.tsx`).
- **P39** L'inventaire du matériel est compact (« beaucoup trop de blanc ») :
  une ligne par matériel, le placement et le nombre de réglages sur la même
  ligne, sur deux colonnes à partir de 1 280 px. Le menu « ⋯ » garde sa
  cible de 44 px.
- **P40** Le curseur de la réserve du sol n'a plus que les quatre crans de
  ses repères, sec 25 %, frais 50 %, humide 75 %, détrempé 100 %, au lieu de
  0 à 100 % (« on ne doit pas pouvoir bouger le curseur en dessous de 25 »).
  Cela change le point 6 de D-053 (`docs/soil-reserve-contract.md`) pour
  l'écran seulement : le serveur accepte toujours 0 à 100 %, et une
  observation plus ancienne entre deux crans se relit telle quelle.
- **P41** Les cultures de « Besoin par culture » et les espèces de Réglages
  portent le dessin de leur espèce, celui d'Ouvre ta ferme. Ouvre ta ferme
  range ses dessins dans un fichier public (`plants.svg`, un symbole par
  `fqn` d'espèce, 183 au 7 novembre 2026) ; le module ne le copie pas : sa
  route `/irrigation/especes.svg` le lit chez Ouvre ta ferme, gardé quinze
  jours au bord du réseau, et ne sert que les symboles demandés, et seulement
  s'ils ne portent que des formes (ni script, ni lien). Une culture de
  référence a son dessin par une table, une espèce par son nom ; sans dessin,
  rien ne s'affiche. C'est une exception voulue à la règle des icônes au
  trait de la charte du module : ce sont des illustrations d'espèces, pas des
  icônes d'interface.
- **P42** Le K_abri, dans « Réglages du calcul » de « Besoin par culture »,
  a son « ? » : ce qu'il fait, sa valeur par défaut (0,80 du CRIIAM), un
  exemple chiffré, quand le changer.
- **P43** Alertes météo dit que la prévision est prise à 2 m du sol, qu'au ras
  du sol il fait souvent 2 à 3 °C de moins et qu'aucune marge n'est ajoutée à
  son seuil, et renvoie au gel selon la culture d'Alertes cultures (un lien
  quand elle est cochée). Le « ? » de la page le dit aussi.
- **P44** Les deux marges de gel d'Alertes cultures se règlent par la ferme,
  dans les réglages de la page : 3 °C pour une culture sensible (dégâts à
  −2 °C ou au-dessus) et 2 °C pour une rustique par défaut, de 0 à 5 °C par
  pas de 0,5 °C (« s'il y a une marge, elle doit pouvoir être modifiée par
  l'utilisateur »). Elles s'ajoutent au curseur de microclimat, qui reste.
  Deux colonnes s'ajoutent aux révisions des réglages
  (`drizzle/0028_crop_alert_margins.sql`) ; les révisions déjà enregistrées
  prennent 3 et 2 °C. Comme le curseur, les marges n'entrent pas dans la clé
  d'une alerte : les changer ne renvoie pas un jour déjà alerté.
- **P45** « Alertes cultures envoyées » est un pli fermé, comme les autres
  parties de la page ; chaque pli porte une flèche vers le bas, vers le haut
  quand il est ouvert.
- **P46** Sur un écran d'au moins 1 360 px, la semaine du planning est un
  tableau : les jours en colonnes, une ligne par matériel proposé, chaque
  créneau compact (heure, dose, statut) dans la case de son jour ; un clic
  l'ouvre en carte entière par-dessus le tableau, avec sa justification et
  ses gestes, une carte ouverte à la fois. En dessous, sur un téléphone
  notamment, la semaine reste une liste de jours (« peut-être pas sur la
  version mobile »).

## 12. Hors de la 3.8

Le calculateur (3.8 bis), les créneaux protégés (3.8 ter), la 3.9, le pilotage
des électrovannes, les rôles et le masque par personne (Tranche 4), le thème
sombre, la démo guidée.

## Annexe A — Les douze réponses du porteur (7 novembre 2026)

| N° | Question | Réponse | Heure |
| --- | --- | --- | --- |
| préalable | Le choix des fonctionnalités remplace-t-il le mode simple ou complet ? | Oui : un seul mode, fonctionnalités à la carte, affichage et prise en compte | 12 h 24 |
| 1 | Que devient une fonctionnalité décochée ? | Ignorée, données gardées | 12 h 26 |
| 2 | La liste de 10 cases convient-elle ? | Oui, ces 10 cases | 12 h 29 |
| 3 | Une case cochée qui a besoin d'une autre ? | Cocher entraîne le nécessaire | 12 h 30 |
| 4 | Pour la ferme ou pour chaque personne ? | Pour toute la ferme | 12 h 31 |
| 5 | Quand et où choisit-on ? | À la première ouverture, puis Réglages | 12 h 32 |
| 6 | Comment ranger les écrans ? | Une page par case | 12 h 33 |
| 7 | Quelle aide contextuelle ? | Le « ? » et l'origine des chiffres | 12 h 34 |
| 8 | Quand corriger les trois petits défauts ? | Avant la 3.8, chacun sa PR | 12 h 37 |
| 9 | Les cartes « Annulée » du planning ? | Comme une refusée, pastille visible | 13 h 13 |
| 10 | Le champ « Millimètres » d'un jour mesuré ? | La mesure déjà saisie | 13 h 15 |
| 11 | Les autres pastilles pâles ? | Toutes pareilles | 13 h 15 |
| 12 | Où écrire ce contrat ? | Ici, en Opus 5.5 · Très élevé | 13 h 16 |

Les questions 8 à 11 portent sur les trois corrections faites avant la 3.8
(PR séparées) ; elles sont consignées ici pour mémoire.
