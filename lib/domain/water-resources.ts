import { cubicMetersFromMillimeters } from './units.ts';
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  isValidDateKey,
  localDateStartUtc,
} from './water-management.ts';

const WATER_RESOURCE_TYPES = [
  'borehole',
  'well',
  'spring',
  'network',
  'catchment',
  'river',
  'other',
] as const;

const WATER_RESERVOIR_TYPES = [
  'buffer',
  'pond',
  'cistern',
  'tank',
  'reservoir',
  'other',
] as const;

type WaterResourceType = (typeof WATER_RESOURCE_TYPES)[number];
type WaterReservoirType = (typeof WATER_RESERVOIR_TYPES)[number];
type WaterAssetStatus = 'active' | 'inactive';
type WaterLinkMode = 'automatic' | 'manual';

export type WaterResource = {
  id: string;
  name: string;
  type: WaterResourceType;
  nominalFlowCubicMetersPerHour: number;
  status: WaterAssetStatus;
  availableFrom: string | null;
  availableUntil: string | null;
  notes: string | null;
};

export type WaterResourceDraft = Omit<WaterResource, 'id'>;

export type WaterResourceLimit = {
  id: string;
  resourceId: string;
  enabled: boolean;
  maxCubicMetersPerDay: number | null;
  validFrom: string;
  validUntil: string | null;
  referenceNote: string | null;
  createdAt: string;
};

export type WaterReservoir = {
  id: string;
  name: string;
  type: WaterReservoirType;
  capacityCubicMeters: number;
  currentVolumeCubicMeters: number | null;
  currentVolumeObservedAt: string | null;
  minimumSafetyCubicMeters: number;
  exposedSurfaceSquareMeters: number;
  receivesRain: boolean;
  evaporationEnabled: boolean;
  evaporationCoefficient: number;
  status: WaterAssetStatus;
  notes: string | null;
};

export type WaterReservoirDraft = Omit<
  WaterReservoir,
  'id' | 'currentVolumeObservedAt'
>;

export type ResourceReservoirLink = {
  id: string;
  resourceId: string;
  reservoirId: string;
  fillMode: WaterLinkMode;
  active: boolean;
};

export type ReservoirLink = {
  id: string;
  upstreamReservoirId: string;
  downstreamReservoirId: string;
  transferMode: WaterLinkMode;
  active: boolean;
};

export type IrrigationSupplyDefault =
  | { sourceKind: 'resource'; resourceId: string; reservoirId: null }
  | { sourceKind: 'reservoir'; resourceId: null; reservoirId: string };

type StockMovementKind =
  | 'resource_input'
  | 'direct_irrigation_withdrawal'
  | 'rain'
  | 'irrigation_output'
  | 'evaporation'
  | 'overflow'
  | 'manual_correction'
  | 'transfer_in'
  | 'transfer_out';

export type WaterStockMovement = {
  id: string;
  reservoirId: string | null;
  resourceId: string | null;
  kind: StockMovementKind;
  volumeDeltaCubicMeters: number;
  occurredAt: string;
  previousVolumeCubicMeters: number | null;
  resultingVolumeCubicMeters: number | null;
  reason: string | null;
};

export type WaterInfrastructure = {
  resources: WaterResource[];
  resourceLimits: WaterResourceLimit[];
  reservoirs: WaterReservoir[];
  resourceReservoirLinks: ResourceReservoirLink[];
  reservoirLinks: ReservoirLink[];
  defaultSupply: IrrigationSupplyDefault | null;
  movements: WaterStockMovement[];
};

export type WaterProjectionWeatherDay = {
  date: string;
  forecastRainMm: number | null;
  et0Mm: number | null;
};

export type PlannedWaterUseDay = {
  date: string;
  cubicMeters: number;
  /** Absent: use the legacy farm default. Null: explicitly unknown origin. */
  sourceKey?: string | null;
};

export type MobilizableWaterPool = {
  key: string;
  name: string;
  currentCubicMeters: number | null;
  forecastCubicMeters: number | null;
  reasons: string[];
};

