import { listIrrigationEventsForUser } from '@/db/irrigation-event/read';
import { weekDayEvents, type WeekDayEvent } from '../domain/semaine/week-days';
import { addDaysToDateKey, localDateStartUtc, weekStartDateKey } from '../domain/water-management';

/**
 * Les irrigations d'une semaine pour « Jour par jour » de la page « Semaine »
 * (simplification, lot S4, PR 2, section 5) : celles du propriétaire
 * seulement, du lundi 0 h au lundi suivant à la ferme (`Europe/Paris`,
 * D-004), réduites à ce que lisent les lignes. Rien n'est écrit ici.
 */
export async function getWeekDayEventsForUser(input: { ownerUserId: string; season: number; weekStart: string }): Promise<WeekDayEvent[]> {
  const weekStart = weekStartDateKey(input.weekStart);
  const events = await listIrrigationEventsForUser(input.ownerUserId, input.season, false, {
    startAt: localDateStartUtc(weekStart).toISOString(),
    endAt: localDateStartUtc(addDaysToDateKey(weekStart, 7)).toISOString(),
  });
  return weekDayEvents(events, weekStart);
}
