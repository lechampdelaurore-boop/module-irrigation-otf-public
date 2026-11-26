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

## D-191 — Lot K, PR 2 : vue satellite, des numéros quand les noms se chevauchent

Date : 19 novembre 2026.

**Contexte.** Audit ergonomique du 19 novembre 2026, constat n° 16 : sur la
ferme du porteur, là où les jardins sont serrés, les noms posés sur la carte
se coupaient et se recouvraient (« Tunnel 4 », « …nel 3 », « Bloc Fleurs 3 »
posé sur « bloc 1 »). **Cause vérifiée** : `satellite-map.tsx` et
`satellite-svg-drawing.tsx` posent chaque nom au point d'étiquette de son
jardin, sans regarder ses voisins ; le nom se coupe à 160 px.

**Décision (F468).** Après chaque pose (chargement, zoom, taille changée), les
noms sont remis entiers, mesurés, puis parcourus dans l'ordre de la liste :
un nom qui chevaucherait un nom déjà posé (deux pixels d'air compris) devient
le numéro du jardin dans une pastille ronde, et les suivants l'évitent aussi.
La liste des jardins à côté de la carte porte ces numéros devant chaque nom
et sert de légende. Le nom entier reste dans la bulle de l'étiquette ; pour
le lecteur d'écran, rien ne change : les étiquettes restent cachées, la
liste dit les noms. La même règle vaut pour la carte et pour le dessin de
secours. La règle se calcule dans le domaine
(`lib/domain/satellite-view/labels.ts`), sur des rectangles.

Ne changent pas : les contours, le cadrage, les fonds, la liste elle-même.
Aucune migration.

## D-192 — Lot K, PR 3 : un bouton plein par écran, un seul dessin de pli, plus de geste muet

Date : 19 novembre 2026.

**Contexte.** Audit ergonomique du 19 novembre 2026, constat n° 21 : trois
dessins de pli cohabitaient (le chevron des lots D et J, le triangle du
navigateur, une boîte grise sans signe) ; des raccourcis et des choix en
vert plein disputaient le geste de la page (« Cette semaine », « 24 h /
48 h / 7 jours », « Créer un groupe » sur une ferme sans asperseur) ;
« Cette semaine » et « Retirer la mesure » répondaient sans rien faire ;
l'heure réelle de fin montrait les secondes ; finir un arrosage se disait
« Irrigation terminée », « Terminer maintenant » ou « Terminer
l'irrigation » selon l'écran.

**Décision (F469 à F473).** Une règle commune donne à tout pli du module
le chevron à droite de la charte, qui tourne à l'ouverture, et cache le
triangle du navigateur ; les menus « … » gardent leur dessin, ce ne sont
pas des plis, et les lignes « Voir le détail » des cultures et des espèces
gardent leur flèche, choisie par le porteur le 8 novembre 2026 (F469). Les raccourcis et les choix passent en secondaire,
contour et fond vert pâle ; l'horizon choisi se lit à son fond plein et à
`aria-pressed` ; « Créer un groupe » reste plein sur une ferme qui a un
asperseur (F470). « Cette semaine » est indisponible quand la semaine
affichée est la semaine en cours ; « Retirer la mesure » l'est quand le jour
choisi n'a pas de pluie mesurée (F471). « Heure réelle de fin » se saisit
à la minute ; laissée telle quelle, l'heure proposée part à la seconde du
minuteur, pour que la durée enregistrée ne perde rien (F472). Le bouton
qui finit un arrosage dit partout « Terminer l'irrigation » ; « Irrigation
terminée » reste l'état affiché et le titre de la notification (F473). Le
menu « … » d'une ligne planifiée qui ne garde qu'« Annuler » reste un
menu : F45 l'a éloigné de « Démarrer maintenant » exprès, pour qu'un doigt
pressé n'annule pas un arrosage.

Ne changent pas : les gestes eux-mêmes, les messages, le calcul de la durée.
Aucune migration.

## D-193 — Lot K, PR 4 : mots et formats

Date : 19 novembre 2026.

**Contexte.** Audit ergonomique du 19 novembre 2026, constat n° 22 : les
heures s'écrivaient de cinq façons (« 8 h 50 », « 07:00 », « 08:51 →
10:11 », « 16/06/2026 08:50 », « 21:00 – 08:00 »), les durées de deux
(« 1 h 21 », « 1 h 21 min ») ; des pluriels entre parenthèses
(« 0/7 jour(s) disponible(s) ») ; du jargon sur « Ressources »
(« Disponibilité / projections », « Apport non retenu (réserve pleine) »,
« Disponible théorique … mobilisables », « Analyse préliminaire »),
« Faisabilité recalculée. » en vert gras comme un lien, et « Espèces sans
référence Kc » sur « Réglages ». **Cause vérifiée** : chaque écran avait
son propre `Intl.DateTimeFormat` (`timeStyle: 'short'` rend « 08:50 »).

**Décision (F474 à F476).** Un seul module, `lib/domain/clock-text.ts`,
écrit l'heure (« 8 h 50 », « 18 h », « 0 h 05 »), la date et l'heure
(« 16/06/2026 à 8 h 50 », « 16 juin 2026 à 8 h 50 »), une heure de la
journée (« de 21 h à 8 h ») et la durée (« 1 h 21 », « 2 h »,
« 45 min »), toujours à l'heure de la ferme (D-004) ; les écrans et les
messages l'appellent (F474). Un compte s'accorde à son nombre (« 0 jour »,
« 1 jour », « 7 jours ») ; un intitulé se met au singulier ou au pluriel
selon la ligne (« Planche », « Planches ») (F475). Sur « Ressources » :
« L'eau des jours à venir », « Apport perdu, la réserve étant pleine »,
« Utilisable, avant les irrigations prévues » et « Utilisable, après les
irrigations prévues », sans « mobilisables » ; « De maintenant à dimanche
soir · les volumes, pas encore les horaires », la bulle « Ce que vérifie ce
calcul » ; « Faisabilité recalculée. » dans la boîte des autres messages.
Sur « Réglages », « Espèces sans culture de référence » (F476). Les
chiffres et le sens ne changent pas.

Ne changent pas : les champs de saisie (heure et date au format du
navigateur), l'export CSV (ses colonnes et ses formats de tableur), les
calculs. Aucune migration.

## D-194 — Lot K, PR 5 : une échelle de tailles de texte, rien sous 12 px

Date : 19 novembre 2026.

**Contexte.** Audit ergonomique du 19 novembre 2026, constat n° 19 :
36 tailles de texte au téléphone, 41 à l'ordinateur ; 18 % des lettres sous
12 px au téléphone, jusqu'à 6,5 px sur le plan de « Matériel » ; dix
graisses, de 300 à 900. La pastille « 6 » du plan ne disait pas ce qu'elle
comptait. **Cause vérifiée** : chaque feuille de style posait ses tailles
en pixels ou en rem ; un `<small>` sans taille prenait 80 % de son parent
(10,4 px dans un texte de 13 px) ; un `<strong>` dans un texte gras montait
à 900.

**Décision (F477, F478).** Six jetons de taille sur `:root` (`--text-12`,
`--text-13`, `--text-14`, `--text-16`, `--text-20`, `--text-28`) ; toute
taille fixe sous 23 px prend le jeton le plus proche (sous 12,75 px : 12 ;
sous 13,75 : 13 ; sous 15 : 14 ; sous 18 : 16 ; sous 23 : 20). Les grands
chiffres et les titres d'affichage (23 px et plus, `--title-size`, les
`clamp()`) gardent la leur. Un `<small>` ne descend plus sous 12 px. Quatre
graisses : 600 et au-delà deviennent 700 ; un `<strong>` sans poids propre
prend 700. La pastille chiffrée du plan porte sa bulle (« 6 mm par heure
d'arrosage ») et une légende sous le plan, quand une planche en a une
(F478).

Ne changent pas : les polices, les couleurs, les cibles tactiles. Aucune
migration.

## D-195 — Lot K, PR 6 : rayons et couleurs de la charte

Date : 19 novembre 2026.

**Contexte.** Audit ergonomique du 19 novembre 2026, constat n° 20 : des
rayons d'angle de 3, 4, 5, 8, 9, 10, 11 et 14 px, hors des trois de la
charte (12 ; 14,6 ; 9,75 px) ; à l'ordinateur, deux couleurs de texte hors
palette, `#1e1e1e` et `#4f6e64`. **Cause vérifiée** : les feuilles de style
écrites lot après lot posaient leur rayon en pixels ; `navigation.css` et
`arbitration-plan.css` portaient les deux couleurs.

**Décision (F479).** Chaque rayon de 3 px et plus, hors cercles et
pilules (40 px et plus, 50 %), prend un des trois rayons de la charte selon
ce qu'il arrondit : une entrée de menu, 9,75 px ; un bouton ou un champ
(`button`, `input`, `select`, `textarea`, `…-button`), `--radius-button` ;
un bloc de 11,5 px et plus, `--radius` ; une pièce plus petite (pastille,
étiquette, barre), 9,75 px. Les rayons d'un ou deux pixels (les filets) et
les angles droits restent. Le texte du menu prend `--ink`, le titre de ses
groupes `--ink2` ; le nom d'une culture de la frise de pénurie, `--ink`.

Ne changent pas : les autres couleurs (les couleurs des matériels sur le
plan, les états), les tailles, les marges. Aucune migration.

## D-196 — Lot K, PR 7 : grand écran, tablette et 320 px

Date : 19 novembre 2026.

**Contexte.** Audit ergonomique du 19 novembre 2026, constats n° 23 et
n° 24 : à 1 920 px, le contenu restait collé au menu (452 px de vide à
droite, 205 à gauche, mesurés) et le fond du menu s'arrêtait 42 px avant le
bas de la page ; sur tablette, le menu latéral à demi-place et des cibles
de 38 à 41 px (filtres et périodes de l'historique, boutons des réglages et
des alertes, pastilles « i » de 24 px) ; à 320 px, « Aujourd'hui » (64 px)
et « Ressources » (65 px) dépassaient les 58 px de leur case et se
coupaient au milieu du mot. **Cause vérifiée** : la barre du bas et les
cibles de 44 px étaient réservées aux écrans de 600 px et moins ; la marge
du bas était portée par `main` entier, sous le menu ; le nom de la barre
pouvait se couper n'importe où (`overflow-wrap: anywhere`).

**Décision.**

- **F480 Grand écran (981 px et plus).** La page se centre dans la place
  laissée par le menu ; la marge du bas passe de `main` à la colonne du
  contenu, le fond du menu descend jusqu'en bas ; les blocs d'une rangée
  d'« Aujourd'hui » s'étirent à la même hauteur ; au-delà de 1 000 px, les
  choix de la bannière de démonstration restent sur une ligne.
- **F481 Tablette (601 à 980 px).** La barre du bas du téléphone (quatre
  entrées et « Plus ») et sa feuille de menu valent jusqu'à 980 px. Chaque
  bouton, champ et liste du contenu, « Actualiser », les liens « Voir … »
  d'« Aujourd'hui » et les actions de l'historique prennent 44 px ; les
  pastilles « i » gardent leur rond de 24 px dans une boîte de 44 px, comme
  au téléphone. Les planches du plan ne changent pas.
- **F482 320 px.** Le nom de la barre ne se coupe plus qu'entre deux mots ;
  sous 360 px, les cases de la barre perdent leur marge de côté et les
  lettres se resserrent légèrement, pour que « Aujourd'hui » et
  « Ressources » tiennent entiers.

Ne changent pas : le téléphone de 360 à 600 px, l'ordinateur de 981 à
1 280 px hormis le centrage, les pages elles-mêmes. Aucune migration. Le
lot K est codé en entier.

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

## D-222 — Tranche 4, sous-tranche 4.4, PR 1 : l'état de l'accueil et le marquage de l'espace existant

Date : 20 novembre 2026.

**Contexte.** Le code de la 4.4 commence sur le « vas-y » du porteur du
20 novembre 2026 (7 h 52), en Opus 5.5 · Élevé (ligne 4.4 de la roadmap).
La section 8 bis.5 du contrat met dans la PR 1 l'état de l'accueil, le
marquage de l'espace existant, le bandeau « À finir » et la bascule des
défauts en « à renseigner » pour un espace neuf. Les écrans qui permettent
de remplir ces valeurs n'arrivent qu'avec les PR 2 à 5.

**Décision** (F581, section 8 bis.9 du contrat).

1. L'état de l'accueil vit dans `irrigation_onboarding_steps`
   (migration 0034) : une ligne par espace et par étape confirmée par la
   personne ; une étape sans ligne est « à faire ».
2. La migration marque chaque espace existant « accueil fait avant la
   4.4 », cinq étapes confirmées d'origine « avant l'accueil », sans
   toucher aucune autre table ; essai sur une copie.
3. La migration prend le numéro 0034 : le test des migrations interdit les
   trous ; la 4.3, PR 3 prendra le numéro libre.
4. Réglages montre l'accueil, replié, étape par étape ; la démonstration
   n'en a pas.
5. La bascule de chaque défaut et le bandeau « À finir » passent à la PR
   de l'étape qui permet de les remplir, pour ne jamais montrer un message
   que la personne ne peut pas suivre (section 8 bis.3). Aucune ferme neuve
   n'existe en production avant le pilote (F366).

Ne change pas : aucun chiffre de l'espace existant, aucun calcul, aucun
appel à OTF, aucune valeur agronomique. Aucune question de budget.

## D-223 — Tranche 4, sous-tranche 4.4, PR 2a : la commune de la ferme, choisie par la personne

Date : 20 novembre 2026.

**Contexte.** La section 8 bis.5 du contrat met dans une seule PR 2 la
commune (F419), le classement des abris (F420) et la proposition de départ
par `placeLngLat`, un nouvel appel à OTF qui attend l'accès demandé le
18 novembre 2026. Jusqu'ici, un espace sans commune choisie prenait en
silence la commune du siège de sa structure (`legalCity`).

**Décision** (F582, section 8 bis.10 du contrat).

1. La PR 2 se fait en trois : 2a la commune, 2b parcelles et abris, 2c la
   proposition par `placeLngLat`, à l'accès d'OTF.
2. Le lieu de la météo n'existe que si la commune est confirmée : espace
   d'avant l'accueil, démonstration, ou étape « Où est la ferme »
   confirmée. Sinon, ni météo, ni gel, ni ET0, et la page dit quoi faire.
3. Choisir une commune, ou prendre le siège d'un geste, en dernier recours,
   confirme l'étape dans le même lot d'écriture, avec la commune et sa
   provenance.
4. Hors de France métropolitaine (outre-mer compris) : refusé, rien
   d'enregistré.
5. Le bandeau « À finir : commune de la ferme. » paraît sur chaque page
   quand une case lit la météo, jusqu'à ce que la commune soit confirmée.

Ne change pas : la commune et les chiffres d'un espace existant (sa
préférence est gardée telle quelle, F426) ; aucun appel nouveau à OTF ; le
texte de la politique de confidentialité ; aucune valeur agronomique.
Aucune question de budget.

## D-224 — Tranche 4, sous-tranche 4.4, PR 2b : parcelles et abris, classés par la personne

Date : 20 novembre 2026.

**Contexte.** Le classement abri ou plein champ d'un jardin venait seulement
de la lecture d'OTF (`mapPlotMode`), qui lit le type du jardin et non son
nom : une ferme neuve était classée sans le savoir, et un « Serre » déclaré
plein champ dans OTF recevait la pluie.

**Décision** (F583, section 8 bis.11 du contrat).

1. Le classement confirmé est gardé par espace (`irrigation_plot_shelters`,
   migration 0035) et posé sur le plan lu d'OTF à chaque lecture.
2. Pour un espace qui fait l'accueil, un jardin non classé est « à
   classer » : son besoin, sa réserve et sa proposition ne sont pas
   calculés, et la raison est dite.
3. La proposition vient du type d'OTF, sinon d'un mot du nom (« serre »,
   « châssis », « multichapelle » ajoutés) ; la personne confirme, corrige
   ou laisse à classer, jardin par jardin ou d'un geste pour les
   propositions qui restent.
4. Un espace d'avant l'accueil et la démonstration gardent le classement
   d'OTF ; la migration n'écrit rien.

Ne change pas : aucun chiffre d'un espace existant ; K_abri et toute valeur
agronomique ; aucun appel nouveau à OTF. Aucune question de budget.

## D-225 — Tranche 4, sous-tranche 4.4, PR 3 : le sol, la texture qui propose TEW et REW

Date : 20 novembre 2026.

**Contexte.** Le formulaire du sol d'une parcelle préremplissait TEW 14 mm
et REW 7 mm, dits d'un « limon sableux » (D-053) : une ferme neuve qui
saisissait sa RFU les enregistrait sans le voir (défaut n° 4).

**Décision** (F584, section 8 bis.12 du contrat).

1. Pour un espace qui fait l'accueil, une parcelle sans sol n'a ni TEW ni
   REW préremplis ; la part de référence 2/3 et Ze 10 cm restent proposées,
   dites « proposées, à ajuster ».
2. La texture du sol, parmi les neuf classes du tableau 19 de la FAO-56,
   propose TEW et REW au milieu de leur fourchette, arrondi au
   demi-millimètre, la fourchette et la source dites à côté (F428,
   réponse 1) ; la personne ajuste. Valeurs relues sur la page de la FAO
   (chapitre 7) et recoupées par ses exemples 31 et 35.
3. La texture choisie est gardée avec la saisie (`texture`, migration
   0036), pour dire d'où viennent TEW et REW ; aucun calcul ne la lit.
4. L'étape « Sol » est confirmée par la saisie qui donne son sol à la
   dernière parcelle de la saison ; bandeau « À finir : sol de N
   parcelles », vers la page « Réserve du sol ».
5. La texture d'OTF (`System.soil`) attend l'accès d'OTF (PR 3b, avec la
   2c).

Ne change pas : les valeurs de départ d'un espace d'avant l'accueil et de la
démonstration (TEW 14 / REW 7 gardés ; la liste des textures s'ajoute à leur
formulaire sans rien remplir) ; aucun calcul ; aucun appel nouveau à OTF.
Aucune question de budget.

## D-226 — Tranche 4, sous-tranche 4.4, PR 4a : les racines d'une ferme neuve

Date : 20 novembre 2026.

**Contexte.** Le jeu commun des profils racinaires porte, pour l'asperge et
le melon, le plafond de 0,60 m de la ferme du porteur (D-056) au lieu de la
profondeur de la FAO-56 ; une ferme neuve l'héritait (défaut n° 14).

**Décision** (F585, section 8 bis.13 du contrat).

1. Pour un espace qui fait l'accueil, le profil commun de l'asperge et du
   melon prend, à la lecture, la borne basse de la FAO-56 (tableau 22) :
   asperge 1,20 m ; melon 0,80 m aux stades 3 et 4. Dit « estimation, à
   vérifier à la tarière ».
2. Une révision de la ferme le remplace toujours.
3. La PR 4 se fait en trois : 4a les racines, 4b la région des cultures,
   4c le rattachement des espèces et le modèle des 78 liens.

Ne change pas : la base (aucune migration) ; la ferme du porteur et la
démonstration ; la tomate à 0,65 m. Aucune question de budget.

## D-227 — Tranche 4, sous-tranche 4.4, PR 4b : la région d'origine des cultures

Date : 20 novembre 2026.

**Contexte.** Les dates de stade du jeu commun viennent du CRIIAM Sud
(région Sud / Occitanie) ou de la FAO-56 (générales) ; une ferme d'une autre
région les recevait sans le savoir (F422, défaut n° 13).

**Décision** (F586, section 8 bis.14 du contrat).

1. La région d'origine se déduit de la source de la culture, sans colonne
   nouvelle : CRIIAM Sud → « Sud / Occitanie », FAO-56 → « générales »,
   version de la ferme → « votre ferme ». Elle est dite sur chaque fiche,
   avec les délais de levée et calendriers du jeu commun, « ceux de la
   ferme du porteur, Auvergne-Rhône-Alpes » (F428, réponse 3).
2. La région de la ferme se déduit de sa commune confirmée (F419) : les deux
   premiers chiffres du code postal, puis l'une des treize régions de France
   métropolitaine (table fixe, découpage de 2016).
3. Une ferme qui fait l'accueil, d'une autre région que Provence-Alpes-Côte
   d'Azur ou Occitanie, est avertie sur chaque culture commune du CRIIAM,
   sur la fiche et sur la carte fermée ; jamais sur la FAO-56, ni sur une
   culture dont la ferme a ses propres dates, ni sans commune confirmée.

Ne change pas : la base (aucune migration) ; le calcul ; la ferme du porteur
et la démonstration (aucun avertissement, F426). Aucune question de budget.

## D-228 — Tranche 4, sous-tranche 4.4, PR 4c : l'étape « Rattachez vos espèces »

Date : 20 novembre 2026.

**Contexte.** Une ferme neuve part sans aucun rattachement (défaut n° 15) ;
la proposition d'après le nom existait, une espèce à la fois (lot 3, cas 9).

**Décision** (F587, section 8 bis.15 du contrat).

1. Pour un espace qui fait l'accueil, une étape en tête de la
   correspondance des espèces : une proposition par espèce sans
   rattachement, du modèle de la ferme du porteur s'il connaît son nom,
   sinon d'après le nom ; chacune cochée, la personne décoche et rattache
   le reste d'un geste, tout ou rien.
2. L'étape « Cultures » se confirme d'un geste, avec le compte des espèces
   rattachées ; le bandeau « À finir » nomme les espèces à rattacher tant
   qu'elle ne l'est pas.
3. La PR 4c en deux : 4c, l'étape et le mécanisme, modèle vide ; 4d, la
   liste des liens du porteur, après sa relecture (F428, réponse 4).

Ne change pas : la base (aucune migration) ; la ferme du porteur et la
démonstration ; la proposition une par une. Aucune question de budget.

## D-229 — Tranche 4, sous-tranche 4.4, PR 5a : « Réglages à relire »

Date : 20 novembre 2026.

**Contexte.** Une ferme neuve recevait les réglages de la ferme du porteur
sans les voir (défauts n° 1, 2, 3, 6, 7, 9, 10, 11, 12, 22) ; le planning se
calculait sur eux (réponse Q10).

**Décision** (F588, section 8 bis.16 du contrat).

1. Pour un espace qui fait l'accueil, six groupes de valeurs de départ, ceux
   des cases cochées, chacun avec sa source, lus des constantes du calcul ;
   la personne valide ou passe chaque groupe, l'ajuste dans sa page.
2. Aucun planning avant la validation du groupe « Planning » ; le calcul du
   matin et le recalcul sur événement passent la ferme sans échec.
3. La borne de l'ET0 reste à 12 mm/j : le contrat commun la fixe aussi ; le
   passage à 15 est proposé au dépôt commun (MC-37) et se fera dans une PR à
   part après l'accord.
4. La PR 5 en deux : 5a, celle-ci ; 5b, la vérification finale et plusieurs
   fermes d'une même personne.

Ne change pas : la base (aucune migration) ; aucune valeur de calcul ; la
ferme du porteur et la démonstration. Aucune question de budget.

## D-230 — Tranche 4, sous-tranche 4.4, PR 5b : la vérification finale

Date : 20 novembre 2026.

**Contexte.** F427 demande un écran qui dise, à la fin de l'accueil, ce qui
est confirmé, passé ou manquant, et ce qui reste inconnu.

**Décision** (F589, section 8 bis.17 du contrat).

1. La vérification est le pli « Accueil de la ferme » de Réglages : les
   étapes (depuis la PR 1), chaque groupe des réglages (confirmé, passé ou
   proposé) et « Encore inconnu » (espèces non rattachées, jardins à
   classer, parcelles sans sol), avec leur lien, même après une étape
   confirmée.
2. Plusieurs fermes d'une même personne (F418) se code avec la 4.3, PR 3,
   dont le raccordement par ferme attend l'accès d'OTF.

Ne change pas : la base ; le calcul ; la ferme du porteur et la
démonstration. Aucune question de budget.

## D-231 — Tranche 4, sous-tranche 4.4, PR 4d : le modèle des rattachements du porteur

Date : 20 novembre 2026.

**Contexte.** La PR 4c (D-228) a posé l'étape « Rattachez vos espèces » avec
un modèle vide ; la liste des liens de la ferme du porteur devait être relue
par lui avant tout dépôt (F428, réponse 4). Le porteur a délégué cette
relecture le 19 novembre 2026 (« relis-le toi-même et publie directement »),
délégation confirmée pour ces liens le 20 novembre 2026 ; il a ouvert son
navigateur pour la lecture le 20 novembre 2026 à 13 h 45.

**Décision** (F590, section 8 bis.18 du contrat).

1. Le modèle est relevé en lecture seule dans « Réglages », « Correspondance
   des espèces » de la ferme du porteur, saison 2026 : 77 espèces (et non 78,
   chiffre de mémoire), dont 40 rattachées à une culture de référence du jeu
   commun, reprises telles quelles ; 11 le sont par analogie.
2. Un lien du modèle garde l'analogie : la proposition la dit (« Salade
   d'été, par analogie ») et le rattachement la garde.
3. Les 36 espèces « sans référence Kc » (fleurs) et l'engrais vert (état de
   la surface du sol) n'entrent pas au modèle : il ne propose qu'une culture
   de référence.

Ne change pas : la base (aucune migration) ; le calcul ; la ferme du porteur
et la démonstration ; la proposition d'après le nom quand le modèle ne
connaît pas l'espèce. Aucune question de budget.



## D-240 — Tranche 4, 4.5, PR 1 : le registre des tâches attendues

Date : 20 novembre 2026.

**Contexte.** La mise à jour de la météo est restée en panne du 14 au
19 novembre 2026 sans que personne ne le voie (D-164 à D-166) : l'écran
s'appuyait sur une date restée verte, la réanalyse n'avait pas de réussite
à elle, et rien ne disait qu'une réussite attendue manquait. Le contrat de
la 4.5 (D-220, F560) demande un registre des tâches attendues, en code,
dont l'état se calcule sur la dernière réussite.

**Décision.** Section 10 bis.11 du contrat de la Tranche 4 (F600 à F607) :

1. Le registre vit dans `lib/domain/operations/task-registry.ts` : les
   quatre tâches du matin (prévisions, réanalyse, calcul du matin, rotation
   du coffre), chacune avec son rythme, ses seuils et leur raison, l'effet
   d'un manque et l'endroit de sa dernière réussite. Les autres tâches
   entrent avec le code qui les crée. Le déclencheur de la démonstration est
   rangé hors veille, avec sa raison.
2. Seuils du matin : **orange à 26 heures** (le tableau F560 proposait 30 :
   à 9 h, l'heure de la veille, un 6 h 15 manqué se voit ainsi le matin
   même), **rouge à 36 heures** (D-165, qui lit désormais ce seuil au
   registre).
3. Une exécution n'est réussie que si elle a tout fait ; prévisions et
   réanalyse se comptent à part ; trois exécutions manquées de suite font
   une panne ; une tâche sans réussite est « jamais réussie », en orange.
4. Les exécutions se gardent dans `irrigation_background_jobs`, ligne
   `task:<tâche>` ; la migration 0037, additive, ajoute le compte des
   échecs et « en panne depuis ». Le résumé d'un échec ne porte que des
   nombres et des classes d'erreur.
5. Tout déclencheur planifié s'inscrit au registre : un test lit les
   configurations Wrangler et échoue pour un déclencheur absent (F569,
   écrit dans `AGENTS.md`).

Ne changent pas : l'écran des fermes ; le créneau de 6 h 15 ; le verrou de
la météo ; les calculs du matin ; aucun appel nouveau à OTF ni dépense.

## D-241 — Tranche 4, 4.5, PR 2 : la veille de l'exploitant et sa page d'état

Date : 20 novembre 2026.

**Contexte.** Le registre des tâches (D-240) dit l'état de chaque tâche,
mais personne ne le lit : la panne de la météo du 14 novembre 2026 s'est
vue cinq jours plus tard, par hasard. Le contrat de la 4.5 (D-220, F565,
F566) demande une veille, sur un déclencheur à part, qui prévient
l'exploitant, et une page d'état qui lui est réservée.

**Décision.** Section 10 bis.12 du contrat de la Tranche 4 (F608 à F613) :

1. L'exploitant est une personne dont l'espace est sur la ferme du
   déploiement, lue sans appel à OTF ; la notification va vers ces espaces,
   où ses appareils sont inscrits ; la page d'état leur est réservée, côté
   serveur, et n'existe pas pour les autres.
2. Un second déclencheur du planificateur, à 9 h à Paris (`0 7,8 * * *`),
   appelle une route interne gardée par le jeton de service de la météo :
   une alerte quand une tâche est en retard, en panne ou jamais réussie ;
   « tout va bien » le dimanche ; rien sinon. Une notification par jour de
   Paris au plus, prise avant l'envoi et rendue s'il échoue (migration
   0038, table commune).
3. La notification nomme les tâches, la plus grave d'abord, avec depuis
   quand, dans les limites du service (titre de 80 caractères, texte de
   160) ; la veille ne se nomme pas elle-même.
4. La veille est une tâche du registre : réussie quand la notification due
   est partie ou confiée au service, manquée avec une raison écrite par le
   module ; la route répond 200 même manquée, pour que le planificateur ne
   la relance pas trois fois (R2).
5. La page `/irrigation/exploitation` dit le jugement d'ensemble en une
   ligne, chaque tâche avec son état et sa dernière réussite, et la
   dernière notification ; les fermes, la sauvegarde, les effacements et
   les coûts viennent avec leur code. La PR 2 du découpage se fait en deux
   PR : l'observation par ferme et le test des journaux suivent.

Ne changent pas : le matin de 6 h 15 et ses tâches ; le service de
notification (aucune route nouvelle) ; aucun secret nouveau, aucun appel
nouveau à OTF, aucune dépense.

## D-242 — Tranche 4, 4.5, PR 2 (seconde partie) : l'observation par ferme et les journaux sans donnée sensible

Date : 20 novembre 2026.

**Contexte.** La page d'état de l'exploitant (D-241) dit l'état des tâches,
pas celui de chaque ferme ; avec la 4.6, une ferme pilote en difficulté
(raccordement révoqué, OTF qui refuse, météo qui manque) doit se voir sans
ouvrir son espace. Le contrat de la 4.5 (D-220, F564) demande aussi un test
qui échoue si un journal porte une valeur sensible.

**Décision.** Section 10 bis.13 du contrat de la Tranche 4 (F614 à F618) :

1. Chaque essai envoyé à OTF est compté pour sa ferme, par heure pleine et
   par résultat (réussi, 401, 403, 429, 5xx, autre refus, délai dépassé,
   réseau), huit jours (migration 0039, table commune) ; un échec se
   journalise sous le nom stable `otf_call_failed`, avec ses seuls champs,
   jamais l'adresse, la ferme ni le jeton. La dernière lecture complète de
   chaque ferme est gardée.
2. La page d'état montre une carte par ferme, la plus en difficulté
   d'abord : raccordement, appels du jour, erreurs d'OTF sur 24 heures et
   7 jours, dernière lecture complète, dernière météo, dernier calcul du
   matin, jugés avec les seuils du registre ; la ferme de la clé du
   déploiement a toujours sa carte. Le jugement d'ensemble compte les
   fermes. Ni nom de ferme ni personne.
3. Un garde, chargé par chaque processus d'essais, lit chaque ligne écrite
   dans la console, même remplacée par un essai, et fait échouer le fichier
   qui en écrit une qui ressemble à un jeton, un paramètre d'autorisation,
   une adresse de retour, une adresse électronique, un nom de ferme ou une
   longue chaîne opaque ; un essai témoin le prouve. Il a trouvé quatre
   lignes qui recopiaient le message d'une erreur de la base : elles disent
   désormais sa classe.

Ne changent pas : le rythme des appels à OTF et leur compte du jour (F361,
F363) ; aucun appel nouveau à OTF, aucun secret nouveau, aucune dépense.
L'état de l'accueil (4.4-a) entre sur la carte avec la fusion de la 4.4 ;
la consommation sur la part du quota, quand la part sera fixée (F363).

## D-243 — Tranche 4, 4.5, PR 4 (première partie) : l'export hebdomadaire chiffré et son contrôle

Date : 20 novembre 2026.

**Contexte.** Le porteur a choisi le 19 novembre 2026 (10 bis.9) une copie
gratuite hors de Cloudflare : un export hebdomadaire chiffré, gardé par
lui, chiffré avant d'être écrit sur disque, et un geste « J'ai fait
l'export du … » sur la page d'état, que la veille surveille. Le contrat
(F561) demande que les sabotages d'un export (table retirée, ligne
corrompue, migration oubliée) soient détectés, et des scripts sans secret
dont les sorties ne contiennent pas de données. L'essai des scénarios S1 à
S3 demande une base d'essai chez Cloudflare, donc le « vas-y » du porteur.

**Décision.** Section 10 bis.14 du contrat de la Tranche 4 (F620 à F626) :

1. La PR 4 se fait en deux PR : celle-ci, tout ce qui s'essaie sans
   toucher à Cloudflare ; la suivante, l'essai S1 à S3 sur la base
   d'essai, après le « vas-y » du porteur.
2. `pnpm backup:export` reçoit l'export de Wrangler **en mémoire** : un
   module chargé dans le processus de Wrangler détourne son écriture vers
   le processus parent ; le chemin convenu est dans un dossier qui
   n'existe pas, pour qu'un détour qui ne jouerait plus fasse échouer
   l'écriture au lieu de poser l'export en clair. L'adresse de
   téléchargement que Wrangler affiche est masquée.
3. Avant d'être chiffré, l'export est **rejoué dans une base vide** :
   schéma comparé à celui des migrations qu'il dit avoir reçues,
   intégrité, clés étrangères comptées par table, empreinte de chaque
   table indépendante de l'ordre des lignes. Les problèmes se disent par
   des noms de tables et de contraintes, jamais par une valeur.
4. Chiffrement AES-256-GCM, clé tirée du mot de passe par scrypt
   (N = 2^17), en-tête authentifié ; mot de passe de 12 caractères au
   moins, tapé deux fois, sans écho, jamais par un argument. Le fichier va
   hors du dépôt (refusé dedans, même par un lien), ne remplace jamais le
   précédent, et il est relu et déchiffré avant que la commande dise
   « vérifié ». `pnpm backup:verify` contrôle un export fait.
5. L'export entre au registre comme la première tâche faite à la main :
   une fois par semaine, orange à 8 jours, rouge à 10 ; le geste de la page
   d'état note un jour, jamais à venir, jamais plus ancien que celui déjà
   noté. Le jugement d'ensemble dit « les 6 tâches ». La ligne
   « Sauvegarde » de F560 (Time Travel, tenu par Cloudflare) n'entre pas au
   registre, ni le nom `backup_failed` de F618 : aucune sauvegarde ne tourne
   dans le Worker.

