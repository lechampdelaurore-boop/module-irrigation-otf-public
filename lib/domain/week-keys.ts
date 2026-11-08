import type { WeekKey } from './domain.ts';
import { MILLISECONDS_PER_DAY } from './units.ts';
import { addDaysToDateKey } from './water-management.ts';

/**
 * Semaines ISO 8601, `AAAA-Wss` : c'est l'unité du plan de culture d'Ouvre ta
 * ferme (docs/series-contract.md, « Ce que l'API fournit »). Elles vont du
 * lundi au dimanche, comme les nôtres (D-004) ; la semaine 1 est celle qui
 * contient le 4 janvier, et l'année d'une semaine est celle de son jeudi —
 * le 29 décembre 2025 est en `2026-W01`, le 1er janvier 2027 en `2026-W53`.
 */

// Une semaine ISO compte sept jours ; le jeudi est le quatrième, il décide de l'année.
const DAYS_PER_WEEK = 7;
const THURSDAY_OFFSET_FROM_MONDAY = 3;
const WEEK_KEY_PATTERN = /^(\d{4})-W(\d{2})$/;

export function isWeekKey(value: unknown): value is WeekKey {
  return typeof value === 'string' && WEEK_KEY_PATTERN.test(value) && weekStartDateKeyFromWeekKey(value) !== null;
}

/** La semaine ISO d'un jour `AAAA-MM-JJ`. */
export function weekKeyFromDateKey(dateKey: string): WeekKey {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) throw new Error('Date invalide.');
  const daysSinceMonday = (date.getUTCDay() + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK;
  const thursday = new Date(date);
  thursday.setUTCDate(date.getUTCDate() - daysSinceMonday + THURSDAY_OFFSET_FROM_MONDAY);
  const year = thursday.getUTCFullYear();
  const firstThursday = thursdayOfFirstWeek(year);
  const week = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (DAYS_PER_WEEK * MILLISECONDS_PER_DAY));
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** Le lundi d'une semaine ISO, en `AAAA-MM-JJ` ; `null` si la semaine n'existe pas. */
export function weekStartDateKeyFromWeekKey(weekKey: string): string | null {
  const match = WEEK_KEY_PATTERN.exec(weekKey);
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (week < 1 || week > weeksInYear(year)) return null;
  const mondayOfFirstWeek = addDaysToDateKey(thursdayOfFirstWeek(year).toISOString().slice(0, 10), -THURSDAY_OFFSET_FROM_MONDAY);
  return addDaysToDateKey(mondayOfFirstWeek, (week - 1) * DAYS_PER_WEEK);
}

/** Le dimanche d'une semaine ISO. */
export function weekEndDateKeyFromWeekKey(weekKey: string): string | null {
  const monday = weekStartDateKeyFromWeekKey(weekKey);
  return monday === null ? null : addDaysToDateKey(monday, DAYS_PER_WEEK - 1);
}

/** Ordre chronologique de deux semaines ISO, négatif quand `a` précède `b`. */
export function compareWeekKeys(a: WeekKey, b: WeekKey): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function thursdayOfFirstWeek(year: number): Date {
  // Le 4 janvier est toujours en semaine 1 ; son jeudi est celui de la semaine 1.
  const january4 = new Date(Date.UTC(year, 0, 4, 12));
  const daysSinceMonday = (january4.getUTCDay() + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK;
  january4.setUTCDate(january4.getUTCDate() - daysSinceMonday + THURSDAY_OFFSET_FROM_MONDAY);
  return january4;
}

function weeksInYear(year: number): number {
  // Une année ISO a 53 semaines quand le 28 décembre tombe en semaine 53.
  return Number(weekKeyFromDateKey(`${year}-12-28`).slice(-2));
}
