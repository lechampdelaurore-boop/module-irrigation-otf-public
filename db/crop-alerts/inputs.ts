import { db } from '../binding';
import { ensureWorkspaceForUser } from '../workspace-repository';
import {
  DEFAULT_CROP_ALERT_SETTINGS,
  validateCropAlertSettings,
  validateDryingDays,
  validateFrostLink,
  type CropAlertSettings,
  type FrostLinkInput,
} from '@/lib/domain/crop-alerts/settings';
import type { CropAlertCommonEntry, DryingRevision, FrostLinkRevision } from '@/lib/domain/crop-alerts/thresholds';

/**
 * Les données des alertes par culture (docs/weather-crop-alerts-contract.md,
 * « Les données », migration 0026) : le jeu commun, les rattachements et
 * délais de la ferme, ses réglages, et les prévisions qu'on évalue. Chaque
 * saisie est une ligne nouvelle, jamais modifiée ni effacée (D-006) ; toutes
 * les lectures sont isolées par exploitation.
 */

export type CommonEntryRecord = CropAlertCommonEntry & { confidence: string; source: string; recordedOn: string };

/** Le jeu commun, dans l'ordre des noms. */
export async function listCropAlertCommon(): Promise<CommonEntryRecord[]> {
  const result = await db.prepare(
    `SELECT key, name, damage_celsius, drying_days, confidence, source, recorded_on FROM irrigation_crop_alert_common ORDER BY name`,
  ).all<{ key: string; name: string; damage_celsius: number | null; drying_days: number | null; confidence: string; source: string; recorded_on: string }>();
  return result.results.map((row) => ({
    key: row.key,
    name: row.name,
    damageCelsius: row.damage_celsius === null ? null : Number(row.damage_celsius),
    dryingDays: row.drying_days === null ? null : Number(row.drying_days),
    confidence: row.confidence,
    source: row.source,
    recordedOn: row.recorded_on,
  }));
}

/** Les rattachements de la ferme, toutes révisions, de la plus ancienne à la plus récente. */
export async function listFrostLinks(workspaceId: string): Promise<FrostLinkRevision[]> {
  const result = await db.prepare(
    `SELECT id, plant_id, series_id, common_key, damage_celsius, recorded_at FROM irrigation_crop_frost_links
     WHERE workspace_id = ? ORDER BY recorded_at, id`,
  ).bind(workspaceId).all<{ id: string; plant_id: string; series_id: string | null; common_key: string | null; damage_celsius: number | null; recorded_at: string }>();
  return result.results.map((row) => ({
    id: row.id,
    plantId: row.plant_id,
    seriesId: row.series_id,
    commonKey: row.common_key,
    damageCelsius: row.damage_celsius === null ? null : Number(row.damage_celsius),
    recordedAt: row.recorded_at,
  }));
}

/** Les délais de séchage corrigés par la ferme, toutes révisions. */
export async function listDryingRevisions(workspaceId: string): Promise<DryingRevision[]> {
  const result = await db.prepare(
    `SELECT id, plant_id, drying_days, recorded_at FROM irrigation_crop_drying_revisions
     WHERE workspace_id = ? ORDER BY recorded_at, id`,
  ).bind(workspaceId).all<{ id: string; plant_id: string; drying_days: number | null; recorded_at: string }>();
  return result.results.map((row) => ({
    id: row.id,
    plantId: row.plant_id,
    dryingDays: row.drying_days === null ? null : Number(row.drying_days),
    recordedAt: row.recorded_at,
  }));
}

