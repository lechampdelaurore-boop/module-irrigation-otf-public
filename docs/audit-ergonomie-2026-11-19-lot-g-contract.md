# Contrat court — audit ergonomique du 19 novembre 2026, lot G : le module vous répond (24 quindecies)

Écrit le 19 novembre 2026, avant tout code, en Opus 5.5 · Élevé (la ligne
24 quindecies de la roadmap), après le correctif de la météo (24
quaterdecies). Il couvre les constats **n° 1, n° 9, n° 7, n° 8 et n° 6** du
rapport `audit-ergonomie-2026-11-19.md`, retenus par le porteur le
19 novembre 2026 à 11 h 39. Deux réponses du porteur s'y appliquent : la
quantité proposée d'office est la dose de la proposition du jour pour ce
matériel, sinon un champ vide (11 h 37) ; une quantité qui dépasse
l'objectif de la semaine d'une planche demande une confirmation (11 h 42).
Le porteur est en autonomie totale depuis 11 h 44 : chaque autre précision,
aucune agronomique, suit l'option recommandée du rapport et reste
modifiable par lui. Aucune règle de calcul ne change ; aucune migration.
Logiciel multi-fermes : les règles visent un geste, jamais une ferme.

Registres : décisions **D-167 et suivantes**, précisions **F404 et
suivantes**, parcours **P37** (P36 est le dernier).

## 1. Livraison en cinq PR, une à la fois

| PR | Point | Fichiers principaux | Preuve |
| --- | --- | --- | --- |
| 1 · Le module répond à côté du bouton | n° 1 | `irrigation-event-manager.tsx`, `irrigation-manager/irrigation-form.tsx`, `water-management-dashboard.tsx`, `irrigation-needs-dashboard.tsx`, une fenêtre de confirmation du module, `irrigation-event-actions.ts`, `db/irrigation-event/conflicts.ts` | P37 (390 et 1440 px), tests de la base |
| 2 · La quantité proposée | n° 9 | `irrigation-event-manager.tsx`, le chargeur d'« Arrosages », une règle de `lib/domain/` | tests du domaine, P37 étendu |
| 3 · Refuser une proposition | n° 7 | `planning/weekly-plan-view.tsx`, `planning/proposal-card.tsx`, une règle de `lib/domain/planning/` | tests du domaine, P10 et P37 étendus |
| 4 · Une seule fenêtre de confirmation | n° 8 | les sept `window.confirm`, « Tout vider », « Retirer (stocker) » | P37 étendu, parcours qui acceptaient la boîte du navigateur adaptés |
| 5 · L'initiale | n° 6 | `shell/topbar.tsx`, `docs/charte-module.md` | P37 étendu (390 et 1440 px) |

Chaque PR : `lint`, `typecheck`, `test`, `build`, `knip`, `push:check`,
`weather:check`, `site:check` collés ; `e2e` joué en local sur les
parcours touchés, la suite complète par la CI de la PR ; registres dans la
même PR.

## 2. Ce qui ne change pas

Le moteur, le planificateur, les objectifs, la pluie, la répartition ; la
règle du refus (D-030 : un refus vaut pour le reste de la semaine) ; ce que
chaque bouton fait une fois confirmé ; la page « Aujourd'hui » (lot H) ; la
validation d'une proposition du planning, qui garde son simple
avertissement de créneau déjà occupé.

## 3. n° 1 — Le module répond à côté du bouton

**Cause établie dans le code.** Chaque section n'a qu'une zone de message,
en tête : « Arrosages » (`irrigation-event-manager.tsx`, au-dessus des
irrigations en cours), « Objectifs et besoins » (`water-management-dashboard.tsx`,
sous l'en-tête de la semaine) et les besoins (`irrigation-needs-dashboard.tsx`).
Au téléphone, le bouton appuyé est plus de 1 000 px plus bas. Le formulaire
d'irrigation garde tous ses champs après une réussite, son bouton reste
actif ; le serveur compte un créneau déjà planifié pour le même matériel
(`db/irrigation-event/conflicts.ts`) mais ne le dit qu'après avoir écrit
la seconde irrigation. Enfin, « Les besoins ont été recalculés » s'affiche
après chaque rechargement automatique des besoins, même quand rien n'a été
demandé à cette section.

1. **Le message d'un geste s'affiche juste sous le bouton du geste**, et
   l'écran l'amène en vue au plus près, sans sauter en haut de la page :
   formulaire « Irriguer maintenant », « Planifier », « Déjà réalisée » ;
   objectif hebdomadaire ; « Tout vider » ; pluie mesurée ; seuil minimal
   de planification ; décision d'une planche des besoins. Le message d'une
   action d'une carte des irrigations à venir s'affiche en tête de cette
   liste ; celui d'une irrigation en cours, en tête de la section, comme
   avant. Un message garde son rôle pour un lecteur d'écran (F404).
2. **Un rechargement automatique ne parle pas** : quand les besoins se
   relisent parce qu'une autre section a changé (irrigation, objectif,
   pluie), aucun message « Les besoins ont été recalculés » ; seul un geste
   fait dans la section a son message (F405).
