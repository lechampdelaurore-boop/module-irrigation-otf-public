import type { ImplantationTask } from '../domain.ts';
import { isValidDateKey } from '../water-management.ts';

/**
 * Les cultures de référence du besoin en eau par culture et par stade
 * (docs/crop-water-need-contract.md, D-045, D-054, D-057).
 *
 * Une culture de référence porte les Kc d'une seule source : le CRIIAM Sud en
 * escalier ou en calendrier, la FAO-56 en trapèze, ou une saisie de la ferme ;
 * jamais deux sources mélangées pour un même cycle. Ces tables sont des
 * données : la migration de la PR suivante les met en base, avec l'adresse et
 * la date du relevé, et chaque ferme peut les modifier. Ce module n'en écrit
 * aucune : il dit leur forme et les vérifie.
 */

export type KcSource = 'criiam' | 'fao56' | 'local';

type ImplantationKind = ImplantationTask['kind'];

/**
 * Le repère d'où se compte le début d'un stade (« Le stade calculé ») :
 * - `implantation` : n jours après le jour 0, lundi de la semaine d'implantation ;
 * - `emergence` : n jours après la levée, jour 0 plus le délai de levée ;
 * - `before-harvest` : J-n, n jours avant le dimanche de la dernière semaine de récolte ;
 * - `first-harvest` : le lundi de la première semaine de récolte ;
 * - `mid-harvest` : la mi-récolte.
 */
export type StageAnchor =
  | { from: 'implantation' | 'emergence' | 'before-harvest'; days: number }
  | { from: 'first-harvest' | 'mid-harvest' };

/** Un stade : son rang dans la table de la source, son libellé et son Kc. */
export type KcStage = { rank: number; label: string; kc: number };

/** Le début par défaut d'un stade ; `estimated` : une date sans source, affichée comme estimation. */
export type StageStart = { anchor: StageAnchor; estimated: boolean };

/** Un jeu de dates valable pour les implantations de certains mois, de 1 à 12. */
export type SeasonalSet<T> = { months: readonly number[]; value: T };

/** L'escalier du CRIIAM ou d'une saisie locale : un Kc fixe par stade, sans interpolation. */
export type StepCurve = {
  shape: 'steps';
  stages: readonly KcStage[];
  /** Pour chaque jeu de saison, le début de chaque stade, dans l'ordre des stades. */
  sets: readonly SeasonalSet<readonly StageStart[]>[];
};

/** Les durées des quatre phases de la FAO, en jours. */
export type FaoPhaseLengths = { initial: number; development: number; mid: number; late: number };

/** Le trapèze de la FAO-56 : Kc début, montée, Kc pleine saison, descente vers Kc fin. */
export type TrapezoidCurve = {
  shape: 'trapezoid';
  kcInitial: number;
  kcMid: number;
  kcEnd: number;
  sets: readonly SeasonalSet<FaoPhaseLengths>[];
  /** Coefficient d'abattement des Kc de la FAO, proposé à 1 ; entre 0 exclu et 1 compris. */
  abatement: number;
};

/** Un stade de calendrier : il commence chaque année le même jour, `MM-JJ`. */
type CalendarStage = KcStage & { start: string; estimated: boolean };

/** Le calendrier fixe d'une culture pluriannuelle (artichaut, asperge, fraisier ; D-054). */
export type CalendarCurve = {
  shape: 'calendar';
  stages: readonly CalendarStage[];
  /** Dernier jour du cycle, `MM-JJ`, compris. */
  end: string;
  /** L'installation, la première année : un Kc fixe pendant quelques mois après la plantation. */
  establishment: (KcStage & { months: number }) | null;
};

export type KcCurve = StepCurve | TrapezoidCurve | CalendarCurve;

export type ReferenceCrop = {
  id: string;
  name: string;
  source: KcSource;
  curve: KcCurve;
  /** Délai de levée en jours selon le mode d'implantation (D-054). */
  emergenceDelayDays: Readonly<Record<ImplantationKind, number>>;
};

/** Les quatre phases de la FAO, dans l'ordre : ce sont les stades qu'on déclare pour un trapèze. */
export const FAO_PHASES = [
  { rank: 1, label: 'Début' },
  { rank: 2, label: 'Développement' },
  { rank: 3, label: 'Pleine saison' },
  { rank: 4, label: 'Fin' },
] as const;

/** Bornes du Kc, comprises (« Les garde-fous »). */
const KC_BOUNDS = { minimum: 0, maximum: 1.3 } as const;

