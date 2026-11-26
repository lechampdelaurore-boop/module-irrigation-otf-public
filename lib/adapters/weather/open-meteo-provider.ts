import { logJsonLine } from '../log.ts';
import { describeNetworkError, globalFetch, type FetchLike } from '../network-call.ts';
import { secondsFromMilliseconds } from '../../domain/units.ts';
import {
  COMPLETION_FORECAST_MODEL_ID,
  forecastDaysForModel,
  forecastModel,
  type ModelForecastDay,
  type ModelForecastReader,
} from '../../domain/weather/forecast-models.ts';
import { hourlyValuesInLocalOrder } from '../../domain/weather/hourly-et0.ts';
import {
  WeatherProviderError,
  type WeatherDailyValue,
  type WeatherLocationCandidate,
  type WeatherProvider,
  type WeatherReadInput,
} from '../../domain/weather/weather-provider.ts';

type WeatherEndpoint = 'geocoding' | 'forecast' | 'reanalysis';
type WeatherLog = (level: 'info' | 'warn', entry: Record<string, unknown>) => void;
type CloudflareRequestInit = RequestInit & {
  cf?: {
    cacheEverything?: boolean;
    cacheTtlByStatus?: Record<string, number>;
  };
};

/**
 * L'accès à l'API de prévision par modèle (docs/weather-models-contract.md,
 * § 10) : l'offre gratuite par défaut ; une offre payante change l'adresse
 * (`customer-api…`) et ajoute la clé, par réglage serveur seulement
 * (`OPEN_METEO_API_BASE_URL`, `OPEN_METEO_API_KEY`), sans changer une règle.
 * La clé n'est jamais journalisée.
 */
export type OpenMeteoAccess = { baseUrl?: string | null; apiKey?: string | null };

const FREE_FORECAST_BASE_URL = 'https://api.open-meteo.com';

/** Les cinq séries du jour lues pour un modèle (contrat, § 5). */
const MODEL_DAILY_SERIES = {
  precipitationMm: 'precipitation_sum',
  minimumTemperatureCelsius: 'temperature_2m_min',
  maximumTemperatureCelsius: 'temperature_2m_max',
  et0Mm: 'et0_fao_evapotranspiration',
  solarEnergyMegajoulesPerSquareMeter: 'shortwave_radiation_sum',
} as const;

/**
 * L'ET0 heure par heure, demandée dans le même appel que les jours de la
 * prévision (docs/et0-horaire-contract.md, § 2 choix 8 ; D-349) : aucun appel
 * de plus. Elle ne sert qu'à la forme de la journée ; une série absente ou
 * incomplète ne refuse jamais la lecture du jour.
 */
const HOURLY_ET0_SERIES = 'et0_fao_evapotranspiration';

const EDGE_CACHE_SECONDS: Record<WeatherEndpoint, number> = {
  geocoding: 30 * 24 * 60 * 60,
  forecast: 30 * 60,
  reanalysis: 7 * 24 * 60 * 60,
};

export class OpenMeteoWeatherProvider implements WeatherProvider, ModelForecastReader {
  readonly id = 'open-meteo';
  private readonly fetchImpl: FetchLike;
  private readonly log: WeatherLog;
  private readonly access: OpenMeteoAccess;
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(fetchImpl: FetchLike = globalFetch, log: WeatherLog = logJsonLine, access: OpenMeteoAccess = {}) {
    this.fetchImpl = fetchImpl;
    this.log = log;
    this.access = access;
  }

  async searchLocations(query: string, postcode?: string | null): Promise<WeatherLocationCandidate[]> {
    const normalized = query.trim();
    const requestedPostcode = postcode?.trim() || null;
    if (normalized.length < 2) return [];
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
    url.searchParams.set('name', normalized);
    url.searchParams.set('count', requestedPostcode ? '100' : '8');
    url.searchParams.set('language', 'fr');
    url.searchParams.set('format', 'json');
    url.searchParams.set('countryCode', 'FR');
    const payload = await this.readJson(url, 'geocoding');
    const results = isRecord(payload) && Array.isArray(payload.results)
      ? payload.results
      : [];
    return results.flatMap((value): WeatherLocationCandidate[] => {
      if (!isRecord(value)) return [];
      const latitude = finiteNumber(value.latitude);
      const longitude = finiteNumber(value.longitude);
      const city = optionalText(value.name);
      if (latitude === null || longitude === null || !city) return [];
      const admin = optionalText(value.admin1);
      const postcodes = Array.isArray(value.postcodes)
        ? value.postcodes.map(optionalText).filter((item): item is string => item !== null)
        : (optionalText(value.postcodes)?.split(',').map((item) => item.trim()) ?? []);
      const singlePostcode = optionalText(value.postcode);
      if (singlePostcode) postcodes.push(singlePostcode);
      if (requestedPostcode && !postcodes.includes(requestedPostcode)) return [];
      const postcodeValue = requestedPostcode ?? postcodes[0] ?? null;
      return [{
        displayName: [city, postcodeValue, admin].filter(Boolean).join(' · '),
        city,
        postcode: postcodeValue,
        latitude,
        longitude,
        timezone: optionalText(value.timezone) ?? 'Europe/Paris',
        countryCode: optionalText(value.country_code) ?? 'FR',
      }];
    });
  }

