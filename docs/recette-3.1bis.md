# Recette 3.1 bis — Mesure du débit du forage

Faite sur le site privé, avec le vrai compteur du forage. C'est la dernière pièce de la preuve de fin du contrat
`docs/resource-flow-contract.md` : tout le reste est vérifié par des tests et
des parcours automatisés, mais aucun d'eux n'a jamais lu un compteur.

Une vérification ne compte que si elle porte sur la version déployée. Le code
est en ligne depuis le 22 septembre 2026.

## Préalable

Une ressource existe dans « Ressources en eau », avec son débit nominal actuel.
Notez-le avant de commencer : c'est lui que la mesure remplacera.

Il faut **deux passages au forage** séparés de quelques heures au moins, et
savoir à peu près combien de temps la pompe a tourné entre les deux.

## Qui a constaté quoi

Le porteur a relevé le compteur du forage à quatre reprises — les 11, 15, 19 et
24 septembre 2026 — et appliqué la mesure du 24 comme débit de référence. Le
25 septembre 2026, il a transmis son verdict : « la recette du forage semble
correcte », et demandé une relecture.

L'assistant a repris chaque ligne le 25 septembre 2026 sur la version déployée,
avec les relevés du porteur : recalcul de chaque chiffre affiché, provocation
des cas que le porteur ne pouvait pas provoquer — refus, changement de compteur,
limite de prélèvement — au moyen de relevés de contrôle, tous supprimés ensuite.
Les quatre relevés du porteur ont été laissés intacts, et l'état du forage a été
vérifié identique après chaque manipulation. Le jugement agronomique — « ce
débit ressemble à mon forage » — reste au porteur.

Le débit de référence en vigueur au moment de la relecture : **0,511 m³/h**.

## Premier passage

| N° | Vérification | Attendu | Constaté | Verdict |
| --- | --- | --- | --- | --- |
| R1 | Sur la fiche de la ressource, bouton « Relevés de débit » | Le panneau s'ouvre et rappelle le débit de référence en vigueur | Le panneau s'ouvre sous la fiche « Forage principal » et porte « Débit de référence en vigueur : 0,511 m³/h » | OK |
| R2 | La date et l'heure sont pré-remplies | À l'instant courant, heure de la ferme | Champ pré-rempli à `2026-09-25T20:46` alors qu'il était 20:46 à la ferme | OK |
| R3 | Saisir l'index lu sur le compteur, laisser la durée d'arrêt à zéro, enregistrer | Le relevé apparaît dans la liste ; aucune mesure encore, il en faut deux | **Défaut.** Enregistré avec l'heure pré-remplie, le relevé est refusé : « Un relevé ne peut pas être daté dans le futur. » C'est pourtant le geste normal au forage. Avec une heure plus ancienne, il s'enregistre et apparaît en tête de liste. La mention « aucune mesure encore » n'était plus observable, la chaîne comptant déjà quatre relevés. **Second défaut**, constaté par le porteur le 25/09 au soir et reproduit à l'identique : le refus s'affiche en haut de la section « Ressources en eau », **617 px au-dessus du bouton**, et l'index saisi est effacé malgré le refus. L'écran paraît n'avoir rien fait | **Deux défauts**, corrigés puis **revérifiés sur la version déployée le 25/09/2026 à 21:39** : heure proposée acceptée sans y toucher, « Le relevé a été enregistré. » affiché 16 px sous le bouton, et sur un refus l'index saisi reste en place | OK |
| R4 | Sur téléphone, au forage | Champs atteignables au pouce, aucun défilement horizontal, clavier numérique pour l'index | L'index porte `inputmode="decimal"`, les heures et les minutes `inputmode="numeric"` : le clavier numérique s'ouvre. Aucun débordement horizontal à 390 px, panneau ouvert, vérifié à chaque étape du parcours P5. Le confort réel au pouce, debout au forage, reste à constater par le porteur | OK pour la part mesurable |

## Second passage, quelques heures plus tard

