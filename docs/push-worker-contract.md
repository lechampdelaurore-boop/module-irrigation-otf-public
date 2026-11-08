# Contrat du Worker Web Push

Le Worker `cloudflare/irrigation-push` est le seul composant autorisé à
programmer et délivrer les notifications Web Push. L’application ne lui
transmet que des requêtes serveur authentifiées ; aucun secret VAPID ni jeton de
service n’est envoyé au navigateur.

## Frontière serveur

L’application appelle cinq routes versionnées : inscription et retrait d’un
abonnement, programmation et annulation d’une alarme, et, depuis la 5 bis
(31 octobre 2026), envoi immédiat d’une notification (voir « Envoi
immédiat »). Ces appels utilisent
HTTPS, un jeton Bearer serveur et un délai maximal de huit secondes. Sur
Cloudflare, ils passent par la liaison de service `IRRIGATION_PUSH` : un
Worker ne peut pas joindre un autre Worker du même compte par son adresse
publique `workers.dev`. Sans liaison (développement local), l’appel réseau
ordinaire vers `IRRIGATION_PUSH_SERVICE_URL` est conservé. En l’absence de
configuration, le minuteur reste utilisable et l’interface annonce que les
alertes sont indisponibles.

Le Worker refuse les requêtes non authentifiées et valide intégralement leur
JSON. Le contrat navigateur accepte uniquement les fournisseurs Push connus et
les clics de notification ne peuvent ouvrir qu’une URL interne à
`/irrigation` ou à l’une de ses pages, `/irrigation/<page>` (3.8,
`docs/feature-selection-contract.md`, P31) : un seul segment en minuscules et
traits d’union, rien d’autre.

## Persistance et idempotence

- une instance Durable Object `IrrigationAlarm` est identifiée par
  `eventEquipmentId` ;
- toute alarme porte une révision et une alarme plus ancienne ne remplace pas
  une révision plus récente ;
- une instance porte une alarme à la fois : la fin du minuteur, ou, depuis la
  3.7 (31 octobre 2026), le retard d'une irrigation planifiée non démarrée,
  programmée à sa création pour son début plus la tolérance R14 et remplacée
  par l'alarme de fin au démarrage ; la notification du matin du planning
  passe par la même route, une alarme à échéance immédiate sous l'identifiant
  `plan:<calcul>` (`docs/planning-contract.md`, « Les notifications ») ;
- pause, reprise, arrêt et annulation resynchronisent ou retirent l’alarme
  correspondante ;
- un destinataire conserve au maximum vingt abonnements ;
- une même révision délivrée est mémorisée par abonnement afin d’éviter un
  doublon ;
- les abonnements expirés sont retirés ; les échecs transitoires sont retentés
  avec temporisation bornée, au maximum douze tentatives.

Le service worker `public/irrigation-notifications-sw.js` affiche une
notification persistante et sécurise l’URL ouverte au clic. Une panne Push
n’altère jamais l’état métier du minuteur ou de l’historique.

## Priorité et toucher (6 novembre 2026)

Trouvés à la recette réelle de la 5 quinquies, sur le téléphone du porteur :
l’alerte de gel n’est apparue qu’au déverrouillage, et la toucher n’ouvrait
rien. Points tranchés par l’assistant sur son option recommandée (D-060) :

- **Chaque notification part en priorité haute** (en-tête `Urgency: high` de
  la RFC 8030), valable une heure comme avant. En priorité normale, le
  service du téléphone peut garder le message tant que l’appareil dort ; une
  fin d’irrigation ou une alerte de gel n’attend pas. Toutes les
  notifications du module appellent une action : aucune ne part en priorité
  basse.
- **Le toucher amène d’abord le module devant, puis ouvre la page
  annoncée.** Le téléphone n’accorde le droit de passer au premier plan que
  peu de temps après le toucher ; attendre d’abord le chargement de la page,
  long ou bloqué sur un onglet endormi, le perdait. Une fenêtre déjà sur la
  bonne page n’est pas rechargée ; une fenêtre qui ne peut pas changer de
  page reste devant telle quelle ; sans fenêtre du module, ou si elle refuse
  de venir devant, une nouvelle s’ouvre.

## Envoi immédiat

Route `/v1/notifications/send`, ajoutée le 31 octobre 2026 pour les alertes
météo (`docs/weather-alerts-contract.md`, D-050). Elle est authentifiée comme
les autres et valide la notification de la même façon : titre de 80
caractères au plus, texte de 160, étiquette, adresse interne à `/irrigation`
ou à l’une de ses pages seulement. La requête porte le destinataire (l’exploitation), une révision et
un identifiant de notification.

- La notification part tout de suite vers chaque abonnement du destinataire,
  avec la même déduplication par révision et par abonnement que les alarmes.
- La réponse rend le résultat à l’application, qui l’enregistre : `sent` dès
  qu’un appareil l’a reçue (ou l’avait déjà reçue sous la même révision),
  `no-subscriber` quand le destinataire n’a aucun abonnement valable,
  `retrying` après un échec seulement transitoire, `failed` sinon ; avec le
  décompte par appareil.
- Un échec transitoire est retenté par une alarme `IrrigationAlarm` nommée par
  l’identifiant de notification, sous la même révision, à quinze secondes puis
  selon la temporisation bornée des alarmes, douze tentatives au plus ; les
  appareils déjà servis ne reçoivent rien de plus.

## Validation

La suite du Worker couvre l’authentification, les entrées invalides, la
programmation et l’annulation, l’ordre des révisions, la déduplication, les
abonnements expirés et les tentatives de livraison. La suite applicative couvre
le contrat d’abonnement, la liste blanche des URL et le repli sans service
worker ; depuis le 6 novembre 2026, elle fait aussi tourner le service worker
dans un bac à sable pour le toucher d’une notification, et la suite du Worker
vérifie la priorité haute jusqu’à l’en-tête produit par la bibliothèque.

Les tests de livraison remplacent la construction du message par un leurre, ce
qui laissait le chiffrement lui-même sans aucune couverture. Depuis le
20 septembre 2026, deux tests appellent la bibliothèque pour de bon, avec des
clés engendrées à la volée : chiffrement `aes128gcm` avec un corps non vide et
une longueur annoncée exacte (RFC 8291), jeton VAPID signé, visant le serveur du
navigateur et valable au plus vingt-quatre heures (RFC 8292). Une rupture de
l’API ou du format de la bibliothèque devient ainsi visible en intégration
continue, au lieu de se découvrir par une notification muette.

Ces tests ne remplacent pas une recette physique avec téléphone verrouillé ou
navigateur réellement arrêté. Cette vérification reste manuelle et ne doit
jamais être annoncée comme automatisée.
