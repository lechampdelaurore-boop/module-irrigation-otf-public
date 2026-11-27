import type { Bed, CropPlan, CropSeries, Plot } from '../domain.ts';
import type { IrrigationEventRecord } from '../irrigation-event-record.ts';
import type { GoalRevisionLike, HistoryAvailability, HistoryPeriod, WeatherDailyLike } from '../irrigation-history/contract.ts';
import {
  actualFractionInsidePeriod,
  aggregateHydricObjective,
  aggregateObservedWeather,
  contributesRealWater,
} from '../irrigation-history/summary.ts';
import { cubicMetersFromMillimeterSquareMeters } from '../units.ts';
import { addDaysToDateKey, localDateStartUtc } from '../water-management.ts';
import { isIgnoredSeries, resolveSeriesOccupation, type SeriesOccupation } from './occupation.ts';
import { compareNamesNaturally } from '../bed-order.ts';
import type { AutomaticObjectiveDayValues } from '../automatic-objective.ts';
import { farmObjective, farmObjectivePartial } from '../farm-objective.ts';
import type { OffSeasonByBed } from '../off-season.ts';

/**
 * Les cumuls d'eau par série (docs/series-contract.md, « L'attribution des
 * millimètres », « La surface d'une série », « Les cumuls par série ») :
 * une projection sur l'historique par planche et les périodes d'occupation,
 * recalculée à la lecture, jamais stockée. Chaque série reçoit la totalité
 * des millimètres de ses planches sur sa période, et rien en dehors.
 */

type SeriesBedWater = {
  bedId: string;
  bedName: string;
  plotName: string;
  sheltered: boolean;
  lengthMeters: number | null;
  /** Surface de planche occupée, `linéaire × largeur` : pondère les millimètres. `null` : inconnue. */
  areaSquareMeters: number | null;
  irrigationMm: number;
  /** Sur la surface mouillée de chaque irrigation, au prorata du linéaire ; `null` : inconnu. */
  irrigationCubicMeters: number | null;
  rainMm: number | null;
  objectiveMm: number | null;
};

type SeriesWaterSummary = {
  seriesId: string;
  name: string;
  plantNames: string[];
  cycle: CropSeries['cycle'];
  occupation: SeriesOccupation;
  /** Jours observés : de l'implantation à aujourd'hui ou à la dernière récolte. `null` : à venir. */
  observedPeriod: { startDate: string; endDate: string } | null;
  beds: SeriesBedWater[];
  /** Somme des surfaces de planche occupées ; `null` dès qu'une est inconnue : pas de moyenne. */
  areaSquareMeters: number | null;
  irrigationMm: number | null;
  irrigationCubicMeters: number;
  irrigationVolumeIncomplete: boolean;
  rainMm: number | null;
  rainAvailability: HistoryAvailability;
  objectiveMm: number | null;
  objectiveAvailability: { availableBedDays: number; totalBedDays: number; complete: boolean };
  /**
   * Les planches de la série qui ont un objectif sur sa période, sur toutes
   * (D-329, docs/simplification-s1-contract.md, section 5 bis) : l'objectif
   * et l'écart se chiffrent sur elles, les autres sont dites ; celles hors
   * saison sans aucun jour d'objectif, à part (D-337, D-352), absent quand
   * il n'y en a aucune.
   */
  objectiveBeds: { withObjective: number; total: number; offSeason?: number };
  /**
   * Présent quand la ferme a allumé l'objectif automatique (D-309, D-317) :
   * les journées-planche observées qu'il a remplies, et celles où il
   * s'appliquait sans valeur, jamais comptées pour zéro en silence (D-003) ;
   * la règle de l'historique.
   */
  objectiveAutomatic?: { bedDays: number; missingBedDays: number };
  /**
   * Objectif prévu d'aujourd'hui à la dernière récolte attendue ; `null` : fin
   * inconnue, objectif absent, ou un jour où l'objectif automatique n'a pas de
   * valeur (au-delà de l'ET0 prévue, le plus souvent).
   */
  objectiveRemainingMm: number | null;
  irrigationAndRainMm: number | null;
  gapToObjectiveMm: number | null;
  et0Mm: number | null;
  et0Availability: HistoryAvailability;
};