| N° | Vérification | Attendu | Constaté | Verdict |
| --- | --- | --- | --- | --- |
| R5 | Saisir le nouvel index et la durée pendant laquelle la pompe n'a **pas** tourné | Le bloc « Dernière mesure » apparaît | Présent, daté du dernier relevé de la chaîne : « Dernière mesure, au 24 sept. 2026, 16:48 » | OK |
| R6 | Volume produit | Égal à la différence des deux index | 60,8 m³ = 686,6 − 625,8. Les deux mesures précédentes recalculées de même : 56,2 et 49,9 m³ | OK |
| R7 | Temps de marche | Égal au temps écoulé moins la durée d'arrêt saisie | 119 h pour un intervalle du 19/09 17:48 au 24/09 16:48, soit 119 h, aucun arrêt saisi. La soustraction elle-même a été éprouvée par un relevé de contrôle : 15,2 h écoulées − 10 h d'arrêt = 5,2 h de marche | OK |
| R8 | Débit en fonctionnement | Cohérent avec ce que vous savez de votre forage | 0,542 puis 0,536 puis 0,511 m³/h : un forage régulier, qui faiblit légèrement. La cohérence avec le forage réel est le jugement du porteur, donné le 25/09/2026 | OK, jugé par le porteur |
| R9 | Débit moyen sur la période | Plus faible que le précédent dès qu'il y a eu des arrêts | Aucun des quatre relevés du porteur ne porte d'arrêt : les deux débits sont donc égaux, ce qui est la règle et non un défaut. Avec 10 h d'arrêt sur le relevé de contrôle : 0,225 m³/h de moyenne contre 0,658 m³/h en fonctionnement | OK |
| R10 | Le bouton « Mettre à jour le débit de la ressource » | Annonce le changement en clair, de l'ancien débit au nouveau, avec l'écart en pourcentage | « La référence passerait de 0,511 m³/h à 0,658 m³/h, soit +29 % », mis en évidence, l'écart dépassant 20 % | OK |

## La mise à jour

| N° | Vérification | Attendu | Constaté | Verdict |
| --- | --- | --- | --- | --- |
| R11 | Cliquer sur le bouton | Message de confirmation ; la fiche de la ressource porte le nouveau débit | Fait par le porteur avant le 25/09 : la fiche porte 0,511 m³/h, valeur exacte de la mesure du 24/09 — 0,5108403361344545 en base, sans arrondi. L'assistant n'a pas rejoué le clic, pour ne pas écraser la référence du porteur | OK, par le porteur |
| R12 | Le bloc « Dernière mesure » | Indique que cette mesure est désormais la référence, le bouton a disparu | « Cette mesure est déjà le débit de référence de la ressource. », bouton absent | OK |
| R13 | Section « Faisabilité et répartition », recalculer | Le volume mobilisable tient compte du nouveau débit | Recalcul du 25/09 à 20:48 : disponibilité prévisionnelle 56,152 m³ pour 30 m³ en réserve, soit 26,152 m³ attendus du forage d'ici dimanche soir — exactement 51 h 11 min à 0,511 m³/h | OK |
| R14 | Le graphique | Un point pour la mesure, la référence en trait pointillé | Trois points, un par mesure, reliés par une ligne pleine ; référence en pointillé ; légende « Débit mesuré en fonctionnement » et « Débit de référence en vigueur » | OK |

## Les volumes produits

Ce que le forage a réellement sorti, mois par mois, et la part que cela occupe
dans ce que votre limite de prélèvement autorise.

