import type { Bed, PlotMode } from './domain.ts';
import type { BedWaterDay } from './crop-water/proposal.ts';
import {
  et0OfDay,
  et0Problem,
  shelterFactorOn,
  shelterFactorProblem,
  type BedWaterSettings,
  type Et0Nature,
  type Et0Reading,
} from './crop-water/etm.ts';
import { FARM_TIME_ZONE, addDaysToDateKey, dateKeyInTimeZone, weekStartDateKey } from './water-management.ts';

/**
 * L'objectif automatique (6 decies, docs/objectif-automatique-contract.md,
 * D-309, D-316) : quand une ferme l'allume, l'objectif d'une planche suit,
 * les jours sans objectif saisi, le besoin de sa culture (ETM) quand il est
 * connu, sinon l'ET0 du jour, multipliée par le K_abri sous abri. La valeur
 * se relit depuis la météo enregistrée : rien n'est écrit jour après jour,
 * l'objectif du matin suit la synchronisation du matin.
 *
 * L'ET0 n'entre dans le besoin que par l'objectif : l'écart reste
 * « objectif − (irrigation réelle + pluie réelle) » (D-010, exception de
 * D-309). Un objectif saisi, à n'importe quel niveau, passe toujours avant ;
 * un jour sans valeur n'est jamais compté pour zéro en silence (D-003) ;
 * observé, estimé et prévu restent distincts (D-006). Réglage éteint, rien
 * ne change.
 *
 * `objectiveForBed` (lib/domain/irrigation-needs.ts) est le seul à composer
 * l'objectif de la semaine : aucun lecteur ne le recalcule de son côté.
 */

/** Un geste sur le réglage « Objectif automatique » de la ferme : l'allumer ou l'éteindre. */
export type AutomaticObjectiveSettingRevision = {
  enabled: boolean;
  /** L'instant du geste : il compte à partir de son jour, en heure de Paris, comme une révision d'objectif (D-034). */
  createdAt: string;
};

/**
 * Le besoin de la culture, tel que « Besoin par culture » le connaît :
 * `off`, la case est décochée ; `unread`, elle est cochée mais le plan de
 * culture n'est pas lu ; `read`, les jours de la planche (`bedWaterDays`).
 */
type AutomaticObjectiveCropNeed =
  | { status: 'off' }
  | { status: 'unread' }
  | { status: 'read'; days: readonly BedWaterDay[] };

/** Ce que l'objectif automatique d'une planche lit (contrat, section 3). */
export type AutomaticObjectiveInput = {
  /** Les gestes du réglage de la ferme, dans l'ordre reçu ; aucun : éteint. */
  settings: readonly AutomaticObjectiveSettingRevision[];
  /** Aujourd'hui à la ferme, `AAAA-MM-JJ` : il sépare l'ET0 du passé de l'ET0 prévue. */
  today: string;
  /** L'ET0 enregistrée, jour par jour : la réanalyse et la prévision. */
  et0Readings: readonly Et0Reading[];
  /** Le jardin de la planche : plein champ, sous abri, ou à classer (4.4, F583). */
  plotMode: PlotMode;
  /** Les K_abri enregistrés ; celui d'une planche sous abri est celui de son jardin, sinon 0,8. */
  shelterFactors: BedWaterSettings['shelterFactors'];
  cropNeed: AutomaticObjectiveCropNeed;
};

/** La valeur automatique d'un jour, ou ce qui l'empêche, toujours nommé. */
type AutomaticObjectiveDay = { date: string } & (
  /** Le besoin de la culture du jour (choix 4). */
  | { status: 'crop'; mm: number; nature: Et0Nature }
  /** « Besoin par culture » cochée, aucune culture ce jour-là : 0, rien à nourrir. */
  | { status: 'no-crop'; mm: number }
  /**
   * L'ET0 du jour, × K_abri sous abri (choix 3) ; `shelterFactor` nul en
   * plein champ ; `cropNeedUnknown` : « Besoin par culture » est cochée mais
   * le besoin de la culture n'est pas connu ce jour-là.
   */
  | { status: 'et0'; mm: number; nature: Et0Nature; shelterFactor: number | null; cropNeedUnknown: boolean }
  /** L'ET0 du jour manque : le jour n'a pas de valeur. */
  | { status: 'missing-et0' }
  /** L'ET0 ou le K_abri est hors bornes : le jour n'a pas de valeur, le message la nomme (F771). */
  | { status: 'blocked'; problems: string[] }
  /** « Besoin par culture » cochée, plan de culture non lu : la planche porte peut-être une culture, peut-être aucune (F770). */
  | { status: 'crop-plan-unread' }
  /** Jardin à classer : on ne sait pas s'il est sous abri (F769). */
  | { status: 'unclassified-plot' }
);

type ValuedDay = Extract<AutomaticObjectiveDay, { mm: number }>;

