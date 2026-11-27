import { millimetersNumber, millimetersText } from '../display-numbers.ts';
import { percentFromFraction } from '../units.ts';
import { addDaysToDateKey, weekStartDateKey } from '../water-management.ts';
import { FORECAST_ARCHIVE_FIRST_HORIZON_DAYS, FORECAST_ARCHIVE_LAST_HORIZON_DAYS } from './forecast-archive.ts';

/**
 * La météo prévue contre la météo réalisée (docs/forecast-reliability-contract.md,
 * D-338, PR 1 ; roadmap section 6 quindecies) : ce qui ne dépend pas de la
 * base.
 *
 * Ferme par ferme, la prévision archivée (D-297) pour un jour visé, à
 * l'horizon J+1 à J+7, est appariée au réalisé de ce jour : la pluie de la
 * réanalyse (lecture de base), la pluie du pluviomètre de la ferme (lecture
 * à part, jamais mêlée), la soif du jour (ET0) de la réanalyse. Le module dit
 * de combien l'annonce s'est écartée, sur les 90 derniers jours, par lignes
 * d'horizon et sur la semaine, et se tait sans assez de jours.
 *
 * Une information seulement : rien d'ici n'entre dans le besoin, l'objectif,
 * les alertes ni le planning (D-010, D-041, D-047) ; la pluie prévue reste
 * comptée à 100 %. Aucun seuil de jugement n'est posé : les phrases disent
 * des nombres, jamais un verdict (contrat, section 4).
 */

// Les règles chiffrées du contrat

/** La fenêtre : les 90 derniers jours visés, hier compris, aujourd'hui exclu (§3.7, F998). */
const FORECAST_RELIABILITY_WINDOW_DAYS = 90;
/** Le minimum de couples d'une ligne d'horizon (§5). */
export const FORECAST_RELIABILITY_MINIMUM_PAIRS = 14;
/** Le minimum de jours notés au pluviomètre pour la lecture sur les mesures (§3.3). */
const FORECAST_RELIABILITY_MINIMUM_MEASURED_DAYS = 14;
/** Le minimum de semaines évaluables pour le cumul de la semaine (§5). */
const FORECAST_RELIABILITY_MINIMUM_WEEKS = 4;
/** Un jour de pluie : au moins 1 mm, la convention des météorologues (§4). */
const RAIN_DAY_THRESHOLD_MM = 1;
/**
 * Le retard de la réanalyse : le réalisé d'un jour arrive environ cinq jours
 * après (docs/weather-contract.md). Il ne sert qu'à dire vers quand le
 * premier chiffre est possible.
 */
const REANALYSIS_DELAY_DAYS = 5;

const DAYS_PER_WEEK = 7;

// Les entrées

/** Une ligne de l'archive, telle que la lecture la rend (`listForecastArchive`). */
export type ReliabilityArchiveRow = {
  locationKey: string;
  issuedOn: string;
  targetDate: string;
  horizonDays: number;
  precipitationMm: number | null;
  et0Mm: number | null;
};

/** Une valeur réalisée : la réanalyse d'un lieu, ou la pluie notée par la ferme. */
export type ReliabilityRealisedRow = {
  locationKey: string;
  date: string;
  dataKind: 'forecast' | 'reanalysis' | 'manual_precipitation';
  precipitationMm: number | null;
  et0Mm: number | null;
};

export type ForecastReliabilityInput = {
  /** Le jour civil de Paris de la lecture (D-004). */
  today: string;
  /** Le lieu de météo actuel de la ferme ; `null` quand la ferme n'en a pas. */
  locationKey: string | null;
  archive: readonly ReliabilityArchiveRow[];
  realised: readonly ReliabilityRealisedRow[];
};

// Les lectures et les lignes d'horizon

/** Les trois comparaisons, jamais fondues (§3.3, §3.4). */
export type ReliabilityReading = 'rainEstimated' | 'rainMeasured' | 'thirst';

type HorizonGroupId = 'oneOrTwoDays' | 'threeOrFourDays' | 'fiveToSevenDays' | 'allHorizons';

