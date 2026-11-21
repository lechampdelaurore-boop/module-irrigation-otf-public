import type { FlowCause, GapDirection, ObjectiveCause, RainCause, SettingRates } from './applied-water-gap.ts';
import { millimetersText } from './display-numbers.ts';
import { rateText } from './figure-origin.ts';
import type { SprinklerProfilePoint } from './irrigation-domain.ts';

/**
 * Les mots du bloc « L'eau apportée s'écarte du prévu » (amélioration n° 5,
 * docs/ameliorations-4-5-contract.md, §4.2 et §4.3, F734, F735) : ils
 * mettent en phrases ce que le domaine a déjà calculé, sans rien recalculer.
 */

const decimal = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const whole = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const PERCENT = 100;

export const GAP_BLOCK_TITLE = 'L’eau apportée s’écarte du prévu';

/** Les trois causes, dans les mots du contrat (F734). */
export const GAP_CAUSE_TITLES: Record<'flow' | 'objective' | 'rain', string> = {
  flow: 'Débit réel du matériel plus faible que celui réglé',
  objective: 'Objectif plus haut que le besoin de la culture',
  rain: 'Pluie mesurée différente de la réanalyse',
};

/** Aucune cause soutenue par les données (F734). */
export const UNDETERMINED_CAUSE = 'Cause non déterminée';

export function gapDirectionText(direction: GapDirection): string {
  return direction === 'more' ? 'Plus d’eau apportée que prévu, trois semaines de suite' : 'Moins d’eau apportée que prévu, trois semaines de suite';
}

/** « +50 % », « −30 % » : l'écart d'une semaine, à l'unité. */
export function gapPercentText(percent: number): string {
  const rounded = Math.round(percent);
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '';
  return `${sign}${whole.format(Math.abs(rounded))} %`;
}

/** « 6 mm/h » ; en aspersion, chaque point du profil : « à gauche 10 mm/h à 0 m, 6 mm/h à 2 m ; à droite … ». */
export function settingRatesText(rates: SettingRates): string {
  if (rates.kind === 'drip') return rateText(rates.rateMmPerHour);
  const side = (points: readonly SprinklerProfilePoint[]) => points
    .map((point) => `${rateText(point.rateMmPerHour)} à ${decimal.format(point.distanceMeters)} m`)
    .join(', ');
  return `à gauche ${side(rates.leftProfile)} ; à droite ${side(rates.rightProfile)}`;
}

/** Ce que les irrigations disent du débit (F734, point 1). */
export function flowCauseText(cause: FlowCause): string {
  const longer = Math.round((1 / cause.durationRatio - 1) * PERCENT);
  return `${cause.irrigations} irrigations de ${cause.equipmentName}, prévues puis faites en entier avec le réglage « ${cause.settingName} », `
    + `ont duré plus longtemps que prévu : ${whole.format(longer)} % de plus en médiane.`;
}

export function objectiveCauseText(cause: ObjectiveCause): string {
  return `Objectif de la semaine : ${millimetersText(cause.objectiveMm)} ; objectif proposé d’après les cultures : ${millimetersText(cause.proposedMm)}.`;
}

export function rainCauseText(cause: RainCause): string {
  const measuredDays = cause.measuredDays > 1 ? `${cause.measuredDays} jours mesurés` : 'jour mesuré';
  const without = `${cause.daysWithoutMeasure} jour${cause.daysWithoutMeasure > 1 ? 's' : ''} sans mesure`;
  return `Sur ${cause.measuredDays > 1 ? 'les' : 'le'} ${measuredDays} de ces trois semaines : ${millimetersText(cause.measuredMm)} au pluviomètre `
    + `contre ${millimetersText(cause.reanalysisMm)} de réanalyse. ${capitalize(without)}, où le plan a compté la réanalyse.`;
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase('fr-FR') + text.slice(1);
}
