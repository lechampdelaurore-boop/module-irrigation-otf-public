# Recette réelle — planning hebdomadaire (3.5) et son écran (3.6)

Faite le 29 septembre 2026 entre 19 h 49 et 20 h 10 sur la ferme du porteur,
version déployée après la fusion de la PR de l'interface (#112, déploiement
terminé à 19 h 48), dans le navigateur du porteur, sur la semaine du 28
septembre au 4 octobre. Protocole : `docs/planning-contract.md`, « Interface
(3.6) » et scénarios de recette ; roadmap 3.5 et 3.6, preuves de fin. **Les
constats sont de l'assistant ; le jugement agronomique reste au porteur**
(D-014). Les chiffres viennent de l'écran, relus dans la page, et des
recalculs à la main indiqués.

## L'état de la ferme au moment du calcul

| Donnée | Valeur lue |
| --- | --- |
| Objectif | 20 mm par semaine sur toute la ferme |
| Besoin à planifier | 17,2 mm sur les blocs de plein champ (pluie prévue 2,8 mm déduite), 20 mm sous les tunnels 2, 3 et 4, 10 mm sous le tunnel 1 (arrosé de 10 mm le matin même), 10,9 mm en moyenne sur le bloc 1 (gag1 arrosé le matin) |
| Réserve tampon | 30 m³ sur 60, observés le 25 septembre à 13 h 05, minimum de sécurité 0 |
| Forage | 0,511 m³/h, alimentation automatique de la réserve |
| Pompe | « La pompe », 8 m³/h, origine par défaut la réserve tampon, pompe habituelle de tout le matériel |
| Matériel positionné | 34 : 16 goutte-à-goutte (gag1 à gag16), 11 rampes de bloc, 3 rampes de bloc fleurs, 4 rampes de serre |
| Limite journalière | aucune |
| Irrigations planifiées | aucune avant le calcul |

## Ce que l'écran a fait

| Geste | Constat | Durée |
| --- | --- | --- |
| « Calculer le plan de la semaine » | 60 propositions du mardi 19 h 52 au dimanche, en-tête « calculé le 29/09/2026 19:51 (à la demande) · prévision météo sur 7 jours · Réserve tampon : 30,00 m³ observés le 25/09/2026 13:05 » | 4,0 s entre le clic et l'affichage, depuis le navigateur |
| Ajuster puis valider p-8 (gag16, mercredi, 7,2 mm) à 5 mm | aperçu « Durée 21 min, fin le 30/09/2026 20:13 » ; carte « Validée », « Irrigation planifiée. » ; dans « À venir ou à terminer » : gag16, début 30 sept. 19:52, 21 min, 165,04 L, « La pompe · 0,46 / 8 m³/h · Réserve tampon », note « Planning du 29/09/2026 19:51 · proposition p-8 ajustée (5 mm, début le 30/09/2026 19:52) » | 2,0 s ; la liste des irrigations à venir rafraîchie en 1,1 s |
| Refuser p-12 (gag11, mercredi) | carte « Refusée », « Proposition refusée : le besoin reste affiché. », plus aucun bouton | 0,8 s |
| Annuler l'irrigation planifiée créée, depuis « À venir » | disparue de la liste ; la proposition reste « Validée » dans le plan (la suite d'une irrigation validée est la replanification, 3.7) | 3,0 s |
| Lecture à 390 px, dans un cadre de cette largeur sur la version déployée | document de 373 px pour une fenêtre de 388 px : aucun débordement horizontal ; six cartes de résumé, en-tête, carte de proposition ouverte avec sa justification et son tableau de planches, liste « Non placé » lisibles ; bouton « Valider » de 44 px de haut | — |

À la main : 165,04 L = 5 mm × 33 m² (B1-9 et B1-10, planche seule en
goutte-à-goutte, 22 m × 0,75 m chacune) ; 21 min = 5 mm à 14 mm/h.

## Ce que le plan a proposé, vérifié à la main

Les goutte-à-goutte et les rampes de serre donnent exactement ce que le
contrat attend.

| Proposition | Écran | À la main |
| --- | --- | --- |
| gag11, B10-1 et B10-2, mardi 19 h 52 → 20 h 34 | 10 mm, 43 min, 0,48 m³, « la dose maximale par arrosage (R5) », « au plus tôt » | 2 × 24 m² = 48 m² ; 672 L/h ÷ 48 m² = 14 mm/h ; 10 mm en 42,9 min ; 0,48 m³ |
| gag11, mercredi 19 h 52 → 20 h 22 | 7,2 mm, 31 min, 0,346 m³, « après l'espacement entre deux arrosages (R7) » | 17,2 − 10 = 7,2 mm ; 30,9 min ; 24 h exactement après le premier départ |
| Les dix goutte-à-goutte de 19 h 52 | débit engagé sur la pompe qui monte de 0,46 à 5,84 m³/h, proposition après proposition | 0,46 + 7 × 0,67 + 0,32 + 0,67 = 6,2 m³/h ≤ 8 |
| Rampe de serre tunnel 2, mardi 21 h 00 → 22 h 30 | 15 mm, 1 h 30, 3,84 m³, « à l'ouverture de la plage horaire (R8) » | 8 planches de 32 m² mouillés à 10 mm/h ; 15 mm = 3,84 m³ en 1 h 30 ; puis 5 mm mercredi 21 h 00 → 21 h 30, 1,28 m³ : 20 − 15 = 5 mm, ni sous R4 ni au-dessus de R5 |
| Tunnels 2, 3 et 4 ensemble à 21 h | 2,56 + 2,56 + 2,56 = 7,68 m³/h | ≤ 8 m³/h ; la rampe BF (0,61 m³/h) attend 22 h 30 : « pompe « La pompe » saturée avant 22:30 » |
| Rampe BF, mardi 22 h 30 → 00 h 29 | 8 mm, 2 h, 1,23 m³ ; rangée sous mardi | 8 × 9,8 + 12,5 × 18 + 9 × 18 + 12,5 × 18 + 15 × 18 + 15 × 18 = 1 230 L ; une plage qui passe minuit appartient au jour où elle commence |
| Rampe de serre tunnel 1, mercredi 21 h 30 → 22 h 30 | 10 mm, 1 h, 1,28 m³, « dès que la pompe est libre » | 10 mm restants après l'aspersion du matin ; 128 m² ; pas avant 24 h ; les trois autres tunnels occupent 7,68 m³/h jusqu'à 21 h 30 |
| Jeudi 21 h : rampes des blocs 1, 10, 11, 4 et BF2 ; 23 h : blocs 5, 6, 7, 9 | 1,29 + 3 × 1,82 + 0,58 = 7,33 m³/h ; 1,82 + 1,83 + 1,85 + 1,85 = 7,35 m³/h | jamais plus de 8 m³/h, quatre rampes de bloc à la fois, jamais cinq |
| Réserve tampon | niveau projeté entre 0,00 et 57,4 m³ sur toutes les propositions | jamais sous le minimum de 0, jamais au-dessus de 60 |
| Plages horaires | goutte-à-goutte de 19 h 52 à 20 h 34 ; aspersion de 21 h 00 à 01 h 00 | R8 respectées |

## Ce que le plan a proposé, et qui ne va pas — au jugement du porteur

Le moteur applique la règle R11 (D-024, point 4 : la dose d'une rampe est le
besoin le plus élevé des planches couvertes) telle qu'elle est écrite. Sur
les rampes de bloc de la ferme, dont le réglage « 5 planches » arrose les
planches de moins en moins loin de la rampe, cette règle donne un plan que
l'assistant constate inutilisable pour les blocs de plein champ.

**Le profil d'une rampe de bloc, lu dans le tableau des planches de la
proposition p-13 (rampe bloc 10, jeudi 21 h → 23 h, 2 h).** Apport en 2 h :
B10-5 et B10-6 15 mm (7,5 mm/h), B10-4 et B10-7 12,5 mm, B10-3 et B10-8
9 mm, B10-2 et B10-9 7 mm, B10-1 et B10-10 4 mm (2 mm/h). La rampe s'arrête
à 2 h parce que les planches du centre atteignent la dose maximale R5.

Trois conséquences, toutes visibles à l'écran :

1. **La planche de référence est une planche de bord.** Toutes les planches
   du bloc ont le même besoin (17,2 mm) ; à égalité, le moteur prend la
   première par ordre de nom, B10-10, arrosée à 2 mm/h. La carte affiche
   « DOSE 4 mm · la dose maximale par arrosage (R5) » : 4 mm est ce que la
   planche de bord reçoit, la dose maximale est celle que le centre atteint.
   Lisible, mais déroutant.
2. **Le moteur poursuit le besoin des planches de bord.** Après le premier
   créneau, B10-10 garde 13,2 mm de besoin : le moteur propose un créneau de
   2 h chaque nuit, jeudi, vendredi, samedi et dimanche. Les planches du
   centre reçoivent 60 mm pour un besoin de 17,2 mm — le sur-apport est
   affiché planche par planche, comme le contrat le demande, mais il est
   triple. Sur la semaine : **130,956 m³ proposés pour 84,178 m³ demandés**
   (ligne « Budget d'eau » de l'écran), soit 46,8 m³ de sur-apport.
3. **La réserve se vide et trois blocs restent secs.** La projection de la
   réserve atteint 0,00 m³ dès la nuit de vendredi. Les blocs 3 et 8 et le
   bloc fleurs 3, 29 planches, ne reçoivent aucune proposition : leur
   première planche (B3-1, B8-1, B8-10, BF3-1) est atteinte à 1,5 mm/h par
   la rampe du bloc voisin, qui tourne chaque nuit ; l'espacement de 24 h
   (R7) entre deux arrosages d'une même planche interdit alors à la rampe
   du bloc 3 tout créneau de la semaine. L'écran attribue ce manque au
   « temps de pompage insuffisant dans les plages horaires », ce qui est
   faux : c'est l'espacement, par une planche partagée ; et le résumé dit
   « Manque d'eau 0,00 m³ » alors que la réserve est projetée vide.

**Ce que l'assistant propose au porteur, sans rien changer avant sa
décision.** Un réglage de plus, R13 : *la part du débit nominal d'un matériel
(son taux le plus fort sur ses planches) en dessous de laquelle une planche
ne commande pas l'arrosage* — elle n'est ni la référence de la dose, ni
comptée pour « un arrosage par jour » (R6) et l'espacement (R7) ; l'eau
qu'elle reçoit reste comptée dans les besoins et l'historique ; son reste est
affiché avec un motif nouveau, « portée du matériel insuffisante ». Valeur de
départ proposée : 50 %. Sur le bloc 10 : les planches à 7,5, 6,25 et
4,5 mm/h commandent, les deux dernières de chaque côté (3,5 et 2 mm/h) non ;
un créneau de 2 h jeudi (15 mm au centre), 2,2 mm restants placés le dernier
jour ; B10-9 et B10-10 affichées « portée insuffisante » avec 10,2 et
13,2 mm de reste, à décider par le maraîcher (déplacer la rampe, goutte-à-
goutte). Le bloc 3 n'est plus bloqué par le 1,5 mm/h qui tombe sur B3-1.
Volume attendu de la semaine : de l'ordre de 70 m³ pour 93 mobilisables. À
défaut, l'alternative est de garder R11 et d'accepter le sur-apport ;
l'assistant ne la recommande pas.

Deux défauts d'explication, à corriger dans la même PR que R13 si elle est
décidée, sinon seuls :

- **Le motif « temps de pompage insuffisant » est mis par défaut** quand
  aucune plage ne reste pour un matériel, y compris quand c'est l'espacement
  qui l'a repoussé après dimanche (`placeCandidate`, `intervals.length === 0`).
  Un motif « espacement » manque, et le résumé range ce manque dans « temps
  de pompage ».
- **Le niveau projeté de la réserve affiché sur chaque proposition est celui
  du moment où elle a été placée**, pas celui du plan fini : la proposition
  du bloc 10 de dimanche annonce 57,4 m³ alors que celles de vendredi, placées
  après, annoncent 0,00 m³. Le contrat demande « son niveau projeté à la
  fin » : il faut relire la chronologie de la réserve une fois le plan
  complet.

## Autres constats

- **La réserve est prise à son niveau observé, 30 m³ le 25 septembre,
  quatre jours avant le calcul**, sans les apports du forage depuis. C'est la
  règle de la 3.1 (le panneau « Disponibilité / projections » part du même
  « stock actuel »), et l'en-tête du plan dit la date de l'observation. Pour
  que le plan vaille, le volume observé se corrige avant de calculer.
- Une proposition validée dont l'irrigation est ensuite annulée reste
  « Validée » dans le plan : c'est prévu, la suite est à la replanification
  (3.7).
- « Planches non servies : 43 » compte aussi B1-8 avec 0,2 mm de reste sur
  17,2 : exact, comme le contrat l'exige, mais un reste si petit encombre la
  liste.

## Ce que cette recette prouve, et ce qu'elle ne prouve pas

