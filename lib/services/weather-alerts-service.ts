import { newPushAlarmRevision } from '@/db/irrigation-event/push-schedule';
import {
  claimWeatherAlerts,
  listAlertedDatesForCriterion,
  listWeatherAlertCriteriaForWorkspace,
  listWeatherAlertForecastDays,
  recordWeatherAlertDelivery,
} from '@/db/weather-alert-repository';
import { logJsonLine, type LogLevel } from '../adapters/log';
import type { IrrigationPushSendRequest } from '../domain/irrigation-push-contract';
import { addDaysToDateKey, dateKeyInTimeZone, FARM_TIME_ZONE } from '../domain/water-management';
import {
  evaluateWeatherAlertCriterion,
  WEATHER_ALERT_MAXIMUM_HORIZON_DAYS,
  weatherAlertDrafts,
  weatherAlertNotification,
  type WeatherAlertDeliveryStatus,
} from '../domain/weather/weather-alerts';
import { getEnabledFeaturesForWorkspace } from './feature-selection-service';
import { type IrrigationPushSendResult, sendIrrigationPushNotification } from './irrigation-push-service';

export type WeatherAlertSender = (request: IrrigationPushSendRequest) => Promise<IrrigationPushSendResult>;

/**
 * L'évaluation des alertes météo après une écriture réussie de prévisions
 * (docs/weather-alerts-contract.md, « L'évaluation ») : la synchronisation de
 * 06 h 15 et toute actualisation. Pour chaque critère actif de l'exploitation,
 * les jours visés nouveaux sont d'abord enregistrés, puis annoncés par une
 * seule notification, dont le résultat est écrit sur leurs alertes.
 *
 * Une alerte est une information : rien ici ne touche le besoin, l'objectif
 * ni le planning. Une panne n'empêche ni la synchronisation météo ni
 * l'enregistrement : la fonction ne lève jamais, elle journalise sans nommer
 * personne.
 */
export async function evaluateWeatherAlertsAfterForecastWrite({
  workspaceId,
  locationKey,
  now,
  send = sendIrrigationPushNotification,
  log = logJsonLine,
}: {
  workspaceId: string;
  locationKey: string;
  now: Date;
  send?: WeatherAlertSender;
  log?: (level: LogLevel, entry: Record<string, unknown>) => void;
}): Promise<void> {
  try {
    // Alertes météo décochée : rien ne s'évalue ni ne part (3.8, R1).
    if (!(await getEnabledFeaturesForWorkspace(workspaceId)).includes('alertes-meteo')) return;
    const criteria = (await listWeatherAlertCriteriaForWorkspace(workspaceId)).filter((criterion) => criterion.active);
    if (criteria.length === 0) return;
    const today = dateKeyInTimeZone(now, FARM_TIME_ZONE);
    const forecasts = await listWeatherAlertForecastDays(
      workspaceId,
      locationKey,
      today,
      addDaysToDateKey(today, WEATHER_ALERT_MAXIMUM_HORIZON_DAYS - 1),
    );

    for (const criterion of criteria) {
      const alertedDates = await listAlertedDatesForCriterion(workspaceId, criterion.id, criterion.version);
      const { crossings } = evaluateWeatherAlertCriterion({ criterion, forecasts, today, alertedDates });
      if (crossings.length === 0) continue;
      const claimed = await claimWeatherAlerts(workspaceId, weatherAlertDrafts(criterion, crossings), now);
      if (claimed.length === 0) continue;
      const claimedDates = new Set(claimed.map((alert) => alert.targetDate));
      const notification = weatherAlertNotification(criterion, crossings.filter((crossing) => claimedDates.has(crossing.date)));
      if (!notification) continue;

      const result = await sendSafely(send, {
        notificationId: notification.tag,
        recipientKey: workspaceId,
        revision: newPushAlarmRevision(now),
        notification: { title: notification.title, body: notification.body, tag: notification.tag, data: { url: notification.url } },
      });
      const status = deliveryStatus(result);
      await recordWeatherAlertDelivery(workspaceId, claimed.map((alert) => alert.id), status);
      log(status === 'sent' || status === 'no-subscriber' ? 'info' : 'warn', {
        event: 'weather_alert_evaluated',
        criterionId: criterion.id,
        criterionVersion: criterion.version,
        targetDates: claimed.map((alert) => alert.targetDate),
        deliveryStatus: status,
        error: result.status === 'unreachable' ? result.message : undefined,
        evaluatedAt: now.toISOString(),
      });
    }
  } catch (error) {
    log('warn', {
      event: 'weather_alert_evaluation_failed',
      error: error instanceof Error ? error.message : 'unknown',
      failedAt: now.toISOString(),
    });
  }
}

async function sendSafely(send: WeatherAlertSender, request: IrrigationPushSendRequest): Promise<IrrigationPushSendResult> {
  try {
    return await send(request);
  } catch (error) {
    return { status: 'unreachable', message: error instanceof Error ? error.message : 'Le service d’alerte est indisponible.' };
  }
}

/** Le résultat enregistré : un service non configuré ou injoignable est un échec du service de notification. */
function deliveryStatus(result: IrrigationPushSendResult): Exclude<WeatherAlertDeliveryStatus, 'pending'> {
  return result.status === 'disabled' || result.status === 'unreachable' ? 'failed' : result.status;
}
