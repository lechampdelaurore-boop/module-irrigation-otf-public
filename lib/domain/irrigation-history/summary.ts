import type { IrrigationEventRecord } from '../irrigation-event-record.ts';
import { cubicMetersFromMillimeterSquareMeters } from '../units.ts';
import { decimalText } from '../figure-origin.ts';
import type { Bed, Plot } from '../domain.ts';
import { irrigationActiveIntervals } from '../water-management.ts';
import { goalRevisionFirstDate } from '../hydric-goal-revisions.ts';
import type {
  GoalRevisionLike,
  HistoryAvailability,
  HistoryPeriod,
  HistoryScope,
  IrrigationHistorySummary,
  WeatherDailyLike,
} from './contract.ts';
import { dateKeys, eventDisplayAt } from './dates.ts';
import { applicationMatchesScope, bedMatchesScope } from './scope.ts';

export function buildIrrigationHistorySummary({
  events,
  scopeBeds,
  plots,
  scope,
  period,
  weather,
  goalRevisions,
}: {
  events: readonly IrrigationEventRecord[];
  scopeBeds: readonly Bed[];
  plots: readonly Pick<Plot, 'id' | 'mode'>[];
  scope: HistoryScope;
  period: HistoryPeriod;
  weather: readonly WeatherDailyLike[];
  goalRevisions: readonly GoalRevisionLike[];
}): IrrigationHistorySummary {
  const irrigation = aggregateActualIrrigation(events, scopeBeds, scope, period);
  const weatherSummary = shelterObservedRain(aggregateObservedWeather(weather, period), scopeBeds, plots, period);
  const objective = aggregateHydricObjective(goalRevisions, scopeBeds, period);
  const inputs = irrigation.irrigationMm !== null
    && weatherSummary.actualRainMm !== null
    && weatherSummary.actualRainAvailability.complete
      ? irrigation.irrigationMm + weatherSummary.actualRainMm
      : null;
  const gap = objective.objectiveMm !== null && inputs !== null
    ? objective.objectiveMm - inputs
    : null;
  return {
    ...irrigation,
    ...weatherSummary,
    ...objective,
    irrigationAndRainMm: inputs,
    gapToObjectiveMm: gap,
  };
}

export function aggregateActualIrrigation(
  events: readonly IrrigationEventRecord[],
  scopeBeds: readonly Bed[],
  scope: HistoryScope,
  period: HistoryPeriod,
) {
  const areaByBed = new Map(
    scopeBeds
      .filter((bed) => bedMatchesScope(bed, scope))
      .map((bed) => [bed.id, Math.max(0, bed.area)]),
  );
  let totalMillimeterSquareMeters = 0;
  let wettedMillimeterSquareMeters = 0;
  let volumeIncomplete = false;
  const irrigatedBeds = new Map<string, number>();

  for (const event of events) {
    if (!contributesRealWater(event)) continue;
    const fraction = actualFractionInsidePeriod(event, period);
    if (fraction <= 0) continue;
    for (const application of event.equipment.applications) {
      if (!applicationMatchesScope(application, scope)) continue;
      const area = Math.max(0, application.bedAreaSquareMeters);
      if (!areaByBed.has(application.otfBedId)) areaByBed.set(application.otfBedId, area);
      const amount = Math.max(0, application.actualAmountMm) * fraction;
      totalMillimeterSquareMeters += amount * area;
      if (amount > 0) irrigatedBeds.set(application.otfBedId, area);
      // Le volume se fait sur la surface mouillée ; une planche sans surface
      // connue rend le total incomplet, elle ne le rend pas plus petit en silence.
      if (application.wettedAreaSquareMeters === null) {
        if (amount > 0) volumeIncomplete = true;
      } else {
        wettedMillimeterSquareMeters += amount * application.wettedAreaSquareMeters;
      }
    }
  }

  const scopeAreaSquareMeters = [...areaByBed.values()].reduce((sum, area) => sum + area, 0);
  return {
    irrigationCubicMeters: cubicMetersFromMillimeterSquareMeters(wettedMillimeterSquareMeters),
    irrigationVolumeIncomplete: volumeIncomplete,
    irrigationMm: scopeAreaSquareMeters > 0
      ? totalMillimeterSquareMeters / scopeAreaSquareMeters
      : null,
    irrigatedAreaSquareMeters: [...irrigatedBeds.values()].reduce((sum, area) => sum + area, 0),
    scopeAreaSquareMeters,
  };
}

