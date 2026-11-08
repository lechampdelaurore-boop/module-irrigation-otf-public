import type { IrrigationEventRecord } from './irrigation-event-record.ts';
import type { EquipmentKind } from './irrigation-domain.ts';
import { resolveBedWettedArea, type WettedAreaSource } from './irrigation-calculations.ts';
import { cubicMetersFromMillimeters } from './units.ts';
import type { Bed, IrrigationSnapshot } from './domain.ts';
import type { GoalRevisionLike, HistoryPeriod } from './irrigation-history/contract.ts';
import { actualFractionInsidePeriod } from './irrigation-history/summary.ts';
import type { WaterDashboardDay } from './water-management.ts';
import { remainingPlannedApplications } from './planned-irrigation.ts';
import { goalRevisionFirstDate } from './hydric-goal-revisions.ts';
import type { ProposalSummary } from './crop-water/proposal.ts';
import { mmText } from './figure-origin.ts';
import {
  FARM_TIME_ZONE,
  addDaysToDateKey,
  dateKeyInTimeZone,
  localDateStartUtc,
  weekStartDateKey,
} from './water-management.ts';

export const IRRIGATION_NEED_PRIORITIES = ['low', 'normal', 'high'] as const;
export type IrrigationNeedPriority = (typeof IRRIGATION_NEED_PRIORITIES)[number];

export type IrrigationNeedDecision = {
  otfZoneId: string;
  otfPlotId: string;
  otfBedId: string;
  priority: IrrigationNeedPriority;
  manualOverrideMm: number | null;
  overrideReason: string | null;
  calculatedNeedAtOverrideMm: number | null;
  updatedAt: string;
};

type IrrigationNeedCompleteness = {
  complete: boolean;
  missing: Array<'objective' | 'actual-rain' | 'forecast-rain'>;
  demandComplete: boolean;
  realComplete: boolean;
  planningComplete: boolean;
  missingDates: {
    et0: string[];
    actualRain: string[];
    forecastRain: string[];
  };
  /** Jours écoulés sans pluie réelle, repris de la prévision enregistrée pour ce jour (D-019). */
  estimatedDates: {
    actualRain: string[];
  };
};

export type BedIrrigationNeed = {
  bedId: string;
  bedName: string;
  plotId: string;
  plotName: string;
  zoneId: string;
  zoneName: string;
  sheltered: boolean;
  /** Surface de la planche : elle pondère les millimètres et ne change jamais. */
  areaSquareMeters: number;
  /** Surface qui convertit le besoin en volume, selon le matériel positionné (D-022). */
  wettedAreaSquareMeters: number | null;
  wettedAreaSource: WettedAreaSource;
  et0Mm: number | null;
  et0KnownMm: number | null;
  et0ReanalysisMm: number | null;
  et0ForecastMm: number | null;
  objectiveMm: number | null;
  objectiveSource: GoalRevisionLike['scopeType'] | 'mixed' | null;
  actualRainMm: number | null;
  actualIrrigationMm: number;
  realRemainingMm: number | null;
  relativeDeficitPercent: number | null;
  forecastRainMm: number | null;
  plannedIrrigationMm: number;
  rawPlanningNeedMm: number | null;
  thresholdMm: number;
  calculatedNeedMm: number | null;
  manualOverrideMm: number | null;
  overrideReason: string | null;
  effectiveNeedMm: number | null;
  effectiveVolumeCubicMeters: number | null;
  priority: IrrigationNeedPriority;
  weekStart: string;
  weekEnd: string;
  deadlineAt: string;
  completeness: IrrigationNeedCompleteness;
};

type GardenIrrigationNeeds = {
  plotId: string;
  plotName: string;
  zoneId: string;
  zoneName: string;
  sheltered: boolean;
  areaSquareMeters: number;
  bedCount: number;
  priorityCounts: Record<IrrigationNeedPriority, number>;
  realRemainingMm: number | null;
  effectiveNeedMm: number | null;
  effectiveVolumeCubicMeters: number | null;
  beds: BedIrrigationNeed[];
};

