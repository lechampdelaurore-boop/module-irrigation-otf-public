import { FARM_TIME_ZONE } from './water-management.ts';

/**
 * Les heures, les durées et les comptes du module, écrits d'une seule façon
 * (audit du 19 novembre 2026, lot K, n° 22, F474 à F476) : « 8 h 50 »,
 * « 18 h », « 1 h 21 », « 45 min », « 1 jour », « 7 jours ». Toujours à
 * l'heure de la ferme (D-004). Les champs de saisie et l'export CSV gardent
 * leurs formats de machine et de tableur.
 */

const hourParts = (timeZone: string) => new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone,
});

/** « 8 h 50 », « 18 h » : l'heure d'un instant à la ferme. */
export function clockText(instant: string | Date, timeZone = FARM_TIME_ZONE): string {
  const parts = Object.fromEntries(hourParts(timeZone)
    .formatToParts(typeof instant === 'string' ? new Date(instant) : instant)
    .map((part) => [part.type, part.value]));
  return clockFromHourMinute(Number(parts.hour), Number(parts.minute));
}

/** « 6 h », « 21 h 30 », « 0 h » : une heure de la journée, en minutes depuis minuit. */
export function clockFromMinutes(minutesOfDay: number): string {
  const minutes = ((Math.round(minutesOfDay) % 1440) + 1440) % 1440;
  return clockFromHourMinute(Math.floor(minutes / 60), minutes % 60);
}

function clockFromHourMinute(hour: number, minute: number): string {
  return minute === 0 ? `${hour} h` : `${hour} h ${String(minute).padStart(2, '0')}`;
}

const dateFormats = new Map<string, Intl.DateTimeFormat>();

/** « 16/06/2026 à 8 h 50 » ; `medium`, « 16 juin 2026 à 8 h 50 » ; `long`, « 16 juin 2026 à 8 h 50 ». */
export function dateClockText(instant: string | Date, timeZone = FARM_TIME_ZONE, style: 'short' | 'medium' | 'long' = 'short'): string {
  const date = typeof instant === 'string' ? new Date(instant) : instant;
  const key = `${style}|${timeZone}`;
  let format = dateFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat('fr-FR', { dateStyle: style, timeZone });
    dateFormats.set(key, format);
  }
  return `${format.format(date)} à ${clockText(date, timeZone)}`;
}

/** « 1 h 21 », « 2 h », « 45 min », « 0 min » : une durée en minutes, arrondie à la minute. */
export function durationMinutesText(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`;
}

/** « 1 jour », « 7 jours », « 0 jour » : le nom accordé au nombre, sans parenthèses (en français, 0 et 1 au singulier). */
export function countText(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${Math.abs(count) < 2 ? singular : plural}`;
}