Ne changent pas : aucun secret dans le dépôt, aucune dépense, aucune
migration, aucun appel à OTF ; rien chez Cloudflare avant le « vas-y » du
porteur. La règle de conservation des exports (un export garde les données
d'une ferme effacée depuis) s'écrit avec la PR 5 (F562), sous la relecture
du porteur.


## D-244 — Tranche 4, 4.5, PR 4 (seconde partie) : l'essai de restauration et la restauration depuis un export

Date : 20 novembre 2026.

**Contexte.** Le contrat (F561) demande trois scénarios joués pour de vrai
sur une base d'essai remplie de données fictives, puis détruite : S1
(revenir en arrière avec Time Travel, et rattraper une seule ferme), S2
(reconstruire depuis un export, puis l'isolation des deux fermes contre la
base restaurée), S3 (perdre la clé du coffre). Les sabotages doivent faire
échouer l'essai, et sa sortie ne contient aucune donnée. Créer une base
chez Cloudflare attend le « vas-y » du porteur. La simulation du script a
montré qu'un export brut de D1 ne se réimporte pas tel quel dans une base
aux clés étrangères actives, et que rattraper une ferme fait avancer ses
compteurs de révision.

**Décision.** Section 10 bis.15 du contrat de la Tranche 4 (F627 à F635) :

1. `pnpm backup:rehearse --cloudflare` joue l'essai sur trois bases nommées
   à partir de `module-irrigation-otf-essai-restauration`, et sur elles
   seules : chaque geste refuse tout autre nom avant d'appeler Wrangler,
   lancé depuis un dossier sans réglages. Les bases sont détruites à la fin,
   réussi ou non. Il se lance par un flux GitHub à part, à la main ou par la
   branche `essai-restauration`, jamais sur une PR, sans artefact. Sans
   option, la même commande joue une simulation contre une fausse D1 en
   mémoire.
2. Le rattrapage d'une seule ferme : restauration sur place, export de
   l'état d'avant (la copie), retour au signet noté ; puis seules les lignes
   de la ferme absentes de l'état présent, par leur clé primaire, sont
   réinsérées ; une ligne encore présente n'est jamais réécrite, seulement
   signalée. Les compteurs de révision avancent et ne reculent jamais. En
   vrai : le soir, avec l'assistant, sur la décision du porteur.
3. Un export se réimporte **rangé** : les tables d'abord, puis les lignes,
   chaque table après celles qu'elle désigne, puis index et déclencheurs.
   L'essai essaie aussi l'export brut, pour savoir ce que D1 en dit.
4. Contre la base reconstruite, l'isolation se prouve par le contrôle de
   cohérence (F380) et par les lectures des dépôts du module pour chacune
   des deux fermes ; S3 se joue sur cette même base.
5. `pnpm backup:restore` reconstruit une base perdue depuis un export
   chiffré, dans une base neuve ou vide seulement (une base qui a des
   tables est refusée, jamais écrasée), puis la compare table par table.
   L'import rangé y est écrit le temps de l'envoi dans un dossier privé
   effacé aussitôt : `wrangler d1 execute` ne lit qu'un fichier.

Ne changent pas : aucun secret dans le dépôt, aucune dépense, aucune
migration, aucun appel à OTF ; rien chez Cloudflare avant le « vas-y » du
porteur ; l'essai réel et son compte rendu, collé dans la PR, avant la
fusion. L'essai inscrit au registre (une fois par trimestre) et sa date sur
la page d'état viennent dans une PR à part.

**L'essai chez Cloudflare, le 20 novembre 2026** (sur le « vas-y » du
porteur) : réussi, S1, S2 et S3, bases détruites. La restauration à un
signet noté marche ; le signet d'un instant n'a pas été rendu (erreur
interne de l'API, code 7500, sur une base d'une minute) : sa mesure se dit
en une note sans arrêter l'essai, et la procédure demande ce signet avant
de rien restaurer. L'export brut ne se réimporte pas (« no such table »),
l'import rangé si. Un export dure environ 2,5 secondes pour 705 lignes.

## D-245 — Tranche 4, 4.5, PR 4 (troisième partie) : l'essai de restauration au registre

Date : 20 novembre 2026.

**Contexte.** Le contrat (10 bis.8) veut l'essai de restauration rejoué une
fois par trimestre et après un changement de schéma important, inscrit au
registre ; la page d'état dit la date du dernier essai (F565, point 4). Le
premier essai chez Cloudflare a réussi le 20 novembre 2026 (D-244). D-244
renvoyait ce registre à une PR à part.

**Décision.** Section 10 bis.16 du contrat de la Tranche 4 (F636 et F637) :

1. La tâche « Essai de restauration » entre au registre, faite par
   l'exploitant (`operator-gesture`) : une fois par trimestre, orange à
   100 jours, rouge à 120 ; jamais réussie, en orange, avant le premier essai
   noté. La veille la surveille comme les autres.
2. Le geste « J'ai fait l'essai du … » de la page d'état, aux mêmes règles
   que celui de l'export ; les deux gestes sont un seul code, et un test
   lie chaque tâche faite par l'exploitant à son geste.
3. Un changement de schéma important (une table refaite, des clés
   étrangères changées) se dit dans sa PR, et l'essai se rejoue avant sa
   fusion.

Ne changent pas : aucune migration, aucun appel à OTF ni à Cloudflare,
aucun secret ; les seuils et le geste de l'export (D-243).

## D-246 — Tranche 4, 4.5, PR 3 (première partie) : l'effacement d'une ferme, le moteur et ses preuves

Date : 20 novembre 2026.

**Contexte.** F563 veut l'effacement complet d'une ferme sept jours après sa
demande, annulable, par lots bornés, avec une note minimale qui reste, et
quatre preuves (exhaustivité, deux fermes, reprise, annulation). Douze tables
que le module garde immuables refusent tout effacement de ligne par un
déclencheur : sans changement, aucune ferme ne pourrait s'effacer. La
demande elle-même se fait dans « Réglages », que la chaîne de la 4.4 touche
encore.

**Décision.** Section 10 bis.17 du contrat de la Tranche 4 (F640 à F648) :

1. La PR 3 en deux : le moteur d'abord (note, plan, tâche du matin, gel des
   traitements du matin, page d'état, preuves) ; la demande, l'annulation,
   l'écran figé, l'oubli des abonnements de notification et l'effacement
   immédiat ensuite, après la chaîne de la 4.4. Sans la seconde partie,
   aucune demande ne naît en production.
2. La note de la demande (`irrigation_farm_erasures`, migration 0040) :
   l'identifiant interne de l'espace, l'état et des heures ; ni nom, ni
   personne, ni ferme, ni contenu ; sans clé étrangère.
3. Un plan qui range chaque table de la base, une fois : effacée avec
   l'espace (les filles d'abord), gardée par une table commune avec sa règle,
   ou gardée avec sa raison. Un test casse la CI pour une table sans règle.
4. Le raccordement et ses jetons partent avec la personne qui l'a fait, ou
   avec le dernier espace de la ferme ; le journal des appels de la ferme,
   avec le dernier espace de la ferme.
5. Lots de 200 lignes, passages de 300 instructions et 20 secondes au plus,
   repris au passage suivant ; l'espace et la note « faite » d'un bloc, que
   les clés étrangères refusent s'il reste une ligne.
6. **Procédure exceptionnelle des migrations (règle 3 et « Interdits » de
   docs/migrations-contract.md) : douze `DROP TRIGGER`.** Chaque déclencheur
   qui refuse l'effacement est supprimé puis recréé à l'identique dans la
   même migration, avec une seule exception : les lignes d'un espace dont
   l'effacement est en cours. Un déclencheur ne contient aucune donnée :
   aucune ligne n'est lue, copiée ni changée, et la migration reste additive
   pour les données. Le code du module n'efface jamais dans ces tables
   ailleurs que dans l'effacement d'une ferme : la fenêtre entre la
   suppression et la recréation, pendant le déploiement, ne laisse rien
   passer. La PR est dédiée, comme la procédure le veut, et l'export de la
   semaine (F624) est noté avant sa fusion.

Ne changent pas : aucun appel à OTF ni à Cloudflare, aucun secret, aucun
service nouveau ; les autres tâches du matin et leurs seuils ; le contenu de
la page de confidentialité (la phrase des 30 jours vient avec la PR 5).

## D-247 — Tranche 4, 4.5, PR 5 (première partie) : la conservation, table par table, et les purges du matin

Date : 20 novembre 2026.

**Contexte.** F562 veut une durée écrite par donnée et qui l'efface, et
renvoyait au code la liste réelle, table par table. Le journal des appels à
Ouvre ta ferme se purgeait seulement au départ d'une lecture : sans lecture,
rien ne partait. La notification du jour de la veille, elle, ne se purgeait
jamais. Plusieurs durées de F562 portent sur des données qui n'existent pas
encore (la déconnexion d'une ferme, les demandes d'autorisation, le journal
d'accès du support).

**Décision.** Section 10 bis.18 du contrat de la Tranche 4 (F649 à F653) :

1. La PR 5 en deux : les durées et les purges d'abord ; la politique de
   confidentialité (phrase des 30 jours telle qu'approuvée, et les durées,
   relue par le porteur avant la fusion), le support et les coûts ensuite.
2. Un plan de conservation range chaque table de la base, une fois, avec sa
   durée et qui l'efface ; un test casse la CI pour une table sans durée, et
   vérifie que le tableau du contrat dit la même chose que le code.
3. Une tâche du matin, « Purges de conservation », après l'effacement des
   fermes : lots de 500 lignes, 50 instructions au plus par passage, la
   limite elle-même gardée ; reprise au passage suivant ; une purge en
   échec n'arrête pas les autres. Le registre compte 9 tâches.
4. Une seule durée par donnée : les purges du matin reprennent les
   constantes des purges faites au passage (2, 8 et 30 jours pour le
   journal des appels, plus court que les 35 jours proposés par F562).
5. La notification du jour de la veille : 35 jours.
6. Une durée entre avec le code qui crée sa donnée : 90 jours après
   « Déconnecter la ferme » avec la 4.3, PR 3 ; le journal d'accès du
   support avec la seconde partie de cette PR ; les abonnements de
   notification avec la seconde partie de la PR 3.

Ne changent pas : aucune migration, aucun appel à OTF ni à Cloudflare,
aucun secret, aucun service nouveau ; les durées déjà tenues par le code ;
le texte de la page de confidentialité (seconde partie).

## D-248 — Tranche 4, 4.5, PR 3 (deuxième partie) : les appareils d'une ferme effacée, et ceux qui ne répondent plus

Date : 20 novembre 2026.

**Contexte.** F563 efface, avec la ferme, les abonnements de notification de
son espace ; ils vivent dans le Worker de notification, pas dans la base, et
aucune route ne les oubliait. F562 veut qu'un abonnement sans réponse du
service depuis 90 jours soit oublié ; le Worker ne gardait rien de ses
échecs. Rien de cela ne touche « Réglages », que la chaîne de la 4.4 occupe
encore.

**Décision.** Section 10 bis.19 du contrat de la Tranche 4 (F654 à F656) :

1. La PR 3 en trois : le moteur (première partie, D-246), le Worker de
   notification (cette deuxième partie), puis la demande dans « Réglages »
   après la 4.4.
2. Une route `/v1/recipients/forget` : chaque appareil de l'espace le quitte,
   et la fiche d'un appareil qui ne sert plus aucun espace est oubliée.
3. Le moteur de l'effacement l'appelle avant de noter l'effacement fait ;
   sans réponse, rien n'est noté et le passage suivant recommence.
4. Un abonnement dont les envois manquent depuis 90 jours est oublié comme un
   abonnement expiré ; un abonnement à qui rien n'est envoyé ne l'est jamais.
5. La colonne qui garde le premier envoi manqué s'ajoute aux listes
   existantes à leur réveil, sans toucher leurs lignes.

Ne changent pas : aucune migration de la base D1, aucun appel à OTF, aucun
secret, aucun service nouveau ; les alarmes et leurs tentatives ; la règle
« un appareil, une personne » (F371) ; le texte de la page de
confidentialité (PR 5, seconde partie).

## D-249 — Tranche 4, 4.5, PR 5 (deuxième partie) : la page de confidentialité, les exports gardés cinq semaines, le support

Date : 20 novembre 2026.

**Contexte.** La première partie de la PR 5 (D-247) a donné une durée à
chaque table ; la page de confidentialité n'en disait encore que deux, sans
la phrase des 30 jours approuvée par le porteur le 19 novembre 2026. Un
export hebdomadaire garde aussi les données d'une ferme effacée depuis, et
aucune règle ne disait combien de temps l'exploitant les garde.
`docs/exploitation.md` ne disait pas encore que faire d'une panne, d'une
ferme qui écrit ou d'une clé perdue (F567).

**Décision.** Section 10 bis.20 du contrat de la Tranche 4 (F657 à F659) :

1. La PR 5 en trois : la conservation (D-247), ce qui se lit et se relit
   (cette deuxième partie), puis le journal d'accès du support et les coûts.
2. Un export est gardé cinq semaines au plus. La commande de l'export le
   tient : après un export vérifié, elle efface du même dossier ceux de
   25 jours ou plus (35 jours moins les 10 jours du rouge de la tâche), et
   seulement les fichiers qu'elle a nommés ; les copies hors de l'ordinateur
   suivent la même règle, à la main.
3. La page de confidentialité (texte du 20 novembre 2026) dit chaque durée
   que le code tient, la phrase des 30 jours telle qu'approuvée, et le
   compte des lectures dans Ouvre ta ferme ; ce qui n'existe pas encore ne
   s'écrit qu'avec son code. Le texte est relu par le porteur avant la
   fusion, qui le met en ligne.
4. `docs/exploitation.md` dit, cas par cas, ce que fait l'exploitant seul,
   avec un gabarit de réponse fondé sur la page d'état ; la page d'accueil
   du site dit le délai de réponse, sans engagement.
5. La 4.5 prend aussi F660 à F669 et D-250 à D-252.

Ne changent pas : aucune migration, aucun appel à OTF, aucun secret, aucun
service nouveau ; l'export lui-même (chiffré avant d'être écrit, jamais dans
le dépôt) ; la phrase des 30 jours, appliquée mot pour mot.

## D-250 — Tranche 4, 4.5, PR 5 (troisième partie) : le journal d'accès du support et les coûts sur la page d'état

Date : 20 novembre 2026.

**Contexte.** F567 veut que chaque consultation des données d'une ferme par
l'exploitant soit notée, gardée 12 mois ; F565 (point 6) et F568 veulent
les coûts sur la page d'état, copiés à la main chaque mois, sans appel à
l'API de Cloudflare. Rien de cela n'existait.

**Décision.** Section 10 bis.21 du contrat de la Tranche 4 (F660 à F664) :

1. Une migration (0041), deux tables communes : le
   journal d'accès du support et le relevé des coûts du mois.
2. Une note d'accès : le jour, la ferme, la raison en une ligne, jamais ce
   qui a été vu ; 12 mois, puis la purge du matin ; partie avec le dernier
   espace de la ferme. La page de confidentialité le dit.
3. Un relevé des coûts par mois, recopié du tableau de bord ; chaque poste
   comparé à ce que l'offre Workers payante inclut (pages des prix lues le
   20 novembre 2026), à surveiller dès 80 %, avec le prix d'un dépassement.
4. La carte des coûts n'entre pas au registre : la veille ne la rappelle
   pas ; sans relevé du mois écoulé, elle est en orange.

Ne changent pas : aucun appel à Cloudflare ni à OTF, aucun secret, aucun
service nouveau, aucune dépense ; le registre des tâches (9 tâches).

## D-251 — Tranche 4, 4.5, PR 3 (troisième partie) : la demande dans « Réglages », l'espace figé, l'annulation et l'effacement sans attendre

Date : 20 novembre 2026.

**Contexte.** Le moteur de l'effacement (D-246) et l'oubli des appareils
(D-248) sont prêts, mais aucune demande ne peut naître : F563 veut la
demande dans « Réglages », après le nom de la ferme tapé, annulable sept
jours, l'espace figé pendant ce temps (aucun appel à OTF, aucune saisie),
et l'effacement immédiat sur demande écrite à l'exploitant.

**Décision.** Section 10 bis.22 du contrat de la Tranche 4 (F665 à F669) :

1. « Supprimer ma ferme et mes données », replié en bas de Réglages, hors
   démonstration ; le serveur relit le nom tapé dans l'instantané en cache,
   sans appel à OTF. La demande vaut pour l'espace de la personne.
2. L'espace figé : la lecture de la personne connectée refuse l'espace dès
   la demande, avant toute lecture d'OTF et toute saisie ; chaque page montre
   l'écran de l'espace figé. Seules exceptions : l'annulation et la page
   d'état de l'exploitant.
3. L'annulation, sur cet écran, tant que l'effacement n'a pas commencé.
4. L'effacement sans attendre, sur la page d'état : une demande en attente,
   le numéro de sa ferme retapé ; le délai s'arrête, l'effacement passe
   aussitôt dans la borne du matin, le matin finit le reste.
5. La page de confidentialité dit la demande dans Réglages.

Ne changent pas : aucune migration, aucun appel à OTF ni à Cloudflare, aucun
service nouveau, aucune dépense ; le registre des tâches (9 tâches) ; le
moteur de l'effacement et ses preuves.

## D-280 — Sept améliorations validées par le porteur, inscrites à la roadmap (section 6 septies)

Date : 21 novembre 2026.

**Contexte.** Le 6 novembre 2026, l'assistant a proposé sept idées
d'amélioration, sans accès au dépôt. Le porteur les a validées toutes le
21 novembre 2026 (« Ok, je valide tout »). Les inscrire est du travail sans
code : aucun « vas-y » de code n'est donné.

**Constat dans le code (21 novembre 2026, `main` à 5b42519).**

- N° 1, « Fait comme prévu » : existe déjà (3.8 quater, lot 3, D-076).
- N° 3, résumé du matin : existe en écran (page « Aujourd'hui », D-074) et en
  notification des suggestions du matin.
- N° 6, données manquantes : existe en partie (zone « Fiabilité du calcul »,
  cinq données ; vérification finale de l'accueil, 4.4).
- N° 2, 4, 5, 7 : n'existent pas.

**Décision.**

1. Les sept idées sont inscrites en section 6 septies de la roadmap (tableau de
   la section 1, ordre de la section 2, bloc détaillé). Aucune n'est codée ni
   cadrée.
2. **Place : après la Tranche 4** (après la 4.6), dans l'ordre n° 6, n° 2 et 3,
   n° 7, puis n° 4 et 5 selon l'avis du porteur. Un seul chantier de code à
   la fois.
3. **Les n° 4 (priorité conseillée selon le stade critique) et n° 5 (écart
   prévu/réel expliqué) sont réservées à l'avis agronomique du porteur** : pas
   de contrat, pas d'option choisie à sa place, avant ses réponses. Une
   priorité conseillée ne règle jamais seule la répartition.
4. La n° 1 ne demande rien. Les n° 2, 3 et 6 : Opus 5.5 · Élevé ; la n° 7 :
   Opus 5.5 · Très élevé (Max pour un éventuel retour en arrière) ; les n° 4 et
   5 : Opus 5.5 · Max ; les contrats : Sonnet 5.5 · Moyen. Chaque code attend
   son contrat court et le « vas-y » exprès du porteur.
5. Un retour en arrière du journal ne défait jamais une irrigation réalisée
   (D-006) ; les rôles d'utilisateur restent écartés.

Ne changent pas : aucun code, aucune migration, aucun calcul, aucune
décision antérieure. Le numéro D-280 est pris au-dessus de ceux des PR de la
4.5, de la 4.6 et du moteur commun encore ouvertes (D-246 à D-251, D-260,
D-270), pour éviter toute collision à la fusion.

## D-260 — Tranche 4, sous-tranche 4.6 : les quatre documents du pilote

Date : 20 novembre 2026.

**Contexte.** Le contrat de la 4.6 (D-221, 10 ter.6) prévoit une première PR
sans code : le modèle d'accord, la grille de recette, la fiche de retour et
la fiche d'entrée. Le porteur a besoin du modèle d'accord pour la relecture
juridique gratuite de son réseau (condition d'entrée E6), qui précède tout
envoi à une ferme.

**Décision.** Les quatre documents sont ajoutés à `docs/` :
`pilote-accord-modele.md`, `pilote-recette.md`, `pilote-retour-modele.md`,
`pilote-fiche-entree.md`. Ils suivent le contrat sans le rouvrir (F570,
F572, F573, F574, F575). Les durées de conservation ne sont pas recopiées
dans l'accord : la politique de confidentialité en ligne, à sa version
datée, fait foi (condition E7). Aucune donnée de ferme n'entre au dépôt : les
fermes se nomment « ferme A » et « ferme pilote n ». Le numéro D-260 est
pris hors des plages réservées aux chaînes 4.4 et 4.5 ; aucun numéro F nouveau.

**Réservé au porteur.** Choisir et contacter les fermes, relire (ou faire
relire) puis envoyer l'accord, recueillir les réponses, juger la recette.

Ne change pas : le code, le moteur, les coûts (aucune dépense nouvelle).

## D-281 — Démarrage avancé des améliorations n° 6, 2, 3 et 7, et leur contrat court

Date : 21 novembre 2026.

**Contexte.** D-280 plaçait les sept améliorations après la Tranche 4, avec un
« vas-y » avant chaque code, par prudence. Le porteur a fait remarquer le
21 novembre 2026 qu'aucun chantier de code n'était en cours ; il a dit
« Vas-y ».

**Décision.**

1. Le démarrage des n° 6, 2, 3 et 7 est **avancé** : le contrat court
   (`docs/ameliorations-6-2-3-7-contract.md`) est écrit, leur code part sans
   attendre la Tranche 4, sur sa propre branche, une PR à la fois, et **ne se
   fusionne qu'après la file de fusion en cours**. Le « vas-y » de code est
   donné pour ces quatre ; il reste attendu pour les n° 4 et 5, réservées à
   l'avis agronomique.
2. Le contrat retient, sur l'option recommandée : « stade deviné » = stade
   déduit du calendrier ; un message unique du matin qui remplace la
   notification des suggestions ; rappel du soir à 19 h par défaut, heure
   réglable par ferme, déclencheur horaire inscrit au registre des tâches ;
   journal général écrit en plus des journaux de domaine, dans la même
   opération, gardé autant que la ferme, sans retour en arrière (second temps,
   Opus 5.5 · Max, contrat à part).
3. Ordre et réglages inchangés : n° 6, puis n° 2 et 3, puis n° 7 ; Opus 5.5 ·
   Élevé, Très élevé pour la n° 7.

Ne changent pas : aucun code, aucune migration, aucun calcul. Numéros D-281,
F700 et suivants, P52 et suivants, à renuméroter à la fusion si la file préfère
une suite sans trou.

## D-282 — Améliorations, n° 6 : le panneau « données manquantes », planche par planche

Date : 21 novembre 2026. Statut : décidé (code de l'amélioration n° 6, sur
le « vas-y » du porteur du 21 novembre 2026 à 9 h 52, D-281).

**Contexte.** La zone « Fiabilité du calcul » de « Aujourd'hui » dit cinq
données pour la ferme entière ; rien ne disait, planche par planche, ce qui
manque. Le contrat court des améliorations
(`docs/ameliorations-6-2-3-7-contract.md`, section 3, F700 et F701) ajoute
trois données par planche : la réserve du sol non saisie, le stade deviné
(« stade déduit du calendrier »), le pluviomètre absent.

**Décision.** Le code suit la section 3 ; les précisions de code :

1. **F710.** Le dépliant « Par planche » vit sous l'anneau de la zone,
   fermé, et ne compte ni dans la pastille du menu ni dans l'anneau, qui
   gardent leurs cinq données : il informe, il ne relance personne. Il ne
   se lit que pour la page (la pastille ne le lit pas). Le geste du stade
   mène à « Matériel », sur la parcelle de la planche, par l'ancre
   `#bed-stage-<planche>` : la planche se choisit seule, le pli « Réglages
   de cette page » et le formulaire « Déclarer un stade » s'ouvrent une fois
   la fiche lue. L'ancre ne porte sur aucun identifiant de la page : le
   navigateur ouvrirait le pli avant React. Les planches se rangent par
   culture (les cultures présentes ce jour-là, « Sans culture en cours » en
   dernier à effet égal), les groupes par l'effet de leur première planche ;
   les cinq premières planches dans l'ordre de l'écran, les autres derrière
   « Voir les n autres planches ».
2. **F711.** Le stade deviné : une culture dont le stade et le Kc sont
   connus, sans déclaration qui la place ; un stade calculé recalé sur une
   déclaration est déclaré (D-057). La réserve du sol non saisie : les
   planches inconnues des jardins que la zone nomme déjà (jamais observés,
   ou sans RFU), par la même règle que le jardin (`gardenBedUnknown`). Le
   pluviomètre : la pluie mesurée lue de J − 30 à aujourd'hui, `0 mm`
   compris ; seule une planche hors abri qui porte une culture ce jour-là
   reçoit la ligne. Une donnée non lue (case décochée, jauge indisponible,
   plan de culture absent) ne donne aucune ligne.
3. Le dépliant s'ouvre par son ancre `#donnees-manquantes` : le lien « Ce
   qui manque » de la fin de l'accueil (4.4) l'emploiera ; il n'existe pas
   encore.

Ne changent pas : aucune migration, aucun appel à OTF, aucun calcul du
besoin, du planning, des priorités ni de la dose ; les cinq données de la
zone et leurs seuils.

## D-232 — La borne haute de l'ET0 portée à 15 mm/j (MC-37)

Date : 20 novembre 2026.

**Contexte.** Le porteur a choisi le 19 novembre 2026 (réponse Q11 de la
4.4) de porter la borne haute de l'ET0 du jour de 12 à 15 mm/j, pour toutes
les fermes. Le contrat commun la fixait aussi à 12 : la 4.4 l'a gardée
(D-229) et l'a proposée au dépôt commun (MC-37). Nicolas l'a acceptée le
20 novembre 2026 (PR n° 10 du dépôt commun, fusionnée, `a8127d9`).

**Décision** (F591, section 8 bis.19 du contrat de la Tranche 4).

1. `ET0_BOUNDS.maximum` passe à 15 ; hors bornes, le jour reste bloqué et
   la dernière valeur valide reste.
2. La table des ETM du jour est recréée pour porter sa contrainte à 15
   (règle 3 des migrations : exceptionnel, PR dédiée, après export de la
   base par le porteur ; migration 0042, après les 0037 à 0041 de la 4.5) ;
   les lignes sont copiées telles quelles.
3. Le cas L6 du script des cas de test passe aux limites de MC-37 (11,9,
   12,1 et 14,9 calculées ; 15,1 et −0,1 bloquées), exécuté conforme.

Ne change pas : aucune autre valeur de calcul ; les jours déjà enregistrés ;
MC-16. Aucune question de budget.

## D-283 — Améliorations, n° 3 : le message unique du matin et son réglage par ferme

Date : 21 novembre 2026. Statut : décidé (code de l'amélioration n° 3, sur
le « vas-y » du porteur du 21 novembre 2026 à 9 h 52, D-281).

**Contexte.** Le calcul du matin n'envoyait qu'une notification, celle des
suggestions du planning (3.7, règles 21 à 24). Le contrat court des
améliorations (`docs/ameliorations-6-2-3-7-contract.md`, sections 4.1 et
4.2, F702 et F703) la remplace par un seul message par jour et par ferme,
avec un réglage par ferme ; option recommandée retenue : remplacer, non
compléter.

**Décision.** Le code suit les sections 4.1 et 4.2 ; les précisions de code :

1. **F712.** Le réglage vit dans une table d'un espace,
   `irrigation_phone_notice_settings` (migration 0043), avec la personne qui
   le change et l'heure ; une colonne vide vaut le défaut, jamais écrit. Le
   message du matin est activé par défaut : le module ne sait pas quels
   appareils sont inscrits (le Worker de notification les garde), et sans
   appareil le message ne trouve personne, ce qui revient au défaut du
   contrat (« activé pour une ferme qui a au moins un appareil inscrit »).
   La case se montre dans « Notifications du téléphone » pour une ferme qui
   coche le Planning, dont le calcul du matin envoie le message ; pas en
   démonstration. Les colonnes du rappel du soir (n° 2) sont créées par la
   même migration et restent vides ; leur case et leur heure viennent avec
   la PR du rappel du soir. La prise du jour vit dans
   `irrigation_phone_notices` : une ligne par espace et par genre
   (`morning`, `evening`), réécrite chaque jour de Paris, prise avant
   l'envoi et rendue s'il échoue ou si le service n'est pas configuré. Les
   deux tables entrent dans le plan d'effacement.
2. **F713.** Le message, titre « Votre journée », au plus quatre phrases :
   les irrigations planifiées d'aujourd'hui qui attendent un geste
   (`isWaitingPlannedIrrigation`), une déjà en retard comprise, par heure de
   début, trois nommées avec leur heure puis « et n autres » ; les
   propositions encore à valider ne comptent pas (ce ne sont pas des
   irrigations planifiées) ; la pluie prévue aujourd'hui, celle que lit le
   plan, dite seulement connue et supérieure à 0 une fois arrondie ; les
   alertes en cours, comptées comme le bloc « Gel ou chaleur » de
   « Aujourd'hui » les annonce sur ses trois jours (le gel des cultures en
   compte une, chaque alerte météo qui se déclenche une), sans rien lire si
   ni « Alertes météo » ni « Alertes cultures » n'est cochée ; les
   suggestions, la phrase d'avant suivie de leurs gestes. Identifiant
   d'alarme `morning:<jour>`, étiquette `morning-<jour>`, journaux
   `morning_message_sent`, `morning_message_already_sent`,
   `morning_message_failed`, avec des nombres et le jour, jamais un nom.
3. **F715.** Les réglages des messages vivent dans un pli fermé,
   « Messages de la ferme », sous « Notifications du téléphone », comme
   « Correspondance des espèces » (F459) : sa ligne dit le réglage tel qu'il
   est enregistré (« Message du matin activé. ») et suit chaque changement ;
   l'ancre d'un réglage (`#message-du-matin`) ouvre le pli. Fermé, il coûte
   une ligne au téléphone ; le budget de hauteur de « Réglages » à 390 px
   (P40, F459, porté à 3 500 par le pli de la suppression de la ferme, F665)
   passe à 3 650 px : la page sur `main` en prend déjà 3 482 dans la CI, et
   le pli 64 de plus. Le budget reste une borne : toute section nouvelle de
   « Réglages » se plie.

Ne changent pas : le Worker de notification, le déclencheur du matin, les
règles 22 et 23 du replanning, aucun calcul du besoin, du planning ni des
alertes ; aucun appel à OTF.

## D-284 — Améliorations, n° 2 : le rappel du soir

Date : 21 novembre 2026. Statut : décidé (code de l'amélioration n° 2, sur
le « vas-y » du porteur du 21 novembre 2026 à 9 h 52, D-281).

**Contexte.** Rien ne relançait un arrosage validé jamais confirmé. Le
contrat court des améliorations (`docs/ameliorations-6-2-3-7-contract.md`,
sections 4.1 et 4.3, F702, F704 et F705) ajoute un rappel par jour et par
ferme, à l'heure qu'elle règle, sur le réglage posé par D-283.

**Décision.** Le code suit les sections 4.1 et 4.3 ; la précision de code :

1. **F714.** Le rappel est dû au premier passage horaire où l'heure de Paris
   a atteint l'heure réglée, et jusqu'à deux heures après : jamais avant
   l'heure choisie (une heure à 19 h 45 part au passage de 20 h 05, non à
   celui de 19 h 05, qui la devancerait), et un passage en panne ne
   rattrape pas un rappel en pleine nuit ; minuit passé, le jour est fini.
   Il nomme les irrigations planifiées dont la fin prévue est passée
   aujourd'hui et qui attendent encore un geste (`isWaitingPlannedIrrigation`),
   par heure de début, chaque matériel une fois, trois noms puis « et n
   autres » ; titre « Arrosages à confirmer », identifiant `evening:<jour>`.
   Le réglage du soir (case, heure de 17 h à 22 h au quart d'heure, 19 h et
   activé par défaut) se montre dans « Notifications du téléphone » pour une
   ferme qui coche « Arrosages », pas en démonstration, dans le pli
   « Messages de la ferme » du message du matin (F715), dont la ligne dit
   aussi « Rappel du soir à 19 h. » ou « Rappel du soir coupé. » ; la ferme sans
   « Arrosages » ou figée par une demande d'effacement n'est pas lue. Avant
   17 h, le passage ne lit rien et réussit. Une ferme en panne (lecture ou
   Worker) fait manquer le passage au registre, sans arrêter les autres ; le
   service non configuré n'est pas une panne. Le registre gagne la tâche
   `evening-reminder` (orange à 3 heures, rouge à 6) et le déclencheur
   `5 * * * *` du planificateur ; la page d'état compte dix tâches.

Ne changent pas : le Worker de notification, la confirmation d'un arrosage
(aucun geste n'est fait à la place du maraîcher, D-006), aucune migration
de plus (les colonnes du soir viennent de la 0043), aucun appel à OTF.

## D-285 — Améliorations, n° 7 : le journal des modifications, général, écrit en plus et gardé autant que la ferme

Date : 21 novembre 2026. Statut : décidé (code de l'amélioration n° 7, PR 4
sur 7 des améliorations, sur le « vas-y » du porteur du 21 novembre 2026 à
9 h 52, D-281 ; réglage Opus 5.5 · Très élevé, section 6 septies).

**Contexte.** Le module a des révisions et des journaux par domaine
(créneaux, pompes, infrastructure de l'eau, décisions de besoin, objectifs
historisés…), chacun de sa forme, certains sans « avant ». Aucun ne dit,
pour toute la ferme, qui a changé quoi, quand, de quoi à quoi. Le contrat
court des améliorations (`docs/ameliorations-6-2-3-7-contract.md`,
section 5, F706 à F709) retient l'option recommandée : **une table générale,
écrite en plus des journaux de domaine**, et **gardée autant que la ferme**
(choix rappelés par le porteur le 21 novembre 2026 : sans retour en
arrière dans cette version, §5.8).

**Décision.** La table `irrigation_change_journal` (migration 0044) garde, par ferme, une
ligne par changement d'un objectif, d'un réglage ou du matériel : la
famille, le sujet (code court et stable de la liste fermée
`lib/domain/change-journal/subjects.ts`), l'objet touché et son repère,
l'action (créé, modifié, supprimé), l'avant et l'après des seuls champs
qui changent, la personne et l'instant. Elle est d'un espace : au plan
d'effacement (`SPACE_TABLES`), donc à l'export chiffré et à l'effacement de
la ferme ; aucune purge à part. Ses déclencheurs refusent toute
modification et tout effacement, sauf pendant l'effacement de sa ferme.
La page de confidentialité le dit (texte du 21 novembre 2026). Les
précisions de code :

1. **F716.** L'avant se lit dans la base, **dans le lot même** du
   changement, à sa condition même (`db/change-journal/statements.ts`) : la
   ligne du journal s'écrit si et seulement si le changement s'écrit, et
   deux gestes presque simultanés ne laissent jamais un avant périmé.
   Création : après l'insertion, l'après lu sur la ligne écrite.
   Modification : avant l'écriture, l'avant lu sur la ligne d'avant,
   l'après donné par l'écrivain, et seuls les champs qui changent (comparés
   par `IS`) ; un geste qui ne change rien n'écrit rien. Suppression : avant
   l'effacement, l'avant de chaque champ. Une ligne absente peut valoir
   « créé » (un enregistrement qui insère ou remplace) ou les valeurs par
   défaut (un réglage jamais enregistré). Les noms de table et de champ
   viennent du code et sont vérifiés ; seules les valeurs sont des
   paramètres. Le contrôle de cohérence des espaces (F380) relève toute
   ligne du journal qui désignerait l'objet d'une autre ferme.
2. **F717.** L'inventaire (`db/change-journal/inventory.ts`, §5.4, premier
   garde-fou) range **chaque table de la base**, au journal ou hors du
   journal avec sa raison, et **chaque écrivain** d'une table du journal,
   « fichier › fonction › table » : branché, à brancher par la PR 5 ou 6,
   ou sans objet avec sa raison. `tests/change-journal-inventory.test.ts`
   relit le code et échoue pour une table ou un écrivain non rangé.
3. **F718.** Les réglages que la liste du contrat (§5.1) ne nomme pas — les
   réglages du besoin par culture (Kc corrigés, abri, paillage, ombrage,
   options, cultures de référence propres à la ferme, correspondances
   d'espèces), les parcelles sous abri, les groupes de jardins et le lieu
   météo — restent hors du journal dans cette version, chacun rangé avec
   cette raison ; ils y entreront sur le mot du porteur, par une PR qui les
   branche comme les autres.

Ne changent pas : les journaux de domaine, aucun calcul du besoin, du
planning ni de la répartition, aucun écran dans cette PR (la lecture vient
avec la PR 7), aucun appel à OTF.

## D-286 — Améliorations, n° 7 : les objectifs et les réglages écrivent au journal des modifications

Date : 21 novembre 2026. Statut : décidé (code de l'amélioration n° 7, PR 5
sur 7 des améliorations, sur le « vas-y » du porteur du 21 novembre 2026 à
9 h 52 ; réglage Opus 5.5 · Très élevé, section 6 septies ; suite de D-285).

**Contexte.** D-285 a posé la table, la règle et l'inventaire ; aucun
écrivain n'écrivait encore. La liste du contrat (§5.1) nomme, pour les
objectifs et les réglages : l'objectif hydrique (posé à la main ou adopté
d'une proposition), le seuil minimal de besoin, la décision sur le besoin
d'une planche, les réglages du planning, les créneaux protégés, la limite
d'eau de la journée et celle d'une ressource, le sol d'une zone ou d'une
parcelle, les réglages du sol, la profondeur des racines, les alertes météo
et par culture, les fonctionnalités et les messages du téléphone.

**Décision.** Les 23 écrivains rangés « PR 5 » dans l'inventaire placent
leur ligne dans leur lot, par les fonctions de
`db/change-journal/objectives.ts` et `db/change-journal/settings.ts`, et
l'inventaire les dit « branchés ». Les écritures faites d'une seule
instruction passent en lot (`db.batch`) pour que la ligne et le changement
réussissent ou échouent ensemble. Deux précisions de code :

1. **F719. L'avant d'un réglage.** Une table d'un réglage de toute la
   ferme (planning, seuil de besoin, fonctionnalités, messages du
   téléphone, réglages du sol et des alertes par culture) se lit à sa
   ligne, ou à sa révision la plus récente ; **sans enregistrement, elle
   vaut ses valeurs de départ**, celles du domaine, et son premier
   enregistrement dit « modifié », de la valeur de départ à la nouvelle. Un
   objet qui n'existait pas (un objectif, un créneau, une limite, le sol
   d'un lieu, un rattachement au gel, un délai de séchage) dit « créé ». Le
   profil racinaire d'une culture part du profil commun quand la ferme n'a
   pas le sien. Un objectif retiré dit « supprimé », avec la hauteur qu'il
   avait. Les réglages du planning sont aplatis, une valeur par champ
   (`dosesDripMaximumMm`) ; les fonctionnalités, une case par champ (0 ou
   1) ; les stades d'un profil racinaire, un texte `[[rang, profondeur,
   fin, jours], …]`. Un drapeau s'écrit 0 ou 1, comme la base.
2. **F720. L'écrivain nomme son sujet.** Chaque fonction branchée passe son
   sujet en premier argument (`goalJournal('objectif-adopte', …)`) ; le test
   de l'inventaire relit le code de chaque écrivain « branché » et y cherche
   ce sujet, et vérifie qu'aucun écrivain rangé autrement n'écrit au
   journal. L'essai de la migration 0034 sur une copie arrêtée à la 0033
   écrit les lignes du journal de la ferme de démonstration dans une table
   temporaire, hors de la copie.

Ne changent pas : les journaux de domaine (écrits comme avant, à côté),
aucun calcul, aucun écran (la lecture vient avec la PR 7), aucune
migration, aucun appel à OTF. Le matériel et les ressources viennent avec
la PR 6.

## D-287 — Améliorations, n° 7 : le matériel et les ressources écrivent au journal des modifications

Date : 21 novembre 2026. Statut : décidé (code de l'amélioration n° 7, PR 6
sur 7 des améliorations, sur le « vas-y » du porteur du 21 novembre 2026 à
9 h 52 ; réglage Opus 5.5 · Très élevé, section 6 septies ; suite de D-285
et D-286).

**Contexte.** Après D-286, restaient « à brancher » les 21 écrivains du
matériel et des ressources que nomme le contrat (§5.1) : le matériel, ses
réglages, sa copie et sa pompe par défaut, les pompes et leurs origines, les
ressources en eau et leur débit mesuré, les réserves, les liaisons d'une
ressource à une réserve et entre réserves, l'alimentation par défaut et les
poses du matériel.

**Décision.** Ces 21 écrivains placent leur ligne dans leur lot, par les
fonctions de `db/change-journal/equipment.ts`, et l'inventaire les dit
« branchés » : il n'a plus d'écrivain « à brancher », chacun est branché ou
sans objet. Une modification se lit avant l'écriture, à la condition même de
l'écriture (un matériel actif, une pose à sa date de mise à jour) ; une
création s'écrit après l'insertion, lue sur la ligne écrite ; un effacement
se lit avant. Une précision de code :

1. **F721. Une valeur désignée se lit par son nom, des deux côtés.** Une
   ressource, une réserve, un réglage, une pompe, un groupe de jardin
   désignés par un identifiant s'écrivent par leur nom, et la nouvelle
   valeur est lue en SQL dans le lot (`nextSql`), comme l'ancienne : les
   deux sont formatées pareil, et un nom changé ensuite n'est pas réécrit.
   Les valeurs composées s'écrivent en texte, triées pour qu'un même
   ensemble dans un autre ordre ne compte pas comme un changement : le
   profil d'une aspersion `[[distance, débit], …]` par distance, les
   origines d'une pompe `[[sorte, nom, par défaut], …]`, les planches d'une
   pose par leur ordre de pose. Le volume présent d'une réserve n'est pas
   un réglage : il n'entre pas au journal. Le débit mesuré appliqué à une
   ressource dit « modifié » sur son débit, avec l'origine « débit mesuré ».
   Une pose retirée dit « modifié » sur sa date de retrait ; reposée, sur
   ses dates. La copie d'un matériel écrit la création de la copie, avec le
   nom de l'original, et celle de chacun de ses réglages. Les écrivains sans
   personne nommée (le matériel, ses réglages, les poses) écrivent la clé de
   l'espace, comme D-286.

Ne changent pas : les journaux de domaine (écrits comme avant, à côté),
aucun calcul, aucun écran (la lecture vient avec la PR 7), aucune
migration, aucun appel à OTF.

## D-288 — Améliorations, n° 7 : l'écran du journal des modifications

Date : 21 novembre 2026. Statut : décidé (code de l'amélioration n° 7, PR 7
sur 7 des améliorations, sur le « vas-y » du porteur du 21 novembre 2026 à
9 h 52 ; réglage Opus 5.5 · Très élevé, section 6 septies ; suite de D-285
à D-287).

**Contexte.** Depuis D-287, tous les écrivains de la liste du contrat
(§5.1) écrivent au journal ; rien ne le lit encore. Le contrat (§5.5,
§5.6) demande une section « Journal des modifications » dans « Réglages »,
en lecture seule : les 50 dernières lignes, une carte par ligne, un filtre
par famille, « Voir plus » par 50, le texte composé dans `lib/domain/`, pas
de case de fonctionnalité, au téléphone une carte par ligne et jamais de
tableau, une section vide qui dit « Aucune modification enregistrée depuis
le <date de mise en service> », et une phrase de tête qui dit que le
journal commence à sa mise en service.

**Décision.** La section vient en bas de « Réglages », juste avant
« Supprimer ma ferme et mes données » (F665), pour toute ferme, toutes cases
cochées ou non, démonstration comprise. Sa lecture porte l'espace de la
session ; « Voir plus » et le filtre passent par une action serveur qui
vérifie la famille et le repère de reprise. Trois précisions :

1. **F722. Les mots du journal, en un endroit.** Chaque champ qu'un
   écrivain garde a son nom à l'écran et l'écriture de sa valeur, avec son
   unité (`lib/domain/change-journal/fields.ts`) : « Objectif : 30 mm →
   35 mm », « Fin : 12 h → 13 h », « Part de la pluie prévue déduite :
   100 % → 50 % », un profil d'aspersion « à 2 m, 8 mm/h ; à 4 m,
   6 mm/h », une case 0 ou 1 « oui » ou « non ». Une valeur vide dit ce
   qu'elle veut dire pour son champ (« aucune », « sans fin », « en
   place »), sinon « non renseigné » (D-003). La carte
   (`lib/domain/change-journal/card.ts`) dit quand, à l'heure de la ferme,
   qui (« Vous » quand l'auteur est la clé d'espace de la session, sinon
   « Une autre personne connectée », jamais une adresse, F708), le sujet,
   l'action (« Création », « Modification », « Suppression ») et l'objet par
   son nom ou son repère ; un lieu ou une culture d'Ouvre ta ferme se lit
   par son nom quand l'instantané le connaît (« Planche · B1 »), sinon par
   sa sorte, jamais par son identifiant. Un champ que la version ne sait pas
   lire est compté, jamais tu ni montré par son code. Les essais des
   écrivains (PR 5 et 6) échouent pour un champ écrit sans ses mots ; ceux
   du domaine, pour un champ des réglages gardés en entier (planning,
   fonctionnalités, alertes par culture, sol) sans ses mots. Les noms des
   natures de ressource et de réserve passent dans le domaine
   (`lib/domain/water-resource-labels.ts`), relus par « Ressources » et
   par le journal.
2. **F723. Le début du journal.** Le jour où le journal d'une ferme
   commence est le plus tard de sa mise en service, lue dans la liste des
   migrations reçues par la base (`d1_migrations`, tenue par Cloudflare,
   migration `…_change_journal.sql`, quel que soit son numéro final), et de
   la création de l'espace. Une base sans cette liste (les essais en local)
   prend la création de l'espace. Rien n'est reconstitué d'avant (§5.6).
3. **F724. Plié, comme toute section nouvelle de « Réglages ».** La
   section est un pli fermé, celui de « Correspondance des espèces », dont
   la ligne dit « N modifications, la dernière le … » ; l'ancre
   `#journal-des-modifications` l'ouvre. Fermé, il coûte une ligne au
   téléphone, 84 px (3 489 → 3 573 px en local ; 3 704 px avec « Supprimer
   ma ferme et mes données », #160) : le budget de hauteur de « Réglages »
   à 390 px (P40, F459, F665, F715) passe de 3 650 à 3 750 px.

Preuves : `tests/change-journal-card.test.ts` (le texte de chaque famille,
les valeurs et leurs unités, les champs inconnus, les phrases de la
section), `tests/db/change-journal-view.test.ts` (50 cartes puis « Voir
plus », le filtre et sa suite, deux fermes, le début du journal), les essais
des écrivains (aucun champ sans ses mots), le parcours P55 à 390 et
1 440 px. Ne changent pas : les écrivains, la table, aucune migration,
aucun calcul, aucun appel à OTF.

## D-289 — Améliorations, n° 7 : les réglages restants écrivent au journal des modifications

Date : 21 novembre 2026. Statut : décidé (suite de l'amélioration n° 7,
PR 8, empilée sur la PR 7 ; règle la précision F718 de D-285 ; réglage
Opus 5.5 · Très élevé, section 6 septies). F718 laissait hors du journal
les réglages que la liste du contrat (§5.1) ne nommait pas, « sur le mot du
porteur ». Le coordinateur du projet a tranché pour une PR à part, codée
aussitôt, dans l'autonomie que le porteur lui a confiée le 19 novembre 2026
pour les questions qui ne touchent ni au budget, ni à l'agronomie, ni à la
ferme réelle. **Le porteur l'a confirmé le 21 novembre 2026 à 23 h 13** (« Bon,
c'est bien, laisse comme ça. ») : les réglages hors de la liste restent au
journal.

**Contexte.** Depuis D-287, tous les écrivains de la liste du contrat
écrivent au journal, et l'écran le lit (D-288). Restaient hors du journal,
chacun rangé avec la raison F718 : les réglages du besoin par culture (Kc
corrigés, cultures de référence propres à la ferme, correspondance des
espèces, effet des abris, paillage plastique, filets d'ombrage, options),
le classement des jardins sous abri ou de plein champ, les groupes de
jardins et le lieu de la météo.

**Décision.** Ces réglages écrivent leur ligne dans le lot même de leur
geste, avec les règles de D-286 (F716) : avant l'écriture pour un
changement ou une suppression, après pour une création, seuls les champs
qui changent, rien pour un geste refusé ou sans changement. Dix sujets
nouveaux, tous de la famille « Réglages » : « Kc corrigé d'une culture »,
« Culture de référence de la ferme », « Correspondance d'une espèce »,
« Effet d'un abri (K_abri) », « Paillage plastique d'une planche »,
« Filet d'ombrage », « Options du besoin par culture », « Jardin sous abri
ou de plein champ », « Groupe de jardins » et « Lieu de la météo ». Cinq
précisions :

1. **F725. Ce qui reste hors du journal, et pourquoi.** Le repère de saison
   des groupes de jardins (un état que le module tient), le report des
   groupes de la saison d'avant sur une saison neuve (le module, à la
   première lecture, sans geste), l'état des synchronisations météo
   (tentative, réussite, erreur, attente), la proposition du module à côté
   du classement d'un jardin. L'inventaire (F717) les range avec ces
   raisons ; plus aucune table n'y porte la raison F718.
2. **F726. Une valeur composée se garde en un texte, relu à l'identique.**
   Les stades, les jeux de saison et les débuts de stade d'une culture de
   référence, et les jardins d'un groupe (dans leur ordre, avec leur sens
   et leur écart), se gardent chacun en un texte JSON. Le code l'écrit et
   SQLite le relit dans le lot sous la même forme (un nombre entier sans
   décimale, les mois triés) : une culture ou un groupe enregistré de
   nouveau tel quel n'écrit aucune ligne, les trois formes de Kc
   comprises. Les lignes filles d'une culture se composent en un seul
   endroit (`referenceCropPartRows`), pour l'écriture et pour le journal.