type ReservoirProjection = {
  reservoirId: string;
  startVolumeCubicMeters: number | null;
  theoreticalEndVolumeCubicMeters: number | null;
  afterPlanningEndVolumeCubicMeters: number | null;
  theoreticalMobilizableCubicMeters: number | null;
  afterPlanningMobilizableCubicMeters: number | null;
  automaticPotentialCubicMeters: number;
  automaticAcceptedCubicMeters: number | null;
  manualPotentialCubicMeters: number;
  forecastRainCubicMeters: number;
  estimatedEvaporationCubicMeters: number;
  plannedConsumptionCubicMeters: number;
  capacityLimitedCubicMeters: number | null;
  safetyMinimumExceededByCubicMeters: number;
  missingEt0Dates: string[];
  sharedResourceIds: string[];
  uncharacterizedTransferCount: number;
};

export type WaterAvailabilityProjection = {
  startsAt: string;
  endsAt: string;
  reservoirs: ReservoirProjection[];
  directSupply: {
    resourceId: string;
    theoreticalCubicMeters: number;
    afterPlanningCubicMeters: number | null;
    plannedConsumptionCubicMeters: number;
  } | null;
  unassignedPlannedCubicMeters: number;
  /** Disjoint balances: accepted refills are removed from their source budget. */
  pools: MobilizableWaterPool[];
  reservedUnassignedCubicMeters: number;
};

export function normalizeWaterResourceDraft(
  input: WaterResourceDraft,
): WaterResourceDraft {
  const name = cleanRequiredName(input.name, 'Le nom de la ressource');
  if (!WATER_RESOURCE_TYPES.includes(input.type)) {
    throw new Error('Le type de ressource est invalide.');
  }
  assertFiniteRange(
    input.nominalFlowCubicMetersPerHour,
    0,
    1_000_000,
    'Le débit nominal doit être positif ou nul.',
  );
  assertStatus(input.status);
  assertOptionalPeriod(input.availableFrom, input.availableUntil);
  return {
    name,
    type: input.type,
    nominalFlowCubicMetersPerHour: input.nominalFlowCubicMetersPerHour,
    status: input.status,
    availableFrom: input.availableFrom || null,
    availableUntil: input.availableUntil || null,
    notes: cleanOptional(input.notes, 1_000),
  };
}

export function normalizeWaterReservoirDraft(
  input: WaterReservoirDraft,
): WaterReservoirDraft {
  const name = cleanRequiredName(input.name, 'Le nom de la réserve');
  if (!WATER_RESERVOIR_TYPES.includes(input.type)) {
    throw new Error('Le type de réserve est invalide.');
  }
  assertFiniteRange(input.capacityCubicMeters, Number.EPSILON, 1_000_000_000, 'La capacité doit être supérieure à 0 m³.');
  if (input.currentVolumeCubicMeters !== null) {
    assertFiniteRange(input.currentVolumeCubicMeters, 0, input.capacityCubicMeters, 'Le volume actuel doit être compris entre 0 et la capacité.');
  }
  assertFiniteRange(input.minimumSafetyCubicMeters, 0, input.capacityCubicMeters, 'Le minimum de sécurité doit être compris entre 0 et la capacité.');
  assertFiniteRange(input.exposedSurfaceSquareMeters, 0, 100_000_000, 'La surface exposée doit être positive ou nulle.');
  assertFiniteRange(input.evaporationCoefficient, 0, 100, 'Le coefficient d’évaporation doit être positif ou nul.');
  assertStatus(input.status);
  return {
    name,
    type: input.type,
    capacityCubicMeters: input.capacityCubicMeters,
    currentVolumeCubicMeters: input.currentVolumeCubicMeters,
    minimumSafetyCubicMeters: input.minimumSafetyCubicMeters,
    exposedSurfaceSquareMeters: input.exposedSurfaceSquareMeters,
    receivesRain: input.receivesRain,
    evaporationEnabled: input.evaporationEnabled,
    evaporationCoefficient: input.evaporationCoefficient,
    status: input.status,
    notes: cleanOptional(input.notes, 1_000),
  };
}

