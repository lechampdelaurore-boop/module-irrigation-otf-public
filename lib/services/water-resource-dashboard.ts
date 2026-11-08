import { listCountedIrrigationEventsForUser } from './counted-irrigation-events';
import { getResourceFlowHistoryForUser, type ResourceFlowHistory } from './resource-flow-history';
import { millisecondsFromDays, millisecondsFromHours } from '@/lib/domain/units';
import { listWaterInfrastructureForUser } from '@/db/water-resource-repository';
import {
  listWeatherDailyValuesForUser,
  readWeatherPreferenceForUser,
} from '@/db/water-management-repository';
import type { IrrigationSnapshot } from '../domain/domain';
import {
  FARM_TIME_ZONE,
  dateKeyInTimeZone,
} from '../domain/water-management';
import {
  estimatedEvaporationCubicMeters,
  latestResourceLimit,
  projectWaterAvailability,
  type WaterAvailabilityProjection,
  type WaterInfrastructure,
} from '../domain/water-resources';
import { weatherLocationKey } from '../domain/weather/location';
import { plannedWaterForPeriod } from '../domain/planned-irrigation';

export type WaterResourceDashboard = {
  infrastructure: WaterInfrastructure;
  projection: WaterAvailabilityProjection;
  horizon: '24h' | '48h' | '7d' | 'custom';
  projectionEndsAt: string;
  timeZone: string;
  today: string;
  todayEstimatedEvaporationByReservoir: Record<string, number | null>;
  latestLimitByResource: Record<string, ReturnType<typeof latestResourceLimit>>;
  flowHistory: ResourceFlowHistory;
};

export async function getWaterResourceDashboardForUser({
  ownerUserId,
  season,
  snapshot,
  horizon = '24h',
  customEndsAt = null,
  now = new Date(),
}: {
  ownerUserId: string;
  season: number;
  snapshot: IrrigationSnapshot;
  horizon?: WaterResourceDashboard['horizon'];
  customEndsAt?: string | null;
  now?: Date;
}): Promise<WaterResourceDashboard> {
  const endsAt = projectionEnd(now, horizon, customEndsAt);
  const startDate = dateKeyInTimeZone(now, FARM_TIME_ZONE);
  const endDate = dateKeyInTimeZone(endsAt, FARM_TIME_ZONE);
  const [infrastructure, events, preference, flowHistory] = await Promise.all([
    listWaterInfrastructureForUser(ownerUserId),
    listCountedIrrigationEventsForUser(ownerUserId, season),
    readWeatherPreferenceForUser(ownerUserId),
    getResourceFlowHistoryForUser(ownerUserId),
  ]);
  const locationKey = weatherLocationKey(preference, snapshot.structure);
  const weatherRows = locationKey
    ? await listWeatherDailyValuesForUser(ownerUserId, locationKey, startDate, endDate)
    : [];
  const weather = Array.from(new Set(weatherRows.map((row) => row.date))).map((date) => {
    const rows = weatherRows.filter((row) => row.date === date);
    const forecast = rows.filter((row) => row.dataKind === 'forecast').at(-1);
    return {
      date,
      forecastRainMm: forecast?.precipitationMm ?? null,
      et0Mm: forecast?.et0Mm ?? null,
    };
  });
  const plannedWater = plannedWaterForPeriod(events, now, endsAt, FARM_TIME_ZONE);
  const projection = projectWaterAvailability({
    infrastructure,
    startsAt: now,
    endsAt,
    weather,
    plannedWater,
    timeZone: FARM_TIME_ZONE,
  });
  const todayWeather = weather.find((day) => day.date === startDate);
  const todayEstimatedEvaporationByReservoir = Object.fromEntries(
    infrastructure.reservoirs.map((reservoir) => [
      reservoir.id,
      reservoir.evaporationEnabled && todayWeather?.et0Mm !== null && todayWeather?.et0Mm !== undefined
        ? estimatedEvaporationCubicMeters(
            todayWeather.et0Mm,
            reservoir.exposedSurfaceSquareMeters,
            reservoir.evaporationCoefficient,
          )
        : reservoir.evaporationEnabled ? null : 0,
    ]),
  );
  const latestLimitByResource = Object.fromEntries(
    infrastructure.resources.map((resource) => [
      resource.id,
      latestResourceLimit(
        infrastructure.resourceLimits.filter((limit) => limit.resourceId === resource.id),
        startDate,
      ),
    ]),
  );
  return {
    infrastructure,
    projection,
    horizon,
    projectionEndsAt: endsAt.toISOString(),
    timeZone: FARM_TIME_ZONE,
    today: startDate,
    todayEstimatedEvaporationByReservoir,
    latestLimitByResource,
    flowHistory,
  };
}

function projectionEnd(
  now: Date,
  horizon: WaterResourceDashboard['horizon'],
  customEndsAt: string | null,
) {
  const milliseconds = horizon === '24h' ? millisecondsFromHours(24)
    : horizon === '48h' ? millisecondsFromHours(48)
      : horizon === '7d' ? millisecondsFromDays(7)
        : 0;
  if (horizon !== 'custom') return new Date(now.getTime() + milliseconds);
  const candidate = customEndsAt ? new Date(customEndsAt) : new Date(Number.NaN);
  if (!Number.isFinite(candidate.getTime()) || candidate <= now
    || candidate.getTime() > now.getTime() + millisecondsFromDays(366)) {
    throw new Error('La date de projection personnalisée doit être future et située dans moins d’un an.');
  }
  return candidate;
}
