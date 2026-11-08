import { MINUTES_PER_DAY, MINUTES_PER_HOUR } from '../units.ts';
import { addDaysToDateKey, FARM_TIME_ZONE, localDateTimeUtc } from '../water-management.ts';
import type { TimeWindow } from './settings.ts';

/**
 * Une plage horaire (R8) traduite en instants, pour un jour de planning donné.
 * Une plage qui passe minuit — l'aspersion de 21 h à 8 h — appartient au jour
 * où elle commence : « la nuit de mardi » va de mardi 21 h à mercredi 8 h. Les
 * heures sont celles de la ferme (D-004), y compris les jours de changement
 * d'heure, où la plage dure une heure de plus ou de moins.
 */
export type WindowInterval = {
  /** Le jour de planning auquel la plage appartient, `AAAA-MM-JJ`. */
  dateKey: string;
  startAt: Date;
  endAt: Date;
};

function windowCrossesMidnight(window: TimeWindow): boolean {
  return window.endMinute < window.startMinute;
}

/** L'intervalle d'une plage pour un jour de planning. */
export function windowIntervalForDay(window: TimeWindow, dateKey: string, timeZone = FARM_TIME_ZONE): WindowInterval {
  const startAt = localDateTimeUtc(dateKey, timeOfDay(window.startMinute), timeZone);
  const endDateKey = windowCrossesMidnight(window) ? addDaysToDateKey(dateKey, 1) : dateKey;
  const endAt = localDateTimeUtc(endDateKey, timeOfDay(window.endMinute), timeZone);
  return { dateKey, startAt, endAt };
}

/**
 * Les intervalles d'une plage sur les jours de planning donnés, bornés au
 * plus tôt par `notBefore` — l'instant du calcul — et au plus tard par
 * `notAfter` — la fin de la semaine. Les plages vides sont écartées.
 */
export function windowIntervals(
  window: TimeWindow,
  dateKeys: readonly string[],
  bounds: { notBefore: Date; notAfter: Date },
  timeZone = FARM_TIME_ZONE,
): WindowInterval[] {
  const intervals: WindowInterval[] = [];
  for (const dateKey of dateKeys) {
    const interval = windowIntervalForDay(window, dateKey, timeZone);
    const startAt = interval.startAt < bounds.notBefore ? bounds.notBefore : interval.startAt;
    const endAt = interval.endAt > bounds.notAfter ? bounds.notAfter : interval.endAt;
    if (endAt > startAt) intervals.push({ dateKey, startAt, endAt });
  }
  return intervals;
}

/** Minutes de la plage, quel que soit son passage à minuit. */
export function windowLengthMinutes(window: TimeWindow): number {
  return windowCrossesMidnight(window)
    ? MINUTES_PER_DAY - window.startMinute + window.endMinute
    : window.endMinute - window.startMinute;
}

function timeOfDay(minutes: number): { hour: number; minute: number; second: number } {
  return { hour: Math.floor(minutes / MINUTES_PER_HOUR), minute: minutes % MINUTES_PER_HOUR, second: 0 };
}
