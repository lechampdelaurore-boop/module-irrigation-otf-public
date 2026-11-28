import { volumeText } from '../display-numbers.ts';
import { isPartActive } from '../features/socle.ts';
import type { FeatureSelection } from '../features/selection.ts';
import { effectiveProposalStatus, type StoredProposal, type StoredWeeklyPlan } from '../planning/contract.ts';
import { shortageAction, shortageDecisionPending } from '../planning/shortage-reading.ts';
import { addDaysToDateKey } from '../water-management.ts';
import { proposalAnchor } from './today-irrigations.ts';
import { farmDateKey, farmHourText } from './today-text.ts';

/**
 * Ce qui attend après le jour sur « Aujourd'hui » (audit ergonomique final,
 * lot A, R1, docs/audit-ergonomie-final-lot-a-contract.md, section 3,
 * précisions F274 à F278) : les arrosages de demain encore à valider, et
 * l'eau qui manque à la semaine. Affichage seul : tout se lit sur le plan
 * enregistré de la semaine, que le service lit déjà quand « Planning » est
 * coché ; rien ici ne calcule une part, un manque ni une dose. Le manque
 * d'eau reprend la phrase du planning (`shortageAction`) : les deux pages ne
 * disent jamais deux choses (F276).
 */

export type TodayTomorrow = {
  /** Les propositions à valider de demain. */
  count: number;
  /** « Demain à 6 h : 3 arrosages à valider », « Demain dès 6 h : 2 arrosages à valider ». */
  text: string;
  /** « 3 arrosages sont à valider demain dès 6 h. », pour la phrase de résumé. */
  sentence: string;
  /** La première proposition de demain sur le planning, comme les lignes du jour (F274). */
  link: { page: 'semaine'; anchor: string };
};

export type TodayShortage = {
  /** La phrase d'action du planning, telle quelle (F276). */
  sentence: string;
  /** Une répartition validée s'applique : le lien invite à la revoir. */
  arbitrated: boolean;
  /** Une décision de répartition attend : la pastille orange « L'eau manque » (F277). */
  decisionPending: boolean;
  /** « Répartir l'eau » ou « Revoir la répartition » vers l'écran de répartition ; `null` sans la faisabilité (cas 5). */
  link: { label: 'Répartir l’eau' | 'Revoir la répartition'; page: 'ressources'; anchor: 'repartition' } | null;
};

/** « irrigation », le mot du module, partout sur la page (audit du 19 novembre 2026, lot H, n° 13, F443). */
function irrigations(count: number): string {
  return count === 1 ? '1 irrigation' : `${count} irrigations`;
}

/**
 * Les arrosages de demain encore à valider (F274, F275) : les propositions
 * « à valider » dont le début tombe le jour civil qui suit, à la ferme, de
 * 0 h à minuit, un créneau de 0 h à 5 h compris. L'heure est dite quand toutes
 * commencent à la même, sinon « dès » la première. Nulle sans proposition.
 */
export function todayTomorrow(proposals: readonly StoredProposal[], now: Date): TodayTomorrow | null {
  const tomorrow = addDaysToDateKey(farmDateKey(now), 1);
  const waiting = proposals
    .filter((proposal) => effectiveProposalStatus(proposal, now) === 'proposed' && farmDateKey(proposal.startAt) === tomorrow)
    .sort((a, b) => a.startAt.localeCompare(b.startAt) || a.storedId.localeCompare(b.storedId));
  const first = waiting[0];
  if (!first) return null;
  const hours = new Set(waiting.map((proposal) => farmHourText(proposal.startAt)));
  const hour = farmHourText(first.startAt);
  const at = hours.size === 1 ? `à ${hour}` : `dès ${hour}`;
  const count = waiting.length;
  return {
    count,
    text: `Demain ${at} : ${irrigations(count)} à valider`,
    sentence: count === 1 ? `Une irrigation est à valider demain ${at}.` : `${irrigations(count)} sont à valider demain ${at}.`,
    link: { page: 'semaine', anchor: proposalAnchor(first.storedId) },
  };
}

/**
 * L'eau qui manque à la semaine (F276, F277) : la phrase d'action du
 * planning, et le même lien vers l'écran de répartition, présent seulement
 * quand la faisabilité est active (comme au planning). Nulle sans manque
 * d'eau.
 */
export function todayShortage(plan: Pick<StoredWeeklyPlan, 'calculation'> & Partial<Pick<StoredWeeklyPlan, 'proposals'>>, enabled: FeatureSelection, now?: Date): TodayShortage | null {
  // La phrase dit aussi l'eau versée au-delà du besoin, quand elle explique le manque (lot I, n° 5, F445).
  const action = shortageAction(plan, volumeText, now);
  if (!action) return null;
  return {
    sentence: action.sentence,
    arbitrated: action.arbitrated,
    decisionPending: shortageDecisionPending(plan),
    link: isPartActive(enabled, 'feasibility')
      ? { label: action.arbitrated ? 'Revoir la répartition' : 'Répartir l’eau', page: 'ressources', anchor: 'repartition' }
      : null,
  };
}