/** Les trois lignes d'horizon et le total (§3.5), avec leurs mots. */
const HORIZON_GROUPS: readonly { id: HorizonGroupId; horizons: readonly number[]; label: string; phraseStart: string }[] = [
  { id: 'oneOrTwoDays', horizons: [1, 2], label: 'Demain et après-demain', phraseStart: 'À un ou deux jours' },
  { id: 'threeOrFourDays', horizons: [3, 4], label: 'Dans 3 ou 4 jours', phraseStart: 'À 3 ou 4 jours' },
  { id: 'fiveToSevenDays', horizons: [5, 6, 7], label: 'Dans 5 à 7 jours', phraseStart: 'À 5 à 7 jours' },
  { id: 'allHorizons', horizons: [1, 2, 3, 4, 5, 6, 7], label: 'Tous les horizons', phraseStart: 'Tous horizons confondus' },
];

/** Un couple : ce qui était annoncé pour un jour, à un horizon, et ce qui s'est passé ce jour-là. */
export type ForecastPair = {
  targetDate: string;
  issuedOn: string;
  horizonDays: number;
  forecastMm: number;
  realisedMm: number;
};

/** Les écarts d'un ensemble de couples, prévu moins réalisé : positif, l'annonce était trop forte. */
type DailyGaps = {
  meanGapMm: number;
  meanAbsoluteGapMm: number;
};

/** Les jours de pluie mal annoncés (§4, indicateur 3), comptés séparément. */
type RainDayMisses = {
  announcedButDryDays: number;
  fellButUnannouncedDays: number;
};

export type DailyLine = {
  group: HorizonGroupId;
  pairCount: number;
  /** `null` sous le minimum de couples : aucun autre nombre que le compte (§5). */
  gaps: DailyGaps | null;
  /** La pluie seulement ; `null` pour la soif ou sous le minimum. */
  rainDays: RainDayMisses | null;
};

/** Les écarts d'un horizon seul, sans minimum : le domaine les garde pour plus tard (§3.5). */
type HorizonGaps = DailyGaps & { horizonDays: number; pairCount: number };

type WeekGaps = {
  meanGapMm: number;
  meanAbsoluteGapMm: number;
  /** L'écart moyen rapporté au cumul réalisé moyen, en % ; `null` quand rien n'a été réalisé (§4, indicateur 5). */
  meanGapPercentOfRealised: number | null;
};

export type WeekLine = {
  weekCount: number;
  /** `null` sous quatre semaines évaluables (§5). */
  gaps: WeekGaps | null;
};

export type ReadingResult = {
  reading: ReliabilityReading;
  daily: DailyLine[];
  byHorizon: HorizonGaps[];
  week: WeekLine;
};

type ForecastReliabilityStatus = 'noLocation' | 'noArchive' | 'collecting' | 'ready';

export type ForecastReliability = {
  status: ForecastReliabilityStatus;
  window: { startDate: string; endDate: string };
  rainEstimated: ReadingResult;
  rainMeasured: {
    measuredDays: number;
    /** `null` sous quatorze jours notés dans la fenêtre (§3.3). */
    result: ReadingResult | null;
  };
  thirst: ReadingResult;
  /** Le premier jour où un chiffre devient possible, estimé ; `null` quand on ne sait pas le dire (§5). */
  firstFiguresAround: string | null;
};

// La fenêtre

/** Les jours visés lus : de J−90 à hier, bornes comprises (§3.7). */
export function forecastReliabilityWindow(today: string): { startDate: string; endDate: string } {
  return { startDate: addDaysToDateKey(today, -FORECAST_RELIABILITY_WINDOW_DAYS), endDate: addDaysToDateKey(today, -1) };
}

function inWindow(date: string, window: { startDate: string; endDate: string }): boolean {
  return date >= window.startDate && date <= window.endDate;
}

// Les couples

function forecastValue(row: ReliabilityArchiveRow, reading: ReliabilityReading): number | null {
  return reading === 'thirst' ? row.et0Mm : row.precipitationMm;
}

/**
 * Le réalisé de chaque jour pour une lecture : la réanalyse du lieu actuel
 * pour la pluie estimée et la soif ; la pluie notée par la ferme pour la
 * lecture sur les mesures, quel que soit le lieu (elle appartient à la ferme).
 * Une valeur absente n'entre pas : jamais 0 à sa place (D-003).
 */
function realisedByDate(input: ForecastReliabilityInput, reading: ReliabilityReading): Map<string, number> {
  const byDate = new Map<string, number>();
  for (const row of input.realised) {
    const value = reading === 'thirst' ? row.et0Mm : row.precipitationMm;
    if (value === null) continue;
    if (reading === 'rainMeasured' ? row.dataKind !== 'manual_precipitation' : row.dataKind !== 'reanalysis' || row.locationKey !== input.locationKey) continue;
    byDate.set(row.date, value);
  }
  return byDate;
}

