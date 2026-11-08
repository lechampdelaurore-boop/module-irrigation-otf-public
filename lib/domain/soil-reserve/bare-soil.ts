import { metersFromCentimeters } from '../units.ts';
import type { SurfaceCoefficients } from './soil.ts';

/**
 * Une planche sans culture (docs/soil-reserve-contract.md, « Par planche
 * sans culture », D-053) : le modèle de sol nu de la FAO-56 (chapitre 7,
 * simplifié) en deux compartiments — la couche de surface, d'où l'eau
 * s'évapore, et la réserve profonde, que l'évaporation ne touche pas —, et
 * les états de surface, dont l'engrais vert et l'enherbée, suivis sur un
 * seul compartiment de 30 cm comme une culture.
 */

export type SurfaceState =
  | 'bare'
  | 'impermeable-tarp'
  | 'permeable-tarp'
  | 'mulched'
  | 'green-manure-emergence'
  | 'green-manure-partial'
  | 'green-manure-full'
  | 'green-manure-destroyed'
  | 'grass';

/** L'état de surface déclaré d'une planche à partir d'un jour (sa fiche) ; il vaut jusqu'à la prochaine culture. */
export type SurfaceDeclaration = { bedId: string; date: string; state: SurfaceState; recordedAt: string };

/** `two-compartments` : le modèle de sol nu ; `cover` : un couvert qui consomme comme une culture, un compartiment. */
export function surfaceStateModel(state: SurfaceState): 'two-compartments' | 'cover' {
  return state === 'green-manure-emergence' || state === 'green-manure-partial' || state === 'green-manure-full' || state === 'grass'
    ? 'cover'
    : 'two-compartments';
}

/** Un engrais vert levé ou couvrant a un seuil (p 0,5) ; l'enherbée n'en a pas (D-053). */
export function surfaceStateHasThreshold(state: SurfaceState): boolean {
  return surfaceStateModel(state) === 'cover' && state !== 'grass';
}

/** Le Kc d'un couvert, pour sa consommation `ET0 × K_abri × Kc`. */
export function coverKc(state: SurfaceState, coefficients: SurfaceCoefficients): number {
  if (state === 'green-manure-emergence') return coefficients.greenManureEmergenceKc;
  if (state === 'green-manure-partial') return coefficients.greenManurePartialKc;
  if (state === 'green-manure-full') return coefficients.greenManureFullKc;
  if (state === 'grass') return coefficients.grassKc;
  return 0;
}

/** La part de l'évaporation du sol nu qui joue sous l'état de surface ; 0 sous une bâche imperméable. */
export function evaporationShare(state: SurfaceState, coefficients: SurfaceCoefficients): number {
  if (state === 'impermeable-tarp') return 0;
  if (state === 'permeable-tarp') return coefficients.permeableTarpEvaporation;
  if (state === 'mulched' || state === 'green-manure-destroyed') return coefficients.mulchedEvaporation;
  return 1;
}

/** La part de la pluie comptée sous l'état de surface : rien sous une bâche imperméable. */
export function surfaceRainShare(state: SurfaceState): number {
  return state === 'impermeable-tarp' ? 0 : 1;
}

/** Kc maximal d'un sol sans couvert juste après un mouillage (FAO-56, équation 72). */
const BARE_SOIL_KC_MAX = 1.2;

/** Les deux compartiments d'une planche à sa profondeur de référence, en mm. */
export type BareSoilGeometry = {
  tewMm: number;
  rewMm: number;
  /** RFU de la couche de surface : RFU du sol × Ze. */
  surfaceRfuMm: number;
  /** RFU sous la couche de surface, jusqu'à la profondeur de référence. */
  deepRfuMm: number;
};

/** L'état des deux compartiments : l'épuisement de surface De et la réserve profonde, en mm. */
export type BareSoilState = { depletionMm: number; deepMm: number };