const MONTHS_PER_YEAR = 12;
const DAYS_PER_COMMON_YEAR = 365;
/** Une année sans 29 février, pour placer les jours `MM-JJ` d'un calendrier. */
const COMMON_YEAR = 2025;
const MONTH_DAY_PATTERN = /^\d{2}-\d{2}$/;

const decimal = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });

/** Le jeu de saison du mois du jour 0 ; `null` quand aucun jeu ne couvre ce mois. */
export function seasonalSetFor<T>(sets: readonly SeasonalSet<T>[], dayZero: string): T | null {
  const month = Number(dayZero.slice(5, 7));
  return sets.find((set) => set.months.includes(month))?.value ?? null;
}

/** Les stades qu'on peut déclarer ou surcharger, par rang croissant. */
export function curveStages(curve: KcCurve): readonly Pick<KcStage, 'rank' | 'label'>[] {
  if (curve.shape === 'trapezoid') return FAO_PHASES;
  if (curve.shape === 'steps') return curve.stages;
  const stages = curve.establishment ? [curve.establishment, ...curve.stages] : [...curve.stages];
  return stages.sort((a, b) => a.rank - b.rank);
}

/** Un jour `MM-JJ` valable dans toutes les années : le 29 février en est exclu. */
export function isMonthDay(value: string): boolean {
  return MONTH_DAY_PATTERN.test(value) && value !== '02-29' && isValidDateKey(`${COMMON_YEAR}-${value}`);
}

/**
 * Ce qui empêche d'utiliser une culture de référence, en phrases : un Kc hors
 * bornes, un mois sans jeu de dates ou couvert deux fois, une durée qui n'est
 * pas un nombre entier de jours, un calendrier qui dépasse un an. Une liste
 * vide : la culture est utilisable.
 */
export function referenceCropProblems(crop: ReferenceCrop): string[] {
  const problems: string[] = [];
  for (const days of Object.values(crop.emergenceDelayDays)) {
    if (!isDayCount(days)) problems.push(`${crop.name} : délai de levée invalide (${days}).`);
  }
  const curve = crop.curve;
  if (crop.source === 'fao56' && curve.shape !== 'trapezoid') problems.push(`${crop.name} : la FAO-56 se lit en trapèze.`);
  if (crop.source === 'criiam' && curve.shape === 'trapezoid') problems.push(`${crop.name} : le CRIIAM se lit en escalier ou en calendrier.`);
  if (curve.shape === 'steps') problems.push(...stepCurveProblems(crop.name, curve));
  else if (curve.shape === 'trapezoid') problems.push(...trapezoidProblems(crop.name, curve));
  else problems.push(...calendarProblems(crop.name, curve));
  return problems;
}

/** Le message d'un Kc hors bornes, qui nomme la valeur. */
export function kcBoundsProblem(kc: number, what: string): string | null {
  if (Number.isFinite(kc) && kc >= KC_BOUNDS.minimum && kc <= KC_BOUNDS.maximum) return null;
  return `Kc hors bornes pour ${what} : ${Number.isFinite(kc) ? decimal.format(kc) : 'valeur illisible'} (entre ${decimal.format(KC_BOUNDS.minimum)} et ${decimal.format(KC_BOUNDS.maximum)}).`;
}

function stepCurveProblems(name: string, curve: StepCurve): string[] {
  const problems = stageListProblems(name, curve.stages);
  problems.push(...monthCoverageProblems(name, curve.sets));
  for (const set of curve.sets) {
    if (set.value.length !== curve.stages.length) {
      problems.push(`${name} : le jeu de dates des mois ${set.months.join(', ')} ne donne pas un début à chaque stade.`);
      continue;
    }
    for (const start of set.value) {
      if ('days' in start.anchor && !isDayCount(start.anchor.days)) {
        problems.push(`${name} : durée invalide (${start.anchor.days} j).`);
      }
    }
  }
  return problems;
}

function trapezoidProblems(name: string, curve: TrapezoidCurve): string[] {
  const problems = [
    kcBoundsProblem(curve.kcInitial, `${name}, début`),
    kcBoundsProblem(curve.kcMid, `${name}, pleine saison`),
    kcBoundsProblem(curve.kcEnd, `${name}, fin`),
  ].filter((problem): problem is string => problem !== null);
  if (!(Number.isFinite(curve.abatement) && curve.abatement > 0 && curve.abatement <= 1)) {
    problems.push(`${name} : coefficient d'abattement invalide (${curve.abatement}), entre 0 exclu et 1.`);
  }
  problems.push(...monthCoverageProblems(name, curve.sets));
  for (const { value: lengths } of curve.sets) {
    const values = [lengths.initial, lengths.development, lengths.mid, lengths.late];
    if (!values.every(isDayCount) || values.reduce((total, days) => total + days, 0) === 0) {
      problems.push(`${name} : durées de phases invalides (${values.join(' / ')}).`);
    }
  }
  return problems;
}

