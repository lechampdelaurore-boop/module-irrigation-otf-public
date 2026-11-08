import type { StoredProposal, WeeklyPlan } from './contract.ts';
import type { PlanDay, PlanSummary } from './presentation.ts';
import { FARM_TIME_ZONE, dateKeyInTimeZone } from '../water-management.ts';

/**
 * Le planning de la semaine au téléphone (audit ergonomique, point 2, 3.8
 * quater lot 2, docs/audit-ergonomie-lot2-contract.md, section 4, précision
 * F11) : le jour du jour ouvert, les jours écoulés repliés sous « Jours
 * écoulés (n) », les jours à venir repliés avec leur nombre de propositions,
 * et les six tuiles de totaux en une ligne de résumé. Rien ne se cache
 * derrière un repli : un jour qui porte une irrigation validée dont l'heure
 * est passée sans qu'elle soit faite (« En retard » ou « Non faite » sur la
 * page des arrosages) reste ouvert. L'ordinateur ne replie rien.
 */

/**
 * `open` : le jour et ses cartes ; `folded` : son en-tête seul, avec ses
 * comptes, ses cartes à un geste ; `past` : rangé sous « Jours écoulés (n) ».
 */
export type PhoneDayFold = 'open' | 'folded' | 'past';

export type PhoneWeekFolds = {
  /** Le repli de chaque jour, par `AAAA-MM-JJ`. */
  folds: Record<string, PhoneDayFold>;
  /** Les jours rangés sous « Jours écoulés (n) » ; zéro, le pli n'existe pas. */
  pastCount: number;
};

/** Une irrigation validée, toujours planifiée, dont l'heure de début est passée : elle attend un geste. */
function awaitsAction(proposal: Pick<StoredProposal, 'status' | 'irrigationStatus' | 'startAt'>, now: Date): boolean {
  return proposal.status === 'validated' && proposal.irrigationStatus === 'planned' && Date.parse(proposal.startAt) <= now.getTime();
}

/** Un jour qui a encore quelque chose à décider ou à arroser : une proposée ou une validée non annulée. */
function hasLiveProposals(day: Pick<PlanDay, 'counts'>): boolean {
  return day.counts.proposed + day.counts.validated > 0;
}

export function phoneWeekFolds(days: readonly PlanDay[], now: Date, timeZone = FARM_TIME_ZONE): PhoneWeekFolds {
  const todayKey = dateKeyInTimeZone(now, timeZone);
  const today = days.find((day) => day.dateKey === todayKey);
  // Le jour à venir le plus proche reste ouvert quand aujourd'hui n'a rien.
  const nextOpen = today && hasLiveProposals(today)
    ? null
    : days.find((day) => day.dateKey > todayKey && hasLiveProposals(day))?.dateKey ?? null;
  const folds: Record<string, PhoneDayFold> = {};
  let pastCount = 0;
  for (const day of days) {
    if (day.dateKey === todayKey || day.dateKey === nextOpen || day.proposals.some((proposal) => awaitsAction(proposal, now))) {
      folds[day.dateKey] = 'open';
    } else if (day.dateKey < todayKey) {
      folds[day.dateKey] = 'past';
      pastCount += 1;
    } else {
      folds[day.dateKey] = 'folded';
    }
  }
  return { folds, pastCount };
}

/** « Jours écoulés (5) » : le pli des jours passés, repliés. */
export function pastDaysLabel(pastCount: number): string {
  return `Jours écoulés (${pastCount})`;
}

const plural = (count: number, singular: string, pluralForm = `${singular}s`) => `${count} ${count > 1 ? pluralForm : singular}`;

/**
 * « Planches non servies (37) » : le titre de la liste des planches que le
 * plan ne sert pas en entier, repliée par défaut à toutes les largeurs
 * (demande du porteur du 8 novembre 2026 : la liste entière était trop longue
 * à faire défiler). L'ancien mot « Non placé » reste aux registres (audit
 * ergonomique, lot 3, point 5, précision F48) ; le titre reprend celui de la
 * tuile du résumé.
 */
export function unplacedFoldLabel(unplacedCount: number): string {
  return `Planches non servies (${unplacedCount})`;
}

/**
 * Les tuiles de totaux en une ligne, au téléphone : les gestes (à valider,
 * faites, en retard, `planActionLine`) et le volume toujours ; le manque d'eau, le temps de pompage manquant, les
 * planches non servies et le non vérifié seulement quand ils comptent. Les
 * tuiles entières restent à un geste.
 */
export function planSummaryLine(
  summary: Pick<PlanSummary, 'volumeCubicMeters' | 'unverifiedCount'>,
  actions: readonly string[],
  deficit: Pick<WeeklyPlan['deficit'], 'waterCubicMeters' | 'pumpTimeCubicMeters'>,
  unplacedCount: number,
  formatVolume: (cubicMeters: number) => string,
): string {
  // Les gestes d'abord, comme les cartes de tête (audit ergonomique, lot 3, point 5) : à valider, faites, en retard.
  const parts = [...actions, formatVolume(summary.volumeCubicMeters)];
  if (deficit.waterCubicMeters > 0) parts.push(`manque d’eau ${formatVolume(deficit.waterCubicMeters)}`);
  if (deficit.pumpTimeCubicMeters > 0) parts.push(`pompage manquant ${formatVolume(deficit.pumpTimeCubicMeters)}`);
  if (unplacedCount > 0) parts.push(plural(unplacedCount, 'planche non servie', 'planches non servies'));
  if (summary.unverifiedCount > 0) parts.push(`${summary.unverifiedCount} non vérifié${summary.unverifiedCount > 1 ? 's' : ''}`);
  return parts.join(' · ');
}
