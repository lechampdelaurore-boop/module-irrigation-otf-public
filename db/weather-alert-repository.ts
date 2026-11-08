import { db } from './binding';
import { ensureWorkspaceForUser, findWorkspaceIdForUser } from './workspace-repository';
import {
  weatherAlertCriterionNeedsNewVersion,
  type WeatherAlertCriterion,
  type WeatherAlertCriterionSettings,
  type WeatherAlertDeliveryStatus,
  type WeatherAlertDraft,
  type WeatherAlertForecastDay,
} from '@/lib/domain/weather/weather-alerts';

/**
 * Persistance des alertes météo (5 bis, docs/weather-alerts-contract.md,
 * D-050, migration 0022) : les critères d'une exploitation et leurs versions
 * immuables, les prévisions qu'on évalue, et les alertes, une au plus par
 * version de critère et par jour visé.
 */

type CriterionRow = {
  id: string;
  current_version: number;
  active: number;
  field: WeatherAlertCriterion['field'];
  direction: WeatherAlertCriterion['direction'];
  threshold: number;
  horizon_days: number;
  label: string | null;
};

const CRITERION_COLUMNS = `c.id, c.current_version, c.active, v.field, v.direction, v.threshold, v.horizon_days, v.label`;
const CRITERION_JOIN = `irrigation_weather_alert_criteria c
     JOIN irrigation_weather_alert_criterion_versions v
       ON v.criterion_id = c.id AND v.version = c.current_version`;

/** Les critères en vigueur d'une exploitation, du plus ancien au plus récent ; les supprimés n'y sont plus. */
export async function listWeatherAlertCriteriaForWorkspace(workspaceId: string): Promise<WeatherAlertCriterion[]> {
  const result = await db.prepare(
    `SELECT ${CRITERION_COLUMNS}
     FROM ${CRITERION_JOIN}
     WHERE c.workspace_id = ? AND c.deleted_at IS NULL
     ORDER BY c.created_at, c.rowid`,
  ).bind(workspaceId).all<CriterionRow>();
  return result.results.map(criterionFromRow);
}

/** Ajoute un critère à l'exploitation de l'utilisateur, en version 1. */
export async function createWeatherAlertCriterionForUser(
  ownerUserId: string,
  settings: WeatherAlertCriterionSettings,
  now = new Date(),
): Promise<WeatherAlertCriterion> {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const id = crypto.randomUUID();
  const at = now.toISOString();
  await db.batch([
    db.prepare(
      `INSERT INTO irrigation_weather_alert_criteria (id, workspace_id, current_version, active, created_at, updated_at)
       VALUES (?, ?, 1, ?, ?, ?)`,
    ).bind(id, workspaceId, settings.active ? 1 : 0, at, at),
    versionStatement(id, 1, settings, ownerUserId, at),
  ]);
  return { ...settings, id, version: 1 };
}

/**
 * Modifie un critère de l'exploitation de l'utilisateur. Une modification
 * ajoute une version et remet ses jours visés à zéro ; l'activer ou le
 * désactiver ne change que le critère. `null` quand le critère n'existe pas
 * pour cette exploitation, ou plus.
 */
export async function updateWeatherAlertCriterionForUser(
  ownerUserId: string,
  criterionId: string,
  settings: WeatherAlertCriterionSettings,
  now = new Date(),
): Promise<WeatherAlertCriterion | null> {
  const workspaceId = await findWorkspaceIdForUser(ownerUserId);
  if (!workspaceId) return null;
  const current = await db.prepare(
    `SELECT ${CRITERION_COLUMNS}
     FROM ${CRITERION_JOIN}
     WHERE c.id = ? AND c.workspace_id = ? AND c.deleted_at IS NULL`,
  ).bind(criterionId, workspaceId).first<CriterionRow>();
  if (!current) return null;
  const previous = criterionFromRow(current);
  const at = now.toISOString();
  const version = weatherAlertCriterionNeedsNewVersion(previous, settings) ? previous.version + 1 : previous.version;
  const statements = [
    db.prepare(
      `UPDATE irrigation_weather_alert_criteria
       SET current_version = ?, active = ?, updated_at = ?
       WHERE id = ? AND workspace_id = ? AND current_version = ?`,
    ).bind(version, settings.active ? 1 : 0, at, criterionId, workspaceId, previous.version),
  ];
  if (version !== previous.version) statements.unshift(versionStatement(criterionId, version, settings, ownerUserId, at));
  await db.batch(statements);
  return version === previous.version
    ? { ...previous, active: settings.active }
    : { ...settings, id: criterionId, version };
}

