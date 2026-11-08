# Contrat des alertes météo par culture (gel, arrêt d'arrosage avant récolte, aspersions à reconsidérer)

Écrit le 6 novembre 2026 sur le « vas-y » du porteur ; suite de la 5 bis
(`docs/weather-alerts-contract.md`, D-050), proposée par la comparaison avec
Tlaloc (`comparaison-tlaloc.md`, idées A1 et A2) et placée par le porteur le
6 novembre 2026 après la 5 ter, avant la refonte ergonomique et la 3.8. Il
fixe les règles avant tout code. **Relu par le porteur le 6 novembre 2026** : questions 1 à 3 tranchées sur
cartes, les huit autres acceptées sur recommandation (« Part du principe que
je suis d'accord avec toutes tes recommandations »), plus le curseur de
microclimat ci-dessous. La décision sera inscrite
dans `docs/DECISIONS.md` par la PR de registres (D-058).

## Objet

Prévenir le maraîcher, par la notification déjà en place, de trois faits qui
dépendent de **ce qui pousse sur sa ferme** et de **ce qu'il a prévu d'arroser** :

1. **Gel** : la prévision descend assez bas pour abîmer une culture présente,
   avec le seuil de **cette culture** et non un seuil unique pour la ferme.
2. **Arrêt d'arrosage avant récolte (« séchage »)** : une culture qui doit
   cesser d'être arrosée quelques jours avant sa récolte (ail, courges, melon,
   pomme de terre) arrive à cette date.
3. **Aspersion à reconsidérer** : une aspersion prévue en journée sous abri
   tombe sous un ciel couvert ou par temps frais ; l'eau y sert peu et reste
   sur le feuillage (idée A7 de la comparaison avec Tlaloc, mise dans ce chantier
   par le porteur le 6 novembre 2026).