export function normalizeWaterResourceLimit(input: Omit<WaterResourceLimit, 'id' | 'resourceId' | 'createdAt'>) {
  if (!isValidDateKey(input.validFrom)
    || (input.validUntil !== null && (!isValidDateKey(input.validUntil) || input.validUntil < input.validFrom))) {
    throw new Error('La période de la limite de prélèvement est invalide.');
  }
  if (input.enabled) {
    if (input.maxCubicMetersPerDay === null) {
      throw new Error('Renseignez une limite de prélèvement en m³ par jour.');
    }
    assertFiniteRange(input.maxCubicMetersPerDay, Number.EPSILON, 1_000_000, 'La limite de prélèvement doit être supérieure à 0 m³/jour.');
  } else if (input.maxCubicMetersPerDay !== null) {
    throw new Error('Une limite désactivée ne doit pas conserver de valeur.');
  }
  return {
    enabled: input.enabled,
    maxCubicMetersPerDay: input.enabled ? input.maxCubicMetersPerDay : null,
    validFrom: input.validFrom,
    validUntil: input.validUntil,
    referenceNote: cleanOptional(input.referenceNote, 500),
  };
}

export function rainInputCubicMeters(precipitationMm: number, exposedSurfaceSquareMeters: number) {
  assertFiniteRange(precipitationMm, 0, 10_000, 'La pluie doit être positive ou nulle.');
  assertFiniteRange(exposedSurfaceSquareMeters, 0, 100_000_000, 'La surface doit être positive ou nulle.');
  return cubicMetersFromMillimeters(precipitationMm, exposedSurfaceSquareMeters);
}

export function estimatedEvaporationCubicMeters(
  et0Mm: number,
  exposedSurfaceSquareMeters: number,
  coefficient: number,
) {
  assertFiniteRange(et0Mm, 0, 10_000, 'L’ET0 doit être positive ou nulle.');
  assertFiniteRange(exposedSurfaceSquareMeters, 0, 100_000_000, 'La surface doit être positive ou nulle.');
  assertFiniteRange(coefficient, 0, 100, 'Le coefficient doit être positif ou nul.');
  return cubicMetersFromMillimeters(et0Mm, exposedSurfaceSquareMeters) * coefficient;
}

export function mobilizableVolume(
  currentVolumeCubicMeters: number | null,
  minimumSafetyCubicMeters: number,
) {
  return currentVolumeCubicMeters === null
    ? null
    : Math.max(0, currentVolumeCubicMeters - minimumSafetyCubicMeters);
}

export function applyReservoirMovement({
  currentVolumeCubicMeters,
  capacityCubicMeters,
  volumeDeltaCubicMeters,
}: {
  currentVolumeCubicMeters: number | null;
  capacityCubicMeters: number;
  volumeDeltaCubicMeters: number;
}) {
  if (currentVolumeCubicMeters === null) {
    return { resultingVolumeCubicMeters: null, overflowCubicMeters: 0, unavailableCubicMeters: 0 };
  }
  const raw = currentVolumeCubicMeters + volumeDeltaCubicMeters;
  return {
    resultingVolumeCubicMeters: Math.min(capacityCubicMeters, Math.max(0, raw)),
    overflowCubicMeters: Math.max(0, raw - capacityCubicMeters),
    unavailableCubicMeters: Math.max(0, -raw),
  };
}

export function hasReservoirCycle(
  links: readonly Pick<ReservoirLink, 'upstreamReservoirId' | 'downstreamReservoirId' | 'active'>[],
) {
  const graph = new Map<string, string[]>();
  for (const link of links.filter((item) => item.active)) {
    const targets = graph.get(link.upstreamReservoirId) ?? [];
    targets.push(link.downstreamReservoirId);
    graph.set(link.upstreamReservoirId, targets);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const target of graph.get(id) ?? []) if (visit(target)) return true;
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  return [...new Set([...graph.keys(), ...[...graph.values()].flat()])].some(visit);
}

