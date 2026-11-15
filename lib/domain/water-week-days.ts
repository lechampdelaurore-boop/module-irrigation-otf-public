import { millimetersText, volumeText } from './display-numbers.ts';
import type { WaterDashboardDay } from './water-management.ts';

/**
 * Les jours de « Objectifs et besoins » au téléphone (audit ergonomique final,
 * lot D, J3, docs/audit-ergonomie-final-lot-d-contract.md, section 4) : un
 * jour replié tient en une ligne, la date et ce qui s'y est passé ; le détail
 * s'ouvre dessous (F299). Les jours sans irrigation ni pluie ne sont jamais
 * masqués : ils se comptent en une phrase (F301). Rien n'est recalculé : les
 * valeurs sont celles du tableau, avec les mêmes arrondis.
 */

/** Un jour sans irrigation (réalisée, planifiée ou en cours) ni pluie au-dessus de zéro, mesurée ou réanalysée. */
export function isQuietWaterDay(day: WaterDashboardDay): boolean {
  return day.realizedIrrigationCubicMeters === 0
    && day.plannedIrrigationCubicMeters === 0
    && day.estimatedOngoingCubicMeters === 0
    && (day.effectiveActualRainMm === null || day.effectiveActualRainMm === 0);
}

/** « 2,31 m³ arrosés · pluie 4 mm · limite dépassée » ; « sans irrigation ni pluie mesurée » quand rien ne s'est passé. */
export function waterDaySummary(day: WaterDashboardDay): string {
  const parts: string[] = [];
  if (day.realizedIrrigationCubicMeters > 0) parts.push(`${volumeText(day.realizedIrrigationCubicMeters)} arrosés`);
  if (day.estimatedOngoingCubicMeters > 0) parts.push(`${volumeText(day.estimatedOngoingCubicMeters)} en cours`);
  if (day.plannedIrrigationCubicMeters > 0) parts.push(`${volumeText(day.plannedIrrigationCubicMeters)} planifiés`);
  if (day.effectiveActualRainMm !== null && day.effectiveActualRainMm > 0) parts.push(`pluie ${millimetersText(day.effectiveActualRainMm)}`);
  if (parts.length === 0) parts.push('sans irrigation ni pluie mesurée');
  if (day.forecastRainMm !== null && day.forecastRainMm > 0) parts.push(`${millimetersText(day.forecastRainMm)} de pluie prévus`);
  if (day.limitExceededByCubicMeters > 0) parts.push('limite dépassée');
  return parts.join(' · ');
}

/** « 3 jours sans irrigation ni pluie mesurée » ; nul quand chaque jour a de l'eau. */
export function quietWaterDaysText(days: readonly WaterDashboardDay[]): string | null {
  const count = days.filter(isQuietWaterDay).length;
  if (count === 0) return null;
  return `${count} jour${count > 1 ? 's' : ''} sans irrigation ni pluie mesurée`;
}
