# Contrat court — audit ergonomique du 19 novembre 2026, lot I : « Pénurie et démonstration » (24 septendecies)

Écrit le 19 novembre 2026, avant tout code, en Opus 5.5 · Élevé (la ligne
24 septendecies de la roadmap), après le lot H (24 sexdecies). Il couvre les
constats **n° 5, n° 10, n° 11, n° 12 et n° 25** du rapport
`audit-ergonomie-2026-11-19.md`, retenus par le porteur le 19 novembre 2026
à 11 h 39. Le porteur est en autonomie totale depuis 11 h 44 : chaque
précision ci-dessous, aucune agronomique, suit l'option recommandée du
rapport et reste modifiable par lui. **Aucune règle de calcul ne change** :
ni le moteur du planning, ni la faisabilité de « Ressources », ni les
besoins ; aucune migration. Seule une donnée de la ferme fictive change
(n° 5, point 4). Logiciel multi-fermes : les règles visent une situation,
jamais une ferme.

Registres : décisions **D-178 et suivantes**, précisions **F445 et
suivantes**, parcours **P39** (P38 est le dernier).

## 1. Livraison en cinq PR, une à la fois

| PR | Point | Fichiers principaux | Preuve |
| --- | --- | --- | --- |
| 1 · Le manque dit d'où il vient | n° 5 | `lib/domain/planning/shortage-reading.ts`, `app/irrigation/irrigation-feasibility-dashboard.tsx`, `lib/adapters/demo/module-data.ts` | tests du domaine, P39 |
| 2 · La démonstration à son jour | n° 10 | les dépôts dont une règle lit la date d'écriture (`db/water-management-repository.ts` d'abord) | tests des dépôts, P39 étendu |
| 3 · La démonstration se prépare jusqu'au bout | n° 11 | `lib/services/demo-space.ts`, `db/demo-space-repository.ts`, l'écran d'attente | tests des dépôts, P39 étendu |
| 4 · Le bandeau sur tablette | n° 12 | `app/irrigation/styles/demo.css` | test de feuille, P39 étendu (768 et 834 px) |
| 5 · Petits défauts de la démonstration | n° 25 | les alertes, « Réglages », la ferme vierge | tests, P39 étendu |

Chaque PR : `lint`, `typecheck`, `test`, `build`, `knip`, `push:check`,
`weather:check`, `site:check` collés ; `e2e` joué en local sur les
parcours touchés, la suite complète par la CI de la PR ; registres dans la
même PR.

## 2. n° 5 — Le manque dit d'où il vient (PR 1)

**Cause établie dans le code** (démonstration « Pic d'été, l'eau manque »,
rejouée sur la machine de développement le 19 novembre 2026). Le bassin
offre 2 m³ d'ici dimanche ; les cinq planches qui ont un objectif
demandent 1,2 m³. La faisabilité de « Ressources » compare l'eau aux seuls
besoins des planches qui en ont un (`allocateIrrigationWater`) : pour elle,
rien ne manque. Le moteur du planning compte, lui, l'eau que le matériel
tire vraiment : chaque goutte-à-goutte arrose toutes les planches qu'il
couvre, dont les cinq planches sans culture de la semaine, au-delà de leur
besoin (le « surplus », R11, déjà écrit dans chaque proposition). Les
quatre irrigations proposées tirent 1,95 m³ pour en porter 0,84 aux
planches qui en ont besoin : le bassin s'épuise, et 367 L manquent (motif
« stock et ressources insuffisants »). Les deux calculs sont justes ;
aucun ne dit à la personne que l'eau part sur des planches qui n'en ont
pas besoin.

1. Le plan enregistré expose, en lecture seule, l'eau versée au-delà du
   besoin par les irrigations proposées de la semaine : son volume (le
   surplus de chaque planche sur sa surface mouillée) et les planches qui
   la reçoivent sans besoin. Rien ne change dans le calcul.
2. Quand le plan manque d'eau et que cette eau dépasse le litre, la phrase
   du manque le dit, au planning et sur « Aujourd'hui » : « Il manque 728 L
   d'eau d'ici dimanche : 5 planches ne recevront pas tout leur besoin.
   Le matériel verse aussi 486 L sur des planches qui n'en ont pas besoin
   cette semaine (A03, C01, H01 et 1 autre). » Quand ces planches ont un
   besoin, « au-delà du besoin des planches qu'il arrose ».
