import { clockText, durationMinutesText } from '../clock-text.ts';
import { volumeText } from '../display-numbers.ts';
import { mmText } from '../figure-origin.ts';
import type { IrrigationEventStatus } from '../irrigation-domain.ts';
import type { IrrigationEventRecord } from '../irrigation-event-record.ts';
import { farmDateKey } from '../today/today-text.ts';
import { weekDateKeys, type WaterDashboardDay } from '../water-management.ts';
import type { WeekState } from './week-heading.ts';

/**
 * « Jour par jour » de la page « Semaine » (simplification, lot S4, PR 2,
 * docs/simplification-s4-contract.md, section 5) : sept lignes, du lundi au
 * dimanche, aujourd'hui marqué. Chaque ligne dit, dans cet ordre et quand il
 * existe : ce qui a été fait (« 4 arrosages faits · 0,9 m³ »), ce qui est en
 * cours (démarré et terminé sur « Aujourd'hui » seulement, S4-h), ce qui est
 * planifié, la pluie avec son mot, la limite dépassée ; sinon « Rien de
 * prévu ». Les créneaux à valider viennent du plan, que la page montre dans
 * le jour.
 *
 * Rien ne se calcule de nouveau (S4-e) : les volumes sont ceux du tableau de
 * l'eau de la semaine, par jour et en m³ ; aucune fonction du domaine ne
 * donne un mm d'irrigation par jour, la ligne n'en invente pas. Mesurée,
 * estimée et annoncée ne se confondent pas (D-006) ; un volume incomplet le
 * dit (D-003). Un jour calme n'est jamais masqué : au téléphone, plusieurs
 * jours calmes de suite se lisent en une ligne qui les compte (F301).
 */

/** Ce que la ligne d'un jour lit d'une irrigation. */
export type WeekDayEvent = {
  id: string;
  /** Le jour de la ferme où elle commence : son début réel, sinon prévu. */
  dateKey: string;
  /** Son début prévu, pour « Planifié · 7 h ». */
  plannedStartAt: string | null;
  status: IrrigationEventStatus;
  /** Le minuteur tourne ou est en pause : « En cours ». */
  running: boolean;
  equipmentName: string;
};

/** Les irrigations de la semaine, réduites à ce que lisent les lignes ; les annulées n'y sont pas. */
export function weekDayEvents(events: readonly IrrigationEventRecord[], weekStart: string): WeekDayEvent[] {
  const dates = new Set(weekDateKeys(weekStart));
  return events.flatMap((event) => {
    if (event.status === 'canceled') return [];
    const { equipment } = event;
    const start = equipment.actualStartAt ?? equipment.timerStartedAt ?? equipment.plannedStartAt ?? event.createdAt;
    const dateKey = farmDateKey(start);
    if (!dates.has(dateKey)) return [];
    return [{
      id: event.id,
      dateKey,
      plannedStartAt: equipment.plannedStartAt,
      status: event.status,
      running: equipment.timerState !== null,
      equipmentName: equipment.equipmentSnapshot.name,
    }];
  });
}

/** Ce que la ligne lit du tableau de l'eau, jour par jour. */
export type WeekWaterDay = Pick<WaterDashboardDay,
  'date' | 'realizedIrrigationCubicMeters' | 'volumeIncomplete' | 'manualRainMm' | 'reanalysisRainMm' | 'forecastRainMm'
  | 'limitExceededByCubicMeters' | 'actualLimitExceededByCubicMeters'>;

/** Les créneaux du plan d'un jour : tous, et ceux qui attendent une validation. */
export type WeekDayPlanSlots = { total: number; toValidate: number };

export type WeekDaysInput = {
  weekStart: string;
  /** Le jour de la ferme. */
  today: string;
  now: Date;
  state: WeekState;
  days: readonly WeekWaterDay[];
  events: readonly WeekDayEvent[];
  /** Les créneaux du plan par jour ; `null` quand le plan ne couvre pas la semaine (S4-l) ou sans Planning. */
  plan: Readonly<Record<string, WeekDayPlanSlots>> | null;
  /** Les irrigations qu'un créneau du plan montre déjà dans son jour : « Planifié » ne les redit pas. */
  shownEventIds?: ReadonlySet<string>;
  /** La pluie compte pour au moins une planche ; une ferme toute sous abri ne la dit pas (D-032). */
  rainMatters: boolean;
};

type RainKind = 'measured' | 'estimated' | 'announced';

