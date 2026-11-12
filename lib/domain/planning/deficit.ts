import { cubicMetersFromMillimeters } from '../units.ts';
import type { PlanBedOutcome, UnplacedReason, WeeklyPlan } from './contract.ts';
import type { PlanningEquipment } from './demand.ts';
import type { BedState } from './shortage.ts';

const EPSILON = 1e-9;

/** Les motifs qui comptent en manque d'eau : ce que les origines d'eau et leurs limites ne fournissent pas. */
const WATER_REASONS: ReadonlySet<UnplacedReason> = new Set<UnplacedReason>(['water-budget', 'deferred', 'reserve-timing', 'supply-unavailable', 'daily-limit', 'withdrawal-limit']);

/** Les motifs qui comptent en temps de pompage manquant : les plages horaires et la fin de la semaine. */
const PUMP_TIME_REASONS: ReadonlySet<UnplacedReason> = new Set<UnplacedReason>(['pump-time', 'no-time-left']);

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
 * la fin de la semaine le temps de pompage manquant. Quand cette surface est
 * inconnue, le manque n'a pas de volume : il n'est jamais compté zéro, la
 * planche compte à part sous chaque total que son manque aurait grossi
 * (D-003, point ouvert 64, D-098).
 */
export function summarizeDeficit(outcomes: readonly PlanBedOutcome[], beds: readonly BedState[], equipmentById: ReadonlyMap<string, PlanningEquipment>): WeeklyPlan['deficit'] {
  const byReason: Partial<Record<UnplacedReason, number>> = {};
  let water = 0;
  let pumpTime = 0;
  let bedCount = 0;
  const unknownVolumeBeds = { water: 0, pumpTime: 0 };
  for (const outcome of outcomes) {
    if (outcome.deficitMm <= EPSILON) continue;
    bedCount += 1;
    const state = beds.find((bed) => bed.bedId === outcome.bedId);
    const wetted = state?.equipmentId ? equipmentById.get(state.equipmentId)?.coveredBeds.find((covered) => covered.bedId === outcome.bedId)?.wettedAreaSquareMeters ?? null : null;
    const cut = SHARE_CUT_REASONS.find((reason) => outcome.reasons.includes(reason)) ?? null;
    const cutMm = cut === null ? 0 : Math.min(outcome.deficitMm, Math.max(0, outcome.needMm - outcome.targetMm));
    const placement = outcome.reasons.find((reason) => reason !== cut) ?? cut ?? 'pump-time';
    const parts: [UnplacedReason, number][] = cut === null ? [[placement, outcome.deficitMm]] : [[cut, cutMm], [placement, outcome.deficitMm - cutMm]];
    const uncounted = { water: false, pumpTime: false };
    for (const [reason, mm] of parts) {
      if (mm <= EPSILON) continue;
      const total = WATER_REASONS.has(reason) ? 'water' : PUMP_TIME_REASONS.has(reason) ? 'pumpTime' : null;
      if (wetted === null) {
        if (total !== null) uncounted[total] = true;
        continue;
      }
      const cubicMeters = cubicMetersFromMillimeters(mm, wetted);
      byReason[reason] = (byReason[reason] ?? 0) + cubicMeters;
      if (total === 'water') water += cubicMeters;
      else if (total === 'pumpTime') pumpTime += cubicMeters;
    }
    if (uncounted.water) unknownVolumeBeds.water += 1;
    if (uncounted.pumpTime) unknownVolumeBeds.pumpTime += 1;
  }
  const unknown = unknownVolumeBeds.water + unknownVolumeBeds.pumpTime > 0;
  return { waterCubicMeters: water, pumpTimeCubicMeters: pumpTime, byReason, bedCount, ...(unknown ? { unknownVolumeBeds } : {}) };
}