export function aggregateObservedWeather(
  rows: readonly WeatherDailyLike[],
  period: Pick<HistoryPeriod, 'startDate' | 'endDate'>,
) {
  const dates = dateKeys(period.startDate, period.endDate);
  const rowsByDate = new Map<string, WeatherDailyLike[]>();
  for (const row of rows) {
    const current = rowsByDate.get(row.date) ?? [];
    current.push(row);
    rowsByDate.set(row.date, current);
  }
  let actualRainMm = 0;
  let et0Mm = 0;
  let rainDays = 0;
  let et0Days = 0;
  for (const date of dates) {
    const daily = rowsByDate.get(date) ?? [];
    const manual = daily.find((row) => row.dataKind === 'manual_precipitation');
    const reanalysis = daily.find((row) => row.dataKind === 'reanalysis');
    const forecast = daily.find((row) => row.dataKind === 'forecast');
    const rain = manual?.precipitationMm ?? reanalysis?.precipitationMm ?? null;
    const et0 = reanalysis?.et0Mm ?? forecast?.et0Mm ?? null;
    if (rain !== null) {
      actualRainMm += Math.max(0, rain);
      rainDays += 1;
    }
    if (et0 !== null) {
      et0Mm += Math.max(0, et0);
      et0Days += 1;
    }
  }
  return {
    actualRainMm: rainDays === 0 ? null : actualRainMm,
    actualRainAvailability: availability(rainDays, dates.length),
    et0Mm: et0Days === 0 ? null : et0Mm,
    et0Availability: availability(et0Days, dates.length),
  };
}

/**
 * Sous abri, la pluie vaut zéro (cahier des charges ; D-032, point ouvert 11) :
 * la pluie réelle du périmètre est pondérée par la surface de ses planches,
 * zéro sur celles d'un jardin sous abri. Un périmètre entièrement sous abri
 * lit 0 mm, explicite et complet, quelle que soit la météo ; un périmètre
 * mixte lit la pluie extérieure au prorata de sa surface de plein champ.
 * L'ET0 reste celle de l'extérieur, affichée pour information (D-010).
 */
function shelterObservedRain(
  observed: ReturnType<typeof aggregateObservedWeather>,
  scopeBeds: readonly Pick<Bed, 'plotId' | 'area'>[],
  plots: readonly Pick<Plot, 'id' | 'mode'>[],
  period: Pick<HistoryPeriod, 'startDate' | 'endDate'>,
) {
  const shelteredPlots = new Set(plots.filter((plot) => plot.mode === 'greenhouse').map((plot) => plot.id));
  let totalArea = 0;
  let openFieldArea = 0;
  for (const bed of scopeBeds) {
    const area = Math.max(0, bed.area);
    totalArea += area;
    if (!shelteredPlots.has(bed.plotId)) openFieldArea += area;
  }
  if (totalArea <= 0 || openFieldArea === totalArea) return observed;
  if (openFieldArea === 0) {
    const totalDays = dateKeys(period.startDate, period.endDate).length;
    return { ...observed, actualRainMm: 0, actualRainAvailability: availability(totalDays, totalDays) };
  }
  return {
    ...observed,
    actualRainMm: observed.actualRainMm === null ? null : observed.actualRainMm * openFieldArea / totalArea,
  };
}

export function aggregateHydricObjective(
  revisions: readonly GoalRevisionLike[],
  scopeBeds: readonly Pick<Bed, 'id' | 'zoneId' | 'plotId' | 'area'>[],
  period: Pick<HistoryPeriod, 'startDate' | 'endDate'>,
) {
  const dates = dateKeys(period.startDate, period.endDate);
  // Tri stable, semaine puis date, sans départage par l'identifiant (docs/revision-order-contract.md).
  // Chaque révision compte à partir de son jour de pose, la règle du tableau des besoins (D-039,
  // point ouvert 40) ; par périmètre, la plus récente des révisions déjà comptées fait foi.
  const ordered = [...revisions].sort((left, right) =>
    left.weekStart.localeCompare(right.weekStart) || left.createdAt.localeCompare(right.createdAt));
  const activations: GoalActivation[] = ordered
    .map((revision, order) => ({ revision, order, from: goalRevisionFirstDate(revision) }))
    .sort((left, right) => left.from.localeCompare(right.from) || left.order - right.order);
  const totalArea = scopeBeds.reduce((sum, bed) => sum + Math.max(0, bed.area), 0);
  const state = new Map<string, GoalActivation>();
  let activationIndex = 0;
  let objectiveMm = 0;
  let availableBedDays = 0;
  const totalBedDays = dates.length * scopeBeds.length;

  for (const date of dates) {
    while (activationIndex < activations.length && activations[activationIndex].from <= date) {
      const activation = activations[activationIndex];
      const key = goalScopeKey(activation.revision);
      const current = state.get(key);
      if (!current || current.order < activation.order) state.set(key, activation);
      activationIndex += 1;
    }
    let weightedDaily = 0;
    for (const bed of scopeBeds) {
      const goal = applicableGoal(state, bed);
      if (!goal || totalArea <= 0) continue;
      availableBedDays += 1;
      weightedDaily += Math.max(0, goal.amountMm ?? 0) / 7 * Math.max(0, bed.area);
    }
    if (totalArea > 0) objectiveMm += weightedDaily / totalArea;
  }

  // L'objectif se somme sur les journées-planche couvertes ; une journée-planche
  // sans objectif compte zéro et n'est pas une donnée manquante. Seule une période
  // sans aucune journée-planche couverte est sans objectif (D-036, point ouvert 39).
  // « complete » dit si toutes le sont, pour l'affichage du nombre couvert.
  const complete = totalBedDays > 0 && availableBedDays === totalBedDays;
  return {
    objectiveMm: availableBedDays > 0 ? objectiveMm : null,
    objectiveAvailability: {
      availableBedDays,
      totalBedDays,
      complete,
    },
  };
}

