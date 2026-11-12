import type { IrrigationEventRecord } from '../irrigation-event-record.ts';
import { pumpUsagesFromEvents, type IrrigationPump, type PumpOrigin } from '../pumps.ts';
import { MILLISECONDS_PER_HOUR, millisecondsFromSeconds, secondsFromMilliseconds } from '../units.ts';
import {
  addDaysToDateKey,
  buildDailyWaterLedger,
  dateKeyInTimeZone,
  latestApplicableLimit,
  localDateStartUtc,
  splitVolumeAcrossLocalDays,
  type DailyWaterLimit,
} from '../water-management.ts';
import {
  actualWithdrawalsByResourceAndDate,
  estimatedEvaporationCubicMeters,
  isResourceAvailableOn,
  rainInputCubicMeters,
  resourcePotentialForSegment,
  type WaterInfrastructure,
  type WaterReservoir,
  type WaterResource,
} from '../water-resources.ts';
import type { PlanningInputs } from './contract.ts';

/**
 * L'eau et les pompes dans le temps (docs/planning-contract.md, « Où placer
 * les créneaux », points 4 à 6). Les règles de volume sont celles des
 * sous-tranches 3.1, 3.2 et 2.8, réutilisées ; ce module n'ajoute que le fil
 * du temps : un niveau de réserve heure par heure, une pompe qui se partage,
 * un budget journalier qui se consomme.
 */

const EPSILON = 1e-9;

export type Withdrawal = { startMs: number; endMs: number; cubicMeters: number };

/** Niveau d'une réserve au fil de la semaine, apports compris, prélèvements planifiés compris. */
export class ReservoirTimeline {
  readonly reservoir: WaterReservoir;
  private readonly startMs: number;
  private readonly endMs: number;
  private readonly timeZone: string;
  private readonly inflowRateByDate: Map<string, number>;
  private readonly lumpByDate: Map<string, number>;
  private readonly withdrawals: Withdrawal[] = [];

  constructor(input: {
    reservoir: WaterReservoir;
    infrastructure: WaterInfrastructure;
    days: PlanningInputs['days'];
    now: Date;
    horizonEnd: Date;
    timeZone: string;
  }) {
    this.reservoir = input.reservoir;
    this.startMs = input.now.getTime();
    this.endMs = input.horizonEnd.getTime();
    this.timeZone = input.timeZone;
    const withdrawn = actualWithdrawalsByResourceAndDate(input.infrastructure.movements, input.timeZone);
    const feeders = input.infrastructure.resourceReservoirLinks
      .filter((link) => link.reservoirId === input.reservoir.id && link.active && link.fillMode === 'automatic')
      .map((link) => input.infrastructure.resources.find((resource) => resource.id === link.resourceId))
      .filter((resource): resource is WaterResource => resource !== undefined);
    this.inflowRateByDate = new Map();
    this.lumpByDate = new Map();
    const weatherByDate = new Map(input.days.map((day) => [day.date, day]));
    for (const date of datesBetween(input.now, input.horizonEnd, input.timeZone)) {
      const dayStart = Math.max(this.startMs, localDateStartUtc(date, input.timeZone).getTime());
      const dayEnd = Math.min(this.endMs, localDateStartUtc(addDaysToDateKey(date, 1), input.timeZone).getTime());
      const hours = (dayEnd - dayStart) / MILLISECONDS_PER_HOUR;
      if (hours <= 0) continue;
      const localDayHours = (localDateStartUtc(addDaysToDateKey(date, 1), input.timeZone).getTime() - localDateStartUtc(date, input.timeZone).getTime()) / MILLISECONDS_PER_HOUR;
      let potential = 0;
      for (const resource of feeders) {
        potential += resourcePotentialForSegment({
          resource,
          limits: input.infrastructure.resourceLimits.filter((limit) => limit.resourceId === resource.id),
          segment: { date, hours, localDayHours },
          alreadyWithdrawnCubicMeters: withdrawn.get(`${resource.id}:${date}`) ?? 0,
        });
      }
      this.inflowRateByDate.set(date, potential / hours);
      const weather = weatherByDate.get(date);
      const share = hours / localDayHours;
      const rain = input.reservoir.receivesRain && weather?.forecastRainMm
        ? rainInputCubicMeters(Math.max(0, weather.forecastRainMm), input.reservoir.exposedSurfaceSquareMeters) * share
        : 0;
      const evaporation = input.reservoir.evaporationEnabled && weather?.et0Mm
        ? estimatedEvaporationCubicMeters(Math.max(0, weather.et0Mm), input.reservoir.exposedSurfaceSquareMeters, input.reservoir.evaporationCoefficient) * share
        : 0;
      this.lumpByDate.set(date, rain - evaporation);
    }
  }

