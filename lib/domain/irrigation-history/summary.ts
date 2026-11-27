import type { IrrigationEventRecord } from '../irrigation-event-record.ts';
import { cubicMetersFromMillimeterSquareMeters } from '../units.ts';
import { decimalText, mmText } from '../figure-origin.ts';
import type { Bed, Plot } from '../domain.ts';
import { irrigationActiveIntervals, weekStartDateKey } from '../water-management.ts';
import { goalRevisionFirstDate } from '../hydric-goal-revisions.ts';
import type { AutomaticObjectiveDayValues } from '../automatic-objective.ts';
import { farmObjective, farmObjectivePartial } from '../farm-objective.ts';
import type { OffSeasonByBed } from '../off-season.ts';
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
  automaticObjective,
  automaticObjectiveProvisionalWeeks,
  offSeason,
}: {
  events: readonly IrrigationEventRecord[];
  scopeBeds: readonly Bed[];
  plots: readonly Pick<Plot, 'id' | 'mode'>[];
  scope: HistoryScope;
  period: HistoryPeriod;
  weather: readonly WeatherDailyLike[];
  goalRevisions: readonly GoalRevisionLike[];
  /** Les valeurs de l'objectif automatique, quand la ferme l'a allumé sur la période (D-309). */
  automaticObjective?: AutomaticObjectiveDayValues;
  /** Les semaines closes, par leur lundi, que la tâche du matin n'a pas encore enregistrées : provisoires (règle 6, D-318). */
  automaticObjectiveProvisionalWeeks?: ReadonlySet<string>;
  /** La réponse du filtre « hors saison » par planche (D-337, D-352) : ces jours-là, aucun objectif ; la pluie et l'irrigation ne changent pas. */
  offSeason?: OffSeasonByBed;
}): IrrigationHistorySummary {
  const irrigation = aggregateActualIrrigation(events, scopeBeds, scope, period);
  const observed = aggregateObservedWeather(weather, period);
  const weatherSummary = shelterObservedRain(observed, scopeBeds, plots, period);
  const { aggregate: objective, bedsWithObjective } = hydricObjectiveOfBeds(
    goalRevisions, scopeBeds, period, automaticObjective, automaticObjectiveProvisionalWeeks, offSeason,
  );
  // L'écart se chiffre sur les planches de l'objectif (D-329, docs/simplification-s1-contract.md,
  // section 5 bis, règle 3) : quand une partie seulement en a un, l'eau reçue est celle de ces
  // seules planches, comme sur « Aujourd'hui » (F280) ; sinon, celle du périmètre, comme avant.
  const counted = farmObjectivePartial(objective.objectiveBeds)
    ? scopeBeds.filter((bed) => bedsWithObjective.has(bed.id))
    : null;
  const receivedIrrigationMm = counted === null
    ? irrigation.irrigationMm
    : aggregateActualIrrigation(events, counted, scope, period, true).irrigationMm;
  const receivedRain = counted === null ? weatherSummary : shelterObservedRain(observed, counted, plots, period);
  const inputs = receivedIrrigationMm !== null
    && receivedRain.actualRainMm !== null
    && receivedRain.actualRainAvailability.complete
      ? receivedIrrigationMm + receivedRain.actualRainMm
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
  /**
   * Vrai : l'eau des seules planches données, sans celle d'une autre planche du
   * périmètre (l'écart sur les planches de l'objectif, D-329). Faux : toute
   * l'eau du périmètre, une planche arrosée hors du plan de la saison comprise.
   */
  listedBedsOnly = false,
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
      if (listedBedsOnly && !areaByBed.has(application.otfBedId)) continue;
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
  // Un jardin à classer (4.4, F583) : la pluie qu'il a reçue n'est pas connue.
  const unclassifiedPlots = new Set(plots.filter((plot) => plot.mode === 'unclassified').map((plot) => plot.id));
  if (scopeBeds.some((bed) => unclassifiedPlots.has(bed.plotId))) return { ...observed, actualRainMm: null };
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

/**
 * L'objectif d'une période sur des planches : jour par jour, l'objectif saisi
 * le plus précis apporte à chaque planche un septième de sa valeur ; un jour
 * sans objectif saisi prend la valeur de l'objectif automatique quand
 * `automatic` en a une (D-309, contrat de l'objectif automatique, règle 7).
 * L'objectif d'une planche est la somme de ses jours couverts ; celui des
 * planches, la moyenne pondérée par la surface **sur les seules planches qui
 * en ont un**, la fonction unique de l'objectif de la ferme (`farmObjective`),
 * comme « Aujourd'hui » : une planche sans aucun jour couvert est comptée à
 * part (`objectiveBeds`), jamais à zéro (D-329, qui remplace D-036 sur ce
 * point ; docs/simplification-s1-contract.md, section 5 bis). Avec
 * `automatic`, le résultat dit aussi `objectiveAutomatic` : les
 * journées-planche qu'il a remplies et celles où il s'appliquait sans
 * valeur, jamais comptées pour zéro (D-003), et les semaines `provisional`
 * (closes, pas encore enregistrées) où il s'est appliqué (D-318). Sans
 * `automatic`, le résultat est celui d'avant (D-317).
 *
 * Un jour où `offSeason` dit une planche hors saison n'a aucun objectif, ni
 * saisi ni automatique, la règle d'`objectiveForBed` (D-337, D-352) : la
 * journée-planche n'est pas à couvrir, et une planche hors saison sans aucun
 * jour couvert est comptée à part (`objectiveBeds.offSeason`). Sans
 * `offSeason`, ou filtre vide, rien ne change.
 */
export function aggregateHydricObjective(
  revisions: readonly GoalRevisionLike[],
  scopeBeds: readonly Pick<Bed, 'id' | 'zoneId' | 'plotId' | 'area'>[],
  period: Pick<HistoryPeriod, 'startDate' | 'endDate'>,
  automatic?: AutomaticObjectiveDayValues,
  provisional?: ReadonlySet<string>,
  offSeason?: OffSeasonByBed,
): HydricObjectiveAggregate {
  return hydricObjectiveOfBeds(revisions, scopeBeds, period, automatic, provisional, offSeason).aggregate;
}

/** L'agrégat de l'objectif, et les planches qui ont un objectif sur la période : celles de l'écart (D-329, règle 3). */
function hydricObjectiveOfBeds(
  revisions: readonly GoalRevisionLike[],
  scopeBeds: readonly Pick<Bed, 'id' | 'zoneId' | 'plotId' | 'area'>[],
  period: Pick<HistoryPeriod, 'startDate' | 'endDate'>,
  automatic?: AutomaticObjectiveDayValues,
  provisional?: ReadonlySet<string>,
  offSeason?: OffSeasonByBed,
): { aggregate: HydricObjectiveAggregate; bedsWithObjective: ReadonlySet<string> } {
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
  // L'objectif de chaque planche sur la période : la somme de ses jours couverts.
  const objectiveByBed = new Map<string, number>();
  const cover = (bedId: string, dailyMm: number) => objectiveByBed.set(bedId, (objectiveByBed.get(bedId) ?? 0) + dailyMm);
  let availableBedDays = 0;
  let automaticBedDays = 0;
  let automaticMissingBedDays = 0;
  const provisionalWeeks = new Set<string>();
  // Les jours hors saison de chaque planche (D-352) : ils ne sont pas à couvrir.
  const offSeasonDates = new Map<string, string[]>();
  let offSeasonBedDays = 0;

  for (const date of dates) {
    const provisionalWeek = provisionalWeekOf(date, provisional);
    while (activationIndex < activations.length && activations[activationIndex].from <= date) {
      const activation = activations[activationIndex];
      const key = goalScopeKey(activation.revision);
      const current = state.get(key);
      if (!current || current.order < activation.order) state.set(key, activation);
      activationIndex += 1;
    }
    for (const bed of scopeBeds) {
      // Des planches sans aucune surface n'ont pas de moyenne : aucune journée n'y compte, comme avant.
      if (totalArea <= 0) continue;
      // Hors saison, ni l'objectif saisi ni l'objectif automatique ne comptent ce jour-là (D-337, D-352).
      if (offSeason?.get(bed.id)?.(date) === true) {
        offSeasonBedDays += 1;
        offSeasonDates.set(bed.id, [...(offSeasonDates.get(bed.id) ?? []), date]);
        continue;
      }
      const goal = applicableGoal(state, bed);
      if (goal) {
        availableBedDays += 1;
        cover(bed.id, Math.max(0, goal.amountMm ?? 0) / 7);
        continue;
      }
      // Un objectif saisi, à n'importe quel niveau, passe toujours avant l'objectif automatique (D-309).
      const automaticMm = automatic?.get(bed.id)?.get(date);
      if (automaticMm === undefined) continue;
      if (provisionalWeek !== null) provisionalWeeks.add(provisionalWeek);
      if (automaticMm === null) {
        automaticMissingBedDays += 1;
        continue;
      }
      availableBedDays += 1;
      automaticBedDays += 1;
      cover(bed.id, Math.max(0, automaticMm));
    }
  }

  // La moyenne pondérée par la surface sur les seules planches qui ont un objectif sur la
  // période, comme « Aujourd'hui » (D-329) ; une planche sans aucun jour couvert est dite,
  // jamais comptée à zéro. Seule une période sans aucune journée-planche couverte est sans
  // objectif ni écart (D-036). « complete » dit si toutes le sont, pour l'affichage.
  const objective = farmObjective(scopeBeds.map((bed) => ({
    areaSquareMeters: bed.area,
    objectiveMm: objectiveByBed.get(bed.id) ?? null,
    offSeasonDates: offSeasonDates.get(bed.id),
  })));
  const totalBedDays = dates.length * scopeBeds.length - offSeasonBedDays;
  const aggregate: HydricObjectiveAggregate = {
    objectiveMm: objective.objectiveMm,
    objectiveAvailability: {
      availableBedDays,
      totalBedDays,
      complete: totalBedDays > 0 && availableBedDays === totalBedDays,
    },
    objectiveBeds: {
      withObjective: objective.withObjective,
      total: objective.total,
      bedDays: objective.withObjective * dates.length,
      ...(objective.offSeason ? { offSeason: objective.offSeason } : {}),
    },
  };
  return {
    aggregate: automatic === undefined
      ? aggregate
      : { ...aggregate, objectiveAutomatic: { bedDays: automaticBedDays, missingBedDays: automaticMissingBedDays, provisionalWeeks: provisionalWeeks.size } },
    bedsWithObjective: new Set(objectiveByBed.keys()),
  };
}

type HydricObjectiveAggregate = Pick<IrrigationHistorySummary, 'objectiveMm' | 'objectiveAvailability' | 'objectiveAutomatic' | 'objectiveBeds'>;

/** Le lundi de `date` quand sa semaine est close sans être encore enregistrée (D-318). */
function provisionalWeekOf(date: string, provisional: ReadonlySet<string> | undefined): string | null {
  if (provisional === undefined || provisional.size === 0) return null;
  const monday = weekStartDateKey(date);
  return provisional.has(monday) ? monday : null;
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
  return `Apport irrigation ${mmText(summary.irrigationMm)} : l’eau apportée à chaque planche (ses millimètres × sa surface), additionnée puis répartie sur toute la surface du périmètre, ${decimalText(summary.scopeAreaSquareMeters)} m². ${decimalText(summary.irrigatedAreaSquareMeters)} m² ont été arrosés ; une planche non arrosée compte 0 mm, une grande planche pèse plus qu’une petite.`;
}