export function projectWaterAvailability({
  infrastructure,
  startsAt,
  endsAt,
  weather,
  plannedWater,
  timeZone,
}: {
  infrastructure: WaterInfrastructure;
  startsAt: Date;
  endsAt: Date;
  weather: readonly WaterProjectionWeatherDay[];
  plannedWater: readonly PlannedWaterUseDay[];
  timeZone: string;
}): WaterAvailabilityProjection {
  if (!(endsAt > startsAt)) throw new Error('La date de projection doit être postérieure au départ.');
  const segments = splitIntervalByLocalDay(startsAt, endsAt, timeZone);
  const weatherByDate = new Map(weather.map((day) => [day.date, day]));
  const defaultKey = infrastructure.defaultSupply ? `${infrastructure.defaultSupply.sourceKind}:${infrastructure.defaultSupply.resourceId ?? infrastructure.defaultSupply.reservoirId}` : null;
  const plannedFor = (key: string | null, date?: string) => plannedWater
    .filter((day) => segments.some((segment) => segment.date === day.date)
      && (date === undefined || day.date === date)
      && (day.sourceKey === undefined ? defaultKey : day.sourceKey) === key)
    .reduce((sum, day) => sum + Math.max(0, day.cubicMeters), 0);
  const withdrawals = actualWithdrawalsByResourceAndDate(infrastructure.movements, timeZone);
  let uncoveredPlans = 0;
  const uncertainSources = new Set<string>();
  const sourceBudgets = new Map(infrastructure.resources.map((resource) => {
    // A reservation cannot disappear just because its source opens on a later day.
    let debt = 0;
    const days = new Map(segments.map((segment) => {
      const potential = resourcePotentialForSegment({ resource, limits: infrastructure.resourceLimits.filter((limit) => limit.resourceId === resource.id), segment,
        alreadyWithdrawnCubicMeters: withdrawals.get(`${resource.id}:${segment.date}`) ?? 0 });
      const reserved = plannedFor(`resource:${resource.id}`, segment.date) + debt;
      debt = Math.max(0, reserved - potential);
      return [segment.date, Math.max(0, potential - reserved)] as const;
    }));
    uncoveredPlans += debt;
    return [resource.id, days] as const;
  }));
  const activeAutomaticTargets = new Map<string, Set<string>>();
  for (const link of infrastructure.resourceReservoirLinks.filter((item) => item.active && item.fillMode === 'automatic')) {
    const targets = activeAutomaticTargets.get(link.resourceId) ?? new Set<string>();
    if (infrastructure.reservoirs.some((reservoir) => reservoir.id === link.reservoirId && reservoir.status === 'active')) targets.add(link.reservoirId);
    activeAutomaticTargets.set(link.resourceId, targets);
  }

  const projections = infrastructure.reservoirs.map((reservoir) => {
    const linked = infrastructure.resourceReservoirLinks.filter((link) => link.reservoirId === reservoir.id && link.active);
    const sharedResourceIds = linked
      .filter((link) => (activeAutomaticTargets.get(link.resourceId)?.size ?? 0) > 1)
      .map((link) => link.resourceId);
    const uncharacterizedTransferCount = infrastructure.reservoirLinks.filter(
      (link) => link.active && (link.upstreamReservoirId === reservoir.id || link.downstreamReservoirId === reservoir.id),
    ).length;
    const missingEt0Dates: string[] = [];
    let automaticPotential = 0;
    let manualPotential = 0;
    let rainPotential = 0;
    let evaporation = 0;
    let theoretical = reservoir.status === 'active' ? reservoir.currentVolumeCubicMeters : null;
    let afterPlanning = theoretical;
    let acceptedAutomatic = theoretical === null ? null : 0;
    let capacityLimited = theoretical === null ? null : 0;
    let plannedDebt = 0;

    for (const segment of segments) {
      let automaticForDay = 0;
      let theoreticalAutomaticForDay = 0;
      let manualForDay = 0;
      const automaticInputs: Array<{ resourceId: string; volume: number }> = [];
      for (const link of linked) {
        const resource = infrastructure.resources.find((item) => item.id === link.resourceId);
        if (!resource) continue;
        const potential = resourcePotentialForSegment({
          resource,
          limits: infrastructure.resourceLimits.filter((item) => item.resourceId === resource.id),
          segment,
          alreadyWithdrawnCubicMeters: withdrawals.get(`${resource.id}:${segment.date}`) ?? 0,
        });
        if (link.fillMode === 'manual') manualForDay += potential;
        else if (!sharedResourceIds.includes(resource.id) && reservoir.status === 'active') {
          theoreticalAutomaticForDay += potential;
          const volume = sourceBudgets.get(resource.id)?.get(segment.date) ?? 0;
          automaticForDay += volume;
          automaticInputs.push({ resourceId: resource.id, volume });
        }
      }
      automaticPotential += theoreticalAutomaticForDay;
      manualPotential += manualForDay;
      const dayWeather = weatherByDate.get(segment.date);
      const dayFraction = segment.hours / segment.localDayHours;
      const rainForDay = reservoir.receivesRain && dayWeather?.forecastRainMm !== null && dayWeather?.forecastRainMm !== undefined
        ? rainInputCubicMeters(dayWeather.forecastRainMm, reservoir.exposedSurfaceSquareMeters) * dayFraction
        : 0;
      const evaporationForDay = reservoir.evaporationEnabled && reservoir.evaporationCoefficient > 0
        ? dayWeather?.et0Mm === null || dayWeather?.et0Mm === undefined
          ? (missingEt0Dates.push(segment.date), 0)
          : estimatedEvaporationCubicMeters(dayWeather.et0Mm, reservoir.exposedSurfaceSquareMeters, reservoir.evaporationCoefficient) * dayFraction
        : 0;
      rainPotential += rainForDay;
      evaporation += evaporationForDay;
      const plannedForDay = plannedFor(`reservoir:${reservoir.id}`, segment.date) + plannedDebt;
      const beforeTheoretical = theoretical;
      const beforePlanning = afterPlanning;
      theoretical = simulateReservoirDay(theoretical, reservoir.capacityCubicMeters, evaporationForDay, rainForDay, theoreticalAutomaticForDay, 0);
      afterPlanning = simulateReservoirDay(afterPlanning, reservoir.capacityCubicMeters, evaporationForDay, rainForDay, automaticForDay, plannedForDay);
      if (beforePlanning !== null) {
        plannedDebt = Math.max(0, plannedForDay - Math.max(0, beforePlanning - evaporationForDay + rainForDay + automaticForDay));
        const accepted = Math.min(automaticForDay, Math.max(0, reservoir.capacityCubicMeters - beforePlanning + evaporationForDay + plannedForDay - rainForDay));
        for (const source of automaticInputs) {
          const budget = sourceBudgets.get(source.resourceId)!;
          budget.set(segment.date, Math.max(0, (budget.get(segment.date) ?? 0) - (automaticForDay > 0 ? accepted * source.volume / automaticForDay : 0)));
        }
      }
      if (beforeTheoretical !== null && theoretical !== null && acceptedAutomatic !== null && capacityLimited !== null) {
        const roomAfterLosses = Math.max(0, reservoir.capacityCubicMeters - Math.max(0, beforeTheoretical - evaporationForDay) - rainForDay);
        const accepted = Math.min(theoreticalAutomaticForDay, roomAfterLosses);
        acceptedAutomatic += accepted;
        capacityLimited += Math.max(0, theoreticalAutomaticForDay - accepted);
      }
    }
    const plannedConsumption = plannedFor(`reservoir:${reservoir.id}`);
    uncoveredPlans += afterPlanning === null ? plannedConsumption : plannedDebt;
    if (reservoir.status === 'active' && (reservoir.currentVolumeCubicMeters === null || missingEt0Dates.length)) {
      // An unknown automatic refill is not a proven unused balance at its source.
      for (const link of linked.filter((link) => link.fillMode === 'automatic')) uncertainSources.add(link.resourceId);
    }
    return {
      reservoirId: reservoir.id,
      startVolumeCubicMeters: reservoir.currentVolumeCubicMeters,
      theoreticalEndVolumeCubicMeters: theoretical,
      afterPlanningEndVolumeCubicMeters: afterPlanning,
      theoreticalMobilizableCubicMeters: mobilizableVolume(theoretical, reservoir.minimumSafetyCubicMeters),
      afterPlanningMobilizableCubicMeters: mobilizableVolume(afterPlanning, reservoir.minimumSafetyCubicMeters),
      automaticPotentialCubicMeters: automaticPotential,
      automaticAcceptedCubicMeters: acceptedAutomatic,
      manualPotentialCubicMeters: manualPotential,
      forecastRainCubicMeters: rainPotential,
      estimatedEvaporationCubicMeters: evaporation,
      plannedConsumptionCubicMeters: plannedConsumption,
      capacityLimitedCubicMeters: capacityLimited,
      safetyMinimumExceededByCubicMeters: afterPlanning === null
        ? 0 : Math.max(0, reservoir.minimumSafetyCubicMeters - afterPlanning),
      missingEt0Dates: [...new Set(missingEt0Dates)],
      sharedResourceIds: [...new Set(sharedResourceIds)],
      uncharacterizedTransferCount,
    } satisfies ReservoirProjection;
  });

  const defaultDirectResource = infrastructure.defaultSupply?.sourceKind === 'resource'
    ? infrastructure.resources.find((item) => item.id === infrastructure.defaultSupply?.resourceId)
    : null;
  const directPotential = defaultDirectResource
    ? segments.reduce((sum, segment) => sum + resourcePotentialForSegment({
        resource: defaultDirectResource,
        limits: infrastructure.resourceLimits.filter((item) => item.resourceId === defaultDirectResource.id),
        segment,
        alreadyWithdrawnCubicMeters: withdrawals.get(`${defaultDirectResource.id}:${segment.date}`) ?? 0,
      }), 0)
    : 0;
  const pools: MobilizableWaterPool[] = [
    ...infrastructure.reservoirs.map((reservoir, index) => ({
      key: `reservoir:${reservoir.id}`, name: reservoir.name,
      currentCubicMeters: reservoir.status === 'active' ? mobilizableVolume(reservoir.currentVolumeCubicMeters, reservoir.minimumSafetyCubicMeters) : 0,
      forecastCubicMeters: reservoir.status === 'active' ? projections[index].missingEt0Dates.length ? null : projections[index].afterPlanningMobilizableCubicMeters : 0,
      reasons: [
        ...(reservoir.status !== 'active' ? ['Réserve inactive.'] : []),
        ...(reservoir.currentVolumeCubicMeters === null ? ['Volume de réserve inconnu.'] : []),
        ...(projections[index].missingEt0Dates.length ? ['Évaporation non vérifiable : ET0 manquante.'] : []),
        ...(projections[index].sharedResourceIds.length ? ['Remplissage partagé non réparti : potentiel conservé uniquement dans la ressource.'] : []),
        ...(projections[index].uncharacterizedTransferCount ? ['Transferts entre réserves non quantifiés, non ajoutés au volume.'] : []),
      ],
    })),
    ...infrastructure.resources.map((resource) => ({
      key: `resource:${resource.id}`, name: resource.name, currentCubicMeters: 0,
      forecastCubicMeters: uncertainSources.has(resource.id) ? null : [...(sourceBudgets.get(resource.id)?.values() ?? [])].reduce((sum, value) => sum + value, 0),
      reasons: [
        ...(resource.status !== 'active' ? ['Ressource indisponible.'] : []),
        ...(uncertainSources.has(resource.id) ? ['Reliquat non vérifiable : remplissage automatique d’une réserve au stock ou à l’évaporation inconnus.'] : []),
        ...(infrastructure.resourceLimits.some((limit) => limit.resourceId === resource.id && limit.enabled) ? ['Limites de prélèvement quotidiennes prises en compte.'] : []),
      ],
    })),
  ];
  const unassignedPlans = plannedWater.filter((day) => segments.some((segment) => segment.date === day.date)
    && !pools.some((pool) => pool.key === (day.sourceKey === undefined ? defaultKey : day.sourceKey)))
    .reduce((sum, day) => sum + Math.max(0, day.cubicMeters), 0);
  return {
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    reservoirs: projections,
    directSupply: defaultDirectResource ? {
      resourceId: defaultDirectResource.id,
      theoreticalCubicMeters: directPotential,
      afterPlanningCubicMeters: pools.find((pool) => pool.key === `resource:${defaultDirectResource.id}`)!.forecastCubicMeters,
      plannedConsumptionCubicMeters: plannedFor(`resource:${defaultDirectResource.id}`),
    } : null,
    unassignedPlannedCubicMeters: unassignedPlans,
    pools,
    reservedUnassignedCubicMeters: unassignedPlans + uncoveredPlans,
  };
}

