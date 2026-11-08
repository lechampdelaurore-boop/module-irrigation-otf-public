# Recette réelle — besoin en eau par culture et par stade (5 quater)

Faite le 6 novembre 2026 vers 15 h 10 (Paris), sur la ferme du porteur, dans
le navigateur de l'application Claude sur son ordinateur, sur son « vas-y »
écrit à 15 h 04. Version éprouvée : `main` à `dfcfa09`, l'écran complet (PR
#237, #239, #241, #242 et #243, la dernière déployée à 12 h 48). Contrat :
`docs/crop-water-need-contract.md`, « Preuve de fin ». **Les constats sont de
l'assistant ; le jugement agronomique reste au porteur** (D-014).

La première partie est en lecture seule : rien n'a été modifié chez Ouvre ta
ferme, ni dans le module. Sur l'accord du porteur (15 h 11), une seconde
partie a ensuite éprouvé l'écriture dans le module, chaque geste défait
aussitôt (« Les gestes d'écriture », plus bas). Ouvre ta ferme est resté en
lecture seule du début à la fin.

## La page « Coefficients culturaux »

| Constat | Valeur |
| --- | --- |
| Cultures de référence | 32, toutes utilisables, toutes au jeu commun (aucune durée de la ferme, aucun Kc surchargé) |
| Espèces de la saison 2026 | 78, toutes rattachées (saisie du matin, D-054) |
| Réglages | lissage et ombrage désactivés ; Tunnel 1 à 4 à K_abri 0,80, valeur par défaut ; aucune planche paillée ; aucun filet |

## Quatre séries recalculées à la main

ET0 du jour : 0,6 mm (prévision). Le jour 0 est le lundi de la semaine
d'implantation.

| Série, planche | Culture de référence | Stade affiché | À la main | ETM affichée | À la main |
| --- | --- | --- | --- | --- | --- |
| Chicorée frisée S38 ↹ S39, T1-5 (Tunnel 1) | Salade d'été, CRIIAM, par analogie | « Début croissance active → Récolte » depuis le 4 octobre, dernier stade | plantée semaine 38 (14 septembre), jeu de mars à octobre : 20 j → 4 octobre | Kc 0,70, 0,3 mm | 0,6 × 0,8 × 0,70 = 0,34 |
| Céleri branche #5, T4-4 (Tunnel 4) | Céleri, FAO-56 | « Pleine saison » depuis le 4 novembre, « Fin » le 19 décembre | plantée semaine 36 (31 août) : 25 + 40 = 65 j → 4 novembre ; + 45 j → 19 décembre | Kc 1,05, 0,5 mm | 0,6 × 0,8 × 1,05 = 0,50 |
| Chou kale, B1-10 et B2-10 (plein champ) | Crucifères, FAO-56 | « Fin » depuis le 12 octobre, dernier stade | plantée semaine 32 (3 août), jeu de mars à août : 20 + 30 + 20 = 70 j → 12 octobre ; le Kc de fin vaut jusqu'à la récolte | Kc 0,95, 0,6 mm | 0,6 × 0,95 = 0,57 |
| Carotte primeur 2026-2027, T2-1 et T2-2 (Tunnel 2) | Carotte, CRIIAM | « Semis → 30 j après » depuis le 12 octobre, suivant le 11 novembre | semée semaine 42 (12 octobre) : 30 j après l'implantation → 11 novembre | Kc 0,50, 0,2 mm | 0,6 × 0,8 × 0,50 = 0,24 |

**L'objectif proposé de la semaine** (2 au 8 novembre) : 2,8 mm pour la
chicorée, 4,1 mm pour le céleri, 4,7 mm pour le kale, 2 mm pour la carotte.
Divisé par K_abri × Kc, chacun redonne la même ET0 de la semaine, environ
5 mm (5,0 ; 4,9 ; 4,9 ; 5,0) ; le céleri, un peu plus bas, a passé lundi et
mardi au stade de développement, à un Kc plus faible. Les quatre propositions
sont « complètes ».

**La fiche de la planche T1-5** dit la même chose que la fiche de la série :
stade, Kc 0,70, ETM 0,3 mm, proposé 2,8 mm face à 20 mm, écart −17,2 mm
(−86,1 %), avec l'alerte « s'écarte de plus de moitié de l'objectif
applicable » ; 1,8 mm sur prévision reprise pour un jour passé, 1 mm sur
prévision, sans réanalyse encore pour cette semaine.

## Ce que le porteur a à juger

- **En novembre, les objectifs saisis (20 mm par semaine) sont quatre à dix
  fois plus hauts que le besoin calculé (2 à 5 mm)**, sous abri comme en
  plein champ. Réponse du porteur (15 h 11) : il ne se sert pas des
  objectifs ce mois-ci, ils sont simplement restés à 20 mm. L'écart ne
  signale donc pas un défaut du calcul.
- La chicorée suit la salade d'été par analogie (choix du matin) : son Kc
  de 0,70 au dernier stade est celui de la laitue.

## Les gestes d'écriture, défaits aussitôt

De 15 h 14 à 15 h 18, sur l'accord du porteur (« tant que tu remets dans
l'état dans lequel tu as trouvé »). État de départ noté avant le premier
geste : objectif de toute la ferme 20 mm, seul objectif de la semaine ;
lissage et ombrage désactivés ; aucune planche paillée, aucun filet ;
Tunnel 1 à 4 à K_abri 0,80 par défaut ; 32 cultures au jeu commun.

| Geste | Constat | Défait par |
| --- | --- | --- |
| Paillage plastique posé sur T1-5 | « La planche T1-5 porte un paillage plastique. » ; fiche : « paillage 0,9 », proposé 2,8 → 2,5 mm (2,8 × 0,9) | décocher T1-5 : « n'a plus de paillage plastique », « aucune planche paillée », proposé 2,8 mm |
| Lissage et ombrage activés | « Les options sont enregistrées. », relu après rechargement ; T1-5 inchangée (passage de stade le 4 octobre, aucun filet) | les deux décochés, « désactivé » relu |
| Céleri : développement 40 → 45 j (durées de la ferme) | carte « durées de la ferme », tableau 25 / 45 / 45 / 15 j ; T4-4 au stade « Développement », pleine saison prévue le 9 novembre, Kc 1,03 (0,70 + 42/45 × 0,35), proposé 4,1 → 4 mm | « Revenir aux durées communes » : « jeu commun », 25 / 40 / 45 / 15 j, source FAO-56 rétablie |
| Proposition de T1-5 adoptée (2,8 mm) | « 2,8 mm par semaine deviennent l'objectif de la planche à partir d'aujourd'hui » ; objectif applicable 12,6 mm (20 mm du lundi au jeudi, 2,8 mm du vendredi au dimanche) ; 2 objectifs ciblés ; plan recalculé « après un objectif hydrique changé » | « Tout vider » sur la semaine du 2 au 8 novembre (« 2 objectifs retirés »), puis 20 mm pour toute la ferme : 1 objectif ciblé, objectif applicable de T1-5 de nouveau 20 mm |

**État final**, relu après rechargement : identique à l'état de départ, à
deux traces près, voulues par le contrat. L'adoption reste dans
l'historique de T1-5 (« Propositions adoptées (1) ») : l'historique des
objectifs ne s'efface jamais. Le plan de la semaine a été recalculé à
15 h 17 : 34 propositions, aucune expirée, 48,475 m³, au lieu de 25, dont
9 expirées, et 43,454 m³ au calcul de 6 h 15 ; tout recalcul repropose les
créneaux expirés. Rien n'est validé ; le recalcul du matin suivant refait
le plan.

Non éprouvés en production, parce qu'ils laissent une trace datée qui ne
s'efface pas : surcharge de Kc, K_abri, filet d'ombrage, stade déclaré.
Ils sont prouvés par les parcours P15 à P17 et les tests de la base. Le
rattachement d'une espèce a été éprouvé en production le matin même (78
saisies).

