import { addDaysToDateKey, isValidDateKey } from '../water-management.ts';
import { addMonthsToDateKey, daysFromTo, type CultivationDates } from './crop-calendar.ts';
import {
  calendarCycleDates,
  curveStages,
  FAO_PHASES,
  seasonalSetFor,
  type CalendarCurve,
  type FaoPhaseLengths,
  type KcCurve,
  type KcStage,
  type ReferenceCrop,
  type StageAnchor,
  type StepCurve,
  type TrapezoidCurve,
} from './reference.ts';

/**
 * Le stade d'une culture un jour donné (docs/crop-water-need-contract.md,
 * « Le stade d'une culture », D-054, D-057).
 *
 * Sans déclaration, le stade se calcule depuis le jour 0 : le premier stade
 * s'applique dès ce jour, délai de levée compris ; chaque stade suivant
 * commence à sa date par défaut — jours après l'implantation ou la levée, J-n
 * avant la récolte, première récolte ou mi-récolte d'Ouvre ta ferme —, et le
 * stade du jour est le plus avancé de ceux qui ont commencé. Une culture
 * pluriannuelle suit son calendrier ; la FAO suit son trapèze.
 *
 * Un stade déclaré commence le jour dit (D-057) : les stades suivants
 * arrivent seuls, décalés d'autant s'ils se comptent depuis l'implantation ou
 * la levée, à leur date s'ils dépendent de la récolte ou du calendrier ; un
 * stade suivant dont la date est déjà passée au jour déclaré ne revient pas
 * seul. Une déclaration vaut à partir de son jour : avant, le stade calculé,
 * ou la déclaration précédente, s'applique.
 */

export type StageDeclaration = {
  seriesId: string;
  /** `null` : la déclaration vaut pour toute la série ; sinon pour cette planche, et elle prime. */
  bedId: string | null;
  /** La culture de référence dont le rang est déclaré : une déclaration ne vaut que pour elle. */
  referenceCropId: string;
  rank: number;
  /** Le jour où le stade est atteint, `AAAA-MM-JJ`. */
  date: string;
  /** L'instant de l'enregistrement : la dernière correction d'un même stade remplace les précédentes. */
  recordedAt: string;
};

/** Où en est la courbe ce jour-là : le rang, et pour le trapèze, les jours depuis son origine. */
export type StagePosition =
  | { shape: 'steps' | 'calendar'; rank: number }
  | { shape: 'trapezoid'; rank: number; daysSinceOrigin: number; lengths: FaoPhaseLengths };

export type StagedDay = {
  status: 'staged';
  rank: number;
  label: string;
  /**
   * `observed` : le stade déclaré lui-même ; `calculated` : un stade calculé,
   * recalé sur `declaration` quand elle existe (D-057).
   */
  origin: 'calculated' | 'observed';
  declaration: StageDeclaration | null;
  /** Premier jour du stade ; pour le premier stade calculé, le jour 0. */
  startedOn: string;
  /** La date de début du stade est une estimation sans source, affichée comme telle. */
  estimated: boolean;
  /** Le prochain changement de stade prévu, quand sa date est connue. */
  nextChange: { rank: number; label: string; date: string } | null;
  /** Un stade suivant attend une date de récolte qu'Ouvre ta ferme ne donne pas : on reste au stade en cours. */
  waitingForHarvest: boolean;
  position: StagePosition;
};

export type StageOfDay =
  | StagedDay
  /** La culture n'est pas sur la planche ce jour-là. */
  | { status: 'absent' }
  /** Culture pluriannuelle hors de son calendrier : pas de proposition. */
  | { status: 'off-calendar' }
  /** Aucun jeu de dates ne couvre le mois du jour 0 : la table est à compléter. */
  | { status: 'no-season-set' };

type TimelineEntry = { rank: number; label: string; start: string | null; estimated: boolean };

/** Les repères qui se décalent avec un stade déclaré ; les autres gardent leur date (D-057). */
const SHIFTED_ANCHORS: ReadonlySet<StageAnchor['from']> = new Set(['implantation', 'emergence']);

/**
 * Le dernier jour sur la planche : le dimanche de la plus tardive des
 * semaines de récolte (D-057). Une culture pluriannuelle reste jusqu'à la fin
 * de son calendrier (exception à D-022, D-054) : la fin du cycle qui contient
 * sa dernière récolte, ou du cycle qui commence après elle la même année,
 * comme l'asperge récoltée en mai ; à défaut, sa dernière récolte. `null` :
 * aucune récolte connue, la culture court.
 */
