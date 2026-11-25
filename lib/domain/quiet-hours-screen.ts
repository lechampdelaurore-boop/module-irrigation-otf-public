import { isQuietEndTime, isQuietStartTime, type QuietHoursSettings } from './notification-quiet-hours.ts';
import { eveningTimeText, isEveningTime } from './today/evening-reminder.ts';
import { MINUTES_PER_HOUR } from './units.ts';

/**
 * Les phrases de l'écran des heures de silence (6 undecies,
 * docs/heures-de-silence-contract.md, section 4 ; H3, D-326) : la ligne du
 * pli, ce qui passe et ce qui attend, et l'avertissement du rappel du soir.
 * La règle elle-même reste dans `notification-quiet-hours.ts` : l'écran ne
 * fait que la dire.
 */

/**
 * Le passage du rappel du soir, chaque heure à cinq minutes, heure de Paris
 * (`5 * * * *`, F705) : un rappel est dû dès que l'heure réglée est atteinte.
 */
const EVENING_PASS_MINUTE = 5;

/** « de 22 h à 6 h », « de 21 h 30 à 7 h 15 ». */
export function quietRangeText(settings: Pick<QuietHoursSettings, 'start' | 'end'>): string {
  return `de ${eveningTimeText(settings.start)} à ${eveningTimeText(settings.end)}`;
}

/** La ligne du pli « Messages de la ferme » : le réglage enregistré, comme le matin et le soir. */
export function quietHoursFoldText(settings: QuietHoursSettings): string {
  return settings.enabled ? `Silence ${quietRangeText(settings)}.` : 'Heures de silence coupées.';
}

/**
 * La phrase sous le réglage : ce qui passe toujours (la fin d'un arrosage et,
 * case cochée, le gel) et ce qui attend la fin de la plage (S3, S4, S6).
 * Le rappel du soir, qui ne part pas, a son propre avertissement (S5).
 */
export function quietHoursHint(settings: QuietHoursSettings): string {
  if (!settings.enabled) {
    return 'Allumées, elles gardent la nuit les notifications de la ferme jusqu’à l’heure de fin, sauf la fin d’un arrosage.';
  }
  return settings.frostPasses
    ? 'Pendant ces heures, la fin d’un arrosage et les alertes de gel partent toujours ; les autres alertes, le message du matin et les retards d’irrigation attendent la fin des heures de silence.'
    : 'Pendant ces heures, seule la fin d’un arrosage part ; les alertes, gel compris, le message du matin et les retards d’irrigation attendent la fin des heures de silence.';
}

/**
 * F806 : le rappel du soir part au premier passage horaire (hh:05) qui suit
 * l'heure réglée, pas à l'heure réglée elle-même : réglé à 21 h 30, il part
 * à 22 h 05. « 22:05 » quand ce passage tombe dans la plage allumée (début
 * inclus, fin exclue, S1), et le rappel ne partira pas (S5) ; `null` sinon,
 * rappel coupé ou réglage hors des bornes compris.
 */
export function eveningReminderSilencedAt(quiet: QuietHoursSettings, evening: { enabled: boolean; time: string }): string | null {
  if (!quiet.enabled || !evening.enabled || !isEveningTime(evening.time)) return null;
  if (!isQuietStartTime(quiet.start) || !isQuietEndTime(quiet.end)) return null;
  const pass = eveningPassMinutes(minutesOf(evening.time));
  const inWindow = pass >= minutesOf(quiet.start) || pass < minutesOf(quiet.end);
  return inWindow ? clockText(pass) : null;
}

/** Le premier passage à hh:05 à l'heure réglée ou après. */
function eveningPassMinutes(minutes: number): number {
  const hourStart = minutes - (minutes % MINUTES_PER_HOUR);
  const pass = hourStart + EVENING_PASS_MINUTE;
  return pass >= minutes ? pass : pass + MINUTES_PER_HOUR;
}

/** L'avertissement du rappel du soir (section 4) : son heure réglée et celle du passage qui ne l'enverra pas. */
export function eveningReminderSilencedText(eveningTime: string, passTime: string): string {
  return `Le rappel du soir (${eveningTimeText(eveningTime)}) ne partira pas : son envoi, à ${eveningTimeText(passTime)}, tombe dans les heures de silence.`;
}

function minutesOf(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour * MINUTES_PER_HOUR + minute;
}

function clockText(minutes: number): string {
  return `${String(Math.floor(minutes / MINUTES_PER_HOUR)).padStart(2, '0')}:${String(minutes % MINUTES_PER_HOUR).padStart(2, '0')}`;
}
