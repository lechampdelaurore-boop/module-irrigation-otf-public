# Roadmap du module Irrigation OTF

Dernière mise à jour : 8 novembre 2026. Validée par le porteur de projet le
18 septembre 2026 ; elle remplace la roadmap du 16 septembre et la roadmap Word.

Elle est construite à partir de trois sources : l'audit du dépôt du
18 septembre 2026 (`docs/audit-depot-2026-09-18.md`), le cahier des charges
simplifié et la roadmap Word du même jour. Quand ces sources divergent, l'état
réel du code l'emporte et l'écart est signalé.

Légende des états : ✅ terminé et contrôlé · 🟡 développé, recette ou
stabilisation en cours · ⛔ bloqué par une dépendance externe · ⬜ à faire ·
🔶 décision du porteur de projet requise.

Colonne « Modèle · effort » : le modèle Claude recommandé pour réaliser la
sous-tranche et le niveau d'effort à régler dans la session. Modèles, du plus
capable au plus léger : Opus 5.5, Sonnet 5.5. Le modèle Fable est interdit dans
ce projet depuis le 1er novembre 2026 (D-055). Niveaux d'effort :
Faible, Moyen, Élevé, Très élevé, Max, qui correspondent dans Claude Code à
low, medium, high, xhigh et max.

Grille révisée le 20 septembre 2026, à la demande du porteur de projet. La
version du 18 septembre plaçait Fable 5.1 sur presque toutes les lignes, faute
de recul : c'était une prudence par défaut, pas une allocation réfléchie.
Quatre critères décident désormais, et seuls ceux-là.

1. **Qui juge le résultat.** Quand les tests, le typage et la CI tranchent, une
   erreur est rattrapée dans l'heure. Quand seul le jugement agronomique du
   porteur peut trancher, une erreur passe inaperçue et fausse des conseils
   d'arrosage pendant une saison entière.
2. **Ce que coûte une erreur non vue.** Une compilation cassée est bruyante et
   sans gravité. Une règle d'arrosage fausse, ou la donnée d'une ferme visible
   par une autre, sont discrètes et graves.
3. **La liberté de conception.** Écrire un moteur depuis une page blanche
   demande plus qu'appliquer une règle déjà écrite dans un contrat.
4. **L'étendue du contexte.** Tenir cinquante modules à la fois demande plus
   que corriger un fichier sous contrat.

Le volume de modifications mécaniques n'entre pas dans la décision : des
scripts s'en chargent et les tests les vérifient. La longueur d'un document non
plus.

Il en résulte cinq cas.

- **Opus 5.5 · Max** : règle agronomique nouvelle, moteur métier, scénarios de
  pénurie. Le porteur est le seul juge et l'erreur est silencieuse.
- **Opus 5.5 · Max** : règle métier sensible, isolation des données
  entre fermes, identité. Les tests ne suffisent pas à prouver l'absence de
  défaut.
- **Opus 5.5 · Très élevé** : outillage transverse, découpage ou refonte
  large. Vérifiable par les tests, mais à contexte étendu.
- **Opus 5.5 · Élevé** : fonctionnalité délimitée sous contrat écrit,
  dépendances, corrections, configuration. Les tests et la CI jugent.
- **Sonnet 5.5 · Moyen** : documentation, registres et roadmap sans code.

Les lignes déjà terminées gardent le modèle et l'effort réellement employés :
elles sont un relevé, pas une consigne. Le 10 octobre 2026, à la demande du
porteur, Opus 5.5 et Sonnet 5.5 remplacent Opus 5 et Sonnet 5 sur les lignes à
venir ; les lignes terminées gardent le nom du modèle employé.

## 1. Où en est le projet

