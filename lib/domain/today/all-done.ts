import { doneAsPlanned } from '../done-as-planned.ts';
import { cubicMetersText, mmText } from '../figure-origin.ts';
import type { IrrigationEventRecord } from '../irrigation-event-record.ts';
import { cubicMetersFromMillimeters } from '../units.ts';
import { addDaysToDateKey } from '../water-management.ts';
import { countText, farmDateKey, farmHourText, shortDayText } from './today-text.ts';
import { durationText, type TodayIrrigationLine } from './today-irrigations.ts';

/**
 * « Tout est fait » sur « Votre journée »
 * (docs/aujourdhui-tableau-de-bord-contract.md, section 3.4) : ce que le
 * bouton enregistrera, rangé par jour pour la confirmation. Il couvre les
 * irrigations planifiées « En retard », « Non faites » et celles du jour dont
 * l'heure est passée, une fois leur heure de fin prévue passée (T15) ; jamais
 * une irrigation à venir, une proposition à valider ni une irrigation
 * démarrée. Rien à couvrir : pas de bouton.
 */

type AllDoneItem = {
  eventEquipmentId: string;
  /** « 7 h à 8 h 30 ». */
  hours: string;
  /** « Goutte-à-goutte B · Réglage 1 ». */
  title: string;
  /** « planches P1 et P2 · 1 h 30 · 12 mm · 0,60 m³ » ; le volume manque quand il n'est pas connu. */
  detail: string;
  durationSeconds: number;
  /** `null` quand une surface mouillée manque : le volume est inconnu, jamais zéro (D-003). */
  cubicMeters: number | null;
  /**
   * La confirmation d'une ligne de « Fait comme prévu » (audit ergonomique,
   * lot 3, point 6.5, F43) : l'irrigation, son jour, ses heures et son
   * volume, et le rappel qu'elle ne se corrigera plus (D-006).
   */
  confirmation: string;
};

type AllDoneDay = {
  /** Le jour civil à la ferme, `AAAA-MM-JJ`. */
  day: string;
  /** « Aujourd’hui », « Hier », « Lun. 2 nov. ». */
  title: string;
  /** « 3 irrigations, de 5 h à 20 h, sur 4 planches · 2 h 30 · 1,20 m³ ». */
  summary: string;
  items: AllDoneItem[];
};

export type AllDone = {
  /** Ce que le bouton annonce : « Tout est fait (21) ». */
  count: number;
  /** Les jours, du plus ancien au plus récent ; dans chaque jour, l'ordre de l'heure. */
  days: AllDoneDay[];
  /** Commencées à leur heure prévue sans être finies : dites dans la confirmation, pas encore enregistrables (T15). */
  notOver: { title: string; endHour: string }[];
};

/** Ce que dit la confirmation, en tête puis au pied de la liste. */
export const ALL_DONE_TEXT = {
  recordedAs: 'Chaque irrigation cochée sera enregistrée telle que prévue : à son heure de début, avec sa durée, son matériel, son réglage et sa dose prévus.',
  final: 'Une irrigation enregistrée ne se modifie plus : décochez ce qui n’a pas été fait.',
  notHere: 'Les irrigations à venir n’y sont pas, ni les propositions à valider : une irrigation s’enregistre faite une fois son heure de fin prévue passée.',
} as const;

/**
 * « Enregistrer comme faite Goutte-à-goutte B · Réglage 1, hier de 7 h à
 * 8 h 30, 0,60 m³ ? Elle ne se corrigera plus dans le module. » : la même
 * confirmation sur « Arrosages » et sur « Aujourd'hui ». Un volume inconnu se
 * dit inconnu, jamais zéro (D-003).
 */
export function doneAsPlannedConfirmation(item: Pick<AllDoneItem, 'title' | 'hours' | 'cubicMeters'>, dayTitle: string): string {
  const day = dayTitle.charAt(0).toLocaleLowerCase('fr-FR') + dayTitle.slice(1);
  const volume = item.cubicMeters === null ? 'volume inconnu' : cubicMetersText(item.cubicMeters);
  return `Enregistrer comme faite ${item.title}, ${day} de ${item.hours}, ${volume} ? Elle ne se corrigera plus dans le module.`;
}

/** Les confirmations de « Fait comme prévu », par irrigation : seules celles que la règle accepte en ont une. */
export function doneAsPlannedConfirmations(done: AllDone | null): ReadonlyMap<string, string> {
  return new Map((done?.days ?? []).flatMap((day) => day.items.map((item) => [item.eventEquipmentId, item.confirmation] as const)));
}

