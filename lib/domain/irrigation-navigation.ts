import { isValidDateKey, weekStartDateKey } from './water-management.ts';

export function parseIrrigationSeason(
  value: string | string[] | undefined,
  fallback = new Date().getFullYear(),
): number {
  if (typeof value !== 'string' || !/^\d{4}$/.test(value)) return fallback;
  const season = Number(value);
  return season >= 1900 && season <= 2200 ? season : fallback;
}

export function irrigationHref(season: number, refresh = false): string {
  const params = new URLSearchParams({ season: String(season) });
  if (refresh) params.set('refresh', '1');
  return `/irrigation?${params.toString()}`;
}

export function closestAvailableSeason(
  requestedSeason: number,
  seasonFirst: number,
  seasonLast: number,
): number {
  return Math.min(Math.max(requestedSeason, seasonFirst), seasonLast);
}

/**
 * La semaine que demande l'adresse, `?week=AAAA-MM-JJ` : le clic sur une
 * alerte météo ouvre la semaine du jour visé (docs/weather-alerts-contract.md,
 * question 6). Rend le lundi de cette semaine, ou `null` si le paramètre est
 * absent ou n'est pas un jour valide.
 */
export function parseIrrigationWeek(value: string | string[] | undefined): string | null {
  if (typeof value !== 'string' || !isValidDateKey(value)) return null;
  return weekStartDateKey(value);
}
