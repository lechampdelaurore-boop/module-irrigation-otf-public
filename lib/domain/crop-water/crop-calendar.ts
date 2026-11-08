import type { CropCultivation, CropSeries, ImplantationTask, WeekKey } from '../domain.ts';
import { isIgnoredSeries, resolveSeriesOccupation } from '../series/occupation.ts';
import { MILLISECONDS_PER_DAY } from '../units.ts';
import { addDaysToDateKey } from '../water-management.ts';
import { compareWeekKeys, isWeekKey, weekEndDateKeyFromWeekKey, weekStartDateKeyFromWeekKey } from '../week-keys.ts';

/**
 * Les dates d'une culture que le calcul du stade lit
 * (docs/crop-water-need-contract.md, « Les dates que le logiciel connaît »).
 *
 * Ouvre ta ferme ne donne que des semaines. Le jour 0 est le lundi de la
 * semaine d'implantation de la culture — sa propre tâche de semis direct ou de
 * plantation, ou celle de toute la série —, tel que le suivi par série le
 * calcule. La récolte se lit dans toutes les semaines de récolte (D-054) ; la
 * fin de la culture est la plus tardive de ses semaines réalisées ou
 * attendues (D-057), quand le suivi par série garde la sienne (D-022).
 */

export type CultivationDates = {
  seriesId: string;
  seriesName: string;
  cultivationId: string;
  plantId: string;
  plantName: string;
  implantationKind: ImplantationTask['kind'];
  /** Lundi de la semaine d'implantation de la culture. */
  dayZero: string;
  /** Premier jour sur la planche : le jour 0, ou le 1er janvier de la saison pour une pérenne en place avant. */
  presenceStart: string;
  /** Lundi de la première semaine de récolte, réalisée sinon attendue ; `null` : aucune récolte connue. */
  firstHarvest: string | null;
  /** Dimanche de la plus tardive des semaines de récolte, réalisées ou attendues (D-057) ; `null` : inconnue. */
  lastHarvest: string | null;
  /** Le lundi de la première récolte plus la moitié, arrondie au jour inférieur, des jours de récolte. */
  midHarvest: string | null;
};

/** Une culture que le calcul ne place pas : série en bloc, ou sans semaine d'implantation. */
export type UnplacedCultivation = Pick<CultivationDates, 'seriesId' | 'seriesName' | 'cultivationId' | 'plantId' | 'plantName'> & {
  reason: 'block' | 'no-implantation';
};

const MONTHS_PER_YEAR = 12;

/**
 * Les dates d'une culture d'une série. Le jour 0 et le premier jour sur la
 * planche sont ceux du suivi par série, appliqués à cette seule culture ;
 * `today` ne sert qu'à ce calcul partagé.
 */
export function cultivationDates(
  series: CropSeries,
  cultivation: CropCultivation,
  tasks: readonly ImplantationTask[],
  today: string,
): CultivationDates | UnplacedCultivation {
  const identity = {
    seriesId: series.id,
    seriesName: series.name,
    cultivationId: cultivation.id,
    plantId: cultivation.plantId,
    plantName: cultivation.plantName,
  };
  const occupation = resolveSeriesOccupation({ ...series, cultivations: [cultivation] }, tasks, today);
  if (isIgnoredSeries(occupation)) return { ...identity, reason: occupation.reason };
  const dayZero = weekStartDateKeyFromWeekKey(occupation.implantation.week);
  if (dayZero === null) return { ...identity, reason: 'no-implantation' };

  const realized = cultivation.harvestWeeks.filter(isWeekKey);
  const all = [...realized, ...cultivation.harvestWeeksExpected.filter(isWeekKey)];
  const firstWeek = earliestWeek(realized.length > 0 ? realized : all);
  const lastWeek = latestWeek(all);
  const firstHarvest = firstWeek === null ? null : weekStartDateKeyFromWeekKey(firstWeek);
  const lastHarvest = lastWeek === null ? null : weekEndDateKeyFromWeekKey(lastWeek);
  const midHarvest = firstHarvest !== null && lastHarvest !== null && firstHarvest <= lastHarvest
    ? addDaysToDateKey(firstHarvest, Math.floor((daysFromTo(firstHarvest, lastHarvest) + 1) / 2))
    : null;

  return {
    ...identity,
    implantationKind: occupation.implantation.kind,
    dayZero,
    presenceStart: occupation.startDate,
    firstHarvest,
    lastHarvest,
    midHarvest,
  };
}

export function isUnplacedCultivation(value: CultivationDates | UnplacedCultivation): value is UnplacedCultivation {
  return 'reason' in value;
}

/** Le nombre de jours de `from` à `to`, deux jours `AAAA-MM-JJ` ; négatif quand `to` précède `from`. */
export function daysFromTo(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00.000Z`) - Date.parse(`${from}T12:00:00.000Z`)) / MILLISECONDS_PER_DAY);
}

/** Le même jour, `months` mois plus tard ; ramené au dernier jour d'un mois plus court (31 mars + 2 mois = 31 mai, 31 décembre + 2 mois = 28 ou 29 février). */
export function addMonthsToDateKey(dateKey: string, months: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const index = year * MONTHS_PER_YEAR + (month - 1) + months;
  const targetYear = Math.floor(index / MONTHS_PER_YEAR);
  const targetMonth = (index % MONTHS_PER_YEAR) + 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

function earliestWeek(weeks: readonly WeekKey[]): WeekKey | null {
  return weeks.length === 0 ? null : weeks.reduce((earliest, week) => (compareWeekKeys(week, earliest) < 0 ? week : earliest));
}

function latestWeek(weeks: readonly WeekKey[]): WeekKey | null {
  return weeks.length === 0 ? null : weeks.reduce((latest, week) => (compareWeekKeys(week, latest) > 0 ? week : latest));
}