function simulateReservoirDay(
  current: number | null,
  capacity: number,
  evaporation: number,
  rain: number,
  automaticInput: number,
  output: number,
) {
  if (current === null) return null;
  return Math.min(capacity, Math.max(0, current - evaporation - output + rain + automaticInput));
}

export type LocalDaySegment = {
  date: string;
  hours: number;
  localDayHours: number;
};

export function splitIntervalByLocalDay(start: Date, end: Date, timeZone: string): LocalDaySegment[] {
  if (!(end > start)) return [];
  const result: LocalDaySegment[] = [];
  let date = dateKeyInTimeZone(start, timeZone);
  while (true) {
    const dayStart = localDateStartUtc(date, timeZone).getTime();
    const nextDate = addDaysToDateKey(date, 1);
    const dayEnd = localDateStartUtc(nextDate, timeZone).getTime();
    const overlap = Math.max(0, Math.min(end.getTime(), dayEnd) - Math.max(start.getTime(), dayStart));
    if (overlap > 0) result.push({
      date,
      hours: overlap / 3_600_000,
      localDayHours: (dayEnd - dayStart) / 3_600_000,
    });
    if (dayEnd >= end.getTime()) break;
    date = nextDate;
  }
  return result;
}

/** Une ressource donne de l'eau un jour donné : active, et ce jour dans sa période de disponibilité. */
export function isResourceAvailableOn(resource: WaterResource, date: string): boolean {
  return resource.status === 'active'
    && (resource.availableFrom === null || date >= resource.availableFrom)
    && (resource.availableUntil === null || date <= resource.availableUntil);
}

