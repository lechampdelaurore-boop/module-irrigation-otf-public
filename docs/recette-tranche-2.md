# Recette finale de la tranche 2

## Périmètre

La recette de la sous-tranche 2.10 couvre les sous-tranches 2.1 à 2.9 sans
ajouter de fonctionnalité métier. Elle combine les tests automatisés, une
lecture de la base publiée et des parcours navigateur sur la version locale et
la version privée. Les opérations destructrices n’ont pas été rejouées sur les
données réelles : leurs garanties sont vérifiées par tests et contraintes D1.

## Matrice de validation

| Domaine | Validation principale |
| --- | --- |
| Données et migrations | migrations `0000` à `0008` dans l’ordre, schéma neuf, contraintes, isolation propriétaire/saison, absence d’orphelin dans la base publiée |
| Matériel et réglages | création, modification, duplication complète, archivage, suppression protégée, dix réglages maximum, aspersion et goutte-à-goutte |
| Calculs | interpolation par distance, centre de planche, durée ↔ mm, L/h ↔ m³/h, volume et cumuls de chevauchements |
| Géométrie et placements | ordre naturel incluant la planche zéro, sens inversé, distances entre jardins, reprise saisonnière, placement sur/entre planches et sélection goutte-à-goutte |
| Irrigations | immédiate, planifiée, déjà réalisée, limite journalière, minuteur persistant, pause, reprise, arrêt anticipé, confirmation idempotente et historique immuable |
| Web Push | contrat d’abonnement, URL interne, révisions d’alarmes, déduplication, reprise sur erreur et repli sans notification |
| Eau et météo | objectifs hebdomadaires, semaines lundi-dimanche, pluie manuelle prioritaire, ET0 FAO-56, cache, réponse partielle, panne et `429`/`Retry-After` |
| Cumuls et historique | semaine, mois, saison, personnalisé, filtres hiérarchiques, pondération par surface, surface unique, détail chronologique et CSV UTF-8 |
| Sécurité | authentification des actions et du CSV, requêtes par propriétaire/workspace, validation des identifiants, secrets exclusivement serveur et API OTF exclusivement GET |
| Interfaces | parcours ordinateur et smartphone autour de 390 px, sans débordement horizontal ; menus tactiles d’au moins 44 × 44 px |

## Cas navigateur critique

Le parcours local utilise les données de démonstration afin de ne pas polluer
le compte réel : changement de période et filtre historique, ouverture d’un
détail, export CSV, calcul d’une irrigation d’une minute, blocage par la limite
journalière, démarrage après adaptation locale de la limite, pause, rechargement,
reprise, arrêt anticipé et confirmation partielle. Le parcours publié reste en
lecture seule : authentification, fraîcheur OTF, dimensions réelles, plan,
matériels, placements, objectifs, météo, cumuls, filtre, détail et export.

## Corrections issues de la recette

Deux défauts d’usage ont été corrigés : les très petits volumes d’une alerte de
limite sont affichés à trois décimales au lieu de devenir `0,00 m³`, et les
déclencheurs des menus contextuels atteignent désormais 44 × 44 px. La
documentation du modèle mentionne explicitement la migration
`0008_weather_refresh_guard` et ses deux champs de temporisation.

## Réserves explicites

- Le téléphone physiquement verrouillé et le navigateur réellement arrêté ne
  sont pas simulables dans la recette automatisée Web Push : un contrôle manuel
  sur appareil reste utile.
- Le suivi par série culturale est hors périmètre. Les routes OTF autorisées ne
  fournissent pas encore l’occupation datée des planches par série ; aucun
  contournement du contrat n’a été ajouté.
- Les pannes réelles OTF et météo ne sont pas provoquées volontairement ; les
  états réseau, serveur, réponse partielle et quota sont couverts par fixtures.