  readForecast(input: WeatherReadInput): Promise<WeatherDailyValue[]> {
    return this.readDaily('https://api.open-meteo.com/v1/forecast', 'forecast', input);
  }

  readReanalysis(input: WeatherReadInput): Promise<WeatherDailyValue[]> {
    return this.readDaily('https://archive-api.open-meteo.com/v1/archive', 'reanalysis', input);
  }

  /**
   * La prévision d'un modèle choisi (contrat, § 3 règles 4 à 6, § 5) : un seul
   * appel demande le modèle et « Automatique d'Open-Meteo », qui complète les
   * jours au-delà de sa portée. L'analyse est stricte : une série attendue
   * absente, ou d'une autre longueur que les dates, refuse toute la réponse
   * (`invalid-response`), jamais un zéro ; une valeur nulle reste nulle.
   */
  async readModelForecast(input: WeatherReadInput, modelId: string): Promise<ModelForecastDay[]> {
    if (forecastModel(modelId) === null) {
      throw new WeatherProviderError('Modèle de prévision inconnu.', { kind: 'client', endpoint: 'forecast' });
    }
    const models = modelId === COMPLETION_FORECAST_MODEL_ID ? [modelId] : [modelId, COMPLETION_FORECAST_MODEL_ID];
    const url = new URL('/v1/forecast', this.forecastBaseUrl());
    url.searchParams.set('latitude', String(input.latitude));
    url.searchParams.set('longitude', String(input.longitude));
    url.searchParams.set('timezone', input.timezone);
    url.searchParams.set('start_date', input.startDate);
    url.searchParams.set('end_date', input.endDate);
    url.searchParams.set('daily', Object.values(MODEL_DAILY_SERIES).join(','));
    url.searchParams.set('hourly', HOURLY_ET0_SERIES);
    url.searchParams.set('models', models.join(','));
    const apiKey = this.access.apiKey?.trim();
    if (apiKey) url.searchParams.set('apikey', apiKey);
    const payload = await this.readJson(url, 'forecast', input.bypassCache === true);
    const [chosen, completion] = models.map((model) => withHourlyEt0(
      readModelDays(payload, model, models.length > 1),
      payload,
      models.length > 1 ? `${HOURLY_ET0_SERIES}_${model}` : HOURLY_ET0_SERIES,
      input.timezone,
    ));
    return forecastDaysForModel(modelId, chosen ?? [], completion ?? chosen ?? []);
  }

  private forecastBaseUrl(): URL {
    const configured = this.access.baseUrl?.trim();
    if (!configured) return new URL(FREE_FORECAST_BASE_URL);
    let url: URL | null = null;
    try {
      url = new URL(configured);
    } catch {
      url = null;
    }
    // Une adresse illisible ou non chiffrée n'est jamais appelée : la lecture du modèle échoue, rien d'autre.
    if (url === null || url.protocol !== 'https:' || url.username || url.password) {
      throw new WeatherProviderError('Configuration serveur invalide : OPEN_METEO_API_BASE_URL', {
        kind: 'client', endpoint: 'forecast',
      });
    }
    return url;
  }

  private async readDaily(
    endpoint: string,
    endpointKind: Exclude<WeatherEndpoint, 'geocoding'>,
    input: WeatherReadInput,
  ): Promise<WeatherDailyValue[]> {
    const url = new URL(endpoint);
    url.searchParams.set('latitude', String(input.latitude));
    url.searchParams.set('longitude', String(input.longitude));
    url.searchParams.set('timezone', input.timezone);
    url.searchParams.set('start_date', input.startDate);
    url.searchParams.set('end_date', input.endDate);
    url.searchParams.set('daily', 'precipitation_sum,et0_fao_evapotranspiration');
    if (endpointKind === 'forecast') url.searchParams.set('hourly', HOURLY_ET0_SERIES);
    const payload = await this.readJson(url, endpointKind, input.bypassCache === true);
    if (!isRecord(payload) || !isRecord(payload.daily)) {
      throw new WeatherProviderError('Réponse météo quotidienne invalide.', {
        kind: 'invalid-response', endpoint: endpointKind,
      });
    }
    const time = payload.daily.time;
    const precipitation = payload.daily.precipitation_sum;
    const et0 = payload.daily.et0_fao_evapotranspiration;
    if (!Array.isArray(time)) {
      throw new WeatherProviderError('Dates météo absentes.', {
        kind: 'invalid-response', endpoint: endpointKind,
      });
    }
    const days = time.flatMap((date, index): WeatherDailyValue[] => {
      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
      return [{
        date,
        precipitationMm: nullableNonNegative(Array.isArray(precipitation) ? precipitation[index] : null),
        et0Mm: nullableNonNegative(Array.isArray(et0) ? et0[index] : null),
      }];
    });
    return endpointKind === 'forecast' ? withHourlyEt0(days, payload, HOURLY_ET0_SERIES, input.timezone) : days;
  }

