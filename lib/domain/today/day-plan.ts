import type { IrrigationPageId } from '../features/pages.ts';
import { MINUTES_PER_DAY, MINUTES_PER_HOUR, minutesFromSeconds, percentFromFraction } from '../units.ts';
import { addDaysToDateKey } from '../water-management.ts';
import { countText, farmDateKey, farmMinutesOfDay, shortDayText } from './today-text.ts';
import type { TodayIrrigationLine } from './today-irrigations.ts';

/**
 * « Votre journée » sur le tableau de bord « Aujourd'hui »
 * (docs/aujourdhui-tableau-de-bord-contract.md, sections 3.2 et 3.3) : la
 * frise des irrigations du jour et le repli des retards nombreux. Rien n'est
 * calculé de nouveau : les lignes sont celles des blocs « En retard » et « À
 * faire aujourd'hui » ; ce module dit seulement où les dessiner.
 */

/** T3 : la frise commence à 5 h et finit à 22 h, élargie si une irrigation du jour en sort. */
const DAY_TIMELINE_START_HOUR = 5;
const DAY_TIMELINE_END_HOUR = 22;
/** Une graduation toutes les deux heures. */
const TIMELINE_TICK_HOURS = 2;
/** Les positions se donnent au dixième de pour cent : assez pour l'œil, stable pour les tests. */
const PERCENT_DECIMALS = 10;

type TimelineBar = {
  key: string;
  tone: TodayIrrigationLine['tone'];
  /** La place de la barre sur la frise, en % de sa largeur. */
  leftPercent: number;
  widthPercent: number;
  /** « 6 h, En retard, Goutte-à-goutte B · Réglage 1 » : ce que dit la barre à un lecteur d'écran. */
  label: string;
};

export type DayTimeline = {
  startHour: number;
  endHour: number;
  ticks: { label: string; percent: number }[];
  /** L'heure actuelle sur la frise ; `null` quand elle en sort (la nuit). */
  now: { label: string; percent: number } | null;
  bars: TimelineBar[];
  /**
   * La légende : une entrée par couleur présente sur la frise, avec le statut
   * que disent les cartes, puis « Déjà passé » quand l'heure actuelle y est.
   */
  legend: { tone: TimelineLegendTone; label: string }[];
};

type TimelineLegendTone = TodayIrrigationLine['tone'] | 'past';

/** L'ordre de la légende : le plus pressant d'abord. */
const LEGEND_ORDER: readonly TodayIrrigationLine['tone'][] = ['missed', 'late', 'planned', 'proposed'];
const PAST_LEGEND_LABEL = 'Déjà passé';

