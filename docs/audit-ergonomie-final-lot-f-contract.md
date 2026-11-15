# Contrat court — audit ergonomique final, lot F : la démonstration (24 undecies)

Écrit le 15 novembre 2026 en Sonnet 5.5 · Moyen, sans code, sans PR,
d'après `docs/ROADMAP.md` (ligne 24 undecies) et le rapport
`audit-ergonomie-final-2026-11-14.md` (points **J1, J16**, le jeu de données
du **choix n° 4**, et **J9 côté démonstration**, D-117). Les causes ont été
**lues dans le dépôt** (`main` à #67) ; ce qui reste à confirmer en codant
est dit « à confirmer ».

**Choix n° 4 : oui aux trois parties (recommandation retenue)** :
compléter les fermes de la démonstration, y compris un objectif « ferme
entière » et une alerte de gel déjà posée, et ne proposer que les moments qui
ont un sens. Les points J1 et J9 n'ont pas besoin de lui. Le lot touche la
démonstration seulement, jamais la ferme réelle ; il suit le contrat
`docs/demo-guided-contract.md` (validé le 8 novembre 2026, D-096), dont il
ne change aucune règle de garde-fou (l'espace par invité, la remise à zéro,
la garde des envois sortants).

**Accord du porteur (15 novembre 2026, 15 h 51, heure de Paris)** : « Je
suis d'accord avec toutes tes propositions. Toutes les recommandations. »,
puis « Point numéro 2, vas-y. » (D-137). Toutes les recommandations de ce
contrat sont retenues, et le code a son « vas-y ». Versé au dépôt par la
PR 1 du lot, en Opus 5.5 · Élevé (la ligne 24 undecies), les numéros recalés
sur le dépôt.

Affichage et jeu de données de démonstration seuls : aucun calcul, aucune
migration, rien qui sorte du mode démonstration. Logiciel multi-fermes : une
ferme fictive n'est la ferme de personne.

Registres (recalés sur le dépôt : le lot A en occupe jusqu'à D-141 et F287,
et D-142 consigne le contrat de la Tranche 4) :
décisions **D-143 et suivantes** (une par PR), précisions **F288 et
suivantes** ; parcours `e2e:demo` (V1 à V8) relus et étendus.

## 1. Livraison en trois PR, une à la fois

| PR | Point | Fichiers principaux | Preuve |
| --- | --- | --- | --- |
| 1 · La barre en une ligne | J1 | `app/irrigation/shell/demo-banner.tsx`, `app/irrigation/styles/demo.css`, `app/irrigation/shell/guided-tour.tsx` | `e2e:demo` à 390 et 1280 px |
| 2 · Un seul nom, des moments qui ont un sens | J9 démo, J16 | `lib/domain/demo/catalogue.ts`, `lib/adapters/demo/farms.ts`, `lib/domain/demo/tours.ts` | tests du catalogue ; `e2e:demo` |
| 3 · Le jeu de données complété | choix n° 4 | `lib/services/demo-space.ts`, `lib/adapters/demo/module-data.ts` | tests du service ; `e2e:demo` |

Chaque PR : `lint`, `typecheck`, `test`, `build`, `knip`, `push:check`,
`weather:check`, `e2e` et `e2e:demo` collés ; registres dans la même PR ; la
première verse ce contrat.

## 2. Ce qui ne change pas

Les garde-fous de la démonstration (aucun envoi sortant, un espace par
invité, la remise à zéro après confirmation) ; la page « Aujourd'hui », le
planning et la pénurie (lots A et B) ; les moments eux-mêmes, leurs dates et
l'heure simulée (C3) ; les visites guidées, sauf quand un moment qu'elles
désignent disparaît pour un profil (voir 4) ; les témoins `demo-profil` et
`demo-moment`, dont un moment devenu absent retombe déjà sur le premier
(`resolveDemoChoice`).

## 3. J1 — La barre de la démonstration en une ligne au téléphone

**Cause établie dans le code.** `DemoBanner` affiche d'office, sur toutes les
pages, le texte de `DEMO_BANNER_TEXT`, deux listes (« Ferme », « Moment »), le
bouton « Remettre à zéro » et les visites guidées : 265 px sur 844 au
téléphone (31 %), selon le rapport.

1. **À 600 px et moins**, une ligne de 44 px : « Démonstration ·
   Maraîchage diversifié · Pic d'été », puis le bouton **« Changer »**. Les
   noms de la ligne sont des noms courts du profil et du moment, tenus dans
   le catalogue à côté des noms longs (F290). Le texte « données fictives,
   rien ne touche une vraie ferme » reste lu par un lecteur d'écran et
   visible dans le détail ouvert (F288).
2. **« Changer »** ouvre le reste (les deux listes, la remise à zéro, les
   visites guidées) sous la ligne, comme un détail ; fermé par défaut, replié
   à chaque changement de page (F289). Rien n'est retiré, aucune règle de la
   bannière (permanente, sans bouton de fermeture) ne change.
3. **Au-dessus de 600 px**, rien ne change.
4. La bannière reste **au-dessus de la barre du haut** et garde 44 px de
   hauteur de cible (charte).
5. **Les visites guidées** qui présentent un élément du détail (le choix de
   la ferme, le bouton des visites, la remise à zéro) l'ouvrent d'elles-mêmes
   au téléphone, et le focus rendu à la fin d'une visite retrouve le bouton
   « Visites guidées » (F291) : une étape n'est jamais sautée parce que le
   détail était fermé.

## 4. J9 côté démonstration et J16

**J9 — un seul nom pour la ferme.** La ferme du profil « Maraîchage
diversifié » porte trois noms : « Ferme de démonstration » (`access-auth.ts`
et `mock-data.ts`, l'en-tête), « Maraîchage diversifié » (le profil de la
démonstration, la bannière) et « Ferme des Trois Noues » (`farms.ts`, le nom
du périmètre dans l'historique). Règle (F292) : **le nom de la ferme fictive
est celui de l'exploitation** (« Ferme des Trois Noues »), partout où le
module dit le nom de la ferme (en-tête, périmètre analysé, exports) ; le
**nom du profil** (« Maraîchage diversifié ») ne reste que dans la liste de la
bannière, comme description. À confirmer au code : l'en-tête reprend bien
`access-auth.ts` (« Ferme de démonstration ») hors démonstration, auquel cas
seule la démonstration change de nom, jamais l'accès normal.
Le lot E (J9) a déjà aligné les mots d'une page à l'autre ; ce point ne
reprend que le nom de la ferme.

**J16 — des moments qui ont un sens pour chaque ferme.** Cause : les quatre
profils réutilisent les quatre moments (`ALL_MOMENTS`) alors que
« Petite exploitation » n'a ni planning, ni réserve, ni alertes, et que « Le
matériel et les alertes seulement » n'a ni pénurie ni historique cochés.
Résultat : « Pic d'été, l'eau manque » donne « Rien d'urgent » sur une ferme
qui n'a rien de ce qui manque.

Règle (F293) : chaque profil ne propose que les moments qui montrent ce que
son nom promet.

| Profil | Moments conservés | Retirés | Pourquoi |
| --- | --- | --- | --- |
| Maraîchage diversifié | les quatre | aucun | planning, réserve, alertes, historique cochés |
| Petite exploitation | début d'été, automne | gel du printemps, pic d'été | ni alertes, ni planning, ni réserve cochés |
| Matériel et alertes | gel du printemps, début d'été | pic d'été, automne | alertes météo cochées, mais ni pénurie ni historique |
| Ferme vierge | début d'été (déjà seul) | — | inchangé |

Le champ `shows` de chaque moment est réécrit **par profil** quand le texte
général ne dit pas la vérité (F294 ; « Le planning propose et place tous les
arrosages » n'est pas vrai de la petite exploitation). Les visites guidées
dont le `bestWith` désigne un couple retiré sont déplacées vers un couple
conservé (à confirmer à la lecture de `lib/domain/demo/tours.ts`).

**Point d'arrêt.** Retirer un moment d'un profil casse les parcours
`e2e:demo` qui le choisissent (le rapport a lui-même capturé
« petite-ferme · pénurie »). La PR 2 relit **chaque** parcours qui désigne un
couple retiré avant de l'enlever, et le dit en clair dans la PR.

## 5. Le jeu de données (choix n° 4 du rapport)

**Causes établies dans le code.** `adoptProposals` (`demo-space.ts`) adopte,
planche par planche, la proposition du module quand elle est complète, et
laisse sans objectif toute planche dont la proposition est incomplète. Aucun
objectif n'est posé sur le périmètre **« ferme entière »** (la valeur
`farm` de `goal-scope-choices.ts`), d'où « objectif non fixé (ferme entière)
» sur « Aujourd'hui » (R2, lot A). Aucune alerte de gel n'est posée pour la
ferme « matériel et alertes » (`module-data.ts`, `saveSpecies` ne pose des
liens de gel que pour les profils qui cochent « Alertes cultures »), d'où
« Aucune de vos alertes météo ne se déclenche » alors que la minimale est à
−2,4 °C (J14).

Règles, **sans chiffre agronomique inventé** :

1. **Maraîchage diversifié** : un objectif posé sur le périmètre « ferme
   entière » **seulement si le module sait en proposer un sans valeur
   saisie** (la même règle que `adoptProposals`) ; sinon, aucun objectif
   n'est inventé, et la ferme reste « Objectifs posés sur n planches sur N »
   (le lot A rend cet état lisible). Les planches sans proposition complète
   sont recensées et la cause dite en une ligne dans le jeu (par exemple une
   culture sans Kc) (F296).
2. **Matériel et alertes** : le modèle d'alerte « Gel : moins de 3 °C »
   **posé d'avance** sur la ferme (le même geste que la page « Alertes
   météo », jamais une règle écrite en dur), de sorte que la nuit de gel
   déclenche bien l'alerte (F295).
3. Chaque ferme garde les cases qu'elle coche : aucune fonctionnalité n'est
   ajoutée à un profil pour « remplir » un moment.
4. Le jeu reste **fictif, versionné, remis à zéro** par « Remettre à zéro »
   comme tous les autres (D4) ; rien ne touche la ferme réelle.

**À confirmer au code avant de promettre un chiffre** : si l'objectif de la
ferme entière exige une valeur saisie (non une proposition), c'est un chiffre
agronomique, **réservé au porteur** ; la règle 1 s'applique alors (aucun
objectif inventé), et la PR 3 le lui dit avant tout code.

