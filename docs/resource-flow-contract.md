# Contrat — Mesure et historique du débit des ressources

Sous-tranche 3.1 bis. Rédigé le 21 septembre 2026, avant le code, d'après le
cahier des charges section 16 et quatre décisions prises par le porteur de
projet le même soir.

C'est la première fonctionnalité écrite sous le socle qualité complet.

## À quoi ça sert

Une ressource porte aujourd'hui un **débit nominal** saisi à la main à sa
création. C'est une estimation, souvent celle du foreur, et elle ne bouge
jamais. Or c'est ce chiffre qui décide, dans les projections et dans la
faisabilité, de la quantité d'eau que la ferme peut espérer.

Cette sous-tranche permet de le mesurer réellement, à partir du compteur du
forage, et de remplacer l'estimation par la mesure.

Elle répond aussi à un fait constaté par le porteur : **le forage de la ferme a
un débit variable**. Un forage se recharge moins vite en fin d'été qu'au
printemps. L'historique et le graphique existent pour voir cette variation sur
une année ou plus, et décider en connaissance de cause.

## Ce qu'on relève

Un relevé porte :

- la **date et l'heure** du relevé, à l'heure de la ferme ;
- l'**index du compteur**, en mètres cubes, tel qu'il est lu ;
- la **durée d'arrêt** depuis le relevé précédent : le temps pendant lequel la
  pompe n'a pas tourné. Elle n'a pas de sens sur le tout premier relevé ni sur
  un relevé qui suit un changement de compteur ;
- une **note** facultative ;
- le cas échéant, la mention **« compteur remplacé ou remis à zéro »**.

L'« heure de la ferme » est une exigence de code, pas une façon de parler. Le
champ de saisie ne porte aucun fuseau : « 2026-09-25T06:00 » ne dit pas six
heures où. Il se lit avec `instantFromIrrigationDateTimeInput`, qui le rapporte
au fuseau de la ferme (D-004), et jamais avec `new Date()`, qui le rapporte au
fuseau de la machine qui exécute — le navigateur du maraîcher côté client, mais
UTC dans le Worker. La recette 3.1 bis du 25 septembre 2026 a montré ce que
cela coûte : deux heures d'écart en été, et tout relevé fait à l'instant refusé
comme daté dans le futur.

Décision du porteur du 21 septembre 2026 : la durée d'arrêt est **saisie à la
main**. Deux autres pistes ont été écartées — lire un compteur horaire, que le
forage n'a pas, et déduire le temps de marche des irrigations enregistrées, qui
ne serait juste que si le forage ne servait qu'à elles.

## Les calculs

Entre deux relevés consécutifs de la même chaîne :

| Grandeur | Calcul |
| --- | --- |
| Volume produit | index courant − index précédent, en m³ |
| Durée écoulée | date courante − date précédente |
| Durée de marche | durée écoulée − durée d'arrêt |
| Débit moyen sur la période | volume produit ÷ durée écoulée, en m³/h |
| **Débit en fonctionnement** | volume produit ÷ durée de marche, en m³/h |

Toutes les conversions passent par `lib/domain/units.ts`, sans arrondi
intermédiaire. L'affichage arrondit, le calcul non.

### L'exemple du forage

Celui du cahier des charges, repris tel quel par les tests.

- Relevé du lundi à 06:00, index 1 240,0 m³.
- Relevé du mardi à 06:00, index 1 249,0 m³, durée d'arrêt 16 h.

Volume produit 9,0 m³ · durée écoulée 24 h · durée de marche 8 h ·
débit moyen sur la période **0,375 m³/h** · débit en fonctionnement
**1,125 m³/h**.

Cet exemple dit à lui seul pourquoi la durée d'arrêt est demandée : sans elle,
le forage paraîtrait trois fois plus faible qu'il n'est.

*(Chiffres à confirmer par le porteur : seule la valeur 1,125 m³/h figure dans
la roadmap ; le volume et la durée sont reconstitués.)*

## Lequel des deux débits sert de référence

**Le débit en fonctionnement.** C'est une conséquence de la manière dont les
projections sont écrites : elles multiplient le débit de la ressource par ses
**heures de disponibilité** (`resourcePotentialForSegment` dans
`lib/domain/water-resources.ts`), c'est-à-dire qu'elles répondent à « si la
pompe tournait pendant cette fenêtre, combien sortirait-il ? ».

