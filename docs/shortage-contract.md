# Contrat des scénarios de pénurie, de la recette et de la publication de la tranche 3 (3.9)

Écrit le 30 octobre 2026, sur le « Vas-y » du porteur relayé par le
coordinateur, avant tout code, pour le porteur de projet, qui en est le
validateur agronomique (D-014). Sous-tranche 3.9 de `ROADMAP.md`, 22ᵉ et
dernière de l'ordre d'exécution de la tranche 3 : « scénarios, tests de
pénurie, recette et publication ». Réglage de la roadmap, appliqué à la
rédaction : Fable 5.1 · Max, « les cas de pénurie sont les plus délicats et les
moins vérifiables mécaniquement ».

Ce contrat prolonge `docs/planning-contract.md` (section « Pénurie »,
« La part réservée », « La garde de la réserve »), `docs/replanning-contract.md`
(3.7, validé le 30 octobre 2026), `docs/irrigation-feasibility-contract.md`
(3.4), `docs/water-resources-contract.md` (3.1), `docs/pumps-hydraulic-contract.md`
(3.2), `docs/browser-journeys-contract.md` (Q5) et
`docs/boundaries-contract.md` (Q3), sans changer une règle tranchée. Rien n'est
codé ; les registres sont mis à jour par la PR qui porte ce contrat, à son
tour dans la file de fusion. Les questions qui reviennent au porteur sont
rassemblées à la fin, chacune avec une recommandation et ses raisons. **Le
porteur a tranché les huit questions le 30 octobre 2026 à 22 h 54** : « d'accord
avec tout. » (« Décisions du porteur », en fin de document). **Le contrat est
validé** ; la décision est consignée dans `docs/DECISIONS.md` (D-052) par la
PR qui porte ce contrat, et le code attend son tour dans l'ordre de la roadmap.

**Ce que ce contrat suppose.** Il est écrit sur `main` à `88307d5`, quand la
3.7, la 5 ter, la 5 bis, la 5 quater et la 3.8 ne sont pas encore codées. Il
cite leurs règles telles que leurs contrats les fixent aujourd'hui ; ce que
leur code précisera est relu à l'ouverture du code de la 3.9 (section « À
relire à l'ouverture du code »), sans que les règles d'ici changent. Au 31
octobre 2026, jour de la PR de registres, le code de la 3.7 est en ligne (PR
#208 à #215 fusionnées et déployées ; restent sa recette réelle et sa clôture
par le porteur) : ce que ce contrat lui emprunte se relit de même à
l'ouverture du code de la 3.9.

## Le constat

Ce que le logiciel fait et ce qui est prouvé, relevé dans le code et les
registres de `main` le 30 octobre 2026.

- **La pénurie est chiffrée et répartie, jamais dissimulée.** Le moteur
  distingue le manque d'eau et le manque de temps de pompage ; la conduite en
  pénurie R9 a ses trois formes du cahier des charges — « prioritaires d'abord,
  puis part égale » (valeur de départ, D-024), « part égale pour toutes »,
  « report » — dans `lib/domain/planning/shortage.ts` ; un arbitrage 3.4 validé
  s'impose au moteur, un arbitrage vide ou caduc non.
- **La part attribuée à une planche lui est réservée** (D-037,
  `lib/domain/planning/shares.ts`) : le créneau d'une autre ne peut pas la
  consommer, ce qu'une planche ne peut pas recevoir est libéré en fin de tour,
  quatre tours au plus ; la note du manque d'eau explique l'écart entre
  « demandé moins placé » et le manque (D-038) et se tait sur le résidu
  d'arrondi des secondes (D-040).
- **La garde de la réserve tient** (point ouvert 19) : la projection qui juge
  est bornée par la capacité seule, du début du créneau à la fin de l'horizon ;
  un créneau est décalé, raccourci ou refusé ; une réserve déjà sous son
  minimum ne reçoit aucun créneau nouveau.
- **La restriction est une limite en mètres cubes par jour** (D-024, point 9),
  règle forte jour civil par jour civil ; elle borne le budget d'une chaîne
  quand chaque jour de l'horizon est limité, et la coupe porte alors son nom
  (point ouvert 35).
- **Prouvé sur la ferme, en pénurie fabriquée** (`docs/recette-planning.md`,
  quatrième, cinquième et sixième recettes) : la garde de la réserve à 0,001 m³
  près et au minimum exact ; le stock consommé au litre ; les vagues décalées
  au rythme du forage ; le budget « stock − minimum + apport », l'apport
  plafonné par la limite de prélèvement ; la conduite « prioritaires d'abord,
  puis part égale » comme cible, à 30, 97, 91 et 73 % ; la limite journalière
  tenue, chaque jour limité rempli exactement ; la part réservée, la dernière
  planche examinée comprise ; la note du manque d'eau absente sur le résidu ;
  la remise en état par l'écran seul.
- **Jamais prouvé sur la ferme** : les conduites « part égale pour toutes » et
  « report » ; une réserve engagée sous son minimum par des irrigations
  planifiées à la main ; la validation en pénurie ; le créneau raccourci par
  ses parts et son motif ; le débordement d'une rampe sur des planches
  voisines sans part ; la libération des parts en fin de tour ; la branche
  positive de la note ; la lecture à 390 px, couverte par le parcours P10 seul.
  Toutes les planches de la ferme sont en priorité « Normale » : la conduite
  « prioritaires d'abord » n'a été vue que comme une part égale.
- **Dans les tests** : `tests/planning-engine.test.ts` joue le manque d'eau,
  la restriction, la pompe saturée, les invariants sur deux cents semaines
  tirées au hasard sous les trois conduites, les chiffres de la ferme, le
  budget de temps (D-031) et les points 33 et 35 ; `tests/planning-shares.test.ts`
  la part réservée et la note ; `tests/irrigation-feasibility.test.ts`
  l'arbitrage 3.4 ; les parcours P7 (arbitrage de la pénurie, 3.4) et P10
  (planning sans pénurie). La ferme de test ne connaît ni planche en priorité
  basse, ni limite de prélèvement de ressource, ni pompe archivée, ni seconde
  chaîne d'eau, ni réserve engagée sous son minimum à la main.
- **Deux limites laissées telles quelles par la PR de la part réservée**, « à
  trancher à part » (`docs/planning-contract.md`, « La part réservée ») :
  l'arbitrage 3.4 validé, dont les allocations ne sont pas des parts
  réservées ; le budget d'une chaîne, qui compte l'apport jusqu'à dimanche
  minuit et compte zéro, non le manque, quand le stock est sous le minimum de
  sécurité. Sur la ferme, le 5 octobre, le calcul T3 annonçait « normale
  91 % » pour 75,27 m³ mobilisables et a placé 60,2 m³, soit 73 %.
- **Un constat non élucidé** (quatrième recette, « Autres constats ») : deux
  calculs du même état à deux minutes d'écart ont placé le tunnel 3 à deux
  moments différents, samedi 21 h à 8,2 mm puis mardi 4 h 03 à 11,2 mm.
- **Deux réévaluations sont promises à la 3.9** : le risque Vinext (D-015 ;
  roadmap, section 7, décision 6), stable `1.0.0` depuis le 1er octobre 2026,
  et la surveillance du temps de rendu (D-017). Le point 34, temps de recalcul
  de 3 s à 45 s sur le site, est en veille, non bloquant.
- **Le reste de la tranche 3** : le point 31 va au moteur de la 3.7 ; la 3.8
  réorganisera l'écran avant la 3.9 ; la tranche 4 se cadre avec le développeur
  d'Ouvre ta ferme après la 3.9 ; l'ouverture du dépôt et sa licence attendent
  la tranche 4 (D-013). Un seul tag existe, `v0.1.0`, posé après Q0 ;
  `package.json` est en `0.1.0` ; le journal des changements a une section
  « Non publié » et une section par tranche close.

## Objet

La 3.9 ne construit aucune fonctionnalité : elle **prouve** la tranche 3 et la
**publie**. Elle écrit la liste fermée des cas de pénurie que le logiciel doit
savoir tenir, met chacun sous un test ou sous une ligne de recette, rejoue
tout ce qui existe, relit les frontières et l'isolation, fait la recette
finale sur ordinateur et sur téléphone, puis pose un tag de version sur ce
qui est en ligne. Une règle agronomique n'y naît que par une réponse du
porteur aux questions de la fin ; sinon, chaque attendu découle d'une règle
déjà tranchée.

## Vocabulaire

- **Pénurie** : le budget d'une chaîne d'eau ne couvre pas tous les besoins
  de ses planches d'ici dimanche (`docs/planning-contract.md`).
- **Source du manque** : ce qui borne le budget — le stock, l'apport, le
  minimum de sécurité, la limite de prélèvement d'une ressource, la limite
  journalière d'irrigation, le temps de pompage, un stock inconnu, une origine
  indisponible. Chaque source a son motif à l'écran, et la coupe porte le nom
  du terme qui borne.
- **Conduite** : le réglage R9, l'une des trois façons de répartir un budget
  insuffisant.
- **Part** : la fraction du besoin qu'une conduite attribue à une planche, en
  m³ au prix de la surface que son matériel mouille, réservée à elle (D-037).
- **Scénario** : une situation chiffrée, son attendu écrit d'après les règles
  tranchées, et la façon dont il est vérifié : un test du moteur, un test de
  persistance, un parcours navigateur ou une ligne de la recette réelle.
- **Jeu de données** : une ferme sur laquelle les scénarios se jouent ; il y
  en a trois (section « Les jeux de données »).
- **Non-régression** : tout ce qui est déjà prouvé, rejoué sur la version qui
  clôt la tranche, avec ses sorties réelles collées.
