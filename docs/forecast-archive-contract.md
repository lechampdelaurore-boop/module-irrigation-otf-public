# Contrat de l'archivage des prévisions (idée rangée « Archivage des prévisions J+1 ») : v1.0

Écrit le 22 novembre 2026 sans code (brouillon v0.1), **codé le 22 novembre 2026** en Opus 5.5 · Élevé, sur le « vas-y pour tout » du porteur du 22 novembre 2026 à 10 h 53 : décision D-297, migration 0046, précisions F748 à F754 (§ 9). Sources lues dans le dépôt : `docs/weather-contract.md`, `db/schema.ts` (table `irrigation_weather_daily_values`), roadmap § 6 ter (« Idées rangées sans engagement »), contrat du banc MC-36 v0.1 (§ 4 point 5, § 6, § 9).

## 1. Objet

Aujourd'hui, la prévision d'un jour est **écrasée** à chaque nouvelle lecture (clé unique : exploitation, lieu, date, nature). La prévision faite la veille pour aujourd'hui n'existe donc plus. Ce contrat ajoute une **archive append-only** : chaque jour, on garde ce que le fournisseur annonçait ce jour-là pour les jours suivants, sans jamais l'écraser. But : plus tard comparer prévu et réalisé, et vérifier en conditions réelles la seconde passe du banc commun.

Ce que l'archive **ne fait pas** : aucun écran, aucune comparaison, aucun changement du calcul du besoin, des alertes ou de l'ET0 (D-010, D-041, D-047 inchangés). Elle ne sert à rien tant qu'un chantier ultérieur ne la lit pas.

## 2. Ce que l'archive peut et ne peut pas apporter au banc MC-36 (à dire clairement)

- Elle **ne rétroagit pas** : elle commence à sa mise en service. Elle ne peut donc **pas** alimenter la passe 2 sur les 3 années passées du banc. Pour celles-ci, le contrat MC-36 retient déjà l'archive « historical forecast » d'Open-Meteo, la même des deux côtés (couverture à vérifier par la PR 1 du banc, non vérifiée à ce jour). Aucun rattrapage du passé n'est prévu : l'offre gratuite de Visual Crossing ne le permet pas à notre connaissance (non vérifié).
- Elle sert à : (a) mesurer l'erreur réelle des prévisions que les maraîchers voient (pluie, ET0, températures) par horizon ; (b) valider ou corriger, sur des données vécues, les hypothèses de la passe 2 ; (c) nourrir plus tard, si le porteur le décide, une comparaison prévu/réalisé dans le module.
- Conséquence : **le banc n'attend pas cette archive** ; elle ne figure dans aucune condition de lancement de MC-36.

## 3. Règles