Y placer le débit moyen sur la période, qui inclut les arrêts, rendrait les
projections absurdement pessimistes pour une raison sans rapport avec le
forage : le fait que la ferme n'arrose pas la nuit.

Le débit moyen sur la période reste affiché, comme information : il dit à quel
rythme le forage a réellement produit.

## Les cas refusés

- **Index inférieur au précédent** : refusé, sauf si le relevé déclare
  « compteur remplacé ou remis à zéro ». Décision du porteur du 21 septembre
  2026. Un débit négatif ne doit jamais atteindre les projections.
- **Deux relevés au même instant** sur la même ressource : refusé ; sans durée
  écoulée il n'y a pas de débit.
- **Durée d'arrêt supérieure à la durée écoulée** : refusé, c'est une
  contradiction.
- **Volume produit non nul avec une durée de marche nulle** : refusé, même
  raison.
- **Date de relevé dans le futur** : refusée.

Un volume produit nul avec une durée de marche non nulle est accepté : la
pompe a tourné sans rien produire, le débit vaut zéro et c'est une information.

Une pompe restée à l'arrêt toute la période, sans rien produire, est acceptée
aussi : elle donne un débit moyen nul et **aucun** débit en fonctionnement.
Pas zéro — il n'y a pas de débit à annoncer, et zéro serait un chiffre inventé.
Cette mesure ne peut donc pas être appliquée à la ressource.

### Le relevé rattrapé

Un relevé oublié puis saisi après coup s'intercale entre deux relevés
existants. Il est alors vérifié **des deux côtés**, et non seulement contre
celui qui le précède : en s'intercalant, il raccourcit l'intervalle du relevé
suivant, et une durée d'arrêt qui tenait dans l'ancien intervalle peut ne plus
tenir dans le nouveau.

Exemple : lundi 06:00, mardi 06:00 avec seize heures d'arrêt. Un relevé
rattrapé le lundi à midi laisse dix-huit heures avant le mardi, les seize
heures y tiennent encore. Le même relevé placé le mardi à minuit n'en laisse
que six : il est refusé, et l'écran indique qu'il faut d'abord corriger la
durée d'arrêt du relevé suivant.

### Le changement de compteur

Un relevé marqué « compteur remplacé ou remis à zéro » **coupe la chaîne** :
aucun débit n'est calculé entre lui et le relevé qui le précède, et son index
devient la nouvelle base. L'historique conserve les deux périodes côte à côte,
sans trou apparent ni chiffre inventé pour combler la coupure.

## Le débit de référence

**Une mesure ne change jamais la référence toute seule. Un bouton, placé sous
le résultat, l'applique.**

Décision du porteur du 21 septembre 2026. Ce bouton — « Mettre à jour le débit
de la ressource » — apparaît immédiatement après l'enregistrement d'un relevé,
avec le changement qu'il produirait écrit en clair : « 1,25 → 0,82 m³/h, soit
−34 % ». Le porteur décide, en un geste, sans quitter l'écran où il vient de
saisir.

### Pourquoi à cet endroit et pas ailleurs

L'objection à une validation explicite était qu'on peut l'oublier : la
faisabilité tournerait alors sur un chiffre périmé alors que la vraie valeur
serait déjà dans l'outil. Placer le bouton **au moment de la mesure**, et non
dans un écran séparé, répond à cette objection sans retirer la décision au
porteur. Il voit la valeur, il voit l'écart, il tranche.

Le même bouton reste disponible plus tard, sur n'importe quelle mesure de
l'historique : une mesure faite au forage sans réseau s'applique au retour.

### Ce que la mise à jour enregistre

- Une **révision de débit**, datée, avec son auteur, les deux relevés dont elle
  provient et une note facultative.
- Le débit de la ressource est **remplacé** par la valeur appliquée (décision
  du porteur du 21 septembre 2026), l'ancienne restant dans l'historique des
  révisions, consultable et datée.

Le modèle est celui des révisions de limite de prélèvement, déjà en place
(`water_resource_limit_revisions`) : `validFrom` à l'instant de la mise à jour,
`validUntil` renseigné quand la révision suivante prend le relais.

La colonne `nominal_flow_cubic_meters_per_hour` garde son nom — la renommer
demanderait une migration sans bénéfice fonctionnel — mais l'interface l'appelle
**débit de référence**, et le contrat note cet écart de vocabulaire comme une
dette mineure.

