import { logJsonLine } from '../log.ts';
import { secondsFromMilliseconds } from '../../domain/units.ts';
import {
  WeatherProviderError,
  type WeatherDailyValue,
  type WeatherLocationCandidate,
  type WeatherProvider,
  type WeatherReadInput,
} from '../../domain/weather/weather-provider.ts';

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;
type WeatherEndpoint = 'geocoding' | 'forecast' | 'reanalysis';
type WeatherLog = (level: 'info' | 'warn', entry: Record<string, unknown>) => void;
type CloudflareRequestInit = RequestInit & {
  cf?: {
    cacheEverything?: boolean;
    cacheTtlByStatus?: Record<string, number>;
  };
};

const EDGE_CACHE_SECONDS: Record<WeatherEndpoint, number> = {
  geocoding: 30 * 24 * 60 * 60,
  forecast: 30 * 60,
  reanalysis: 7 * 24 * 60 * 60,
};

export class OpenMeteoWeatherProvider implements WeatherProvider {
  readonly id = 'open-meteo';
  private readonly fetchImpl: FetchLike;
  private readonly log: WeatherLog;
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(fetchImpl: FetchLike = fetch, log: WeatherLog = logJsonLine) {
    this.fetchImpl = fetchImpl;
    this.log = log;
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
    return time.flatMap((date, index): WeatherDailyValue[] => {
      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
      return [{
        date,
        precipitationMm: nullableNonNegative(Array.isArray(precipitation) ? precipitation[index] : null),
        et0Mm: nullableNonNegative(Array.isArray(et0) ? et0[index] : null),
      }];
    });
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

export const openMeteoWeatherProvider = new OpenMeteoWeatherProvider();

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
