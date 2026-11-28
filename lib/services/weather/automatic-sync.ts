import { logJsonLine } from '../../adapters/log.ts';
import { millisecondsFromMinutes } from '../../domain/units.ts';
import { dateKeyInTimeZone } from '../../domain/water-management.ts';
import { automaticWeatherRequestRanges } from '../../domain/weather/cache-policy.ts';
import { intradayWeatherRequestRanges } from '../../domain/weather/intraday-alerts.ts';
import {
  fetchWeatherForLocation,
  weatherLocationDeduplicationKey,
  weatherOutcomeError,
  weatherOutcomeNotBeforeAt,
  weatherOutcomeSucceeded,
  type WeatherEndpointResult,
  type WeatherFetchOutcome,
  type WeatherRetryOptions,
  type WeatherSyncLogger,
} from './sync-engine.ts';
import type { WeatherProvider } from '../../domain/weather/weather-provider.ts';
import {
  forecastDaysBySource,
  forecastModelToRead,
  forecastReadingsAtPlace,
  resolveForecastModelChoice,
  type ModelForecastReader,
} from '../../domain/weather/forecast-models.ts';
import { archiveForecastReading } from './forecast-archive.ts';
import { weatherFailureKind, type WeatherFailureKind } from '../../domain/operations/morning-task-outcomes.ts';

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
  /**
   * La classe de l'échec de chaque lieu sans prévisions (4.5, F602) : aucun
   * message, aucune adresse. Un lieu lu pour plusieurs modèles (D-346) compte
   * une fois, par la première lecture en échec.
   */
  forecastFailures: WeatherFailureKind[];
  /** La classe de l'échec de chaque lieu sans réanalyse, comptée à part des prévisions (4.5, F600). */
  reanalysisFailures: WeatherFailureKind[];
};

const AUTOMATIC_LOCK_MS = millisecondsFromMinutes(10);

/** Appelé après chaque écriture réussie de prévisions d'une exploitation : les alertes météo (5 bis). */
export type ForecastWrittenHandler = (input: { workspaceId: string; locationKey: string; now: Date }) => Promise<void>;

/**
 * La lecture du matin (`morning`, par défaut) lit 15 jours de prévisions et
 * la réanalyse, et archive la prévision du jour. La relecture de la journée
 * (`intraday`, C1, D-303) ne lit que les 7 jours de prévisions des alertes,
 * pour les seules cibles que `includeTarget` retient ; elle n'archive rien
 * (l'archive garde la première lecture du jour, D-297).
 */
export type AutomaticWeatherSyncMode = 'morning' | 'intraday';

/**
 * Les fermes d'un même lieu lisent **une lecture par modèle**
 * (docs/weather-models-contract.md, § 5 ; D-346) : « Automatique » par le
 * fournisseur, chaque modèle choisi par `modelReader`, une seule fois quel que
 * soit le nombre de fermes qui le partagent ; la réanalyse, elle, ne dépend
 * pas du modèle et se lit une fois par lieu (règle 7). Chaque ferme écrit
 * ensuite **ses** lignes : une lecture se partage, une ligne jamais. Sans
 * `modelReader` (démonstration, règle 13), toutes lisent « Automatique ».
 */
