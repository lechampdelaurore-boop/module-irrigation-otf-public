// Passage « ancien calcul » des tests (docs/shared-engine-adapter-contract.md,
// « L'interrupteur et la preuve d'égalité ») : depuis la PR 2, la jauge passe
// par le moteur commun ; tous les tests sont rejoués avec l'interrupteur sur
// `module`, l'ancien calcul, sans en modifier un seul, jusqu'à la PR 3 qui le
// retire. Le résolveur remplace `lib/domain/soil-reserve/gauge-switch.ts` par
// `gauge-switch-module.ts` ; un test vérifie que le passage a bien pris.
import { register } from 'node:module';

process.env.JAUGE_MOTEUR_ATTENDU = 'module';
register('./jauge-ancien-calcul-hooks.mjs', import.meta.url);