3. **Après une réussite, le formulaire d'irrigation se vide** : matériel
   non choisi, réglage et note vides, quantité et durée remises à leur
   valeur de départ (la quantité suit le n° 9 dès sa PR) ; le
   bouton redevient indisponible tant qu'un matériel n'est pas choisi. Les
   dates restent. Vaut aussi pour « Démarrer l'irrigation » (n° 9) et pour
   la fin d'une modification (F406).
4. **Une seconde irrigation du même matériel sur un créneau déjà planifié
   demande une confirmation** dans une fenêtre du module : « Ce matériel a
   déjà une irrigation planifiée le 19 novembre, de 11 h 13 à 12 h 33. En
   planifier une seconde ? », boutons « Ne pas planifier » et « Planifier quand même »
   (« Démarrer quand même » pour « Irriguer maintenant »). Le serveur refuse
   d'écrire sans cette confirmation, et ne compte que les irrigations
   planifiées non démarrées qui chevauchent, comme l'avertissement
   d'aujourd'hui ; la confirmation donnée, il écrit et garde
   l'avertissement (F407).
5. **La fenêtre de confirmation du module** : une seule, dessinée comme
   « Fait comme prévu » (titre, phrase, deux boutons, le geste qui annule à
   gauche) ; Échap et « Ne pas … » la ferment sans rien faire ; le bouton
   de confirmation est vert pour ce qui ajoute, rouge pour ce qui efface ou
   annule (F408, repris par le n° 8).

## 4. n° 9 — La quantité proposée

**Cause établie dans le code.** `targetMillimeters` part de `'25'`
(`irrigation-event-manager.tsx`, ligne 97) quel que soit le matériel ; rien
ne compare la quantité à l'objectif de la semaine.

1. **À chaque choix d'un matériel**, en mode « Objectif en mm », la
   quantité prend la dose de la proposition du planning pour ce matériel
   le jour de l'irrigation (aujourd'hui pour « Irriguer maintenant », le
   jour de la date de début pour « Planifier »), proposée ou validée, la
   première du jour s'il y en a plusieurs ; sinon le champ reste vide.
   Planning décoché, aucune proposition : champ vide. Une quantité tapée
   par l'utilisateur n'est jamais remplacée tant qu'il ne change pas de
   matériel (F409).