export type SeriesWaterReport = {
  /** Séries en cours ou terminées, avec leurs cumuls, par nom. */
  series: SeriesWaterSummary[];
  /** Séries à venir, sans cumul, par date de début. */
  upcoming: SeriesWaterSummary[];
  /** Ni cumul ni affichage, mais comptées (D-022, règle 3). */
  ignored: { block: number; noImplantation: number };
};

export function buildSeriesWaterReport(input: {
  cropPlan: CropPlan;
  beds: readonly Bed[];
  plots: readonly Plot[];
  events: readonly IrrigationEventRecord[];
  weather: readonly WeatherDailyLike[];
  goalRevisions: readonly GoalRevisionLike[];
  today: string;
  /** Les valeurs de l'objectif automatique, quand la ferme l'a allumé (D-309) ; l'objectif se compose comme dans l'historique. */
  automaticObjective?: AutomaticObjectiveDayValues;
  /** La réponse du filtre « hors saison » par planche (D-337, D-352) : ces jours-là, aucun objectif, comme dans l'historique. */
  offSeason?: OffSeasonByBed;
}): SeriesWaterReport {
  const bedsById = new Map(input.beds.map((bed) => [bed.id, bed]));
  const plotsById = new Map(input.plots.map((plot) => [plot.id, plot]));
  const series: SeriesWaterSummary[] = [];
  const upcoming: SeriesWaterSummary[] = [];
  const ignored = { block: 0, noImplantation: 0 };

  for (const item of input.cropPlan.series) {
    const occupation = resolveSeriesOccupation(item, input.cropPlan.implantationTasks, input.today);
    if (isIgnoredSeries(occupation)) {
      if (occupation.reason === 'block') ignored.block += 1;
      else ignored.noImplantation += 1;
      continue;
    }
    const places = input.cropPlan.places
      .filter((place) => place.seriesId === item.id)
      .flatMap((place) => {
        const bed = bedsById.get(place.bedId);
        return bed ? [{ place, bed, plot: plotsById.get(bed.plotId) ?? null }] : [];
      });
    const summary = summarizeSeries(item, occupation, places, input);
    if (occupation.status === 'upcoming') upcoming.push(summary);
    else series.push(summary);
  }

  series.sort((left, right) => compareNamesNaturally(left.name, right.name));
  upcoming.sort((left, right) => left.occupation.startDate.localeCompare(right.occupation.startDate));
  return { series, upcoming, ignored };
}

type PlaceOnBed = { place: CropPlan['places'][number]; bed: Bed; plot: Plot | null };

type SummaryInput = {
  events: readonly IrrigationEventRecord[];
  weather: readonly WeatherDailyLike[];
  goalRevisions: readonly GoalRevisionLike[];
  today: string;
  automaticObjective?: AutomaticObjectiveDayValues;
  offSeason?: OffSeasonByBed;
};

