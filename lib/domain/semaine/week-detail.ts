import type { WeekSectionId } from '../features/week-page.ts';
import { SIMPLE_WORDS } from '../simple-words.ts';
import type { WaterDashboardDay } from '../water-management.ts';

/**
 * « Le détail » de la page « Semaine » (simplification, lot S4, PR 2,
 * docs/simplification-s4-contract.md, section 7) : tout ce que les trois
 * anciennes pages montraient et que le premier niveau ne reprend pas, dans
 * un seul pli fermé dont la ligne dit ce qu'il contient, chaque section
 * étant elle-même un pli fermé avec sa ligne. Rien n'est retiré.
 */

/** L'ancre du pli « Le détail » : un lien qui vise un élément du détail ouvre ce pli et le sien (section 7.4). */
export const WEEK_DETAIL_ANCHOR = 'le-detail';

/** Le titre de chaque section du détail (section 7.1) ; les sections 3 à 5 gardent le titre de leur pli d'aujourd'hui (F460). */
export const WEEK_SECTION_TITLES: Readonly<Record<WeekSectionId, string>> = {
  'reste-a-arroser': SIMPLE_WORDS.leftToWater,
  plan: 'Le plan, chaîne par chaîne',
  'eau-visee': SIMPLE_WORDS.weekGoal,
  'pluie-mesuree': 'Pluie mesurée',
  meteo: 'Météo de référence',
  jours: 'Jours de la semaine, un par un',
  'ecart-du-prevu': 'Écart du prévu des trois dernières semaines',
  reglages: 'Réglages de la semaine',
};

/** Ce que la ligne du pli « Le détail » dit de chaque section, en un ou deux mots. */
const SECTION_WORDS: Readonly<Record<WeekSectionId, string>> = {
  'reste-a-arroser': 'le besoin par planche',
  plan: 'le plan',
  'eau-visee': 'l’eau visée',
  'pluie-mesuree': 'la pluie',
  meteo: 'la météo',
  jours: 'les jours',
  'ecart-du-prevu': 'l’écart du prévu',
  reglages: 'les réglages',
};

/**
 * La ligne du pli « Le détail » : « 3 jardins · le besoin par planche · le
 * plan · l’eau visée · la pluie · la météo · les jours · les réglages ».
 * `gardens` : les jardins de « Ce qu'il reste à arroser », `null` quand la
 * section n'existe pas.
 */
export function weekDetailSummary(sections: readonly WeekSectionId[], gardens: number | null): string {
  const parts = sections.map((section) => SECTION_WORDS[section]);
  if (gardens !== null && gardens > 0) parts.unshift(`${gardens} jardin${gardens > 1 ? 's' : ''}`);
  return parts.join(' · ');
}

/**
 * Un minuteur attend la confirmation de ses horaires réels : au premier
 * niveau, l'état en une ligne (section 4, point 3) ; son explication reste
 * dans « Jours de la semaine, un par un ».
 */
export const TIMER_AWAITING_LINE = 'Un minuteur attend encore la confirmation de ses horaires réels.';

export function timerAwaiting(days: readonly Pick<WaterDashboardDay, 'estimatedOngoingCubicMeters'>[], today: Pick<WaterDashboardDay, 'estimatedOngoingCubicMeters'> | null): boolean {
  return days.some((day) => day.estimatedOngoingCubicMeters > 0) || (today?.estimatedOngoingCubicMeters ?? 0) > 0;
}

/** « Le plan ne couvre que la semaine en cours » (S4-l) : une ligne, dite une fois, pour toute autre semaine. */
export const PLAN_CURRENT_WEEK_ONLY = 'Le plan ne couvre que la semaine en cours.';

/** La ligne de « Ce qu'il reste à arroser » : « 3 jardins, le besoin de chaque planche et son calcul ». */
export function needsDetailLine(gardens: number): string {
  if (gardens <= 0) return 'Aucun jardin cette saison.';
  return `${gardens} jardin${gardens > 1 ? 's' : ''}, le besoin de chaque planche et son calcul`;
}

/**
 * La ligne de l'écart du prévu, lu à l'ouverture de sa section (section 3.4,
 * promesse de F918) : avant, ce que la section montrera ; après, combien de
 * planches s'écartent, « 2 planches s’écartent du prévu ». Le bloc lui-même
 * ne paraît que lorsqu'une planche a un signal (F735).
 */
export function gapSectionLine(beds: number | null): string {
  if (beds === null) return GAP_SECTION_IDLE_LINE;
  if (beds === 0) return GAP_SECTION_NONE;
  return beds > 1 ? `${beds} planches s’écartent du prévu` : '1 planche s’écarte du prévu';
}

/** La ligne avant la lecture : ce que l'ouverture lira. */
export const GAP_SECTION_IDLE_LINE = 'Les planches arrosées plus ou moins que prévu, trois semaines de suite';

/** Aucune planche ne s'écarte : la section le dit en une ligne, sans bloc (F735). */
const GAP_SECTION_NONE = 'Aucune planche ne s’écarte du prévu';

/** La lecture a échoué : la section le dit et propose de relire. */
export const GAP_SECTION_FAILED = 'L’écart du prévu n’a pas pu être lu.';

/** La ligne de « Réglages de la semaine » : celle du pli « Réglages de cette page » d'avant (F305). */
export const WEEK_SETTINGS_LINE = 'Ce qui se règle une fois pour toutes ; rien n’y change le travail du jour.';
