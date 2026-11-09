# Recette finale de la tranche 3 — Pénurie, recette et publication (v0.2.0)

Protocole écrit le 9 novembre 2026, avant la recette (3.9, lot 4, D-091),
rempli pendant, sur le modèle de `docs/recette-3.4.md`. Il suit
`docs/shortage-contract.md`, sections « La recette finale », « La revue de
sécurité des frontières et de l'isolation » et « La non-régression
complète » ; ce qui suit ne change aucune règle de ce contrat.

La recette se fait sur la version déployée après la dernière PR de code de la
tranche, jamais sur une version antérieure (D-014), sur le site privé, avec
les données réelles de la ferme. Les constats sont ceux de l'assistant dans le
Chrome du porteur, sur son mot ; le jugement est celui du porteur. Le groupe A
ne modifie rien ; le groupe B ne commence que sur le « vas-y » du porteur, sur
des données expérimentales relevées en 0.3 et rendues en B13. Aucune clé,
aucun jeton, aucun mot de passe ni aucune adresse électronique n'est vu, saisi
ou consigné ici ; aucun export de la ferme n'est versionné (`AGENTS.md`).

Résultat attendu : chaque ligne porte un constat et un verdict, OK ou KO. Un
KO devient un point ouvert de `docs/ETAT_DU_PROJET.md` et une PR `fix/`,
recettée à son tour après son déploiement. La tranche n'est close qu'avec zéro
KO bloquant, la revue de sécurité sans constat resté sans décision, chaque
scénario S1 à S28 avec sa preuve ou la mention « non vérifié », la
non-régression entière avec ses sorties réelles, et le mot de clôture du
porteur ; le tag `v0.2.0` vient après (section H).

Chaque calcul de la recette est chronométré depuis le navigateur ; un calcul
de 3 s à 45 s rouvre le point ouvert 34 et se lit dans les journaux du Worker
(`docs/publication.md`), sur le mot du porteur.

## 0. Préalables

| N° | Vérification | Attendu | Constaté | Verdict |
| --- | --- | --- | --- | --- |
| 0.1 | La version en ligne | Le commit de `main` attendu, la date de son déploiement et les quatre jobs verts du déploiement (D-016) | | |
| 0.2 | La semaine | La semaine civile en cours, du lundi au dimanche, en tête de « Planning de la semaine » et de « Objectifs et besoins » | | |
| 0.3 | L'état de départ de la ferme, relevé avant tout geste | Stocks, minima et état des réserves ; ressources, leur état, leurs limites de prélèvement ; pompes et pompes habituelles ; limite journalière d'irrigation ; priorités des planches ; réglages du planning (conduite R9, plages R8, doses R4 et R5) ; objectifs de la semaine ; dernier plan calculé, sa date et son déclencheur ; arbitrage en vigueur ou non | | |
| 0.4 | Les navigateurs | Le Chrome du porteur à l'ordinateur pour A et B ; son téléphone pour C | | |

## A. Lecture sur données réelles, sans rien modifier

Chaque section de la tranche 3, dans la disposition de la 3.8 — une page par
fonctionnalité —, puis les recoupements d'une section à l'autre.

| N° | Vérification | Attendu | Constaté | Verdict |
| --- | --- | --- | --- | --- |
| A1 | Ressources et réserves (3.1), page « Ressources et pompes » | Chaque ressource avec son débit, son état et sa limite ; chaque réserve avec son volume actuel, sa capacité, son minimum, son mobilisable et la date de son volume observé | | |
| A2 | Débits (3.1 bis) | Les relevés du compteur, le débit en fonctionnement et la décision de débit de la ressource, sans relevé réécrit | | |
| A3 | Pompes (3.2) | Chaque pompe active avec son débit maximal et ses origines ; la pompe habituelle de chaque matériel ; aucune planification à vérifier sans raison | | |
| A4 | Besoins (3.3), page « Objectifs et besoins » | Le besoin de chaque planche, sa surface mouillée et sa nature, l'objectif de la semaine, la pluie prévue et mesurée | | |
| A5 | Faisabilité (3.4) | « Semaine du … au … · Calculé le … », les tuiles, la répartition et, s'il y en a un, l'écran d'arbitrage façon plan d'assolement (D-083) | | |
| A6 | Planning (3.5, 3.6), page « Planning de la semaine » | Le plan, son en-tête et son déclencheur, les cartes de tête, la ligne de budget de chaque chaîne avec ses fractions, les cartes et leur justification, « Planches non servies » rangées par motif | | |
| A7 | Suivi et replanification (3.7) | Le pli « Ce qui a changé », les suggestions et leurs raisons, les refus de la semaine | | |
| A8 | Réserve du sol (5 ter) | La jauge de chaque jardin, observée ou estimée, en information seulement | | |
| A9 | Alertes (5 bis) | Les alertes météo et cultures de la semaine et leur historique, sans effet sur le plan | | |
| A10 | Besoin par culture (5 quater) | Le résumé de chaque culture, ses objectifs proposés, non adoptés tant que le porteur ne les adopte pas | | |
| A11 | Recoupement : besoins totaux | La tuile des besoins totaux égale la somme des besoins des planches, à l'arrondi près | | |
| A12 | Recoupement : mobilisable | L'eau mobilisable égale la somme des réserves actives moins leurs minima | | |
| A13 | Recoupement : ligne de budget | Pour chaque chaîne, stock − minimum + apport d'ici dimanche − prélèvements déjà engagés | | |
| A14 | Recoupement : manque d'eau | Le manque égale le besoin non couvert, planche par planche, sur les planches à motif d'eau ; « non chiffré » ou « au moins … » sur une eau inconnue (D-089) | | |

