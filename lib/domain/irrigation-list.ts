import type { IrrigationEventRecord } from './irrigation-event-record.ts';
import { plannedIrrigationLateness, type PlannedIrrigationLateness } from './planned-irrigation.ts';
import { farmDateKey, farmHourText, shortDayText } from './today/today-text.ts';
import { addDaysToDateKey } from './water-management.ts';

/**
 * La liste des irrigations à venir ou à terminer de la page « Arrosages »
 * (audit ergonomique, point 6, 3.8 quater lot 3,
 * docs/audit-ergonomie-lot3-contract.md, section 3, précision F47) : le bloc
 * « À traiter » en tête — les irrigations « Non faite » et « En retard », la
 * règle R14 de la page —, puis une ligne par irrigation, rangée par jour. La
 * ligne dit l'heure, le matériel, le volume et l'état ; la carte entière
 * s'ouvre d'un geste. Aucune règle ne change : le retard est celui de
 * `plannedIrrigationLateness`.
 */

export type IrrigationListItem = {
  event: IrrigationEventRecord;
  /** `null` quand elle n'est ni en retard ni non faite. */
  lateness: PlannedIrrigationLateness | null;
  /** « 7 h », « 18 h 30 » : l'heure de début prévue à la ferme. */
  hour: string;
  /** Le jour civil à la ferme du début prévu, `AAAA-MM-JJ`. */
  day: string;
  /** « Non faite », « En retard », « Planifiée », « Partielle ». */
  status: string;
};

type IrrigationListDay = {
  day: string;
  /** « Aujourd’hui », « Demain », « Hier », « Mer. 11 nov. ». */
  title: string;
  items: IrrigationListItem[];
};

export type IrrigationList = {
  /** « À traiter » : non faites puis en retard, les plus anciennes d'abord. */
  toHandle: IrrigationListItem[];
  /** Les autres, par jour, dans l'ordre du temps. */
  days: IrrigationListDay[];
};

const LATENESS_STATUS: Record<PlannedIrrigationLateness, string> = {
  missed: 'Non faite',
  late: 'En retard',
};

function capitalized(text: string): string {
  return text.charAt(0).toLocaleUpperCase('fr-FR') + text.slice(1);
}

/** « Aujourd’hui », « Demain », « Hier », sinon « Mer. 11 nov. ». */
export function listDayTitle(day: string, today: string): string {
  if (day === today) return 'Aujourd’hui';
  if (day === addDaysToDateKey(today, 1)) return 'Demain';
  if (day === addDaysToDateKey(today, -1)) return 'Hier';
  return capitalized(shortDayText(day));
}

/** Le début qui range une irrigation : le prévu, sinon le réel (une partielle), sinon sa création. */
function startOf(event: IrrigationEventRecord): string {
  return event.equipment.plannedStartAt ?? event.equipment.actualStartAt ?? event.createdAt;
}

function statusOf(event: IrrigationEventRecord, lateness: PlannedIrrigationLateness | null): string {
  if (lateness) return LATENESS_STATUS[lateness];
  return event.status === 'partially_completed' ? 'Partielle' : 'Planifiée';
}

/**
 * Les irrigations planifiées ou à terminer, rangées : « À traiter » d'abord
 * (cas 5), puis une ligne par irrigation, groupée par jour. Une irrigation en
 * cours n'y est pas : elle a son minuteur au-dessus.
 */
export function irrigationList(events: readonly IrrigationEventRecord[], toleranceMinutes: number, now: Date): IrrigationList {
  const today = farmDateKey(now);
  const items = [...events]
    .sort((a, b) => startOf(a).localeCompare(startOf(b)) || a.equipment.id.localeCompare(b.equipment.id))
    .map((event): IrrigationListItem => {
      const lateness = plannedIrrigationLateness(event, toleranceMinutes, now);
      const start = startOf(event);
      return { event, lateness, hour: farmHourText(start), day: farmDateKey(start), status: statusOf(event, lateness) };
    });
  const toHandle = [
    ...items.filter((item) => item.lateness === 'missed'),
    ...items.filter((item) => item.lateness === 'late'),
  ];
  const days = new Map<string, IrrigationListItem[]>();
  for (const item of items) {
    if (item.lateness) continue;
    days.set(item.day, [...(days.get(item.day) ?? []), item]);
  }
  return {
    toHandle,
    days: [...days.entries()].map(([day, dayItems]) => ({ day, title: listDayTitle(day, today), items: dayItems })),
  };
}