function presenceEnd(crop: ReferenceCrop, dates: CultivationDates): string | null {
  const lastHarvest = dates.lastHarvest;
  if (lastHarvest === null || crop.curve.shape !== 'calendar') return lastHarvest;
  const year = Number(lastHarvest.slice(0, 4));
  for (const startYear of [year - 1, year]) {
    const cycle = calendarCycleDates(crop.curve, startYear);
    if (cycle.end >= lastHarvest) return cycle.end;
  }
  return lastHarvest;
}

/** Le stade d'une culture sur une planche, un jour `AAAA-MM-JJ` à la ferme. */
export function stageOfDay(input: {
  crop: ReferenceCrop;
  dates: CultivationDates;
  declarations: readonly StageDeclaration[];
  bedId: string;
  date: string;
}): StageOfDay {
  const { crop, dates, date } = input;
  const end = presenceEnd(crop, dates);
  if (date < dates.presenceStart || (end !== null && date > end)) return { status: 'absent' };
  const declaration = effectiveDeclaration(input);
  const curve = crop.curve;
  if (curve.shape === 'steps') return stepStage(crop, curve, dates, declaration, date);
  if (curve.shape === 'trapezoid') return trapezoidStage(curve, dates, declaration, date);
  return calendarStage(curve, dates, declaration, date);
}

/**
 * La déclaration qui fait foi ce jour-là. Une correction est une déclaration
 * nouvelle : pour un même stade, au même niveau et dans le même cycle, la
 * dernière enregistrée remplace les précédentes. Puis la plus récente par sa
 * date, jusqu'à ce jour compris, l'emporte — à date égale, la dernière
 * enregistrée —, celles de la planche avant celles de la série. Une
 * déclaration d'avant le jour 0, d'un rang inconnu ou d'une autre culture de
 * référence est ignorée ; celle d'une culture pluriannuelle ne vaut que pour
 * son cycle.
 */
function effectiveDeclaration(input: {
  crop: ReferenceCrop;
  dates: CultivationDates;
  declarations: readonly StageDeclaration[];
  bedId: string;
  date: string;
}): StageDeclaration | null {
  const { crop, dates, bedId, date } = input;
  const ranks = new Set(curveStages(crop.curve).map((stage) => stage.rank));
  const latestPerStage = new Map<string, { declaration: StageDeclaration; lastDay: string | null }>();
  for (const declaration of input.declarations) {
    if (declaration.seriesId !== dates.seriesId || declaration.referenceCropId !== crop.id) continue;
    if (declaration.bedId !== null && declaration.bedId !== bedId) continue;
    if (!ranks.has(declaration.rank) || !isValidDateKey(declaration.date) || declaration.date < dates.dayZero) continue;
    const window = declarationWindow(crop.curve, declaration);
    const key = `${declaration.bedId ?? ''}|${declaration.rank}|${window.key}`;
    const known = latestPerStage.get(key);
    if (!known || declaration.recordedAt >= known.declaration.recordedAt) latestPerStage.set(key, { declaration, lastDay: window.lastDay });
  }
  const applicable = [...latestPerStage.values()]
    .filter(({ declaration, lastDay }) => declaration.date <= date && (lastDay === null || date <= lastDay))
    .map(({ declaration }) => declaration);
  return latestByDate(applicable.filter((declaration) => declaration.bedId !== null))
    ?? latestByDate(applicable.filter((declaration) => declaration.bedId === null));
}

function latestByDate(declarations: readonly StageDeclaration[]): StageDeclaration | null {
  let latest: StageDeclaration | null = null;
  for (const declaration of declarations) {
    if (latest === null || declaration.date > latest.date
      || (declaration.date === latest.date && declaration.recordedAt >= latest.recordedAt)) latest = declaration;
  }
  return latest;
}

/** Jusqu'où vaut une déclaration : toujours, sauf pour un calendrier, borné à son cycle ou à l'installation. */
function declarationWindow(curve: KcCurve, declaration: StageDeclaration): { key: string; lastDay: string | null } {
  if (curve.shape !== 'calendar') return { key: '', lastDay: null };
  const establishment = curve.establishment;
  if (establishment !== null && declaration.rank === establishment.rank) {
    return { key: 'installation', lastDay: addDaysToDateKey(addMonthsToDateKey(declaration.date, establishment.months), -1) };
  }
  const cycle = declarationCycle(curve, declaration.date);
  return { key: cycle.starts[0], lastDay: cycle.end };
}