3. L'écran où mène « Répartir l'eau » part du manque du planning. Quand la
   faisabilité trouve elle aussi un manque, il propose la répartition comme
   aujourd'hui. Sinon, il dit pourquoi et quoi faire, au lieu de tuiles
   vides : « Le planning compte un manque de 367 L d'ici dimanche, que
   cette répartition ne voit pas. Les besoins des planches qui ont un
   objectif (1,2 m³) tiennent dans l'eau disponible (2 m³). Le matériel
   verse aussi 1,1 m³ sur des planches qui n'en ont pas besoin cette
   semaine (…). Le manque vient de là. Fermez leurs lignes, retirez ces
   planches du matériel, ou fixez leur objectif. » Avec les liens vers
   « Matériel » et « Objectifs et besoins ». Sans eau versée au-delà du
   besoin, il dit que le manque vient des heures, des pompes ou du
   remplissage des réserves, que seul le planning vérifie, avec le lien
   vers le planning.
4. Les deux avertissements orange en tête de la faisabilité passent sous ce
   bloc, en texte ordinaire, et disent la chose sans jargon : « 5 planches
   sans objectif adopté : leur besoin n'est pas compté ici. » ;
   « Calcul en volume seulement : les heures, les pompes et le remplissage
   des réserves sont vérifiés par le planning. » « Recalculer la faisabilité » passe en bouton
   secondaire.
5. **La démonstration « Pic d'été, l'eau manque »** montre une vraie
   répartition : le bassin du moment passe de 6 à 5 m³ (1 m³ au-dessus de
   la réserve de sécurité), sous les 1,2 m³ des planches cultivées. Une
   donnée de la ferme fictive, pas une règle.

## 3. n° 10 — La démonstration à son jour (PR 2)

**Cause établie dans le code.** Une révision d'objectif reçoit sa date de
la base (`created_at`, horloge réelle), alors que la démonstration vit au
jour simulé ; la règle qui fait compter un objectif posé après sa semaine
à partir du lundi suivant (`goalRevisionFirstDate`) le repousse alors à
fin novembre.

1. Toute écriture dont une règle lit la date porte l'heure du module (le
   jour simulé en démonstration, l'heure réelle ailleurs) au lieu de celle
   de la base. Inventaire établi dans le code : les révisions d'objectif
   (que `goalRevisionFirstDate` relit) et la limite journalière (la plus
   récente l'emporte) ; les créneaux protégés et les objectifs adoptés
   portaient déjà l'heure du module.
2. Sur une vraie ferme, rien ne change : l'heure du module y est l'heure
   réelle.

## 4. n° 11 — La démonstration se prépare jusqu'au bout (PR 3)

**Cause établie dans le code.** La préparation crée l'espace, puis écrit
les données, puis coche les cases en dernier, qui disent « prêt ». Une
préparation interrompue (onglet fermé, requête coupée) laisse un espace
créé sans cases : chaque requête suivante attend cinq secondes qu'une
autre finisse (`waitUntilPrepared`), puis montre l'espace à moitié écrit,
et rien ne le complète ensuite, sauf « Remettre à zéro » ou la remise à
zéro de nuit. D'où les pages à 9,5 s et la démonstration à moitié prête.

1. La préparation note son début. Une préparation commencée depuis plus de
   deux minutes sans avoir fini est reprise par la requête suivante : elle
   remet l'espace à zéro et le prépare jusqu'au bout. Deux requêtes ne la
   reprennent jamais ensemble.
2. Une requête qui arrive pendant une préparation en cours attend deux
   secondes au plus, puis la page affiche « Préparation de votre
   démonstration… » et se relit seule toutes les deux secondes, au lieu
   d'attendre en silence et de montrer un espace à moitié écrit ; elle
   s'ouvre dès que l'espace est prêt. La requête qui prépare, elle, rend la
   page une fois la préparation finie.
3. Hors démonstration, rien ne change.

## 5. n° 12 — Le bandeau sur tablette (PR 4)

**Cause établie dans le code** (`app/irrigation/styles/demo.css`) : au-dessus
de 600 px, le bandeau tient sur une ligne, et sa phrase est le seul
élément qui rétrécit, jusqu'à zéro.

1. La version compacte du téléphone vaut jusqu'à 1 000 px.
2. Au-dessus, la phrase passe à la ligne plutôt que de rétrécir sous sa
   largeur lisible (18 caractères au moins). Mesuré sur la bannière seule :
   44 px de haut de 390 à 1 000 px, au lieu de 150 px à 768 px.
3. Aucune page ne déborde de côté entre 600 et 1 000 px.

## 6. n° 25 — Petits défauts de la démonstration (PR 5)

1. La carte d'une alerte de gel porte l'icône du froid, pas celle du
   soleil.
2. En démonstration, une alerte non envoyée parce que les notifications y
   sont coupées se lit « Non envoyée : notifications coupées dans la
   démonstration », en couleur neutre, jamais « Échec du service de
   notification » en rouge.
3. La note « Démonstration : les notifications du téléphone sont
   désactivées » se place dans la section des notifications de
   « Réglages », plus en note isolée en bas de page.
4. Ferme vierge : la liste à cocher propose un point de départ,
   « Commencer par l'essentiel » (Arrosages, Objectifs et besoins,
   Matériel), sans rien cocher d'office ; « Cochera aussi … » s'écrit en
   texte ordinaire, pas en vert gras qui ressemble à un lien. **Depuis S6** (lot S6, D-336, `docs/simplification-s6-contract.md`, section 11) :
   « Commencer par l'essentiel » est **retiré**, remplacé par les trois
   façons de commencer ; « Cochera aussi … » reste dans la liste de
   « Choisir moi-même ».