- **Recette finale** : `docs/recette-tranche-3.md`, le protocole puis le
  compte rendu, sur le modèle de `docs/recette-3.4.md` : une ligne par
  vérification, l'attendu écrit avant, le constat, le verdict OK ou KO, et qui
  a constaté. Le constat est à l'assistant, le jugement au porteur (D-014).
- **Tag** : la marque posée dans Git sur le commit de `main` qui est en ligne
  à la clôture de la tranche.

## Les règles de la 3.9

1. **Aucune règle agronomique nouvelle.** Chaque attendu de ce contrat cite
   la règle dont il découle. Là où une règle manque ou se contredit, le
   scénario devient une question au porteur ; tant qu'il n'a pas répondu, le
   scénario est joué pour constater, jamais pour corriger.
2. **Un scénario, une preuve.** Chaque scénario de la liste fermée ci-dessous
   est tenu par au moins un test, et par une ligne de la recette réelle quand
   la règle se laisse jouer sur la ferme. Un scénario sans preuve n'est pas
   « fait » : il est listé « non vérifié » dans le compte rendu.
3. **Un test rouge est un défaut**, pas un test à adoucir. Il se corrige dans
   une PR `fix/` à part, contrat précisé avant le code, point ouvert consigné,
   recette sur le site après déploiement, comme pour les points 19, 35, 36 et
   41. Jamais un test désactivé, jamais une tolérance élargie sans décision.
4. **Les invariants ne se négocient pas.** Sur tout plan, en pénurie comme
   ailleurs : aucun créneau hors de sa plage ni après dimanche minuit ; la
   pompe jamais au-dessus de son débit ; la limite journalière jamais
   dépassée, réalisé et validé compris ; 24 h au moins entre deux débuts
   d'une planche qui commande ; la réserve jamais sous son minimum sur la
   projection qui juge ; la somme des volumes d'une chaîne jamais au-dessus de
   son budget (`assertInvariants`, `tests/support/planning-fixtures.ts`).
5. **Le manque annoncé est le vrai manque.** Le déficit est exactement le
   besoin non couvert, planche par planche ; les motifs nomment le terme qui
   borne ; un manque n'est jamais arrondi à zéro ; un stock inconnu donne un
   manque non chiffré, jamais un zéro (D-003).
6. **Rien de réel n'est réécrit** par un scénario : les irrigations, les
   relevés et les décisions restent (D-006) ; sur la ferme, l'état de départ
   est relevé, l'attendu écrit avant chaque calcul, et tout est remis en état
   par l'écran, un dernier calcul retrouvant le plan du départ (consigne du
   5 octobre 2026). Toute action sur la ferme réelle attend le « vas-y » du
   porteur, le jour même.
7. **La clôture est au porteur** (D-014) : la 3.9 n'est terminée que sur son
   mot, après la recette finale, avec zéro KO bloquant et chaque question de
   la fin tranchée ou expressément reportée.

## Les scénarios de pénurie

Liste fermée, numérotée S1 à S28. Les chiffres sont ceux de la ferme de test
du moteur (`tests/support/planning-fixtures.ts`), aux valeurs de la ferme
réelle : réserve de 60 m³, forage à 0,511 m³/h, pompe à 8 m³/h, objectif
20 mm, la demande à quatre tunnels valant 17,83 m³ — 1,98 m³ du bloc 1,
5,608 m³ du bloc 2, 2,56 m³ par tunnel —, ou ceux relevés sur la ferme le
5 et le 10 octobre 2026 (82,70 m³ demandés avec R2 à 0 %). Pour chacun :
la situation, l'attendu d'après les règles tranchées, la vérification, et
l'état au 30 octobre 2026.

### A. La source du manque

1. **S1 — Stock seul, sans apport.** Forage indisponible, réserve observée à
   25 m³, minimum 0, R2 à 0 %, 82,70 m³ demandés, tout en « Normale ».
   Attendu : budget 25 m³ ; « normale 30 % », chaque planche visant 6 mm ; le
   stock consommé au litre, niveau projeté au plus bas ≥ 0 ; coupe « stock et
   ressources insuffisants d'ici dimanche » ; somme des volumes ≤ 25 m³ ; la
   dernière planche examinée servie comme la première (D-037). Vérification :
   test « manque d'eau » (existant) ; recette T1 du 5 octobre (prouvé avant
   D-037), cinquième recette à 28 et 50 % (prouvé). État : ✅, à rejouer en
   recette finale.
2. **S2 — Apport plafonné par la limite de prélèvement de la ressource**
   (3.1, D-035). Forage disponible, limite 10 m³/jour, réserve 25 m³, minimum
   0. Attendu : budget = stock + apport plafonné à 10 m³ par jour civil de
   Paris, apports à la réserve compris (86,68 m³ le 5 octobre) ; pas de manque
   d'eau ; les planches non servies le sont pour R6, R7, la portée ou la dose
   minimale, jamais pour un motif d'eau ; « Manque d'eau 0,00 m³ ».
   Vérification : recette T4a (prouvé) ; test du moteur
   (`tests/planning-shortage-scenarios.test.ts`, lot 3, D-084) : 80,69 m³
   sur la ferme de test au lieu de 92,01 m³ sans limite, aucun motif d'eau.
   État : ✅ test, à rejouer en recette finale.
