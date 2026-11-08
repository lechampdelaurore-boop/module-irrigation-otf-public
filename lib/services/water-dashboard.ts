import type { IrrigationEventRecord } from '@/lib/domain/irrigation-event-record';
import { logJsonLine } from '@/lib/adapters/log';
import { millimetersFromCubicMeters, millisecondsFromHours, millisecondsFromSeconds } from '@/lib/domain/units';
import {
  listDailyWaterLimitsForUser,
  ensureRecurringHydricGoalsForUser,
  listWeatherDailyValuesForUser,
  readWeatherGeocodeForUser,
  readWeatherPreferenceForUser,
  recordWeatherRefreshForUser,
  saveWeatherGeocodeForUser,
  tryClaimWeatherRefreshForUser,
  upsertWeatherDailyValuesForUser,
  type WeatherDailyRecord,
  type WeatherGeocodeRecord,
  type WeatherPreference,
} from '@/db/water-management-repository';
import { findWorkspaceIdForUser } from '@/db/workspace-repository';
import { evaluateCropAlertsAfterForecastWrite } from './crop-alerts-service';
import { evaluateWeatherAlertsAfterForecastWrite } from './weather-alerts-service';
import { readCropAlertsView, type CropAlertsView } from './crop-alerts-view';
import { readWeatherAlertsView, type WeatherAlertsView } from './weather-alerts-view';
import type { IrrigationSnapshot } from '../domain/domain';
import {
  FARM_TIME_ZONE,
  buildDailyWaterLedger,
  dateKeyInTimeZone,
  latestApplicableLimit,
  weekDateKeys,
  weekStartDateKey,
  type DailyWaterLimit,
  type HydricGoal,
  type WaterDashboardDay,
} from '../domain/water-management';
import { listCountedIrrigationEventsForUser } from './counted-irrigation-events';
import { getConfiguredWeatherProvider, weatherAttribution } from './weather/configured-provider';
import { WeatherProviderError, type WeatherProvider } from '../domain/weather/weather-provider';
import { oldestWeatherReadingInUse, weatherRefreshRequired, weatherRequestRanges } from '../domain/weather/cache-policy';
import { weatherLocationKey } from '../domain/weather/location';
import { weatherGeocodingRequired } from '../domain/weather/refresh-control';
import {
  fetchWeatherForLocation,
  weatherOutcomeError,
  weatherOutcomeNotBeforeAt,
  weatherOutcomeSucceeded,
} from './weather/sync-engine';

const WEATHER_REFRESH_INTERVAL_MS = millisecondsFromHours(3);
const WEATHER_STALE_AFTER_MS = millisecondsFromHours(6);
const WEATHER_MANUAL_COOLDOWN_MS = 30_000;

export type WaterDashboard = {
  season: number;
  weekStart: string;
  weekEnd: string;
  timeZone: string;
  goals: HydricGoal[];
  limits: DailyWaterLimit[];
  days: WaterDashboardDay[];
  todayWater: WaterDashboardDay;
  totals: {
    realizedIrrigationCubicMeters: number;
    realizedIrrigationMm: number;
    plannedIrrigationCubicMeters: number;
    actualRainMm: number | null;
    remainingForecastRainMm: number | null;
    et0Mm: number | null;
    et0ForecastMm: number | null;
    et0ReanalysisMm: number | null;
  };
  weather: {
    preference: WeatherPreference;
    location: WeatherGeocodeRecord | null;
    requestedLocationLabel: string | null;
    locationKey: string | null;
    refreshedAt: string | null;
    stale: boolean;
    error: string | null;
    refreshAttempted: boolean;
    nextRefreshAllowedAt: string | null;
    attribution: string;
  };
  /** L'encart « Alertes météo » (5 bis), lu seulement par l'écran de la météo. */
  weatherAlerts: WeatherAlertsView | null;
  /** L'encart « Alertes cultures » (5 quinquies), lu avec celui des alertes météo. */
  cropAlerts: CropAlertsView | null;
};

