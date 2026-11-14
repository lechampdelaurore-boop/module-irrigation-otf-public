# Contrat de lecture Ouvre ta ferme

## Objet

Ce contrat importe un instantané cohérent de la structure nécessaire à la
première tranche. Ouvre ta ferme reste propriétaire et source de référence de
toutes ces entités. Le module ne conserve que leurs identifiants et un cache
technique de continuité de service.

## Routes autorisées

| Route | Portée attendue | Utilisation |
| --- | --- | --- |
| `GET /me` | `general:read` | Lire l’identifiant, le nom et la commune administrative de la structure autorisée |
| `GET /configuration` | `general:read` | Lire `seasonFirst` et `seasonLast` |
| `GET /zoneList` | `production:read` | Lister les parcelles |
| `GET /plotList` | `production:read` | Lister les jardins et abris |
| `GET /bedList` | `production:read` | Lister les planches et `alleyWidth` |
| `GET /actionList` | `production:read` | Lire le `fqn` des interventions, pour reconnaître semis direct et plantation (`docs/series-contract.md`) |
| `GET /plantList` | `production:read` | Lire le nom des espèces des mises en culture |
| `GET /seriesList?season=S&withCultivations=true` | `production:read` | Lister les séries de la saison et leurs mises en culture |
| `GET /placeList?season=S` | `production:read` | Lister l'occupation des planches par les séries |
| `GET /taskList` | `production:read` | Lire les tâches, toutes saisons, réduites aux tâches de semis direct et de plantation des séries de la saison |

Les cinq dernières routes sont celles de l'extension « suivi par série »
(`docs/series-contract.md`), ajoutées le 29 septembre 2026. Le connecteur ne
transmet que les paramètres de requête écrits dans son code — `start`, `limit`,
`season`, `withCultivations` — et n'envoie jamais `season` à `/taskList`, qui
l'ignore.

Le chemin ne vient jamais du navigateur. Le connecteur refuse toute route hors
de cette liste et fixe la méthode à `GET` dans son propre code. Il n’existe pas
de proxy générique.

## Lecture atomique

1. La configuration, la structure autorisée et les trois listes de la seule saison consultée sont lues
   depuis le serveur avec au moins 250 ms entre deux départs de requêtes, soit
   quatre appels par seconde au plus, limite annoncée par OTF. Cela
   représente cinq requêtes de base au lieu d'une lecture de toutes les
   saisons. Depuis l'extension « suivi par série », le plan de culture de la
   saison suit dans la même lecture : interventions, espèces, séries,
   emplacements, puis les tâches — une page chacune sauf les tâches, lues en
   entier toutes saisons confondues, treize pages sur la ferme du porteur. Le
   tout forme un seul instantané : si une de ces lectures échoue, rien ne
   remplace le cache.
1 bis. Ce rythme vaut pour le module entier, pas pour chaque client. Le quota
   est celui du jeton : deux lectures lancées en même temps par des composants
   différents, par exemple la page et une action serveur, passent par le même
   régulateur et ne peuvent pas cumuler leurs quotas. Constaté le 20 septembre
   2026 : le régulateur vivait dans chaque client alors que le client est
   reconstruit à chaque lecture, ce qui a produit un `429` sur `/bedList`.
2. Les listes suivent la pagination, au maximum 500 éléments par page et 50
   pages par route.
3. Les réponses sont adaptées au modèle du module.
4. Les identifiants, dimensions, saisons et relations parent-enfant sont
   validés.
5. Le nouvel instantané remplace le cache seulement si l’ensemble est valide.

Une réponse partielle, un JSON invalide ou une relation orpheline ne remplace
jamais la dernière lecture complète.

Le cache saisonnier est considéré comme récent pendant quatre heures. Le lien
« Actualiser » ignore cette durée et force une nouvelle lecture complète. Une
lecture réussie remplace uniquement le cache de l’utilisateur et de la saison
concernés.

## Politique d’erreur

- `401` et `403` : aucun nouvel essai automatique ;
- `429` : aucun nouvel essai automatique, affichage explicite de la limite, et
  aucun départ vers OTF pendant la seconde qui suit, la limite se comptant à la
  seconde ;
- erreur réseau ou `5xx` : au plus trois tentatives au total ;
- échec final avec cache : affichage du cache et de sa date absolue ;
- échec final sans cache : écran indisponible avec action « Réessayer » ;
- aucun détail technique ni jeton dans la réponse utilisateur.