- **L'écran (3.6)** fait ce que le contrat dit : calcul, lecture,
  justification, ajustement, validation jusque dans les irrigations à venir,
  refus, liste « Non placé », réglages, sans débordement à 390 px, sur les
  données réelles. Sa preuve de fin est faite.
- **Le moteur (3.5)** place correctement les goutte-à-goutte et les rampes de
  serre, respecte la pompe, la réserve, les plages et l'espacement, calcule
  la semaine en moins de quatre secondes depuis l'écran. Mais sur les rampes
  de bloc à profil, la règle R11 telle que tranchée donne un plan qui
  sur-arrose, vide la réserve et laisse trois blocs secs : **le moteur n'est
  pas recevable sur cette ferme tant que le porteur n'a pas tranché la
  question R13**, et les deux défauts d'explication restent à corriger. Sa
  preuve de fin attend cette décision et une seconde recette.
- Non prouvé ici : les scénarios de pénurie d'eau (la réserve suffisait avant
  le sur-apport), la limite journalière (aucune sur la ferme), le recalcul du
  matin (à lire demain à 06 h 15), le lundi d'une nouvelle semaine.

## Seconde recette, le même soir à 21 h 20, après la portée (R13)

Faite le 29 septembre 2026 entre 21 h 20 et 21 h 40, sur la version déployée
après la fusion de la PR de la portée (#114, déploiement terminé à 20 h 56),
dans le navigateur du porteur, sur la même semaine et les mêmes données que
la première : objectif 20 mm, réserve à 30 m³ observés le 25 septembre à
13 h 05 — laissée telle quelle exprès, pour comparer —, forage 0,511 m³/h,
pompe 8 m³/h, aucune irrigation planifiée, aucune limite journalière. Le
résumé des réglages de la version déployée porte bien « portée : une planche
commande dès 50 % du débit le plus fort ». Le recalcul est parti à 21 h 20 :
un créneau d'aspersion peut commencer dès 21 h 21, un goutte-à-goutte
jusqu'à 22 h. Les chiffres viennent de l'écran, relus dans la page, et d'un
rejeu à la main des prélèvements sur la réserve. **Les constats sont de
l'assistant ; le jugement reste au porteur** (D-014).

### Ce que la portée a changé

| Ligne du résumé | Plan de 19 h 51 (R11 seule) | Plan de 21 h 20 (R13 à 50 %) |
| --- | --- | --- |
| Propositions | 60 (relu à 21 h 20 : 48, 1 validée, 1 refusée, 10 expirées) | 49 proposées, plus la validée et la refusée de 19 h 51, relues avec le nouveau calcul comme le contrat le prévoit |
| Volume proposé et validé | 130,956 m³ | 69,243 m³ |
| Budget d'eau d'ici dimanche | 84,178 m³ demandés | 92,661 m³ mobilisables pour 70,72 m³ demandés, « servi : haute 100 %, normale 100 %, basse 100 % » |
| Temps de pompage manquant | 14,338 m³ | 0,00 m³ |
| Manque d'eau | 0,00 m³ | 0,00 m³ — **faux, voir plus bas** |
| Planches non servies | 43 | 99, toutes avec un manque chiffré : 72 « portée du matériel insuffisante (R13) », 27 « besoin sous la dose minimale : attend qu'il grandisse » |
| Dernière proposition | dimanche | vendredi 06 h 00 ; samedi et dimanche sans proposition |
| Durée du calcul, depuis le navigateur | 4,0 s | 3,0 s |

Vérifié à la main, bloc par bloc :

| Attendu (D-025, première recette) | Constat |
| --- | --- |
| Bloc 10 : un seul créneau de 2 h dans la semaine, 15 mm au centre, 3,648 m³ | p-13, mardi 22 h 51 → 00 h 51, 2 h, « DOSE 15 mm · la dose maximale par arrosage (R5) », 3,648 m³, « dès que la pompe est libre » derrière les trois rampes de serre ; aucune autre proposition pour cette rampe de la semaine. Tableau des planches : 4, 7, 9, 12,5, 15, 15, 12,5, 9, 7, 4 mm ; 95 mm × 38,4 m² = 3,648 m³ |
| Une rampe de bloc par bloc, une fois | onze rampes de bloc et trois rampes fleurs, chacune un créneau de 2 h à 15 mm : 3,648 m³ pour dix planches, 3,664 à 3,763 m³ quand la rampe mouille aussi une planche du bloc voisin, 1,23, 1,152 et 0,773 m³ pour les blocs fleurs |
| Blocs 3, 8 et fleurs 3 servis | rampe bloc 3 p-22 mardi 22 h 51, la même nuit que le bloc 2 dont la rampe lui met 1,5 mm sur B3-1 ; rampe bloc 8 p-37 mercredi 02 h 51 ; rampe BF3 p-48 mercredi 00 h 51. Le 1,5 mm/h qui déborde ne bloque plus |
| B10-9 et B10-10 « portée insuffisante », 10,2 et 13,2 mm de reste | exact, et de même B10-3, B10-4, B10-7, B10-8 avec 8,2 et 4,7 mm : toute planche arrosée moins vite que le centre |
| Centres à 2,2 mm de reste | B10-5 et B10-6 « besoin sous la dose minimale : attend qu'il grandisse ». La première recette annonçait ce reste « placé le dernier jour » : le moteur ne le place que si le calcul se fait le dernier jour (`engine.ts`, `onlyLastDay`) ; d'ici là il attend, et c'est le recalcul de dimanche 06 h 30 qui le proposera |
| Volume de la semaine de l'ordre de 70 m³ pour 93 mobilisables | 69,243 m³ pour 92,661 |
| Pompe jamais au-dessus de 8 m³/h | mardi 21 h 21 : trois rampes de serre et gag14, 7,68 + 0,32 = 8,00 ; 22 h 51 : blocs 10, 11, 2, 3 et rampe BF, 7,94 ; mercredi 00 h 51 : blocs 4, 5, 6, 7 et BF3, 7,71 ; 02 h 51 : blocs 8 et 9, 3,73 ; 06 h 00 : douze goutte-à-goutte, 7,31 ; mercredi 21 h 21 : 8,00 de nouveau, puis tunnel 1 et bloc 1 à 21 h 51 |
| Plages et espacement | aspersion entre 21 h 21 et 04 h 51, goutte-à-goutte à 06 h 00 et 21 h 21 ; tunnels 2, 3 et 4 mardi 21 h 21 puis mercredi 21 h 21, 24 h exactement ; goutte-à-goutte mercredi 06 h puis jeudi 06 h |
| Rampes de serre et goutte-à-goutte | inchangés depuis la première recette : 15 puis 5 mm sous les tunnels 2 à 4, 10 mm sous le tunnel 1, 10 puis 7,2 mm en goutte-à-goutte, aux heures décalées par l'heure du calcul |

### Ce qui ne va pas : la garde de la réserve ne fonctionne pas

Les niveaux projetés « après ce créneau », relus sur le plan fini comme le
contrat le demande : 19,048 m³ après les rampes de serre (mardi 22 h 51),
25,142 après gag14 (22 h 00), 4,152 après la première vague de blocs
(mercredi 00 h 51), puis **0,00 m³** sur les sept rampes des deux vagues
suivantes (00 h 51 → 04 h 51) et sur les douze goutte-à-goutte de mercredi
06 h ; 3,734 mercredi 21 h 51, 0,404 jeudi 06 h 30, 7,852 jeudi 23 h 21,
11,284 vendredi 06 h 42.

Rejeu à la main des 49 créneaux sur la réserve — 30 m³ à 21 h 21, 0,511 m³/h
de forage, capacité 60 m³ : les niveaux affichés sont retrouvés à 0,1 m³ près
tant que la réserve n'est pas vide. Elle l'est **mercredi 01 h 25**, au
milieu de la deuxième vague : à 00 h 51 il reste 4,15 m³, et la vague des
blocs 4, 5, 6, 7 et fleurs 3 tire 15,44 m³ en deux heures avec 1,02 m³
d'apport. Entre 01 h 25 et 06 h 42, le plan tire **21,12 m³ qui n'existent
pas** : 10,3 sur la deuxième vague, 6,5 sur la troisième (blocs 8 et 9), 4,6
sur les goutte-à-goutte de mercredi matin. Sur la première nuit, du calcul à
06 h 42, le plan prélève 55,7 m³ pour 34,8 disponibles. Le résumé dit
pourtant « Manque d'eau 0,00 m³ » et le budget « servi : 100 % ».

**Ce que les deux recettes montrent ensemble.** La première annonçait déjà
« réserve projetée à 0,00 m³ dès la nuit de vendredi » à côté de « Manque
d'eau 0,00 m³ » ; l'assistant l'avait rangé sous le sur-apport de R11. Le
sur-apport parti, le symptôme reste : la garde n'agit pas.

**La cause, lue dans le code** (`lib/domain/planning/supply.ts`,
`ReservoirTimeline.minimumLevel`). Le niveau est borné à chaque rupture
« par la capacité et par zéro ». La borne à zéro est juste pour *afficher* un
niveau — une cuve n'est jamais négative —, mais `evaluate` s'en sert pour
juger un créneau : le manque vaut « minimum de sécurité − niveau le plus
bas », et avec le minimum de sécurité de la ferme, **0**, un niveau borné à
zéro ne descend jamais dessous ; le manque vaut 0, le statut « ok », le
créneau passe. Avec un minimum supérieur à zéro, le manque serait détecté
mais sous-estimé, borné au minimum lui-même. Le test d'invariant du moteur
(`tests/planning-engine.test.ts`, « réserve : jamais sous le minimum ») lit
le même niveau borné : « 0 ≥ 0 » est toujours vrai, le test ne peut pas
échouer. Second trou, plus discret : `evaluate` ne regarde que du début à la
fin du créneau candidat, alors que le moteur ne place pas dans l'ordre du
temps — la première recette l'a montré, dimanche placé avant vendredi — :
un créneau placé tard mais tôt dans la semaine peut assécher un créneau déjà
placé plus tard, sans que rien ne le voie.

Le contrat est sans ambiguïté : « le stock de la réserve est projeté heure
par heure … sans jamais passer sous le minimum de sécurité … mais pas 40 m³
la première nuit » (« Où placer les créneaux », point 5) ; « Minimum de
sécurité d'une réserve : la projection ne descend jamais dessous »
(contraintes opposables) ; « la réserve ne passe jamais sous 0 » (scénario 1
de recette). **Le moteur n'est pas recevable sur cette ferme tant que cette
garde ne fonctionne pas** : le plan de la première nuit promet 21 m³ que la
réserve n'a pas.

**Ce que la correction doit faire — PR à ouvrir sur le mot du porteur.**
Dans `supply.ts` : garder le niveau *physique*, borné par zéro et par la
capacité, pour l'affichage ; juger la faisabilité d'un créneau sur le niveau
*non borné par zéro* — borné par la capacité seule, puisque le trop-plein
est perdu —, du début du créneau **à la fin de l'horizon**, pour que le
manque soit le vrai manque et qu'un créneau placé tôt ne prive pas un
créneau déjà placé plus tard. Le reste du moteur existe : un créneau
« short » est raccourci (« reserve-level »), décalé à l'heure où le forage
aura comblé le manque (« reserve-inflow ») ou refusé (« reserve-timing »),
et le manque d'eau du résumé compte ces motifs. Tests d'abord : un test sur
les chiffres de la ferme — 30 m³, 0,511 m³/h, minimum 0, une première nuit
qui demande 55 m³ — qui échoue aujourd'hui, et l'invariant de la réserve
rejoué sans la borne à zéro, pour qu'il puisse échouer. Attendu sur la
ferme : les vagues des blocs 4 à 9 et fleurs 3 décalées aux nuits suivantes
au rythme du forage, 12,3 m³ par jour ; les 70,7 m³ de la semaine tiennent
toujours dans les 92,7 mobilisables, mais pas la première nuit ; des planches
servies plus tard, certaines samedi. Puis une troisième recette.

**Fait le 2 octobre 2026** (PR #125 fusionnée et déployée le 3 octobre ;
troisième recette à faire), comme prescrit, avec trois précisions trouvées en
l'écrivant.
Le test des chiffres de la ferme est joué sans goutte-à-goutte sur les
blocs — les deux planches en goutte-à-goutte de chaque bloc repoussent sa
rampe à jeudi par l'espacement R7, le constat ci-dessous — et il échouait
avant la correction : 48,51 m³ tirés d'ici mercredi 8 h pour 39,78
disponibles. Le raccourcissement d'un créneau se fait par bissection sur les
secondes entières, non au prorata du manque : au prorata, la fin du créneau
raccourci reste sous le minimum, de l'apport reçu pendant la durée retirée.
L'attente de l'apport n'est proposée que si le point le plus bas tombe dans
le créneau ; quand c'est un créneau placé plus tard qui manque, attendre ne
comble rien, et le créneau est raccourci ou refusé. Mise en garde pour la
troisième recette : une irrigation déjà planifiée qui dépasse le stock fait
refuser tous les créneaux de la réserve qui précèdent ce manque, « réserve au
minimum de sécurité au moment voulu ».

### Autres constats

- **Goutte-à-goutte placé avant la rampe dans le moteur, après elle dans le
  temps.** Sur chaque bloc, les deux premières planches sont en
  goutte-à-goutte (R12, matériel préféré) : le moteur leur donne 10 mm
  mercredi 06 h et 7,2 mm jeudi 06 h, puis place la rampe, qui tourne mardi
  soir et leur met 4 et 7 mm au passage, comptés en sur-apport — 0,42 m³ par
  bloc, de l'ordre de 4 m³ sur la ferme. En service, le recalcul du matin
  lira les millimètres réels de la rampe et réduira le goutte-à-goutte de
  jeudi. À regarder à la troisième recette, pas à corriger maintenant.
- **Rampe BF2 repoussée à jeudi 21 h 21, « après l'espacement (R7) ».** Ses
  planches BF2-1 et BF2-2, arrosées par gag14 mardi 21 h 21 et mercredi
  21 h 21, commandent la rampe (6,25 et 7,5 mm/h) : l'espacement de 24 h lui
  interdit les deux premières nuits, et BF2-3, BF2-4, BF2-5 attendent jeudi.
  Conforme à R7 dans les deux sens ; au jugement du porteur si gag14 et la
  rampe doivent se partager ces deux planches.
- **Une proposition refusée revient sous une autre forme.** gag11, refusé à
  19 h 51 pour mercredi 19 h 52 à 7,2 mm, est reproposé mercredi 06 h à
  10 mm puis jeudi 06 h à 7,2 mm. Le moteur ne lit pas les refus — le
  registre ne les garde que pour l'affichage — ; le contrat dit « le moteur
  ne la représente plus telle quelle », vrai ici parce que l'heure a changé,
  pas par une règle. À préciser en 3.7.
- **Deux cartes portent le même nom, « Proposition p-12, gag11 »** : la
  refusée de 19 h 51 et la nouvelle de 21 h 20, les numéros repartant de p-1
  à chaque calcul. Une carte relue d'un calcul précédent devrait porter la
  date de son calcul. Petit défaut d'écran, à corriger avec la garde ou en
  3.7. **Corrigé le 2 octobre 2026, avec la garde** : la carte porte la date
  de son calcul, dans son nom et sous le matériel.
- **La validée de 19 h 51 (p-8, gag16) dit encore « Irrigation planifiée :
  elle se démarre, se modifie ou s'annule dans « À venir ou à terminer » »**
  alors que cette irrigation a été annulée à la première recette et que la
  liste est vide. Connu : la suite est la replanification (3.7).

### Ce que cette recette prouve, et ce qu'elle ne prouve pas

- **La portée (R13, D-025) fait ce qui a été décidé** : une rampe à profil
  tourne une fois pour son centre, les planches lentes sont affichées avec
  leur reste et le bon motif, le débordement sur le bloc voisin ne bloque
  plus, le volume de la semaine est presque divisé par deux, le temps de
  pompage manquant tombe à zéro, la pompe, les plages et l'espacement
  tiennent. Les deux corrections d'explication sont vérifiées : plus de
  « temps de pompage » par défaut, niveaux relus sur le plan fini — et c'est
  cette relecture qui rend le défaut de la réserve visible.
- **La garde de la réserve est inopérante avec un minimum de sécurité à
  zéro** : le plan tire 21 m³ que la réserve n'a pas la première nuit et
  annonce « Manque d'eau 0,00 ». Le moteur (3.5) reste 🟡 : correction dans
  `supply.ts` avec un test qui échoue d'abord, puis troisième recette.
- Non refait : la lecture à 390 px et les gestes d'ajustement, de validation
  et de refus, inchangés depuis la PR de l'écran et couverts par le parcours
  P10 aux deux largeurs — le formulaire des réglages a gagné le champ R13,
  que P10 traverse. Non prouvé : la pénurie d'eau, puisque la garde est hors
  service, la limite journalière, le recalcul du matin, le lundi d'une
  nouvelle semaine.

## Troisième recette, le lundi 5 octobre 2026, après la garde (point 19)

Faite sur la version déployée, dans le navigateur du porteur et sur son mot,
en deux temps : une lecture seule le dimanche 4 octobre de 17 h 20 à
17 h 40, sur la fin de la semaine du 28 septembre, puis la recette le lundi
5 octobre de 13 h 57 à 14 h 19, sur la semaine du 5 au 11 octobre. Version
déployée : `main` à `6305803`, PR #133, déployée le 4 octobre à 23 h 12 ;
le moteur, le registre, le service et l'écran du planning sont ceux de la
garde (PR #125, `7a2b1ae`), seul le service de validation a changé depuis,
pour la limite sur un volume inconnu (#129). Réserve laissée à 30 m³
observés le 25 septembre, décision du porteur du 4 octobre. **Les constats
sont de l'assistant ; le jugement agronomique reste au porteur** (D-014).
Les chiffres sont relus dans la page par script : la capture d'écran du
Chrome du porteur n'a répondu qu'une fois, puis plus. Aucune lecture à
390 px, impossible dans cette fenêtre ; le parcours P10 la joue en CI aux
deux largeurs.

### Dimanche 4 octobre, lecture seule : le recalcul du matin existe

Le plan affiché est « Semaine du 28/09 au 04/10 · calculé le 04/10/2026
06:15 (recalcul du matin) · prévision météo sur 7 jours · Réserve tampon :
30,00 m³ observés le 25/09/2026 13:05 ». Le recalcul du matin, que la
seconde recette laissait non prouvé, l'est : le Worker planificateur lance
la synchronisation météo à 06 h 15, puis le recalcul de chaque exploitation.
Résumé : 4 propositions (1 validée · 1 refusée · 0 expirée), 13,038 m³, non
vérifié 0, manque d'eau 0,00 m³, temps de pompage manquant 0,00 m³, 24
planches non servies toutes chiffrées ; budget « 39,059 m³ mobilisables
pour 16,64 m³ demandés · servi 100 % ». Lundi à samedi : « Jour écoulé avant
le calcul » ; mercredi garde « 1 validée · 1 refusée · 0,238 m³ ».
Dimanche : les rampes des tunnels 2, 3 et 4 à 21 h 00 → 22 h 30, 15 mm,
3,84 m³ chacune, « la dose maximale par arrosage (R5) », « à l'ouverture de
la plage horaire (R8) », 26,773 m³ projetés après ; le tunnel 1 à 22 h 30 →
23 h 30, 10 mm, 1,28 m³, « dès que la pompe est libre », « pompe « La
pompe » saturée avant 22:30 : Rampe de serre tunnel 2, Rampe de serre
tunnel 3, Rampe de serre tunnel 4 », 26,004 m³ projetés. À la main : 30 +
0,511 × 16,25 − 11,52 = 26,78 ; 26,773 + 0,511 − 1,28 = 26,00 ; 3 × 2,56 =
7,68 m³/h, la quatrième rampe ferait 8,96. Les 24 planches non servies sont
celles des tunnels 2, 3 et 4 : besoin 20 mm, placé 15, manque 5, « un
arrosage par jour et espacement entre deux arrosages (R6, R7) », dimanche
étant le dernier jour. Les deux cartes de la première recette sont là,
datées : « Proposition p-12 du calcul du 29/09/2026 19:51, gag11 »,
refusée, et « Proposition p-8 du calcul du 29/09/2026 19:51, gag16 »,
validée, toutes deux avec « calcul du 29/09/2026 19:51 » sous le matériel,
relues par les recalculs du matin suivants sans perdre leur date : le
défaut d'écran corrigé par la PR #125 ne revient pas. La validée dit encore
« Irrigation planifiée : elle se démarre, se modifie ou s'annule dans « À
venir ou à terminer » » alors que l'irrigation est annulée (connu, 3.7). Le
budget dit aussi d'où part la réserve : 39,059 = 30 + 0,511 × 17,73 h,
l'observation du 25 septembre prise telle quelle, sans l'apport des neuf
jours écoulés.

### L'état de la ferme au moment des calculs du lundi

| Donnée | Valeur lue |
| --- | --- |
| Objectif | 20 mm par semaine sur toute la ferme |
| Besoin à planifier | 20 mm sous les quatre tunnels ; en plein champ, 5,8 mm au calcul de 06 h 15 (20 mm moins 14,2 mm de pluie prévue), puis 0 mm après la météo actualisée à l'ouverture de la page (reste brut 4,3 mm, sous le seuil de planification de 5 mm) |
| Seuil de planification (3.3) | 5 mm, réglé sur la ferme |
| Réserve tampon | 30 m³ sur 60, observés le 25 septembre à 13 h 05, minimum de sécurité 0 ; « Dernière correction tracée : 1 m³ → 30 m³, le 25 sept. 2026, 13:05 · Correction d'inventaire » |
| Forage | 0,511 m³/h, alimentation automatique de la réserve |
| Pompe | « La pompe », 8 m³/h, origine par défaut la réserve tampon |
| Matériel positionné | 34, inchangé : 16 goutte-à-goutte, 11 rampes de bloc, 3 rampes de bloc fleurs, 4 rampes de serre ; réglages du planning inchangés, portée 50 % |
| Limite journalière | aucune |
| Irrigations planifiées | aucune : « Planifié 0,00 m³ » chaque jour de la semaine dans le tableau de l'eau ; la liste « À venir » n'a pas pu être relue par script |
| Météo | « Dernière synchronisation automatique : 05/10/2026 06:15 », « Dernière mise à jour : 05/10/2026 13:56 », à l'ouverture de la page ; pluie prévue mercredi 6,1 mm, jeudi 8,8, samedi 0,4, dimanche 0,4 ; pluie réelle du lundi inconnue, comptée « 0 mm · estimé » (D-019) |

### Ce que l'écran a fait

| Geste | Constat | Durée |
| --- | --- | --- |
| Ouvrir la page à 13 h 57 | le plan du matin tel quel : « Semaine du 05/10 au 11/10 · calculé le 05/10/2026 06:15 (recalcul du matin) · prévision météo sur 7 jours · Réserve tampon : 30,00 m³ observés le 25/09/2026 13:05 » ; 37 propositions (0 validée · 0 refusée · 0 expirée), 38,26 m³, non vérifié 0, manque d'eau 0,00 m³, temps de pompage manquant 0,00 m³, 73 planches non servies toutes chiffrées ; budget « 112,62 m³ mobilisables pour 36,716 m³ demandés · servi 100 % » ; lundi 4 proposées · 13,44 m³, mardi 4 · 4,48, mercredi et jeudi aucune, vendredi 26 · 18,641, samedi 2 · 1,583, dimanche 1 · 0,116 ; la météo s'est actualisée à l'ouverture (« Dernière mise à jour : 05/10/2026 13:56 ») sans toucher au plan affiché | — |
| « Recalculer le plan » à 14 h 04 | « Plan calculé. » ; en-tête « calculé le 05/10/2026 14:04 (à la demande) » ; 8 propositions, 17,92 m³, 0 planche non servie, « Toutes les planches qui ont un besoin sont servies en entier. » ; lundi 4 · 13,44 m³, mardi 4 · 4,48, puis « Aucune proposition. » ; budget « 108,631 m³ mobilisables pour 17,92 m³ demandés » ; les 26 créneaux de plein champ de 06 h 15 ont disparu (voir plus bas) | 1,99 s entre le clic et l'affichage, depuis le navigateur |
| Refuser p-8 (rampe de serre tunnel 4, mardi 22 h 30 → 23 h 00, 5 mm, 1,28 m³) | carte « Refusée », « Proposition refusée : le besoin reste affiché. », plus aucun bouton ; résumé « 7 · 0 validée · 1 refusée · 0 expirée · 16,64 m³ » ; en-tête inchangé | non chronométré |
| « Recalculer le plan » à 14 h 11 | en-tête « calculé le 05/10/2026 14:11 (à la demande) » ; 8 propositions (0 validée · 1 refusée · 0 expirée), 17,92 m³, neuf cartes : la refusée, « Proposition p-8 du calcul du 05/10/2026 14:04, Rampe de serre tunnel 4 », « Aspersion · Standard · 8 planches (T4-1 … T4-8) · calcul du 05/10/2026 14:04 », statut « Refusée », sans bouton ; et une nouvelle p-8 identique, mardi 22 h 30 → 23 h 00, 5 mm, 1,28 m³, avec ses boutons ; mardi « 4 proposées · 1 refusée · 4,48 m³ » ; budget 108,571 m³ mobilisables | 1,90 s |
| Lecture à 390 px | impossible : la fenêtre du Chrome du porteur reste à 1 920 px ; couverte par le parcours P10 aux deux largeurs | — |

### Ce que le plan de 06 h 15 a proposé, vérifié à la main

| Proposition | Écran | À la main |
| --- | --- | --- |
| Lundi, rampes des tunnels 1, 2 et 3, 21 h 00 → 22 h 30 | 15 mm, 1,92 / 3,84 / 3,84 m³, « la dose maximale par arrosage (R5) », « à l'ouverture de la plage horaire (R8) », 28,693 m³ projetés après le tunnel 1 | 15 mm × 128 et 256 m² ; 1,28 + 2,56 + 2,56 = 6,4 m³/h ≤ 8 ; 30 + 0,511 × 16,25 − 9,6 = 28,70 |
| Lundi, tunnel 4, 22 h 30 → 00 h 00 | 15 mm, 3,84 m³, « dès que la pompe est libre », « pompe « La pompe » saturée avant 22:30 : Rampe de serre tunnel 1, Rampe de serre tunnel 2, Rampe de serre tunnel 3 », 25,619 m³ projetés | 6,4 + 2,56 = 8,96 > 8 ; 28,693 + 0,511 × 1,5 − 3,84 = 25,62 ; point le plus bas de la semaine |
| Mardi, les quatre tunnels, 5 mm | tunnels 1, 2, 3 à 21 h 00 → 21 h 30, 0,64 / 1,28 / 1,28 m³, tunnel 4 à 22 h 30 → 23 h 00, 1,28 m³, « après l'espacement entre deux arrosages (R7) », 33,402 m³ projetés après le tunnel 2 | 20 − 15 = 5 mm, la dose minimale R4 ; 24 h après lundi, de début à début ; 25,619 + 0,511 × 21,5 − 3,2 = 33,41 |
| Mercredi et jeudi | aucune proposition ; sur le plein champ, « après la pluie prévue », « pluie prévue laissée passer » | 6,1 puis 8,8 mm annoncés, au-dessus du seuil R3 de 5 mm : le plein champ attend vendredi ; sous abri, la pluie ne compte pas |
| Vendredi 06 h 00 → 06 h 24, douze goutte-à-goutte, puis gag10 et gag15 à 06 h 25 → 06 h 49 | 5,8 mm, 0,052 à 0,435 m³, 56,922 m³ projetés après gag1 | 20 mm − 14,2 mm de pluie prévue = 5,8 mm ; 5,8 mm à 14 mm/h = 25 min ; la réserve, pleine depuis vendredi vers 4 h : 60 + 0,2 − 3,3 = 56,9 |
| Vendredi 21 h 00 → 21 h 46, rampes des blocs 10, 11, 2, 3 et BF | 5,8 mm, 1,411 / 1,411 / 1,451 / 1,411 / 0,476 m³, 54,235 m³ projetés | 46 min à 7,5 mm/h = 5,75 mm ; 1,82 + 1,82 + 1,87 + 1,82 + 0,61 = 7,94 m³/h ≤ 8 ; 60 + 0,4 − 6,16 = 54,2 |
| Vendredi 21 h 47 → 22 h 33, blocs 4, 5, 6, 7 et BF3 | « dès que la pompe est libre », « pompe « La pompe » saturée avant 21:47 : aucun », 48,664 m³ projetés | 1,82 + 1,82 + 1,83 + 1,85 + 0,39 = 7,71 m³/h ; 54,235 + 0,4 − 5,97 = 48,66 |
| Vendredi 22 h 34 → 23 h 20, blocs 8 et 9 | 1,456 et 1,433 m³, « saturée avant 22:34 : aucun », 46,175 m³ projetés | 1,88 + 1,85 = 3,73 m³/h ; 48,664 + 0,4 − 2,889 = 46,18 |
| Samedi 21 h 00 → 21 h 46, bloc 1 et BF2 | 1,137 et 0,446 m³, « après la pluie prévue », 56,052 m³ projetés | 46,175 + 0,511 × 22,4 − 1,583 = 56,04 |
| Dimanche 21 h 00 → 21 h 13, gag2 | 3,1 mm, 0,116 m³, « après l'espacement entre deux arrosages (R7) », 59,997 m³ projetés | le reste de ses deux planches après la rampe du bloc 1, 24 h après elle ; la réserve est de nouveau pleine : 60 + 0,1 − 0,116 = 60,0 |
| Réserve | de 25,619 à 59,997 m³ projetés, jamais sous 0 ni au-dessus de 60 ; « Manque d'eau 0,00 m³ » | rejoué à la main sur les 37 créneaux, retrouvé à 0,02 m³ près ; le résumé est vrai cette fois |
| Non placé | 73 planches, toutes chiffrées : 72 « portée du matériel insuffisante : arrosée moins que sa planche de référence (R13) », placé 1,5 à 4,8 mm sur 5,8, six par bloc ; BF-1 « besoin sous la dose minimale : attend qu'il grandisse », placé 4,8, manque 1 mm | D-025 : les planches de bord ne commandent pas ; 1 mm, sous R4, attend |

### Ce que la météo actualisée a changé : le seuil efface le plein champ

La page actualise la météo à l'ouverture. À 13 h 56, la prévision compte
15,7 mm de mardi à dimanche — mercredi 6,1, jeudi 8,8, samedi 0,4, dimanche
0,4 — contre 14,2 mm déduits au calcul de 06 h 15. « Voir le calcul » de
B4-1 : objectif 20 mm, pluie réelle 0, irrigation réelle 0, reste réel
20 mm, pluie prévue 15,7 mm, irrigation planifiée 0, reste brut à planifier
4,3 mm, après seuil (5 mm) 0 mm, l'ET0 de 11,7 mm hors calcul. Le tableau
des besoins dit, pour chacun des quatorze blocs de plein champ, « À
planifier : 0 mm · Besoin réel : 20 mm », et sur chaque planche « Déficit
relatif 100 % ». Le plan recalculé à 14 h 04 ne garde que les tunnels :
« Planches non servies 0 », « Toutes les planches qui ont un besoin sont
servies en entier ». Les 26 créneaux de plein champ de 06 h 15 — 20,34 m³ —
ont disparu sans qu'une ligne du plan le dise. C'est le contrat : le moteur
part du besoin restant « après seuil et remplacement manuel », la pluie
prévue est déduite à 100 % (R2, D-019) et le seuil de 5 mm est celui que la
ferme a réglé. Le constat est que 1,5 mm de pluie prévue en plus retirent
20 m³ d'arrosage du plan, et que le plan ne garde aucune trace des planches
passées sous le seuil, alors que les besoins affichent 20 mm et 100 % de
déficit à côté.

### Au jugement du porteur

1. **La pluie prévue et le seuil.** Faut-il qu'une prévision à 15,7 mm
   efface tout arrosage de plein champ de la semaine, et que le plan n'en
   dise rien ? Deux réglages existent déjà : la part de pluie prévue déduite
   (R2, 100 %) et le seuil de planification de la 3.3 (5 mm) ; l'écran,
   lui, pourrait lister les planches sous le seuil dans « Non placé » avec
   leur reste brut. Point ouvert 29.
2. **La réserve part de l'observation telle quelle.** 112,62 m³
   mobilisables = 30 + 0,511 × 161,7 h : le niveau de départ est celui
   observé le 25 septembre, dix jours plus tôt, sans l'apport du forage
   depuis — près de 120 m³ au débit de référence, de quoi remplir la cuve
   deux fois si rien n'a été tiré. Le logiciel ne sait pas le niveau réel ;
   il affiche la date de l'observation. Soit le porteur observe la réserve
   avant de se fier au plan, soit une décision fait projeter l'apport depuis
   l'observation, borné par la capacité. Point ouvert 30.
3. **Une proposition refusée revient à l'identique.** p-8, refusée à
   14 h 04, est reproposée à 14 h 11 au même créneau, à la même dose, par
   le même matériel ; le contrat dit « le moteur ne la représente plus
   telle quelle ». La seconde recette l'avait vue revenir à une autre
   heure ; ici rien n'a changé. Que doit valoir un refus pour le calcul
   suivant ? Point ouvert 31, à trancher avant ou dans la 3.7.
4. **Goutte-à-goutte le matin, rampe le soir sur les mêmes planches.**
   Vendredi, les deux premières planches de chaque bloc reçoivent 5,8 mm
   par leur goutte-à-goutte à 06 h 00, puis l'eau du bord de la rampe du
   bloc à 21 h 47, comptée : environ 1,5 mm de plus, contre 4 à 7 mm à la
   seconde recette, la portée R13 et les petites doses ayant fait le
   reste. En service, le recalcul du matin lira les millimètres réels.
   Connu, revu, non corrigé.
5. **Le réglage R1 n'agit pas.** Les réglages affichent « recalcul à
   06:30 » ; le plan est calculé à 06 h 15, à l'heure du Worker
   planificateur, et rien ne lit ce réglage. Point ouvert 32.
6. **Deux motifs inexacts.** « pompe « La pompe » saturée avant 21:47 :
   aucun » sur les rampes de la deuxième vague de vendredi, et « avant
   22:34 : aucun » sur la troisième : la contrainte est vraie — la vague
   précédente tient la pompe à 7,94 m³/h jusqu'à 21 h 46 —, mais la liste
   des occupants est vide, l'explication cherchant les occupants juste
   avant le départ, dans le creux d'une minute entre deux vagues. Et la
   rampe du bloc 1, placée samedi 21 h 00, dit « après la pluie prévue »,
   alors que vendredi soir est aussi après la pluie et que la pompe y avait
   de la place ; la cause vraisemblable est l'espacement R7 depuis les
   goutte-à-goutte gag1 et gag16 de vendredi 06 h 00 sur ses planches, à
   confirmer dans le code. Point ouvert 33.

### Autres constats

- **L'horloge du poste avance d'une minute sur celle du serveur** : le clic
  de 14:05:07 au navigateur donne un plan « calculé le … 14:04 », celui de
  14:12:10 un plan de 14:11. Les heures de cette recette sont celles du
  serveur quand elles viennent du plan.
- **Nouvelle semaine.** Le plan de lundi 06 h 15 est celui de la semaine du
  5 au 11 octobre, calculé seul ; les cartes du 29 septembre — gag16
  validée, gag11 refusée — n'y figurent plus, l'écran ne montrant que le
  calcul de la semaine affichée.
- **Le tableau des besoins** est « Calculé le 05/10/2026 13:56 » et dit
  « 132 planches : pluie réelle incomplète (manquante le 5 octobre) » : le
  lundi est compté 0 mm « estimé », prévision du jour reprise (D-019).
- **Demandé et proposé.** Le budget dit 36,716 m³ demandés pour 38,26 m³
  proposés : la rampe donne à sa planche de référence son besoin et aux
  autres ce que son profil leur donne, en plus ou en moins ; les deux
  nombres ne mesurent pas la même chose.
- **Outils.** Une seule capture d'écran a abouti dans le Chrome du porteur,
  les suivantes ont expiré ; la recette est un relevé par script, carte par
  carte. L'arbre d'accessibilité lu par l'outil n'a pas trouvé le bouton
  « Recalculer le plan », que le script trouve actif, 162 × 44 px ; sans
  effet sur la recette, à noter si un parcours doit un jour passer par cet
  outil.

### Ce que cette recette prouve, et ce qu'elle ne prouve pas

- **Prouvé sur la ferme** : le recalcul du matin, deux jours de suite (plans
  « recalcul du matin » de 06 h 15 les 4 et 5 octobre) ; le lundi d'une
  nouvelle semaine ; le recalcul à la demande en 1,99 puis 1,90 s depuis le
  navigateur, sur un plan de 8 créneaux — la seconde recette mesurait 3 s
  pour 49 ; le refus, et la carte d'un calcul antérieur datée dans son nom
  et sous le matériel (PR #125) ; les niveaux projetés relus sur le plan
  fini et retrouvés à la main sur les 37 créneaux de 06 h 15, de 25,619 à
  59,997 m³, jamais sous 0 ni au-dessus de 60, « Manque d'eau 0,00 m³ »
  vrai cette fois ; la pluie prévue au-dessus de R3 laissée passer ; R6 et
  R7 ; la pompe jamais au-dessus de 8 m³/h ; le seuil de planification de
  la 3.3 appliqué par le moteur.
- **Non prouvé** : la garde de la réserve en pénurie — la semaine ne la
  demande pas, 36,716 m³ pour 112,62 mobilisables et un point bas à
  25,6 m³ ; elle reste prouvée par le test des chiffres de la ferme seul,
  48,51 m³ tirés pour 39,78 disponibles ; à constater sur une semaine
  sèche, ou avec une observation basse de la réserve si le porteur le
  décide ; la limite journalière, aucune sur la ferme ; la validation, non
  rejouée, couverte par la première recette et P10 ; la lecture à 390 px,
  couverte par P10.
- **Le moteur 3.5** fait ce que le contrat dit sur cette semaine ; sa
  clôture, et la suite à donner aux points 29 à 33, sont au jugement du
  porteur.

## Quatrième recette, le lundi 5 octobre 2026 au soir : la pénurie fabriquée (point 19)

Faite sur la version déployée, dans le navigateur du porteur et sur son mot
— « les données de la ferme sont à titre expérimental […] tu peux modifier
les données comme tu l'entends, tant que tu remets dans l'état précédent
[…] réalise les tests pour avoir la preuve que le moteur fonctionne » —, le
lundi 5 octobre de 20 h 24 à 20 h 48, sur la semaine du 5 au 11 octobre.
Version déployée : `main` à `7577ee7`, PR #134, déployée le 5 octobre à
14 h 55 ; le logiciel est celui de `4b83563` (PR #132) ; le moteur, le
registre, le service et l'écran du planning sont ceux de la garde (PR
#125), seul le service de validation a changé depuis (#129). La troisième
recette de l'après-midi laissait la garde de la réserve prouvée par le test
des chiffres de la ferme seul, la semaine ne demandant que 17,92 m³ pour
100 mobilisables. La pénurie a donc été fabriquée, en six calculs dont
l'attendu a été écrit avant d'appuyer sur « Recalculer le plan », puis la
ferme a été remise dans son état. **Les constats sont de l'assistant ; le
jugement agronomique reste au porteur** (D-014). Les chiffres sont relus
dans la page par script, carte par carte ; les heures sont celles du
serveur quand elles viennent du plan, le poste avançant d'une minute.
Aucune lecture à 390 px, couverte par le parcours P10.

### L'état de départ, et ce qui a été changé pour les essais

| Donnée | Au départ | Pendant les essais |
| --- | --- | --- |
| Réserve tampon | 25 m³ observés le 5 octobre à 20 h 24, saisis sur le mot du porteur (« il y a en ce moment 25 mètres cubes »), motif « Autre », « Dernière correction tracée : 30 m³ → 25 m³ » ; capacité 60 m³, minimum de sécurité 0 | minimum 20 m³ (T2), 40 m³ (T3), puis 0 |
| Forage principal | Disponible, 0,511 m³/h, alimentation automatique de la réserve, sans limite | Indisponible (T1) ; limite de prélèvement 10 m³/jour à partir du 5 octobre (T4a, T4b) |
| R2, part de la pluie prévue déduite du besoin | 100 % | 0 % de T1 à T4b, pour ramener le plein champ dans le besoin : 82,70 m³ demandés au lieu de 17,92 |
| R9, conduite en pénurie | prioritaires d'abord, puis part égale ; toutes les planches de la ferme sont « Normale », donc part égale en pratique | inchangé |
| Limite journalière d'irrigation | aucune ; le formulaire porte un enregistrement désactivé du 25 juin au 30 septembre | 10 m³/jour du mardi 6 au dimanche 11 octobre (T4b) |
| Météo | prévision de l'après-midi : pluie mercredi 6,1 mm, jeudi 8,8, au-dessus du seuil R3 | inchangée |
| Pompe, matériel, objectif | « La pompe », 8 m³/h ; 34 matériels positionnés ; 20 mm par semaine partout ; réglages du planning de la troisième recette | inchangés |

### Les six calculs, l'attendu écrit avant chacun

| Calcul | Réglage | Attendu (contrat, « Pénurie » et « La garde de la réserve ») | Constaté à l'écran | À la main |
| --- | --- | --- | --- | --- |
| T0, 20 h 26, 3,2 s | observation seule | en-tête daté de l'observation ; budget 25 + 0,511 × heures jusqu'à dimanche minuit ; plan de l'après-midi retrouvé | « Réserve tampon : 25,00 m³ observés le 05/10/2026 20:24 » ; 8 propositions, 17,92 m³, « Manque d'eau 0,00 m³ » ; « 100,383 m³ mobilisables pour 17,92 m³ demandés » | 25 + 0,511 × 147,5 h = 100,38 |
| T1, 20 h 28, 6,2 s | forage Indisponible, R2 0 % | budget 25 m³ ; stock consommé jusqu'au bout, jamais sous 0 ; part égale ; planches non servies nommées ; manque chiffré | « 25,00 m³ mobilisables pour 82,70 m³ demandés · servi : haute 100 %, normale 30 %, basse 100 % » ; 32 propositions, 24,999 m³ ; « Manque d'eau 62,187 m³ » ; 164 planches non servies : 134 « stock et ressources insuffisants d'ici dimanche », 22 « portée du matériel insuffisante », 8 « réserve au minimum de sécurité au moment voulu » (tunnel 4) ; toutes les doses à 6 mm ; niveau projeté le plus bas 0,001 m³ | 25 − 24,999 = 0,001 ; 6 mm = 30 % de 20 |
| T2, 20 h 31, 33,3 s | forage Disponible, minimum 20 m³, R2 0 % | budget (25 − 20) + apport ; vagues décalées aux nuits suivantes au rythme du forage ; jamais sous 20 | « 80,333 m³ mobilisables pour 82,70 m³ demandés · servi : haute 100 %, normale 97 %, basse 100 % » ; 48 propositions, 69,775 m³ ; « Manque d'eau 23,594 m³ » ; 164 non servies, dont 140 à 0,6 mm près ; niveau projeté le plus bas 20,00, exactement | (25 − 20) + 0,5108 × 147,48 h = 80,33 ; 0,6 mm = 3 % de 20 |
| T3, 20 h 39, 11,9 s | minimum 40 m³, au-dessus du stock | aucun créneau avant que l'apport ait comblé les 15 m³ manquants, vers mercredi 2 h ; puis au rythme du forage ; jamais sous 40 | carte « Mobilisable 0 m³ · Minimum 40 m³ » ; « 75,269 m³ mobilisables pour 82,70 m³ demandés · servi : haute 100 %, normale 91 %, basse 100 % » ; 42 propositions, 60,199 m³ ; « Manque d'eau 31,474 m³ » ; lundi « Aucune proposition », première irrigation mercredi 04 h 17 → 05 h 47, 15 mm, 1,92 m³, 40,003 m³ projetés ; niveau projeté le plus bas 40,00 | 0 + 0,5108 × 147,35 h = 75,27 ; 25 + 0,5108 × 33,13 h − 1,92 = 40,00 |
| T4a, 20 h 42, 6,9 s | minimum 0 ; limite de prélèvement du forage 10 m³/jour | budget 25 + apport plafonné à 10 m³ par jour ; pas de pénurie | carte « Limite 10 m³/j » ; « 86,684 m³ mobilisables pour 82,70 m³ demandés · servi : haute 100 %, normale 100 %, basse 100 % » ; 63 propositions, 86,266 m³ ; « Manque d'eau 0,00 m³ » ; 85 planches non servies, aucune pour un motif d'eau ; niveau projeté de 0 à 39,032 | 25 + 0,5108 × 3,3 h + 6 × 10 = 86,69 |
| T4b, 20 h 43, 3,8 s | scénario 4 du contrat : limite journalière d'irrigation 10 m³/jour du mardi au dimanche | aucun jour au-dessus de 10 m³ ; manque nommé « limite journalière » | « 86,671 m³ mobilisables pour 82,70 m³ demandés · limite journalière : 60,00 m³ restants · servi : haute 100 %, normale 73 %, basse 100 % » ; 28 propositions, 43,001 m³ ; « Manque d'eau 45,485 m³ » ; lundi 13,002 m³ (jour sans limite), mardi 0, mercredi et jeudi rien, vendredi, samedi et dimanche 10,00 m³ chacun ; 164 non servies : 89 « stock et ressources insuffisants », 51 « limite journalière d'irrigation atteinte ; stock et ressources insuffisants », 2 R6/R7, 22 portée | 13,002 + 3 × 10 = 43,00 ; 14,5 mm = 73 % de 20 |
| Final, 20 h 47, 3,0 s | tout remis | plan de T0 retrouvé | 8 propositions, 17,92 m³, « Manque d'eau 0,00 m³ », « 100,203 m³ mobilisables pour 17,92 m³ demandés » | 100,383 − 0,511 × 21 min = 100,20 |

### Ce que la garde a fait, créneau par créneau

**T1, sans apport.** Lundi 21 h 00 : tunnel 1 à 6 mm, 0,774 m³, 21,196 m³
projetés après ; tunnel 2 à 6 mm, 1,548 m³, 21,196 ; tunnel 3 raccourci à
5,8 mm, 1,482 m³, 21 h 00 → 21 h 34, « ce que la réserve fournit sans
passer sous son minimum », contrainte « réserve « Réserve tampon » au
minimum de sécurité », 21,295 ; tunnel 4 : rien, « réserve au minimum de
sécurité au moment voulu ». Mardi : seule la carte refusée de 14 h 04.
Mercredi et jeudi : rien (R3). Vendredi 06 h 00 → 06 h 25 : douze
goutte-à-goutte à 6 mm, 17,767 ; 06 h 26 gag10 et gag15, « dès que la pompe
est libre », 17,422 ; 21 h 00 → 21 h 48 rampes des blocs 2, 3 et fleurs,
11,004 ; 21 h 49 → 22 h 37 blocs 4 à 7 et fleurs 3, 4,781 ; 22 h 38 →
23 h 26 blocs 8 et 9, 1,771 ; samedi 21 h 00 fleurs 2 et bloc 1, 0,122 ;
dimanche gag2, 0,001. Les 33 niveaux projetés lus vont de 21,295 à 0,001 :
le stock est consommé à un litre près, jamais au-dessous de zéro. Motifs
de moment : 19 « après la pluie prévue », 9 « dès que la pompe est libre »,
3 R8, 2 R7.

**T2, avec apport et minimum à 20.** Lundi 21 h 00 → 22 h 30 : tunnels 1 et
2 à 15 mm, 1,92 et 3,84 m³, 20,245 (25 + 0,511 × 1,98 − 5,76 = 20,25) ;
tunnels 3 et 4 décalés au samedi 21 h 00 (8,2 mm, 2,10 m³, 23,016 ; 15 mm,
3,84 m³, 21,623). La réserve remonte à 60 dans la nuit de jeudi, 20,245 +
0,511 × 80 h dépassant la capacité. Vendredi 06 h 00 → 06 h 42 : quatorze
goutte-à-goutte à 10 mm, 52,679 ; 21 h 00 → 23 h 00 rampes des blocs 11,
2, 3, fleurs et 10 à 15 mm, 44,505 ; 23 h 00 → 01 h 00 blocs 4 à 7,
30,089 ; samedi 01 h 00 → 03 h 00 blocs 8 et 9, 23,642 ; samedi 06 h 00 →
06 h 40 goutte-à-goutte à 9,4 mm, 20,172, puis gag10 et gag15 à 06 h 43,
20,00 exactement ; samedi 21 h 00 gag13 à 6,9 mm, 24,515, puis les tunnels
3 et 4 ; dimanche 21 h 00 fleurs 2 à 15 mm, 30,047. Les vagues sont
décalées aux nuits suivantes au rythme du forage, ce que la roadmap
attendait de cette recette ; le point le plus bas est le minimum lui-même.
Un second calcul du même état, à 20 h 33, a placé le tunnel 3 autrement :
mardi 04 h 03 → 05 h 10, 11,2 mm, 2,874 m³, 20,78, « dès que la réserve a
l'eau nécessaire » (20,245 + 0,511 × 6,67 − 2,874 = 20,78) ; voir « Autres
constats ».

**T3, réserve sous son minimum.** Rien avant que l'apport ait remonté la
réserve : première irrigation mercredi 04 h 17 → 05 h 47, tunnel 1 à
15 mm, 1,92 m³, 40,003, « dès que la réserve a l'eau nécessaire »,
contrainte « réserve au minimum de sécurité » — 25 + 0,5108 × 33,13 h −
1,92 = 40,00 : le moteur attend l'heure exacte où l'apport a comblé le
manque. Mercredi 21 h 00 : tunnel 2 à 15 mm, 42,485 ; tunnel 3 réduit à
8,7 mm, 43,784. Vendredi 06 h 00 goutte-à-goutte à 10 mm, 53,272 ; 21 h 00
→ 23 h 00 rampes jusqu'au bloc 10, 46,328 ; 23 h 00 bloc 4 à 15 mm,
40,433, bloc 5 réduit à 13,4 mm, 40,706 ; samedi 06 h 00 goutte-à-goutte
réduits à 8,2 mm, 40,00 exactement ; gag7 à 06 h 47, 40,006, et gag8 à
07 h 33, 40,004, décalés de 12 puis 46 minutes, le temps que le forage
remonte 0,394 m³ ; samedi 21 h 00 blocs 6 et 7 à 15 mm, 40,228 ; dimanche
03 h 56 bloc 8 réduit à 14,8 mm, 40,046 ; 06 h 00 gag9 à 8,2 mm, 40,00.
Sur les 42 propositions, le niveau projeté va de 40,00 à 53,272 : aucune
sous le minimum. Non servies : 109 « stock et ressources insuffisants »
(20 mm demandés, 18,2 placés), 26 « réserve au minimum de sécurité au
moment voulu ; stock et ressources insuffisants », 7 R6/R7, 22 portée.

**T4a, limite de prélèvement du forage.** Lundi 21 h 00 tunnels 1 à 3 à
15 mm, 16,317 ; 22 h 30 tunnel 4 réduit à 7,7 mm, pompe saturée, 14,732 ;
mardi 21 h 00 tunnels à 5 mm, 20,862 ; vendredi 24 propositions, 37,601 m³ ;
samedi 26, 24,164 ; dimanche 6, 9,722 ; samedi 23 h 00 → 23 h 40 blocs 4 à
7 et fleurs 3 à 5 mm, 0,00 ; dimanche 21 h 00 bloc 1 et fleurs 2 à 15 mm,
0,001. Le stock et l'apport plafonné sont consommés jusqu'au bout, jamais
au-dessous de zéro. Les 85 planches non servies le sont pour R6 et R7 (8),
la portée (69) ou la dose minimale (8) : aucun motif d'eau, cohérent avec
« Manque d'eau 0,00 m³ ».

**T4b, limite journalière d'irrigation.** Lundi, jour sans limite : tunnels
1 à 3 à 14,5 mm, 16,593, tunnel 4 à 22 h 28, 13,627 ; mardi rien que la
carte refusée ; mercredi et jeudi rien (pluie prévue) ; vendredi 8
propositions et 10,00 m³, samedi 11 et 10,00, dimanche 5 et 10,00 : chaque
jour limité est rempli exactement, aucun ne dépasse. Trois créneaux portent
la limite comme contrainte, « limite journalière d'irrigation atteinte »,
dose « ce que la limite journalière laisse » : vendredi 06 h 00 gag4 à
7,9 mm, 0,377 m³ ; samedi 06 h 00 gag7 à 8,5 mm, 0,407 ; dimanche 21 h 00
bloc 5 à 13,1 mm, 3,194 — le dernier créneau du jour prend ce qui reste.
Le niveau projeté va de 13,627 à 45,87.

### Le temps de calcul

Mesuré depuis le navigateur, du clic sur « Recalculer le plan » à la fin de
« Calcul en cours… » : 3,2 s (T0, 8 créneaux), 6,2 s (T1, 32), 33,3 s (T2,
48), plus de 45 s au second calcul de T2 à 20 h 33 — la lecture par script
a expiré —, 6,6 puis 41,9 s aux troisième et quatrième calculs du même état
à 20 h 38, 11,9 s (T3, 42), 6,9 s (T4a, 63), 3,8 s (T4b, 28), 3,0 s
(final, 8). Même état, même page : de 6,6 à plus de 45 s. La variation
n'est proportionnelle ni au nombre de créneaux ni au travail du moteur
seul, dont le test d'une semaine complète tient en moins d'une seconde sur
le poste du porteur ; elle est du côté du serveur. Point ouvert 34.

### La remise en état

Entre 20 h 45 et 20 h 48 : forage « Modifier », limite décochée, carte
« Débit 0,511 m³/h · État Disponible · Limite Aucune » ; réserve, minimum
remis à 0 avant T4a, carte « Mobilisable 25 m³ · Minimum 0 m³ » ; R2 de 0
à 100 %, « Réglages enregistrés : ils valent au prochain calcul » ; limite
journalière : un premier enregistrement désactivé sur les dates que le
formulaire proposait, 25 juin → 30 septembre, n'a rien retiré — « La
limite journalière est désactivée pour cette période », le tableau de la
semaine gardant 10,00 m³ du mardi au dimanche, la limite applicable à un
jour étant le dernier enregistrement qui le couvre
(`latestApplicableLimit`, `lib/domain/water-management.ts`) — ; un second,
désactivé sur le 6 → 11 octobre, note « fin du test recette 4 : limite
retirée », a ramené « — » tous les jours. L'historique des limites garde
les trois enregistrements de la soirée. Recalcul final à 20 h 47 : le plan
de T0, 8 propositions, 17,92 m³, « 100,203 m³ mobilisables ». L'observation
de 25 m³ reste, elle est vraie ; la carte refusée de 14 h 04 aussi. Les
données de la ferme sont dans l'état où le porteur les a laissées à
20 h 24, à l'historique près.

### Au jugement du porteur

1. **La part égale est une cible, non un résultat.** T1 : « servi : normale
   30 % » et toutes les doses à 6 mm, mais le tunnel 4 n'a rien eu,
   « réserve au minimum de sécurité au moment voulu » — le moteur ne place
   pas dans l'ordre du temps ; quand le tunnel 4 est examiné, les derniers
   litres sont déjà promis aux créneaux de vendredi et samedi, placés avant
   lui, et son créneau du lundi ferait passer la réserve sous zéro plus tard
   dans la semaine. Le contrat dit « chaque planche reçoit la même fraction
   de son besoin » ; sur la ferme, les planches servies ont reçu 30 % et les
   huit du tunnel 4 rien. Point ouvert 36.
2. **« Manque d'eau » et « demandés » ne mesurent pas la même chose.** T1 :
   82,70 m³ demandés, 24,999 placés, « Manque d'eau 62,187 m³ » et non
   57,70. Le manque est la somme, planche par planche, du besoin non couvert
   fois la surface mouillée de la planche par son matériel
   (`summarizeDeficit`, `lib/domain/planning/engine.ts`) ; les demandés sont
   la somme des besoins ; le placé est le volume des créneaux. Cause
   vraisemblable, à confirmer dans le code : une planche arrosée par son
   goutte-à-goutte le matin et par le bord d'une rampe le soir reçoit l'eau
   de la rampe comptée sur la surface mouillée en aspersion, et son manque
   est compté sur la surface mouillée du goutte-à-goutte, plus petite. Le
   contrat demande que le déficit annoncé soit « exactement le besoin non
   couvert, planche par planche » : il l'est ; c'est l'écart avec le budget
   qui surprend, à dire à l'écran. Point ouvert 36.
3. **La limite journalière coupe au nom du stock.** T4b : le stock et les
   ressources suffisent, 86,671 m³ pour 82,70 demandés, et la limite
   journalière laisse 60 m³ ; le moteur prend le plus petit des deux comme
   budget (`applyShortage`, `lib/domain/planning/shortage.ts`), sert 73 % à
   chaque planche normale et nomme la coupe « stock et ressources
   insuffisants d'ici dimanche » sur 89 planches, « limite journalière
   d'irrigation atteinte ; stock et ressources insuffisants » sur 51 ; le
   résumé dit « Manque d'eau 45,485 m³ · ce que le stock et les ressources
   ne couvrent pas ». Le contrat, scénario 4, attend un manque « nommé
   « limite journalière » ». De plus, les 60 m³ de la limite valent du mardi
   au dimanche, et le lundi, sans limite, pouvait prendre 13 m³ de plus : la
   cible de 60 était trop basse de 13 m³ ; le placement n'en a de toute
   façon mis que 43, mercredi et jeudi étant pris par la pluie prévue. La
   règle forte tient — aucun jour limité au-dessus de 10 m³ — ; ce sont le
   motif, le libellé du résumé et le calcul de la cible qui s'écartent du
   contrat. Point ouvert 35.
4. **Le temps de calcul sur le site.** De 3 s à plus de 45 s pour le même
   état. Le moteur n'est pas seul en cause ; à profiler côté serveur —
   lectures et écritures D1, isolat — avant la piste de `minimumLevel` du
   point 28. Point ouvert 34.
5. **La carte refusée garde le niveau d'un autre calcul.** « Proposition p-8
   du calcul du 05/10/2026 14:04 », refusée, affiche « 28,899 m³ projetés
   après ce créneau » à chaque recalcul de la soirée, quand la réserve
   projetée du moment valait 21 ou 40 : c'est le niveau de son propre
   calcul, daté, mais rien ne le dit sur cette ligne. Petit ; relève du
   point 31, ce qu'un refus vaut pour la suite.

### Autres constats

- **Deux calculs du même état n'ont pas placé le tunnel 3 au même moment** :
  à 20 h 31 samedi 21 h 00 à 8,2 mm, à 20 h 33 mardi 04 h 03 à 11,2 mm,
  « dès que la réserve a l'eau nécessaire ». Deux minutes séparent les
  calculs, l'horizon commence deux minutes plus tard et l'apport perd
  0,017 m³ ; rien d'autre n'a changé. Les deux plans respectent le minimum.
  Non élucidé ; un test rejouant le moteur deux fois sur les mêmes entrées
  à quelques minutes d'écart le dirait.
- **Désactiver une limite journalière demande sa période.** Le formulaire
  propose les dates du dernier enregistrement ; décoché et enregistré tel
  quel, il crée un enregistrement désactivé sur ces dates et laisse la
  limite active sur les autres, avec le message « La limite journalière est
  désactivée pour cette période ». Juste, mais piégeux : il faut saisir la
  période de la limite à retirer.
- **« servi : haute 100 %, basse 100 % »** s'affiche alors qu'aucune planche
  de la ferme n'est en priorité haute ni basse. Sans conséquence.
- **La carte de la réserve dit « Mobilisable 0 m³ »** quand le minimum
  dépasse le stock (T3), jamais un nombre négatif.
- **Outils.** Les lectures sont faites par script dans le Chrome du
  porteur ; l'appel qui attend la fin d'un calcul expire à 45 s, d'où la
  durée inconnue du calcul de 20 h 33 ; l'outil réseau de l'extension ne
  donne pas la durée des requêtes.

### Ce que cette recette prouve, et ce qu'elle ne prouve pas

- **Prouvé sur la ferme, en pénurie fabriquée** : la garde de la réserve —
  jamais sous le minimum, à 0,001 m³ près quand il vaut 0 (T1, T4a), à
  20,00 et 40,00 exactement quand il est relevé (T2, T3) — ; le stock
  consommé jusqu'au dernier litre ; les créneaux raccourcis, « ce que la
  réserve fournit sans passer sous son minimum », et décalés, « dès que la
  réserve a l'eau nécessaire », à l'heure exacte où l'apport a comblé le
  manque, fût-ce de 12 ou 46 minutes ; les vagues décalées aux nuits
  suivantes au rythme du forage ; une réserve déjà sous son minimum qui ne
  propose rien avant d'être remontée ; le budget « mobilisables » = stock −
  minimum + apport, l'apport plafonné par la limite de prélèvement de la
  ressource (3.1) ; la conduite R9 « prioritaires d'abord, puis part égale »
  comme cible, 30, 97, 91 et 73 % ; la limite journalière d'irrigation comme
  règle forte, aucun jour limité au-dessus de 10 m³, chacun rempli
  exactement ; les motifs « stock et ressources insuffisants », « réserve au
  minimum de sécurité au moment voulu », « limite journalière d'irrigation
  atteinte », « ce que la limite journalière laisse » ; la remise en état
  par l'écran seul.
- **Non prouvé** : les conduites « part égale pour toutes » et « report »
  (R9), non jouées ; une réserve engagée sous son minimum par des
  irrigations planifiées à la main ; la validation en pénurie ; 390 px,
  couvert par P10.
- **Le moteur 3.5** tient la garde sur la ferme, ce que la troisième recette
  ne pouvait pas dire : le point 19 se ferme. Trois écarts restent, à son
  contrat ou à son écran, points 34 à 36 — le temps de calcul sur le site,
  les noms de la coupe sous limite journalière, la part égale qui n'en est
  pas une pour la dernière planche examinée — ; la clôture de la 3.5 reste
  au jugement du porteur.

## Cinquième recette, le samedi 10 octobre 2026 : la part réservée (point 36)

Faite sur la version déployée, dans le navigateur du porteur, sur son
« reprends le travail » du matin et sous sa consigne du 5 octobre — « tu peux
modifier les données comme tu l'entends, tant que tu remets dans l'état
précédent » —, le samedi 10 octobre de 12 h 11 à 12 h 24, sur la semaine du 5
au 11 octobre. Version déployée : `main` à `2c7fb8b`, PR #162, déployée le 9
octobre à 22 h 25 ; le moteur de la part réservée, la ligne de budget et la
note du manque d'eau sont ceux de la PR #158 (`b431b79`), les journaux de
durée ceux de la PR #160. La semaine ne demande que 17,92 m³ — les quatre
tunnels à 20 mm, le plein champ à 0 après 23,2 mm de pluie réelle — : la
pénurie a été fabriquée comme le 5 octobre, forage indisponible et minimum de
sécurité relevé, en deux calculs dont l'attendu a été écrit avant d'appuyer
sur « Recalculer le plan », puis la ferme a été remise dans son état et un
dernier calcul a retrouvé le plan du matin. **Les constats sont de
l'assistant ; le jugement reste au porteur** (D-014), la clôture de la 3.5
aussi. Les chiffres sont relus dans la page par script, carte par carte ; les
heures sont celles du poste, à la minute. Largeur 390 px non émulée : l'outil
a répondu deux fois que la fenêtre était redimensionnée et la page est restée
à 1 920 px ; le parcours P10 couvre cette largeur.

### L'état de départ, et ce qui a été changé pour les essais

| Donnée | Au départ, 12 h 11 | Pendant les essais |
| --- | --- | --- |
| Plan affiché | recalcul du matin de 06 h 16 : 8 propositions, 17,92 m³ — samedi 15 mm sur les quatre tunnels, 13,44 m³ ; dimanche 5 mm, 4,48 m³ —, « Manque d'eau 0,00 m³ », « 46,318 m³ mobilisables pour 17,92 m³ demandés · part réservée : haute 100 %, normale 100 %, basse 100 % » | recalculé à la demande à chaque essai |
| Réserve tampon | 25 m³ observés le 5 octobre à 20 h 24 (« Dernière correction tracée : 30 m³ → 25 m³ »), capacité 60 m³, minimum de sécurité 0, « Mobilisable 25 m³ » | minimum 16 m³ à 12 h 15 (T1), 20 m³ à 12 h 16 (T2), puis 0 |
| Forage principal | Disponible, 0,511 m³/h, alimente la réserve, limite « Aucune » ; l'éditeur garde l'enregistrement désactivé de la limite du 5 octobre | Indisponible à 12 h 14 (T1, T2), puis Disponible |
| Besoins | les 32 planches des tunnels 1 à 4 à 20 mm, toutes « Normale », 896 m² mouillés en tout — 16 m² par planche du tunnel 1, 32 m² par planche des tunnels 2 à 4 — ; plein champ à 0 mm | inchangés |
| Réglages du planning | R2 100 %, aspersion de 5 à 15 mm, plage 21 h 00 → 08 h 00, R9 « prioritaires d'abord, puis part égale », toutes les planches étant « Normale » | inchangés |
| Pompe, matériel | « La pompe », 8 m³/h ; rampes de serre à 10 mm/h, 1,28 m³/h pour le tunnel 1 et 2,56 m³/h pour les tunnels 2 à 4 | inchangés |

### Les trois calculs, l'attendu écrit avant chacun

À 12 h 15, l'horizon va du samedi 21 h 00 au dimanche minuit : une seule nuit
de plage avant la fin de la semaine, et le dimanche soir de 21 h 00 à minuit.

| Calcul | Réglage | Attendu (contrat, « La part réservée », D-037 et D-038) | Constaté à l'écran | À la main |
| --- | --- | --- | --- | --- |
| T1, 12 h 15, 2,08 s | forage Indisponible, minimum 16 m³ | budget 9 m³ ; part réservée 50 % ; chaque tunnel reçoit sa part, le tunnel 4 — dernier examiné, le seul à attendre la pompe — compris ; réserve jamais sous 16 ; manque 8,92 m³ | « 9,00 m³ mobilisables pour 17,92 m³ demandés · part réservée : haute 100 %, normale 50 %, basse 100 % » ; 4 propositions à 10 mm, 9,00 m³ : tunnels 1, 2 et 3 à 21 h 00 → 22 h 00, 1,286, 2,571 et 2,571 m³, « 18,572 m³ projetés après ce créneau » ; tunnel 4 à 22 h 01 → 23 h 01, 2,571 m³, « dès que la pompe est libre », contrainte « pompe « La pompe » saturée avant 22:01 : Rampe de serre tunnel 1, Rampe de serre tunnel 2, Rampe de serre tunnel 3 », « 16,00 m³ projetés après ce créneau » ; « Manque d'eau 8,92 m³ » ; 32 planches non servies, besoin 20 mm, placé 10 mm, manque 10 mm, « stock et ressources insuffisants d'ici dimanche » ; pas de note sous les cartes | 25 − 16 = 9,00 ; 9,00 m³ / 896 m² = 10,04 mm = 50 % de 20 ; 25 − 1,286 − 2 × 2,571 = 18,572 ; 25 − 8,999 = 16,00 ; 17,92 − 9,00 = 8,92 |
| T2, 12 h 16, 2,50 s | minimum 20 m³ | budget 5 m³ ; part 28 % ; 5,6 mm par tunnel, le tunnel 4 compris ; réserve jamais sous 20 ; manque 12,92 m³ | « 5,00 m³ mobilisables pour 17,92 m³ demandés · part réservée : haute 100 %, normale 28 %, basse 100 % » ; 4 propositions à 5,6 mm, 4,998 m³ : tunnels 1, 2 et 3 à 21 h 00 → 21 h 33, 0,714, 1,428 et 1,428 m³, « 21,43 m³ projetés après ce créneau » ; tunnel 4 à 21 h 34 → 22 h 07, 1,428 m³, pompe saturée avant 21 h 34, « 20,002 m³ projetés après ce créneau » ; « Manque d'eau 12,92 m³ » ; 32 non servies, besoin 20 mm, placé 5,6 mm, manque 14,4 mm, « stock et ressources insuffisants d'ici dimanche » ; sous les cartes, la note : « Demandés 17,92 m³, placés 4,998 m³, manque d'eau 12,92 m³ : l'écart tient à 0,002 m³ de besoin couverts par une eau comptée sur une surface plus petite que celle de leur propre matériel. Le manque se compte planche par planche, sur la surface que son propre matériel mouille. » | 25 − 20 = 5,00 ; 5,00 / 896 = 5,580 mm = 28 % de 20 ; 5,580 mm à 10 mm/h = 2 008,9 s, coupées à 2 008 s = 5,578 mm, 0,714 + 3 × 1,428 = 4,998 ; 25 − 4,998 = 20,002 ; 17,92 − 5,00 = 12,92 ; 5,000 − 4,998 = 0,002 |
| Final, 12 h 23, 1,83 s | forage Disponible, minimum 0 | plan du matin retrouvé ; budget 25 + 0,511 × heures jusqu'à dimanche minuit | 8 propositions, 17,92 m³, « Manque d'eau 0,00 m³ », 0 planche non servie, pas de note ; « 43,193 m³ mobilisables pour 17,92 m³ demandés · part réservée : haute 100 %, normale 100 %, basse 100 % » ; mêmes créneaux, doses et volumes que le matin, « calculé le 10/10/2026 12:23 (à la demande) » | 25 + 0,511 × 35,6 h = 43,19 ; le budget du matin, 46,318, valait 25 + 0,511 × 41,7 h |

### Ce que la part réservée a fait

**T1, à 50 %.** Le budget de 9 m³ ne paie que la moitié des 17,92 demandés :
chaque planche reçoit pour cible sa part, 10,04 mm, et la dose de chaque rampe
est « le besoin restant de la planche la plus demandeuse », c'est-à-dire cette
part, 1 h 00 min 16 s à 10 mm/h, affichée 21 h 00 → 22 h 00. Les tunnels 1, 2
et 3 partent ensemble à l'ouverture de la plage — 6,4 m³/h pour une pompe de 8
—, le tunnel 4 attend la pompe et part à 22 h 01 : il reçoit ses 10 mm,
2,571 m³, et la réserve finit à 16,00 m³, le minimum exactement. Le 5 octobre,
dans le même état, les derniers litres allaient aux créneaux examinés avant
lui et le tunnel 4 restait sec, « réserve au minimum de sécurité au moment
voulu ». Aucun créneau n'a été raccourci par les parts, donc aucun motif
« part de la semaine réservée à ses planches » : les quatre rampes n'arrosent
que leurs propres planches, rien ne déborde sur celles d'une autre. La somme
des créneaux, 8,999 m³, ne dépasse pas le budget.

**T2, à 28 %.** Même mécanisme pour 5 m³ : 5,58 mm par planche, 33 min 28 s
par rampe, le tunnel 4 à 21 h 34 après les trois autres, la réserve à
20,002 m³ au plus bas pour un minimum de 20. Les quatre tunnels reçoivent
chacun leur fraction, le dernier examiné compris ; la somme des créneaux,
4,998 m³, reste sous le budget.

### La note du manque d'eau, et les deux litres

En T2 la note s'affiche : « l'écart tient à 0,002 m³ de besoin couverts par
une eau comptée sur une surface plus petite que celle de leur propre
matériel ». L'identité qu'elle surveille — placés égalent demandés moins
manque compté — est vérifiée à 2 L près ; mais la cause nommée n'est pas la
bonne. Les 2 L sont un résidu d'arrondi des secondes : la part de 5,580 mm
vaut 2 008,9 s à 10 mm/h, le moteur coupe chaque créneau à la seconde entière,
2 008 s, soit 5,578 mm livrés ; le reste, 0,0026 mm par planche, est sous le
centième de millimètre que le moteur tient pour négligeable et qu'il crédite à
la planche comme reçu (`commitProposal`, `lib/domain/planning/engine.ts`).
Planche par planche, le manque est donc compté sur une part entière, 5,000 m³
reçus, quand les quatre créneaux n'en livrent que 4,998 : 0,0026 mm × 896 m² =
2,3 L, affichés 0,002 m³. En T1 le même résidu vaut 0,07 s par créneau, 0,2 L
sur les quatre, sous le seuil d'un litre de la note, qui n'apparaît pas. Ce
résidu peut atteindre 0,01 mm fois la surface mouillée de chaque planche
servie, 9 L sur les quatre tunnels, bien au-dessus du seuil : la note se
déclenchera sur l'arrondi plus souvent que sur une vraie cause, et avec le
libellé d'une autre cause. Le calcul du manque, la ligne de budget et les
parts sont justes ; seule la note se trompe. Point ouvert 41, au jugement du
porteur.

### Le temps de calcul

Trois recalculs à la demande en 2,08 s, 2,50 s et 1,83 s vus du navigateur, du
clic à « Plan calculé. », dans la fourchette des trois lectures du 9 octobre
au soir (2,3 s). Le 3 s à 45 s du point 34 ne s'est pas produit ; aucune
occurrence à signaler, les journaux n'ont pas été relus.

### La remise en état

Par l'écran seul, à 12 h 23 : « État » du forage remis à Disponible dans
« Modifier la ressource », enregistré, carte « Disponible · Limite Aucune » ;
minimum de sécurité de la réserve remis à 0 dans « Modifier la réserve »,
enregistré, carte « Actuel 25 m³ · Capacité 60 m³ · Mobilisable 25 m³ ·
Minimum 0 m³ », l'observation du 5 octobre et sa correction tracée inchangées.
Le recalcul final retrouve les huit propositions du matin, créneau pour
créneau. Rien d'autre n'a été touché : R2, les objectifs, les pompes, les
matériels et les limites sont tels qu'au départ ; la carte refusée p-8 du 5
octobre est toujours là. Aucune proposition n'a été validée.

### Au jugement du porteur

1. **La part réservée tient sur la ferme.** À 50 % puis 28 % de part, chaque
   planche des quatre tunnels reçoit sa fraction, la dernière examinée
   comprise ; la somme des créneaux ne dépasse jamais le budget ; la réserve
   s'arrête exactement à son minimum, 16,00 et 20,002 m³ ; la ligne de budget
   dit « part réservée : normale 50 % » puis « 28 % ». C'est ce que D-037 et
   D-038 demandaient pour le point 36. La clôture de la 3.5, qu'il avait
   suspendue aux points 33, 35 et 36, est à lui.
2. **La note du manque d'eau nomme une cause fausse pour un résidu
   d'arrondi.** Détail ci-dessus. Trois voies : tolérer dans la note le résidu
   que le moteur tolère déjà — un centième de millimètre par planche servie,
   au prix de sa surface mouillée —, ou créditer aux planches ce que les
   secondes livrent plutôt que la part entière, ou nommer le résidu dans le
   libellé. Recommandation de l'assistant : la première, la règle vivant déjà
   dans le moteur, en une PR `fix/` à part, test rouge d'abord sur les
   chiffres de la ferme — 896 m² à 10 mm/h pour 5 m³ de budget. Point ouvert
   41.

### Autres constats

- **Le motif « part de la semaine réservée à ses planches » n'a pas pu être
  vu.** Il demande un créneau raccourci parce que son eau déborde sur des
  planches qui ne sont pas les siennes, ce que seules les rampes des blocs de
  plein champ font ; le plein champ, à 0 mm, ne demandait rien cette semaine.
  La branche positive de la note, « placés sans couvrir de besoin compté », et
  la libération des parts non reçues en fin de tour n'ont pas été vues non
  plus : toutes les planches ont pu recevoir leur part.
- **La carte refusée du 5 octobre** (p-8, tunnel 4, « calcul du 05/10/2026
  14:04 ») affiche toujours « 28,899 m³ projetés après ce créneau », le niveau
  de son propre calcul ; ce que vaut un refus pour la suite relève du point
  31, moteur de la 3.7.
- **« part réservée : haute 100 %, basse 100 % »** s'affiche sans planche de
  ces priorités, comme « servi » le 5 octobre. Sans conséquence.
- **L'éditeur du forage** garde l'enregistrement désactivé de la limite de
  prélèvement posée le 5 octobre, « Du 2026-10-05 » ; la carte dit « Limite
  Aucune ». Juste.
- **Outils.** Lectures et saisies par script dans le Chrome du porteur ;
  l'attente de la fin d'un calcul relit l'état « occupé » de la section toutes
  les 100 ms ; le redimensionnement à 390 px répond « fait » sans effet sur la
  page.

### Ce que cette recette prouve, et ce qu'elle ne prouve pas

- **Prouvé sur la ferme** : la fraction réservée à chaque planche en pénurie
  (D-037), la dernière examinée comprise, et le créneau d'une autre planche
  qui ne la consomme pas ; la garde de la réserve au minimum exact avec la
  part ; la ligne de budget « part réservée » (D-038) ; la remise en état par
  l'écran seul ; trois recalculs sous 2,5 s.
- **Non prouvé** : le créneau raccourci par ses parts et son motif, le
  débordement d'une rampe sur des planches voisines, la libération des parts
  en fin de tour, la branche positive de la note, les conduites « part égale
  pour toutes » et « report » (R9), la validation en pénurie ; 390 px, couvert
  par P10.
- **La note du manque d'eau** s'affiche pour un résidu d'arrondi des secondes
  sous un libellé qui nomme une autre cause : point 41, au jugement du
  porteur. La clôture de la 3.5 reste à lui.

## Sixième recette, le samedi 10 octobre 2026 : la note du manque d'eau (point 41)

Faite sur la version déployée, dans le navigateur du porteur, sous sa consigne
du 5 octobre — « tu peux modifier les données comme tu l'entends, tant que tu
remets dans l'état précédent » — et sur son « c'est parti, on commence » du
jour, le samedi 10 octobre de 13 h 23 à 13 h 34, sur la semaine du 5 au 11
octobre. Version déployée : `main` à `aea861f`, PR #164 fusionnée à 13 h 15 et
déployée à 13 h 21, les quatre jobs verts ; la note du manque d'eau est celle
de la PR #164 (`6d268bd`, D-040), le reste du moteur celui de la cinquième
recette. But : refaire à l'identique le calcul T2 du matin — forage
indisponible, minimum de sécurité à 20 m³, 5 m³ de budget pour 17,92 demandés
— et constater que la note, qui s'affichait le matin pour 0,002 m³ de résidu
d'arrondi sous un libellé qui nommait une autre cause, ne s'affiche plus, sans
que rien d'autre ne change au plan. L'attendu a été écrit avant d'appuyer sur
« Recalculer le plan » ; puis la ferme a été remise dans son état et un
dernier calcul a retrouvé le plan du matin. **Les constats sont de
l'assistant ; le jugement reste au porteur** (D-014). Les chiffres sont relus
dans la page par script, carte par carte ; les heures sont celles du poste, à
la minute. La fenêtre de Chrome qui portait l'onglet de l'extension était
réduite dans la barre des tâches : les captures d'écran ont expiré, les clics
réels de l'extension sont restés sans effet et un script à minuteries a été
figé ; les boutons de la page — « Modifier », « Enregistrer », « Recalculer le
plan » — ont donc été actionnés par script, en laissant React rendre entre
deux étapes, et chaque étape a été vérifiée sur le texte de la page (détail
sous « Autres constats »). Largeur 390 px sans objet, l'interface ne changeant
pas.

### L'état de départ, et ce qui a été changé pour les essais

| Donnée | Au départ, 13 h 23 | Pendant les essais |
| --- | --- | --- |
| Plan affiché | le plan final de la cinquième recette, « calculé le 10/10/2026 12:23 (à la demande) » : « Propositions 8 · 0 validée · 1 refusée · 0 expirée », 17,92 m³, « Manque d'eau 0,00 m³ », 0 planche non servie, aucune note, « 43,193 m³ mobilisables pour 17,92 m³ demandés · part réservée : haute 100 %, normale 100 %, basse 100 % » | recalculé à la demande à chaque essai |
| Réserve tampon | « Actuel 25 m³ · Capacité 60 m³ · Mobilisable 25 m³ · Minimum 0 m³ », volume observé le 5 octobre à 20 h 24 | minimum 20 m³ à 13 h 32, puis 0 |
| Forage principal | Disponible, 0,511 m³/h, limite « Aucune », alimente la réserve | Indisponible à 13 h 32, puis Disponible |
| Besoins, réglages, pompe, matériel | non relus : le plan affiché, identique à celui de 12 h 23, et le recalcul final les montrent tels que le matin — les 32 planches des tunnels à 20 mm sur 896 m² mouillés, le plein champ à 0, R2 100 %, aspersion de 5 à 15 mm, plage 21 h 00 → 08 h 00, « La pompe » à 8 m³/h, rampes à 10 mm/h | inchangés |

### Les deux calculs, l'attendu écrit avant chacun

À 13 h 32, l'horizon va du samedi 21 h 00 au dimanche minuit, comme le matin.

| Calcul | Réglage | Attendu (contrat, « Interface (3.6) », la note du manque d'eau, D-040) | Constaté à l'écran | À la main |
| --- | --- | --- | --- | --- |
| T2 bis, 13 h 32, 1,5 s | forage Indisponible, minimum 20 m³ | le plan de T2 à l'identique — budget 5 m³, part 28 %, 5,6 mm par tunnel, 4,998 m³, réserve à 20,002 m³ au plus bas, manque 12,92 m³ — et **aucune note sous les cartes** : le résidu de 0,002 m³ est sous la tolérance, un centième de millimètre sur les 896 m² arrosés, 0,009 m³ | « Plan calculé. » ; « Propositions 4 · 0 validée · 1 refusée · 0 expirée », « Volume proposé et validé 4,998 m³ », « Non vérifié 0 », « Manque d'eau 12,92 m³ », « Temps de pompage manquant 0,00 m³ », « Planches non servies 32 » ; **aucune note sous les cartes** ; « Réserve tampon 5,00 m³ mobilisables pour 17,92 m³ demandés · part réservée : haute 100 %, normale 28 %, basse 100 % » ; tunnels 1, 2 et 3 à 21 h 00 → 21 h 33, 33 min, 5,6 mm, 0,714, 1,428 et 1,428 m³, « 21,43 m³ projetés après ce créneau » ; tunnel 4 à 21 h 34 → 22 h 07, 1,428 m³, « 20,002 m³ projetés après ce créneau » ; la carte refusée du 5 octobre toujours là, « 28,899 m³ projetés » ; la page date le calcul « 13:31 », à la minute du serveur | 25 − 20 = 5,00 ; 5,00 / 896 = 5,580 mm = 28 % de 20 ; 0,714 + 3 × 1,428 = 4,998 ; 25 − 4,998 = 20,002 ; 17,92 − 5,00 = 12,92 ; résidu 5,000 − 4,998 = 0,002 m³, sous 0,01 mm × 896 m² = 0,009 m³ |
| Final, 13 h 33, 1,5 s | forage Disponible, minimum 0 | le plan du matin retrouvé ; budget 25 + 0,511 × heures jusqu'à dimanche minuit, un peu sous les 43,193 m³ de 12 h 23 | « calculé le 10/10/2026 13:33 (à la demande) » ; « Propositions 8 · 0 validée · 1 refusée », 17,92 m³, « Manque d'eau 0,00 m³ », 0 planche non servie, aucune note ; « Réserve tampon 42,598 m³ mobilisables pour 17,92 m³ demandés · part réservée : haute 100 %, normale 100 %, basse 100 % » ; quatre créneaux à 15 mm — 21 h 00 → 22 h 30 trois fois, 22 h 30 → 00 h 00 — et quatre à 5 mm — 21 h 00 → 21 h 30 trois fois, 22 h 30 → 23 h 00 —, comme le matin | 25 + 0,511 × 34,45 h = 42,60 ; 43,193 − 42,598 = 0,595 m³, soit 1 h 10 de forage à 0,511 m³/h, le temps écoulé depuis 12 h 23 |

### La note, absente ; le plan, identique

Le plan de T2 bis est celui de T2 du matin, créneau pour créneau : mêmes
heures, mêmes doses, mêmes volumes, même niveau projeté de 20,002 m³, même
manque de 12,92 m³, même part de 28 %. Seule la note a changé. Le matin, sous
les cartes : « Demandés 17,92 m³, placés 4,998 m³, manque d'eau 12,92 m³ :
l'écart tient à 0,002 m³ de besoin couverts par une eau comptée sur une
surface plus petite que celle de leur propre matériel. Le manque se compte
planche par planche, sur la surface que son propre matériel mouille. »
L'après-midi, rien. C'est ce que D-040 demande : l'écart de 0,002 m³ entre
« placés » et « demandés moins manque compté » est le résidu des secondes —
quatre créneaux de 2 008 s pour 2 008,9 voulues — ; la tolérance de la note
vaut le plus grand d'un litre et d'un centième de millimètre par planche et
par créneau qui l'arrose, au prix de la surface mouillée de l'application,
soit 0,009 m³ sur les 896 m² des quatre tunnels ; 0,002 est dessous, la note
se tait. Le calcul du manque, la ligne de budget et les parts, qui étaient
justes le matin, n'ont pas bougé. La note n'a pas été vue reparaître au-delà
de la tolérance : aucune pénurie de la ferme ne produit un écart de plus de
9 L sans vraie cause ; le test des chiffres de la ferme
(`tests/planning-presentation.test.ts`) couvre ce cas à 0,022 m³.

### Le temps de calcul

Deux recalculs à la demande en 1,5 s chacun vus du navigateur, du clic à
« Plan calculé. », sous les 1,83 à 2,50 s du matin et les 2,3 s du 9 octobre
au soir. Le 3 s à 45 s du point 34 ne s'est pas produit ; aucune occurrence à
signaler, les journaux n'ont pas été relus.

### La remise en état

Par l'écran seul, à 13 h 33 : « État » du forage remis à Disponible dans
« Modifier la ressource », enregistré, carte « Débit 0,511 m³/h · État
Disponible · Limite Aucune » ; minimum de sécurité de la réserve remis à 0
dans « Modifier la réserve », enregistré, carte « Actuel 25 m³ · Capacité
60 m³ · Mobilisable 25 m³ · Minimum 0 m³ », l'observation du 5 octobre
inchangée. Le recalcul final retrouve les huit propositions du matin, créneau
pour créneau. Rien d'autre n'a été touché ; la carte refusée p-8 du 5 octobre
est toujours là ; aucune proposition n'a été validée. L'onglet de l'extension
a été fermé à 13 h 34.

### Au jugement du porteur

1. **La note du manque d'eau se tait sur le résidu d'arrondi, et sur rien
   d'autre.** Le plan de T2 est retrouvé à l'identique, la note absente :
   c'est ce que D-040 demandait pour le point 41. Constat de l'assistant.
2. **Tranché par le porteur à 13 h 55**, sur quatre questions posées par
   l'assistant pour clôturer proprement les points ouverts entre deux
   sous-tranches : le point 4 fermé (« Fermer le point 4 ») ; les points 36 et
   41 fermés (« Fermer les deux ») ; le point 34 laissé en veille, non
   bloquant, à rouvrir à la première occurrence dans les journaux (« Le
   laisser en veille, non bloquant ») ; la sous-tranche 3.5 close (« Oui,
   clore la 3.5 »). Le point 31 reste au moteur de la 3.7 (D-030).

### Autres constats

- **La fenêtre réduite.** L'onglet ouvert par l'extension vivait dans une
  fenêtre de Chrome réduite dans la barre des tâches — page « cachée »,
  fenêtre de 160 × 28 px — où Chrome ralentit les minuteries et n'achemine pas
  les clics. Un premier script d'écriture, qui attendait par minuterie, a été
  figé 45 s sans rien appliquer, vérifié ensuite : aucun formulaire ouvert,
  forage toujours Disponible ; deux clics réels sur « Modifier » n'ont rien
  ouvert ; deux captures d'écran ont expiré, « le moteur de rendu semble
  figé ». Remède : cliquer les boutons par script et laisser React rendre par
  des tours de la file de messages, puis relire la page. Le formulaire
  « Modifier la ressource » s'est alors ouvert au premier clic, le forage
  enregistré « Indisponible » avec l'avis « La ressource a été modifiée. », la
  réserve enregistrée « Mobilisable 5 m³ · Minimum 20 m³ » ; de même au
  retour.
- **Un onglet orphelin.** En remplaçant le premier onglet par un neuf, le
  groupe d'onglets de l'extension a été dissous et le nouvel onglet en est
  sorti avant d'être repris : il a pu rester ouvert dans le Chrome du porteur,
  sur la page du module, à fermer à la main. Un troisième onglet, dans un
  groupe recréé, a servi à la recette et a été fermé.
- **L'horloge.** La page date le calcul de T2 bis « 13:31 » quand le poste
  lisait 13 h 32 : une minute d'écart entre l'horloge du serveur et celle du
  poste, sans effet sur le plan.
- **« part réservée : haute 100 %, basse 100 % »** s'affiche toujours sans
  planche de ces priorités. Sans conséquence.

### Ce que cette recette prouve, et ce qu'elle ne prouve pas

- **Prouvé sur la ferme** : la note du manque d'eau absente pour un résidu
  d'arrondi des secondes sous la tolérance (D-040) ; le plan de pénurie
  inchangé par ailleurs — créneaux, volumes, niveau projeté, manque, part — ;
  la remise en état par l'écran seul ; deux recalculs en 1,5 s.
- **Non prouvé** : la note reparaissant au-delà de la tolérance pour une vraie
  cause, couverte par le test des chiffres de la ferme à 0,022 m³ ; ce que la
  cinquième recette n'avait pas prouvé non plus — créneau raccourci par ses
  parts, débordement d'une rampe sur des planches voisines, libération des
  parts en fin de tour, branche positive de la note, conduites « part égale
  pour toutes » et « report », validation en pénurie — ; 390 px, couvert par
  P10.
- **Points fermés par le porteur** le 10 octobre 2026 : 4, 36 et 41 ; point 34
  en veille, non bloquant ; **sous-tranche 3.5 close**. Restent ouverts le
  point 31, au moteur de la 3.7, et le point 34.
