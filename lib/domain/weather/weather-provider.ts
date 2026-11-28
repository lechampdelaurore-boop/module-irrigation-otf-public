import type { HourlyEt0Series } from './hourly-et0.ts';

export type WeatherLocationCandidate = {
  displayName: string;
  city: string;
  postcode: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
  countryCode: string;
};

export type WeatherDailyValue = {
  date: string;
  precipitationMm: number | null;
  et0Mm: number | null;
  /**
   * Températures de l'air prévues du jour, lues pour les alertes météo
   * (docs/weather-alerts-contract.md) ; absentes quand le fournisseur ne les
   * donne pas, et alors jamais lues comme 0 (D-003).
   */
  minimumTemperatureCelsius?: number | null;
  maximumTemperatureCelsius?: number | null;
  /**
   * L'énergie solaire prévue du jour, en MJ/m², lue pour les aspersions à
   * reconsidérer (docs/weather-crop-alerts-contract.md) ; absente, jamais
   * lue comme 0 (D-003).
   */
  solarEnergyMegajoulesPerSquareMeter?: number | null;
  /**
   * Les heures d'ET0 du jour, lues chez le fournisseur ou calculées par le
   * module, pour la forme de la journée seulement (docs/et0-horaire-contract.md,
   * D-349) ; absentes quand le fournisseur ne donne pas l'heure. Elles ne
   * s'écrivent jamais dans la ligne du jour ni dans l'archive : seule la
   * forme, J0 à J+2, va dans sa table.
   */
  hourlyEt0?: HourlyEt0Series | null;
};

/** Un jour qui porte au moins une valeur s'écrit ; un jour entièrement vide n'efface rien. */
export function hasWeatherValue(value: WeatherDailyValue): boolean {
  return value.precipitationMm !== null
    || value.et0Mm !== null
    || (value.minimumTemperatureCelsius ?? null) !== null
    || (value.maximumTemperatureCelsius ?? null) !== null
    || (value.solarEnergyMegajoulesPerSquareMeter ?? null) !== null;
}

export type WeatherReadInput = {
  latitude: number;
  longitude: number;
  timezone: string;
  startDate: string;
  endDate: string;
  bypassCache?: boolean;
};

export interface WeatherProvider {
  readonly id: string;
  sourceId?(endpoint: 'geocoding' | 'forecast' | 'reanalysis'): string;
  searchLocations(query: string, postcode?: string | null): Promise<WeatherLocationCandidate[]>;
  readForecast(input: WeatherReadInput): Promise<WeatherDailyValue[]>;
  readReanalysis(input: WeatherReadInput): Promise<WeatherDailyValue[]>;
}

export class WeatherProviderError extends Error {
  readonly kind: 'rate-limit' | 'timeout' | 'network' | 'server' | 'client' | 'invalid-response';
  readonly status: number | null;
  readonly retryAfterSeconds: number | null;
  readonly endpoint: 'geocoding' | 'forecast' | 'reanalysis' | null;
  readonly providerReason: string | null;

  constructor(message: string, options: {
    kind?: WeatherProviderError['kind'];
    status?: number | null;
    retryAfterSeconds?: number | null;
    endpoint?: WeatherProviderError['endpoint'];
    providerReason?: string | null;
  } = {}) {
    super(message);
    this.name = 'WeatherProviderError';
    this.kind = options.kind ?? 'invalid-response';
    this.status = options.status ?? null;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
    this.endpoint = options.endpoint ?? null;
    this.providerReason = options.providerReason ?? null;
  }
}