Comme pour la 5 bis, **l'alerte est une information** : elle ne change ni le
besoin, ni l'objectif, ni le planning, ni la dose, ni la 5 quater, ni la 5 ter
(D-010, D-028). Elle dit un fait prévu ; le maraîcher décide (voiler, bâcher,
couper l'eau). Le logiciel est **multi-fermes** : tout ce qui suit vaut pour
toute exploitation, sans rien de propre à la ferme du porteur dans le code ;
ce qui dépend d'une ferme (ses espèces, ses séries, ses seuils corrigés) est
une donnée de cette ferme.

## Décisions déjà prises par le porteur (6 novembre 2026)

- Les alertes de gel et de séchage se décident **selon les cultures**.
- **Les stades sont ignorés** : un seul seuil de gel par culture.
- Seuils de gel : `seuils-gel-legumes-etendus.md`, validés ; la prévision est
  donnée à 2 m du sol, donc **marge de 3 °C pour les cultures sensibles**
  (dégâts dès −2 °C ou plus haut) et **de 2 °C pour les rustiques** (dégâts
  plus bas que −2 °C).
- Mesclun comme la laitue, radis noir comme le radis rond, panais comme la
  carotte, artichaut à −2 °C.
- **La pluie prévue est comptée à 100 %** dans les calculs d'eau ; ces alertes
  n'y touchent pas.
- **Aspersions à reconsidérer** : dans ce chantier ; ciel couvert et temps frais
  d'abord ; **la partie « mildiou, le soir » est écartée** (les alertes maladies
  ne sont pas retenues pour l'instant).
- Ordre d'exécution : 5 quater, 5 ter, ces alertes, refonte ergonomique, 3.8,
  3.9.

## Vocabulaire

- **Culture présente** : une série suivie, semée ou plantée, qui n'a pas
  dépassé la dernière de ses semaines de récolte (D-057).
- **Seuil de dégâts** : la température prévue en dessous de laquelle la source
  situe les premiers dégâts de gel.
- **Marge** : l'écart entre la prévision à 2 m et le ras du sol.
- **Seuil d'alerte** : seuil de dégâts + marge. C'est lui qui déclenche.
- **Jour visé** : le jour dont la température minimale prévue franchit le seuil
  d'alerte (comme dans la 5 bis).
- **Délai de séchage** : le nombre de jours avant la récolte à partir duquel on
  cesse d'arroser.
- **Jeu commun** : les seuils et les délais livrés avec le logiciel, valables
  pour toute ferme, que chaque ferme peut corriger pour elle seule.

## Ce qui existe déjà et qu'on réutilise

- Les prévisions et les températures minimales prévues, conservées depuis la
  5 bis (`irrigation_weather_daily_values`, migration 0022), mises à jour par
  la synchronisation de 06 h 15 et par chaque actualisation.
- La route d'envoi immédiat du Worker Web Push et l'abonnement des appareils de
  l'exploitation ; l'enregistrement des alertes et leur résultat d'envoi.
- Les créneaux d'aspersion du planning (3.5, 3.7) avec leur jour, leur heure
  et leur planche ; le fait qu'une planche soit sous abri.
- Les séries, leurs espèces et leurs semaines de semis, de plantation et de
  récolte, **déjà lues et mises en cache** pour la 5 quater (D-054, D-057) ; la
  correspondance par espèce avec exception par série (`species.ts`).
- Le fait qu'une planche soit sous abri (5 quater, K_abri).

**Aucun appel nouveau vers Ouvre ta ferme** : l'évaluation lit les séries déjà
en base ou en cache. La règle des quatre requêtes par seconde au plus n'est
donc pas touchée. Aucun secret, aucune clé n'entre dans ce périmètre.

## Le gel par culture

### La règle

- Pour chaque **espèce** d'une culture présente, le seuil d'alerte vient du jeu
  commun (ci-dessous), ou de la valeur corrigée par la ferme.
- Une espèce a **un seul seuil**, quel que soit le stade (décision du porteur).
- La ferme peut **corriger le seuil de dégâts** d'une espèce, et d'une seule
  série (exception, comme l'ail sec et l'aillet pour la 5 quater) ; la marge
  se recalcule d'après la nouvelle valeur. Les corrections sont des révisions
  datées que la base refuse de modifier ou d'effacer (D-006).
- Une espèce **sans seuil** (liste plus bas) ne déclenche jamais rien et figure
  sur l'écran dans « Cultures sans seuil de gel », avec un champ pour que la
  ferme saisisse le sien. Une espèce nouvelle d'Ouvre ta ferme reste sans seuil
  tant qu'un rattachement n'est pas saisi : rien n'est deviné (D-003).

### Le curseur de microclimat (demande du porteur, 6 novembre 2026)

- Un réglage **global** de l'exploitation, un curseur unique : **décaler tous
  les seuils d'alerte de gel** d'un nombre de degrés, de −5 à +5 °C par pas de
  0,5 °C, 0 par défaut. **Relever** (par exemple +2) fait alerter plus tôt,
  pour un site froid ou exposé ; **abaisser** (par exemple −2) fait alerter plus
  tard, pour un site abrité. Chacun adapte ainsi les seuils à son microclimat.
- Il s'ajoute au seuil d'alerte de chaque espèce, **après** la marge et après
  une correction de la ferme : seuil appliqué = dégâts + marge + décalage.
  Il ne change ni la valeur des dégâts ni la marge, qui restent affichées
  séparément ; l'écran montre le seuil appliqué.
- Il ne vaut que pour le **gel**. Les seuils de l'aspersion (24 °C, 400 W/m²)
  ont leurs propres réglages ; le séchage n'en a pas besoin.
- Modifier le curseur est un réglage de l'exploitation daté (D-006) : les
  alertes déjà envoyées gardent le décalage d'origine, et les jours visés
  déjà alertés ne sont pas renvoyés, comme pour toute correction de seuil.

### L'évaluation

- Après chaque écriture réussie de prévisions, comme la 5 bis, sur la
  **température minimale prévue la plus récente** de chaque jour de l'horizon,
  aujourd'hui compris, jour civil de Paris (D-004).
- **Horizon** : de 1 à 7 jours, 3 par défaut, réglable pour l'exploitation.
- Il y a alerte quand la minimale prévue est **inférieure ou égale** au seuil
  d'alerte appliqué de l'espèce (avec le décalage du curseur). Contrairement à la 5 bis, le seuil n'est pas écrit par
  l'utilisateur mais calculé (« dégâts dès X, plus la marge ») : le « ou
  égale » reproduit la fiche validée (« alerte à +3 °C » alerte à +3 °C).
- Une température minimale absente ne déclenche **rien**, n'est jamais lue
  comme 0, et l'écran le dit (D-003). Une synchronisation en échec n'évalue
  rien.
- Le gel ne dépend ni de la pluie, ni de l'humidité, ni de la durée du gel, ni
  du vent : la température seule ne dit pas tout, l'écran le rappelle.

### Quelles cultures comptent

- Toute culture **présente**, y compris une série sans planche (« en bloc ») :
  une plante gèle où qu'elle soit.
- Une culture pas encore semée ou plantée, ou déjà terminée, ne compte pas.
- Une culture **sous abri** compte (question 4) : le texte dit que la
  prévision est celle de l'extérieur.

### Le jeu commun des seuils

Source : `seuils-gel-legumes-etendus.md` (fiche FRAB AuRA, ITAB, CA 82, GRAB et
références nord-américaines, valeurs à recontrôler à la source avant de coder).
« Dégâts dès » est la valeur retenue ; la marge est +3 °C si cette valeur est
−2 °C ou plus haut, +2 °C sinon.

| Culture (espèces d'OTF) | Dégâts dès | Marge | Alerte si la prévision est ≤ | Confiance |
| --- | --- | --- | --- | --- |
| Ail | −10 °C | +2 | **−8 °C** | bonne |
| Aubergine | 0 °C | +3 | **+3 °C** | bonne |
| Betterave rouge | −7 °C | +2 | **−5 °C** | bonne |
| Blette | −6 °C | +2 | **−4 °C** | bonne |
| Carotte | −6 °C | +2 | **−4 °C** | bonne |
| Céleri branche | −2 °C | +3 | **+1 °C** | moyenne |
| Céleri-rave | −2 °C | +3 | **+1 °C** | moyenne |
| Chou pommé (blanc, rouge, Milan, pointu) | −3 °C | +2 | **−1 °C** | choix du porteur, 6 nov. (le plus prudent) |
| Chou-fleur | 0 °C | +3 | **+3 °C** | choix du porteur, 6 nov. (le plus prudent) |
| Concombre | 0 °C | +3 | **+3 °C** | bonne |
| Courge, courgette | 0 °C | +3 | **+3 °C** | bonne |
| Épinard | −8 °C | +2 | **−6 °C** | bonne |
| Fenouil | −2 °C | +3 | **+1 °C** | moyenne |
| Haricot | 0 °C | +3 | **+3 °C** | bonne |
| Laitue, mesclun | −2 °C | +3 | **+1 °C** | choix du porteur, 6 nov. |
| Navet | −7 °C | +2 | **−5 °C** | bonne |
| Oignon jaune | −6 °C | +2 | **−4 °C** | bonne |
| Petit pois | −4 °C | +2 | **−2 °C** | bonne |
| Poireau | −8 °C | +2 | **−6 °C** | bonne |
| Poivron | 0 °C | +3 | **+3 °C** | bonne |
| Pomme de terre | 0 °C | +3 | **+3 °C** | choix du porteur, 6 nov. (le plus prudent) |
| Radis rond, radis botte, radis rave, radis noir | −4 °C | +2 | **−2 °C** | bonne |
| Tomate | 0 °C | +3 | **+3 °C** | bonne |
| Mâche | −5 °C | +2 | **−3 °C** | moyenne |
| Roquette | −4 °C | +2 | **−2 °C** | moyenne |
| Chicorée frisée, scarole | −4 °C | +2 | **−2 °C** | moyenne |
| Chicorée pain de sucre | −3 °C | +2 | **−1 °C** | moyenne |
| Radicchio | −4 °C | +2 | **−2 °C** | moyenne |
| Panais | −6 °C | +2 | **−4 °C** | décision François |
| Rutabaga | −9,5 °C | +2 | **−7,5 °C** | moyenne |
| Chou kale | −9,5 °C | +2 | **−7,5 °C** | moyenne |
| Chou de Bruxelles | −7 °C | +2 | **−5 °C** | moyenne |
| Brocoli | −2 °C | +3 | **+1 °C** | choix du porteur, 6 nov. (le plus prudent) |
| Chou-rave | −2 °C | +3 | **+1 °C** | choix du porteur, 6 nov. (le plus prudent) |
| Chou chinois, pë-tsaï | −4 °C | +2 | **−2 °C** | moyenne |
| Pak choï | 0 °C | +3 | **+3 °C** | faible |
| Moutarde, mizuna, légumes asiatiques | −4 °C | +2 | **−2 °C** | moyenne |
| Fève | −4 °C | +2 | **−2 °C** | moyenne |
| Oignon botte, aillet | −4 °C | +2 | **−2 °C** | moyenne |
| Persil | −7 °C | +2 | **−5 °C** | moyenne |
| Coriandre | −9,5 °C | +2 | **−7,5 °C** | moyenne |
| Aneth, cerfeuil | −4 °C | +2 | **−2 °C** | moyenne |
| Oseille | −9,5 °C | +2 | **−7,5 °C** | moyenne |
| Rhubarbe | −4 °C | +2 | **−2 °C** | moyenne |
| Basilic | +2 °C | +3 | **+5 °C** | moyenne |
| Maïs doux | 0 °C | +3 | **+3 °C** | bonne |
| Melon | 0 °C | +3 | **+3 °C** | bonne |
| Pastèque | 0 °C | +3 | **+3 °C** | moyenne |
| Patate douce | 0 °C | +3 | **+3 °C** | moyenne |
| Artichaut | −2 °C | +3 | **+1 °C** | faible, acceptée |
| Arroche (comme l'épinard) | −8 °C | +2 | **−6 °C** | analogie |
Cultures qui avaient plusieurs valeurs selon les sources, **réduites à la plus
prudente (la moins négative) sur le choix du porteur du 6 novembre 2026**
(question 2) : chou pommé −3 °C (les variétés rustiques vont à −8 °C) ;
chou-fleur 0 °C (la plante tient −3 °C, la pomme gèle dès 0 °C) ; pomme de
terre 0 °C (la fiche FRAB disait −5 °C, l'ITAB −2 °C) ; brocoli et chou-rave
−2 °C (les sources vont de −2 à −9,5 °C) ; laitue et mesclun −2 °C (question 1).
Courge et courgette sont à 0 °C ; l'aillet est rattaché à l'oignon botte comme
dans la 5 quater ; les radis rave et botte sont rattachés au radis rond,
l'arroche à l'épinard (analogies, dites à l'écran). La ferme peut corriger
chaque valeur pour elle seule.

### Les cultures sans seuil (aucune alerte de gel)

- **Fraisier** et **asperge** : aucune valeur trouvée (fleurs et jeunes
  turions sensibles).
- **Fleurs, aromatiques vivaces et divers** (achillée, cosmos, tournesol,
  zinnia, tulipe, menthe, verveine…), **engrais vert** : seuil sans source
  chiffrée.
- **Claytonia, cresson de terre, oseille à feuilles étroites** : seule source
  de seconde main, inutilisable.
- **Topinambour** : récolte en sol, pas d'alerte utile.

La ferme peut saisir un seuil pour chacune. Le logiciel n'invente rien
(question 3).

## L'arrêt d'arrosage avant récolte (« séchage »)

### La règle

- Le jeu commun donne un **délai de séchage** par espèce : ail 15 jours,
  pomme de terre 14 jours, courges 10 jours, melon 7 jours. Source : Tlaloc,
  non recoupée à ce jour : c'est une proposition à valider (question 7).
  Pas de délai pour les autres espèces, ni pour l'oignon en botte ni l'aillet,
  récoltés frais.
- La ferme peut corriger ou retirer le délai d'une espèce (révision datée).
- La date d'arrêt est **le premier jour de la première semaine de récolte
  encore attendue de la série, moins le délai** (question 8). Une série déjà
  récoltée, ou sans semaine de récolte, n'a pas d'alerte (D-003).
- L'alerte part **le jour de la date d'arrêt**, ou le premier jour où
  l'évaluation la voit si elle est déjà passée mais que la récolte n'a pas
  commencé ; une seule fois par série.
- C'est une **échéance du plan de culture**, pas une prévision météo : elle
  s'évalue chaque matin, après la synchronisation de 06 h 15, même si la météo
  est en panne. Le texte ne dit « prévu » que pour ce qui l'est : la date de
  récolte est celle d'Ouvre ta ferme.

### Ce qu'elle ne fait pas

- Elle ne met pas l'objectif de la planche à zéro et ne change pas la
  proposition de la 5 quater (dont le Kc baisse déjà à la fin du cycle de
  l'ail) : l'alerte dit « cessez d'arroser », le maraîcher l'applique. Si cela
  doit un jour passer par une révision d'objectif, ce sera un autre contrat.
- La pluie ne la déclenche pas, ne la retarde pas : la pluie prévue reste
  comptée à 100 % dans la jauge, sans lien avec cette alerte.

## Les aspersions à reconsidérer

### La règle

- Sont jugés les **créneaux d'aspersion** (matériel de nature aspersion) posés
  sur au moins une **planche sous abri**, qu'ils soient proposés, validés ou
  non encore réalisés, **dont l'heure de début tombe de jour** (entre le lever
  et le coucher du soleil du jour, calculés comme pour l'ET0). Un créneau de nuit
  n'est jamais jugé : sans soleil, « ciel couvert » n'aurait aucun sens, et la
  plage par défaut de l'aspersion est de nuit (R8, 21 h – 8 h).
- Le créneau est signalé quand, pour son jour, la prévision dit :
  - **temps frais** : la température maximale prévue est **inférieure** à
    24 °C ; **ou**
  - **ciel couvert** : le rayonnement moyen du jour est **inférieur** à
    400 W/m². La prévision donne l'énergie solaire du jour en MJ/m² ; le
    rayonnement moyen est cette énergie divisée par la durée du jour (en
    secondes). Aucun seuil en MJ/m² n'est inventé.
- Les deux seuils (24 °C, 400 W/m²) sont les valeurs de Tlaloc, **réglables
  pour l'exploitation**. Source : Tlaloc seul, non recoupée ; à valider
  (question 10).
- Une valeur prévue absente (température maximale ou énergie solaire) ne
  déclenche rien et le dit (D-003). Une seule des deux suffit à signaler ; si
  l'une manque et que l'autre ne franchit pas son seuil, on ne dit rien.
- L'évaluation a lieu après chaque écriture de prévisions et après chaque
  changement du planning (proposition validée, créneau déplacé).

### Ce que dit l'alerte, et ce qu'elle ne fait pas

- Texte : « Aspersion à reconsidérer : jeudi 12 novembre 10 h, planche 4
  (sous abri). Maximale prévue 18 °C (seuil : sous 24 °C), ciel couvert prévu
  (rayonnement moyen 220 W/m², seuil : sous 400). » Le mot **prévu** figure
  toujours.
- Le clic ouvre le planning du jour concerné, où le maraîcher peut déjà
  **réduire** ou **annuler** un arrosage (3.7). Le logiciel ne le fait jamais
  seul : le besoin, l'objectif, la dose et la jauge ne changent pas (D-010,
  D-028).
- Elle ne dit pas qu'arroser est une erreur : l'aspersion sert aussi à
  d'autres fins qu'à rafraîchir ; la décision reste au maraîcher.
- Une seule alerte par **créneau et par version de la prévision franchie**,
  c'est-à-dire par (créneau, jour) tant que le créneau n'est pas modifié ;
  plusieurs créneaux le même jour partent dans une seule notification.
- La partie « le soir, sur une parcelle à risque de mildiou » n'existe pas
  ici : aucune alerte de maladie.

## La répétition et le regroupement

- **Gel** : une seule alerte par **espèce et par jour visé** (clé unique),
  tant que la correction du seuil de la ferme ne change pas. Une prévision qui
  remonte puis redescend ne renvoie rien pour ce jour.
- Toutes les espèces concernées par **la même évaluation** partent dans **une
  seule notification** : « Gel prévu mercredi 12 novembre : 1 °C. Tomate,
  courgette, haricot (3 cultures présentes) », avec au plus cinq noms et
  « et N autres » au-delà. Une évaluation ultérieure n'envoie que les espèces
  **nouvellement** concernées pour un jour déjà alerté (la prévision a baissé).
- Plusieurs jours visés dans la même évaluation : une notification par jour
  visé, au plus trois, puis une dernière qui résume le reste.
- **Séchage** : une alerte par série ; les séries échues le même matin partent
  ensemble : « Cessez d'arroser avant la récolte : ail, planches 12 et 14 ;
  récolte attendue à partir du lundi 20 juillet. »
- Corriger un seuil de la ferme remet à zéro les jours visés de cette espèce.

## L'alerte enregistrée et la notification

- Chaque alerte est enregistrée et ne change plus : exploitation, nature (gel
  ou séchage), espèce ou série, valeur du seuil de dégâts et marge appliquées
  telles qu'à l'envoi, jour visé, valeur prévue avec son unité, date de la
  prévision utilisée, heure d'envoi, résultat d'envoi (mêmes quatre états que
  la 5 bis).
- Titre : « Alerte gel » ou « Alerte récolte » ; le clic ouvre la météo de la
  semaine du jour visé (gel) ou la fiche de la série (séchage), sous
  `/irrigation`.
- Le mot **prévu** figure dans toute alerte de gel ; une alerte ne parle
  jamais d'une observation.
- Une panne du service de notification n'arrête ni la synchronisation ni
  l'enregistrement.

## Les données

Migration additive (D-018), tables propres à ce contrat, rien ne change dans
celles de la 5 bis :

- **Jeu commun** des seuils de gel et des délais de séchage, avec source,
  date du relevé et confiance, relu chiffre pour chiffre contre ce contrat par
  un test.
- **Corrections de la ferme** : seuil de dégâts par espèce, avec exception par
  série, délai de séchage par espèce ; révisions datées, non modifiables.
- **Réglages de l'exploitation** : alertes de gel, de séchage et d'aspersion
  actives ou non, horizon, décalage des seuils de gel, seuils de l'aspersion (24 °C,
  400 W/m²).
- **Énergie solaire prévue du jour**, aujourd'hui non conservée (seules la
  pluie, l'ET0 et les températures le sont) : une colonne ajoutée à la
  même migration, `NULL` quand elle manque.
- **Alertes enregistrées** avec leurs clés uniques ((exploitation, espèce, jour
  visé) pour le gel ; (exploitation, série) pour le séchage ; (exploitation, créneau, jour) pour
l'aspersion).

Toutes les lectures et écritures sont **isolées par exploitation**.

## L'écran

Un encart « Alertes cultures » près de l'encart « Alertes météo » de la 5 bis :

- les réglages de l'exploitation (activer, horizon, **curseur de décalage des
  seuils de gel**) ;
- la table des seuils de gel de **ses** cultures présentes : espèce, seuil de
  dégâts, marge, seuil d'alerte, source, confiance, et « corriger » ;
- la liste « Cultures sans seuil de gel » ;
- les délais de séchage et leur correction ;
- les seuils des aspersions à reconsidérer (24 °C, 400 W/m²) ;
- les prochaines échéances : cultures qui seraient alertées si la prévision
  actuelle se confirme, et dates d'arrêt d'arrosage à venir ;
- l'historique des alertes, plus récente en premier.

Le rappel que ces seuils sont des repères, que la prévision est à 2 m et que
sous abri la température réelle diffère. La refonte ergonomique et la 3.8
pourront déplacer l'encart.

## Hors périmètre

- Alertes de maladies (mildiou, oïdium, acariens, mildiou du soir après une
  aspersion), de jeune pousse, de chaleur par culture.
- Une prévision **horaire** : le jugement des aspersions se fait au jour
  (question 11).
- Le seuil selon le stade, les variétés, la durée du gel, l'humidité ou le
  vent.
- Une prévision à la parcelle, une température propre à un abri.
- Toute action automatique, tout changement d'objectif ou de planning.
- Les alertes par courriel ou SMS.

## Découpage et preuve de fin

Trois PR, tests d'abord, Opus 5.5 · Élevé (ligne à inscrire à la roadmap ;
travail délimité sous contrat, tests et CI tranchent, les seuils étant ceux du
porteur) :

1. **Domaine** (`lib/domain/crop-alerts/`) : seuil d'alerte et marge, présence
   d'une culture, évaluation du gel, date d'arrêt du séchage, répétition,
   regroupement, textes. Scénarios 1 à 12 et 14 à 20 en tests.
2. **Persistance et envoi** : migration, jeu commun relu contre le contrat,
   corrections par révisions, évaluation branchée après chaque écriture de
   prévisions et chaque matin pour le séchage, envoi par la route existante,
   isolation entre exploitations (scénario 13).
3. **Écran** : l'encart, ses refus, un parcours navigateur aux deux largeurs.

Recette réelle sur la ferme, sur le « vas-y » du porteur : un seuil corrigé
pour être franchi par la prévision du jour, l'alerte reçue sur le téléphone
verrouillé, le clic qui ouvre la bonne semaine, aucune seconde alerte à
l'actualisation suivante ; un séchage d'essai sur une série d'ail. Comme pour
la 5 bis, la réception sur téléphone verrouillé est une vérification manuelle.

### Scénarios chiffrés

Le lundi 9 novembre 2026, horizon 3 jours, cultures présentes : tomate (alerte
à +3 °C), carotte (−4 °C), poireau (−6 °C).

1. Minimales lundi 6, mardi 2, mercredi 5 : une alerte, jour visé mardi,
   tomate (2 ≤ 3) ; ni carotte ni poireau.
2. Mardi exactement 3 °C : alerte tomate (≤).
3. Mardi −4 °C : alerte tomate et carotte, pas poireau ; une seule
   notification qui nomme les deux.
4. Mardi absente : aucune alerte, l'écran dit « prévision indisponible ».
5. Lundi 06 h 15 mardi 2 °C : alerte. Lundi 14 h, actualisation, mardi
   1 °C : rien de nouveau ; si la carotte passe aussi sous −4 °C, seule la
   carotte est annoncée.
6. Série de tomate terminée la semaine passée ou pas encore plantée : aucune
   alerte pour elle.
7. Série en bloc (sans planche) de carotte : alertée comme les autres.
8. Fraisier présent : aucune alerte, il figure dans « Cultures sans seuil ».
9. La ferme corrige la tomate à +2 °C de dégâts : le seuil d'alerte devient
   +5 °C ; l'alerte déjà envoyée garde ses valeurs d'origine.
10. Laitue et mesclun présents : un seul seuil (−2 °C, alerte à +1 °C),
    aucun stade lu.
11. Ail sec, récolte attendue à partir du lundi 20 juillet 2027, délai 15 j :
    alerte le lundi 5 juillet ; pas de seconde alerte les jours suivants.
12. Ail récolté (ou sans semaine de récolte), oignon en botte, aillet : aucune
    alerte de séchage.
20. Décalage +2 °C : la tomate (alerte à +3 °C) alerte dès une minimale de
    5 °C ; décalage −2 °C : seulement à 1 °C. Le seuil de dégâts et la marge
    affichés ne changent pas.
13. Tomate de l'exploitation A sous le seuil : aucun appareil de B ne reçoit
    rien, aucune correction de A ne se lit chez B.
14. Aspersion de 10 h sous abri, maximale prévue 18 °C, rayonnement 500 W/m² :
    signalée (temps frais).
15. Même créneau, maximale 26 °C, rayonnement moyen 300 W/m² : signalée (ciel
    couvert).
16. Maximale 26 °C, rayonnement 450 W/m² : rien.
17. Aspersion à 23 h, maximale 15 °C : jamais jugée (de nuit).
18. Aspersion sur une planche de plein champ, ou goutte-à-goutte sous abri :
    jamais jugée.
19. Énergie solaire prévue absente, maximale 26 °C : rien ; l'écran dit
    « ensoleillement non prévu ».

## La place dans les registres

La roadmap inscrit ces alertes en 21 de l'ordre d'exécution (« 5 quinquies »),
après la 5 quater et la 5 ter, avant la refonte ergonomique (application de la
charte du module), la 3.8, la 3.9 et la tranche 4, avec leur ligne
« Modèle · effort » ; la décision est D-058.

## Réponses du porteur (6 novembre 2026)

Onze questions, posées une par une ; dès la quatrième, le porteur a écrit :
« Part du principe que je suis d'accord avec toutes tes recommandations ».

1. Laitue et mesclun : **−2 °C** (alerte à +1 °C), contre la recommandation
   (−4 °C), sur carte.
2. Cultures à plusieurs valeurs : **la plus prudente**, contre la
   recommandation, sur carte (chou pommé −3, chou-fleur 0, pomme de terre 0,
   brocoli et chou-rave −2).
3. Cultures sans seuil : aucune alerte, liste et saisie par la ferme, sur carte.
4. Cultures sous abri : alertées comme le plein champ, avec rappel que la
   prévision est extérieure, sur recommandation.
5. Séries qui comptent : toutes les séries présentes, y compris « en bloc »,
   sur recommandation.
6. Regroupement : une notification par jour visé, au plus cinq noms, sur
   recommandation.
7. Séchage : ail 15 j, pomme de terre 14 j, courges 10 j, melon 7 j, sur
   recommandation (relecture des sources avant le code, modifiables par la
   ferme).
8. Séchage : premier jour de la première semaine de récolte attendue moins le
   délai, sur recommandation.
9. Aspersions : créneaux de jour sous abri seulement, sur recommandation.
10. Aspersions : 24 °C et 400 W/m² réglables, un seul suffit, sur
    recommandation.
11. Aspersions : jugement au jour, sur recommandation.

**Ajout du porteur** : le curseur de microclimat (section « Le gel par
culture »).

## Précisions faites en codant le domaine (6 novembre 2026, D-060)

Le domaine est codé le 6 novembre 2026 (`lib/domain/crop-alerts/`), en
Opus 5.5, sur le mandat du porteur de réaliser seul la 5 quinquies en
choisissant l'option recommandée à chaque question (D-060). Points tranchés
par l'assistant, sur son option recommandée :

1. **Le rattachement** : chaque espèce d'Ouvre ta ferme se rattache à une
   entrée du jeu commun, par espèce avec exception par série, « par le même
   principe que la 5 quater » (fiche des seuils). La même révision datée
   porte le seuil de dégâts propre à la ferme quand elle corrige ; une
   révision sans entrée ni seuil dit « sans seuil ». Sans révision, l'espèce
   est « à rattacher » et figure dans « Cultures sans seuil de gel » (D-003).
   Le délai de séchage vient de l'entrée rattachée, sauf correction de la
   ferme pour l'espèce, qui peut aussi le retirer.
2. **La répétition** : la clé d'une alerte de gel est le sujet (l'espèce,
   ou l'exception d'une série), la révision qui donne son seuil et le jour
   visé. Une correction est une révision nouvelle : les jours visés de
   l'espèce repartent de zéro. Le curseur de microclimat n'entre pas dans la
   clé : le déplacer ne renvoie pas un jour déjà alerté.
3. **La présence se lit au jour visé** : du lundi de la semaine
   d'implantation, réalisée sinon prévue, au dimanche de la dernière semaine
   de récolte, réalisée sinon attendue ; sans fin connue, la culture court ;
   sans implantation, elle ne compte pas. Une série en bloc compte. Une
   culture plantée plus tard dans la semaine du gel compte donc déjà.
4. **Les textes du gel** : « Gel prévu mardi 10 novembre : 2 °C. Tomate
   (1 culture présente). » Les noms sont ceux des espèces d'Ouvre ta ferme,
   suivis de la série pour une exception (« Tomate (série X) »). Quand l'une
   des séries présentes ce jour-là est sous abri, la notification ajoute :
   « Sous abri, la température diffère : la prévision est celle de
   l'extérieur. » Au-delà de trois jours visés, la dernière dit « Gel prévu
   aussi … (−3 °C) …, pour N cultures présentes. »
5. **La semaine de récolte encore attendue** est la plus précoce des
   semaines attendues dont le dimanche n'est pas passé ; une semaine de
   récolte réalisée dit que la récolte a commencé : plus d'alerte. Une série
   qui porte plusieurs cultures à délai garde la date d'arrêt la plus proche.
   Les séries échues se regroupent par espèce et par jour de récolte ; une
   série en bloc se nomme « série X en bloc ». Le clic ouvre la page de la
   saison sur « Cumuls et historique », avec la série en paramètre.
6. **Le scénario 11** date mal ses jours : en 2027, le 20 juillet est un
   mardi. Le test le joue en 2026 : récolte attendue à partir du lundi
   20 juillet 2026, délai 15 jours, alerte le **dimanche** 5 juillet 2026.
7. **Le jour des aspersions** se calcule comme pour l'ET0 (FAO-56,
   équations 24, 25, 32 et 34) : la durée du jour par l'angle horaire du
   coucher, l'heure de midi solaire par la longitude et l'équation du temps.
   Sans la réfraction, le jour est raccourci de quelques minutes (à Lyon le
   12 novembre : lever à 7 h 45 au lieu de 7 h 38). Un créneau qui commence
   à l'heure du coucher n'est pas jugé. Titre : « Alerte aspersion » ; le clic
   ouvre le planning de la semaine. La clé d'un créneau est donnée par le
   service : le créneau et son heure, pour qu'un créneau déplacé soit jugé à
   nouveau.
8. **Les réglages par défaut** : les trois alertes actives (rien ne part
   sans espèce rattachée, ni sans aspersion de jour sous abri), horizon
   3 jours, curseur à 0, 24 °C et 400 W/m². Bornes : horizon de 1 à 7 jours ;
   curseur de −5 à +5 °C par pas de 0,5 ; maximale de l'aspersion de 0 à
   40 °C par pas de 0,5 ; rayonnement entier de 50 à 1 000 W/m² ; seuil de
   dégâts de la ferme de −30 à +10 °C par pas de 0,5 ; délai de séchage
   entier de 1 à 60 jours, vide pour le retirer.

Ne changent pas : D-003, D-006, D-010, D-028, D-050, D-058.

## Précisions faites en codant la persistance et l'envoi (6 novembre 2026, D-060)

La persistance et l'envoi sont codés le 6 novembre 2026 (migration additive
0026, `db/crop-alerts/`, `lib/services/crop-alerts-service.ts`), en Opus 5.5,
sur le même mandat. Points tranchés par l'assistant, sur son option
recommandée :