Une saison extérieure à `seasonFirst → seasonLast` n’est pas considérée comme
une panne de connexion. Le module indique la plage réellement disponible et
propose la saison valide la plus proche.

## Secrets et isolation

- `OTF_API_TOKEN` existe exclusivement dans l’environnement serveur ;
- le cache ne contient jamais le jeton ni l’en-tête `Authorization` ;
- la base d’API doit être HTTPS et est fixée côté serveur ;
- chaque instantané est indexé par l’identifiant stable de l’utilisateur
  authentifié ;
- le navigateur ne reçoit que les champs nécessaires à la navigation.

Lors du futur passage à plusieurs structures, la clé de cache devra devenir un
identifiant d’exploitation autorisé, obtenu côté serveur après authentification
OTF, et non une valeur libre fournie par le navigateur.

## Validation réelle du contrat

Le mode `live` est actif sur le site privé. Le 6 septembre 2026, le contrat a
été contrôlé avec la clé de lecture du module et uniquement les routes GET. La
configuration réelle annonçait les saisons 2022 à 2027 :

| Saison | Parcelles | Jardins et abris affichables | Planches affichables |
| ---: | ---: | ---: | ---: |
| 2022 | 1 | 17 | 159 |
| 2023 | 1 | 17 | 159 |
| 2024 | 1 | 17 | 159 |
| 2025 | 1 | 17 | 159 |
| 2026 | 1 | 18 | 164 |
| 2027 | 1 | 19 | 174 |

Les six saisons ont été ouvertes dans l’interface privée lors de la recette de
la tranche 1. Le 6 septembre, une nouvelle lecture réelle de la saison 2026 a
confirmé 1 parcelle, 18 jardins ou abris, 164 planches, ainsi que les largeurs
de planches et passe-pieds converties en mètres (`0,75 m`, `0,45 m` et `0,25 m`).
La recette a également contrôlé la sélection de la saison et de la parcelle,
les nombres de jardins et de planches, ainsi que l’absence d’état fatal et
d’erreur navigateur.

Les états d’erreur suivants ont également été contrôlés :

- saison 2021 : rejet après la seule lecture de `/configuration`, avant `/me`
  et les trois listes saisonnières ;
- clé volontairement invalide : réponse réelle `401`, sans nouvel essai ;
- `401` et `403` : absence de nouvel essai couverte par les tests automatisés ;
- `429` : réponse réelle observée après l’enchaînement des contrôles
  saisonniers, avec arrêt immédiat sans nouvel essai ; le message spécifique et
  le repli sur cache restent également couverts par les tests automatisés ;
- panne réseau et `5xx` : trois tentatives au maximum, couvertes par les tests
  automatisés ;
- repli sur cache, cache absent et message spécifique de quota : couverts par
  les tests automatisés.

Le test réel ne cherche pas à provoquer un dépassement de quota et ne provoque
jamais volontairement une panne du serveur OTF. Le `429` transitoire ci-dessus
a néanmoins permis de confirmer le comportement réel du connecteur. Les pannes
réseau et serveur restent simulées afin de ne pas perturber le service.

## Particularités confirmées du modèle OTF

- `width` et `alleyWidth` des planches sont fournis en centimètres et convertis
  en mètres ;
- la longueur est déjà exprimée en mètres et la surface en mètres carrés ;
- `alleyWidth: null` reste une absence de donnée et s’affiche « Non renseigné » ;
- les lignes `plotList` marquées `zoneFill: true` représentent la surface de la
  parcelle et sont masquées comme jardins techniques ;
- une planche dont le jardin n’est pas présent pour la saison consultée est
  ignorée au lieu d’invalider les autres planches saines ;
- `coordinates` (parcelles et jardins) sert à la vue satellite de S3 : cache
  technique de l'instantané comme les noms, lecture tolérante, un contour
  invalide ou absent n'invalide jamais l'instantané (`docs/satellite-view-contract.md`,
  F201, F202).

## Extension 2.8 : commune météo

`GET /me` est la source de référence de la commune du siège (`legalCity` et
`legalPostcode`). Le module ne la modifie jamais. Elle sert uniquement à créer
une clé technique de géocodage ; si OTF change cette adresse, une nouvelle clé
est calculée et la commune est géocodée de nouveau. Un choix manuel de commune
reste une préférence propre au module et n’écrit rien dans OTF.