/** Les réglages en vigueur de l'exploitation : la révision la plus récente, sinon ceux du contrat. */
export async function readCropAlertSettings(workspaceId: string): Promise<CropAlertSettings> {
  const row = await db.prepare(
    `SELECT frost_active, drying_active, sprinkler_active, horizon_days, frost_offset_celsius,
            frost_margin_sensitive_celsius, frost_margin_hardy_celsius,
            sprinkler_max_temperature_celsius, sprinkler_radiation_w_per_square_meter
     FROM irrigation_crop_alert_settings WHERE workspace_id = ? ORDER BY recorded_at DESC, rowid DESC LIMIT 1`,
  ).bind(workspaceId).first<{
    frost_active: number; drying_active: number; sprinkler_active: number; horizon_days: number; frost_offset_celsius: number;
    frost_margin_sensitive_celsius: number; frost_margin_hardy_celsius: number;
    sprinkler_max_temperature_celsius: number; sprinkler_radiation_w_per_square_meter: number;
  }>();
  if (!row) return { ...DEFAULT_CROP_ALERT_SETTINGS };
  return {
    frostActive: Number(row.frost_active) === 1,
    dryingActive: Number(row.drying_active) === 1,
    sprinklerActive: Number(row.sprinkler_active) === 1,
    horizonDays: Number(row.horizon_days),
    frostOffsetCelsius: Number(row.frost_offset_celsius),
    frostMarginSensitiveCelsius: Number(row.frost_margin_sensitive_celsius),
    frostMarginHardyCelsius: Number(row.frost_margin_hardy_celsius),
    sprinklerMaxTemperatureCelsius: Number(row.sprinkler_max_temperature_celsius),
    sprinklerRadiationWattsPerSquareMeter: Number(row.sprinkler_radiation_w_per_square_meter),
  };
}

type Saved<T> = { ok: true; value: T } | { ok: false; problems: string[] };