  get known(): boolean {
    return this.reservoir.currentVolumeCubicMeters !== null;
  }

  addWithdrawal(withdrawal: Withdrawal): void {
    this.withdrawals.push(withdrawal);
  }

  /**
   * Le niveau à un instant tel qu'il s'affiche : la projection bornée par
   * zéro, une cuve n'étant jamais négative ; `null` quand le stock n'est pas
   * connu. La faisabilité ne se juge jamais dessus (point ouvert 19).
   */
  levelAt(atMs: number): number | null {
    const result = this.minimumLevel(atMs, atMs);
    return result === null ? null : Math.max(0, result.minimum);
  }

  /**
   * Le niveau le plus bas atteint entre deux instants, avec un prélèvement
   * candidat en plus : la projection qui juge (docs/planning-contract.md,
   * « La garde de la réserve »). Le niveau est linéaire entre deux ruptures
   * — début ou fin d'un prélèvement, minuit — et borné à chaque rupture par
   * la capacité, jamais par zéro, pour qu'un manque reste visible : le
   * minimum est donc atteint sur une rupture.
   */
  minimumLevel(fromMs: number, toMs: number, candidate?: Withdrawal): { minimum: number; at: number } | null {
    const initial = this.reservoir.currentVolumeCubicMeters;
    if (initial === null) return null;
    const all = candidate ? [...this.withdrawals, candidate] : this.withdrawals;
    const breakpoints = new Set<number>([this.startMs, toMs, fromMs]);
    for (const date of this.inflowRateByDate.keys()) {
      breakpoints.add(Math.max(this.startMs, localDateStartUtc(date, this.timeZone).getTime()));
    }
    for (const withdrawal of all) {
      breakpoints.add(withdrawal.startMs);
      breakpoints.add(withdrawal.endMs);
    }
    const times = [...breakpoints].filter((time) => time >= this.startMs && time <= Math.max(toMs, this.startMs)).sort((left, right) => left - right);
    let level = Math.min(this.reservoir.capacityCubicMeters, Math.max(0, initial));
    let minimum = Number.POSITIVE_INFINITY;
    let at = fromMs;
    for (let index = 0; index < times.length; index += 1) {
      const time = times[index];
      if (index > 0) {
        const previous = times[index - 1];
        const date = dateKeyInTimeZone(new Date(previous), this.timeZone);
        const dayStartMs = Math.max(this.startMs, localDateStartUtc(date, this.timeZone).getTime());
        if (previous === dayStartMs) level += this.lumpByDate.get(date) ?? 0;
        const hours = (time - previous) / MILLISECONDS_PER_HOUR;
        let net = (this.inflowRateByDate.get(date) ?? 0) * hours;
        for (const withdrawal of all) {
          const overlap = Math.max(0, Math.min(time, withdrawal.endMs) - Math.max(previous, withdrawal.startMs));
          if (overlap > 0 && withdrawal.endMs > withdrawal.startMs) {
            net -= withdrawal.cubicMeters * overlap / (withdrawal.endMs - withdrawal.startMs);
          }
        }
        level = Math.min(this.reservoir.capacityCubicMeters, level + net);
      }
      if (time >= fromMs && time <= toMs && level < minimum) {
        minimum = level;
        at = time;
      }
    }
    if (!Number.isFinite(minimum)) return { minimum: level, at: toMs };
    return { minimum, at };
  }

