import { millisecondsFromMinutes } from '../units.ts';
import { addDaysToDateKey } from '../water-management.ts';

export function weatherRefreshRequired({
  force,
  selectedWeek,
  currentWeek,
  hasCachedValues,
  lastSuccessfulRefreshAt,
  lastRefreshAttemptAt,
  refreshNotBeforeAt,
  now,
  refreshIntervalMs,
}: {
  force: boolean;
  selectedWeek: string;
  currentWeek: string;
  hasCachedValues: boolean;
  lastSuccessfulRefreshAt: string | null;
  lastRefreshAttemptAt?: string | null;
  refreshNotBeforeAt?: string | null;
  now: Date;
  refreshIntervalMs: number;
}) {
  const notBefore = refreshNotBeforeAt ? Date.parse(refreshNotBeforeAt) : Number.NaN;
  if (Number.isFinite(notBefore) && now.getTime() < notBefore) return false;
  if (force) return true;
  const attempt = lastRefreshAttemptAt ? Date.parse(lastRefreshAttemptAt) : Number.NaN;
  const success = lastSuccessfulRefreshAt ? Date.parse(lastSuccessfulRefreshAt) : Number.NaN;
  if (Number.isFinite(attempt) && (!Number.isFinite(success) || attempt > success)
      && now.getTime() - attempt < millisecondsFromMinutes(5)) return false;
  if (!hasCachedValues) return true;
  if (selectedWeek !== currentWeek) return !hasCachedValues;
  const last = lastSuccessfulRefreshAt
    ? Date.parse(lastSuccessfulRefreshAt)
    : Number.NaN;
  return !Number.isFinite(last) || now.getTime() - last >= refreshIntervalMs;
}

export function weatherRefreshClaimed(meta: {
  changes?: number;
  rows_written?: number;
}) {
  return Number(meta.changes ?? 0) > 0 || Number(meta.rows_written ?? 0) > 0;
}

export function weatherRequestRanges({
  weekStart,
  today,
}: {
  weekStart: string;
  today: string;
}) {
  const weekEnd = addDaysToDateKey(weekStart, 6);
  const forecastStart = weekStart > today ? weekStart : today;
  const forecastMax = addDaysToDateKey(today, 14);
  const forecastEnd = weekEnd < forecastMax ? weekEnd : forecastMax;
  const archiveMax = addDaysToDateKey(today, -5);
  const archiveEnd = weekEnd < archiveMax ? weekEnd : archiveMax;
  return {
    forecast: forecastStart <= forecastEnd
      ? { startDate: forecastStart, endDate: forecastEnd }
      : null,
    reanalysis: weekStart <= archiveEnd
      ? { startDate: weekStart, endDate: archiveEnd }
      : null,
  };
}

export function automaticWeatherRequestRanges({
  today,
  forecastDays = 14,
  reanalysisLookbackDays = 10,
  reanalysisLagDays = 5,
}: {
  today: string;
  forecastDays?: number;
  reanalysisLookbackDays?: number;
  reanalysisLagDays?: number;
}) {
  if (forecastDays < 0 || reanalysisLookbackDays < reanalysisLagDays || reanalysisLagDays < 1) {
    throw new Error('Fenêtre météo automatique invalide.');
  }
  return {
    forecast: {
      startDate: today,
      endDate: addDaysToDateKey(today, forecastDays),
    },
    reanalysis: {
      startDate: addDaysToDateKey(today, -reanalysisLookbackDays),
      endDate: addDaysToDateKey(today, -reanalysisLagDays),
    },
  };
}

/**
 * Lectures fournisseur encore utilisées par la semaine affichée : toutes les
 * réanalyses (pluie réelle des jours passés) et les prévisions des jours à
 * venir, aujourd'hui compris. La prévision d'un jour déjà passé reste stockée
 * et sert encore à l'ET0 informative, mais aucune actualisation ne la
 * renouvellerait : son âge ne rend pas la semaine « ancienne »
 * (docs/weather-contract.md, recette 3.4 du 20 septembre 2026).
 */
export function oldestWeatherReadingInUse(
  rows: readonly { date: string; dataKind: 'forecast' | 'reanalysis' | 'manual_precipitation'; fetchedAt: string }[],
  today: string,
): string | null {
  return rows
    .filter((row) => row.dataKind === 'reanalysis' || (row.dataKind === 'forecast' && row.date >= today))
    .map((row) => row.fetchedAt)
    .sort()[0] ?? null;
}
