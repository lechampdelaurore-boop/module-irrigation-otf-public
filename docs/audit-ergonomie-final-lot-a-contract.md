# Contrat court — audit ergonomique final, lot A : le matin, l'essentiel (24 nonies)

Écrit le 15 novembre 2026 en Sonnet 5.5 · Moyen, sans code, sans PR,
d'après `docs/ROADMAP.md` (ligne 24 nonies) et le rapport
`audit-ergonomie-final-2026-11-14.md` (points **R1, R2, J14, J13**, D-117).
Les causes ci-dessous ont été **lues dans le dépôt** (`main` à #67) ; ce qui
reste à confirmer en codant est dit « à confirmer ».

**Choix n° 2 : oui (recommandation retenue).** Le lot change le contrat de la page
« Aujourd'hui » validé le 8 novembre 2026 (`docs/aujourdhui-tableau-de-bord-contract.md`,
section 3.5). Aucun code avant son accord sur le **choix n° 2** du rapport.
Le bouton « Répartir l'eau » sur « Aujourd'hui » (R4, première moitié, laissé
au lot A par le lot B) y est inclus.

**Accord du porteur (15 novembre 2026, 15 h 51, heure de Paris)** : « Je
suis d'accord avec toutes tes propositions. Toutes les recommandations. »,
puis « Point numéro 2, vas-y. » (D-137). Toutes les recommandations de ce
contrat sont retenues, et le code a son « vas-y ». Versé au dépôt par la
PR 1 du lot, en Opus 5.5 · Élevé (la ligne 24 nonies), les numéros recalés
sur le dépôt.

Affichage seul : aucun calcul de besoin, de pénurie, de plan ni de gel ne
change ; aucune donnée, aucune migration. Logiciel multi-fermes : chaque
phrase se construit à partir des fonctionnalités cochées de la ferme.

