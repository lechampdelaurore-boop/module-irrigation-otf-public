import type { WeatherDailyValue, WeatherLocationCandidate, WeatherProvider, WeatherReadInput } from '../../domain/weather/weather-provider.ts';
import { demonstrationWeatherProvider } from './demonstration-provider.ts';

/**
 * La météo de la démonstration guidée (docs/demo-guided-contract.md,
 * section 6, moments de saison) : celle des parcours navigateur, sans
 * réseau ni hasard, réchauffée selon le mois (le motif des parcours est une
 * arrière-saison : sans cela, l'été aurait des nuits à 2,6 °C et du gel
 * annoncé en juin), et deux semaines de 2026 écrites pour leur moment :
 * deux nuits de gel à la mi-avril (le moment « gel de printemps », le
 * 14 avril), et deux semaines sèches et chaudes à la mi-juillet (le moment
 * « pénurie », le 21 juillet). Ce sont des valeurs de démonstration, sans
 * valeur agronomique, comme celles qu'elle complète ; elles ne dépendent que
 * de la date. Les communes sont celles des fermes fictives.
 */

const CITIES: readonly WeatherLocationCandidate[] = [
  { displayName: 'Nantes (44000)', city: 'Nantes', postcode: '44000', latitude: 47.2181, longitude: -1.5528, timezone: 'Europe/Paris', countryCode: 'FR' },
  { displayName: 'Tours (37000)', city: 'Tours', postcode: '37000', latitude: 47.3936, longitude: 0.6848, timezone: 'Europe/Paris', countryCode: 'FR' },
  { displayName: 'Valence (26000)', city: 'Valence', postcode: '26000', latitude: 44.9334, longitude: 4.8924, timezone: 'Europe/Paris', countryCode: 'FR' },
];

type DayOverride = Partial<Omit<WeatherDailyValue, 'date'>>;

/** Mi-avril : deux nuits sous zéro, des journées fraîches et sèches. */
const SPRING_FROST: Readonly<Record<string, DayOverride>> = {
  '2026-04-13': { minimumTemperatureCelsius: 4.1, maximumTemperatureCelsius: 14.2, precipitationMm: 0 },
  '2026-04-14': { minimumTemperatureCelsius: 1.8, maximumTemperatureCelsius: 12.6, precipitationMm: 0 },
  '2026-04-15': { minimumTemperatureCelsius: -2.4, maximumTemperatureCelsius: 11.9, precipitationMm: 0 },
  '2026-04-16': { minimumTemperatureCelsius: -1.1, maximumTemperatureCelsius: 13.4, precipitationMm: 0 },
  '2026-04-17': { minimumTemperatureCelsius: 3.2, maximumTemperatureCelsius: 15.8, precipitationMm: 0 },
};

const SUMMER_MINIMA = [17.2, 18.4, 16.9, 19.1, 18.0, 17.6, 18.8] as const;
const SUMMER_MAXIMA = [31.4, 33.2, 32.6, 34.1, 30.8, 32.9, 33.5] as const;
const SUMMER_ET0_MM = [5.6, 6.1, 5.9, 6.4, 5.7, 6.2, 6.0] as const;

/** Du 13 juillet au 2 août : ni pluie ni fraîcheur, pour que les sept jours de prévision du moment restent secs. */
function summerDrought(date: string): DayOverride | null {
  if (date < '2026-07-13' || date > '2026-08-02') return null;
  const index = Number(date.slice(8, 10)) % SUMMER_MINIMA.length;
  return {
    precipitationMm: 0,
    et0Mm: SUMMER_ET0_MM[index],
    minimumTemperatureCelsius: SUMMER_MINIMA[index],
    maximumTemperatureCelsius: SUMMER_MAXIMA[index],
  };
}

/** De combien le mois réchauffe le motif des parcours, en °C ; avril et l'hiver le gardent tel quel. */
const SEASON_WARMING_CELSIUS: Readonly<Record<string, number>> = { '05': 4, '06': 7, '07': 9, '08': 9, '09': 5, '10': 1 };
/** De combien le mois multiplie l'ETP du motif, une arrière-saison. */
const SEASON_ET0_FACTOR: Readonly<Record<string, number>> = { '05': 1.3, '06': 1.5, '07': 1.6, '08': 1.5, '10': 0.7 };

const roundToTenth = (value: number) => Math.round(value * 10) / 10;

function inSeason(value: WeatherDailyValue): WeatherDailyValue {
  const month = value.date.slice(5, 7);
  const warming = SEASON_WARMING_CELSIUS[month] ?? 0;
  const factor = SEASON_ET0_FACTOR[month] ?? 1;
  const warm = (celsius: number | null | undefined) => (celsius === null || celsius === undefined ? celsius : roundToTenth(celsius + warming));
  return {
    ...value,
    minimumTemperatureCelsius: warm(value.minimumTemperatureCelsius),
    maximumTemperatureCelsius: warm(value.maximumTemperatureCelsius),
    et0Mm: value.et0Mm === null || value.et0Mm === undefined ? value.et0Mm : roundToTenth(value.et0Mm * factor),
  };
}

function withMoments(values: readonly WeatherDailyValue[]): WeatherDailyValue[] {
  return values.map((value) => ({ ...inSeason(value), ...(SPRING_FROST[value.date] ?? summerDrought(value.date) ?? {}) }));
}

export const demoSeasonWeatherProvider: WeatherProvider = {
  id: demonstrationWeatherProvider.id,
  sourceId: demonstrationWeatherProvider.sourceId,
  async searchLocations(query: string, postcode?: string | null) {
    const wanted = query.trim().toLowerCase();
    if (!wanted) return [];
    return CITIES.filter((city) => city.city.toLowerCase().includes(wanted) && (!postcode?.trim() || postcode.trim() === city.postcode));
  },
  async readForecast(input: WeatherReadInput) {
    return withMoments(await demonstrationWeatherProvider.readForecast(input));
  },
  async readReanalysis(input: WeatherReadInput) {
    return withMoments(await demonstrationWeatherProvider.readReanalysis(input));
  },
};
