import type { IrrigationNeedPriority } from '../irrigation-needs.ts';
import { cubicMetersFromMillimeters, millimetersFromCubicMeters } from '../units.ts';
import type { PlanningInputs, SupplyBudget, UnplacedReason } from './contract.ts';
import { compareBedsForService, type PlanningBed, type PlanningEquipment } from './demand.ts';
import type { PlanningSettings } from './settings.ts';
import { ShareLedger } from './shares.ts';
import type { DailyLimitLedger, SupplyChain } from './supply.ts';

const EPSILON = 1e-9;

/** L'état d'une planche pendant le calcul : sa cible, ce qui est placé, ce qui manque et pourquoi. */
export type BedState = PlanningBed & {
  targetMm: number;
  remainingMm: number;
  placedMm: number;
  surplusMm: number;
  reasons: Set<UnplacedReason>;
  proposalIds: string[];
  starts: number[];
  /** Le motif de la coupe de la chaîne quand un créneau de la planche a été raccourci à sa part (D-037). */
  shareCut: UnplacedReason | null;
};

export function applyShortage(
  beds: BedState[],
  equipment: readonly PlanningEquipment[],
  chains: ReadonlyMap<string, SupplyChain>,
  ledger: DailyLimitLedger,
  horizonStart: Date,
  weekEndAt: Date,
  inputs: PlanningInputs,
  settings: PlanningSettings,
): { budgets: SupplyBudget[]; shares: Map<string, ShareLedger> } {
  const equipmentById = new Map(equipment.map((item) => [item.id, item]));
  const wettedFor = (bed: BedState) => bed.equipmentId
    ? equipmentById.get(bed.equipmentId)?.coveredBeds.find((covered) => covered.bedId === bed.bedId)?.wettedAreaSquareMeters ?? null
    : null;
  const volumeOf = (bed: BedState, mm: number) => {
    const wetted = wettedFor(bed);
    return wetted === null ? 0 : cubicMetersFromMillimeters(mm, wetted);
  };

  // Un arbitrage absent ou vide ne s'impose pas : la conduite en pénurie s'applique (point 26).
  if (inputs.arbitration && inputs.arbitration.length > 0) {
    for (const allocation of inputs.arbitration) {
      const bed = beds.find((item) => item.bedId === allocation.bedId);
      const wetted = bed ? wettedFor(bed) : null;
      if (!bed || wetted === null || wetted <= 0) continue;
      const allowedMm = millimetersFromCubicMeters(Math.max(0, allocation.allocatedCubicMeters), wetted);
      const target = Math.min(bed.needMm, allowedMm);
      if (target < bed.needMm - EPSILON) bed.reasons.add('water-budget');
      bed.targetMm = target;
      bed.remainingMm = target;
    }
    return { budgets: [], shares: new Map() };
  }

  const dailyRemaining = ledger.remainingBetween(horizonStart.getTime(), weekEndAt.getTime());
  const groups = new Map<string, { chain: SupplyChain; beds: BedState[] }>();
  for (const bed of beds) {
    if (!bed.equipmentId || bed.needMm <= EPSILON) continue;
    const chain = chains.get(bed.equipmentId);
    if (!chain) continue;
    const key = chain.originKey ?? `unverified:${bed.equipmentId}`;
    const group = groups.get(key) ?? { chain, beds: [] };
    group.beds.push(bed);
    groups.set(key, group);
  }

  const budgets: SupplyBudget[] = [];
  const shares = new Map<string, ShareLedger>();
  const deferredFirst = new Set(inputs.deferredBedIds ?? []);
  for (const [key, group] of [...groups.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const available = group.chain.reservoir ? group.chain.reservoir.budgetCubicMeters() : group.chain.resource ? group.chain.resource.budgetCubicMeters() : null;
    const demandByLevel: Record<IrrigationNeedPriority, number> = { high: 0, normal: 0, low: 0 };
    for (const bed of group.beds) demandByLevel[bed.priority] += volumeOf(bed, bed.needMm);
    const demand = demandByLevel.high + demandByLevel.normal + demandByLevel.low;
    const budget = [available, dailyRemaining].filter((value): value is number => value !== null).reduce((min, value) => Math.min(min, value), Number.POSITIVE_INFINITY);
    // Le terme qui borne nomme la coupe : la limite journalière quand elle laisse moins que l'eau, l'eau sinon
    // (point ouvert 35, corrigé le 9 octobre 2026).
    const shortfallReason: UnplacedReason = dailyRemaining !== null && (available === null || dailyRemaining <= available + EPSILON) ? 'daily-limit' : 'water-budget';
    const fractions: Record<IrrigationNeedPriority, number> = { high: 1, normal: 1, low: 1 };
    let deferMode = false;
    if (Number.isFinite(budget) && demand > budget + EPSILON) {
      if (settings.shortageStrategy === 'equal-share') {
        const share = demand > 0 ? Math.min(1, budget / demand) : 1;
        fractions.high = share; fractions.normal = share; fractions.low = share;
      } else if (settings.shortageStrategy === 'priority-then-equal-share') {
        let remaining = budget;
        for (const level of ['high', 'normal', 'low'] as const) {
          const levelDemand = demandByLevel[level];
          fractions[level] = levelDemand <= EPSILON ? 1 : Math.min(1, Math.max(0, remaining) / levelDemand);
          remaining -= levelDemand;
        }
      } else {
        // Report : servir dans l'ordre jusqu'à épuisement, les autres attendent le prochain calcul.
        let remaining = budget;
        const ordered = [...group.beds].sort((left, right) =>
          Number(deferredFirst.has(right.bedId)) - Number(deferredFirst.has(left.bedId)) || compareBedsForService(left, right));
        for (const bed of ordered) {
          const volume = volumeOf(bed, bed.needMm);
          if (volume <= remaining + EPSILON) {
            remaining -= volume;
          } else {
            bed.targetMm = 0;
            bed.remainingMm = 0;
            bed.reasons.add('deferred');
          }
        }
        deferMode = true;
      }
    }
    if (!deferMode) {
      for (const bed of group.beds) {
        const target = bed.needMm * fractions[bed.priority];
        if (target < bed.needMm - EPSILON) bed.reasons.add(shortfallReason);
        bed.targetMm = target;
        bed.remainingMm = target;
      }
    }
    // Les cibles deviennent des parts réservées, au prix de la surface que le matériel de chaque planche mouille (D-037).
    if (Number.isFinite(budget)) {
      const ledger = new ShareLedger({ beds: group.beds, wettedAreaOf: wettedFor, budgetCubicMeters: budget, shortfallReason, strategy: settings.shortageStrategy, deferredFirst });
      for (const bed of group.beds) {
        if (bed.equipmentId) shares.set(bed.equipmentId, ledger);
      }
    }
    budgets.push({
      originKey: key,
      originName: group.chain.originName,
      availableCubicMeters: available,
      dailyLimitRemainingCubicMeters: dailyRemaining,
      demandCubicMeters: demand,
      fractions,
    });
  }
  return { budgets, shares };
}

