import type { CropSeries, ImplantationTask, WeekKey } from '../domain.ts';
import { compareWeekKeys, weekEndDateKeyFromWeekKey, weekStartDateKeyFromWeekKey } from '../week-keys.ts';

/**
 * La période d'occupation d'une série (docs/series-contract.md, « La période
 * d'occupation ») : du lundi de sa semaine d'implantation au dimanche de sa
 * dernière semaine de récolte, recalculée depuis les tâches et les mises en
 * culture, jamais lue dans les entiers non documentés d'OTF (D-021, D-022).
 */

export type SeriesImplantation = {
  week: WeekKey;
  kind: ImplantationTask['kind'];
  /** `true` : tâche cochée faite, la semaine est la réalité ; sinon le planning. */
  realized: boolean;
};

export type SeriesLastHarvest = {
  week: WeekKey;
  /** `true` : dernière semaine réalisée ; sinon la dernière attendue. */
  realized: boolean;
};

type SeriesOccupationStatus = 'upcoming' | 'ongoing' | 'finished';

export type SeriesOccupation = {
  seriesId: string;
  implantation: SeriesImplantation;
  lastHarvest: SeriesLastHarvest | null;
  /** Lundi de la semaine d'implantation, ou 1er janvier de la saison pour une pérenne implantée avant. */
  startDate: string;
  /** Dimanche de la dernière semaine de récolte ; `null` : fin inconnue, la série court. */
  endDate: string | null;
  status: SeriesOccupationStatus;
};

type IgnoredSeriesReason = 'block' | 'no-implantation';

export type IgnoredSeries = {
  seriesId: string;
  reason: IgnoredSeriesReason;
};

export function isIgnoredSeries(value: SeriesOccupation | IgnoredSeries): value is IgnoredSeries {
  return 'reason' in value;
}

/**
 * La semaine d'implantation d'une série : pour chaque mise en culture, la plus
 * précoce de ses tâches de semis direct ou de plantation — les siennes et
 * celles posées sur la série entière —, semaine réalisée si la tâche est
 * cochée, planifiée sinon ; puis la plus précoce des mises en culture.
 * `null` quand aucune tâche ne met la série au champ.
 */
export function implantationOfSeries(
  series: CropSeries,
  tasks: readonly ImplantationTask[],
): SeriesImplantation | null {
  const own = tasks.filter((task) => task.seriesId === series.id);
  const candidates = series.cultivations.length === 0
    ? [own]
    : series.cultivations.map((cultivation) =>
        own.filter((task) => task.cultivationId === null || task.cultivationId === cultivation.id));
  let earliest: SeriesImplantation | null = null;
  for (const cultivationTasks of candidates) {
    for (const task of cultivationTasks) {
      const implantation = implantationOfTask(task);
      if (implantation && (earliest === null || compareWeekKeys(implantation.week, earliest.week) < 0)) {
        earliest = implantation;
      }
    }
  }
  return earliest;
}

function implantationOfTask(task: ImplantationTask): SeriesImplantation | null {
  const realized = task.status === 'done';
  const week = realized ? (task.doneWeek ?? task.plannedWeek) : task.plannedWeek;
  return week === null ? null : { week, kind: task.kind, realized: realized && task.doneWeek !== null };
}

/**
 * La dernière semaine de récolte d'une série : pour chaque mise en culture, la
 * dernière réalisée si elle existe, sinon la dernière attendue ; puis la plus
 * tardive des mises en culture. `null` quand rien n'est connu.
 */
export function lastHarvestOfSeries(series: CropSeries): SeriesLastHarvest | null {
  let latest: SeriesLastHarvest | null = null;
  for (const cultivation of series.cultivations) {
    const candidate = cultivation.harvestWeeks.length > 0
      ? { week: latestWeek(cultivation.harvestWeeks), realized: true }
      : cultivation.harvestWeeksExpected.length > 0
        ? { week: latestWeek(cultivation.harvestWeeksExpected), realized: false }
        : null;
    if (candidate && (latest === null || compareWeekKeys(candidate.week, latest.week) > 0)) {
      latest = candidate;
    }
  }
  return latest;
}

function latestWeek(weeks: readonly WeekKey[]): WeekKey {
  return weeks.reduce((latest, week) => (compareWeekKeys(week, latest) > 0 ? week : latest));
}

/**
 * La période d'une série, ou la raison de l'ignorer : une série en bloc n'a
 * pas de planches, une série sans implantation n'a pas de période (D-022,
 * règle 3). `today` est un jour `AAAA-MM-JJ` à la ferme.
 */
export function resolveSeriesOccupation(
  series: CropSeries,
  tasks: readonly ImplantationTask[],
  today: string,
): SeriesOccupation | IgnoredSeries {
  if (series.use === 'block') return { seriesId: series.id, reason: 'block' };
  const implantation = implantationOfSeries(series, tasks);
  if (implantation === null) return { seriesId: series.id, reason: 'no-implantation' };

  const implantationMonday = weekStartDateKeyFromWeekKey(implantation.week);
  if (implantationMonday === null) return { seriesId: series.id, reason: 'no-implantation' };
  // Une pérenne a une période par saison : de son implantation, ou du
  // 1er janvier de la saison quand elle est en place depuis plus longtemps.
  const seasonStart = `${series.season}-01-01`;
  const startDate = series.cycle === 'perennial' && implantationMonday < seasonStart
    ? seasonStart
    : implantationMonday;

  const lastHarvest = lastHarvestOfSeries(series);
  const endDate = lastHarvest === null ? null : weekEndDateKeyFromWeekKey(lastHarvest.week);

  const status: SeriesOccupationStatus = startDate > today
    ? 'upcoming'
    : endDate === null || endDate >= today
      ? 'ongoing'
      : 'finished';

  return { seriesId: series.id, implantation, lastHarvest, startDate, endDate, status };
}
