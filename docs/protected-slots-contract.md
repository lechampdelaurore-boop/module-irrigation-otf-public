# Contrat — créneaux protégés nommés

Écrit le 6 novembre 2026, avant tout code. Sous-tranche placée par le porteur le 6 novembre 2026 **juste avant la 3.9** (idée n° 9 de la comparaison avec Tlaloc, `docs/ROADMAP.md`, ordre de la section 2), parce que c'est une règle métier nouvelle et que la 3.9 a acté « aucune règle nouvelle » : elle doit pouvoir la tester. Code en **Opus 5.5 · Max** (roadmap, ordre 24) ; ce contrat est du travail sans code (Sonnet 5.5 · Moyen, AGENTS.md, « Économie de jetons »). **Les sept questions de la section 12 ont été tranchées par le porteur le 6 novembre 2026** : la question 1, la 2 et la 3 une par une (la 3 sur l'option « interdit toujours, sans exception », et non sur la recommandation), les quatre autres d'un mot (« Je suis d'accord avec toutes tes recommandations restantes »). **Code commencé la nuit du 7 au 8 novembre 2026** sur le mandat du porteur (« Cette nuit, je veux que tu enchaînes les chantiers en autonomie »), en cinq PR (section 11), chaque question tranchée par l'option recommandée : précisions en section 13 (D-071).

Le logiciel est **multi-fermes** : rien ici ne suppose la ferme du porteur, et **aucun créneau n'existe au départ** (la ferme qui n'en déclare aucun se calcule exactement comme avant). Aucun pilotage de programmateur n'est prévu.

## 1. Objet

Permettre à l'exploitant de **nommer des plages horaires pendant lesquelles aucun arrosage ne doit être planifié, quel que soit le matériel** : lavage des légumes, un autre usage de l'eau, un passage de personnes. Aujourd'hui seule la plage horaire par nature de matériel (R8) existe, et elle ne dit que quand arroser, pas quand ne pas arroser (la comparaison FRAB et le « plus tard » de la restriction datée Q10 notent le manque).

## 2. Ce qui ne change pas

- **R8 reste.** Un créneau protégé s'**ajoute** à la plage du matériel : un arrosage se place dans la plage R8 **moins** les créneaux protégés. Aucun réglage R2 à R14 ne change de sens.
- Le **moteur**, la pompe, la réserve, la limite journalière, la pénurie (R9, D-037), les priorités, l'espacement et les doses ne changent pas ; seul l'ensemble des heures où un créneau peut commencer et finir rétrécit.
- Une irrigation **déjà faite, démarrée ou saisie après coup** reste toujours enregistrable, son dépassement signalé, jamais masqué ni corrigé (AGENTS.md, règles invariantes). Un créneau protégé ne la refuse jamais.
- Une donnée inconnue reste `null` (D-003). Les dates métier sont en `Europe/Paris` et les heures sont des heures locales murales (D-004).
- L'historique est immuable (D-006) : un arrosage conserve le plan tel qu'il a été calculé.
- Le logiciel **n'annule jamais** seul (3.7) : il propose, le maraîcher décide (D-028).

## 3. Vocabulaire

- **Créneau protégé** : un nom, des jours de la semaine, une heure de début, une heure de fin, qui se répètent chaque semaine, pour toute l'exploitation.
- **Plage utilisable** d'un matériel un jour donné : sa plage R8 de ce jour, moins les créneaux protégés de ce jour (et de la veille, s'il passe minuit).

## 4. Les règles

