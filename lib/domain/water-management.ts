import type { IrrigationEventRecord } from './irrigation-event-record.ts';
import { cubicMetersFromMillimeters, millisecondsFromSeconds } from './units.ts';
import { activeTimerSeconds } from './irrigation-timer.ts';
import { mmText } from './figure-origin.ts';

export const FARM_TIME_ZONE = 'Europe/Paris';

export type HydricGoalScope = 'farm' | 'zone' | 'plot' | 'bed';

export type HydricGoal = {
  id: string;
  season: number;
  weekStart: string;
  scopeType: HydricGoalScope;
  otfZoneId: string | null;
  otfPlotId: string | null;
  otfBedId: string | null;
  amountMm: number;
  createdAt: string;
};

export type DailyWaterLedger = {
  date: string;
  realizedCubicMeters: number;
  plannedCubicMeters: number;
  estimatedOngoingCubicMeters?: number;
  /** Une irrigation de ce jour a une planche sans surface mouillée connue : les volumes sont incomplets. */
  volumeIncomplete?: boolean;
};

export type DailyWaterLimit = {
  id: string;
  season: number;
  enabled: boolean;
  maxCubicMetersPerDay: number | null;
  validFrom: string;
  validUntil: string | null;
  note: string | null;
  createdAt: string;
};

export type DailyLimitEvaluation = {
  date: string;
  limitCubicMeters: number;
  alreadyCommittedCubicMeters: number;
  alreadyRealizedCubicMeters: number;
  alreadyPlannedCubicMeters: number;
  alreadyEstimatedCubicMeters: number;
  candidateCubicMeters: number;
  exceededByCubicMeters: number;
};

export function dailyLimitViolationPolicy(
  kind: 'planned' | 'running' | 'completed',
): 'block' | 'warn' {
  return kind === 'completed' ? 'warn' : 'block';
}

export function dateKeyInTimeZone(
  value: Date | string,
  timeZone = FARM_TIME_ZONE,
): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (!Number.isFinite(date.getTime())) throw new Error('Date invalide.');
  const parts = dateKeyFormatter(timeZone).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function weekStartDateKey(
  value: Date | string,
  timeZone = FARM_TIME_ZONE,
): string {
  const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(String(value))
    ? String(value)
    : dateKeyInTimeZone(value, timeZone);
  const day = new Date(`${dateKey}T12:00:00.000Z`).getUTCDay();
  return addDaysToDateKey(dateKey, -(day === 0 ? 6 : day - 1));
}

/**
 * Ce que montre le champ « Millimètres » de la pluie mesurée pour le jour choisi
 * (choix du porteur, 7 novembre 2026) : la mesure déjà saisie, à la virgule, y
 * compris `0` ; une chaîne vide si aucune mesure n'est saisie ; `null` si le jour
 * n'est pas dans la semaine chargée, dont il faut alors charger la semaine.
 */
export function manualRainInput(
  days: readonly Pick<WaterDashboardDay, 'date' | 'manualRainMm'>[],
  date: string,
): string | null {
  const day = days.find((item) => item.date === date);
  if (!day) return null;
  return day.manualRainMm === null ? '' : String(day.manualRainMm).replace('.', ',');
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  assertDateKey(dateKey);
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function weekDateKeys(weekStart: string): string[] {
  const monday = weekStartDateKey(weekStart);
  return Array.from({ length: 7 }, (_, index) => addDaysToDateKey(monday, index));
}

export function localDateStartUtc(
  dateKey: string,
  timeZone = FARM_TIME_ZONE,
): Date {
  return localDateTimeUtc(dateKey, { hour: 0, minute: 0, second: 0 }, timeZone);
}

/**
 * L'instant que désigne une heure d'horloge lue à la ferme.
 *
 * Une heure d'horloge ne dit pas quel instant elle désigne tant qu'on ne dit
 * pas où on la lit : « 06:00 » vaut 04:00 UTC en été et 05:00 en hiver. On part
 * de l'heure prise pour de l'UTC, puis on la corrige du décalage réellement en
 * vigueur à l'instant obtenu ; quelques passes suffisent, y compris les jours
 * de changement d'heure, où le décalage d'avant n'est plus celui d'après.
 */
export function localDateTimeUtc(
  dateKey: string,
  timeOfDay: { hour: number; minute: number; second: number },
  timeZone = FARM_TIME_ZONE,
): Date {
  assertDateKey(dateKey);
  const [year, month, day] = dateKey.split('-').map(Number);
  const targetUtcLike = Date.UTC(
    year,
    month - 1,
    day,
    timeOfDay.hour,
    timeOfDay.minute,
    timeOfDay.second,
  );
  let guess = targetUtcLike;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = zonedDateTimeParts(new Date(guess), timeZone);
    const representedUtcLike = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const correction = targetUtcLike - representedUtcLike;
    guess += correction;
    if (correction === 0) break;
  }
  return new Date(guess);
}

