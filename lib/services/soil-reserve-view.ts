import { bedWaterSettings, readCropWaterInputsForWorkspace } from '@/db/crop-water/inputs';
import { readLatestPlanForUser, readPlanningSettingsForUser } from '@/db/planning-repository';
import { readSoilReserveInputsForWorkspace, type SoilReserveInputs } from '@/db/soil-reserve/inputs';
import { listWeatherDailyValuesForUser, readWeatherPreferenceForUser } from '@/db/water-management-repository';
import { findWorkspaceIdForUser } from '@/db/workspace-repository';
import type { IrrigationSnapshot } from '../domain/domain';
import type { StoredWeeklyPlan } from '../domain/planning/contract';
import { bedUpcomingCrops, bedWaterDays } from '../domain/crop-water/proposal';
import { bedSoilReserve, type IrrigationInterval, type SoilReserveDay } from '../domain/soil-reserve/gauge';
import { actualIrrigationsByBed, dayRainFromWeather, gaugeStartDate, irrigationIntervalsByBed } from '../domain/soil-reserve/gauge-inputs';
import { soilGaugeView, type SoilGaugeView } from '../domain/soil-reserve/gauge-view';
import { proposalSoilNotes, type ProposalSoilNote } from '../domain/soil-reserve/proposal-soil';
import { SURPLUS_DAYS, waterSurplus, type ActualIrrigation, type WaterSurplus } from '../domain/soil-reserve/water-surplus';
import { soilSettingsView, type SoilSettingsView } from '../domain/soil-reserve/settings-view';
import { addDaysToDateKey, dateKeyInTimeZone, FARM_TIME_ZONE, localDateStartUtc, weekStartDateKey } from '../domain/water-management';
import { weatherLocationKey } from '../domain/weather/location';
import { listCountedIrrigationEventsForUser } from './counted-irrigation-events';
import { cropWaterBedInput, et0Readings } from './crop-water-week';

/**
 * Le bloc « Réserve du sol » de la section « Planning de la semaine »
 * (docs/soil-reserve-contract.md, « L'écran », 5 ter, PR 3) : les réglages du
 * sol, par parcelle et par jardin, et ceux de l'exploitation ; la jauge de
 * chaque planche de la saison en cours, d'un départ jusqu'à dimanche. Une
 * ferme sans espace encore créé lit les valeurs de départ ; rien n'est écrit
 * ici. La jauge est une information (D-028, D-047). Depuis la PR 3d : la
 * dose au-delà de ce que le sol retient, par proposition du plan de la
 * semaine, et les jours de la jauge pour l'enregistrement du matin. Depuis
 * la pastille « eau arrosée en trop » : l'eau d'irrigation perdue en drainage
 * sur les sept derniers jours.
 */
export type SoilReserveView = {
  season: number;
  settings: SoilSettingsView;
  /** `null` : la jauge ne se calcule pas, pour la raison dite par `gaugeUnavailable`. */
  gauge: SoilGaugeView | null;
  gaugeUnavailable: string | null;
  /** Par proposition encore proposée (`storedId`), les planches dont la dose dépasse ce que le sol retient. */
  proposalSoilNotes: Record<string, ProposalSoilNote[]>;
  /** L'eau d'irrigation perdue en drainage sur les sept derniers jours ; `null` quand la jauge ne se calcule pas. */
  waterSurplus: WaterSurplus | null;
};

/** Les observations relues pour choisir le départ : quatre-vingt-dix jours, la limite de `gaugeStartDate`. */
const OBSERVATION_LOOKBACK_DAYS = 90;

