import { addDaysToDateKey, dateKeyInTimeZone, FARM_TIME_ZONE } from '../water-management.ts';

/**
 * Le geste « J'ai fait l'export du … » de la page d'état (4.5, PR 4 ;
 * docs/tranche-4-contract.md, 10 bis.9, et 10 bis.14, F625) : l'exploitant
 * note le jour de son export hebdomadaire, fait sur son ordinateur. La date
 * notée devient la dernière réussite de la tâche « Export hors Cloudflare »
 * du registre, que la veille surveille comme les autres.
 *
 * - un jour à venir, ou de plus de 30 jours, est refusé ;
 * - un jour plus ancien que l'export déjà noté est refusé : la dernière
 *   réussite ne recule jamais ;
 * - le jour même compte à l'heure du geste ; un jour passé, à midi (temps
 *   universel), le milieu de la journée de Paris.
 */

export const OFFSITE_EXPORT_OLDEST_DAYS = 30;

export type OffsiteExportDates = { today: string; earliest: string };

export type OffsiteExportDecision =
  | { ok: true; at: string; day: string }
  | { ok: false; message: string };

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Les jours que le formulaire propose : d'aujourd'hui à 30 jours avant, à l'heure de Paris. */
export function offsiteExportDates(now: Date): OffsiteExportDates {
  const today = dateKeyInTimeZone(now, FARM_TIME_ZONE);
  return { today, earliest: addDaysToDateKey(today, -OFFSITE_EXPORT_OLDEST_DAYS) };
}

/** « 18/11/2026 ». */
export function frenchDay(dateKey: string): string {
  const [year, month, day] = dateKey.split('-');
  return `${day}/${month}/${year}`;
}

export function offsiteExportDecision(day: unknown, now: Date, lastSuccessAt: string | null): OffsiteExportDecision {
  if (typeof day !== 'string' || !DATE_KEY.test(day) || Number.isNaN(Date.parse(`${day}T12:00:00.000Z`))
    || new Date(`${day}T12:00:00.000Z`).toISOString().slice(0, 10) !== day) {
    return { ok: false, message: 'Choisissez le jour de l’export.' };
  }
  const { today, earliest } = offsiteExportDates(now);
  if (day > today) return { ok: false, message: 'Ce jour est à venir : notez l’export une fois fait.' };
  if (day < earliest) return { ok: false, message: `Un export de plus de ${OFFSITE_EXPORT_OLDEST_DAYS} jours ne compte plus : faites-en un nouveau.` };
  if (lastSuccessAt !== null && Number.isFinite(Date.parse(lastSuccessAt))) {
    const noted = dateKeyInTimeZone(new Date(lastSuccessAt), FARM_TIME_ZONE);
    if (day === noted) return { ok: false, message: `L’export du ${frenchDay(day)} est déjà noté.` };
    if (day < noted) return { ok: false, message: `Un export plus récent est déjà noté : celui du ${frenchDay(noted)}.` };
  }
  return { ok: true, day, at: day === today ? now.toISOString() : `${day}T12:00:00.000Z` };
}
