import { logJsonLine } from '../../adapters/log.ts';
import { millisecondsFromSeconds } from '../../domain/units.ts';
import { WeatherProviderError, type WeatherDailyValue, type WeatherProvider } from '../../domain/weather/weather-provider.ts';

export type { WeatherSyncLocation } from '../../domain/weather/automatic-sync-contract.ts';
import type { WeatherSyncLocation } from '../../domain/weather/automatic-sync-contract.ts';

type WeatherSyncRange = {
  startDate: string;
  endDate: string;
} | null;

export type WeatherSyncRanges = {
  forecast: WeatherSyncRange;
  reanalysis: WeatherSyncRange;
};

type WeatherEndpointResult =
  | { status: 'fulfilled'; values: WeatherDailyValue[] }
  | { status: 'rejected'; error: unknown };

export type WeatherFetchOutcome = {
  forecast: WeatherEndpointResult;
  reanalysis: WeatherEndpointResult;
};

export type WeatherSyncLogger = (
  level: 'info' | 'warn',
  entry: Record<string, unknown>,
) => void;

export type WeatherRetryOptions = {
  maxAttempts?: number;
  sleep?: (delayMs: number) => Promise<void>;
};

export async function fetchWeatherForLocation({
  location,
  ranges,
  provider,
  bypassCache,
  retry,
  log = logJsonLine,
}: {
  location: WeatherSyncLocation;
  ranges: WeatherSyncRanges;
  provider: WeatherProvider;
  bypassCache: boolean;
  retry?: WeatherRetryOptions;
  log?: WeatherSyncLogger;
}): Promise<WeatherFetchOutcome> {
  const [forecast, reanalysis] = await Promise.all([
    readEndpoint('forecast', ranges.forecast, location, provider, bypassCache, retry, log),
    readEndpoint('reanalysis', ranges.reanalysis, location, provider, bypassCache, retry, log),
  ]);
  return { forecast, reanalysis };
}

export function weatherOutcomeError(
  outcome: WeatherFetchOutcome,
  fallback = 'Actualisation météo partielle.',
): string | null {
  const failure = outcome.forecast.status === 'rejected'
    ? outcome.forecast.error
    : outcome.reanalysis.status === 'rejected'
      ? outcome.reanalysis.error
      : null;
  return failure instanceof Error ? failure.message : failure === null ? null : fallback;
}

export function weatherOutcomeNotBeforeAt(
  outcome: WeatherFetchOutcome,
  now: Date,
): string | null {
  const failures = [outcome.forecast, outcome.reanalysis]
    .filter((result): result is Extract<WeatherEndpointResult, { status: 'rejected' }> => (
      result.status === 'rejected'
    ));
  const retryAfterSeconds = failures.reduce((maximum, result) => {
    const error = result.error;
    if (!(error instanceof WeatherProviderError) || error.kind !== 'rate-limit') return maximum;
    return Math.max(maximum, Math.max(30, error.retryAfterSeconds ?? 60));
  }, 0);
  return retryAfterSeconds > 0
    ? new Date(now.getTime() + millisecondsFromSeconds(retryAfterSeconds)).toISOString()
    : null;
}

export function weatherOutcomeSucceeded(outcome: WeatherFetchOutcome) {
  return outcome.forecast.status === 'fulfilled' && outcome.reanalysis.status === 'fulfilled';
}

export function weatherLocationDeduplicationKey(location: WeatherSyncLocation) {
  return [
    location.latitude.toFixed(6),
    location.longitude.toFixed(6),
    location.timezone,
  ].join(':');
}

async function readEndpoint(
  endpoint: 'forecast' | 'reanalysis',
  range: WeatherSyncRange,
  location: WeatherSyncLocation,
  provider: WeatherProvider,
  bypassCache: boolean,
  retry: WeatherRetryOptions | undefined,
  log: WeatherSyncLogger,
): Promise<WeatherEndpointResult> {
  if (!range) return { status: 'fulfilled', values: [] };
  try {
    const values = await withControlledRetry(
      () => provider[endpoint === 'forecast' ? 'readForecast' : 'readReanalysis']({
        latitude: location.latitude,
        longitude: location.longitude,
        timezone: location.timezone,
        ...range,
        bypassCache,
      }),
      endpoint,
      retry,
      log,
    );
    return { status: 'fulfilled', values };
  } catch (error) {
    return { status: 'rejected', error };
  }
}

async function withControlledRetry<T>(
  operation: () => Promise<T>,
  endpoint: 'forecast' | 'reanalysis',
  options: WeatherRetryOptions | undefined,
  log: WeatherSyncLogger,
): Promise<T> {
  const maxAttempts = Math.max(1, Math.min(3, options?.maxAttempts ?? 3));
  const sleep = options?.sleep ?? wait;
  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      return await operation();
    } catch (error) {
      if (attempt >= maxAttempts || !isRetriableWeatherError(error)) throw error;
      const delayMs = weatherRetryDelayMs(error, attempt);
      log('warn', {
        event: 'weather_external_retry_scheduled',
        endpoint,
        attempt,
        delayMs,
        errorKind: error instanceof WeatherProviderError ? error.kind : 'unknown',
      });
      await sleep(delayMs);
    }
  }
  throw new Error('Tentatives météo épuisées.');
}

function isRetriableWeatherError(error: unknown) {
  return error instanceof WeatherProviderError
    && ['rate-limit', 'timeout', 'network', 'server'].includes(error.kind);
}

function weatherRetryDelayMs(error: unknown, failedAttempt: number) {
  if (error instanceof WeatherProviderError && error.kind === 'rate-limit') {
    return Math.min(2_000, Math.max(250, millisecondsFromSeconds(error.retryAfterSeconds ?? 1)));
  }
  return Math.min(2_000, 250 * (2 ** Math.max(0, failedAttempt - 1)));
}

function wait(delayMs: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}