export async function getSoilReserveViewForUser(input: {
  ownerUserId: string;
  season: number;
  snapshot: IrrigationSnapshot;
  now?: Date;
}): Promise<SoilReserveView> {
  const now = input.now ?? new Date();
  const today = dateKeyInTimeZone(now, FARM_TIME_ZONE);
  const workspaceId = await findWorkspaceIdForUser(input.ownerUserId);
  const inputs = workspaceId === null ? null : await readSoilReserveInputsForWorkspace(workspaceId, addDaysToDateKey(today, -OBSERVATION_LOOKBACK_DAYS));
  const settings = soilSettingsView({
    zones: input.snapshot.zones,
    plots: input.snapshot.plots,
    season: input.season,
    records: inputs?.soilRecords ?? [],
    settings: inputs?.settings ?? [],
    today,
  });
  const unavailable = workspaceId === null || inputs === null
    ? 'La jauge se calcule dès qu’un sol est saisi.'
    : Number(today.slice(0, 4)) !== input.season
      ? 'La jauge suit la saison en cours : elle ne se calcule pas pour une autre saison.'
      : !input.snapshot.cropPlan
        ? 'La jauge attend le plan de culture d’Ouvre ta ferme, qui n’a pas pu être lu.'
        : null;
  if (unavailable !== null || workspaceId === null || inputs === null) {
    return { season: input.season, settings, gauge: null, gaugeUnavailable: unavailable, proposalSoilNotes: {}, waterSurplus: null };
  }
  const computed = await soilDays({ ...input, now, today, workspaceId, inputs });
  return {
    season: input.season,
    settings,
    gauge: soilGaugeView({
      today,
      weekEnd: computed.weekEnd,
      zones: computed.zones,
      plots: computed.plots,
      beds: computed.beds,
      daysByBed: computed.daysByBed,
      observations: inputs.observations,
    }),
    gaugeUnavailable: null,
    proposalSoilNotes: proposalSoilNotes({
      proposals: computed.plan?.proposals ?? [],
      now,
      daysByBed: computed.daysByBed,
      intervalsByBed: computed.intervalsByBed,
    }),
    waterSurplus: waterSurplus({
      today,
      beds: computed.beds.map((bed) => ({ id: bed.id, name: bed.name })),
      daysByBed: computed.daysByBed,
      actualByBed: computed.actualByBed,
    }),
  };
}

/**
 * Les jours de la jauge de chaque planche de la saison en cours, pour
 * l'enregistrement du matin ; `null` quand la jauge ne se calcule pas (pas
 * d'espace, une autre saison, le plan de culture non lu).
 */
export async function soilReserveDaysForUser(input: {
  ownerUserId: string;
  season: number;
  snapshot: IrrigationSnapshot;
  now: Date;
}): Promise<{ workspaceId: string; today: string; daysByBed: ReadonlyMap<string, readonly SoilReserveDay[]> } | null> {
  const today = dateKeyInTimeZone(input.now, FARM_TIME_ZONE);
  if (Number(today.slice(0, 4)) !== input.season || !input.snapshot.cropPlan) return null;
  const workspaceId = await findWorkspaceIdForUser(input.ownerUserId);
  if (workspaceId === null) return null;
  const inputs = await readSoilReserveInputsForWorkspace(workspaceId, addDaysToDateKey(today, -OBSERVATION_LOOKBACK_DAYS));
  const computed = await soilDays({ ...input, today, workspaceId, inputs });
  return { workspaceId, today, daysByBed: computed.daysByBed };
}

type SoilDays = {
  weekEnd: string;
  zones: IrrigationSnapshot['zones'];
  plots: IrrigationSnapshot['plots'];
  beds: IrrigationSnapshot['beds'];
  daysByBed: Map<string, SoilReserveDay[]>;
  intervalsByBed: Map<string, IrrigationInterval[]>;
  actualByBed: Map<string, ActualIrrigation[]>;
  plan: StoredWeeklyPlan | null;
};