  /**
   * Un prélèvement respecte-t-il le minimum de sécurité, de son début à la
   * fin de l'horizon, prélèvements déjà placés compris ? Rend le manque et,
   * quand le point le plus bas tombe dans le créneau lui-même, l'instant où
   * il faudrait le commencer pour que l'apport du forage l'ait comblé —
   * `null` si l'apport ne le comblera pas, ou si le manque est celui d'un
   * prélèvement placé plus tard, qu'attendre ne comblerait pas.
   */
  evaluate(candidate: Withdrawal): { status: 'ok' | 'short' | 'unknown'; shortfallCubicMeters: number; retryAtMs: number | null } {
    const result = this.minimumLevel(candidate.startMs, this.endMs, candidate);
    if (result === null) return { status: 'unknown', shortfallCubicMeters: 0, retryAtMs: null };
    const shortfall = this.reservoir.minimumSafetyCubicMeters - result.minimum;
    if (shortfall <= EPSILON) return { status: 'ok', shortfallCubicMeters: 0, retryAtMs: null };
    if (result.at > candidate.endMs) return { status: 'short', shortfallCubicMeters: shortfall, retryAtMs: null };
    const date = dateKeyInTimeZone(new Date(candidate.startMs), this.timeZone);
    const rate = this.inflowRateByDate.get(date) ?? 0;
    const retryAtMs = rate > EPSILON ? candidate.startMs + Math.ceil(shortfall / rate * MILLISECONDS_PER_HOUR) : null;
    return { status: 'short', shortfallCubicMeters: shortfall, retryAtMs: retryAtMs !== null && retryAtMs < this.endMs ? retryAtMs : null };
  }

  /**
   * Ce que la réserve peut fournir d'ici la fin de l'horizon, apports compris :
   * le stock moins le minimum de sécurité — négatif quand le stock est sous son
   * minimum, les apports comblant d'abord le manque, comme la garde les compte
   * (décision 2 de la 3.9, D-052) —, plus les apports, moins le planifié. Seul
   * le total est borné par zéro.
   */
  budgetCubicMeters(): number | null {
    const initial = this.reservoir.currentVolumeCubicMeters;
    if (initial === null) return null;
    let total = Math.min(this.reservoir.capacityCubicMeters, Math.max(0, initial)) - this.reservoir.minimumSafetyCubicMeters;
    for (const [date, rate] of this.inflowRateByDate) {
      const dayStart = Math.max(this.startMs, localDateStartUtc(date, this.timeZone).getTime());
      const dayEnd = Math.min(this.endMs, localDateStartUtc(addDaysToDateKey(date, 1), this.timeZone).getTime());
      total += rate * (dayEnd - dayStart) / MILLISECONDS_PER_HOUR + (this.lumpByDate.get(date) ?? 0);
    }
    for (const withdrawal of this.withdrawals) total -= withdrawal.cubicMeters;
    return Math.max(0, total);
  }
}

/** Une ressource prélevée directement : son débit borne le simultané, sa limite borne le jour. */
export class DirectResourceTimeline {
  readonly resource: WaterResource;
  /**
   * La ressource donne de l'eau au moins un jour d'ici dimanche : active, et un jour de l'horizon dans sa période de
   * disponibilité. Sinon rien ne peut en venir, et sa chaîne est indisponible (point ouvert 53, D-088).
   */
  readonly availableDuringHorizon: boolean;
  private readonly potentialByDate: Map<string, number>;
  private readonly usedByDate = new Map<string, number>();
  private readonly flows: { startMs: number; endMs: number; flow: number }[] = [];
  private readonly timeZone: string;

  constructor(input: { resource: WaterResource; infrastructure: WaterInfrastructure; now: Date; horizonEnd: Date; timeZone: string }) {
    this.resource = input.resource;
    this.timeZone = input.timeZone;
    const withdrawn = actualWithdrawalsByResourceAndDate(input.infrastructure.movements, input.timeZone);
    this.potentialByDate = new Map();
    const dates = datesBetween(input.now, input.horizonEnd, input.timeZone);
    this.availableDuringHorizon = dates.some((date) => isResourceAvailableOn(input.resource, date));
    for (const date of dates) {
      const dayStart = Math.max(input.now.getTime(), localDateStartUtc(date, input.timeZone).getTime());
      const dayEnd = Math.min(input.horizonEnd.getTime(), localDateStartUtc(addDaysToDateKey(date, 1), input.timeZone).getTime());
      const hours = (dayEnd - dayStart) / MILLISECONDS_PER_HOUR;
      const localDayHours = (localDateStartUtc(addDaysToDateKey(date, 1), input.timeZone).getTime() - localDateStartUtc(date, input.timeZone).getTime()) / MILLISECONDS_PER_HOUR;
      this.potentialByDate.set(date, resourcePotentialForSegment({
        resource: input.resource,
        limits: input.infrastructure.resourceLimits.filter((limit) => limit.resourceId === input.resource.id),
        segment: { date, hours, localDayHours },
        alreadyWithdrawnCubicMeters: withdrawn.get(`${input.resource.id}:${date}`) ?? 0,
      }));
    }
  }