export function bareSoilGeometry(input: {
  soilRfuMmPerMeter: number;
  depthM: number;
  surfaceLayerCm: number;
  tewMm: number;
  rewMm: number;
}): BareSoilGeometry {
  const surfaceM = Math.min(metersFromCentimeters(input.surfaceLayerCm), input.depthM);
  return {
    tewMm: input.tewMm,
    rewMm: input.rewMm,
    surfaceRfuMm: input.soilRfuMmPerMeter * surfaceM,
    deepRfuMm: input.soilRfuMmPerMeter * Math.max(0, input.depthM - surfaceM),
  };
}

export function bareSoilCapacity(geometry: BareSoilGeometry): number {
  return geometry.surfaceRfuMm + geometry.deepRfuMm;
}

/** La jauge d'une planche sans culture : `max(0 ; RFU de surface − De) + réserve profonde`. */
export function bareSoilGauge(geometry: BareSoilGeometry, state: BareSoilState): number {
  return Math.max(0, geometry.surfaceRfuMm - state.depletionMm) + state.deepMm;
}

/**
 * Un état t du plein, de 0 à 1, dans les deux compartiments (curseur,
 * passage d'une culture au sol nu) : `De = (1 − t) × TEW`, `réserve profonde
 * = t × capacité − max(0 ; RFU de surface − De)`, pour que la jauge vaille
 * exactement t × capacité ; la réserve profonde reste entre 0 et sa RFU.
 */
export function splitFullness(geometry: BareSoilGeometry, fullness: number): BareSoilState {
  const t = Math.min(1, Math.max(0, fullness));
  const depletionMm = (1 - t) * geometry.tewMm;
  const surfaceWater = Math.max(0, geometry.surfaceRfuMm - depletionMm);
  const deepMm = Math.min(geometry.deepRfuMm, Math.max(0, t * bareSoilCapacity(geometry) - surfaceWater));
  return { depletionMm, deepMm };
}

/** Ce qu'il faut d'apports en un jour pour remplir une planche sans culture inconnue : `TEW + RFU profonde`. */
export function bareSoilFillMm(geometry: BareSoilGeometry): number {
  return geometry.tewMm + geometry.deepRfuMm;
}

/** Ce qui peut encore entrer dans le sol : `De + (RFU profonde − réserve profonde)`. */
export function bareSoilRoomMm(geometry: BareSoilGeometry, state: BareSoilState): number {
  return state.depletionMm + (geometry.deepRfuMm - state.deepMm);
}

/**
 * Un jour du modèle de sol nu, ou la part `fraction` d'un jour après une
 * observation. L'évaporation part de l'épuisement de la veille :
 * `Kr = 1` tant que `De ≤ REW`, sinon `(TEW − De) / (TEW − REW)` ;
 * `E = min(part × Kr × 1,2 × ET0 × K_abri × fraction ; TEW − De)`. Les apports
 * remplissent d'abord la surface, l'excédent va à la réserve profonde,
 * au-delà de sa RFU il est drainé.
 */
export function bareSoilDay(input: {
  geometry: BareSoilGeometry;
  previous: BareSoilState;
  inflowMm: number;
  et0Mm: number;
  shelterFactor: number;
  evaporationShare: number;
  fraction: number;
}): { state: BareSoilState; evaporationMm: number; drainageMm: number } {
  const { geometry, previous } = input;
  const { tewMm, rewMm } = geometry;
  const kr = previous.depletionMm <= rewMm ? 1 : Math.max(0, (tewMm - previous.depletionMm) / (tewMm - rewMm));
  const potential = input.evaporationShare * kr * BARE_SOIL_KC_MAX * input.et0Mm * input.shelterFactor * input.fraction;
  const evaporationMm = Math.max(0, Math.min(potential, tewMm - previous.depletionMm));
  const surfaceFill = Math.min(input.inflowMm, previous.depletionMm);
  const excess = input.inflowMm - surfaceFill;
  const depletionMm = Math.min(tewMm, Math.max(0, previous.depletionMm + evaporationMm - surfaceFill));
  const deep = previous.deepMm + excess;
  return {
    state: { depletionMm, deepMm: Math.min(geometry.deepRfuMm, deep) },
    evaporationMm,
    drainageMm: Math.max(0, deep - geometry.deepRfuMm),
  };
}