function summarizeSeries(
  item: CropSeries,
  occupation: SeriesOccupation,
  places: readonly PlaceOnBed[],
  input: SummaryInput,
): SeriesWaterSummary {
  const base = {
    seriesId: item.id,
    name: item.name,
    plantNames: [...new Set(item.cultivations.map((cultivation) => cultivation.plantName))],
    cycle: item.cycle,
    occupation,
  };
  const none: HistoryAvailability = { availableDays: 0, totalDays: 0, complete: false };
  if (occupation.status === 'upcoming') {
    return {
      ...base,
      observedPeriod: null,
      beds: places.map(({ place, bed, plot }) => ({
        bedId: bed.id, bedName: bed.name, plotName: plot?.name ?? '—', sheltered: plot?.mode === 'greenhouse',
        lengthMeters: place.lengthMeters, areaSquareMeters: placeArea(place.lengthMeters, bed),
        irrigationMm: 0, irrigationCubicMeters: 0, rainMm: null, objectiveMm: null,
      })),
      areaSquareMeters: null,
      irrigationMm: null, irrigationCubicMeters: 0, irrigationVolumeIncomplete: false,
      rainMm: null, rainAvailability: none,
      objectiveMm: null, objectiveAvailability: { availableBedDays: 0, totalBedDays: 0, complete: false },
      objectiveBeds: { withObjective: 0, total: places.length },
      objectiveRemainingMm: null,
      irrigationAndRainMm: null, gapToObjectiveMm: null,
      et0Mm: null, et0Availability: none,
    };
  }

  // Les cumuls observés s'arrêtent à aujourd'hui.
  const endDate = occupation.endDate === null || occupation.endDate > input.today ? input.today : occupation.endDate;
  const observed = periodBetween(occupation.startDate, endDate);
  const weather = aggregateObservedWeather(input.weather, observed);

  let cubicMeters = 0;
  let volumeIncomplete = false;
  let availableBedDays = 0;
  let totalBedDays = 0;
  let automaticBedDays = 0;
  let automaticMissingBedDays = 0;
  const received: ReceivedOnBed[] = [];

  const beds = places.map(({ place, bed, plot }) => {
    const sheltered = plot?.mode === 'greenhouse';
    // Un jardin à classer (4.4, F583) : on ne sait pas s'il reçoit la pluie.
    const unclassified = plot?.mode === 'unclassified';
    const area = placeArea(place.lengthMeters, bed);
    const irrigation = irrigationOnBed(input.events, bed, place.lengthMeters, observed);
    const objective = aggregateHydricObjective(input.goalRevisions, [bed], observed, input.automaticObjective, undefined, input.offSeason);
    // Sous abri, la pluie vaut explicitement zéro ; ailleurs, la mesure, sinon
    // la réanalyse — et seulement quand tous les jours sont là : une somme
    // partielle affichée comme un total tromperait (recette du 29 septembre 2026).
    const rainMm = sheltered ? 0 : unclassified ? null : weather.actualRainAvailability.complete ? weather.actualRainMm : null;

    cubicMeters += irrigation.cubicMeters ?? 0;
    if (irrigation.cubicMeters === null) volumeIncomplete = true;
    availableBedDays += objective.objectiveAvailability.availableBedDays;
    totalBedDays += objective.objectiveAvailability.totalBedDays;
    automaticBedDays += objective.objectiveAutomatic?.bedDays ?? 0;
    automaticMissingBedDays += objective.objectiveAutomatic?.missingBedDays ?? 0;
    received.push({ area, irrigationMm: irrigation.mm, rainMm, sheltered, unclassified, objectiveMm: objective.objectiveMm, offSeason: objective.objectiveBeds.offSeason === 1 });
    return {
      bedId: bed.id, bedName: bed.name, plotName: plot?.name ?? '—', sheltered,
      lengthMeters: place.lengthMeters, areaSquareMeters: area,
      irrigationMm: irrigation.mm, irrigationCubicMeters: irrigation.cubicMeters,
      rainMm, objectiveMm: objective.objectiveMm,
    };
  });

  const water = receivedWater(received, weather.actualRainAvailability.complete);
  // L'objectif de la série : la moyenne pondérée par la surface occupée, sur les seules
  // planches qui ont un objectif sur sa période, comme « Aujourd'hui » (D-329) ; une planche
  // sans aucun jour couvert est dite, jamais comptée à zéro. Une surface inconnue : pas de
  // moyenne (D-003).
  const seriesObjective = farmObjective(received.map((row) => ({ areaSquareMeters: row.area ?? 0, objectiveMm: row.objectiveMm, offSeason: row.offSeason })));
  const objectiveMm = water.areaSquareMeters === null ? null : seriesObjective.objectiveMm;
  // L'écart se chiffre sur les mêmes planches que l'objectif (D-329, règle 3).
  const gapWater = farmObjectivePartial(seriesObjective)
    ? receivedWater(received.filter((row) => row.objectiveMm !== null), weather.actualRainAvailability.complete)
    : water;
  const irrigationAndRainMm = gapWater.irrigationMm !== null && gapWater.rainMm !== null ? gapWater.irrigationMm + gapWater.rainMm : null;
  const gapToObjectiveMm = objectiveMm !== null && irrigationAndRainMm !== null ? objectiveMm - irrigationAndRainMm : null;

  return {
    ...base,
    observedPeriod: { startDate: observed.startDate, endDate: observed.endDate },
    beds,
    areaSquareMeters: water.areaSquareMeters,
    irrigationMm: water.irrigationMm,
    irrigationCubicMeters: cubicMeters,
    irrigationVolumeIncomplete: volumeIncomplete,
    rainMm: water.rainMm,
    rainAvailability: water.allSheltered
      ? { availableDays: weather.actualRainAvailability.totalDays, totalDays: weather.actualRainAvailability.totalDays, complete: true }
      : weather.actualRainAvailability,
    objectiveMm,
    objectiveAvailability: { availableBedDays, totalBedDays, complete: totalBedDays > 0 && availableBedDays === totalBedDays },
    objectiveBeds: {
      withObjective: seriesObjective.withObjective,
      total: seriesObjective.total,
      ...(seriesObjective.offSeason ? { offSeason: seriesObjective.offSeason } : {}),
    },
    ...(input.automaticObjective === undefined ? {} : { objectiveAutomatic: { bedDays: automaticBedDays, missingBedDays: automaticMissingBedDays } }),
    objectiveRemainingMm: remainingObjective(occupation, places, input),
    irrigationAndRainMm,
    gapToObjectiveMm,
    et0Mm: weather.et0Mm,
    et0Availability: weather.et0Availability,
  };
}