1. **Une photographie par lieu et par jour civil (heure de Paris).** Elle est prise lors de la **première lecture réussie** du jour : normalement la tâche de 06 h 15, sinon la première consultation ou actualisation réussie. Les lectures suivantes du même jour n'écrivent pas dans l'archive.
2. **Contenu d'une ligne** : exploitation, clé du lieu, jour d'émission, jour visé, horizon en jours (`jour visé − jour d'émission`), pluie prévue (mm), ET0 prévue (mm), températures min et max prévues, énergie solaire prévue, source, date et heure de lecture. Même sens des valeurs que `forecast` dans `docs/weather-contract.md`.
3. **Horizons gardés : J+1 à J+7.** J0 n'est pas archivé : il est écrasé dans la journée par des lectures plus fraîches, et la prévision du jour même n'est pas ce que le banc compare. J+8 à J+14 ne sont pas gardés (précision trop faible pour servir, volume inutile). Les alertes météo vont jusqu'à 7 jours (5 bis), d'où J+7.
4. **Jamais d'écrasement, jamais de correction.** Clé unique (exploitation, lieu, jour d'émission, jour visé) ; en cas de doublon, la première ligne est conservée (`INSERT … ON CONFLICT DO NOTHING`). Aucune mise à jour, aucune suppression sauf celles des points 7 et 8.
5. **Donnée absente = `NULL`, jamais 0** (règle invariante). Un jour où aucune lecture n'a réussi n'a **pas de ligne** ; il n'est pas reconstitué plus tard par une lecture d'un autre jour.
6. **Aucun appel externe de plus.** L'archive recopie la réponse déjà lue pour la table `forecast` (1 appel Forecast par lieu et par jour, inchangé). Les compteurs « nombre maximal d'appels » du contrat météo ne changent pas.
7. **Durée de conservation : 24 mois glissants**, purge par la tâche quotidienne (lignes dont le jour d'émission a plus de 24 mois). Un export complet reste possible avant (point 9).
8. **Isolation et effacement.** La table porte l'identifiant de l'exploitation comme la table météo existante : lecture et écriture toujours filtrées par exploitation. Elle est inscrite au plan d'effacement d'une ferme (`db/farm-erasure-plan.ts`), à l'inventaire du journal des modifications et aux comptages de données. Aucune donnée d'une autre exploitation n'est jamais lue pour remplir ou lire l'archive, même quand deux exploitations partagent un lieu (l'appel externe reste groupé, l'écriture se fait par exploitation).
9. **Sorties.** Aucun écran. Une lecture de domaine (`listForecastArchive(workspace, lieu, période)`) pour les chantiers futurs et pour l'export gratuit chiffré hebdomadaire de la 4.5 (la table y est ajoutée). Tout usage de l'archive d'une vraie ferme dans le banc MC-36 reste exclu (MC-36 § 9) sauf décision expresse du porteur.
10. **Changement de commune.** Les lignes gardent la clé du lieu de leur émission ; une nouvelle commune ouvre une série distincte, sans rien effacer.
11. **Défaut de lecture.** Si l'écriture de l'archive échoue, la lecture météo normale **n'échoue pas** et ne bloque pas l'écran ni la tâche : l'échec est journalisé (service, statut, date seulement, comme D-164) et la ligne manque ce jour-là.

## 4. Volume et coût

- Lignes : 7 horizons × 365 jours ≈ 2 555 lignes par exploitation et par an, soit 5 110 sur 24 mois. À ~100 octets la ligne, de l'ordre de **0,5 Mo par exploitation** (estimation de calcul, non mesurée). Pour 100 fermes : environ 50 Mo.
- Écritures : 7 par exploitation et par jour (une photographie par jour).
- **Coût supplémentaire : aucun appel payant, aucun service nouveau ; l'espace est négligeable devant la base D1 déjà payée avec le plan Workers (D-017)** ; le quota de D1 est relu par la PR de code (§ 9, F754) : aucun coût. Si le quota ou le coût s'avérait en cause, la question revient au porteur (budget toujours à lui).

## 5. Tests exigés (avant le code)

1. Première lecture du jour écrit 7 lignes ; une seconde lecture le même jour n'en ajoute pas et ne modifie pas les valeurs.
2. Le lendemain, une nouvelle photographie s'ajoute et la précédente est intacte (horizon J+1 d'hier ≠ valeur écrasée dans la table `forecast`).
3. Valeur absente du fournisseur = `NULL` en base, pas 0 ; horizon absent = pas de ligne.
4. Pas de ligne pour J0 ni pour J+8 à J+14.
5. Échec d'écriture de l'archive : la lecture météo réussit, l'échec est journalisé sans coordonnées ni URL.
6. Deux exploitations partageant un lieu : un seul appel externe, deux jeux de lignes distincts ; chacune ne lit que le sien.
7. Effacement d'une ferme : ses lignes disparaissent, celles des autres restent ; l'inventaire du journal des modifications et les comptages connaissent la table.
8. Purge à 24 mois : une ligne de 24 mois et 1 jour disparaît, une de 23 mois reste.
9. Changement de commune : deux séries distinctes, aucune perte.
10. Migration : appliquée sur base vide et sur copie d'une base réelle, sans toucher aux tables existantes (export du porteur avant fusion si une table est recréée, comme à la 4.5).

## 6. Réglage de code et découpage

