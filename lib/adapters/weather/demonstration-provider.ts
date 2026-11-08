import { addDaysToDateKey } from '../../domain/water-management.ts';
import type {
  WeatherDailyValue,
  WeatherLocationCandidate,
  WeatherProvider,
  WeatherReadInput,
} from '../../domain/weather/weather-provider.ts';

/**
 * Fournisseur météo de démonstration, sans réseau, retenu par
 * `WEATHER_DATA_SOURCE=mock` (docs/browser-journeys-contract.md). Il existe pour
 * que les parcours navigateur soient reproductibles : les vrais fournisseurs
 * changent de valeurs d'un jour à l'autre, ce qui ferait varier les besoins
 * affichés et rendrait les vérifications instables.
 *
 * Les valeurs ne dépendent que de la date, jamais de l'heure ni d'un tirage :
 * une même journée rend toujours la même pluie et la même ET0, aujourd'hui
 * comme dans six mois. La série est volontairement variée, avec des journées
 * sèches, des pluies faibles et une averse marquée, afin que les parcours ne
 * travaillent pas sur une semaine uniformément vide.
 */
const DEMONSTRATION_CITY: WeatherLocationCandidate = {
  displayName: 'Rennes (35000)',
  city: 'Rennes',
  postcode: '35000',
  latitude: 48.1113,
  longitude: -1.6800,
  timezone: 'Europe/Paris',
  countryCode: 'FR',
};

// Millimètres de pluie par jour du mois, motif de sept valeurs répété.
const RAIN_PATTERN_MM = [0, 0, 2.4, 0, 11.6, 0.8, 0] as const;
// ET0 par jour du mois, motif de cinq valeurs : une évapotranspiration d'arrière-saison.
const ET0_PATTERN_MM = [3.1, 2.8, 3.4, 2.2, 3.9] as const;
// Températures minimale et maximale, motif de six valeurs, avec une nuit sous 5 °C pour les alertes météo.
const MINIMUM_TEMPERATURE_PATTERN_CELSIUS = [7.5, 4.2, 9.1, 11.3, 6.8, 2.6] as const;
const MAXIMUM_TEMPERATURE_PATTERN_CELSIUS = [18.4, 15.9, 21.2, 24.7, 19.3, 13.8] as const;
/** L'énergie solaire du jour, en MJ/m² : des jours couverts et des jours clairs, pour les aspersions à reconsidérer. */
const SOLAR_ENERGY_PATTERN_MJ = [8.2, 4.1, 12.6, 15.3, 6.4, 3.2] as const;

function dayIndex(date: string): number {
  const day = Number(date.slice(8, 10));
  const month = Number(date.slice(5, 7));
  return Number.isFinite(day) && Number.isFinite(month) ? day + month : 0;
}

function valuesForRange(input: WeatherReadInput): WeatherDailyValue[] {
  const values: WeatherDailyValue[] = [];
  for (let date = input.startDate; date <= input.endDate; date = addDaysToDateKey(date, 1)) {
    const index = dayIndex(date);
    values.push({
      date,
      precipitationMm: RAIN_PATTERN_MM[index % RAIN_PATTERN_MM.length],
      et0Mm: ET0_PATTERN_MM[index % ET0_PATTERN_MM.length],
      minimumTemperatureCelsius: MINIMUM_TEMPERATURE_PATTERN_CELSIUS[index % MINIMUM_TEMPERATURE_PATTERN_CELSIUS.length],
      maximumTemperatureCelsius: MAXIMUM_TEMPERATURE_PATTERN_CELSIUS[index % MAXIMUM_TEMPERATURE_PATTERN_CELSIUS.length],
      solarEnergyMegajoulesPerSquareMeter: SOLAR_ENERGY_PATTERN_MJ[index % SOLAR_ENERGY_PATTERN_MJ.length],
    });
    // Une plage inversée ou absurde ne doit pas produire une boucle infinie.
    if (values.length > 400) break;
  }
  return values;
}

export const demonstrationWeatherProvider: WeatherProvider = {
  id: 'demonstration',
  sourceId: () => 'demonstration',
  async searchLocations(query: string, postcode?: string | null) {
    const wanted = query.trim().toLowerCase();
    if (!wanted) return [];
    const matchesCity = DEMONSTRATION_CITY.city.toLowerCase().includes(wanted);
    const matchesPostcode = !postcode?.trim() || postcode.trim() === DEMONSTRATION_CITY.postcode;
    return matchesCity && matchesPostcode ? [DEMONSTRATION_CITY] : [];
  },
  async readForecast(input: WeatherReadInput) {
    return valuesForRange(input);
  },
  async readReanalysis(input: WeatherReadInput) {
    return valuesForRange(input);
  },
};