| N° | Vérification | Attendu | Constaté | Verdict |
| --- | --- | --- | --- | --- |
| R15 | Le tableau « Volumes produits » | Une ligne pour le mois courant, avec le volume produit et le nombre de mesures | « Septembre 2026 · 166,9 m³ · 3 » | OK |
| R16 | Le volume du mois | Égal à la somme des volumes produits par les mesures du mois, donc ici à la différence de vos deux index | 56,2 + 49,9 + 60,8 = 166,9 m³ | OK |
| R17 | Si une limite de prélèvement est active sur la ressource | Une colonne « Part de l'autorisé » indique le pourcentage et le volume autorisé sur le mois | Provoqué par l'assistant : limite de 10 m³/jour posée, puis retirée. Colonne « 56 % de 300 m³ » — 10 m³ × 30 jours de septembre, et 166,9 / 300 = 55,6 % | OK |
| R18 | Si aucune limite n'est active | La colonne n'apparaît pas du tout | La colonne disparaît dès la limite retirée ; la ressource est revenue à « Limite Aucune » | OK |

Deux avertissements figurent sous le tableau, à lire une fois : le volume d'une
mesure est porté au mois de son relevé d'arrivée sans être réparti entre deux
mois, et la part de l'autorisé est une **enveloppe**, pas une preuve de
conformité — une limite journalière peut être dépassée un jour sans que le
total du mois le montre.

## Le tableau des relevés

C'est la mémoire de ce que vous avez lu au compteur. Il mérite d'être vérifié
pour lui-même, et pas seulement aperçu au passage.

| N° | Vérification | Attendu | Constaté | Verdict |
| --- | --- | --- | --- | --- |
| R19 | L'ordre du tableau | Le plus récent en haut | 24, puis 19, puis 15, puis 11 septembre | OK |
| R20 | Les deux relevés saisis | Dates, heures et index conformes à ce que vous avez tapé, sans arrondi ni décalage d'heure | **Défaut.** Une heure saisie à 06:00 s'affiche 08:00 : deux heures d'écart, exactement le décalage d'été de la ferme. Les index, eux, sont conformes | **Défaut**, corrigé puis **revérifié sur la version déployée le 25/09/2026** : heure proposée 21:39, relevé affiché « 25 sept. 2026, 21:39 ». Plus aucun décalage | OK |
| R21 | La colonne « Débit mesuré » | Renseignée sur le second relevé, vide (« — ») sur le premier, qui n'a pas de précédent | « — » sur le relevé du 11 septembre, renseignée sur les trois suivants | OK |
| R22 | Une note saisie sur un relevé | Affichée sous la date, en petit | Constaté sur les relevés de contrôle : la note paraît sous la date, en petits caractères | OK |
| R23 | Supprimer un relevé, puis recharger la page | Il a disparu ; la mesure qui en dépendait a disparu aussi, et le graphique s'ajuste | Trois relevés de contrôle supprimés : ligne disparue, mesure disparue, point du graphique en moins, volume du mois revenu à 166,9 m³. État identique après rechargement de la page | OK |

Attention pour R23 : supprimer un relevé ne change pas le débit de référence
déjà appliqué. C'est voulu — une décision prise reste consignée — mais si la
suppression rend cette décision fausse, il faut réappliquer une mesure.

## Les refus, si l'occasion se présente

Ces cas ne se provoquent pas exprès ; notez-les s'ils arrivent.

| N° | Vérification | Attendu | Constaté | Verdict |
| --- | --- | --- | --- | --- |
| R24 | Saisir un index inférieur au précédent | Refus expliqué, avec la mention de la case « compteur remplacé » | « L'index saisi est inférieur au précédent. Si le compteur a été remplacé ou remis à zéro, cochez la case prévue. » Rien n'est enregistré | OK |
| R25 | Saisir une durée d'arrêt plus longue que le temps écoulé | Refus expliqué | « La durée d'arrêt dépasse le temps écoulé depuis le relevé voisin. Corrigez-la, ou corrigez celle du relevé suivant. » Rien n'est enregistré | OK |
| R26 | Compteur réellement remplacé un jour : cocher la case | Aucun débit calculé entre l'ancien et le nouveau compteur, le tableau porte « Compteur remplacé », le graphique montre une interruption | Provoqué par l'assistant : relevé à 5 m³, case cochée, accepté malgré l'index qui recule. Colonne débit : « Compteur remplacé ». Aucune mesure créée, aucun point ajouté au graphique — la ligne s'arrête à la dernière mesure valide — et volume du mois inchangé. Relevé supprimé ensuite | OK |