3. **S3 — Minimum de sécurité au-dessus du stock.** Réserve 25 m³, minimum
   40 m³, forage 0,511 m³/h. Attendu : aucun créneau avant l'heure exacte où
   l'apport a comblé les 15 m³ manquants (mercredi 4 h 17 sur la ferme),
   motif « dès que la réserve a l'eau nécessaire », contrainte « réserve au
   minimum de sécurité » ; ensuite au rythme du forage ; jamais sous 40 ; la
   ligne de budget retire d'abord le manque sous le minimum (décision 2) :
   60,27 m³ et « normale 73 % », ce que le plan a placé, au lieu de 75,27 m³
   et 91 % aujourd'hui. Vérification : recette T3 (garde prouvée) ; test du
   moteur sur la ferme de test, forage à 0,2 m³/h
   (`tests/planning-shortage.test.ts`, D-079, #12). État : 🟡 test écrit
   et règle codée, recette finale à jouer.
4. **S4 — Réserve engagée sous son minimum par des irrigations planifiées à
   la main.** Réserve 25 m³, minimum 20, deux irrigations planifiées à la main
   de 4 m³ chacune lundi soir. Attendu : tant que la projection est sous 20,
   aucun créneau nouveau, motif « réserve au minimum de sécurité au moment
   voulu » ; les irrigations planifiées restent, le moteur n'ajoute pas d'eau à
   un manque, il l'annonce ; dès l'heure où l'apport remonte la projection
   au-dessus de 20, les créneaux reprennent (« La garde de la réserve »).
   Vérification : test du moteur (lot 3, D-084) : sur la ferme de test, les
   deux irrigations posées mardi après-midi font tomber la projection à
   18,09 m³ à 15 h ; aucun créneau avant 18 h 44, le premier dit « dès que
   la réserve a l'eau nécessaire », rien n'est ajouté aux deux tunnels ;
   ligne de recette finale (jamais joué). État : 🟡 test écrit, recette
   finale à jouer.
5. **S5 — Restriction : limite journalière d'irrigation (arrêté).** Cinq
   variantes. (a) Tous les jours de l'horizon limités à 10 m³ : le budget de
   chaque chaîne est borné par ce que la limite laisse, la coupe se nomme
   « limite journalière », aucun jour ne dépasse, chaque jour limité se
   remplit au plus à 10,00 m³ (recette T4b). (b) Un jour de l'horizon sans
   limite : la limite ne borne pas le budget de la semaine, ce jour prend ce
   que plages et pompe permettent, la limite reste vérifiée créneau par
   créneau les jours limités (point 35). (c) Limite à partir de mercredi :
   mardi sans limite. (d) Les irrigations réalisées et validées du jour
   comptent dans la limite, réalisé compris. (e) Un volume inconnu — aspersion
   sur une planche sans passe-pied — n'est jamais proposé un jour limité,
   motif « volume inconnu sous une limite journalière ». Vérification : tests
   « restriction » et « point 35 » (existants, a à c) ; T4b (prouvé) ; (d) et
   (e) à vérifier dans les tests, à écrire s'ils manquent. Relevé au lot 3
   (D-084), en reproduisant le point 54 : (a) ne tient pas pour un créneau
   à cheval sur minuit dont le premier jour est déjà plein ; sur la ferme
   des tests à la taille de la ferme réelle, une limite de 15 m³ par jour
   laisse 22,10 m³ le jeudi (point ouvert 58). Corrigé le 9 novembre 2026
   (D-085) : le créneau se juge jour par jour depuis son début et part à
   minuit quand son premier jour est plein ; aucun jour ne passe plus sa
   limite (`tests/planning-daily-limits.test.ts`). État : 🟡, (a) ✅
   test, (d) et (e) à vérifier.
6. **S6 — Temps de pompage et eau à la fois.** Les quatre rampes de serre
   (10,24 m³/h pour une pompe à 8) sur une plage d'aspersion réduite à
   21 h – 0 h, et une réserve à 5 m³. Attendu : deux manques distincts, chacun
   chiffré et nommé — l'eau, « stock et ressources insuffisants d'ici
   dimanche » ; le temps, « temps de pompage insuffisant dans les plages
   horaires » — ; ni l'un n'entre dans l'autre ; la note du manque d'eau
   (D-038) n'impute au temps de pompage que ce qui lui revient. Vérification :
   test du moteur essayé au lot 3, rouge, versé avec sa correction : le
   manque d'une planche coupée à la fois par l'eau et par le temps de
   pompage — ou l'espacement — se compte en entier sous le premier de ses
   motifs dans l'ordre alphabétique ; sur la ferme de test, dimanche soir,
   4,48 m³ pour 12,07 m³ demandés se lisent « Manque d'eau 0 m³ » et
   « Temps de pompage manquant 6,25 m³ » (point ouvert 56) ; « pompe
   saturée » existant pour la pompe seule. Corrigé le 9 novembre 2026
   (D-087) : le manque d'une planche se partage entre la coupe de sa part,
   en manque d'eau, et son placement ; sur le même cas, 6,95 m³ de manque
   d'eau, 0,64 m³ de temps de pompage, 0,47 m³ d'espacement
   (`tests/planning-shortage-scenarios.test.ts`). État : 🟡 test ✅,
   recette finale ⬜.
7. **S7 — Stock inconnu.** Réserve sans jauge. Attendu : créneaux proposés
   « eau non vérifiée », aucun budget sur cette chaîne, le résumé dit que le
   manque d'eau ne peut pas être chiffré ; jamais un zéro (D-003) ; la note se
   tait. Vérification : test du moteur (lot 3, D-084) : créneaux non
   vérifiés, aucun budget chiffré, aucune coupe, la note se tait ; mais le
   résumé écrit « Manque d'eau 0,00 m³ » (point ouvert 51). Corrigé le
   9 novembre 2026 (D-089) : la carte dit « non chiffré », ou « au moins
   X m³ » quand une autre chaîne chiffre un manque, et la ligne de résumé
   du téléphone de même (`tests/planning-shortage-scenarios.test.ts`).
   Test seulement : la jauge de la vraie réserve ne se vide pas pour un
   essai. État : 🟡 test ✅, recette finale ⬜.
8. **S8 — Origine indisponible, pompe archivée, ressource inactive sur la
   période.** Attendu : aucun créneau sur cette chaîne, motif « origine d'eau
   ou pompe indisponible » ; les autres chaînes inchangées ; un matériel sans
   pompe habituelle reste proposé « non vérifié ». Vérification : test du
   moteur (lot 3, D-084) pour la réserve inactive — aucun créneau sur sa
   chaîne, ce motif sur ses vingt-deux planches, la chaîne d'une source
   inchangée — et test existant « matériel sans pompe » ; mais la pompe
   archivée laisse son matériel proposé « non vérifié » (point ouvert 52),
   et une ressource directe inactive, ou hors de sa période, se nomme « stock
   et ressources insuffisants d'ici dimanche », la ligne de budget d'une
   réserve inactive montrant son stock comme mobilisable (point ouvert 53).
   Corrigé le 9 novembre 2026 (D-088) : une chaîne dont rien ne peut venir
   d'ici dimanche n'entre dans aucun partage, ses planches portent ce motif
   avant la conduite, sa ligne de budget dit « indisponible cette semaine,
   aucune eau mobilisable », et les matériels d'une pompe archivée forment
   une chaîne à part ; quatre tests (`tests/planning-shortage-scenarios.test.ts`),
   arbitrage compris. État : 🟡 test ✅, recette finale ⬜.
9. **S9 — Deux chaînes d'eau.** La ferme de test avec une seconde chaîne :
   une ressource directe à limite de prélèvement 2 m³/jour, sa pompe à
   3 m³/h, pour deux rampes de bloc ; la réserve en pénurie et la ressource
   non, puis l'inverse. Attendu : une ligne de budget par chaîne, chacune avec
   ses fractions ; la pénurie d'une chaîne ne touche pas l'autre ; une planche
   n'est comptée que sur la chaîne du matériel qui la sert (R12) ; la somme
   des volumes de chaque chaîne ≤ son budget. Vérification : fixtures
   étendues (`withDirectChain`) et test du moteur (lot 3, D-084), sur la
   ferme en taille, les rampes des blocs 3 et 4 sur la source : tout ce qui
   précède tient, dans les deux sens ; mais la source tire 4 m³ le mercredi
   pour une limite de 2 m³ par jour — un créneau raccourci à cheval sur
   minuit se vérifie sur les deux jours, puis se place sur le premier (point
   ouvert 54) — et sa coupe se nomme « réserve « Source du bas » au minimum
   de sécurité » (point ouvert 55). Corrigés le 9 novembre 2026 (D-085) : la
   source donne au plus 2,00 m³ chaque jour, et sa coupe se nomme « limite
   de prélèvement de « Source du bas » atteinte »
   (`tests/planning-daily-limits.test.ts`). Sur la ferme de démonstration,
   le parcours P32 (lot 4, D-091) lit la ligne de budget de sa chaîne parmi
   celles des matériels sans pompe que les autres parcours laissent ; il ne
   fabrique pas de seconde chaîne chiffrée, que le test prouve dans les deux
   sens. État : 🟡 test ✅, P32 pour une chaîne.

### B. La conduite en pénurie (R9)

10. **S10 — Prioritaires d'abord, puis part égale, sur trois niveaux.**
    Tunnels 1 et 2 « Haute », blocs « Normale », tunnels 3 et 4 « Basse » ;
    réserve 12 m³, forage à l'arrêt, 17,83 m³ demandés. Attendu : la haute
    (5,12 m³) servie à 100 % ; la normale (7,588 m³) à (12 − 5,12) / 7,588 =
    91 %, même fraction sur chaque planche ; la basse (5,12 m³) à 0 %, motif
    « stock et ressources insuffisants d'ici dimanche » ; aucune planche
    haute ne porte de motif d'eau ; somme ≤ 12 m³ ; les fractions affichées
    sont les parts de départ, non le résultat (D-037). Vérification : test
    « manque d'eau » étendu à trois niveaux — il n'a pas de planche basse
    aujourd'hui — ; les fractions et la part placée de chaque niveau le sont
    depuis la correction 2 (`tests/planning-shortage.test.ts`, D-079), les
    motifs depuis le lot 3 (D-084) : la basse ne porte que « stock et
    ressources insuffisants d'ici dimanche », la haute aucun motif ; recette
    finale avec des priorités posées par le porteur (décision 3). État : ✅
    test, ⬜ recette.
11. **S11 — Part égale pour toutes.** Mêmes données, R9 « part égale ».
    Attendu : 12 / 17,83 = 67 % pour chaque planche, quel que soit son
    niveau ; motif sur toutes ; somme ≤ 12 m³. Vérification : test existant
    (une assertion) à compléter ; recette finale, jamais joué sur la ferme
    (décision 6). État : 🟡.
12. **S12 — Report.** Mêmes données, R9 « report ». Attendu : les planches
    servies en entier dans l'ordre de service — priorité, déficit relatif,
    inventaire — jusqu'à épuisement du budget ; les suivantes « reportée :
    passe en tête après le prochain événement (conduite « report ») »,
    cible 0, manque entier ; au calcul suivant, les reportées ne passent
    devant qu'après un événement, et sans événement le calcul reproduit le
    précédent (décision 4 ; le motif disait « reportée au prochain calcul »,
    ce que le calcul sans événement ne fait plus, D-080).
    Vérification : test existant (sommaire) ; tests sur deux calculs, avec
    et sans événement, sur le moteur et sur le service
    (`tests/planning-shortage.test.ts`, `tests/db/planning-service.test.ts`,
    D-080) ; recette finale, jamais joué (décision 6). État : 🟡 tests
    écrits et règle codée, recette finale à jouer.
13. **S13 — Arbitrage 3.4 validé.** Décision validée pour la semaine : tunnel
    1 servi en entier, tunnel 2 exclu, blocs à 50 %. Attendu : les allocations
    s'imposent, la cible de chaque planche est son allocation ; aucune ligne
    de budget ni fraction ; une planche exclue porte le motif de l'arbitrage ;
    un arbitrage caduc ou vide ne s'impose pas, la conduite s'applique ; la
    dernière planche examinée reçoit son allocation comme la première,
    chaque allocation étant une part réservée, sans redistribution entre
    planches, l'eau non reçue restant non attribuée (décision 1).
    Vérification : tests existants (« un arbitrage validé s'impose », « un
    arbitrage vide ») ; test « dernière planche examinée sous arbitrage » à
    écrire, rouge tant que la décision 1 n'est pas codée ; recette finale :
    arbitrage validé à l'écran de la faisabilité puis plan calculé (la
    recette 3.4 l'a joué pour la faisabilité, jamais pour le plan). État : 🟡
    test écrit et règle codée (`tests/planning-shortage.test.ts`, D-077, #11),
    recette finale à jouer.

### C. La part réservée (D-037)

14. **S14 — La dernière planche examinée reçoit sa part.** Attendu : D-037,
    sans changement. Vérification : test existant ; cinquième recette
    (prouvé). État : ✅, à rejouer.
15. **S15 — Créneau raccourci par ses parts.** Une rampe dont les planches
    ont ensemble une part plus petite que la dose minimale fois leur surface.
    Attendu : le créneau est raccourci à ce que ses parts paient, dose « la
    part de la semaine réservée à ses planches », contrainte « part de la
    semaine atteinte, le reste est réservé aux autres planches » ; sous la
    dose minimale, le matériel ne part pas et attend une part plus grande.
    Vérification : test existant ; ligne de recette finale (jamais vu sur la
    ferme). État : 🟡.
16. **S16 — Débordement d'une rampe sur des planches sans part.** Une rampe de
    serre qui mouille aussi deux planches du bloc 1 à 2 mm/h, sous la part
    R13. Attendu : l'eau versée à côté est prise sur l'eau non attribuée puis
    sur les parts des planches servies, jamais sur celles des autres ; les
    planches débordées gardent leur eau comptée dans les besoins et
    l'historique, avec « portée du matériel insuffisante » (D-025).
    Vérification : test existant ; ligne de recette finale sur les rampes de
    bloc de la ferme, qui débordent à 1,5 mm/h sur la planche voisine (jamais
    vu). État : 🟡.
17. **S17 — Libération des parts en fin de tour.** Une planche arrosée la
    veille, que l'espacement R7 empêche de recevoir sa part. Attendu : sa part
    est libérée à la fin du tour et redistribuée par la conduite aux planches
    encore sous leur besoin que leur matériel peut servir ; leur cible monte ;
    les fractions affichées restent celles du départ ; quatre tours au plus.
    Vérification : test existant ; ligne de recette finale (jamais vu).
    État : 🟡.
18. **S18 — Sous la dose minimale en pénurie, et le dernier jour.** Une part
    sous la dose minimale R4 en milieu de semaine : le matériel attend
    (existant), le samedi compris. La même part le dimanche, dernière plage
    de la semaine : placée, comme l'exception du dernier jour hors pénurie
    (décision 5), à ce que ses parts paient quand le matériel est examiné,
    sans attendre la redistribution de fin de tour ; sous arbitrage aussi,
    l'allocation ne reste plus non attribuée.
    Vérification : tests du moteur, avec et sans arbitrage
    (`tests/planning-shortage.test.ts`, D-081). État : ✅ tests écrits et
    règle codée ; la recette finale le croise en S27, le dimanche soir.
19. **S19 — La note du manque d'eau.** Trois branches : positive, de l'eau
    placée à côté (une rampe qui arrose des planches sans part) ; silence sur
    le résidu d'arrondi (D-040) ; absente sous arbitrage et quand un volume
    est inconnu. Vérification : tests existants ; la branche positive jamais
    vue sur la ferme, ligne de recette finale sur une rampe de bloc. État : 🟡.

### D. La pénurie dans le temps de la semaine

20. **S20 — Validation en pénurie.** La pénurie de la cinquième recette, les
    quatre tunnels pour 5 m³ ; les propositions des tunnels 1 et 2 validées,
    puis recalcul. Attendu : les deux irrigations validées comptent dans le
    budget comme prélèvements placés et dans les besoins ; les tunnels 3 et 4
    gardent leur part, mêmes doses qu'avant ; aucune planche validée ne reçoit
    une seconde proposition ; validé plus proposé ≤ budget ; la réserve jamais
    sous le minimum avec les deux. Vérification : test du moteur avec
    irrigations validées (fixture `plannedIrrigation`) et test de persistance
    du service (`tests/db/planning-service.test.ts`, `planning-validation`) à
    vérifier, à écrire s'ils manquent ; recette finale (jamais joué).
    Test du moteur essayé au lot 3, rouge, versé avec sa correction : après
    la validation des tunnels 1 et 2, les parts se recalculent sur le reste
    du budget et des besoins ; les tunnels 3 et 4 tombent de 9,76 à 6,46 mm,
    0,85 m³ restent dans la réserve, et chaque tunnel validé garde une part
    de 1,42 mm à placer (point ouvert 57). Corrigé le 9 novembre 2026
    (D-086) : l'eau validée compte comme déjà placée dans la part de sa
    planche ; les tunnels 3 et 4 gardent leurs 9,76 mm, aucun tunnel validé
    ne reçoit de seconde proposition, rien ne reste dans la réserve ; sous
    un arbitrage, de même ; un arrosage validé au-delà de sa part rejoue la
    conduite (cas limite tranché par le porteur le 9 novembre 2026). Tests
    du moteur (`tests/planning-shortage-scenarios.test.ts`, cinq tests) et
    du service, de la validation au recalcul
    (`tests/db/planning-validation.test.ts`).
    Sur la ferme de démonstration, P32 valide une proposition en pénurie :
    au recalcul, l'eau mobilisable baisse de son volume, la planche validée
    ne reçoit rien de plus, l'autre ligne garde sa dose (D-091).
    État : 🟡 tests ✅, P32 ✅, recette finale ⬜.
21. **S21 — Refus en pénurie** (D-030, moteur de la 3.7). La proposition du
    tunnel 1 refusée. Attendu : le créneau refusé exclu pour la semaine ; le
    besoin du tunnel 1 placé ailleurs avec la même part ; si aucun autre
    créneau n'est possible, « créneau refusé » dans « Non placé » (3.7,
    règle 2) et sa part libérée en fin de tour aux autres tunnels, comme toute
    part qu'une planche ne peut pas recevoir (D-037) ; somme ≤ budget.
    Vérification : deux tests du moteur, écrits au lot 4
    (`tests/planning-shortage-scenarios.test.ts`, D-091) — le créneau refusé
    évité, le tunnel 1 replacé ailleurs avec la même part, les autres tunnels
    gardant la leur ; la semaine entière refusée, « créneau refusé » et la
    cible des trois autres relevée de sa part, le supplément sous la dose
    minimale attendant comme un reste hors pénurie (D-081) — ; P32 refuse une
    proposition en pénurie sur la ferme de démonstration ; recette finale.
    État : 🟡 tests ✅, P32 ✅, recette finale ⬜.
22. **S22 — Restriction posée après coup** (3.7, règle 16 ; décision 3 du
    porteur). Des arrosages validés d'un jour dépassent une limite posée
    ensuite. Attendu : le jour signalé, suggestions « Réduire à … mm » en
    suivant R9 à l'envers — basse, puis normale, puis haute ; même fraction
    dans le niveau entamé — et « Annuler » sous la dose minimale ; jamais
    appliqué seul. Vérification : test de la 3.7, rejoué en non-régression ;
    ligne de recette finale. État : attend la 3.7.
23. **S23 — Pluie prévue en pénurie.** 12 mm annoncés jeudi, réserve en
    pénurie. Attendu : le plein champ attend vendredi (R3) avec son besoin
    réduit de la pluie (R2 à 100 %), sa part calculée sur ce besoin réduit ;
    les tunnels, sous abri, servis selon la conduite. Vendredi, réanalyse à
    2 mm : recalcul, le besoin du plein champ remonte de 10 mm, l'eau déjà
    placée ou validée n'est pas reprise, le manque grandit et le dit.
    Information R2 : décision 7, aucune règle. Vérification : test « pluie prévue »
    existant ; test en pénurie sur deux calculs (lot 3, D-084) : mardi, le
    plein champ attend vendredi, sa part prise sur 8 mm ; vendredi, à 18 mm,
    le budget part des 2,32 m³ observés et le manque passe de 3,31 à
    8,59 m³. État : ✅ test, à rejouer en recette finale.
24. **S24 — Semaine entamée.** Jeudi midi, irrigations réalisées du lundi au
    mercredi, réserve basse. Attendu : le budget part du stock observé
    maintenant ; les parts se calculent sur les besoins restants ; les jours
    écoulés ne reçoivent rien ; la limite journalière du jeudi compte le
    réalisé du jeudi. Vérification : test du moteur (lot 3, D-084) : budget
    de 4 m³ observés, parts sur 9,22 m³ restants ; sans l'arrosage du jeudi
    matin, la rampe du bloc 2 part jeudi soir, avec lui vendredi à minuit
    (D-085), la limite de 2 m³ du jeudi comptant ses 0,924 m³. État : ✅
    test.
25. **S25 — Même calcul deux fois en pénurie.** Attendu : identique, aucune
    proposition « remplacée » (règle 11 du planning, règle 9 de la 3.7).
    Vérification : test existant (limite journalière, quatre tunnels), à
    étendre aux parts, à l'arbitrage et aux refus. État : 🟡.
26. **S26 — Sensibilité à l'heure du calcul.** Mêmes entrées, l'instant du
    calcul décalé de deux minutes. Attendu : les deux plans respectent les
    invariants ; les créneaux déplacés et l'écart du volume placé sont relevés
    et écrits dans le compte rendu. C'est un relevé, pas une garde : un écart
    de volume placé plus grand que l'apport perdu est un constat au jugement
    du porteur, pas un défaut, tant qu'aucune règle ne dit autre chose.
    Vérification : test de relevé (lot 3, D-084), en pénurie, le forage à
    0,05 m³/h : huit créneaux sur huit déplacés de quelques secondes ou de
    deux minutes, 10,6866 puis 10,6850 m³ placés, un écart de 0,0016 m³ pour
    0,0017 m³ d'apport perdu ; recette finale, deux recalculs à deux minutes
    d'écart sur le même état. État : ✅ relevé, ⬜ recette.
27. **S27 — Dimanche soir et lundi.** Dimanche 23 h en pénurie, puis lundi.
    Attendu : dimanche, le manque reste affiché, un reste sous la dose
    minimale placé tant qu'une plage reste, une part aussi (décision 5) ;
    lundi 06 h 15, la semaine nouvelle repart de l'objectif entier,
    sans report (R10 à non) ; le déficit de la semaine passée se lit dans les
    cumuls « Par périmètre », écart objectif − reçu. Vérification : test
    « dernier jour » existant ; tests S18 pour la part (D-081) ; test de
    l'historique existant ; recette finale, lecture du lundi. État : 🟡.

### E. L'isolation en pénurie

28. **S28 — Deux exploitations, même saison, même semaine.** A en pénurie,
    avec ses réglages R9, son arbitrage, ses refus et ses propositions ; B
    non. Attendu : rien de A ne paraît dans le plan, les réglages, l'arbitrage,
    les refus, les suggestions ni les notifications de B ; une proposition de
    A ne se valide pas depuis B ; l'échec du recalcul du matin de A ne gêne pas
    B. Vérification : tests de persistance existants relus un par un
    (`planning-repository`, `planning-validation`, `planning-service`,
    `irrigation-arbitration-repository`) ; le test d'isolation du lot 3
    (`tests/db/planning-service.test.ts`, D-084) : A en pénurie, sous le
    report, avec un refus, un arbitrage enregistré et une suggestion
    notifiée ; B, la même semaine, n'en voit rien, ne décide pas d'une
    proposition de A, et reçoit son calcul du matin quand celui de A échoue ;
    les manquants écrits dans la revue de sécurité. État : ✅ test, revue de
    sécurité à faire.

### Ce que la liste couvre, et ce qu'elle ne couvre pas

Les sources du manque (S1 à S9), les trois conduites et l'arbitrage (S10 à
S13), le mécanisme des parts (S14 à S19), la semaine qui avance (S20 à S27),
l'isolation (S28). Elle ne couvre pas : les restrictions horaires (Q10 du
planning, « plus tard ») ; les pompes de transfert ; le planning par série ;
une pénurie d'électricité ou de pression ; la pénurie du sol, qui n'existe pas
dans le logiciel — la réserve du sol est une information (D-041).

