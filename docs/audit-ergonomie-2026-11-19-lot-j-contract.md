# Contrat court — audit ergonomique du 19 novembre 2026, lot J : pages courtes au téléphone (24 duodevicies)

Écrit le 19 novembre 2026, avant tout code, en Opus 5.5 · Élevé (la ligne
24 duodevicies de la roadmap), après le lot I (24 septendecies). Il couvre
les constats **n° 15 et n° 18** du rapport `audit-ergonomie-2026-11-19.md`
et le cas non conforme de la recette du lot D (la hauteur d'« Objectifs et
besoins » au téléphone), retenus par le porteur le 19 novembre 2026 à
11 h 39. Il change l'organisation de pages déjà validées (« Matériel »,
« Réglages », « Objectifs et besoins », « Besoin par culture », « Réserve du
sol ») : ce changement est compris dans le choix n° 1 du rapport, que le
porteur a retenu, et les budgets de hauteur suivent l'option recommandée
du rapport (section 7). Le porteur est en autonomie totale depuis 11 h 44 :
chaque précision ci-dessous, aucune agronomique, suit l'option recommandée
et reste modifiable par lui. **Aucune règle de calcul ne change** et rien
n'est retiré d'une page : ce qui pèse est replié, regroupé ou dit une
fois ; aucune migration. Logiciel multi-fermes : les budgets visent une
page à 390 px avec dix-huit jardins, jamais une ferme.

Registres : décisions **D-183 et suivantes**, précisions **F456 et
suivantes**, parcours **P40** (P39 est le dernier).

## 1. Livraison en sept PR, une à la fois

| PR | Point | Fichiers principaux | Preuve |
| --- | --- | --- | --- |
| 1 · Un seul titre | n° 18 | `planning/weekly-plan-view.tsx`, `soil-reserve/`, `weather-alerts-panel.tsx`, `crop-alerts-panel.tsx`, `irrigation-history-dashboard.tsx`, `series-water-view.tsx`, `crop-water/crop-coefficients-panel.tsx` | test de garde, P40 |
| 2 · « Besoin par culture » : le pli des réglages | n° 15 (J2) | `crop-water/crop-coefficients-panel.tsx`, `crop-water/crop-water-settings.tsx` | P40 étendu |
| 3 · « Réserve du sol » : les jardins pareils en une barre | n° 15 | `lib/domain/soil-reserve/`, `soil-reserve/` | tests du domaine, P40 étendu |
| 4 · « Réglages » : les espèces pliées, une seule liste | n° 15 | `crop-water/crop-coefficients-panel.tsx`, `lib/domain/crop-water/species-linking.ts` | tests du domaine, P40 étendu |
| 5 · « Objectifs et besoins » court au téléphone | n° 15, reste du lot D | `irrigation-needs-dashboard.tsx` et ses blocs | P40 étendu (390 et 1440 px) |
| 6 · « Matériel » : jardins repliés, trois onglets | n° 15 | `hierarchy-browser.tsx`, `hierarchy/plot-plan-card.tsx`, `equipment-inventory.tsx` | P40 étendu |
| 7 · « Arrosages » et « Historique » : le premier geste plus haut | n° 15 (autres points) | `irrigation-manager/irrigation-form.tsx`, `irrigation-history-dashboard.tsx` | P40 étendu |

Chaque PR : `lint`, `typecheck`, `test`, `build`, `knip`, `push:check`,
`weather:check`, `site:check` collés ; `e2e` joué en local sur les
parcours touchés, la suite complète par la CI de la PR ; registres dans la
même PR. L'ordre suit le gain sur l'effort : les petites PR sûres
d'abord, puis les deux pages les plus lourdes.

## 2. Budgets de hauteur

Mesurés par P40 à 390 px sur les données de test des parcours (dix-huit
jardins au plus), chaque pli fermé, sans fenêtre ouverte. Un budget est
une borne haute : la PR qui le dépasse dit pourquoi.

| Page | Mesure de l'audit (ferme du porteur) | Budget |
| --- | --- | --- |
| Matériel | 17 546 px | 5 300 px |
| Réglages | 11 672 px | 3 000 px |
| Objectifs et besoins | 6 307 px (démonstration 4 508) | 3 200 px |
| Besoin par culture | 4 480 px | 3 000 px |
| Réserve du sol | 3 733 px | 2 600 px |

Les données des parcours ne sont pas celles de la ferme du porteur : quand
elles chargent une page plus que sa ferme, P40 fixe la borne sur la mesure
faite avant et après la PR, et la PR le dit (« Besoin par culture » : aucune
culture de la saison, les 32 cultures de référence ouvertes, F302 ;
5 541 px avant la PR 2, 3 961 après, borne de P40 à 4 000).

