# Contrat — Surface mouillée en aspersion : planche et passe-pied

Étape 5.0 de la roadmap, prérequis de l'extension « suivi par série
culturale ». Écrit le 28 septembre 2026, avant tout code, d'après la règle 2
de la décision D-022 et la décision D-023 prises le même jour par le porteur.
**Validé par le porteur le 28 septembre 2026**, les trois points qui lui
étaient soumis compris ; ils sont récapitulés à la fin.

## À quoi ça sert

Le module convertit des millimètres en volumes — litres par heure d'un
matériel, mètres cubes d'une irrigation, mètres cubes d'un besoin — en
multipliant par la surface de la planche telle qu'Ouvre ta ferme la donne :
longueur × largeur, **sans le passe-pied**. Vérifié sur la ferme : B1-1,
22 m × 0,75 m, 16,5 m².

C'est juste en goutte-à-goutte : le tuyau ne mouille que la planche. C'est
faux en aspersion : l'arroseur mouille aussi le passe-pied, et cette eau sort
bien du forage. Sur B1-1, avec un passe-pied de 0,45 m, 5 mm d'aspersion
coûtent 26,4 m² × 5 mm = 132 L, pas 82,5 L. Le module sous-estime donc, en
aspersion, la consommation, le débit demandé à la pompe, les volumes tirés des
réserves et ce que la faisabilité compare aux ressources.

La règle du porteur : « par aspersion, on compte toujours la planche et le
passe-pied ; en goutte-à-goutte, uniquement la planche ». Elle vaut pour les
planches d'abord, et l'extension séries la reprendra telle quelle.

## Deux surfaces, jamais confondues

Une planche porte désormais deux surfaces, qui servent à deux choses
différentes :

- la **surface de la planche**, `Bed.area` d'Ouvre ta ferme (D-001), sert à
  **pondérer les millimètres** entre planches : `Σ(mm × m²) / Σ(m²)` au
  niveau du jardin, de la parcelle, de la ferme, et demain de la série. Elle
  ne change pas ;
- la **surface mouillée** sert à **convertir des millimètres en volume ou en
  débit**. Elle dépend du matériel :

      goutte-à-goutte : surface mouillée = Bed.area
      aspersion       : surface mouillée = Bed.area + Bed.length × Bed.alleyWidth

  Le passe-pied (`alleyWidth`) est celui de la planche, fourni par Ouvre ta
  ferme en centimètres et déjà converti en mètres (`docs/otf-contract.md`).
  Sur la ferme, toutes les planches en ont un : 0,45 m ou 0,25 m.

Un passe-pied inconnu (`alleyWidth: null`, affiché « Non renseigné ») rend la
surface mouillée en aspersion **inconnue**, donc `null`, jamais zéro et jamais
la planche seule (D-003). En goutte-à-goutte, le passe-pied ne compte pas et
son absence est sans effet.

La règle vit en un seul endroit, une fonction nommée de `lib/domain/`, qui
prend la planche et la nature du matériel (`sprinkler` ou `drip`,
`EquipmentKind`) et rend la surface mouillée ou `null`. L'interface et la
persistance l'appellent ; aucune autre multiplication par une surface ne
s'écrit ailleurs.

## Où la règle s'applique

Chaque irrigation compte avec la surface de **son propre matériel** : une
planche qui reçoit un goutte-à-goutte et une aspersion la même semaine, ou qui
change de matériel en cours de saison, a deux surfaces mouillées, une par
irrigation.

| Calcul | Aujourd'hui | Demain | Nature |
| --- | --- | --- | --- |
| Apport calculé par heure (panneau « Aperçu instantané » : L/h ou m³/h par matériel, débit total) | `rate × Bed.area` | `rate × surface mouillée` selon la nature du réglage | projection, recalculée à chaque affichage |
| Débit demandé d'une irrigation à la pompe (`requestedFlowCubicMetersPerHour`, aperçu à la création puis instantané enregistré) | `rate × bedAreaSquareMeters` | `rate × surface mouillée de l'application` | enregistré à la création, immuable ensuite (D-006) |
| Volume d'une irrigation : planifiée, en cours, réelle — carte de l'irrigation, journal quotidien d'eau, mouvements de stock des réserves, tableau des semaines, historique, export CSV | `mm × bedAreaSquareMeters` | `mm × surface mouillée de l'application` | dérivé de l'application enregistrée |
| Contrôle de la limite journalière d'irrigation à la création | idem | idem | dérivé |
| Volume du besoin d'une planche (`effectiveVolumeCubicMeters`, 3.3) et dose en mm d'une allocation (3.4) | `mm × Bed.area`, `m³ / Bed.area` | `mm × surface mouillée de la planche`, `m³ / la même surface` (voir ci-dessous) | projection |
| Pondération des millimètres (agrégats 3.3, cumuls 2.9, séries) | `Bed.area` | **inchangé** | — |
| Millimètres affichés, durées du minuteur, objectifs, écarts, ET0, pluie | mm | **inchangé** | — |
| Réserves : pluie reçue et évaporation sur la surface exposée | surface de la réserve | **inchangé** | — |

