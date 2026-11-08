import { db } from './binding';
import type { HydricGoal, HydricGoalScope, DailyWaterLimit } from '@/lib/domain/water-management';
import { hasWeatherValue, type WeatherDailyValue, type WeatherLocationCandidate } from '@/lib/domain/weather/weather-provider';
import { weatherRefreshClaimed } from '@/lib/domain/weather/cache-policy';
import { ensureWorkspaceForUser, findWorkspaceIdForUser, waterBudgetRevisionStatement } from './workspace-repository';
import { aEcritUneLigne } from './write-result';

type WeatherLocationMode = 'otf' | 'custom';

export type WeatherPreference = {
  locationMode: WeatherLocationMode;
  customCity: string | null;
  customPostcode: string | null;
  lastRefreshAttemptAt: string | null;
  lastSuccessfulRefreshAt: string | null;
  lastRefreshError: string | null;
  refreshNotBeforeAt: string | null;
  lastAutomaticRefreshAttemptAt: string | null;
  lastAutomaticRefreshSuccessAt: string | null;
  lastAutomaticRefreshError: string | null;
};

export type WeatherGeocodeRecord = WeatherLocationCandidate & {
  locationKey: string;
  source: string;
  resolvedAt: string;
};

export type WeatherDailyKind = 'forecast' | 'reanalysis' | 'manual_precipitation';

export type WeatherDailyRecord = WeatherDailyValue & {
  locationKey: string;
  dataKind: WeatherDailyKind;
  source: string;
  fetchedAt: string;
};

export type HydricGoalRevision = {
  id: string;
  season: number;
  weekStart: string;
  scopeType: HydricGoalScope;
  otfZoneId: string | null;
  otfPlotId: string | null;
  otfBedId: string | null;
  amountMm: number | null;
  action: 'set' | 'cleared';
  createdAt: string;
  copiedFromGoalId: string | null;
};

type GoalRow = {
  id: string;
  season: number;
  week_start: string;
  scope_type: HydricGoalScope;
  otf_zone_id: string | null;
  otf_plot_id: string | null;
  otf_bed_id: string | null;
  amount_mm: number | null;
  action: 'set' | 'cleared';
  created_at: string;
  copied_from_goal_id: string | null;
};

export async function listHydricGoalsForUser(
  ownerUserId: string,
  season: number,
  weekStart: string,
): Promise<HydricGoal[]> {
  const workspaceId = await findWorkspaceIdForUser(ownerUserId);
  if (!workspaceId) return [];
  // Départage par rowid, l'ordre d'insertion : l'identifiant est tiré au sort (docs/revision-order-contract.md).
  const result = await db.prepare(
    `SELECT id, season, week_start, scope_type, otf_zone_id, otf_plot_id,
            otf_bed_id, amount_mm, action, created_at, copied_from_goal_id
     FROM irrigation_hydric_goal_revisions
     WHERE workspace_id = ? AND season = ? AND week_start = ?
     ORDER BY created_at DESC, rowid DESC`,
  ).bind(workspaceId, season, weekStart).all<GoalRow>();
  const current = new Map<string, GoalRow>();
  for (const row of result.results) {
    const key = goalScopeKey(row);
    if (!current.has(key)) current.set(key, row);
  }
  return [...current.values()]
    .filter((row) => row.action === 'set' && row.amount_mm !== null)
    .map((row) => ({
      id: row.id,
      season: Number(row.season),
      weekStart: row.week_start,
      scopeType: row.scope_type,
      otfZoneId: row.otf_zone_id,
      otfPlotId: row.otf_plot_id,
      otfBedId: row.otf_bed_id,
      amountMm: Number(row.amount_mm),
      createdAt: row.created_at,
    }));
}

