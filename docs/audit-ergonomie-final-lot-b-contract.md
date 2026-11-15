# Contrat court — audit ergonomique final, lot B : pénurie lisible (24 decies)

Écrit le 15 novembre 2026, la nuit, avant tout code, en Opus 5.5 · Élevé (la
ligne 24 decies de la roadmap), sur le mandat d'autonomie de nuit du
porteur (« pousse du code en autonomie toute la nuit si nécessaire ») :
chaque précision, aucune agronomique, suit l'option recommandée et reste
modifiable par lui. Il couvre les points **R3, R4, R5 et J7** du rapport
`audit-ergonomie-final-2026-11-14.md` (D-117) et les **remarques 2, 4 et 5
de la recette 3.9** (rapport, section 5.2). **Affichage seul** : aucun
calcul de pénurie, de part, de manque ni de dose ne change ; aucune donnée,
aucune migration. Logiciel multi-fermes : les règles visent un état du plan
ou de la faisabilité, jamais une ferme.

Registres : décisions **D-122 et suivantes** (une par PR), précisions
**F243 et suivantes** ; parcours étendus, sans parcours nouveau : P32 (le
planning en pénurie), P7 (la répartition), P12 (la limite posée après
coup), P10 et P31 (le titre des planches non servies).

**Hors du lot, attend le porteur** : le bouton « Répartir l'eau » sur la
page « Aujourd'hui » (R4, première moitié) touche le contrat de la page
validé le 8 novembre 2026 et va avec le lot A (choix n° 2) ; le reste de
R4 se fait ici.

## 1. Livraison en sept PR, une à la fois

| PR | Point | Fichiers principaux | Preuve |
| --- | --- | --- | --- |
| 1 · Une phrase d'action | R3 | `planning/weekly-plan-view.tsx`, `irrigation-feasibility-dashboard.tsx`, `lib/domain/planning/shortage-reading.ts` | tests du domaine ; P32, P7 |
| 2 · Répartir l'eau | R4 | `planning/page.tsx`, `ressources/page.tsx`, `shortage-reading.ts` | tests du domaine ; P32 |
| 3 · Le nom de la culture | R5 | `arbitration-plan.tsx`, `lib/domain/arbitration-crops.ts` | tests du domaine ; P7 aux deux largeurs |
| 4 · Seul le manque compte en rouge | J7 | `planning/weekly-plan-view.tsx`, `action-summary.ts`, `phone-week.ts`, la feuille du planning | tests du domaine ; P10, P31, P32 |
| 5 · L'eau reçue sans part | remarque 2 | `shortage-reading.ts`, `planning/weekly-plan-view.tsx` | le jeu S12 du moteur (le cas B7 de la recette) |
| 6 · Après l'eau validée | remarque 4 | `shortage-reading.ts`, `planning/weekly-plan-view.tsx` | tests du domaine ; P32 (une proposition validée) |
| 7 · Le jour au-delà de sa limite | remarque 5 | `planning/weekly-plan-view.tsx` | tests du domaine ; P12 (la limite posée après coup) |

Chaque PR : `lint`, `typecheck`, `test`, `build`, `knip`, `push:check`,
`weather:check` et `e2e` collés ; registres dans la même PR ; la première
verse ce contrat et consigne le déploiement de #55.

## 2. Ce qui ne change pas

Le moteur du planning, la faisabilité, l'arbitrage et leurs nombres ; les
motifs du moteur ; ce que font les boutons ; les fenêtres de confirmation ;
la page « Aujourd'hui » (lot A) et la démonstration (lot F) ; les mots des
tuiles qui restent (lot E, J9), dont « Temps de pompage manquant », exprimé
en m³ (rapport, R3), qui va avec J9.

## 3. R3 — Une phrase d'action, le détail du calcul dans un repli

**Cause établie dans le code.** Au planning, sous les tuiles, deux notes
s'affichent d'office (`waterDeficitExplanation`, `arbitrationNote`, dans
`PlanSummaryCards`) : l'écart entre « demandés », « placés » et « manque
d'eau », puis la note de l'arbitrage. Rien ne dit en une phrase ce qui
manque ni ce qu'il faut faire. Sur « Ressources », la faisabilité aligne
huit tuiles (`IrrigationFeasibilityDashboardView`) avant l'écran de
répartition, qui a déjà les siennes, et un bloc par niveau de priorité,
même sans planche ou sans besoin (`PriorityPanel`).

1. **Au planning, une phrase d'action** en tête du résumé, quand l'eau
   manque (le manque d'eau du plan chiffré au litre au moins, ou sûr sans
   volume pour une planche au volume inconnu, D-098 ; une chaîne à l'eau
   inconnue n'est pas un manque, D-089) : « Il manque 0,37 m³
   d'eau d'ici dimanche : 5 planches ne recevront pas tout leur besoin. »
   Sous une répartition validée : « Votre répartition s'applique : il
   manque 0,37 m³ d'eau d'ici dimanche, 5 planches ne recevront pas tout
   leur besoin. » Le volume se lit comme la tuile « Manque d'eau » (« au
   moins », « non chiffré ») ; les planches sont celles qui gardent un
   manque d'au moins un centième de millimètre, hors celles qu'aucun
   matériel n'arrose (un réglage à faire, jamais un manque d'eau). Aucune
   phrase sans manque d'eau (F243).
