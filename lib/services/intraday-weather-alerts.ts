import { intradayWeatherRepository } from '@/db/automatic-weather-repository';
import { readCropAlertSettings } from '@/db/crop-alerts/inputs';
import { listWeatherAlertCriteriaForWorkspace } from '@/db/weather-alert-repository';
import { logJsonLine, type LogLevel } from '../adapters/log';
import { intradayWeatherOutcome } from '../domain/operations/morning-task-outcomes';
import { readsForecastAlerts } from '../domain/weather/intraday-alerts';
import type { ModelForecastReader } from '../domain/weather/forecast-models';
import type { WeatherProvider } from '../domain/weather/weather-provider';
import { evaluateCropAlertsAfterForecastWrite } from './crop-alerts-service';
import { getEnabledFeaturesForWorkspace } from './feature-selection-service';
import { recordTaskOutcomes } from './task-runs';
import { getConfiguredWeatherProvider, getModelForecastReader } from './weather/configured-provider';
import { runAutomaticWeatherSync, type AutomaticWeatherSyncRepository, type ForecastWrittenHandler } from './weather/automatic-sync';
import { evaluateWeatherAlertsAfterForecastWrite } from './weather-alerts-service';

/**
 * La relecture des prévisions de la journée, pour les alertes (C1, D-303,
 * docs/weather-scheduler-contract.md, « La relecture de la journée ») : le
 * planificateur l'appelle à 9 h 30, 12 h 30, 15 h 30, 18 h 30 et 21 h 30.
 * Seules les fermes qui ont une alerte active sont relues, un appel par lieu
 * comme le matin ; les alertes météo puis par culture s'évaluent après chaque
 * écriture, et la règle de répétition de chacune empêche tout second envoi
 * d'une même alerte. Le passage s'enregistre comme une tâche du registre et
 * ne lève jamais : la route répond toujours 200, des nombres seulement.
 */

export type IntradayWeatherPassResult = {
  status: 'completed' | 'already-running' | 'failed';
  /** Les fermes relues (alerte active, lieu résolu). */
  targets: number;
  locations: number;
  forecastRequests: number;
  failedTargets: number;
  successful: boolean;
};

/** Une ferme est relue quand une de ses alertes lit les prévisions (règle dans `lib/domain/weather/intraday-alerts.ts`). */
async function farmReadsForecastAlerts(workspaceId: string): Promise<boolean> {
  const enabled = await getEnabledFeaturesForWorkspace(workspaceId);
  const activeWeatherCriteria = enabled.includes('alertes-meteo')
    ? (await listWeatherAlertCriteriaForWorkspace(workspaceId)).filter((criterion) => criterion.active).length
    : 0;
  const cropAlerts = enabled.includes('alertes-cultures') ? await readCropAlertSettings(workspaceId) : null;
  return readsForecastAlerts({ enabled, activeWeatherCriteria, cropAlerts });
}

const evaluateAlerts: ForecastWrittenHandler = async (input) => {
  await evaluateWeatherAlertsAfterForecastWrite(input);
  await evaluateCropAlertsAfterForecastWrite(input);
};

export async function runIntradayWeatherAlerts({
  now = new Date(),
  repository = intradayWeatherRepository,
  provider = getConfiguredWeatherProvider(),
  modelReader = getModelForecastReader(),
  includeTarget = (target) => farmReadsForecastAlerts(target.workspaceId),
  onForecastWritten = evaluateAlerts,
  sleep,
  log = logJsonLine,
}: {
  now?: Date;
  repository?: AutomaticWeatherSyncRepository;
  provider?: WeatherProvider;
  /** Le lecteur des modèles choisis par les fermes (D-346) ; `null` : toutes lisent « Automatique ». */
  modelReader?: ModelForecastReader | null;
  includeTarget?: (target: { workspaceId: string }) => Promise<boolean>;
  onForecastWritten?: ForecastWrittenHandler;
  sleep?: (delayMs: number) => Promise<void>;
  log?: (level: LogLevel, entry: Record<string, unknown>) => void;
} = {}): Promise<IntradayWeatherPassResult> {
  const at = now.toISOString();
  try {
    const weather = await runAutomaticWeatherSync({
      repository,
      provider,
      modelReader,
      now,
      mode: 'intraday',
      includeTarget,
      onForecastWritten,
      retry: sleep ? { sleep } : undefined,
      log,
    });
    const outcomes = intradayWeatherOutcome({ weather });
    await recordTaskOutcomes(outcomes, { at, log });
    return {
      status: weather.status,
      targets: weather.targets,
      locations: weather.locations,
      forecastRequests: weather.forecastRequests,
      failedTargets: weather.failedTargets,
      successful: outcomes.every((outcome) => outcome.successful),
    };
  } catch (error) {
    await recordTaskOutcomes(intradayWeatherOutcome({ interruptedBy: error instanceof Error ? error.name : undefined }), { at, log });
    log('warn', { event: 'weather_intraday_pass_failed', error: error instanceof Error ? error.name : 'unknown', failedAt: new Date().toISOString() });
    return { status: 'failed', targets: 0, locations: 0, forecastRequests: 0, failedTargets: 0, successful: false };
  }
}
