import { MILLISECONDS_PER_DAY, MILLISECONDS_PER_HOUR } from '../units.ts';
import { addDaysToDateKey, isValidDateKey, localDateStartUtc } from '../water-management.ts';

/**
 * L'ET0 horaire, la forme de la journée (docs/et0-horaire-contract.md,
 * D-340, HR1) : ce qui ne dépend ni de la base ni du réseau.
 *
 * Le total du jour reste LA valeur de référence ; l'heure n'en donne que la
 * forme, c'est-à-dire la part de la journée qui tombe dans chaque heure
 * (§ 2, choix 1 et 2). Ce module dit les heures d'une journée du lieu
 * (23, 24 ou 25), les parts tirées d'une ET0 horaire, la forme théorique du
 * soleil, le consommé et le reste d'un total à un instant, et les heures de
 * forte évaporation. Information seulement (question 1, D-340) : rien ici
 * n'entre dans la jauge, l'ETM, l'objectif, le besoin ni les alertes.
 */

/** Les trois sources de la forme, de la plus fine à la plus simple (§ 2, choix 3). */
export const HOURLY_ET0_NATURES = ['provider-hourly', 'computed-hourly', 'theoretical'] as const;
export type HourlyEt0Nature = (typeof HOURLY_ET0_NATURES)[number];

/**
 * Le seuil des heures de forte évaporation : 75 % du maximum horaire du jour
 * (question 3 tranchée par le porteur le 26 novembre 2026, « Oui, en
 * information (75 %) ») ; une constante du code, aucun réglage.
 */
export const HIGH_DEMAND_SHARE_OF_DAILY_MAXIMUM = 0.75;

/**
 * La plus petite valeur négative d'une heure ramenée à 0 avant l'addition
 * (§ 4.2) : le calcul FAO-56 à l'heure (équation 53) donne la nuit de petites
 * valeurs négatives, quelques centièmes de millimètre, quand le rayonnement
 * net est négatif. Au-delà de 0,05 mm en une heure, la valeur n'est plus une
 * correction de nuit : elle est lue comme absente (D-003), jamais comme 0.
 */
export const NIGHT_NEGATIVE_TOLERANCE_MM = 0.05;

/** Une heure de la journée civile du lieu, identifiée par son début (§ 4.1). */
export type DayHour = {
  /** Le rang de l'heure dans la journée, de 0 à 22, 23 ou 24. */
  index: number;
  /** Le début et la fin de l'heure, en instants UTC (ISO 8601). */
  startsAt: string;
  endsAt: string;
  /** L'heure d'horloge du début, lue au lieu (0 à 23) ; deux fois la même le jour de 25 h. */
  localHour: number;
};

/** La forme d'une journée : une part par heure, leur somme vaut 1, et sa source. */
export type DayShape = {
  date: string;
  timeZone: string;
  nature: HourlyEt0Nature;
  hours: DayHour[];
  shares: number[];
};

/** Ce que l'on tire d'une forme et d'un total du jour à un instant (§ 4.3). */
export type DayShapeReading = {
  consumedMm: number | null;
  remainingMm: number | null;
  highDemand: HighDemandRange | null;
};

/** La plage des heures de forte évaporation, de la première à la dernière heure au seuil. */
export type HighDemandRange = {
  firstHourIndex: number;
  lastHourIndex: number;
  startsAt: string;
  endsAt: string;
};

const RADIANS_PER_DEGREE = Math.PI / 180;
/** La rotation de la Terre : 15° d'angle horaire solaire par heure. */
const DEGREES_OF_HOUR_ANGLE_PER_HOUR = 15;
/** Le midi solaire, en heures du temps solaire. */
const SOLAR_NOON_HOURS = 12;
/** Le milieu d'une heure, où se calcule la hauteur du soleil (§ 4.4). */
const MIDDLE_OF_HOUR = 0.5;
/** Déclinaison du soleil, FAO-56 équation 24 : δ = 0,409 · sin(2π J / 365 − 1,39). */
const DECLINATION_AMPLITUDE_RADIANS = 0.409;
const DAYS_PER_YEAR_FAO = 365;
const DECLINATION_PHASE_RADIANS = 1.39;

const localHourFormatters = new Map<string, Intl.DateTimeFormat>();

function localHourFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = localHourFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', hourCycle: 'h23', timeZone });
    localHourFormatters.set(timeZone, formatter);
  }
  return formatter;
}

function localHourAt(instant: number, timeZone: string): number {
  const hour = localHourFormatter(timeZone).formatToParts(new Date(instant)).find((part) => part.type === 'hour');
  return Number(hour?.value);
}