function roundedPercent(fraction: number): number {
  return Math.round(percentFromFraction(fraction) * PERCENT_DECIMALS) / PERCENT_DECIMALS;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function hourLabel(minutes: number): string {
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const rest = Math.round(minutes - hours * MINUTES_PER_HOUR);
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`;
}

/**
 * La frise des irrigations du jour : les planifiées, en retard ou non, et les
 * propositions à valider dont le début est aujourd'hui. Aucune : pas de
 * frise. Une barre dure ce que dure l'irrigation prévue.
 */
export function dayTimeline(lines: readonly TodayIrrigationLine[], now: Date): DayTimeline | null {
  const today = farmDateKey(now);
  const todays = lines.filter((line) => line.day === today && line.startAt !== '');
  if (todays.length === 0) return null;
  const spans = todays.map((line) => {
    const start = farmMinutesOfDay(line.startAt);
    return { line, start, end: Math.min(MINUTES_PER_DAY, start + minutesFromSeconds(Math.max(0, line.durationSeconds))) };
  });
  const startHour = Math.min(DAY_TIMELINE_START_HOUR, ...spans.map((span) => Math.floor(span.start / MINUTES_PER_HOUR)));
  const endHour = Math.max(DAY_TIMELINE_END_HOUR, ...spans.map((span) => Math.ceil(span.end / MINUTES_PER_HOUR)));
  const from = startHour * MINUTES_PER_HOUR;
  const length = (endHour - startHour) * MINUTES_PER_HOUR;
  const at = (minutes: number) => roundedPercent((clamp(minutes, from, from + length) - from) / length);
  const ticks: DayTimeline['ticks'] = [];
  for (let hour = Math.ceil(startHour / TIMELINE_TICK_HOURS) * TIMELINE_TICK_HOURS; hour <= endHour; hour += TIMELINE_TICK_HOURS) {
    ticks.push({ label: `${hour} h`, percent: at(hour * MINUTES_PER_HOUR) });
  }
  const nowMinutes = farmMinutesOfDay(now);
  const nowMark = nowMinutes >= from && nowMinutes <= from + length ? { label: hourLabel(nowMinutes), percent: at(nowMinutes) } : null;
  const legend: DayTimeline['legend'] = LEGEND_ORDER.flatMap((tone) => {
    const line = todays.find((item) => item.tone === tone);
    return line ? [{ tone, label: line.status }] : [];
  });
  if (nowMark) legend.push({ tone: 'past', label: PAST_LEGEND_LABEL });
  return {
    startHour,
    endHour,
    ticks,
    now: nowMark,
    bars: spans.map(({ line, start, end }) => ({
      key: line.key,
      tone: line.tone,
      leftPercent: at(start),
      widthPercent: Math.max(0, roundedPercent((end - start) / length)),
      label: `${line.hour}, ${line.status}, ${line.title}`,
    })),
    legend,
  };
}

/** T2 : plus de trois irrigations à rattraper d'un même jour passé se replient en une ligne. */
export const LATE_DAY_GROUP_MIN_COUNT = 4;

type LateDayGroup = {
  kind: 'day';
  /** Le jour civil, `AAAA-MM-JJ`. */
  date: string;
  /** « Hier : 20 irrigations à rattraper », « Lun. 2 nov. : 5 irrigations à rattraper ». */
  title: string;
  /** « de 6 h à 22 h, sur 12 planches ». */
  detail: string;
  count: number;
  /** « Voir les 20 sur « Arrosages » ». */
  open: { page: IrrigationPageId; label: string };
  /** Les lignes du jour, dans l'ordre de l'heure : le geste « Tout est fait » les reprendra. */
  lines: TodayIrrigationLine[];
};

export type LateItem = { kind: 'line'; line: TodayIrrigationLine } | LateDayGroup;

function capitalized(text: string): string {
  return text.charAt(0).toLocaleUpperCase('fr-FR') + text.slice(1);
}

/** « Arrosages » quand la page est cochée, sinon le planning : là où s'ouvrent les cartes des irrigations. */
const PAGE_TITLES: Partial<Record<IrrigationPageId, string>> = { arrosages: 'Arrosages', planning: 'Planning de la semaine' };

/**
 * Les retards, dans l'ordre de l'heure : les jours passés qui en ont plus de
 * trois se replient en une ligne à la place de leur première irrigation ;
 * les retards du jour même restent en cartes, chacune avec son bouton.
 */
export function lateItems(lines: readonly TodayIrrigationLine[], now: Date): LateItem[] {
  const today = farmDateKey(now);
  const yesterday = addDaysToDateKey(today, -1);
  const byDay = new Map<string, TodayIrrigationLine[]>();
  for (const line of lines) {
    if (line.day >= today) continue;
    byDay.set(line.day, [...(byDay.get(line.day) ?? []), line]);
  }
  const items: LateItem[] = [];
  const placed = new Set<string>();
  for (const line of lines) {
    const dayLines = byDay.get(line.day);
    if (!dayLines || dayLines.length < LATE_DAY_GROUP_MIN_COUNT) {
      items.push({ kind: 'line', line });
      continue;
    }
    if (placed.has(line.day)) continue;
    placed.add(line.day);
    const beds = new Set(dayLines.flatMap((item) => item.bedIds));
    const last = dayLines[dayLines.length - 1];
    const dayName = line.day === yesterday ? 'hier' : shortDayText(line.day);
    const page = line.open.page;
    items.push({
      kind: 'day',
      date: line.day,
      title: `${capitalized(dayName)} : ${countText(dayLines.length, 'irrigation', 'irrigations')} à rattraper`,
      detail: `de ${line.hour} à ${last.hour}, sur ${countText(beds.size, 'planche', 'planches')}`,
      count: dayLines.length,
      open: { page, label: `Voir les ${dayLines.length} sur « ${PAGE_TITLES[page] ?? 'Arrosages'} »` },
      lines: dayLines,
    });
  }
  return items;
}