1. **Un créneau protégé a** : un **nom** (obligatoire, non vide, par exemple « Lavage des légumes »), **un ou plusieurs jours** de la semaine (lundi à dimanche), une **heure de début** et une **heure de fin**, à la minute. Il se répète **chaque semaine** (question 2) ; il n'y a pas de date précise : la restriction datée reste Q10, hors de ce lot.
2. **Toute l'exploitation, tout le matériel** (question 1). Un créneau n'est ni par nature de matériel, ni par matériel, ni par planche. Les exceptions par matériel pourront s'ajouter plus tard sans changer cette règle.
3. **Début et fin.** Début et fin sont différents ; **une fin avant le début passe minuit** (comme R8 : aspersion 21 h – 8 h) et la plage est rattachée au **jour de son début** : « vendredi 22 h – 2 h » protège vendredi de 22 h à minuit et samedi de minuit à 2 h. Début égal à fin est refusé à la saisie (ni plage vide, ni journée entière implicite). Une journée entière se déclare 00 h 00 – 23 h 59.
4. **Plusieurs créneaux, chevauchement permis.** Autant de créneaux que l'exploitant veut ; s'ils se chevauchent, leur union est protégée. Deux créneaux de même nom ne sont pas interdits.
5. **Interdit toujours, sans exception** (question 3). Aucun créneau d'arrosage planifié ne commence, ne se poursuit ni ne se termine dans un créneau protégé, **même pour une planche prioritaire, même en pénurie**, même au dernier jour de la semaine sous la dose minimale. Un besoin qui ne tient pas ailleurs reste **non placé** (cas 8 du planning), avec le motif **« créneau protégé »** et le nom du créneau (« créneau protégé : Lavage des légumes »). Quand une autre contrainte aurait suffi à l'empêcher (espacement, plage R8, eau, pompe), c'est elle qui est nommée, comme pour un créneau refusé.
6. **Comment le placement s'y prend.** Comme pour un créneau refusé (3.7, `lib/domain/planning/refusals.ts`) : la plage utilisable est la plage R8 **découpée autour** de chaque créneau protégé qui la recouvre, même en partie ; le créneau se place dans ce qui reste, à la minute ronde après la fin du créneau protégé, ou coupé avant lui si la dose minimale y tient ; le besoin reste entier et se place ailleurs, à une autre heure ou un autre jour. La justification le dit : « après un créneau protégé » pour le moment, « ce qui tient avant un créneau protégé » pour la dose, « créneau protégé évité » comme contrainte limitante. Un créneau d'arrosage **ne se fractionne pas** autour d'un créneau protégé pour le sauter au milieu : il tient dans un morceau de plage utilisable, ou il ne tient pas (comme aujourd'hui avec R8).
7. **Réglage à l'écran** (question 5). Les créneaux se créent, se modifient et se suppriment **à l'écran, par le maraîcher, sans intervention technique**, dans le pli « Réglages du planning » (`app/irrigation/planning/`), avec **l'historique de leurs valeurs**, comme R8. Ils sont **par exploitation** (isolation par utilisateur, exploitation, saison et semaine inchangée). Le moteur les relit à chaque calcul et n'en connaît aucun en dur.
8. **Pas d'événement.** Poser, changer ou supprimer un créneau protégé est un **réglage du planning** : comme tous (règle 5 de `docs/replanning-contract.md`), il ne fait pas recalculer de lui-même et vaut **au prochain calcul** ; « Recalculer le plan » le prend tout de suite. La liste fermée des événements de la 3.7 ne change pas.
9. **Un arrosage déjà validé tombe dans un créneau protégé** (question 4) — créneau posé après coup, ou arrosage validé avant. Le moteur le traite comme la 3.7 traite une **limite posée après coup** (règles 11 et 16) : l'arrosage compte comme avant dans les besoins, l'eau, la pompe et la limite journalière jusqu'au geste du maraîcher ; le plan le **signale** (« cet arrosage tombe dans le créneau protégé Lavage des légumes ») et suggère **« Annuler »** ou **« Réduire à X mm »** selon la règle 10. Aucune annulation sans son geste ; « Garder » fait taire la suggestion jusqu'à un calcul qui en produit une autre.
10. **Réduire à la partie qui tient.** Quand la partie de l'arrosage **avant** le créneau protégé porte au moins la dose minimale de sa nature (R4), le moteur suggère **« Réduire à X mm »** (même mécanique et mêmes gardes que la 3.7, règle 14 : la durée suit la dose, la fin suit le début) ; sinon **« Annuler »**. Un arrosage qui commence dans le créneau protégé n'a pas de « partie avant » : « Annuler » seulement. Le reste du besoin se replace par une proposition ordinaire (règle 15 de la 3.7, jamais allonger).
11. **Une irrigation en cours** ne reçoit jamais de suggestion (3.7, règle 12). Une irrigation **réelle** (faite, saisie, terminée en partie) tombant dans un créneau protégé est enregistrée telle quelle ; l'historique la montre, un signal « faite pendant le créneau protégé X » se lit sur sa carte, **sans** suggestion.
12. **Ajout à la main** (question 7). « Ajouter un créneau à la main » dans un créneau protégé **n'est pas bloqué** : l'écran avertit (« ce créneau tombe dans le créneau protégé X ») et le maraîcher décide. Seul le moteur applique l'interdiction de la règle 5 ; un geste humain reste libre, comme aujourd'hui avec R8 (D-028).
13. **Rien d'autre n'est touché.** Les alertes météo, les notifications de la 3.7 (retard, calcul du matin), les arbitrages 3.4 et la réserve du sol ne lisent pas les créneaux protégés. Si un jour une notification doit éviter ces heures-là, c'est une décision séparée.