async function soilDays(input: {
  ownerUserId: string;
  season: number;
  snapshot: IrrigationSnapshot;
  now: Date;
  today: string;
  workspaceId: string;
  inputs: SoilReserveInputs;
}): Promise<SoilDays> {
  const { snapshot, season, today, inputs } = input;
  const cropPlan = snapshot.cropPlan!;
  const zones = snapshot.zones.filter((zone) => zone.seasons.includes(season));
  const plots = snapshot.plots.filter((plot) => plot.seasons.includes(season));
  const beds = snapshot.beds.filter((bed) => bed.seasons.includes(season));
  const sheltered = new Set(plots.filter((plot) => plot.mode === 'greenhouse').map((plot) => plot.id));
  const from = gaugeStartDate({
    today,
    season,
    plots: plots.map((plot) => ({ id: plot.id, zoneId: plot.zoneId, sheltered: sheltered.has(plot.id) })),
    observations: inputs.observations,
    observedDate: (observation) => dateKeyInTimeZone(new Date(observation.observedAt), FARM_TIME_ZONE),
  });
  const weekEnd = addDaysToDateKey(weekStartDateKey(today), 6);
  const surplusFrom = addDaysToDateKey(today, -SURPLUS_DAYS);
  const horizonEnd = localDateStartUtc(addDaysToDateKey(weekEnd, 1), FARM_TIME_ZONE);
  const dates: string[] = [];
  for (let date = from; date <= weekEnd; date = addDaysToDateKey(date, 1)) dates.push(date);

  const locationKey = weatherLocationKey(await readWeatherPreferenceForUser(input.ownerUserId), snapshot.structure);
  const [cropInputs, weather, events, plan, planningSettings] = await Promise.all([
    readCropWaterInputsForWorkspace(input.workspaceId, season),
    locationKey ? listWeatherDailyValuesForUser(input.ownerUserId, locationKey, from, weekEnd) : Promise.resolve([]),
    // Toutes saisons, comme le planning : une irrigation compte sur la planche qu'elle arrose.
    listCountedIrrigationEventsForUser(input.ownerUserId, undefined, true, {
      // Au moins les sept jours de l'eau arrosée en trop, pour dire inconnue une planche arrosée avant le départ.
      startAt: localDateStartUtc(from < surplusFrom ? from : surplusFrom, FARM_TIME_ZONE).toISOString(),
      endAt: horizonEnd.toISOString(),
    }),
    readLatestPlanForUser(input.ownerUserId, season, weekStartDateKey(today)),
    readPlanningSettingsForUser(input.ownerUserId),
  ]);
  const readings = et0Readings(weather);
  const rain = dayRainFromWeather(weather, today);
  const irrigations = irrigationIntervalsByBed({ events, plan, now: input.now, horizonEnd });

  const daysByBed = new Map<string, SoilReserveDay[]>();
  for (const bed of beds) {
    const underShelter = sheltered.has(bed.plotId);
    const water = cropWaterBedInput(bed, underShelter, today, cropPlan, cropInputs, readings);
    daysByBed.set(bed.id, bedSoilReserve({
      bed: { id: bed.id, zoneId: bed.zoneId, plotId: bed.plotId, sheltered: underShelter },
      today,
      waterDays: bedWaterDays(water, dates).days,
      rain,
      irrigations: irrigations.get(bed.id) ?? [],
      soilRecords: inputs.soilRecords,
      rootingProfiles: inputs.rootingProfiles,
      referenceCrops: cropInputs.referenceCrops,
      upcomingCrops: bedUpcomingCrops(water),
      observations: inputs.observations,
      surfaceDeclarations: inputs.surfaceDeclarations.filter((declaration) => declaration.bedId === bed.id),
      settings: inputs.settings,
      waterSettings: bedWaterSettings(cropInputs.settings, bed.id, underShelter ? bed.plotId : null),
      forecastRainShare: planningSettings.forecastRainShare,
    }));
  }
  return { weekEnd, zones, plots, beds, daysByBed, intervalsByBed: irrigations, actualByBed: actualIrrigationsByBed(events, input.now), plan };
}