/** L'objectif automatique d'une planche sur les jours de la semaine où il s'applique. */
export type AutomaticObjectiveWeek = {
  /** Les jours où il s'applique (réglage allumé, aucun objectif saisi), chacun avec sa valeur ou ce qui manque. */
  days: AutomaticObjectiveDay[];
  /** La somme des jours qui ont une valeur ; `null` quand aucun n'en a ou que la semaine est sans culture. */
  mm: number | null;
  /** Les jours qui ont une valeur et comptent dans la somme. */
  valuedDays: number;
  /** Les millimètres selon la nature de l'ET0 ; un jour sans culture n'en a pas. */
  byNature: Record<Et0Nature, number>;
  /** Les jours sans valeur : la semaine est incomplète et les nomme (D-003). */
  missingDates: string[];
  /** « Besoin par culture » cochée, aucune culture de toute la semaine : pas d'objectif automatique (règle 4). */
  noCropWeek: boolean;
  /** Ce sur quoi la somme repose : la culture, l'ET0, l'ET0 sous abri, ou plusieurs ; `null` sans somme. */
  basis: 'crop' | 'et0' | 'sheltered-et0' | 'mixed' | null;
};

/**
 * Le réglage est allumé ce jour-là : le dernier geste posé ce jour ou avant,
 * en heure de Paris ; deux gestes du même jour, le second fait foi pour toute
 * la journée (F773, docs/revision-order-contract.md). Aucun geste : éteint.
 */
export function automaticObjectiveEnabledOn(settings: readonly AutomaticObjectiveSettingRevision[], date: string): boolean {
  return automaticObjectiveSchedule(settings)(date);
}

/**
 * Le réglage jour par jour, pour qui le lit sur beaucoup de jours : le jour
 * de chaque geste, en heure de Paris, ne se calcule qu'une fois (mesure de
 * coût de la PR O2, D-317). Même règle qu'`automaticObjectiveEnabledOn`.
 */
export function automaticObjectiveSchedule(settings: readonly AutomaticObjectiveSettingRevision[]): (date: string) => boolean {
  const gestures = settings.map((revision) => ({ revision, day: dateKeyInTimeZone(revision.createdAt, FARM_TIME_ZONE) }));
  return (date) => {
    let latest: AutomaticObjectiveSettingRevision | null = null;
    for (const { revision, day } of gestures) {
      if (day > date) continue;
      if (latest === null || revision.createdAt >= latest.createdAt) latest = revision;
    }
    return latest?.enabled === true;
  };
}

/**
 * L'objectif automatique des jours `dates` de la semaine `weekDates`
 * (règles 3 et 4) : la semaine entière se lit pour savoir si la planche porte
 * une culture ; seuls les jours donnés sont valués.
 */
export function automaticObjectiveWeek(
  input: AutomaticObjectiveInput,
  bed: Pick<Bed, 'plotId'>,
  weekDates: readonly string[],
  dates: readonly string[],
): AutomaticObjectiveWeek {
  return weekOf(input, bed, weekDates, dates, dayLookups(input));
}

/** L'ET0 et le besoin de la culture, jour par jour : construits une fois par planche, lus chaque semaine. */
type DayLookups = {
  readings: ReadonlyMap<string, Et0Reading>;
  cropDays: ReadonlyMap<string, BedWaterDay> | null;
};

function dayLookups(input: AutomaticObjectiveInput): DayLookups {
  return {
    readings: new Map(input.et0Readings.map((reading) => [reading.date, reading])),
    cropDays: input.cropNeed.status === 'read' ? new Map(input.cropNeed.days.map((day) => [day.date, day])) : null,
  };
}

function weekOf(
  input: AutomaticObjectiveInput,
  bed: Pick<Bed, 'plotId'>,
  weekDates: readonly string[],
  dates: readonly string[],
  { readings, cropDays }: DayLookups,
): AutomaticObjectiveWeek {
  const noCropWeek = cropDays !== null && weekDates.every((date) => cropDays.get(date)?.status === 'no-crop');
  const days = dates.map((date) => automaticObjectiveDay(input, bed, date, readings, cropDays));
  const valued = noCropWeek ? [] : days.filter(isValued);
  const byNature: Record<Et0Nature, number> = { reanalysis: 0, estimated: 0, forecast: 0 };
  for (const day of valued) if (day.status !== 'no-crop') byNature[day.nature] += day.mm;
  return {
    days,
    mm: valued.length === 0 ? null : valued.reduce((sum, day) => sum + day.mm, 0),
    valuedDays: valued.length,
    byNature,
    missingDates: days.filter((day) => !isValued(day)).map((day) => day.date),
    noCropWeek,
    basis: basisOf(valued),
  };
}

