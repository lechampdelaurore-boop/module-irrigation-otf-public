# Contrat de la démo guidée (ouverture de la Tranche 4)

Contrat écrit le 7 novembre 2026, **sans code**. Il doit pouvoir être codé dès que la 3.9 est terminée. Statut : **validé par le porteur le 8 novembre 2026** (les 4 questions sont répondues, section 12 ; décision D-096). Registre : ligne 25 et bloc 4.0 de `docs/ROADMAP.md`. Réponses : 1 oui (profils A, B, C et ferme vierge) ; 2 oui (quatre moments de saison) ; 3 oui, second Worker et seconde D1 avec relevé du coût après un mois (vérification des tarifs faite dans un autre fil : 0 $ de plus tant que l'usage reste dans le forfait ; complément du 8/11 : adresse workers.dev ou sous-domaine d'une zone que le porteur possède déjà, sans frais indiqués, donc aucun domaine à acheter ; le coût du contrôle d'accès par courriel (Cloudflare Access) reste NON CONFIRMÉ, très probablement gratuit pour 2 ou 3 invités, à confirmer dans le tableau de bord Cloudflare avant le « vas-y » de D4, avec alerte de facturation) ; 4 Nicolas et Vincent, Vincent étant le développeur d'OTF. Les autres choix sont tranchés sur la recommandation (règle du 7/11, 00 h 17) et consignés en section 3.

## 1. Objet

Une **ferme de démonstration** que l'on peut ouvrir et manipuler, accompagnée d'une **visite guidée**, pour :
- montrer le module à d'autres fermes et à Nicolas (Tlaloc), sans OTF, sans jeton, sans rien risquer ;
- aller vite : elle ne dépend **ni de l'identité (4.1 à 4.3) ni de la connexion d'une ferme à OTF (4.4)** ;
- servir plus tard de terrain d'essai et de formation.

**Hors périmètre** : connecter une vraie ferme, stocker des jetons OTF, rôles, accès public anonyme, mesure d'audience, version anglaise, application mobile. Tout cela est dans 4.1 à 4.7.

## 2. Contraintes tenues (non négociables)

1. **Multi-fermes.** La démo montre au moins trois fermes fictives différentes, jamais la seule ferme du porteur (section 6).
2. **Aucune donnée de démo ne touche une vraie ferme, et inversement.** Garde-fous en couches (section 5).
3. **OTF en lecture seule, et en démo : zéro appel OTF.** La démo n'a ni jeton ni accès réseau à OTF.
4. **Aucune donnée réelle de la ferme du porteur dans la démo.** Les jeux de la 3.9 (« la ferme en chiffres », `tests/support/planning-fixtures.ts`) sont aux valeurs de la ferme réelle : ils **ne servent pas** de matière à la démo.
5. **Aucun secret** vu, saisi ou consigné par l'assistant (AGENTS.md). Les secrets de la démo (accès, base) sont créés par le porteur.
6. Règles du projet inchangées : contrat avant code, une PR par point, registres dans la PR, un seul chantier de code à la fois, 4 requêtes par seconde au plus vers OTF (sans objet en démo).

## 3. Choix tranchés sur la recommandation (à consigner en D-xxx à l'ouverture du code)

| N° | Question | Choix retenu | Raison |
| --- | --- | --- | --- |
| C1 | Où vit la démo ? | **Un déploiement séparé** du même code : Worker propre, base D1 propre, aucun secret OTF | La séparation physique est la garantie la plus forte qu'aucune vraie ferme n'est touchée ; elle évite d'attendre l'isolation multi-fermes (4.2) |
| C2 | Qui peut entrer ? | **Sur invitation, par courriel** (le contrôle d'accès actuel, code reçu par courriel). Pas d'accès anonyme | Évite l'abus et le coût de calcul ; reprend l'avis de la recherche (« sur compte ») |
| C3 | Données figées ou vivantes ? | **Figées et déterministes**, avec une **date simulée par scénario** (le jour de la démo ne change pas le résultat) | Une démo qui change selon le jour ne se prépare pas ; même principe que le parcours P13 (« ne dépend ni du jour ni de la minute ») |
| C4 | Les modifications faites en démo ? | **Permises** (c'est le but d'essayer), dans la base de démo seulement. **Espace propre par invité**, bouton « Remettre la démonstration à zéro », et remise à zéro automatique chaque nuit | Pas de pollution entre visiteurs ; démo toujours propre |
| C5 | Combien de fermes fictives ? | **Trois profils** (section 6) | Montre que le module n'est pas celui d'une seule ferme et fait voir les fonctionnalités à la carte (3.8) |
| C6 | Visite guidée : forme | Bulles ancrées sur l'écran, étapes **passables**, **reprenables**, une visite par thème (section 7) | Cadre adapté à des visiteurs qui ne connaissent ni le Kc ni le logiciel |
| C7 | Notifications push | **Désactivées** en démo (Worker Push non déployé, aucune clé de notification) | Évite d'envoyer quoi que ce soit à de vrais abonnés |
| C8 | Écran « relier ma ferme OTF » | **Absent** de la démo ; la dernière étape de visite dit en une phrase comment on relierait sa propre ferme | Pas de saisie de jeton dans une démo ; l'écran réel est le chantier 4.4 |
| C9 | Mesure d'audience | **Aucune** | Données personnelles minimales ; pas d'avis juridique disponible |
| C10 | Langue | **Français seulement** | Même chose que le module |
| C11 | Mise à jour de la démo | **Redéployée à chaque déploiement vérifié de la production**, au même commit, comme job séparé | Une démo en retard montre un autre produit ; la méthode du projet interdit les publications manuelles (Q0) |
| C12 | Dépendance à 4.1–4.3 | **Aucune** : la démo passe avant l'identité | C'est la condition pour « aller vite » |

Réglage de la roadmap pour le code : la recherche du 7/11 cite la ligne 25 (« la Tranche 4 s'ouvre par la démo guidée avec saisons ») avec **Opus 5.5 · Élevé**. **À relire dans le dépôt à jour au lancement** (voir section 11) ; Fable est interdit, tout réglage inférieur à la roadmap aussi.

## 4. Ce que la démo contient

- Le module **tel qu'il est** (même code, mêmes onze pages, mêmes calculs). Aucun écran de démo qui ne serait pas un vrai écran : on montre le vrai produit.
- Une **bannière permanente** : « Démonstration : données fictives. Rien ici ne touche une vraie ferme. » avec le bouton de remise à zéro. Elle suit la charte du module (section 9).
- Un **sélecteur de ferme de démonstration** (trois profils + « ferme vierge »), et pour chaque profil un **sélecteur de scénario de saison**.
- La **visite guidée** (section 7).

## 5. Garde-fous : « la démo ne touche jamais une vraie ferme »

Cinq couches, chacune avec un test. Une seule qui tombe ne doit pas suffire.

1. **Séparation physique.** Worker, base D1, domaine et secrets propres à la démo. Le déploiement de démo n'a **aucun** secret `OTF_API_TOKEN`, aucune clé de météo réelle, aucune clé de notification.
2. **Mode démo qui échoue fermé.** Une variable `DEMO_MODE` (nom à confirmer en lisant le code) force `OTF_DATA_SOURCE=mock` et `WEATHER_DATA_SOURCE=mock`. Au démarrage : si `DEMO_MODE` est actif **et** qu'un jeton OTF ou la source `live` est présent, le Worker **refuse de démarrer**. Inversement, une production qui voit `DEMO_MODE` refuse de démarrer. *Test : démarrage refusé dans les deux sens.*
3. **Pas de réseau sortant.** En démo, tout appel vers un hôte autre que la base ou le propre site est refusé. Les dessins d'espèces d'OTF (P41) restent la feuille verte sans réseau déjà prévue hors production. *Test : un appel vers `ouvretaferme.org` ou un fournisseur de météo fait échouer le test.*
4. **Données fictives vérifiées.** Un test compare les identifiants et noms de la démo à ceux des jeux « aux valeurs de la ferme réelle » et **échoue si un nom de lieu, de planche ou de parcelle réel est repris**. Aucun export de ferme n'est versionné (AGENTS.md).
5. **Isolation par espace.** Chaque invité a son espace ; le test d'isolation S28 de la 3.9 est étendu à deux invités de la démo. Aucune lecture croisée.

Corollaire : la remise à zéro n'efface que la base de démo (identifiants de déploiement différents, jamais de commande qui vise une base de production).

## 6. Les fermes fictives (multi-fermes)

À construire par **jeu de données propre à la démo** (fichiers dédiés, sans script de peuplement dans l'application, comme le demande le contrat 3.9). Pour respecter l'agronomie : **uniquement des espèces déjà dans le catalogue Kc validé** et des valeurs de sol déjà utilisées par le module. **Aucune nouvelle valeur agronomique** n'est introduite par ce chantier ; si elle devenait nécessaire, elle irait au porteur.

Profils proposés (à valider, question 1 sur 4) :

| Profil | Ce qu'il montre | Cases cochées (3.8) |
| --- | --- | --- |
| **A. Maraîchage diversifié** : plein champ et tunnels, une réserve et une pompe | Le cœur du module : besoin, planning, pénurie, réserve | Presque tout |
| **B. Petite exploitation, une seule ressource directe** | L'arrosage sans réserve ; le calculateur « millimètres → temps » | Matériel, Arrosages, Objectifs |
| **C. Ferme qui ne veut que les vannes et les alertes** | Le module à la carte : une ferme qui ne coche presque rien | Matériel, Alertes météo |
| **Ferme vierge** | Première ouverture, liste de cases à cocher, état « non finie de configurer » (non vérifié à ce jour dans l'audit) | Rien coché d'avance |

Chaque profil a des **communes météo différentes** (valeurs par défaut adaptées par région, comme l'exige l'audit, point 10), des noms de lieux **inventés**, et des tailles différentes. Le profil A reprend la ferme de démonstration actuelle (`lib/adapters/mock-data.ts`, `mock-crop-plan.ts`, 15 planches sur 4 saisons), étendue au besoin.

### Scénarios de saison

Chaque profil propose des **moments** (date simulée) qui font voir quelque chose de précis. Proposition de départ pour le profil A (à valider, question 2 sur 4) :
1. Printemps, nuit de gel annoncée (alerte cultures).
2. Début d'été, semaine normale (planning complet, tout se place).
3. Pic d'été, **pénurie** (réserve basse : budget, fractions, « Non placé » et leur motif, issus de la 3.9).
4. Automne, fin de saison (historique, cumuls).

Les jeux de la 3.9 (scénarios S1 à S28) fournissent le comportement du moteur ; on ne les copie pas, on les **réutilise comme preuve** que chaque moment montre bien ce qu'il annonce (un test par moment).

## 7. La visite guidée

### Principe
Des **bulles** ancrées sur des éléments de l'écran, avec un texte court, un bouton « Suivant », « Passer » et « Quitter la visite ». Elles se **raccrochent par un attribut stable** (par exemple `data-tour="..."`), jamais par le texte ou la position du menu : le menu, déjà réordonné en 3.8 (P36) et que la deuxième passe restyle, peut encore changer.

### Visites proposées (une par thème, 2 à 4 minutes chacune)
1. **Bienvenue** : ce qu'est le module, ce que la démo contient, comment la remettre à zéro, comment passer d'une ferme à l'autre.
2. **Un arrosage de A à Z** : choisir une planche, un matériel, une quantité, valider ; comprendre « d'où vient ce chiffre » (bulles de la 3.8).
3. **Le planning** : propositions, créneaux, valider ou refuser ; ce qu'est « Non placé » en mots simples.
4. **Quand l'eau manque** : le scénario de pénurie (3.9).
5. **Alertes** : gel prévu, marge, l'alerte qui vous parvient.
6. **Le module à la carte** : cocher et décocher des fonctionnalités (profil C et ferme vierge).
7. **Et pour ma ferme ?** : une page de texte, sans saisie, qui dit comment on la relierait (OTF en lecture seule, jeton lu seulement, chantier 4.4).

### Règles
- Aucun jargon non expliqué (le Kc, la RFU, le K_abri sont dits en clair ; la visite est écrite pour quelqu'un qui n'a jamais vu le module). Les points 7 et 8 de l'audit (titres de pages, vocabulaire technique) se **corrigent d'abord** s'ils nuisent à la visite ; sinon la visite les contourne par ses mots.
- **Reprenable** : l'étape en cours est rangée côté navigateur (rien de sensible), avec repli propre si le stockage est refusé.
- La visite **ne fait jamais d'action à la place du visiteur** et ne valide rien sans clic de sa part.
- Si un élément ancré est absent (case décochée, page masquée), l'étape est **sautée** sans message d'erreur.

## 8. Remise à zéro

- **Bouton** dans la bannière : remet l'espace de l'invité dans l'état initial du profil et du scénario courants, après confirmation (rien de destructif sans confirmation, comme le veut le porteur).
- **Automatique chaque nuit** : tâche planifiée du Worker de démonstration qui réinitialise les espaces inactifs depuis plus de 24 heures. Elle ne vise que la base de démo (section 5, corollaire).
- Le courriel de l'invité est conservé le temps de l'invitation et supprimé quand le porteur retire l'invité (données personnelles minimales ; pas d'avis juridique, section 10).

## 9. Charte et accessibilité

- La bannière et les bulles suivent la charte du module (`docs/charte-module.md`) : feuille #f8f8f8, bloc blanc, rayon 0,75 rem, ombre légère ; action principale #0b694d texte blanc, secondaire contour vert sur #cce2d1 ; DM Sans pour les boutons, Open Sans pour le texte ; icônes au trait, **sans emoji** ; cibles tactiles ≥ 44 px.
- Sur téléphone, les bulles s'ouvrent **en feuille basse au-dessus de la barre du bas** (charte §7, barre à deux étages) sans la masquer, et le texte tient dans l'écran (pas de défilement horizontal, point validé par l'audit).
- Accessibilité (reprend l'audit, point 14) : focus déplacé dans la bulle et rendu à l'élément ensuite, touche Échap, ordre au clavier, annonce par lecteur d'écran (`aria-live`), respect de `prefers-reduced-motion`, anneau de focus 3 px vert à 70 %.
- Contrastes des textes de la visite : 4,5:1 mesurés (à mesurer, non vérifié à ce jour).

## 10. Risques

| Risque | Gravité | Piste |
| --- | --- | --- |
| Une vraie donnée de ferme se glisse dans la démo | Grave | Jeux dédiés, test de comparaison (couche 4), relecture de la PR par grep des noms réels |
| La démo est branchée par erreur sur la production | Très grave | Séparation physique + refus de démarrer dans les deux sens (couches 1 et 2) |
| La visite se casse à chaque refonte de l'écran | Moyen | Ancrage par attribut, étape sautée si absente, un test de parcours par visite |
| Un visiteur abuse de la démo (calcul coûteux : le rendu dépasse déjà 10 ms, plan payant) | Moyen | Accès sur invitation ; espace par invité ; surveiller le coût |
| Le contenu de la démo est jugé faux par un agronome (valeurs du sol, périodes) | Moyen | Aucune nouvelle valeur agronomique ; scénarios validés par le porteur (question 2) |
| Données personnelles (courriels des invités) | À faire examiner | Conserver le minimum, supprimer au retrait de l'invitation ; avis juridique hors compétence de ce contrat |
| Montrer le nom et la mise en page d'OTF à des tiers sans l'accord d'OTF | À trancher | Question 4 sur 4 |
| Les tranches 4.1–4.3 rendent le déploiement séparé inutile plus tard | Faible | Il reste utile comme terrain d'essai ; sa suppression est un choix futur |

## 11. Découpage proposé, preuves et lancement

Une PR par point, un seul chantier de code à la fois, chaque PR fusionnée après déploiement vérifié de la précédente. Chaque PR met à jour les registres (tableau de la roadmap, ordre, bloc détaillé, CHANGELOG, DECISIONS).

| PR | Contenu | Preuve de fin |
| --- | --- | --- |
| D1 | **Garde-fous du mode démo** : `DEMO_MODE`, refus de démarrer dans les deux sens, bannière, push et saisie de jeton absents, blocage du réseau sortant | Tests des couches 2 et 3 ; contrôles complets |
| D2 | **Fermes fictives et scénarios de saison**, date simulée, test de non-reprise des noms réels | Tests des couches 4 et 5 ; un test par moment |
| D3 | **Visite guidée** (moteur de bulles, contenu des sept visites) | Parcours navigateur aux deux largeurs, un par visite ; contrôle d'accessibilité |
| D4 | **Remise à zéro et déploiement séparé** (Worker et D1 de démonstration, tâche de nuit, job de déploiement après la production) | Déploiement vérifié job par job ; remise à zéro essayée pour de vrai |

Contrôles avant chaque PR (point 9 des instructions) : `pnpm lint`, `typecheck`, `test`, `build`, `knip`, `push:check`, `weather:check` et `e2e` pour D1 à D4. Sorties collées dans la PR.

**Ce qui exige le « vas-y » exprès du porteur** (point 4 des instructions) : tout changement **Cloudflare** (création du Worker de démonstration, de la base, du domaine, du contrôle d'accès, des secrets : en D4) ; toute recette sur la ferme réelle (aucune n'est prévue ici ; la démo ne la touche pas).

**À relire à l'ouverture du code** (non vérifié à la rédaction, car le dépôt à jour n'était lisible qu'en copie locale) :
- la ligne de la roadmap pour la Tranche 4 et son réglage « Modèle · effort » : la copie locale lue le 7/11 ne contient pas la phrase « démo guidée avec saisons » que cite la recherche (commit `106e561`) ; le dépôt à jour fait foi ;
- les noms exacts des variables (`OTF_DATA_SOURCE`, `WEATHER_DATA_SOURCE`, `LOCAL_DEMO_USER`), l'existence d'une horloge injectable pour la date simulée, et la structure de `mock-data.ts` ;
- l'état de la deuxième passe « à la manière d'OTF » (#279) et de l'audit ergonomique : la visite doit se coder **après** leur mise en ligne pour ne pas être refaite.

## 11 bis. Précisions faites en codant D1 (13 novembre 2026, D-103)

Tranchées par la recommandation, sans valeur agronomique ; chacune reste
modifiable par le porteur.

- **F153 — le réglage.** Il s'appelle bien `DEMO_MODE`. Vide ou `false` : le
  module se comporte exactement comme avant (production, développement,
  parcours navigateur). `true` : démonstration. Toute autre valeur
  (`1`, `yes`, `TRUE`…) refuse de démarrer, en production comme en
  démonstration.
- **F154 — le refus de démarrer**, contrôlé une fois par `instrumentation.ts`
  avant toute page (vinext l'attend et mémorise son échec : toutes les pages
  répondent par une erreur tant que la configuration ne change pas). Il
  couvre, au-delà du jeton OTF et de la source `live` du contrat, la météo
  `live`, la clé de météo, le jeton du service de notification, la liaison
  au Worker de notification et le jeton de synchronisation météo : tout ce
  que la couche 1 interdit à la démonstration. Le message nomme les
  réglages en cause, jamais une valeur. Conséquence constatée : la
  configuration de production (`wrangler.jsonc`, liaison au Worker de
  notification) ne peut pas servir à la démonstration ; D4 aura la sienne.
- **F155 — le réseau sortant.** Une seule exception à la couche 3 : le
  domaine Access de l'équipe (`ACCESS_TEAM_DOMAIN`, en `https`, origine
  exacte), dont les clés publiques vérifient la connexion des invités (C2).
  La base D1 et le Worker lui-même ne passent pas par le réseau. Sans
  domaine Access lisible, rien n'est joignable. La garde se pose sur l'appel
  réseau du Worker au démarrage, avant le chargement des pages ; un refus
  nomme l'hôte seul, jamais le chemin.
- **F156 — les sources et les notifications.** En démonstration, Ouvre ta
  ferme et la météo sont celles de démonstration même quand rien n'est posé
  (la météo vaut `live` par défaut hors démonstration). Aucune notification :
  pas de clé publique, service désactivé, pas de cloche ; dans Réglages et
  dans Alertes météo, la ligne « Démonstration : les notifications du
  téléphone sont désactivées, rien n'est envoyé. » remplace l'abonnement de
  l'appareil.
- **F157 — la bannière**, au-dessus de la barre du haut, sur toutes les
  pages (première ouverture, données indisponibles et page introuvable
  comprises), sans bouton pour la fermer ; le bouton « Remettre la
  démonstration à zéro » s'y ajoute en D4, avec la remise à zéro.

## 11 ter. Précisions faites en codant D2 (13 novembre 2026, D-104)

Tranchées par la recommandation, sans valeur agronomique nouvelle ; chacune
reste modifiable par le porteur. Deux choix agronomiques lui sont posés
(les espèces de chaque ferme, le sol) : le code suit la recommandation en
attendant sa réponse, et changera si elle diffère.

- **F158 — un espace par invité, par ferme et par moment** (couche 5).
  L'identité d'un espace de démonstration est celle de l'invité suivie de
  la ferme et du moment ; les essais faits dans un moment ne débordent ni
  sur un autre moment ni sur un autre invité, et changer de ferme ou de
  moment n'efface rien. Hors démonstration, l'identité reste celle
  d'Access, inchangée.
- **F159 — le choix de la ferme et du moment** se fait dans la bannière,
  par deux listes (la ferme vierge n'a qu'un moment, la liste du moment ne
  s'affiche pas) ; il tient dans deux témoins du navigateur, sans rien de
  sensible ; une valeur absente ou hors de la liste ouvre la ferme A à son
  premier moment. Un changement recharge le module en entier, car il change
  l'espace et le jour de toute la requête.
- **F160 — la date simulée** (C3) : le jour est celui du moment, l'heure est
  l'heure réelle de la ferme. Elle se pose requête par requête, par un point
  d'entrée propre à la démonstration (`demo-worker.ts`) qui remplace
  l'horloge du Worker et lit l'écart de chaque requête dans son contexte :
  deux invités dans deux moments ne se gênent pas. Le navigateur reçoit le
  même écart en tête de page, avant que les écrans ne s'animent. Le point
  d'entrée de la production reste `vinext/server/fetch-handler`, inchangé ;
  hors d'une démonstration acceptée, celui de la démonstration ne sert rien.
- **F161 — les quatre moments sont des mardis de la saison 2026** (une
  semaine entamée) : printemps le 14 avril, début d'été le 16 juin, pic
  d'été le 21 juillet, automne le 20 octobre. Le plan de culture d'une ferme
  se lit au jour du moment : ce qui est prévu avant est fait, ce qui vient
  après est à faire.
- **F162 — les fermes et leurs noms.** Quatre fermes aux noms de lieux
  inventés, chacune dans sa commune (Nantes pour la ferme A et la ferme
  vierge, Tours pour B, Valence pour C) : la ferme A reprend la forme de la
  ferme de démonstration actuelle (trois îlots, une serre, des planches de
  tailles réalistes), sous d'autres noms, car celle-ci porte « Tunnel 1 »,
  un nom de la ferme réelle ; le jeu des parcours navigateur reste intact.
  La couche 4 est un test : aucun nom des jeux de la ferme réelle
  (Clémentière, Tunnel 1, B1-0…, Forage principal…) n'apparaît dans une
  ferme fictive.
- **F163 — les espèces** : seulement des espèces rattachées au catalogue Kc
  validé (migration 0023). A : carottes, épinards, tomates, courgettes,
  salades, radis, poireaux, oignons ; B : salades, courgettes, haricots,
  tomates ; C : pommes de terre, poireaux, fraisiers. *Question agronomique
  posée au porteur (1 sur 2) : liste gardée telle quelle par lui le
  13 novembre 2026 (« Garder la liste »).* **Le sol des fermes fictives
  reste « non renseigné »** (question 2 sur 2, tranchée par le porteur le
  même jour : « Laisser non renseigné ») : les seules valeurs de sol du
  module sont celles de sa ferme, interdites ici, et aucune valeur n'est
  inventée ; la jauge de la réserve du sol dit qu'il manque la donnée.
- **F164 — la météo des moments**, sans appel réseau : le fournisseur de
  démonstration, avec deux épisodes : des nuits de gel du 15 et 16 avril
  (minimales de −2,4 et −1,1 °C) et une sécheresse chaude du 13 juillet au
  2 août (sans pluie, ET0 de 5,6 à 6,4 mm), pour que les sept jours de
  prévision de chaque moment montrent ce qu'il annonce. Valeurs dans les
  fourchettes déjà utilisées par la démonstration et les tests.
- **F165 — la ferme vierge** n'a pas d'espace tant que l'invité n'a rien
  coché : elle s'ouvre, comme une ferme qui n'a jamais ouvert le module, sur
  la liste à cocher. Les fermes A, B et C s'ouvrent avec leurs cases cochées
  d'avance (B ajoute le calculateur, qu'elle montre) ; un espace déjà ouvert
  n'est jamais réécrit.

- **F166 — le matériel et l'eau**, écrits à la première ouverture par les
  dépôts ordinaires, valeurs de matériel fictives : un goutte-à-goutte par
  parcelle à 6 mm/h, posé le 2 mars sur toutes ses planches. Ferme A : un
  puits de 1,5 m³/h qui remplit un bassin de 40 m³ (minimum de sécurité
  4 m³), une pompe de 3 m³/h qui en tire l'eau ; le bassin relevé le matin
  du moment à 36, 30, 6 puis 22 m³ ; au pic d'été, le puits est à sec (il
  est arrêté, sa fiche le dit), d'où la pénurie. Ferme B : le réseau
  communal, 2 m³/h, sans réserve. Ferme C : le matériel seul.
- **F167 — les objectifs** de la ferme A sont les propositions du module
  pour chaque planche cultivée (Kc du catalogue × ETP de la météo de la
  démonstration), adoptées comme d'un clic dans « Besoin par culture » :
  aucun chiffre saisi. Les fermes B et C, sans « Besoin par culture », n'ont
  pas d'objectif : l'invité le fixe.
- **F168 — ce que la nuit aurait fait** : la météo des quatre semaines
  passées en base (en réanalyse jusqu'à cinq jours avant le moment, en
  prévision ensuite), et le plan de la semaine calculé « au matin ».
- **F169 — l'historique** des fermes qui ont « Arrosages » : un arrosage
  par semaine et par goutte-à-goutte, le lundi à 7 h, de 45 min en avril,
  1 h en mai, 2 h en juin, 2 h 30 en juillet et en août, 1 h 30 en
  septembre et 45 min en octobre : les gestes d'une ferme inventée, que le
  module compte, pas une recommandation.
- **F170 — la météo selon le mois.** Le motif des parcours navigateur est
  une arrière-saison (des nuits à 2,6 °C) : la démonstration le réchauffe
  de 4 °C en mai, 7 °C en juin, 9 °C en juillet et en août, 5 °C en
  septembre et 1 °C en octobre, et son ETP de × 1,3 à × 1,6 de mai à août
  (× 0,7 en octobre) ; sans cela, du gel serait annoncé en juin. La pluie
  reste celle des parcours.
- **F171 — une seule préparation.** La page et ses données partent ensemble
  à la première ouverture : la requête qui crée l'espace l'écrit, les
  autres attendent qu'il soit prêt (cinq secondes au plus) ; les cases
  cochées s'écrivent en dernier et disent qu'il l'est.

## 11 quater. Précisions faites en codant D3 (13 novembre 2026, D-105)

Tranchées par la recommandation, sans valeur agronomique ; chacune reste
modifiable par le porteur. Les textes des bulles sont écrits pour
quelqu'un qui n'a jamais vu le module ; ils pourront suivre l'audit
ergonomique final, sans toucher au moteur.

- **F172 — l'entrée des visites** : un bouton « Visites guidées » dans la
  bannière ouvre la liste des visites offertes à la ferme choisie, chacune
  avec sa durée, ce qu'elle montre, la ferme et le moment où elle parle le
  mieux, et « déjà vue » ou « en cours ». Pas de bouton sur la page
  introuvable.
- **F173 — l'invitation** : à la première ouverture, une bulle discrète, au
  coin bas, propose la visite « Bienvenue » ; elle ne prend pas le focus,
  « Plus tard » la range pour de bon. Un navigateur qui refuse le stockage
  ne la voit pas : elle reviendrait à chaque page.
- **F174 — les boutons** : « Suivant » (« Terminer » à la dernière étape),
  « Précédent » (absent à la première), « Passer » et « Quitter la
  visite ». « Passer » saute le reste de la visite et commence la
  suivante (son nom pour le lecteur d'écran le dit) ; une étape se passe
  déjà par « Suivant ». Absent après la dernière visite offerte.
- **F175 — d'une page à l'autre** : une étape d'une autre page s'ouvre sur
  le clic du visiteur, par un lien qui porte l'étape dans l'adresse
  (`?visite=`), effacée à l'arrivée. Si le visiteur part ailleurs en cours
  de visite, la bulle se met en pause et propose « Reprendre la visite » :
  elle ne le ramène pas d'elle-même et ne prend pas le focus.
- **F176 — reprenable** : l'étape en cours, les visites finies et
  l'invitation vue sont rangées dans le navigateur (`demo-visite`,
  `demo-visites-vues`, `demo-visite-invitation`), rien de sensible. Sans
  stockage, la visite marche quand même d'une page à l'autre par
  l'adresse, mais ne reprend pas après la fermeture de l'onglet.
- **F177 — l'étape sautée** : une étape dont l'élément manque ou n'est pas
  visible est sautée sans message, comme celle d'une page que la ferme n'a
  pas cochée. À l'arrivée sur une page, l'élément a deux secondes pour
  paraître ; sur un clic dans une page déjà là, il y est ou non. « Étape n
  sur N » ne compte que ce que la ferme peut voir.
- **F178 — les visites offertes** : une visite n'est offerte qu'à une ferme
  qui a l'une de ses pages. Ferme A : les sept ; ferme B : Bienvenue, Un
  arrosage de A à Z, Le module à la carte, Et pour ma ferme ? ; ferme C :
  Bienvenue, Les alertes, Le module à la carte, Et pour ma ferme ? ; ferme
  vierge : Bienvenue, Le module à la carte, Et pour ma ferme ?.
- **F179 — la place de la bulle** : à partir de 981 px de large, près de
  l'élément (dessous, sinon dessus, sinon à côté, sinon au coin bas), elle
  le suit quand la page défile et ne sort jamais de la fenêtre ; en deçà,
  en feuille basse au-dessus de la barre des pages, sans la cacher (au bas
  de l'écran sur la première ouverture, qui n'en a pas). Une bulle sans
  élément se pose au milieu. L'élément présenté est entouré de vert.
- **F180 — l'accessibilité** (section 9) : une fenêtre non modale ; le focus
  va au titre de la bulle à chaque étape et revient au bouton « Visites
  guidées » à la fin ; Échap quitte quand le focus est dans la bulle (il ne
  vole pas l'Échap des autres fenêtres de la page) ; une région `aria-live`
  annonce la visite et l'étape ; le défilement est instantané sous
  `prefers-reduced-motion` ; anneau de focus de 3 px vert à 70 %, cibles de
  44 px. Contrastes mesurés dans la bulle et la liste : tous au moins
  4,5:1 (parcours V1 et V7).
- **F181 — « Et pour ma ferme ? »** : trois bulles de texte au milieu de
  l'écran plutôt qu'une page nouvelle : aucun écran de saisie ni de lien
  vers OTF en démonstration (C8).
- **F182 — la remise à zéro** n'est pas encore dite par la visite
  « Bienvenue » : son étape s'ajoutera avec le bouton, en D4.
- **F183 — les repères** : vingt et une valeurs de `data-tour`, listées dans
  `lib/domain/demo/tours.ts` ; un test vérifie que chacune est posée dans
  le code des écrans et sert à une étape, et qu'aucune autre n'y traîne.
- **F184 — les parcours de la démonstration** (`pnpm e2e:demo`,
  `playwright.demo.config.ts`) : la même application démarrée comme le
  Worker de démonstration, sur une configuration locale écrite sous
  `.wrangler/demo-e2e/` par `scripts/demo-e2e-server.mjs` (le chemin passe
  par `IRRIGATION_WRANGLER_CONFIG`, lu par `vite.config.ts`) :
  `wrangler.jsonc` n'est plus touché, ni pour les parcours ni pour un
  essai. Sept parcours, V1 à V7, un par visite, aux deux largeurs, joués
  en intégration continue après les parcours ordinaires. « La visite ne
  fait rien à la place du visiteur » s'y vérifie par l'absence de toute
  requête d'écriture : seules passent les actions de lecture que la page
  fait d'elle-même (`read…`, `load…`).

## 12. Questions au porteur (répondues) (une par message, numérotées)

Le total est **4**. Elles ne touchent que l'agronomie, le budget et les contacts extérieurs.

1. **Agronomie (1 sur 4) : les profils de fermes fictives.** Les profils A, B, C et la ferme vierge de la section 6 vous conviennent-ils, avec les espèces du catalogue Kc validé et rien de nouveau ? *Recommandation : oui.*
2. **Agronomie (2 sur 4) : les moments de saison.** Les quatre moments de la section 6 (gel de printemps, semaine normale d'été, pénurie de pic d'été, fin de saison) montrent-ils bien ce qu'un maraîcher voudrait voir ? *Recommandation : oui.*
3. **Budget (3 sur 4) : l'hébergement de la démo.** Accepter un second Worker et une seconde base D1 sur votre compte Cloudflare payant (un coût supplémentaire que je ne peux pas chiffrer, à relire dans l'offre en vigueur au moment du déploiement), au « vas-y » de D4 ? *Recommandation : oui, avec relevé du coût après un mois.*
4. **RÉPONDUE (8/11) : le porteur invite Nicolas et Vincent pour l'instant. Vincent est le développeur d'Ouvre ta ferme** : inviter Vincent revient à prévenir OTF, aucun message séparé n'est nécessaire. Aucune autre ferme n'est invitée avant leurs retours. *(Question d'origine :* **Contact extérieur (4 sur 4) : inviter et prévenir.** Qui invitez-vous en premier (Nicolas, Vincent, d'autres fermes), et prévenez-vous le développeur d'Ouvre ta ferme, puisque la démo reprend la mise en page et le nom d'OTF ? *Recommandation : Nicolas d'abord, et message au développeur d'OTF avant d'inviter des fermes. Je peux rédiger le brouillon ; il ne part que si vous l'envoyez.*

## 13. Ce que ce contrat n'a pas établi

- Le coût réel d'un second déploiement Cloudflare.
- Le contenu exact du dépôt à jour (voir section 11).
- Un avis juridique sur les courriels d'invités et sur l'usage du nom d'OTF.
- La liste exacte des espèces et des sols des profils B et C (dépend de la réponse 1 sur 4).
- L'état de la « ferme vierge » dans le module actuel (l'audit ne l'a pas vérifié).
