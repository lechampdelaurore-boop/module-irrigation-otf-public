import { listAlertedKeys, listCropAlertHistory, type CropAlertKind, type CropAlertRecord } from '@/db/crop-alerts/alerts';
import {
  listCropAlertCommon,
  listCropAlertForecastDays,
  listDryingRevisions,
  listFrostLinks,
  readCropAlertSettings,
  readWeatherPosition,
} from '@/db/crop-alerts/inputs';
import { celsiusText, dayText } from '../domain/crop-alerts/text';
import { cropAlertsScreen, type CropAlertsScreen } from '../domain/crop-alerts/view';
import type { IrrigationSnapshot } from '../domain/domain';
import { addDaysToDateKey, dateKeyInTimeZone, FARM_TIME_ZONE, weekStartDateKey } from '../domain/water-management';
import { pageHref } from '../domain/features/pages';
import { alertWeekUrl, weatherAlertDeliveryLabel, type WeatherAlertDeliveryStatus } from '../domain/weather/weather-alerts';
import { bedNamesBySeries, readSprinklerSlots, shelteredSeries } from './crop-alerts-service';

/** Les alertes affichées dans l'historique de l'encart : les plus récentes. */
const CROP_ALERT_HISTORY_LIMIT = 20;
/** Les jours de prévisions lus : l'horizon le plus long, aujourd'hui compris. */
const FORECAST_DAYS = 7;

type CropAlertHistoryEntry = {
  id: string;
  kind: CropAlertKind;
  /** « Gel », « Arrêt d'arrosage », « Aspersion ». */
  kindLabel: string;
  name: string;
  /** Ce que l'alerte a annoncé, avec les valeurs appliquées à l'envoi (D-006). */
  fact: string;
  /** Le texte de la notification qui l'a annoncée, s'il est connu. */
  detail: string | null;
  sentAt: string;
  deliveryStatus: WeatherAlertDeliveryStatus;
  deliveryLabel: string;
  url: string;
};

export type CropAlertsView = CropAlertsScreen & { history: CropAlertHistoryEntry[] };

/**
 * L'encart « Alertes cultures » (docs/weather-crop-alerts-contract.md,
 * « L'écran ») : les réglages, les seuils et les délais de la ferme, les
 * prochaines échéances lues sur la prévision déjà conservée et l'historique.
 * Rien n'est évalué pour l'envoi ni enregistré ici ; aucun appel vers Ouvre
 * ta ferme, l'instantané étant celui de la page.
 */
export async function readCropAlertsView({
  ownerUserId,
  workspaceId,
  locationKey,
  snapshot,
  season,
  now,
}: {
  ownerUserId: string;
  workspaceId: string | null;
  locationKey: string | null;
  snapshot: IrrigationSnapshot;
  season: number;
  now: Date;
}): Promise<CropAlertsView | null> {
  if (!workspaceId) return null;
  const today = dateKeyInTimeZone(now, FARM_TIME_ZONE);
  const [settings, common, frostRevisions, dryingRevisions, history, forecasts, position, slots, frostKeys, sprinklerKeys, dryingKeys] = await Promise.all([
    readCropAlertSettings(workspaceId),
    listCropAlertCommon(),
    listFrostLinks(workspaceId),
    listDryingRevisions(workspaceId),
    listCropAlertHistory(workspaceId, CROP_ALERT_HISTORY_LIMIT),
    locationKey ? listCropAlertForecastDays(workspaceId, locationKey, today, addDaysToDateKey(today, FORECAST_DAYS - 1)) : Promise.resolve([]),
    locationKey ? readWeatherPosition(workspaceId, locationKey) : Promise.resolve(null),
    readSprinklerSlots(ownerUserId, snapshot, today, now),
    listAlertedKeys(workspaceId, 'frost'),
    listAlertedKeys(workspaceId, 'sprinkler'),
    listAlertedKeys(workspaceId, 'drying'),
  ]);
  const screen = cropAlertsScreen({
    today,
    settings,
    season,
    series: snapshot.cropPlan?.series ?? [],
    tasks: snapshot.cropPlan?.implantationTasks ?? [],
    shelteredSeriesIds: shelteredSeries(snapshot),
    bedNamesBySeries: bedNamesBySeries(snapshot),
    common,
    frostRevisions,
    dryingRevisions,
    forecasts,
    alertedFrostKeys: frostKeys,
    alertedSprinklerKeys: sprinklerKeys,
    alertedDryingSeries: dryingKeys,
    sprinklerSlots: slots,
    location: position,
  });
  return { ...screen, history: history.map(historyEntry) };
}

function historyEntry(record: CropAlertRecord): CropAlertHistoryEntry {
  return {
    id: record.id,
    kind: record.kind,
    kindLabel: record.kind === 'frost' ? 'Gel' : record.kind === 'drying' ? 'Arrêt d’arrosage' : 'Aspersion',
    name: record.name,
    fact: historyFact(record),
    detail: record.detail,
    sentAt: record.sentAt,
    deliveryStatus: record.deliveryStatus,
    deliveryLabel: weatherAlertDeliveryLabel(record.deliveryStatus),
    url: historyUrl(record),
  };
}

/** Toujours une prévision ou une échéance du plan, jamais une observation. */
function historyFact(record: CropAlertRecord): string {
  const day = dayText(record.targetDate);
  if (record.kind === 'frost') {
    const minimum = record.forecastValue === null ? 'Minimale prévue' : `Minimale prévue ${celsiusText(record.forecastValue)}`;
    if (record.damageCelsius === null || record.marginCelsius === null) return `${minimum} le ${day}`;
    const offset = record.offsetCelsius ?? 0;
    const alert = record.damageCelsius + record.marginCelsius + offset;
    return `${minimum} le ${day} ; alerte à ${celsiusText(alert)} (dégâts ${celsiusText(record.damageCelsius)}, marge ${celsiusText(record.marginCelsius)}, microclimat ${celsiusText(offset, true)})`;
  }
  if (record.kind === 'drying') {
    return `Arrêt d’arrosage à partir du ${day}${record.dryingDays === null ? '' : `, ${record.dryingDays} jours avant la récolte`}`;
  }
  if (record.forecastValue === null) return `Aspersion du ${day}`;
  return record.unit === '°C'
    ? `Aspersion du ${day} : maximale prévue ${celsiusText(record.forecastValue)}`
    : `Aspersion du ${day} : rayonnement moyen prévu ${Math.round(record.forecastValue)} W/m²`;
}

/** Le même lien que le clic sur la notification. */
function historyUrl(record: CropAlertRecord): string {
  if (record.kind === 'frost') return alertWeekUrl('alertes-cultures', record.targetDate);
  if (record.kind === 'drying') return pageHref('alertes-cultures', { season: Number(record.targetDate.slice(0, 4)) });
  const monday = weekStartDateKey(record.targetDate);
  return pageHref('planning', { season: Number(monday.slice(0, 4)), week: monday });
}
