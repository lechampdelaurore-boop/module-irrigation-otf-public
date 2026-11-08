import { logJsonLine } from '../log.ts';
import { secondsFromMilliseconds } from '../../domain/units.ts';
import { openMeteoWeatherProvider } from './open-meteo-provider.ts';
import {
  WeatherProviderError,
  type WeatherDailyValue,
  type WeatherLocationCandidate,
  type WeatherProvider,
  type WeatherReadInput,
} from '../../domain/weather/weather-provider.ts';

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;
type WeatherDataEndpoint = 'forecast' | 'reanalysis';
type WeatherLog = (level: 'info' | 'warn', entry: Record<string, unknown>) => void;
type CloudflareRequestInit = RequestInit & {
  cf?: {
    cacheEverything?: boolean;
    cacheTtlByStatus?: Record<string, number>;
  };
};

const EDGE_CACHE_SECONDS: Record<WeatherDataEndpoint, number> = {
  forecast: 30 * 60,
  reanalysis: 7 * 24 * 60 * 60,
};

/**
 * Fournisseur gratuit de pluie et d'ET0. Le géocodage français reste confié à
 * Open-Meteo, dont le service dédié n'est pas affecté par le quota Forecast.
 */
export class VisualCrossingWeatherProvider implements WeatherProvider {
  readonly id = 'visual-crossing';
  private readonly apiKey: string;
  private readonly fetchImpl: FetchLike;
  private readonly geocoder: Pick<WeatherProvider, 'searchLocations'>;
  private readonly log: WeatherLog;
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(
    apiKey: string,
    fetchImpl: FetchLike = fetch,
    geocoder: Pick<WeatherProvider, 'searchLocations'> = openMeteoWeatherProvider,
    log: WeatherLog = logJsonLine,
  ) {
    this.apiKey = apiKey.trim();
    this.fetchImpl = fetchImpl;
    this.geocoder = geocoder;
    this.log = log;
  }

  searchLocations(query: string, postcode?: string | null): Promise<WeatherLocationCandidate[]> {
    return this.geocoder.searchLocations(query, postcode);
  }

  readForecast(input: WeatherReadInput): Promise<WeatherDailyValue[]> {
    return this.readDaily('forecast', input);
  }

  readReanalysis(input: WeatherReadInput): Promise<WeatherDailyValue[]> {
    return this.readDaily('reanalysis', input);
  }

  private async readDaily(
    endpoint: WeatherDataEndpoint,
    input: WeatherReadInput,
  ): Promise<WeatherDailyValue[]> {
    if (!this.apiKey) {
      throw new WeatherProviderError('Configuration serveur absente : VISUAL_CROSSING_API_KEY', {
        kind: 'client', endpoint,
      });
    }
    const location = `${input.latitude},${input.longitude}`;
    const url = new URL(
      `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${encodeURIComponent(location)}/${input.startDate}/${input.endDate}`,
    );
    url.searchParams.set('unitGroup', 'metric');
    url.searchParams.set('include', 'days');
    url.searchParams.set(
      'elements',
      'datetime,precip,tempmax,tempmin,temp,dew,windspeedmean,solarenergy,elevation',
    );
    url.searchParams.set('contentType', 'json');
    url.searchParams.set('key', this.apiKey);
    const payload = await this.readJson(url, endpoint, input.bypassCache === true, input);
    if (!isRecord(payload) || !Array.isArray(payload.days)) {
      throw new WeatherProviderError('Réponse météo quotidienne invalide.', {
        kind: 'invalid-response', endpoint,
      });
    }
    const elevationMeters = finiteNumber(payload.elevation) ?? 0;
    return payload.days.flatMap((value): WeatherDailyValue[] => {
      if (!isRecord(value)) return [];
      const date = optionalText(value.datetime);
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
      return [{
        date,
        precipitationMm: nullableNonNegative(value.precip),
        minimumTemperatureCelsius: finiteNumber(value.tempmin),
        maximumTemperatureCelsius: finiteNumber(value.tempmax),
        solarEnergyMegajoulesPerSquareMeter: nullableNonNegative(value.solarenergy),
        et0Mm: calculateFao56Et0Mm({
          date,
          latitude: input.latitude,
          elevationMeters,
          meanTemperatureCelsius: finiteNumber(value.temp),
          minimumTemperatureCelsius: finiteNumber(value.tempmin),
          maximumTemperatureCelsius: finiteNumber(value.tempmax),
          dewPointCelsius: finiteNumber(value.dew),
          meanWindSpeedKilometersPerHour: finiteNumber(value.windspeedmean),
          solarEnergyMegajoulesPerSquareMeter: finiteNumber(value.solarenergy),
        }),
      }];
    });
  }