/**
 * Les heures de la journée civile `date` au fuseau du lieu (§ 4.1) : 24, 23
 * le jour du passage à l'heure d'été, 25 le jour du retour à l'heure d'hiver.
 * Une heure qui n'existe pas ce jour-là n'est pas inventée ; l'heure répétée
 * est comptée deux fois, dans l'ordre. Le fuseau est celui du lieu, jamais
 * Paris par défaut (D-028, logiciel multi-fermes).
 */
export function hoursOfDay(date: string, timeZone: string): DayHour[] {
  if (!isValidDateKey(date)) throw new Error('Jour invalide.');
  const start = localDateStartUtc(date, timeZone).getTime();
  const end = localDateStartUtc(addDaysToDateKey(date, 1), timeZone).getTime();
  const hours: DayHour[] = [];
  for (let instant = start, index = 0; instant < end; instant += MILLISECONDS_PER_HOUR, index += 1) {
    hours.push({
      index,
      startsAt: new Date(instant).toISOString(),
      endsAt: new Date(Math.min(instant + MILLISECONDS_PER_HOUR, end)).toISOString(),
      localHour: localHourAt(instant, timeZone),
    });
  }
  return hours;
}

/**
 * Les parts d'une journée tirées de ses valeurs d'ET0 horaire, en mm par
 * heure, dans l'ordre des heures de `hoursOfDay` (§ 4.2).
 *
 * `null` (pas de forme de cette source, on passe à la suivante) quand le
 * nombre de valeurs n'est pas celui des heures du jour, quand une seule heure
 * est absente, illisible ou franchement négative (lue comme absente, jamais
 * bouchée par 0, D-003), ou quand la somme est nulle. Une petite valeur
 * négative de nuit est ramenée à 0 avant l'addition : c'est la seule
 * correction permise.
 */
export function sharesFromHourlyEt0(
  valuesMm: readonly (number | null | undefined)[],
  hourCount: number,
): number[] | null {
  if (valuesMm.length !== hourCount || hourCount === 0) return null;
  const cleaned: number[] = [];
  for (const value of valuesMm) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    if (value < -NIGHT_NEGATIVE_TOLERANCE_MM) return null;
    cleaned.push(Math.max(0, value));
  }
  return normalizedShares(cleaned);
}

function normalizedShares(weights: readonly number[]): number[] | null {
  const sum = weights.reduce((total, weight) => total + weight, 0);
  if (!(sum > 0)) return null;
  return weights.map((weight) => weight / sum);
}

/** Le rang du jour dans l'année (1 au 1er janvier), FAO-56 équation 24. */
function dayOfYear(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 0)) / MILLISECONDS_PER_DAY);
}

/**
 * La forme théorique de la journée, sans réseau (§ 4.4) : pour chaque heure,
 * un poids `max(0, sin β)` au milieu de l'heure, où
 * `sin β = sin φ · sin δ + cos φ · cos δ · cos ω` (FAO-56 équation 28) ;
 * l'angle horaire `ω` vient de l'heure solaire, tirée de l'instant UTC et de
 * la longitude du lieu ; l'équation du temps (moins de 17 minutes) est
 * négligée. La forme est donc symétrique autour du midi solaire, ce que
 * l'écran dit. `null` quand le soleil ne passe au-dessus de l'horizon au
 * milieu d'aucune heure (nuit polaire) : jamais une forme inventée.
 */
export function theoreticalShares(
  date: string,
  timeZone: string,
  location: { latitude: number; longitude: number },
): number[] | null {
  const hours = hoursOfDay(date, timeZone);
  const latitude = location.latitude * RADIANS_PER_DEGREE;
  const declination = DECLINATION_AMPLITUDE_RADIANS
    * Math.sin(2 * Math.PI * dayOfYear(date) / DAYS_PER_YEAR_FAO - DECLINATION_PHASE_RADIANS);
  const weights = hours.map((hour) => {
    const start = Date.parse(hour.startsAt);
    const middle = start + (Date.parse(hour.endsAt) - start) * MIDDLE_OF_HOUR;
    const utcHours = (middle % MILLISECONDS_PER_DAY) / MILLISECONDS_PER_HOUR;
    const solarHours = utcHours + location.longitude / DEGREES_OF_HOUR_ANGLE_PER_HOUR;
    const hourAngle = (solarHours - SOLAR_NOON_HOURS) * DEGREES_OF_HOUR_ANGLE_PER_HOUR * RADIANS_PER_DEGREE;
    const sinElevation = Math.sin(latitude) * Math.sin(declination)
      + Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle);
    return Math.max(0, sinElevation);
  });
  return normalizedShares(weights);
}