export async function runAutomaticWeatherSync({
  repository,
  provider,
  modelReader = null,
  now = new Date(),
  retry,
  log = logJsonLine,
  onForecastWritten,
  mode = 'morning',
  includeTarget,
}: {
  repository: AutomaticWeatherSyncRepository;
  provider: WeatherProvider;
  modelReader?: ModelForecastReader | null;
  now?: Date;
  retry?: WeatherRetryOptions;
  log?: WeatherSyncLogger;
  onForecastWritten?: ForecastWrittenHandler;
  mode?: AutomaticWeatherSyncMode;
  includeTarget?: (target: AutomaticWeatherTarget) => Promise<boolean>;
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
    const targets = await selectTargets(await repository.listTargets(), includeTarget);
    await returnWithdrawnModelsToAutomatic(targets, repository, at, log);
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
      mode,
      startedAt: at,
      targets: targets.length,
      locations: groups.size,
      skippedBackoff: finalResult.skippedBackoff,
    });

    for (const groupedTargets of groups.values()) {
      const representative = groupedTargets[0];
      const today = dateKeyInTimeZone(now, representative.timezone);
      const ranges = mode === 'intraday' ? intradayWeatherRequestRanges({ today }) : automaticWeatherRequestRanges({ today });
      log('info', {
        event: 'weather_automatic_location_started',
        mode,
        locationKey: representative.locationKey,
        provider: provider.id,
        workspaceCount: groupedTargets.length,
        forecastRange: ranges.forecast,
        reanalysisRange: ranges.reanalysis,
        cacheMode: 'forced-refresh',
      });
      const readings = forecastReadingsAtPlace(groupedTargets, (target) => modelToRead(target, modelReader));
      let reanalysis: WeatherEndpointResult | null = null;
      let forecastFailure: WeatherFailureKind | null = null;
      const outcomes: WeatherFetchOutcome[] = [];
      for (const reading of readings) {
        if (reading.modelId !== null) {
          log('info', { event: 'weather_automatic_model_reading', mode, locationKey: representative.locationKey, forecastModel: reading.modelId, workspaceCount: reading.members.length });
        }
        // La réanalyse se lit avec la première lecture du lieu, et sert à toutes (règle 7).
        const fetched = await fetchWeatherForLocation({
          location: representative,
          ranges: reanalysis === null ? ranges : { forecast: ranges.forecast, reanalysis: null },
          provider,
          bypassCache: true,
          retry,
          log,
          forecastModel: reading.modelId === null || modelReader === null ? null : { reader: modelReader, modelId: reading.modelId },
        });
        finalResult.forecastRequests += ranges.forecast ? 1 : 0;
        if (reanalysis === null) {
          finalResult.reanalysisRequests += ranges.reanalysis ? 1 : 0;
          if (fetched.reanalysis.status === 'rejected') finalResult.reanalysisFailures.push(weatherFailureKind(fetched.reanalysis.error));
        }
        reanalysis ??= fetched.reanalysis;
        if (fetched.forecast.status === 'rejected') forecastFailure ??= weatherFailureKind(fetched.forecast.error);
        const outcome: WeatherFetchOutcome = { forecast: fetched.forecast, reanalysis };
        outcomes.push(outcome);
        await persistOutcomeForTargets({
          repository,
          provider,
          targets: reading.members,
          outcome,
          at,
          now,
          onForecastWritten,
          archive: mode === 'morning',
          log,
        });
        if (weatherOutcomeSucceeded(outcome)) {
          finalResult.successfulTargets += reading.members.length;
        } else {
          finalResult.failedTargets += reading.members.length;
          finalError ??= weatherOutcomeError(outcome);
        }
      }
      if (forecastFailure !== null) finalResult.forecastFailures.push(forecastFailure);
      const succeeded = outcomes.every(weatherOutcomeSucceeded);
      log(succeeded ? 'info' : 'warn', {
        event: 'weather_automatic_location_completed',
        locationKey: representative.locationKey,
        provider: provider.id,
        workspaceCount: groupedTargets.length,
        forecastDaysReceived: outcomes.reduce((total, outcome) => total + (outcome.forecast.status === 'fulfilled' ? outcome.forecast.values.length : 0), 0),
        reanalysisDaysReceived: reanalysis?.status === 'fulfilled' ? reanalysis.values.length : 0,
        failedEndpoints: [
          outcomes.some((outcome) => outcome.forecast.status === 'rejected') ? 'forecast' : null,
          reanalysis?.status === 'rejected' ? 'reanalysis' : null,
        ].filter(Boolean),
        completedAt: new Date().toISOString(),
      });
    }

    log(finalResult.failedTargets > 0 ? 'warn' : 'info', {
      event: 'weather_automatic_sync_completed',
      mode,
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

/**
 * Les cibles retenues : toutes pour le matin ; pour la relecture de la
 * journée, celles que le filtre garde. Un filtre qui échoue pour une ferme
 * l'écarte de ce passage sans arrêter les autres : elle sera relue au matin.
 */
async function selectTargets(
  targets: readonly AutomaticWeatherTarget[],
  includeTarget: ((target: AutomaticWeatherTarget) => Promise<boolean>) | undefined,
): Promise<AutomaticWeatherTarget[]> {
  if (!includeTarget) return [...targets];
  const kept: AutomaticWeatherTarget[] = [];
  for (const target of targets) {
    if (await includeTarget(target).catch(() => false)) kept.push(target);
  }
  return kept;
}

/**
 * Le modèle qu'une ferme lit à ce passage (règles 1, 9 et 13) : son modèle
 * enregistré s'il est encore proposé et couvre son lieu, et si le
 * déploiement lit les modèles ; sinon « Automatique » (`null`).
 */
function modelToRead(target: AutomaticWeatherTarget, modelReader: ModelForecastReader | null): string | null {
  return forecastModelToRead(resolveForecastModelChoice(target.forecastModel ?? null, target), modelReader !== null);
}

/**
 * Règle 9 : une ferme dont le modèle n'est plus proposé, ou ne couvre plus son
 * lieu, revient à « Automatique », dit au journal des modifications ; elle lit
 * « Automatique » dès ce passage, même si l'écriture échoue (elle sera refaite
 * au suivant). Rien n'est appelé chez le fournisseur ; aucune coordonnée ni
 * exploitation dans le journal technique.
 */
async function returnWithdrawnModelsToAutomatic(
  targets: readonly AutomaticWeatherTarget[],
  repository: AutomaticWeatherSyncRepository,
  at: string,
  log: WeatherSyncLogger,
): Promise<void> {
  for (const target of targets) {
    const choice = resolveForecastModelChoice(target.forecastModel ?? null, target);
    if (choice.kind !== 'back-to-automatic' || !repository.returnForecastModelToAutomatic) continue;
    try {
      const returned = await repository.returnForecastModelToAutomatic({ workspaceId: target.workspaceId, savedModelId: choice.savedModelId, at });
      if (returned) log('info', { event: 'weather_forecast_model_returned_to_automatic', forecastModel: choice.savedModelId, reason: choice.reason });
    } catch (error) {
      log('warn', { event: 'weather_forecast_model_return_failed', forecastModel: choice.savedModelId, error: error instanceof Error ? error.name : 'unknown' });
    }
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
  archive,
  log,
}: {
  repository: AutomaticWeatherSyncRepository;
  provider: WeatherProvider;
  targets: readonly AutomaticWeatherTarget[];
  outcome: WeatherFetchOutcome;
  at: string;
  now: Date;
  onForecastWritten?: ForecastWrittenHandler;
  archive: boolean;
  log: WeatherSyncLogger;
}) {
  const error = weatherOutcomeError(outcome);
  const successful = weatherOutcomeSucceeded(outcome);
  const notBeforeAt = weatherOutcomeNotBeforeAt(outcome, now);
  for (const target of targets) {
    if (outcome.forecast.status === 'fulfilled') {
      // Chaque jour sous la source qui l'a donné : le modèle choisi, « Automatique d'Open-Meteo »
      // pour un jour complété, ou le fournisseur d'« Automatique » (D-346 ; contrat des modèles, § 6).
      for (const { source, values } of forecastDaysBySource(outcome.forecast.values, provider.sourceId?.('forecast') ?? provider.id)) {
        await repository.upsertValues({
          target,
          kind: 'forecast',
          values,
          source,
          fetchedAt: at,
        });
        // L'archive J+1 à J+7, par exploitation, de la même lecture (docs/forecast-archive-contract.md).
        if (archive) await archiveForecastReading({
          write: (snapshot) => repository.archiveForecast({ ...snapshot, workspaceId: target.workspaceId }),
          locationKey: target.locationKey,
          values,
          source,
          fetchedAt: at,
          now,
          log,
        });
      }
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
    forecastFailures: [],
    reanalysisFailures: [],
  };
}