## 7. Tests et preuves

Tests du domaine pour la phrase du manque et l'eau versée sans besoin ;
tests des dépôts pour la date au jour simulé et la reprise d'une
préparation interrompue ; test de feuille pour le bandeau. Parcours
**P39** « Pénurie et démonstration », à 390, 768 et 1440 px, sur la
démonstration : la pénurie mène à une répartition ; un objectif posé
compte ; le bandeau lisible sur tablette ; la carte du gel ; la ferme
vierge ; puis la remise en état.

## 8. Risques

- Sur une vraie ferme, la phrase de l'eau versée sans besoin peut
  apparaître une semaine où des planches vides restent sous un matériel
  en marche : c'est vrai, et c'est le but.
- La reprise d'une préparation interrompue remet à zéro un espace qui
  n'avait jamais été prêt : aucun essai d'invité ne s'y perd, puisque les
  cases n'y étaient pas cochées.
- Le bassin de la démonstration à 5 m³ change les chiffres du moment
  « Pic d'été » : les tests et la visite guidée qui les citent suivent.

## 9. Précisions

- **F445** la phrase du manque dit l'eau que le matériel verse au-delà du besoin, lue dans le plan enregistré (section 2.1 et 2.2).
- **F446** l'écran de répartition dit d'où vient un manque du planning qu'il ne voit pas, et quoi faire (section 2.3).
- **F447** les deux avertissements de la faisabilité deviennent des notes sans jargon ; « Recalculer la faisabilité » en bouton secondaire (section 2.4).
- **F448** le bassin du moment « Pic d'été » à 5 m³ : une vraie répartition à faire (section 2.5).

- **F449** ce que la démonstration écrit et qu'une règle relit par sa date (les objectifs, la limite journalière) porte l'heure du module, le jour simulé (section 3).

- **F450** une préparation interrompue est reprise jusqu'au bout par une seule requête ; une préparation en cours se dit « Préparation de votre démonstration… » et la page se relit seule (section 4).

- **F451** la bannière compacte du téléphone jusqu'à 1 000 px ; au-dessus, la phrase passe à la ligne sans rétrécir sous 18 caractères (section 5).

- **F452** « Commencer par l'essentiel » coche Arrosages, Objectifs et besoins, Matériel et placement, avec ce dont elles ont besoin, et garde ce qui l'était ; « Cochera aussi … » en texte ordinaire gris (section 6, point 4). Retiré depuis S6 (D-336) : les trois façons de commencer le remplacent.

- **F453** le flocon suit aussi une alerte météo sur la température minimale « en dessous de », même au-dessus de 0 °C (section 6, point 1).

- **F454** en démonstration, un envoi manqué, sans appareil ou relancé se lit « Non envoyée : notifications coupées dans la démonstration », en couleur neutre ; hors démonstration, rien ne change (section 6, point 2).

- **F455** dans « Réglages » en démonstration, la ligne des notifications coupées se lit sous le titre « Notifications du téléphone » (section 6, point 3).

Ce que le lot ne prouve pas : un vrai téléphone, une vraie tablette, un
lecteur d'écran ; la ferme réelle n'est pas touchée.