**Un défaut d'affichage relevé** : après un réglage sur la page des
coefficients (paillage, durées), la fiche de la planche déjà ouverte garde
ses anciens chiffres jusqu'à ce qu'on la rouvre ou qu'on recharge la page.
Le calcul est juste ; seule la fiche ouverte n'est pas rafraîchie.

## À 390 px de large

Sur la page « Coefficients culturaux », le formulaire « Régler les durées de
la ferme » du céleri (sept champs) et, dans la vue « Par série », la fiche du
chou kale ouverte : aucun débordement horizontal (390 px pour 390 px), bouton
« Enregistrer les durées » de 44,8 px, aucune erreur de console.

## Non constaté

- **L'ETM enregistrée chaque matin** (PR 3d) : elle s'écrit après la
  synchronisation météo du matin ; la première après la mise en ligne de
  12 h 20 sera celle du 7 novembre. L'écran ne la montre pas ; elle est
  prouvée par `tests/db/crop-water-etm-record.test.ts`.
- **L'avertissement de l'aspersion en début de cycle** : la carotte de
  T2-1 est bien au premier stade du CRIIAM, sur une planche équipée (apport
  cumulé 10 mm/h), mais elle n'a reçu aucune irrigation enregistrée depuis
  son semis : il faut deux irrigations à trois jours ou moins. La fiche de
  T2-1 n'avertit donc pas, comme attendu ; l'avertissement est prouvé par
  `tests/db/crop-water-bed-sheet.test.ts`.
