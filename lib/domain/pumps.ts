import { cubicMetersFromLiters } from './units.ts';
import { litersPerHourForBed } from './irrigation-calculations.ts';
import type { WaterInfrastructure } from './water-resources.ts';
import { actualWithdrawalsByResourceAndDate, latestResourceLimit } from './water-resources.ts';
import { FARM_TIME_ZONE, dateKeyInTimeZone } from './water-management.ts';

type PumpStatus = 'active' | 'archived';
export type PumpOriginKind = 'resource' | 'reservoir';

export type PumpOrigin = {
  id: string;
  pumpId: string;
  sourceKind: PumpOriginKind;
  resourceId: string | null;
  reservoirId: string | null;
  isDefault: boolean;
};

export type IrrigationPump = {
  id: string;
  name: string;
  maximumFlowCubicMetersPerHour: number;
  status: PumpStatus;
  archivedAt: string | null;
  notes: string | null;
  origins: PumpOrigin[];
};

export type PumpDraft = {
  name: string;
  maximumFlowCubicMetersPerHour: number;
  status: PumpStatus;
  notes: string | null;
  origins: Array<{
    sourceKind: PumpOriginKind;
    resourceId: string | null;
    reservoirId: string | null;
    isDefault: boolean;
  }>;
};

export type EquipmentPumpDefault = {
  equipmentId: string;
  pumpId: string;
};

export type PumpSnapshot = {
  id: string;
  name: string;
  maximumFlowCubicMetersPerHour: number;
};

export type PumpOriginSnapshot = {
  id: string;
  sourceKind: PumpOriginKind;
  sourceId: string;
  name: string;
};

export type PumpAssignment = {
  pumpId: string;
  pumpOriginId: string | null;
  /** Nul quand une planche n'a pas de surface mouillée connue : le débit n'a pas pu être vérifié. */
  requestedFlowCubicMetersPerHour: number | null;
  pumpSnapshot: PumpSnapshot;
  pumpOriginSnapshot: PumpOriginSnapshot | null;
};

export type PumpUsage = {
  eventEquipmentId: string;
  label: string;
  pumpId: string;
  startsAt: string;
  endsAt: string;
  requestedFlowCubicMetersPerHour: number;
};

export type PumpOriginAvailability =
  | { status: 'available'; message: string }
  | { status: 'unknown'; message: string }
  | { status: 'unavailable'; message: string };

type HydraulicFeasibilityReason =
  | 'flow_unknown'
  | 'capacity_sufficient'
  | 'pump_missing'
  | 'pump_inactive'
  | 'unit_flow_exceeded'
  | 'simultaneous_flow_exceeded'
  | 'origin_missing'
  | 'origin_unknown'
  | 'origin_unavailable';

export type HydraulicFeasibility = {
  possible: boolean;
  hydraulicallyVerified: boolean;
  reasons: HydraulicFeasibilityReason[];
  requiredFlowCubicMetersPerHour: number;
  alreadyEngagedFlowCubicMetersPerHour: number;
  totalFlowCubicMetersPerHour: number;
  pumpCapacityCubicMetersPerHour: number | null;
  remainingCapacityCubicMetersPerHour: number | null;
  excessFlowCubicMetersPerHour: number;
  conflictingIrrigations: Array<{
    eventEquipmentId: string;
    label: string;
  }>;
  originAvailability: PumpOriginAvailability;
};

