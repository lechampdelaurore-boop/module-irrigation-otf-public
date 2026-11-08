import { logJsonLine } from '../../adapters/log.ts';
import { millisecondsFromMinutes } from '../../domain/units.ts';
import { dateKeyInTimeZone } from '../../domain/water-management.ts';
import { automaticWeatherRequestRanges } from '../../domain/weather/cache-policy.ts';
import {
  fetchWeatherForLocation,
  weatherLocationDeduplicationKey,
  weatherOutcomeError,
  weatherOutcomeNotBeforeAt,
  weatherOutcomeSucceeded,
  type WeatherFetchOutcome,
  type WeatherRetryOptions,
  type WeatherSyncLogger,
} from './sync-engine.ts';
import type { WeatherProvider } from '../../domain/weather/weather-provider.ts';

export type { AutomaticWeatherSyncRepository, AutomaticWeatherTarget } from '../../domain/weather/automatic-sync-contract.ts';
import type { AutomaticWeatherSyncRepository, AutomaticWeatherTarget } from '../../domain/weather/automatic-sync-contract.ts';

export type AutomaticWeatherSyncResult = {
  status: 'completed' | 'already-running';
  targets: number;
  locations: number;
  skippedBackoff: number;
  successfulTargets: number;
  failedTargets: number;
  forecastRequests: number;
  reanalysisRequests: number;
};

const AUTOMATIC_LOCK_MS = millisecondsFromMinutes(10);

/** Appelé après chaque écriture réussie de prévisions d'une exploitation : les alertes météo (5 bis). */
export type ForecastWrittenHandler = (input: { workspaceId: string; locationKey: string; now: Date }) => Promise<void>;

export async function runAutomaticWeatherSync({
  repository,
  provider,
  now = new Date(),
  retry,
  log = logJsonLine,
  onForecastWritten,
}: {
  repository: AutomaticWeatherSyncRepository;
  provider: WeatherProvider;
  now?: Date;
  retry?: WeatherRetryOptions;
  log?: WeatherSyncLogger;
  onForecastWritten?: ForecastWrittenHandler;
}): Promise<AutomaticWeatherSyncResult> {
  const at = now.toISOString();
  const token = await repository.claimJob(
    at,
    new Date(now.getTime() + AUTOMATIC_LOCK_MS).toISOString(),
  );
  if (!token) return emptyResult('already-running');

  let finalResult = emptyResult('completed');
  let finalError: string | null = null;
  try {
    const targets = await repository.listTargets();
    const eligible = targets.filter((target) => !target.refreshNotBeforeAt
      || Date.parse(target.refreshNotBeforeAt) <= now.getTime());
    const groups = groupTargetsByLocation(eligible);
    finalResult = {
      ...finalResult,
      targets: targets.length,
      locations: groups.size,
      skippedBackoff: targets.length - eligible.length,
    };

    log('info', {
      event: 'weather_automatic_sync_started',
      startedAt: at,
      targets: targets.length,
      locations: groups.size,
      skippedBackoff: finalResult.skippedBackoff,
    });

    for (const groupedTargets of groups.values()) {
      const representative = groupedTargets[0];
      const today = dateKeyInTimeZone(now, representative.timezone);
      const ranges = automaticWeatherRequestRanges({ today });
      log('info', {
        event: 'weather_automatic_location_started',
        locationKey: representative.locationKey,
        provider: provider.id,
        workspaceCount: groupedTargets.length,
        forecastRange: ranges.forecast,
        reanalysisRange: ranges.reanalysis,
        cacheMode: 'forced-refresh',
      });
      const outcome = await fetchWeatherForLocation({
        location: representative,
        ranges,
        provider,
        bypassCache: true,
        retry,
        log,
      });
      finalResult.forecastRequests += ranges.forecast ? 1 : 0;
      finalResult.reanalysisRequests += ranges.reanalysis ? 1 : 0;
      await persistOutcomeForTargets({
        repository,
        provider,
        targets: groupedTargets,
        outcome,
        at,
        now,
        onForecastWritten,
      });
      if (weatherOutcomeSucceeded(outcome)) {
        finalResult.successfulTargets += groupedTargets.length;
      } else {
        finalResult.failedTargets += groupedTargets.length;
        finalError ??= weatherOutcomeError(outcome);
      }
      log(weatherOutcomeSucceeded(outcome) ? 'info' : 'warn', {
        event: 'weather_automatic_location_completed',
        locationKey: representative.locationKey,
        provider: provider.id,
        workspaceCount: groupedTargets.length,
        forecastDaysReceived: outcome.forecast.status === 'fulfilled'
          ? outcome.forecast.values.length
          : 0,
        reanalysisDaysReceived: outcome.reanalysis.status === 'fulfilled'
          ? outcome.reanalysis.values.length
          : 0,
        failedEndpoints: [
          outcome.forecast.status === 'rejected' ? 'forecast' : null,
          outcome.reanalysis.status === 'rejected' ? 'reanalysis' : null,
        ].filter(Boolean),
        completedAt: new Date().toISOString(),
      });
    }

    log(finalResult.failedTargets > 0 ? 'warn' : 'info', {
      event: 'weather_automatic_sync_completed',
      completedAt: new Date().toISOString(),
      ...finalResult,
    });
    return finalResult;
  } catch (error) {
    finalError = error instanceof Error ? error.message : 'Synchronisation météo automatique impossible.';
    log('warn', {
      event: 'weather_automatic_sync_failed',
      failedAt: new Date().toISOString(),
      error: finalError,
    });
    throw error;
  } finally {
    await repository.finishJob({
      token,
      at: new Date().toISOString(),
      successful: finalError === null,
      error: finalError,
    });
  }
}