Les autres pages gardent leur hauteur ; P40 la mesure pour qu'aucune ne
grandisse de plus de 10 % sans le dire.

## 3. Ce qui ne change pas

Le calcul, les données, les gestes et leurs confirmations (lot G), le
contrat d'« Aujourd'hui » (lot H), la page à l'ordinateur au-delà des
plis (un pli fermé au téléphone peut s'ouvrir d'office à l'ordinateur
quand la place le permet), les ancres des liens existants : un lien vers
un bloc replié ouvre son pli (comme `PageSettingsFold`).

## 4. n° 18 — Un seul titre (PR 1)

**Cause établie dans le code.** La page porte son titre dans la coquille ;
le premier bloc répète le même titre en `h2` (« Planning de la semaine »,
`weekly-plan-view.tsx`), ou un synonyme (« Historique et cumuls » puis
« Cumuls et historique », `irrigation-history-dashboard.tsx` et
`series-water-view.tsx`), parfois en sautant un niveau.

1. Quand le premier bloc d'une page dit la même chose que le titre de la
   page, son titre est caché à l'écran (`sr-only`) et reste pour les
   lecteurs d'écran ; le surtitre qui redit la page (« Planning · saison
   2026 », « Suivi réel · saison 2026 ») disparaît ; le bloc commence par
   sa phrase. Les ancres existantes (`#planning-title`,
   `#series-water-title`…) mènent toujours au bloc.
2. Les niveaux de titre se suivent sans saut : le titre caché d'un bloc
   est un `h2` sous le `h1` de la page ; sur « Réserve du sol », « Alertes
   météo » et « Alertes cultures », où il était un `h3`, ses sous-titres
   remontent d'un niveau, à la même taille qu'avant.
3. Un test de garde le vérifie sur les sept blocs concernés, et P40
   compte, sur chaque page, un seul titre visible qui dit son nom.

## 5. n° 15 — « Besoin par culture » : le pli des réglages (PR 2)

**Cause établie dans le code.** « Réglages du calcul »
(`crop-water-settings.tsx`) s'affiche ouvert sous les cultures, hors du
pli « Réglages de cette page » que les quatre autres pages ont (J2).

1. « Réglages du calcul » passe dans le pli « Réglages de cette page »,
   fermé, en bas, comme sur les quatre autres pages.
2. Un lien vers ces réglages ouvre le pli.

## 6. n° 15 — « Réserve du sol » : les jardins pareils en une barre (PR 3)

**Cause à établir dans le code d'abord.** La phrase qui regroupe les
jardins pareils (J4) existe, mais chaque jardin garde sa barre.

1. Les jardins de même état (même part du plein, même origine : estimée
   ou observée le même jour, même type plein champ ou abri) n'ont qu'une
   barre : « 11 jardins de plein champ : 100 % », avec leurs noms dans la
   ligne et le détail de chacun à l'appui.
2. Un jardin qui a une irrigation aujourd'hui ou qui est sous son seuil
   garde sa barre à lui (ordre du lot H, n° 4).
3. « 100 % », « sec 25 % », « frais 50 % » ne se coupent plus.
4. La ligne dit « estimé aujourd'hui » pour l'estimation et « observé le
   … » pour l'observation, sans les mêler dans la même phrase.

## 7. n° 15 — « Réglages » : les espèces pliées, une seule liste (PR 4)

**Cause à établir dans le code d'abord.** « Correspondance des espèces »
liste toutes les espèces de la saison ouvertes, et les espèces à
rattacher paraissent deux fois (« Espèces de la saison » puis la liste
« sans référence »).

1. « Correspondance des espèces » est un pli fermé dont le titre porte son
   compteur : « 36 espèces à rattacher sur 77 » ; il s'ouvre d'office
   quand une espèce attend et que la page est arrivée par un lien vers
   elle.
2. Une seule liste : les espèces à rattacher en tête, puis les autres ;
   la liste « sans référence » ne répète plus les mêmes noms (elle devient
   un compteur et un renvoi si elle n'apporte rien d'autre).
3. La recherche par nom reste en tête du pli.

## 8. n° 15 — « Objectifs et besoins » court au téléphone (PR 5)

**Cause à établir dans le code d'abord** (mesures de l'audit : jardins
2 410 px, sept jours 873, tuiles 521, objectifs 473, météo 395, pluie
mesurée 386, titres 234).

