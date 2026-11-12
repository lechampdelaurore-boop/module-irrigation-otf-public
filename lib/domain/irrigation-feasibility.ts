import { millimetersFromCubicMeters } from './units.ts';
import type { BedIrrigationNeed, IrrigationNeedPriority, IrrigationNeedsDashboard } from './irrigation-needs.ts';
import type { MobilizableWaterPool } from './water-resources.ts';

export const FEASIBILITY_PRIORITIES = ['high', 'normal', 'low'] as const;
export type HydraulicQuality = 'confirmed' | 'unverified' | 'incompatible';
export type FeasibilityPool = MobilizableWaterPool & { paths: Record<string, HydraulicQuality> };
export type IrrigationArbitration = {
  priority: IrrigationNeedPriority; selectedBedIds: string[]; candidateBedIds: string[];
  decidedAt: string; invalidatedAt: string | null;
};
export type AllocationStatus = 'no_need' | 'full' | 'partial' | 'unsatisfied' | 'not_selected' | 'arbitration_required' | 'waiting_priority' | 'below_threshold' | 'unknown';
type BedWaterAllocation = {
  need: BedIrrigationNeed;
  proposedCubicMeters: number | null;
  allocatedCubicMeters: number | null;
  allocatedMm: number | null;
  confirmedCubicMeters: number;
  usableForPlanningCubicMeters: number;
  residualCubicMeters: number | null;
  residualMm: number | null;
  satisfactionPercent: number | null;
  status: AllocationStatus;
  hydraulicQuality: HydraulicQuality;
  selected: boolean | null;
  reasons: string[];
};
export type PriorityFeasibility = {
  priority: IrrigationNeedPriority;
  knownNeedCubicMeters: number;
  availableCubicMeters: number;
  allocatedCubicMeters: number;
  residualCubicMeters: number;
  coveragePercent: number;
  arbitration: 'automatic' | 'required' | 'validated' | 'revalidation_required' | 'obsolete' | 'waiting';
  decision: IrrigationArbitration | null;
  candidates: string[];
  beds: BedWaterAllocation[];
};
export type IrrigationFeasibility = {
  season: number; weekStart: string; weekEnd: string; timeZone: string; calculatedAt: string;
  revision: number; snapshotSignature: string;
  totalNeedCubicMeters: number | null;
  knownNeedCubicMeters: number;
  unknownNeedCount: number;
  currentAvailableCubicMeters: number | null;
  knownCurrentCubicMeters: number;
  forecastAvailableCubicMeters: number | null;
  knownForecastCubicMeters: number;
  allocatableCubicMeters: number;
  allocatedCubicMeters: number;
  confirmedAllocatedCubicMeters: number;
  potentialAdditionalCubicMeters: number;
  residualDeficitCubicMeters: number | null;
  coveragePercent: number | null;
  confirmedCoveragePercent: number | null;
  unallocatedCubicMeters: number;
  withheldBelowThresholdCubicMeters: number;
  reservedPlannedCubicMeters: number;
  /** L'eau réservée une seule fois aux irrigations d'origine inconnue ou insuffisante : l'aperçu d'un choix la reprend (2 bis). */
  reservedUnassignedCubicMeters: number;
  requiresManualArbitration: boolean;
  priorities: PriorityFeasibility[];
  pools: FeasibilityPool[];
  warnings: string[];
};

const EPS = 1e-7;
const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);
const ratio = (part: number, total: number) => total <= EPS ? 100 : Math.min(100, Math.max(0, part / total * 100));
export const sameBedIds = (a: readonly string[], b: readonly string[]) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

/** Ce que le calcul lit des besoins de 3.3 : la semaine et les planches, quel que soit leur rangement. */
type FeasibilityNeeds = Pick<IrrigationNeedsDashboard, 'season' | 'weekStart' | 'weekEnd' | 'timeZone' | 'calculatedAt'> & {
  gardens: readonly { beds: readonly BedIrrigationNeed[] }[];
};