## B. La pénurie fabriquée, sur le « vas-y » du porteur

L'attendu chiffré de chaque calcul est écrit dans la colonne « Attendu
chiffré » avant de cliquer ; les chiffres sont relus carte par carte et refaits
à la main, comme le 5 octobre 2026. Les priorités de B5 sont celles que le
porteur pose le jour même (décision 3).

| N° | Geste | Attendu (règle) | Attendu chiffré, écrit avant le clic | Constaté | Verdict |
| --- | --- | --- | --- | --- | --- |
| B1 | Stock seul (S1) : forage indisponible, la réserve à son stock observé, minimum 0 | Budget égal au stock ; une fraction par niveau ; chaque planche coupée à sa part, motif « stock et ressources insuffisants d’ici dimanche », la dose de sa carte dite « la part de la semaine réservée à ses planches » (D-092) ; somme des volumes ≤ budget ; la dernière planche examinée servie comme la première (D-037) | | | |
| B2 | Minimum relevé au-dessus du stock (S3) | Aucun créneau avant que l'apport ait comblé le manque sous le minimum, « dès que la réserve a l'eau nécessaire » ; la réserve jamais sous son minimum ; la ligne de budget retire d'abord ce manque (décision 2) | | | |
| B3 | Limite de prélèvement de la ressource (S2) | Budget égal au stock plus l'apport plafonné jour par jour ; aucun jour au-delà de la limite ; sa coupe nommée « limite de prélèvement … atteinte » (D-085) | | | |
| B4 | Restriction : limite journalière d'irrigation (S5) | Chaque jour limité rempli au plus à la limite, réalisé et validé compris ; la coupe nommée « limite journalière » ; un créneau à cheval sur minuit vérifié sur ses deux jours (D-085) | | | |
| B5 | Priorités réelles à trois niveaux (S10, décision 3) | La haute servie d'abord, en entier si l'eau le permet ; la normale à une même fraction sur chaque planche ; la basse avec ce qui reste ; aucun motif d'eau sur une planche servie en entier ; les fractions affichées sont les parts de départ | | | |
| B6 | Part égale (S11) | Une même fraction pour toutes les planches, quel que soit leur niveau ; somme ≤ budget | | | |
| B7 | Report (S12) | Les planches servies en entier dans l'ordre de service, les suivantes « reportée : passe en tête après le prochain événement » ; sans événement, le calcul suivant reproduit le précédent (D-080) | | | |
| B8 | Arbitrage validé à l'écran de la faisabilité, puis plan (S13) | Les allocations s'imposent, sans ligne de budget ni fraction ; une planche exclue porte le motif de l'arbitrage ; l'eau d'une chaîne indisponible ne se reçoit pas (D-088) | | | |
| B9 | Validation en pénurie (S20) | Les irrigations validées comptent comme déjà placées dans la part de leur planche ; les autres gardent leur part et leur dose ; aucune planche validée ne reçoit une seconde proposition ; validé plus proposé ≤ budget (D-086) | | | |
| B10 | Refus en pénurie (S21) | Le créneau refusé évité pour la semaine ; la part de la planche replacée ailleurs, la même dose ; sinon « créneau refusé » dans « Non placé » et sa part libérée en fin de tour ; somme ≤ budget | | | |
| B11 | Restriction posée après coup (S22) | Le jour signalé ; « Réduire à … mm » en suivant R9 à l'envers, « Annuler » sous la dose minimale ; rien d'appliqué seul | | | |
| B12 | Deux recalculs à deux minutes (S26) | Les deux plans tiennent les invariants ; les créneaux déplacés et l'écart du volume placé relevés, au jugement du porteur (un relevé, pas une garde) | | | |
| B13 | Remise en état | Chaque réglage de 0.3 rendu, les irrigations validées pendant B annulées, le dernier calcul retrouvant le plan du départ | | | |