Une ressource dont aucune mesure n'a jamais été appliquée garde le débit saisi
à sa création. C'est le seul cas où la référence est une estimation.

### L'écart affiché

Au-delà de 20 % d'écart entre la mesure et la référence en vigueur, le
changement est mis en évidence plutôt que simplement écrit. Ce n'est pas une
barrière : le bouton reste actif. C'est un moyen de repérer sur-le-champ une
faute de frappe sur l'index, qui sinon partirait dans les projections de toute
la ferme.

Le seuil de 20 % est un réglage, pas une règle physique : il se change sans
redéveloppement.

### Un forage à débit variable

Le porteur a signalé que son forage a un débit variable selon la saison. La
règle y répond : à chaque relevé, il voit où en est réellement son forage et
décide d'aligner la référence ou non. L'historique des révisions montrera alors
une référence en marches d'escalier suivant la nappe, et le graphique des
mesures montrera la courbe réelle.

Une référence par saison — une valeur de printemps, une valeur d'étiage —
reste écartée pour l'instant : elle demanderait de définir des saisons
hydrogéologiques, ce qui est un sujet en soi. À rouvrir si une année de mesures
montre une saisonnalité nette et reproductible.

## Historique et graphique

Le porteur suit un forage dont le débit varie. L'historique est donc une
fonctionnalité à part entière, pas un journal technique.

- **Une mesure par couple de relevés consécutifs**, datée de la fin de la
  période mesurée.
- **Période affichée** : douze derniers mois par défaut, avec un choix
  « tout l'historique ». Aucune mesure n'est purgée : quelques relevés par mois
  pendant dix ans tiennent dans une poignée de kilo-octets.
- **Le graphique** porte le débit en fonctionnement, en m³/h, au fil du temps :
  un point par mesure, reliés dans l'ordre. Il superpose le débit de référence
  en vigueur, en marches d'escalier, pour qu'on voie d'un coup d'œil si la
  référence suit la réalité du forage ou s'en est éloignée.
- **Les coupures de chaîne** (changement de compteur) apparaissent comme telles,
  sans segment reliant les deux côtés.
- Le graphique est lisible à 390 px : c'est là qu'il sera consulté.

## Les volumes produits

Ajouté le 22 septembre 2026, à la demande du porteur, après lecture de la
recette. Le volume produit était calculé pour chaque mesure mais cumulé nulle
part : rien ne disait ce que la ressource avait réellement sorti dans le mois.

Or l'application connaît déjà la **limite de prélèvement autorisée** en
m³/jour, portée par les révisions de limite de la 3.1, et ne s'en servait que
pour les projections — pour dire ce que la ferme *pourra* prélever. Faute de
mesure, elle n'avait jamais pu la comparer au prélèvement *réel*. Maintenant
qu'elle mesure, la comparaison devient possible, et pour un forage elle relève
souvent de l'obligation déclarative.

- **Cumul par mois civil**, à l'heure de la ferme, douze mois affichés au plus,
  avec un total sur la période affichée.
- **Le volume d'une mesure est porté au mois de son relevé d'arrivée**, sans
  répartition au prorata quand elle chevauche deux mois. Répartir supposerait
  un débit constant sur l'intervalle, ce qui est faux : la pompe tourne par
  à-coups. Un rattachement net et explicable vaut mieux qu'une répartition qui
  invente. Relever une fois par mois rend le rattachement exact, et l'écran le
  dit.
- **La part de l'autorisé** compare le volume du mois à la limite journalière
  multipliée par le nombre de jours du mois. La colonne n'apparaît que si une
  limite est active.

Cette part est une **enveloppe, pas une preuve de conformité** : une limite
journalière peut être dépassée un jour sans que le total du mois le montre.
Seuls des relevés quotidiens le diraient. L'écran l'écrit, parce qu'un chiffre
rassurant qui ne prouve rien est pire qu'une absence de chiffre.

## Persistance

Deux tables, rattachées à `irrigation_workspaces` comme tout le reste, avec
l'isolation vérifiée côté serveur.

