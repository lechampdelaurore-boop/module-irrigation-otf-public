import { waterText } from './figure-origin.ts';

/**
 * La bulle « d'où vient ce chiffre » du stock disponible d'une réserve (3.8,
 * docs/feature-selection-contract.md, section 6 ;
 * docs/water-resources-contract.md) : le volume projeté et ses termes, tels
 * que la projection les a calculés, moins le minimum de sécurité. Elle vit à
 * côté de `water-resources.ts`, qui porte le calcul et n'a plus la place.
 */
export function availableAfterPlanningOrigin(
  projection: {
    startVolumeCubicMeters: number | null;
    afterPlanningEndVolumeCubicMeters: number | null;
    afterPlanningMobilizableCubicMeters: number | null;
    forecastRainCubicMeters: number;
    estimatedEvaporationCubicMeters: number;
    plannedConsumptionCubicMeters: number;
  },
  minimumSafetyCubicMeters: number,
): string | null {
  const { startVolumeCubicMeters: start, afterPlanningEndVolumeCubicMeters: end, afterPlanningMobilizableCubicMeters: available } = projection;
  if (start === null || end === null || available === null) return null;
  const floor = available === 0 ? ' (jamais moins de 0)' : '';
  return `Volume projeté à la fin de l’horizon ${waterText(end, 'm³')} − minimum de sécurité ${waterText(minimumSafetyCubicMeters, 'm³')} = ${waterText(available, 'm³')} mobilisables${floor}. `
    + `Le volume projeté part du stock actuel, ${waterText(start, 'm³')}, et suit chaque jour : + apports automatiques acceptés + pluie prévue (${waterText(projection.forecastRainCubicMeters, 'm³')} en tout) − évaporation (${waterText(projection.estimatedEvaporationCubicMeters, 'm³')}) − irrigations planifiées (${waterText(projection.plannedConsumptionCubicMeters, 'm³')}), sans dépasser la capacité de la réserve.`;
}
