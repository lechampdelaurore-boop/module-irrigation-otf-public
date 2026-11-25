import { rememberedRead } from '@/db/request-memo';
import { readWeatherPreferenceForUser, type WeatherPreference } from '@/db/water-management-repository';
import { locationConfirmed } from '../domain/onboarding/steps.ts';
import { getOnboardingForUser } from './onboarding-service.ts';

/** La préférence de lieu d'un espace et ce que l'accueil en dit (4.4, F419). */
export type ResolvedWeatherPreference = WeatherPreference & {
  /** La commune est confirmée : espace d'avant l'accueil, démonstration, ou étape « Où est la ferme » confirmée. */
  locationConfirmed: boolean;
};

/**
 * Le lieu de la météo d'un espace, tel que tout calcul le lit (4.4,
 * docs/tranche-4-contract.md, F419, F582) : sans commune confirmée, aucun
 * lieu, et le siège de la structure d'OTF n'est jamais pris en silence. Lu
 * une fois par requête (section 5 sexies) : une relecture de la météo écrit,
 * et la lecture qui la suit retrouve la base.
 */
export async function readWeatherPreference(spaceKey: string): Promise<ResolvedWeatherPreference> {
  return rememberedRead('weather-preference', [spaceKey], async () => {
    const [preference, onboarding] = await Promise.all([readWeatherPreferenceForUser(spaceKey), getOnboardingForUser(spaceKey)]);
    return { ...preference, locationConfirmed: locationConfirmed(onboarding) };
  });
}