/**
 * Les valeurs automatiques, jour par jour et planche par planche, pour un
 * lecteur qui compose lui-même l'objectif sur une période (l'historique, les
 * séries ; contrat, règle 7) : pour chaque jour où l'objectif automatique
 * s'applique, sa valeur en mm, ou `null` quand il n'en a pas (D-003). Un jour
 * absent : il ne s'y applique pas (réglage éteint, semaine sans culture).
 */
export type AutomaticObjectiveDayValues = ReadonlyMap<string, ReadonlyMap<string, number | null>>;

/**
 * Les jours `dates` où le réglage de la ferme est allumé, groupés par semaine
 * du lundi au dimanche : la même découpe pour toutes les planches de la
 * ferme, faite une fois (mesure de coût de la PR O2, D-317).
 */
export type AutomaticObjectivePeriod = readonly { weekDates: readonly string[]; days: readonly string[] }[];

export function automaticObjectivePeriod(
  settings: readonly AutomaticObjectiveSettingRevision[],
  dates: readonly string[],
): AutomaticObjectivePeriod {
  const enabledOn = automaticObjectiveSchedule(settings);
  const byWeek = new Map<string, string[]>();
  for (const date of dates) {
    if (!enabledOn(date)) continue;
    const monday = weekStartDateKey(date);
    const days = byWeek.get(monday);
    if (days) days.push(date);
    else byWeek.set(monday, [date]);
  }
  return [...byWeek].map(([monday, days]) => ({
    weekDates: Array.from({ length: 7 }, (_, offset) => addDaysToDateKey(monday, offset)),
    days,
  }));
}

/**
 * Les valeurs automatiques d'une planche aux jours de `period`, découpée avec
 * les gestes de sa ferme : la semaine de chaque jour se lit entière, du lundi
 * au dimanche, pour savoir si la planche porte une culture (F772) ; la valeur
 * d'un jour est celle que `objectiveForBed` lui donne.
 */
export function automaticObjectiveDayValues(
  input: AutomaticObjectiveInput,
  bed: Pick<Bed, 'plotId'>,
  period: AutomaticObjectivePeriod,
): Map<string, number | null> {
  const lookups = dayLookups(input);
  const values = new Map<string, number | null>();
  for (const { weekDates, days } of period) {
    const week = weekOf(input, bed, weekDates, days, lookups);
    if (week.noCropWeek) continue;
    for (const day of week.days) values.set(day.date, isValued(day) ? day.mm : null);
  }
  return values;
}

function automaticObjectiveDay(
  input: AutomaticObjectiveInput,
  bed: Pick<Bed, 'plotId'>,
  date: string,
  readings: ReadonlyMap<string, Et0Reading>,
  cropDays: ReadonlyMap<string, BedWaterDay> | null,
): AutomaticObjectiveDay {
  if (input.plotMode === 'unclassified') return { date, status: 'unclassified-plot' };
  if (input.cropNeed.status === 'unread') return { date, status: 'crop-plan-unread' };
  const cropDay = cropDays?.get(date);
  if (cropDay?.status === 'no-crop') return { date, status: 'no-crop', mm: 0 };
  if (cropDay?.status === 'computed' && cropDay.etmMm !== null && cropDay.et0 !== null) {
    return { date, status: 'crop', mm: cropDay.etmMm, nature: cropDay.et0.nature };
  }
  // Case décochée, ou besoin de la culture inconnu ce jour-là (espèce sans culture de
  // référence, ETM partielle, calcul bloqué) : l'ET0 du jour, jamais une demi-ETM (section 6).
  const et0 = et0OfDay(readings.get(date), date, input.today);
  if (et0 === null) return { date, status: 'missing-et0' };
  const sheltered = input.plotMode === 'greenhouse';
  const shelterFactor = shelterFactorOn({ shelterId: sheltered ? bed.plotId : null, shelterFactors: input.shelterFactors }, date);
  const problems = [et0Problem(et0, date), shelterFactorProblem(shelterFactor)].filter((problem): problem is string => problem !== null);
  if (problems.length > 0) return { date, status: 'blocked', problems };
  return {
    date,
    status: 'et0',
    mm: et0.mm * shelterFactor,
    nature: et0.nature,
    shelterFactor: sheltered ? shelterFactor : null,
    cropNeedUnknown: cropDays !== null,
  };
}

function isValued(day: AutomaticObjectiveDay): day is ValuedDay {
  return day.status === 'crop' || day.status === 'no-crop' || day.status === 'et0';
}

function basisOf(valued: readonly ValuedDay[]): AutomaticObjectiveWeek['basis'] {
  const bases = new Set(valued.map((day) => (day.status === 'et0' ? (day.shelterFactor === null ? 'et0' : 'sheltered-et0') : 'crop')));
  if (bases.size === 0) return null;
  return bases.size === 1 ? [...bases][0] : 'mixed';
}