1. **Cinq tables et une colonne** : le jeu commun, les rattachements de la
   ferme (avec son seuil de dégâts), ses délais de séchage, ses réglages, les
   alertes enregistrées ; l'énergie solaire prévue du jour à côté des
   températures. Les trois tables de la ferme sont des révisions que la base
   refuse de modifier ou d'effacer (D-006) ; le jeu commun appartient aux
   migrations et se réécrit à l'import d'un export.
2. **Le jeu commun** reprend le tableau du contrat, relu par un test ligne
   par ligne. La ligne « Courge, courgette » devient deux entrées au même
   seuil, pour que seul le délai de séchage de la courge (10 jours) vaille :
   une courgette se récolte fraîche. Six entrées sans seuil (fraisier,
   asperge, topinambour, claytonia, cresson de terre, oseille à feuilles
   étroites) ; les fleurs, les aromatiques vivaces et l'engrais vert se
   disent « sans seuil » par une révision sans entrée ni valeur.
3. **Une seule table d'alertes** pour les trois natures, avec deux clés
   uniques : (nature, sujet, version, jour visé) pour le gel et l'aspersion,
   (série) pour le séchage. L'alerte garde les valeurs appliquées et le texte
   de la notification qui l'a annoncée ; pour une aspersion, la valeur
   prévue est la maximale quand il fait frais, sinon le rayonnement moyen.
