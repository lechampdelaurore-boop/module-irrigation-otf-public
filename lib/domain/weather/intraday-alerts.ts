import { CROP_ALERT_MAXIMUM_HORIZON_DAYS } from '../crop-alerts/settings.ts';
import { isPartActive } from '../features/socle.ts';
import type { FeatureSelection } from '../features/selection.ts';
import { addDaysToDateKey } from '../water-management.ts';
import { WEATHER_ALERT_MAXIMUM_HORIZON_DAYS } from './weather-alerts.ts';

/**
 * La relecture des prévisions dans la journée, pour les alertes (C1, D-303,
 * docs/weather-scheduler-contract.md, « La relecture de la journée »).
 *
 * Jusqu'au 24 novembre 2026, les alertes météo et de gel ne s'évaluaient
 * qu'à la lecture de 6 h 15 et à l'ouverture du module : un gel apparu dans
 * les prévisions après 6 h 15 n'alertait que si quelqu'un ouvrait le module.
 * Le planificateur relit désormais les prévisions à 9 h 30, 12 h 30, 15 h 30,
 * 18 h 30 et 21 h 30, heure de Paris, pour les seules fermes qui ont une
 * alerte active ; chaque relecture évalue les alertes comme celle du matin.
 */

/**
 * Les jours relus : le plus long horizon qu'une alerte peut régler,
 * aujourd'hui compris (7 jours pour les alertes météo comme pour le gel). La
 * relecture du matin, elle, lit 15 jours ; ce qui dépasse l'horizon des
 * alertes ne change pas d'ici au lendemain matin.
 */
export const INTRADAY_FORECAST_DAYS = Math.max(WEATHER_ALERT_MAXIMUM_HORIZON_DAYS, CROP_ALERT_MAXIMUM_HORIZON_DAYS);

/** La fenêtre lue par une relecture de la journée : les prévisions seules, jamais la réanalyse. */
export function intradayWeatherRequestRanges({ today }: { today: string }) {
  return {
    forecast: { startDate: today, endDate: addDaysToDateKey(today, INTRADAY_FORECAST_DAYS - 1) },
    reanalysis: null,
  };
}

/**
 * Une ferme est relue dans la journée quand au moins une alerte qui lit les
 * prévisions peut partir : un critère d'alerte météo actif avec la case
 * « Alertes météo », ou le gel ou les aspersions actifs avec la case
 * « Alertes cultures » (les aspersions demandent aussi le Planning, 3.8, P1).
 * Le séchage ne lit pas les prévisions : il reste au matin.
 */
export function readsForecastAlerts({
  enabled,
  activeWeatherCriteria,
  cropAlerts,
}: {
  enabled: FeatureSelection;
  activeWeatherCriteria: number;
  cropAlerts: { frostActive: boolean; sprinklerActive: boolean } | null;
}): boolean {
  if (enabled.includes('alertes-meteo') && activeWeatherCriteria > 0) return true;
  if (!enabled.includes('alertes-cultures') || !cropAlerts) return false;
  return cropAlerts.frostActive || (cropAlerts.sprinklerActive && isPartActive(enabled, 'sprinkler-reconsideration'));
}