2. **Les deux notes du calcul** passent dans un repli fermé « Le détail du
   calcul », sous les tuiles ; leur texte ne change pas (F244).
3. **Sur « Ressources », quatre tuiles au plus.** Quand un niveau attend
   un choix (l'écran de répartition s'affiche, avec ses quatre tuiles :
   eau disponible, besoin, part servie, planches servies), la faisabilité
   n'affiche aucune tuile de plus. Sinon, quatre : « Eau disponible »
   (la disponibilité prévisionnelle d'ici dimanche soir), « Besoin de la
   semaine » (les besoins totaux), « Part servie » (le taux de
   couverture), « Planches servies en entier » (« 3 sur 5 », parmi les
   planches qui ont un besoin). Les huit tuiles d'avant, les ressources
   prises en compte et le volume supplémentaire potentiel passent dans un
   repli fermé « Le détail du calcul », sans changer de texte (F245).
4. **Aucun bloc de priorité vide** : un niveau dont aucune planche n'a de
   besoin (aucune planche, ou toutes « Aucun besoin ») ne s'affiche pas ;
   une planche aux données insuffisantes garde son niveau visible (D-003)
   (F246).

## 4. R4 — Répartir l'eau, la répartition en tête de « Ressources »

**Cause établie dans le code.** Le planning ne renvoie nulle part vers
l'écran de répartition ; sur « Ressources », la faisabilité est la
dernière section (`app/irrigation/ressources/page.tsx`), après les
ressources, les liaisons, les pompes : 11 000 px au téléphone.

1. **« Répartir l'eau »** (« Revoir la répartition » sous une répartition
   validée) termine la phrase d'action du planning, un lien de 44 px de
   haut vers la faisabilité de « Ressources » (`#repartition`) ; seulement
   quand la partie « faisabilité » est cochée (F247).
2. **Sur « Ressources », la faisabilité passe en tête de page tant qu'une
   décision est en attente** : le dernier plan de la semaine manque d'eau
   et aucune répartition validée ne s'y applique. Sinon, l'ordre d'avant.
   Le plan enregistré en décide, déjà lu sans calcul : la faisabilité,
   elle, ne se calcule qu'à l'approche de sa section (F248).
3. **Le bouton « Répartir l'eau » sur « Aujourd'hui »** n'est pas fait ici
   (voir plus haut).

## 5. R5 — Le nom de la culture sur la ligne de la planche

**Cause établie dans le code.** La frise écrit le nom au début de chaque
bande (`ArbitrationTimeline`) ; au téléphone, la bande est décalée pour ne
montrer que huit semaines, et une culture commencée avant elles perd son
nom. La ligne de la planche ne porte que son nom et sa surface ; la phrase
de la semaine ajoute le stade et le Kc.

1. **Les cultures en place s'écrivent à côté du nom de la planche**,
   « A01 · Tomate », à toutes les largeurs ; « planche nue » quand le plan
   de culture n'en a aucune ; rien quand le plan de culture n'est pas lu
   (F249).
2. **Le Kc quitte la phrase de la semaine**, qui garde le stade ; il reste
   dans l'infobulle de la cellule, pour les experts, comme les numéros des
   règles (F48) (F250).

## 6. J7 — Seules les planches en manque se comptent en rouge

**Cause établie dans le code.** La tuile, la ligne du téléphone et le
titre du pli comptent toutes les planches « non servies »
(`isBedUnplaced`), y compris celles qui n'ont rien à recevoir (« Sans
objectif », manque nul) ; au téléphone, chaque planche du pli prend six
lignes (une par colonne).

1. **Le compte rouge** (tuile « Planches non servies », ligne du
   téléphone, titre du pli) se fait par groupe de motif : il laisse de côté
   les groupes informatifs, ceux dont aucune planche ne garde un manque
   d'au moins un centième de millimètre ; les planches qu'aucun matériel
   n'arrose y restent toujours, en tête, comme un réglage à faire (audit
   ergonomique, lot 3, cas 2). Les planches des groupes informatifs sont
   dites à part, en simple information : « Planches non servies (5) · 5
   sans objectif », ou « Planches sans objectif (2) » quand rien d'autre
   n'est à compter ; la tuile ajoute « · 5 sans objectif, pour
   information » (F251).
2. **Leur groupe** (« Sans objectif », ou tout groupe sans manque) passe
   en dernier, sans couleur d'alerte (F252).
3. **Au téléphone, une ligne compacte par planche** : « A01 · Abri des
   noues · manque 3,6 mm sur 10,9 mm » et son « i », le motif dessous ; la
   priorité seulement quand elle n'est pas normale ; « Placé » à
   l'ordinateur seulement (F253).

## 7. Remarque 2 — L'eau qu'une planche reçoit sans part

