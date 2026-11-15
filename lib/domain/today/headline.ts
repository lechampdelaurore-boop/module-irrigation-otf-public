import { celsiusText } from '../crop-alerts/text.ts';
import type { TodayShortage, TodayTomorrow } from './ahead.ts';
import type { TodayIrrigationLine } from './today-irrigations.ts';
import type { TodayWeatherDay } from './weather-days.ts';

/**
 * L'en-tête du tableau de bord « Aujourd'hui »
 * (docs/aujourdhui-tableau-de-bord-contract.md, sections 3.2 et 3.5) : la
 * date en toutes lettres, une phrase de résumé et des pastilles qui mènent
 * au bloc. Elles ne disent que ce que disent les blocs présents : une case
 * décochée n'y parle pas, et une donnée inconnue n'y devient jamais « tout
 * va bien » (D-003). Quand « Planning » est coché, l'en-tête dit aussi ce
 * qui attend après le jour : l'eau qui manque à la semaine et les arrosages
 * de demain à valider (audit ergonomique final, lot A, R1, F277 et F278).
 */

type ChipTarget = 'day' | 'weather' | 'reliability' | 'shortage';

type TodayChip = {
  key: string;
  /** `late`, `alert`, `data`, `unknown` et `shortage` demandent un regard ; `todo` est à faire ; `ok` est calme. */
  tone: 'late' | 'todo' | 'alert' | 'data' | 'unknown' | 'shortage' | 'ok';
  icon: 'clock' | 'drop' | 'frost' | 'bell' | 'cloud' | 'check' | 'shield' | 'calendar';
  text: string;
  /** Le bloc où mène la pastille. */
  target: ChipTarget;
};

export type TodayHeadline = {
  /** « Jeudi 12 novembre ». */
  title: string;
  sentence: string;
  chips: TodayChip[];
};

export type HeadlineInputs = {
  today: string;
  /** `null` quand ni le planning ni les arrosages ne sont cochés. */
  irrigations: { late: readonly TodayIrrigationLine[]; todo: readonly TodayIrrigationLine[] } | null;
  /** `null` quand aucune alerte n'est cochée. */
  weather: { tone: 'alert' | 'unknown' | 'calm'; days: readonly TodayWeatherDay[]; calmText: string | null } | null;
  /** `null` quand la zone « Fiabilité du calcul » n'existe pas. */
  reliabilityCount: number | null;
  /** Les arrosages de demain à valider ; `null` sans « Planning » ou sans proposition demain. */
  tomorrow: TodayTomorrow | null;
  /** L'eau qui manque à la semaine ; `null` sans « Planning » ou sans manque. */
  shortage: TodayShortage | null;
};

const longDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

function capitalized(text: string): string {
  return text.charAt(0).toLocaleUpperCase('fr-FR') + text.slice(1);
}

/** « Jeudi 12 novembre » : un jour civil à la ferme, en toutes lettres. */
export function longDayTitle(dateKey: string): string {
  return capitalized(longDay.format(new Date(`${dateKey}T12:00:00.000Z`)));
}

/** « aujourd’hui », « le ven. 13 nov. ». */
function when(day: TodayWeatherDay, today: string): string {
  return day.date === today ? 'aujourd’hui' : `le ${day.label}`;
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many.replace('{n}', String(count));
}

function irrigationParts(irrigations: NonNullable<HeadlineInputs['irrigations']>, aheadSaid: boolean): { sentences: string[]; chips: TodayChip[] } {
  const late = irrigations.late.length;
  const todo = irrigations.todo.length;
  const proposed = irrigations.todo.filter((line) => line.tone === 'proposed').length;
  const sentences: string[] = [];
  const chips: TodayChip[] = [];
  if (late > 0) {
    sentences.push(plural(late, 'Une irrigation est à rattraper.', '{n} irrigations sont à rattraper.'));
    chips.push({ key: 'late', tone: 'late', icon: 'clock', text: `${late} à rattraper`, target: 'day' });
  }
  if (todo > 0) {
    const planned = plural(todo, 'Une irrigation est prévue aujourd’hui', '{n} irrigations sont prévues aujourd’hui');
    sentences.push(`${planned}${proposed > 0 ? `, dont ${proposed} à valider` : ''}.`);
    chips.push({ key: 'todo', tone: 'todo', icon: 'drop', text: `${todo} à faire aujourd’hui`, target: 'day' });
  }
  // « Rien à arroser » ne se dit plus quand demain ou la semaine ont quelque chose à dire (F277).
  if (late === 0 && todo === 0 && !aheadSaid) chips.push({ key: 'nothing', tone: 'ok', icon: 'check', text: 'Rien à arroser', target: 'day' });
  return { sentences, chips };
}