function calendarProblems(name: string, curve: CalendarCurve): string[] {
  const problems = stageListProblems(name, curve.stages);
  const days = [...curve.stages.map((stage) => stage.start), curve.end];
  const invalid = days.filter((day) => !isMonthDay(day));
  if (invalid.length > 0) {
    problems.push(`${name} : jour de calendrier invalide (${invalid.join(', ')}).`);
    return problems;
  }
  if (curve.stages.length > 0) {
    const starts = calendarOffsets(curve.stages.map((stage) => stage.start), curve.end);
    if (starts.end - starts.offsets[0] >= DAYS_PER_COMMON_YEAR) problems.push(`${name} : le calendrier dépasse un an.`);
  }
  const establishment = curve.establishment;
  if (establishment) {
    const problem = kcBoundsProblem(establishment.kc, `${name}, ${establishment.label}`);
    if (problem) problems.push(problem);
    if (!Number.isInteger(establishment.months) || establishment.months < 1) {
      problems.push(`${name} : durée d'installation invalide (${establishment.months} mois).`);
    }
    if (curve.stages.some((stage) => stage.rank === establishment.rank)) {
      problems.push(`${name} : l'installation reprend le rang d'un stade du calendrier.`);
    }
  }
  return problems;
}

/**
 * Les dates d'un cycle de calendrier qui commence l'année `startYear` : le
 * début de chaque stade, chacun après le précédent — le cycle peut passer la
 * fin de l'année, comme l'artichaut remontant d'août à mai —, et son dernier
 * jour, compris.
 */
export function calendarCycleDates(curve: CalendarCurve, startYear: number): { starts: string[]; end: string } {
  const { offsets, end } = calendarOffsets(curve.stages.map((stage) => stage.start), curve.end);
  const yearOf = (offset: number) => startYear + Math.floor(offset / DAYS_PER_COMMON_YEAR);
  return {
    starts: curve.stages.map((stage, index) => `${yearOf(offsets[index])}-${stage.start}`),
    end: `${yearOf(end)}-${curve.end}`,
  };
}

/** Les débuts de stade en jours depuis le 1er janvier d'une année commune, et le dernier jour du cycle. */
function calendarOffsets(starts: readonly string[], end: string): { offsets: number[]; end: number } {
  const offsets: number[] = [];
  for (const start of starts) {
    let offset = dayOfCommonYear(start);
    const previous = offsets.at(-1);
    while (previous !== undefined && offset <= previous) offset += DAYS_PER_COMMON_YEAR;
    offsets.push(offset);
  }
  let endOffset = dayOfCommonYear(end);
  const last = offsets.at(-1) ?? 0;
  while (endOffset < last) endOffset += DAYS_PER_COMMON_YEAR;
  return { offsets, end: endOffset };
}

function dayOfCommonYear(monthDay: string): number {
  const [month, day] = monthDay.split('-').map(Number);
  let total = day - 1;
  for (let previous = 1; previous < month; previous += 1) total += daysInMonth(COMMON_YEAR, previous);
  return total;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function stageListProblems(name: string, stages: readonly KcStage[]): string[] {
  if (stages.length === 0) return [`${name} : aucun stade.`];
  const problems: string[] = [];
  stages.forEach((stage, index) => {
    if (!Number.isInteger(stage.rank) || stage.rank < 1 || (index > 0 && stage.rank <= stages[index - 1].rank)) {
      problems.push(`${name} : rang de stade invalide (${stage.rank}).`);
    }
    const problem = kcBoundsProblem(stage.kc, `${name}, ${stage.label}`);
    if (problem) problems.push(problem);
  });
  return problems;
}

function monthCoverageProblems(name: string, sets: readonly SeasonalSet<unknown>[]): string[] {
  const counts = new Map<number, number>();
  for (const set of sets) for (const month of set.months) counts.set(month, (counts.get(month) ?? 0) + 1);
  const problems: string[] = [];
  for (let month = 1; month <= MONTHS_PER_YEAR; month += 1) {
    const count = counts.get(month) ?? 0;
    if (count !== 1) problems.push(`${name} : le mois ${month} ${count === 0 ? "n'a aucun jeu de dates" : 'a plusieurs jeux de dates'}.`);
  }
  const outside = [...counts.keys()].filter((month) => !Number.isInteger(month) || month < 1 || month > MONTHS_PER_YEAR);
  if (outside.length > 0) problems.push(`${name} : mois invalide (${outside.join(', ')}).`);
  return problems;
}

function isDayCount(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}