| Tranche | État | Constat de l'audit |
| --- | --- | --- |
| 1 · Plan physique OTF | ✅ | lecture GET-only, cache, saisons, plan ; 404 tests verts au total le 19 septembre 2026 |
| 2 · Matériels, apports et suivi | ✅ | 2.1 à 2.10 terminées, recette dans `docs/recette-tranche-2.md` ; **extension séries débloquée le 26 septembre 2026, contrat `docs/series-contract.md` validé par le porteur le 28 (D-022)** ; **prérequis 5.0 ✅ close le 29 septembre 2026, surface mouillée en aspersion alignée sur les planches, recette réelle passée sur la ferme** ; **5.1 ✅ close le 29 septembre 2026 : trois PR fusionnées et déployées le jour même, recette réelle passée sur trois séries de la ferme sans écart, un défaut de présentation corrigé (docs/recette-series.md)** |
| 3 · Ressource, faisabilité, planification | 🟡 | 3.1, 3.2, 3.3 ✅ ; **3.4 ✅ close le 25 septembre 2026, recette utilisateur entièrement passée sans défaut bloquant** ; **3.1 bis ✅ close le 25 septembre 2026, recette réelle du forage entièrement passée, trois défauts trouvés et corrigés le même jour** ; **cadrage 3.5.0 ✅ écrit et validé en entier par le porteur le 29 septembre 2026** (`docs/planning-contract.md`, D-024) ; **moteur 3.5 ✅ close par le porteur le 10 octobre 2026, développé en trois PR fusionnées le 29 septembre 2026** (#109, #110, #111) ; recette réelle faite le soir même sur la ferme (docs/recette-planning.md) : goutte-à-goutte et rampes de serre justes, pompe, réserve, plages et espacement respectés, quatre secondes de calcul ; mais sur les rampes de bloc à profil, la règle R11 sur-arrose le centre, vide la réserve et laisse trois blocs secs — **R13 tranchée le soir même (D-025) et PR de la portée ouverte** : la planche la mieux arrosée fixe la dose, une planche sous 50 % du débit ne commande pas, motifs « portée insuffisante » et « espacement », niveaux de réserve relus sur le plan fini ; PR #114 fusionnée et déployée ; **seconde recette réelle le soir même à 21 h 20** : la portée tient — un créneau de 2 h par bloc, 69 m³ pour 93 mobilisables, blocs 3, 8 et fleurs 3 servis — mais la garde de la réserve est inopérante avec un minimum de sécurité à 0 : 21 m³ tirés d'une réserve à sec la nuit de mercredi, « manque d'eau 0,00 » ; correction faite le 2 octobre 2026, PR #125 fusionnée et déployée le 3 octobre — projection non bornée par zéro jusqu'à la fin de l'horizon, raccourcissement par bissection, test des chiffres de la ferme qui échouait d'abord, carte d'un calcul antérieur datée — ; **troisième recette réelle le 5 octobre 2026** : recalcul du matin et semaine nouvelle constatés, recalcul à la demande en 2 s, refus et carte datée vérifiés, niveaux de réserve retrouvés à la main, jamais sous 0 ; la pénurie reste hors d'atteinte cette semaine, la garde n'est prouvée que par le test des chiffres de la ferme ; cinq constats au jugement du porteur (points 29 à 33) ; **quatrième recette le soir même, pénurie fabriquée** sur le mot du porteur : la garde tient sur la ferme — jamais sous le minimum, 0,001 m³ quand il vaut 0, 20,00 et 40,00 exactement quand il est relevé —, vagues décalées au rythme du forage, limite de prélèvement et limite journalière tenues, point 19 fermé ; points 29, 30 et 32 tranchés par le porteur (D-028, D-029), R1 retiré par une PR ouverte le soir même, trois constats nouveaux (points 34 à 36) ; **le 8 octobre 2026**, les quatre PR du 5 octobre fusionnées et déployées, recette du retrait de R1 faite sur ordinateur et à 390 px (point 32 fermé), point 28 fermé (101 ms sur la CI, budget du test à 500 ms, D-031, PR #144 fusionnée et déployée le soir même) ; **le 9 octobre 2026, points 33 et 35 corrigés sur le mot du porteur (PR #156 fusionnée et déployée le jour même) : la pompe nomme ce qui la tenait, l'espacement l'emporte sur la pluie, la coupe sous limite journalière porte son nom ; point 36 tranché (D-037, D-038) et corrigé le jour même, PR #158 fusionnée et déployée le jour même : chaque planche reçoit sa part en pénurie, la note du manque d'eau explique l'écart ; clôture par le porteur après sa recette du point 36 sur le site ; point 34 instrumenté le jour même sur son mot, journaux de durée du recalcul côté serveur, PR #160 fusionnée et déployée le jour même, journaux lus le soir même par l'assistant dans le Chrome du porteur sur son mot : 2,3 s par recalcul vu du navigateur, 1,0 s de serveur chronométré, aucune phase longue ni variable, le 3 s à 45 s non reproduit, cause encore à nommer, le porteur tranche le soir même d'attendre une occurrence ; recette 3.3.1 du point 4 faite le soir même sur le site par l'assistant dans le Chrome du porteur : sous abri, besoin à l'objectif seul, ET0 informative, jugement au porteur ; le 10 octobre 2026, recette du point 36 faite sur le site par l'assistant dans le Chrome du porteur, pénurie fabriquée : chaque planche reçoit sa part réservée, la dernière examinée comprise, la note du manque d'eau se trompe de cause sur un résidu d'arrondi de 0,002 m³ (point 41) ; point 41 tranché par le porteur le jour même (D-040) et corrigé, la note tolérant le résidu que le moteur tolère déjà, PR #164 fusionnée et déployée le jour même, recette sur le site faite le jour même par l'assistant dans le Chrome du porteur, la note absente ; points 4, 36 et 41 fermés par le porteur le jour même, point 34 laissé en veille, non bloquant ; 3.5 close par le porteur le 10 octobre 2026** ; **interface 3.6 ✅ close le 29 septembre 2026 : PR #112 fusionnée et déployée, recette réelle passée sur la ferme, 390 px sans débordement** ; **cadrage 3.7 : contrat écrit et validé par le porteur le 30 octobre 2026** (`docs/replanning-contract.md`, D-051), six questions tranchées d'un mot (« Je suis d'accord avec toutes tes suggestions »), **code commencé le 31 octobre 2026 en Fable 5.1 · Très élevé** : PR 0, le déplacement sans changement de la description de la contrainte limitante hors du moteur, qui touchait la limite de 600 lignes (#208, fusionnée et déployée à 02 h 02) ; PR 1 sur 5, la lecture des refus (D-030, point ouvert 31) — le service passe au moteur les créneaux refusés de la semaine, le placement les évite comme une plage horaire, le motif « créneau refusé », le cas du tunnel 4 rejoué en test —, fusionnée et déployée à 02 h 17 (#209), le point 31 se fermant après recette sur le site ; PR 2 sur 5, le recalcul sur événement (règles 4 à 10 : liste fermée des événements, calcul après la réponse, déclencheur nommé dans l'en-tête, identité des propositions reproduites, deux calculs croisés), fusionnée et déployée à 02 h 34 (#210) ; PR 3 sur 5, les suggestions sur les arrosages validés (règles 11 à 17 : dose utile, « Annuler », « Réduire à X mm », jamais allonger, matériel retiré, limite posée après coup, « Garder »), domaine et persistance, sans écran, fusionnée et déployée à 03 h 01 (#211) ; PR 3 bis, « Ce qui a changé » depuis le calcul précédent (règle 25 : propositions apparues, retirées, déplacées ou de dose changée, suggestions nouvelles, planches entrées dans « Non placé » ou sorties, écart du manque d'eau), enregistré avec le calcul, sans écran ni migration, fusionnée et déployée à 03 h 20 (#212) ; PR 4a, le retard d'une irrigation planifiée et le réglage R14 (règles 18 à 20 : « en retard » une tolérance après l'heure prévue, « non faite » le créneau passé, son eau ne change pas, jamais annulée par le logiciel ; R14 à 30 min au départ, dans le pli « Réglages du planning »), sans libellé sur la carte encore, fusionnée et déployée à 03 h 38 (#213) ; PR 4b, les deux notifications (règles 21 à 24 : l'alarme « en retard » programmée pour le début plus R14, la notification du calcul du matin sur les suggestions des prochaines 24 heures, une par calcul, jamais après un geste à l'écran, Worker inchangé), migration 0021 additive, fusionnée et déployée à 06 h 17 (#214) ; PR 5 sur 5, l'écran et le parcours P12 (le pli « Ce qui a changé », les suggestions avec leur raison et leurs deux boutons « Appliquer » et « Garder », le signal « En retard » ou « Non faite » sur la carte avec « Recalculer le plan » ; P12 aux deux largeurs : une pluie saisie et le plan recalculé seul, un refus et le besoin replacé, une limite posée après coup et la suggestion « Annuler » appliquée, remise en état ; 28 parcours), fusionnée et déployée à 06 h 39 (#215) ; **recette réelle faite le jour même sur la ferme**, dans le Chrome du porteur, sur son « vas-y » (`docs/recette-3.7.md`) : conforme au contrat, le point 31 prouvé sur le site ; trois défauts et une trace de données à son jugement — cartes « Validée » fantômes après annulation (défaut antérieur à la 3.7), message « Suggestion appliquée » fugace, « déplacée » à l'identique à la minute, pluie saisie qui ne se retire pas —, **les quatre corrigés le jour même sur son mot (« Oui, les quatre », PR #220)** : la carte d'un arrosage annulé lit « Annulée », hors du compte des validées et de leur volume, le message de la suggestion appliquée dans le bandeau de la section, « déplacée » à la minute, « Retirer la mesure » dans « Pluie mesurée » ; PR #220 fusionnée sur son mot et déployée à 12 h 14, vérification sur la ferme de 12 h 15 à 12 h 17 dans le Chrome du porteur : les deux cartes des arrosages annulés lisent « Annulée » et sortent du compte (« 0 validée », 39,52 m³ au lieu de 45,504 m³), les 3 mm fabriqués du 31 octobre retirés par « Retirer la mesure » (semaine revenue à 0,9 mm, plan recalculé à 12 h 16 « après la pluie saisie au pluviomètre »), plus aucune ligne « déplacée » à heures identiques, rien d'autre changé ; **3.7 ✅ close par le porteur le 31 octobre 2026 à 12 h 23, point 31 fermé** ; **contrat de la 3.9 ✅ écrit et validé par le porteur le 30 octobre 2026** (`docs/shortage-contract.md`, D-052) : vingt-huit scénarios de pénurie chiffrés sur la ferme de test, trois jeux de données, non-régression complète, revue de sécurité des frontières et de l'isolation, recette finale en pénurie fabriquée sur la ferme, publication et tag `v0.2.0` ; huit questions tranchées par lui le jour même (« d'accord avec tout. ») ; **code commencé le 8 novembre 2026 au soir** sur le dépôt public, une PR `fix/` par règle tranchée : correction 1 sur 4 codée, l'arbitrage validé en parts réservées (D-077) ; l'écran d'arbitrage présenté comme un plan d'assolement, décidé par le porteur le 8 novembre 2026 à 20 h 40 (D-078), suit les quatre corrections, maquette d'abord ; **3.8 commencée le 7 novembre 2026 sur le « vas-y » du porteur** : plus de mode simple ou complet, un seul mode et des fonctionnalités à la carte (D-067), **contrat écrit le jour même** (`docs/feature-selection-contract.md`) sur ses douze réponses, les autres précisions tranchées par la recommandation sur sa consigne ; codée en sept PR (#271 à #276, puis #278 pour le premier lot de ses retours en ligne) ; **3.8 close par le porteur le 8 novembre 2026**, des modifications restant possibles plus tard ; **3.8 bis, calculateur d'irrigation, codée la nuit du 7 au 8 novembre 2026** sur le mandat du porteur (D-070) : onzième case, « Calculer depuis le matériel » dans le formulaire d'un réglage, quatre exemples sourcés, étiquette de provenance (migration additive 0029), parcours P25 ; **validée par le porteur le 8 novembre 2026 à 11 h 25 en ligne (« Ok, ça me paraît réaliste. Je valide comme ça. ») ; les ajouts de réalisme proposés (pertes, sol, pompe, hydraulique) écartés par lui** ; deux défauts d'affichage corrigés ; **3.8 ter, créneaux protégés nommés, code commencé la nuit du 7 au 8 novembre 2026** sur le même mandat (D-071), en cinq PR : PR 1, le module de domaine (`lib/domain/planning/protected-slots.ts`, #282, déployée) ; PR 2, le placement, qui évite les créneaux et nomme le motif « créneau protégé » (#283, déployée) ; PR 3, la persistance (migration 0030, historique de chaque version), le service relisant les créneaux à chaque calcul (#284, déployée) ; PR 4, « Réduire » ou « Annuler » suggéré sur un arrosage validé qui tombe dans un créneau protégé, et le signal sur l'irrigation réelle faite pendant l'un d'eux (#285, déployée avec le correctif qui suit) ; le correctif du journal (#286, déployée) : une suppression refusée dans la même milliseconde que la précédente n'y écrit plus rien, défaut de la PR 3 que la CI de `main` a montré ; PR 5, l'écran : la section « Créneaux protégés » du pli « Réglages du planning », leur journal, l'avertissement de « Planifier » et le parcours P26 (#287, déployée) ; code terminé, relecture en ligne et recette réelle avec la session du porteur à son retour |
| Q · Socle qualité | ✅ | Q0 hébergement Cloudflare (**close formellement le 3 octobre 2026, site Sites supprimé, D-016 close**), Q1 gouvernance, Q2 tests de persistance, Q3 frontières outillées et Q4 dépendances ✅ (18, 19 et 20 septembre 2026) ; Q5 parcours navigateur ✅ (20 septembre 2026) ; Q6 découpage ✅ (21 septembre 2026, neuf PR). Le socle est entier : tout le code écrit à partir de maintenant est protégé dès sa première ligne ; un aléa du parcours P9 noté le 5 octobre 2026 (point 37 de l'état), clic après rechargement parti avant l'hydratation, corrigé le 8 octobre 2026, PR #145 fusionnée et déployée le soir même |
| 4 · Généralisation et intégration OTF | ⬜ | espaces isolés et `otf_farm_id` existent ; le reste est à cadrer avec OTF |
| Extension · Alertes météo paramétrables | ✅ | demandée par le porteur le 9 octobre 2026, consignée en section 5 bis ; **contrat écrit le 30 octobre 2026** (`docs/weather-alerts-contract.md`, D-050) **et validé par le porteur le jour même** (« D'accord pour tout ») : température minimale, température maximale et pluie prévues, horizon de 1 à 7 jours, une alerte par critère et par jour visé, information seulement ; **code commencé le 31 octobre 2026 sur son « vas-y »**, en Opus 5.5 · Élevé : PR 1, le domaine (#224), PR 2a, la route d'envoi immédiat du Worker Web Push (#225), et PR 2b, l'enregistrement et l'envoi (#226, migration 0022), fusionnées et déployées ; PR 3, l'encart « Alertes météo » et le parcours P13 (#227), fusionnée et déployée le 31 octobre 2026 ; **recette réelle sur la ferme validée par le porteur le 6 novembre 2026** (« Oui, c'est bon, ça marche », 09 h 18) : 5 bis ✅ ; place confirmée par lui le 9 octobre 2026 après la 3.7 et avant la 3.8 ; 18 depuis le 27 octobre 2026, la 5 ter passant devant elle, puis 19 le même jour, la 2.11 passant devant la 3.7 ; 20 depuis le 30 octobre 2026, la 5 quater et la 5 ter passant devant elle |
| Extension · Alertes météo par culture (5 quinquies) | 🟡 | **demandée le 6 novembre 2026** (idées A1 et A2 de la comparaison avec Tlaloc, aspersions à reconsidérer ajoutées le jour même) ; **contrat écrit et relu par le porteur le 6 novembre 2026** (`docs/weather-crop-alerts-contract.md`, D-058) : gel selon la culture (un seul seuil par espèce, marge de 3 ou 2 °C, curseur de microclimat), arrêt d'arrosage avant récolte, aspersions de jour sous abri à reconsidérer ; **code commencé le 6 novembre 2026 sur le mandat du porteur** (D-060), en Opus 5.5 : PR 1, le domaine (`lib/domain/crop-alerts/`, dix-neuf des vingt scénarios du contrat en tests, huit précisions consignées dans le contrat), codée le jour même ; PR 2, la persistance et l'envoi (migration additive 0026, `db/crop-alerts/`, `lib/services/crop-alerts-service.ts`, le scénario 13 en test, huit précisions consignées dans le contrat), codée le jour même ; PR 3, l'écran (l'encart « Alertes cultures » sous les alertes météo, parcours P21, huit précisions consignées dans le contrat), codée le jour même ; ces trois PR fusionnées et déployées le 6 novembre 2026 (#252 à #254) ; **recette réelle faite les 6 et 7 novembre 2026 sur son « vas-y »** (`docs/recette-5-quinquies.md`) : ses 24 légumes rattachés au jeu commun, la vraie alerte de gel du dimanche 8 novembre produite mais refusée par le service d'envoi, défaut corrigé le soir même (#258) ; l'alerte reçue ensuite sur son téléphone, mais seulement à son réveil, et le toucher n'ouvrant rien, deux défauts corrigés le soir même (#260, priorité haute, premier plan d'abord) ; à l'essai final du 7 novembre 2026, l'alerte arrive à l'heure sur son téléphone verrouillé et sonne, et le toucher ouvre le module ; jugement au porteur (D-014). Place : après la 5 ter, avant la refonte ergonomique et la 3.8 |
| Extension · Refonte ergonomique (charte du module) | 🟡 | charte du module **validée par le porteur le 6 novembre 2026** (`docs/charte-module.md`, maquettes dans `/mnt/project-files/charte-module/`), polices sous licence SIL OFL 1.1, hébergées avec leur `OFL.txt` ; **code commencé le 6 novembre 2026 sur le mandat du porteur** (D-060), en Opus 5.5, CSS seul, en trois temps : R1, les jetons, les polices hébergées, le fond, les blocs et les rayons (neuf précisions consignées dans la charte), codé le jour même, fusionné et déployé le 7 novembre 2026 (#257) ; R2, les boutons, les onglets, les tableaux et les tuiles de totaux (cinq précisions consignées dans la charte), codé le jour même, fusionné et déployé le 7 novembre 2026 (#263) ; R3, les couleurs d'état, le bleu eau et les icônes au trait (cinq précisions consignées dans la charte ; la navigation de la charte revient à la 3.8), codé le jour même, fusionné et déployé le 7 novembre 2026 (#264) ; un défaut de R3 trouvé le 7 novembre 2026 au contrôle de départ de la 3.8 et corrigé (le composant des icônes, nommé `icon.tsx`, pris par le cadre pour l'image de l'onglet de la page, que chaque page demandait en vain, erreur 404 ; renommé `line-icon.tsx`) ; **relecture visuelle du porteur le 7 novembre 2026** : lisible, mais trop proche d'avant et pas assez « OTF » (captures avant, après et aujourd'hui dans `/mnt/project-files/refonte-avant-apres/`) ; **deuxième passe, R4, décidée le jour même sur une maquette validée par lui** (D-068) : plan sans bandeau vert foncé, moins de cadres, étiquettes écrites normalement, titre de page à la taille de la charte, barre anthracite au téléphone ; CSS et habillage seulement, en Opus 5.5 · Élevé ; **R4 codée le 7 novembre 2026 au soir, juste après le déploiement de la PR 7 de la 3.8** : barre du haut commune (blanche à l'ordinateur, anthracite avec la cloche au téléphone), menu en colonne collée au bord gauche, titre à la taille de la charte avec son « ? » au trait, état des données d'OTF en une ligne, plan et planche choisie en blocs blancs, étiquettes écrites normalement, cadres dans les blocs remplacés par des fonds alternés ; chaque page comparée à la maquette aux deux largeurs ; relecture du porteur à venir. Place : après la 5 quinquies, avant la 3.8 ; R4 juste après la 3.8, avant la 3.8 bis |
| Extension · Audit ergonomique (3.8 quater) | 🟡 | **audit du 7 novembre 2026** (`/mnt/project-files/audit-ergonomie/audit-ergonomie-module-2026-11-07.md`, quatorze propositions classées) **retenu en entier par le porteur le jour même** (D-069) : les quatorze points sont décidés, pas facultatifs ; consigné en section 3.8 quater ; après la 3.8 bis et la 3.8 ter, avant la 3.9, en trois lots, le premier étant les petits points 7, 4, 9 et 11 ; **lot 1 codé la nuit du 7 au 8 novembre 2026** sur le mandat du porteur (D-072, parcours P27, #288 en ligne le 8 novembre à 04 h 29) : titre d'onglet par page et page introuvable en français, ordre naturel des listes et périmètre d'un objectif cherché et rangé par jardin, saison et commune là où elles servent, historique ouvert sur les irrigations réalisées ; **relu et validé par le porteur le 8 novembre 2026** (E4 compris : au téléphone aussi, le périmètre d'un objectif garde ses groupes par jardin et sa recherche) ; **lot 2 : contrat écrit le 8 novembre 2026** (`docs/audit-ergonomie-lot2-contract.md`, D-073, #289 en ligne) ; **PR 1 du lot 2, le téléphone, codée le 8 novembre 2026** (parcours P28, précisions F15 à F22, #290 en ligne) : barre du bas à quatre entrées et « Plus », saison dans la ligne du titre, bandeau des alertes système replié sur la cloche, planning replié, tuiles sur deux colonnes, pastilles d'aide à 44 px ; **PR 2 du lot 2, le domaine « Aujourd'hui » et « Fiabilité du calcul », codée le 8 novembre 2026** (`lib/domain/today/`, `lib/services/today-service.ts`, précisions F23 à F30, #291 en ligne), sans écran ; **PR 3 du lot 2, les écrans, codée le 8 novembre 2026** (parcours P29, précisions F31 à F42) : la page « Aujourd'hui », première du menu et page d'arrivée, ses cinq blocs et la zone « Fiabilité du calcul » avec le geste de chaque ligne, la pastille du menu en ambre ; relecture en ligne du porteur à son retour ; **retours du porteur du 8 novembre 2026** : « Non placé » replié et l'ordre de « Matériel et placement » (#295), « Besoin par culture » (#296) ; **« Aujourd'hui » en tableau de bord** (D-074, `docs/aujourdhui-tableau-de-bord-contract.md`) : maquette validée par le porteur le 8 novembre 2026, entrée de menu détachée, « Tout est fait » tel que prévu (son choix), trois PR (contrat et domaine, écrans, « Tout est fait »), la PR 1 en ligne (#297), la PR 2 (les écrans, P30) en ligne (#298), la PR 3 (« Tout est fait ») en ligne (#299) ; légende de la frise corrigée après le retour du porteur (T19 : « Non faite » en rouge, seulement les couleurs présentes) ; **lot 3 : contrat validé par le porteur le 8 novembre 2026** (`docs/audit-ergonomie-lot3-contract.md`, D-076), trois PR ; **PR 1 du lot 3, le planning et les arrosages (points 5 et 6), codée le 8 novembre 2026** (parcours P31a, précisions F52 à F61) : cartes de tête « À valider », « Faites », « En retard », planches non servies rangées par motif avec l'action vers « Matériel », formulaire sans présélection, faisabilité en phrase d'action, « À traiter » en tête puis une ligne par irrigation et par jour, « Annuler » dans le menu « … », « Fait comme prévu » (#301 en ligne) ; **PR 2 du lot 3, les PR 2 et 3 réunies (points 12, 13, 10, 8 et 14), en ligne le 8 novembre 2026** (#303 de l'archive, parcours P31b et P31c, précisions F62 à F71) : espèces à rattacher en tête avec « Rattacher comme… » confirmé, « Observer » sur une jauge inconnue et les jardins pareils en une phrase, trois modèles d'alerte et l'état de cet appareil, « Besoin en eau par culture » et les replis « Pour les experts », un seul tableau des K_abri, « Aller au contenu », cibles de 44 px au téléphone et contraste mesuré ; **lot 3 complet, validé par le porteur le 8 novembre 2026 à 19 h 20** | Opus 5.5 · Élevé pour le lot 1, Très élevé pour les lots 2 et 3 et le tableau de bord (voir le bloc 3.8 quater) |
| Extension · Connexions matériel (capteurs météo, tensiomètres, électrovannes) | 🔶 | **demandée par le porteur le 7 novembre 2026**, consignée en section 6 bis (D-063) : brancher au module une station météo locale, des tensiomètres, puis piloter des électrovannes ; **trois recherches documentaires sans code** (une par fonction) ; **C3 (électrovannes) : contrat écrit le 7 novembre 2026** (`docs/valve-control-contract.md`, D-064), le module doit piloter, confirmation du porteur à chaque ouverture, rien de codé ni acheté ; C1 et C2 : aucun réglage ni aucune méthode décidés ; l'électrovanne touche la ferme réelle : rien n'est exécuté, documents seulement. Place : après la 3.9, avant la tranche 4 |
| Extension · Banc commun de saisons rejouées avec Tlaloc, et idées sans engagement | 🔶 | **décidé par le porteur le 7 novembre 2026** (D-065, section 6 ter) : le rejeu de saisons avec Tlaloc se place **après la 3.9, en recherche** : un contrat écrit d'abord, **aucun code sans son accord** ; quatre idées rangées sans engagement (archivage des prévisions J+1, formule du tensiomètre pour C2, heures de silence des notifications, ET0 horaire). Rien n'est codé ni promis à Tlaloc | contrat : Sonnet 5.5 · Moyen ; code : à fixer au contrat, sur accord du porteur |
| Chantier · Partage des rôles avec Tlaloc et fusion des deux moteurs | 🔶 | **accord du porteur avec le développeur de Tlaloc le 7 novembre 2026** (D-066, section 6 quater) : le porteur termine la Tranche 3 (mode solo) ; Tlaloc prend l'automatisation (capteurs, électrovannes : C1 à C3 **confiés à Tlaloc**, recherches conservées) ; **avant la Tranche 4**, un chantier « fusion des deux moteurs » (comparaison fine puis synthèse en un logiciel commun, à partir du code de Tlaloc), qui absorbe le banc commun ; ergonomie : Tlaloc garde la sienne, chez nous les fonctionnalités se cochent à la connexion (intention rattachée à la 3.8). Rien n'est codé ni cadré | contrat : Sonnet 5.5 · Moyen ; code : à fixer au contrat |
| Extension · Réserve du sol (RFU) | 🟡 | **demandée par le porteur le 27 octobre 2026, contrat écrit le jour même** (`docs/soil-reserve-contract.md`, D-041) ; RFU saisie par parcelle en mm par mètre de sol (D-046, le 30 octobre 2026), la valeur de la ferme, 62 mm/m, confirmée par le laboratoire (point ouvert 42 fermé) ; jauge estimée par jardin, curseur d'observation, information seulement ; consignée en section 5 ter ; **révisée le 30 octobre 2026 sur le complément « jauge RFU » du porteur (D-047)** : consommation par l'ETM de la 5 quater au lieu de l'ET0 × coefficient, RFU du sol corrigée des cailloux (62 mm/m du laboratoire, 18 % de cailloux estimés, 51 mm/m), profondeurs racinaires de départ (ITAB) et moitié au premier stade, seuil de déclenchement par culture (formule corrigée), jours avant le seuil, dose conseillée et drainage affichés, sans toucher aux priorités (« Information seulement », choisi par lui) ; **contrat relu et validé par le porteur le 31 octobre 2026 (D-053)** : seuils sur une part de référence de 2/3 (CRIIAM), part p de la FAO-56 pour toutes les cultures, profondeurs des vingt cultures absentes de la fiche ITAB tirées d'une recherche documentaire (Geisenheim surtout), abri à la RFU de sa parcelle sans mention, curseur de parcelle limité au plein champ, jauge continue sur une planche sans culture (modèle de sol nu de la FAO-56 et six états de surface), aucun conseil d'arrosage avant plantation ; **profondeurs révisées le 3 novembre 2026 sur le complément « profondeurs racinaires par stade » du porteur (D-056)** : une profondeur par stade, règle construite à vérifier à la tarière, à la place de la moitié au premier stade ; tomate 0,65 m et courgette 0,50 m remises à leur place ; melon et asperge plafonnés à 0,60 m ; plafond de sol facultatif par parcelle ; seuils de D-053 gardés ; **seuil d'arrosage réglable ajouté le 6 novembre 2026 (D-059)** ; **code commencé le 6 novembre 2026 sur le mandat du porteur** de réaliser seul les quatre chantiers suivants de l'ordre, en choisissant l'option recommandée à chaque question (D-060), en Opus 5.5 : PR 1, le domaine (`lib/domain/soil-reserve/`, les quarante et un scénarios du contrat en tests), avec le seuil réglable (le seuil selon la culture par défaut, ou un % du plein de 20 à 80 % par pas de 5 %, 50 % proposés, réglé par l'exploitation) et dix-sept précisions faites en codant (D-060) ; PR 2, la persistance (migration additive 0025, `db/soil-reserve/`, jeu commun de 31 profils racinaires, dix précisions consignées dans le contrat), codée le jour même ; PR 3, l'écran, en trois PR : 3a, les réglages du sol (parcours P18, huit précisions consignées dans le contrat), codée le jour même ; 3b, le bloc « Réserve du sol » par jardin (jauge, prévu jusqu'à dimanche, curseur, détail d'une planche, état de surface ; parcours P19, neuf précisions consignées dans le contrat), codée le jour même ; 3c, les profils racinaires dans la page « Coefficients culturaux » (parcours P20, cinq précisions consignées dans le contrat), codée le jour même ; 3d, l'état du jour enregistré chaque matin et la dose au-delà de ce que le sol retient sur les propositions (deux précisions consignées dans le contrat), codée le jour même ; puis, sur le même mandat, la **pastille « eau arrosée en trop »** (idée 8 de Tlaloc, placée par le porteur juste après la 5 ter) : l'eau d'irrigation des sept derniers jours perdue en drainage, par planche, en mm et en m³, en tête du bloc « Réserve du sol », sept points consignés dans le contrat, codée le jour même ; ces sept PR fusionnées et déployées le 6 novembre 2026 (#245 à #251) ; **recette réelle faite le 6 novembre 2026 sur son « vas-y »** (`docs/recette-5-ter.md`) : sol de la Clémentière et observation de 50 % enregistrés sur ses réponses, cinq planches justes à la main, un défaut corrigé le soir même (« maintenant » refusé par une horloge en avance de 13 s) ; jugement au porteur (D-014), contrôle des racines à la bêche sous abri à faire par lui ; place : 18 de l'ordre le 27 octobre 2026, 19 depuis le 30 octobre 2026, après la 5 quater dont elle consomme l'ETM |
| Extension · Besoin en eau par culture et par stade | 🟡 | **demandée par le porteur le 30 octobre 2026, contrat écrit le jour même** (`docs/crop-water-need-contract.md`, D-045) à partir de son document de travail (sources CRIIAM Sud et FAO-56) ; besoin de la culture (ETM = ET0 × Kc selon la culture et son stade) et objectif hebdomadaire proposé à côté de l'objectif saisi, adopté à la main ; **relu et tranché par le porteur le 31 octobre 2026 (D-054)**, avec une recherche documentaire : dates de stade par défaut des dix-sept cultures du CRIIAM (règle stricte, mi-récolte calée sur les récoltes d'OTF, ail, oignon et fin de pomme de terre à rebours, un jeu par saison), délais de levée, calendriers fixes des cultures pluriannuelles restées sur leur planche après la récolte (exception à D-022), correspondance des 79 espèces de la ferme par espèce avec exceptions par série, K_abri 0,8, paillage × 0,9, lissage désactivé, ombrage codé désactivé ; **mode automatique non retenu** (D-010 inchangée) ; PR 0 des données de départ faite ; **code commencé le 5 novembre 2026 sur son « vas-y »**, en Opus 5.5 · Max : PR 1, le domaine (#235, `lib/domain/crop-water/`, scénarios en tests), fusionnée et déployée le 6 novembre 2026 ; deux règles du contrat tranchées par lui en codant (D-057) : un stade déclaré recale le calendrier des stades suivants, la culture reste sur sa planche jusqu'à la plus tardive de ses semaines de récolte, aussi pour la jauge de la 5 ter ; **PR 2, la persistance, codée le 6 novembre 2026** en Opus 5.5 · Élevé (#236, migration 0023, `db/crop-water/`, jeu commun de 32 cultures, dix précisions consignées dans le contrat), fusionnée et déployée le jour même ; quinze précisions du domaine validées par lui le 6 novembre 2026 ; **PR 3, l'écran, commencée le 6 novembre 2026 sur son « vas-y »**, en Opus 5.5 · Élevé, en cinq PR : 3a, la page « Coefficients culturaux » et la correspondance des espèces (parcours P14, #237, fusionnée et déployée le 6 novembre 2026) ; 3b, la fiche de la planche, l'objectif proposé à côté de l'objectif de chaque planche et son adoption, avec son origine (migration 0024, parcours P15, #239, fusionnée et déployée le 6 novembre 2026) ; 3c, les surcharges de Kc et les réglages du calcul (parcours P16, #241, fusionnée et déployée le 6 novembre 2026) ; 3d, l'ETM enregistrée chaque matin et l'avertissement de l'aspersion en début de cycle (#242, fusionnée et déployée le 6 novembre 2026) ; 3e, les durées propres à la ferme et la fiche de la série (parcours P17, #243, fusionnée et déployée le 6 novembre 2026) ; correspondance des 78 espèces de la ferme saisie le 6 novembre 2026 sur son « vas-y » ; **recette réelle faite le 6 novembre 2026 sur son « vas-y »**, en lecture seule (`docs/recette-5-quater.md`) : stades, Kc et ETM justes à la main sur quatre séries ; jugement au porteur (D-014) ; les objectifs saisis de novembre, quatre à dix fois plus hauts que le besoin calculé, sont restés à 20 mm faute d'usage ce mois-ci (le porteur, le jour même) ; sur son accord, paillage, options, durées et adoption éprouvés dans le module puis défaits ; l'ETM devient aussi la consommation de la jauge de la 5 ter (D-047) ; consignée en section 5 quater ; place choisie par lui : 20 de l'ordre le 30 octobre 2026, puis 18 le soir même, avant la 5 ter qui consomme son ETM |
| Correctif · Pose datée et stockage du matériel (2.11) | ✅ | **demandée par le porteur le 27 octobre 2026, contrat écrit le jour même** (`docs/equipment-placement-periods-contract.md`, D-043), relu et confirmé par le porteur le jour même, un message expliquant toujours le refus d'une validation (règle 14) : « Retirer la position » refusé dès qu'un matériel a arrosé (point ouvert 43), une seule position par saison sans date ; la pose devient datée, le matériel retiré est stocké, rien n'est effacé ; placée en 16, avant la 3.7, sur le « vas-y » du porteur ; **code commencé le 27 octobre 2026 sur son « vas-y » : PR 1 sur 3, le domaine (`lib/domain/equipment-placement-periods.ts`), fusionnée et déployée ; PR 2 sur 3, l'enregistrement en base (migration 0018, registre des poses, retrait devenu stockage), fusionnée et déployée le même soir (#181) ; PR 3 découpée en deux sur son mot le 29 octobre 2026 : 3a, les calculs, avec D-044 tranchée par lui (une irrigation planifiée qui ne peut pas démarrer ne compte plus dans les calculs), fusionnée et déployée le 29 octobre 2026 (#187) ; 3b, l'écran et la saisie après coup, fusionnée et déployée le même soir (#188) ; recette réelle passée le 30 octobre 2026 sur un matériel d'essai, treize vérifications conformes (`docs/recette-2.11.md`), un défaut ancien trouvé, sans lien avec la 2.11 (point ouvert 44), corrigé le jour même sur le choix du porteur dans une PR à part (#190), correction constatée sur le site le jour même, point 44 fermé par le porteur le jour même, deux écarts mineurs relevés au passage (points ouverts 45 et 46), tranchés par le porteur le jour même, tous deux corrigés le jour même ; à l'usage, un retrait daté de la minute même refusé comme futur (point ouvert 47), corrigé le jour même sur son mot ; retrait réel fait par l'écran, point 43 fermé par le porteur le jour même ; corrections des points 45 à 47 constatées sur le site le jour même, points fermés par le porteur le jour même ; close par le porteur le 30 octobre 2026, sans constat séparé de la lisibilité sur son téléphone** |

## 2. Ordre d'exécution proposé

Chaque étape se livre en branches courtes, chacune verte en CI, et se clôt
selon la règle de la section 10.

1. **3.3.1** — ✅ retirer l'ET0 du calcul du besoin, conformément au cahier des
   charges : correction d'une règle existante, tests réécrits d'abord.
   **Recette sur le site faite le 9 octobre 2026** par l'assistant dans le
   Chrome du porteur, sur son mot : sous abri, besoin à l'objectif seul,
   20 mm, l'ET0 de la semaine, 12,4 mm, affichée hors calcul ; point 4 fermé
   par le porteur le 10 octobre 2026.
2. **Q0** — ✅ hébergement pilotable sur Cloudflare : publication automatique à
   chaque fusion, connexion par Cloudflare Access, migration des données,
   abandon d'OpenAI Sites. Contrat : `docs/hosting-migration-contract.md`.
   Quatre phases exécutées les 18 et 19 septembre 2026 ; recette 3.4 close le
   25 septembre ; **site Sites supprimé par le porteur le 3 octobre 2026 :
   Q0 et D-016 sont closes**.
3. **3.4** — ✅ recette utilisateur de la faisabilité close le 25 septembre
   2026, **entièrement passée sans défaut bloquant**, en quatre séances du 20 au
   25 septembre. Partie A le 21, parties B et C le 24, groupe B6 le 25 : sa part
   mesurable est tenue par le parcours automatisé P7, le geste sur l'appareil a
   été constaté par le porteur. Deux lignes seulement, B2.2 et C2, n'avaient pas
   de cas à observer sur cette ferme à cette période.
4. **Q1** — ✅ gouvernance : règles complétées, source de vérité Git, protection
   de `main`, premier tag.
5. **Q2** — ✅ tests d'exécution de la persistance sur SQLite en mémoire.
6. **Q3** — ✅ frontières outillées : règles d'import, séparation domaine et
   services, code mort, taille maximale des fichiers.
7. **Q4** — ✅ décisions de dépendances et traitement des PR Dependabot par
   lots, closes le 20 septembre 2026.
8. **Q5** — ✅ parcours navigateur automatisés, clos le 20 septembre 2026 ;
   aléa du parcours P9 noté le 5 octobre 2026 (point 37 de l'état), corrigé le
   8 octobre 2026, PR #145 fusionnée et déployée le soir même.
9. **Q6** — ✅ découpage des fichiers concentrateurs, clos le 21 septembre
   2026. Le socle qualité est entier.
10. **3.1 bis** — mesure et historique du débit des ressources : première
    fonctionnalité développée sous le socle complet. Développée en cinq PR les
    21 et 22 septembre 2026, contrat `docs/resource-flow-contract.md` ; recette
    réelle du forage faite par le porteur puis relue ligne à ligne le
    25 septembre 2026. **Close le jour même** : vingt-six lignes constatées,
    trois défauts trouvés et corrigés — l'heure saisie lue en UTC par le
    Worker, le refus affiché six cents pixels au-dessus du bouton, la saisie
    effacée malgré le refus — et les deux lignes qu'ils tenaient en échec
    revérifiées sur la version déployée (`docs/recette-3.1bis.md`).
11. **5.0** — surface mouillée en aspersion : planche **et** passe-pied, sur
    les planches existantes (D-022, règle 2 ; D-023). Contrat écrit et
    validé le 28 septembre 2026 (`docs/wetted-surface-contract.md`) ; code
    en deux PR, tests d'abord. **Première PR fusionnée et déployée le
    28 septembre au soir** (#100) : la règle du domaine, l'apport par heure,
    le volume des besoins et la dose de la faisabilité ; débit total de la
    ferme passé de 29,35 à 39,57 m³/h. **Seconde PR fusionnée et déployée le
    29 septembre au matin** (#102) : la persistance des irrigations.
    **Close le jour même** : recette réelle passée sur la ferme — une
    aspersion et un goutte-à-goutte enregistrés, leurs m³ recalculés à la
    main, les vingt-deux irrigations antérieures au même volume. Précède les
    séries.
12. **5.1** — extension « suivi par série culturale », contrat validé le
    28 septembre 2026 (`docs/series-contract.md`). **En cours depuis le
    29 septembre 2026**, en trois PR : le connecteur et l'instantané
    (#104), le domaine des périodes et des cumuls avec son service (#105),
    puis la vue « Séries », l'export et le parcours P9 (#106). Les trois
    sont fusionnées et déployées le jour même. **Close le 29 septembre 2026
    au soir** : recette réelle passée sur trois séries de la ferme —
    périodes égales à celles d'Ouvre ta ferme, cumuls égaux à ceux des
    planches —, un défaut de présentation corrigé (`docs/recette-series.md`).
13. **3.5.0** — cadrage métier et agronomique du planning, sans code.
    **Contrat écrit le 29 septembre 2026** (`docs/planning-contract.md`) :
    douze réglages, onze scénarios chiffrés sur la ferme, douze questions à
    trancher avec une recommandation chacune. **Validé en entier par le
    porteur le soir même (D-024)** : le moteur (3.5) commence.
14. **3.5** — ✅ moteur de planning hebdomadaire, close par le porteur le 10
    octobre 2026. **Commencé le 29 septembre 2026 au soir**, sur le « vas-y »
    du porteur, en plusieurs PR : le domaine du moteur avec les scénarios du
    contrat en tests (#109), la persistance des propositions et le service
    (#110), puis les actions et la validation d'une proposition en irrigation
    planifiée (#111). **Les trois PR sont fusionnées et déployées le 29
    septembre 2026.** **Recette réelle faite le soir même sur la ferme**
    (`docs/recette-planning.md`) : les goutte-à-goutte et les rampes de serre
    sont justes au litre et à la minute, la pompe, la réserve, les plages et
    l'espacement sont respectés, la semaine se calcule en quatre secondes
    depuis l'écran ; mais sur les rampes de bloc à profil (7,5 mm/h au centre,
    2 mm/h au bord), la règle R11 poursuit le besoin des planches de bord :
    130,956 m³ proposés pour 84,178 demandés, réserve projetée à 0 dès
    vendredi, blocs 3, 8 et fleurs 3 sans créneau. 🔶 **Décision du porteur
    demandée** : un réglage R13, la part du débit nominal en dessous de
    laquelle une planche ne commande pas l'arrosage (proposée à 50 %). Deux
    défauts d'explication à corriger avec elle : le motif « temps de pompage »
    mis par défaut à la place de l'espacement, et le niveau projeté de la
    réserve lu au moment du placement plutôt qu'à la fin du plan. **Tranché le
    soir même (D-025) : oui, 50 %.** PR de la portée ouverte dans la nuit : la
    planche la mieux arrosée fixe la dose, une planche sous la part ne
    commande ni la dose, ni R6, ni R7, réel ou proposé ; motifs « portée du
    matériel insuffisante », « sous la dose minimale », « espacement », « plus
    de plage » ; niveaux de réserve relus sur le plan fini ; cinq tests de la
    portée sur les chiffres de la ferme. PR #114 fusionnée et déployée le soir
    même ; **seconde recette réelle à 21 h 20** : la portée tient — un créneau
    de 2 h par bloc, 69,243 m³ pour 92,661 mobilisables, blocs 3, 8 et fleurs
    3 servis, motifs justes, pompe, plages et espacement tenus —, mais la
    garde de la réserve est inopérante avec un minimum de sécurité à 0, le
    niveau projeté étant borné à zéro avant d'être comparé au minimum :
    21,12 m³ tirés d'une réserve à sec entre mercredi 01 h 25 et 06 h 42,
    « manque d'eau 0,00 ». La garde est corrigée le 2 octobre 2026 (PR #125,
    fusionnée et déployée le 3 octobre) : projection non bornée par zéro
    jusqu'à la fin de l'horizon, raccourcissement par bissection, test des
    chiffres de la ferme qui échouait d'abord (48,51 m³ tirés la première nuit
    pour 39,78 disponibles), carte d'un calcul antérieur datée de son calcul.
    **Troisième recette réelle le 5 octobre 2026** sur la version déployée :
    recalcul du matin et semaine nouvelle constatés, recalcul à la demande en
    2 s, refus et carte datée vérifiés, 37 créneaux rejoués à la main sur la
    réserve, jamais sous 0 ; la pénurie reste hors d'atteinte cette semaine,
    la garde n'est prouvée que par le test des chiffres de la ferme ; cinq
    constats au jugement du porteur (points ouverts 29 à 33). **Quatrième
    recette le soir même, pénurie fabriquée** sur le mot du porteur, données
    expérimentales remises en état : forage indisponible, minimum de sécurité
    à 20 puis 40 m³, limites de prélèvement et journalière à 10 m³/jour ; la
    garde tient — jamais sous le minimum, 0,001 m³ quand il vaut 0, 20,00 et
    40,00 exactement quand il est relevé —, les vagues sont décalées au rythme
    du forage, aucun jour limité ne dépasse 10 m³ ; point 19 fermé ; points
    29, 30 et 32 tranchés par le porteur (D-028, D-029) ; trois constats
    nouveaux, points 34 à 36 : temps de calcul sur le site de 3 à plus de 45 s
    pour le même état, coupe sous limite journalière nommée « stock et
    ressources insuffisants », part égale qui n'en est pas une pour la
    dernière planche examinée. R1 retiré par une PR ouverte le soir même
    (D-029). Point 31 tranché le soir même (D-030) : le créneau refusé est
    exclu pour le reste de la semaine, contrat corrigé, le moteur lira les
    refus dans la 3.7. **Le 8 octobre 2026**, les quatre PR du 5 octobre (#135
    à #138) fusionnées par le porteur et déployées ; recette du retrait de R1
    faite le soir même sur la version déployée, sur ordinateur et à 390 px,
    point 32 fermé ; point 28 fermé, 101 ms sur la CI, budget du test ramené à
    500 ms (D-031, PR #144 fusionnée et déployée le soir même). **Le 9 octobre
    2026**, points 33 et 35 corrigés sur le mot du porteur (PR #156 fusionnée
    et déployée le jour même) : la pompe nomme ce qui la tenait, l'espacement
    l'emporte sur la pluie, la coupe sous limite journalière porte son nom ;
    point 36 tranché (D-037, D-038) et corrigé le jour même, PR #158 fusionnée
    et déployée le jour même : la part réservée en pénurie et la note du
    manque d'eau ; point 34 instrumenté le jour même sur son mot, avant toute
    piste moteur : chaque calcul et chaque affichage écrivent leurs durées par
    phase, à lire dans les journaux Cloudflare, pas à pas
    (`docs/publication.md`), PR #160 fusionnée et déployée le jour même ;
    journaux lus le soir même par l'assistant dans le Chrome du porteur, sur
    son mot : trois recalculs en 1,65 à 1,83 s d'invocation pour 2,3 s vus du
    navigateur, 1,0 s de serveur chronométré, aucune phase longue ni variable,
    le 3 s à 45 s non reproduit, tous les instantanés en cache ; cause encore
    à nommer, piste d'une lecture OTF en direct au moment du clic (cache de
    quatre heures, 429 constaté sur l'actualisation forcée) à surveiller dans
    les mêmes journaux ; tranché par le porteur le soir même : attendre une
    occurrence, aucune correction avant. **Recette du point 36 faite le 10
    octobre 2026** sur le site, sur son « reprends le travail », par
    l'assistant dans le Chrome du porteur, pénurie fabriquée et données
    remises en état : à 50 % puis 28 % de part, les quatre tunnels reçoivent
    chacun leur fraction, le dernier examiné compris, la réserve exactement à
    son minimum ; la note du manque d'eau s'affiche pour 0,002 m³ de résidu
    d'arrondi des secondes sous un libellé qui nomme une autre cause (point
    41). **Point 41 tranché par le porteur le jour même (D-040) et corrigé** :
    la note tolère le résidu d'arrondi des secondes que le moteur tient déjà
    pour reçu, un centième de millimètre par planche et par créneau qui
    l'arrose, au moins un litre ; contrat précisé avant le code, deux tests
    rouges d'abord ; PR #164 fusionnée et déployée le jour même. **Recette du
    point 41 faite le jour même** sur le site par l'assistant dans le Chrome
    du porteur : la pénurie de T2 refaite à l'identique, mêmes créneaux, même
    manque, même part, et aucune note sous les cartes ; données remises en
    état, plan du matin retrouvé. **Close par le porteur le 10 octobre
    2026** : points 4, 36 et 41 fermés par lui, point 34 laissé en veille, non
    bloquant, à rouvrir à la première occurrence ; le point 31 reste au moteur
    de la 3.7 (D-030).
15. **3.6** — interface du planning. **Commencée le 29 septembre 2026 au
    soir**, sur le « vas-y » du porteur, en une PR : la section « Planning de
    la semaine » — résumé, semaine en jours, propositions avec leur
    justification, validation une par une, par jour ou toute la semaine,
    ajustement du début et de la dose, refus, liste « Non placé », réglages
    R1 à R12 avec leur historique —, la présentation pure testée, le
    parcours P10 aux deux largeurs. **Close le 29 septembre 2026 au soir** :
    PR #112 fusionnée et déployée, recette réelle passée sur la ferme —
    calcul, justification, ajustement validé jusque dans les irrigations à
    venir, refus, annulation, 390 px sans débordement
    (`docs/recette-planning.md`).
16. **2.11** — ✅ pose datée et stockage du matériel demandée par le porteur le
    27 octobre 2026 : un goutte-à-goutte ou une rampe se pose, se retire,
    reste stocké, se repose ailleurs, et les calculs suivent la réalité ;
    « Retirer la position » refusé dès qu'un matériel a arrosé (point ouvert
    43). Contrat écrit le jour même
    (`docs/equipment-placement-periods-contract.md`, D-043), relu et confirmé
    par le porteur le jour même, un message expliquant toujours le refus d'une
    validation (règle 14). Placée avant la 3.7 parce qu'elle change ce que le
    planning sait du matériel, et que « matériel déplacé » est un des
    événements que la 3.7 traitera ; sur le « vas-y » du porteur, le jour
    même. Code commencé le soir même sur son « vas-y » : PR 1 sur 3, le
    domaine des poses et ses scénarios en tests, fusionnée et déployée ; PR 2
    sur 3, l'enregistrement en base, fusionnée et déployée le même soir
    (#181). Le 29 octobre 2026, sur son « vas-y », la PR 3 est découpée en
    deux : 3a, les calculs, avec D-044 tranchée par lui en cours de route (une
    irrigation planifiée qui ne peut pas démarrer ne compte plus dans les
    calculs), fusionnée et déployée le soir même (#187) ; puis 3b, l'écran et
    la saisie après coup, fusionnée et déployée le même soir (#188). Recette
    réelle passée sur la ferme le 30 octobre 2026, treize vérifications
    conformes ; un défaut ancien trouvé (point ouvert 44), corrigé le jour
    même sur le choix du porteur, correction constatée sur le site le jour
    même, point fermé par le porteur le jour même ; deux écarts mineurs
    relevés au passage (points ouverts 45 et 46), tranchés par le porteur le
    jour même, tous deux corrigés le jour même ; à l'usage, un retrait daté de
    la minute même refusé comme futur (point ouvert 47), corrigé le jour même
    sur son mot ; retrait réel fait par l'écran, point 43 fermé par le porteur
    le jour même ; corrections des points 45 à 47 constatées sur le site le
    jour même, points fermés par le porteur le jour même ; **close par le
    porteur le 30 octobre 2026**, sans constat séparé de la lisibilité sur son
    téléphone.
17. **3.7** — suivi d'exécution et replanification ; lit les refus (D-030).
    **Contrat écrit et validé par le porteur le 30 octobre 2026**
    (`docs/replanning-contract.md`, D-051) : le moteur lit les refus de la
    semaine (point ouvert 31) ; le plan se recalcule de lui-même après chaque
    événement réel — arrosage fait, partiel ou annulé, pluie saisie, réserve
    corrigée, restriction, objectif ou priorité changés, matériel déplacé,
    refus —, une proposition identique gardant sa carte ; sur un arrosage
    validé, le moteur suggère « Réduire » ou « Annuler » au seuil de la dose
    minimale R4, jamais appliqué seul ; un arrosage non démarré 30 minutes
    après son heure est « en retard » (réglage R14), son eau comptée jusqu'à
    la fin du créneau ; deux notifications seulement, le retard et la
    suggestion du calcul du matin ; recette réelle sur son « vas-y ». Cinq
    PR prévues, tests d'abord, parcours P12 ; la première, la lecture des
    refus, ferme le point 31. Le code commence à son tour, en Fable 5.1 ·
    Très élevé. **Code commencé le 31 octobre 2026 : PR 0, le déplacement
    de la justification hors du moteur (#208, fusionnée et déployée à
    02 h 02) ; PR 1 sur 5, la lecture des refus (#209, fusionnée et
    déployée à 02 h 17) ; PR 2 sur 5, le recalcul sur événement (#210,
    fusionnée et déployée à 02 h 34) ; PR 3 sur 5, les suggestions sur les
    arrosages validés (#211, fusionnée et déployée à 03 h 01) ; PR 3 bis,
    « Ce qui a changé » depuis le calcul précédent (#212, fusionnée et
    déployée à 03 h 20) ; PR 4a, le retard et le réglage R14 (#213, fusionnée
    et déployée à 03 h 38) ; PR 4b, les deux notifications (#214, fusionnée
    et déployée à 06 h 17) ; PR 5 sur 5, l'écran et le parcours P12 (#215,
    fusionnée et déployée à 06 h 39) ; recette réelle faite le jour même sur
    la ferme, conforme, point 31 prouvé, quatre corrections faites le jour
    même sur le mot du porteur (#220, fusionnée sur son mot et déployée à
    12 h 14, vérifiée sur la ferme) ; 3.7 ✅ close par le porteur le
    31 octobre 2026, point 31 fermé.**
18. **5 quater** — besoin en eau par culture et par stade, demandée par
    le porteur le 30 octobre 2026 ; contrat écrit le jour même
    (`docs/crop-water-need-contract.md`, D-045), **relu et tranché par lui le
    31 octobre 2026 (D-054)** : dates de stade, délais de levée, calendriers
    des pluriannuelles, correspondance des espèces, facteurs et options ;
    mode automatique non retenu ; PR 0 des données de départ faite ; **code
    du domaine commencé le 5 novembre 2026 sur son « vas-y »**, en Opus 5.5 ·
    Max (Fable 5.1 · Max avant D-055) : PR 1, le domaine (#235, fusionnée et
    déployée le 6 novembre 2026) ; deux règles du contrat tranchées par lui en
    codant (D-057) ; PR 2, la persistance, codée le 6 novembre 2026 en Opus
    5.5 · Élevé (#236, migration 0023), fusionnée et déployée le jour même ;
    **l'écran commencé le 6 novembre 2026 sur son « vas-y »**, en Opus 5.5 ·
    Élevé, en cinq PR (3a, la page des coefficients et la correspondance des
    espèces, #237, fusionnée et déployée ; 3b, la fiche de la planche et
    l'adoption, #239, fusionnée et déployée ; 3c, les surcharges de Kc et
    les réglages, #241, fusionnée et déployée ; 3d, l'ETM enregistrée chaque
    jour et l'avertissement de l'aspersion, #242, fusionnée et déployée ; 3e,
    les durées propres à la ferme et la fiche de la série, #243, fusionnée
    et déployée), puis la recette réelle, faite le 6 novembre 2026
    (`docs/recette-5-quater.md`), jugement au porteur ; la correspondance des 78 espèces de la ferme
    saisie le 6 novembre 2026 sur son « vas-y ». Placée après la 5 bis et avant la 3.8 sur la recommandation de
    l'assistant, acceptée par le porteur le jour même : elle demande au
    porteur de valider les durées de stade de dix-sept cultures et la
    correspondance des espèces avant tout code, et la 3.8 rangera ensuite ses
    écrans avec les autres. Elle ne dépend pas de la 5 bis : l'ET0 prévue est
    déjà synchronisée. Passée en 18 le 30 octobre 2026 au soir, devant la
    5 ter et la 5 bis, sur le choix du porteur : la jauge de la 5 ter
    consomme désormais son ETM (D-047).
19. **5 ter** — réserve du sol (RFU), demandée par le porteur le 27 octobre
    2026 ; contrat écrit le jour même (`docs/soil-reserve-contract.md`,
    D-041) ; RFU en mm par mètre de sol
    (D-046, 30 octobre 2026), 62 mm/m pour la ferme, confirmée par le
    laboratoire (point ouvert 42 fermé). Placée après la 3.7, qu'elle
    n'alourdit pas, avant la 5 bis, parce qu'elle pèse davantage dans la
    décision d'arroser, et avant la 3.8, qui rangera son écran avec les
    autres ; place recommandée par l'assistant et acceptée par le porteur le
    27 octobre 2026. Révisée le 30 octobre 2026 sur le complément « jauge
    RFU » du porteur (D-047) : la jauge consomme l'ETM de la 5 quater, la RFU
    du sol se corrige des cailloux, 51 mm/m pour la ferme, un seuil de
    déclenchement par culture s'affiche, sans toucher aux priorités. Passée
    en 19, après la 5 quater, sur le choix du porteur le même soir.
    **Contrat relu et validé par le porteur le 31 octobre 2026 (D-053)** :
    seuils sur une part de référence de 2/3, profondeurs et parts p de toutes
    les cultures de référence, jauge continue sur une planche sans culture
    (modèle de sol nu de la FAO-56, états de surface), curseur de parcelle
    limité au plein champ. Rien de codé : le domaine se code après celui de
    la 5 quater, dont la relecture reste à faire. **Profondeurs révisées le
    3 novembre 2026 (D-056)** : une profondeur par stade au lieu de la moitié
    au premier stade, melon et asperge plafonnés à 0,60 m, plafond de sol
    facultatif par parcelle.
    **Seuil d'arrosage réglable ajouté le 6 novembre 2026 (D-059).** **Code
    commencé le 6 novembre 2026 sur le mandat du porteur** de réaliser seul
    les quatre chantiers suivants de l'ordre (5 ter, pastille « eau en
    trop », 5 quinquies, refonte ergonomique), en choisissant l'option
    recommandée à chaque question et en la consignant (D-060) : PR 1, le
    domaine (`lib/domain/soil-reserve/`), en une seule PR au lieu de deux,
    les quarante et un scénarios du contrat en tests ; PR 2, la persistance
    (migration 0025, `db/soil-reserve/`, jeu commun de 31 profils
    racinaires) ; PR 3, l'écran, en quatre : 3a, les réglages du sol
    (parcours P18), 3b, le bloc « Réserve du sol » par jardin (parcours
    P19), 3c, les profils racinaires dans la page « Coefficients
    culturaux » (parcours P20), 3d, l'état du jour enregistré et la dose au-delà de ce que
    le sol retient ; puis la pastille « eau arrosée en trop », petite PR
    sur le même mandat ; toutes fusionnées et déployées (#245 à #251) ;
    puis la recette réelle sur la ferme, faite le 6 novembre 2026
    (`docs/recette-5-ter.md`), un défaut corrigé le soir même, jugement au
    porteur.
20. **5 bis** — alertes météo paramétrables ✅, demandée par le porteur le 9
    octobre 2026 ; place proposée après la 3.7 et avant la 3.8 : elle ne
    dépend pas du planning, et la réorganisation 3.8 rangera son écran avec
    les autres ; place confirmée par le porteur le 9 octobre 2026. Contrat
    écrit le 30 octobre 2026 (`docs/weather-alerts-contract.md`, D-050) et
    validé par le porteur le jour même ; **code commencé le 31 octobre 2026
    sur son « vas-y »**, en trois PR : PR 1, le domaine (#224), fusionnée
    et déployée ; PR 2, la persistance et l'envoi, faite en deux (2a, la
    route d'envoi immédiat du Worker, #225 ; 2b, l'enregistrement et
    l'envoi, #226, migration 0022 ; fusionnées et déployées) ; PR 3,
    l'encart « Alertes météo » et le parcours P13 (#227), fusionnée et
    déployée ; **recette réelle sur la ferme validée par le porteur le
    6 novembre 2026** : 5 bis close. Avancée devant le domaine de la
    5 quater, que le porteur a reporté à la semaine du 2 novembre 2026.
21. **5 quinquies** — alertes météo par culture : gel selon la culture,
    arrêt d'arrosage avant récolte et aspersions à reconsidérer. Idées A1 et
    A2 de la comparaison avec Tlaloc, placées par le porteur le 6 novembre
    2026 après la 5 ter ; aspersions à reconsidérer ajoutées à ce chantier le
    même jour, sans la partie mildiou du soir. **Contrat écrit et relu par le
    porteur le 6 novembre 2026** (`docs/weather-crop-alerts-contract.md`,
    D-058). Code en trois PR (domaine, persistance et envoi, écran), puis
    recette réelle sur son « vas-y ». Opus 5.5 · Élevé (contrat écrit en
    Sonnet 5.5 · Moyen). **Code commencé le 6 novembre 2026 sur le mandat
    du porteur (D-060)** : PR 1, le domaine (`lib/domain/crop-alerts/`),
    huit précisions consignées dans le contrat ; PR 2, la persistance et
    l'envoi (migration 0026, `db/crop-alerts/`), huit précisions ; PR 3,
    l'encart « Alertes cultures » (parcours P21), huit précisions ; toutes
    fusionnées et déployées (#252 à #254) ; puis la recette réelle sur la
    ferme, commencée le 6 novembre 2026 : un défaut d'envoi trouvé et
    corrigé le soir même ; l'alerte reçue sur son téléphone, mais seulement
    à son réveil, et le toucher n'ouvrant rien, deux défauts corrigés le
    soir même ; recette faite le 7 novembre 2026
    (`docs/recette-5-quinquies.md`), les trois défauts constatés corrigés,
    jugement au porteur.
22. **Refonte ergonomique** — application de la charte du module validée par
    le porteur le 6 novembre 2026 (`docs/charte-module.md`) ; chantier
    d'habillage séparé, CSS seul. Polices sous licence SIL OFL 1.1, hébergées
    avec leur `OFL.txt`. **Code commencé le 6 novembre 2026 sur le mandat du
    porteur (D-060)**, en trois temps : R1, les jetons, les polices, le fond,
    les blocs et les rayons (neuf précisions consignées dans la charte ;
    #257, fusionnée et déployée le 7 novembre 2026) ;
    R2, les boutons, les onglets, les tableaux et les tuiles (cinq
    précisions ; #263, fusionnée et déployée le 7 novembre 2026) ; R3, les couleurs d'état, le bleu eau et les icônes (cinq
    précisions ; #264, fusionnée et déployée le 7 novembre 2026). La
    navigation de la charte revient à la 3.8. Un défaut de R3, l'icône de la
    page demandée en vain (404), trouvé au contrôle de départ de la 3.8 et
    corrigé le 7 novembre 2026. Relecture visuelle du porteur le 7 novembre
    2026 : trop proche d'avant ; **deuxième passe, R4, sur une maquette
    validée par lui le jour même (D-068), codée juste après la 3.8 et avant
    la 3.8 bis**, CSS et habillage seulement, Opus 5.5 · Élevé ; codée le
    7 novembre 2026 au soir, après le déploiement de la PR 7 de la 3.8 ;
    relecture du porteur à venir.
23. **3.8** — ✅ réorganisation globale de l'interface. **Ne commence qu'après un
    avertissement explicite au porteur, la 3.5 et la 3.7 terminées** : il veut
    la vérifier lui-même de fond en comble (consigne du 9 octobre 2026). Elle
    reçoit l'**aide contextuelle** (idée Tlaloc, placement validé le 6 novembre
    2026) et, **depuis le 7 novembre 2026, les fonctionnalités à la carte** :
    plus de mode simple ou complet, un seul mode où chaque ferme coche ce
    qu'elle affiche et fait tourner (D-067, `docs/feature-selection-contract.md`).
    Commencée le 7 novembre 2026 sur son « vas-y » ; contrat écrit le jour même.
    ✅ **Close par le porteur le 8 novembre 2026** après sa vérification en
    ligne et un premier lot de retours (#278), « quitte à ce que je fasse des
    modifications ultérieurement ».
23 bis. **3.8 bis, calculateur d'irrigation** — assistant de saisie des
    réglages de matériel (goutte-à-goutte par planche ou par vanne, aspersion
    en moyenne ou en cône, pression facultative, quatre exemples sourcés), sans
    base de produits ; contrat écrit et validé le 6 novembre 2026
    (`docs/irrigation-calculator-contract.md`, D-061). Après la 3.8 et la
    deuxième passe de la refonte (D-068), avant la 3.9 ; Opus 5.5 · Élevé.
    **Codée la nuit du 7 au 8 novembre 2026** en une PR (D-070), neuf
    précisions tranchées sur la recommandation ; **validée par le porteur le
    8 novembre 2026**, sans ajout.
23 ter. **3.8 ter, créneaux protégés nommés** — plages horaires nommées,
    répétées chaque semaine par jours, valables pour tout le matériel, que le
    moteur n'utilise jamais ; contrat écrit et validé le 6 novembre 2026
    (`docs/protected-slots-contract.md`, D-062). Après la 3.8 bis, juste avant
    la 3.9 ; Opus 5.5 · Max. **Code commencé la nuit du 7 au 8 novembre
    2026** sur le mandat du porteur, en cinq PR (D-071) : PR 1, le module de
    domaine (#282) ; PR 2, le placement (#283) ; PR 3, la persistance
    (#284) ; PR 4, les arrosages validés et le réel (#285) ; le correctif
    du journal des créneaux (#286) ; PR 5, l'écran et le geste manuel (#287).
    Code terminé : relecture et recette du porteur à son retour.
23 quater. **3.8 quater, audit ergonomique** — les quatorze propositions de
    l'audit du 7 novembre 2026, **retenues et voulues par le porteur le jour
    même** (D-069, bloc 3.8 quater) : titres de pages et page 404, tri des
    listes de planches, doublons de la saison et de la météo, historique des
    arrosages réalisés (lot 1) ; téléphone, page « Aujourd'hui » avec la
    zone « Fiabilité du calcul » (lot 2) ; planning, arrosages, vocabulaire,
    alertes météo, espèces, réserve du sol, accessibilité (lot 3). Après la
    3.8 ter, juste avant la 3.9, parce que la 3.9 fait la recette finale sur
    le code terminé. Opus 5.5, effort par lot. **Lot 1 codé la nuit du 7 au
    8 novembre 2026** sur le mandat du porteur (D-072, parcours P27, #288
    en ligne) ; **relu et validé par le porteur le 8 novembre 2026**. **Contrat du lot 2
    écrit le 8 novembre 2026** (`docs/audit-ergonomie-lot2-contract.md`,
    D-073, #289 en ligne) ; son code en trois PR (Opus 5.5 · Très élevé) :
    **PR 1, le téléphone, codée le 8 novembre 2026** (P28, #290 en
    ligne) ; **PR 2, le domaine « Fiabilité » et « Aujourd'hui », codée le
    8 novembre 2026** (F23 à F30, #291 en ligne) ; **PR 3, les
    écrans, codée le 8 novembre 2026** (P29, F31 à F42). Retours du
    porteur du 8 novembre 2026 en deux petites PR (#295, #296). Puis
    **« Aujourd'hui » en tableau de bord** (D-074,
    `docs/aujourdhui-tableau-de-bord-contract.md`, Opus 5.5 · Très élevé,
    choix du porteur) : la maquette validée par lui le 8 novembre 2026, en
    trois PR, le contrat et le domaine (#297, en ligne), les écrans (#298,
    en ligne, P30), « Tout est fait » (#299, en ligne), puis la légende de
    la frise corrigée après le retour du porteur (T19). **Lot 3** : contrat
    court validé par le porteur le 8 novembre 2026
    (`docs/audit-ergonomie-lot3-contract.md`, D-076), trois PR (Opus 5.5 ·
    Très élevé) ; **PR 1, le planning et les arrosages, codée le 8 novembre
    2026** (P31a, F52 à F61, #301 en ligne) ; **PR 2, les gestes par ligne
    (points 12, 13, 10), les mots simples et l'accessibilité (points 8,
    14), réunies et codées le 8 novembre 2026** (P31b, P31c, F62 à F71,
    #303 de l'archive, en ligne) ; lot 3 validé par le porteur le 8 novembre
    2026 à 19 h 20.
24. **3.9** — scénarios, tests de pénurie, recette et publication de la
    tranche 3. Contrat écrit le 30 octobre 2026 (`docs/shortage-contract.md`,
    D-052) et validé par le porteur le jour même ; le code, en sept lots,
    vient après la 3.8, les **créneaux protégés nommés** (3.8 ter, ci-dessus)
    et l'**audit ergonomique** (3.8 quater). **Code commencé le 8 novembre
    2026 au soir**, sur le dépôt public : lot 2, une PR `fix/` par règle
    tranchée, une à la fois ; **correction 1 sur 4 codée**, l'arbitrage
    validé en parts réservées (D-077). Après les quatre corrections,
    l'**écran d'arbitrage présenté comme un plan d'assolement**, décidé par
    le porteur le 8 novembre 2026 à 20 h 40 (D-078) : une maquette d'abord,
    soumise au porteur avant tout code. Puis les lots 3 à 7 ; ni recette
    finale ni tag sans le porteur.
25. **Tranche 4** — à cadrer avec le développeur d'Ouvre ta ferme après
    la 3.9. Elle s'ouvre par la **démo guidée avec saisons**, qui réutilise
    les jeux de la 3.9 (Opus 5.5 · Élevé).

24 bis. **Connexions matériel** — trois fonctions demandées le 7 novembre 2026 :
    la connexion à une **station météo locale**, la connexion à des
    **tensiomètres** et le **pilotage d'électrovannes** (section 6 bis, D-063).
    Chacune commence par une recherche documentaire sans code, qui en déduit
    une méthode de travail ; rien n'est décidé ni codé. Après la 3.9, avant la
    tranche 4 ; Sonnet 5.5 · Moyen pour la recherche, le réglage du code se
    fixe au contrat.

24 ter. **Banc commun de saisons rejouées avec Tlaloc** — idée décidée par le
    porteur le 7 novembre 2026 (D-065, section 6 ter) : rejouer les mêmes
    saisons dans les deux moteurs et comparer des indicateurs définis de la
    même façon. **Après la 3.9, en recherche** : un contrat écrit d'abord
    (Sonnet 5.5 · Moyen), **aucun code sans l'accord du porteur**. Aucun
    calendrier, aucune promesse à Tlaloc. **Le 7 novembre 2026, le chantier
    de fusion des deux moteurs (ligne 24 quater) l'absorbe** : le rejeu devient
    l'une des façons de comparer les moteurs, pas une étape séparée.

24 quater. **Fusion des deux moteurs** — accord du porteur avec le développeur
    de Tlaloc le 7 novembre 2026 (D-066, section 6 quater) : comparaison fine
    des deux moteurs et de leur fonctionnement, puis synthèse en un logiciel
    commun à partir du code de Tlaloc. **Après la 3.9, avant la Tranche 4.**
    Recherche et contrat d'abord (Sonnet 5.5 · Moyen) ; **aucun code, aucune
    fusion de code sans l'accord du porteur** ; le réglage du code se fixe au
    contrat.

**Idées Tlaloc, placement validé par le porteur le 6 novembre 2026**
(`/mnt/project-files/tlaloc-comparaison/placement-idees-tlaloc.md`) :
le **seuil d'arrosage réglable** entre dans la 5 ter (rouvre D-053, D-059) ;
la **pastille « eau arrosée en trop »** est une petite PR juste après la 5 ter
(Opus 5.5 · Élevé) ; les **aspersions à reconsidérer** sont dans la 5
quinquies ; le **catalogue de matériel par défaut** commence par une
recherche documentaire sans code (Sonnet 5.5 · Moyen), et son code, si les
données existent, vient après la 3.8 et avant la 3.9 (Opus 5.5 · Élevé).

Les étapes 5.0 et 5.1 sont placées avant le cadrage 3.5.0 le 28 septembre
2026 : la connaissance des séries change ce cadrage, et l'alignement des
surfaces mouillées change les volumes que le planning devra servir.

Q5 et Q6 sont passés devant 3.1 bis et 3.5.0 le 20 septembre 2026, à la demande
du porteur de projet : le socle doit être entier avant que du code nouveau ne
s'écrive, pour que tout ce qui vient ensuite soit protégé dès sa première ligne.
Ordre précédent : 3.1 bis, puis 3.5.0, puis Q5 et Q6. Le coût assumé est de
retarder d'autant la mesure du débit et le cadrage du planning ; le gain est
qu'aucun des milliers de lignes du moteur, de son interface et de la
replanification ne sera écrit sans parcours navigateur ni fichiers découpés.

Deux remarques qui restent vraies après ce changement. Le cadrage 3.5.0
n'écrit aucun code et ne tire donc aucun bénéfice de cette protection : il peut
être avancé à tout moment si le porteur veut réfléchir au moteur plus tôt,
d'autant qu'il demande sa propre validation agronomique. Le moteur 3.5 est du
domaine pur et pourrait démarrer dès 3.5.0 validé ; l'interface 3.6, elle,
attend Q6 dans tous les cas.

## 3. Tranche 3 — Ressource, faisabilité et planification

| N° | Sous-tranche | État | Modèle · effort |
| --- | --- | --- | --- |
| 3.1 | Ressources en eau, réserves tampon, projections | ✅ | — |
| 3.2 | Pompes, origines et contraintes hydrauliques | ✅ | — |
| 3.3 | Besoins planifiables par planche et priorités | ✅ | — |
| 3.3.1 | Retour à l'objectif seul dans le besoin, ET0 informative | ✅ recette sur le site faite le 9 octobre 2026 par l'assistant dans le Chrome du porteur ; point 4 fermé par lui le 10 octobre 2026 | Fable 5.1 · Élevé |
| 3.4 | Faisabilité, répartition des déficits, arbitrage manuel | ✅ | Opus 5 · Élevé — recette utilisateur entièrement passée du 20 au 25 septembre 2026, sans défaut bloquant ; B6 partagé entre le parcours P7 et le constat du porteur sur son téléphone |
| 3.1 bis | Mesure et historique du débit des ressources | ✅ | Opus 5 · Élevé — fonctionnalité délimitée, règles simples, tests et CI jugent ; développée en cinq PR les 21 et 22 septembre 2026 ; recette réelle close le 25 septembre, trois défauts trouvés et corrigés le même jour (docs/recette-3.1bis.md) |
| 3.5.0 | Cadrage métier et agronomique du planning | ✅ validé le 29 septembre 2026 (D-024) | Fable 5.1 · Max — le porteur est le seul juge, aucun test ne peut valider une règle agronomique |
| 3.5 | Moteur de planning hebdomadaire | ✅ close par le porteur le 10 octobre 2026 ; quatre PR fusionnées le 29 septembre 2026 ; deux recettes réelles le soir même ; R13 tranchée (D-025) et vérifiée ; garde de la réserve corrigée le 2 octobre 2026, PR #125 fusionnée et déployée le 3 octobre ; troisième recette réelle le 5 octobre 2026 : recalcul du matin, semaine nouvelle, recalcul en 2 s, refus et carte datée vérifiés, niveaux retrouvés à la main ; pénurie hors d'atteinte cette semaine, cinq constats au jugement du porteur (points 29 à 33) ; quatrième recette le soir même, pénurie fabriquée : garde prouvée sur la ferme, point 19 fermé, points 29, 30 et 32 tranchés (D-028, D-029), R1 retiré par une PR ouverte le soir même, trois constats nouveaux (points 34 à 36) ; point 31 tranché le soir même (D-030, le créneau refusé exclu pour le reste de la semaine, contrat corrigé, moteur à faire dans la 3.7) ; le 8 octobre 2026, les quatre PR du 5 octobre fusionnées et déployées, recette du retrait de R1 faite sur ordinateur et à 390 px (point 32 fermé), point 28 fermé (101 ms sur la CI, budget du test à 500 ms, D-031, PR #144 fusionnée et déployée le soir même) ; le 9 octobre 2026, points 33 et 35 corrigés sur le mot du porteur (PR #156 fusionnée et déployée le jour même) : la pompe nomme ce qui la tenait, l'espacement l'emporte sur la pluie, la coupe sous limite journalière porte son nom ; point 36 tranché (D-037, D-038) et corrigé le jour même, PR #158 fusionnée et déployée le jour même ; clôture par le porteur après sa recette du point 36 sur le site ; point 34 instrumenté le jour même sur son mot (journaux de durée côté serveur, PR #160 fusionnée et déployée le jour même) et journaux lus le soir même par l'assistant dans le Chrome du porteur : 2,3 s par recalcul vu du navigateur, 1,0 s de serveur chronométré, aucune phase longue ni variable, le 3 s à 45 s non reproduit, cause encore à nommer, le porteur tranche le soir même d'attendre une occurrence ; le 10 octobre 2026, recette du point 36 faite sur le site par l'assistant dans le Chrome du porteur, pénurie fabriquée : la part réservée tient, la note du manque d'eau se trompe de cause sur un résidu d'arrondi (point 41) ; point 41 tranché par le porteur le jour même (D-040) et corrigé, PR #164 fusionnée et déployée le jour même, recette sur le site faite le jour même, la note absente ; points 4, 36 et 41 fermés par le porteur, point 34 en veille, non bloquant ; close par lui le 10 octobre 2026 | Fable 5.1 · Max — page blanche, conséquences d'arrosage réelles, erreur silencieuse |
| 3.6 | Interface du planning | ✅ close le 29 septembre 2026 : PR #112, recette réelle sur la ferme (docs/recette-planning.md) | Opus 5 · Très élevé — contexte large, mais une erreur d'affichage se voit et se corrige ; réalisée en Fable 5.1 · Max, le porteur n'ayant pas changé de modèle au « vas-y » |
| 3.7 | Suivi d'exécution et replanification | ✅ close par le porteur le 31 octobre 2026 : contrat écrit et validé par lui le 30 octobre 2026 (`docs/replanning-contract.md`, D-051) ; code commencé le 31 octobre 2026 : PR 0, le déplacement sans changement de la justification hors du moteur (#208), fusionnée et déployée ; PR 1 sur 5, la lecture des refus (point 31, #209), fusionnée et déployée ; PR 2 sur 5, le recalcul sur événement (#210), fusionnée et déployée ; PR 3 sur 5, les suggestions sur les arrosages validés (#211), fusionnée et déployée ; PR 3 bis, « Ce qui a changé » (#212), fusionnée et déployée ; PR 4a, le retard et R14 (#213), fusionnée et déployée ; PR 4b, les deux notifications (#214), fusionnée et déployée ; PR 5 sur 5, l'écran et le parcours P12 (#215), fusionnée et déployée ; recette réelle faite le 31 octobre 2026, quatre corrections faites le jour même (#220), fusionnée et déployée, vérifiées sur la ferme ; close par le porteur le jour même, point 31 fermé | Fable 5.1 · Très élevé — replanifier après un arrosage partiel est une décision agronomique ; contrat commencé en Opus 5.5 · Élevé par le choix du coordinateur, écart signalé, relu et complété en Fable 5.1 · Très élevé sur le mot du porteur (D-049) |
| 3.8 | Réorganisation globale interface et ergonomie : fonctionnalités à la carte | ✅ **close par le porteur le 8 novembre 2026 à 20 h 21** (« On va clôturer la 3.8 pour l'instant, quitte à ce que je fasse des modifications ultérieurement ») ; commencée le 7 novembre 2026 sur le « vas-y » du porteur ; plus de mode simple ou complet : un seul mode, dix fonctionnalités à cocher, ni affichées ni prises en compte quand elles sont décochées, une page par fonctionnalité, aide contextuelle (D-067) ; contrat écrit le jour même (`docs/feature-selection-contract.md`) sur ses douze réponses, trente-cinq précisions tranchées par la recommandation, puis onze venues de sa visite en ligne (P36 à P46) ; trois petites corrections d'abord (icône de la page, cartes « Annulée », champ « Millimètres »), faites ; code en sept PR : PR 1, la liste des cases et l'enregistrement du choix (#271, déployée) ; PR 2, une page par case (#272, déployée) ; PR 3, le choix des cases à l'écran (#273, déployée) ; PR 4, les traitements suivent le choix (#274, déployée) ; PR 5, le « ? » de chaque page (#275, déployée) ; PR 6, les bulles « d'où vient ce chiffre » (#276, déployée) ; vérification en ligne du porteur le 7 novembre 2026 au soir : PR 7, le premier lot de ses retours (P36 à P46 : ordre du menu, « Reposer » hors des arrosages, « ? » des groupes et du K_abri, inventaire compact, curseur à quatre crans, dessins des espèces d'Ouvre ta ferme, marge expliquée en Alertes météo, marges de gel réglables et historique replié en Alertes cultures, semaine du planning en tableau sur grand écran) (#278, déployée) ; close sans second lot, des modifications restant possibles plus tard, chacune par PR | Opus 5.5 · Très élevé — refonte large protégée par Q5, vérification visuelle |
| 3.8 bis | Calculateur d'irrigation (code du catalogue de matériel) | ✅ contrat écrit et validé par le porteur le 6 novembre 2026 (`docs/irrigation-calculator-contract.md`, D-061) ; **codé la nuit du 7 au 8 novembre 2026** en une PR (D-070, migration 0029, parcours P25) ; **validée par le porteur le 8 novembre 2026 à 11 h 25 en ligne (« Ok, ça me paraît réaliste. Je valide comme ça. ») ; les ajouts de réalisme proposés (pertes, sol, pompe, hydraulique) écartés par lui** ; deux défauts d'affichage corrigés le jour même ; après la 3.8, avant la 3.9 | Opus 5.5 · Élevé — formules testées par des valeurs chiffrées, le moteur ne change pas ; contrat écrit en Sonnet 5.5 · Moyen |
| 3.8 ter | Créneaux protégés nommés | 🟡 contrat écrit et validé par le porteur le 6 novembre 2026 (`docs/protected-slots-contract.md`, D-062) : plages horaires nommées, chaque semaine par jours, pour tout le matériel, interdites sans exception (prioritaires et pénurie compris), suggestions « Annuler » ou « Réduire » sur les arrosages déjà validés, sept questions tranchées par lui le jour même ; **code commencé la nuit du 7 au 8 novembre 2026** sur le mandat du porteur, en cinq PR (D-071) : PR 1, le module de domaine (#282, déployée) ; PR 2, le placement (#283, déployée) ; PR 3, la persistance (#284, déployée) ; PR 4, les arrosages validés et le réel (#285, déployée avec le correctif) ; le correctif du journal (#286, déployée) ; PR 5, l'écran et le geste manuel (#287, déployée) ; code terminé, relecture et recette réelle du porteur à son retour ; juste avant la 3.9 | Opus 5.5 · Max — règle métier nouvelle, la 3.9 ayant acté « aucune règle nouvelle » (ordre 24) |
| 3.8 quater | Audit ergonomique : quatorze améliorations | 🟡 audit du 7 novembre 2026 **retenu en entier par le porteur le jour même** (D-069) ; après la 3.8 ter, avant la 3.9 ; trois lots, les petits points d'abord (7, 4, 9, 11) ; **lot 1 en ligne** (#288, 8 novembre 2026, D-072, P27), relu et validé par le porteur le 8 novembre 2026 ; **lot 2 : contrat écrit le 8 novembre 2026** (`docs/audit-ergonomie-lot2-contract.md`, D-073, #289 en ligne) ; **PR 1 du lot 2 (le téléphone) en ligne** (#290, P28, F15 à F22) ; **PR 2 (le domaine « Aujourd'hui » et « Fiabilité ») en ligne** (#291, F23 à F30) ; **PR 3 (les écrans) en ligne** (#293, P29, F31 à F42) ; lot 2 en ligne, relecture en ligne du porteur à son retour ; retours du porteur en ligne (#295, #296) ; **« Aujourd'hui » en tableau de bord** (D-074) : maquette validée le 8 novembre 2026, trois PR, la PR 1 (contrat et domaine) en ligne (#297), la PR 2 (les écrans, P30) en ligne (#298), la PR 3 (« Tout est fait ») en ligne (#299) ; légende de la frise corrigée (T19) ; **lot 3 : contrat validé le 8 novembre 2026** (`docs/audit-ergonomie-lot3-contract.md`, D-076), trois PR ; **PR 1 (planning et arrosages) en ligne** (#301, P31a, F52 à F61) ; **PR 2 (points 12, 13, 10, 8 et 14, les PR 2 et 3 réunies) en ligne** (#303 de l'archive, P31b, P31c, F62 à F71) ; **lot 3 validé par le porteur le 8 novembre 2026 à 19 h 20** | Opus 5.5 · Élevé (lot 1), Très élevé (lots 2 et 3, tableau de bord) — interface seule, aucun calcul du moteur ne change, mais une erreur d'affichage sur téléphone se voit au champ |
| 3.9 | Scénarios, tests de pénurie, recette et publication | 🟡 contrat écrit et validé par le porteur le 30 octobre 2026 (`docs/shortage-contract.md`, D-052) ; **code commencé le 8 novembre 2026 au soir** sur le dépôt public : lot 2, une PR `fix/` par règle tranchée ; **correction 1 sur 4 codée**, l'arbitrage validé en parts réservées (D-077, F72 à F75) ; après les quatre corrections, l'écran d'arbitrage présenté comme un plan d'assolement, décidé par le porteur le 8 novembre 2026 à 20 h 40 (D-078), maquette d'abord | Opus 5.5 · Max (Fable 5.1 · Max avant D-055) — les cas de pénurie sont les plus délicats et les moins vérifiables mécaniquement |

### 3.3.1 — Retour à l'objectif seul dans le calcul du besoin

État : ✅ réalisée le 18 septembre 2026 ; recette sur le site faite le 9
octobre 2026 au soir par l'assistant dans le Chrome du porteur, sur son mot,
sur la semaine du 5 au 11 octobre, où l'ET0 (12,4 mm) est inférieure à
l'objectif (20 mm) : sous abri, pluie à 0, le besoin affiché vaut l'objectif
entier, 20 mm, et non 12,4 ; en plein champ, 23,2 mm de pluie réelle ramènent
le reste à 0 ; l'ET0 est affichée « Information · hors calcul » ; aucune
donnée modifiée ; point 4 fermé par le porteur le 10 octobre 2026.

Décision du porteur de projet du 18 septembre 2026 : l'ET0 est une information
d'aide à la décision, elle n'entre pas dans le calcul du besoin. C'est ce
qu'écrivent les sections 10 et 11 du cahier des charges. Correction d'une règle
existante, pas une fonctionnalité ; à réaliser en premier, avant la recette 3.4
qui s'appuie sur les besoins.

Contenu :

- `lib/irrigation-needs.ts` : la demande de la semaine devient l'objectif
  applicable, sans plafonnement par l'ET0 ; une ET0 absente ne rend plus le
  besoin incalculable, elle est seulement signalée comme partielle.
- Le champ « demande retenue » disparaît du modèle et de l'écran, l'objectif
  suffit ; le déficit relatif et le contrôle du remplacement manuel se
  rapportent à l'objectif.
- `app/irrigation/irrigation-needs-dashboard.tsx` : ET0 affichée comme
  information, explicitement hors calcul, avec ses dates manquantes.
- `docs/irrigation-needs-contract.md` : formules réécrites ;
  `docs/DECISIONS.md` : décision D-010.
- Aucune migration : les valeurs dérivées ne sont pas stockées et les
  remplacements manuels existants restent valides.

Effet attendu au champ : en semaine fraîche ou pluvieuse, le besoin affiché
remonte au niveau de l'objectif au lieu d'être réduit à l'ET0 ; en semaine
chaude, rien ne change.

Preuve de fin : tests réécrits avant le code (le test « la demande retenue
reste le minimum entre ET0 et objectif » devient « l'ET0 n'intervient pas dans
la demande », le cas de référence 25 mm avec ET0 19,2 attend désormais 25 mm,
une ET0 absente laisse le besoin calculable) ; `pnpm check` et compilation ;
recette sur le site privé sur une semaine où l'ET0 est inférieure à
l'objectif ; registre d'état, journal des changements et décisions à jour.

### 3.4 — Clôture (✅)

Aucune fonctionnalité nouvelle : il ne restait que la recette utilisateur sur le
site privé, avec les données réelles de la ferme. **Close le 25 septembre 2026,
entièrement passée, sans un seul défaut bloquant.** Le protocole, ligne par
ligne, est dans `docs/recette-3.4.md` ; la roadmap ne le recopie pas.

**Partie A — synchronisation météo automatique : close le 21 septembre 2026.**
Lignes A1 et A4 réussies deux matins consécutifs à 06:15, sans action du
porteur ; ligne A2 en échec le premier matin, corrigée (PR #46) et revérifiée
le 21. Le point ouvert 2 du registre d'état est fermé. La ligne A5,
conservation d'une pluie saisie au pluviomètre à l'arrivée de la réanalyse du
même jour, est vérifiée le 28 septembre sur la version déployée : 5 mm mesurés
retenus, la réanalyse du même jour valant 0 mm.

**Partie B — faisabilité et répartition : close le 24 septembre 2026, aucun
défaut.** Vingt vérifications sur vingt-deux passent, B1 à B5 et C ; B2.2 et C2
n'ont pas de cas à observer sur cette ferme cette semaine. L'arbitrage manuel
se comporte exactement comme spécifié, y compris sur les points délicats : même
fraction du besoin pour chaque planche retenue, reliquat redescendu aux
priorités inférieures quand rien n'est retenu, décision conservée après
rechargement, et allocations remises à zéro dès qu'un changement de priorité
rend la décision caduque — avec le message « L'ancien arbitrage Haute n'est
plus applicable ; les exclusions ne seront pas réactivées automatiquement ».

Les constats ont été relevés par l'assistant dans le navigateur du porteur, qui
lui en avait donné l'accès et l'autorisation de modifier les données, le
logiciel n'étant pas encore en service opérationnel. Deux écarts au protocole
sont motivés dans `docs/recette-3.4.md` : la pénurie a été créée en vidant
temporairement la réserve et en rendant le forage indisponible, les planches de
24 m² de cette ferme ne pouvant pas produire de pénurie par un besoin manuel
réaliste ; et les deux planches ont été montées en priorité haute, faute de
quoi il n'existait aucune priorité inférieure à observer. Tout a été remis en
état et vérifié après rechargement.

**Ligne B6 — close le 25 septembre 2026.** Sa part mesurable est passée au
parcours automatisé P7, qui provoque la pénurie sur les données de
démonstration et vérifie aux deux largeurs la mise en page, l'absence de
débordement et des cibles tactiles d'au moins 44 px. Le reste — le geste sur
l'appareil, que rien n'émule — a été constaté par le porteur sur son propre
téléphone, sur une pénurie réelle provoquée à sa demande puis rétablie :
1,00 m³ disponible pour 54,645 m³ de besoins et 164 cases « Servir ». **Le
point ouvert 1 est fermé et la recette 3.4 entièrement passée.**

Trois constats annexes non bloquants sont consignés en D de la recette : 139
planches sur 164 sans chaîne hydraulique définie, une incohérence de format de
date dans l'en-tête, et l'absence de tout parcours navigateur sur l'écran
d'arbitrage.

Le premier est **réglé le 24 septembre 2026** : le matériel réel de la ferme a
été saisi avec l'outil existant, sans modification de code, et la couverture
confirmée est passée de 15,44 % à **100 %**, zéro planche sans chaîne sur 164.
Le moteur de planning 3.5 travaillera donc sur une ferme entièrement raccordée.
Corrigé le même soir sur relecture du porteur : les serres sont en aspersion,
non en goutte-à-goutte.

Le troisième est **réglé le 25 septembre 2026** par le parcours P7, qui couvre
désormais l'écran d'arbitrage aux deux largeurs. **Reste le second**, les deux
formats de date mêlés dans l'en-tête, **corrigés le 25 septembre 2026**.
L'écran de placement a reçu son parcours le même jour (P8) : plus aucun écran
signalé n'est sans filet, et la dette de la recette 3.4 est soldée.

Deux défauts mineurs de plus, relevés en corrigeant l'équipement des serres et
consignés en D de la recette, **tous deux corrigés le 25 septembre 2026** :
archiver un matériel affichait « Ce matériel est introuvable » alors que
l'archivage réussissait, et les matériels archivés restaient
comptés dans « positionnés ».

Et un protocole nouveau, `docs/recette-materiel-reglages.md`, ouvert à la
demande du porteur : **modifier les réglages d'un matériel déjà posé**. La
capacité existe et fonctionne, vérifié le 24 septembre, mais ni recette ni
parcours navigateur ne l'éprouvaient. La vérification décisive reste à faire :
qu'une modification de réglage ne réécrive pas une irrigation déjà enregistrée
(D-006).

Preuve de fin : compte rendu de recette daté dans `docs/recette-3.4.md`, points
ouverts 1 et 2 fermés dans `ETAT_DU_PROJET.md`, aucun défaut bloquant restant.

### 3.1 bis — Mesure et historique du débit des ressources (✅ close le 25 septembre 2026)

Contrat `docs/resource-flow-contract.md`, écrit avant le code. Quatre décisions
du porteur y sont consignées : durée d'arrêt saisie à la main ; **une mesure ne
change jamais la référence toute seule, un bouton « Mettre à jour le débit de
la ressource » placé sous le résultat l'applique** ; le débit appliqué remplace
le débit nominal ; un index qui recule est refusé sauf changement de compteur
déclaré.

Précision apportée par le contrat : c'est le **débit en fonctionnement** qui
fait référence, parce que les projections multiplient le débit par les heures
de disponibilité.

La place du bouton est le point important. Le cahier des charges prévoyait une
promotion après validation explicite ; l'objection était qu'une validation
séparée s'oublie, laissant la faisabilité tourner sur un chiffre périmé alors
que la vraie valeur est déjà saisie. Placer la décision **au moment de la
mesure**, en un geste, lève l'objection sans retirer la décision au porteur.
Le même bouton reste disponible sur toute mesure de l'historique, pour un
relevé fait au forage sans réseau.

Cahier des charges, section 16. Relevés manuels d'un compteur de ressource
(date et heure, index en m³, durée d'arrêt éventuelle entre deux relevés) ;
calcul automatique du volume produit, de la durée écoulée, du débit moyen et du
débit moyen en fonctionnement ; historique et graphique des variations
saisonnières ; promotion d'un débit mesuré en débit de référence des projections
après validation explicite, avec conservation des anciennes valeurs.

Contenu : module de domaine pur pour les calculs, révisions de débit
historisées dans la persistance (sur le modèle des révisions de limite déjà
présentes), saisie pensée pour le smartphone au forage.

Réalisée en cinq PR les 21 et 22 septembre 2026. PR 1 le contrat ; PR 2
`lib/domain/resource-flow.ts` et ses quatorze tests ; PR 3 la migration 0015,
le dépôt `db/water-resource-flow-repository.ts` et ses treize tests
d'exécution ; PR 4 le panneau de saisie, le graphique, les actions et le
cinquième parcours navigateur ; PR 5 la clôture et le protocole de recette.
454 tests et quatorze vérifications navigateur aux deux largeurs.

**La recette réelle**, `docs/recette-3.1bis.md` : vingt-six vérifications sur
le forage de la ferme. C'est la seule partie que ni les tests ni les parcours
ne peuvent faire à la place du porteur — aucun d'eux n'a jamais lu un compteur.

Le porteur a relevé son compteur quatre fois, les 11, 15, 19 et 24 septembre
2026, appliqué la mesure du 24 comme référence, et jugé le résultat correct.
Les vingt-six lignes ont été relues sur la version déployée le 25 septembre :
vingt-quatre sans défaut, chaque chiffre affiché recalculé, et les cas que le
porteur ne pouvait pas provoquer — refus d'index, changement de compteur,
limite de prélèvement — provoqués par des relevés de contrôle puis supprimés.

Les deux autres lignes tenaient à une seule cause : le champ « date et heure »
ne porte pas de fuseau, et l'action qui enregistre le relevé tourne dans le
Worker, en UTC. Un relevé fait à l'instant était donc daté deux heures plus
tard et refusé comme daté dans le futur ; un relevé plus ancien était
enregistré deux heures trop tard. Corrigé le jour même. Le porteur a
essayé le geste avant que la correction ne soit en ligne et en a révélé deux
autres, d'écran ceux-là : le refus s'affichait six cents pixels au-dessus du
bouton, et le formulaire effaçait l'index même quand il refusait — le relevé
semblait pris, puis perdu. Les trois sont corrigés, et les deux lignes qu'ils
tenaient en échec ont été revérifiées sur la version déployée le 25 septembre
à 21:39. **Aucun test ni parcours ne pouvait trouver le premier** : ils tournent tous sur une machine à l'heure de la
ferme, où serveur et navigateur partagent le fuseau.

Une sixième PR est ajoutée à la demande du porteur le 22 septembre 2026 : le
**suivi des consommations**, c'est-à-dire le volume réellement sorti de la
ressource, cumulé par période et comparé à la limite de prélèvement autorisée.
Le volume est cumulé par mois civil, avec un total et, quand une limite est
active, la part qu'il occupe dans le volume autorisé — présentée comme une
enveloppe et non comme une preuve de conformité, une limite journalière pouvant
être dépassée un jour sans que le total du mois le montre.

Ajout du 25 septembre 2026, après la clôture : le bouton **« Corriger »** sur
chaque ligne du tableau des relevés. Le contrat le promettait depuis le
21 septembre — un relevé est une lecture, et une lecture fautive se corrige —
et la persistance savait le faire ; seuls manquaient l'identifiant du relevé
dans l'action et le bouton dans l'écran. L'écart s'est vu en ressaisissant les
quatre relevés du forage, faute de pouvoir les corriger.

Preuve de fin, **réunie le 25 septembre 2026** : tests unitaires reprenant
l'exemple du forage à 1,125 m³/h ; tests de persistance (Q2) sur l'isolation et
l'historisation ; parcours navigateur P5, qui éprouve désormais aussi un relevé
refusé ; recette réelle sur le forage de la ferme, close le 25 septembre ;
contrat `docs/` et registres à jour.

### 3.5.0 — Cadrage métier et agronomique du planning (✅ validé le 29 septembre 2026)

Étape sans code. Produit `docs/planning-contract.md` et des décisions
`D-0xx`. Le moteur ne démarre pas tant que ce contrat n'est pas validé par le
porteur de projet, qui a choisi le 18 septembre 2026 d'en être lui-même le
validateur agronomique. Le contrat est rédigé pour lui : langage non
technique, exemples chiffrés issus de la ferme, et pour chaque règle
discutable un réglage plutôt qu'une constante.

Questions à trancher :

- **Rôle de l'ET0.** Tranché le 18 septembre 2026 : l'ET0 est une information
  d'aide à la décision et n'entre pas dans le besoin. La correction du code de
  la 3.3 est la sous-tranche 3.3.1 ; le moteur reprend le besoin ainsi corrigé.
- **Objet planifié.** Une proposition de planning est une irrigation au sens
  de la 2.7 : matériel, réglage, emplacement, quantité, créneau. Confirmer que
  la validation d'une proposition crée une irrigation planifiée ordinaire, et
  que le planning n'introduit pas un second modèle d'événement.
- **Priorités et pénurie.** La 3.3 gère des priorités manuelles à trois
  niveaux et la 3.4 un arbitrage manuel explicite. Décider si le moteur
  reprend ces règles telles quelles, et comment il arbitre entre satisfaire
  partiellement toutes les cultures, satisfaire totalement les prioritaires
  ou reporter (section 27 du cahier des charges).
- **Contraintes opposables.** Liste fermée des contraintes que le moteur ne
  franchit jamais : limite journalière, volume minimum de sécurité des
  réserves, débit des pompes, incompatibilités de simultanéité, disponibilité
  des ressources, restrictions réglementaires.
- **Statuts.** Proposé, validé, réalisé restent trois états distincts ; la
  replanification produit une nouvelle proposition et ne réécrit jamais un
  événement réel.
- **Horizon et rythme.** Semaine lundi-dimanche, recalcul quotidien après la
  synchronisation météo, recalcul à la demande.
- **Explicabilité.** Chaque créneau proposé porte sa justification : besoin
  restant, priorité, contrainte limitante, hypothèse météo utilisée.
- **Scénarios de recette.** Jeux de données réalistes issus de la ferme, dont
  au moins un cas de pénurie, un cas de restriction et un cas de pompe saturée.

Preuve de fin : contrat relu et validé, décisions ajoutées à `DECISIONS.md`,
scénarios de test rédigés avec leurs résultats attendus chiffrés.

**Avancement, 29 septembre 2026 — contrat écrit, en attente de validation.**
`docs/planning-contract.md`, rédigé pour le porteur avec les chiffres relevés
sur la ferme le jour même (forage 0,511 m³/h, réserve de 60 m³ à 30 m³, pompe
8 m³/h, 79,2 m³ à planifier pour la semaine). Il répond aux huit questions du
bloc ci-dessus : l'ET0 hors dose (D-010) ; une proposition validée est une
irrigation planifiée 2.7, sans second modèle, les propositions vivant dans un
registre versionné par calcul ; les priorités et l'arbitrage 3.4 repris tels
quels, avec une conduite en pénurie réglable parmi les trois du cahier des
charges ; une liste fermée de contraintes opposables ; cinq statuts de
proposition et les trois de la 2.7, une proposition validée n'étant jamais
modifiée sans confirmation ; semaine lundi–dimanche, recalcul quotidien après
la météo, à la demande et sur événement ; une justification par créneau et la
liste de ce qui n'a pas été placé ; onze scénarios chiffrés. Douze réglages
avec valeur de départ — pluie prévue, doses, plages horaires, pénurie, report,
dose d'un matériel collectif — et douze questions à trancher, chacune avec une
recommandation. **Le soir même, le porteur tranche onze des douze questions
(D-024)** : pluie prévue à 100 % sauf sous abri, attente d'une pluie de plus
de 5 mm, dose d'une rampe au besoin le plus élevé, goutte-à-goutte d'abord,
au plus tôt, plages horaires réglables à l'écran, prioritaires d'abord puis
part égale, pas de report, un arrêté est une limite en m³/jour déjà modélisée
par la 2.8, validation une par une, par jour ou par semaine, aucun indicateur
à ajouter — des algorithmes de besoin par stade pourront un jour remplacer
l'objectif à l'entrée de la 3.3. Après explication, les doses sont
tranchées le soir même aux valeurs proposées ; les scénarios reçoivent leurs
valeurs exactes. **Le cadrage est validé en entier ; le moteur commence.**

### 3.5 — Moteur de planning hebdomadaire

Module de domaine pur, déterministe, sans dépendance à l'interface ni à la
base. Entrées : besoins 3.3, disponibilités et arbitrages 3.4, pompes et
contraintes 3.2, ressources 3.1, limites 2.8, météo 2.8. Sortie : propositions
de créneaux du lundi au dimanche avec justification, déficit résiduel explicite
par planche et par jour, jamais masqué. Persistance des propositions versionnée,
distincte de l'historique réel.

Preuve de fin : tous les scénarios de 3.5.0 verts ; invariants testés en
propriété (aucune proposition ne dépasse une contrainte opposable, la somme des
volumes proposés respecte la limite journalière, un déficit annoncé égale
exactement le besoin non couvert) ; calcul d'une semaine complète sur les
données de la ferme dans le budget du test de performance, garde de
complexité et non mesure de confort (D-027, le 4 octobre 2026, deux
secondes ; 500 ms depuis D-031, le 8 octobre 2026, le point 28 ayant ramené
le calcul à 101 ms sur la CI) ; tests de persistance Q2 ; contrat et
registre à jour.

**Avancement, 29 septembre 2026 au soir — première PR ouverte : le domaine
du moteur.** `lib/domain/planning/` : les réglages R1 à R12 validés (D-024),
les plages horaires qui passent minuit, la demande par planche — le reste à
placer de la 3.3, la part réglable de la pluie prévue, le jour d'après une
pluie annoncée, le matériel qui sert en premier —, l'eau et les pompes dans le
temps — la réserve heure par heure avec ses apports du forage, la ressource
directe, la pompe qui se partage, la limite journalière jour par jour —, la
pénurie selon les trois conduites et l'arbitrage 3.4, puis le placement :
priorité, déficit relatif, dose maximale, dose minimale sauf le dernier jour,
espacement, plage, capacité de pompe, niveau de réserve, limite, avec la
justification de chaque créneau et le motif de chaque manque. Treize tests :
les scénarios du contrat avec leurs valeurs exactes — 15 mm en 2 h 15 puis
5 mm en 45 min sur le bloc 2, tunnel 2 en 45 et 15 min, gag1 26 min, gag2 deux
fois 43 min —, la pluie prévue, le manque d'eau sous les trois conduites, la
restriction, la pompe saturée, l'arrosage partiel, le dernier jour, le
matériel sans pompe, la planche sans objectif ou sans matériel, l'arbitrage,
le déterminisme, deux cents semaines tirées au hasard sous invariants, et une
semaine de 138 planches calculée en 330 ms. **Fusionnée le soir même
(#109).**

**Seconde PR, 29 septembre 2026 — le registre et le service.** Migration
additive `0017` : les réglages et leur journal, les calculs, les
propositions avec leurs cinq statuts et leurs contraintes en base. Le dépôt
enregistre un calcul et ses propositions en un seul lot, remplace les
propositions encore proposées du calcul précédent, garde les décidées, et
décide d'une proposition — validée avec son irrigation planifiée, ou
refusée — une seule fois et pour son seul propriétaire. Le service assemble
les entrées réelles — irrigations de la semaine toutes saisons, météo sans
actualisation, eau, pompes, matériel, limites, réglages, calcul précédent,
arbitrage validé — et fait tourner le moteur. Sept tests de persistance :
réglages enregistrés, journalisés, refusés quand absurdes, cache invalide
ramené aux valeurs de départ ; calcul enregistré puis remplacé, décision
unique, isolation, statut « expirée » à la lecture, créneau vide et statut
inconnu refusés par la base ; le service sur une ferme de test en base —
deux créneaux de 10 mm à 24 h d'écart, 0,6 m³ chacun, lus tels quels ; un
second calcul qui remplace les proposées et garde la validée, dont
l'irrigation planifiée réduit le besoin ; un calcul vide sans objectif, avec
le motif. Trouvé et corrigé au passage : le fournisseur météo utilisait une
propriété de paramètre TypeScript que Node ne sait pas retirer, ce qui
rendait tout service qui lit la météo intestable sous Node. **Fusionnée le
soir même (#110).**

**Troisième PR, 29 septembre 2026 — les actions, la validation et le recalcul
quotidien.** La validation d'une proposition
(`lib/services/planning-validation-service.ts`) crée une irrigation planifiée
ordinaire par le circuit de « Planifier » : couverture recalculée et comparée
à la proposition, pompe vérifiée par la 3.2, limite journalière vérifiée par
la 2.8, volume inconnu sous limite refusé, irrigation créée puis proposition
marquée validée avec l'identifiant de l'irrigation ; expirée, remplacée,
décidée ou d'un autre propriétaire : refus sans rien créer. Le refus d'une
proposition ne décide qu'une fois. Les actions serveur
(`app/irrigation/planning-actions.ts`) : calculer, lire, régler, valider
une, plusieurs ou toutes les propositions données — chacune avec sa réponse,
un refus n'arrêtant pas les suivantes —, refuser ; propriétaire de la
session, saison vérifiée. Le recalcul quotidien suit la synchronisation
météo du matin dans la même route interne, exploitation par exploitation,
un échec journalisé sans nommer personne. Pour que la validation passe par
la même garde que « Planifier » et se teste sous Node, la garde de la limite
journalière à la création est déplacée dans un service, l'action l'important
d'où elle l'importait ; et le résultat de création d'une irrigation nomme
désormais l'irrigation créée. Quatre tests de persistance : validation avec
pompe, montants et lien ; pas deux fois ; refus expiré, remplacé, autre
propriétaire, réglage changé ; limite journalière qui garde la validation
comme elle garde « Planifier » ; liste des exploitations du recalcul. Les
actions ne sont encore appelées par aucun écran : c'est la 3.6. **Fusionnée
le soir même (#111).** Le moteur est développé ; sa preuve de fin demande
encore la recette réelle sur une semaine de la ferme, avec l'écran de la 3.6.

**Recette réelle, 29 septembre 2026 au soir** (`docs/recette-planning.md`),
sur la version déployée, semaine du 28 septembre : 60 propositions en
quatre secondes depuis l'écran. Ce qui est juste, vérifié à la main : les
goutte-à-goutte (10 mm en 43 min, 0,48 m³, puis 7,2 mm 24 h plus tard), les
rampes de serre (15 mm en 1 h 30, 3,84 m³, puis 5 mm ; le tunnel 1 à 10 mm
après l'aspersion du matin, retenu par l'espacement puis par la pompe), la
pompe (7,68 puis 7,33 et 7,35 m³/h, jamais plus de 8, quatre rampes de bloc à
la fois), la réserve (de 0 à 57 m³, jamais sous le minimum ni au-dessus de
60), les plages, une plage qui passe minuit rangée sous son jour. Ce qui ne
va pas, au jugement du porteur : les rampes de bloc au réglage « 5 planches »
arrosent à 7,5 mm/h au centre et 2 mm/h au bord ; la règle R11 (D-024,
point 4) prend pour référence une planche de bord — à besoin égal, la
première par ordre de nom —, la rampe s'arrête à 2 h quand le centre atteint
R5, et le moteur revient chaque nuit pour le reste du bord : 60 mm au centre
pour 17,2 demandés, 130,956 m³ proposés pour 84,178 m³ demandés, réserve
projetée à 0 dès vendredi, et les blocs 3, 8 et fleurs 3 sans créneau parce
que leur première planche, atteinte à 1,5 mm/h par la rampe voisine, tombe
sous l'espacement R7 chaque nuit. 🔶 **Décision demandée** : R13, la part
du débit nominal d'un matériel en dessous de laquelle une planche ne
commande pas l'arrosage (ni référence de dose, ni R6, ni R7 ; eau reçue
comptée ; reste affiché « portée du matériel insuffisante »), 50 % proposé.
Deux défauts d'explication, à corriger avec R13 : le motif « temps de
pompage insuffisant » mis par défaut quand aucune plage ne reste, même par
espacement ; le niveau projeté de la réserve affiché au moment du placement
et non à la fin du plan (57 m³ dimanche à côté de 0 m³ vendredi). Le moteur
n'est pas recevable sur cette ferme avant la décision et une seconde
recette ; l'écran, lui, a tenu.

**R13 tranchée le 29 septembre 2026 au soir (D-025), PR de la portée
ouverte dans la nuit.** Contrat d'abord : R13 dans les réglages, un cas
limite, la note « La portée » et la décision 13. Dans le moteur
(`demand.ts`, `engine.ts`) : chaque planche arrosée par un matériel
*commande* ou non selon la part R13 du taux le plus fort ; le matériel qui
sert une planche se choisit parmi ceux qu'elle commande, sinon « portée du
matériel insuffisante » ; la planche la mieux arrosée qui garde un besoin
fixe la dose, à taux égal le besoin le plus élevé (R11) ; R6 et R7 ne
comptent que les planches qui commandent, pour les propositions comme pour
les irrigations réelles ; un reste sans cause reçoit son vrai motif —
portée, dose sous le minimum, ou pompe — ; « espacement » et « plus de
plage » remplacent le « temps de pompage » mis par défaut ; le niveau
projeté de la réserve se relit sur le plan fini, ce qui a révélé et corrigé
un accesseur qui rendait l'heure du minimum au lieu du niveau. Réglage R13
à l'écran, dans le pli des réglages ; un réglage enregistré avant R13 prend
sa valeur de départ à la lecture. Cinq tests de la portée sur les chiffres
de la ferme (`tests/planning-reach.test.ts`) : une rampe à profil tourne une
fois pour son centre, 3,648 m³ en 2 h ; le débordement de 1,5 mm/h sur le
bloc voisin ne bloque plus sa rampe, réel ou proposé ; sans plage restante,
le motif dit l'espacement ou la fin de la semaine ; le niveau projeté est
celui du plan fini ; la part se valide et décide qui commande. Les treize
tests du moteur et les deux cents semaines d'invariants passent inchangés.

**Seconde recette réelle, le même soir à 21 h 20, PR #114 déployée.** Sur
les mêmes données que la première, réserve à 30 m³ laissée telle quelle pour
comparer : 49 propositions, 69,243 m³ au lieu de 130,956, budget « 92,661 m³
mobilisables pour 70,72 demandés, servi 100 % », temps de pompage manquant
à zéro, 99 planches non servies toutes chiffrées — 72 « portée du matériel
insuffisante », 27 « sous la dose minimale » —, calcul en 3 s. Le bloc 10 a
son unique créneau de 2 h à 15 mm et 3,648 m³ ; chaque bloc de même ; les
blocs 3, 8 et fleurs 3 sont servis la première nuit ; pompe jamais au-dessus
de 8 m³/h, plages et espacement tenus. Mais le rejeu à la main des 49
créneaux sur la réserve retrouve les niveaux affichés jusqu'à 4,15 m³
mercredi 00 h 51, puis la réserve est à sec à 01 h 25 et le plan tire
21,12 m³ qui n'existent pas jusqu'à 06 h 42 — sept rampes et douze
goutte-à-goutte affichés « 0,00 m³ projetés » — pendant que le résumé dit
« Manque d'eau 0,00 m³ ». Cause lue dans `supply.ts` : le niveau est borné à
zéro à chaque rupture avant d'être comparé au minimum de sécurité, qui vaut
0 sur la ferme ; le manque vaut donc toujours 0, et le test d'invariant lit
le même niveau borné. Le contrat, lui, est clair : « pas 40 m³ la première
nuit ». **Sa preuve de fin attend une correction** — niveau affiché borné,
faisabilité jugée sur le niveau non borné par zéro du début du créneau à la
fin de l'horizon, test sur les chiffres de la ferme qui échoue d'abord,
invariant rejoué sans la borne — **puis une troisième recette.** Détail dans
`docs/recette-planning.md`.

**Avancement, 2 octobre 2026 au soir.** La garde est corrigée (PR #125,
fusionnée et déployée le 3 octobre) : la projection qui juge est bornée par la
capacité seule et court du début du créneau à la fin de l'horizon ; un créneau
qu'attendre l'apport ne sauve pas est raccourci par bissection à la plus
longue durée que la réserve accepte, sinon refusé ; le niveau affiché reste
borné par zéro. Le test des chiffres de la ferme — 30 m³, 0,511 m³/h,
minimum 0 — échouait avant la correction, 48,51 m³ tirés la première nuit pour
39,78 disponibles, et passe après ; l'invariant est rejoué sans la borne. Au
passage, une carte validée ou refusée relue avec un calcul plus récent porte
la date de son calcul. Règle précisée dans `docs/planning-contract.md`
(point 5 « L'eau », note « La garde de la réserve »). **Reste la troisième
recette** : attendu, les vagues des blocs décalées aux nuits suivantes au
rythme du forage.

**Troisième recette réelle, 5 octobre 2026, sur la version déployée**
(`docs/recette-planning.md`, « Troisième recette »), dans le navigateur du
porteur, précédée d'une lecture seule le 4 octobre. Le recalcul du matin et
le lundi d'une nouvelle semaine sont constatés : plans « recalcul du matin »
de 06 h 15 les 4 et 5 octobre, celui du 5 sur la semaine nouvelle, 37
créneaux, 38,26 m³, 73 planches non servies toutes chiffrées, budget
« 112,62 m³ mobilisables pour 36,716 demandés ». Les 37 créneaux rejoués à
la main sur la réserve retrouvent les niveaux affichés à 0,02 m³ près, de
25,619 m³ lundi minuit à 59,997 dimanche, jamais sous 0 ni au-dessus de
60 ; « Manque d'eau 0,00 m³ » est vrai cette fois ; la pluie prévue de
mercredi et jeudi, au-dessus de R3, est laissée passer ; la pompe ne dépasse
jamais 8 m³/h ; R6 et R7 tiennent. Le recalcul à la demande prend 1,99 puis
1,90 s depuis le navigateur ; le refus et la carte d'un calcul antérieur
datée (PR #125) sont vérifiés. Mais la semaine ne met pas la réserve en
pénurie : **la garde (point 19) n'est prouvée que par le test des chiffres
de la ferme**, à constater sur une semaine sèche ou avec une observation
basse de la réserve, sur le mot du porteur. Cinq constats au jugement du
porteur (points ouverts 29 à 33) : la météo actualisée à l'ouverture de la
page a porté la pluie prévue à 15,7 mm, le reste brut de plein champ sous
le seuil de 5 mm, et les 26 créneaux de plein champ ont disparu du plan
recalculé sans trace ; la réserve part de l'observation du 25 septembre
prise telle quelle, sans l'apport des dix jours écoulés ; une proposition
refusée est reproposée à l'identique, contre la lettre du contrat ; le
réglage R1 n'agit pas, le calcul se faisant à 06 h 15 ; deux motifs
d'explication inexacts. **Le moteur fait ce que le contrat dit sur cette
semaine ; sa clôture est au jugement du porteur.**

**Quatrième recette réelle, 5 octobre 2026 au soir, la pénurie fabriquée**
(`docs/recette-planning.md`, « Quatrième recette »), sur le mot du porteur —
données expérimentales, à remettre en état —, dans son navigateur, sur la
version déployée. Observation de la réserve à 25 m³, puis six calculs à
l'attendu écrit avant : forage indisponible, minimum de sécurité à 20 puis
40 m³, limite de prélèvement du forage à 10 m³/jour, limite journalière
d'irrigation à 10 m³/jour du mardi au dimanche (scénario 4 du contrat), R2 à
0 % pour ramener le plein champ dans le besoin ; ferme remise en état, le
recalcul final retrouvant le plan du départ. La garde tient sur la ferme :
jamais sous le minimum, 0,001 m³ quand il vaut 0, 20,00 et 40,00 exactement
quand il est relevé ; le stock consommé au litre près ; les créneaux
raccourcis ou décalés à l'heure exacte où l'apport comble le manque ; les
vagues décalées aux nuits suivantes au rythme du forage, ce que la recette
attendait ; le budget stock − minimum + apport, plafonné par la limite de
prélèvement ; la part égale R9 comme cible ; la limite journalière comme règle
forte, aucun jour limité au-dessus de 10 m³. **Le point 19 est fermé.** Le
porteur a tranché les points 29 (le logiciel expose les faits annoncés,
l'utilisateur décide, D-028), 30 (observer la réserve avant de se fier au
plan) et 32 (R1 retiré, D-029, PR ouverte le soir même). Trois constats
nouveaux, points 34 à 36 : le temps de calcul sur le site varie de 3 s à plus
de 45 s pour le même état ; sous limite journalière, la coupe est nommée
« stock et ressources insuffisants » et la cible ignore le lundi sans limite,
contre le scénario 4 ; la part égale est une cible, la dernière planche
examinée reçoit 0 % quand les autres ont 30 %, et « Manque d'eau » ne vaut pas
« demandés moins placé ». Le point 31 est tranché le soir même (D-030) : le
créneau refusé est exclu pour le reste de la semaine, le contrat est corrigé,
le moteur lira les refus dans la 3.7. **La clôture de la 3.5 reste au jugement
du porteur, les points 31 (moteur à faire), 33, 35 et 36 ouverts à son contrat
ou à son écran.**

**8 octobre 2026** : les quatre PR du 5 octobre (#135 à #138) fusionnées par
le porteur vers 21 h et déployées, déploiement vérifié. Recette du retrait de
R1 sur la version déployée, dans le navigateur du porteur : sur ordinateur, le
pli « Réglages du planning » ouvert d'un clic, dix-neuf champs R2 à R13, aucun
champ R1, la note du recalcul du matin affichée, un résumé sans heure ; à
390 px, rendu dans un cadre de 390 px inséré dans la page, la fenêtre
maximisée ayant ignoré le redimensionnement, note lisible et aucun débordement
horizontal ; point 32 fermé, constat de l'assistant. Point 28 fermé : 101 ms
sur la CI, budget du test ramené à 500 ms (D-031, PR #144 fusionnée et
déployée le soir même).

**9 octobre 2026** : sur la liste des points en attente de son jugement, le
porteur tranche d'un coup — point 36, fraction réservée à chaque planche en
pénurie (D-037) et écart du manque d'eau expliqué à l'écran sans changer le
calcul (D-038) ; point 40, historique aligné sur le jour de pose de l'objectif
(D-039) ; points 33 et 35 à corriger ; clôture de la 3.5 après les points 33,
35 et 36. Points 33 et 35 corrigés le jour même (PR #156 fusionnée et déployée
le jour même) : la contrainte limitante nomme les matériels qui tenaient la
pompe au départ voulu ou la prennent à la fin, lus au moment du conflit et non
une milliseconde avant le départ ; le motif du moment reste celui qui a fixé
le jour, l'espacement l'emportant sur la pluie ; la coupe sous limite
journalière porte le motif « limite journalière » et le résumé le dit, et la
limite ne borne plus le budget de la semaine dès qu'un jour de l'horizon est
sans limite. Contrat précisé avant le code, quatre tests du moteur rouges
d'abord. Le fichier de tests du moteur étant à 594 lignes comptées pour une
limite de 600, la ferme de test passe d'abord dans
`tests/support/planning-fixtures.ts` par une PR de restructuration seule
(`chore/ferme-de-test-du-moteur`, PR #157 fusionnée et déployée le jour même).
Point 36 corrigé le jour même, à sa suite (PR #158 fusionnée et déployée le
jour même) : un registre des parts par chaîne d'eau au budget fini, le créneau
borné à ce que ses parts paient, le débordement pris sur l'eau non attribuée
puis sur les parts de ses propres planches, les parts non reçues libérées en
fin de tour et redistribuées par la conduite ; sous les cartes, une note
chiffre l'écart entre demandé, placé et manque d'eau sans changer le calcul.
Mécanisme écrit au contrat avant le code, trois tests rouges d'abord. Reste,
avant la clôture par le porteur, sa recette du point 36 sur le site, sur la
version déployée — faite le 10 octobre, ci-dessous. Point 40 corrigé le jour
même, hors 3.5 (PR #159 fusionnée et déployée le jour même) : l'historique
compte un objectif à partir de son jour de pose, la règle vivant en un seul
endroit avec le tableau des besoins. Point 34 instrumenté le jour même sur son
mot (PR #160 fusionnée et déployée le jour même) : plutôt qu'une piste moteur,
chaque calcul de la semaine et chaque affichage de la page écrivent leurs
durées par phase, en millisecondes entières, sans identifiant de personne ;
règle au contrat du planning, chronomètre à horloge injectable, deux tests
rouges d'abord ; la lecture est expliquée pas à pas dans
`docs/publication.md`. Journaux lus le soir même par l'assistant dans le
Chrome du porteur, sur son mot : trois recalculs à la demande sur la ferme en
455 à 545 ms de calcul et 498 à 577 ms de ré-affichage, 1,65 à 1,83 s
d'invocation pour 2,3 s vus du navigateur, aucune phase longue ni variable, le
3 s à 45 s non reproduit, tous les instantanés en cache ; 429 d'OTF sur
l'actualisation forcée ; la cause reste à nommer, la piste d'une lecture OTF
en direct au moment du clic à surveiller dans les mêmes journaux ; le porteur
tranche le soir même : attendre une occurrence, aucune correction avant
(registres PR #161 fusionnée et déployée le jour même).

**10 octobre 2026** : recette du point 36 faite sur le site, sur la version
déployée, par l'assistant dans le Chrome du porteur, sur son « reprends le
travail », pénurie fabriquée et données remises en état (cinquième recette de
`docs/recette-planning.md`) : forage indisponible, minimum de sécurité relevé
à 16 puis 20 m³ ; à 50 % puis 28 % de part, les quatre tunnels reçoivent
chacun leur fraction, le dernier examiné — celui qui restait sec le 5 octobre
— compris, la somme des créneaux ne dépasse pas le budget, la réserve s'arrête
exactement à son minimum, la ligne de budget dit la part ; la note du manque
d'eau s'affiche à 28 % pour 0,002 m³ qui sont un résidu d'arrondi des créneaux
à la seconde entière, sous un libellé qui nomme une autre cause : point 41,
tranché l'après-midi, ci-dessous. Trois recalculs en 1,83 à 2,50 s, le 3 s à
45 s du point 34 ne s'est pas produit. La clôture de la 3.5, suspendue aux
points 33, 35 et 36, est au jugement du porteur (registres PR #163 fusionnée
et déployée le jour même).

**10 octobre 2026, après-midi** : point 41 tranché par le porteur (D-040, « je
suis ta recommandation pour le point 41 ») et corrigé le jour même en une PR
`fix/` à part : la note ne paraît, pour l'eau placée à côté en plus ou en
moins, qu'au-delà du résidu d'arrondi des secondes — un centième de millimètre
par planche et par créneau qui l'arrose, au prix de la surface mouillée de
l'application, et au moins un litre — ; le manque pour une autre raison garde
son seuil d'un litre ; calcul du manque, ligne de budget et parts inchangés.
Contrat « Interface » précisé avant le code ; deux tests rouges d'abord, sur
les chiffres de la ferme (quatre créneaux de 2 008 s à 10 mm/h sur 896 m² : la
note doit se taire, et reparaître au-delà des 9 L de résidu) et sur la ferme
de test du moteur (5,12256 m³ de budget pour les tunnels, un résidu de 2 L sur
512 m²) ; contrôles de la branche verts. PR #164 fusionnée à 13 h 15 et
déployée à 13 h 21 ; recette sur le site ci-dessous (registres PR #164).

**10 octobre 2026, 13 h 55, clôture.** Recette du point 41 faite de 13 h 23 à
13 h 34 sur le site, sur la version déployée, par l'assistant dans le Chrome
du porteur (sixième recette de `docs/recette-planning.md`) : la pénurie de T2
du matin refaite à l'identique, forage indisponible et minimum de sécurité à
20 m³, 5,00 m³ mobilisables : mêmes quatre créneaux de 5,6 mm pour 4,998 m³,
même réserve à 20,002 m³ au plus bas, même manque de 12,92 m³, même part de
28 %, et aucune note sous les cartes là où la version du matin écrivait
« l'écart tient à 0,002 m³ de besoin couverts par une eau comptée sur une
surface plus petite que celle de leur propre matériel » ; données remises en
état par l'écran, plan du matin retrouvé, deux recalculs en 1,5 s. Le porteur
tranche, sur quatre questions : point 4 fermé (« Fermer le point 4 »), points
36 et 41 fermés (« Fermer les deux »), point 34 laissé en veille, non
bloquant, à rouvrir à la première occurrence dans les journaux (« Le laisser
en veille, non bloquant »), sous-tranche 3.5 close (« Oui, clore la 3.5 »). Au
regard de la preuve de fin du bloc : les scénarios du contrat et les deux
cents semaines d'invariants verts, le calcul de la ferme à 101 ms pour un
budget de 500 ms (D-031), les tests de persistance Q2, et six recettes réelles
sur la ferme — trois en pénurie fabriquée — dont les constats sont tranchés ;
restent au moteur de la 3.7 la lecture des refus (point 31, D-030) et, en
veille, le temps de calcul du point 34. La 3.7 ne commence que sur le
« vas-y » du porteur (registres PR #165, fusionnée à 14 h 19 et déployée à
14 h 25 le jour même).

### 3.6 — Interface du planning

Vue semaine sur ordinateur et à 390 px, lecture des justifications, conflits
visibles, ajustements manuels (déplacer, réduire, refuser, ajouter), validation
qui crée des irrigations planifiées 2.7. Aucune règle métier dans les
composants : l'interface appelle le moteur et les services.

Preuve de fin : parcours navigateur Q5 étendus au planning ; recette 390 px
sans débordement horizontal ; tests des fonctions pures de présentation ;
aucun fichier au-dessus de la limite de taille fixée en Q3.

**Avancement, 29 septembre 2026 au soir — PR ouverte.** Contrat d'abord :
section « Interface (3.6) » et notes de mise en œuvre dans
`docs/planning-contract.md`. La présentation pure
(`lib/domain/planning/presentation.ts`, cinq tests) : libellés des statuts et
des motifs, semaine en jours à la ferme — une plage qui passe minuit
appartient au jour où elle commence —, résumé, planches non servies,
ajustement d'une proposition (la durée suit la dose au prorata, la fin suit le
début), formulaire des réglages dans les deux sens et son résumé d'une ligne.
L'écran (`app/irrigation/planning/`, feuille `styles/planning.css`) : en-tête
avec le dernier calcul, son déclencheur et les hypothèses ; six cartes de
résumé ; budget d'eau par chaîne ; les sept jours avec leurs propositions,
chacune une carte — créneau, matériel, dose, volume ou « volume inconnu »,
pompe ou « non vérifiée », statut, et d'un clic la justification et les
planches avec leur besoin avant et après — ; « Valider », « Ajuster »,
« Refuser » par proposition, « Valider les N propositions du jour » par jour,
« Valider toute la semaine » ; « Ajouter un créneau à la main » qui ouvre le
formulaire « Planifier » ; la liste « Non placé » avec les motifs ; le pli
« Réglages du planning » R1 à R12 avec l'historique. La page sert le dernier
plan et les réglages avec le reste de ses données ; le plan se relit au retour
de l'onglet, sans recalcul. Le service de validation accepte un ajustement
par les mêmes gardes (un test de persistance de plus) ; deux actions de plus :
validation ajustée, historique des réglages. **Parcours P10** aux deux
largeurs : objectif posé sur la semaine précédente, plage horaire réglée,
plan calculé, justification lue, proposition ajustée à 6 mm puis validée
jusque dans les irrigations à venir, jour validé, proposition refusée, liste
« Non placé », cible tactile, remise en état. Trois gestes sur l'existant :
la mesure de cible tactile de P7 partagée dans le support des parcours, le
formulaire d'irrigation qui écoute la demande « Planifier » du planning, et
P9 qui retrouve sa propre ligne dans l'export — les irrigations annulées de
P10 y passent devant. **Fusionnée et déployée le soir même (#112).**

**Close le 29 septembre 2026 au soir.** Recette réelle sur la ferme
(`docs/recette-planning.md`) : calcul en 4,0 s, ajustement d'une proposition
validé en 2,0 s jusque dans « À venir ou à terminer » (165 L = 5 mm × 33 m²,
note « ajustée »), refus en 0,8 s, annulation en 3,0 s, lecture à 390 px sur
la version déployée sans débordement (document 373 px pour 388), bouton
« Valider » de 44 px. La preuve de fin est faite : parcours P10, 390 px,
tests de présentation, aucun fichier au-dessus de la limite.

### 2.11 — Pose datée et stockage du matériel (✅ close par le porteur le 30 octobre 2026)

Rattachée à la tranche 2, qui a créé le placement du matériel, et placée avant
la 3.7. Constat du porteur, le 27 octobre 2026 : un goutte-à-goutte se pose
pour quelques semaines, s'enlève, se range et se repose ailleurs ; le logiciel
ne connaît qu'une position par saison, sans date, et « Retirer la position »
est refusé dès que le matériel a servi à une irrigation (point ouvert 43).

**Contrat écrit le jour même**
(`docs/equipment-placement-periods-contract.md`, D-043), relu et confirmé par
le porteur le jour même, un message expliquant toujours le refus d'une
validation (règle 14). En bref : la pose a une date de pose et, une fois
retirée, une date de retrait ; un matériel sans pose ouverte est stocké ;
retirer, déplacer ou reposer n'efface rien ; besoins, faisabilité et planning
ne comptent que le matériel posé ; une irrigation planifiée sur un matériel
retiré est signalée, jamais supprimée ; une date se reporte dans le passé,
jamais dans le futur. La règle vaut pour tout le matériel, rampes comprises.

**Place et modèle.** En 16 de l'ordre d'exécution, avant la 3.7. Opus 5.5 ·
Très élevé — pas de règle agronomique nouvelle, mais un changement qui touche
le modèle de données, l'historique, les besoins et le planning à la fois, où
une erreur fausserait l'historique sans se voir. Code en trois PR : domaine,
persistance, calculs et écran ; recette dans le navigateur du porteur en
Sonnet 5.5 · Moyen.

**Avancement.** PR 1 sur 3, fusionnée et déployée le 27 octobre 2026 au soir
(#180) : le domaine (`lib/domain/equipment-placement-periods.ts`) — état
posé, stocké ou jamais posé, contrôle des dates de pose et de retrait, pose
ouverte à un instant, blocage d'une irrigation planifiée et d'une
proposition, messages —, avec treize tests tirés des onze scénarios du
contrat. PR 2 sur 3, ouverte le même soir : l'enregistrement en base —
migration 0018 (dates de pose et de retrait sur la pose courante, registre
des poses en ajout seul), retrait devenu stockage même après une irrigation,
déplacement qui ferme une pose et en ouvre une, irrigation refusée sur un
matériel stocké, irrigation planifiée qui ne démarre ni sur un matériel
stocké ni reposé ailleurs (règle 13) —, onze tests de persistance, et une
correction du domaine : une irrigation en cours se reconnaît à son minuteur.
PR 2 fusionnée par le porteur et déployée le 27 octobre 2026 à 21 h 33 (#181),
quatre jobs verts, migration 0018 appliquée.

Le 29 octobre 2026, sur la recommandation de l'assistant acceptée par le
porteur, la PR 3 est découpée en deux. **PR 3a, les calculs** : une
proposition du planning dont le matériel a été retiré ou reposé depuis le
calcul se refuse avec le message de la règle 14, qui nomme le matériel, la
date du retrait et l'heure du calcul ; une validation de la journée valide les
autres et donne ce motif sur la carte de celle-ci ; et, sur la décision D-044
du porteur prise le même soir, une irrigation planifiée que la règle 13
empêche de démarrer ne compte plus dans les besoins, la faisabilité, le
planning, les réserves, la limite journalière ni la pompe, jusqu'à ce que le
matériel soit reposé au même endroit. Tests : un test du domaine, quatre tests
de persistance et de service, dont les scénarios 6 et 8. PR 3a fusionnée par
le porteur et déployée le 29 octobre 2026 à 22 h 17 (#187), quatre jobs verts.
**PR 3b, fusionnée et déployée le même soir à 22 h 48 (#188)** : l'écran
(états, dates de pose et de retrait, « Retirer (stocker) », « Reposer »,
historique des poses, signal des irrigations planifiées, parcours navigateur
aux deux largeurs) et la saisie après coup sur la pose de son heure (règle 12,
scénario 9), qui a besoin de pouvoir dater une pose dans le passé : écrite
d'abord dans la 3a, elle y refusait une irrigation saisie pour une heure
antérieure à une pose enregistrée le jour même, ce que le parcours P3 a
montré. La 3b ajoute le parcours P11 (retirer, stocker et reposer un
goutte-à-goutte, aux deux largeurs) et adapte P6 et P8 aux nouveaux textes ;
les parcours datent leur pose du 1er janvier de la saison.

**Recette réelle passée le 30 octobre 2026** (`docs/recette-2.11.md`), dans le
Chrome du porteur, sur un matériel d'essai posé, retiré, reposé et déplacé à
des dates choisies puis supprimé, la 2.11 n'effaçant rien : treize
vérifications conformes, ordinateur et 390 px, ferme revenue à l'état de
départ. Le réglage « minimal » des treize rampes était déjà celui de la rampe
bloc 1. Un défaut ancien, sans lien avec la 2.11, trouvé pendant la recette :
une date de début incomplète ou vide ferme la page d'irrigation (point ouvert
44), corrigé le jour même sur le choix du porteur, dans une PR à part (#190),
déployée à 13 h 01. Correction constatée sur le site le jour même, dans le
Chrome du porteur : date de début vidée ou tapée chiffre par chiffre, dans
« Déjà réalisée » comme dans « Planifier », la page reste là ; rien
enregistré. Deux écarts mineurs relevés au passage, sans rien d'enregistré à
tort : le volume estimé à 0 L quand la date ne se lit pas (point ouvert 45) et
le bouton « Planifier l'irrigation » actif sans date (point ouvert 46).
Point 44 fermé par le porteur le jour même. Les cinq PR Dependabot sont
regroupées en une PR le même jour. Le porteur tranche le jour même les points
45 (« il faut marquer inconnu ») et 46 (« rendre le bouton inactif sans
date ») ; tous deux corrigés le jour même. En retirant pour de vrai son
goutte-à-goutte, le porteur voit un retrait daté de la minute même refusé
comme futur, l'horloge de son ordinateur avançant sans doute de quelques
secondes sur celle du serveur (point ouvert 47) : une date en avance de deux
minutes au plus vaut désormais maintenant, corrigé le jour même sur son mot.
Son goutte-à-goutte retiré pour de vrai par l'écran, le porteur ferme le point
43 le jour même. Les corrections des points 45, 46 et 47 sont constatées sur
le site le jour même, dans son Chrome (`docs/recette-2.11.md`) ; l'horloge de
son ordinateur concordait alors avec celle du serveur, si bien que la cause du
point 47 n'est pas confirmée. Le porteur ferme les points 45 à 47 le jour
même. Il close la sous-tranche le soir même (« Ok, vas-y, ferme-la »), sans
constat séparé de la lisibilité sur son téléphone.

Preuve de fin : les onze scénarios du contrat en tests, les tests de
persistance, un parcours navigateur aux deux largeurs, une recette réelle sur
la ferme.

### 3.7 — Suivi d'exécution et replanification

Réaction aux événements réels : irrigation partielle, annulée ou en retard,
pluie observée différente de la prévision, stock corrigé, restriction
nouvelle, besoin modifié. Recalcul, comparaison proposé contre validé,
notification par le Worker Push existant. L'historique réel n'est jamais
modifié. Le moteur lit les décisions du maraîcher : un créneau refusé est
exclu des calculs suivants de la semaine, le besoin placé ailleurs (D-030,
point ouvert 31).

Preuve de fin : scénarios de replanification testés, idempotence d'un
recalcul sans changement, le refus de la rampe du tunnel 4 rejoué en test
(D-030), tests de persistance, parcours navigateur, recette réelle sur une
semaine d'exploitation.

**Cadrage, 30 octobre 2026 au soir.** Contrat `docs/replanning-contract.md`
écrit avant tout code, à partir du contrat du planning, de D-030 et de la
2.11, sur le constat du code de `main` : le plan ne se recalcule que le
matin et à la demande, le moteur ne lit pas les refus, aucune suggestion
n'existe sur un arrosage validé, « en retard » n'existe pas, le Worker de
notification ne connaît que la fin du minuteur. Six questions posées au
porteur avec une recommandation chacune, **toutes tranchées le soir même à
21 h 19 (D-051)** : recalcul automatique sur événement, une proposition
reproduite gardant son identité ; suggestions « Réduire » ou « Annuler » au
seuil de la dose minimale R4 ; restriction posée après coup, réduction
suggérée priorité basse d'abord ; retard à 30 minutes, réglage R14 ; deux
notifications par l'alarme existante du Worker, aucun réglage Cloudflare ;
recette réelle dès la mise en ligne sur son « vas-y ». Le moteur ne gagne
aucune règle agronomique nouvelle : il lit les refus et réutilise ses
propres règles pour la dose utile ; aucun arrosage validé n'est modifié
sans le geste du maraîcher. Découpage en cinq PR : lecture des refus (ferme
le point 31), recalcul sur événement, suggestions, retard et notifications,
écran et parcours P12. Brouillon commencé en Opus 5.5 · Élevé par le choix
du coordinateur, écart signalé au porteur à l'ouverture ; sur son mot à
21 h 04, passage en Fable 5.1 · Très élevé, le réglage de cette ligne, avant
la relecture (D-049). La 2.11 close le soir même, le code commence à son
tour.

**Première PR de code, le 31 octobre 2026.** Après le déplacement sans
changement de la description de la contrainte limitante hors du moteur
(#208, fusionnée et déployée à 02 h 02 ; le moteur comptait 593 lignes de
code pour une limite de 600), le service passe au moteur les créneaux
refusés de la semaine, le placement les évite comme une plage horaire (R8),
le besoin reste entier et se place ailleurs ou se lit « non placé » avec le
motif « créneau refusé » ; le cas de la rampe du tunnel 4 est rejoué en
test, la persistance d'un calcul à l'autre aussi. Aucune règle agronomique
nouvelle, aucune migration, aucun changement d'écran. Le point 31 se ferme
après recette sur le site, sur la version déployée.

**Deuxième PR de code, le 31 octobre 2026.** La lecture des refus fusionnée
et déployée à 02 h 17 (#209). Après chaque événement de la règle 4 —
irrigation planifiée, modifiée, démarrée, saisie après coup, terminée,
partielle, reliquat annulé, annulée ; pluie au pluviomètre ; niveau de
réserve observé, débit appliqué ; limite journalière, objectif, seuil,
priorité ou besoin à la main, arbitrage ; matériel posé, réglage changé,
retiré ; proposition refusée ou validée —, le serveur recalcule le plan de
la semaine courante après sa réponse (`waitUntil`), nomme l'événement dans
l'en-tête (« calculé le … (après la pluie saisie au pluviomètre) »), garde
l'identité des propositions reproduites à l'identique ; deux calculs
croisés ne se détruisent pas, le plus récent fait foi ; un échec laisse
l'événement enregistré et l'écran dit « Plan antérieur à … — le recalcul a
échoué, recalculez ». Migration 0019, additive (`trigger_event`, table
`irrigation_plan_events`, 46 tables). La pause ou la reprise d'un minuteur,
un réglage du planning, la météo et un événement d'une autre semaine ne
font pas recalculer.

**Troisième PR de code, le 31 octobre 2026.** Le recalcul sur événement
fusionné et déployé à 02 h 34 (#210). À chaque calcul, le moteur recalcule la
dose utile de chaque arrosage validé encore à venir, avec les règles du
jour, et suggère : « Annuler » sous la dose minimale R4, « Réduire à X mm »
quand la dose prévue dépasse la dose utile d'au moins la dose minimale,
jamais allonger ; un matériel retiré ou reposé ailleurs fait suggérer
« Annuler » avec la date du retrait ; une limite journalière posée après
coup signale le jour en défaut et fait suggérer de réduire jusqu'à la
limite, priorité basse d'abord. « Garder » tait une suggestion jusqu'à ce
qu'un calcul en fasse une autre (registre `irrigation_plan_suggestion_keeps`,
migration 0020, additive, 47 tables). Les suggestions sont enregistrées
avec le calcul ; rien à l'écran avant la cinquième PR.

**PR 3 bis, le 31 octobre 2026.** Les suggestions fusionnées et déployées à
03 h 01 (#211). Après chaque calcul, le service compare le nouveau plan au
dernier enregistré de la semaine et garde la lecture dans le résumé du
calcul : les propositions apparues, retirées, déplacées ou de dose changée,
appariées par matériel et réglage, la plus proche en heure d'abord ; les
suggestions nouvelles sur les arrosages validés ; les planches entrées dans
« Non placé » ou sorties ; le manque d'eau avant et après. Rien au premier
calcul de la semaine ; les calculs antérieurs se relisent sans réécriture.
Aucune migration : le résumé est déjà un JSON. Le pli à l'écran vient avec
la cinquième PR.

**PR 4a, le 31 octobre 2026.** « Ce qui a changé » fusionné et déployé à
03 h 20 (#212). Une irrigation planifiée non démarrée une tolérance après son
heure est « en retard » ; tout son créneau passé sans démarrage, « non
faite ». La tolérance est le réglage R14, 30 minutes au départ, par
exploitation, avec son historique comme les autres réglages, dans le pli
« Réglages du planning » ; un réglage enregistré avant se lit avec 30, sans
réécriture. Le signal se calcule à la lecture, rien n'est enregistré, le
passage en retard ne lance aucun calcul ; son eau ne change pas — la part du
créneau qui reste à venir, puis plus rien — ; le logiciel n'annule jamais.
Le libellé sur la carte et les notifications viennent avec les PR suivantes.

**PR 4b, le 31 octobre 2026.** Le retard et R14 fusionnés et déployés à
03 h 38 (#213). Deux notifications, et deux seulement, par l'alarme
existante du Worker Push, inchangé : l'arrosage en retard — une irrigation
planifiée reçoit à sa création ou à sa modification une alarme pour son
début plus R14, que le démarrage efface et que l'annulation ou la
modification annule d'abord — et les suggestions du calcul du matin — après
le calcul du matin seulement, une alarme immédiate pour l'exploitation quand
une suggestion non gardée porte sur un arrosage des prochaines 24 heures,
une par calcul, jamais après un geste à l'écran ni après un recalcul sur
événement. Les irrigations planifiées avant cette PR n'ont pas d'alarme de
retard ; un changement de R14 ne touche que les suivantes. Colonne
`late_alarm_due_at` (migration 0021, additive).

**PR 5, le 31 octobre 2026.** Les notifications fusionnées et déployées à
06 h 17 (#214). L'écran, dans la section « Planning de la semaine », sans
réorganisation : le pli « Ce qui a changé depuis le calcul du … », une
lecture ; les suggestions sur les arrosages validés, chacune avec sa raison
et ses deux boutons — « Appliquer » passe par l'annulation ordinaire ou la
modification en mode durée de l'irrigation planifiée, « Garder » la fait
taire jusqu'à un autre calcul — ; le signal « En retard » ou « Non faite »
sur la carte de l'irrigation planifiée dans « À venir ou à terminer », avec
« Recalculer le plan ». Les libellés vivent dans
`lib/domain/planning/follow-up.ts`, testés. Le parcours P12, aux deux
largeurs : une pluie saisie au pluviomètre et le plan recalculé seul, une
proposition refusée et le besoin replacé hors du créneau refusé, une limite
journalière posée après coup et la suggestion « Annuler » appliquée jusque
dans « À venir », la remise en état ; 28 parcours. Reste la recette réelle
sur la ferme, sur le « vas-y » du porteur, avec des événements fabriqués sur
les données expérimentales remises en état (contrat, décision 6) ; la 3.7
se ferme après.

**Recette réelle, le 31 octobre 2026.** L'écran fusionné et déployé à
06 h 39 (#215) ; la recette faite le jour même, de 10 h 44 à 10 h 51, dans le
Chrome du porteur, sur son « vas-y » (`docs/recette-3.7.md`) : le plan se
recalcule de lui-même après chaque événement et nomme son déclencheur, le
pli suit, le moteur lit les refus — le point 31 prouvé sur le site —, les
suggestions « Annuler » sous une limite posée après coup, « Garder » et
« Appliquer » font ce que le contrat dit. Trois défauts au jugement du
porteur, corrections proposées sur son mot : les cartes des arrosages annulés
restées « Validée » et reproposées en double (le plan ne lisait pas l'état
de l'irrigation, défaut antérieur à la 3.7) ; le message « Suggestion
appliquée » qui s'efface avec la suggestion ; « déplacée » à l'identique à la
minute ; et une mesure de pluie saisie qui ne se retire pas, 3 mm restés sur
la ferme. La 3.7 se ferme à son jugement, après ces corrections.

**Les quatre corrections, le jour même.** Sur le mot du porteur (« Oui, les
quatre », 11 h 15), une PR de correction (#220) : la carte d'un arrosage
validé lit l'état réel de l'irrigation — « Annulée », « Réalisée »,
« Partielle » —, le registre joignant l'irrigation à la proposition, une
annulée hors du compte des validées et de leur volume ; le message
« Suggestion appliquée » dans le bandeau de la section, qui reste quand la
suggestion s'en va avec le recalcul ; « Proposition déplacée » jugée à la
minute, comme l'écran montre les heures ; « Retirer la mesure » dans « Pluie
mesurée », qui efface la mesure du jour et fait réanalyser le plan comme une
pluie saisie. Le parcours P12 vérifie la carte « Annulée », « 0 validée » et
le message dans le bandeau. La 3.7 se ferme au jugement du porteur, après sa
lecture sur le site.

**Clôture, le 31 octobre 2026.** La PR #220 fusionnée à 12 h 05 sur le
« vas-y » du porteur et déployée à 12 h 14 ; vérification sur la ferme de 12 h
15 à 12 h 17 dans le Chrome du porteur : les deux cartes des arrosages annulés
lisent « Annulée » et sortent du compte (« 0 validée », 39,52 m³ au lieu de
45,504 m³), les 3 mm fabriqués du 31 octobre retirés par « Retirer la mesure »
(semaine revenue à 0,9 mm, plan recalculé à 12 h 16 « après la pluie saisie au
pluviomètre »), plus aucune ligne « déplacée » à heures identiques, rien
d'autre changé. **La 3.7 close par le porteur le jour même à 12 h 23**
(« vas-y ») ; le point 31 fermé. Deux détails à son œil, non bloquants : le
fond très clair des cartes « Annulée », le champ « Millimètres » qui ne montre
pas la valeur déjà saisie pour le jour choisi. Les deux corrigés le
7 novembre 2026, avant la 3.8, sur ses choix (les cartes « Annulée » rangées
avec les refusées, les pastilles pâles en gris moyen bordé ; le champ qui
montre la mesure déjà saisie, « 0 » compris). Le point 6 (la dose des tunnels
montée après une pluie saisie) reste une lecture de l'assistant conforme à
D-038, sans décision nouvelle du porteur.

### 3.8 — Réorganisation globale interface et ergonomie

Cahier des charges, section 25 : regrouper les fonctions par usage, simplifier
la navigation, ordinateur et smartphone, sans modifier les règles métier ni
dégrader les performances. Ne démarre qu'après Q6 et 3.6, ni avant que la 3.5
et la 3.7 soient terminées et que le porteur en ait été explicitement averti :
il veut vérifier cette refonte lui-même, de fond en comble, et s'y consacrer
(consigne du 9 octobre 2026).

**Intention ajoutée le 7 novembre 2026 (D-066)** : à la connexion, l'utilisateur
coche les fonctionnalités dont il a besoin et l'interface masque les autres
(filtre), pour ne pas surcharger ceux qui n'ont pas besoin de tout.

**Redéfinie par le porteur le 7 novembre 2026 (D-067)** : plus de mode simple
ni de mode complet, un seul mode ; une liste de fonctionnalités à cocher, et ce
qui n'est pas coché n'est ni affiché ni pris en compte ; les données dont une
fonctionnalité cochée a besoin restent affichées et à renseigner. **Contrat
écrit le jour même** (`docs/feature-selection-contract.md`) sur ses douze
réponses : dix cases avec leurs dépendances, une case décochée ignorée et ses
données gardées, cocher entraîne le nécessaire, un choix pour toute la ferme
fait à la première ouverture puis dans « Réglages » (les fermes existantes
gardent tout coché, un bandeau les prévient), une page par case avec la
navigation de la charte, un « ? » par page et une bulle « d'où vient ce
chiffre » qui ne recalcule jamais. Vingt et une précisions tranchées par
la recommandation, que le porteur juge sur le site en ligne. Avant le code,
trois petites corrections chacune dans sa PR (icône de la page, cartes
« Annulée » et pastilles pâles, champ « Millimètres »). **Mandat du porteur,
7 novembre 2026, 13 h 47** : toute la 3.8 construite en autonomie jusqu'au
déploiement, questions tranchées par la recommandation, sans maquette ; il
juge l'ergonomie en ligne et fait son retour. Code en sept PR, une à la fois :
la PR 1, la liste des cases et l'enregistrement du choix, sans effet visible
(#271, déployée) ; la PR 2, une page par case et le menu de la charte
(#272, déployée) ; la PR 3, le choix des cases à l'écran (#273, déployée) ;
la PR 4, les traitements et les notifications suivent le choix (#274,
déployée) ; la PR 5, le « ? » de chaque page (#275, déployée) ; la PR 6,
les bulles « d'où vient ce chiffre » (#276, déployée). Le porteur a vérifié
le site en ligne le 7 novembre 2026 au soir ; la PR 7 porte le premier lot
de ses retours (précisions P36 à P46 du contrat, dont la migration additive
0028 des marges de gel), en ligne le 7 novembre 2026 à 22 h 28 ; le porteur
a confirmé le 8 novembre que les dessins des espèces d'Ouvre ta ferme
s'affichent en ligne. **Close par le porteur le 8 novembre 2026 à 20 h 21**
(« On va clôturer la 3.8 pour l'instant, quitte à ce que je fasse des
modifications ultérieurement ») : ses modifications éventuelles passeront
chacune par une PR. L'écran d'arbitrage d'une pénurie présenté comme un
plan d'assolement (retour du 7 novembre) est décidé par le porteur le
8 novembre 2026 à 20 h 40 : dans la 3.9, maquette d'abord.

Preuve de fin (section 9 du contrat, qui remplace la précédente : le choix
s'enregistre et se lit, donc `lib/` et `db/` changent, sans qu'aucune formule
ni règle d'un contrat existant change) : tests du domaine, de la persistance,
des traitements et des bulles ; parcours navigateur existants adaptés à leur
page et verts, trois parcours nouveaux ; temps de chargement de la première
page mesuré avant et après sans dégradation ; recette sur ordinateur et à
390 px par le porteur sur le site en ligne, qui juge et fait son retour.

### 3.8 bis — Calculateur d'irrigation

Contrat écrit et validé par le porteur le 6 novembre 2026
(`docs/irrigation-calculator-contract.md`, D-061), sur le cahier des charges
validé le même jour : l'utilisateur saisit ce qu'il connaît, le logiciel
calcule le mm/h ou le profil, montre son calcul et étiquette le résultat
« calculé », « estimé », « mesuré » ou « saisi ». Le moteur ne change pas ;
l'efficacité s'applique une fois, dans le calculateur. Cinq questions
tranchées sur la recommandation.

**Codé la nuit du 7 au 8 novembre 2026** sur le mandat du porteur
(« enchaîner les chantiers en autonomie »), en une PR, Opus 5.5 · Élevé
(D-070) : la case « Calculateur d'irrigation », qui entraîne Matériel et
placement ; les quatre méthodes, la correction de pression et les quatre
exemples dans `lib/domain/irrigation-calculator/` ; la provenance dans une
table à part (migration additive 0029), décidée au serveur par la même règle
que l'écran ; le bouton, le calculateur et l'étiquette dans le formulaire des
réglages ; parcours P25 aux deux largeurs. Neuf précisions tranchées sur la
recommandation (section 16 du contrat). Le porteur avait son ordinateur
éteint cette nuit-là ; **il l'a relue en ligne le 8 novembre 2026 et l'a
validée telle quelle à 11 h 25** (« Ok, ça me paraît réaliste. Je valide
comme ça. »). Les ajouts de réalisme proposés le même jour (pertes à 90 % en
goutte-à-goutte, largeur mouillée selon le sol, débit de la pompe, baisse de
débit le long de la ligne, pression en tête de réseau) sont écartés par lui
(« Non, laisse tomber »). Deux défauts d'affichage vus sur sa capture sont
corrigés le jour même : les unités au bord droit des cases, et plus
d'étiquette tant que le résultat est inconnu.

Preuve de fin : les cas chiffrés de la section 15 du contrat en tests (faits),
tests de persistance de la provenance (faits), parcours navigateur (P25,
fait), recette à 390 px (P25 au téléphone), relecture du porteur (faite,
validée le 8 novembre 2026).

### 3.8 ter — Créneaux protégés nommés

Contrat écrit et validé par le porteur le 6 novembre 2026
(`docs/protected-slots-contract.md`, D-062), idée n° 9 de la comparaison avec
Tlaloc. L'exploitant nomme des plages horaires (« Lavage des légumes »),
chaque semaine par jours, pour tout le matériel ; le moteur les évite comme un
créneau refusé, sans exception, et un besoin qui ne tient pas reste « non
placé » avec le motif nommé. Un arrosage déjà validé qui y tombe reçoit la
suggestion « Annuler » ou « Réduire » de la 3.7 ; une irrigation réelle ou un
ajout à la main n'est jamais refusé. Réglage à l'écran, historisé, par
exploitation ; aucun créneau au départ. Sept questions tranchées par le
porteur. Code en cinq lots, Opus 5.5 · Max.

**Code commencé la nuit du 7 au 8 novembre 2026** sur le mandat du porteur
(« Cette nuit, je veux que tu enchaînes les chantiers en autonomie »),
chaque question tranchée par l'option recommandée et consignée (section 13
du contrat, D-071). PR 1 (#282, déployée), le module de domaine
(`lib/domain/planning/protected-slots.ts`) : la saisie d'un créneau, ses
instants chaque semaine (passage de minuit, veille comprise, changement
d'heure), l'union des créneaux qui se chevauchent ou se touchent, le
découpage d'une plage horaire autour d'eux ; six précisions (S1 à S6) ;
sans effet sur le plan tant que le moteur ne le lit pas (PR 2).

PR 2 (#283, déployée), le placement : le moteur découpe chaque plage horaire
autour des créneaux protégés, puis autour des refus ; un créneau commence à
la fin d'un créneau protégé, ou s'arrête avant lui si la dose minimale y
tient ; la justification nomme le créneau évité, et un besoin qui ne tient
nulle part se lit « non placé », motif « créneau protégé : <nom> » ; sept
précisions (S7 à S13). Sans créneau, le plan reste celui d'avant, octet pour
octet. Le service ne passe encore aucun créneau : rien ne change sur le site
avant la PR 3.

PR 3 (#284, déployée), la persistance : migration additive 0030, deux
tables, les créneaux de l'exploitation et le journal de chaque version
(créé, modifié, supprimé, son auteur et sa date) ; la suppression est
logique ; la base refuse elle-même un créneau impossible ; le service relit
les créneaux à chaque calcul, pour l'exploitation du calcul seulement ; six
précisions (S14 à S19). Aucun créneau n'existe au départ et l'écran qui les
saisit est la PR 5.

PR 4 (#285, déployée avec le correctif qui suit), les arrosages
validés et le réel : un arrosage validé qui tombe dans un créneau protégé
reçoit « Réduire » à la partie avant, comptée à la minute entière, si elle
porte la dose minimale, ou « Annuler » ; la suggestion se combine aux autres
raisons comme dans la 3.7, et « Garder » la fait taire jusqu'à un calcul qui
en fait une autre ; une irrigation réelle faite pendant un créneau en
vigueur à son début porte le signal « Faite pendant le créneau protégé
« Lavage » » sur sa carte de l'historique ; six précisions (S20 à S25). Sans
créneau, neuf plans de référence restent identiques octet pour octet. Aucun
créneau ne se saisit encore : rien ne change sur le site avant la PR 5.

Correctif du journal (#286, déployée), défaut de la PR 3 que la CI de
`main` a montré le 8 novembre 2026, juste après la fusion de #285 : une
suppression refusée, le créneau venant d'être supprimé dans la même
milliseconde, recopiait encore la ligne supprimée au journal, contre S15
(« un geste refusé n'écrit rien »). La version d'une suppression s'écrit
désormais avant le geste, à sa condition même, la ligne encore active ; un
test à l'horloge arrêtée reproduit le défaut et le garde.

PR 5 (#287, déployée), l'écran et le geste manuel : la section « Créneaux
protégés » dans le pli « Réglages du planning », chaque créneau sur une
ligne (« Lavage · mardi et jeudi · de 21:00 à 23:00 »), créé, modifié, ou
supprimé avec confirmation ; il vaut au prochain calcul, et « Recalculer le
plan » le prend tout de suite ; le journal de ses versions se lit sans
nommer personne. « Planifier » avertit d'un arrosage qui tombe dans un
créneau, sans le bloquer (cas 14) ; décocher le Planning compte aussi les
créneaux enregistrés. Parcours P26 aux deux largeurs ; sept précisions
(S26 à S32). Le code des créneaux protégés est terminé : la relecture en
ligne et la recette réelle sur la ferme attendent le porteur.

Preuve de fin : les dix-sept cas de la section 8 du contrat en tests, plan de
référence inchangé sans créneau, tests de persistance, parcours navigateur,
recette à 390 px.

### 3.8 quater — Audit ergonomique : quatorze améliorations

Audit du module en ligne fait le 7 novembre 2026 (version 3.8 avec la PR 7,
ferme réelle, onze pages au téléphone et à l'ordinateur) :
`/mnt/project-files/audit-ergonomie/audit-ergonomie-module-2026-11-07.md`,
captures dans le même dossier. **Le porteur retient les quatorze propositions
et veut qu'elles soient faites** (7 novembre 2026, D-069) : elles sont
décidées, pas des idées. Les lots 1 et 2 sont en ligne ; le lot 3 a son
contrat (`docs/audit-ergonomie-lot3-contract.md`, D-076), sa PR 1 est en
ligne et sa PR 2, qui réunit les PR 2 et 3 prévues, est codée.

Place : après la deuxième passe de la refonte (D-068, codée, #279), la 3.8 bis
et la 3.8 ter, **avant la 3.9**, parce que la 3.9 fait sa recette finale sur
le code terminé. Un seul chantier de code à la fois.

| Lot | Points de l'audit | Modèle · effort |
| --- | --- | --- |
| 1 · petits points sans risque | 7 titres de pages et page 404 en français ; 4 tri naturel et recherche dans les listes de planches ; 9 saison cachée là où elle ne sert à rien, commune de la météo une seule fois ; 11 historique : « Réalisées » par défaut | Opus 5.5 · Élevé |
| 2 · gros gain au quotidien | 2 téléphone (écran utile plus haut, barre du bas à quatre entrées et « Plus ») ; 1 page « Aujourd'hui » ; 3 zone unique « Fiabilité du calcul » avec les gestes pour corriger | Opus 5.5 · Très élevé |
| 3 · le reste | 5 planning (action contre bruit) ; 6 arrosages (message en clair, « Annuler » rangé, « Fait comme prévu ») ; 8 vocabulaire technique ; 10 alertes météo (modèles en un clic) ; 12 espèces sans référence en tête ; 13 réserve du sol (bouton « Observer ») ; 14 accessibilité | Opus 5.5 · Très élevé |

Règles qui s'appliquent à tous les lots :

- Multi-fermes : chaque bloc se construit à partir des fonctionnalités cochées
  (3.8, D-067) ; rien n'est propre à la ferme du porteur.
- La page « Aujourd'hui » (point 1) reprend l'idée n° 3 (résumé du matin, en
  écran) et « Fait comme prévu » (point 6) l'idée n° 1 des améliorations mises
  de côté ; la zone « Fiabilité » (point 3) en est l'idée n° 6. Elles cessent
  d'être mises de côté.
- Les points 1, 2, 3, 5, 6 changent la structure ou les règles d'affichage : un
  contrat court (Sonnet 5.5 · Moyen) précède chaque lot 2 et 3, avec les
  questions de choix posées une par une au porteur ; le lot 1 n'en demande pas.
- Le menu du téléphone du point 2 se règle d'après la maquette validée de la
  deuxième passe (le rapport n'a pu voir que la page « Matériel »).
- Non vérifié par l'audit : première ouverture d'une ferme neuve, contrastes
  mesurés, lecteur d'écran, mode sombre ; à mesurer dans le lot 3 (point 14).

Preuve de fin de chaque lot : les cas du contrat (ou, pour le lot 1, de la
liste ci-dessus) en tests, parcours navigateur aux deux largeurs, recette à
390 px, relecture du porteur sur la version en ligne.

**Lot 1, codé la nuit du 7 au 8 novembre 2026** sur le mandat du porteur
(« enchaîner les chantiers en autonomie »), en une PR, Opus 5.5 · Élevé.
Chaque précision non agronomique est tranchée par l'option recommandée
(D-072) ; elles restent modifiables à sa relecture :

- E1 (point 7) : l'onglet porte le nom de la page puis « Irrigation »
  (« Planning de la semaine · Irrigation ») ; la première ouverture,
  « Choisissez vos fonctionnalités · Irrigation » ; une adresse sans titre
  propre garde « Irrigation · Ouvre ta ferme ».
- E2 (point 7) : toute adresse inconnue du site répond « Page introuvable »
  (statut 404), en français, avec l'en-tête et le menu de la ferme, et un
  bouton vers sa première page cochée (« Revenir à « Arrosages » » quand
  Arrosages est cochée) ; une ferme qui n'a jamais ouvert le module va au
  choix des fonctionnalités ; une session illisible, à l'entrée du module.
  Rien n'est lu d'Ouvre ta ferme.
- E3 (point 4) : l'ordre naturel (B9-9 avant B9-10, BF-0 à BF-5, la planche
  zéro en premier), sans majuscules ni accents, deux noms égaux départagés
  par leur identifiant ; il range le périmètre des objectifs, les filtres
  de l'historique, l'inventaire du matériel et l'aperçu « Apport calculé par
  heure », la planche du filet d'ombrage et la planche de référence d'une
  aspersion. Le plan garde l'ordre d'Ouvre ta ferme, qui est celui du
  terrain, et la liste « Parcelle » du plan garde son choix par défaut.
- E4 (point 4) : le périmètre d'un objectif se range en groupes, « Ferme et
  parcelles » puis un groupe par jardin ou abri (« bloc 1 · Clémentière »
  quand la ferme a plusieurs parcelles) ; une recherche tapée au-dessus, sans
  majuscules ni accents, chaque mot devant se trouver, dit combien elle
  trouve ; le choix en cours reste dans la liste. Les groupes et la
  recherche tiennent lieu du choix en deux temps (jardin puis planche) que
  l'audit proposait au téléphone ; les filtres de l'historique le font déjà.
- E5 (point 9) : le choix de la saison disparaît d'Alertes météo, qui vaut
  pour l'exploitation, et de Réglages quand la correspondance des espèces
  n'y est pas (ni « Besoin par culture » ni « Alertes cultures » cochée) ;
  la saison reste dans l'adresse et suit vers les autres pages.
- E6 (point 9) : la commune ne se change que dans Réglages ; « Objectifs et
  besoins » garde la météo de référence (la commune, les dates de mise à
  jour, « Actualiser la météo ») et le lien « Changer la commune dans
  Réglages ».
- E7 (point 11) : la liste de l'historique a trois onglets avec leur
  nombre : « Réalisées », par défaut (faites en entier ou arrêtées en
  cours), « Planifiées », « Toutes » (la liste d'avant, annulées comprises) ;
  les cumuls ne changent pas ; une liste vide de réalisées signale les
  planifiées.
- E8 (point 11) : l'export suit l'onglet et le dit sur son bouton
  (« Exporter CSV · réalisées, du 02/11/2026 au 08/11/2026 », « novembre
  2026 » pour un mois, « saison 2026 » pour la saison) ; un lien d'export
  d'avant, sans onglet, exporte tout, comme avant.
- E9 (point 11) : « Saisir la pluie » s'affiche sous une pluie réelle
  incomplète, et à la place de « Donnée indisponible » dans l'écart à
  l'objectif quand seule la pluie lui manque (un objectif existe) ; il mène
  au bloc « Pluie mesurée » d'« Objectifs et besoins », et n'apparaît pas si
  cette page n'est pas cochée.

Vérifié par les tests (`tests/audit-ergonomie-lot1.test.ts`,
`tests/db/irrigation-history-status-filter.test.ts`) et le parcours P27
aux deux largeurs. Non vérifié : la relecture du porteur sur la version en
ligne et l'affichage sur sa ferme réelle (190 périmètres), son navigateur
étant éteint cette nuit.

**Lot 1 en ligne** : #288 fusionnée le 8 novembre 2026 à 04 h 16
(`777879b`), déployée à 04 h 29 (run 42441986250, quatre jobs réussis,
aucune migration, Workers inchangés).

**Lot 1 relu et validé par le porteur le 8 novembre 2026** (« c'est bon »),
consigné par la PR 2 du lot 2 : les neuf précisions E1 à E9 restent telles
quelles ; E4 vaut aussi au téléphone, où le périmètre d'un objectif garde
ses groupes par jardin et sa recherche.

**Lot 2, contrat écrit le 8 novembre 2026** (`docs/audit-ergonomie-lot2-contract.md`,
D-073, Sonnet 5.5 · Moyen) sur le mandat du porteur : les quatorze précisions
F1 à F14 sont tranchées par la recommandation, aucune question agronomique
n'est réservée. Points 2 (barre du bas à quatre entrées et « Plus », saison
dans la ligne du titre, bandeau des alertes système replié, tuiles en deux
colonnes, planning replié), 1 (page « Aujourd'hui », sans case, première du
menu : gel des trois jours, retards, à faire, eau) et 3 (zone « Fiabilité du
calcul », liste fermée de cinq données avec leur geste). Code en trois PR,
une à la fois, Opus 5.5 · Très élevé : PR 1 le téléphone (P28), PR 2 le
domaine, PR 3 les écrans (P29). Aucune migration (0031 libre). Contrat en
ligne : #289 fusionnée le 8 novembre 2026 à 04 h 48 (`eec491e`), déployée à
05 h 02 (run 42444235434, quatre jobs réussis, documents seuls).

**Lot 2, PR 1 (le téléphone) codée le 8 novembre 2026** sur le même mandat,
en Opus 5.5 · Très élevé. Mesurée d'abord à 390 px sur la ferme de
démonstration (un matériel posé, le plan calculé) : aucun défilement
horizontal ; le premier champ d'« Arrosages » commençait à 942 px, sous le
premier écran de 844 px ; le planning faisait 6,3 écrans. Après : le premier
champ à 771 px avec le bandeau du choix des fonctionnalités que la ferme de
démonstration garde (au-dessus de la barre du bas sur une ferme qui l'a
fermé, P28), le planning à 4,8 écrans. Fait : la barre du bas à quatre
entrées et « Plus » (F6, `lib/domain/features/phone-bar.ts`), qu'un champ
atteint au clavier ne passe jamais dessous, la saison
dans la ligne du titre (F7), le bandeau « Alertes système non disponibles »
replié en point sur la cloche après un premier affichage (F10,
`lib/domain/system-alerts-banner.ts`, souvenir sur l'appareil), le planning
replié (F11, `lib/domain/planning/phone-week.ts`), les tuiles de totaux de
l'historique et de l'aperçu du matériel sur deux colonnes, les pastilles
d'aide « i » et « Actualiser » à 44 px ; la ligne d'état était déjà faite
par la deuxième passe. Huit précisions de plus tranchées par la
recommandation (F15 à F22, section 9 du contrat) : la barre jusqu'à 600 px,
les noms courts, la place d'« Aujourd'hui » tenue par la page suivante
jusqu'à la PR 3, ce qui compte comme retard dans le planning, le jour à
venir ouvert quand aujourd'hui n'a rien, l'en-tête d'un jour replié, le
bandeau replié sur la seule page des arrosages au téléphone, et les cibles
portées à 44 px ici (le reste au point 14 du lot 3). La charte (point 7) dit
« quatre entrées et Plus ». Vérifié par les tests
(`tests/audit-ergonomie-lot2-telephone.test.ts`) et le parcours P28 aux deux
largeurs ; P0, P10, P12, P22, P23 et P27 ouvrent « Plus » ou déplient un
jour au téléphone. Non vérifié : la relecture du porteur sur la version en
ligne, l'affichage sur sa ferme réelle et sur un vrai téléphone, le lecteur
d'écran.

**PR 1 en ligne** : #290 fusionnée le 8 novembre 2026 à 11 h 15 et
déployée à 11 h 30 (run 42470683962, quatre jobs réussis, aucune
migration), consigné par la PR 2.

**Lot 2, PR 2 (le domaine « Aujourd'hui » et « Fiabilité du calcul »)
codée le 8 novembre 2026** sur le même mandat, en Opus 5.5 · Très élevé,
sans écran. `lib/domain/today/reliability.ts` est la fonction unique de la
zone « Fiabilité du calcul » (F5) : la liste fermée des cinq données
(volume d'une réserve, pluie réelle, sol jamais observé, espèces sans
rattachement, plan à recalculer), chacune avec sa phrase, sa conséquence
et son geste, cinq lignes montrées et les autres derrière un pli, la phrase
calme quand tout est à jour, les seuils de 7 jours, 7 jours et 48 heures
écrits dans le texte du « ? » (F8). `lib/domain/today/today-view.ts` et
`today-irrigations.ts` font les cinq blocs de la page « Aujourd'hui »,
chacun présent seulement si sa case est cochée (F3) : le gel des cultures
et les alertes de l'exploitation des trois jours (une prévision absente ne
se lit jamais « pas de gel »), les irrigations en retard et non faites, ce
qui est à faire aujourd'hui, l'eau des réserves et des ressources limitées,
la fiabilité ; la ligne du dernier calcul du plan ; la pastille du menu
(F12) ; l'existence de la page (F1). `lib/services/today-service.ts`
rassemble les lectures existantes sans requête nouvelle vers Ouvre ta
ferme ; une case décochée n'est pas lue. Huit précisions de plus tranchées
par la recommandation (F23 à F30, section 9 du contrat). Vérifié par les
tests (`tests/audit-ergonomie-lot2-aujourdhui.test.ts`, cas 4 à 16 ;
`tests/db/today-service.test.ts`, cas 20, l'isolation entre deux fermes).
Rien n'est encore affiché : la page, la zone, la pastille et la réécriture
des avertissements des pages par la même fonction (F9) viennent avec la
PR 3 (P29). Non vérifié : la relecture du porteur, les données de sa ferme
réelle.

**PR 2 en ligne** : #291 fusionnée le 8 novembre 2026 à
11 h 46 et déployée à 12 h 01 (run 42472817833, quatre
jobs réussis, aucune migration).

**Lot 2, PR 3 (les écrans) codée le 8 novembre 2026** sur le même mandat,
en Opus 5.5 · Très élevé. La page `app/irrigation/aujourdhui/` lit le
modèle de la PR 2 et l'affiche : la ligne du dernier calcul du plan (un
lien vers le planning quand il n'est pas calculé), puis les cinq blocs dans
l'ordre du contrat, chacun en une ligne calme quand il n'a rien à dire ; la
barre rouge de la charte quand un gel est annoncé ; les boutons existants
« Démarrer maintenant » et « Recalculer le plan », après lesquels la page
se relit, et « Ouvrir » vers la carte de chaque irrigation ou proposition.
La zone « Fiabilité du calcul » montre cinq lignes au plus, « Voir les
n autres » et « Voir moins », et chaque geste mène à la carte même : la
réserve sur « Ressources et pompes », le jardin sur « Réserve du sol »
(déplié et amené à l'écran), la proposition sur le planning ; son « ? »
écrit les seuils. « Aujourd'hui » est la première page du menu et la page
d'arrivée de `/irrigation`, d'une page non cochée, du premier choix des
cases et de la page introuvable (F31) ; elle n'a pas de choix de saison et
lit toujours la saison du jour (F32). La pastille du menu, en ambre,
compte les lignes de fiabilité et les retards ; sur les autres pages, elle
est lue après l'affichage dans les données déjà gardées, jamais d'Ouvre ta
ferme (F33), et son nombre est dit dans le nom du lien. Douze précisions
de plus tranchées par la recommandation (F31 à F42, section 9 du contrat).

**Avertissements des pages touchés (F9, F41)**, liste faite en lisant le
code au début de la PR 3 : un seul avertissement d'une page dit la même
chose qu'une ligne de la zone, « Pluie réelle incomplète » du tableau des
besoins (`app/irrigation/irrigation-needs-dashboard.tsx`) ; il concerne la
page seule, reste en place et dit désormais la conséquence de la fonction
(`ACTUAL_RAIN_CONSEQUENCE`, « Sans elle, le besoin est surévalué. »).
Aucun n'est remplacé par une ligne « Voir sur Aujourd'hui », faute de
doublon : le planning sans calcul (« Calculer le plan de la semaine »), le
volume « Non renseigné » des ressources, le sol « inconnue » de la jauge
et la liste « sans référence Kc » de Réglages sont des états de leur page,
pas des avertissements ; ils ne changent pas.

Vérifié par les tests (pages et menus, page d'arrivée, saison du jour,
lien des alertes, ancres, aide de la zone, pastille sans météo) et le
parcours P29 aux deux largeurs : les cinq blocs dans l'ordre sur une ferme
neuve qui coche tout, la pastille égale au nombre de lignes, « Recalculer
le plan » qui retire sa ligne et la pastille qui baisse, « Observer le
sol » qui ouvre le jardin, une cuve sans volume corrigée depuis sa ligne,
une alerte de gel fabriquée en test et sa barre rouge, la page en deux
écrans au téléphone ; P0, P22, P23, P27 et P28 suivent la nouvelle page
d'arrivée. Non vérifié : la relecture du porteur, sa ferme réelle, un vrai
téléphone, le lecteur d'écran.

**PR 3 en ligne** : #293 fusionnée le 8 novembre 2026 à
12 h 47 et déployée à 13 h 01 (run 42477289518, quatre jobs
réussis, aucune migration). **Le lot 2 est en ligne.**

**Retours du porteur du 8 novembre 2026**, après sa relecture en ligne, en
une petite PR hors lot. La liste « Non placé » du planning de la semaine
est repliée par défaut : son titre garde le nombre de planches (« Non placé
(37 planches) ») et une flèche vers le bas la déplie, à toutes les
largeurs ; une semaine où tout est servi garde sa phrase. Les « i » du
planning, qui prenaient le dessin des boutons de la section, redeviennent
des ronds de 24 px. Sur « Matériel et placement », le plan de la parcelle
vient en premier ; la fiche de la planche choisie reste juste dessous
(choix de Claude, dit au porteur : sinon elle tomberait sous l'aperçu),
puis l'aperçu « Apport calculé par heure ». Vérifié par un test du titre
et par P0 (l'ordre des deux carrés), P10 (le pli fermé, son titre, sa
cible de 44 px), P12 et P26 (la liste dépliée avant de lire un motif).

**Retours du porteur, suite : « Besoin par culture »**, en une seconde
petite PR. Chaque carte de culture et d'espèce dit qu'elle s'ouvre (« Voir
le détail » et une flèche vers le bas, « Replier » une fois ouverte), et
une phrase sous chaque liste dit ce qu'on y trouve. La place vide à droite
du nom d'une culture porte son résumé, choisi par le porteur le 8 novembre
2026 sur la recommandation (« Kc, racines et séries ») : « Kc de 0,50 à
1,10 · racines jusqu’à 0,60 m · 3 séries de la saison », sous le nom au
téléphone. Les Kc sont ceux qui comptent aujourd'hui, surcharges
comprises, avant abattement ; la racine est la plus profonde du profil en
vigueur, une profondeur progressive par sa fin, les 30 cm proposés dits
comme tels ; une série compte par son espèce ou par son exception, une
fois. Vérifié par les tests du résumé et par P20 (la carte fermée, son
résumé et sa place aux deux largeurs). **En ligne** : #296 fusionnée le
8 novembre 2026 à 13 h 49 et déployée à 14 h 03 (run 42482021262, quatre
jobs réussis, aucune migration).

**« Aujourd'hui » en tableau de bord** (D-074,
`docs/aujourdhui-tableau-de-bord-contract.md`). Après sa relecture en
ligne, le porteur veut la page « beaucoup plus graphique et agréable à
regarder, tout en étant plus compréhensible », un véritable tableau de bord,
son entrée de menu détachée dans un encart différent, et un bouton « Tout
est fait » pour qui a arrosé sans le chrono. Maquette validée par lui le
8 novembre 2026 à 12 h 25 ; « Tout est fait » enregistre chaque irrigation
telle que prévue (son choix du même jour). Opus 5.5 · Très élevé, son
choix. Aucun calcul ne change : la page dessine des valeurs déjà calculées.
Neuf précisions T1 à T9 tranchées par la recommandation (section 7 du
contrat). Trois PR, une à la fois :

- **PR 1, le contrat et le domaine, codée le 8 novembre 2026** : les valeurs
  à dessiner dans `lib/domain/today/` (la frise du jour et le repli des
  retards par jour, les trois jours de météo sur une échelle commune, les
  cuves et les prélèvements, la semaine pondérée par la surface pour la
  ferme et par jardin, la réserve du sol par jardin, l'état de chaque
  donnée de fiabilité, la date, la phrase de résumé et ses pastilles) et le
  service qui lit en plus le tableau de la semaine quand « Objectifs et
  besoins » est cochée. L'écran ne change pas. Vérifié par
  `tests/aujourdhui-tableau-de-bord.test.ts` et la suite complète.
  **En ligne** : #297 fusionnée le 8 novembre 2026 à 14 h 40 et déployée à
  14 h 53 (run 42486074151, quatre jobs réussis, aucune migration).
- **PR 2, les écrans, codée le 8 novembre 2026** : la page en grille de la
  maquette (l'en-tête et ses pastilles, les tuiles de la semaine, « Votre
  journée » avec la frise et les cartes, la météo dessinée, l'eau de la
  semaine et la réserve du sol par jardin, les cuves, l'anneau de la
  fiabilité), l'encart « Aujourd'hui · Tableau de bord » en tête du menu et
  les pages sous « Arroser », « Équiper », « Surveiller », le bouton rond de
  la barre du téléphone. Cinq précisions de plus (T10 à T14). Vérifié par
  `tests/aujourdhui-menu.test.ts`, P29 mis à jour et P30, P0, P22, P27 et
  P28. **En ligne** : #298 fusionnée le 8 novembre 2026 à 15 h 08 et
  déployée à 15 h 24 (run 42488341591, quatre jobs réussis, aucune
  migration).
- **PR 3, « Tout est fait », codée le 8 novembre 2026** : la fonction du
  domaine `lib/domain/done-as-planned.ts`, reprise par le geste « Fait comme
  prévu » du lot 3, la liste par jour de la confirmation, l'écriture tout ou
  rien par irrigation, l'action serveur qui rejuge chacune, la confirmation
  et le mode « Planifiée, faite comme prévu » de l'historique. Quatre
  précisions de plus (T15 à T18). Vérifié par
  `tests/aujourdhui-tout-est-fait.test.ts`, `tests/db/done-as-planned.test.ts`,
  P29 et P30 complété. **En ligne** : #299 fusionnée le 8 novembre 2026 à
  15 h 40 et déployée à 15 h 56 (run 42490966130, quatre jobs réussis,
  aucune migration).
- **Retour du porteur après la mise en ligne, 8 novembre 2026** : « ça veut
  dire quoi les carrés rouges ? ». La légende de la frise oubliait « Non
  faite » ; elle dit désormais chaque couleur présente sur la frise du jour,
  et seulement celles-là, avec le statut des cartes (précision T19).
  Vérifié par `tests/aujourdhui-tableau-de-bord.test.ts` et P30. **En
  ligne** : #302 fusionnée le 8 novembre 2026 à 17 h 50 (`e542313`) et
  déployée à 17 h 51 (run 42501901101, le job de déploiement réussi, les
  contrôles sautés comme le veut D-075).

**Lot 3, contrat court validé par le porteur le 8 novembre 2026**
(`docs/audit-ergonomie-lot3-contract.md`, D-076) : points 5, 6, 8, 10, 12, 13
et 14, en trois PR une à la fois (planning et arrosages ; gestes par ligne ;
mots simples et accessibilité), Opus 5.5 · Très élevé. Une seule question
agronomique, tranchée par le porteur : les trois modèles d'alerte météo
(gel sous 3 °C, forte chaleur au-dessus de 33 °C, pluie au-delà de 15 mm,
trois jours, modifiables). Aucune migration, aucun calcul changé.

- **PR 1, le planning et les arrosages (points 5 et 6), codée le 8 novembre
  2026** : sur le planning, les cartes de tête « À valider », « Faites »,
  « En retard » (le retard lu sur l'irrigation validée, avec la règle de la
  page des arrosages), les planches non servies rangées par motif, les
  planches sans matériel dites en action vers « Matériel » au-dessus du
  pli, les codes des règles dans l'infobulle « Pour les experts » ; sur
  « Arrosages », le formulaire sans matériel présélectionné, la faisabilité
  en phrase d'action (sans bouton : le moteur ne calcule aucune solution),
  « À traiter » en tête puis une ligne par irrigation et par jour, la carte
  sous « Voir la fiche », « Annuler » dans le menu « … », et « Fait comme
  prévu » sur une ligne passée, ici et sur « Aujourd'hui », avec une
  confirmation d'une ligne. Dix précisions F52 à F61. Vérifié par
  `tests/audit-ergonomie-lot3.test.ts`, `tests/db/planning-service.test.ts`,
  P31a et les parcours P2, P7, P10, P11, P12, P26 et P28 mis à jour. **En
  ligne** : #301 fusionnée le 8 novembre 2026 à 17 h 23 (`db8d342`) et
  déployée à 17 h 24 (run 42499644714, le job de déploiement réussi, les
  contrôles sautés comme le veut D-075, aucune migration).
- **PR 2, les PR 2 et 3 réunies (points 12, 13, 10, 8 et 14), codée le
  8 novembre 2026** (minutes Actions comptées) : dans Réglages, les espèces
  à rattacher en tête, « n espèces à rattacher sur T », la phrase de
  conséquence, la recherche par nom et « Rattacher comme… », une seule
  culture du jeu commun proposée d'après le nom, toujours confirmée ; sur
  « Réserve du sol », « Observer » sur chaque ligne inconnue et les jardins
  de plein champ pareils rangés en une phrase dépliable ; sur « Alertes
  météo », trois modèles tant qu'il n'y a aucune alerte, l'état des
  notifications de cet appareil avec « Activer sur cet appareil », la note
  du gel à 2 m repliée ; « Besoin en eau par culture » en clair, trois
  replis « Pour les experts », un seul tableau des K_abri ; dans
  « Matériel », le réglage séparé des planches couvertes et une ligne de
  sens sous « Chevauchements » et « Cumul maximal » ; « Aller au contenu »,
  toute cible à 44 px au téléphone, le contraste mesuré sur chaque texte
  des douze pages (deux textes corrigés). Dix précisions F62 à F71 ; mode
  sombre et lecteur d'écran non vérifiés (F50). Vérifié par
  `tests/audit-ergonomie-lot3-gestes.test.ts`, P31b, P31c et les parcours
  P14, P16, P17 et P31a mis à jour. **En ligne** : #303 de l'archive
  fusionnée le 8 novembre 2026 à 18 h 56 (`d350c06`) et déployée à 18 h 57
  (run 42507465264, le job de déploiement réussi, les contrôles sautés comme
  le voulait D-075, aucune migration). **Lot 3 complet, validé par le
  porteur le 8 novembre 2026 à 19 h 20** (« ça me semble bon »).

### 3.9 — Scénarios, tests de pénurie, recette et publication

Jeux de données réalistes, non-régression complète, revue de sécurité des
frontières et de l'isolation, recette finale ordinateur et mobile, publication,
tag de version.

Preuve de fin : `docs/recette-tranche-3.md`, CI verte, tag, registre et
journal des changements à jour.

**Contrat écrit et validé le 30 octobre 2026** (`docs/shortage-contract.md`,
D-052), écrit sur la règle du point 17 des instructions, en Fable 5.1 · Max,
le réglage de la roadmap vérifié à l'ouverture. Vingt-huit scénarios chiffrés
S1 à S28 sur la ferme de test — les sources du manque, les trois conduites
R9, la part réservée (D-037), la semaine qui avance, l'isolation —, chacun
avec son attendu, sa vérification et son état ; trois jeux de données (la
ferme en chiffres des tests, étendue ; la ferme de démonstration et un
parcours P13 « Planifier en pénurie » ; la ferme réelle pour la recette
seulement, rien d'exporté ni de versionné) ; la non-régression complète ; la
revue de sécurité des frontières et de l'isolation en sept points ; la
recette finale `docs/recette-tranche-3.md`, ordinateur et 390 px ; la
publication en `v0.2.0`, tag annoté après déploiement vérifié, sur le mot de
clôture du porteur. Huit questions posées au porteur avec une
recommandation ; il les accepte toutes le jour même (« d'accord avec
tout. ») : un arbitrage validé réserve ses allocations sans redistribution ;
le budget annoncé retire d'abord le manque sous le minimum et montre la part
placée à côté de la part visée ; les priorités de la recette finale sont
posées par lui ce jour-là ; les planches reportées ne passent devant qu'après
un événement ; une part sous la dose minimale est placée le dimanche comme
hors pénurie ; la recette finale se joue en pénurie fabriquée sur la ferme
réelle, les trois conduites, sur son « vas-y » ; R2 et R9 restent des
informations ; aucune règle nouvelle entre abri et plein champ. Aucune règle
agronomique inventée : les quatre décisions qui précisent une règle
deviennent quatre PR `fix/`, test rouge d'abord. Code en sept lots
(registres ; règles tranchées ; tests des scénarios dans
`tests/planning-shortage.test.ts` ; parcours P13 et protocole ; corrections
de la revue de sécurité ; recette finale ; PR de clôture puis tag) ; rien de
codé. Réévaluations promises à la 3.9, à faire à sa clôture : Vinext (D-015,
recommandée close « risque levé » si la version stable tient), le temps de
rendu (D-017), le point 34. Registres inscrits le 31 octobre 2026.

**Code commencé le 8 novembre 2026 au soir**, en Opus 5.5 · Max, sur le
dépôt public `module-irrigation-otf-public`, après la clôture de la 3.8 et
les trois lots de l'audit. Le lot 2 se code une règle à la fois, une PR
`fix/` chacune, le contrat du planning précisé avant le code et un test
rouge d'abord ; les tests des scénarios vont dans
`tests/planning-shortage.test.ts`.

- **Correction 1 sur 4, l'arbitrage validé en parts réservées** (décision 1,
  D-077, codée le 8 novembre 2026) : sous un arbitrage 3.4 validé, chaque
  allocation devient la part réservée de sa planche, par le mécanisme de la
  part de D-037, sans redistribution entre planches ; la dernière planche
  examinée reçoit son allocation comme la première (S13 : le tunnel 4 ne
  reçoit plus 0 mm). Quatre précisions F72 à F75 tranchées par la
  recommandation : seules les allocations sont des parts ; quand une chaîne
  ne peut pas fournir toutes ses allocations (une limite journalière, que la
  faisabilité ne compte pas), chacune est réduite dans la même proportion ;
  le plan porte un champ `arbitration`, absent sans arbitrage, et le
  planning dit sous les cartes du résumé l'eau allouée, sa réduction et ce
  que les planches allouées ne peuvent pas recevoir ; « ne peut pas être
  reçu », c'est la part restée non dépensée. Aucune migration.
- Restent les corrections des décisions 2 (le budget net du manque sous le
  minimum, la part visée et la part placée), 4 (le report sans bascule) et
  5 (la part sous la dose minimale placée le dimanche).
- **L'écran d'arbitrage présenté comme un plan d'assolement** (retour du
  porteur du 7 novembre 2026) : décidé par le porteur le 8 novembre 2026 à
  20 h 40 (D-078), dans la 3.9, après les quatre corrections ; une maquette
  d'abord, soumise au porteur avant tout code. Le moteur reçoit une
  allocation par planche, quel que soit l'écran qui la produit : la
  correction 1 n'en dépend pas.
- Le parcours de pénurie du lot 4 prend le prochain numéro libre : P13 est
  devenu celui des alertes météo (5 bis).

## 4. Chantier transversal Q — Socle qualité

Issu de l'audit. Objectif : que la qualité constatée aujourd'hui soit garantie
par l'outillage et non par la discipline, avant que le planning n'ajoute
plusieurs milliers de lignes.

| N° | Sous-tranche | Modèle · effort | Ferme le risque |
| --- | --- | --- | --- |
| Q0 | Hébergement pilotable sur Cloudflare | Fable 5.1 · Très élevé | publication manuelle incompatible avec la méthode ; absorbe la partie hébergement de 4.7 |
| Q1 | Gouvernance et règles | Fable 5.1 · Élevé | R6, règles du cahier des charges absentes d'`AGENTS.md` |
| Q2 | Tests d'exécution de la persistance | Fable 5.1 · Très élevé | R1 |
| Q3 | Frontières outillées | Fable 5.1 · Très élevé | R4 |
| Q4 | Dépendances et hygiène Git | Opus 5 · Élevé (révisé le 20 septembre 2026 ; les versions s'accordent ou non, les tests passent ou non) | R5 |
| Q5 | Parcours navigateur automatisés | Opus 5 · Très élevé — outillage transverse, un parcours passe ou échoue | R2 |
| Q6 | Découpage des fichiers concentrateurs | Opus 5 · Très élevé — contexte étendu, aucun changement de comportement, protégé par Q2 et Q5 | R3 |

### Q0 — Hébergement pilotable sur Cloudflare (✅ close le 3 octobre 2026)

Décidée le 18 septembre 2026 (D-016) après le constat que la publication sur
OpenAI Sites est manuelle, via Codex, et que le site en ligne était en retard
sur `main`. Contrat complet dans `docs/hosting-migration-contract.md` : Worker
et base D1 dans le compte du porteur, Cloudflare Access pour la connexion,
déploiement par GitHub Actions à chaque fusion, export et import des données,
décommission de Sites en quatre phases. Adresse en `.workers.dev`.

Avancement : phase 1 engagée le 18 septembre 2026, Worker déployé à
`module-irrigation-otf.lechampdelaurore.workers.dev`, base D1 créée et migrée,
authentification Access écrite et testée ; Access configuré le 19 septembre
(équipe `damp-wind-3566`, application protégeant le Worker, contournement sur
`/api/internal`) ; connexion et lecture OTF réelle validées par le porteur :
phase 1 close. Phase 2 exécutée le 19 septembre : 375 lignes importées,
comptages identiques sur 38 tables, identité remappée. Phase 3 engagée le
19 septembre : secrets régénérés, Workers repointés par liaisons de service,
déclenchement météo reçu par la nouvelle adresse, synchronisation météo
réussie après ressaisie de la clé, job de déploiement automatique écrit,
activé et exercé avec succès (PR #27) ; première écriture réelle faite, point
de non-retour franchi ; plan Workers payant souscrit après une erreur de
limite de calcul (D-017). Phase 4 exécutée le 19 septembre : code Sites et
route d'export retirés, une seule cible de compilation. Protocole de recette
3.4 déroulé sur la nouvelle adresse et clos le 25 septembre 2026. **Q0 close le
3 octobre 2026** : après quatorze jours sans incident, le porteur a supprimé le
site Sites depuis son compte ChatGPT ; l'ancienne adresse répond 404 le soir
même, la nouvelle redirige vers Cloudflare Access.

Preuve de fin : celle du contrat, dont le déploiement automatique visible dans
GitHub Actions, les comptages identiques par table, la synchronisation météo
du lendemain et le protocole de recette 3.4 déroulé sur la nouvelle adresse.

### Q1 — Gouvernance et règles (✅)

Réalisée le 19 septembre 2026.

- ✅ `AGENTS.md` complété : règles métier invariantes du cahier des charges
  (prévu, estimé, observé ; objectif en mm par semaine ; écart et ET0 ;
  pondération des mm par la surface ; pluie mesurée prioritaire ; restriction
  qui bloque le nouveau mais jamais le réel ; série culturale recevant la
  totalité des mm ; trois contraintes distinctes des ressources ; unités
  explicites), interdits (nombre magique d'unité, duplication d'une règle,
  changement opportuniste, refactor mêlé à une fonctionnalité, ET0 dans le
  besoin, « terminé » non exécuté), règles de sécurité (le porteur seul
  manipule ses secrets), règles de PR (l'assistant ouvre, le porteur fusionne).
- ✅ Définition de « terminé » exigeant les preuves : dans `AGENTS.md`, qui
  fait foi (la section 10 y renvoie), et dans le modèle de PR
  `.github/pull_request_template.md` sous forme de liste à cocher.
- ✅ Décision Git : GitHub unique source de vérité (D-011) ; publication
  automatique à chaque fusion depuis Q0 (D-016, `docs/publication.md`).
- ✅ Protection de `main` appliquée le 18 septembre 2026 (D-013) et relue par
  l'API ; GitHub CLI installé et connecté sur le poste du porteur.
- ✅ `.nvmrc` à `22.13.0` (version de la CI), `.gitattributes` imposant LF
  pour mettre fin aux avertissements CRLF sous Windows, tag `v0.1.0` sur
  l'état de `main` après Q0, neuf branches distantes déjà fusionnées
  supprimées, suppression automatique des branches fusionnées activée sur le
  dépôt.

Preuve de fin : fichiers relus par le porteur à la fusion de la PR, règles de
protection en place, CI verte.

### Q2 — Tests d'exécution de la persistance (✅)

Engagée le 19 septembre 2026, contrat `docs/persistence-tests-contract.md`.
Première PR : point d'accès unique `db/binding.ts` (remplacement mécanique de
`env.DB` dans les quatorze dépôts), résolveur de modules pour exécuter le
code applicatif sous Node, adaptateur D1 sur `node:sqlite` avec ses tests,
tests complets de `workspace-repository`, test de dérive de schéma.
Deuxième PR : les treize fonctions exportées d'`irrigation-event-repository`
sur le vrai SQL (cycle complet au minuteur avec horloge simulée, immuabilité,
isolation, révisions optimistes rejetées par les déclencheurs, alarmes Push,
avertissements), fixtures créées par les dépôts de matériel. Troisième PR :
les seize fonctions de `water-management-repository` (objectifs hydriques et
récurrence, préférence et verrou météo, géocodage, valeurs quotidiennes,
pluie manuelle, limite journalière) et le cache OTF. Les trois dépôts
prioritaires de la preuve de fin sont couverts. Quatrième PR : besoins par
planche et seuil, arbitrages (révision de faisabilité, relecture idempotente,
invalidation), historique par période et périmètre, synchronisation météo
nocturne (cibles, verrou, résultat par espace). Cinquième PR : matériel
(huit fonctions : création, réglages et courbes, modification, archivage,
duplication, suppressions protégées par l'historique) et positions (une par
matériel et saison, règles de type, suppression protégée). Sixième PR :
groupes de jardins (copie de saison en saison), ressources en eau (ressources,
réserves, limites, corrections de volume, liaisons sans cycle, alimentation par
défaut) et pompes (origines, archivage, pompe par défaut, usages sur une
période). Les quinze dépôts sont couverts ; preuve de fin atteinte le
19 septembre 2026. Deux défauts révélés par les tests sont corrigés dans des PR
séparées : retrait de la pompe par défaut d'un matériel refusé par une clé
étrangère, contrainte des besoins par planche inefficace sur une valeur
absente.

- Introduire un point d'accès unique à D1 (`db/binding.ts`) remplaçant
  l'import direct de `env` dans les quinze dépôts ; changement mécanique
  vérifié par le typage.
- Adaptateur de test reproduisant l'interface D1 (`prepare`, `bind`, `first`,
  `all`, `run`, `batch`) au-dessus de `node:sqlite`, déjà utilisé par le test
  de migration, avec les 14 migrations rejouées avant chaque suite.
- Tests prioritaires : isolation entre deux propriétaires ;
  immuabilité d'une irrigation terminée ou annulée ; révisions optimistes
  (`water_budget_revision`, `hydraulic_revision`) avec rejet d'une écriture
  périmée ; limite journalière atomique ; cycle complet planifiée, démarrée,
  pause, reprise, arrêt anticipé, confirmation partielle ; cache OTF par
  utilisateur et saison.
- Test de dérive schéma contre migrations : les tables et colonnes de
  `db/schema.ts` doivent correspondre exactement à la base migrée.

Preuve de fin : `tests/db/*.test.ts` verts en CI, au moins un test par
fonction exportée de `irrigation-event-repository`,
`water-management-repository` et `workspace-repository`, puis extension aux
autres dépôts ; aucun changement de comportement.

### Q3 — Frontières outillées (✅)

Engagée le 19 septembre 2026, contrat `docs/boundaries-contract.md`.
Première PR : `lib/` réparti en trois zones par ses imports réels,
`lib/domain` (32 modules purs), `lib/services` (16, orchestration et accès
aux dépôts) et `lib/adapters` (5, OTF, météo, démonstration) ; 222 chemins
d'import réécrits, typage, 404 tests et compilation inchangés. Exception
assumée : six modules du domaine importent en type seulement des
enregistrements de `db/`, à déplacer en Q6. Deuxième PR : règles ESLint
d'import par zone (`@typescript-eslint/no-restricted-imports`, types
tolérés là où le contrat le dit), `max-lines` à 600 en avertissement (sept
fichiers signalés, liste de Q6), huit tests négatifs et positifs exécutant
ESLint sur des extraits placés dans chaque zone ; quatre déclarations
rapatriées dans le domaine pour que la matrice tienne (contrat OTF, journée
du tableau de bord, export d'historique, contrat de synchronisation météo).
Troisième PR : module unique de conversion `lib/domain/units.ts` (volumes,
débits, durées, sans arrondi), soixante-deux facteurs remplacés dans
vingt-six fichiers, règle interdisant `3600` et `60000` partout et
`1000` comme facteur, avec ses tests négatifs. Quatrième PR : journaliseur
unique `lib/adapters/log.ts`, `knip` en dépendance et en CI (fichiers,
exports et dépendances inutilisés bloquants), `db/index.ts` supprimé,
69 exports ramenés à des déclarations locales et neuf symboles morts
supprimés. Q3 close le 19 septembre 2026 ; preuve de fin atteinte.

- Séparer `lib/domain` (pur : aucune dépendance à React, Next,
  `cloudflare:workers`, `db/`) de `lib/services` (orchestration) et
  `lib/adapters` (OTF, météo). Déplacement vérifié par le typage.
- Règles ESLint d'import par zone : `lib/domain` ne peut importer que
  `lib/domain` ; les composants client ne peuvent importer `db/` qu'en type ;
  `db/` n'importe jamais `app/`.
- Module unique de conversion d'unités dans `lib/domain` ; règle interdisant
  les facteurs `1000`, `3600`, `60000` en dehors.
- Journaliseur unique remplaçant les cinq copies.
- Règle `max-lines` à 600 lignes, avec exceptions listées (`db/schema.ts`,
  types générés), en avertissement d'abord, en erreur après Q6.
- Détection de code mort et de dépendances inutilisées (knip) en CI.

Preuve de fin : un import interdit fait échouer le lint (cas négatif
documenté), knip vert, CI verte, aucune modification de comportement.

### Q4 — Dépendances et hygiène Git (✅ close le 20 septembre 2026)

- **Tailwind** ✅ (19 septembre 2026) : tranché le 18 septembre 2026, retrait.
  L'interface n'utilise aucune classe utilitaire Tailwind : 308 des 311 noms
  de classes sont définis dans la feuille maison, les trois restants n'avaient
  aucune règle. Tailwind ne servait que par sa remise à zéro des styles du
  navigateur. Fait : les deux paquets et l'import retirés, remise à zéro
  recopiée figée dans `app/preflight.css`, trois noms de classes orphelins
  supprimés, comparaison avant et après de `/irrigation` à 1 280 px et à
  390 px sur 1 561 éléments sans aucune différence de styles calculés ni de
  géométrie, feuille compilée identique hors couches Tailwind inutilisées
  (D-012). La stratégie de style de l'interface réorganisée se décidera en
  3.8, sous protection de Q5.
- **Drizzle** ✅ (19 septembre 2026) : `drizzle-orm` en dépendance de
  développement, seul `db/schema.ts` l'importe pour le test de dérive ;
  politique écrite dans `docs/migrations-contract.md` (D-018) : migrations SQL
  manuscrites, additives, relues, jamais modifiées après fusion. La génération
  (`drizzle-kit`, `db:generate`, `drizzle.config.ts`, instantanés
  `drizzle/meta/`) est retirée, une sonde ayant montré qu'elle produirait une
  migration destructive fausse.
- **Wrangler** ✅ : une seule version, `4.127.1`, racine et Workers (constaté
  le 19 septembre 2026).
- **PR Dependabot par lots**, état constaté le 18 septembre 2026 : #12 types
  Workers ✅ repris le 20 septembre 2026 dans une branche du dépôt
  (`4.20260515.1` vers `5.20260916.1`, contrôles et Workers verts), PR
  Dependabot fermée ; #13 Vite 8.3.0, échec de typage
  TS2321 dans `vite.config.ts`, à traiter avec les greffons Vinext et
  Cloudflare dans un même lot ✅ le 20 septembre 2026 : l'échec de typage
  disparaît dès que les greffons montent avec Vite, et `pnpm dev` redémarre
  sans contournement, le greffon `1.56.0` embarquant un runtime du
  18 septembre 2026 compatible avec la date du Worker ; #4 React et `@types/react` ✅ le 20 septembre 2026, traités en lot avec
  `react-dom`, `@types/react-dom` et `react-server-dom-webpack`, tous en
  `19.3.0` : recette visuelle sans aucun écart, 1 575 éléments identiques en
  styles calculés et en géométrie à 1 280 px comme à 390 px ; #6
  `@block65/webcrypto-web-push` 2.0.0 ✅ le 20 septembre 2026 : la version
  majeure ne change rien à l'usage qu'en fait le Worker, aucun ajustement de
  code n'a été nécessaire et les contrôles passent. Deux tests appelant le vrai
  chiffrement sont ajoutés, l'ancienne suite le remplaçant par un leurre.
  Essai réel fait par le porteur le 20 septembre 2026, après déploiement de
  cette version : notification reçue et lisible sur téléphone.
- **Réglages du dépôt** ✅ (19 septembre 2026) : suppression automatique des
  branches fusionnées, alertes de vulnérabilités Dependabot et correctifs de
  sécurité automatiques activés.
- **Vinext** ✅ (20 septembre 2026) : le retard de sept bêtas est rattrapé,
  `1.0.0-beta.3` vers `1.0.0-beta.10`, dans le lot Vite avec `vite` `8.3.0`,
  `@cloudflare/vite-plugin` `1.56.0`, `@vitejs/plugin-rsc` `0.5.35`, `wrangler`
  `4.135.0` partout et les types Workers `5.20260918.1`. Aucune version stable
  n'existe encore ; le risque reste accepté et consigné (D-015), avec suivi
  régulier et réévaluation à la 3.9. — 1er octobre 2026 : la version stable
  `1.0.0` est en place (PR #121, qui remplace la PR Dependabot rouge #116).
- **Mises à jour du 1er octobre 2026** ✅ : six PR Dependabot fusionnées par
  le porteur, une à la fois, après la montée de vinext : types Workers
  `5.20260927.1`, `next` `16.3.6`, `@vitejs/plugin-react` `6.1.1`,
  `@types/node` `22.20.4`, `actions/upload-artifact` 7 et TypeScript
  `6.0.3` partout, examinée avant fusion. Journal et points ouverts 20 et 21
  dans `docs/ETAT_DU_PROJET.md`.
- **Mises à jour du 8 octobre 2026** ✅ : `knip` 6.39.0 fusionné par le porteur
  (#142) ; les quatre autres PR Dependabot du 7 octobre reprises en une seule
  PR du dépôt, pour un seul déploiement — `eslint-config-next` 16.3.8,
  `drizzle-orm` 0.45.3, `vite` 8.3.2, `vinext` 1.0.1 —, avec `next` 16.3.8
  (#147, ouverte par Dependabot après la fusion de #142), correctif de
  sécurité ; PR #148 fusionnée et déployée le soir même, treize alertes de
  développement restantes. Contrôles complets, parcours compris. Journal dans
  `docs/ETAT_DU_PROJET.md`.

Preuve de fin, atteinte le 20 septembre 2026 : `pnpm check`, compilation et
contrôles des deux Workers verts à chaque lot ; recette visuelle sans écart
pour Tailwind et pour React ; serveur de développement local réparé ;
notification réelle reçue sur téléphone ; les six PR Dependabot ouvertes sont
traitées et fermées ; `ETAT_DU_PROJET.md`, `CHANGELOG.md` et `DECISIONS.md` à
jour, avec les décisions D-018 et D-019 ajoutées en cours de route.

Alertes de vulnérabilité, état au 20 septembre 2026 : vingt-cinq au matin, une
quinzaine le soir. Celles qui restent proviennent toutes de dépendances de
développement, `undici` et `ws` tirés par Wrangler et Miniflare, `js-yaml` par
l'outillage. Elles s'exécutent sur le poste et dans la CI, jamais dans le
Worker déployé, et leur correction dépend d'une version de Wrangler qui ne les
embarque plus. À surveiller lors des mises à jour suivantes ; aucune action
possible aujourd'hui. — Rectifié le 1er octobre 2026 : `pnpm-workspace.yaml`
épingle lui-même `undici` et `ws` à des versions vulnérables, ce qui bloque
Dependabot ; une action est possible, consignée au point ouvert 20 de
`docs/ETAT_DU_PROJET.md`. — Fermé le 2 octobre 2026 : l'épinglage de `ws`
est levé, celui d'`undici` relevé à 7.29.1 avec sa raison et sa condition de
retrait ; vingt-trois alertes attendues fermées à la fusion, onze transitives
restantes (`brace-expansion` ×6, `fast-uri` ×3, `js-yaml` ×1, `fflate` ×1),
à suivre avec les lots Dependabot.

### Q5 — Parcours navigateur automatisés (✅ close le 20 septembre 2026)

- Playwright en mode `OTF_DATA_SOURCE=mock` et `LOCAL_DEMO_USER=true`, base
  locale migrée ; la manière d'appliquer les migrations à la base locale
  n'est pas documentée aujourd'hui et fait partie du travail.
- Quatre parcours issus de la recette de tranche 2 : irriguer maintenant avec
  minuteur, planifier puis annuler, saisir une irrigation déjà réalisée,
  consulter les cumuls et exporter le CSV. Chacun sur ordinateur et à 390 px,
  avec contrôle de l'absence de débordement horizontal.
- Job CI séparé, captures conservées comme artefacts.

Preuve de fin, atteinte le 20 septembre 2026 : job « Parcours navigateur » vert
sur les PR et sur `main`, douze vérifications aux deux largeurs en une minute
et demie, très en deçà des cinq minutes visées. Les quatre parcours existent,
la base locale se remet à zéro avant chaque exécution, et un fournisseur météo
de démonstration ferme la dernière source de hasard. Traces et captures des
parcours en échec sont conservées comme artefacts. — Depuis le 2 octobre
2026, ce job est requis par la protection de `main` (D-026) : une PR aux
parcours rouges ne se fusionne plus.

Aléa constaté le 5 octobre 2026 pendant les contrôles de la PR du point 28
(point 37 de l'état) : le parcours P9, largeur ordinateur, clique l'onglet
« Par série » deux secondes après un rechargement, et la trace montre les
modules de la page encore en chargement après le clic ; 23 sur 24 deux fois de
suite, 1 sur 1 rejoué seul. Le piège du premier clic est connu depuis la
deuxième PR de Q5 ; la parade de `ouvrirParClic` ne couvre pas le clic qui
suit un rechargement. Corrigé le 8 octobre 2026 sur le mot du porteur : après
son rechargement, P9 clique l'onglet par `ouvrirParClic` jusqu'à ce qu'il soit
sélectionné ; l'aide et le contrat disent qu'un rechargement remet le parcours
dans la situation du premier clic ; les parcours P1, P4 et P6, qui rechargent
aussi la page, ont été vérifiés : P1 attend que son minuteur avance avant de
cliquer, preuve équivalente ; P6 ne fait que lire ; P4, dont le premier geste
pouvait être de feuilleter l'historique, ouvre et ferme d'abord la bulle
d'aide, comme P7 à son départ, corrigé dans la même PR ; suite complète 24 sur
24 réussis en local ; PR #145 fusionnée et déployée le 8 octobre 2026 au soir.

Deux constats consignés pendant l'écriture des parcours, sans correction de code
car aucun n'est un défaut : les cumuls et l'historique sont rendus par le
serveur et ne se recalculent pas quand une irrigation est enregistrée ailleurs
dans la page, un retour sur la page suffisant à les rafraîchir ; et l'écran
désactive l'enregistrement d'une irrigation dont la fin précède le début, plutôt
que d'accepter puis de se plaindre.

### Q6 — Découpage des fichiers concentrateurs (✅ close le 21 septembre 2026)

Contrat `docs/file-splitting-contract.md`, rédigé avant le code. Sans changement
de comportement, protégé par Q2 et Q5. Six fichiers dépassent la limite de 600
lignes posée par Q3, la feuille de style n'est pas concernée par cette règle
mais concentre 5 137 lignes.

- `app/irrigation/irrigation-event-manager.tsx` (1 459 lignes) : formulaire,
  minuteur, conflits et limites, alertes. ✅ 21 septembre 2026, neuf modules
  dans `app/irrigation/irrigation-manager/`, dont trois hooks.
- `app/irrigation/hierarchy-browser.tsx` (1 412 lignes) : navigation, plan,
  placements, panneaux. ✅ 21 septembre 2026, six modules dans
  `app/irrigation/hierarchy/`, dont le hook de placement.
- `db/irrigation-event-repository.ts` (1 355 lignes) : lecture, création et
  planification, cycle de vie, alarmes Push. ✅ 21 septembre 2026, découpé en
  dix modules dans `db/irrigation-event/`.
- `db/equipment-repository.ts` (793 lignes) : matériels, réglages, doublons,
  archivage. ✅ 21 septembre 2026, découpé en sept modules dans `db/equipment/`.
- `lib/domain/irrigation-history.ts` (726 lignes) : périodes, portées, cumuls,
  export. ✅ 21 septembre 2026, découpé en six modules dans
  `lib/domain/irrigation-history/`.
- `app/irrigation/irrigation-event-actions.ts` (642 lignes) : validation,
  limites, appels aux dépôts. ✅ 21 septembre 2026, cinq modules extraits dans
  `app/irrigation/irrigation-event/`.
- `app/irrigation/irrigation.css` (5 137 lignes) : un fichier par composant,
  ordre des règles conservé à l'identique. ✅ 21 septembre 2026, dix-huit
  fichiers dans `app/irrigation/styles/` ; la feuille compilée est identique
  octet pour octet, empreinte du fichier comprise.

S'y ajoute la fermeture de l'exception laissée par Q3 : les types
d'enregistrement descendent de `db/` vers `lib/domain` (décision D-020).

Neuf PR, listées dans le contrat (huit prévues, le composant d’irrigation
ayant pris la sienne).

Preuve de fin atteinte le 21 septembre 2026 : `max-lines` passée en erreur et
aucun fichier au-dessus de la limite, un test lisant le dépôt réel et non un
extrait ; 427 tests verts ; les douze vérifications des parcours navigateur
inchangées à chaque PR ; feuille de style compilée identique octet pour octet ;
aucune règle métier déplacée vers l'interface.

Chiffres de la sous-tranche : sept fichiers découpés, soixante et un modules
nouveaux, plus quatre modules de types descendus dans le domaine. Du plus long
— 1 459 lignes ramenées à 545 — à la feuille de style, 5 137 lignes en
dix-huit fichiers. Aucune ligne de code modifiée, vérifié à chaque PR par
comparaison ligne à ligne. Vingt-neuf déclarations rendues publiques par un
découpage sont redevenues locales : `knip` en a signalé vingt-huit, la
dernière — un type, que l'outil ne voit pas — a été trouvée à la main.

Deux constats consignés sans correction, conformément au contrat : le type
`IrrigationTimerState` est déclaré deux fois à l'identique dans le domaine, et
deux effets indépendants du composant d'irrigation ont changé d'ordre.

## 5. Extension — Suivi par série culturale (✅ close le 29 septembre 2026)

Cahier des charges, section 13. Condition de déblocage, écrite le 18 septembre
2026 : une route `GET` OTF versionnée et autorisée reliant chaque série aux
planches occupées, avec mètres linéaires, dates et identifiant stable
d'occupation.

**Débloquée le 26 septembre 2026.** L'API d'Ouvre ta ferme expose désormais
`/placeList`, `/seriesList`, `/taskList` et `/actionList`, sous la
portée `production:read` que la clé du module porte déjà. Trois des quatre
conditions sont remplies telles quelles ; la quatrième, les dates, ne l'est
pas directement : l'occupation se **recalcule** depuis les tâches, par la
règle d'OTF reprise à notre compte (D-021). Reconnaissance faite le jour même
sur la ferme du porteur — 254 séries, 397 emplacements, 161 planches
occupées dont 132 par plusieurs séries — et règle vérifiée sur trois séries.

Le contrat `docs/series-contract.md` fixe les routes ajoutées à la liste
blanche, la période d'occupation, l'attribution de la totalité des
millimètres de la planche à chaque série, la pondération par surface occupée,
les cumuls par série et les cas limites rencontrés sur la ferme. **Validé par
le porteur le 28 septembre 2026** (D-022) : fin de période à la dernière
récolte, surface mouillée selon le matériel, séries sans implantation et en
bloc ignorées sans affichage, lecture des tâches en une passe sous les quatre
appels par seconde. Il précède le cadrage 3.5.0, que la connaissance des
séries change.

### 5.0 — Surface mouillée en aspersion sur les planches (✅ close le 29 septembre 2026)

Décision D-022, règle 2 : en aspersion, la surface mouillée est la planche
**et** le passe-pied ; en goutte-à-goutte, la planche seule ; chaque
irrigation selon son propre matériel. Le module compte aujourd'hui la planche
seule quel que soit le matériel (`litersPerHourForBed` sur
`bed.areaSquareMeters`), donc sous-estime les m³ demandés à la ressource en
aspersion et fausse d'autant la faisabilité. Les millimètres affichés ne
changent pas ; les volumes, la consommation et la faisabilité changent.
Passe-pied inconnu : surface d'aspersion inconnue, signalée, jamais nulle
(D-003). **Contrat écrit le 28 septembre 2026,
`docs/wetted-surface-contract.md`** : deux surfaces jamais confondues — la
surface de la planche pondère les millimètres, la surface mouillée convertit en
volumes et débits —, une fonction unique du domaine, une colonne additive sur
les applications d'irrigation, et les lignes existantes gardent leur volume
(D-023, tranché le même jour par le porteur). **Validé par le porteur le
28 septembre 2026**, ses trois points de mise en œuvre compris : la plus
grande surface pour le besoin d'une planche portant les deux matériels, le
volume inconnu quand le passe-pied manque, le remplissage des lignes
existantes. Le code peut s'écrire, tests d'abord.

**Avancement, 28 septembre 2026 au soir — première PR de code fusionnée et
déployée (#100), sur deux.** Elle pose la règle en un seul endroit du domaine
(`wettedAreaSquareMeters` et `resolveBedWettedArea`,
`lib/domain/irrigation-calculations.ts`) et l'applique aux projections : le
panneau « Apport calculé par heure » compte le passe-pied en aspersion et
signale une planche sans passe-pied connu au lieu de la compter zéro ; le
besoin d'une planche porte sa surface mouillée et sa provenance, son volume
se calcule dessus, et la dose de la faisabilité fait l'aller-retour sur la
même surface ; « Voir le calcul » et le pied du « Pourquoi ? » montrent la
surface retenue ; le tableau des besoins se recalcule quand un placement
change. Huit tests nouveaux, les parcours P1 et P8 vérifient 22,5 m² et
36 m² sur N01 aux deux largeurs.

**Seconde PR, 29 septembre 2026** : la migration additive 0016 ajoute
`wetted_area_square_meters` aux applications d'irrigation et remplit les
lignes existantes avec leur surface de planche (D-023) ; chaque irrigation
enregistre désormais la surface mouillée de son matériel, et tout ce qui en
dérive la lit — débit demandé à la pompe, volumes des cartes, du journal d'eau,
des cumuls et de l'historique, limite journalière à la création et au
démarrage, eau planifiée des projections. Une planche sans passe-pied connu
donne un volume **inconnu et signalé** — « — », total marqué incomplet, débit
« non vérifié » —, jamais un volume sur la planche seule ; une irrigation
planifiée ou démarrée est refusée quand une limite journalière s'applique à
ses jours. Le détail d'une irrigation montre la surface mouillée retenue et la
nature du matériel. Constaté sur la version déployée après la première PR :
débit total 29,35 → 39,57 m³/h, rampes de serre à 1,28 et 2,56 m³/h, B1-1 à
26,4 m² mouillés, aucune planche sans passe-pied connu.

**Fusionnée et déployée le 29 septembre 2026 au matin (#102, `cfacdf5`),
recette réelle passée le jour même, étape close.** Constats de l'assistant sur
la version déployée, dans le navigateur du porteur, sur la ferme :

- aspersion « Rampe de serre tunnel 1 », réglage Standard, une heure
  enregistrée « déjà réalisée » : 8 planches, 10 mm ; historique « Surface
  concernée 96 m² », « Surface mouillée 128 m² — aspersion, planche et
  passe-pied », « Volume réel 1,28 m³ », « Débit demandé 1,28 m³/h ». À la
  main : 8 × (16 m × 0,75 m + 16 m × 0,25 m) = 128 m², × 10 mm = 1 280 L ;
  la planche seule aurait donné 0,96 m³ ;
- goutte-à-goutte « gag1 », réglage standard, une heure : 4 planches B1-0 à
  B1-3, 14 mm ; « Surface concernée 66 m² », « Surface mouillée 66 m² —
  goutte-à-goutte, planche seule », « Volume réel 0,924 m³ ». À la main :
  4 × 16,5 m² × 14 mm = 924 L ; en aspersion, la même heure aurait mouillé
  105,6 m² ;
- cumul de la semaine : 2,204 m³ = 1,28 + 0,924, surface irriguée 162 m² =
  96 + 66 (surface de planche, pas surface mouillée) ;
- les vingt-deux irrigations antérieures à l'étape, toutes en goutte-à-goutte
  sur gag1, gardent leur volume : surface mouillée 66 m² égale à la surface
  concernée, et chaque volume vaut encore ses millimètres × 66 m² — 683,84 mm
  → 45,134 m³ le 1er septembre, 595,51 mm → 39,303 m³ le 17 —, cumul saison
  87,352 m³ pour 24 irrigations ;
- aucune mention « surface mouillée inconnue », « volume inconnu » ni
  « passe-pied non renseigné » sur la page : tous les passe-pieds sont
  connus. La ferme n'avait aucune aspersion enregistrée avant l'étape ; la
  règle du remplissage (D-023) n'est donc prouvée sur données réelles qu'en
  goutte-à-goutte, et par le test de migration en aspersion.

Lecture à 390 px sur la version déployée, faite le même matin à la demande du
porteur : la fenêtre de l'extension refuse toujours de se redimensionner,
même après que le porteur a remis la sienne en fenêtre normale ; la page a
donc été chargée dans un cadre de 390 px de large à l'intérieur de l'onglet,
ce qui lui applique les règles d'affichage d'un téléphone — sans en avoir le
tactile ni l'agent utilisateur. Constaté : aucun débordement horizontal
(largeur de défilement 375 px) ; le panneau « Apport calculé par heure » en
une colonne, débit total 39,57 m³/h, gag1 924 L/h, rampe de serre tunnel 1
1,28 m³/h ; le formulaire « Déjà réalisée » avec son résultat calculé
« 8 planches · 1,28 m³ » ; les cartes de cumuls empilées, 2,204 m³ et
162 m² ; le détail des deux irrigations en colonne avec « Surface mouillée
128 m² — aspersion, planche et passe-pied » et « 66 m² — goutte-à-goutte,
planche seule ». Les deux irrigations d'essai restent dans l'historique de la
ferme (D-006, aucune suppression) : 29 septembre 2026, 6 h – 7 h sur le
tunnel 1 et 7 h – 8 h sur gag1.

### 5.1 — Suivi par série (✅ close le 29 septembre 2026)

Le développement suit la « Preuve de fin » du contrat : tests du domaine, du
connecteur et de la persistance, parcours navigateur, recette réelle sur trois
séries de la ferme. Il se fait en trois PR, tests d'abord : le connecteur et
l'instantané, le domaine des périodes d'occupation et des cumuls par série,
puis la vue « Séries » et l'export.

Modèle et effort recommandés : Fable 5.1 · Élevé.

**Première PR, 29 septembre 2026 — connecteur et instantané.** Cinq routes
`GET` rejoignent la liste blanche — `/actionList`, `/plantList`,
`/seriesList`, `/placeList`, `/taskList` —, la cinquième ajoutée au
contrat ce jour parce qu'une mise en culture ne porte que l'identifiant de
son espèce. Le connecteur n'envoie que les paramètres écrits dans son code,
jamais `season` aux tâches, et refuse une lecture au-delà du plafond de
pages au lieu de la tronquer. Le plan de culture de la saison suit dans la
même lecture atomique et entre dans l'instantané (`cropPlan`, nouvelle
version de clé de cache) : séries de la saison avec leurs mises en culture
nommées, emplacements sur des planches connues avec leur linéaire en mètres,
et les seules tâches de semis direct et de plantation des séries de la
saison, réduites à sept champs ; tout ce qui est écarté est compté. Les
semaines ISO d'Ouvre ta ferme (`AAAA-Wss`) ont leur module du domaine,
vérifié aux bords d'année. Les données de démonstration portent une
succession sur N01, une série à venir dont la plantation suit la date du
jour, des tomates en cours, une série sans implantation et une série en
bloc. Aucune période, aucun cumul, aucun écran : c'est la suite. **Fusionnée
et déployée le jour même (#104).**

**Seconde PR, 29 septembre 2026 — domaine et service.** La période
d'occupation se recalcule depuis les tâches (`lib/domain/series/occupation.ts`) :
implantation à la plus précoce des tâches de semis direct ou de plantation,
semaine réalisée si cochée sinon planifiée, tâche sans mise en culture valant
pour toutes ; fin à la dernière récolte, réalisée sinon attendue ; lundi et
dimanche en `Europe/Paris`, sans borne d'année civile ; pérenne au 1er janvier
de la saison ; à venir, en cours, terminée ; en bloc et sans implantation
ignorées avec leur motif. Les cumuls (`lib/domain/series/water.ts`) sont une
projection sur l'historique par planche : chaque série reçoit la totalité des
millimètres de ses planches sur sa seule période, deux séries la même semaine
les reçoivent chacune ; les millimètres se pondèrent par la surface de planche
occupée, les volumes s'additionnent sur la surface mouillée de chaque
irrigation au prorata du linéaire ; pluie au pluviomètre sinon réanalyse,
zéro sous abri, absente signalée ; objectif proratisé par jour sur les jours
écoulés, objectif restant à part ; écart = objectif − (irrigation + pluie) ;
ET0 à côté. Le contrat est corrigé de ce que 5.0 a tranché : la surface de
planche pondère, la surface mouillée convertit. Le service lit les irrigations
par instants toutes saisons confondues — le dépôt d'historique accepte
désormais une lecture sans saison, toujours bornée au propriétaire — et les
objectifs de la saison et de la précédente. Vingt-deux tests nouveaux, dont
un de persistance qui cumule un aillet implanté en novembre 2025 sur ses deux
saisons. **Fusionnée et déployée le jour même (#105).**

**Troisième PR, 29 septembre 2026 — la vue « Séries », l'export et le
parcours P9.** L'écran des cumuls gagne un commutateur « Par périmètre / Par
série » ; la vue par série se charge à la demande et se recalcule à chaque
ouverture. Une carte par série en cours ou terminée : nom, espèces,
implantation avec sa nature et sa semaine — réalisée ou planifiée —,
dernière récolte, planches et linéaire, période observée, puis irrigation en
millimètres et mètres cubes, pluie, objectif, écart, ET0 ; le détail donne la
surface occupée, le volume, la pluie disponible, l'objectif restant et, par
planche, linéaire, millimètres, volume, pluie et objectif. Les séries à venir
forment leur groupe, avec leur motif ; les séries en bloc et sans implantation
n'apparaissent pas mais sont comptées dans un avertissement, comme les
emplacements écartés à la lecture. Sans plan de culture lu, l'écran le dit et
renvoie à « Actualiser ». L'export CSV gagne la colonne « Séries » après les
planches : les séries qui occupaient les planches arrosées le jour de
l'irrigation. À 390 px, le tableau des planches devient une liste et les
mesures passent sur deux colonnes, sans défilement horizontal. Le parcours P9
joue tout cela sur les données de démonstration aux deux largeurs.
**Fusionnée et déployée le jour même (#106).**

**Recette réelle, 29 septembre 2026 au soir, sur la version déployée
(`docs/recette-series.md`).** Sur la ferme : 223 séries en cours ou terminées,
18 à venir, 13 non suivies — 11 sans implantation, 2 en bloc, les mêmes que la
reconnaissance du 26 septembre. Trois séries comparées à la main : Mâche #1
sur T1-8, en cours — semaines 37 → 43 comme dans Ouvre ta ferme, 10 mm et
0,16 m³ pour l'aspersion du matin, pluie 0 sous abri, objectif 80,7 mm et ET0
81,6 mm identiques à la vue par périmètre sur la même planche et la même
période, écart +70,7 mm ; Cosmos 2 sur 10 m de B1-2, terminée — semaines 19 →
38, 1 289,5 mm comme la planche et 9,671 m³ soit les 21,277 m³ de la planche
au prorata de 10 m sur 22, pluie absente et signalée ; Tomates primeurs à
Chloé sur T1-1 et T1-2, terminée — semaines 13 → 31, 0 mm. Un défaut trouvé et
corrigé le jour même : la ligne d'une planche affichait une pluie partielle
comme un total. Un point ouvert au jugement du porteur — la vue par périmètre
comptait la pluie sur une planche sous abri, la vue par série non — tranché le
9 octobre 2026 : la vue par périmètre applique la même règle (D-032, point
ouvert 11). **L'extension est close.** Reste, dans l'ordre de la roadmap, le
cadrage 3.5.0.

## 5 bis. Extension — Alertes météo paramétrables (✅ code commencé le 31 octobre 2026, recette validée le 6 novembre 2026)

Demande du porteur, consignée le 9 octobre 2026 sur son mot : « paramétrer des
alertes météo en fonction de critères renseignés par l'utilisateur ; par
exemple, envoyer une notification si la température minimale descend en
dessous de 5 °C ». Cette section relevait ce qui existe déjà, ce qu'un contrat
devait trancher avant le code, et proposait une place dans l'ordre
d'exécution.

**Contrat écrit et validé le 30 octobre 2026** (`docs/weather-alerts-contract.md`,
D-050). Le porteur a accepté le jour même les huit recommandations et les
choix faits en l'écrivant (« D'accord pour tout ») : critères de
l'exploitation sur la température minimale, la température maximale et la
pluie prévues du jour, déjà lues chaque matin ; pas de vent au départ, seul le
vent moyen étant lu ; « en dessous » et « au-dessus » stricts ; horizon de 1 à
7 jours, 3 par défaut ; évaluation après chaque écriture de prévisions, jamais
sur une valeur absente ; une seule alerte par critère et par jour visé ;
alertes enregistrées ; températures prévues conservées par une migration
additive ; route d'envoi immédiat au Worker Web Push ; encart près de la météo
de la semaine, le clic ouvrant la semaine du jour visé. L'alerte est une
information : elle ne touche ni le besoin, ni l'objectif, ni le planning. Code
en trois PR (domaine, persistance et envoi, écran), neuf scénarios chiffrés.

**Code commencé le 31 octobre 2026** sur le « vas-y » du porteur, en Opus
5.5 · Élevé. PR 1 sur 3, le domaine (`lib/domain/weather/weather-alerts.ts`) :
validation du critère, évaluation, répétition, texte de la notification,
alertes à enregistrer, scénarios 1 à 7 testés (#224, fusionnée et déployée).
Choix fait en codant : activer ou désactiver un critère n'en fait pas une
nouvelle version. PR 2 faite en deux : 2a, la route d'envoi immédiat du
Worker Web Push (`docs/push-worker-contract.md`, « Envoi immédiat », #225,
fusionnée et déployée), déployée avant que l'application l'appelle ; 2b, la
migration additive 0022 (températures prévues, critères et versions,
alertes), l'évaluation après chaque écriture de prévisions et les
scénarios 8 et 9 (#226, fusionnée et déployée). PR 3, l'encart « Alertes
météo » sous la semaine de la météo, la colonne « Températures prévues »,
la page ouverte sur `?week=…#weather` par le clic, le parcours navigateur
P13 (#227, fusionnée et déployée le 31 octobre 2026). La recette réelle
sur la ferme — un critère franchi par la prévision du jour, l'alerte reçue
sur le téléphone verrouillé, le clic qui ouvre la bonne semaine, aucune
seconde alerte à l'actualisation suivante — est **validée par le porteur le
6 novembre 2026** (« Oui, c'est bon, ça marche », 09 h 18) : la 5 bis est
close. Les deux paragraphes suivants sont le cadrage
du 9 octobre 2026, que le contrat remplace.

**Ce qui existe déjà.** La synchronisation météo de 06 h 15, heure de Paris
(`docs/weather-scheduler-contract.md`), lit pour chaque jour prévu les champs
gratuits de Visual Crossing — pluie, températures moyenne, minimale et
maximale, point de rosée, vent moyen, énergie solaire
(`docs/weather-contract.md`) — mais n'en conserve que la pluie et l'ET0
calculée (`irrigation_weather_daily_values`) : les températures ne sont pas
persistées aujourd'hui. Le Worker Web Push (`docs/push-worker-contract.md`)
délivre déjà des notifications par abonnement, aujourd'hui pour les seules
alarmes du minuteur ; un clic n'ouvre qu'une adresse interne à `/irrigation`.

**À trancher dans un contrat avant le code.** Un critère porte un champ météo,
un sens — en dessous, au-dessus —, un seuil avec son unité explicite (°C, mm,
km/h) et un horizon en jours ; il appartient à l'utilisateur et à son
exploitation. L'évaluation se fait après chaque synchronisation, sur les
prévisions, jamais sur une valeur absente : une donnée manquante ne déclenche
rien et le dit (D-003). Une alerte envoyée est enregistrée — critère, jour
visé, valeur prévue, heure d'envoi — ; la règle de répétition, une fois par
jour visé ou à chaque changement de la prévision, reste à choisir. Soit les
champs utiles sont persistés par une migration additive (D-018), soit
l'évaluation se fait au moment de la synchronisation ; le contrat choisira.
Questions pour le porteur : les champs offerts au départ, la température
minimale au moins ; l'horizon en jours ; la répétition ; l'écran où se règlent
les critères ; ce qu'ouvre le clic sur la notification.

**Place et modèle.** Après la 3.7 et avant la 3.8, en 17 de l'ordre
d'exécution, puis en 18 depuis le 27 octobre 2026, la 5 ter passant devant,
puis en 19 le même jour, la 2.11 passant devant la 3.7, puis en 20 le 30
octobre 2026, la 5 quater et la 5 ter passant devant,
parce que la fonctionnalité ne dépend pas du planning et que la
réorganisation 3.8 rangera son écran avec les autres ; place proposée le 9
octobre 2026 et confirmée par le porteur le jour même. Modèle · effort : Opus
5.5 · Élevé — fonctionnalité délimitée sous contrat écrit, tests et CI jugent ;
les seuils agronomiques, eux, sont ceux du porteur. Contrat écrit en Opus 5.5
· Moyen, le 30 octobre 2026, sur le mot du porteur.

## 5 ter. Extension — Réserve du sol (🟡 demandée le 27 octobre 2026, code commencé le 6 novembre 2026)

Demande du porteur, le 27 octobre 2026 : renseigner la réserve facilement
utilisable (RFU) que donnent les analyses de sol, et la voir là où se décide
l'arrosage, pour savoir si le plein du sol est fait. Le logiciel n'avait
jusque-là aucune représentation du sol : le mot « réserve » y désigne la
réserve d'eau de la ferme.

**Contrat écrit le jour même** (`docs/soil-reserve-contract.md`, D-041),
relu et validé par le porteur le 31 octobre 2026 (D-053). En bref, dans son
état du 27 octobre : la RFU se saisit par
parcelle, avec une valeur propre possible par jardin ou abri, en mm par
mètre de sol (D-046) ; la capacité d'une planche vaut la RFU par cm fois
la profondeur racinaire de sa culture ; la jauge part d'une observation du
maraîcher, un curseur par parcelle ou par jardin, puis suit la pluie,
l'irrigation et la consommation, l'ET0 multipliée par un coefficient
réglable, remplacée le 30 octobre par l'ETM ;
sous abri, la pluie vaut 0. La jauge est une information, estimée jusqu'à
maintenant et prévue jusqu'à dimanche ; elle n'entre ni dans le besoin ni dans
le planning (D-010, D-028).

**Révisé le 30 octobre 2026** sur le complément « jauge RFU » du porteur
(D-047, section datée à la fin du contrat). La consommation devient l'ETM de
la 5 quater ; le coefficient réglable disparaît. La RFU du sol vaut la RFU du
laboratoire corrigée des cailloux : 62 mm/m × 0,82 = 51 mm/m pour la ferme,
18 % de cailloux estimés par le porteur. Un abri sans analyse prend la RFU
de sa parcelle, marquée « non mesuré ». Profondeurs racinaires de départ
fournies par le porteur (ITAB), la moitié au premier stade, 30 cm proposés
pour une culture sans valeur. Un seuil de déclenchement par culture,
capacité × (1 − min(1 ; p / 0,5)) d'après la part utilisable p de la FAO-56
— le complément écrivait la formule inversée, corrigée sur le choix du
porteur —, les jours avant le seuil, la dose conseillée et le drainage
s'affichent. Le complément faisait remonter une planche sous son seuil dans
les priorités ; le porteur choisit « Information seulement » : la jauge ne
change ni priorité ni dose.

**Relu et validé le 31 octobre 2026** par le porteur, question par
question (D-053, section datée à la fin du contrat). Les seuils se calculent
sur une part de référence de 2/3, celle du CRIIAM, au lieu de 0,5 ; la part
p de la FAO-56 vaut pour toutes les cultures qui en ont une (pomme de terre,
carotte et concombre avaient été oubliés), le poireau et le chou kale
prennent celle de leur famille, une culture sans valeur 0,5. Les profondeurs
des vingt cultures de référence absentes de la fiche ITAB viennent d'une
recherche documentaire du même jour, la méthode de Geisenheim surtout. La
moitié de profondeur au premier stade est confirmée, sauf le poireau et les
cultures pérennes. Un abri prend la RFU de sa parcelle sans mention ; le
curseur de parcelle ne règle que le plein champ, avec quatre repères. Sur un
complément du porteur, la jauge continue sur une planche sans culture, avec
le modèle de sol nu de la FAO-56 et six états de surface à coefficients
réglables ; elle n'est inconnue qu'au départ et sur un trou de données ;
aucun conseil d'arrosage avant plantation. Les choix du 27 octobre sont
confirmés, sauf le curseur de parcelle ; une erreur de calcul est corrigée.

**Ce qui reste ouvert.** Rien dans ce contrat ; ce qui dépend de la 5 quater
(rattachement des espèces, durée du premier stade, Kc avant la levée) se
règle à sa relecture. La profondeur de calcul des
62 mm de l'analyse de la ferme n'est plus ouverte : le porteur transmet le 30
octobre 2026 la réponse du laboratoire, 62 mm sur 1 m, et tranche que la RFU
s'exprime toujours en mm par mètre (D-046) ; point ouvert 42 fermé.

**Place et modèle.** En 18 de l'ordre d'exécution depuis l'insertion de la
2.11, après la 3.7 et avant la
5 bis et la 3.8 ; en 19 depuis le 30 octobre 2026, après la 5 quater dont
elle consomme l'ETM, choix du porteur ; son domaine se code après celui de la
5 quater. Contrat écrit en Opus 5.5, sur le mot du porteur, sans
passer par Fable ; relu le 31 octobre 2026 en Opus 5.5 · Très élevé. Code en
quatre PR, le domaine en deux (planches cultivées, puis planches sans
culture), la persistance, puis l'écran : Opus 5.5
· Très élevé pour le domaine, règle agronomique sous contrat écrit dont
l'erreur serait discrète ; Opus 5.5 · Élevé pour la persistance et l'écran.

**Révision du 3 novembre 2026 (D-056).** Sur un complément du porteur, la
profondeur racinaire devient une profondeur par stade pour toutes les
cultures, construite par une règle (0,15 ou 0,20 m au départ, croissance
linéaire jusqu'à la fin de « début + développement », maximum ITAB ou petite
valeur FAO-56), à vérifier à la tarière ; elle remplace la moitié de profondeur
au premier stade. Tomate 0,65 m, courgette et concombre 0,50 m ; melon et
asperge plafonnés à 0,60 m ; plafond de sol facultatif par parcelle. Les
seuils de D-053 sont gardés (la formule du complément était la formule
inversée de D-047), ainsi que la répartition de fin de culture (scénario 28).

Preuve de fin : les quarante et un scénarios du contrat en tests, les tests de
persistance, un parcours navigateur aux deux largeurs, une recette réelle sur
la ferme.

**Code commencé le 6 novembre 2026, sur mandat (D-060).** Le porteur demande
ce jour-là de réaliser seul la 5 ter, la pastille « eau en trop », la
5 quinquies et la refonte ergonomique, en répondant à chaque question par
l'option recommandée ; chaque choix est consigné dans le contrat et dans
D-060. La 3.8 reste hors de ce mandat. PR 1, le domaine
(`lib/domain/soil-reserve/` : le sol, les profils racinaires, le modèle de
sol nu, la jauge jour par jour, les signaux), faite en une seule PR, la jauge
étant continue entre culture et sol nu : les quarante et un scénarios du
contrat en tests (`tests/soil-reserve-crop.test.ts`,
`tests/soil-reserve-bare.test.ts`). Le seuil d'arrosage réglable (D-059) y
entre en deux modes : le seuil selon la culture par défaut, ou un % du plein
réglé par l'exploitation, de 20 à 80 % par pas de 5 %, 50 % proposés, le
seuil selon la culture restant rappelé. Dix-sept précisions faites en codant
sont consignées dans le contrat (section datée du 6 novembre 2026). PR 2, la
persistance, codée le jour même (migration additive 0025, `db/soil-reserve/`,
`tests/db/soil-reserve-persistence.test.ts`) : sept tables, dont six de
révisions immuables ; le jeu commun de trente et un profils racinaires écrit
avec sa source ; aucune valeur de sol écrite, chaque ferme saisit la sienne ;
dix précisions consignées dans le contrat. PR 3, l'écran, découpée en trois :
3a, les réglages du sol, codée le jour même (un pli « Réglages du sol » dans
le bloc « Réserve du sol » de la section « Planning de la semaine » : par
parcelle, la RFU du laboratoire, les cailloux et la RFU du sol calculée
pendant la saisie, la part de référence, TEW, REW, Ze, le plafond de sol, la
provenance et la source ; par jardin ou abri, sa valeur propre ; pour
l'exploitation, le seuil d'arrosage, les coefficients des états de surface et
la part de pluie sous paillage plastique ; parcours P18 aux deux largeurs ;
huit précisions consignées dans le contrat) ; 3b, le bloc par jardin, codé
le jour même (par parcelle, son curseur de plein champ ; par jardin ou abri,
le % du plein de maintenant, la planche la plus basse, le prévu jusqu'à
dimanche, son curseur ; par planche, son état sur sa capacité, son seuil, les
signaux, le drainage, les cultures, les mentions et, sans culture, son état
de surface déclaré ; parcours P19 aux deux largeurs ; neuf précisions
consignées dans le contrat) ; 3c, les profils racinaires dans la page
« Coefficients culturaux », codée le jour même (dans la carte de chaque
culture, la part p et la profondeur de chaque stade qui comptent, le jeu
commun rappelé à côté d'un profil de la ferme, un formulaire qui enregistre
un profil entier à partir d'un jour ; parcours P20 aux deux largeurs ; cinq
précisions consignées dans le contrat) ; 3d, l'état du jour enregistré chaque
matin et la dose au-delà de ce que le sol retient sur les propositions du
planning, codée le jour même (après la météo et l'ETM du matin, l'état des
sept jours d'avant de chaque planche ; sous chaque proposition encore
proposée, les mm qui dépassent ce que le sol peut encore retenir, perdus en
drainage ; deux précisions consignées dans le contrat). Puis la pastille
« eau arrosée en trop », codée le jour même sur le même mandat : en tête du
bloc « Réserve du sol », l'eau d'irrigation des sept derniers jours que le
sol n'a pas pu retenir, partagée avec la pluie au prorata des mm, en tout
puis par planche, en mm et en m³ ; sept points consignés dans le contrat
(« La pastille de l'eau arrosée en trop »). Les sept PR sont fusionnées et
déployées le 6 novembre 2026 (#245 à #251). **Recette réelle faite le
6 novembre 2026** sur son « vas-y » (`docs/recette-5-ter.md`) : le sol de
la Clémentière et une observation de 50 % enregistrés sur ses réponses,
cinq planches justes à la main ; un défaut trouvé, « maintenant » refusé
pour une observation quand l'horloge de l'appareil avance sur celle du
serveur, corrigé le soir même (deux minutes de tolérance, comme pour la
date d'une pose) ; le jugement agronomique et le contrôle des racines à la
bêche sous abri lui reviennent (D-014).

## 5 quater. Extension — Besoin en eau par culture et par stade (🟡 demandée le 30 octobre 2026, relue le 31, code commencé le 5 novembre, persistance et écran commencés le 6)

Demande du porteur, le 30 octobre 2026 : retrouver dans la roadmap le calcul
du besoin selon la culture et son stade, qu'il avait envisagé au cadrage du
planning (D-024, point 11), puis le verser au dépôt à partir d'un document de
travail préparé par lui avec un autre assistant (sources CRIIAM Sud et
FAO-56, règles, tests chiffrés), sans code. Jusque-là, le sujet n'existait
que comme question ouverte (section 8) et comme « porte laissée ouverte » du
contrat du planning.

**Contrat écrit le jour même** (`docs/crop-water-need-contract.md`, D-045),
à relire par le porteur avant tout code. En bref : pour chaque planche qui
porte une culture et chaque jour, ETM = ET0 × K_abri × Kc × K_paillage ×
K_ombrage ; le Kc vient du CRIIAM Sud pour ses dix-sept légumes, en escalier,
sinon de la FAO-56 en trapèze, jamais les deux pour une même culture ; le
stade est celui que déclare le maraîcher, sinon il se calcule depuis la
semaine d'implantation avec des durées par défaut ; la somme des sept jours
donne un objectif hebdomadaire **proposé**, affiché à côté de l'objectif
saisi. Il n'entre dans le besoin que si l'utilisateur l'adopte, par une
révision d'objectif ordinaire au niveau de la planche ; écart, cumuls,
priorités, faisabilité et planning ne changent pas.

**Relecture du porteur, le 31 octobre 2026 (D-054).** Toutes les questions
du contrat tranchées, point par point, avec une recherche documentaire pour
ce qui n'avait pas de source (section datée du contrat) : dates de stade par
défaut des dix-sept cultures du CRIIAM selon la règle stricte (une phase de la
FAO par stade), corrigées par les sources — tomate 15 et 30 jours, melon
nouaison à 45, haricot 40 et 50, ail à J-45 et J-25, chou-fleur 35 et 50 au
printemps — ; mi-récolte et première récolte calées sur les semaines de
récolte d'OTF ; ail, oignon et fin de pomme de terre à rebours depuis la
récolte ; délais de levée par culture (pomme de terre 25 jours, semis direct
au tableau de Harrington à 15 °C) ; dates fixes, un jeu par saison ;
calendriers fixes pour l'artichaut, l'asperge et le fraisier (ce dernier
estimé, sans source), ces cultures restant sur leur planche après leur
dernière récolte jusqu'à la fin de leur calendrier, exception à D-022 ;
correspondance des 79 espèces de la ferme, par espèce avec exceptions par
série, analogies signalées, fleurs sans référence ; K_abri 0,8 réglable,
paillage × 0,9, lissage désactivé, ombrage codé désactivé et affiché comme
hypothèse ; **mode automatique non retenu**, D-010 inchangée ; sept choix
d'écriture confirmés. Contrat corrigé au passage : contradiction de la
tomate, durées du potiron, ligne « Crucifères », semaines de récolte d'OTF.
Sept scénarios ajoutés (15 à 21). La PR 0 des données de départ est faite
par cette relecture.

**Code commencé le 5 novembre 2026** sur le « vas-y » du porteur, en Opus
5.5 · Max. PR 1, le domaine (#235, `lib/domain/crop-water/`) : les cultures de
référence et leurs courbes (escalier du CRIIAM, trapèze de la FAO-56,
calendrier des pluriannuelles) avec leurs bornes, la correspondance des
espèces et la liste « sans référence Kc », les dates d'une culture tirées de
ses semaines d'Ouvre ta ferme, le stade du jour, calculé ou déclaré, le Kc du
jour avec les surcharges de la ferme, l'abattement et le lissage, l'ET0 du
jour avec sa nature, l'ETM et sa trace, le jour de planche, la proposition
de la semaine, son écart et ses alertes de cohérence, la révision d'objectif
que crée l'adoption, l'avertissement d'aspersion. Les scénarios 1 à 13 et
15 à 24 en tests ; le 14, la non-régression, par la suite existante, qui
passe sans changement. Rien n'est encore branché : ni base, ni écran. Deux
règles du contrat posées au porteur en codant, une question par message, et
tranchées par lui le soir même (D-057) : un stade déclaré recale le
calendrier des stades suivants au lieu de le figer ; la culture reste sur sa
planche jusqu'à la plus tardive de ses semaines de récolte, réalisées ou
attendues, aussi pour la jauge de la 5 ter, le suivi par série gardant sa
règle. Quinze précisions faites en codant, consignées dans le contrat,
modifiables avant la PR de l'écran. PR 1 fusionnée le 6 novembre 2026 à
00 h 25 (`01227cd`) et déployée à 00 h 41 (run 42129119461, quatre jobs
réussis).

**PR 2, la persistance, codée le 6 novembre 2026** en Opus 5.5 · Élevé, comme
le prescrit cette section : migration additive `0023_crop_water_need`,
treize tables et le jeu commun de 32 cultures de référence (dix-neuf du
CRIIAM, l'artichaut et le fraisier en deux types, treize de la FAO-56), avec
la source, la date du relevé et la source des dates par défaut ; la version
d'une culture commune propre à une ferme, ou une culture saisie par elle ;
les surcharges de Kc, les stades déclarés et les K_abri en révisions datées
que la base refuse de modifier ou d'effacer ; la correspondance des espèces ;
le paillage, les filets d'ombrage et les options ; l'ETM du jour par planche
avec sa trace, un jour bloqué n'écrasant jamais la dernière valeur valide.
Dépôts dans `db/crop-water/`, règles d'enregistrement dans
`lib/domain/crop-water/records.ts`, tests de persistance qui relisent le jeu
commun chiffre pour chiffre contre le contrat et rejouent les scénarios 1,
8 et 12 depuis la base. Dix précisions consignées dans le contrat,
modifiables avant la PR de l'écran. Aucune donnée de la ferme n'est écrite.
PR 2 fusionnée le 6 novembre 2026 à 01 h 16 (#236, `0bb0fe1`) et déployée à
01 h 24 (run 42135652593, quatre jobs réussis, migration 0023 appliquée en
ligne). Les quinze précisions du domaine sont validées par le porteur le
6 novembre 2026, toutes sur la recommandation ; les dix de la persistance, posées
une par une pendant le code de l'écran, le sont aussi le jour même.

**PR 3, l'écran, commencée le 6 novembre 2026** sur le « vas-y » du porteur,
en Opus 5.5 · Élevé, découpée en trois PR pour rester relisible : **3a**, la
page « Coefficients culturaux » — les tables des cultures de référence, la
correspondance des espèces de la saison par espèce et par série, la liste
« sans référence Kc » — et le parcours navigateur P14 aux deux largeurs ;
**3b**, la fiche de la planche — stade du jour, Kc, ETM, objectif proposé
face à l'objectif applicable, « Déclarer un stade », « Adopter la
proposition » avec son origine (migration additive) — et la valeur
« proposé » à côté de l'objectif de chaque planche ; **3c**, la fiche de la
série et l'avertissement de l'aspersion en début de cycle, les réglages
(K_abri, paillage, filets, options), les surcharges de Kc, les durées
propres à la ferme et l'ETM enregistrée chaque jour ; elle est découpée à
son tour le jour même en **3c**, les surcharges de Kc et les réglages,
**3d**, l'ETM enregistrée chaque jour et l'avertissement de l'aspersion, et
**3e**, la fiche de la série et les durées propres à la ferme. Puis la
recette réelle sur la ferme, sur son « vas-y ».

PR 3a fusionnée le 6 novembre 2026 à 09 h 46 (#237, `030e628`) et déployée
à 09 h 56 (run 42190102920, quatre jobs réussis, aucune migration).

**PR 3b codée le 6 novembre 2026** : sous le plan, la planche choisie a son
bloc « Besoin de la culture », semaine par semaine ; l'objectif applicable
y est lu par la règle même du besoin ; la proposition adoptée est
recalculée par le serveur et ne s'adopte que pour une semaine qui n'est pas
finie ; elle devient une révision ordinaire de l'objectif de la planche,
avec son origine (migration additive `0024_adopted_goal_origin`), et le
plan se recalcule. « Objectif proposé » paraît sous l'objectif de chaque
planche dans « Besoins d'irrigation ». La ferme de démonstration porte des
carottes en place le jour même sur V01, pour le parcours P15 aux deux
largeurs. Sept précisions consignées dans le contrat ; la place de la
valeur « proposé », dans « Besoins d'irrigation » plutôt que dans le
planning, choisie par le porteur le jour même. PR 3b fusionnée le
6 novembre 2026 à 10 h 22 (#239, `0946a61`) et déployée à 10 h 49 (run
42194501098, quatre jobs réussis, migration 0024 appliquée en ligne).

**Correspondance des espèces de la ferme saisie le 6 novembre 2026** (10 h
15 à 10 h 20), dans le navigateur du porteur et sur son « vas-y » : ses 78
espèces, selon la table du 31 octobre 2026 relue par lui le jour même (l'ail
sans exception, les chicorées frisée et scarole sur la salade d'été par
analogie, après une recherche documentaire).

**PR 3c codée le 6 novembre 2026** : sur la page « Coefficients
culturaux », chaque culture de référence montre ses surcharges de Kc à côté
des valeurs de la source et se surcharge à partir d'un jour, ou revient à la
source ; « Réglages du calcul » règle les options (lissage, ombrage) avec
une phrase qui dit ce que chacune fait, le K_abri de chaque abri, le
paillage plastique des planches de la saison et les filets d'ombrage.
Aucune migration ; parcours P16 aux deux largeurs ; huit précisions
consignées dans le contrat. PR 3c fusionnée le 6 novembre 2026 à 11 h 15
(#241, `995b1fb`), déployée avec la 3d à 12 h 20.

**PR 3d codée le 6 novembre 2026** : ce qui restait de l'écran est découpé
en 3d et 3e. La 3d enregistre chaque matin, après la météo et le planning,
l'ETM de chaque planche pour aujourd'hui et les sept jours d'avant, avec ce
qui l'a produite (la réanalyse remplace la prévision quand elle arrive), et
la fiche de la planche avertit d'un besoin probablement sous-estimé quand
une aspersion arrose une culture au premier stade du CRIIAM tous les trois
jours ou moins. Aucune migration ; cinq précisions consignées dans le
contrat. PR 3d fusionnée le 6 novembre 2026 à 12 h 08 (#242, `877019e`) et
déployée à 12 h 20, avec la 3c.

**PR 3e codée le 6 novembre 2026** : sur la page « Coefficients
culturaux », chaque culture du jeu commun règle ses durées pour la ferme
(délais de levée, début des stades en jours, phases et abattement de la
FAO, jours du calendrier), avec la valeur commune rappelée, et revient aux
durées communes ; dans la vue « Par série » de « Cumuls et historique »,
la fiche de la série montre, sur chacune de ses planches, le stade, le Kc
et l'ETM du jour, la proposition de la planche face à son objectif, et
déclare un stade pour toute la série. Aucune migration ; parcours P17 aux
deux largeurs ; huit précisions consignées dans le contrat, les trois qui
appelaient son choix tranchées par lui le jour même dans le sens codé. PR 3e
fusionnée le 6 novembre 2026 à 12 h 35 (#243, `dfcfa09`), déployée à
12 h 48. **Recette réelle faite le 6 novembre 2026** sur son « vas-y », en
lecture seule (`docs/recette-5-quater.md`) ; le jugement agronomique lui
revient (D-014).

**Place et modèle.** En 20 de l'ordre d'exécution, après la 5 bis et avant la
3.8, place recommandée par l'assistant et choisie par le porteur le 30
octobre 2026 ; en 18 depuis le soir même, avant la 5 ter qui consomme son
ETM et la 5 bis, sur le choix du porteur. Contrat écrit en Opus 5.5, sur le mot du porteur. Code en PR
courtes : PR 0, les données de départ sans code (durées et correspondance,
proposées par l'assistant, validées par le porteur), Opus 5.5 · Élevé ;
domaine, Opus 5.5 · Max (Fable 5.1 · Max avant D-055) — règle agronomique nouvelle qui peut finir dans
l'objectif, le porteur seul juge, erreur silencieuse ; persistance et écran,
Opus 5.5 · Élevé ; ~~mode automatique, s'il est retenu, Fable 5.1 · Très
élevé~~, non retenu le 31 octobre 2026 (D-054).

Preuve de fin : les vingt-quatre scénarios du contrat en tests, aucun résultat
changé dans les tests existants, les tests de persistance, un parcours
navigateur aux deux largeurs, une recette réelle sur la ferme.

## 5 quinquies. Extension — Alertes météo par culture (🟡 code commencé le 6 novembre 2026)

Suite de la 5 bis. Les idées A1 (gel selon la sensibilité de chaque culture) et
A2 (retrait à l'arrosage avant récolte) de la comparaison avec Tlaloc ont été
validées par le porteur le 6 novembre 2026 ; il y a ajouté le même jour les
aspersions à reconsidérer (sans la partie mildiou du soir) et un **curseur de
microclimat** qui décale d'un coup tous les seuils d'alerte de gel.

**Contrat écrit et relu le 6 novembre 2026** (`docs/weather-crop-alerts-contract.md`,
D-058), à partir de `seuils-gel-legumes-etendus.md` (une cinquantaine de
cultures, valeurs à recontrôler à la source avant de coder). En bref : un seul
seuil de gel par espèce, les stades étant ignorés, avec une marge de 3 °C pour
les sensibles et de 2 °C pour les rustiques ; la laitue et le mesclun à −2 °C ;
les cultures à plusieurs valeurs à la plus prudente ; les cultures sans seuil
(fraisier, asperge, fleurs) sans alerte, avec une saisie par la ferme ; les
cultures sous abri alertées comme le plein champ ; une notification par jour
visé qui nomme les cultures concernées. Arrêt d'arrosage avant récolte :
ail 15 jours, pomme de terre 14, courges 10, melon 7, comptés depuis le
premier jour de la première semaine de récolte attendue. Aspersions : les
créneaux de jour sous abri, jugés au jour sur la température maximale (24 °C)
et le rayonnement moyen (400 W/m²). Information seulement (D-010) ; aucun
appel de plus vers Ouvre ta ferme.

**Place et modèle.** En 21 de l'ordre d'exécution, après la 5 ter, avant la
refonte ergonomique et la 3.8. Code en trois PR (domaine, persistance et
envoi, écran), Opus 5.5 · Élevé : fonctionnalité délimitée sous contrat, tests
et CI jugent, les seuils étant ceux du porteur. Contrat écrit en Sonnet 5.5 ·
Moyen. Preuve de fin : vingt scénarios en tests, isolation entre
exploitations, parcours navigateur aux deux largeurs, recette réelle sur la
ferme.

**Code commencé le 6 novembre 2026, sur mandat (D-060).** PR 1, le domaine
(`lib/domain/crop-alerts/`) : le jeu commun et le rattachement d'une espèce
ou d'une série, la présence d'une culture au jour visé, le gel avec la marge
et le curseur de microclimat, l'arrêt d'arrosage avant récolte, le jour
solaire et les aspersions à reconsidérer, les réglages et leurs bornes, les
textes des notifications. Dix-neuf des vingt scénarios du contrat en tests
(le treizième, l'isolation entre exploitations, se joue avec la
persistance) ; huit précisions consignées dans le contrat (« Précisions
faites en codant le domaine »). PR 2, la persistance et l'envoi : migration
additive 0026 (cinq tables, l'énergie solaire prévue du jour), le jeu commun
des seuils relu ligne par ligne contre le contrat, les saisies de la ferme
en révisions immuables, l'évaluation du gel et des aspersions après chaque
écriture de prévisions, des aspersions après un plan recalculé, du séchage
chaque matin, une alerte enregistrée avant son envoi ; le scénario 13 en
test ; huit précisions dans le contrat (« Précisions faites en codant la
persistance et l'envoi »). PR 3, l'écran : l'encart « Alertes cultures »
sous les alertes météo, avec les réglages et le curseur de microclimat, les
seuils de gel des cultures présentes ou à venir et leur correction, les
cultures sans seuil, les délais de séchage, les prochaines échéances et
l'historique ; parcours P21 aux deux largeurs ; huit précisions dans le
contrat (« Précisions faites en codant l'écran »). Les trois PR sont
fusionnées et déployées le 6 novembre 2026 (#252 à #254). **Recette réelle
faite les 6 et 7 novembre 2026** sur son « vas-y »
(`docs/recette-5-quinquies.md`) : ses 24 légumes rattachés
au jeu commun sur sa réponse ; la vraie alerte de gel du dimanche
8 novembre produite, mais refusée par le service d'envoi, son étiquette
portant une virgule ; corrigé le soir même, chaque notification passée au
contrat du service d'envoi en test (« Précisions faites à la recette
réelle » du contrat), corrigé le soir même (#258). L'alerte arrive ensuite
sur son téléphone, mais seulement à son réveil (00 h 09 pour 00 h 02), et la
toucher ne l'ouvre pas : chaque notification part désormais en priorité
haute, et le toucher amène le module au premier plan avant d'ouvrir la page
(`docs/push-worker-contract.md`, « Priorité et toucher »). À l'essai final
du 7 novembre 2026, l'alerte arrive à la minute de l'envoi sur son téléphone
verrouillé et sonne, et la toucher ouvre le module. Le jugement agronomique
lui revient (D-014), dont la présence de la patate douce et de la tomate sur
les planches en novembre, lue dans OTF.

## Refonte ergonomique — charte du module (🟡 code commencé le 6 novembre 2026)

Charte validée par le porteur le 6 novembre 2026, d'après les maquettes de
`/mnt/project-files/charte-module/`, consignée dans `docs/charte-module.md`.
Chantier d'habillage, CSS seul, séparé de la 3.8, qui garde la
réorganisation de l'interface. Les trois polices (Bricolage Grotesque,
DM Sans, Open Sans) sont sous licence SIL OFL 1.1 : le module les héberge
avec leur `OFL.txt`.

**Code commencé le 6 novembre 2026, sur mandat (D-060)**, en trois temps qui
suivent l'ordre conseillé par la charte, chaque question tranchée par
l'option recommandée et consignée dans la charte (« Application ») :

- R1, les jetons, les polices hébergées, le fond, les blocs et les rayons :
  texte courant à 13 px aux deux largeurs, grandes sections blanches sur la
  feuille, gris et verts ramenés à ceux de la charte, rayon unique, deux
  ombres ; neuf précisions ; fusionné et déployé le 7 novembre 2026
  (#257).
- R2, les boutons, les onglets, les tableaux et les tuiles de totaux : quatre
  sortes de boutons, le bleu quittant les boutons ; l'onglet choisi souligné
  de vert ; les lignes alternées des tableaux ; les tuiles vert pâle, celles
  de la pluie en bleu eau ; cinq précisions ; fusionné et déployé le
  7 novembre 2026 (#263).
- R3, les couleurs d'état, le bleu eau et les icônes : les messages aux
  couleurs d'état de la charte, un seul bleu, celui de l'eau, le plan gardant
  ses couleurs ; deux symboles dessinés au trait ; la navigation de la charte
  (menu latéral, barre du bas) renvoyée à la 3.8, qui réorganise
  l'interface ; cinq précisions ; fusionné et déployé le 7 novembre 2026
  (#264). Un défaut trouvé le 7 novembre 2026 au contrôle de départ de la
  3.8 : nommé `app/irrigation/icon.tsx`, le composant des icônes suivait la
  convention des fichiers de métadonnées du cadre, qui en faisait l'image de
  l'onglet de la page ; chaque page la demandait et recevait une erreur 404,
  invisible au navigateur sans tête des parcours. Corrigé le jour même sur
  le choix du porteur (« avant la 3.8, chacun sa PR ») : renommé
  `line-icon.tsx`, un test interdit ces noms sous `app/`, et P0 demande
  lui-même les icônes et le manifeste que la page déclare.

**Relecture visuelle du porteur, le 7 novembre 2026** : l'ensemble lui plaît
et se lit bien, mais il ne voit pas de vrai changement, ni le rapprochement
attendu avec OTF. Les captures de la même page avant la refonte, après elle
et après la 3.8 (`/mnt/project-files/refonte-avant-apres/`) le confirment :
le module avait déjà un vert presque identique à celui d'OTF, et la refonte
ne déplaçait rien ; seuls le grand titre et la teinte du fond changent à
l'œil. **Deuxième passe, R4, décidée le jour même (D-068)** sur une maquette
validée par lui telle quelle (`/mnt/project-files/refonte-avant-apres/maquette/`,
détail dans `docs/charte-module.md`, « Deuxième passe ») : le plan sans
bandeau vert foncé, chaque parcelle en bloc blanc simple ; moins de cadres
dans les cadres ; les étiquettes écrites normalement au lieu de petites
majuscules grises ; le titre de la page à la taille de la charte (22,75 px,
20 px au téléphone) ; au téléphone, la barre anthracite d'OTF en haut ;
l'en-tête de l'ordinateur allégé, l'état des données d'OTF en une ligne, les
mesures de la planche en tuiles vert pâle. CSS et habillage seulement :
aucun calcul, aucun texte, aucune page ne change. Place : juste après la
3.8, avant la 3.8 bis, un seul chantier de code à la fois ; Opus 5.5 ·
Élevé. **Codée le 7 novembre 2026 au soir**, une fois la PR 7 de la 3.8
déployée : une barre du haut commune aux pages (`shell/topbar.tsx`), le
reste dans les feuilles de style ; la cloche du téléphone mène aux
réglages des notifications quand une case cochée en envoie ; le nom de la
ferme garde l'intitulé de la session, sans flèche, faute de choix de ferme
avant la tranche 4 ; les cadres dans les blocs deviennent des fonds
alternés, gris feuille puis blanc ; l'eau du jour passe en tuile vert pâle.
Les onze pages capturées aux deux largeurs sur les données de démonstration
et comparées à la maquette ; relecture du porteur à venir.

Preuve de fin : les tests et les parcours navigateur verts aux deux
largeurs ; la relecture visuelle du porteur ; pour R4, chaque page comparée
à la maquette aux deux largeurs, puis sa relecture.

## 6. Tranche 4 — Généralisation et intégration OTF (⬜)

À cadrer avec le développeur d'Ouvre ta ferme après la 3.9. Les états
« partiellement » proviennent de la roadmap Word et sont à confirmer.

| N° | Sous-tranche | État | Modèle · effort |
| --- | --- | --- | --- |
| 4.1 | Identité stable des exploitations (`otf_farm_id` alimenté automatiquement) | 🟡 à confirmer | Opus 5.5 · Élevé — champ déjà présent, alimentation à automatiser |
| 4.2 | Droits et isolation multi-structure | 🟡 à confirmer | Opus 5.5 · Max (Fable 5.1 · Très élevé avant D-055) — une fuite entre fermes est discrète et grave |
| 4.3 | Contrat d'intégration OTF, SSO, lien dans le menu Production | 🟡 à confirmer | Opus 5.5 · Max (Fable 5.1 · Très élevé avant D-055) — identité et contrat avec un tiers, erreur difficile à rattraper |
| 4.4 | Configuration et accueil d'une nouvelle ferme | ⬜ | Opus 5.5 · Élevé — parcours délimité, vérifiable par un essai réel |
| 4.5 | Exploitation : observabilité, sauvegardes D1, conservation, support | 🟡 à confirmer | Opus 5.5 · Très élevé — une sauvegarde qui ne restaure pas est un défaut silencieux |
| 4.6 | Pilote multi-fermes et mise en production | ⬜ | Opus 5.5 · Max (Fable 5.1 · Très élevé avant D-055) — vraies fermes, vraies données, isolation à prouver en conditions réelles |
| 4.7 | Identité OTF ou multi-structure (la partie hébergement est réalisée par Q0) | ⬜ | Opus 5.5 · Max (Fable 5.1 · Très élevé avant D-055) — identité, même exigence que 4.2 et 4.3 |

### 4.7 — Hébergement et identité

Ajoutée le 18 septembre 2026. Aujourd'hui l'application dépend d'OpenAI Sites
pour trois briques : la connexion par compte ChatGPT transmise par en-têtes,
la base D1 fournie et branchée par la plateforme, et la procédure de
publication. Pour proposer le module à d'autres structures, la connexion par
compte ChatGPT ne conviendra probablement plus. Cette sous-tranche conçoit,
avec 4.2 et 4.3, l'identité cible, OTF ou un contrôle d'accès transmettant
l'identité par en-têtes, l'hébergement cible, piste Cloudflare avec OpenNext,
la migration des espaces de travail existants et la chaîne de publication.
Elle n'est pas motivée par le risque Vinext, décision 6, mais par la
généralisation. L'authentification tenant dans un seul fichier et la
persistance étant isolée, le métier n'est pas concerné.

## 6 bis. Extension — Connexions matériel (🔶 demandée le 7 novembre 2026, recherche en cours)

Demandée par le porteur le 7 novembre 2026 (D-063) : le module doit pouvoir se
connecter à du matériel de la ferme. **Mise à jour du 7 novembre 2026 (D-066) : les trois
fonctions sont confiées à Tlaloc par l'accord de partage des rôles (section 6
quater) ; recherches et contrat conservés, rien n'est supprimé.** Trois
fonctions, chacune sa sous-tranche, **à cadrer** : aucun réglage, aucune méthode ni aucun matériel
n'est décidé.

| N° | Fonction | État | Modèle · effort |
| --- | --- | --- | --- |
| C1 | Connexion à une **station météo locale** (pluie, température, vent, humidité mesurés sur place) | 🔶 recherche documentaire en cours | recherche : Sonnet 5.5 · Moyen ; code : à fixer au contrat |
| C2 | Connexion à des **tensiomètres** (tension de l'eau dans le sol, mesurée) | 🔶 recherche documentaire en cours | recherche : Sonnet 5.5 · Moyen ; code : à fixer au contrat |
| C3 | **Pilotage d'électrovannes** (ouvrir et fermer des vannes depuis le module) | ⬜ recherche faite ; **contrat écrit le 7 novembre 2026** (`docs/valve-control-contract.md`, D-064), quatre questions tranchées sur la recommandation ; rien de codé, rien acheté | contrat : Sonnet 5.5 · Moyen ; code (découpage en six lots, section 12 du contrat) : Opus 5.5 · Élevé proposé, **à valider par le porteur** (l'action touche la ferme réelle) |

**Méthode.** Un fil de recherche documentaire par fonction, sans code : ce qui
existe sur le marché, comment le matériel se raccorde (protocoles, passerelles,
interfaces ouvertes), ce qu'il en coûte, ce qui est fiable sur une ferme
maraîchère, puis une méthode de travail proposée au porteur. Chaque recherche
rend un document dans le projet ; le contrat de la sous-tranche s'écrit
ensuite, sur validation du porteur. La recherche ne choisit rien à sa place.

**Points déjà posés, sans être des décisions de conception.**

- Les valeurs mesurées entreront comme **mesurées**, jamais confondues avec le
  prévu ni l'estimé (règle métier invariante) ; une donnée absente reste
  inconnue, jamais zéro (D-003).
- La pluie du pluviomètre saisie à la main prime sur toute autre source
  (règle invariante) : la place d'une station automatique à côté d'elle est à
  trancher au contrat de C1.
- La réserve du sol reste une information (D-041, D-047) : la place d'une
  mesure de tensiomètre à côté de la jauge estimée est à trancher au contrat
  de C2, sans en faire un terme du besoin sans décision nouvelle.
- Le pilotage (C3) est un changement de nature : le module aujourd'hui
  recommande et enregistre, il n'agit pas. Aucun pilotage n'était prévu
  jusqu'ici (programmateurs, noté pour plus tard le 6 novembre 2026). C3 ne
  s'exécute jamais sur la ferme réelle avant un contrat validé, une recette
  exprès sur son « vas-y » et des garde-fous écrits (arrêt, durée maximale,
  perte de liaison) ; la recherche ne l'exécute pas.
- Les clés, jetons et identifiants de matériel sont saisis par le porteur,
  jamais par l'assistant ni versionnés (AGENTS.md, « Sécurité »).

Preuve de fin d'une sous-tranche : à écrire dans son contrat. Pour la
recherche : le document rendu, relu par le porteur.

## 6 ter. Idées — Banc commun avec Tlaloc et idées sans engagement (🔶 décidé le 7 novembre 2026, recherche seule)

### Banc commun de saisons rejouées avec Tlaloc

Décision du porteur du 7 novembre 2026 (D-065) : le banc commun proposé par le
développeur de Tlaloc s'inscrit **après la 3.9, en recherche**. Un contrat est
écrit d'abord ; **aucun code sans l'accord du porteur**. Le détail de la
proposition est dans
`/mnt/project-files/tlaloc-comparaison/proposition-banc-commun-indicateurs.md`.

- **Principe.** Rejouer les mêmes saisons, jour par jour, avec les mêmes
  données d'entrée, dans les deux moteurs, et comparer des indicateurs définis
  de la même façon. Le but est de voir où les moteurs divergent et pourquoi,
  pas de désigner un gagnant.
- **Choix déjà arrêtés** (réponse du développeur de Tlaloc et options
  recommandées, 7 novembre 2026) : pluie utile écrite dans le fichier ; jeu de
  saisons fourni par Tlaloc (JSON pour la structure, CSV par saison pour la
  météo) ; deux passes, prévisions parfaites puis prévisions réelles
  archivées ; réserve facile commune en mm avec un seuil commun à 50 % ; débit
  sans limite en première passe ; stabilité mesurée par l'écart en mm entre
  deux plans successifs ; deux indicateurs ajoutés (charge pour le maraîcher,
  eau non placée).
- **Asymétrie à dire avec les résultats.** Notre moteur part d'un objectif
  hebdomadaire en mm, pas de la jauge du sol (la réserve reste une
  information, D-041, D-047). Il faudra décider d'où vient l'objectif de
  chaque semaine ; le plus naturel est d'adopter chaque lundi l'ETM proposée
  (D-045). « Jours sous le seuil » mesurerait alors en partie ce choix.
- **Ce qui n'est pas décidé.** Le contrat du rejeu, son réglage de code, son
  calendrier. Le développeur de Tlaloc doit d'abord remettre son banc aux
  règles actuelles de son logiciel ; aucune urgence des deux côtés.
- **Reste hors de l'ordre d'exécution** tant que le contrat n'est pas validé
  (ligne 24 ter).

### Idées rangées sans engagement

Quatre idées notées le 7 novembre 2026, **sans décision, sans contrat, sans
code, sans date**. Elles ne passent dans l'ordre d'exécution que sur un
« vas-y » du porteur.

| Idée | Ce que ce serait | Lien |
| --- | --- | --- |
| Archivage des prévisions J+1 | Garder chaque jour la prévision faite la veille, pour pouvoir plus tard comparer prévu et réalisé, et nourrir la seconde passe du banc commun | banc commun ; alertes météo (5 bis, 5 quinquies) |
| Formule du tensiomètre pour C2 | Définir comment une tension mesurée (kPa) se lit à côté de la jauge de réserve estimée, sans en faire un terme du besoin | C2, section 6 bis ; D-041, D-047 |
| Heures de silence des notifications | Une plage de la nuit où le téléphone ne reçoit pas les alertes non urgentes | notifications (#260) ; 5 quinquies |
| ET0 horaire | Une évapotranspiration calculée à l'heure et non plus au jour | D-010 (l'ET0 reste une information) ; 5 quater |

Preuve de fin : pour le banc commun, un contrat relu par le porteur ; pour les
idées, aucune tant qu'elles n'entrent pas dans l'ordre d'exécution.

**Mise à jour du 7 novembre 2026 (D-066).** Le banc commun est absorbé par le
chantier de fusion des deux moteurs (section 6 quater) : il reste une manière
de comparer les moteurs, sans étape séparée.

## 6 quater. Chantier — Partage des rôles avec Tlaloc et fusion des deux moteurs (🔶 accord du 7 novembre 2026, rien de cadré)

Accord du porteur avec le développeur de Tlaloc, le 7 novembre 2026 (D-066) :
se répartir les rôles et mettre les ressources en commun, au lieu de développer
chacun la même chose de son côté.

1. **Le porteur termine la Tranche 3** (mode solo, jusqu'à la 3.9), pour que
   les deux logiciels soient à peu près au même stade.
2. **Tlaloc prend l'automatisation** : capteurs, électrovannes et ce qui s'y
   rattache. Les trois fonctions C1 (station météo), C2 (tensiomètres) et C3
   (électrovannes) de la section 6 bis sont **confiées à Tlaloc** ; elles ne
   sont pas supprimées : leurs recherches et le contrat C3
   (`docs/valve-control-contract.md`, D-064) restent au dépôt comme référence.
   Rien de ce qui est codé ou acheté n'est touché (rien ne l'est).
3. **Fusion des deux moteurs, avant la Tranche 4.** Le porteur compare
   finement les deux moteurs et la manière dont fonctionnent les deux
   logiciels, pour une synthèse qui garde le meilleur des deux dans un logiciel
   commun. Le développeur de Tlaloc lui confierait son code source, à faire
   « mouliner » avec le nôtre pour voir comment regrouper. Ce chantier absorbe
   le banc commun (section 6 ter).
4. **Ergonomie.** Tlaloc garde la sienne, qu'on ne touche pas. Chez nous, à la
   connexion, l'utilisateur **coche les fonctionnalités dont il a besoin** et
   l'interface masque le reste, comme un filtre, pour ne pas surcharger ceux
   qui n'ont pas besoin de tout. C'est une **intention**, rattachée à la 3.8 ;
   **précisée par le porteur le jour même (D-067)** : plus de mode simple ou
   complet, un seul mode où chaque fonctionnalité se coche, affichée et prise
   en compte ; contrat écrit le 7 novembre 2026
   (`docs/feature-selection-contract.md`).

**Précisions du porteur, 7 novembre 2026.** La refonte ergonomique déjà livrée
(charte du module) est **conservée** ; le choix des fonctionnalités à la
connexion **s'ajoute dans la 3.8**. Le contrat C3 des électrovannes est
**gardé en archive, non codé, et transmis au développeur de Tlaloc comme
base** ; un dossier regroupant les recherches et contrats C1 à C3 est remis au
porteur pour cela (`/mnt/project-files/connexions-materiel/dossier-connexions-materiel-pour-tlaloc.md`).

**Ce qui n'est pas décidé.** Le périmètre exact et la méthode de la fusion,
l'accès au code de Tlaloc et les conditions de cet accès, qui possède et
héberge le logiciel commun, le calendrier, ce que devient le contrat C3 si la
fusion le reprend, et la forme précise du filtre de fonctionnalités. Chaque
point se tranche par le porteur, au contrat.

Preuve de fin : à écrire dans le contrat de la fusion, relu par le porteur.
## 7. Décisions prises par le porteur de projet le 18 septembre 2026

1. **ET0 dans le besoin.** Tranchée le 18 septembre 2026 : retour à l'objectif
   seul, l'ET0 reste une information d'aide à la décision. Mise en œuvre en
   3.3.1, en premier dans l'ordre d'exécution.
2. **Tailwind.** ✅ Faite le 19 septembre 2026 : retrait en Q4, remise à zéro
   recopiée dans le projet, comparaison avant et après sans différence (D-012).
3. **Source de vérité Git.** Tranchée le 18 septembre 2026 : GitHub seul. La
   procédure de publication du site reste à documenter en Q1.
4. **Protection de `main`.** ✅ Faite le 18 septembre 2026 : GitHub Pro et
   règle de protection classique appliquée et vérifiée par l'API, détail en Q1.
5. **Avis agronomique.** Tranchée le 18 septembre 2026 : le porteur de projet
   valide lui-même le contrat de planning 3.5.0, avant le moteur. Le contrat
   est donc écrit pour une lecture non technique, avec exemples chiffrés, et
   toute règle discutable reste réglable sans redéveloppement.
6. **Vinext en bêta.** Tranchée le 18 septembre 2026 : risque accepté avec
   garde-fous, version épinglée, mise à jour en lot dédié dans Q4, frontières
   Q3 pour cantonner la dépendance à l'interface, réévaluation à la 3.9.
7. **Hébergement.** Tranchée le 18 septembre 2026, en fin de journée, après
   le constat de la publication manuelle Sites : migration vers un Worker
   Cloudflare dans le compte du porteur, Cloudflare Access pour la connexion,
   adresse en `.workers.dev`, publication automatique par GitHub Actions
   (D-016, sous-tranche Q0, placée avant la recette 3.4). ✅ Close le
   3 octobre 2026 avec la suppression du site Sites.

## 8. Questions agronomiques ouvertes (cahier des charges, section 27)

| Question | Où elle se décide | État dans le code |
| --- | --- | --- |
| Objectif fixe en mm/semaine | déjà implémenté, historisé, proratisé | ✅ 2.8, modifiable par révision |
| Formule d'écart objectif − (irrigation + pluie) | 2.9 pour l'historique | ✅ implémentée, donnée absente jamais nulle |
| Rôle de l'ET0 dans le besoin restant | tranché le 18 septembre 2026 : information seulement | ✅ plafond de la 3.3 retiré par la 3.3.1 |
| Paramètres culturaux (type, stade, Kc, sensibilité) | 5 quater pour le type, le stade et le Kc, contrat écrit le 30 octobre 2026 (D-045) ; la sensibilité, part utilisable p de la FAO-56, entre par la 5 ter pour le seuil de la jauge (D-047) | 🟡 domaine codé le 5 novembre 2026 (PR 1, D-057), persistance le 6 (PR 2, migration 0023), écran commencé le 6 (PR 3a : la page « Coefficients culturaux » et la correspondance des espèces) ; objectif proposé, adopté à la main ; la profondeur racinaire et p entrent par la 5 ter, pour la seule jauge du sol |
| Réserve utile du sol (RFU) | 5 ter, contrat écrit le 27 octobre 2026 (D-041), en mm par mètre de sol (D-046), révisé le 30 octobre 2026 : consommation par l'ETM, RFU corrigée des cailloux, seuil par culture (D-047) ; relu et validé le 31 octobre 2026 : part de référence 2/3, profondeurs et p de toutes les cultures, jauge continue sur une planche sans culture (D-053) ; seuil d'arrosage réglable (D-059) | 🟡 domaine et persistance codés le 6 novembre 2026 (PR 1 et 2, D-060, migration 0025) ; information seulement, hors besoin, planning et priorités |
| Priorités en ressource insuffisante | 3.5.0 | 🟡 priorités manuelles 3.3, arbitrage 3.4 |
| Partiel pour tous, total pour les prioritaires, ou report | 3.5.0 | ⬜ |
| Suivi hydrique par série | extension, section 5, contrat validé le 28 septembre 2026 (D-022) | 🟡 attend 5.0 |
| Serre, plein champ, partie de planche, successions | serre : ✅ pluie nulle en 3.3 ; partie de planche et successions : contrat séries | partiel |
| Évaporation des réserves par ET0 et coefficient | 3.1 | ✅ coefficient paramétrable |
| Indicateurs manquants avant de figer le moteur | 3.5.0 | ⬜ |

## 9. Correspondance avec la roadmap Word du 18 septembre 2026

| Roadmap Word | Devient |
| --- | --- |
| 2.9 extension par série culturale | Section 5, débloquée le 26 septembre 2026, contrat validé le 28 ; précédée de 5.0 |
| 2.10 recette complète de la tranche 2 | ✅ réalisée (`docs/recette-tranche-2.md`) ; l'automatisation des parcours devient Q5 |
| 3.1 bis mesure du débit | 3.1 bis, inchangé, placé après le socle complet, Q5 et Q6 comprises |
| 3.4 faisabilité « terminée » | 🟡 : recette utilisateur restante |
| 3.4.1 Tailwind et PostCSS | ✅ fusionné le 18 septembre |
| 3.4.1 types Node 26 différés | ✅ fusionné, décision D-009 |
| 3.4.1 next et eslint-config-next | ✅ fusionné le 18 septembre |
| 3.4.1 migration React | ✅ le 20 septembre 2026 en Q4, React `19.3.0` |
| 3.4.1 Web Push majeure | ✅ le 20 septembre 2026 en Q4, `@block65/webcrypto-web-push` 2.0.0 |
| 3.4.1 recette globale | Q4 |
| 3.3.2 audit du dépôt et AGENTS.md | audit ✅ ; complément d'`AGENTS.md` en Q1 |
| 3.3.3 mise à jour PROJECT_STATUS.md | existe déjà : `docs/ETAT_DU_PROJET.md`, tenu à jour |
| 3.4.4 nouvelle roadmap | ce document |
| 3.5 à 3.9 | mêmes numéros ; 3.5.0 inséré avant le moteur |
| 4.1 à 4.6 | mêmes numéros, états à confirmer |

## 10. Règle de clôture d'une sous-tranche

Une sous-tranche est terminée lorsque, dans l'ordre :

1. les règles métier sont écrites dans un contrat de `docs/` avant le code ;
2. les tests qui encodent ces règles existent et passent, y compris les tests
   de persistance concernés ;
3. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm push:check`
   et `pnpm weather:check` réussissent, ainsi que les parcours navigateur dès
   que Q5 existe ;
4. la recette utilisateur prévue est réalisée sur ordinateur et à 390 px
   lorsque l'interface change, sur données réelles lorsque la règle le permet ;
5. `docs/ETAT_DU_PROJET.md`, `CHANGELOG.md` et, s'il y a lieu,
   `docs/DECISIONS.md` sont à jour ;
6. le compte rendu contient les sorties réelles des contrôles, ce qui n'a pas
   été fait, la dette introduite et les questions ouvertes.

Une sous-tranche qui ne remplit pas l'un de ces points reste 🟡, quel que soit
l'avancement du code.

La version de référence de cette règle est la section « Définition de
“terminé” » d'`AGENTS.md` ; en cas d'écart, c'est elle qui fait foi.
