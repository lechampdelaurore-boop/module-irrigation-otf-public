import type { CropSeries, ImplantationTask } from '../../lib/domain/domain.ts';
import type { CropAlertCommonEntry, FrostLinkRevision } from '../../lib/domain/crop-alerts/thresholds.ts';

/**
 * Les données des scénarios du contrat des alertes par culture : le lundi
 * 9 novembre 2026, semaine 2026-W46, une ferme avec ses séries et son
 * rattachement au jeu commun.
 */

export const MONDAY = '2026-11-09';
export const TUESDAY = '2026-11-10';
export const WEDNESDAY = '2026-11-11';
export const MORNING = '2026-11-09T05:15:00.000Z';
export const AFTERNOON = '2026-11-09T13:00:00.000Z';

/** Une partie du jeu commun du contrat. */
export const COMMON: ReadonlyMap<string, CropAlertCommonEntry> = new Map([
  ['tomate', { key: 'tomate', name: 'Tomate', damageCelsius: 0, dryingDays: null }],
  ['carotte', { key: 'carotte', name: 'Carotte', damageCelsius: -6, dryingDays: null }],
  ['poireau', { key: 'poireau', name: 'Poireau', damageCelsius: -8, dryingDays: null }],
  ['laitue', { key: 'laitue', name: 'Laitue, mesclun', damageCelsius: -2, dryingDays: null }],
  ['fraisier', { key: 'fraisier', name: 'Fraisier', damageCelsius: null, dryingDays: null }],
  ['ail', { key: 'ail', name: 'Ail', damageCelsius: -10, dryingDays: 15 }],
  ['oignon-botte', { key: 'oignon-botte', name: 'Oignon botte, aillet', damageCelsius: -4, dryingDays: null }],
  ['melon', { key: 'melon', name: 'Melon', damageCelsius: 0, dryingDays: 7 }],
].map(([key, entry]) => [key as string, entry as CropAlertCommonEntry]));

type SeriesOptions = {
  id: string;
  plantId: string;
  plantName: string;
  use?: 'bed' | 'block';
  harvestWeeks?: string[];
  harvestWeeksExpected?: string[];
  season?: number;
};

export function series(options: SeriesOptions): CropSeries {
  return {
    id: options.id,
    name: options.id,
    season: options.season ?? 2026,
    use: options.use ?? 'bed',
    cycle: 'annual',
    cultivations: [{
      id: `${options.id}-culture`,
      plantId: options.plantId,
      plantName: options.plantName,
      harvestWeeks: options.harvestWeeks ?? [],
      harvestWeeksExpected: options.harvestWeeksExpected ?? ['2026-W50'],
    }],
  };
}

export function planting(seriesId: string, week: string, done = true): ImplantationTask {
  return { id: `${seriesId}-plantation`, seriesId, cultivationId: null, kind: 'planting', plannedWeek: week, doneWeek: done ? week : null, status: done ? 'done' : 'todo' };
}

let revisionCount = 0;

/** Le rattachement d'une espèce, ou d'une série, au jeu commun. */
export function link(plantId: string, commonKey: string | null, options: { seriesId?: string; damageCelsius?: number; recordedAt?: string } = {}): FrostLinkRevision {
  revisionCount += 1;
  return {
    id: `revision-${String(revisionCount).padStart(3, '0')}`,
    plantId,
    seriesId: options.seriesId ?? null,
    commonKey,
    damageCelsius: options.damageCelsius ?? null,
    recordedAt: options.recordedAt ?? `2026-11-01T08:${String(revisionCount % 60).padStart(2, '0')}:00.000Z`,
  };
}