- **Une seule PR de code**, petite (une table, une migration, une écriture dans le service de synchronisation météo, la purge, l'effacement, la lecture de domaine, les tests). Registres mis à jour dans la même PR (roadmap : tableau de la section 1, ordre de la section 2, bloc détaillé ; état du projet ; changelog ; décisions).
- **Réglage recommandé : Opus 5.5 · Élevé** (code qui touche la synchronisation météo et la base, donc la grille du code ; pas Max car le moteur n'est pas touché). À confirmer par la ligne de roadmap avant lancement ; Fable interdit.
- **Conditions de lancement** : un « vas-y » du porteur (l'idée est rangée sans engagement et n'est pas dans l'ordre d'exécution) et la file de migrations libre. **Remplies le 22 novembre 2026** : « vas-y pour tout » de 10 h 53 ; aucune autre PR ouverte n'ajoute de migration.
- Aucun contact avec la ferme réelle, Cloudflare (réglages), ni agronomie : pas d'exception du point 4 des consignes touchée.

## 7. Choix pris par défaut (option recommandée, modifiables par le porteur)

| Choix | Retenu | Pourquoi |
| --- | --- | --- |
| Archive par exploitation ou par lieu partagé | Par exploitation | Même schéma que la table météo, isolation et effacement simples ; surcoût de stockage négligeable |
| Horizons | J+1 à J+7 | Couvre le banc (J+1 à J+4) et les alertes (jusqu'à 7 jours) |
| Durée | 24 mois | Deux saisons complètes pour comparer ; purge simple |
| Quand photographier | Première lecture réussie du jour | Robuste à une panne de la tâche de 06 h 15 |
| Écran | Aucun | Hors périmètre, aucune promesse faite aux maraîchers |

## 8. Points encore ouverts

- Aucun qui demande le porteur avant le code. Le porteur décide seulement quand lancer (point 6) et si, plus tard, une comparaison prévu/réalisé entre dans le module (chantier à part, avec son propre contrat).
- Disponibilité d'un rattrapage du passé chez Visual Crossing : non vérifiée ; sans effet sur ce contrat.

## 9. Précisions du code (22 novembre 2026, D-297, F748 à F754)

Écrites avec le code, en Opus 5.5 · Élevé. Elles précisent les règles sans
rouvrir de choix du § 7.

**F748 · La photographie, ligne par ligne.** La clé est celle de la règle 4 :
(exploitation, lieu, jour d'émission, jour visé), et la première ligne
écrite reste. Une lecture du même jour ne change donc **jamais** une ligne
déjà écrite ; elle peut seulement **ajouter un horizon qui manquait**. Le cas
réel : la tâche de 6 h 15 a échoué et la première lecture réussie du jour
est une actualisation à l'écran, qui ne lit que la semaine affichée (un
samedi, J0 et J+1 seulement) ; sans cela, J+2 à J+7 manqueraient pour la
journée alors qu'une lecture plus tard les donne, émises le même jour. Ce
que la règle 1 protège (rien n'est écrasé, une lecture plus fraîche ne
remplace pas celle du matin) tient entier ; le test 1 du § 5 est joué tel
quel (sept lignes, une seconde lecture n'ajoute rien et ne change rien).

**F749 · Le jour d'émission.** C'est le jour civil de Paris de l'instant de
la lecture (D-004), quel que soit le fuseau renvoyé pour le lieu ; l'horizon
est `jour visé − jour d'émission`, de 1 à 7, et la base le vérifie
(contrainte `chk_forecast_archive_target`). Une lecture à 0 h 30 à Paris
(23 h 30 UTC la veille) émet le jour de Paris.

**F750 · Où l'archive s'écrit.** Juste après l'écriture des prévisions,
avec les mêmes valeurs et la même source : par la tâche de 6 h 15, pour
chaque exploitation du lieu (un seul appel externe pour toutes, règles 6
et 8), et par l'actualisation à l'écran. La météo **semée** d'une ferme
fictive de la démonstration (`seedDemoWeather`) n'est pas une lecture : elle
n'est pas archivée. Le service est `lib/services/weather/forecast-archive.ts`,
la règle des lignes `lib/domain/weather/forecast-archive.ts`, le dépôt
`db/forecast-archive-repository.ts`.

**F751 · Un échec d'écriture.** Il est rattrapé : la lecture météo, la tâche
du matin et ce qu'elles enregistrent (réussite, prochaine tentative) ne
changent pas. Le journal porte une ligne `weather_forecast_archive_failed`
avec le service (`forecast-archive`), le statut (`failed`) et la date,
**rien d'autre** : ni lieu, ni coordonnées, ni adresse, ni message de la
base (règle 11, D-164).

**F752 · La lecture de domaine.** `listForecastArchive(espace, lieu,
{ startDate, endDate })` rend les lignes dont le **jour visé** tombe dans la
période, bornes comprises, tous horizons, par jour visé puis jour
d'émission ; elle porte toujours l'exploitation. Aucun écran ne la lit.

**F753 · Conservation, effacement, comptages.** La table est une table
d'espace : elle est au plan d'effacement d'une ferme (`SPACE_TABLES`) et
part avec l'espace. Ses lignes vieillissent avant lui : elle a donc **sa
propre règle** au plan de conservation (`RETENTION_PLAN`, 24 mois, purge
`issued_on < ?` par la tâche « Purges de conservation » du matin), et la
règle commune des tables d'espace ne la compte plus ; le tableau de
`docs/tranche-4-contract.md` (10 bis.18) porte sa ligne. La limite est le
même jour vingt-quatre mois plus tôt, **gardé** (le dernier jour du mois
quand il n'existe pas). Elle est à l'inventaire du journal des
modifications, hors du journal (une synchronisation météo, §5.1 de son
contrat). Les « comptages de données » de la règle 8 sont ceux de
l'effacement et du contrôle de cohérence des espaces (F380), qui lisent la
base et la comptent sans code ; elle **n'entre pas** dans les comptes de
l'avertissement avant de décocher une case (`db/feature-data-counts.ts`),
qui ne comptent que ce que la ferme a saisi : l'y mettre changerait un
écran. L'export hebdomadaire chiffré (4.5) exporte la base entière : la
table y est sans rien ajouter.

**F754 · Le quota de D1, relu le 22 novembre 2026.** Pages de Cloudflare
lues ce jour : prix de D1 (mise à jour du 30 octobre 2026) et limites (du
20 novembre 2026). L'offre Workers payante inclut 50 millions de lignes
écrites, 25 milliards de lignes lues et 5 Go de stockage par mois ; une
écriture compte une ligne de plus par index. Une photographie, ce sont
7 lignes, chacune comptée pour la table et ses trois index (la clé primaire
composée en est un), soit 28 lignes écrites par ferme et par jour, environ
850 par mois : 100 fermes en écrivent environ 85 000, **0,17 % de ce qui est
inclus**. Le stockage, index compris, reste de l'ordre du mégaoctet par
ferme sur 24 mois (estimation de calcul, non mesurée) : environ 0,1 Go pour
100 fermes, contre 5 Go inclus et une base de 10 Go au plus. La purge lit
par l'index du jour d'émission. **Aucun coût supplémentaire.** Même sur
l'offre gratuite (100 000 lignes écrites par jour), 100 fermes n'en
prendraient que 2 800 par jour.
