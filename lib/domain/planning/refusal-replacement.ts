import { FARM_TIME_ZONE } from '../water-management.ts';
import type { StoredProposal, StoredWeeklyPlan } from './contract.ts';
import { clockText } from '../clock-text.ts';

/**
 * Où le besoin d'un créneau refusé est allé (audit ergonomique du 19 novembre
 * 2026, lot G, n° 7, F412 ; docs/audit-ergonomie-2026-11-19-lot-g-contract.md,
 * section 5) : lu dans le plan recalculé après le refus, jamais deviné. La
 * règle du refus ne change pas (D-030).
 */

type RefusedProposal = Pick<StoredProposal, 'storedId' | 'calculationId' | 'startAt' | 'bedApplications'>;

/**
 * La proposition nouvelle qui sert au moins une planche du créneau refusé, la
 * plus proche de son heure ; nulle quand le recalcul n'en a placé aucune.
 * `undefined` tant que le plan lu n'est pas encore le recalcul d'après le refus.
 */
export function refusalReplacement(refused: RefusedProposal, plan: Pick<StoredWeeklyPlan, 'calculation' | 'proposals'>): StoredProposal | null | undefined {
  if (plan.calculation.id === refused.calculationId) return undefined;
  const beds = new Set(refused.bedApplications.map((application) => application.bedId));
  const refusedAt = Date.parse(refused.startAt);
  return plan.proposals
    .filter((proposal) => proposal.calculationId === plan.calculation.id && proposal.status === 'proposed' && proposal.storedId !== refused.storedId)
    .filter((proposal) => proposal.bedApplications.some((application) => beds.has(application.bedId)))
    .sort((a, b) => Math.abs(Date.parse(a.startAt) - refusedAt) - Math.abs(Date.parse(b.startAt) - refusedAt) || a.startAt.localeCompare(b.startAt))[0] ?? null;
}

/** Le message du refus, une fois le plan recalculé (F412). */
export function refusalMessage(replacement: Pick<StoredProposal, 'startAt' | 'equipmentName'> | null, timeZone = FARM_TIME_ZONE): string {
  if (!replacement) return 'Créneau refusé. Aucun autre créneau cette semaine : le besoin reste affiché, non placé.';
  const start = new Date(replacement.startAt);
  const weekday = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', timeZone }).format(start);
  const clock = clockText(start, timeZone);
  return `Créneau refusé. Le besoin est replacé ${weekday} à ${clock} (${replacement.equipmentName}).`;
}
