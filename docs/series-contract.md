# Contrat — Suivi hydrique par série culturale

Écrit le 26 septembre 2026, avant tout code, après le déblocage de l'API
d'Ouvre ta ferme et une reconnaissance sur la ferme du porteur. **Validé par
le porteur le 28 septembre 2026** (D-021 et D-022) ; les points tranchés sont
récapitulés à la fin, sous « Décisions du porteur ». Cahier des charges,
section 13 ; roadmap, section 5.

**Prérequis avant la première ligne de code de l'extension :** l'alignement
des planches sur la surface mouillée en aspersion (D-022, règle 2 ; roadmap,
étape 5.0). Le contrat de ce chantier est à écrire séparément.

## À quoi ça sert

Aujourd'hui le module sait ce qu'a reçu chaque **planche** : irrigations
réelles, pluie, objectif, écart. Il ne sait pas ce qu'a reçu chaque
**culture**, parce qu'une planche porte plusieurs séries dans la saison —
sur la ferme du porteur, 132 planches sur 161 en 2026 — et que rien ne disait
laquelle était là quand l'eau est tombée.

Ouvre ta ferme le dit désormais : quelle série occupe quelle planche, sur
combien de mètres, et par ses tâches, à partir de quelle semaine. Ce contrat
relie les deux : les millimètres reçus par une planche sont attribués aux
séries qui l'occupaient à ce moment-là, et cumulés par série.

Ce que ça permet, et rien de plus pour l'instant : lire, série par série, l'eau
reçue depuis l'implantation, la comparer à l'objectif, et voir l'écart. Ni
paramètre cultural, ni coefficient, ni planning par série : ces questions
restent ouvertes dans la roadmap (section 8) et ne s'écrivent pas ici.

## Ce que l'API fournit

Documentation : `https://ouvretaferme.gitbook.io/ouvretaferme`, en bêta, « sujette
à changement sans préavis ». Cinq routes rejoignent la liste blanche du
connecteur, toutes `GET`, sous la portée `production:read` que la clé du module
porte déjà (D-002 inchangée : serveur seul, lecture seule, quatre appels par
seconde au plus, pages de 500 au plus).

| Route | Ce qu'elle donne | Volume constaté sur la ferme, saison 2026 |
| --- | --- | --- |
| `GET /actionList` | Les interventions, avec leur identifiant stable `fqn` — `semis-direct`, `plantation`, `semis-pepiniere`, `recolte`, `fertilisation` — nul pour celles créées par le porteur | 21, dont 16 personnalisées |
| `GET /seriesList?season=S&withCultivations=true` | Les séries de la saison et leurs mises en culture | 254 séries |
| `GET /placeList?season=S` | L'occupation : une ligne par planche et par série, avec `length`, `width`, `area` | 397 emplacements |
| `GET /taskList` | Les tâches, avec leur action, leur série, leur mise en culture, `plannedWeek`, `doneWeek`, `status` | 6 095, toutes saisons confondues |
| `GET /plantList` | Les espèces, avec leur nom — une mise en culture ne porte que l'identifiant de son espèce | 81 espèces, une page |

La cinquième route, `/plantList`, a été ajoutée le 29 septembre 2026 au
moment d'écrire le connecteur : sans elle, la ligne d'une série n'aurait pu
montrer que des numéros d'espèces. Une page, même portée, mêmes règles.

Le filtre `season` de `/taskList` est **ignoré** par OTF (même compte avec et
sans) ; les filtres `series`, `plannedWeek` et `doneWeek` fonctionnent. Les
listes sont triées par identifiant croissant et `afterId` permet une reprise.

