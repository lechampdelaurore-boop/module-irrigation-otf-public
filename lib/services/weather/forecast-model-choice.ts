import { saveForecastModelForUser } from '@/db/forecast-model-repository';
import { readWeatherGeocodeForUser, tryClaimWeatherRefreshForUser } from '@/db/water-management-repository';
import { logJsonLine } from '../../adapters/log';
import type { IrrigationSnapshot } from '../../domain/domain';
import { dateKeyInTimeZone } from '../../domain/water-management';
import { automaticWeatherRequestRanges } from '../../domain/weather/cache-policy';
import {
  forecastModelChoiceRefusal,
  modelReadingProof,
  proofFailureOf,
  type ForecastModelChoiceOutcome,
} from '../../domain/weather/forecast-model-choice';
import type { ModelForecastReader, SourcedWeatherDay } from '../../domain/weather/forecast-models';
import { weatherLocationKey } from '../../domain/weather/location';
import { WeatherProviderError, type WeatherProvider } from '../../domain/weather/weather-provider';
import { readWeatherPreference } from '../weather-preference';
import { getConfiguredWeatherProvider, getModelForecastReader } from './configured-provider';
import { evaluateForecastAlertsForUser, writeForecastReadingForUser } from './forecast-write';
import { fetchWeatherForLocation, type WeatherRetryOptions, type WeatherSyncLogger } from './sync-engine';

/**
 * Enregistrer le modèle de prévision d'une ferme (docs/weather-models-contract.md,
 * § 3 règles 1, 3, 8, 11 et 13 ; D-346). L'écran (PR 3) l'appelle ; les
 * règles et les mots sont dans `lib/domain/weather/forecast-model-choice.ts`.
 *
 * 1. Rien n'existe en démonstration (règle 13) ; un modèle hors de la liste,
 *    sans lieu localisé ou hors de sa zone est refusé avant toute lecture.
 * 2. Le même modèle ne relit rien ; deux enregistrements rapprochés
 *    respectent le délai entre deux lectures de la ferme (30 s, celui de
 *    l'actualisation à l'écran).
 * 3. Un modèle est **vérifié avant d'être gardé** (règle 8) : une lecture
 *    immédiate des 15 jours, à partir d'aujourd'hui ; si elle échoue ou ne
 *    donne la pluie du modèle pour aucun jour, rien n'est enregistré et la
 *    ferme garde son réglage. C'est aussi l'essai B : le journal technique dit
 *    le résultat, la classe de l'échec et le statut HTTP, jamais une
 *    coordonnée, une adresse ni une clé.
 * 4. Enregistré, il remplace les prévisions d'aujourd'hui et des jours
 *    suivants par cette lecture (règle 11) ; les jours passés et l'archive ne
 *    sont jamais réécrits. Les alertes s'évaluent comme après toute lecture
 *    (règle 12).
 * 5. « Automatique » ne se prouve pas (règle 1) : il s'enregistre, puis ses
 *    prévisions à venir sont relues si le fournisseur répond, sinon à la
 *    prochaine lecture.
 *
 * Ni le succès ni l'échec de cette lecture ne deviennent l'état de la
 * météo de la ferme : la réanalyse n'est pas relue ici, et la réponse dit
 * déjà pourquoi à la personne.
 */