3. **F727. La version de la ferme d'une culture de référence.** La première
   version que la ferme enregistre est une **création**, avec chacune de
   ses valeurs, et non une modification de la culture commune ; la suivante
   est une modification de la précédente ; la retirer est une
   **suppression** (la commune revient, sans ligne à elle). Un Kc corrigé
   dit sa culture par son nom et sa cible (« Tomate, stade 2 », « Brocoli,
   Kc pleine saison ») ; une correspondance dit la culture de référence par
   son nom, avant comme après (F721).
4. **F728. Un jardin remis « à classer ».** Remettre un jardin « à classer »
   efface son classement : la ligne dit une suppression, avec le
   classement d'avant. Seul le choix de la personne compte (« sous abri »,
   « plein champ ») ; la proposition du module, gardée à côté, n'est pas un
   geste.
5. **F729. Le lieu de la météo.** Seul le choix compte : l'adresse de la
   ferme dans Ouvre ta ferme (le départ) ou une commune choisie, sa commune
   et son code postal. La première commune choisie dit « modifié », de
   l'adresse de la ferme à la commune.

Preuves : `tests/db/change-journal-remaining-settings.test.ts` (chaque
écrivain : création, changement, inchangé sans ligne, refus d'une autre
ferme, suppression ; les trois formes de Kc relues à l'identique ; le texte
des cartes), `tests/change-journal-inventory.test.ts` (chaque table et
chaque écrivain rangé, chaque écrivain branché nomme son sujet), contrôle de
cohérence des espaces. Ne changent pas : la table du journal, l'écran
(D-288), aucune migration, aucun calcul, aucun appel à OTF.

## D-270 — Fusion des moteurs, étapes 2 et 3 : le moteur commun écrit, la jauge branchée derrière un interrupteur

Date : 20 novembre 2026, soir. Décideur : le porteur pour le lancement et le
réglage (« Max », le 20 novembre 2026 à 18 h 56, MC-26) ; la recommandation
pour le reste, sur son mandat d'autonomie du 19 novembre 2026 (aucune
question agronomique ni de budget). Contrat :
`docs/shared-engine-adapter-contract.md`. Après D-114, D-116 et D-154.

**Contexte.** Le plan de la fusion validé par le porteur le 14 novembre 2026
(§ 4 et § 5) : un adaptateur remplace le cœur de `gauge.ts` par le moteur
commun, derrière un interrupteur ; l'ancien code reste jusqu'à preuve
d'égalité ; la version du moteur est figée dans ce dépôt ; un rejeu comparé
sur la ferme réelle, écart admis 0,01 mm, chaque écart listé, jamais corrigé
en silence. MC-26 : le moteur et l'adaptateur en Opus 5.5 · Max, leur ligne
de roadmap par une PR de registres à ce moment ; D-154 : deux chantiers de
code ensemble s'ils touchent deux dépôts.

**Établi.**

- **Étape 2, le moteur**, codée le 20 novembre 2026 dans le dépôt commun
  (`lechampdelaurore-boop/moteur-hydrique-commun-public`) : la v0.1.0, le
  cœur du bilan (PR n° 11), la v0.2.0, les options du jeu Tlaloc (PR n° 12,
  empilée), ses types construits avec lui (PR n° 13), puis la v0.3.0, la
  pluie sans heure du jeu Tlaloc (PR n° 14, choix 1 tranché par Nicolas,
  sans effet pour OTF) ; le choix 19 corrigé à sa demande ; les quatre PR
  approuvées par Nicolas et fusionnées le soir même (21 h 19, 21 h 20,
  21 h 47 et 21 h 48).
- **Étape 3, PR 1 sur 3** : le moteur v0.3.0 (commit `a36ca0d` du dépôt
  commun) figé dans le module avec ses types et l'empreinte de chaque
  fichier ; l'adaptateur ; l'interrupteur sur
  l'ancien calcul. **Rien ne change en ligne.** Les preuves : tous les tests
  du module rejoués l'interrupteur sur le moteur, sans en modifier un seul ;
  20 000 planches tirées au hasard, 437 355 jours, chaque grandeur égale à
  0,000001 mm près (plus grand écart 9e-14 mm) ; les cas O01 à O10 et les
  huit cas limites de l'étape 1, mêmes verdicts par les deux calculs (l'écart
  d'O07, D-116, est le même des deux côtés) ; comparaison et cas rejoués
  sur la v0.3.0, mêmes résultats.

**Décisions.**

1. Les engrais verts et les planches enherbées passent par le moteur, comme
   les cultures (un compartiment, D-053) ; le sol nu et ses deux
   compartiments restent au module (MC-18). Choix présenté à Nicolas (choix
   21 de la PR n° 13 du dépôt commun).
2. Un appel au moteur par suite de jours consécutifs à un compartiment ; le
   sol nu et les jours sans sol font le lien, comme avant.
3. L'interrupteur est une constante du domaine (`gauge-switch.ts`), changée
   par une PR ; le rejeu des tests sur le moteur remplace ce fichier par un
   passage de test. Aucune variable d'environnement, aucune migration.
4. Deux données impossibles changent un chiffre par le moteur : une RFU de
   0 mm/m vaut un sol absent ; une consommation impossible sous un couvert
   (ET0 négative ou illisible) rend le jour inconnu, « ET0 manquante ». Elles
   sont dites au porteur avec la PR 2, avec leurs deux valeurs.
5. Chaque matin, l'enregistrement de la jauge rejoue l'autre calcul et écrit
   une ligne au journal (`soil_reserve_engine_comparison`), sans aucune donnée
   de la ferme ; au plus 50 000 jours comparés par matin, pour ne jamais
   mettre en péril le matin ; son échec n'arrête jamais l'enregistrement.
6. PR 2 (l'interrupteur sur le moteur) après trois matins de suite sans
   écart, sans échec et sans planche laissée de côté sur la ferme réelle ;
   PR 3 (l'ancien code retiré) après une semaine sur le moteur sans écart.
   Un écart arrête la suite et se présente au porteur avec les deux valeurs.
   La PR 2 est faite le 24 novembre 2026 (D-301).
7. La copie du moteur vient du dossier `dist/` de la branche principale du
   dépôt commun : la PR 1 s'y est recalée le soir même, sur `a36ca0d`
   (v0.3.0, après la fusion des PR n° 11 à 14), ses preuves rejouées.

Ne changent pas : D-028, D-047, D-053, D-114, D-116, D-154. Aucune
migration ; aucun test existant modifié. Aucune question de budget.

## D-290 — Améliorations, n° 4 : la priorité conseillée selon le stade sensible, en pénurie

Date : 21 novembre 2026. Statut : décidé (code de l'amélioration n° 4, sur
les réponses agronomiques du porteur du 21 novembre 2026 et son mot
« Allons-y pour le point numéro 1 » à 22 h 12 ; liste préremplie validée
telle quelle à 22 h 51).

**Contexte.** Le stade et le Kc du jour de chaque culture étaient calculés
(5 quater) et la priorité d'une planche choisie par semaine (3.3), sans lien
entre les deux. Le contrat court des n° 4 et 5
(`docs/ameliorations-4-5-contract.md`, section 3, F730 à F732) met en règles
les réponses du porteur : une liste de stades sensibles par culture,
préremplie et réglable par ferme ; un conseil en pénurie seulement, jamais
appliqué seul ; « Adopter » pour la semaine en cours.

**Décision.** Le code suit la section 3 ; les précisions de code :

1. **F736, le stockage.** La liste préremplie vit dans une table commune,
   `irrigation_crop_sensitive_stage_common` (migration 0045, après la 0044
   du journal des modifications) : une ligne par stade sensible
   d'une culture commune, son rang, son nom, sa confiance, sa source et sa
   date, comme le jeu de référence ; seule une migration l'écrit
   (41 lignes, 28 cultures, la liste validée ligne pour ligne). Les choix
   d'une ferme vivent dans `irrigation_crop_sensitive_stages`, table d'un
   espace, avec la personne et l'heure, au plan d'effacement et de
   rétention. La culture se désigne par sa clé commune, que la version de
   la ferme garde : une ferme qui règle ses durées garde ses choix. Une
   ferme n'enregistre que ce qui diffère de la liste : cocher comme la
   liste efface sa ligne, « Reprendre la liste préremplie » efface toutes
   les siennes, et un enregistrement qui ne change pas une case lui garde
   sa personne et son heure. Le serveur refuse un rang absent de la table
   de la culture et une culture qu'il ne connaît pas pour cette ferme.
2. **F737, le réglage à l'écran.** Dans la fiche de chaque culture
   utilisable de « Besoin par culture », un pli fermé « Stades sensibles au
   manque d'eau », dont la ligne compte les stades sensibles (« aucun stade
   sensible », « 1 stade sensible sur 2 ») ; chaque case dit d'où vient sa
   valeur : « choisi par la ferme », « d'après les références » ou
   « d'après les références, par analogie » ; les sources de la liste dans
   le pli « Sources de la liste préremplie » ; une culture sans ligne le dit
   et invite à cocher ; « Reprendre la liste préremplie » paraît quand la
   ferme a un choix à elle. Enregistrer ne recalcule pas le plan : le
   réglage ne change aucun calcul. Une fiche inutilisable n'a pas le pli.
3. **F738, le conseil à l'écran.** Le bloc se calcule après la
   répartition, sur les cultures du jour : une culture dont l'ET0 du jour
   manque garde son stade et compte ; le « Non calculable » du déficit
   relatif se lit avec sa raison (« aucun objectif adopté », « besoin réel
   inconnu », F316) ; la phrase de la part égale lit la stratégie de
   pénurie du planning. Le conseil est la partie `stage-advice` de
   « Ressources et pompes », qui demande « Besoin par culture » ; sans
   elle, en pénurie, la ligne « Le conseil selon le stade sensible des
   cultures demande Besoin par culture. ». Les cultures du jour ne se
   lisent que si un niveau demande un choix ou si un conseil est possible ;
   un échec de leur lecture, de la liste ou des choix laisse l'écran sans
   conseil et se journalise (`arbitration_crop_stages_failed`,
   `stage_advice_failed`), jamais en panne.
4. **F739, « Adopter ».** Le geste passe par le service
   (`lib/services/stage-advice-adoption.ts`), qui relit la répartition
   d'abord : une semaine changée est refusée (« La semaine a changé.
   Rechargez la faisabilité. ») ; une planche déjà haute le dit sans rien
   écrire ; un conseil qui ne tient plus n'écrit rien (« Ce conseil ne
   tient plus : rien n'a été changé. Voici la répartition à jour. »).
   Sinon, la décision de la semaine passe en priorité haute en gardant le
   besoin manuel, sa raison et le besoin calculé qu'il remplaçait ; le
   journal des décisions porte `origin: "stage-advice"` ; le plan se
   recalcule comme après tout changement de priorité ; la réponse dit
   « Priorité haute enregistrée pour <planche>, pour cette semaine
   seulement. Les quantités ont été recalculées. » avec la répartition
   relue, et les autres blocs relisent (D-129).

La démonstration « Pic d'été, l'eau manque » le montre : la courgette de
H02 en floraison, puis les tomates d'A01 et A02, chacune « d'après le
calendrier ». Ne changent pas : le besoin (3.3), la répartition (3.4) et le
planning (3.5) ; la priorité reste un choix par semaine ; aucun appel à OTF,
aucun réglage de Cloudflare.

**Le journal des modifications** (n° 7, sur `main` depuis le 22 novembre
2026, D-285 et D-286). Le choix d'un stade sensible y entre, famille
« réglages », sujet « Stade sensible au manque d'eau » (`stade-sensible`) :
une ligne par stade dont la valeur en vigueur change, écrite dans le lot du
geste, avant lui ; l'avant est lu dans la base, le choix de la ferme pour ce
stade, sinon la liste préremplie, qui en est la valeur de départ ; un choix
fait pour un autre stade au même rang ne compte pas, comme dans la règle. La
ligne garde la culture (sa clé, son nom) et le stade (son rang, son nom) ;
l'écran du journal (« Réglages », D-288) la lit « Tomate, Plantation →
Reprise », puis « Sensible au manque d'eau : non → oui ». La liste
préremplie, que seule une migration écrit, reste hors du journal, comme les
autres tables communes (§5.1 du contrat de la n° 7). Un enregistrement qui
ne change aucune valeur n'écrit rien.

## D-291 — Améliorations, n° 5 : l'écart entre l'eau prévue et l'eau apportée, expliqué

Date : 22 novembre 2026. Statut : décidé (code de l'amélioration n° 5, sur
les réponses agronomiques du porteur du 21 novembre 2026, son récapitulatif
des questions 4 à 9 validé à 22 h 14, et sa consigne de la nuit : continuer
en autonomie, chaque question sans réponse prenant l'option recommandée).

**Contexte.** Le module disait l'écart du manque d'eau avant et après une
replanification, et l'écart d'un plan à la faisabilité, jamais l'écart entre
l'eau prévue et l'eau apportée sur plusieurs semaines. Le contrat court des
n° 4 et 5 (`docs/ameliorations-4-5-contract.md`, section 4, F733 à F735) met
en règles les réponses du porteur : trois semaines complètes d'écart de plus
de 20 % dans le même sens, au moins trois irrigations faites, une cause dite
seulement si les données la soutiennent, une proposition jamais appliquée
seule.

**Décision.** Le code suit la section 4 ; les précisions de code :

1. **F740, la lecture.** Les irrigations de la période se lisent par date, à
   l'heure de Paris, quelle que soit leur saison : début janvier, les
   semaines de décembre comptent. Le bloc ne se calcule que pour la saison
   du jour (les trois semaines sont celles d'avant aujourd'hui) et pour une
   ferme qui coche « Planning de la semaine » ; une irrigation dont le
   minuteur tourne attend encore (sa semaine n'est pas jugée). Les
   quantités se comparent en centièmes de millimètre entiers : un écart de
   20 % tout juste ne compte jamais. « Hors abri » se lit sur le jardin
   classé en plein champ (4.4, F583) : sous abri, ou dans un jardin à
   classer, la pluie n'est pas une cause. La cause de l'objectif est la
   partie `gap-objective-cause` de « Planning de la semaine », qui demande
   « Besoin par culture » ; sans elle, une planche qui reçoit moins que
   prévu fait dire « La cause « Objectif plus haut que le besoin de la
   culture » se cherche avec Besoin par culture. » (P1). L'objectif lu est
   celui de la planche pour la semaine en cours, et la proposition celle de
   la fiche de la 5 quater pour la même semaine, adoptable comme elle le
   dit. Un échec de lecture laisse le planning sans bloc et se journalise
   (`applied_water_gap_failed`), jamais en panne.
2. **F741, après un ajustement.** Une semaine ne se juge qu'avec les
   réglages d'aujourd'hui : chaque irrigation faite de la semaine a copié
   les débits du réglage tel qu'il est, d'un matériel en service. Après
   « Adopter » le débit, comme après un réglage retouché à la main ou un
   matériel retiré, la planche se juge sur les semaines qui suivent : le
   bloc disparaît et ne revient pas sur les semaines d'avant. De même,
   quand un objectif proposé a été adopté cette semaine, plus bas de plus
   de 20 % que l'objectif de la planche la dernière semaine de la période,
   la planche qui reçoit moins que prévu se tait : ses semaines passées ont
   été prévues avec l'ancien objectif.
3. **F742, le bloc.** Sur « Planning de la semaine », après les suggestions
   du plan et avant la semaine (sous la phrase « Aucun calcul… » quand le
   plan manque) : « L'eau apportée s'écarte du prévu », une phrase qui dit
   la règle et que rien ne change sans le geste, puis par planche (jardin
   puis nom, dans l'ordre naturel) le sens (« Plus d'eau apportée que prévu,
   trois semaines de suite »), le tableau des trois semaines (semaine du,
   prévu, apporté, écart en %) et ses causes, ou « Cause non déterminée ».
   Le débit dit les irrigations retenues et la médiane de leur allongement,
   « Réglé aujourd'hui » et « Proposé » (ou « Pas de débit à proposer au
   dixième de mm/h près. ») ; l'objectif dit l'objectif de la semaine et
   l'objectif proposé d'après les cultures ; la pluie dit les sommes des
   jours mesurés, mesure contre réanalyse, et les jours sans mesure, avec le
   lien « Saisir la pluie mesurée » vers la saisie au pluviomètre d'« Objectifs
   et besoins », quand la ferme coche cette page. Plusieurs causes se disent
   toutes, le débit ou l'objectif d'abord, la pluie ensuite.
4. **F743, « Adopter ».** Le geste passe par le service
   (`lib/services/applied-water-gap-adoption.ts`), qui relit l'écart d'abord :
   une semaine changée est refusée (« La semaine a changé. Rechargez le
   planning. ») ; une proposition qui ne tient plus — irrigation confirmée
   entre-temps, réglage retouché, objectif changé — n'écrit rien (« Cette
   proposition ne tient plus : rien n'a été changé. Voici l'écart à
   jour. »). Le débit s'enregistre par le chemin d'un réglage changé à la
   main (`saveEquipmentSettingForUser`, mêmes vérifications, le nom gardé,
   provenance « saisi », sans calcul retenu) et le plan se recalcule sous
   l'événement « un réglage appliqué changé » : le débit des planches
   alimentées change. L'objectif passe par le geste de la 5 quater (la fiche
   de la semaine en cours, ouverte, la révision d'adoption), seulement si
   la fiche propose encore la valeur montrée, avec l'origine « proposition
   adoptée », et le plan se recalcule sous « un objectif hydrique changé ».
   La réponse relit l'écart, et les autres onglets relisent (D-129). Le
   journal des modifications (n° 7) garde chaque geste par ces mêmes
   chemins, sans rien de plus : le débit comme un réglage de matériel
   changé (« Réglage de matériel », le débit d'avant et d'après), l'objectif
   sous « Objectif proposé adopté » ; une proposition qui ne tient plus
   n'y écrit rien.

Ne changent pas : le besoin (3.3), la répartition (3.4) et le planning
(3.5), qui ne lisent pas l'écart ; les irrigations passées gardent leur
copie du réglage et les objectifs leurs révisions (D-006) ; aucune
migration, aucun appel à OTF, aucun réglage de Cloudflare. **Constat**, sans
changement : retoucher les débits d'un réglage sur « Matériel et placement »
ne recalcule pas le plan (règle 4 de `docs/replanning-contract.md`, qui ne
nomme que le réglage appliqué changé), alors qu'« Adopter » le fait ; à
proposer au porteur.

## D-292 — Outillage : eslint 10, l'alerte minimatch fermée

Date : 22 novembre 2026. Statut : décidé (lot à part de l'alerte minimatch,
rangé depuis le 9 novembre 2026, D-095 ; « vas-y » du porteur le
22 novembre 2026 à 10 h 53).

**Contexte.** `pnpm audit` signalait depuis la revue de sécurité de la 3.9
une vulnérabilité modérée de minimatch (GHSA-g3hv-75wg-m249, déni de service
par amplification des motifs, versions 7.0.0 à 11.0.0), tirée par l'outil de
lint : `minimatch` 10.2.6 par `@typescript-eslint/typescript-estree` 8.68.0
(`eslint-config-next`). Outil de développement, absent du site servi
(`pnpm audit --prod` ne le voit pas). Le correctif demandait `minimatch` 11 :
seule la version 8.73.0 de typescript-eslint (16 novembre 2026) le demande ;
eslint 10 le demande lui-même (11.0.5 ou plus).

**Décision.**

1. `eslint` passe de 9.39.4 à 10.15.0 (13 novembre 2026), version exacte ;
   typescript-eslint passe de 8.68.0 à 8.73.0 dans le verrou, dans la plage
   que demande déjà `eslint-config-next` 16.4.3 (`^8.56.0`), qui ne change
   pas. `minimatch` 10.2.6 quitte l'arbre ; il reste 11.0.9 (eslint,
   typescript-eslint) et 3.1.5 (greffons `import`, `jsx-a11y`, `react`), hors
   de la plage vulnérable. `pnpm audit` ne signale plus minimatch.
2. **Trois greffons hors de leur plage déclarée.** `eslint-plugin-import`
   2.32.0, `eslint-plugin-jsx-a11y` 6.10.2 et `eslint-plugin-react` 7.37.5,
   tirés par `eslint-config-next`, ne déclarent encore qu'eslint 9 au plus ;
   ce sont leurs dernières versions. Ils sont acceptés sous eslint 10 par
   `peerDependencyRules.allowedVersions` de `pnpm-workspace.yaml`, avec sa
   raison et sa condition de retrait (quand chacun déclarera eslint 10),
   après deux vérifications : un même fichier d'essai, écrit pour déclencher
   une règle de chaque greffon (`react/jsx-key`, `react/display-name`,
   `react/no-danger-with-children`, `jsx-a11y/alt-text`,
   `jsx-a11y/aria-props`, `import/no-anonymous-default-export`,
   `react-hooks/rules-of-hooks`, `react-hooks/exhaustive-deps`,
   `@next/next/no-img-element`, trois règles de typescript-eslint et
   `no-var`), donne les mêmes treize signalements sous eslint 9 et sous
   eslint 10 ; la configuration résolue d'un fichier de l'interface
   (`eslint --print-config`) a les mêmes 115 règles au même niveau, une seule
   différence d'écriture sur `no-unused-vars`, éteinte dans les deux cas.
