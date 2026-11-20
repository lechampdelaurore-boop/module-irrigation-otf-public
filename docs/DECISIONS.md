# Registre des décisions

Ce registre conserve les décisions qui doivent survivre aux interruptions et
aux changements d'intervenant. Une nouvelle décision complète la liste ; elle
ne réécrit pas silencieusement une décision antérieure.

## D-001 — OTF reste la source de référence

Le module ne copie pas indépendamment les utilisateurs, exploitations,
parcelles, jardins, abris ou planches. Il référence les identifiants OTF et
stocke uniquement les données propres à l'irrigation.

## D-002 — Connecteur OTF strictement en lecture

Les seules communications OTF autorisées sont les routes `GET` placées dans la
liste blanche du client. Aucun contournement ponctuel du contrat n'est admis.

## D-003 — Inconnue n'est pas zéro

Une dimension, une donnée météo, un volume ou une relation hydraulique absent
reste explicitement inconnu. Les calculs ne doivent pas transformer une
absence de donnée en zéro.

## D-004 — Cadre temporel commun

Les semaines vont du lundi au dimanche. Les dates et les découpages métier
sont interprétés dans le fuseau `Europe/Paris`, y compris autour des changements
d'heure.

## D-005 — Météo actualisée côté serveur

La météo est synchronisée automatiquement par un Worker planifié. Une action
manuelle reste disponible, mais le calcul des besoins ne doit pas dépendre de
l'ouverture de la page au bon moment.

## D-006 — Historique immuable

Les irrigations terminées, les instantanés utilisés pour les calculs et les
corrections de stock importantes restent traçables. Une modification actuelle
ne réécrit pas rétroactivement un événement historique.

## D-007 — Deux dépôts distants, un seul historique

Le dépôt interne historique reste le remote `origin`. Un dépôt GitHub privé est
ajouté sous le nom `github` pour la sauvegarde, les revues et la CI. Les deux
reçoivent le même historique ; aucun export manuel ou second projet divergent
n'est créé.

## D-008 — Main stable et tâches courtes

`main` reste publiable. Les nouvelles tranches et corrections non triviales
utilisent une branche `codex/<sujet>`, des commits atomiques et une intégration
après contrôles. Les reprises commencent par le registre d'état et l'état Git.

## D-009 — Types Node maintenus sur la génération 22

Le projet et la CI restent sur Node 22 pour le moment. Dependabot peut proposer
les correctifs et versions mineures de `@types/node` 22, mais les changements de
version majeure sont ignorés jusqu'à l'ouverture d'un chantier dédié de
migration du runtime Node.

## D-010 — L'ET0 est une information, jamais un terme du besoin

Décision du porteur de projet du 18 septembre 2026. Le besoin hebdomadaire
d'une planche part de l'objectif hydrique applicable ; la pluie réelle, la
pluie prévue et les irrigations réelles ou planifiées en sont soustraites.
L'ET0 est affichée pour éclairer la décision, avec sa provenance et ses jours
manquants, mais n'entre dans aucune formule de besoin ni d'écart, conformément
aux sections 10 et 11 du cahier des charges. Le plafonnement
`min(ET0, objectif)` introduit par la sous-tranche 3.3 est retiré par la
sous-tranche 3.3.1. Toute réintroduction de l'ET0 dans un calcul exige une
nouvelle décision explicite.

## D-011 — GitHub est l'unique source de vérité

Remplace D-007 à partir du 18 septembre 2026. Le dépôt GitHub privé
`lechampdelaurore-boop/module-irrigation-otf` est le seul lieu d'écriture :
branches, revues, CI et historique. Le dépôt interne de l'environnement Codex
n'est plus alimenté ; s'il sert à publier le site, il ne reçoit que ce qui
vient de GitHub. La procédure de publication du site doit être documentée dans
le dépôt et partir de GitHub (sous-tranche Q1).

## D-012 — Retrait de Tailwind

Décision du 18 septembre 2026. L'interface n'utilise aucune classe utilitaire
Tailwind ; la mise en forme vit dans la feuille de style maison. Tailwind ne
sert que par sa remise à zéro des styles du navigateur. Les paquets et l'import
sont retirés en sous-tranche Q4, la remise à zéro est recopiée dans un fichier
du projet pour un rendu identique, vérifié visuellement sur ordinateur et à
390 px. La stratégie de style de l'interface réorganisée sera décidée en 3.8.

Mise en œuvre le 19 septembre 2026 (sous-tranche Q4, première PR) :
`tailwindcss` et `@tailwindcss/postcss` retirés avec la configuration PostCSS de
Vite ; `app/globals.css` importe `app/preflight.css`, copie figée des couches
« theme » et « base » que Tailwind 4.3.3 compilait pour ce projet, avec sa
provenance et sa licence en en-tête ; les trois noms de classes sans règle
retirés du balisage. Preuve d'équivalence : page `/irrigation` en données de
démonstration, 1 561 éléments comparés avant et après à 1 280 px et à 390 px,
cinquante-six propriétés calculées et position de chaque élément identiques ;
feuille de la page identique octet pour octet, feuille globale identique hors
les couches Tailwind inutilisées (utilitaires et propriétés `--tw-*`).

## D-013 — Protection de `main`

Le 18 septembre 2026, le compte propriétaire est passé en GitHub Pro et une
règle de protection classique a été appliquée à `main`, puis relue par l'API :
PR obligatoire sans approbation requise, jobs « Application » et « Workers
Cloudflare » requis, branche à jour exigée, aucun contournement y compris pour
l'administrateur, ni forçage ni suppression. La CI est désormais bloquante et
non plus informative. Le dépôt reste privé ; la question de son ouverture et
d'une licence est reportée à la tranche 4.

## D-014 — Le porteur de projet valide le cadrage agronomique du planning

Décision du 18 septembre 2026. Le contrat de planning de la sous-tranche 3.5.0
est validé par le porteur de projet lui-même, avant tout code du moteur, sans
relecteur externe à attendre. Le contrat est rédigé pour une lecture non
technique avec des exemples chiffrés de la ferme ; toute règle agronomique
discutable est un réglage plutôt qu'une constante, et les questions ouvertes
restent listées.

## D-015 — Risque Vinext accepté avec garde-fous

Décision du 18 septembre 2026. L'application s'exécute avec Vinext, outil
Cloudflare en bêta sans version stable. Le risque est accepté : version
épinglée, mise à jour dans un lot dédié de Q4 testée par la CI et vérifiée
visuellement, puis suivi régulier ; les frontières de Q3 cantonnent la
dépendance à l'interface et à la configuration. Un changement d'hébergement
n'est pas retenu pour ce motif ; la question de l'hébergement et de l'identité
est traitée en tranche 4 (4.7). Réévaluation à la 3.9.

Réévaluée le 13 novembre 2026, à la recette finale de la 3.9 : close
« risque levé » (D-101).

## D-016 — Hébergement sur Cloudflare, publication automatique

Décision du 18 septembre 2026. La publication sur OpenAI Sites est manuelle
et passe par Codex ; elle est incompatible avec une méthode fondée sur des PR
petites et fréquentes suivies d'une recette sur le site réel. L'application
est migrée vers un Worker Cloudflare et une base D1 dans le compte du porteur,
avec Cloudflare Access pour la connexion, une adresse en `.workers.dev` et un
déploiement lancé par GitHub Actions à chaque fusion dans `main` après les
contrôles. Les données sont exportées de Sites une dernière fois puis
importées, identifiants conservés, historique non réécrit. Sites est
décommissionné après la bascule. Le métier, le schéma et les Workers existants
ne changent pas. Contrat : `hosting-migration-contract.md` (sous-tranche Q0).
Cette décision ne modifie pas D-015 : Vinext reste l'outil d'exécution.

Mise en œuvre : les quatre phases du contrat ont été exécutées les 18 et
19 septembre 2026 ; le code propre à Sites est retiré du dépôt. **Décision
close le 3 octobre 2026** : après quatorze jours sans incident sur la nouvelle
adresse, le porteur a supprimé lui-même le site Sites depuis son compte
ChatGPT ; l'ancienne adresse répond 404 le soir même.

## D-017 — Plan Workers payant pour l'hébergement

Décision du 19 septembre 2026. Après la première écriture réelle sur le
nouvel hébergement, la page `/irrigation` a renvoyé l'erreur Cloudflare 1102
« Worker exceeded resource limits ». Le journal du Worker montre l'issue
`exceededCpu` : le plan Workers gratuit limite chaque requête à dix
millisecondes de calcul et le rendu serveur de la page avec les données
réelles est à cette limite, d'où un échec une fois sur deux. Le porteur
souscrit le plan Workers payant, cinq dollars par mois, qui porte la limite à
trente secondes par requête et relève les quotas D1. Alternative écartée :
réduire le calcul du rendu sous dix millisecondes, incertaine et remise en
cause à chaque fonctionnalité. Conséquences : l'hébergement du module coûte
cinq dollars par mois ; aucun changement de code ; la limite de calcul n'est
plus une contrainte de conception, mais le temps de rendu des pages reste à
surveiller (sous-tranche Q5, puis 3.8).

## D-018 — Migrations SQL manuscrites, Drizzle réduit à la description du schéma

Décision du 19 septembre 2026 (sous-tranche Q4). Les fichiers SQL de
`drizzle/` font foi ; ils s'écrivent à la main, sont additifs et ne se
modifient plus une fois fusionnés. `db/schema.ts` reste la description typée
des tables, vérifiée par le test de dérive qui rejoue toutes les migrations sur
une base neuve ; `drizzle-orm`, qui ne sert qu'à l'écrire, devient une
dépendance de développement épinglée. La génération de migrations est
abandonnée : les instantanés de drizzle-kit n'existaient que pour six
migrations sur quinze et le dernier contredisait le SQL appliqué ; une sonde du
même jour montre que `drizzle-kit generate` proposerait une migration
destructive recréant deux tables pour un écart inexistant. `drizzle-kit`, le
script `db:generate`, `drizzle.config.ts` et `drizzle/meta/` sont retirés.
Alternative écartée : reconstituer les instantanés, coûteux, sans garantie et
redondant avec le test de dérive. Contrat : `docs/migrations-contract.md`.
Cette décision ne modifie pas la persistance par SQL préparé (Q2).

## D-019 — Un besoin toujours calculable, ses jours incertains signalés

Décision du porteur de projet du 20 septembre 2026, prise pendant la recette
3.4 devant une semaine entièrement « non calculable ». Cause : les réanalyses
de pluie arrivent avec cinq jours de retard, si bien que les jours récents
n'avaient aucune pluie réelle, et une seule journée inconnue suffisait à
annuler le besoin de toute la semaine.

Règle retenue. La pluie d'un jour écoulé est, dans l'ordre : la mesure du
pluviomètre, sinon la réanalyse, sinon la prévision enregistrée pour ce
jour-là, sinon zéro. La pluie d'un jour à venir est sa prévision, sinon zéro.
Le besoin est donc toujours chiffré. Chaque planche expose les jours sans
pluie réelle et, parmi eux, ceux repris de la prévision ; l'interface affiche
le besoin suivi de la mention « partiel » et de ces dates, comme elle le fait
déjà pour l'ET0. L'ordre de priorité du contrat météo est inchangé : une mesure
de pluviomètre n'est jamais écrasée.

Seul un objectif hebdomadaire absent rend encore un besoin non calculable : il
n'y a alors aucune cible, et afficher zéro ferait passer une planche oubliée
pour une planche servie.

Alternative écartée : compter zéro les jours sans pluie réelle, comme le fait
l'ET0. Le besoin affiché serait devenu un maximum et aurait fait arroser
au-delà du nécessaire après une pluie non encore réanalysée. La prévision du
jour est une estimation imparfaite, mais bien plus proche de la réalité, et la
réanalyse elle-même est une estimation et non la mesure d'une station de la
ferme.

Conséquence corrigée au passage : le jour courant appartenait à la fois aux
jours écoulés et aux jours à venir, ce qui déduisait sa pluie deux fois dès
qu'elle était connue des deux côtés. Chaque jour de la semaine compte
désormais une seule fois, le jour courant étant rattaché au réel.

Contrat : `docs/irrigation-needs-contract.md`. Cette décision ne touche ni
D-010, qui maintient l'ET0 hors de toute formule, ni le contrat météo, qui
continue de stocker séparément prévision, réanalyse et mesure manuelle.

## D-020 — Les types d'enregistrement appartiennent au domaine

Prise le 21 septembre 2026, au début de la sous-tranche Q6, pour fermer une
exception laissée par Q3.

Q3 a réparti `lib/` en trois zones et interdit au domaine de dépendre de la
base. Six modules du domaine ont pourtant gardé un import, en type seulement,
vers des enregistrements définis dans `db/` : la forme d'une irrigation, celle
d'un matériel, celle d'un placement, celle d'un groupe de jardin. Le typage
l'acceptait, la règle ESLint le tolérait explicitement, et la dépendance était
à l'envers.

Règle retenue. La forme d'une irrigation est une notion du métier, pas une
notion de la base : ces types descendent dans `lib/domain`, et `db/` les
importe pour dire ce qu'il lit et ce qu'il écrit. Le sens de dépendance devient
celui du contrat de frontières : la base connaît le domaine, le domaine ignore
la base.

Ce que la décision ne fait pas : elle ne crée pas une deuxième description du
schéma. Les colonnes restent décrites une seule fois dans `db/schema.ts`, et
les types déplacés restent ceux que les dépôts renvoient, sans copie ni
traduction intermédiaire.

Conséquence outillée : la tolérance inscrite dans `eslint.config.mjs` pour ces
imports de type disparaît, et un retour en arrière fait échouer le lint.

Contrats : `docs/boundaries-contract.md` et
`docs/file-splitting-contract.md`.

## D-021 — Suivi hydrique par série : la période d'occupation se recalcule depuis les tâches

Prise le 26 septembre 2026 par le porteur, après la reconnaissance de la
nouvelle API d'Ouvre ta ferme sur sa ferme (`docs/series-contract.md`).

L'API expose désormais l'occupation des planches par série (`/placeList`),
les séries et leurs mises en culture (`/seriesList`), les tâches
(`/taskList`) et les interventions (`/actionList`). Elle ne donne pas de
dates d'occupation : une série porte deux entiers calculés par OTF,
`bedStartCalculated` et `bedStopCalculated`, dont la documentation ne dit
rien, et que seul le code source d'OTF explique.

Trois règles retenues :

1. **La période d'occupation se recalcule chez nous, depuis les tâches**,
   plutôt que d'être lue dans les deux entiers d'OTF. La règle est la même
   que celle d'OTF — lue dans son code — mais elle est à nous, écrite au
   contrat, testée, et elle se tient mise en culture par mise en culture,
   en disant s'il s'agit d'un semis ou d'une plantation. Motif du porteur :
   « c'est ce qui me paraît le plus robuste ».
2. **La semaine d'implantation au champ** est la plus précoce des tâches de
   **semis direct** ou de **plantation** ; le semis en pépinière n'implante
   rien au champ. **Les interventions créées par le porteur — celles dont
   l'identifiant `fqn` est nul — sont ignorées** : il en a, aucune n'est un
   semis ni une plantation.
3. **Semaine réalisée si la tâche est cochée, sinon semaine planifiée**, la
   règle d'OTF. Motif du porteur : « il n'est pas certain que les gens
   cochent l'action faite dans OTF ; on s'en tient à l'action cochée si c'est
   le cas, sinon au planning ». Une semaine planifiée reste une intention et
   se présente comme telle (prévu, estimé, observé restent distincts).

Vérifié le jour même sur trois séries réelles : le recalcul retrouve la
valeur d'OTF à la semaine près.

Ce que la décision ne fait pas : elle ne répartit pas les millimètres entre
séries — chaque série présente sur une planche reçoit la totalité des
millimètres de la planche, règle invariante du cahier des charges — et elle
n'écrit rien dans OTF.

## D-022 — Suivi hydrique par série : fin de période, surface mouillée, séries ignorées, lecture des tâches

Prise le 28 septembre 2026 par le porteur, en validant les cinq propositions
restantes du contrat `docs/series-contract.md` (points 4 à 8). Les trois
premières règles restent celles de D-021.

1. **La période d'une série s'arrête à sa dernière semaine de récolte** :
   la dernière réalisée si elle existe, sinon la dernière attendue. Motif du
   porteur : « une culture ne peut pas rester en place après la dernière
   récolte ». L'eau reçue par la planche après cette semaine n'est pas
   attribuée à la série.
2. **La surface mouillée dépend du matériel, pas de la série.** En aspersion,
   on compte la planche **et** le passe-pied ; en goutte-à-goutte, la planche
   seule. Une planche qui reçoit les deux, ou change de matériel en cours de
   saison, compte chaque irrigation selon son propre matériel. **La règle
   vaut aussi pour les planches**, pas seulement pour les séries : le module
   comptait jusqu'ici la planche seule en aspersion, ce qui sous-estime les
   volumes en m³ demandés à la ressource, et une série aurait consommé plus
   que sa propre planche. L'alignement des planches est un chantier séparé,
   à mener **avant** le développement des séries, parce qu'il change des
   volumes et un calcul de faisabilité déjà en service. Un passe-pied
   inconnu (`alleyWidth: null`) rend la surface d'aspersion inconnue, donc
   signalée, jamais nulle (D-003).
3. **Les séries sans semis direct ni plantation, et les séries en bloc,
   sont ignorées** : aucun cumul et **aucun affichage**. Le porteur préfère
   ne pas les voir plutôt qu'une liste à part avec leur motif. Le nombre de
   séries ignorées reste compté par le connecteur, pour que le journal et
   les tests puissent le constater.
4. Deux séries présentes la même semaine sur une planche reçoivent chacune
   la totalité de ses millimètres : confirmé, application de la règle
   invariante.
5. **Les tâches sont lues en entier, toutes saisons**, en une passe paginée,
   plutôt que série par série, **sous la limite de quatre appels par seconde
   qui vaut pour tout le connecteur** (D-002) : le porteur l'a rappelé, « sinon
   ça ne fonctionnera pas ». Coût constaté : treize pages, environ quatre
   secondes de plus à une actualisation, seulement quand le cache a plus de
   quatre heures ou sur « Actualiser ». Au-delà du plafond de cinquante pages,
   la lecture est refusée et signalée, jamais tronquée.

Le contrat est validé ; la première ligne de code de l'extension attend
l'alignement des planches (règle 2).

## D-023 — Surface mouillée : les volumes déjà enregistrés restent tels quels

Prise le 28 septembre 2026 par le porteur, en réponse à la question laissée
ouverte par D-022 : que faire des volumes d'aspersion enregistrés avant que
le passe-pied ne compte.

**Ils ne bougent pas.** Une irrigation enregistrée avant l'étape 5.0 garde le
volume et le débit demandé calculés à l'époque, sur la planche seule ;
l'historique est immuable (D-006). La règle de surface mouillée s'applique aux
calculs à venir : projections, nouveaux enregistrements.

Mise en œuvre (`docs/wetted-surface-contract.md`) : la migration qui ajoute
la surface mouillée aux applications d'irrigation remplit les lignes
existantes avec leur surface de planche, de sorte qu'un `NULL` ne signifie
ensuite qu'une chose, une surface inconnue au moment de l'enregistrement.
Conséquence assumée : deux irrigations d'aspersion de la même planche, l'une
avant et l'autre après, affichent deux volumes pour les mêmes millimètres ;
le détail de chaque irrigation montre la surface retenue.

Le contrat entier, avec ses trois points de mise en œuvre — la plus grande
surface pour le besoin d'une planche portant les deux matériels, le volume
inconnu et signalé quand le passe-pied manque, le remplissage des lignes
existantes —, est validé par le porteur le jour même.

## D-024 — Planning hebdomadaire : onze règles de cadrage tranchées par le porteur

Décision du porteur de projet du 29 septembre 2026 au soir, à la lecture du
contrat `docs/planning-contract.md` (cadrage 3.5.0), écrit le jour même. Il
en est le validateur agronomique (D-014). Onze des douze questions du contrat
sont tranchées ; la troisième, les doses par arrosage, attend ses valeurs.

1. La pluie prévue est déduite du besoin à 100 %, comme le fait déjà la 3.3 ;
   sous abri, elle vaut zéro comme la pluie réelle.
2. Une pluie prévue de plus de 5 mm fait placer les arrosages des planches
   concernées après elle.
3. La dose d'un matériel qui arrose plusieurs planches est le besoin restant
   le plus élevé parmi les planches couvertes ; le sur-apport reçu par les
   autres est affiché planche par planche.
4. Quand un goutte-à-goutte et une aspersion arrosent la même planche, le
   goutte-à-goutte sert d'abord.
5. Les créneaux se placent au plus tôt dans la semaine, sans lissage ; le
   lissage vient de l'espacement entre deux arrosages.
6. Les plages horaires par nature de matériel partent des valeurs proposées —
   aspersion 21 h – 8 h, goutte-à-goutte 6 h – 22 h — et se règlent à l'écran
   par le maraîcher, comme les doses.
7. En pénurie, la priorité haute est servie en entier, puis la normale, puis
   la basse ; dans le niveau qui ne peut pas l'être, chaque planche reçoit la
   même fraction de son besoin ; un arbitrage 3.4 validé s'impose au moteur.
8. Le déficit d'une semaine ne se reporte pas sur la suivante : l'objectif
   est hebdomadaire, le déficit se lit dans les cumuls.
9. Un arrêté préfectoral de restriction est toujours une limite en mètres
   cubes par jour : la limite journalière de la 2.8 en est le modèle, déjà en
   place ; le planning n'a pas de plage horaire de restriction à modéliser.
10. Une proposition se valide une par une, par jour, ou pour toute la semaine.
11. Aucun indicateur agronomique n'est ajouté avant le moteur. Le porteur
    envisage d'implanter plus tard des algorithmes d'instituts de recherche
    donnant le besoin en eau de chaque culture à chaque stade ; ils
    remplaceraient l'objectif hebdomadaire à l'entrée de la 3.3, planche par
    planche, sans changer le moteur de placement.

12. Complété le soir même, après explication : les doses par arrosage
    partent des valeurs proposées — aspersion 5 à 15 mm, goutte-à-goutte 3 à
    10 mm, un arrosage par jour et par planche, 24 heures au moins entre deux
    arrosages d'une même planche — et se règlent à l'écran.

Ne changent pas : D-003, D-004, D-006, D-010, D-019. **Le cadrage est validé
en entier ; le moteur (3.5) commence le 29 septembre 2026 au soir.**

## D-025 — Portée d'un matériel : une planche à peine arrosée ne commande pas l'arrosage

Décision du porteur de projet du 29 septembre 2026 au soir, à la lecture de la
recette réelle du planning (`docs/recette-planning.md`), sur proposition de
l'assistant. Sur les rampes de bloc de la ferme, au réglage « 5 planches »
(7,5 mm/h au centre, 2 mm/h au bord), la règle R11 telle que tranchée (D-024,
point 4) prenait une planche de bord pour référence et revenait chaque nuit
pour son reste : 60 mm au centre pour 17,2 demandés, 130,956 m³ proposés pour
84,178 demandés, réserve projetée vide, trois blocs sans créneau.

1. Un réglage R13, par exploitation, réglable à l'écran : la part du débit le
   plus fort d'un matériel en dessous de laquelle une planche **ne commande
   pas** son arrosage. Valeur de départ : 50 %.
2. Une planche qui ne commande pas un matériel n'en fixe pas la dose, ne
   compte ni pour « un arrosage par jour » (R6) ni pour l'espacement (R7),
   pour les propositions comme pour les irrigations réelles ; l'eau qu'elle
   reçoit reste comptée dans les besoins et l'historique ; son reste est
   affiché avec le motif « portée du matériel insuffisante », à la décision du
   maraîcher.
3. Parmi les planches qui commandent un matériel, la planche la mieux arrosée
   fixe la dose ; à débit égal, le besoin le plus élevé (D-024, point 4). Une
   rampe à profil tourne une fois pour son centre et ne revient pas pour ses
   bords.

Ne changent pas : D-003, D-004, D-006, D-010, D-019, D-024 hors le point 4
ainsi précisé. Deux défauts d'explication relevés par la même recette sont
corrigés avec cette décision : le motif « temps de pompage » mis par défaut,
et le niveau projeté de la réserve lu au moment du placement.

## D-026 — Le job « Parcours navigateur » devient requis par la protection de `main`

Décision du 2 octobre 2026, prise par le porteur sur le point ouvert 21 de
`docs/ETAT_DU_PROJET.md`. La règle de protection de `main` (D-013) n'exigeait
que les jobs « Application » et « Workers Cloudflare » ; le job « Parcours
navigateur », né avec Q5 le 20 septembre 2026, n'y avait pas été ajouté, et
une PR aux parcours rouges restait fusionnable alors que le déploiement de
`main` attend ce job. Le réglage a été fait le 2 octobre 2026 dans le
navigateur du porteur — l'ajout du job à la liste par l'assistant, la
confirmation d'identité demandée par GitHub par le porteur lui-même — puis relu
par l'API : trois jobs requis, branche à jour exigée, aucun contournement.
Conséquence : la garde de `main` garantit désormais ce que le déploiement
demande, et chaque PR attend le vert des parcours avant de fusionner. D-013
reste valable, complétée par la présente ; `AGENTS.md` nomme les trois jobs.

## D-027 — Le test de performance du planning tolère deux secondes : une garde de complexité, pas une mesure de confort

Décision du 4 octobre 2026, prise par le porteur sur le point ouvert 23 de
`docs/ETAT_DU_PROJET.md`. Le test « une semaine complète sur une ferme de la
taille de la ferme réelle » bornait le calcul à 1 000 ms de temps réel. Sur le
poste du porteur, le calcul dure 580 à 650 ms, à chaud comme à froid ; sur les
machines partagées de GitHub, environ 1,6 fois plus lentes, 1 004 à 1 022 ms.
Quatre échecs en deux jours sur ces machines, deux sur `main` avec déploiement
sauté, deux sur des PR : la limite était trop juste pour une machine partagée,
et un échauffement ou un meilleur de plusieurs essais n'y changerait presque
rien, le coût est réel. Décision : la limite passe à 2 000 ms, constante
nommée dans le test, et le test est dit pour ce qu'il est, une garde contre
une régression de complexité du moteur, qu'un doublement du coût déclencherait
encore, non une mesure du confort de l'utilisateur, qui se juge en recette sur
le site. L'objectif d'une seconde reste celui du moteur : la piste
d'allègement de `minimumLevel`, notée le 2 octobre, devient le point ouvert
28 ; si elle ramène le calcul nettement sous la seconde sur la machine de la
CI, une décision suivante pourra redescendre la limite. La roadmap et le
contrat du planning portent la nouvelle preuve de fin.

## D-028 — Le planning expose les faits annoncés ; l'utilisateur décide

Décision du 5 octobre 2026, prise par le porteur sur le point ouvert 29 de
`docs/ETAT_DU_PROJET.md`, après la troisième recette réelle du planning. La
météo actualisée à l'ouverture de la page avait porté la pluie prévue de la
semaine à 15,7 mm ; le reste brut de plein champ, 4,3 mm, passait sous le
seuil de planification de 5 mm et le plan recalculé ne gardait que les
tunnels, pendant que le tableau des besoins affichait 20 mm de besoin réel.
Décision : le logiciel expose les faits tels qu'ils sont annoncés — la pluie
prévue, le seuil, le reste à planifier — et c'est à l'utilisateur de prendre
les décisions ; la règle ne change pas, la pluie prévue reste déduite selon
R2 (100 % au départ, D-019) et le seuil reste celui de la 3.3. Un utilisateur
qui estime que le sol a un déficit à combler baisse R2 ou arrose à la main ;
le logiciel ne le décide pas pour lui. L'idée de lister dans « Non placé »
les planches passées sous le seuil, avec leur reste brut, est notée sans être
demandée.

## D-029 — Le réglage R1 « heure du recalcul quotidien » est retiré

Décision du 5 octobre 2026, prise par le porteur sur le point ouvert 32 de
`docs/ETAT_DU_PROJET.md`, sur la recommandation de l'assistant. Le réglage
R1, affiché « recalcul à 06:30 » et modifiable à l'écran, n'agissait sur
rien : le recalcul du matin suit la synchronisation météo du Worker
planificateur, à 06 h 15, et aucun code ne lisait l'heure réglée. Un réglage
qui n'agit pas est un registre qui ment. Décision : R1 est retiré du contrat
(`docs/planning-contract.md`), des réglages, du formulaire et de la
présentation ; l'écran dit que le recalcul du matin suit la météo, à
06 h 15 ; une valeur déjà enregistrée cesse d'être lue, sans migration
destructive. Si un jour l'heure doit se régler, ce sera avec un
planificateur à lui, par une nouvelle décision.

## D-030 — Un créneau refusé est exclu pour le reste de la semaine

Décision du 5 octobre 2026, prise par le porteur sur le point ouvert 31 de
`docs/ETAT_DU_PROJET.md`, sur la recommandation de l'assistant, après la
troisième recette réelle du planning et une seconde explication le soir
même. Un refus est noté sur une carte datée, mais le calcul suivant repart
des besoins, de l'eau et des réglages sans lire les refus : il refait la
même proposition, au même créneau, à la même dose, par le même matériel —
la rampe du tunnel 4, mardi 22 h 30, le 5 octobre —, à côté de la carte
refusée, contre ce que le contrat promettait. Trois lectures étaient
possibles : le créneau refusé exclu pour le reste de la semaine, le jour
entier exclu pour la planche, ou rien. Décision : **le créneau refusé est
exclu pour le reste de la semaine**. Le créneau, c'est ce matériel à ces
heures ; le besoin reste et le moteur le place ailleurs, à une autre heure
ou un autre jour, ou le dit « non placé ». Un refus ne vaut que pour la
semaine de son plan : le lundi repart sans lui. Le contrat
(`docs/planning-contract.md`) est corrigé le soir même ; la mise en œuvre
dans le moteur — lire les refus de la semaine à chaque calcul — relève de
la 3.7, qui lui apprend à lire les décisions du maraîcher, ou d'une
correction à part sur le mot du porteur ; d'ici là, le contrat dit ce que
le moteur fait.

## D-031 — Le budget du test de performance du planning passe à 500 ms

Décision du 8 octobre 2026, prise par le porteur sur le point ouvert 28 de
`docs/ETAT_DU_PROJET.md`, sur la recommandation de l'assistant. D-027 avait
porté la limite du test « une semaine complète sur une ferme de la taille de
la ferme réelle » à 2 000 ms, garde de complexité et non mesure de confort,
en réservant une décision suivante si l'allègement du moteur ramenait le
calcul nettement sous la seconde sur la machine de la CI. C'est fait : après
la correction du point 28 (PR #138, un formateur de fuseau horaire par usage,
construit une fois), le job « Application » mesure 101 ms sur les machines de
GitHub et le poste du porteur 209 à 237 ms, contre environ 1 000 ms et 788 à
1 052 ms avant. Décision : la limite passe à 500 ms, cinq fois la mesure de
la CI et deux fois celle du poste du porteur, pour absorber les machines
partagées lentes tout en attrapant une régression de l'ordre de celle qui
vient d'être corrigée. Le test reste ce que D-027 en a fait : une garde
contre une régression de complexité, non une mesure du confort, qui se juge
en recette sur le site. Le contrat du planning et la roadmap portent la
nouvelle valeur.

## D-032 — Sous abri, la pluie vaut zéro dans toutes les vues, l'historique par périmètre compris

Décision du 9 octobre 2026, prise par le porteur sur le point ouvert 11 de
`docs/ETAT_DU_PROJET.md` : « il ne pleut jamais sous abri, donc il faut
aligner la règle ». Le cahier des charges fixe qu'une planche sous abri ne
reçoit pas de pluie ; le tableau des besoins (3.3), le planning et la vue
« Par série » l'appliquaient, mais le résumé de l'historique « Par
périmètre », écrit à la tranche 2 avant que l'abri n'existe, comptait la pluie
extérieure sur toute surface. Désormais la pluie réelle d'un périmètre est
pondérée par la surface de ses planches, zéro sur celles d'un jardin sous
abri : un périmètre entièrement sous abri lit 0 mm, explicite et complet,
quelle que soit la météo ; un périmètre mixte lit la pluie extérieure au
prorata de sa surface de plein champ. L'écart à l'objectif suit. C'est un
changement de comportement d'un écran existant, assumé : la règle vit dans le
domaine de l'historique, le contrat des séries la porte, et elle est testée.

## D-033 — Un besoin fixé à la main rend une planche planifiable sans objectif

Décision du 9 octobre 2026, prise par le porteur sur le point ouvert 15 :
« elle est servie par la faisabilité ». La faisabilité 3.4 servait déjà une
planche sans objectif dont le besoin est fixé à la main, le remplacement
manuel tenant lieu de besoin ; le moteur de planning la disait « non
planifiable : aucun objectif applicable », parce qu'il testait l'objectif
avant le remplacement. Le contrat du planning est aligné sur la faisabilité :
un remplacement manuel est une quantité absolue à placer, avec ou sans
objectif ; seule une planche sans objectif ni besoin manuel reste non
planifiable, listée avec ce motif.

## D-034 — Un objectif posé en cours de semaine vaut pour ses jours restants

Décision du 9 octobre 2026, prise par le porteur sur le point ouvert 16 :
« oui ». La 3.3 ne tenait l'objectif d'une semaine pour applicable que si un
objectif couvrait ses sept jours ; une ferme qui posait son premier objectif
un mercredi lisait « aucun objectif applicable » jusqu'au lundi suivant, et le
planning ne proposait rien. Désormais la demande de la semaine est la somme
des septièmes de l'objectif sur les jours qu'il couvre — la proratisation par
jour déjà en vigueur —, et seule une semaine dont aucun jour n'est couvert est
sans objectif. Les jours sans objectif ne sont pas une donnée manquante au
sens de D-003 : ils n'avaient pas de cible. La vue « Par périmètre » de
l'historique, qui demande encore un objectif sur chaque jour et chaque planche
de la période pour calculer l'écart, reste au jugement du porteur (point
ouvert 39).

## D-035 — La limite de prélèvement d'une ressource couvre tout ce qu'elle fournit

Décision du 9 octobre 2026, prise par le porteur sur le point ouvert 38 :
« oui ». Le moteur de planning comptait déjà dans la limite journalière d'une
ressource les prélèvements directs d'irrigation et les apports de la ressource
vers une réserve, lecture du contrat du planning, « plafonne ce que la
ressource peut fournir ce jour-là » ; la vérification de disponibilité d'une
origine de pompe (3.2) ne comptait que les prélèvements directs et annonçait
plus d'eau disponible que le planning n'en laissait. La règle du planning
s'impose : la limite plafonne tout ce que la ressource fournit ce jour-là,
apports à une réserve compris, et la 3.2 appelle la même fonction du domaine
que le planning, `actualWithdrawalsByResourceAndDate`.

## D-036 — L'historique somme l'objectif sur les journées-planche couvertes

Décision du 9 octobre 2026, prise par le porteur sur le point ouvert 39 de
`docs/ETAT_DU_PROJET.md` : « il faut aligner l'historique ». Le résumé « Par
périmètre » et les cumuls par série ne calculaient l'objectif d'une période,
donc l'écart, que si un objectif couvrait chaque jour de chaque planche ; une
période commencée avant le premier objectif de la ferme lisait « objectif
indisponible », quand le tableau des besoins tient depuis D-034 un objectif
posé en cours de semaine pour applicable à ses jours restants. Désormais
l'objectif d'une période est la somme des septièmes de l'objectif sur les
journées-planche qu'il couvre — une planche sur un jour —, pondérée par la
surface des planches ; une journée-planche sans objectif compte zéro et n'est
pas une donnée manquante ; seule une période sans aucune journée-planche
couverte est sans objectif et sans écart. Le nombre de journées-planche
couvertes reste affiché, parce que l'écart d'une période partiellement
couverte compare l'eau reçue sur toute la période à l'objectif de ces seules
journées. La règle vit dans `aggregateHydricObjective`, que les deux vues
appellent.


## D-037 — En pénurie, la part attribuée à une planche lui est réservée

Décision du 9 octobre 2026, prise par le porteur sur la première partie du
point ouvert 36 de `docs/ETAT_DU_PROJET.md` : « je suis d'accord avec ta
recommandation pour la fraction réservée ». La quatrième recette réelle du
planning avait montré que la part égale de la conduite en pénurie (R9) était
une cible, non un résultat : à 30 % pour toutes les planches d'une chaîne, les
planches examinées en premier recevaient leur part et les huit planches du
tunnel 4 rien, « réserve au minimum de sécurité au moment voulu », parce que
le moteur n'examine pas les planches dans l'ordre du temps et que les derniers
mètres cubes de la réserve étaient promis à des créneaux de vendredi et de
samedi examinés avant le sien. Désormais la fraction que la conduite en
pénurie attribue à une planche lui est réservée : le volume qu'elle représente
est mis de côté dans le budget de sa chaîne d'eau, et le créneau d'une autre
planche ne peut pas le consommer, quel que soit l'ordre d'examen ni l'ordre du
temps ; ce qu'une planche ne peut pas recevoir — plage, espacement, dose
minimale — est libéré pour les autres, jamais pris d'avance. L'autre voie,
servir dans l'ordre du temps, est écartée : elle garderait la part égale à
l'état de cible. Le mécanisme est écrit dans `docs/planning-contract.md` avant
le code ; correctif dans une PR `fix/` à part, point 36 restant ouvert
jusque-là.

## D-038 — Le manque d'eau reste calculé planche par planche, l'écart est expliqué à l'écran

Décision du 9 octobre 2026, prise par le porteur sur la seconde partie du
point ouvert 36 de `docs/ETAT_DU_PROJET.md` : « sur le manque d'eau, je suis
d'accord avec ta deuxième recommandation, expliquer la différence à l'écran
plutôt que de changer le calcul ». Le résumé du plan affichait un manque d'eau
de 62,187 m³ quand les volumes demandés moins les volumes placés donnaient
82,70 − 24,999 = 57,70 : le manque est la somme, planche par planche, du
besoin non couvert multiplié par la surface mouillée de la planche par son
matériel (`summarizeDeficit`, `lib/domain/planning/engine.ts`), tandis que le
volume placé est celui des créneaux ; une planche arrosée par son
goutte-à-goutte et par le bord d'une rampe compte l'eau de la rampe sur sa
surface mouillée en aspersion et son manque sur celle du goutte-à-goutte. Le
calcul ne change pas : il est exact planche par planche, ce que le contrat
demande (« le déficit annoncé est exactement le besoin non couvert »). L'écran
expliquera pourquoi le manque d'eau n'est pas « demandé moins placé », une
fois la cause confirmée dans le code sur les données de la recette ; correctif
dans une PR `fix/` à part, avec D-037.

## D-039 — L'historique compte un objectif à partir de son jour de pose

Décision du 9 octobre 2026, prise par le porteur sur le point ouvert 40 de
`docs/ETAT_DU_PROJET.md` : « oui, aligne l'historique ». L'historique relisait
les objectifs par semaine (`aggregateHydricObjective`,
`lib/domain/irrigation-history/summary.ts`) : un objectif posé un mercredi y
valait pour toute sa semaine, dès le lundi, quand le tableau des besoins ne le
compte, depuis D-034, qu'à partir du jour civil où il a été posé ; sur la
semaine du premier objectif, l'historique lisait 35 mm là où la 3.3 lit 25.
Désormais l'historique compte un objectif à partir de son jour de pose, en
heure de Paris (D-004), comme le tableau des besoins : une journée-planche
antérieure à tout objectif compte zéro, dans la somme de D-036. Le contrat des
séries est corrigé avant le code ; correctif dans une PR `fix/` à part, point
40 restant ouvert jusque-là.

## D-040 — La note du manque d'eau tolère le résidu d'arrondi des secondes

Décision du 10 octobre 2026, prise par le porteur sur le point ouvert 41 de
`docs/ETAT_DU_PROJET.md` : « je suis ta recommandation pour le point 41 ». La
note du manque d'eau (D-038, `waterDeficitExplanation`,
`lib/domain/planning/presentation.ts`) paraissait dès qu'un litre séparait
l'eau placée du besoin compté ; or le moteur coupe chaque créneau à la seconde
entière et tient pour reçu un reste sous un centième de millimètre
(`commitProposal`, `NEGLIGIBLE_MM`, `lib/domain/planning/engine.ts`) : la
planche est comptée servie de sa part entière quand le créneau livre un peu
moins, et la note donnait à cet écart une cause qui n'existe pas — sur la
ferme, 0,002 m³ pour 0,9 s rognées sur chacun des quatre créneaux, « couverts
par une eau comptée sur une surface plus petite ». Désormais la note ne
paraît, pour l'eau placée à côté en plus ou en moins, qu'au-delà du résidu
d'arrondi des secondes — un centième de millimètre par planche et par créneau
qui l'arrose, au prix de la surface mouillée de l'application, et au moins un
litre — ; le manque pour une autre raison garde son seuil d'un litre. Le
calcul du manque, la ligne de budget et les parts (D-037) ne changent pas :
seule la note se tait sur ce qui n'a pas de cause à nommer. Des trois voies
ouvertes par la recette — tolérer le résidu, créditer aux planches ce que les
secondes livrent, nommer le résidu dans le libellé —, la première est retenue,
la règle vivant déjà dans le moteur. Le contrat « Interface » de
`docs/planning-contract.md` est corrigé avant le code ; correctif dans une PR
`fix/` à part, recette sur le site après son déploiement.

## D-041 — La réserve du sol est une information, réglée par l'observation

Décision du 27 octobre 2026, prise par le porteur : « il faudrait ajouter
cette notion », la réserve facilement utilisable (RFU) que donnent les
analyses de sol, visible là où se décide l'arrosage, pour savoir si le plein
du sol est fait ; puis « je suis d'accord avec tes recommandations ». Le
logiciel gagne une réserve du sol, extension 5 ter de la roadmap, contrat
`docs/soil-reserve-contract.md` écrit le jour même. La RFU se saisit par
parcelle, avec une valeur propre possible par jardin ou abri, en mm et avec
sa profondeur de calcul, paramètre modifiable et historisé ; un abri sans
valeur propre a une RFU inconnue. La capacité d'une planche vaut la RFU par
cm fois la profondeur racinaire de sa culture, la plus faible quand plusieurs
cultures l'occupent ; une table culture → profondeur, remplie par
l'utilisateur, l'alimente. La jauge part d'une observation du maraîcher, en %
du plein, par un curseur par parcelle ou par jardin, jamais par planche,
réglable à tout moment ; elle suit ensuite la pluie, nulle sous abri,
l'irrigation réelle et la consommation, ET0 brute multipliée par un
coefficient réglable, 1 par défaut. Elle est estimée jusqu'à maintenant,
prévue jusqu'à dimanche, inconnue sans observation ou sans donnée (D-003).
La jauge est une information : elle n'entre ni dans le besoin, qui part de
l'objectif seul (D-010), ni dans le moteur de planning ni dans la dose ; une
dose qui dépasse ce que le sol retient est signalée, jamais corrigée (D-028).
La règlerait-elle un jour, ce serait par une décision nouvelle. Placée en 17
de l'ordre d'exécution, après la 3.7 et avant la 5 bis, sur la recommandation
de l'assistant acceptée par le porteur. La profondeur de calcul des 62 mm de
l'analyse de la ferme reste à confirmer auprès du laboratoire ; elle se
saisit d'ici là au statut « hypothèse ».

## D-042 — L'assistant fusionne lui-même le lot de dépendances du 27 octobre

Décision du 27 octobre 2026, prise par le porteur sur les six PR Dependabot en
attente : « j'aimerais que tu fusionnes tout seul… je n'ai pas besoin de le
faire moi-même », puis « occupe-toi des pull requests de Dependabot ». Par
exception à la règle d'`AGENTS.md` qui réserve la fusion au porteur,
l'assistant fusionne lui-même la PR qui reprend ce lot, une fois les jobs «
Application », « Workers Cloudflare » et « Parcours navigateur » verts sur la
branche à jour, puis vérifie le déploiement job par job. L'exception vaut pour
ce lot ; l'étendre aux lots suivants, ou aux seules dépendances de
développement, demande un mot du porteur, qui l'inscrira dans `AGENTS.md`.

## D-043 — La pose du matériel est datée ; un matériel retiré est stocké, rien n'est effacé

Décision du 27 octobre 2026, prise par le porteur. Constat : un
goutte-à-goutte se pose pour quelques semaines, s'enlève, se range et se
repose ailleurs, et « Retirer la position » refuse le retrait dès que le
matériel a servi à une irrigation (point ouvert 43) ; « il n'y a aucune
logique à ce qu'on retire un matériel pour le reste de la saison… il faut que
ça corresponde à la réalité ». Sur la recommandation de l'assistant, suivie le
jour même (« je suis d'accord avec tes recommandations », puis « vas-y ») : la
pose d'un matériel devient datée — une date de pose, une date de retrait une
fois retiré — ; un matériel sans pose ouverte est stocké et n'arrose rien ;
retirer, déplacer ou reposer n'efface ni ne réécrit rien, les poses fermées
restent lisibles et les irrigations gardent la position qu'elles ont utilisée
(D-006) ; besoins, faisabilité et planning ne comptent que le matériel posé ;
la règle vaut pour tout le matériel, rampes mobiles comprises ; une irrigation
planifiée sur un matériel retiré est signalée et ne démarre pas, jamais
supprimée sans confirmation ; une date de pose ou de retrait se reporte dans
le passé, sans limite de durée dans la saison de la pose, jamais dans le futur
; la limite de sept jours d'abord proposée est écartée par le porteur à la
relecture du contrat. Sous-tranche 2.11, placée avant la 3.7 ; contrat
`docs/equipment-placement-periods-contract.md`, relu et confirmé par le
porteur le jour même ; il exige qu'un message explique toujours le refus de
valider une proposition dont le matériel a été retiré. Modèle et effort : Opus
5.5 · Très élevé, réglés par le porteur.

## D-044 — Une irrigation planifiée qui ne peut pas démarrer ne compte plus dans les calculs

Décision du 29 octobre 2026, prise par le porteur sur une carte de décision,
en écrivant la PR 3a de la 2.11. Constat de l'assistant : une irrigation
planifiée sur un matériel retiré reste affichée et ne démarre pas (règle 13),
mais les besoins, la faisabilité et le planning la comptaient encore comme de
l'eau à venir : la planche paraissait servie et l'eau restait réservée. Sur
la recommandation de l'assistant (« Ne plus la compter ») : tant que le
matériel est stocké ou reposé ailleurs, une irrigation planifiée non démarrée
reste affichée et signalée, mais n'entre plus dans aucun calcul — besoins,
faisabilité, planning, réserves, limite journalière, pompe ; reposé au même
endroit, elle compte de nouveau. Écartée : la compter jusqu'à son annulation
par le maraîcher. Règle dans `lib/domain/equipment-placement-periods.ts`
(`irrigationsThatCount`), lue par les services au travers de
`lib/services/counted-irrigation-events.ts` ; contrat
`docs/equipment-placement-periods-contract.md`, règle 13.

## D-045 — Le besoin par culture et par stade est une proposition d'objectif

Décision du 30 octobre 2026, prise par le porteur. Il demande où la roadmap
range le calcul du besoin selon la culture et son stade, qu'il avait envisagé
au cadrage du planning (D-024, point 11) ; il n'y a ni sous-tranche ni place
dans l'ordre, seulement une question ouverte. Il fournit alors un document de
travail, préparé avec un autre assistant à partir des références du CRIIAM
Sud et de la FAO-56, et demande de le verser au dépôt sans code ; puis, sur
la recommandation de l'assistant, « vas-y » et « ok pour ta recommandation ».
Le logiciel gagne une extension 5 quater, contrat
`docs/crop-water-need-contract.md` écrit le jour même, à relire par lui
avant tout code. Pour chaque planche qui porte une culture et chaque jour,
ETM = ET0 × K_abri × Kc × K_paillage × K_ombrage ; Kc du CRIIAM Sud d'abord,
en escalier, sinon de la FAO-56, en trapèze, jamais les deux pour une même
culture ; stade observé par le maraîcher, sinon calculé depuis la semaine
d'implantation avec des durées par défaut validées par le porteur ; la somme
des sept jours donne un objectif hebdomadaire proposé. La proposition est une
information : elle n'entre dans le besoin que si l'utilisateur l'adopte, par
une révision d'objectif ordinaire au niveau de la planche, valable à partir de
son jour (D-039) ; l'écart, les cumuls, les priorités, la faisabilité et le
planning ne changent pas. Un mode automatique, où l'objectif suivrait la
proposition sans geste de l'utilisateur, ferait entrer l'ET0 dans le besoin :
il n'est pas décidé ici et attend une décision explicite du porteur (D-010).
La jauge de la réserve du sol garde « ET0 × coefficient » (D-041) tant que le
porteur n'en a pas décidé autrement. Placée en 20 de l'ordre d'exécution,
après la 5 bis et avant la 3.8, sur la recommandation de l'assistant acceptée
par le porteur. Contrat écrit en Opus 5.5.

Ne changent pas : D-003, D-006, D-010, D-024, D-039, D-041.

## D-046 — La RFU s'exprime en mm par mètre de sol

Décision du 30 octobre 2026, prise par le porteur : « la RFU s'exprime
toujours en mm par mètre », après la réponse du laboratoire sur l'analyse de
la ferme (« après confirmation avec le labo, c'est 62mm sur 1m »). Dans la
réserve du sol (5 ter, D-041), la RFU se saisit en mm/m. La profondeur de
calcul et son statut « confirmée par le laboratoire » ou « hypothèse », que le
contrat du 27 octobre 2026 prévoyait faute de savoir sur quelle profondeur
portaient les 62 mm, disparaissent, avec la mention à côté des jauges. La RFU
par cm vaut la RFU ÷ 100 ; la capacité d'une planche reste la RFU par cm fois
la profondeur racinaire de sa culture. Le seuil de vraisemblance, 2 mm/cm,
s'écrit 200 mm/m. La ferme se saisit 62 mm/m, et le point ouvert 42 est fermé.
Simplification recommandée par l'assistant et retenue par le porteur le jour
même ; rien n'était codé.

Ne changent pas : D-003, D-006, D-010, D-028 ; D-041, hors la profondeur de
calcul et son statut.

## D-047 — La jauge de la réserve du sol suit l'ETM et reste une information

Décision du 30 octobre 2026, prise par le porteur. Il fournit un complément
« jauge RFU » à son document de travail du besoin par culture et par stade
(D-045), et demande de l'intégrer au dépôt sans code. Relu contre le dépôt,
le complément change sept choix de la réserve du sol (5 ter, D-041, D-046) ;
le porteur tranche les trois qui lui sont posés sur des cartes de décision.
La consommation de la jauge devient l'ETM de la planche, calculée par la
5 quater, au lieu de l'ET0 × un coefficient réglable, qui disparaît ; la
5 quater passe donc en 18 de l'ordre d'exécution, la 5 ter en 19, la 5 bis
en 20, choix « 5 quater en 18, 5 ter en 19 ». La RFU du sol vaut la RFU du
laboratoire × (1 − part de cailloux), arrondie au mm/m entier, toujours en
mm par mètre (D-046) : sur la ferme, 62 mm/m du laboratoire et 18 % de
cailloux estimés par le porteur, quand l'analyse en compte 0 % sur
l'échantillon tamisé, soit 51 mm/m. Un abri sans analyse prend la RFU de sa
parcelle, marquée « non mesuré ». Les profondeurs racinaires de départ sont
celles de l'ITAB, fournies par le porteur ; la moitié au premier stade ; 30 cm
proposés avec un avertissement pour une culture sans valeur. Un seuil de
déclenchement par culture, d'après sa part utilisable p (FAO-56, tableau 22),
vaut capacité × (1 − min(1 ; p / 0,5)) : le complément écrivait capacité ×
min(1 ; p / 0,5), qui fait déclencher le plus tard les cultures les plus
sensibles ; choix « Corriger la formule ». Les jours avant le seuil, la dose
conseillée et le drainage s'affichent. Le complément faisait remonter une
planche sous son seuil dans les priorités d'irrigation : choix « Information
seulement » ; la jauge ne change ni priorité, ni dose, ni besoin, ni planning.
Avant toute observation, un jour d'apports qui atteignent la capacité fait
partir la jauge pleine. Restent à valider avant le code : la moitié de la
profondeur au premier stade, la RFU des abris sans analyse, les seuils des
cultures sensibles, le départ de la jauge en début de saison. Contrats
`docs/soil-reserve-contract.md` et `docs/crop-water-need-contract.md`,
sections datées ; écrits en Opus 5.5.

Ne changent pas : D-003, D-006, D-010, D-028, D-045 ; D-041 hors la
consommation, l'abri sans analyse et la culture sans profondeur ; D-046 hors
la correction des cailloux.

## D-048 — L'assistant fusionne lui-même les PR, une à la fois et dans l'ordre

Décision du 30 octobre 2026, prise par le porteur : « Il vaut mieux qu'à
partir de maintenant, tu fusionnes les PR toi-même dans le bon ordre. Ça
m'évitera d'en oublier et il n'y a pas de plus-value à ce que je les fusionne
moi-même à la main. rajoute ça dans les consignes, dans la façon de
travailler », puis « Oui, vas-y » pour l'inscrire dans le dépôt. Elle remplace
la règle d'`AGENTS.md` qui réservait la fusion au porteur, et étend à toutes
les PR l'exception que D-042 faisait pour le seul lot de dépendances du 27
octobre 2026.

L'assistant fusionne une PR seulement quand elle est prête : jobs
« Application », « Workers Cloudflare » et « Parcours navigateur » verts,
branche à jour avec `main` et sans conflit, contrôles réels collés dans sa
description. Une seule à la fois et dans l'ordre : la suivante attend que le
déploiement de la précédente soit vérifié job par job (D-016). Il ne contourne
jamais la protection de `main` ; il ne fusionne jamais une PR Dependabot
seule, ni une PR qui attend une décision du porteur. Il fusionne depuis sa
propre session, jamais par le `gh` du poste du porteur. Chaque fusion est
annoncée au porteur en une ligne, avec le lien. Le reste ne change pas : rien
ne démarre sans son « vas-y », et le jugement des recettes, la fermeture des
points ouverts et la clôture des sous-tranches restent à lui (D-014). La PR
qui inscrit cette décision est la dernière que le porteur fusionne lui-même.

Ne changent pas : D-013, D-014, D-016, D-026 ; D-042, désormais comprise dans
celle-ci.

## D-049 — Le modèle et l'effort suivent la roadmap ; un écart se demande avant

Décision du 30 octobre 2026, prise par le porteur après qu'une conversation a
été lancée avec un réglage inférieur à celui de la roadmap : « je veux
absolument que tu respectes, que tu fasses gaffe à utiliser le bon effort.
Donc vérifie d'abord sur la roadmap où on en est. Et si jamais tu penses qu'il
est vraiment nécessaire de ne pas suivre la recommandation de la roadmap, tu
me poses la question d'abord. […] Ajoute ça dans les instructions ».

Avant toute conversation ou tâche, l'assistant lit dans `docs/ROADMAP.md` la
colonne « Modèle · effort » de la sous-tranche visée, jamais de mémoire, et
règle la session exactement dessus. Jamais un réglage inférieur ; tout écart
se demande au porteur avant de commencer, jamais après. Une conversation qui
reprend vérifie son réglage et s'arrête s'il ne respecte pas la roadmap. Seul
le porteur change le modèle ou l'effort, en le nommant. La règle figure aussi
au point 5 des instructions du projet.

Ne changent pas : la grille de la roadmap et ses quatre critères (révision
du 20 septembre 2026).

## D-050 — Les alertes météo : critères de l'exploitation sur la prévision, une alerte par jour visé

Décision du 30 octobre 2026, prise par le porteur à la relecture du contrat
de la 5 bis (`docs/weather-alerts-contract.md`) : « D'accord pour tout ».

Un critère d'alerte appartient à l'exploitation et porte sur la température
minimale, la température maximale ou la pluie prévues du jour, avec un sens
strict, « en dessous de » ou « au-dessus de », un seuil dans son unité et un
horizon de 1 à 7 jours, 3 par défaut. Il est évalué après chaque écriture de
prévisions, jamais sur une valeur absente (D-003). Une seule alerte part par
critère et par jour visé ; elle est enregistrée et ne change plus (D-006). Le
vent n'est pas offert au départ. Les températures prévues sont conservées par
une migration additive (D-018). La notification dit toujours « prévue » et
son clic ouvre la météo de la semaine du jour visé. L'alerte est une
information : elle n'entre ni dans le besoin, ni dans l'objectif, ni dans le
planning (D-010, D-028).

Ne changent pas : D-003, D-006, D-010, D-018, D-028 ; le contrat du Worker
Web Push, que le code complétera d'une route d'envoi immédiat.

## D-051 — Replanification : six règles de cadrage tranchées par le porteur

Décision du porteur de projet du 30 octobre 2026 à 21 h 19, à la lecture du
contrat `docs/replanning-contract.md` (cadrage de la 3.7), écrit le jour
même avant tout code : « Je suis d'accord avec toutes tes suggestions. » Il
en est le validateur agronomique (D-014).

1. Le plan de la semaine courante se recalcule de lui-même, côté serveur,
   pour la seule exploitation concernée, après chaque événement d'une liste
   fermée : irrigation planifiée, démarrée, saisie après coup, terminée,
   partielle ou annulée ; pluie au pluviomètre ; niveau de réserve observé
   ou débit appliqué ; limite journalière ; objectif, seuil, priorité,
   besoin manuel, arbitrage ; matériel posé, retiré, reposé ou réglé ;
   proposition refusée. L'événement est enregistré quoi qu'il arrive au
   calcul ; le déclencheur est nommé. Une proposition reproduite à
   l'identique garde son identité.
2. Sur un arrosage validé encore à venir, le moteur calcule une dose utile
   avec ses propres règles, sans compter l'arrosage lui-même ni ceux qui le
   suivent, et suggère « Annuler » sous la dose minimale R4, « Réduire »
   quand l'écart atteint cette dose, rien en dessous ; il n'allonge jamais ;
   rien n'est appliqué sans le geste du maraîcher (D-028).
3. Une limite journalière posée après coup fait suggérer la réduction des
   arrosages validés du jour jusqu'à la limite, priorité basse d'abord, puis
   normale, puis haute, même fraction dans le niveau entamé.
4. Une irrigation planifiée non démarrée 30 minutes après son heure est
   « en retard » (réglage nouveau R14, par exploitation) ; son eau compte
   jusqu'à la fin de son créneau, puis elle est « non faite » et replacée
   par le calcul suivant ; le logiciel ne l'annule jamais.
5. Deux notifications seulement, par le Worker existant : le retard, et la
   suggestion du calcul du matin sur un arrosage des prochaines 24 heures,
   une par calcul, jamais après un geste fait à l'écran.
6. La recette réelle se fait dès la mise en ligne, sur les arrosages réels
   complétés d'événements fabriqués sur les données expérimentales remises
   en état, sur son « vas-y » le jour même.

Le moteur lit les refus de la semaine (D-030, point ouvert 31) : première
PR de la 3.7. Ne changent pas : D-003, D-006, D-010, D-024, D-025, D-028,
D-030, D-037, D-038, D-040, D-044 ; le contrat du Worker Web Push. Le code
commence à son tour, en Fable 5.1 · Très élevé (D-049).

## D-052 — Les cas de pénurie de la 3.9 : quatre règles précisées, recette finale en pénurie fabriquée sur la ferme

Décision du 30 octobre 2026, prise par le porteur à la lecture des huit
questions du contrat de la 3.9 (`docs/shortage-contract.md`) : « d'accord
avec tout. »

En pénurie, un arbitrage validé (3.4) s'impose au plan comme un jeu de parts
réservées : chaque allocation est réservée à sa planche, sans redistribution
entre planches, et l'eau qu'une planche allouée ne peut pas recevoir reste
non attribuée, l'écran le dit. Le budget d'une chaîne d'eau annoncé à l'écran
retire d'abord le manque sous le minimum de sécurité, et la ligne de budget
montre la part visée et la part placée, par niveau de priorité ; ce que le
moteur place ne change pas. Sous la conduite « report », les planches
reportées ne passent devant les autres qu'au calcul qui suit un événement ;
sans événement, le calcul reproduit le précédent. Le dernier jour de la
semaine, une part sous la dose minimale est placée tant qu'une plage reste,
comme hors pénurie. La recette finale de la tranche 3 se joue en pénurie
fabriquée sur la ferme réelle — les trois conduites, la restriction,
l'arbitrage, la validation et le refus, une fois chacun —, données remises
en état par l'écran, sur le « vas-y » du porteur le jour même, les priorités
posées par lui ce jour-là ; le jugement reste le sien. R2 et R9 restent des
informations en pénurie ; entre abri et plein champ à priorité égale, aucune
règle nouvelle : les priorités du maraîcher font la différence. Aucune règle
agronomique n'est inventée ; chaque précision se code dans une PR `fix/` à
part, test rouge d'abord, contrat du planning précisé avant.

Ne changent pas : D-024, D-025, D-030, D-033, D-035, D-037, D-038, D-040,
D-044, D-051 ; la garde de la réserve ; la restriction en mètres cubes par
jour ; les priorités, celles du maraîcher (« décider d'une priorité :
jamais », D-024).

## D-053 — La réserve du sol relue : seuils aux deux tiers, profondeurs de toutes les cultures, jauge continue sans culture

Décision du 31 octobre 2026, prise par le porteur en relisant le contrat de
la réserve du sol (5 ter, `docs/soil-reserve-contract.md`) question par
question, sur les recommandations de l'assistant, avant tout code ; « oui à
toutes tes recommandations », sauf là où il a tranché autrement, cité
ci-dessous.

Les seuils de déclenchement se calculent sur une part de référence de la
réserve utile de 2/3, celle du CRIIAM, au lieu de 0,5 : « pars du principe
que le CRIIAM donne les protocoles les plus pratiques et éprouvés donc
prenons les 2/3 » ; elle s'enregistre avec l'analyse, modifiable si le
laboratoire en indique une autre ; la RFU de la ferme reste 62 mm/m au
laboratoire, 51 mm/m après les cailloux. La part utilisable p du tableau 22
de la FAO-56 vaut pour toutes les cultures qui en ont une, fixe ; le poireau
et le chou kale prennent la valeur de leur famille, 0,30 et 0,45 ; une
culture sans valeur prend 0,5. Les profondeurs racinaires des vingt cultures
de référence absentes de la fiche ITAB viennent d'une recherche documentaire
faite le même jour à sa demande, la méthode de Geisenheim surtout : milieu
de la fourchette des sources, arrondi aux 5 cm inférieurs, la valeur ITAB de
la courgette quand les sources se contredisent ; pas de profondeur réduite
sous abri pour l'instant. La moitié de profondeur au premier stade est
confirmée, sauf le poireau, la moitié pendant 30 jours, et l'asperge et le
fraisier, jamais. Un abri sans analyse prend la RFU de sa parcelle sans
mention, « la RFU vaut pour la parcelle » : la mention « non mesuré » de
D-047 disparaît. Le curseur de parcelle ne règle plus que les jardins de
plein champ ; le curseur garde sa plage de 0 à 100 %, avec les repères sec,
frais, humide et détrempé.

Sur un complément qu'il fournit, préparé avec un autre assistant, la jauge
ne s'arrête plus sur une planche sans culture : elle suit le modèle de sol
nu de la FAO-56 (chapitre 7), en deux compartiments, avec pour la ferme
14 mm d'eau évaporable et 7 mm d'eau facilement évaporable, et six états de
surface — nue, bâchée imperméable ou perméable, paillée, engrais vert par
stade, enherbée — dont les coefficients de départ sont des hypothèses qu'il
juge « suffisamment justes pour être utilisées en pratique », réglables par
l'utilisateur. Relu contre le dépôt, le complément contredisait trois
décisions : la jauge reste inconnue au départ et sur un trou de données
(D-003), au lieu de partir de 50 % ; le curseur reste, au lieu de quatre
niveaux ; le conseil d'arrosage avant plantation, qu'il faisait entrer dans
les priorités, est écarté par le porteur : « ne l'affiche pas » (D-047 tient).
Deux erreurs du complément sont corrigées en écrivant. Une jauge inconnue
repart aussi par un jour d'apports qui remplit la planche. Le contrat règle
aussi le seuil d'une planche à plusieurs cultures, le jour du seuil donné par
la jauge prévue, l'arrêt avant récolte quand le Kc vaut 0, la pluie sous
paillage plastique, comptée en entier avec une part réglable, et les
irrigations prévues comptées par la règle du planning. Les choix faits en
écrivant le contrat le 27 octobre sont confirmés, sauf le curseur de
parcelle. Les sept précisions faites en écrivant cette révision — la
traduction d'un état du plein dans les deux compartiments du sol nu, le
redémarrage d'une planche nue inconnue, l'absence de seuil sans culture hors
engrais vert, la moyenne du jardin, la dépose d'une bâche imperméable, les
réglages du sol nu par parcelle et des états de surface pour l'exploitation,
l'enherbée sans seuil — et la valeur du chou kale lui sont soumises avant la
fusion : « ok pour le chou kale, ok pour les précisions ».

Ne changent pas : D-003, D-006, D-010, D-028, D-044, D-051 ; D-041, D-046 et
D-047, hors les points ci-dessus. Relu en Opus 5.5 · Très élevé, au réglage
du domaine de la 5 ter ; rien de codé.

## D-054 — Le besoin par culture et par stade : relecture du porteur, dates de stade, espèces, pas de mode automatique

Décision du 31 octobre 2026, prise par le porteur à la relecture du contrat
`docs/crop-water-need-contract.md` (5 quater, D-045), question par question
sur des cartes de décision, avec une recherche documentaire demandée par lui
pour chiffrer ce qui n'avait pas de source. Il rappelle que le logiciel
servira à d'autres fermes : chaque règle vaut pour toutes les cultures, même
celles qu'il ne cultive pas.

Les dates de stade par défaut suivent la règle stricte — chaque stade
phénologique prend, dans l'ordre, une phase de la FAO-56 —, corrigée culture
par culture par les sources trouvées ; la tomate garde une reprise de
15 jours et fleurit son 3e bouquet au jour 30. La mi-récolte, la première
récolte et « en cours de récolte » se calent sur les semaines de récolte
d'Ouvre ta ferme, que le logiciel lit déjà. L'ail, l'oignon et la fin de
tubérisation de la pomme de terre se comptent à rebours depuis la récolte.
Un délai de levée par culture, modifiable (pomme de terre 25 jours ; semis
direct au tableau de Harrington à 15 °C ; ail d'automne 30 jours ; plants
repiqués 0), décale les stades comptés depuis la levée, le Kc du premier
stade s'appliquant pendant le délai. Les dates sont fixes, un jeu par saison
quand la FAO en donne plusieurs, choisi selon le mois d'implantation. Les
cultures pluriannuelles — artichaut, asperge, fraisier — suivent un
calendrier fixe de stades dans l'année, modifiable par chaque ferme ; le
porteur l'a préféré au repère déclaré chaque année que recommandait
l'assistant. Elles restent sur leur planche après leur dernière récolte
jusqu'à la fin de leur calendrier, pour l'ETM, la proposition et la jauge de
la réserve du sol : **exception à D-022 pour elles seules**.

La correspondance des espèces se fait par espèce d'Ouvre ta ferme, avec une
exception possible par série (l'aillet de l'espèce « Ail » suit l'oignon
vert de la FAO) ; une analogie est permise et signalée ; les fleurs et les
aromatiques vivaces restent sans référence. La table des 79 espèces de la
ferme est validée. K_abri vaut 0,8 au départ pour tous les abris, réglable ;
le paillage plastique multiplie le Kc par 0,9 ; le lissage des passages de
stade est désactivé par défaut ; l'option d'ombrage est codée, désactivée par
défaut et affichée comme hypothèse — choix du porteur contre la
recommandation de l'assistant de la reporter. Le **mode automatique n'est pas
retenu** : la proposition n'entre dans le besoin que par l'adoption à la main.
Les sept choix faits en écrivant le contrat sont confirmés. Une date sans
source s'affiche comme estimation. Contrat écrit et relu en Opus 5.5.

Ne changent pas : D-003, D-006, D-010, D-019, D-024, D-039, D-045, D-047 ;
D-022 hors l'exception des cultures pluriannuelles.

## D-055 — Le modèle Fable est interdit, Opus 5.5 · Max le remplace

Date : 1er novembre 2026. Décision du porteur, après l'avis d'un développeur
chevronné de son entourage : Fable ne sert à rien de plus pour ce projet.

**Décision.** Le modèle Fable est interdit dans ce projet, pour toute tâche
(coordination, fils, code, documents). Toute tâche prévue en Fable 5.1 passe en
Opus 5.5 · Max, quel que soit l'effort prévu avant (Fable 5.1 · Max et
Fable 5.1 · Très élevé deviennent tous deux Opus 5.5 · Max), sur le mot du
porteur du 1er novembre 2026. Sonnet 5.5 · Moyen reste la grille du travail
sans code. Aucun effort n'est abaissé : la règle de D-049
(lire la ligne de la roadmap, appliquer exactement, demander avant tout écart)
reste en vigueur.

**Lignes concernées dans `docs/ROADMAP.md`.** La légende et la grille des cinq
cas ; la 3.9 (Opus 5.5 · Max) ; le domaine de la 5 quater (Opus 5.5 · Max) ;
les lignes à venir de la tranche 4 (4.2, 4.3, 4.6, 4.7 : Opus 5.5 · Max) ; `docs/shortage-contract.md`, modèle du code et de la recette.

**Ce qui ne change pas.** Les lignes terminées et l'historique daté (journal des
changements, états passés, contrats déjà exécutés) gardent le modèle réellement
employé : ils sont un relevé, pas une consigne. Les règles agronomiques,
l'isolation des données et l'identité gardent leur exigence : seul le modèle
change, pas la rigueur.

Ne changent pas : D-049.

## D-056 — Les profondeurs racinaires par stade (5 ter)

Date : 3 novembre 2026. Décision du porteur, sur son complément « profondeurs
racinaires par stade », sept questions tranchées une à une (section datée de
`docs/soil-reserve-contract.md`).

**Décision.** La profondeur racinaire de la jauge est une profondeur par stade
pour toutes les cultures, construite par une règle (0,15 m pour un semis,
0,20 m pour un plant ou un tubercule, croissance linéaire jusqu'à la fin de
« début + développement » de la FAO-56, maximum au milieu de la fourchette
ITAB sinon petite valeur FAO-56, lecture au milieu du stade, arrondi à 5 cm),
à vérifier à la tarière. Elle remplace la moitié de profondeur au premier
stade de D-053. Tomate 0,65 m, courgette et concombre 0,50 m (inversion
corrigée) ; melon et asperge plafonnés à 0,60 m ; plafond de sol facultatif
par parcelle ; même règle pour les cultures que le complément ne nomme pas.

**Ce qui est gardé.** Le seuil de déclenchement de D-053 (part de référence
2/3), contre la formule `min(1 ; p / 0,5)` du complément (la formule inversée
de D-047) et contre la méthode de la synthèse FRAB (RFU = p × RU). La
répartition de fin de culture du scénario 28.

**Pour la 3.9 et un contrat à part**, notés sans être traités : restrictions
horaires, priorités par stade critique, ombrage, efficience, temps
d'irrigation.

Ne changent pas : D-041, D-046, D-047, D-053 (hors la moitié de profondeur et
les profondeurs de la table).

## D-057 — Le stade déclaré recale le calendrier ; la culture reste jusqu'à la plus tardive de ses récoltes (5 quater)

Date : 5 novembre 2026. Décision du porteur, en cours de code du domaine de
la 5 quater (PR 1), sur deux questions posées une à une sur des cartes de
décision, à 23 h 27 et 23 h 30 (heure de Paris) ; les deux réponses suivent
l'option recommandée. Section datée de `docs/crop-water-need-contract.md`.

**Le stade déclaré recale le calendrier.** Un stade déclaré commence le jour
dit ; les stades suivants arrivent seuls, décalés d'autant s'ils se comptent
depuis la plantation ou la levée, à leur date s'ils dépendent de la récolte
ou du calendrier. Remplace « le stade dure jusqu'à la déclaration suivante »
du contrat, qui aurait figé une culture dans son stade déclaré.

**La culture reste sur sa planche jusqu'à la plus tardive de ses
récoltes.** Pour la 5 quater et la jauge de la 5 ter, jusqu'au dimanche de la
plus tardive de ses semaines de récolte, réalisées ou attendues ; la
mi-récolte et les dates J-n se comptent depuis ce dimanche. Le suivi par
série garde sa règle (D-022 : la dernière réalisée, sinon la dernière
attendue).

**Précisions faites en codant**, consignées dans le contrat : une
déclaration vaut à partir de son jour ; un stade suivant dont la date est
déjà passée au jour déclaré ne vient pas seul ; pour un même stade, la
dernière déclaration enregistrée remplace les précédentes ; la déclaration
d'une planche prime dès qu'elle est en vigueur ; une déclaration ne vaut que
pour sa culture de référence et, sur un calendrier, pour son cycle ; le
trapèze de la FAO se recale par son origine ; une proposition partielle ne
s'adopte pas (D-003) ; quinze en tout. Trois scénarios ajoutés (22 à 24).
Codé en Opus 5.5 · Max, conforme à la ligne de la roadmap.

Ne changent pas : D-003, D-006, D-010, D-022 pour le suivi par série,
D-039, D-054 hors les deux points ci-dessus.

## D-058 — Les alertes météo par culture : gel selon l'espèce, arrêt d'arrosage avant récolte, aspersions à reconsidérer (5 quinquies)

Date : 6 novembre 2026. Décision du porteur, à la relecture de
`docs/weather-crop-alerts-contract.md` ; les trois premières questions sur
cartes, les huit autres acceptées sur recommandation, et un curseur ajouté par
lui.

- **Gel** : un seul seuil par espèce, les stades ignorés ; marge de 3 °C pour
  les cultures sensibles (dégâts dès −2 °C ou plus haut) et de 2 °C pour les
  rustiques, la prévision étant donnée à 2 m ; laitue et mesclun à −2 °C ;
  les cultures à plusieurs valeurs à la plus prudente (chou pommé −3, chou-fleur
  0, pomme de terre 0, brocoli et chou-rave −2) ; sans seuil, pas d'alerte et
  une saisie par la ferme (fraisier, asperge, fleurs, aromatiques) ; cultures
  sous abri alertées avec rappel de la prévision extérieure ; une notification
  par jour visé.
- **Curseur de microclimat** : un décalage global de −5 à +5 °C par demi-degré
  sur tous les seuils d'alerte de gel, réglé par l'exploitation.
- **Arrêt d'arrosage avant récolte** : ail 15 j, pomme de terre 14 j, courges
  10 j, melon 7 j, comptés depuis le premier jour de la première semaine de
  récolte attendue ; réglables par la ferme.
- **Aspersions à reconsidérer** : créneaux de jour sous abri, jugés au jour
  (maximale sous 24 °C ou rayonnement moyen sous 400 W/m²), réglables ; la
  partie « mildiou du soir » est écartée.
- Information seulement (D-010, D-028) ; aucun appel de plus vers OTF.

Ne changent pas : D-003, D-006, D-010, D-028, D-050.

## D-059 — Le seuil d'arrosage réglable entre dans la 5 ter (rouvre D-053)

Date : 6 novembre 2026. Décision du porteur, au placement des idées de la
comparaison avec Tlaloc : l'exploitant règle lui-même le seuil de
déclenchement de la jauge (« conseiller quand la réserve facile passe sous
X % »), en plus de la part p par culture. D-053 fixait ce seuil à la formule
du CRIIAM : elle devient la valeur par défaut. Les bornes et l'écran sont à
écrire dans le contrat de la 5 ter avant son code ; rien n'est codé.
Même placement validé : pastille « eau arrosée en trop » juste après la 5 ter ;
mode simple ou complet et aide contextuelle dans la 3.8 ; recherche
documentaire sur un catalogue de matériel maintenant, code après la 3.8 si les
données existent ; créneaux protégés nommés juste avant la 3.9 ; démo guidée
en tête de la Tranche 4.

## D-060 — Mandat du porteur : quatre chantiers réalisés seuls, chaque question tranchée par l'option recommandée ; le domaine de la 5 ter

Date : 6 novembre 2026, 15 h 07. Décision du porteur : « Ok, maintenant je
veux que tu réalises automatiquement et exceptionnellement toutes les tâches,
la 1, la 2, la 3, la 4, et si tu as des questions à me poser, tu vas y
répondre toi-même en choisissant ta réponse recommandée. » Les quatre tâches
sont les chantiers suivants de l'ordre d'exécution (`docs/ROADMAP.md`,
section 2) : la 5 ter avec le seuil d'arrosage réglable (D-059), la pastille
« eau en trop », la 5 quinquies (D-058) et la refonte ergonomique. Le mandat
ne vaut que pour elles : la 3.8 reste à faire avec lui. Il ne lève aucune
règle de sécurité : Ouvre ta ferme en lecture seule, jamais plus de quatre
requêtes par seconde, aucun secret exposé, Fable interdit (D-055), logiciel
multi-fermes ; une action qui ne pourrait se faire qu'irréversiblement ou
hors de ces règles l'attend. Les PR se fusionnent une à une, après le
déploiement vérifié de la précédente ; chaque fusion lui est annoncée. Les
recettes réelles sur la ferme se font plus tard, avec lui.

Chaque choix fait sur ce mandat est consigné dans le contrat du chantier et
résumé ici ; il reste modifiable par le porteur à sa relecture.

**5 ter, le domaine (PR 1).** Le seuil d'arrosage réglable (D-059) prend deux
modes : le seuil selon la culture de D-053 par défaut, ou un % du plein réglé
par l'exploitation, de 20 à 80 % par pas de 5 %, 50 % proposés, appliqué à
toutes les planches cultivées et aux engrais verts, le seuil selon la
culture restant rappelé à côté ; la formule mixte `capacité × ((1 − f) +
X × f)` est écartée, plus difficile à lire au champ. Dix-sept précisions,
détaillées dans `docs/soil-reserve-contract.md` (« Précisions faites en
codant le domaine ») : une seule PR pour le domaine ; la pluie d'un jour
passé et d'aujourd'hui ; « maintenant » ; une culture sans ETM rend la jauge
inconnue ; sans RFU, la jauge est inconnue ; la valeur propre d'un jardin
porte tous les champs ; l'origine d'une profondeur progressive ; la
profondeur de référence d'une planche sans culture ; l'engrais vert non
déclaré suivi comme levé ; un état de surface finit à l'arrivée d'une
culture ; l'irrigation compte sous une bâche imperméable ; le départ par un
apport un jour de trou de données ; la formule des jours avant le seuil ; la
dose au-delà de ce que le sol retient ; le jour du seuil atteint et la dose
conseillée ; la moyenne du jardin ; les bornes des saisies.

**5 ter, la persistance (PR 2).** Migration additive 0025, sept tables ;
aucune valeur de sol écrite par la migration, chaque ferme saisit la sienne ;
jeu commun de trente et un profils racinaires valable depuis toujours, une
ferme le révise par un profil entier daté ; la patate douce sans profil, le
céleri sans profondeur (30 cm proposés avec avertissement) ; le navet de
0,15 à 0,70 m en 40 jours ; fraisier l'année de plantation et chou de
Bruxelles laissés en note du profil ; l'état du jour gardé pour les jours
passés seulement, remplacé à chaque recalcul. Dix précisions dans le contrat
(« Précisions faites en codant la persistance »).

**5 ter, l'écran (PR 3), découpé en trois.** 3a, les réglages du sol ; 3b, le
bloc « Réserve du sol » par jardin ; 3c, les profils racinaires dans la page
« Coefficients culturaux ». Pour la 3a : un pli « Réglages du sol » dans le
bloc « Réserve du sol » de la section « Planning de la semaine » ; seules
les parcelles et les jardins de la saison affichée ; la RFU du sol calculée
pendant la saisie ; l'avertissement de vraisemblance montré sans empêcher
l'enregistrement ; la part de référence en fraction ou en décimal ; la date
de l'analyse dans la source, « À partir du » aujourd'hui par défaut ; la
valeur propre d'un jardin dans un pli qui part de celle de sa parcelle, le
retour à la valeur de la parcelle laissé pour la recette ; le seuil en deux
choix, « Selon la culture » par défaut. Huit précisions dans le contrat
(« Précisions faites en codant l'écran des réglages »).

**5 ter, PR 3b, le bloc par jardin.** Un pli par jardin ou abri sous le
curseur de sa parcelle, un pli par planche ; un départ suivi depuis la
dernière observation de chaque jardin, sinon trente jours en arrière, jamais
plus de quatre-vingt-dix ni avant la saison ; la jauge pour la saison en
cours seulement ; la pluie d'un jour passé sans réanalyse comptée sur la
prévision enregistrée, estimée ; les irrigations réalisées sur leurs heures
réelles, les planifiées par la règle du planning, les propositions tant
qu'elles sont proposées ; le curseur « maintenant » ou « plus tôt,
aujourd'hui ou hier » ; les jours avant le seuil dits avec leur rythme ; la
réserve épuisée mise en évidence ; l'état de surface déclaré à partir d'un
jour ; un jour qui manque nommé sur une planche observée. L'état du jour
enregistré et la dose au-delà de ce que le sol retient passent dans une 3d.
Neuf précisions dans le contrat (« Précisions faites en codant le bloc par
jardin »).

**5 ter, PR 3c, les profils racinaires.** Un bloc « Racines et part
utilisable » dans la carte de chaque culture utilisable ; le jeu commun
rappelé à côté de chaque valeur de la ferme qui en diffère ; un profil
entier enregistré à la fois, source obligatoire, à partir d'un jour ;
« Reprendre le jeu commun » enregistré comme un profil de la ferme aux
valeurs communes, un retour qui suivrait le jeu commun laissé pour la
recette. Cinq précisions dans le contrat (« Précisions faites en codant les
profils racinaires »).

**5 ter, PR 3d, l'état du jour et la dose au-delà du sol.** L'état des sept
jours d'avant enregistré chaque matin après l'ETM, jamais aujourd'hui ni un
jour prévu, sans que la jauge le relise ; la dose au-delà de ce que le sol
retient dite sous chaque proposition encore proposée, planche par planche,
calculée au chargement de la page, rien sous un dixième de mm ni sur une
jauge inconnue. Deux précisions dans le contrat (« Précisions faites en
codant l'état du jour et la dose au-delà du sol »).

**La pastille « eau arrosée en trop ».** Elle compte l'eau d'irrigation
perdue en drainage selon la jauge, et non l'irrigation au-delà de
l'objectif saisi ; le drainage d'un jour partagé entre la pluie et
l'irrigation au prorata de leurs mm ; les sept derniers jours passés, sans le
jour en cours ; en mm par planche et en m³ selon la surface mouillée, « au
moins » quand une surface manque ; une planche de jauge inconnue dite à
part ; en tête du bloc « Réserve du sol », sans envoi. Sept points dans le
contrat (« La pastille de l'eau arrosée en trop »).

**5 quinquies, le domaine (PR 1).** Chaque espèce se rattache à une entrée du
jeu commun, avec exception par série, par une révision datée qui porte aussi
le seuil de dégâts propre à la ferme ; sans révision, l'espèce est « à
rattacher » et figure dans « Cultures sans seuil de gel ». La clé d'une
alerte de gel est le sujet, la révision qui donne son seuil et le jour
visé : une correction repart de zéro, le curseur de microclimat n'y entre
pas. Une culture compte du lundi de sa semaine d'implantation au dimanche de
sa dernière semaine de récolte. Une notification de gel nomme les espèces,
et rappelle que la prévision est celle de l'extérieur quand une série
présente est sous abri. Le séchage part de la plus précoce des semaines de
récolte encore attendues et s'arrête dès qu'une récolte est réalisée. Le
scénario 11 du contrat est joué en 2026, ses jours étant faux en 2027. Le
jour des aspersions se calcule comme pour l'ET0 (FAO-56), sans la
réfraction. Les trois alertes sont actives par défaut, horizon 3 jours,
curseur à 0. Huit précisions dans le contrat (« Précisions faites en codant
le domaine »).

**5 quinquies, la persistance et l'envoi (PR 2).** Migration additive 0026 :
cinq tables et l'énergie solaire prévue du jour ; les saisies de la ferme en
révisions immuables (D-006), le jeu commun dans les migrations. La ligne
« Courge, courgette » devient deux entrées au même seuil, le délai de
séchage n'allant qu'à la courge ; six entrées sans seuil. Une seule table
d'alertes, deux clés uniques, l'alerte enregistrée avant l'envoi avec les
valeurs appliquées et le texte annoncé. Aucun appel nouveau vers Ouvre ta
ferme : le dernier instantané en cache, quel que soit son âge. Le gel et les
aspersions après chaque écriture de prévisions, les aspersions aussi après
un plan recalculé, le séchage chaque matin même sans météo. Les créneaux
jugés sont les propositions d'aspersion de la semaine pas encore
commencées ; le soleil à la position du lieu météo. Huit précisions dans le
contrat (« Précisions faites en codant la persistance et l'envoi »).

**5 quinquies, l'écran (PR 3).** L'encart « Alertes cultures » suit celui des
alertes météo ; réglages, seuils, cultures sans seuil et délais dans des
plis, échéances et historique ouverts. Les cultures présentes de la table
sont celles de la saison présentes aujourd'hui ou à venir ; la table est une
liste, une culture par ligne. Un même formulaire rattache ou corrige, propose
pour une espèce à rattacher l'entrée du jeu commun du même nom sans
l'enregistrer, et n'offre le choix d'une série que quand il y en a plusieurs.
Les échéances se calculent à l'affichage sur les prévisions conservées,
sans rien envoyer ; un réglage vaut à la prochaine prévision lue. Le curseur
de microclimat est une glissière qui dit si les alertes partent plus tôt ou
plus tard. Huit précisions dans le contrat (« Précisions faites en codant
l'écran »).

**Refonte ergonomique, premier temps (R1).** Les jetons de la charte sont
déclarés dans `app/globals.css` sous les noms de la maquette, les anciens
gardés en alias ; trois ajoutés faute de valeur prévue (`--line-soft`,
`--line-strong`, `--shadow-raised`). Les trois polices variables sont
hébergées par le module, réduites au latin, avec leur `OFL.txt` (SIL OFL
1.1), sans appel à un tiers. Texte courant à 13 px aux deux largeurs :
l'objectif « ≥ 13 px » de la charte l'emporte sur ses 12 px au téléphone.
Gris teintés de vert ramenés à leur rôle, blocs blancs sans bordure sur la
feuille, rayon unique de 0,75 rem, deux ombres. Neuf précisions dans
`docs/charte-module.md` (« Application »).

**Refonte ergonomique, deuxième temps (R2).** Chaque bouton prend l'une des
quatre sortes de la charte selon l'habillage qu'il avait : les boutons bleus
deviennent verts, le bleu quitte les boutons. Les cibles de 44 px au
téléphone ne changent pas. Au téléphone, les trois onglets de la saisie
restent empilés avec leur ligne d'explication, l'onglet choisi marqué d'un
trait vert à gauche plutôt que de la pilule de la maquette. Les tableaux
gardent leur passage en liste sous 761 px. Les deux tuiles de pluie sont en
bleu eau (une classe `is-water`, seul changement du code de l'écran). Cinq
précisions dans `docs/charte-module.md`.

**Refonte ergonomique, troisième temps (R3).** Les ambres, rouges et bleus
des messages deviennent les jetons d'état de la charte ; l'erreur et le
bouton destructif partagent un même fond rose. Les autres bleus deviennent
le bleu eau. Les feuilles du plan gardent leurs couleurs, qui disent une
nature et non un état. **La navigation de la charte (menu latéral, barre du
bas) n'est pas construite** : le module est une seule page coiffée par
l'en-tête d'Ouvre ta ferme, et la construire serait réorganiser
l'interface, ce qui revient à la 3.8, hors de ce mandat. Les deux symboles
dessinés deviennent des icônes au trait (`app/irrigation/icon.tsx`) ; le
reste du jeu d'icônes viendra avec les écrans qui en auront l'usage. Cinq
précisions dans `docs/charte-module.md`.

Ne changent pas : D-003, D-006, D-010, D-018, D-028, D-047, D-050, D-053,
D-056, D-057, D-058.

## D-061 — Le calculateur d'irrigation : un assistant de saisie qui enregistre de l'eau reçue, sans changer le moteur

Date : 6 novembre 2026. Le porteur valide le contrat
`docs/irrigation-calculator-contract.md`, écrit sur le cahier des charges
validé le même jour (pas de base de produits, avis de Francis de Nutri-O) et
tranche cinq questions sur la recommandation. Le calculateur produit les
valeurs d'un réglage existant (mm/h, ou profil par distance) ; l'efficacité
(80 % par défaut en aspersion moyenne) s'applique une seule fois, dans le
calculateur, et le profil en cône n'en reçoit pas, sa forme contenant déjà la
perte. Le moteur, D-022 et D-006 ne changent pas : le débit demandé à la
pompe et les volumes restent l'eau reçue sur la surface mouillée ; les faire
suivre l'eau pompée est une décision séparée, écartée de ce lot. Quatre
étiquettes de provenance (calculé, estimé, mesuré, saisi), dans une table
nouvelle ; la correction de pression est facultative et une mesure prime ;
quatre exemples sourcés seulement, MAMKAD, 5022 et 5035 attendant des valeurs
relevées ; goutte-à-goutte à largeur de planche typique par réglage. Code
après la 3.8, avant la 3.9. Rien n'est codé.

Ne changent pas : D-003, D-006, D-018, D-022.

## D-062 — Les créneaux protégés nommés : une plage que le moteur n'utilise jamais, pour tout le matériel

Date : 6 novembre 2026. Le porteur valide le contrat
`docs/protected-slots-contract.md` et tranche sept questions. Un créneau
protégé porte un nom, des jours de la semaine et une heure de début et de fin
(passage de minuit permis, rattaché au jour du début), répétés chaque semaine
pour toute l'exploitation et tout le matériel. Il s'ajoute à la plage R8 sans
la remplacer. Le moteur ne place jamais d'arrosage dedans, sans exception :
prioritaire et pénurie compris (le porteur retient « interdit toujours » et
non l'avertissement recommandé) ; un besoin non servi se lit « non placé »
avec le motif « créneau protégé » et son nom. Un arrosage déjà validé qui y
tombe reçoit la suggestion « Annuler » ou « Réduire » de la 3.7, jamais
annulé sans le geste du maraîcher ; une irrigation réelle ou un ajout à la
main n'est jamais refusé, seulement signalé. Réglage à l'écran, historisé,
sans événement de recalcul (réglage du planning). Aucun créneau au départ.
Code juste avant la 3.9, Opus 5.5 · Max. Rien n'est codé.

Ne changent pas : D-003, D-004, D-006, D-028, R8.

## D-063 — Connexions matériel : station météo, tensiomètres, électrovannes, à cadrer par la recherche

Date : 7 novembre 2026. Le porteur demande d'ajouter au projet la connexion à
des capteurs météo (station locale), la connexion à des tensiomètres et le
pilotage d'électrovannes, et de lancer une recherche documentaire par
fonction pour en déduire une méthode de travail. Elles sont inscrites en
section 6 bis de la roadmap (C1, C2, C3), après la 3.9 et avant la tranche 4,
état « recherche en cours ». Aucune décision de conception : ni matériel, ni
protocole, ni réglage, ni modèle de code ne sont retenus ; chaque contrat
viendra après la recherche, sur validation du porteur. Le pilotage (C3) est un
changement de nature, le module recommandait et n'agissait pas : il ne
s'exécute pas sur la ferme réelle avant un contrat validé, une recette exprès
sur son « vas-y » et des garde-fous écrits. Les mesures entreront comme
mesurées (jamais confondues avec le prévu ou l'estimé) ; la pluie saisie au
pluviomètre garde sa primauté et la réserve du sol reste une information tant
qu'une décision nouvelle n'en dispose pas autrement. Rien n'est codé.

Ne changent pas : D-003, D-006, D-041, D-047.

## D-064 — Le pilotage des électrovannes : un ordre confirmé par le porteur, fermé par le matériel, quinze règles de sécurité

Date : 7 novembre 2026. Le porteur décide que le module doit piloter des
électrovannes (6 novembre), avec **sa confirmation à chaque ouverture**
(architecture B, 7 novembre), et que les premiers essais se font sur un relais
local de la famille Shelly Gen2 en banc hors ferme, sans budget fixé ni achat.
Le contrat (`docs/valve-control-contract.md`) pose une interface commune de
quatre actions, sept états, quinze règles de sécurité testables (fermeture
portée par le matériel, plafonds saisis jamais devinés, « Fermer » toujours
possible, commande manuelle prioritaire, journal immuable, secrets saisis par
l'utilisateur, pilotage suspendu au démarrage) et un simulateur de pannes que
tout adaptateur réel doit passer. Quatre questions tranchées sur la
recommandation, selon la consigne du porteur du 7 novembre : aucun
contournement des créneaux protégés (D-062), ordre refusé si le débit est
inconnu, alerte météo affichée sans bloquer, confirmation au moment de
l'ouverture sans ordre différé. Le mode automatique reste écarté (D-054).
Rien n'est codé, acheté ni exécuté sur la ferme réelle ; le code, le montant
du banc, la passerelle et la recette à la ferme restent à valider par le
porteur.

Ne changent pas : D-003, D-004, D-006, D-022, D-028, D-054, D-062.

## D-065 — Le banc commun de saisons rejouées avec Tlaloc : après la 3.9, en recherche, sans code

Date : 7 novembre 2026. Le développeur de Tlaloc a répondu favorablement à la
proposition d'un banc commun (mêmes saisons rejouées dans les deux moteurs,
indicateurs définis de la même façon, sans désigner de gagnant). Le porteur
décide de l'inscrire à la feuille de route **après la 3.9, en recherche** : un
contrat écrit d'abord, **aucun code sans son accord**, aucun calendrier ni
promesse à Tlaloc. Les points non agronomiques de la proposition sont tranchés
par l'option recommandée (pluie utile du fichier, réserve facile commune avec
seuil à 50 %, deux passes de prévisions, débit sans limite en première passe).
Notre moteur partant d'un objectif hebdomadaire et non de la jauge, l'origine
de l'objectif rejoué (l'ETM proposée adoptée chaque lundi) sera à trancher au
contrat et dite avec les résultats. Quatre idées sont rangées sans engagement :
archivage des prévisions J+1, formule du tensiomètre pour C2, heures de silence
des notifications, ET0 horaire. Rien n'est codé.

Ne changent pas : D-010, D-041, D-045, D-047, D-054.

## D-066 — Partage des rôles avec Tlaloc : automatisation chez eux, fusion des deux moteurs avant la Tranche 4

Date : 7 novembre 2026. Le porteur s'accorde avec le développeur de Tlaloc pour
répartir les rôles et mettre les ressources en commun. Le porteur termine la
Tranche 3 (mode solo) ; Tlaloc se concentre sur l'automatisation, capteurs et
électrovannes (C1 à C3 confiés à Tlaloc, recherches et contrat C3 conservés) ;
un chantier « fusion des deux moteurs » s'intercale avant la Tranche 4 :
comparaison fine, puis synthèse en un logiciel commun à partir du code de
Tlaloc, qui absorbe le banc commun (D-065). Ergonomie : Tlaloc garde la sienne ;
chez nous, les fonctionnalités se cochent à la connexion et l'interface masque
le reste, intention rattachée à la 3.8 (mode simple ou complet), dont le
contrat reste à écrire. Rien n'est codé ni cadré. Le périmètre de la fusion,
l'accès au code, la propriété et l'hébergement du logiciel commun restent à
trancher par le porteur. Cet accord précise D-063 et D-064 sans les annuler :
le pilotage des électrovannes y reste décrit, mais son exécution est confiée à
Tlaloc. Précisé le même jour par le porteur : la refonte ergonomique livrée
est conservée, le choix des fonctions à la connexion s'ajoute dans la 3.8, et
le contrat C3 est gardé en archive, non codé, et transmis à Tlaloc comme base.

Ne changent pas : D-003, D-041, D-047, D-054, D-062, D-065.

## D-067 — La 3.8 : un seul mode, des fonctionnalités à la carte, affichées et prises en compte

Date : 7 novembre 2026. Le porteur redéfinit la 3.8, décidée le jour même avec
le développeur de Tlaloc : **il n'y a plus de mode simple ni de mode
complet**, mais un seul mode. Le module propose une liste de fonctionnalités à
cocher ; ce qui n'est pas coché n'est **ni affiché ni pris en compte** dans les
calculs, et les données dont une fonctionnalité cochée a besoin restent
affichées et à renseigner (« un logiciel avec un affichage et des
fonctionnalités à la carte »). Ses réponses, une par une : dix cases (Matériel
et placement, Arrosages, Objectifs et besoins, Planning de la semaine,
Ressources et pompes, Réserve du sol, Besoin par culture, Alertes météo,
Alertes cultures, Historique et cumuls ; le calculateur et le pilotage des
électrovannes deviendront des cases quand ils existeront) ; une case décochée
est ignorée et ses données gardées, avec un avertissement ; cocher une case
entraîne celles dont elle a besoin ; le choix vaut pour toute la ferme ; il se
fait à la première ouverture, rien coché d'avance, puis dans « Réglages », et
les fermes qui utilisent déjà le module gardent tout coché avec un bandeau
unique ; une page par case, avec la navigation de la charte ; l'aide
contextuelle est un « ? » par page et une bulle « d'où vient ce chiffre » sur
les chiffres principaux, qui ne recalcule jamais. Les autres précisions (P1 à
P21 du contrat) sont tranchées par la recommandation sur sa consigne écrite
(« répond à toutes les autres questions tout seul en prenant ta
recommandation ») ; il les juge sur le site en ligne. Le même jour à 13 h 47, il
demande que toute la 3.8 soit construite en autonomie jusqu'au déploiement,
chaque question tranchée par la recommandation, sans maquette préalable : il
juge l'ergonomie sur le site en ligne et fait son retour. Contrat :
`docs/feature-selection-contract.md`. La preuve de fin de la 3.8 change : le
choix s'enregistre (migration additive) et les traitements le lisent, donc
« aucune modification dans `lib/` ni `db/` » ne tient plus ; aucune formule,
aucun seuil ni aucune règle d'un contrat existant ne change. Le « mode simple
ou complet » de D-059 et de D-066 est remplacé par ce choix ; le reste de ces
deux décisions tient. Rien n'est codé.

Ne changent pas : D-001, D-002, D-003, D-045, D-051, D-060, D-066 (hors le
mode simple ou complet).

## D-068 — Deuxième passe de la refonte ergonomique, sur une maquette validée, après la 3.8

Date : 7 novembre 2026. À la relecture visuelle de la refonte (R1 à R3, D-060),
le porteur trouve l'ensemble lisible et à son goût, mais ne voit « pas de grosse
différence » avec avant, ni le rapprochement attendu avec la charte d'Ouvre ta
ferme. Vérifié le jour même : les polices et le fond de la charte sont bien en
ligne, mais le module avait déjà un vert presque identique à celui d'OTF, et la
refonte, CSS seul, ne déplaçait rien ; la mise en page, qui fait l'allure
d'OTF, revenait à la 3.8 (menu à gauche, bande de pages au téléphone). Captures
de la même page avant la refonte, après elle et après la 3.8, PR 6 :
`/mnt/project-files/refonte-avant-apres/`.

Le porteur choisit « maquette d'abord, code après la 3.8 », puis valide la
maquette telle quelle (« Oui, comme ça ») : une deuxième passe, **R4**, CSS et
habillage seulement, sur toutes les pages, d'après la page « Matériel et
placement » dessinée à l'ordinateur et au téléphone :

1. plus de bandeau vert foncé sur le plan : chaque parcelle est un bloc blanc
   simple sur la feuille grise, le vert restant aux boutons et au menu ; les
   couleurs des planches (jardin, abri) ne changent pas (R3, point 3) ;
2. moins de cadres dans les cadres : jardins et mesures posés sans bordure ;
3. les étiquettes écrites normalement (« Longueur », « Saison »), en 13 px,
   au lieu de petites majuscules grises ;
4. le titre de la page à la taille de la charte : Bricolage Grotesque 300,
   22,75 px à l'ordinateur, 20 px au téléphone (R1, point 4, l'avait laissé
   de 26 à 36 px) ;
5. au téléphone, la barre du haut anthracite `#373737` de 36 px, avec le nom
   de la ferme, la cloche et l'initiale (charte, point 7) ;
6. d'après la maquette : l'en-tête de l'ordinateur allégé (barre blanche, une
   pastille ronde verte à la place du carré « OTF »), l'état des données d'OTF
   en une ligne sous le titre au lieu d'une carte, les mesures de la planche
   en tuiles vert pâle `#e3f2ee`.

Maquette : canvas « Module d'irrigation à la manière d'OTF »
(https://claude.ai/artifact/G9t1YyQCmPEBNNjeznMasG), sources dans
`/mnt/project-files/refonte-avant-apres/maquette/`. Place : juste après la
3.8, avant la 3.8 bis, un seul chantier de code à la fois (consigne du porteur
du 7 novembre 2026) ; à sa question de la commencer le soir même, il choisit
ensuite d'attendre la clôture de la 3.8, qui touche les mêmes pages. Aucun calcul, aucun texte, aucune page ne change. Preuve
de fin : chaque page comparée à la maquette aux deux largeurs, les tests et
les parcours navigateur verts, la relecture du porteur. Modèle et effort :
Opus 5.5 · Élevé, sur la recommandation, modifiable par lui. Rien n'est codé.

Ne changent pas : D-060, D-067, la charte du module, que R4 applique plus
complètement.

## D-069 — L'audit ergonomique du 7 novembre 2026 : les quatorze points sont retenus et placés avant la 3.9

Date : 7 novembre 2026. L'audit du module en ligne
(`/mnt/project-files/audit-ergonomie/audit-ergonomie-module-2026-11-07.md`)
propose quatorze améliorations, classées par gain et effort. Le porteur répond
qu'il retient les propositions et qu'il veut qu'elles soient faites, puis
demande de les mettre dans la roadmap : elles sont **décidées**, et non des
idées mises de côté.

Place : sous-tranche **3.8 quater**, après la deuxième passe de la refonte
(D-068, #279), la 3.8 bis (calculateur) et la 3.8 ter (créneaux protégés),
avant la 3.9, dont la recette finale porte sur le code terminé. Trois lots :
le premier regroupe les petits points 7, 4, 9 et 11 ; le deuxième le
téléphone (2), la page « Aujourd'hui » (1) et la zone « Fiabilité du calcul »
(3) ; le troisième les points 5, 6, 8, 10, 12, 13 et 14. Modèle et effort sur
la recommandation, modifiables par le porteur : Opus 5.5 · Élevé pour le
lot 1, Très élevé pour les deux autres. Les idées mises de côté n° 1, 3 et 6
sont absorbées. Un contrat court précède les lots 2 et 3 (choix posés un par
un).

Ne changent pas : D-067 (fonctionnalités à la carte, que chaque bloc suit),
D-068 (la deuxième passe), D-052 (la 3.9 et son contrat).

## D-070 — Le calculateur d'irrigation codé : une case sans page, la provenance décidée au serveur, neuf précisions tranchées par la recommandation

Date : 7 novembre 2026, la nuit, sous le mandat du porteur (« Cette nuit, je
veux que tu enchaînes les chantiers en autonomie », 23 h 18) : chaque question
non agronomique est tranchée par l'option recommandée et consignée ici. Code
de la 3.8 bis d'après son contrat (`docs/irrigation-calculator-contract.md`,
D-061), en Opus 5.5 · Élevé, la ligne 3.8 bis de la roadmap. Le moteur ne
change pas : aucune formule de couverture, de besoin, de planning ni de volume.

Précisions faites en codant (C1 à C9, section 16 du contrat) :

1. **C1. Une case sans page.** Le calculateur devient la onzième case à cocher
   (contrat, section 11 ; D-067, « les cases à venir »), après « Matériel et
   placement », dont il a besoin. Il n'a ni page, ni adresse, ni entrée du
   menu, ni « ? » : il vit dans la fenêtre des réglages du matériel. Les dix
   cases d'avant restent celles d'une ferme d'avant la 3.8 ; une ferme qui a
   déjà choisi trouve le calculateur décoché, annoncé une fois par le bandeau
   (R7).
2. **C2. Décoché, rien ne disparaît ni ne change.** Ni bouton, ni étiquette,
   ni case « mesuré » ; la provenance n'est pas lue ; enregistrer un réglage
   la garde tant que ses valeurs ne changent pas, l'efface si elles changent.
   Le serveur ignore ce que le navigateur dirait d'un calcul quand la case
   n'est pas cochée.
3. **C3. La provenance se décide au serveur**, par une règle du domaine
   (`decideProvenance`) : la case « mesuré » cochée l'emporte ; un calcul
   s'écrit seulement si le serveur, en le refaisant, retrouve exactement les
   valeurs enregistrées ; sinon des valeurs retouchées effacent la
   provenance, une case « mesuré » décochée aussi, et des valeurs inchangées
   la gardent (un nom changé ne rend pas le calcul faux).
4. **C4. AmnonDrip PC AS Ø16 : plage de 0,5 à 3,5 bars.** La fiche technique
   longue NaanDanJain (9 août 2018), lue le 7 novembre 2026, donne la plage
   d'autorégulation de 0,5 à 4 bars pour tous les diamètres, mais une pression
   maximale du tuyau Ø16 de 2,5 à 3,5 bars selon sa paroi : l'exemple
   s'arrête au plus haut des deux, 3,5 bars, et sa réserve donne les autres.
5. **C5. Hadar 7110 inversé, buse 1,8 mm : les valeurs de l'inventaire sont
   confirmées** sur la fiche Bosta (article 0610025) le 7 novembre 2026 :
   166 l/h et 5,3 m de portée à 2 bars, de 1,5 à 3 bars conseillés.
6. **C6. Un exemple préremplit la manière choisie** ; sa manière conseillée
   (le cône pour le 427, la moyenne pour les autres) est dite sous la liste.
   Choisir un exemple vide d'abord le débit, la pression et la plage de
   l'exemple précédent, garde ce que l'utilisateur sait de sa ferme.
7. **C7. La part d'eau sur la planche, en cône**, se lit sur une bande
   centrée sur la rampe : la largeur d'une planche et de son passe-pied,
   saisie à part, facultative, sans effet sur le profil.
8. **C8. Dupliquer un matériel ne copie pas la provenance** : la copie est
   « saisie », ce qui n'affirme rien de faux (D-003).
9. **C9. Le nom suggéré** par « Utiliser ce résultat » (« 2 lignes ·
   14,22 mm/h », « Cône · 6,1 mm/h · 11 m ») ne remplace jamais un nom déjà
   saisi.

Données : migration additive 0029, table
`irrigation_equipment_setting_calculations`, une ligne au plus par réglage,
supprimée avec lui ; aucune colonne ajoutée aux réglages, aucun réglage
existant ne change de valeur. Parcours navigateur P25.

Restent au porteur, à son retour : sa relecture sur le site en ligne, et la
recette sur la ferme réelle avec sa session (son ordinateur était éteint la
nuit du 7 au 8 novembre).

Ne changent pas : D-003, D-006, D-022, D-061, D-067.

## D-071 — Les créneaux protégés codés en cinq PR, chaque précision tranchée par la recommandation

Date : 8 novembre 2026, la nuit, sous le mandat du porteur (« Cette nuit, je
veux que tu enchaînes les chantiers en autonomie », 7 novembre 2026,
23 h 18) : chaque question non agronomique est tranchée par l'option
recommandée et consignée ici. Code de la 3.8 ter d'après son contrat
(`docs/protected-slots-contract.md`, D-062), en Opus 5.5 · Max, la ligne
3.8 ter de la roadmap, en cinq PR (section 11 du contrat), une à la fois.
Les précisions sont détaillées en section 13 du contrat ; elles restent
modifiables par le porteur à sa relecture.

**PR 1, le module de domaine** (`lib/domain/planning/protected-slots.ts`).
S1 : un créneau devient des instants par la fonction des plages R8, sans
recopier le passage de minuit ; le module est appelé par le moteur à côté de
`windows.ts`, et non par lui. S2 : le nom, nettoyé, tient en 80 caractères.
S3 : un jour au moins, sans doublon, rangés dans l'ordre de la semaine. S4 :
deux créneaux qui se touchent n'en font qu'un, sous leurs deux noms. S5 : un
créneau de la veille qui passe minuit compte (dimanche 22 h – 2 h protège le
lundi 0 h – 2 h). S6 : un créneau impossible n'exclut rien et n'arrête pas
le calcul.

**PR 2, le placement** (`engine.ts`, cas 1 à 8, 16 et 17). S7 : les
créneaux protégés se retirent des plages avant les refus, et un morceau sait
à l'instant près quel créneau le borne. S8 : un début repoussé par un
créneau protégé se nomme toujours « après un créneau protégé ». S9 : la
contrainte limitante nomme le créneau (« créneau protégé « Lavage » évité »).
S10 : le motif « créneau protégé » se donne quand les créneaux prennent toutes
les plages restantes, ou qu'un morceau trop court avant eux aurait suffi sans
eux, et nomme les créneaux. S11 : ce manque ne compte ni dans l'eau ni dans
le temps de pompage. S12 : sans créneau, le plan est celui d'avant, octet
pour octet (sept plans de référence comparés). S13 : le service ne passe
encore aucun créneau ; la PR 3 les lira en base.

**PR 3, la persistance** (migration 0030, `db/protected-slots-repository.ts`,
cas 15). S14 : un créneau appartient à l'exploitation et vaut toutes ses
saisons, comme les réglages du planning. S15 : l'historique garde chaque
version entière avec le geste, son auteur et sa date, écrite dans le même
lot que le changement ; un geste refusé n'écrit rien. S16 : la suppression
est logique et définitive. S17 : la base refuse elle-même un créneau
impossible. S18 : les créneaux se lisent dans l'ordre de la journée. S19 : le
service les relit à chaque calcul, pour l'exploitation du calcul seulement ;
lire ne crée rien, et une exploitation sans créneau se calcule comme avant.

**PR 4, les arrosages validés et le réel** (`suggestions.ts`, cas 9 à 13).
S20 : si peu qu'il entre dans un créneau protégé, un arrosage validé reçoit
« Réduire » à la partie avant, si elle porte la dose minimale, ou
« Annuler », sans l'écart de la 3.7 ni la tolérance du dernier jour. S21 : la
partie avant se compte à la minute entière. S22 : cette suggestion se combine
aux autres comme dans la 3.7. S23 : « Garder » la fait taire jusqu'à un
calcul qui en fait une autre. S24 : une irrigation faite pendant un créneau
protégé, d'après les créneaux en vigueur à son début, le dit sur sa carte de
l'historique, Planning coché seulement (3.8, R1). S25 : une irrigation en
cours ne reçoit rien ; la notification du matin compte ces suggestions comme
les autres.

**PR 5, l'écran et le geste manuel** (`protected-slots-section.tsx`,
`protected-slots-view.ts`, cas 14, parcours P26). S26 : la ligne d'un
créneau se lit « Lavage · mardi et jeudi · de 21:00 à 23:00 ». S27 : un
créneau nouveau ne devine rien ; la vérification du domaine dit ce qui
manque. S28 : supprimer demande confirmation, et le journal se lit sans
nommer personne. S29 : aucun geste sur un créneau ne recalcule le plan.
S30 : « Planifier » avertit d'un arrosage qui tombe dans un créneau, sans le
bloquer ; « Démarrer maintenant » et « Déjà réalisée » n'avertissent pas.
S31 : décocher le Planning avertit aussi des créneaux enregistrés. S32 : P26
planifie à la main l'arrosage sur lequel il pose le créneau après coup.

Ne changent pas : D-003, D-004, D-006, D-028, D-030, D-062.

## D-072 — Le lot 1 de l'audit ergonomique codé en une PR, chaque précision tranchée par la recommandation

Date : 8 novembre 2026, la nuit, sous le mandat du porteur (« Cette nuit, je
veux que tu enchaînes les chantiers en autonomie », 7 novembre 2026,
22 h 18 ; « Oui, vas-y », 22 h 21) : chaque question non agronomique est
tranchée par l'option recommandée et consignée ici. Code du lot 1 de la
3.8 quater (points 7, 4, 9 et 11 de l'audit, D-069), en Opus 5.5 · Élevé,
la ligne 3.8 quater de la roadmap, en une PR, sans contrat court (le bloc
3.8 quater n'en demande pas pour ce lot). Les neuf précisions E1 à E9 sont
détaillées dans le bloc 3.8 quater de la roadmap ; elles restent
modifiables par le porteur à sa relecture.

**Point 7, titres et page introuvable.** E1 : l'onglet porte le nom de la
page puis « Irrigation » ; la première ouverture, « Choisissez vos
fonctionnalités ». E2 : toute adresse inconnue répond « Page introuvable »
(statut 404) en français, avec l'en-tête, le menu de la ferme et un bouton
vers sa première page cochée ; rien n'est lu d'Ouvre ta ferme.

**Point 4, listes.** E3 : l'ordre naturel des noms (B9-9 avant B9-10, la
planche zéro en premier), sans majuscules ni accents, range les listes de
choix (périmètre des objectifs, filtres de l'historique, matériel, planche
du filet d'ombrage, planche de référence) ; le plan garde l'ordre d'Ouvre
ta ferme, celui du terrain. E4 : le périmètre d'un objectif se range par
jardin et se cherche, le choix en cours restant dans la liste ; ses valeurs
ne changent pas.

**Point 9, saison et commune.** E5 : la saison disparaît d'Alertes météo et
de Réglages quand aucune correspondance des espèces n'y est montrée ; elle
reste dans l'adresse. E6 : la commune ne se change que dans Réglages ;
« Objectifs et besoins » garde la météo de référence et un lien vers elle.

**Point 11, historique.** E7 : trois onglets, « Réalisées » par défaut
(faites en entier ou arrêtées en cours), « Planifiées », « Toutes » ; les
cumuls ne changent pas. E8 : l'export suit l'onglet et le dit sur son
bouton ; un lien d'export d'avant, sans onglet, exporte tout. E9 : « Saisir
la pluie » mène au bloc « Pluie mesurée » quand la pluie réelle manque, et
remplace « Donnée indisponible » dans l'écart à l'objectif quand seule la
pluie lui manque.

La page introuvable devient le troisième composant serveur d'`app/` avec
les pages et les mises en page (`docs/boundaries-contract.md`). Aucune
migration, aucun calcul du moteur ne change, aucune lecture nouvelle
d'Ouvre ta ferme ; parcours P27 aux deux largeurs.

**Relu et validé par le porteur le 8 novembre 2026** (« c'est bon ») : les
neuf précisions E1 à E9 restent telles quelles ; E4 vaut aussi au
téléphone, où le périmètre d'un objectif garde ses groupes par jardin et sa
recherche.

Ne changent pas : D-001, D-002, D-067, D-068, D-069.

## D-073 — Le contrat du lot 2 de l'audit ergonomique, chaque précision tranchée par la recommandation

Date : 8 novembre 2026, la nuit, sous le mandat du porteur (« Cette nuit, je
veux que tu enchaînes les chantiers en autonomie », 7 novembre 2026,
22 h 18). Contrat du lot 2 de la 3.8 quater (points 2, 1 et 3 de l'audit,
D-069), `docs/audit-ergonomie-lot2-contract.md`, écrit en Sonnet 5.5 ·
Moyen ; le code se fera en Opus 5.5 · Très élevé (roadmap). Aucune
question agronomique : aucun calcul ne change. Les quatorze précisions F1 à
F14 de la section 9 du contrat restent modifiables par le porteur à sa
relecture en ligne.

**Téléphone.** F6 : la barre du bas montre quatre entrées (Aujourd'hui,
Arrosages, Planning, Ressources) et « Plus » ; F7 : la saison passe dans la
ligne du titre ; F10 : le bandeau « alertes système » se replie en point sur
la cloche, l'état « vu » étant gardé sur l'appareil ; F11 : planning replié
au téléphone, sans jamais cacher un retard.

**Aujourd'hui.** F1 : page de plein droit sans case, première du menu et
page d'arrivée ; F2 : pas de saison ; F3 : blocs absents seulement si leur
case est décochée ; F4 : le geste « Fait comme prévu » reste au lot 3.

**Fiabilité.** F5 : liste fermée de cinq données, une fonction unique ;
F8 : seuils d'affichage de 7 jours, 7 jours et 48 h, non agronomiques ;
F9 : aucun avertissement de page supprimé sans équivalent ; F12 : pastille
du menu ; F13 : aucune migration ; F14 : trois PR dans l'ordre téléphone,
domaine, écrans.

**Complément du 8 novembre 2026, PR 1 du lot 2 (le téléphone).** Codée
en Opus 5.5 · Très élevé, sur le même mandat. Huit précisions de plus,
tranchées en codant par la recommandation et consignées au contrat
(section 9, « Précisions de la PR 1 ») : F15, la barre du bas vaut jusqu'à
600 px, la tablette garde sa bande ; F16, un nom court sous l'icône, le nom
entier restant le nom accessible ; F17, la place d'« Aujourd'hui » tenue par
la page suivante du menu jusqu'à la PR 3 ; F18, un jour écoulé reste ouvert
quand il porte une irrigation validée, encore planifiée, dont l'heure est
passée, et « Jours écoulés (n) » ne compte que les jours qu'il range ; F19,
quand aujourd'hui n'a ni proposition ni validation, le jour à venir le plus
proche qui en a reste ouvert ; F20, un jour replié montre sa date, ses
compteurs et « Voir les créneaux (n) », et la ligne des six tuiles ne
montre le manque d'eau, le pompage manquant, les planches non servies et
les non vérifiés que s'ils comptent ; F21, le bandeau des alertes système ne
se replie qu'au téléphone et sur la page des arrosages, le point de la
cloche se voit sur toutes les pages ; F22, les « ? », les « i » et
« Actualiser » portés à 44 px ici, les autres cibles au point 14 du lot 3.
Toutes restent modifiables par le porteur à sa relecture en ligne.

**Complément du 8 novembre 2026, PR 2 du lot 2 (le domaine « Aujourd'hui »
et « Fiabilité du calcul »).** Codée en Opus 5.5 · Très élevé, sur le même
mandat, sans écran. Huit précisions de plus, tranchées par la
recommandation et consignées au contrat (section 9, « Précisions de la
PR 2 ») : F23, un volume jamais saisi fait aussi une ligne, une par réserve
active ; F24, la pluie réelle se regarde sur les sept jours avant
aujourd'hui, et une ferme tout sous abri n'a pas de ligne ; F25, le sol se
lit par jardin ou abri, compté quand ni lui ni sa parcelle n'ont jamais été
observés et qu'aucune planche n'est connue ; F26, seules les espèces sans
aucun rattachement comptent, « Sans référence Kc » choisi exprès n'est pas
une donnée à rafraîchir ; F27, « Le plan de la semaine n'a pas été
calculé » et « Voir l'autre » pour une seule ligne cachée ; F28, le bloc
« Gel ou chaleur » nomme la minimale la plus basse des trois jours et
toutes les cultures touchées, ajoute les alertes de l'exploitation qui se
déclencheraient, et sa phrase calme ne dit que ce qui a été regardé ; F29,
les blocs des retards et du jour lisent les irrigations comme la page des
arrosages, tolérance R14 comprise ; F30, le bloc de l'eau dit chaque
réserve active et ce qui reste à prélever sur chaque ressource limitée.
Aucune ne touche un calcul ; toutes restent modifiables à la relecture en
ligne.

**Complément du 8 novembre 2026, PR 3 du lot 2 (les écrans : la page
« Aujourd'hui », la zone « Fiabilité du calcul », la pastille du menu,
l'entrée du module).** Codée en Opus 5.5 · Très élevé, sur le même mandat.
Douze précisions de plus, tranchées par la recommandation et consignées au
contrat (section 9, « Précisions de la PR 3 ») : F31, « Aujourd'hui » est
la page d'arrivée partout où le module choisissait la première page
cochée ; F32, la page lit toujours la saison du jour, la saison de
l'adresse restant aux liens du menu ; F33, hors d'« Aujourd'hui », la
pastille est lue après l'affichage dans les données déjà gardées, jamais
d'Ouvre ta ferme, son nombre est dans le nom du lien, en ambre ; F34,
« Voir les alertes » mène à la page de ce qui est annoncé ; F35, une météo
périmée est relue avant la page ; F36, la page se relit après chaque
bouton ; F37, chaque geste de la zone mène à la carte même ; F38, « Voir
moins » ; F39, un retard encore planifié garde « Démarrer maintenant » ;
F40, la barre rouge de la charte sur le gel annoncé ; F41, l'inventaire
des avertissements des pages (F9) : seule la pluie réelle incomplète du
tableau des besoins double la zone, elle reste sur sa page dans les mots
de la fonction ; F42, au téléphone, une colonne, des cibles de 44 px et
une page de deux écrans au plus. Aucune ne touche un calcul ; toutes
restent modifiables à la relecture en ligne.

Ne changent pas : D-003, D-004, D-028, D-067, D-068, D-069, D-072.

## D-074 — « Aujourd'hui » devient le tableau de bord du module : une maquette validée, « Tout est fait » tel que prévu, neuf précisions tranchées par la recommandation

Date : 8 novembre 2026. Après sa relecture en ligne de la page
« Aujourd'hui » (#293, D-073), le porteur la veut « beaucoup plus graphique
et agréable à regarder, tout en étant plus compréhensible », « un véritable
[tableau de] bord », et son entrée de menu « détachée et avec un encart
différent » (12 h 09 et 12 h 15). Une maquette lui a été montrée avant tout
code ; **il l'a validée à 12 h 25** (« ok je valide »). À 12 h 50, il a
demandé un bouton « Tout est fait » pour l'utilisateur qui a arrosé sans le
chrono ; **il a choisi le 8 novembre 2026 que chaque irrigation soit
enregistrée telle que prévue** (son heure de début, sa durée, son matériel,
son réglage et sa dose prévus), parce que ce choix touche les données
réelles qui entrent dans l'écart. Contrat :
`docs/aujourdhui-tableau-de-bord-contract.md`. Code en Opus 5.5 · Très
élevé, choix du porteur, en trois PR : le contrat et le domaine, les écrans,
« Tout est fait ».

**Ce qui ne change pas.** Aucun calcul : la page dessine des valeurs que les
services existants calculent déjà ; les millimètres se pondèrent par la
surface, une valeur inconnue laisse le total inconnu (D-003) ; prévu,
estimé et observé gardent chacun leur mot (D-006) ; la réserve du sol reste
une information (D-041, D-047) ; rien ne s'enregistre sans une confirmation
qui liste ce qui s'écrit (D-028).

**Précisions tranchées par la recommandation** (contrat, section 7),
modifiables à la relecture en ligne : T1, le menu en trois groupes,
Arroser, Équiper, Surveiller, Réglages à part ; T2, plus de trois retards
d'un même jour passé se replient en une ligne ; T3, la frise de 5 h à 22 h,
élargie si une irrigation du jour en sort ; T4, l'eau de la semaine en
cours par jardin, comme « Objectifs et besoins » ; T5, l'ordre des blocs du
contrat, le gel n'étant plus remonté en tête ; T6, la fiabilité montre
aussi les données à jour ; T7, pas de trait de seuil par jardin sur la
réserve du sol, les seuils étant par planche, la planche la plus sèche
nommée à la place ; T8, la goutte de pluie dès 1 mm prévu, le gel
primant ; T9, huit jardins montrés d'emblée.

**Complément du 8 novembre 2026, PR 2 (les écrans).** Codée en Opus 5.5 ·
Très élevé. La page en grille de la maquette, le menu détaché et ses
groupes, le bouton rond du téléphone ; parcours P29 mis à jour et P30
nouveau. Cinq précisions de plus, tranchées par la recommandation et
consignées au contrat (section 7, « Précisions de la PR 2 ») : T10, au
téléphone la limite de deux écrans du lot 2 (F42) est levée, la phrase du
jour et ses pastilles tenant dans le premier écran ; T11, un lien-geste
« Recalculer » suit la ligne du plan quand il existe ; T12, les phrases des
blocs dessinés restent pour un lecteur d'écran ; T13, un manque montré dit
sa propre phrase, le résumé ne restant que pour ce qui est à jour ou
replié ; T14, la bande de la tablette garde une rangée de pilules. Aucune
ne touche un calcul ; toutes restent modifiables à la relecture en ligne.

**Complément du 8 novembre 2026, PR 3 (« Tout est fait »).** Codée en
Opus 5.5 · Très élevé. Une seule fonction du domaine,
`lib/domain/done-as-planned.ts`, dit si une irrigation planifiée s'enregistre
« faite comme prévu » et ce qui s'écrit ; le geste d'une ligne du lot 3
(point 6.5 de l'audit) la reprendra. Le serveur relit les irrigations du
propriétaire pour la saison du jour et rejuge chacune avant de l'écrire,
tout ou rien par irrigation, à l'heure, à la durée et à la dose prévues
qu'il trouve encore ; un refus garde le nom de l'irrigation, les autres
restent enregistrées ; le plan se recalcule une fois. Aucune table ni
migration nouvelle. Quatre précisions de plus (contrat, section 7) : T15,
une irrigation commencée mais pas finie n'est pas couverte avant son heure
de fin prévue, une irrigation réalisée ne finissant pas dans le futur ;
T16, **une irrigation enregistrée ne se modifie plus** (D-006) : le contrat
renvoyait à tort à un chemin de correction sur « Arrosages », qui n'existe
pas ; la confirmation le dit et se décoche ligne à ligne ; T17,
l'historique lit « Planifiée, faite comme prévu » ; T18, au téléphone, les
boutons de la confirmation restent en vue, « Enregistrer » au-dessus.

Ne changent pas : D-003, D-004, D-006, D-028, D-041, D-047, D-067, D-073.

## D-075 — Économiser les minutes GitHub Actions sans affaiblir la protection de main

> **Annulée le 8 novembre 2026** (passage du travail sur le dépôt public `module-irrigation-otf-public`, dont les minutes Actions sont gratuites, sur demande du porteur). Retour au protocole complet : contrôles sur chaque PR **et** sur `main`, job Parcours jamais sauté. Le texte ci-dessous reste pour mémoire.

- **Contexte.** Le 8 novembre 2026, GitHub a signalé 2 706 minutes utilisées
  sur 3 000 incluses ; le budget Actions du compte est à 0 $, donc au-delà les
  Actions sont bloquées (et les fusions avec elles) jusqu'au 1er décembre. Un
  lot de contrôles coûte environ 21 minutes dont 15 pour les parcours
  navigateur, et chaque PR était contrôlée deux fois (sur la PR, puis sur
  `main`).
- **Décision.** (1) Sur `push` vers `main`, les jobs Application, Workers et
  Parcours sont sautés ; le déploiement part si aucun n'a échoué. La
  protection de `main` exige les contrôles verts et la PR à jour, donc le code
  fusionné est celui déjà contrôlé. (2) Le job Parcours reste requis (un job
  sauté compte comme réussi) mais ses étapes sautent pour une PR qui ne change
  que `docs/`, des `.md` ou le modèle de PR. (3) Le budget Actions n'est pas
  relevé : réglage du porteur, non modifié.
- **Risque.** Un déploiement n'est plus précédé d'un nouveau contrôle sur
  `main` ; il repose sur la règle « PR à jour avant fusion ».


## D-076 — Le lot 3 de l'audit ergonomique : un contrat court validé, la PR 1 (planning et arrosages), la PR 2 (gestes par ligne, mots simples, accessibilité) et vingt précisions tranchées en codant

Date : 8 novembre 2026. Contrat court du lot 3 de la 3.8 quater (points 5,
6, 8, 10, 12, 13 et 14 de l'audit, D-069), écrit avant tout code en
Sonnet 5.5 · Moyen et validé par le porteur le jour même, versé dans le
dépôt avec la PR 1 : `docs/audit-ergonomie-lot3-contract.md`. Proposé
D-075 à l'écriture, il prend le numéro D-076 à l'ordre de fusion (D-074 :
« Aujourd'hui » en tableau de bord ; D-075 : l'économie des minutes
Actions). Une seule question agronomique, tranchée par le porteur le
8 novembre 2026 à 12 h 07 : les trois modèles d'alerte météo du point 10
(gel sous 3 °C, forte chaleur au-dessus de 33 °C, pluie au-delà de 15 mm,
horizon de trois jours, modifiables). Les précisions F43 à F51 du contrat
sont tranchées par la recommandation (mandat « option recommandée par
défaut ») ; aucune règle de calcul ne change, aucune migration.

**Livraison.** Trois PR, une à la fois, regroupées autant que la relecture
le permet (minutes Actions comptées) : PR 1, le planning et les arrosages
(points 5 et 6) ; PR 2, les gestes par ligne (points 12, 13 et 10) ; PR 3,
les mots simples et l'accessibilité (points 8 et 14). Les PR 2 et 3 peuvent
n'en faire qu'une. Parcours P31, en trois étapes a, b et c.

**PR 1, codée le 8 novembre 2026 en Opus 5.5 · Très élevé.** Dix précisions
de plus, tranchées en codant par la recommandation et consignées au contrat
(section 8, « Précisions de la PR 1 ») ; elles restent modifiables à la
relecture du porteur :

- F52 : « Non placé » devient « Planches non servies (n) », le mot de la
  tuile ; les groupes portent un nom en mots simples (« Sans matériel (n) »,
  « Manque d’eau (n) »), le plus gros d'abord.
- F53 : la carte « En retard » du planning lit l'irrigation validée telle
  qu'elle est (heures modifiées, minuteur, annulations), par une jointure en
  lecture seule, avec la règle de la page des arrosages
  (`plannedIrrigationLateness`, R14) : les deux pages disent le même retard.
- F54 : le moteur ne calcule aucune solution de faisabilité ; la phrase dit
  quoi faire, **pas de bouton** (« sinon, pas de bouton », point 6.2), et
  F46 attend qu'une solution soit calculée un jour.
- F55 : « Recalculer le plan » une seule fois, en tête du bloc « À
  traiter ».
- F56 : une partielle se range à son jour, « Annuler le reliquat » dans le
  menu « … ».
- F57 : « Fait comme prévu » ne paraît que là où `doneAsPlanned` accepte
  (planifiée, jamais démarrée, fin passée), sur « Arrosages » et sur
  « Aujourd'hui » ; l'écriture est celle de « Tout est fait », rejugée par
  le serveur (F43, T15).
- F58 : la confirmation d'une ligne répète l'irrigation, son jour, ses
  heures et son volume (« volume inconnu » plutôt que zéro, D-003) et dit
  qu'elle ne se corrigera plus (D-006) ; « Ne rien enregistrer » n'écrit
  rien.
- F59 : les codes des règles (R13, D-025…) restent dans l'infobulle
  « Pour les experts » de la cellule « Motif » ; « arbitrage » devient
  « choix entre (deux) demandes d’eau » dans les libellés visibles.
- F60 : une ligne par irrigation (heure, matériel, réglage et durée, volume,
  état), la carte entière sous « Voir la fiche », ouverte d'elle-même par un
  lien ; le menu « … » se ferme à Échap, au clic ailleurs et après un choix.
- F61 : le formulaire s'ouvre sans matériel choisi ; la pompe suit le
  matériel ; enregistrer sans matériel est refusé avec une phrase.

**Ce qui ne change pas.** Le moteur, le planificateur, les seuils, les
objectifs, la règle du retard, le calcul de faisabilité, l'action de
« Tout est fait ». Vérifié par `tests/audit-ergonomie-lot3.test.ts`
(cas 1, 2, 4, 5 et 7), `tests/db/planning-service.test.ts` (l'irrigation
d'une validée relue, heures modifiées comprises, et l'isolation entre
exploitations, cas 14), P31a aux deux largeurs et les parcours P2, P7, P10,
P11, P12, P26 et P28 mis à jour (« Annuler » dans le menu « … », les
nouveaux mots, la ligne de résumé du planning au téléphone).
**En ligne** : #301 fusionnée le 8 novembre 2026 à 17 h 23 (`db8d342`) et
déployée à 17 h 24 (run 42499644714, le job de déploiement réussi, les
contrôles sautés comme le veut D-075).

**PR 2, codée le 8 novembre 2026 en Opus 5.5 · Très élevé : les PR 2 et 3
réunies** (minutes Actions comptées, comme le contrat le permet) : les
gestes par ligne (points 12, 13, 10), les mots simples (point 8) et
l'accessibilité (point 14). Dix précisions de plus, tranchées en codant par
la recommandation et consignées au contrat (section 8, « Précisions de la
PR 2 ») ; elles restent modifiables à la relecture du porteur :

- F62 : une espèce « à rattacher » n'a aucun rattachement ou est rattachée
  à « sans référence » ; elles passent en tête, avec « n espèces à
  rattacher sur T » et la phrase de conséquence.
- F63 : « Rattacher comme… » ne propose qu'une culture du jeu commun dont
  tout le nom commence le nom de l'espèce, la plus précise, le CRIIAM avant
  la FAO-56 ; une égalité restante ou aucun nom commun : rien. Une
  confirmation, jamais d'écriture sans elle.
- F64 : la recherche par nom dès deux espèces.
- F65 : « Observer » sur chaque ligne « inconnue » de la réserve du sol ;
  les jardins de plein champ au même pourcentage, observés le même jour,
  rangés en une phrase dépliable, ouverte tant qu'un de ses jardins l'est.
- F66 : les trois modèles d'alerte, les mêmes pour toutes les fermes, avec
  un libellé déjà rempli, tant qu'il n'y a aucune alerte.
- F67 : l'état des notifications de cet appareil et « Activer sur cet
  appareil » sur la page « Alertes météo » ; la note du gel à 2 m repliée.
- F68 : « Besoin en eau par culture », trois replis « Pour les experts »,
  un seul tableau et un seul formulaire pour les K_abri ; dans « Matériel »,
  le réglage en pastille à côté des planches couvertes et une ligne de sens
  sous « Chevauchements » et « Cumul maximal ».
- F69 : toute cible à 44 px au téléphone, mesurée sur les douze pages,
  plis fermés puis ouverts.
- F70 : le contraste mesuré sur chaque texte visible, aux deux largeurs ;
  deux textes corrigés (le compte d'un onglet de l'historique, le chiffre
  de l'eau sur l'eau pâle) ; un test sur les jetons de la charte.
- F71 : « Aller au contenu », premier arrêt du clavier de chaque page.

Le mode sombre et un lecteur d'écran ne sont pas vérifiés par ce lot (F50).

**Ce qui ne change pas (PR 2).** Le moteur, la jauge, le calcul du besoin,
les règles des alertes, les actions d'enregistrement : la proposition
d'après le nom passe par l'action de rattachement existante, un modèle par
celle d'une alerte. Vérifié par `tests/audit-ergonomie-lot3-gestes.test.ts`
(cas 8 à 11 et 13), l'isolation entre exploitations par les tests de
`tests/db` déjà en place (cas 14 : aucune lecture ni écriture nouvelle),
P31b et P31c aux deux largeurs et les parcours P14, P16, P17 et P31a mis à
jour. **En ligne** : #303 de l'archive fusionnée le 8 novembre 2026 à 18 h 56
(`d350c06`) et déployée à 18 h 57 (run 42507465264, le job de déploiement
réussi, les contrôles sautés comme le voulait D-075, aucune migration). Le
lot 3 est complet ; ses écrans, relus en ligne par le porteur, sont validés
le 8 novembre 2026 à 19 h 20 (« ça me semble bon »).


## D-077 — L'arbitrage validé en parts réservées (correction 1 de la 3.9) : quatre précisions tranchées par la recommandation

Date : 8 novembre 2026. Première des quatre corrections du lot 2 de la 3.9,
la décision 1 du porteur du 30 octobre 2026 (D-052) : sous un arbitrage 3.4
validé, chaque allocation est une part réservée, sans redistribution entre
planches ; l'eau qu'une planche allouée ne peut pas recevoir reste non
attribuée, et l'écran le dit. Codée en Opus 5.5 · Max sur le dépôt public,
le contrat du planning précisé d'abord (`docs/planning-contract.md`,
« Pénurie » et la note « L'arbitrage en parts réservées »), un test rouge
avant le code (`tests/planning-shortage.test.ts`).

**Le défaut corrigé** (point ouvert 36, sous arbitrage). Le moteur prenait
les allocations pour des cibles sans les réserver : le débordement d'un
matériel pouvait prendre l'eau d'une autre planche allouée, et la dernière
planche examinée ne rien recevoir. Sur la ferme de test (S13), avec 6 mm
alloués partout et une réserve qui tient exactement les allocations, le
tunnel 4 recevait 0 mm.

**Quatre précisions**, techniques, sans règle agronomique nouvelle,
tranchées par la recommandation (mandat « option recommandée par défaut »)
et consignées au contrat du planning ; elles restent modifiables à la
relecture du porteur :

- F72 : seules les allocations sont des parts. Une planche que l'arbitrage
  ne nomme pas (un niveau servi en entier, ou un niveau non arbitré) garde
  son besoin pour cible et puise dans l'eau non attribuée de sa chaîne.
- F73 : quand une chaîne ne peut pas fournir toutes ses allocations, chacune
  est réduite dans la même proportion, et la coupe porte le motif de la
  chaîne. Le cas réel est une limite journalière, que la faisabilité ne
  compte pas. C'est la condition pour qu'aucune planche choisie ne reste
  sans eau.
- F74 : le plan porte `arbitration` (l'eau allouée, l'eau que la semaine
  peut fournir après réduction, l'eau allouée non reçue et ses planches),
  absent sans arbitrage. Le planning le dit dans une note sous les cartes
  du résumé, en trois phrases au plus : l'eau allouée, sa réduction s'il y
  en a une, ce que les planches allouées ne peuvent pas recevoir ; chaque
  phrase ajoutée passe le litre. Aucune ligne de budget ni fraction sous
  arbitrage (S13).
- F75 : « ne peut pas être reçu », c'est la part restée non dépensée à la
  fin du placement. L'eau qu'un créneau verse à côté a été placée : elle
  n'en fait pas partie.

**Ce qui ne change pas.** Sans arbitrage, le plan est celui d'avant, sans
le champ `arbitration` ; la conduite en pénurie R9 et la part réservée de
D-037 gardent leurs règles. Aucune migration : le champ s'enregistre dans
le résumé du calcul, en JSON. Vérifié par cinq tests de
`tests/planning-shortage.test.ts` et un test de
`tests/db/planning-repository.test.ts`.

**En ligne** : #11 du dépôt public fusionnée le 8 novembre 2026 à 21 h 07
(`187ff6e`) et déployée à 21 h 21 (run 42518503747, les quatre jobs réussis,
aucune migration, Workers inchangés).


## D-078 — L'écran d'arbitrage présenté comme un plan d'assolement : dans la 3.9, maquette d'abord

Date : 8 novembre 2026, 20 h 40. Le porteur avait demandé le 7 novembre 2026
un écran d'arbitrage d'une pénurie présenté comme un plan d'assolement. La
question était restée ouverte à la clôture de la 3.8 ; la recommandation
était de le faire dans la 3.9, en commençant par une maquette. Le porteur
répond « oui ».

- **Décision.** L'écran se fait dans la 3.9, après les quatre corrections du
  lot 2. Une maquette d'abord, soumise au porteur avant tout code ; son code
  passe par un ajout au contrat de la 3.9 (`docs/shortage-contract.md`).
- **Ce qui ne change pas.** Le moteur reçoit une allocation par planche,
  quel que soit l'écran qui la produit : la correction 1 (D-077) n'en
  dépend pas.


## D-079 — Le budget net du manque sous le minimum, la part visée et la part placée (correction 2 de la 3.9) : quatre précisions tranchées par la recommandation

Date : 8 novembre 2026. Deuxième des quatre corrections du lot 2 de la 3.9,
la décision 2 du porteur du 30 octobre 2026 (D-052) : le budget d'une chaîne
d'eau retire d'abord le manque sous le minimum de sécurité, et la ligne de
budget montre la part visée et la part placée, par niveau de priorité.
Codée en Opus 5.5 · Max sur le dépôt public, le contrat du planning précisé
d'abord (`docs/planning-contract.md`, « Pénurie » et la note « Le budget net
du manque sous le minimum »), un test rouge avant le code
(`tests/planning-shortage.test.ts`).

**Le défaut corrigé** (S3). Sous son minimum, le stock comptait zéro dans le
budget, non le manque : le budget annonçait tous les apports d'ici dimanche,
quand la garde en retient d'abord ce qu'il faut pour remonter la réserve au
minimum. Les parts, prises sur ce budget trop grand, servaient les premières
planches examinées, et la garde arrêtait le placement avant les dernières.
Sur la ferme de test (25 m³ en réserve, minimum 40 m³, forage à 0,2 m³/h),
le budget annonçait 26,23 m³ pour 11,23 m³ que la garde laisse passer, et
les seize planches des tunnels 3 et 4 ne recevaient rien. Sur la ferme, le
5 octobre 2026 (calcul T3) : 75,27 m³ et « normale 91 % » annoncés, 60,2 m³
placés.

**Quatre précisions**, techniques, sans règle agronomique nouvelle,
tranchées par la recommandation (mandat « option recommandée par défaut »)
et consignées au contrat du planning ; elles restent modifiables à la
relecture du porteur :

- F76 : les règles du placement ne changent pas — la garde, les plages, la
  dose, la part réservée de D-037 — ; changent le budget, les fractions et
  les parts qui en découlent. La décision dit « aucun changement dans ce que
  le moteur place » et veut des parts qui « se répartissent entre toutes les
  planches plutôt que 91 % aux unes, rien aux autres » : la garde plaçait
  déjà, en tout, l'eau du budget net ; c'est son partage qui change, et il
  passe par les parts.
- F77 : la part placée d'un niveau est l'eau utile placée sur ses planches,
  le surplus exclu, rapportée à la demande du niveau, comptées toutes deux
  sur la surface que le propre matériel de chaque planche mouille, comme le
  budget. Elle se calcule sur le plan fini (`placedBudgets`, `shortage.ts`)
  et s'enregistre avec le budget.
- F78 : sous le report, la part visée d'un niveau est la part de sa demande
  que la conduite sert au départ, une planche reportée comptant zéro ; elle
  restait à 100 %. Sur la ferme de test (S10), une planche basse sur seize
  tient dans ce qui reste : « basse 6 % visés ».
- F79 : la ligne s'écrit « haute — · normale 73 % visés, 73 % placés ·
  basse — », « — » pour un niveau sans demande ; un calcul enregistré avant
  la correction, sans les deux champs nouveaux, garde sa ligne d'avant,
  « part réservée : » suivi des seules fractions.

**Ce qui ne change pas.** Un stock au-dessus de son minimum donne le budget
d'avant, au millilitre, et le plan d'avant. Les apports d'après la dernière
plage restent comptés dans le budget (limite laissée telle quelle par le
porteur le 30 octobre 2026, D-052) : la part placée montre ce qu'ils n'ont
pas servi. Sous arbitrage, toujours aucune ligne de budget (D-077). Aucune
migration : les deux champs s'enregistrent avec le budget, dans le résumé du
calcul, en JSON. Vérifié par quatre tests de
`tests/planning-shortage.test.ts` (S3 ; la ligne par niveau ; S10 à trois
niveaux, sous « prioritaires d'abord, puis part égale » et sous le report ;
un stock au-dessus du minimum et un calcul enregistré avant) et un test de
`tests/db/planning-repository.test.ts` ; l'invariant commun des fixtures
juge la réserve à partir du premier prélèvement placé, la garde la laissant
sous son minimum jusque-là.

**En ligne** : #12 du dépôt public fusionnée le 8 novembre 2026 à 21 h 49
(`87e4ab0`) et déployée à 22 h 03 (run 42522030186, les quatre jobs réussis,
aucune migration, Workers inchangés).


## D-080 — Le report sans bascule d'un calcul à l'autre (correction 3 de la 3.9) : quatre précisions tranchées par la recommandation

Date : 8 novembre 2026. Troisième des quatre corrections du lot 2 de la
3.9, la décision 4 du porteur du 30 octobre 2026 (D-052) : sous la conduite
« report », les planches reportées ne passent devant les autres qu'au calcul
qui suit un événement ; sans événement, le calcul reproduit le précédent.
Codée en Opus 5.5 · Max sur le dépôt public, le contrat du planning précisé
d'abord (`docs/planning-contract.md`, « Pénurie » et la note « Le report
sans bascule »), des tests rouges avant le code.

**Le défaut corrigé** (S12, règle 9 du contrat de la 3.7). Le service
passait au moteur, à chaque calcul, les planches que le calcul précédent
avait reportées, qui passaient devant. Un second calcul sans événement
servait donc les reportées et reportait les premières, et le plan basculait
d'un calcul à l'autre, contre « même entrée, même plan ». Sur la ferme de
test (S12 : 12 m³ pour 17,83 m³, trois niveaux), le premier calcul
reportait une planche du bloc 2 et quinze des tunnels 3 et 4 ; le second,
sans rien de nouveau, en reportait d'autres. Sur le service, deux planches
pour une réserve qui n'en sert qu'une : la reportée et la servie
échangeaient leur place à chaque clic sur « Calculer ».

**Quatre précisions**, techniques, sans règle agronomique nouvelle,
tranchées par la recommandation (mandat « option recommandée par défaut »)
et consignées au contrat du planning ; elles restent modifiables à la
relecture du porteur :

- F80 : « un événement », c'est un événement de la règle 4 du contrat de la
  3.7, inscrit au registre des événements après le calcul précédent de la
  semaine et dont le recalcul n'a pas encore abouti : le recalcul sur
  événement lui-même, ou un calcul à la main ou du matin qui suit un
  recalcul échoué. Un événement déjà recalculé ne fait pas avancer la file
  une seconde fois. Un réglage du planning, la météo du matin, le passage du
  temps et un changement des fonctionnalités n'en sont pas (règle 5) : le
  calcul du matin, sans événement, garde la file.
- F81 : le plan retient la file qu'il a suivie, enregistrée avec le calcul ;
  sans événement, le calcul suivant reprend cette file, non les planches que
  le précédent a reportées. C'est ce qui fait reproduire le plan même après
  un calcul où la file avait avancé.
- F82 : au premier calcul de la semaine, la file est vide ; après un calcul
  enregistré avant la correction, qui ne l'a pas retenue, aussi, faute
  d'événement.
- F83 : le motif d'une planche reportée dit « reportée : passe en tête après
  le prochain événement (conduite « report ») », et son groupe, dans la liste
  « Planches non servies », « Reportées jusqu'au prochain événement », avec
  la phrase « Elles passent en tête au calcul qui suit un événement : un
  arrosage validé ou fait, de l'eau nouvelle, un stock corrigé. Recalculer
  sans événement ne change pas leur tour. » « Au prochain calcul »
  promettait ce que le calcul sans événement ne fait plus.

**Ce qui ne change pas.** L'ordre de service — la file d'abord, puis
priorité, déficit relatif, inventaire — et le report jusqu'à épuisement du
budget ; les deux autres conduites et l'arbitrage, que la file ne touche
pas ; la semaine suivante, que le report n'atteint pas (Q9, R10). Aucune
migration : la file s'enregistre dans le résumé du calcul, en JSON,
seulement quand elle n'est pas vide. Vérifié par trois tests de
`tests/planning-shortage.test.ts` (deux calculs sans événement ; deux
calculs autour d'un événement, puis un troisième sans ; la file vide), deux
de `tests/db/planning-service.test.ts` (la suite sans événement, avec
événement, puis sans ; le calcul à la main qui suit un recalcul échoué, qui
passait déjà sur le service d'avant et garde ce cas) et un de
`tests/db/planning-repository.test.ts`.

**En ligne** : #13 du dépôt public fusionnée le 9 novembre 2026 à 2 h 51
(`a15f150`) et déployée à 3 h 23 (run 42547789030, les quatre jobs réussis
après une relance des parcours navigateur, point ouvert 50 ; aucune
migration, Workers inchangés).


## D-081 — La part du dernier jour (correction 4 de la 3.9) : quatre précisions tranchées par la recommandation

Date : 8 novembre 2026. Quatrième et dernière des corrections du lot 2 de
la 3.9, la décision 5 du porteur du 30 octobre 2026 (D-052) : le dernier
jour de la semaine, une part sous la dose minimale est placée tant qu'une
plage reste, comme hors pénurie. Codée en Opus 5.5 · Max sur le dépôt
public, le contrat du planning précisé d'abord (`docs/planning-contract.md`,
« Pénurie » et la note « La part du dernier jour »), des tests rouges avant
le code.

**Le défaut corrigé** (S18). La borne des parts arrêtait le matériel dès que
ce que ses parts paient tombait sous la dose minimale, quel que soit le
jour : un matériel dont le créneau verse à côté attendait une part plus
grande même le dimanche. Le dimanche, l'attente faisait fondre sa part —
l'eau libérée en fin de tour allant aussi à des planches qui ne peuvent
plus rien recevoir — et laissait de l'eau dans la réserve. Sur la ferme du
point 36 à 26 % de sa demande (5,2 mm de part, les rampes du tunnel 1 et du
bloc 2 versant aussi sur le bloc 1), le calcul du dimanche à 0 h 30 ne
plaçait ces deux rampes qu'à 2,3 mm, et 1,1 m³ restait dans la réserve ;
sous un arbitrage de 5,2 mm par planche, réserve égale aux allocations,
rien n'était placé pour elles, et 2,12 m³ alloués à dix-huit planches
restaient non attribués.

**Quatre précisions**, techniques, sans règle agronomique nouvelle,
tranchées par la recommandation (mandat « option recommandée par défaut »)
et consignées au contrat du planning ; elles restent modifiables à la
relecture du porteur :

- F84 : « le dernier jour », c'est la plage du dernier jour de la semaine,
  celle qui commence le dimanche — la nuit de dimanche pour l'aspersion, la
  journée de dimanche pour le goutte-à-goutte —, quand c'est la première que
  le matériel peut prendre. Avant, le matériel attend comme avant : un
  calcul de mercredi ou de samedi ne place pas sur dimanche une part sous la
  dose minimale, comme un reste hors pénurie, qui attend le samedi ; le
  calcul de dimanche la place.
- F85 : la part placée est celle que les parts de ses planches paient quand
  le matériel est examiné, débordement compris, sans attendre la
  redistribution de fin de tour, comme l'exception du dernier jour place
  déjà sans attendre une part elle-même sous la dose minimale ; une part
  qu'une redistribution aurait agrandie est donc placée telle qu'elle est.
  La garde de la réserve et la ressource directe, qui viennent après la
  borne, peuvent encore raccourcir ce créneau jusqu'à la seconde.
- F86 : le motif reste celui de la borne (S15) : « la part de la semaine
  réservée à ses planches », « part de la semaine atteinte, le reste est
  réservé aux autres planches ». Un créneau que la borne ne coupe pas, sa
  planche de référence ayant une cible déjà sous la dose minimale, garde
  « le reste de la semaine, sous la dose minimale : c'est le dernier jour ».
- F87 : sous un arbitrage validé, le chemin est le même : une allocation que
  son débordement fait passer sous la dose minimale est placée le dimanche,
  au lieu de rester non attribuée.

**Ce qui ne change pas.** La limite journalière, la pompe, la plage
horaire et les créneaux refusés ou protégés gardent la dose minimale, comme
pour un reste qui l'atteint hors pénurie ; la somme des volumes d'une
chaîne ne dépasse jamais son budget ; en milieu de semaine, la borne et la
redistribution de D-037. Aucune migration. Vérifié par deux tests de
`tests/planning-shortage.test.ts` (sous la conduite : rien mardi ni samedi,
dimanche la part entière moins le débordement, la somme des volumes égale
au budget ; sous arbitrage : rien en semaine, dimanche plus rien de non
attribué), rouges sur le moteur d'avant ; les 1 301 tests existants
passent sans changement.

**En ligne** : #14 du dépôt public fusionnée le 12 novembre 2026 à 13 h 02
(`5522a04`) et déployée à 13 h 14 (run 43214382568, les quatre jobs réussis ; aucune
migration, Workers inchangés).


## D-082 — Les parcours navigateur ne dépendent plus de l'heure, et le champ de la pluie suit le dernier jour choisi (points ouverts 49 et 50) : quatre précisions tranchées par la recommandation

Date : 9 novembre 2026. Statut : appliquée, sous la conduite de
l'assistant ; modifiable à la relecture du porteur.

**Constat.** Les 8 et 9 novembre 2026, pendant les PR des corrections 3 et
4 de la 3.9, des parcours ont échoué selon l'heure, sur `main` comme sur les
branches. La nuit après minuit à la ferme (point ouvert 49), P4, P9 et P31
échouaient : `horodatageLocal` écrivait les dates à l'heure de la machine
qui joue les parcours, UTC en intégration continue comme dans les
conteneurs, alors que la page les lit à l'heure de la ferme ; l'heure
saisie reculait d'une heure en hiver, de deux en été. Le lundi (point
ouvert 50), P12 voyait le champ « Millimètres » de la pluie mesurée rester
vide : choisir la veille, dans la semaine passée, faisait charger cette
semaine, et la réponse, arrivée après le retour à aujourd'hui, remplaçait
la semaine affichée et vidait le champ. Une course réelle de la page, que
le parcours, plus rapide qu'une main, déclenchait selon les délais du
serveur : deux échecs sur cinq passages dans la nuit du 9 novembre. Le
contrat des parcours promettait déjà qu'un parcours ne dépend pas de
l'heure (« Reproductibilité ») ; rien ne le garantissait.

**Précisions** (techniques, sans règle agronomique ; consignées au contrat
des parcours, `docs/browser-journeys-contract.md`, et au contrat des
besoins, `docs/irrigation-needs-contract.md`) :

- F88 : les dates et heures qu'un parcours saisit s'écrivent à l'heure de
  la ferme, par le formateur de l'application
  (`formatIrrigationDateTimeInput`), quel que soit le fuseau de la machine.
- F89 : une irrigation déjà réalisée qu'un parcours cherche ensuite dans la
  semaine, le mois ou la saison en cours finit à la minute précédente (P4,
  d'une demi-heure ; P9, d'une heure) : une période la compte dès qu'elle la
  chevauche. Seul reste le passage d'une période à la suivante, à une ou
  deux minutes près, où aucune irrigation passée ne peut encore appartenir
  à la nouvelle.
- F90 : sur la page des besoins, le champ « Millimètres » et la semaine
  affichée suivent le dernier jour choisi : chaque choix de jour est
  numéroté, et la réponse d'un choix dépassé est ignorée. Les autres
  chargements de semaine ne changent pas : les flèches et « Cette semaine »
  sont grisés pendant un chargement.
- F91 : P12 joue la course à chaque passage, quel que soit le jour : il
  retient la réponse d'un jour de la semaine passée jusqu'après le retour à
  aujourd'hui, puis vérifie que le champ montre toujours « 0 » et que la
  semaine affichée reste celle d'aujourd'hui.

**Ce qui ne change pas.** Aucun calcul, aucune migration. Le point ouvert
48, le dimanche soir, reste ouvert : à quelques heures de la fin de la
semaine, le planning n'a presque plus de place pour proposer un arrosage,
et P28 ou P12 échouent par moments ; sa cause exacte reste à établir, dans
une PR à part.

**Vérifié par** `tests/parcours-heure.test.ts`, rouge avant la correction
(une machine en UTC écrivait « 2026-11-08T23:30 » pour 0 h 30 à la ferme le
lundi 9 novembre), et par l'étape nouvelle de P12, rouge avant la
correction aux deux largeurs (« Expected: "0" », « Received: "" ») ; les
1 303 tests existants et les 84 parcours passent.

**En ligne** : #15 du dépôt public fusionnée le 12 novembre 2026 à 13 h 31
(`268adc9`) et déployée à 13 h 44 (run 43218749629, les quatre jobs
réussis ; aucune migration, Workers inchangés).

## D-083 — L'écran d'arbitrage façon plan d'assolement (2 bis de la 3.9) : la maquette validée, et six précisions tranchées par la recommandation

Date : 9 novembre 2026, 11 h 40. Statut : appliquée, sous la conduite de
l'assistant ; modifiable à la relecture du porteur.

**Décision du porteur.** La maquette de l'écran d'arbitrage présenté comme
un plan d'assolement (D-078), soumise le 8 novembre 2026 à 22 h 55 sur des
données d'exemple, est validée par lui le 9 novembre 2026 à 11 h 40 : « Je
valide la plaquette. » Son code passe par la section « L'écran d'arbitrage
façon plan d'assolement » du contrat de la 3.9 (`docs/shortage-contract.md`,
2 bis).

**Précisions** (de présentation ou techniques, sans règle agronomique ;
consignées à cette section du contrat) :

- F92 : au départ, toutes les planches à choisir sont cochées : c'est la
  proposition. Un choix devenu caduc repart d'elle ; ses exclusions ne
  ressuscitent pas (3.4). Rien n'est enregistré avant « Valider la
  répartition ».
- F93 : la part et le bilan se recalculent dans le navigateur, à chaque
  case, sans requête, par la fonction même du serveur
  (`allocateIrrigationWater`), avec ce choix à la place de celui du niveau
  et les autres décisions telles quelles : la validation retrouve ces
  chiffres tant que rien n'a changé ; sinon la garde du serveur (révision et
  signature) refuse et demande de recalculer.
- F94 : la frise couvre dix-huit semaines à l'ordinateur (huit avant, neuf
  après), huit au téléphone (trois avant, quatre après) : une barre par
  culture de la planche, la récolte hachurée, une culture à venir en
  pointillé ; une même espèce garde sa teinte d'une planche à l'autre.
- F95 : « Cette semaine » : la phrase de la culture en place la plus
  ancienne, par la première règle qui s'applique (point 4 du contrat) ;
  dessous, le stade et le Kc du jour, à titre d'information, et la prochaine
  culture prévue.
- F96 : deux vues, « Planches à choisir » et « Toute la ferme », où les
  autres planches portent leur état ; deux lignes rappellent ce que
  reçoivent les niveaux d'avant et d'après. Une planche se présente en ligne
  quand l'écran est large, en carte quand il est étroit, selon la place
  réellement disponible et non la seule largeur de l'appareil.
- F97 : les cultures et leur stade ne se lisent que pour cet écran, dans le
  chargement de la faisabilité, quand un niveau demande un choix ; le
  planning, qui relit la faisabilité, ne les lit pas. Une erreur de lecture
  du stade n'empêche pas l'écran : la frise s'affiche sans stade, et le
  journal le note.

**Ce qui ne change pas.** Le calcul de la faisabilité (3.4), la décision
enregistrée, sa garde et son journal ; le planning, qui réserve sa part à
chaque planche servie sans la redistribuer (D-077). Aucune migration.

**Vérifié par** `tests/arbitration-preview.test.ts` et
`tests/arbitration-crops.test.ts`, rouges avant le code (module
introuvable), et P7, rouge avant le code aux deux largeurs (le titre de
l'écran introuvable) ; les 1 315 tests et les 84 parcours passent.

**En ligne** : #17 du dépôt public fusionnée le 12 novembre 2026 à 14 h 02
(`8d72b49`) et déployée à 14 h 13 (run 43223463035, les quatre jobs
réussis ; aucune migration, Workers inchangés).

## D-084 — Les scénarios de pénurie en tests du moteur (lot 3 de la 3.9) : huit défauts relevés, cinq précisions tranchées par la recommandation

Date : 9 novembre 2026. Statut : appliquée, sous la conduite de
l'assistant ; modifiable à la relecture du porteur.

**Constat.** Le lot 3 de la 3.9 écrit en tests du moteur les scénarios de
pénurie du contrat (`docs/shortage-contract.md`) qui n'en avaient pas, sans
changer aucun comportement : un test rouge y est un défaut, corrigé à part.
S3, S12, S13 et S18 l'étaient déjà par les quatre corrections. S2, S4, S10
étendu, S23, S24, S26 et l'isolation S28 tiennent ; S7, S8 et S9 tiennent
en partie ; S6 et S20 non. Huit défauts relevés, inscrits comme points
ouverts 51 à 58 de l'état du projet : la tuile « Manque d'eau » à zéro sur
un stock inconnu (51) ; une pompe archivée qui laisse son matériel proposé
« non vérifié » (52) ; une ressource inactive, ou hors de sa période,
nommée « stock et ressources insuffisants », et une réserve inactive
annoncée mobilisable (53) ; la limite de prélèvement d'une source dépassée
par un créneau vérifié sur deux jours et placé sur un seul (54) ; la coupe
d'une source nommée comme celle d'une réserve (55) ; le manque d'une
planche compté en entier sous le premier de ses motifs (56) ; les parts
refaites sur le reste après une validation en pénurie (57) ; et, trouvé en
reproduisant le point 54, la limite journalière d'irrigation d'un arrêté
dépassée de la même façon, sur la ferme des tests à la taille de la ferme
réelle, 22,10 m³ un jeudi pour 15 (S5, 58).

**Précisions** (techniques, sans règle agronomique ; consignées au contrat
de la 3.9, `docs/shortage-contract.md`, scénario par scénario et au point 3
du découpage) :

- F98 : les tests des scénarios vont dans un second fichier,
  `tests/planning-shortage-scenarios.test.ts`, le premier
  (`tests/planning-shortage.test.ts`) approchant la limite de 600 lignes ;
  S10 étendu reste dans le premier, avec S10 et S11.
- F99 : un scénario qui révèle un défaut n'entre pas rouge dans ce lot, et
  aucun test n'est sauté ni marqué « à faire » : ce qui tient est vérifié,
  l'écart est inscrit comme point ouvert avec ses chiffres, et son test
  entre rouge dans la PR `fix/` qui le corrige. S6 et S20, en défaut
  entier, y entrent en entier.
- F100 : les fixtures s'étendent sans changer les tests existants : une
  irrigation planifiée ou validée peut puiser dans la réserve
  (`fromReserve`) ; `withDirectChain` ajoute une seconde chaîne, une source
  à sa pompe de 3 m³/h et sa limite de prélèvement par jour ; les
  invariants vérifient chaque pompe à son propre débit, et la réserve avec
  ses irrigations planifiées, sans les créneaux d'une autre chaîne.
- F101 : S26 est un relevé, comme le contrat le dit : le test vérifie les
  invariants des deux plans et écrit dans son compte rendu les créneaux
  déplacés et l'écart de volume ; il n'échoue pas sur l'écart.
- F102 : l'isolation S28 se vérifie au service, deux exploitations dans la
  même base de test, la même semaine ; l'arbitrage enregistré par A se
  vérifie au dépôt, la faisabilité lisant, dans les tests, des planches
  d'exemple ; l'échec du calcul du matin de A se provoque par un calcul
  enregistré illisible, et la ligne du journal ne nomme personne.

**Ce qui ne change pas.** Aucun calcul, aucun écran, aucune migration : les
tests et les fixtures seulement. Les huit défauts se corrigent chacun dans
sa PR `fix/`, le contrat précisé avant le code et un test rouge d'abord,
après la PR de ce lot ; réunis quand ils touchent le même code, et dans cet
ordre, du plus sérieux au plus léger : 58, 54 et 55, les limites par jour,
le plan proposant d'arroser plus que l'arrêté ou de prélever plus que
l'autorisation ; 57 ; 56 ; 52 et 53, les chaînes indisponibles ; 51,
l'affichage seul. Le point 57 pourra demander l'avis du porteur sur un cas
limite : une irrigation validée au-delà de la part de sa planche.

**Vérifié par** `tests/planning-shortage-scenarios.test.ts` (huit tests :
S2, S4, S7, S8, S9, S23, S24 et S26), le test S10 étendu de
`tests/planning-shortage.test.ts` et le test S28 de
`tests/db/planning-service.test.ts`, verts sur le moteur tel qu'il est ;
les 1 324 tests et les 84 parcours passent.

**En ligne** : #18 du dépôt public fusionnée le 12 novembre 2026 à 14 h 58
(`395b99e`) et déployée à 15 h 09 (run 43232464948, les quatre jobs
réussis ; aucune migration, Workers inchangés).

## D-085 — Les limites par jour vérifiées depuis le début du créneau (points ouverts 54, 55 et 58) : cinq précisions tranchées par la recommandation

Date : 9 novembre 2026. Statut : appliquée, sous la conduite de
l'assistant ; modifiable à la relecture du porteur. Première correction
des défauts relevés au lot 3 (D-084), la plus sérieuse : le plan proposait
d'arroser plus que la limite journalière d'un arrêté, ou de prélever plus
que l'autorisation d'une source. Codée en Opus 5.5 · Max sur le dépôt
public, le contrat du planning précisé d'abord (`docs/planning-contract.md`,
« Où placer les créneaux », point 6), des tests rouges avant le code.

**Les défauts corrigés.** Le moteur jugeait un créneau sur tous ses jours à
la fois, puis le raccourcissait par sa fin : sous la limite journalière
d'irrigation, du dépassement du premier jour qui dépasse ; sous la limite
de prélèvement d'une source, du reste de tous ses jours additionnés. Quand
le premier jour était celui qui bornait, la coupe retirait l'eau du
lendemain et le premier jour restait au-dessus (54, 58) : sur la ferme des
tests en taille, 22,10 m³ un jeudi pour 15 ; sur la petite ferme à 40 mm,
3,05 m³ un mardi pour 3, 5,94 pour 4 ; une source à 2 m³ par jour donnait
4 m³ un mercredi. Et la coupe d'une source se nommait comme celle d'une
réserve, « réserve « Source du bas » au minimum de sécurité » (55). La
garde de la validation, qui comptait déjà jour par jour, refusait ces
créneaux : rien n'est parti au-delà d'une limite par le module.

**Cinq précisions**, techniques, sans règle agronomique nouvelle,
tranchées par la recommandation (mandat « option recommandée par défaut »)
et consignées au contrat du planning ; elles restent modifiables à la
relecture du porteur :

- F103 : un créneau se juge jour civil par jour civil depuis son début,
  chaque jour recevant la part du volume que sa part de la durée porte,
  comme la garde de la validation et les invariants des tests le
  comptent ; il s'arrête à la seconde où le reste d'un de ses jours
  s'épuise. La règle vaut pour la limite journalière d'irrigation et pour
  la limite de prélèvement d'une ressource prélevée directement
  (`fitWithinDailyRemaining`, `lib/domain/planning/supply.ts`).
- F104 : quand c'est son premier jour qui s'épuise avant la durée
  minimale, le créneau part au minuit suivant si sa plage continue au
  moins cette durée, sur le reste du jour suivant, et son moment se dit
  « un jour où la limite … le permet » ; sinon, ou quand c'est un jour
  suivant qui s'épuise, un autre jour est essayé, comme avant. Partir à
  minuit ne rapproche jamais deux arrosages d'une planche : un créneau ne
  part jamais avant le dernier départ de ses planches plus l'espacement.
- F105 : la coupe d'une limite de prélèvement porte son nom, par un motif
  nouveau (`withdrawal-limit`) : sur la carte, « limite de prélèvement de
  « Source du bas » atteinte » ; à la dose, « ce que la limite de
  prélèvement laisse » ; au moment, « un jour où la limite de prélèvement
  le permet » ; pour une planche qu'elle empêche, « limite de prélèvement
  de la ressource atteinte », comptée en manque d'eau comme la limite
  journalière, et rangée sous « Limite de prélèvement atteinte » ; pour
  les experts, D-085. « Ce jour-là », proposé au point 55, est tombé,
  comme pour la limite journalière. Le reste du jour d'une ressource est
  celui que le module calculait déjà, sa limite moins ce qui est pris,
  borné par son débit sur les heures du jour : ce débit ne borne que si
  plusieurs pompes y puisent ensemble plus longtemps que la journée, et
  la coupe se nomme alors aussi « limite de prélèvement ». Une réserve
  garde « réserve au minimum de sécurité ».
- F106 : ce qu'un créneau prend à une ressource directe se compte à la
  part de sa durée tombée chaque jour, non plus à parts égales entre ses
  jours : un créneau de 21 h à 0 h 30 prend six septièmes de son volume à
  son premier jour, jamais la moitié. De même pour les irrigations déjà
  planifiées sur cette ressource.
- F107 : les invariants des tests vérifient aussi la limite de prélèvement
  de chaque ressource, jour civil par jour civil
  (`tests/support/planning-fixtures.ts`).

**Ce qui ne change pas.** La garde de la réserve et ses mots, la part
réservée, la pompe, la plage horaire, les créneaux refusés ou protégés, la
garde de la validation. Aucune migration : les motifs vivent dans le
calcul enregistré, un calcul ancien garde les siens. S24 suit la règle :
la rampe du bloc 2, que le reste du jeudi (1,076 m³) ne tient plus, part
vendredi à minuit au lieu de vendredi à 21 h.

**Vérifié par** `tests/planning-daily-limits.test.ts` (cinq tests : la
ferme en taille à 15 m³, la petite ferme à 3 m³, la source à 2 m³, la
source trop petite pour la dose minimale, les libellés), rouges sur le
moteur d'avant, et par le test S24 ajusté ; les 1 329 tests passent. Sur
un balayage de limites (ferme en taille de 9 à 30 m³, petite ferme de 2 à
6 m³, source de 1 à 6 m³), aucun jour ne dépasse plus sa limite, quand
cinq plans sur dix, et trois sources sur cinq, dépassaient avant ; la
ferme en taille à 15 m³ place tout son besoin, 71,29 m³ au lieu de 70,60,
cinq créneaux partant à minuit le vendredi et le samedi.

**En ligne** : #19 du dépôt public fusionnée le 12 novembre 2026 à 15 h 27
(`833d092`) et déployée à 15 h 42 (run 43237426130, les quatre jobs
réussis ; aucune migration, Workers inchangés).

## D-086 — L'eau déjà validée comptée dans les parts en pénurie (point ouvert 57) : quatre précisions tranchées par la recommandation, le cas limite tranché par le porteur

Date : 9 novembre 2026. Statut : appliquée, sous la conduite de
l'assistant ; modifiable à la relecture du porteur ; le cas limite (F109)
tranché par le porteur le jour même, sur l'option recommandée. Deuxième
correction des défauts relevés au lot 3 (D-084). Codée en Opus 5.5 · Max
sur le dépôt public, le contrat du planning précisé d'abord
(`docs/planning-contract.md`, « Pénurie », « L'eau déjà validée »), des
tests rouges avant le code.

**Le défaut corrigé.** Les parts se calculaient sur les besoins nets de
l'eau planifiée et sur un budget net des prélèvements planifiés : valider
des propositions en pénurie refaisait le partage sur le reste. Sur la
pénurie de la cinquième recette, les quatre tunnels pour 5 m³, les
propositions des tunnels 1 et 2 validées, le recalcul faisait tomber les
tunnels 3 et 4 de 9,76 à 6,46 mm, laissait 0,85 m³ dans la réserve, et
gardait à chaque tunnel validé une part de 1,42 mm qu'aucun créneau ne lui
donnait. Sous un arbitrage, la même validation réduisait chaque allocation
de moitié, sous la dose minimale : plus rien n'était placé.

**La règle**, celle que le point 57 recommandait : les parts sur le besoin
entier et le budget entier de la semaine, l'eau planifiée comptée comme
déjà placée pour ses planches.

**Précisions**, consignées au contrat du planning et modifiables à la
relecture du porteur :

- F108 : l'eau comptée comme déjà placée dans la part d'une planche est
  celle que les irrigations déjà planifiées de la chaîne de son matériel
  lui donneront encore d'ici dimanche — propositions validées ou
  irrigations planifiées à la main, que le moteur ne distingue pas —,
  comptée comme la 3.3 la retire du besoin et comme la chaîne la retire de
  son budget (`remainingPlannedApplications`). L'eau qu'une planche reçoit
  d'une autre chaîne reste retirée de son besoin, hors des parts
  (`validatedWaterOf`, `lib/domain/planning/shortage.ts`).
- F109, le cas limite, agronomique : posé au porteur le 9 novembre 2026,
  « un arrosage validé dépasse la part d'une planche ; reprendre sur
  qui ? », et tranché par lui le même jour à 16 h 22 : « selon la conduite
  choisie », l'option recommandée, déjà codée. Un arrosage validé au-delà
  de la part de sa planche rejoue la conduite, cette planche servie de ce
  qu'elle a reçu : la conduite cherche la plus grande fraction commune du
  besoin de la semaine que le budget paie, niveau par niveau sous les
  priorités, toutes ensemble sous la part égale ; une planche qui a déjà
  plus ne prend rien de plus (`conductFraction`, `shareAt`,
  `commonFraction`). Le report sert sa file dans l'ordre sur le budget net
  de l'eau validée : la fin de la file porte l'excédent.
- F110 : l'eau libérée en fin de tour (D-037) suit la même règle quand une
  planche du niveau a de l'eau validée : elle relève d'abord les planches
  les plus loin de leur besoin de la semaine, et une planche servie
  au-delà des autres n'en prend qu'une fois rejointe. Sans eau validée, la
  redistribution au prorata des manques ne change pas : c'est la même
  règle quand toutes les planches partent de la même fraction
  (`ShareLedger`, `lib/domain/planning/shares.ts`).
- F111 : sous un arbitrage validé, l'allocation d'une planche compte l'eau
  validée de sa chaîne : il ne reste à placer que l'allocation moins cette
  eau. Un arrosage validé au-delà prend sur l'eau de la chaîne ; quand elle
  ne peut plus fournir les autres allocations, ce qui en reste à placer est
  réduit dans la même proportion, par la règle de la décision 1 de la 3.9
  (D-077). L'eau allouée qu'affiche l'écran compte l'eau validée : c'est
  le choix du maraîcher, que la validation ne change pas.
- F112 : la ligne de budget reste celle de ce qui reste à placer, l'eau
  disponible et la demande sans l'eau validée ; la part visée d'un niveau
  qui a de l'eau validée y est la part de sa demande restante que les
  parts réservent, comme sous le report ; sans eau validée, la fraction de
  la conduite, comme avant.

**Ce qui ne change pas.** Le besoin de la 3.3, le budget des chaînes, le
report, la garde de la validation, le calcul enregistré : aucune
migration. Sans eau planifiée sur une chaîne en pénurie, les parts restent
les mêmes : la fraction est, comme avant, l'eau rapportée à la demande.

**Vérifié par** cinq tests du moteur
(`tests/planning-shortage-scenarios.test.ts` : S20 sous la conduite, sous
un arbitrage, un arrosage validé au-delà de sa part, les priorités, l'eau
libérée en fin de tour), rouges sur le moteur d'avant (6,46 mm au lieu de
9,76 ; rien de placé sous l'arbitrage ; 5,27 au lieu de 7,33 ; 5,77 au
lieu de 6,72 ; 17,68 au lieu de 18,23), et un test du service
(`tests/db/planning-validation.test.ts`) : une proposition validée par le
service porte l'origine de sa chaîne, et au recalcul l'autre planche de
la même réserve garde ses 10 mm (6,67 avant). Les 1 335 tests passent.

**En ligne** : #20 du dépôt public fusionnée le 12 novembre 2026 à 15 h 59
(`8e3cca4`) et déployée à 16 h 14 (run 43242971980, les quatre jobs
réussis ; aucune migration, Workers inchangés).

## D-087 — Le manque d'une planche partagé entre la coupe de sa part et son placement (point ouvert 56) : trois précisions tranchées par la recommandation

Date : 9 novembre 2026. Statut : appliquée, sous la conduite de
l'assistant ; modifiable à la relecture du porteur. Troisième correction
des défauts relevés au lot 3 (D-084). Codée en Opus 5.5 · Max sur le dépôt
public, le contrat du planning précisé d'abord (`docs/planning-contract.md`,
« Pénurie », le partage du manque), le test rouge avant le code.

**Le défaut corrigé.** Le résumé comptait tout le manque d'une planche sous
le premier de ses motifs dans l'ordre alphabétique (`summarizeDeficit`) :
une planche coupée à la fois par sa part et par le temps de pompage, ou
par l'espacement, voyait son manque entier compté en temps de pompage, ou
hors des deux tuiles. Sur la ferme de test, dimanche 21 h, la plage des
asperseurs réduite à 21 h – 21 h 30, les tunnels prioritaires, les blocs
bas, la réserve à 4,48 m³ et le forage arrêté : 12,07 m³ demandés,
4,01 m³ placés, et le résumé disait « Manque d'eau 0 m³ » et « Temps de
pompage manquant 6,25 m³ », dont les 5,61 m³ du bloc 2, que sa part à 0 %
prive de tout. Le contrat (S6) veut deux manques distincts, ni l'un dans
l'autre.

**Trois précisions**, techniques, sans règle agronomique nouvelle,
tranchées par la recommandation et consignées au contrat du planning :

- F113 : le manque d'une planche se partage entre ses motifs. Ce que la
  conduite en pénurie ou l'arbitrage lui retire — son besoin moins sa part
  — compte sous le motif de la coupe (« stock et ressources », « limite
  journalière », « report »), en manque d'eau ; le reste — sa part moins
  l'eau placée — sous le premier de ses autres motifs dans l'ordre où le
  résumé les lisait déjà, ou sous la coupe quand aucun autre ne l'explique.
  Une planche sans coupe garde son manque entier sous son premier motif,
  comme avant.
- F114 : la part est celle de la fin du calcul, après la redistribution de
  l'eau libérée (D-037) : l'eau qu'une planche ne peut pas recevoir et
  qu'une autre reçoit à sa place n'est pas un manque de plus. Une planche
  servie en entier par la conduite mais que la pompe n'a pas pu servir, et
  dont la part est allée à une autre, compte son manque en temps de
  pompage : sur S6, le tunnel 1 (0,64 m³), dont le bloc 1 a reçu la part.
- F115 : la note du manque d'eau (D-038) garde sa formule ; ce qu'elle
  impute à « une autre raison que l'eau » n'est plus que ce que le
  placement n'a pas pu servir. Le résumé se calcule hors du moteur, dans
  `lib/domain/planning/deficit.ts`, pour que le moteur reste sous les 600
  lignes.

**Ce qui ne change pas.** Le placement, les parts, les motifs de chaque
planche et leur liste à l'écran, le calcul enregistré : aucune migration ;
un calcul ancien garde le résumé qu'il avait.

**Vérifié par** le test S6 entier (`tests/planning-shortage-scenarios.test.ts`),
rouge sur le moteur d'avant (6,25 m³ de temps de pompage pour 0,64) : sur
le même cas, 6,95 m³ de manque d'eau, 0,64 m³ de temps de pompage,
0,47 m³ d'espacement (le bloc 1), chaque mètre cube sous un seul motif,
leur somme valant demandé moins placé ; la note dit « 1,113 m³ qui
manquent pour une autre raison que l'eau ». Les 1 336 tests passent.

**En ligne** : #21 du dépôt public fusionnée le 12 novembre 2026 à 16 h 31
(`6ff25e1`) et déployée à 16 h 45 (run 43248783998, les quatre jobs
réussis ; aucune migration, Workers inchangés).

## D-088 — L'origine indisponible n'entre dans aucun partage (points ouverts 52 et 53) : quatre précisions tranchées par la recommandation

Date : 9 novembre 2026. Statut : appliquée, sous la conduite de
l'assistant ; modifiable à la relecture du porteur. Quatrième correction
des défauts relevés au lot 3 (D-084). Codée en Opus 5.5 · Max sur le dépôt
public, le contrat du planning précisé d'abord (`docs/planning-contract.md`,
« Pénurie », « L'origine indisponible », la contrainte opposable et les cas
limites), les tests rouges avant le code.

**Les défauts corrigés.** Point 52 : un matériel dont la pompe habituelle
est archivée prenait le chemin « sans pompe habituelle » ; sur la ferme de
test, sa seule pompe archivée, les cinq matériels qu'elle sert restaient
proposés « faisabilité non vérifiée », 12,71 m³ placés comme si elle
servait encore, et une seconde chaîne dont la pompe est archivée faisait
de même (la rampe du bloc 2, 4,21 m³). Point 53 : une ressource directe
inactive, ou hors de sa période toute la semaine, valait zéro au budget,
et la part prise avant le placement nommait la coupe : ses dix planches
portaient « stock et ressources insuffisants d'ici dimanche », 5,61 m³
comptés sous ce motif ; à l'inverse, la ligne de budget d'une réserve
inactive annonçait « 97,01 m³ mobilisables » qu'aucun créneau ne pouvait
prendre.

**Quatre précisions**, techniques, sans règle agronomique nouvelle,
tranchées par la recommandation et consignées au contrat du planning :

- F116 : une chaîne est indisponible quand rien ne peut en venir d'ici
  dimanche : sa réserve ou sa ressource inactive ou introuvable, sa
  ressource hors de sa période de disponibilité chaque jour du calcul à
  dimanche minuit, ou la pompe habituelle du matériel archivée. Une
  ressource disponible un jour au moins garde le budget de ses jours
  disponibles, comme avant (8 m³ du jeudi au dimanche sur la ferme de
  test). La règle du jour est écrite une fois (`isResourceAvailableOn`,
  `lib/domain/water-resources.ts`), pour le potentiel du jour comme pour la
  semaine.
- F117 : les matériels dont la pompe habituelle est archivée forment, pompe
  par pompe, une chaîne à part, nommée « <nom de la pompe> (pompe
  archivée) » (« pompe habituelle introuvable » si elle manque) : ils ne
  puisent pas dans l'origine de cette pompe, que d'autres pompes peuvent
  servir. Un matériel sans pompe habituelle reste proposé « faisabilité non
  vérifiée ».
- F118 : les planches d'une chaîne indisponible portent « origine d'eau ou
  pompe indisponible » avant la conduite, leur cible à zéro, tout leur
  besoin compté en manque d'eau sous ce motif ; la chaîne n'entre ni dans
  la conduite, ni dans un registre des parts, ni dans la redistribution.
  Sa ligne de budget a zéro d'eau mobilisable, le drapeau `unavailable`
  (absent sur les autres lignes et d'un calcul enregistré avant) et une
  part visée nulle pour chaque niveau qui a une demande ; l'écran y dit
  « indisponible cette semaine, aucune eau mobilisable » pour sa demande.
- F119 : sous un arbitrage validé, ces planches gardent ce seul motif et
  rien à recevoir : leurs allocations, moins l'eau validée de la chaîne,
  s'ajoutent d'avance à ce que les planches allouées ne peuvent pas
  recevoir, sans réduction, et restent non attribuées. La note de
  l'arbitrage reste celle d'avant pour une réserve inactive ; « stock et
  ressources » ne s'ajoute plus à leur motif.

**Ce qui ne change pas.** Le placement sur les autres chaînes, le matériel
sans pompe habituelle, la faisabilité de la 3.4, le calcul enregistré :
aucune migration ; un calcul ancien garde ses lignes de budget.

**Vérifié par** les quatre tests de S8 (`tests/planning-shortage-scenarios.test.ts`),
rouges sur le moteur d'avant : la réserve inactive, sa ligne à zéro et
indisponible (97,01 m³ avant) ; la pompe seule archivée, aucun créneau,
12,71 m³ de manque d'eau sous ce motif, une seule ligne « La pompe (pompe
archivée) », et celle d'une seconde chaîne, la réserve inchangée ; la
source inactive ou hors de sa période, ses dix planches sous ce motif ; et
sous un arbitrage, la réserve inactive ne compte plus 6,35 m³ du manque en
« stock et ressources » (7,10 m³ sous ce motif, 2,80 m³ que l'arbitrage ne
donne pas au bloc 2), « 3,55 m³ alloués à 22 planches ne peuvent pas être
reçus » comme avant, et la pompe archivée ne place plus rien : « 6,354 m³
alloués à 32 planches ne peuvent pas être reçus ». Les 1 339 tests passent.

**En ligne** : #22 du dépôt public fusionnée le 12 novembre 2026 à 17 h 02
(`e8e2db2`) et déployée à 17 h 13 (run 43254267435, les quatre jobs
réussis ; aucune migration, Workers inchangés).

## D-089 — Le manque d'eau non chiffré sur une chaîne à l'eau inconnue (point ouvert 51) : trois précisions tranchées par la recommandation

Date : 9 novembre 2026. Statut : appliquée, sous la conduite de
l'assistant ; modifiable à la relecture du porteur. Cinquième et dernière
correction des défauts relevés au lot 3 (D-084). Codée en Opus 5.5 · Max
sur le dépôt public, le contrat du planning précisé d'abord
(`docs/planning-contract.md`, « Interface (3.6) », le résumé, et le cas
limite du stock inconnu), les tests rouges avant le code. Une correction
d'affichage seule : le moteur ne change pas.

**Le défaut corrigé.** S7, la réserve sans jauge : le moteur propose ses
créneaux « eau non vérifiée », sans budget chiffré ni coupe, et la note
du manque d'eau se tait, comme le contrat l'attend ; mais la carte
« Manque d'eau » du résumé écrivait « 0,00 m³ », un zéro que rien ne
prouve (D-003), au lieu de dire que le manque ne peut pas être chiffré.

**Trois précisions**, techniques, sans règle agronomique nouvelle,
tranchées par la recommandation et consignées au contrat du planning :

- F120 : le manque d'eau ne peut pas être chiffré sur une chaîne servie
  dont l'eau mobilisable est inconnue, c'est-à-dire dont la ligne de budget
  dit « eau mobilisable inconnue » pour une demande : une réserve sans
  stock observé, mais aussi un matériel sans pompe ou sans origine
  renseignée, dont le moteur ne connaît pas l'eau non plus.
- F121 : la carte écrit « non chiffré » quand aucune autre chaîne ne
  chiffre de manque d'eau, « au moins X m³ » sinon, X étant le manque
  chiffré ailleurs ; son sous-titre compte les chaînes à l'eau inconnue
  (« Eau mobilisable inconnue sur une chaîne : le manque ne peut pas y être
  chiffré ») ; la carte ne se colore en manque que pour un manque chiffré.
  La ligne de résumé du téléphone de même : « manque d'eau non chiffré »,
  ou « manque d'eau au moins X ».
- F122 : sous un arbitrage, qui ne rend aucune ligne de budget, la carte
  reste celle d'avant ; un calcul enregistré avant porte ses lignes de
  budget, et la règle s'y lit aussi. Les règles d'écriture vivent dans
  `lib/domain/planning/water-deficit-summary.ts`, testées, le module de
  présentation approchant les 600 lignes.

**Relevé en chemin, corrigé à part** (point ouvert 59) : le pli des
changements d'un recalcul (3.7) compare deux manques d'eau chiffrés ; une
chaîne dont l'eau devient inconnue entre deux calculs — un matériel qui
perd sa pompe habituelle — s'y lirait comme une baisse (« de 3 à 0 m³ »).

**Vérifié par** le test S7 entier (`tests/planning-shortage-scenarios.test.ts`)
et les règles d'écriture de la carte (`tests/planning-presentation.test.ts`),
rouges avant le code : sur la réserve sans jauge, « non chiffré » et la
ligne « manque d'eau non chiffré » ; la rampe du bloc 2 sur une source à
0,5 m³ par jour, « au moins 5,608 m³ ». Les 1 340 tests passent.

**En ligne** : #23 du dépôt public fusionnée le 12 novembre 2026 à 17 h 30
(`ef20c5f`) et déployée à 17 h 45 (run 43259462933, les quatre jobs
réussis ; aucune migration, Workers inchangés).

## D-090 — Le pli des changements d'un recalcul sur une eau inconnue (point ouvert 59) : deux précisions tranchées par la recommandation

Date : 9 novembre 2026. Statut : appliquée, sous la conduite de
l'assistant ; modifiable à la relecture du porteur. Le défaut relevé en
corrigeant le point 51 (D-089), corrigé à part. Codée en Opus 5.5 · Max
sur le dépôt public, le contrat du planning précisé d'abord
(`docs/planning-contract.md`, « L'écran du suivi », le pli « Ce qui a
changé »), les tests rouges avant le code.

**Le défaut corrigé.** Le pli des changements d'un recalcul (3.7)
comparait le manque d'eau chiffré des deux calculs : quand l'eau d'une
chaîne servie devenait inconnue entre les deux — un matériel qui perd sa
pompe habituelle, une réserve sans stock observé —, son manque n'était
plus chiffré, et le pli lisait « Manque d'eau : de 3,00 à 0,00 m³
(−3,00 m³) », une baisse que rien ne prouve (D-003), alors que la carte
dit « non chiffré » depuis D-089 ; l'inverse se lisait comme une hausse.

**Deux précisions**, techniques, tranchées par la recommandation et
consignées au contrat du planning :

- F123 : la comparaison retient, pour le calcul précédent et le nouveau,
  le nombre de leurs chaînes servies à l'eau inconnue, lu sur leurs lignes
  de budget comme la carte (`unknownWaterChainsBefore`,
  `unknownWaterChainsAfter`, deux champs facultatifs de `PlanChanges`,
  absents quand toute l'eau est connue et d'une comparaison enregistrée
  avant, qui se lit comme avant). Aucune migration.
- F124 : quand l'un des deux en a, le pli écrit le manque de chaque côté
  comme sa carte — « non chiffré » ou « au moins X m³ » —, sans écart
  chiffré, et seulement si les deux s'écrivent autrement : « Manque
  d'eau : de 3,00 m³ à non chiffré », « d'au moins 2,00 m³ à 3,00 m³ ».
  Toute l'eau connue des deux côtés, la ligne reste celle d'avant, à cinq
  litres près. Les règles d'écriture de la carte, son sous-titre compris,
  vivent ensemble dans `lib/domain/planning/water-deficit-summary.ts`.

**Vérifié par** les tests de la comparaison
(`tests/planning-changes.test.ts`) et du pli
(`tests/planning-follow-up.test.ts`), rouges avant le code : rien de
retenu, et « de 3,00 à 0,00 m³ (−3,00 m³) ». Les 1 342 tests passent.

**En ligne** : #24 du dépôt public fusionnée le 12 novembre 2026 à 18 h 03
(`854ae13`) et déployée à 18 h 18 (run 43265302502, les quatre jobs
réussis ; aucune migration, Workers inchangés).

## D-091 — Le parcours « Planifier en pénurie » et le protocole vide de la recette finale (lot 4 de la 3.9) : sept précisions tranchées par la recommandation, deux défauts relevés

Date : 9 novembre 2026. Statut : appliquée, sous la conduite de
l'assistant ; modifiable à la relecture du porteur. Écrit en Opus 5.5 · Max
sur le dépôt public, le contrat de la 3.9 (`docs/shortage-contract.md`) et
celui des parcours (`docs/browser-journeys-contract.md`) précisés d'abord.
Le lot 4 ne change aucun comportement : un parcours, deux tests du moteur,
un protocole et les registres.

**Constat.** Le parcours nouveau du contrat de la 3.9 joue la pénurie sur la
ferme de démonstration, aux deux largeurs : il crée sa réserve, sa pompe,
deux lignes et un objectif ; calcule le plan ; lit la ligne de budget et ses
fractions, « Non placé » et son motif, la carte de chaque ligne et sa
justification ; valide une proposition et constate qu'elle compte au
recalcul (S20) ; en refuse une autre, replacée hors du créneau refusé
(S21) ; puis remet tout en état. En l'écrivant, deux défauts relevés,
inscrits comme points ouverts 60 et 61 : sur la page « Ressources et
pompes », la fiche d'une pompe ne voit une réserve créée qu'après le
rechargement de la page (60) ; en pénurie, la carte d'une ligne qui
n'arrose que sa planche justifie sa dose par « le besoin restant de la
planche la plus demandeuse », quand cette dose est la part de la planche
(61). En jouant tous les parcours, un troisième, inscrit comme point
ouvert 62 et corrigé dans une PR qui précède celle de ce lot (D-094) : la
pompe et les deux lignes que P32 laisse archivées ont fait voir à P31c, au
téléphone, des cibles sous 44 px et, sur une ferme neuve, une carte sous
4,5:1. S21 n'avait aucun test du moteur, absent de la liste du lot 3 : ses
deux tests sont écrits ici, et tiennent.

**Précisions** (techniques, sans règle agronomique ; consignées aux deux
contrats) :

- F125 : le parcours s'appelle P32, le prochain numéro libre, le P13 de
  l'écriture du contrat étant devenu celui des alertes météo ; son fichier
  est `e2e/p32-planifier-en-penurie.spec.ts`.
- F126 : sa situation rend la dose indépendante du jour et de l'heure : une
  réserve de 10 m³ observée à 0,3 m³ et non à 2 m³, pour que la part de
  chaque planche, 5,9 mm, tienne en un seul arrosage sous la dose maximale
  du goutte-à-goutte — 2 m³ donnaient 40 mm, quatre arrosages que la
  semaine n'offre plus à partir du vendredi ; deux goutte-à-goutte à
  20 mm/h, l'un sur N02, l'autre sur N03, où aucun parcours ne laisse de
  matériel ni d'irrigation, plutôt qu'un matériel sur N01 à N03 — P6 laisse
  sur N01 une ligne à 25 mm/h qui la servirait (R12), et P3, P4 et P9 y
  saisissent des irrigations ; deux lignes pour que la validation de l'une
  laisse à l'autre sa proposition, à comparer puis à refuser ; une plage du
  goutte-à-goutte qui finit à douze heures au moins du calcul, de 00:00 à
  23:59 le matin, de 12:00 à 11:59 l'après-midi. Reste connu et non
  couvert : le dimanche de 23 h 42 à 23 h 59, la part ne tient plus avant
  minuit.
- F127 : une ligne qui n'arrose que sa planche n'est pas raccourcie par
  les parts — sa dose est la part de sa planche — : P32 lit la dose de la
  carte, la réserve et la faisabilité vérifiée de sa justification, pas le
  motif de la dose (point ouvert 61) ; la coupe par les parts (S15), qui
  demande un créneau versant aussi sur d'autres planches, reste prouvée par
  le test du moteur.
- F128 : S9 sur la ferme de démonstration : P32 lit la ligne de budget de sa
  chaîne parmi celles des matériels sans pompe que les autres parcours
  laissent ; il ne fabrique pas de seconde chaîne chiffrée, que le test du
  moteur prouve dans les deux sens.
- F129 : S21 en deux tests du moteur
  (`tests/planning-shortage-scenarios.test.ts`), sur la pénurie de la
  cinquième recette : le créneau refusé du tunnel 1 est évité, le tunnel 1
  replacé ailleurs avec la même part, les autres gardent la leur ; la
  semaine entière refusée au tunnel 1, ses planches portent « créneau
  refusé », et sa part, libérée en fin de tour, relève la cible des trois
  autres de 9,77 à 13,02 mm — le supplément, 3,26 mm, sous la dose minimale
  de l'aspersion, attend comme un reste hors pénurie (D-081, F84).
- F130 : la non-régression (point 4 du contrat de la 3.9) relève la durée
  des parcours au lieu de la borner : « sous cinq minutes » valait pour
  treize parcours ; les 88 d'aujourd'hui en prennent onze environ.
- F131 : le protocole vide de la recette finale,
  `docs/recette-tranche-3.md`, sur le modèle de `docs/recette-3.4.md` : les
  préalables, la lecture sans rien modifier (A1 à A14), la pénurie fabriquée
  sur le « vas-y » du porteur (B1 à B13, l'attendu chiffré écrit avant le
  clic, les données relevées en 0.3 et rendues en B13), le téléphone (C1 à
  C4), la revue de sécurité (D1 à D7), la non-régression (E1 à E6), les
  scénarios S1 à S28 avec leur preuve attendue, les réévaluations promises
  et la clôture ; chaque ligne porte un constat et un verdict, OK ou KO.

**Ce qui ne change pas.** Aucun calcul, aucun écran, aucune migration ; le
parcours n'écrit que dans la ferme de démonstration et rend tout ce qu'il
crée. Les défauts 60 et 61 se corrigent chacun dans sa PR `fix/`, le contrat
précisé avant le code et un test rouge d'abord, après la PR de ce lot et
avant la revue de sécurité (lot 5) : 61 d'abord, ce que le maraîcher lit en
pénurie, puis 60.

**Vérifié par** P32 aux deux largeurs, les deux tests de S21, et les
contrôles complets ; les 1 344 tests et les 88 parcours passent.

**En ligne** : #26 du dépôt public fusionnée le 12 novembre 2026 à 19 h 06
(`bc99d0b`) et déployée à 19 h 22 (run 43276463105, les quatre jobs
réussis ; aucune migration, Workers inchangés).

## D-092 — Le motif de la dose en pénurie (point ouvert 61) : deux précisions tranchées par la recommandation

Date : 9 novembre 2026. Statut : appliquée, sous la conduite de
l'assistant ; modifiable à la relecture du porteur. Le premier des deux
défauts relevés en écrivant le parcours P32 (D-091), corrigé à part. Codée
en Opus 5.5 · Max sur le dépôt public, le contrat du planning précisé
d'abord (`docs/planning-contract.md`, « La part réservée »), les tests rouges
avant le code.

**Le défaut corrigé.** En pénurie, la cible d'une planche est sa part de la
conduite, et le reste qu'elle a à recevoir est cette part. Une rampe qui
n'arrose que ses planches n'est jamais raccourcie par les parts : sa carte
disait « Pourquoi cette dose : le besoin restant de la planche la plus
demandeuse », que le maraîcher lit comme tout ce qui reste à recevoir, quand
la planche n'en reçoit qu'une part — sur P32, 5,9 mm, le reste compté sous
« stock et ressources insuffisants » dans « Non placé ». Sous un arbitrage,
une allocation sous le besoin se lisait de même. La recette du 10 octobre
2026 (T1) l'avait lu ainsi sans le relever.

**Deux précisions**, techniques, sans règle agronomique nouvelle, tranchées
par la recommandation et consignées au contrat du planning :

- F132 : un créneau que ses parts ne raccourcissent pas, quand la cible de
  sa planche de référence est sous son besoin d'un centième de millimètre
  au moins — sa part de la conduite, ou son allocation sous un arbitrage —,
  porte le motif de dose `shortage-share`, au libellé de la coupe : « la
  part de la semaine réservée à ses planches ». La dose maximale, la dose du
  dernier jour sous la dose minimale et les coupes de la plage, de la pompe,
  des limites, de la réserve et des créneaux refusés ou protégés gardent leur
  motif ; hors pénurie, « le besoin restant » ne change pas.
- F133 : sa contrainte limitante ne passe qu'après celles du moment —
  pompe, limite journalière ou de prélèvement, réserve, créneau refusé ou
  protégé, plage, pluie prévue, espacement — et dit sinon « part de la
  semaine atteinte, le reste est réservé aux autres planches » ; une coupe
  par les parts (`reserved-share`) garde son rang d'avant. Un calcul
  enregistré avant garde son motif ; aucune migration.

**Vérifié par** deux tests du moteur (`tests/planning-shortage.test.ts`),
rouges avant le code : 5 m³ pour quatre tunnels à 20 mm, les quatre rampes
à 9,77 mm disaient `remaining-need` ; sous un arbitrage de 9 mm par planche,
de même ; hors pénurie, à 30 m³, la dose maximale puis le besoin restant.
Le libellé (`tests/planning-presentation.test.ts`) ; P32 lit le motif sur
la ferme de démonstration. Les 1 346 tests passent.

**En ligne** : #27 du dépôt public fusionnée le 12 novembre 2026 à 19 h 39
(`cd49512`) et déployée à 19 h 54 (run 43282133338, les quatre jobs
réussis ; aucune migration, Workers inchangés).

## D-093 — La fiche d'une pompe et les ressources changées (point ouvert 60) : deux précisions tranchées par la recommandation

Date : 9 novembre 2026. Statut : appliquée, sous la conduite de
l'assistant ; modifiable à la relecture du porteur. Le second des deux
défauts relevés en écrivant le parcours P32 (D-091), corrigé à part, après
le premier (D-092). Codée en Opus 5.5 · Max sur le dépôt public, le contrat
des pompes précisé d'abord (`docs/pumps-hydraulic-contract.md`, « La fiche
d'une pompe »), les tests rouges avant le code.

**Le défaut corrigé.** Sur la page « Ressources et pompes », la gestion des
pompes gardait le tableau des ressources et des réserves lu au chargement
de la page : une réserve créée dans le panneau voisin n'apparaissait pas
dans les origines possibles d'une nouvelle pompe, dont la fiche disait
« Créez d’abord une ressource ou une réserve » juste après « La réserve a
été créée. » ; un nom changé ou une réserve rendue inactive se lisaient de
même en retard sur les cartes des pompes, jusqu'au rechargement. Rien
n'était faux en base, mais le maraîcher qui crée sa cuve puis sa pompe
était arrêté sans raison.

**Deux précisions**, techniques, tranchées par la recommandation et
consignées au contrat des pompes :

- F134 : après chaque enregistrement réussi, le panneau des ressources
  signale qu'une ressource ou une réserve a changé
  (`notifyWaterSourcesChanged`, `lib/domain/feasibility-notifications.ts`),
  un signal de la page, sans données ; la gestion des pompes relit alors
  son tableau au serveur par une action en lecture seule
  (`loadPumpDashboardAction`), hors de la transition de ses
  enregistrements, et une relecture cède la place à toute action ou
  relecture plus récente. Une pompe enregistrée ne donne pas ce signal ; le
  serveur vérifie toujours chaque origine à l'enregistrement
  (`assertOriginsOwned`). Une relecture qui échoue le dit sous les pompes.
- F135 : P32 crée sa réserve puis sa pompe sans recharger la page, comme
  un maraîcher ; un test du domaine vérifie le signal, sans données, et
  qu'une pompe enregistrée ne le donne pas
  (`tests/water-sources-signal.test.ts`).

**Vérifié par** P32, rouge avant le code (la ligne de la réserve attendue
dans la fiche, jamais parue), vert après, et le test du signal, rouge
avant : le module n'avait pas ce signal. Les 1 348 tests et les 88
parcours passent.

**En ligne** : #28 du dépôt public fusionnée le 12 novembre 2026 à 20 h 09
(`53044ba`) et déployée à 20 h 26 (run 43287314051, les quatre jobs
réussis ; aucune migration, Workers inchangés).

## D-094 — Une pompe et un matériel archivés, au téléphone et au contraste (point ouvert 62) : trois précisions tranchées par la recommandation

Date : 9 novembre 2026. Statut : appliquée, sous la conduite de
l'assistant ; modifiable à la relecture du porteur. Le défaut relevé en
jouant les parcours du lot 4 de la 3.9, corrigé à part et avant lui : sans
cette correction, le lot 4 n'entre pas vert (F99). Codée en Opus 5.5 · Max
sur le dépôt public, le contrat de l'audit ergonomique précisé d'abord
(`docs/audit-ergonomie-lot3-contract.md`, F69 et F70) et celui des
parcours (P31c), le test rouge avant le code.

**Le défaut corrigé.** La ferme de démonstration n'a ni pompe ni matériel
archivé : P31c, qui mesure les cibles et le contraste de ses douze pages,
ne voyait ni la carte d'une pompe ni le pli des matériels archivés. Le
parcours de pénurie du lot 4 (P32) en laisse, sa remise en état archivant
sa pompe et ses deux lignes, qui ne se suppriment pas ; joué après lui,
P31c au téléphone a trouvé « Modifier » et « Réactiver » d'une carte de
pompe à 39 px et « Matériels archivés (2) » à 36 px, sous les 44 px du
point 14 de l'audit. Sur une ferme neuve, la carte d'une pompe archivée,
voilée à 0,68, mettait aussi « Archivée », « Débit maximal », « Origine
par défaut » et « Origines possibles » à 3,1:1, sous 4,5:1, aux deux
largeurs. Toute ferme qui a une pompe, ou un matériel archivé, avait ces
cibles ; toute ferme qui a une pompe archivée, ce contraste.

**Trois précisions**, techniques, tranchées par la recommandation et
consignées au contrat de l'audit et à celui des parcours :

- F136 : au téléphone (640 px et moins, comme les autres cibles corrigées
  par l'audit), les boutons d'une carte de pompe et « Matériels archivés
  (n) » prennent la hauteur d'une cible, 44 px
  (`app/irrigation/styles/audit-lot3-gestes.css`) ; à l'ordinateur, la
  souris garde les tailles actuelles.
- F137 : un objet archivé se distingue par son fond et son état, jamais
  par un voile qui pâlit ses textes : une pompe archivée prend le fond
  gris clair des matériels archivés et garde « Archivée »
  (`app/irrigation/styles/pumps.css`).
- F138 : P31c mesure, sur une ferme neuve propre au parcours et à la
  largeur, une pompe et un goutte-à-goutte créés puis archivés : « Ressources
  et pompes », plis fermés puis ouverts, et « Matériel », « Matériels
  archivés (1) » replié puis déplié. La PR passe avant celle du lot 4 dans
  la file.

**Vérifié par** P31c, rouge avant le code (39 px, 36 px et 3,1:1), vert
après. Les 1 342 tests et les 86 parcours passent.

**En ligne** : #25 du dépôt public fusionnée le 12 novembre 2026 à 18 h 32
(`f5e2fd2`) et déployée à 18 h 47 (run 43270561040, les quatre jobs
réussis ; aucune migration, Workers inchangés).

## D-095 — La revue de sécurité de la 3.9 (lot 5) : aucun défaut, trois tests d'isolation et une garde écrits, quatre précisions tranchées par la recommandation

Date : 9 novembre 2026. Statut : appliquée, sous la conduite de
l'assistant ; modifiable à la relecture du porteur. Écrit en Opus 5.5 · Max
sur le dépôt public, à la tête de la file des PR de la 3.9 (la branche du
point 60), d'après la section « La revue de sécurité des frontières et de
l'isolation » du contrat de la 3.9 (`docs/shortage-contract.md`). Le lot 5
ne change aucun comportement : cinq tests, la section D de
`docs/recette-tranche-3.md` et les registres.

**Constat.** Les sept points de la revue ne relèvent aucun défaut ; chacun
porte son constat et son verdict dans la section D du protocole. Trois
dépôts n'avaient aucun test où une autre ferme ne lit rien : les poses d'un
matériel et leur registre, l'événement en attente du plan, les saisies du
sol autres que les observations. L'utilisateur de démonstration n'avait que
sa condition « hors production », sans test ; le paquet construit par
`pnpm build`, la commande du déploiement, ne contient plus sa branche. Les
cinq tests sont écrits ici, trois d'isolation et deux pour la garde ;
chacun échoue quand on relâche le filtre ou la garde qu'il protège, puis
repasse. `pnpm audit`, lu une fois : une
vulnérabilité modérée, minimatch, par l'outil de lint, qui relève du lot à
part déjà décidé (eslint 10). Reste la lecture de la configuration Access
dans le Chrome du porteur, sur son mot.

**Précisions** (techniques, sans règle agronomique ; consignées au
protocole) :

- F139 : « les fichiers de `tests/db/` relus un par un » se fait par un
  relevé outillé, puis une lecture : pour chaque fichier, les dépôts qu'il
  importe et ses appels au nom d'un second propriétaire ; puis la lecture de
  chaque dépôt sans tel appel. Les outils du relevé ne sont pas versionnés
  (D7 : aucun scanner nouveau).
- F140 : un dépôt qui ne fait que rassembler des lectures éprouvées
  ailleurs (`db/crop-water/inputs.ts`), ou que le travail de nuit fait lire
  à toutes les fermes par construction, derrière la route interne et son
  jeton (`db/automatic-weather-repository.ts`), est nommé avec sa raison,
  sans test propre.
- F141 : la garde de `LOCAL_DEMO_USER` se teste sur le code : toute lecture
  de la variable dans `app/`, `lib/` et `db/` porte la condition « hors
  production » sur la même ligne, et le seul retour de l'utilisateur de
  démonstration la suit (`tests/access-demo-user.test.ts`). Le paquet
  construit se constate une fois, dans le compte rendu ; aucune étape n'est
  ajoutée à la CI.
- F142 : la section D se remplit au lot 5, sur la tête de la file des PR ;
  la recette finale la relit sur la version déployée (D-014) et y ajoute la
  lecture de la configuration Access, la seule qui attend le porteur.

**Ce qui ne change pas.** Aucun code de l'application, aucune migration,
aucun écran, aucun outil de la CI.

**Vérifié par** les cinq tests nouveaux, rouges filtre ou garde relâché,
et les contrôles complets ; les 1 353 tests et les 88 parcours passent.

**En ligne** : #29 du dépôt public fusionnée le 12 novembre 2026 à 20 h 45
(`d6b797d`) et déployée à 20 h 58 (run 43293482362, les quatre jobs
réussis ; aucune migration, Workers inchangés).

## D-096 — La démo guidée inscrite aux registres : contrat validé, code après la 3.9, Cloudflare sur accord exprès

Date : 8 novembre 2026 (contrat validé), inscrite le 12 novembre 2026.
Documents seuls, aucun code. Le porteur a validé le 8 novembre 2026 le
contrat de la démo guidée (`docs/demo-guided-contract.md`, écrit le 7), qui
ouvre la Tranche 4 (sous-tranche 4.0, ligne 25 de la roadmap).

**Décisions.**

- **Une ferme de démonstration séparée** du même code : Worker propre, base
  D1 propre, aucun secret OTF ; accès sur invitation par courriel ; données
  figées avec une date simulée par scénario ; espace propre par invité,
  remise à zéro par bouton et chaque nuit (choix C1 à C12 du contrat,
  tranchés par la recommandation).
- **Trois fermes fictives et une ferme vierge** (profils A, B, C), uniquement
  des espèces du catalogue Kc validé, **aucune nouvelle valeur agronomique** ;
  quatre moments de saison par profil (gel de printemps, semaine normale
  d'été, pénurie de pic d'été, fin de saison). Réponses du porteur du
  8 novembre 2026 : 1 oui, 2 oui.
- **Cinq couches de garde-fous** pour que la démo ne touche jamais une vraie
  ferme : séparation physique, mode démo qui échoue fermé dans les deux sens,
  pas de réseau sortant, données fictives comparées aux jeux de la ferme réelle,
  isolation par espace.
- **Hébergement** : un second Worker et une seconde base D1 sur le compte
  Cloudflare du porteur, relevé du coût après un mois (réponse 3 du
  8 novembre 2026). Le coût du contrôle d'accès par courriel reste non
  confirmé, très probablement gratuit pour deux ou trois invités.
- **Invités** : Nicolas (Tlaloc) et Vincent, le développeur d'Ouvre ta ferme,
  pour l'instant ; aucune autre ferme avant leurs retours (réponse 4).
- **Découpage** : D1 garde-fous, D2 fermes et saisons, D3 visite guidée, D4
  remise à zéro et déploiement séparé ; une PR chacune, un seul chantier de
  code à la fois.

**Ordre et accords.** Le code vient **après la 3.9** (ordre de la
roadmap, ligne 25, inchangé). Le « vas-y » de D1 à D3 est celui du code ; **D4
touche Cloudflare et demande un accord exprès à part**, après vérification
du coût d'Access dans le tableau de bord et alerte de facturation. Réglage du
code : Opus 5.5 · Élevé (ligne 25), à relire dans le dépôt à jour au
lancement ; Fable est interdit. Aucune connexion de ferme réelle, aucun
jeton OTF, aucun appel OTF en démo.

**Non établi** (section 13 du contrat) : le coût réel du second déploiement,
un avis juridique sur les courriels d'invités et sur l'usage du nom d'OTF,
la liste exacte des espèces des profils B et C.

**En ligne** : #16 du dépôt public fusionnée le 12 novembre 2026 à 14 h 29
(`77a2c0e`) et déployée à 14 h 42 (run 43227755893, les quatre jobs
réussis ; aucune migration, Workers inchangés).

## D-097 — La surface mouillée inconnue en pénurie (point ouvert 63) : quatre précisions tranchées par la recommandation

Date : 12 novembre 2026. Statut : appliquée, sous la conduite de
l'assistant ; modifiable à la relecture du porteur. Le défaut relevé le
jour même en comparant le moteur du module à celui de Tlaloc (le chantier
de la fusion des deux moteurs), inscrit et corrigé avant la recette
finale, comme le porteur l'a voulu. Codée en Opus 5.5 · Max sur le dépôt
public, le contrat du planning précisé d'abord (`docs/planning-contract.md`,
« Pénurie », « La surface mouillée inconnue », et les cas limites), les
tests rouges avant le code.

**Le défaut corrigé.** Dans `lib/domain/planning/shortage.ts`, le volume
d'une planche dont la surface mouillée par son propre matériel est
inconnue — une aspersion sur une planche sans passe-pied renseigné dans
Ouvre ta ferme (D-022) — valait 0 m³ dans le partage de l'eau : la demande
de sa chaîne l'omettait, la conduite en pénurie lui donnait une part que
rien ne comptait, le report ne la reportait jamais, et son matériel partait
au volume inconnu, hors des parts, ce que seule la limite journalière
arrêtait (S5, cas e). Sur la ferme des tests, la réserve de 5 m³ pour les
quatre tunnels, le passe-pied de T1-1 inconnu : sous le report, la rampe du
tunnel 1 recevait 20 mm, 2,56 m³ que rien ne comptait, soit 7,04 m³ placés
pour un budget de 5 ; sous un arbitrage, T1-1, non allouée, recevait 20 mm,
et les allocations des sept autres planches du tunnel se disaient « non
reçues » alors qu'elles l'étaient. Une inconnue n'est jamais zéro (D-003).

**Quatre précisions**, techniques, tranchées par la recommandation et
consignées au contrat du planning :

- F143 : le partage — la demande, la conduite, l'ordre du report, les parts
  réservées et la part placée — ne compte que les planches dont la surface
  mouillée par leur propre matériel est connue ; une autre n'y entre ni à
  zéro ni autrement, et `volumeOf` arrête le calcul plutôt que de la
  compter. La ligne de budget compte ces planches à part
  (`unknownVolumeBedCount`, champ facultatif, absent quand il n'y en a pas
  et d'un calcul enregistré avant), et l'écran écrit « au moins X m³
  demandés (N planches au volume inconnu) ». Aucune migration.
- F144 : la pénurie se juge sur la demande connue. Quand elle dépasse le
  budget de la chaîne, la conduite s'applique, et une planche au volume
  inconnu n'a pas de cible, sous le motif `volume-unknown-under-budget`,
  posé avant la conduite. Hors pénurie, rien ne change : son matériel est
  proposé « volume inconnu », compté à part dans le résumé ; sous une
  limite journalière, la règle d'avant reste (S5, cas e).
- F145 : sur une chaîne dont l'eau est partagée — en pénurie, ou sous un
  arbitrage validé —, le moteur ne propose aucun créneau au volume inconnu ;
  le registre des parts sait que l'eau de sa chaîne est partagée
  (`shortage`). Le motif se juge avant la limite journalière, aucun jour
  n'y changeant rien ; les autres planches du matériel le portent, et leurs
  parts, libérées en fin de tour, vont aux planches que leur matériel peut
  encore servir (D-037) ; sous un arbitrage, leurs allocations comptent
  parmi ce que les planches allouées ne peuvent pas recevoir.
- F146 : les mots. « Volume inconnu en pénurie » pour le groupe de « Non
  placé » ; « volume inconnu en pénurie : le passe-pied d'une planche
  arrosée n'est pas renseigné dans Ouvre ta ferme » pour la planche, qui
  dit le geste qui la rend à son partage au calcul suivant.

**Relevé en chemin, le point ouvert 64** : hors du partage, le manque
d'une planche au volume inconnu compte 0 m³ dans les totaux du plan
(`lib/domain/planning/deficit.ts`) ; à corriger dans sa PR `fix/`, le
contrat précisé et le test rouge d'abord.

**Vérifié par** cinq tests de `tests/planning-shortage-scenarios.test.ts`,
rouges avant le code : les trois conduites, hors pénurie, et sous un
arbitrage. Les 1 358 tests passent.

**En ligne** : #30 du dépôt public fusionnée le 12 novembre 2026 à 21 h 58
(`78e46c7`) et déployée à 22 h 13 (run 43305603699, les quatre jobs
réussis ; aucune migration, Workers inchangés).

## D-098 — Le manque au volume inconnu dans les totaux du plan (point ouvert 64) : quatre précisions tranchées par la recommandation

Date : 12 novembre 2026. Statut : appliquée, sous la conduite de
l'assistant ; modifiable à la relecture du porteur. Le voisin du point
63, relevé en le corrigeant (D-097), corrigé la nuit même, avant la
recette finale : le porteur a voulu que les chantiers s'enchaînent
(« Non, on enchaîne. S'il reste des chantiers, on peut les commencer dès
ce soir. », puis « Je veux que tu enchaînes les chantiers en toute
autonomie toute la nuit. », 12 novembre 2026, 21 h 44), et la carte du
moment de la correction est close sur ces mots (« Cette nuit, après
2 h 30 », la PR ouverte hors des heures fragiles des parcours). Codée en
Opus 5.5 · Max sur le dépôt public, le contrat du planning précisé d'abord
(`docs/planning-contract.md`, « Pénurie », « La surface mouillée
inconnue », le résumé de « Interface (3.6) » et les cas limites), les
tests rouges avant le code.

**Le défaut corrigé.** Dans `lib/domain/planning/deficit.ts`, le manque
d'une planche dont la surface mouillée par son propre matériel est
inconnue — une aspersion sur une planche sans passe-pied renseigné dans
Ouvre ta ferme (D-022) — valait 0 m³ dans les totaux du plan. Sur la
ferme des tests, le dimanche à 21 h, la plage des asperseurs réduite à
vingt minutes, les huit planches du tunnel 1 restent à 20 mm faute de
plage : le passe-pied de T1-1 inconnu, la carte « Temps de pompage
manquant » disait 2,24 m³, comme un total exact (2,56 m³ quand il est
connu) ; la réserve inactive, la carte « Manque d'eau » des quatre
tunnels disait 9,92 m³ (10,24 m³). Sous le report, la note du manque
d'eau écrivait « Demandés 9,92 m³ » quand la ligne de budget dit « au
moins 9,92 m³ demandés ». Rien n'était mal placé : seuls les totaux se
lisaient exacts. Une inconnue n'est jamais zéro (D-003).

**Quatre précisions**, techniques, tranchées par la recommandation et
consignées au contrat du planning :

- F147 : le compte. Le manque d'une planche au volume inconnu n'entre dans
  aucun total ni sous aucun motif, pas même à zéro ; la planche compte à
  part sous chaque total que ses motifs auraient grossi, le manque d'eau
  (les motifs de l'eau) ou le temps de pompage manquant (le temps de
  pompage et la fin de la semaine) : `unknownVolumeBeds`, `{ water,
  pumpTime }`, champ facultatif, absent quand il n'y en a pas et d'un
  calcul enregistré avant. Aucune migration. Le nombre de planches non
  servies ne change pas.
- F148 : les mots, ceux d'une eau inconnue (D-089). La carte du manque que
  le motif aurait grossi écrit « au moins X m³ », ou « non chiffré » quand
  rien d'autre n'en chiffre ; son sous-titre ajoute « une planche au
  volume inconnu, où le manque ne peut pas être chiffré » (« N
  planches »), ou, seule, « Une planche au volume inconnu : le manque ne
  peut pas y être chiffré » ; avec une chaîne à l'eau inconnue, les deux
  se nomment. La carte reste signalée en rouge doux : le manque est sûr,
  son volume seul est inconnu, à la différence d'une eau inconnue, dont le
  manque peut être nul. La ligne de résumé du téléphone et le pli des
  changements d'un recalcul disent de même (`unknownWaterBedsBefore`,
  `unknownWaterBedsAfter`, facultatifs).
- F149 : la note du manque d'eau se tait quand un volume est inconnu —
  celui d'un créneau, comme avant, de la demande d'une planche (point 63)
  ou de son manque — : ses chiffres se liraient exacts.
- F150 : en pénurie ou sous un arbitrage, le manque d'une planche au
  volume inconnu reste sous « volume inconnu en pénurie », une donnée qui
  manque, hors du manque d'eau et du temps de pompage, comme sous une
  limite journalière (S5, cas e) : aucune carte ne s'y lit « au moins »,
  la ligne de budget le dit déjà, et « Non placé » nomme le geste.

**Vérifié par** trois tests de `tests/planning-shortage-scenarios.test.ts`,
rouges avant le code : le temps de pompage, une chaîne indisponible (la
carte, la ligne du téléphone et le pli), et la pénurie sous les trois
conduites. Les 1 361 tests passent.

**En ligne** : #31 du dépôt public fusionnée le 13 novembre 2026 à 2 h 49
(`ac14f6b`) et déployée à 3 h 04 (run 43347699699, les quatre jobs
réussis ; aucune migration, Workers inchangés).

## D-099 — Les invariants sur deux cents semaines étendus aux refus, à l'arbitrage et à deux chaînes (E2 de la recette finale) : deux précisions tranchées par la recommandation

Date : 13 novembre 2026. Statut : appliquée, sous la conduite de
l'assistant ; modifiable à la relecture du porteur. Le contrat de la 3.9
demande pour la clôture « les invariants sur deux cents semaines tirées au
hasard, étendus aux parts, aux refus, à l'arbitrage et à deux chaînes »
(`docs/shortage-contract.md`, « La non-régression complète », point 2) ;
relu pendant la recette finale du 13 novembre 2026, le test de
`tests/planning-engine.test.ts` ne tirait ni refus, ni arbitrage, ni
seconde chaîne. La question — étendre avant la clôture, ou consigner
l'écart — est tranchée par la recommandation, sur le mandat du porteur
(« Tu réponds à tes propres questions avec la réponse recommandée. »,
13 novembre 2026, 8 h 37) : étendre, dans une PR `test/` à part, avant
la PR de clôture, sans changer aucun comportement. Écrit en
Opus 5.5 · Max sur le dépôt public.

**Deux précisions**, techniques, tranchées par la recommandation :

- F151 : le test. Un second test, `tests/planning-invariants.test.ts`,
  plutôt qu'un test réécrit : celui de `tests/planning-engine.test.ts`
  reste tel quel, comme le lot 3 l'a voulu des tests existants (D-084).
  Deux cents semaines à graine fixe sur la ferme des tests et ses quatre
  tunnels, deux calculs chacune, les trois conduites. Au premier calcul,
  tirés au hasard : une seconde chaîne d'eau (`withDirectChain` : une
  source, sa pompe et sa limite par jour) pour un à trois matériels, une
  planche à la surface mouillée inconnue (point ouvert 63), un arbitrage
  validé allouant à une planche sur deux de zéro à 1,2 fois son besoin ;
  la réserve et le forage tirés vers le bas, pour que le manque d'eau et
  ses parts se jouent souvent. Au second calcul : de zéro à deux créneaux
  du premier refusés (D-030), et les créneaux d'un autre matériel de la
  réserve validés, leur eau comptée (`withValidatedProposals`, S20).
  Chaque extension est jouée au moins vingt fois, ce que le test vérifie
  lui-même. Sous un arbitrage, le plan n'a aucune ligne de budget, et ses
  parts réservées ne dépassent jamais les allocations.
- F152 : les invariants. `assertInvariants`
  (`tests/support/planning-fixtures.ts`) vérifie en plus qu'aucun créneau
  ne recouvre, même en partie, un créneau refusé de son matériel (D-030),
  et compte sous la limite journalière l'eau déjà arrosée ou validée du
  jour, comme le contrat l'écrit (« réalisé et validé compris ») : le plan
  n'ajoute que ce que la limite laisse. Les 1 361 tests existants passent
  sous ces invariants plus stricts.

**Vérifié par** deux mutations du moteur, défaites ensuite : sans les
créneaux refusés, le nouveau test échoue sur un créneau posé sur son
refus ; sans l'eau engagée dans le compte de la limite journalière, il
échoue sur un jour où le plan place 3,00 m³ quand la limite de 3 m³ n'en
laisse que 1,08. Une troisième, l'arbitrage sans le budget de sa chaîne,
ne fait échouer aucun invariant : la réserve et le forage bornent le
placement d'eux-mêmes, et l'égalité des allocations réduites reste
prouvée par les tests de S13 (D-077). Aucun défaut relevé. Les 1 362
tests passent.

**En ligne** : #32 du dépôt public fusionnée le 13 novembre 2026 à 10 h 34
(`bd539f8`) et déployée à 10 h 49 (run 43402427168, les quatre jobs
réussis ; aucune migration, Workers inchangés).

## D-100 — La route interne météo derrière Cloudflare Access : le contournement retiré (recette finale de la 3.9)

Date : 13 novembre 2026. Statut : appliquée, sur l'ordre exprès du porteur
(« Tu peux faire le ménage toi-même », 13 novembre 2026, 8 h 41). La
configuration Access, lue le même matin à la recette finale (D3 de
`docs/recette-tranche-3.md`) dans le navigateur intégré de l'app Claude,
sur le mot du porteur, en lecture seule, montrait deux applications :
« Module irrigation », qui couvre le Worker, et « Module irrigation - route
interne », en Bypass « Everyone » sur `/api/internal`, posée le
19 septembre 2026 à la phase 1 de Q0 pour que le planificateur météo
joigne le site par son adresse publique. Depuis la phase 3, le
planificateur passe par la liaison de service `IRRIGATION_SITE`, qui ne
traverse pas Access : le contournement ne servait plus, et laissait la
route ouverte à tout appel, gardée par son seul jeton. Aucun autre appelant
de `/api/internal` dans le dépôt ; la route d'export qui y vivait a été
retirée à la phase 4.

**Fait** : l'application « Module irrigation - route interne » puis sa
règle réutilisable, devenue orpheline, supprimées vers 9 h 15 par
l'assistant, dans le même navigateur, le porteur absent, sur son ordre ;
leur contenu noté pour pouvoir les recréer, sans aucun identifiant
consigné. Rien d'autre n'a changé dans Cloudflare : ni l'application
« Module irrigation », ni sa règle, ni les Workers. Constaté juste après :
`/api/internal/weather-sync` sans session renvoie à la connexion Access, et
avec la session du porteur répond 405, comme le reste du site couvert par
sa règle. Le premier passage du planificateur après le retrait, le
14 novembre 2026 à 6 h 15, reste à constater ; s'il échouait, l'application
se recrée telle qu'elle était, le temps de comprendre.

**Conséquences** : la route garde son jeton partagé, comparé en temps
constant, derrière Access cette fois ; `docs/publication.md`,
`docs/weather-scheduler-contract.md` et `docs/hosting-migration-contract.md`
disent l'état nouveau ; les récits de la phase 1 dans l'état du projet et
la roadmap restent tels quels, annotés. Aucun code, aucune migration.

## D-101 — Vinext : le risque accepté en septembre est levé (réévaluation de D-015 à la 3.9)

Date : 13 novembre 2026. Statut : appliquée par la recommandation du
contrat de la 3.9 (« Les réévaluations promises à la 3.9 »), sur le mandat
du porteur du jour (« Tu réponds à tes propres questions avec la réponse
recommandée. », 8 h 37) ; modifiable à sa relecture. Constat (G1 de
`docs/recette-tranche-3.md`) : la version en service est `1.0.1`, une
version stable, `1.0.0` étant en place depuis le 1er octobre 2026 (PR #121
de l'archive) ; aucun incident attribué à Vinext depuis, ni dans les
registres ni pendant la recette finale. D-015 est close « risque levé » ;
l'épinglage exact de la version et ses mises à jour en lot dédié, testées
par la CI, restent la règle (Q4). Aucun code.

## D-103 — Les garde-fous du mode démo (4.0, D1) : cinq précisions tranchées par la recommandation

Date : 13 novembre 2026. Première PR de code de la démo guidée
(`docs/demo-guided-contract.md`, D-096), codée la nuit du 12 au
13 novembre 2026 sur le mandat du porteur (« Je veux que tu enchaînes les
chantiers en toute autonomie toute la nuit », 12 novembre 2026, 21 h 44),
en Opus 5.5 · Élevé (ligne 4.0 de la roadmap), sur sa branche ; sa PR
s'ouvre après le tag `v0.2.0` de la 3.9, pour que la recette finale porte
sur la version sans D1 (D-014).

**Décision.** Un déploiement est la production ou la démonstration, jamais
un mélange : `DEMO_MODE=true` démarre une démonstration seulement si rien
de réel n'est branché, et le module refuse de démarrer dans les deux sens
(couche 2) ; en démonstration, tout appel réseau sort seulement vers le
domaine Access de l'équipe (couche 3). Les sources sont celles de
démonstration, aucune notification ne part, et une bannière permanente dit
que les données sont fictives.

**Cinq précisions**, consignées au contrat (section 11 bis) : F153 le nom et
les valeurs de `DEMO_MODE` ; F154 le refus de démarrer étendu à tous les
secrets réels et à la liaison au Worker de notification, contrôlé par
`instrumentation.ts` ; F155 l'exception du domaine Access ; F156 les sources
de démonstration forcées et les notifications absentes ; F157 la bannière
sans bouton jusqu'à D4.

**Vérifié par** `tests/demo-mode.test.ts` (le mode dans les deux sens, une
valeur illisible, le réseau refusé vers Ouvre ta ferme, Open-Meteo, Visual
Crossing et le service de notification, l'origine exacte d'Access, la
bannière, aucun écran qui lise le jeton) et `tests/demo-mode-startup.test.ts`
(le démarrage réel par `instrumentation.ts` : refus dans les deux sens, même
par les réglages du Worker ; production inchangée ; en démonstration, les
vrais adaptateurs d'Ouvre ta ferme et de la météo n'émettent aucun appel ;
météo de démonstration sans réglage ; notifications désactivées). Constaté
aussi dans le serveur de développement : avec `DEMO_MODE=true` sur la
configuration de production, chaque page répond « Démarrage refusé : la
démonstration est liée au Worker de notification » ; sans cette liaison, la
bannière s'affiche aux deux largeurs, sans cloche ni défilement de côté, et
le navigateur ne joint aucun hôte extérieur.

**En ligne** : #34 du dépôt public fusionnée le 13 novembre 2026 à 21 h 30
(`eb9ee53`) et déployée à 21 h 45 (run 43502203781, les quatre jobs
réussis ; aucune migration, Workers inchangés) ; la production vérifiée le
soir même dans le navigateur du porteur : « Aujourd'hui » s'ouvre sur les
données réelles, sans bannière de démonstration.

## D-104 — Les fermes fictives et la date simulée (4.0, D2) : quatorze précisions tranchées par la recommandation

Date : 13 novembre 2026. Deuxième PR de code de la démo guidée
(`docs/demo-guided-contract.md`, D-096), codée la nuit du 12 au
13 novembre 2026 sur le même mandat que D1 (D-103), en Opus 5.5 · Élevé,
sur sa branche `feat/demo-d2-fermes-fictives`, posée sur celle de D1 ; sa PR
s'ouvre après celle de D1, donc après le tag `v0.2.0` de la 3.9.

**Décision.** Trois fermes fictives et une ferme vierge, aux noms inventés
et dans trois communes, quatre moments datés de la saison 2026 ; un espace
par invité, par ferme et par moment ; la ferme et le moment choisis dans la
bannière ; la date simulée posée requête par requête par un point d'entrée
propre à la démonstration, la production gardant le sien.

**Quatorze précisions**, consignées au contrat (section 11 ter) : F158
l'espace par ferme et par moment ; F159 le choix dans la bannière et ses
témoins ; F160 la date simulée, au serveur et au navigateur ; F161 les
quatre mardis ; F162 les fermes, leurs noms et la couche 4 ; F163 les
espèces ; F164 la météo des moments ; F165 la ferme vierge et les cases
cochées d'avance ; F166 le matériel et l'eau ; F167 les objectifs adoptés ;
F168 la météo passée et le calcul du matin ; F169 l'historique ; F170 la
météo selon le mois ; F171 une seule préparation.

**Deux questions agronomiques au porteur** (une par message) : les espèces
de chaque ferme (F163) et le sol (aucune valeur de sol du module n'est
fictive : les seules sont celles de sa ferme, interdites ici ;
recommandation : laisser le sol « non renseigné »). **Tranchées par le
porteur le 13 novembre 2026, une carte chacune** : les espèces gardées
telles quelles (« Garder la liste »), le sol laissé « non renseigné »
(« Laisser non renseigné ») ; le code, qui suivait déjà la recommandation,
ne change pas.

**Vérifié par** `tests/demo-farms.test.ts` (le catalogue, les témoins,
l'espace par moment et l'identité forgée refusée, l'horloge simulée au
changement d'heure et sous deux requêtes simultanées, l'horloge du
navigateur, des plans cohérents lus au jour du moment, des espèces du
catalogue validé, la couche 4, un test par moment sur la date et la météo)
et `tests/db/demo-space.test.ts` (les cases cochées d'avance, un espace
jamais réécrit, la ferme vierge sur la liste à cocher, rien hors
démonstration ; les espèces et les seuils de gel rattachés ; deux premières
ouvertures simultanées ; la météo passée sans trou ; les objectifs adoptés ;
le matériel et l'eau ; un test par moment : le gel des 15 et 16 avril
nommé par l'encart, l'été placé sans manque ni gel, la pénurie chiffrée au
pic d'été, la saison passée dans l'historique d'automne ; chaque ferme et
chaque moment préparés sans erreur). Contrôles du 13 novembre 2026, branche
posée sur celle de D1 (elle-même à jour avec `main`, `ac14f6b`) :
lint sans avertissement, typage sans
erreur, 1 419 tests sur 1 419 (33 nouveaux depuis D1), compilation réussie,
knip, `push:check` et `weather:check` sans erreur, 88 parcours sur 88
(9,8 min). Constaté aussi en vrai, le point d'entrée de la
démonstration branché le temps de l'essai sur une configuration locale
sans liaison au Worker de notification (puis remise en état) : chaque page
se joue au jour du moment choisi (14 avril, 16 juin, 21 juillet, 20 octobre)
à l'heure de Paris, au serveur comme dans le navigateur, sans erreur de
console ; au printemps, « Aujourd'hui » annonce le gel des 15 et 16 avril
sur les radis et les tomates ; en été, le plan du matin propose sans manque ;
au pic d'été, il chiffre le manque d'eau (1,8 m³ sur 2,7 m³ demandés,
bassin à 6 m³) ; à l'automne, l'historique a la saison ; la ferme vierge
s'ouvre sur la liste à cocher ; changer de ferme ou de moment dans la
bannière recharge le module dans le bon espace ; aucune page ne déborde à
390 px ; une première ouverture prend de 1 à 3 s dans le serveur de
développement.

**En ligne** : #35 du dépôt public fusionnée le 13 novembre 2026 à 21 h 59
(`5d9ef50`) et déployée à 22 h 16 (run 43506611911, les quatre jobs
réussis ; aucune migration, Workers inchangés). Rien de visible en
production : D2 ne sert que la démonstration ; le déploiement de la
démonstration vient avec D4.

## D-105 — La visite guidée (4.0, D3) : treize précisions tranchées par la recommandation

Date : 13 novembre 2026. Troisième PR de code de la démo guidée
(`docs/demo-guided-contract.md`, D-096), codée la nuit du 12 au
13 novembre 2026 sur le même mandat que D1 et D2 (D-103, D-104), en
Opus 5.5 · Élevé, sur sa branche `feat/demo-d3-visite-guidee`, posée sur celle
de D2 ; sa PR s'ouvre après celle de D2, donc après le tag `v0.2.0` de la
3.9.

**Décision.** Sept visites guidées, une par thème, dans l'ordre du contrat ;
des bulles accrochées aux écrans par `data-tour`, jamais par le texte ni le
menu ; une visite qui montre et ne fait rien à la place du visiteur ; une
étape dont l'élément manque, sautée sans message ; l'étape en cours rangée
dans le navigateur, reprise après un rechargement.

**Treize précisions**, consignées au contrat (section 11 quater) : F172
l'entrée par la bannière ; F173 l'invitation ; F174 les boutons et
« Passer » ; F175 d'une page à l'autre et la pause ; F176 reprenable, et
sans stockage ; F177 l'étape sautée ; F178 les visites offertes à chaque
ferme ; F179 la place de la bulle ; F180 l'accessibilité ; F181 « Et pour
ma ferme ? » en bulles ; F182 la remise à zéro dite en D4 ; F183 les
repères ; F184 les parcours de la démonstration.

**Vérifié par** `tests/demo-tours.test.ts` (les sept visites et leur ordre,
chaque repère posé et utile, des textes courts sans emoji ni sigle laissé
sans son sens, la couche 4 sur les textes, l'étape jouée sur la bonne
page et sautée sinon dans les deux sens, les visites offertes à chaque
ferme, « Passer », le compte des étapes, l'étape rangée relue ou refusée)
et par les parcours `e2e-demo/` V1 à V7, aux deux largeurs : V1 l'invitation,
avancer, reculer, reprendre après un rechargement, Échap et le focus
rendu, « déjà vue », et l'accessibilité mesurée de la bulle et de la
liste ; V2 la visite d'une page à l'autre dans un navigateur qui refuse le
stockage, sans rien démarrer ; V3 le planning ; V4 la pénurie sur trois
pages, la pause ailleurs et la reprise sur un clic ; V5 le gel annoncé ;
V6 Réglages chez la ferme C, puis la première ouverture de la ferme vierge,
l'étape du menu sautée et « Passer » ; V7 les bulles de texte. À chaque
étape : le titre, « étape n sur N », l'élément souligné, le focus, la
bulle dans la fenêtre et au-dessus de la barre des pages, aucun
débordement, aucune erreur de console, aucune écriture. Contrôles du
13 novembre 2026 au soir, branche refaite sur `main` après le tag et posée sur celle de D2 : lint sans avertissement, typage sans erreur, 1 431 tests sur 1 431 (11 nouveaux depuis D2), compilation réussie, knip, `push:check` et `weather:check` sans erreur, 88 parcours sur 88 (12,2 min) et 14 parcours de démonstration sur 14 (1,6 min). Constaté aussi en vrai, aux deux largeurs, sur le serveur de démonstration : les sept visites jouées de bout en bout dans chaque ferme concernée, sans erreur de console ni débordement.

**En ligne** : #36 du dépôt public fusionnée le 13 novembre 2026 à 22 h 35
(`442a9fd`) et déployée à 22 h 51 (run 43512069129, les quatre jobs
réussis ; aucune migration, Workers inchangés). Rien de visible en
production : D3 ne sert que la démonstration.

## D-106 — La remise à zéro et le déploiement séparé de la démonstration (4.0, D4) : neuf précisions tranchées par la recommandation

Date : 13 novembre 2026. Quatrième et dernière PR de code de la démo guidée
(`docs/demo-guided-contract.md`, D-096), codée le soir du 13 novembre
2026 sur le « vas-y » exprès du porteur pour D4, donné le matin même
(8 h 41) pour le moment où le tag `v0.2.0` serait posé, en Opus 5.5 · Élevé, sur
sa branche `feat/demo-d4-remise-a-zero`, posée sur celle de D3. La partie
Cloudflare a été faite le soir même dans le navigateur du porteur, après
qu'il s'est reconnecté lui-même : la base D1 de démonstration créée, le
coût d'Access relu (offre gratuite, un siège sur cinquante, 0 $ par mois),
l'alerte de budget trouvée déjà posée.

**Décision.** La démonstration est un second déploiement du même code,
décrit par `wrangler.demo.jsonc` : son Worker, sa base, son adresse, sans
secret ni liaison au Worker de notification, déployé par la CI après la
production et jamais à sa place. La remise à zéro, au bouton de la
bannière après confirmation ou chaque nuit pour les espaces inactifs depuis
plus de 24 heures, met l'espace de côté au lieu de l'effacer : une seule
écriture, aucune table immuable touchée, et l'invité retrouve à sa requête
suivante un espace neuf. L'accès passe par une application Access propre à
la démonstration, créée après son premier déploiement : d'ici là, rien
n'est joignable.

**Neuf précisions**, consignées au contrat (section 11 quinquies) : F185
remettre à zéro sans rien effacer ; F186 le bouton et sa confirmation ;
F187 le dernier passage ; F188 la tâche de nuit ; F189 le déploiement
séparé ; F190 l'accès et son coût ; F191 le courriel de l'invité ; F192
l'intégration continue ; F193 la visite « Bienvenue » à sept étapes.

**Vérifié par** `tests/db/demo-reset.test.ts` (l'espace remis à zéro rendu
à son premier jour, les autres invités et les autres moments intacts,
l'ancien espace mis de côté et non effacé, deux remises de suite
distinctes, la ferme vierge revenue à sa liste à cocher, le refus hors
démonstration et pour une identité qui n'est pas de démonstration, la
tâche de nuit qui ne vise que les espaces de démonstration inactifs depuis
plus de 24 heures, une seule fois, et le passage noté au plus une fois par
heure), `tests/demo-deployment-config.test.ts` (un autre Worker et une
autre base au même runtime, ni liaison ni source réelle ni réglage de
notification, le mode démo qui accepte la configuration telle qu'écrite,
la tâche de nuit planifiée, le déploiement après la production sur sa
propre base), la compilation de la démonstration vérifiée à blanc par
Wrangler, et le parcours `e2e-demo/` V8 aux deux largeurs. Contrôles du 13 novembre 2026 au soir, branche posée sur celle de D3 :
lint sans avertissement, typage sans erreur, 1 441 tests sur 1 441
(10 nouveaux depuis D3), compilation réussie, knip, `push:check` et
`weather:check` sans erreur, 88 parcours sur 88 (12,1 min), 16 parcours de
démonstration sur 16 (1,7 min) et `demo:check` sans erreur (la
démonstration compilée sur sa configuration et vérifiée à blanc par
Wrangler : sa base, ses cinq réglages, sa tâche de nuit, ni liaison ni
secret).

**En ligne** : #37 du dépôt public fusionnée le 13 novembre 2026 à 23 h 12
(`4942d8f`) et déployée à 23 h 28 (run 43517326592, les cinq jobs
réussis ; aucune migration en production, Workers inchangés). Le job
« Déploiement de la démonstration » a créé le Worker
`module-irrigation-otf-demo`, appliqué les 31 migrations à sa base vide et
enregistré la tâche de nuit (2 h 17 UTC) : le jeton de la CI avait les
droits. Le 14 novembre 2026 à 17 h 30, dans le navigateur du porteur,
l'application Access de la démonstration a été créée depuis l'onglet
« Access » du Worker (tout le trafic, la politique « Porteur du projet »
réutilisée sans la modifier) ; son AUD est posé dans `wrangler.demo.jsonc`
par la PR suivante. Restent les invitations de Nicolas et de Vincent et la
recette réelle.

## D-107 — Style, graphique des réserves et vue satellite inscrits à la roadmap : après le tag v0.2.0, dans cet ordre, un chantier de code à la fois

Date : 13 novembre 2026. Documents seuls, aucun code. Numéro : le premier
libre après D-106 (la démo guidée et la clôture de la 3.9 sont en ligne).

Trois chantiers demandés par le porteur n'étaient inscrits nulle part
dans la roadmap : ils le sont maintenant (section 5 sexies, ligne 24 quater,
tableau de la section 1).

**Décisions.**

- **Style « un peu plus joli » (S1)** : les cinq touches de la maquette du
  porteur, habillage seulement, dans la charte d'Ouvre ta ferme. Le patch
  R5 déjà écrit sur l'archive est **refait sur le dépôt public**
  (`/mnt/project-files/style-plus-joli/`).
- **Graphique des réserves du sol (S2)** : variante B choisie par le
  porteur le 8 novembre 2026, une barre par jardin, les planches en
  points, le prévu de dimanche en pointillé ; aucun calcul nouveau
  (D-047 inchangée) ; une seule PR avec sa section de contrat.
- **Vue satellite (S3)** : « le gratuit » (porteur, 8 novembre 2026,
  11 h 13) : MapLibre GL JS et orthophotos IGN, fond interchangeable pour
  les fermes hors de France, pas de Mapbox ; contour absent traité comme
  un cas normal ; aucune position de planche.
- **Ordre** : après le tag v0.2.0 de la 3.9 (posé) et la démo guidée
  (D1 à D4, en ligne) : S1, S2, S3 ; **l'audit
  ergonomique final** de toutes les pages vient après (captures en
  Sonnet 5.5, analyse en Opus 5.5). Un seul chantier de code à la fois,
  un seul chantier de code à la fois.

**Réglage de chaque chantier** (grille de la roadmap, critères du juge, du
coût d'une erreur non vue, de la liberté de conception et du contexte ;
Fable est interdit, D-055) :

- S1 et S2 : **Opus 5.5 · Élevé**. Ce sont des fonctionnalités délimitées
  sous maquette validée et contrat écrit ; les tests, les parcours et la
  CI jugent, et une erreur d'affichage se voit. C'est la ligne des passes
  R3 et R4.
- S3 : **Opus 5.5 · Très élevé**. Elle ajoute une migration, lit des
  données d'OTF, charge une bibliothèque et un service externes, et rien
  d'équivalent n'existe dans le module : plus de liberté de conception et
  un contexte plus large. Pas Max, car aucune règle agronomique n'est en
  jeu et l'isolation des fermes n'est pas touchée ; à relever à Max si le
  contrat découvre que le rangement des contours croise l'isolation.

**Tranché par la recommandation** (aucune question agronomique) : le
réglage ci-dessus ; l'ordre S1, S2, S3, qui fait précéder le graphique de ses classes de style ; une
seule PR de registres à la fois, celle-ci après la clôture de la 3.9.

**Non établi.** La forme réelle de `coordinates` dans OTF, la
disponibilité d'une tuile IGN depuis le site et les conditions d'usage de
cartes.gouv.fr (à constater par le fil de S3) ; le contenu exact du patch
de style une fois rejoué sur le dépôt public.

## D-108 — Style « un peu plus joli » (S1, troisième passe R5) : cinq touches dans la charte d'OTF, refaites sur le dépôt public

Date : 8 novembre 2026 pour le choix du porteur ; 13 et 14 novembre 2026
pour le code, sur son mandat d'autonomie de la nuit. Décideur : le
porteur, sur une maquette ; les précisions, par la recommandation.

Le porteur trouve le style « plutôt austère » et le veut « un tout petit peu
plus joli, sans trop dénoter avec la charte graphique d'Ouvre ta ferme ».
Sur la maquette https://claude.ai/artifact/L1Sm7H6dCsZXMEk8kqrzyx, il choisit
le 8 novembre 2026 les cinq touches proposées (option recommandée) : une
pastille ronde à icône devant le titre de chaque bloc ; des tuiles de
totaux à filet de couleur, icône et chiffre un peu plus grand ; le bandeau
d'annonce en pointillé vert avec l'étiquette « Nouveau », comme la Boîte à
outils d'OTF ; les cartes qui répondent au survol de la souris ; les
grands états vides illustrés. Codée le jour même sur l'archive (PR 294,
jamais fusionnée, numéro de décision D-074 pris depuis par « Aujourd'hui »),
elle est refaite sur le dépôt public après le tag `v0.2.0`, chantier S1 de
la section 5 sexies de la roadmap (D-107), en Opus 5.5 · Élevé.

Mêmes couleurs, mêmes polices, même disposition ; aucun calcul ni aucun
texte ne change, aucune migration. Les précisions sont consignées dans
`docs/charte-module.md` (« Troisième passe ») ; la principale : le survol
ne soulève pas la carte, il la teinte de vert pâle, pour ne pas poser une
carte blanche dans un bloc blanc (D-068) ni déranger les bulles d'aide.

**Ce que le rejeu change au patch de l'archive**, tranché par la
recommandation (habillage seulement) :

- Le soleil et l'horloge existent déjà dans `line-icon.tsx` (venus avec
  « Aujourd'hui ») : seule la cible s'ajoute ; l'horloge garde le tracé
  qu'elle a, aucune pastille ne l'emploie.
- Les tuiles du planning commencent maintenant par les trois tuiles de
  gestes de l'audit (lot 3) : « À valider » prend le calendrier, « Faites »
  la coche, « En retard » l'alerte ; « Planches non servies » passe de
  l'alerte à la pousse, pour que deux tuiles voisines n'aient pas la même
  icône. Une tuile de geste en retard garde au filet du haut le rouge de
  son filet gauche.
- Les blocs de la page « Aujourd'hui » ont déjà leur pastille, dans le
  composant (`today-block-badge`) : la feuille n'en ajoute pas.
- Les cartes des cultures de référence et des espèces de la saison
  répondent au survol depuis le retour du porteur du 8 novembre 2026 (le
  fond vert de leur résumé) : elles le gardent, sans second fond.

La ligne de ces trois chantiers dans l'ordre de la roadmap (section 2),
numérotée « 24 quater » à son inscription (D-107) alors que ce numéro
était déjà celui de la fusion des deux moteurs, devient « 24 quinquies ».

Ne changent pas : D-060, D-067, D-068, D-107.

## D-109 — Graphique des réserves du sol (S2, variante B) : une barre par jardin, les planches en points, aucun calcul nouveau

Date : 8 novembre 2026 pour le choix du porteur ; 14 novembre 2026 pour le
contrat et le code, sur son mandat d'autonomie de la nuit. Décideur : le
porteur, sur une maquette ; les précisions, par la recommandation.

Le porteur demande le 8 novembre 2026 « une représentation graphique des
réserves du sol par bloc, un peu jolie », lue « par jardin ». Sur la
maquette https://claude.ai/artifact/U6EPngGTvs7qpKfyJ8YfNj, il choisit le
jour même la **variante B** : une barre par jardin ou abri, de 0 à 100 %
du plein, remplie en bleu eau au % du plein de maintenant ; ses planches
en points, orange sous leur seuil ; un trait pointillé pour le prévu de
dimanche ; « inconnue » sans chiffre, jamais zéro. Chantier S2 de la
section 5 sexies de la roadmap (D-107), en Opus 5.5 · Élevé, après le
style (S1, D-108), dont il reprend les jetons et la police des chiffres.

**Décision.** La section « La vue d'ensemble par jardin » de
`docs/soil-reserve-contract.md` en fixe les dix points (place,
barre, points, prévu, inconnue, repères, toucher, accessibilité,
téléphone, charte). C'est un **affichage** : le module
`lib/domain/soil-reserve/garden-bars.ts` range ce que la jauge a déjà
calculé (`garden.percent`, `week`, le résumé de chaque planche), aucun
chiffre n'est nouveau ni absent des plis, D-047 ne change pas. Vérifié au
lancement : le % de la barre est `garden.percent`, la valeur même du titre
du pli, et le prévu de dimanche le dernier jour de `week` du jardin, tous
deux calculés par `soilGaugeView`.

**Sept précisions**, consignées au contrat : F194 une seule règle pour
les points et le % (`countsInGardenPercent`, sortie de
`gardenSoilSummary` sans en changer le résultat) ; F195 rien de dessiné
sur une barre inconnue ; F196 une barre inconnue se touche aussi, la
ligne « aucune planche cultivée » non ; F197 un jardin rangé dans un pli
de jardins pareils ouvre aussi ce pli ; F198 au téléphone, les repères
perdent leur mot ; F199 un % hors de 0 à 100 se place au bord ; F200 la
légende à chaque parcelle.

**En ligne** le 14 novembre 2026 à 5 h 12 (#42, `72e6df6`, run 43554060404),
consigné par la PR du contrat de S3 (D-110).

**Non établi.** La lecture du graphique sur la ferme réelle du porteur et
son jugement visuel, sur la version déployée.

Ne changent pas : D-003, D-006, D-047, D-053, D-107, D-108.

## D-110 — Vue satellite de la parcelle (S3) : contrat MapLibre et orthophotos IGN, sans migration SQL

Date : 8 novembre 2026 pour le choix du porteur ; 14 novembre 2026 pour le
contrat, sur son mandat d'autonomie de la nuit. Décideur : le porteur
(« le gratuit », 8 novembre 2026 à 11 h 13) ; les précisions, par la
recommandation. Sans code, en Sonnet 5.5 · Moyen.

**Décision.** `docs/satellite-view-contract.md` fixe l'onglet « Vue
satellite » du bloc de chaque parcelle de « Matériel et placement » :
MapLibre GL JS (BSD) et orthophotos de l'IGN sans clé, fond « Dessin » en
repli et hors de France, un fond interchangeable sans autre fournisseur livré,
contours des jardins nommés, liste texte à côté, jamais de position de
planche, « contour absent » cas normal, rendu SVG sans WebGL. Précisions F201
à F213. Les contours sont rangés dans le JSON de l'instantané OTF
(`otf_snapshots.payload`, champ `outline` optionnel) : **aucune migration SQL**,
contrairement à ce que la recherche supposait.

**Établi.** Les conditions de cartes.gouv.fr (lues le 14 novembre 2026).
**Non établi, conditions d'entrée du code** : la forme réelle de
`coordinates` sur « Ferme v2 » n° 4394 (aucun jeton dans le fil de contrat) ;
une tuile IGN réelle et son adresse (le relais réseau du bac à sable refuse
`data.geopf.fr`) ; l'attribution exacte et l'usage commercial de la couche
d'orthophotos. Si l'usage multi-fermes n'est pas permis, S3 s'arrête et le
porteur décide.

Ne changent pas : D-001, D-002, D-003, D-047.

## D-111 — Vue satellite (S3), PR 1 : la lecture des contours et le domaine, sans interface

Date : 14 novembre 2026. Décideur : le porteur pour le contrat (« 3 je
valide », 14 novembre 2026 à 15 h 41) ; les précisions, par la
recommandation. En Opus 5.5 · Très élevé, la ligne S3 de la roadmap.

**Décision.** La PR 1 de S3 range les contours qu'OTF envoie déjà
(`coordinates` de `/zoneList` et `/plotList`) dans l'instantané, champ
`outline` optionnel des parcelles et des jardins, par une lecture tolérante
qui ne lève jamais d'erreur et ne fait jamais rejeter l'instantané
(`lib/domain/otf/outline.ts`, F201, F202) ; elle écrit, sans interface, le
cadrage, la décision « en France », le choix du fond, le style de la carte,
ce que l'onglet montre et le dessin de secours en SVG
(`lib/domain/satellite-view/`). Aucune migration, aucune requête de plus à
OTF, aucune dépendance nouvelle : MapLibre arrive avec l'interface, en PR 2.
Précisions F214 à F223 au contrat (section 11).

**Établi.** La condition C : les orthophotos de l'IGN sont sous Licence
Ouverte 2.0, réutilisables à des fins commerciales, donc par un service
multi-fermes ; crédit « IGN » avec lien vers la source, sans caractère
officiel ; blocage possible d'un abus, couvert par le repli « Dessin ».
La ferme de démonstration et les fermes fictives n'ont aucun contour (F211).

**Non établi, conditions de la PR 2.** La forme réelle de `coordinates`
(A, jeton de « Ferme v2 » posé par le porteur) ; une vraie tuile, la couche,
le zoom maximal et la page de crédit (B, dans le Chrome du porteur). Si A
montre une forme que F201 ne lit pas, la lecture s'ajuste avant la PR 2.

Ne changent pas : D-001, D-002, D-003, D-047, D-110.

## D-112 — Démonstration : le jeton Cloudflare Access se vérifie à l'heure réelle, jamais au jour simulé

Date : 14 novembre 2026. Correctif de D4 (D-106), tranché par la
recommandation, en Opus 5.5 · Élevé, sur sa branche
`fix/demo-jeton-access-heure-reelle`.

**Constat.** #45 a posé l'AUD de l'application Access de la démonstration
(en ligne le 14 novembre 2026 à 17 h 58, run 43617026648). À la première
ouverture dans le navigateur du porteur, la démonstration renvoyait vers
`/cdn-cgi/access/login`, page introuvable (404) sur l'adresse workers.dev.
Les journaux du Worker montrent que la requête arrivait bien avec son jeton
Access (`cf-access-jwt-assertion`). Le jeton était refusé : le Worker de
démonstration joue chaque requête au jour simulé du moment choisi (D-104,
C3), le 14 avril par défaut, et un jeton émis le 14 novembre y paraît « pas
encore valide ». Les parcours de démonstration ne l'avaient pas vu : ils
passent par l'utilisateur de démonstration local, sans jeton.

**Décision.** Ce qui se vérifie contre le monde réel se lit à l'heure
réelle. `realNow()` (`lib/services/demo-clock.ts`) rend l'heure réelle même
pendant une requête de démonstration ; elle est lue sur l'horloge installée
plutôt que sur une variable du module, pour rester juste si le module est
chargé deux fois. `app/access-auth.ts` vérifie le jeton (validité, cache des
clés publiques) avec elle. En production, rien ne change : sans horloge
simulée, `realNow()` est `Date.now()`.

**Vérifié par** `tests/access-jwt-demo-clock.test.ts` : au 14 avril simulé,
un jeton émis maintenant est accepté à l'heure réelle et refusé, comme
avant le correctif, à l'heure simulée ; hors démonstration, l'heure réelle
est celle de l'horloge.

Ne changent pas : D-104, D-106.

## D-113 — Vue satellite (S3), PR 2 : l'onglet, après les constats A et B

Date : 14 novembre 2026. Décideur : le porteur pour le contrat (« 3 je
valide », 14 novembre 2026 à 15 h 41) et pour les constats dans son Chrome
(« tu peux y aller », 17 h 22) ; les précisions, par la recommandation. En
Opus 5.5 · Très élevé, la ligne S3 de la roadmap.

**Établi.** A : OTF envoie pour une parcelle et ses jardins un seul anneau
fermé de paires `[longitude, latitude]`, `null` pour un jardin non dessiné,
sans trou ; la lecture de la PR 1 le range tel quel, F201 ne change pas.
B : la couche `ORTHOIMAGERY.ORTHOPHOTOS` répond sans clé, jeu déclaré
`PM_0_19`, zoom maximal 19, « No data found » hors de ses images, aucune
image à l'échelle d'une ferme en Polynésie française ; CORS autorisé depuis
l'adresse du module. Constats au contrat, section 12, sans aucune valeur de
contour ni clé consignée.

**Décision.** Le bloc de la parcelle de « Matériel et placement » reçoit les
onglets « Plan » et « Vue satellite » ; la vue satellite charge
`maplibre-gl` 6.16.0 (version exacte, BSD-3-Clause) à son ouverture
seulement, dessine la parcelle et ses jardins sur les orthophotos de l'IGN
ou le « Dessin », avec la liste des jardins à côté, la bascule mémorisée par
l'appareil et le dessin SVG sans WebGL. L'adresse des tuiles prend le jeu
`PM_0_19`, le crédit mène à la fiche de la donnée BD ORTHO, la Polynésie
française reçoit l'avis « non configuré ». La ferme de démonstration des
parcours navigateur porte des contours inventés sur un lieu fictif pour
jouer les trois cas ; celles de la démonstration guidée n'en ont aucun
(F211 précisé). Précisions F224 à F231 au contrat ; parcours P34. Aucune
migration, aucune requête de plus à OTF, aucune écriture hors le choix de
fond de l'appareil.

Ne changent pas : D-001, D-002, D-003, D-047, D-110, D-111.

## D-114 — Fusion des moteurs, étape 1 : le script des cas de test s'inscrit dans l'ordre d'exécution

Date : 14 novembre 2026. Décideur : le porteur (« Inscris le script dans la
roadmap », 14 novembre 2026), sur la recommandation du coordinateur ; le
réglage, par la recommandation.

**Établi.** Le contrat de fusion des deux moteurs (brouillon v0.1.1) porte
les onze décisions du porteur du 14 novembre 2026 (MC-16 à MC-26), dont
MC-26 : étapes 0 et 1 d'abord, moteur et adaptateur en Opus 5.5 · Max quand
la place de code est libre, ligne de roadmap par une PR de registres à ce
moment. Les dix cas OTF O01 à O10 du dépôt commun sont calculés à la main
et n'ont jamais été exécutés.

**Décision.** L'étape 1 (un script qui fait tourner le code OTF actuel de la
jauge sur les cas O01 à O10 et sur les cas limites du contrat de fusion, et
compare aux valeurs écrites) entre dans l'ordre d'exécution, ligne 24
sexies, **après la vue satellite (S3) et avant l'audit ergonomique final**,
en Opus 5.5 · Élevé, un seul chantier de code à la fois. Le script mesure :
il ne modifie ni le module ni un test existant ; une valeur fausse se
corrige dans le contrat, jamais dans le code du module. Les étapes 2 et 3
restent hors ordre. Toute PR sur le dépôt commun et tout message à Nicolas
restent interdits sans nouvel accord du porteur. Aucune migration, aucune
ligne de code du module.

Ne changent pas : D-065, D-066, D-001, D-003, D-047.

## D-115 — Vue satellite (S3) : la démonstration dessinée, la liste des jardins à la hauteur de la carte

Date : 14 novembre 2026 au soir. Décideur : le porteur pour le constat
(« il n'y a aucune carte qui s'affiche dans la vue satellite de la démo » ;
« je veux que tu mettes un ascenseur […] avec la liste des jardins ») ; la
forme, par la recommandation, sur son mandat. Après #47.

**Constat.** Les fermes de la démonstration guidée n'avaient aucun contour
(F211) : l'onglet n'y montrait que « parcelle non dessinée ». Sur une ferme
qui a beaucoup de jardins, la liste à côté de la carte descendait bien plus
bas qu'elle et repoussait la légende et la suite de la page.

**Décision.** Les trois fermes garnies de la démonstration sont dessinées
(F232), sauf « Le Clos des Saules », et la ferme vierge ne l'est pas : les
contours sont tirés des dimensions d'OTF (F233), sur des lieux inventés à la
campagne près de leur commune (F234), à corriger sur l'avis du porteur s'ils
tombent mal. À l'ordinateur, la liste des jardins ne dépasse pas la hauteur
de la carte et défile seule ; la page enchaîne sous la carte (F235). F211
est remplacée par F232. Contrat, section 13. Aucune migration, rien ne
change au téléphone ni en production hors de la mise en page de la liste.

Ne changent pas : D-110, D-111, D-113.

## D-116 — Fusion des moteurs, étape 1 : le script des cas de test, première mesure

Date : 14 novembre 2026 au soir. Décideur : la recommandation, sur le mandat
d'autonomie du porteur du 14 novembre 2026 (aucune question agronomique).
Après D-114. Contrat : `docs/shared-engine-cases-contract.md`.

**Établi.** Le script `scripts/shared-engine-cases.ts` fait calculer par le
code actuel du module les dix cas O01 à O10 du dépôt commun (copie figée au
commit `43c9de7`, `scripts/shared-engine/cas-otf.json`), lus dans le
fichier, et huit cas limites du contrat de fusion (§ 5), écrits au contrat
du script avant le calcul. Sur `360a73e` : 17 cas conformes, un écart (O07,
le drainage du jour de remplissage), deux valeurs non jouées (O06, la
variante « manque » du jeu Tlaloc).

**Décisions.**

- Les verdicts : conforme à 0,01 près, `null` seulement pour `null` ;
  « conforme, déduit » pour une grandeur que le code ne nomme pas (RU, RAW,
  manque Dr, Kr), déduite de ses sorties ; « non joué » avec sa raison. Un
  écart est un résultat : le script ne s'arrête en erreur que sur un
  fichier de cas illisible ou incomplet.
- O08 ne donne ni besoins ni surfaces : il se joue sur la ferme des tests de
  D-097, au budget écrit (10 m³, où il n'y a pas de pénurie, rapporté), puis
  à 5 m³, où A et B se vérifient.
- **O07 : c'est le cas qui se trompe sur le jeu OTF**, pas le code. Au jour
  qui fait repartir une jauge inconnue par un apport, le code compte un
  drainage de `apports − capacité` (0,7 mm), un minimum, que la pastille de
  l'eau arrosée en trop lit quand l'apport est un arrosage. Correction
  proposée au contrat commun, avec celles d'O08 (statut « exécuté »,
  entrées complétées) : **non appliquée** ; toute PR sur le dépôt commun et
  tout message à Nicolas attendent l'accord du porteur (D-114).

Aucune migration ; aucun fichier de `app/`, `lib/`, `db/` ni aucun test
existant modifié ; un test nouveau, `tests/shared-engine-cases.test.ts`,
écrit rouge avant le script, tient la règle des verdicts sans figer la
mesure.

Ne changent pas : D-003, D-047, D-060, D-097, D-114.

## D-117 — Audit ergonomique final : six lots de correction inscrits, choix consignés sur l'option recommandée

Date : 14 novembre 2026, nuit. Décideur : la recommandation, sur le mandat
d'autonomie du porteur du 14 novembre 2026 (« pousse du code en autonomie
toute la nuit si nécessaire »), aucune question agronomique. Après D-107 et
D-116. Rapport : `audit-ergonomie-final-2026-11-14.md` (analyse en Opus
5.5 · Élevé, sans code ni PR, sur `main` à `21e9cc3`).

**Établi.** L'analyse est rendue : 232 prises, douze des quatorze points du
premier audit tiennent, six constats gênants (R1 à R6) et seize à
améliorer. Elle propose six lots de correction ; les six choix de sa
section 7 sont réservés au porteur.

**Décisions** (toutes à titre provisoire, **à confirmer par le porteur au
réveil ; il peut y revenir**) :

- Les six lots sont inscrits dans l'ordre du rapport, sous les lignes 24
  octies (C, gestes sûrs), 24 nonies (A, le matin), 24 decies (B, pénurie
  lisible), 24 undecies (F, démonstration), 24 duodecies (E, mots et
  chiffres), 24 terdecies (D, pages allégées), chacun en **Opus 5.5 ·
  Élevé** (affichage sans calcul nouveau). Un contrat avant le code, une PR
  par point, un seul chantier de code à la fois.
- Choix n° 1 à 4 : l'option recommandée (les six lots dans cet ordre ;
  « Aujourd'hui » annonce demain et le manque d'eau ; réglages repliés en
  bas de chaque page ; démonstration complétée). Choix n° 5 : mode sombre
  **non prévu pour l'instant**.
- **Choix n° 6 non retenu par défaut** : la séance de lecture dans le
  Chrome du porteur sur sa ferme réelle attend son « vas-y » exprès
  (consigne du projet : tout ce qui touche la ferme réelle).
- Le choix n° 2 change le contrat de la page « Aujourd'hui » validé le
  8 novembre 2026 (`docs/aujourdhui-tableau-de-bord-contract.md`, § 3.5) et
  le n° 3 l'organisation de pages validées : **le code des lots A et D
  attend la confirmation du porteur** ; leurs contrats peuvent s'écrire.
- Les autres points du rapport suivent l'option recommandée : volumes en m³
  à deux décimales, en litres sous 1 m³, millimètres à une décimale ; codes
  R retirés des libellés visibles ; nom de la culture sur la frise ; mots
  harmonisés.
- Si la cause de R2 (l'objectif qui diffère d'une page à l'autre) ou de J4
  (le bon premier geste sur la réserve du sol, D-041, D-047) est dans un
  calcul ou un contrat d'agronomie, le lot s'arrête et le porteur en est
  prévenu avant de coder.

Aucune migration ; aucun fichier de `app/`, `lib/`, `db/` ni aucun test
modifié.

Ne changent pas : D-003, D-041, D-047, D-107, D-116.

## D-118 — Quatre extensions closes sur le mot du porteur, le second audit ergonomique maintenu

Date : 14 novembre 2026, 22 h 30. Décideur : le porteur, en toutes lettres :
« la réserve du sol, le besoin en eau par culture, les alertes météo par
culture et la refonte ergonomique. on peut marquer clos, mais on maintient
le second audit ergonomique ». Après D-117.

**Décision.** Sont marquées **closes** (✅) dans la roadmap : la réserve du
sol (5 ter), le besoin en eau par culture et par stade (5 quater), les
alertes météo par culture (5 quinquies) et la refonte ergonomique (charte du
module). **Maintenus** : l'audit ergonomique final (24 septies) et ses six
lots de correction (24 octies à 24 terdecies, D-117). Les points qu'elles
laissaient ouverts, s'il y en a, restent consignés à leur place dans
`docs/ETAT_DU_PROJET.md` ; la clôture ne les ferme pas.

Aucune migration ; aucun code touché.

Ne changent pas : D-041, D-045, D-047, D-058, D-117.

## D-119 — Audit ergonomique final, lot C : les gestes sûrs, contrat et première PR (R6)

Date : 14 novembre 2026, soir. Décideur : la recommandation, sur le mandat
d'autonomie de nuit du porteur (« pousse du code en autonomie toute la nuit
si nécessaire »), aucune question agronomique ; chaque précision reste
modifiable par lui. Après D-117 et D-118.

**Établi dans le code avant toute correction.** « Retirer la mesure »
portait la classe du bouton secondaire, mais la règle du formulaire en
ligne, plus forte, le repeignait en vert plein comme « Enregistrer ». Au
planning, « Replier le jour » et la validation du jour recevaient la même
règle générale, à 12 px l'un de l'autre ; chaque proposition empilait trois
boutons pleine largeur. Les boutons indisponibles sont rendus transparents
(A3), et le « i » repeint par les règles de bloc (J10) : traités par les
PR 2 et 3 du lot.

**Décisions.**

- Le lot C suit le contrat court
  `docs/audit-ergonomie-final-lot-c-contract.md` : trois PR, une par point
  (R6, A3, J10), une à la fois ; précisions F236 à F242 ; parcours P35.
- R6 : « Retirer la mesure » en contour rouge sur fond blanc, écarté de
  24 px d'« Enregistrer » (F236) ; « Replier le jour » neutre, la validation
  du jour 24 px plus bas au téléphone (F237) ; « Valider » seul sur la
  ligne, « Ajuster » et « Refuser » côte à côte en dessous, 44 px chacun
  (F238). Une feuille de style dernière importée, `gestes-surs.css`, porte
  les règles du lot.
- Aucune fenêtre de confirmation ajoutée ni retirée ; aucun texte de bouton
  changé ; « Tout vider » reste à sa place.

Aucune migration ; aucun calcul, aucune donnée touchés.

Ne changent pas : D-006, D-076, D-117.

## D-120 — Audit ergonomique final, lot C, PR 2 (A3) : les boutons indisponibles se lisent

Date : 14 novembre 2026, nuit. Décideur : la recommandation, sur le mandat
d'autonomie de nuit du porteur, aucune question agronomique ; modifiable
par lui. Après D-119 (contrat court du lot C, section 4).

**Établi dans le code.** Une vingtaine de règles de bloc rendaient un
bouton indisponible transparent (opacité de 0,25 à 0,8) : blanc sur vert
devenu blanc sur `#78AC9C`, 2,4 pour 1. La mesure de contraste du parcours
P31c écartait les boutons indisponibles et n'appliquait la transparence
qu'au texte, jamais au fond : elle ne pouvait pas le voir.

**Décisions.**

- Une seule règle pour tous les boutons indisponibles du module, dans
  `gestes-surs.css` : plus de transparence ; texte `--ink2` sur fond
  `--line-soft`, contour `--line-strong`, 5,5 pour 1 ; le curseur de chaque
  bloc est gardé. Elle passe au-dessus des règles de bloc (`!important`),
  seule façon de la tenir en un endroit (F239).
- « Répartition validée » n'est plus un bouton grisé : une pastille verte
  « ✓ Répartition validée » prend sa place tant que la sélection est celle
  qui a été validée ; une case changée fait revenir « Valider la
  répartition » (F240).
- La mesure de contraste des parcours compte les boutons indisponibles et
  la transparence de chaque élément, fond compris (F241) : P31c la fait sur
  toutes les pages aux deux largeurs ; P7 sur le pied de l'écran
  d'arbitrage.

Aucune migration ; aucun calcul, aucune donnée touchés.

Ne changent pas : D-083, D-119.

## D-121 — Audit ergonomique final, lot C, PR 3 (J10) : le « i » garde son dessin dans tout bloc

Date : 15 novembre 2026, nuit. Décideur : la recommandation, sur le mandat
d'autonomie de nuit du porteur, aucune question agronomique ; modifiable
par lui. Après D-120 (contrat court du lot C, section 5).

**Établi dans le code.** Le « i » (`shell/figure-origin.tsx`) est un rond
de 24 px dont la boîte grandit à 44 px au téléphone sans grandir le dessin
(premier audit, point 2). Ses règles (`styles/help.css`) ne visaient que sa
classe ; un bloc qui peint tous ses boutons (`.bed-crop-water button`, et
d'autres pareils) passait au-dessus : fond vert, marge intérieure, 44 px de
haut. Dans la fiche du besoin de la culture d'une planche, un carré vert de
44 px au téléphone recouvrait « ET0 » et le chiffre voisin ; une pilule
verte de 27 px sur 44 à l'ordinateur. Le planning s'en gardait par une
exception, les autres blocs non.

**Décision.** Les règles du « i » et de la croix de sa bulle sont nommées
par leur parent (`.figure-origin > button.figure-origin-toggle`,
`.figure-origin-bubble > button.figure-origin-close`), ce qui les fait
passer au-dessus de toute règle de bloc, et remettent à zéro ce qu'un bloc
pourrait leur donner (hauteur et largeur minimales, marges, ombre) (F242).
Le parcours P35 mesure chaque « i » fermé de toutes les pages, aux deux
largeurs, et dans la fiche de la planche V01, la carotte rattachée le temps
de la lire puis détachée comme dans P15.

Aucune migration ; aucun calcul, aucune donnée touchés.

Ne changent pas : D-076, D-119, D-120.

## D-122 — Audit ergonomique final, lot B : la pénurie lisible, contrat et première PR (R3)

Date : 15 novembre 2026, nuit. Décideur : la recommandation, sur le mandat
d'autonomie de nuit du porteur (« pousse du code en autonomie toute la nuit
si nécessaire », 14 novembre 2026), aucune question agronomique ;
modifiable par lui. Après D-117 (les six lots) et D-121 (fin du lot C).

**Contrat.** `docs/audit-ergonomie-final-lot-b-contract.md` : R3, R4, R5,
J7 et les remarques 2, 4 et 5 de la recette 3.9, en sept PR, une à la
fois ; affichage seul, aucun calcul de pénurie, de part, de manque ni de
dose ne change. Le bouton « Répartir l'eau » sur « Aujourd'hui » (R4)
touche le contrat de la page validé le 8 novembre 2026 : il va avec le
lot A et attend le porteur.

**Établi dans le code (R3).** Au planning, sous les tuiles, deux notes
s'affichaient d'office (`waterDeficitExplanation`, `arbitrationNote`) :
l'écart entre « demandés », « placés » et « manque d'eau », puis la note de
l'arbitrage ; rien ne disait en une phrase ce qui manque. Sur
« Ressources », la faisabilité alignait huit tuiles avant l'écran de
répartition, qui a déjà les siennes, et un bloc par niveau de priorité,
même sans planche ni besoin.

**Décision (R3).** Au planning, une phrase d'action en tête du résumé quand
l'eau manque, chiffrée au litre au moins, ou sûre sans volume pour une
planche au volume inconnu (D-098) ; une chaîne à l'eau inconnue n'est pas
un manque (D-089) : « Il manque 0,37 m³ d'eau d'ici dimanche : 5 planches ne
recevront pas tout leur besoin. », « Votre répartition s'applique : … »
sous une répartition validée ; les planches comptées sont celles qui
gardent un manque, hors celles qu'aucun matériel n'arrose (F243). Les deux
notes passent dans un repli fermé « Le détail du calcul », sans changer de
texte (F244). Sur « Ressources », quatre tuiles au plus : aucune de plus
que celles de l'écran de répartition quand un niveau attend un choix ;
sinon « Eau disponible », « Besoin de la semaine », « Part servie »,
« Planches servies en entier » ; les huit d'avant, les ressources prises
en compte et le volume supplémentaire potentiel dans « Le détail du
calcul » (F245). Un niveau dont aucune planche n'a de besoin ne s'affiche
pas ; une planche aux données insuffisantes le garde (D-003) (F246).
Parcours P32 et P7 étendus.

Aucune migration ; aucun calcul, aucune donnée touchés.

Ne changent pas : D-003, D-038, D-052, D-083, D-117.

## D-123 — Audit ergonomique final, lot B : le chemin vers la répartition (R4)

Date : 15 novembre 2026, nuit. Décideur : la recommandation, sur le mandat
d'autonomie de nuit du porteur, aucune question agronomique ; modifiable
par lui. Après D-122 (contrat du lot B et R3).

**Établi dans le code.** Le planning ne renvoyait nulle part vers l'écran
de répartition ; sur « Ressources », la faisabilité était la dernière
section (`app/irrigation/ressources/page.tsx`), après les ressources, les
liaisons et les pompes : 11 000 px au téléphone.

**Décision.** La phrase d'action du planning (D-122) se termine par un lien
de 44 px de haut, « Répartir l'eau », ou « Revoir la répartition » sous une
répartition validée, vers `/irrigation/ressources?season=…#repartition`,
seulement quand la partie « faisabilité » est cochée (P1) (F247). Sur
« Ressources », la faisabilité passe en tête de page tant qu'une décision
attend : le dernier plan de la semaine manque d'eau (la même règle que la
phrase) et aucune répartition validée ne s'y applique ; sinon l'ordre
d'avant. Le plan enregistré en décide, lu sans calcul
(`shortageDecisionPending`) ; la faisabilité ne se calcule toujours qu'à
l'approche de sa section (F248). Le bouton « Répartir l'eau » sur
« Aujourd'hui » n'est pas fait : il change le contrat de la page validé le
8 novembre 2026 et va avec le lot A, qui attend le porteur. Parcours P32
étendu.

Aucune migration ; aucun calcul, aucune donnée touchés.

Ne changent pas : D-052, D-083, D-117, D-122.

## D-129 — L'écran de répartition ne relit pas sa propre répartition validée

Date : 15 novembre 2026, nuit. Décideur : la recommandation, sur le mandat
d'autonomie de nuit du porteur (aucune question agronomique) ; modifiable
par lui. Correctif hors des points du lot B, après D-123.

**Constat.** Après la fusion de #57, le parcours P7 a échoué une fois sur
`main` (run 43667252295, projet « telephone ») : « Clicking the checkbox did
not change its state » sur la case de N02, juste après « Valider la
répartition ». Rejoué, le job a réussi ; P7 a réussi sur la PR et en local.

**Établi dans le code.** Après une répartition enregistrée, le tableau de la
faisabilité reçoit le tableau à jour, puis prévient les autres blocs
(`notifyFeasibilityChanged`) ; il écoute lui-même ce signal, si bien que
180 ms plus tard il relance un calcul de la faisabilité, dont il n'a pas
besoin, et ses cases sont indisponibles le temps de ce calcul. Un clic qui
tombe dans cette fenêtre reste sans effet : c'est la cause la plus probable
de l'échec, déduite du code ; l'échec n'a pas été reproduit en local.

**Décision.** Le signal porte le nom du bloc qui l'envoie (`source`), sur
l'événement de la fenêtre comme sur le message du canal ; le tableau de la
faisabilité nomme le sien et l'ignore. Les autres blocs (planning, pompes,
besoins, placements) et les autres onglets relisent comme avant ; un
message sans source, d'un onglet resté sur l'ancienne version, fait relire.
Aucun calcul, aucune donnée ni migration ; aucun test ni parcours n'est
assoupli.

Ne changent pas : D-083, D-120, D-123.

## D-124 — Audit ergonomique final, lot B : la culture sur la ligne de la planche (R5)

Date : 15 novembre 2026, nuit. Décideur : la recommandation, sur le mandat
d'autonomie de nuit du porteur, aucune question agronomique ; modifiable
par lui. Après D-123 (R4) et le correctif D-129. Le numéro suit l'ordre des
points du contrat du lot B, réservé avant le correctif.

**Établi dans le code.** La frise de l'écran de répartition écrit le nom de
la culture au début de chaque bande (`ArbitrationTimeline`) ; au téléphone,
la bande est décalée pour ne montrer que huit semaines, et une culture
commencée avant elles perd son nom. La ligne de la planche ne portait que
son nom et sa surface ; la phrase de la semaine ajoutait le stade et le Kc.

**Décision.** Les cultures en place s'écrivent à côté du nom de la planche,
« A01 · Tomate » (plusieurs séparées par une virgule), à toutes les
largeurs ; « planche nue » quand le plan de culture n'en a aucune ; rien
quand le plan de culture n'est pas lu (F249). La phrase de la semaine garde
le stade ; le Kc, « Kc 1,15 » ou « Tomate : Kc 1,15 » quand plusieurs
cultures sont en place, passe dans l'infobulle de la cellule, pour les
experts, comme les numéros des règles (F48) ; la note de bas de l'écran le
dit (F250). Aucune valeur de Kc ne change. Parcours P7 étendu.

Aucune migration ; aucun calcul, aucune donnée touchés.

Ne changent pas : D-083, D-117, D-122, D-123, D-129.

## D-125 — Audit ergonomique final, lot B : seules les planches en manque se comptent en rouge (J7)

Date : 15 novembre 2026, nuit. Décideur : la recommandation, sur le mandat
d'autonomie de nuit du porteur, aucune question agronomique ; modifiable
par lui. Après D-124 (R5).

**Établi dans le code.** La tuile « Planches non servies », la ligne du
téléphone et le titre du pli comptaient toutes les planches non servies
(`isBedUnplaced`), y compris celles qui n'ont rien à recevoir (« Sans
objectif », manque nul) ; au téléphone, chaque planche du pli prenait six
lignes, une par colonne.

**Décision.** Le compte rouge se fait par groupe de motif : il laisse de
côté les groupes informatifs, ceux dont aucune planche ne garde un manque
d'au moins un centième de millimètre ; les planches qu'aucun matériel
n'arrose y restent toujours, en tête, comme un réglage à faire (audit
ergonomique, lot 3, cas 2). Les planches des groupes informatifs sont dites
à part : « Planches non servies (5) · 5 sans objectif », ou « Planches sans
objectif (2) » quand rien d'autre n'est à compter ; la tuile ajoute « · 5
sans objectif, pour information » (F251). Leur groupe passe en dernier,
titre en gris, sans couleur d'alerte (F252). Au téléphone, une ligne
compacte par planche, en CSS seulement, sans doubler le contenu : « A01 ·
Abri des noues · manque 3,6 mm sur 10,9 mm » et son « i », le motif
dessous ; la priorité seulement quand elle n'est pas normale ; « Placé » à
l'ordinateur seulement (F253). Le contrat du lot B précise F251 dans cette
PR. Parcours P10 et P31 étendus.

Aucune migration ; aucun calcul, aucune donnée touchés.

Ne changent pas : D-040, D-117, D-122, D-124.

## D-126 — Audit ergonomique final, lot B : l'eau qu'une planche reçoit sans part (remarque 2)

Date : 15 novembre 2026, nuit. Décideur : la recommandation, sur le mandat
d'autonomie de nuit du porteur, aucune question agronomique ; modifiable
par lui. Après D-125 (J7). Remarque 2 de la recette 3.9.

**Établi dans le code.** Le pli des planches non servies compte « Placé »
au sens des parts (`placedMm`) ; l'eau que le matériel d'une planche servie
verse aussi sur sa voisine (S16) est dans le créneau
(`bedApplications[].appliedMm`), pas dans la ligne de la voisine. En
« report », une planche reportée sous la rampe d'un bloc servi se lisait
« 0 mm placés » alors que la rampe la mouille comme ses voisines.

**Décision.** La ligne de la planche le dit dans son motif : « ; reçoit
quand même 15 mm du matériel qui arrose ses voisines », quand l'eau des
créneaux proposés ou validés de la semaine, hors des validées dont
l'irrigation est annulée et des refusées, passe ce qui lui est placé d'au
moins 0,05 mm (`waterReceivedWithoutShareMm`). Ni le manque, ni le placé,
ni aucun total, ni aucune part ne changent (F254). Preuve : le jeu S12 du
moteur en report (B2-9 reçoit 15 mm, à l'arrondi des secondes près).

Aucune migration ; aucun calcul, aucune donnée touchés.

Ne changent pas : D-052, D-117, D-125.

## D-127 — Audit ergonomique final, lot B : les parts comptées après l'eau validée (remarque 4)

Date : 15 novembre 2026, nuit. Décideur : la recommandation, sur le mandat
d'autonomie de nuit du porteur, aucune question agronomique ; modifiable
par lui. Après D-126 (remarque 2). Remarque 4 de la recette 3.9.

**Établi dans le code.** Après une validation, la ligne de budget compte
l'eau mobilisable et la demande après l'eau validée (S20, D-086) : la part
de la normale passe de 42 à 27 % (B9) alors que ses planches reçoivent la
même eau. Rien ne le disait.

**Décision.** Le pli « Budget d'eau d'ici dimanche » le dit en tête, quand
la semaine a des arrosages validés : « Les parts se comptent sur ce qui
reste à placer, après les 5,06 m³ déjà validés cette semaine : une part qui
baisse après une validation ne retire pas d'eau aux planches. » Le volume
est la somme des propositions validées dont l'irrigation n'est pas
annulée ; un seul volume inconnu, et la phrase dit « après les arrosages
déjà validés cette semaine », sans chiffre (`budgetValidatedNote`) (F255).
Aucune part, aucun budget ne change. Parcours P32 étendu.

Aucune migration ; aucun calcul, aucune donnée touchés.

Ne changent pas : D-052, D-086, D-117, D-126.

## D-128 — Audit ergonomique final, lot B : le jour au-delà de sa limite journalière (remarque 5)

Date : 15 novembre 2026, nuit. Décideur : la recommandation, sur le mandat
d'autonomie de nuit du porteur, aucune question agronomique ; modifiable
par lui. Après D-127 (remarque 4). Remarque 5 de la recette 3.9 ; dernière
PR du lot B.

**Établi dans le code.** Le plan range les jours qu'une limite journalière
posée après coup met en défaut (`overcommittedDays`, règle 16) ; seule la
cause des suggestions les nommait, la colonne du jour ne disait rien (B11).

**Décision.** La colonne du jour le dit sous son en-tête, en rouge foncé :
« Limite journalière de 1,50 m³ dépassée : 5,06 m³ engagés », les deux
volumes écrits comme ailleurs au planning (`overcommittedDayNotice`) ; rien
pour un jour dans sa limite. Un calcul enregistré avant la 3.7 n'a aucun
jour dépassé et ne dit rien (F256). Aucune limite, aucun volume engagé ni
aucune suggestion ne change. Parcours P12 étendu : après la suggestion
appliquée, le jour ne dit plus rien, ou un volume engagé plus petit quand
d'autres parcours ont déjà arrosé ce jour-là (une première version, qui
exigeait qu'il ne dise plus rien, a échoué en local au téléphone pour
cette raison).

Aucune migration ; aucun calcul, aucune donnée touchés.

**Le lot B est codé en entier** (D-122 à D-128, et le correctif D-129) ;
reste sa recette sur la version déployée, et le bouton « Répartir l'eau »
sur « Aujourd'hui », qui va avec le lot A.

Ne changent pas : D-117, D-127.

## D-130 — Audit ergonomique final, lot E : le contrat, et « Aller au contenu » partout (A1)

Date : 15 novembre 2026, matin. Décideur : la recommandation, sur le mandat
d'autonomie du porteur (« pousse du code en autonomie toute la nuit si
nécessaire »), aucune question agronomique ; modifiable par lui. Après
D-117 (les six lots) et D-128 (fin du lot B).

**Contrat.** `docs/audit-ergonomie-final-lot-e-contract.md` couvre J8, J9,
J11, J12, J15, A1 et A2 (précisions F257 à F273), en sept PR, une à la
fois, dans l'ordre A1, J8, J9, J11, J12, J15, A2. Affichage seul :
l'arrondi n'est qu'un affichage, jamais le calcul ; ni les champs de
saisie, ni l'export CSV, ni les débits ne changent. Sur « Aujourd'hui »,
seulement l'arrondi, les mots et le bandeau de J11 : le contrat de la page
attend le lot A. Les noms de la ferme de démonstration vont avec le lot F.
A2 est mesuré avant d'être corrigé : à 390 px, sur la démonstration et sur
la ferme des parcours, avec les règles de P31c, trois vrais défauts ; les
grands nombres du rapport comptaient la case à cocher (16 px) plutôt que
son étiquette, et les liens pris dans une phrase.

**Établi dans le code (A1).** Le lien « Aller au contenu » vit dans le
gabarit des pages du module ; la première ouverture et la page introuvable
ont leur propre gabarit, sans lui.

**Décision.** Ces deux pages ont le lien en premier arrêt du clavier, vers
leur bloc principal, qui reçoit le focus (F257). Parcours P22 et P27
étendus.

Aucune migration ; aucun calcul, aucune donnée touchés.

Ne changent pas : D-117, D-128.


## D-131 — Audit ergonomique final, lot E : des nombres lisibles (J8)

Date : 15 novembre 2026, matin. Décideur : la recommandation, sur le mandat
d'autonomie du porteur, aucune question agronomique ; modifiable par lui.
Après D-130 (contrat et A1).

**Établi dans le code.** Chaque page avait son format : trois décimales au
plus (`formatWaterVolumeForMessage`, `waterText`, l'historique, la vue par
série, les ressources), deux décimales fixes (« 0,00 m³ »), des
millimètres à deux décimales (l'historique, la faisabilité) ou à une
décimale imposée (« 12,0 mm » dans les arrosages).

**Décision.** Une seule règle d'affichage, `lib/domain/display-numbers.ts`,
que toutes les pages appellent (F260) : un volume en m³ à deux décimales au
plus, sans zéro inutile (« 3,14 m³ », « 12 m³ ») ; sous 1 m³, en litres
entiers (« 425 L ») ; « moins de 1 L » pour un volume non nul plus petit
qu'un demi-litre, jamais « 0 L » ; « 0 m³ » pour zéro (F258) ; des
millimètres à une décimale au plus (F259). Les litres se calculent par
`litersFromCubicMeters` (`lib/domain/units.ts`). `formatWaterVolumeForMessage`
disparaît, remplacée par la règle. Hors de la règle : les champs de
saisie, l'export CSV, la note qu'une validation écrit sur l'arrosage,
l'index d'un compteur, les débits, les vitesses, les réglages rappelés tels
que saisis, les Kc, les surfaces et les distances. Parcours P12 et P32
adaptés (un volume écrit se lit par `e2e/support/volumes.ts`) ; la limite de
0,01 m³ de P12 se lit « 10 L ».

Aucune migration ; aucun calcul, aucune donnée touchés : l'arrondi n'est
qu'un affichage.

Ne changent pas : D-003, D-117, D-130.

## D-132 — Audit ergonomique final, lot E : les mêmes mots d'une page à l'autre (J9)

Date : 15 novembre 2026, matin. Décideur : la recommandation, sur le mandat
d'autonomie du porteur, aucune question agronomique ; modifiable par lui.
Après D-131 (J8).

**Établi dans le code.** L'historique disait « Saisir la pluie » là où
« Aujourd'hui » dit « Noter la pluie de la semaine » ; le planning écrivait
« Valider les 1 proposition du jour » ; « Aujourd'hui » écrivait « Observer
le sol de Abri des noues » ; l'aperçu du matériel préfixait toujours le nom
du réglage par « Réglage », d'où « Réglage Réglage habituel » ; la tuile du
planning appelait « Temps de pompage manquant » un volume en m³.

**Décision.** Un geste, un mot : « Noter la pluie » sur l'historique (F261).
Les accords, par `lib/domain/display-words.ts` (F262) : « Valider la
proposition du jour » quand il n'y en a qu'une ; « de » s'élide devant un
nom donné par la ferme qui commence par une voyelle, accentuée ou non, ou
par œ ou æ (« d'Abri des noues », « d'Étang »), jamais devant un h, qui
peut être aspiré (« de Haut Champ »), ni devant un y. La règle sert aussi au
message « Le K_abri d'… est enregistré » et à la ligne « la surface mouillée
d'… n'est pas connue ». Le réglage nommé une fois (F263) : un nom qui
commence déjà par le mot « Réglage » se lit seul. « Eau non pompée faute de
temps » sur la tuile, « non pompé faute de temps » dans la ligne du
téléphone (F264), le nombre et sa règle inchangés ; le contrat du planning
suit. Parcours P10, P29 et P31c adaptés ; P31c prouve le cas 11, son
réglage s'appelant « Réglage p31c-… ».

Aucune migration ; aucun calcul, aucune donnée touchés : des mots
seulement. Les noms de la ferme de démonstration ne changent pas (lot F).

Ne changent pas : D-117, D-130, D-131.

## D-133 — Audit ergonomique final, lot E : la page non cochée nommée, et où la cocher (J11)

Date : 15 novembre 2026, matin. Décideur : la recommandation, sur le mandat
d'autonomie du porteur, aucune question agronomique ; modifiable par lui.
Après D-132 (J9).

**Établi dans le code.** Une page non cochée renvoyait à la page d'arrivée
avec `?absente=1` : l'adresse ne disait pas quelle page était demandée, et
la ligne ne pouvait dire que « Cette fonctionnalité n'est pas cochée pour
votre ferme. », sans mener nulle part.

**Décision.** L'adresse nomme la page demandée (`?absente=arrosages`) ; la
ligne dit « La page « Arrosages » n'est pas cochée pour votre ferme. » et
porte le lien « La cocher dans Réglages », vers le bloc « Fonctionnalités
de la ferme » (ancre `#fonctionnalites`). Pour « Aujourd'hui », qui n'a pas
de case : « La page « Aujourd'hui » n'a aucune de ses fonctionnalités
cochées pour votre ferme. », lien « Les cocher dans Réglages ». Une ancienne
adresse (`?absente=1`, celle des anciennes ancres de notification), ou une
page inconnue, garde la phrase d'avant, avec le même lien (F265). La page
d'arrivée, et le retrait de `absente` de l'adresse une fois lue, ne
changent pas. Parcours P22 et P23 étendus.

Aucune migration ; aucun calcul, aucune donnée touchés. Sur
« Aujourd'hui », seule cette ligne change (son contrat, lot A, est
intact).

Ne changent pas : D-117, D-130, D-132.

## D-134 — Audit ergonomique final, lot E : les alertes limitées sous le formulaire (J12)

Date : 15 novembre 2026, matin. Décideur : la recommandation, sur le mandat
d'autonomie du porteur, aucune question agronomique ; modifiable par lui.
Après D-133 (J11).

**Établi dans le code.** Sur « Arrosages », le bandeau « Alertes système non
disponibles » venait entre le titre et le formulaire « Enregistrer ou
planifier » ; il ne se repliait, une fois vu, qu'au téléphone (F10). Sur un
appareil où les notifications sont permises, il n'apparaît pas.

**Décision.** Sur « Arrosages », le bandeau d'un état limité (refusé, non
pris en charge, indisponible) vient sous le formulaire, texte inchangé ;
« Recevoir les alertes » et « Alertes activées » gardent leur place
(F266). Il se replie une fois vu à toutes les largeurs, avec le point sur la
cloche du téléphone ; l'ordinateur, qui n'a pas de cloche, retrouve le
rappel complet dans Réglages, qui le garde en entier (F267). Le souvenir
reste sur l'appareil, jamais en base, comme avant. Parcours P28 étendu
(rouge sans le code : le bandeau au-dessus du formulaire).

Aucune migration ; aucun calcul, aucune donnée touchés.

Ne changent pas : D-117, D-133.

## D-135 — Audit ergonomique final, lot E : la vue satellite, dans son repli (J15)

Date : 15 novembre 2026, matin. Décideur : la recommandation, sur le mandat
d'autonomie du porteur, aucune question agronomique ; modifiable par lui.
Après D-134 (J12).

**Établi dans le code.** Le bouton du fond suivait la préférence de
l'appareil, non le fond affiché : sous un fond satellite indisponible ou
non configuré, « Satellite » restait enfoncé sur une carte en contours. La
bascule disait « Satellite » et « Dessin », à côté des onglets « Plan » et
« Vue satellite ». Le nom de la parcelle, déjà titre du bloc, était posé au
milieu de la carte et chevauchait celui d'un jardin. Au téléphone, la carte
pouvait commencer sous l'écran.

**Décision.** Le bouton enfoncé est celui du fond affiché : « Contours »
quand la photo manque ou n'est pas configurée ; toucher « Photo » la
redemande (F268). La bascule dit « Photo » et « Contours », les messages de
repli « les contours seuls » ; les onglets ne changent pas (F269). Le nom
de la parcelle n'est plus posé sur la carte ni sur le dessin SVG ; les
jardins gardent le leur (F270). Au téléphone, choisir « Vue satellite »
amène les onglets en haut de l'écran quand il resterait moins de 200 px de
la carte à l'écran (F271). Le contrat de la vue satellite suit. Parcours
P34 étendu (au téléphone, 142 px de la carte à l'écran sans le code).

Aucune migration ; aucun calcul, aucune donnée touchés.

Ne changent pas : D-117, D-134.

## D-136 — Audit ergonomique final, lot E : les dernières cibles de moins de 44 px (A2)

Date : 15 novembre 2026, matin. Décideur : la recommandation, sur le mandat
d'autonomie du porteur, aucune question agronomique ; modifiable par lui.
Après D-135 (J15). Clôt le code du lot E.

**Établi par la mesure** (D-130, section 9 du contrat). À 390 px, avec les
règles de P31c, il ne restait que trois défauts : les flèches « ← » et
« → » de la semaine d'« Objectifs et besoins » (38 px de large, sans nom
lisible), « + Ajouter une pompe » (43,5 px de haut à la mesure du parcours,
43,8 px à celle de l'audit) et la case « Par analogie (culture proche, pas
la même) » de la correspondance des espèces (19 px de haut). P31c ne
mesurait que la hauteur, arrondie au pixel, et seulement les cases posées
directement dans leur étiquette : il ne voyait aucun des trois.

**Décision.** Les trois cibles font 44 px dans les deux sens ; les flèches
portent « Semaine précédente » et « Semaine suivante » (F272). La nouvelle
mesure en a trouvé une quatrième, que l'audit n'avait pas vue faute
d'alerte envoyée sur sa ferme : « Voir » dans l'historique des alertes
(cultures et météo), 25 px de large au téléphone, porté lui aussi à 44 px. La mesure de
P31c, partagée avec les visites guidées, prend la largeur comme la
hauteur, au dixième de pixel, la zone élargie d'un pseudo-élément dans les
deux sens, et toute étiquette qui contient une case, même enveloppée
(F273). Rouge sans le code : P31c liste les quatre flèches (38,1 px de
large) et « + Ajouter une pompe » (43,5 px). La case « Par analogie » ne
s'affiche qu'une fois une culture choisie dans la correspondance, ce
qu'aucun parcours ne fait : sa hauteur suit la règle CSS, sans mesure de
parcours.

Aucune migration ; aucun calcul, aucune donnée touchés.

Ne changent pas : D-117, D-130, D-135.

## D-137 — Audit ergonomique final : les six choix confirmés par le porteur, lots A et D débloqués

Date : 15 novembre 2026, 15 h 51 et 15 h 52. Décideur : le porteur, en
toutes lettres : « Je suis d'accord avec toutes tes propositions. Toutes
les recommandations. », « Point numéro 2, vas-y. », puis « Numéro 5, je
suis d'accord avec les corrections, vas-y. ». Après D-117 et D-136.

**Décision.** Les six choix de la section 7 du rapport
`audit-ergonomie-final-2026-11-14.md`, consignés à titre provisoire par
D-117, sont **confirmés sur l'option recommandée** : les six lots dans
l'ordre C, A, B, F, E, D ; « Aujourd'hui » annonce les arrosages de demain
à valider et le manque d'eau de la semaine (choix n° 2) ; les réglages de
chaque page rangés dans un pli « Réglages de cette page », fermé, en bas
(choix n° 3) ; la démonstration complétée (choix n° 4) ; le mode sombre
non prévu pour l'instant (choix n° 5) ; la séance de lecture dans le
Chrome du porteur, sur la ferme réelle, en lecture seule (choix n° 6).

- **Le code des lots A et D n'attend plus sa confirmation** ; le lot A
  a son « vas-y » exprès (« Point numéro 2, vas-y. ») et commence le jour
  même (D-138).
- **La séance du choix n° 6 a son accord** ; chaque séance reste ouverte
  avec lui, dans son Chrome, lecture seule, onglets refermés à la fin.
- Ce qui reste réservé ne change pas : si la cause de R2 (l'objectif qui
  diffère d'une page à l'autre) ou de J4 (le premier geste sur la réserve
  du sol) est dans un calcul ou un contrat d'agronomie, le lot s'arrête et
  le porteur en est prévenu avant de coder (D-117).

Aucune migration ; aucun code touché par cette décision.

Ne changent pas : D-028, D-041, D-047, D-117.

## D-138 — Audit ergonomique final, lot A : contrat et première PR, « Aujourd'hui » annonce demain et l'eau qui manque (R1)

Date : 15 novembre 2026, après-midi. Décideur : le porteur pour le
contenu (D-137, toutes les recommandations du contrat retenues) ; les
précisions tranchées en codant suivent l'option recommandée, aucune
question agronomique, modifiables par lui. Après D-137.

**Établi dans le code** (contrat `docs/audit-ergonomie-final-lot-a-contract.md`,
section 3). `irrigationParts` (`lib/domain/today/headline.ts`) ne regardait
que les irrigations du jour : sans rien à dire, la page écrivait « Rien
d'urgent aujourd'hui. » et la pastille verte « Rien à arroser », même en
pleine pénurie et la veille d'arrosages à valider. Le service lisait déjà
le plan de la semaine quand « Planning » est coché : rien n'est lu de plus.

**Décision.** Quand « Planning » est coché, et seulement alors
(F274 à F278, section 8 bis du contrat) :

- les arrosages de demain encore à valider, de 0 h à minuit le lendemain
  à la ferme, se lisent au pied de « Votre journée » (« Demain à 6 h :
  3 arrosages à valider », « Voir au planning » vers la première
  proposition), dans une pastille « 3 à valider demain » et dans la phrase
  de résumé, après le jour ;
- l'eau qui manque à la semaine se lit dans un encadré de l'en-tête, avec
  la phrase d'action du planning (`shortageAction`, appelée telle quelle,
  sans copie de règle) et le même lien « Répartir l'eau » ou « Revoir la
  répartition », présent seulement quand la faisabilité est active ; la
  pastille orange « L'eau manque » se met en tête tant qu'une répartition
  attend (`shortageDecisionPending`) ;
- « Rien à arroser » ne s'affiche plus, et « Rien d'urgent aujourd'hui. »
  ne s'écrit plus, tant que demain ou la semaine ont quelque chose à dire.

Le bloc « Eau disponible » dit une réserve dont le volume connu est
strictement sous son minimum de sécurité, en orange et en mots (« sous son
minimum de 2 m³ ») ; un volume inconnu ou un minimum nul, jamais (F279,
D-003). Le contrat de la page (`docs/aujourdhui-tableau-de-bord-contract.md`,
section 3.5) est changé en conséquence.

**Limite connue** : le dimanche, le plan de la semaine suivante n'existe
pas encore ; rien n'est annoncé pour lundi.

Aucune migration ; aucun calcul de besoin, de pénurie, de plan ni de gel ne
change ; la pastille du menu et son compte (F12) non plus.

Ne changent pas : D-003, D-004, D-028, D-122, D-123, D-131.

## D-139 — Audit ergonomique final, lot A : un seul objectif d'une page à l'autre (R2)

Date : 15 novembre 2026, après-midi. Décideur : le porteur pour le
contenu (D-137, toutes les recommandations du contrat retenues) ; les
précisions tranchées en codant suivent l'option recommandée, aucune
question agronomique, modifiables par lui. Après D-138.

**Établi dans le code, au point d'arrêt** (contrat
`docs/audit-ergonomie-final-lot-a-contract.md`, section 8 ter). Chaque page
lit le même objectif, celui de `objectiveForBed` : le calcul de l'objectif
n'est pas en cause, le point d'arrêt ne s'applique pas. Les écarts viennent
de l'affichage : un total de jardin, de ferme ou de semaine devient inconnu
dès qu'une seule planche n'a pas d'objectif adopté (D-003), sans dire
pourquoi, et la fiche de la planche disait « applicable » pour ce que le
reste du module appelle adopter (D-045).

**Décision** (F280 à F282) :

- sur « Aujourd'hui », quand une partie seulement des planches a un
  objectif, l'objectif, l'eau reçue et le reste à apporter se chiffrent sur
  ces planches seulement et le disent (« sur 7 planches sur 10 ») ; sans
  aucun objectif, « aucun objectif posé » ;
- « Objectif adopté » partout où l'objectif qui s'applique apparaît,
  « Objectif proposé » pour celui que calcule la culture, et une phrase
  d'aide sur la fiche dit la différence ;
- « Non calculable » dit pourquoi : « 2 planches sur 3 sans objectif
  adopté » pour un jardin, la raison du domaine pour une planche ; sur
  « Ressources », le besoin de la semaine se lit « au moins » le volume
  chiffré, avec les planches qui manquent et pourquoi.

Aucune migration ; aucun calcul d'objectif, de besoin, de pénurie ni de plan
ne change : un total inconnu reste inconnu, seule sa raison se lit.

Ne changent pas : D-003, D-010, D-022, D-045.

## D-140 — Audit ergonomique final, lot A : un gel annoncé sans alerte posée se dit (J14)

Date : 15 novembre 2026, après-midi. Décideur : le porteur pour le
contenu (D-137, toutes les recommandations du contrat retenues) ; les
précisions tranchées en codant suivent l'option recommandée, aucune
question agronomique, modifiables par lui. Après D-139.

**Établi dans le code** (contrat `docs/audit-ergonomie-final-lot-a-contract.md`,
section 5). La phrase calme du bloc « Gel ou chaleur » ne regarde que les
alertes posées ; la carte du jour, elle, met le flocon dès que la minimale
prévue est à 0 °C ou moins. Une ferme sans alerte de gel voyait le flocon,
la phrase « Aucune de vos alertes météo ne se déclenche » et la pastille
verte « Rien d'annoncé sur trois jours ».

**Décision** (F283, F284, section 8 quater) : « Alertes météo » coché, une
minimale prévue des trois jours à 0 °C ou moins, aucune alerte active sur
la minimale vers le bas et rien d'annoncé par le gel des cultures : le bloc
dit « −2,4 °C annoncé le mer. 18 nov. et aucune alerte de gel posée. »,
avec le lien « Poser « Gel : moins de 3 °C » » vers « Alertes météo », qui
ouvre le formulaire rempli du modèle de gel, modifiable ; rien ne
s'enregistre depuis « Aujourd'hui » (D-028). La pastille dit « Gel sans
alerte posée ». Une alerte de gel désactivée se dit comme telle. Une
minimale inconnue ne dit rien (D-003).

Aucune migration ; le ton du bloc, les seuils, les alertes, leurs envois et
le gel des cultures ne changent pas. L'écriture directe de l'alerte depuis
« Aujourd'hui » reste à une PR ultérieure, si le porteur la demande.

Ne changent pas : D-003, D-028 ; le seuil de 3 °C du modèle (choix du
porteur du 8 novembre 2026).

## D-141 — Audit ergonomique final, lot A : un en-tête moins répétitif (J13)

Date : 15 novembre 2026, fin d'après-midi. Décideur : le porteur pour le
contenu (D-137, toutes les recommandations du contrat retenues) ; les
précisions tranchées en codant suivent l'option recommandée, aucune
question agronomique, modifiables par lui. Après D-140.

**Décision** (F285 à F287, contrat `docs/audit-ergonomie-final-lot-a-contract.md`,
section 8 quinquies) : « Aujourd'hui » a un seul titre, la date en
sous-titre, sans « Tableau de bord » dans l'en-tête ; la pastille du jour
dit « 2 à faire » ; la pastille du menu dit ce qu'elle compte (« 2 choses à
regarder ») ; le point vert de « Plus », qui marquait la page ouverte sans
le dire, laisse place à la même marque que l'entrée de la page ouverte ; à
l'ordinateur, une journée sans rien à rattraper ni à faire laisse « Gel ou
chaleur » passer dessous. Le contrat de la page
(`docs/aujourdhui-tableau-de-bord-contract.md`, sections 3.1 et 3.2) est
changé en conséquence ; le cas 3 du contrat du lot 2 (« Plus » porte la
pastille verte) devient : « Plus » porte la marque de la page ouverte.

Aucune migration ; aucun calcul ni compte ne change (la pastille du menu
compte comme avant, F12).

Ne changent pas : D-003, D-073, D-074.

## D-142 — Tranche 4 : le contrat est validé, ordre fixé, sous-tranche 4.8 ajoutée

Date : 15 novembre 2026. Décideur : le porteur, qui a validé le contrat le
15 novembre 2026 à 15 h 30 ; les points non réservés suivent l'option
recommandée, modifiables par lui. Aucun code.

**Décision.** Contrat `docs/tranche-4-contract.md` (T4-01 à T4-20). Ordre :
préparation sans code (inventaire du propre à la ferme, mesure des appels à
OTF par jour, conditions d'OTF) ; **4.8 site définitif et politique de
confidentialité** (nouvelle sous-tranche, elle débloque le formulaire
d'OTF) ; envoi du formulaire par le porteur ; 4.1 et 4.2 (identité de ferme
et isolation prouvée) ; 4.3 (OAuth en lecture seule, clé personnelle en
secours) ; 4.4 ; 4.5 ; 4.6 (pilote). 4.7 est absorbée par 4.1 à 4.3.
Réglages : ceux de la roadmap ; 4.8 : contrat Sonnet 5.5 · Moyen, code
Opus 5.5 · Élevé.

**Tranché par le porteur (budget, jamais par une recommandation générale).**
Adresse gratuite `workers.dev`, pas de domaine payant ; hébergement gratuit
des fermes amies pendant le pilote ; pilote avec des fermes amies qu'il
contacte lui-même ; relecture juridique gratuite par son réseau, plus tard,
et **aucune ferme tierce reliée avant elle**.

**Établi à corriger.** Le droit « Interventions » est nécessaire (`/actionList`,
`/taskList`). **Non établi** : consommation quotidienne réelle d'appels à OTF
(estimée à 20 à 25 par lecture complète, plafond de 100 par jour sur l'offre
« Gestion »), correspondance route et droit, conditions écrites d'OTF.

La fusion des moteurs n'est pas touchée ; aucun code de Tranche 4 avant
elle, sauf ce que la roadmap autorise.

Ne changent pas : D-001, D-003, D-066, D-096.

## D-143 — Audit ergonomique final, lot F : la barre de la démonstration en une ligne au téléphone (J1)

Date : 15 novembre 2026, soir. Décideur : le porteur pour le contenu
(D-137, « Je suis d'accord avec toutes tes propositions. Toutes les
recommandations. » : le contrat du lot F et son choix n° 4 retenus, avec
son « vas-y » au code) ; les précisions tranchées en codant suivent
l'option recommandée, aucune question agronomique, modifiables par lui.
Après D-142.

**Décision** (F288 à F291, contrat `docs/audit-ergonomie-final-lot-f-contract.md`,
section 3, versé au dépôt par cette PR) : à 600 px et moins, la bannière
de la démonstration tient en une ligne de 44 px, « Démonstration ·
Maraîchage diversifié · Pic d'été », en noms courts tenus dans le
catalogue à côté des noms longs (F290), suivie du bouton « Changer ». Il
ouvre dessous le texte « données fictives », les deux listes, la remise à
zéro et les visites guidées, et se lit alors « Fermer » ; le détail est
fermé à chaque page (F289 ; toute navigation du module est un chargement
complet). Replié, le texte reste lu par un lecteur d'écran, et l'annonce
des étapes des visites aussi. Une visite qui présente un élément du
détail l'ouvre, et la fin d'une visite y rend le focus ; l'invitation
écartée ne l'ouvre pas et rend le focus à « Changer » (F291). Au-dessus
de 600 px, rien ne change (F288).

Aucune migration ; aucun garde-fou de la démonstration ne change (D-103 à
D-106) ; les listes gardent les noms longs.

Ne changent pas : D-096, D-105.

## D-144 — Audit ergonomique final, lot F : un seul nom pour la ferme, des moments qui ont un sens (J9, J16)

Date : 15 novembre 2026, soir. Décideur : le porteur pour le contenu
(D-137, toutes les recommandations du contrat du lot F retenues) ; les
précisions tranchées en codant suivent l'option recommandée, aucune
question agronomique, modifiables par lui. Après D-143.

**Décision** (F292 à F294, contrat `docs/audit-ergonomie-final-lot-f-contract.md`,
sections 4 et 4 bis) : une ferme fictive porte un seul nom, celui de son
exploitation (« Ferme des Trois Noues »), tenu par le catalogue et repris
par le plan de la ferme : l'historique et ses exports, la ligne de la
bannière au téléphone, la fenêtre « Remettre à zéro » et les visites
guidées le disent ; la liste « Ferme » le donne suivi du profil en nom
court, comme description (F292). L'en-tête, qui dit le nom de la personne
connectée, ne change pas. Chaque profil ne propose que les moments qui
montrent ce que son nom promet : la petite exploitation, le début d'été et
l'automne ; la ferme « matériel et alertes », la nuit de gel et le début
d'été ; le maraîchage, les quatre ; la ferme vierge, le début d'été (F293).
Ce qu'un moment fait voir est réécrit par profil quand le texte général
était faux (F294). Un témoin resté sur un moment retiré retombe sur le
premier moment du profil, sans erreur.

Aucune migration ; aucun garde-fou de la démonstration ne change (D-103 à
D-106) ; les dates des moments et l'heure simulée ne changent pas.

Ne changent pas : D-096, D-104, D-143.

## D-145 — Audit ergonomique final, lot F : le jeu de la démonstration complété (choix n° 4)

Date : 15 novembre 2026, soir. Décideur : le porteur (D-137, toutes les
recommandations du contrat du lot F retenues ; la question agronomique de
l'objectif « ferme entière », posée le jour même, tranchée par lui à
19 h 42 : « Non, rien d'inventé »). Après D-144.

**Décision** (F295 et F296, contrat `docs/audit-ergonomie-final-lot-f-contract.md`,
sections 5 et 5 bis) : la ferme « matériel et alertes » a posé d'avance le
modèle « Gel : moins de 3 °C » de la page « Alertes météo », enregistré tel
quel par le même dépôt que le geste de la page, jamais une règle écrite en
dur ; sa nuit de gel le déclenche, et la remise à zéro le rend (F295).
Aucun objectif n'est posé sur le périmètre « ferme entière » : le module
n'en propose pas, et un chiffre saisi serait une valeur agronomique
inventée, appliquée aussi aux planches vides ; toute planche cultivée a
déjà son objectif proposé et adopté, à chaque moment (F296). Aucune
fonctionnalité n'est ajoutée à un profil.

Aucune migration ; aucun garde-fou de la démonstration ne change ; rien
ne touche la ferme réelle.

Ne changent pas : D-096, D-104, D-106, D-140.

## D-146 — Audit ergonomique final, lot D : contrat versé, les réglages du planning en mots simples (J6)

Date : 15 novembre 2026, soir. Décideur : le porteur (D-137, toutes les
recommandations des contrats retenues le 15 novembre 2026 à 14 h 51, dont
le choix n° 3 et « RFU d'abord » pour J4 ; M1 et N1 ajoutés au lot sur
son accord du même jour). Après D-145.

**Décision** : le contrat court du lot D, `docs/audit-ergonomie-final-lot-d-contract.md`,
est versé au dépôt, ses numéros recalés (D-146 à D-152, F297 à F316) ;
sept PR, une à la fois : J6, J3, J5, J2, J4, M1, N1. Première PR, J6
(F297, F298, contrat sections 3 et 3 bis) : les réglages du planning
perdent leur numéro « R2 · » à « R14 · » dans leurs libellés visibles. Le
numéro reste pour les experts dans une bulle « Numéros des réglages »,
posée dans la légende de chaque groupe (« Pour les experts : Réglage R2,
part de la pluie prévue déduite du besoin ; … »), et dans le nom des champs
par nature de matériel, que des parcours désignent (F297). Un réglage
refusé se nomme en mots simples, comme son libellé (F298).

Affichage seul : aucun réglage, aucune valeur par défaut, aucun calcul ne
change ; aucune migration.

Ne changent pas : D-029, D-117, D-137.

## D-147 — Audit ergonomique final, lot D : « Objectifs et besoins » plus court au téléphone (J3)

Date : 15 novembre 2026, soir. Décideur : le porteur (D-137). Après D-146.

**Décision** (F299 à F301, contrat `docs/audit-ergonomie-final-lot-d-contract.md`,
sections 4 et 4 bis) : au téléphone, chaque jour du tableau de la semaine
tient en une ligne, la date et ce qui s'y est passé, et s'ouvre dessous ;
le jour courant est ouvert ; à l'ordinateur, le tableau d'une ligne par
jour ne change pas (F299). La tuile « ET0 » s'appelle « Évaporation de la
semaine (ET0) », et une tuile sans chiffre s'écrit à la taille du texte
courant (F300). Une phrase compte les jours sans irrigation ni pluie, sans
en masquer aucun ; une pluie inconnue n'y devient pas zéro (F301, D-003).

Affichage seul : aucune valeur, aucun calcul ne change ; aucune migration.

Ne changent pas : D-003, D-010, D-146.

## D-148 — Audit ergonomique final, lot D : « Besoin par culture », vos cultures d'abord (J5)

Date : 15 novembre 2026, soir. Décideur : le porteur (D-137). Après D-147.

**Décision** (F302 à F304, contrat `docs/audit-ergonomie-final-lot-d-contract.md`,
section 5) : la page « Besoin par culture » montre d'abord « Vos cultures
cette saison (N) », celles auxquelles une série de la saison se rattache ;
les autres cultures de référence sont dans un pli fermé, ouvert seulement
quand la saison n'en cultive aucune (F302). La carte fermée d'une culture
ne dit plus que ses séries de la saison ; le Kc et la profondeur des racines
passent dans son « Pour les experts », ce qui remplace le résumé choisi le
8 novembre 2026 ; la formule de l'ombrage quitte l'option visible (F303).
Aucune cible de la page sous 44 px (F304).

Affichage seul : aucun Kc, aucune durée, aucun profil, aucun calcul ne
change ; aucune migration.

Ne changent pas : D-045, D-053, D-147.

## D-149 — Audit ergonomique final, lot D : un pli « Réglages de cette page » (J2, choix n° 3)

Date : 15 novembre 2026, soir. Décideur : le porteur (choix n° 3 du rapport,
confirmé le 15 novembre 2026, D-137). Après D-148.

**Décision** (F305 à F307, contrat `docs/audit-ergonomie-final-lot-d-contract.md`,
section 5) : sur « Arrosages », « Objectifs et besoins », « Ressources et
pompes » et « Matériel », ce qui se règle une fois pour toutes quitte le
travail du jour pour un pli « Réglages de cette page », fermé, en bas : la
limite journalière ; le seuil minimal de planification ; les liaisons,
l'alimentation par défaut, les pompes et la pompe habituelle du matériel ;
la fiche « Besoin de la culture » d'une planche. Le pli s'ouvre par son
ancre `#reglages-de-la-page` ou celle d'un élément qu'il contient (F305,
F307). Sur « Matériel », une phrase renvoie à « Objectifs et besoins »
pour le besoin, et au pli pour le stade et l'adoption, qui restent où ils
étaient (F306). Aucun réglage de ces pages ne bloque seul un calcul :
l'ouverture d'office n'est employée nulle part.

Affichage seul : aucun réglage ne disparaît, aucun geste ne change ce
qu'il fait, aucun calcul ne change ; aucune migration. Les pages validées
avant (3.8, D-067 ; lots A et B) changent d'organisation sur ce choix.

Ne changent pas : D-067, D-137, D-148.

## D-150 — Audit ergonomique final, lot D : « Réserve du sol », la RFU d'abord (J4)

Date : 15 novembre 2026, soir. Décideur : le porteur, pour la question
agronomique (« RFU d'abord », accord du 15 novembre 2026, 14 h 51). Après
D-149.

**Décision** (F308 à F312, contrat `docs/audit-ergonomie-final-lot-d-contract.md`,
section 6) : quand la réserve utile (RFU) d'une parcelle n'est pas saisie,
une observation du sol ne fait pas vivre la jauge : la capacité d'une
planche vaut la RFU par la profondeur des racines (D-041, D-046, D-053).
Le premier geste est donc de renseigner la RFU :

- une ligne de jardin inconnue pour cette raison porte « Renseigner la
  réserve de la parcelle », qui ouvre « Réglages du sol » sur le formulaire
  de sa parcelle, curseur dans la RFU du laboratoire ; « Observer » n'y est
  plus proposé, et « Observer la parcelle » laisse place à la même phrase
  quand aucun de ses jardins de plein champ n'a de RFU (F308) ;
- « Fiabilité du calcul », sur « Aujourd'hui », ne propose « Observer le
  sol de … » que pour un jardin dont la parcelle a sa RFU ; sinon une
  ligne nomme les parcelles sans RFU et mène, par l'ancre
  `#soil-parcel-<parcelle>`, à « Renseigner la réserve de la parcelle … »
  (F309) ;
- les planches d'un jardin inconnues pour la même raison, à deux au moins,
  se disent en une phrase (« 12 planches : inconnue, aucune RFU saisie »),
  leurs lignes dans un pli fermé ; une planche dont toute la semaine est
  inconnue le dit en une ligne au lieu de six cases (F310) ;
- la ligne d'un jardin montre « Observer » tant qu'il est replié, son
  formulaire une fois ouvert : jamais les deux à la fois (F311) ;
- « RFU » s'écrit « réserve utile (RFU) » à sa première occurrence de la
  page (F312).

Un test du domaine prouve qu'une observation ne remplit pas une jauge sans
RFU : chaque jour reste inconnu, faute de sol, jamais à zéro (D-003).
Affichage et gestes seuls : la jauge, le besoin, le plan et les doses ne
changent pas (D-047) ; aucune migration.

Ne changent pas : D-041, D-046, D-047, D-053, D-149.

## D-151 — Audit ergonomique final, lot D : les cases de planche de « Matériel » à 44 px (M1)

Date : 15 novembre 2026, soir. Décideur : le porteur, qui a ajouté ce point
au lot le 15 novembre 2026 (15 h 50, « 1 oui »), d'après la recette du
lot E. Après D-150.

**Décision** (F313, F314, contrat `docs/audit-ergonomie-final-lot-d-contract.md`,
section 5 bis) : au téléphone (600 px et moins), chaque case de planche du
plan de « Matériel » fait 44 px de large au moins, la cible habituelle du
module (A2, D-136) ; 4 px séparent deux cases, pour ne pas en toucher deux.
Trop nombreuses pour une ligne, les cases passent à la ligne, dans l'ordre
du jardin : la ferme réelle en a jusqu'à 33 par jardin, qui faisaient 23 px
à 390 px. Le dessin, le nom accessible et le geste de la case ne changent
pas ; à l'ordinateur, rien ne change.

Affichage seul : aucun calcul, aucune migration.

Ne changent pas : D-136, D-150.

## D-152 — Audit ergonomique final, lot D : chaque « Non calculable » de « Ressources » dit pourquoi (N1)

Date : 15 novembre 2026, soir. Décideur : le porteur, qui a ajouté ce point
au lot le 15 novembre 2026 (17 h 35, « oui »), d'après la recette du lot A.
Après D-151.

**Décision** (F315, F316, contrat `docs/audit-ergonomie-final-lot-d-contract.md`,
section 5 ter) : dans la faisabilité de « Ressources », chaque « Non
calculable » est suivi de sa raison, celle que le calcul expose déjà :

- le besoin, et ce qui en dépend (part servie, déficit global, couverture
  confirmée) : « besoin non chiffré pour 2 planches sans objectif adopté »,
  les mêmes mots que « Besoin de la semaine » (F282) ;
- l'eau mobilisable : « volume non renseigné pour Cuve nord » ; l'eau
  prévue : « prévision inconnue pour Forage » ; sans ressource : « aucune
  ressource en service » ;
- une planche : « Non calculable : aucun objectif adopté. » ou « surface
  mouillée inconnue », la forme d'« Objectifs et besoins » ;
- sinon, la raison générale : « une donnée manque : voir Fiabilité du
  calcul ».

Dans une phrase, la raison suit entre parenthèses : « Couverture confirmée :
Non calculable (besoin non chiffré pour …) ». Le module
`lib/domain/feasibility-unknown.ts` lit la faisabilité déjà calculée : aucun
calcul ne change, aucune inconnue ne devient zéro (D-003) ; aucune
migration.

Ne changent pas : D-003, D-022, D-139, D-151.

## D-153 — Tranche 4, sous-tranche 4.8 : le site public, la confidentialité et l'adresse de retour d'Ouvre ta ferme, avant la fin de la fusion des moteurs

Date : 17 novembre 2026, soir. Décideur : le porteur. Après D-152.

**Ordre.** Le porteur a donné son « vas-y » exprès le 17 novembre 2026 à
21 h 01 (heure de Paris) pour coder la 4.8 **pendant que la fusion des
moteurs attend la relecture de Nicolas**, alors que la section 4 du contrat
de la Tranche 4 (D-142) plaçait la fusion d'abord. Raison : la place de code
était libre, et la 4.8 débloque le formulaire d'Ouvre ta ferme, dont le délai
de validation est inconnu. La fusion reste prioritaire sur la place de code
dès qu'elle a du code à faire ; rien du moteur n'est touché.

**Décision** (précisions F317 à F324, `docs/tranche-4-contract.md`,
section 9 bis), trois réponses du porteur, une par une :

1. les pages publiques sont servies par un Worker à part,
   `irrigation-otf-site`, sans base ni liaison, déployé par la CI, plutôt que
   par des exceptions dans l'application Access du module (« Petit site
   séparé ») ; adresse fixe
   `https://irrigation-otf-site.lechampdelaurore.workers.dev` ;
2. le responsable affiché est « François PREZEAU, GAEC Le Champ de
   l'Aurore » ;
3. l'adresse de contact est saisie par le porteur lui-même dans un réglage
   du Worker du site (`SITE_CONTACT_EMAIL`), jamais dans le dépôt ; sans
   elle, les pages renvoient à la page publique du projet.

Trois pages : accueil, politique de confidentialité, conditions
d'utilisation, écrites d'après ce que fait le code. L'adresse de retour
OAuth est fixée sur le module, `/api/otf/oauth/retour` : jusqu'à la 4.3,
elle ne lit rien de l'adresse et dit que la connexion n'est pas encore
ouverte. Le texte n'est pas un avis juridique (T4-20) : aucune ferme tierce
n'est reliée avant sa relecture (question 4 du contrat).

Ne changent pas : D-142 (sauf l'ordre ci-dessus), D-016, D-100.

## D-154 — La Tranche 4 se code sans attendre la fin de la fusion des moteurs ; banc allégé ; deux chantiers de code s'ils touchent deux dépôts

Date : 17 novembre 2026, soir (21 h 16, heure de Paris). Décideur : le
porteur (« Je suis d'accord avec toutes tes propositions. Mets-les en œuvre
de manière autonome »), sur cinq propositions du coordinateur pour superposer
les attentes. Après D-153, qu'elle étend à toute la Tranche 4.

**Décision.**

1. **La Tranche 4 se code sans attendre la fin de la fusion des moteurs.**
   Elle touche la connexion et l'accès des fermes, pas le calcul ; le moteur
   commun se branchera dessous plus tard (contrat de la Tranche 4,
   section 11 : l'accueil lit les valeurs par défaut par l'interface du
   moteur, jamais en dur). Remplace « avant la Tranche 4 » de D-066 et
   l'ordre « la fusion des moteurs passe d'abord » de D-142.
2. **Le formulaire d'Ouvre ta ferme part dès que la 4.8 est en ligne**,
   envoyé par le porteur lui-même.
3. **Le pilote se prépare dès maintenant** : le porteur contacte lui-même les
   fermes amies et relance la relecture juridique (contacts extérieurs, à
   lui) ; aucune ferme tierce n'est reliée avant cette relecture (inchangé).
4. **Le banc d'essai commun est allégé** à deux ou trois saisons rejouées au
   lieu de toutes, **sous réserve de l'accord de Nicolas** (le banc est
   commun), et passe après la Tranche 4 s'il traîne.
5. **Exception à « un seul chantier de code à la fois »** : deux chantiers de
   code peuvent avancer en même temps quand ils touchent des dépôts
   différents, le moteur commun d'un côté, le module de l'autre. Dans un
   même dépôt, la règle reste entière.

Ne changent pas : D-142 (contenu des sous-tranches, sauf l'ordre), D-066
(partage des rôles), D-055 (Fable interdit), la règle des registres.

## D-155 — Tranche 4, sous-tranches 4.1 et 4.2 ensemble : l'identité de la ferme et l'isolation, en trois PR

Date : 17 novembre 2026, soir. Décideur : le porteur, sur la carte « 1 sur
1 » (22 h 35, heure de Paris : « 4.1 et 4.2 ensemble, en Max »). Après
D-154.

**Pourquoi la question.** Les registres se contredisaient : la ligne 4.1 de
la roadmap (section 6) la donnait seule, en Opus 5.5 · Élevé ; le contrat
validé (section 4, D-142) faisait de 4.1 et 4.2 un seul chantier, en
Opus 5.5 · Max. Le code tranchait aussi : treize requêtes retrouvent
l'espace d'une personne en cherchant « son espace sans ferme », une
trentaine d'autres ne vérifient que la personne ; remplir l'identifiant de
ferme sans les changer rendrait les données de la ferme introuvables.

**Décision.**

1. 4.1 et 4.2 forment **un seul chantier, en Opus 5.5 · Max**, comme le
   prévoit le contrat ; la ligne 4.1 de la roadmap est alignée.
2. Les règles sont écrites avant le code (`docs/tranche-4-contract.md`,
   section 5 bis, F325 à F336), toutes à l'option recommandée : aucune
   n'est agronomique, ne touche au budget ni à Cloudflare. Un espace, c'est
   une personne et une ferme ; chaque requête les filtre ensemble ;
   l'identité de la ferme vient de `GET /me` d'OTF ; l'espace d'avant la
   4.1 est rattaché automatiquement à la ferme d'où viennent ses données,
   sans copie ni suppression ; une clé qui change de ferme n'écrit rien
   dans l'espace de l'ancienne ; le régulateur tient 4 appels par seconde
   et 30 par minute par ferme.
3. **Trois PR, dans l'ordre**, chacune après le déploiement vérifié de la
   précédente : (1) la clé d'espace dans chaque requête, sans rien changer
   de visible, avec les tests d'isolation et la liste des requêtes relue ;
   (2) l'identité lue chez OTF et le rattachement automatique ; (3) le
   régulateur par ferme. **La PR 2 attend un « vas-y » exprès du porteur
   avant sa fusion** : elle écrit dans l'espace de sa ferme réelle, et un
   retour en arrière du code ne suffirait plus à la défaire.

Restent à la 4.3 : le coffre des jetons, le budget quotidien d'appels et
l'échelonnement des synchronisations (F335). La revue de l'isolation par
un second fil reste due avant toute ferme tierce (4.6).

Ne changent pas : D-142 (sauf la ligne 4.1 alignée), D-154, D-003 (rien
n'est deviné), D-096 (la démonstration reste sans ferme), D-048.

## D-156 — Tranche 4, 4.1 et 4.2, PR 2 : l'identité de la ferme lue chez OTF, la ferme du déploiement et le rattachement automatique

Date : nuit du 17 au 18 novembre 2026. Décideur : Claude, à l'option
recommandée, sur le mandat du porteur (D-154, D-155) ; **la fusion attend son « vas-y »
exprès** (D-155). Après D-155.

**Pourquoi la question.** La section 5 bis du contrat disait quoi faire
(F329 à F332) sans dire comment : l'ordre des lectures, ce qui fait une
identité, où garder la ferme de la clé, ce qui s'affiche quand OTF ne la
dit pas, ce que deviennent les espaces d'une autre ferme ou sans ferme, et
le cache d'un espace qui vient de changer de clé. Aucune de ces questions
n'est agronomique, ne touche au budget ni à Cloudflare.

**Décision.** Huit précisions écrites avant le code
(`docs/tranche-4-contract.md`, section 5 ter, F337 à F344), toutes à
l'option recommandée :

1. `GET /me` est lu d'abord, à chaque lecture d'OTF : la ferme est
   vérifiée avant toute autre route (F337).
2. Une identité, c'est une seule structure et un identifiant lisible ; le
   remplaçant `unknown` des instantanés n'en est pas une (F338).
3. La ferme du déploiement est gardée dans une table d'une ligne,
   `otf_deployment_farm` (migration additive 0031) ; une observation plus
   ancienne ne remplace jamais une plus récente. Sans ligne : le dernier
   instantané en cache lisible, sinon un seul `GET /me`. Avec les données
   fictives, la ferme fictive `farm-demo`, sans rien écrire (F339).
4. Le rattachement se fait à chaque connexion, avant de rendre la clé, par
   une seule écriture conditionnelle ; jamais de fusion de deux espaces
   (F340).
5. Sans identité, aucune page ne s'affiche ; l'export et les dessins des
   espèces sont refusés avec le même message ; la forme de la réponse est
   journalisée, jamais ses valeurs (F341).
6. Les espaces d'une autre ferme, et ceux sans ferme hors démonstration, ne
   lisent pas OTF (F342).
7. Un espace qui vient d'être rattaché lit le dernier instantané de sa
   personne d'avant la 4.1 seulement s'il est de la même ferme, sans le
   copier (F343).
8. Ce que la mise en ligne change pour une ferme réelle est écrit (F344).

**Ce que la fusion fera sur la ferme réelle.** À la première ouverture du
porteur après la mise en ligne : une ligne dans `otf_deployment_farm` (la
ferme de son dernier instantané) et la ferme écrite dans la colonne de son
espace ; rien d'autre ne change à l'écran. **Risque connu** : la
documentation d'OTF ne donne pas les champs de `GET /me` ; la règle lit
`id` ou `@id`, comme la lecture de l'instantané depuis la 2.8. Si la
réponse réelle n'en avait pas, la page dirait « La ferme n'est pas
identifiée » et rien ne serait écrit : un retour du code suffirait.

Ne changent pas : D-155, D-154, D-003 (rien n'est deviné), D-096 (la
démonstration reste sans ferme), D-048.

## D-157 — Tranche 4, 4.1 et 4.2, PR 3 : le régulateur des appels par ferme

Date : 18 novembre 2026, nuit. Décideur : Claude, à l'option recommandée,
sur le mandat du porteur (D-154, D-155). Après D-156.

**Pourquoi la question.** F334 disait la règle (4 appels par seconde et 30
par minute, ferme par ferme ; une attente de 5 secondes au plus quand la
minute est pleine ; sinon la lecture s'arrête comme sur une limite
atteinte) sans dire comment la compter, ni quel régulateur sert la clé du
déploiement avant que sa ferme soit connue. Aucune de ces questions n'est
agronomique, ne touche au budget ni à Cloudflare.

**Décision.** Toutes à l'option recommandée :

1. Un régulateur par ferme, partagé par tous les clients de cette ferme ;
   une ferme n'attend jamais le quota d'une autre, ni l'espacement, ni la
   minute, ni la pause qui suit un `429` (`lib/adapters/otf/read-client.ts`).
2. Avant la 4.3, la clé du déploiement a un seul régulateur, y compris
   pour le premier `GET /me` qui fait connaître sa ferme : ranger ce
   premier appel à part aurait permis, dans une course entre deux
   connexions, cinq appels dans la même seconde. La règle des 4 appels par
   seconde passe avant la finesse du découpage.
3. La minute est glissante et comptée avec une seconde de marge : trente
   départs tiennent dans 61 secondes au moins. OTF compte les appels à leur
   arrivée, le module à leur départ.
4. Le refus se décide quand l'appel arrive en tête de file : si la place
   se libère dans plus de 5 secondes, l'appel n'est pas envoyé, rien n'est
   compté, et l'erreur porte le statut 429, qui fait afficher le dernier
   instantané avec le message existant (`lib/domain/snapshot-policy.ts`).
   Un refus ne se retente pas.
5. L'attente d'une place ne compte plus dans le délai de l'appel (8
   secondes) : le délai part de l'envoi.
6. Le calcul est une fonction pure (`lib/domain/otf/call-pace.ts`),
   éprouvée par un appelant qui insiste : jamais cinq départs en une
   seconde, jamais trente et un en une minute.

**Ce que cela change pour une ferme réelle.** Une lecture de saison compte
une vingtaine d'appels sur la ferme du porteur : une seconde lecture
complète dans la même minute (deux actualisations de suite, par exemple)
s'arrête après quelques appels, avec le dernier instantané et le message
« Limite de requêtes OTF atteinte », au lieu de recevoir un `429` d'OTF.

Ne changent pas : D-155, D-156, la règle du projet de 4 requêtes par
seconde au plus. Restent à la 4.3 (F335) : le régulateur partagé entre
instances du Worker, le budget quotidien, l'échelonnement.

## D-158 — Tranche 4, sous-tranche 4.3 : le contrat de la connexion de chaque ferme à Ouvre ta ferme, écrit avant le code

Date : 18 novembre 2026, soir. Décideur : Claude, à l'option recommandée,
au lancement du coordinateur sur le mot du porteur (« Lance tous les
chantiers en parallèle que tu peux », 20 h 04, heure de Paris), en
Opus 5.5 · Max, réglage de la ligne 4.3 de la roadmap ; le porteur pour
la voie de secours (F369, 20 h 50). Après D-157.

**Pourquoi la question.** La section 6 du contrat (T4-09 à T4-17) disait
quoi faire sans dire comment ; la 4.1 et la 4.2 ont laissé à la 4.3 le
régulateur partagé entre les instances du serveur, le budget quotidien, les
jetons de chaque ferme et la lecture qui ne peut pas finir dans la minute
(F334, F335) ; F323 laissait à la 4.3 le sort des journaux qui gardent
l'adresse de retour. La documentation d'OTF, relue le soir même, précise
l'échange (code valable une minute, ferme rendue avec les jetons, jeton de
renouvellement remplacé à chaque usage, aucune route de révocation par
l'application, aucun en-tête de quota restant). La revue de l'isolation,
faite par un second fil le même jour, confie à la 4.3 son constat B (toute
personne admise par Access ouvre la ferme de la clé du déploiement), la
question de son constat A (les notifications d'un appareil partagé) et ses
points D2 à D5. Le formulaire d'OTF est parti le même soir, à 20 h 13
(4.8). Aucun de ces points n'est agronomique, ne touche au budget du
porteur ni ne change un réglage de Cloudflare.

**Décision.** Toutes à l'option recommandée (`docs/tranche-4-contract.md`,
section 6.3, F349 à F370) :

1. Un raccordement par ferme, à une seule personne ; avant la 4.4, une
   personne relie une seule ferme. Le départ est une demande `POST`, avec
   `state` et PKCE gardés dix minutes côté serveur ; le retour vérifie la
   demande, l'identité par `GET /me`, les droits en lecture seule et
   l'accès de la ferme avant de rien garder.
2. Les journaux d'invocation du Worker restent tels quels (F323 tranché) :
   le code qu'ils gardent vaut une minute, ne sert qu'une fois et ne sert à
   rien sans le `code_verifier`, qui ne quitte jamais le serveur ; les
   journaux du module n'écrivent ni code, ni `state`, ni jeton.
3. Le coffre : AES-256-GCM, le chiffré lié à sa ferme et à son rôle, une
   clé maîtresse posée par le porteur, sa rotation éprouvée par des tests
   et essayée pour de vrai avant la première ferme tierce.
4. Un seul renouvellement à la fois par ferme, par un bail écrit dans la
   base ; un refus d'OTF met le raccordement en « reconnexion demandée »,
   jamais en boucle ; un frein coupe tout appel après 10 échecs
   d'authentification en 15 minutes (OTF bloque à 100).
5. « Déconnecter la ferme » efface le raccordement, ses jetons et les
   copies lues dans OTF ; ce que la personne a saisi reste dans son espace.
6. Le régulateur partagé se compte dans la base D1, par ferme, quelle que
   soit la clé : aucun nouveau produit Cloudflare, aucune dépense nouvelle.
   Une lecture complète à la fois par ferme ; elle réserve ses appels et ne
   part que si elle peut finir ; une lecture de plus de 30 appels ne se fait
   qu'au calcul du matin.
7. Le budget du jour se mesure d'abord : le module compte ses appels par
   ferme et par jour ; seul le `429` du jour d'OTF arrête les appels
   jusqu'à sa levée ; la part du quota laissée au module est posée au
   porteur après quatorze jours de compte, chiffres à l'appui, et aucune
   ferme tierce n'est reliée avant.
8. Le « SSO » et le « lien dans le menu Production » de la ligne 4.3 de
   septembre ne dépendent pas du module : OTF ne documente aucune connexion
   des personnes, la connexion reste Access (T4-05), et un lien dans le menu
   d'OTF ne peut être posé que par OTF. La ligne 4.3 de la roadmap est
   alignée sur la section 4 du contrat.
9. Le code, sur le « vas-y » de sous-tranche du porteur, en cinq PR : le
   compteur partagé, le coffre, l'autorisation et « Réglages », la lecture
   par le raccordement, les tests de contrat des routes ; les trois
   premières ne demandent aucun accès d'OTF. Puis l'essai de bout en bout
   sur « Ferme v2 » n° 4394, la ferme réelle reliée sur son « vas-y », et
   le retrait de la clé du déploiement, son acte.
10. Ce que la revue de l'isolation confie à la 4.3 : à partir de la PR 4,
    une personne sans raccordement n'obtient plus la ferme de la clé du
    déploiement, sans repli, et une personne inconnue n'ouvre aucune
    ferme ; jusqu'au pilote, la règle d'Access du module principal n'admet
    que des personnes de la ferme du porteur ; les notifications d'un
    appareil suivent la personne qui l'a inscrit en dernier, pas l'espace ;
    les points D2 à D5 vont aux PR 1, 4 et 5 (F361, F364, F366, F370).

**Réservé au porteur.** La voie de secours par clé personnelle collée
(T4-10, F369), tranchée par lui le 18 novembre 2026 à 20 h 50, à l'option
recommandée (carte « 1 sur 1 ») : pas de code tant que le reste du pilote
n'est pas prêt, et seulement si OTF n'a toujours pas validé ; la part du
quota quotidien, après
la mesure (F363) ; les secrets (F368) et tout réglage Cloudflare, dont la
règle d'Access qu'il tient lui-même ; le « vas-y » du code ; la ferme
réelle.

Ne changent pas : D-142 (T4-01 à T4-20, précisés sans être changés),
D-155 à D-157, D-002 (lecture seule, 4 appels par seconde au plus), D-003
(rien n'est deviné), D-096 (la démonstration ne lit jamais OTF).

## D-159 — Notifications : un appareil, une personne (constat A de la revue de l'isolation, avec C3 et D1)

Date : 18 novembre 2026, soir. Décideur : Claude, à l'option recommandée,
au lancement du coordinateur sur le mot du porteur (« Lance tous les
chantiers en parallèle que tu peux », 20 h 04, heure de Paris), puis sous
son mandat de nuit (21 h 54 : enchaîner seul) ; en Opus 5.5 · Max,
réglage de la ligne 4.2 de la roadmap. Après D-158.

**Pourquoi la question.** La revue de l'isolation du 18 novembre 2026
(constat A) : un appareil où deux personnes ont ouvert le module reste
inscrit dans leurs deux espaces et reçoit en silence les notifications des
deux (gel avec les noms des cultures, fins d'arrosage, suggestions du
planning, alertes météo), y compris entre deux personnes d'une même ferme
(F328). C'est contraire à T4-06 et F336, à corriger avant la 4.6. F351
(D-158, point 10) a tranché que les notifications d'un appareil suivent la
personne qui l'a inscrit en dernier, pas l'espace ; restait à dire
comment, sans qu'une page ouverte par une autre personne retire en silence
ses alertes à la personne dont c'est le téléphone. Le point C3 (aucun test
au niveau de l'appareil) et le point D1 (nouvelles tentatives partagées
entre espaces) vont avec.

**Décision.** Toutes à l'option recommandée (`docs/tranche-4-contract.md`,
section 5 quater, F371 à F378 ; `docs/push-worker-contract.md`, « Un
appareil, une personne ») :

1. Le service de notification garde une fiche par appareil : la personne à
   qui il est, par une empreinte (SHA-256 de son identifiant de connexion,
   calculée par le serveur du module), et ses espaces, vingt au plus. Avant
   chaque envoi, chaque appareil est vérifié : celui qui n'est plus à
   l'espace en est retiré sans rien recevoir ; une vérification qui échoue
   n'envoie rien et l'envoi se retente.
2. Seul le bouton « Activer » change la personne d'un appareil, qui quitte
   alors tous les espaces de la précédente ; l'ouverture d'une page ne fait
   que renouveler l'inscription de la personne à qui il est déjà. Sur
   l'appareil d'une autre personne, la page montre « pas encore activé » et
   le bouton, sans rien dire de plus.
3. Une même personne reçoit sur son appareil les notifications de chacun
   de ses espaces où elle l'a inscrit (deux fermes à partir de la 4.4).
4. Les appareils d'avant le correctif sont gardés par le premier espace qui
   leur envoie et donnés à la personne de la première page ouverte : un
   appareil d'un seul espace continue de recevoir sans rien refaire.
5. « Désactiver » garde la personne de l'appareil ; un abonnement expiré
   efface sa fiche.
6. Les nouvelles tentatives sont nommées par l'espace et l'identifiant
   (D1).
7. Les preuves (C3) : les tests du service font tourner son vrai code, ses
   trois classes de Durable Objects comprises, sur une mémoire de test qui
   imite Cloudflare.
8. Le bouton « Se déconnecter » que la revue proposait en option n'est pas
   fait : avec le point 2, un appareil ne change plus de personne sans le
   geste de la nouvelle.

**Écart avec la revue.** Elle recommandait « un appareil, un seul espace à
la fois », retiré de l'espace précédent à chaque inscription. Avec cette
règle, une page ouverte sur le téléphone d'une personne par une autre lui
retirait ses alertes en silence, et une personne qui a deux fermes n'aurait
gardé que la dernière ouverte ; F351 avait déjà choisi la personne.

**Ce que le déploiement change.** Le service de notification gagne une
classe de Durable Objects (`PushDevice`, migration `v2`), créée par le
déploiement automatique de la CI, sans réglage de Cloudflare à la main ni
nouveau produit. Revenir en arrière demande une migration qui supprime
cette classe.

**Réservé au porteur.** Rien : aucun point n'est agronomique, ne touche à
son budget ni ne demande un réglage de Cloudflare. Il peut changer ces
règles.

Ne changent pas : D-142 (T4-06), D-155 à D-158 (F351 précisé sans être
changé), D-050 (envoi immédiat des alertes météo), D-060 (priorité haute
et toucher d'une notification).

## D-160 — Les preuves C1 et C2 de la revue de l'isolation : la cohérence des espaces et le passage « rattachement »

Date : nuit du 18 au 19 novembre 2026. Décideur : Claude, à l'option
recommandée, sous le mandat de nuit du porteur (18 novembre, 21 h 54, heure
de Paris : enchaîner seul) ; en Opus 5.5 · Max, réglage de la ligne 4.2 de
la roadmap. Après D-159.

**Pourquoi la question.** La revue de l'isolation du 18 novembre 2026 n'a
trouvé aucune fuite dans la base, mais elle a relevé deux preuves
manquantes, recommandées avant la 4.6. C1 : le garde-fou de
`tests/farm-space.test.ts` ne regarde que la forme des requêtes ; rien, ni
test ni contrainte de la base, ne vérifie qu'un objet et ce qu'il désigne
sont du même espace. C2 : les passages d'isolation ne comparent pas
l'espace sans ferme d'une personne et son espace de ferme, le cas du
rattachement (F331).

**Décision.** Toutes à l'option recommandée (`docs/tranche-4-contract.md`,
section 5 quinquies, F379 et F380) :

1. Un troisième passage d'isolation, « rattachement », rejoue les tests de
   `tests/db/` avec l'espace sans ferme d'une personne et son espace de
   ferme (F379).
2. Un contrôle de cohérence des espaces, joué à la fin de chaque test de
   `tests/db/` qui écrit dans la base de test : une ligne qui désigne une
   ligne d'un autre espace fait échouer le test. Toute table, et toute
   colonne en `_id` ou en `_key`, doit y être rangée ; une nouvelle, non
   rangée, l'arrête (F380).
3. Le test « Bob désigne l'objet d'Alice » est ajouté pour chaque action
   qui reçoit du navigateur l'identifiant d'un objet et qui ne l'avait pas
   encore.
4. Un contrôle de test, pas une contrainte de la base (clés étrangères
   composées avec l'espace, ou déclencheurs) : la revue demandait des
   preuves, sans toucher `db/` ; une contrainte demanderait une migration de
   chaque table concernée, à décider à part si le besoin s'en montre.

**Réservé au porteur.** Rien : aucun point n'est agronomique, ne touche à
son budget ni ne change ce que voit une ferme.

Ne changent pas : D-155 (F336, passages « fermes » et « personnes »),
D-156 (F331, le rattachement), D-159.

## D-161 — Tranche 4, sous-tranche 4.3, PR 1 : le compteur partagé des appels à Ouvre ta ferme

Date : nuit du 18 au 19 novembre 2026. Décideur : Claude, à l'option
recommandée, sous le mandat de nuit du porteur (18 novembre, 21 h 54, heure
de Paris : « enchaîne, code toute la nuit, tout seul », qui vaut « vas-y »
pour le code de la Tranche 4 hors ferme réelle, Cloudflare et 3.8) ; en
Opus 5.5 · Max, réglage de la ligne 4.3 de la roadmap. Après D-160.

**Pourquoi la question.** Le quota d'OTF est celui de la ferme, toutes
applications confondues ; le module le comptait dans chaque instance du
serveur (D-157), qui ne voit pas les appels des autres (F334). Le contrat de
la 4.3 (D-158, F361 à F363) a fixé le principe : le rythme compté dans la
base pour toutes les instances, une lecture complète à la fois par ferme,
qui ne part que si elle peut finir, le compte du jour, le `429` du jour et
le frein des échecs d'authentification. Restaient les choix du code.

**Décision.** Toutes à l'option recommandée (`docs/tranche-4-contract.md`,
section 6.3 bis, F381 à F390) :

1. Chaque appel prend sa place dans la base par une seule écriture
   conditionnelle, sous l'identifiant OTF de la ferme ; le seul `GET /me`
   d'une ferme encore inconnue se compte à part (F381).
2. Un `429` devient une pause pour toutes les instances : la ferme pour la
   seconde, la minute et le jour (jusqu'à minuit à Paris sans
   `Retry-After`), le module entier pour le blocage d'adresse (F382).
3. Une lecture complète prend un bail de deux minutes et réserve ses
   places en un seul lot ; elle ne part que si elles tiennent dans la
   minute glissante ; la fin de la lecture rend les places inutilisées et
   garde la base de la réserve suivante (F384, F388).
4. Le calcul du matin attend qu'une minute ait la place, 62 secondes au
   plus ; une page n'attend que cinq secondes (F383).
5. Ce que dit la page, raison par raison, avec l'heure de la prochaine
   lecture possible quand elle est connue et dans la journée (F386).
6. Le ménage au départ de chaque lecture, sans tâche planifiée de plus
   (F387) ; la mémoire de l'instance oublie les fermes sans départ récent
   (point D5, F389).
7. Cinq tables nouvelles, migration additive 0032, sans jeton, adresse ni
   personne ; communes à tous les espaces dans le contrôle de cohérence
   (F390).

**Écart accepté.** La base tient l'espacement à l'instant où elle écrit la
place, pas à l'arrivée chez OTF : quelques millisecondes de latence entre
deux instances, couvertes en partie par les marges, et en pratique par une
seule lecture à la fois par ferme (F385). Faire passer les appels d'une
ferme par un seul objet de Cloudflare (Durable Object) l'éviterait, au prix
d'un produit de plus : F361 l'écarte (« Aucun nouveau produit Cloudflare »).

**Ce que le déploiement change.** La migration 0032 s'applique au
déploiement automatique de la CI, comme les précédentes ; aucune ligne
existante ne change, aucun réglage de Cloudflare à la main. Le compte du
jour commence à la mise en ligne : la part du quota laissée au module sera
posée au porteur après quatorze jours de compte (F363).

**Réservé au porteur.** La part du quota quotidien, après la mesure (F363) ;
rien d'autre : aucun point n'est agronomique, ne touche à son budget ni ne
demande un réglage de Cloudflare. Il peut changer ces règles.

Ne changent pas : D-002 (lecture seule, 4 appels par seconde au plus),
D-003 (rien n'est deviné), D-157 (le régulateur par ferme, qui reste
devant la base), D-158 (F361 à F363 précisés sans être changés), D-160 (le
contrôle de cohérence, qui range les tables nouvelles).

## D-162 — Tranche 4, sous-tranche 4.3, PR 5 : les tests de contrat des routes d'Ouvre ta ferme

Date : nuit du 18 au 19 novembre 2026. Décideur : Claude, à l'option
recommandée, sous le mandat de nuit du porteur (18 novembre, 21 h 54, heure
de Paris : « enchaîne, code toute la nuit, tout seul ») ; en Opus 5.5 ·
Max, réglage de la ligne 4.3 de la roadmap. Après D-161.

**Pourquoi la question.** L'API d'Ouvre ta ferme est en bêta, « sujette à
changement sans préavis ». T4-15 demande un contrôle par route lue qui
détecte un changement de format au lieu d'afficher des données fausses, et
F370 (point 5) en fixe la forme : chaque route a sa vérification, éprouvée
sur des réponses types ; un écart arrête la lecture sans rien ranger ; le
journal nomme la route et le champ, jamais une valeur ; la page le dit ; et
`GET /me` à plusieurs structures est refusé partout (point D2 de la revue
de l'isolation). Restaient les choix du code, et l'ordre des PR.

**Décision.** Toutes à l'option recommandée (`docs/tranche-4-contract.md`,
section 6.3 ter, F391 à F396) :

1. La PR 5 passe avant la PR 2, comme F370 le permet : la PR du coffre
   change la politique de confidentialité du site public et attend que le
   porteur en relise les lignes (F367) ; la PR 5 n'attend personne.
2. Chaque route est vérifiée dès sa réponse, avant l'appel suivant ; la
   vérification refuse ce que la traduction de l'instantané lit sur chaque
   élément, jamais plus sur ce qu'elle ne lit pas : aucune donnée que le
   module lit aujourd'hui sans erreur n'est refusée, sauf par les deux
   règles suivantes (F391).
3. Une seule règle lit les structures de `GET /me` ; plusieurs structures
   sont un écart de `/me`, à la vérification comme à la traduction (F392).
4. Un champ lu avec une valeur par défaut et constaté sur la ferme, absent
   de tous les éléments d'une réponse, est un écart ; un seul élément qui le
   porte, même nul, suffit (F393).
5. Le motif `shape-changed`, le message de F370 avec le cache, une page
   d'état sans cache, une ligne de journal sans valeur ; les messages de la
   traduction ne portent plus d'identifiant (F394).
6. Les réponses types des tests, calquées sur celles constatées, comparées
   aux vraies à l'essai de bout en bout sur « Ferme v2 » (F395).

**Écart accepté.** Les champs lus par défaut dont la forme réelle n'est pas
constatée (le mode d'un jardin, les saisons d'un élément, les noms) ne sont
pas encore vérifiés : les exiger sans l'avoir vu risquerait d'arrêter la
lecture de la ferme du porteur la nuit même. Ils entrent à l'essai de bout
en bout s'ils sont toujours écrits (F393, F395).

**Ce que le déploiement change.** Rien à l'écran ni dans la base tant
qu'Ouvre ta ferme répond dans la forme constatée : ni migration ni réglage
de Cloudflare. Si une route de la ferme du porteur s'écartait déjà des
règles, la page l'affichera dès la première lecture avec le dernier
instantané et le message de F394, et le journal nommera la route et le
champ.

**Écart de registre corrigé.** Le tableau de la roadmap (ligne de la PR 3
de la 4.3) plaçait la relecture de la page de confidentialité dans la
PR 3 ; F367 la place dans la PR du coffre (la PR 2). Le contrat fait foi :
le tableau la place désormais dans la ligne 2. Le porteur peut préférer
l'autre ; la PR 2 lui sera ouverte pour cette relecture.

**Réservé au porteur.** Rien : aucun point n'est agronomique, ne touche à
son budget ni ne demande un réglage de Cloudflare. Il peut changer ces
règles.

Ne changent pas : D-002 (lecture seule), D-003 (rien n'est deviné : c'est
la règle que la vérification applique), D-158 (F338 et F370 précisés sans
être changés), D-161 (le compteur partagé, devant chaque appel).

## D-163 — Tranche 4, sous-tranche 4.3, PR 2 : le coffre des jetons d'Ouvre ta ferme

Date : nuit du 18 au 19 novembre 2026. Décideur : Claude, à l'option
recommandée, sous le mandat de nuit du porteur (18 novembre, 21 h 54, heure
de Paris : « enchaîne, code toute la nuit, tout seul ») ; en Opus 5.5 ·
Max, réglage de la ligne 4.3 de la roadmap. Après D-162. **La fusion
attend la relecture, par le porteur, des lignes changées de la politique de
confidentialité (F367).**

**Pourquoi la question.** Chaque ferme reliée confiera au module les jetons
qu'Ouvre ta ferme lui donne. T4-12 et F355 demandent qu'ils soient chiffrés
avant d'entrer dans la base, liés à leur ligne et à leur rôle, avec une
clé maîtresse que seul le porteur pose ; F356 fixe sa rotation. Restaient
les choix du code : la forme de la clé et du chiffré, ce que fait le module
quand une clé est mal posée, où les jetons sont rangés, et ce que dit le
journal pendant une rotation.

**Décision.** Toutes à l'option recommandée (`docs/tranche-4-contract.md`,
section 6.3 quater, F397 à F403) :

1. La clé maîtresse vaut 32 octets aléatoires en base64, tirée et posée
   par une seule commande, sans s'afficher ; son empreinte de 16
   caractères dit quelle clé a fait un chiffré, sans rien apprendre de la
   clé (F397).
2. Le coffre est endormi sans clé, hors d'usage quand un secret posé est
   illisible (rien ne s'ouvre, rien n'est effacé, le journal nomme le
   secret), prêt sinon ; la démonstration refuse de démarrer avec une clé
   du coffre (F398).
3. Le chiffré `v1.<empreinte>.<vecteur>.<chiffré>`, AES-256-GCM, avec des
   données associées écrites en liste JSON : rôle et ferme pour un jeton,
   rôle, personne et demande pour un `code_verifier` (F399).
4. Un chiffré d'une clé perdue, déplacé, pris pour un autre rôle ou
   altéré ne s'ouvre pas ; l'erreur nomme le problème, jamais une valeur
   (F400).
5. La rotation rechiffre à l'usage, par une écriture qui n'écrase jamais
   un renouvellement, puis au calcul du matin ; le journal du matin dit
   quand l'ancienne clé peut partir (F401).
6. La PR 2 crée la table du raccordement (migration additive 0033), seule
   ligne où les jetons entrent dans la base : lue par la personne et la
   ferme ensemble, rangée par une seule écriture conditionnelle (F351) ;
   pas de jetons en « reconnexion demandée », imposé par la base (F402).
7. Les lignes de la politique de confidentialité que F367 demande, et le
   raccordement parmi les tables communes du contrôle de cohérence des
   espaces (F403).

**Écart accepté.** La table de la demande d'autorisation (le
`code_verifier`, dix minutes) vient avec le départ, dans la PR 3, et le
bail du renouvellement (F357) aussi, par une migration additive : la PR 2
n'écrit que ce qu'elle éprouve. Le chiffrement du `code_verifier`, lié à la
personne et à la demande, est déjà éprouvé.

**Ce que le déploiement change.** Une table vide de plus (migration 0033)
et une étape de plus au matin, endormie tant que la clé maîtresse n'est pas
posée : rien à l'écran du module, aucun appel de plus à Ouvre ta ferme. Le
site public publie la politique de confidentialité datée du 19 novembre
2026.

**Réservé au porteur.** La relecture des lignes changées de la politique de
confidentialité, avant la fusion (F367) ; la seconde phrase sur ce que lit
le responsable (« Il ne les consulte que pour… ») est un engagement qu'il
garde ou retire. Poser la clé maîtresse, à la validation d'OTF, et la
retirer après une rotation : des réglages de Cloudflare, ses actes (F368).

Ne changent pas : D-002 (lecture seule), D-003 (rien n'est deviné : un
chiffré qui ne s'ouvre pas n'est jamais lu autrement), D-158 (F355, F356 et
F368 précisés sans être changés), D-161 (le compteur partagé), D-162 (les
tests de contrat des routes).

## D-164 — La mise à jour automatique de la météo réparée, et les lots G à K de l'audit du 19 novembre 2026 inscrits

Date : 19 novembre 2026.

**Contexte.** Sur la ferme réelle, la pluie estimée après coup manque pour
tous les jours depuis le 9 novembre ; le module affiche « Dernière
synchronisation automatique : 13/11/2026 06:15 », en vert, sans alerte
(audit ergonomique du 19 novembre 2026, section 9). Les journaux de
Cloudflare, lus le 19 novembre sur l'accord du porteur, montrent la
synchronisation de 6 h 15 qui tourne chaque matin, Visual Crossing qui
répond, et la réanalyse d'Open-Meteo qui échoue trois fois, aussitôt, en
« réseau », sans réponse ni statut ; la même adresse répond en 0,2 s
depuis un navigateur ordinaire. Le même jour, le porteur retient les cinq
lots de correction de l'audit (11 h 39).

**Décision.**

1. Le correctif de la météo passe avant le lot G, en trois PR, une à la
   fois (24 quaterdecies) : l'appel réseau et la vraie erreur journalisée ;
   une alerte au-delà de 36 heures sans mise à jour automatique réussie ;
   plus de seconde exécution chaque matin.
2. **Les adaptateurs météo n'appellent plus jamais un `fetch` gardé comme
   leur propre méthode.** Le `fetch` natif d'un Worker refuse d'être
   appelé ainsi ; l'adaptateur d'Open-Meteo, créé au chargement du
   module, le gardait dans un champ et l'appelait par `this.fetchImpl(…)`.
   Par défaut, les deux adaptateurs lisent le `fetch` global au moment de
   l'appel (`lib/adapters/network-call.ts`), et un `fetch` injecté est
   appelé seul. C'est la cause la plus probable, reproduite par un test ;
   la preuve sur le site est le journal du matin qui suit le déploiement.
3. Un échec d'appel météo journalise sa vraie erreur
   (`weather_external_failure` : nom, message, cause, temps écoulé), sans
   adresse ni clé ; un délai dépassé se reconnaît au signal d'abandon,
   quel que soit le type de l'erreur levée, et n'est plus compté comme une
   panne réseau.
4. Les lots **G, H, I, J et K** de l'audit du 19 novembre 2026 sont
   inscrits à la roadmap (24 quindecies à 24 undevicies), chacun en
   **Opus 5.5 · Élevé**, dans cet ordre, après le correctif météo. Deux
   réponses du porteur valent pour le lot G : la dose de la proposition du
   jour pour ce matériel, sinon un champ vide (11 h 37) ; une confirmation
   au-delà de l'objectif de la semaine de la planche (11 h 42).

Ne changent pas : D-019 (la pluie d'un jour passé : pluviomètre, sinon
réanalyse, sinon prévision), D-055 (Fable interdit), le calendrier de la
synchronisation (6 h 15).

## D-165 — Correctif météo, PR 2 : une mise à jour automatique en retard se dit

Date : 19 novembre 2026.

**Contexte.** Six jours après la dernière réussite de la mise à jour
automatique de la météo, le module affichait encore sa date en vert, sans
alerte (audit ergonomique du 19 novembre 2026, section 9 ; D-164).

**Décision.** La date de la dernière mise à jour automatique réussie reste
en vert tant qu'elle a moins de **36 heures** : la tâche passe chaque jour à
6 h 15, et 36 heures laissent passer un matin manqué de quelques minutes
sans fausse alerte. Au-delà, ou quand des tentatives n'ont jamais réussi,
la ligne devient un avertissement : « Mise à jour automatique de la météo
en retard », la date de la dernière réussite, la dernière erreur
enregistrée telle quelle, et le rappel que les valeurs déjà enregistrées
restent affichées. La règle vit dans
`lib/domain/weather/automatic-refresh-status.ts`, appelée aux deux endroits
qui montraient la date (« Objectifs et besoins » et « Réglages »).

Ne changent pas : D-164 ; ce que la tâche enregistre (tentative, réussite,
erreur) ; la mention « données anciennes » des lectures de la semaine.

## D-166 — Correctif météo, PR 3 : une seule exécution de la synchronisation chaque matin

Date : 19 novembre 2026.

**Contexte.** Les journaux de Cloudflare du 19 novembre 2026 montrent la
route de synchronisation du site appelée deux fois chaque matin : la
première, qui enchaîne la météo puis les calculs du matin (planning, eau
des cultures, réserve du sol, coffre), dépasse les 25 secondes que le
planificateur lui laissait ; il l'abandonne et la relance, alors qu'elle
travaille encore. La seconde exécution, après la fin de la première,
refait tout (environ 15 s).

**Décision.** Le planificateur laisse **90 secondes** à la route
(`SITE_SYNC_TIMEOUT_MS`) et ne relance **jamais** un appel abandonné pour
délai dépassé : il le journalise (`weather_scheduler_timeout_not_retried`)
et s'arrête. Une coupure réseau, une réponse `429` ou `5xx` restent
retentées comme avant, trois tentatives au plus. La règle vit dans
`cloudflare/irrigation-weather-scheduler/src/domain.ts` et y est testée.

Ne changent pas : le créneau de 6 h 15 ; le verrou D1 de la météo ; les
tentatives du moteur auprès du fournisseur météo (D-164).

## D-167 — Lot G, PR 1 : le module répond à côté du bouton

Date : 19 novembre 2026.

**Contexte.** Audit ergonomique du 19 novembre 2026, constat n° 1 : au
téléphone, le message d'« Arrosages », d'« Objectifs et besoins » et des
besoins s'affiche en tête de section, plus de 1 000 px au-dessus du bouton
appuyé ; le formulaire d'irrigation garde ses champs après une réussite,
et un second appui sur « Planifier l'irrigation » crée une seconde
irrigation identique, que le serveur ne signale qu'après l'avoir écrite.
Lot G retenu par le porteur le 19 novembre 2026 à 11 h 39 ; contrat court
`docs/audit-ergonomie-2026-11-19-lot-g-contract.md` (sections 1 à 3).

**Décision.**

1. Chaque message porte l'endroit du geste qui l'a fait naître et ne
   s'affiche que là, juste sous le bouton appuyé, amené en vue au plus
   près (`app/irrigation/shell/action-reply.tsx`) : formulaire
   d'irrigation, objectif, pluie mesurée, limite journalière, commune,
   « Actualiser la météo », seuil, décision d'une planche ; une action
   d'une carte « À venir » en tête de cette liste ; le reste en tête de
   section, comme avant (F404).
2. Un rechargement automatique des besoins ne dit plus « Les besoins ont
   été recalculés » ; seule son erreur s'affiche (F405).
3. Après une réussite, le formulaire d'irrigation se vide : matériel,
   réglage et note vides, quantité et durée à leur valeur de départ ; son
   bouton redevient indisponible. Les dates restent (F406).
4. Une irrigation du même matériel sur un créneau où il en a déjà une
   planifiée, non démarrée, demande une confirmation dans la fenêtre du
   module ; sans elle, le serveur n'écrit rien
   (`findScheduleConflictForUser`, lue avant toute écriture) ; donnée, il
   écrit et garde l'avertissement d'aujourd'hui (F407).
5. La fenêtre de confirmation du module (`shell/confirm-dialog.tsx`) :
   titre, phrase, le geste qui ne fait rien à gauche, Échap qui ferme ;
   vert pour ce qui ajoute, rouge pour ce qui efface (F408, reprise par
   le n° 8 en PR 4).

Ne changent pas : ce que chaque bouton écrit une fois confirmé ; le
moteur, le planificateur ; la règle du refus (D-030) ; les classes de
dessin des messages.

## D-168 — Tranche 4, sous-tranche 4.4 : le contrat de l'accueil d'une nouvelle ferme

Date : 19 novembre 2026.

**Contexte.** L'inventaire du propre à la ferme (18 novembre 2026) a relevé
sept défauts silencieux qui feraient un calcul faux pour une ferme neuve
(n° 1, 4, 13, 14, 19, 21, 22), et le porteur a répondu aux onze questions
agronomiques qu'il portait (Q1 à Q11).

**Décision.** La section 8 bis du contrat de la Tranche 4 (F417 à F428)
fixe l'accueil : huit étapes reprenables, état gardé par espace ; la
commune météo choisie par la personne (le siège d'OTF en dernier recours,
dit) ; le classement abri ou plein champ validé parcelle par parcelle ; le
sol préconfirmé depuis la texture d'OTF, TEW et REW au milieu de la
fourchette du tableau 19 de la FAO-56 ; la région d'origine des cultures
affichée ; les réglages de départ montrés « proposé, à ajuster » ; aucun
planning avant validation des réglages de planning ; la borne de l'ET0
portée de 12 à 15 mm/j ; l'espace existant du porteur marqué, valeurs
inchangées ; le pilote limité à la France métropolitaine. Cinq PR, une à la
fois. Le porteur a tranché le 19 novembre 2026 : milieu de la fourchette,
textures par correspondance directe ou classe voisine, région
« Auvergne-Rhône-Alpes » pour ses conduites, modèle de ses 78 liens
espèce-culture (extraction de sa ferme réelle acceptée).

Ne change pas : le moteur hydrique ni les jeux de réglages communs
(section 11 du contrat), sauf la borne de l'ET0, à confirmer contre le
contrat commun avant le code. Aucune question de budget.
## D-169 — Lot G, PR 2 : la quantité proposée est la dose du jour, et l'objectif de la semaine se confirme

Date : 19 novembre 2026.

**Contexte.** Audit ergonomique du 19 novembre 2026, constat n° 9 :
« Irriguer maintenant » et « Planifier » proposent 25 mm d'office, quel que
soit le matériel, et rien ne compare la quantité à l'objectif de la
semaine. Deux réponses du porteur le même jour : « la dose du jour, sinon
vide » (11 h 37) ; « au-delà de l'objectif de la semaine » (11 h 42).

**Décision.**

1. À chaque choix d'un matériel, la quantité prend la dose de la
   proposition du planning pour ce matériel le jour de l'irrigation
   (aujourd'hui, ou le jour de la date de début pour « Planifier »),
   proposée ou validée, la première du jour ; sinon le champ reste vide et
   le bouton indisponible. Planning décoché : champ vide. Une saisie n'est
   remplacée qu'au changement de matériel. Le plan est lu enregistré, sans
   calcul (`lib/services/irrigation-form-hints.ts`) ; la règle vit dans
   `lib/domain/irrigation-form-hints.ts` (F409).
2. Avant d'enregistrer une irrigation en cours ou planifiée, si l'apport
   estimé de cette irrigation sur une planche atteinte dépasse l'objectif
   adopté de sa semaine, la fenêtre du module le dit et demande ; sans
   objectif adopté, aucune fenêtre. Un avertissement, jamais un refus :
   confirmé, l'arrosage s'enregistre. Une irrigation déjà réalisée ne
   demande rien (F410).

Ne changent pas : le calcul de la durée et de l'apport ; les objectifs et
leur règle (D-034) ; le planificateur.

## D-170 — Lot G, PR 3 : « Refuser » se confirme, et le message dit où le besoin est allé

Date : 19 novembre 2026.

**Contexte.** Audit ergonomique du 19 novembre 2026, constat n° 7 :
« Refuser » une proposition du planning agit d'un appui, alors qu'un refus
vaut pour tout le reste de la semaine (D-030), et son message,
« Proposition refusée : le besoin reste affiché », ne dit pas que le
recalcul replace souvent le besoin ailleurs.

**Décision.**

1. « Refuser » ouvre la fenêtre du module : « Refuser ce créneau pour
   toute la semaine ? », boutons « Garder la proposition » et « Refuser le
   créneau », ce dernier en rouge (F411).
2. Après le refus, la carte dit « Créneau refusé. Le plan se recalcule
   pour replacer le besoin… », puis, le plan recalculé relu : « Créneau
   refusé. Le besoin est replacé jeudi à 12 h 26 (Goutte-à-goutte du
   champ du bas). », ou « Créneau refusé. Aucun autre créneau cette
   semaine : le besoin reste affiché, non placé. ». La règle cherche, dans
   le nouveau calcul, la proposition qui sert au moins une planche du
   créneau refusé, la plus proche de son heure
   (`lib/domain/planning/refusal-replacement.ts`) (F412).

Ne changent pas : la règle du refus (D-030) ; le recalcul après un refus ;
le moteur.

## D-171 — Lot G, PR 4 : une seule fenêtre de confirmation, le rouge pour ce qui efface

Date : 19 novembre 2026.

**Contexte.** Audit ergonomique du 19 novembre 2026, constat n° 8 : sept
gestes se confirment dans la boîte grise du navigateur, les autres dans
une fenêtre du module ; « Tout vider » ouvre une fenêtre dont le bouton
dit « Retirer les objectifs », en vert ; « Retirer (stocker) », un geste
qu'on peut défaire, est dessiné en rouge comme une suppression.

**Décision.**

1. Les sept boîtes du navigateur (archiver et supprimer un matériel,
   supprimer un réglage, supprimer un groupe de jardins, annuler le
   reliquat, annuler une irrigation planifiée, supprimer un créneau
   protégé) deviennent la fenêtre du module (`shell/use-confirm.tsx`, sur
   `shell/confirm-dialog.tsx`) ; leurs phrases restent, un titre court et
   deux boutons nommés par leur geste s'y ajoutent (F413).
2. Le bouton de confirmation est rouge pour ce qui efface ou annule : les
   sept, « Vider les objectifs », « Refuser le créneau ». « Retirer
   (stocker) » quitte le rouge (contour neutre) et se confirme en vert
   (F414).
3. « Tout vider » devient « Vider les objectifs » ; la fenêtre dit « Vider
   les objectifs de cette semaine ? » et son bouton « Vider les
   objectifs » (F415).

Ne change pas : ce que chaque geste fait une fois confirmé.

## D-172 — Lot G, PR 5 : l'initiale ouvre le menu du compte

Date : 19 novembre 2026.

**Contexte.** Audit ergonomique du 19 novembre 2026, constat n° 6 :
l'initiale de la barre du haut est le lien de déconnexion ; un appui par
mégarde déconnecte. La charte le disait (« L'initiale reste le lien de
déconnexion ») ; le porteur a retenu le lot G, et ce changement de charte
avec lui, le 19 novembre 2026 à 11 h 39.

**Décision.** L'initiale ouvre un petit menu (`shell/account-menu.tsx`) :
le nom de la personne, puis « Se déconnecter », le lien de toujours. Le
menu se ferme par Échap (le focus revient sur l'initiale), par un appui
ailleurs ou sur l'initiale. Le dessin de l'initiale et sa cible de 44 px
au téléphone ne changent pas. La ligne de la charte
(`docs/charte-module.md`, la cloche et l'initiale) change en conséquence
(F416).

Ne changent pas : l'adresse de déconnexion ; la cloche ; la barre.

## D-173 — Lot H, PR 1 : la pluie dit d'où elle vient

Date : 19 novembre 2026.

**Contexte.** Audit ergonomique du 19 novembre 2026, constat n° 3 : sur
« Aujourd'hui », la tuile « Eau reçue » écrit « de pluie mesurée » et la
légende d'« Eau de la semaine » « Pluie mesurée » quelle que soit
l'origine de la pluie. Or, pour un jour passé, la pluie comptée est celle
du pluviomètre, sinon la réanalyse, sinon la prévision enregistrée
(D-019) ; la réanalyse arrive avec cinq jours de retard : sans
pluviomètre, la pluie de la semaine en cours est presque toujours de la
prévision. Le lot H a été retenu par le porteur le 19 novembre 2026 à
11 h 39 ; contrat court `docs/audit-ergonomie-2026-11-19-lot-h-contract.md`.

**Décision.** La page lit la pluie extérieure des jours écoulés par
origine (`pastRainOrigins`, `lib/domain/today/week.ts`), dans l'ordre même
de D-019 : mesurée, estimée après coup, prévue. La tuile dit
« 30,7 mm de pluie prévue, non mesurée », « 12 mm de pluie mesurée »,
« 8 mm de pluie estimée après coup », ou, mêlée, « 30,7 mm de pluie, dont
12 mm mesurés et 18,7 mm prévus », chaque part au prorata de la pluie
extérieure ; sous abri, « 0 mm de pluie, sous abri ». La légende nomme
les mêmes origines (« Pluie prévue, non mesurée », « Pluie mesurée et
prévue ») ; sans origine connue, « Pluie » seule, jamais « mesurée »
(F429).

Ne changent pas : la pluie comptée (D-019), le besoin, le reste à
apporter, les autres pages ; « Pluie mesurée » d'« Objectifs et besoins »,
qui est bien la saisie du pluviomètre.

## D-174 — Lot H, PR 2 : les jardins qui comptent d'abord

Date : 19 novembre 2026.

**Contexte.** Audit ergonomique du 19 novembre 2026, constat n° 4 :
« Eau de la semaine » et « Réserve du sol » gardaient les huit premiers
jardins de la liste ; sur une ferme de douze jardins, les quatre tunnels à
arroser ce jour-là étaient cachés derrière « Voir les 10 autres jardins »,
et les noms rangés caractère par caractère. Le contrat de la page (T9)
disait « huit » sans dire lesquels.

**Décision.** Les huit montrés d'emblée sont ceux qui comptent
(`lib/domain/today/week.ts`, `soil.ts`) : d'abord les jardins dont une
planche a une irrigation à faire aujourd'hui (en retard, planifiée ou à
valider) ; puis, pour l'eau, ceux qui ont un objectif, du plus loin au
plus près (le reste rapporté à l'objectif, puis le reste en mm ; un reste
inconnu après les connus), puis ceux sans objectif ; pour le sol, les plus
secs, puis les « inconnue », puis « aucune planche cultivée » ; à égalité,
l'ordre naturel. Les jardins repliés suivent l'ordre naturel (F430 à
F432). La précision T9 du contrat d'« Aujourd'hui » est réécrite.

Ne changent pas : le nombre de jardins montrés (huit), les valeurs, la
ligne de la ferme en tête d'« Eau de la semaine ».

## D-175 — Lot H, PR 3 : « Aujourd'hui » voit l'arrosage en cours et le reliquat

Date : 19 novembre 2026.

**Contexte.** Audit ergonomique du 19 novembre 2026, constat n° 2 : après
« Démarrer l'irrigation », « Aujourd'hui » disait « Rien à arroser » et
« Rien d'urgent aujourd'hui » vanne ouverte ; après un arrêt en route, le
reliquat restait invisible. La page ne connaissait que quatre états :
non faite, en retard, planifiée, à valider. Ce constat change le contrat
de la page validé le 8 novembre 2026 (D-074) ; le porteur l'a retenu avec
le lot H le 19 novembre 2026 à 11 h 39.

**Décision.** En tête de « Votre journée » (`lib/domain/today/now-irrigations.ts`,
`app/irrigation/today/today-day.tsx`) : chaque irrigation dont le
minuteur tourne (« depuis 9 h 40, fin prévue à 13 h 50 »), est en pause
(« en pause depuis 10 h 05 ») ou attend sa confirmation (« Durée
atteinte », « fermer la vanne »), avec un lien « Arrêter / Terminer » qui
ouvre sa carte sur « Arrosages », où l'arrêt garde sa confirmation et sa
durée réelle (D-028) ; puis chaque reliquat d'une irrigation partielle,
non annulé, comme le lit « Arrosages » (« reste 3 h 10 · 1,52 m³ »), avec
« Reprendre le reliquat », le même geste. La phrase du jour, les
pastilles (« 1 en cours », « 1 reliquat ») et le sous-titre les comptent ;
« Rien à arroser » ne se dit plus quand l'une d'elles existe. Les jardins
de ces irrigations comptent parmi ceux arrosés aujourd'hui (F430). Le
contrat d'« Aujourd'hui » gagne ces lignes (section 3.2, précision T20 ;
F433 à F435).

Ne changent pas : « Tout est fait » (T15) ; la frise ; les gestes et les
confirmations d'« Arrosages ».

**Corrigé en passant.** Le parcours P24 a montré au téléphone qu'une bulle
« D'où vient ce chiffre ? » très longue (une planche sous une vingtaine de
matériels) montait au-dessus de l'écran, son « Fermer » hors d'atteinte. La
bulle a désormais une hauteur maximale, la fenêtre moins le bandeau et la
barre du bas au téléphone, la fenêtre moins ses marges à l'ordinateur, et
défile en elle-même ; « Fermer » reste à l'écran.

## D-176 — Lot H, PR 4 : l'ordre naturel partout

Date : 19 novembre 2026.

**Contexte.** Audit ergonomique du 19 novembre 2026, constat n° 14 : la
liste « Matériel » d'« Arrosages » offrait 32 choix à plat rangés
caractère par caractère (« gag10 … gag16, gag2 »), « Eau de la semaine »
rangeait « bloc 1, Bloc 10, Bloc 11, Bloc 2 », une carte du planning
« T1-1, T1-8, T1-7 … T1-2 ». L'ordre naturel existait
(`lib/domain/bed-order.ts`) mais ne servait qu'à une partie des tris.

**Décision.** Chaque tri d'un nom affiché passe par
`compareNamesNaturally` (vingt fichiers du domaine, des pages et de la
base) ; un test de garde refuse tout autre tri par nom, sauf ceux du
moteur du planning, qui fixent l'ordre du calcul et jamais un affichage
(F436). La liste « Matériel » est regroupée par jardin
(`lib/domain/equipment-by-garden.ts`) : le jardin où le matériel est
posé, ou son groupe de jardins, « Sans jardin » en dernier (F437). Les
planches d'une carte du planning s'affichent dans l'ordre naturel, sans
changer l'ordre enregistré du plan.

Ne changent pas : les plans calculés, l'ordre des propositions, les
comparaisons de doublons de noms.

## D-177 — Lot H, PR 5 : « Aujourd'hui » se lit mieux

Date : 19 novembre 2026.

**Contexte.** Audit ergonomique du 19 novembre 2026, constat n° 13 :
l'heure de la page restait figée (« 9 h 24 » à 9 h 35) ; « Reste à
apporter 3,9 mm — objectif moins l'eau reçue, jamais négatif » à côté
d'« Eau reçue 30,7 mm » pour un objectif de 20 mm, sur une tuile orange
un jour normal ; l'heure coupée en deux lignes au téléphone ; deux
icônes pour deux goutte-à-goutte ; « dont 3 à valider » sur 3, « arrosage »
et « irrigation » dans la même phrase, deux « sur » ; l'objectif
d'« Historique » différent de celui d'« Aujourd'hui » sans explication.

**Décision.** La page se relit seule toutes les cinq minutes à l'écran, et
au retour sur l'onglet quand sa lecture a plus d'une minute, jamais
pendant un geste ni fenêtre ouverte (F438). « Reste à apporter » nomme les
jardins encore sous leur objectif quand une partie seulement l'est (trois
noms, puis « et n autres », F439), sur la couleur neutre des tuiles
(F440). L'heure d'une carte ne se coupe plus (F441). Une proposition porte
l'icône de son matériel, que le plan garde (F442). « Irrigation » partout ;
« 3 irrigations sont à valider aujourd'hui » quand toutes le sont ;
« 15 / 26,7 mm (5 planches de 10 ont un objectif) » (F443). La cause de
l'écart avec « Historique » est établie : il divise par toute la surface,
les planches sans objectif comptées à 0 ; il le dit sous son chiffre,
sans changer le calcul (F444).

Ne changent pas : les calculs, l'objectif d'« Historique », les gestes.


## D-178 — Lot I, PR 1 : le manque dit d'où il vient

Date : 19 novembre 2026.

**Contexte.** Audit ergonomique du 19 novembre 2026, constat n° 5 : sur la
démonstration « Pic d'été, l'eau manque », « Répartir l'eau » menait à un
écran sans rien à répartir, qui ne parlait jamais du manque annoncé.
**Cause établie dans le code** (démonstration rejouée sur la machine de
développement) : le bassin offrait 2 m³ d'ici dimanche pour 1,2 m³ de
besoins des planches qui ont un objectif ; la faisabilité de
« Ressources » ne compare l'eau qu'à ces besoins et ne trouvait aucun
manque. Le moteur du planning compte l'eau que le matériel tire : chaque
goutte-à-goutte arrose aussi les planches sans culture qu'il couvre, au-delà
de leur besoin (le surplus, R11) ; quatre irrigations tiraient 1,95 m³ pour
en porter 0,84 aux planches qui en avaient besoin, d'où 367 L de manque.
Les deux calculs sont justes ; aucun ne le disait.

**Décision.** Le plan enregistré se lit, sans calcul nouveau : l'eau que
ses créneaux proposés ou validés versent au-delà du besoin, et les
planches qui la reçoivent. Quand le plan manque d'eau, la phrase du manque
la dit, au planning et sur « Aujourd'hui » (F445). Quand la faisabilité ne
voit pas le manque du planning, l'écran de répartition dit d'où il vient
et quoi faire (fermer leurs lignes, retirer ces planches du matériel,
fixer leur objectif), ou, sans eau versée au-delà du besoin, que le manque
vient des heures, des pompes ou du remplissage, avec le lien vers le
planning (F446). Les deux avertissements orange deviennent des notes en
texte ordinaire ; « Recalculer la faisabilité » passe en bouton secondaire
(F447). Le bassin du moment « Pic d'été » de la démonstration passe de 6 à
5 m³ : les besoins des planches cultivées dépassent l'eau, et l'écran de
répartition a un choix à proposer (F448, une donnée de la ferme fictive).

Ne changent pas : le moteur du planning, la faisabilité, les besoins, les
gestes. Logiciel multi-fermes : la phrase vaut pour toute ferme dont le
matériel arrose des planches sans besoin.

## D-179 — Lot I, PR 2 : la démonstration à son jour

Date : 19 novembre 2026.

**Contexte.** Audit ergonomique du 19 novembre 2026, constat n° 10 : un
objectif « ferme entière » de 60 mm posé dans la démonstration apparaissait
dans la liste, mais ne changeait ni les besoins ni « Aujourd'hui ». **Cause
vérifiée** : la révision recevait sa date de la base (`created_at`, horloge
réelle) ; la démonstration vit au jour simulé (juin, juillet) ; la règle
qui fait compter un objectif posé après sa semaine à partir du lundi qui
suit (`goalRevisionFirstDate`, D-034) le repoussait à fin novembre.

**Décision.** Les écritures dont une règle relit la date portent l'heure
du module au lieu de celle de la base : les révisions d'objectif (posées,
reprises de la semaine précédente, vidées) et la limite journalière, dont
la plus récente l'emporte (F449). En démonstration, l'heure du module est
le jour simulé ; ailleurs, l'heure réelle, à la même forme que la valeur
par défaut de la base. Inventaire établi dans le code : les créneaux
protégés et les objectifs adoptés portaient déjà l'heure du module ; les
autres dates d'écriture ne sont relues par aucune règle.

Ne changent pas : la règle D-034, les calculs, la ferme réelle (son heure
du module est l'heure réelle). Aucune migration.

## D-180 — Lot I, PR 3 : la démonstration se prépare jusqu'au bout

Date : 19 novembre 2026.

**Contexte.** Audit ergonomique du 19 novembre 2026, constat n° 11 : une
démonstration en ligne restait à moitié prête plus de 30 minutes (planning
« Aucun calcul », 9,5 s par page), jusqu'à « Remettre à zéro ». **Cause
établie dans le code** : la préparation crée l'espace, écrit ses données,
puis coche les cases en dernier, qui disent « prêt ». Interrompue entre les
deux, elle laissait un espace créé sans cases : chaque requête suivante
attendait cinq secondes qu'une autre finisse, puis montrait l'espace à
moitié écrit, et rien ne le complétait.

**Décision.** Une préparation commencée depuis plus de deux minutes sans
ses cases est reprise par la requête suivante : l'espace est mis de côté
(comme par « Remettre à zéro »), d'une seule écriture qui n'aboutit que pour
une requête, puis préparé de nouveau jusqu'au bout (F450). Une requête qui
arrive pendant une préparation en cours attend deux secondes au plus, puis
la page dit « Préparation de votre démonstration… » et se relit seule
toutes les deux secondes. Aucun essai d'invité ne se perd : un espace sans
cases n'a jamais été ouvert.

Ne changent pas : la remise à zéro, la tâche de nuit, la ferme réelle
(refusé hors démonstration). Aucune migration.

## D-181 — Lot I, PR 4 : le bandeau sur tablette

Date : 19 novembre 2026.

**Contexte.** Audit ergonomique du 19 novembre 2026, constat n° 12 : entre
601 et 950 px environ (une tablette debout), la phrase de la bannière de la
démonstration s'écrivait à une lettre par ligne ; la bannière faisait
1 169 px de haut à 768 px. **Cause vérifiée** : au-dessus de 600 px, la
bannière tient sur une ligne, et la phrase est le seul élément qui accepte
de rétrécir, jusqu'à zéro (`app/irrigation/styles/demo.css`).

**Décision.** La version compacte du téléphone (une ligne de 44 px, la
ferme et le moment, « Changer ») vaut jusqu'à 1 000 px ; au-dessus, la
bannière passe à la ligne et la phrase garde 18 caractères de large au
moins (F451). Mesuré sur la bannière seule : 44 px de haut de 390 à
1 000 px.

Ne change pas : la bannière au téléphone (J1, D-143) ; sa hauteur à
l'ordinateur reste au lot K (n° 24).

## D-182 — Lot I, PR 5 : petits défauts de la démonstration

Date : 19 novembre 2026.

**Contexte.** Audit ergonomique du 19 novembre 2026, constat n° 25 : sur la
démonstration, une alerte de froid à 2 °C montrait le soleil ; une alerte
non envoyée se lisait « Échec du service de notification » en rouge, alors
que les notifications y sont coupées exprès ; la ligne qui le dit restait
seule en bas de « Réglages » ; une ferme vierge ne savait pas par où
commencer, et « Cochera aussi … » ressemblait à un lien. **Causes
vérifiées** : le flocon ne suivait que le gel des cultures ou une minimale
sous 0 °C (`lib/domain/today/weather-days.ts`) ; le libellé d'un envoi ne
savait rien de la démonstration (`weatherAlertDeliveryLabel`).

**Décision.**

- **F452** : la première ouverture propose « Commencer par l'essentiel »,
  qui coche Arrosages, Objectifs et besoins, Matériel et placement (avec ce
  dont elles ont besoin) et garde ce qui l'était ; rien n'est coché
  d'office. « Cochera aussi … » se lit en texte ordinaire, gris.
- **F453** : un jour qu'une alerte météo sur la température minimale « en
  dessous de » annonce porte le flocon, même au-dessus de 0 °C.
- **F454** : en démonstration, un envoi manqué, sans appareil ou relancé se
  lit « Non envoyée : notifications coupées dans la démonstration », en
  couleur neutre ; hors démonstration, rien ne change.
- **F455** : dans « Réglages » en démonstration, la ligne des
  notifications coupées se lit sous le titre « Notifications du
  téléphone ».

Ne changent pas : l'envoi des alertes et leur historique enregistré, le
calcul des alertes, la liste des fonctionnalités. Aucune migration.

## D-183 — Lot J, PR 1 : un seul titre

Date : 19 novembre 2026.

**Contexte.** Audit ergonomique du 19 novembre 2026, lot J « Pages courtes
au téléphone » (n° 15, n° 18 et le reste du lot D), retenu par le porteur
le 19 novembre 2026 à 11 h 39 ; contrat court
`docs/audit-ergonomie-2026-11-19-lot-j-contract.md` écrit avant le code,
budgets de hauteur par page au téléphone suivant l'option recommandée du
rapport. Constat n° 18 : six pages disaient leur titre deux fois, la page
puis son premier bloc (« Historique et cumuls » puis « Cumuls et
historique »), trois en sautant un niveau de titre. **Cause vérifiée** :
chaque bloc gardait le titre qu'il avait quand il était un bloc parmi
d'autres sur une seule page, avant la 3.8.

**Décision (F456).** Le titre d'un premier bloc qui redit la page est
caché à l'écran et reste pour les lecteurs d'écran, en `h2` sous le `h1`
de la page ; le surtitre qui redisait la page (« Planning · saison »,
« Suivi réel · saison ») disparaît. Sur « Réserve du sol », « Alertes
météo » et « Alertes cultures », les sous-titres remontent d'un niveau, à
la même taille. Les ancres existantes mènent toujours au bloc.

Ne changent pas : les autres titres, le contenu des blocs. Aucune
migration.

## D-184 — Lot J, PR 2 : « Besoin par culture », le pli des réglages

Date : 19 novembre 2026.

**Contexte.** Audit ergonomique du 19 novembre 2026, constat n° 15 :
« Besoin par culture » mesurait 4 480 px au téléphone, dont 1 500 à
1 700 px pour « Réglages du calcul », ouvert d'office. **Cause vérifiée** :
le pli « Réglages de cette page » du lot D (J2, D-149) avait été posé sur
quatre pages, pas sur celle-ci (`crop-coefficients-panel.tsx`).

**Décision (F457).** « Réglages du calcul » est rangé dans le pli
« Réglages de cette page », fermé, en bas de la page ; un lien vers un
élément qu'il contient l'ouvre. Budget de la page au téléphone : 3 000 px
sur une ferme qui cultive ; sur les données des parcours, sans culture de
la saison (les 32 cultures de référence ouvertes, F302), la page passe de
5 541 à 3 961 px, et P40 la borne à 4 000.

Ne changent pas : les réglages eux-mêmes et leur calcul. Aucune migration.

## D-185 — Lot J, PR 3 : « Réserve du sol », les jardins pareils en une barre

Date : 19 novembre 2026.

**Contexte.** Audit ergonomique du 19 novembre 2026, constat n° 15 : sur la
ferme du porteur, « Réserve du sol » montrait 18 barres de 107 px, dont 11
identiques à 100 % (3 733 px au téléphone) ; « 100 % » se coupait en
« 100 » puis « % » ; « 11 jardins de plein champ — 100 % du plein, observé
le vendredi 6 novembre » se lisait comme une observation à 100 %, alors que
l'observation était de 50 % et le 100 % l'estimation du jour. **Cause
vérifiée** : le pli des jardins pareils (lot 3, point 13) rangeait les
lignes, pas les barres du graphique (`garden-bars.ts`), et sa phrase mêlait
l'estimation et le jour de l'observation.

**Décision (F458).** Les jardins de plein champ que la page range déjà
ensemble (même % arrondi, même jour d'observation), au même % prévu
dimanche, sans planche sous son seuil, n'ont qu'une barre, « 11 jardins de
plein champ » (« Tous les jardins de plein champ » quand ils le sont tous),
avec trois noms puis « et n autres » ; chaque planche y reste un point ;
toucher la barre ouvre le premier jardin et le pli des autres. Un abri, un
jardin inconnu ou dont une planche est sous son seuil garde sa barre.
« 100 % » et les repères du curseur ne se coupent plus. Le pli dit « 100 %
du plein estimé aujourd'hui · dernière observation le … ». Budget de la
page au téléphone : 2 600 px.

Ne changent pas : la jauge et son calcul (D-047, D-053), l'ordre des
jardins. Aucune migration.

## D-186 — Lot J, PR 4 : « Réglages », les espèces pliées, une seule liste

Date : 19 novembre 2026.

**Contexte.** Audit ergonomique du 19 novembre 2026, constat n° 15 :
« Réglages » mesurait 11 672 px au téléphone sur la ferme du porteur, dont
8 692 pour « Correspondance des espèces » (77 espèces), et les 36 espèces à
rattacher y paraissaient deux fois. **Cause vérifiée** : la liste des
espèces était toujours ouverte, et la liste « Espèces sans référence Kc »
reprenait chaque espèce non rattachée ou rattachée à « sans référence »,
celles que la liste des espèces met déjà en tête (`speciesNeedsLink`).

**Décision (F459).** « Correspondance des espèces » garde son titre et sa
phrase ; ses deux listes sont dans un pli fermé dont le titre porte le
compteur (« 36 espèces à rattacher sur 77 »), ouvert par son ancre
(`#correspondance-des-especes`) ou celle d'un élément qu'il contient, comme
le pli « Réglages de cette page » (même composant). La liste « sans
référence Kc » ne garde que les séries qu'une exception met « sans
référence » quand leur espèce est rattachée ; sinon une phrase renvoie aux
espèces à rattacher. Budget de la page au téléphone : 3 000 px.

Ne changent pas : les rattachements, les propositions d'après le nom, la
recherche. Aucune migration.

## D-187 — Lot J, PR 5 : « Objectifs et besoins » court au téléphone

Date : 19 novembre 2026.

**Contexte.** Audit ergonomique du 19 novembre 2026, constat n° 15, et le
cas non conforme de la recette du lot D (16 novembre 2026) : « Objectifs et
besoins » mesurait 4 704 px à 390 px sur les données des parcours. **Cause
vérifiée** : les tuiles de la semaine (536 px), les encarts des objectifs,
de la météo et de la pluie mesurée toujours ouverts (486, 329 et 386 px),
et chaque jardin replié sur cinq lignes (173 px), son résumé portant la
zone, le nombre de planches, le besoin réel, le volume et les trois
priorités.

**Décision (F460).** Les objectifs, la météo de référence et la pluie
mesurée sont trois plis fermés à ancre (`#objectifs-de-la-semaine`,
`#meteo-de-reference`, `#manual-rain`), une ligne de résumé chacun ; celui
de la météo s'ouvre d'office sur une erreur, des données anciennes ou une
mise à jour automatique en retard. Au téléphone, les tuiles deviennent une
ligne de résumé qui les déplie, comme au planning (F11), et chaque jardin
une ligne compacte (le nom, le reste à apporter, l'état : « à compléter »,
« couvert » ou les planches en priorité haute), son détail en tête du
jardin ouvert. Dans une planche, « À planifier » puis le besoin réel ;
besoin effectif, volume et déficit relatif sous « Pour les experts »,
fermé. 4 704 → 2 750 px ; budget de la page au téléphone : 2 800 px. À
l'ordinateur, rien ne change au-delà des plis.

Ne changent pas : les calculs, les chiffres affichés, les liens vers
`#manual-rain` (« Aujourd'hui », « Historique »), qui ouvrent le pli.
Aucune migration.

## D-188 — Lot J, PR 6 : « Matériel » en trois onglets

Date : 19 novembre 2026.

**Contexte.** Audit ergonomique du 19 novembre 2026, constat n° 15 :
« Matériel » mesurait 17 546 px au téléphone sur la ferme du porteur, son
inventaire commençait vers 11 300 px ; trois noms de matériel y étaient
coupés à la fin, impossibles à distinguer (« Goutte-à-goutte du c… »), et
le fil d'Ariane sortait de l'écran. **Cause vérifiée** :
`hierarchy-browser.tsx` montrait le plan (chaque jardin ouvert), l'aperçu,
les groupes et l'inventaire l'un sous l'autre ; les noms se coupaient par
`text-overflow: ellipsis`, en fin de nom ; le fil d'Ariane ne passait pas à
la ligne (`white-space: nowrap`).

**Décision (F461).** Trois onglets en tête de page, **Plan · Matériel ·
Groupes**, le plan d'abord ; l'onglet est gardé dans l'adresse
(`?onglet=materiel`, `?onglet=groupes`) ; « Aperçu instantané » et le pli
des réglages de la planche vont avec le plan. Les onglets cachés restent
rendus : rien de ce qui s'y saisit ne se perd. Poser un matériel depuis
l'inventaire bascule sur le plan et y reste (les autres onglets sont
indisponibles pendant la pose). Au téléphone, chaque jardin du plan est replié
sur une ligne (nom, planches, matériel posé) et s'ouvre à l'appui ; celui
de la planche choisie est ouvert, et tous le sont pendant une pose. Les
noms de matériel de l'inventaire et de l'aperçu se coupent au milieu :
leurs huit derniers caractères restent entiers, le nom complet est dans la
bulle et reste le texte de l'élément. Le fil d'Ariane passe à la ligne.
Budget de la page au téléphone : 5 300 px (1 782 px sur les données des
parcours, quatre jardins).

Ne changent pas : le placement, l'inventaire, les groupes, la vue
satellite. Aucune migration.

## D-189 — Lot J, PR 7 : « Arrosages » et « Historique », le premier geste plus haut

Date : 19 novembre 2026.

**Contexte.** Audit ergonomique du 19 novembre 2026, constat n° 15 : sur
« Arrosages », « Résultat calculé » occupait près de 380 px au téléphone
avant tout choix (une durée nulle, des tirets) ; sur « Historique », les
quatre listes de filtres et le bouton d'export, en vert plein, passaient
avant les chiffres. **Cause vérifiée** : `IrrigationPreview` rendait ses
chiffres sans condition ; `irrigation-history-dashboard.tsx` plaçait
l'export dans l'en-tête et les filtres dans un bloc toujours ouvert.

**Décision (F462).** Les chiffres de « Résultat calculé » (durée, matériel,
réglage, étendue, volume, apport par planche) n'apparaissent qu'une fois un
matériel choisi et une durée qui n'est plus nulle (une quantité, une durée,
ou les dates d'une irrigation déjà réalisée : illisibles, le volume dit
toujours « Inconnu — vérifiez le début et la fin ») ; avant, une
phrase : « Choisissez un matériel et une quantité : la durée et le volume
s'afficheront ici. » Le bloc lui-même, son bouton, l'avertissement d'un
créneau protégé et la réponse du module (lot G, F404) restent toujours
rendus : la visite guidée garde son ancre, et le message qui suit un envoi
reste sous le bouton quand le formulaire se vide. Dans « Historique », la
période reste visible ; les filtres de périmètre vont dans un pli
« Filtrer », fermé, dont la ligne dit le périmètre choisi (« toute la
ferme » ou son nom) ; « Exporter CSV… » garde son libellé et son adresse,
passe après les tuiles des cumuls, en bouton secondaire.

Ne changent pas : les calculs, l'export, les filtres eux-mêmes. Aucune
migration.

## D-190 — Lot K, PR 1 : planning, le rouge pour le manque d'eau seul

Date : 19 novembre 2026.

**Contexte.** Audit ergonomique du 19 novembre 2026, constat n° 17, lot K
« Finitions de charte » (contrat court
`docs/audit-ergonomie-2026-11-19-lot-k-contract.md`, écrit avant le code et
joint à cette PR) : une semaine normale, la tuile « Planches non servies 2 »
était rouge pour deux planches dont le besoin (1,1 mm) est sous la dose
minimale et attend de grandir ; « Ajuster » montrait « 8,06 » quand la carte
disait « 8,1 mm » ; la ligne d'état de la semaine, très dense ; deux boutons
pour valider la seule proposition d'un jour ; « Réglages du planning » sans
signe qu'il s'ouvre. **Cause vérifiée** : `unplacedGroups`
(`lib/domain/planning/action-summary.ts`) ne disait « pour information »
qu'un groupe sans manque, or une planche sous la dose minimale garde un
petit manque ; le champ de la dose se formait à deux décimales ; la ligne
d'état tenait en un seul paragraphe ; le bouton du jour paraissait dès une
proposition ; le résumé du pli n'avait pas le chevron des autres plis.

**Décision (F463 à F467).** Une planche dont le seul motif est « besoin sous
la dose minimale » est dite pour information, comme une planche sans
objectif : hors du compte rouge de la tuile, de la ligne du téléphone et du
titre du pli, « en attente d'un besoin plus grand » dans le détail de la
tuile et « en attente » dans le titre du pli ; son groupe dit pourquoi. Le
manque d'eau et le temps de pompage, qui ne la comptaient déjà pas, ne
changent pas. Le champ de la dose d'« Ajuster » montre le chiffre de la
carte, à une décimale ; laissé tel quel, il rend la dose exacte de la
proposition, sans arrondi. La ligne d'état : la semaine et l'heure du calcul,
puis dessous, en petit, la prévision météo et les réserves. Le bouton qui
valide les propositions d'un jour paraît à partir de deux. « Réglages du
planning » prend le chevron des autres plis.

Ne changent pas : le moteur du planning, les motifs, le manque d'eau, les
gestes. Aucune migration.

## D-220 — Tranche 4, sous-tranche 4.5 : le contrat de l'exploitation

Date : 19 novembre 2026.

**Contexte.** La mise à jour météo est restée en panne du 14 au 19 novembre
2026 sans que personne ne le voie (D-164 à D-166), la restauration de la
base D1 n'a jamais été essayée (sections 10, 14 et 15 du contrat), et
l'effacement d'une ferme est volontairement incomplet (F360).

**Décision.** La section 10 bis du contrat de la Tranche 4 (F560 à F569)
fixe : un registre des tâches attendues, dont l'état se calcule sur la
dernière réussite et passe en orange puis en rouge quand elle manque ; une
veille quotidienne, sur un déclencheur distinct, qui prévient l'exploitant ;
une page d'état réservée à l'exploitant ; des journaux à noms stables sans
donnée sensible ; la sauvegarde et la restauration de D1 essayées sur une
base d'essai fictive (retour en arrière, reconstruction depuis un export,
perte de la clé maîtresse), jamais sur la production ; une durée de
conservation écrite par donnée ; l'effacement complet d'une ferme sous sept
jours, annulable, prouvé par un test d'exhaustivité ; un document de
support pour une seule personne. Cinq PR, une à la fois. Le porteur a
tranché le 19 novembre 2026 à 13 h 48 la seule question de budget : un
export hebdomadaire chiffré gardé par lui, gratuit, sans R2 ni service tiers.

Ne change pas : le moteur hydrique, le calcul, les coûts (aucune dépense
nouvelle). **La phrase des 30 jours** ajoutée à la politique de
confidentialité (« une donnée effacée reste récupérable dans l'historique
jusqu'à 30 jours ») **a été approuvée par le porteur le 19 novembre 2026**
à 20 h 52 (UTC) ; le code de la 4.5 l'applique telle quelle, sur la page
de confidentialité du site public, dans la PR 5.

## D-221 — Tranche 4, sous-tranche 4.6 : le contrat du pilote multi-fermes

Date : 19 novembre 2026.

**Contexte.** La 4.6 n'avait que deux lignes au contrat (section 10) : « 1 ou
2 fermes amies, lecture seule, accord écrit, recette, isolation en
conditions réelles, retour ». Elle est le premier moment où les données
d'une personne qui n'est pas le porteur entrent dans le module.

**Décision.** La section 10 ter du contrat de la Tranche 4 (F570 à F580)
fixe : douze conditions d'entrée, chacune vérifiée à la source et consignée
sur une fiche signée du « vas-y » du porteur ; le sens de « lecture seule »
(rien écrit chez OTF, aucun matériel, aucun arrosage déclenché) ; un modèle
d'accord écrit par version datée, relu gratuitement par le réseau du
porteur avant tout envoi ; une preuve d'isolation sur de vraies fermes où
l'assistant n'ouvre jamais l'espace d'une ferme tierce (la personne répond
pour la sienne, un contrôle de cohérence est rejoué sur une copie de
l'export) ; six causes d'arrêt immédiat et un retour en arrière essayé à
blanc ; une seule ferme d'abord, la seconde après une semaine sans défaut
grave ; un bilan jugé par le porteur qui n'ouvre rien d'elle-même. Aucun
code de fonctionnalité : un petit contrôle et des corrections. La 4.7, sans
contrat propre, se ferme avec la 4.3 (F350).

Sont réservés au porteur : le choix et le contact des fermes, l'envoi des
accords, la relecture juridique, Access, les secrets, le tableau de bord, la
part du quota (à poser à partir du 3 décembre 2026), le budget et toute
valeur agronomique.

Ne change pas : le moteur hydrique, le calcul, les coûts (aucune dépense
nouvelle).