export async function getWaterDashboardForUser({
  ownerUserId,
  season,
  weekStart,
  snapshot,
  forceWeatherRefresh = false,
  allowWeatherRefresh = true,
  includeWeatherAlerts = false,
  now = new Date(),
  provider = getConfiguredWeatherProvider(),
  preloadedEvents,
}: {
  ownerUserId: string;
  season: number;
  weekStart?: string | null;
  snapshot: IrrigationSnapshot;
  forceWeatherRefresh?: boolean;
  allowWeatherRefresh?: boolean;
  includeWeatherAlerts?: boolean;
  now?: Date;
  provider?: WeatherProvider;
  preloadedEvents?: IrrigationEventRecord[] | Promise<IrrigationEventRecord[]>;
}): Promise<WaterDashboard> {
  const preference = await readWeatherPreferenceForUser(ownerUserId);
  const requestedWeek = weekStartDateKey(weekStart ?? now, FARM_TIME_ZONE);
  const dates = weekDateKeys(requestedWeek);
  const locationKey = weatherLocationKey(preference, snapshot.structure);
  const requestedLocationLabel = weatherLocationLabel(preference, snapshot.structure);
  let location = locationKey
    ? await readWeatherGeocodeForUser(ownerUserId, locationKey)
    : null;

  const cachedWeatherBeforeRefresh = locationKey
    ? await listWeatherDailyValuesForUser(ownerUserId, locationKey, dates[0], dates[6])
    : [];
  const hasCachedWeather = cachedWeatherBeforeRefresh.some(
    (row) => row.dataKind !== 'manual_precipitation',
  );
  const refreshWanted = allowWeatherRefresh && Boolean(locationKey) && shouldRefreshWeather(
    preference,
    requestedWeek,
    now,
    forceWeatherRefresh,
    hasCachedWeather,
  );
  const query = preference.locationMode === 'custom'
    ? preference.customCity
    : snapshot.structure.legalCity;
  const postcode = preference.locationMode === 'custom'
    ? preference.customPostcode
    : snapshot.structure.legalPostcode;
  let weatherRefreshAttempted = false;
  const refreshClaimed = refreshWanted && (location !== null || Boolean(query))
    ? await tryClaimWeatherRefreshForUser(ownerUserId, now.toISOString(), WEATHER_MANUAL_COOLDOWN_MS)
    : false;

  if (refreshClaimed) {
    weatherRefreshAttempted = true;
  }
  if (refreshClaimed && weatherGeocodingRequired(location !== null) && locationKey && query) {
    try {
      const candidate = (await provider.searchLocations(query, postcode))[0];
      if (candidate) {
        location = await saveWeatherGeocodeForUser(
          ownerUserId,
          locationKey,
          candidate,
          provider.sourceId?.('geocoding') ?? provider.id,
        );
      } else {
        await recordWeatherRefreshForUser(ownerUserId, {
          successful: false,
          at: now.toISOString(),
          error: 'Aucune commune ne correspond au nom et au code postal renseignés.',
        });
      }
    } catch (error) {
      await recordWeatherRefreshForUser(ownerUserId, weatherFailureResult(error, now));
    }
  }

  if (refreshClaimed && location) {
    await refreshWeather({
      ownerUserId,
      location,
      weekStart: requestedWeek,
      now,
      provider,
      bypassCache: forceWeatherRefresh,
    });
  }

  const refreshedPreference = await readWeatherPreferenceForUser(ownerUserId);
  const alertsWorkspaceId = includeWeatherAlerts ? findWorkspaceIdForUser(ownerUserId) : null;
  const [goals, limits, weatherRows, allEvents, weatherAlerts, cropAlerts] = await Promise.all([
    ensureRecurringHydricGoalsForUser(ownerUserId, season, requestedWeek),
    listDailyWaterLimitsForUser(ownerUserId),
    listWeatherDailyValuesForUser(ownerUserId, locationKey ?? 'unconfigured', dates[0], dates[6]),
    preloadedEvents ?? listCountedIrrigationEventsForUser(ownerUserId, undefined, true),
    alertsWorkspaceId?.then((workspaceId) => readWeatherAlertsView({ workspaceId, locationKey, now })) ?? null,
    alertsWorkspaceId?.then((workspaceId) => readCropAlertsView({ ownerUserId, workspaceId, locationKey, snapshot, season, now })) ?? null,
  ]);
  const ledger = buildDailyWaterLedger(allEvents.filter((event) => event.season === season), now, FARM_TIME_ZONE);
  const ledgerByDate = new Map(ledger.map((row) => [row.date, row]));
  const allLedgerByDate = new Map(buildDailyWaterLedger(allEvents, now, FARM_TIME_ZONE).map((row) => [row.date, row]));
  const weatherByDate = groupWeatherByDate(weatherRows);
  const today = dateKeyInTimeZone(now, FARM_TIME_ZONE);
  const makeDay = (date: string, allSeasons = false): WaterDashboardDay => {
    const weather = weatherByDate.get(date);
    const reanalysisRainMm = weather?.reanalysis?.precipitationMm ?? null;
    const manualRainMm = weather?.manual_precipitation?.precipitationMm ?? null;
    const forecastRainMm = weather?.forecast?.precipitationMm ?? null;
    const et0Mm = weather?.reanalysis?.et0Mm ?? weather?.forecast?.et0Mm ?? null;
    const water = allSeasons ? allLedgerByDate.get(date) : ledgerByDate.get(date);
    const regulatoryWater = allLedgerByDate.get(date);
    const limit = latestApplicableLimit(limits, date);
    const committed =
      (regulatoryWater?.realizedCubicMeters ?? 0) + (regulatoryWater?.plannedCubicMeters ?? 0) + (regulatoryWater?.estimatedOngoingCubicMeters ?? 0);
    const limitAmount = limit?.enabled ? limit.maxCubicMetersPerDay : null;
    return {
      date,
      volumeIncomplete: water?.volumeIncomplete === true,
      realizedIrrigationCubicMeters: water?.realizedCubicMeters ?? 0,
      plannedIrrigationCubicMeters: water?.plannedCubicMeters ?? 0,
      estimatedOngoingCubicMeters: water?.estimatedOngoingCubicMeters ?? 0,
      reanalysisRainMm,
      manualRainMm,
      effectiveActualRainMm: manualRainMm ?? reanalysisRainMm,
      forecastRainMm,
      forecastMinimumTemperatureCelsius: weather?.forecast?.minimumTemperatureCelsius ?? null,
      forecastMaximumTemperatureCelsius: weather?.forecast?.maximumTemperatureCelsius ?? null,
      et0Mm,
      et0Kind: weather?.reanalysis?.et0Mm !== null && weather?.reanalysis?.et0Mm !== undefined
        ? 'reanalysis'
        : weather?.forecast?.et0Mm !== null && weather?.forecast?.et0Mm !== undefined ? 'forecast' : null,
      limitCubicMeters: limitAmount,
      actualLimitExceededByCubicMeters: limitAmount === null ? 0 : Math.max(0, (regulatoryWater?.realizedCubicMeters ?? 0) - limitAmount),
      limitExceededByCubicMeters: limitAmount === null
        ? 0
        : Math.max(0, committed - limitAmount),
    };
  };
  const days = dates.map((date) => makeDay(date));
  const realizedIrrigationCubicMeters = sum(days, 'realizedIrrigationCubicMeters');
  const seasonBedAreaSquareMeters = snapshot.beds
    .filter((bed) => bed.seasons.includes(season))
    .reduce((total, bed) => total + Math.max(0, bed.area), 0);
  const remoteRows = weatherRows.filter((row) => row.dataKind !== 'manual_precipitation');
  const oldestReading = oldestWeatherReadingInUse(remoteRows, today);

  return {
    season,
    weekStart: dates[0],
    weekEnd: dates[6],
    timeZone: FARM_TIME_ZONE,
    goals,
    limits,
    days,
    todayWater: makeDay(today, true),
    totals: {
      realizedIrrigationCubicMeters,
      realizedIrrigationMm: seasonBedAreaSquareMeters > 0
        ? millimetersFromCubicMeters(realizedIrrigationCubicMeters, seasonBedAreaSquareMeters)
        : 0,
      plannedIrrigationCubicMeters: sum(days, 'plannedIrrigationCubicMeters'),
      actualRainMm: sumNullable(days.map((day) => day.effectiveActualRainMm)),
      remainingForecastRainMm: sumNullable(days
        .filter((day) => day.date >= today)
        .map((day) => day.forecastRainMm)),
      et0Mm: sumNullable(days.map((day) => day.et0Mm)),
      et0ForecastMm: sumNullable(days.filter((day) => day.et0Kind === 'forecast').map((day) => day.et0Mm)),
      et0ReanalysisMm: sumNullable(days.filter((day) => day.et0Kind === 'reanalysis').map((day) => day.et0Mm)),
    },
    weather: {
      preference: refreshedPreference,
      location,
      requestedLocationLabel,
      locationKey,
      refreshedAt: oldestReading,
      stale: isWeatherStale(oldestReading, now),
      error: refreshedPreference.lastRefreshError ?? (
        !locationKey
          ? "La commune du siège OTF n'est pas renseignée. Choisissez une commune manuellement."
          : location
            ? remoteRows.length === 0 ? 'Aucune donnée météo disponible pour cette semaine.' : null
            : 'La commune de référence n’a pas pu être localisée.'
      ),
      refreshAttempted: weatherRefreshAttempted,
      nextRefreshAllowedAt: nextWeatherRefreshAllowedAt(refreshedPreference),
      attribution: weatherAttribution(provider),
    },
    weatherAlerts,
    cropAlerts,
  };
}