3. **Deux épinglages levés**, devenus sans objet : `brace-expansion@5`
   (minimatch 11 demande lui-même 5.0.12, la version épinglée) et `js-yaml@4`
   (il venait de `@eslint/eslintrc`, qu'eslint 10 n'emploie plus : js-yaml
   quitte l'arbre). `brace-expansion@1` reste, pour minimatch 3.
4. `eslint.config.mjs` ne change pas : il emploie déjà la configuration
   « plate » et `defineConfig` d'`eslint/config`, seules formes qu'accepte
   eslint 10. La CI garde Node 22.13.0, le minimum qu'eslint 10 demande sur
   cette génération (`^22.13.0`).

**Hors de ce lot, signalé au porteur.** Le même `pnpm audit` relève sept
vulnérabilités modérées de `next` 16.4.3, paquet de production (versions
16.0.0 à 16.4.4, corrigées en 16.4.5 ; 16.4.6 est la dernière) : aucune
touche aux fonctions qu'emploie le module d'après leurs titres (cache
`use cache`, optimisation d'images, serveur Next auto-hébergé ; le module
est servi par vinext), sans que ce soit vérifié une à une. La montée de
`next` et d'`eslint-config-next` ensemble se fait dans un lot à part, comme
le 8 octobre 2026.

**Contrôles.** `pnpm lint`, `pnpm typecheck`, `pnpm test` (2 245 tests
verts, dont ceux de `tests/lint-boundaries.test.ts`, qui joue ESLint
lui-même, puis les 603 tests de la persistance sous chacune des trois
isolations et les 2 245 de nouveau sous la jauge du moteur commun, aucun
échec), `pnpm build`, `pnpm knip`, `pnpm push:check`, `pnpm weather:check`
et `pnpm site:check` réussis en local avant et après le changement ; `pnpm
audit` avant : huit vulnérabilités modérées (minimatch et les sept de
`next`), après : sept (`next`). `pnpm e2e` n'est pas joué en local : ni
l'interface ni ses services ne changent, aucun paquet de production ne
change (`pnpm why eslint --prod` ne trouve rien, le paquet construit ne
contient aucune trace d'eslint) ; la suite complète des parcours est jouée
par la CI de la PR.

## D-293 — Le message du matin et le rappel du soir : une alarme par espace

Date : 22 novembre 2026. Statut : décidé (correctif du constat A de la revue
de l'isolation de la 4.3 à la 4.5, faite le 22 novembre 2026 pour la
condition E8 de la fiche d'entrée du pilote ; accepté par le coordinateur
sous l'autonomie que le porteur a donnée le 22 novembre 2026, « vas-y pour
tout »).

**Contexte.** Le message du matin (n° 3, D-283) et le rappel du soir (n° 2,
D-284) partaient sous un identifiant d'alarme fait du seul jour de Paris
(`morning:<jour>`, `evening:<jour>`), le même dans toutes les fermes. Le
Worker de notification ne garde qu'une alarme par identifiant : quand deux
espaces envoient le même jour, la seconde demande remplace la première
(révision plus récente) ou est refusée (`stale`, révision plus ancienne),
et le module comptait le refus comme un envoi. Un message se perdait sans
bruit. Aucun contenu ne passait chez l'autre ferme (chaque alarme garde sa
clé de récepteur), et le défaut restait latent avec un seul espace ; il se
serait déclenché à l'essai E2 et au pilote.

**Décision** (`docs/ameliorations-6-2-3-7-contract.md`, section 4.4) :

1. **F744.** L'identifiant et l'étiquette portent l'espace :
   `morning:<espace>:<jour>` et `morning-<espace>-<jour>`,
   `evening:<espace>:<jour>` et `evening-<espace>-<jour>`, composés par une
   seule fonction (`lib/domain/today/phone-notice-alarm.ts`). L'espace est
   l'identifiant de l'espace d'irrigation, déjà clé de récepteur. Le Worker
   ne change pas.
2. **F745.** Le module lit la réponse du Worker à ces alarmes
   (`schedulePhoneNoticeAlarm`) : seul `scheduled` vaut un envoi ; `stale`
   et une réponse illisible comptent comme une panne, la prise du jour est
   rendue et l'envoi se réessaie (le calcul relancé le matin, le passage
   suivant le soir). Les alarmes de fin et de retard d'arrosage, propres à
   chaque irrigation, ne changent pas.
3. **Point D4 de la revue du 18 novembre 2026.** Le test que promettait F366
   est ajouté (`tests/db/farm-identity.test.ts`) : chacun des quatre chemins
   qui écrivent la ferme gardée du déploiement (lecture complète, clé qui
   mène à une autre ferme, dernier instantané en cache, `GET /me`) écrit sa
   date au même format UTC, ce qui rend juste la comparaison alphabétique de
   la base.

Ne changent pas : le Worker de notification, le texte des messages, leurs
réglages, l'écran, aucune migration ; un message déjà parti sous l'ancien
identifiant le jour de la mise en ligne ne repart pas (la prise du jour, en
base, est par espace).

## D-294 — Améliorations, n° 7 : le journal des modifications se relit sans recharger la page

Date : 22 novembre 2026. Statut : décidé (correction de l'écart E1 de la
recette des améliorations n° 2 à 7, faite par l'assistant le 22 novembre
2026 ; autonomie donnée par le porteur le 22 novembre 2026, « vas-y pour
tout » ; réglage Opus 5.5 · Très élevé, celui de la n° 7, section
6 septies ; suite de D-288).

**Contexte.** La recette a vu, sur « Réglages », qu'après un changement
fait sur la page même (le rappel du soir, le message du matin), la section
« Journal des modifications » ne bougeait pas : sa ligne disait encore
« Aucune modification enregistrée » et sa liste restait vide jusqu'au
rechargement de la page ; un clic sur un filtre faisait paraître les cartes,
mais la ligne du pli restait fausse. Rien n'était perdu : tout était en base
et paraissait au rechargement. La cause : la section gardait ce qu'elle
avait lu à l'ouverture de la page, et rien ne la prévenait d'un changement
enregistré par un autre bloc de la page (les actions de « Réglages » ne
relisent pas la page, à dessein).

**Décision. F746 : un signal de la fenêtre, et une relecture au serveur.**

1. Chaque geste de « Réglages » qui écrit au journal, une fois réussi, le
   dit par un signal de la fenêtre (`notifyChangeJournalChanged`,
   `lib/domain/feasibility-notifications.ts`, à côté des signaux de la
   faisabilité et des ressources, D-093, D-129) : les messages de la ferme,
   le lieu de la météo et les autres enregistrements du tableau de l'eau,
   la correspondance des espèces et tout geste du panneau du besoin par
   culture, les parcelles et les abris. Un geste refusé ne signale rien.
2. La section écoute ce signal et se relit au serveur, pli fermé comme
   ouvert ; elle se relit aussi à chaque ouverture de son pli, ce qui
   rattrape un changement fait dans un autre onglet ou une page revenue de
   l'historique du navigateur. Une relecture garde le filtre choisi et
   repart des 50 dernières lignes ; la réponse d'une lecture plus ancienne,
   arrivée après une plus récente, ne remplace rien.
3. La lecture rend la page de cartes **et** la ligne du pli (le compte, la
   dernière ligne toutes familles, le début du journal), pour le filtre et
   « Voir plus » comme pour la relecture : la ligne ne peut plus rester
   fausse après un clic sur un filtre.
4. **Aucune action oubliée.** Un test
   (`tests/change-journal-refresh.test.ts`) relit le code de « Réglages »
   et de tout ce qu'elle affiche, relève chaque action serveur qu'elle peut
   appeler et échoue si l'une n'est pas rangée : elle prévient le journal
   (et son fichier porte le signal), elle recharge la page, ou elle n'écrit
   pas au journal, avec sa raison.

**Écarté.** Relire toute la page après chaque action serveur (`refresh()`
ou `revalidatePath`) : la page entière se recalculerait au serveur à chaque
case cochée, instantané d'Ouvre ta ferme compris, et les blocs qui gardent
leur état ne se remettraient pas à jour pour autant.

Preuves : `tests/db/change-journal-view.test.ts` (la ligne du pli suit
toutes les familles quels que soient le filtre et la suite, et se relit
après un changement), `tests/change-journal-refresh.test.ts` (le
rangement des actions), le parcours P55 à 390 et 1 440 px (la ligne et la
carte nouvelles sans rechargement, pli fermé puis ouvert, filtre gardé ; un
changement fait dans un autre onglet paraît à la réouverture du pli). Ne
changent pas : la table, les écrivains, les lignes écrites, aucune
migration, aucun calcul, aucun appel à Ouvre ta ferme.

## D-295 — La démonstration montre le cas d'écart entre l'eau prévue et l'eau apportée (n° 5)

Date : 22 novembre 2026. Statut : décidé (écart E2 de la recette des
améliorations n° 2 à 7, faite par l'assistant le 22 novembre 2026,
`/mnt/project-files/ameliorations/recette-ameliorations-2-a-7-2026-11-22.md` ;
demandé par le coordinateur sous l'autonomie que le porteur a donnée le
22 novembre 2026, « vas-y pour tout »).

**Contexte.** L'amélioration n° 5 (D-291) porte sur « Planning de la
semaine » le bloc « L'eau apportée s'écarte du prévu » quand, trois semaines
complètes de suite, l'eau apportée à une planche s'écarte de plus de 20 % de
l'eau prévue. La recette n'a pu le voir nulle part : la ferme n'arrose pas en
novembre, et l'historique de la démonstration (F169) prévoyait chaque
arrosage pour la durée qu'il a faite, sans début prévu, si bien qu'aucune
semaine ne s'écartait du prévu et qu'aucune cause ne pouvait se lire.

**Décision** (`docs/ameliorations-4-5-contract.md`, section 4, F747) :

1. **Un seul cas.** La « Ferme des Trois Noues », la seule ferme de la
   démonstration qui coche « Planning de la semaine », au moment « Début
   d'été » (16 juin 2026), celui de la visite du planning, où le clos a un
   arrosage proposé la semaine même. Les trois semaines complètes avant la
   semaine du moment (lundis 25 mai, 1er et 8 juin), l'arrosage habituel du
   lundi du « Goutte-à-goutte du clos » est prévu à l'heure où il commence,
   pour les deux tiers de sa durée habituelle (40 min, puis 1 h 20), et dure
   la durée habituelle. Le jeu le dit en une ligne (`DEMO_LONGER_THAN_PLANNED`,
   `lib/adapters/demo/module-data.ts`) ; la période est celle que la règle
   juge (`appliedWaterGapPeriod`).
2. **Seule la prévision change.** Les durées faites, les volumes, les cumuls
   et l'historique des autres matériels restent ceux de F169. Le bloc se lit
   sur S01 et S02, les deux planches du clos que ce goutte-à-goutte arrose
   ensemble : plus d'eau apportée que prévu, de 50 % chaque semaine ; la
   cause du débit (trois irrigations plus longues de 50 % en médiane), réglé
   à 6 mm/h, proposé à 4 mm/h. Le module les calcule lui-même ; aucune autre
   cause, la démonstration n'ayant aucune pluie mesurée.
3. **Écrit comme le reste de l'historique.** Ces arrosages s'écrivent d'un
   coup, déjà faits, avec leur début et leur fin prévus ; l'historique les
   dit « Déjà réalisée », la démonstration ne rejouant pas le minuteur.
4. **Remis à zéro comme le reste.** « Adopter » ne change que l'espace de
   l'invité ; le bouton « Remettre à zéro » et la tâche de nuit rendent le
   cas, l'espace se préparant de nouveau à la visite suivante. Preuves :
   `tests/db/ecart-prevu-reel-demo.test.ts` et le parcours V11 de la
   démonstration (`e2e-demo/v11-ecart-prevu-reel.spec.ts`), aux deux
   largeurs.

Ne changent pas : la règle de l'écart (D-291), l'écran, la ferme réelle, les
autres fermes et les autres moments de la démonstration ; aucune migration,
aucune valeur agronomique (des durées d'arrosage d'une ferme inventée).

## D-296 — Outillage : `next` 16.4.6, les sept alertes modérées fermées

Date : 22 novembre 2026. Statut : décidé (lot à part rangé par D-292 ;
couvert par le « vas-y pour tout » du porteur du 22 novembre 2026 à
10 h 53).