  private readJson(
    url: URL,
    endpoint: WeatherDataEndpoint,
    bypassCache: boolean,
    input: WeatherReadInput,
  ): Promise<unknown> {
    // La clé secrète n'est volontairement pas incluse dans la clé mémoire.
    const key = [
      bypassCache ? 'refresh' : 'cached', endpoint, input.latitude,
      input.longitude, input.startDate, input.endDate,
    ].join(':');
    const existing = this.inFlight.get(key);
    if (existing) {
      this.log('info', weatherLogEntry('weather_external_request_deduplicated', endpoint));
      return existing;
    }
    const request = this.fetchJson(url, endpoint, bypassCache);
    this.inFlight.set(key, request);
    void request.finally(() => {
      if (this.inFlight.get(key) === request) this.inFlight.delete(key);
    }).catch(() => undefined);
    return request;
  }

  private async fetchJson(
    url: URL,
    endpoint: WeatherDataEndpoint,
    bypassCache: boolean,
  ): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const init: CloudflareRequestInit = {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
        ...(bypassCache
          ? { cache: 'no-cache' as const }
          : {
              cf: {
                cacheEverything: true,
                cacheTtlByStatus: {
                  '200-299': EDGE_CACHE_SECONDS[endpoint],
                  '300-599': -1,
                },
              },
            }),
      };
      const response = await this.fetchImpl(url, init);
      const retryAfterSeconds = parseRetryAfter(response.headers.get('Retry-After'));
      if (!response.ok) {
        const providerReason = await readProviderReason(response);
        this.log('warn', {
          ...weatherLogEntry('weather_external_response', endpoint),
          status: response.status,
          retryAfterSeconds,
          providerReason,
        });
        throw weatherHttpError(response.status, endpoint, retryAfterSeconds, providerReason);
      }
      this.log('info', {
        ...weatherLogEntry('weather_external_response', endpoint),
        status: response.status,
        retryAfterSeconds,
      });
      return await response.json();
    } catch (error) {
      if (error instanceof WeatherProviderError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new WeatherProviderError('Le service météo met trop longtemps à répondre.', {
          kind: 'timeout', endpoint,
        });
      }
      throw new WeatherProviderError('Le service météo ne répond pas.', {
        kind: 'network', endpoint,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

type Fao56Et0Input = {
  date: string;
  latitude: number;
  elevationMeters: number;
  meanTemperatureCelsius: number | null;
  minimumTemperatureCelsius: number | null;
  maximumTemperatureCelsius: number | null;
  dewPointCelsius: number | null;
  meanWindSpeedKilometersPerHour: number | null;
  solarEnergyMegajoulesPerSquareMeter: number | null;
};

/** ET0 journalière FAO-56 Penman-Monteith, exprimée en mm/jour. */
export function calculateFao56Et0Mm(input: Fao56Et0Input): number | null {
  const {
    meanTemperatureCelsius: temperature,
    minimumTemperatureCelsius: minimumTemperature,
    maximumTemperatureCelsius: maximumTemperature,
    dewPointCelsius: dewPoint,
    meanWindSpeedKilometersPerHour: windKilometersPerHour,
    solarEnergyMegajoulesPerSquareMeter: solarRadiation,
  } = input;
  if (
    temperature === null || minimumTemperature === null || maximumTemperature === null
    || dewPoint === null || windKilometersPerHour === null || solarRadiation === null
  ) return null;

  const latitudeRadians = input.latitude * Math.PI / 180;
  const dayOfYear = utcDayOfYear(input.date);
  if (dayOfYear === null || Math.abs(input.latitude) > 90) return null;

  const saturationVaporPressure = (
    vaporPressure(maximumTemperature) + vaporPressure(minimumTemperature)
  ) / 2;
  const actualVaporPressure = vaporPressure(dewPoint);
  const slopeVaporPressureCurve = (
    4098 * vaporPressure(temperature)
  ) / Math.pow(temperature + 237.3, 2);
  const atmosphericPressure = 101.3 * Math.pow(
    (293 - 0.0065 * input.elevationMeters) / 293,
    5.26,
  );
  const psychrometricConstant = 0.000665 * atmosphericPressure;
  const windAtTenMeters = windKilometersPerHour / 3.6;
  const windAtTwoMeters = windAtTenMeters * 4.87 / Math.log(67.8 * 10 - 5.42);

  const inverseRelativeDistance = 1 + 0.033 * Math.cos(2 * Math.PI * dayOfYear / 365);
  const solarDeclination = 0.409 * Math.sin(2 * Math.PI * dayOfYear / 365 - 1.39);
  const sunsetHourAngle = Math.acos(clamp(
    -Math.tan(latitudeRadians) * Math.tan(solarDeclination),
    -1,
    1,
  ));
  const extraterrestrialRadiation = (24 * 60 / Math.PI) * 0.0820
    * inverseRelativeDistance
    * (
      sunsetHourAngle * Math.sin(latitudeRadians) * Math.sin(solarDeclination)
      + Math.cos(latitudeRadians) * Math.cos(solarDeclination) * Math.sin(sunsetHourAngle)
    );
  const clearSkyRadiation = (0.75 + 0.00002 * input.elevationMeters)
    * extraterrestrialRadiation;
  const netShortwaveRadiation = (1 - 0.23) * solarRadiation;
  const cloudinessFactor = 1.35 * clamp(
    clearSkyRadiation > 0 ? solarRadiation / clearSkyRadiation : 0,
    0.3,
    1,
  ) - 0.35;
  const netLongwaveRadiation = 4.903e-9
    * (Math.pow(maximumTemperature + 273.16, 4) + Math.pow(minimumTemperature + 273.16, 4)) / 2
    * (0.34 - 0.14 * Math.sqrt(Math.max(0, actualVaporPressure)))
    * cloudinessFactor;
  const netRadiation = netShortwaveRadiation - netLongwaveRadiation;
  const vaporPressureDeficit = Math.max(0, saturationVaporPressure - actualVaporPressure);
  const numerator = 0.408 * slopeVaporPressureCurve * netRadiation
    + psychrometricConstant * (900 / (temperature + 273)) * windAtTwoMeters
    * vaporPressureDeficit;
  const denominator = slopeVaporPressureCurve
    + psychrometricConstant * (1 + 0.34 * windAtTwoMeters);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return roundToHundredth(Math.max(0, numerator / denominator));
}

function vaporPressure(temperatureCelsius: number) {
  return 0.6108 * Math.exp(17.27 * temperatureCelsius / (temperatureCelsius + 237.3));
}

function utcDayOfYear(dateKey: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const date = new Date(`${dateKey}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== dateKey) return null;
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((date.getTime() - yearStart) / 86_400_000);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function roundToHundredth(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function weatherHttpError(
  status: number,
  endpoint: WeatherDataEndpoint,
  retryAfterSeconds: number | null,
  providerReason: string | null,
) {
  if (status === 429) {
    return new WeatherProviderError(
      'Service météo temporairement limité. Réessayez dans quelques instants.',
      { kind: 'rate-limit', status, retryAfterSeconds, endpoint, providerReason },
    );
  }
  if (status >= 500) {
    return new WeatherProviderError('Le service météo rencontre une erreur temporaire.', {
      kind: 'server', status, retryAfterSeconds, endpoint, providerReason,
    });
  }
  return new WeatherProviderError(`Requête météo refusée (statut ${status}).`, {
    kind: 'client', status, retryAfterSeconds, endpoint, providerReason,
  });
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return null;
  return Math.max(0, Math.ceil(secondsFromMilliseconds(date - Date.now())));
}

async function readProviderReason(response: Response): Promise<string | null> {
  try {
    const text = (await response.text()).slice(0, 500).trim();
    if (!text) return null;
    try {
      const payload: unknown = JSON.parse(text);
      if (isRecord(payload)) {
        return (optionalText(payload.message) ?? optionalText(payload.reason))?.slice(0, 240) ?? null;
      }
    } catch {
      // Visual Crossing renvoie aussi certaines erreurs en texte brut.
    }
    return text.slice(0, 240);
  } catch {
    return null;
  }
}

function weatherLogEntry(event: string, endpoint: WeatherDataEndpoint) {
  return {
    event,
    provider: 'visual-crossing',
    endpoint,
    requestedAt: new Date().toISOString(),
  };
}


function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function nullableNonNegative(value: unknown): number | null {
  const number = finiteNumber(value);
  return number !== null && number >= 0 ? number : null;
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