  budgetCubicMeters(): number {
    let total = 0;
    for (const [date, potential] of this.potentialByDate) total += Math.max(0, potential - (this.usedByDate.get(date) ?? 0));
    return total;
  }

  /** Volume disponible sur un jour, après ce qui est déjà pris. */
  remainingForDate(date: string): number {
    return Math.max(0, (this.potentialByDate.get(date) ?? 0) - (this.usedByDate.get(date) ?? 0));
  }

  /**
   * Ce qu'un prélèvement prend à chacun de ses jours civils, à la part de sa
   * durée tombée ce jour-là, comme la limite le compte : un créneau de 21 h à
   * 0 h 30 prend six septièmes de son volume à son premier jour, jamais la
   * moitié (point ouvert 54, D-085).
   */
  addWithdrawal(startMs: number, endMs: number, cubicMeters: number): void {
    for (const [date, volume] of splitVolumeAcrossLocalDays({ startAt: new Date(startMs), endAt: new Date(endMs), cubicMeters, timeZone: this.timeZone })) {
      this.usedByDate.set(date, (this.usedByDate.get(date) ?? 0) + volume);
    }
  }

  /** Le débit instantané ne dépasse pas le débit nominal. */
  flowCapacity(): number {
    return this.resource.nominalFlowCubicMetersPerHour;
  }
}

/** Les usages d'une pompe dans le temps, existants et placés. */
export class PumpTimeline {
  readonly pump: IrrigationPump;
  private readonly usages: { startMs: number; endMs: number; flow: number; label: string }[] = [];

  constructor(pump: IrrigationPump, events: readonly IrrigationEventRecord[]) {
    this.pump = pump;
    for (const usage of pumpUsagesFromEvents(events)) {
      if (usage.pumpId !== pump.id) continue;
      this.usages.push({ startMs: Date.parse(usage.startsAt), endMs: Date.parse(usage.endsAt), flow: usage.requestedFlowCubicMetersPerHour, label: usage.label });
    }
  }

  add(startMs: number, endMs: number, flow: number, label: string): void {
    this.usages.push({ startMs, endMs, flow, label });
  }

  /** Débit déjà engagé à un instant. */
  engagedAt(atMs: number): number {
    return this.usages.filter((usage) => usage.startMs <= atMs && usage.endMs > atMs).reduce((sum, usage) => sum + usage.flow, 0);
  }

  /**
   * Le plus long créneau qui tient à partir d'un instant avec un débit donné,
   * borné par `maxMs`, ou `null` si même le début ne tient pas ; dans ce cas,
   * `nextTryMs` est la prochaine rupture où réessayer.
   */
  fitFrom(startMs: number, flow: number, maxMs: number): { endMs: number } | { endMs: null; nextTryMs: number | null } {
    const capacity = this.pump.maximumFlowCubicMetersPerHour;
    if (this.engagedAt(startMs) + flow > capacity + EPSILON) {
      const nextEnd = this.usages
        .filter((usage) => usage.startMs <= startMs && usage.endMs > startMs)
        .map((usage) => usage.endMs)
        .sort((left, right) => left - right)[0];
      return { endMs: null, nextTryMs: nextEnd ?? null };
    }
    let endMs = maxMs;
    for (const usage of this.usages) {
      if (usage.startMs > startMs && usage.startMs < endMs && this.engagedAt(usage.startMs) + flow > capacity + EPSILON) {
        endMs = usage.startMs;
      }
    }
    return { endMs };
  }

