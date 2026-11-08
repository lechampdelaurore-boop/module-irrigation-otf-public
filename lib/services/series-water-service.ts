import { listIrrigationHistoryForUser } from '@/db/irrigation-history-repository';
import {
  listHydricGoalRevisionsThroughWeekForUser,
  listWeatherDailyValuesForUser,
  readWeatherPreferenceForUser,
} from '@/db/water-management-repository';
import type { IrrigationSnapshot } from '../domain/domain';
import { isIgnoredSeries, resolveSeriesOccupation } from '../domain/series/occupation';
import { buildSeriesWaterReport, periodBetween, type SeriesWaterReport } from '../domain/series/water';
import { dateKeyInTimeZone, weekStartDateKey } from '../domain/water-management';
import { weatherLocationKey } from '../domain/weather/location';

export type SeriesWaterDashboard =
  | {
      available: true;
      season: number;
      today: string;
      report: SeriesWaterReport;
      /** Ce que la lecture du plan de culture a écarté, pour le dire à l'écran. */
      readSummary: NonNullable<IrrigationSnapshot['cropPlan']>['readSummary'];
      warnings: string[];
    }
  | {
      available: false;
      season: number;
      reason: 'crop-plan-not-read';
    };

/**
 * Les cumuls par série d'une saison (docs/series-contract.md) : une projection
 * sur l'historique par planche, la météo observée et les objectifs historisés,
 * recalculée à chaque lecture. Rien n'est stocké.
 *
 * Les irrigations sont lues par instants sur l'ensemble des périodes
 * d'occupation, toutes saisons confondues : une série de la saison peut être
 * implantée l'année précédente. Les objectifs sont ceux de la saison et de la
 * précédente, relus comme un seul historique.
 */
export async function getSeriesWaterDashboardForUser({
  ownerUserId,
  season,
  snapshot,
  now = new Date(),
}: {
  ownerUserId: string;
  season: number;
  snapshot: IrrigationSnapshot;
  now?: Date;
}): Promise<SeriesWaterDashboard> {
  const cropPlan = snapshot.cropPlan;
  if (!cropPlan) return { available: false, season, reason: 'crop-plan-not-read' };
  const today = dateKeyInTimeZone(now);

  // La fenêtre de lecture : du début de la plus ancienne période observée à
  // aujourd'hui ; les objectifs jusqu'à la dernière récolte attendue.
  let earliestStart: string | null = null;
  let latestEnd = today;
  for (const item of cropPlan.series) {
    const occupation = resolveSeriesOccupation(item, cropPlan.implantationTasks, today);
    if (isIgnoredSeries(occupation) || occupation.status === 'upcoming') continue;
    if (earliestStart === null || occupation.startDate < earliestStart) earliestStart = occupation.startDate;
    if (occupation.endDate !== null && occupation.endDate > latestEnd) latestEnd = occupation.endDate;
  }

  const [events, weather, goalRevisions] = earliestStart === null
    ? [[], [], []]
    : await readInputs(ownerUserId, season, snapshot, earliestStart, today, latestEnd);

  const report = buildSeriesWaterReport({
    cropPlan,
    beds: snapshot.beds,
    plots: snapshot.plots,
    events,
    weather,
    goalRevisions,
    today,
  });

  return {
    available: true,
    season,
    today,
    report,
    readSummary: cropPlan.readSummary,
    warnings: seriesWarnings(report, cropPlan.readSummary),
  };
}

async function readInputs(
  ownerUserId: string,
  season: number,
  snapshot: IrrigationSnapshot,
  startDate: string,
  today: string,
  latestEnd: string,
) {
  const observed = periodBetween(startDate, today);
  const preference = await readWeatherPreferenceForUser(ownerUserId);
  const locationKey = weatherLocationKey(preference, snapshot.structure) ?? 'unconfigured';
  const throughWeek = weekStartDateKey(latestEnd);
  const [events, weather, currentGoals, previousGoals] = await Promise.all([
    listIrrigationHistoryForUser(ownerUserId, {
      season: null,
      startAt: observed.startAt,
      endAtExclusive: observed.endAtExclusive,
      scope: { level: 'farm', zoneId: null, plotId: null, bedId: null },
    }),
    listWeatherDailyValuesForUser(ownerUserId, locationKey, startDate, today),
    listHydricGoalRevisionsThroughWeekForUser(ownerUserId, season, throughWeek),
    listHydricGoalRevisionsThroughWeekForUser(ownerUserId, season - 1, throughWeek),
  ]);
  return [events, weather, [...previousGoals, ...currentGoals]] as const;
}

function seriesWarnings(report: SeriesWaterReport, readSummary: NonNullable<IrrigationSnapshot['cropPlan']>['readSummary']): string[] {
  const warnings: string[] = [];
  const ignored = report.ignored.block + report.ignored.noImplantation;
  if (ignored > 0) {
    const parts = [
      report.ignored.noImplantation > 0 ? `${report.ignored.noImplantation} sans semis direct ni plantation` : null,
      report.ignored.block > 0 ? `${report.ignored.block} en bloc` : null,
    ].filter((part) => part !== null);
    warnings.push(`${ignored} série${ignored > 1 ? 's' : ''} d’Ouvre ta ferme non suivie${ignored > 1 ? 's' : ''} : ${parts.join(', ')}.`);
  }
  const placesIgnored = readSummary.placesWithoutSeries + readSummary.placesOfUnknownSeries + readSummary.placesWithUnknownBed;
  if (placesIgnored > 0) {
    warnings.push(`${placesIgnored} emplacement${placesIgnored > 1 ? 's' : ''} d’Ouvre ta ferme écarté${placesIgnored > 1 ? 's' : ''} : sans série, série hors saison ou planche absente du plan.`);
  }
  if (report.series.some((item) => !item.rainAvailability.complete)) {
    warnings.push('La pluie réelle manque sur une partie de la période d’au moins une série : son écart n’est pas calculé.');
  }
  if (report.series.some((item) => item.irrigationVolumeIncomplete)) {
    warnings.push('Au moins une irrigation a une surface mouillée inconnue : le volume de sa série est incomplet, ses millimètres restent exacts.');
  }
  return warnings;
}