/** Une ligne d'archive qui se tient : le lieu actuel, un horizon de J+1 à J+7, le jour visé à cet horizon du jour d'émission. */
function usableArchiveRows(input: ForecastReliabilityInput): ReliabilityArchiveRow[] {
  return input.archive.filter((row) => row.locationKey === input.locationKey
    && row.horizonDays >= FORECAST_ARCHIVE_FIRST_HORIZON_DAYS
    && row.horizonDays <= FORECAST_ARCHIVE_LAST_HORIZON_DAYS
    && addDaysToDateKey(row.issuedOn, row.horizonDays) === row.targetDate);
}

/**
 * Les couples d'une lecture dans la fenêtre (§3.1) : la prévision émise le
 * jour D − h pour D, et le réalisé du jour D, toutes deux connues. Le lieu
 * actuel seulement (§3.2) ; une pluie réelle de 0 mm est un couple.
 */
export function forecastPairs(input: ForecastReliabilityInput, reading: ReliabilityReading): ForecastPair[] {
  if (input.locationKey === null) return [];
  const window = forecastReliabilityWindow(input.today);
  const realised = realisedByDate(input, reading);
  const pairs: ForecastPair[] = [];
  for (const row of usableArchiveRows(input)) {
    if (!inWindow(row.targetDate, window)) continue;
    const forecastMm = forecastValue(row, reading);
    const realisedMm = realised.get(row.targetDate);
    if (forecastMm === null || realisedMm === undefined) continue;
    pairs.push({ targetDate: row.targetDate, issuedOn: row.issuedOn, horizonDays: row.horizonDays, forecastMm, realisedMm });
  }
  return pairs.sort((a, b) => a.targetDate.localeCompare(b.targetDate) || a.horizonDays - b.horizonDays);
}

// Les indicateurs

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Écart moyen et écart absolu moyen, prévu moins réalisé (§4, indicateurs 1, 2 et 5) ; `null` sans couple. */
function dailyGaps(pairs: readonly ForecastPair[]): DailyGaps | null {
  if (pairs.length === 0) return null;
  const gaps = pairs.map((pair) => pair.forecastMm - pair.realisedMm);
  return { meanGapMm: mean(gaps), meanAbsoluteGapMm: mean(gaps.map(Math.abs)) };
}

function isRainDay(millimeters: number): boolean {
  return millimeters >= RAIN_DAY_THRESHOLD_MM;
}

/** Les jours de pluie annoncés sans tomber, et tombés sans être annoncés (§4, indicateur 3). */
function rainDayMisses(pairs: readonly ForecastPair[]): RainDayMisses {
  return {
    announcedButDryDays: pairs.filter((pair) => isRainDay(pair.forecastMm) && !isRainDay(pair.realisedMm)).length,
    fellButUnannouncedDays: pairs.filter((pair) => !isRainDay(pair.forecastMm) && isRainDay(pair.realisedMm)).length,
  };
}

function dailyLines(pairs: readonly ForecastPair[], reading: ReliabilityReading): DailyLine[] {
  return HORIZON_GROUPS.map((group) => {
    const own = pairs.filter((pair) => group.horizons.includes(pair.horizonDays));
    const enough = own.length >= FORECAST_RELIABILITY_MINIMUM_PAIRS;
    return {
      group: group.id,
      pairCount: own.length,
      gaps: enough ? dailyGaps(own) : null,
      rainDays: enough && reading !== 'thirst' ? rainDayMisses(own) : null,
    };
  });
}

function horizonGaps(pairs: readonly ForecastPair[]): HorizonGaps[] {
  const result: HorizonGaps[] = [];
  for (let horizonDays = FORECAST_ARCHIVE_FIRST_HORIZON_DAYS; horizonDays <= FORECAST_ARCHIVE_LAST_HORIZON_DAYS; horizonDays += 1) {
    const own = pairs.filter((pair) => pair.horizonDays === horizonDays);
    const gaps = dailyGaps(own);
    if (gaps) result.push({ horizonDays, pairCount: own.length, ...gaps });
  }
  return result;
}

// La semaine

