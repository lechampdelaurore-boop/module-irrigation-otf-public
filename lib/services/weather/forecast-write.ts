import { writeForecastArchiveForUser } from '@/db/forecast-archive-repository';
import { upsertWeatherDailyValuesForUser } from '@/db/water-management-repository';
import { findWorkspaceIdForUser } from '@/db/workspace-repository';
import { forecastDaysBySource, type SourcedWeatherDay } from '../../domain/weather/forecast-models';
import { evaluateCropAlertsAfterForecastWrite } from '../crop-alerts-service';
import { evaluateWeatherAlertsAfterForecastWrite } from '../weather-alerts-service';
import { archiveForecastReading } from './forecast-archive';

/**
 * Les prévisions d'une lecture, écrites pour l'exploitation d'une personne :
 * par l'actualisation à l'écran et par l'enregistrement d'un modèle
 * (docs/weather-models-contract.md, § 3 règles 6, 8 et 11, § 6 ; D-346).
 *
 * Chaque jour s'écrit sous la source qui l'a donné : le modèle choisi,
 * « Automatique d'Open-Meteo » pour un jour complété, ou `providerSource`
 * pour un jour d'« Automatique » (sans source propre). Une lecture ne
 * commence jamais avant aujourd'hui : les jours passés gardent leur ligne,
 * et l'archive J+1 à J+7 ne garde que la première lecture du jour, jamais
 * réécrite (D-297).
 */
export async function writeForecastReadingForUser({
  ownerUserId,
  locationKey,
  days,
  providerSource,
  fetchedAt,
  now,
}: {
  ownerUserId: string;
  locationKey: string;
  days: readonly SourcedWeatherDay[];
  providerSource: string;
  fetchedAt: string;
  now: Date;
}): Promise<void> {
  for (const { source, values } of forecastDaysBySource(days, providerSource)) {
    await upsertWeatherDailyValuesForUser(ownerUserId, locationKey, 'forecast', values, source, fetchedAt);
    // L'archive J+1 à J+7 de la même lecture, sans appel de plus (docs/forecast-archive-contract.md).
    await archiveForecastReading({
      write: (snapshot) => writeForecastArchiveForUser(ownerUserId, snapshot),
      locationKey,
      values,
      source,
      fetchedAt,
      now,
    });
  }
}

/**
 * Les alertes météo, puis le gel par culture et les aspersions, après une
 * écriture de prévisions (docs/weather-alerts-contract.md,
 * docs/weather-crop-alerts-contract.md) : leurs règles de répétition
 * empêchent tout second envoi d'une même alerte (règle 12 des modèles).
 */
export async function evaluateForecastAlertsForUser(ownerUserId: string, locationKey: string, now: Date): Promise<void> {
  const workspaceId = await findWorkspaceIdForUser(ownerUserId);
  if (!workspaceId) return;
  await evaluateWeatherAlertsAfterForecastWrite({ workspaceId, locationKey, now });
  await evaluateCropAlertsAfterForecastWrite({ workspaceId, locationKey, now });
}
