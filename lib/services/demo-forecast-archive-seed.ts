import { writeForecastArchiveForUser } from '@/db/forecast-archive-repository';
import { MILLISECONDS_PER_DAY } from '../domain/units.ts';
import { addDaysToDateKey } from '../domain/water-management.ts';
import { FORECAST_ARCHIVE_FIRST_HORIZON_DAYS, FORECAST_ARCHIVE_LAST_HORIZON_DAYS, forecastArchiveRows } from '../domain/weather/forecast-archive.ts';
import type { WeatherDailyValue } from '../domain/weather/weather-provider.ts';

/**
 * L'archive des prévisions qu'une ferme fictive aurait gardée
 * (docs/forecast-reliability-contract.md, §6, D-338, PR 2) : sans elle, le
 * pli « La météo s'est-elle vérifiée ? » de la démonstration resterait vide,
 * puisque la météo semée n'est pas une lecture (F750) et n'écrit pas
 * l'archive.
 *
 * Chaque matin passé de la période, ce que la météo « annonçait » pour J+1
 * à J+7 : la valeur semée du jour visé, écartée d'une quantité qui grandit
 * avec l'horizon, dans un sens ou dans l'autre selon le jour, avec quelques
 * averses manquées et quelques pluies annoncées à tort. Tout est
 * déterministe : la même date donne toujours la même annonce. Les chiffres
 * n'ont aucune valeur météorologique ; le pli les dit « exemple ». Ces
 * lignes ne s'écrivent que dans l'espace de la démonstration.
 */

/** L'écart de la pluie annoncée, par jour d'horizon, en mm. */
const RAIN_SPREAD_MM_PER_HORIZON_DAY = 0.4;
/** Une pluie annoncée à tort, en mm : au-dessus du seuil d'un jour de pluie. */
const PHANTOM_RAIN_MM = 2;
/** L'écart de la soif annoncée, en part de la valeur par jour d'horizon. */
const THIRST_SPREAD_SHARE_PER_HORIZON_DAY = 0.05;
/** La différence de méthode entre la soif calculée par le module et celle du service météo, en mm. */
const THIRST_METHOD_GAP_MM = 0.3;
/** Les valeurs s'écrivent au dixième de millimètre. */
const TENTHS_PER_MILLIMETER = 10;
/** Une semaine d'émissions avant le premier jour semé : ses jours visés ont tous leurs horizons. */
const ISSUES_BEFORE_FIRST_DAY = FORECAST_ARCHIVE_LAST_HORIZON_DAYS;
const RAIN_DAY_MM = 1;

function tenths(millimeters: number): number {
  return Math.round(millimeters * TENTHS_PER_MILLIMETER) / TENTHS_PER_MILLIMETER;
}

/** Le rang du jour depuis le 1er janvier 1970 : la même date, le même rang. */
function dayNumber(dateKey: string): number {
  return Math.floor(Date.parse(`${dateKey}T00:00:00.000Z`) / MILLISECONDS_PER_DAY);
}

/** L'annonce d'un jour visé, à un horizon, à partir de sa valeur semée. */
function announced(value: WeatherDailyValue, horizonDays: number): WeatherDailyValue {
  const day = dayNumber(value.date);
  const sign = day % 2 === 0 ? -1 : 1;
  let rain = value.precipitationMm === null ? null : Math.max(0, value.precipitationMm + sign * RAIN_SPREAD_MM_PER_HORIZON_DAY * horizonDays);
  if (rain !== null && value.precipitationMm !== null) {
    if (value.precipitationMm >= RAIN_DAY_MM && horizonDays >= 5 && day % 2 === 0) rain = 0;
    else if (value.precipitationMm < RAIN_DAY_MM && horizonDays >= 3 && day % 4 === 1) rain = PHANTOM_RAIN_MM;
  }
  const thirst = value.et0Mm === null ? null
    : value.et0Mm * (1 + sign * THIRST_SPREAD_SHARE_PER_HORIZON_DAY * horizonDays) + THIRST_METHOD_GAP_MM;
  return { date: value.date, precipitationMm: rain === null ? null : tenths(rain), et0Mm: thirst === null ? null : tenths(Math.max(0, thirst)) };
}

/**
 * Écrit l'archive des matins de `firstDay − 7` à la veille de `momentDateKey`,
 * pour les jours visés dont la valeur est semée (`values`, réanalyse et
 * prévision mêlées : ce qui s'est « passé » ou se passera).
 */
export async function seedDemoForecastArchive({ ownerUserId, locationKey, values, firstDay, momentDateKey, source }: {
  ownerUserId: string;
  locationKey: string;
  values: readonly WeatherDailyValue[];
  firstDay: string;
  momentDateKey: string;
  source: string;
}): Promise<void> {
  const byDate = new Map(values.map((value) => [value.date, value]));
  for (let issuedOn = addDaysToDateKey(firstDay, -ISSUES_BEFORE_FIRST_DAY); issuedOn < momentDateKey; issuedOn = addDaysToDateKey(issuedOn, 1)) {
    const forecast: WeatherDailyValue[] = [];
    for (let horizonDays = FORECAST_ARCHIVE_FIRST_HORIZON_DAYS; horizonDays <= FORECAST_ARCHIVE_LAST_HORIZON_DAYS; horizonDays += 1) {
      const value = byDate.get(addDaysToDateKey(issuedOn, horizonDays));
      if (value) forecast.push(announced(value, horizonDays));
    }
    const rows = forecastArchiveRows(issuedOn, forecast);
    if (rows.length === 0) continue;
    await writeForecastArchiveForUser(ownerUserId, { locationKey, issuedOn, rows, source, fetchedAt: `${issuedOn}T05:15:00.000Z` });
  }
}