/** Supprime un critère : il n'est plus évalué ; ses alertes passées restent. `false` s'il n'existait pas. */
export async function deleteWeatherAlertCriterionForUser(
  ownerUserId: string,
  criterionId: string,
  now = new Date(),
): Promise<boolean> {
  const workspaceId = await findWorkspaceIdForUser(ownerUserId);
  if (!workspaceId) return false;
  // `meta.changes` n'est pas fiable sur D1 (db/write-result.ts) : on lit d'abord.
  const row = await db.prepare(
    `SELECT deleted_at FROM irrigation_weather_alert_criteria WHERE id = ? AND workspace_id = ?`,
  ).bind(criterionId, workspaceId).first<{ deleted_at: string | null }>();
  if (!row || row.deleted_at !== null) return false;
  const at = now.toISOString();
  await db.prepare(
    `UPDATE irrigation_weather_alert_criteria
     SET deleted_at = ?, updated_at = ?
     WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
  ).bind(at, at, criterionId, workspaceId).run();
  return true;
}

/**
 * Les prévisions de l'exploitation pour son lieu météo, de `from` à `to`
 * compris : une ligne par jour, la plus récente, valeurs absentes nulles.
 */
export async function listWeatherAlertForecastDays(
  workspaceId: string,
  locationKey: string,
  from: string,
  to: string,
): Promise<WeatherAlertForecastDay[]> {
  const result = await db.prepare(
    `SELECT date, minimum_temperature_celsius, maximum_temperature_celsius, precipitation_mm, fetched_at
     FROM irrigation_weather_daily_values
     WHERE workspace_id = ? AND location_key = ? AND data_kind = 'forecast' AND date BETWEEN ? AND ?
     ORDER BY date`,
  ).bind(workspaceId, locationKey, from, to).all<{
    date: string;
    minimum_temperature_celsius: number | null;
    maximum_temperature_celsius: number | null;
    precipitation_mm: number | null;
    fetched_at: string;
  }>();
  return result.results.map((row) => ({
    date: row.date,
    minimumTemperatureCelsius: nullableNumber(row.minimum_temperature_celsius),
    maximumTemperatureCelsius: nullableNumber(row.maximum_temperature_celsius),
    precipitationMm: nullableNumber(row.precipitation_mm),
    forecastedAt: row.fetched_at,
  }));
}

/** Les jours déjà alertés pour une version de critère : la règle de répétition. */
export async function listAlertedDatesForCriterion(
  workspaceId: string,
  criterionId: string,
  criterionVersion: number,
): Promise<Set<string>> {
  const result = await db.prepare(
    `SELECT target_date FROM irrigation_weather_alerts
     WHERE workspace_id = ? AND criterion_id = ? AND criterion_version = ?`,
  ).bind(workspaceId, criterionId, criterionVersion).all<{ target_date: string }>();
  return new Set(result.results.map((row) => row.target_date));
}

export type ClaimedWeatherAlert = WeatherAlertDraft & { id: string };

/**
 * Enregistre les alertes avant l'envoi, en attente de son résultat, et rend
 * celles qui sont bien nouvelles : la clé unique (version, jour visé) écarte
 * un jour qu'une autre évaluation vient de prendre, si bien qu'aucune
 * notification ne part deux fois pour le même jour.
 */
export async function claimWeatherAlerts(
  workspaceId: string,
  drafts: readonly WeatherAlertDraft[],
  sentAt: Date,
): Promise<ClaimedWeatherAlert[]> {
  if (drafts.length === 0) return [];
  const candidates = drafts.map((draft) => ({ ...draft, id: crypto.randomUUID() }));
  await db.batch(candidates.map((alert) => db.prepare(
    `INSERT OR IGNORE INTO irrigation_weather_alerts
       (id, workspace_id, criterion_id, criterion_version, target_date, forecast_value, unit, forecasted_at, sent_at, delivery_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
  ).bind(
    alert.id, workspaceId, alert.criterionId, alert.criterionVersion, alert.targetDate,
    alert.forecastValue, alert.unit, alert.forecastedAt, sentAt.toISOString(),
  )));
  // `meta.changes` n'est pas fiable sur D1 (db/write-result.ts) : on relit les identifiants écrits.
  const written = await db.prepare(
    `SELECT id FROM irrigation_weather_alerts
     WHERE workspace_id = ? AND id IN (${candidates.map(() => '?').join(', ')})`,
  ).bind(workspaceId, ...candidates.map((alert) => alert.id)).all<{ id: string }>();
  const ids = new Set(written.results.map((row) => row.id));
  return candidates.filter((alert) => ids.has(alert.id));
}

/** Le résultat de l'envoi, écrit une fois sur des alertes encore en attente ; l'alerte ne change plus ensuite. */
export async function recordWeatherAlertDelivery(
  workspaceId: string,
  alertIds: readonly string[],
  status: Exclude<WeatherAlertDeliveryStatus, 'pending'>,
): Promise<void> {
  if (alertIds.length === 0) return;
  await db.prepare(
    `UPDATE irrigation_weather_alerts SET delivery_status = ?
     WHERE workspace_id = ? AND delivery_status = 'pending' AND id IN (${alertIds.map(() => '?').join(', ')})`,
  ).bind(status, workspaceId, ...alertIds).run();
}

