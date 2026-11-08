// Chargé par `node --import` avant les tests : installe le résolveur de
// modules qui permet d'exécuter le code de `db/` et `lib/` sous Node.
import { register } from 'node:module';

register('./resolve-hooks.mjs', import.meta.url);
