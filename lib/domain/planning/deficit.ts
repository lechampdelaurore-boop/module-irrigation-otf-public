import { cubicMetersFromMillimeters } from '../units.ts';
import type { PlanBedOutcome, UnplacedReason, WeeklyPlan } from './contract.ts';
import type { PlanningEquipment } from './demand.ts';
import type { BedState } from './shortage.ts';

const EPSILON = 1e-9;

/** Les motifs qui comptent en manque d'eau : ce que les origines d'eau et leurs limites ne fournissent pas. */
const WATER_REASONS: ReadonlySet<UnplacedReason> = new Set<UnplacedReason>(['water-budget', 'deferred', 'reserve-timing', 'supply-unavailable', 'daily-limit', 'withdrawal-limit']);

/** Les motifs d'une part coupée : l'eau que la conduite en pénurie ou l'arbitrage retire à une planche avant le placement. */
const SHARE_CUT_REASONS: readonly UnplacedReason[] = ['water-budget', 'daily-limit', 'deferred'];

/**
 * Le manque du plan, par motif (docs/planning-contract.md, « Pénurie »,
 * point ouvert 56, D-087) : le manque d'une planche se partage entre ses
 * motifs. Ce que sa part lui retire — son besoin moins sa part de la fin du
 * calcul — compte sous le motif de la coupe ; le reste, sous le premier de
 * ses autres motifs, ou sous la coupe quand aucun autre ne l'explique. Chaque
 * part se chiffre sur la surface que le propre matériel de la planche
 * mouille ; les motifs de l'eau font le manque d'eau, le temps de pompage et
 * la fin de la semaine le temps de pompage manquant.
 */
export function summarizeDeficit(outcomes: readonly PlanBedOutcome[], beds: readonly BedState[], equipmentById: ReadonlyMap<string, PlanningEquipment>): WeeklyPlan['deficit'] {
  const byReason: Partial<Record<UnplacedReason, number>> = {};
  let water = 0;
  let pumpTime = 0;
  let bedCount = 0;
  for (const outcome of outcomes) {
    if (outcome.deficitMm <= EPSILON) continue;
    bedCount += 1;
    const state = beds.find((bed) => bed.bedId === outcome.bedId);
    const wetted = state?.equipmentId ? equipmentById.get(state.equipmentId)?.coveredBeds.find((covered) => covered.bedId === outcome.bedId)?.wettedAreaSquareMeters ?? null : null;
    const cut = SHARE_CUT_REASONS.find((reason) => outcome.reasons.includes(reason)) ?? null;
    const cutMm = cut === null ? 0 : Math.min(outcome.deficitMm, Math.max(0, outcome.needMm - outcome.targetMm));
    const placement = outcome.reasons.find((reason) => reason !== cut) ?? cut ?? 'pump-time';
    const parts: [UnplacedReason, number][] = cut === null ? [[placement, outcome.deficitMm]] : [[cut, cutMm], [placement, outcome.deficitMm - cutMm]];
    for (const [reason, mm] of parts) {
      if (mm <= EPSILON) continue;
      const cubicMeters = wetted === null ? 0 : cubicMetersFromMillimeters(mm, wetted);
      byReason[reason] = (byReason[reason] ?? 0) + cubicMeters;
      if (WATER_REASONS.has(reason)) water += cubicMeters;
      else if (reason === 'pump-time' || reason === 'no-time-left') pumpTime += cubicMeters;
    }
  }
  return { waterCubicMeters: water, pumpTimeCubicMeters: pumpTime, byReason, bedCount };
}
