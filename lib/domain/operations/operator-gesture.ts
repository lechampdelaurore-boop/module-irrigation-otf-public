import { addDaysToDateKey, dateKeyInTimeZone, FARM_TIME_ZONE } from '../water-management.ts';
import type { TaskKey } from './task-registry.ts';

/**
 * Les gestes de la page d'état (4.5, PR 4 ; docs/tranche-4-contract.md,
 * 10 bis.9, 10 bis.14, F625, et 10 bis.16, F636 et F637) : l'exploitant note
 * le jour d'une tâche qu'il fait lui-même, hors du Worker.
 *
 * - « J'ai fait l'export du … » : l'export hebdomadaire, fait sur son
 *   ordinateur (`pnpm backup:export`) ;
 * - « J'ai fait l'essai du … » : l'essai de restauration, joué par le flux
 *   « Essai de restauration » de GitHub Actions (`pnpm backup:rehearse`).
 *
 * Le jour noté devient la dernière réussite de la tâche du registre, que la
 * veille surveille comme les autres. Les mêmes règles pour les deux :
 *
 * - un jour à venir, ou de plus de 30 jours, est refusé ;
 * - un jour plus ancien que celui déjà noté est refusé : la dernière
 *   réussite ne recule jamais ;
 * - le jour même compte à l'heure du geste ; un jour passé, à midi (temps
 *   universel), le milieu de la journée de Paris.
 */

/** Les tâches du registre faites par l'exploitant (`OPERATOR_GESTURE`), chacune avec son geste. */
export type GestureTask = Extract<TaskKey, 'offsite-export' | 'restore-rehearsal'>;

type GestureWords = {
  /** « l’export », « l’essai » : le nom de ce qui est noté, au singulier défini. */
  the: string;
  /** « un export », « un essai ». */
  a: string;
  /** Les noms stables du journal (F618) : le jour noté ; le geste tombé en erreur (pas un refus). */
  recordedEvent: string;
  notRecordedEvent: string;
};

export const OPERATOR_GESTURES: Readonly<Record<GestureTask, GestureWords>> = {
  'offsite-export': { the: 'l’export', a: 'un export', recordedEvent: 'offsite_export_recorded', notRecordedEvent: 'offsite_export_not_recorded' },
  'restore-rehearsal': { the: 'l’essai', a: 'un essai', recordedEvent: 'restore_rehearsal_recorded', notRecordedEvent: 'restore_rehearsal_not_recorded' },
};

export function isGestureTask(value: unknown): value is GestureTask {
  return typeof value === 'string' && Object.hasOwn(OPERATOR_GESTURES, value);
}

export const GESTURE_OLDEST_DAYS = 30;

export type GestureDates = { today: string; earliest: string };

export type GestureDecision =
  | { ok: true; at: string; day: string }
  | { ok: false; message: string };

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Les jours que le formulaire propose : d'aujourd'hui à 30 jours avant, à l'heure de Paris. */
export function gestureDates(now: Date): GestureDates {
  const today = dateKeyInTimeZone(now, FARM_TIME_ZONE);
  return { today, earliest: addDaysToDateKey(today, -GESTURE_OLDEST_DAYS) };
}

/** « 18/11/2026 ». */
export function frenchDay(dateKey: string): string {
  const [year, month, day] = dateKey.split('-');
  return `${day}/${month}/${year}`;
}

function capitalized(words: string): string {
  return words.replace(/^./, (first) => first.toUpperCase());
}

export function gestureDecision(task: GestureTask, day: unknown, now: Date, lastSuccessAt: string | null): GestureDecision {
  const { the, a } = OPERATOR_GESTURES[task];
  if (typeof day !== 'string' || !DATE_KEY.test(day) || Number.isNaN(Date.parse(`${day}T12:00:00.000Z`))
    || new Date(`${day}T12:00:00.000Z`).toISOString().slice(0, 10) !== day) {
    return { ok: false, message: `Choisissez le jour de ${the}.` };
  }
  const { today, earliest } = gestureDates(now);
  if (day > today) return { ok: false, message: `Ce jour est à venir : notez ${the} une fois fait.` };
  if (day < earliest) return { ok: false, message: `${capitalized(a)} de plus de ${GESTURE_OLDEST_DAYS} jours ne compte plus : faites-en un nouveau.` };
  if (lastSuccessAt !== null && Number.isFinite(Date.parse(lastSuccessAt))) {
    const noted = dateKeyInTimeZone(new Date(lastSuccessAt), FARM_TIME_ZONE);
    if (day === noted) return { ok: false, message: `${capitalized(the)} du ${frenchDay(day)} est déjà noté.` };
    if (day < noted) return { ok: false, message: `${capitalized(a)} plus récent est déjà noté : celui du ${frenchDay(noted)}.` };
  }
  return { ok: true, day, at: day === today ? now.toISOString() : `${day}T12:00:00.000Z` };
}

/** « L’essai du 20/11/2026 est noté. » */
export function gestureRecordedMessage(task: GestureTask, day: string): string {
  return `${capitalized(OPERATOR_GESTURES[task].the)} du ${frenchDay(day)} est noté.`;
}