## 5. Données

Une table nouvelle, par exploitation et espace de travail, **migration additive** (prochain numéro libre au moment du code ; aucune migration existante modifiée, `docs/migrations-contract.md`) : l'identifiant, le nom, les jours (sept indicateurs), le début et la fin en minutes depuis minuit (comme `TimeWindow` de `lib/domain/planning/settings.ts`), l'état actif ou supprimé, les dates de création et de modification. L'historique garde chaque version ; la suppression est logique. Aucun créneau par défaut n'est écrit, aucune ligne existante ne change.

## 6. Architecture (rappel, rien de nouveau)

La règle vit en un seul endroit : `lib/domain/planning/` (un module nommé, par exemple `protected-slots.ts`, qui ne dépend que de `lib/domain/`), appelé par `windows.ts`. La lecture et l'écriture sont dans `db/`, jamais dans le domaine ; l'écran appelle le domaine. Aucun nombre magique d'unité : les minutes et les heures passent par `units.ts`. Les fichiers restent sous 600 lignes (`windows.ts` et `justification.ts` sont à surveiller : découper avant d'ajouter, dans une PR de déplacement sans changement, comme la PR 0 de la 3.7).

## 7. Écran

Dans le pli « Réglages du planning » : une section **« Créneaux protégés »**, une ligne par créneau (nom, jours, de H à H), « Ajouter un créneau », modifier, supprimer. Libellés en français, unités explicites. Lisible à 390 px sans débordement. Les cartes d'arrosage et la section des suggestions affichent les signaux des règles 9 à 12 avec les mêmes composants que la 3.7. Charte du module (`/mnt/project-files/charte-module/`) : l'écran n'invente aucun style hors charte.

## 8. Cas chiffrés (la preuve de fin les met en tests)

Sur la ferme de test du planning (aspersion en plage 21 h – 8 h, bloc 3 : un créneau de 2 h) :

| Cas | Entrée | Attendu |
| --- | --- | --- |
| 1. Aucun créneau protégé | calcul de référence existant | **plan identique au calcul d'avant**, octet pour octet |
| 2. Créneau en travers du soir | « Lavage », mardi 21 h – 23 h | l'aspersion de mardi commence à **23 h** et finit à 1 h mercredi (2 h) ; justification « après un créneau protégé » |
| 3. Rien ne tient | « Lavage », mardi 21 h – 8 h (toute la plage) | mardi : rien ; le besoin se place mercredi ; si mercredi est aussi pris, **non placé, motif « créneau protégé : Lavage »** |
| 4. Tout le matériel | même créneau, goutte-à-goutte (plage 6 h – 22 h) | le goutte-à-goutte évite aussi 21 h – 22 h |
| 5. Passe minuit | « Nuit calme », vendredi 22 h – 2 h | vendredi 22 h → samedi 2 h protégés ; samedi 2 h – 8 h utilisable ; **dimanche 0 h – 2 h non protégé** |
| 6. Chevauchement | deux créneaux 21 h – 23 h et 22 h – 24 h | union 21 h – 24 h |
| 7. Prioritaire en pénurie | planche haute priorité, pénurie, créneau sur toute la plage | **toujours rien** dans le créneau (règle 5) ; non placé « créneau protégé » |
| 8. Dernier jour sous la dose minimale | dimanche, reste de 2 mm, aspersion, créneau sur la plage | non placé, motif « créneau protégé » (pas de tolérance) |
| 9. Validé avant, créneau posé après | aspersion validée mardi 21 h – 23 h, créneau 22 h – 23 h posé ensuite | au calcul suivant : signalé ; partie avant = 1 h → « Réduire à X mm » si ≥ dose minimale, sinon « Annuler » ; comptée comme avant tant que le geste manque |
| 10. Validé qui commence dans le créneau | aspersion validée 22 h – 24 h, créneau 21 h – 23 h | « Annuler » seulement |
| 11. « Garder » | suggestion gardée, calcul suivant identique | elle ne revient pas ; elle revient si le créneau change |
| 12. Réel dans le créneau | irrigation saisie après coup 22 h – 23 h | enregistrée, signal « faite pendant le créneau protégé », aucune suggestion |
| 13. En cours | arrosage en cours dans un créneau protégé | aucune suggestion |
| 14. Ajout à la main | créneau manuel dans « Lavage » | accepté, avertissement affiché |
| 15. Multi-fermes | deux exploitations, un créneau chez A | **aucun effet chez B** |
| 16. Fuseau | jour de changement d'heure (octobre) | heures locales murales respectées, aucun créneau décalé d'une heure |
| 17. Besoin inconnu | planche sans besoin calculable | `null` inchangé, pas de zéro |

