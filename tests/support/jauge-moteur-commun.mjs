// Passage « moteur commun » des tests (docs/shared-engine-adapter-contract.md,
// « L'interrupteur et la preuve d'égalité ») : tous les tests rejoués avec
// l'interrupteur de la jauge sur `commun`, sans en modifier un seul. Le
// résolveur remplace `lib/domain/soil-reserve/gauge-switch.ts` par
// `gauge-switch-commun.ts` ; un test vérifie que le passage a bien pris.
import { register } from 'node:module';

process.env.JAUGE_MOTEUR_ATTENDU = 'commun';
register('./jauge-moteur-commun-hooks.mjs', import.meta.url);