/**
 * La forme de la journée, la meilleure source disponible gagnant (§ 2,
 * choix 3) : l'heure du fournisseur, puis l'heure calculée par le module,
 * puis la forme théorique du soleil. Une source absente ou refusée passe à la
 * suivante, et la nature dit laquelle a servi ; jamais un mélange de deux
 * sources dans une même journée. `null` seulement si aucune ne donne de
 * forme (nuit polaire sans heure du fournisseur).
 */
export function dayShape(input: {
  date: string;
  timeZone: string;
  location: { latitude: number; longitude: number };
  providerHourlyEt0Mm?: readonly (number | null | undefined)[] | null;
  computedHourlyEt0Mm?: readonly (number | null | undefined)[] | null;
}): DayShape | null {
  const hours = hoursOfDay(input.date, input.timeZone);
  const candidates: [HourlyEt0Nature, () => number[] | null][] = [
    ['provider-hourly', () => (input.providerHourlyEt0Mm ? sharesFromHourlyEt0(input.providerHourlyEt0Mm, hours.length) : null)],
    ['computed-hourly', () => (input.computedHourlyEt0Mm ? sharesFromHourlyEt0(input.computedHourlyEt0Mm, hours.length) : null)],
    ['theoretical', () => theoreticalShares(input.date, input.timeZone, input.location)],
  ];
  for (const [nature, shares] of candidates) {
    const found = shares();
    if (found) return { date: input.date, timeZone: input.timeZone, nature, hours, shares: found };
  }
  return null;
}

/**
 * La part de la journée déjà passée à l'instant `at` : les parts des heures
 * terminées, plus la part de l'heure en cours au prorata du temps écoulé
 * (§ 4.3). 0 avant le début du jour, 1 après sa fin.
 */
export function elapsedShare(shape: Pick<DayShape, 'hours' | 'shares'>, at: Date | string): number {
  const instant = typeof at === 'string' ? Date.parse(at) : at.getTime();
  if (!Number.isFinite(instant)) throw new Error('Instant invalide.');
  let elapsed = 0;
  shape.hours.forEach((hour, index) => {
    const start = Date.parse(hour.startsAt);
    const end = Date.parse(hour.endsAt);
    if (instant >= end) elapsed += shape.shares[index];
    else if (instant > start) elapsed += shape.shares[index] * (instant - start) / (end - start);
  });
  return Math.min(1, elapsed);
}

/**
 * Les heures de forte évaporation : celles dont la part atteint 75 % de la
 * plus forte part du jour (§ 4.3, question 3), regroupées en une seule plage
 * de la première à la dernière ; une heure plus faible prise entre les deux
 * (un passage nuageux à midi) reste dans la plage.
 */
export function highDemandRange(shape: Pick<DayShape, 'hours' | 'shares'>): HighDemandRange | null {
  const maximum = Math.max(...shape.shares);
  if (!(maximum > 0)) return null;
  const threshold = maximum * HIGH_DEMAND_SHARE_OF_DAILY_MAXIMUM;
  const atThreshold = shape.shares.flatMap((share, index) => (share >= threshold ? [index] : []));
  const firstHourIndex = atThreshold[0];
  const lastHourIndex = atThreshold[atThreshold.length - 1];
  return {
    firstHourIndex,
    lastHourIndex,
    startsAt: shape.hours[firstHourIndex].startsAt,
    endsAt: shape.hours[lastHourIndex].endsAt,
  };
}

/**
 * Ce que la forme dit d'un total du jour `totalMm` (l'ET0 de la ferme, ou
 * l'ETM d'une planche) à l'instant `at` (§ 4.3) : le consommé, le reste à
 * venir, et la plage de forte évaporation. Les trois sont inconnus, jamais
 * 0, quand le total du jour est inconnu (ET0 manquante) : la forme existe,
 * mais aucune valeur n'est dite (scénario 8). Les millimètres ne sont pas
 * arrondis ici : l'écran les arrondit.
 */
export function readDayShape(
  shape: Pick<DayShape, 'hours' | 'shares'>,
  totalMm: number | null | undefined,
  at: Date | string,
): DayShapeReading {
  if (typeof totalMm !== 'number' || !Number.isFinite(totalMm) || totalMm < 0) {
    return { consumedMm: null, remainingMm: null, highDemand: null };
  }
  const consumedMm = totalMm * elapsedShare(shape, at);
  return { consumedMm, remainingMm: totalMm - consumedMm, highDemand: highDemandRange(shape) };
}

