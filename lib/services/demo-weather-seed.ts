import { saveWeatherGeocodeForUser, upsertWeatherDailyValuesForUser } from '@/db/water-management-repository';
import { demoSeasonWeatherProvider } from '../adapters/weather/demo-season-provider.ts';
import type { IrrigationSnapshot } from '../domain/domain.ts';
import { addDaysToDateKey, FARM_TIME_ZONE, weekStartDateKey } from '../domain/water-management.ts';
import { weatherLocationKey } from '../domain/weather/location.ts';

/**
 * La météo qu'une ferme fictive aurait déjà en base le jour du moment
 * (docs/demo-guided-contract.md, F158 et F162) : ce que la synchronisation
 * automatique de chaque nuit aurait écrit les semaines d'avant. Les jours
 * que l'archive couvre (cinq jours et plus avant le moment) en réanalyse,
 * les autres en prévision ; toutes les valeurs viennent du fournisseur de la
 * démonstration, sans appel réseau. Sans cela, un espace neuf n'aurait que
 * les prévisions du jour : la semaine entamée resterait incomplète et
 * aucune proposition d'objectif ne s'adopterait.
 */

/** Quatre semaines avant celle du moment : la réserve du sol et les cumuls ont de quoi se lire. */
const HISTORY_DAYS = 28;
/** L'archive suit le jour de cinq jours (`lib/domain/weather/cache-policy.ts`). */
const ARCHIVE_LAG_DAYS = 5;
const FORECAST_DAYS = 7;

/** La clé de lieu de la ferme, ou `null` quand sa commune ne se lit pas. */
export async function seedDemoWeather(ownerUserId: string, snapshot: IrrigationSnapshot, momentDateKey: string, now: Date): Promise<string | null> {
  const locationKey = weatherLocationKey({ locationMode: 'otf', customCity: null, customPostcode: null }, snapshot.structure);
  const [candidate] = await demoSeasonWeatherProvider.searchLocations(snapshot.structure.legalCity ?? '', snapshot.structure.legalPostcode);
  if (!locationKey || !candidate) return null;
  const provider = demoSeasonWeatherProvider;
  await saveWeatherGeocodeForUser(ownerUserId, locationKey, candidate, provider.sourceId?.('geocoding') ?? provider.id);

  const start = addDaysToDateKey(weekStartDateKey(momentDateKey), -HISTORY_DAYS);
  const archiveEnd = addDaysToDateKey(momentDateKey, -ARCHIVE_LAG_DAYS);
  const position = { latitude: candidate.latitude, longitude: candidate.longitude, timezone: FARM_TIME_ZONE };
  const [reanalysis, forecast] = await Promise.all([
    provider.readReanalysis({ ...position, startDate: start, endDate: archiveEnd }),
    provider.readForecast({ ...position, startDate: addDaysToDateKey(archiveEnd, 1), endDate: addDaysToDateKey(momentDateKey, FORECAST_DAYS - 1) }),
  ]);
  const at = now.toISOString();
  await upsertWeatherDailyValuesForUser(ownerUserId, locationKey, 'reanalysis', reanalysis, provider.sourceId?.('reanalysis') ?? provider.id, at);
  await upsertWeatherDailyValuesForUser(ownerUserId, locationKey, 'forecast', forecast, provider.sourceId?.('forecast') ?? provider.id, at);
  return locationKey;
}
