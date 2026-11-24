/**
 * L'interrupteur du branchement de la jauge sur le moteur hydrique commun
 * (docs/shared-engine-adapter-contract.md, « L'interrupteur et la preuve
 * d'égalité ») : `commun`, le bilan à un compartiment par le moteur commun,
 * jeu OTF, depuis la PR 2 ; `module`, l'ancien calcul de la jauge, gardé
 * jusqu'à la PR 3. Il ne change que par une PR. Le rejeu des tests sur
 * `module` remplace ce fichier par un passage de test
 * (`tests/support/jauge-ancien-calcul.mjs`).
 */

export type GaugeEngine = 'module' | 'commun';

export const GAUGE_ENGINE: GaugeEngine = 'commun';
