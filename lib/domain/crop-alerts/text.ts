import { FARM_TIME_ZONE } from '../water-management.ts';

/** Les mots communs aux textes des alertes par culture. */

const decimal = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

/** « 1 °C », « −4 °C », « +3 °C » quand le signe est demandé. */
export function celsiusText(value: number, signed = false): string {
  const rounded = Math.round(value * 10) / 10;
  const sign = signed && rounded > 0 ? '+' : '';
  return `${sign}${decimal.format(rounded === 0 ? 0 : rounded)} °C`;
}

/** « mercredi 12 novembre » : le jour civil à la ferme, lu tel quel. */
export function dayText(dateKey: string): string {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
    .format(new Date(`${dateKey}T12:00:00.000Z`));
}

/** « 10 h », « 10 h 30 » : l'heure à la ferme. */
export function hourText(instant: string, timeZone = FARM_TIME_ZONE): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone })
    .formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
  const hour = String(Number(parts.hour));
  return parts.minute === '00' ? `${hour} h` : `${hour} h ${parts.minute}`;
}

/** « a », « a et b », « a, b et c ». */
export function listText(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`;
}

/** « planche 4 », « planches 12 et 14 ». */
export function bedsText(bedNames: readonly string[]): string {
  const sorted = [...new Set(bedNames)].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
  return `planche${sorted.length > 1 ? 's' : ''} ${listText(sorted)}`;
}

export function lowerFirst(text: string): string {
  return text.charAt(0).toLocaleLowerCase('fr-FR') + text.slice(1);
}

export function upperFirst(text: string): string {
  return text.charAt(0).toLocaleUpperCase('fr-FR') + text.slice(1);
}
