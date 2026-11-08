# Contrat des alertes météo paramétrables

Écrit le 30 octobre 2026 sur le « vas-y » du porteur ; extension 5 bis de
`ROADMAP.md`. Il fixe les règles avant tout code. Relu par le porteur le
30 octobre 2026 au soir : il a accepté toutes les recommandations des questions
de la fin et les choix faits en l'écrivant (« D'accord pour tout ») :
décision D-050.

## Objet

Prévenir le maraîcher, par une notification sur son téléphone ou son
ordinateur, quand la prévision météo franchit un seuil qu'il a choisi. Demande
du porteur, le 9 octobre 2026 : « paramétrer des alertes météo en fonction de
critères renseignés par l'utilisateur ; par exemple, envoyer une notification
si la température minimale descend en dessous de 5 °C ».

L'alerte est une **information**. Elle ne change ni le besoin, ni l'objectif,
ni le planning, ni la dose (D-010, D-028) : elle dit un fait prévu,
l'utilisateur décide (bâcher, voiler, ouvrir les abris, arroser ou non).

## Vocabulaire

- **Critère** : la règle que l'utilisateur écrit, par exemple « température
  minimale en dessous de 5 °C dans les 3 prochains jours ».
- **Champ** : la grandeur météo que surveille le critère.
- **Sens** : « en dessous de » ou « au-dessus de ».
- **Seuil** : la valeur de comparaison, toujours avec son unité affichée.
- **Horizon** : le nombre de jours surveillés, aujourd'hui compris.
- **Jour visé** : le jour pour lequel la prévision franchit le seuil.
- **Alerte** : la notification envoyée pour un critère et un jour visé, et son
  enregistrement.

## Ce qui existe déjà

- La synchronisation météo quotidienne de 06 h 15, heure de Paris
  (`docs/weather-scheduler-contract.md`), et le bouton « Actualiser la météo »
  lisent chez Visual Crossing, pour chaque jour de J0 à J+14, la pluie, les
  températures moyenne, minimale et maximale, le point de rosée, le vent moyen
  et l'énergie solaire (`docs/weather-contract.md`,
  `lib/adapters/weather/visual-crossing-provider.ts`).
- Seules la pluie et l'ET0 sont conservées en base
  (`irrigation_weather_daily_values`) : **les températures et le vent ne sont
  pas persistés aujourd'hui**.
- Les rafales de vent, le gel au sol et l'humidité ne sont pas demandés au
  fournisseur.
- Le Worker Web Push (`docs/push-worker-contract.md`) délivre des
  notifications aux appareils abonnés d'une exploitation (la clé de
  destinataire est l'exploitation). Il ne sait aujourd'hui que **programmer
  une alarme** de fin de minuteur ; il n'a pas de route d'envoi immédiat. Un
  clic n'ouvre qu'une adresse sous `/irrigation`.
- L'abonnement d'un appareil se fait par le bouton « Activer » de l'encart
  « Recevoir une alerte à la fin du minuteur ».

## Le critère

| Champ du critère | Règle |
| --- | --- |
| Champ météo | un champ de la liste offerte (voir « Les champs offerts ») |
| Sens | « en dessous de » ou « au-dessus de » |
| Seuil | un nombre, dans l'unité du champ, affichée à côté (°C, mm) |
| Horizon | un nombre entier de jours, de 1 à 7 ; 1 = aujourd'hui seul |
| Actif | oui ou non ; un critère inactif n'est jamais évalué |
| Libellé | facultatif, texte libre court repris dans la notification |

- Un critère appartient à une **exploitation** ; il ne se voit pas d'une autre
  exploitation. Tous les appareils abonnés de l'exploitation reçoivent ses
  alertes.
- Un critère ne porte pas sur une parcelle, un jardin ou un abri : la
  prévision est celle de la commune de l'exploitation. L'écran le rappelle :
  sous abri, la température réelle diffère de la prévision.
- Un seuil absent, non numérique ou hors des bornes du champ est refusé avec
  un message qui dit pourquoi.
