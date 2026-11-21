import { listAdoptionsForBedForUser } from '@/db/crop-water/adoptions';
import { listEquipmentForUser } from '@/db/equipment/read';
import { listIrrigationEventsForUser } from '@/db/irrigation-event/read';
import { listHydricGoalRevisionsThroughWeekForUser, listWeatherDailyValuesForUser, type WeatherDailyRecord } from '@/db/water-management-repository';
import {
  appliedWaterGapPeriod,
  appliedWaterGaps,
  appliedWaterGapSignals,
  ratesOf,
  type AppliedWaterGapPeriod,
  type BedObjectiveReading,
  type BedWaterGap,
  type CurrentSetting,
  type GapBed,
  type RainDay,
} from '../domain/applied-water-gap';
import type { IrrigationSnapshot } from '../domain/domain';
import type { FeatureId } from '../domain/features/catalogue';
import { featurePart, isPartActive } from '../domain/features/socle';
import { objectiveForBed } from '../domain/irrigation-needs';
import { addDaysToDateKey, dateKeyInTimeZone, FARM_TIME_ZONE, localDateStartUtc } from '../domain/water-management';
import { weatherLocationKey } from '../domain/weather/location';
import { getCropWaterWeekForUser } from './crop-water-week';
import { getEnabledFeaturesForUser } from './feature-selection-service';
import { readWeatherPreference } from './weather-preference';

/**
 * L'écart entre l'eau prévue et l'eau apportée (amélioration n° 5,
 * docs/ameliorations-4-5-contract.md, section 4, F733 à F735, D-291) : la
 * lecture des trois dernières semaines complètes pour le bloc de « Planning
 * de la semaine ». Rien ici n'écrit : le besoin, la répartition et le
 * planning ne lisent pas l'écart.
 *
 * Les irrigations se lisent par leurs dates, de toutes les saisons : les
 * trois semaines peuvent chevaucher le 1er janvier. Les planches, l'objectif
 * et la proposition sont ceux de la saison de la page. Les lectures des
 * causes ne se font que pour une planche qui a un signal : sans signal, le
 * bloc ne lit ni la météo ni les cultures.
 */

export type AppliedWaterGapView = {
  /** Le lundi de la semaine en cours : « Adopter » est refusé quand la semaine a changé. */
  weekStart: string;
  /** Les trois semaines comparées, de la plus ancienne à la plus récente. */
  weeks: AppliedWaterGapPeriod['weeks'];
  gaps: BedWaterGap[];
  /** « Besoin par culture » décochée : la cause de l'objectif ne se cherche pas, une ligne le dit (P1) ; sinon `null`. */
  objectiveCauseNotice: string | null;
};

export async function getAppliedWaterGapsForUser(input: {
  ownerUserId: string;
  season: number;
  snapshot: IrrigationSnapshot;
  /** Les cases cochées, déjà lues par la page ; relues sinon. */
  enabled?: readonly FeatureId[];
  now?: Date;
}): Promise<AppliedWaterGapView> {
  const now = input.now ?? new Date();
  const today = dateKeyInTimeZone(now, FARM_TIME_ZONE);
  const period = appliedWaterGapPeriod(today);
  const empty: AppliedWaterGapView = { weekStart: period.currentWeekStart, weeks: period.weeks, gaps: [], objectiveCauseNotice: null };
  const beds = seasonBeds(input.snapshot, input.season);
  if (beds.length === 0) return empty;
  const [events, equipment, enabled] = await Promise.all([
    listIrrigationEventsForUser(input.ownerUserId, undefined, false, {
      startAt: localDateStartUtc(period.start, FARM_TIME_ZONE).toISOString(),
      endAt: localDateStartUtc(period.currentWeekStart, FARM_TIME_ZONE).toISOString(),
    }),
    listEquipmentForUser(input.ownerUserId),
    input.enabled ?? getEnabledFeaturesForUser(input.ownerUserId),
  ]);
  const currentSettings = new Map<string, CurrentSetting>(equipment
    .filter((item) => item.status === 'active')
    .flatMap((item) => item.settings.map((setting) => [setting.id, {
      equipmentId: item.id, equipmentName: item.name, settingId: setting.id, settingName: setting.name, rates: ratesOf(setting),
    }] as const)));
  // Le bloc demande « Planning de la semaine », qui porte l'eau prévue (§4.3, point 4).
  if (!enabled.includes('planning')) return empty;
  const signals = appliedWaterGapSignals({ today, events, bedIds: beds.map((bed) => bed.id), currentSettings });
  if (signals.length === 0) return empty;

  const signalled = new Set(signals.map((signal) => signal.bedId));
  const objectiveCauseActive = isPartActive(enabled, 'gap-objective-cause');
  const lessBedIds = signals.filter((signal) => signal.direction === 'less').map((signal) => signal.bedId);
  const [rain, objectives] = await Promise.all([
    beds.some((bed) => bed.outdoors && signalled.has(bed.id)) ? rainDays(input, period) : [],
    objectiveCauseActive ? objectiveReadings(input, period, now, lessBedIds) : null,
  ]);
  const gaps = appliedWaterGaps({ today, events, beds, currentSettings, rain, objectives });
  return {
    ...empty,
    gaps,
    objectiveCauseNotice: !objectiveCauseActive && gaps.some((gap) => gap.direction === 'less') ? featurePart('gap-objective-cause').missingNotice : null,
  };
}

