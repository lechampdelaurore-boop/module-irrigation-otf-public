# Recette — modifier les réglages d'un matériel déjà posé

Protocole ouvert le 24 septembre 2026, à la demande du porteur de projet :
« une fois que les rampes d'irrigation sont posées, on ne peut pas modifier les
réglages ? Si oui, c'est un problème, car en réalité les réglages peuvent être
modifiés à tout moment. »

La crainte était infondée — les réglages **sont** modifiables après pose, et la
vérification est faite ci-dessous. Mais elle a révélé un vrai manque : aucune
recette et **aucun parcours navigateur** n'éprouvaient cette capacité. Un
réglage d'aspersion porte le débit par distance ; s'il cessait un jour d'être
modifiable, ou si une modification cessait de se propager au plan, rien ne le
signalerait.

## Ce qui est en jeu

Un réglage n'est pas une donnée figée à l'achat du matériel : une buse se
change, une pression se règle, une mesure au pluviomètre corrige une estimation.
Le logiciel doit donc accepter la correction à tout moment, **sans réécrire le
passé** : une irrigation déjà enregistrée conserve le matériel et le réglage
tels qu'ils ont été utilisés (D-006). Ces deux exigences tirent en sens
contraire, et c'est exactement pour cela qu'elles se vérifient.

## Vérifications

| N° | Vérification | Attendu | Constaté | Verdict |
| --- | --- | --- | --- | --- |
| M1 | Sur un matériel **déjà positionné**, ouvrir « Configurer les réglages » | Le dialogue s'ouvre, chaque réglage porte « Modifier » et « Supprimer » actifs | 24/09/2026, rampe bloc 6, positionnée entre B6-5 et B6-6 : dialogue ouvert, trois réglages, « Modifier » et « Supprimer » actifs sur chacun | OK |
| M2 | Ouvrir « Modifier » sur le réglage en service | Le profil distance/débit est éditable, avec son testeur de portée | Profil complet éditable : 0 m → 10 mm/h, 0,6 → 7,5, 1,8 → 6,25, 3 → 4,5, 4,2 → 3,5, 5,4 → 2, 6,6 → 1,5, 7,8 → 0,75, plus « Tester à … m » | OK |
| M3 | Changer une valeur et enregistrer | « Le réglage a été modifié » ; le plan recalcule l'apport des planches concernées **sans nouvelle pose** | Débit à 0,6 m porté de 7,5 à 9 mm/h : B6-5 est passée de « Apport cumulé 7,5 mm/h » à « 9 mm/h » aussitôt, sans retoucher la position. Valeur remise à 7,5 dans la foulée, apport revenu à 7,5 mm/h | OK |
| M4 | Ajouter une distance au profil, enregistrer | La portée annoncée sur la fiche et dans le placement suit la nouvelle dernière distance | | |
| M5 | Supprimer un réglage **non utilisé** par la position en cours | Suppression acceptée, la position n'est pas touchée | | |
| M6 | Supprimer le réglage **utilisé** par la position en cours | Soit le refus est expliqué, soit la position est explicitement invalidée : jamais une position qui pointe dans le vide | | |
| M7 | Après une irrigation enregistrée avec ce matériel, modifier le réglage | **L'irrigation passée conserve le matériel et le réglage tels qu'utilisés** (D-006). Le cumul historique ne bouge pas | **Éprouvé par test de persistance** le 24/09/2026 : une irrigation réalisée sous un goutte-à-goutte à 10 mm/h, puis le même réglage porté à 25 mm/h. Après modification, les millimètres apportés sont inchangés, chaque planche garde `rateMmPerHour` à 10, et la copie du réglage archivée avec l'événement vaut toujours 10 mm/h. La base stocke `equipment_snapshot` et `setting_snapshot` en JSON, colonnes obligatoires depuis la migration `0001` | OK |
| M8 | Recharger la page | La modification a survécu ; aucun écart entre l'affichage et la base | | |

M1 à M3 ont été constatés par l'assistant dans le navigateur du porteur, le
24 septembre 2026 au soir, avec son accès et son autorisation.

**M7, la plus importante, est éprouvée par un test de persistance** ajouté le
même soir dans `tests/db/irrigation-event.test.ts`. Le porteur a demandé qu'elle
le soit vraiment, et non affirmée sur la foi d'un commentaire : c'est désormais
la base de test qui le vérifie à chaque exécution, et une régression casserait
la CI. Restent M4, M5, M6 et M8, à la main.

## Dette signalée

Trois écrans n'avaient aucun parcours navigateur : les réglages, le placement et
l'arbitrage de la faisabilité. **Les trois sont couverts depuis** — P6 le
24 septembre 2026 pour le changement de réglage appliqué, P7 et P8 le
25 septembre pour l'arbitrage et le placement. Le dernier a trouvé un défaut dès
sa première exécution : une écriture réussie annoncée comme un échec, sur cinq
dépôts à la fois.

## Changer le réglage appliqué, sans déplacer

Ajouté le 24 septembre 2026 avec la fonctionnalité correspondante
(`docs/equipment-setting-change-contract.md`). La liste « Réglage appliqué »
n'apparaît que sur un matériel posé qui possède au moins deux réglages.

| N° | Vérification | Attendu | Constaté | Verdict |
| --- | --- | --- | --- | --- |
| C1 | Matériel posé, un seul réglage | Aucune liste « Réglage appliqué » : il n'y aurait rien à choisir | Éprouvé par le parcours P6 | OK |
| C2 | Ajouter un second réglage | La liste apparaît sur la fiche, sans recharger | Éprouvé par le parcours P6 | OK |
| C3 | Choisir l'autre réglage | L'apport des planches suit **sans que le plan s'ouvre** ; la position reste « Positionné » | Éprouvé par le parcours P6 aux deux largeurs : l'apport passe de 10 à 25 mm/h, l'écran de placement ne s'ouvre jamais | OK |
| C4 | Recharger la page | Le réglage choisi est toujours celui appliqué | Éprouvé par le parcours P6 | OK |
| C5 | Sur le téléphone, à 390 px | La liste est lisible et atteignable au pouce, sans défilement horizontal | Absence de débordement éprouvée par P6 à 390 px. **L'atteignabilité au pouce reste au porteur** | À faire |
| C6 | Après le changement, la faisabilité | Les chiffres se recalculent : changer la portée change les planches arrosées, donc la chaîne hydraulique | | |
