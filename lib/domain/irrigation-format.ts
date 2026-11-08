import { FARM_TIME_ZONE, isValidDateKey, localDateTimeUtc } from './water-management.ts';

export function formatWaterVolumeForMessage(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 3,
  }).format(value);
}

// The server and the browser must render the same farm-local timestamp.
export function formatIrrigationDateTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium', timeStyle: 'short', timeZone,
  }).format(new Date(value));
}

export function formatIrrigationDateTimeInput(value: string | Date, timeZone: string) {
  const date = typeof value === 'string' ? new Date(value) : value;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/**
 * L'instant que désigne une saisie « date et heure », exact inverse de
 * `formatIrrigationDateTimeInput`.
 *
 * Un champ `datetime-local` ne porte pas de fuseau : « 2026-09-25T06:00 » ne
 * dit pas six heures où. `new Date()` le lit dans le fuseau de la machine qui
 * l'exécute : celui du maraîcher dans le navigateur, mais UTC dans un Worker.
 * Un relevé saisi au forage y devenait deux heures plus tard en été, donc
 * refusé comme daté dans le futur, ou enregistré décalé — recette 3.1 bis du
 * 25 septembre 2026, lignes R3 et R20. La saisie est une heure d'horloge à la
 * ferme (D-004) : c'est là, et nulle part ailleurs, qu'elle se lit.
 *
 * Renvoie `null` quand la saisie n'a pas la forme attendue ; l'appelant laisse
 * alors la valeur telle quelle et le domaine la refuse comme date invalide.
 */
export function instantFromIrrigationDateTimeInput(
  value: string,
  timeZone = FARM_TIME_ZONE,
): string | null {
  const saisie = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!saisie) return null;
  const [, dateKey, heures, minutes, secondes] = saisie;
  if (!isValidDateKey(dateKey)) return null;
  const timeOfDay = {
    hour: Number(heures),
    minute: Number(minutes),
    second: Number(secondes ?? '0'),
  };
  if (timeOfDay.hour > 23 || timeOfDay.minute > 59 || timeOfDay.second > 59) return null;
  return localDateTimeUtc(dateKey, timeOfDay, timeZone).toISOString();
}

/** Arrondit à un nombre de décimales : Math.round(valeur × 10ⁿ) / 10ⁿ, sans autre transformation. */
export function roundToDecimals(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