/** Une semaine évaluable : le cumul annoncé le dimanche d'avant et le cumul réalisé, lundi à dimanche. */
export type WeekPair = { weekStart: string; forecastMm: number; realisedMm: number };

/**
 * Les semaines évaluables de la fenêtre (§3.6) : les sept jours visés dans la
 * fenêtre, chacun avec sa prévision émise le dimanche d'avant (horizons 1 à
 * 7) et son réalisé. Un seul manque, et la semaine n'entre pas.
 */
export function weekPairs(input: ForecastReliabilityInput, reading: ReliabilityReading): WeekPair[] {
  const window = forecastReliabilityWindow(input.today);
  const byIssueAndTarget = new Map(forecastPairs(input, reading).map((pair) => [`${pair.issuedOn}|${pair.targetDate}`, pair]));
  const weeks: WeekPair[] = [];
  const mondayOfStart = weekStartDateKey(window.startDate);
  const firstMonday = mondayOfStart < window.startDate ? addDaysToDateKey(mondayOfStart, DAYS_PER_WEEK) : mondayOfStart;
  for (let monday = firstMonday; addDaysToDateKey(monday, DAYS_PER_WEEK - 1) <= window.endDate; monday = addDaysToDateKey(monday, DAYS_PER_WEEK)) {
    const sunday = addDaysToDateKey(monday, -1);
    const days = Array.from({ length: DAYS_PER_WEEK }, (_, index) => byIssueAndTarget.get(`${sunday}|${addDaysToDateKey(monday, index)}`));
    if (days.some((pair) => pair === undefined)) continue;
    const complete = days as ForecastPair[];
    weeks.push({
      weekStart: monday,
      forecastMm: complete.reduce((sum, pair) => sum + pair.forecastMm, 0),
      realisedMm: complete.reduce((sum, pair) => sum + pair.realisedMm, 0),
    });
  }
  return weeks;
}

/** Les écarts du cumul de la semaine (§4, indicateurs 4 et 5). */
function weekGaps(weeks: readonly WeekPair[]): WeekGaps | null {
  if (weeks.length === 0) return null;
  const gaps = weeks.map((week) => week.forecastMm - week.realisedMm);
  const meanRealised = mean(weeks.map((week) => week.realisedMm));
  const meanGapMm = mean(gaps);
  return {
    meanGapMm,
    meanAbsoluteGapMm: mean(gaps.map(Math.abs)),
    meanGapPercentOfRealised: meanRealised > 0 ? percentFromFraction(meanGapMm / meanRealised) : null,
  };
}

function readingResult(input: ForecastReliabilityInput, reading: ReliabilityReading): ReadingResult {
  const pairs = forecastPairs(input, reading);
  const weeks = weekPairs(input, reading);
  return {
    reading,
    daily: dailyLines(pairs, reading),
    byHorizon: horizonGaps(pairs),
    week: { weekCount: weeks.length, gaps: weeks.length >= FORECAST_RELIABILITY_MINIMUM_WEEKS ? weekGaps(weeks) : null },
  };
}

// L'ensemble

/** Les jours notés au pluviomètre dans la fenêtre, avec ou sans prévision en face (§3.3). */
function measuredDays(input: ForecastReliabilityInput): number {
  const window = forecastReliabilityWindow(input.today);
  return new Set(input.realised
    .filter((row) => row.dataKind === 'manual_precipitation' && row.precipitationMm !== null && inWindow(row.date, window))
    .map((row) => row.date)).size;
}

/**
 * Vers quand la première ligne (demain et après-demain) peut avoir ses
 * quatorze couples : à partir du premier jour d'émission gardé (ou de
 * demain, sans archive), le jour visé qui complète le compte, plus le retard
 * de la réanalyse. Une estimation, dite « vers le » ; `null` quand elle est
 * déjà passée (des jours manquent, on ne sait pas dire quand).
 */
function firstFiguresAround(input: ForecastReliabilityInput, archive: readonly ReliabilityArchiveRow[]): string | null {
  const firstIssue = archive.reduce<string | null>((first, row) => (first === null || row.issuedOn < first ? row.issuedOn : first), null)
    ?? input.today;
  const shortest = HORIZON_GROUPS[0].horizons;
  let count = 0;
  let target = firstIssue;
  while (count < FORECAST_RELIABILITY_MINIMUM_PAIRS) {
    target = addDaysToDateKey(target, 1);
    count += shortest.filter((horizon) => addDaysToDateKey(target, -horizon) >= firstIssue).length;
  }
  const around = addDaysToDateKey(target, REANALYSIS_DELAY_DAYS);
  return around > input.today ? around : null;
}