export function splitVolumeAcrossLocalDays({
  startAt,
  endAt,
  cubicMeters,
  timeZone = FARM_TIME_ZONE,
}: {
  startAt: string | Date;
  endAt: string | Date;
  cubicMeters: number;
  timeZone?: string;
}): Map<string, number> {
  const start = typeof startAt === 'string' ? new Date(startAt) : startAt;
  const end = typeof endAt === 'string' ? new Date(endAt) : endAt;
  const result = new Map<string, number>();
  const totalMs = end.getTime() - start.getTime();
  if (!(totalMs > 0) || !(cubicMeters > 0)) return result;

  let dateKey = dateKeyInTimeZone(start, timeZone);
  while (true) {
    const dayStart = localDateStartUtc(dateKey, timeZone).getTime();
    const nextDateKey = addDaysToDateKey(dateKey, 1);
    const dayEnd = localDateStartUtc(nextDateKey, timeZone).getTime();
    const overlapMs = Math.max(
      0,
      Math.min(end.getTime(), dayEnd) - Math.max(start.getTime(), dayStart),
    );
    if (overlapMs > 0) {
      result.set(dateKey, cubicMeters * overlapMs / totalMs);
    }
    if (dayEnd >= end.getTime()) break;
    dateKey = nextDateKey;
  }
  return result;
}

type VolumeApplication = {
  wettedAreaSquareMeters: number | null;
  plannedAmountMm: number;
  actualAmountMm: number;
};

/**
 * Volume d'une irrigation : les millimètres de chaque planche sur sa surface
 * mouillée (docs/wetted-surface-contract.md). Une planche sans surface mouillée
 * connue est laissée de côté — son volume est inconnu, pas nul — et
 * `irrigationVolumeIncomplete` le dit à qui affiche le total.
 */
export function irrigationVolumeCubicMeters(
  applications: readonly VolumeApplication[],
  kind: 'planned' | 'actual',
): number {
  return applications.reduce((total, application) => {
    if (application.wettedAreaSquareMeters === null) return total;
    const amount = kind === 'actual'
      ? application.actualAmountMm
      : application.plannedAmountMm;
    return total + cubicMetersFromMillimeters(amount, application.wettedAreaSquareMeters);
  }, 0);
}

/** Vrai quand une planche qui reçoit de l'eau n'a pas de surface mouillée connue. */
export function irrigationVolumeIncomplete(
  applications: readonly VolumeApplication[],
  kind: 'planned' | 'actual',
): boolean {
  return applications.some((application) => application.wettedAreaSquareMeters === null
    && (kind === 'actual' ? application.actualAmountMm : application.plannedAmountMm) > 0);
}

