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
change un réglage de Cloudflare, et le porteur peut les changer. Une question lui
est réservée (la voie de secours, F369) ; la part du quota quotidien laissée
au module se fixe après une mesure (F363). Elles reprennent aussi ce que la
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
- **F369 · La voie de secours par clé personnelle collée (T4-10) :
  [À TRANCHER, question 1 sur 1].** T4-10 la réserve au cas où « la
  validation d'OTF tarde au moment où l'isolation est prête ». Option
  recommandée : ne pas la coder tant que le reste du pilote n'est pas prêt
  (relecture juridique, revue de l'isolation, accord écrit des fermes amies,
  part du quota fixée), et seulement si OTF n'a toujours pas validé
  l'application à ce moment-là. Raisons : le pilote attend de toute façon
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

## 7. Généralisation : ce qui est propre à la ferme de François (étape 0)

À inventorier **en lisant le code, sans le modifier**, avant 4.4 ; livrable : un tableau « élément · où · pourquoi propre à la ferme · à généraliser comment · question agronomique ? ». Pistes déjà connues : jeu commun de 32 cultures et correspondance de 78 espèces ; valeurs par défaut (K_abri 0,8, rampes tunnel, 10 mm/h mesuré en serre) ; seuils de gel ; noms de lieux dans les recettes ; commune météo par défaut (siège OTF) ; la RFU en mm/m (62 labo, 51 ferme). **Toute valeur agronomique à choisir pour d'autres fermes est une question réservée à François** (une par message). Règle : pour une ferme nouvelle, **aucune valeur de la ferme de François n'est un défaut silencieux** : soit un catalogue neutre, soit « inconnu, à renseigner ».

## 8. Accueil d'une nouvelle ferme (4.4)

Parcours cible, un écran par étape, reprenable (ferme « pas finie de configurer » sans erreur trompeuse) :

1. Connexion (courriel + code via Access).
2. **Relier la ferme OTF** : « Autoriser le module » ; contrôle immédiat par `GET /me` ; **le nom de la ferme est affiché pour confirmation** ; message si AMAP / abonnement manquant.
3. Saison et commune météo (par défaut : le siège OTF, déjà prévu).
4. Fonctionnalités à cocher (3.8 : « plus de mode simple ou complet ») et matériel et ressources, avec l'aide du catalogue et du calculateur.
5. Correspondance des espèces avec le catalogue (ce qui n'a pas de correspondance reste « inconnu », visible).
6. Vérification finale : tout est vert, ou la liste de ce qui manque.

La **visite guidée** et la démonstration (4.0) servent de formation : aucune nouvelle visite n'est prévue en 4.4 sauf si la recette en montre le besoin. Notifications push **par ferme** ; **clé météo** : communale à toutes les fermes ou par ferme, coût non relevé [À FAIRE, étape 0].

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

## 10. Exploitation (4.5) et pilote (4.6)

**4.5.** Sauvegarde et **restauration D1 essayées pour de vrai** (une sauvegarde qui ne restaure pas est un défaut silencieux ; les possibilités d'historique du service sont [NON VÉRIFIÉ]) ; observabilité par ferme sans données sensibles (taux d'erreurs OTF, quota consommé, dernière synchronisation) ; **suppression complète d'une ferme** (jeton, instantanés, réglages, évènements) vérifiée par test ; page d'état simple pour l'exploitant ; procédure de support (une personne) ; **budget de coûts** relu au tableau de bord un mois après la première ferme (les deux alertes de budget existent). Coût estimé : **≈ 5 $/mois jusqu'à 30 fermes sans Access payant**, le calcul étant le seul poste proche du plafond (mesure réelle du 9/11 : ≈ 307 ms de calcul par requête, 1 000 requêtes par mois et par ferme).

**4.6.** 1 ou 2 fermes amies, d'abord en lecture seule, **accord écrit de chacune**, recette sur chaque écran, preuve d'isolation **en conditions réelles** (A ne voit jamais B), retour des fermes consigné. Aucune ouverture au-delà avant le retour du pilote. Question 3 (section 12).

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