export async function listHydricGoalRevisionsThroughWeekForUser(
  ownerUserId: string,
  season: number,
  throughWeekStart: string,
): Promise<HydricGoalRevision[]> {
  const workspaceId = await findWorkspaceIdForUser(ownerUserId);
  if (!workspaceId) return [];
  const result = await db.prepare(
    `SELECT id, season, week_start, scope_type, otf_zone_id, otf_plot_id,
            otf_bed_id, amount_mm, action, created_at, copied_from_goal_id
     FROM irrigation_hydric_goal_revisions
     WHERE workspace_id = ? AND season = ? AND week_start <= ?
     ORDER BY week_start, created_at, rowid`,
  ).bind(workspaceId, season, throughWeekStart).all<GoalRow>();
  return result.results.map((row) => ({
    id: row.id,
    season: Number(row.season),
    weekStart: row.week_start,
    scopeType: row.scope_type,
    otfZoneId: row.otf_zone_id,
    otfPlotId: row.otf_plot_id,
    otfBedId: row.otf_bed_id,
    amountMm: row.amount_mm === null ? null : Number(row.amount_mm),
    action: row.action,
    createdAt: row.created_at,
    copiedFromGoalId: row.copied_from_goal_id,
  }));
}

export async function ensureRecurringHydricGoalsForUser(
  ownerUserId: string,
  season: number,
  weekStart: string,
): Promise<HydricGoal[]> {
  const workspaceId = await findWorkspaceIdForUser(ownerUserId);
  if (!workspaceId) return [];
  const existingRevision = await db.prepare(
    `SELECT 1 AS present FROM irrigation_hydric_goal_revisions
     WHERE workspace_id = ? AND season = ? AND week_start = ? LIMIT 1`,
  ).bind(workspaceId, season, weekStart).first<{ present: number }>();
  if (existingRevision) return listHydricGoalsForUser(ownerUserId, season, weekStart);

  const sourceWeek = await db.prepare(
    `SELECT MAX(week_start) AS week_start
     FROM irrigation_hydric_goal_revisions
     WHERE workspace_id = ? AND season = ? AND week_start < ?`,
  ).bind(workspaceId, season, weekStart).first<{ week_start: string | null }>();
  if (!sourceWeek?.week_start) return [];
  const sourceGoals = await listHydricGoalsForUser(ownerUserId, season, sourceWeek.week_start);
  if (sourceGoals.length === 0) return [];
  await db.batch(sourceGoals.map((goal) => db.prepare(
    `INSERT INTO irrigation_hydric_goal_revisions
       (id, workspace_id, season, week_start, scope_type, otf_zone_id,
        otf_plot_id, otf_bed_id, amount_mm, action, copied_from_goal_id,
        actor_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'set', ?, ?)`,
  ).bind(
    revisionId(), workspaceId, season, weekStart, goal.scopeType,
    goal.otfZoneId, goal.otfPlotId, goal.otfBedId, goal.amountMm,
    goal.id, ownerUserId,
  )));
  return listHydricGoalsForUser(ownerUserId, season, weekStart);
}

export async function saveHydricGoalForUser(
  ownerUserId: string,
  goal: Omit<HydricGoal, 'id' | 'createdAt'>,
): Promise<void> {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  await db.prepare(
    `INSERT INTO irrigation_hydric_goal_revisions
       (id, workspace_id, season, week_start, scope_type, otf_zone_id,
        otf_plot_id, otf_bed_id, amount_mm, action, actor_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'set', ?)`,
  ).bind(
    revisionId(), workspaceId, goal.season, goal.weekStart,
    goal.scopeType, goal.otfZoneId, goal.otfPlotId, goal.otfBedId,
    goal.amountMm, ownerUserId,
  ).run();
}

