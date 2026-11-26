# Contrat de la météo multi-modèles (choix du modèle de prévision par ferme) : v0.1 (D-339)

Écrit le 26 novembre 2026 **sans code** (Sonnet 5.5 · Moyen), sur le choix du porteur d'avancer la météo multi-modèles (message du 26 novembre 2026, 10 h 25). Il reprend la recherche du 8 novembre 2026 (`/mnt/project-files/meteo-modeles/synthese-choix-modeles-meteo.md`) **après relecture du dépôt** : là où la recherche et le code diffèrent, c'est le code qui fait foi (§ 2). Sources lues : `docs/weather-contract.md`, `db/schema.ts` (`irrigation_weather_daily_values`, `irrigation_weather_preferences`, `irrigation_weather_forecast_archive`), `lib/services/weather/configured-provider.ts`, `lib/domain/weather/weather-provider.ts`, `lib/adapters/weather/open-meteo-provider.ts`, `app/irrigation/water-actions.ts`, AGENTS.md (règles métier invariantes).

Rien de ce contrat ne s'applique à une ferme qui ne choisit rien : **réglage « Automatique », rien ne change** (§ 3, règle 1).

## 1. Objet

Aujourd'hui chaque ferme reçoit **un seul** modèle de prévision, celui que Visual Crossing choisit en interne, sans que personne sache lequel. Le porteur veut pouvoir **choisir le modèle Open-Meteo par ferme**. Le contrat dit :

- ce qui se choisit (un modèle de la liste du logiciel, ou « Automatique ») et où ;
- ce que le choix change dans les données, et ce qu'il ne change jamais ;
- comment la liste des modèles est tenue sans figer un nom dans l'écran ;
- ce qui est prouvé avant que le choix soit offert, puisque l'API Open-Meteo n'est **pas joignable depuis le conteneur de l'assistant** (le proxy refuse `api.open-meteo.com`, constaté le 26 novembre 2026) ;
- ce qui est **hors de cette version** (plusieurs modèles à la fois, mode « Prudent », modèle par usage, correction de biais) et à quelles conditions cela viendra.

Le logiciel est **multi-fermes** : rien n'est écrit pour la seule ferme du porteur.

## 2. Ce que le dépôt dit aujourd'hui (constats du 26 novembre 2026)