const RAIN_WORDS: Readonly<Record<RainKind, { day: string; run: string }>> = {
  measured: { day: 'mesurée', run: 'mesurés' },
  estimated: { day: 'estimée', run: 'estimés' },
  announced: { day: 'annoncée', run: 'annoncés' },
};

export type WeekDayLine = {
  dateKey: string;
  /** « Mercredi 17 novembre ». */
  label: string;
  /** « mer. 17 ». */
  shortLabel: string;
  today: boolean;
  past: boolean;
  /** Ce qui s'est passé ou se passera, dans l'ordre de la section 5, à écrire séparé par « · ». */
  facts: string[];
  /** Le matériel dont l'arrosage tourne : « En cours · Abri des noues » et le lien « Aujourd'hui ». */
  ongoing: string[];
  /** Les créneaux du plan qui attendent leur validation ce jour. */
  toValidate: number;
  /** Rien de fait, rien en cours, rien de planifié ni proposé, aucune limite dépassée. */
  calm: boolean;
  /** « Rien de prévu », « Rien d’arrosé » pour un jour passé ; `null` quand le jour n'est pas calme. */
  calmText: string | null;
  /**
   * Au téléphone, le jour calme qui ouvre une suite de jours calmes porte la
   * ligne de la suite (« mer. 17 au ven. 19 · Rien de prévu · 14 mm de pluie
   * annoncés ») ; les suivants s'y comptent. `null` hors d'une suite.
   */
  calmRun: { role: 'start'; label: string; days: number } | { role: 'member' } | null;
  /** Au téléphone, un jour écoulé de la semaine en cours se replie sous « Jours écoulés (n) », sauf s'il porte un arrosage en retard. */
  fold: 'open' | 'past';
};

export type WeekDaysView = {
  lines: WeekDayLine[];
  /** Les jours repliés sous « Jours écoulés (n) » au téléphone. */
  pastCount: number;
};

const longDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const shortDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });

