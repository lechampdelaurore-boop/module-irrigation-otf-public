import type { OtfStructure } from '../domain.ts';
import type { WeatherLocationCandidate } from './weather-provider.ts';

export function weatherLocationKey(
  preference: {
    locationMode: 'otf' | 'custom';
    customCity: string | null;
    customPostcode: string | null;
  },
  structure: OtfStructure,
): string | null {
  const city = preference.locationMode === 'custom'
    ? preference.customCity
    : structure.legalCity;
  const postcode = preference.locationMode === 'custom'
    ? preference.customPostcode
    : structure.legalPostcode;
  if (!city?.trim()) return null;
  const prefix = preference.locationMode === 'custom' ? 'custom' : 'otf';
  return `${prefix}:${normalizeLocation(city)}:${normalizeLocation(postcode ?? '')}`;
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
