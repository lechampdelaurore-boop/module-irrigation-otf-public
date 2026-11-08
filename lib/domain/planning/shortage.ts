import type { IrrigationNeedPriority } from '../irrigation-needs.ts';
import { cubicMetersFromMillimeters, millimetersFromCubicMeters } from '../units.ts';
import type { PlanArbitration, PlanningInputs, SupplyBudget, UnplacedReason } from './contract.ts';
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

/**
 * Ce qu'un arbitrage validé réserve avant le placement, et les registres où
 * lire à la fin ce que les planches allouées n'ont pas reçu (décision 1 de
 * la 3.9, D-052).
 */
export type ArbitrationShares = {
  allocatedCubicMeters: number;
  reservedCubicMeters: number;
  ledgers: readonly ShareLedger[];
};

/** Les planches d'une chaîne d'eau, avec son budget d'ici dimanche et le terme qui le borne. */
type ChainGroup = {
  key: string;
  chain: SupplyChain;
  beds: BedState[];
  available: number | null;
  /** L'eau de la chaîne, bornée par ce que la limite journalière laisse ; infini quand rien ne la connaît. */
  budget: number;
  shortfallReason: UnplacedReason;
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
): { budgets: SupplyBudget[]; shares: Map<string, ShareLedger>; arbitration: ArbitrationShares | null } {
  const equipmentById = new Map(equipment.map((item) => [item.id, item]));
  const wettedFor = (bed: BedState) => bed.equipmentId
    ? equipmentById.get(bed.equipmentId)?.coveredBeds.find((covered) => covered.bedId === bed.bedId)?.wettedAreaSquareMeters ?? null
    : null;
  const volumeOf = (bed: BedState, mm: number) => {
    const wetted = wettedFor(bed);
    return wetted === null ? 0 : cubicMetersFromMillimeters(mm, wetted);
  };
  const dailyRemaining = ledger.remainingBetween(horizonStart.getTime(), weekEndAt.getTime());
  const groups = chainGroups(beds, chains, dailyRemaining);

  // Un arbitrage absent ou vide ne s'impose pas : la conduite en pénurie s'applique (point 26).
  if (inputs.arbitration && inputs.arbitration.length > 0) {
    return { budgets: [], ...applyArbitration(beds, inputs.arbitration, groups, wettedFor, volumeOf) };
  }

  const budgets: SupplyBudget[] = [];
  const shares = new Map<string, ShareLedger>();
  const deferredFirst = new Set(inputs.deferredBedIds ?? []);
  for (const group of groups) {
    const { key, chain, available, budget, shortfallReason } = group;
    const demandByLevel: Record<IrrigationNeedPriority, number> = { high: 0, normal: 0, low: 0 };
    for (const bed of group.beds) demandByLevel[bed.priority] += volumeOf(bed, bed.needMm);
    const demand = demandByLevel.high + demandByLevel.normal + demandByLevel.low;
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
      originName: chain.originName,
      availableCubicMeters: available,
      dailyLimitRemainingCubicMeters: dailyRemaining,
      demandCubicMeters: demand,
      fractions,
    });
  }
  return { budgets, shares, arbitration: null };
}

/** Les planches à servir, regroupées par chaîne d'eau, chaque chaîne avec son budget et le terme qui le borne. */
function chainGroups(beds: readonly BedState[], chains: ReadonlyMap<string, SupplyChain>, dailyRemaining: number | null): ChainGroup[] {
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
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, { chain, beds: grouped }]) => {
    const available = chain.reservoir ? chain.reservoir.budgetCubicMeters() : chain.resource ? chain.resource.budgetCubicMeters() : null;
    const budget = [available, dailyRemaining].filter((value): value is number => value !== null).reduce((min, value) => Math.min(min, value), Number.POSITIVE_INFINITY);
    // Le terme qui borne nomme la coupe : la limite journalière quand elle laisse moins que l'eau, l'eau sinon
    // (point ouvert 35, corrigé le 9 octobre 2026).
    const shortfallReason: UnplacedReason = dailyRemaining !== null && (available === null || dailyRemaining <= available + EPSILON) ? 'daily-limit' : 'water-budget';
    return { key, chain, beds: grouped, available, budget, shortfallReason };
  });
}