## 6. Cas chiffrés

| Cas | Entrée | Attendu |
| --- | --- | --- |
| 1 | Bannière à 390 px, page « Aujourd'hui » | une ligne de 44 px ; le premier écran reprend les 220 px et plus gagnés |
| 2 | « Changer » ouvert à 390 px | les deux listes, la remise à zéro, les visites, sans défilement de côté |
| 3 | Bannière à 1280 px | identique à aujourd'hui |
| 4 | Profil « Petite exploitation » | les moments proposés : début d'été et automne seulement |
| 5 | Témoin sur un moment retiré du profil | retombe sur le premier moment du profil, sans erreur |
| 6 | Maraîchage, en-tête, historique et exports | un seul nom de ferme |
| 7 | Matériel et alertes, nuit de gel | l'alerte « Gel : moins de 3 °C » se déclenche ; « Aujourd'hui » ne dit plus « aucune alerte » |
| 8 | Maraîchage, « Aujourd'hui » | plus de « objectif non fixé » sans raison dite |
| 9 | « Remettre à zéro » | rend le jeu complété, pas le jeu d'avant |
| 10 | Visite « Bienvenue » au téléphone, détail fermé | les sept étapes, dont le choix de la ferme, les visites et la remise à zéro |

## 7. Précisions

| N° | Précision | Choix retenu |
| --- | --- | --- |
| F288 | Seuil de la ligne unique | 600 px, comme le menu |
| F289 | Le détail de la bannière | fermé par défaut, replié à chaque page |
| F290 | Les noms de la ligne | un nom court du profil et du moment, dans le catalogue ; les listes gardent les noms longs |
| F291 | Une visite et le détail fermé | la visite ouvre le détail pour présenter un élément qui s'y trouve, et y rend le focus |
| F292 | Nom de la ferme fictive | celui de l'exploitation, partout ; le profil reste le nom de la liste |
| F293 | Moments par profil | selon le tableau de la section 4 |
| F294 | `shows` par profil | réécrit quand le texte général est faux |
| F295 | Gel déjà posé | le modèle de la page « Alertes météo », posé d'avance |
| F296 | Objectif « ferme entière » | seulement si le module le propose sans valeur saisie |

**Agronomie** : néant, sauf si l'objectif « ferme entière » demande une
valeur saisie (alors la valeur revient au porteur, et rien n'est inventé).

## 8. Ce que le lot ne prouve pas

La démonstration jouée par une personne extérieure (Nicolas, une autre
ferme) ; la lecture par un lecteur d'écran ; le comportement sur un vrai
téléphone.