function weatherParts(weather: NonNullable<HeadlineInputs['weather']>, today: string): { sentences: string[]; chips: TodayChip[] } {
  const alerted = weather.days.find((day) => day.tone === 'alert');
  if (alerted) {
    const frost = alerted.notes.find((note) => note.startsWith('Gel à '));
    const minimum = alerted.minimumCelsius;
    if (frost && minimum !== null) {
      return {
        sentences: [`Gel annoncé ${when(alerted, today)} : ${celsiusText(minimum)}.`],
        chips: [{ key: 'weather', tone: 'alert', icon: 'frost', text: `Gel ${when(alerted, today)}`, target: 'weather' }],
      };
    }
    return {
      sentences: [`${alerted.notes[0]} ${when(alerted, today)}.`],
      chips: [{ key: 'weather', tone: 'alert', icon: 'bell', text: `Alerte météo ${when(alerted, today)}`, target: 'weather' }],
    };
  }
  if (weather.tone === 'unknown') {
    return {
      sentences: ['Prévision indisponible : à vérifier.'],
      chips: [{ key: 'weather', tone: 'unknown', icon: 'cloud', text: 'Prévision à vérifier', target: 'weather' }],
    };
  }
  return { sentences: [], chips: [{ key: 'weather', tone: 'ok', icon: 'check', text: 'Rien d’annoncé sur trois jours', target: 'weather' }] };
}

/**
 * Ce qui attend après le jour (F277) : la pastille orange « L'eau manque » en
 * tête, tant qu'une répartition attend, puis celle de demain ; la phrase de
 * demain suit celles du jour. Le manque d'eau, lui, se lit dans l'encadré de
 * l'en-tête, avec la phrase du planning : la phrase de résumé ne le redit pas.
 */
function aheadParts(input: HeadlineInputs): { lead: TodayChip[]; chips: TodayChip[]; sentences: string[] } {
  const lead: TodayChip[] = input.shortage?.decisionPending
    ? [{ key: 'shortage', tone: 'shortage', icon: 'drop', text: 'L’eau manque', target: 'shortage' }]
    : [];
  if (!input.tomorrow) return { lead, chips: [], sentences: [] };
  return {
    lead,
    chips: [{ key: 'tomorrow', tone: 'todo', icon: 'calendar', text: `${input.tomorrow.count} à valider demain`, target: 'day' }],
    sentences: [input.tomorrow.sentence],
  };
}

export function todayHeadline(input: HeadlineInputs): TodayHeadline {
  const aheadSaid = input.tomorrow !== null || input.shortage !== null;
  const irrigation = input.irrigations ? irrigationParts(input.irrigations, aheadSaid) : { sentences: [], chips: [] };
  const weather = input.weather ? weatherParts(input.weather, input.today) : { sentences: [], chips: [] };
  const ahead = aheadParts(input);
  const sentences = [...irrigation.sentences, ...ahead.sentences, ...weather.sentences];
  if (sentences.length === 0) {
    // « Rien d'urgent » seulement si ni le jour, ni demain, ni la semaine n'ont rien à dire (F278).
    if (!aheadSaid) sentences.push('Rien d’urgent aujourd’hui.');
    if (input.weather?.calmText) sentences.push(input.weather.calmText);
  }
  const chips = [...ahead.lead, ...irrigation.chips, ...ahead.chips, ...weather.chips];
  if (input.reliabilityCount !== null) {
    const count = input.reliabilityCount;
    if (count > 0) sentences.push(plural(count, 'Une donnée est à rafraîchir pour que le calcul soit fiable.', '{n} données sont à rafraîchir pour que le calcul soit fiable.'));
    chips.push(count > 0
      ? { key: 'reliability', tone: 'data', icon: 'shield', text: plural(count, '1 donnée à rafraîchir', '{n} données à rafraîchir'), target: 'reliability' }
      : { key: 'reliability', tone: 'ok', icon: 'shield', text: 'Données à jour', target: 'reliability' });
  }
  return { title: longDayTitle(input.today), sentence: sentences.join(' '), chips };
}
