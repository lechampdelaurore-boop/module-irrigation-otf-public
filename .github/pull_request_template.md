## Objet

Décrire le résultat attendu et le périmètre réellement modifié. Une PR
restructure ou ajoute, jamais les deux.

## Définition de « terminé » (AGENTS.md)

- [ ] Règles métier écrites dans un contrat de `docs/` avant le code, ou PR sans règle métier
- [ ] Tests qui encodent ces règles, y compris persistance, ajoutés ou ajustés
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` réussis
- [ ] `pnpm push:check` et `pnpm weather:check` réussis, ou sans rapport (dire pourquoi)
- [ ] Recette utilisateur prévue, sur ordinateur et à 390 px si l'interface change
- [ ] Aucun secret, jeton ni donnée personnelle ajouté
- [ ] `docs/ETAT_DU_PROJET.md`, `CHANGELOG.md` et, s'il y a lieu, `docs/DECISIONS.md` à jour

## Contrôles exécutés

Coller les sorties réelles (nombre de tests, résultat de la compilation).

## Non fait, dette, questions ouvertes

Dire explicitement ce qui n'a pas été fait et pourquoi, la dette introduite et
les questions restant ouvertes.