function groupTargetsByLocation(targets: readonly AutomaticWeatherTarget[]) {
  const groups = new Map<string, AutomaticWeatherTarget[]>();
  for (const target of targets) {
    const key = weatherLocationDeduplicationKey(target);
    const group = groups.get(key) ?? [];
    group.push(target);
    groups.set(key, group);
  }
  return groups;
}

async function persistOutcomeForTargets({
  repository,
  provider,
  targets,
  outcome,
  at,
  now,
  onForecastWritten,
}: {
  repository: AutomaticWeatherSyncRepository;
  provider: WeatherProvider;
  targets: readonly AutomaticWeatherTarget[];
  outcome: WeatherFetchOutcome;
  at: string;
  now: Date;
  onForecastWritten?: ForecastWrittenHandler;
}) {
  const error = weatherOutcomeError(outcome);
  const successful = weatherOutcomeSucceeded(outcome);
  const notBeforeAt = weatherOutcomeNotBeforeAt(outcome, now);
  for (const target of targets) {
    if (outcome.forecast.status === 'fulfilled') {
      await repository.upsertValues({
        target,
        kind: 'forecast',
        values: outcome.forecast.values,
        source: provider.sourceId?.('forecast') ?? provider.id,
        fetchedAt: at,
      });
      if (outcome.forecast.values.length > 0) {
        await onForecastWritten?.({ workspaceId: target.workspaceId, locationKey: target.locationKey, now });
      }
    }
    if (outcome.reanalysis.status === 'fulfilled') {
      await repository.upsertValues({
        target,
        kind: 'reanalysis',
        values: outcome.reanalysis.values,
        source: provider.sourceId?.('reanalysis') ?? provider.id,
        fetchedAt: at,
      });
    }
    await repository.recordWorkspaceResult({
      workspaceId: target.workspaceId,
      at,
      successful,
      error,
      notBeforeAt,
    });
  }
}

function emptyResult(status: AutomaticWeatherSyncResult['status']): AutomaticWeatherSyncResult {
  return {
    status,
    targets: 0,
    locations: 0,
    skippedBackoff: 0,
    successfulTargets: 0,
    failedTargets: 0,
    forecastRequests: 0,
    reanalysisRequests: 0,
  };
}