export function resourcePotentialForSegment({
  resource,
  limits,
  segment,
  alreadyWithdrawnCubicMeters,
}: {
  resource: WaterResource;
  limits: readonly WaterResourceLimit[];
  segment: LocalDaySegment;
  alreadyWithdrawnCubicMeters: number;
}) {
  if (!isResourceAvailableOn(resource, segment.date)) return 0;
  const byFlow = resource.nominalFlowCubicMetersPerHour * segment.hours;
  const limit = latestResourceLimit(limits, segment.date);
  if (!limit?.enabled || limit.maxCubicMetersPerDay === null) return byFlow;
  const remainingDaily = Math.max(0, limit.maxCubicMetersPerDay - alreadyWithdrawnCubicMeters);
  return Math.min(byFlow, remainingDaily);
}

export function latestResourceLimit(limits: readonly WaterResourceLimit[], date: string) {
  return limits
    .filter((limit) => limit.validFrom <= date && (limit.validUntil === null || limit.validUntil >= date))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
}

export function actualWithdrawalsByResourceAndDate(movements: readonly WaterStockMovement[], timeZone: string) {
  const result = new Map<string, number>();
  for (const movement of movements) {
    if (!['resource_input', 'direct_irrigation_withdrawal'].includes(movement.kind)
      || !movement.resourceId) continue;
    const date = dateKeyInTimeZone(movement.occurredAt, timeZone);
    const key = `${movement.resourceId}:${date}`;
    result.set(key, (result.get(key) ?? 0) + (movement.kind === 'direct_irrigation_withdrawal' ? Math.abs(movement.volumeDeltaCubicMeters) : Math.max(0, movement.volumeDeltaCubicMeters)));
  }
  return result;
}

function cleanRequiredName(value: string, label: string) {
  const result = value.trim().replace(/\s+/g, ' ');
  if (result.length < 1 || result.length > 100) throw new Error(`${label} doit contenir entre 1 et 100 caractères.`);
  return result;
}

function cleanOptional(value: string | null, maximum: number) {
  const result = value?.trim() ?? '';
  return result ? result.slice(0, maximum) : null;
}

function assertFiniteRange(value: number, minimum: number, maximum: number, message: string) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) throw new Error(message);
}

function assertStatus(status: WaterAssetStatus) {
  if (status !== 'active' && status !== 'inactive') throw new Error('L’état sélectionné est invalide.');
}

function assertOptionalPeriod(from: string | null, until: string | null) {
  if ((from !== null && !isValidDateKey(from))
    || (until !== null && !isValidDateKey(until))
    || (from !== null && until !== null && until < from)) {
    throw new Error('La période de disponibilité est invalide.');
  }
}
