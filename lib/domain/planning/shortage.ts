import type { IrrigationNeedPriority } from '../irrigation-needs.ts';
import { remainingPlannedApplications } from '../planned-irrigation.ts';
import { cubicMetersFromMillimeters, millimetersFromCubicMeters } from '../units.ts';
import type { PlanArbitration, PlanningInputs, SupplyBudget, UnplacedReason, WeeklyPlan } from './contract.ts';
import { compareBedsForService, type PlanningBed, type PlanningEquipment } from './demand.ts';
import type { PlanningSettings } from './settings.ts';
import { commonFraction, ShareLedger, shareAt } from './shares.ts';
import type { DailyLimitLedger, SupplyChain } from './supply.ts';

const EPSILON = 1e-9;
/** Un reste sous un centième de millimètre est un résidu d'arrondi, comme dans le registre des parts. */
const NEGLIGIBLE_MM = 0.01;

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
  /** Les allocations des chaînes indisponibles, que rien ne peut apporter : non reçues d'avance (D-088). */
  unreceivable: { cubicMeters: number; bedCount: number };
};

/**
 * Une ligne de budget telle que la conduite la pose, avec les planches de sa
 * chaîne, pour y lire après le placement l'eau placée par niveau (décision 2
 * de la 3.9, D-052).
 */