1. Au téléphone, chaque jardin tient sur une ligne compacte (64 px au
   plus) : nom, reste à apporter, état ; le détail s'ouvre à l'appui.
2. « Pluie mesurée » et les objectifs sont repliés, chacun avec une ligne
   de résumé.
3. La météo tient sur une ligne.
4. Les tuiles deviennent une ligne de résumé, comme au planning.
5. Une planche ouverte montre d'abord « À planifier » et le besoin ; les
   trois autres quantités sont dans « Pour les experts ».
6. À l'ordinateur, la page ne change pas au-delà de ces plis.

## 9. n° 15 — « Matériel » : jardins repliés, trois onglets (PR 6)

**Cause établie dans le code.** `hierarchy-browser.tsx` montre le plan
(chaque jardin ouvert), puis « Aperçu instantané », « Groupes de jardins
alignés » et l'inventaire du matériel l'un sous l'autre : l'inventaire
commence vers 11 300 px.

1. Trois onglets en tête de page : **Plan · Matériel · Groupes** ; le plan
   d'abord. L'onglet est gardé dans l'adresse (un lien y mène).
   « Aperçu instantané » va avec le plan.
2. Au téléphone, chaque jardin du plan est replié sur une ligne (nom,
   planches, matériel posé) et s'ouvre à l'appui ; le jardin de la planche
   choisie est ouvert.
3. Un nom de matériel trop long se coupe au milieu, jamais à la fin :
   deux noms qui ne diffèrent qu'à la fin restent distincts ; le nom entier
   est dans la bulle.
4. Le fil d'Ariane passe à la ligne au lieu de sortir de l'écran.
5. Poser un matériel depuis l'inventaire bascule sur l'onglet Plan.

## 10. n° 15 — « Arrosages » et « Historique » : le premier geste plus haut (PR 7)

1. « Résultat calculé » n'apparaît qu'une fois un matériel et une quantité
   choisis (380 px de moins avant le premier choix).
2. « Historique » : les filtres sont dans un pli « Filtrer » avec le
   résumé de ceux qui sont actifs ; « Exporter CSV… » en bouton secondaire
   après les chiffres.

## 11. Tests et preuves

Tests du domaine pour chaque règle (regroupement des jardins pareils,
compteur des espèces, titres en double). Parcours **P40** « Pages courtes
au téléphone », à 390 et 1440 px : la hauteur de chaque page sous son
budget à 390 px, un pli replié s'ouvre par un lien, un onglet de
« Matériel » gardé dans l'adresse, un nom de matériel long distinct de son
voisin, aucune page qui déborde de côté.

## 12. Risques

- Des parcours existants lisent des blocs désormais repliés : ils ouvrent
  le pli d'abord ; aucun parcours n'est retiré.
- Les budgets sont mesurés sur les données de test, pas sur la ferme du
  porteur (dix-huit jardins, soixante-dix-sept espèces) : la recette sur
  sa ferme les confirme.
- Le poids de la page (21 127 éléments sur « Objectifs et besoins ») baisse
  avec les plis seulement si leur contenu n'est rendu qu'à l'ouverture :
  la PR 5 le mesure et le dit.

## 13. Précisions

Chaque précision faite en codant, numérotée à la suite du registre.

- **F456** le titre du premier bloc qui redit la page est caché à l'écran et reste pour les lecteurs d'écran, en `h2` ; le surtitre qui redit la page disparaît ; sous un titre de bloc devenu `h2`, les sous-titres remontent d'un niveau, à la même taille (section 4).

- **F457** « Réglages du calcul » de « Besoin par culture » dans le pli « Réglages de cette page », fermé, en bas ; un lien vers un élément du pli l'ouvre ; 5 541 px → 3 961 px à 390 px sur les données des parcours (section 5).

- **F458** sur « Réserve du sol », les jardins pareils (même % arrondi, même jour d'observation, même % prévu dimanche, aucune planche sous son seuil) en une barre, « 11 jardins de plein champ », trois noms puis « et n autres », chaque planche un point ; un abri, un jardin inconnu ou sous son seuil garde sa barre ; « 100 % » et les repères du curseur sans coupure ; « 100 % du plein estimé aujourd'hui · dernière observation le … » (section 6). La règle « un jardin qui a une irrigation aujourd'hui garde sa barre » du point 2 n'a pas lieu d'être sur cette page, qui ne lit pas les irrigations du jour : un jardin sous son seuil garde la sienne.

Les précisions des PR 4 à 7 suivent, F459 et au-delà.

Ce que le lot ne prouve pas : un vrai téléphone, un lecteur d'écran ; la
ferme réelle n'est pas touchée.