function noon(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00.000Z`);
}

function capitalized(text: string): string {
  return `${text.charAt(0).toLocaleUpperCase('fr-FR')}${text.slice(1)}`;
}

function mm(value: number): string {
  return mmText(Math.round(value * 10) / 10);
}

/** La pluie du jour et son mot : mesurée d'abord, sinon estimée après coup, sinon annoncée (D-006, D-019). */
function dayRain(day: WeekWaterDay | undefined, past: boolean): { kind: RainKind; mm: number } | null {
  if (!day) return null;
  if (past) {
    if (day.manualRainMm !== null) return { kind: 'measured', mm: Math.max(0, day.manualRainMm) };
    if (day.reanalysisRainMm !== null) return day.reanalysisRainMm > 0 ? { kind: 'estimated', mm: day.reanalysisRainMm } : null;
  }
  // Une mesure saisie pour aujourd'hui l'emporte sur l'annonce.
  if (!past && day.manualRainMm !== null) return { kind: 'measured', mm: Math.max(0, day.manualRainMm) };
  return day.forecastRainMm !== null && day.forecastRainMm > 0 ? { kind: 'announced', mm: day.forecastRainMm } : null;
}

/** « 4 arrosages faits · 0,9 m³ » ; « au moins 0,9 m³ » quand une surface mouillée manque ; « volume inconnu » sans aucun volume sûr. */
function doneText(count: number, day: WeekWaterDay | undefined): string | null {
  const volume = day?.realizedIrrigationCubicMeters ?? 0;
  const incomplete = day?.volumeIncomplete === true;
  if (count === 0 && volume <= 0) return null;
  const water = incomplete ? (volume > 0 ? `au moins ${volumeText(volume)}` : 'volume inconnu') : volumeText(volume);
  if (count === 0) return `${water} arrosés`;
  return `${count} arrosage${count > 1 ? 's' : ''} fait${count > 1 ? 's' : ''} · ${water}`;
}

/** « Planifié · 7 h, 18 h » ; une heure passée sans démarrage le dit (« 7 h, heure passée »). */
function plannedText(events: readonly WeekDayEvent[], now: Date): string | null {
  if (events.length === 0) return null;
  const times = [...events]
    .sort((a, b) => (a.plannedStartAt ?? '').localeCompare(b.plannedStartAt ?? ''))
    .map((event) => {
      if (!event.plannedStartAt) return 'heure inconnue';
      const passed = Date.parse(event.plannedStartAt) < now.getTime();
      return `${clockText(event.plannedStartAt)}${passed ? ', heure passée' : ''}`;
    });
  return `Planifié · ${times.join(' ; ')}`;
}

/**
 * La ligne compacte d'un créneau à valider, au téléphone (section 5,
 * point 3) : « 9 h 29 · Abri des noues · 1 h 21 · 8 mm ». La carte de la
 * proposition, entière, s'ouvre par « Autres choix ».
 */
export function weekSlotText(slot: { startAt: string; equipmentName: string; durationSeconds: number; doseMm: number }): string {
  return `${clockText(slot.startAt)} · ${slot.equipmentName} · ${durationMinutesText(slot.durationSeconds / 60)} · ${mm(slot.doseMm)}`;
}

/** Les lignes des sept jours de la semaine affichée. */
export function weekDayLines(input: WeekDaysInput): WeekDaysView {
  const { today, now, state, plan, rainMatters } = input;
  const shown = input.shownEventIds ?? new Set<string>();
  const waterByDate = new Map(input.days.map((day) => [day.date, day]));
  const lines = weekDateKeys(input.weekStart).map((dateKey): WeekDayLine & { rain: { kind: RainKind; mm: number } | null } => {
    const past = dateKey < today;
    const isToday = dateKey === today;
    const water = waterByDate.get(dateKey);
    const events = input.events.filter((event) => event.dateKey === dateKey);
    const done = events.filter((event) => !event.running && (event.status === 'completed' || event.status === 'partially_completed'));
    const ongoing = events.filter((event) => event.running && event.status !== 'completed');
    const planned = events.filter((event) => !event.running && event.status === 'planned' && !shown.has(event.id));
    const slots = plan?.[dateKey] ?? { total: 0, toValidate: 0 };
    const rain = rainMatters ? dayRain(water, past) : null;
    const limit = (water?.limitExceededByCubicMeters ?? 0) > 0 || (water?.actualLimitExceededByCubicMeters ?? 0) > 0;
    const facts = [
      doneText(done.length, water),
      plannedText(planned, now),
      rain ? `pluie ${mm(rain.mm)}, ${RAIN_WORDS[rain.kind].day}` : null,
      limit ? 'limite dépassée' : null,
    ].filter((fact): fact is string => fact !== null);
    const calm = done.length === 0 && (water?.realizedIrrigationCubicMeters ?? 0) <= 0 && ongoing.length === 0
      && planned.length === 0 && slots.total === 0 && !limit;
    // Un jour écoulé qui porte un arrosage planifié, jamais démarré, reste ouvert (F11).
    const late = planned.some((event) => event.plannedStartAt !== null && Date.parse(event.plannedStartAt) < now.getTime());
    return {
      dateKey,
      label: capitalized(longDay.format(noon(dateKey))),
      shortLabel: shortDay.format(noon(dateKey)),
      today: isToday,
      past,
      facts,
      ongoing: ongoing.map((event) => event.equipmentName),
      toValidate: slots.toValidate,
      calm,
      calmText: calm ? (past ? 'Rien d’arrosé' : 'Rien de prévu') : null,
      calmRun: null,
      fold: state === 'current' && past && !late ? 'past' : 'open',
      rain,
    };
  });
  // Les jours calmes de suite, hors aujourd'hui, du même côté d'aujourd'hui et du même mot de pluie, se comptent ensemble.
  for (let start = 0; start < lines.length; start += 1) {
    const first = lines[start];
    if (!first.calm || first.today) continue;
    let end = start;
    while (end + 1 < lines.length) {
      const next = lines[end + 1];
      if (!next.calm || next.today || next.past !== first.past || next.fold !== first.fold || (next.rain?.kind ?? null) !== (first.rain?.kind ?? null)) break;
      end += 1;
    }
    if (end === start) continue;
    const run = lines.slice(start, end + 1);
    const rainMm = run.reduce((sum, line) => sum + (line.rain?.mm ?? 0), 0);
    const rain = first.rain ? ` · ${mm(rainMm)} de pluie ${RAIN_WORDS[first.rain.kind].run}` : '';
    first.calmRun = { role: 'start', label: `${first.shortLabel} au ${run[run.length - 1].shortLabel} · ${first.calmText}${rain}`, days: run.length };
    for (const member of run.slice(1)) member.calmRun = { role: 'member' };
    start = end;
  }
  return {
    lines: lines.map(withoutRain),
    pastCount: lines.filter((line) => line.fold === 'past').length,
  };
}

/** La ligne telle que l'écran la lit : la pluie de la ligne n'a servi qu'à grouper les jours calmes. */
function withoutRain(line: WeekDayLine & { rain: unknown }): WeekDayLine {
  const copy: Partial<WeekDayLine & { rain: unknown }> = { ...line };
  delete copy.rain;
  return copy as WeekDayLine;
}