export function buildDailyWaterLedger(
  events: readonly IrrigationEventRecord[],
  now = new Date(),
  timeZone = FARM_TIME_ZONE,
  excludePlannedEquipmentId?: string,
): DailyWaterLedger[] {
  const rows = new Map<string, DailyWaterLedger>();
  const add = (date: string, key: 'realizedCubicMeters' | 'plannedCubicMeters' | 'estimatedOngoingCubicMeters', value: number) => {
    const row = rows.get(date) ?? {
      date,
      realizedCubicMeters: 0,
      plannedCubicMeters: 0,
    };
    row[key] = (row[key] ?? 0) + value;
    rows.set(date, row);
  };

  for (const event of events) {
    if (event.status === 'canceled' || event.equipment.status === 'canceled') continue;
    const equipment = event.equipment;
    const actualTotal = irrigationVolumeCubicMeters(equipment.applications, 'actual');
    const plannedTotal = irrigationVolumeCubicMeters(equipment.applications, 'planned');
    const activeSeconds = equipment.timerState ? activeTimerSeconds({
      state: equipment.timerState,
      resumedAt: equipment.timerResumedAt,
      pausedAt: equipment.timerPausedAt,
      accumulatedSeconds: equipment.timerAccumulatedSeconds,
      targetDurationSeconds: equipment.plannedDurationSeconds,
    }, now) : 0;
    const liveActual = equipment.timerState && equipment.plannedDurationSeconds > 0
      ? plannedTotal * activeSeconds / equipment.plannedDurationSeconds : 0;
    const intervals = irrigationActiveIntervals(event, now);
    const confirmedEnd = equipment.actualEndAt ? new Date(equipment.actualEndAt) : null;
    const distribute = (volume: number, kind: 'realizedCubicMeters' | 'estimatedOngoingCubicMeters') => {
      const relevant = intervals.map((interval) => ({
        startAt: kind === 'estimatedOngoingCubicMeters' && confirmedEnd && interval.startAt < confirmedEnd ? confirmedEnd : interval.startAt,
        endAt: kind === 'realizedCubicMeters' && confirmedEnd && interval.endAt > confirmedEnd ? confirmedEnd : interval.endAt,
      })).filter((interval) => interval.endAt > interval.startAt);
      const totalMs = relevant.reduce((total, interval) => total + interval.endAt.getTime() - interval.startAt.getTime(), 0);
      if (totalMs <= 0 || volume <= 0) return;
      for (const interval of relevant) {
        for (const [date, allocatedVolume] of splitVolumeAcrossLocalDays({
          ...interval,
          cubicMeters: volume * (interval.endAt.getTime() - interval.startAt.getTime()) / totalMs,
          timeZone,
        })) add(date, kind, allocatedVolume);
      }
    };
    distribute(actualTotal, 'realizedCubicMeters');
    distribute(Math.max(0, liveActual - actualTotal), 'estimatedOngoingCubicMeters');
    if (irrigationVolumeIncomplete(equipment.applications, 'actual') || irrigationVolumeIncomplete(equipment.applications, 'planned')) {
      // Le volume manquant ne se répartit pas : on marque les jours que
      // l'irrigation a touchés, pour que le total se lise comme incomplet.
      for (const interval of intervals) {
        for (const [date] of splitVolumeAcrossLocalDays({ ...interval, cubicMeters: 1, timeZone })) {
          add(date, 'realizedCubicMeters', 0);
          rows.get(date)!.volumeIncomplete = true;
        }
      }
    }
    if (equipment.timerState && equipment.timerStartedAt) {
      const remaining = Math.max(0, plannedTotal - Math.max(actualTotal, liveActual));
      const targetEnd = equipment.timerTheoreticalEndAt
        ? new Date(equipment.timerTheoreticalEndAt)
        : new Date(now.getTime() + millisecondsFromSeconds(Math.max(0, equipment.plannedDurationSeconds - activeSeconds)));
      if (equipment.id !== excludePlannedEquipmentId && remaining > 0 && targetEnd > now) {
        for (const [date, volume] of splitVolumeAcrossLocalDays({
          startAt: now,
          endAt: targetEnd,
          cubicMeters: remaining,
          timeZone,
        })) add(date, 'plannedCubicMeters', volume);
      }
      continue;
    }

    const remaining = equipment.remainingCanceledAt
      ? 0
      : Math.max(0, plannedTotal - actualTotal);
    if (
      remaining > 0 &&
      equipment.id !== excludePlannedEquipmentId &&
      equipment.plannedStartAt &&
      equipment.plannedEndAt &&
      equipment.status !== 'completed'
    ) {
      for (const [date, volume] of splitVolumeAcrossLocalDays({
        startAt: equipment.plannedStartAt,
        endAt: equipment.plannedEndAt,
        cubicMeters: remaining,
        timeZone,
      })) add(date, 'plannedCubicMeters', volume);
    }
  }

  return [...rows.values()].sort((left, right) => left.date.localeCompare(right.date));
}

