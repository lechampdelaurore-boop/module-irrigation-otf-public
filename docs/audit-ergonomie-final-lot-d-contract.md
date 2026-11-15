# Contrat court — audit ergonomique final, lot D : pages allégées (24 terdecies)

Écrit le 15 novembre 2026 en Sonnet 5.5 · Moyen, sans code, sans PR,
d'après `docs/ROADMAP.md` (ligne 24 terdecies) et le rapport
`audit-ergonomie-final-2026-11-14.md` (points **J2, J3, J4, J5, J6**, D-117).
Les causes ont été **lues dans le dépôt** (`main` à #67) ; ce qui reste à
confirmer est dit « à confirmer ».

**Choix n° 3 : oui (D-137). J4 : « renseigner la RFU d'abord » retenu
(recommandation, question 1 sur 3 des contrats posée au porteur le
15 novembre 2026).** Rappel de ce qui était en attente :

- **J2** (un pli « Réglages de cette page ») change l'organisation de pages
  déjà validées : **choix n° 3** du rapport, qui lui revient.
- **J4** (« Réserve du sol ») touche la réserve du sol (D-041, D-047, D-053).
  La ligne 24 terdecies veut que le coordinateur soit prévenu **avant tout
  contrat** : c'est fait par ce brouillon, qui range J4 à part (section 6) et
  pose une **question agronomique réservée au porteur**, sans la trancher (tranchée depuis, section 6).
- **J3, J5, J6** n'ont besoin de personne : ils suivent l'option recommandée.

**Accord du porteur (15 novembre 2026, 14 h 51, heure de Paris)** : « Je
suis d'accord avec toutes tes propositions. Toutes les recommandations. »
(D-137), en réponse aux questions des contrats, dont celle de J4. Toutes les
recommandations de ce contrat sont retenues, y compris « RFU d'abord » pour
J4, et le code a son « vas-y ». Ajouts du jour acceptés par lui : M1
(15 h 50, « 1 oui ») et N1 (17 h 35, « oui »). Versé au dépôt par la PR 1
du lot, en Opus 5.5 · Élevé (la ligne 24 terdecies), les numéros recalés sur
le dépôt.

Affichage seul : aucun calcul de besoin, d'ETM, de Kc, de réserve ni de
planning ne change ; aucune donnée, aucune migration. Logiciel multi-fermes :
les règles visent une page, jamais une ferme.

Registres (recalés sur le dépôt : le lot F en occupe jusqu'à D-145 et F296) :
décisions **D-146 à D-152** (une par PR), précisions **F297 à F316** ;
parcours P10, P18, P19, P20, P31 et P32 étendus selon la page.

## 1. Livraison en sept PR, une à la fois, dans cet ordre

| PR | Point | Fichiers principaux | Attend |
| --- | --- | --- | --- |
| 1 · Mots simples au planning | J6 | `app/irrigation/planning/planning-settings-form.tsx`, `lib/domain/planning/setting-codes.ts` | personne |
| 2 · Objectifs et besoins plus courts | J3 | `app/irrigation/irrigation-needs-dashboard.tsx` | personne |
| 3 · Vos cultures d'abord | J5 | `app/irrigation/cultures/page.tsx`, `crop-water/crop-coefficients-panel.tsx`, `reference-crop-card.tsx` | personne |
| 4 · Un pli « Réglages de cette page » | J2 | `weekly-plan-view.tsx`, `irrigation-needs-dashboard.tsx`, `water-resource-manager.tsx`, `crop-water/bed-crop-water-panel.tsx` | choix n° 3 (oui) |
| 5 · Réserve du sol | J4 | `soil-reserve/soil-gauge.tsx`, `lib/domain/soil-reserve/gauge-view.ts`, `lib/domain/today/reliability.ts` | question agronomique (RFU d'abord) |
| 6 · Cases de planche de « Matériel » | M1 (ajout du 15/11) | `app/irrigation/equipment-placement*.tsx`, `equipment-pose.tsx`, feuille de « Matériel » | accepté le 15/11 |
| 7 · « Non calculable » dit pourquoi, sur « Ressources » | N1 (ajout du 15/11) | `app/irrigation/irrigation-feasibility-dashboard.tsx` (`volume`, `mm`, `percent`), `lib/domain/irrigation-feasibility.ts` | accepté le 15/11 |

Chaque PR :
`lint`, `typecheck`, `test`, `build`, `knip`, `push:check`, `weather:check`
et `e2e` collés ; registres dans la même PR ; la première verse ce contrat.

## 2. Ce qui ne change pas

Tous les calculs et leurs nombres ; les gestes et ce qu'ils font ; les
fenêtres de confirmation ; la page « Aujourd'hui » (lot A) ; les arrondis, mots
et volumes du lot E (m³ à deux décimales, litres sous 1 m³, mm à une décimale) ;
la démonstration (lot F). Ce qui est déplacé dans un pli n'est ni retiré ni
désactivé : un lecteur d'écran et la recherche du navigateur le retrouvent
(un `details` ouvert par l'ancre ou le clavier).

## 3. J6 — Les codes R2 à R14 quittent les libellés visibles

**Cause établie dans le code.** `planning-settings-form.tsx` (lignes 86 à 141)
écrit « R2 · … » à « R14 · … » dans chaque libellé. Le pli `<details
className="planning-settings">` existe déjà : seul le mot change.

1. **Le code n'est plus dans le libellé visible** ; il reste dans une bulle
   d'aide pour les experts, sous la forme « Réglage R13 » (F297).
2. Les `aria-label` gardent leur code **dans le nom de l'élément**, car des
   parcours en dépendent (« R4 dose minimale … »). À confirmer : si l'on veut
   les retirer du nom accessible, les parcours qui les nomment (P10, P31) sont
   relus dans la même PR.
3. Les libellés restent ceux du rapport : une phrase simple (« Part de la
   pluie prévue déduite du besoin (%) ») ; la ligne grise de résumé du planning
   (« pluie prévue déduite à 100 %, attendue au-dessus de 5 mm … ») reste, le
   rapport la juge dense mais utile.

## 3 bis. Ce que le code a établi pour J6 (PR 1, D-146)

- Le formulaire n'avait pas de bulle d'aide, et un bouton placé dans un
  `label` deviendrait le champ que ce libellé désigne. La bulle se pose donc
  dans la **légende de chaque groupe** (« Pluie prévue », « Aspersion »,
  « Goutte-à-goutte », « Pénurie… », « Portée du matériel », « Suivi des
  arrosages ») : c'est la bulle « d'où vient ce chiffre » du module, nommée
  ici « Numéros des réglages », qui dit « Pour les experts : Réglage R2,
  part de la pluie prévue déduite du besoin ; Réglage R3, … » (F297). Les
  numéros vivent dans `lib/domain/planning/setting-codes.ts`.
- Les noms des champs par nature de matériel gardent leur numéro
  (« R8 début de plage Goutte-à-goutte ») : des parcours les nomment, et un
  lecteur d'écran l'annonce sans l'afficher (point 2).
- Un réglage refusé se nomme en mots simples, comme son libellé
  (« Tolérance du retard : … » au lieu de « R14, tolérance du retard : … »)
  (F298).

## 4. J3 — « Objectifs et besoins » : sept cartes de jour presque vides

**Cause établie dans le rapport (mesure) ; à confirmer en lisant le
composant.** Sept cartes de sept lignes (irrigation réalisée, planifiée,
pluie, prévision, températures, ET0, limite), environ 2 000 px au téléphone,
surtout des « 0,00 m³ » et des « — ».

1. **Une ligne par jour**, sous la forme d'un tableau compact (une cellule par
   grandeur) à l'ordinateur ; **au téléphone, les jours repliés** comme au
   planning (un jour = une ligne, le détail dessous), le jour courant ouvert
   (F299).
2. La tuile **« ETO »** (écrite avec un O) devient **« Évaporation du jour
   (ET0) »** ; « Non disponible · partielle » cesse de s'afficher en très gros
   sur trois lignes (taille du texte courant, une seule ligne) (F300).
3. Les lignes dont toutes les grandeurs sont vides ne sont pas masquées (règle
   D-003 : une donnée inconnue ne devient pas « rien ») ; elles se rangent en
   une phrase « 3 jours sans irrigation ni pluie mesurée » (F301).

## 4 bis. Ce que le code a établi pour J3 (PR 2, D-147)

- Les « sept cartes » sont le tableau des jours de la semaine
  (`water-management-dashboard.tsx`, `#weather`), qu'au téléphone la feuille
  de style mettait en cartes de huit lignes. À l'ordinateur, c'est déjà un
  tableau d'une ligne par jour : il ne change pas (F299).
- Au téléphone, chaque jour tient en une ligne : un bouton de 44 px qui dit
  la date et ce qui s'y est passé (« 2,31 m³ arrosés · pluie 4,3 mm »,
  « sans irrigation ni pluie mesurée · 6 mm de pluie prévus », « limite
  dépassée ») ; il ouvre le détail dessous. Le jour courant est ouvert (F299).
  Les cellules repliées restent dans la page (recherche, lecteur d'écran).
- Au-dessus du tableau, une phrase compte les jours sans irrigation ni pluie
  (« 3 jours sans irrigation ni pluie mesurée ») ; une pluie inconnue n'est
  pas comptée comme une pluie, et aucun jour n'est masqué (F301, D-003). La
  règle vit dans `lib/domain/water-week-days.ts`.
- La tuile « ET0 » est le total de la semaine, pas du jour : elle s'appelle
  « Évaporation de la semaine (ET0) ». Une tuile sans chiffre
  (« non disponible · partielle », « Non défini ») s'écrit à la taille du
  texte courant (F300).

## 5. J5 et J2

**J5 — « Besoin par culture » liste 40 cultures.** Cause : chaque culture de
référence est une carte complète (« Kc de 0,50 à 0,90 · racines jusqu'à
0,60 m · … »), cultivée ou non (1 078 éléments cliquables, 143 cibles de moins
de 44 px au téléphone, 124 803 px tout déplié, selon le rapport).

1. **« Vos cultures cette saison (8) »** en tête, ouvertes comme aujourd'hui ;
   **« Les autres cultures de référence (32) »** dans un pli fermé (F302).
2. **Kc et profondeur de racines** passent dans « Pour les experts » (le pli
   `experts-fold.tsx` existe déjà ; le point 8 du premier audit n'était fait
   qu'à moitié). La formule « ETM × √(1 − taux) » quitte les options visibles
   (reste dans l'aide) (F303).
3. Les cibles de moins de 44 px de cette page sont corrigées ici (elles
   relèvent du point A2 du lot E, qui ne les traite pas toutes : à confirmer
   au contrat de A2 pour éviter un doublon) (F304).

**Ce que le code a établi pour J5 (PR 3, D-148).**

- Une culture « de la saison » est une culture de référence à laquelle au
  moins une série posée de la saison se rattache, par son espèce ou par une
  exception : le même compte que « 3 séries de la saison » du résumé. Les
  deux groupes gardent l'ordre de la liste. Sans aucune culture de la
  saison, le pli des autres s'ouvre et une phrase renvoie au rattachement
  dans Réglages : la page n'est jamais vide (F302).
- La carte fermée ne dit plus que ses séries (« 2 séries de la saison ») ;
  « Kc de 0,40 à 1,05 · racines jusqu'à 0,40 m » passe en tête de son
  « Pour les experts ». Ce résumé avait été choisi par le porteur le
  8 novembre 2026 ; J5, qu'il a retenu le 15 novembre 2026, le remplace
  (F303). L'ombrage dit « 13 % de moins pour un filet de 25 % » ; sa formule,
  K_ombrage = √(1 − taux du filet), est dans « Pour les experts » des
  options (F303).
- Les cibles : mesurées par P31c à 390 px sur toute la page, plis ouverts,
  depuis le lot E (A2, F273), aucune sous 44 px ; les « 143 » du rapport
  comptaient la case et non son étiquette (contrat du lot E, section 9).
  Le nouveau pli fait 44 px (F304).

**J2 — un pli « Réglages de cette page », fermé, en bas** (choix n° 3 :
oui). Pages concernées, d'après le rapport et la lecture du code :

| Page | Ce qui part dans le pli | Reste dans la page |
| --- | --- | --- |
| Arrosages | limite journalière et ses dates | la liste, le formulaire |
| Objectifs et besoins | seuil minimal de planification | les objectifs, les besoins |
| Ressources et pompes | liaisons, alimentation par défaut, pompes, pompe habituelle de chaque matériel | l'écran de répartition (en tête depuis le lot B), la projection |
| Matériel | le bloc « Besoin de la culture » (ETM, ET0, Kc, « Adopter la proposition ») | l'inventaire, le placement |

1. Le pli s'appelle **« Réglages de cette page »**, fermé, en bas, **sauf** si
   l'on arrive par une ancre ou un lien qui le désigne, ou si un réglage est
   incomplet et bloque le calcul (alors il s'ouvre et le dit) (F305).
2. Le bloc « Besoin de la culture » de « Matériel » **renvoie à « Objectifs et
   besoins »** au lieu de répéter ETM, ET0 et Kc (le rapport, J2) ; l'objectif
   adopté reste modifiable là où il l'est aujourd'hui (F306).
3. **Rien ne disparaît** : chaque réglage reste à une adresse et une ancre
   stables (les liens des lots A et B ne se brisent pas) (F307).

**Ce que le code a établi pour J2 (PR 4, D-149).**

- Un composant, `app/irrigation/shell/page-settings-fold.tsx` : le pli
  s'appelle « Réglages de cette page », fermé, sous-titré « Ce qui se règle
  une fois pour toutes ». Son ancre est la même partout,
  `#reglages-de-la-page` ; elle l'ouvre, comme l'ancre de tout élément qu'il
  contient, au chargement comme à un lien suivi dans la page (F305, F307).
  Rien n'y est retiré ni désactivé, et la recherche du navigateur ouvre un
  pli fermé.
- Arrosages : la limite journalière et ses dates. Objectifs et besoins : le
  seuil minimal de planification (le tri des planches reste en haut).
  Ressources et pompes : les liaisons, l'alimentation par défaut, les
  pompes et la pompe habituelle de chaque matériel ; la faisabilité passe
  avant le pli, et reste en tête quand une répartition attend (lot B). Le
  pli est en bas de chaque page.
- Matériel : la fiche « Besoin de la culture » de la planche choisie (stade,
  semaine, « Déclarer un stade », « Adopter la proposition ») va dans le pli,
  sans rien changer de ce qu'elle fait : l'objectif adopté reste modifiable
  là où il l'était. Sous la planche, une phrase renvoie à « Objectifs et
  besoins » pour le besoin, et au pli pour le stade et l'adoption ; l'ETM,
  l'ET0 et le Kc ne s'affichent plus d'office sur « Matériel » (F306).
- Un réglage incomplet qui bloquerait un calcul ouvrirait le pli en le
  disant (`openReason`) : **aucun cas n'a été trouvé** dans ces quatre pages.
  La limite, le seuil, les pompes et la pompe habituelle sont facultatifs ou
  ont leur valeur de départ, et la faisabilité nomme elle-même une chaîne
  sans origine d'eau ni pompe (D-088). L'ouverture d'office n'est donc
  employée nulle part.
- Les ancres des lots A et B (`#repartition`, `#manual-rain`, les
  réserves) sont hors du pli : elles ne changent pas (F307).

## 5 bis. M1 — Les cases de planche de « Matériel » assez grandes à toucher (ajout du 15 novembre 2026)

**Origine.** Constat de la recette du lot E (`recettes/constats-lot-e.md`) :
sur « Matériel » à 390 px, les cases de planche (« B1-0 »…) font **23 px de
large**, hors de la cible habituelle. Le contrat A2 du lot E ne les couvre
pas. **Le porteur a accepté de les ajouter à ce lot** (15 novembre 2026, 15 h 50,
« 1 oui »).

1. **La cible habituelle du module** : toute zone à toucher fait **44 px au
   moins, en hauteur et en largeur**, au téléphone (la même règle que A2 et que
   les boutons du module). Les cases de planche de « Matériel » la respectent
   à 390 et 360 px (F313).
2. **Sans changer la disposition** : le dessin de la case peut rester petit si
   sa **zone tactile** grandit (marge intérieure ou zone invisible), en
   gardant un écart entre deux cases pour ne pas en toucher deux ; si 44 px
   ne tiennent pas sur une ligne, les cases passent à la ligne (F314).
3. Le **nom accessible** (« B1-0 ») et ce que fait la case ne changent pas.
4. À confirmer en lisant le composant : si les cases sont des `<input
   type="checkbox">`, la zone se fait par le `<label>`.

**Ce que le code a établi (PR 6, D-151).** Les cases sont des `<button
class="plan-bed">` dans une grille, `.bed-strip`, qui au téléphone prenait
`repeat(auto-fit, minmax(22px, 1fr))` (`styles/responsive.css`) : 33 planches
y tenaient sur une ligne, à 23 px. La règle passe à `minmax(var(--touch-target),
1fr)` avec 4 px d'écart, dans `styles/pages-allegees.css` : la case grandit
elle-même, aucune zone invisible n'est nécessaire. P31c le mesure à 390 et
360 px, sur la démonstration et sur un jardin d'essai de 33 cases posé pour
la mesure puis retiré.

## 5 ter. N1 — « Part servie » et « Couverture confirmée » disent pourquoi (ajout du 15 novembre 2026)

**Origine.** Recette du lot A (`recettes/constats-lot-a.md`, ligne R2) :
sur « Ressources », « Part servie » et « Couverture confirmée » restent des
« Non calculable » nus, alors que « Besoin de la semaine » dit sa raison
depuis #72. **Le porteur a accepté de les ajouter à ce lot** (15 novembre 2026,
17 h 35, « oui »).

**Cause lue dans le code.** `irrigation-feasibility-dashboard.tsx` écrit
`value === null ? 'Non calculable'` dans ses trois aides (`volume`, `mm`,
`percent`, lignes 18 à 20) : le texte ne porte jamais la raison.

1. Chaque « Non calculable » de la faisabilité est suivi **d'une ligne de
   raison**, la même façon que « Besoin de la semaine » (#72) : « aucun
   objectif adopté », « pluie réelle manquante », « réserve non renseignée »,
   etc., **seulement si le domaine connaît déjà la raison** ; sinon la
   raison générale « une donnée manque : voir Fiabilité du calcul » (F315).
2. **Aucun calcul ne change** ; la raison est celle que le domaine expose déjà
   (à confirmer dans `lib/domain/irrigation-feasibility.ts` ; s'il faut
   l'exposer, on la lit, on n'en crée pas de règle).
3. Même mot et même forme sur tous les « Non calculable » de la page, y
   compris « Part servie » et « Couverture confirmée » (F316).

**Ce que le code a établi (PR 7, D-152).** Le calcul expose déjà ses
raisons : le statut « unknown » et l'objectif de chaque planche (F282),
la surface mouillée, et le volume ou la prévision `null` de chaque
ressource. `lib/domain/feasibility-unknown.ts` les met en mots, sans rien
recalculer. Deux formes seulement : la ligne « Non calculable : raison. »,
celle d'« Objectifs et besoins », sous une planche ; entre parenthèses dans
une phrase (« Couverture confirmée : Non calculable (…) »). Une tuile garde
sa valeur « Non calculable » et met la raison dans sa ligne du dessous,
comme « Besoin de la semaine ». La phrase « le besoin de la semaine n'est pas
chiffré en entier » de « Part servie » laisse place à la raison chiffrée.

## 6. J4 — « Réserve du sol » : la cause, et le bon premier geste (question agronomique, tranchée par le porteur)

**Ce que le code dit déjà** (lu, pas supposé) :

- `lib/domain/soil-reserve/gauge-view.ts`, ligne 175 : la raison « no-soil »
  s'écrit **« Inconnue : aucune RFU saisie pour sa parcelle. »** Elle est
  distincte de « not-started » (« pas encore de départ. Réglez le curseur sur
  ce que vous observez… »).
- `lib/domain/today/reliability.ts`, ligne 150 : la fiabilité propose
  **« Observer le sol de … »** pour un jardin jamais observé, **sans regarder
  si la parcelle a une RFU**.
- `soil-gauge.tsx` : le bouton « Observer » apparaît sur toute ligne
  « inconnue ».

**Ce que cela laisse penser** (à confirmer par un test sur le domaine) :
quand la raison est « no-soil », la capacité du plein ne se calcule pas
(la RFU est une donnée de la parcelle, D-041/D-046), donc **une observation ne
peut pas remplir une jauge sans RFU** ; le geste juste est « Renseigner la
réserve de la parcelle ». Sur la démo (0 parcelle sur 3 renseignée, rapport),
les trois boutons « Observer » ne mènent à rien de visible.

**Question réservée au porteur** (agronomie, donc pas l'option recommandée
par défaut) : *« Quand la réserve utile (RFU) d'une parcelle n'est pas
renseignée, une observation du sol suffit-elle à faire vivre la jauge, ou
faut-il d'abord renseigner la RFU ? »* Recommandation : **renseigner la RFU
d'abord**, car la capacité d'une planche vaut la RFU par la profondeur
racinaire (D-041, D-046, D-053) ; une observation sans capacité n'a pas de
sens. **Réponse du porteur le 15 novembre 2026 : la recommandation, « RFU
d'abord »** (accord de 14 h 51).

Donc (F308 à F312, D-150) :

1. Sur une ligne « inconnue » pour cause « no-soil », le bouton est
   **« Renseigner la réserve de la parcelle »** (il ouvre « Réglages du sol ») ;
   « Observer » n'y est plus proposé (F308).
2. La fiabilité d'« Aujourd'hui » n'offre « Observer le sol de … » que pour un
   jardin dont la parcelle a une RFU ; sinon : « Renseigner la réserve de la
   parcelle … » (F309).
3. **Les lignes identiques** (six cases « inconnue · prévu » par planche, 18 383
   px tout déplié) se rangent en une phrase par jardin (« 12 planches :
   inconnue, aucune RFU saisie »), deuxième moitié du point 13 du premier
   audit, qui n'est pas faite (F310).
4. Le formulaire d'observation n'est plus ouvert d'office **et** suivi de
   « Observer » pour le même jardin : un seul des deux (F311).
5. « RFU » s'écrit « réserve utile (RFU) » à sa première occurrence de la page
   (F312).

Le graphique des réserves (S2) n'est pas touché ; son essai avec de vraies
valeurs et à 190 planches reste **non vérifié** (rapport, section 8).

## 6 bis. Ce que le code a établi pour J4 (PR 5, D-150)

- **Le test du domaine est écrit** (`tests/soil-reserve-without-rfu.test.ts`) :
  sans RFU, `bedSoilReserve` rend chaque jour inconnu pour la raison
  « no-soil », état et capacité à `null`, même avec deux observations ; la
  même observation, la RFU saisie, fait partir la jauge. L'intuition de la
  section 6 est donc confirmée par le code.
- **« Sans RFU »** se lit sur la jauge déjà calculée : toutes les planches du
  jardin sont inconnues pour « no-soil » (`plotWithoutSoil`). La RFU vaut
  pour une parcelle ou un jardin, jamais pour une planche seule.
- **Le bouton** « Renseigner la réserve de la parcelle » se place sous la
  ligne du jardin, pas à droite de son titre comme « Observer » : il est
  trop long pour tenir à côté au téléphone. Il ouvre « Réglages du sol » et
  le pli « Enregistrer le sol de la parcelle », et met le curseur dans la RFU
  du laboratoire. La même adresse, `#soil-parcel-<parcelle>`, sert au lien
  d'« Aujourd'hui ».
- **« Observer la parcelle »** cède aussi la place à la phrase et au bouton
  quand aucun jardin de plein champ de la parcelle n'a de RFU : il ne
  réglerait que ces jardins.
- **« Fiabilité du calcul »** compte un jardin sans RFU même s'il a été
  observé, puisque l'observation n'y a rien rempli ; sa pastille dit par
  exemple « 1 jardin jamais observé · 2 parcelles sans RFU ».
- **F311** : la ligne d'un jardin montre « Observer » tant qu'il est replié ;
  ouvert, son formulaire seul. Un jardin sans RFU n'a plus de formulaire
  d'observation, mais une phrase qui dit pourquoi.
- **Les parcours** : P31b porte le cas 7 et le cas 8 sur sa ferme neuve, puis
  saisit la RFU par le bouton ; l'abri, dont les planches sont sans culture,
  ne porte alors plus aucun geste. P29 suit le lien de la fiabilité jusqu'au
  formulaire de la parcelle. P33 lit la phrase dans le pli de Tunnel 1, puis,
  la RFU de « Sous le verger » saisie, voit « Observer » sur le jardin
  cultivé replié et son seul formulaire une fois ouvert (F311). P18 et P19
  n'avaient rien à changer : ils saisissent la RFU avant d'observer.

## 7. Cas chiffrés

| Cas | Entrée | Attendu |
| --- | --- | --- |
| 1 | Planning, réglages R2 à R14 | aucun libellé visible ne commence par « Rn · » ; la bulle d'aide dit « Réglage Rn » |
| 2 | Objectifs et besoins à 390 px | les jours repliés, la page sous 3 500 px (à mesurer, était 5 950) |
| 3 | La tuile d'évaporation | « Évaporation de la semaine (ET0) », jamais « ETO » |
| 4 | Besoin par culture, ferme à 8 cultures | « Vos cultures cette saison (8) » ouvert ; le pli « Les autres cultures de référence (32) » fermé |
| 5 | Les quatre pages de J2 | un pli « Réglages de cette page », fermé ; ouvert par ancre ; un réglage incomplet l'ouvre |
| 6 | Matériel, « Besoin de la culture » | renvoie à « Objectifs et besoins » ; plus d'ETM, ET0, Kc répétés |
| 7 | Sol, parcelle sans RFU | « Renseigner la réserve de la parcelle », pas « Observer » |
| 8 | Sol, 12 planches de même état | une phrase par jardin, les lignes dans un pli |
| 10 | Ressources, « Part servie » sans besoin chiffré | « Non calculable » suivi de sa raison, comme « Besoin de la semaine » |
| 9 | Matériel à 390 et 360 px | chaque case de planche : zone à toucher de 44 × 44 px au moins, deux cases ne se chevauchent pas |

## 8. Précisions proposées (non agronomiques, option recommandée)

| N° | Précision | Choix recommandé |
| --- | --- | --- |
| F297 | Codes R | retirés des libellés, gardés dans la bulle d'aide et le nom accessible |
| F298 | Refus d'un réglage | nommé en mots simples, sans son numéro |
| F299 | Jours d'« Objectifs et besoins » | une ligne par jour, repliés au téléphone |
| F300 | Tuile ETO | « Évaporation de la semaine (ET0) » (c'est le total de la semaine) ; une tuile sans chiffre au texte courant |
| F301 | Jours sans donnée | rangés en une phrase, jamais masqués |
| F302 | Cultures | « Vos cultures cette saison » d'abord, les autres repliées |
| F303 | Kc, racines | « Pour les experts » |
| F304 | Cibles de « Besoin par culture » | 44 px au moins |
| F305 | Pli de réglages | fermé, en bas, ouvert par ancre ou réglage incomplet |
| F306 | « Besoin de la culture » de « Matériel » | renvoie à « Objectifs et besoins » |
| F307 | Ancres | inchangées, les liens des autres lots tiennent |
| F308 à F312 | Réserve du sol sans RFU | « Renseigner la réserve de la parcelle » d'abord (agronomie, tranché par le porteur) |
| F313 | Cases de planche de « Matériel » | zone à toucher de 44 px, dessin libre |
| F314 | Disposition des cases | dessin libre, passage à la ligne s'il le faut |
| F315 | « Non calculable » sur « Ressources » | toujours suivi de sa raison |
| F316 | Forme de la raison | la même sur toute la page |

**Questions au porteur** : le choix n° 3 du rapport (oui) et la question
agronomique de J4 (« RFU d'abord ») sont tranchés par son accord du
15 novembre 2026 (D-137).

## 9. Ce que le lot ne prouve pas

La jauge à 190 planches et avec de vraies valeurs ; un lecteur d'écran sur les
plis ; la ferme réelle ; la cause exacte de « no-soil » sur la ferme du porteur
(sa RFU de 62 mm/m est déjà saisie, rapport 5 ter : le cas se voit seulement sur
une ferme neuve ou sur la démonstration).
