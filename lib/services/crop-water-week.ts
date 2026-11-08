import { readCropWaterInputsForWorkspace, bedWaterSettings, type CropWaterInputs } from '@/db/crop-water/inputs';
import { listWeatherDailyValuesForUser, readWeatherPreferenceForUser, type WeatherDailyRecord } from '@/db/water-management-repository';
import { findWorkspaceIdForUser } from '@/db/workspace-repository';
import type { Bed, IrrigationSnapshot } from '../domain/domain';
import type { Et0Reading } from '../domain/crop-water/etm';
import { bedWaterDays, bedWeekProposal, type BedCropWaterInput, type BedWaterDay, type WeekProposal } from '../domain/crop-water/proposal';
import type { UnplacedCultivation } from '../domain/crop-water/crop-calendar';
import { curveStages, type ReferenceCrop } from '../domain/crop-water/reference';
import { addDaysToDateKey, dateKeyInTimeZone, FARM_TIME_ZONE, weekStartDateKey } from '../domain/water-management';
import { weatherLocationKey } from '../domain/weather/location';

/**
 * Le besoin par culture et par stade d'une semaine, planche par planche
 * (docs/crop-water-need-contract.md, « L'objectif proposé », « L'écran »,
 * 5 quater, PR 3b) : le domaine calcule, ce service lui donne ce que la
 * base et Ouvre ta ferme savent — cultures de référence, correspondance,
 * surcharges, stades déclarés, réglages, ET0 réanalysée et prévue.
 *
 * La proposition reste une information : rien ici n'écrit d'objectif, et
 * l'ET0 n'entre ni dans le besoin ni dans l'écart (D-010). L'objectif
 * applicable vient de l'appelant, qui le lit là où le besoin le lit.
 */

export type BedCropWater = {
  bedId: string;
  /** La semaine et sa proposition, face à l'objectif applicable. */
  week: WeekProposal & { days: BedWaterDay[]; unplaced: UnplacedCultivation[] };
  /** Aujourd'hui à la ferme : le stade, le Kc et l'ETM de chaque culture. */
  today: BedWaterDay;
  /** Les cultures de la semaine qui ont une culture de référence, et les stades qu'on peut y déclarer. */
  stageChoices: StageChoice[];
};

export type StageChoice = {
  seriesId: string;
  seriesName: string;
  plantName: string;
  referenceCropId: string;
  referenceCropName: string;
  stages: { rank: number; label: string }[];
};

export type CropWaterWeek = {
  available: boolean;
  today: string;
  weekStart: string;
  weekEnd: string;
  beds: BedCropWater[];
  /** Les cultures de référence qui ne peuvent pas servir, nommées avec leurs raisons. */
  unusableCrops: { name: string; problems: string[] }[];
};

/** Ce que la météo enregistrée donne pour chaque jour : la dernière réanalyse et la dernière prévision lues. */
export function et0Readings(records: readonly WeatherDailyRecord[]): Et0Reading[] {
  const byDate = new Map<string, { reanalysis: WeatherDailyRecord | null; forecast: WeatherDailyRecord | null }>();
  for (const record of records) {
    if (record.dataKind === 'manual_precipitation' || record.et0Mm === null) continue;
    const entry = byDate.get(record.date) ?? { reanalysis: null, forecast: null };
    const kind = record.dataKind;
    const known = entry[kind];
    if (known === null || record.fetchedAt >= known.fetchedAt) entry[kind] = record;
    byDate.set(record.date, entry);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, entry]) => ({ date, reanalysisMm: entry.reanalysis?.et0Mm ?? null, forecastMm: entry.forecast?.et0Mm ?? null }));
}

export async function getCropWaterWeekForUser(input: {
  ownerUserId: string;
  season: number;
  snapshot: IrrigationSnapshot;
  weekStart?: string;
  now?: Date;
  /** L'objectif applicable de la semaine de chaque planche, tel que le besoin le lit. */
  objectiveMmByBed: ReadonlyMap<string, number | null>;
  /** Les planches à calculer ; toutes celles de la saison par défaut. */
  bedIds?: readonly string[];
}): Promise<CropWaterWeek> {
  const now = input.now ?? new Date();
  const today = dateKeyInTimeZone(now, FARM_TIME_ZONE);
  const weekStart = weekStartDateKey(input.weekStart ?? today);
  const weekEnd = addDaysToDateKey(weekStart, 6);
  const cropPlan = input.snapshot.cropPlan;
  const workspaceId = await findWorkspaceIdForUser(input.ownerUserId);
  const empty = { today, weekStart, weekEnd, beds: [], unusableCrops: [] };
  if (!cropPlan || workspaceId === null) return { ...empty, available: Boolean(cropPlan) };

  const preference = await readWeatherPreferenceForUser(input.ownerUserId);
  const locationKey = weatherLocationKey(preference, input.snapshot.structure);
  const from = today < weekStart ? today : weekStart;
  const to = today > weekEnd ? today : weekEnd;
  const [inputs, weather] = await Promise.all([
    readCropWaterInputsForWorkspace(workspaceId, input.season),
    locationKey ? listWeatherDailyValuesForUser(input.ownerUserId, locationKey, from, to) : Promise.resolve([]),
  ]);
  const readings = et0Readings(weather);
  const plots = new Map(input.snapshot.plots.map((plot) => [plot.id, plot]));
  const wanted = input.bedIds ? new Set(input.bedIds) : null;
  const beds = input.snapshot.beds.filter((bed) => bed.seasons.includes(input.season) && (wanted === null || wanted.has(bed.id)));

  return {
    available: true,
    today,
    weekStart,
    weekEnd,
    unusableCrops: inputs.unusableCrops.map((stored) => ({ name: stored.crop.name, problems: stored.problems })),
    beds: beds.map((bed) => {
      const base = cropWaterBedInput(bed, plots.get(bed.plotId)?.mode === 'greenhouse', today, cropPlan, inputs, readings);
      const week = bedWeekProposal({ ...base, weekStart, objectiveMm: input.objectiveMmByBed.get(bed.id) ?? null });
      const todayDay = bedWaterDays(base, [today]).days[0];
      return { bedId: bed.id, week, today: todayDay, stageChoices: stageChoices([todayDay, ...week.days], inputs.referenceCrops) };
    }),
  };
}

