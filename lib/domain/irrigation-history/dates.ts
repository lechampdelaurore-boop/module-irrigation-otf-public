import type { IrrigationEventRecord } from '../irrigation-event-record.ts';
import { FARM_TIME_ZONE, addDaysToDateKey, isValidDateKey } from '../water-management.ts';

export function eventDisplayAt(event: IrrigationEventRecord) {
  return event.equipment.actualStartAt
    ?? event.equipment.plannedStartAt
    ?? event.equipment.canceledAt
    ?? event.canceledAt
    ?? event.createdAt;
}

export function dateKeys(startDate: string, endDate: string) {
  const result: string[] = [];
  let current = startDate;
  while (current <= endDate) {
    result.push(current);
    current = addDaysToDateKey(current, 1);
  }
  return result;
}

export function lastDayOfMonth(dateKey: string) {
  const year = Number(dateKey.slice(0, 4));
  const month = Number(dateKey.slice(5, 7));
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

export function dateKeyInTimeZone(date: Date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: FARM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function dateKeyInSeason(dateKey: string, season: number) {
  const monthDay = dateKey.slice(4);
  const candidate = `${season}${monthDay}`;
  if (isValidDateKey(candidate)) return candidate;
  return `${season}-01-01`;
}

export function minDateKey(left: string, right: string) {
  return left < right ? left : right;
}

export function maxDateKey(left: string, right: string) {
  return left > right ? left : right;
}