export function normalizePumpDraft(input: PumpDraft): PumpDraft {
  const name = input.name.trim().replace(/\s+/g, ' ');
  if (!name || name.length > 100) {
    throw new Error('Le nom de la pompe doit contenir entre 1 et 100 caractères.');
  }
  if (!Number.isFinite(input.maximumFlowCubicMetersPerHour)
    || input.maximumFlowCubicMetersPerHour <= 0
    || input.maximumFlowCubicMetersPerHour > 1_000_000) {
    throw new Error('Le débit maximal doit être supérieur à 0 m³/h.');
  }
  if (input.status !== 'active' && input.status !== 'archived') {
    throw new Error('L’état de la pompe est invalide.');
  }
  const seen = new Set<string>();
  let defaultCount = 0;
  const origins = input.origins.map((origin) => {
    const sourceId = origin.sourceKind === 'resource'
      ? origin.resourceId
      : origin.reservoirId;
    if (!sourceId || (origin.sourceKind !== 'resource' && origin.sourceKind !== 'reservoir')) {
      throw new Error('Une origine de pompe est invalide.');
    }
    if (origin.sourceKind === 'resource' && origin.reservoirId !== null) {
      throw new Error('Une origine directe ne peut pas aussi être une réserve.');
    }
    if (origin.sourceKind === 'reservoir' && origin.resourceId !== null) {
      throw new Error('Une origine réserve ne peut pas aussi être une ressource directe.');
    }
    const key = `${origin.sourceKind}:${sourceId}`;
    if (seen.has(key)) throw new Error('Une origine ne peut être ajoutée qu’une fois à une pompe.');
    seen.add(key);
    if (origin.isDefault) defaultCount += 1;
    return {
      sourceKind: origin.sourceKind,
      resourceId: origin.sourceKind === 'resource' ? sourceId : null,
      reservoirId: origin.sourceKind === 'reservoir' ? sourceId : null,
      isDefault: origin.isDefault,
    };
  });
  if (defaultCount > 1) throw new Error('Une pompe ne peut avoir qu’une origine par défaut.');
  return {
    name,
    maximumFlowCubicMetersPerHour: input.maximumFlowCubicMetersPerHour,
    status: input.status,
    notes: input.notes?.trim().slice(0, 1_000) || null,
    origins,
  };
}

/**
 * Débit que l'irrigation demande à la pompe : le taux de chaque planche sur sa
 * surface mouillée (docs/wetted-surface-contract.md). Nul dès qu'une planche
 * n'a pas de surface mouillée connue : un débit partiel ferait passer une
 * aspersion sans passe-pied renseigné pour plus légère qu'elle n'est.
 */
export function requestedFlowCubicMetersPerHour(
  applications: readonly {
    rateMmPerHour: number;
    wettedAreaSquareMeters: number | null;
  }[],
): number | null {
  let total = 0;
  for (const application of applications) {
    if (application.wettedAreaSquareMeters === null) return null;
    total += cubicMetersFromLiters(litersPerHourForBed(
      application.rateMmPerHour,
      application.wettedAreaSquareMeters,
    ));
  }
  return total;
}

export function resolvePumpOriginAvailability({
  infrastructure,
  origin,
  startsAt,
  requiredVolumeCubicMeters,
  timeZone = FARM_TIME_ZONE,
}: {
  infrastructure: WaterInfrastructure;
  origin: PumpOrigin | null;
  startsAt: string;
  requiredVolumeCubicMeters: number;
  timeZone?: string;
}): PumpOriginAvailability {
  if (!origin) {
    return { status: 'unknown', message: 'Origine de l’eau non renseignée.' };
  }
  // Le jour d'un créneau et d'un prélèvement est celui de la ferme (D-004),
  // jamais celui d'UTC : un créneau de 0 h 30 compte pour son propre jour,
  // comme dans le moteur de planning (point ouvert 14, corrigé le 9 octobre
  // 2026, docs/pumps-hydraulic-contract.md).
  const civilDate = dateKeyInTimeZone(startsAt, timeZone);
  if (origin.sourceKind === 'resource') {
    const resource = infrastructure.resources.find((item) => item.id === origin.resourceId);
    if (!resource || resource.status !== 'active'
      || (resource.availableFrom !== null && civilDate < resource.availableFrom)
      || (resource.availableUntil !== null && civilDate > resource.availableUntil)) {
      return { status: 'unavailable', message: 'La ressource directe est indisponible sur ce créneau.' };
    }
    const limit = latestResourceLimit(
      infrastructure.resourceLimits.filter((item) => item.resourceId === resource.id),
      civilDate,
    );
    if (limit?.enabled && limit.maxCubicMetersPerDay !== null) {
      // La limite plafonne tout ce que la ressource fournit ce jour-là,
      // prélèvements directs et apports à une réserve, comptés par la même
      // fonction que le moteur de planning (D-035, point ouvert 38).
      const alreadyWithdrawn = actualWithdrawalsByResourceAndDate(infrastructure.movements, timeZone)
        .get(`${resource.id}:${civilDate}`) ?? 0;
      const remaining = Math.max(0, limit.maxCubicMetersPerDay - alreadyWithdrawn);
      if (requiredVolumeCubicMeters > remaining + 1e-9) {
        return { status: 'unavailable', message: `Limite de prélèvement insuffisante (${remaining.toLocaleString('fr-FR', { maximumFractionDigits: 3 })} m³ encore disponibles ce jour).` };
      }
    }
    return { status: 'available', message: 'Ressource directe disponible selon les informations renseignées.' };
  }
  const reservoir = infrastructure.reservoirs.find((item) => item.id === origin.reservoirId);
  if (!reservoir || reservoir.status !== 'active') {
    return { status: 'unavailable', message: 'La réserve sélectionnée est inactive ou introuvable.' };
  }
  if (reservoir.currentVolumeCubicMeters === null) {
    return { status: 'unknown', message: 'Disponibilité du volume d’eau non vérifiable.' };
  }
  const mobilizable = Math.max(
    0,
    reservoir.currentVolumeCubicMeters - reservoir.minimumSafetyCubicMeters,
  );
  if (mobilizable + 1e-9 < requiredVolumeCubicMeters) {
    return {
      status: 'unavailable',
      message: `Volume mobilisable insuffisant (${mobilizable.toLocaleString('fr-FR', { maximumFractionDigits: 3 })} m³).`,
    };
  }
  return { status: 'available', message: 'Volume mobilisable suffisant selon le dernier stock observé.' };
}

