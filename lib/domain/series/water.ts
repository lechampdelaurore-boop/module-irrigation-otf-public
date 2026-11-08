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
  /** Objectif prévu d'aujourd'hui à la dernière récolte attendue ; `null` : fin inconnue ou objectif absent. */
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

  series.sort((left, right) => left.name.localeCompare(right.name, 'fr'));
  upcoming.sort((left, right) => left.occupation.startDate.localeCompare(right.occupation.startDate));
  return { series, upcoming, ignored };
}

type PlaceOnBed = { place: CropPlan['places'][number]; bed: Bed; plot: Plot | null };

function summarizeSeries(
  item: CropSeries,
  occupation: SeriesOccupation,
  places: readonly PlaceOnBed[],
  input: { events: readonly IrrigationEventRecord[]; weather: readonly WeatherDailyLike[]; goalRevisions: readonly GoalRevisionLike[]; today: string },
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
      objectiveRemainingMm: null,
      irrigationAndRainMm: null, gapToObjectiveMm: null,
      et0Mm: null, et0Availability: none,
    };
  }

  // Les cumuls observés s'arrêtent à aujourd'hui.
  const endDate = occupation.endDate === null || occupation.endDate > input.today ? input.today : occupation.endDate;
  const observed = periodBetween(occupation.startDate, endDate);
  const weather = aggregateObservedWeather(input.weather, observed);

  let totalArea: number | null = 0;
  let millimeterSquareMeters = 0;
  let rainMillimeterSquareMeters = 0;
  let objectiveMillimeterSquareMeters = 0;
  let cubicMeters = 0;
  let volumeIncomplete = false;
  let availableBedDays = 0;
  let totalBedDays = 0;
  let allSheltered = places.length > 0;

  const beds = places.map(({ place, bed, plot }) => {
    const sheltered = plot?.mode === 'greenhouse';
    if (!sheltered) allSheltered = false;
    const area = placeArea(place.lengthMeters, bed);
    const irrigation = irrigationOnBed(input.events, bed, place.lengthMeters, observed);
    const objective = aggregateHydricObjective(input.goalRevisions, [bed], observed);
    // Sous abri, la pluie vaut explicitement zéro ; ailleurs, la mesure, sinon
    // la réanalyse — et seulement quand tous les jours sont là : une somme
    // partielle affichée comme un total tromperait (recette du 29 septembre 2026).
    const rainMm = sheltered ? 0 : weather.actualRainAvailability.complete ? weather.actualRainMm : null;

    cubicMeters += irrigation.cubicMeters ?? 0;
    if (irrigation.cubicMeters === null) volumeIncomplete = true;
    availableBedDays += objective.objectiveAvailability.availableBedDays;
    totalBedDays += objective.objectiveAvailability.totalBedDays;
    if (area === null || totalArea === null) {
      totalArea = null;
    } else {
      totalArea += area;
      millimeterSquareMeters += irrigation.mm * area;
      rainMillimeterSquareMeters += (rainMm ?? 0) * area;
      // Une planche sans aucune journée couverte n'avait pas de cible : zéro,
      // pas une donnée manquante (D-036).
      objectiveMillimeterSquareMeters += (objective.objectiveMm ?? 0) * area;
    }
    return {
      bedId: bed.id, bedName: bed.name, plotName: plot?.name ?? '—', sheltered,
      lengthMeters: place.lengthMeters, areaSquareMeters: area,
      irrigationMm: irrigation.mm, irrigationCubicMeters: irrigation.cubicMeters,
      rainMm, objectiveMm: objective.objectiveMm,
    };
  });

  const rainComplete = allSheltered || weather.actualRainAvailability.complete;
  const weighted = (value: number) => (totalArea !== null && totalArea > 0 ? value / totalArea : null);
  const irrigationMm = weighted(millimeterSquareMeters);
  const rainMm = rainComplete ? weighted(rainMillimeterSquareMeters) : null;
  const objectiveMm = availableBedDays > 0 ? weighted(objectiveMillimeterSquareMeters) : null;
  const irrigationAndRainMm = irrigationMm !== null && rainMm !== null ? irrigationMm + rainMm : null;
  const gapToObjectiveMm = objectiveMm !== null && irrigationAndRainMm !== null ? objectiveMm - irrigationAndRainMm : null;

  return {
    ...base,
    observedPeriod: { startDate: observed.startDate, endDate: observed.endDate },
    beds,
    areaSquareMeters: totalArea,
    irrigationMm,
    irrigationCubicMeters: cubicMeters,
    irrigationVolumeIncomplete: volumeIncomplete,
    rainMm,
    rainAvailability: allSheltered
      ? { availableDays: weather.actualRainAvailability.totalDays, totalDays: weather.actualRainAvailability.totalDays, complete: true }
      : weather.actualRainAvailability,
    objectiveMm,
    objectiveAvailability: { availableBedDays, totalBedDays, complete: totalBedDays > 0 && availableBedDays === totalBedDays },
    objectiveRemainingMm: remainingObjective(occupation, places, input.goalRevisions, input.today),
    irrigationAndRainMm,
    gapToObjectiveMm,
    et0Mm: weather.et0Mm,
    et0Availability: weather.et0Availability,
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

/** L'objectif encore prévu de demain à la dernière récolte attendue, pondéré par la surface occupée. */
function remainingObjective(
  occupation: SeriesOccupation,
  places: readonly PlaceOnBed[],
  goalRevisions: readonly GoalRevisionLike[],
  today: string,
): number | null {
  if (occupation.endDate === null || occupation.endDate <= today) return null;
  const period = { startDate: addDaysToDateKey(today, 1), endDate: occupation.endDate };
  let totalArea = 0;
  let weighted = 0;
  for (const { place, bed } of places) {
    const area = placeArea(place.lengthMeters, bed);
    const objective = aggregateHydricObjective(goalRevisions, [bed], period);
    if (area === null || objective.objectiveMm === null) return null;
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
