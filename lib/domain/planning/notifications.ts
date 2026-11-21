import type { StoredPlanSuggestion } from './contract.ts';
import { millisecondsFromMinutes } from '../units.ts';
import { compareNamesNaturally } from '../bed-order.ts';

const NEXT_HOURS = 24;

/**
 * Les suggestions du matin (docs/replanning-contract.md, règles 21 et 22 ;
 * amélioration n° 3, F703) : quand le calcul que le maraîcher n'a pas lancé
 * lui-même — celui du matin — fait une suggestion sur un arrosage validé des
 * prochaines 24 heures, une phrase du message du matin les regroupe. Les
 * suggestions « gardées » (règle 17) se taisent ; un arrosage dont le
 * créneau est passé n'est plus à venir.
 */
export type MorningSuggestions = {
  count: number;
  /** « 2 suggestions sur vos arrosages des prochaines 24 heures : Annuler Rampe 1, Réduire Goutte-à-goutte à 8 mm. » */
  text: string;
};

export function morningSuggestions(suggestions: readonly StoredPlanSuggestion[], now: Date): MorningSuggestions | null {
  const upcoming = suggestionsWithinNextHours(suggestions, now);
  if (upcoming.length === 0) return null;
  const count = upcoming.length;
  const lead = count === 1
    ? '1 suggestion sur un arrosage des prochaines 24 heures'
    : `${count} suggestions sur vos arrosages des prochaines 24 heures`;
  return { count, text: `${lead} : ${upcoming.map(describeSuggestion).join(', ')}.` };
}

/** Les suggestions non gardées dont l'arrosage commence dans les 24 heures et n'est pas déjà passé, dans l'ordre du temps. */
function suggestionsWithinNextHours(suggestions: readonly StoredPlanSuggestion[], now: Date): StoredPlanSuggestion[] {
  const horizon = now.getTime() + millisecondsFromMinutes(NEXT_HOURS * 60);
  return suggestions
    .filter((suggestion) => !suggestion.kept)
    .filter((suggestion) => {
      const start = Date.parse(suggestion.plannedStartAt);
      const end = Date.parse(suggestion.plannedEndAt);
      return Number.isFinite(start) && Number.isFinite(end) && start < horizon && end > now.getTime();
    })
    .sort((a, b) => a.plannedStartAt.localeCompare(b.plannedStartAt) || compareNamesNaturally(a.equipmentName, b.equipmentName));
}

function describeSuggestion(suggestion: StoredPlanSuggestion): string {
  if (suggestion.suggestion === 'reduce' && suggestion.doseMm !== null) {
    return `Réduire ${suggestion.equipmentName} à ${formatDose(suggestion.doseMm)} mm`;
  }
  return `Annuler ${suggestion.equipmentName}`;
}

function formatDose(value: number): string {
  return (Math.round(value * 10) / 10).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}