export function evaluateHydraulicFeasibility({
  pump,
  candidate,
  usages,
  originAvailability,
}: {
  pump: IrrigationPump | null;
  candidate: Omit<PumpUsage, 'pumpId'>;
  usages: readonly PumpUsage[];
  originAvailability?: PumpOriginAvailability;
}): HydraulicFeasibility {
  const required = finiteNonNegative(candidate.requestedFlowCubicMetersPerHour);
  if (!pump) {
    return {
      possible: true,
      hydraulicallyVerified: false,
      reasons: ['pump_missing'],
      requiredFlowCubicMetersPerHour: required,
      alreadyEngagedFlowCubicMetersPerHour: 0,
      totalFlowCubicMetersPerHour: required,
      pumpCapacityCubicMetersPerHour: null,
      remainingCapacityCubicMetersPerHour: null,
      excessFlowCubicMetersPerHour: 0,
      conflictingIrrigations: [],
      originAvailability: { status: 'unknown', message: 'Faisabilité hydraulique non vérifiée.' },
    };
  }
  const capacity = finiteNonNegative(pump.maximumFlowCubicMetersPerHour);
  const relevant = usages.filter((usage) => usage.pumpId === pump.id
    && intervalsOverlap(candidate.startsAt, candidate.endsAt, usage.startsAt, usage.endsAt));
  const boundaries = uniqueSortedTimes([
    candidate.startsAt,
    candidate.endsAt,
    ...relevant.flatMap((usage) => [
      laterTime(candidate.startsAt, usage.startsAt),
      earlierTime(candidate.endsAt, usage.endsAt),
    ]),
  ]);
  let alreadyEngaged = 0;
  let conflicts: PumpUsage[] = [];
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const segmentStart = boundaries[index];
    const segmentEnd = boundaries[index + 1];
    if (segmentStart >= segmentEnd) continue;
    const active = relevant.filter((usage) => intervalsOverlap(
      segmentStart,
      segmentEnd,
      usage.startsAt,
      usage.endsAt,
    ));
    const engaged = active.reduce(
      (total, usage) => total + finiteNonNegative(usage.requestedFlowCubicMetersPerHour),
      0,
    );
    if (engaged > alreadyEngaged + 1e-9) {
      alreadyEngaged = engaged;
      conflicts = active;
    }
  }
  const total = required + alreadyEngaged;
  const excess = Math.max(0, total - capacity);
  const source = originAvailability ?? {
    status: pump.origins.length === 0 ? 'unknown' : 'available',
    message: pump.origins.length === 0
      ? 'Origine de l’eau non renseignée.'
      : 'Origine de l’eau renseignée.',
  } satisfies PumpOriginAvailability;
  const reasons: HydraulicFeasibilityReason[] = [];
  if (pump.status !== 'active') reasons.push('pump_inactive');
  if (required > capacity + 1e-9) reasons.push('unit_flow_exceeded');
  else if (excess > 1e-9) reasons.push('simultaneous_flow_exceeded');
  else reasons.push('capacity_sufficient');
  if (pump.origins.length === 0) reasons.push('origin_missing');
  else if (source.status === 'unknown') reasons.push('origin_unknown');
  else if (source.status === 'unavailable') reasons.push('origin_unavailable');
  const possible = pump.status === 'active' && excess <= 1e-9 && source.status !== 'unavailable';
  return {
    possible,
    hydraulicallyVerified: pump.status === 'active',
    reasons,
    requiredFlowCubicMetersPerHour: required,
    alreadyEngagedFlowCubicMetersPerHour: alreadyEngaged,
    totalFlowCubicMetersPerHour: total,
    pumpCapacityCubicMetersPerHour: capacity,
    remainingCapacityCubicMetersPerHour: Math.max(0, capacity - alreadyEngaged),
    excessFlowCubicMetersPerHour: excess,
    conflictingIrrigations: conflicts.map((usage) => ({
      eventEquipmentId: usage.eventEquipmentId,
      label: usage.label,
    })),
    originAvailability: source,
  };
}

