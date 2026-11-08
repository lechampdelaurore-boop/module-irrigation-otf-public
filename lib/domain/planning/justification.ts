import type { DoseReason, TimingReason } from './contract.ts';
import type { SupplyChain } from './supply.ts';

/**
 * La justification d'un créneau, dite en mots (docs/planning-contract.md,
 * « Interface (3.6) », point ouvert 33) : ce que la pompe faisait quand elle
 * a contraint le créneau, et la contrainte limitante que la carte affiche.
 * Aucune règle de placement ici : le moteur décide, ce module décrit. Sorti
 * de `engine.ts` le 30 octobre 2026, sans changement, le moteur atteignant la
 * limite de 600 lignes (Q6) avant la 3.7.
 */

/**
 * Ce que la pompe faisait quand elle a contraint le créneau, pour le dire
 * (point ouvert 33, corrigé le 9 octobre 2026) : les matériels qui la
 * tenaient au départ voulu, ou le creux trop court avant qu'un matériel la
 * prenne, et ceux qui la prennent à l'heure où le créneau doit finir. Lus au
 * moment du conflit, jamais une milliseconde avant le départ : le creux d'une
 * minute entre deux vagues n'efface pas la vague.
 */
export type PumpConstraint = {
  before: { kind: 'held' | 'gap-too-short'; occupants: string } | null;
  after: string | null;
};

export function describeLimitingConstraint(
  placement: { doseReason: DoseReason; timingReason: TimingReason; startMs: number; endMs: number; pump: PumpConstraint; protectedSlotNames?: readonly string[] },
  chain: SupplyChain,
  timeZone: string,
): string | null {
  const { doseReason, timingReason, pump } = placement;
  const clock = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone });
  const hour = clock.format(new Date(placement.startMs));
  if (doseReason === 'pump-gap' || timingReason === 'pump-capacity') {
    const parts: string[] = [];
    if (timingReason === 'pump-capacity') {
      parts.push(pump.before?.kind === 'gap-too-short'
        ? `libre trop peu de temps avant ${hour}, ${pump.before.occupants} dès cette heure`
        : `saturée avant ${hour} : ${pump.before?.occupants ?? 'aucun'}`);
    }
    if (doseReason === 'pump-gap') parts.push(`saturée dès ${clock.format(new Date(placement.endMs))} : ${pump.after ?? 'aucun'}`);
    return `pompe « ${chain.pumpTimeline?.pump.name ?? '?'} » ${parts.join(' ; ')}`;
  }
  if (doseReason === 'daily-limit' || timingReason === 'daily-limit') return 'limite journalière d’irrigation atteinte';
  if (doseReason === 'reserved-share') return 'part de la semaine atteinte, le reste est réservé aux autres planches';
  if (doseReason === 'reserve-level' || timingReason === 'reserve-inflow') return `réserve « ${chain.originName} » au minimum de sécurité`;
  if (doseReason === 'refused-slot-fit' || timingReason === 'after-refused-slot') return 'créneau refusé évité (D-030)';
  if (doseReason === 'protected-slot-fit' || timingReason === 'after-protected-slot') return protectedSlotsAvoided(placement.protectedSlotNames ?? []);
  if (doseReason === 'window-fit') return 'fin de la plage horaire';
  if (timingReason === 'after-forecast-rain') return 'pluie prévue laissée passer';
  if (timingReason === 'spacing') return 'espacement entre deux arrosages';
  return null;
}

/** « créneau protégé « Lavage des légumes » évité » : le créneau se nomme, comme la pompe ou la réserve (D-062, règle 6). */
function protectedSlotsAvoided(names: readonly string[]): string {
  if (names.length === 0) return 'créneau protégé évité';
  const quoted = names.map((name) => `« ${name} »`).join(', ');
  return names.length === 1 ? `créneau protégé ${quoted} évité` : `créneaux protégés ${quoted} évités`;
}