4. **Aucun appel nouveau vers Ouvre ta ferme** : les séries, les planches et
   les abris sont lus dans le dernier instantané en cache, quel que soit son
   âge ; sans cache, rien n'est évalué.
5. **Quand l'évaluation tourne** : le gel et les aspersions après chaque
   écriture de prévisions (synchronisation du matin et actualisation), après
   les alertes de la 5 bis ; les aspersions aussi après chaque plan
   recalculé à la suite d'un événement (proposition validée, irrigation
   déplacée) ; le séchage chaque matin après la synchronisation, même si la
   météo est en panne, sauf quand une autre synchronisation tourne déjà.
6. **Les créneaux jugés** sont les propositions d'aspersion du plan de la
   semaine en cours qui ne sont pas encore commencées, encore proposées ou
   validées avec une irrigation encore planifiée ; leur clé est la
   proposition et son heure. Le lever et le coucher du soleil se calculent à
   la position du lieu météo de l'exploitation ; après un changement du
   planning, celui dont la prévision a été lue le plus récemment.
7. **Une notification par jour visé** (au plus trois pour le gel, puis une
   qui résume le reste), une pour toutes les séries échues le même matin ;
   son résultat s'écrit sur les alertes des jours qu'elle annonce.
8. **L'énergie solaire** est le champ `solarenergy` de Visual Crossing, en
   MJ/m², déjà lu pour l'ET0 ; la météo de démonstration en donne un motif.