/**
 * L'horizon de la forme : aujourd'hui, demain et après-demain (§ 2, choix 4).
 * Au-delà, les prévisions horaires ne sont pas fiables et rien n'est écrit.
 */
const DAY_SHAPE_LAST_HORIZON_DAYS = 2;

/** La conservation des formes écrites : 8 jours, les 3 jours lus, la veille et de la marge (§ 5). */
export const DAY_SHAPES_KEPT_DAYS = 8;

/** Les heures d'ET0 d'un jour, lues ou calculées, dans l'ordre de `hoursOfDay` : ce que l'adaptateur joint à un jour prévu. */
export type HourlyEt0Series = {
  nature: Exclude<HourlyEt0Nature, 'theoretical'>;
  valuesMm: (number | null)[];
};

/**
 * Les valeurs horaires d'un jour rangées sur les heures de `hoursOfDay`, à
 * partir d'instants exacts (le début de chaque heure, en millisecondes
 * UNIX). Une heure sans valeur reste `null` : la forme du jour sera refusée
 * (§ 4.2), jamais bouchée par 0 ; une valeur qui ne tombe sur aucun début
 * d'heure du jour est ignorée.
 */
export function hourlyValuesOnDayHours(
  date: string,
  timeZone: string,
  points: readonly { startsAtMs: number; valueMm: number | null }[],
): (number | null)[] {
  const byStart = new Map(points.map((point) => [point.startsAtMs, point.valueMm]));
  return hoursOfDay(date, timeZone).map((hour) => byStart.get(Date.parse(hour.startsAt)) ?? null);
}

/**
 * Les valeurs horaires d'un jour à partir d'heures d'horloge locales
 * (`AAAA-MM-JJTHH:MM`, comme les donne Open-Meteo avec un fuseau), prises
 * dans l'ordre de la réponse. Elles ne sont rangées que si leur nombre est
 * exactement celui des heures du jour au fuseau du lieu (23, 24 ou 25) ;
 * sinon `null` : la forme de ce fournisseur est refusée pour ce jour, jamais
 * décalée d'une heure (D-349, F1039).
 */
export function hourlyValuesInLocalOrder(
  date: string,
  timeZone: string,
  localTimes: readonly unknown[],
  valuesMm: readonly unknown[],
): (number | null)[] | null {
  if (localTimes.length !== valuesMm.length) return null;
  const values: (number | null)[] = [];
  localTimes.forEach((time, index) => {
    if (typeof time !== 'string' || time.slice(0, 10) !== date) return;
    const value = valuesMm[index];
    values.push(typeof value === 'number' && Number.isFinite(value) ? value : null);
  });
  return values.length === hoursOfDay(date, timeZone).length ? values : null;
}

/** Une forme à écrire : un jour du lieu, sa nature et ses parts. La forme théorique ne s'écrit pas : elle se calcule. */
export type RecordedDayShape = {
  date: string;
  nature: Exclude<HourlyEt0Nature, 'theoretical'>;
  shares: number[];
};

/**
 * Les formes qu'une lecture de prévision donne pour un lieu (§ 2 choix 3
 * et 4, § 5) : une par jour de J0 à J+2 dont l'heure du fournisseur ou
 * l'heure calculée donne une forme. Un jour sans heure lisible n'a pas de
 * ligne : l'écran prendra la forme théorique, et la dira (D-349, F1040) ;
 * comme pour la météo du jour, un jour vide n'efface rien.
 */
export function dayShapesToRecord(input: {
  today: string;
  timeZone: string;
  days: readonly { date: string; hourlyEt0?: HourlyEt0Series | null }[];
}): RecordedDayShape[] {
  const lastDate = addDaysToDateKey(input.today, DAY_SHAPE_LAST_HORIZON_DAYS);
  return input.days.flatMap((day): RecordedDayShape[] => {
    if (!isValidDateKey(day.date) || day.date < input.today || day.date > lastDate || !day.hourlyEt0) return [];
    const shares = sharesFromHourlyEt0(day.hourlyEt0.valuesMm, hoursOfDay(day.date, input.timeZone).length);
    return shares ? [{ date: day.date, nature: day.hourlyEt0.nature, shares }] : [];
  });
}

/** Le plus ancien jour gardé à la purge du jour `today` : les jours avant lui s'effacent (§ 5). */
export function oldestKeptDayShapeDay(today: string): string {
  return addDaysToDateKey(today, -DAY_SHAPES_KEPT_DAYS);
}