function stepStage(
  crop: ReferenceCrop,
  curve: StepCurve,
  dates: CultivationDates,
  declaration: StageDeclaration | null,
  date: string,
): StageOfDay {
  const starts = seasonalSetFor(curve.sets, dates.dayZero);
  if (starts === null || starts.length !== curve.stages.length) return { status: 'no-season-set' };
  const emergence = addDaysToDateKey(dates.dayZero, crop.emergenceDelayDays[dates.implantationKind]);
  const nominal = starts.map((start) => anchorDate(start.anchor, dates, emergence));
  // Le premier stade s'applique dès le jour 0, délai de levée compris (D-054).
  const entries: TimelineEntry[] = curve.stages.map((stage, index) => ({
    rank: stage.rank,
    label: stage.label,
    start: index === 0 ? dates.dayZero : nominal[index],
    estimated: starts[index].estimated,
  }));
  if (declaration === null) return resolveTimeline(entries, date, null, 'steps');

  const declared = curve.stages.findIndex((stage) => stage.rank === declaration.rank);
  const base = nominal[declared];
  const shift = base === null ? 0 : daysFromTo(base, declaration.date);
  const recaled = entries.flatMap((entry, index): TimelineEntry[] => {
    if (index < declared) return [];
    if (index === declared) return [{ ...entry, start: declaration.date, estimated: false }];
    const nominalStart = nominal[index];
    const start = nominalStart !== null && SHIFTED_ANCHORS.has(starts[index].anchor.from)
      ? addDaysToDateKey(nominalStart, shift)
      : nominalStart;
    return start !== null && start <= declaration.date ? [] : [{ ...entry, start }];
  });
  return resolveTimeline(recaled, date, declaration, 'steps');
}

function anchorDate(anchor: StageAnchor, dates: CultivationDates, emergence: string): string | null {
  switch (anchor.from) {
    case 'implantation':
      return addDaysToDateKey(dates.dayZero, anchor.days);
    case 'emergence':
      return addDaysToDateKey(emergence, anchor.days);
    case 'before-harvest':
      return dates.lastHarvest === null ? null : addDaysToDateKey(dates.lastHarvest, -anchor.days);
    case 'first-harvest':
      return dates.firstHarvest;
    case 'mid-harvest':
      return dates.midHarvest;
  }
}

/**
 * Le trapèze de la FAO : ses phases se comptent depuis le jour 0. Un stade
 * déclaré déplace l'origine pour que sa phase commence le jour dit ; toutes
 * les phases suivantes se décalent d'autant. Après la fin de la dernière
 * phase, le Kc de fin vaut jusqu'à la récolte.
 */
function trapezoidStage(
  curve: TrapezoidCurve,
  dates: CultivationDates,
  declaration: StageDeclaration | null,
  date: string,
): StageOfDay {
  const lengths = seasonalSetFor(curve.sets, dates.dayZero);
  if (lengths === null) return { status: 'no-season-set' };
  const bounds = phaseStarts(lengths);
  const origin = declaration === null ? dates.dayZero : addDaysToDateKey(declaration.date, -bounds[declaration.rank - 1]);
  const days = daysFromTo(origin, date);
  let index = 0;
  bounds.forEach((bound, phase) => { if (bound <= days) index = phase; });
  const phase = FAO_PHASES[index];
  const nextIndex = bounds.findIndex((bound, candidate) => candidate > index && bound > days);
  return {
    status: 'staged',
    rank: phase.rank,
    label: phase.label,
    origin: declaration !== null && declaration.rank === phase.rank ? 'observed' : 'calculated',
    declaration,
    startedOn: addDaysToDateKey(origin, bounds[index]),
    estimated: false,
    nextChange: nextIndex === -1
      ? null
      : { rank: FAO_PHASES[nextIndex].rank, label: FAO_PHASES[nextIndex].label, date: addDaysToDateKey(origin, bounds[nextIndex]) },
    waitingForHarvest: false,
    position: { shape: 'trapezoid', rank: phase.rank, daysSinceOrigin: days, lengths },
  };
}

/** Le premier jour de chacune des quatre phases, en jours depuis l'origine. */
export function phaseStarts(lengths: FaoPhaseLengths): [number, number, number, number] {
  const development = lengths.initial;
  const mid = development + lengths.development;
  return [0, development, mid, mid + lengths.mid];
}

/**
 * Le calendrier d'une culture pluriannuelle. La première année,
 * l'installation garde son Kc quelques mois après la plantation ; un stade de
 * calendrier déclaré y met fin. Une déclaration hors du calendrier ouvre le
 * cycle suivant dès son jour.
 */