/** Enregistre les réglages de l'exploitation, validés par le domaine. */
export async function saveCropAlertSettingsForUser(
  ownerUserId: string,
  input: Partial<Record<keyof CropAlertSettings, unknown>>,
  now = new Date(),
): Promise<Saved<CropAlertSettings>> {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const current = await readCropAlertSettings(workspaceId);
  const validation = validateCropAlertSettings({ ...current, ...input });
  if (!validation.ok) return { ok: false, problems: validation.refusals.map((refusal) => refusal.message) };
  const settings = validation.settings;
  await db.prepare(
    `INSERT INTO irrigation_crop_alert_settings
       (id, workspace_id, frost_active, drying_active, sprinkler_active, horizon_days, frost_offset_celsius,
        frost_margin_sensitive_celsius, frost_margin_hardy_celsius,
        sprinkler_max_temperature_celsius, sprinkler_radiation_w_per_square_meter, actor_user_id, recorded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    crypto.randomUUID(), workspaceId, settings.frostActive ? 1 : 0, settings.dryingActive ? 1 : 0, settings.sprinklerActive ? 1 : 0,
    settings.horizonDays, settings.frostOffsetCelsius, settings.frostMarginSensitiveCelsius, settings.frostMarginHardyCelsius,
    settings.sprinklerMaxTemperatureCelsius,
    settings.sprinklerRadiationWattsPerSquareMeter, ownerUserId, now.toISOString(),
  ).run();
  return { ok: true, value: settings };
}

/** Rattache une espèce, ou une seule série, au jeu commun, avec ou sans seuil de dégâts propre. */
export async function saveFrostLinkForUser(
  ownerUserId: string,
  input: { plantId: string; seriesId: string | null } & FrostLinkInput,
  now = new Date(),
): Promise<Saved<FrostLinkRevision>> {
  const common = await listCropAlertCommon();
  const validation = validateFrostLink(input, new Set(common.map((entry) => entry.key)));
  const problems = [
    ...(validation.ok ? [] : [validation.message]),
    ...(input.plantId.trim() === '' ? ['Espèce inconnue.'] : []),
    ...(input.seriesId !== null && input.seriesId.trim() === '' ? ['Série inconnue.'] : []),
  ];
  if (!validation.ok || problems.length > 0) return { ok: false, problems };
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const revision: FrostLinkRevision = {
    id: crypto.randomUUID(),
    plantId: input.plantId,
    seriesId: input.seriesId,
    commonKey: validation.commonKey,
    damageCelsius: validation.damageCelsius,
    recordedAt: now.toISOString(),
  };
  await db.prepare(
    `INSERT INTO irrigation_crop_frost_links (id, workspace_id, plant_id, series_id, common_key, damage_celsius, actor_user_id, recorded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(revision.id, workspaceId, revision.plantId, revision.seriesId, revision.commonKey, revision.damageCelsius, ownerUserId, revision.recordedAt).run();
  return { ok: true, value: revision };
}

/** Corrige le délai de séchage d'une espèce ; vide, il le retire. */
export async function saveDryingDaysForUser(
  ownerUserId: string,
  input: { plantId: string; dryingDays: unknown },
  now = new Date(),
): Promise<Saved<DryingRevision>> {
  const validation = validateDryingDays(input.dryingDays);
  if (!validation.ok) return { ok: false, problems: [validation.message] };
  if (input.plantId.trim() === '') return { ok: false, problems: ['Espèce inconnue.'] };
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const revision: DryingRevision = { id: crypto.randomUUID(), plantId: input.plantId, dryingDays: validation.dryingDays, recordedAt: now.toISOString() };
  await db.prepare(
    `INSERT INTO irrigation_crop_drying_revisions (id, workspace_id, plant_id, drying_days, actor_user_id, recorded_at) VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(revision.id, workspaceId, revision.plantId, revision.dryingDays, ownerUserId, revision.recordedAt).run();
  return { ok: true, value: revision };
}

export type CropAlertForecastDay = {
  date: string;
  minimumTemperatureCelsius: number | null;
  maximumTemperatureCelsius: number | null;
  solarEnergyMegajoulesPerSquareMeter: number | null;
  forecastedAt: string;
};

/** Les prévisions du lieu météo de l'exploitation, de `from` à `to` compris ; valeurs absentes nulles. */
export async function listCropAlertForecastDays(workspaceId: string, locationKey: string, from: string, to: string): Promise<CropAlertForecastDay[]> {
  const result = await db.prepare(
    `SELECT date, minimum_temperature_celsius, maximum_temperature_celsius, solar_energy_mj_per_square_meter, fetched_at
     FROM irrigation_weather_daily_values
     WHERE workspace_id = ? AND location_key = ? AND data_kind = 'forecast' AND date BETWEEN ? AND ?
     ORDER BY date`,
  ).bind(workspaceId, locationKey, from, to).all<{
    date: string; minimum_temperature_celsius: number | null; maximum_temperature_celsius: number | null;
    solar_energy_mj_per_square_meter: number | null; fetched_at: string;
  }>();
  return result.results.map((row) => ({
    date: row.date,
    minimumTemperatureCelsius: nullable(row.minimum_temperature_celsius),
    maximumTemperatureCelsius: nullable(row.maximum_temperature_celsius),
    solarEnergyMegajoulesPerSquareMeter: nullable(row.solar_energy_mj_per_square_meter),
    forecastedAt: row.fetched_at,
  }));
}

/** La position du lieu météo de l'exploitation, pour le lever et le coucher du soleil ; `null` quand il n'est pas résolu. */
export async function readWeatherPosition(workspaceId: string, locationKey: string): Promise<{ latitude: number; longitude: number } | null> {
  const row = await db.prepare(
    `SELECT latitude, longitude FROM irrigation_weather_geocodes WHERE workspace_id = ? AND location_key = ?`,
  ).bind(workspaceId, locationKey).first<{ latitude: number; longitude: number }>();
  return row ? { latitude: Number(row.latitude), longitude: Number(row.longitude) } : null;
}

/** Le lieu météo dont l'exploitation a lu la prévision le plus récemment ; `null` sans prévision. */
export async function readLatestForecastLocation(workspaceId: string): Promise<string | null> {
  const row = await db.prepare(
    `SELECT location_key FROM irrigation_weather_daily_values
     WHERE workspace_id = ? AND data_kind = 'forecast' ORDER BY fetched_at DESC LIMIT 1`,
  ).bind(workspaceId).first<{ location_key: string }>();
  return row?.location_key ?? null;
}

/** Le propriétaire d'une exploitation, qui donne la clé de son instantané d'Ouvre ta ferme. */
export async function readWorkspaceOwner(workspaceId: string): Promise<string | null> {
  const row = await db.prepare(`SELECT owner_user_id FROM irrigation_workspaces WHERE id = ?`).bind(workspaceId).first<{ owner_user_id: string }>();
  return row?.owner_user_id ?? null;
}

function nullable(value: number | null): number | null {
  return value === null ? null : Number(value);
}
