import { MILLISECONDS_PER_DAY, MINUTES_PER_HOUR } from '../units.ts';
import { FARM_TIME_ZONE, dateKeyInTimeZone } from '../water-management.ts';

/**
 * Les mots de la page « Aujourd'hui » et de la zone « Fiabilité du calcul »
 * (audit ergonomique, points 1 et 3, 3.8 quater lot 2,
 * docs/audit-ergonomie-lot2-contract.md, sections 5 et 6) : des dates
 * courtes, des listes de noms tronquées, des pluriels. Les mêmes mots
 * partout (précision F9).
 */

const shortDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const dayWithYear = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** Les noms écrits en entier dans une phrase ; les autres se comptent. */
const NAMES_SHOWN = 3;

/** « sam. 14 nov. » : un jour civil à la ferme, lu tel quel. */
export function shortDayText(dateKey: string): string {
  return shortDay.format(new Date(`${dateKey}T12:00:00.000Z`));
}

/** « 5 oct. 2026 » : une date d'observation, avec son année. */
export function dateWithYearText(dateKey: string): string {
  return dayWithYear.format(new Date(`${dateKey}T12:00:00.000Z`));
}

/** « 6 h 02 », « 18 h » : l'heure à la ferme, comme sur les autres pages. */
export function farmHourText(instant: string, timeZone = FARM_TIME_ZONE): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone })
    .formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
  const hour = String(Number(parts.hour));
  return parts.minute === '00' ? `${hour} h` : `${hour} h ${parts.minute}`;
}

/** Les minutes écoulées depuis minuit à la ferme : 6 h 30 vaut 390 (la frise de la journée). */
export function farmMinutesOfDay(instant: string | Date, timeZone = FARM_TIME_ZONE): number {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone })
    .formatToParts(typeof instant === 'string' ? new Date(instant) : instant).map((part) => [part.type, part.value]));
  return Number(parts.hour) * MINUTES_PER_HOUR + Number(parts.minute);
}

/** Le jour civil à la ferme d'un instant. */
export function farmDateKey(instant: string | Date, timeZone = FARM_TIME_ZONE): string {
  return dateKeyInTimeZone(typeof instant === 'string' ? new Date(instant) : instant, timeZone);
}

/** Les jours entre deux jours civils, `AAAA-MM-JJ` : du 5 octobre au 12 novembre, 38. */
export function daysBetween(fromDateKey: string, toDateKey: string): number {
  return Math.round((Date.parse(`${toDateKey}T00:00:00.000Z`) - Date.parse(`${fromDateKey}T00:00:00.000Z`)) / MILLISECONDS_PER_DAY);
}

/** « 1 jour », « 38 jours ». */
export function countText(count: number, singular: string, plural: string): string {
  return `${count} ${count > 1 ? plural : singular}`;
}

/** « Laitue, Fenouil », « A, B, C et 2 autres » : l'énumération après un compte, trois noms au plus, les autres comptés. */
export function namesText(names: readonly string[]): string {
  const shown = names.slice(0, NAMES_SHOWN).join(', ');
  const rest = names.length - NAMES_SHOWN;
  return rest > 0 ? `${shown} et ${countText(rest, 'autre', 'autres')}` : shown;
}

/** Les noms rangés dans l'ordre naturel (B9-9 avant B9-10), sans doublon. */
export function sortedNames(names: Iterable<string>): string[] {
  return [...new Set(names)].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
}
