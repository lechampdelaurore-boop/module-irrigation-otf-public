import { db } from './binding';
import { listFarmsWithSelection } from './feature-selection-repository';
import { usesWeather } from '@/lib/domain/features/socle';
import type {
  AutomaticWeatherSyncRepository,
  AutomaticWeatherTarget,
} from '@/lib/domain/weather/automatic-sync-contract';
import { customWeatherLocationKey } from '@/lib/domain/weather/location';
import { weatherRefreshClaimed } from '@/lib/domain/weather/cache-policy';
import { hasWeatherValue } from '@/lib/domain/weather/weather-provider';

const JOB_KEY = 'automatic-weather-sync';

type TargetRow = {
  workspace_id: string;
  location_mode: 'otf' | 'custom';
  custom_city: string | null;
  custom_postcode: string | null;
  refresh_not_before_at: string | null;
  location_key: string;
  latitude: number;
  longitude: number;
  timezone: string;
  resolved_at: string;
};

export const automaticWeatherRepository: AutomaticWeatherSyncRepository = {
  claimJob: tryClaimAutomaticWeatherSync,
  finishJob: finishAutomaticWeatherSync,
  listTargets: listAutomaticWeatherTargets,
  upsertValues: upsertAutomaticWeatherValues,
  recordWorkspaceResult: recordAutomaticWeatherWorkspaceResult,
};

/**
 * Les exploitations dont la météo se relève chaque matin : celles qui ont un
 * lieu résolu et cochent au moins une case qui lit la météo ; les autres ne
 * sont plus relevées (3.8, docs/feature-selection-contract.md, P4).
 */
export async function listAutomaticWeatherTargets(): Promise<AutomaticWeatherTarget[]> {
  const usingWeather = new Set((await listFarmsWithSelection(usesWeather)).map((farm) => farm.workspaceId));
  const result = await db.prepare(
    `SELECT p.workspace_id, p.location_mode, p.custom_city, p.custom_postcode,
            p.refresh_not_before_at, g.location_key, g.latitude, g.longitude,
            g.timezone, g.resolved_at
     FROM irrigation_weather_preferences p
     JOIN irrigation_weather_geocodes g ON g.workspace_id = p.workspace_id
     ORDER BY p.workspace_id, g.resolved_at DESC, g.location_key`,
  ).all<TargetRow>();
  const grouped = new Map<string, TargetRow[]>();
  for (const row of result.results) {
    if (!usingWeather.has(row.workspace_id)) continue;
    const rows = grouped.get(row.workspace_id) ?? [];
    rows.push(row);
    grouped.set(row.workspace_id, rows);
  }
  return [...grouped.values()].flatMap((rows): AutomaticWeatherTarget[] => {
    const preference = rows[0];
    const activeLocation = preference.location_mode === 'custom' && preference.custom_city
      ? rows.find((row) => row.location_key === customWeatherLocationKey(
          preference.custom_city ?? '',
          preference.custom_postcode,
        ))
      : rows.find((row) => row.location_key.startsWith('otf:'));
    if (!activeLocation) return [];
    return [{
      workspaceId: activeLocation.workspace_id,
      locationKey: activeLocation.location_key,
      latitude: Number(activeLocation.latitude),
      longitude: Number(activeLocation.longitude),
      timezone: activeLocation.timezone,
      refreshNotBeforeAt: activeLocation.refresh_not_before_at,
    }];
  });
}

export async function tryClaimAutomaticWeatherSync(
  attemptedAt: string,
  lockExpiresAt: string,
): Promise<string | null> {
  const token = crypto.randomUUID();
  await db.prepare(
    `INSERT OR IGNORE INTO irrigation_background_jobs
       (job_key, updated_at)
     VALUES (?, ?)`,
  ).bind(JOB_KEY, attemptedAt).run();
  const result = await db.prepare(
    `UPDATE irrigation_background_jobs
     SET lock_token = ?, lock_expires_at = ?, last_started_at = ?, updated_at = ?
     WHERE job_key = ?
       AND (lock_token IS NULL OR lock_expires_at IS NULL OR lock_expires_at <= ?)`,
  ).bind(token, lockExpiresAt, attemptedAt, attemptedAt, JOB_KEY, attemptedAt).run();
  return weatherRefreshClaimed(result.meta) ? token : null;
}