  /** Le pic de débit engagé sur un intervalle, pour les tests d'invariants. */
  peakFlowBetween(startMs: number, endMs: number): number {
    const points = new Set<number>([startMs]);
    for (const usage of this.usages) {
      if (usage.startMs > startMs && usage.startMs < endMs) points.add(usage.startMs);
    }
    return Math.max(...[...points].map((point) => this.engagedAt(point)));
  }

  describeConflictAt(atMs: number): string {
    const active = this.usages.filter((usage) => usage.startMs <= atMs && usage.endMs > atMs).map((usage) => usage.label);
    return active.length > 0 ? active.join(', ') : 'aucun';
  }
}

/** Les volumes déjà engagés jour par jour face à la limite journalière (2.8). */
export class DailyLimitLedger {
  private readonly committed: Map<string, number>;
  private readonly limits: readonly DailyWaterLimit[];
  private readonly timeZone: string;

  constructor(input: { events: readonly IrrigationEventRecord[]; limits: readonly DailyWaterLimit[]; now: Date; timeZone: string }) {
    this.limits = input.limits;
    this.timeZone = input.timeZone;
    this.committed = new Map(buildDailyWaterLedger(input.events, input.now, input.timeZone)
      .map((row) => [row.date, row.realizedCubicMeters + row.plannedCubicMeters + (row.estimatedOngoingCubicMeters ?? 0)]));
  }

  limitFor(date: string): number | null {
    const limit = latestApplicableLimit(this.limits, date);
    return limit?.enabled && limit.maxCubicMetersPerDay !== null ? limit.maxCubicMetersPerDay : null;
  }

  remainingFor(date: string): number | null {
    const limit = this.limitFor(date);
    return limit === null ? null : Math.max(0, limit - (this.committed.get(date) ?? 0));
  }

  /**
   * Ce que la limite laisse encore sur une période, tous jours confondus, ou
   * `null` quand elle ne borne pas la période : aucune limite, ou un jour au
   * moins sans limite, qui prend ce que ses plages et la pompe permettent
   * (docs/planning-contract.md, « Pénurie », point ouvert 35).
   */
  remainingBetween(startMs: number, endMs: number): number | null {
    const dates = datesBetween(new Date(startMs), new Date(endMs), this.timeZone);
    if (dates.length === 0) return null;
    let total = 0;
    for (const date of dates) {
      const remaining = this.remainingFor(date);
      if (remaining === null) return null;
      total += remaining;
    }
    return total;
  }

  /**
   * Un créneau respecte-t-il la limite de chacun de ses jours ? Un volume
   * inconnu sous une limite active est refusé (docs/wetted-surface-contract.md).
   */
  evaluate(startMs: number, endMs: number, cubicMeters: number | null): { status: 'ok' | 'exceeded' | 'unknown-under-limit' | 'no-limit'; date: string | null; exceededByCubicMeters: number } {
    const dates = datesBetween(new Date(startMs), new Date(endMs), this.timeZone);
    const limitedDates = dates.filter((date) => this.limitFor(date) !== null);
    if (limitedDates.length === 0) return { status: 'no-limit', date: null, exceededByCubicMeters: 0 };
    if (cubicMeters === null) return { status: 'unknown-under-limit', date: limitedDates[0], exceededByCubicMeters: 0 };
    for (const [date, volume] of splitVolumeAcrossLocalDays({ startAt: new Date(startMs), endAt: new Date(endMs), cubicMeters, timeZone: this.timeZone })) {
      const remaining = this.remainingFor(date);
      if (remaining !== null && volume > remaining + EPSILON) {
        return { status: 'exceeded', date, exceededByCubicMeters: volume - remaining };
      }
    }
    return { status: 'ok', date: null, exceededByCubicMeters: 0 };
  }

  add(startMs: number, endMs: number, cubicMeters: number): void {
    for (const [date, volume] of splitVolumeAcrossLocalDays({ startAt: new Date(startMs), endAt: new Date(endMs), cubicMeters, timeZone: this.timeZone })) {
      this.committed.set(date, (this.committed.get(date) ?? 0) + volume);
    }
  }
}

