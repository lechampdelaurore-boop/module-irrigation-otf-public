import { db } from '../binding';
import type { WeatherAlertDeliveryStatus } from '@/lib/domain/weather/weather-alerts';

/**
 * Les alertes par culture enregistrées (docs/weather-crop-alerts-contract.md,
 * « L'alerte enregistrée et la notification », migration 0026) : une au plus
 * par sujet et par jour visé pour le gel et l'aspersion, une par série pour
 * le séchage, tenu par des clés uniques même quand deux évaluations se
 * croisent. Une alerte garde les valeurs appliquées à l'envoi et ne change
 * plus ensuite, sauf le résultat de l'envoi, écrit une fois.
 */

export type CropAlertKind = 'frost' | 'drying' | 'sprinkler';

export type CropAlertDraftRecord = {
  kind: CropAlertKind;
  subjectKey: string;
  subjectVersion: string;
  plantId: string | null;
  seriesId: string | null;
  name: string;
  targetDate: string;
  damageCelsius: number | null;
  marginCelsius: number | null;
  offsetCelsius: number | null;
  dryingDays: number | null;
  forecastValue: number | null;
  unit: '°C' | 'W/m²' | null;
  forecastedAt: string | null;
  detail: string | null;
};

export type ClaimedCropAlert = CropAlertDraftRecord & { id: string };

export type CropAlertRecord = ClaimedCropAlert & { sentAt: string; deliveryStatus: WeatherAlertDeliveryStatus };

/** Les clés déjà prises d'une nature d'alerte : sujet, version et jour visé ; pour le séchage, la série. */
export async function listAlertedKeys(workspaceId: string, kind: CropAlertKind): Promise<Set<string>> {
  const result = await db.prepare(
    `SELECT subject_key, subject_version, target_date FROM irrigation_crop_alerts WHERE workspace_id = ? AND kind = ?`,
  ).bind(workspaceId, kind).all<{ subject_key: string; subject_version: string; target_date: string }>();
  return new Set(result.results.map((row) => (kind === 'drying'
    ? row.subject_key
    : kind === 'frost' ? `${row.subject_key}|${row.subject_version}|${row.target_date}` : `${row.subject_key}|${row.target_date}`)));
}

/**
 * Enregistre les alertes avant l'envoi, en attente de son résultat, et rend
 * celles qui sont bien nouvelles : les clés uniques écartent ce qu'une autre
 * évaluation vient de prendre.
 */
export async function claimCropAlerts(workspaceId: string, drafts: readonly CropAlertDraftRecord[], sentAt: Date): Promise<ClaimedCropAlert[]> {
  if (drafts.length === 0) return [];
  const candidates = drafts.map((draft) => ({ ...draft, id: crypto.randomUUID() }));
  await db.batch(candidates.map((alert) => db.prepare(
    `INSERT OR IGNORE INTO irrigation_crop_alerts
       (id, workspace_id, kind, subject_key, subject_version, plant_id, series_id, name, target_date, damage_celsius, margin_celsius,
        offset_celsius, drying_days, forecast_value, unit, forecasted_at, detail, sent_at, delivery_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
  ).bind(
    alert.id, workspaceId, alert.kind, alert.subjectKey, alert.subjectVersion, alert.plantId, alert.seriesId, alert.name, alert.targetDate,
    alert.damageCelsius, alert.marginCelsius, alert.offsetCelsius, alert.dryingDays, alert.forecastValue, alert.unit, alert.forecastedAt,
    alert.detail, sentAt.toISOString(),
  )));
  // `meta.changes` n'est pas fiable sur D1 (db/write-result.ts) : on relit les identifiants écrits.
  const written = await db.prepare(
    `SELECT id FROM irrigation_crop_alerts WHERE workspace_id = ? AND id IN (${candidates.map(() => '?').join(', ')})`,
  ).bind(workspaceId, ...candidates.map((alert) => alert.id)).all<{ id: string }>();
  const ids = new Set(written.results.map((row) => row.id));
  return candidates.filter((alert) => ids.has(alert.id));
}

/** Le résultat de l'envoi et le texte annoncé, écrits une fois sur des alertes encore en attente. */
export async function recordCropAlertDelivery(
  workspaceId: string,
  alertIds: readonly string[],
  status: Exclude<WeatherAlertDeliveryStatus, 'pending'>,
  detail: string | null,
): Promise<void> {
  if (alertIds.length === 0) return;
  await db.prepare(
    `UPDATE irrigation_crop_alerts SET delivery_status = ?, detail = COALESCE(?, detail)
     WHERE workspace_id = ? AND delivery_status = 'pending' AND id IN (${alertIds.map(() => '?').join(', ')})`,
  ).bind(status, detail, workspaceId, ...alertIds).run();
}

/** L'historique des alertes de l'exploitation, la plus récente en premier, au plus `limit`. */
export async function listCropAlertHistory(workspaceId: string, limit: number): Promise<CropAlertRecord[]> {
  const result = await db.prepare(
    `SELECT id, kind, subject_key, subject_version, plant_id, series_id, name, target_date, damage_celsius, margin_celsius, offset_celsius,
            drying_days, forecast_value, unit, forecasted_at, detail, sent_at, delivery_status
     FROM irrigation_crop_alerts WHERE workspace_id = ? ORDER BY sent_at DESC, target_date, name LIMIT ?`,
  ).bind(workspaceId, limit).all<{
    id: string; kind: CropAlertKind; subject_key: string; subject_version: string; plant_id: string | null; series_id: string | null;
    name: string; target_date: string; damage_celsius: number | null; margin_celsius: number | null; offset_celsius: number | null;
    drying_days: number | null; forecast_value: number | null; unit: CropAlertDraftRecord['unit']; forecasted_at: string | null;
    detail: string | null; sent_at: string; delivery_status: WeatherAlertDeliveryStatus;
  }>();
  return result.results.map((row) => ({
    id: row.id,
    kind: row.kind,
    subjectKey: row.subject_key,
    subjectVersion: row.subject_version,
    plantId: row.plant_id,
    seriesId: row.series_id,
    name: row.name,
    targetDate: row.target_date,
    damageCelsius: nullable(row.damage_celsius),
    marginCelsius: nullable(row.margin_celsius),
    offsetCelsius: nullable(row.offset_celsius),
    dryingDays: nullable(row.drying_days),
    forecastValue: nullable(row.forecast_value),
    unit: row.unit,
    forecastedAt: row.forecasted_at,
    detail: row.detail,
    sentAt: row.sent_at,
    deliveryStatus: row.delivery_status,
  }));
}

function nullable(value: number | null): number | null {
  return value === null ? null : Number(value);
}
