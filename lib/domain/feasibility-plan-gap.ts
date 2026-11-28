import { volumeText } from './display-numbers.ts';
import { cubicMetersFromLiters } from './units.ts';
import type { IrrigationFeasibility } from './irrigation-feasibility.ts';
import type { StoredWeeklyPlan } from './planning/contract.ts';
import { beyondNeedSentence, shortageDecisionPending, waterBeyondNeed } from './planning/shortage-reading.ts';
import { PLAN_SECTION_ANCHOR } from './features/week-page.ts';

/** « Eau visée » de « Semaine », où se fixe l'objectif d'une planche (lot S4, section 7.4). */
const WEEK_GOALS_ANCHOR = 'objectifs-de-la-semaine';

/** Sous un litre, un reste de la faisabilité est un arrondi : elle ne voit pas de manque. */
const ONE_LITER_CUBIC_METERS = cubicMetersFromLiters(1);

/** Les pages où se trouvent les gestes qui lèvent le manque : le planning et les besoins sont sur « Semaine » (lot S4, PR 4). */
type PlanGapLink = { label: string; page: 'materiel' | 'semaine'; anchor?: string };

export type FeasibilityPlanGap = {
  /** « Le planning compte un manque de 367 L d'ici dimanche, que cette répartition ne voit pas. » */
  lead: string;
  /** D'où vient le manque, et quoi faire. */
  cause: string;
  links: PlanGapLink[];
};

/**
 * L'écart entre le manque du planning et la faisabilité de « Ressources »
 * (audit du 19 novembre 2026, lot I, n° 5, F446) : le planning manque d'eau,
 * aucune répartition validée ne s'y applique, et la faisabilité, qui compare
 * l'eau aux seuls besoins des planches qui ont un objectif, n'a rien à
 * répartir. L'écran le dit au lieu de montrer des tuiles vides : d'où vient
 * le manque, et quoi faire. Lecture seule : aucun calcul ne change. Nul
 * quand la faisabilité trouve elle aussi un manque, ou sans manque au
 * planning.
 */
export function feasibilityPlanGap(input: {
  plan: Pick<StoredWeeklyPlan, 'calculation' | 'proposals'> | null;
  feasibility: Pick<IrrigationFeasibility, 'priorities' | 'knownNeedCubicMeters' | 'forecastAvailableCubicMeters' | 'requiresManualArbitration'>;
  now: Date;
}): FeasibilityPlanGap | null {
  const { plan, feasibility, now } = input;
  if (!plan || !shortageDecisionPending(plan)) return null;
  const sees = feasibility.requiresManualArbitration || feasibility.priorities.some((level) => level.residualCubicMeters >= ONE_LITER_CUBIC_METERS);
  if (sees) return null;
  const deficit = plan.calculation.summary.deficit.waterCubicMeters;
  const lead = deficit >= ONE_LITER_CUBIC_METERS
    ? `Le planning compte un manque de ${volumeText(deficit)} d’ici dimanche, que cette répartition ne voit pas.`
    : 'Le planning compte un manque d’eau d’ici dimanche, que cette répartition ne voit pas.';
  const available = feasibility.forecastAvailableCubicMeters;
  const fits = available === null
    ? `Les besoins des planches qui ont un objectif (${volumeText(feasibility.knownNeedCubicMeters)}) sont tous servis par ce calcul en volume.`
    : `Les besoins des planches qui ont un objectif (${volumeText(feasibility.knownNeedCubicMeters)}) tiennent dans l’eau disponible (${volumeText(available)}).`;
  const beyond = waterBeyondNeed(plan, now);
  if (beyond) {
    const where = beyondNeedSentence(beyond, volumeText);
    const todo = beyond.withoutNeed
      ? 'Fermez leurs lignes, retirez ces planches du matériel, ou fixez leur objectif.'
      : 'Fermez les lignes des planches déjà servies, ou revoyez le matériel qui les arrose ensemble.';
    return {
      lead,
      cause: `${fits} ${where} Le manque vient de là. ${todo}`,
      links: [{ label: 'Ouvrir Matériel', page: 'materiel' }, { label: 'Ouvrir la semaine', page: 'semaine', anchor: WEEK_GOALS_ANCHOR }],
    };
  }
  // Sans eau versée au-delà du besoin : les heures, les pompes ou le remplissage, que seul le planning vérifie.
  return {
    lead,
    cause: `${fits} Le manque vient des heures, des pompes ou du remplissage des réserves, que le planning vérifie et que ce calcul en volume ne voit pas : le détail est sur « Semaine », dans « Le plan, chaîne par chaîne ».`,
    links: [{ label: 'Ouvrir la semaine', page: 'semaine', anchor: PLAN_SECTION_ANCHOR }],
  };
}