1. `WeatherProvider` (domaine) isole le fournisseur. Prévisions : Visual Crossing si la clé serveur existe, sinon Open-Meteo `api.open-meteo.com/v1/forecast` (`getConfiguredWeatherProvider`). Réanalyse et géocodage : toujours Open-Meteo.
2. **La recherche du 8 novembre disait** que l'endpoint Forecast d'Open-Meteo « refuse les requêtes de l'infrastructure Cloudflare partagée » (phrase reprise dans `docs/weather-contract.md`). **Cette phrase n'a pas été revérifiée depuis** ; la panne du 14 au 19 novembre 2026, elle, venait du `fetch` appelé comme méthode (D-164), pas d'un refus d'Open-Meteo, et la réanalyse Open-Meteo part du même Worker. Le refus de Forecast est donc un **doute à lever par un essai réel**, pas un fait (§ 7, essai B).
3. `irrigation_weather_daily_values` : clé `(workspace, lieu, date, nature)` ; **une seule ligne `forecast` par jour et par ferme**, avec `source` et `fetched_at`. L'archive des prévisions (D-297) garde aussi `source`. **Aucun besoin de changer ces tables** pour un seul modèle par ferme : la source dit quel modèle a écrit la ligne.
4. `irrigation_weather_preferences` : une ligne par ferme (mode de lieu, commune, états de synchronisation). C'est la place naturelle du réglage.
5. La tâche de 6 h 15 et les relectures de la journée (C1, D-303) **regroupent les fermes par lieu** et font une lecture par lieu. Avec des modèles différents, le regroupement devient **par lieu et par modèle** (§ 5).
6. La prévision alimente : la pluie prévue (comptée à 100 %), les alertes météo (5 bis, 5 quinquies : températures, pluie, énergie solaire), la jauge de réserve du sol (information, D-041/D-047), l'ET0 affichée (information, D-010) et l'objectif automatique (D-309, quand la ferme l'allume). Changer le modèle change donc ce que ces écrans **affichent**, jamais leurs règles.
7. Le pilote ne couvre que la France métropolitaine (`outsidePilotArea`). La liste de modèles est tout de même écrite pour **n'importe quel lieu** (§ 4), parce que cette limite peut tomber.

## 3. Règles

1. **« Automatique » est le défaut et ne change rien.** Une ferme sans choix garde exactement la lecture actuelle (Visual Crossing si la clé existe, sinon Open-Meteo). Aucune ferme existante n'est modifiée par la mise en ligne.
2. **Choisir un modèle est un choix de la ferme**, par exploitation (comme le curseur de microclimat), jamais par utilisateur ni global. Deux fermes au même lieu peuvent avoir deux modèles ; aucune ne voit ce qui est écrit pour l'autre (isolation, AGENTS.md).
3. **Un seul modèle par ferme dans cette version.** Le choix est un modèle de la liste du logiciel (§ 4) parmi ceux qui couvrent le lieu de la ferme, ou « Automatique d'Open-Meteo » (`best_match`, qui fusionne seul les meilleurs modèles du lieu).
4. **Choisir un modèle lit Open-Meteo, pas Visual Crossing, pour la pluie, les températures, l'énergie solaire et l'ET0 de la prévision.** L'ET0 est celle que le modèle fournit (`et0_fao_evapotranspiration`), pas notre FAO-56 : la source dit laquelle (§ 6). L'ET0 reste une information (D-010).
5. **Une donnée que le modèle ne donne pas reste `null`, jamais zéro** (D-003). Un modèle qui ne fournit pas l'ET0 ou l'énergie solaire laisse ces champs vides ; l'écran dit « non fournie par ce modèle ». La liste du § 4 ne contient que des modèles **vérifiés** pour les quatre séries du jour (essai A, § 7).
6. **Au-delà de la portée du modèle, on complète, et on le dit.** AROME ne prévoit que ~2 jours, ARPEGE ~4 : la ferme lit **le modèle choisi et `best_match` dans le même appel** ; pour chaque jour, la ligne vient du modèle choisi **tant qu'il donne la pluie du jour**, sinon **tout le jour** vient de `best_match` (jamais un mélange de champs d'un même jour) ; sa `source` le dit (§ 6). L'écran signale « jours complétés par Open-Meteo Automatique » avec le dernier jour du modèle choisi.
7. **La réalité prime toujours sur la prévision** (AGENTS.md) : pluie manuelle, réanalyse, historique immuable (D-006) sont inchangés. Le modèle ne touche ni la réanalyse ni la pluie mesurée.
8. **Le choix est vérifié avant d'être gardé.** Enregistrer un modèle fait **une lecture immédiate** ; si elle échoue (réseau, refus, réponse sans la pluie), **rien n'est enregistré**, le modèle précédent reste, et le message dit pourquoi en clair. C'est aussi la preuve, depuis le Worker, que l'endpoint répond (§ 7, essai B).
9. **Un modèle retiré par Open-Meteo ne casse pas la ferme.** La liste est du code (§ 4) ; si un modèle enregistré n'y est plus, ou ne couvre plus le lieu (la ferme change de commune), la ferme **revient à « Automatique »** (règle 1) et l'écran le dit une fois (« Le modèle X n'est plus proposé : la ferme lit de nouveau Automatique »), consigné au journal des modifications. Jamais silencieux.
10. **Aucune affirmation de qualité sans mesure.** Les aides en clair disent des faits vérifiables (finesse, portée, fournisseur, fréquence de mise à jour), pas « le plus précis » ni « le meilleur ». Qui se trompe le moins **sur la ferme** se mesurera plus tard (§ 9), avec l'archive des prévisions.
11. **Changer de modèle remplace les prévisions à venir, pas l'histoire.** Les lignes `forecast` des jours d'aujourd'hui et suivants sont réécrites par la lecture du choix (règle 8) ; les lignes des jours passés et l'archive (D-297) gardent leur `source` d'origine, et **ne sont jamais réécrites**.
12. **Alertes et besoins suivent sans règle nouvelle.** Les critères, seuils, jauges et l'objectif automatique lisent la même ligne `forecast` ; une alerte déjà envoyée n'est pas rejouée. L'écran de choix l'annonce : « Les alertes météo et les prévisions de la ferme utiliseront ce modèle. »
13. **Démonstration et parcours automatisés.** Le déploiement de démonstration ne lit jamais la vraie météo (`docs/demo-guided-contract.md`) : le réglage y est **absent**. `WEATHER_DATA_SOURCE=mock` sert une réponse fixe par modèle aux parcours navigateur.
14. **Pas de nouveau déclencheur planifié.** Les relectures existantes (6 h 15 et C1) lisent déjà par lieu ; elles lisent par lieu et par modèle (§ 5). Rien à inscrire au registre des tâches.

## 4. La liste des modèles (du code, jamais de l'écran)

Fichier de domaine unique `lib/domain/weather/forecast-models.ts`, testé : pour chaque entrée, l'identifiant Open-Meteo, le libellé en clair, le fournisseur, la finesse et la portée (texte court), la zone couverte (rectangle de latitude et longitude, à relever dans la documentation Open-Meteo au codage), et un indicateur « proposé ». Le contenu de départ, **à confirmer par l'essai A** avant le code :

| Libellé proposé | Famille Open-Meteo (à vérifier) | Portée | Zone |
| --- | --- | --- | --- |
| Automatique d'Open-Meteo | `best_match` | longue | partout |
| Météo-France (AROME puis ARPEGE) | `meteofrance_seamless` | ~4 jours | France et voisinage |
| DWD (ICON) | `icon_seamless` | ~7 jours | Europe |
| Centre européen (ECMWF) | `ecmwf_ifs025` | ~15 jours | partout |
| NOAA (GFS) | `gfs_seamless` | ~16 jours | partout |

Règles de tenue :

- plusieurs modèles de la recherche sont annoncés « en fin de vie » en novembre 2026 : **aucune liste figée dans l'écran, dans un test ou dans une base** ; l'écran lit la liste du code ;
- retirer ou renommer un modèle = une ligne de code et ses tests, aucune migration ; les fermes qui l'avaient retombent selon la règle 9 ;
- un modèle n'entre dans la liste que si l'essai A a montré qu'il rend les quatre séries (§ 3, règle 5) pour un lieu de la zone ;
- les libellés sont des mots du maraîcher (« Météo-France », « Centre européen »), pas des identifiants.

## 5. Lecture, regroupement et appels

- Un appel Open-Meteo Forecast demande `daily=precipitation_sum,temperature_2m_min,temperature_2m_max,et0_fao_evapotranspiration,shortwave_radiation_sum`, `models=<choisi>,best_match`, `timezone=Europe/Paris`, sur la fenêtre de la lecture. Le nom exact des séries suffixées par modèle (`..._<modèle>`) est **à relever par l'essai A** ; l'analyse de la réponse est stricte : une série attendue absente donne `invalid-response`, jamais un zéro.
- **Regroupement : une lecture par (lieu, modèle)**, quel que soit le nombre de fermes qui partagent ce couple. Deux fermes de même lieu et de modèles différents font deux lectures ; de même modèle, une seule. Chaque ferme écrit **ses** lignes ; aucune ligne ne traverse d'une ferme à l'autre.
- La clé du cache de bord inclut le modèle. Les limites d'Open-Meteo (gratuit : 600 appels par minute, 5 000 par heure, 10 000 par jour) restent très loin : de l'ordre de un appel par couple (lieu, modèle) et par passage. Le décompte des appels de `docs/weather-contract.md` est réécrit à la mise en ligne.
- Les erreurs, les `Retry-After`, la déduplication des requêtes identiques et le verrou par ferme restent ceux du contrat météo.
- **Modèle et ferme : aucun nouvel appel au chargement d'une page** ; seul l'enregistrement du choix (règle 8) fait un appel de plus.

## 6. Données et traçabilité

- **Une colonne neuve, additive** : `forecast_model` (texte, nul = « Automatique » au sens de la règle 1) sur `irrigation_weather_preferences`. Migration additive au prochain numéro libre au codage ; aucune table recréée, aucun export de la base demandé avant la fusion. Elle entre aux inventaires habituels (journal des modifications, export/import, tests de comptes).
- **`source` des lignes écrites** : `open-meteo:<identifiant du modèle>` quand le modèle donne le jour ; `open-meteo:best_match` quand le jour est complété (règle 6) ; `visual-crossing` et `open-meteo` comme aujourd'hui en Automatique. `fetched_at` inchangé. La source est donc **toujours** lisible par jour, dans la table et dans l'archive des prévisions.
- **ET0** : la ligne ne dit pas seule si l'ET0 vient du modèle ou de notre FAO-56 ; c'est la `source` qui le dit (`open-meteo:*` = ET0 du modèle ; `visual-crossing` = FAO-56 maison). Les écrans qui nomment l'ET0 gardent leurs mots ; l'aide du réglage explique la différence.
- **Attribution** : `weatherAttribution` cite Open-Meteo (CC BY 4.0) et, pour un modèle choisi, son fournisseur (« Météo-France », « DWD », « Centre européen »…). Aucune donnée de démonstration n'est jamais créditée à un fournisseur réel (règle existante).
- **Journal et alertes de synchronisation** : l'erreur d'une lecture d'un modèle suit le chemin existant (statut, date, raison bornée) ; aucune coordonnée, URL complète ni secret dans les journaux.

## 7. Ce qu'il faut prouver avant d'offrir le choix (réseau : essais par GitHub)

Le conteneur de l'assistant n'atteint pas Open-Meteo ; **aucune de ces preuves ne se fait de mémoire**.

- **Essai A, sur un lanceur GitHub** (workflow à déclenchement manuel, dépôt public donc gratuit, au plus 10 appels, aucune clé, aucun secret) : pour chaque modèle de la liste du § 4, un lieu de France métropolitaine ; relever (1) les noms exacts des séries dans une réponse à plusieurs modèles, (2) lesquelles des cinq variables chaque modèle rend, (3) la portée réelle en jours, (4) le comptage de l'appel (en-têtes de limite si présents). Le résultat est collé dans la PR du code (format, noms, portée) et **fixe la liste du § 4**.
- **Essai B, depuis le Worker déployé** : le premier enregistrement d'un modèle (règle 8) est la preuve ; la PR du code la rend aussi lisible dans les journaux (statut, date) et l'**ETAT_DU_PROJET** la consigne avec le résultat. Si Open-Meteo refuse en effet les requêtes de l'infrastructure partagée, la règle 8 empêche toute ferme de choisir un modèle qui ne marche pas, et le chantier **s'arrête là** avec la cause écrite, sans casser personne (option : passer par un autre chemin, décision du porteur).
- **Licence et prix : décision du porteur avant la mise en ligne** (§ 10, question 1).

## 8. Tests exigés (avant le code)

1. Domaine : la liste des modèles (zone, proposé, repli), le choix du jour (modèle donne la pluie → modèle ; sinon tout le jour de `best_match`), la règle 5 (null reste null) et la règle 9 (modèle retiré, lieu hors zone → Automatique).
2. Adaptateur : analyse d'une réponse à plusieurs modèles ; série absente → `invalid-response` ; réponse partielle ; erreurs et `Retry-After` comme aujourd'hui (jeux de réponses figés tirés de l'essai A).
3. Isolation : deux fermes au même lieu, deux modèles ; chacune ne reçoit et n'écrit que ses lignes ; une ferme en Automatique n'est pas touchée par le choix de l'autre ; le regroupement par (lieu, modèle) ne partage jamais une ligne.
4. Persistance : migration additive sur base vide et sur copie ; effacement de la ferme ; export/import ; comptes de colonnes ; changement de modèle ne réécrit ni jour passé ni archive.
5. Enregistrement du choix : échec de lecture → rien d'enregistré et message clair ; succès → lignes futures réécrites, archive intacte ; deux enregistrements rapprochés respectent le délai existant.
6. Écran : liste filtrée par zone, aides sans affirmation de qualité, message de complétion, message de retour à Automatique, absence en démonstration ; parcours navigateur avec le fournisseur fixe par modèle, à 390 px et sur ordinateur.
7. Alertes et besoins : à données égales, les mêmes règles donnent les mêmes décisions quel que soit le modèle (la règle ne dépend pas de la source).
8. Aucune régression pour une ferme sans choix : tous les tests existants passent sans modification.

## 9. Hors de cette version (rangé, à décider plus tard)

Ces pistes viennent de la recherche ; **rien n'est décidé, ni codé, ni daté** :

- **Plusieurs modèles à la fois** (jusqu'à trois), mode « Prudent » (la valeur la plus défavorable : le moins de pluie pour l'arrosage, le plus froid pour le gel) et affichage de l'**écart entre modèles** pour dire « d'accord / en désaccord ». Demande une table de séries par modèle (changement de clé, procédure de migration exceptionnelle) et des règles agronomiques sur « le plus défavorable » : **question agronomique réservée au porteur**.
- **Un modèle par usage** (par exemple un modèle fin pour la pluie à 1-2 jours, un long pour la tendance, le plus prudent pour le gel).
- **Mesurer qui se trompe le moins sur la ferme** : tableau « prévu contre mesuré par modèle », à partir de l'archive des prévisions (D-297, qui garde déjà la source) et des mesures de la ferme (station, pluviomètre). C'est le chantier « prévu contre réalisé » (contrat à part, en cours d'écriture) ; **ce contrat ne le remplace pas et n'en dépend pas**. Tant qu'il n'existe pas, le logiciel ne dit pas quel modèle est le meilleur (règle 10).
- **Correction d'un biais local** par station (type post-traitement statistique) : au moins un an de données pour les saisons ; hors de portée avant.
- Les API officielles Météo-France : écartées sans besoin nouveau.

## 10. Questions pour le porteur (une par message, avec recommandation)

Cinq points tranchés par l'assistant par son option recommandée (§ 11) ; **deux restent au porteur** : la licence et le budget, toujours à lui.

1. **Licence Open-Meteo « non commercial » (budget)** : l'offre gratuite d'Open-Meteo est réservée à un usage **non commercial**, avec attribution CC BY 4.0. Le module est gratuit pendant le pilote, puis ~1 € par mois et par ferme possible, **sans but lucratif** (PR #90). La frontière entre « non commercial » et « sans but lucratif » mérite d'être **demandée par écrit à Open-Meteo** (info@open-meteo.com, par vous : l'assistant n'écrit à personne, AGENTS.md) avant la première ferme tierce ; sinon, l'abonnement Standard (1 M d'appels par mois, **prix non affichés**, à demander) est la voie claire. Aujourd'hui la réanalyse passe déjà par Open-Meteo gratuit ; ce chantier **augmente** cet usage (la prévision aussi) mais pas le volume (§ 5).
2. **Mise en ligne seulement après la réponse d'Open-Meteo ?** Recommandation : **oui pour une ferme tierce, non pour votre ferme seule** (pilote privé, sans facturation).

## 11. Choix pris par défaut (option recommandée, modifiables par le porteur)

1. **Un seul modèle par ferme** dans cette version (règle 3) ; plusieurs, « Prudent » et « par usage » rangés au § 9 : plus simple pour le maraîcher (après la simplification S1 à S6), et la dispersion demande une règle agronomique qui est la vôtre.
2. **« Automatique » = lecture actuelle, inchangée** (règle 1) ; « Automatique d'Open-Meteo » est un **choix** de la liste, pas le défaut : on ne change aucune ferme sans qu'elle le demande.
3. **Complément par `best_match` au-delà de la portée** (règle 6), dit à l'écran, plutôt que des jours vides.
4. **Le choix se vérifie par une lecture avant d'être gardé** (règle 8).
5. **Place du réglage : la carte où l'on règle la commune de prévision** (« Réglages », météo), au plus un menu et une phrase d'aide, **rien sur « Aujourd'hui »**, par cohérence avec la simplification du module (S1 à S6) ; le texte exact est écrit au code, relu par le porteur à la recette.

## 12. Réglage de code et découpage

Trois PR, une à la fois, dans cet ordre, **après l'essai A** (PR 0) :

- **PR 0 : l'essai A** (workflow manuel sans secret, un script d'une page, résultat dans la PR du code). un script et un workflow, donc du code : **Opus 5.5 · Élevé**.
- **PR 1 : domaine et adaptateur** (`forecast-models.ts`, lecture multi-modèles, analyse stricte, jeux figés, `source` des lignes) : **Opus 5.5 · Élevé** (fonctionnalité délimitée sous contrat ; les tests et la CI jugent).
- **PR 2 : le réglage de la ferme et la synchronisation** (migration additive, enregistrement vérifié, regroupement par lieu et modèle, remplacement des jours à venir, retour à Automatique) : **Opus 5.5 · Max**, parce qu'une lecture est **partagée entre fermes** et qu'une ligne écrite pour la mauvaise ferme serait discrète et grave (critère 2 de la grille ; même raison que N3).
- **PR 3 : l'écran** (liste filtrée, aides, messages, parcours à 390 px et sur ordinateur, visite guidée si nécessaire) : **Opus 5.5 · Élevé**.

Le code d'un lot ne commence que sur la décision de l'ordre d'exécution (roadmap section 2) ; jamais Fable (D-055).

## 13. Preuve de fin

Les huit familles de tests du § 8 ; l'essai A collé dans la PR 1 ; l'essai B consigné ; la recette (constat de l'assistant, jugement du porteur) sur la ferme réelle **seulement sur son accord**, en choisissant un modèle puis en revenant à « Automatique » (retour à l'état de départ relevé avant) ; `docs/weather-contract.md` réécrit (fournisseur, source, décompte des appels, licence) à la mise en ligne.