function versionStatement(
  criterionId: string,
  version: number,
  settings: WeatherAlertCriterionSettings,
  actorUserId: string,
  at: string,
) {
  return db.prepare(
    `INSERT INTO irrigation_weather_alert_criterion_versions
       (criterion_id, version, field, direction, threshold, horizon_days, label, actor_user_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    criterionId, version, settings.field, settings.direction, settings.threshold,
    settings.horizonDays, settings.label, actorUserId, at,
  );
}

function criterionFromRow(row: CriterionRow): WeatherAlertCriterion {
  return {
    id: row.id,
    version: Number(row.current_version),
    active: Number(row.active) === 1,
    field: row.field,
    direction: row.direction,
    threshold: Number(row.threshold),
    horizonDays: Number(row.horizon_days),
    label: row.label,
  };
}

function nullableNumber(value: number | null): number | null {
  return value === null ? null : Number(value);
}

/** Les alertes enregistrées d'une exploitation, pour les tests et l'historique de l'écran. */
export async function listWeatherAlertsForWorkspace(workspaceId: string): Promise<Array<ClaimedWeatherAlert & {
  sentAt: string;
  deliveryStatus: WeatherAlertDeliveryStatus;
}>> {
  const result = await db.prepare(
    `SELECT id, criterion_id, criterion_version, target_date, forecast_value, unit, forecasted_at, sent_at, delivery_status
     FROM irrigation_weather_alerts
     WHERE workspace_id = ?
     ORDER BY sent_at DESC, target_date`,
  ).bind(workspaceId).all<{
    id: string;
    criterion_id: string;
    criterion_version: number;
    target_date: string;
    forecast_value: number;
    unit: WeatherAlertDraft['unit'];
    forecasted_at: string;
    sent_at: string;
    delivery_status: WeatherAlertDeliveryStatus;
  }>();
  return result.results.map((row) => ({
    id: row.id,
    criterionId: row.criterion_id,
    criterionVersion: Number(row.criterion_version),
    targetDate: row.target_date,
    forecastValue: Number(row.forecast_value),
    unit: row.unit,
    forecastedAt: row.forecasted_at,
    sentAt: row.sent_at,
    deliveryStatus: row.delivery_status,
  }));
}

/** Une alerte de l'historique, avec le critère tel qu'il était à son envoi (D-006). */
export type WeatherAlertHistoryRecord = ClaimedWeatherAlert & {
  sentAt: string;
  deliveryStatus: WeatherAlertDeliveryStatus;
  criterion: Omit<WeatherAlertCriterionSettings, 'active'>;
};

type HistoryRow = {
  id: string;
  criterion_id: string;
  criterion_version: number;
  target_date: string;
  forecast_value: number;
  unit: WeatherAlertDraft['unit'];
  forecasted_at: string;
  sent_at: string;
  delivery_status: WeatherAlertDeliveryStatus;
  field: WeatherAlertCriterion['field'];
  direction: WeatherAlertCriterion['direction'];
  threshold: number;
  horizon_days: number;
  label: string | null;
};

const HISTORY_SELECT = `SELECT a.id, a.criterion_id, a.criterion_version, a.target_date, a.forecast_value, a.unit,
            a.forecasted_at, a.sent_at, a.delivery_status, v.field, v.direction, v.threshold, v.horizon_days, v.label
     FROM irrigation_weather_alerts a
     JOIN irrigation_weather_alert_criterion_versions v
       ON v.criterion_id = a.criterion_id AND v.version = a.criterion_version`;

/** L'historique des alertes de l'exploitation, la plus récente en premier, au plus `limit`. */
export async function listWeatherAlertHistoryForWorkspace(workspaceId: string, limit: number): Promise<WeatherAlertHistoryRecord[]> {
  const result = await db.prepare(
    `${HISTORY_SELECT}
     WHERE a.workspace_id = ?
     ORDER BY a.sent_at DESC, a.target_date
     LIMIT ?`,
  ).bind(workspaceId, limit).all<HistoryRow>();
  return result.results.map(historyFromRow);
}

/** La dernière alerte de chaque critère de l'exploitation, toutes versions confondues. */
export async function listLatestWeatherAlertPerCriterion(workspaceId: string): Promise<Map<string, WeatherAlertHistoryRecord>> {
  const result = await db.prepare(
    `${HISTORY_SELECT}
     WHERE a.workspace_id = ? AND a.id IN (
       SELECT id FROM (
         SELECT id, ROW_NUMBER() OVER (PARTITION BY criterion_id ORDER BY sent_at DESC, target_date) AS rank
         FROM irrigation_weather_alerts
         WHERE workspace_id = ?
       ) WHERE rank = 1
     )`,
  ).bind(workspaceId, workspaceId).all<HistoryRow>();
  return new Map(result.results.map((row) => [row.criterion_id, historyFromRow(row)]));
}

function historyFromRow(row: HistoryRow): WeatherAlertHistoryRecord {
  return {
    id: row.id,
    criterionId: row.criterion_id,
    criterionVersion: Number(row.criterion_version),
    targetDate: row.target_date,
    forecastValue: Number(row.forecast_value),
    unit: row.unit,
    forecastedAt: row.forecasted_at,
    sentAt: row.sent_at,
    deliveryStatus: row.delivery_status,
    criterion: {
      field: row.field,
      direction: row.direction,
      threshold: Number(row.threshold),
      horizonDays: Number(row.horizon_days),
      label: row.label,
    },
  };
}
