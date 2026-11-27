'use server';

import { getAuthenticatedUser } from '@/app/access-auth';
import { logJsonLine } from '@/lib/adapters/log';
import type { WeekDayEvent } from '@/lib/domain/semaine/week-days';
import { todaySeason } from '@/lib/domain/today/today-view';
import { isValidDateKey } from '@/lib/domain/water-management';
import { getAppliedWaterGapsForUser, type AppliedWaterGapView } from '@/lib/services/applied-water-gap';
import { getFeatureSelectionForUser } from '@/lib/services/feature-selection-service';
import { getIrrigationSnapshot } from '@/lib/services/irrigation-service';
import { getWeekDayEventsForUser } from '@/lib/services/week-service';

/**
 * Les irrigations de la semaine affichée, relues pour « Jour par jour »
 * après un geste (simplification, lot S4, PR 2, section 5) : celles de la
 * personne connectée seulement, jamais d'après le formulaire. Rien n'est
 * écrit ici. `null` quand la lecture échoue : la page garde ce qu'elle
 * montrait.
 */
export async function loadWeekEventsAction(input: { season: number; weekStart: string }): Promise<WeekDayEvent[] | null> {
  const user = await getAuthenticatedUser();
  if (!user) return null;
  if (!Number.isInteger(input.season) || input.season < 1900 || input.season > 9999 || !isValidDateKey(input.weekStart)) return null;
  try {
    return await getWeekDayEventsForUser({ ownerUserId: user.userId, season: input.season, weekStart: input.weekStart });
  } catch {
    return null;
  }
}

/**
 * L'écart du prévu des trois dernières semaines (amélioration n° 5, F735),
 * lu à l'ouverture de sa section du détail et non plus à l'ouverture de la
 * page (simplification, lot S4, PR 2, section 3.4, promesse de F918) : pour
 * la saison du jour seulement, la case « Planning » cochée, la personne
 * connectée. Rien n'est écrit ici. `null` quand la lecture échoue, qui se
 * journalise comme avant ; la section le dit.
 */
export async function readAppliedWaterGapAction(input: { season: number }): Promise<AppliedWaterGapView | null> {
  const user = await getAuthenticatedUser();
  if (!user) return null;
  const now = new Date();
  if (!Number.isInteger(input.season) || input.season !== todaySeason(now)) return null;
  try {
    const selection = await getFeatureSelectionForUser(user.userId);
    if (!selection.enabled.includes('planning')) return null;
    const snapshot = await getIrrigationSnapshot(user.userId, { season: input.season });
    return await getAppliedWaterGapsForUser({ ownerUserId: user.userId, season: input.season, snapshot, enabled: selection.enabled, now });
  } catch (error) {
    logJsonLine('warn', { event: 'applied_water_gap_failed', season: input.season, error: error instanceof Error ? error.message : String(error), failedAt: now.toISOString() });
    return null;
  }
}