export type IrrigationNeedsDashboard = {
  season: number;
  weekStart: string;
  weekEnd: string;
  timeZone: string;
  calculatedAt: string;
  thresholdMm: number;
  gardens: GardenIrrigationNeeds[];
  completeness: IrrigationNeedCompleteness;
  /**
   * L'objectif proposé de chaque planche (5 quater), une information à côté
   * de l'objectif : il n'entre dans aucun terme du besoin. Absent quand le
   * plan de culture n'est pas lu ou que le calcul a échoué.
   */
  proposedByBed?: Record<string, ProposalSummary>;
};

export function resolveIrrigationNeedsWeekStart(input: {
  selectedWeekStart?: string;
  waterDashboardWeekStart?: string;
  now: Date;
  timeZone?: string;
}) {
  return weekStartDateKey(
    input.selectedWeekStart ?? input.waterDashboardWeekStart ?? input.now,
    input.timeZone ?? FARM_TIME_ZONE,
  );
}

/**
 * La demande hebdomadaire d'une planche est son objectif hydrique applicable.
 * L'ET0 est affichée pour information et n'entre dans aucune formule
 * (décision D-010, cahier des charges sections 10 et 11).
 */
export function realRemainingMm(objectiveMm: number | null, rain: number | null, irrigation: number) {
  return objectiveMm === null || rain === null ? null : Math.max(0, objectiveMm - rain - Math.max(0, irrigation));
}

/**
 * La bulle du besoin réel d'une planche (3.8, section 6) : l'objectif moins
 * l'eau reçue, avec les valeurs que `realRemainingMm` a déjà produites. Rien
 * quand le besoin n'est pas calculable.
 */
export function realRemainingOrigin(bed: Pick<BedIrrigationNeed, 'objectiveMm' | 'actualRainMm' | 'actualIrrigationMm' | 'realRemainingMm' | 'sheltered'>): string | null {
  if (bed.realRemainingMm === null || bed.objectiveMm === null || bed.actualRainMm === null) return null;
  const rain = bed.sheltered ? `pluie ${mmText(bed.actualRainMm)} sous abri` : `pluie ${mmText(bed.actualRainMm)}`;
  const received = `arrosé ${mmText(Math.max(0, bed.actualIrrigationMm))} + ${rain}`;
  const result = bed.realRemainingMm === 0
    ? `${mmText(0)} : l’objectif de la semaine est atteint.`
    : `${mmText(bed.realRemainingMm)} à apporter cette semaine.`;
  return `Objectif ${mmText(bed.objectiveMm)} − (${received}) = ${result}`;
}

export function planningNeedMm(objectiveMm: number | null, actualRain: number | null, forecastRain: number | null, actualIrrigation: number, plannedIrrigation: number) {
  return objectiveMm === null || actualRain === null || forecastRain === null
    ? null
    : Math.max(0, objectiveMm - actualRain - forecastRain - Math.max(0, actualIrrigation) - Math.max(0, plannedIrrigation));
}

export function applyPlanningThreshold(raw: number | null, threshold: number) {
  return raw === null ? null : raw < Math.max(0, threshold) ? 0 : raw;
}

export function relativeDeficitPercent(remaining: number | null, objectiveMm: number | null) {
  if (remaining === null || objectiveMm === null) return null;
  return objectiveMm <= 0 ? 0 : Math.max(0, remaining) / objectiveMm * 100;
}

/** Volume d'un besoin sur la surface mouillée ; inconnu dès que l'un des deux l'est. */
export function needVolumeCubicMeters(mm: number | null, wettedAreaSquareMeters: number | null) {
  return mm === null || wettedAreaSquareMeters === null
    ? null
    : cubicMetersFromMillimeters(Math.max(0, mm), Math.max(0, wettedAreaSquareMeters));
}