/** Ce qu'une limite par jour laisse à un créneau : tout, une coupe, un départ au minuit suivant, ou rien dans cette plage. */
type DailyFit = { kind: 'fits' } | { kind: 'cut'; seconds: number } | { kind: 'midnight'; startMs: number } | { kind: 'blocked' };

/**
 * Un créneau face à une limite par jour — la limite journalière d'irrigation
 * ou la limite de prélèvement d'une ressource —, jour civil par jour civil
 * depuis son début (docs/planning-contract.md, « Où placer les créneaux »,
 * point 6 ; points ouverts 54 et 58, D-085). Le débit est constant : chaque
 * jour reçoit la part du volume que sa part de la durée porte. Le créneau
 * s'arrête à la seconde où le reste d'un de ses jours s'épuise, jamais en
 * retirant à sa fin ce qu'un jour plus tôt a de trop ; un jour sans limite
 * (`null`) ne borne rien. Sous la durée minimale, il part au minuit suivant
 * quand c'est son premier jour qui s'épuise et que la plage continue assez
 * pour la durée minimale ; sinon rien ne tient dans cette plage.
 */
export function fitWithinDailyRemaining(input: {
  startMs: number;
  durationSeconds: number;
  cubicMeters: number;
  minimumSeconds: number;
  endLimitMs: number;
  timeZone: string;
  remainingFor: (date: string) => number | null;
}): DailyFit {
  const { startMs, cubicMeters, timeZone } = input;
  const totalMs = millisecondsFromSeconds(input.durationSeconds);
  const endMs = startMs + totalMs;
  let date = dateKeyInTimeZone(new Date(startMs), timeZone);
  const firstMidnightMs = localDateStartUtc(addDaysToDateKey(date, 1), timeZone).getTime();
  let cutMs: number | null = null;
  for (let dayStartMs = startMs; dayStartMs < endMs && cutMs === null;) {
    const nextDate = addDaysToDateKey(date, 1);
    const dayEndMs = localDateStartUtc(nextDate, timeZone).getTime();
    const remaining = input.remainingFor(date);
    // La part du jour, comptée comme `splitVolumeAcrossLocalDays` la compte pour la limite et pour les invariants.
    if (remaining !== null && cubicMeters * (Math.min(endMs, dayEndMs) - dayStartMs) / totalMs > remaining + EPSILON) cutMs = dayStartMs + remaining * totalMs / cubicMeters;
    dayStartMs = dayEndMs;
    date = nextDate;
  }
  if (cutMs === null) return { kind: 'fits' };
  const seconds = Math.floor(secondsFromMilliseconds(cutMs - startMs));
  if (seconds >= input.minimumSeconds) return { kind: 'cut', seconds };
  if (cutMs < firstMidnightMs && firstMidnightMs + millisecondsFromSeconds(input.minimumSeconds) <= input.endLimitMs) return { kind: 'midnight', startMs: firstMidnightMs };
  return { kind: 'blocked' };
}

/** La chaîne d'eau d'un matériel : sa pompe et, derrière elle, sa réserve ou sa ressource. */
export type SupplyChain = {
  originKey: string | null;
  originName: string;
  pumpTimeline: PumpTimeline | null;
  reservoir: ReservoirTimeline | null;
  resource: DirectResourceTimeline | null;
  origin: PumpOrigin | null;
  /**
   * Rien ne peut venir de la chaîne d'ici dimanche : sa réserve ou sa ressource inactive ou introuvable, sa ressource hors
   * de sa période toute la semaine, ou la pompe habituelle du matériel archivée (points ouverts 52 et 53, D-088).
   */
  unavailable: boolean;
};

/** Les jours civils qu'un intervalle touche, à la ferme. */
export function datesBetween(start: Date, end: Date, timeZone: string): string[] {
  if (!(end.getTime() > start.getTime())) return [dateKeyInTimeZone(start, timeZone)];
  const result: string[] = [];
  let date = dateKeyInTimeZone(start, timeZone);
  const last = dateKeyInTimeZone(new Date(end.getTime() - 1), timeZone);
  while (date <= last) {
    result.push(date);
    date = addDaysToDateKey(date, 1);
  }
  return result;
}