export function contributesRealWater(event: IrrigationEventRecord) {
  return event.status === 'completed' || event.status === 'partially_completed';
}

export function actualFractionInsidePeriod(event: IrrigationEventRecord, period: HistoryPeriod) {
  if (!contributesRealWater(event)) return 0;
  const start = new Date(period.startAt).getTime();
  const end = new Date(period.endAtExclusive).getTime();
  const intervals = irrigationActiveIntervals(event).filter((interval) =>
    Number.isFinite(interval.startAt.getTime()) && Number.isFinite(interval.endAt.getTime()));
  const total = intervals.reduce((sum, interval) =>
    sum + Math.max(0, interval.endAt.getTime() - interval.startAt.getTime()), 0);
  if (total <= 0) {
    const display = Date.parse(eventDisplayAt(event));
    return display >= start && display < end ? 1 : 0;
  }
  const overlap = intervals.reduce((sum, interval) => sum + Math.max(
    0,
    Math.min(end, interval.endAt.getTime()) - Math.max(start, interval.startAt.getTime()),
  ), 0);
  return Math.min(1, overlap / total);
}

function goalScopeKey(goal: Pick<
  GoalRevisionLike,
  'scopeType' | 'otfZoneId' | 'otfPlotId' | 'otfBedId'
>) {
  return [goal.scopeType, goal.otfZoneId, goal.otfPlotId, goal.otfBedId].join(':');
}

type GoalActivation = { revision: GoalRevisionLike; order: number; from: string };

function applicableGoal(
  state: ReadonlyMap<string, GoalActivation>,
  bed: Pick<Bed, 'id' | 'zoneId' | 'plotId'>,
) {
  // Un périmètre dont la dernière révision est un retrait n'a plus d'objectif propre :
  // le périmètre plus large s'applique, du plus précis au plus large.
  const keys = [
    ['bed', bed.zoneId, bed.plotId, bed.id],
    ['plot', bed.zoneId, bed.plotId, null],
    ['zone', bed.zoneId, null, null],
    ['farm', null, null, null],
  ];
  for (const key of keys) {
    const revision = state.get(key.join(':'))?.revision;
    if (revision && revision.action !== 'cleared' && revision.amountMm !== null) return revision;
  }
  return null;
}

function availability(availableDays: number, totalDays: number): HistoryAvailability {
  return {
    availableDays,
    totalDays,
    complete: totalDays > 0 && availableDays === totalDays,
  };
}

/**
 * La bulle « d'où vient ce chiffre » du cumul arrosé en mm d'un jardin ou de
 * la ferme (3.8, docs/feature-selection-contract.md, section 6) : l'eau de
 * chaque planche pondérée par sa surface, répartie sur tout le périmètre.
 */
export function irrigationCumulOrigin(summary: Pick<IrrigationHistorySummary, 'irrigationMm' | 'irrigatedAreaSquareMeters' | 'scopeAreaSquareMeters'>): string | null {
  if (summary.irrigationMm === null) return null;
  return `Apport irrigation ${decimalText(summary.irrigationMm)} mm : l’eau apportée à chaque planche (ses millimètres × sa surface), additionnée puis répartie sur toute la surface du périmètre, ${decimalText(summary.scopeAreaSquareMeters)} m². ${decimalText(summary.irrigatedAreaSquareMeters)} m² ont été arrosés ; une planche non arrosée compte 0 mm, une grande planche pèse plus qu’une petite.`;
}