function capitalized(text: string): string {
  return text.charAt(0).toLocaleUpperCase('fr-FR') + text.slice(1);
}

function dayTitle(day: string, today: string): string {
  if (day === today) return 'Aujourd’hui';
  if (day === addDaysToDateKey(today, -1)) return 'Hier';
  return capitalized(shortDayText(day));
}

/** Le volume prévu : la dose de chaque planche sur sa surface mouillée ; inconnu si l'une manque. */
function plannedCubicMeters(event: IrrigationEventRecord): number | null {
  let total = 0;
  for (const application of event.equipment.applications) {
    const area = application.wettedAreaSquareMeters;
    if (area === null || !Number.isFinite(area)) return null;
    total += cubicMetersFromMillimeters(Math.max(0, application.plannedAmountMm), area);
  }
  return total;
}

function sumOrNull(values: readonly (number | null)[]): number | null {
  let total = 0;
  for (const value of values) {
    if (value === null) return null;
    total += value;
  }
  return total;
}

function daySummary(lines: readonly TodayIrrigationLine[], items: readonly AllDoneItem[]): string {
  const beds = new Set(lines.flatMap((line) => line.bedIds));
  const first = lines[0];
  const last = lines[lines.length - 1];
  const span = lines.length === 1 ? `à ${first.hour}` : `de ${first.hour} à ${last.hour}`;
  const head = `${countText(lines.length, 'irrigation', 'irrigations')}, ${span}${beds.size > 0 ? `, sur ${countText(beds.size, 'planche', 'planches')}` : ''}`;
  const volume = sumOrNull(items.map((item) => item.cubicMeters));
  const doses = lines.flatMap((line) => (line.doseMm === null ? [] : [line.doseMm]));
  const water = volume !== null ? cubicMetersText(volume) : doses.length > 0 ? `jusqu’à ${mmText(Math.max(...doses))}` : null;
  return [head, durationText(items.reduce((sum, item) => sum + item.durationSeconds, 0)), water].filter(Boolean).join(' · ');
}

/**
 * Les irrigations que « Tout est fait » enregistrera, lues dans les lignes de
 * « Votre journée » (les retards, puis ce qui est à faire aujourd'hui) et
 * jugées par `doneAsPlanned`, la règle que le serveur rejuge à
 * l'enregistrement.
 */
export function allDone(input: {
  lines: readonly TodayIrrigationLine[];
  events: readonly IrrigationEventRecord[];
  now: Date;
}): AllDone | null {
  const today = farmDateKey(input.now);
  const byId = new Map(input.events.map((event) => [event.equipment.id, event]));
  const covered: { line: TodayIrrigationLine; item: AllDoneItem }[] = [];
  const notOver: AllDone['notOver'] = [];
  const seen = new Set<string>();
  for (const line of [...input.lines].sort((a, b) => a.startAt.localeCompare(b.startAt) || a.key.localeCompare(b.key))) {
    const event = line.eventEquipmentId ? byId.get(line.eventEquipmentId) : undefined;
    if (!event || seen.has(event.equipment.id) || !(Date.parse(line.startAt) <= input.now.getTime())) continue;
    seen.add(event.equipment.id);
    const result = doneAsPlanned(event, input.now);
    if (!result.ok) {
      if (result.refusal === 'not-over') notOver.push({ title: line.title, endHour: farmHourText(event.equipment.plannedEndAt ?? line.startAt) });
      continue;
    }
    const cubicMeters = plannedCubicMeters(event);
    const hours = `${line.hour} à ${farmHourText(result.record.actualEndAt)}`;
    covered.push({
      line,
      item: {
        eventEquipmentId: result.record.eventEquipmentId,
        hours,
        title: line.title,
        detail: [line.bedsText, line.durationText, line.doseText, cubicMeters === null ? null : cubicMetersText(cubicMeters)].filter(Boolean).join(' · '),
        durationSeconds: result.record.actualDurationSeconds,
        cubicMeters,
        confirmation: doneAsPlannedConfirmation({ title: line.title, hours, cubicMeters }, dayTitle(line.day, today)),
      },
    });
  }
  if (covered.length === 0) return null;
  const days = new Map<string, typeof covered>();
  for (const entry of covered) days.set(entry.line.day, [...(days.get(entry.line.day) ?? []), entry]);
  return {
    count: covered.length,
    days: [...days.entries()].map(([day, entries]) => ({
      day,
      title: dayTitle(day, today),
      summary: daySummary(entries.map((entry) => entry.line), entries.map((entry) => entry.item)),
      items: entries.map((entry) => entry.item),
    })),
    notOver,
  };
}