- Modifier un critère en fait une nouvelle version ; les alertes déjà envoyées
  gardent le critère tel qu'il était à leur envoi (D-006). L'activer ou le
  désactiver ne le modifie pas : ses jours déjà alertés le restent (choix fait
  en codant, le 31 octobre 2026).
- Supprimer un critère l'arrête ; ses alertes passées restent dans
  l'historique.

## Les champs offerts

Au départ, seulement des champs **déjà lus** chez le fournisseur, pour ne pas
ajouter d'appel ni de coût :

| Champ | Unité | Sens utiles | Bornes du seuil |
| --- | --- | --- | --- |
| Température minimale du jour | °C | en dessous (gel), au-dessus | −30 à 50 |
| Température maximale du jour | °C | au-dessus (chaleur), en dessous | −30 à 50 |
| Pluie prévue du jour | mm | au-dessus (forte pluie), en dessous | 0 à 300 |

Le vent n'est pas offert au départ : le fournisseur ne donne que le vent
**moyen** de la journée, qui sous-estime les coups de vent qui abîment les
abris. Offrir les rafales demande d'ajouter un champ à la requête et se
décidera à part (question 2).

## L'évaluation

- Elle a lieu **après chaque écriture réussie de prévisions** pour
  l'exploitation : la synchronisation de 06 h 15 et toute actualisation
  (bouton, consultation de la semaine courante).
- Elle porte sur la **prévision la plus récente** de chaque jour de l'horizon,
  aujourd'hui compris, jour civil de Paris (D-004).
- « En dessous de 5 °C » veut dire **strictement inférieur** à 5 ; « au-dessus
  de » veut dire strictement supérieur. Le libellé de l'écran le dit
  (question 4).
- Une valeur prévue absente ne déclenche **rien**, n'est jamais lue comme 0
  (D-003), et l'écran des critères le signale : « prévision indisponible pour
  le jeudi 6 novembre ».
- Une synchronisation en échec n'évalue rien ; la dernière prévision valide
  n'est pas réévaluée pour autant.
- La réanalyse et la pluie mesurée au pluviomètre ne déclenchent jamais
  d'alerte : elles disent le passé.
- Pour pouvoir évaluer après une actualisation et montrer la valeur prévue à
  l'écran, la température minimale et la température maximale prévues sont
  **conservées en base** par une migration additive (D-018), à côté de la
  pluie et de l'ET0 ; une valeur absente reste `NULL`.

## La répétition

- **Une seule alerte par critère et par jour visé**, tant que le critère n'est
  pas modifié (question 3). Si la prévision suivante repasse du bon côté puis
  franchit de nouveau le seuil, rien n'est renvoyé pour ce jour.
- Modifier un critère remet ses jours visés à zéro : la nouvelle version peut
  alerter de nouveau.
- Plusieurs jours visés trouvés par une même évaluation pour un même critère
  partent en **une seule notification** qui nomme le premier jour et le nombre
  de jours (« Gel prévu : 2 °C jeudi, et 2 autres jours sous 5 °C »).
- Plusieurs critères franchis en même temps font chacun leur notification.

## L'alerte enregistrée

Chaque alerte est enregistrée et ne change plus : exploitation, version du
critère, jour visé, valeur prévue avec son unité, date de la prévision
utilisée, heure d'envoi, et résultat de l'envoi (envoyée, aucun appareil
abonné, échec du service de notification ; et, précisé en codant le
31 octobre 2026, « nouvelle tentative » quand le service retente après un
échec passager). L'alerte est enregistrée avant l'envoi, en attente de son
résultat : la clé unique (version du critère, jour visé) garantit qu'aucune
notification ne part deux fois pour le même jour, même quand deux
évaluations se croisent. Une panne du service de
notification n'empêche ni la synchronisation météo ni l'enregistrement de
l'alerte, et ne relance pas l'envoi au-delà des tentatives bornées du Worker.

## La notification

