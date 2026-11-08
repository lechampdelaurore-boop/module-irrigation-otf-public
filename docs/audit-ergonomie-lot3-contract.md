# Contrat court — audit ergonomique, lot 3 : le reste (3.8 quater)

Écrit le 8 novembre 2026, avant tout code, en Sonnet 5.5 · Moyen (travail sans code), validé par le porteur le jour même ; versé dans le dépôt avec la PR 1 du lot, et complété des précisions tranchées en codant (section 8, F52 et suivantes). Le code se fera en **Opus 5.5 · Très élevé** (ligne 3.8 quater de la roadmap, lot 3), un seul chantier de code à la fois, **après** la file en cours (#293 en ligne, puis « Non placé » replié, « Besoin par culture », #294 style). Il couvre les points **5, 6, 8, 10, 12, 13, 14** de `/mnt/project-files/audit-ergonomie/audit-ergonomie-module-2026-11-07.md`, retenus en entier par François (D-069). Chaque précision non agronomique est tranchée par l'option recommandée (mandat « option recommandée par défaut ») ; **une seule question agronomique** est posée à François (section 7). Aucune règle de calcul ne change. Rien n'est codé. Registres : décision **D-076** (proposée D-075 à l'écriture, renumérotée à l'ordre de fusion : D-074 est « Aujourd'hui » en tableau de bord, D-075 l'économie des minutes Actions), précisions **F43 et suivantes**, parcours **P31** (P30 est pris), **aucune migration** (0031 reste libre).

Logiciel **multi-fermes** : chaque bloc se construit à partir des fonctionnalités cochées (D-067) ; les chiffres de l'audit (65 planches, 78 espèces, 6 abris) sont des exemples, pas des règles.

## 1. Livraison en trois PR, une à la fois

| PR | Points | Fichiers principaux (état de `main` au 8/11) | Dépend de |
| --- | --- | --- | --- |
| 1 · Planning et Arrosages | 5, 6 | `planning/weekly-plan-view.tsx`, `irrigation-event-manager.tsx`, `irrigation-feasibility-dashboard.tsx` | « Non placé » replié (autre PR) : **rebaser dessus**, ne pas le refaire |
| 2 · Les gestes par ligne | 12, 13, 10 | `crop-water/crop-coefficients-panel.tsx`, `soil-reserve/soil-gauge.tsx` et `soil-bed.tsx`, `weather-alerts-panel.tsx` | « Besoin par culture » (résumé à droite) pour le point 12 si même fichier |
| 3 · Mots simples et accessibilité | 8, 14 | `crop-water/*` (textes), `equipment-inventory.tsx`, `shell/` | #294 style (aucun conflit attendu : tokens seulement) |

**Regroupement (minutes Actions comptées)** : le moins de PR possible ; la PR 1 est la première PR de code et **consigne le déploiement de #299** (ETAT, ROADMAP, CHANGELOG). Les PR 2 et 3 peuvent être fusionnées en une seule si la relecture reste raisonnable. Chaque PR : tests du domaine ou du rendu, un parcours (P31 en trois étapes a/b/c), `lint`, `typecheck`, `test`, `build`, `knip`, `push:check`, `weather:check`, `e2e` collés ; recette à 390 px et à 1 440 px sur la version déployée ; registres dans la même PR.

## 2. Ce qui ne change pas

Moteur, planificateur, seuils, objectifs, données ; la page « Aujourd'hui » et la zone « Fiabilité » du lot 2 (leurs liens se branchent sur les gestes ci-dessous, sans les modifier) ; la charte et le menu.

## 3. PR 1 — Planning (point 5) et Arrosages (point 6)

**Point 5, planning : l'action contre le bruit.**
1. Les cartes de tête du planning : « À valider », « Faites », « En retard » (le gros chiffre est ce qui demande un geste, plus « Propositions 0 »). « Refusées » et « expirées » passent en détail sous la carte.
2. « Non placé » (déjà replié par la PR « Non placé ») est **regroupé par motif** ; le premier groupe est le plus gros. Le motif « aucun matériel ne l'arrose » devient une **action en tête** : « 38 planches n'ont aucun matériel : les rattacher » → lien vers Matériel (jamais présenté comme un manque d'eau). Le « Manque d'eau » reste une ligne séparée.
3. Vocabulaire : « R13 », « arbitrage », « Non placé » sont remplacés dans les libellés visibles par des phrases (« réglage plus large que la planche », « choix entre deux demandes d'eau », « Sans matériel »). Les identifiants internes restent dans les registres et les infobulles « pour les experts ».
4. Jours écoulés repliés : **déjà fait au lot 2 (cas 17)**, on ne le refait pas.

**Point 6, arrosages : un message en clair et des gestes rangés.**
1. **Aucun matériel présélectionné** à l'ouverture du formulaire de calcul : pas de cadre rouge tant que l'utilisateur n'a rien choisi.
2. Message de faisabilité en phrase d'action : « La pompe ne peut pas alimenter ce matériel en plus des autres : il manque 0,26 m³/h. Raccourcissez, décalez ou changez de pompe », avec **un bouton qui applique la solution déjà calculée** quand le moteur en propose une (sinon, pas de bouton). Le calcul de faisabilité ne change pas, seul le texte.
3. Liste des irrigations : bloc « À traiter » en tête (les « Non faite » et « En retard »), puis liste compacte **par jour** (une ligne = heure, matériel, volume, état) au lieu de cartes identiques ; la carte complète s'ouvre au toucher.
4. **« Annuler » rangé dans un menu « … »** de la ligne, avec la confirmation existante. « Démarrer maintenant » et « Modifier » restent visibles.
5. **« Fait comme prévu » en un geste** (idée n° 1, F4 du lot 2) sur les lignes « À traiter » et sur la page « Aujourd'hui » (blocs b et c) : il enregistre l'irrigation comme **réalisée avec le volume et la durée prévus**, en **reprenant `lib/domain/done-as-planned.ts`**, la fonction de domaine commune créée par la refonte de la page « Aujourd'hui » pour son bouton « Tout est fait » (contrat `/mnt/project-files/aujourdhui-tableau-de-bord/contrat-tableau-de-bord.md`, §3.4 : enregistrer une irrigation planifiée passée comme réalisée, à l'heure, la durée et la dose prévues). **Le lot 3 ne la refait pas** ; il ne fait qu'ajouter l'appel pour une ligne. Le lot 3 démarre après #300 (économie de minutes CI). Garde-fous (François veut qu'on l'empêche de faire des erreurs) : une confirmation d'une ligne qui répète le volume et l'heure et **dit que l'enregistrement ne se corrige pas dans le module** (une irrigation réalisée est immuable, D-006), jamais proposé pour une ligne future ni pour une irrigation déjà démarrée.

## 4. PR 2 — Les gestes par ligne (points 12, 13, 10)

**Point 12, espèces sans référence en tête.** Dans la correspondance des espèces : les espèces « Sans référence Kc » en premier, recherche par nom, phrase de conséquence (« Sans référence : le besoin n'est pas calculé, seul votre objectif compte »), compteur corrigé (« 3 espèces à rattacher sur 78 » au lieu de « 78 rattachées sur 78 » quand le compte est faux). Le bouton « Rattacher comme… » propose **une** référence d'après le nom **seulement parmi les références déjà du jeu commun** (même famille de mots) ; l'utilisateur confirme toujours, rien n'est rattaché seul. Cela ne fait aucun choix agronomique à sa place.

**Point 13, réserve du sol.** Un bouton **« Observer »** sur chaque ligne « inconnue » (jardin ou abri), qui ouvre la jauge de cette zone (la zone « Fiabilité » y mène déjà). Les lignes de jardins au pourcentage identique et même date d'observation sont rangées en une phrase (« Tous les jardins de plein champ : 50 %, observé hier ») dépliable.

**Point 10, alertes météo.** Écran vide : trois modèles en un clic (voir la question de la section 7 pour les valeurs), modifiables avant l'enregistrement ; l'état des notifications **de cet appareil** (activées ou non) visible sur la page, avec le geste pour les activer ; le long paragraphe sur le gel de l'air à 2 m passe en repli. Les modèles ne s'affichent que tant qu'il n'y a aucune alerte. Valeurs par défaut propres à l'exploitation (région), jamais codées en dur pour la ferme de François.

## 5. PR 3 — Mots simples (point 8) et accessibilité (point 14)

**Point 8, vocabulaire.** « Besoin par culture » : titre « Besoin en eau par culture », phrases en clair en tête ; « CRIIAM Sud · escalier · jeu commun », « FAO-56 · trapèze », la formule ETM et « Lissage des passages de stade » passent dans un repli **« Pour les experts »** (le contenu reste identique). Les quatre mini-formulaires K_abri (Tunnel 1 à 4) deviennent **un seul tableau**. Matériel : le nom du réglage et le nombre de planches couvertes sont séparés visuellement ; « Chevauchements » et « Cumul maximal » reçoivent une ligne de sens (« planches arrosées par deux matériels : sans souci si c'est voulu »). Le résumé à droite de « Besoin par culture » (François, 8/11) est conservé tel quel.

**Point 14, accessibilité.** Lien « Aller au contenu » en début de page (visible au clavier) ; toute cible ≥ 44 px (les huit éléments et les F22 restants du lot 2 : champs de 38 à 40 px, segments de période de l'historique, « Saisir la pluie », plis, boutons d'archive et de suppression du matériel) ; **contraste mesuré** des petits textes gris sur fond vert pâle avec un contrôle automatisé (ratio ≥ 4,5:1), correction des jetons qui échouent ; **mode sombre et lecteur d'écran : non vérifiés par le lot**, dits tels quels dans la PR (hors périmètre de l'audit).

## 6. Cas chiffrés (la preuve de fin les met en tests)

| Cas | Entrée | Attendu |
| --- | --- | --- |
| 1 | 3 irrigations « Non faite », 0 proposition | cartes de tête : À valider 0 · Faites n · En retard 3 |
| 2 | 38 planches sans matériel, 2 sans eau | « Non placé » : groupe « Sans matériel (38) » en tête avec le lien Matériel ; « Manque d'eau » à part |
| 3 | ouverture du formulaire de calcul | aucun matériel choisi, aucun cadre rouge |
| 4 | pompe 8,26 pour 8 m³/h | phrase d'action avec « il manque 0,26 m³/h » ; bouton seulement si une solution est calculée |
| 5 | 28 irrigations sur 6 jours | « À traiter » en tête, puis une ligne par irrigation, groupées par jour |
| 6 | « Annuler » | rangé dans « … », confirmation inchangée |
| 7 | « Fait comme prévu » sur une ligne passée | confirmation d'une ligne ; irrigation réalisée au volume et à la durée prévus ; absent sur une ligne future ou déjà démarrée |
| 8 | 78 espèces dont 3 sans référence | les 3 en premier, compteur « 3 à rattacher sur 78 », recherche par nom |
| 9 | « Rattacher comme… » | une proposition d'après le nom, confirmation obligatoire, aucune écriture sans elle |
| 10 | 6 abris « inconnue » | un bouton « Observer » par ligne ; 11 jardins à 50 % rangés en une phrase |
| 11 | aucune alerte météo | trois modèles modifiables, état des notifications de l'appareil ; avec une alerte, plus de modèles |
| 12 | page « Besoin par culture » | titre en clair, repli « Pour les experts », un seul tableau K_abri |
| 13 | toutes les pages | « Aller au contenu » au clavier ; aucune cible < 44 px ; contraste ≥ 4,5:1 |
| 14 | autre ferme, autre utilisateur | aucune donnée d'une autre ferme (isolation, comme `tests/db`) |

## 7. Question réservée à François (agronomique, 1 sur 1) — TRANCHÉE le 8 novembre 2026 à 12 h 07 : « Oui, ces valeurs » (gel < 3 °C, chaleur > 33 °C, pluie > 15 mm, 3 jours, modifiables). Plus aucune question ouverte.

**Valeurs des trois modèles d'alerte météo.** Je propose les valeurs de l'audit : « Gel : moins de 3 °C », « Forte chaleur : plus de 33 °C », « Pluie : plus de 15 mm », horizon 3 jours, modifiables, et à adapter par région plus tard. Le gel suit votre règle (un seul seuil, stades ignorés). Est-ce que ces trois valeurs vous conviennent, ou en voulez-vous d'autres ? Tant que vous n'avez pas répondu, le code prend ces valeurs.

## 8. Précisions tranchées par la recommandation (F43 et suivantes)

| N° | Précision | Choix |
| --- | --- | --- |
| F43 | « Fait comme prévu » : fonction | `lib/domain/done-as-planned.ts` (« Tout est fait », §3.4 du contrat du tableau de bord), jamais une seconde ; confirmation d'une ligne qui rappelle l'immuabilité (D-006) |
| F44 | Rattachement automatique des espèces | jamais ; une proposition par nom, confirmée |
| F45 | « Annuler » | menu « … », confirmation inchangée |
| F46 | Application automatique de la solution de faisabilité | un bouton qui remplit le formulaire, jamais d'enregistrement sans clic |
| F47 | Liste des irrigations | par jour, compacte, ligne ouvrable en carte |
| F48 | Ancien vocabulaire (R13, arbitrage) | gardé dans les registres et les infobulles « experts » |
| F49 | Contraste | contrôle automatisé en test, ≥ 4,5:1 |
| F50 | Lecteur d'écran, mode sombre | non vérifiés, dits tels quels |
| F51 | Ordre des PR | 1 puis 2 puis 3, une à la fois, chacune fusionnée après le déploiement vérifié de la précédente |

### Précisions de la PR 1, tranchées en codant (D-076)

Le planning et la page « Arrosages » ont demandé dix précisions de plus, non agronomiques, tranchées par l'option recommandée (mandat « option recommandée par défaut ») ; elles restent modifiables à la relecture du porteur. Aucune ne touche un calcul.

| N° | Précision | Choix retenu (recommandé) |
| --- | --- | --- |
| F52 | Le mot « Non placé » | « Planches non servies (n) », le mot de la tuile de tête, pour le pli et son titre ; « Sans matériel (n) », « Manque d’eau (n) », « Plus de plage horaire (n) »… pour les groupes, chacun avec son tableau ; le premier groupe est le plus gros, à taille égale l'ordre des motifs du moteur ; une planche sans motif se range dans « Servies en partie, faute de place » |
| F53 | « En retard » sur le planning | la validée lit son irrigation telle qu'elle est (heures peut-être modifiées sur « Arrosages », minuteur, annulations), par une jointure en lecture seule, sans migration ; la règle est celle de la page des arrosages (`plannedIrrigationLateness`, tolérance R14) ; sans irrigation retrouvée, pas de retard. « Faites » compte les réalisées et les partielles (« dont n en partie »), sur les validées vivantes ; « Refusées » et « expirées » passent en détail sous « À valider » |
| F54 | Le bouton de la solution (point 6.2, F46) | le moteur ne calcule aujourd'hui aucune solution (ni durée, ni heure, ni pompe qui conviendrait) : la phrase dit quoi faire (« Raccourcissez, décalez ou changez de pompe », ou « Changez de pompe ou de réglage » pour un matériel seul trop gourmand), le détail chiffré en dessous, et **pas de bouton**, comme le prévoit le point 6.2. Une irrigation réalisée s'enregistre toujours, son dépassement dit au passé |
| F55 | « Recalculer le plan » sur « À traiter » | une seule fois, dans l'en-tête du bloc, quand le planning est coché ; pas sur chaque ligne |
| F56 | Les irrigations partielles | rangées à leur jour, à l'heure de leur début réel, état « Partielle », « Reprendre le reliquat » visible et « Annuler le reliquat » dans le menu « … » |
| F57 | Où paraît « Fait comme prévu » | seulement là où `lib/domain/done-as-planned.ts` l'accepte : planifiée, jamais démarrée, son heure de fin prévue passée. En pratique, les lignes « Non faite » ; une « En retard » le reçoit une fois sa fin passée. Sur « Aujourd'hui », sur les lignes des blocs « En retard » et « À faire » que la même règle accepte, à côté de « Tout est fait (n) » |
| F58 | La confirmation | une fenêtre d'une ligne : « Enregistrer comme faite Goutte-à-goutte B · Réglage 1, hier de 7 h à 8 h 30, 0,60 m³ ? Elle ne se corrigera plus dans le module. » ; un volume inconnu se dit « volume inconnu », jamais zéro (D-003) ; « Ne rien enregistrer » ferme sans rien écrire, « Enregistrer comme faite » écrit par l'action de « Tout est fait », qui rejuge au serveur |
| F59 | Les codes des règles | gardés dans l'infobulle « Pour les experts : R13, D-025 » de la cellule « Motif » et dans les registres ; « arbitrage » devient « choix entre (deux) demandes d’eau » dans les libellés visibles, et reste nommé dans la bulle d'aide, pour les experts |
| F60 | La ligne et sa carte | une ligne : heure, matériel, réglage et durée prévue, volume, état ; « Voir la fiche » déplie la carte entière (dates, durées, note, retard, pompe, planches), ouverte d'elle-même quand un lien y mène (« Ouvrir » sur « Aujourd'hui ») ; le menu « … » se ferme à Échap, au clic ailleurs et après un choix ; chaque cible à 44 px |
| F61 | Le formulaire sans présélection | la liste du matériel s'ouvre sur « Choisissez un matériel » ; la pompe suit le matériel choisi (sa pompe habituelle), aucune avant lui ; la phrase « Choisissez un matériel : l’apport et la faisabilité se calculent ensuite. » tient la place du calcul ; enregistrer sans matériel est refusé avec « Choisissez un matériel avant d’enregistrer une irrigation. » |

## 9. Risques

- **Conflits de fichiers** avec les PR en file : « Non placé » replié (`weekly-plan-view.tsx`), « Besoin par culture » (`crop-coefficients-panel.tsx`), #294 (CSS). Le lot 3 démarre sur `main` à jour après leur fusion ; sinon rebaser.
- **« Fait comme prévu »** écrit une donnée réelle : c'est le seul geste du lot qui modifie la ferme ; garde-fous du point 6.5, test d'isolation, jamais en recette sur la ferme réelle sans le « vas-y général » de François et remise en l'état.
- **Taille de la PR 1** : si elle dépasse une relecture raisonnable, séparer 6.5 (« Fait comme prévu ») en une PR 1 bis.
- Non vérifié ici : le code des écrans n'a été lu que pour y situer les fichiers ; les lignes exactes se relisent en ouvrant la PR.
