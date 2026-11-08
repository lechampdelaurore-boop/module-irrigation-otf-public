# Recette réelle — alertes météo par culture (5 quinquies)

Commencée le 6 novembre 2026 à 22 h 37 (Paris) et finie le 7 novembre 2026
à 12 h 18, sur la ferme du porteur, dans le navigateur de l'application
Claude sur son ordinateur et sur son téléphone (Android, Chrome). Elle a
commencé sur son « vas-y » (« Alertes météo par culture vas-y ») et s'est
finie sur sa demande (« retente l'alerte météo, voir si ça fonctionne ce
coup-ci »). Version éprouvée au départ : `main` à `a6f9a46`, la 5 quinquies
entière (PR #252 à #254), déployée. Essai final : `main` à `dc9ae36`, avec
#258 et #260 déployées. Contrat : `docs/weather-crop-alerts-contract.md`.
**Les constats sont de l'assistant ; le jugement agronomique reste au
porteur** (D-014).

Ouvre ta ferme est resté en lecture seule du début à la fin. Dans le module,
les rattachements faits sur sa réponse sont gardés : ce sont ses vraies
valeurs (« Les enregistrements », plus bas).

## L'état trouvé (22 h 39)

| Constat | Valeur |
| --- | --- |
| Réglages | gel, arrêt d'arrosage et aspersions actifs ; horizon 3 jours ; microclimat 0 °C |
| Cultures | aucune avec seuil ; 39 sans seuil, toutes « à rattacher » |
| Délais de séchage | aucun |
| Historique | aucune alerte cultures envoyée ; alertes météo de la 5 bis : aucune configurée, aucune envoyée |
| Prévision | vendredi 6 : 4,5 / 10,4 °C ; samedi 7 : 3,3 / 9,8 °C ; dimanche 8 : 1,9 / 11,7 °C ; mise à jour 21 h 50, synchronisation automatique à 06 h 15 |

## Les enregistrements, sur les réponses du porteur

| Heure | Geste | Constat |
| --- | --- | --- |
| 22 h 41 à 22 h 43 | Rattachement de ses 24 légumes au jeu commun (carte 1 sur 3, « Oui, comme proposé ») | 24 cultures avec seuil ; 15 restent sans seuil (13 fleurs, l'endive, l'engrais vert) |

Après les rattachements, « Prochaines échéances » annonce : « Dimanche
8 novembre : minimale prévue 1,9 °C — Patate douce (alerte à 3 °C) ; Tomate
(alerte à 3 °C, sous abri) ». Arrêt d'arrosage : l'ail à 15 jours (jeu
commun), « Aucune date d'arrêt d'arrosage à venir ». Aspersions : aucune.

## Les seuils recalculés à la main

Seuil d'alerte = dégâts + marge + microclimat (0 °C).

| Culture | Affiché | À la main | Alerte le 8 (1,9 °C) |
| --- | --- | --- | --- |
| Tomate (sensible) | 3 °C | 0 + 3 = 3 | oui, 1,9 < 3 |
| Patate douce (sensible) | 3 °C | 0 + 3 = 3 | oui |
| Céleri | 1 °C | −2 + 3 = 1 | non, 1,9 ≥ 1 |
| Chou pommé (rustique) | −1 °C | −3 + 2 = −1 | non |

## La vraie alerte de gel

| Heure | Geste | Constat |
| --- | --- | --- |
| 22 h 47 | « Actualiser la météo » (carte 2 sur 3, « Oui, téléphone prêt et verrouillé ») | deux alertes « Gel · Patate douce » et « Gel · Tomate », texte de 159 caractères ; « Échec du service de notification » : défaut 1 |
| 23 h 56 | Après #258 (carte 3 sur 3, « Oui, maintenant ») : rattachement de la tomate réenregistré à l'identique, puis « Actualiser la météo » | « Gel · Tomate … Tomate (1 culture présente). Sous abri, la température diffère : la prévision est celle de l'extérieur. Envoyée le 06/11/2026 23:56 · Envoyée » ; lien « Voir » vers la météo de la semaine du 2 novembre |
| 23 h 57 | Nouvelle actualisation | aucune nouvelle alerte, « déjà annoncée » : un jour visé ne s'annonce qu'une fois |
| 00 h 02 | À sa demande (« Réessaye »), même geste | « Envoyée » ; sur son téléphone verrouillé, aucune sonnerie, la notification datée de 00 h 09 ; la toucher la ferme sans ouvrir le module : défauts 2 et 3 |
| 7 novembre, 12 h 02 | Après #260, à sa demande, même geste | prévision du matin : minimale 1,6 °C le dimanche 8 ; « Gel · Tomate … 1,6 °C … Envoyée » ; le téléphone n'était pas verrouillé ; la toucher ouvre la page du module : défaut 3 corrigé |
| 12 h 04 | À sa demande, même geste, téléphone verrouillé | la notification arrive à 12 h 04, la minute de l'envoi : le retard du défaut 2 est corrigé ; mais aucune sonnerie |
| 12 h 11 à 12 h 17 | Réglages du téléphone regardés par le porteur, sur l'indication de l'assistant | site du module autorisé ; sa catégorie de notification sur « Alerte », son par défaut ; volume des notifications presque au maximum ; aucun mode « Ne pas déranger » |
| 12 h 18 | À sa demande, même geste, téléphone verrouillé, quatorze minutes après le précédent | la notification arrive et sonne : « là c'est bon » ; défaut 2 corrigé |

Le silence de 12 h 04 n'est pas un défaut du module : le module ne demande
jamais une notification silencieuse, et c'est le téléphone qui décide du
son. La cause la plus probable est la deuxième notification de Chrome en
deux minutes, qu'Android peut rendre silencieuse ; ce n'est pas vérifié.

## Les défauts trouvés, corrigés

1. **Le service d'envoi refusait l'alerte** : son étiquette portait une
   virgule (les noms des cultures), et certains textes passaient
   160 caractères. Corrigé par #258, fusionnée à 23 h 13 et déployée à
   23 h 27 (« Précisions faites à la recette réelle », points 1 à 3).
2. **L'alerte n'arrivait qu'au réveil du téléphone** : envoyée en priorité
   normale, que le téléphone en veille peut retenir. Corrigé par #260 :
   priorité haute pour toutes les notifications du module. Constaté le
   7 novembre à 12 h 04 et à 12 h 18.
3. **La toucher n'ouvrait rien** : le module attendait le chargement de la
   page avant de passer au premier plan. Corrigé par #260 : premier plan
   d'abord, puis la page. Constaté le 7 novembre à 12 h 02.

## Ce qui n'a pas pu être éprouvé

- **Le séchage avant récolte** : aucune récolte d'ail n'est attendue cette
  saison, donc aucune date d'arrêt d'arrosage à annoncer.
- **Les aspersions à reconsidérer** : aucune aspersion de jour sous abri
  dans les prochains jours.

Ces deux alertes sont couvertes par les scénarios du contrat en tests.

## Au jugement du porteur

- L'alerte réelle annonce la patate douce et la tomate en novembre : leur
  présence sur les planches vient d'OTF ; à lui de dire si elles y sont
  encore.
- Les cinq réenregistrements de la tomate à l'identique, à 23 h 56, 00 h 02,
  12 h 02, 12 h 04 et 12 h 18, laissent cinq révisions de plus dans
  l'historique de son rattachement (aucune valeur changée), et cinq alertes
  « Gel · Tomate » pour le même dimanche dans l'historique des alertes.
- Les deux alertes de 22 h 47 restent « Échec du service de notification »
  dans l'historique, comme le veut la règle (une alerte n'est pas renvoyée) :
  l'alerte de la patate douce pour le dimanche 8 n'est donc jamais arrivée
  sur son téléphone.