- Titre : « Alerte météo » suivi du libellé du critère s'il existe.
- Texte : le fait prévu, le jour et le seuil, avec les unités : « Température
  minimale prévue 2 °C jeudi 6 novembre (seuil : sous 5 °C). Prévision du
  30 octobre, 06 h 15. »
- Le mot **prévue** figure toujours : une alerte ne parle jamais d'une
  observation (prévu, estimé et observé restent distincts).
- Le clic ouvre la page d'irrigation sur **la météo de la semaine du jour
  visé** (question 6).
- Le Worker Web Push reçoit une route d'**envoi immédiat**, authentifiée comme
  les autres, avec les mêmes limites de texte, la même liste blanche d'adresses
  et la même déduplication par abonnement.

## L'écran

Un encart « Alertes météo » près de la météo de la semaine (question 5) :

- la liste des critères de l'exploitation, avec, pour chacun, actif ou non,
  et la dernière alerte envoyée ;
- l'ajout, la modification, l'activation et la suppression d'un critère ;
- le rappel que les alertes ne partent que vers les appareils où les alertes
  ont été activées, avec le bouton d'activation s'il ne l'est pas ;
- l'historique des alertes envoyées, plus récente en premier.

La réorganisation 3.8 pourra déplacer cet encart avec les autres.

## Hors périmètre

- Les alertes sur la réserve d'eau de la ferme, la réserve du sol (5 ter) ou
  le besoin par culture (5 quater).
- Les alertes par parcelle ou par abri, une température propre aux abris.
- Les alertes par courriel ou SMS.
- Les rafales, l'humidité, le gel au sol ou tout champ non lu aujourd'hui,
  sauf décision du porteur (question 2).
- Toute action automatique déclenchée par une alerte.

## Découpage et preuve de fin

Trois PR, tests d'abord, une fois le contrat relu :

1. **Domaine** (`lib/domain/`) : le critère, sa validation, l'évaluation sur
   une liste de prévisions, la règle de répétition, le texte de la
   notification. Tests unitaires des scénarios ci-dessous.
2. **Persistance et envoi** : migration additive (températures prévues,
   critères et leurs versions, alertes), évaluation branchée après chaque
   écriture de prévisions, route d'envoi immédiat du Worker Web Push et ses
   tests. Tests de persistance, dont l'isolation entre exploitations.
3. **Écran** : l'encart, ses messages de refus, un parcours navigateur ;
   recette sur ordinateur et à 390 px.

Recette réelle sur la ferme : un critère réglé pour être franchi par la
prévision du jour, une alerte reçue sur le téléphone verrouillé, le clic qui
ouvre la bonne semaine, aucune seconde alerte à l'actualisation suivante.
Comme pour le minuteur, la réception sur téléphone verrouillé reste une
vérification manuelle, jamais annoncée comme automatisée.

### Scénarios chiffrés

Critère : température minimale en dessous de 5 °C, horizon 3 jours, le
lundi 2 novembre 2026.

1. Prévisions lundi 7 °C, mardi 4 °C, mercredi 6 °C : une alerte, jour visé
   mardi, valeur 4 °C.
2. Prévisions lundi 7 °C, mardi 5 °C, mercredi 6 °C : aucune alerte (5 n'est
   pas strictement sous 5).
3. Prévisions lundi 7 °C, mardi absente, mercredi 6 °C : aucune alerte ;
   l'écran signale la prévision de mardi indisponible.
4. Lundi 06 h 15, mardi 4 °C : alerte. Lundi 14 h, actualisation, mardi
   3 °C : aucune nouvelle alerte pour mardi.
5. Prévisions lundi 2 °C, mardi 1 °C, mercredi 3 °C : une seule
   notification, premier jour lundi, « et 2 autres jours ».
6. Jeudi 5 novembre 4 °C le lundi : hors horizon de 3 jours, aucune alerte.
7. Même prévision, critère inactif : aucune alerte.
8. Critère de l'exploitation A franchi : aucun appareil de l'exploitation B
   ne reçoit rien.