**Cause établie dans le code.** Le pli compte « Placé » au sens des parts
(`placedMm`) ; l'eau que le matériel d'une planche servie verse aussi sur
sa voisine (S16) est dans le créneau (`bedApplications[].appliedMm`), pas
dans la ligne de la voisine. En « report » (B7), T2-7 et T2-8 se lisent
« 0 mm placés, reportées » alors que la rampe du tunnel 2 leur verse
24,6 mm.

1. **La ligne de la planche le dit** : « reçoit quand même 24,6 mm du
   matériel qui arrose ses voisines », quand l'eau des créneaux proposés
   ou validés de la semaine passe ce qui lui est placé d'au moins
   0,05 mm ; ni le manque, ni le placé, ni aucun total ne changent (F254).

## 8. Remarque 4 — Les parts comptées après l'eau validée

**Cause établie dans le code.** Après une validation, la ligne de budget
compte l'eau mobilisable et la demande après l'eau validée (S20, D-086) :
la part de la normale passe de 42 à 27 % (B9) alors que ses planches
reçoivent la même eau.

1. **Le pli du budget le dit**, en tête, quand la semaine a des arrosages
   validés : « Les parts se comptent sur ce qui reste à placer, après les
   5,06 m³ déjà validés cette semaine : une part qui baisse après une
   validation ne retire pas d'eau aux planches. » (« après les arrosages
   déjà validés » quand un volume validé est inconnu) (F255).

## 9. Remarque 5 — Le jour qui dépasse sa limite

**Cause établie dans le code.** Le plan range les jours qu'une limite
posée après coup met en défaut (`overcommittedDays`, règle 16) ; seule la
cause des suggestions les nomme, la colonne du jour ne dit rien (B11).

1. **La colonne du jour le dit**, sous son en-tête, en rouge foncé :
   « Limite journalière de 1,50 m³ dépassée : 5,06 m³ engagés » (F256).

## 10. Cas chiffrés (la preuve de fin les met en tests et en parcours)

| Cas | Entrée | Attendu |
| --- | --- | --- |
| 1 | Plan au manque d'eau de 0,367 m³, 5 planches en manque, sans arbitrage | « Il manque 0,367 m³ d'eau d'ici dimanche : 5 planches ne recevront pas tout leur besoin. » ; les notes dans « Le détail du calcul », fermé |
| 2 | Le même plan sous une répartition validée | « Votre répartition s'applique : il manque … » ; « Revoir la répartition » |
| 3 | Plan sans manque d'eau | aucune phrase, aucun lien |
| 4 | « Ressources », un niveau à choisir | aucune tuile de faisabilité hors de l'écran de répartition ; les huit dans « Le détail du calcul » |
| 5 | « Ressources », rien à choisir | quatre tuiles, « Planches servies en entier : n sur m » |
| 6 | Niveaux haute et basse sans planche | aucun bloc « Priorité Haute » ni « Priorité Basse » |
| 7 | Plan en manque d'eau, sans répartition validée | sur « Ressources », la faisabilité est la première section |
| 8 | Une planche « Tomate » à 390 px | « N02 · Tomate » sur sa ligne ; aucun « Kc » visible |
| 9 | 5 planches en manque, 5 sans objectif | tuile « 5 », titre « Planches non servies (5) · 5 sans objectif », « Sans objectif (5) » en dernier |
| 10 | T2-7 en report sous la rampe du tunnel 2 (S12) | « reçoit quand même 24,6 mm du matériel qui arrose ses voisines » |
| 11 | Une proposition validée, puis un recalcul (S20) | le pli du budget nomme les m³ déjà validés |
| 12 | Une limite de 0,01 m³ posée après une validation (P12) | la colonne du jour : « Limite journalière de 0,01 m³ dépassée » |

## 11. Précisions

- **F243** la phrase d'action du planning (section 3.1).
- **F244** les notes du calcul dans « Le détail du calcul » (section 3.2).
- **F245** quatre tuiles au plus sur « Ressources » (section 3.3).
- **F246** aucun bloc de priorité sans besoin (section 3.4).
- **F247** « Répartir l'eau » depuis le planning (section 4.1).
- **F248** la faisabilité en tête de « Ressources » tant qu'une décision attend (section 4.2).
- **F249** les cultures à côté du nom de la planche (section 5.1).
- **F250** le Kc dans l'infobulle (section 5.2).
- **F251** seul le manque se compte en rouge (section 6.1).
- **F252** les groupes sans manque en dernier, sans alerte (section 6.2).
- **F253** une ligne compacte par planche au téléphone (section 6.3).
- **F254** l'eau reçue sans part (section 7).
- **F255** les parts comptées après l'eau validée (section 8).
- **F256** le jour au-delà de sa limite (section 9).

Ce que le lot ne prouve pas : la lecture d'une vraie pénurie sur la ferme
réelle (séance Chrome, choix n° 6, qui attend le « vas-y » du porteur) ; un
lecteur d'écran ; la remarque 2 en parcours (une rampe qui arrose deux
planches en report demande une ferme de quatre tunnels : le jeu S12 du
moteur la reproduit, au chiffre de la recette B7).