export async function saveForecastModelChoiceForUser({
  ownerUserId,
  snapshot,
  modelId,
  now = new Date(),
  provider = getConfiguredWeatherProvider(),
  modelReader = getModelForecastReader(),
  retry,
  log = logJsonLine,
}: {
  ownerUserId: string;
  snapshot: IrrigationSnapshot;
  /** Le modèle choisi ; `null` : « Automatique ». */
  modelId: string | null;
  now?: Date;
  provider?: WeatherProvider;
  modelReader?: ModelForecastReader | null;
  retry?: WeatherRetryOptions;
  log?: WeatherSyncLogger;
}): Promise<ForecastModelChoiceOutcome> {
  if (modelReader === null) return { kind: 'refused', reason: 'absent' };
  const preference = await readWeatherPreference(ownerUserId);
  const locationKey = weatherLocationKey(preference, snapshot.structure);
  const location = locationKey === null ? null : await readWeatherGeocodeForUser(ownerUserId, locationKey);
  const refusal = forecastModelChoiceRefusal(modelId, location);
  if (refusal !== null) return { kind: 'refused', reason: refusal };
  if (preference.forecastModel === modelId) return { kind: 'unchanged', modelId };
  const at = now.toISOString();
  if (!await tryClaimWeatherRefreshForUser(ownerUserId, at)) return { kind: 'refused', reason: 'too-soon' };

  // « Automatique » ne se prouve pas : enregistré d'abord, ses prévisions à venir relues ensuite, si possible.
  if (modelId === null) {
    await saveForecastModelForUser(ownerUserId, null, at);
    const read = location === null ? null : await readForecastFrom(location, now, { provider, modelReader: null, modelId: null, retry, log });
    const days = read?.status === 'fulfilled' ? read.values : [];
    if (location !== null) await writeAndEvaluate({ ownerUserId, locationKey: location.locationKey, days, provider, at, now });
    log('info', { event: 'weather_forecast_model_saved', forecastModel: 'automatic', forecastDays: days.length, savedAt: at });
    return { kind: 'saved', modelId: null, days };
  }

  // Un modèle : le refus ci-dessus garantit un lieu localisé qu’il couvre.
  if (location === null) return { kind: 'refused', reason: 'no-place' };
  const read = await readForecastFrom(location, now, { provider, modelReader, modelId, retry, log });
  const failure = read.status === 'rejected'
    ? proofFailureOf(read.error instanceof WeatherProviderError ? read.error.kind : null)
    : modelReadingProof(modelId, read.values);
  if (failure !== null) {
    log('warn', {
      event: 'weather_forecast_model_verified',
      forecastModel: modelId,
      outcome: 'not-proved',
      reason: failure,
      status: read.status === 'rejected' && read.error instanceof WeatherProviderError ? read.error.status : null,
      verifiedAt: at,
    });
    return { kind: 'not-proved', reason: failure };
  }
  const days = read.status === 'fulfilled' ? read.values : [];
  await saveForecastModelForUser(ownerUserId, modelId, at);
  await writeAndEvaluate({ ownerUserId, locationKey: location.locationKey, days, provider, at, now });
  log('info', { event: 'weather_forecast_model_verified', forecastModel: modelId, outcome: 'proved', forecastDays: days.length, verifiedAt: at });
  return { kind: 'saved', modelId, days };
}

type ForecastRead = { status: 'fulfilled'; values: SourcedWeatherDay[] } | { status: 'rejected'; error: unknown };

/** La lecture des 15 jours à partir d'aujourd'hui, au lieu de la ferme, sans la réanalyse (règle 7). */
async function readForecastFrom(
  location: { latitude: number; longitude: number; timezone: string; locationKey: string },
  now: Date,
  options: {
    provider: WeatherProvider;
    modelReader: ModelForecastReader | null;
    modelId: string | null;
    retry: WeatherRetryOptions | undefined;
    log: WeatherSyncLogger;
  },
): Promise<ForecastRead> {
  const today = dateKeyInTimeZone(now, location.timezone);
  const outcome = await fetchWeatherForLocation({
    location,
    ranges: { forecast: automaticWeatherRequestRanges({ today }).forecast, reanalysis: null },
    provider: options.provider,
    bypassCache: true,
    retry: options.retry,
    log: options.log,
    forecastModel: options.modelId === null || options.modelReader === null ? null : { reader: options.modelReader, modelId: options.modelId },
  });
  return outcome.forecast;
}

async function writeAndEvaluate({
  ownerUserId,
  locationKey,
  days,
  provider,
  at,
  now,
}: {
  ownerUserId: string;
  locationKey: string;
  days: readonly SourcedWeatherDay[];
  provider: WeatherProvider;
  at: string;
  now: Date;
}): Promise<void> {
  if (days.length === 0) return;
  await writeForecastReadingForUser({ ownerUserId, locationKey, days, providerSource: provider.sourceId?.('forecast') ?? provider.id, fetchedAt: at, now });
  await evaluateForecastAlertsForUser(ownerUserId, locationKey, now);
}