### La surface mouillée d'un besoin

Le besoin d'une planche est en millimètres ; son volume dépend du matériel qui
l'irriguera. Il est pris parmi les matériels **positionnés** sur la planche
(couverture 2.4) :

- un seul matériel, ou plusieurs de même nature : leur surface mouillée ;
- goutte-à-goutte et aspersion positionnés ensemble : **la plus grande**, celle
  de l'aspersion. La faisabilité est une vérification prudente : elle ne doit
  pas promettre de l'eau qu'une aspersion consommerait ;
- aucun matériel positionné : la surface de la planche, comme aujourd'hui,
  et le « Pourquoi ? » le dit — « planche seule, aucun matériel posé ». La
  faisabilité signale déjà l'absence de chaîne hydraulique ;
- aspersion positionnée sur une planche sans passe-pied connu : volume du
  besoin **inconnu**, la planche compte comme donnée manquante dans le total,
  avec le motif « passe-pied non renseigné ».

La dose en millimètres d'une allocation (m³ → mm) se calcule avec la même
surface que le volume du besoin, pour que l'aller-retour mm → m³ → mm rende
la valeur de départ.

### Une irrigation sans surface mouillée connue

Une aspersion sur une planche sans passe-pied connu :

- une irrigation **réelle** reste toujours enregistrable, avec ses
  millimètres, qui sont la vérité (règle invariante). Son volume est inconnu :
  affiché « — », avec le motif, exclu des totaux qui sont alors marqués
  incomplets, sans mouvement de stock sur la réserve, ce que le journal d'eau
  signale ;
- une irrigation **planifiée ou démarrée** est refusée si une limite
  journalière est active, parce qu'elle ne peut pas être vérifiée — même
  logique qu'une restriction ; sans limite active, elle est acceptée avec le
  même volume inconnu.

Précisé le 4 octobre 2026 (point ouvert 12) : ce refus est **levé** par la
garde de la création, `enforceDailyLimitForCreation` dans
`lib/services/irrigation-limits.ts`, comme l'est un dépassement de limite,
et jamais rendu comme un simple message. L'action « Planifier » et la
validation d'une proposition du planning le reçoivent donc de la même façon et
n'enregistrent rien. Jusque-là, la garde rendait le texte du refus et l'action
enregistrait l'irrigation en l'affichant en avertissement.

Précisé le 9 octobre 2026 (point ouvert 24) : le **démarrage** et la
**reprise** d'une irrigation planifiée obéissent à la même règle, par la garde
`enforceDailyLimitForStart` (`app/irrigation/irrigation-event/limits.ts`) : si
une planche qui reçoit de l'eau n'a pas de surface mouillée connue et qu'une
limite journalière active s'applique à l'un des jours que le reste de
l'irrigation couvrirait, le démarrage est refusé, même quand l'irrigation a
été planifiée avant que la limite existe. Le jour limité se cherche en un seul
endroit, `firstLimitedDay` dans `lib/domain/water-management.ts`, pour la
création comme pour le démarrage. Jusque-là, la garde du démarrage ne jugeait
que le volume connu — nul quand toutes les planches sont inconnues — et
laissait partir l'irrigation.

Le remède est dans Ouvre ta ferme : renseigner le passe-pied.

## Persistance

Une application d'irrigation (`irrigation_bed_applications`) porte déjà
`bed_area_square_meters`, la surface de la planche à la création, et
l'événement porte la nature du matériel dans son instantané
(`equipmentSnapshot.kind`). Une migration additive
`drizzle/0016_bed_application_wetted_area.sql` ajoute :

- `wetted_area_square_meters REAL NULL`, avec la contrainte `NULL OR > 0` ;
- un remplissage des lignes existantes : `wetted_area_square_meters =
  bed_area_square_meters`.

C'est la décision D-023 : **les volumes déjà enregistrés restent tels quels**.
Une irrigation d'aspersion enregistrée avant cette étape garde le volume et le
débit demandé calculés à l'époque, sur la planche seule ; l'historique est
immuable (D-006). Après la migration, `NULL` veut dire une seule chose :
surface mouillée inconnue au moment de l'enregistrement — jamais « ligne
ancienne ».

`bed_area_square_meters` garde son nom et son sens, la surface de la planche,
et continue de pondérer les millimètres. Aucun renommage.

Le type du domaine (`IrrigationBedApplication`) gagne
`wettedAreaSquareMeters: number | null`. Les instantanés de débit demandé
(`requested_flow_cubic_meters_per_hour`) et de pompe ne changent pas.

Conséquence assumée, visible dans l'historique : deux irrigations d'aspersion
de la même planche, mêmes millimètres, l'une avant et l'autre après cette
étape, affichent deux volumes différents. Le détail de chaque irrigation montre
la surface mouillée retenue, pour que l'écart s'explique de lui-même.

## Interface

Pas de nouvel écran. Trois lignes de plus, lisibles à 390 px sans défilement
horizontal :

