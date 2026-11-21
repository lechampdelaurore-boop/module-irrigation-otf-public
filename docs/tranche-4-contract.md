# Contrat de la Tranche 4 : v0.1, VALIDÉ par François le 15 novembre 2026 (15 h 30)

15 novembre 2026. **Brouillon sans code, sans PR, rien envoyé à personne.** Écrit pour la ligne 25 et la section 6 de `docs/ROADMAP.md` (dépôt à `ec63b18`). Il reprend les recherches de la Tranche 4 (API d'OTF, multi-fermes, coût Cloudflare), `docs/otf-contract.md` et `docs/hosting-migration-contract.md`. Réglage de ce travail : Sonnet 5.5 · Moyen (contrat sans code).

Marques : **[T4-nn]** décision proposée (sur la recommandation) ; **[À FAIRE]** à écrire ou mesurer avant le code ; **[À TRANCHER]** question réservée à François (section 12) ; **[NON VÉRIFIÉ]** lu nulle part ou non essayé.

## 1. Objet

Faire passer le module de « la ferme de François » à **un logiciel que plusieurs fermes utilisent**, chacune reliée à son propre Ouvre ta ferme (OTF), sans jamais voir les données d'une autre. Quatre résultats :

1. **Connexion officielle à l'API d'OTF** (OAuth2, lecture seule), avec une voie de secours (clé personnelle OTF) si OTF tarde.
2. **Accueil de plusieurs fermes** : identité de ferme stable, isolation prouvée, parcours « je relie ma ferme ».
3. **Site définitif** : adresse stable, page d'accueil publique, page de **politique de confidentialité** (les deux sont exigées par le formulaire d'OTF).
4. **Exploitation** assez solide pour ouvrir à d'autres : sauvegardes qui se restaurent, suivi, support.

**Hors périmètre** (inchangé, déjà écarté ou confié ailleurs) : écriture dans OTF ; capteurs et électrovannes (Tlaloc, D-066) ; rôles d'utilisateurs (écartés le 6/11) ; mesure d'audience (C9 de la démo) ; anglais ; application mobile ; ouverture « à tous ». La **fusion des deux moteurs** avec Nicolas (contrat commun, MC-17 à MC-27) **n'est pas touchée** : la Tranche 4 ne modifie ni le calcul du bilan ni les jeux de réglages (section 11).

## 2. Contraintes tenues (non négociables)