function weatherLocationLabel(
  preference: WeatherPreference,
  structure: IrrigationSnapshot['structure'],
) {
  const city = preference.locationMode === 'custom'
    ? preference.customCity
    : structure.legalCity;
  const postcode = preference.locationMode === 'custom'
    ? preference.customPostcode
    : structure.legalPostcode;
  return city ? [city, postcode].filter(Boolean).join(' · ') : null;
}

async function refreshWeather({
  ownerUserId,
  location,
  weekStart,
  now,
  provider,
  bypassCache,
}: {
  ownerUserId: string;
  location: WeatherGeocodeRecord;
  weekStart: string;
  now: Date;
  provider: WeatherProvider;
  bypassCache: boolean;
}) {
  const at = now.toISOString();
  const today = dateKeyInTimeZone(now, location.timezone);
  const ranges = weatherRequestRanges({ weekStart, today });
  logJsonLine('info', {
    event: 'weather_refresh_started',
    provider: provider.id,
    weekStart,
    today,
    forecastRange: ranges.forecast,
    reanalysisRange: ranges.reanalysis,
    bypassCache,
    requestedAt: at,
  });
  try {
    const outcome = await fetchWeatherForLocation({
      location,
      ranges,
      provider,
      bypassCache,
      log: logJsonLine,
    });
    await Promise.all([
      upsertWeatherDailyValuesForUser(
        ownerUserId,
        location.locationKey,
        'forecast',
        outcome.forecast.status === 'fulfilled' ? outcome.forecast.values : [],
        provider.sourceId?.('forecast') ?? provider.id,
        at,
      ),
      upsertWeatherDailyValuesForUser(
        ownerUserId,
        location.locationKey,
        'reanalysis',
        outcome.reanalysis.status === 'fulfilled' ? outcome.reanalysis.values : [],
        provider.sourceId?.('reanalysis') ?? provider.id,
        at,
      ),
    ]);
    if (outcome.forecast.status === 'fulfilled' && outcome.forecast.values.length > 0) {
      // Les alertes météo après chaque écriture de prévisions (docs/weather-alerts-contract.md).
      const workspaceId = await findWorkspaceIdForUser(ownerUserId);
      if (workspaceId) {
        await evaluateWeatherAlertsAfterForecastWrite({ workspaceId, locationKey: location.locationKey, now });
        // Puis le gel par culture et les aspersions (docs/weather-crop-alerts-contract.md).
        await evaluateCropAlertsAfterForecastWrite({ workspaceId, locationKey: location.locationKey, now });
      }
    }
    const successful = weatherOutcomeSucceeded(outcome);
    logJsonLine(successful ? 'info' : 'warn', {
      event: 'weather_refresh_completed',
      provider: provider.id,
      forecastValues: outcome.forecast.status === 'fulfilled' ? outcome.forecast.values.length : 0,
      reanalysisValues: outcome.reanalysis.status === 'fulfilled' ? outcome.reanalysis.values.length : 0,
      failedEndpoints: [
        outcome.forecast.status === 'rejected' ? 'forecast' : null,
        outcome.reanalysis.status === 'rejected' ? 'reanalysis' : null,
      ].filter(Boolean),
      completedAt: new Date().toISOString(),
    });
    await recordWeatherRefreshForUser(
      ownerUserId,
      successful
        ? { successful: true, at }
        : {
            successful: false,
            at,
            error: weatherOutcomeError(outcome) ?? 'Actualisation météo partielle.',
            notBeforeAt: weatherOutcomeNotBeforeAt(outcome, now),
          },
    );
  } catch (error) {
    logJsonLine('warn', {
      event: 'weather_refresh_persistence_failed',
      provider: provider.id,
      error: error instanceof Error ? error.message : 'unknown',
      failedAt: new Date().toISOString(),
    });
    await recordWeatherRefreshForUser(ownerUserId, weatherFailureResult(error, now));
  }
}