export async function finishAutomaticWeatherSync(input: {
  token: string;
  at: string;
  successful: boolean;
  error: string | null;
}): Promise<void> {
  await db.prepare(
    `UPDATE irrigation_background_jobs
     SET lock_token = NULL, lock_expires_at = NULL, last_completed_at = ?,
         last_successful_at = CASE WHEN ? = 1 THEN ? ELSE last_successful_at END,
         last_error = ?, updated_at = ?
     WHERE job_key = ? AND lock_token = ?`,
  ).bind(
    input.at,
    input.successful ? 1 : 0,
    input.at,
    input.successful ? null : input.error,
    input.at,
    JOB_KEY,
    input.token,
  ).run();
}

async function upsertAutomaticWeatherValues(
  input: Parameters<AutomaticWeatherSyncRepository['upsertValues']>[0],
): Promise<void> {
  const available = input.values.filter(hasWeatherValue);
  if (available.length === 0) return;
  await db.batch(available.map((value) => db.prepare(
    `INSERT INTO irrigation_weather_daily_values
       (workspace_id, location_key, date, data_kind, precipitation_mm, et0_mm,
        minimum_temperature_celsius, maximum_temperature_celsius, solar_energy_mj_per_square_meter,
        source, fetched_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(workspace_id, location_key, date, data_kind) DO UPDATE SET
       precipitation_mm = COALESCE(excluded.precipitation_mm, irrigation_weather_daily_values.precipitation_mm),
       et0_mm = COALESCE(excluded.et0_mm, irrigation_weather_daily_values.et0_mm),
       minimum_temperature_celsius = COALESCE(excluded.minimum_temperature_celsius, irrigation_weather_daily_values.minimum_temperature_celsius),
       maximum_temperature_celsius = COALESCE(excluded.maximum_temperature_celsius, irrigation_weather_daily_values.maximum_temperature_celsius),
       solar_energy_mj_per_square_meter = COALESCE(excluded.solar_energy_mj_per_square_meter, irrigation_weather_daily_values.solar_energy_mj_per_square_meter),
       source = excluded.source,
       fetched_at = CASE WHEN
         (excluded.precipitation_mm IS NULL AND irrigation_weather_daily_values.precipitation_mm IS NOT NULL)
         OR (excluded.et0_mm IS NULL AND irrigation_weather_daily_values.et0_mm IS NOT NULL)
         OR (excluded.minimum_temperature_celsius IS NULL AND irrigation_weather_daily_values.minimum_temperature_celsius IS NOT NULL)
         OR (excluded.maximum_temperature_celsius IS NULL AND irrigation_weather_daily_values.maximum_temperature_celsius IS NOT NULL)
         OR (excluded.solar_energy_mj_per_square_meter IS NULL AND irrigation_weather_daily_values.solar_energy_mj_per_square_meter IS NOT NULL)
         THEN irrigation_weather_daily_values.fetched_at ELSE excluded.fetched_at END,
       updated_at = excluded.updated_at`,
  ).bind(
    input.target.workspaceId,
    input.target.locationKey,
    value.date,
    input.kind,
    value.precipitationMm,
    value.et0Mm,
    value.minimumTemperatureCelsius ?? null,
    value.maximumTemperatureCelsius ?? null,
    value.solarEnergyMegajoulesPerSquareMeter ?? null,
    input.source,
    input.fetchedAt,
    input.fetchedAt,
  )));
}

async function recordAutomaticWeatherWorkspaceResult(
  input: Parameters<AutomaticWeatherSyncRepository['recordWorkspaceResult']>[0],
): Promise<void> {
  await db.prepare(
    `UPDATE irrigation_weather_preferences
     SET last_refresh_attempt_at = ?,
         last_successful_refresh_at = CASE WHEN ? = 1 THEN ? ELSE last_successful_refresh_at END,
         last_refresh_error = ?, refresh_not_before_at = ?,
         last_automatic_refresh_attempt_at = ?,
         last_automatic_refresh_success_at = CASE
           WHEN ? = 1 THEN ? ELSE last_automatic_refresh_success_at END,
         last_automatic_refresh_error = ?, updated_at = ?
     WHERE workspace_id = ?`,
  ).bind(
    input.at,
    input.successful ? 1 : 0,
    input.at,
    input.successful ? null : input.error,
    input.successful ? null : input.notBeforeAt,
    input.at,
    input.successful ? 1 : 0,
    input.at,
    input.successful ? null : input.error,
    input.at,
    input.workspaceId,
  ).run();
}