Ne changent pas : D-003, D-006, D-010, D-018, D-028, D-050, D-058.

## Précisions faites en codant l'écran (6 novembre 2026, D-060)

L'écran est codé le 6 novembre 2026 (`app/irrigation/crop-alerts-panel.tsx`,
`lib/domain/crop-alerts/view.ts`, `lib/services/crop-alerts-view.ts`), en
Opus 5.5, sur le même mandat. Points tranchés par l'assistant, sur son option
recommandée :

1. **La place** : l'encart « Alertes cultures » suit l'encart « Alertes
   météo », sous le tableau de la météo de la semaine, et se lit avec lui.
   Les réglages, les seuils de gel, les cultures sans seuil et les délais de
   séchage sont dans des plis fermés ; les prochaines échéances et
   l'historique restent ouverts.
2. **Les cultures présentes** de la table sont celles de la saison affichée
   présentes aujourd'hui ou à venir : semées ou plantées, réalisé ou prévu,
   sans être passées leur dernière semaine de récolte. Une culture finie n'y
   figure plus ; une culture à venir est dite « À venir cette saison ».
3. **La table est une liste**, une culture par ligne, pour tenir au
   téléphone : le seuil d'alerte en titre, puis les dégâts, la marge et le
   curseur ; « Jeu commun » avec l'entrée, sa confiance et sa source, ou
   « Seuil de la ferme » avec la valeur du jeu commun rappelée à côté.
