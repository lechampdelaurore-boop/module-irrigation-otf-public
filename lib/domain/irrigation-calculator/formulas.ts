import { fractionFromPercent, millimetersPerHourFromLitersPerHour, percentFromFraction } from '../units';

/**
 * Les formules du calculateur, une seule fois (docs/irrigation-calculator-contract.md,
 * sections 5 et 6, section 12 : la formule vit en un seul endroit). Elles
 * reçoivent des nombres déjà validés et ne les arrondissent pas.
 */

/** Goutte-à-goutte par planche : `n × (q ÷ e) ÷ w`, en mm/h (section 5 a). */
export function dripPerBedTheoreticalRate(lineCount: number, emitterFlowLitersPerHour: number, emitterSpacingMeters: number, bedWidthMeters: number): number {
  return millimetersPerHourFromLitersPerHour(lineCount * (emitterFlowLitersPerHour / emitterSpacingMeters), bedWidthMeters);
}

/** Le débit d'une planche d'un mètre de long : `n × q ÷ e`, l/h (eau pompée, section 8). */
export function dripPerBedFlowPerMeter(lineCount: number, emitterFlowLitersPerHour: number, emitterSpacingMeters: number): number {
  return lineCount * emitterFlowLitersPerHour / emitterSpacingMeters;
}

/**
 * Goutte-à-goutte par vanne : `N × L × q ÷ e`, l/h (section 5 b). Le nombre de
 * goutteurs est pris en continu (`L ÷ e`) : une estimation, dite dans « Voir
 * le calcul ».
 */
export function dripValveFlow(lineCount: number, lineLengthMeters: number, emitterFlowLitersPerHour: number, emitterSpacingMeters: number): number {
  return lineCount * lineLengthMeters * emitterFlowLitersPerHour / emitterSpacingMeters;
}

/** Goutte-à-goutte par vanne : `q ÷ (e × g)`, en mm/h. */
export function dripPerValveTheoreticalRate(emitterFlowLitersPerHour: number, emitterSpacingMeters: number, lineGapMeters: number): number {
  return millimetersPerHourFromLitersPerHour(emitterFlowLitersPerHour, emitterSpacingMeters * lineGapMeters);
}

/** Aspersion moyenne : `Q ÷ (s × w)`, en mm/h (section 6.1). */
export function sprinklerMeanTheoreticalRate(sprinklerFlowLitersPerHour: number, spacingMeters: number, wettedWidthMeters: number): number {
  return millimetersPerHourFromLitersPerHour(sprinklerFlowLitersPerHour, spacingMeters * wettedWidthMeters);
}

/** Théorique × `η` : l'efficacité, une seule fois (section 8). */
export function receivedRate(theoreticalRateMmPerHour: number, efficiencyPercent: number): number {
  return theoreticalRateMmPerHour * fractionFromPercent(efficiencyPercent);
}

/**
 * Pluviométrie à la distance `d` d'une rampe longue d'asperseurs en cône
 * (section 6.2) : la somme continue, le long de la rampe, de
 * `p(r) = 3Q ÷ (π R²) × (1 − r ÷ R)`. Avec `a = √(R² − d²)` :
 * `P(d) = 3Q ÷ (π R² s) × [2a − (a R + d² ln((a + R) ÷ d)) ÷ R]`,
 * `P(0) = 3Q ÷ (π R s)`, `P(d ≥ R) = 0`. En mm/h, `Q` en l/h.
 */
export function coneRateAtDistance(sprinklerFlowLitersPerHour: number, reachMeters: number, spacingMeters: number, distanceMeters: number): number {
  const d = Math.abs(distanceMeters);
  const R = reachMeters;
  if (d >= R) return 0;
  if (d === 0) return millimetersPerHourFromLitersPerHour(3 * sprinklerFlowLitersPerHour, Math.PI * R * spacingMeters);
  const a = Math.sqrt(R * R - d * d);
  const bracket = 2 * a - (a * R + d * d * Math.log((a + R) / d)) / R;
  return millimetersPerHourFromLitersPerHour(3 * sprinklerFlowLitersPerHour, Math.PI * R * R * spacingMeters) * bracket;
}

/** Le pas d'intégration de la part d'eau sur une largeur : assez fin pour 0,1 % sur les cas du contrat. */
const CONE_INTEGRATION_STEPS = 400;

/**
 * L'eau qui tombe sur une bande centrée sur la rampe, en % de ce que la rampe
 * apporte par mètre (`Q ÷ s`) : `∫ P` de `−b ÷ 2` à `b ÷ 2` (méthode de
 * Simpson). Sur toute la portée, la forme en cône conserve l'eau : 100 %.
 */
export function coneSharePercent(sprinklerFlowLitersPerHour: number, reachMeters: number, spacingMeters: number, bandWidthMeters: number): number {
  const half = Math.min(bandWidthMeters / 2, reachMeters);
  const step = half / CONE_INTEGRATION_STEPS;
  let sum = 0;
  for (let index = 0; index <= CONE_INTEGRATION_STEPS; index += 1) {
    const weight = index === 0 || index === CONE_INTEGRATION_STEPS ? 1 : index % 2 === 1 ? 4 : 2;
    sum += weight * coneRateAtDistance(sprinklerFlowLitersPerHour, reachMeters, spacingMeters, index * step);
  }
  // Deux côtés ; mm/h × m = L/h par mètre de rampe, comparé à Q ÷ s.
  const bandFlowPerMeter = 2 * (step / 3) * sum;
  return percentFromFraction(bandFlowPerMeter / (sprinklerFlowLitersPerHour / spacingMeters));
}