- `water_resource_meter_readings` : espace de travail, ressource, date et heure,
  index en m³, durée d'arrêt en secondes (nulle autorisée), indicateur de
  compteur remplacé, note, auteur, date de création. Unicité sur
  (ressource, date et heure). Contraintes : index ≥ 0, durée d'arrêt ≥ 0.
- `water_resource_flow_revisions` : espace de travail, ressource, débit en
  m³/h, `valid_from`, `valid_until`, les deux relevés d'origine, note, auteur,
  date de création. Contrainte : débit ≥ 0.

Le débit de référence en vigueur reste porté par
`water_resources.nominal_flow_cubic_meters_per_hour` : une valeur matérialisée
que la révision justifie, sur le patron déjà en place pour le volume des
réserves.

Migration additive et manuscrite, selon `docs/migrations-contract.md`.

### Ce qui se corrige, et ce qui ne se corrige pas

Un **relevé** se modifie et se supprime : c'est une lecture, et une lecture
fautive n'a pas à survivre au nom de la fidélité.

Une **révision de débit** est immuable : c'est une décision, et la règle
d'immuabilité de l'historique s'applique (D-006). On ne réécrit pas une
décision passée ; on en prend une nouvelle, et l'ancienne se ferme à sa date.
C'est ce qui permet d'expliquer après coup pourquoi une faisabilité archivée
annonçait tel volume.

Conséquence : corriger un relevé ne change pas le débit de référence. Si la
correction rend une mesure appliquée fausse, il faut la réappliquer — le bouton
reste disponible sur toute mesure de l'historique.

## Interface

La saisie est pensée pour être faite **au forage, sur un téléphone, debout**.

- Date et heure pré-remplies à l'instant courant, modifiables.
- Un seul champ obligatoire : l'index lu.
- La durée d'arrêt se saisit en heures et minutes, comme la durée d'irrigation,
  et vaut zéro par défaut.
- Cibles tactiles d'au moins 44 pixels, règle déjà vérifiée par un test.
- Chaque ligne du tableau des relevés porte **« Corriger »** et « Supprimer ».
  Corriger recharge le relevé dans le formulaire de saisie — avec son index
  **non arrondi**, le tableau n'en montrant qu'une décimale — annonce en clair
  quel relevé est en cours de correction, et offre d'abandonner. La décision de
  débit déjà prise ne bouge pas ; si la correction la rend fausse, le bouton de
  mise à jour reste disponible sur la mesure.
- Après enregistrement, le calcul apparaît immédiatement : volume produit,
  durée de marche, débit en fonctionnement, puis le bouton **« Mettre à jour le
  débit de la ressource »** portant le changement en clair, mis en évidence si
  l'écart dépasse 20 %. Le bouton disparaît une fois la mesure appliquée.

Le module de domaine est pur et vit dans son propre fichier
(`lib/domain/resource-flow.ts`) : `lib/domain/water-resources.ts` est déjà
proche de la limite de 600 lignes.

## Hors périmètre

Ni pression, ni hauteur manométrique, ni courbe de pompe, ni diagnostic d'usure,
ni alerte automatique de rabattement de nappe. Aucun lien avec le moteur de
planning, qui n'existe pas encore. Les relevés portent sur les **ressources**,
pas sur les réserves.

## Preuve de fin

1. **Tests unitaires** du module de domaine, reprenant l'exemple du forage à
   1,125 m³/h, et couvrant chaque cas refusé.
2. **Tests de persistance** (Q2) : isolation entre propriétaires, mise à jour
   de la référence et historisation de la révision, révision inchangée par la
   correction d'un relevé, refus d'un index qui recule, coupure de chaîne.
3. **Parcours navigateur** (Q5) : un cinquième parcours, ajout d'un relevé,
   lecture du débit calculé et mise à jour du débit de la ressource, aux deux
   largeurs. Il n'était pas garanti quand la roadmap a été écrite ; il l'est
   depuis que le porteur a fait passer Q5 et Q6 devant cette sous-tranche.

   Il est livré **avec l'écran**, et non dans la PR suivante comme prévu au
   départ : un écran qu'aucun parcours ne traverse serait exactement ce que Q5
   existe pour empêcher, ne fût-ce que le temps d'une PR. C'est d'ailleurs lui
   qui a révélé deux défauts avant toute relecture humaine.
4. **Recette réelle** sur le forage de la ferme, par le porteur, avec un vrai
   relevé de compteur.
5. `pnpm check` et registres à jour.