4. **Rattacher et corriger** se font dans le même formulaire : une entrée du
   jeu commun ou aucune, un seuil de dégâts propre facultatif ; « Pour : toute
   l'espèce ou une série seulement » n'est offert que quand l'espèce a
   plusieurs séries présentes ou à venir, ou pour une exception déjà saisie.
   Pour une espèce à rattacher, le formulaire propose l'entrée du même nom,
   aux accents et majuscules près ; rien ne s'enregistre sans la ferme. Ni
   entrée ni seuil : « sans seuil ». Le serveur refuse une espèce ou une
   série absente du plan de culture lu.
5. **Les délais de séchage** listent les espèces de la saison qui en ont un,
   du jeu commun ou de la ferme, et celles dont la ferme l'a retiré ; un
   formulaire en donne un à une espèce qui n'en a pas.
6. **Les prochaines échéances** se calculent à chaque affichage sur les
   prévisions déjà conservées, sans rien envoyer : les jours de gel de
   l'horizon avec les cultures qui seraient alertées (seuil, « sous abri »,
   « déjà annoncée ») et « Prévision indisponible pour … » ; les dates
   d'arrêt d'arrosage à venir, et « Arrêt dès maintenant » pour une date
   venue que le matin n'a pas encore annoncée ; les aspersions de la semaine
   (temps frais, ciel couvert, « déjà annoncée »), « Ensoleillement non prévu
   le … : seule la maximale y est jugée », et un message quand le lieu météo
   n'est pas localisé.
