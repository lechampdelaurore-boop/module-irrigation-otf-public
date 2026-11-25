import { farmObjectivePartial, farmObjectiveScopeText } from '../farm-objective.ts';
import { mmText } from '../figure-origin.ts';
import type { IrrigationHistorySummary } from './contract.ts';

/**
 * Ce que l'Historique dit de l'objectif et de l'écart d'une période (D-329,
 * docs/simplification-s1-contract.md, section 5 bis, règle 5) : sur quelles
 * planches ils se chiffrent, avec les mots d'« Aujourd'hui ».
 */

/**
 * Sous l'objectif : « 7 planches sur 10 ont un objectif » quand toutes n'en
 * ont pas, puis « objectif posé sur 40/49 journées-planche » quand des jours
 * manquent à ces planches (D-036) ; « Aucun objectif sur la période » sans
 * aucun ; `null` quand chaque planche a un objectif chaque jour.
 */
export function historyObjectiveScopeText(
  summary: Pick<IrrigationHistorySummary, 'objectiveAvailability' | 'objectiveBeds'>,
): string | null {
  const covered = summary.objectiveAvailability.availableBedDays;
  if (covered === 0) return 'Aucun objectif sur la période';
  const parts: string[] = [];
  if (farmObjectivePartial(summary.objectiveBeds)) parts.push(farmObjectiveScopeText(summary.objectiveBeds));
  if (covered < summary.objectiveBeds.bedDays) parts.push(`objectif posé sur ${covered}/${summary.objectiveBeds.bedDays} journées-planche`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * Sous l'écart, quand une partie seulement des planches a un objectif :
 * « Eau reçue par ces 7 planches : 12,4 mm », l'eau que l'écart compare à
 * l'objectif (règle 3) ; `null` sinon, ou quand cette eau est inconnue.
 */
export function historyGapScopeText(
  summary: Pick<IrrigationHistorySummary, 'objectiveBeds' | 'irrigationAndRainMm'>,
): string | null {
  if (!farmObjectivePartial(summary.objectiveBeds) || summary.irrigationAndRainMm === null) return null;
  const count = summary.objectiveBeds.withObjective;
  return `Eau reçue par ${count === 1 ? 'cette planche' : `ces ${count} planches`} : ${mmText(summary.irrigationAndRainMm)}`;
}