## Les jeux de données

Trois fermes, chacune pour ce qu'elle prouve.

1. **La ferme en chiffres** (`tests/support/planning-fixtures.ts`), celle des
   tests du moteur, aux valeurs de la ferme réelle. La 3.9 l'étend sans la
   changer : des planches en priorité basse ; une seconde chaîne d'eau, une
   ressource directe à limite de prélèvement et sa pompe ; une pompe archivée ;
   une réserve sans jauge ; des irrigations planifiées à la main ; des refus
   (3.7) ; un matériel retiré (2.11). Elle reste un fichier de test, sans base
   de données. `tests/support/irrigation-fixtures.ts` sert les tests de
   persistance à deux exploitations.
2. **La ferme de démonstration** (`lib/adapters/mock-data.ts`,
   `mock-crop-plan.ts`, météo de démonstration), celle des parcours navigateur,
   quinze planches sur quatre saisons. Un parcours nouveau, **P32 « Planifier
   en pénurie »** (le P13 de l'écriture, numéro pris depuis par les alertes
   météo), aux deux largeurs : il crée sa réserve (10 m³ observés à 0,3 m³,
   minimum 0), sa pompe, deux goutte-à-goutte, l'un sur N02, l'autre sur N03,
   et un objectif ; calcule le plan ; lit la ligne de budget, les fractions,
   la liste « Non placé » et son motif, la justification d'une carte en
   pénurie ; valide une proposition en pénurie et constate qu'elle compte au
   recalcul —
   l'eau mobilisable baisse de son volume, l'autre ligne garde sa dose
   (S20) — ; refuse une proposition, replacée hors du créneau refusé (S21) ;
   puis remet tout en état. Il crée sa propre situation et la rend, ne dépend
   ni du jour ni de la minute (`docs/browser-journeys-contract.md`).
   Précisé à son écriture, le 9 novembre 2026 (D-091) : 0,3 m³ et non 2 m³,
   pour que la part de chaque planche, 5,9 mm, tienne dans un seul arrosage
   sous la dose maximale du goutte-à-goutte (10 mm), quel que soit le jour,
   quand 2 m³ donnaient 40 mm à placer en quatre arrosages, que la semaine
   n'offre plus à partir du vendredi ; N02 et N03 et non N01 à N03, parce que
   les parcours précédents laissent sur N01 leurs lignes, dont une à 25 mm/h
   qui la servirait (R12), et leurs irrigations, qui changent son besoin ;
   deux lignes et non une, pour que la validation de l'une laisse à l'autre
   sa proposition, à comparer puis à refuser. Une ligne qui n'arrose que sa
   planche n'est pas raccourcie par les parts : sa dose est la part de sa
   planche, et la coupe (S15), qui demande un créneau versant aussi sur
   d'autres planches, reste prouvée par le test du moteur ; P32 lit la dose
   de la carte, la réserve et la faisabilité de sa justification, pas le
   motif de la dose, qui dit encore « le besoin restant de la planche la plus
   demandeuse » pour cette part (point ouvert 61). La fiche d'une pompe ne
   voit une réserve créée qu'après le rechargement de la page (point ouvert
   60) : P32 recharge entre les deux.
