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