## C. Téléphone, 390 px, sur l'appareil du porteur

| N° | Vérification | Attendu | Constaté | Verdict |
| --- | --- | --- | --- | --- |
| C1 | Le planning en pénurie | La ligne de budget, les cartes en pénurie et leur justification, « Planches non servies », lisibles sans débordement | | |
| C2 | L'écran d'arbitrage façon plan d'assolement | Les jardins, les cases « Servir », « Ne rien servir », le bilan et « Valider la répartition » à portée de pouce | | |
| C3 | « Ressources et pompes » | Les réserves, les ressources et les pompes lisibles, leurs boutons à 44 px | | |
| C4 | La lisibilité d'ensemble | Au jugement du porteur | | |

## D. La revue de sécurité des frontières et de l'isolation

Une lecture, pas un outil nouveau ; chaque point donne un constat et un
verdict. Un défaut devient un point ouvert et une PR `fix/` à part (lot 5) ;
un constat qui demande une décision devient une question au porteur.

| N° | Point | Ce qui se vérifie | Constat | Verdict |
| --- | --- | --- | --- | --- |
| D1 | Les frontières (Q3, `docs/boundaries-contract.md`) | Le lint refuse un import interdit (`tests/lint-boundaries.test.ts`) ; `lib/domain/` n'importe que le domaine ; `db/` importé par aucun composant client autrement qu'en type ; aucun littéral d'unité hors `lib/domain/units.ts` ; aucun fichier au-dessus de 600 lignes ; `pnpm knip` sans signalement ; les deux Workers vérifiés par leurs propres contrôles | | |
| D2 | L'isolation des données | Les tables de `db/schema.ts` portent l'exploitation, et celles qui ne la portent pas sont nommées avec leur raison ; chaque dépôt de `db/` prend le propriétaire de la session ; pour chaque dépôt, un test de persistance éprouve qu'un autre propriétaire ne lit ni n'écrit — les fichiers de `tests/db/` relus un par un, les dépôts sans un tel test nommés et leur test écrit ; le planning isolé par exploitation, saison et semaine (S28) | | |
| D3 | L'authentification | Cloudflare Access sur chaque requête, le jeton vérifié — émetteur, audience, signature, validité — (`app/access-auth.ts`, `tests/access-jwt.test.ts`) ; `LOCAL_DEMO_USER` refusé hors développement ; la route interne météo n'accepte que son jeton partagé, comparé en temps constant ; les Workers se parlent par liaisons de service ; la configuration Access lue dans le Chrome du porteur, sur son mot, en lecture seule, sans rien consigner d'identifiant | | |
| D4 | Le connecteur Ouvre ta ferme | Liste blanche, `GET` seulement, quatre appels par seconde, 500 par page, cinquante pages au plus, refus explicite au-delà (D-002, D-022) ; `tests/read-client.test.ts` | | |
| D5 | Les secrets et les journaux | Aucune clé, jeton, cookie ni courriel dans le dépôt, les journaux ou la documentation ; `.dev.vars` et les exports `*.d1-export.json` ignorés par Git ; les lignes JSON du Worker sans identifiant de personne ni nom de planche ; une lecture unique de `pnpm audit`, sa sortie collée | | |
| D6 | Les notifications | Le Worker Push ne connaît que l'exploitation comme destinataire ; liste blanche d'adresses, déduplication, aucun texte personnel (`docs/push-worker-contract.md`) | | |
| D7 | Ce que la revue ne fait pas | Aucun test d'intrusion, aucun scanner nouveau, aucun changement de l'identité (tranche 4) : dit dans le compte rendu | | |

## E. La non-régression complète

Sur la version qui clôt la tranche, dans l'ordre ; les sorties réelles sont
collées dans `docs/ETAT_DU_PROJET.md` et dans la PR de clôture.

