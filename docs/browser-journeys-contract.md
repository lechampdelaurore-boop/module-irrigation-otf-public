# Contrat des parcours navigateur automatisés

Rédigé le 20 septembre 2026, avant le code de la sous-tranche Q5. Il répond à
un écart de l'audit : aucun test ne traverse l'interface, la seule vérification
étant une recette manuelle. Q6 va découper les fichiers les plus longs et le
moteur de planning ajoutera plusieurs milliers de lignes ; ces parcours existent
pour que ces deux chantiers ne cassent rien en silence.

## Ce que ces tests prouvent, et ce qu'ils ne prouvent pas

Ils prouvent qu'un utilisateur peut traverser les quatre parcours essentiels
dans un vrai navigateur, sur ordinateur et sur téléphone, sans débordement
horizontal ni erreur de console.

Ils ne voient pas non plus ce qui dépend de l'endroit où tourne le serveur : en
local, le serveur et le navigateur partagent le fuseau de la ferme, alors que le
Worker déployé tourne en UTC. Un défaut de fuseau passe donc vert au parcours et
échoue sur le site. C'est ce qu'a montré la recette 3.1 bis du 25 septembre
2026 : le parcours P5 enregistrait depuis des mois un relevé qu'aucun forage
n'aurait pu enregistrer en ligne. Ce que le fuseau décide se prouve par un test
à fuseau imposé (`tests/irrigation-format.test.ts`), pas par un parcours.

Ils ne remplacent ni la recette utilisateur sur le site réel, ni l'essai de
notification sur téléphone verrouillé, ni la lecture des vraies données Ouvre ta
ferme. Ces vérifications restent manuelles et ne doivent jamais être annoncées
comme automatisées (`docs/push-worker-contract.md`, `docs/recette-3.4.md`).

## Reproductibilité

Un parcours qui dépend du réseau ou de l'heure ne prouve rien : il échoue au
hasard, et une équipe finit par ignorer ses échecs. Trois sources de hasard sont
donc fermées.

1. **Ouvre ta ferme** : `OTF_DATA_SOURCE=mock` sert l'instantané de démonstration
   de `lib/adapters/mock-data.ts`, quinze planches sur quatre saisons. Aucun
   appel réseau, aucune consommation du quota du porteur.
2. **Connexion** : `LOCAL_DEMO_USER=true` fournit l'utilisateur de démonstration
   sans passer par Cloudflare Access. Ce contournement est refusé en production
   (`app/access-auth.ts` exige `NODE_ENV !== 'production'`).
3. **Météo** : `WEATHER_DATA_SOURCE=mock` sert un fournisseur de démonstration
   déterministe, réglage introduit par cette sous-tranche sur le modèle de
   `OTF_DATA_SOURCE`. Sans lui, la page appelle Open-Meteo à chaque chargement :
   le réseau rend les parcours lents et instables, et la pluie change d'un jour
   à l'autre, donc les besoins affichés aussi. La valeur par défaut reste
   `live` ; la production ne pose jamais ce réglage.

La base locale est recréée avant chaque exécution, migrations comprises, pour
que chaque parcours parte d'un état connu. Le contournement et les données de
démonstration ne franchissent jamais la frontière de la production : ils vivent
derrière des réglages que seuls le poste du développeur et l'intégration
continue posent.

## Base locale

La manière d'appliquer les migrations à la base locale n'était pas documentée.
Elle l'est ici, et elle est scriptée.

- La base vit dans `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/`, ignorée
  par Git. C'est une base SQLite par espace de travail Miniflare.
- `pnpm db:migrate:local` applique les migrations du dossier `drizzle/` qui lui
  manquent, exactement comme `pnpm db:migrate:remote` le fait en production.
- `pnpm e2e:reset` supprime la base puis rejoue toutes les migrations. C'est
  l'état de départ de chaque exécution des parcours.
- Le même script prépare et vérifie les réglages de démonstration. Le runtime
  Cloudflare ne lit pas l'environnement du processus qui le lance, mais le
  fichier `.dev.vars` : il est recopié depuis `.dev.vars.example` quand il
  manque, sur une machine neuve comme en intégration continue. Si les trois
  réglages n'y sont pas exactement, le script refuse de démarrer plutôt que de
  laisser un parcours interroger Ouvre ta ferme, la météo réelle ou la
  connexion Access.

Une base fraîche ne contient ni matériel, ni objectif, ni irrigation : chaque
parcours crée ce dont il a besoin, et ne présuppose rien de ce qu'un autre
parcours aurait laissé.

## Les parcours

Issus du cas navigateur critique de la recette de tranche 2
(`docs/recette-tranche-2.md`). Chacun s'exécute deux fois, à 1 280 px et à
390 px.

| N° | Parcours | Ce qu'il vérifie |
| --- | --- | --- |
| P1 | Irriguer maintenant avec minuteur | création d'un matériel avec son réglage et sa position, l'apport par heure et la surface mouillée du besoin sur la planche seule en goutte-à-goutte (22,5 m² sur N01), calcul de la durée, démarrage du minuteur, persistance après rechargement, arrêt anticipé et irrigation enregistrée comme réalisée |
| P2 | Planifier puis annuler | bouton « Planifier l'irrigation » grisé tant que la date de début est vide (point ouvert 46), planification à une date future, apparition dans les irrigations à venir, annulation, disparition sans trace dans les cumuls réels |
| P3 | Saisir une irrigation déjà réalisée | saisie d'horaires passés, refus d'une fin antérieure au début, un début vidé qui ne ferme pas la page (point ouvert 44), volume estimé « Inconnu » tant que les dates ne donnent pas de durée (point ouvert 45), enregistrement et report dans les cumuls |
| P4 | Consulter les cumuls et exporter le CSV | changement de période, filtre hiérarchique, ouverture d'un détail, export CSV en UTF-8 avec les bonnes colonnes |

