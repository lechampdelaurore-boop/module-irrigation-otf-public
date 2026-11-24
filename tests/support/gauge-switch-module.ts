// L'interrupteur de la jauge sur `module`, l'ancien calcul, pour le passage
// « ancien calcul » des tests (jauge-ancien-calcul.mjs), gardé jusqu'à la PR 3.
// Même forme que lib/domain/soil-reserve/gauge-switch.ts, qu'il remplace.
export type GaugeEngine = 'module' | 'commun';

export const GAUGE_ENGINE: GaugeEngine = 'module';