/**
 * Les jours de chaque planche de la saison, pour des dates données : ce que
 * l'enregistrement quotidien de l'ETM écrit (« La traçabilité »). `null`
 * quand le plan de culture n'est pas lu ou que la ferme n'a pas d'espace.
 */
export async function getCropWaterDaysForUser(input: {
  ownerUserId: string;
  season: number;
  snapshot: IrrigationSnapshot;
  dates: readonly string[];
  now?: Date;
}): Promise<{ workspaceId: string; beds: { bedId: string; days: BedWaterDay[] }[] } | null> {
  const cropPlan = input.snapshot.cropPlan;
  const workspaceId = await findWorkspaceIdForUser(input.ownerUserId);
  if (!cropPlan || workspaceId === null || input.dates.length === 0) return null;
  const today = dateKeyInTimeZone(input.now ?? new Date(), FARM_TIME_ZONE);
  const sorted = [...input.dates].sort();
  const preference = await readWeatherPreferenceForUser(input.ownerUserId);
  const locationKey = weatherLocationKey(preference, input.snapshot.structure);
  const [inputs, weather] = await Promise.all([
    readCropWaterInputsForWorkspace(workspaceId, input.season),
    locationKey ? listWeatherDailyValuesForUser(input.ownerUserId, locationKey, sorted[0], sorted[sorted.length - 1]) : Promise.resolve([]),
  ]);
  const readings = et0Readings(weather);
  const plots = new Map(input.snapshot.plots.map((plot) => [plot.id, plot]));
  return {
    workspaceId,
    beds: input.snapshot.beds
      .filter((bed) => bed.seasons.includes(input.season))
      .map((bed) => ({
        bedId: bed.id,
        days: bedWaterDays(cropWaterBedInput(bed, plots.get(bed.plotId)?.mode === 'greenhouse', today, cropPlan, inputs, readings), sorted).days,
      })),
  };
}

/** Les cultures rencontrées ces jours-là avec une culture de référence, une fois chacune, et leurs stades. */
function stageChoices(days: readonly BedWaterDay[], crops: readonly ReferenceCrop[]): StageChoice[] {
  const choices = new Map<string, StageChoice>();
  for (const day of days) {
    for (const crop of day.crops) {
      if (crop.status !== 'computed' && crop.status !== 'unknown') continue;
      const reference = crops.find((candidate) => candidate.id === crop.trace.referenceCropId);
      const key = `${crop.seriesId}|${crop.trace.referenceCropId}`;
      if (!reference || choices.has(key)) continue;
      choices.set(key, {
        seriesId: crop.seriesId,
        seriesName: crop.seriesName,
        plantName: crop.plantName,
        referenceCropId: reference.id,
        referenceCropName: reference.name,
        stages: curveStages(reference.curve).map((stage) => ({ rank: stage.rank, label: stage.label })),
      });
    }
  }
  return [...choices.values()];
}

/** Ce que le domaine de la 5 quater lit pour une planche ; la jauge de la 5 ter le lit aussi. */
export function cropWaterBedInput(
  bed: Bed,
  sheltered: boolean,
  today: string,
  cropPlan: NonNullable<IrrigationSnapshot['cropPlan']>,
  inputs: CropWaterInputs,
  et0: readonly Et0Reading[],
): BedCropWaterInput {
  return {
    bedId: bed.id,
    today,
    cropPlan,
    referenceCrops: inputs.referenceCrops,
    correspondences: inputs.correspondences,
    overrides: inputs.overrides,
    declarations: inputs.declarations,
    et0Readings: et0,
    // L'abri d'une planche est son jardin, quand il est sous abri (« Les facteurs »).
    settings: bedWaterSettings(inputs.settings, bed.id, sheltered ? bed.plotId : null),
    options: inputs.settings.options,
  };
}