3. **La ferme réelle**, pour la recette finale seulement, sur le « vas-y » du
   porteur, données expérimentales relevées et remises en état par l'écran.
   Aucun export de la ferme n'est versionné (`AGENTS.md`, sécurité) : ses
   chiffres vivent déjà dans la ferme en chiffres.

La 3.9 n'ajoute aucun jeu de données à l'application elle-même, ni script de
peuplement : les trois fermes existent déjà, la première et la deuxième
s'étendent.

## La non-régression complète

Sur la version qui clôt la tranche, dans l'ordre, sorties réelles collées
dans `docs/ETAT_DU_PROJET.md` et dans la PR :

1. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm knip`,
   `pnpm push:check`, `pnpm weather:check`, `pnpm e2e` — tous, aucune omission
   « sans rapport » pour la clôture d'une tranche.
2. Les tests du moteur, dont les invariants sur deux cents semaines tirées au
   hasard, étendus aux parts, aux refus, à l'arbitrage et à deux chaînes ; le
   budget de temps du calcul de la grande ferme (500 ms, D-031).
3. Les tests de persistance sur toutes les migrations, de `0000` à la
   dernière, sur une base neuve (test de dérive de schéma).
4. Les parcours navigateur, P0 à P32 (P1 à P13 quand ce contrat s'est
   écrit), à 1 280 et 390 px, leur durée relevée — « sous cinq minutes »
   valait pour treize parcours, les 86 d'aujourd'hui en prennent onze
   environ (précisé au lot 4, D-091) —,
   sans débordement ni erreur de console.
5. **La relecture des registres** contre le dépôt et Git : chaque ligne 🟡 ou
   ⬜ de la section 1 et de l'ordre de la section 2 de la roadmap, chaque point
   ouvert de l'état, chaque décision citée par un contrat, vérifiés à la
   source ; un registre qui ment est pire qu'un registre absent (`AGENTS.md`).
   Les écarts trouvés sont corrigés par la PR de clôture, listés dans son
   compte rendu.
6. Les scénarios S1 à S28, chacun avec sa preuve ou la mention « non
   vérifié ».

## La revue de sécurité des frontières et de l'isolation

Une lecture, pas un outil nouveau. Chaque point donne un constat et un verdict
dans `docs/recette-tranche-3.md` ; un défaut devient un point ouvert et une PR
`fix/` à part ; un constat qui demande une décision devient une question au
porteur.

1. **Les frontières** (Q3, `docs/boundaries-contract.md`) : le lint refuse un
   import interdit, prouvé par `tests/lint-boundaries.test.ts` ; `lib/domain/`
   n'importe que le domaine, `db/` n'est importé par aucun composant client
   autrement qu'en type ; aucun littéral d'unité hors `lib/domain/units.ts` ;
   aucun fichier au-dessus de 600 lignes ; `pnpm knip` sans signalement ; les
   deux Workers vérifiés par leurs propres contrôles.
2. **L'isolation des données** : les tables de `db/schema.ts` portent
   l'exploitation (`workspace_id`) ; la revue liste celles qui ne la portent
   pas et dit pourquoi chacune n'en a pas besoin — au 30 octobre 2026, le
   cache OTF, tenu par utilisateur et saison, et les tâches de fond. Chaque dépôt
   de `db/` prend le propriétaire de la session, jamais du formulaire
   (`docs/irrigation-feasibility-contract.md`, règle reprise partout) ; pour
   chaque dépôt, un test de persistance éprouve qu'un autre propriétaire ne lit
   ni n'écrit — treize fichiers de `tests/db/` en portent un aujourd'hui,
   d'après leurs intitulés ; la revue les relit un par un, nomme les dépôts
   sans un tel test et les écrit. Le planning est isolé par
   exploitation, saison et semaine : réglages, calculs, propositions,
   arbitrage, refus, suggestions (S28).
3. **L'authentification** : Cloudflare Access sur chaque requête, le jeton
   vérifié — émetteur, audience, signature, validité — (`app/access-auth.ts`,
   `tests/access-jwt.test.ts`) ; `LOCAL_DEMO_USER` refusé hors développement ;
   la route interne météo n'accepte que son jeton partagé, comparé en temps
   constant ; les Workers se parlent par liaisons de service. La lecture de
   la configuration Access dans le tableau de bord Cloudflare se fait dans le
   Chrome du porteur, sur son mot, en lecture seule, sans rien consigner
   d'identifiant (`AGENTS.md`).
4. **Le connecteur Ouvre ta ferme** : liste blanche, `GET` seulement, quatre
   appels par seconde, 500 par page, cinquante pages au plus, refus explicite
   au-delà (D-002, D-022) ; `tests/read-client.test.ts`.
5. **Les secrets et les journaux** : aucune clé, jeton, cookie ni courriel
   dans le dépôt, les journaux ou la documentation ; `.dev.vars` et les
   exports `*.d1-export.json` ignorés par Git ; les lignes JSON du Worker
   (`planning_calculation_completed`, `irrigation_page_loaded`) sans
   identifiant de personne ni nom de planche ; une lecture unique de
   `pnpm audit`, résultat collé, sans en faire un contrôle de la CI (les lots
   Dependabot restent la règle, Q4).
6. **Les notifications** : le Worker Push ne connaît que l'exploitation
   comme destinataire ; liste blanche d'adresses, déduplication, aucun texte
   personnel (`docs/push-worker-contract.md`).
7. **Ce que la revue ne fait pas** : aucun test d'intrusion, aucun scanner
   nouveau, aucun changement de l'identité (tranche 4, 4.2, 4.3, 4.7).

## La recette finale

Protocole dans `docs/recette-tranche-3.md`, écrit avant la recette, rempli
pendant, sur le modèle de `docs/recette-3.4.md`. Elle se fait sur la version
déployée après la dernière PR de code de la tranche, jamais sur une version
antérieure (D-014) ; les constats sont de l'assistant dans le Chrome du
porteur, le jugement du porteur.

- **0. Préalables** : la version en ligne est celle de `main` attendue
  (commit, date du déploiement, jobs verts) ; la semaine ; l'état de départ
  de la ferme relevé, données expérimentales.
- **A. Lecture sur données réelles, sans rien modifier** : chaque section de
  la tranche 3 — ressources et réserves (3.1), débits (3.1 bis), pompes (3.2),
  besoins (3.3), faisabilité (3.4), planning (3.5, 3.6), suivi et
  replanification (3.7), et les extensions arrivées entre-temps, réserve du
  sol (5 ter), alertes (5 bis), besoin par culture (5 quater), dans la
  disposition de la 3.8 — avec les recoupements d'une section à l'autre :
  besoins totaux = somme des planches ; mobilisable = somme des réserves moins
  leurs minima ; ligne de budget = stock − minimum + apport ; manque = besoin
  non couvert planche par planche.
- **B. La pénurie fabriquée**, sur le « vas-y » du porteur : B1 stock seul
  (S1) ; B2 minimum relevé (S3) ; B3 limite de prélèvement (S2) ; B4
  restriction (S5) ; B5 priorités réelles à trois niveaux (S10, décision 3) ;
  B6 part égale (S11) ; B7 report (S12) ; B8 arbitrage validé puis plan
  (S13) ; B9 validation en pénurie (S20) ; B10 refus en pénurie (S21) ; B11
  restriction posée après coup (S22) ; B12 deux recalculs à deux minutes
  (S26) ; B13 remise en état, le dernier calcul retrouvant le plan du départ.
  L'attendu de chaque calcul est écrit avant de cliquer ; les chiffres sont
  relus carte par carte et refaits à la main, comme le 5 octobre.
- **C. Téléphone, 390 px, sur l'appareil du porteur** : le planning en
  pénurie — ligne de budget, cartes coupées, « Non placé » —, l'écran
  d'arbitrage, les ressources ; la lisibilité est au jugement du porteur.
- **D. La revue de sécurité**, ses sept points et leurs verdicts.
- **E. Clôture** : les KO et leur sort, les points ouverts restants, les
  questions tranchées, la réévaluation Vinext (section suivante), le mot du
  porteur, puis le tag.

Chaque calcul de la recette est chronométré depuis le navigateur ; une
occurrence du 3 s à 45 s rouvre le point 34 et se lit dans les journaux du
Worker (`docs/publication.md`), sur le mot du porteur.

## La publication et le tag

1. **L'ordre** : les PR de code de la 3.9 fusionnées et déployées, une à la
   fois (D-048) ; la recette finale sur la version déployée ; les corrections
   en PR `fix/`, chacune recettée après déploiement ; la PR de clôture —
   registres, journal des changements, version du paquet — fusionnée et son
   déploiement vérifié job par job (D-016) ; le tag.
2. **Le journal des changements** : la section « Non publié » devient
   « 2026-MM — Tranche 3 clôturée (v0.2.0) », sur le modèle des tranches 1 et
   2, au-dessus de « 2026-09 — Tranche 3 en cours », qui reste telle quelle ;
   une section « Non publié » vide repart au-dessus.
3. **La version** : `package.json` passe de `0.1.0` à `0.2.0` dans la PR de
   clôture ; les paquets des deux Workers suivent s'ils portent une version.
4. **Le tag** `v0.2.0`, annoté, posé sur le commit de fusion de la PR de
   clôture, après son déploiement vérifié, sur le mot de clôture du porteur
   (D-014), poussé par l'assistant depuis sa session, jamais par le `gh` du
   poste du porteur ; annoncé en une ligne avec le lien ; consigné dans les
   registres par la PR suivante, une PR de registres n'annonçant pas sa propre
   fusion (`AGENTS.md`).
5. **Ce qui est en ligne est ce qui est tagué** : le job « Déploiement
   Cloudflare » du commit tagué est le dernier déploiement réussi ; aucune
   publication manuelle.
6. **Ce que « publication » ne veut pas dire** : ni ouverture du dépôt ni
   licence (tranche 4, D-013), ni nouvelle adresse, ni annonce au développeur
   d'Ouvre ta ferme — la tranche 4 se cadre avec lui après la 3.9, sur une
   version taguée qu'il peut regarder.

## Les réévaluations promises à la 3.9

- **Vinext** (D-015 ; roadmap, section 7, décision 6). Le risque accepté le
  18 septembre 2026 portait sur une bêta sans version stable ; `1.0.0` est en
  place depuis le 1er octobre 2026 (PR #121). Recommandation : si la version en
  service à la 3.9 est encore une version stable, sans incident depuis, D-015
  est close « risque levé », l'épinglage et les lots de mise à jour restant la
  règle (Q4) ; sinon, le constat et sa suite sont écrits. La décision va dans
  `docs/DECISIONS.md` par la PR de clôture.
- **Le temps de rendu** (D-017, « à surveiller en Q5 puis 3.8 ») : la recette
  relit les totaux de `irrigation_page_loaded` et reprend la mesure avant et
  après de la 3.8 ; aucun seuil nouveau.
- **Le point 34**, en veille : rouvert à la première occurrence, sinon laissé
  tel quel, dit dans le compte rendu.

## Ce qui ne change pas

Les règles tranchées du planning (D-024, D-025, D-030, D-033, D-035, D-037,
D-038, D-040) et de la replanification (décisions du 30 octobre 2026) ; la
part réservée et ses tours ; la garde de la réserve ; la restriction en mètres
cubes par jour ; l'historique immuable (D-006) ; l'ET0 hors de toute dose
(D-010) ; une inconnue qui n'est jamais zéro (D-003) ; la pluie au pluviomètre
qui prime ; une irrigation réelle toujours enregistrable ; une irrigation
planifiée qui ne peut pas démarrer ne compte pas (D-044) ; la réserve du sol
et le besoin par culture, informations (D-041, D-045) ; Ouvre ta ferme lu,
jamais écrit (D-001, D-002) ; l'isolation par exploitation ; les priorités,
celles du maraîcher. Aucun écran nouveau : la 3.8 a rangé les écrans, la 3.9
les lit, à une exception décidée par le porteur : l'écran d'arbitrage (2 bis,
D-078). Les décisions 1, 2, 4 et 5 du porteur, prises le 30 octobre 2026,
précisent quatre règles sans en contredire aucune ; elles sont consignées en
fin de document et dans `docs/DECISIONS.md` (D-052).

## Hors périmètre

La tranche 4 — identité, droits et isolation multi-structure, intégration et
accueil d'une nouvelle ferme, sauvegardes, pilote multi-fermes — ; l'ouverture
du dépôt et sa licence ; les restrictions horaires d'un arrêté (Q10 du
planning) ; les pompes de transfert ; toute règle agronomique nouvelle
(sensibilité des cultures, besoin par stade dans la dose) ; une alerte sur la
réserve d'eau ; le plan au-delà de la semaine courante ; toute automatisation
d'arrosage.

## L'écran d'arbitrage façon plan d'assolement (2 bis)

**La demande.** Le 7 novembre 2026, le porteur trouve la partie arbitrage
« illisible » : « il faudrait qu'on sache quelles sont les cultures déjà
présentes sur ces planches pour savoir si on les arrose ou pas », en reprenant
« le principe du plan d'assolement d'Ouvre ta ferme », pour « que les besoins
en eau soient faciles à répartir ». Décidé par lui le 8 novembre 2026 (D-078) ;
maquette sur des données d'exemple soumise le même jour à 22 h 55, validée par
lui le 9 novembre 2026 à 11 h 40 (D-083). Ce qui suit l'écrit pour le code.

**Ce qui ne change pas.** Le calcul : la part d'une planche cochée reste celle
de la faisabilité (3.4, `docs/irrigation-feasibility-contract.md`), la même
fraction du besoin pour toutes les cochées, bornée par l'eau du niveau et par
l'hydraulique. La décision enregistrée, sa garde (révision et signature) et
son journal. Le planning, qui réserve sa part à chaque planche servie sans la
redistribuer (décision 1, D-077). Les niveaux sans choix à faire — allocation
automatique, en attente, choix plus applicable —, présentés comme avant.
Aucune règle agronomique : les cultures, leur stade et leur Kc s'affichent
pour aider le choix et n'entrent dans aucun calcul.

**L'écran**, pour chaque niveau de priorité qui demande un choix (à faire, à
valider de nouveau, ou enregistré) :

1. **Le bilan du choix**, en quatre chiffres : l'eau disponible pour ce
   niveau d'ici dimanche soir, après les niveaux précédents ; le besoin des
   planches cochées, sur celui de toutes les planches à choisir ; ce que
   reçoit chaque planche cochée, en pour cent de son besoin, la même part pour
   toutes ; les planches servies, sur les planches à choisir. Puis la
   répartition de l'eau disponible en une barre : un segment par planche
   servie, l'eau sous le seuil, et le reste.
2. **Les planches rangées comme un plan d'assolement** : par parcelle, puis
   par jardin ou abri, marqué « Abri » ou « Plein champ », avec son résumé
   (planches, servies, besoin, part). Une ligne par planche : la case
   « Servir », le nom et la surface, la frise de ses cultures, « Cette
   semaine », le besoin en mm et en m³, et la part d'eau en mm et en m³ avec
   son pourcentage, « Non servie » pour une planche décochée.
3. **La frise** couvre dix-huit semaines à l'ordinateur — les huit
   précédentes, la semaine en cours, marquée, et les neuf suivantes —, huit au
   téléphone (trois avant, quatre après). Chaque culture de la planche y est
   une barre, de son premier jour sur la planche à la fin de sa dernière
   semaine de récolte, la récolte hachurée ; une culture qui n'est pas encore
   sur la planche est en pointillé, dite « prévu » ; une fin inconnue mène la
   barre au bord de la frise. Les cultures et leurs dates sont celles du suivi
   par série (`docs/series-contract.md`, `lib/domain/crop-water/crop-calendar.ts`),
   lues dans le plan de culture d'Ouvre ta ferme : une série en bloc ou sans
   implantation n'y figure pas. Plan de culture non lu : pas de frise, et
   l'écran le dit.
4. **« Cette semaine »** : une phrase sur la culture en place la plus
   ancienne de la planche, celle de la première règle qui s'applique :
   - la dernière semaine de récolte est la semaine en cours : « Dernière
     semaine de récolte » ;
   - la première semaine de récolte est la semaine en cours : « Première
     récolte cette semaine » ; la précédente : « Première récolte la semaine
     dernière » ;
   - la récolte a commencé : « En récolte jusqu'au 16 août », le dimanche de
     la dernière semaine de récolte, ou « En récolte » quand elle est
     inconnue ;
   - la première semaine de récolte est la suivante : « Première récolte la
     semaine prochaine » ;
   - la culture a été semée ou plantée dans la semaine en cours ou dans l'une
     des deux précédentes : « Semis » ou « Plantation » « cette semaine », « la
     semaine dernière » ou « il y a deux semaines » ;
   - la première récolte est connue : « Récolte à partir du 28 septembre » ;
     sinon : « En place depuis le 4 mai » ;
   - aucune culture en place : « Planche nue depuis le 13 juillet », le
     lendemain de la fin de la dernière culture, ou « Planche nue ».

   En dessous, à titre d'information : le stade et le Kc du jour de chaque
   culture en place, tels que le besoin par culture les calcule
   (`docs/crop-water-need-contract.md`), chacun précédé du nom de la culture
   quand il y en a plusieurs, « engrais vert » pour un engrais vert ; puis la
   prochaine culture prévue sur la planche : « Épinard à partir du 24 août ».
5. **Au départ, toutes les planches à choisir sont cochées** : c'est la
   proposition. Rien n'est enregistré avant « Valider la répartition ».
   Décocher une planche la retire du partage et monte la part des autres. À
   chaque case, la part et le bilan se recalculent dans le navigateur, sans
   requête, par le calcul même du serveur (`allocateIrrigationWater`) : la
   validation retrouve ces chiffres tant que rien n'a changé. « Tout servir »
   et « Ne rien servir » cochent ou décochent les planches à choisir d'un
   jardin ; « Revenir à la proposition » les recoche toutes.
6. Un choix enregistré et toujours valable s'affiche tel quel, « Répartition
   validée », avec sa date. Un choix devenu caduc (« à valider de nouveau »)
   repart de la proposition : ses exclusions ne ressuscitent pas (3.4).
7. **Le seuil** : une part sous le seuil de planification de sa planche n'est
   pas transmise au planning (3.4). La ligne le dit (« Sous le seuil de 3 mm :
   pas transmise au planning »), le bilan aussi, avec le conseil de servir
   moins de planches pour que chacune reçoive davantage. Une planche qu'aucune
   alimentation compatible ne peut servir le dit sur sa ligne.
8. **Deux vues** : « Planches à choisir », celles du niveau qui ont un besoin,
   et « Toute la ferme », où chaque autre planche porte son état — servie
   avant ce choix, en attente, sans besoin, données insuffisantes. Deux
   lignes rappellent ce que reçoivent les niveaux d'avant et d'après.
9. **Au téléphone** : une carte par planche, la frise sur huit semaines, la
   validation au pied de l'écran ; aucun défilement de côté ; les cases, les
   boutons et leurs étiquettes à 44 px au moins.

**Le coût.** Les cultures et leur stade ne se lisent que pour cet écran, quand
un niveau demande un choix, dans le chargement de la faisabilité, sans requête
par planche ni appel à Ouvre ta ferme ou au service météo. Le planning, qui
relit la faisabilité, ne les lit pas.

**Vérifié par** `tests/arbitration-preview.test.ts` (la part recalculée dans
le navigateur égale celle que le serveur calcule une fois le choix
enregistré ; décocher monte la part des autres ; le seuil ; aucune planche
cochée), `tests/arbitration-crops.test.ts` (la frise et chaque phrase de
« Cette semaine ») et P7 (les planches à choisir toutes cochées au départ,
« Ne rien servir » sur le jardin de N01 puis N01 recochée, le bilan recalculé
sans rien enregistrer, la répartition validée, aucun débordement à 390 px,
les cibles de 44 px).

## Découpage et preuve de fin

En PR courtes, tests d'abord, chacune verte en CI, fusionnées une à la fois :

1. **Ce contrat et les registres**, à son tour dans la file de fusion.
2. **Les règles tranchées** (décisions 1, 2, 4 et 5 du porteur) : une PR
   `fix/` par règle, contrat du planning précisé avant le code, test rouge
   d'abord — l'arbitrage en parts réservées ; le budget net du manque sous le
   minimum et la part placée à côté de la part visée ; le report sans
   bascule ; la part sous la dose minimale placée le dimanche.
2 bis. **L'écran d'arbitrage présenté comme un plan d'assolement** (retour
   du porteur du 7 novembre 2026, décidé par lui le 8 novembre 2026 à
   20 h 40, D-078) : après les quatre corrections, une maquette d'abord,
   soumise au porteur avant tout code ; son code passe par un ajout à ce
   contrat. Maquette validée par le porteur le 9 novembre 2026 à 11 h 40 ;
   l'ajout est la section « L'écran d'arbitrage façon plan d'assolement »
   (D-083), codée dans une PR.
3. **Les scénarios de pénurie** : les tests manquants du moteur (S2, S3, S4,
   S6, S7, S8, S9, S10 étendu, S12 sur deux calculs, S13 dernière planche,
   S18, S20, S23, S24, S26), dans `tests/planning-shortage.test.ts` et
   `tests/planning-shortage-scenarios.test.ts`, chacun sous 600 lignes, avec
   les fixtures étendues ; le test d'isolation S28 ; aucun changement de
   comportement — un test rouge y est un défaut, corrigé à part. Écrits le
   9 novembre 2026 (D-084) : S3, S12, S13 et S18 l'étaient avec les
   corrections ; S2, S4, S10, S23, S24, S26 et S28 tiennent ; S7, S8 et S9 en
   partie ; huit défauts relevés, points ouverts 51 à 58 — le dernier sur
   S5, hors de la liste, en reproduisant le point 54 —, chacun corrigé
   dans sa PR `fix/`, son test rouge d'abord (58, 54 et 55 le 9 novembre
   2026, D-085 ; 57, 56, 52, 53 et 51 le même jour, D-086 à D-089 ; un
   neuvième, le point 59, relevé en corrigeant 51 et corrigé le même jour,
   D-090) — S6 et S20 y portent leur
   test entier ; aucun test n'est sauté ni marqué « à faire ». Les fixtures
   s'étendent sans changer les tests existants : une irrigation planifiée
   ou validée peut puiser dans la réserve (`fromReserve`), une seconde
   chaîne s'ajoute (`withDirectChain` : une source, sa pompe de 3 m³/h, sa
   limite de prélèvement par jour), et les invariants vérifient chaque
   pompe à son propre débit et la réserve avec ses irrigations planifiées.
4. **Le parcours P32** (le P13 de l'écriture) et le protocole vide de
   `docs/recette-tranche-3.md`. Écrits le 9 novembre 2026 (D-091), avec les
   deux tests du moteur de S21, absents de la liste du point 3 ; deux défauts
   relevés en écrivant P32, points ouverts 60 et 61, chacun corrigé dans sa
   PR `fix/`, son test rouge d'abord.
5. **La revue de sécurité** : ses corrections, une PR par défaut.
6. **La recette finale**, sans PR, sur le « vas-y » du porteur ; son compte
   rendu dans `docs/recette-tranche-3.md`.
7. **La PR de clôture** : registres, journal des changements, version ; puis
   le tag après déploiement vérifié.

Preuve de fin, celle de la roadmap : `docs/recette-tranche-3.md` rempli, CI
verte, tag `v0.2.0` sur le commit déployé, registres et journal des
changements à jour ; et, par ce contrat : chaque scénario S1 à S28 avec sa
preuve ou la mention « non vérifié », la non-régression entière avec ses
sorties réelles, la revue de sécurité avec zéro constat sans décision, zéro
KO bloquant, le mot de clôture du porteur.

Modèle et effort pour le code et la recette : Opus 5.5 · Max (Fable 5.1 · Max
avant D-055), la ligne de la
roadmap pour la 3.9.

## Questions au porteur

Chacune avec ma recommandation et ses raisons ; les réponses du 30 octobre
2026 sont consignées dans la section « Décisions du porteur » qui suit.

1. **Un arbitrage validé en pénurie : ses allocations deviennent-elles des
   parts réservées ?** Aujourd'hui, quand vous avez arbitré dans la
   faisabilité, le moteur prend vos allocations pour cibles mais ne les
   réserve pas : la dernière planche examinée peut ne rien recevoir si les
   créneaux examinés avant elle ont pris l'eau, exactement le défaut du point
   36 que D-037 a corrigé pour la conduite automatique. Recommandation : oui,
   le même mécanisme — chaque allocation est une part réservée —, **sans
   redistribution** entre planches : votre décision est le dernier mot, l'eau
   qu'une planche allouée ne peut pas recevoir reste non attribuée et
   l'écran le dit, comme la faisabilité annonce déjà un reliquat non
   distribuable. L'autre voie, laisser l'arbitrage sans parts, garderait la
   possibilité qu'une planche que vous avez choisie ne soit pas servie.
2. **Le budget annoncé doit-il être celui que le moteur peut vraiment
   placer ?** Quand la réserve est sous son minimum, la ligne de budget compte
   tout l'apport d'ici dimanche sans retirer ce qu'il faut d'abord pour
   remonter la réserve : le 5 octobre, calcul T3, elle annonçait 75,27 m³ et
   « normale 91 % » quand le plan a placé 60,2 m³, soit 73 % ; avec l'apport
   net des 15 m³ manquants, elle aurait annoncé 60,27 m³ et 73 %, ce que le
   plan a fait. Recommandation : oui, en deux points. Le budget retire d'abord
   le manque sous le minimum, pour que les parts correspondent à l'eau que la
   garde laisse passer et se répartissent entre toutes les planches plutôt que
   « 91 % aux unes, rien aux autres ». Et la ligne de budget montre, à côté de
   la part visée, la part effectivement placée par niveau : le trop-plein
   perdu pendant des jours de pluie (T2 : 97 % visés, 84 % placés) ne se
   calcule pas d'avance, mais il se voit. Aucun changement dans ce que le
   moteur place ; seulement dans ce qu'il annonce.
3. **Quelles planches de la ferme en priorité haute et basse pour la recette
   finale ?** Toutes sont « Normale » : la conduite « prioritaires d'abord »
   n'a jamais été vue sur la ferme autrement qu'en part égale. C'est vous qui
   connaissez vos cultures. À titre d'exemple seulement : les tunnels en
   haute, puisque aucune pluie ne peut les sauver ; un bloc de cultures
   établies en basse. Les priorités posées pour la recette sont relevées avant
   et remises après.
4. **Sous la conduite « report », les planches reportées passent-elles devant
   au calcul suivant même quand rien n'a changé ?** Aujourd'hui oui : un
   second calcul sans événement servirait d'abord les reportées et reporterait
   les premières, et le plan basculerait d'un calcul à l'autre, contre la règle
   « même entrée, même plan » que vous avez confirmée pour la 3.7 (règle 9).
   Recommandation : les reportées ne passent devant qu'au calcul qui suit un
   événement — de l'eau nouvelle, un arrosage validé ou fait, un stock
   corrigé — ; sans événement, le calcul reproduit le précédent. Le report
   reste une file d'attente, mais une file qui n'avance que quand quelque
   chose s'est passé.
5. **Le dimanche, une part sous la dose minimale est-elle placée ?** Hors
   pénurie, un reste sous la dose minimale est placé le dernier jour tant
   qu'une plage reste (« exception du dernier jour ») ; en pénurie, un
   matériel dont la part est sous la dose minimale attend une part plus
   grande. Le dimanche, rien ne dit lequel l'emporte. Recommandation : la même
   exception, la part est placée, pour ne pas laisser dans la réserve une eau
   que personne n'aura. Si un millimètre d'aspersion le dimanche soir vous
   paraît de l'eau perdue, dites-le : la part restera dans la réserve et le
   manque le dira.
6. **La recette finale en pénurie fabriquée sur la ferme réelle.** Les trois
   conduites, la restriction, l'arbitrage, la validation et le refus en
   pénurie n'ont jamais été joués ensemble sur la ferme, et deux conduites ne
   l'ont jamais été du tout. Recommandation : les jouer tous, une fois chacun,
   sur les données expérimentales relevées et remises en état par l'écran,
   une semaine où la ferme arrose peu, sur votre « vas-y » le jour même ; le
   jugement reste le vôtre. Sans cela, ces conduites ne seraient prouvées que
   par les tests, ce que la roadmap juge insuffisant pour la pénurie.
7. **Information, pas une règle : la pluie prévue en pénurie.** R2 à 100 %
   déduit toute la pluie annoncée du besoin du plein champ ; en pénurie, cela
   libère de l'eau pour les autres planches, et si la pluie ne vient pas,
   cette eau est déjà placée ou validée ailleurs. Le logiciel expose, vous
   décidez (D-028) : baisser R2 garde une marge, l'écran le permet déjà ; de
   même, R9 se change à l'écran pendant un arrêté. Aucune règle nouvelle n'est
   proposée.
8. **À priorité égale, faut-il servir l'abri avant le plein champ ?** En
   pénurie, à priorité égale, le moteur ne distingue pas un tunnel d'une
   planche de plein champ : même fraction, puis le déficit relatif, puis
   l'ordre de l'inventaire. Recommandation : aucune règle nouvelle ; les
   priorités que vous posez font exactement cela, et une règle cachée
   contredirait D-024 (« décider d'une priorité : jamais »).

## Décisions du porteur

Prises le 30 octobre 2026 à 22 h 54, à la lecture des huit questions posées
dans le fil : « d'accord avec tout. » Les recommandations deviennent les
règles, consignées dans `docs/DECISIONS.md` (D-052).

1. ✅ **Arbitrage validé en pénurie** : chaque allocation est une part
   réservée, sans redistribution entre planches ; l'eau qu'une planche
   allouée ne peut pas recevoir reste non attribuée, et l'écran le dit.
2. ✅ **Budget annoncé** : le budget d'une chaîne retire d'abord le manque
   sous le minimum de sécurité ; la ligne de budget montre la part visée et la
   part placée, par niveau ; ce que le moteur place ne change pas.
3. ✅ **Priorités pour la recette finale** : posées par le porteur au moment
   de la recette, relevées avant et remises après ; l'exemple proposé —
   tunnels en haute, un bloc de cultures établies en basse — sert de point de
   départ, le choix définitif des planches se fait avec lui ce jour-là.
4. ✅ **Report** : les planches reportées ne passent devant qu'au calcul qui
   suit un événement ; sans événement, le calcul reproduit le précédent.
5. ✅ **Dimanche** : une part sous la dose minimale est placée le dernier jour
   tant qu'une plage reste, comme hors pénurie.
6. ✅ **Recette finale** : en pénurie fabriquée sur la ferme réelle, les trois
   conduites, la restriction, l'arbitrage, la validation et le refus, une fois
   chacun, données remises en état par l'écran, sur son « vas-y » le jour
   même ; le jugement reste le sien.
7. ✅ **R2 et R9 en pénurie** : information, aucune règle nouvelle.
8. ✅ **Abri et plein champ à priorité égale** : aucune règle nouvelle, les
   priorités du maraîcher font la différence.

## Choix faits en écrivant, à confirmer à la relecture

Techniques, sans effet sur l'arrosage ; ils n'ont pas été soumis avec les
huit questions et tiennent sauf objection du porteur à la relecture du
contrat :

- le contrat s'appelle `docs/shortage-contract.md` et la recette
  `docs/recette-tranche-3.md`, le nom que la roadmap donne à sa preuve de fin ;
- les scénarios sont numérotés S1 à S28, le parcours nouveau P13 (P12 est
  celui de la 3.7 ; P13 est devenu depuis celui des alertes météo, et le
  parcours de la pénurie prend le prochain numéro libre), les tests
  nouveaux du moteur vont dans `tests/planning-shortage.test.ts` ;
- le tag est `v0.2.0` et la version du paquet `0.2.0` : un cran mineur par
  tranche close, `1.0.0` étant réservé à la mise en production multi-fermes
  de la tranche 4 ;
- aucun export de la ferme réelle n'est versionné pour servir de jeu de
  données ;
- dans la ligne de budget, un niveau de priorité sans aucune demande
  s'affiche « — » plutôt que « 100 % » (constat « servi : haute 100 %, basse
  100 % » de la quatrième recette) ;
- la revue de sécurité n'ajoute aucun outil à la CI ; `pnpm audit` est lu une
  fois ;
- la recommandation sur Vinext est de clore D-015 si la version stable tient ;
- S26 est un relevé, pas une garde.

## À relire à l'ouverture du code

Parce que cinq sous-tranches passent avant la 3.9, le code de la 3.9 commence
par relire, sans changer les règles d'ici :

- **3.7** : les refus lus par le moteur, le recalcul sur événement, les
  suggestions, R14, le parcours P12 — S21, S22 et S25 s'écrivent sur son code ;
  chaque événement de sa règle 4 survenu en pénurie est un cas de S20 à S24 ;
- **2.11** : un matériel retiré en pénurie est un « matériel arrêté », sa part
  libérée en fin de tour (D-037, D-044) ;
- **5 ter** : la jauge du sol reste une information en pénurie ; une dose qui
  dépasse ce que le sol retient est signalée, jamais corrigée (D-041) ;
- **5 bis** : une alerte ne change rien au plan (contrat des alertes) ;
- **5 quater** : un objectif proposé non adopté n'entre pas dans le besoin ;
  adopté, c'est une révision d'objectif, donc un événement de la 3.7 (D-045) ;
- **3.8** : les chemins de l'écran dans le protocole de recette et dans P32
  sont ceux de la disposition réorganisée ; la mesure du temps de chargement
  avant et après est reprise.
