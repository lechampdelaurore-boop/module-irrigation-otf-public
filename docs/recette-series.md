# Recette réelle — suivi hydrique par série (5.1)

Faite le 29 septembre 2026 sur la ferme du porteur, version déployée après
la fusion de la troisième PR (#106), dans le navigateur du porteur, après une
actualisation forcée qui a lu le plan de culture depuis Ouvre ta ferme.
Protocole : `docs/series-contract.md`, « Preuve de fin », point 5. **Les
constats sont de l'assistant ; le jugement agronomique reste au porteur.**

## Ce que la vue a montré

| Constat | Valeur | Attendu |
| --- | --- | --- |
| Séries suivies | 223 en cours ou terminées, 18 à venir | — |
| Séries non suivies | 13 : 11 sans semis direct ni plantation, 2 en bloc | 11 et 2, reconnaissance du 26 septembre |
| Avertissement pluie | « la pluie réelle manque sur une partie de la période d'au moins une série » | la météo de la ferme n'est enregistrée que depuis la mi-septembre |

## Trois séries comparées à la main

Les trois sont choisies parce que leurs planches ont reçu de l'eau
enregistrée dans le module — les gag1 du bloc 1 depuis le 31 août, l'aspersion
du tunnel 1 de ce matin — ou n'en ont reçu aucune.

### Mâche #1 — T1-8, en cours

| Ligne | Vue « Séries » | Vue « Par périmètre », T1-8, du 07/09 au 29/09 | À la main |
| --- | --- | --- | --- |
| Période | plantation réalisée semaine 37, dernière récolte attendue semaine 43 ; du 07/09/2026 au 29/09/2026 | — | Ouvre ta ferme : semaines 37 → 43 (`bedStartCalculated` 37, `bedStopCalculated` 43) |
| Irrigation | 10 mm · 0,16 m³ | 10 mm · 0,16 m³ | aspersion de ce matin, 10 mm × 16 m² mouillés × 16 m sur 16 m = 160 L |
| Pluie | 0 mm (abri) | 27,7 mm, 18/23 jours | sous abri : zéro explicite |
| Objectif | 80,7 mm | 80,71 mm | identique, 23 jours d'objectif historisé |
| Écart | +70,7 mm | indisponible (pluie incomplète) | 80,7 − (10 + 0) = 70,7 |
| ET0 | 81,6 mm | 81,61 mm | identique |
| Objectif restant | 74,3 mm jusqu'au 25/10 | — | 26 jours à 20 mm/semaine = 74,3 |

### Cosmos 2 — B1-2 sur 10 m, terminée

| Ligne | Vue « Séries » | Vue « Par périmètre », B1-2, du 04/05 au 20/09 | À la main |
| --- | --- | --- | --- |
| Période | plantation réalisée semaine 19, dernière récolte attendue semaine 38 ; du 04/05/2026 au 20/09/2026 | 21 irrigations dans la sélection | Ouvre ta ferme : semaines 19 → 38 |
| Irrigation | 1 289,5 mm · 9,671 m³ | 1 289,49 mm · 21,277 m³ (planche entière) | 21,277 × 10 m / 22 m = 9,671 m³ ; surface occupée 7,5 m² |
| Pluie | indisponible, 17/140 jours | 22,7 mm, 17/140 jours | absente, signalée |
| ET0 | 68,3 mm | 68,3 mm | identique |
| Objectif | indisponible | indisponible, données incomplètes | pas d'objectif fixé sur toute la période |

### Tomates primeurs à Chloé — T1-1 et T1-2, terminée

| Ligne | Vue « Séries » | À la main |
| --- | --- | --- |
| Période | plantation réalisée semaine 13, dernière récolte réalisée semaine 31 ; du 23/03/2026 au 02/08/2026 ; 2 planches, 32 m | Ouvre ta ferme : semaines 13 → 31 |
| Irrigation | 0 mm · 0 m³ | aucune irrigation enregistrée sur le tunnel 1 avant ce matin |
| Pluie | 0 mm | sous abri |
| ET0 | indisponible | pas de météo avant septembre |

## Défaut trouvé et corrigé le jour même

- **La ligne d'une planche affichait une pluie partielle comme un total** :
  « 22,7 mm » sur B1-2 pour Cosmos 2, somme de 17 jours sur 140, sans le dire,
  alors que la série au-dessus disait « indisponible ». Corrigé : la planche
  ne montre la pluie que lorsque tous ses jours sont là, sinon « — ». Un test
  l'encode.

## Point ouvert, au jugement du porteur

- **La vue « Par périmètre » compte la pluie sur une planche sous abri**
  (27,7 mm sur T1-8), alors que la vue « Séries » applique la règle « zéro
  sous abri » du cahier des charges. Ce n'est pas un défaut des séries : le
  résumé de l'historique par périmètre date de la tranche 2 et n'a jamais
  connu l'abri. Faut-il l'aligner ? Noté dans les points ouverts du registre
  d'état.

## Ce qui n'a pas été fait

- La lecture à 390 px sur la version déployée : le parcours P9 la joue en
  local sur les données de démonstration, et la capture à 375 px a été faite
  sur le serveur local avant la mise en ligne.