/** No agronomy and no timetable: only the effective needs produced by 3.3. */
export function allocateIrrigationWater(input: {
  needs: FeasibilityNeeds; pools: FeasibilityPool[]; decisions: IrrigationArbitration[];
  reservedUnassignedCubicMeters?: number; reservedPlannedCubicMeters?: number;
}): IrrigationFeasibility {
  const { needs, pools, decisions } = input;
  const beds = needs.gardens.flatMap((garden) => garden.beds).sort((a, b) => a.bedId.localeCompare(b.bedId));
  // Le volume et la dose se convertissent sur la surface mouillée (D-022) : sans elle, le besoin est inconnu.
  const known = beds.filter((bed) => bed.effectiveVolumeCubicMeters !== null && bed.effectiveNeedMm !== null && bed.wettedAreaSquareMeters !== null && bed.wettedAreaSquareMeters > 0);
  const knownNeed = sum(known.map((bed) => bed.effectiveVolumeCubicMeters!));
  const unknownCount = beds.length - known.length;
  const knownForecast = sum(pools.map((pool) => pool.forecastCubicMeters ?? 0));
  const capacity = Math.max(0, knownForecast - (input.reservedUnassignedCubicMeters ?? 0));
  const unknownWater = pools.length === 0 || pools.some((pool) => pool.forecastCubicMeters === null);
  const positive = known.filter((bed) => bed.effectiveVolumeCubicMeters! > EPS);
  const allDemands = Object.fromEntries(positive.map((bed) => [bed.bedId, bed.effectiveVolumeCubicMeters!]));
  const maximum = routeWater(pools, allDemands, capacity).total;
  const commitments: Record<string, number> = {};
  const priorities: PriorityFeasibility[] = [];
  let blocked = false;
  let withheld = 0;
  const warnings: string[] = [];
  if (unknownCount) warnings.push(`${unknownCount} planche(s) au besoin non calculable : les totaux de la ferme sont incomplets.`);
  if (unknownWater) warnings.push('Disponibilité incomplète : un stock ou une prévision manque. Les volumes inconnus ne sont pas remplacés par zéro.');
  if ((input.reservedUnassignedCubicMeters ?? 0) > 0) warnings.push('Des irrigations existantes ont une origine inconnue ou insuffisante. Le solde non couvert est réservé une seule fois sur le total connu ; leur acheminement reste à vérifier.');

  for (const priority of FEASIBILITY_PRIORITIES) {
    const levelBeds = beds.filter((bed) => bed.priority === priority);
    const candidates = positive.filter((bed) => bed.priority === priority);
    const ids = candidates.map((bed) => bed.bedId);
    const decision = decisions.find((item) => item.priority === priority) ?? null;
    const levelNeed = sum(candidates.map((bed) => bed.effectiveVolumeCubicMeters!));
    const available = Math.max(0, capacity - sum(Object.values(commitments)));
    const completeRatio = largestCommonRatio(pools, commitments, candidates, capacity);
    const shortage = candidates.length > 0 && completeRatio < 1 - EPS;
    const invalid = !!decision && (decision.invalidatedAt !== null || !sameBedIds(ids, decision.candidateBedIds));
    const arbitration: PriorityFeasibility['arbitration'] = blocked ? 'waiting' : !shortage ? decision ? 'obsolete' : 'automatic'
      : candidates.length <= 1 ? 'automatic' : invalid ? 'revalidation_required' : decision ? 'validated' : 'required';
    let selected = !shortage || candidates.length <= 1 ? candidates
      : decision && !invalid ? candidates.filter((bed) => decision.selectedBedIds.includes(bed.bedId)) : [];
    if (blocked) selected = [];
    const awaiting = arbitration === 'required' || arbitration === 'revalidation_required';
    const fraction = blocked || awaiting ? 0 : largestCommonRatio(pools, commitments, selected, capacity);
    if (arbitration === 'obsolete') warnings.push(`L’ancien choix entre les demandes d’eau de priorité ${priorityLabel(priority)} n’est plus applicable ; les exclusions ne seront pas réactivées automatiquement.`);
    const rows: BedWaterAllocation[] = levelBeds.map((need) => {
      const knownBed = known.some((bed) => bed.bedId === need.bedId);
      const isSelected = selected.some((bed) => bed.bedId === need.bedId);
      const proposed = knownBed ? isSelected ? need.effectiveVolumeCubicMeters! * fraction : 0 : null;
      const doseMm = (cubicMeters: number | null) => cubicMeters === null || need.wettedAreaSquareMeters === null ? null : millimetersFromCubicMeters(cubicMeters, need.wettedAreaSquareMeters);
      const dose = doseMm(proposed);
      const below = dose !== null && dose > EPS && dose + EPS < need.thresholdMm;
      const allocated = below ? 0 : proposed;
      const mm = doseMm(allocated);
      const excluded = shortage && arbitration === 'validated' && !isSelected;
      const quality: HydraulicQuality = pools.some((pool) => pool.paths[need.bedId] === 'confirmed' && pool.forecastCubicMeters !== null) ? 'confirmed'
        : pools.length === 0 || pools.some((pool) => pool.paths[need.bedId] !== 'incompatible') ? 'unverified' : 'incompatible';
      const status: AllocationStatus = !knownBed ? 'unknown' : need.effectiveVolumeCubicMeters! <= EPS ? 'no_need' : blocked ? 'waiting_priority' : awaiting ? 'arbitration_required'
        : excluded ? 'not_selected' : below ? 'below_threshold' : allocated! + EPS >= need.effectiveVolumeCubicMeters! ? 'full'
          : allocated! > EPS ? 'partial' : unknownWater && quality !== 'incompatible' ? 'unknown' : 'unsatisfied';
      const reasons: string[] = [];
      if (quality === 'unverified') reasons.push('Faisabilité hydraulique non vérifiée : pompe, origine ou liaison jusqu’à la planche à préciser.');
      if (quality === 'incompatible') reasons.push('Aucune alimentation compatible avec les caractéristiques actuellement renseignées.');
      if (status === 'unknown') reasons.push(knownBed ? 'Données de ressource insuffisantes.' : 'Besoin effectif non calculable dans les besoins d’irrigation.');
      if (excluded) reasons.push('Non retenue lors de votre choix entre les demandes d’eau.');
      if (below) { reasons.push('Allocation inférieure au seuil minimal de planification. Réduisez le nombre de planches sélectionnées.'); withheld += proposed!; }
      if (status === 'partial' || status === 'unsatisfied') reasons.push('Eau compatible disponible insuffisante pour couvrir ce besoin après les priorités précédentes.');
      if (proposed !== null && proposed > EPS) commitments[need.bedId] = proposed;
      return { need, proposedCubicMeters: proposed, allocatedCubicMeters: allocated, allocatedMm: mm,
        confirmedCubicMeters: 0, usableForPlanningCubicMeters: 0,
        residualCubicMeters: allocated === null ? null : Math.max(0, need.effectiveVolumeCubicMeters! - allocated),
        residualMm: mm === null ? null : Math.max(0, need.effectiveNeedMm! - mm),
        satisfactionPercent: allocated === null ? null : ratio(allocated, need.effectiveVolumeCubicMeters!),
        status, hydraulicQuality: quality, selected: shortage && decision ? decision.selectedBedIds.includes(need.bedId) : null, reasons };
    });
    const allocated = sum(rows.map((row) => row.allocatedCubicMeters ?? 0));
    priorities.push({ priority, knownNeedCubicMeters: levelNeed, availableCubicMeters: available,
      allocatedCubicMeters: allocated, residualCubicMeters: Math.max(0, levelNeed - allocated), coveragePercent: ratio(allocated, levelNeed), arbitration, decision, candidates: ids, beds: rows });
    // Never pass a withheld micro-dose, an unresolved choice or an unknown higher priority downwards.
    if (awaiting || rows.some((row) => row.status === 'below_threshold' || row.need.effectiveVolumeCubicMeters === null)) blocked = true;
  }
  const allocations = priorities.flatMap((level) => level.beds);
  const allocated = sum(allocations.map((row) => row.allocatedCubicMeters ?? 0));
  const confirmedCommitments = confirmedWaterWithinAllocations(pools, commitments, priorities, capacity);
  const confirmedTotal = sum(Object.values(confirmedCommitments));
  for (const row of allocations) {
    row.confirmedCubicMeters = confirmedCommitments[row.need.bedId] ?? 0;
    if (row.allocatedCubicMeters !== null && row.confirmedCubicMeters + EPS < row.allocatedCubicMeters) {
      row.hydraulicQuality = 'unverified';
      if (!row.reasons.some((reason) => reason.startsWith('Faisabilité hydraulique'))) row.reasons.push('Une partie du volume dépend d’une liaison hydraulique non vérifiée.');
    }
    // 3.5 must verify time and hydraulics; unknown paths never become an executable irrigation.
    row.usableForPlanningCubicMeters = row.status !== 'below_threshold' && row.hydraulicQuality === 'confirmed' ? row.allocatedCubicMeters ?? 0 : 0;
  }
  const requiresManualArbitration = priorities.some((level) => level.arbitration === 'required' || level.arbitration === 'revalidation_required');
  const affectable = requiresManualArbitration ? maximum : allocated;
  return {
    season: needs.season, weekStart: needs.weekStart, weekEnd: needs.weekEnd, timeZone: needs.timeZone, calculatedAt: needs.calculatedAt,
    revision: 0, snapshotSignature: '', totalNeedCubicMeters: unknownCount ? null : knownNeed, knownNeedCubicMeters: knownNeed, unknownNeedCount: unknownCount,
    currentAvailableCubicMeters: pools.length === 0 || pools.some((pool) => pool.currentCubicMeters === null) ? null : sum(pools.map((pool) => pool.currentCubicMeters!)),
    knownCurrentCubicMeters: sum(pools.map((pool) => pool.currentCubicMeters ?? 0)),
    forecastAvailableCubicMeters: unknownWater ? null : capacity, knownForecastCubicMeters: capacity,
    allocatableCubicMeters: affectable, allocatedCubicMeters: allocated, confirmedAllocatedCubicMeters: confirmedTotal,
    potentialAdditionalCubicMeters: requiresManualArbitration ? Math.max(0, maximum - routeWater(pools, allDemands, capacity, true).total) : Math.max(0, allocated - confirmedTotal),
    residualDeficitCubicMeters: unknownCount ? null : Math.max(0, knownNeed - affectable),
    coveragePercent: unknownCount ? null : ratio(affectable, knownNeed), confirmedCoveragePercent: unknownCount ? null : ratio(confirmedTotal, knownNeed),
    unallocatedCubicMeters: Math.max(0, capacity - allocated), withheldBelowThresholdCubicMeters: withheld,
    reservedPlannedCubicMeters: input.reservedPlannedCubicMeters ?? 0,
    reservedUnassignedCubicMeters: input.reservedUnassignedCubicMeters ?? 0,
    requiresManualArbitration,
    priorities, pools, warnings,
  };
}