/** Ce qu'une planche de la série a reçu sur sa période, et son objectif. */
type ReceivedOnBed = {
  /** Surface occupée ; `null` : inconnue. */
  area: number | null;
  irrigationMm: number;
  /** `null` : inconnue (jardin à classer, ou pluie réelle incomplète en plein champ). */
  rainMm: number | null;
  /** Hors saison sur toute la période, sans aucun jour d'objectif (D-352) : comptée à part. */
  offSeason: boolean;
  sheltered: boolean;
  unclassified: boolean;
  objectiveMm: number | null;
};

/**
 * L'eau reçue par des planches de la série, pondérée par la surface occupée,
 * Σ(mm × m²) / Σ(m²) : toutes ses planches pour ses cumuls, les seules
 * planches de l'objectif pour l'écart (D-329). Une surface inconnue : pas de
 * moyenne ; la pluie est inconnue dès qu'un jardin est à classer, ou qu'elle
 * manque un jour sur une planche de plein champ.
 */
function receivedWater(rows: readonly ReceivedOnBed[], weatherComplete: boolean) {
  let areaSquareMeters: number | null = 0;
  let millimeterSquareMeters = 0;
  let rainMillimeterSquareMeters = 0;
  let allSheltered = rows.length > 0;
  let rainUnknown = false;
  for (const row of rows) {
    if (!row.sheltered) allSheltered = false;
    if (row.unclassified) rainUnknown = true;
    if (row.area === null || areaSquareMeters === null) {
      areaSquareMeters = null;
      continue;
    }
    areaSquareMeters += row.area;
    millimeterSquareMeters += row.irrigationMm * row.area;
    rainMillimeterSquareMeters += (row.rainMm ?? 0) * row.area;
  }
  const area = areaSquareMeters;
  const weighted = (value: number) => (area !== null && area > 0 ? value / area : null);
  const rainComplete = !rainUnknown && (allSheltered || weatherComplete);
  return {
    areaSquareMeters: area,
    irrigationMm: weighted(millimeterSquareMeters),
    rainMm: rainComplete ? weighted(rainMillimeterSquareMeters) : null,
    allSheltered,
  };
}