Registres (recalés sur le dépôt : le lot E en occupe jusqu'à D-136 et F273,
et D-137 consigne la confirmation des choix de l'audit) : décisions
**D-138 et suivantes** (une par PR), précisions **F274 et suivantes** ;
parcours P29/P30 (« Aujourd'hui ») étendus, P32 (le planning en pénurie)
relu et étendu.

## 1. Livraison en quatre PR, une à la fois

| PR | Point | Fichiers principaux | Preuve |
| --- | --- | --- | --- |
| 1 · Demain et l'eau qui manque | R1 | `lib/domain/today/headline.ts`, `today-view.ts`, `lib/services/today-service.ts`, `app/irrigation/today/today-header.tsx`, `today-day.tsx` | tests du domaine ; P29, P30, P32 |
| 2 · Un seul objectif | R2 | `lib/domain/today/week.ts`, `app/irrigation/today/today-week.tsx` (cause d'abord, voir 4) | tests du domaine ; P29 |
| 3 · Gel annoncé, aucune alerte | J14 | `lib/domain/today/today-view.ts` (`weatherBlock`), `today-weather.tsx` | tests du domaine ; P29 |
| 4 · Un en-tête moins répétitif | J13 | `today-header.tsx`, `shell/today-badge.tsx` | P29 aux deux largeurs |

Chaque PR : `lint`, `typecheck`, `test`, `build`, `knip`, `push:check`,
`weather:check` et `e2e` (et `e2e:demo`) collés ; registres dans la même PR ;
la première verse ce contrat et change la section 3.5 du contrat de la page.

## 2. Ce qui ne change pas

Le moteur du planning, la faisabilité, l'arbitrage et leurs nombres ;
`shortageAction` et `shortageDecisionPending` (`lib/domain/planning/shortage-reading.ts`),
**réutilisées telles quelles**, sans copie de règle (AGENTS.md, « Duplication
d'une règle métier ») ; les seuils d'alerte et de gel ; la règle de présence
(un bloc n'existe que si sa fonctionnalité est cochée) ; « Tout est fait » ;
la pastille du menu et son compte (F12, F33) sauf choix contraire en 6 ;
la démonstration (lot F) ; les arrondis et mots des lots E.

## 3. R1 — « Aujourd'hui » annonce demain et l'eau qui manque

**Cause établie dans le code.** `irrigationParts` (`headline.ts`) ne regarde
que les irrigations du jour (`late`, `todo`, « dont k à valider ») ; sans rien
à dire, `todayHeadline` écrit « Rien d'urgent aujourd'hui. » et la pastille
verte « Rien à arroser ». Le service lit déjà le plan de la semaine
(`readWeeklyPlanForUser`, donc `plan.proposals` et `plan.calculation`) quand
« Planning » est cochée : tout est disponible, rien n'est lu en plus.

Quand « Planning » est cochée, et seulement alors :

1. **Demain** : une ligne « Demain à 6 h : 3 arrosages à valider → Planning »
   quand des propositions « à valider » tombent le lendemain (ou, plus
   généralement, **dans les 24 heures qui suivent la fin de la journée**, ce
   qui évite de rater un créneau de 0 h à 5 h ; à confirmer par le choix F275).
   Heure donnée si toutes les propositions ont la même heure de début, sinon
   « dès 6 h ». Un clic mène au jour concerné du planning (F274).
2. **Eau qui manque** : « L'eau manque cette semaine : 5 planches ne recevront
   pas tout → Répartir l'eau », en reprenant **la phrase d'action du planning
   (lot B, `shortageAction`)** pour que les deux pages ne disent jamais deux
   choses. Le lien est le même que celui du planning, vers
   `ressources#repartition`, et n'apparaît que si la faisabilité est cochée
   (comme `repartitionHref` au planning). Après une répartition validée,
   « Revoir la répartition » (F276).
3. **La pastille « L'eau manque »**, orange, en tête des pastilles quand
   `shortageDecisionPending` est vrai ; la pastille verte « Rien à arroser »
   ne s'affiche plus tant qu'une ligne 1 ou 2 est dite (F277).
4. **La phrase de résumé** : « Rien d'urgent aujourd'hui. » n'est écrite que
   si ni le jour, ni demain, ni la semaine n'ont rien à dire. Sinon la phrase
   dit d'abord ce qui attend (F278).
5. **Eau disponible** : le bassin passe en orange sous son minimum de sécurité,
   avec le mot « sous son minimum » (pas seulement la couleur). Le minimum est
   celui de la réserve, déjà saisi ; aucune règle nouvelle (F279, à confirmer :
   si le minimum n'est pas lisible depuis `water.ts`, ce point sort du lot et
   le dit).

**Exemple de lecture** (jeux de la démo, pic d'été) : « 4 arrosages à
valider demain à 6 h · L'eau manque cette semaine : 5 planches ne recevront
pas tout → Répartir l'eau ».

## 4. R2 — Un seul objectif d'une page à l'autre

**Cause établie (en partie) dans le code.** Sur « Aujourd'hui »,
`weighted()` (`week.ts`) rend `null` dès qu'**une seule** planche n'a pas
d'objectif (« une valeur inconnue d'une planche laisse le total inconnu »,
règle D-003). Donc, dès qu'une planche sans objectif traîne dans un jardin,
ce jardin dit « objectif non fixé », et dès qu'une planche de la ferme n'en a
pas, la ferme entière le dit, **même si les neuf autres en ont un**. Même
logique pour « Reste à apporter : inconnu ». C'est la cause de la ligne « non
fixé » de l'audit sur la ferme vitrine, et ce n'est **pas** un défaut du
calcul : c'est une façon d'afficher qui cache ce qui est connu.

**Ce qui reste à établir en codant (point d'arrêt)** : pourquoi
« Objectifs et besoins » affiche « Non calculable » pour « À planifier »
d'une planche (`irrigation-needs-dashboard.tsx`, `formatMm`) et pourquoi
« Matériel » affiche « Objectif applicable : Aucun » à côté d'un « Objectif
proposé » (`bed-crop-water-panel.tsx`). Hypothèse à vérifier : l'objectif
**proposé** (calculé par le besoin de la culture) n'est **pas** l'objectif
**adopté** (D-010) ; trois pages parleraient alors de deux objets différents
sans le dire. **Si la cause est dans le calcul de l'objectif, le coordinateur
est prévenu avant de coder** (consigne de la ligne 24 nonies).

Règle d'affichage proposée (F280), sans toucher au calcul :

1. Quand la ferme n'a pas d'objectif complet mais que **certaines** planches
   en ont : « Aujourd'hui » résume : « Objectifs posés sur 7 planches sur 10 »,
   et chiffre ce qui est connu **sur ces 7 planches seulement**, en le disant
   (« sur les 7 planches qui ont un objectif : 12 / 25,1 mm »). Jamais un
   total qui additionne du connu et de l'inconnu.
2. Même mot partout où l'objectif d'une planche apparaît : « objectif adopté »
   pour ce qui s'applique, « objectif proposé » pour ce que le calcul suggère ;
   une phrase d'une ligne dans l'infobulle dit la différence (F281).
3. « Non calculable » à « Objectifs et besoins » dit **pourquoi** en une ligne
   (pas d'objectif adopté, culture sans Kc, etc.), au lieu de rester muet.
   Le détail de la raison est celui que le domaine connaît déjà ; à confirmer
   qu'il l'expose (F282).

## 5. J14 — Un gel annoncé sans alerte posée

**Cause établie dans le code.** `weatherBlock` (`today-view.ts`, phrase
« Aucune de vos alertes météo ne se déclenche ») ne dit « calme » que sur les
**alertes posées** (`criteria`) ; la carte du jour, elle, met le flocon dès que
la minimale est à 0 °C ou moins (`frosty`, `weather-days.ts`). Une ferme sans
alerte posée voit donc un flocon rouge et la phrase « rien ».

1. Quand une minimale prévue est ≤ 0 °C (ou sous le seuil de gel de la
   culture quand la fonction « Alertes cultures » est cochée) et qu'**aucune
   alerte de gel n'est posée** : « −2,4 °C annoncé mercredi et aucune alerte
   de gel posée. Poser « Gel : moins de 3 °C » → » (F283).
2. **Le geste** : un lien vers « Alertes météo » qui met le modèle en vue,
   **pas** une écriture depuis « Aujourd'hui » (option recommandée : le logiciel
   n'enregistre rien seul, D-028 ; le modèle se pose déjà en un clic sur la
   page des alertes). L'écriture directe est laissée à une PR ultérieure si
   François la demande (F284).
3. Seule la **phrase** change ; les seuils, les alertes et leurs envois non.

## 6. J13 — Un en-tête moins répétitif

Trois titres (« Aujourd'hui », « Tableau de bord », « Mardi 16 juin ») ; des
pastilles qui redisent la phrase ; un vide sous « Votre journée » à 1440 px ;
une pastille « 2 » et un point vert sur « Plus » qui ne disent pas ce qu'ils
comptent. Propositions (F285 à F287) :

1. Un seul titre de page (le nom de la page), la date en sous-titre.
2. Les pastilles ne redisent plus mot pour mot la phrase : elles deviennent
   des **liens vers le bloc**, avec le seul chiffre (« 4 à valider »).
3. La pastille du menu dit ce qu'elle compte dans son nom accessible
   (« 2 choses à regarder »), et le point vert de « Plus » est retiré s'il
   ne compte rien de plus (à confirmer par la lecture de `today-badge.tsx`).
4. À 1440 px, « Gel ou chaleur » passe sous « Votre journée » si celle-ci est
   courte : pas de grand vide.

## 7. Cas chiffrés (la preuve de fin les met en tests et en parcours)

| Cas | Entrée | Attendu |
| --- | --- | --- |
| 1 | Planning coché, 3 propositions « à valider » demain 6 h, rien aujourd'hui | ligne « Demain à 6 h : 3 arrosages à valider », pastille « 3 à valider demain », phrase sans « Rien d'urgent » |
| 2 | Pénurie, répartition en attente | ligne « L'eau manque cette semaine : n planches… → Répartir l'eau », même phrase qu'au planning, pastille orange |
| 3 | Pénurie, répartition validée | « Revoir la répartition » |
| 4 | Planning décoché | aucune ligne ni pastille de demain ni de l'eau |
| 5 | Faisabilité décochée | la phrase d'eau sans lien « Répartir l'eau » |
| 6 | 10 planches, 7 avec objectif | « Objectifs posés sur 7 planches sur 10 », chiffres « sur ces 7 planches » |
| 7 | 10 planches, aucune avec objectif | « Aucun objectif posé », pas de chiffre |
| 8 | Minimale −2,4 °C, aucune alerte de gel posée | phrase « aucune alerte de gel posée » avec le lien vers le modèle |
| 9 | Minimale −2,4 °C, alerte de gel posée | l'alerte se déclenche, phrase habituelle |
| 10 | Ferme neuve (rien d'annoncé, rien à valider, rien qui manque) | « Rien d'urgent aujourd'hui. » comme avant |

## 8. Précisions proposées (non agronomiques, option recommandée)

| N° | Précision | Choix recommandé |
| --- | --- | --- |
| F274 | Demain à valider | une ligne, lien vers le jour du planning |
| F275 | Fenêtre de « demain » | les 24 h qui suivent la fin du jour, pas seulement le jour civil suivant |
| F276 | Eau qui manque | même phrase que le planning (lot B), jamais une copie de la règle |
| F277 | Pastilles | orange « L'eau manque » ; plus de « Rien à arroser » vert quand une ligne parle |
| F278 | Phrase calme | seulement si ni jour, ni demain, ni semaine n'ont rien à dire |
| F279 | Bassin sous son minimum | orange avec le mot, sinon le point sort du lot |
| F280 | Objectif partiel | « Objectifs posés sur n planches sur N », chiffres limités à ces planches, dits |
| F281 | Objectif adopté / proposé | mots distincts, une phrase de différence |
| F282 | « Non calculable » | dit pourquoi, si le domaine le sait |
| F283 | Gel sans alerte | phrase « aucune alerte de gel posée » + modèle |
| F284 | Geste | lien, pas d'écriture depuis « Aujourd'hui » |
| F285 à F287 | En-tête | un titre, pastilles-liens, pastille du menu nommée, grille à 1440 px |

**À poser à François** (le seul choix qui le concerne, et il est déjà au
rapport) : **n° 2**, faire annoncer par « Aujourd'hui » les arrosages de
demain et le manque d'eau de la semaine. Recommandation : oui.
**Aucune question agronomique** dans ce lot ; l'agronomie n'y est touchée que
si la cause de R2 est dans la définition de l'objectif adopté, auquel cas le
point revient à François avant le code.

## 8 bis. Ce que la PR 1 (R1) a tranché en codant

Même consigne : l'option recommandée, aucune question agronomique (D-138).

| N° | Précision | Choix codé |
| --- | --- | --- |
| F274 | Le lien de demain | « Voir au planning » mène à la **première proposition à valider de demain** (`planning#proposal-…`), comme les lignes du jour : le planning n'a pas d'ancre par jour, et la carte est dans le jour. La ligne « Demain à 6 h : 3 arrosages à valider » se lit au pied de « Votre journée » ; « À faire aujourd'hui » ne compte jamais demain |
| F275 | Fenêtre de « demain » | les 24 heures qui suivent la fin du jour, c'est-à-dire le jour civil suivant à la ferme, **de 0 h à minuit** : un créneau de 0 h 30 compte pour demain. Seules les propositions encore « à valider » (ni décidées ni expirées) comptent. L'heure est dite quand toutes commencent à la même (« à 6 h »), sinon « dès » la première |
| F276 | L'eau qui manque | `shortageAction` du planning, appelée telle quelle avec la règle d'affichage des volumes du lot E : la phrase d'« Aujourd'hui » est celle du planning, mot pour mot, dans un encadré de l'en-tête ; le lien « Répartir l'eau » ou « Revoir la répartition » est le même, présent seulement quand la faisabilité est active (« Ressources » et « Objectifs et besoins » cochés) |
| F277 | Pastilles | « L'eau manque », orange, en tête, tant que `shortageDecisionPending` ; « n à valider demain » après celles du jour ; « Rien à arroser » ne s'affiche plus quand demain ou la semaine ont quelque chose à dire, une répartition validée comprise |
| F278 | La phrase de résumé | l'ordre : le jour (retards, à faire), **demain** (« 3 arrosages sont à valider demain à 6 h. »), la météo, la fiabilité. « Rien d'urgent aujourd'hui. » ne s'écrit que si ni le jour, ni demain, ni la semaine n'ont rien à dire. Le manque d'eau n'y est pas redit : l'encadré, au-dessus, le dit avec la phrase du planning. Sans rien d'autre que le manque, la phrase se réduit à la phrase calme de la météo, ou disparaît |
| F279 | Bassin sous son minimum | le minimum de sécurité de la réserve, déjà saisi, se lit : le point reste dans le lot. Un volume connu **strictement** sous le minimum dessine la cuve en orange et ajoute « sous son minimum de 2 m³ », à l'écran et dans la phrase du lecteur d'écran ; au minimum, au-dessus, avec un minimum nul ou un volume inconnu, rien (D-003) |

**Limite connue** : le plan lu est celui de la semaine en cours (du lundi au
dimanche, D-004). Le dimanche, le plan de la semaine suivante n'existe pas
encore (il se calcule le lundi matin) : rien n'est annoncé pour lundi.

## 8 ter. Ce que la PR 2 (R2) a tranché en codant

**Cause établie dans le code, au point d'arrêt** : chaque page lit le même
objectif, celui que `objectiveForBed` (`lib/domain/irrigation-needs.ts`)
calcule pour le besoin, le planning, la faisabilité et la fiche de la
culture. Le calcul de l'objectif n'est pas en cause ; le point d'arrêt ne
s'applique pas, et rien d'agronomique ne change. Les écarts viennent de
l'affichage : un total de jardin, de ferme ou de semaine devient inconnu dès
qu'**une seule** planche n'a pas d'objectif adopté (règle D-003, juste, mais
muette sur sa raison), et la fiche de la planche nommait « applicable » ce
que le reste du module appelle adopter. L'objectif **proposé**, calculé
d'après la culture, n'entre dans le besoin que si on l'adopte (D-045) : la
fiche montrait donc bien deux objets différents, sans le dire.

Même consigne : l'option recommandée, aucune question agronomique (D-139).

| N° | Précision | Choix codé |
| --- | --- | --- |
| F280 | Objectif partiel sur « Aujourd'hui » | quand une partie seulement des planches a un objectif, l'objectif, l'eau reçue et le reste à apporter se chiffrent **sur ces planches seulement**, et le disent : la ligne « 12 / 25 mm sur 7 planches sur 10 », la tuile « objectifs posés sur 7 planches sur 10 », le détail « sur ces 7 planches » ; sans aucun objectif, « aucun objectif posé » (et plus « non fixé ») ; avec tous, rien ne change. Jamais un total qui mêle du connu et de l'inconnu (D-003) |
| F281 | Objectif adopté / proposé | « Objectif adopté » partout où l'objectif qui s'applique apparaît (fiche de la planche, fiche de la série, « Objectifs et besoins », planning) ; « Objectif proposé » pour celui que calcule la culture ; sur la fiche, un ⓘ dit la différence en une phrase : « L'objectif adopté est celui que le besoin et le planning appliquent ; l'objectif proposé, calculé d'après la culture, ne s'applique que si vous l'adoptez. » |
| F282 | « Non calculable » | dit pourquoi avec ce que le domaine sait déjà : le total d'un jardin, « Non calculable (2 planches sur 3 sans objectif adopté) » ; une planche, « Non calculable : aucun objectif adopté. » sous ses chiffres ; sur « Ressources », « Besoin de la semaine » se lit « au moins 3,4 m³ », avec « non chiffré pour 2 planches sans objectif adopté » (ou « sans surface mouillée connue ») au lieu de « Non calculable » muet, et « Part servie » dit que le besoin n'est pas chiffré en entier |

C'est aussi la cause du « Non calculable » de « Besoin de la semaine » sur
« Ressources » quand le planning annonce un manque : le manque se calcule sur
les planches chiffrées, le total de la semaine attendait toutes les planches.

## 8 quater. Ce que la PR 3 (J14) a tranché en codant

Même consigne : l'option recommandée, aucune question agronomique (D-140).

| N° | Précision | Choix codé |
| --- | --- | --- |
| F283 | Gel sans alerte | quand « Alertes météo » est coché, qu'une minimale prévue des trois jours est à 0 °C ou moins (le flocon de la carte), qu'aucune alerte active ne porte sur la minimale vers le bas et que le gel des cultures n'a rien annoncé : « −2,4 °C annoncé le mer. 18 nov. et aucune alerte de gel posée. », la plus froide des trois, en ambre sous les lignes du bloc, toujours visible ; la phrase calme se tait à côté ; la pastille de l'en-tête dit « Gel sans alerte posée » (au lieu de « Rien d'annoncé sur trois jours ») et la phrase de résumé la reprend. Une alerte de gel posée mais désactivée : « … et votre alerte de gel est désactivée. », lien « Voir les alertes météo ». Une minimale inconnue ne dit rien (D-003). Le seuil de gel de chaque culture reste dit par « Alertes cultures », comme avant |
| F284 | Geste | le lien « Poser « Gel : moins de 3 °C » » ouvre « Alertes météo » à l'ancre `#modele-gel` : le formulaire « Nouvelle alerte météo » s'ouvre, rempli du modèle de gel, modifiable, et rien ne s'enregistre sans « Enregistrer l'alerte » (D-028) ; même quand la ferme a déjà d'autres alertes (les modèles de l'écran vide ne paraissent qu'à zéro alerte). Le ton du bloc, les seuils, les alertes et leurs envois ne changent pas |

## 9. Ce que le lot ne prouve pas

Un vrai téléphone en main à 6 h du matin ; la lecture par un lecteur d'écran ;
la ferme réelle (aucune séance Chrome sans le « vas-y » de François) ; la
lecture des trois pages sur la ferme vitrine elle-même (la cause des « Non
calculable » est établie dans le code, section 8 ter) ; la phrase du gel sans
alerte posée sur une vraie prévision sous 0 °C (la prévision des parcours
n'y descend pas : le domaine la prouve, P29 prouve le lien vers le modèle).
