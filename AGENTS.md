# Consignes de travail du dépôt

Ce fichier s'applique à tout le dépôt. Il sert à reprendre le travail sans
rejouer des étapes déjà terminées, et fixe les règles que tout contributeur,
humain ou assistant, respecte. Il fait foi sur la roadmap pour la définition
de « terminé » et pour les interdits.

## Reprise obligatoire

Avant toute modification :

1. lire d'abord la section courte « Où on en est » en tête de
   `docs/ETAT_DU_PROJET.md`, puis, pour ce que la tâche demande seulement, le
   reste de ce document, `docs/ROADMAP.md` et `docs/DECISIONS.md` (reprise
   allégée, voir « Économie de jetons ») ;
2. exécuter `git status --short --branch` et consulter les derniers commits ;
3. vérifier les contrôles déjà consignés dans `docs/ETAT_DU_PROJET.md` ;
4. poursuivre uniquement les points encore ouverts de la tâche courante.

Ne jamais recommencer une migration, une publication ou une recette déjà
marquée comme terminée sans élément nouveau qui le justifie.

## Git, PR et publication

- GitHub, dépôt public `lechampdelaurore-boop/module-irrigation-otf-public`, est
  l'unique source de vérité (D-011, depuis le 8 novembre 2026 ; l'ancien dépôt
  privé `module-irrigation-otf` est une archive en lecture seule : ne jamais le
  rendre public, son historique contient des données personnelles). `main` y est protégée (D-013) : toute modification
  passe par une PR à jour dont les jobs « Application », « Workers
  Cloudflare » et « Parcours navigateur » sont verts (D-026).
- Une fusion dans `main` déploie le site (D-016, `docs/publication.md`) :
  `main` doit donc rester publiable à tout instant.
- L'assistant ouvre les PR et les fusionne lui-même (D-048), une à la fois et
  dans l'ordre, seulement prêtes : jobs verts, branche à jour sans conflit,
  contrôles réels collés ; la suivante après le déploiement vérifié de la
  précédente. Jamais une PR Dependabot seule, ni une PR qui attend une
  décision du porteur ; chaque fusion lui est annoncée en une ligne, avec le
  lien. Ne jamais chercher à contourner la protection.
- Une PR fusionnée ne reçoit plus de commit : vérifier l'état de la PR avant
  de pousser une suite, et repartir d'une branche neuve depuis `main`.
- Branche courte nommée `<type>/<sujet>` : `feat/`, `fix/`, `docs/`,
  `chore/`. Les branches fusionnées sont supprimées automatiquement.
- Commits petits, explicites et réversibles. Ne jamais réécrire l'historique
  partagé ni forcer une publication. Ne jamais enchaîner une suppression après
  une opération non vérifiée.
- À la fin d'une tâche matérielle, mettre à jour `docs/ETAT_DU_PROJET.md` et
  `CHANGELOG.md`, et `docs/DECISIONS.md` si une décision a été prise.

## Définition de « terminé »

Terminé veut dire testé. Une sous-tranche ou une correction est terminée
lorsque, dans l'ordre :

1. les règles métier sont écrites dans un contrat de `docs/` avant le code ;
2. les tests qui encodent ces règles existent et passent, y compris les tests
   de persistance concernés ;
3. les contrôles ci-dessous réussissent, ainsi que les parcours navigateur dès
   que la sous-tranche Q5 existe ;
4. la recette utilisateur prévue est réalisée sur ordinateur et à 390 px de
   large lorsque l'interface change, sur données réelles lorsque la règle le
   permet ;
5. `docs/ETAT_DU_PROJET.md`, `CHANGELOG.md` et, s'il y a lieu,
   `docs/DECISIONS.md` sont à jour ;
6. le compte rendu contient les sorties réelles des contrôles, ce qui n'a pas
   été fait, la dette introduite et les questions ouvertes.

Tant qu'un de ces points manque, l'état reste 🟡, quel que soit l'avancement du
code. Ne jamais annoncer comme terminé ou vérifié ce qui n'a pas été exécuté.

## Contrôles avant clôture

