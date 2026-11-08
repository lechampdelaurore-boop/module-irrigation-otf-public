import { celsiusText } from '../crop-alerts/text.ts';
import { percentFromFraction } from '../units.ts';
import type { WeatherAlertForecastDay } from '../weather/weather-alerts.ts';
import { namesText, shortDayText } from './today-text.ts';

/**
 * Les trois jours de « Gel ou chaleur » dessinés
 * (docs/aujourdhui-tableau-de-bord-contract.md, section 3.2) : pour chaque
 * jour, la minimale et la maximale prévues sur une échelle commune, la pluie
 * prévue, une icône et ce qui est annoncé. Les prévisions et les seuils sont
 * ceux des alertes ; aucun seuil nouveau, sauf celui de l'icône de pluie, un
 * réglage d'affichage.
 */

/** L'échelle des températures va au moins de −4 à 20 °C, élargie aux valeurs prévues. */
export const WEATHER_SCALE_MINIMUM_CELSIUS = -4;
const WEATHER_SCALE_MAXIMUM_CELSIUS = 20;
/** Un jour prend l'icône de la pluie à partir d'1 mm prévu : un réglage d'affichage. */
const RAINY_DAY_MM = 1;
/** Les positions se donnent au dixième de pour cent. */
const PERCENT_DECIMALS = 10;

export type TodayWeatherDay = {
  date: string;
  /** « Aujourd’hui », puis « ven. 13 nov. ». */
  label: string;
  minimumCelsius: number | null;
  maximumCelsius: number | null;
  /** La pluie prévue du jour, une prévision (D-006) ; `null` : inconnue. */
  precipitationMm: number | null;
  /** `alert` : une alerte annoncée ce jour ; `unknown` : pas de prévision ; `calm` sinon. */
  tone: 'alert' | 'unknown' | 'calm';
  icon: 'frost' | 'rain' | 'sun' | 'unknown';
  /** « Gel à −1 °C : Courgette, Haricot, Tomate et 2 autres », « Gel P29 : température minimale prévue 3 °C ». */
  notes: string[];
  /** La barre de la minimale à la maximale sur l'échelle, en % ; `null` sans les deux. */
  range: { fromPercent: number; toPercent: number } | null;
};

export type TodayWeatherScale = { minimumCelsius: number; maximumCelsius: number; zeroPercent: number };

/** Ce qui est annoncé un jour : le gel des cultures, et les alertes de l'exploitation qui s'y déclenchent. */
export type DayAnnouncements = {
  frost: { minimumCelsius: number; crops: readonly string[] } | null;
  alerts: readonly string[];
};

function roundedPercent(fraction: number): number {
  return Math.round(percentFromFraction(fraction) * PERCENT_DECIMALS) / PERCENT_DECIMALS;
}

export function weatherScale(forecasts: readonly WeatherAlertForecastDay[]): TodayWeatherScale {
  const values = forecasts.flatMap((day) => [day.minimumTemperatureCelsius, day.maximumTemperatureCelsius])
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const minimumCelsius = Math.min(WEATHER_SCALE_MINIMUM_CELSIUS, ...values.map((value) => Math.floor(value)));
  const maximumCelsius = Math.max(WEATHER_SCALE_MAXIMUM_CELSIUS, ...values.map((value) => Math.ceil(value)));
  return { minimumCelsius, maximumCelsius, zeroPercent: roundedPercent(-minimumCelsius / (maximumCelsius - minimumCelsius)) };
}

export function weatherDays(input: {
  dates: readonly string[];
  today: string;
  forecasts: readonly WeatherAlertForecastDay[];
  announcements: ReadonlyMap<string, DayAnnouncements>;
  scale: TodayWeatherScale;
}): TodayWeatherDay[] {
  const { scale } = input;
  const at = (celsius: number) => roundedPercent((celsius - scale.minimumCelsius) / (scale.maximumCelsius - scale.minimumCelsius));
  return input.dates.map((date) => {
    const forecast = input.forecasts.find((day) => day.date === date) ?? null;
    const minimumCelsius = forecast?.minimumTemperatureCelsius ?? null;
    const maximumCelsius = forecast?.maximumTemperatureCelsius ?? null;
    const precipitationMm = forecast?.precipitationMm ?? null;
    const announced = input.announcements.get(date);
    const notes = [
      ...(announced?.frost ? [`Gel à ${celsiusText(announced.frost.minimumCelsius)} : ${namesText(announced.frost.crops)}`] : []),
      ...(announced?.alerts ?? []),
    ];
    const known = minimumCelsius !== null || maximumCelsius !== null;
    const frosty = announced?.frost != null || (minimumCelsius !== null && minimumCelsius <= 0);
    return {
      date,
      label: date === input.today ? 'Aujourd’hui' : shortDayText(date),
      minimumCelsius,
      maximumCelsius,
      precipitationMm,
      tone: notes.length > 0 ? 'alert' : known ? 'calm' : 'unknown',
      icon: !known ? 'unknown' : frosty ? 'frost' : precipitationMm !== null && precipitationMm >= RAINY_DAY_MM ? 'rain' : 'sun',
      notes,
      range: minimumCelsius !== null && maximumCelsius !== null
        ? { fromPercent: at(minimumCelsius), toPercent: at(maximumCelsius) }
        : null,
    };
  });
}