**Contexte.** Après le lot eslint 10 (D-292), `pnpm audit` relevait sept
vulnérabilités modérées, toutes sur `next` 16.4.3, paquet de production
(versions vulnérables jusqu'à 16.4.4, corrigées en 16.4.5) :
GHSA-mfr8-8qww-v76h, GHSA-vc7v-qv4w-wrv8, GHSA-rhh4-g77r-r9qj et
GHSA-vvgp-ww4w-46vf (cache `use cache` et Cache Components),
GHSA-7qx7-33qx-rqx2 (optimisation d'images, SVG), GHSA-f3mh-rxg3-f5g2
(cookie HttpOnly, routes Edge) et GHSA-pc58-hwjq-p385 (serveur Next
auto-hébergé qui relaie des réponses). Le module est servi par vinext, qui
remplace lui-même les imports `next/*` : le paquet construit ne contient pas
de code de `next/dist`, et aucune de ces fonctions n'est employée d'après
leurs titres, sans que ce soit vérifié une à une. La montée se fait quand
même, pour fermer les alertes et garder `next` (types, outillage) à jour.

**Décision.**

1. `next` passe de 16.4.3 à 16.4.6 (9 novembre 2026, la dernière de la
   ligne 16.4), version exacte ; `eslint-config-next` le suit, de 16.4.3 à
   16.4.6, comme le 8 octobre 2026 (D-292 : les deux ensemble). Dans le
   verrou, `@next/env`, `@next/eslint-plugin-next` et les `@next/swc-*`
   suivent ; `nanoid` 3.3.19, que `next` 16.4.6 ne demande plus, quitte
   l'arbre. Aucun autre paquet ne change ; les greffons d'eslint gardent
   leurs versions, l'acceptation sous eslint 10 de `pnpm-workspace.yaml`
   reste.
2. `pnpm audit` et `pnpm audit --prod` : « No known vulnerabilities found ».
3. Rien d'autre ne change : ni le code, ni la configuration (Next, vinext,
   ESLint, Wrangler), ni les épinglages.

**Contrôles.** Voir `docs/ETAT_DU_PROJET.md` (outillage, lot `next`
16.4.6) : les huit contrôles réussis avant et après le changement, et les
parcours navigateur joués en local après.

## D-297 — L'archive des prévisions J+1 à J+7, jamais écrasée

Date : 22 novembre 2026. Statut : décidé (idée rangée sans engagement de la
section 6 ter de la roadmap, entrée dans l'ordre d'exécution sur le « vas-y
pour tout » du porteur du 22 novembre 2026 à 10 h 53, qui la lui listait ;
contrat écrit le même jour sans code, choix par défaut de son § 7).

**Contexte.** La prévision d'un jour était écrasée à chaque nouvelle lecture
(clé : exploitation, lieu, date, nature) : la prévision faite la veille pour
aujourd'hui n'existait plus. Sans elle, on ne peut ni mesurer l'erreur des
prévisions que voient les maraîchers, ni vérifier sur des données vécues les
hypothèses de la seconde passe du banc commun.

**Décision** (`docs/forecast-archive-contract.md`, F748 à F754 ;
migration 0046) :

1. Une table neuve, `irrigation_weather_forecast_archive`, par
   exploitation, lieu, jour d'émission (jour civil de Paris, D-004) et jour
   visé ; seuls J+1 à J+7 sont gardés. Les écritures sont des `INSERT … ON
   CONFLICT DO NOTHING` : la première ligne reste, aucune mise à jour.
2. La première lecture réussie du jour l'écrit, tâche de 6 h 15 ou
   actualisation à l'écran, juste après les prévisions et avec les mêmes
   valeurs : **aucun appel externe de plus**. Une lecture plus tard le même
   jour ne change rien de ce qui est écrit ; elle n'ajoute qu'un horizon
   absent (F748, le cas d'une tâche du matin manquée).
3. Une valeur absente reste nulle (D-003) ; un jour sans lecture réussie n'a
   pas de ligne et n'est jamais reconstitué.
4. 24 mois glissants, purgés par la tâche « Purges de conservation » du
   matin ; la table garde le plan d'effacement d'une ferme et prend sa
   propre règle au plan de conservation (F753).
5. Un échec d'écriture ne fait jamais échouer la lecture météo ; il est
   journalisé par le service, le statut et la date seulement (F751).
6. Aucun écran, aucun calcul changé : D-010, D-041, D-047 intacts. Une
   lecture de domaine, `listForecastArchive`, attend les chantiers futurs.

**Écarté.** (a) Une archive par lieu partagée entre exploitations : moins de
lignes, mais l'isolation et l'effacement d'une ferme se compliquent pour un
gain de stockage négligeable (§ 7). (b) Garder J+8 à J+14 : précision trop
faible pour servir, volume doublé. (c) Bloquer le jour entier à la première
lecture : une actualisation de la semaine affichée, un samedi, aurait privé
la journée de J+2 à J+7 (F748).

**Coût.** Relu le 22 novembre 2026 sur les pages de Cloudflare (F754) :
100 fermes écriraient environ 85 000 lignes par mois, 0,17 % des 50 millions
inclus, et de l'ordre de 0,1 Go sur 24 mois, contre 5 Go inclus. Aucun coût
supplémentaire.

Preuves : `tests/forecast-archive.test.ts`, `tests/db/forecast-archive.test.ts`
(les dix tests du § 5 du contrat ; le test 10 sur base vide par chaque test
qui migre la base, sur la base réelle par le déploiement),
`tests/weather-automatic-sync.test.ts`, `tests/db/retention-purge.test.ts`,
`tests/retention-plan.test.ts`, et les plans d'effacement et de conservation
qui relisent la base migrée. Ne changent pas : la table des prévisions, les
appels au fournisseur, le besoin, les alertes, l'ET0, aucun écran.

## D-298 — La page déclare l'icône de l'onglet

Date : 22 novembre 2026. Statut : décidé (correction, couverte par le
« vas-y pour tout » du porteur du 22 novembre 2026 à 10 h 53 ; réglage de
la grille : Opus 5.5 · Élevé, corrections).

**Contexte.** La page ne déclarait aucune icône : un navigateur ordinaire
demandait alors `/favicon.ico`, que le site ne sert pas, et recevait une
erreur 404, écrite dans sa console. Le constat vient du fil du cas d'écart
de la démonstration (D-295) : un Chromium complet, contrairement au
navigateur sans tête des parcours, fait cette demande.

**Décision.** `app/layout.tsx` déclare l'icône déjà servie par `public/` et
nommée par le manifeste, `/favicon.svg` (`image/svg+xml`), par les
métadonnées de la page, comme le manifeste et l'image de partage ; aucun
fichier de métadonnées sous `app/` (la règle de
`tests/app-metadata-files.test.ts` reste vide). Le parcours P0 vérifie que
l'icône est déclarée et qu'elle répond 200.

**Écarté.** (a) Servir un `/favicon.ico` : un second fichier à tenir pour la
même image, alors que tout navigateur en service lit une icône SVG
déclarée. (b) Un fichier `app/icon.svg` lu par le cadre : la route d'image
qu'il crée est ce qui a déjà produit une 404 le 7 novembre 2026. Le site
public (`irrigation-otf-site`, un Worker à part) n'est pas traité ici.

## D-299 — La relecture juridique est abandonnée par le porteur (condition E6 levée)

Date : 22 novembre 2026, 17 h 50. Statut : décidé par le porteur (décision
réservée, prise de sa main ; message : « j'ai trouvé personne pour la
relecture juridique, donc écoute, tant pis, on va laisser comme ça, et puis
j'en prends la responsabilité »). Réglage de la grille : Sonnet 5.5 · Moyen,
registres seuls.

**Contexte.** Le contrat de la 4.6 (D-221, 10 ter.3) et la règle du
15 novembre 2026 faisaient de la relecture juridique gratuite, par le réseau
du porteur, la condition d'entrée E6 de la fiche du pilote, avant l'envoi de
l'accord à une ferme tierce et avant toute ferme tierce reliée (T4-20,
question 4). Le porteur n'a trouvé aucun relecteur.

**Décision.** La condition E6 est **levée** : le porteur renonce à la
relecture et prend la responsabilité de la confidentialité, des conditions
et du modèle d'accord tels qu'ils sont. Les textes restent **non relus par
un juriste** ; la levée n'est pas une relecture faite et ne se présente
jamais comme telle. L'envoi de l'accord, le choix des fermes et les autres
conditions d'entrée (E1 à E5, E7 à E12) ne changent pas. Consignée dans la
fiche d'entrée (E6 « levée »), le modèle d'accord (statut et mode d'emploi),
le contrat de la Tranche 4 (note au 10 ter.3) et la roadmap (4.6).

**Reste.** (a) La page publique de confidentialité
(`cloudflare/irrigation-site/src/pages.ts`, ligne de note) dit encore : « Il
n'a pas encore été relu par un juriste ; il le sera avant qu'une autre ferme
que celle du responsable soit reliée », phrase que le test du site
(`site.test.ts`) fige. Elle promet une relecture qui n'aura pas lieu : le
texte à y mettre est à la décision du porteur, dans une PR de code à part
(le site public se redéploie). Non modifiée ici. (b) Les mentions
historiques de la relecture dans les registres plus anciens et dans le
contrat gardent leur texte d'origine ; la note du 10 ter.3 les corrige.

## D-300 — La page de confidentialité ne promet plus de relecture juridique

Date : 22 novembre 2026. Statut : décidé par le porteur (« oui » du
22 novembre 2026 à 18 h 35, à la question de remplacer la promesse par une
phrase simple ; réglage de la roadmap, ligne 4.8 : Opus 5.5 · Élevé, code).

**Contexte.** D-299 lève la relecture juridique, mais laisse ouverte (« Reste »,
point a) la note de la page publique de confidentialité : « Il n'a pas encore
été relu par un juriste ; il le sera avant qu'une autre ferme que celle du
responsable soit reliée. » Cette promesse ne sera pas tenue.

**Décision.** La note dit désormais : « Ce texte décrit honnêtement ce que fait
le module aujourd'hui. Il n'a pas été relu par un juriste. » Elle ne promet
plus rien. Le texte change, sa date passe au 22 novembre 2026. Le test du site
(`cloudflare/irrigation-site/test/site.test.ts`) fige la nouvelle phrase et
vérifie qu'aucune relecture n'est promise ; le commentaire de
`cloudflare/irrigation-site/src/pages.ts` suit. Rien d'autre ne change sur
le site ; les conditions n'avaient pas de telle phrase.

## D-301 — La jauge passe au moteur commun (fusion des moteurs, étape 3, PR 2)

Date : 24 novembre 2026. Statut : la PR 2 du plan de la fusion validé par le
porteur (D-270, décision 6 ; contrat `docs/shared-engine-adapter-contract.md`),
après la lecture des trois matins faite avec son accord (« Vas-y », le
24 novembre 2026 à 8 h 59) ; réglage : Opus 5.5 · Max (MC-26).

**Contexte.** La PR 1 (#158, en ligne le 22 novembre 2026 à 3 h 39) a branché
la jauge sur le moteur commun derrière l'interrupteur `GAUGE_ENGINE`, resté
sur l'ancien calcul, et fait comparer chaque matin les deux calculs au
journal. Le contrat fixe la bascule après trois matins de suite sans écart,
sans échec et sans planche laissée de côté sur la ferme réelle.

**Les trois matins.** Lus le 24 novembre 2026 vers 9 h 15 au journal du
Worker `module-irrigation-otf` (Observability de Cloudflare), dans le Chrome
du porteur, en lecture seule, l'onglet refermé ensuite (le porteur s'est
connecté lui-même) : les 22, 23 et 24 novembre 2026 vers 6 h 15,
164 planches et 5 084, 6 068 puis 5 904 jours comparés, `daysWithGap` 0,
`failures` 0, `skippedBeds` 0, le plus grand écart 2,8e-14 mm, niveau
« info » ; aucune ligne `soil_reserve_day_record_failed` sur ces trois jours.

**Décision.** L'interrupteur passe sur `commun` : la jauge est calculée par
le moteur commun v0.3.0, jeu OTF. L'ancien calcul reste derrière
l'interrupteur jusqu'à la PR 3 : le second passage des tests le rejoue en
entier (`pnpm test:jauge-ancien-calcul`, qui remplace
`pnpm test:jauge-moteur-commun` ; seul le test de l'interrupteur change), et
la comparaison du matin compare dans l'autre sens
(`"reference":"commun","compared":"module"`).

**Ce qui change.** Sur la ferme du porteur, aucun chiffre : les trois matins
le montrent. Ailleurs, les deux seules données impossibles du contrat, dites
au porteur le 24 novembre 2026 avec leurs deux valeurs : une RFU de 0 mm/m
(avant : 0 mm, % du plein inconnu, tout l'apport compté en drainage ;
après : « Inconnue : aucune RFU saisie pour sa parcelle ») ; une ET0
négative ou illisible sous un couvert (avant : la jauge montait sans eau ;
après : le jour inconnu, « ET0 manquante », jusqu'au prochain départ).

**Temps de calcul**, remesuré (contrat, choix 7) : médiane de sept passages
sur 3 000 planches tirées au hasard, 34 microsecondes par jour pour l'ancien
calcul, 50 pour le moteur, 4 pour comparer ; le matin rejoue désormais
l'ancien calcul, le plus rapide.

**Reste.** La PR 3 : l'ancien calcul et la comparaison du matin retirés
après une semaine sur `commun` sans écart, lue au journal comme les trois
matins. Ne changent pas : D-028, D-047, D-053, D-270. Aucune migration.
Aucune question de budget.

## D-302 — Le module s'installe sur le téléphone, avec son logo

Date : 24 novembre 2026. Statut : décidé (correction demandée par le porteur
le 24 novembre 2026 à 9 h 31 : « Est-ce que c'est faisable que le site
internet soit installable sur mobile ? » ; logo choisi par lui à 9 h 44
parmi trois propositions, « C · Planches dans la goutte », et voulu
« partout » à 9 h 44 ; réglage choisi par le coordinateur faute de ligne de
la roadmap : Opus 5.5 · Élevé, celui des corrections).

**Contexte.** Sur son téléphone (Android, Chrome), le porteur ne pouvait pas
installer le module : le navigateur ne proposait qu'un raccourci. Deux
causes, trouvées dans le code, sans rien lire ni changer chez Cloudflare :

1. *Le manifeste demandé sans la session.* Un navigateur demande le
   manifeste **sans ses cookies** tant que sa balise ne porte pas
   `crossorigin="use-credentials"`, même sur le même site (règle du HTML).
   Or Cloudflare Access protège tout le Worker : sans le cookie de session,
   la demande est renvoyée vers la page de connexion, le manifeste n'est pas
   lu et le site n'est pas installable. `next` écrit cet attribut sur la
   balise qu'il tire des métadonnées ; `vinext` 1.0.1, qui sert le module,
   ne l'écrit pas (`shims/metadata.js`).
2. *Pas d'icône PNG.* Le manifeste ne nommait qu'une icône SVG, déclarée à
   la fois « any » et « maskable ». Chrome pour Android demande des icônes
   PNG de 192 et 512 pixels pour installer une application.

Le porteur a jugé l'ancienne icône (quatre carrés bleus) trop pauvre et a
choisi un logo parmi trois dessinés pour l'occasion : une goutte d'eau dont
le bas montre trois planches vertes et leurs goutteurs.

**Décision.**

- *Manifeste.* La page déclare le manifeste elle-même, dans `<head>`
  (`app/layout.tsx`), avec `crossorigin="use-credentials"`, et plus par les
  métadonnées, qui écriraient une seconde balise sans l'attribut. Le
  manifeste prend un identifiant (`/irrigation`) et nomme quatre images de
  `public/` : `icon-192.png` et `icon-512.png` (« any », la goutte sur fond
  transparent), `icon-maskable-512.png` (« maskable », la goutte sur le fond
  `#f4f7f1` du manifeste, dans la zone sûre du masque) et `favicon.svg`
  (« any » seulement).
- *Le logo partout.* `public/favicon.svg` devient la goutte (onglet,
  favoris) ; l'iPhone reçoit `apple-touch-icon.png` (180 pixels, fond plein,
  iOS n'acceptant pas la transparence) ; la notification de fin
  d'irrigation porte `icon-192.png` ; le site public
  (`irrigation-otf-site`) sert le même SVG à `/favicon.svg` et le déclare sur
  chaque page, page introuvable comprise. Le Worker du site ne lit pas
  `public/` : `cloudflare/irrigation-site/src/favicon.ts` en garde une copie,
  et son test échoue si elle diffère d'un octet.
- *Fabrication.* Les PNG sont rendues par Chromium (Playwright) à partir des
  SVG du logo, aux tailles du manifeste ; les sources et le script de rendu
  sont gardés hors du dépôt avec les aperçus montrés au porteur.
- *Vérifications.* `tests/web-app-manifest.test.ts` fige ce que le manifeste
  promet et vérifie que chaque PNG existe à la taille annoncée ; le parcours
  P0 vérifie la balise unique du manifeste, son attribut, et que chaque
  image déclarée ou nommée par le manifeste répond ; le test du service
  worker vérifie l'icône de la notification ; le test du site, le logo servi
  et déclaré.

**Écarté.** (a) Ouvrir le manifeste et les icônes à tous dans Cloudflare
Access (règle « Bypass ») : réglage Cloudflare, réservé au porteur, et
inutile si le navigateur présente la session. À reprendre seulement si
l'installation échoue encore une fois la correction en ligne. (b) Un
fichier `app/manifest.ts` lu par le cadre : la règle de
`tests/app-metadata-files.test.ts` les écarte (route créée par le cadre,
404 du 7 novembre 2026), et `vinext` n'y mettrait pas non plus l'attribut.
(c) Les propositions A (goutte et pousse) et B (feuille et goutte),
écartées par le porteur. (d) Un badge de notification (petite icône
monochrome de la barre d'état) : il demande un dessin à part.

**Reste.** L'installation sur le téléphone du porteur, constatée après
la mise en ligne (24 novembre 2026, 11 h 25, #185) : le porteur a installé
le module sur son téléphone (Android, Chrome) et confirmé à 12 h 51 :
« Tout fonctionne. » Les notifications quand le
téléphone n'a plus de session Access sont étudiées à part : la cause n'est
pas la même (le manifeste n'intervient pas dans la réception d'une
notification).

## D-303 — Les prévisions sont relues dans la journée pour les alertes (alertes sur le téléphone, C1)

Date : 24 novembre 2026. Statut : correction déléguée par le porteur le
24 novembre 2026 à 9 h 36 (« Réalise les corrections que tu juges
nécessaires. Comme d'habitude, tu inscris tout ça dans les registres
correspondants. ») ; première des cinq corrections de la section 6 octies de
la roadmap ; réglage : Opus 5.5 · Élevé.

**Contexte.** Le 24 novembre 2026, le porteur n'a reçu une notification de
gel qu'après s'être reconnecté à Cloudflare Access sur son téléphone et avoir
rouvert le module, vers 9 h 30. La livraison ne dépend pas d'Access : le
Worker de notification réessaie au plus 1 h 45 environ, un message n'attend
pas trois heures. Mais les alertes météo et de gel ne s'évaluaient qu'après
la lecture de 6 h 15 et à l'ouverture du module, quand la dernière lecture
avait plus de 3 heures : un gel apparu dans les prévisions après 6 h 15
n'alertait que si quelqu'un ouvrait le module. C'est la cause la plus
probable du retard, non prouvée : l'heure d'envoi de l'alerte, lisible dans
« Alertes cultures », la confirmerait.

**Décision.** Le planificateur relit les prévisions à 9 h 30, 12 h 30,
15 h 30, 18 h 30 et 21 h 30, heure de Paris (déclencheur
`30 7,8,10,11,13,14,16,17,19,20 * * *`, route
`/api/internal/weather-intraday`, même jeton de service), pour les seules
fermes qui lisent la météo et ont une alerte qui lit les prévisions (un
critère d'alerte météo actif, ou le gel ou les aspersions actifs). Chaque
relecture lit 7 jours de prévisions, le plus long horizon d'une alerte, un
appel par lieu partagé ; jamais la réanalyse ; rien n'est archivé (D-297).
Les alertes météo, le gel et les aspersions s'évaluent ensuite comme après la
lecture du matin ; leur règle de répétition empêche tout second envoi. La
relecture note la dernière lecture de la ferme (une ouverture du module dans
les 3 heures ne relit donc plus) sans toucher l'état de la mise à jour
automatique du matin (D-165), et a son propre verrou. Elle est une tâche du
registre, `weather-intraday` : orange à 16 heures, rouge à 27 (la nuit sépare
21 h 30 de 9 h 30 de douze heures). Le contrat est
`docs/weather-scheduler-contract.md`, « La relecture de la journée ».

**Coût, chiffré avant le code** (consigne : le budget est au porteur) :
5 lectures de prévisions de plus par jour et par lieu relu. Visual Crossing
compte une lecture de prévisions pour un enregistrement quel que soit le
nombre de jours (sa documentation, « What exactly is a weather record? ») :
5 sur les 1 000 enregistrements gratuits par jour. Sans clé Visual Crossing,
Open-Meteo : 5 appels sur les 10 000 gratuits par jour. Aucun service payant,
aucun secret nouveau : rien à demander au porteur.

**Alternatives écartées.** Relire toutes les heures (plus d'appels pour un
gain faible : les prévisions bougent peu d'une heure à l'autre) ; relire
toutes les fermes (une ferme sans alerte active n'a rien à recevoir) ; relire
la nuit (une alerte à 3 h ne réveille personne utilement ; la lecture de
6 h 15 la rattrape).

**Ne change pas.** Le besoin, l'objectif, le planning, la dose, la jauge ;
la lecture de 6 h 15 et ses calculs ; le séchage, évalué au matin ; les
textes et l'écran. Aucune migration. Ne règle pas, à lui seul, le cas d'une
alerte partie vers « aucun appareil » : c'est l'objet de C2 et C3.

## D-304 — Les alertes non délivrées se voient sur la page d'état (alertes sur le téléphone, C2)

Date : 24 novembre 2026. Statut : deuxième des cinq corrections de la
section 6 octies de la roadmap, déléguées par le porteur le 24 novembre 2026
à 9 h 36 ; réglage : Opus 5.5 · Élevé.

**Contexte.** Une alerte météo ou par culture partie vers « aucun appareil »
ou en échec n'était qu'enregistrée dans l'historique de la page des alertes
de la ferme, et journalisée au niveau info : ni la page d'état ni la veille
n'en disaient rien. Le 24 novembre 2026, une session Access expirée sur le
téléphone du porteur a montré qu'un appareil peut cesser de recevoir sans
que personne le voie.

**Décision.** La carte de chaque ferme, sur la page d'état, porte une ligne
« Alertes non délivrées » : sur 7 jours, dont les 24 dernières heures, le
nombre d'alertes météo et par culture (gel, séchage, aspersions) de ses
espaces parties sans atteindre un appareil, par cause (aucun appareil
inscrit ; échec de l'envoi ; envoi interrompu, c'est-à-dire pris sans
résultat après une heure). **Rouge** pour une alerte non délivrée dans les
24 heures, **orange** pour une plus ancienne ; le jugement d'ensemble la
compte avec les autres problèmes de la ferme. Une alerte « en nouvelle
tentative » (le service réessaie seul, son issue n'est pas rapportée) se
compte à part et ne change pas le ton. Des nombres seulement : ni contenu,
ni culture, ni jour visé. Contrat : `docs/tranche-4-contract.md`, F755 ;
règle : `lib/domain/operations/undelivered-alerts.ts` ; procédure :
`docs/exploitation.md`, « Une ferme a des alertes non délivrées ».

**Écart avec la fiche du 24 novembre 2026.** La fiche proposait une carte à
part, avec ses seuils dans le registre des tâches. Une alerte non délivrée
n'est pas une tâche (elle n'a ni rythme ni dernière réussite) et elle
appartient à une ferme : elle entre donc sur la carte de la ferme, comme les
erreurs d'Ouvre ta ferme, avec ses seuils nommés dans son module.

**Ne change pas.** L'envoi, la règle de répétition, l'historique des alertes
de la ferme. Aucune migration (les deux tables d'alertes gardent déjà leur
état d'envoi et leur heure). La veille de 9 h n'en dit encore rien : c'est
C3.

## D-305 — La veille de 9 h prévient l'exploitant des alertes non délivrées (alertes sur le téléphone, C3)

Date : 24 novembre 2026. Statut : troisième des cinq corrections de la
section 6 octies de la roadmap, déléguées par le porteur le 24 novembre 2026
à 9 h 36 ; réglage : Opus 5.5 · Élevé.

**Contexte.** Depuis C2 (D-304), la page d'état montre les alertes parties
sans atteindre un appareil ; encore faut-il l'ouvrir. La veille de 9 h
(F566) ne prévenait que des tâches du registre : une ferme dont plus aucun
appareil ne reçoit ses alertes de gel restait dans le silence.

**Décision.** Chaque matin à 9 h, la veille compte aussi les alertes météo
et par culture de **toutes les fermes** parties sans atteindre un appareil
dans les **24 dernières heures** (aucun appareil inscrit, échec de l'envoi,
envoi interrompu ; les mêmes que la carte de C2, par la même requête). Une
seule suffit : la veille envoie sa notification d'alerte habituelle, au lieu
du silence ou du « tout va bien » du dimanche. Titre « Module d'irrigation :
alertes non délivrées » (ou « … et N tâches à regarder » quand des tâches
sont aussi en cause) ; le texte le dit **en premier** : « 2 alertes non
délivrées en 24 heures, sur 1 ferme (aucun appareil inscrit : 2). » puis les
tâches, sans « depuis quand » si la place manque. Des nombres seulement :
jamais le nom ni l'identifiant d'une ferme, ni le contenu d'une alerte. La
notification part, comme avant, vers les seuls appareils de l'exploitant
(F608), jamais vers la ferme concernée. Une alerte en nouvelle tentative
ou plus ancienne que 24 heures ne compte pas : elle reste sur la carte de
la ferme.

**Pourquoi 24 heures.** La veille passe une fois par jour : une fenêtre de
24 heures compte chaque alerte une fois, sans en oublier entre deux veilles.

**Limite écrite.** Si c'est l'appareil de l'exploitant lui-même qui n'est
plus inscrit, la notification de la veille ne part pas non plus : la veille
est alors manquée (« aucun appareil de l'exploitant inscrit »), ce que la
page d'état montre, et le « tout va bien » du dimanche manque. La condition
E5 de la fiche d'entrée du pilote porte désormais cette vérification.

**Ne change pas.** Une notification au plus par jour ; le dimanche « tout
va bien » est le même quand aucune alerte n'a manqué son appareil. Aucune
migration, aucun déclencheur nouveau. Contrat : `docs/tranche-4-contract.md`,
F756 ; règle : `lib/domain/operations/operator-watch.ts` et
`lib/domain/operations/undelivered-alerts.ts`.

## D-306 — L'écran des alertes dit quand l'appareil n'est plus inscrit (alertes sur le téléphone, C4)

Date : 24 novembre 2026. Statut : quatrième des cinq corrections de la
section 6 octies de la roadmap, déléguées par le porteur le 24 novembre 2026
à 9 h 36 ; réglage : Opus 5.5 · Élevé.

**Contexte.** Un appareil dont l'inscription aux notifications s'est perdue
(données du navigateur effacées, inscription expirée ou retirée par le
service de notification) se présentait sur l'écran des alertes comme un
appareil « qui ne reçoit pas encore les alertes ». Rien ne disait qu'il les
recevait avant, ni qu'il fallait refaire le geste.

**Décision.** À l'ouverture de l'écran, une autorisation donnée sans
inscription veut dire une inscription perdue : l'autorisation ne se donne
qu'au geste « Activer ». L'écran dit alors « Cet appareil ne reçoit plus
les alertes : son inscription aux notifications s'est perdue. », en orange,
avec le bouton **« Réactiver les notifications »**, le même geste `activate`
(F372) ; le même bouton revient quand le service n'a pas pu inscrire
l'appareil. Un appareil jamais inscrit garde « Activer sur cet appareil ».
Contrat : `docs/weather-alerts-contract.md`, « L'écran » ; règle :
`lib/domain/irrigation-notifications.ts`.

**Limite.** La page ne sait pas qu'un appareil inscrit a cessé de recevoir
côté service : à l'ouverture, elle renouvelle l'inscription (F372), ce qui
la rétablit. Un appareil qui n'ouvre jamais le module n'apprend rien : c'est
la carte de la ferme (C2) et la veille (C3) qui le disent à l'exploitant.

**Ne change pas.** Le geste, l'abonnement, Réglages et la page des
arrosages (leur texte est inchangé). Aucune migration.

## D-307 — Les pages d'alertes disent la dernière lecture de la météo (alertes sur le téléphone, C5)

Date : 24 novembre 2026. Statut : dernière des cinq corrections de la
section 6 octies de la roadmap, déléguées par le porteur le 24 novembre 2026
à 9 h 36 ; réglage : Opus 5.5 · Élevé.

**Contexte.** Le 24 novembre 2026, une alerte de gel n'est arrivée qu'à la
réouverture du module : rien à l'écran ne disait que les alertes se
calculent à chaque lecture de la météo, ni quand la dernière avait eu lieu.

**Décision.** Les pages « Alertes météo » et « Alertes cultures » disent
l'heure de la dernière lecture réussie de la météo de la ferme. Au-delà de
3 heures (le seuil qui fait relire la météo à l'ouverture du module), la
ligne passe en orange : « … il y a plus de 3 heures. Une alerte apparue
depuis dans les prévisions n'a pas encore pu partir. » Un pli « Pourquoi
une alerte peut arriver en retard » nomme chaque lecture : 6 h 15, 9 h 30,
12 h 30, 15 h 30, 18 h 30, 21 h 30 quand une alerte est active (C1), et
l'ouverture du module. L'âge se juge une fois la page prête : le rendu du
serveur dit l'heure seule, la même partout. Contrats :
`docs/weather-alerts-contract.md` et `docs/weather-crop-alerts-contract.md`,
« L'écran » ; règle : `lib/domain/weather/alert-reading-note.ts`.

**Ne change pas.** Les lectures elles-mêmes, les alertes, leur envoi.
Aucune migration.

## D-308 — Le tableau de bord « Aujourd'hui » mène aux menus : contrat en six PR

Date : 24 novembre 2026. Statut : contrat écrit sans code, à coder ;
roadmap section 6 nonies. Diagnostic et contrat en Fable 5.2 · Élevé, par
exception expresse du porteur pour ce seul fil (« exceptionnellement en
fable élevé ») ; D-055 reste la règle et le code se fait dans un autre fil,
en Opus 5.5 · Élevé.

**Contexte.** Le porteur constate le 24 novembre 2026 (13 h 24) que les
tuiles du tableau de bord « Aujourd'hui » ne mènent nulle part, sur
téléphone comme sur ordinateur, et demande de vérifier la page entière. Le
diagnostic, fait sur la démonstration locale aux deux largeurs
(`/mnt/project-files/aujourdhui-liens/diagnostic-aujourdhui-2026-11-24.md`),
confirme : les quatre tuiles sont inertes alors que leurs cibles existent
sur « Objectifs et besoins » ; neuf autres endroits de la page sont dans le
même cas ; la réponse d'un geste s'écrit en tête de page, hors de l'écran
du téléphone ; l'heure d'une carte chevauche son texte ; des noms de
jardins sont coupés ; des blocs sont étirés sur ordinateur.

**Décision.** Le contrat `docs/aujourdhui-liens-contract.md` fixe six PR de
code, une à la fois : L1, les tuiles mènent à leur menu, avec un mot
d'action écrit sur la tuile ; L2, les jauges mènent à leur page et leurs
liens d'en-tête restent visibles sur le téléphone ; L3, les autres liens de
la page ; L4, la réponse d'un geste s'écrit sous le bouton pressé (la règle
du lot G, F404, étendue à « Aujourd'hui ») ; L5, la mise en page ; L6, sur
le téléphone, « Votre journée » passe avant les tuiles. Un lien mène, il
n'enregistre ni ne démarre rien (D-028) ; il n'existe que si la page visée
est cochée dans la ferme.

**À la main du porteur.** L6 change la précision T5 du contrat de la page,
validée le 8 novembre 2026, sur le téléphone seulement : option
recommandée, qu'il peut refuser avant le code de L6.

**Ne change pas.** Aucun calcul, aucune donnée, aucune migration ; l'ordre
des blocs sur ordinateur ; les pages d'arrivée, sauf une ancre par jardin
dans le tableau des besoins.

## D-309 — L'objectif automatique : l'objectif de la semaine peut suivre l'ET0, si la ferme l'allume

Date : 24 novembre 2026. Statut : **choix du porteur consignés, contrat
écrit sans code ; question 5 répondue le jour même à 18 h 46 : « Maintenir,
éteint par défaut »** ; code en quatre PR, O1 à O4 codées le jour même
(D-316, D-317, D-318, D-319) ; roadmap section 6 decies. Contrat en Fable 5.2 · Élevé, par exception
expresse du porteur pour ce seul fil ; code dans un autre fil, en Opus.

**Contexte.** Le porteur demande le 24 novembre 2026 (13 h 25) « un bouton
pour que on puisse, par défaut, régler les objectifs de la semaine sur
l'ET0. Et qu'on le modifie si besoin ». L'ET0 est une information depuis
D-010 ; le besoin par culture est un objectif proposé, adopté par un geste,
depuis D-045 ; le mode automatique a été écarté le 31 octobre 2026, à
reconsidérer « après une saison de comparaison, par une décision nouvelle »
(D-054).

**Décision du porteur**, sur quatre cartes de décision le 24 novembre 2026 :

1. l'objectif **suit l'ET0 tout seul**, contre la recommandation de
   l'assistant, qui proposait un bouton de préremplissage validé à la main
   (13 h 30) ;
2. il est **mis à jour chaque matin** (13 h 32) ;
3. sous abri, c'est **l'ET0 multipliée par le K_abri de l'abri** (13 h 33) ;
4. quand le **besoin de la culture** (ETM) est connu pour une planche,
   c'est lui qui sert ; sinon l'ET0 (13 h 35).

**Garde-fous posés par l'assistant**, annoncés au porteur : le réglage est
par ferme et **éteint tant que la ferme ne l'allume pas** (D-028) ; **un
objectif saisi, à n'importe quel niveau, passe toujours avant** ; un jour
sans ET0 n'est jamais compté pour zéro en silence (D-003) ; une semaine
close ne bouge plus (D-006, D-039). Contrat :
`docs/objectif-automatique-contract.md`, quatre PR de code, O1 à O4.

**Ce que cela change.** D-010 et D-045 gagnent une exception : réglage
allumé, l'objectif d'une planche sans objectif saisi est la somme des ETM
ou des ET0 de ses jours. L'ET0 n'entre que par l'objectif : l'écart reste
« objectif − (irrigation réelle + pluie réelle) », sans bilan hydrique.
`AGENTS.md` et les contrats qui portent D-010 et D-045 sont corrigés par la
PR O1, avec le code : d'ici là, ils disent vrai du code.

**Contradiction signalée.** Cette décision revient sur D-054 avant la
saison de comparaison qu'elle demandait. L'assistant l'a signalée au
porteur le jour même (question 5, 13 h 43 : maintenir, attendre une saison,
ou un bouton de préremplissage seul), et aucun code de l'objectif
automatique n'a commencé avant sa réponse. **Réponse du porteur, le
24 novembre 2026 à 18 h 46**, sur la carte de décision : « Maintenir,
éteint par défaut », l'option recommandée. Son choix du jour remplace
D-054 : le mode automatique est retenu, par ferme, éteint tant que la ferme
ne l'allume pas ; chaque ferme l'allume si elle le veut, et rien ne change
sans ce geste. Le code suit les six PR de la section 6 nonies.

**Ne change pas.** Réglage éteint, rien ne change, pour aucune ferme. Le
calcul de l'ETM, la pluie comptée, la pénurie, les priorités, la
faisabilité, la règle du planning, la réserve du sol (information, D-041,
D-047).

## D-310 — « Aujourd'hui » mène aux menus, L1 : les quatre tuiles mènent à leur menu

Date : 24 novembre 2026. Statut : codé (PR 1 sur 6 du contrat
`docs/aujourdhui-liens-contract.md`, D-308, section 3) ; roadmap section
6 nonies. Code en Opus 5.5 · Élevé, le réglage de la ligne 6 nonies.

**Décision.** Les quatre tuiles de « Cette semaine » deviennent chacune un
lien entier vers « Objectifs et besoins », avec la saison et la zone de la
page : « Objectif de la semaine » ouvre le volet des objectifs
(`#objectifs-de-la-semaine`), « Eau reçue » le volet « Pluie mesurée »
(`#manual-rain`) ou, pour une ferme toute sous abri où la pluie ne compte
pas (D-032), les jours de la semaine (`#weather`), « Reste à apporter » le
tableau des besoins par planche (`#irrigation-needs-title`), « Eau
utilisée » les jours de la semaine. Le mot d'action est écrit en bas de la
tuile, avec un chevron qui ne passe jamais seul à la ligne : « Modifier les
objectifs » (« Poser un objectif » sans objectif), « Noter une pluie
mesurée » (« Voir jour par jour » sous abri), « Voir par planche » (« Voir
ce qui manque » quand le reste est inconnu), « Voir jour par jour ». Le
mot et la cible viennent du domaine (`lib/domain/today/week.ts`,
`links`) ; le lien n'enregistre rien (D-028). Les tuiles n'existent que
« Objectifs et besoins » cochée : la page visée existe toujours. Deux
textes corrigés : « rien aujourd'hui » au lieu de « dont 0 m³
aujourd'hui » ; « 7 planches sur 10 ont un objectif » au lieu de
« objectifs posés sur 7 planches sur 10 » (un seul « sur », F443).

**Précisions tranchées en codant.**

- F757 : « rien aujourd'hui » ne s'écrit que si le volume du jour est nul
  **et** qu'aucune surface mouillée ne manque dans la semaine ; sinon un
  zéro peut cacher une irrigation sans volume, et la tuile garde « dont au
  moins 0 m³ aujourd'hui » plutôt que d'affirmer « rien » (D-003).
- F758 : « Eau reçue » mène à la pluie mesurée dès qu'une seule planche de
  la saison est dehors ; « Voir jour par jour » seulement quand toutes sont
  sous abri.

**Preuve.** `tests/aujourdhui-liens.test.ts` (les quatre cas du contrat,
le singulier, la cible avec saison et zone, la tuile en lien sans geste) ;
`tests/aujourdhui-tableau-de-bord.test.ts` et
`tests/audit-ergonomie-final-lot-a.test.ts` suivent le texte corrigé ;
parcours P30 aux deux largeurs : quatre tuiles en liens, leur mot écrit,
44 px au téléphone, « Objectif de la semaine » ouvre le volet des objectifs
le champ dans l'écran, « Eau reçue » le volet de la pluie mesurée.

**Ne change pas.** Les chiffres, les phrases de détail, les couleurs et
l'ordre des tuiles ; les pages d'arrivée ; aucune donnée, aucune migration.

## D-311 — « Aujourd'hui » mène aux menus, L2 : les jauges mènent à leur page

Date : 24 novembre 2026. Statut : codé (PR 2 sur 6 du contrat
`docs/aujourdhui-liens-contract.md`, D-308, section 4) ; roadmap section
6 nonies. Code en Opus 5.5 · Élevé.

**Décision.** Chaque ligne de « Eau de la semaine » devient un lien :
la ferme vers le tableau des besoins (`besoins#irrigation-needs-title`),
chaque jardin vers son pli dans ce tableau, par l'ancre nouvelle
`besoin-jardin-<jardin>` (`needsGardenAnchor`, `lib/domain/today/week.ts`),
posée sur le pli du jardin, qui s'ouvre et vient en haut quand l'adresse le
vise, au chargement comme à un lien suivi. Chaque ligne de « Réserve du
sol » mène au pli de son jardin sur « Réserve du sol »
(`sol#soil-garden-<jardin>`), y compris une ligne « inconnue ». « Eau
disponible » gagne le lien d'en-tête « Ressources et pompes » ; chaque cuve
mène à sa carte (`ressources#reservoir-<réserve>`), où son volume se
corrige. Chaque lien porte, comme nom, la phrase déjà écrite pour un
lecteur d'écran (celles du bloc « Eau disponible » ne changent pas) ; le
dessin lui reste caché, et plus aucun lien ne vit sous `aria-hidden`.
Chaque ligne fait au moins 44 px de haut au téléphone, avec un focus
visible.

**Précisions tranchées en codant.**

- F759 : une ressource limitée mène à la liste des ressources de
  « Ressources et pompes » (`#water-resources-title`), pas à sa carte : les
  cartes des ressources n'ont pas d'ancre chacune, et le contrat ne change
  aucune page d'arrivée hors l'ancre des jardins des besoins (section 2).
  L'ancre d'une ressource, si elle est voulue, est une PR à part.
- F760 : sous 620 px, le lien d'en-tête reste caché dans l'en-tête et un
  second lien, le même, s'écrit en bas du bloc, sur toute la largeur, en
  forme de bouton (`.today-block-foot`) ; à l'ordinateur, l'inverse. Un
  seul des deux est visible et lu à chaque largeur.

**Preuve.** `tests/aujourdhui-liens.test.ts` (ancres et phrases des trois
blocs, les phrases d'« Eau disponible » inchangées, aucun dessin lu, aucun
lien sous `aria-hidden`, l'ancre du pli des besoins) ; parcours P29 (la
cuve mène à sa carte, dans l'écran) et P30 (la ferme et un jardin de « Eau
de la semaine », un jardin de « Réserve du sol », le lien de bloc en tête
ou en bas) aux deux largeurs.

**Ne change pas.** Les chiffres, les phrases, les dessins et l'ordre des
blocs ; aucune donnée, aucune migration. Les blocs étirés sur ordinateur
restent pour L5.

## D-312 — « Aujourd'hui » mène aux menus, L3 : les autres liens de la page

Date : 24 novembre 2026. Statut : codé (PR 3 sur 6 du contrat
`docs/aujourdhui-liens-contract.md`, D-308, section 5) ; roadmap section
6 nonies. Code en Opus 5.5 · Élevé.

**Décision.** Cinq endroits inertes de la page deviennent des liens, sans
rien enregistrer (D-028) :

- « Gel ou chaleur » : un jour en alerte est un lien entier vers la page de
  son alerte, « Voir l’alerte » écrit dessous en rouge ; un jour calme ou
  inconnu reste inerte (`alertPage`, `lib/domain/today/weather-days.ts`).
- « Fiabilité du calcul » : une ligne à jour mène à la page où vit sa
  donnée, là où son geste mènerait si elle était à rafraîchir
  (`link`, `lib/domain/today/reliability.ts`) : « Ressources et pompes »,
  la pluie mesurée des besoins (`#manual-rain`), « Réserve du sol »,
  la correspondance des espèces des réglages, le planning. Une ligne à
  rafraîchir garde ses propres gestes.
- En-tête : « Plan calculé … » mène au planning de la semaine, comme
  « Plan non calculé : ouvrir le planning » ; la ligne n'existe que
  « Planning » coché.
- État vide de « Votre journée » : « Voir le planning de la semaine » quand
  « Planning » est coché ; sinon « Planifier un arrosage »
  (`arrosages?planifier=1`, l'intention d'adresse existante) quand
  « Arrosages » est coché ; sinon rien (`dayEmptyLink`,
  `lib/domain/today/today-view.ts`).
- Une carte « À valider » dit « Valider au planning » au lieu
  d'« Ouvrir » ; la cible ne change pas. Une carte planifiée garde
  « Ouvrir ». Le nom lu par un lecteur d'écran est le mot, puis le titre et
  l'heure de la carte.

Chaque lien fait au moins 44 px de haut au téléphone, avec un focus
visible.

**Précisions tranchées en codant.**

- F761 : un jour qui annonce à la fois un gel des cultures et une alerte de
  l'exploitation mène à « Alertes cultures », dans le même ordre que
  « Voir les alertes » du bloc (le gel des cultures d'abord). C'était le
  point « à confirmer en codant » de la règle 1 du contrat.
- F762 : à jour, la ligne des réserves mène à « Ressources et pompes » sans
  viser une réserve, et celle du sol à « Réserve du sol » sans viser un
  jardin : à jour, aucune n'est à montrer plus qu'une autre.
- F763 : le job « Parcours navigateur » passe de 35 à 50 minutes. Les
  parcours ordinaires prennent désormais 27 à 33 minutes sur GitHub (17 à
  19 au lot K) ; la fusion de #193 (L2) a été coupée à 35 minutes, pendant
  les parcours de la démonstration (run 45422205205), et n'a donc pas été
  déployée à la première tentative. Aucun test retiré ni sauté.

**Preuve.** `tests/aujourdhui-liens.test.ts` (la page du jour en alerte,
le lien des lignes à jour et son absence à rafraîchir, l'état vide selon
les cases cochées, « Valider au planning ») ; parcours P29 aux deux
largeurs (l'état vide mène au planning ; la ligne du plan à jour et
« Plan calculé … » aussi ; le jour en alerte mène à la page de son
alerte, à 44 px au téléphone).

**Ne change pas.** Les chiffres, les phrases, les dessins et l'ordre des
blocs ; aucune donnée, aucune migration. Les barres de la frise de
« Votre journée » restent inertes (contrat, section 9).

## D-313 — « Aujourd'hui » mène aux menus, L4 : la réponse d'un geste s'écrit sous le bouton

Date : 24 novembre 2026. Statut : codé (PR 4 sur 6 du contrat
`docs/aujourdhui-liens-contract.md`, D-308, section 6) ; roadmap section
6 nonies. Code en Opus 5.5 · Élevé.

**Décision.** La règle du lot G (`ActionReply`, F404) s'étend à
« Aujourd'hui ». La réponse de chaque geste de la page s'écrit sous le
bouton pressé, et l'écran l'amène en vue au plus près :

- « Démarrer maintenant » et « Reprendre le reliquat » : sous la carte de
  l'irrigation ; démarrée, la carte passe « En cours » et la réponse l'y
  suit, avec « Suivre sur « Arrosages » » au bout ;
- « Fait comme prévu » : sous sa carte ; la carte partie, en tête de
  « Votre journée » ;
- « Tout est fait » : en tête de « Votre journée », sous le bouton, avec
  la liste des refus ;
- « Recalculer » de l'en-tête : sous la ligne du plan ;
- « Recalculer le plan » de « Fiabilité du calcul » : sous la ligne « Plan
  de la semaine », qui reste une fois le plan à jour.

Un refus s'écrit au même endroit, en rouge. Les deux paragraphes de tête de
page disparaissent : une réponse ne s'écrit qu'à un endroit, et un nouveau
geste remplace la réponse du précédent.

**Précisions tranchées en codant.**

- F764 : une réponse dont la carte n'est plus sur la page (une irrigation
  enregistrée comme faite, ou démarrée hors du jour) se lit en tête de
  « Votre journée » : jamais perdue. Les endroits vivent dans
  `app/irrigation/today/today-replies.ts`.
- F765 : `ActionReply` gagne deux ajouts facultatifs, un lien au bout de la
  phrase et une liste sous elle ; les autres pages n'en usent pas et ne
  changent pas.

**Preuve.** `tests/aujourdhui-liens.test.ts` (les endroits, un seul à la
fois, la carte qui garde sa réponse en passant « En cours », la carte
partie) ; parcours P29 (« Plan calculé. » sous la ligne du plan, dans
l'écran), P30 (la réponse de « Tout est fait » en tête de « Votre
journée », dans l'écran) et P38 (« Reprendre le reliquat » répond sous la
carte en cours, dans l'écran, jamais en tête de page) aux deux largeurs.

**Ne change pas.** Les gestes, leurs messages et leurs refus ; aucune
donnée, aucune migration. Les autres pages gardent leurs réponses.

## D-314 — « Aujourd'hui » mène aux menus, L5 : la mise en page

Date : 24 novembre 2026. Statut : codé (PR 5 sur 6 du contrat
`docs/aujourdhui-liens-contract.md`, D-308, section 7) ; roadmap section
6 nonies. Code en Opus 5.5 · Élevé.

**Décision.** Trois défauts de dessin corrigés, sans rien changer à ce
que dit la page :

- Ordinateur : un bloc étiré à la hauteur de son voisin garde son contenu
  en haut (`.today-block { align-content: start }`) ; la rangée de titre
  d'« Eau disponible » mesurait 705 px à 1440 px, elle en mesure 44.
- Téléphone : la colonne de l'heure d'une carte prend la place qu'il lui
  faut (`minmax(56px, max-content)`) ; l'heure recouvrait le texte de
  2,25 px à 390 px.
- Téléphone : une ligne de « Eau de la semaine » et de « Réserve du sol »
  passe sur une colonne : le nom en entier sur sa ligne, au besoin sur
  deux, la barre dessous, le chiffre sous la barre. Trois noms étaient
  coupés à 360 px.

**Précision tranchée en codant.**

- F766 : au téléphone, le chiffre d'une jauge passe sous la barre plutôt
  qu'à côté : un long chiffre (« 15 / 26,7 mm (5 planches de 10 ont un
  objectif) ») serrait sinon la barre à presque rien, comme il serrait le
  nom avant.

**Preuve.** Par mesures dans P30, aux deux largeurs : à 1440 px, aucune
rangée de titre de plus de 60 px ; à 390 et à 360 px, aucun nom de jauge
dont la largeur utile dépasse sa place (`scrollWidth`), et l'heure d'une
carte qui ne touche pas son texte (rectangles). Contre-épreuve : sans le
correctif, les trois mesures échouent (705 px, trois noms coupés,
2,25 px). `tests/aujourdhui-liens.test.ts` lit les trois règles de dessin.

**Ne change pas.** Les chiffres, les phrases, l'ordre des blocs et des
lignes ; l'ordinateur garde le nom, la barre et le chiffre sur une ligne.
Aucune donnée, aucune migration.

## D-315 — « Aujourd'hui » mène aux menus, L6 : au téléphone, la page commence par la journée

Date : 24 novembre 2026. Statut : codé (PR 6 sur 6 du contrat
`docs/aujourdhui-liens-contract.md`, D-308, section 8) ; roadmap section
6 nonies. Code en Opus 5.5 · Élevé. Change la précision T5 du contrat de
la page (`docs/aujourdhui-tableau-de-bord-contract.md`), au téléphone
seulement : c'était l'option recommandée du contrat, que le porteur pouvait
refuser d'un mot ; il ne l'a pas refusée, et l'assistant l'a retenue selon
la règle d'autonomie du 19 novembre 2026 (l'option recommandée, sauf
blocage). Si le porteur la refuse à la recette, elle se retire seule, sans
toucher aux cinq autres PR.

**Décision.** Quand la page fait 620 px de large ou moins (la borne de ses
requêtes de conteneur), « Votre journée » se place juste après l'en-tête,
avant les tuiles de la semaine, toujours, et non selon le jour. Sur
ordinateur, l'ordre ne change pas. L'ordre de lecture au clavier et au
lecteur d'écran suit l'ordre affiché : la page lit sa propre largeur et
rend la journée avant les tuiles dans le DOM.

**Précisions tranchées en codant.**

- F767 : « Gel ou chaleur » monte avec « Votre journée » : les deux
  partagent la même rangée de la page (D-141), qui passe entière avant les
  tuiles. Le gel annoncé reste ainsi dans les premiers écrans du
  téléphone.
- F768 : avant que la page ait lu sa largeur (le premier dessin, avant le
  JavaScript), deux règles `order` du dessin du téléphone remontent déjà la
  rangée de la journée : pas de saut de la page à l'ouverture. Dès la
  lecture, le DOM prend le même ordre.

**Preuve.** Parcours P30 aux deux largeurs : au téléphone, la journée
avant les tuiles dans l'ordre du document et à l'écran, sous l'en-tête ; à
l'ordinateur, les tuiles d'abord. `tests/aujourdhui-liens.test.ts` lit la
borne, l'ordre du rendu et les deux règles du premier dessin.

**Ne change pas.** Le contenu des blocs, l'ordre à l'ordinateur ; aucune
donnée, aucune migration.

## D-316 — L'objectif automatique, O1 : la règle

Date : 24 novembre 2026. Statut : codé (PR O1 sur 4 du contrat
`docs/objectif-automatique-contract.md`, D-309, sections 3 et 8) ; roadmap
section 6 decies. Code en Opus 5.5 · Max, le réglage de la roadmap.

**Décision.** La règle de l'objectif automatique vit en un seul endroit,
`lib/domain/automatic-objective.ts`, et `objectiveForBed`
(`lib/domain/irrigation-needs.ts`) la compose avec les objectifs saisis,
jour par jour :

- un jour où un objectif saisi couvre la planche, à n'importe quel niveau
  et même de 0 mm, il apporte un septième de sa valeur, comme avant ;
- un jour sans objectif saisi, réglage de la ferme allumé ce jour-là :
  l'ETM du jour quand « Besoin par culture » la connaît, 0 un jour sans
  culture, sinon l'ET0 du jour, × K_abri sous abri ; jamais une demi-ETM ;
- un jour sans ET0 n'a pas de valeur : la semaine compte les jours connus
  et nomme les autres ; une semaine entière sans culture n'a pas
  d'objectif automatique.

La fonction dit l'origine (« saisi », « automatique », « les deux ») et le
détail des jours automatiques : leur valeur ou ce qui l'empêche, la somme
par nature de l'ET0 (réanalysée, estimée, prévue), les jours manquants et
la base (culture, ET0, ET0 sous abri). Elle lit `et0OfDay`,
`shelterFactorOn` et les bornes de l'ETM (`lib/domain/crop-water/etm.ts`,
ces deux dernières exportées pour cela) : aucune règle copiée.

**Précisions tranchées en codant** (contrat, section 8).

- F769 : un jardin à classer n'a pas d'objectif automatique ; on ne sait
  pas s'il est sous abri.
- F770 : « Besoin par culture » cochée et plan de culture non lu : les
  jours n'ont pas de valeur, jamais l'ET0 d'une planche peut-être vide.
- F771 : une ET0 ou un K_abri hors bornes, quand l'ET0 sert seule : le
  jour n'a pas de valeur, le message de l'ETM la nomme.
- F772 : « sans culture de toute la semaine » se lit sur les sept jours ;
  une culture récoltée le mercredi laisse 0 ensuite.
- F773 : le réglage compte à partir du jour du geste, en heure de Paris ;
  deux gestes le même jour, le second fait foi.

**Corrigés avec le code**, comme le contrat le demandait : les deux règles
d'`AGENTS.md` qui portent D-010 et D-045, `docs/irrigation-needs-contract.md`
et la section « Le mode automatique » de `docs/crop-water-need-contract.md`.

**Preuve.** `tests/objectif-automatique.test.ts`, vingt tests : les douze
cas chiffrés du contrat, les cinq précisions, les natures de l'ET0, l'ETM
partielle ou bloquée, et un passage par le vrai calcul de l'ETM (une
carotte au Kc 0,7, un zinnia sans culture de référence). Contre-épreuve :
sept altérations de la règle (ET0 inconnue comptée 0, K_abri oublié,
demi-ETM, semaine sans culture comptée 0, jardin à classer ignoré, jour UTC
au lieu de Paris, priorité de l'objectif saisi oubliée) font chacune
échouer au moins un test.

**Ne change pas.** Aucun lecteur ne passe encore de source automatique à
`objectiveForBed` : le besoin, l'écart, le planning, la faisabilité,
l'historique, les séries et les écrans sont ceux d'avant, pour toutes les
fermes. Aucune donnée, aucune migration, aucun écran (O2 à O4).

## D-317 — L'objectif automatique, O2 : le réglage par ferme et ses lecteurs

Date : 24 novembre 2026. Statut : codé (PR O2 sur 4 du contrat
`docs/objectif-automatique-contract.md`, D-309, sections 3, 4 et 9) ;
roadmap section 6 decies. Code en Opus 5.5 · Max, le réglage de la roadmap.

**Décision.** Le réglage « Objectif automatique » est gardé par ferme,
geste par geste, dans `irrigation_automatic_objective_revisions`
(migration additive 0047) : éteint au départ, allumé ou éteint par un geste
daté qui compte à partir de son jour, en heure de Paris (D-316, F773). Le
geste s'écrit au journal des modifications, dans la même opération ; un
geste qui ne change pas l'état en vigueur n'écrit rien. Chaque lecteur de
l'objectif reçoit la source automatique, lue une fois
(`lib/services/automatic-objective-source.ts`), et la passe à
`objectiveForBed` : le besoin, et par lui le planning, la faisabilité et
« Aujourd'hui » ; l'aide du formulaire d'irrigation ; les fiches d'une
planche et d'une série ; l'écart entre prévu et réel ; l'historique et les
séries, qui composent l'objectif de leur période jour par jour avec les
valeurs qu'`objectiveForBed` donne à chaque jour. Réglage éteint, chaque
lecteur garde son calcul d'avant.

**Précisions tranchées en codant** (contrat, section 9).

- F774 : une ligne par geste, jamais réécrite ; un geste sans changement
  n'écrit ni ligne ni journal ; le journal dit « éteint → allumé ».
- F775 : un geste rend la faisabilité à refaire ; le recalcul du plan
  après le geste revient à l'action de l'écran (O4).
- F776 : une source par lecture ; éteint, deux requêtes et rien d'autre.
- F777 : une planche dont le jardin manque à l'instantané n'a pas
  d'objectif automatique, comme un jardin à classer.
- F778 : dans l'historique et les séries, un jour sans valeur automatique
  est compté à part, jamais pour zéro ; l'historique le dit.
- F779 : l'objectif restant d'une série devient inconnu dès qu'un de ses
  jours n'a pas de valeur automatique (au-delà de la prévision, le plus
  souvent).
- F780 : le tableau des besoins rend l'origine de l'objectif et le détail
  de ses jours automatiques, pour les écrans d'O4.
- F781 : le coût mesuré sur une ferme fictive de 300 planches : allumé,
  le besoin de la semaine passe de 71 à 118 ms et l'historique de la saison
  de 44 à 457 ms, après une correction qui l'a divisé par trois ; aucune
  requête vers Ouvre ta ferme.

**Preuve.** `tests/db/objectif-automatique-reglage.test.ts` (à deux
fermes : éteint au départ, le geste et son journal, la faisabilité, le
besoin en plein champ et sous abri, l'objectif saisi qui passe avant, le
réglage éteint un jeudi, un jour sans ET0, l'historique et l'aide du
formulaire ; la ferme d'à côté ne change jamais),
`tests/objectif-automatique-lecteurs.test.ts` et
`tests/series-water.test.ts`. Contre-épreuve : neuf altérations (jour sans
valeur compté, objectif automatique avant le saisi, restant sans garde,
semaine sans culture lue sur les seuls jours de la période, besoin,
historique ou aide du formulaire privés de la source, geste sans garde,
K_abri oublié) font chacune échouer au moins un test.

**Ne change pas.** Aucun écran ne montre ni n'allume le réglage (O4) :
le besoin, le planning, la faisabilité, l'historique, les séries et les
écrans sont ceux d'avant, pour toutes les fermes. Les semaines closes ne
sont pas encore enregistrées (O3).

## D-318 — L'objectif automatique, O3 : les semaines closes

Date : 24 novembre 2026. Statut : codé (PR O3 sur 4 du contrat
`docs/objectif-automatique-contract.md`, D-309, règle 6, sections 4, 6 et
10) ; roadmap section 6 decies. Code en Opus 5.5 · Max, le réglage de la
roadmap.

**Décision.** Une semaine finie ne bouge plus. Chaque matin, juste après
l'ETM du matin, la tâche du matin enregistre l'objectif automatique de
chaque semaine close (son dimanche est passé) où le réglage de la ferme
était allumé au moins un jour : une ligne par planche de la saison, dans
`irrigation_automatic_objective_weeks` (migration additive 0048), avec les
jours allumés de la semaine, chacun avec sa valeur et la nature de son
ET0 ou ce qui l'empêchait, et la semaine sans culture. Une ligne n'est
jamais réécrite. Les lecteurs de l'objectif la lisent par la source
automatique (`closedWeeks`) : relire la météo, corriger un Kc ou un stade
après coup ne change pas une semaine close, et son besoin de culture
n'est plus recalculé. Une semaine close pas encore enregistrée se relit et
se dit provisoire ; le matin suivant la rattrape
(`lib/services/automatic-objective-record.ts`).

**Précisions tranchées en codant** (contrat, section 10).

- F782 : tous les jours allumés s'enregistrent, qu'un objectif saisi les
  couvre ou non ; l'objectif saisi passe avant à la lecture, comme avant ;
  les valeurs et les natures sont celles du matin de l'enregistrement.
- F783 : une semaine à cheval sur deux années se ferme pour chacune de
  ses saisons, avec ses jours de chacune ; la tâche du matin regarde
  aussi la saison d'avant, toute l'année, pour la rattraper.
- F784 : une planche apparue après l'enregistrement d'une semaine n'y a
  pas d'objectif automatique, sans être dite provisoire.
- F785 : « provisoire » se dit dans les avertissements de l'historique et
  par `closure` pour les écrans d'O4 ; le rattrapage prend au plus huit
  semaines par ferme et par matin, les plus anciennes d'abord, y compris
  celles closes pendant qu'« Objectifs et besoins » était décochée (écart
  assumé à P5 : sinon elles resteraient provisoires pour toujours) ; une
  saison sans planche attend ses planches, sans prendre la part de l'autre.
- F786 : seules les fermes qui ont coché « Objectifs et besoins » et
  allumé le réglage au moins une fois ; rien n'est lu d'Ouvre ta ferme
  quand aucune semaine ne manque.
- F787 : une étape « objectif automatique » du calcul du matin ; une
  ferme en échec est comptée et n'arrête pas les autres.
- F788 : le coût mesuré sur la ferme fictive de 300 planches : semaines
  closes enregistrées, l'historique de la saison passe de 469 à 297 ms et
  les séries de 586 à 336 ms ; enregistrer huit semaines prend 190 ms.

**Preuve.** `tests/objectif-automatique-semaines-closes.test.ts` (une
semaine close enregistrée ne bouge pas quand la météo est relue ou qu'un
Kc est corrigé ; ses natures et ses jours sans valeur restent ; la
semaine sans culture ; F783, F784 ; l'objectif saisi passe avant ;
l'historique compte les semaines provisoires) et
`tests/db/objectif-automatique-semaines-closes.test.ts` (à deux fermes :
l'enregistrement du lundi, jamais réécrit, rien le dimanche ; la météo
relue chez l'une, la ferme d'à côté sans enregistrement relit et dit
« provisoire » ; un Kc corrigé ; le rattrapage après un matin manqué,
huit semaines au plus, les plus anciennes d'abord ; une saison sans
planche ; F784 ; les fermes de la tâche du matin). Contre-épreuve :
dix-huit altérations (semaine close relue au lieu de son enregistrement,
jamais « provisoire », close dès son dimanche dans le domaine ou dans la
source, aucune semaine provisoire dans la source ou dans l'historique,
planche absente relue, tâche qui réenregistre, ligne réécrite,
rattrapage sans borne ou les plus récentes d'abord, saison d'avant
oubliée, saison sans planche qui prend la part de l'autre, semaine en
cours enregistrée, « Objectifs et besoins » ignorée, semaine sans
culture recalculée, table oubliée à l'effacement, étape oubliée au
compte rendu du matin) font chacune échouer au moins un test.

**Ne change pas.** Aucun écran ne montre ni n'allume le réglage (O4) :
rien ne s'écrit dans la nouvelle table tant qu'aucune ferme ne l'allume,
et les lecteurs restent ceux d'avant pour toutes les fermes.

## D-319 — L'objectif automatique, O4 : les écrans

Date : 24 novembre 2026. Statut : codé (PR O4 sur 4 du contrat
`docs/objectif-automatique-contract.md`, D-309, sections 4, 5 et 11) ;
roadmap section 6 decies. Code en Opus 5.5 · Élevé, le réglage de la
roadmap, choisi par le porteur sur carte le 24 novembre 2026 à 20 h 46.

**Décision.** Le réglage « Objectif automatique » devient visible : un
interrupteur en tête du volet « Objectifs hebdomadaires » de « Objectifs
et besoins », avec la phrase du contrat, enregistré dès qu'on le touche, au
journal des modifications ; un geste qui change l'état recalcule le plan
comme un objectif saisi. Allumé, le volet compte les planches qui gardent
un objectif saisi et propose « Vider les objectifs », le geste existant.
L'origine de l'objectif se dit partout où il se lit : le tableau des
besoins (avec la bulle « D'où vient cet objectif ? », ses jours par nature
d'ET0, ses jours sans valeur et la clôture de la semaine), la fiche du
besoin de la culture, « Aujourd'hui », le planning et l'historique. Une
planche dont l'objectif automatique est déjà le besoin de la culture ne
propose plus « Adopter la proposition ». « Fiabilité du calcul » gagne une
sixième donnée, « Objectif automatique », suivie seulement réglage allumé :
les jours sans ET0 de la semaine, avec un lien vers la météo.

**Précisions tranchées en codant** (contrat, section 11).

- F789 : le geste, enregistré tout de suite, recalcule le plan
  (`objective-changed`, durable) ; un geste sans effet n'écrit rien et le
  dit ; seule la page « Objectifs et besoins » lit le réglage pour son volet.
- F790 : les planches qui gardent un objectif saisi se comptent sur les
  objectifs de la semaine affichée ; l'écran ne vide jamais seul.
- F791 : l'origine en mots (« saisi », « automatique, d'après … », « saisi
  et automatique ») ; un mot seulement sur les lignes d'« Aujourd'hui » et
  sans base dans l'historique ; réglage éteint, l'écran est celui d'avant.
- F792 : la bulle dit les jours, la base, le K_abri, les natures d'ET0, les
  jours sans valeur et la clôture (en cours, enregistrée, provisoire).
- F793 : « Adopter la proposition » est retiré seulement quand tous les
  jours suivent la culture, sans objectif saisi.
- F794 : la ligne de fiabilité compte les jours de la semaine en cours sans
  ET0 où le réglage est allumé ; elle compte dans la pastille du menu.
- F795 : l'avertissement avant de décocher « Objectifs et besoins » ne
  compte pas le réglage, qui reprend tel quel à la case recochée (la
  question qu'O3 laissait).
- F796 : les aides ne disent plus que l'ET0 n'entre jamais dans le
  besoin ; la démonstration garde le réglage éteint.

**Preuve.** `tests/objectif-automatique-ecrans.test.ts` (l'origine des cas
1 à 6, 9 et 11, la bulle, F790, F793, le résumé du volet, « Aujourd'hui »,
l'historique, le planning, F794), `tests/db/objectif-automatique-ecrans.test.ts`
(à deux fermes : le volet, le tableau des besoins, la pastille),
`tests/db/crop-water-bed-sheet.test.ts` (la fiche d'une planche qui suit
la culture, à deux fermes), `tests/planning-suggestions.test.ts` (la
raison d'une suggestion) et le parcours P58 aux deux largeurs (allumer,
lire l'origine, saisir un objectif qui passe avant, vider, éteindre).
Contre-épreuve : vingt-deux altérations (l'origine jamais dite, sans base,
« les deux » dit « automatique », la bulle sans natures, sans jours
manquants ou sans clôture, « Adopter » gardé ou proposé quand l'objectif
suit la culture, la fiche sans origine, les planches gardées de toutes
saisons, le groupe mêlé dit « automatique », l'historique toujours
« automatique », les jours sans ET0 comptés réglage éteint, la ligne de
fiabilité suivie réglage éteint ou menant ailleurs, « Aujourd'hui » sans
origine sur les lignes ou la tuile, le planning ou la suggestion sans
origine, le volet qui lit le premier geste, la pastille qui ignore
l'objectif automatique, le résumé du volet muet) font chacune échouer au
moins un test.

**Ne change pas.** Réglage éteint, aucun écran ne change, mot pour mot, et
aucune ferme ne l'allume sans son geste (D-028). La règle, les lecteurs et
les semaines closes (D-316 à D-318) sont lus, jamais changés.

## D-320 — Les heures de silence des notifications : le contrat, sans code

Date : 24 novembre 2026. Statut : **contrat écrit, sans code** ; roadmap
section 6 undecies, contrat `docs/heures-de-silence-contract.md`. Écrit en
Sonnet 5.5 · Moyen (grille du travail sans code). Les numéros D-317 à D-319
sont ceux des PR O2 à O4 de l'objectif automatique ; celui-ci est pris
au-dessus pour ne pas les disputer.

**Contexte.** L'idée « heures de silence des notifications » est rangée sans
engagement depuis le 7 novembre 2026 (D-065). Le porteur demande son
contrat le 24 novembre 2026 à 20 h 24 : « Lance le contrat, mais tu réponds à
toutes tes questions par tes propres recommandations. » Une alerte lue à
21 h 30 sonne aujourd'hui à 21 h 30, une fin d'arrosage à 3 h sonne à 3 h.

**Décision.** Dix choix faits par l'assistant sur son option recommandée
(contrat, section 2) : un réglage par ferme, éteint par défaut (D-028) ; une
plage de nuit de 20 h à 9 h au plus, au quart d'heure, heure de Paris
(D-004) ; dans la plage, une notification est **retenue** et part à la fin ;
passent toujours la fin d'un arrosage démarré et le gel (case cochée par
défaut) ; le rappel du soir qui tombe dans la plage ne part pas ; la veille
de l'exploitant est hors de la règle ; une alerte retenue n'est pas « non
délivrée » (C2, C3) avant la fin de la plage plus une heure ; **le Worker de
notification ne change pas**, la retenue étant une alarme à échéance par la
route existante. Trois PR de code, après O4 : règle et réglage, envoyeurs,
écran.

**À la main du porteur.** Aucune question agronomique réservée ni aucun
budget. Le gel qui passe par défaut est du côté prudent ; il peut le
renverser d'un mot avant le code.

**Ne change pas.** Aucun code, aucune migration, aucun écran ; toutes les
notifications arrivent comme avant, pour toutes les fermes, jusqu'à H3.
D-060 (priorité haute), D-293 (une alarme par espace), D-028 (rien ne
change sans le geste de la ferme) tiennent.

## D-321 — Les heures de silence, H1 : la règle et le réglage

Date : 24 novembre 2026. Statut : codé (PR H1 sur 3 du contrat
`docs/heures-de-silence-contract.md`, D-320, sections 3, 4 et 8) ; roadmap
section 6 undecies. Code en Opus 5.5 · Max, le réglage de la roadmap.
D-321 et les précisions F797 et suivantes sont pris au-dessus de ceux d'O4
(D-319, F789 à F796), pour ne pas les disputer.

**Décision.** La règle des heures de silence vit en un seul endroit du
domaine, une fonction pure (`lib/domain/notification-quiet-hours.ts`) :
pour une notification et l'instant où elle partirait, avec le réglage de
sa ferme, elle dit « part », « retenue jusqu'à » la fin de la plage ou
« ne part pas » (le rappel du soir), et le défaut quand c'en est un (S1 à
S7, S17) ; une seule fonction compose l'identifiant d'une retenue, propre à
l'espace (S10). Le réglage de chaque ferme s'ajoute à
`irrigation_phone_notice_settings` (migration additive 0049, quatre
colonnes vides lues pour leurs défauts : éteinte, 22 h à 6 h, le gel qui
passe), sous une contrainte des bornes de S1, au quart d'heure ;
`saveQuietHoursForUser` l'écrit, refuse un réglage hors des bornes avant
toute écriture et passe par le journal des modifications (ancre
`heures-de-silence`). Aucun envoyeur ne lit encore la règle (H2), aucun
écran ne l'allume (H3).

**Précisions tranchées en codant** (contrat, section 11).

- F797 : la règle juge l'instant où la notification partirait : l'heure
  de l'envoi immédiat, l'échéance d'une alarme programmée d'avance.
- F798 : l'ordre : la fin d'arrosage sans lire le réglage, même corrompu ;
  éteinte ; corrompue (S17) ; le gel ; hors de la plage ; le rappel du
  soir ; S7 ; la retenue. Le gel se lit à la nature de l'alerte et au
  champ et au sens du critère, jamais à un texte ni à un seuil.
- F799 : les treize heures de S7 se comptent sur l'horloge de Paris : la
  plage de 20 h à 9 h de la nuit du passage à l'heure d'hiver, quatorze
  heures réelles, n'est pas un défaut.
- F800 : seule une alerte (météo, par culture) prend l'identifiant de
  retenue « quiet: », l'espace, son étiquette, ou l'empreinte d'une
  étiquette trop longue ; le message du matin et le retard d'une
  irrigation gardent leur propre alarme, à échéance de fin de plage.
- F801 : une valeur écrite se lit telle quelle, jamais remplacée par un
  défaut (S17) ; deux gardes à l'écriture, le service et la contrainte, sur
  les mêmes listes de quarts d'heure.
- F802 : un geste écrit les quatre valeurs ensemble ; éteinte, la plage
  garde ses heures ; le journal ne dit que les champs changés.

**Preuve.** `tests/heures-de-silence.test.ts` (les heures offertes, les
défauts, les scénarios 1 à 14 et 17 du contrat, la nuit du passage à
l'heure d'hiver, S7, l'identifiant d'une étiquette longue accepté par le
Worker) et `tests/db/heures-de-silence.test.ts` (à deux fermes : défauts
sans rien écrit, chacune sa plage, aucun effet sur le message du matin ni
le rappel du soir, refus avant toute écriture, contrainte quart d'heure par
quart d'heure, scénario 17 en base, journal, effacement d'une ferme qui
laisse l'autre). Contre-épreuve : trente-cinq altérations (début exclu,
fin incluse, fin prise en ajoutant des heures UTC ou toujours au
lendemain ; réglage éteint ignoré ; fin d'arrosage qui lit le réglage ou
retenue ; case du gel ignorée, toujours ou jamais suivie ; gel sans la
minimale ou sans « en dessous de », séchage compté pour du gel ; rappel du
soir retenu, ou sauté hors de la plage ; S7 sans borne, comptée en temps
réel ou sans dire son défaut ; réglage corrompu remplacé par le défaut ou
sans dire son défaut ; identifiant ou empreinte sans l'espace, étiquette
longue non bornée ; bornes élargies d'un quart d'heure ; défauts allumé ou
gel retenu ; écriture sans contrôle des bornes, des seules cases ou qui
touche le message du matin ; lecture qui remplace un réglage corrompu ou
lit décochée la case du gel vide ; journal oublié ou à défaut faux) font
chacune échouer au moins un test.

**Ne change pas.** Aucune notification ne change, pour aucune ferme :
aucun envoyeur ne lit la règle et aucun écran ne l'allume ; la migration
ajoute quatre colonnes vides. Le Worker de notification ne change pas.
D-028, D-060 et D-293 tiennent.

## D-322 — Le menu change de page sans recharger le module

Date : 24 novembre 2026. Statut : **codée** ; roadmap section 6 duodecies,
contrat `docs/lenteur-du-module-contract.md` (N1). Écrite en Opus 5.5 ·
Élevé (correction sous contrôle des tests et des parcours). Les numéros D-319
et D-321 sont ceux d'O4 et de H1, en PR ; celui-ci est le suivant libre.

**Contexte.** Le 24 novembre 2026 à 22 h 33, le porteur trouve que le module
« rame », au téléphone comme à l'ordinateur : « l'ouverture, c'est le pire,
ensuite le moindre changement de page ». Mesuré sur une copie locale (contrat,
section 2) : les PR du jour n'y sont pour rien ; chaque clic du menu
recharge toute l'application, ses scripts et son écran, parce que ses liens
sont des liens simples.

**Décision.** Les liens du menu (menu de gauche, barre du bas, feuille
« Plus », encart « Aujourd'hui ») passent par le routeur de l'application
(`next/link`) : seule la page voulue est demandée au serveur. Rien n'est
demandé d'avance (`prefetch={false}`) : lire d'avance les pages de la barre
doublait le temps d'ouverture mesuré. Ce qu'un chargement donnait reste
vrai : un menu neuf à chaque page (feuille « Plus » refermée, pastille
relue), l'adresse nettoyée, le titre de l'onglet ; le clavier repart du
contenu de la nouvelle page. Parcours P59.

Pour une page demandée par le routeur, vinext 1.0.1 appelle la page une
première fois pour y chercher une redirection, puis la rend : chaque lecture
se faisait deux fois, et « Aujourd'hui » par le menu devenait plus lente
qu'avec le rechargement. Chaque page du module est donc calculée une fois par
requête (`app/irrigation/render-once.ts`, `cacheForRequest` de vinext) ;
mesuré, chaque page de la barre du bas devient utilisable plus tôt
qu'avant, « Aujourd'hui » comprise (contrat, N1).

**Ne change pas.** Aucun calcul, aucune donnée, aucune migration, aucun texte ;
les autres liens restent des liens simples (un geste à la fois). Les deux
autres freins, l'ouverture en deux pages (N2) et les lectures répétées de la
base (N3), ont leurs PR.

## D-323 — L'adresse de départ mène à la page d'arrivée sans attendre les scripts

Date : 24 novembre 2026. Statut : **codée** ; roadmap section 6 duodecies,
contrat `docs/lenteur-du-module-contract.md` (N2). Écrite en Opus 5.5 ·
Élevé.

**Contexte.** Le porteur trouve l'ouverture du module la plus lente (D-322).
L'application installée s'ouvre sur `/irrigation` (D-302), qui montrait
« Ouverture du module… », attendait que tous les scripts soient chargés et
l'écran repris, puis rechargeait vers la page d'arrivée : deux pages pour une.

**Décision.** Sans ancre, `/irrigation` porte un script lu avec la page qui
conduit aussitôt à la page d'arrivée (saison, semaine et « Actualiser » de
l'adresse gardés). Avec une ancre (anciennes notifications), la conduite reste
celle du navigateur, inchangée (P14). Le manifeste ne change pas : les
applications déjà installées en profitent. Parcours P59, scripts refusés.

**Ne change pas.** Aucune donnée, aucun calcul, aucun texte ; une redirection
côté serveur a été écartée, parce que le serveur ne voit pas l'ancre et
perdrait la conduite des anciennes notifications.

## D-324 — Les heures de silence, H2 : les envoyeurs

Date : 24 novembre 2026. Statut : codé (PR H2 sur 3 du contrat
`docs/heures-de-silence-contract.md`, D-320, sections 3, 5 et 8) ; roadmap
section 6 undecies. Code en Opus 5.5 · Max, le réglage de la roadmap. Les
précisions F803 et suivantes suivent celles de H1 (D-321, F797 à F802).

**Décision.** Les cinq envoyeurs lisent la règle de H1, chacun avec le
réglage de sa ferme, à l'instant où sa notification partirait (F797) : les
alertes météo et par culture, le message du matin, le rappel du soir et le
retard d'une irrigation planifiée. Une alerte retenue part par une alarme
du Worker, sous l'identifiant de l'espace et de son étiquette, à échéance
de la fin de la plage, même texte ; elle est enregistrée à son heure,
« envoyée », avec la fin de sa retenue (migration additive 0050,
`held_until` sur les deux tables d'alertes), et l'historique la dit
« Retenue jusqu'à 6 h (heures de silence) », puis « Envoyée à 6 h, à la fin
des heures de silence ». Le message du matin et le retard gardent leur
propre alarme, à échéance de la fin de la plage ; le rappel du soir dans la
plage ne part pas, n'est pas retenu et ne compte pas la ferme en panne ;
la fin d'un arrosage démarré et la veille ne lisent pas le réglage. Une
retenue refusée part tout de suite et un réglage illisible ne retient
rien, l'incident dit sans nom (S8). Le Worker de notification ne change
pas.

**Précisions tranchées en codant** (contrat, section 12).

- F803 : une retenue gardée (`scheduled`) ou déjà tenue par une retenue
  plus récente de la même étiquette (`stale`) retient l'alerte ; le
  réglage est lu une fois par évaluation, au premier envoi qui en a
  besoin.
- F804 : le Worker ne disant jamais ce que devient une alarme, une retenue
  gardée compte comme envoyée (F745) ; pas de valeur nouvelle dans l'état
  de remise ; le suivi C2/C3 ne compte jamais une retenue (choix 8).
  Limite : le scénario 15 (une retenue sans appareil, « non délivrée »)
  n'est pas tenu sans changer le Worker.
- F805 : le message du matin retenu part tel que composé au calcul du
  matin ; une retenue refusée le fait partir tout de suite, même alarme,
  même révision, sans doublon.
- F806 : le rappel du soir se juge à l'heure réelle de son passage (chaque
  heure à 5 minutes) ; l'avertissement de H3 suivra la même heure.
- F807 : le retard se juge à son échéance ; dans la plage, son alarme a
  pour échéance la fin de la plage, la base garde l'échéance d'origine.
  Limite pour H3 : l'enregistrement du réglage reprogrammera les retards à
  venir.
- F808 : un retard échu mais encore retenu n'est pas parti : décocher
  Arrosages le retire ; un réglage illisible n'arrête pas le retrait.
- F809 : le journal dit la retenue refusée, le réglage illisible, le
  défaut, le message du matin retenu et les rappels tus, sans nom.

**Preuve.** `tests/db/heures-de-silence-alertes.test.ts` et
`tests/db/heures-de-silence-messages.test.ts`, à deux fermes et Worker
simulé, verts dans les passes ordinaire, d'isolation des fermes, des
personnes et du rattachement, et de l'ancien calcul de la jauge.
Contre-épreuve : quarante altérations (la retenue qui envoie quand
même, `stale` compté comme échec, une retenue refusée comptée retenue,
l'incident non dit, l'identifiant sans l'espace, la retenue à échéance
immédiate, le défaut ou le réglage illisible non dits, le réglage illisible
qui fait échouer l'évaluation ; le champ ou le sens du critère météo non
transmis ; tout ou rien compté pour du gel par culture ; la fin de retenue
non enregistrée ou la retenue enregistrée sans appareil, météo et
cultures ; le matin jamais retenu, sans repli, dit envoyé au journal ou
sans dire son défaut ; le rappel du soir envoyé dans la plage, compté en
panne ou sans dire son défaut ; le retard jamais retenu ou jugé à la
programmation, la fin d'un minuteur qui lit le réglage, le retard sans
dire son défaut ni le réglage illisible ; le retrait qui oublie un retard
retenu, retire tout retard passé ou ignore la fin de la plage, la liste qui
ne garde plus les retards échus, le retrait arrêté par un réglage
illisible ou qui ne le dit pas ; l'affichage qui dit retenue jusqu'à la
fin comprise ou oublie la retenue, météo et cultures ; la base qui
n'écrit pas la fin de retenue, météo et cultures) font chacune échouer au
moins un test.

**Ne change pas.** Aucune notification ne change, pour aucune ferme :
aucun écran n'allume la plage (H3), et une plage éteinte ou jamais réglée
ne change rien (S2) ; la migration ajoute deux colonnes vides. Le Worker de
notification et la veille de l'exploitant ne changent pas. D-028, D-060,
D-293 et D-321 tiennent.

## D-325 — La lenteur du module, N3 : l'espace lu une fois par requête

Date : 24 novembre 2026. Statut : **codée** ; roadmap section 6 duodecies,
contrat de la tranche 4, section 5 sexies (F810 à F816), où renvoie
`docs/lenteur-du-module-contract.md` (N3). Écrite en Opus 5.5 · Max, le
réglage de la roadmap (résolution de l'espace d'une ferme, donc isolation).
D-323 et D-324 sont ceux de N2 et de H2, en cours ; celui-ci est le suivant
libre.

**Contexte.** Le 24 novembre 2026 à 22 h 33, le porteur trouve que le
module « rame », l'ouverture surtout, puis chaque changement de page.
Mesuré en local avant le code : pour ouvrir « Aujourd'hui », le serveur
lisait 57 fois l'identifiant du même espace, 12 fois son accueil et 8 fois
sa préférence météo, une fois par service qui les demande.

**Décision.** Une mémoire par requête (`db/request-memo.ts`), que
l'interface fournit (`app/request-memo.ts`, `cacheForRequest` de vinext) :
pendant une requête, l'identifiant de l'espace d'une personne et d'une
ferme ne se lit qu'une fois ; le choix des fonctionnalités, l'accueil et la
préférence météo d'un espace non plus, une copie par appelant ; la personne
connectée se vérifie une fois par rendu de page (`cache` de React).

**Précisions** (contrat de la tranche 4, section 5 sexies).

- F810 : une mémoire par requête, page, action ou route, les deux passages
  de vinext compris ; rien d'une requête à l'autre ni dans le Worker ; hors
  d'une requête, chaque lecture va à la base comme avant.
- F811 : rangée par la personne et la ferme ensemble, comme le filtre des
  requêtes (F327) ; une lecture de service, par son nom et tous ses
  arguments.
- F812 : toute instruction qui n'est pas une lecture, un lot qui en
  contient une et `exec` la vident à leur début et à leur fin, même en
  échec ; une lecture qui croise une écriture n'est pas gardée.
- F813 : l'absence d'un espace et une lecture en échec ne restent pas.
- F814 : trois lectures de service gardées, une copie par appelant ;
  jamais le compteur des appels à OTF ni le dépôt que la démonstration
  relit.
- F815 : la personne connectée, une fois par rendu de page et par valeur
  de `allowFrozen` ; hors d'un rendu, à chaque appel.
- F816 : les preuves, ci-dessous.

**Preuve.** `tests/db/memoire-de-requete.test.ts` (quinze tests), rejoué
dans les quatre passages d'isolation : une lecture par clé même en
parallèle, deux fermes dans une requête, deux requêtes simultanées, rien
après ni hors d'une requête, l'absence, l'échec, la lecture qui croise une
écriture, le rattachement, la mise de côté et l'effacement, les lectures de
service, vinext lui-même avec trois changements de page simultanés.
Contre-épreuve : une clé sans la ferme, une mémoire commune au Worker et
une écriture qui ne vide plus la mémoire font chacune échouer des tests.
Les tests d'isolation existants restent verts.

**Mesure.** Après N1, en local, 20 ms ajoutées à chaque lecture :
« Aujourd'hui » passe de 176 à 98 lectures de la base à l'ouverture
(l'espace, de 58 à 2) et de 176 à 100 par le menu ; les treize pages du
menu, de 894 à 460 et de 894 à 485 ; « Aujourd'hui » s'ouvre en 0,72 s au
lieu de 1,25 s (un seul essai). Le temps gagné en ligne reste à mesurer.

**Ne change pas.** Aucun calcul, aucune donnée, aucune migration, aucun
texte, aucun réglage de Cloudflare ; une tâche sans requête lit la base
comme avant ; toutes les fermes voient les mêmes pages, plus vite. Les
règles de l'isolation (F327, F331, F647) tiennent.

## D-326 — Les heures de silence, H3 : l'écran

Date : 25 novembre 2026. Statut : codé (PR H3 sur 3 du contrat
`docs/heures-de-silence-contract.md`, D-320, section 4) ; roadmap section
6 undecies. Code en Opus 5.5 · Élevé, le réglage de la roadmap, sur le mot
du porteur du 25 novembre 2026 (« Code l'écran des heures de silence. »).
Les précisions F817 et suivantes suivent celles de N3 (D-325, F810 à F816).

**Décision.** Le pli « Messages de la ferme » de « Réglages » porte la case
« Heures de silence » ; allumée, le début, la fin et la case « Laisser
passer les alertes de gel ». Chaque geste enregistre aussitôt les quatre
valeurs (F802), au journal des modifications ; un échec remet l'écran comme
avant et le dit. La phrase dit ce qui passe toujours et ce qui attend ;
trois avertissements, sans bloquer l'enregistrement. La ligne du pli dit le
réglage ; l'ancre `#heures-de-silence` ouvre le pli. L'enregistrement
reprogramme les retards d'irrigation encore à venir de la ferme (F807).

**Précisions tranchées en codant** (contrat, section 13).

- F817 : le réglage se montre pour toute ferme qui reçoit des
  notifications (cases 2, 4, 8 ou 9), pas seulement avec le Planning ou les
  Arrosages : les alertes météo et par culture se retiennent aussi. Rien en
  démonstration, où les notifications sont coupées (F455). Éteinte, la
  plage cache ses heures et les garde.
- F818 : le Worker de notification ne dit pas combien d'appareils une
  ferme a, et il ne change pas (choix 9) : la ligne « aucun appareil » se
  lit à la dernière alerte météo ou par culture partie tout de suite ; une
  retenue, un échec ou une nouvelle tentative n'y comptent pas. Une ferme
  qui n'a jamais envoyé d'alerte ne voit pas la ligne.
- F819 : l'avertissement du rappel du soir juge le premier passage horaire
  (hh:05) qui suit l'heure réglée (F806), se relit sans recharger quand
  l'heure du rappel change dans le même pli, et ne paraît que plage
  allumée, rappel activé et Arrosages cochée.
- F820 : à l'enregistrement, chaque retard à venir reçoit l'échéance que la
  plage nouvelle lui donne ; un retard échu que la plage d'avant retenait
  encore part tout de suite si la plage nouvelle ne le retient plus ; un
  retard déjà parti, la fin d'un minuteur ou une échéance inchangée
  n'envoient rien. Un retard qui n'a pas pu suivre garde son échéance
  d'avant, le réglage reste enregistré, l'écran et le journal le disent.
- F821 : le parcours P60, aux deux largeurs, allume, règle, lit
  l'avertissement du rappel et éteint.

**Preuve.** `tests/heures-de-silence-ecran.test.ts` (les phrases et
l'avertissement, chaque heure du rappel contre chaque début) et
`tests/db/heures-de-silence-ecran.test.ts` (à deux fermes et Worker simulé :
la reprogrammation, le retard retenu qui part quand la plage s'éteint, le
refus du Worker, le réglage d'avant illisible, la fin d'un minuteur, la
ligne « aucun appareil »), verts dans les passes ordinaire, d'isolation des
fermes, des personnes et du rattachement, et de l'ancien calcul de la
jauge ; parcours P60. Contre-épreuve : trente altérations de l'écran, de la
reprogrammation et de la ligne « aucun appareil » font chacune échouer au
moins un test.

**Ne change pas.** Une ferme qui n'allume pas la plage ne voit aucune
notification changer (S2). Le Worker de notification ne change pas ;
aucune migration. D-028, D-320, D-321 et D-324 tiennent.

## D-327 — Simplifier l'usage du module : trois endroits, deux niveaux, un chemin, en six lots

Date : 25 novembre 2026. Statut : **décidé**, rien n'est codé ; roadmap section
6 terdecies, contrat du premier lot `docs/simplification-s1-contract.md`.
Écrite en Sonnet 5.5 · Moyen (registres et contrat sans code). Le diagnostic
a été fait exceptionnellement en Fable, à la demande expresse du porteur, pour
ce seul travail ; D-055 tient pour tout le reste.

**Contexte.** Le 25 novembre 2026 à 9 h 26, le porteur trouve le logiciel
« très complexe à utiliser ». Le diagnostic
(`/mnt/project-files/audit-ergonomie/diagnostic-simplicite-2026-11-25.md`,
sans code, sur `main` ecddc14, complété sur la ferme réelle dans le Chrome du
porteur, en lecture seule) relève sept causes : un rangement par type de
donnée (treize pages au même rang), tout au même niveau (« Aujourd'hui » :
5 123 px et 66 chiffres sur la ferme réelle), les mots du calcul, des
réglages à quatre endroits, une première ouverture à onze cases, un chapeau
d'un tiers d'écran, un même chiffre qui change d'une page à l'autre.

**Décision.** Le porteur répond « oui » aux quatre choix posés un par un
(cartes de décision, 25 novembre 2026, 11 h 59 à 12 h 01) :

1. **Trois endroits** : Aujourd'hui, Semaine, Ma ferme ; un bouton « + » pour
   arroser maintenant, noter la pluie, noter un arrosage déjà fait.
2. **Sur « Aujourd'hui », un seul bouton qui change de nom** (Valider,
   Démarrer, Terminer) : un arrosage se valide et se démarre depuis sa carte,
   sans passer par le planning. **Change** `docs/aujourdhui-tableau-de-bord-contract.md`
   et la règle « une proposition se valide au planning » ; le contrat du lot
   S2 dit comment, et prévoit l'arrosage « à rattraper ».
3. **À la première ouverture, trois façons de commencer** à la place des onze
   cases, qui restent dans « Ma ferme ». **Change** l'écran de bienvenue du
   contrat 3.8 (`docs/feature-selection-contract.md`) ; le contrat du lot S6
   dit comment.
4. **Les mots du tableau** (diagnostic, cause 3) **tels que proposés**, et le
   lot S1 d'abord.

**Les six lots**, un contrat avant chaque code, une PR par point, enchaînés
sans nouveau « vas-y » (consigne du porteur du 25 novembre 2026) : S1 chapeau
et mots, S2 « Aujourd'hui » où l'on fait tout, S3 trois endroits, S5 arroser
en trois champs, S4 la semaine sur une page, S6 mise en route guidée.

**Réglages** (grille, quatre critères) : contrats en Sonnet 5.5 · Moyen ;
code en Opus 5.5 · Élevé pour S1, S2 et S5 (écrans sous contrat, les tests
jugent), Opus 5.5 · Très élevé pour S3, S4 et S6 (refonte de l'organisation
de tout le module, contexte étendu). Jamais Fable.

**Garde-fous.** Aucun calcul, aucune règle d'agronomie, aucune donnée ni
migration ne change ; aucune fonction n'est retirée ; les fonctionnalités à la
carte restent ; la charte graphique reste. Logiciel multi-fermes : les trois
endroits sont ceux de toute ferme, quelle que soit sa taille. Un contrat
validé (« Aujourd'hui », menu, planning, besoins, historique, bienvenue) ne
change que par le contrat du lot qui le touche.

**Point ouvert S1-O1, non examiné.** Sur la ferme réelle, « Objectifs et
besoins » dit « objectif 2,7 mm · irrigué 2,8 mm » quand « Aujourd'hui » dit
5,2 mm et 2,1 mm et « Historique » 5,2 mm, la même semaine. La PR 3 du lot S1
en établit la cause avant toute modification.

**Précisions du lot S1** : voir le contrat (F822 et suivantes), qui prendra
D-328 par sa première PR.

**Non vérifié.** Le toucher, la vitesse et la lecture au soleil sur un vrai
téléphone ; la proposition elle-même n'a pas été essayée par un maraîcher
(cinq tâches conseillées au premier volontaire du pilote avant S3 et S4).

## D-328 — Simplifier l'usage du module, lot S1 : le chapeau et les mots

Date : 25 novembre 2026. Statut : **PR 1, PR 2 et PR 3 sur 3 codées** (le
chapeau d'une ligne, les mots, un seul objectif ; l'Historique suit par la
PR 3 bis, codée le même jour, D-329) ; contrat `docs/simplification-s1-contract.md`, roadmap section 6
terdecies, ligne 33. Code en Opus 5.5 · Élevé, le réglage de la roadmap,
sur le mandat du porteur du 25 novembre 2026 (enchaîner les lots sans
nouveau « vas-y », D-327). Les PR 2 (les mots) et 3 (un seul objectif)
compléteront cette décision.

**Décision (PR 1).** Le chapeau de chaque page tient en une ligne : le
titre, son « ? » et, là où elle sert, la saison. La ligne de lecture
d'Ouvre ta ferme ne se montre que si la lecture a échoué ou date de plus de
24 heures (F822) ; « Actualiser » et la date de la dernière lecture réussie
sont toujours dans le menu du compte (F823). La saison quitte « Arrosages »
(F824) et reste dans l'adresse ; « Historique et cumuls » ouvre les autres
saisons (F825). Les explications fixes de tête de dix pages passent dans le
« ? », qui dit ce qu'elles disaient (F826) ; l'inventaire page par page et
les positions avant et après sont dans la section 9 du contrat.

**Précisions tranchées en codant** (contrat, section 9.3).

- F829 : les données de démonstration ne viennent d'aucune lecture d'Ouvre
  ta ferme : la ligne de lecture ne s'y montre jamais ; le menu du compte
  dit « Données de démonstration » avant la date.
- F830 : une phrase fixe qui met en garde (la prévision prise à 2 m, les
  seuils de gel qui ne sont que des repères) reste en place ; seule
  l'explication de ce que montre la page passe dans le « ? ».
- F831 : « Actualiser les données d'Ouvre ta ferme » au-dessus de « Se
  déconnecter », la date dessous ; l'avis se calcule côté serveur, une date
  illisible compte comme ancienne (D-003).

**Preuve.** `tests/simplification-s1.test.ts` (la règle de la ligne de
lecture à chaque âge et chaque source, le gabarit et le menu du compte, la
saison page par page, les dix explications déplacées et ce que dit chaque
« ? », les mises en garde gardées) ; parcours P61 aux deux largeurs, et P27,
P28 et P31c suivis. Contre-épreuve : voir la PR.

**Ne change pas.** Aucun calcul, aucune donnée, aucune migration, aucune
adresse ; `?refresh=1` et son nettoyage, le bloc « Données en cache », les
liens existants et les notifications gardent leur effet. Logiciel
multi-fermes : la règle vaut pour toute ferme, quelle que soit sa taille.

**Décision (PR 2, les mots).** Le premier niveau (titres, boutons, phrases
d'en-tête, étiquettes des tuiles) dit les mots du tableau accepté tel quel
par le porteur (D-327). Ils vivent en un seul endroit,
`lib/domain/simple-words.ts`, que l'interface appelle sans recopier ; le
mot du calcul (RFU, ET0, culture de référence, apport horaire) reste dans
le « ? », dans le détail d'une tuile et dans les bulles « d'où vient ce
chiffre ». Gardent leurs mots (F828) : les identifiants, les adresses,
l'en-tête de l'export CSV, les notifications, le journal des modifications
(le nom du réglage tel qu'enregistré) et deux erreurs techniques. Le relevé
mot par mot et ce que chacun devient : contrat, section 9.4.

**Précisions tranchées en codant** (contrat, section 9.5).

- F832 : la liste des espèces s'intitule « À quelle culture ressemble
  chaque espèce ? », le choix d'une espèce garde « … cette espèce ? ».
- F833 : l'ET0 se dit « soif du jour », « de la semaine » ou « de la
  période » selon la tuile ; « ET0, l'évaporation de référence » dans le
  détail ; le tableau des jours et le suivi par série gardent « ET0 ».
- F834 : le tableau ne nomme aucune page : les noms du menu ne changent
  pas ; leur rangement est S3.
- F835 : « réanalyse » et « historisé », au premier niveau, sont dits
  « pluie estimée par la météo », « estimée », « Non enregistré » ; ils
  restent dans les causes d'écart et les replis de diagnostic.
- F836 : « ce qui reste » d'un arrosage arrêté, « Reprendre ce qui reste »,
  « Annuler ce qui reste », « Un arrosage arrêté est à reprendre ».
- F837 : « RFU » s'explique toujours à sa première occurrence d'une page
  (F312), par le mot du tableau : « Ce que le sol de la parcelle retient
  (sa RFU) ».

**Preuve (PR 2).** `tests/simplification-s1-mots.test.ts` : le tableau des
mots, le test de garde sur `app/` et `lib/domain/` (les endroits permis
écrits avec leur raison, une permission devenue inutile échoue), seize
usages pris dans le module sans recopie, l'ET0 dans le détail, l'écran de
bienvenue et la visite guidée ; parcours P61 étendu (les mots du tableau
lus, aucun mot du calcul visible d'emblée sur les douze pages) ; seize
parcours relus avec les nouveaux libellés. Contre-épreuve : voir la PR.

**Cause du point S1-O1 (PR 3), établie dans le code.** Ce n'est pas une
moyenne sans pondération : les deux pages pondèrent par la surface. La
ligne de résumé et la tuile « Objectif ferme » d'« Objectifs et besoins »
affichaient l'objectif « Toute la ferme » **saisi**, un réglage que
l'objectif d'un jardin ou d'une planche remplace là où il est posé ;
« Aujourd'hui » fait la moyenne pondérée des objectifs **applicables** de
chaque planche (`objectiveForBed`). Sur la ferme réelle, 2,7 mm sont
vraisemblablement l'objectif saisi pour toute la ferme, et 5,2 mm la
moyenne avec des objectifs plus hauts posés sur des jardins : déduit du
code et rejoué en test, pas relu sur la ferme réelle. C'est la
première issue du contrat (un autre périmètre) : on aligne. L'irrigation
diffère aussi (2,8 mm contre 2,1 mm) : « Objectifs et besoins » répartit le
volume sorti des pompes sur toute la surface des planches, « Aujourd'hui »
pondère l'eau que chaque planche a reçue ; les deux disent ce qu'ils
comptent, rien ne change (contrat, section 9.6).

**Décision (PR 3).** Un seul calcul de l'objectif de la ferme :
`lib/domain/farm-objective.ts`, la moyenne pondérée par la surface sur les
planches qui ont un objectif, les autres comptées à voix haute (« 7
planches sur 10 ont un objectif »), jamais à zéro. Une seule phrase :
« 5,2 mm visés, ferme entière ». « Aujourd'hui » (la semaine de la ferme et
de chaque jardin) et « Objectifs et besoins » (la ligne de résumé et la
tuile « Eau visée cette semaine », lues sur les besoins de la semaine
affichée) l'appellent ; le planning ne dit pas d'objectif de ferme. Rien ne
change dans le besoin, l'écart, l'ET0 ni l'objectif automatique.

**Preuve (PR 3).** `tests/simplification-s1-objectif.test.ts` : deux
fermes (toutes les planches avec objectif, de surfaces différentes ; une
partie seulement), le cas S1-O1 rejoué (« Toute la ferme » 2,7 mm, un
jardin à 7 mm : 5,9 mm visés), « Aujourd'hui » et la ligne des besoins avec
le même chiffre et la même phrase, aucune page qui refait la moyenne.
Parcours P61 étendu. Contre-épreuve : voir la PR.

## D-329 — L'Historique compte l'objectif comme « Aujourd'hui »

Date : 25 novembre 2026, 13 h 35. **Décision du porteur** (« ok pour
l'historique »), sur la question posée par la PR 3 du lot S1 (D-328), avec
l'option recommandée. Statut : **codée le 25 novembre 2026 par la PR 3 bis
du lot S1**, en Opus 5.5 · Max (contrat `docs/simplification-s1-contract.md`,
sections 5 bis et 9.7). Elle remplace D-036 sur un point : l'objectif d'une
période ne compte plus à zéro les planches sans objectif. Comme
« Aujourd'hui », il est la moyenne pondérée par la surface sur les seules
planches qui ont un objectif sur la période, et la page dit combien n'en
ont pas ; une seule période sur une seule semaine donne le même chiffre que
« Aujourd'hui ». Le reste de D-036 tient : un objectif posé en cours de
semaine vaut pour ses jours restants, et une période sans aucun objectif est
sans objectif ni écart.

**Pourquoi.** Le but du lot S1 : un seul objectif, le même chiffre sur
chaque page (contrat, section 5). Sur la démonstration, la même semaine,
« Aujourd'hui » disait 23,4 mm et « Historique » 16,5 mm.

**Comment.** Une règle de calcul sensible (l'objectif et l'écart d'une
période) : une PR à part, la PR 3 bis du lot S1, en Opus 5.5 · Max (contrat,
section 10), dans un fil à part, après la PR 3. L'écart d'une période se
redéfinit avec elle sur le même périmètre ; la PR 3 bis l'écrit avant le
code.

**Décision (PR 3 bis).** L'objectif d'une période, dans la vue « Par
lieu » comme dans la vue « Par série », est la moyenne pondérée par la
surface sur les seules planches qui ont un objectif sur la période, par la
fonction unique de la PR 3 (`farmObjective`) ; une planche en a un dès
qu'un de ses jours en a un, même de 0 mm. L'écart reste « objectif moins
irrigation et pluie réelles » ; quand une partie seulement des planches a
un objectif, cette eau est celle de ces seules planches, comme
« Aujourd'hui » chiffre l'eau reçue (F280) ; quand toutes en ont un, il
est celui d'avant. Sous la carte « Objectif » : « 7 planches sur 10 ont un
objectif », puis « objectif posé sur 40/49 journées-planche » quand des
jours leur manquent ; sous l'écart, « Eau reçue par ces 7 planches :
12,4 mm » ; la phrase « … comptées à 0 » (F444) disparaît. L'export CSV
garde ses colonnes : « Irrigation + pluie réelle » est l'eau que l'écart
compare. Les cumuls du périmètre (volume, apport, surface, pluie, soif) ne
changent pas.

**Preuve (PR 3 bis).** `tests/simplification-s1-historique.test.ts` : deux
fermes (chaque planche avec un objectif, 17,5 mm et un écart de 2,5 mm
comme avant ; une partie seulement, 28,5 mm au lieu de 5,7 et l'écart de
16,5 mm sur l'eau de la serre), les jours manquants, le retrait, le zéro,
deux semaines, une semaine égale à « Aujourd'hui » sur onze cas (objectifs
posés en cours de semaine, retirés, automatiques) à trois niveaux, l'export
CSV ; la vue « Par série » dans `tests/series-water.test.ts`.
`tests/db/simplification-s1-historique.test.ts` : Alice et Bob, l'Historique,
« Objectifs et besoins » et « Aujourd'hui » lus ensemble, les quatre
passages d'isolation. `tests/db/simplification-s1-historique-demo.test.ts` :
chaque ferme de démonstration à chaque moment (la Ferme des Trois Noues au
début de l'été : 23,4 mm, 7 planches sur 10). Parcours P61 étendu.
Contre-épreuve : treize altérations, chacune prise par au moins un test.

## D-330 — Simplifier l'usage du module, lot S2 : « Aujourd'hui » où l'on fait tout

Date : 25 novembre 2026. Statut : **PR 1 à 5 sur 5 codées** (valider et
démarrer, terminer et reprendre, l'arrosage à rattraper, noter la pluie, la
page à l'essentiel) ;
contrat `docs/simplification-s2-contract.md`, roadmap
section 6 terdecies, ligne 33. Code en Opus 5.5 · Élevé, le réglage de la
roadmap et du contrat (section 15), sur le mandat du porteur du 25 novembre
2026 (enchaîner les lots sans nouveau « vas-y », D-327). Elle met en œuvre le
choix n° 2 du porteur (« Oui, tout depuis la carte », 25 novembre 2026,
12 h 00) ; les PR 2 à 5 la compléteront.

**Décision (PR 1).** Une carte de « Votre journée » porte un seul bouton
principal, un geste d'appoint au plus et un seul « Autres choix ». Une
proposition du plan : « Valider », « Démarrer tout de suite » dessous, et
dans « Autres choix » « Changer l'heure ou la dose » (le formulaire
« Ajuster » du planning, S2-d) et « Pas à cette heure » (le refus du
planning, D-030, S2-b). Une irrigation planifiée à venir : « Démarrer », et
« Modifier ou annuler sur « Arrosages » » rangé. La règle vit dans
`lib/domain/today/card-action.ts`, que la carte dessine sans rien décider.
« Valider » est la même action que sur le planning
(`validatePlanProposalsAction`, pour une proposition), donc les mêmes
gardes ; « Démarrer tout de suite » valide puis démarre par les deux
actions existantes, et un démarrage refusé laisse l'arrosage validé et
planifié, le message le dit (S2-c). Le planning ne change pas ; « Valider au
planning » disparaît (L3, règle 5, réécrite : rien n'est validé par un
lien, D-028 tient).

**Précisions tranchées en codant.**

- F838 : sans « Arrosages » cochée, l'entrée rangée d'une irrigation
  planifiée dit « Ouvrir sur « Planning de la semaine » » : le nom du menu,
  où sa carte s'ouvre.
- F839 : la validation rend aussi l'irrigation créée par son matériel
  (`eventEquipmentId`, en plus de l'événement) : la réponse se lit sous la
  nouvelle carte et le focus va à son « Démarrer ». Un ajout de donnée au
  résultat du service, aucune règle changée.
- F840 : une réserve de la validation (« faisabilité hydraulique non
  vérifiée », « ce matériel a déjà une irrigation sur ce créneau ») suit
  « Validé : l'arrosage est planifié. » dans la même réponse, sous la carte.
- F841 : « Pas à cette heure » se confirme par « Pas à cette heure ? — Le
  module cherchera une autre place pour cet arrosage. », « Chercher une
  autre place » en rouge et « Garder la proposition » ; la réponse dit
  « Heure refusée : le module cherche une autre place pour cet arrosage. »,
  en tête de « Votre journée » quand la carte est partie.
- F842 : « Démarrer tout de suite » est un bouton au dessin d'un lien
  (souligné, sans fond), pas un lien : il écrit, et rien ne s'écrit par un
  lien (D-028).
- F843 : les irrigations en retard ou non faites gardent « Fait comme
  prévu », « Démarrer maintenant » et « Ouvrir » jusqu'à la PR 3 du lot,
  qui leur donne leur carte (contrat, section 4).

**Preuve (PR 1).** `tests/simplification-s2-carte.test.ts` : la règle pour
chaque carte, un seul bouton principal, jamais un lien pour valider ou
démarrer, les réponses (validation, réserve, refus de garde, démarrage
refusé après validation, refus), la composition valider-puis-démarrer sur
des étapes simulées, la réponse qui suit sa carte, « Autres choix » au
clavier. `tests/db/simplification-s2-carte.test.ts` : la composition sur les
vrais services, à deux fermes (validée et planifiée, un second appui
refusé, la limite journalière qui refuse sans rien créer, « Démarrer tout de
suite » réussi puis refusé sur le même matériel qui coule, Bob qui ne valide,
ne démarre ni ne refuse rien d'Alice). Parcours P62 aux deux largeurs ; les
tests qui lisaient « Valider au planning » suivent. Contre-épreuve : voir la
PR.

**Ne change pas.** Aucune règle de validation, de démarrage ni de refus,
aucun calcul, aucune donnée, aucune migration ; le planning et « Arrosages »
gardent tous leurs gestes ; les notifications gardent leurs mots.

**Décision (PR 2).** Ce qui coule ou attend d'être repris, en tête de « Votre
journée », a sa carte à un bouton (contrat, sections 3 et 6). Une irrigation
en cours : « Terminer », et dans « Autres choix » « Mettre en pause » (S2-i)
et « Ouvrir sur « Arrosages » ». En pause : « Reprendre », « Terminer »
dessous. Durée atteinte : « Terminer ». Ce qui reste d'un arrosage arrêté :
« Reprendre ce qui reste ». « Terminer » ouvre, sur la page même, la fenêtre
de fin d'« Arrosages » (`FinishIrrigationDialog`) : la vanne à vérifier,
l'heure réelle pré-remplie comme là-bas (maintenant, ou l'heure de la pause),
puis `finishIrrigationEventAction`. La pause et la reprise sont
`pauseIrrigationEventAction` et `resumeIrrigationEventAction` ; la pause ne
fait pas recalculer le plan (3.7, règle 5). La règle est `todayNowActions`
dans `lib/domain/today/card-action.ts`. Une irrigation arrêtée en route
devient ce qui reste, la réponse « L'irrigation partielle a été enregistrée.
Ce qui reste est planifié. » sous sa carte, le focus sur « Reprendre ce qui
reste » : le matin se fait de bout en bout sans quitter « Aujourd'hui ».

**Précisions tranchées en codant (PR 2).**

- F844 : la fenêtre de fin reçoit le nom du matériel au lieu de la fiche
  entière ; « Arrosages » lui passe ce nom. Un changement de signature, sans
  changement de comportement sur « Arrosages » (contrat, section 6, la seconde
  voie : la fenêtre reçoit les valeurs).
- F845 : sur « Aujourd'hui », la fenêtre se ferme à la réponse, réussie ou
  refusée : le motif d'un refus se lit sous la carte (L4), jamais caché
  derrière la fenêtre. Sur « Arrosages », elle reste ouverte comme avant.
- F846 : le compte à rebours d'une irrigation qui coule dit « Reste 52 min »,
  à la minute supérieure, lu sur le minuteur existant
  (`remainingTimerSeconds`) à l'heure du navigateur, relue toutes les quinze
  secondes ; jamais au rendu du serveur, pour ne pas écrire deux heures
  différentes. La « fin prévue à » reste dans le détail ; le « 8 mm au total »
  de la maquette attend la PR 5, qui range la carte.
- F847 : la durée atteinte dit « Fermez la vanne, puis appuyez sur
  « Terminer ». » sous la carte ; le détail ne répète plus « fermer la
  vanne ».
- F848 : « Reprendre ce qui reste » (le mot de S1, F836) remplace « Reprendre
  le reliquat » du contrat. L'abandon de ce qui reste se fait sur
  « Arrosages », par « Ouvrir sur « Arrosages » » rangé dans « Autres choix ».
- F849 : le lien « Terminer l’irrigation » de la carte (lot K, F473), qui
  menait à « Arrosages », disparaît : la carte dit « Terminer » (contrat,
  section 3, mots) ; la fenêtre et « Arrosages » gardent « Terminer
  l’irrigation ».

**Preuve (PR 2).** `tests/simplification-s2-terminer.test.ts` : le bouton de
chaque carte, les gestes (la fin par sa fenêtre, l'heure de la pause), le
compte à rebours (à la minute supérieure, jamais « 0 min », la durée atteinte
entre deux relectures), la réponse sous la carte, l'interface (la carte
dessine le domaine, la fenêtre d'« Arrosages » par le nom, fermée à la
réponse, l'heure du navigateur seulement).
`tests/db/simplification-s2-terminer.test.ts` : sur les vrais services, en
cours, en pause, repris, terminé avant la fin, ce qui reste repris puis
terminé à la durée, « Terminer » à l'heure de la pause, un refus dit sous la
carte, Bob qui ne met en pause, ne reprend ni ne termine rien d'Alice. P62
étendu (valider, démarrer, mettre en pause, reprendre, terminer sur la page
seule), P38 suit le nouveau geste. Contre-épreuve : voir la PR.

**Décision (PR 3).** L'arrosage à rattraper, en retard ou non fait, a sa carte
qui pose la question au lieu de deviner (contrat, section 4, S2-a) : « Je le
fais maintenant », le principal (le démarrage d'« Arrosages », ses gardes), et
« C’est fait », de même taille et bordé, qui enregistre l'arrosage tel que
prévu par la règle et la fonction de « Fait comme prévu » et « Tout est
fait », sans les changer (T15, T16, D-006). « C’est fait » n'existe que si
cette règle l'accepte : jamais avant la fin du créneau. « Ne pas le faire »,
rangé dans « Autres choix », est l'annulation d'« Arrosages », après « Ne pas
le faire ? — Cet arrosage ne sera pas fait. Le module recalcule la semaine. ».
La carte dit le jour et la question : « Prévu hier à 7 h. L’avez-vous
fait ? », « Prévu à 7 h, pas encore démarré. ». Le repli des jours passés (T2)
et « Tout est fait » ne changent pas. Sous restriction d'eau, « Je le fais
maintenant » est refusé et le motif se lit sous la carte ; « C’est fait »
reste accepté (section 9).

**Précisions tranchées en codant (PR 3).**

- F850 : la confirmation de « C’est fait » garde le titre et les mots de
  « Fait comme prévu » (« Fait comme prévu ? », « Enregistrer comme faite »,
  « Ne rien enregistrer ») : elle dit ce qui sera écrit, tel que prévu. Elle
  gagne « Fait autrement (une autre durée, un autre moment) ? Notez-le sur
  « Arrosages » », un lien vers la carte de l'irrigation, seulement quand
  « Arrosages » est cochée.
- F851 : « Ne pas le faire » se confirme par « Ne pas le faire » en rouge et
  « Le garder » ; la carte partie, la réponse « L’irrigation planifiée a été
  annulée. » se lit en tête de « Votre journée » (L4, règle 2).
- F852 : un jour plus ancien qu'avant-hier se dit par sa date courte (« Prévu
  dim. 8 nov. à 7 h. L’avez-vous fait ? ») ; un créneau passé du jour même,
  sans jour (« Prévu à 7 h. L’avez-vous fait ? »).
- F853 : le bouton « Fait comme prévu » quitte la carte d'« Aujourd'hui » pour
  « C’est fait » ; il reste sur « Arrosages » (dette notée, S5).

**Preuve (PR 3).** `tests/simplification-s2-a-rattraper.test.ts` : la carte
d'un arrosage non fait et en retard, « C’est fait » absent sans la règle, la
confirmation de « Ne pas le faire », la carte sans « Arrosages », la phrase
pour chaque jour, l'interface (rien au premier appui, la ligne « Fait
autrement », l'annulation d'« Arrosages », la même taille).
`tests/db/simplification-s2-a-rattraper.test.ts` : sur les vrais services,
« C’est fait » enregistre tel que prévu et la carte part, la restriction
refuse le démarrage mais pas « C’est fait », un créneau en cours sans « C’est
fait » démarré, « Ne pas le faire » annule, Bob n'annule, n'enregistre ni ne
démarre rien d'Alice. P62 étendu. Contre-épreuve : voir la PR.

**Décision (PR 4).** La pluie du pluviomètre se note d'un geste depuis
« Aujourd'hui », dans une fenêtre « Noter la pluie » qui écrit par l'action
existante `saveManualRainfallAction` (contrat, section 7) : aucune règle de
pluie ne change. La mesure, 0 mm compris, prime sur la réanalyse et la
prévision et fait recalculer le plan de sa semaine (3.7, règle 4). « Quel
jour ? » : « Aujourd’hui », « Hier », « Avant-hier », puis les jours
d'avant jusqu'à sept jours en arrière, jamais un jour futur ; hier par défaut
(S2-e). « Combien ? » : un champ décimal, virgule ou point, « mm » à côté ;
un champ vide n'est jamais 0 (D-003), le bouton reste inactif, et la ligne
« Pas de pluie ? Notez 0 : c’est une vraie mesure, elle compte. » le dit.
Le bouton dit le chiffre (« Enregistrer 8 mm ») ; une mesure déjà notée ce
jour-là se dit (« 8 mm déjà notés pour hier. ») et le bouton devient
« Remplacer par 5 mm » : jamais d'écrasement silencieux. La réponse se lit
sous le bouton qui a ouvert la fenêtre : « Pluie enregistrée : 8 mm le
lundi 15 juin. Le plan se recalcule. » ; un refus de l'action, dans la
fenêtre, avec son motif. Deux entrées : la tuile « Eau reçue » de « La
semaine » et la ligne « Pluie réelle incomplète » de « Fiabilité du
calcul ». La fenêtre n'existe qu'avec « Objectifs et besoins » cochée et
jamais pour une ferme toute sous abri (D-032). Elle est un composant partagé
de `app/irrigation/` (`rain-entry-dialog.tsx`), sans rien supposer de la
page qui l'ouvre : le « + » de S3 la montera aussi.

**Précisions tranchées en codant (PR 4).**

- F854 : les jours proposés restent dans la saison du jour, l'année civile :
  le 1er janvier, la liste ne porte qu'« Aujourd’hui », qui devient le jour
  par défaut ; le 3 janvier, aujourd'hui, hier et avant-hier.
- F855 : « déjà noté » au singulier sous 2 mm (« 0 mm déjà noté pour
  hier. », « 1,5 mm déjà noté »), au pluriel au-delà, comme le français
  l'accorde ; un jour plus ancien qu'avant-hier se dit « pour le ven. 12
  juin ».
- F856 : la tuile « Eau reçue » dit « Noter la pluie » (au lieu de « Noter
  une pluie mesurée ») et devient un bouton du même dessin, qui ouvre la
  fenêtre ; sa réponse s'écrit sous les tuiles. La ligne « Pluie réelle
  incomplète » dit « Noter la pluie » (au lieu de « Noter la pluie de la
  semaine ») et devient un bouton plein ; sa réponse reste sous la donnée
  suivie quand la ligne part, la semaine complète. Sans la fenêtre, les deux
  restent des liens vers « Objectifs et besoins », comme avant. Dans la
  fenêtre, « Retirer une mesure, voir jour par jour : sur « Objectifs et
  besoins » » mène au pli « Pluie mesurée ».
- F857 : « Le plan se recalcule » ne se dit que « Planning » coché.
- F858 : les gardes de l'action (date valide, jamais future, de 0 à
  1 000 mm) se lisent dans `manualRainfallRefusal`
  (`lib/domain/today/rain-entry.ts`), mêmes mots et mêmes bornes, pour se
  tester sans session ; l'action l'appelle avec la date du jour à la ferme.
  Aucune garde ne change.
- F859 : la règle des boutons de la page « Aujourd'hui » (la pilule de
  44 px) ne s'applique pas à une tuile-bouton, qui garde le dessin des
  tuiles ; au téléphone, son mot d'action passe à la ligne comme celui d'une
  tuile-lien (le parcours a mesuré un pixel de débordement avant).

**Preuve (PR 4).** `tests/simplification-s2-pluie.test.ts` : les jours et le
jour par défaut, la saison au 1er janvier, la lecture « 8,5 » et « 8.5 », le
champ vide, 0 accepté, hors bornes refusé, le motif sous le champ, le mot du
bouton (« Enregistrer », « Remplacer par »), la mesure déjà notée, la réponse,
les gardes de l'action, la fenêtre absente sans « Objectifs et besoins » ou
toute sous abri, l'interface (fenêtre partagée, au clavier, l'action
existante, deux entrées). `tests/db/simplification-s2-pluie.test.ts` : sur la
vraie base, 8 mm puis 0 mm puis 5,5 mm pour hier relus par la page, une seule
mesure par jour, le retrait sur « Objectifs et besoins », sept jours en
arrière au plus, le jour futur et le chiffre hors bornes refusés, Bob qui ne
voit, ne remplace ni ne retire la pluie d'Alice, pas de fenêtre toute sous
abri. P62 étendu ; P30 et L1 suivent les mots. Contre-épreuve : voir la PR.

**Décision (PR 5).** La page « Aujourd'hui » a deux niveaux (contrat,
sections 8 et 9), dans le même ordre à toutes les largeurs. Au premier
niveau : l'en-tête ; « Votre journée », sans la frise ; « Gel ou chaleur »
seulement pour un jour en alerte, la prévision qui manque ou le gel sans
alerte posée (J14) ; « La semaine » en une barre pour la ferme entière (la
phrase de l'objectif de S1, `farmObjectiveText`, l'eau reçue, ce qui manque,
jamais négatif, un inconnu dit inconnu), « Voir la semaine » et « Noter la
pluie » ; une seule ligne « Calcul approximatif », la première donnée qui
manque avec son geste et « + n autres » ; une ligne d'eau seulement quand une
réserve ou une limite le demande. Le reste est dans **un seul pli fermé, « Le
détail »**, que sa ligne de résumé compte (« 4 chiffres · 3 jardins · 2
données à rafraîchir ») : aucun bloc n'est retiré, chacun garde ses liens,
ses boutons et ses réponses. Les ancres existantes ouvrent le pli sur leur
bloc. Ce que garde le premier niveau se choisit dans
`lib/domain/today/essential.ts`, parmi ce que les blocs disent déjà : rien ne
se calcule de nouveau, aucune règle ne change.

**Précisions tranchées en codant (PR 5).**

- F860 : au téléphone (la page à 620 px ou moins, le seuil de L6), les
  pastilles de l'en-tête sont masquées (S2-g) ; à l'ordinateur, une pastille
  qui vise un bloc du pli (« Gel ou chaleur », « Fiabilité du calcul ») l'ouvre
  et y descend, l'adresse gardant l'ancre.
- F861 : « Gel ou chaleur » au premier niveau a sa propre ancre,
  `#today-weather-alert`, et dessine le jour en alerte par la carte du bloc,
  avec son lien ; le bloc entier, ses trois jours et sa phrase, garde
  `#today-weather` dans le pli, pour que les liens existants y mènent.
- F862 : « Voir la semaine » mène à la ligne de la ferme d'« Objectifs et
  besoins », comme la ligne de la ferme d'« Eau de la semaine », jusqu'à ce que
  « Semaine » (S4) existe ; sans objectif, le lien est celui de la tuile,
  « Poser un objectif ».
- F863 : le geste de la ligne « Calcul approximatif » est le composant du
  bloc « Fiabilité du calcul » (`ReliabilityAction`), le même bouton ou le même
  lien ; « Recalculer » y répond sous la ligne du plan, « Noter la pluie » sous
  la barre de la semaine.
- F864 : la frise du jour passe dans le pli, sous son titre « La journée en
  frise », à l'ordinateur seulement, comme avant au téléphone.
- F865 : la tuile « Eau reçue » du pli garde sa fenêtre « Noter la pluie » et
  sa réponse sous les tuiles, distincte de celle de la barre.
- F866 : le navigateur ouvre seul un pli qui contient l'ancre de l'adresse,
  avant que React ne s'attache ; l'attribut `open` du pli peut donc différer
  du rendu serveur sans faute (`suppressHydrationWarning` sur ce seul
  élément), et l'effet de l'ancre recale l'état.
- F867 : P62 mesure le premier bouton en ramenant à une ligne le nom du
  matériel du parcours, que le titre du test rend unique et étire sur
  plusieurs lignes ; la mesure dit les pixels retirés.

**Preuve (PR 5).** `tests/simplification-s2-essentiel.test.ts` : la barre de
la semaine (phrase de S1, partielle, atteinte, inconnue, sans objectif),
l'ordre de « Calcul approximatif » et « + n autres », la ligne d'eau
seulement en alerte, « Gel ou chaleur » seulement en alerte ou sans
prévision, la ligne de résumé du pli, l'ordre de la page sans branche du
téléphone, chaque bloc dans le pli, les ancres qui l'ouvrent.
`tests/aujourdhui-liens.test.ts` (L6) suit l'ordre. P29, P30 et P38 suivent
la page ; P62 mesure le premier niveau à 390 px et ouvre le pli par chaque
ancre et au clavier. Mesure à 390 px (P62, une proposition à valider) : le
premier niveau finit à 1 384 px (borne 1 600), le premier bouton est à
539 px (borne 600), 11 choses à toucher (borne 12) ; avant, la page du jour
faisait 3 888 px sur la démonstration. Contre-épreuve : voir la PR.

## D-331 — Simplifier l'usage du module, lot S3 : trois endroits

Date : 25 novembre 2026. Statut : **PR 1 à 4 sur 4 codées** (le rangement
et « Ma ferme » ; la barre du bas, le « + » et le chemin de retour ; le menu
de l'ordinateur ; les liens et les visites) ; contrat `docs/simplification-s3-contract.md`, roadmap
section 6 terdecies, ligne 33. Code en Opus 5.5 · Très élevé, le réglage de
la roadmap et du contrat (section 14), sur le mandat du porteur du
25 novembre 2026 (enchaîner les lots sans nouveau « vas-y », D-327). Elle met
en œuvre le choix n° 1 du porteur (« trois endroits », 25 novembre 2026,
11 h 59) ; les PR 2 à 4 la complètent.

**Décision (PR 1).** Chaque page du module est rangée dans un endroit et un
seul : « Aujourd'hui » (Aujourd'hui, Arrosages), « Semaine » (Planning de la
semaine, Objectifs et besoins, Historique et cumuls), « Ma ferme » (Matériel
et placement, Ressources et pompes, Besoin par culture, Réserve du sol,
Alertes météo, Alertes cultures, Réglages, et la page « Ma ferme »
elle-même). La correspondance vit dans `lib/domain/features/places.ts`, avec
l'entrée de chaque endroit (sa première page cochée) et les fiches de
« Ma ferme » (les pages cochées de l'endroit, Réglages toujours) ; une page
existe pour un choix de cases par une seule règle, `pageEnabled`, que
`pageAccess` emploie aussi. La page « Ma ferme » s'ouvre à
`/irrigation/ma-ferme`, avec le gabarit des pages (chapeau, titre, « ? »,
saison) : une fiche par page cochée, dans l'ordre de la maquette, l'icône de
la page, son nom, une ligne fixe (`lib/domain/features/farm-cards.ts`), un
chevron, 68 px au moins. Elle ne lit rien de plus que le gabarit : la marque
« À faire » vient de l'accueil de la ferme (`UnfinishedStep.page`). Elle
s'ajoute à l'ancien menu comme une page de plus, au-dessus de Réglages ; la
barre du téléphone (PR 2) et le menu de l'ordinateur (PR 3) ne changent pas
encore. Aucune adresse ne change ; aucune page, aucune fonction n'est
retirée ; aucun calcul, aucune donnée, aucune migration.

**Précisions tranchées en codant (PR 1).**

- F868 : jusqu'à la PR 2, « Ma ferme » est une page de l'ancien menu comme
  les autres, donc comptée dans la règle de la barre du téléphone (F6,
  « cinq pages ou moins : toutes ») : une ferme qui avait cinq pages en a
  six et retrouve « Plus », le temps d'une PR. La PR 2 remplace la barre.
- F869 : « Ma ferme » montre toujours le choix de la saison et le transmet à
  chaque fiche (`pageUsesSeason`, comme toute page sauf « Aujourd'hui »,
  Arrosages et Alertes météo) : la saison sert à presque toutes les fiches.
- F870 : la ligne fixe d'une fiche tient sur deux lignes au plus à 390 px et
  sur une à l'ordinateur. « Une ligne à 390 px » (contrat, section 5) ne
  tient pas avec les lignes mêmes du contrat, que la maquette passe déjà à
  la ligne ; les textes du contrat sont gardés, P63 mesure le nombre de
  lignes de chacune aux deux largeurs.
- F871 : la ligne d'« Alertes cultures » devient « Gel selon la culture,
  arrêt avant la récolte, aspersions », relue contre le « ? » de la page
  (S3-f) : la page parle du gel par culture, de l'arrêt avant la récolte et
  des aspersions, pas du séchage.
- F872 : « À faire » s'écrit sous la ligne fixe, en orange de la charte
  (`--warn-ink`, en gras), avec le texte de chaque étape de la page, séparés
  par une virgule (« À faire : commune de la ferme ») ; l'icône de la fiche
  passe au fond orange pâle. Le bandeau « À finir » ne change pas.
- F873 : la phrase de bas de page de la maquette (« Le module lit le plan de
  votre ferme… sans jamais le modifier ») est déjà au pied de chaque page du
  gabarit ; elle n'est pas redite dans « Ma ferme ».
- F874 : une fiche change de page comme le menu, sans recharger le module
  (D-322), et porte le clavier sur le contenu de la page ouverte.
- F875 : « Ma ferme » a sa propre icône, une maison (`ferme`), dans la table
  des icônes des pages.

**Preuve (PR 1).** `tests/simplification-s3-endroits.test.ts` : chaque page
dans un endroit et un seul ; le tableau du contrat ; pour chacun des 235
choix de cases valides (parmi les 2 048), les endroits, leur entrée, les
fiches, leur union égale au menu, `pageEnabled` équivalent à l'accès
ouvert, la page d'arrivée jamais « Ma ferme » ; les états rares ;
l'adresse, la saison et les anciennes adresses ; les lignes (sans mot du
calcul, une phrase, 60 signes au plus) ; « À faire » ; la page ne lit rien
de plus ; la fiche (lien, saison, 68 px) ; l'ordre du menu ; le « ? ».
Parcours P63, aux deux largeurs : la page, ses sept fiches dans l'ordre,
68 px, lignes mesurées, charte (rien sous 12 px, quatre graisses), « Ma
ferme » au-dessus de Réglages dans le menu et marquée ; chaque fiche ouvre
sa page sans recharger, la saison gardée, le clavier sur le contenu ; une
autre saison suit dans chaque fiche ; une ferme neuve (Matériel et Alertes
météo) a trois fiches, et « À faire : commune de la ferme » sur « Réglages ».
P0, P22, P24, P27, P28, P30, P59 et P61 suivent le menu d'une page de plus.
Contre-épreuve : quatorze altérations, chacune fait échouer un test (voir la
PR).

**Décision (PR 2).** Au téléphone et à la tablette, là où la barre du bas
remplace le menu (jusqu'à 980 px), la barre porte les trois endroits et le
« + », dans l'ordre Aujourd'hui, Semaine, « + », Ma ferme ; un endroit sans
page cochée disparaît, le « + » n'existe que si l'un de ses gestes existe
(`lib/domain/features/phone-bar.ts`). « Plus », sa feuille des pages, la
règle « cinq pages ou moins » (F6) et le point vert de « Plus » (F287)
n'existent plus. Chaque endroit ouvre sa première page cochée ; l'endroit de
la page ouverte porte la marque de l'ancienne barre, `aria-current="page"`
sur la page où il mène, `"true"` sur une autre page de l'endroit (S3-e) ; la
pastille reste sur « Aujourd'hui » (F12). Le « + » est un bouton rond de
52 px au centre, nom « Arroser ou noter », qui ouvre la feuille modale « Que
voulez-vous faire ? » (`lib/domain/features/plus-sheet.ts`,
`app/irrigation/shell/plus-sheet.tsx`) : « Arroser maintenant » et « Noter un
arrosage déjà fait », « Arrosages » cochée, ouvrent « Arrosages » sur
« Irriguer maintenant » ou « Déjà réalisée » ; « Noter la pluie », « Objectifs
et besoins » cochée et la pluie comptant pour la ferme (la règle de S2,
`farmRainMatters`, appelée), monte dans la feuille le formulaire de la
fenêtre de S2, sans changer de page. Sous le titre des trois pages de
« Semaine », la bande « La semaine » (une page cochée par lien, 44 px, la page
ouverte marquée, saison, parcelle et jour gardés ; pas de bande sous deux
pages) ; au début de la ligne du titre des pages de « Ma ferme », hors
« Ma ferme », le retour « ‹ » de 44 px, « Retour à Ma ferme ». « Tous les
arrosages » ferme « Votre journée » quand « Arrosages » est cochée : c'est le
chemin d'« Arrosages » depuis « Aujourd'hui » (section 3.4). Le menu de
l'ordinateur ne change pas avant la PR 3. Aucune adresse ne change ; aucune
page ni fonction n'est retirée ; aucun calcul, aucune donnée, aucune
migration ; aucune règle de pluie ne change.

**Précisions tranchées en codant (PR 2).**

- F876 : la bande et le retour existent là où la barre du bas remplace le
  menu, jusqu'à 980 px, tablette comprise (« au téléphone » du contrat) ; à
  l'ordinateur, le menu de gauche montre déjà toutes les pages.
- F877 : la demande d'« Arrosages » s'appelle `arroser` (`?arroser=maintenant`,
  `?arroser=fait`), lue une fois puis retirée de l'adresse comme
  `?planifier=1` ; elle ouvre le formulaire voulu et l'amène dans l'écran ;
  une valeur inconnue n'ouvre rien. Les deux gestes sont des liens : ils
  rechargent « Arrosages », qui lit ses données à l'ouverture.
- F878 : « Noter la pluie » du « + » lit les pluies déjà notées des sept
  derniers jours à l'ouverture du geste (`readRainEntryAction`, une lecture,
  hors du journal), jamais avec la page : aucune page ne lit rien de plus à
  l'affichage pour le « + ».
- F879 : une pluie enregistrée depuis la feuille, la fermeture de la feuille
  recharge la page derrière, pour que le plan et les chiffres la montrent :
  les pages gardent leurs blocs dans leur état, une relecture serveur ne les
  relirait pas tous. Pendant l'enregistrement, la feuille ne se ferme pas.
- F880 : « la pluie compte » se calcule sur la saison de la page, avec le
  contexte de chaque page (`page-context.ts`), par la règle de S2 déplacée de
  `today-service.ts` vers `lib/domain/today/rain-entry.ts` (`farmRainMatters`),
  que « Aujourd'hui » appelle aussi ; la page introuvable, qui ne lit pas le
  plan de la ferme, n'a pas « Noter la pluie ».
- F881 : la feuille n'existe qu'ouverte, posée hors de la barre
  (`document.body`) pour que les styles de la barre ne la touchent pas ; le
  « + » porte `aria-haspopup="dialog"` et `aria-expanded`.
- F882 : « Tous les arrosages » et la bande changent de page comme le menu,
  sans recharger le module (D-322), et portent le clavier sur le contenu.
- F883 : l'entrée « Semaine » garde le jour ouvert de la page courante, comme
  la bande (section 3.3) ; les autres entrées gardent la saison et la
  parcelle, comme le menu.
- F884 : la marque d'un endroit est celle de la page ouverte de l'ancienne
  barre (l'icône sur le vert), pour `page` comme pour `true` : le lecteur
  d'écran et la marque disent la même chose (S3-e).

**Preuve (PR 2).** `tests/simplification-s3-barre.test.ts` : l'ordre de la
barre ; pour chacun des 235 choix de cases valides, la pluie comptant ou
non, les endroits égaux à ceux de « Ma ferme », leurs entrées, le « + » avant
« Ma ferme », quatre places au plus, chaque page à deux touches au plus ; le
bilan des touches (Planning à une ; Arrosages et Ressources à deux) ; les
états rares ; les gestes, leurs textes et la demande `arroser` ; S3-e ; la
bande (zéro à trois pages) et le retour ; `farmRainMatters` appelée par
« Aujourd'hui » et le contexte des pages ; la lecture des pluies ; le
composant de la barre, la feuille, la bande, le retour, la charte (52, 72 et
44 px ; la bande et le retour seulement sous 980 px). Les tests de F6, F12,
F287, T1 et de la fenêtre de la pluie suivent. Parcours P63, aux deux
largeurs : chacune des treize pages par son adresse marque son endroit, la
bande et le retour où il faut, 44 px, rien de coupé ni de débordant à
320 px, la page introuvable garde sa barre ; une tournée de toutes les pages
à deux touches au plus, sans recharger ; au téléphone, la feuille du « + »
(modale, 72 px, Échap et le voile, le clavier revenu), 8 mm de pluie notés
sans quitter la page puis relus, et les deux formulaires d'« Arrosages ». P0,
P27, P28, P30, P41 et P59 suivent la barre. Mesures et contre-épreuve : voir
la PR et le contrat, section 13.

**Décision (PR 3).** À l'ordinateur, au-delà de 980 px, le menu de gauche
range les pages en trois endroits, tous dépliés, à la place des groupes
« Arroser, Équiper, Surveiller » (T1) : en tête, le bouton « + Arroser ou
noter », qui ouvre la même feuille « Que voulez-vous faire ? » que le « + »
de la barre, en boîte de dialogue au milieu de la page (S3-l) ; puis
« Aujourd'hui » dans son encart « Tableau de bord », avec sa pastille (F12),
et Arrosages ; le titre « Semaine », un lien vers sa première page cochée
(S3-a), puis Planning de la semaine, Objectifs et besoins, Historique et
cumuls ; le titre « Ma ferme », un lien vers la page « Ma ferme », puis ses
fiches dans l'ordre de la section 5, Réglages comprise, qui n'est plus à
part (S3-i). Un endroit sans page cochée disparaît ; le « + » n'existe que
si l'un de ses gestes existe. Le menu et la barre viennent de la même
fonction (`menuPlacePages`) : `lib/domain/features/desktop-menu.ts`
(`menuPlaces`, qui remplace `menu-groups.ts` et `menuLayout`). Le téléphone
ne change pas. Aucune adresse ne change ; aucune page ni fonction n'est
retirée ; aucun calcul, aucune donnée, aucune migration.

**Précisions tranchées en codant (PR 3).**

- F885 : l'endroit « Semaine » du menu, son titre et ses trois pages,
  garde le jour ouvert de la page courante, comme la bande et l'entrée
  « Semaine » de la barre (F883) ; les deux autres endroits gardent la
  saison et la parcelle, comme avant.
- F886 : la page ouverte est marquée `page` une seule fois dans le menu.
  Le titre de son endroit porte `page` quand il est le lien de la page et
  que la liste ne la redit pas (l'encart d'« Aujourd'hui », le titre
  « Ma ferme ») ; `true` quand la page ouverte est ailleurs dans l'endroit,
  ou quand la liste la redit (le titre « Semaine » sur Planning de la
  semaine) : un lecteur d'écran n'entend « page en cours » qu'une fois. Le
  titre marqué `true` prend le vert, celui marqué `page` la pilule verte ;
  l'encart garde son fond blanc.
- F887 : le « + Arroser ou noter » est le composant du « + » de la barre
  (`PlusSheet`, `variant="menu"`), premier élément de la liste du menu, qui
  reste collée en haut de l'écran : son nom se lit sur le bouton, 44 px, en
  vert plein. La même feuille s'ouvre en boîte de dialogue de 480 px au
  milieu de la page à partir de 981 px, sans la poignée du téléphone ; en
  dessous, elle monte du bas, comme la barre qui la porte.
- F888 : les titres des endroits s'écrivent sans capitales (un lecteur
  d'écran lirait un nom en capitales lettre à lettre), en gras, avec le
  chevron qui dit qu'ils mènent quelque part ; un trait sépare les
  endroits. Chaque liste porte le nom de son endroit. Les règles des anciens
  groupes et celles de la bande de pilules de la tablette, que la PR 2 avait
  rendues inertes, sortent de `navigation.css`.
- F889 : à l'ordinateur, toute page reste à un clic ; « Arroser maintenant »,
  « Noter la pluie » et « Noter un arrosage déjà fait » à deux, depuis
  n'importe quelle page, comme au téléphone.

**Preuve (PR 3).** `tests/simplification-s3-menu.test.ts` : pour chacun des
235 choix de cases valides, les endroits du menu égaux à ceux de la barre,
dans le même ordre et sur la même entrée, le titre et la liste qui disent
ensemble les pages cochées de l'endroit, chaque page une fois, Réglages en
dernier dans « Ma ferme » ; S3-e sur chacune des treize pages, et aucune
marque sur la page introuvable ; le composant (le « + » en tête, la même
feuille, les titres en liens, la semaine qui garde son jour, les groupes
d'avant disparus), la charte (44 px, la boîte de dialogue au milieu à
partir de 981 px). Les tests de T1 (`aujourdhui-menu`) et de « Ma ferme »
(`simplification-s3-endroits`) suivent. Parcours P63 à 1 440 px : chacune
des treize pages par son adresse, la marque de la page et de son endroit,
le titre « Semaine » vers Planning, les fiches de « Ma ferme » dans le menu,
la page introuvable ; le parcours du « + » joué aussi à l'ordinateur (la
boîte au milieu, sans poignée). P0, P27, P28 et P30 suivent le menu, et
`e2e/support/parcours.ts` range ses titres dans l'ordre des endroits.
Mesures et contre-épreuve : voir la PR et le contrat, section 13.

**Décision (PR 4).** Ce qui parlait encore du menu d'avant parle des trois
endroits et du « + ». La visite guidée de la démonstration : l'étape 4 de
« Bienvenue » devient « Trois endroits » (« Aujourd'hui » pour ce qu'on fait
maintenant, « Semaine » pour savoir si la semaine est bonne, « Ma ferme » pour
ce que le module sait de la ferme ; le « + » lance ou note un arrosage, ou
note la pluie, depuis n'importe quelle page) ; l'étape 3 du « Module à la
carte » devient « Les endroits suivent vos cases ». Le « ? » d'« Aujourd'hui »
dit que sa pastille est « dans la barre du bas ou le menu ». La charte du
module décrit la navigation aux trois endroits. Avec elle, le lot S3 est
codé en entier. Aucune adresse, aucun écran, aucun calcul, aucune donnée ne
change.

**Précisions tranchées en codant (PR 4).**

- F890 : le repère `menu` des visites reste un seul nom, posé sur la barre
  du bas et sur le menu de gauche ; la bulle se raccroche au premier des deux
  qu'on voit, comme depuis la PR 2. Aucun repère n'est ajouté. Les noms
  accessibles des deux navigations (« Pages principales », « Pages du
  module ») ne changent pas : ce ne sont pas des mots de l'écran, et les
  parcours les lisent.
- F891 : « Trois endroits » garde l'idée de l'étape d'avant (« Une visite
  saute ce que la ferme choisie n'a pas coché ») en une phrase : « Chaque
  ferme ne voit que ce qu'elle a coché ; une visite saute le reste. » Le
  « + » y est dit sans « quand il est là » : la phrase suivante le couvre.
- F892 : « Le module à la carte », étape 1, « le reste disparaît des écrans
  et des calculs » au lieu de « du menu et des calculs » ; étape 3, « Une
  page n'apparaît dans son endroit que si sa fonctionnalité est cochée. Un
  endroit qui n'a plus de page disparaît, comme le « + » quand il n'a plus
  rien à proposer » (section 8).
- F893 : P29 lit la pastille dans le nom de l'entrée « Aujourd'hui », sans
  rien ouvrir : le code qui refermait la feuille « Plus » part. Les
  commentaires du domaine (`menuPages`, `phoneBar`) disent le rangement tel
  qu'il est.

**Preuve (PR 4).** `tests/simplification-s3-liens.test.ts` : l'étape
« Trois endroits », sur le repère `menu`, nomme les trois endroits et le
« + » ; « Les endroits suivent vos cases » ; aucune bulle ni aucun « ? » ne
dit « Plus », « Plus de pages », « Pages du module », « le menu ne
montre », « Arroser, Équiper » ; le « ? » d'« Aujourd'hui » ; le repère
`menu` sur les deux navigations, et la bulle sur celle qu'on voit. Les
règles des bulles (`demo-tours` : longueur, sans emoji ni sigle, pages
cochées) tiennent sans changer. Parcours V1 et V6 de la démonstration et
P29, aux deux largeurs. Contre-épreuve : voir la PR.

## D-332 — Simplifier l'usage du module, lot S5 : arroser en trois champs

Date : 25 novembre 2026. Statut : **PR 1 sur 3 codée** (« Arroser
maintenant » en trois champs) ; contrat `docs/simplification-s5-contract.md`,
roadmap section 6 terdecies, ligne 33. Code en Opus 5.5 · Élevé, le réglage
de la roadmap et du contrat (section 14), sur le mandat du porteur du
25 novembre 2026 (enchaîner les lots sans nouveau « vas-y », D-327), après
la fin du code de S3.

**Décision (PR 1).** Le formulaire « Arroser maintenant » d'« Arrosages »
tient en trois champs : « 1. Où ? », « 2. Combien de temps ? », puis un
bouton qui dit ce qu'il fait ; le reste est derrière « Plus d'options ». Les
règles d'écran vivent dans `lib/domain/watering-now.ts` : les pastilles de
durée, le pas de cinq minutes, la phrase du résultat, l'heure de fin, le
bouton et ce qui lui manque, ce qui reste au premier niveau. Les valeurs
écrites sont celles du formulaire d'avant, par les mêmes champs et la même
action serveur : la durée tirée d'une quantité, l'apport par planche, le
volume, la faisabilité hydraulique, la dose du jour et le dépassement de
l'objectif sont les fonctions existantes. Aucune règle d'écriture ni aucun
calcul ne change ; aucune question agronomique (contrat, section 10).

Précisions prises en codant :

- **F894** — L'onglet s'appelle « Arroser maintenant » dès la PR 1 (S5-a),
  dans le « ? » de la page et la visite guidée aussi ; les phrases de
  description des trois onglets et les noms « Planifier », « Déjà
  réalisée » restent jusqu'à la PR 2, qui refait ces deux onglets.
- **F895** — « Où ? » : une case ronde par matériel prêt (la règle
  d'avant : actif, un réglage, une position), rangée par jardin
  (`equipmentByGarden`) ; le nom lu de la case est celui du matériel, son
  type et ses planches en sont la description (« Goutte-à-goutte · 3
  planches »). Le nombre de planches est celui de la couverture de la ferme
  pour la position enregistrée (`reachedBedCount`), comme la ligne
  d'avant. Au-delà de six matériels, la liste déroulante groupée, chaque
  choix suivi du même détail (S5-c). Un seul matériel prêt est choisi
  d'office sur « Arroser maintenant », hors modification, et une ligne le
  dit (S5-b) ; avec plusieurs, rien n'est choisi.
- **F896** — Le réglage reste au premier niveau seulement pour un
  matériel qui en a plusieurs : une liste « Réglage » sous les lignes, qui
  montre son nom ; son premier choix est celui d'avant (la position
  enregistrée, sinon le premier).
- **F897** — La durée : un grand nombre, « − » et « + » ronds de 52 px,
  les pastilles « 30 min », « 1 h » et « Conseillé : *durée* » quand le
  jour a une dose pour ce matériel. La pastille choisie se lit sur le
  formulaire (mode, quantité, durée), jamais retenue à part. « Conseillé »
  écrit la dose en mm, mode « Objectif en mm », exactement la valeur
  d'avant ; une pastille fixe, « − » et « + » écrivent des heures et des
  minutes entières, mode « Durée d'irrigation ». Une durée hors grille
  (« 1 h 23 ») rejoint la grille de cinq minutes voisine au premier pas.
  « — » tant qu'aucune durée n'est choisie : le premier « + » donne
  30 min, « − » est inactif ; plancher 5 min, plafond 744 h.
- **F898** — La phrase du résultat dit « pris à « *origine* » », le nom
  entre guillemets, plutôt que « pris au *origine* » de la maquette : les
  noms des réserves sont libres et l'article ne se devine pas. L'origine
  ne se dit qu'avec un volume connu ; un volume inconnu se dit avec sa
  raison (« volume inconnu : passe-pied non renseigné ») ; un apport
  inconnu sur une planche se dit, jamais zéro. La pompe ne se dit qu'avec
  la case « Ressources et pompes » cochée. Les millimètres sont une seule
  valeur quand toutes les planches reçoivent la même au dixième, sinon
  « de *a* à *b* mm selon les planches ». L'intensité (goutte-à-goutte) ou
  l'étendue (aspersion) et le tableau « Apport estimé par planche » sont
  sous « Voir planche par planche ».
- **F899** — Le bouton dit « Démarrer · fin vers *h* » ; son nom lu est
  « Démarrer l'arrosage de *matériel*, fin vers *h* ». L'heure de fin est
  relue chaque minute par une horloge du formulaire : celle de la page ne
  bat que pendant un arrosage. Inactif aux conditions d'avant, la ligne
  dessous dit, dans l'ordre, « Choisissez où arroser. », « Choisissez une
  durée. », puis, pour un matériel dont la position n'atteint aucune
  planche, « Ce matériel n'atteint aucune planche depuis sa position :
  vérifiez sa pose. »
- **F900** — « Plus d'options (pompe, note, saisir en mm) » est un bouton
  à `aria-expanded` qui montre ou cache ses champs, fermé par défaut,
  ouvert d'emblée quand une valeur y est déjà posée : une pompe qui n'est
  pas l'habituelle du matériel, une note, la saisie en mm. Il contient
  « Saisir en mm » (une case : la quantité « Quantité souhaitée » au
  premier niveau, « soit *durée* » en résultat, la planche de référence
  d'un asperseur), « Durée exacte » (les heures et minutes, qui montrent
  la durée en cours), la pompe et l'origine de l'eau avec la faisabilité
  « ok » ou « inconnue », la note. La pompe dépassée et le créneau
  protégé restent au premier niveau.
- **F901** — Le formulaire a son propre fichier (`creation-panel.tsx`,
  `watering-now-form.tsx`) et ses valeurs leur fonction
  (`use-creation-form.ts`) : le composant de la page passe de 598 à 422
  lignes comptées (limite 600, `docs/file-splitting-contract.md`). Vidé après une réussite (F406), il revient aussi au mode
  « Objectif en mm » sans quantité, pour les trois onglets : aucune durée
  n'y reste choisie.

**Écart, dit.** Le budget de hauteur du contrat (section 7 : « Où ? » sous
400 px au téléphone sans arrosage en cours, sous 700 px avec) n'est pas
tenu par la PR 1 : mesuré par P64, il dépend des onglets d'une ligne
(PR 2) et de l'ordre de la page (PR 3), qui le vérifiera. Les contrats de
la section 9.1 sont réécrits par la PR 3, comme le prévoit la section 2 du
contrat ; celui des parcours suit dès cette PR.

## D-333 — Simplifier l'usage du module, lot S5 : « Planifier » et « Déjà fait » sur le même squelette

Date : 25 novembre 2026. Statut : **PR 2 sur 3 codée** ; contrat
`docs/simplification-s5-contract.md` (sections 4, 5, 6 et 10), roadmap
section 6 terdecies, ligne 33. Code en Opus 5.5 · Élevé, le réglage de la
roadmap et du contrat (section 14), dans la suite de D-332.

**Décision (PR 2).** Les trois onglets d'« Arrosages » partagent un seul
formulaire (`watering-form.tsx`) : le même « Où ? », le même « Plus
d'options », la même phrase du résultat ; seuls le deuxième bloc et le
bouton changent. Les règles d'écran nouvelles vivent dans
`lib/domain/watering-plan-record.ts`. Les valeurs écrites et l'action
serveur sont celles d'avant ; aucune règle d'écriture ni aucun calcul ne
change, aucune question agronomique. L'ancien formulaire de « Planifier »
et « Déjà réalisée » est retiré (`preparation-fields.tsx`, l'encart
« Résultat calculé » et sa règle d'attente du lot J, F462, dont la part
qui tient, le bouton et la réponse toujours rendus, se lit sur le
squelette).

Précisions prises en codant :

- **F902** — Les onglets s'appellent « Arroser maintenant », « Planifier »,
  « Déjà fait » (S5-e) ; au téléphone, ils tiennent sur une ligne de 44 px
  et leur phrase de description ne se montre plus ; à l'ordinateur, elle
  reste. L'Historique dit comment un arrosage a été noté avec les mêmes
  mots (« Arroser maintenant », « Déjà fait »), dans sa fiche et dans la
  colonne « Mode » de l'export.
- **F903** — L'ordre des blocs, numérotés dans cet ordre
  (`wateringBlocks`) : « Planifier », « 1. Où ? », « 2. Quand ? » (la date
  et l'heure de début, le champ d'avant, proposé une heure plus tard),
  « 3. Combien de temps ? » ; « Déjà fait », « 1. De quand à quand ? »
  (début réel, fin réelle) avant « 2. Où ? », parce que le matériel listé
  est celui qui était posé à l'heure de début (règle 12), sans « Combien
  de temps ? » : « soit *durée* » se lit sous les dates, et la phrase du
  résultat, sous « Où ? », dit ce qui s'enregistrera (les mm et les
  litres estimés).
- **F904** — Le bouton de « Planifier » dit « Planifier · *jour* à *h* » :
  « aujourd'hui », « demain », « le vendredi 27 » dans les six jours qui
  viennent et le même mois, « le mardi 1er décembre » sinon (un jour passé
  aussi, qu'on planifie pour le noter) ; son nom lu est « Planifier
  l'arrosage de *matériel*, demain à 6 h ». Ce qui manque se dit dans
  l'ordre des blocs : « Choisissez où arroser. », « Choisissez quand
  arroser. » (un début vide ou illisible, point ouvert 46), « Choisissez
  une durée. », la planche non atteinte. Le bouton de « Déjà fait » dit
  « Enregistrer cet arrosage », lu « Enregistrer l'arrosage de
  *matériel* » ; ce qui manque, dans l'ordre : « Choisissez une fin après
  le début. » (dates illisibles ou dans le désordre, point ouvert 45),
  « Choisissez où arroser. », la planche non atteinte. Rien de ce qui est
  signalé (pompe, restriction) ne le bloque.
- **F905** — Un seul matériel prêt est choisi d'office **dans les trois
  onglets** (S5-b, « mêmes règles », section 4), hors modification d'une
  irrigation planifiée, qui porte son matériel ; la ligne le dit. La PR 1
  le limitait à « Arroser maintenant » et retirait le choix en changeant
  d'onglet ; ce retrait disparaît. P31 (cas 3 du lot 3) lit le nouveau
  comportement.
- **F906** — « Déjà fait » : un matériel choisi qui n'était pas posé à
  l'heure de début n'est plus coché, et une ligne le dit (« *Matériel*
  n'était pas posé à cette heure de début : choisissez où vous avez
  arrosé. ») ; le choix est gardé en mémoire et revient si l'heure revient
  à une pose. Le bouton dit « Choisissez où arroser. ».
- **F907** — « Plus d'options » de « Déjà fait » ne range que la pompe et
  la note (« Plus d'options (pompe, note) ») : ni saisie en mm ni durée
  exacte, la durée se lit des dates ; la faisabilité s'y lit au passé, comme
  avant. La promesse « Le minuteur retrouvera son état… » ne se dit que sous
  « Démarrer ». « Modifier » d'une irrigation à venir ouvre « Planifier »
  sur ce squelette, rempli, avec son bandeau (section 5) ; « Plus
  d'options » s'y ouvre seul pour une pompe qui n'est pas l'habituelle ou
  une note.

**Ce qui reste à la PR 3.** « C'est fait » à la place de « Fait comme
prévu » sur « Arrosages » : la section 2 du contrat le range en PR 2, sa
section 6.1 en PR 3 ; la PR 3, qui réécrit les contrats de la section 9.1
(dont T15 et T16), le porte, comme l'a annoncé la PR 1. L'ordre de la page
et le budget de hauteur de la section 7, la demande portée par l'adresse
et les ancres de la visite guidée restent aussi à la PR 3.

## D-334 — Simplifier l'usage du module, lot S5 : l'entrée de la page et les mots

Date : 25 novembre 2026. Statut : **PR 3 sur 3 codée** ; contrat
`docs/simplification-s5-contract.md` (sections 6.1, 7, 9.1 et 10), roadmap
section 6 terdecies, ligne 33. Code en Opus 5.5 · Élevé, le réglage de la
roadmap et du contrat (section 14), dans la suite de D-332 et D-333. **Le
code de S5 est fini.**

**Décision (PR 3).** La page « Arrosages » suit l'ordre de la section 7 :
le titre « Arroser ou noter », les irrigations en cours, le formulaire,
les alertes du téléphone, les irrigations à venir, puis le résumé (« 1 en
cours, 0 à venir, 0 archivées »), qui quitte le titre. Le « + » de S3
(`?arroser=maintenant`, `?arroser=fait`, `WATERING_INTENT` de
`lib/domain/features/plus-sheet.ts`, lu une fois puis retiré par
`useUrlIntent`) est repris tel quel : S5 n'y ajoute que le retour. Aucun
calcul, aucune action serveur, aucune garde ne change ; aucune question
agronomique.

Précisions prises en codant :

- **F908** — Les alertes du téléphone (« Recevoir les alertes sur cet
  appareil », « Alertes activées », l'état limité) viennent **toutes** sous
  le formulaire, à une seule place. Amende F266 (audit final, lot E,
  section 7.1), qui ne descendait que l'état limité : en tête, « Recevoir
  les alertes » mettait « 1. Où ? » à 469 px au téléphone, au-delà du
  budget de 400 px. Le texte et le repli (F267) ne changent pas.
- **F909** — Au téléphone, la carte d'une irrigation en cours est
  raccourcie : le minuteur à droite du nom, les trois valeurs (temps
  effectué, fin estimée, volume) sur une ligne, « Pause » et « Terminer
  l'irrigation » côte à côte, chacun de 52 px comme avant. Les mêmes
  gestes, les mêmes mots, la même règle ; seule la mise en page change
  (`arroser-maintenant.css`). La carte passe de 639 à environ 430 px
  (mesure de P64).
- **F910** — **Budget de la section 7, avec une irrigation en cours, non
  tenu** : « 1. Où ? » commence à 800 px au téléphone (1 011 px avant
  F909), au lieu de moins de 700 px, mesuré par P64 avec le nom long d'un
  parcours (« Ligne A p64-arroser-en-trois-champs telephone », trois
  lignes). La carte en cours garde le détail des apports, la faisabilité
  de la pompe et ses deux boutons : la raccourcir davantage retirerait une
  information du premier niveau, ce que la section 1 du contrat exclut
  (« leurs gestes restent ; seuls des mots s'alignent »). P64 borne à
  820 px pour garder le gain ; le budget de 700 px reste une dette, à
  reprendre avec la carte de S2 si le porteur le juge utile. **Sans
  irrigation en cours, le budget est tenu** : 298 px au téléphone sur la
  ferme de mesure (603 px avant S5), sous 400 px dans P64 et P65.
- **F911** — Arrivé par un geste du « + » (« Arroser maintenant », « Noter
  un arrosage déjà fait »), le formulaire commence par un retour « ‹
  Aujourd'hui » de 44 px, avant les onglets ; il mène à « Aujourd'hui » de
  la même saison. « Ajouter un créneau à la main » du planning
  (`?planifier=1`) n'est pas un geste du « + » : pas de retour.
- **F912** — Après « Démarrer », la page reste ; sous la réponse, un lien
  de 44 px « Voir l'arrosage en cours sur Aujourd'hui » mène à la page,
  sans ancre (section 10 : la carte de S2 peut changer de forme). Il
  disparaît au geste suivant ; il ne paraît ni après « Planifier », ni
  après « Déjà fait », ni après la modification d'une irrigation planifiée.
- **F913** — Sur la ligne « À traiter » d'« Arrosages », « Fait comme
  prévu » devient « C'est fait », le mot de la carte d'« Aujourd'hui »
  (S2, PR 3) ; son nom lu « C'est fait : *irrigation* ». La confirmation
  garde son titre « Fait comme prévu ? » et son bouton « Enregistrer comme
  faite », sur les deux pages. Solde la dette de S2 (section 6.1) ; la
  notification « Fait comme prévu » reste (dette notée avec F828).
- **F914** — La visite guidée suit les trois blocs : « 1. Où ? »
  (`arrosage-champs`), « 2. Combien de temps ? » (`arrosage-resultat`),
  « Vous seul validez » sur le bouton (`arrosage-bouton`, ancre nouvelle,
  qui nomme « Démarrer · fin vers … »).
- **F915** — Les contrats de la section 9.1 lisent les mots nouveaux :
  lot G (la dose du jour devient « Conseillé »), lot 3 (cas 3 amendé par
  S5-b ; cas 7, « C'est fait »), « Aujourd'hui » tableau de bord, poses
  du matériel (« Déjà fait » met « De quand à quand ? » avant « Où ? »),
  S2 (dettes soldées), S3, la charte du module (onglets d'une ligne au
  téléphone), lot E (F908) ; la recette 2.11 garde les mots de son jour,
  avec une note datée.

## D-338 — Météo multi-modèles : le modèle de prévision se choisit par ferme

Date : 26 novembre 2026. Statut : **contrat écrit, sans code** ;
`docs/weather-models-contract.md` v0.1, roadmap section 6 quindecies, ligne 35.
Écrit en Sonnet 5.5 · Moyen ; code en Opus 5.5 · Élevé (PR 0, 1 et 3) et
Opus 5.5 · Max (PR 2), le réglage de la roadmap. Aucune question agronomique
dans cette version.

**Décision.** Une ferme peut choisir **un** modèle de prévision Open-Meteo dans
une liste tenue dans le code, ou rester en « Automatique », le défaut, qui garde
la lecture actuelle sans rien changer. Le modèle choisi fournit pluie,
températures, énergie solaire et ET0 ; la `source` de chaque ligne dit le
modèle ; au-delà de sa portée, le jour entier vient d'« Automatique
d'Open-Meteo ». Le choix se vérifie par une lecture avant d'être gardé. Un
modèle retiré ramène la ferme à « Automatique », avec un message. Rien ne
dit quel modèle est le meilleur tant que « prévu contre mesuré par modèle »
n'existe pas.

**Pourquoi.** Chaque ferme n'avait qu'un modèle choisi en interne par
Visual Crossing, sans qu'on sache lequel. Un seul modèle par ferme tient le
réglage simple (après la simplification S1 à S6) et évite une règle de
combinaison, qui serait une règle agronomique réservée au porteur.

**Écartés ou rangés.** Plusieurs modèles, « Prudent », écart entre modèles,
modèle par usage, correction de biais par station : rangés hors version.
API officielles Météo-France : écartées. Aucune table recréée ; une colonne
additive sur les préférences météo.

**Points ouverts au porteur.** La licence « non commerciale » d'Open-Meteo
au regard d'un module gratuit pendant le pilote puis ~1 € par mois et par
ferme sans but lucratif ; le budget d'un abonnement. Le réseau du conteneur
n'atteint pas Open-Meteo : essais par GitHub (A) et par le Worker (B).