Exécuter au minimum :

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm knip
pnpm push:check
pnpm weather:check
pnpm e2e
```

`pnpm e2e` joue les parcours navigateur (docs/browser-journeys-contract.md). Il
demande un navigateur installé une fois pour toutes par
`pnpm exec playwright install chromium`, remet la base locale à zéro et démarre
son propre serveur. Il est sans rapport avec une PR qui ne touche ni l'interface
ni les services qu'elle appelle.

Un contrôle peut être omis seulement s'il est sans rapport avec la
modification ; l'omission et sa raison sont alors consignées dans
`docs/ETAT_DU_PROJET.md`.

## Sécurité

- Ne jamais ajouter de clé, jeton, cookie, secret D1 ou valeur VAPID au dépôt,
  aux journaux, aux URL ou à la documentation. Les exports de base
  (`*.d1-export.json`) ne sont jamais versionnés.
- L'assistant ne voit, ne saisit et ne journalise jamais les identifiants, clés
  ou jetons du porteur : le porteur les saisit lui-même (`wrangler secret put`,
  secrets GitHub). Les secrets partagés entre composants sont générés et posés
  par script sans jamais être affichés.
- Cloudflare Access authentifie chaque requête (`app/access-auth.ts`). La route
  interne météo n'accepte que son jeton partagé, comparé en temps constant. Les
  Workers se parlent par liaisons de service, jamais par leur adresse publique.
- Ne jamais désactiver un antivirus ni une protection du poste ; ne pas explorer
  la machine ou les comptes du porteur au-delà de la tâche.

## Règles métier invariantes

Issues du cahier des charges et des décisions consignées ; une règle ne change
que par une nouvelle décision dans `docs/DECISIONS.md`.

- OTF reste la source de référence du plan de ferme (D-001). Le connecteur OTF
  est exclusivement serveur, limité à la liste blanche existante et aux
  requêtes `GET`, à quatre appels par seconde au plus (D-002).
- Préserver l'isolation par utilisateur, exploitation, saison et semaine.
- Une donnée inconnue reste `null` ou explicitement indisponible ; elle ne
  devient jamais silencieusement zéro (D-003).
- Les semaines vont du lundi au dimanche et les dates métier utilisent le
  fuseau `Europe/Paris` (D-004).
- Prévu, estimé et observé sont trois natures de données distinctes, jamais
  confondues dans une même valeur ni un même libellé. La réalité prime sur la
  prévision. L'historique est immuable (D-006) : un enregistrement conserve le
  matériel et le réglage tels qu'ils ont été utilisés.
- L'objectif hydrique est fixé en millimètres par semaine, historisé et
  proratisé par jour ; il n'existe pas de niveaux qualitatifs.
- Le besoin se calcule à partir de l'objectif seul : écart = objectif −
  (irrigation réelle + pluie réelle), positif en cas de déficit. L'ET0 est une
  information affichée, jamais un terme du besoin ni de l'écart (D-010).
- Les millimètres ne s'additionnent pas entre surfaces : à l'échelle du
  jardin, de la parcelle ou de l'exploitation, ils sont pondérés par la
  surface, `Σ(mm × m²) / Σ(m²)` ; les volumes, eux, s'additionnent.
- La pluie mesurée au pluviomètre, saisie manuellement, y compris `0 mm`,
  prime sur la réanalyse et la prévision et n'est jamais écrasée par une
  synchronisation. Sous abri, la pluie vaut explicitement `0`.
- Une restriction bloque les nouvelles irrigations planifiées ou démarrées ;
  une irrigation réelle déjà faite reste toujours enregistrable, son
  dépassement signalé, jamais masqué ni corrigé.
- Deux séries culturales sur une même planche reçoivent chacune la totalité des
  millimètres de la planche ; il n'y a pas de répartition entre séries.
- Une ressource en eau porte trois contraintes distinctes, jamais fondues en un
  seul nombre : le débit de production (m³/h), le stock disponible (m³) et le
  débit d'utilisation, c'est-à-dire la capacité de la pompe (m³/h). Une limite
  de prélèvement (m³/jour) s'y ajoute sans les remplacer.
- La réserve du sol (RFU) est une information : sa jauge, estimée ou prévue,
  ne devient jamais un terme du besoin, du planning, des priorités ni de la
  dose ; son seuil et sa dose conseillée s'affichent sans rien régler ; une
  observation du maraîcher la règle, la réserve d'eau de la ferme ne se
  confond pas avec elle (D-041, D-047).
- Le besoin calculé par culture et par stade (ETM) est un objectif
  **proposé** : il n'entre dans le besoin que par une révision d'objectif que
  l'utilisateur adopte ; un objectif qui suivrait la proposition sans son
  geste demande une décision nouvelle (D-010, D-045).
- Les unités sont explicites dans les noms et les libellés : mm, m², m³, m³/h,
  minutes ou secondes.

## Interdits

- Nombre magique d'unité (`1000`, `60`, `3600`, `10`…) dans le code métier ou
  l'interface : toute conversion passe par une fonction nommée d'un module de
  conversion (centralisé par la sous-tranche Q3 ; jusque-là, une constante
  nommée et commentée dans le module qui l'utilise).
- Duplication d'une règle métier : une règle vit en un seul endroit, dans
  `lib/domain/`, et y est testée ; l'interface et la persistance l'appellent.
- Franchir une frontière de zone : `lib/domain/` n'importe que `lib/domain/`,
  `lib/adapters/` n'importe pas `db/`, les composants clients n'importent
  `db/` qu'en type, rien n'importe `app/` (`docs/boundaries-contract.md`).
- Changement opportuniste : ne pas modifier ce que la tâche n'exige pas, même
  pour « améliorer au passage ». Noter l'idée dans le compte rendu.
- Refactor mêlé à une fonctionnalité : une PR restructure ou une PR ajoute,
  jamais les deux.
- Contourner un contrat métier par une requête ad hoc.
- Réintroduire l'ET0 dans un calcul de besoin ou d'écart sans décision.
- Modifier une migration déjà fusionnée, ou écrire une migration destructive
  hors la procédure exceptionnelle de `docs/migrations-contract.md`.
- Annoncer testé, vérifié ou terminé ce qui ne l'a pas été.
- Employer le modèle Fable, pour toute tâche (coordination, fils, code,
  documents) : interdit depuis le 1er novembre 2026 (D-055). Tout ce qui était prévu en Fable
  passe en Opus 5.5 · Max, quel que soit l'effort d'avant ;
  Sonnet 5.5 reste pour le travail sans code.

## Registres

Quatre registres disent l'état du projet : `docs/ETAT_DU_PROJET.md`,
`docs/ROADMAP.md`, `docs/DECISIONS.md` et `CHANGELOG.md`. Ils sont la seule
partie du dépôt qu'aucun outil ne vérifie : le code est tenu par les tests, les
frontières et la taille des fichiers par le lint, la feuille de style par ses
propres tests. Les registres, eux, ne tiennent que par la discipline. D'où la
règle.

**Toute PR qui change l'état du projet met les registres à jour dans la même
PR.** Le déclencheur n'est pas « une sous-tranche est close » : c'est « ce que
les registres affirment n'est plus vrai ». Une recette qui avance, un point
ouvert qui se ferme, une décision prise, une estimation démentie comptent
autant qu'une sous-tranche.

Dans `ROADMAP.md`, c'est **trois endroits** à chaque fois, et l'oubli porte
presque toujours sur l'un des deux premiers :

1. le tableau d'état de la section 1 ;
2. l'ordre d'exécution de la section 2 ;
3. le bloc détaillé de la sous-tranche concernée.

Un registre qui ment est pire qu'un registre absent : on le croit. L'oubli du
21 septembre 2026 — la roadmap annonçant deux points ouverts à fermer alors que
l'un venait de l'être — a été rattrapé par la lecture du porteur, pas par un
contrôle.

## Consignes du porteur

Données en séance par le porteur, reportées ici le 10 octobre 2026 pour qu'une
reprise sur un autre poste ou un autre compte les trouve ; elles valent comme
le reste de ce fichier. Les pièges techniques du poste et des outils, avec
leur remède, sont dans `docs/notes-techniques.md`.

- **À qui l'on parle.** Le porteur n'est pas technicien, dicte souvent à la
  voix et ne relit pas le code : lui écrire en français, en le vouvoyant, en
  phrases simples, sans jargon non expliqué. Il ne peut pas se permettre un
  code médiocre : la qualité et la vérifiabilité passent avant la vitesse.
- **Rien ne démarre sans son mot.** Une sous-tranche de la roadmap ne commence
  que sur son « vas-y ». Quand il pose une question, répondre et s'arrêter :
  l'évaluation est le livrable, pas une correction. Un point ouvert se tranche
  par lui ; l'assistant recommande, raisons à l'appui.
- **La 3.8 se prépare avec lui.** Quand la 3.7 est terminée, le prévenir
  explicitement avant la 3.8, réorganisation de l'interface qu'il veut
  vérifier lui-même de fond en comble ; ne jamais la commencer seul.
- **Modèle et effort** (D-049). Avant toute conversation ou tâche, lire dans
  `docs/ROADMAP.md` la colonne « Modèle · effort » de la sous-tranche visée,
  jamais de mémoire, et régler la session exactement dessus. Jamais un réglage
  inférieur ; tout écart se demande au porteur avant de commencer, jamais
  après. Une conversation qui reprend vérifie son réglage et s'arrête s'il ne
  respecte pas la roadmap. La grille suit les quatre critères de la roadmap,
  jamais le plus fort par défaut ; toute recommandation porte sa raison. Seul
  le porteur change le modèle ou l'effort, en le nommant.
- **Suivre chaque PR jusqu'à sa fusion** (consigne du 10 octobre 2026).
  L'assistant suit toute PR qu'il ouvre jusqu'à sa fusion ou sa fermeture :
  jobs de la CI, commentaires, conflits avec `main`. Un job rouge ou un
  conflit se corrige et se pousse sans attendre ; une demande qui dépasse la
  tâche est soumise au porteur. Une PR prête se fusionne selon D-048.
  Après chaque ouverture ou poussée, surveiller soi-même la fin des contrôles
  (`gh run watch` en arrière-plan), sans se fier au seul avis de GitHub, qui
  peut se perdre (consigne du 30 octobre 2026).
- **Après chaque fusion.** Attendre la fin du déploiement et le vérifier job
  par job (D-016) avant de l'inviter à regarder ou de consigner quoi que ce
  soit ; revenir sur `main` et supprimer la branche locale ; replier
  « fusionnée et déployée » dans les registres de la PR suivante. Une PR de
  registres ne peut pas annoncer sa propre fusion : l'historique Git en fait
  foi.
- **Fin de PR.** Chaque compte rendu dit où en est la roadmap, d'après le
  tableau de la section 1 et l'ordre de la section 2, jamais de mémoire : la
  sous-tranche, son état, le point ouvert traité, ce qui vient ensuite.
- **Recette : le constat à l'assistant, le jugement au porteur** (D-014).
  Seulement après le déploiement de la version concernée : un essai sur
  l'ancienne version ne prouve rien. L'assistant fait les constats lui-même,
  dans le navigateur du porteur, sans lui demander de lire des chiffres ; la
  recette écrit qui a constaté quoi et laisse au porteur ce que lui seul peut
  juger. Tant que le logiciel n'est pas en service, les données de la ferme
  sont expérimentales et l'assistant peut les modifier pour ses essais
  (consigne du 5 octobre 2026), à condition de relever l'état de départ,
  d'écrire l'attendu avant chaque calcul et de tout remettre en état par
  l'écran, un dernier calcul retrouvant le plan du départ.
- **Le navigateur du porteur.** Utilisé sur son autorisation, pour le site et
  pour lire le tableau de bord Cloudflare, jamais pour y changer un réglage ni
  pour se déconnecter ; fermer les onglets ouverts. Ne jamais consigner
  l'identifiant du compte Cloudflare, les identifiants de requête des journaux
  ni l'adresse électronique du porteur, visible dans l'en-tête du site :
  aucune capture du site n'est versionnée.
- **Le poste du porteur.** Ne jamais arrêter un processus qui n'est pas un
  serveur du projet. `gh` y est connecté sous le compte du porteur : ne jamais
  fusionner, activer la fusion automatique, commenter une PR ni relancer un
  job sans son mot.
- **Économie de jetons** (consignes du porteur du 31 octobre 2026, qui
  restent des réglages de coût : aucune ne réduit une vérification exigée
  ailleurs dans ce fichier).
  - *Grille.* Le travail sans code (recherche documentaire, registres,
    contrats, roadmap) se fait exactement en Sonnet 5.5 · Moyen, la grille
    générale de la roadmap, sans prendre plus haut ; un autre réglage se
    demande au porteur avant de commencer (D-049).
  - *Pas de PR pour un déploiement seul.* Une PR n'est pas ouverte rien que
    pour consigner un déploiement : il est consigné dans la PR suivante qui a
    un vrai contenu, les registres pouvant avoir quelques heures de retard sur
    ce seul point.
  - *Surveillance.* La vérification des jobs et du déploiement ne se fait
    qu'une fois toutes les cinq minutes au plus, jamais en continu.
  - *Pas de fil d'avance à vide.* Un fil d'avance (contrat, par exemple) ne
    se lance que s'il peut produire quelque chose d'utile sans attendre la
    relecture ou la réponse du porteur ; sinon on attend. Le code de la
    prochaine sous-tranche, lui, ne s'arrête pas faute de lancement.
  - *Reprise allégée.* On lit « Où on en est » d'abord (voir « Reprise
    obligatoire ») ; cette section est mise à jour par toute PR qui change
    l'état du projet.
  - *Questions une par une.* Quand plusieurs questions sont posées au porteur
    (relecture, choix, précisions), elles le sont une par message, chacune
    avec sa recommandation, numérotées sur le total annoncé dès la première
    (« 1 sur 19 », « 2 sur 19 »…) ; si une question s'ajoute en route, le
    total est corrigé et signalé.
- **Une PR par point ouvert**, sauf s'il demande de regrouper. Une PR de
  registres seule consigne « aucun contrôle rejoué » dans
  `docs/ETAT_DU_PROJET.md`.

## Fin de tâche

Le compte rendu précise : fichiers importants modifiés, contrôles exécutés
avec leurs sorties réelles, dernier commit, état de publication, ce qui n'a
pas été fait et pourquoi, dette introduite, points restant réellement ouverts,
et où en est la roadmap : la sous-tranche en cours ou la suivante, son état,
le point ouvert traité (consigne du porteur du 9 octobre 2026). Si le travail
s'interrompt, mettre le registre d'état à jour avant toute autre opération dès
que possible.
