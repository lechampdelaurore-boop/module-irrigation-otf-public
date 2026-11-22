/**
 * L'interrupteur du branchement de la jauge sur le moteur hydrique commun
 * (docs/shared-engine-adapter-contract.md, « L'interrupteur et la preuve
 * d'égalité ») : `module`, l'ancien calcul de la jauge ; `commun`, le bilan à
 * un compartiment par le moteur commun, jeu OTF. Il ne change que par une PR.
 * Le rejeu des tests sur `commun` remplace ce fichier par un passage de test
 * (`tests/support/jauge-moteur-commun.mjs`).
 */

export type GaugeEngine = 'module' | 'commun';

export const GAUGE_ENGINE: GaugeEngine = 'module';
