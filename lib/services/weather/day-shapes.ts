import { logJsonLine } from '../../adapters/log.ts';
import { dateKeyInTimeZone } from '../../domain/water-management.ts';
import { forecastDaysBySource, type SourcedWeatherDay } from '../../domain/weather/forecast-models.ts';
import { dayShapesToRecord, type RecordedDayShape } from '../../domain/weather/hourly-et0.ts';
import type { WeatherSyncLogger } from './sync-engine.ts';

/**
 * La forme de la journée, au moment d'une lecture de prévision réussie
 * (docs/et0-horaire-contract.md, § 2 choix 7 et 8, § 5 ; D-349) : la lecture
 * du matin et les relectures de la journée l'appellent une fois par lecture
 * partagée d'un lieu, jamais une fois par ferme. Elle recopie les heures que
 * la lecture a apportées, sans aucun appel externe de plus.
 *
 * Chaque jour s'écrit sous la `source` de sa ligne du jour (le modèle choisi,
 * « Automatique d'Open-Meteo » pour un jour complété, ou le fournisseur
 * d'« Automatique ») : une ferme lit la forme du modèle de sa propre ligne,
 * jamais une autre (contrat, § 9).
 *
 * Une écriture qui échoue ne fait jamais échouer la lecture météo, ni les
 * alertes (§ 2, choix 7 ; scénario 10) : l'échec est journalisé, le statut
 * et la date seulement, jamais le lieu ni ses coordonnées.
 */

export type DayShapeWriter = (input: {
  placeKey: string;
  rows: readonly RecordedDayShape[];
  source: string;
  fetchedAt: string;
}) => Promise<number>;

/** Rend le nombre de lignes écrites, ou `null` quand une écriture a échoué. */
export async function recordDayShapes({
  write,
  placeKey,
  timeZone,
  values,
  providerSource,
  fetchedAt,
  now,
  log = logJsonLine,
}: {
  write: DayShapeWriter;
  placeKey: string;
  timeZone: string;
  values: readonly SourcedWeatherDay[];
  providerSource: string;
  fetchedAt: string;
  now: Date;
  log?: WeatherSyncLogger;
}): Promise<number | null> {
  const today = dateKeyInTimeZone(now, timeZone);
  let written = 0;
  try {
    for (const { source, values: days } of forecastDaysBySource(values, providerSource)) {
      const rows = dayShapesToRecord({ today, timeZone, days });
      if (rows.length > 0) written += await write({ placeKey, rows, source, fetchedAt });
    }
    return written;
  } catch {
    log('warn', {
      event: 'weather_day_shape_failed',
      service: 'day-shapes',
      status: 'failed',
      failedAt: new Date().toISOString(),
    });
    return null;
  }
}
