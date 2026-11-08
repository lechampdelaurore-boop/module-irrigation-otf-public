import { pageHref } from '../features/pages.ts';
import type { StoredPlanCalculation, StoredPlanSuggestion } from './contract.ts';
import { millisecondsFromMinutes } from '../units.ts';

const NEXT_HOURS = 24;

/**
 * La notification du matin (docs/replanning-contract.md, règles 21 et 22) :
 * quand le calcul que le maraîcher n'a pas lancé lui-même — celui du matin —
 * fait une suggestion sur un arrosage validé des prochaines 24 heures, une
 * seule notification regroupe les suggestions ; un clic ouvre le planning.
 * Les suggestions « gardées » (règle 17) se taisent ; un arrosage dont le
 * créneau est passé n'est plus à venir.
 */
export type MorningSuggestionNotification = {
  count: number;
  title: string;
  body: string;
  /** L'identifiant d'alarme du Worker : un par calcul, jamais deux notifications pour le même. */
  alarmId: string;
  tag: string;
  url: string;
};

export function morningSuggestionNotification(
  plan: { calculation: Pick<StoredPlanCalculation, 'id' | 'season'>; suggestions: readonly StoredPlanSuggestion[] },
  now: Date,
): MorningSuggestionNotification | null {
  const upcoming = suggestionsWithinNextHours(plan.suggestions, now);
  if (upcoming.length === 0) return null;
  const count = upcoming.length;
  const lead = count === 1
    ? '1 suggestion sur un arrosage des prochaines 24 heures'
    : `${count} suggestions sur vos arrosages des prochaines 24 heures`;
  return {
    count,
    title: 'Suggestions du planning',
    body: [lead, ...upcoming.map(describeSuggestion)].join(' · '),
    alarmId: `plan:${plan.calculation.id}`,
    tag: `planning-suggestions-${plan.calculation.id}`,
    url: pageHref('planning', { season: plan.calculation.season }),
  };
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
    .sort((a, b) => a.plannedStartAt.localeCompare(b.plannedStartAt) || a.equipmentName.localeCompare(b.equipmentName, 'fr'));
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