Unités, confirmées sur 397 emplacements : `length` en **mètres**, `width` en
**centimètres**, comme pour les planches. `area` vaut
`length × (width + allée de la série) / 100` : c'est une surface **allée
comprise**, qui ne sert pas ici (voir « La surface d'une série »).

Les semaines sont des chaînes ISO `2025-W45`, du lundi au dimanche (D-004).
Les dates au jour (`plannedDate`, `doneDate`) sont **nulles** sur toute la
ferme : l'unité du plan de culture est la semaine, comme la nôtre.

## Vocabulaire

- **Série** : un regroupement de cultures menées ensemble, sur les mêmes
  planches, pour une saison. C'est l'unité du suivi.
- **Mise en culture** : une espèce dans une série. Une série en a une ou
  plusieurs.
- **Emplacement** : une planche occupée par une série, sur un certain linéaire.
- **Tâche** : une intervention datée d'une semaine, rattachée à une série et
  généralement à une mise en culture.
- **Semaine d'implantation** : la semaine où la culture est mise au champ,
  par semis direct ou par plantation.

## La période d'occupation

C'est le cœur du contrat : sans elle, rien ne se cumule. Elle se
**recalcule** depuis les tâches, et ne se lit pas dans les entiers
`bedStartCalculated` et `bedStopCalculated` qu'OTF publie sans les
documenter (D-021).

### Le début : la semaine d'implantation

Pour chaque mise en culture d'une série :

1. prendre les tâches de la série dont l'action a pour `fqn` **`semis-direct`**
   ou **`plantation`** — le semis en pépinière ne met rien au champ ; les
   interventions à `fqn` nul, créées par le porteur, sont ignorées, aucune
   n'étant un semis ni une plantation ;
2. ne garder que celles de cette mise en culture, **plus** celles qui n'en
   désignent aucune : une tâche posée sur la série entière vaut pour toutes ses
   cultures ;
3. pour chacune, retenir la **semaine réalisée** (`doneWeek`) si la tâche est
   cochée faite, sinon la **semaine planifiée** (`plannedWeek`). Le porteur
   l'a tranché ainsi, parce qu'on ne peut pas compter sur le fait que l'action
   soit cochée dans OTF : si elle l'est, c'est la réalité ; sinon, le planning ;
4. la semaine d'implantation de la mise en culture est **la plus précoce** ;
   on note si c'est un semis ou une plantation.

La semaine d'implantation de la **série** est la plus précoce de ses mises en
culture. Une série sans aucune tâche de semis direct ni de plantation **n'a pas
de période** : rien n'est cumulé, et l'écran le dit (voir « Cas limites »).

C'est la règle d'Ouvre ta ferme, lue dans son code source et reprise à notre
compte. Vérifiée le 26 septembre 2026 sur trois séries réelles :

| Série | Tâche retenue | Semaine | Code OTF | Recalcul |
| --- | --- | --- | --- | --- |
| Aillet | semis direct, faite | 2025-W45 | −55 | −55 |
| Fève | semis direct, faite (planifiée W50) | 2025-W51 | −49 | −49 |
| Ail sec | semis direct, faite | 2025-W45 | −55 | −55 |

Le code d'OTF vaut `numéro de semaine + (année − saison) × 100` : il ne sert
qu'à cette comparaison, jamais au calcul.

### La fin : la dernière semaine de récolte

Tranché par le porteur le 28 septembre 2026 (D-022) : la période se termine à
la **dernière semaine de récolte** de la série — la dernière semaine réalisée
(`harvestWeeks` d'une mise en culture) si elle existe, sinon la dernière
semaine attendue (`harvestWeeksExpected`), le maximum sur les mises en
culture. Motif : une culture ne reste pas en place après sa dernière récolte.
C'est le symétrique de la règle d'implantation, et c'est aussi ce qu'OTF
calcule. Sur la ferme, aucune série n'en est dépourvue.

Une série dont la dernière récolte est à venir est **en cours** : sa période
court jusqu'à aujourd'hui pour les cumuls observés, et jusqu'à la fin attendue
pour l'objectif restant.

### Une période est faite de semaines

La période d'une série sur une planche va du lundi de sa semaine
d'implantation au dimanche de sa dernière semaine de récolte, en
`Europe/Paris`. Elle n'est pas bornée par l'année civile : l'aillet implanté
en semaine 45 de 2025 pour la saison 2026 a une période qui commence en 2025.
Elle est bornée par la saison de la série au sens d'OTF, pas par la nôtre.

## L'attribution des millimètres

**Chaque série présente sur une planche reçoit la totalité des millimètres
tombés sur cette planche.** Il n'y a pas de répartition entre séries : c'est
une règle invariante du cahier des charges, écrite dans `AGENTS.md`, et elle
ne change pas ici.

Conséquence assumée : quand deux séries se succèdent sur une planche et se
chevauchent d'une semaine — la seconde est plantée la semaine où la première
finit sa récolte — l'eau de cette semaine compte pour les deux. Ce n'est pas
un double compte, c'est la règle : chacune l'a reçue.

Une série n'a droit qu'aux millimètres de **sa** période : rien avant son
implantation, rien après sa dernière récolte, même si la planche en a reçu.

## La surface d'une série

**Corrigé le 29 septembre 2026, à l'écriture du code**, par ce que le
contrat de l'étape 5.0 a tranché entre-temps (`docs/wetted-surface-contract.md`,
D-023) : deux surfaces, jamais confondues. La **surface de planche occupée**,
`linéaire de l'emplacement × largeur de la planche`, pondère les millimètres
entre les planches d'une série — `Σ(mm × m²) / Σ(m²)`, la même règle que
pour un jardin. La **surface mouillée** de chaque irrigation, telle que
l'irrigation l'a enregistrée selon son matériel, convertit ses millimètres en
volume, au prorata du linéaire occupé. Le texte d'origine suit ; il reste vrai
pour les volumes.

Pour convertir les millimètres d'une irrigation en volume, la surface d'un
emplacement est la **surface mouillée**, et elle dépend du matériel qui a fait
l'irrigation, pas de la série (D-022, règle 2) :

- **goutte-à-goutte** : `longueur occupée (Place.length, en m) × largeur de
  la planche (Bed.width, en m)` — un emplacement de 32 m sur une planche de
  75 cm vaut 24 m² ;
- **aspersion** : `longueur occupée × (largeur de la planche + passe-pied
  (Bed.alleyWidth, en m))` — le même emplacement avec un passe-pied de 45 cm
  vaut 38,4 m², parce que l'arroseur mouille aussi le passe-pied.

Une planche qui reçoit les deux matériels, ou qui en change en cours de
saison, compte **chaque irrigation selon son propre matériel**. Ni l'une ni
l'autre n'est `Place.area` : cette valeur d'OTF inclut l'allée **de la
série**, qui n'est pas le passe-pied de la planche.

C'est la même règle que pour une planche entière — **une fois les planches
alignées** (roadmap, étape 5.0) : jusqu'ici le module comptait la planche
seule en aspersion, ce qui sous-estimait les m³, et une série aurait consommé
plus que sa propre planche. L'alignement précède le code des séries.

Un emplacement peut occuper une planche **partiellement** — 107 sur 397 sur
la ferme. Son linéaire est celui de l'emplacement, pas celui de la planche.
Une planche dont la largeur est inconnue rend la surface occupée inconnue,
donc la pondération impossible : la série s'affiche alors avec ses millimètres
par planche, sans moyenne, jamais avec un zéro (D-003). Une irrigation dont la
surface mouillée est inconnue rend le volume de sa série **inconnu et
signalé**, ses millimètres restant exacts, comme pour une planche (5.0).

Les volumes en m³, eux, s'additionnent entre planches, au prorata du linéaire
occupé quand une planche est partagée par sa longueur — deux emplacements de
16 m sur une planche de 32 m reçoivent chacun la moitié du volume de la
planche, mais la totalité de ses millimètres.

## Les cumuls par série

Sur la période d'occupation, pour chaque série, par planche puis pondéré :

- **irrigation réelle** : les apports réels confirmés, tels que l'historique
  les tient déjà (2.9) — une irrigation partielle compte pour ses valeurs
  réelles, une planification ou une annulation pour zéro ;
- **pluie réelle** : jour par jour, la mesure du pluviomètre, sinon la
  réanalyse, et **zéro sous abri** ; un zéro reçu est un zéro valide, une
  donnée absente reste absente et se signale — jamais un zéro (D-003 ;
  précisé le 29 septembre 2026 : le « sinon zéro » du texte d'origine
  contredisait la phrase suivante) ;
- **objectif cumulé** : l'objectif hebdomadaire applicable, relu comme un
  historique, proratisé par jour (`objectif / 7`) et sommé sur les jours
  écoulés de la période qu'un objectif couvre ; un jour sans objectif compte
  zéro et n'est pas une donnée manquante, seule une période sans aucun jour
  couvert est sans objectif ni écart, et le nombre de journées-planche
  couvertes — une planche sur un jour — est affiché (D-036, point ouvert 39, 9
  octobre 2026). Un objectif compte, dans la semaine pour laquelle il est
  posé, à partir de son jour de pose en heure de Paris (D-004), ou dès le
  lundi s'il reprend automatiquement la semaine précédente ; les semaines
  suivantes le comptent dès le lundi, jusqu'à la révision qui le remplace ; un
  objectif posé après sa semaine ne la couvre pas. C'est la règle du tableau
  des besoins (D-034), qui vit en un seul endroit, `goalRevisionFirstDate`
  dans `lib/domain/hydric-goal-revisions.ts` (D-039, point ouvert 40, 9
  octobre 2026). Les objectifs sont enregistrés par saison ; une série
  implantée l'année précédente relit ceux de sa saison **et de la précédente**
  comme un seul historique (précisé le 29 septembre 2026). Ce qui reste prévu,
  de demain à la dernière récolte attendue, se présente à part ;
- **écart** : `objectif cumulé − (irrigation réelle + pluie réelle)`, positif
  en déficit ;
- **ET0** de la période, pour information seulement, à côté, jamais dans une
  formule (D-010).

Les cumuls observés s'arrêtent à aujourd'hui. Ce qui est à venir — l'objectif
jusqu'à la fin attendue, une implantation seulement planifiée — se présente
comme prévu, jamais mêlé à l'observé. Une série dont l'implantation est
planifiée et non cochée est signalée « implantation planifiée ». Rien n'est
attribué après la dernière semaine de récolte (D-022, règle 1).

Aucune valeur dérivée n'est stockée : les cumuls par série sont une
projection, recalculée à la lecture depuis l'historique par planche et les
périodes d'occupation — exactement comme les cumuls par jardin le sont déjà.

La vue « Par périmètre » de l'historique, qui cumule par jardin, parcelle ou
ferme, applique la même règle à la pluie depuis le 9 octobre 2026 (D-032,
point ouvert 11) : zéro sur les planches d'un jardin sous abri, la pluie du
périmètre pondérée par la surface de ses planches. Un périmètre entièrement
sous abri lit 0 mm, explicite et complet, quelle que soit la météo ; un
périmètre mixte lit la pluie extérieure au prorata de sa surface de plein
champ. L'écart à l'objectif suit. Elle applique aussi la règle de l'objectif
cumulé ci-dessus depuis le 9 octobre 2026 (D-036, point ouvert 39) : objectif
sommé sur les journées-planche couvertes, pondéré par la surface des planches,
jamais « indisponible » dès qu'une journée-planche l'est ; le nombre de
journées-planche couvertes est affiché. Elle compte aussi un objectif à partir
de son jour de pose, comme ci-dessus et comme le tableau des besoins (D-039,
point ouvert 40, 9 octobre 2026).

## Cas limites

Tous rencontrés sur la ferme le 26 septembre 2026 ; chacun a une réponse
écrite, aucune n'est un zéro silencieux. Deux cas sont **ignorés** à la
demande du porteur (D-022, règle 3) : ignoré veut dire ni cumul ni affichage,
mais compté par le connecteur, pour que le journal et les tests le voient.

| Cas | Constaté | Réponse |
| --- | --- | --- |
| Série sans tâche de semis direct ni de plantation | 11 séries (dix « Radis long rose PC », une achillée) | **Ignorée** : aucune période, aucun cumul, aucun affichage ; comptée |
| Série « en bloc » (`use: block`), posée sur un jardin entier | 2 séries d'endives, aucun emplacement | **Ignorée** : hors périmètre, aucun affichage ; le plan ne connaît pas les planches de remplissage ; comptée |
| Intervention à `fqn` nul | 16 sur 21 | Ignorée pour l'implantation ; ni semis ni plantation chez le porteur |
| Tâche de semis ou de plantation sans mise en culture | présent | Vaut pour toutes les mises en culture de la série |
| Emplacement dont la planche est absente du plan de la saison | 0 sur 397 | Ignoré, compté et signalé, sans invalider les autres |
| Emplacement sans série (`series: null`, intervention hors série) | 0 sur 397 | Ignoré : rien à suivre |
| Série pérenne (`cycle: perennial`) | 5 | Une période par saison, de son implantation ou du 1er janvier de la saison à sa dernière récolte ; à revoir quand une pérenne aura une deuxième saison |
| Planche portant plusieurs séries la même semaine | fréquent | Chacune reçoit la totalité des millimètres (règle invariante) |
| Largeur de planche inconnue, ou passe-pied inconnu pour une aspersion | possible | Pondération impossible, millimètres par planche affichés sans moyenne |
| Planche irriguée en aspersion et en goutte-à-goutte dans la même période | possible | Chaque irrigation compte avec la surface de son propre matériel |
| Semaine d'implantation postérieure à aujourd'hui | possible en début de saison | Période vide pour l'observé ; la série est « à venir » |
| Série sans aucune semaine de récolte, réalisée ou attendue | aucune sur la ferme | Fin inconnue : la série est « en cours » jusqu'à aujourd'hui, et le dit (ajouté le 29 septembre 2026) |
| Irrigations d'une série enregistrées sous la saison précédente | aillet implanté en novembre 2025 | Lues par instants, toutes saisons confondues, toujours pour le seul propriétaire (ajouté le 29 septembre 2026) |

## Lecture et cache

La lecture des séries s'ajoute à l'instantané saisonnier existant
(`docs/otf-contract.md`) et en suit les règles : atomique — rien ne remplace
le cache tant que tout n'est pas valide —, récente pendant quatre heures,
forçable par « Actualiser », isolée par utilisateur et par saison, jamais de
jeton dans le cache.

Coût d'une lecture complète, avec des pages de 500 : une page d'interventions,
une de séries, une d'emplacements, et **treize de tâches** — 6 095 tâches
toutes saisons confondues, le filtre `season` étant ignoré. Seize requêtes,
à 250 ms d'écart : quatre secondes. Le plafond du connecteur, cinquante pages
par route, laisse la marge de 25 000 tâches ; au-delà, la lecture est
**refusée et signalée**, pas tronquée. Une lecture par semaine
(`doneWeek`/`plannedWeek`) demanderait plus d'appels pour moins de sûreté ;
une lecture par série en demanderait 254. La reprise par `afterId` est une
optimisation possible, pas une exigence.

Le connecteur ne conserve des tâches que ce qui sert : identifiant, série,
mise en culture, `fqn` de l'action, semaine planifiée, semaine réalisée,
statut. Ni description, ni temps, ni récolte, ni fertilisation.

Le mode simulé (`OTF_DATA_SOURCE=mock`) fournit des séries, emplacements et
tâches de démonstration cohérents avec les planches de démonstration, dont
une série sans implantation, une série en bloc et une succession sur une
même planche : les parcours navigateur en ont besoin.

## Persistance

Aucune table métier nouvelle. L'instantané OTF (`otf_snapshots`) porte les
séries, emplacements et tâches retenues, sous la même clé d'utilisateur et de
saison, dans le même remplacement atomique. Les périodes d'occupation et les
cumuls par série sont dérivés à la lecture et **jamais stockés**.

Les irrigations d'une série se lisent par les instants de sa période, toutes
saisons confondues — sa période peut commencer l'année précédente —, jamais
au-delà du propriétaire (ajouté le 29 septembre 2026).

L'historique reste immuable (D-006) : une irrigation conserve son instantané
par planche. L'attribution aux séries est une projection sur cet historique :
si le porteur déplace une série ou coche un semis après coup dans OTF, les
cumuls par série changent à la prochaine lecture, l'historique par planche
non. C'est voulu — la série n'est pas un fait de l'irrigation, c'est une
lecture du plan de culture.

## Interface

Une vue **« Séries »** dans l'écran des cumuls et de l'historique (2.9), à
côté des vues par ferme, parcelle, jardin et planche :

- une ligne par série : nom, espèces, semaine d'implantation avec sa nature
  (semis ou plantation, réalisée ou planifiée), dernière récolte, planches et
  linéaire, puis irrigation réelle, pluie réelle, objectif cumulé, écart, ET0 ;
- les séries **à venir** dans un groupe séparé, avec leur motif, jamais
  mêlées aux cumuls ; les séries sans implantation et en bloc n'apparaissent
  pas (D-022, règle 3) ;
- le détail d'une série : ses planches, et pour chacune ses millimètres sur la
  période ;
- l'export CSV existant gagne la colonne série ;
- même exigence qu'ailleurs : lisible à 390 px, aucun défilement horizontal.

Rien ne s'écrit dans OTF, ni depuis cette vue ni ailleurs.

## Décisions du porteur

Les trois premières sont prises le 26 septembre 2026 (D-021), les cinq
suivantes le 28 septembre 2026 (D-022). Le contrat est validé.

1. ✅ La période se recalcule depuis les tâches, plutôt que lue dans OTF.
2. ✅ Semis direct ou plantation, la plus précoce ; `fqn` nul ignoré.
3. ✅ Semaine réalisée si cochée, sinon planifiée.
4. ✅ La fin de période est la dernière semaine de récolte, réalisée sinon
   attendue : une culture ne reste pas en place après sa dernière récolte.
5. ✅ La surface mouillée dépend du matériel : planche et passe-pied en
   aspersion, planche seule en goutte-à-goutte, chaque irrigation selon son
   propre matériel. **La règle vaut aussi pour les planches** : alignement
   préalable, chantier séparé (roadmap, 5.0).
6. ✅ Les séries sans implantation et les séries en bloc sont ignorées :
   ni cumul, ni affichage.
7. ✅ Deux séries présentes la même semaine sur une planche reçoivent chacune
   la totalité de ses millimètres — application de la règle invariante.
8. ✅ Les tâches sont lues en entier, toutes saisons, treize pages, plutôt
   que série par série, sous la limite de quatre appels par seconde du
   connecteur, qui n'a pas d'exception.

## Hors périmètre

Les paramètres culturaux — type, stade, coefficient, sensibilité — et tout
besoin qui en découlerait ; le planning par série, qui appartient au cadrage
3.5.0 ; toute écriture vers Ouvre ta ferme ; les séries en bloc ; une
répartition des millimètres entre séries ; les récoltes et les temps de
travail, lus mais non conservés.

## Preuve de fin

1. **Tests unitaires** du domaine : la règle d'implantation sur les trois
   séries réelles du 26 septembre, la fin de période à la dernière récolte,
   le chevauchement de deux séries, la série sans implantation ignorée, la
   tâche sans mise en culture, la surface mouillée selon le matériel (avec
   et sans passe-pied, passe-pied inconnu), la pondération multi-planches,
   les bornes de période en `Europe/Paris`.
2. **Tests du connecteur** : liste blanche étendue et rien d'autre, unités,
   refus d'une lecture au-delà du plafond, filtre `season` non utilisé sur
   les tâches, tâches réduites aux champs retenus.
3. **Tests de persistance** (Q2) : instantané étendu, isolation par
   utilisateur et saison, remplacement atomique.
4. **Parcours navigateur** (Q5) : la vue « Séries » sur les données de
   démonstration, aux deux largeurs, avec son groupe « à venir », et
   l'absence de la série sans implantation et de la série en bloc.
5. **Recette réelle** sur la ferme : les cumuls de trois séries comparés à
   la main aux cumuls des planches qu'elles occupent, et la période de
   chacune comparée à celle qu'affiche Ouvre ta ferme.
6. Registres à jour ; ce contrat corrigé de ce que la recette aura appris.

**Recette réelle passée le 29 septembre 2026** (`docs/recette-series.md`) :
trois séries — Mâche #1, Cosmos 2, Tomates primeurs à Chloé — comparées à la
main aux cumuls de leurs planches et à la période qu'affiche Ouvre ta ferme,
sans écart ; un défaut de présentation trouvé et corrigé le jour même — la
pluie partielle d'une planche affichée comme un total. L'extension est close.
