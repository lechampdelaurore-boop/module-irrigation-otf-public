import {
  listLatestWeatherAlertPerCriterion,
  listWeatherAlertCriteriaForWorkspace,
  listWeatherAlertForecastDays,
  listWeatherAlertHistoryForWorkspace,
  type WeatherAlertHistoryRecord,
} from '@/db/weather-alert-repository';
import { addDaysToDateKey, dateKeyInTimeZone, FARM_TIME_ZONE } from '../domain/water-management';
import {
  evaluateWeatherAlertCriterion,
  formatWeatherAlertValue,
  unavailableForecastMessage,
  WEATHER_ALERT_MAXIMUM_HORIZON_DAYS,
  weatherAlertCriterionSummary,
  weatherAlertDeliveryLabel,
  alertWeekUrl,
  type WeatherAlertCriterion,
  type WeatherAlertDeliveryStatus,
} from '../domain/weather/weather-alerts';

/** Les alertes affichées dans l'historique de l'écran : les plus récentes. */
const WEATHER_ALERT_HISTORY_LIMIT = 20;

export type WeatherAlertHistoryEntry = {
  id: string;
  criterionId: string;
  criterionVersion: number;
  /** Le libellé du critère tel qu'il était à l'envoi, s'il en avait un. */
  label: string | null;
  /** Le critère tel qu'il était à l'envoi, en une phrase (D-006). */
  criterionSummary: string;
  targetDate: string;
  /** La valeur prévue avec son unité : « 2,6 °C ». */
  forecastValue: string;
  forecastedAt: string;
  sentAt: string;
  deliveryStatus: WeatherAlertDeliveryStatus;
  deliveryLabel: string;
  /** La météo de la semaine du jour visé, comme le clic sur la notification. */
  url: string;
};

type WeatherAlertCriterionView = {
  criterion: WeatherAlertCriterion;
  summary: string;
  /** « Prévision indisponible pour le mardi 3 novembre. », ou rien. */
  unavailableMessage: string | null;
  lastAlert: WeatherAlertHistoryEntry | null;
};

export type WeatherAlertsView = {
  criteria: WeatherAlertCriterionView[];
  history: WeatherAlertHistoryEntry[];
};

/**
 * L'encart « Alertes météo » (docs/weather-alerts-contract.md, « L'écran ») :
 * les critères de l'exploitation, chacun avec sa phrase, les jours de son
 * horizon sans prévision et sa dernière alerte, puis l'historique, plus
 * récente en premier. Rien n'est évalué ni envoyé ici.
 */
export async function readWeatherAlertsView({
  workspaceId,
  locationKey,
  now,
}: {
  workspaceId: string | null;
  locationKey: string | null;
  now: Date;
}): Promise<WeatherAlertsView> {
  if (!workspaceId) return { criteria: [], history: [] };
  const today = dateKeyInTimeZone(now, FARM_TIME_ZONE);
  const [criteria, history, latest, forecasts] = await Promise.all([
    listWeatherAlertCriteriaForWorkspace(workspaceId),
    listWeatherAlertHistoryForWorkspace(workspaceId, WEATHER_ALERT_HISTORY_LIMIT),
    listLatestWeatherAlertPerCriterion(workspaceId),
    locationKey
      ? listWeatherAlertForecastDays(workspaceId, locationKey, today, addDaysToDateKey(today, WEATHER_ALERT_MAXIMUM_HORIZON_DAYS - 1))
      : Promise.resolve([]),
  ]);
  return {
    criteria: criteria.map((criterion) => {
      const evaluation = evaluateWeatherAlertCriterion({ criterion, forecasts, today, alertedDates: new Set() });
      const last = latest.get(criterion.id);
      return {
        criterion,
        summary: weatherAlertCriterionSummary(criterion),
        unavailableMessage: unavailableForecastMessage(evaluation.unavailableDates),
        lastAlert: last ? historyEntry(last) : null,
      };
    }),
    history: history.map(historyEntry),
  };
}

function historyEntry(record: WeatherAlertHistoryRecord): WeatherAlertHistoryEntry {
  return {
    id: record.id,
    criterionId: record.criterionId,
    criterionVersion: record.criterionVersion,
    label: record.criterion.label,
    criterionSummary: weatherAlertCriterionSummary({ ...record.criterion, active: true }),
    targetDate: record.targetDate,
    forecastValue: formatWeatherAlertValue(record.forecastValue, record.unit),
    forecastedAt: record.forecastedAt,
    sentAt: record.sentAt,
    deliveryStatus: record.deliveryStatus,
    deliveryLabel: weatherAlertDeliveryLabel(record.deliveryStatus),
    url: alertWeekUrl('alertes-meteo', record.targetDate),
  };
}