## Clôture

### Le défaut : l'heure saisie était lue en UTC

R3 et R20 sont deux symptômes d'une même cause. Le champ « date et heure » ne
porte pas de fuseau : « 2026-09-25T06:00 » ne dit pas six heures où. L'action
qui enregistre le relevé tourne dans le Worker, dont le fuseau est UTC, et y
lisait cette heure comme de l'UTC. Deux conséquences, l'été :

- un relevé fait à l'instant était daté deux heures plus tard, donc **refusé
  comme daté dans le futur** — c'est-à-dire que le geste normal au forage,
  celui pour lequel l'écran a été conçu, ne passait pas ;
- un relevé plus ancien était accepté, mais **enregistré deux heures après**
  l'heure tapée.

Les débits, eux, sont justes : le décalage est le même sur tous les relevés et
s'annule dans les différences. Les quatre relevés du porteur restent des
mesures valides ; seules leurs heures sont deux heures trop tard.

**Pourquoi rien ne l'avait vu.** Les tests tournent sur la machine du porteur,
à l'heure de la ferme, et le parcours P5 aussi : serveur et navigateur y
partagent le même fuseau, et le défaut ne peut pas y apparaître. Seul le Worker
déployé tourne en UTC. C'est exactement ce que la règle du dépôt exige —
« une vérification ne compte que si elle porte sur la version déployée » — et
la première fois qu'elle rapporte quelque chose qu'aucun contrôle automatique
n'aurait pu trouver.

**Correction du 25 septembre 2026.** La saisie est désormais lue à l'heure de
la ferme par `instantFromIrrigationDateTimeInput`, exact inverse du
pré-remplissage (`lib/domain/irrigation-format.ts`). La conversion « heure
d'horloge de la ferme → instant » vit en un seul endroit,
`localDateTimeUtc` dans `lib/domain/water-management.ts`, où elle servait
déjà à minuit. Un test rejoue la conversion dans un processus forcé en UTC,
c'est-à-dire dans les conditions du Worker, et un autre vérifie que l'action
passe bien par elle.

### Le second défaut : un refus qu'on ne voit pas

Le porteur a essayé le geste le soir même, avant que la correction ne soit en
ligne : relevé daté d'aujourd'hui 21:17, index 700 m³. « Quand je clique sur
enregistrer le relevé, ce que j'ai rempli dans l'index du compteur disparaît.
Par contre, mon relevé n'apparaît pas dans la liste. »

C'est le défaut de fuseau, mais aggravé par l'écran lui-même. La réponse de
l'action — ici « Un relevé ne peut pas être daté dans le futur. » — s'affiche en
haut de la section « Ressources en eau », **617 px au-dessus du bouton** sur
ordinateur, et bien plus loin sur téléphone. Et le formulaire vidait l'index
dans tous les cas, succès ou refus. De l'endroit où se tient le maraîcher, le
relevé semble avoir été pris, puis perdu.

Deux corrections, le 25 septembre 2026 :

- la réponse est reprise **sous le bouton**, là où le geste a eu lieu ;
- les champs ne se vident **qu'une fois le relevé accepté** : un index refusé
  reste affiché, sans obliger à retourner lire le compteur.

Le parcours P5 éprouve les deux : il enregistre un relevé refusé, vérifie que le
message paraît dans le panneau et que l'index saisi est toujours là. Sans la
correction, ce contrôle échoue — vérifié. Au passage, l'assertion « le champ se
vide au succès », que P5 portait depuis sa création, ne prouvait rien : le champ
se vidait de toute façon.

### La revérification, après déploiement

Faite le 25 septembre 2026 à 21:39, sur la version déployée, PR 93 fusionnée et
déploiement Cloudflare terminé :

- heure proposée **21:39**, non modifiée : le relevé est **accepté**, alors
  qu'il était refusé une heure plus tôt ;
