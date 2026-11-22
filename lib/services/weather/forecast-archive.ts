import { logJsonLine } from '../../adapters/log.ts';
import { dateKeyInTimeZone, FARM_TIME_ZONE } from '../../domain/water-management.ts';
import { forecastArchiveRows, type ForecastArchiveRow } from '../../domain/weather/forecast-archive.ts';
import type { WeatherDailyValue } from '../../domain/weather/weather-provider.ts';
import type { WeatherSyncLogger } from './sync-engine.ts';

/**
 * L'archive des prévisions, au moment d'une lecture réussie
 * (docs/forecast-archive-contract.md, D-297) : la tâche de 6 h 15 et
 * l'actualisation à l'écran l'appellent toutes deux, juste après avoir
 * écrit les prévisions qu'elles ont lues. Elle recopie cette lecture, sans
 * aucun appel externe de plus (règle 6).
 *
 * Le jour d'émission est le jour civil de Paris de la lecture (D-004). La
 * première lecture réussie du jour écrit ses lignes ; les suivantes ne
 * changent rien à ce qui est écrit (règles 1 et 4).
 *
 * Une écriture qui échoue ne fait jamais échouer la lecture météo (règle 11) :
 * l'échec est journalisé par le service, le statut et la date seulement,
 * comme les autres journaux météo (D-164), et la photographie manque ce
 * jour-là.
 */

export type ForecastArchiveWrite = (snapshot: {
  locationKey: string;
  issuedOn: string;
  rows: readonly ForecastArchiveRow[];
  source: string;
  fetchedAt: string;
}) => Promise<number>;

/** Rend le nombre de lignes nouvelles, ou `null` quand l'écriture a échoué. */
export async function archiveForecastReading({
  write,
  locationKey,
  values,
  source,
  fetchedAt,
  now,
  log = logJsonLine,
}: {
  write: ForecastArchiveWrite;
  locationKey: string;
  values: readonly WeatherDailyValue[];
  source: string;
  fetchedAt: string;
  now: Date;
  log?: WeatherSyncLogger;
}): Promise<number | null> {
  const issuedOn = dateKeyInTimeZone(now, FARM_TIME_ZONE);
  const rows = forecastArchiveRows(issuedOn, values);
  if (rows.length === 0) return 0;
  try {
    return await write({ locationKey, issuedOn, rows, source, fetchedAt });
  } catch {
    log('warn', {
      event: 'weather_forecast_archive_failed',
      service: 'forecast-archive',
      status: 'failed',
      failedAt: new Date().toISOString(),
    });
    return null;
  }
}