- « Voir le calcul » d'une planche, toujours disponible, et le pied du
  « Pourquoi ? » : « Surface mouillée : 26,4 m² — aspersion, planche et
  passe-pied » ou « 16,5 m² — goutte-à-goutte, planche seule », ou le motif
  quand elle est inconnue ou prise sur la planche seule. Le tableau des
  besoins se recalcule dès qu'un placement change, puisque la surface en
  dépend ;
- détail d'une irrigation : la surface mouillée retenue et la nature du
  matériel ;
- panneau « Aperçu instantané » : rien de nouveau à écrire, mais les débits
  des aspersions augmentent. Sur la ferme, les tunnels sont en aspersion : les
  quatre « Rampe de serre » et le débit total, 29,35 m³/h le 28 septembre
  2026, changeront à la mise en ligne. Un nombre à relever avant, pour la
  recette.

## Ce qui ne change pas

Les millimètres, partout : objectif, pluie, irrigation, écart, besoin, dose.
La pondération des millimètres par la surface de la planche. Les durées du
minuteur, qui se calculent en mm/h. Les volumes des réserves, pluie et
évaporation sur leur surface exposée. Les enregistrements existants. Le
connecteur OTF : `alleyWidth` est déjà lu, aucune route nouvelle.

## Cas limites

| Cas | Réponse |
| --- | --- |
| Passe-pied inconnu, goutte-à-goutte | Sans effet : surface de la planche |
| Passe-pied inconnu, aspersion | Surface mouillée inconnue, volume inconnu et signalé, jamais zéro ni planche seule (D-003) |
| Passe-pied à `0` | Valeur valide : surface mouillée égale à la planche ; un zéro reçu est un zéro |
| Planche sans longueur ou sans largeur connue | Déjà sans surface aujourd'hui ; inchangé |
| Deux matériels de natures différentes positionnés sur la planche | Besoin : la plus grande surface ; irrigation : chacune la sienne |
| Matériel changé de nature après l'enregistrement | Sans effet : l'application garde sa surface mouillée (D-006) |
| Réglage d'aspersion à profil, apport variable le long de la planche | Le taux mm/h au centre de la planche, comme aujourd'hui ; seule la surface change |

## Preuve de fin

1. **Tests du domaine** : la fonction de surface mouillée — goutte-à-goutte,
   aspersion, passe-pied `null`, passe-pied `0` ; l'apport par heure d'un
   matériel d'aspersion inclut le passe-pied et celui d'un goutte-à-goutte
   non ; le débit demandé d'une irrigation ; le volume d'un besoin selon les
   matériels positionnés, dont le cas mixte et le cas sans matériel ;
   l'aller-retour mm → m³ → mm d'une allocation ; un volume inconnu exclu et
   signalé dans un total.
2. **Tests de persistance** (Q2) : la migration remplit les lignes existantes
   avec la surface de la planche et le test de dérive passe ; une application
   nouvelle enregistre sa surface mouillée, `NULL` quand elle est inconnue ;
   la lecture rend les deux surfaces.
3. **Parcours navigateur** (Q5) : sur les données de démonstration, la planche
   N01 (30 m × 0,75 m, passe-pied 0,45 m) vaut 22,5 m² en goutte-à-goutte et
   36 m² en aspersion ; le panneau « Aperçu instantané » et le « Pourquoi ? »
   le montrent aux deux largeurs.
4. **Recette réelle** sur la ferme, après mise en ligne : relever avant
   déploiement le débit total et celui d'une rampe de serre ; après, vérifier
   à la main le nouveau débit d'une rampe (taux × surface mouillée des
   planches couvertes) ; enregistrer une irrigation réelle d'aspersion et
   une de goutte-à-goutte et recalculer leurs m³ ; vérifier qu'une irrigation
   enregistrée avant l'étape affiche le même volume qu'avant.
5. `docs/irrigation-needs-contract.md` (« surface de la planche » →
   surface mouillée pour le volume, surface de la planche pour la
   pondération), `docs/irrigation-feasibility-contract.md` (dose en mm) et
   les registres à jour.

## Points tranchés par le porteur

Validés le 28 septembre 2026, le jour de l'écriture du contrat.

1. ✅ Le volume d'un besoin prend la plus grande surface mouillée quand
   goutte-à-goutte et aspersion sont positionnés ensemble sur une planche.
2. ✅ Une aspersion sur une planche sans passe-pied connu donne un volume
   inconnu et signalé ; une irrigation planifiée ou démarrée est refusée
   seulement quand une limite journalière ne peut pas être vérifiée, au
   démarrage et à la reprise comme à la création (9 octobre 2026, point 24).
3. ✅ Les lignes existantes reçoivent leur surface de planche comme surface
   mouillée (D-023), et l'historique montre la surface retenue pour que la
   différence entre deux irrigations se lise.

## Hors périmètre

Les séries (5.1) ; un volume de pluie par planche ; l'allée d'une série
(`Place.area`), qui n'est pas le passe-pied de la planche ; toute écriture vers
Ouvre ta ferme ; un recalcul des volumes enregistrés.