9. Aucun appareil abonné : l'alerte est enregistrée « aucun appareil
   abonné », la synchronisation reste réussie.

## Questions pour le porteur

Recommandation de l'assistant pour chacune, raisons à l'appui. Toutes
acceptées par le porteur le 30 octobre 2026.

1. **Les champs offerts au départ.** Recommandé : température minimale,
   température maximale et pluie prévue. Les trois sont déjà lues chaque
   matin, donc sans appel ni coût en plus ; elles couvrent le gel, la chaleur
   et la forte pluie.
2. **Le vent.** Recommandé : pas au départ. Seul le vent moyen est lu, et il
   ne dit pas les coups de vent dangereux pour les abris ; les rafales
   demanderaient de changer la requête météo, à décider à part si le besoin
   est réel sur la ferme.
3. **La répétition.** Recommandé : une seule alerte par critère et par jour
   visé. Une alerte à chaque changement de prévision ferait sonner le
   téléphone plusieurs fois pour le même gel ; l'écran montre toujours la
   dernière valeur prévue.
4. **« En dessous de 5 °C » : 5 °C compris ou non ?** Recommandé : strictement
   en dessous, comme dans votre phrase ; qui veut 5 compris règle 5,5.
5. **L'écran des critères.** Recommandé : un encart près de la météo de la
   semaine, là où se lit déjà la prévision ; la 3.8 le rangera ensuite.
6. **Le clic sur la notification.** Recommandé : ouvrir la météo de la semaine
   du jour visé, pour voir la prévision jour par jour.
7. **L'horizon.** Recommandé : de 1 à 7 jours, 3 par défaut. Au-delà d'une
   semaine, la prévision de température est trop incertaine pour justifier un
   geste ; 3 jours laissent le temps de sortir les voiles.
8. **Le seuil de gel.** Information, pas une règle : la température prévue est
   celle de l'air sous abri météo, à environ deux mètres. Par nuit claire et
   sans vent, il peut geler au ras des cultures alors que l'air reste à
   + 2 ou + 3 °C. Votre exemple de 5 °C laisse cette marge ; c'est à vous de
   choisir vos seuils.

## Choix faits en écrivant, confirmés par le porteur le 30 octobre 2026

- Les critères appartiennent à l'exploitation, pas à une personne ni à une
  parcelle ; tous ses appareils abonnés reçoivent les alertes.
- L'évaluation suit chaque écriture de prévisions, pas seulement celle de
  06 h 15 : une actualisation l'après-midi peut donc déclencher une alerte.
- Les températures minimale et maximale prévues sont conservées en base,
  plutôt qu'évaluées à la volée pendant la synchronisation, pour que l'écran
  montre la valeur prévue et que l'évaluation se teste.
- Les alertes utilisent l'abonnement déjà activé pour le minuteur ; il n'y a
  pas d'abonnement séparé. L'encart d'activation devra dire « alertes » et non
  plus seulement « fin du minuteur ».

## Retour de visite du porteur, 7 novembre 2026 (3.8, P43)

Le porteur ne retrouvait pas, sur la page, la marge de 2 à 3 °C qu'il
pensait voulue pour ces alertes (« il faut que l'utilisateur le sache et
puisse la régler »). Cette marge n'a jamais été ajoutée ici : le seuil de
température minimale reste celui que la ferme choisit, et la réponse du
30 octobre (« Votre exemple de 5 °C laisse cette marge ») est maintenue. La
marge réglable est celle du gel selon la culture
(`docs/weather-crop-alerts-contract.md`, P44). La page le dit désormais sous
son introduction : la prévision est prise à 2 m du sol, au ras du sol il
fait souvent 2 à 3 °C de moins, aucune marge n'est ajoutée au seuil, mieux
vaut donc un seuil au-dessus de 0 °C ; et elle renvoie à Alertes cultures,
par un lien quand cette fonctionnalité est cochée, sinon par « à cocher dans
Réglages ». Le « ? » de la page le rappelle.