/** La comparaison d'une ferme, de bout en bout (§3 à §5). */
export function forecastReliability(input: ForecastReliabilityInput): ForecastReliability {
  const window = forecastReliabilityWindow(input.today);
  const rainEstimated = readingResult(input, 'rainEstimated');
  const thirst = readingResult(input, 'thirst');
  const measured = measuredDays(input);
  const rainMeasured = {
    measuredDays: measured,
    result: measured >= FORECAST_RELIABILITY_MINIMUM_MEASURED_DAYS ? readingResult(input, 'rainMeasured') : null,
  };
  const archive = input.locationKey === null ? [] : usableArchiveRows(input);
  const anyFigure = [rainEstimated, thirst].some((result) => result.daily.some((line) => line.gaps !== null));
  const status: ForecastReliabilityStatus = input.locationKey === null ? 'noLocation'
    : archive.length === 0 ? 'noArchive'
      : anyFigure ? 'ready' : 'collecting';
  return {
    status,
    window,
    rainEstimated,
    rainMeasured,
    thirst,
    firstFiguresAround: status === 'noArchive' || status === 'collecting' ? firstFiguresAround(input, archive) : null,
  };
}

// Les phrases (§6) : des nombres, le signe en mots, jamais un verdict

/** Un écart qui s'écrit « 0 » à une décimale : l'annonce tombe juste en moyenne. */
function roundsToZero(millimeters: number): boolean {
  return millimetersNumber(Math.abs(millimeters)) === '0';
}

function groupOf(id: HorizonGroupId) {
  return HORIZON_GROUPS.find((group) => group.id === id)!;
}

const REALISED_WORDS: Record<ReliabilityReading, { realised: string; subject: string; tooHigh: string; tooLow: string }> = {
  rainEstimated: { realised: 'de celle estimée', subject: 'la pluie annoncée', tooHigh: 'était trop pluvieuse', tooLow: 'n’était pas assez pluvieuse' },
  rainMeasured: { realised: 'de celle mesurée à la ferme', subject: 'la pluie annoncée', tooHigh: 'était trop pluvieuse', tooLow: 'n’était pas assez pluvieuse' },
  thirst: { realised: 'de celle estimée', subject: 'la soif annoncée', tooHigh: 'était trop forte', tooLow: 'était trop faible' },
};

/** « était trop pluvieuse, de 2,1 mm par jour en moyenne » ; un écart qui s'écrit 0 : « tombait juste en moyenne ». */
function directionText(reading: ReliabilityReading, meanGapMm: number, unit: string): string {
  const words = REALISED_WORDS[reading];
  if (roundsToZero(meanGapMm)) return 'tombait juste en moyenne';
  return `${meanGapMm > 0 ? words.tooHigh : words.tooLow}, de ${millimetersText(Math.abs(meanGapMm))}${unit} en moyenne`;
}

const percent = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

/** « Pas encore assez de jours : 9 sur 14 » (§5). */
function notEnoughDaysText(count: number, minimum = FORECAST_RELIABILITY_MINIMUM_PAIRS): string {
  return `Pas encore assez de jours : ${count} sur ${minimum}`;
}

/** « Pas encore assez de semaines : 2 sur 4 » (§5). */
function notEnoughWeeksText(count: number): string {
  return `Pas encore assez de semaines : ${count} sur ${FORECAST_RELIABILITY_MINIMUM_WEEKS}`;
}

/**
 * La phrase d'une ligne d'horizon : « À 3 ou 4 jours, la pluie annoncée
 * s'écarte en moyenne de 2,1 mm par jour de celle estimée ; elle était trop
 * pluvieuse, de 0,8 mm par jour en moyenne. » Sous le minimum, le compte seul.
 */
export function dailyLineText(reading: ReliabilityReading, line: DailyLine): string {
  const group = groupOf(line.group);
  if (!line.gaps) return `${group.label} : ${notEnoughDaysText(line.pairCount)}.`;
  const words = REALISED_WORDS[reading];
  return `${group.phraseStart}, ${words.subject} s’écarte en moyenne de ${millimetersText(line.gaps.meanAbsoluteGapMm)} par jour ${words.realised} ; `
    + `elle ${directionText(reading, line.gaps.meanGapMm, ' par jour')}.`;
}

