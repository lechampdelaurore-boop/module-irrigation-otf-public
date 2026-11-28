# Contrat court — la météo prévue contre la météo réalisée (6 quindecies)

Écrit le 26 novembre 2026, sans code, en Sonnet 5.5 · Moyen (grille du travail
sans code). L'idée est rangée depuis le 7 novembre 2026 (D-065, roadmap
section 6 ter : « garder chaque jour la prévision … pour pouvoir plus tard
comparer prévu et réalisé »). Le porteur choisit de l'avancer le 26 novembre
2026. Le logiciel est multi-fermes : tout ce qui suit se calcule **ferme par
ferme**, rien n'est écrit pour le cas d'une seule.

**Ce que ce contrat n'est pas.** Il ne lance aucun code. Il ne change aucun
calcul : ni le besoin, ni l'objectif automatique, ni les alertes, ni la règle
« la pluie prévue compte pour 100 % » (décision du porteur, D-010, D-041,
D-047 inchangés). Il ne corrige rien tout seul. Il ne demande aucun budget :
aucune migration, aucune écriture, aucun appel externe de plus.

## 1. Ce qui existe

- **Les prévisions archivées** : depuis le 22 novembre 2026 (D-297,
  `docs/forecast-archive-contract.md`, table `irrigation_weather_forecast_archive`),
  une photographie par ferme, par lieu et par jour (heure de Paris) :
  ce qui était annoncé ce jour-là pour J+1 à J+7 (pluie, ET0, températures),
  jamais écrasé, gardé 24 mois. Le contrat de l'archive dit : « aucun écran,
  aucune comparaison » ; c'est ce chantier qui lit l'archive.