export async function clearHydricGoalsForUser(
  ownerUserId: string,
  season: number,
  weekStart: string,
): Promise<number> {
  const workspaceId = await findWorkspaceIdForUser(ownerUserId);
  if (!workspaceId) return 0;
  const goals = await listHydricGoalsForUser(ownerUserId, season, weekStart);
  if (goals.length === 0) return 0;
  await db.batch(goals.map((goal) => db.prepare(
    `INSERT INTO irrigation_hydric_goal_revisions
       (id, workspace_id, season, week_start, scope_type, otf_zone_id,
        otf_plot_id, otf_bed_id, amount_mm, action, actor_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 'cleared', ?)`,
  ).bind(
    revisionId(), workspaceId, season, weekStart, goal.scopeType,
    goal.otfZoneId, goal.otfPlotId, goal.otfBedId, ownerUserId,
  )));
  return goals.length;
}

export async function readWeatherPreferenceForUser(
  ownerUserId: string,
): Promise<WeatherPreference> {
  const workspaceId = await findWorkspaceIdForUser(ownerUserId);
  if (!workspaceId) return defaultWeatherPreference();
  const row = await db.prepare(
    `SELECT location_mode, custom_city, custom_postcode, last_refresh_attempt_at,
            last_successful_refresh_at, last_refresh_error, refresh_not_before_at,
            last_automatic_refresh_attempt_at, last_automatic_refresh_success_at,
            last_automatic_refresh_error
     FROM irrigation_weather_preferences WHERE workspace_id = ?`,
  ).bind(workspaceId).first<{
    location_mode: WeatherLocationMode;
    custom_city: string | null;
    custom_postcode: string | null;
    last_refresh_attempt_at: string | null;
    last_successful_refresh_at: string | null;
    last_refresh_error: string | null;
    refresh_not_before_at: string | null;
    last_automatic_refresh_attempt_at: string | null;
    last_automatic_refresh_success_at: string | null;
    last_automatic_refresh_error: string | null;
  }>();
  return row ? {
    locationMode: row.location_mode,
    customCity: row.custom_city,
    customPostcode: row.custom_postcode,
    lastRefreshAttemptAt: row.last_refresh_attempt_at,
    lastSuccessfulRefreshAt: row.last_successful_refresh_at,
    lastRefreshError: row.last_refresh_error,
    refreshNotBeforeAt: row.refresh_not_before_at,
    lastAutomaticRefreshAttemptAt: row.last_automatic_refresh_attempt_at,
    lastAutomaticRefreshSuccessAt: row.last_automatic_refresh_success_at,
    lastAutomaticRefreshError: row.last_automatic_refresh_error,
  } : defaultWeatherPreference();
}