/** « Pluie annoncée mais pas tombée : 3 jours ; tombée sans être annoncée : 2 jours, sur 40 jours comparés. » */
export function rainDaysText(line: DailyLine): string | null {
  if (!line.rainDays) return null;
  const days = (count: number) => `${count} jour${count > 1 ? 's' : ''}`;
  return `Pluie annoncée mais pas tombée : ${days(line.rainDays.announcedButDryDays)} ; `
    + `tombée sans être annoncée : ${days(line.rainDays.fellButUnannouncedDays)}, sur ${days(line.pairCount)} comparés.`;
}

/**
 * La phrase de la semaine : « Sur la semaine, l'annonce du dimanche était
 * trop pluvieuse de 4 mm en moyenne ; elle s'écarte en moyenne de 6 mm du
 * cumul estimé. » Pour la soif, le pourcentage du réalisé suit.
 */
export function weekLineText(reading: ReliabilityReading, week: WeekLine): string {
  if (!week.gaps) return `Cumul de la semaine : ${notEnoughWeeksText(week.weekCount)}.`;
  const words = REALISED_WORDS[reading];
  const share = reading === 'thirst' && week.gaps.meanGapPercentOfRealised !== null && !roundsToZero(week.gaps.meanGapMm)
    ? `, soit ${percent.format(Math.abs(week.gaps.meanGapPercentOfRealised))} % de la soif estimée`
    : '';
  return `Sur la semaine, ${words.subject} le dimanche ${directionText(reading, week.gaps.meanGapMm, '')}${share} ; `
    + `l’écart, dans un sens ou dans l’autre, est de ${millimetersText(week.gaps.meanAbsoluteGapMm)} en moyenne.`;
}

/**
 * La réserve de la soif (§3.4) : la soif annoncée et la soif estimée ne se
 * calculent pas de la même façon ; l'écart de la veille sert de plancher.
 * Sans assez de couples à J+1, la réserve se dit sans chiffre.
 */
export function thirstReserveText(result: ReadingResult): string {
  const dayAhead = result.byHorizon.find((horizon) => horizon.horizonDays === FORECAST_ARCHIVE_FIRST_HORIZON_DAYS);
  const base = 'La soif annoncée et la soif estimée ne se calculent pas de la même façon.';
  if (!dayAhead || dayAhead.pairCount < FORECAST_RELIABILITY_MINIMUM_PAIRS) return `${base} Une partie de l’écart vient de là, pas de l’annonce.`;
  return `${base} Même la veille, elles s’écartent de ${millimetersText(dayAhead.meanAbsoluteGapMm)} par jour en moyenne : `
    + 'cette part vient de la façon de calculer ; seul ce qui s’y ajoute plus loin vient de l’annonce.';
}

/** La réserve de la pluie estimée (§3.3, §12) : ce n'est pas une mesure de la ferme. */
export const ESTIMATED_RAIN_RESERVE_TEXT = 'La pluie estimée n’est pas mesurée chez vous : le service météo la calcule après coup, quelques jours plus tard. '
  + 'Notée au pluviomètre, votre pluie donne une comparaison plus proche du terrain.';

function dateText(dateKey: string): string {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${dateKey}T12:00:00.000Z`));
}

/** La phrase de tête du pli (§5, §6). */
export function forecastReliabilityHeadline(reliability: ForecastReliability): string {
  const around = reliability.firstFiguresAround ? ` Premiers chiffres vers le ${dateText(reliability.firstFiguresAround)}.` : '';
  switch (reliability.status) {
    case 'noLocation':
      return 'La commune de la météo n’est pas encore choisie : sans elle, il n’y a rien à comparer.';
    case 'noArchive':
      return `Le module garde chaque matin ce que la météo annonce pour les sept jours suivants ; rien n’est encore gardé pour cette commune.${around}`;
    case 'collecting':
      return `${notEnoughDaysText(reliability.rainEstimated.daily[0].pairCount)} pour comparer.${around}`;
    case 'ready':
      return `Sur les ${FORECAST_RELIABILITY_WINDOW_DAYS} derniers jours, voici de combien la météo annoncée s’est écartée de ce qui s’est passé.`;
  }
}
