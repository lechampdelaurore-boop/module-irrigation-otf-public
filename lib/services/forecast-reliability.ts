import { readForecastReliabilityInputsForUser } from '@/db/forecast-reliability-repository';
import type { IrrigationSnapshot } from '../domain/domain';
import { dateKeyInTimeZone, FARM_TIME_ZONE } from '../domain/water-management';
import { forecastReliability, forecastReliabilityWindow, type ForecastReliability } from '../domain/weather/forecast-reliability';
import { weatherLocationKey } from '../domain/weather/location';
import { readWeatherPreference } from './weather-preference';

/**
 * La météo prévue contre la météo réalisée d'une ferme
 * (docs/forecast-reliability-contract.md, §7, D-338) : la fenêtre du jour
 * (heure de Paris), la lecture de l'archive et du réalisé pour le lieu de
 * météo actuel, puis le calcul du domaine. Sans lieu, rien n'est lu.
 *
 * En lecture seule : aucune écriture, aucun appel externe. L'écran (PR 2)
 * l'appelle à l'ouverture de son pli, jamais au chargement de la page.
 */
export async function getForecastReliabilityForUser({ ownerUserId, locationKey, now }: {
  ownerUserId: string;
  /** Le lieu de météo actuel (`weatherLocationKey`) ; `null` quand la ferme n'en a pas. */
  locationKey: string | null;
  now: Date;
}): Promise<ForecastReliability> {
  const today = dateKeyInTimeZone(now, FARM_TIME_ZONE);
  if (locationKey === null) return forecastReliability({ today, locationKey, archive: [], realised: [] });
  const inputs = await readForecastReliabilityInputsForUser(ownerUserId, locationKey, forecastReliabilityWindow(today));
  return forecastReliability({ today, locationKey, ...inputs });
}

/**
 * La même lecture pour un espace et sa ferme d'OTF : le lieu de météo se
 * résout comme partout (`weatherLocationKey`, sans commune confirmée aucun
 * lieu, F419), puis la comparaison.
 */
export async function getForecastReliabilityForSpace({ ownerUserId, snapshot, now }: {
  ownerUserId: string;
  snapshot: Pick<IrrigationSnapshot, 'structure'>;
  now: Date;
}): Promise<ForecastReliability> {
  const locationKey = weatherLocationKey(await readWeatherPreference(ownerUserId), snapshot.structure);
  return getForecastReliabilityForUser({ ownerUserId, locationKey, now });
}