export type PendingBudget = {
  budget: SupplyBudget;
  beds: readonly BedState[];
  volumeOf: (bed: BedState, mm: number) => number;
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
): { budgets: PendingBudget[]; shares: Map<string, ShareLedger>; arbitration: ArbitrationShares | null } {
  const equipmentById = new Map(equipment.map((item) => [item.id, item]));
  const wettedFor = (bed: BedState) => bed.equipmentId
    ? equipmentById.get(bed.equipmentId)?.coveredBeds.find((covered) => covered.bedId === bed.bedId)?.wettedAreaSquareMeters ?? null
    : null;
  // Le volume d'une planche du partage, au prix de la surface que son propre matériel mouille. Une planche dont cette
  // surface est inconnue n'a pas de volume : elle reste hors de tout partage, jamais comptée zéro (D-003, point ouvert 63,
  // D-097) ; la compter ici serait une erreur de programmation, et le calcul s'arrête plutôt que d'écrire un chiffre faux.
  const volumeOf = (bed: BedState, mm: number) => {
    const wetted = wettedFor(bed);
    if (wetted === null) throw new Error(`Planche ${bed.bedId} sans surface mouillée connue dans un partage d'eau (point ouvert 63).`);
    return cubicMetersFromMillimeters(mm, wetted);
  };
  const dailyRemaining = ledger.remainingBetween(horizonStart.getTime(), weekEndAt.getTime());
  const groups = chainGroups(beds, chains, dailyRemaining);
  const validatedMm = validatedWaterOf(inputs, chains, horizonStart, weekEndAt);
  // Une chaîne dont rien ne peut venir d'ici dimanche n'entre dans aucun partage : ses planches portent leur motif avant
  // la conduite comme avant un arbitrage, tout leur besoin compté en manque d'eau (points ouverts 52 et 53, D-088).
  for (const group of groups) {
    if (!group.chain.unavailable) continue;
    for (const bed of group.beds) {
      bed.targetMm = 0;
      bed.remainingMm = 0;
      bed.reasons.add('supply-unavailable');
    }
  }

  // Un arbitrage absent ou vide ne s'impose pas : la conduite en pénurie s'applique (point 26).
  if (inputs.arbitration && inputs.arbitration.length > 0) {
    return { budgets: [], ...applyArbitration(beds, inputs.arbitration, groups, { wettedFor, volumeOf, validatedMm }) };
  }

  const budgets: PendingBudget[] = [];
  const shares = new Map<string, ShareLedger>();
  const deferredFirst = new Set(inputs.deferredBedIds ?? []);
  for (const group of groups) {
    const { chain, budget, shortfallReason } = group;
    // Le partage ne compte que les planches dont la surface mouillée par leur propre matériel est connue ; les autres
    // n'ont pas de volume, et la ligne de budget les compte à part (point ouvert 63, D-097).
    const shared = group.beds.filter((bed) => wettedFor(bed) !== null);
    const unpriced = group.beds.length - shared.length;
    const demandByLevel: Record<IrrigationNeedPriority, number> = { high: 0, normal: 0, low: 0 };
    for (const bed of shared) demandByLevel[bed.priority] += volumeOf(bed, bed.needMm);
    const demand = demandByLevel.high + demandByLevel.normal + demandByLevel.low;
    const fractions: Record<IrrigationNeedPriority, number> = { high: 1, normal: 1, low: 1 };
    if (chain.unavailable) {
      // Ni conduite ni part : rien n'est visé, et la ligne le dit, sans eau mobilisable (D-088).
      for (const level of ['high', 'normal', 'low'] as const) if (demandByLevel[level] > EPSILON) fractions[level] = 0;
      budgets.push({ budget: budgetLine(group, demandByLevel, fractions, dailyRemaining, unpriced), beds: shared, volumeOf });
      continue;
    }
    let deferMode = false;
    const inShortage = Number.isFinite(budget) && demand > budget + EPSILON;
    if (inShortage) {
      // En pénurie, une planche sans volume ne peut rien recevoir : aucune part ne compterait son créneau. Elle n'a pas de
      // cible et le dit sous son motif, avant la conduite (point ouvert 63, D-097).
      for (const bed of group.beds) {
        if (wettedFor(bed) !== null) continue;
        bed.targetMm = 0;
        bed.remainingMm = 0;
        bed.reasons.add('volume-unknown-under-budget');
      }
      if (settings.shortageStrategy !== 'defer') {
        // La conduite sur la semaine entière, toutes ensemble pour la part égale, niveau par niveau sinon : l'eau validée
        // de la chaîne compte comme déjà placée dans la part de sa planche (point ouvert 57, D-086).
        const levels: IrrigationNeedPriority[][] = settings.shortageStrategy === 'equal-share' ? [['high', 'normal', 'low']] : [['high'], ['normal'], ['low']];
        let pool = budget;
        for (const level of levels) {
          const atLevel = shared.filter((bed) => level.includes(bed.priority));
          const fraction = conductFraction(atLevel, pool, validatedMm, volumeOf);
          for (const priority of level) fractions[priority] = fraction;
          // Un niveau servi en partie prend toute l'eau qui restait : les suivants n'ont rien.
          pool = fraction < 1 ? 0 : pool - atLevel.reduce((sum, bed) => sum + volumeOf(bed, bed.needMm), 0);
        }
      } else {
        // Report : servir la file d'abord, puis dans l'ordre jusqu'à épuisement ; les autres attendent le prochain événement.
        let remaining = budget;
        const ordered = [...shared].sort((left, right) =>
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
        // La part visée d'un niveau sous le report : ce que la conduite sert au départ, une reportée comptant zéro
        // (décision 2 de la 3.9, D-052).
        for (const level of ['high', 'normal', 'low'] as const) {
          if (demandByLevel[level] <= EPSILON) continue;
          fractions[level] = shared.filter((bed) => bed.priority === level).reduce((sum, bed) => sum + volumeOf(bed, bed.targetMm), 0) / demandByLevel[level];
        }
        deferMode = true;
      }
    }
    if (!deferMode) {
      for (const bed of shared) {
        const target = shareAt(bed, fractions[bed.priority], validatedMm(bed));
        if (target < bed.needMm - EPSILON) bed.reasons.add(shortfallReason);
        bed.targetMm = target;
        bed.remainingMm = target;
      }
      // La part visée d'un niveau qui a de l'eau validée : la part de sa demande restante que les parts réservent, comme sous
      // le report ; sans eau validée, la fraction de la conduite, comme avant (D-086).
      for (const level of ['high', 'normal', 'low'] as const) {
        const own = shared.filter((bed) => bed.priority === level);
        if (demandByLevel[level] <= EPSILON || !own.some((bed) => validatedMm(bed) > EPSILON)) continue;
        fractions[level] = own.reduce((sum, bed) => sum + volumeOf(bed, bed.targetMm), 0) / demandByLevel[level];
      }
    }
    // Les cibles deviennent des parts réservées, au prix de la surface que le matériel de chaque planche mouille (D-037).
    if (Number.isFinite(budget)) {
      const ledger = new ShareLedger({ beds: shared, wettedAreaOf: wettedFor, budgetCubicMeters: budget, shortfallReason, strategy: settings.shortageStrategy, deferredFirst, validatedMmOf: validatedMm, shortage: inShortage });
      for (const bed of group.beds) {
        if (bed.equipmentId) shares.set(bed.equipmentId, ledger);
      }
    }
    budgets.push({ budget: budgetLine(group, demandByLevel, fractions, dailyRemaining, unpriced), beds: shared, volumeOf });
  }
  return { budgets, shares, arbitration: null };
}

/**
 * La ligne de budget d'une chaîne : son eau mobilisable, ce que la limite
 * journalière laisse, sa demande et la part visée de chaque niveau ; le
 * drapeau `unavailable` seulement quand rien ne peut venir de la chaîne
 * (D-088), absent sinon, comme dans un calcul enregistré avant ; le nombre
 * de planches au volume inconnu, que la demande ne compte pas, seulement
 * quand il y en a (point ouvert 63, D-097).
 */
function budgetLine(group: ChainGroup, demandByLevel: Record<IrrigationNeedPriority, number>, fractions: Record<IrrigationNeedPriority, number>, dailyRemaining: number | null, unknownVolumeBedCount: number): SupplyBudget {
  return {
    originKey: group.key,
    originName: group.chain.originName,
    availableCubicMeters: group.available,
    ...(group.chain.unavailable ? { unavailable: true } : {}),
    dailyLimitRemainingCubicMeters: dailyRemaining,
    demandCubicMeters: demandByLevel.high + demandByLevel.normal + demandByLevel.low,
    ...(unknownVolumeBedCount > 0 ? { unknownVolumeBedCount } : {}),
    fractions,
    demandByLevelCubicMeters: demandByLevel,
  };
}

/**
 * Après le placement, la part placée de chaque niveau à côté de sa part
 * visée (décision 2 de la 3.9, D-052) : l'eau utile que ses planches ont
 * reçue, comptée comme sa demande, sur la surface que le propre matériel de
 * chaque planche mouille.
 */
export function placedBudgets(pending: readonly PendingBudget[]): SupplyBudget[] {
  return pending.map(({ budget, beds, volumeOf }) => {
    const placed: Record<IrrigationNeedPriority, number> = { high: 0, normal: 0, low: 0 };
    for (const bed of beds) placed[bed.priority] += volumeOf(bed, bed.placedMm);
    return { ...budget, placedByLevelCubicMeters: placed };
  });
}

/**
 * La file du report d'un calcul (décision 4 de la 3.9, D-052) : après un
 * événement enregistré depuis le calcul précédent de la semaine, les planches
 * qu'il a reportées passent devant ; sans événement, la file reste la sienne,
 * et le calcul reproduit son plan. Vide au premier calcul de la semaine, comme
 * après un calcul enregistré avant la correction, qui ne l'a pas retenue.
 */
export function nextDeferredQueue(previous: Pick<WeeklyPlan, 'beds' | 'deferredQueue'> | null, eventSincePrevious: boolean): string[] {
  if (!previous) return [];
  if (!eventSincePrevious) return [...(previous.deferredQueue ?? [])];
  return previous.beds.filter((bed) => bed.reasons.includes('deferred')).map((bed) => bed.bedId);
}

/**
 * L'eau que les irrigations déjà planifiées — propositions validées
 * comprises — doivent encore donner d'ici dimanche à une planche, depuis la
 * chaîne de son matériel (point ouvert 57, D-086) : elle est déjà retirée de
 * son besoin et du budget de la chaîne, et compte comme déjà placée dans sa
 * part. L'eau d'une autre chaîne reste ce qu'elle était : retirée du besoin,
 * hors des parts.
 */
function validatedWaterOf(inputs: PlanningInputs, chains: ReadonlyMap<string, SupplyChain>, horizonStart: Date, weekEndAt: Date): (bed: BedState) => number {
  const byChainAndBed = new Map<string, number>();
  for (const row of remainingPlannedApplications(inputs.events, horizonStart, weekEndAt)) {
    if (!row.sourceKey) continue;
    const key = `${row.sourceKey}|${row.bedId}`;
    byChainAndBed.set(key, (byChainAndBed.get(key) ?? 0) + row.amountMm);
  }
  return (bed) => {
    const originKey = bed.equipmentId ? chains.get(bed.equipmentId)?.originKey ?? null : null;
    return originKey === null ? 0 : byChainAndBed.get(`${originKey}|${bed.bedId}`) ?? 0;
  };
}

/**
 * La fraction de la conduite pour des planches et l'eau qu'elles peuvent
 * encore prendre (point ouvert 57, D-086) : la plus grande fraction de leur
 * besoin de la semaine — besoin restant plus eau validée de leur chaîne —
 * dont les cibles tiennent dans cette eau, l'eau validée comptant comme déjà
 * placée ; une planche qui en a déjà plus ne prend rien de plus, et les
 * autres se partagent le reste. Sans eau validée, l'eau rapportée à la
 * demande, comme avant.
 */
function conductFraction(beds: readonly BedState[], pool: number, validatedMm: (bed: BedState) => number, volumeOf: (bed: BedState, mm: number) => number): number {
  const demand = beds.reduce((sum, bed) => sum + volumeOf(bed, bed.needMm), 0);
  if (demand <= EPSILON || demand <= pool) return 1;
  if (pool <= 0) return 0;
  if (beds.every((bed) => validatedMm(bed) <= EPSILON)) return pool / demand;
  return commonFraction(pool, (fraction) => beds.reduce((sum, bed) => sum + volumeOf(bed, shareAt(bed, fraction, validatedMm(bed))), 0));
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
    // Une chaîne indisponible n'a aucune eau mobilisable, quoi que sa réserve contienne (point ouvert 53, D-088).
    const available = chain.unavailable ? 0 : chain.reservoir ? chain.reservoir.budgetCubicMeters() : chain.resource ? chain.resource.budgetCubicMeters() : null;
    const budget = [available, dailyRemaining].filter((value): value is number => value !== null).reduce((min, value) => Math.min(min, value), Number.POSITIVE_INFINITY);
    // Le terme qui borne nomme la coupe : la limite journalière quand elle laisse moins que l'eau, l'eau sinon
    // (point ouvert 35, corrigé le 9 octobre 2026).
    const shortfallReason: UnplacedReason = dailyRemaining !== null && (available === null || dailyRemaining <= available + EPSILON) ? 'daily-limit' : 'water-budget';
    return { key, chain, beds: grouped, available, budget, shortfallReason };
  });
}