export function buildIrrigationNeedsDashboard(input: {
  season: number;
  snapshot: IrrigationSnapshot;
  days: readonly WaterDashboardDay[];
  events: readonly IrrigationEventRecord[];
  goalRevisions: readonly GoalRevisionLike[];
  decisions: readonly IrrigationNeedDecision[];
  /** Matériels positionnés par planche (couverture 2.4) : ils fixent la surface mouillée du besoin. */
  coverage: readonly { bedId: string; contributions: readonly { kind: EquipmentKind }[] }[];
  thresholdMm: number;
  weekStart: string;
  weekEnd: string;
  now: Date;
}): IrrigationNeedsDashboard {
  const { season, snapshot, days, events, goalRevisions, decisions, weekStart, weekEnd, now } = input;
  const plots = new Map(snapshot.plots.map((plot) => [plot.id, plot]));
  const zones = new Map(snapshot.zones.map((zone) => [zone.id, zone]));
  const decisionByBed = new Map(decisions.map((decision) => [decision.otfBedId, decision]));
  const positionedKindsByBed = new Map(input.coverage.map((row) => [row.bedId, row.contributions.map((contribution) => contribution.kind)]));
  const beds = snapshot.beds.filter((bed) => bed.seasons.includes(season));
  const today = dateKeyInTimeZone(now, FARM_TIME_ZONE);
  const et0 = sumComplete(days.map((day) => day.et0Mm));
  const et0Reanalysis = sumKnown(days.filter((day) => day.et0Kind === 'reanalysis').map((day) => day.et0Mm));
  const et0Forecast = sumKnown(days.filter((day) => day.et0Kind === 'forecast').map((day) => day.et0Mm));
  const et0MissingDates = days.filter((day) => day.et0Mm === null).map((day) => day.date);
  // Chaque jour de la semaine compte une seule fois : aujourd'hui appartient au réel et
  // n'est jamais compté une seconde fois dans la pluie prévue (D-019).
  const pastDays = days.filter((day) => day.date <= today);
  const futureDays = days.filter((day) => day.date > today);
  // Pluie d'un jour écoulé : pluviomètre, sinon réanalyse, sinon la prévision enregistrée pour
  // ce jour, sinon zéro. Le besoin reste toujours calculable et les jours sans pluie réelle
  // sont listés, ceux repris de la prévision étant distingués (D-019).
  const actualExteriorRainMm = sumEstimated(pastDays.map((day) => day.effectiveActualRainMm ?? day.forecastRainMm));
  const forecastExteriorRainMm = sumEstimated(futureDays.map((day) => day.forecastRainMm));
  const actualRainMissingDates = pastDays.filter((day) => day.effectiveActualRainMm === null).map((day) => day.date);
  const actualRainEstimatedDates = pastDays
    .filter((day) => day.effectiveActualRainMm === null && day.forecastRainMm !== null)
    .map((day) => day.date);
  const forecastRainMissingDates = futureDays.filter((day) => day.forecastRainMm === null).map((day) => day.date);
  const actualByBed = actualIrrigationByBed(events, weekStart, weekEnd);
  const plannedByBed = plannedIrrigationByBed(events, weekStart, weekEnd, now);
  const gardenRows = new Map<string, BedIrrigationNeed[]>();

  for (const bed of beds) {
    const plot = plots.get(bed.plotId);
    const zone = zones.get(bed.zoneId);
    if (!plot || !zone) continue;
    const sheltered = plot.mode === 'greenhouse';
    const objective = objectiveForBed(goalRevisions, bed, weekStart, weekEnd);
    const actualRain = sheltered ? 0 : actualExteriorRainMm;
    const forecastRain = sheltered ? 0 : forecastExteriorRainMm;
    const actualIrrigation = actualByBed.get(bed.id) ?? 0;
    const plannedIrrigation = plannedByBed.get(bed.id) ?? 0;
    const realRemaining = realRemainingMm(objective.value, actualRain, actualIrrigation);
    const raw = planningNeedMm(objective.value, actualRain, forecastRain, actualIrrigation, plannedIrrigation);
    const calculated = applyPlanningThreshold(raw, input.thresholdMm);
    const decision = decisionByBed.get(bed.id);
    const effective = decision?.manualOverrideMm ?? calculated;
    const wettedArea = resolveBedWettedArea(bed, positionedKindsByBed.get(bed.id) ?? []);
    // Une ET0 incomplète est signalée par missingDates.et0 mais ne bloque jamais le besoin (D-010).
    const demandMissing: IrrigationNeedCompleteness['missing'] = [];
    if (!objective.complete) demandMissing.push('objective');
    const realMissing: IrrigationNeedCompleteness['missing'] = [...demandMissing];
    if (!sheltered && actualRainMissingDates.length > 0) realMissing.push('actual-rain');
    const planningMissing: IrrigationNeedCompleteness['missing'] = [...realMissing];
    if (!sheltered && forecastRainMissingDates.length > 0) planningMissing.push('forecast-rain');
    const missing = [...new Set(planningMissing)];
    const row: BedIrrigationNeed = {
      bedId: bed.id, bedName: bed.name, plotId: plot.id, plotName: plot.name,
      zoneId: zone.id, zoneName: zone.name, sheltered,
      areaSquareMeters: Math.max(0, bed.area),
      wettedAreaSquareMeters: wettedArea.squareMeters, wettedAreaSource: wettedArea.source,
      et0Mm: et0.value,
      et0KnownMm: et0.knownValue, et0ReanalysisMm: et0Reanalysis,
      et0ForecastMm: et0Forecast,
      objectiveMm: objective.value, objectiveSource: objective.source,
      actualRainMm: actualRain, actualIrrigationMm: actualIrrigation,
      realRemainingMm: realRemaining,
      relativeDeficitPercent: relativeDeficitPercent(realRemaining, objective.value),
      forecastRainMm: forecastRain, plannedIrrigationMm: plannedIrrigation,
      rawPlanningNeedMm: raw, thresholdMm: Math.max(0, input.thresholdMm),
      calculatedNeedMm: calculated, manualOverrideMm: decision?.manualOverrideMm ?? null,
      overrideReason: decision?.overrideReason ?? null, effectiveNeedMm: effective,
      effectiveVolumeCubicMeters: needVolumeCubicMeters(effective, wettedArea.squareMeters),
      priority: decision?.priority ?? 'normal',
      weekStart,
      weekEnd,
      deadlineAt: localDateStartUtc(addDaysToDateKey(weekEnd, 1), FARM_TIME_ZONE).toISOString(),
      completeness: {
        complete: planningMissing.length === 0,
        missing,
        demandComplete: demandMissing.length === 0,
        realComplete: realMissing.length === 0,
        planningComplete: planningMissing.length === 0,
        missingDates: {
          et0: et0MissingDates,
          actualRain: sheltered ? [] : actualRainMissingDates,
          forecastRain: sheltered ? [] : forecastRainMissingDates,
        },
        estimatedDates: { actualRain: sheltered ? [] : actualRainEstimatedDates },
      },
    };
    const rows = gardenRows.get(plot.id) ?? [];
    rows.push(row);
    gardenRows.set(plot.id, rows);
  }

  const gardens = [...gardenRows.entries()].map(([plotId, gardenBeds]) => {
    const plot = plots.get(plotId)!;
    const zone = zones.get(plot.zoneId)!;
    const area = gardenBeds.reduce((sum, bed) => sum + bed.areaSquareMeters, 0);
    const allComplete = gardenBeds.every((bed) => bed.effectiveNeedMm !== null);
    const allRealComplete = gardenBeds.every((bed) => bed.realRemainingMm !== null);
    // Un volume inconnu — surface mouillée inconnue — laisse le total du jardin inconnu (D-003).
    const volumes = gardenBeds.map((bed) => bed.effectiveVolumeCubicMeters);
    const volume = volumes.every((value) => value !== null) ? volumes.reduce((sum, value) => sum + (value ?? 0), 0) : null;
    return {
      plotId, plotName: plot.name, zoneId: zone.id, zoneName: zone.name,
      sheltered: plot.mode === 'greenhouse', areaSquareMeters: area,
      bedCount: gardenBeds.length,
      priorityCounts: {
        low: gardenBeds.filter((bed) => bed.priority === 'low').length,
        normal: gardenBeds.filter((bed) => bed.priority === 'normal').length,
        high: gardenBeds.filter((bed) => bed.priority === 'high').length,
      },
      realRemainingMm: allRealComplete && area > 0
        ? gardenBeds.reduce((sum, bed) => sum + (bed.realRemainingMm ?? 0) * bed.areaSquareMeters, 0) / area
        : null,
      effectiveNeedMm: allComplete && area > 0
        ? gardenBeds.reduce((sum, bed) => sum + (bed.effectiveNeedMm ?? 0) * bed.areaSquareMeters, 0) / area
        : null,
      effectiveVolumeCubicMeters: volume,
      beds: gardenBeds,
    } satisfies GardenIrrigationNeeds;
  }).sort((a, b) => a.zoneName.localeCompare(b.zoneName, 'fr') || a.plotName.localeCompare(b.plotName, 'fr'));
  const allBeds = gardens.flatMap((garden) => garden.beds);
  const missing = [...new Set(allBeds.flatMap((bed) => bed.completeness.missing))];
  return {
    season, weekStart, weekEnd, timeZone: FARM_TIME_ZONE,
    calculatedAt: now.toISOString(), thresholdMm: Math.max(0, input.thresholdMm), gardens,
    completeness: {
      complete: allBeds.every((bed) => bed.completeness.planningComplete),
      missing,
      demandComplete: allBeds.every((bed) => bed.completeness.demandComplete),
      realComplete: allBeds.every((bed) => bed.completeness.realComplete),
      planningComplete: allBeds.every((bed) => bed.completeness.planningComplete),
      missingDates: {
        et0: uniqueSorted(allBeds.flatMap((bed) => bed.completeness.missingDates.et0)),
        actualRain: uniqueSorted(allBeds.flatMap((bed) => bed.completeness.missingDates.actualRain)),
        forecastRain: uniqueSorted(allBeds.flatMap((bed) => bed.completeness.missingDates.forecastRain)),
      },
      estimatedDates: {
        actualRain: uniqueSorted(allBeds.flatMap((bed) => bed.completeness.estimatedDates.actualRain)),
      },
    },
  };
}