| N° | Contrôle | Attendu | Sortie relevée | Verdict |
| --- | --- | --- | --- | --- |
| E1 | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm knip`, `pnpm push:check`, `pnpm weather:check`, `pnpm e2e` | Tous verts, aucune omission | | |
| E2 | Les tests du moteur | Les invariants sur deux cents semaines tirées au hasard, étendus aux parts, aux refus, à l'arbitrage et à deux chaînes ; la grande ferme calculée sous 500 ms (D-031) | | |
| E3 | Les tests de persistance | Toutes les migrations, de `0000` à la dernière, sur une base neuve (dérive de schéma) | | |
| E4 | Les parcours navigateur, P0 à P32, à 1 280 et 390 px | Tous passés, sans débordement ni erreur de console, leur durée relevée | | |
| E5 | La relecture des registres contre le dépôt et Git | Chaque ligne 🟡 ou ⬜ de la roadmap, chaque point ouvert, chaque décision citée par un contrat vérifiés à la source ; les écarts corrigés par la PR de clôture et listés dans son compte rendu | | |
| E6 | Les scénarios S1 à S28 | Chacun avec sa preuve ou « non vérifié » : section F | | |

## F. Les scénarios S1 à S28

La preuve attendue est celle que `docs/shortage-contract.md` donne à chaque
scénario ; la preuve relevée cite le test, la ligne de recette ou le parcours,
ou dit « non vérifié ».

| Scénario | Preuve attendue | Preuve relevée | Verdict |
| --- | --- | --- | --- |
| S1 — Stock seul, sans apport | Test du moteur ; B1 | | |
| S2 — Apport plafonné par la limite de prélèvement | Test du moteur (D-084, D-085) ; B3 | | |
| S3 — Minimum de sécurité au-dessus du stock | Test du moteur (D-079) ; B2 | | |
| S4 — Réserve engagée sous son minimum par des irrigations planifiées | Test du moteur (D-084) | | |
| S5 — Restriction : limite journalière d'irrigation | Tests du moteur (D-085) ; B4 | | |
| S6 — Temps de pompage et eau à la fois | Test du moteur (D-087) | | |
| S7 — Stock inconnu | Test du moteur et de la carte (D-089) | | |
| S8 — Origine indisponible, pompe archivée, ressource inactive | Tests du moteur (D-088) | | |
| S9 — Deux chaînes d'eau | Test du moteur (D-084, D-085) ; P32 pour une chaîne | | |
| S10 — Prioritaires d'abord, puis part égale, sur trois niveaux | Tests du moteur (D-079, D-084) ; B5 | | |
| S11 — Part égale pour toutes | Test du moteur ; B6 | | |
| S12 — Report | Tests du moteur et du service (D-080) ; B7 | | |
| S13 — Arbitrage 3.4 validé | Tests du moteur (D-077) ; B8 | | |
| S14 — La dernière planche examinée reçoit sa part | Test du moteur ; B1 | | |
| S15 — Créneau raccourci par ses parts | Test du moteur ; ligne de B, sur une rampe qui verse aussi sur d'autres planches (P32 ne le produit pas, D-091) | | |
| S16 — Débordement d'une rampe sur des planches sans part | Test du moteur ; ligne de B sur les rampes de bloc | | |
| S17 — Libération des parts en fin de tour | Test du moteur ; ligne de B | | |
| S18 — Sous la dose minimale en pénurie, et le dernier jour | Tests du moteur (D-081) ; croisé en S27 | | |
| S19 — La note du manque d'eau | Tests du moteur ; ligne de B sur une rampe de bloc | | |
| S20 — Validation en pénurie | Tests du moteur et du service (D-086) ; P32 ; B9 | | |
| S21 — Refus en pénurie | Tests du moteur (D-091) ; P32 ; B10 | | |
| S22 — Restriction posée après coup | Test de la 3.7 ; P12 ; B11 | | |
| S23 — Pluie prévue en pénurie | Tests du moteur (D-084) | | |
| S24 — Semaine entamée | Test du moteur (D-084) | | |
| S25 — Même calcul deux fois en pénurie | Test du moteur | | |
| S26 — Sensibilité à l'heure du calcul | Relevé du moteur (D-084) ; B12 | | |
| S27 — Dimanche soir et lundi | Tests du moteur ; lecture du lundi matin | | |
| S28 — Deux exploitations, même saison, même semaine | Tests de persistance (D-084) ; D2 | | |

## G. Les réévaluations promises à la 3.9

| N° | Sujet | Attendu | Constat | Suite |
| --- | --- | --- | --- | --- |
| G1 | Vinext (D-015) | Si la version en service est encore une version stable, sans incident depuis, D-015 close « risque levé » ; sinon, le constat et sa suite écrits | | |
| G2 | Le temps de rendu (D-017) | Les totaux de `irrigation_page_loaded` relus, la mesure avant et après de la 3.8 reprise ; aucun seuil nouveau | | |
| G3 | Le point ouvert 34 | Rouvert à la première occurrence d'un calcul de 3 s à 45 s, sinon laissé tel quel | | |

## H. Clôture

- Les KO et leur sort :
- Les points ouverts restants :
- Les questions tranchées pendant la recette :
- Le mot de clôture du porteur :
- Le tag `v0.2.0`, annoté, posé sur le commit de fusion de la PR de clôture
  après son déploiement vérifié, sur le mot du porteur, poussé par
  l'assistant ; annoncé avec son lien, consigné par la PR suivante :