/** Reuse the immutable 2.7 journal: no water is allocated to a pause or a gap between runs. */
export function irrigationActiveIntervals(event: IrrigationEventRecord, now = new Date()) {
  const intervals: Array<{ startAt: Date; endAt: Date }> = [];
  let open: Date | null = null;
  for (const entry of event.timerHistory ?? []) {
    if (entry.payload.eventEquipmentId !== event.equipment.id) continue;
    const timerAction = entry.payload.timerAction;
    if ((entry.action === 'created' && entry.payload.kind === 'running')
        || timerAction === 'started' || timerAction === 'resumed') {
      open = new Date(entry.at);
    } else if (timerAction === 'paused' || entry.action === 'completed' || entry.action === 'partially_completed') {
      const end = new Date(typeof entry.payload.actualEndAt === 'string' ? entry.payload.actualEndAt : entry.at);
      if (open && end > open) intervals.push({ startAt: open, endAt: end });
      open = null;
    }
  }
  if (open && event.equipment.timerState === 'running' && now > open) {
    intervals.push({ startAt: open, endAt: now });
  }
  if (intervals.length > 0) return intervals;
  const equipment = event.equipment;
  const startAt = equipment.actualStartAt ?? equipment.timerStartedAt;
  const endAt = equipment.timerState === 'paused'
    ? equipment.timerPausedAt
    : equipment.timerState === 'running' ? now.toISOString() : equipment.actualEndAt;
  return startAt && endAt && new Date(endAt) > new Date(startAt)
    ? [{ startAt: new Date(startAt), endAt: new Date(endAt) }] : [];
}

export function remainingIrrigationForStart(event: IrrigationEventRecord, now = new Date()) {
  const equipment = event.equipment;
  const activeSeconds = equipment.timerState
    ? activeTimerSeconds({
        state: equipment.timerState,
        resumedAt: equipment.timerResumedAt,
        pausedAt: equipment.timerPausedAt,
        accumulatedSeconds: equipment.timerAccumulatedSeconds,
        targetDurationSeconds: equipment.plannedDurationSeconds,
      }, now)
    : equipment.actualDurationSeconds;
  const planned = irrigationVolumeCubicMeters(equipment.applications, 'planned');
  const actual = Math.max(
    irrigationVolumeCubicMeters(equipment.applications, 'actual'),
    equipment.plannedDurationSeconds > 0 ? planned * activeSeconds / equipment.plannedDurationSeconds : 0,
  );
  return {
    cubicMeters: Math.max(0, planned - actual),
    seconds: Math.max(0, equipment.plannedDurationSeconds - activeSeconds),
  };
}

export function evaluateDailyWaterLimit({
  ledger,
  candidateByDate,
  limits,
}: {
  ledger: readonly DailyWaterLedger[];
  candidateByDate: ReadonlyMap<string, number>;
  limits: readonly DailyWaterLimit[];
}): DailyLimitEvaluation[] {
  const ledgerByDate = new Map(ledger.map((row) => [row.date, row]));
  const violations: DailyLimitEvaluation[] = [];
  for (const [date, candidateCubicMeters] of candidateByDate) {
    const limit = latestApplicableLimit(limits, date);
    if (!limit?.enabled || limit.maxCubicMetersPerDay === null) continue;
    const row = ledgerByDate.get(date);
    const alreadyCommittedCubicMeters =
      (row?.realizedCubicMeters ?? 0) + (row?.plannedCubicMeters ?? 0) + (row?.estimatedOngoingCubicMeters ?? 0);
    const exceededByCubicMeters =
      alreadyCommittedCubicMeters + candidateCubicMeters - limit.maxCubicMetersPerDay;
    if (exceededByCubicMeters > 1e-9) {
      violations.push({
        date,
        limitCubicMeters: limit.maxCubicMetersPerDay,
        alreadyCommittedCubicMeters,
        alreadyRealizedCubicMeters: row?.realizedCubicMeters ?? 0,
        alreadyPlannedCubicMeters: row?.plannedCubicMeters ?? 0,
        alreadyEstimatedCubicMeters: row?.estimatedOngoingCubicMeters ?? 0,
        candidateCubicMeters,
        exceededByCubicMeters,
      });
    }
  }
  return violations;
}

export function latestApplicableLimit(
  limits: readonly DailyWaterLimit[],
  date: string,
): DailyWaterLimit | null {
  return limits
    .filter((limit) => limit.validFrom <= date && (limit.validUntil === null || limit.validUntil >= date))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
}

