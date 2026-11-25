# Contrat court — le tableau de bord « Aujourd'hui » mène aux menus (6 nonies)

Écrit le 24 novembre 2026, sans code, sur la demande du porteur du jour
(13 h 24, heure de Paris) : « quand je clique dessus, il n'y a pas de lien.
Il serait logique de cliquer dessus pour que ça nous emmène à modifier les
objectifs de la semaine […]. Idem pour l'eau reçue […] on pourrait par
exemple ajouter une pluie qu'on aurait mesurée réellement. […] je voudrais
que tu vérifies aussi l'onglet aujourd'hui en entier d'un point de vue
ergonomique. »

Diagnostic et contrat écrits en Fable 5.2 · Élevé, **par exception expresse
du porteur pour ce seul fil** ; D-055 reste la règle, et le code se fait
dans un autre fil, jamais en Fable.

Les causes ci-dessous ont été **lues dans le dépôt** (`main` à #189) et les
mesures prises sur la démonstration locale, à 1440 px et à 390 et 360 px,
sur trois fermes de démonstration (maraîchage, petite ferme, matériel et
alertes) et quatre moments. Ce qui reste à confirmer en codant est dit « à
confirmer ». Le diagnostic complet et ses captures :
`/mnt/project-files/aujourdhui-liens/diagnostic-aujourdhui-2026-11-24.md`.

Affichage seul : aucun calcul de besoin, de pénurie, de plan ni de gel ne
change ; aucune donnée, aucune migration, aucune lecture nouvelle. Logiciel
multi-fermes : un lien n'existe que si la page qu'il vise est cochée dans
la ferme, et ne suppose jamais la ferme du porteur.

L'objectif qui suit l'ET0, demandé le même jour, est un chantier à part :
`docs/objectif-automatique-contract.md` (6 decies).

Registres : décision **D-308** pour ce contrat ; une décision par PR de
code, à partir du premier numéro libre ; précisions **F** à partir du
premier numéro libre ; parcours P29, P30 et P38 (« Aujourd'hui ») étendus.

## 1. Livraison en six PR, une à la fois

| PR | Point | Fichiers principaux | Preuve |
| --- | --- | --- | --- |
| L1 · Les tuiles mènent à leur menu | 3 | `lib/domain/today/week.ts`, `app/irrigation/today/today-week.tsx`, `styles/today.css` | tests du domaine ; P29 et P30 aux deux largeurs |
| L2 · Les jauges mènent à leur page | 4 | `app/irrigation/today/today-gauges.tsx`, `lib/domain/today/week.ts`, `soil.ts`, `water.ts`, `app/irrigation/irrigation-needs-dashboard.tsx` (l'ancre du jardin), `styles/today.css` | tests du domaine ; P30 aux deux largeurs |
| L3 · Les autres liens de la page | 5 | `today-day.tsx`, `today-weather.tsx`, `reliability-zone.tsx`, `today-header.tsx`, leurs modèles de `lib/domain/today/` | tests du domaine ; P29 |
| L4 · La réponse sous le bouton | 6 | `today-page.tsx`, `today-day.tsx`, `today-header.tsx`, `reliability-zone.tsx`, `shell/action-reply.tsx` (lu, pas changé) | P29 à 390 px : la réponse est dans l'écran |
| L5 · La mise en page | 7 | `styles/today.css`, `styles/today-day.css` | P29 et P30 à 1440, 390 et 360 px, par mesures |
| L6 · Le téléphone commence par la journée | 8 | `today-page.tsx`, `styles/today.css`, `docs/aujourdhui-tableau-de-bord-contract.md` (T5) | P29 à 390 px |

Code : Opus 5.5 · Élevé, comme les lots de l'audit ergonomique (affichage
seul) ; le coordinateur tranche à la lecture de la ligne de la roadmap.
Chaque PR met à jour `docs/aujourdhui-tableau-de-bord-contract.md` pour ce
qu'elle change (section 3.2, précisions T).

## 2. Ce qui ne change pas

- Les chiffres, les phrases de résumé, les pastilles et l'ordre des blocs
  sur ordinateur (contrat de la page, sections 3.2 et 3.5).
- Un bloc absent parce que sa case est décochée reste absent (R1 du
  contrat de la page) ; une donnée inconnue reste dite inconnue (D-003).
- Rien n'est enregistré ni démarré par un lien (D-028) : un lien mène, le
  geste se fait sur la page d'arrivée.
- Les pages d'arrivée : aucune ne change, sauf une ancre ajoutée par jardin
  dans le tableau des besoins (point 4).

## 3. L1 — Les quatre tuiles mènent à leur menu

**Cause établie dans le code.** `TodayWeekTiles`
(`app/irrigation/today/today-week.tsx`) rend quatre `<div class="today-kpi">`
sans lien. Les quatre cibles existent déjà sur « Objectifs et besoins »
(`app/irrigation/water-management-dashboard.tsx`) : les volets
`AnchoredFold` `objectifs-de-la-semaine` et `manual-rain` s'ouvrent seuls
quand l'adresse les vise, le tableau des jours porte `id="weather"` et le
tableau des besoins `id="irrigation-needs-title"`. Les quatre arrivées ont
été essayées à 1440 et à 390 px : le volet est ouvert et le formulaire dans
l'écran.

**Règles.**

1. Chaque tuile entière est un lien (`<a>`), construit par `pageHref` avec
   la saison et la zone de la page :

   | Tuile | Mot d'action écrit sur la tuile | Cible |
   | --- | --- | --- |
   | Objectif de la semaine | « Modifier les objectifs » ; « Poser un objectif » quand aucun n'est posé | `besoins#objectifs-de-la-semaine` |
   | Eau reçue | « Noter une pluie mesurée » ; « Voir jour par jour » pour une ferme toute sous abri, où la pluie ne compte pas (D-032) | `besoins#manual-rain` ; sinon `besoins#weather` |
   | Reste à apporter | « Voir par planche » ; « Voir ce qui manque » quand le reste est inconnu | `besoins#irrigation-needs-title` |
   | Eau utilisée | « Voir jour par jour » | `besoins#weather` |

2. Le mot d'action est **écrit sur la tuile**, en bas, avec un chevron : sur
   un téléphone, rien d'autre ne signale un lien. Le survol et le focus
   clavier se voient. Le nom lu par un lecteur d'écran est le titre, le
   chiffre, puis le mot d'action.
3. Le mot d'action et la cible viennent du domaine
   (`lib/domain/today/week.ts`), pas du composant : ils se testent sans
   navigateur.
4. Deux textes corrigés dans les mêmes tuiles :
   - « dont 0 m³ aujourd'hui » sous « 768 L » devient « rien aujourd'hui »
     quand le volume du jour est nul (cause : `volume(0)` rend toujours
     « 0 m³ », `week.ts`, ligne 341) ;
   - « objectifs posés sur 7 planches sur 10 » devient « 7 planches sur 10
     ont un objectif » : un seul « sur » par phrase, la règle de F443
     (cause : `week.ts`, ligne 331).

**Cas.**

| Ferme et moment | Tuile | Attendu |
| --- | --- | --- |
| Maraîchage, début d'été | Objectif 23,4 mm | « 7 planches sur 10 ont un objectif, du lun. 15 juin au dim. 21 juin » · « Modifier les objectifs » |
| Petite ferme, début d'été | « aucun objectif posé » | « Poser un objectif » ; « Reste à apporter : inconnu » · « Voir ce qui manque » |
| Maraîchage, automne | Eau reçue, « 2,4 mm de pluie prévue, non mesurée » | « Noter une pluie mesurée » |
| Maraîchage, pénurie | Eau utilisée 768 L | « rien aujourd'hui » · « Voir jour par jour » |

## 4. L2 — Les jauges mènent à leur page

**Cause établie dans le code.** Dans `today-gauges.tsx`, les lignes de
« Eau de la semaine » (`.today-bar-row`) et de « Réserve du sol » sont
inertes ; « Eau disponible » (`TodayWaterBlockView`) n'a **aucun lien**,
ni dans son en-tête ni sur ses cuves. Les liens d'en-tête des blocs
(`a.today-block-more`) sont cachés sous 620 px (`styles/today.css`,
`@container (max-width: 620px)`, `display: none`) : la page compte 12 liens
et boutons à 1440 px, 10 à 390 px. Les cibles existent, sauf une :
`sol#soil-garden-<jardin>` et `ressources#reservoir-<réserve>` ouvrent leur
volet ; le tableau des besoins n'a pas d'ancre par jardin (ses `<details>`
sont sans `id`).

**Règles.**

1. « Eau de la semaine » : la ligne « Ferme » mène à
   `besoins#irrigation-needs-title` ; chaque ligne de jardin mène à son
   jardin dans le tableau des besoins, par une ancre nouvelle
   (`besoin-jardin-<identifiant>`) posée sur le `<details>` du jardin, qui
   s'ouvre quand l'adresse le vise, comme `AnchoredFold`.
2. « Réserve du sol » : chaque ligne mène à `sol#soil-garden-<jardin>`,
   y compris une ligne « inconnue » : la raison se lit à l'arrivée.
3. « Eau disponible » : le bloc gagne le lien d'en-tête « Ressources et
   pompes » ; chaque cuve mène à `ressources#reservoir-<réserve>`, où le
   volume se corrige ; chaque ressource limitée mène à sa ressource sur la
   même page (ancre à confirmer en codant ; à défaut, la page). Le dessin
   reste caché aux lecteurs d'écran ; le lien porte la phrase déjà écrite
   pour eux.
4. Sous 620 px, le lien d'en-tête d'un bloc n'est plus caché : il passe en
   bas du bloc, sur toute la largeur, comme « Voir les alertes ».
5. Toute ligne devenue lien a une cible d'au moins 44 px de haut sur le
   téléphone et un focus visible.

## 5. L3 — Les autres liens de la page

**Cause établie dans le code.** `today-weather.tsx` : les cartes des trois
jours (`li.today-day`) sont inertes, seul « Voir les alertes » mène quelque
part. `reliability-zone.tsx` : une ligne à rafraîchir a son geste, une ligne
à jour n'a rien. `today-header.tsx` : « Plan calculé aujourd'hui à 13 h 27 »
est un texte. `today-day.tsx` : l'état vide « Rien à arroser aujourd'hui »
n'offre aucun lien, et une carte « À valider » dit « Ouvrir » alors qu'elle
mène à sa proposition du planning.

**Règles.**

1. « Gel ou chaleur » : un jour **en alerte** mène à la page de son alerte
   (« Alertes météo » ou « Alertes cultures », la même que « Voir les
   alertes » ; à confirmer en codant quand les deux sont cochées). Un jour
   calme reste inerte : pas de lien qui ne mène à rien de neuf.
2. « Fiabilité du calcul » : une ligne à jour mène à la page où vit sa
   donnée, par la cible que son geste vise quand elle est à rafraîchir
   (`lib/domain/today/reliability.ts`).
3. En-tête : « Plan calculé … » mène au planning de la semaine, quand
   « Planning » est coché.
4. État vide de « Votre journée » : « Voir le planning de la semaine »
   quand « Planning » est coché ; sinon « Planifier un arrosage »
   (`arrosages?planifier=1`, l'intention d'adresse existante) quand
   « Arrosages » est coché.
5. Une carte « À valider » dit « Valider au planning » au lieu d'« Ouvrir » ;
   la cible ne change pas, rien n'est validé par le lien (D-028). Une carte
   planifiée garde « Ouvrir ».
   **Réécrite par la simplification, lot S2, PR 1** (D-330,
   `docs/simplification-s2-contract.md`, section 10) : le **bouton**
   « Valider » valide, la même action que le planning ; le lien vers la
   carte du planning devient « Changer l'heure ou la dose », dans « Autres
   choix » ; rien n'est validé par un lien (D-028 tient). Une carte
   planifiée porte « Démarrer », son lien « Modifier ou annuler sur
   « Arrosages » » dans « Autres choix ».

## 6. L4 — La réponse d'un geste s'écrit sous le bouton

**Cause établie dans le code.** `today-page.tsx` écrit les réponses des
gestes (`notice`, `error`) dans deux paragraphes en tête de page, non
collants. Mesuré à 390 px, en pénurie : après « Démarrer maintenant » pressé
à 1020 px de défilement, la réponse s'écrit vers 730 px, hors de l'écran ;
de même pour « Fait comme prévu », « Tout est fait » et « Recalculer le
plan » depuis « Fiabilité du calcul » (vers 3500 px). Le lot G de l'audit du
19 novembre a posé la règle sur les autres pages (`ActionReply`, F404) en
excluant « Aujourd'hui » ; le lot H ne l'a pas traitée.

**Règles.**

1. La réponse d'un geste de la page (« Démarrer maintenant », « Fait comme
   prévu », « Tout est fait », « Recalculer », « Recalculer le plan »)
   s'écrit **sous le bouton pressé**, par `ActionReply`, et entre dans
   l'écran ; un refus aussi.
2. Quand le geste déplace la carte (une irrigation démarrée passe « En
   cours »), la réponse se lit là où la carte se trouve après le geste.
3. Les deux paragraphes de tête disparaissent : une réponse ne s'écrit
   qu'à un endroit.

## 7. L5 — La mise en page

**Causes établies dans le code.**

- Ordinateur : `.today-block { display: grid }` sans `align-content: start`
  (`styles/today.css`). Un bloc étiré à la hauteur de son voisin répartit le
  vide entre ses rangées : le titre « Eau disponible » occupe 281 px et la
  cuve est en bas d'un bloc de 631 px ; 79 px pour « Votre journée ».
- Téléphone : la colonne de l'heure d'une carte fait 56 px
  (`styles/today-day.css`, `grid-template-columns: 56px minmax(0, 1fr)`)
  et l'heure, d'un seul tenant depuis F441, en demande environ 68 : elle
  chevauche le texte de 2 px à 390 et à 360 px (« 13 h 33planches… »).
- Téléphone : les noms de jardins de « Eau de la semaine » sont coupés,
  4 sur 5 à 390 px, tous à 360 px ; « Champ du haut » et « Champ du bas »
  se lisent tous deux « Champ d… ».

**Règles.**

1. Un bloc étiré garde son contenu en haut : aucune rangée de titre de
   plus de 60 px à 1440 px.
2. L'heure d'une carte ne touche jamais son texte : à 390 et à 360 px,
   aucun recouvrement entre l'heure et le corps de la carte.
3. Un nom de jardin se lit en entier à 390 et à 360 px (le nom sur sa
   ligne, au-dessus de la barre, à la main du code).

**Preuve.** Par mesures dans P29 et P30, pas par captures : hauteurs de
rangée, rectangles qui ne se recouvrent pas, `scrollWidth` égal à
`clientWidth` pour les noms.

## 8. L6 — Sur le téléphone, la page commence par la journée

**Constat.** À 390 × 844 px, en pénurie, l'en-tête fait 526 px, les tuiles
vont de 738 à 984 px et « Votre journée » commence à 1001 px : la première
irrigation à faire est à plus d'un écran du haut.

**Règle.** Sous 620 px, « Votre journée » se place juste après l'en-tête,
avant les tuiles de la semaine. Toujours, et non selon le jour : un bloc
qui change de place d'un jour à l'autre se cherche. Sur ordinateur, l'ordre
ne change pas. L'ordre de lecture au clavier et au lecteur d'écran suit
l'ordre affiché.

**Ce que la règle change.** La précision T5 du contrat de la page (ordre des
blocs validé le 8 novembre 2026), sur le téléphone seulement. **Option
recommandée, que le porteur peut refuser d'un mot** avant le code de L6 ;
les cinq autres PR n'en dépendent pas.

## 9. Précisions proposées

| Sujet | Option recommandée |
| --- | --- |
| Tuile entière ou seul mot cliquable | la tuile entière, avec le mot écrit : une grande cible sur le téléphone |
| Barres de la frise de « Votre journée » | restent inertes : la carte de chaque irrigation est juste dessous |
| Phrase de résumé qui redit les pastilles | inchangée : décidée par le lot A (J13) et le lot H (F443) |
| Jour calme de « Gel ou chaleur » | inerte ; seul un jour en alerte est un lien |
| Ligne « inconnue » de « Réserve du sol » | un lien, sans phrase de plus : la raison est à l'arrivée et dans « Fiabilité du calcul » |

## 10. Ce que le contrat ne prouve pas

- Les mesures viennent de la démonstration locale, pas d'une ferme réelle
  ni d'un vrai téléphone ; la recette du porteur se fait sur la
  démonstration en ligne, sur ordinateur et sur son téléphone.
- L'ancre d'une ressource limitée et la page d'alerte d'un jour quand les
  deux alertes sont cochées restent à confirmer en codant.