Tests de persistance : création, modification, suppression logique, historique des valeurs, isolation par exploitation et saison, migration additive sans toucher aux données existantes, un réglage lu sans créneau = aucun créneau. Parcours navigateur (prochain numéro libre) aux deux largeurs : créer « Lavage », recalculer, lire le plan évité et le motif, poser un créneau sur un arrosage validé, appliquer « Annuler », remise en l'état. Recette réelle sur la ferme **sur le « vas-y » du porteur**, avec remise en l'état (AGENTS.md).

## 9. Preuve de fin

Les cas de la section 8 en tests ; le plan de référence inchangé sans créneau ; contrôles de `AGENTS.md` (`pnpm lint`, `typecheck`, `test`, `build`, `knip`, `push:check`, `weather:check`, `e2e`) collés ; recette à 390 px et sur ordinateur ; registres à jour (roadmap en trois endroits, état du projet, décisions, journal des changements) ; `docs/planning-contract.md` complété d'un renvoi à ce contrat.

## 10. Hors périmètre

Restriction **datée** (Q10) ; créneaux par matériel ou par planche ; notifications évitant les créneaux ; alertes ; modèles d'arrosage enregistrés ; rôles ; tout pilotage de programmateur. Modifier la limite journalière ou R8 n'est pas dans ce lot.

## 11. Découpage proposé du code

1. Le module de domaine (union, découpe de la plage, passe-minuit) et ses tests — aucune écriture.
2. Le placement : `windows.ts` appelle le domaine ; motif, justification, non placé ; cas 1 à 8 et 16 à 17.
3. La persistance : migration, dépôt, historique, isolation ; tests de persistance.
4. Les suggestions sur les arrosages validés, le signal sur le réel (règles 9 à 11) ; cas 9 à 13.
5. L'écran, l'avertissement du geste manuel (règle 12), le parcours navigateur ; cas 14 et 15.

Une PR par lot, une à la fois, registres à jour dans chacune.

## 12. Questions tranchées par le porteur (6 novembre 2026)

1. ✅ **Portée** : tout le matériel de l'exploitation.
2. ✅ **Récurrence** : chaque semaine, par jours ; pas de dates ponctuelles dans ce lot.
3. ✅ **Force** : interdit toujours, sans exception, prioritaires et pénurie compris ; le motif « créneau protégé » nomme le créneau quand un besoin n'est pas servi.
4. ✅ **Arrosage déjà validé dans un créneau ajouté après coup** : suggestion « Annuler » ou « Réduire », comme une limite posée après coup (3.7) ; jamais annulé sans son geste.
5. ✅ **Réglage** : à l'écran, par exploitation, historisé, dans « Réglages du planning » ; plusieurs créneaux ; le nom est obligatoire.
6. ✅ **Passage de minuit** : permis, rattaché au jour du début (comme R8).
7. ✅ **Geste humain et réel** : une irrigation réelle ou un ajout à la main dans un créneau protégé n'est jamais refusé ; il est signalé.

Rappel de la question 3 : le porteur a pris « interdit toujours, sans exception » et non l'option recommandée (qui ajoutait un avertissement) ; le motif nommé dans « non placé » suffit, aucun avertissement séparé n'est ajouté.

## 13. Précisions faites en codant (nuit du 7 au 8 novembre 2026)

Le porteur dormait : chaque question non agronomique est tranchée par l'option recommandée (son mandat du 7 novembre 2026, 23 h 18), consignée ici et résumée dans D-071 ; elle reste modifiable à sa relecture.