/**
 * Sous un arbitrage validé (décision 1 de la 3.9, D-052) : la cible de chaque
 * planche allouée est son allocation bornée à son besoin, moins l'eau validée
 * de sa chaîne qu'elle recevra encore (point ouvert 57, D-086), et chaque
 * chaîne au budget fini qui en porte une a ses parts réservées — les seules
 * allocations, réduites dans la même proportion quand elles dépassent le
 * budget —, sans conduite : rien n'est redistribué. Les planches que
 * l'arbitrage ne nomme pas gardent leur besoin et puisent dans l'eau non
 * attribuée. Les planches d'une chaîne indisponible gardent leur cible
 * nulle et leur seul motif : leur allocation ne peut pas être reçue, et
 * reste non attribuée (points ouverts 52 et 53, D-088).
 */
function applyArbitration(
  beds: readonly BedState[],
  allocations: NonNullable<PlanningInputs['arbitration']>,
  groups: readonly ChainGroup[],
  water: { wettedFor: (bed: BedState) => number | null; volumeOf: (bed: BedState, mm: number) => number; validatedMm: (bed: BedState) => number },
): { shares: Map<string, ShareLedger>; arbitration: ArbitrationShares } {
  const { wettedFor, volumeOf, validatedMm } = water;
  const unavailable = new Set(groups.filter((group) => group.chain.unavailable).flatMap((group) => group.beds));
  const allocated = new Map<BedState, number>();
  for (const allocation of allocations) {
    const bed = beds.find((item) => item.bedId === allocation.bedId);
    const wetted = bed ? wettedFor(bed) : null;
    if (!bed || wetted === null || wetted <= 0) continue;
    const allowedMm = millimetersFromCubicMeters(Math.max(0, allocation.allocatedCubicMeters), wetted);
    // L'allocation est celle de la semaine : l'eau validée de la chaîne de la planche y compte déjà (point ouvert 57,
    // D-086), et il ne reste à placer que l'allocation moins cette eau.
    const validated = validatedMm(bed);
    const allotted = Math.min(bed.needMm + validated, allowedMm);
    allocated.set(bed, allotted);
    if (unavailable.has(bed)) continue;
    const target = Math.max(0, allotted - validated);
    if (target < bed.needMm - EPSILON) bed.reasons.add('water-budget');
    bed.targetMm = target;
    bed.remainingMm = target;
  }
  const allocatedCubicMeters = [...allocated].reduce((sum, [bed, allotted]) => sum + volumeOf(bed, allotted), 0);
  const shares = new Map<string, ShareLedger>();
  const ledgers: ShareLedger[] = [];
  const unreceivable = { cubicMeters: 0, bedCount: 0 };
  let reduction = 0;
  for (const group of groups) {
    const own = group.beds.filter((bed) => allocated.has(bed));
    if (group.chain.unavailable) {
      // Rien ne peut venir de la chaîne : ce qu'elle aurait placé ne peut pas être reçu, sans registre ni réduction (D-088).
      for (const bed of own) {
        const mm = Math.max(0, (allocated.get(bed) ?? 0) - validatedMm(bed));
        if (mm <= NEGLIGIBLE_MM) continue;
        unreceivable.cubicMeters += volumeOf(bed, mm);
        unreceivable.bedCount += 1;
      }
      continue;
    }
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
    const ledger = new ShareLedger({ beds: own, wettedAreaOf: wettedFor, budgetCubicMeters: group.budget, shortfallReason, strategy: null, deferredFirst: new Set(), shortage: true });
    ledgers.push(ledger);
    for (const bed of group.beds) {
      if (bed.equipmentId) shares.set(bed.equipmentId, ledger);
    }
  }
  return { shares, arbitration: { allocatedCubicMeters, reservedCubicMeters: allocatedCubicMeters - reduction, ledgers, unreceivable } };
}

/** Après le placement : ce que les planches allouées n'ont pas reçu de leur part reste non attribué, et le plan le dit. */
export function arbitrationOutcome(arbitration: ArbitrationShares): PlanArbitration {
  let unreceivedCubicMeters = arbitration.unreceivable.cubicMeters;
  let unreceivedBedCount = arbitration.unreceivable.bedCount;
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