/**
 * Sous un arbitrage validé (décision 1 de la 3.9, D-052) : la cible de chaque
 * planche allouée est son allocation bornée à son besoin, et chaque chaîne au
 * budget fini qui en porte une a ses parts réservées — les seules
 * allocations, réduites dans la même proportion quand elles dépassent le
 * budget —, sans conduite : rien n'est redistribué. Les planches que
 * l'arbitrage ne nomme pas gardent leur besoin et puisent dans l'eau non
 * attribuée.
 */
function applyArbitration(
  beds: readonly BedState[],
  allocations: NonNullable<PlanningInputs['arbitration']>,
  groups: readonly ChainGroup[],
  wettedFor: (bed: BedState) => number | null,
  volumeOf: (bed: BedState, mm: number) => number,
): { shares: Map<string, ShareLedger>; arbitration: ArbitrationShares } {
  const allocated = new Set<BedState>();
  for (const allocation of allocations) {
    const bed = beds.find((item) => item.bedId === allocation.bedId);
    const wetted = bed ? wettedFor(bed) : null;
    if (!bed || wetted === null || wetted <= 0) continue;
    const allowedMm = millimetersFromCubicMeters(Math.max(0, allocation.allocatedCubicMeters), wetted);
    const target = Math.min(bed.needMm, allowedMm);
    if (target < bed.needMm - EPSILON) bed.reasons.add('water-budget');
    bed.targetMm = target;
    bed.remainingMm = target;
    allocated.add(bed);
  }
  const allocatedCubicMeters = [...allocated].reduce((sum, bed) => sum + volumeOf(bed, bed.targetMm), 0);
  const shares = new Map<string, ShareLedger>();
  const ledgers: ShareLedger[] = [];
  let reduction = 0;
  for (const group of groups) {
    const own = group.beds.filter((bed) => allocated.has(bed));
    if (own.length === 0 || !Number.isFinite(group.budget)) continue;
    const reserved = own.reduce((sum, bed) => sum + volumeOf(bed, bed.targetMm), 0);
    let shortfallReason: UnplacedReason = 'water-budget';
    if (reserved > group.budget + EPSILON) {
      // Les parts ne dépassent jamais le budget : chaque allocation de la chaîne est réduite dans la même proportion,
      // la dernière planche examinée comme la première ; la coupe porte le motif de la chaîne.
      const ratio = Math.max(0, group.budget) / reserved;
      for (const bed of own) {
        if (bed.targetMm <= EPSILON) continue;
        bed.targetMm *= ratio;
        bed.remainingMm = bed.targetMm;
        bed.reasons.add(group.shortfallReason);
      }
      reduction += reserved - Math.max(0, group.budget);
      shortfallReason = group.shortfallReason;
    }
    const ledger = new ShareLedger({ beds: own, wettedAreaOf: wettedFor, budgetCubicMeters: group.budget, shortfallReason, strategy: null, deferredFirst: new Set() });
    ledgers.push(ledger);
    for (const bed of group.beds) {
      if (bed.equipmentId) shares.set(bed.equipmentId, ledger);
    }
  }
  return { shares, arbitration: { allocatedCubicMeters, reservedCubicMeters: allocatedCubicMeters - reduction, ledgers } };
}

/** Après le placement : ce que les planches allouées n'ont pas reçu de leur part reste non attribué, et le plan le dit. */
export function arbitrationOutcome(arbitration: ArbitrationShares): PlanArbitration {
  let unreceivedCubicMeters = 0;
  let unreceivedBedCount = 0;
  for (const ledger of arbitration.ledgers) {
    const unspent = ledger.unspentShares();
    unreceivedCubicMeters += unspent.cubicMeters;
    unreceivedBedCount += unspent.bedCount;
  }
  return {
    allocatedCubicMeters: arbitration.allocatedCubicMeters,
    reservedCubicMeters: arbitration.reservedCubicMeters,
    unreceivedCubicMeters,
    unreceivedBedCount,
  };
}

