import { addDaysToDateKey } from '../water-management.ts';
import { hasWeatherValue, type WeatherDailyValue } from './weather-provider.ts';

/**
 * L'archive des prévisions (docs/forecast-archive-contract.md, D-297) : ce
 * qui ne dépend pas de la base.
 *
 * Chaque jour civil de Paris, la première lecture réussie des prévisions
 * d'une exploitation est photographiée pour les jours J+1 à J+7, sans jamais
 * rien écraser. Ce module dit quelles lignes une lecture donne, et jusqu'où
 * remonte la conservation ; le dépôt écrit, le service décide quand.
 */

/** Le premier et le dernier horizon gardés, en jours après le jour d'émission (§3, règle 3). */
export const FORECAST_ARCHIVE_FIRST_HORIZON_DAYS = 1;
export const FORECAST_ARCHIVE_LAST_HORIZON_DAYS = 7;

/** La durée de conservation, en mois glissants (§3, règle 7). */
export const FORECAST_ARCHIVE_KEPT_MONTHS = 24;

const MONTHS_PER_YEAR = 12;

/** Une ligne de l'archive avant son écriture : un jour visé, son horizon et les valeurs prévues. */
export type ForecastArchiveRow = {
  targetDate: string;
  horizonDays: number;
  precipitationMm: number | null;
  et0Mm: number | null;
  minimumTemperatureCelsius: number | null;
  maximumTemperatureCelsius: number | null;
  solarEnergyMegajoulesPerSquareMeter: number | null;
};

/**
 * Les lignes qu'une lecture des prévisions donne pour le jour d'émission
 * `issuedOn` : une par horizon de J+1 à J+7 que la lecture contient avec au
 * moins une valeur. J0 et J+8 et au-delà ne sont jamais gardés ; un horizon
 * absent de la lecture, ou entièrement vide, n'a pas de ligne (règle 5) ;
 * une valeur absente reste `null`, jamais 0 (D-003).
 */
export function forecastArchiveRows(issuedOn: string, values: readonly WeatherDailyValue[]): ForecastArchiveRow[] {
  const byDate = new Map(values.filter(hasWeatherValue).map((value) => [value.date, value]));
  const rows: ForecastArchiveRow[] = [];
  for (let horizonDays = FORECAST_ARCHIVE_FIRST_HORIZON_DAYS; horizonDays <= FORECAST_ARCHIVE_LAST_HORIZON_DAYS; horizonDays += 1) {
    const targetDate = addDaysToDateKey(issuedOn, horizonDays);
    const value = byDate.get(targetDate);
    if (!value) continue;
    rows.push({
      targetDate,
      horizonDays,
      precipitationMm: value.precipitationMm,
      et0Mm: value.et0Mm,
      minimumTemperatureCelsius: value.minimumTemperatureCelsius ?? null,
      maximumTemperatureCelsius: value.maximumTemperatureCelsius ?? null,
      solarEnergyMegajoulesPerSquareMeter: value.solarEnergyMegajoulesPerSquareMeter ?? null,
    });
  }
  return rows;
}

/**
 * Le plus ancien jour d'émission gardé le jour `parisDay` : le même jour,
 * vingt-quatre mois plus tôt (le dernier jour du mois quand il n'existe pas,
 * un 29 février par exemple). Une ligne émise avant lui est purgée ; une
 * ligne émise ce jour-là reste.
 */
export function oldestKeptForecastArchiveDay(parisDay: string): string {
  const [year, month, day] = parisDay.split('-').map(Number);
  const earlier = year - FORECAST_ARCHIVE_KEPT_MONTHS / MONTHS_PER_YEAR;
  const lastDay = new Date(Date.UTC(earlier, month, 0)).getUTCDate();
  return `${String(earlier).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}