/** Verify a conservative simultaneous lower bound, never reuse water committed to another bed. */
function confirmedWaterWithinAllocations(pools: FeasibilityPool[], all: Record<string, number>, priorities: PriorityFeasibility[], capacity: number) {
  const confirmed: Record<string, number> = {};
  const ids = Object.keys(all);
  const paths = pools.map((pool) => ({ ...pool, paths: Object.fromEntries(ids.flatMap((id) => [
    [`C:${id}`, pool.paths[id] === 'confirmed' ? 'confirmed' : 'incompatible'],
    [`F:${id}`, pool.paths[id] ?? 'unverified'],
  ])) })) as FeasibilityPool[];
  const feasible = (candidate: Record<string, number>) => {
    const demand = Object.fromEntries(ids.flatMap((id) => [[`C:${id}`, candidate[id] ?? 0], [`F:${id}`, Math.max(0, all[id] - (candidate[id] ?? 0))]]));
    return routeWater(paths, demand, capacity).total + 1e-8 >= sum(Object.values(all));
  };
  for (const level of priorities) {
    let candidates = level.beds.filter((row) => (row.allocatedCubicMeters ?? 0) > EPS
      && pools.some((pool) => pool.paths[row.need.bedId] === 'confirmed' && (pool.forecastCubicMeters ?? 0) > EPS));
    const proposal = (fraction: number) => ({ ...confirmed, ...Object.fromEntries(candidates.map((row) => [row.need.bedId, row.allocatedCubicMeters! * fraction])) });
    // A path may exist but all its water is needed by another, exclusively connected bed.
    if (!feasible(proposal(1e-5))) candidates = candidates.filter((row) => feasible({ ...confirmed, [row.need.bedId]: row.allocatedCubicMeters! * 1e-5 }));
    let low = 0; let high = 1;
    if (feasible(proposal(1))) low = 1;
    else for (let i = 0; i < 40; i += 1) { const mid = (low + high) / 2; if (feasible(proposal(mid))) low = mid; else high = mid; }
    Object.assign(confirmed, proposal(low < EPS ? 0 : low));
  }
  return confirmed;
}

