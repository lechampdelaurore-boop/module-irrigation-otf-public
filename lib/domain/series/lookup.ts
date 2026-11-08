import type { CropPlan } from '../domain.ts';
import { isIgnoredSeries, resolveSeriesOccupation } from './occupation.ts';

/**
 * Les séries qui occupaient au moins une des planches données un jour
 * `AAAA-MM-JJ` : celles dont un emplacement est sur une de ces planches et
 * dont la période contient ce jour. Sert à la colonne « Séries » de l'export
 * (docs/series-contract.md, « Interface »). Les séries ignorées n'y
 * apparaissent pas, comme nulle part ailleurs (D-022, règle 3).
 */
export function seriesNamesOccupyingBedsOn(
  cropPlan: CropPlan | undefined,
  bedIds: readonly string[],
  dateKey: string,
): string[] {
  if (!cropPlan || bedIds.length === 0) return [];
  const beds = new Set(bedIds);
  const names: string[] = [];
  for (const series of cropPlan.series) {
    if (!cropPlan.places.some((place) => place.seriesId === series.id && beds.has(place.bedId))) continue;
    const occupation = resolveSeriesOccupation(series, cropPlan.implantationTasks, dateKey);
    if (isIgnoredSeries(occupation)) continue;
    if (dateKey < occupation.startDate) continue;
    if (occupation.endDate !== null && dateKey > occupation.endDate) continue;
    names.push(series.name);
  }
  return names.sort((left, right) => left.localeCompare(right, 'fr'));
}