function shouldRefreshWeather(
  preference: WeatherPreference,
  weekStart: string,
  now: Date,
  force: boolean,
  hasCachedValues: boolean,
) {
  const currentWeek = weekStartDateKey(now, FARM_TIME_ZONE);
  return weatherRefreshRequired({
    force,
    selectedWeek: weekStart,
    currentWeek,
    hasCachedValues,
    lastSuccessfulRefreshAt: preference.lastSuccessfulRefreshAt,
    lastRefreshAttemptAt: preference.lastRefreshAttemptAt,
    refreshNotBeforeAt: preference.refreshNotBeforeAt,
    now,
    refreshIntervalMs: WEATHER_REFRESH_INTERVAL_MS,
  });
}

function weatherFailureResult(error: unknown, now: Date, fallback = 'Actualisation météo impossible.') {
  const retryAfterSeconds = error instanceof WeatherProviderError && error.kind === 'rate-limit'
    ? Math.max(30, error.retryAfterSeconds ?? 60)
    : null;
  return {
    successful: false as const,
    at: now.toISOString(),
    error: error instanceof Error ? error.message : fallback,
    notBeforeAt: retryAfterSeconds === null
      ? null
      : new Date(now.getTime() + millisecondsFromSeconds(retryAfterSeconds)).toISOString(),
  };
}