1. **Multi-fermes.** Aucune règle ne suppose la ferme de François (AGENTS.md ; mémoire du projet). Un inventaire de ce qui lui est propre précède tout code (section 7).
2. **OTF en lecture seule.** Jamais plus de 4 requêtes par seconde (limite d'OTF : 4/s, 30/min, et un plafond par jour, section 6). Aucun appel d'écriture.
3. **Aucun secret** vu, saisi ou consigné par l'assistant : `client_id`, secret, clé maîtresse de chiffrement, jetons des fermes. François les saisit lui-même (AGENTS.md, « Sécurité »).
4. **Une fuite entre fermes est le pire défaut** (discret, grave) : l'isolation se prouve par test **avant** tout accueil réel (section 5).
5. **Un seul chantier de code à la fois ; contrat avant code ; une PR par point ; registres dans la PR.** Fable interdit.
6. **Toute action sur une ferme réelle, et sur Cloudflare, attend un « vas-y » exprès de François.** Il a décidé que **toutes les fermes sont hébergées sur son compte Cloudflare**.
7. **Chaque ferme tierce donne son accord écrit** avant que ses données soient lues (pilote, 4.6).
8. **Inconnu reste inconnu, jamais zéro** (D-003) : une ferme à moitié configurée n'affiche pas de faux zéros.

## 3. Point de départ constaté au dépôt (à `ec63b18`)

| Sujet | Constat | Source |
| --- | --- | --- |
| Hébergement | Cloudflare, compte de François : Worker de l'application, Worker Push, planificateur météo, une base D1 ; plan Workers payant (5 $/mois, D-017) | `wrangler.jsonc`, `docs/hosting-migration-contract.md` |
| Connexion des utilisateurs | Cloudflare Access, code à usage unique par courriel, **liste de courriels autorisés posée à la main** ; identité = sujet du jeton Access (`app/access-auth.ts`) | `hosting-migration-contract.md` |
| Lien avec OTF | **Un seul jeton**, secret serveur `OTF_API_TOKEN`, une ferme par déploiement | `docs/otf-contract.md` (« Secrets et isolation ») |
| Identité de ferme | `otf_farm_id` existe en base, **facultatif**, avec index d'unicité par propriétaire ; jamais pris du navigateur | `db/schema.ts` lignes 39 à 55 |
| Cache OTF | Indexé par **utilisateur** et par saison, frais 4 h ; le contrat dit déjà qu'au passage à plusieurs structures la clé devra être l'identifiant de ferme obtenu côté serveur | `otf-contract.md` |
| Routes lues (toutes `GET`) | `/me`, `/configuration` (`general:read`) ; `/zoneList`, `/plotList` (`production.parcel:read` suffit, confirmé par OTF le 14/11) ; `/bedList`, `/actionList`, `/plantList`, `/seriesList`, `/placeList`, `/taskList` (`production:read`) | `otf-contract.md` |
| Démonstration (4.0) | **En ligne**, déploiement séparé, trois fermes fictives, visite guidée, recette conforme le 14/11 | roadmap 4.0 |
| Régulateur de débit | Un régulateur **dans le module entier** (1 bis du contrat OTF) ; à devenir **un par ferme** | `otf-contract.md` |

Ce brouillon n'a **pas rouvert** le code au-delà de ces lignes : tout ce qui suit sur le fonctionnement interne reste à confirmer à la lecture du code au début de chaque sous-tranche.

## 4. Découpage proposé et ordre

La roadmap a déjà 4.1 à 4.7. Ce contrat **les garde**, ajoute **4.8** (site définitif et confidentialité, qui n'existait pas) et fixe l'ordre. Réglages : colonne « Modèle · effort » de la roadmap pour 4.1 à 4.7 ; 4.8 proposé (à inscrire par une PR de registres, [T4-01]).

| Ordre | Sous-tranche | Contenu | Code ? | Modèle · effort |
| --- | --- | --- | --- | --- |
| 0 | **Préparation** | inventaire du propre à la ferme ; mesure des appels OTF par jour ; relecture à la main des conditions d'OTF ; questions de la section 12 | non | Sonnet 5.5 · Moyen |
| 1 | **4.8 Site définitif et confidentialité** | adresse, page publique, politique de confidentialité, route de retour OAuth fixée | oui, léger | contrat Sonnet 5.5 · Moyen ; code Opus 5.5 · Élevé (proposé) |
| 2 | *Envoi du formulaire OTF par François* | dès que 4.8 est en ligne ; **attente de la validation d'OTF (délai inconnu)** | non | — |
| 3 | **4.1 + 4.2 Identité de ferme et isolation** (un seul contrat) | clé d'espace = ferme ; régulateur et budget par ferme ; coffre des jetons ; tests d'isolation | oui | contrat et code Opus 5.5 · Max (4.2) |
| 4 | **4.3 Connexion OAuth OTF** (+ voie de secours clé personnelle) | « Autoriser le module », renouvellement, révocation, contrôle des droits | oui | Opus 5.5 · Max |
| 5 | **4.4 Accueil d'une ferme** | parcours guidé, ferme non finie, fermes exclues | oui | Opus 5.5 · Élevé |
| 6 | **4.5 Exploitation** | sauvegardes D1 restaurées pour de vrai, suivi, support, suppression d'une ferme | oui | Opus 5.5 · Très élevé |
| 7 | **4.6 Pilote** | 1 à 2 fermes amies, lecture seule, accord écrit | non (recette) | Opus 5.5 · Max |
| — | **4.7** | la partie hébergement est faite (Q0) ; la partie identité est **absorbée par 4.1 à 4.3** : à fermer à ce moment-là | — | — |

**Mise à jour du 17 novembre 2026 (D-153, D-154).** La 4.8 est codée avant la fin de la fusion des moteurs, et toute la Tranche 4 se code désormais sans l'attendre : elle ne touche pas le calcul (section 11), le moteur commun se branchera dessous. Deux chantiers de code peuvent avancer ensemble s'ils touchent deux dépôts différents.

**Pourquoi cet ordre [T4-02].** Le formulaire d'OTF exige trois choses que nous n'avons pas : adresse définitive du site, page de confidentialité, adresse de retour OAuth (décision de François du 12/11, formulaire non envoyé). **4.8 d'abord débloque le formulaire**, dont le délai est hors de notre contrôle ; on code l'isolation (3) **pendant** l'attente. L'isolation vient avant la connexion : on ne branche pas des fermes réelles sur un logiciel dont l'isolation n'est pas prouvée.

**Condition de départ commune :** « vas-y » de François pour chaque sous-tranche de code ; 4.8 et la préparation (étape 0) n'exigent que ce contrat validé (le formulaire, lui, est un acte de François).

## 5. Identité, droits et isolation (4.1 + 4.2)

**[T4-03] Clé d'espace.** L'espace de travail est identifié par **l'identifiant de ferme lu par le serveur** (`GET /me` après connexion), jamais par le courriel ni par une valeur du navigateur. `otf_farm_id` devient **obligatoire** pour toute ferme reliée (il reste vide pour la démonstration). Le cache OTF passe de « utilisateur » à « ferme ».

**[T4-04] Un propriétaire par ferme au départ** (recommandation du 7/11, rôles écartés). Si deux personnes d'une même ferme veulent entrer : à écrire au contrat 4.1 (probablement « une ferme, un propriétaire, un jeton ; second accès = nouvelle décision »). Un même utilisateur peut relier **plusieurs** fermes (une autorisation par ferme, la doc d'OTF ne permettant qu'un jeton par ferme).

**[T4-05] Connexion des utilisateurs : garder Cloudflare Access (code par courriel) pour les fermes amies.** Access est gratuit jusqu'à **50 utilisateurs**, puis 7 $ par utilisateur et par mois (recherche du 9/11 ; 90 utilisateurs ≈ jusqu'à 630 $, non vérifié : les 50 premiers restent-ils gratuits en payant ?). Avec un propriétaire par ferme, **le seuil de 50 correspond à 50 fermes**, bien au-delà de « 2 à 3 fermes amies, quelques dizaines au mieux » (recherche du 7/11). Une connexion propre (courriel + code géré par le module) est **hors de cette tranche** ; elle est à rouvrir si l'on approche de 40 utilisateurs. Contrainte pratique : tant qu'Access est la porte, **François ajoute chaque courriel à la liste Access** (action Cloudflare = « vas-y » exprès à chaque fois, ou un seul « vas-y » durable à demander [À TRANCHER mineur, option recommandée : un « vas-y » par ferme pilote]).

**[T4-06] Isolation prouvée par tests, d'abord.** Extension du test S28 de la 3.9 et de l'isolation des invités de la démo (couche 5) : deux fermes, mêmes noms de planches, mêmes identifiants OTF ; chaque lecture, chaque écriture, chaque cache, chaque alerte et chaque notification push de A est **invisible** de B, y compris par suites d'actions et par erreur. Revue dédiée par un second fil avant toute ferme réelle (« une fuite est discrète et grave », roadmap 4.2). Preuve de fin : tests verts + relecture écrite de chaque requête SQL qui lit sans filtre de ferme (liste jointe à la PR).

**[T4-07] Régulateur et budget par ferme.** Le quota d'OTF est **par ferme, toutes applications confondues**. Un régulateur de 4/s et 30/min **par ferme** (pas global). Voir section 6 pour le quota quotidien.

**[T4-08] Synchronisations échelonnées.** Pas de ferme qui synchronise toutes à la même minute (le planificateur météo actuel tourne à 04 h 15 et 05 h 15 ; contrat `weather-scheduler-contract.md`) ; décalage par ferme.

### 5 bis. Précisions de 4.1 et 4.2 (17 novembre 2026, D-155, F325 à F336)

Écrites avant le code, en Opus 5.5 · Max, sur le choix du porteur du
17 novembre 2026 à 22 h 35 (carte « 1 sur 1 ») : **4.1 et 4.2 forment un
seul chantier**, comme le prévoit la section 4 ; la ligne 4.1 de la roadmap
(4.1 seule, en Opus 5.5 · Élevé) est alignée. Les points ci-dessous suivent
l'option recommandée : aucun n'est agronomique, ne touche au budget ni à
Cloudflare, et le porteur peut les changer.

- **F325 · Pourquoi ensemble.** Avant ce chantier, treize requêtes
  retrouvent l'espace d'une personne en cherchant « son espace sans ferme »
  (`otf_farm_id IS NULL`), et une trentaine d'autres ne vérifient que la
  personne. Remplir l'identifiant de ferme sans les changer rendrait les
  données de la ferme introuvables ; les changer, c'est l'isolation.
- **F326 · Trois PR, dans l'ordre**, AGENTS.md interdisant de mêler une
  restructuration et un ajout : (1) la clé d'espace dans chaque requête, sans
  rien changer de visible, avec les tests d'isolation et la liste des
  requêtes relue ; (2) l'identité lue chez OTF et le rattachement
  automatique de l'espace existant (le cœur de 4.1) ; (3) le régulateur des
  appels par ferme. Chacune après le déploiement vérifié de la précédente.
  **La PR 2 attend un « vas-y » exprès du porteur avant sa fusion** : elle
  écrit dans l'espace de sa ferme réelle (la colonne de la ferme), et un
  simple retour en arrière du code ne suffirait plus à la défaire.
- **F327 · La clé d'espace.** Un espace, c'est une personne (le sujet de sa
  connexion Access) et une ferme (l'identifiant de structure d'OTF,
  `otf_farm_id`) ; la démonstration et les espaces d'avant la 4.1 n'ont pas
  de ferme. La clé est calculée par le serveur seul, à la connexion
  (`app/access-auth.ts`), jamais lue du navigateur ; le reste du module la
  reçoit à la place de l'identifiant de la personne, comme la démonstration
  le fait déjà (`…·demo·…`). Forme : `<personne>·ferme·<ferme>`,
  l'identifiant de ferme limité à des lettres, des chiffres, le tiret et le
  souligné (64 signes au plus) ; une clé mal formée est refusée, jamais
  devinée (`lib/domain/farm-space.ts`). Les colonnes qui notent l'auteur
  d'une action (`actor_user_id`) reçoivent la clé, qui contient la
  personne, comme en démonstration.
- **F328 · Chaque requête filtre la personne et la ferme ensemble**
  (`owner_user_id = ? AND otf_farm_id IS ?`, `db/workspace-scope.ts`), y
  compris les jointures qui vérifient qu'un objet désigné par le navigateur
  (un arrosage, un matériel, une proposition) appartient bien à l'espace.
  Les traitements d'arrière-plan (calcul du matin, alertes, météo)
  parcourent tous les espaces, avec ou sans ferme, chacun sous sa clé. Le
  cache d'OTF est rangé par clé d'espace : jamais partagé entre deux fermes
  ni entre deux personnes (plus strict que « par ferme », T4-03).
- **F329 · L'identité vient de `GET /me`.** La documentation de l'API
  d'OTF, relue le 17 novembre 2026, dit qu'une clé ou un jeton « est
  rattaché à une seule structure » et que `structure.id` ne change pas. Une
  réponse sans identifiant, ou qui en donne plusieurs, n'est pas une
  identité : rien n'est rattaché, aucune donnée n'est montrée sous une
  identité devinée (D-003), et la page le dit.
- **F330 · Avant la 4.3, la ferme est celle de la clé du déploiement**
  (`OTF_API_TOKEN`, une seule ferme). Le serveur garde la dernière ferme
  observée par `GET /me` (table `otf_deployment_farm`, une seule ligne),
  remise à jour à chaque lecture. Sans ferme gardée (premier passage après
  la mise en ligne), il reprend celle du dernier instantané en cache, lu lui
  aussi par `GET /me`, sinon il appelle `GET /me` une fois. La
  démonstration reste sans ferme (section 5) ; les données fictives des
  parcours navigateur portent l'identifiant de leur ferme fictive.
- **F331 · Rattachement automatique (4.1).** Au premier passage d'une
  personne après la mise en ligne, son espace d'avant la 4.1 reçoit
  l'identifiant de la ferme d'où viennent ses données : celle de son dernier
  instantané en cache, ou, sans cache, la ferme de la clé. Une seule
  écriture, conditionnelle, sans copie ni suppression : réglages, matériel,
  historique restent où ils sont. Si ses données viennent d'une autre ferme
  que celle de la clé, l'espace ancien est rattaché à sa vraie ferme et un
  espace neuf s'ouvre pour la ferme de la clé : rien n'est mélangé.
- **F332 · Garde à chaque lecture d'OTF.** `GET /me` est relu à chaque
  lecture (déjà le cas) et comparé à la ferme de l'espace **avant** les
  autres routes. Si la clé mène à une autre ferme, rien n'est lu de plus ni
  rangé dans l'espace, la ferme gardée devient la nouvelle, et la page dit :
  « La clé d'Ouvre ta ferme de ce module mène maintenant à une autre ferme.
  Rechargez la page pour l'ouvrir ; les réglages de la ferme précédente
  restent gardés à part. » Un espace dont la ferme n'est plus celle de la
  clé ne lit plus OTF : son dernier instantané en cache reste lisible.
- **F333 · Un propriétaire par ferme (T4-04)** s'appliquera au rattachement
  par autorisation (4.3). D'ici là, la clé du déploiement est partagée comme
  aujourd'hui : chaque personne admise par Access garde son espace à elle
  pour cette ferme. Une personne peut avoir un espace par ferme (index
  unique personne et ferme, déjà en base).
- **F334 · Régulateur par ferme (T4-07).** Le rythme de 4 appels par seconde
  est tenu ferme par ferme, et s'y ajoute la limite d'OTF de 30 appels par
  minute : quand elle est pleine, un appel attend au plus 5 secondes qu'une
  place se libère, sinon la lecture s'arrête comme sur une limite atteinte
  (dernier instantané affiché, message existant), sans rien envoyer à OTF.
  Avant la 4.3, la seule clé est celle du déploiement, rattachée à une seule
  ferme (F330) : tous ses appels, y compris le premier `GET /me` qui fait
  connaître cette ferme, passent par un même régulateur, et les 4 appels
  par seconde tiennent même avant que la ferme soit connue. La minute se
  compte avec une seconde de marge (OTF compte les appels à leur arrivée,
  le module à leur départ) ; l'attente d'une place ne compte pas dans le
  délai de l'appel. Limite connue : le régulateur vit dans chaque instance
  du Worker, comme aujourd'hui ; un régulateur partagé entre instances se
  tranche à la 4.3, avec le budget quotidien.
- **F335 · Restent à la 4.3** : le coffre des jetons (T4-12 : avant OAuth, la
  seule clé est le secret du déploiement, il n'y a rien à y ranger), le
  budget quotidien (T4-14 : la consommation réelle n'est pas mesurée) et
  l'échelonnement des synchronisations (T4-08 : une seule ferme par
  déploiement d'ici là).
- **F336 · Migration et preuves.** Une migration additive : la table
  `otf_deployment_farm` ; aucune colonne ni ligne supprimée. Preuves : des
  tests à deux fermes pour une même personne et à deux personnes pour une
  même ferme, avec les mêmes identifiants OTF (chaque lecture, chaque
  écriture, chaque action désignée par le navigateur, chaque traitement
  d'arrière-plan et chaque notification de l'une sont invisibles de
  l'autre) ; la liste écrite des requêtes qui lisent sans filtre d'espace,
  jointe à la PR 1 ; des tests du rattachement, sur une base où un espace
  d'avant la 4.1 a ses données, de la garde et du régulateur. La revue par
  un second fil reste due avant toute ferme tierce (T4-06, 4.6).

### 5 ter. Précisions de la PR 2 : l'identité et le rattachement (17 novembre 2026, D-156, F337 à F344)

Écrites avant le code de la PR 2, toutes à l'option recommandée ; elles
précisent F329 à F332 sans les changer.

- **F337 · `GET /me` d'abord.** Chaque lecture d'OTF commence par `GET /me`,
  avant `/configuration` : la ferme est vérifiée avant toute autre route
  (F332), et une saison absente se juge sur la configuration de la bonne
  ferme. Le contrat de lecture (`docs/otf-contract.md`, « Lecture
  atomique ») le dit aussi.
- **F338 · Ce qui fait une identité** (`lib/domain/otf/farm-identity.ts`).
  Une réponse de `GET /me` qui porte exactement une structure (la réponse
  elle-même, ou une liste d'un seul élément) dont l'identifiant (`id`, ou à
  défaut le dernier segment de `@id`) est un entier positif ou un texte de la
  forme de F327. Rien d'autre n'est une identité. La ferme d'un instantané en
  cache est celle que sa lecture a vue ; le remplaçant d'avant cette règle,
  `unknown`, n'en est pas une.
- **F339 · La ferme du déploiement** (F330). La table `otf_deployment_farm`
  garde la ferme et l'heure de son observation ; une observation plus
  ancienne ne remplace jamais une plus récente. Sans ligne : le dernier
  instantané en cache, toutes clés confondues, si sa ferme est lisible ;
  sinon un seul appel à `GET /me`, au rythme du client existant. Avec les
  données fictives (parcours navigateur, développement), la ferme est celle
  de la ferme fictive, `farm-demo`, sans rien écrire. La démonstration n'a
  pas de ferme (section 5).
- **F340 · Le rattachement (F331), à chaque connexion, avant de rendre la
  clé.** Si la personne a un espace sans ferme, il reçoit la ferme de son
  dernier instantané en cache dont la ferme est lisible, sinon celle du
  déploiement, par une seule écriture conditionnelle. Si la personne a déjà
  un espace pour cette ferme, rien n'est écrit : l'espace sans ferme reste
  gardé à part, jamais fusionné. La clé rendue est toujours celle de la
  ferme du déploiement.
- **F341 · Sans identité, rien n'est montré** (F329). Si la ferme du
  déploiement ne peut pas être établie, aucune page ne s'affiche ; elle
  dit : « Ouvre ta ferme n'a pas dit à quelle ferme mène la clé de ce
  module. Rien n'est affiché tant que la ferme n'est pas connue ; aucune
  donnée n'a été modifiée. Réessayez dans quelques minutes. » Les actions
  sont refusées ; l'export et les dessins des espèces aussi, avec le même
  message. Une lecture dont `GET /me` ne donne pas d'identité s'arrête
  de même : rien n'est lu de plus ni rangé ; la dernière lecture réussie
  s'affiche, avec : « Ouvre ta ferme n'a pas dit à quelle ferme mène la clé
  de ce module. La dernière lecture réussie est affichée. » Le journal note
  alors la forme de la réponse (le nombre de structures, le type de
  l'identifiant), jamais ses valeurs.
- **F342 · Les espaces qui ne lisent pas OTF.** Un espace dont la ferme
  n'est pas celle du déploiement ne lit pas OTF (F332) : son dernier
  instantané en cache s'affiche avec le message de F332 ; sans cache, la
  page dit ce message. Un espace sans ferme, hors démonstration, ne lit pas
  OTF non plus : c'est un espace d'avant la 4.1 dont la personne n'est pas
  revenue ; les traitements du matin le calculent sur son cache, sans
  changer la preuve de sa ferme.
- **F343 · Continuité du cache.** Un espace qui vient d'être rattaché n'a
  pas encore d'instantané sous sa nouvelle clé : faute de mieux, il lit le
  dernier instantané de sa personne d'avant la 4.1, **seulement si cet
  instantané est de la même ferme**. Rien n'est copié ; la première lecture
  réussie range l'instantané sous la nouvelle clé.
- **F344 · Ce que la mise en ligne change pour une ferme réelle.** Au
  premier passage de la personne, une écriture : la ferme dans la colonne
  de son espace (et la ligne de `otf_deployment_farm`). Rien ne change à
  l'écran ; la première lecture d'OTF sous la nouvelle clé est une lecture
  complète, comme une actualisation.

### 5 quater. Un appareil, une personne : les notifications d'un appareil partagé (18 novembre 2026, D-159, F371 à F378)

Le correctif du constat A de la revue de l'isolation du 18 novembre 2026
(`/mnt/project-files/tranche-4/revue-isolation-fermes-2026-11-18.md`), avec
ses points C3 et D1, dû avant la 4.6 (F351). Avant lui, un appareil où deux
personnes avaient ouvert le module restait inscrit dans leurs deux espaces
et recevait en silence les notifications des deux : gel avec les noms des
cultures, fins d'arrosage avec le matériel, suggestions du planning, alertes
météo. Ces règles précisent celle de F351 (« les notifications d'un
appareil suivent la personne qui l'a inscrit en dernier, pas l'espace »)
sans la changer. Décidées avant le code et écrites dans la même PR que lui,
le 18 novembre 2026 au soir, en Opus 5.5 · Max (réglage de la 4.2), sur le
mandat de nuit du porteur. Toutes suivent l'option recommandée : aucune
n'est agronomique ni ne touche au budget, aucune ne demande de changer un
réglage de Cloudflare à la main, et le porteur peut les changer. La revue
proposait « un appareil, un espace » ; F351 a gardé « un appareil, une
personne », pour qu'une personne qui a deux fermes reçoive les deux (F373).

- **F371 · Un appareil, une personne.** Le service de notification garde,
  pour chaque appareil (son adresse d'abonnement, donnée par le
  navigateur), la personne à qui il est et les espaces de cette personne où
  il est inscrit. Une notification d'un espace ne part que vers les
  appareils inscrits dans cet espace d'après cette fiche : au moment
  d'envoyer, chaque appareil de la liste de l'espace est vérifié, et celui
  qui n'est plus à cet espace en est retiré sans rien recevoir. Si la
  vérification échoue, rien n'est envoyé à cet appareil et l'envoi se
  retente plus tard, comme après une panne du fournisseur. La personne n'est
  connue du service que par une empreinte : le SHA-256, en hexadécimal, de
  `irrigation-push-person:` suivi de son identifiant de connexion, celui de
  sa clé d'espace (F327). Le serveur du module la calcule ; elle ne vient
  jamais du navigateur. Le service ne reçoit ni cet identifiant, ni le nom,
  ni le courriel de la personne ; les espaces d'une même personne ont la
  même empreinte.
- **F372 · Seul le geste « Activer » change la personne d'un appareil.**
  « Activer » inscrit l'appareil pour la personne connectée, dans son espace
  courant ; s'il était à une autre personne, il passe à elle et quitte
  aussitôt tous les espaces de la précédente. L'ouverture d'une page, qui
  renouvelle l'inscription d'un appareil où les notifications sont
  permises, ne prend jamais un appareil : elle l'inscrit dans l'espace
  courant s'il est déjà à cette personne, ou s'il n'est à personne ; s'il est
  à une autre personne, rien ne change. Le geste vient du navigateur, mais
  seul `activate` exact prend un appareil : toute autre valeur, absente
  comprise, vaut renouvellement. « La personne qui l'a inscrit en dernier »
  de F351 est donc celle du dernier « Activer » : la personne qui prête son
  téléphone pour ouvrir le module ne perd pas ses alertes, et celle qui
  l'emprunte n'en reçoit aucune.
- **F373 · Une même personne, plusieurs espaces.** Un appareil reçoit les
  notifications de chaque espace de sa personne où il a été inscrit, par
  exemple de ses deux fermes à partir de la 4.4 ; vingt espaces au plus : au
  vingt et unième, le plus ancien est détaché. Que chaque notification nomme
  sa ferme reste à la 4.4 (F351).
- **F374 · Ce que montre la page sur l'appareil d'une autre personne.** Elle
  le présente comme un appareil où les notifications ne sont pas encore
  activées (« Cet appareil ne reçoit pas encore les alertes. »), avec le
  bouton « Activer ». Rien ne dit à qui il est ni ce qu'il reçoit.
- **F375 · Les appareils inscrits avant le correctif.** Le service n'a pas
  de fiche pour eux. Le premier espace qui leur envoie une notification les
  garde, sans personne ; ils quittent la liste des autres espaces au premier
  envoi de ceux-ci. La première page ouverte sur un tel appareil le donne à
  la personne connectée, dans son seul espace. Un appareil qui n'était
  inscrit que dans un espace continue donc de recevoir sans que personne
  n'ait rien à refaire.
- **F376 · « Désactiver » et les appareils disparus.** « Désactiver » retire
  l'appareil de l'espace courant ; il reste à sa personne, même sans plus
  aucun espace : une ancienne inscription, d'avant le correctif, ne peut plus
  le reprendre au premier envoi. Un appareil que le fournisseur déclare
  disparu (abonnement expiré) est retiré de la liste et sa fiche oubliée.
- **F377 · Nouvelles tentatives par espace (D1).** Une notification qui
  échoue se retente sous le nom `send:<espace>:<identifiant>` : deux espaces
  qui envoient le même identifiant le même jour (le gel d'un jour est
  `crop-frost:<jour>:suite` dans toutes les fermes) gardent chacun sa
  tentative.
- **F378 · Les preuves (C3).** Les tests du service font tourner son vrai
  code, ses trois classes de Durable Objects comprises, sur une mémoire de
  test qui imite Cloudflare (`cloudflare/irrigation-push/test/support/`) :
  le même appareil inscrit à A par Alice puis à B par Bob ne reçoit rien
  d'un envoi à A ; la page de Bob ne prend pas l'appareil d'Alice ;
  « Activer » le prend ; deux fermes d'une même personne ; le vingt et
  unième espace ; « Désactiver » ; les appareils d'avant le correctif ; deux
  inscriptions simultanées ; une alarme de fin d'arrosage programmée avant
  le changement de personne ; les nouvelles tentatives de deux espaces ; la
  vérification qui échoue ; l'appareil expiré. Côté module, des tests
  vérifient l'empreinte, le geste et la réponse du service. Dix sabotages,
  chacun retirant une de ces règles du code, font chacun échouer au moins
  un test (la liste est dans la PR).

### 5 quinquies. Les preuves C1 et C2 : la cohérence des espaces et le rattachement (18 novembre 2026, D-160, F379 et F380)

Les points C1 et C2 de la revue de l'isolation du 18 novembre 2026
(`/mnt/project-files/tranche-4/revue-isolation-fermes-2026-11-18.md`), que la
revue recommandait avant la 4.6. Elle n'avait trouvé aucune fuite dans la
base : ce sont des preuves, qui attraperaient une régression. Des tests
seuls (`tests/db/`, `tests/support/`, et le script `test:isolation`) : aucune
ligne de `db/` ni du code du module ne change. Décidées avant le code et
écrites dans la même PR que lui, la nuit du 18 au 19 novembre 2026, en
Opus 5.5 · Max (réglage de la 4.2), sur le mandat de nuit du porteur, à
l'option recommandée : rien n'est agronomique, ne touche au budget ni ne
change ce que voit une ferme.

- **F379 · Le passage « rattachement » (C2).** `pnpm test` rejoue les tests
  de `tests/db/` dans un troisième passage d'isolation, après « fermes » et
  « personnes » (F336) : Alice y est l'espace sans ferme d'une personne, et
  Bob l'espace de ferme de la même personne (`alice` et `alice·ferme·7`).
  C'est le cas du rattachement quand les données d'une personne viennent
  d'une autre ferme que celle de la clé (F331) : chaque test qui montre que
  Bob ne voit rien d'Alice montre alors que l'espace sans ferme et l'espace
  de ferme d'une même personne ne se voient pas. Le filtre
  (`otf_farm_id IS ?`) était juste par construction ; il est maintenant
  prouvé.
- **F380 · Le contrôle de cohérence des espaces (C1).** À la fin de chaque
  test de `tests/db/` qui écrit dans la base de test, dans chacun des quatre
  passages, un contrôle parcourt la base et fait échouer le test si une
  ligne d'un espace désigne une ligne d'un autre espace : une irrigation
  dont le matériel, le réglage, la pose ou la pompe est d'un autre espace,
  par exemple. Il ne regarde pas la forme des requêtes, comme le garde-fou
  de `tests/farm-space.test.ts`, mais ce qu'elles ont écrit.
  - L'espace d'une ligne est sa colonne `workspace_id`. Une table qui n'en a
    pas prend l'espace de la ligne qu'elle complète (le réglage, celui de
    son matériel). Une ligne commune à tous (`workspace_id` nul, comme une
    culture de référence commune) peut être désignée par chaque espace.
  - Sont vérifiées les clés étrangères déclarées, les colonnes qui
    désignent une ligne sans clé déclarée (une proposition du planning et
    son matériel, son réglage, sa pose, sa pompe et son origine, son
    irrigation validée ; le journal des ouvrages d'eau et l'ouvrage qu'il
    nomme), et la clé de culture (`crop_key`) : une culture commune, ou une
    culture de l'espace, jamais une culture propre à un autre espace.
  - Toute table, et toute colonne en `_id` ou en `_key`, doit être rangée
    dans le contrôle (`tests/support/space-coherence.ts`) : une table ou une
    colonne nouvelle, non rangée, l'arrête au lieu de lui échapper. Qui
    l'ajoute dit ce qu'elle désigne.
  - S'y ajoute le test « Bob désigne l'objet d'Alice » pour chaque action
    qui reçoit du navigateur l'identifiant d'un objet et qui ne l'avait pas
    encore (`tests/db/foreign-designation.test.ts`) : Bob, dans son espace,
    nomme l'objet d'Alice ; l'action est refusée et l'objet d'Alice ne change
    pas. Sont couverts la correction du volume d'une réserve, l'effacement
    d'un relevé de compteur, la modification d'un groupe de jardins, la
    modification d'une pompe et l'origine d'une pompe, la vérification de la
    pompe d'une irrigation, la culture saisie par une autre ferme (dans une
    correspondance d'espèce, un Kc ajusté, une déclaration de stade, un
    profil d'enracinement) et la remise des durées communes d'une culture.
  - Le contrôle est un test, pas une contrainte de la base : il prouve ce
    que le code écrit dans les tests, pas ce qu'il écrirait en production.
    Il ne remplace pas la vérification d'appartenance que chaque action fait
    avant d'écrire.

## 6. Connexion à l'API d'OTF (4.3)

### 6.1 Ce que la documentation d'OTF établit (lue le 7/11 ; à relire avant le code)

- OAuth2, **code d'autorisation avec PKCE**. Jeton d'accès 1 h ; jeton de renouvellement 1 mois, **renouvelé à chaque usage** ; un administrateur de la ferme révoque à tout moment.
- **Un jeton = une ferme**, choisie à l'autorisation. Pas de vue « toutes mes fermes ».
- Inscription non libre : **formulaire** `https://www.ouvretaferme.org/api/demande`, compte OTF requis, validation par l'équipe d'OTF. Champs : organisation, nom (affiché à l'écran d'autorisation), ce que fait l'application, **site web**, **politique de confidentialité**, **adresses de retour** (HTTPS ; `http://127.0.0.1` autorisé pour le développement), droits cochés un par un.
- API **en bêta, peut changer sans préavis** ; AMAP exclues ; abonnement requis pour la lecture (`subscription_required`). Journal des appels visible par la ferme, 14 jours.
- Réponse de Vincent (développeur d'OTF), 8/11 : « rien de structuré » pour l'instant (pas de statut partenaire, pas de conditions écrites) ; cadre à venir par une développeuse arrivée la semaine précédente ; webhooks envisageables, sans calendrier ; quotas serrés exprès, flexibles ensuite.

### 6.2 Décisions proposées

**[T4-09] Voie principale : OAuth2 (option B).** L'utilisateur clique « Autoriser le module », garde la main (révocation chez OTF), aucun jeton collé. Le `client_id` et le secret sont saisis **par François seul**, en secrets Cloudflare.

**[T4-10] Voie de secours : clé personnelle OTF collée (option A), sous réserve du contrat 4.3.** Elle n'attend rien d'OTF. Les deux voies partagent **le même coffre** et le même contrôle des droits. À livrer **seulement si la validation d'OTF tarde** au moment où l'isolation est prête ; sinon on ne code que B. Contrôle des droits à la saisie : refuser un jeton qui permettrait d'écrire (portées lues par l'erreur 403, la doc ne décrivant pas de route de description : [NON VÉRIFIÉ]).

**[T4-11] Droits demandés : lecture seule, au plus juste.** À partir des routes réellement lues (section 3) : Structure et configuration (`general:read`), **Parcellaire** (`/zoneList`, `/plotList`, et probablement `/bedList`), **Cultures** (`/seriesList`, `/placeList`), **Espèces et variétés** (`/plantList`), **Interventions** (`/actionList`, `/taskList` : reconnaître semis direct et plantation, `series-contract.md`). **Correction du brouillon du 12/11** : « Interventions » y était marqué « à confirmer » ; le code lit bien `/actionList` et `/taskList`, donc **le droit est nécessaire**. Rien en Vente, Gestion, Équipe. La correspondance exacte route → droit est à confirmer **par appel réel** sur la ferme fictive « Ferme v2 » n° 4394 (création libre, aucune ferme réelle touchée) [NON VÉRIFIÉ].

**[T4-12] Coffre des jetons.** Chiffrement authentifié, **clé maîtresse en secret Cloudflare** (posée par François), jamais en base, jamais dans Git, jamais dans un journal, une URL ou une réponse ; bouton « Déconnecter » qui supprime le jeton **et** les données lues ; rotation de la clé maîtresse prévue et essayée ; le navigateur ne reçoit que « connecté, ferme X ». Une fuite de la clé maîtresse ouvrirait toutes les fermes : c'est le risque central, d'où l'option C (déploiement propre) pour qui refuse (recherche du 7/11).

**[T4-13] Renouvellement sans course.** Le jeton de renouvellement change à chaque usage : deux requêtes simultanées de la même ferme qui le renouvelleraient en même temps risquent d'en invalider un. Il faut **un seul renouvellement à la fois par ferme** (verrou), et, en cas d'échec, un état « reconnexion demandée » sans perdre le cache [À FAIRE, détail au contrat 4.3 ; le comportement exact d'OTF est [NON VÉRIFIÉ]].

**[T4-14] Quota quotidien : le vrai risque.** Plafond **par ferme et par jour** : 100 (offre « Gestion »), 500 (autres), 1 000 (« Pilotage »), partagé avec les autres outils de la ferme. Estimation tirée du contrat OTF : une lecture complète = environ 9 routes simples + **13 pages de tâches** sur la ferme de François, soit **environ 20 à 25 appels** par instantané ; avec un cache de 4 h, le pire cas théorique serait **6 lectures par jour ≈ 130 à 150 appels**, **au-dessus de 100**. À faire **avant le code** : mesurer la consommation réelle (journal d'appels d'OTF, 14 jours, lecture seule sur la ferme de François, « vas-y » requis) puis choisir parmi : cache plus long, lecture par `afterId` / `ids` (recommandations de la doc), lecture des tâches limitée aux séries de la saison, **budget par ferme avec message clair « limite OTF atteinte » et repli sur le cache**. Ne jamais épuiser le quota d'une ferme au détriment de ses autres outils : le module s'arrête à un seuil de prudence (à fixer au contrat, par exemple 70 %).

**[T4-15] Tests de contrat sur l'API (bêta).** Un contrôle par route lue qui détecte un changement de format et alerte, au lieu d'afficher des données fausses. Une réponse invalide ne remplace jamais le cache (règle actuelle conservée).

**[T4-16] Fermes exclues, dites dès l'accueil.** AMAP et fermes sans l'abonnement qui ouvre l'API : message clair avant toute saisie, sans faux espoir. Alternative (export) : **question non posée à OTF** (n° 9 de la recherche), à poser au prochain échange.

**[T4-17] Rien d'OTF n'est mis en défaut ni contourné.** Le module respecte 4/s ; une `429` n'est jamais réessayée automatiquement (règle actuelle) ; 100 échecs d'authentification en 15 minutes bloquent l'adresse IP chez OTF : **aucune boucle de nouvel essai sur 401/403** (déjà le cas).

### 6.3 Précisions de la 4.3 : relier chaque ferme à Ouvre ta ferme (18 novembre 2026, D-158, F349 à F370)

Écrites avant le code, le 18 novembre 2026 au soir, en Opus 5.5 · Max (ligne
4.3 de la roadmap), sans code ni accès d'OTF, au lancement du coordinateur
sur le mot du porteur (« Lance tous les chantiers en parallèle que tu
peux »). Elles précisent T4-09 à T4-17 et tranchent ce que la 4.1 et la 4.2
ont laissé à la 4.3 (F334, F335) : le régulateur partagé entre les instances
du serveur, le budget quotidien, les jetons de chaque ferme et la lecture
qui ne peut pas finir dans la minute. Tous les points suivent l'option
recommandée : aucun n'est agronomique, ne touche au budget du porteur ni ne
change un réglage de Cloudflare, et le porteur peut les changer. La question
qui lui était réservée (la voie de secours, F369) est tranchée par lui le
soir même ; la part du quota quotidien laissée au module se fixe après une
mesure (F363). Elles reprennent aussi ce que la
revue de l'isolation, faite par un second fil le 18 novembre 2026
(`/mnt/project-files/tranche-4/revue-isolation-fermes-2026-11-18.md`),
confie à la 4.3 : son constat B (F365, F366), la question de son constat A
(F351) et ses points D2 à D5 (F361, F364, F366, F370).

- **F349 · Ce que dit la documentation d'OTF, relue le 18 novembre 2026**
  (pages « OAuth2 », « Scopes », « Erreurs », « Limites et journal des
  appels », « Vue d'ensemble » des routes). L'écran d'autorisation est
  `https://www.ouvretaferme.org/api/oauth/authorize` (`response_type`,
  `client_id`, `redirect_uri`, `scope` aux portées séparées par des espaces,
  `state`, `code_challenge`, `code_challenge_method`) ; l'échange se fait à
  `https://www.ouvretaferme.org/api/oauth/token` (`grant_type`
  `authorization_code`, `client_id`, `redirect_uri`, `code`,
  `code_verifier`). Le code rendu vaut **une minute**. La réponse donne
  `structure` (`id`, `name`), `token_type` (`Bearer`), `expires_in` (3 600),
  `access_token` et `refresh_token`. Le renouvellement envoie `grant_type`
  `refresh_token`, `client_id` et `refresh_token` ; chaque renouvellement
  rend un jeton de renouvellement qui **remplace** le précédent. Aucun secret
  d'application ni aucune route de révocation par l'application ne sont
  décrits : un administrateur de la ferme retire l'autorisation dans OTF, et
  le jeton cesse de marcher ; de même quand la personne qui a autorisé
  n'administre plus la ferme. Un refus revient avec `error=access_denied`.
  Erreurs : `401` `access_denied` ou `invalid_token` ; `403`
  `scope_not_allowed`, `subscription_required`, `structure_not_allowed` ou
  `user_not_allowed` ; `429` `rate_limit_second`, `rate_limit_minute`,
  `rate_limit_day` ou `rate_limit_authentication`, avec l'en-tête
  `Retry-After`. Le compteur du jour repart à minuit ; aucune route ni aucun
  en-tête ne donne le quota restant ni l'offre de la ferme. 100 échecs
  d'authentification en 15 minutes bloquent l'adresse d'où ils viennent
  jusqu'à la fin de la fenêtre. Rien n'identifie une personne : un jeton
  désigne une ferme, pas quelqu'un.
- **F350 · Ce que couvre la 4.3, et ce qu'elle ne couvre pas.** Elle couvre
  la connexion de chaque ferme par OAuth (T4-09), le coffre des jetons
  (T4-12), le renouvellement sans course (T4-13), la révocation, le contrôle
  des droits (T4-11), le régulateur partagé et le budget du jour (T4-14,
  F334, F335), l'échelonnement du calcul du matin (T4-08) et les tests de
  contrat des routes (T4-15). Elle ne couvre pas : la voie de secours par
  clé collée (T4-10, F369) ; le choix entre plusieurs fermes d'une même
  personne (4.4) ; **le « SSO » et le « lien dans le menu Production »** de
  la ligne 4.3 de septembre. OTF ne documente aucune connexion des
  personnes (son OAuth désigne une ferme) : la connexion au module reste
  Cloudflare Access (T4-05). Un lien vers le module dans le menu d'OTF ne
  peut être posé que par OTF : à lui demander si le porteur le souhaite
  (contact extérieur, son acte). La ligne de la roadmap est alignée sur la
  section 4 de ce contrat ; la 4.7 se ferme avec la 4.3 (section 4).
- **F351 · Un raccordement par ferme, à une seule personne** (T4-04, F333).
  Le raccordement réunit la ferme (identifiant et nom donnés par OTF), la
  personne qui l'a autorisée, ses jetons chiffrés et son état : « reliée »,
  « reconnexion demandée » ou « lecture refusée », avec sa raison. Une ferme
  n'a qu'un raccordement : si une autre personne la relie déjà, la demande
  est refusée sans rien garder (« Cette ferme est déjà reliée au module par
  une autre personne. ») ; la même personne qui la relie de nouveau remplace
  ses jetons. Avant la 4.4, une personne relie une seule ferme (« Déconnectez
  d'abord <ferme>. ») ; la base admet déjà plusieurs fermes par personne. La
  ferme d'une personne est celle de son raccordement ; sans raccordement,
  pendant le passage (F366) seulement, celle de la clé du déploiement, pour
  un espace qui la lit déjà (F330, F365). Elle ne vient jamais du navigateur
  (F327). Les notifications d'un appareil suivent la personne qui l'a
  inscrit en dernier, pas l'espace : il ne reçoit que celles des espaces de
  cette personne, de toutes ses fermes à partir de la 4.4, chacune nommant
  sa ferme (question du constat A de la revue de l'isolation, tranchée à
  l'option recommandée ; le correctif, qui retire un appareil des espaces
  d'une autre personne, est un chantier de code à part, dû avant la 4.6).
- **F352 · « Autoriser le module » : le départ.** Un bouton (F367) envoie au
  serveur une demande `POST`, jamais un lien, derrière Access comme tout le
  module. Le serveur tire un `state` (32 octets aléatoires) et un
  `code_verifier` (PKCE, méthode `S256`), garde la demande dix minutes au
  plus (la personne, l'empreinte du `state`, le `code_verifier` chiffré par
  le coffre), puis renvoie vers l'écran d'autorisation d'OTF avec l'adresse
  de retour fixe (F322) et les seules portées de lecture, écrites en un seul
  endroit du code ; un test refuse toute portée d'écriture. Rien de secret ne
  passe par le navigateur, et aucun témoin (cookie) n'est ajouté. Sans
  `OTF_OAUTH_CLIENT_ID` (F368), ni le bouton ni le départ n'existent, et
  l'adresse de retour garde la page de la 4.8 ; la démonstration n'a ni l'un
  ni l'autre (elle ne lit jamais OTF).
- **F353 · Le retour.** À l'adresse de F322, le serveur retrouve la demande
  par l'empreinte du `state` et l'efface aussitôt (usage unique). Une
  demande inconnue, expirée ou ouverte par une autre personne est refusée
  sans appeler OTF (« La demande d'autorisation n'est plus valable :
  recommencez. ») ; `error=access_denied` donne « Vous avez refusé
  l'autorisation dans Ouvre ta ferme : rien n'a été lu ni enregistré. »,
  que la demande soit retrouvée ou non (elle expire alors d'elle-même).
  Sinon il échange le code, avec le `code_verifier` (et le secret
  d'application si OTF en donne un, F368), puis vérifie, avant de rien
  garder : que les portées rendues, si OTF les donne, sont toutes en
  lecture ; que `GET /me`, appelé avec le nouveau jeton (un appel compté,
  F361), désigne la ferme de `structure.id`, au sens de F338 ; qu'OTF ne
  refuse pas la ferme (`subscription_required`, `structure_not_allowed`),
  sinon la page dit, comme le veut T4-16 : « Ouvre ta ferme ne laisse pas
  le module lire cette ferme : son interface de programmation n'est ouverte
  qu'aux fermes qui ont l'abonnement qui l'ouvre, et pas aux AMAP. Rien n'a
  été enregistré. » ; que la ferme n'est pas reliée par une autre personne
  (F351). Un échec abandonne les jetons reçus, sans rien garder ni
  réessayer. Alors seulement les jetons entrent au coffre, et la page
  renvoie (`303`) vers « Réglages », qui dit « Ferme reliée : <nom> ». Le
  code ne reste pas dans l'adresse affichée.
- **F354 · Rien du retour dans les journaux (le point de F323, tranché).**
  Les journaux d'invocation du Worker du module restent comme aujourd'hui
  (sept jours, adresse comprise) : ils servent au diagnostic de tout le
  module, et Cloudflare ne permet de les couper que pour le Worker entier
  (`observability.logs.invocation_logs`), pas pour une route. Le code qu'ils
  gardent vaut une minute, ne sert qu'une fois (le module l'échange dans la
  seconde) et ne sert à rien sans le `code_verifier`, qui ne quitte jamais
  le serveur. Les journaux du module n'écrivent jamais un `code`, un
  `state`, un `code_verifier` ni un jeton, ni l'adresse de cette route avec
  ses paramètres ; les erreurs montrées non plus.
- **F355 · Le coffre (T4-12).** Chaque jeton (d'accès et de renouvellement)
  et chaque `code_verifier` est chiffré avant d'entrer dans la base :
  chiffrement authentifié AES-256-GCM (WebCrypto), un vecteur aléatoire de
  12 octets par chiffrement, et des données associées qui lient le chiffré à
  sa ligne (la ferme pour un jeton, la personne et la demande pour un
  `code_verifier`) et à son rôle : un chiffré recopié sur une autre ligne,
  celle d'une autre ferme par exemple, ne se déchiffre pas. La clé maîtresse (256 bits) est un secret Cloudflare
  posé par le porteur (F368) ; elle n'est jamais dans la base, dans Git, un
  journal, une adresse ni une réponse. Chaque chiffré porte l'empreinte
  courte de la clé qui l'a fait. Le navigateur ne reçoit que l'état, le nom
  de la ferme et la date du raccordement. Perdre la clé maîtresse ne perd
  aucune donnée du module : seuls les jetons deviennent illisibles, et
  chaque ferme se relie de nouveau.
- **F356 · La rotation de la clé maîtresse.** Le porteur pose la nouvelle
  clé, et l'ancienne sous un second nom le temps de la rotation (F368) ; le
  module déchiffre avec la clé dont l'empreinte correspond, rechiffre avec
  la nouvelle à chaque usage, puis au calcul du matin pour les fermes non
  lues ; quand plus aucun chiffré n'en dépend (le journal le dit), le
  porteur retire l'ancienne. Éprouvée par des tests ; essayée pour de vrai
  une fois avant la première ferme tierce, sur le « vas-y » du porteur
  (réglage Cloudflare).
- **F357 · Le renouvellement, un seul à la fois par ferme (T4-13).** Un
  jeton d'accès qui expire dans moins de deux minutes est renouvelé avant
  l'appel. Le renouvellement prend un bail sur la ligne du raccordement, par
  une seule écriture conditionnelle dans la base (aucun bail, ou un bail
  échu) ; le bail dure 30 secondes, plus que le délai d'un appel (8
  secondes) et son seul nouvel essai. Le détenteur appelle OTF, puis range
  les nouveaux jetons et libère le bail par une écriture qui vérifie qu'il
  le tient encore. Les autres n'appellent pas OTF : ils attendent au plus 10
  secondes que le nouveau jeton soit rangé, sinon leur lecture s'arrête
  (dernier instantané). Aucun renouvellement de fond pour garder un
  raccordement en vie : une ferme qui n'ouvre pas le module pendant un mois
  (la vie du jeton de renouvellement) se relie de nouveau, d'un clic ; le
  calcul du matin lit, donc renouvelle, chaque jour les fermes qui ont le
  planning.
- **F358 · Quand OTF refuse** (T4-17 : jamais de boucle sur `401` ou `403`).
  Un renouvellement refusé (`invalid_grant`, l'erreur ordinaire d'OAuth2)
  ou un `403` `user_not_allowed`
  met le raccordement en « reconnexion demandée » : ses jetons sont effacés,
  plus rien ne part vers OTF pour cette ferme, et le dernier instantané reste
  affiché avec « Ouvre ta ferme n'accepte plus l'accès de ce module
  (autorisation retirée ou expirée, ou la personne qui l'avait donnée
  n'administre plus la ferme). Les dernières données lues restent
  affichées ; reliez de nouveau la ferme pour les mettre à jour. ». Un `401`
  arrête la lecture ; un seul renouvellement est tenté (F357), sans relancer
  la lecture dans la même demande ; deux `401` de suite pour une ferme,
  malgré un renouvellement réussi entre eux, la mettent en « reconnexion
  demandée ». `403` `subscription_required` ou `structure_not_allowed` :
  « lecture refusée », message de F353, jetons gardés, plus aucune lecture
  automatique (pages, calcul du matin) ; seul « Actualiser » retente.
  `403` `scope_not_allowed` : « lecture refusée, droit manquant », le
  journal nomme la route. Une panne réseau ou une erreur `5xx` au
  renouvellement : un seul nouvel essai ; si OTF avait remplacé le jeton
  sans que sa réponse arrive, le raccordement passe en « reconnexion
  demandée » (cas rare, accepté, journalisé sans valeur).
- **F359 · Le frein des échecs d'authentification.** Les `401` et les
  renouvellements refusés se comptent dans la base pour tout le module : à
  10 en 15 minutes, toutes fermes confondues, plus aucun appel ne part vers
  OTF pendant 15 minutes, et le journal le dit. OTF bloque à 100 : le module
  s'arrête bien avant.
- **F360 · « Déconnecter la ferme ».** Dans « Réglages », après
  confirmation, le raccordement et ses jetons sont effacés, avec les copies
  du plan lues dans OTF (les instantanés en cache) ; ce que la personne a
  saisi dans le module (matériel, ressources, arrosages, pluie,
  observations, réglages) reste dans son espace, gardé à part, jusqu'à une
  demande d'effacement (4.5). Le module ne peut pas retirer l'autorisation
  chez OTF (aucune route décrite) ; la page le dit : « Pour retirer aussi
  l'autorisation dans Ouvre ta ferme, un administrateur de la ferme la
  retire depuis les clés d'API de la ferme, dans Ouvre ta ferme. »
- **F361 · Le régulateur partagé entre les instances du serveur** (F334,
  D-157). Le rythme d'une ferme se compte dans la base, la même pour toutes
  les instances du Worker : chaque appel à OTF, renouvellements et `GET /me`
  compris, réserve sa place par une seule écriture conditionnelle, acceptée
  seulement si le dernier départ de la ferme a plus de 255 millisecondes, si
  la ferme compte moins de 30 départs dans les 61 dernières secondes, et si
  aucune pause n'est en cours. Après un `429`, la pause vaut pour toutes les
  instances : la durée de `Retry-After`, une seconde au moins. Le compte se
  fait **par ferme**, quelle que soit la clé : les appels de la clé du
  déploiement et ceux d'un jeton de la même ferme partagent les mêmes
  places, le quota d'OTF étant celui de la ferme. Le régulateur en mémoire
  reste devant, et oublie une ferme sans départ depuis plus de 61 secondes
  (point D5 de la revue de l'isolation) ; la base fait foi. Aucun nouveau
  produit Cloudflare : la base D1 suffit, une ligne par appel gardée deux
  jours, sans dépense
  nouvelle (mesure du 9 novembre 2026 : 25 020 lignes écrites en 23 jours,
  pour 50 millions incluses chaque mois dans l'abonnement actuel).
- **F362 · Une lecture complète à la fois par ferme, qui ne part que si elle
  peut finir.** Avant son premier appel, une lecture prend le bail de
  lecture de la ferme (deux minutes au plus, pour qu'une instance arrêtée en
  route ne bloque pas la ferme) et réserve les places qu'elle va dépenser : autant que
  la dernière lecture complète réussie de la ferme, plus deux, ou 25 sans
  lecture précédente (T4-14 ; 22 sur la ferme du porteur, dont 13 pages de
  tâches). Elle ne part que si toutes ces places tiennent dans la minute
  glissante et dans le budget du jour (F363) ; sinon elle n'envoie rien, et
  le dernier instantané s'affiche avec la raison et l'heure de la prochaine
  lecture possible. Une seconde lecture de la même ferme pendant la première
  n'appelle pas OTF : elle attend au plus 5 secondes la fin de la première
  et prend ce qu'elle a rangé, sinon le dernier instantané. Une ferme qui a
  grandi au-delà de sa réserve prend ses appels de plus un à un ; refusés,
  la lecture s'arrête sans rien ranger, et la réserve suivante en tient
  compte. **Une lecture de plus de 30 appels** ne tient dans aucune minute :
  elle ne se fait qu'au calcul du matin, qui peut attendre ; à l'écran, le
  dernier instantané s'affiche avec « La lecture complète de cette ferme
  demande plus de 30 appels, le maximum qu'Ouvre ta ferme accepte par
  minute : elle se fait au calcul du matin. ». Aucune ferme connue n'en est
  là ; la règle se revoit si une ferme pilote y arrive.
- **F363 · Le compte du jour et le budget (T4-14).** Le module compte ses
  appels par ferme et par jour (de minuit à minuit, heure de Paris, D-004),
  gardés trente jours. **D'abord une mesure** : tant que la part du quota
  laissée au module n'est pas fixée, rien n'est plafonné, sauf ce qu'OTF
  impose. Un `429` `rate_limit_day` arrête tout appel de la ferme jusqu'à
  l'heure que donne `Retry-After`, sinon jusqu'à minuit, avec « Ouvre ta
  ferme a atteint le nombre d'appels permis aujourd'hui pour cette ferme,
  tous outils confondus. Les données affichées datent du <date> ; nouvelle
  lecture possible demain. ». Après quatorze jours de compte sur la ferme
  du porteur, à partir de la mise en ligne de la PR 1 (F370), la part (un
  nombre d'appels par jour, ou une part du quota de l'offre de la ferme)
  **lui est posée, chiffres à l'appui** ; le journal des appels d'OTF
  (Données, puis Intégrations, quatorze jours), qu'il peut lire lui-même,
  montre en plus ce que dépensent ses autres outils ; une fois
  fixée, à la limite, aucune lecture ne part et le dernier instantané
  s'affiche avec « Le module a utilisé aujourd'hui les appels à Ouvre ta
  ferme qui lui reviennent, pour laisser leur part à vos autres outils. ».
  **Aucune ferme tierce n'est reliée avant que la part soit fixée.** L'offre
  d'une ferme (100, 500 ou 1 000 appels par jour) n'est donnée par aucune
  route documentée : si la réponse de `GET /me` la porte (à constater à
  l'essai), elle s'y lit ; sinon la personne la choisit au raccordement, la
  plus basse par défaut.
- **F364 · Le calcul du matin (T4-08).** Il lit les fermes l'une après
  l'autre, jamais en même temps, chacune avec sa clé (F365) ; une ferme dont
  la copie a moins de quatre heures n'est pas relue ; une ferme en
  « reconnexion demandée » ou « lecture refusée » garde sa copie, sans
  appel. Une ligne d'espace illisible est écartée et journalisée, sans
  valeur, au lieu d'arrêter le calcul de toutes les fermes (point D3 de la
  revue de l'isolation). Limites de Cloudflare, relues le 18 novembre 2026
  (page « Limits » des Workers) : 10 000 sous-requêtes par invocation sur
  l'offre payante, appels à D1 compris, assez pour des dizaines de fermes à
  environ 25 appels à OTF et autant d'écritures en base chacune ; 30
  secondes de calcul pour la requête du module (`limits.cpu_ms` de
  `wrangler.jsonc` ; l'attente des réponses d'OTF ne compte pas) ; 15
  minutes au plus pour l'invocation planifiée qui l'appelle. La durée d'un
  calcul du matin à plusieurs fermes se mesure au pilote [À MESURER] : si
  elle approche la moitié de l'une de ces limites, le calcul se découpe en
  plusieurs appels, par lots de fermes.
- **F365 · Quelle clé lit quel espace.** Un espace relié lit OTF avec le
  raccordement de sa propre personne et de sa propre ferme, jamais avec
  celui d'une autre personne ni d'une autre ferme ; la garde de F332
  (`GET /me` d'abord, comparé à la ferme de l'espace) reste. Pendant le
  passage (F366), la clé du déploiement ne sert plus que les espaces qui
  lisent déjà sa ferme (F330), tant que leur personne n'a pas de
  raccordement pour elle. Une personne sans un tel espace ni raccordement
  n'obtient plus la ferme du déploiement, sans aucun repli (constat B de la
  revue de l'isolation) : elle voit « Reliez votre ferme à Ouvre ta
  ferme », avec le bouton quand il existe (F352). Un espace sans
  raccordement ni clé qui le serve garde sa copie et affiche le même
  message. Des tests à deux fermes et à deux personnes le prouvent : jamais
  le jeton de l'une pour l'autre, jamais une ligne du coffre lue depuis
  l'autre, et une personne inconnue n'ouvre aucune ferme.
- **F366 · Le passage de la clé du déploiement aux raccordements**, dans
  l'ordre : (1) le code de la 4.3 en ligne, endormi sans
  `OTF_OAUTH_CLIENT_ID` ; (2) le porteur a envoyé le formulaire d'OTF le
  18 novembre 2026 à 20 h 13 (4.8) ; à sa validation, il pose les secrets
  (F368) ; (3) l'essai de bout en bout sur « Ferme v2 » n° 4394 : pendant
  l'essai, l'espace ouvert est celui de cette ferme fictive, et celui de sa
  ferme réelle reste intact, gardé à part (F328) ; il la déconnecte à la
  fin ; (4) sur son « vas-y » (ferme réelle), il relie sa ferme : même
  ferme, donc même espace, rien ne change à l'écran ; (5) la lecture par le
  raccordement vérifiée, il retire le secret `OTF_API_TOKEN` (son acte), et
  une PR retire le chemin de la clé du déploiement, sans migration
  destructive (la table `otf_deployment_farm` reste). D'ici là, la ferme
  gardée dans cette table se départage par sa date, écrite partout au même
  format UTC, ce qu'un test fixe (point D4 de la revue de l'isolation).
  **Jusqu'au pilote (4.6), la règle d'Access du module principal n'admet que
  des personnes de la ferme du porteur** ; les fermes amies essaient la
  démonstration (constat B de la revue) : avant la PR 4 (F370), toute
  personne admise ouvre la ferme de la clé du déploiement ; après, elle
  n'en ouvre aucune, et relier une ferme tierce attend les conditions du
  pilote (F363, F369).
- **F367 · Ce que la personne voit.** Un bloc « Ouvre ta ferme » dans
  « Réglages » : la ferme reliée (nom, date), son état, les appels du jour et
  le plus haut des quatorze derniers jours, et un seul bouton selon l'état
  (« Autoriser le module », « Relier de nouveau » ou « Déconnecter la
  ferme »). La ligne d'état des données d'OTF, en haut des pages, dit
  « Reconnexion demandée » ou « Lecture refusée », avec le lien vers ce
  bloc. Parcours à l'ordinateur et à 390 px. La politique de
  confidentialité du site public (F318) dit, dans la PR qui ajoute le
  coffre, que le module garde la clé d'accès donnée par OTF, chiffrée, et
  l'efface à la déconnexion ou au retrait de l'accès, et que le responsable
  du module peut techniquement lire les données de chaque ferme dans la
  base et les journaux, ce que le texte validé le 18 novembre 2026 ne dit
  pas (point D6 de la revue de l'isolation, que l'accord écrit des fermes
  pilotes dira aussi, 4.6) ; le porteur relit les lignes changées.
- **F368 · Les secrets, posés par le porteur seul** (contrainte 3 ;
  AGENTS.md, « Sécurité ») : `OTF_OAUTH_CLIENT_ID` (rendu par OTF après le
  formulaire ; il paraît dans l'adresse de l'écran d'autorisation, mais
  c'est lui qui le pose), `OTF_OAUTH_CLIENT_SECRET` (seulement si OTF en
  donne un), `OTF_TOKEN_MASTER_KEY` (tirée et posée par une commande sur son
  poste, sans jamais s'afficher) et `OTF_TOKEN_MASTER_KEY_PREVIOUS` (le
  temps d'une rotation). Sans `OTF_OAUTH_CLIENT_ID` ou sans clé maîtresse
  lisible, rien de la 4.3 ne s'ouvre, et le module lit comme avant avec la
  clé du déploiement. Poser un secret est un réglage Cloudflare : son acte.
- **F369 · La voie de secours par clé personnelle collée (T4-10),
  tranchée par le porteur le 18 novembre 2026 à 20 h 50** (carte « 1 sur
  1 », option recommandée). T4-10 la réserve au cas où « la validation
  d'OTF tarde au moment où l'isolation est prête ». Elle n'est pas codée
  tant que le reste du pilote n'est pas prêt (relecture juridique,
  correctif du constat A de la revue de l'isolation, accord écrit des
  fermes amies, part du quota fixée), et seulement si OTF n'a toujours pas
  validé l'application à ce moment-là ; son code demande alors le
  « vas-y » du porteur, comme toute sous-tranche. Raisons : le pilote attend de toute façon
  la relecture juridique ; une clé personnelle peut porter des droits
  d'écriture que le module ne sait pas voir (OTF ne décrit aucune route qui
  dise les droits d'une clé), un risque plus grand qu'une application
  enregistrée en lecture seule ; moins de code à tenir.
- **F370 · Découpage du code et preuves.** Le code attend le « vas-y » de
  sous-tranche du porteur, en Opus 5.5 · Max (ligne 4.3) ; un seul chantier
  de code à la fois dans le module ; chaque PR après le déploiement vérifié
  de la précédente, registres dans la PR : (1) le compteur partagé (F359,
  F361 à F363), qui sert dès sa mise en ligne la clé du déploiement,
  migration additive ; (2) le coffre (F355, F356), migration additive,
  endormi ; (3) l'autorisation, le renouvellement, la révocation,
  « Déconnecter » et le bloc de « Réglages » (F351 à F354, F357, F358,
  F360, F367), endormis sans `OTF_OAUTH_CLIENT_ID` ; (4) la lecture par le
  raccordement de chaque espace et le calcul du matin ferme par ferme
  (F364, F365), avec la fin du repli sur la clé du déploiement pour une
  personne nouvelle (F365, F366) ; (5) les tests de contrat des routes
  (T4-15), indépendante, qui peut passer plus tôt : chaque route lue a sa
  vérification de forme, éprouvée sur des réponses types ; un écart arrête
  la lecture sans rien ranger, le journal nomme la route et le champ, jamais
  une valeur, et la page dit « Ouvre ta ferme a changé la forme de ses
  données : la dernière lecture réussie est affichée. » ; une réponse de
  `GET /me` qui porte plusieurs structures est refusée partout, la
  traduction de l'instantané comprise, comme le veut F338 (point D2 de la
  revue de l'isolation). Preuves, en plus
  de la section 13 : deux instances simulées ne dépassent jamais 4 départs
  par seconde ni 30 par minute pour une ferme ; deux lectures simultanées
  n'en font qu'une ; une lecture qui ne peut pas finir n'envoie rien ; deux
  renouvellements simultanés n'en font qu'un, et l'autre lecteur reçoit le
  nouveau jeton ; un chiffré déplacé sur une autre ferme ne se déchiffre
  pas ; la rotation déchiffre l'ancien et rechiffre ; des jetons connus,
  semés dans les tests, ne se retrouvent dans aucune réponse, erreur ni
  journal ; une personne inconnue n'ouvre aucune ferme ; une ligne d'espace
  illisible n'arrête pas le calcul du matin des autres fermes ; l'essai de
  bout en bout sur « Ferme v2 » n° 4394, retrait de l'autorisation dans
  OTF compris.

**Non établi, à constater à l'essai de bout en bout** : les portées exactes
que l'enregistrement donnera (les droits du formulaire : structure,
parcellaire, cultures, interventions, espèces et variétés, en lecture) ;
l'existence d'un secret d'application ; la forme attendue par la route
d'échange ; si l'ancien jeton de renouvellement cesse de marcher à
l'instant du remplacement (ce contrat le suppose) ; si les appels de la
route d'échange comptent dans le quota (ce contrat les compte) ; le fuseau
du minuit d'OTF ; les champs de `GET /me` ; si `state` revient avec un
refus.

### 6.3 bis. Précisions de la PR 1 de la 4.3 : le compteur partagé (19 novembre 2026, D-161, F381 à F390)

Décidées en écrivant le code de la PR 1 (F370, point 1) et écrites dans la
même PR que lui, la nuit du 18 au 19 novembre 2026, en Opus 5.5 · Max (ligne
4.3 de la roadmap), sous le mandat de nuit du porteur (« enchaîne, code
toute la nuit, tout seul »). Elles précisent F359 et F361 à F363 là où le
code a dû choisir, sans les changer. Toutes suivent l'option recommandée :
aucune n'est agronomique, ne touche au budget du porteur ni ne change un
réglage de Cloudflare ; il peut les changer. Le compteur sert dès sa mise
en ligne la clé du déploiement, la seule jusqu'à la PR 4 : rien ne change à
l'écran tant qu'Ouvre ta ferme répond dans ses limites.

- **F381 · La ferme, clé du compteur.** Le compteur compte sous
  l'identifiant de la ferme dans OTF (F361), quelle que soit la clé qui
  appelle : la lecture d'un espace, sous celui de sa ferme, vérifiée avant
  tout appel (F342). Le seul appel dont la ferme n'est pas encore connue,
  le `GET /me` qui la fait connaître quand aucune ferme n'est gardée ni en
  cache (F339), se compte sous une clé à part,
  `clé-du-déploiement·ferme-inconnue`, qui n'a pas la forme d'un
  identifiant de ferme (F327) ; la pause du module entier (F359, F382) se
  range sous `*`, qui ne l'a pas non plus. Le régulateur en mémoire de
  l'instance (F334) reste celui de la clé du déploiement jusqu'à la PR 4.
- **F382 · Après un `429` d'OTF.** Le code se lit dans le corps de la
  réponse (`error`, `code` ou `error.code`), parmi les quatre que documente
  OTF (F349) ; rien d'autre n'est deviné, et la forme exacte du corps se
  constate à l'essai de bout en bout. `rate_limit_day` arrête la ferme
  jusqu'à l'heure de `Retry-After`, sinon jusqu'à minuit à Paris,
  changement d'heure compris (F363). `rate_limit_authentication` dit
  qu'OTF bloque l'adresse du serveur, qui est celle de toutes les fermes :
  tout le module s'arrête, la durée de `Retry-After`, sinon quinze minutes.
  Les autres, et un `429` sans code lisible, arrêtent la ferme la durée de
  `Retry-After`, une seconde au moins. `Retry-After` se lit en secondes ou
  en date HTTP ; illisible, il est ignoré. La pause s'écrit dans la base,
  pour toutes les instances ; une pause plus courte ne raccourcit pas celle
  qui court. Si la base ne répond pas à cet instant, la limite remonte
  quand même, l'instance tient une seconde en mémoire et le journal le dit
  (`otf_pause_not_recorded`).
- **F383 · Le calcul du matin attend.** Ses lectures (le planning de la
  semaine, l'ETM et la réserve du sol du jour, F364) attendent qu'une
  minute ait la place au lieu de renoncer : 62 secondes au plus (la minute
  glissante de 61 secondes, et une seconde), au départ de la lecture comme
  pour chacun de ses appels. Une page n'attend que cinq secondes (F334). Le
  bail de deux minutes suffit à une lecture qui tient dans sa réserve ; une
  lecture du matin de plus de soixante appels pourrait le dépasser et
  laisser partir une seconde lecture de la ferme, qui ne franchit pas les
  limites (F385) mais dépense des appels : aucune ferme connue n'en est là.
- **F384 · Les places réservées.** Elles s'écrivent au départ de la
  lecture, à son heure, et comptent dans la minute glissante comme des
  départs, pas dans le compte du jour. Chaque appel de la lecture prend
  l'une d'elles tant qu'il en reste : elle devient un départ, à l'heure de
  l'envoi, et compte alors dans le compte du jour ; puis des places
  neuves, une à une (F362). Une place réservée encore dans la minute n'en
  demande pas une de plus ; sortie de la minute (une lecture du matin de
  plus de 61 secondes), elle se juge comme une place neuve. La fin de la
  lecture rend celles qui restent. La mémoire de l'instance (F334) refuse
  avant la base un appel dont la place est trop lointaine, pour la même
  raison, « la minute », sans rien envoyer : la réserve suivante en tient
  compte de la même façon.
- **F385 · Ce que garantit la base, et sa limite.** Chaque place se prend
  par une seule écriture conditionnelle (F361) : les 255 millisecondes et
  les 30 places en 61 secondes sont tenues à l'instant où la base écrit la
  place, pour toutes les instances. Entre cette écriture et l'arrivée chez
  OTF passe le temps d'une réponse de la base, quelques millisecondes :
  deux instances qui appelleraient la même ferme pourraient arriver chez
  OTF un peu plus près que 255 millisecondes. La marge de l'espacement
  (5 millisecondes) et la seconde de la minute le couvrent en partie ;
  surtout, une seule lecture complète à la fois par ferme (F362) fait qu'en
  pratique une seule instance appelle une ferme ; un `429` qui en
  viendrait suivrait F382. Dans une instance, l'envoi part dans le tour de
  sa ferme, après la place, et son départ est noté en mémoire aussitôt
  après l'appel réseau : l'appel suivant compte son attente à partir de
  là, et l'espacement des envois y est exact, même quand le processus est
  interrompu entre le tour et l'envoi (précisé le 20 novembre 2026 : le
  départ noté juste avant l'appel avait laissé la CI mesurer une fois
  249 ms entre deux envois). Un appel refusé redemande sa place à l'heure
  que dit la base (l'espacement, la minute), vingt fois au plus ; au-delà,
  il n'est pas envoyé, comme sur une minute pleine, et le journal le dit
  (`otf_shared_place_unavailable`).
- **F386 · Ce que dit la page.** Une lecture qui n'a pas lieu laisse le
  dernier instantané, avec la raison ; la date des données est celle de la
  ligne « Dernière synchronisation », juste en dessous, que le message de
  F363 ne répète donc pas :
  - minute pleine, ou limite d'OTF à la seconde ou à la minute : « Limite
    de requêtes OTF atteinte. La dernière lecture réussie est affichée ;
    nouvelle lecture possible à 22:41. », quand l'heure est connue et dans
    la journée, sinon le message d'avant (« Patientez quelques minutes
    avant d'actualiser à nouveau. ») ;
  - limite du jour (F363) : « Ouvre ta ferme a atteint le nombre d'appels
    permis aujourd'hui pour cette ferme, tous outils confondus : nouvelle
    lecture possible demain. » ;
  - plus de 30 appels : le message de F362 ;
  - une autre lecture de la ferme en cours (F388) : « Une lecture d'Ouvre
    ta ferme est déjà en cours pour cette ferme. La dernière lecture
    réussie est affichée ; actualisez dans un instant. » ;
  - le frein (F359) ou le blocage d'adresse (F382) : « Connexion à Ouvre ta
    ferme indisponible. La dernière lecture réussie est affichée. » ; le
    journal dit le frein (`otf_authentication_brake`, avec son heure de
    fin).

  Sans dernier instantané, une page d'état par raison (« Limite du jour
  atteinte », « Lecture en cours », « Lecture au calcul du matin »), qui
  dit qu'aucune donnée n'a été modifiée.
- **F387 · Le ménage.** Au départ de chaque lecture complète, dans le même
  lot que son bail : les départs de plus de deux jours (F361), les comptes
  du jour de plus de trente jours (F363), les refus d'accès de plus de
  quinze minutes (F359) et les pauses finies. Aucune tâche planifiée de
  plus : le calcul du matin lit chaque jour.
- **F388 · La seconde lecture prend ce que la première a rangé.** Le bail
  est rendu après l'écriture du cache. Une seconde lecture de la même
  ferme relève le bail tous les quarts de seconde, cinq secondes au plus
  (F362), puis relit le cache de son espace : plus récent que celui qu'elle
  avait trouvé avant, il s'affiche tel quel, sans avertissement ; sinon le
  sien, avec la raison « lecture en cours ». Deux personnes d'une même
  ferme ont chacune leur espace et leur cache (F328) : la seconde affiche
  le sien.
- **F389 · La mémoire de l'instance ne grandit pas avec le nombre de
  fermes** (point D5 de la revue de l'isolation). Le régulateur en mémoire
  d'une ferme (F334) est oublié dès qu'il ne retient plus rien : aucun
  appel en attente, aucun départ dans les 61 dernières secondes, aucune
  pause en cours. L'oubli se fait au passage, quand une autre ferme
  appelle.
- **F390 · Cinq tables, et ce qu'elles ne contiennent pas.** Migration
  additive 0032 : `otf_call_starts` (une ligne par départ ou place
  réservée, gardée deux jours), `otf_daily_calls` (le compte du jour, tenu
  par deux déclencheurs de la base à chaque départ réel, gardé trente
  jours), `otf_call_pauses`, `otf_authentication_failures` (quinze
  minutes) et `otf_farm_reads` (le bail et la base de la réserve). Des
  fermes (leur identifiant OTF), des heures et des nombres : ni jeton, ni
  adresse, ni personne. Elles n'appartiennent à aucun espace : le contrôle
  de cohérence des espaces (F380) les range parmi les tables communes. Le
  compte du jour s'affichera dans « Réglages » (F367, PR 3) ; la mesure de
  quatorze jours (F363) commence à la mise en ligne de cette PR.

**Preuves** (F370, PR 1) : `tests/db/otf-farm-read.test.ts` (deux
instances simulées du connecteur ne dépassent jamais 4 départs par seconde
ni 30 par minute pour une ferme, quand les deux mémoires seules en
laisseraient passer plus ; deux lectures simultanées n'en font qu'une ; une
lecture qui ne peut pas finir n'envoie rien ; la limite du jour, le frein,
la réserve suivante, la lecture d'un espace de bout en bout, Ouvre ta ferme
simulé) ; `tests/db/otf-call-ledger.test.ts` (chaque écriture
conditionnelle de la base) ; `tests/otf-shared-call-pace.test.ts` (les
règles pures, minuit de Paris et changement d'heure compris) ;
`tests/otf-read-client-shared-pace.test.ts` (le connecteur et le compteur,
le point D5) ; `tests/snapshot-policy.test.ts` (les messages de F386).

### 6.3 ter. Précisions de la PR 5 de la 4.3 : les tests de contrat des routes (19 novembre 2026, D-162, F391 à F396)

Décidées en écrivant le code de la PR 5 (F370, point 5 ; T4-15) et écrites
dans la même PR que lui, la nuit du 18 au 19 novembre 2026, en Opus 5.5 ·
Max, sous le mandat de nuit du porteur. Elles précisent F370 (point 5) et
F338 là où le code a dû choisir, sans les changer, toutes à l'option
recommandée. La PR 5 passe avant la PR 2, comme F370 le permet : la PR du
coffre attend la relecture, par le porteur, des lignes de la politique de
confidentialité qu'elle change (F367).

- **F391 · Une vérification par route, dès sa réponse.** Chacune des dix
  routes lues (F337, `docs/otf-contract.md`) a sa vérification de forme,
  faite dès que sa réponse est arrivée, toutes pages réunies, avant l'appel
  suivant : un écart arrête la lecture, rien n'est rangé, et les routes qui
  restaient ne sont pas appelées (le quota n'est pas dépensé pour rien).
  Elle refuse ce que le module ne sait pas lire sans deviner (D-003) : une
  page qui ne porte pas de liste ; un élément qui n'est pas un objet, ou
  sans identifiant lisible (`id`, ou le dernier segment de `@id`) ; ce que
  la traduction de l'instantané lit sur chaque élément (la parcelle d'un
  jardin, sauf un remplissage de parcelle ; le jardin d'une planche ; la
  saison d'une série et ses mises en culture, chacune avec son identifiant,
  son espèce et des semaines ISO ; la série d'un emplacement ou d'une
  tâche, quand elle n'est pas nulle) ; `/configuration` est vérifiée par sa
  traduction, faite aussitôt lue. Ce que seule la traduction peut voir,
  parce qu'il dépend d'une autre route (la planche d'un emplacement d'une
  série de la saison, l'intervention et les semaines d'une tâche gardée),
  elle le refuse de même, en nommant la route et le champ. La vérification
  n'est jamais plus stricte que la traduction sur ce que celle-ci ne lit
  pas : la semaine d'une tâche écartée, la planche d'un emplacement sans
  série, une liste de mises en culture qui n'en est pas une (lue vide,
  comme avant) ne sont pas des écarts. Une donnée lisible n'est donc
  refusée que par F392 et F393, écrits pour cela.
- **F392 · `GET /me` à plusieurs structures, refusé partout** (point D2 de
  la revue de l'isolation, F338). Une seule règle lit les structures d'une
  réponse de `GET /me` (`otfStructuresOf`), pour l'identité, la
  vérification et la traduction de l'instantané. Plusieurs structures sont
  un écart de forme de `/me` : la lecture s'arrête après `/me`, qu'une
  ferme soit attendue ou non, et la traduction ne prend plus la première ;
  un vieil instantané ne peut donc jamais servir de preuve de ferme. Sans
  structure lisible, la règle de F341 reste : la ferme n'est pas
  identifiée, et l'instantané garde le remplaçant d'affichage.
- **F393 · Un champ lu avec une valeur par défaut, absent de tous les
  éléments, a changé de nom.** Le module lit certains champs avec une valeur
  par défaut (une longueur à zéro, une série « en planches », une tâche « à
  faire ») : s'ils changeaient de nom, il calculerait faux sans rien dire.
  Pour les champs constatés sur la ferme du porteur (`docs/otf-contract.md`,
  « Particularités confirmées » ; `docs/series-contract.md`, « Ce que l'API
  fournit »), un champ absent de tous les éléments d'une réponse qui en
  porte est un écart : `/bedList` `length`, `width`, `alleyWidth` ;
  `/actionList` `fqn` ; `/seriesList` `use`, `cycle`, `cultivations`, et
  `harvestWeeks`, `harvestWeeksExpected` de ses mises en culture ;
  `/placeList` `length` ; `/taskList` `action`, `series`, `cultivation`,
  `plannedWeek`, `doneWeek`, `status`. Un champ présent sur un seul
  élément, même nul, suffit : Ouvre ta ferme écrit les champs vides
  (`alleyWidth: null`, `fqn: null`). Une réponse vide n'est pas un écart.
  Les autres champs lus par défaut (le mode d'un jardin, les saisons d'un
  élément, les noms, la surface d'une parcelle) ne sont pas vérifiés : leur
  forme réelle n'est pas encore constatée ; ils le seront à l'essai de bout
  en bout (F395).
- **F394 · Ce que disent la page et le journal.** Avec un instantané en
  cache, la page l'affiche avec « Ouvre ta ferme a changé la forme de ses
  données : la dernière lecture réussie est affichée. » ; sans instantané,
  une page d'état « Ouvre ta ferme a changé la forme de ses données », avec
  « Réessayer », qui dit que rien n'est affiché plutôt que des données
  fausses. Le journal écrit une ligne `otf_route_shape_changed` avec la
  route, le champ et le problème (champ absent partout, pas un objet,
  identifiant, relation, entier, liste ou semaine illisible, plusieurs
  structures), jamais une valeur ; le message de l'erreur aussi. Les
  messages de la traduction ne portent plus l'identifiant d'une série,
  d'une mise en culture ni d'une tâche. Le calcul du matin garde le dernier
  instantané, comme pour toute lecture qui échoue.
- **F395 · Les réponses types, et l'essai de bout en bout.** Les réponses
  types de chaque route (`tests/support/otf-typical-responses.ts`) sont
  réduites et calquées sur celles constatées sur la ferme, champs nuls
  compris ; chaque règle de F391 à F393 y est éprouvée, pour l'écart comme
  pour l'absence d'écart. À l'essai de bout en bout sur « Ferme v2 »
  n° 4394 (F366), les vraies réponses de chaque route sont comparées à ces
  réponses types, sans garder aucune valeur ; un écart entre elles se
  corrige dans une PR, avant toute ferme tierce, et les champs de F393 non
  encore vérifiés y entrent s'ils sont toujours écrits.
- **F396 · Ce qui n'est pas un écart de forme.** Une valeur incohérente dans
  une forme juste garde son message d'aujourd'hui (« Connexion à Ouvre ta
  ferme indisponible ») : une plage de saisons à l'envers, un jardin ou une
  planche qui désigne un parent absent (`docs/otf-contract.md`, « Lecture
  atomique »). Une réponse qui n'est pas du JSON, une erreur `5xx` ou une
  panne réseau restent des pannes (trois essais au plus). L'identité de la
  ferme lue seule (F339) applique déjà F338 : plusieurs structures n'y sont
  pas une ferme. Aucun changement à l'écran tant qu'Ouvre ta ferme répond
  dans sa forme.

**Preuves** (F370, PR 5) : `tests/otf-route-shapes.test.ts` (chaque règle de
F391 à F393 sur les réponses types, l'écart nommé par sa route et son champ
sans aucune valeur, ce que la vérification ne refuse pas, D2 à la
vérification et à la traduction) ; `tests/otf-route-shapes-reader.test.ts`
(la lecture s'arrête avant l'appel suivant ; le journal ne porte ni valeur
ni jeton ; `/me` à plusieurs structures, ferme attendue ou non ; la lecture
de toutes les saisons) ; `tests/db/otf-route-shapes-cache.test.ts` (de bout
en bout, sur une base migrée : le cache reste celui de la dernière lecture
réussie, avec le message de F394, et sans cache la page d'état) ;
`tests/snapshot-policy.test.ts` (le motif `shape-changed`).

### 6.3 quater. Précisions de la PR 2 de la 4.3 : le coffre des jetons (19 novembre 2026, D-163, F397 à F403)

Décidées en écrivant le code de la PR 2 (F370, point 2 ; T4-12) et écrites
dans la même PR que lui, la nuit du 18 au 19 novembre 2026, en Opus 5.5 ·
Max, sous le mandat de nuit du porteur. Elles précisent F355, F356 et F368
là où le code a dû choisir, sans les changer, toutes à l'option
recommandée. Aucune n'est agronomique, ne touche au budget ni ne change un
réglage de Cloudflare : poser les secrets reste l'acte du porteur (F368),
à la validation d'OTF. La PR attend, avant sa fusion, que le porteur relise
les lignes changées de la politique de confidentialité (F367, F403).

- **F397 · La clé maîtresse : sa forme, sa pose et son empreinte.** Elle
  vaut 32 octets aléatoires écrits en base64, ce que donne
  `openssl rand -base64 32` ; la variante base64url, l'absence de
  remplissage et les blancs autour sont admis ; toute autre forme ou
  longueur est illisible. Le porteur la tire et la pose d'une seule
  commande sur son poste, qui l'envoie à Cloudflare sans l'afficher
  (`openssl rand -base64 32 | npx wrangler secret put OTF_TOKEN_MASTER_KEY`,
  ou son équivalent sous PowerShell, donné avec les autres secrets de la
  4.3 au moment de les poser). Son empreinte est faite des 8 premiers
  octets d'un SHA-256 de la clé, précédée d'une étiquette propre au coffre,
  en hexadécimal (16 caractères) : elle dit quelle clé a fait un chiffré
  sans rien apprendre de la clé. Le journal ne l'écrit pas : il compte.
- **F398 · L'état du coffre.** Sans `OTF_TOKEN_MASTER_KEY` ni
  `OTF_TOKEN_MASTER_KEY_PREVIOUS`, il est **endormi** : rien de la 4.3 ne
  s'ouvre (F368), et le module lit comme avant. Un secret posé mais
  illisible, ou l'ancienne clé posée sans la nouvelle, le mettent **hors
  d'usage** : rien ne s'ouvre et rien n'est effacé ; le calcul du matin le
  dit au journal (`otf_vault_unavailable`, avec le nom du secret, jamais sa
  valeur), et tout reprend dès que le secret est corrigé. Il échoue fermé,
  plutôt que de prendre pour perdus les chiffrés d'une clé mal posée.
  Sinon, il est **prêt**. La même valeur posée sous les deux noms n'est pas
  une rotation. La démonstration n'a jamais de coffre : elle refuse de
  démarrer si l'un des deux secrets lui est posé (refus `otf-vault-key`,
  comme pour `OTF_API_TOKEN`).
- **F399 · Le chiffré.** `v1.<empreinte>.<vecteur>.<chiffré>` : AES-256-GCM
  (WebCrypto), un vecteur aléatoire de 12 octets par chiffrement, une
  étiquette de 128 bits, le vecteur et le chiffré en base64url. Les données
  associées sont une liste JSON : l'étiquette du coffre, le rôle et la
  ferme pour un jeton d'accès ou de renouvellement ; l'étiquette, le rôle,
  la personne et la demande pour un `code_verifier`. Écrites en liste,
  aucun caractère d'une valeur ne peut en imiter une autre. Le coffre ne
  chiffre ni une valeur vide, ni pour une ferme dont l'identifiant n'a pas
  la forme de F327, ni pour une personne ou une demande vides.
- **F400 · Ce qui ne s'ouvre pas.** Un chiffré fait par une clé que le
  trousseau n'a plus : « la ferme doit être reliée de nouveau » (F355) ; la
  PR 3 le traite comme un accès retiré (« reconnexion demandée », F358).
  Un chiffré déplacé sur la ligne d'une autre ferme, pris pour un autre
  rôle ou altéré : il ne s'ouvre pas. Une forme inconnue : refusée sans
  rien essayer. Jamais une valeur devinée ; chaque erreur nomme son
  problème, jamais un jeton, une clé ni un chiffré.
- **F401 · La rotation, à l'usage et au calcul du matin** (précise F356).
  À l'usage, les deux jetons d'une ferme ouverts avec l'ancienne clé sont
  chiffrés de nouveau avec la courante, par une écriture conditionnelle
  qui n'écrase jamais des jetons rangés entre-temps (un renouvellement les
  a déjà chiffrés avec la courante). Au calcul du matin, à la fin de la
  route du matin, après ses autres étapes, même si la météo a échoué,
  jamais pendant qu'un autre passage court, la même chose pour chaque
  raccordement encore chiffré par l'ancienne clé. Le journal écrit une
  ligne `otf_vault_morning` : les raccordements qui gardent des jetons,
  ceux qui viennent d'être chiffrés de nouveau, ceux qui dépendent encore
  de l'ancienne clé, ceux qu'aucune clé n'ouvre, et `previousKeyRemovable` :
  à `true`, plus aucun chiffré ne dépend de l'ancienne clé, et le porteur
  peut la retirer (son acte). Un raccordement illisible est compté, laissé
  tel quel, et n'arrête pas les autres ; un échec du passage n'est pas un
  échec du matin.
- **F402 · Le raccordement dans la base.** La PR 2 crée la table du
  raccordement (`otf_farm_connections`, migration additive 0033), parce
  qu'elle est la seule ligne où les jetons entrent dans la base (F351) :
  la ferme (sa clé : un raccordement par ferme), la personne qui l'a
  autorisée, le nom de la ferme, l'état (« reliée », « reconnexion
  demandée », « lecture refusée ») et sa raison, les deux jetons chiffrés,
  l'échéance du jeton d'accès et la date du raccordement. La base impose
  qu'un raccordement en « reconnexion demandée » n'ait plus de jetons
  (F358), et que les deux autres états en aient. Un raccordement se lit
  par l'espace, sa personne et sa ferme ensemble (le filtre de tous les
  espaces), jamais depuis l'espace d'une autre personne (F365). Il se
  range par une seule écriture conditionnelle : une ferme sans raccordement
  le reçoit ; la même personne qui la relie de nouveau remplace ses jetons
  et la date ; si une autre personne la relie déjà, rien ne change (F351).
  Rien n'y écrit avant la PR 3, qui écrit les états et leurs raisons et
  ajoute, par une migration additive, ce que le renouvellement demande
  (son bail, F357). La demande d'autorisation, qui ne vit que dix minutes,
  naît avec le départ (PR 3, F352) et sa table avec lui ; son
  `code_verifier` est chiffré par ce même coffre, lié à la personne et à
  la demande, ce que la PR 2 éprouve déjà.
- **F403 · Le texte public et le contrôle de cohérence des espaces.** La
  politique de confidentialité du site public dit, datée du
  19 novembre 2026 : dans « Ce que le module garde », « La clé d'accès
  donnée par Ouvre ta ferme, quand votre ferme est reliée au module :
  elle lui permet de lire la ferme sans vous redemander l'autorisation.
  Elle est gardée chiffrée, et effacée quand vous déconnectez la ferme
  dans le module, ou dès que le module constate qu'Ouvre ta ferme
  n'accepte plus son accès (autorisation retirée ou expirée). » ; dans
  « Où sont les données », « Le responsable du module administre cet
  hébergement : il peut techniquement lire les données de chaque ferme
  dans la base de données et dans les journaux techniques. Il ne les
  consulte que pour faire fonctionner le module, répondre à une demande
  ou corriger une panne. » (point D6 de la revue de l'isolation ; la
  seconde phrase est un engagement que le porteur garde ou retire à sa
  relecture). Les conditions d'utilisation ne changent pas et gardent leur
  date. Au contrôle de cohérence des espaces (F380), le raccordement est
  rangé parmi les tables communes : sa clé est la ferme, il se lit par
  l'espace lui-même et ne désigne aucune ligne d'un espace.

**Preuves** (F370, PR 2) : `tests/otf-token-vault.test.ts` (la clé et ses
formes, l'état du coffre, chaque rôle chiffré et ouvert, un vecteur neuf à
chaque chiffrement, le chiffré déplacé sur une autre ferme ou pris pour un
autre rôle, le `code_verifier` lié à la personne et à la demande, la
rotation, le chiffré altéré ou mal formé, aucune valeur dans une erreur) ;
`tests/db/otf-token-vault.test.ts` (sur une base migrée : aucune colonne ne
porte un jeton ni la clé ; le raccordement ne s'ouvre que pour sa personne
et sa ferme ; F351 ; le chiffré recopié d'une ferme à l'autre ; la rotation
à l'usage et au matin, et le journal qui dit quand l'ancienne clé peut
partir ; une ligne illisible qui n'arrête pas les autres ; l'écriture
conditionnelle qui n'écrase pas un renouvellement ; le coffre endormi, hors
d'usage, et absent de la démonstration ; les contraintes de la base ; aucun
jeton ni aucune clé semés dans un journal) ; `tests/demo-mode.test.ts` (le
refus `otf-vault-key`) ; `cloudflare/irrigation-site/test/site.test.ts`
(les lignes de F403).

## 7. Généralisation : ce qui est propre à la ferme de François (étape 0)

À inventorier **en lisant le code, sans le modifier**, avant 4.4 ; livrable : un tableau « élément · où · pourquoi propre à la ferme · à généraliser comment · question agronomique ? ». Pistes déjà connues : jeu commun de 32 cultures et correspondance de 78 espèces ; valeurs par défaut (K_abri 0,8, rampes tunnel, 10 mm/h mesuré en serre) ; seuils de gel ; noms de lieux dans les recettes ; commune météo par défaut (siège OTF) ; la RFU en mm/m (62 labo, 51 ferme). **Toute valeur agronomique à choisir pour d'autres fermes est une question réservée à François** (une par message). Règle : pour une ferme nouvelle, **aucune valeur de la ferme de François n'est un défaut silencieux** : soit un catalogue neutre, soit « inconnu, à renseigner ».

## 8. Accueil d'une nouvelle ferme (4.4)

Parcours cible, un écran par étape, reprenable (ferme « pas finie de configurer » sans erreur trompeuse) :

1. Connexion (courriel + code via Access).
2. **Relier la ferme OTF** : « Autoriser le module » ; contrôle immédiat par `GET /me` ; **le nom de la ferme est affiché pour confirmation** ; message si AMAP / abonnement manquant.
3. Saison et commune météo (**la personne choisit la commune** ; le siège OTF n'est qu'un dernier recours dit comme tel : section 8 bis, F419).
4. Fonctionnalités à cocher (3.8 : « plus de mode simple ou complet ») et matériel et ressources, avec l'aide du catalogue et du calculateur.
5. Correspondance des espèces avec le catalogue (ce qui n'a pas de correspondance reste « inconnu », visible).
6. Vérification finale : tout est vert, ou la liste de ce qui manque.

La **visite guidée** et la démonstration (4.0) servent de formation : aucune nouvelle visite n'est prévue en 4.4 sauf si la recette en montre le besoin. Notifications push **par ferme** ; **clé météo** : communale à toutes les fermes ou par ferme, coût non relevé [À FAIRE, étape 0].

### 8 bis. Précisions de la 4.4 : configuration et accueil d'une nouvelle ferme (19 novembre 2026, D-168, F417 à F428)

Écrites avant le code, le 19 novembre 2026, en Sonnet 5.5 · Moyen (contrat sans code ; le code de la 4.4 est en Opus 5.5 · Élevé, ligne 4.4 de la roadmap), sans accès d'OTF. Elles précisent la section 8, reprennent l'inventaire du propre à la ferme (`/mnt/project-files/tranche-4/inventaire-propre-a-la-ferme-2026-11-18.md`, défauts n° 1, 4, 13, 14, 19, 21, 22) et les onze réponses du porteur du 18 novembre 2026 (Q1 à Q11), et tranchent quatre questions au porteur le 19 novembre 2026 (F428). Les repères `F417` à `F427` désignent les points « a » à « k » du texte ; le brouillon d'origine est `/mnt/project-files/tranche-4/contrat-4-4-accueil-brouillon-2026-11-19.md`.

#### 8 bis.1 · Objet

Une personne dont la ferme vient d'être reliée à Ouvre ta ferme (4.3) arrive dans un module **qui ne sait rien d'elle**. La 4.4 fait en sorte que, de ce moment jusqu'à son premier planning, **chaque chiffre affiché soit le sien, soit une proposition qu'elle a lue et confirmée, soit « à renseigner »** : jamais une valeur de la ferme de François reprise en silence (règle de la section 7 du contrat ; défauts n° 1, 4, 13, 14, 19, 21, 22 de l'inventaire).

La 4.4 **ne change ni le bilan hydrique ni les jeux de réglages du moteur** (section 11 du contrat) : elle décide *quelles valeurs de départ* sont proposées et *comment la personne les confirme*. Une seule exception de calcul, voulue par François : la borne de l'ET0 passe de 12 à 15 mm/j (F424).

**Limite écrite (réponse Q2 de François) :** le pilote est limité à **la France métropolitaine, en français, fuseau Europe/Paris**. Une ferme hors de ce périmètre est dite hors périmètre à l'étape « Où est la ferme », sans rien enregistrer. Le fuseau par ferme et les autres langues sortent de la 4.4 (n° 17, 18, 20 de l'inventaire).

#### 8 bis.2 · Contraintes tenues

1. Celles de la section 2 du contrat (inconnu reste inconnu, D-003 ; OTF en lecture seule, 4 requêtes par seconde au plus ; aucun secret vu par l'assistant).
2. **Rien de la ferme de François n'est un défaut silencieux** pour un espace neuf. Preuve par test (section 6).
3. **L'espace existant de François ne change pas de comportement** (F426) : il n'est ni bloqué à l'accueil ni recalculé autrement.
4. Une table ou une colonne `_id` / `_key` nouvelle est rangée dans `tests/support/space-coherence.ts` ; aucune requête n'écrit `owner_user_id = ?` ni `otf_farm_id IS NULL` hors `db/workspace-scope.ts` (règle de #87 et #93).
5. Aucun identifiant de ferme dans une migration (n° 16 de l'inventaire).
6. Toute lecture d'OTF passe par le régulateur et le budget du jour de la 4.3 (F361, F363) ; chaque nouvel appel entre dans les tests de contrat des routes (6.3 ter).

#### 8 bis.3 · Le parcours (précise la section 8)

Un écran par étape, **reprenable** : fermer l'onglet ou être coupé ne perd rien et ne produit aucune erreur trompeuse. L'état de chaque étape est gardé dans la base (F417). Le fond est le même sur téléphone et à 1440 px.

| Étape | Écran | Ce qui est lu ou proposé | La personne fait | Existe déjà ? |
| --- | --- | --- | --- | --- |
| 0 | Fonctionnalités (cases à cocher) | rien coché d'avance | coche | oui (`bienvenue`, R5 : avant toute lecture d'OTF) ; inchangé |
| 1 | Relier la ferme | 4.3 : « Autoriser le module », `GET /me`, **nom de la ferme affiché pour confirmation** | autorise, confirme le nom | 4.3 ; la 4.4 y ajoute le choix entre plusieurs fermes (F418) |
| 2 | Où est la ferme | lieu de production d'OTF (`placeLngLat`, `place`, altitude) si présent | **choisit la commune** sur la carte des parcelles | non (F419) |
| 3 | Parcelles et abris | classement proposé abri / plein champ, parcelle par parcelle | valide ou corrige chacune | non (F420) |
| 4 | Sol | texture OTF (`System.soil`) si présente, sinon liste | confirme la texture ; TEW et REW proposés | non (F421) |
| 5 | Cultures | catalogue commun, **région d'origine affichée**, avertissement si autre région | rattache ses espèces (proposition par nom) ; copie le catalogue | partiellement (F422, F423) |
| 6 | Réglages à relire | planning, gel, alertes, surfaces… en « proposé, à ajuster » | valide, ajuste ou passe | non (F424) |
| 7 | Vérification finale | liste verte, ou ce qui manque | corrige ou continue | non (F427) |

**Rien n'oblige à tout finir d'un coup.** Une ferme « pas finie » ouvre le module ; chaque page dit ce qui lui manque et renvoie à l'étape (bandeau « À finir : sol des parcelles »), sans erreur ni zéro. Mais **aucun planning n'est calculé** tant que l'étape 6 n'est pas validée (réponse Q10).

#### 8 bis.4 · Les points

##### F417 · L'état de l'accueil

Une table par espace (clé d'espace de #87), une ligne par étape : `étape`, `état` (`à faire`, `proposé`, `confirmé`, `passé`), `confirmé le`, `valeur proposée gardée` (pour montrer ce qui a été proposé et ce qui a été confirmé). Migration additive, numéro pris sur `main` au moment du code (le 0034 est réservé à la 4.3 PR 3). Un « passé » est **dit** à la vérification finale (« Vous n'avez pas confirmé le sol : la réserve utile reste non calculable »). Rien n'est confirmé à la place de la personne.

##### F418 · Plusieurs fermes pour une personne

La 4.3 limite une personne à une ferme (F351 : « Déconnectez d'abord… ») ; la base en admet plusieurs. La 4.4 lève la limite : un sélecteur de ferme dans l'en-tête, un accueil **par ferme** (l'état est par espace), et chaque notification **nomme sa ferme** (reste dû de F373). La ferme active vient du serveur (jamais du navigateur, F327). [NON VÉRIFIÉ] : si une personne liant deux fermes doit être réellement offerte au pilote ; recommandation : coder le sélecteur (le test d'isolation à deux fermes de la même personne est le plus exigeant), l'essayer sur « Ferme v2 » n° 4394 et sur une seconde ferme fictive, ne l'offrir au pilote que sur demande.

##### F419 · Où est la ferme (n° 19, 17, 18)

- **Fin du repli silencieux sur le siège.** Aujourd'hui `weatherLocationKey` prend `legalCity` (siège de la structure OTF) en mode `otf`. Pour un espace neuf, **aucune commune n'est posée seule** : l'étape propose, la personne choisit.
- Proposition de départ : le point `placeLngLat` du lieu de production (API « Système de production », portée `general`), avec la carte des parcelles de la ferme. **[NON VÉRIFIÉ]** : que le champ soit rempli sur de vraies fermes ; sans lui, la carte part des parcelles lues (`/plotList`), puis d'une recherche de commune. Le siège n'est qu'un **dernier recours, dit comme tel** (« Siège de la structure : peut être loin de vos champs »).
- La commune est choisie parmi les candidats du géocodage restreint à la France (déjà là, `countryCode=FR`). Un lieu hors France métropolitaine : message « hors du pilote », rien d'enregistré.
- Tant que l'étape n'est pas confirmée : pas de météo ni de gel ni d'ET0 pour cet espace, **la page le dit** (« Choisissez la commune de votre ferme »).
- Le lieu enregistré garde sa **provenance** : `lieu de production d'OTF`, `choisi sur la carte`, `siège (dernier recours)`.
- [À FAIRE] Lire la façon dont `water-dashboard.ts` (l. 136 et 291) et `location.ts` consomment le mode `otf`, puis le remplacer par une préférence **confirmée** ; l'ancien mode `otf` d'un espace existant est conservé (F426).
- [À FAIRE, non vérifié] Clé météo : communale à toutes les fermes ou par ferme, coût non relevé (section 8 du contrat). **Aucun fournisseur payant n'est introduit par la 4.4** ; s'il en fallait un, la question serait **[BUDGET]**, posée seule.

##### F420 · Parcelles et abris (n° 21)

- `mapPlotMode` classe une parcelle en abri par son **nom** (`abri|cover|greenhouse|shelter|tunnel`) : « serre » et « châssis » n'y sont pas. Une ferme qui écrit « serre » compte la pluie et prend K_abri = 1 **sans alerte**.
- La 4.4 garde la liste de mots **pour proposer** (et y ajoute « serre », « châssis », « chassis », « multichapelle », « tunnel » reste), mais **le classement n'est plus déduit en silence** : l'étape montre chaque parcelle avec sa proposition (« Abri ? oui / non / je ne sais pas ») et la personne valide. Une parcelle non validée est **« à classer »** : son besoin en eau n'est pas calculé (raison affichée dans « Non calculable », N1).
- Le classement validé est enregistré par espace (provenance : `nom de la parcelle` ou `confirmé`), pas recalculé à chaque lecture d'OTF.
- [À FAIRE] Vérifier si un classement abri/plein champ est déjà enregistrable dans le module ou n'existe que dans `mapPlotMode` ; dans ce second cas, c'est la principale migration de la 4.4.

##### F421 · Sol (n° 4 ; réponses Q3, Q4)

- `SOIL_DEFAULTS` (part de référence 2/3, TEW 14 mm, REW 7 mm, Ze 10 cm, « limon sableux ») **ne s'applique plus seul à un espace neuf**. Sans confirmation : sol « à renseigner », réserve utile non calculable.
- **Préremplissage depuis la texture d'OTF** : `System.soil` (11 textures, API `System_0_1beta`, portée `general`, donc le droit « Structure » suffit). Un appel de plus par lecture d'accueil, compté (F361). **[NON VÉRIFIÉ]** : le champ peut être vide ; le texte exact des 11 textures n'a pas été relu ici. Sans texture : choix dans la liste des textures de la table FAO-56.
- **TEW et REW par texture : table FAO-56, tableau 19**, avec sa source affichée (« FAO-56, tableau 19 »), les valeurs **ajustables** par parcelle (le système de révisions datées de `soil.ts` est déjà là). Le tableau 19 donne des **fourchettes** par classe de texture (9 classes) : les valeurs retenues dans le code, et la correspondance des **11 textures d'OTF** vers ces classes, sont des choix agronomiques réservés (). Le contrat ne les écrit pas.
- La texture d'OTF est **une proposition à confirmer**, jamais posée seule. La ferme peut choisir une autre texture ou saisir ses propres TEW/REW.
- Le **plafond de sol** (`soilDepthCeilingM`) d'un espace neuf est `null` (aucun) ; voir F423.
- Part de référence 2/3 et Ze 10 cm : propositions sourcées (CRIIAM / FAO), dites « proposé, à ajuster » (réponse Q11).

##### F422 · Catalogue de cultures (n° 13 ; réponse Q6)

- Le jeu commun (19 cultures CRIIAM Sud + 13 FAO-56) porte une **région d'origine** par ligne, **affichée** sur la fiche de la culture (« Dates de stade de la région Sud / Occitanie, validées par François le 31/10/2026 »). Quand la région de la ferme (déduite de la commune confirmée, F419 : département → région, table fixe de 13 régions métropolitaines) diffère, un **avertissement** s'affiche sur les cultures concernées (« Ces dates viennent d'une autre région : vérifiez-les »). Les 13 cultures FAO-56 sont « générales » : pas d'avertissement.
- L'ajustement se fait **sur la copie de la ferme** (déjà prévue au contrat) ; le jeu commun n'est jamais modifié par une ferme.
- **Région des conduites « validées par le porteur »** (dates de levée, calendriers) : « ferme du porteur, Auvergne-Rhône-Alpes » (F428, réponse 3).
- [NON VÉRIFIÉ] : le contenu ligne à ligne du jeu commun ; la colonne « région » existe-t-elle déjà en base ? sinon une colonne additive.

##### F423 · Espèces, rattachements, racines (n° 5, 14, 15 ; réponses Q7, Q9)

- **Rattachement des espèces** : étape « Rattachez vos espèces » partant de la proposition par nom (`species-linking.ts`, déjà là). Ce qui n'est pas rattaché reste « inconnu, à renseigner », visible partout (D-003).
- **Modèle copiable des 78 rattachements de François** (réponse Q9) : **liens espèce-culture seulement**, jamais d'identifiants d'OTF de sa ferme, jamais ses données de ferme. Les espèces d'OTF n'ont pas les mêmes identifiants d'une ferme à l'autre : le modèle est donc une liste **nom d'espèce normalisé → culture de référence**, proposée à la copie (« Copier ce modèle » : la personne voit chaque lien, en retire, en ajoute). Il est livré comme **un fichier de données du dépôt** (pas dans une migration, règle n° 16), produit par une extraction relue de sa base. **L'extraction lit la ferme réelle et le fichier va dans un dépôt public : accord donné par le porteur le 19 novembre 2026, sous réserve de sa relecture de la liste avant tout dépôt (F428, réponse 4).**
- **Racines** : profils communs marqués **« estimation »** (réponse Q7) ; profondeur 0,30 m et p = 0,5 proposés à une culture sans profil seulement comme « à vérifier ». Le **plafond de 0,60 m de l'asperge reste à la ferme de François** : un espace neuf **n'hérite d'aucun plafond** du jeu commun et part de la FAO ; il règle lui-même son plafond de parcelle. Test de non-héritage (section 6). [À FAIRE] Lire `0025_soil_reserve.sql` (l. 270-310) : si le plafond est dans le jeu commun lui-même, le sortir.

##### F424 · Réglages à relire (n° 1, 2, 3, 6, 7, 9, 10, 11, 12, 22 ; réponses Q5, Q8, Q10, Q11)

Une étape **« Réglages à relire »**, un seul écran, qui montre chaque valeur de départ **avec sa source** et le mot **« proposé, à ajuster »** :

| Groupe | Valeurs proposées (celles du code) | Source affichée |
| --- | --- | --- |
| Abris | K_abri 0,8 (réglable 0,6 à 1), **à confirmer par abri** (réponse Q5) | CRIIAM, tunnel |
| Calcul | paillage plastique Kc × 0,9 ; borne ET0 portée à 15 mm/j | choix du porteur ; borne de sécurité |
| Sol et surface | bâche perméable 0,1 ; paillage 0,5 ; engrais verts 0,3 / 0,6 / 1 ; herbe 0,6 ; seuil de la ferme 50 % (20 à 80) | choix du porteur |
| Gel | marges 3 °C (sensible) et 2 °C (rustique) ; curseur de microclimat à 0 ; seuils par culture « choix prudent » avec leur source (FRAB AuRA / ITAB) | retour du porteur ; **gardés en commun, mention « choix prudent »** (réponse Q8) |
| Alertes | aspersion 24 °C / 400 W/m² / 3 jours ; modèles gel < 3 °C, chaleur > 33 °C, pluie > 15 mm, « indicatifs » | choix du porteur |
| Planning | aspersion 21 h–8 h, goutte-à-goutte 6 h–22 h ; doses 5-15 mm et 3-10 mm ; pluie prévue à 100 % ; attente si > 5 mm ; pénurie « priorité puis part égale » ; goutte-à-goutte préféré ; part de commande 0,5 ; retard toléré 30 min | décisions du 29/09/2026 (D-024) |

La personne **valide, ajuste ou passe** chaque groupe. Validé = enregistré comme réglage de la ferme avec sa provenance. **Aucun planning n'est calculé avant validation du groupe « Planning »** (réponse Q10) ; les autres groupes non validés restent des propositions affichées comme telles dans « d'où vient ce chiffre ».

**Borne de l'ET0 : 12 → 15 mm/j** (n° 3, réponse Q11) : changement de constante dans `etm.ts`, qui vaut pour **toutes les fermes, la ferme de François comprise**. Il n'a d'effet que sur les jours où l'ET0 dépasse 12 mm. À tester (cas à 11,9 / 12,1 / 14,9 / 15,1) et à consigner au journal des changements. **[NON VÉRIFIÉ]** : si le contrat commun des deux moteurs (MC-17 à MC-27, banc commun) fixe aussi cette borne ; si oui, la 4.4 le signale au dépôt commun au lieu de le changer seule.

##### F425 · Fermes exclues, dites avant toute saisie (T4-16)

Reprend F353 : AMAP et fermes sans l'abonnement qui ouvre l'API sont **refusées à l'étape 1** avec le message déjà écrit, **avant** que la personne ne saisisse quoi que ce soit dans l'accueil. Aucun écran de l'accueil n'est atteignable sans raccordement « relié » (sinon : renvoi à l'étape 1). Une ferme dont la lecture est refusée en route (« reconnexion demandée », « lecture refusée ») garde son accueil mais le module dit pourquoi les chiffres ne bougent plus.

##### F426 · L'espace existant de François

Un espace qui existe **avant la 4.4** est marqué « accueil fait avant la 4.4 », toutes étapes `confirmé`, **valeurs inchangées** (commune en mode siège, classement abri par nom, sol limon sableux, réglages courants). L'écran de vérification les montre avec leur provenance réelle (« siège OTF, réglage d'avant l'accueil »). Il peut refaire l'accueil à la main depuis Réglages si François le veut (ce n'est pas obligatoire). La migration pose ce marquage sans changer une valeur ; son essai se fait **sur une copie** de la base (comme #88). **Toute action sur la ferme réelle qui irait au-delà (par exemple corriger sa commune) attend son « vas-y ».**

##### F427 · Vérification finale

Un écran liste, par étape, vert (confirmé), orange (passé : conséquence dite en une phrase) ou rouge (manquant). Il liste aussi ce qui reste **inconnu** (espèces non rattachées, parcelles à classer, sol non confirmé), avec le lien vers l'étape. Il montre, par groupe, **ce qui a été proposé et ce qui a été confirmé**. Il ne bloque rien d'autre que le premier planning (F424).

#### 8 bis.5 · Découpage en PR (une à la fois, chacune après le déploiement vérifié de la précédente)

| PR | Contenu | Dépend d'OTF réel ? |
| --- | --- | --- |
| 1 | F417 (état, migration), parcours vide reprenable, marquage de l'espace existant (F426), bandeau « À finir », bascule des défauts en « à renseigner » pour un espace neuf | non |
| 2 | F419 lieu + F420 abris | un peu : `placeLngLat` (nouvel appel, contrat de route) ; essai sur « Ferme v2 » n° 4394 |
| 3 | F421 sol (table FAO-56, texture OTF) | oui pour la texture (même appel que PR 2) |
| 4 | F422 catalogue + F423 rattachements, racines, modèle des 78 | non, sauf l'extraction (F428, réponse 4) |
| 5 | F424 réglages à relire + borne ET0 + F418 plusieurs fermes + F427 vérification | non |

Les PR 1, 4 et 5 se codent **sans l'accès d'OTF** ; les PR 2 et 3 s'essaient sur la fausse ferme dès que l'accès est donné (formulaire en attente depuis le 18/11), et se testent avant avec les réponses d'OTF enregistrées (les tests de contrat de la 4.3 PR 5 en fournissent le moule). Chaque PR : contrôles de AGENTS.md collés, registres dans la même PR, sabotages notés (convention de #96).

#### 8 bis.6 · Preuves de fin

1. **Test « ferme neuve »** : un espace créé vide ne reçoit **aucune** des valeurs suivantes comme valeur en place, dans aucune lecture du module : commune du siège ; TEW 14 / REW 7 / « limon sableux » ; K_abri sans confirmation ; classement abri déduit du nom ; plafond de sol de l'asperge ; réglages de planning ; liens espèce-culture. Le test **échoue si l'on remet l'ancien défaut** (sabotage de chaque défaut n° 1, 4, 13, 14, 19, 21, 22).
2. **Tests des étapes** : reprise après coupure (étape à moitié faite) ; une étape « passée » est dite à la vérification ; aucun planning avant validation du groupe « Planning » ; hors France métropolitaine refusé sans rien enregistrer.
3. **Isolation** : l'état de l'accueil, le classement, les réglages validés et les liens copiés d'une ferme ne sont jamais lus par une autre ; passage « fermes » et « personnes » de `tests/db`, contrôle de cohérence des espaces ; deux fermes de la même personne (F418).
4. **Non-régression de l'espace existant** : mêmes chiffres avant et après la migration, sur copie (jeu de la ferme fictive de la démonstration et un jeu « ferme complète »).
5. **Contrats de route** : l'appel `System` (texture, lieu) entre dans les tests de contrat de la 4.3 PR 5 ; compté dans le budget du jour ; jamais plus de 4 requêtes par seconde.
6. **Essai réel** (preuve de la section 13 du contrat pour 4.4) : un parcours complet sur une ferme neuve (« Ferme v2 » n° 4394, lecture seule), aux deux largeurs ; **recette dans le Chrome de François, avec son accord à chaque fois** ; la ferme exclue dite avant toute saisie. Tant que l'accès d'OTF manque : **« non vérifié en réel »**, dit comme tel.
7. Le texte de la politique de confidentialité reste exact (nouveaux appels à OTF : texture, lieu) : relecture du passage concerné avant la mise en ligne de la PR 2.

#### 8 bis.7 · Risques

| Risque | Gravité | Réponse |
| --- | --- | --- |
| Une valeur de François reste un défaut silencieux (oubli d'un site de lecture) | grave, discret | test « ferme neuve » par sabotage, relecture des 7 défauts de l'inventaire ; revue d'un second fil si possible |
| Le marquage de l'espace existant change un chiffre de François | grave | migration sur copie, test de non-régression, rien de plus sans « vas-y » |
| `System.soil` ou `placeLngLat` vides ou inattendus | moyen | « à renseigner » ; aucune valeur inventée ; essai sur « Ferme v2 » |
| La borne ET0 à 15 change le banc commun | moyen | vérifier le contrat commun avant de changer ; sinon le dire au dépôt commun |
| Le parcours est trop long et décourage | moyen | reprise, « passer » dit, une seule étape obligatoire (réglages de planning, avant le premier planning) |
| Choisir la mauvaise commune (même nom de commune) | moyen | carte et code postal ; provenance affichée |
| Le modèle des 78 liens fuit des données de ferme | moyen | liens espèce-culture seulement, relus par François avant tout dépôt |
| Deux fermes d'une même personne mélangées (F418) | très grave | ferme active choisie par le serveur ; tests à deux fermes |

#### 8 bis.8 · Ce qui n'est pas établi

- Le contenu des 11 textures d'OTF et la correspondance avec la FAO (non lu) ; que `soil` et `placeLngLat` soient remplis sur de vraies fermes.
- Si un classement abri/plein champ est déjà enregistrable dans le module.
- Si la colonne « région d'origine » du jeu commun existe en base.
- Si la borne d'ET0 est aussi fixée par le contrat commun.
- Le comportement réel du parcours sur une ferme tierce : aucun essai avant l'accès d'OTF et le pilote.
- Tout avis juridique (inchangé : la relecture de la confidentialité reste due avant toute ferme tierce).

##### F428 · Les quatre réponses du porteur, le 19 novembre 2026

1. **TEW et REW** : le **milieu** de la fourchette du tableau 19 de la FAO-56 pour chaque texture, arrondi au demi-millimètre, la fourchette entière affichée à côté, ajustable par parcelle. Les valeurs sont lues de la source au début du code et montrées au porteur à la relecture de la PR.
2. **Textures d'OTF** : correspondance directe quand le nom est le même, sinon la classe voisine la plus fine, avec la mention « proche de ». La liste des onze textures est relue dans le code d'OTF avant d'être montrée.
3. **Région des conduites validées le 31 octobre 2026** : « ferme du porteur, Auvergne-Rhône-Alpes » ; « Sud / Occitanie » pour les 19 cultures du CRIIAM ; « général » pour les 13 de la FAO-56. Aucune commune dans le dépôt public.
4. **Modèle des 78 liens espèce-culture** : oui, après relecture de la liste par le porteur ; l'extraction lit la ferme réelle (accord donné) et le fichier est publié dans le dépôt public (liens seulement).


#### 8 bis.9 · Précisions du code de la PR 1 (20 novembre 2026, D-222, F581)

Écrites avec le code de la PR 1, le 20 novembre 2026, en Opus 5.5 · Élevé (ligne 4.4 de la roadmap), sur le « vas-y » du porteur du même jour (7 h 52), sans accès d'OTF.

##### F581 · L'état de l'accueil et le marquage de l'espace existant, sans bascule ni bandeau

- **La table** `irrigation_onboarding_steps` (migration 0034) : une ligne par espace et par étape que la personne confirme, les étapes 2 à 6 du parcours (`location` où est la ferme, `plots` parcelles et abris, `soil` sol, `crops` cultures, `settings` réglages à relire) ; son état (`todo`, `proposed`, `confirmed`, `skipped`), son origine (`onboarding`, ou `before-onboarding` pour un réglage d'avant l'accueil), la date de la confirmation (présente si et seulement si l'étape est confirmée) et la valeur proposée gardée (JSON). Les étapes 0 (fonctionnalités) et 1 (ferme reliée) gardent leur propre état (choix de la 3.8, raccordement de la 4.3) ; l'étape 7 (vérification) est un écran, pas un état. **Une étape sans ligne est « à faire »** : un espace créé après la migration commence l'accueil, et rien n'y est confirmé à sa place. Un espace n'est « d'avant l'accueil » que si ses cinq étapes le sont : une ligne qui manque le remet dans l'accueil, plutôt que de tenir pour confirmé ce qui ne l'a pas été.
- **Le numéro** : 0034, et non le numéro suivant, comme F417 le laissait entendre : les migrations se suivent sans trou (`tests/irrigation-migration.test.ts`) ; la 4.3, PR 3 prendra le numéro libre au moment de son code.
- **Le marquage** (F426) : la migration donne à chaque espace qui existe ses cinq étapes « confirmées », d'origine `before-onboarding`, sans identifiant de ferme ni de personne, et ne touche aucune autre table. Essai sur une copie : une base arrêtée à la 0033, remplie d'une ferme de la démonstration préparée par les dépôts ordinaires et d'un espace rattaché à sa ferme ; après la 0034, chaque ligne de chaque autre table est identique (`tests/db/onboarding-migration.test.ts`). La base locale des parcours navigateur marque de même sa ferme habituelle.
- **La démonstration** n'a pas d'accueil : ses fermes fictives sont déjà réglées, et aucune visite nouvelle n'est prévue (section 8).
- **L'écran** : une section repliée « Accueil de la ferme », en bas de Réglages. Chaque étape, son état dit en couleur et en mots (vert « Confirmé », orange « Passé » avec sa conséquence en une phrase, rouge « À faire » ou « Proposé, à confirmer »), et, pour l'espace existant, « Réglage d'avant l'accueil, gardé tel quel. » Rien ne s'y règle encore.
- **Ce qui passe aux PR suivantes, et pourquoi.** La bascule de chaque défaut en « à renseigner » et le bandeau « À finir » arrivent avec l'écran de l'étape qui permet de les remplir : PR 2, la commune (fin du repli sur le siège) et le classement des abris avec K_abri ; PR 3, le sol ; PR 4, le catalogue et les racines ; PR 5, les réglages à relire, et aucun planning avant la validation du groupe « Planning ». Une bascule sans son écran laisserait une ferme neuve devant un « à renseigner » qu'elle ne peut pas remplir, et un bandeau nommerait une étape qu'elle ne peut pas faire : deux messages trompeurs, que la section 8 bis.3 exclut. Aucune ferme neuve n'existe en production avant le pilote (F366 : Access n'admet que des personnes de la ferme du porteur). Le test « ferme neuve » (preuve 1 de la section 8 bis.6) grandit ainsi PR par PR, chaque défaut avec son sabotage.

#### 8 bis.10 · Précisions du code de la PR 2a (20 novembre 2026, D-223, F582)

Écrites avec le code, le 20 novembre 2026, en Opus 5.5 · Élevé, sans accès d'OTF.

##### F582 · Où est la ferme : la commune choisie, jamais le siège en silence ; la PR 2 en trois

- **La PR 2 en trois PR, une à la fois.** 2a : la commune (F419), sans nouvel appel à OTF ; 2b : parcelles et abris (F420) ; 2c : la proposition de départ par `placeLngLat` (nouvel appel `System`, contrat de route, relecture du texte de confidentialité, preuve 7), quand l'accès d'OTF est là. Une PR plus petite se relit et se recette mieux ; 2a et 2b se codent et se testent sans OTF.
- **Le garde.** `weatherLocationQuery` (`lib/domain/weather/location.ts`) ne rend une commune que si elle est **confirmée** ; chaque lecture du lieu de la météo passe par `readWeatherPreference` (`lib/services/weather-preference.ts`), qui joint la préférence enregistrée à l'état de l'accueil : confirmée pour un espace d'avant l'accueil (F426, sa préférence gardée telle quelle, y compris le mode `otf`), pour la démonstration, et pour un espace dont l'étape « Où est la ferme » est confirmée. Sinon : aucune clé de lieu, aucun géocodage, aucun appel météo, ni gel, ni ET0 ; la page le dit : « Choisissez la commune de votre ferme : tant qu'elle n'est pas choisie, ni météo, ni gel, ni ET0. » La synchronisation automatique ne lit que les espaces géocodés, ce qu'un espace sans commune confirmée n'est jamais : elle n'a pas besoin d'un garde de plus.
- **Choisir confirme.** Enregistrer une commune dans Réglages (recherche, puis choix d'un candidat) ou prendre le siège confirme l'étape dans le **même lot** d'écriture que la préférence (`db.batch`) : l'une ne va jamais sans l'autre. La valeur confirmée est gardée avec sa provenance (`custom` : « commune choisie » ; `otf` : « siège de la structure dans Ouvre ta ferme, pris en dernier recours ») et se lit dans l'accueil : « Confirmé le 20 novembre 2026 : Tronget (03240), commune choisie. » Une étape d'avant l'accueil n'est jamais réécrite : un espace d'avant l'accueil qui change sa commune dans Réglages la garde enregistrée et reste d'avant l'accueil (F426), sans quoi ses jardins redeviendraient « à classer » (test de `tests/db/onboarding-location.test.ts`, sabotage noté).
- **Le siège, en dernier recours, d'un geste.** Le bouton « Prendre le siège OTF, en dernier recours » paraît tant que la commune n'est pas confirmée ; une ferme d'avant l'accueil garde son ancien bouton « Utiliser la commune du siège OTF ». Rien n'est pris sans ce geste.
- **Hors du pilote.** Une commune hors de France métropolitaine (pays autre que la France, ou code postal en 97 ou 98) est refusée, choisie ou prise au siège : « Cette commune est hors du pilote, qui ne couvre que la France métropolitaine : rien n'est enregistré. » La Corse (20) est dans le pilote. Un siège sans pays lu est tenu pour français (OTF est français) ; son code postal reste vérifié.
- **Le bandeau « À finir ».** Sur chaque page du module, sous le titre : « À finir : commune de la ferme. », le lien menant au lieu de la météo dans Réglages ; seulement quand une case cochée lit la météo, et seulement pour une étape que la personne peut faire. Il ne se ferme pas : il part quand l'étape est confirmée. Une étape passée n'est pas rappelée (elle est dite à la vérification, F427). Dans l'accueil replié de Réglages, l'étape « Où est la ferme » à faire porte le lien « Choisir la commune ». Les PR suivantes y ajoutent leur étape, chacune avec son écran (F581).
- **Ce que la PR ne fait pas.** Pas de carte ni de proposition par `placeLngLat` (2c) ; pas d'appel nouveau à OTF ; le texte de la politique de confidentialité ne change pas. Pas de valeur agronomique ; aucune question de budget.
- **Preuves.** Test « ferme neuve », défaut n° 19 : un espace créé vide n'a ni clé de lieu, ni libellé de siège, ni appel au fournisseur météo (`tests/db/onboarding-location.test.ts`) ; reprise : en changer de commune garde la dernière ; isolation : la commune d'Alice ne confirme rien pour Bob, aux trois passages ; un espace d'avant l'accueil garde sa clé `otf:…` ; la démonstration n'a ni accueil ni bandeau ; outre-mer et étranger refusés (`tests/weather-domain.test.ts`). Les tests dont l'espace lit la météo confirment la commune comme le ferait la personne (`tests/support/onboarding.ts`). Cinq sabotages, chacun détecté : garde retiré, confirmation retirée du lot, bandeau sans condition de case, outre-mer accepté, message du siège rendu muet. Parcours : P46 étendu (le lien de l'étape, le siège pris, l'étape confirmée et le bandeau parti), P29 et P33 choisissent la commune de leur ferme neuve par le bandeau, P29 vérifie le bandeau.


#### 8 bis.11 · Précisions du code de la PR 2b (20 novembre 2026, D-224, F583)

Écrites avec le code, le 20 novembre 2026, en Opus 5.5 · Élevé, sans accès d'OTF.

##### F583 · Parcelles et abris : chaque jardin classé par la personne, « à classer » sinon

- **Ce que le code montrait** (le [À FAIRE] de F420). Le classement n'existait que dans la lecture d'OTF, `mapPlotMode` (`lib/domain/otf/mapper.ts`) ; et cette lecture ne prend **pas** le nom du jardin, contrairement à ce que F420 supposait : elle lit le champ `mode` (ou `type`) de `/plotList`, une **énumération** d'OTF (`greenhouse`, `open-field` dans les réponses enregistrées des tests de route), la liste de mots ne servant qu'à reconnaître ces valeurs. Une ferme qui nomme « Serre » un jardin déclaré plein champ dans OTF était donc classée plein champ, sans alerte. La PR 2b est bien la principale migration de la 4.4.
- **La table** `irrigation_plot_shelters` (migration additive 0035) : une ligne par espace et par jardin (`otf_plot_id`, l'identifiant d'OTF comme partout), abri ou non, la proposition faite (pour dire « proposition confirmée » ou « proposition corrigée ») et la date. Un espace d'avant l'accueil n'y a aucune ligne et garde le classement lu d'OTF (F426) ; la migration n'écrit rien. La 4.3, PR 3 prendra le numéro libre suivant.
- **Le plan classé par espace.** `getIrrigationSnapshot` rend le plan lu d'OTF (rangé tel quel dans le cache, commun à la ferme), puis y pose le classement de l'espace (`applyPlotShelters`) : pour un espace qui fait l'accueil, un jardin confirmé prend le classement de la personne, un jardin sans ligne devient **« à classer »** (`unclassified`, troisième valeur du type des jardins) et porte sa proposition. Toute lecture du plan (pages, calcul du matin, actions) passe par là. Un espace d'avant l'accueil et la démonstration reçoivent le plan tel quel.
- **La proposition.** Le type du jardin dans OTF d'abord (`greenhouse` : abri) ; sinon un mot de son nom : `abri`, `serre`, `tunnel`, `châssis`, `chassis`, `multichapelle`, `cover`, `greenhouse`, `shelter`. Une proposition n'est jamais prise pour un classement.
- **Ce que « à classer » fait aux calculs.** Le besoin d'une planche d'un jardin à classer n'est pas calculé : « Non calculable : jardin à classer, abri ou plein champ, dans Réglages. » (raison `unclassified-plot`, ni zéro d'abri ni pluie de plein champ) ; le besoin par culture ne propose rien pour elle et l'ETM du matin ne l'enregistre pas ; sa réserve du sol n'est pas calculée ; la pluie reçue par une série ou dans l'historique, sur une surface qui en contient, est inconnue. Les alertes par culture tiennent un jardin à classer pour non abrité : le gel est signalé (le plus prudent), l'aspersion sous abri ne l'est pas. « Aujourd'hui » compte la pluie comme possible. Le plan l'affiche « À classer ».
- **L'écran.** Dans Réglages, une section « Parcelles et abris », pour une ferme qui fait l'accueil seulement : chaque jardin de la saison, sa zone, « Proposé : abri » ou « plein champ », et trois réponses, « Abri », « Plein champ », « Je ne sais pas » (le jardin reste ou redevient à classer), chacune enregistrée aussitôt avec sa réponse sous le jardin ; puis « Confirmer les propositions restantes », un geste pour les jardins qui restent, après les avoir lus. L'étape « Parcelles et abris » est confirmée dans le même lot que le dernier jardin classé, avec le compte (« Confirmé le … : 2 abris, 2 jardins de plein champ. »), et rouverte si un jardin redevient à classer. L'accueil replié porte « Classer les jardins ».
- **Le bandeau.** « À finir : … 4 jardins à classer. », quand une case calcule un besoin (`besoins`, `planning`, `sol`, `cultures`, `alertes-cultures`) ; le compte suit le plan de la saison, si bien qu'un jardin ajouté dans OTF après coup est à classer à son tour.
- **Ce que la PR ne fait pas.** K_abri : sa valeur et sa provenance restent celles des réglages du besoin par culture (« Réglages du calcul ») ; la PR ne change aucune valeur agronomique. Aucun appel nouveau à OTF. Aucune question de budget.
- **Preuves.** Test « ferme neuve », défaut n° 21 : chaque jardin d'un espace neuf est à classer, le tunnel d'OTF compris (`tests/db/plot-shelters.test.ts`) ; l'espace d'avant l'accueil garde le classement d'OTF sans une ligne ; reprise d'une étape à moitié faite ; « je ne sais pas » rouvre l'étape ; isolation Alice et Bob, aux trois passages ; besoin, réserve du sol et besoin par culture non calculés pour un jardin à classer (`tests/irrigation-needs.test.ts`, `tests/db/soil-reserve-view.test.ts`, `tests/db/crop-water-bed-sheet.test.ts`) ; la migration 0034 laisse la 0035 vide. Sept sabotages, chacun détecté. Parcours : P46 étendu (une réponse corrigée, les autres confirmées d'un geste, l'étape confirmée avec son compte) ; P28, P29, P31, P31b et P33 préparent leur ferme neuve (commune et jardins) par le bandeau.


#### 8 bis.12 · Précisions du code de la PR 3 (20 novembre 2026, D-225, F584)

Écrites avec le code, le 20 novembre 2026, en Opus 5.5 · Élevé, sans accès d'OTF.

##### F584 · Le sol : la texture choisie propose TEW et REW, jamais le limon sableux en silence

- **Ce que le code montrait** (défaut n° 4). `SOIL_DEFAULTS` (part de référence 2/3, TEW 14 mm, REW 7 mm, Ze 10 cm) ne sert qu'à **préremplir** le formulaire du sol d'une parcelle qui n'en a pas (`fieldsOf`, `app/irrigation/soil-reserve/soil-settings.tsx`) ; aucun calcul ne le lit seul : sans saisie, la réserve d'une parcelle est déjà inconnue (D-003), et l'écran le dit. Le défaut silencieux est donc celui du formulaire : une ferme neuve qui saisissait sa RFU enregistrait, sans le voir, l'eau évaporable d'un limon sableux. À noter pour le porteur : TEW 14 / REW 7 ne sont pas le milieu du limon sableux du tableau 19 (17,5 / 8), plutôt d'un sable limoneux ; sa ferme les garde (F426).
- **La PR 3 en deux.** 3a (celle-ci) : la liste des textures de la FAO-56 et l'étape « Sol », sans appel à OTF ; 3b, la texture d'OTF (`System.soil`) proposée « proche de » sa classe (F428, réponse 2), à l'accès d'OTF, avec la PR 2c (même appel, même contrat de route).
- **Le tableau 19** (`lib/domain/soil-reserve/texture.ts`) : neuf classes de texture, chacune avec ses fourchettes de REW et de TEW (Ze = 0,10 m) ; TEW et REW proposés au **milieu** de la fourchette, arrondi au demi-millimètre, la fourchette entière dite à côté avec sa source : « FAO-56, tableau 19, pour Ze = 10 cm : TEW de 15 à 20 mm, REW de 6 à 10 mm ; le milieu est proposé, à ajuster. » (F428, réponse 1). **Source** : FAO-56, chapitre 7, tableau 19 (https://www.fao.org/4/x0490e/x0490e0c.htm), relu le 20 novembre 2026 par deux lectures séparées de la page, qui donnent les mêmes fourchettes, et recoupé par les exemples 31 (terre franche : TEW ≈ 20 mm, REW ≈ 9 mm) et 35 (limon sableux : REW ≈ 8 mm) du même chapitre. Le porteur a confié cette relecture au module (19 novembre 2026 : « relis-le toi-même et publie directement »). Les noms français sont du module (« Terre franche » pour *loam*, « Limon » pour *silt loam*…), la classe de la FAO toujours écrite entre parenthèses pour qu'aucune traduction ne trompe.

  | Texture | REW (mm) | TEW (mm) | Proposé (TEW / REW) |
  | --- | --- | --- | --- |
  | Sable (sand) | 2 à 7 | 6 à 12 | 9 / 4,5 |
  | Sable limoneux (loamy sand) | 4 à 8 | 9 à 14 | 11,5 / 6 |
  | Limon sableux (sandy loam) | 6 à 10 | 15 à 20 | 17,5 / 8 |
  | Terre franche (loam) | 8 à 10 | 16 à 22 | 19 / 9 |
  | Limon (silt loam) | 8 à 11 | 18 à 25 | 21,5 / 9,5 |
  | Limon pur (silt) | 8 à 11 | 22 à 26 | 24 / 9,5 |
  | Limon argileux (silty clay loam) | 8 à 11 | 22 à 27 | 24,5 / 9,5 |
  | Argile limoneuse (silty clay) | 8 à 12 | 22 à 28 | 25 / 10 |
  | Argile (clay) | 8 à 12 | 22 à 29 | 25,5 / 10 |

- **Le formulaire.** Pour un espace qui fait l'accueil, une parcelle sans sol n'a **ni TEW ni REW** préremplis : le bouton d'enregistrement reste indisponible tant que la personne n'a ni choisi une texture ni tapé ses valeurs. La part de référence 2/3 (CRIIAM) et Ze 10 cm (FAO-56) restent préremplies, dites « proposées, à ajuster » (réponse Q11). Une liste « Texture du sol » paraît dans chaque formulaire du sol, pour toute ferme : choisir une texture remplit TEW et REW au milieu de leur fourchette, que la personne ajuste ; « non dite » laisse ses propres valeurs. Un espace d'avant l'accueil garde ses valeurs de départ d'avant, TEW 14 / REW 7 (F426), comme la démonstration.
- **La texture gardée** (colonne `texture` de `irrigation_soil_records`, migration additive 0036, nulle pour toute saisie d'avant) : elle dit d'où viennent TEW et REW (« texture limon sableux (sandy loam) (FAO-56, tableau 19) » dans la ligne du sol) ; aucun calcul ne la lit, qui lit TEW et REW tels qu'enregistrés. La 4.3, PR 3 prendra le numéro libre suivant.
- **L'étape « Sol ».** Confirmée dans le même lot que la saisie qui donne son sol à la **dernière parcelle** de la saison qui n'en avait pas (la valeur propre d'un jardin ne fait pas le sol de sa parcelle), avec leur nombre : « Confirmé le … : sol de 3 parcelles saisi. ». Une saisie n'étant jamais effacée (D-006), l'étape ne se rouvre pas ; une parcelle apparue dans OTF après coup est nommée par le bandeau, comme un jardin à classer. Une étape d'avant l'accueil n'est jamais réécrite (F426, même garde que F582).
- **Le bandeau.** « À finir : … sol de 3 parcelles. », quand la réserve du sol est cochée (`sol`), pour un espace qui fait l'accueil ; le lien mène à la page « Réserve du sol », sur la première parcelle sans sol, réglages du sol et formulaire ouverts. L'accueil replié de Réglages porte « Saisir le sol », vers le même endroit. Le sol des parcelles n'est lu, pour le bandeau, que pour un espace qui fait l'accueil.
- **Ce que la PR ne fait pas.** Aucune RFU proposée par texture (la RFU reste saisie, d'une analyse ou d'une estimation) ; Ze n'est pas relié à TEW (le tableau vaut pour Ze = 10 cm, la phrase le dit) ; le plafond de sol d'un espace neuf reste vide, comme avant ; aucun appel nouveau à OTF ; aucune question de budget.
- **Preuves.** Test « ferme neuve », défaut n° 4 : un espace neuf n'a ni TEW ni REW de départ, le bandeau nomme le sol de ses parcelles (`tests/db/onboarding-soil.test.ts`) ; les neuf milieux du tableau ; l'espace d'avant l'accueil et la démonstration gardent TEW 14 / REW 7 ; l'étape confirmée par le sol de la dernière parcelle, pas par la valeur d'un jardin ; la texture gardée et relue ; une texture inconnue refusée ; un espace d'avant l'accueil qui saisit un sol le reste ; isolation Alice et Bob, aux trois passages. Quatre sabotages, chacun détecté. Parcours : P46 étendu (l'étape « Saisir le sol », TEW et REW vides, la texture qui les propose, l'étape confirmée) ; P29 garde le bandeau du sol ; P31b et P33 choisissent une texture pour saisir leur sol.

#### 8 bis.13 · Précisions du code de la PR 4a (20 novembre 2026, D-226, F585)

Écrites avec le code, le 20 novembre 2026, en Opus 5.5 · Élevé, sans accès d'OTF.

##### F585 · Les racines d'une ferme neuve : la FAO, pas le plafond du porteur

- **La PR 4 en trois, une à la fois.** 4a (celle-ci) : les racines (F423, défaut n° 14) ; 4b : la région d'origine des cultures et son avertissement (F422) ; 4c : l'étape « Rattachez vos espèces » et le modèle copiable des 78 liens (F423, F428 réponse 4), dont l'extraction lit la ferme réelle.
- **Ce que le code montrait** (le [À FAIRE] de F423). Le plafond de 0,60 m est **dans le jeu commun lui-même** (migration 0025) : pour l'asperge (« Maximum : plafond du porteur, 0,60 m (D-056) », FAO 1,2-1,8 m non retenue) et aussi pour le **melon** (même plafond, FAO 0,8-1,5 m non retenue). Le jeu commun ne se modifie pas en place (une ligne par culture, ni mise à jour ni effacement).
- **La correction se pose à la lecture**, pour un espace qui fait l'accueil seulement (`rootingProfilesForSpace`, `lib/domain/onboarding/rooting.ts`), là où les services lisent les profils (réserve du sol, « Besoin par culture ») : le profil commun de l'asperge et du melon prend la borne basse de la fourchette de la FAO-56 (tableau 22), comme les autres profils construits sur la FAO (D-056) : asperge 1,20 m à tous les stades (culture installée) ; melon 0,30 m, 0,55 m, puis 0,80 m aux stades 3 et 4. p ne change pas (tableau 22). La source le dit, la note dit « Estimation » et que le plafond de 0,60 m est celui de la ferme du porteur. Ses dates restent celles du jeu commun : une révision de la ferme le remplace toujours.
- **Inchangé** : la base (aucune migration) ; la ferme du porteur (espace d'avant l'accueil) et la démonstration lisent le jeu commun tel quel (F426) ; la tomate à 0,65 m, choisie par le porteur dans la fourchette de l'ITAB (50-80 cm), reste commune : ce n'est pas un plafond hors des sources.
- **Preuves.** `tests/db/onboarding-rooting.test.ts` : le jeu commun en base garde 0,60 m ; une ferme neuve lit 1,20 m (asperge) et 0,80 m (melon), la source et la note dites ; la vue « Besoin par culture » aussi ; la ferme d'avant l'accueil et la démonstration lisent 0,60 m ; une révision de la ferme neuve remplace la proposition et ne touche pas l'autre ferme ; aux trois passages d'isolation. Quatre sabotages, chacun détecté. Aucun parcours navigateur nouveau : l'écran ne change pas.

#### 8 bis.14 · Précisions du code de la PR 4b (20 novembre 2026, D-227, F586)

Écrites avec le code, le 20 novembre 2026, en Opus 5.5 · Élevé, sans accès d'OTF.

##### F586 · La région d'origine des cultures et l'avertissement d'une autre région

- **Le [NON VÉRIFIÉ] de F422** : le jeu commun n'a pas de colonne « région ». Il n'en faut pas : la région d'origine se lit de la **source** de chaque culture, déjà en base (F428, réponse 3) : CRIIAM Sud → « Dates de stade de la région Sud / Occitanie (CRIIAM Sud), validées par la ferme du porteur le 31 octobre 2026. » ; FAO-56 → « Dates de stade générales (FAO-56), sans région. » ; une culture dont la ferme a ses propres durées → « Dates de stade de votre ferme. ». Aucune migration. Chaque fiche commune ajoute : « Délais de levée et calendriers du jeu commun : ceux de la ferme du porteur, Auvergne-Rhône-Alpes, validés le 31 octobre 2026. » Aucune commune dans le dépôt public.
- **La région de la ferme** (`lib/domain/onboarding/regions.ts`) : la commune confirmée (F419 ; la commune choisie, sinon le siège pris en dernier recours), les deux premiers chiffres de son code postal, puis l'une des treize régions de France métropolitaine (table fixe, découpage de 2016 ; « 20 » pour la Corse). Un code d'outre-mer ou inconnu ne donne aucune région ; sans commune confirmée, la région n'est pas connue et rien n'est affirmé.
- **L'avertissement** : « Ces dates viennent d'une autre région que la vôtre (Bretagne) : vérifiez-les. », sur chaque culture **commune du CRIIAM**, pour une ferme **qui fait l'accueil** dont la région n'est ni Provence-Alpes-Côte d'Azur ni Occitanie. Il se lit sur la fiche ouverte, hors du pli « Pour les experts », et la carte fermée dit « dates d'une autre région ». Jamais sur la FAO-56 (générale), ni sur une culture aux durées de la ferme, ni pour la ferme du porteur (espace d'avant l'accueil) ou la démonstration (F426). L'origine et les délais du porteur sont dans « Pour les experts ».
- **Preuves.** `tests/db/onboarding-regions.test.ts` : codes postaux et régions, outre-mer refusé ; une ferme neuve de Bretagne avertie sur toutes les cultures du CRIIAM et sur elles seules ; une ferme neuve du Vaucluse, aucun avertissement ; sans commune confirmée, aucun ; la ferme d'avant l'accueil et la démonstration, aucun ; la région d'une ferme ne passe pas à l'autre ; aux trois passages d'isolation. Six sabotages, chacun détecté. Parcours P46 étendu : l'asperge avertie, carte fermée et ouverte ; le brocoli de la FAO-56 non.

#### 8 bis.15 · Précisions du code de la PR 4c (20 novembre 2026, D-228, F587)

Écrites avec le code, le 20 novembre 2026, en Opus 5.5 · Élevé, sans accès d'OTF.

##### F587 · L'étape « Rattachez vos espèces »

- **La PR 4c en deux.** 4c (celle-ci) : l'étape et le mécanisme du modèle, **le modèle vide** ; 4d : la liste des liens de la ferme du porteur, extraite de sa ferme réelle et **relue par lui avant tout dépôt** (F428, réponse 4), versée dans `lib/domain/onboarding/species-model-data.ts`, fichier de données du dépôt (pas une migration).
- **L'étape**, pour un espace qui fait l'accueil seulement, en tête de la correspondance des espèces dans Réglages (ancre `#rattachez-vos-especes`) : le compteur des espèces de la saison, puis **une proposition par espèce sans aucun rattachement**, du modèle quand il connaît son nom (sans accents ni majuscules), sinon d'après le nom (`suggestReferenceCrop`, lot 3, cas 9), chacune dite « d'après le modèle d'une ferme maraîchère » ou « d'après le nom ». Le modèle ne vise qu'une culture du jeu commun utilisable ; une espèce rattachée à « sans référence » l'a été par la personne et n'est pas proposée.
- **Un geste** : chaque proposition est cochée ; la personne décoche ce qu'elle ne garde pas, puis « Rattacher les N espèces cochées ». Le serveur relit lui-même les propositions : une espèce qui n'est plus proposée refuse tout le geste, rien n'est écrit (un seul lot). Les rattachements se font par espèce, sans analogie ; les exceptions de séries ne sont pas touchées.
- **L'étape « Cultures » se confirme d'un geste** (« Confirmer l'étape « Cultures » »), quand la personne le décide : une espèce peut rester sans référence par choix. La confirmation garde le compte (« 3 espèces rattachées sur 4 »). Les espèces non rattachées restent « à rattacher », signalées partout (D-003).
- **Le bandeau « À finir »** nomme « N espèces à rattacher » (vers l'étape), quand une case cochée lit la correspondance des espèces et tant que l'étape n'est pas confirmée ; l'étape de l'accueil, dans Réglages, mène à l'étape (« Rattacher les espèces »).
- **Inchangé** : aucune migration ; la ferme du porteur (espace d'avant l'accueil) et la démonstration n'ont pas l'étape, le geste y est refusé (F426) ; la proposition une par une (« Rattacher comme… ») reste pour tous.
- **Preuves.** `tests/db/onboarding-species.test.ts` : le modèle passe avant le nom et ne vise qu'une culture commune utilisable ; une espèce déjà rattachée n'est pas proposée ; une ferme neuve reçoit ses propositions sans rien de rattaché ; les gardées se rattachent d'un geste, les décochées non ; une espèce non proposée refuse tout le geste ; un rattachement à la main n'est pas remplacé ; la confirmation garde le compte et le bandeau ne rappelle plus ; la ferme d'avant l'accueil et la démonstration sans étape ; isolation Alice et Bob, aux trois passages. Sept sabotages, chacun détecté. Parcours P46 étendu ; les parcours d'une ferme neuve confirment l'étape sans rien rattacher (`preparerLaFermeNeuve`).

#### 8 bis.16 · Précisions du code de la PR 5a (20 novembre 2026, D-229, F588)

Écrites avec le code, le 20 novembre 2026, en Opus 5.5 · Élevé, sans accès d'OTF.

##### F588 · « Réglages à relire », et aucun planning avant le groupe « Planning »

- **La PR 5 en deux.** 5a (celle-ci) : « Réglages à relire » et la garde du planning (F424, réponse Q10) ; 5b : la vérification finale (F427) et plusieurs fermes d'une même personne (F418).
- **La borne de l'ET0 ne change pas ici.** Le [NON VÉRIFIÉ] de F424 est levé : le contrat commun fixe aussi 0 ≤ ET0 ≤ 12 mm/j (`docs/contrat-moteur-partie-otf.md` du dépôt commun, MC-16, cas `cas-otf.json`). Comme F424 le prévoit, le changement est proposé au dépôt commun (PR n° 10, MC-37, 20 novembre 2026) ; le module garde 12 mm/j jusqu'à l'accord, puis change la constante dans une PR à part, avec les cas 11,9 / 12,1 / 14,9 / 15,1.
- **L'étape**, pour un espace qui fait l'accueil seulement, dans Réglages (ancre `#reglages-a-relire`) : six groupes, seulement ceux des cases cochées : Abris (K_abri), Calcul du besoin (paillage plastique, borne de l'ET0), Sol et surface, Gel, Alerte d'aspersion, Planning. Chaque ligne dit sa valeur et sa source ; **les valeurs sont lues des constantes du calcul** (`lib/domain/onboarding/settings-review.ts`), jamais recopiées à la main. Chaque groupe dit « Proposé, à ajuster », puis « Validé » ou « Passé » ; « Ajuster » mène à sa page. Les modèles d'alerte météo, « indicatifs », se lisent dans leur page : ils ne sont pas des valeurs de départ d'un calcul.
- **Valider ou passer** un groupe s'enregistre dans la ligne de l'étape (valeur JSON, aucune migration) : « proposée » tant qu'un groupe des cases cochées reste sans réponse, « confirmée » quand chacun en a une, avec le compte (« 5 groupes validés, 1 groupe passé »). Un groupe passé dit ce qu'il laisse de côté. Un groupe que les cases cochées ne montrent pas est refusé.
- **Aucun planning avant la validation du groupe « Planning »** (réponse Q10) : le calcul refuse (« Aucun planning avant que vous ayez validé les réglages du planning… ») et n'enregistre rien ; le calcul du matin et le recalcul sur événement passent la ferme, sans échec compté ni ligne de journal ; passer le groupe ne le permet pas. Le bandeau « À finir » nomme « réglages du planning à valider » quand le Planning est coché.
- **Inchangé** : la ferme du porteur (espace d'avant l'accueil) et la démonstration n'ont rien à relire et gardent leur planning (F426) ; aucune valeur de calcul ne change.
- **Preuves.** `tests/db/onboarding-settings.test.ts` : les groupes des cases cochées et leurs valeurs ; aucun planning ni enregistrement avant la validation ; passer ne permet pas, valider si ; l'étape proposée puis confirmée avec son compte ; un groupe non montré refusé ; la ferme d'avant l'accueil et la démonstration ; le calcul du matin et le recalcul sur événement sans échec ; isolation Alice et Bob, aux trois passages. Sept sabotages, chacun détecté. Les tests du planning valident le groupe pour leurs fermes neuves (`validatePlanningSettings`) ; les parcours aussi (`preparerLaFermeNeuve`). Parcours P46 étendu jusqu'à « Accueil terminé ».

#### 8 bis.17 · Précisions du code de la PR 5b (20 novembre 2026, D-230, F589)

Écrites avec le code, le 20 novembre 2026, en Opus 5.5 · Élevé, sans accès d'OTF.

##### F589 · La vérification finale, et plusieurs fermes remis après la 4.3

- **La vérification** (F427) est le pli « Accueil de la ferme » de Réglages, pour un espace qui fait l'accueil : chaque étape en vert (confirmé, avec ce qui l'a été), orange (passé, avec la conséquence) ou rouge (à faire, avec son lien), comme depuis la PR 1 ; la PR 5b y ajoute, sous l'étape « Réglages à relire », **chaque groupe** : « confirmé », « passé, valeurs proposées » ou « proposé » ; et **« Encore inconnu »** : les espèces non rattachées, les jardins à classer, les parcelles sans sol (quand la réserve du sol est cochée), chacun avec sa conséquence en mots et son lien, **même après une étape confirmée** (une espèce laissée sans référence, un jardin apparu dans Ouvre ta ferme). « Rien ne reste inconnu. » quand c'est le cas. Une phrase rappelle que rien n'est bloqué, sauf le planning tant que ses réglages ne sont pas validés.
- **Plusieurs fermes d'une même personne (F418) : remis après la 4.3, PR 3.** Le sélecteur de ferme suppose le raccordement d'OTF par ferme (la 4.3 limite à une ferme, F351, et son raccordement attend l'accès d'OTF) ; l'état de l'accueil est déjà par espace. Le sélecteur, la notification qui nomme sa ferme et le test à deux fermes d'une même personne se codent avec la 4.3, PR 3.
- **Inchangé** : la ferme du porteur (espace d'avant l'accueil) lit ses étapes « Réglage d'avant l'accueil, gardé tel quel », sans « Encore inconnu » ; la démonstration n'a pas le pli.
- **Preuves.** `tests/onboarding-verification.test.ts` : les textes de ce qui reste inconnu et des groupes. Parcours P46 : les six groupes, « Gel : passé, valeurs proposées », et les espèces non rattachées sous « Encore inconnu », avec leur lien.

#### 8 bis.18 · Précisions du code de la PR 4d (20 novembre 2026, D-231, F590)

Écrites avec le code, le 20 novembre 2026, en Opus 5.5 · Élevé, sans accès d'OTF.

##### F590 · Le modèle des rattachements du porteur

- **Le relevé.** Lu en lecture seule le 20 novembre 2026 dans « Réglages », « Correspondance des espèces » de la ferme du porteur, saison 2026, dans son navigateur, onglet refermé ensuite : 77 espèces, dont **40 rattachées à une culture de référence du jeu commun** (11 par analogie), 36 « sans référence Kc » et 1 engrais vert. Les 40 liens entrent dans `lib/domain/onboarding/species-model-data.ts` : un nom d'espèce, l'identifiant d'une culture du jeu commun, l'analogie ; jamais un identifiant d'OTF ni une donnée de ferme. La relecture prévue par F428 (réponse 4) est faite par l'assistant, sur la délégation du porteur (19 novembre 2026, confirmée le 20 pour ces liens).
- **L'analogie gardée.** Un lien du modèle par analogie (la mâche suit la salade d'été) est proposé « Salade d'été, par analogie » et rattaché par analogie ; une proposition d'après le nom ne l'est jamais.
- **Hors du modèle** : les espèces « sans référence Kc » et l'engrais vert ; le modèle ne propose qu'une culture de référence. Une nouvelle ferme les rattache à la main.
- **Inchangé** : la ferme du porteur et la démonstration n'ont pas l'étape (F426) ; le modèle ne vise qu'une culture commune utilisable de la ferme ; sans lui, la proposition d'après le nom.
- **Preuves.** `tests/db/onboarding-species.test.ts` : le modèle d'abord, le nom ensuite, sur la ferme d'essai ; 40 liens, des noms tous différents, chacun vers une culture du jeu commun (lue dans la migration 0023) ; l'analogie gardée au rattachement. Cinq sabotages, chacun détecté. Parcours P46 : la mâche proposée « par analogie », d'après le modèle.

## 9. Site définitif et politique de confidentialité (4.8)

**[T4-18] Trois pièces**, toutes en français, simples, sans jargon :

- **Une page d'accueil publique** (« Site web » du formulaire) : ce que fait le module, pour qui, ce qu'il ne fait pas, lien vers la démonstration sur invitation, contact. Le module lui-même reste **derrière la connexion**.
- **Une page de politique de confidentialité** (champ obligatoire du formulaire) : qui est responsable, ce qui est lu dans OTF (liste des droits et des routes), ce qui est conservé (instantané, cache, réglages, courriel), **combien de temps**, où (Cloudflare, adresse de la base), à qui rien n'est vendu ni transmis, **ce qui sort vers l'extérieur** (fournisseur météo : la commune ; cartes de l'IGN : la zone affichée ; notifications : le service du navigateur), comment **se déconnecter et faire effacer** ses données, comment contacter, ce qui se passe si OTF change ou ferme. Aucune mesure d'audience (C9).
- **Des conditions d'utilisation courtes** (hors formulaire, utiles avant le pilote) : service fourni tel quel, ferme réelle sous la responsabilité de son exploitant, résultat agronomique = aide à la décision, pas une garantie.

**[T4-19] Adresse (TRANCHÉ par François le 15/11 : `workers.dev`, gratuit ; la recommandation « domaine propre » ci-dessous est écartée).** La route de retour OAuth doit être en HTTPS et **fixe** : changer d'adresse plus tard oblige à refaire la demande. Deux options : `workers.dev` (gratuit, adresse actuelle, peu crédible pour d'autres fermes) ou **un nom de domaine propre** (environ 10 à 15 €/an, non chiffré par la recherche). **Recommandation : domaine propre** (question 1, section 12), avant le formulaire.

**[T4-20] Avis juridique : hors de ma compétence et de ce brouillon.** Les textes rédigés ici sont **un projet honnête, pas un avis**. Question 4 (section 12).

### 9 bis. Précisions du code de la 4.8 (17 novembre 2026, D-153, F317 à F324)

Codée le 17 novembre 2026 sur le « vas-y » exprès du porteur, **avant la fin
de la fusion des moteurs** (dérogation à l'ordre de la section 4, voir D-153),
en Opus 5.5 · Élevé. Trois réponses du porteur le même soir, une par une.

- **F317 · Où.** Les pages publiques sont servies par **un Worker à part**,
  `irrigation-otf-site` (`cloudflare/irrigation-site/`), choisi par le
  porteur (« Petit site séparé », question 1 sur 3) plutôt que des exceptions
  dans l'application Access du module : aucun réglage Access, le module reste
  fermé comme avant. Adresse fixe :
  `https://irrigation-otf-site.lechampdelaurore.workers.dev` (le « Site web »
  du formulaire d'OTF). Le Worker n'a ni base, ni liaison, ni secret
  obligatoire ; il est déployé par la CI après la production, seulement quand
  son dossier change.
- **F318 · Trois pages**, en français, sans jargon : l'accueil (`/` : ce que
  fait le module, pour qui, ce qu'il ne fait pas, la démonstration sur
  invitation, le contact), la politique de confidentialité
  (`/confidentialite`, le champ du formulaire) et les conditions
  d'utilisation (`/conditions`). Le texte décrit ce que fait le code à sa
  date ; toute PR qui change ce qui est lu, gardé ou envoyé dehors le met à
  jour.
- **F319 · Responsable** : « François PREZEAU, GAEC Le Champ de l'Aurore »,
  écrit par le porteur (question 2 sur 3).
- **F320 · Contact** : une adresse que le porteur **saisit lui-même** dans un
  réglage du Worker du site, `SITE_CONTACT_EMAIL` (question 3 sur 3) ; elle
  n'est jamais écrite dans le dépôt ni vue par l'assistant. Tant qu'elle
  manque, ou si sa valeur n'a pas la forme d'une adresse, les pages renvoient
  à la page publique du projet sur GitHub.
- **F321 · Rien des visiteurs** : ni script, ni police, ni image venus
  d'ailleurs, ni témoin, ni mesure d'audience ; les journaux du Worker sont
  désactivés ; seules `GET` et `HEAD` sont acceptées ; en-têtes de sécurité
  (`Content-Security-Policy` fermée, `Referrer-Policy: no-referrer`).
- **F322 · L'adresse de retour OAuth** est fixée sur le module :
  `https://module-irrigation-otf.lechampdelaurore.workers.dev/api/otf/oauth/retour`,
  derrière la connexion comme tout le module. Jusqu'à la 4.3, elle ne lit, ne
  garde, ne journalise et ne renvoie rien de l'adresse (`code`, `state`) :
  elle dit « La connexion à Ouvre ta ferme n'est pas encore ouverte » et
  ramène au module ; jamais en cache, `Referrer-Policy: no-referrer`. Un test
  vérifie que le site public annonce la même adresse que celle que sert le
  module.
- **F323 · Point pour la 4.3** : les journaux d'invocation du Worker du
  module (observabilité, `head_sampling_rate` 1) gardent sept jours l'adresse
  de chaque requête, donc le `code` d'autorisation à usage unique quand la
  4.3 l'échangera. Le contrat 4.3 tranche (journaux de cette route coupés,
  ou code court et à usage unique jugé suffisant) ; rien n'est changé ici.
- **F324 · Preuves** : `pnpm site:check` (12 tests, vérification du Worker),
  tests de la route de retour, parcours P36 aux deux largeurs. Restent :
  le déploiement vérifié job par job, l'adresse de contact posée par le
  porteur, sa relecture du texte en ligne, puis l'envoi du formulaire d'OTF
  (son acte) ; la relecture juridique avant toute ferme tierce (question 4).
- **Le 18 novembre 2026, l'adresse de contact est posée par le porteur
  lui-même** (secret `SITE_CONTACT_EMAIL`, à 19 h 39) ; la page de
  confidentialité ne renvoie plus à la page du projet. **Ses premières
  remarques à la relecture**, le même soir :
- **F345 · Vannes et capteurs** : l'accueil dit « Il ne pilote pas encore de
  vanne ni de capteur : c'est en cours de développement » (D-066 : le
  pilotage est développé avec Tlaloc).
- **F346 · « L'essayer »** : l'accueil dit qu'une ferme pourra relier le
  module à son propre compte Ouvre ta ferme et y travailler, après
  connexion, sur ses vraies données ; que ce raccordement n'est pas encore
  ouvert à tous, d'abord à quelques fermes amies ; puis la démonstration
  sur invitation, pour tout essayer sans rien risquer.
- **F347 · Contact** : dans « Contact » de l'accueil, « de préférence par
  Discord » (sans nommer le serveur : les fermes savent où trouver le
  porteur), sinon par courriel ; en cas de problème, le décrire par écrit
  (page, geste, ce qui s'est passé), avec des captures d'écran si possible.
  Les demandes sur les données restent par courriel (confidentialité).
- **F348 · Prix** (choix du porteur du 18 novembre 2026 à 21 h, après
  l'envoi du formulaire) : les conditions d'utilisation ont une rubrique
  « Prix » : gratuit pendant tout le pilote ; développé et maintenu
  bénévolement par une ferme qui en paie seule les frais (hébergement
  d'environ 5 € par mois, davantage avec plus de fermes ; outils de
  développement et de maintenance, environ 100 € par mois) ; après le
  pilote, selon le nombre de fermes, une participation possible de l'ordre
  de 1 € par mois et par ferme, pour couvrir ces frais seulement, sans but
  lucratif, annoncée à l'avance, chaque ferme restant libre d'arrêter. La
  mention « en essai, sans garantie » reste à part. La date des textes
  passe au 18 novembre 2026. La question 2 (qui paie l'hébergement) reste
  tranchée « gratuit pendant le pilote » ; la participation après le
  pilote sera à décider par le porteur.
- **Relecture finie** : le porteur valide les trois pages le 18 novembre
  2026 à 20 h 04 (« je valide en l'état »).
- **Formulaire envoyé** par le porteur lui-même le 18 novembre 2026 à
  20 h 13 : la demande « Module d'irrigation pour Ouvre ta ferme » est
  « En attente » chez OTF, avec les adresses de la section 9 bis et cinq
  droits en lecture (structure, parcellaire, cultures, interventions,
  espèces et variétés), chacun avec sa raison. **La 4.8 est close** ;
  reste l'étape 2 de l'ordre, la validation d'OTF, hors de notre main.

## 10. Exploitation (4.5) et pilote (4.6)

**4.5.** Sauvegarde et **restauration D1 essayées pour de vrai** (une sauvegarde qui ne restaure pas est un défaut silencieux ; les possibilités d'historique du service sont [NON VÉRIFIÉ]) ; observabilité par ferme sans données sensibles (taux d'erreurs OTF, quota consommé, dernière synchronisation) ; **suppression complète d'une ferme** (jeton, instantanés, réglages, évènements) vérifiée par test ; page d'état simple pour l'exploitant ; procédure de support (une personne) ; **budget de coûts** relu au tableau de bord un mois après la première ferme (les deux alertes de budget existent). Coût estimé : **≈ 5 $/mois jusqu'à 30 fermes sans Access payant**, le calcul étant le seul poste proche du plafond (mesure réelle du 9/11 : ≈ 307 ms de calcul par requête, 1 000 requêtes par mois et par ferme).

**4.6.** 1 ou 2 fermes amies, d'abord en lecture seule, **accord écrit de chacune**, recette sur chaque écran, preuve d'isolation **en conditions réelles** (A ne voit jamais B), retour des fermes consigné. Aucune ouverture au-delà avant le retour du pilote. Question 3 (section 12). **Précisions de la 4.6 : section 10 ter** (D-221, F570 à F580).

### 10 bis. Précisions de la 4.5 : exploitation, sauvegardes, conservation, effacement et support (19 novembre 2026, D-220, F560 à F569)

Écrites avant le code, le 19 novembre 2026, en Sonnet 5.5 · Moyen (contrat sans code ; le code de la 4.5 est en Opus 5.5 · Très élevé, ligne 4.5 de la roadmap). Elles précisent la section 10. Leçon centrale : la panne de la mise à jour météo du 14 au 19 novembre 2026 est passée inaperçue cinq jours (échec silencieux, affichage vert ; correctifs D-164 à D-166). Marques : **[NON VÉRIFIÉ]**, **[À FAIRE]** (à lire ou mesurer au début du code).

#### 10 bis.1 · Objet

Ouvrir le module à d'autres fermes ne tient que si **une défaillance se voit, se rattrape et se prouve**. Aujourd'hui, trois faits dits en clair :

- Une panne peut durer des jours sans que personne ne le sache : la réanalyse d'Open-Meteo a échoué du 14 au 19/11 pendant que l'écran restait vert (correctifs #97, #98, #99, D-164 à D-166). Le seul garde-fou posé est local : un avertissement affiché sur deux pages. **Rien ne prévient l'exploitant.**
- Le contrat dit que la restauration de la base D1 n'a **jamais été essayée** (sections 10, 14, 15).
- L'effacement d'une ferme est **volontairement incomplet** : F360 garde ce que la personne a saisi « jusqu'à une demande d'effacement (4.5) ». Cette demande n'existe pas encore.

#### 10 bis.2 · Contraintes tenues

1. Celles de la section 2 du contrat (inconnu reste inconnu ; OTF en lecture seule ; 4 requêtes par seconde au plus ; aucun secret vu par l'assistant).
2. **Aucune dépense nouvelle sans l'accord du porteur écrit** (le budget se demande toujours au porteur). Le plan retenu en recommandation **n'ajoute aucun service payant** : tout tient dans l'abonnement Workers déjà pris (D-017).
3. **Aucun essai sur la ferme réelle ni sur sa base de production.** Les essais de sauvegarde et de restauration se font sur **une base D1 d'essai, créée puis détruite**, jamais sur `module-irrigation-otf`. Une restauration en production écrase tout sur place (voir 4.5-b) : elle n'est jamais jouée « pour voir ».
4. Les journaux et la page d'état ne contiennent **aucun jeton, `code`, `state`, `code_verifier`, nom de ferme ni contenu agronomique** (F354). Une ferme se nomme par son identifiant interne.
5. Une table ou une colonne `_id` / `_key` nouvelle est rangée dans `tests/support/space-coherence.ts` ; aucune requête n'écrit `owner_user_id = ?` ni `otf_farm_id IS NULL` hors `db/workspace-scope.ts`.
6. Tout appel à OTF passe par le régulateur et le budget du jour de la 4.3 ; la 4.5 **n'ajoute aucun appel à OTF**.
7. Aucune donnée n'est copiée dans un lieu public. **Le dépôt est public** : un export de la base n'y est jamais déposé, ni en fichier, ni en « artefact » d'une exécution GitHub Actions (ils sont lisibles de tous).

#### 10 bis.3 · La leçon de la panne météo, posée en règle

Ce qui est passé inaperçu cinq jours, et pourquoi (constats du 19/11) :

| Cause | Règle qui l'aurait vue |
| --- | --- |
| Le vert s'appuyait sur « la dernière **tentative** » ou une date ancienne restée affichée | **R1.** L'état se calcule sur la dernière **réussite**, jamais sur la dernière tentative |
| Un échec « réseau » immédiat, sans statut ni réponse, était compté comme panne passagère | **R2.** Un échec qui **se répète** n'est plus « passager » : au-delà de N échecs consécutifs, il passe en rouge |
| Rien ne dit « il manque quelque chose qui devait arriver » | **R3.** Chaque tâche automatique **déclare son rythme attendu** ; une réussite qui manque après son délai est un défaut, même sans aucune erreur |
| L'alerte n'existait que sur l'écran de la personne | **R4.** Un défaut **remonte à l'exploitant** sans qu'il ouvre rien |
| Le contrôle dépendait de la tâche qui était en panne | **R5.** Le contrôle est **un autre déclencheur**, qui ne dépend pas de ce qu'il surveille |
| Un correctif a été déclaré en ligne sans voir la tâche réussir (« non vérifié sur le site ») | **R6.** Après chaque déploiement qui touche une tâche automatique, **on attend sa prochaine réussite** avant de dire « réglé » |

#### 10 bis.4 · Les points

##### F560 (4.5-a) · Le registre des tâches attendues (R1, R2, R3)

Un registre en code (pas en base : il fait partie du module, il se relit en revue) liste **chaque tâche automatique** avec : son nom, son **rythme attendu**, son **délai de tolérance**, son effet si elle manque, et **où est gardée sa dernière réussite**.

| Tâche | Rythme attendu | Orange à | Rouge à | Où est gardée la dernière réussite |
| --- | --- | --- | --- | --- |
| Synchronisation météo de 6 h 15 (prévisions) | 1 par jour | 30 h | 36 h (reprend D-165) | état automatique du workspace (existe) |
| Réanalyse (pluie estimée après coup) | 1 par jour | 30 h | 36 h | [À FAIRE] vérifier qu'elle a **sa propre** date de réussite, distincte de celle des prévisions : le 14/11 les prévisions passaient, la réanalyse non |
| Calcul du matin | 1 par jour | 30 h | 36 h | [À FAIRE] à lire dans le code |
| Rotation du coffre au matin (`otf_vault_morning`) | 1 par jour | 30 h | 36 h | [À FAIRE] aujourd'hui journal seulement : à mémoriser |
| Lecture d'OTF par ferme (4.3, PR 4) | selon le raccordement | 12 h | 24 h | [À FAIRE] à poser avec la PR 4 de la 4.3 |
| Sauvegarde (4.5-b) | 1 par semaine | 8 jours | 10 jours | nouveau |
| Export hors Cloudflare, fait par le porteur (10 bis.9) | 1 par semaine | 8 jours | 10 jours | geste « J'ai fait l'export du … » de la page d'état |
| Veille de l'exploitant (4.5-g) | 1 par jour | — | pas de réponse = alerte de dernier recours | nouveau |

Règles : (i) **les seuils sont ici, en code, avec leur raison** ; un seuil changé passe par une PR ; (ii) une tâche **jamais réussie** est « jamais exécutée », en orange, **pas en vert** ; (iii) l'état d'une tâche = `ok` / `en retard` / `en panne` / `jamais exécutée`, calculé à la lecture à partir de la dernière réussite et de l'heure courante (pas de champ « statut » recopié qui pourrait mentir) ; (iv) **N échecs consécutifs** (recommandation : **3 jours de suite**) passent la tâche en `en panne` même si une date de réussite récente existe, quand cette réussite est partielle (R2) ; (v) tout nouveau job planifié **doit** s'inscrire au registre, **vérifié par un test** qui lit les déclencheurs (`wrangler.jsonc` et `cloudflare/*/wrangler.*`) et échoue pour un cron absent du registre.

[NON VÉRIFIÉ] Où est gardée la dernière réussite de chaque tâche : à dresser au début du code (la colonne ci-dessus).

##### F561 (4.5-b) · Sauvegardes de la base D1, et **restauration essayée pour de vrai**

Ce que la documentation de Cloudflare établit (**lue le 19/11** ; à relire avant le code) :

- **Time Travel** : restauration de la base à un instant passé, **30 jours** sur l'offre Workers payante (7 sur la gratuite) ; **sans frais supplémentaires** ; commande `wrangler d1 time-travel restore <base> --timestamp=<instant>` (ou `--bookmark`) ; la base doit être en version « production » (`wrangler d1 info`).
- **La restauration écrase la base sur place**, annule les requêtes en cours, et rend **un signet de l'état d'avant** pour pouvoir revenir.
- **Export** : `wrangler d1 export <base> --remote --output=…` ; il **bloque les autres requêtes** pendant qu'il tourne ; les tables virtuelles (FTS5) ne s'exportent pas ; la précision des très grands entiers n'est pas garantie.

Conséquences posées :

1. **Pas d'essai sur la production** (contrainte 3). L'essai se fait sur **une base d'essai** `module-irrigation-otf-essai-restauration`, remplie à partir de l'export d'une base de **données fictives** (deux fermes fictives, dont « Ferme v2 » n° 4394 en copie fictive), puis détruite à la fin.
2. **Trois scénarios essayés**, chacun avec un résultat écrit dans le compte rendu :
   - **S1, revenir en arrière** : on écrit des données, on note l'instant, on en efface une partie, on restaure à l'instant noté avec Time Travel, **on compare table par table** (nombre de lignes et empreinte du contenu) avec l'état noté ; on vérifie que le **signet d'avant** permet de revenir à l'état abîmé.
   - **S2, reconstruire depuis un export** : base neuve, migrations appliquées, import de l'export, **mêmes comparaisons** ; puis les tests d'isolation à deux fermes (4.1 + 4.2) **joués contre cette base restaurée**.
   - **S3, perdre la clé** : après restauration, le coffre des jetons **sans** la clé maîtresse : les raccordements sont dits « hors d'usage » (4.3, F355) et chaque ferme est invitée à **se reconnecter** ; **aucune clé n'apparaît en clair** nulle part. Avec la bonne clé : les jetons se lisent.
3. **Un défaut doit casser le test** : comme pour la 4.3, la preuve compte des **sabotages** (retirer une table de l'export, corrompre une ligne, oublier une migration) que le contrôle doit détecter.
4. **Rattrapage d'une seule ferme** : Time Travel restaure **toute la base, donc toutes les fermes**. Pour l'erreur d'une seule ferme, la procédure écrite est : restaurer **sur une copie**, en extraire les lignes de cette ferme (par la clé d'espace), les réinsérer. Cette extraction est **essayée en S1** sur la ferme fictive A, la ferme fictive B devant rester **inchangée** (empreinte identique).
5. **Copie hors de Cloudflare** (une sauvegarde dans le même compte ne protège pas de la perte du compte) : voir la décision de la section 10 bis.9. L'export contient des données personnelles et des jetons chiffrés : **jamais dans le dépôt, ni en artefact de GitHub Actions** (contrainte 7).
6. **Garde de la clé maîtresse** : sans elle, l'export et la restauration ne rendent pas les jetons lisibles. La clé **est gardée par le porteur, hors du module et hors du dépôt** (il la saisit lui-même, règle des secrets) ; la procédure dit où et comment sans jamais la montrer à l'assistant.
7. Un script de sauvegarde (`pnpm backup:export`) et un script d'essai (`pnpm backup:rehearse`) vivent dans le dépôt, **sans aucun secret en dur** ; leurs sorties ne contiennent pas de données.

[NON VÉRIFIÉ] : la **finesse** de Time Travel (à la minute ?), le **comportement réel** d'une restauration sur une base qui a des migrations récentes, et la durée d'un export sur une base qui grossit : à mesurer pendant l'essai, pas à supposer.

##### F562 (4.5-c) · Conservation : une durée écrite par donnée

Une table dans le contrat, relue par la PR, qui dit **combien de temps** on garde chaque donnée et **qui l'efface** (une tâche planifiée du registre 4.5-a). Propositions de départ, à confirmer en lisant le code :

| Donnée | Durée proposée | Pourquoi |
| --- | --- | --- |
| Journaux d'invocation du Worker | 7 jours (Cloudflare, existe, F354) | diagnostic ; non modifiable route par route |
| Journal des appels à OTF (compteur partagé, migration 0032) | **35 jours** | assez pour lire un mois de quota |
| Instantanés lus dans OTF (cache) | tant que la ferme est reliée ; **effacés à la déconnexion** (F360, existe) | ce sont des copies |
| Données saisies par la personne (matériel, ressources, arrosages, pluie, observations, réglages) | tant que l'espace existe ; **après « Déconnecter la ferme » : 90 jours puis effacement**, sauf demande plus tôt | F360 les garde « jusqu'à une demande d'effacement » : on y met une borne |
| Observations météo et prévisions | tant que l'espace existe | alimentent le bilan |
| Abonnements de notification d'un appareil | jusqu'à la désinscription ; **effacés après 90 jours sans réponse du service de push** | un appareil perdu ne reste pas |
| Demandes d'autorisation OTF en cours (4.3, PR 3) | quelques minutes ; **purge au matin** de celles expirées | à usage unique |
| Journal d'accès du support (4.5-h) | 12 mois | traçabilité de ce que l'exploitant a consulté |
| Sauvegardes (Time Travel) | 30 jours (Cloudflare) ; export hors compte : export chiffré gardé par le porteur (10 bis.9) | voir ci-dessous |

**Dit sans détour dans le texte de confidentialité** : une donnée effacée **reste récupérable dans l'historique Time Travel jusqu'à 30 jours** après l'effacement. Cette phrase s'ajoute au texte de la page de confidentialité (4.8). **Phrase approuvée par le porteur le 19 novembre 2026 (20 h 52 UTC)** : le code de la 4.5 l'applique telle quelle (PR 5), comme le texte de #96 ; toute autre formulation lui repasse en relecture.

[À FAIRE] dresser, **table par table à partir de `db/schema.ts` et `tests/support/space-coherence.ts`**, la liste réelle des données personnelles ; le tableau ci-dessus est une base, pas un inventaire. *Dressée : 10 bis.18, F649.*

##### F563 (4.5-d) · Suppression complète d'une ferme (le reste de F360)

**La demande.** Le propriétaire de la ferme, dans « Réglages » : « Supprimer ma ferme et mes données », **après avoir tapé le nom de la ferme**. Elle explique ce qui disparaît, ce qui reste dans l'historique 30 jours, et que l'autorisation chez OTF doit être retirée **par un administrateur de la ferme dans Ouvre ta ferme** (le module ne peut pas la retirer : F360).

**Le délai.** L'effacement a lieu **7 jours après la demande** (recommandation), **annulable** pendant ce délai ; pendant ces 7 jours la ferme est **figée** (aucun calcul, aucune notification, aucun appel à OTF). Un effacement immédiat est possible **sur demande écrite de la personne à l'exploitant**, pas depuis l'écran.

**Ce qui est effacé** : jetons (d'accès et de renouvellement) et ligne du coffre ; instantanés ; réglages ; matériel, ressources, planches, arrosages, pluie, observations, événements ; abonnements de notification de cet espace ; lignes du journal des appels de cette ferme ; l'espace lui-même et son rattachement. **Ce qui reste** : un **enregistrement minimal** de la demande (identifiant interne, date de la demande, date d'effacement ; **ni nom, ni contenu**) pour pouvoir **prouver** qu'elle a été traitée.

**La preuve, le cœur du point.**

1. **Un test d'exhaustivité** : il parcourt **toutes les tables qui portent une clé d'espace** (la liste de `space-coherence.ts`) et **échoue** si l'une n'est pas couverte par l'effacement **ou rangée explicitement dans une liste « conservée » justifiée**. Une table ajoutée plus tard sans règle d'effacement **casse la CI**.
2. **Un test à deux fermes** : on efface A ; **B est strictement inchangée** (empreinte table par table avant et après) ; aucune ligne de A ne subsiste (comptage par table).
3. **Un test de reprise** : l'effacement coupé au milieu (panne simulée) **reprend sans rien oublier ni rien effacer d'autre** ; il ne laisse jamais une ferme « à moitié » ; il se fait **par lots bornés** (la base D1 limite le travail par requête) [À FAIRE : mesurer la limite] (bornes lues dans la documentation de D1 : 10 bis.17, F644).
4. **Un test d'annulation** dans les 7 jours.
5. Le résultat se **lit** : la page d'état de l'exploitant (4.5-f) montre « demandes d'effacement : N en attente, N faites, **dernière faite le …** » et le registre 4.5-a surveille **la tâche d'effacement** comme les autres (une demande en retard passe en rouge).

##### F564 (4.5-e) · Observabilité par ferme, sans donnée sensible

Pour **chaque ferme**, calculées à la lecture (aucun nouveau secret, aucun contenu) :

- **taux d'erreurs OTF** sur 24 h et sur 7 jours (réponses `401`, `403`, `429`, `5xx`, délai dépassé, « réseau ») ;
- **quota consommé** du jour sur la part de la ferme (F363) ;
- **dernière synchronisation** réussie avec OTF, **dernière météo** réussie, **dernier calcul du matin** réussi ;
- état du **raccordement** (reliée, révoquée par OTF, hors d'usage) ;
- état de **l'accueil** (4.4-a), pour savoir où la personne s'est arrêtée.

**Journaux.** Les événements journalisés ont **un nom stable** (`otf_call_failed`, `weather_sync_failed`, `morning_failed`, `backup_failed`, `erasure_step`…) et des champs **listés** : identifiant interne de la ferme, nom de la tâche, classe d'erreur, statut HTTP, durée. **Un test** parcourt les journaux produits par les essais et **échoue** si une valeur ressemble à un jeton, un `code`, une adresse de retour ou un nom de ferme. Pour une panne comme celle du 14/11, la **vraie erreur** (nom, message, cause, durée, sans adresse ni clé) est déjà journalisée depuis #97 : la 4.5 **la garde sous un nom stable** et la remonte (4.5-f).

##### F565 (4.5-f) · La page d'état de l'exploitant

Une page `/irrigation/exploitation` (nom à confirmer) **réservée à l'exploitant** (la personne propriétaire du déploiement, aujourd'hui le porteur ; le droit se lit côté serveur, jamais depuis le navigateur). Elle dit, en mots simples :

1. **Le jugement d'ensemble** en une ligne (« Tout va bien » / « N tâches en retard » / « N tâches en panne ») ;
2. **Les tâches du registre** (4.5-a), avec leur dernière réussite, leur état et la dernière erreur journalisée ;
3. **Les fermes** : une ligne par ferme (identifiant, état du raccordement, quota du jour, dernière synchronisation), triées **les plus en difficulté d'abord** ;
4. **La sauvegarde** : date du dernier export réussi, date du dernier essai de restauration ;
5. **Les demandes d'effacement** (4.5-d) ;
6. **Les coûts** : lignes lues/écrites D1, requêtes Workers, calcul, **copiés à la main tous les mois** depuis le tableau de bord (la lecture du tableau de bord passe par le Chrome du porteur, avec l'accord du porteur à chaque fois) ; la page n'appelle pas l'API de Cloudflare.

Mêmes règles que le reste du module : **deux largeurs** (1440 et 390 px), mots simples, jamais un « 0 » ou un vert qui cache un manque.

##### F566 (4.5-g) · La veille de l'exploitant : « Cela remonte à l'exploitant » (R4, R5)

Un **déclencheur distinct** de ceux qu'il surveille (R5), une fois par jour (recommandation : **9 h, heure de Paris**, après le matin et la météo de 6 h 15) : il lit le registre (4.5-a) et, **si au moins une tâche est `en retard` ou `en panne`**, envoie **une notification web push à l'exploitant** qui dit **quelle tâche** et **depuis quand**, avec le lien vers la page d'état. Pas de notification quand tout va bien (pas de bruit) ; **une notification « tout va bien » par semaine** (le dimanche) prouve que la veille elle-même tourne.

- **Aucun service nouveau** : on réutilise le Worker Push existant et le planificateur (un déclencheur de plus). [À FAIRE] vérifier que le Worker Push peut s'adresser **à l'exploitant seul** sans passer par un espace de ferme.
- **Si la veille elle-même tombe** (le site ne répond pas, le Worker Push non plus) : la notification du dimanche manque, et **l'exploitant sait qu'il doit regarder** (la règle est écrite dans la procédure 4.5-h). Un contrôle extérieur gratuit (service tiers de type « sonde ») ajouterait un tiers et une donnée à protéger : **non retenu** ; on y reviendra si le pilote le justifie.
- **Preuve** : un test **sabote** chaque tâche du registre (plus de réussite depuis 37 h ; 3 échecs consécutifs) et vérifie que la notification part avec le bon nom ; un test vérifie qu'**une panne qui dure ne renvoie pas** la même notification plus d'une fois par jour.

##### F567 (4.5-h) · Le support par une seule personne

Un document `docs/exploitation.md` (l'état du projet et la roadmap y renvoient), court, qui dit **ce que fait l'exploitant** quand :

- **une notification de panne arrive** (4.5-g) : où regarder, dans quel ordre, ce qui est réglable sans code, ce qui demande un correctif ;
- **une ferme écrit** : un gabarit de réponse ; ce que l'exploitant peut dire **sans ouvrir ses données** (état du raccordement, quota, dernière synchronisation : la page d'état suffit) ;
- **une ferme demande l'effacement** : le chemin de 4.5-d ;
- **la base est abîmée ou perdue** : les trois scénarios de 4.5-b, pas à pas ;
- **la clé maîtresse est perdue ou soupçonnée** : rotation essayée (F355 : clé précédente), puis reconnexion des fermes ;
- **OTF révoque, change ses conditions ou ferme son API** : les fermes sont prévenues par le module, le module s'arrête **proprement** (voie de secours F369 non retenue pour l'instant) ;
- **un compte ou un déploiement est perdu** : redéploiement propre depuis Git (D-016) et reprise de la dernière sauvegarde.

**Accès de l'exploitant aux données d'une ferme.** L'engagement de la page de confidentialité est que l'exploitant **ne consulte les données d'une ferme que pour…** (formulation validée le 19/11 à 7 h 54, 4.3 PR 2). **La 4.5 n'ajoute aucun accès** : la page d'état n'affiche aucun contenu agronomique ; si le support en exige un, c'est **sur demande de la ferme**, **consigné** dans un journal d'accès (date, ferme, raison en une ligne, **sans** le contenu consulté) gardé 12 mois (4.5-c).

**Engagements de délai** : aucun pendant le pilote (une seule personne). La page d'aide le dit : « Réponse en général sous deux jours ouvrés, sans engagement. » (formulation à valider avec le texte de la 4.8).

##### F568 (4.5-i) · Les coûts relus un mois après la première ferme

Reprise de la section 10 : relire au tableau de bord, **un mois après la première ferme tierce reliée**, requêtes, calcul, lignes lues et écrites, stockage D1 ; comparer à l'estimation (≈ 5 $/mois jusqu'à 30 fermes, le calcul étant le poste le plus proche du plafond : ≈ 307 ms par requête mesurés le 9/11) ; **inscrire l'écart** au contrat. Les deux alertes de budget existent déjà (sections 10 et 14). **La 4.5 n'ajoute aucune dépense** (contrainte 2) ; si la mesure montre qu'un poste dépasse, la question **le porteur est posée à part**, avec le chiffre.

#### 10 bis.5 · Ce que la 4.5 ne fait pas

- Aucune **API publique**, aucun **service de supervision** tiers, aucun **abonnement** nouveau.
- Aucune **restauration en production** : elle n'est jamais jouée comme essai.
- Aucune **sauvegarde automatique hors de Cloudflare** : l'export hebdomadaire est fait par le porteur (section 10 bis.9).
- Aucun **engagement de service** (disponibilité, délai de réponse) : la 4.5 prépare le pilote de 1 à 2 fermes amies (4.6), pas une offre.
- Aucun **changement du moteur** (section 11) ni **du calcul** : rien de l'agronomie.

#### 10 bis.6 · Découpage du code (cinq PR, une à la fois, après le déploiement vérifié de la précédente)

| PR | Contenu | Preuve propre |
| --- | --- | --- |
| 1 | **Registre des tâches (4.5-a)** + règles R1 à R3 + dernières réussites distinctes (réanalyse, matin, coffre) ; avertissements existants (D-165) repris sur le registre | test de couverture des déclencheurs ; sabotage de chaque tâche |
| 2 | **Veille (4.5-g)** + notification à l'exploitant + **page d'état (4.5-f)** + journaux à noms stables et test d'absence de données sensibles (4.5-e) | sabotage → notification ; test des journaux ; parcours à 390 et 1440 px |
| 3 | **Effacement d'une ferme (4.5-d)** + enregistrement minimal + test d'exhaustivité | test à deux fermes ; reprise après coupure ; annulation |
| 4 | **Sauvegarde et essais de restauration (4.5-b)**, scripts, essai S1/S2/S3 **joué** sur la base d'essai | compte rendu des trois scénarios avec comparaisons réelles |
| 5 | **Conservation (4.5-c)** : purges planifiées inscrites au registre, texte de confidentialité relu, `docs/exploitation.md` (4.5-h), coûts (4.5-i) | test de purge ; relecture de le porteur sur le texte |

**Ordre** : 1, 2 (la plus utile aux fermes pilotes : « voir une panne »), puis 4 (« la sauvegarde ne restaure pas = défaut silencieux », ligne de la roadmap), puis 3 et 5. Chaque PR **met à jour les registres** (roadmap : tableau de la section 1, ordre de la section 2, bloc détaillé ; état du projet ; décisions ; changelog).

**Quand coder** : la 4.5 passe **après la 4.4** dans l'ordre du contrat. Mais la PR 1 (registre) **ne dépend pas** de la 4.3 PR 3/4, et peut se coder dès que le fil de code est libre, **à condition d'y ranger les tâches de la 4.3 au fur et à mesure** de leur arrivée. À trancher avec le coordinateur (un seul chantier de code par dépôt).

#### 10 bis.7 · Preuves de fin de la 4.5

| Point | Preuve exigée |
| --- | --- |
| 4.5-a | test de couverture des déclencheurs ; chaque tâche passe orange puis rouge **quand on la sabote**, jamais vert faute de réussite |
| 4.5-b | **S1, S2, S3 joués** sur la base d'essai, comparaisons **collées dans la PR** ; sabotages détectés ; clé jamais visible ; base d'essai détruite |
| 4.5-c | tableau de conservation inscrit au contrat, **table par table** ; purges testées ; phrase « 30 jours » approuvée par le porteur le 19/11, appliquée telle quelle |
| 4.5-d | test d'exhaustivité (casse si une table n'est pas couverte) ; test à deux fermes ; reprise ; annulation |
| 4.5-e | journaux : aucune valeur sensible dans les sorties des essais |
| 4.5-f, g | page à deux largeurs ; notification reçue **en vrai** sur l'appareil de l'exploitant (recette, avec son accord) |
| 4.5-h | `docs/exploitation.md` relu ; **chaque cas de la liste joué une fois à blanc** (au moins : panne, effacement, perte de base) |
| 4.5-i | lecture du tableau de bord un mois après la première ferme (dans le Chrome du porteur, avec l'accord du porteur) ; écart inscrit |

#### 10 bis.8 · Risques propres à la 4.5

| Risque | Gravité | Réponse |
| --- | --- | --- |
| Une sauvegarde qui ne restaure pas | grave, silencieux | S1 à S3 essayés ; sabotages ; essai **rejoué** à chaque changement de schéma important [À FAIRE : tous les trimestres, inscrit au registre] |
| La veille et la panne tombent ensemble | moyen | déclencheur distinct (R5) ; notification hebdomadaire de bonne santé |
| Un export bloque le site (il bloque les requêtes) | moyen | export **la nuit**, hors des tâches de 6 h 15, durée mesurée à l'essai |
| Données personnelles dans un export | grave | jamais dans le dépôt ni en artefact public ; chiffrement avant tout stockage hors de l'ordinateur de l'exploitant |
| Effacement oublieux d'une table nouvelle | grave, discret | test d'exhaustivité qui casse la CI |
| Support par une seule personne, absent | moyen | pas d'engagement de délai ; pilote limité à 1 à 2 fermes |
| Confusion entre « effacé » et « plus récupérable » | moyen | phrase des 30 jours **dans le texte de confidentialité**, approuvée par le porteur le 19/11 |

#### 10 bis.9 · Décision du porteur sur la copie hors de Cloudflare (19 novembre 2026, 13 h 48)

Une copie dans le même compte ne protège pas d'une perte du compte, et l'export contient des données personnelles. Le porteur a choisi **l'option A, gratuite** : **un export hebdomadaire chiffré, gardé par lui sur son ordinateur**, en plus de l'historique de 30 jours de Cloudflare. **Pas de R2 ni de service tiers** : aucune dépense nouvelle (contrainte 2). Conséquences écrites : l'export est chiffré **avant** d'être écrit sur disque (mot de passe saisi par le porteur, jamais vu de l'assistant) ; la page d'état (F565) a un geste « J'ai fait l'export du … » qui enregistre la date, et la tâche « Export hors Cloudflare » du registre (F560) passe en orange à 8 jours et en rouge à 10 ; la veille (F566) le rappelle. L'option B (stockage d'objets de Cloudflare) reste à rouvrir si le nombre de fermes grandit : sa tarification n'a pas été relue.

Décidé sans question au porteur (non budgétaire, autonomie du 19 novembre) : délai de 7 jours avant l'effacement d'une ferme ; veille à 9 h ; conservation de 35 jours pour le journal des appels et de 90 jours pour les données d'une ferme déconnectée ; pas de sonde extérieure ; notification web push, sans service d'e-mail. **La phrase des 30 jours ajoutée à la politique de confidentialité est approuvée par le porteur (19 novembre 2026, 20 h 52 UTC)** : son texte exact est celui de 10 bis.4, F562.
#### 10 bis.10 · Ce qui n'est pas établi (à dire, pas à deviner)

- La **finesse** de Time Travel et sa tenue **sur la base réelle** (taille, migrations récentes) : mesurer à l'essai.
- La **tarification de R2** et d'un éventuel autre stockage : non lue.
- Où se gardent aujourd'hui les **dernières réussites** de la réanalyse, du calcul du matin et de la rotation du coffre (4.5-a).
- Si le **Worker Push** peut notifier l'exploitant sans espace de ferme (4.5-g).
- La **limite de travail par requête D1** pour l'effacement par lots (4.5-d). *Lue dans la documentation de D1 : 10 bis.17, F644.*
- La **liste complète des tables** à effacer et à purger (4.5-c, 4.5-d) : à dresser au code. *Celles à effacer : 10 bis.17, F641 ; la durée de chacune : 10 bis.18, F649.*
- Tout avis **juridique** sur la durée de conservation, la preuve d'effacement et la mention des 30 jours : la relecture juridique gratuite de son réseau (4.8) doit **les couvrir** avant qu'une ferme tierce soit reliée (règle du 15/11).
- Rien de ce brouillon n'a été codé, essayé sur une base réelle ni envoyé à quiconque.

##### F569 · La règle du dépôt

Une fois le registre des tâches codé (F560), `AGENTS.md` dira : tout job planifié s'inscrit au registre, avec son rythme attendu, et un test échoue pour un déclencheur absent. Rien n'est ajouté à `AGENTS.md` avant, la règle n'étant pas encore tenue par un test.

#### 10 bis.11 · Précisions de la PR 1 : le registre des tâches attendues (20 novembre 2026, D-240, F600 à F607)

Écrites avec le code de la PR 1, en Opus 5.5 · Très élevé (ligne 4.5 de la roadmap). Elles précisent F560 et F569 sans rouvrir de décision. Les numéros D-240 à D-249, F600 à F639 et P50 à P54 sont réservés à la 4.5, pour ne pas croiser ceux de la 4.4 et des lots J et K, codés en même temps.

**F600 · Le registre, en code.** `lib/domain/operations/task-registry.ts` déclare **quatre tâches**, toutes lancées par le déclencheur du matin du planificateur (`15 4,5 * * *` en UTC, soit 6 h 15 à Paris) : les **prévisions**, la **réanalyse** (pluie estimée après coup), le **calcul du matin** (planning, eau des cultures, réserve du sol, séchage avant récolte) et la **rotation du coffre** des jetons. Chacune porte son nom, son rythme, ses deux seuils et leur raison, l'effet d'un manque et l'endroit où sa dernière réussite est gardée. Les autres tâches du tableau F560 entrent **avec le code qui les crée** : la lecture d'OTF par ferme avec la 4.3 (PR 4), la veille avec la PR 2, l'effacement avec la PR 3, la sauvegarde et l'export avec la PR 4, les purges avec la PR 5 ; rangée avant d'exister, une tâche serait « jamais réussie » chaque jour et la veille préviendrait pour rien. Le déclencheur de la **démonstration** (`17 2 * * *`, `wrangler.demo.jsonc`) est rangé **hors veille, avec sa raison** : elle a sa propre base, que la veille de la production ne lit pas, et aucune ferme ne dépend d'elle. Les **alarmes du Worker de notification** ne sont pas des déclencheurs planifiés (une par arrosage, sans rythme attendu) : elles ne sont pas des tâches du registre.

**F601 · Les seuils du matin : orange à 26 heures, rouge à 36.** Le tableau F560 proposait 30 heures pour l'orange. À 9 h, l'heure de la veille (F566), la réussite de la veille a 26 h 45 quand le 6 h 15 du jour a manqué : avec 30 heures, la veille ne l'aurait vu que le lendemain, déjà en rouge ; avec 26, elle le voit le matin même. Les deux heures de marge couvrent un matin plus lent et le jour de 25 heures du passage à l'heure d'hiver. Le rouge reste à 36 heures, le seuil de l'avertissement de la météo (D-165) : au moins un matin a manqué.

**F602 · Une exécution n'est réussie que si elle a tout fait.** Les **prévisions** et la **réanalyse** se comptent à part : chacune est réussie quand chaque lieu a reçu la sienne et qu'aucune ferme n'a été remise à plus tard par la limite du fournisseur. Le **calcul du matin** est réussi quand aucune ferme n'a échoué à aucune de ses quatre étapes. La **rotation du coffre** est réussie quand le coffre est endormi sans clé maîtresse (rien à chiffrer de nouveau, F368) ou quand chaque jeton se lit ; un jeton illisible, une clé illisible ou une erreur du coffre la rendent manquée. Une route interrompue enregistre ce qui a eu lieu, et le reste « interrompu avant la fin ». Une exécution qui trouve le verrou de la météo tenu n'enregistre rien : celle qui le tient le fera. **La réussite partielle n'existe donc pas** : la règle iv de F560 se lit « trois exécutions manquées de suite font une panne, même quand une réussite récente existe » (par exemple trois relances à la main qui échouent).

**F603 · L'état, calculé à la lecture** (`lib/domain/operations/task-state.ts`), dans cet ordre : trois exécutions manquées de suite, « en panne » ; aucune réussite gardée, « jamais réussie », en orange, jamais en vert ; sinon, l'âge de la **dernière réussite** : « ok » jusqu'au seuil orange compris, « en retard » jusqu'au seuil rouge compris, « en panne » au-delà. Une date illisible ne vaut pas réussite.

**F604 · Où c'est gardé, et ce qui ne l'est jamais.** Chaque tâche a sa ligne `task:<tâche>` dans `irrigation_background_jobs`, table commune déjà rangée dans `tests/support/space-coherence.ts`, à côté du verrou de la météo qu'elle ne touche pas. La migration 0037, additive, y ajoute le nombre d'exécutions manquées depuis la dernière réussite (`consecutive_failures`) et la fin de la première d'entre elles (`failing_since`, « en panne depuis »). Le **résumé d'un échec** est écrit par le module à partir de nombres et de classes d'erreur (« 1 lieu sur 1 sans pluie estimée (réseau) ») : jamais un message de fournisseur, une adresse, un nom de ferme ni une valeur (F354) ; le résultat de la synchronisation météo porte pour cela la classe de l'échec de chaque lieu, prévisions et réanalyse à part. Chaque tâche dit son matin au journal (`task_run_succeeded`, ou `task_run_failed` avec le résumé) : c'est la preuve d'un déploiement (R6). Un enregistrement impossible ne fait pas échouer le matin : il se journalise (`task_run_record_failed`, sans le message de la base) et la tâche, sans réussite nouvelle, passe en retard d'elle-même.

**F605 · La couverture des déclencheurs.** `tests/task-registry.test.ts` lit les configurations Wrangler de la racine et des Workers de `cloudflare/`, et échoue pour un déclencheur absent du registre, comme pour un déclencheur du registre absent des configurations ; ses sabotages (un déclencheur ajouté, un déclencheur dont l'heure change) le prouvent. Chaque tâche est sabotée à son tour (juste au-delà de l'orange, juste au-delà du rouge, jamais réussie, trois échecs de suite), et la panne du 14 novembre 2026 est rejouée sur la base de test : à 9 h le 14, la réanalyse est en retard ; le 15, en panne depuis le 14, pendant que les prévisions restent vertes.

**F606 · L'avertissement de la météo lit le registre.** Les 36 heures de D-165 sont le seuil rouge des prévisions au registre : l'écran de la ferme et la veille lisent le même nombre, à un seul endroit. Rien ne change à l'écran.

**F607 · La règle du dépôt (F569) est écrite** dans `AGENTS.md`, puisqu'un test la tient désormais.

[NON VÉRIFIÉ] Le premier matin réel après le déploiement : la preuve (R6) est le journal du matin suivant (une ligne `task_run_succeeded` ou `task_run_failed` par tâche), lu dans le tableau de bord de Cloudflare avec l'accord du porteur, ou la page d'état de la PR 2.

#### 10 bis.12 · Précisions de la PR 2 : la veille de l'exploitant et sa page d'état (20 novembre 2026, D-241, F608 à F613)

Écrites avec le code de la PR 2, en Opus 5.5 · Très élevé. Elles précisent F565 et F566 sans rouvrir de décision. La PR 2 du découpage (10 bis.6) se fait en **deux PR** : celle-ci, la veille, la notification et la page d'état des tâches ; la suivante, l'observation par ferme et le test des journaux (F564), qui ajoutent à la même page la ligne de chaque ferme.

**F608 · L'exploitant, et où le prévenir.** Le service de notification n'a pas d'adresse à part pour l'exploitant : ses appareils sont inscrits sous ses **espaces**, comme ceux de toute personne (F371). L'exploitant est donc **une personne dont l'espace est sur la ferme du déploiement** (la ferme de la clé, F339), lue là où elle est déjà gardée, **sans appel à OTF** (`knownDeploymentFarm`) ; jamais en démonstration. La veille envoie sa notification vers chaque espace de cette ferme ; aucun autre espace ne la reçoit (test à deux fermes). La page d'état se réserve de la même façon, côté serveur : pour toute autre personne, elle n'existe pas (404). Réponse au [À FAIRE] de F566 : pas de service nouveau, pas d'adresse nouvelle. [NON VÉRIFIÉ] Après la 4.3, un autre membre de la ferme du porteur sera lui aussi « exploitant » à ce titre ; à revoir avec la 4.6 si une ferme pilote partage la ferme du déploiement (ce n'est pas prévu).

**F609 · Une notification par jour au plus.** Le déclencheur `0 7,8 * * *` (9 h à Paris, distinct du matin, R5) appelle `POST /api/internal/operator-watch`, avec le jeton de service de la météo : aucun secret nouveau. La route lit le registre et décide : au moins une tâche **en retard, en panne ou jamais réussie**, une **alerte** ; rien à signaler le **dimanche** (jour de Paris), « **tout va bien** » ; rien les autres jours. La notification du jour est **prise** avant l'envoi dans `irrigation_operator_notices` (migration 0038, table commune : un jour, un genre, un nombre, des heures), **gardée** quand elle est partie, **rendue** quand l'envoi échoue, pour qu'une relance du jour réessaie ; une prise sans envoi de plus de cinq minutes est celle d'une veille coupée en route, et se reprend. Une panne qui dure ne renvoie donc rien le même jour, et repart le lendemain.

**F610 · Ce que dit la notification.** Elle tient dans les limites du service de notification (titre de 80 caractères, texte de 160, adresse `/irrigation/exploitation`), sinon elle serait refusée : un test vérifie chaque notification sabotée avec le validateur du service. Titre : « Module d'irrigation : une tâche en panne » (ou « en retard », « jamais réussie »), ou « N tâches à regarder ». Texte : les tâches, **la plus grave d'abord** (en panne, en retard, jamais réussie), chacune avec **depuis quand** : « en échec depuis le 14/11 à 6 h 16 » quand elle échoue, « aucune réussite depuis le … » quand elle ne tourne plus (une tâche qui ne tourne pas n'enregistre pas d'échec) ; autant de tâches que le texte en tient, puis « Et N autres. » ; pour une tâche seule, sa dernière erreur s'il reste la place. Les noms viennent du registre, les résumés de F604 : jamais un nom de ferme ni une valeur. **La veille ne se nomme pas elle-même** : quand elle tourne, elle est à l'heure, et quand elle ne tourne plus, c'est le dimanche manquant et la page d'état qui le disent ; sans cela, sa première exécution l'aurait annoncée « jamais réussie ».

**F611 · La veille est une tâche du registre.** `operator-watch` entre au registre avec son déclencheur (« Veille de l'exploitant », 1 par jour à 9 h, orange à 26 heures, rouge à 36). Elle est **réussie** quand elle a lu le registre et que la notification due, s'il y en avait une, est partie vers un appareil (`sent`) ou a été confiée au service qui la retente seul (`retrying`, douze essais au plus), ou était déjà partie ce jour-là. Elle est **manquée** avec une raison écrite par le module : « aucun appareil de l'exploitant inscrit aux notifications », « service de notification injoignable », « service de notification non configuré », « notification refusée par chaque appareil de l'exploitant », « ferme du déploiement inconnue », ou « interrompue avant la fin (erreur …) ». La route répond **200** dès que la veille a tourné, même manquée : une réponse 5xx ferait relancer la route trois fois par le planificateur, et trois échecs du même matin compteraient pour trois matins (R2). Journal : `operator_watch_completed` ou `operator_watch_failed` (genre de la notification, nombre de tâches, résumé), plus la ligne `task_run_succeeded` ou `task_run_failed` de la tâche, comme le matin (R6) ; jamais un identifiant d'espace, de ferme ou de personne (test).

**F612 · La page d'état, première part.** `/irrigation/exploitation` (titre « État du module »), où mène la notification : (1) **le jugement d'ensemble** en une ligne, sur un fond de couleur d'état et toujours en mots (« Tout va bien : les 5 tâches automatiques sont à l'heure. », « 1 tâche en panne, 2 en retard. », « 5 tâches jamais réussies. ») ; (2) **chaque tâche du registre**, la veille comprise, avec son état, sa dernière réussite (« aucune enregistrée » quand il n'y en a pas, jamais un vert), ses échecs de suite et depuis quand, son dernier résumé d'échec, son rythme attendu et l'effet d'un manque ; (3) **la dernière notification** de la veille. Un lien ramène au module (au téléphone, la barre du haut n'en a pas). Aucun appel à OTF, aucun contenu d'une ferme. Les autres parts de F565 viennent avec leur code : les fermes (PR suivante, F616), la sauvegarde (PR 4), les effacements (PR 3), les coûts (PR 5). La page n'est pas au menu des fermes : on y arrive par la notification, ou par son adresse (`docs/exploitation.md`, PR 5). Parcours **P50**, aux deux largeurs.

**F613 · Le planificateur.** Le Worker du planificateur porte les deux déclencheurs ; il n'exécute que celui qui tombe à l'heure de Paris (6 h 15 pour la météo, 9 h pour la veille), laisse 30 secondes à la veille, préfixe ses lignes `operator_watch_scheduler`, et garde un endpoint manuel `POST /run-watch` pour la recette (`docs/weather-scheduler-contract.md`).

[NON VÉRIFIÉ] La première veille réelle après le déploiement, et la **notification reçue en vrai** sur l'appareil de l'exploitant (10 bis.7, recette avec l'accord du porteur). Si l'appareil du porteur n'est pas inscrit aux notifications, la veille est manquée avec la raison écrite, et la page d'état le montre.

#### 10 bis.13 · Précisions de la PR 2, seconde partie : l'observation par ferme et les journaux sans donnée sensible (20 novembre 2026, D-242, F614 à F618)

Écrites avec le code, en Opus 5.5 · Très élevé. Elles précisent F564 et F565 sans rouvrir de décision : ce que la page d'état montre de chaque ferme, et le test qui prouve qu'aucun journal ne porte de valeur sensible.

**F614 · Chaque appel envoyé à OTF est compté.** Le connecteur dit au compteur partagé (F361) ce qu'est devenu chaque essai envoyé : réussi, `401`, `403`, `429`, `5xx`, autre refus, délai dépassé, réseau. Un `5xx` retenté puis réussi fait une erreur et une réussite ; une réponse reçue dont le corps se lit mal reste une réponse reçue, comptée par son statut ; un appel que le régulateur ou la base n'a pas laissé partir ne compte pas, puisque rien n'est parti. La base les compte par ferme, par heure pleine et par résultat (`otf_call_outcomes`, migration 0039, table commune : la clé du compteur, une heure, un résultat, un nombre), huit jours ; les heures plus vieilles partent au passage. Un compte impossible n'arrête pas la lecture (`otf_call_outcome_not_recorded`, avec la classe de l'erreur). Chaque échec se journalise sous le nom stable **`otf_call_failed`**, avec ses seuls champs : la route, l'essai, la classe (`outcome`), le statut quand il y en a un, la durée ; jamais l'adresse complète, la ferme ni le jeton. La ferme d'un échec se lit sur la page d'état, qui reste dans le module, pas au journal. Ces comptes sont des données techniques de la ferme, sans contenu : la politique de confidentialité les dira avec les autres durées de conservation, dans la PR 5 (F562), dont le texte passe par la relecture du porteur.

**F615 · La dernière lecture complète.** `otf_farm_reads` garde l'heure de la dernière lecture complète de chaque ferme (`last_complete_at`, même migration, colonne nulle) : celle d'une lecture qui a tout lu ; une lecture coupée ne la retire pas. Elle tient lieu de « dernière synchronisation réussie avec OTF » de F564.

**F616 · Les fermes sur la page d'état** (troisième part de F565). Une carte par ferme : chaque identifiant d'Ouvre ta ferme porté par un espace, un raccordement ou des appels comptés ; la ferme de la clé du déploiement, **toujours présente**, même sans rien d'enregistré (son absence cacherait qu'elle n'est jamais lue) ; les appels de la clé avant que sa ferme soit connue (`GET /me`), sur une carte à part. Chaque carte dit :

- le **raccordement** : lue avec la clé du déploiement, reliée par sa personne, révoquée par OTF (à relier de nouveau), hors d'usage (OTF refuse la lecture), ou pas reliée ;
- les **appels du jour** (F363) : leur nombre, et que la part du quota de la ferme laissée au module n'est pas encore fixée ; la consommation sur cette part viendra quand elle le sera ;
- les **erreurs d'OTF sur 24 heures** (l'heure en cours et les 23 d'avant) et **sur 7 jours** : « 1 erreur sur 10 appels (10 %) : 1 délai dépassé », la plus fréquente d'abord ;
- la **dernière lecture complète** d'OTF, la **dernière météo automatique** réussie de ses espaces, le **dernier calcul du matin** de ses espaces, attendu seulement si le Planning est coché sur l'un d'eux (les autres n'en reçoivent pas, 3.8, R1).

Le jugement d'une carte : **rouge** pour un raccordement révoqué ou hors d'usage, pour des erreurs qui font au moins la moitié des appels des 24 heures, ou pour un âge au-delà du rouge ; **orange** pour une erreur dans les 24 heures, une ferme pas reliée, un âge au-delà de l'orange, ou une réussite jamais enregistrée ; jamais un vert qui cache un manque. Les âges se jugent avec les seuils du registre (F600) : la lecture d'OTF et le calcul du matin avec ceux du calcul du matin, qui lit la ferme chaque matin ; la météo avec ceux des prévisions. Les cartes se rangent **la plus en difficulté d'abord**, puis par nombre de problèmes, puis par identifiant ; chacune dit ses problèmes en une ligne. Le jugement d'ensemble compte les fermes (« 1 tâche en panne ; 1 ferme en difficulté, 2 à regarder. ») : jamais « Tout va bien » quand une ferme est à regarder. Des identifiants, des états, des heures et des nombres : jamais un nom de ferme (le raccordement le garde, la page ne le lit pas) ni une personne (test à deux fermes). **L'état de l'accueil** (4.4-a) entre sur la carte avec la fusion de la 4.4, dont le code n'est pas encore sur `main`. Parcours P50 étendu, aux deux largeurs.

**F617 · Les journaux, sans donnée sensible : le test.** Le garde des essais (`tests/support/log-guard.mjs`, chargé par chaque processus de `pnpm test`, isolation comprise) lit chaque ligne écrite dans la console pendant les essais, **y compris celles d'une console remplacée par un essai** (les essais d'OTF le font), et fait échouer le fichier qui en écrit une qui ressemble à un jeton (JWT, en-tête `Bearer`, champ secret avec sa valeur), à un paramètre d'autorisation (`code=`, `state=`, `code_verifier=`…), à une adresse de retour (`/oauth/retour?`), à une adresse électronique, à un nom de ferme ou à une longue chaîne opaque (`tests/support/log-safety.mjs`) ; le message d'échec dit la nature de la valeur et la ligne. Un essai témoin (`tests/log-safety.test.ts`) prouve chaque motif sur une valeur piégée, laisse passer les lignes réelles du module, vérifie que le garde voit une console remplacée, et nourrit les chemins d'échec du connecteur de valeurs piégées (jeton, nom de ferme, adresse électronique dans les réponses d'OTF et les erreurs de la base). **Il a trouvé un défaut, corrigé ici** : quatre lignes recopiaient le message d'une erreur de la base (`otf_pause_not_recorded`, `otf_authentication_failure_not_recorded`, `otf_farm_read_not_released`, et `otf_farm_identity_unreadable` pour une erreur autre que celles du connecteur, dont le module écrit le message) ; elles disent désormais sa classe. Sur toute la suite, aucune autre ligne sensible.

**F618 · Les noms stables.** `otf_call_failed` est nouveau (F614). `backup_failed` et `erasure_step` viennent avec les PR 4 et 3. Pour la météo et le calcul du matin, le nom stable existe depuis la PR 1 : `task_run_failed`, une ligne par tâche avec son résumé écrit par le module (F604), à côté des lignes de chaque étape ; aucun nom de plus n'est ajouté pour eux.

[NON VÉRIFIÉ] Les premiers comptes réels : après le déploiement, la carte de la ferme du porteur se remplit au premier matin (lecture de 6 h 15, météo, calcul) ; lu sur la page d'état, avec l'accord du porteur.

#### 10 bis.14 · Précisions de la PR 4, première partie : l'export hebdomadaire chiffré et son contrôle (20 novembre 2026, D-243, F620 à F626)

Écrites avec le code, en Opus 5.5 · Très élevé. Elles précisent F561 et la décision 10 bis.9 sans rouvrir de décision. La PR 4 du découpage (10 bis.6) se fait en **deux PR** : celle-ci, les commandes de l'export et du contrôle, la tâche du registre et le geste de la page d'état, tout ce qui s'essaie sans toucher à Cloudflare ; la suivante, l'essai des trois scénarios S1, S2 et S3 sur la base d'essai `module-irrigation-otf-essai-restauration`, qui attend le « vas-y » du porteur pour créer cette base chez Cloudflare (règle des actes chez Cloudflare).

**F620 · Le chiffrement.** `scripts/backup/export-crypto.ts` : AES-256-GCM, la clé tirée du mot de passe par scrypt (N = 2^17, r = 8, p = 1 : environ 128 Mo et une demi-seconde par essai), un sel et un vecteur neufs à chaque export. Le fichier est une ligne d'en-tête (le format, sa version, les réglages de scrypt, le sel, le vecteur ; rien de la base), puis le contenu chiffré et son étiquette ; l'en-tête est authentifié avec le contenu : **un octet changé, dans l'en-tête ou dans le contenu, et le fichier est refusé**. Un en-tête qui demanderait à scrypt plus que N = 2^20, r = 16 ou p = 4 est refusé avant tout calcul. Le mot de passe : **12 caractères au moins**, tapé **deux fois** à l'identique, **sans écho, au clavier seulement** (refusé hors d'un terminal : jamais par un argument, une variable d'environnement ou un tuyau, qui resteraient dans l'historique) ; la même phrase tapée sur un autre clavier (accents composés ou non) est la même. Il n'est gardé nulle part : sans lui, l'export est illisible, même pour le porteur.

**F621 · Le contrôle d'un export.** `scripts/backup/export-inspection.ts` rejoue l'export, en mémoire, dans une base vide, comme une restauration, puis dit s'il restaurerait la base **fidèlement** : (1) il se rejoue jusqu'au bout, contraintes de chaque table comprises ; (2) la base obtenue est intègre (`integrity_check`) et ses clés étrangères désignent des lignes (comptées par table : les clés se contrôlent après coup, pour dire où, au lieu de s'arrêter à la première) ; (3) son schéma (tables, colonnes avec leur type, `NOT NULL` et clé primaire, index, déclencheurs, vues) est celui que donnent **les migrations du dépôt qu'elle dit avoir reçues** (`d1_migrations`) : une table retirée, une colonne en moins, une migration oubliée ou non inscrite se voient ; une base qui n'a pas encore reçu la dernière migration du dépôt reste bien sauvegardée (le site n'est pas encore à jour) ; une base qui a reçu une migration que le dépôt ne connaît pas demande de mettre le dépôt à jour ; (4) chaque table a son **nombre de lignes et une empreinte** de son contenu (SHA-256 des lignes, colonnes et lignes rangées : indépendante de l'ordre, sensible à chaque valeur et à une ligne en double), et la base une empreinte d'ensemble : deux bases se comparent table par table sans rien afficher (« irrigation_events : 12 lignes attendues, 11 trouvées », « même nombre de lignes, contenu différent »). C'est la comparaison des scénarios S1 et S2. Les problèmes se disent avec des noms de tables, de colonnes et de contraintes, **jamais avec une valeur**. **Sabotages prouvés par les essais** (`tests/backup-export.test.ts`) : une table retirée, une ligne qui heurte une contrainte, une valeur changée et une ligne retirée (trouvées par l'empreinte), une migration oubliée (que la base dise l'avoir reçue ou non), une ligne orpheline, un export coupé en route, un export sans sa liste de migrations ; sur un vrai export de la base locale des parcours (88 tables, 665 lignes, 37 migrations), aucun problème.

**F622 · L'export ne touche jamais le disque en clair** (ce que promet 10 bis.9). `wrangler d1 export` écrit l'export dans le fichier de `--output`. `scripts/backup/wrangler-export.ts` lance Wrangler comme sa propre commande le fait, avec un module chargé dans son processus (`capture-wrangler-export.mjs`) qui détourne cette écriture : l'export part, en mémoire, par le canal du processus parent ; rien n'est écrit. Le chemin convenu est dans un dossier qui n'existe pas : si une version future de Wrangler écrit autrement et que le détour ne joue plus, son écriture échoue, au lieu de poser l'export en clair ; la commande le dit (« Wrangler a fini sans remettre d'export ») et s'arrête. Les octets reçus sont comptés contre ceux annoncés. Ce que Wrangler écrit à l'écran est relayé ligne par ligne, **chaque adresse masquée** : Wrangler affiche l'adresse de téléchargement de l'export, qui l'ouvre à quiconque l'a pendant une heure. La confirmation de Wrangler (la base ne répond plus pendant l'export) est dite par la commande, avant le mot de passe : à faire le soir, loin de 6 h 15 et de 9 h (10 bis.8). Essayé avec le vrai Wrangler 4.154 sur la base locale : l'export arrive entier, aucun fichier n'est écrit. Le contenu en clair est effacé de la mémoire de la commande dès qu'il est chiffré et relu.

**F623 · Les commandes et le fichier.** `pnpm backup:export` (F561, point 7) : le mot de passe, l'export reçu en mémoire, son contrôle (F621), le fichier chiffré, puis **le fichier relu et déchiffré**, comparé à l'export reçu à l'octet près (empreinte SHA-256). Le fichier va **hors du dépôt**, par défaut dans « Sauvegardes module irrigation » du dossier personnel (`--dossier` pour un autre) : un dossier dans le dépôt est refusé, même atteint par un lien (le dépôt est public : un `git add` de trop publierait l'export, même chiffré). Son nom porte la date et l'heure de Paris (`module-irrigation-export-2026-11-20-21h30.chiffre`) ; il n'écrase jamais un export précédent ; il n'est lisible que par la personne de l'ordinateur. `pnpm backup:verify <fichier>` déchiffre un export, en mémoire, et le contrôle de la même façon : après une mise à jour du dépôt, avant de compter sur un vieil export, ou pour s'assurer qu'on se souvient du mot de passe. Leurs sorties ne disent que des nombres, des noms de migrations, une empreinte abrégée, la taille du fichier et la durée de l'export (mesurée pour 10 bis.8), jamais une donnée : un problème se transmet à l'assistant tel quel. Un export qui ne restaurerait pas fidèlement est tout de même gardé (c'est ce que Cloudflare a rendu), mais la commande échoue et dit de ne pas le noter. Aucun secret en dur : Wrangler se sert de la connexion du porteur (`pnpm exec wrangler login`, qu'il fait lui-même). La procédure, pas à pas, est dans `docs/exploitation.md` (section « Export hebdomadaire hors de Cloudflare »), que la PR 5 complète (4.5-h).

**F624 · La tâche du registre et la veille.** « Export de la base hors de Cloudflare » entre au registre (F560) : **une fois par semaine, orange à 8 jours, rouge à 10**, avec leur raison (l'historique de 30 jours de Cloudflare ne protège pas d'une perte du compte : seule cette copie le fait). C'est la première tâche **faite à la main** : aucun déclencheur ne la lance (`operator-gesture` au lieu d'un déclencheur, le test de couverture des déclencheurs l'accepte, et elle seule) ; sa dernière réussite est la ligne `task:offsite-export` de `irrigation_background_jobs`. La veille de 9 h la surveille comme les autres : un export oublié ou jamais fait déclenche l'alerte (« Export de la base hors de Cloudflare : en retard (aucune réussite depuis le 11/11 à 21 h 30). »). **Avant le premier export noté, la page d'état et la veille la disent « jamais réussie », en orange** : c'est le rappel voulu. Le registre comptant désormais une tâche faite à la main, le jugement d'ensemble dit « les 6 tâches » au lieu des « 5 tâches automatiques » de F612, et la liste de la page s'intitule « Tâches ». La ligne « Sauvegarde » de F560 (une par semaine, nouvelle) n'entre pas au registre : c'est **Time Travel**, que Cloudflare tient sans cesse, sans tâche du module à surveiller ; sa preuve est le scénario S1 (PR suivante). Pour la même raison, le nom stable `backup_failed` annoncé par F618 n'est pas créé : aucune sauvegarde ne tourne dans le Worker, et l'export du porteur dit ses échecs à son écran ; son absence se voit à la tâche du registre.

**F625 · Le geste « J'ai fait l'export du … ».** Sur la carte de l'export, à la page d'état : le jour de l'export (aujourd'hui par défaut, à l'heure de Paris, jusqu'à 30 jours avant) et le bouton « Noter l'export ». Réservé à l'exploitant, le droit lu côté serveur (F608). Le jour même compte à l'heure du geste, un jour passé à midi (temps universel) ; un jour à venir, de plus de 30 jours, mal écrit, déjà noté ou **plus ancien que l'export déjà noté** est refusé, avec sa raison en mots : la dernière réussite ne recule jamais. La réponse remet toute la page à jour (la carte passe « À l'heure », le jugement d'ensemble le compte). Le journal ne dit que le jour (`offsite_export_recorded`). La carte mène à la procédure (`docs/exploitation.md`). Parcours **P50 étendu**, aux deux largeurs.

**F626 · Ce qui reste pour la PR suivante.** Les scénarios S1 (revenir en arrière avec Time Travel, et le rattrapage d'une seule ferme), S2 (reconstruire depuis un export, puis les tests d'isolation contre la base restaurée) et S3 (perdre la clé du coffre), **joués sur la base d'essai** remplie de données fictives, avec leurs comparaisons table par table collées dans la PR, puis la base détruite ; le script `pnpm backup:rehearse` (F561, point 7) ; la procédure de restauration depuis un export, écrite d'après l'essai. Une précision pour S2, lue dans le format de l'export : il porte **son propre schéma** (ses `CREATE TABLE`) et sa liste de migrations ; il se rejoue donc dans une base **vide**, sans appliquer les migrations avant (elles créeraient les tables une première fois) ; les migrations plus récentes s'appliquent après, comme à l'ordinaire. Aucune action chez Cloudflare n'est faite avant le « vas-y » du porteur.

[NON VÉRIFIÉ] Un export de la base en ligne : le premier se fera par le porteur, sur son ordinateur (Windows), avec la procédure ; sa sortie (des nombres, sans donnée) dira la durée réelle de l'export et confirmera le détour avec la base en ligne, qui passe par un téléchargement au lieu de l'écriture directe de la base locale (les deux chemins sont couverts par les essais, le premier avec un faux Wrangler).

#### 10 bis.15 · Précisions de la PR 4, seconde partie : l'essai de restauration et la restauration depuis un export (20 novembre 2026, D-244, F627 à F635)

Écrites avec le code, en Opus 5.5 · Très élevé. Elles précisent F561 et F626 sans rouvrir de décision. Le script est écrit et joué contre une fausse D1 en mémoire ; **l'essai chez Cloudflare attend le « vas-y » du porteur** (règle des actes chez Cloudflare) : ce qui suit dit ce que l'essai fera et ce que la simulation a montré, jamais ce que Cloudflare a répondu.

**F627 · Les bases d'essai et leurs gestes.** `pnpm backup:rehearse --cloudflare` crée, remplit puis détruit **trois bases**, toutes nommées à partir de `module-irrigation-otf-essai-restauration` : la base d'essai (S1), la base reconstruite (`…-reconstruite`, S2) et la base où l'export est essayé brut (`…-export-brut`, S2). Les gestes (`scripts/backup/d1-operations.ts` : exister, créer, remplir, lister les tables, exporter, signet présent, signet d'un instant, revenir à un signet, détruire) **refusent tout autre nom avant d'appeler Wrangler** : la base des fermes et celle de la démonstration ne peuvent pas être touchées, même par une erreur de saisie. Wrangler est lancé depuis un dossier vide, sans fichier de réglages : un nom n'y désigne que la base de ce nom, jamais une liaison du module ; la création ne touche pas `wrangler.jsonc` (`--update-config=false`). Une base restée d'un essai interrompu est détruite avant de commencer ; à la fin, réussi ou non, chaque base est détruite et l'essai vérifie qu'aucune n'existe plus. L'essai se lance par le flux « Essai de restauration » de GitHub Actions (`.github/workflows/essai-restauration.yml`), à la main ou en poussant la branche `essai-restauration`, **jamais sur une PR** ; il se sert du jeton d'API et de l'identifiant de compte déjà posés pour le déploiement, donnés à la seule étape de l'essai (pas à l'installation des dépendances), et ne publie aucun artefact. Les journaux du flux sont publics : les lignes de Wrangler y passent **adresses et identifiants masqués** (compte, bases).

**F628 · Les données fictives.** Deux fermes, A (« Ferme v2 » n° 4394, en copie fictive) et B (n° 9001), **écrites par les dépôts du module** dans une base migrée en mémoire : l'espace, un goutte-à-goutte avec son réglage et sa pose, des irrigations faites (3 pour A, 2 pour B), et un raccordement à Ouvre ta ferme dont les jetons, fictifs, sont chiffrés par **une clé de coffre tirée pour cet essai seulement**. La clé et les jetons ne quittent jamais la mémoire : l'essai garde leur empreinte, et vérifie à la fin qu'ils ne paraissent en clair **ni dans un des exports, ni dans le journal du coffre, ni dans le compte rendu** (un compte rendu qui en citerait un est remplacé par ce seul constat). La base fictive est envoyée rangée pour l'import (F631), puis exportée (T0) : l'export T0 doit être identique aux données envoyées, table par table.

**F629 · S1, tel qu'il est joué.** Le signet de T0 est noté, avec son instant ; dix secondes après, le dégât : les irrigations de la ferme A et les lignes qui en dépendent (clés étrangères déclarées), **les dépendantes d'abord**, rien de la ferme B (T1). Restauration au signet noté (T2, identique à T0 table par table), puis **retour au signet d'avant** que la restauration a rendu (T3, identique à l'état abîmé T1). La finesse de Time Travel (10 bis.10) est mesurée sans risquer le scénario : l'essai demande à Cloudflare le signet de l'instant noté et dit s'il est celui qui a été noté.

**F630 · Le rattrapage d'une seule ferme** (précise F561, point 4). D1 ne restaure que sur place : « restaurer sur une copie » se fait donc en **trois gestes rapides**, signet présent noté, restauration à l'instant d'avant l'erreur, export de cet état (en mémoire : c'est la copie), puis retour au signet noté. Pendant ces quelques secondes, la base montre l'état d'avant et **une écriture d'une ferme serait perdue** : en vrai, le soir, loin de 6 h 15 et de 9 h, avec l'assistant, sur la décision du porteur. Les lignes de la ferme présentes dans la copie et **absentes de l'état présent, par leur clé primaire**, sont réinsérées, chaque table après celles qu'elle désigne ; **une ligne encore présente n'est jamais réécrite** : si elle a changé depuis, elle est dite (table, nombre, colonnes), pour décider avec le porteur. L'espace d'une ligne est celui du contrôle de cohérence (F380) ; les tables communes ne sont d'aucune ferme ; les lignes d'une autre ferme ne sont jamais lues. **Leçon de la simulation** : les déclencheurs des tables d'irrigation font avancer le compteur de révision de l'espace (`feasibility_revision`) à chaque ligne effacée ou réinsérée, et ses déclencheurs de garde refusent qu'on le réécrive. Après le rattrapage, la ferme A est donc identique à T0 **ligne pour ligne, ses compteurs de révision exceptés**, qui ont avancé et jamais reculé : les calculs faits sur l'état abîmé restent tenus pour périmés, comme il faut. La ferme B a **la même empreinte** avant et après ; la base entière est identique à T0, sauf la ligne d'espace de la ferme A.

**F631 · S2, tel qu'il est joué, et l'import rangé.** **Leçon de la simulation** : l'export de D1 (son code, lu dans Miniflare) range les tables **dans l'ordre de leur création** ; une table refaite par une migration plus récente (`irrigation_equipment_settings`, par exemple) vient après les tables qui la désignent. Dans une base aux clés étrangères actives, comme D1, insérer une ligne dans une table qui en désigne une autre pas encore créée échoue (« no such table »), même avec les clés différées : **l'export brut ne se réimporterait pas tel quel**. L'import est donc **rangé** (`restorableDump`) : toutes les tables d'abord, puis les lignes, chaque table après celles qu'elle désigne, puis les compteurs, enfin les index, déclencheurs et vues (rejouer les lignes ne déclenche rien). L'essai essaie aussi l'export brut, dans sa propre base, et écrit la réponse de D1, pour information. La reconstruction (`scripts/backup/restore-import.ts`, le même geste que la vraie restauration, F634) : l'export contrôlé (F621), une base **neuve et vide**, l'import rangé, puis la base reconstruite exportée à son tour et comparée, table par table (T5, identique à T4). « Migrations appliquées » (F561) : l'export porte son schéma et sa liste de migrations, le contrôle prouve qu'elle est celle du dépôt ; une migration plus récente s'appliquerait après, comme à l'ordinaire. **Les tests d'isolation à deux fermes contre la base restaurée** : ceux de la suite créent leurs propres espaces dans une base neuve ; contre la base reconstruite, la même preuve est jouée sur ses deux fermes, la copie branchée sous les vrais dépôts : le contrôle de cohérence (F380, aucune ligne ne désigne une ligne d'une autre ferme), puis, pour chaque ferme, les dépôts lisent son matériel et ses irrigations et rien de l'autre ; la même personne sur l'autre ferme ne lit rien ; l'autre personne ne lit pas son raccordement.

**F632 · S3, tel qu'il est joué**, sur la base reconstruite. Avec la bonne clé, les jetons des deux fermes se lisent, identiques (comparés par empreinte). **Clé perdue, une neuve posée** : le passage du matin compte les deux raccordements illisibles, et chaque ouverture répond « la ferme doit être reliée de nouveau » (F400 ; le passage en « reconnexion demandée » est celui de la PR 3 de la 4.3, F358). Ce que F561 appelle « hors d'usage » est, dans le code, ce cas de la clé inconnue ; « hors d'usage » y désigne un secret posé mais illisible (F398). **Sans clé** : le coffre est endormi, le passage du matin ne touche à rien. La bonne clé retrouvée, tout se lit encore. Aucun de ces essais n'efface ni ne réécrit une ligne (même empreinte avant et après), et le journal du coffre ne contient ni la clé ni un jeton.

**F633 · Le compte rendu et la simulation.** Une ligne par contrôle (✓ ou ✗), puis **le tableau des comparaisons, table par table**, à chaque état (T0 noté, T1 abîmé, T2 restauré, T3 retour, T4 rattrapé, T5 reconstruit) : le nombre de lignes, « ≠ » quand le contenu diffère de T0, l'empreinte d'ensemble abrégée ; les tables vides partout sont comptées sans être montrées ; la durée de chaque export. Rien d'autre : des noms de tables, des nombres, des empreintes. Il va sur la sortie standard et dans le résumé du flux ; la commande échoue si un contrôle échoue. Sans `--cloudflare`, `pnpm backup:rehearse` joue **la simulation** contre la fausse D1 (`scripts/backup/memory-d1.ts`) : clés étrangères actives, un fichier joué d'un bloc, l'export de D1 copié de son code, un signet par état. **Sabotages prouvés par les essais** (`tests/backup-rehearsal.test.ts`) : une restauration qui ne restaure pas, un export qui oublie une table, un import qui perd une ligne, une autre clé que la bonne, une irrigation de A qui désigne le matériel de B, une base qui n'est pas vide, un export infidèle, un autre nom de base ; chacun fait échouer l'essai ou est refusé, et les bases sont détruites quand même.

**F634 · Restaurer depuis un export (base perdue).** `pnpm backup:restore <fichier .chiffre> --base <nom>` : le mot de passe, l'export déchiffré en mémoire et contrôlé, puis la reconstruction de F631 dans **une base neuve ou vide** (créée si elle n'existe pas ; **une base qui a des tables est refusée, jamais écrasée** : aucune base en service ne peut être remplacée par ce geste), et la comparaison table par table. **Une exception au « jamais en clair sur disque » de F622, bornée** : `wrangler d1 execute --remote` ne lit qu'un fichier ; l'import rangé y est écrit le temps de l'envoi, dans un dossier privé de l'ordinateur, effacé aussitôt, même en cas d'échec (les données partent alors chez Cloudflare, où elles vont être remises). La suite se fait avec l'assistant et sur la décision du porteur : brancher le module sur la base reconstruite (une PR qui change la base de `wrangler.jsonc`, puis le déploiement, qui applique les migrations plus récentes), poser **la même clé du coffre** (sinon chaque ferme se relie de nouveau, S3), regarder la page d'état. La procédure, pas à pas : `docs/exploitation.md`.

**F635 · Ce qui attend le « vas-y » du porteur.** L'essai chez Cloudflare, puis son compte rendu **collé dans cette PR** ; la réponse de D1 aux points non établis (10 bis.10) : la finesse de Time Travel, l'export brut réimporté ou non, la restauration d'une base aux migrations récentes, la durée d'un export ; `docs/exploitation.md` mise à jour d'après lui. Puis, dans une PR à part : l'essai **inscrit au registre** (une fois par trimestre et après un changement de schéma important, 10 bis.8) et sa date sur la page d'état (F565, point 4), par un geste « J'ai fait l'essai du … » comme celui de l'export.

**Ce que l'essai chez Cloudflare a répondu (20 novembre 2026, sur le « vas-y » du porteur).** Joué par le flux « Essai de restauration », sur les trois bases d'essai, détruites à la fin ; son compte rendu est collé dans la PR. **Réussi** : chaque contrôle de S1, S2 et S3 passe, chaque comparaison table par table rend l'état attendu (T2 = T0, T3 = T1, T4 = T0 sauf les compteurs de révision de la ferme A, T5 = T4). Les points de 10 bis.10 : (1) **la restauration à un signet noté marche**, et rend le signet d'avant, qui permet d'y revenir ; **le signet d'un instant** (`time-travel info --timestamp`), lui, n'a pas été rendu : deux fois sur deux, « erreur interne » de l'API (code 7500), sur une base créée une minute avant. La finesse n'est donc pas mesurée ; sur la vraie base, plus ancienne, le signet de l'instant se demande d'abord, sans rien changer, avant toute restauration (`docs/exploitation.md`). (2) **L'export brut ne se réimporte pas**, comme la simulation l'avait dit : D1 répond « no such table: main.irrigation_equipment_settings » ; l'import rangé, lui, reconstruit la base à l'identique. (3) **Une base aux migrations récentes se restaure** : 37 migrations reçues, la dernière `0036_otf_call_outcomes.sql`, numéro d'alors (aujourd'hui `0039_otf_call_outcomes.sql`). (4) **Un export dure 2,3 à 2,6 secondes** pour 705 lignes (la base d'essai ; la vraie est plus grosse, sa durée se lira au premier export du porteur). Un premier passage s'était arrêté sur ce signet d'un instant : sa mesure ne devait pas arrêter le scénario ; elle se dit désormais en une note, et les lignes de Wrangler masquent aussi la référence d'une requête, que Cloudflare donne avec une erreur.

#### 10 bis.16 · Précisions de la PR 4, troisième partie : l'essai de restauration au registre (20 novembre 2026, D-245, F636 et F637)

Écrites avec le code, en Opus 5.5 · Très élevé. Elles précisent F565 (point 4) et 10 bis.8 sans rouvrir de décision : ce que F635 renvoyait à une PR à part.

**F636 · La tâche « Essai de restauration » au registre** (F560). **Une fois par trimestre, orange à 100 jours, rouge à 120**, avec leur raison : un trimestre et neuf jours de marge, puis quatre mois, le trimestre manqué ; une sauvegarde dont la restauration n'est pas essayée peut ne rien rendre le jour où il le faut (10 bis.8). C'est la seconde tâche **faite par l'exploitant** (`operator-gesture`, comme l'export, F624) : aucun déclencheur ne la lance, le flux « Essai de restauration » la joue sur son « vas-y » ; sa dernière réussite est la ligne `task:restore-rehearsal` de `irrigation_background_jobs`. La veille de 9 h la surveille comme les autres (« Essai de restauration : en retard (aucune réussite depuis le 10/08 à 14 h 00). »). **Avant le premier essai noté, elle est « jamais réussie », en orange** : le premier essai chez Cloudflare (20 novembre 2026, 10 bis.15) se note donc dès cette PR en ligne. Le jugement d'ensemble dit « les 7 tâches ». **« Après un changement de schéma important »** (10 bis.8) ne se devine pas : une PR qui refait une table ou change ses clés étrangères le dit, et l'essai se rejoue avant sa fusion ; le rythme de la tâche le rappelle.

**F637 · Le geste « J'ai fait l'essai du … ».** Sur la carte de l'essai, à la page d'état, comme celui de l'export (F625) et avec les mêmes règles : le jour (aujourd'hui par défaut, à l'heure de Paris, jusqu'à 30 jours avant), le bouton « Noter l'essai » ; réservé à l'exploitant, le droit lu côté serveur (F608) ; un jour à venir, de plus de 30 jours, mal écrit, déjà noté ou plus ancien que l'essai déjà noté est refusé, avec sa raison en mots ; la réponse remet toute la page à jour. La carte mène à la procédure (`docs/exploitation.md`, « L'essai de restauration »). Le journal ne dit que le jour (`restore_rehearsal_recorded`). Les deux gestes sont **un seul code** (`lib/domain/operations/operator-gesture.ts`) : chaque tâche faite par l'exploitant au registre a son geste, et un test échoue pour une tâche sans geste ou un geste sans tâche ; la tâche venue du navigateur est relue côté serveur, et seule une tâche faite par l'exploitant se note. La sauvegarde de la page d'état (F565, point 4 : « date du dernier export réussi, date du dernier essai de restauration ») est ainsi dite par les deux cartes, leur dernière réussite en tête. Parcours **P50 étendu**, aux deux largeurs.

#### 10 bis.17 · Précisions de la PR 3, première partie : l'effacement d'une ferme, le moteur et ses preuves (20 novembre 2026, D-246, F640 à F648)

Écrites avec le code, en Opus 5.5 · Très élevé. Elles précisent F563 et F565 (point 5) sans rouvrir de décision. **Numéros** : la 4.5 prend aussi F640 à F659 (F640 à F648 ici ; la suite pour la seconde partie et la PR 5), F600 à F639 ne suffisant plus.

**La PR 3 en deux.** Cette première partie pose le moteur : la note de la demande, le plan table par table, la tâche du matin qui efface, le gel des traitements du matin, la ligne de la page d'état et les preuves de F563. La **seconde partie**, après la chaîne de la 4.4 (qui touche « Réglages »), pose ce que la personne voit : la demande dans « Réglages » (« Supprimer ma ferme et mes données », après avoir tapé le nom de la ferme, avec ce qui disparaît, ce qui reste 30 jours dans l'historique, et le retrait de l'autorisation par un administrateur dans Ouvre ta ferme), l'annulation, l'écran de l'espace figé (aucun appel à OTF, aucune saisie), l'oubli des abonnements de notification de l'espace par le Worker de notification, et l'effacement immédiat sur demande écrite à l'exploitant. **Tant que la seconde partie n'est pas en ligne, aucune demande ne peut naître en production** : la tâche du matin réussit chaque jour sans rien faire.

**F640 · La note de la demande, seule à rester.** Table `irrigation_farm_erasures` (migration 0040) : un identifiant, l'identifiant interne de l'espace (**sans clé étrangère** : l'espace disparaît), l'état (`pending` en attente, `erasing` en cours, `erased` faite, `cancelled` annulée), l'heure de la demande, l'heure à partir de laquelle elle s'efface (**la demande plus 7 fois 24 heures**), et les heures d'annulation, de début et de fin, chacune liée à son état par une contrainte. **Ni nom, ni personne, ni ferme, ni contenu.** Une seule demande ouverte par espace : une seconde demande rend la première, sans la repousser ni l'avancer. Annulable **tant que l'effacement n'a pas commencé** ; une nouvelle demande reste possible après une annulation.

**F641 · Le plan, table par table.** `db/farm-erasure-plan.ts` range **chaque table de la base** dans une liste et une seule : les tables d'un espace, **les filles avant leurs mères** (D1 garde les clés étrangères actives), l'espace lui-même en dernier ; les tables communes qui gardent des lignes d'un espace ou de sa ferme, avec leur règle (F642) ; les tables qui restent, **chacune avec sa raison**. Une table sans `workspace_id` s'efface par la ligne qu'elle complète, comme le contrôle de cohérence des espaces la range (F380). C'est la liste réelle que 10 bis.10 renvoyait au code.

**F642 · Ce que les tables communes gardent d'un espace.** Les **instantanés** sous sa clé d'espace (chaque saison, et la clé d'avant le plan de culture) ; ceux **de la même ferme** gardés sous la personne seule avant le rattachement (F343) partent aussi, sauf si la personne a encore un espace sans ferme, à qui ils sont. Le **raccordement à Ouvre ta ferme et ses jetons** (la ligne du coffre) partent si la personne l'a fait, ou si aucun autre espace ne garde la ferme ; fait par une autre personne de la même ferme, il reste à elle. Le **journal des appels** (départs, appels du jour, résultats par heure, pauses, bail de lecture) compte les appels de la ferme pour tous ses espaces : il part **avec le dernier espace de la ferme**. **Restent** : la note de la demande ; les exécutions des tâches ; la notification du jour de la veille ; les seuils de gel communs ; la ferme de la clé du déploiement (un réglage du déploiement, réécrit à chaque lecture) ; les refus d'authentification du module entier. Les clés des instantanés sont écrites une fois (`lib/domain/otf/snapshot-keys.ts`) ; un test vérifie que le service lit ce qu'elles désignent.

**F643 · L'immuabilité tenue.** Les douze tables que le module garde immuables (déclarations du sol et des stades, révisions des alertes, coefficients corrigés, profils racinaires…) **refusent toujours qu'on y efface**, sauf les lignes d'un espace dont l'effacement est **en cours** : leurs déclencheurs sont recréés à l'identique, avec cette seule exception (D-246). Une demande en attente n'ouvre rien ; les lignes d'un autre espace restent protégées pendant l'effacement d'un premier. Un test le joue sur les douze.

**F644 · Par lots bornés, et repris.** 200 lignes au plus par instruction ; un passage du matin fait **au plus 300 instructions et rien de neuf après 20 secondes**. Une seule requête dit les tables où l'espace a encore des lignes : un passage qui reprend ne dépense pas une instruction par table déjà vide. **Les bornes de D1**, lues dans sa documentation (page des limites, à jour du 30 octobre 2026) : 1 000 requêtes par exécution d'un Worker payant, 100 paramètres par requête, 30 secondes par requête, aucun plafond chiffré de lignes par requête (Cloudflare conseille de travailler par paquets, de l'ordre de 1 000 lignes). Les bornes du passage en restent loin, le reste du matin compris : c'est la réponse au « [À FAIRE : mesurer la limite] » de F563, par la documentation ; une mesure sur une base d'essai peut s'ajouter à un prochain essai de restauration, sur le « vas-y » du porteur. Coupé à n'importe quel endroit (borne du passage, panne), l'effacement **reprend au passage suivant** : le matin passe deux fois, à une heure d'écart, puis chaque jour.

**F645 · La tâche du matin, et la fin d'un bloc.** La tâche **« Effacement des fermes qui l'ont demandé »** (`farm-erasure`) entre au registre : la dernière du matin, après le coffre, aux seuils du matin (orange à 26 heures, rouge à 36, trois échecs de suite font une panne). Les demandes échues passent « en cours » ; chacune efface ce que l'espace garde, puis **l'espace et la note « faite », d'un bloc** : si une ligne de l'espace restait (une table oubliée, une saisie arrivée tard), les clés étrangères refusent, **rien n'est écrit**, la demande reste « en cours » et le passage suivant la reprend. **Jamais une ferme notée faite à moitié.** Le matin est réussi quand aucune demande échue ne reste à effacer ; sinon il dit « 1 effacement commencé, à finir au prochain passage » ou « 1 effacement en échec (erreur Error) ». Un échec de l'effacement ne fait échouer aucune autre tâche du matin. Le journal (F564) : `farm_erasure_step` (table, nombre de lignes), `farm_erasure_paused`, `farm_erasure_done`, `farm_erasure_failed` (classe d'erreur), avec le seul identifiant de la demande.

**F646 · La page d'état.** Une section **« Effacements »** : « Aucune demande d'effacement. », ou « Demandes d'effacement : 1 en attente, 2 faites ; dernière faite le 28/11 à 6 h 16. », en orange quand une demande échue n'est pas encore faite (« 1 à effacer »). Le jugement d'ensemble compte la tâche du matin comme les autres (« les 8 tâches »). Parcours **P50 étendu**, aux deux largeurs.

**F647 · Figée pendant le délai et l'effacement.** De la demande à la fin, l'espace est **sauté par tous les traitements du matin** (ils passent tous par la même liste des fermes : météo et ses alertes, planning, eau des cultures, réserve du sol, séchage) : aucun calcul, aucune notification du matin. Annulée, la ferme repart le matin suivant. Ce que la personne voit pendant ce temps (aucun appel à OTF, aucune saisie) vient avec la demande elle-même, dans la seconde partie.

**F648 · Les preuves de F563.** (1) **Exhaustivité** (`tests/farm-erasure-plan.test.ts`) : chaque table de la base migrée est dans le plan une fois et une seule ; chaque table d'espace est effacée, sauf la note ; les filles avant leurs mères. Une table ajoutée sans règle casse la CI (la chaîne de la 4.4 en ajoute deux : elles se rangent à sa fusion). (2) **Deux fermes** (`tests/db/farm-erasure.test.ts`) : des lignes de chaque espace dans **chaque** table d'espace, fabriquées à partir de la base migrée elle-même (`tests/support/synthetic-space-rows.ts` : une table ajoutée plus tard en reçoit aussi), plus celles qu'écrivent les vrais dépôts ; on efface A ; **B est strictement inchangée**, table par table (nombre de lignes et empreinte), ses compteurs de révision compris, les tables communes n'ont perdu que ce qui était à A, aucune ligne de A ne subsiste ; une seule exception, juste : quand A est l'espace sans ferme de la personne de B, B lisait les instantanés de A (F343), et leur départ fait avancer son compteur de faisabilité (ce qu'il calculait sur eux est à refaire) ; rejoué dans les quatre passages de l'isolation (deux personnes sans ferme, une personne sur deux fermes, deux personnes sur une ferme, un espace sans ferme à côté d'un espace de ferme). (3) **Reprise** : coupé toutes les neuf instructions, puis par une panne simulée, l'effacement finit au même état, B intacte à chaque passage ; une saisie arrivée tard fait refuser la fin. (4) **Annulation** dans les sept jours : rien n'est effacé. (5) **La page d'état** compte les demandes et dit la dernière faite.

#### 10 bis.18 · Précisions de la PR 5, première partie : la conservation, table par table, et les purges du matin (20 novembre 2026, D-247, F649 à F653)

Écrites avec le code, en Opus 5.5 · Très élevé. Elles précisent F562 et répondent à son [À FAIRE] (« dresser, table par table, la liste réelle ») sans rouvrir de décision. **La PR 5 en deux** (en trois depuis 10 bis.20). Cette première partie pose la durée de chaque table et les purges du matin. La **seconde partie** pose ce qui se lit et se relit : la politique de confidentialité (la phrase des 30 jours telle qu'approuvée, et les durées ci-dessous, texte relu par le porteur avant la fusion), `docs/exploitation.md` complété pour le support (F567, avec le journal d'accès du support, 12 mois) et les coûts (F568). L'oubli des abonnements de notification (90 jours sans réponse du service, F562) vient avec la seconde partie de la PR 3, qui touche le même Worker.

**F649 · Le plan de conservation, en code.** `db/retention-plan.ts` donne à **chaque table de la base** une durée et qui l'efface, en clair. Les tables d'un espace (celles du plan d'effacement, F641, et l'espace lui-même) ont une règle commune ; chaque autre table a la sienne. `tests/retention-plan.test.ts` lit la base migrée et **échoue pour une table sans durée** ou avec deux, comme le plan d'effacement : une table ajoutée plus tard sans durée écrite casse la CI. Il vérifie aussi que chaque table qui n'est pas d'un espace figure dans le tableau ci-dessous, avec la même durée que le code.

| Table | Ce qu'elle garde | Durée | Qui l'efface |
| --- | --- | --- | --- |
| les 76 tables d'un espace (`irrigation_workspaces` et `SPACE_TABLES`) | ce que la personne saisit (matériel, ressources, arrosages, pluie, observations, réglages, objectifs, alertes) et ce que le module calcule ou lit pour elle (météo de sa commune, calculs, planning) | tant que l'espace existe | l'effacement de la ferme, sept jours après la demande (F563) ; après « Déconnecter la ferme », 90 jours puis le même effacement (F652) |
| `otf_snapshots` | les copies du plan lu dans Ouvre ta ferme, une par saison | tant que la ferme est lue ; chaque lecture remplace la copie de sa saison | l'effacement de l'espace (F642) ; « Déconnecter la ferme » (F360) |
| `otf_farm_connections` | le raccordement à Ouvre ta ferme et ses jetons chiffrés | tant que la ferme est reliée | « Déconnecter la ferme », l'autorisation retirée (F358, F360) ; l'effacement de l'espace (F642) |
| `otf_farm_reads` | une ligne par ferme : le bail de lecture, la base de la réserve, la dernière lecture complète | tant qu'un espace garde la ferme | l'effacement du dernier espace de la ferme (F642) |
| `otf_call_starts` | une ligne par appel parti vers Ouvre ta ferme | 2 jours | la purge du matin et chaque départ de lecture (F361) |
| `otf_call_outcomes` | les appels comptés par ferme, par heure et par résultat | 8 jours | la purge du matin et chaque appel compté (F614) |
| `otf_daily_calls` | le compte des appels du jour, par ferme | 30 jours | la purge du matin et chaque départ de lecture (F363) |
| `otf_call_pauses` | les pauses après un `429`, une limite du jour ou le frein | jusqu’à la fin de la pause | la purge du matin et chaque départ de lecture (F361) |
| `otf_authentication_failures` | les refus d'authentification du module entier : des heures seules, d'aucune ferme | 15 minutes | la purge du matin et chaque départ de lecture (F359) |
| `irrigation_operator_notices` | la notification du jour de la veille : un genre, un nombre, des heures | 35 jours | la purge du matin |
| `irrigation_farm_erasures` | la note d'une demande d'effacement : l'identifiant interne de l'espace, un état, des dates | sans limite : la preuve qu'elle a été traitée | personne ; une fois l'espace effacé, elle ne désigne plus rien (F640) |
| `irrigation_background_jobs` | une ligne par tâche du registre : des heures, des nombres, des classes d'erreur | réécrite à chaque exécution | personne |
| `irrigation_crop_alert_common` | les seuils de gel communs, les mêmes pour toutes les fermes | sans limite | une migration qui les change |
| `otf_deployment_farm` | la ferme de la clé du déploiement | réécrite à chaque lecture | personne : un réglage du déploiement |

Hors de la base D1, les durées de F562 tiennent sans code nouveau : les journaux des Workers, 7 jours chez Cloudflare (F354) ; l'historique Time Travel, 30 jours ; l'export de la semaine, gardé par le porteur (10 bis.9), cinq semaines au plus (10 bis.20, F657). Les abonnements de notification vivent dans le Worker de notification, pas dans D1 (voir plus haut).

**F650 · La tâche « Purges de conservation ».** `retention-purge` entre au registre, **après l'effacement des fermes**, aux seuils du matin (orange à 26 heures, rouge à 36) : le registre compte 9 tâches, le matin six. Chaque table à durée perd, pour toutes les fermes, les lignes plus vieilles que sa limite, calculée à l'instant du passage : **la limite elle-même reste** (une ligne de l'heure exacte des deux jours est gardée). Par lots de **500 lignes**, **50 instructions au plus par passage** : assez pour 25 000 lignes en retard en un matin, loin des 1 000 requêtes d'une exécution (F644), effacement des fermes compris. Une purge arrêtée par la borne reprend au passage suivant ; une purge en échec n'arrête pas les autres. Le matin est réussi quand chaque purge est allée au bout ; sinon il dit « 2 purges à finir au prochain passage » ou « 1 purge en échec (erreur Error) ». Le journal (F564) : `retention_purge_step` (table, nombre de lignes) et `retention_purge_failed` (table, classe d'erreur), rien d'autre. Les purges tournent **même quand rien ne lit Ouvre ta ferme** : jusqu'ici, le journal des appels ne se purgeait qu'au départ d'une lecture.

**F651 · Une seule durée par donnée.** Les purges faites au passage par le compteur des appels (F361, F363, F614) et celles du matin lisent **les mêmes constantes** (`lib/domain/operations/retention.ts` les reprend de `shared-call-pace.ts` et `call-outcome.ts`) ; un test joue les deux sur les mêmes lignes et vérifie qu'elles gardent les mêmes. La durée proposée par F562 pour le journal des appels (35 jours) est **tenue plus court** : 2, 8 et 30 jours selon la ligne, ce que le code faisait déjà.

**F652 · Ce qui entre avec le code qui le crée.** Rangée avant d'exister, une durée ne tiendrait rien. (1) **Après « Déconnecter la ferme », 90 jours puis l'effacement** : la déconnexion (4.3, PR 3, F360) notera son heure ; 90 jours après, si la ferme n'a pas été reliée de nouveau, le matin ouvre la demande d'effacement de l'espace, que le moteur de F645 traite comme une autre ; la règle et sa preuve viennent avec cette PR. (2) Les **demandes d'autorisation en cours** (4.3, PR 3) : leur table et leur purge du matin viennent avec elle. (3) Le **journal d'accès du support**, 12 mois (F567) : avec la troisième partie de cette PR (10 bis.20). (4) Les **abonnements de notification**, 90 jours sans réponse du service : avec la seconde partie de la PR 3. Chacune de ces tables nouvelles se range dans les deux plans, d'effacement et de conservation : les deux tests l'exigent.

**F653 · Preuves.** `tests/retention-plan.test.ts` : chaque table a sa durée, une fois ; chaque purge vise une colonne de sa table avec un seul paramètre ; les limites à un instant donné (deux jours, huit jours à l'heure pleine, trente jours, quinze minutes, trente-cinq jours) ; le tableau ci-dessus à jour. `tests/db/retention-purge.test.ts` : deux fermes et deux espaces remplis dans **chaque** table ; chaque purge efface la ligne juste trop vieille et garde celle de la limite, pour les deux fermes, sans toucher une seule autre table ; un second passage n'a plus rien à faire ; borné à deux instructions, le passage s'arrête et le suivant finit ; une purge en panne n'arrête pas les autres et son message ne va pas au journal ; les purges au passage gardent les mêmes lignes.

#### 10 bis.19 · Précisions de la PR 3, deuxième partie : les appareils d'une ferme effacée, et ceux qui ne répondent plus (20 novembre 2026, D-248, F654 à F656)

Écrites avec le code, en Opus 5.5 · Très élevé. Elles précisent F562 et F563 sans rouvrir de décision. **La PR 3 en trois.** Ce qui touche le Worker de notification ne dépend pas de « Réglages » : il passe maintenant, en deuxième partie. La **troisième partie**, après la chaîne de la 4.4, garde le reste de ce que 10 bis.17 annonçait : la demande dans « Réglages », l'annulation, l'écran de l'espace figé et l'effacement immédiat sur demande écrite.

**F654 · Les appareils d'une ferme effacée.** Une route nouvelle du Worker, `/v1/recipients/forget`, avec le seul identifiant de l'espace : chaque appareil de sa liste **quitte l'espace** (sa fiche perd cet espace ; s'il ne sert plus aucun espace, **sa fiche est oubliée**, l'empreinte de la personne avec elle), puis sa ligne part ; le Worker rend le nombre d'appareils oubliés. Coupé en route, l'oubli se reprend, et un second oubli n'a plus rien à faire. Le moteur de l'effacement (F645) l'appelle **après le dernier lot et avant la fin** : tant que le Worker ne l'a pas fait (injoignable, refus, ou Worker d'avant cette PR qui ne connaît pas la route), **rien n'est noté fait**, la demande reste « en cours » et le passage suivant le lui redemande ; le matin dit « 1 effacement en échec (erreur PushForgetError) ». Sans service configuré (développement, démonstration), aucun appareil n'a pu s'inscrire : rien à oublier. **Les alarmes en attente** (fin d'un arrosage, nouvelles tentatives d'un envoi) ne sont pas rangées par espace : quand elles partent, elles ne trouvent plus aucun appareil, et la notification qu'elles gardaient disparaît avec elles, au plus tard à la fin de l'arrosage ou de la douzième tentative.

**F655 · 90 jours sans réponse du service.** Chaque abonnement garde **l'heure de son premier envoi manqué depuis sa dernière réussite** (réponse passagère, `429` ou `5xx`, ou refus du service, `4xx` autre qu'expiré) ; une réussite l'efface. À un envoi manqué, si cette heure a **90 jours ou plus**, l'abonnement est oublié comme un abonnement expiré : retiré de la liste, sa fiche oubliée, compté « expiré ». **Un abonnement à qui rien n'est envoyé n'est jamais « sans réponse »** : un hiver sans arrosage ne fait perdre aucun appareil. La colonne s'ajoute à chaque liste à son premier réveil (`ALTER TABLE … ADD COLUMN`), ses abonnements intacts. Un refus qui vient d'une clé du service changée rend les abonnements inutilisables : les oublier au bout de 90 jours est juste.

**F656 · Preuves.** Le Worker (`cloudflare/irrigation-push/test`), sur la mémoire de test qui fait tourner ses vraies classes : un téléphone dans deux espaces et une tablette dans un seul ; l'oubli du premier laisse le téléphone au second, oublie la fiche de la tablette, et l'espace d'une autre personne ne perd rien ; plus rien ne part de l'espace oublié ; un second oubli n'a rien à faire. Les 90 jours : un instant avant, gardé ; à 90 jours, oublié ; une réussite au 45e jour fait repartir le compte ; un appareil à qui rien n'est envoyé reste ; une liste d'avant la colonne la reçoit sans perdre ses lignes. La route refuse un identifiant hors forme et un appel sans secret. Le module (`tests/db/farm-erasure.test.ts`) : le Worker reçoit l'identifiant de l'espace effacé, et lui seul ; sans réponse, l'espace reste et la demande reste « en cours » ; au passage suivant, l'effacement finit.

#### 10 bis.20 · Précisions de la PR 5, deuxième partie : la page de confidentialité, les exports gardés cinq semaines, le support (20 novembre 2026, D-249, F657 à F659)

Écrites avec le code, en Opus 5.5 · Très élevé. Elles précisent F562 et F567 sans rouvrir de décision. **Numéros** : F600 à F659 et D-240 à D-249 ne suffisant plus, la 4.5 prend aussi **F660 à F669** et **D-250 à D-252** pour ses dernières parties. **La PR 5 en trois.** Cette deuxième partie pose ce qui se lit et se relit ; la **troisième** pose le journal d'accès du support (12 mois, une table nouvelle, rangée dans les deux plans) et les coûts sur la page d'état (F565, point 6 ; F568).

**F657 · Les exports gardés cinq semaines au plus.** Un export garde aussi les données d'une ferme effacée depuis : sans règle, l'effacement promis n'aurait pas de fin chez l'exploitant. La page de confidentialité promet **cinq semaines au plus**, et la commande de l'export la tient elle-même : une fois l'export du jour vérifié (relu, déchiffré à l'identique, sans problème au contrôle), elle efface du même dossier les exports faits **25 jours ou plus avant lui** (le jour lu dans leur nom) et dit leurs noms. 25, ce sont les 35 jours promis moins les 10 jours après lesquels la tâche de l'export passe en rouge (F624), lus dans le registre : tant que l'export n'est pas en rouge, aucun export ne passe cinq semaines ; à un export par semaine, le dossier en garde quatre (trois semaines de recul, en plus des 30 jours de Time Travel). Elle n'efface **que les fichiers qu'elle a nommés** : jamais l'export du jour, ni un export daté après lui, ni un fichier renommé, un dossier ou un lien ; un fichier qui ne s'efface pas (ouvert ailleurs) est dit « À FAIRE », sans faire passer l'export du jour pour manqué. Les copies hors de l'ordinateur (clé, disque, stockage en ligne) suivent la même règle, à la main : la commande le rappelle avec les noms, et `docs/exploitation.md` le dit, avec le cas d'un arrêt des exports (chaque export effacé cinq semaines après sa date). Une tâche du Worker ne pourrait pas le faire : les fichiers sont chez l'exploitant, hors de Cloudflare.

**F658 · La page de confidentialité, texte du 20 novembre 2026.** « Combien de temps » dit chaque durée que le code tient (10 bis.18, F649 ; 10 bis.19, F655) : les données de ferme, tant que la ferme utilise le module, effacées sur demande dans un délai d'un mois au plus, **la preuve de la demande gardée sans nom, ferme ni contenu** (F640) ; l'historique de l'hébergeur, avec **la phrase des 30 jours telle qu'approuvée** le 19 novembre 2026 (« Une donnée effacée reste récupérable dans l'historique jusqu'à 30 jours. »), précédée d'une phrase qui dit ce qu'est cet historique ; l'export de la semaine, gardé par le responsable hors de l'hébergeur, **cinq semaines au plus** (F657) ; le compte des lectures dans Ouvre ta ferme, **30 jours au plus** (la plus longue de ses durées, F651) ; les journaux techniques, sept jours ; l'abonnement aux notifications, effacé aussi avec les données de ferme et **après 90 jours sans notification remise** (F654, F655). « Ce que le module garde » ajoute **le compte des lectures** (combien, à quelle heure, la réponse reçue ; jamais ce qui a été lu), que F614 renvoyait ici. Ce qui n'existe pas encore n'est pas écrit : les 90 jours après « Déconnecter la ferme » et les demandes d'autorisation en cours (4.3, PR 3), le journal d'accès du support (troisième partie) ; chacun s'écrira avec son code. **Le texte passe par la relecture du porteur avant la fusion** : la fusion le met en ligne (le site se déploie depuis `main`). `cloudflare/irrigation-site/test/site.test.ts` vérifie chaque phrase.

**F659 · Le support par une seule personne.** `docs/exploitation.md` gagne « Que faire quand… » : chaque cas de F567 (une notification de la veille, une ferme qui écrit, une demande d'effacement, une base abîmée ou perdue, la clé du coffre perdue ou vue par un autre, Ouvre ta ferme qui retire l'accès, change ou ferme, le compte ou le déploiement perdu), en quelques lignes qui renvoient à la section qui le détaille ; un **gabarit de réponse** à une ferme, fondé sur la seule page d'état ; ce que fait l'exploitant s'il doit regarder les données d'une ferme (à sa demande écrite, noté ; le journal en troisième partie). La page d'accueil du site dit le délai, **sans engagement** : « Une seule personne s'occupe du module : réponse en général sous deux jours ouvrés, sans engagement. » (la formulation de F567, relue avec le reste). Preuves : `tests/backup-export-retention.test.ts` (les 25 jours tirés du registre ; à un export par semaine, quatre gardés ; tous les 7 à 10 jours, aucun au-delà de 35 jours ; la limite au jour près, au passage à l'heure d'hiver ; aucun autre fichier touché ; ce que dit la commande, sans jamais « PROBLÈME » pour un export bon) et le test du site.

### 10 ter. Précisions de la 4.6 : le pilote multi-fermes (19 novembre 2026, D-221, F570 à F580)

Écrites avant toute ouverture, le 19 novembre 2026, en Sonnet 5.5 · Moyen (contrat sans code, grille générale de la roadmap). Elles précisent la section 10 et ne rouvrent aucune décision déjà prise (sections 2, 5 à 10 bis, 12). La 4.6 est le premier moment où **les données d'une personne qui n'est pas le porteur entrent dans le module** : tout ce qui suit sert à ce que ce moment soit réversible, borné et prouvé. Marques : **[NON VÉRIFIÉ]**, **[À FAIRE]** (à lire ou mesurer le jour venu), **[RÉSERVÉ]** (acte ou décision du porteur, que l'assistant ne prend pas).

#### 10 ter.1 · Objet

Le contrat disait en deux lignes : « 1 ou 2 fermes amies, d'abord en lecture seule, accord écrit de chacune, recette sur chaque écran, preuve d'isolation en conditions réelles, retour consigné ». Ce qui manquait, et que cette section écrit :

- **quand le pilote peut commencer** : une liste de conditions d'entrée, chacune vérifiable à la source (10 ter.3), au lieu d'un « après la 4.5 » ;
- **ce que veut dire « lecture seule »** et ce que le pilote ne fait pas (F571) ;
- **comment se prouve « A ne voit jamais B » sur de vraies fermes** sans que l'assistant ouvre l'espace d'une ferme tierce (F573) ;
- **ce qui arrête le pilote tout de suite** et comment on revient en arrière (F576) ;
- **ce qui permet de dire que le pilote a réussi**, et ce que cela n'ouvre pas (F577).

La 4.6 n'est pas un chantier de code. Elle est une suite d'étapes, de documents et de constats ; le code n'y entre que pour corriger un défaut trouvé, ou pour le seul contrôle de F573.

#### 10 ter.2 · Contraintes tenues

1. Celles de la section 2 du contrat (multi-fermes, OTF en lecture seule, 4 requêtes par seconde au plus, aucun secret vu par l'assistant, une fuite entre fermes est le pire défaut, accord écrit de chaque ferme tierce).
2. **Aucune dépense nouvelle** : l'hébergement du pilote est gratuit pour la ferme (question 2 de la section 12, tranchée le 15 novembre 2026) et tient dans l'abonnement Workers déjà pris (D-017). Toute question qui toucherait au budget (la participation d'après le pilote, F348 ; un service payant ; Access au-delà de 50 personnes) est posée **à part au porteur**, jamais tranchée ici.
3. **Aucune action sur Cloudflare ni sur une ferme réelle par l'assistant sans le « vas-y » exprès du porteur** : l'ajout d'une personne à la règle d'Access, la pose des secrets, la lecture du tableau de bord et chaque recette dans son Chrome sont **ses actes** ou demandent son accord à chaque fois.
4. **L'assistant n'ouvre jamais l'espace d'une ferme pilote** et ne lit jamais ses données ni ses journaux : la preuve côté ferme pilote est apportée par la personne elle-même, sur sa propre ferme (F573, F574). Le porteur, exploitant, peut techniquement tout lire (D6 de la revue) ; il s'interdit de le faire hors cas d'arrêt (F576), et le dit dans l'accord (F572).
5. **Aucune donnée de ferme tierce dans le dépôt**, qui est public : ni nom de ferme, ni nom de personne, ni adresse électronique, ni capture, ni extrait de base. Les fermes se nomment « ferme pilote 1 », « ferme pilote 2 » partout. Les accords signés et les courriels restent chez le porteur, hors dépôt.
6. **Aucune écriture chez OTF, aucun matériel branché, aucune vanne pilotée** pour une ferme pilote (F571).
7. **Pas de ferme avant les conditions d'entrée** : une seule manque, le pilote ne commence pas, et le dire est un résultat, pas un échec.

#### 10 ter.3 · Les conditions d'entrée

Chaque ligne se **vérifie dans le dépôt, les PR ou le tableau de bord**, jamais de mémoire (consigne 7 du projet). Le pilote commence quand les douze lignes sont vraies et que le porteur a dit « vas-y » sur la fiche d'entrée (F570).

| N° | Condition | Où se vérifie | Qui |
| --- | --- | --- | --- |
| E1 | OTF a validé la demande ; le porteur a posé les secrets de la 4.3 (F368) | page des demandes d'OTF ; secrets présents (la commande de pose se lit, pas leur valeur) | porteur |
| E2 | 4.3 PR 3 et PR 4 **en ligne** ; essai de bout en bout conforme sur « Ferme v2 » n° 4394 ; la ferme du porteur reliée ; le secret `OTF_API_TOKEN` retiré et le chemin de la clé du déploiement retiré (F366, étapes 4 et 5) : **une personne qui n'a pas relié sa ferme n'en ouvre aucune** | roadmap 4.3, registres, test « une personne inconnue n'ouvre aucune ferme » vert | assistant, porteur pour les actes |
| E3 | La **part du quota** de la ferme du porteur est fixée (F363) : question au porteur, due **à partir du 3 décembre 2026** (quatorze jours après la mise en ligne de #94, le 19 novembre 2026 à 1 h 33) | journal des appels, F363 | porteur [RÉSERVÉ] |
| E4 | 4.4 **en ligne** (cinq PR) et son essai réel conforme sur « Ferme v2 » n° 4394, aux deux largeurs | roadmap 4.4, section 8 bis.6 | assistant, recette dans le Chrome du porteur avec son accord |
| E5 | 4.5 **en ligne** (cinq PR) : la veille prévient en vrai, l'effacement d'une ferme est complet et prouvé, la restauration est **jouée** (S1, S2, S3), la phrase des 30 jours est dans la confidentialité | roadmap 4.5, section 10 bis.7 | assistant |
| E6 | **Relecture juridique** de la confidentialité et des conditions faite par le réseau du porteur, **gratuite** (règle du 15 novembre 2026), son retour reçu et ses remarques reprises | retour du porteur ; PR de reprise | porteur [RÉSERVÉ] |
| E7 | Le texte de confidentialité en ligne dit ce que fait le code : clé chiffrée gardée puis effacée, l'exploitant peut techniquement lire les données (F367, D6), conservation (4.5), effacement sous sept jours | lecture de la page publique contre le code, ligne à ligne | assistant, porteur relit |
| E8 | **Revue d'isolation de la 4.3 à la 4.5** par un fil à part, sur `main` : le coffre, les raccordements, l'accueil, la veille et l'effacement ne mélangent pas les fermes ; les points D2 à D5 de la revue du 18 novembre 2026 sont fermés ou écartés par écrit ; le contrôle de cohérence (F380) couvre toute table nouvelle | rapport de la revue, déposé dans le projet | assistant (fil indépendant, Opus 5.5 · Max) |
| E9 | **Le modèle d'accord, la grille de recette et la fiche de retour** existent dans `docs/` (F572, F574, F575) | dépôt | assistant |
| E10 | L'**essai à blanc du retour en arrière** (F576) a été joué une fois : déconnexion d'une ferme fictive, retrait de la personne d'Access, effacement sous sept jours, vérification | compte rendu dans la PR | assistant, porteur pour Access [RÉSERVÉ] |
| E11 | **La démonstration** (4.0) a été essayée par la ferme pilote avant tout raccordement (constat B de la revue du 18 novembre 2026) | retour de la ferme | porteur (contact) |
| E12 | Le **coût** est relu : l'abonnement Workers, l'alerte de budget présente, le nombre de personnes dans Access loin de 50 | tableau de bord Cloudflare, dans le Chrome du porteur avec son accord | porteur |

E3, E6 et E12 touchent au budget, au juridique ou à Cloudflare : **réservés**. Les autres peuvent être préparés la nuit par l'assistant.

#### 10 ter.4 · Les points

##### F570 · La fiche d'entrée et le « feu vert »

Un document court, `docs/pilote-fiche-entree.md`, **recopie les douze lignes de 10 ter.3 avec, pour chacune, la preuve constatée** (numéro de PR, date, extrait du résultat, **jamais une valeur secrète**). Le pilote commence quand **la dernière ligne est cochée et que le porteur a écrit « vas-y »** sous la fiche. Une ligne cochée de mémoire est refusée (consigne 7). La fiche se met à jour par PR, comme les registres. **Aucun fil de code ne la précède** : on ne la remplit qu'au moment où il reste moins de trois lignes ouvertes.

##### F571 · Ce que veut dire « lecture seule », et ce que le pilote ne fait pas

- **Chez OTF** : toujours en lecture (section 2, contrainte 2). La ferme pilote **ne perd rien dans OTF** et n'y change rien en passant par le module.
- **Dans le module**, la personne saisit **ses propres réglages** (l'accueil de la 4.4 les lui demande) : c'est la seule chose qu'elle écrit, dans son espace.
- **Aucun matériel** : ni vanne, ni capteur, ni station (confiés à Tlaloc, D-066). Les vannes et les capteurs restent « en cours de développement » dans le texte public (F345).
- **Aucun arrosage n'est déclenché** : le module propose, la personne arrose. La phrase est dite à l'accord (F572) : ses conseils ne sont pas une garantie agronomique.
- **Les notifications** sont possibles **dès la deuxième étape** (F574), si la personne les active elle-même ; elles ne sont pas demandées à la première.
- **Aucun réglage agronomique du porteur** n'est repris : les valeurs de départ sont celles de la 4.4, « à renseigner » quand elles ne sont pas connues. Un retour qui demanderait de changer une valeur agronomique est **consigné, pas appliqué** : la décision est réservée au porteur [RÉSERVÉ].

##### F572 · L'accord écrit

Un modèle, `docs/pilote-accord-modele.md`, sans aucune donnée de ferme, que le porteur envoie lui-même (contact extérieur, son acte) et dont il garde les réponses. Il dit, en phrases simples :

1. ce que le module **lit** chez OTF (les droits en lecture demandés dans le formulaire et leurs raisons, tels que sur la page de confidentialité) et qu'il **n'écrit rien** ;
2. ce qu'il **garde**, où (le compte Cloudflare du porteur), combien de temps (le tableau de conservation de la 4.5) ;
3. que **l'exploitant peut techniquement lire** les données de toutes les fermes dans la base et les journaux (D6), qu'il s'interdit de le faire hors cas d'arrêt, et ce qui l'y ferait entrer ;
4. que la ferme **arrête quand elle veut** (« Déconnecter la ferme » dans Réglages, ou le retrait de l'accès côté OTF) et peut **demander l'effacement**, fait sous sept jours, annulable pendant ce délai ;
5. que c'est **gratuit pendant le pilote** ; qu'ensuite une participation d'environ 1 € par mois et par ferme est possible, **sans engagement** et sans rien prélever sans accord nouveau (texte de F348) ;
6. qu'**aucun engagement de service** n'est pris (pas de délai garanti) ; le support est assuré par une seule personne (4.5-h) ;
7. que le module **conseille et ne commande rien** (F571) ;
8. qu'on lui demandera **un retour** (F575), et que la ferme peut le refuser sans perdre l'accès ;
9. la **version datée** du texte, sur laquelle la ferme répond.

Forme de l'accord : **une réponse écrite explicite** (courriel) à l'envoi de cette version datée suffit ; la ferme reçoit une copie de ce qu'elle a accepté. Le modèle passe par la **relecture juridique gratuite** (E6) avant d'être envoyé. L'assistant le rédige, ne l'envoie à personne. L'accord est **par ferme et par personne** (le propriétaire de la ferme dans OTF, le seul qui puisse l'autoriser, F351).

##### F573 · La preuve « A ne voit jamais B » sur de vraies fermes

Deux espaces réels existent dès la première ferme pilote : la ferme du porteur (A) et la ferme pilote 1 (B). Une seule ferme pilote suffit donc à la preuve ; la deuxième ajoute un cas (F577). Le protocole, joué **une fois à la fin de la première semaine**, puis **après tout changement d'isolation** :

1. **Côté A** (constaté par l'assistant, dans le Chrome du porteur, avec son accord) : rien de la ferme pilote n'apparaît dans les pages de l'espace du porteur : ni plantation, ni planche, ni matériel, ni message d'alerte, ni ligne dans la page d'état autre que « 2 fermes reliées » et leurs compteurs par identifiant interne.
2. **Côté B** (constaté **par la personne de la ferme pilote**, sur une grille de questions « oui / non » écrite pour elle, F574) : rien de la ferme du porteur n'apparaît chez elle : aucun nom de planche, de culture, de matériel, de jardin que ce n'est pas le sien.
3. **L'appareil** : si les deux personnes n'ont aucun appareil commun, le cas du constat A de la revue (D-159) n'est pas jouable en réel ; il l'est avec **l'appareil du porteur**, qui s'inscrit successivement aux notifications des deux espaces si le porteur a deux identités dans Access [NON VÉRIFIÉ] ; sinon la preuve reste celle des tests (#92), et le dit.
4. **Les compteurs** : la page d'état montre un compte d'appels **séparé par ferme** ; un appel de B ne change pas celui de A ; le total reste sous le budget du jour de chacune (F363).
5. **La base** : le contrôle de cohérence des espaces (F380) est **rejoué sur une copie de la base réelle**, sur l'ordinateur du porteur, à partir de l'export hebdomadaire déchiffré par lui (10 bis.9) : il rend « n lignes vérifiées, 0 qui désigne un autre espace », **sans aucune valeur**. C'est le seul code de la 4.6 (PR 2, 10 ter.6). Tant qu'il n'existe pas, ce point est « non vérifié en réel » et dit comme tel.

Le constat s'écrit **sans nom** (« ferme A », « ferme pilote 1 ») dans `docs/pilote-recette.md`.

##### F574 · La recette sur chaque écran

- **Une grille par page du menu** (`docs/pilote-recette.md`), dressée **au début de la recette depuis le menu réel** [À FAIRE] : pour chaque page, trois questions à la personne (« Voyez-vous votre plan, pas celui d'un autre ? », « Un chiffre vous paraît-il faux ou absurde pour votre ferme ? », « Un mot ou un bouton n'est-il pas clair ? »), aux **deux largeurs** (ordinateur et 390 px).
- **Ce qui doit se voir pour une ferme neuve** : aucun faux zéro, « à renseigner » là où rien n'est connu (F422, section 8 bis.6) ; la ferme exclue (hors France métropolitaine, plusieurs structures) dite avant toute saisie.
- **Étapes** : **S0** préparation à blanc (fiche d'entrée) ; **S1** la personne ouvre le module, passe l'accueil, autorise sa ferme dans OTF **elle-même** (l'assistant ne voit jamais le jeton, contrainte 3 de la section 2), **avec le porteur au téléphone ou en visio** ; **S2** une **semaine** d'usage libre, notifications possibles, la page d'état et la veille regardées chaque matin par le porteur ; **S3** la recette de la grille et la preuve de F573 ; **S4** la deuxième ferme, si S3 est conforme et sans défaut grave ; **S5** le bilan (F577).
- Les **constats** se disent « conforme » ou « non conforme » avec leur cause ; les chiffres de la ferme pilote **ne sont pas copiés** dans le dépôt.
- **Défaut trouvé** : une PR de correction à part par défaut, comme toujours ; **un défaut d'isolation arrête le pilote (F576)**.

##### F575 · Le retour des fermes

Une fiche, `docs/pilote-retour-modele.md`, que le porteur remplit **avec** la personne (entretien ou courriel), sans la lui imposer : le temps pris par l'accueil, les étapes où elle a hésité ou abandonné, les mots non compris, ce qui manque, ce qui est faux, ce qu'elle refuserait de confier, si le texte de confidentialité lui a paru clair, si elle utiliserait le module sans le porteur, ce qu'elle penserait d'une participation de 1 € par mois (**opinion recueillie, aucune décision**, budget [RÉSERVÉ]). Consigné au dépôt **en résumé sans nom**, avec les verbatim **seulement si la personne les a autorisés par écrit**.

##### F576 · Les arrêts, et le retour en arrière

**Le pilote s'arrête tout de suite** (le porteur en est prévenu aussitôt, dans le chat du projet) si :

1. une donnée d'une ferme apparaît chez une autre, **même soupçonnée** ;
2. un jeton, une clé, un `code` ou un `state` apparaît quelque part où il ne devrait pas (page, journal, réponse) ;
3. le module **écrit** chez OTF, ou appelle OTF plus de 4 fois par seconde ;
4. le budget du jour d'une ferme est atteint **plus de deux jours de suite** et prive une autre ferme (F363) ;
5. la veille signale une panne non vue depuis plus de 36 heures et que le porteur ne la rattrape pas dans la journée ;
6. la personne le demande, sans avoir à se justifier.

**Le retour en arrière** (essayé à blanc, E10) : (a) la ferme est **déconnectée** (Réglages ; le coffre efface la clé) ; (b) la personne est **retirée de la règle d'Access** par le porteur [RÉSERVÉ] ; (c) si elle le demande, l'**effacement** (4.5-d) est lancé, sous sept jours ; (d) un **constat écrit** (quoi, quand, d'où vient la découverte) est déposé sans nom ; (e) **aucune reprise** avant la correction et une nouvelle revue de ce qui a été touché. Un arrêt n'est pas un échec du pilote : c'est ce pour quoi il est fait.

##### F577 · Le bilan, et ce que le pilote n'ouvre pas

Le pilote est **réussi** quand, pour chaque ferme pilote : S3 est conforme ; une semaine s'est écoulée sans défaut grave ni panne non vue ; le retour est consigné ; la ferme accepte de continuer ou de s'arrêter proprement ; le coût d'un mois d'exploitation est relu (4.5-i, lecture dans le Chrome du porteur, un mois après la première ferme). Le bilan est écrit par l'assistant et **jugé par le porteur** (D-014). Sa réussite **n'ouvre rien d'elle-même** : ouvrir à une troisième ferme, puis à d'autres, est **une décision nouvelle** du porteur (D-xxx), qui rouvrira au moins les points budgétaires (participation, Access au-delà de 50 personnes) et la question du support. Rien dans ce contrat ne promet une date, un nombre de fermes ou un service.

##### F578 · Le choix des fermes

Les fermes sont **celles que le porteur contacte lui-même** (réponse du 15 novembre 2026) ; leurs noms ne figurent nulle part au dépôt [RÉSERVÉ]. Les critères que recommande ce contrat, dits au porteur pour son choix :

1. une ferme **en France métropolitaine** (la limite de la 4.4) ;
2. dont **la personne est le propriétaire** de la ferme dans OTF (F351) ;
3. avec un **plan de culture à jour** dans OTF, sinon l'accueil n'a rien à lire ;
4. **ni Nicolas ni Vincent** par défaut : ils ont la démonstration (4.0) et un autre rôle ;
5. pour la **deuxième** : un autre profil (sous abri ou plein champ, taille, sol) que la première, pour que le pilote montre autre chose qu'une répétition.

Ordre : **une seule ferme d'abord** ; la deuxième seulement après une semaine d'usage de la première sans défaut grave (S2 puis S3). Deux fermes pilotes au plus (section 10). Les personnes ajoutées à la règle d'Access le sont **une par ferme** (T4-04), par le porteur [RÉSERVÉ] ; leur adresse n'est jamais écrite dans le dépôt.

##### F579 · Le support pendant le pilote

Une seule personne (le porteur), **sans engagement de délai** (4.5-h). Le canal est celui du site public (Discord de préférence, F347) ; la ferme le reçoit dans l'accord. Chaque question posée est consignée dans la fiche de retour, avec la réponse, sans nom. Si la veille de la 4.5 signale quelque chose pendant le pilote, **le porteur le dit à la ferme** avant qu'elle ne le trouve.

##### F580 · Qui fait quoi

| Acte | Qui |
| --- | --- |
| Contacter les fermes, envoyer l'accord, recueillir les réponses, le retour | porteur |
| Relecture juridique (réseau gratuit) | porteur |
| Ajouter ou retirer une personne dans Access ; poser les secrets ; lire le tableau de bord | porteur (« vas-y » à chaque fois) |
| Autoriser une ferme dans OTF, passer l'accueil, répondre à la grille | la personne de la ferme pilote |
| Rédiger le modèle d'accord, la grille, la fiche de retour, la fiche d'entrée ; revue d'isolation ; constats côté ferme du porteur ; corrections ; registres | assistant |
| Juger la recette, décider de continuer, d'arrêter ou d'ouvrir | porteur |

#### 10 ter.5 · Ce que la 4.6 ne fait pas

- Aucun **code de fonctionnalité** : seulement le contrôle de F573 et des corrections ;
- aucune **ouverture** à une troisième ferme, à un public ou à un domaine propre ;
- aucune **promesse de service** ni de prix (le prix d'après le pilote reste celui de F348, sans engagement) ;
- aucun **changement du moteur** ni du calcul (section 11) ;
- aucun **accès de l'assistant** aux données d'une ferme pilote (contrainte 4) ;
- aucune **valeur agronomique** décidée à la place du porteur.

#### 10 ter.6 · Découpage (une PR à la fois, registres dans chacune)

| PR | Contenu | Code ? | Réglage |
| --- | --- | --- | --- |
| 1 | Les quatre documents : `docs/pilote-accord-modele.md`, `docs/pilote-recette.md` (grille et protocole de F573), `docs/pilote-retour-modele.md`, `docs/pilote-fiche-entree.md` (douze lignes, vides) | non | Sonnet 5.5 · Moyen |
| 2 | Le **contrôle de cohérence sur une copie de la base réelle** (F573, point 5) : un script local qui relit un export, rejoue F380 et rend des comptes sans valeur ; essayé sur une base d'essai à deux fermes, **jamais sur la production** | oui, petit | Opus 5.5 · Max (réglage de la ligne 4.6) |
| 3 | **L'essai à blanc du retour en arrière** (E10) sur une ferme fictive ; compte rendu | non | Sonnet 5.5 · Moyen, les actes Cloudflare par le porteur |
| 4… | **La revue d'isolation de la 4.3 à la 4.5** (E8) : un rapport, pas une PR de code ; ses défauts, une PR chacun | non puis oui | Opus 5.5 · Max |
| n | Les corrections et les constats du pilote lui-même ; le bilan (F577) | selon | Opus 5.5 · Max pour un défaut d'isolation, sinon selon la grille |

La PR 1 peut s'écrire **avant** la fin de la 4.5 : elle ne dépend d'aucun code, et le porteur a besoin du modèle d'accord pour sa relecture juridique (E6) : c'est la seule partie de la 4.6 qui produit quelque chose d'utile sans attendre. Les autres attendent leur condition d'entrée. **La PR 1 attend le « vas-y » du porteur sur le texte de l'accord**, qu'il relit avant tout envoi.

#### 10 ter.7 · Preuves de fin de la 4.6

| Point | Preuve exigée |
| --- | --- |
| Entrée | fiche d'entrée à douze lignes, chacune avec sa preuve constatée à la source ; « vas-y » du porteur écrit dessous |
| Accord | une réponse écrite explicite de chaque ferme, **gardée par le porteur**, à la version datée du modèle ; la version est consignée au dépôt (date seulement) |
| Isolation | protocole F573 joué : côté A constaté, côté B répondu par la personne, compteurs séparés, contrôle de cohérence de F573 point 5 rendu **ou** dit « non vérifié en réel » avec sa raison |
| Recette | grille remplie à deux largeurs, chaque « non conforme » avec sa cause et sa PR |
| Retour en arrière | essai à blanc fait (E10) ; si un arrêt a eu lieu, son constat écrit |
| Retour | fiche de retour consignée en résumé sans nom |
| Coût | lecture du tableau de bord un mois après la première ferme, écart inscrit |
| Bilan | écrit par l'assistant, jugé par le porteur ; **aucune ouverture** sans décision nouvelle |

#### 10 ter.8 · Risques propres à la 4.6

| Risque | Gravité | Réponse |
| --- | --- | --- |
| Une fuite entre fermes que les tests n'avaient pas prévue | très grave, discrète | revue E8 ; F573 sur du réel ; une ferme d'abord ; arrêt immédiat (F576) ; l'assistant n'ouvre jamais l'espace d'une ferme tierce |
| Le porteur, exploitant, lit des données de la ferme pilote | grave pour la confiance | dit dans l'accord (F572, point 3) ; hors cas d'arrêt, il ne lit rien ; l'accord le dit |
| Quelqu'un est ajouté à Access avant les conditions | grave | règle d'exploitation (constat B) maintenue jusqu'à E1 à E12 ; seul le porteur modifie Access |
| Le quota d'OTF est dépassé par la ferme pilote et prive ses autres outils | moyen | E3 (part fixée avant), arrêt 4 (F576) ; compteurs séparés par ferme |
| La ferme pilote se lasse ou abandonne l'accueil | moyen | S1 accompagnée, reprise possible (F417), retour (F575) |
| Une panne passe inaperçue pendant que la ferme dépend du module | moyen | veille de la 4.5, le porteur prévient la ferme avant qu'elle ne le trouve (F579) |
| Le texte juridique est jugé insuffisant | moyen | E6 avant toute ferme ; accord par version datée ; arrêt à la demande |
| Un seul support, absent | moyen | pas d'engagement de délai (F572, point 6) ; une ferme à la fois |
| Un retour demande de changer une valeur agronomique | moyen | consigné, pas appliqué ; décision du porteur (F571) |
| Le coût dépasse ce qui est annoncé | faible à moyen | E12 ; lecture après un mois ; toute question de budget posée au porteur à part |

#### 10 ter.9 · Ce qui n'est pas établi (à dire, pas à deviner)

- Le délai de validation d'OTF (hors de notre main) et la **liste exacte** des droits qu'il accordera : les cinq droits demandés le 18 novembre 2026 sont ceux du formulaire, **pas ceux accordés**.
- Si **le porteur a deux identités** dans Access pour jouer le cas de l'appareil partagé (F573, point 3).
- La **liste des pages du menu** au moment de la recette (F574).
- Le **nombre d'appels réellement consommé** par une ferme tierce : mesuré sur la seule ferme du porteur jusqu'ici (F363).
- Le **retour des fermes amies** : aucune n'a été contactée à l'écriture de ce contrat ; aucune n'a rien vu du module hors démonstration.
- Tout **avis juridique** (accord, confidentialité, responsabilité) : rien de ce contrat n'en est un ; E6 le fait venir du réseau du porteur.
- Si les 50 premières personnes d'Access restent gratuites au-delà du seuil (section 15).
- Rien n'est codé, essayé sur une vraie ferme tierce ni envoyé à quiconque.

#### 10 ter.10 · Tranché dans ce contrat, et ce qui reste au porteur

**Tranché à l'option recommandée** (autonomie du porteur, 19 novembre 2026 ; ni budget, ni agronomie, ni ferme réelle, ni Cloudflare) : une seule ferme pilote d'abord, la seconde après une semaine sans défaut grave ; l'assistant n'ouvre jamais l'espace d'une ferme tierce ; la preuve côté B est apportée par la personne ; la forme de l'accord est la réponse écrite explicite à une version datée ; les douze conditions d'entrée et la revue d'isolation E8 ; les six causes d'arrêt ; les noms de ferme jamais au dépôt ; les notifications dès S2 ; une semaine d'observation par ferme.

**Reste au porteur** [RÉSERVÉ] : le choix et le contact des fermes (F578) ; l'envoi et la garde des accords (F572) ; la relecture juridique (E6) ; l'ajout et le retrait des personnes dans Access, la pose des secrets et la lecture du tableau de bord (contrainte 3) ; la **part du quota** (E3, **à poser à partir du 3 décembre 2026**, budget et fond) ; la participation d'après le pilote (budget) ; toute valeur agronomique demandée par une ferme ; le « vas-y » de la fiche d'entrée ; le jugement du bilan et toute ouverture.

##### La 4.7

La 4.7 (« identité OTF ou multi-structure ») **n'a pas de contrat propre** : son hébergement est fait par Q0, son identité est absorbée par 4.1 à 4.3 (section 4 ; F350 : « la 4.7 se ferme avec la 4.3 »). Elle se ferme **par les registres de la PR qui clôt la 4.3** (PR 4, F370), sans code ; la roadmap le dit dès maintenant.

## 11. Rapport avec la fusion des moteurs (à ne pas empiéter)

La Tranche 4 **ne modifie pas le moteur hydrique** : bilan, pluie utile, observations, jeux de réglages relèvent du contrat commun (MC-17 à MC-27, brouillon v0.2.1, relecture par Nicolas). Points de contact **à surveiller, sans les traiter ici** :

- Si la phase 1 du moteur commun change l'interface du moteur avant 4.4, l'accueil lit les valeurs par défaut **par l'interface**, pas en dur.
- Les valeurs par défaut propres à une ferme (section 7) peuvent recouper les « jeux de réglages » ; l'inventaire **signale** le recoupement, la décision appartient au chantier de fusion.
- 4.1 à 4.3 (identité, isolation, jeton) **ne dépendent pas** du moteur : elles peuvent commencer avant la fin de la fusion ; le code de la fusion (Opus 5.5 · Max) reste prioritaire sur la place de code libre. **Depuis le 17 novembre 2026 (D-154)**, la Tranche 4 entière n'attend plus la fusion, et les deux chantiers avancent ensemble, chacun dans son dépôt.

À relire à chaque lancement : l'état de la fusion dans le dépôt (`docs/shared-engine-cases-contract.md` et le dépôt commun), pas ce brouillon.

## 12. Questions pour François (une par message, « n sur 4 », avec recommandation)

**Règle expresse de François (15/11/2026, 15 h 18) : toute question qui touche son budget est posée à part et ne se tranche JAMAIS par un « d'accord avec toutes vos recommandations », même dans un lot. Marque : [BUDGET]. Ici : questions 1, 2 et 4 ; la 3 n'en est pas une.**

1. **[BUDGET] TRANCHÉE par François le 15/11 à 15 h 19 : pas de domaine payant, adresse gratuite `workers.dev` sur son compte Cloudflare existant ; changement d'hébergement seulement en cas d'engouement.** (Question d'origine : adresse du site définitif** : domaine propre (≈ 10 à 15 €/an) ou garder `workers.dev` ? *Recommandation : domaine propre, acheté et rattaché à Cloudflare par vous (achat = budget, action sur Cloudflare = « vas-y »), avant le formulaire. Raison : l'adresse de retour OAuth ne doit plus changer.*
2. **[BUDGET] TRANCHÉE par François le 15/11 à 15 h 20 : gratuit pendant le pilote.** (Question d'origine : Qui paie l'hébergement d'une ferme tierce ?** *Recommandation : gratuit pendant le pilote (≈ 5 $/mois pour l'ensemble), à rouvrir à partir d'une dizaine de fermes ou si Access dépasse 50 utilisateurs.*
3. **TRANCHÉE par François le 15/11 à 15 h 21 : des fermes amies, pas seulement Nicolas et Vincent ; il en contactera d'autres lui-même (noms à venir, accord écrit de chacune).** (Question d'origine : Quelles fermes pour le pilote ? *Recommandation : une ou deux fermes amies que vous connaissez, avec accord écrit (Vincent, développeur d'OTF, et Nicolas sont déjà invités à la démonstration ; ils ne sont pas des fermes pilotes par défaut), après 4.5.* (Contact extérieur : à vous.)
4. **[BUDGET] TRANCHÉE par François le 15/11 à 15 h 30 : relecture par un professionnel souhaitée, **gratuite** (réseau de François, « un pack de bière »), pas de solution pour l'instant ; elle viendra, pas tout de suite. Aucun paiement sans nouvel accord exprès de sa part.** (Question d'origine : Relecture juridique de la politique de confidentialité** et des conditions : faire relire par une personne compétente avant d'ouvrir à des fermes tierces ? *Recommandation : publier un texte sobre et exact pour le formulaire, et le faire relire avant le pilote (budget éventuel, à vous).*

**Tranchées sur la recommandation dans ce brouillon** (non agronomiques, recherches du 7/11 et du 9/11) : OAuth principal et clé personnelle en secours (T4-09, T4-10) ; un propriétaire par ferme (T4-04) ; Access conservé (T4-05) ; jetons chiffrés par défaut, déploiement propre pour qui refuse ; démonstration séparée sur invitation (déjà en ligne) ; ordre de la section 4. **Tout cela est modifiable à la relecture.**

**Non posées** : toute question agronomique (valeurs par défaut pour d'autres fermes) sera posée **après l'inventaire** de la section 7.

**Conséquence (à valider) :** le formulaire d'OTF peut partir avec le texte non relu ; **aucune ferme tierce n'est reliée tant que la relecture n'est pas faite** (condition de 4.6).

## 13. Preuves de fin (à reprendre dans chaque sous-tranche)

| Sous-tranche | Preuve |
| --- | --- |
| Préparation | inventaire déposé ; mesure d'appels par jour consignée ; conditions d'OTF relues ; questions 1 à 4 tranchées |
| 4.8 | pages en ligne à l'adresse définitive (vérifié job par job) ; formulaire OTF **envoyé par François** ; parcours aux deux largeurs ; texte relu par François |
| 4.1 + 4.2 | tests d'isolation à deux fermes verts ; liste des requêtes relue ; régulateur par ferme testé ; aucune migration qui perde une donnée (essai sur copie) |
| 4.3 | OAuth essayé de bout en bout sur « Ferme v2 » n° 4394 ; jeton jamais visible (test sur réponses et journaux) ; renouvellement concurrent testé ; révocation côté OTF gérée ; quota atteint géré |
| 4.4 | un essai réel de parcours complet sur une ferme neuve, deux largeurs ; fermes exclues bien dites |
| 4.5 | **restauration réelle** d'une sauvegarde ; suppression d'une ferme vérifiée ; coûts relus |
| 4.6 | accord écrit ; recette conforme ; isolation constatée ; retour consigné |

## 14. Risques

| Risque | Gravité | Réponse |
| --- | --- | --- |
| Fuite entre fermes | très grave, discrète | T4-03, T4-06, revue dédiée, pilote en lecture seule |
| Fuite de la clé maîtresse | très grave | secret Cloudflare, rotation essayée, déploiement propre possible |
| OTF tarde, refuse ou change ses conditions | moyen à grave | voie de secours T4-10 ; tests de contrat T4-15 ; question n° 4 de la recherche toujours ouverte |
| Quota quotidien dépassé (100/jour) | moyen, probable | mesure d'abord, budget par ferme, repli sur le cache (T4-14) |
| Course sur le renouvellement du jeton | moyen | verrou par ferme (T4-13) |
| Access payant au-delà de 50 utilisateurs | moyen | un propriétaire par ferme ; alerte à 40 (T4-05) |
| Texte de confidentialité inexact | moyen | relecture (question 4) ; texte fondé sur ce que fait réellement le code |
| Support par une seule personne | moyen | suivi par ferme, démonstration, aide en contexte, pilote limité à 1–2 fermes |
| Conditions d'OTF non tranchées (API appelée, pas code réutilisé) | à clarifier | à relire à la main ; question posée à OTF |
| Recoupement avec la fusion des moteurs | moyen | section 11 |

## 15. Ce qui n'est pas établi (à dire, pas à deviner)

- Texte intégral des conditions d'utilisation d'OTF (seulement un résumé) ; absence de conditions écrites propres à l'API.
- Page « vue d'ensemble » de l'authentification d'OTF (illisible le 7/11).
- Champs exacts de `GET /me` ; correspondance route → droit ; comportement exact du renouvellement et de la révocation.
- Consommation quotidienne réelle d'appels OTF du module (**estimée** ici, non mesurée).
- Coût d'un fournisseur météo par ferme ; coût d'un domaine propre ; possibilités de restauration D1.
- Si les 50 premiers utilisateurs Access restent gratuits au-delà du seuil.
- Tout avis juridique (RGPD, responsabilité).
- Rien de ce brouillon n'a été codé, essayé sur une ferme réelle, ni envoyé à OTF.

## 16. À consigner une fois le contrat validé (par une PR de registres, pas maintenant)

Décision(s) D-xxx pour T4-01 à T4-20 ; ligne 25 et section 6 de la roadmap (4.8, ordre, 4.7 absorbée) ; `docs/ETAT_DU_PROJET.md`. Aucune PR ouverte par ce fil.