  private readJson(
    url: URL,
    endpoint: WeatherEndpoint,
    bypassCache = false,
  ): Promise<unknown> {
    const key = `${bypassCache ? 'refresh' : 'cached'}:${url.toString()}`;
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
    endpoint: WeatherEndpoint,
    bypassCache: boolean,
  ): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    const startedAt = Date.now();
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
      // Appelée seule, jamais comme méthode de l'adaptateur : un `fetch` natif
      // injecté refuserait d'être appelé ainsi dans un Worker (D-164).
      const send = this.fetchImpl;
      const response = await send(url, init);
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
      const timedOut = controller.signal.aborted
        || (error instanceof Error && error.name === 'AbortError');
      // La vraie erreur, sans adresse, avec le temps écoulé : « réseau » seul ne dit pas pourquoi (D-164).
      this.log('warn', {
        ...weatherLogEntry('weather_external_failure', endpoint),
        failure: timedOut ? 'timeout' : 'network',
        elapsedMs: Date.now() - startedAt,
        ...describeNetworkError(error),
      });
      if (timedOut) {
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

export const openMeteoWeatherProvider = new OpenMeteoWeatherProvider();

/**
 * Les jours d'un modèle dans une réponse à un ou plusieurs modèles : à deux
 * modèles ou plus, chaque série est suffixée par le modèle
 * (`precipitation_sum_meteofrance_seamless`) ; à un seul, elle ne l'est pas
 * (essai A, contrat § 14, point 1).
 */
function readModelDays(payload: unknown, model: string, suffixed: boolean): WeatherDailyValue[] {
  if (!isRecord(payload) || !isRecord(payload.daily) || !Array.isArray(payload.daily.time)) {
    throw new WeatherProviderError('Réponse météo quotidienne invalide.', { kind: 'invalid-response', endpoint: 'forecast' });
  }
  const daily = payload.daily;
  const time = payload.daily.time;
  const series = Object.fromEntries(Object.entries(MODEL_DAILY_SERIES).map(([field, variable]) => {
    const key = suffixed ? `${variable}_${model}` : variable;
    const values = daily[key];
    if (!Array.isArray(values) || values.length !== time.length) {
      throw new WeatherProviderError(`Série météo absente ou incomplète : ${key}.`, {
        kind: 'invalid-response', endpoint: 'forecast',
      });
    }
    return [field, values];
  })) as Record<keyof typeof MODEL_DAILY_SERIES, unknown[]>;
  return time.flatMap((date, index): WeatherDailyValue[] => {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new WeatherProviderError('Date météo illisible.', { kind: 'invalid-response', endpoint: 'forecast' });
    }
    return [{
      date,
      precipitationMm: nullableNonNegative(series.precipitationMm[index]),
      et0Mm: nullableNonNegative(series.et0Mm[index]),
      minimumTemperatureCelsius: finiteNumber(series.minimumTemperatureCelsius[index]),
      maximumTemperatureCelsius: finiteNumber(series.maximumTemperatureCelsius[index]),
      solarEnergyMegajoulesPerSquareMeter: nullableNonNegative(series.solarEnergyMegajoulesPerSquareMeter[index]),
    }];
  });
}

/**
 * Joint à chaque jour ses heures d'ET0 du fournisseur (source
 * `provider-hourly`, D-349), rangées par heure d'horloge du lieu. Un jour
 * dont les heures manquent, ou ne sont pas en même nombre que les heures du
 * jour du lieu, n'en reçoit pas (F1038) : la forme passera à la source
 * suivante, jamais un décalage ni un zéro.
 */
function withHourlyEt0(days: WeatherDailyValue[], payload: unknown, seriesKey: string, timeZone: string): WeatherDailyValue[] {
  if (!isRecord(payload) || !isRecord(payload.hourly)) return days;
  const time = payload.hourly.time;
  const values = payload.hourly[seriesKey];
  if (!Array.isArray(time) || !Array.isArray(values)) return days;
  return days.map((day) => {
    const valuesMm = hourlyValuesInLocalOrder(day.date, timeZone, time, values);
    return valuesMm ? { ...day, hourlyEt0: { nature: 'provider-hourly' as const, valuesMm } } : day;
  });
}

function weatherHttpError(
  status: number,
  endpoint: WeatherEndpoint,
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
    const text = (await response.text()).slice(0, 500);
    if (!text) return null;
    const payload: unknown = JSON.parse(text);
    return isRecord(payload) ? optionalText(payload.reason)?.slice(0, 240) ?? null : null;
  } catch {
    return null;
  }
}

function weatherLogEntry(event: string, endpoint: WeatherEndpoint) {
  return {
    event,
    provider: 'open-meteo',
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