function sumComplete(values: readonly (number | null)[]) {
  const knownValue = sumKnown(values);
  return values.every((value) => value !== null)
    ? { value: knownValue ?? 0, knownValue, complete: true }
    : { value: null, knownValue, complete: false };
}

/**
 * Somme d'une semaine en comptant zéro pour une journée sans donnée : le besoin reste
 * calculable et les journées concernées sont listées à part (D-019, contrat des besoins).
 */
function sumEstimated(values: readonly (number | null)[]) {
  return values.reduce((sum: number, value) => sum + (value ?? 0), 0);
}

function sumKnown(values: readonly (number | null)[]) {
  const known = values.filter((value): value is number => value !== null);
  return known.length === 0 ? null : known.reduce((sum, value) => sum + value, 0);
}

function uniqueSorted(values: readonly string[]) {
  return [...new Set(values)].sort();
}

/** L'objectif applicable d'une planche pour une semaine : la règle du besoin, lue aussi par l'objectif proposé (5 quater). */
export function objectiveForBed(revisions: readonly GoalRevisionLike[], bed: Pick<Bed, 'id' | 'zoneId' | 'plotId'>, weekStart: string, weekEnd: string) {
  // Tri stable, semaine puis date : deux révisions reçues dans la même milliseconde gardent l'ordre
  // reçu du dépôt et la seconde fait foi ; jamais de départage par l'identifiant (docs/revision-order-contract.md).
  const ordered = [...revisions].sort((a, b) => a.weekStart.localeCompare(b.weekStart) || a.createdAt.localeCompare(b.createdAt));
  const state = new Map<string, GoalRevisionLike>();
  let total = 0;
  let available = 0;
  const sources = new Set<GoalRevisionLike['scopeType']>();
  for (let date = weekStart; date <= weekEnd; date = addDaysToDateKey(date, 1)) {
    for (const revision of ordered) {
      // Chaque révision compte à partir de son jour de pose (D-034), règle partagée avec l'historique (D-039).
      if (goalRevisionFirstDate(revision) <= date) {
        const key = `${revision.scopeType}:${revision.otfZoneId ?? ''}:${revision.otfPlotId ?? ''}:${revision.otfBedId ?? ''}`;
        if (revision.action === 'cleared' || revision.amountMm === null) state.delete(key); else state.set(key, revision);
      }
    }
    const applicable = [...state.values()].filter((goal) => goalApplies(goal, bed)).sort((a, b) => scopeRank(b.scopeType) - scopeRank(a.scopeType) || b.createdAt.localeCompare(a.createdAt))[0];
    if (applicable?.amountMm !== null && applicable?.amountMm !== undefined) {
      total += Math.max(0, applicable.amountMm) / 7;
      available += 1;
      sources.add(applicable.scopeType);
    }
  }
  const source: GoalRevisionLike['scopeType'] | 'mixed' | null = sources.size === 0
    ? null
    : sources.size === 1
      ? [...sources][0]
      : 'mixed';
  // Un objectif posé en cours de semaine vaut pour ses jours restants : la
  // demande est la somme des septièmes sur les jours couverts, et seule une
  // semaine sans aucun jour couvert est sans objectif (D-034, point ouvert 16).
  return {
    value: available > 0 ? total : null,
    complete: available > 0,
    source,
  };
}