/** Surface de planche occupée par un emplacement : linéaire × largeur de la planche. */
function placeArea(lengthMeters: number | null, bed: Bed): number | null {
  if (lengthMeters === null || bed.width <= 0) return null;
  return lengthMeters * bed.width;
}

/**
 * L'eau réelle reçue par une planche sur une période : les millimètres en
 * entier — deux séries sur la planche les reçoivent chacune —, le volume sur
 * la surface mouillée de chaque irrigation, au prorata du linéaire occupé.
 */
function irrigationOnBed(
  events: readonly IrrigationEventRecord[],
  bed: Bed,
  lengthMeters: number | null,
  period: HistoryPeriod,
): { mm: number; cubicMeters: number | null } {
  const share = lengthMeters !== null && bed.length > 0 ? Math.min(1, lengthMeters / bed.length) : null;
  let mm = 0;
  let wettedMillimeterSquareMeters = 0;
  let unknown = false;
  for (const event of events) {
    if (!contributesRealWater(event)) continue;
    const fraction = actualFractionInsidePeriod(event, period);
    if (fraction <= 0) continue;
    for (const application of event.equipment.applications) {
      if (application.otfBedId !== bed.id) continue;
      const amount = Math.max(0, application.actualAmountMm) * fraction;
      if (amount <= 0) continue;
      mm += amount;
      if (application.wettedAreaSquareMeters === null || share === null) unknown = true;
      else wettedMillimeterSquareMeters += amount * application.wettedAreaSquareMeters * share;
    }
  }
  return { mm, cubicMeters: unknown ? null : cubicMetersFromMillimeterSquareMeters(wettedMillimeterSquareMeters) };
}

/**
 * L'objectif encore prévu de demain à la dernière récolte attendue, pondéré
 * par la surface occupée. Un jour où l'objectif automatique s'applique sans
 * valeur (au-delà de l'ET0 prévue, le plus souvent) le rend inconnu : une
 * somme qui l'oublierait passerait pour l'objectif restant (D-003). Une
 * planche hors saison sur tous ces jours n'en a pas : elle ne compte pas,
 * comme dans l'objectif de la série (D-352).
 */
function remainingObjective(
  occupation: SeriesOccupation,
  places: readonly PlaceOnBed[],
  input: Pick<SummaryInput, 'goalRevisions' | 'today' | 'automaticObjective' | 'offSeason'>,
): number | null {
  if (occupation.endDate === null || occupation.endDate <= input.today) return null;
  const period = { startDate: addDaysToDateKey(input.today, 1), endDate: occupation.endDate };
  let totalArea = 0;
  let weighted = 0;
  for (const { place, bed } of places) {
    const area = placeArea(place.lengthMeters, bed);
    const objective = aggregateHydricObjective(input.goalRevisions, [bed], period, input.automaticObjective, undefined, input.offSeason);
    if (objective.objectiveBeds.offSeason === 1) continue;
    if (area === null || objective.objectiveMm === null || (objective.objectiveAutomatic?.missingBedDays ?? 0) > 0) return null;
    totalArea += area;
    weighted += objective.objectiveMm * area;
  }
  return totalArea > 0 ? weighted / totalArea : null;
}

/** Une période de jours à la ferme, du début du premier jour au début du lendemain du dernier (D-004). */
export function periodBetween(startDate: string, endDate: string): HistoryPeriod {
  return {
    mode: 'custom',
    startDate,
    endDate,
    startAt: localDateStartUtc(startDate).toISOString(),
    endAtExclusive: localDateStartUtc(addDaysToDateKey(endDate, 1)).toISOString(),
  };
}
