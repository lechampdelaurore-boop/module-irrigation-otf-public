import { compareNamesNaturally } from '../bed-order.ts';
import { pageHref } from '../features/pages.ts';
import type { IrrigationEventRecord } from '../irrigation-event-record.ts';
import { isWaitingPlannedIrrigation } from '../planned-irrigation.ts';
import { phoneNoticeAlarmKeys } from './phone-notice-alarm.ts';
import { farmDateKey, farmMinutesOfDay, namesText } from './today-text.ts';

/**
 * Le rappel du soir (amélioration n° 2,
 * docs/ameliorations-6-2-3-7-contract.md, section 4.3, F704, F705, F714) :
 * à l'heure que la ferme règle, de 17 h à 22 h au quart d'heure (19 h par
 * défaut, heure de Paris), un message dit les arrosages validés du jour
 * jamais confirmés — une irrigation planifiée dont la fin prévue est passée
 * aujourd'hui et qui attend encore un geste. Il ne confirme jamais rien
 * lui-même (D-006) : un clic ouvre « Aujourd'hui », où « Fait comme prévu »
 * et « Tout est fait » existent déjà. Rien quand tout est confirmé.
 */

export const EVENING_REMINDER_DEFAULT = true;
export const EVENING_REMINDER_DEFAULT_TIME = '19:00';

const FIRST_EVENING_MINUTES = 17 * 60;
const LAST_EVENING_MINUTES = 22 * 60;
const EVENING_STEP_MINUTES = 15;
/** Passé deux heures après l'heure réglée, un passage en retard ne rattrape plus le rappel (§4.3.3). */
const LATE_PASS_MINUTES = 2 * 60;

/** Les heures proposées : « 17:00 », « 17:15 », … « 22:00 ». */
export const EVENING_TIMES: readonly string[] = Array.from(
  { length: (LAST_EVENING_MINUTES - FIRST_EVENING_MINUTES) / EVENING_STEP_MINUTES + 1 },
  (_, index) => clockText(FIRST_EVENING_MINUTES + index * EVENING_STEP_MINUTES),
);

export function isEveningTime(value: unknown): value is string {
  return typeof value === 'string' && EVENING_TIMES.includes(value);
}

/** « 19 h », « 19 h 15 » : l'heure comme l'écran l'écrit. */
export function eveningTimeText(time: string): string {
  const [hour, minute] = time.split(':');
  return minute === '00' ? `${Number(hour)} h` : `${Number(hour)} h ${minute}`;
}

/**
 * Le rappel est dû quand l'heure de Paris a atteint l'heure réglée, et pas
 * plus de deux heures après (F714) : jamais avant l'heure choisie, et un
 * déclencheur en panne ne rattrape pas un rappel en pleine nuit. La prise du
 * jour empêche un second rappel le même jour, changement d'heure compris.
 */
export function eveningReminderDue(time: string, now: Date): boolean {
  if (!isEveningTime(time)) return false;
  const elapsed = farmMinutesOfDay(now) - minutesOf(time);
  return elapsed >= 0 && elapsed < LATE_PASS_MINUTES;
}

/** Un passage avant 17 h, heure de Paris, n'a aucun rappel à faire : il ne lit rien. */
export function eveningPassUseful(now: Date): boolean {
  return farmMinutesOfDay(now) >= FIRST_EVENING_MINUTES;
}

export type EveningReminder = {
  parisDay: string;
  title: string;
  body: string;
  /** L'identifiant d'alarme du Worker : l'espace et le jour, jamais deux rappels le même jour pour une ferme, jamais une alarme partagée entre deux fermes (§4.4, F744). */
  alarmId: string;
  tag: string;
  url: string;
  /** Un nombre, pour le journal : jamais un nom. */
  count: number;
};

export function eveningReminder({ now, workspaceId, events }: {
  now: Date;
  /** L'espace de la ferme : il entre dans l'identifiant d'alarme et l'étiquette (§4.4, F744). */
  workspaceId: string;
  events: readonly IrrigationEventRecord[];
}): EveningReminder | null {
  const parisDay = farmDateKey(now);
  const unconfirmed = events
    .filter(isWaitingPlannedIrrigation)
    .filter((event) => {
      const end = event.equipment.plannedEndAt;
      return Boolean(end) && Date.parse(end ?? '') <= now.getTime() && farmDateKey(end ?? '') === parisDay;
    })
    .sort((a, b) => Date.parse(a.equipment.plannedStartAt ?? '') - Date.parse(b.equipment.plannedStartAt ?? '')
      || compareNamesNaturally(a.equipment.equipmentSnapshot.name, b.equipment.equipmentSnapshot.name));
  if (unconfirmed.length === 0) return null;
  const names = namesText([...new Set(unconfirmed.map((event) => event.equipment.equipmentSnapshot.name))]);
  const count = unconfirmed.length;
  const body = count === 1
    ? `1 arrosage prévu aujourd’hui n’est pas confirmé : ${names}. L’avez-vous fait ?`
    : `${count} arrosages prévus aujourd’hui ne sont pas confirmés : ${names}. Les avez-vous faits ?`;
  return {
    parisDay,
    title: 'Arrosages à confirmer',
    body,
    ...phoneNoticeAlarmKeys('evening', workspaceId, parisDay),
    url: pageHref('aujourdhui'),
    count,
  };
}

function minutesOf(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function clockText(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
