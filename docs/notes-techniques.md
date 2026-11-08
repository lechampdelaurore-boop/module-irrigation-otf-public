# Notes techniques du poste et des outils

Pièges rencontrés en travaillant sur le poste Windows du porteur et dans son
navigateur, avec leur remède. Ce ne sont ni des règles métier ni des
contrats : les règles de travail sont dans `AGENTS.md`, l'état du projet dans
`ETAT_DU_PROJET.md`. Reportées ici le 10 octobre 2026 depuis les notes de
travail de l'assistant, pour qu'une reprise sur un autre poste ou un autre
compte les trouve.

## L'heure

- Dans Git Bash, `TZ=Europe/Paris date` renvoie l'heure UTC, sans erreur. Le 3
  octobre 2026, une heure de constat a été consignée avec deux heures de
  retard, puis corrigée (PR #127). Prendre `date -u` et ajouter le décalage —
  deux heures en été, une en hiver —, ou passer par PowerShell :
  `[System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId((Get-Date), 'Romance
  Standard Time')`.
- Les registres s'écrivent à l'heure de Paris (D-004).
- Le poste avance d'environ une minute sur le serveur : la page peut dater un
  calcul d'une minute plus tôt que le poste.

## La forme des registres

- Prose repliée à 78 colonnes ; lignes de tableau et titres exemptés.
  Continuation à trois espaces pour les points numérotés de
  `ETAT_DU_PROJET.md`, à quatre pour les points à deux chiffres de la section
  2 de `ROADMAP.md`, à deux pour les puces.
- Le journal de `ETAT_DU_PROJET.md` est une suite de paragraphes datés : un
  nouveau paragraphe s'insère après le plus récent, les anciens ne sont jamais
  réécrits.
- À chaque édition de la roadmap : la date de la ligne 3 passe au jour même ;
  une ligne de tableau garde un nombre pair de `**` (une tête en gras par
  jalon, détails en clair). Oubli relevé par le porteur le 8 octobre 2026.
- Fins de ligne LF.

## Le serveur de développement

- `pnpm dev` lance vinext, qui écoute sur le port 5173. Le fichier
  `.claude/launch.json` du poste, ignoré par Git, le déclare sous le nom
  `dev` : `node node_modules/vinext/dist/cli.js dev`, port 5173 ; à recréer
  sur un autre poste.
- `.dev.vars`, copié de `.dev.vars.example`, donne les données OTF de
  démonstration, l'utilisateur de démonstration et la météo simulée ; la
  production compilée n'a pas ce contournement.
- Le premier chargement de `/irrigation` peut répondre 500 le temps de la
  compilation : recharger jusqu'au 200 avant toute vérification.
- Ne jamais committer de changement de `compatibility_date` dans
  `wrangler.jsonc`.
- `wrangler d1 execute module-irrigation-otf --local` marche sans connexion
  Cloudflare et sert à fabriquer un cas de test sur la base locale. `--remote`
  demande la connexion du porteur : l'assistant ne l'utilise pas.
- Une session lancée par une tâche planifiée ne peut pas démarrer de serveur ;
  `pnpm e2e`, qui démarre le sien, tient alors lieu de vérification, et la
  recette visuelle se reporte sur la version déployée.

## Les parcours navigateur

- `pnpm e2e` démarre vinext sur `127.0.0.1:3100` et écrit un verrou
  `.vinext/dev/lock.json`, dont la vivacité n'est testée que par le numéro de
  processus. Si un serveur précédent n'a pas libéré le verrou et que son
  numéro a été repris par un autre programme, vinext refuse de démarrer
  (« Another vinext dev server is already running ») et propose un `taskkill`.
  Ne jamais tuer ce processus sans l'identifier. Vérifier que rien n'écoute
  sur le port 3100 (`netstat -ano | grep ":3100 "`) et ce qu'est le
  processus ; si ce n'est pas un serveur du projet, supprimer le verrou,
  ignoré par Git et recréé, puis relancer. Vu le 10 octobre 2026 : le numéro
  désignait un processus du Chrome du porteur.

## Le navigateur du porteur

- **Fenêtre réduite.** Quand la fenêtre qui porte l'onglet de l'extension est
  réduite, la page est « cachée » : les captures d'écran expirent, les clics
  réels n'arrivent pas, les minuteries sont ralenties et un script qui attend
  par minuterie se fige. Remède : `element.click()` sur le vrai bouton, puis
  laisser React rendre par des tours de file de messages (`MessageChannel`),
  attendre en relisant `performance.now()`, relire la page après chaque étape.
- **Formulaires.** Invisibles à l'arbre d'accessibilité, qui est de toute
  façon tronqué avant le bas de la page d'irrigation : les remplir par script
  avec le setter natif de `value` (`HTMLInputElement`, `HTMLSelectElement`)
  suivi des événements `input` et `change`, puis cliquer le bouton d'envoi.
- **Sorties de script.** Tronquées vers 1 500 caractères ; une sortie qui
  contient `?`, `=` ou `&` peut être bloquée : la résumer et l'assainir avant
  de la rendre. Un appel expire à 45 s : lancer un recalcul sans l'attendre,
  puis sonder l'état « occupé » de la section.
- **Texte.** Les apostrophes typographiques de la page font échouer les
  recherches de texte écrites avec une apostrophe droite.
- **Largeur 390 px.** Une fenêtre maximisée refuse le redimensionnement : la
  largeur de téléphone se vérifie par le parcours P10 ou dans un cadre de
  390 px inséré dans la page.
- **Onglets.** Fermer le dernier onglet du groupe de l'extension dissout le
  groupe ; un onglet qui en sort reste ouvert dans le Chrome du porteur, à lui
  signaler.

## La documentation de l'API OTF

- Publiée sur GitBook, https://ouvretaferme.gitbook.io/ouvretaferme, et
  référencée nulle part ailleurs ; lien fourni par le porteur le 26 septembre
  2026. Index dans `/llms.txt`, corpus entier dans `/llms-full.txt` ; chaque
  page se lit en markdown en ajoutant `.md` à son adresse. Pages utiles :
  `endpoints/production/plan/planches.md`,
  `endpoints/production/plan-de-culture/` (emplacements, séries, tâches, mises
  en culture, récoltes), `endpoints/endpoints.md`,
  `authentification/scopes.md`.
- L'éditeur la dit en bêta, à ne pas encore utiliser en production.

## Les outils de l'assistant

- Un script de plus de quelques lignes, ou qui contient des antislashs et des
  accents graves, s'écrit dans un fichier puis se lance par `node` : un long
  heredoc a fait échouer le shell le 8 octobre 2026. Les heredocs courts —
  message de commit, corps de PR — passent.
