import type { OtfStructure } from '../domain.ts';
import type { WeatherLocationCandidate } from './weather-provider.ts';

/**
 * La préférence de lieu d'un espace, telle que le calcul la lit : le mode
 * enregistré, et si la commune est confirmée (4.4, F419). Un espace qui fait
 * l'accueil sans avoir choisi sa commune n'a pas de lieu : le siège de la
 * structure d'OTF n'est jamais pris en silence.
 */
type LocationPreference = {
  locationMode: 'otf' | 'custom';
  customCity: string | null;
  customPostcode: string | null;
  locationConfirmed: boolean;
};

/** La commune à chercher pour la météo, et d'où elle vient ; `null` : aucune commune (non choisie, ou siège vide). */
export function weatherLocationQuery(
  preference: LocationPreference,
  structure: OtfStructure,
): { source: 'otf' | 'custom'; city: string; postcode: string | null } | null {
  if (!preference.locationConfirmed) return null;
  const source = preference.locationMode;
  const city = source === 'custom' ? preference.customCity : structure.legalCity;
  const postcode = source === 'custom' ? preference.customPostcode : structure.legalPostcode;
  if (!city?.trim()) return null;
  return { source, city, postcode: postcode ?? null };
}

export function weatherLocationKey(preference: LocationPreference, structure: OtfStructure): string | null {
  const query = weatherLocationQuery(preference, structure);
  if (!query) return null;
  return `${query.source}:${normalizeLocation(query.city)}:${normalizeLocation(query.postcode ?? '')}`;
}

/**
 * Une commune hors de France métropolitaine (outre-mer : codes postaux en 97
 * et 98) est hors du pilote (4.4, F419, réponse Q2 du porteur) : rien n'est
 * enregistré.
 */
export function outsidePilotArea(candidate: Pick<WeatherLocationCandidate, 'countryCode' | 'postcode'>): boolean {
  return candidate.countryCode !== 'FR' || /^9[78]/.test(candidate.postcode?.trim() ?? '');
}

export function locationKeyForCandidate(candidate: WeatherLocationCandidate): string {
  return customWeatherLocationKey(candidate.city, candidate.postcode);
}

export function customWeatherLocationKey(city: string, postcode: string | null): string {
  return `custom:${normalizeLocation(city)}:${normalizeLocation(postcode ?? '')}`;
}

function normalizeLocation(value: string) {
  return value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr-FR').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