function largestCommonRatio(pools: FeasibilityPool[], commitments: Record<string, number>, beds: BedIrrigationNeed[], capacity: number) {
  if (!beds.length) return 1;
  const feasible = (fraction: number) => {
    const demand = { ...commitments, ...Object.fromEntries(beds.map((bed) => [bed.bedId, bed.effectiveVolumeCubicMeters! * fraction])) };
    return routeWater(pools, demand, capacity).total + 1e-9 >= sum(Object.values(demand));
  };
  if (feasible(1)) return 1;
  let low = 0; let high = 1;
  for (let i = 0; i < 45; i += 1) { const mid = (low + high) / 2; if (feasible(mid)) low = mid; else high = mid; }
  return low < EPS ? 0 : low;
}

/** Deterministic capacitated flow. Re-routing preserves earlier priority quantities. */
export function routeWater(pools: readonly FeasibilityPool[], demand: Record<string, number>, totalCapacity: number, confirmedOnly = false) {
  type Edge = { to: number; rev: number; capacity: number; original: number };
  const sources = [...pools].sort((a, b) => a.key.localeCompare(b.key));
  const ids = Object.keys(demand).filter((id) => demand[id] > 0).sort();
  const sink = 2 + sources.length + ids.length;
  const graph: Edge[][] = Array.from({ length: sink + 1 }, () => []);
  const add = (from: number, to: number, capacity: number) => {
    const edge = { to, rev: graph[to].length, capacity, original: capacity };
    graph[from].push(edge); graph[to].push({ to: from, rev: graph[from].length - 1, capacity: 0, original: 0 }); return edge;
  };
  add(0, 1, Math.max(0, totalCapacity));
  sources.forEach((pool, i) => {
    add(1, i + 2, Math.max(0, pool.forecastCubicMeters ?? 0));
    ids.forEach((id, j) => { const path = pool.paths[id] ?? 'unverified'; if (confirmedOnly ? path === 'confirmed' : path !== 'incompatible') add(i + 2, 2 + sources.length + j, demand[id]); });
  });
  const ends = ids.map((id, i) => add(2 + sources.length + i, sink, demand[id]));
  let total = 0;
  while (true) {
    const parent = Array<number>(graph.length).fill(-1); const via = Array<number>(graph.length).fill(-1); const queue = [0]; parent[0] = 0;
    for (let q = 0; q < queue.length && parent[sink] < 0; q += 1) graph[queue[q]].forEach((edge, i) => { if (edge.capacity > 1e-10 && parent[edge.to] < 0) { parent[edge.to] = queue[q]; via[edge.to] = i; queue.push(edge.to); } });
    if (parent[sink] < 0) break;
    let amount = Infinity;
    for (let node = sink; node !== 0; node = parent[node]) amount = Math.min(amount, graph[parent[node]][via[node]].capacity);
    for (let node = sink; node !== 0; node = parent[node]) { const edge = graph[parent[node]][via[node]]; edge.capacity -= amount; graph[node][edge.rev].capacity += amount; }
    total += amount;
  }
  return { total, beds: Object.fromEntries(ids.map((id, i) => [id, ends[i].original - ends[i].capacity])) };
}

export function priorityLabel(priority: IrrigationNeedPriority) { return priority === 'high' ? 'Haute' : priority === 'normal' ? 'Normale' : 'Basse'; }