2. **Au-delà de l'objectif de la semaine** : avant d'enregistrer, si
   l'apport estimé d'une planche atteinte dépasse son objectif hebdomadaire
   adopté, une fenêtre du module le dit : « 30 mm dépassent l'objectif de la
   semaine de Planche 3 (20 mm). Irriguer quand même ? » (la planche la plus
   au-delà ; « et 2 autres planches » s'il y en a). Sans objectif adopté,
   aucune fenêtre. Ce n'est qu'un avertissement : confirmé, l'arrosage
   s'enregistre (F410).

## 5. n° 7 — Refuser une proposition

1. **« Refuser » ouvre la fenêtre du module** : « Refuser ce créneau pour
   toute la semaine ? », « Ce matériel ne sera plus proposé à ces heures
   cette semaine ; le besoin sera replacé ailleurs si c'est possible. »,
   boutons « Garder la proposition » et « Refuser le créneau » (rouge)
   (F411).
2. **Après le refus, le message dit où le besoin est allé**, lu dans le
   plan recalculé : « Créneau refusé. Le besoin est replacé jeudi à 12 h 26
   (Goutte-à-goutte du champ du bas). » ; ou « Créneau refusé. Aucun autre
   créneau cette semaine : le besoin reste affiché, non placé. » La règle
   cherche la proposition nouvelle qui sert au moins une planche de la
   proposition refusée, la plus proche de son heure (F412).

## 6. n° 8 — Une seule fenêtre de confirmation, le rouge pour ce qui efface

1. **Les sept boîtes du navigateur** deviennent la fenêtre du module :
   archiver et supprimer un matériel, supprimer un réglage, supprimer un
   groupe de jardins, annuler le reliquat, annuler une irrigation
   planifiée, supprimer un créneau protégé. Leurs phrases restent (F413).
2. **Le bouton de confirmation est rouge** pour ce qui efface ou annule :
   les sept ci-dessus et « Vider les objectifs ». « Retirer (stocker) », un
   geste qu'on peut défaire, quitte le rouge sur la carte du matériel
   (contour neutre) et se confirme en vert (F414).
3. **Le même mot sur le bouton qui ouvre et dans la fenêtre** : « Tout
   vider » devient « Vider les objectifs » ; la fenêtre dit « Vider les
   objectifs de cette semaine ? » et son bouton « Vider les objectifs »
   (F415).

## 7. n° 6 — L'initiale

1. **L'initiale ouvre un petit menu** au lieu de déconnecter : le nom de
   la personne, puis « Se déconnecter », le lien de toujours. Le menu se
   ferme par Échap, par un appui ailleurs ou sur l'initiale ; sa cible
   reste de 44 px au téléphone, le dessin de l'initiale ne change pas.
   **La ligne de la charte change** : « L'initiale ouvre le menu du compte
   (nom, “Se déconnecter”) » (F416).

## 8. Cas chiffrés (la preuve de fin les met en parcours)

| Cas | Entrée | Attendu |
| --- | --- | --- |
| 1 | « Planifier », 390 px, bouton appuyé en bas du formulaire | le message sous le bouton, visible à l'écran sans défilement de l'utilisateur |
| 2 | Même matériel, même créneau, second appui après réussite | le bouton est indisponible (formulaire vidé) ; re-choisi et re-planifié : la fenêtre « … déjà une irrigation planifiée de … à … » ; « Ne pas planifier » : une seule carte dans « À venir » |
| 3 | Objectif hebdomadaire hors bornes, 390 px | « L'objectif doit être compris entre 0 et 500 mm par semaine » sous « Enregistrer » |
| 4 | Pluie mesurée enregistrée | « La pluie mesurée a été enregistrée » sous son bouton ; aucun « Les besoins ont été recalculés » |
| 5 | Matériel avec proposition du jour à 8,1 mm | quantité 8,1 ; sans proposition : champ vide, bouton indisponible |
| 6 | Quantité au-delà de l'objectif de la semaine (20 mm) d'une planche | fenêtre « … dépassent l'objectif de la semaine de … (20 mm) » ; sans objectif : aucune fenêtre |
| 7 | « Refuser » au planning | fenêtre de confirmation ; confirmée, message « Créneau refusé. Le besoin est replacé … » |
| 8 | Les sept confirmations, « Vider les objectifs » | la fenêtre du module, aucun `dialog` du navigateur ; bouton de confirmation rouge |
| 9 | L'initiale, deux largeurs | un menu avec le nom et « Se déconnecter » ; un appui sur l'initiale ne déconnecte pas |

## 9. Précisions

- **F404** le message sous le bouton du geste, amené en vue au plus près (section 3.1).
- **F405** un rechargement automatique ne parle pas (section 3.2).
- **F406** le formulaire d'irrigation se vide après une réussite (section 3.3).
- **F407** une seconde irrigation sur un créneau déjà planifié se confirme ; le serveur refuse sans confirmation (section 3.4).
- **F408** une seule fenêtre de confirmation du module, vert pour ajouter, rouge pour effacer (section 3.5).
- **F409** la quantité proposée : la dose du jour pour ce matériel, sinon vide (section 4.1).
- **F410** une confirmation au-delà de l'objectif de la semaine d'une planche (section 4.2).
- **F411** « Refuser » se confirme (section 5.1).
- **F412** le message du refus dit où le besoin est replacé (section 5.2).
- **F413** les sept boîtes du navigateur deviennent la fenêtre du module (section 6.1).
- **F414** le rouge pour ce qui efface ; « Retirer (stocker) » quitte le rouge (section 6.2).
- **F415** « Vider les objectifs », le même mot partout (section 6.3).
- **F416** l'initiale ouvre le menu du compte ; ligne de la charte changée (section 7).

Ce que le lot ne prouve pas : un vrai téléphone au soleil, un lecteur
d'écran (seule la structure est vérifiée).
