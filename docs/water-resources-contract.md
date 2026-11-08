# Sous-tranche 3.1 — Ressources en eau et réserves

## Périmètre

La sous-tranche 3.1 décrit la disponibilité physique de l’eau. Elle ne contient ni pompe, ni pression, ni diamètre de canalisation, ni perte de charge, ni moteur de planning. Les connexions entre réserves sont enregistrées comme une topologie ; leur hydraulique détaillée reste hors du périmètre de la 3.2.

## Propriété et isolation

Toutes les données sont rattachées à `irrigation_workspaces`. Les lectures et écritures passent par des repositories qui vérifient le propriétaire ChatGPT côté serveur. Les données OTF restent en lecture seule et ne sont pas recopiées dans ce domaine.

## Ressources

Une ressource possède un identifiant stable, un nom unique dans l’espace de travail, un type, un débit nominal fixe en m³/h, un état, une période facultative de disponibilité et des notes. Une limite de prélèvement en m³/jour est historisée sous forme de révisions distinctes de la limite d’irrigation de 2.8.

Une ressource peut alimenter plusieurs réserves. Plusieurs ressources peuvent alimenter la même réserve. Une ressource peut aussi être choisie comme alimentation directe par défaut de l’irrigation sans créer de réserve virtuelle.

## Réserves et stock

Une réserve possède une capacité, un minimum de sécurité, une surface exposée, des paramètres de pluie et d’évaporation, ainsi qu’un volume courant éventuellement inconnu. `NULL` signifie « Non renseigné » et ne doit jamais être converti en zéro.

Une correction manuelle modifie la valeur matérialisée et écrit simultanément un mouvement append-only contenant la date, l’ancien volume, le nouveau volume, l’écart, le motif facultatif et l’auteur. Les autres mouvements prévus par le schéma sont : apport d’une ressource, pluie, irrigation, évaporation, débordement et transfert.

## Liaisons

- Ressource → réserve : mode `automatic` ou `manual`, actif ou inactif.
- Réserve → réserve : sens explicite, mode `automatic` ou `manual`, actif ou inactif.
- Alimentation d’irrigation par défaut : une ressource directe ou une réserve.

Les cycles de réserves sont refusés. Une connexion réserve → réserve n’est jamais interprétée comme un transfert instantané ou illimité dans les projections 3.1.

## Calculs

- Pluie : `pluie (mm) × surface exposée (m²) / 1000`.
- Perte estimée par évaporation : `ET0 (mm) × surface exposée (m²) / 1000 × coefficient`.
- Mobilisable : `max(0, volume − minimum de sécurité)`.
- Débordement d’un mouvement réel : `max(0, volume avant + apport − capacité)`.

ET0 reste une base d’estimation et non une mesure directe de l’évaporation d’un bassin. Les prévisions météo ne modifient jamais rétroactivement le stock observé.

## Projections

Les horizons proposés sont 24 h, 48 h, 7 jours et une date/heure personnalisée. Les calculs sont déclenchés à la demande et répartissent les limites journalières selon le fuseau `Europe/Paris`, y compris lors d’un passage de minuit ou d’un changement d’heure.

La disponibilité théorique (sans planifications) et la disponibilité après irrigations planifiées sont affichées séparément. Depuis la 3.4, le helper commun avec 3.3 retient uniquement le reliquat situé dans l’horizon futur, en utilisant l’origine enregistrée avec l’irrigation. Une origine absente reste inconnue : le volume est réservé une fois sur le total, et non affecté arbitrairement à une réserve. Le moteur accepte encore les anciens appels sans `sourceKey`, qui utilisent le défaut de la ferme ; `sourceKey: null` signifie explicitement inconnu.

Lorsqu’une même ressource automatique alimente plusieurs réserves sans règle de répartition, son potentiel est signalé comme partagé et n’est pas distribué arbitrairement. Les transferts détaillés restent hors du modèle simple de pompes 3.2.

### Soldes disjoints pour la faisabilité 3.4

`projection.pools` expose tous les stocks hors sécurité et les reliquats des ressources. Un apport automatique accepté par une réserve est retiré du potentiel de sa ressource. Le stock actuel est déjà inclus dans le prévisionnel : ils ne doivent pas être additionnés.

Les réservations non couvertes le premier jour sont reportées sur les apports suivants. Le reliquat non couvert à la fin de la période, ainsi que les origines inconnues, restent réservés globalement via `reservedUnassignedCubicMeters`. Il est soustrait une seule fois de la somme des pools. Les limites par ressource tiennent compte des prélèvements réels de chaque date locale, y compris les mouvements de retrait signés négativement.

Un stock inconnu ou une évaporation non vérifiable rend le pool de la réserve inconnu ; ses sources de remplissage automatique sont elles aussi signalées inconnues, car leur reliquat ne peut être garanti. Les projections ne réécrivent aucun mouvement réel. La conservation volumétrique reste préliminaire et ne promet pas la disponibilité à une heure donnée.

## Préparation de 3.2

Les réserves et ressources ont des identifiants stables et des relations plusieurs-à-plusieurs. Aucune contrainte ne limite une réserve à une future pompe unique. Le futur domaine pourra référencer plusieurs origines et plusieurs consommateurs sans réécrire les objets de 3.1.