export async function saveWeatherPreferenceForUser(
  ownerUserId: string,
  preference: Pick<WeatherPreference, 'locationMode' | 'customCity' | 'customPostcode'>,
): Promise<void> {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO irrigation_weather_preferences
       (workspace_id, location_mode, custom_city, custom_postcode, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(workspace_id) DO UPDATE SET
       location_mode = excluded.location_mode,
       custom_city = excluded.custom_city,
       custom_postcode = excluded.custom_postcode,
       last_refresh_attempt_at = NULL,
       last_refresh_error = NULL,
       refresh_not_before_at = NULL,
       updated_at = excluded.updated_at`,
  ).bind(
    workspaceId,
    preference.locationMode,
    preference.locationMode === 'custom' ? preference.customCity : null,
    preference.locationMode === 'custom' ? preference.customPostcode : null,
    now,
  ).run();
}

export async function recordWeatherRefreshForUser(
  ownerUserId: string,
  result: {
    successful: boolean;
    at: string;
    error?: string | null;
    notBeforeAt?: string | null;
  },
): Promise<void> {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  await db.prepare(
    `INSERT INTO irrigation_weather_preferences
       (workspace_id, location_mode, last_refresh_attempt_at,
        last_successful_refresh_at, last_refresh_error,
        refresh_not_before_at, updated_at)
     VALUES (?, 'otf', ?, ?, ?, ?, ?)
     ON CONFLICT(workspace_id) DO UPDATE SET
       last_refresh_attempt_at = excluded.last_refresh_attempt_at,
       last_successful_refresh_at = CASE
         WHEN ? = 1 THEN excluded.last_successful_refresh_at
         ELSE irrigation_weather_preferences.last_successful_refresh_at END,
       last_refresh_error = excluded.last_refresh_error,
       refresh_not_before_at = excluded.refresh_not_before_at,
       updated_at = excluded.updated_at`,
  ).bind(
    workspaceId,
    result.at,
    result.successful ? result.at : null,
    result.successful ? null : result.error ?? 'Actualisation météo impossible.',
    result.successful ? null : result.notBeforeAt ?? null,
    result.at,
    result.successful ? 1 : 0,
  ).run();
}

export async function tryClaimWeatherRefreshForUser(
  ownerUserId: string,
  attemptedAt: string,
  minimumIntervalMs = 30_000,
): Promise<boolean> {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const cutoff = new Date(Date.parse(attemptedAt) - minimumIntervalMs).toISOString();
  await db.prepare(
    `INSERT OR IGNORE INTO irrigation_weather_preferences
       (workspace_id, location_mode, updated_at)
     VALUES (?, 'otf', ?)`,
  ).bind(workspaceId, attemptedAt).run();
  const result = await db.prepare(
    `UPDATE irrigation_weather_preferences
     SET last_refresh_attempt_at = ?, updated_at = ?
     WHERE workspace_id = ?
       AND (refresh_not_before_at IS NULL OR refresh_not_before_at <= ?)
       AND (last_refresh_attempt_at IS NULL OR last_refresh_attempt_at <= ?)`,
  ).bind(attemptedAt, attemptedAt, workspaceId, attemptedAt, cutoff).run();
  return weatherRefreshClaimed(result.meta);
}

export async function readWeatherGeocodeForUser(
  ownerUserId: string,
  locationKey: string,
): Promise<WeatherGeocodeRecord | null> {
  const workspaceId = await findWorkspaceIdForUser(ownerUserId);
  if (!workspaceId) return null;
  const row = await db.prepare(
    `SELECT location_key, display_name, city, postcode, latitude, longitude,
            timezone, source, resolved_at
     FROM irrigation_weather_geocodes
     WHERE workspace_id = ? AND location_key = ?`,
  ).bind(workspaceId, locationKey).first<{
    location_key: string;
    display_name: string;
    city: string;
    postcode: string | null;
    latitude: number;
    longitude: number;
    timezone: string;
    source: string;
    resolved_at: string;
  }>();
  return row ? {
    locationKey: row.location_key,
    displayName: row.display_name,
    city: row.city,
    postcode: row.postcode,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    timezone: row.timezone,
    countryCode: 'FR',
    source: row.source,
    resolvedAt: row.resolved_at,
  } : null;
}

export async function saveWeatherGeocodeForUser(
  ownerUserId: string,
  locationKey: string,
  candidate: WeatherLocationCandidate,
  source: string,
): Promise<WeatherGeocodeRecord> {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const resolvedAt = new Date().toISOString();
  await db.prepare(
    `INSERT INTO irrigation_weather_geocodes
       (workspace_id, location_key, display_name, city, postcode, latitude,
        longitude, timezone, source, resolved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(workspace_id, location_key) DO UPDATE SET
       display_name = excluded.display_name, city = excluded.city,
       postcode = excluded.postcode, latitude = excluded.latitude,
       longitude = excluded.longitude, timezone = excluded.timezone,
       source = excluded.source, resolved_at = excluded.resolved_at`,
  ).bind(
    workspaceId, locationKey, candidate.displayName, candidate.city,
    candidate.postcode, candidate.latitude, candidate.longitude,
    candidate.timezone, source, resolvedAt,
  ).run();
  return { ...candidate, locationKey, source, resolvedAt };
}

export async function listWeatherDailyValuesForUser(
  ownerUserId: string,
  locationKey: string,
  startDate: string,
  endDate: string,
): Promise<WeatherDailyRecord[]> {
  const workspaceId = await findWorkspaceIdForUser(ownerUserId);
  if (!workspaceId) return [];
  const result = await db.prepare(
    `SELECT location_key, date, data_kind, precipitation_mm, et0_mm,
            minimum_temperature_celsius, maximum_temperature_celsius, source, fetched_at
     FROM irrigation_weather_daily_values
     WHERE workspace_id = ? AND (location_key = ? OR data_kind = 'manual_precipitation') AND date BETWEEN ? AND ?
     ORDER BY date, data_kind, fetched_at`,
  ).bind(workspaceId, locationKey, startDate, endDate).all<{
    location_key: string;
    date: string;
    data_kind: WeatherDailyKind;
    precipitation_mm: number | null;
    et0_mm: number | null;
    minimum_temperature_celsius: number | null;
    maximum_temperature_celsius: number | null;
    source: string;
    fetched_at: string;
  }>();
  return result.results.map((row) => ({
    locationKey: row.location_key,
    date: row.date,
    dataKind: row.data_kind,
    precipitationMm: row.precipitation_mm === null ? null : Number(row.precipitation_mm),
    et0Mm: row.et0_mm === null ? null : Number(row.et0_mm),
    minimumTemperatureCelsius: row.minimum_temperature_celsius === null ? null : Number(row.minimum_temperature_celsius),
    maximumTemperatureCelsius: row.maximum_temperature_celsius === null ? null : Number(row.maximum_temperature_celsius),
    source: row.source,
    fetchedAt: row.fetched_at,
  }));
}

export async function upsertWeatherDailyValuesForUser(
  ownerUserId: string,
  locationKey: string,
  kind: Exclude<WeatherDailyKind, 'manual_precipitation'>,
  values: readonly WeatherDailyValue[],
  source: string,
  fetchedAt: string,
): Promise<void> {
  const availableValues = values.filter(hasWeatherValue);
  if (availableValues.length === 0) return;
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  await db.batch(availableValues.map((value) => db.prepare(
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
       solar_energy_mj_per_square_meter = COALESCE(excluded.solar_energy_mj_per_square_meter, irrigation_weather_daily_values.solar_energy_mj_per_square_meter), source = excluded.source,
       fetched_at = CASE WHEN
         (excluded.precipitation_mm IS NULL AND irrigation_weather_daily_values.precipitation_mm IS NOT NULL)
         OR (excluded.et0_mm IS NULL AND irrigation_weather_daily_values.et0_mm IS NOT NULL)
         OR (excluded.minimum_temperature_celsius IS NULL AND irrigation_weather_daily_values.minimum_temperature_celsius IS NOT NULL)
         OR (excluded.maximum_temperature_celsius IS NULL AND irrigation_weather_daily_values.maximum_temperature_celsius IS NOT NULL)
         OR (excluded.solar_energy_mj_per_square_meter IS NULL AND irrigation_weather_daily_values.solar_energy_mj_per_square_meter IS NOT NULL)
         THEN irrigation_weather_daily_values.fetched_at ELSE excluded.fetched_at END,
       updated_at = excluded.updated_at`,
  ).bind(
    workspaceId, locationKey, value.date, kind, value.precipitationMm,
    value.et0Mm, value.minimumTemperatureCelsius ?? null, value.maximumTemperatureCelsius ?? null,
    value.solarEnergyMegajoulesPerSquareMeter ?? null, source, fetchedAt, fetchedAt,
  )));
}