function calendarStage(
  curve: CalendarCurve,
  dates: CultivationDates,
  declaration: StageDeclaration | null,
  date: string,
): StageOfDay {
  const establishment = curve.establishment;
  if (declaration !== null && establishment !== null && declaration.rank === establishment.rank) {
    return establishmentStage(curve, establishment, declaration.date, declaration);
  }
  if (declaration !== null) {
    const cycle = declarationCycle(curve, declaration.date);
    const entries = curve.stages.flatMap((stage, index): TimelineEntry[] => {
      if (stage.rank < declaration.rank) return [];
      if (stage.rank === declaration.rank) return [{ rank: stage.rank, label: stage.label, start: declaration.date, estimated: false }];
      const start = cycle.starts[index];
      return start > declaration.date ? [{ rank: stage.rank, label: stage.label, start, estimated: stage.estimated }] : [];
    });
    return resolveTimeline(entries, date, declaration, 'calendar');
  }
  if (establishment !== null && date < addMonthsToDateKey(dates.dayZero, establishment.months)) {
    return establishmentStage(curve, establishment, dates.dayZero, null);
  }
  return computedCalendarStage(curve, date);
}

function establishmentStage(
  curve: CalendarCurve,
  establishment: KcStage & { months: number },
  start: string,
  declaration: StageDeclaration | null,
): StageOfDay {
  const end = addMonthsToDateKey(start, establishment.months);
  const after = computedCalendarStage(curve, end);
  return {
    status: 'staged',
    rank: establishment.rank,
    label: establishment.label,
    origin: declaration === null ? 'calculated' : 'observed',
    declaration,
    startedOn: start,
    estimated: false,
    nextChange: after.status === 'staged' ? { rank: after.rank, label: after.label, date: end } : null,
    waitingForHarvest: false,
    position: { shape: 'calendar', rank: establishment.rank },
  };
}

function computedCalendarStage(curve: CalendarCurve, date: string): StageOfDay {
  const cycle = cycleContaining(curve, date);
  if (cycle === null) return { status: 'off-calendar' };
  const entries = curve.stages.map((stage, index) => ({
    rank: stage.rank,
    label: stage.label,
    start: cycle.starts[index],
    estimated: stage.estimated,
  }));
  return resolveTimeline(entries, date, null, 'calendar');
}

function cycleContaining(curve: CalendarCurve, date: string): { starts: string[]; end: string } | null {
  const year = Number(date.slice(0, 4));
  for (const startYear of [year - 1, year]) {
    const cycle = calendarCycleDates(curve, startYear);
    if (cycle.starts[0] <= date && date <= cycle.end) return cycle;
  }
  return null;
}

/** Le cycle d'une déclaration : celui qui contient son jour, sinon le suivant, qu'elle ouvre plus tôt. */
function declarationCycle(curve: CalendarCurve, date: string): { starts: string[]; end: string } {
  const containing = cycleContaining(curve, date);
  if (containing !== null) return containing;
  const year = Number(date.slice(0, 4));
  const current = calendarCycleDates(curve, year);
  return current.starts[0] > date ? current : calendarCycleDates(curve, year + 1);
}

/**
 * Le stade du jour dans une suite de stades datés : le plus avancé de ceux
 * qui ont commencé. Le prochain changement est la plus proche date à venir
 * d'un stade plus avancé ; un stade plus avancé sans date attend la récolte.
 */
function resolveTimeline(
  entries: readonly TimelineEntry[],
  date: string,
  declaration: StageDeclaration | null,
  shape: 'steps' | 'calendar',
): StageOfDay {
  const current = latestStarted(entries, date);
  if (current === null) return { status: 'off-calendar' };
  const upcoming = entries
    .filter((entry) => entry.rank > current.rank && entry.start !== null && entry.start > date)
    .map((entry) => entry.start as string)
    .sort()[0];
  const next = upcoming === undefined ? null : latestStarted(entries, upcoming);
  return {
    status: 'staged',
    rank: current.rank,
    label: current.label,
    origin: declaration !== null && declaration.rank === current.rank ? 'observed' : 'calculated',
    declaration,
    startedOn: current.start,
    estimated: current.estimated,
    nextChange: next === null || upcoming === undefined ? null : { rank: next.rank, label: next.label, date: upcoming },
    waitingForHarvest: entries.some((entry) => entry.rank > current.rank && entry.start === null),
    position: { shape, rank: current.rank },
  };
}

function latestStarted(entries: readonly TimelineEntry[], date: string): (TimelineEntry & { start: string }) | null {
  let current: (TimelineEntry & { start: string }) | null = null;
  for (const entry of entries) {
    if (entry.start !== null && entry.start <= date && (current === null || entry.rank > current.rank)) {
      current = { ...entry, start: entry.start };
    }
  }
  return current;
}
