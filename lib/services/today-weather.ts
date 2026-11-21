import { listWeatherAlertCriteriaForWorkspace, listWeatherAlertForecastDays } from '@/db/weather-alert-repository';
import { findWorkspaceIdForUser } from '@/db/workspace-repository';
import type { IrrigationSnapshot } from '../domain/domain';
import type { FeatureSelection } from '../domain/features/selection';
import { TODAY_WEATHER_DAYS, weatherBlock, type TodayWeatherInputs } from '../domain/today/today-view';
import { addDaysToDateKey, dateKeyInTimeZone, FARM_TIME_ZONE } from '../domain/water-management';
import { weatherLocationKey } from '../domain/weather/location';
import { readCropAlertsView } from './crop-alerts-view';
import { readWeatherPreference } from './weather-preference';

type WeatherRequest = {
  ownerUserId: string;
  workspaceId: string | null;
  locationKey: string | null;
  snapshot: IrrigationSnapshot;
  season: number;
  enabled: FeatureSelection;
  now: Date;
};

/**
 * Ce que lit le bloc « Gel ou chaleur » : les prévisions conservées des trois
 * jours, le gel des cultures et les critères actifs de l'exploitation. Une
 * case décochée n'est pas lue (R1).
 */
export async function readTodayWeatherInputs({ ownerUserId, workspaceId, locationKey, snapshot, season, enabled, now }: WeatherRequest): Promise<TodayWeatherInputs> {
  const on = (feature: FeatureSelection[number]) => enabled.includes(feature);
  const today = dateKeyInTimeZone(now, FARM_TIME_ZONE);
  const [forecasts, cropAlerts, criteria] = await Promise.all([
    (on('alertes-cultures') || on('alertes-meteo')) && workspaceId && locationKey
      ? listWeatherAlertForecastDays(workspaceId, locationKey, today, addDaysToDateKey(today, TODAY_WEATHER_DAYS - 1))
      : [],
    on('alertes-cultures') ? readCropAlertsView({ ownerUserId, workspaceId, locationKey, snapshot, season, now }) : null,
    on('alertes-meteo') && workspaceId ? listWeatherAlertCriteriaForWorkspace(workspaceId) : [],
  ]);
  return {
    forecasts,
    frost: cropAlerts ? cropAlerts.upcoming.frost : null,
    criteria: on('alertes-meteo') ? criteria.filter((criterion) => criterion.active) : null,
  };
}

/**
 * Les alertes en cours d'une ferme, comme les annonce le bloc « Gel ou
 * chaleur » de « Aujourd'hui » : le message du matin les compte (amélioration
 * n° 3, F713). Sans « Alertes météo » ni « Alertes cultures », rien n'est lu.
 */
export async function countTodayAlertsForUser(request: { ownerUserId: string; snapshot: IrrigationSnapshot; season: number; enabled: FeatureSelection; now: Date }): Promise<number> {
  if (!request.enabled.includes('alertes-meteo') && !request.enabled.includes('alertes-cultures')) return 0;
  const [workspaceId, preference] = await Promise.all([findWorkspaceIdForUser(request.ownerUserId), readWeatherPreference(request.ownerUserId)]);
  const locationKey = weatherLocationKey(preference, request.snapshot.structure);
  const weather = await readTodayWeatherInputs({ ...request, workspaceId, locationKey });
  return weatherBlock(weather, request.enabled, request.now).alerts;
}