export async function saveManualRainfallForUser(
  ownerUserId: string,
  date: string,
  precipitationMm: number,
): Promise<void> {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO irrigation_weather_daily_values
       (workspace_id, location_key, date, data_kind, precipitation_mm, et0_mm,
        source, fetched_at, updated_at)
     VALUES (?, ?, ?, 'manual_precipitation', ?, NULL, 'user', ?, ?)
     ON CONFLICT(workspace_id, location_key, date, data_kind) DO UPDATE SET
       precipitation_mm = excluded.precipitation_mm,
       source = 'user', fetched_at = excluded.fetched_at,
       updated_at = excluded.updated_at`,
  ).bind(workspaceId, 'farm:manual', date, precipitationMm, now, now).run();
}

/**
 * Retire la mesure du pluviomètre d'un jour — saisie par erreur, ou pour un
 * essai — : la réanalyse reprend pour ce jour. Rend `false` s'il n'y en avait
 * pas (recette réelle de la 3.7, 31 octobre 2026).
 */
export async function deleteManualRainfallForUser(ownerUserId: string, date: string): Promise<boolean> {
  const workspaceId = await findWorkspaceIdForUser(ownerUserId);
  if (!workspaceId) return false;
  const result = await db.prepare(
    `DELETE FROM irrigation_weather_daily_values
     WHERE workspace_id = ? AND location_key = 'farm:manual' AND date = ? AND data_kind = 'manual_precipitation'`,
  ).bind(workspaceId, date).run();
  return aEcritUneLigne(result.meta);
}

export async function listDailyWaterLimitsForUser(
  ownerUserId: string,
): Promise<DailyWaterLimit[]> {
  const workspaceId = await findWorkspaceIdForUser(ownerUserId);
  if (!workspaceId) return [];
  const result = await db.prepare(
    `SELECT id, season, enabled, max_cubic_meters_per_day, valid_from,
            valid_until, note, created_at
     FROM irrigation_daily_water_limit_revisions
     WHERE workspace_id = ?
     ORDER BY created_at DESC, rowid DESC`,
  ).bind(workspaceId).all<{
    id: string;
    season: number;
    enabled: number;
    max_cubic_meters_per_day: number | null;
    valid_from: string;
    valid_until: string | null;
    note: string | null;
    created_at: string;
  }>();
  return result.results.map((row) => ({
    id: row.id,
    season: Number(row.season),
    enabled: Boolean(row.enabled),
    maxCubicMetersPerDay: row.max_cubic_meters_per_day === null
      ? null
      : Number(row.max_cubic_meters_per_day),
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    note: row.note,
    createdAt: row.created_at,
  }));
}

export async function saveDailyWaterLimitForUser(
  ownerUserId: string,
  input: Omit<DailyWaterLimit, 'id' | 'createdAt'>,
): Promise<void> {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  await db.batch([waterBudgetRevisionStatement(ownerUserId), db.prepare(
    `INSERT INTO irrigation_daily_water_limit_revisions
       (id, workspace_id, season, enabled, max_cubic_meters_per_day,
        valid_from, valid_until, note, actor_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    revisionId(), workspaceId, input.season, input.enabled ? 1 : 0,
    input.enabled ? input.maxCubicMetersPerDay : null,
    input.validFrom, input.validUntil, input.note, ownerUserId,
  )]);
}

function goalScopeKey(goal: Pick<GoalRow, 'scope_type' | 'otf_zone_id' | 'otf_plot_id' | 'otf_bed_id'>) {
  return [goal.scope_type, goal.otf_zone_id, goal.otf_plot_id, goal.otf_bed_id].join(':');
}

function defaultWeatherPreference(): WeatherPreference {
  return {
    locationMode: 'otf',
    customCity: null,
    customPostcode: null,
    lastRefreshAttemptAt: null,
    lastSuccessfulRefreshAt: null,
    lastRefreshError: null,
    refreshNotBeforeAt: null,
    lastAutomaticRefreshAttemptAt: null,
    lastAutomaticRefreshSuccessAt: null,
    lastAutomaticRefreshError: null,
  };
}

function revisionId() {
  return `${String(Date.now()).padStart(13, '0')}-${crypto.randomUUID()}`;
}