function goalApplies(goal: GoalRevisionLike, bed: Pick<Bed, 'id' | 'zoneId' | 'plotId'>) {
  return (goal.otfZoneId === null || goal.otfZoneId === bed.zoneId)
    && (goal.otfPlotId === null || goal.otfPlotId === bed.plotId)
    && (goal.otfBedId === null || goal.otfBedId === bed.id);
}
function scopeRank(scope: GoalRevisionLike['scopeType']) { return scope === 'bed' ? 4 : scope === 'plot' ? 3 : scope === 'zone' ? 2 : 1; }

function actualIrrigationByBed(events: readonly IrrigationEventRecord[], weekStart: string, weekEnd: string) {
  const result = new Map<string, number>();
  const period: HistoryPeriod = {
    mode: 'week', startDate: weekStart, endDate: weekEnd,
    startAt: localDateStartUtc(weekStart, FARM_TIME_ZONE).toISOString(),
    endAtExclusive: localDateStartUtc(addDaysToDateKey(weekEnd, 1), FARM_TIME_ZONE).toISOString(),
  };
  for (const event of events) {
    if (event.status !== 'completed' && event.status !== 'partially_completed') continue;
    const fraction = actualFractionInsidePeriod(event, period);
    if (fraction <= 0) continue;
    for (const application of event.equipment.applications) result.set(application.otfBedId, (result.get(application.otfBedId) ?? 0) + Math.max(0, application.actualAmountMm) * fraction);
  }
  return result;
}

function plannedIrrigationByBed(events: readonly IrrigationEventRecord[], weekStart: string, weekEnd: string, now: Date) {
  const result = new Map<string, number>();
  const endExclusive = localDateStartUtc(addDaysToDateKey(weekEnd, 1), FARM_TIME_ZONE).getTime();
  const start = Math.max(now.getTime(), localDateStartUtc(weekStart, FARM_TIME_ZONE).getTime());
  for (const row of remainingPlannedApplications(events, new Date(start), new Date(endExclusive))) result.set(row.bedId, (result.get(row.bedId) ?? 0) + row.amountMm);
  return result;
}