**PR 1, le module de domaine** (`lib/domain/planning/protected-slots.ts`, `tests/planning-protected-slots.test.ts`) :

- **S1. La traduction en instants est celle de R8.** Un créneau devient des instants par la fonction des plages R8 (`windowIntervalForDay`, `windows.ts`) : le passage de minuit et le changement d'heure ne sont écrits qu'une fois. Le module est donc appelé par le moteur à côté de `windows.ts`, et non par `windows.ts` comme le proposait la section 6, ce qui ferait une boucle entre les deux fichiers.
- **S2. Le nom** perd ses espaces en trop et tient en 80 caractères au plus, comme le nom d'un matériel ou d'un groupe de jardins.
- **S3. Les jours** : un au moins ; un jour coché deux fois ne compte qu'une fois ; ils se rangent dans l'ordre de la semaine ; un jour inconnu est refusé.
- **S4. Deux créneaux qui se touchent** (l'un finit à la minute où l'autre commence) n'en font qu'un, comme deux qui se chevauchent (règle 4) ; l'union garde les noms de ses créneaux, dans l'ordre du temps, sans doublon.
- **S5. La veille compte** : un créneau du dimanche 22 h – 2 h protège le lundi 0 h – 2 h de la semaine suivante ; la semaine d'un plan lit donc aussi le dimanche d'avant.
- **S6. Un créneau impossible** (début égal à la fin, heure hors de la journée), que la saisie refuse et que la base refusera (PR 3), n'exclut rien et n'arrête pas le calcul, comme un créneau refusé illisible (D-030).

**PR 2, le placement** (`lib/domain/planning/engine.ts`, `protected-slots.ts`, `refusals.ts`, `justification.ts`, `presentation.ts`, `tests/planning-protected-placement.test.ts`) :

- **S7. Les créneaux protégés se retirent avant les refus.** Chaque plage R8 est découpée d'abord autour des créneaux protégés de l'exploitation, puis autour des créneaux refusés du matériel (D-030). Un morceau sait quel créneau protégé le borne, à l'instant près : quand un refus le recoupe ensuite, c'est le refus qui a repoussé le début ou coupé la dose, et c'est lui qui se nomme.
- **S8. Un début repoussé par un créneau protégé se nomme toujours** « après un créneau protégé », comme après un refus : c'est une décision du maraîcher. Quand la pompe, la réserve ou la limite journalière décalent encore le début, ce sont elles qui se nomment, comme avant.
- **S9. La contrainte limitante nomme le créneau**, comme elle nomme la pompe ou la réserve : « créneau protégé « Lavage des légumes » évité » ; deux créneaux réunis : « créneaux protégés « Lavage », « Passage » évités ». La règle 6 disait « créneau protégé évité ».
- **S10. Le motif « créneau protégé »** se donne quand les créneaux protégés prennent toutes les plages de la semaine qui restaient au matériel, ou quand un morceau trop court avant un créneau protégé aurait suffi sans lui, la plage R8 entière jugée (la règle du refus). Il nomme les créneaux protégés qui prennent du temps aux plages du matériel, dans l'ordre du temps : « créneau protégé : Lavage des légumes », « créneaux protégés : Lavage, Passage ». Des plages que les créneaux protégés laissent et que des refus prennent toutes se lisent « créneau refusé ».
- **S11. Le manque** d'une planche arrêtée par un créneau protégé se compte sous son motif, ni dans le manque d'eau ni dans le temps de pompage, comme celui d'un refus.
- **S12. Un plan sans créneau protégé reste celui d'avant, octet pour octet** (cas 1) : les noms ne s'ajoutent à une planche que si son motif est « créneau protégé ». Sept plans de référence de la ferme de test (ordinaire, pénurie, prioritaires, limite journalière, grande ferme, refus, irrigations validées et réelles) ont été comparés avant et après le changement : identiques.
- **S13. Le service ne passe encore aucun créneau au moteur** : la PR 3 les lira en base. Jusque-là, rien ne change sur le site.

**PR 3, la persistance** (`drizzle/0030_protected_slots.sql`, `db/protected-slots-repository.ts`, `lib/services/planning-service.ts`, `tests/db/protected-slots-repository.test.ts`, `tests/db/planning-service.test.ts`) :