7. **Un réglage ou une correction vaut à la prochaine prévision lue** (la
   synchronisation de 06 h 15 ou « Actualiser la météo »), comme un critère
   de la 5 bis ; l'écran le dit. Le curseur de microclimat est une glissière
   de −5 à +5 °C par pas de 0,5 °C, qui affiche sa valeur et dit si les
   alertes partent plus tôt ou plus tard.
8. **L'historique** montre les vingt alertes les plus récentes : la nature et
   le nom, les valeurs appliquées à l'envoi (pour le gel, la minimale prévue,
   le seuil d'alerte, les dégâts, la marge et le curseur ; pour le séchage, la
   date d'arrêt et le délai ; pour une aspersion, la maximale ou le
   rayonnement), le texte de la notification, l'heure d'envoi et son
   résultat, et « Voir », le même lien que le clic sur la notification.

Ne changent pas : D-003, D-006, D-010, D-028, D-050, D-058.

## Précisions faites à la recette réelle (6 novembre 2026, D-060)

La recette réelle commence le 6 novembre 2026 sur le « vas-y » du porteur.
Ses 24 légumes sont rattachés au jeu commun sur sa réponse ; la vraie alerte
de gel du dimanche 8 novembre (1,9 °C, patate douce et tomate sous abri)
est produite par « Actualiser la météo », mais le service d'envoi la refuse
et elle reste « Échec du service de notification ». Points tranchés par
l'assistant, sur son option recommandée :