- il s'affiche dans le tableau à **21:39**, l'heure même qui était proposée ;
- la confirmation « Le relevé a été enregistré. » paraît **16 px sous le
  bouton** ;
- sur un refus — « Un relevé existe déjà à cette date et cette heure pour cette
  ressource. » — le message paraît au même endroit et **l'index saisi reste en
  place**.

Le relevé de contrôle a été supprimé : le forage retrouve ses quatre relevés,
166,9 m³ au mois de septembre, trois points au graphique et 0,511 m³/h de
référence.

### Les quatre relevés remis à l'heure

Demandé par le porteur le 25 septembre 2026 : « ressaisis les quatre relevés
avec les bonnes heures ». Fait le soir même, une fois la correction déployée.

Les valeurs exactes ont été relevées avant toute suppression : **l'écran
arrondit les index à une décimale**, et les retaper tels qu'affichés aurait
introduit jusqu'à cinq litres d'écart par relevé. Les index réels sont 519,69 —
et non 519,7 — puis 575,85, 625,79 et 686,58 m³.

| Relevé | Heure affichée avant | Heure affichée après | Index conservé |
| --- | --- | --- | --- |
| 1 | 11 sept. 13:00 | **11 sept. 11:00** | 519,69 m³ |
| 2 | 15 sept. 20:42 | **15 sept. 18:42** | 575,85 m³ |
| 3 | 19 sept. 17:48 | **19 sept. 15:48** | 625,79 m³ |
| 4 | 24 sept. 16:48 | **24 sept. 14:48** | 686,58 m³ |

Les intervalles étant décalés du même pas, les trois débits mesurés sont
identiques au dernier chiffre : 0,5415621986499515, 0,5364124597207298 et
0,5108403361344545 m³/h. Le volume de septembre reste 166,9 m³ en trois
mesures, le graphique trois points, et la dernière mesure est toujours
exactement le débit de référence, 0,511 m³/h.

Une conséquence, sans effet visible : la révision de débit du 25 septembre
garde sa valeur et sa date, mais ses deux liens vers les relevés qui l'ont
produite sont devenus nuls, comme le prescrit le schéma
(`ON DELETE set null`). Aucun écran ne les utilise ; c'est la trace en base
qui perd le lien entre la décision et ses deux lectures. Un bouton « Corriger »
sur une ligne du tableau l'aurait évité — voir ci-dessous.

### Ce qu'il reste à faire

### Reste ouvert

- **Le contrat promet une correction que l'écran n'offre pas.** « Un relevé se
  modifie et se supprime : c'est une lecture, et une lecture fautive n'a pas à
  survivre au nom de la fidélité. » La persistance sait le faire —
  `saveResourceMeterReadingForUser` accepte un identifiant de relevé et écrit
  un `UPDATE` — et un test de persistance vérifie même qu'une correction ne
  touche pas la révision. Mais l'action de l'écran ne transmet pas cet
  identifiant, et le tableau n'offre que « Supprimer ». Corriger une heure
  oblige donc à supprimer puis ressaisir, ce qui coupe le lien entre la
  révision et ses relevés. À combler par un bouton « Corriger », si le porteur
  le veut.
- Chiffres de l'exemple du cahier des charges (section 16) : le contrat retient
  9 m³ produits en 24 h dont 16 h d'arrêt, soit 1,125 m³/h. Le calcul est
  éprouvé par les tests et par le parcours P5, qui le rejoue dans un vrai
  navigateur ; **le réalisme agronomique de l'exemple reste à confirmer ou
  corriger par le porteur**.
- **Sous-tranche 3.1 bis close le 25 septembre 2026.** Les vingt-six lignes
  sont constatées. Trois défauts, tous trouvés le même jour et corrigés le même
  jour : l'heure lue en UTC, le refus affiché hors de vue, la saisie effacée
  malgré le refus. Les deux lignes qu'ils tenaient en échec, R3 et R20, ont été
  revérifiées sur la version déployée après la fusion de la PR 93.