- **Le réalisé** (table `irrigation_weather_daily_values`) :
  - la **réanalyse** d'Open-Meteo (pluie et ET0 du jour passé), lue chaque
    matin sur J-10 à J-5 : elle arrive avec **environ cinq jours de retard** ;
    ce n'est pas une station de la ferme (`docs/weather-contract.md`) ;
  - la **pluie du pluviomètre** (`manual_precipitation`), saisie par la
    ferme : la vraie mesure, mais seulement les jours où la ferme l'a notée
    (un jour sans saisie n'est pas 0, règle invariante).
- Aucun écran ne montre aujourd'hui comment la prévision s'est comportée.

## 2. Le but, en une phrase

Dire à la ferme, avec des chiffres simples, **si la pluie et l'évaporation
annoncées se sont vérifiées**, à un jour, à quelques jours et sur la semaine,
pour qu'elle sache à quel point se fier à la météo du module. Rien d'autre :
pas de classement, pas de note, pas de recommandation d'arroser autrement.

## 3. Ce que l'on compare (les choix)

**3.1 Les couples.** Pour un jour visé D, la prévision faite à l'horizon h
(1 à 7) est la ligne de l'archive émise le jour D − h pour D. Elle est
comparée au réalisé du jour D. Un couple n'existe que si les deux valeurs
sont connues (jamais 0 à la place d'une valeur absente). Le jour J0 n'est
pas archivé, donc jamais comparé.

**3.2 Le lieu.** Seuls les couples du **lieu de météo actuel** de la ferme
entrent. Après un changement de commune, la série de l'ancien lieu reste en
base, sans être mêlée à la nouvelle (règle 10 de l'archive).

**3.3 Le réalisé de la pluie : deux lectures, jamais mélangées.**
- **Lecture de base : la réanalyse.** Elle existe pour toutes les fermes et
  tous les jours (avec son retard) ; c'est la seule lecture qui compare les
  mêmes jours partout. Elle se dit « pluie estimée ».
- **Lecture sur vos mesures** : la même comparaison, sur les seuls jours où
  la ferme a noté son pluviomètre. Elle ne s'affiche qu'à partir de
  **14 jours mesurés** dans la fenêtre ; elle se dit « pluie mesurée à la
  ferme ». Une ferme qui ne note que les jours de pluie n'est pas pénalisée :
  les jours sans saisie sont simplement hors de cette lecture.
- Les deux lectures ne sont pas fondues en une seule : on ne remplace pas, jour
  par jour, une valeur par une autre (cela changerait la nature du chiffre).

**3.4 Le réalisé de l'ET0 : la réanalyse seulement, avec une réserve dite.**
Il n'existe pas d'ET0 mesurée. La prévision de l'ET0 est **calculée par le
module** (FAO-56 Penman–Monteith, champs Visual Crossing) ; le réalisé est
l'ET0 **d'Open-Meteo** (autre source, autre calcul). L'écart mélange donc
l'erreur de la prévision et une **différence de méthode** que l'on ne peut pas
séparer. Trois précautions, toutes dites à l'écran :
- le libellé est « prévu contre réanalyse », jamais « prévu contre mesuré » ;
- l'écart à J+1 est montré comme **plancher** (« même la veille, l'écart est
  de … : une partie vient de la méthode ») ; ce qui s'y ajoute aux horizons
  plus lointains vient de la prévision ;
- aucun écart d'ET0 n'est jamais utilisé pour corriger le calcul.

**3.5 Les trois horizons.** Pour avoir assez de jours dans chaque ligne :
« demain et après-demain » (J+1, J+2), « dans 3 ou 4 jours » (J+3, J+4),
« dans 5 à 7 jours » (J+5 à J+7), plus un total « tous horizons ». Les
horizons ne sont jamais affichés un à un à l'écran ; le domaine les garde un
à un pour les chantiers futurs.

**3.6 La semaine.** C'est le chiffre qui compte pour l'arrosage (l'objectif
et l'objectif automatique raisonnent en mm par semaine). **La prévision de la
semaine est celle du dimanche d'avant** : émise le dimanche, elle couvre
exactement le lundi (J+1) au dimanche (J+7), les horizons que l'archive
garde. On compare, pour chaque semaine **entièrement réalisée et entièrement
archivée**, le cumul prévu au cumul réalisé (pluie et ET0).

**3.7 La fenêtre.** Les **90 derniers jours** (glissants, heure de Paris,
jours visés). Pas toute l'année : la fiabilité de la pluie change avec la
saison, un chiffre moyenné sur douze mois masquerait celle d'aujourd'hui. Les
24 mois de l'archive restent lisibles par la lecture de domaine pour un
chantier futur.

## 4. Les indicateurs

Pour chaque ligne d'horizon et chaque variable, sur les couples de la fenêtre.

**Pluie (par jour)**
1. **Écart moyen** en mm par jour, prévu moins réalisé : positif, l'annonce
   est trop pluvieuse (le sens qui expose à arroser trop peu, puisque la
   pluie prévue compte pour 100 %) ; négatif, elle n'annonce pas assez.
2. **Écart absolu moyen** en mm par jour.
3. **Jours de pluie bien annoncés** : un jour de pluie est un jour d'**au
   moins 1 mm** (convention météo ; une constante du domaine). Deux nombres,
   à dire ensemble : « annoncée mais pas tombée » et « tombée mais pas
   annoncée », en jours sur le total de couples.

**Pluie (par semaine)**
4. **Écart moyen du cumul** en mm, prévu moins réalisé, et **écart absolu
   moyen**, sur les semaines évaluables (3.6).

**ET0 (par jour puis par semaine)**
5. **Écart moyen** et **écart absolu moyen** en mm par jour ; **écart moyen
   du cumul** de la semaine en mm et en pourcentage du réalisé.

Pas de note sur 10, pas de feu vert-orange-rouge, pas de mot « fiable » ou
« peu fiable » : **aucun seuil n'est inventé avant d'avoir vu de vraies
données**. L'écran écrit des phrases à partir des nombres (section 6) ; un
verdict en mots pourra venir dans un second temps, avec des seuils fixés sur
ce que les fermes auront réellement montré, et la question agronomique que
cela pose (jusqu'où ces écarts sont tolérables pour l'arrosage) sera alors
posée au porteur.

## 5. Quand on se tait

La règle est la même partout : **pas de chiffre sans assez de jours**.

| Indicateur | Minimum pour s'afficher |
| --- | --- |
| Par jour, une ligne d'horizon | 14 couples dans la fenêtre |
| Pluie, lecture sur mesures | 14 jours mesurés (3.3) |
| Par semaine | 4 semaines évaluables |

Sous le minimum, la ligne dit « Pas encore assez de jours : 9 sur 14 » et ne
montre aucun autre nombre. Une ferme sans archive (créée récemment, ou sans
réanalyse encore) voit une phrase unique qui dit ce qui manque et à partir de
quand le premier chiffre est possible. **Rien n'est jamais complété, ni
estimé, ni rempli par une valeur d'une autre ferme.**

**Calendrier réel, à confirmer par un constat avant d'écrire « vu »** : l'archive
écrit depuis le 22 novembre 2026 ; la réanalyse d'un jour arrive vers J+5 ;
les 14 premiers couples de « demain et après-demain » sont donc possibles
**vers le 11 décembre 2026**, les 4 premières semaines évaluables **vers le
1er janvier 2027**. Le code peut être écrit avant ; l'écran de la vraie ferme
sera vide et le dira.

## 6. L'écran

- **Où.** Un pli **fermé** « La météo s'est-elle vérifiée ? » sur la page
  « Objectifs et besoins » (case `besoins`, qui porte déjà la météo et la
  pluie mesurée), sous la météo de la semaine. **Aucune page nouvelle, aucune
  case nouvelle dans Réglages, rien sur « Aujourd'hui »** : le premier niveau
  ne change pas (principe du lot S1). Toute ferme qui a la case `besoins`
  le voit ; il n'y a rien à allumer.
- **Contenu, pli ouvert** : une phrase de tête, puis deux petits tableaux
  (la pluie, l'ET0), une ligne par horizon (3.5) et une ligne « Cumul de la
  semaine » ; les nombres du section 4, avec l'unité ; au-dessous, les
  réserves (3.3, 3.4) en une phrase chacune.
- **Les phrases** sont écrites par le code à partir des nombres, au mot près
  du module (`lib/domain/simple-words.ts`), par exemple : « À 3 ou 4 jours, la
  pluie annoncée s'écarte en moyenne de 2,1 mm par jour de celle estimée.
  Sur la semaine, l'annonce du dimanche était trop pluvieuse de 4 mm en
  moyenne. » Le signe d'un écart est toujours écrit en mots (« trop
  pluvieuse », « pas assez pluvieuse »), jamais seulement « + » ou « − ».
- **États** : pas assez de jours (section 5) ; ferme sans lieu de météo ;
  lecture impossible (le pli dit qu'il ne peut pas se calculer, le reste de la
  page ne change pas).
- **Téléphone et ordinateur** : un seul empilement, tableaux à deux colonnes
  lisibles à 320 px, aucun défilement horizontal, cibles de 44 px, mots du
  tableau de la charte.
- **Démonstration** : les fermes fictives n'ont pas d'archive (la météo
  semée n'est pas une lecture, F750). La démonstration reçoit une archive et
  une réanalyse **semées**, déterministes, étiquetées « exemple » dans le
  pli, pour que l'on voie un écran rempli ; ces lignes ne sortent jamais
  d'une ferme fictive.
- **Notifications, alertes, « Aujourd'hui »** : rien. Un avertissement du
  type « la pluie annoncée se vérifie mal en ce moment » est une idée pour
  plus tard, sur des seuils qui n'existent pas encore.

## 7. Où vit le code

- Le calcul : un module de domaine pur, `lib/domain/weather/forecast-reliability.ts`
  (les couples, les cumuls de semaine, les indicateurs, les minimums, les
  phrases dans les mots du module), sans lecture de base ni horloge cachée.
- La lecture : une fonction de dépôt en lecture seule qui lit, par ferme et
  par lieu, l'archive et les valeurs réalisées de la fenêtre (via
  `listForecastArchive` de l'archive, F752, et la lecture des valeurs
  quotidiennes). **Toujours filtrée par l'exploitation ; jamais de donnée
  d'une autre ferme.** Environ 90 × 7 lignes d'archive et 180 lignes de
  valeurs par lecture : négligeable.
- L'affichage : le pli et ses tableaux dans la page « Objectifs et besoins »,
  chargé **à l'ouverture du pli** (pas à celle de la page), pour ne pas
  ralentir la page (lot N, lenteur du module).
- **Aucune migration, aucune écriture, aucun appel externe.** Aucune
  inscription au plan d'effacement : rien de nouveau n'est stocké.

## 8. Tests exigés (avant le code)

1. Le couple : une ligne d'archive émise le 1er pour le 3 est comparée au
   réalisé du 3, horizon 2 ; jamais au réalisé d'un autre jour.
2. Une valeur absente (prévue ou réalisée) ne produit **pas** de couple et
   n'est jamais lue comme 0 ; une pluie de 0 mm réelle, elle, est un couple.
3. Écart moyen : signe vérifié (prévu 5, réalisé 1, écart +4, « trop
   pluvieuse »). Écart absolu, jours de pluie (seuil 1 mm : 0,9 mm n'est pas
   un jour de pluie, 1,0 mm l'est), les deux erreurs de pluie comptées
   séparément.
4. La semaine : la prévision du dimanche couvre lundi à dimanche aux
   horizons 1 à 7 ; une semaine à un jour réalisé manquant ou à une ligne
   d'archive manquante n'est **pas** évaluable et n'entre pas.
5. Les minimums : 13 couples, aucune autre valeur que « 13 sur 14 » ; 14,
   les nombres paraissent. Trois semaines : rien ; quatre : le cumul paraît.
6. Les deux lectures de la pluie ne se mélangent pas : une ferme qui a 20
   jours mesurés et 60 estimés voit deux jeux de chiffres distincts ; avec 10
   jours mesurés, la lecture sur mesures est « pas encore assez ».
7. Changement de commune : les couples de l'ancien lieu n'entrent pas dans la
   fenêtre du nouveau.
8. Deux fermes qui partagent un lieu : chacune ne voit que ses couples et
   ses mesures de pluviomètre.
9. La fenêtre : un couple de 91 jours est exclu, un de 89 jours entre.
10. Les mots : une phrase par cas (trop pluvieuse, pas assez, quasi nul),
    sans mot de calcul au premier niveau (garde du module des mots).
11. Parcours : démonstration (pli fermé, ouvert, deux tableaux, étiquette
    « exemple », un téléphone de 320 px sans défilement horizontal), ferme
    vierge (« pas encore assez de jours », aucun nombre), ferme sans lieu.
12. Aucun calcul changé : les tests existants du besoin, de l'objectif
    automatique et des alertes passent à l'identique, sans édition.

## 9. Découpage, réglage du code et lancement

- **Deux PR, une à la fois** : **PR 1**, le domaine et la lecture, avec les
  tests 1 à 10 et 12 (aucun écran) ; **PR 2**, le pli, la démonstration, le
  parcours (test 11), les registres. Registres mis à jour dans chaque PR
  (roadmap : tableau de la section 1, ordre de la section 2, bloc détaillé).
- **Réglage recommandé : Opus 5.5 · Élevé** (code de domaine et d'écran, sans
  migration, sans toucher au moteur ni à l'écriture ; pas Max pour cette
  raison ; confirmé par la ligne de roadmap avant lancement ; Fable interdit).
- **Conditions de lancement** : la relecture et le « vas-y » du porteur (l'idée
  était rangée sans engagement) ; rien d'autre n'attend. L'idée ne dépend ni
  d'OTF, ni de Nicolas, ni d'une date. Aucune donnée de la ferme réelle n'est
  écrite ; **tout constat sur la ferme réelle (l'écran vide, puis rempli) se
  fait en lecture seule, dans le Chrome du porteur, avec son accord à chaque
  fois**. La recette se fait d'abord sur la démonstration.
- **Fichiers touchés** : la page « Objectifs et besoins », un module de domaine
  nouveau, un dépôt en lecture, les mots simples ; pas de recouvrement avec
  l'objectif automatique (O1 à O4, en ligne) ni avec le lot S4.

## 10. Hors périmètre, et idées pour la suite (sans engagement)

- **Les températures** (gel, chaleur) : l'archive garde la prévision du
  minimum et du maximum, mais la réanalyse n'en garde pas le réalisé. Le
  réalisé existe dans la même réponse Open-Meteo (aucun appel de plus) ; il
  faudrait une colonne de plus et une migration, et c'est la fiabilité des
  **alertes de gel** que cela dirait. À proposer au porteur quand ce premier
  écran aura vécu.
- **Un verdict en mots**, des seuils, un avertissement sur « Aujourd'hui » :
  après de vraies données (section 4).
- **Utiliser l'écart pour corriger** le calcul (par exemple compter moins que
  100 % de la pluie prévue) : décision **agronomique réservée au porteur**,
  chantier à part avec son contrat ; ce contrat n'y prépare rien.
- **Mettre les fermes en commun** (une fiabilité du lieu à partir de
  plusieurs fermes) : exclu ; chaque ferme ne lit que ses données.
- **Le banc commun** (MC-36) : il a sa propre archive de prévisions
  historiques ; rien d'ici n'y entre (contrat de l'archive, § 9).

## 11. Questions

**Aucune ne demande le porteur avant le code.** Les choix pris par
l'assistant, modifiables d'un mot avant le lancement : le pli sur « Objectifs
et besoins », sans nouvelle case ; la fenêtre de 90 jours ; les minimums de
14 jours et de 4 semaines ; le seuil de 1 mm ; aucun verdict en mots ; la
semaine lue sur la prévision du dimanche.

## 12. Risques

- **Un écran vide longtemps** (jusqu'à fin décembre pour la semaine) : dit,
  avec la date attendue ; l'écran n'est pas une promesse de résultat.
- **L'ET0 comparée à une autre source** : réserve dite (3.4) ; l'écart de J+1
  sert de plancher ; aucun usage pour corriger.
- **La réanalyse n'est pas une station** : dite à l'écran ; la lecture sur les
  mesures du pluviomètre, dès qu'elle existe, est la plus proche du terrain.
- **L'archive peut avoir des jours manquants** (lecture échouée, F751) : un
  jour sans ligne n'est pas comblé ; il réduit seulement le nombre de couples.
- **Une lecture trop précise** donnée à une ferme qui s'y fie pour décider :
  d'où les minimums, l'absence de verdict et les phrases au conditionnel de
  fait (« en moyenne »).

## 13. À remplir par les PR

Numéros de précisions (F) et de parcours (P) : à prendre à la lecture du
dépôt au moment du code, après les PR ouvertes.

- **PR 1** (le calcul et la lecture, 26 novembre 2026) : D-343, précisions
  F998 à F1004 ; aucun parcours. La date des premiers chiffres de la
  section 5 est calculée par le domaine (F1004) : vers le 5 décembre 2026
  pour une archive commencée le 22 novembre, à confirmer par un constat.
- **PR 2** (le pli, la démonstration, les parcours, 26 novembre 2026) :
  D-344, précisions F1005 à F1008 ; parcours P71 (ferme vierge) et V12
  (démonstration). Sur la démonstration, le cumul de la semaine reste à
  « 3 sur 4 » (F1005).