function nextWeatherRefreshAllowedAt(preference: WeatherPreference) {
  const candidates = [
    preference.lastRefreshAttemptAt
      ? Date.parse(preference.lastRefreshAttemptAt) + WEATHER_MANUAL_COOLDOWN_MS
      : Number.NaN,
    preference.refreshNotBeforeAt ? Date.parse(preference.refreshNotBeforeAt) : Number.NaN,
  ].filter(Number.isFinite);
  return candidates.length > 0 ? new Date(Math.max(...candidates)).toISOString() : null;
}

function isWeatherStale(refreshedAt: string | null, now: Date) {
  const last = refreshedAt
    ? Date.parse(refreshedAt)
    : Number.NaN;
  return !Number.isFinite(last) || now.getTime() - last >= WEATHER_STALE_AFTER_MS;
}

function groupWeatherByDate(rows: readonly WeatherDailyRecord[]) {
  const result = new Map<string, Partial<Record<WeatherDailyRecord['dataKind'], WeatherDailyRecord>>>();
  for (const row of rows) {
    const current = result.get(row.date) ?? {};
    current[row.dataKind] = row;
    result.set(row.date, current);
  }
  return result;
}

function sum(days: readonly WaterDashboardDay[], key: 'realizedIrrigationCubicMeters' | 'plannedIrrigationCubicMeters') {
  return days.reduce((total, day) => total + day[key], 0);
}

function sumNullable(values: readonly (number | null)[]) {
  const available = values.filter((value): value is number => value !== null);
  return available.length > 0
    ? available.reduce((total, value) => total + value, 0)
    : null;
}
