// L'interrupteur de la jauge sur `commun`, pour le passage « moteur commun »
// des tests (jauge-moteur-commun.mjs). Même forme que
// lib/domain/soil-reserve/gauge-switch.ts, qu'il remplace.
export type GaugeEngine = 'module' | 'commun';

export const GAUGE_ENGINE: GaugeEngine = 'commun';
