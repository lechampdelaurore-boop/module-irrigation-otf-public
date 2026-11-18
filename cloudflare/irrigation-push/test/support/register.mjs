// Chargé par `node --import` avant les tests du Worker Push : installe le
// résolveur qui remplace `cloudflare:workers`, absent hors de Cloudflare.
import { register } from 'node:module';

register('./resolve-hooks.mjs', import.meta.url);