1. **L'étiquette d'une notification** ne prend que les caractères admis par
   le service d'envoi (lettres, chiffres, « . », « _ », « : », « - ») : le
   préfixe et le jour, puis une empreinte stable des sujets annoncés
   (`crop-frost:2026-11-08:1a2b3c4d`), au lieu de leur liste séparée par des
   virgules. Deux listes différentes gardent deux étiquettes.
2. **Le texte tient dans 160 caractères**, la limite du service. Pour le gel,
   la note d'abri devient « Sous abri, la température diffère. », puis
   s'efface devant les noms des cultures ; pour une aspersion, les seuils
   rappelés entre parenthèses tombent (« Maximale prévue 18 °C, ciel couvert
   prévu (rayonnement moyen 220 W/m²). ») ; sinon le texte se coupe au
   dernier mot, suivi de « … ». L'historique garde le texte envoyé et,
   à côté, toutes les valeurs appliquées.
3. **Une alerte déjà enregistrée en échec n'est pas renvoyée** : comme pour
   la 5 bis, un jour visé ne s'annonce qu'une fois pour une version du
   seuil ; une nouvelle révision de la culture le remet à zéro.
4. **L'alerte part en priorité haute** : envoyée à 23 h 56, elle n'est
   apparue sur son téléphone qu'au déverrouillage. Toutes les notifications
   du module partent désormais en priorité haute
   (`docs/push-worker-contract.md`, « Priorité et toucher »).
5. **Le toucher ouvre la météo de la semaine** : il n'ouvrait rien, le
   module attendant le chargement de la page avant de passer au premier
   plan. Il passe désormais au premier plan d'abord (même section).

Ne changent pas : D-003, D-006, D-010, D-028, D-050, D-058.

## Retours de visite du porteur, 7 novembre 2026 (3.8, P44 et P45)

1. **Les deux marges de gel se règlent par la ferme** (« s'il y a une marge,
   elle doit pouvoir être modifiée par l'utilisateur ») : dans les réglages
   de la page, « Marges de gel », une pour les cultures sensibles (dégâts dès
   −2 °C ou plus haut), 3 °C par défaut, une pour les rustiques, 2 °C par
   défaut, de 0 à 5 °C par pas de 0,5 °C. La règle devient : seuil appliqué
   = dégâts + marge de la ferme + décalage du curseur de microclimat, qui
   reste. Le jeu commun garde sa colonne « Marge » de 3 et 2 °C : ce sont les
   valeurs par défaut.
2. **Données** : deux colonnes ajoutées aux révisions des réglages de
   l'exploitation (`drizzle/0028_crop_alert_margins.sql`, D-018),
   `frost_margin_sensitive_celsius` et `frost_margin_hardy_celsius`, 3 et
   2 °C par défaut pour les révisions déjà enregistrées, bornées et au pas de
   0,5 °C par la base comme par le serveur.
3. **Comme le curseur, les marges n'entrent pas dans la clé d'une alerte** :
   les changer ne renvoie pas un jour visé déjà alerté ; l'alerte enregistrée
   garde la marge appliquée à l'envoi.
4. **« Alertes cultures envoyées » est replié** au chargement (« pas la peine
   de tout ouvrir, ça pollue pour rien ») : un pli comme les autres parties de
   la page, avec le nombre d'alertes, qui s'ouvre par une flèche vers le bas,
   tournée vers le haut quand il est ouvert.

Ne changent pas : D-003, D-006, D-010, D-028, D-050, D-058.