Vingt-deux parcours se sont ajoutés depuis, à mesure que les écrans arrivaient :

| N° | Parcours | Ce qu'il vérifie |
| --- | --- | --- |
| P5 | Relever le compteur du forage | deux relevés, le débit en fonctionnement, le bouton qui porte la mesure jusqu'à la fiche de la ressource, les volumes produits, un relevé refusé qui le dit sans effacer la saisie, et un relevé corrigé qui ne réécrit pas la décision de débit |
| P6 | Changer le réglage appliqué | la liste « Réglage appliqué » d'un matériel posé, l'apport qui suit sans que le plan s'ouvre, la persistance après rechargement |
| P7 | Arbitrer une pénurie | la pénurie provoquée puis rendue, les cases « Servir », la décision enregistrée, les cibles tactiles de l'écran d'arbitrage, et la décision déclarée « plus applicable » par l'écran une fois la pénurie rendue |
| P8 | Poser, déplacer et retirer une aspersion | l'ancrage entre deux planches, la portée qui décide seule des planches atteintes, l'apport par heure et la surface mouillée du besoin sur la planche et son passe-pied (36 m² sur N01), le déplacement qui libère les anciennes, le compteur des posés, et le retrait qui stocke le matériel, confirmé avec sa date, la carte disant « Stocké depuis le … » et proposant « Reposer » |
| P9 | Suivre l'eau par série | la vue « Par série » des cumuls sur le plan de culture de démonstration : les séries en cours ou terminées avec implantation, dernière récolte et planches, le groupe « À venir », l'absence de la série sans implantation et de la série en bloc, le détail par planche, et la colonne « Séries » de l'export CSV |
| P10 | Planifier la semaine | un objectif posé sur la semaine courante et sur la précédente pour valoir dès lundi, la plage horaire du goutte-à-goutte réglée à l'écran, le plan calculé avec ses dates à la française, la première proposition sous abri à la dose entière lue avec sa justification — dose maximale, faisabilité non vérifiée faute de pompe, planches avec leur besoin —, ou la proposition raccourcie à la plage avec son motif quand le calendrier n'en offre pas d'autre, ajustée à 6 mm puis validée jusque dans les irrigations à venir, un jour validé d'un bouton et une proposition refusée quand le calendrier en laisse — relue datée de son calcul après un recalcul —, la liste « Non placé », repliée par défaut sous son titre « Non placé (n planches) » et sa flèche de 44 px, dépliée pour lire son motif (retour du porteur, 8 novembre 2026), la cible tactile du bouton « Valider », sur ordinateur la semaine lue en tableau à 1 440 px — une ligne par matériel, le créneau compact sans ses gestes, ouvert avec sa justification et « Valider » (précision P46, 7 novembre 2026) —, puis la remise en état : irrigations annulées, plage rendue, objectif retiré des deux semaines |
| P11 | Retirer, stocker et reposer un goutte-à-goutte | la carte « Posé sur … depuis le … », un retrait daté dans le futur refusé avec son motif, le retrait daté d'une heure plus tôt, « Stocké depuis le … » et le compteur des stockés, l'irrigation planifiée sur le matériel stocké signalée et non démarrable, le matériel absent du formulaire, sans liste « Matériel stocké » ni « Reposer » (précision P37, 7 novembre 2026), la repose datée depuis sa carte de Matériel et placement, au même endroit, qui reprend sa planche et rend l'irrigation démarrable, l'historique des poses, la saisie après coup qui ne propose le matériel qu'à une heure de début où il était posé, puis l'irrigation planifiée annulée |
| P12 | Suivre et replanifier | le dispositif de P10 sous abri, sa ligne débitant plus fort que celle que P10 laisse sur la même planche (R12), le plan calculé, une pluie saisie au pluviomètre et le plan recalculé seul — le déclencheur nommé dans l'en-tête, le pli « Ce qui a changé » présent —, une proposition refusée et le besoin replacé hors du créneau refusé, ou « Non placé » pour créneau refusé quand la semaine n'offre plus rien, une proposition validée jusque dans « À venir », une limite journalière posée après coup d'aujourd'hui sans fin, à 0,01 m³, la suggestion « Annuler » sur l'arrosage validé avec la limite et le volume engagé pour raison et ses deux boutons, listée dans le pli, la cible tactile des boutons « Valider » et « Appliquer », la suggestion appliquée jusqu'à la disparition de l'irrigation dans « À venir » et le recalcul après l'annulation — le message dans le bandeau de la section, la carte validée lue « Annulée » et sortie du compte des validées (31 octobre 2026) —, la limite levée, puis la remise en état : plage rendue, objectif retiré des deux semaines, pluie du jour remise à 0 mm ; enfin le champ « Millimètres » qui montre la mesure déjà saisie du jour choisi, vide la veille, « 0 » aujourd'hui et à l'ouverture de la page (7 novembre 2026) |
| P13 | Régler une alerte météo | l'encart « Alertes météo » de la semaine et le rappel des appareils qui reçoivent les alertes, la cible tactile de « Ajouter une alerte » à 390 px, un seuil non numérique refusé avec le message du domaine sans rien enregistrer, un critère « température minimale en dessous de 12 °C sur 3 jours » que la prévision de démonstration franchit toujours, « Actualiser la météo » après la pause de 30 s et une alerte par jour visé de la semaine affichée dans l'historique — l'envoi lu « Échec du service de notification », les parcours n'ayant pas de service de notification —, une seconde actualisation sans nouvelle alerte, le lien « Voir la semaine » qui ouvre la page Alertes météo sur la semaine du jour visé (3.8, P32), et l'ancienne adresse `?week=…#weather` d'une notification déjà reçue qui mène à la page des besoins, même semaine, sur la colonne « Températures prévues » (P21), le critère désactivé puis supprimé, ses alertes restant dans l'historique (31 octobre 2026, 5 bis) |
| P14 | Rattacher une espèce à une culture de référence | la page « Coefficients culturaux » et la liste « sans référence Kc » où figurent les espèces de démonstration sur planches, pas les endives en bloc ; une espèce rattachée — la tomate à la tomate du CRIIAM sur ordinateur, la mâche à la salade d'été par analogie sur téléphone — qui sort de la liste, la cible tactile de « Enregistrer » ; une exception « sans référence » sur sa série qui l'y remet ; la table de la culture de référence lue ; l'exception puis le rattachement retirés, la base revenant à son état de départ (6 novembre 2026, 5 quater, PR 3a) ; depuis la 3.8 (P41), le dessin de chaque espèce appelé par la route `/irrigation/especes.svg`, qui répond par une feuille de démonstration, sans appel à Ouvre ta ferme |
| P15 | Lire le besoin de la culture d'une planche et déclarer un stade | la carotte rattachée à la carotte du CRIIAM ; la fiche de V01, sous le verger, où des carottes sont en place le jour même : stade du jour, Kc, ETM, référence et source, objectif applicable et objectif proposé ; le lundi, « Adopter la proposition » offert avec une cible assez grande, les autres jours la proposition dite partielle, ET0 manquante nommée, sans bouton ; le stade suivant déclaré pour la planche, lu « déclaré » avec son Kc ; les semaines parcourues ; « Objectif proposé » sous l'objectif de V01 dans « Besoins d'irrigation » ; le rattachement retiré. Sans adoption : elle ne s'efface pas et les parcours partagent une base (6 novembre 2026, 5 quater, PR 3b) |
| P16 | Surcharger un Kc et régler le calcul | sur la page « Coefficients culturaux », un Kc du melon (ordinateur) ou de la courgette (téléphone) surchargé à 0,35, lu « valeur de la ferme » à côté de la valeur de la source, puis revenu à la valeur de la source ; le K_abri du tunnel réglé à 0,70 puis à 0,80 ; une planche du tunnel paillée puis dépaillée ; l'ombrage activé, un filet de 25 % posé puis retiré le jour même, l'ombrage désactivé. Chaque réglage revient à une valeur sans effet sur le calcul, les parcours partageant une base ; cibles d'au moins 44 px (6 novembre 2026, 5 quater, PR 3c) |
| P17 | Régler les durées d'une culture et lire la fiche de la série | sur la page « Coefficients culturaux », le délai de levée en plantation de l'aubergine (ordinateur) ou du poivron (téléphone) augmenté de 5 jours, lu « durées de la ferme » avec la valeur du jeu commun rappelée sous le champ, puis revenu aux durées communes ; la carotte rattachée à la carotte du CRIIAM ; dans la vue « Par série », la fiche de « Carottes du verger » lue sur V01 (stade, Kc, ETM, proposition de la planche), le stade « 30 j → Récolte » déclaré pour toute la série ; le rattachement retiré. Les durées reviennent au jeu commun et le rattachement est retiré, les parcours partageant une base ; cibles d'au moins 44 px (6 novembre 2026, 5 quater, PR 3e) |
| P18 | Saisir le sol d'une parcelle et régler le seuil d'arrosage | sur la page « Réserve du sol » (dans la section « Planning de la semaine » avant la 3.8), le pli « Réglages du sol » ; le sol des Prés (ordinateur) ou du Coteau (téléphone) saisi à 62 mm/m et 18 % de cailloux, la RFU du sol lue à 51 mm/m pendant la saisie puis enregistrée avec la profondeur prélevée ; l'avertissement d'une RFU de laboratoire de 250 mm/m montré puis retiré sans rien enregistrer ; la valeur propre du tunnel (ordinateur) ou du Jardin Sud (téléphone), partie de celle de la parcelle, enregistrée à 80 mm/m sans cailloux avec la mention « comptée pour 0 » ; le seuil de l'exploitation réglé à 50 % du plein, lu dans le résumé du pli, puis rendu à la culture ; les cibles tactiles des trois boutons d'enregistrement |
| P19 | Régler la jauge de la réserve du sol au curseur et déclarer l'état de surface d'une planche | le sol des Prés saisi ; en tête du bloc « Réserve du sol », la pastille de l'eau arrosée en trop sur sept jours ouverte et lue (depuis la pastille, le 6 novembre 2026) ; le curseur de la parcelle réglé au cran « frais », 50 % (ordinateur), qui règle ses jardins de plein champ, ou celui du tunnel au cran « humide », 75 % (téléphone ; quatre crans depuis le 7 novembre 2026, précision P40), qui règle l'abri seul, la dernière observation relue ; N03 (ordinateur) ou T02 (téléphone), sans culture, lue au % observé avec « Départ par une observation » ; une observation reportée à trois jours refusée avec la règle ; une bâche imperméable déclarée sur la planche, lue dans son résumé avec « État de surface déclaré depuis le », puis la planche rendue au sol nu. Une observation est datée et ne s'efface pas, seule la jauge la lit ; cibles d'au moins 44 px (6 novembre 2026, 5 ter, PR 3b) |
| P20 | Régler le profil racinaire d'une culture | sur la page « Coefficients culturaux », la carte fermée qui dit « Voir le détail » et porte son résumé (« Kc … · racines … · … de la saison »), à droite du nom à l'ordinateur et sous le nom au téléphone (retours du porteur, 8 novembre 2026) ; le profil du jeu commun de la carotte (ordinateur) ou de la tomate (téléphone) lu ; une profondeur de 0,25 m au premier stade enregistrée pour la ferme avec sa source, lue à côté de celle du jeu commun, le résumé de la carte disant « profil racinaire de la ferme » ; le jeu commun repris et enregistré. Un profil est une révision datée qui ne s'efface pas : le parcours finit sur un profil de la ferme aux valeurs communes, sans effet sur la jauge ; cibles d'au moins 44 px (6 novembre 2026, 5 ter, PR 3c) |
| P21 | Rattacher une culture au gel, régler le microclimat et le séchage | l'encart « Alertes cultures », sur sa page depuis la 3.8 (sous les alertes météo avant) ; les carottes de démonstration, à rattacher ou déjà rattachées, liées à la carotte du jeu commun avec un seuil de dégâts de la ferme ; un seuil non numérique refusé avec le message du domaine ; 8 °C enregistré, lu avec la marge de 3 °C et la valeur du jeu commun rappelée ; le curseur de microclimat poussé à +2 °C, l'alerte lue à 13 °C ; la météo actualisée, l'alerte de gel des carottes enregistrée dans l'historique avec ses valeurs et « Échec du service de notification », puis dite « déjà annoncée » dans les échéances ; l'historique replié, ouvert par sa flèche (précision P45) ; un délai de séchage de 10 jours donné aux carottes, leur date d'arrêt d'arrosage à venir lue ; le curseur remis à 0 ; la marge des cultures sensibles réglée à 4 °C, l'alerte lue à 12 °C, puis remise à 3 °C (précision P44, 7 novembre 2026) ; la cible tactile du pli des seuils et du bouton « Enregistrer le seuil » à 390 px |
| P22 | Choisir ses fonctionnalités à la première ouverture | sur une ferme neuve, propre au parcours et à la largeur : une page demandée avant le choix qui mène à la liste, dix cases, rien coché d'avance, « Continuer » grisé ; le planning coché, qui coche le matériel, les arrosages et les besoins, grisés avec « Nécessaire pour Planning de la semaine » ; le planning décoché sans décocher ce qu'il avait entraîné ; le choix final (planning et alertes météo), la première page atteinte sans bandeau (« Aujourd'hui » depuis la PR 3 du lot 2 de l'audit ergonomique), le menu réduit aux cases cochées ; la page de l'historique, puis une ancienne adresse qui la désignait, menant à la première page avec « Cette fonctionnalité n'est pas cochée pour votre ferme. », la ligne quittant l'adresse ; l'écran de la première ouverture qui ne revient plus, le choix relu dans Réglages ; sur la ferme de démonstration, d'avant la 3.8 : tout coché, le bandeau et son lien vers Réglages ; cibles d'au moins 44 px (7 novembre 2026, 3.8, PR 3) |
| P23 | Décocher puis recocher une fonctionnalité qui a des données | sur une ferme neuve : la réserve du sol cochée, qui entraîne le besoin par culture ; la carotte rattachée dans Réglages ; le besoin par culture grisé, « Nécessaire pour Réserve du sol. » ; la réserve du sol décochée sans fenêtre, le besoin par culture resté coché ; le besoin par culture décoché : l'avertissement « 1 réglage de culture reste enregistré… », « Annuler », puis « Décocher » : son entrée du menu, la correspondance des espèces et sa page disparues, l'adresse de sa page menant à la première page avec la ligne qui le dit ; recoché sans fenêtre : sa page revenue et la carotte toujours rattachée ; cibles d'au moins 44 px (7 novembre 2026, 3.8, PR 3) |
| P24 | Lire l'aide d'une page et d'où vient un chiffre | sur chacune des onze pages de la ferme de démonstration (douze avec « Aujourd'hui » depuis la PR 3 du lot 2 de l'audit ergonomique), le « ? » à côté du titre, cible d'au moins 44 px, ouvre « À quoi sert cette page », « Comment la lire » et « Par où commencer », et Échap le referme en rendant la main au « ? » ; puis un goutte-à-goutte propre au parcours et à la largeur, posé sur N01 à 10 mm/h : sur Matériel et placement, la bulle « D’où vient ce chiffre ? » de l'apport horaire de la planche nomme le matériel, son réglage et 10 mm/h ; sur Arrosages, « Irriguer maintenant » avec ce matériel donne 2 h 30 min, et sa bulle dit « le temps pour que N01 reçoive 25 mm à 10 mm/h » ; chaque bulle se referme par « Fermer » (7 novembre 2026, 3.8, PR 6, P33 à P35 du contrat de la 3.8 ; ligne ajoutée le 8 novembre 2026) |
| P25 | Calculer un réglage depuis le matériel | sur une ferme neuve : la case « Calculateur d’irrigation » cochée, qui coche Matériel et placement ; un goutte-à-goutte ajouté, « Calculer depuis le matériel » dans un nouveau réglage, l’exemple AmnonDrip, « Il manque : nombre de lignes, largeur de la planche. » et « Utiliser ce résultat » grisé, puis deux lignes sur 0,75 m : 14,22 mm/h « calculé », l’eau pompée, « Voir le calcul » et sa formule ; le formulaire rempli, rien d’enregistré avant « Ajouter le réglage » ; la valeur retouchée à 8 : « saisi », la case du pluviomètre : « mesuré » ; une aspersion en profil en cône, l’exemple 427 à 6,4 m : 6,1 mm/h sous la rampe, « estimé », le dessin du cône et sa réserve, enregistré avec sa portée de 11 m ; cibles d’au moins 44 px ; la ferme de démonstration non touchée (7 novembre 2026, 3.8 bis, D-070). |
| P26 | Régler les créneaux protégés | le dispositif de P10 et P12 sous abri, sa ligne débitant plus fort que celle que P12 laisse sur la même planche (R12), la plage du goutte-à-goutte ouverte toute la journée, aucun créneau au départ ; le plan calculé ; « Lavage », tous les jours de 00:00 à 23:59, créé dans le pli « Réglages du planning », sa ligne « Lavage · tous les jours · de 00:00 à 23:59 », l'avis « il vaut au prochain calcul » et le plan affiché inchangé (règle 8) ; recalculé : plus aucune proposition pour la planche, « Non placé », motif « créneau protégé : Lavage » ; le créneau supprimé avec sa confirmation ; un arrosage planifié à la main deux heures plus tard, sans avertissement ; le créneau posé de nouveau puis renommé « Lavage des légumes » par « Modifier » ; « Planifier » dans le créneau : l'avertissement, le bouton resté actif, rien d'enregistré (cas 14) ; recalculé : la suggestion « Annuler » sur l'arrosage planifié, sa raison « cet arrosage tombe dans le créneau protégé « Lavage des légumes » », « Garder » présent, « Appliquer » jusqu'à l'annulation et au recalcul qui suit ; le journal des créneaux, « Modifié : Lavage des légumes… » en tête ; cibles d'au moins 44 px ; puis la remise en état : créneau supprimé, irrigations annulées, plage rendue, objectif retiré. Un dimanche de 23 h 42 à 23 h 59, la semaine n'offre plus de proposition et le motif ne se lit pas ; un dimanche après 22 h, l'arrosage tombe la semaine suivante et la suggestion ne se lit pas : le parcours le dit (8 novembre 2026, 3.8 ter, D-071, S32) |
| P27 | Se repérer dans le module | sur la ferme de démonstration, toutes les cases cochées, rien d'enregistré : chacune des onze pages donne son nom à l'onglet (« … · Irrigation ») et propose la saison sauf Alertes météo (douze pages depuis la PR 3 du lot 2, « Aujourd'hui » ne proposant pas la saison non plus) ; `/irrigation/objectifs`, l'adresse de l'audit, répond 404 avec « Page introuvable » en français, le menu des onze pages et « Revenir à « Arrosages » », qui y ramène (le menu des douze pages et « Revenir à « Aujourd’hui » » depuis la PR 3 du lot 2) ; sur « Objectifs et besoins », la météo de référence sans champ « Commune » ; le périmètre d'un objectif rangé en « Ferme et parcelles » puis un groupe par jardin (« Jardin Sud · Le Coteau »…), la recherche « n0 » réduite à « Toute la ferme » et N01 à N03, « 3 périmètres trouvés. », N02 choisie restant dans la liste quand la recherche « tunnel » ne la trouve plus ; « Changer la commune dans Réglages » mène au champ « Commune » ; l'historique ouvert sur l'onglet « Réalisées », « … réalisées dans la sélection. », l'export « Exporter CSV · réalisées, du … au … » en `status=done`, puis « Planifiées » en `status=planned` ; cibles d'au moins 44 px au téléphone (8 novembre 2026, 3.8 quater, lot 1, D-072) |
| P28 | Le téléphone | sur une ferme neuve qui coche tout, le navigateur sans Push (les alertes système indisponibles, quel que soit le navigateur du parcours) : au téléphone, la barre du bas « Arrosages, Planning, Besoins, Ressources » et « Plus » (« Aujourd'hui, Arrosages, Planning, Ressources » depuis la PR 3 du lot 2, F17), leurs noms entiers pour un lecteur d'écran, la page ouverte marquée ; « Plus » ouvre les onze pages en feuille (douze depuis la PR 3), porte la pastille verte sur Réglages, se referme par Échap ; la saison dans la ligne du titre, nommée « Saison », le bloc de la saison caché ; le bandeau « Alertes système non disponibles » en entier à la première ouverture, replié ensuite, la cloche nommée « … alertes système non disponibles sur cet appareil », le rappel entier dans Réglages ; le premier champ d'« Arrosages » au-dessus de la barre du bas ; le planning calculé : au plus huit écrans, la ligne de résumé qui déplie les tuiles sur deux colonnes, le jour ouvert, « Jours écoulés (n) » qui range les jours passés, « Voir les créneaux (n) » et « Replier le jour » ; la pastille « i » de l'historique, le « ? », « Actualiser », la barre, la feuille et les plis à 44 px ; la page introuvable avec la même barre et le même menu. À l'ordinateur : le menu de gauche, la saison sous le titre, le bandeau, les tuiles et tous les jours affichés, aucun pli. Un second cas, le stockage du navigateur illisible : le bandeau reste affiché, la cloche sans point, aucune erreur (8 novembre 2026, 3.8 quater, lot 2, D-073) |
| P29 | Aujourd'hui | sur une ferme neuve qui coche tout, propre au parcours et à la largeur : le choix des cases puis `/irrigation` mènent à « Aujourd'hui », première du menu, sans choix de saison ; « Plan non calculé : ouvrir le planning », puis les cinq blocs dans l'ordre, « Gel ou chaleur », « En retard », « À faire aujourd’hui », « Eau disponible », « Fiabilité du calcul », chacun en une phrase calme ou en lignes (depuis le tableau de bord, D-074 : la date en toutes lettres, la phrase du jour, et six blocs dans l'ordre, « Votre journée », « Gel ou chaleur », « Eau de la semaine », « Réserve du sol », « Eau disponible », « Fiabilité du calcul ») ; le « ? » de la zone qui écrit les seuils (7 jours, 48 heures) ; la pastille du menu égale au nombre de lignes de la zone, son nombre dans le nom du lien ; « Recalculer le plan » qui retire sa ligne, la pastille d'un de moins ; « Observer le sol de … » qui ouvre la page du sol sur le jardin déplié ; une cuve sans volume créée, sa ligne et le bloc de l'eau qui le disent, « Saisir le volume de … » qui mène à sa carte à l'écran, 12 m³ saisis, la ligne partie et « 12 m³ sur 20 m³, observé aujourd’hui. » ; une alerte météo « Gel » fabriquée en test (minimale sous 12 °C), le bloc en alerte avec la barre rouge de la charte (et, depuis D-074, la pastille « Alerte météo … » de l'en-tête qui mène au bloc), « Voir les alertes » qui mène à « Alertes météo » ; au téléphone, l'entrée « Aujourd'hui » première de la barre du bas et marquée, la page en deux écrans de 844 px au plus (depuis D-074, T10 : la phrase du jour dans le premier écran) ; cibles d'au moins 44 px ; sans erreur dans la console (8 novembre 2026, 3.8 quater, lot 2, PR 3, D-073) |
| P30 | Le tableau de bord | sur une ferme neuve qui coche tout, propre au parcours et à la largeur : les pages du menu dans l'ordre de toujours ; l'encart « Aujourd'hui · Tableau de bord » détaché en tête, marqué comme page ouverte sans le vert plein, au-dessus des groupes « Arroser », « Équiper », « Surveiller », Réglages à part ; au téléphone, l'entrée « Aujourd'hui » de la barre en bouton rond qui dépasse de la barre, à 44 px, et la feuille « Plus » qui garde l'encart et les groupes ; la date, les quatre tuiles de « Cette semaine », les pastilles du résumé, celle des données à rafraîchir qui mène à « Fiabilité du calcul » à l'écran ; sans débordement de côté ni erreur dans la console (8 novembre 2026, 3.8 quater, tableau de bord, PR 2, D-074). « Tout est fait », sur une autre ferme neuve : pas de bouton sans rien à couvrir ; une irrigation planifiée il y a six heures, finie, fait paraître « Tout est fait (1) », à 44 px au téléphone ; la confirmation la liste cochée et dit qu'elle s'enregistre telle que prévue et ne se modifie plus ; décochée, « Enregistrer 0 irrigation » est grisé ; « Annuler » ferme sans rien écrire ; « Enregistrer 1 irrigation » l'enregistre, le message le dit, le bouton et « À rattraper » disparaissent (PR 3, D-074) |
| P31 | Le planning et les arrosages, en gestes (audit ergonomique, lot 3) | P31a, sur deux fermes neuves qui cochent tout, propres au parcours et à la largeur. Le planning : un objectif de ferme de 20 mm, aucun matériel, le plan calculé ; les cartes de tête « À valider », « Faites », « En retard » d'abord, marquées d'un trait (au téléphone, la ligne de résumé commence par « 0 à valider · 0 faite ») ; « n planches n’ont aucun matériel : les rattacher » au-dessus du pli, la tuile « dont n sans matériel » et le manque d'eau à zéro ; le pli « Planches non servies (n) » déplié, « Sans matériel (n) » en tête avec « pas un manque d’eau », sans « R13 », « arbitrage » ni « Non placé » ; le lien qui mène à « Matériel ». Les arrosages : le formulaire « Planifier » ouvert sans matériel choisi, la phrase « Choisissez un matériel… », aucun cadre rouge ; une irrigation planifiée il y a six heures et une demain ; « À traiter (1) » en tête avec la « Non faite » et un seul « Recalculer le plan », la ligne de demain sous « Demain » (heure, volume, « Planifiée »), sa carte ouverte par « Voir la fiche » ; « Démarrer maintenant » et « Modifier » visibles, « Annuler » caché dans le menu « … », ouvert puis refermé à Échap ; « Fait comme prévu » absent de la ligne de demain, présent sur la ligne passée et sur « Aujourd'hui » ; sa confirmation d'une ligne (« Enregistrer comme faite … », « Elle ne se corrigera plus dans le module. »), « Ne rien enregistrer » qui n'écrit rien, puis l'enregistrement et « À traiter » vidé ; l'irrigation de demain annulée depuis le menu. Au téléphone, le menu « … », « Annuler », « Fait comme prévu » et le lien « les rattacher » à 44 px. P31b et P31c viendront avec les PR 2 et 3 du lot. Ce qu'il ne prouve pas : les comptes chiffrés et le retard (tests du domaine), la phrase d'un dépassement de pompe (une ferme neuve n'a pas de pompe), la ferme réelle |

**Un parcours crée sa propre situation et la rend.** Les parcours partagent une
base et s'exécutent à la suite : ce que l'un laisse, les autres le trouvent. P7
en est l'exemple : le besoin manuel étant plafonné à 500 mm et la ferme de
démonstration n'ayant que trois planches, elles ne peuvent pas à elles seules
épuiser l'eau que P5 a créée. P7 coupe donc ses propres ressources, puis les
rétablit. Un parcours qui dépend de l'état laissé par un autre est un parcours
qui cassera le jour où l'ordre changera.

**Ce que le logiciel déduit d'un geste fait partie de la situation à rendre.**
Un objectif posé sur une semaine vaut pour les suivantes tant qu'il n'est pas
retiré ; une décision d'arbitrage validée reste en vigueur tant que le
logiciel ne l'a pas déclarée caduque, ce qu'il ne fait qu'en recalculant la
faisabilité, à l'écran ou pour un plan, quand l'eau suffit de nouveau ou quand
les planches candidates ont changé. P10 pose donc son objectif sur la semaine
courante et sur la précédente, et le retire des deux ; P7, ses besoins et ses
ressources rendus, recalcule la faisabilité et attend que l'écran déclare son
arbitrage « plus applicable ». Sans cela, la décision de P7 — servir N01 seule
parmi toutes les planches, l'objectif laissé par P10 leur donnant à toutes un
besoin — restait valide un dimanche soir, quand l'eau mobilisable d'ici minuit
ne couvre plus les besoins : le plan de P10 à 390 px n'avait rien à proposer
pour sa planche, « Non retenue lors de l'arbitrage manuel ». P10 a échoué
ainsi en local et en CI le 4 octobre 2026 (point ouvert 25) ; les jours de
semaine, l'eau suffisant, la décision devenait caduque d'elle-même et rien ne
se voyait.

**Un parcours ne dépend pas du jour où il tourne.** P10 pose son matériel sous
abri, où la pluie prévue de la météo de démonstration ne compte pas, et ouvre
la plage horaire toute la journée pour qu'un créneau tienne à n'importe quelle
heure. Ce que le calendrier seul décide — un dimanche ne laisse qu'une
proposition, un mercredi en laisse plusieurs — n'est vérifié que s'il est
offert, et le parcours le dit. P12 reprend ce dispositif et joue son refus
avant sa validation, pour qu'il reste une proposition à refuser même un
dimanche ; sa limite journalière court d'aujourd'hui sans fin, pour couvrir
le jour de l'arrosage validé quel qu'il soit.

**Un parcours ne dépend pas non plus de la minute où il tourne.** Ses
horodatages se calculent tous depuis un seul instant, relevé une fois au début
du parcours et passé à `horodatageLocal`, jamais depuis l'horloge au moment
de chaque saisie : entre deux lectures de l'horloge, une minute peut passer, et
un temps de marche de 8 h 30 devient 8 h 31, un débit de 1,059 m³/h devient
1,057. P5 a échoué ainsi sur `main` le 1er octobre 2026.

**Un parcours ne dépend pas non plus de l'heure où il tourne.** À moins d'une
heure de la fin d'une plage horaire, le moteur raccourcit le créneau du jour à
ce qui tient dans la plage dès que la dose minimale y tient : avec la plage de
P10 ouverte jusqu'à 23 h 59, de 23 h 00 à 23 h 41, la première carte n'est
pas celle de la dose entière. P10 lit donc la première carte à la dose entière
et, quand le calendrier n'en offre aucune — un dimanche à cette heure —, la
carte raccourcie, dont il vérifie le motif « ce qui tient dans la plage
horaire » et non la dose. P10 a échoué ainsi en local le 2 octobre 2026 et en
CI le 3 octobre (point ouvert 22). Reste connu et non couvert : le dimanche de
23 h 42 à 23 h 59, plus aucun créneau de la semaine ne tient et P10 n'a rien à
lire. P12, dans la dernière heure d'un dimanche, trouve après son refus son
besoin « Non placé » pour créneau refusé et n'a plus rien à valider : il le
dit et ne joue pas la suite.

**Deux parcours sur une même planche.** P10 laisse sa ligne posée sur son
tunnel ; P12, qui y pose la sienne, la fait débiter plus fort — 12 mm/h
contre 10 — : le moteur sert une planche par le matériel au débit le plus
fort (R12), et les propositions vont à la ligne de P12. P12 a échoué ainsi
en local le 31 octobre 2026, la première fois que les 28 parcours ont tourné
ensemble, et l'objectif qu'il n'avait pas retiré a fait échouer P10 à l'autre
largeur derrière lui. P26, qui passe après eux sur le même tunnel, fait
débiter la sienne à 14 mm/h pour la même raison.

**Un créneau protégé vaut pour toute la ferme.** Celui de P26 couvre toute la
semaine et toutes les plages : laissé derrière lui, il viderait le plan de
tous les parcours suivants. P26 vérifie donc qu'aucun créneau n'existe avant
de poser le sien, et le supprime avant de rendre le reste.

**Une pose se date avant les irrigations saisies après coup.** Depuis la
2.11, une irrigation saisie après coup utilise la pose ouverte à son heure de
début (`docs/equipment-placement-periods-contract.md`, règle 12). Le matériel
que `preparerMaterielArrosant` pose est donc daté du 1er janvier à 0 h 00 de
la saison : P3, P4 et P9 saisissent une irrigation commencée jusqu'à 90
minutes plus tôt, qu'une pose datée de maintenant refuserait. Une date ne
sort jamais de sa saison (règle 15) : dans les premières heures du 1er
janvier, ces irrigations, et le retrait que P11 date d'une heure plus tôt,
tomberaient dans la saison précédente. Reste connu et non couvert, comme le
dimanche soir de P10.

**Une fiche se cherche dans toutes les pages de l'historique.** L'historique
montre les irrigations les plus récentes d'abord, par pages de
`HISTORY_PAGE_SIZE` ; ce que les parcours précédents ont laissé dans la
période peut repousser la fiche d'un parcours au-delà de la première page, et
deux irrigations commencées à la même minute se classent dans un ordre que rien
ne fixe. Un parcours qui ne regarde que la première page dépend de l'état
laissé par les autres : il feuillette jusqu'à sa fiche (`trouverLaFiche`) et
s'arrête à la dernière page. P4 a échoué ainsi trois fois sur quatre le
1er octobre 2026. Après un changement de période, les cumuls arrivent par une
action serveur : le parcours attend une preuve de la réponse — le lien d'export
qui porte la nouvelle période — avant de feuilleter.

**Le premier geste d'un parcours doit prouver que React a repris la main.** Le
titre de la page vient du serveur et paraît bien avant. `ouvrirParClic` existe
pour ça, mais il ne suffit que si la cible dépend de React : un `<details>`
natif s'ouvre même sans JavaScript, et l'ouvrir trop tôt provoque un
avertissement d'hydratation — l'attribut `open` que le serveur n'avait pas
rendu — qui fait échouer le contrôle de console. Viser plutôt un élément dont
l'effet n'existe que sous React, comme une bulle d'aide. Un rechargement de la
page remet le parcours dans la même situation : le premier geste qui le suit
est un premier geste. P9 cliquait l'onglet « Par série » deux secondes après
son rechargement, les modules de la page encore en chargement, et échouait
une fois sur vingt-quatre sur le poste du porteur, jamais sur la CI (point 37
de l'état, 5 octobre 2026) ; depuis le 8 octobre, il clique par
`ouvrirParClic` jusqu'à ce que l'onglet soit sélectionné. P4, dont le premier
geste après son rechargement peut être de feuilleter l'historique, ouvre et
ferme d'abord la bulle d'aide, comme P7 à son départ ; P1 attend que le
minuteur avance, preuve équivalente, et P6 ne fait que lire.

**Une page par fonctionnalité, et chaque page attendue prête (3.8, 7 novembre
2026).** Depuis la 3.8, chaque fonctionnalité a sa page
(`docs/feature-selection-contract.md`, section 5) : un parcours va à la page
qui porte le bloc qu'il éprouve, et en change autant que son geste le
demande — P1 crée son matériel sur la page Matériel et placement, lit la
surface mouillée sur celle des besoins, puis démarre le minuteur sur celle des
arrosages. Chaque changement de page étant un premier geste, le gabarit des
pages marque `data-interactive` sur `<main>` une fois React aux commandes, et
`attendreLaPageIrrigation` (ou `attendreLaPagePrete`, après un rechargement ou
un lien suivi) attend ce marqueur après le titre. Les premiers clics
réessayés et la bulle d'aide de départ ne sont plus nécessaires ; P4 et P9
lisent les cumuls en ouvrant la page de l'historique, sans rechargement.
`ouvrirParClic` reste là où il était, sans nuire. Un recalcul du planning
déclenché sur une autre page — la pluie de P12 sur celle des besoins, sa
limite sur celle des arrosages — se lit en ouvrant la page du planning. P0
vérifie le menu, la page courante et qu'une ancienne adresse
`/irrigation#planning` mène à la page qui porte le bloc ; P11, que le
formulaire des arrosages ne propose plus de reposer un matériel stocké, qui se
repose depuis sa carte (précision P37, 7 novembre 2026).

**La ferme de démonstration est une ferme d'avant la 3.8 ; une ferme neuve
se choisit par un témoin (3.8, PR 3).** Le choix des fonctionnalités se fait
à la première ouverture, quand la ferme n'a pas encore d'espace d'irrigation
(`docs/feature-selection-contract.md`, R5). La remise à zéro de la base crée
donc l'espace de la ferme de démonstration, sans choix enregistré : elle voit
tout coché et le bandeau, comme les fermes réelles le jour de la mise en
ligne (R6), et les parcours d'avant la 3.8 la trouvent telle qu'ils la
connaissaient. Les parcours du choix, P22 et P23, jouent sur une ferme neuve,
propre au parcours et à la largeur : le témoin `demo-farm` donne à
l'utilisateur de démonstration un autre identifiant, toujours préfixé
`local-demo-`, derrière les mêmes réglages que lui (`LOCAL_DEMO_USER=true`
hors production, `app/access-auth.ts`). Aucun parcours ne change le choix
de la ferme de démonstration ni ne ferme son bandeau : les autres le
trouveraient changé. P14, P15 et P17 rattachent leurs espèces dans
Réglages, où la correspondance des espèces est passée (précision P3).

À chaque largeur et sur chaque page visitée, deux contrôles s'ajoutent au
parcours lui-même :

- **aucun débordement horizontal** : la largeur du document ne dépasse pas celle
  de la fenêtre ;
- **aucune erreur de console** : ni exception, ni ressource manquante.

Le navigateur sans tête des parcours ne demande ni les icônes ni le manifeste
que la page déclare : une icône manquante n'y laisse aucune erreur de console.
P0 les demande donc lui-même (`<link rel="icon">`, `<link rel="manifest">`) et
exige une réponse 200 (ajouté le 7 novembre 2026, après une icône de page qui
répondait 404 sans qu'aucun parcours ne le voie).

## Exécution

- `pnpm e2e` joue les parcours en local, après avoir remis la base à zéro et
  démarré le serveur de développement.
- Un job d'intégration continue séparé, « Parcours navigateur », les joue à
  chaque PR et sur `main`. Il est séparé du job « Application » pour que son
  temps et ses échecs restent lisibles, et parce qu'il installe un navigateur.
- Les captures d'écran et les traces des parcours en échec sont conservées comme
  artefacts du job, afin qu'un échec puisse être compris sans le reproduire.

## Interdits

- Attendre une durée fixe plutôt qu'une condition : un parcours attend qu'un
  texte apparaisse, jamais « deux secondes ».
- Dépendre de l'ordre des parcours, ou de ce qu'un autre a laissé en base.
- Appeler un vrai service extérieur, Ouvre ta ferme, météo ou notification.
- Affirmer qu'un parcours automatisé remplace la recette utilisateur.
- Poser `WEATHER_DATA_SOURCE` ou `LOCAL_DEMO_USER` ailleurs qu'en local et en
  intégration continue.

## Preuve de fin

Job vert sur `main` et sur les PR, durée sous cinq minutes, quatre parcours à
deux largeurs, captures conservées en cas d'échec.