function intervalsOverlap(
  leftStart: string,
  leftEnd: string,
  rightStart: string,
  rightEnd: string,
) {
  return leftStart < rightEnd && leftEnd > rightStart;
}

export function findPumpCapacityConflicts(
  pump: IrrigationPump,
  usages: readonly PumpUsage[],
) {
  const relevant = usages.filter((usage) => usage.pumpId === pump.id);
  const boundaries = uniqueSortedTimes(relevant.flatMap((usage) => [usage.startsAt, usage.endsAt]));
  let maximumFlowCubicMetersPerHour = 0;
  const conflictingIds = new Set<string>();
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const active = relevant.filter((usage) => intervalsOverlap(
      boundaries[index], boundaries[index + 1], usage.startsAt, usage.endsAt,
    ));
    const total = active.reduce((sum, usage) => sum + finiteNonNegative(usage.requestedFlowCubicMetersPerHour), 0);
    maximumFlowCubicMetersPerHour = Math.max(maximumFlowCubicMetersPerHour, total);
    if (total > pump.maximumFlowCubicMetersPerHour + 1e-9) {
      active.forEach((usage) => conflictingIds.add(usage.eventEquipmentId));
    }
  }
  return { maximumFlowCubicMetersPerHour, conflictingEventEquipmentIds: [...conflictingIds] };
}

function uniqueSortedTimes(values: readonly string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function laterTime(left: string, right: string) {
  return left > right ? left : right;
}

function earlierTime(left: string, right: string) {
  return left < right ? left : right;
}

function finiteNonNegative(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Les usages d'une pompe que les irrigations d'une période représentent,
 * telles que le dépôt les lit (`listPumpUsagesForUser`) : un minuteur qui
 * tourne occupe la pompe de sa reprise à sa fin théorique ; une irrigation
 * planifiée ou partielle non annulée, sans reliquat annulé, l'occupe sur son
 * créneau prévu ; un débit demandé inconnu n'occupe rien, comme en base.
 * Sert au planning, qui raisonne sur les irrigations déjà en mémoire.
 */
export function pumpUsagesFromEvents(
  events: readonly {
    id: string;
    status: string;
    equipment: {
      id: string;
      status: string;
      pumpId?: string | null;
      requestedFlowCubicMetersPerHour?: number | null;
      equipmentSnapshot: { name: string };
      timerState: string | null;
      timerResumedAt: string | null;
      timerTheoreticalEndAt: string | null;
      actualStartAt: string | null;
      plannedStartAt: string | null;
      plannedEndAt: string | null;
      remainingCanceledAt: string | null;
    };
  }[],
): PumpUsage[] {
  const usages: PumpUsage[] = [];
  for (const event of events) {
    const equipment = event.equipment;
    const flow = equipment.requestedFlowCubicMetersPerHour ?? null;
    if (!equipment.pumpId || flow === null || !Number.isFinite(flow)) continue;
    if (event.status === 'canceled' || equipment.status === 'canceled') continue;
    let startsAt: string | null = null;
    let endsAt: string | null = null;
    if (equipment.timerState) {
      startsAt = equipment.timerResumedAt ?? equipment.actualStartAt ?? equipment.plannedStartAt;
      endsAt = equipment.timerTheoreticalEndAt;
    } else if ((equipment.status === 'planned' || equipment.status === 'partially_completed') && equipment.remainingCanceledAt === null) {
      startsAt = equipment.plannedStartAt;
      endsAt = equipment.plannedEndAt;
    }
    if (!startsAt || !endsAt || !(Date.parse(endsAt) > Date.parse(startsAt))) continue;
    usages.push({
      eventEquipmentId: equipment.id,
      label: equipment.equipmentSnapshot.name,
      pumpId: equipment.pumpId,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      requestedFlowCubicMetersPerHour: flow,
    });
  }
  return usages;
}