/**
 * Premier jour civil, dans le fuseau de la ferme, qu'une période couvre et
 * auquel une limite journalière active s'applique ; `null` s'il n'y en a pas.
 * C'est la règle de refus d'une irrigation au volume invérifiable — une
 * planche sans surface mouillée connue — à la création comme au démarrage et
 * à la reprise (docs/wetted-surface-contract.md, points ouverts 12 et 24).
 */
export function firstLimitedDay(
  limits: readonly DailyWaterLimit[],
  startAt: string | Date,
  endAt: string | Date,
  timeZone = FARM_TIME_ZONE,
): string | null {
  // Seul le découpage de la période en jours compte ici : le volume n'est
  // qu'un marqueur de présence, pas une quantité.
  const DAY_MARKER_CUBIC_METERS = 1;
  const days = splitVolumeAcrossLocalDays({ startAt, endAt, cubicMeters: DAY_MARKER_CUBIC_METERS, timeZone }).keys();
  for (const date of days) {
    if (latestApplicableLimit(limits, date)?.enabled) return date;
  }
  return null;
}

export function isValidDateKey(value: string): boolean {
  const timestamp = Date.parse(`${value}T12:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(timestamp)
    && new Date(timestamp).toISOString().slice(0, 10) === value;
}

function assertDateKey(value: string) {
  if (!isValidDateKey(value)) {
    throw new Error('Date civile invalide.');
  }
}

/**
 * Les formateurs de fuseau horaire, un par fuseau et par usage, construits
 * une fois : un formateur neuf coûte près de vingt fois sa réutilisation, et
 * le calcul du planning en construisait un à chaque rupture de la projection
 * d'une réserve (point ouvert 28, profil du 5 octobre 2026).
 */
const dateKeyFormatters = new Map<string, Intl.DateTimeFormat>();
const zonedPartsFormatters = new Map<string, Intl.DateTimeFormat>();

function dateKeyFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = dateKeyFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    dateKeyFormatters.set(timeZone, formatter);
  }
  return formatter;
}

function zonedPartsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = zonedPartsFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    zonedPartsFormatters.set(timeZone, formatter);
  }
  return formatter;
}

function zonedDateTimeParts(date: Date, timeZone: string) {
  const result: Record<string, number> = {};
  for (const part of zonedPartsFormatter(timeZone).formatToParts(date)) {
    if (part.type !== 'literal') result[part.type] = Number(part.value);
  }
  return result as {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  };
}

/** Une journée du tableau de bord de l'eau : volumes, pluies, ET0 et limite. */
export type WaterDashboardDay = {
  date: string;
  /** Une irrigation du jour a une planche sans surface mouillée connue : les volumes sont incomplets. */
  volumeIncomplete: boolean;
  realizedIrrigationCubicMeters: number;
  plannedIrrigationCubicMeters: number;
  estimatedOngoingCubicMeters: number;
  reanalysisRainMm: number | null;
  manualRainMm: number | null;
  effectiveActualRainMm: number | null;
  forecastRainMm: number | null;
  /** Les températures prévues du jour, en °C (5 bis) ; absentes, elles restent nulles (D-003). */
  forecastMinimumTemperatureCelsius: number | null;
  forecastMaximumTemperatureCelsius: number | null;
  et0Mm: number | null;
  et0Kind: 'forecast' | 'reanalysis' | null;
  limitCubicMeters: number | null;
  limitExceededByCubicMeters: number;
  actualLimitExceededByCubicMeters: number;
};

/**
 * La bulle de la pluie réelle d'un jour (3.8, section 6) : la mesure au
 * pluviomètre l'emporte sur la réanalyse ; le texte dit laquelle a été
 * retenue, avec les valeurs déjà lues. Rien quand le jour n'en a aucune.
 */
export function actualRainOrigin(day: Pick<WaterDashboardDay, 'manualRainMm' | 'reanalysisRainMm' | 'effectiveActualRainMm'>): string | null {
  if (day.effectiveActualRainMm === null) return null;
  if (day.manualRainMm !== null) {
    const replaced = day.reanalysisRainMm === null ? '' : ` ; elle remplace la réanalyse météo, ${mmText(day.reanalysisRainMm)}`;
    return `Pluie mesurée au pluviomètre : ${mmText(day.effectiveActualRainMm)}${replaced}.`;
  }
  return `Réanalyse météo du jour : ${mmText(day.effectiveActualRainMm)}, faute de mesure au pluviomètre.`;
}
