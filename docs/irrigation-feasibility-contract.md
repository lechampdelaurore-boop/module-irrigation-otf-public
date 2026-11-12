# 3.4 — Faisabilité et répartition des déficits

## Responsabilités

`getIrrigationFeasibilityForUser` assemble en batch la même semaine lundi–dimanche que 3.3, dans `Europe/Paris`. L’eau est projetée de maintenant à lundi 00:00 exclusif. Les besoins effectifs (dont overrides et seuil) viennent de 3.3 sans recalcul agronomique. `projectWaterAvailability` de 3.1 fournit les soldes disjoints après les irrigations planifiées ; `evaluateHydraulicFeasibility` de 3.2 vérifie les chemins connus.

Pas de calendrier, de choix horaire, de concurrence minute par minute, de commande de pompe ni de série culturale. Une analyse positive en volume n’est pas la promesse d’un planning exécutable.

## Quantités et arbitrage

- Calcul principal en m³ ; dose en mm = m³ × 1000 / surface mouillée, la même surface que celle qui a donné le volume du besoin (`docs/wetted-surface-contract.md`), pour que mm → m³ → mm rende la valeur de départ. Une surface mouillée inconnue laisse le besoin inconnu.
- Besoin total = somme des besoins effectifs connus. Une donnée manquante rend le total global non calculable, avec sous-total connu affiché.
- Priorités strictes Haute, Normale, Basse. Le déficit relatif n’influe pas sur la priorité.
- Si tout un niveau peut être servi, allocation complète automatique.
- En pénurie entre plusieurs planches, aucune décision automatique : cases « Servir », toutes cochées au départ — la proposition, depuis l'écran façon plan d'assolement (`docs/shortage-contract.md`, 2 bis, D-083) —, puis validation humaine ; rien n'est enregistré avant elle. Une seule planche peut recevoir le maximum sans arbitrage.
- Si les sélectionnées tiennent dans le budget, allocation complète ; sinon même fraction de besoin pour chacune. Les arêtes incompatibles ne sont jamais utilisées ; le taux commun peut être limité par une source exclusive. Un reliquat non distribuable est explicite, pas réattribué silencieusement.
- Les exclues reçoivent zéro avec explication. Après validation, le reliquat passe au niveau inférieur.
- Une dose positive sous le seuil 3.3 est affichée à titre explicatif, mais affectée à zéro. Elle n’est pas transférée au futur planning, ni redistribuée aux priorités suivantes sans nouvel arbitrage.
- Couverture = affectable / besoin × 100, bornée à 100 ; déficit = max(0, besoin − affectable). Avant arbitrage le maximum est théorique ; après validation il tient compte des exclusions et du seuil. Sans besoin, satisfaction 100 %.

## Hydraulique et inconnues

Une liaison connue requiert un matériel placé couvrant la planche, sa pompe habituelle, une origine correspondant au pool, une pompe active et un débit suffisant. Un défaut explicite sur tous les chemins déclarés exclut cette alimentation. Un chemin réellement incomplet reste non vérifié ; aucune pompe hypothétique n’est inventée pour effacer une incompatibilité déclarée.

Les allocations comprennent la part potentielle, clairement signalée. La confirmation est une borne inférieure simultanément routable avec TOUTES les allocations retenues : l’eau confirmée pour une planche ne peut pas être reprise à une autre. Pour les réseaux comportant plusieurs goulots, ce contrôle conservateur peut sous-estimer la part confirmable ; les aides l’indiquent. Aucun horaire n’est calculé. Une liaison automatique source→réserve ne garantit pas un chemin direct source→matériel.

Le stock actuel et le stock prévisionnel sont distincts. `null` n’est pas zéro. Une réserve inactive vaut réellement zéro mobilisable, mais une réserve sans jauge reste inconnue. Voir `water-resources-contract.md` pour les minima, réservations et apports sans double comptage. Les limites journalières d’irrigation 2.8, créneaux et transferts détaillés restent à vérifier lors de l’exécution/planning ; les limites de prélèvement par ressource 3.1 bornent déjà les volumes projetés.

## Persistance, isolation, concurrence

La migration additive `0012_cloudy_alex_power.sql` crée `irrigation_arbitrations`, son journal et `irrigation_workspaces.feasibility_revision`. Aucune migration appliquée 0000–0011 n’est modifiée. Le journal Drizzle ajoute uniquement l’entrée 0012 ; le snapshot de génération décrit l’état actuel.

Une décision contient workspace, saison, semaine, priorité, sélection, ensemble de candidats et date/auteur. Les résultats dérivés ne sont pas persistés. Les variations quantitatives recalculent la sélection existante. Les changements de candidats/priorités, besoins devenus nuls ou pénurie disparue invalident durablement les anciennes exclusions ; elles ne ressuscitent pas silencieusement.

Les actions déterminent le propriétaire depuis la session, jamais depuis le formulaire. La validation relit les sources côté serveur. Les triggers de révision couvrent besoins, météo, matériels, placements, groupes, événements, ressources, pompes et cache OTF. Une garde dans le batch atomique refuse les décisions périmées ; le journal et la sélection sont enregistrés ensemble. Un identifiant de requête déjà accepté est reconnu sans écraser une décision plus récente. Les candidats sont revalidés contre le workspace et la saison.

## Coût et interface

Chargement différé à l’approche de la section, calcul unique par période, aucune requête D1 par planche, aucun nouvel appel météo/OTF ad hoc. Les événements sont bornés à la semaine (réel OU planifié, et minuteurs ouverts), les mouvements à la période utile. Le contrat GET OTF n’est pas changé.

Recalcul ciblé après modification, message inter-onglets, retour de visibilité et bouton explicite. Pas de polling ni de `router.refresh()` ajouté par 3.4. Les données en cache ne deviennent pas une source indépendante.

L'écran d'arbitrage (`docs/shortage-contract.md`, 2 bis, D-083) recalcule la part à chaque case dans le navigateur, par `allocateIrrigationWater` sur la faisabilité reçue, sans requête. Les cultures de chaque planche et leur stade du jour ne se lisent que pour cet écran, quand un niveau demande un choix ; le planning, qui relit la faisabilité, ne les lit pas.

Résultat destiné à 3.5 : `IrrigationFeasibility`, détail par priorité et `BedWaterAllocation` avec besoin source, échéance, dose/volume proposé et alloué, part confirmée, volume utilisable, déficit, satisfaction, arbitrage, qualité hydraulique et raisons. Le champ `usableForPlanningCubicMeters` est nul sous seuil ou si la chaîne reste non vérifiée ; il ne déclenche aucune irrigation.