/** Les planches de la saison, avec leur jardin ; la pluie n'est une cause que hors abri (§4.2, point 3). */
function seasonBeds(snapshot: IrrigationSnapshot, season: number): GapBed[] {
  const plots = new Map(snapshot.plots.map((plot) => [plot.id, plot]));
  return snapshot.beds
    .filter((bed) => bed.seasons.includes(season))
    .map((bed) => {
      const plot = plots.get(bed.plotId);
      return { id: bed.id, name: bed.name, plotName: plot?.name ?? '—', outdoors: plot?.mode === 'garden' };
    });
}

/**
 * La pluie de chaque jour de la période : la mesure au pluviomètre et la
 * réanalyse du lieu de la météo, la dernière relevée de chaque sorte, comme
 * le tableau de l'eau les lit.
 */
async function rainDays(input: { ownerUserId: string; snapshot: IrrigationSnapshot }, period: AppliedWaterGapPeriod): Promise<RainDay[]> {
  const preference = await readWeatherPreference(input.ownerUserId);
  const locationKey = weatherLocationKey(preference, input.snapshot.structure) ?? 'unconfigured';
  const rows = await listWeatherDailyValuesForUser(input.ownerUserId, locationKey, period.start, period.end);
  const byDate = new Map<string, Partial<Record<WeatherDailyRecord['dataKind'], WeatherDailyRecord>>>();
  for (const row of rows) byDate.set(row.date, { ...byDate.get(row.date), [row.dataKind]: row });
  return [...byDate.entries()].map(([date, kinds]) => ({
    date,
    measuredMm: kinds.manual_precipitation?.precipitationMm ?? null,
    reanalysisMm: kinds.reanalysis?.precipitationMm ?? null,
  }));
}

/**
 * Pour chaque planche qui reçoit moins que prévu : l'objectif de la semaine en
 * cours, lu par la règle du besoin, l'objectif proposé de la même semaine
 * (5 quater), l'objectif de la dernière semaine comparée, et les objectifs
 * proposés adoptés depuis lundi (F741).
 */
async function objectiveReadings(
  input: { ownerUserId: string; season: number; snapshot: IrrigationSnapshot },
  period: AppliedWaterGapPeriod,
  now: Date,
  bedIds: readonly string[],
): Promise<Map<string, BedObjectiveReading>> {
  const wanted = new Set(bedIds);
  const beds = input.snapshot.beds.filter((bed) => wanted.has(bed.id) && bed.seasons.includes(input.season));
  if (beds.length === 0) return new Map();
  const weekStart = period.currentWeekStart;
  const weekEnd = addDaysToDateKey(weekStart, 6);
  const lastWeek = period.weeks[period.weeks.length - 1];
  const revisions = await listHydricGoalRevisionsThroughWeekForUser(input.ownerUserId, input.season, weekStart);
  const objectiveMmByBed = new Map(beds.map((bed) => [bed.id, objectiveForBed(revisions, bed, weekStart, weekEnd).value]));
  const [week, adoptions] = await Promise.all([
    getCropWaterWeekForUser({ ownerUserId: input.ownerUserId, season: input.season, snapshot: input.snapshot, weekStart, now, objectiveMmByBed, bedIds: beds.map((bed) => bed.id) }),
    Promise.all(beds.map((bed) => listAdoptionsForBedForUser(input.ownerUserId, input.season, bed.id))),
  ]);
  const proposals = new Map(week.beds.map((bed) => [bed.bedId, bed.week]));
  return new Map(beds.map((bed, index) => {
    const proposal = proposals.get(bed.id);
    return [bed.id, {
      objectiveMm: objectiveMmByBed.get(bed.id) ?? null,
      proposedMm: proposal?.proposedMm ?? null,
      adoptable: proposal?.adoptable ?? false,
      lastWeekObjectiveMm: objectiveForBed(revisions, bed, lastWeek.weekStart, lastWeek.weekEnd).value,
      adoptedThisWeekMm: adoptions[index]
        .filter((adoption) => dateKeyInTimeZone(adoption.adoptedAt, FARM_TIME_ZONE) >= weekStart)
        .map((adoption) => adoption.amountMm),
    }];
  }));
}