- **S14. Par exploitation, sans saison.** Un créneau protégé appartient à l'espace de travail de l'exploitation et vaut toutes ses saisons, comme les réglages du planning (R2 à R14, une ligne par exploitation) et comme le dit la section 5 : une habitude de la ferme, laver les légumes le mardi soir, ne se ressaisit pas à chaque saison. Les tests de persistance de la section 8 parlaient d'isolation « par exploitation et saison » : l'isolation est par exploitation (cas 15), la saison ne sépare rien.
- **S15. L'historique garde chaque version entière** : le nom, les jours, le début et la fin tels que le geste les a laissés, avec le geste (« créé », « modifié », « supprimé »), qui l'a fait et quand, dans un journal à côté de la table des créneaux, écrit dans le même lot que le changement. Il se lit du plus récent au plus ancien ; deux versions de la même milliseconde gardent l'ordre d'enregistrement (`docs/revision-order-contract.md`). Un geste refusé (le créneau d'une autre exploitation, un créneau déjà supprimé, une valeur absurde) n'écrit rien.
- **S16. La suppression est logique et définitive** : la ligne reste, marquée supprimée ; le moteur ne la lit plus ; elle ne se modifie ni ne se supprime une seconde fois (« Ce créneau protégé est introuvable ou déjà supprimé. »). Aucune restauration dans ce lot : on recrée le créneau.
- **S17. La base refuse elle-même un créneau impossible**, même écrit sans passer par le dépôt : un nom vide ou de plus de 80 caractères, aucun jour, un jour qui ne vaut ni 0 ni 1, une heure hors de la journée, un début égal à la fin, un état inconnu. Le dépôt vérifie avant d'écrire avec la fonction que l'écran utilisera (PR 5) et rend tous les messages à la fois.
- **S18. L'ordre de lecture** : les créneaux actifs se lisent dans l'ordre de la journée (l'heure de début), puis du nom. Le moteur n'en dépend pas ; l'écran (PR 5) les montrera ainsi.
- **S19. Le service relit les créneaux à chaque calcul** (règle 8), ceux de l'exploitation du calcul seulement (cas 15), quel que soit le déclencheur : à la demande, le calcul du matin, sur événement. Lire ne crée rien : une exploitation sans créneau, ou sans espace de travail, se calcule exactement comme avant, et la migration n'écrit aucune ligne. Le calcul enregistré ne recopie pas les créneaux, pas plus que les refus : la justification et le motif enregistrés avec le plan nomment déjà le créneau évité. Les créneaux ne se saisissent pas encore (l'écran est la PR 5) : rien ne change sur le site avant elle.

**PR 4, les arrosages validés et le réel** (`lib/domain/planning/suggestions.ts`, `follow-up.ts`, `protected-slots.ts`, `lib/domain/irrigation-history/items.ts`, `lib/services/irrigation-history-service.ts`, `tests/planning-protected-suggestions.test.ts`, `tests/irrigation-history.test.ts`, `tests/db/irrigation-history-protected-slots.test.ts`) :

- **S20. Si peu qu'il y entre, l'arrosage validé reçoit sa suggestion.** L'écart de la règle 14 de la 3.7 (une dose prévue qui dépasse la dose utile d'au moins la dose minimale) ne s'applique pas : la règle 5 interdit le créneau protégé sans exception. La partie avant se juge à la dose minimale de sa nature, sans la tolérance du dernier jour (règle 5, cas 8) ; sa dose est celle de la planche de référence de l'arrosage, au prorata de la durée, comme pour une limite journalière posée après coup.
- **S21. La partie avant se compte à la minute entière inférieure** : « Appliquer » arrondit la durée à la minute, et l'arrosage réduit ne doit jamais entrer dans le créneau.
- **S22. Avec les autres raisons** sur le même arrosage (dose utile, matériel retiré, limite journalière), la suggestion se combine comme dans la 3.7 : « Annuler » l'emporte sur « Réduire », la plus basse de deux réductions l'emporte, les raisons s'ajoutent. La sienne se lit « cet arrosage tombe dans le créneau protégé « Lavage » ; la partie avant porte 6,7 mm », ou « … et y commence : rien ne tient avant ».
- **S23. « Garder »** suit la règle 17 de la 3.7 : la suggestion revient quand un calcul en fait une autre (une autre dose au dixième affiché, ou « Annuler » après « Réduire »). Un créneau changé qui laisse la même suggestion, renommé par exemple, ne la fait pas revenir : c'est ainsi que le cas 11 (« elle revient si le créneau change ») se lit.
- **S24. Le signal d'une irrigation réelle** (« Faite pendant le créneau protégé « Lavage » ») se lit sur sa carte dans l'historique des irrigations, d'après les créneaux **en vigueur à son début réel**, relus dans leur journal : un créneau posé après coup ne signale pas les irrigations d'avant, un créneau supprimé signale encore celles faites de son vivant. Seules ses périodes d'arrosage comptent, pauses exclues. L'export CSV ne change pas. Le Planning décoché, le signal ne se lit pas : les créneaux protégés sont un réglage du planning, ni affichés ni pris en compte quand sa case est décochée (3.8, R1) ; recoché, il revient, le journal n'ayant pas bougé.
- **S25. Une irrigation en cours** ne reçoit ni suggestion ni signal ; terminée, même en partie, elle reçoit le signal. La notification du calcul du matin (3.7, règle 22) compte ces suggestions comme les autres : elle lit les suggestions, pas les créneaux (règle 13 inchangée). Sans créneau protégé, le plan reste celui d'avant, octet pour octet : neuf plans de référence comparés, dont une suggestion de dose utile et des suggestions sous une limite journalière.

**PR 5, l'écran et le geste manuel** (`lib/domain/planning/protected-slots-view.ts`, `app/irrigation/planning/protected-slots-section.tsx`, `app/irrigation/protected-slots-actions.ts`, `app/irrigation/irrigation-manager/use-irrigation-preview.ts`, `db/feature-data-counts.ts`, `lib/domain/features/warnings.ts`, `tests/planning-protected-slots-view.test.ts`, `e2e/p26-creneaux-proteges.spec.ts`) :

- **S26. La ligne d'un créneau** se lit « Lavage · mardi et jeudi · de 21:00 à 23:00 », ses jours dans l'ordre de la semaine, les sept « tous les jours », une fin avant le début suivie de « le lendemain » ; les heures s'écrivent comme les plages R8 du même pli (`HH:MM`).
- **S27. Un créneau nouveau ne devine rien** : ni nom, ni jour, ni heure ; une heure absente ou illisible n'est jamais lue minuit, et la vérification du domaine dit ce qui manque, avec ses messages (règles 1 et 3), que le dépôt refait avant d'écrire.
- **S28. Supprimer demande confirmation**, comme l'annulation d'un arrosage ; la suppression reste logique et le journal la garde. « Voir l'historique des créneaux » lit chaque version, la plus récente d'abord (« Créé », « Modifié », « Supprimé »), sans nommer personne : l'auteur du geste ne quitte pas le serveur.
- **S29. Aucun geste sur un créneau ne recalcule le plan** (règle 8) : la note de la section le dit, et l'avis d'enregistrement aussi (« il vaut au prochain calcul ») ; « Recalculer le plan » le prend tout de suite.
- **S30. L'avertissement de la règle 12** se lit dans le formulaire « Planifier » seulement, à l'ajout comme à la modification d'une irrigation planifiée, dès qu'un instant de l'arrosage prévu tombe dans un créneau, même en partie : « Cet arrosage tombe dans le créneau protégé « Lavage » : le planning n'y propose jamais d'arrosage. Vous pouvez l'enregistrer quand même. » Le bouton reste actif. « Démarrer maintenant » et « Déjà réalisée » n'avertissent pas : le réel s'enregistre tel quel et sa carte de l'historique le signale (règle 11). Le Planning décoché, ni la section ni l'avertissement ne paraissent (3.8, R1).
- **S31. Décocher le Planning avertit aussi des créneaux protégés** enregistrés (3.8, R2) : « 2 plans déjà calculés et 1 créneau protégé restent enregistrés. … » ; ils restent, et valent de nouveau quand la case est recochée.
- **S32. Le parcours P26 planifie à la main** l'arrosage sur lequel il pose le créneau après coup, deux heures après son début, au lieu de valider la première proposition : celle-ci commence à la minute qui suit le calcul, et passé son début, un arrosage non démarré est « en retard » et ne reçoit plus de suggestion (3.7, règle 12). Une irrigation planifiée à la main est un arrosage validé comme un autre pour les règles 9 et 10.
