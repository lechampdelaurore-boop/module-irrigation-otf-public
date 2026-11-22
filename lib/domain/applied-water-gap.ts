import { compareNamesNaturally } from './bed-order.ts';
import type { EquipmentSettingRecord } from './equipment-record.ts';
import type { IrrigationEventRecord } from './irrigation-event-record.ts';
import type { SprinklerProfilePoint } from './irrigation-domain.ts';
import { roundToDecimals } from './irrigation-format.ts';
import { addDaysToDateKey, dateKeyInTimeZone, FARM_TIME_ZONE, weekStartDateKey } from './water-management.ts';

/**
 * L'écart entre l'eau prévue et l'eau apportée, planche par planche
 * (amélioration n° 5, docs/ameliorations-4-5-contract.md, section 4, F733 à
 * F735) : sur les trois dernières semaines complètes, le signal quand chacune
 * s'écarte de plus de 20 % dans le même sens, la cause que les données
 * soutiennent, et la proposition à adopter d'un geste. Rien ici n'écrit ni
 * ne change un calcul : le besoin, la répartition et le planning ne lisent
 * pas l'écart.
 */

/** Les semaines comparées : les trois dernières semaines complètes, avant la semaine en cours (F733, point 1). */
const JUDGED_WEEKS = 3;
const DAYS_PER_WEEK = 7;
/** Au moins trois irrigations faites de la planche sur la période, sinon le silence (F733, point 6). */
const MIN_DONE_IRRIGATIONS = 3;
/** Au moins trois irrigations prévues puis faites plus longues que prévu, avec le même réglage (F734, point 1). */
const MIN_LONGER_IRRIGATIONS = 3;
/**
 * « De plus de 20 % » : plus d'un cinquième. Les quantités se comparent en
 * centièmes de millimètre entiers, pour qu'un écart de 20 % tout juste ne
 * compte jamais, quelle que soit l'écriture du nombre à virgule.
 */
const FIFTHS = 5;
const HUNDREDTHS = 100;
/** La pluie : au moins 5 mm d'écart entre la mesure et la réanalyse (F734, point 3). */
const RAIN_MIN_DIFFERENCE_HUNDREDTHS = 500;
/** Le débit proposé au dixième de mm/h, l'objectif et sa proposition au dixième de mm (F734, points 1 et 2). */
const PROPOSAL_DECIMALS = 1;
const PERCENT = 100;

export type GapDirection = 'more' | 'less';

export type AppliedWaterGapPeriod = {
  /** Le lundi de la semaine en cours. */
  currentWeekStart: string;
  /** Les trois semaines comparées, de la plus ancienne à la plus récente. */
  weeks: { weekStart: string; weekEnd: string }[];
  start: string;
  end: string;
};

type GapWeek = {
  weekStart: string;
  weekEnd: string;
  plannedMm: number;
  appliedMm: number;
  /** (apportée − prévue) / prévue, en %. */
  gapPercent: number;
};

/** Une planche dont les trois semaines s'écartent du prévu dans le même sens (F733, point 5). */
export type BedGapSignal = {
  bedId: string;
  direction: GapDirection;
  weeks: GapWeek[];
  /** Les irrigations faites (en entier ou en partie) de la planche sur la période. */
  doneIrrigations: number;
};

export type SettingRates =
  | { kind: 'drip'; rateMmPerHour: number }
  | { kind: 'sprinkler'; leftProfile: SprinklerProfilePoint[]; rightProfile: SprinklerProfilePoint[] };

/** Un réglage tel qu'il est aujourd'hui, d'un matériel en service. */
export type CurrentSetting = {
  equipmentId: string;
  equipmentName: string;
  settingId: string;
  settingName: string;
  rates: SettingRates;
};

export type FlowCause = {
  kind: 'flow';
  equipmentId: string;
  equipmentName: string;
  settingId: string;
  settingName: string;
  /** Les irrigations prévues puis faites en entier, plus de 20 % plus longues que prévu, avec ce réglage. */
  irrigations: number;
  /** La médiane des rapports « durée prévue / durée réelle » de ces irrigations. */
  durationRatio: number;
  current: SettingRates;
  /** Le réglage proposé, au dixième de mm/h ; `null` quand l'arrondi ne laisse rien à proposer. */
  proposed: SettingRates | null;
};

export type ObjectiveCause = { kind: 'objective'; objectiveMm: number; proposedMm: number };

export type RainCause = {
  kind: 'rain';
  /** Les jours de la période qui ont à la fois une pluie mesurée et une réanalyse : leurs sommes. */
  measuredMm: number;
  reanalysisMm: number;
  measuredDays: number;
  /** Les jours de la période sans pluie mesurée, où le plan a compté la réanalyse. */
  daysWithoutMeasure: number;
};

export type GapCause = FlowCause | ObjectiveCause | RainCause;

export type BedWaterGap = BedGapSignal & {
  bedName: string;
  plotName: string;
  /** Les causes que les données soutiennent ; vide : « cause non déterminée » (F734). */
  causes: GapCause[];
};

/** Une journée de pluie de la période : la mesure au pluviomètre et la réanalyse, chacune inconnue si absente. */
export type RainDay = { date: string; measuredMm: number | null; reanalysisMm: number | null };

/** L'objectif de la planche pour la semaine en cours, l'objectif proposé de la 5 quater, et ce qui a déjà été adopté. */
export type BedObjectiveReading = {
  objectiveMm: number | null;
  proposedMm: number | null;
  adoptable: boolean;
  /** L'objectif de la planche la dernière semaine de la période. */
  lastWeekObjectiveMm: number | null;
  /** Les objectifs proposés adoptés pour la planche depuis le lundi de la semaine en cours. */
  adoptedThisWeekMm: number[];
};

/**
 * Une planche de la saison. `outdoors` : son jardin est classé hors abri, le
 * plan y compte la pluie ; sous abri, ou dans un jardin à classer dont on ne
 * sait pas s'il reçoit la pluie (4.4, F583), la pluie n'est pas une cause.
 */
export type GapBed = { id: string; name: string; plotName: string; outdoors: boolean };

/** Les trois dernières semaines complètes (lundi à dimanche, heure de Paris), avant celle de `today`. */
export function appliedWaterGapPeriod(today: string): AppliedWaterGapPeriod {
  const currentWeekStart = weekStartDateKey(today);
  const weeks = Array.from({ length: JUDGED_WEEKS }, (_, index) => {
    const weekStart = addDaysToDateKey(currentWeekStart, -DAYS_PER_WEEK * (JUDGED_WEEKS - index));
    return { weekStart, weekEnd: addDaysToDateKey(weekStart, DAYS_PER_WEEK - 1) };
  });
  return { currentWeekStart, weeks, start: weeks[0].weekStart, end: weeks[JUDGED_WEEKS - 1].weekEnd };
}

/** Ce qu'une irrigation de la période a fait sur une planche. */
type BedIrrigation = {
  status: 'pending' | 'done';
  /** Le jour, à la ferme, du début prévu, sinon du début réel d'une irrigation saisie après coup. */
  startDate: string;
  /** Prévue avant d'être faite : elle a un début prévu. */
  planned: boolean;
  completed: boolean;
  plannedHundredths: number;
  appliedHundredths: number;
  plannedSeconds: number;
  actualSeconds: number;
  settingId: string;
  setting: EquipmentSettingRecord;
};

/**
 * Les irrigations de chaque planche qui commencent dans la période, sauf les
 * annulées (F733, point 2) : une annulation est un choix de ne pas arroser,
 * qu'on ne compte ni au prévu ni à l'apporté. Une irrigation planifiée qui
 * attend encore, ou dont le minuteur tourne, n'a pas d'eau apportée connue.
 */
function irrigationsByBed(events: readonly IrrigationEventRecord[], period: AppliedWaterGapPeriod): Map<string, BedIrrigation[]> {
  const byBed = new Map<string, BedIrrigation[]>();
  for (const event of events) {
    const equipment = event.equipment;
    if (event.status === 'canceled' || equipment.status === 'canceled' || event.canceledAt || equipment.canceledAt) continue;
    const start = equipment.plannedStartAt ?? equipment.actualStartAt;
    if (!start) continue;
    const startDate = dateKeyInTimeZone(start, FARM_TIME_ZONE);
    if (startDate < period.start || startDate > period.end) continue;
    const done = (equipment.status === 'completed' || equipment.status === 'partially_completed') && !equipment.timerState;
    for (const application of equipment.applications) {
      const rows = byBed.get(application.otfBedId) ?? [];
      rows.push({
        status: done ? 'done' : 'pending',
        startDate,
        planned: equipment.plannedStartAt !== null,
        completed: equipment.status === 'completed' && !equipment.timerState,
        plannedHundredths: hundredths(application.plannedAmountMm),
        appliedHundredths: hundredths(application.actualAmountMm),
        plannedSeconds: equipment.plannedDurationSeconds,
        actualSeconds: equipment.actualDurationSeconds,
        settingId: equipment.settingId,
        setting: equipment.settingSnapshot,
      });
      byBed.set(application.otfBedId, rows);
    }
  }
  return byBed;
}

/**
 * Les planches qui ont un signal (F733) : chacune des trois semaines jugée —
 * une eau apportée connue, une eau prévue supérieure à 0 —, avec un écart de
 * plus de 20 % dans le même sens, et au moins trois irrigations faites sur la
 * période. Sinon, rien : ni ligne, ni « 0 ».
 */
export function appliedWaterGapSignals(input: {
  today: string;
  events: readonly IrrigationEventRecord[];
  bedIds: readonly string[];
  currentSettings: ReadonlyMap<string, CurrentSetting>;
}): BedGapSignal[] {
  const period = appliedWaterGapPeriod(input.today);
  const byBed = irrigationsByBed(input.events, period);
  return input.bedIds.flatMap((bedId) => {
    const signal = bedSignal(bedId, byBed.get(bedId) ?? [], period, input.currentSettings);
    return signal ? [signal] : [];
  });
}

/**
 * Une semaine jugée a aussi été prévue avec les réglages d'aujourd'hui (F741) :
 * une irrigation faite avec des débits qui ne sont plus ceux de son réglage —
 * changé depuis, à la main ou par « Adopter », ou d'un matériel qui n'est
 * plus en service — dit l'écart d'un réglage qui n'existe plus. La planche se
 * juge alors sur les semaines qui suivent.
 */
function bedSignal(
  bedId: string,
  irrigations: readonly BedIrrigation[],
  period: AppliedWaterGapPeriod,
  currentSettings: ReadonlyMap<string, CurrentSetting>,
): BedGapSignal | null {
  const doneIrrigations = irrigations.filter((irrigation) => irrigation.status === 'done').length;
  if (doneIrrigations < MIN_DONE_IRRIGATIONS) return null;
  const weeks: GapWeek[] = [];
  const directions = new Set<GapDirection>();
  for (const { weekStart, weekEnd } of period.weeks) {
    const inWeek = irrigations.filter((irrigation) => irrigation.startDate >= weekStart && irrigation.startDate <= weekEnd);
    if (inWeek.some((irrigation) => irrigation.status === 'pending' || !currentRates(irrigation, currentSettings))) return null;
    const planned = sum(inWeek.map((irrigation) => irrigation.plannedHundredths));
    const applied = sum(inWeek.map((irrigation) => irrigation.appliedHundredths));
    if (planned <= 0) return null;
    const direction = aboveByAFifth(applied, planned) ? 'more' : belowByAFifth(applied, planned) ? 'less' : null;
    if (direction === null) return null;
    directions.add(direction);
    weeks.push({
      weekStart, weekEnd,
      plannedMm: planned / HUNDREDTHS,
      appliedMm: applied / HUNDREDTHS,
      gapPercent: (applied - planned) / planned * PERCENT,
    });
  }
  if (directions.size !== 1) return null;
  return { bedId, direction: [...directions][0], weeks, doneIrrigations };
}

/**
 * L'écart du prévu et ses causes, planche par planche (F733 à F735) : une
 * cause n'est dite que si les données la soutiennent ; plusieurs se disent
 * toutes. Les planches dans l'ordre naturel de leur jardin, puis de leur nom.
 */
export function appliedWaterGaps(input: {
  today: string;
  events: readonly IrrigationEventRecord[];
  beds: readonly GapBed[];
  /** Les réglages d'aujourd'hui des matériels en service, par identifiant de réglage. */
  currentSettings: ReadonlyMap<string, CurrentSetting>;
  rain: readonly RainDay[];
  /** L'objectif et sa proposition de la semaine en cours, par planche ; `null` sans « Besoin par culture » : la cause ne se cherche pas. */
  objectives: ReadonlyMap<string, BedObjectiveReading> | null;
}): BedWaterGap[] {
  const period = appliedWaterGapPeriod(input.today);
  const byBed = irrigationsByBed(input.events, period);
  const gaps = input.beds.flatMap((bed): BedWaterGap[] => {
    const irrigations = byBed.get(bed.id) ?? [];
    const signal = bedSignal(bed.id, irrigations, period, input.currentSettings);
    if (!signal) return [];
    const reading = input.objectives?.get(bed.id);
    if (signal.direction === 'less' && reading && objectiveAlreadyLowered(reading)) return [];
    const causes: GapCause[] = signal.direction === 'more'
      ? flowCauses(irrigations, input.currentSettings)
      : optional(input.objectives ? objectiveCause(reading) : null);
    causes.push(...optional(bed.outdoors ? rainCause(signal.direction, period, input.rain) : null));
    return [{ ...signal, bedName: bed.name, plotName: bed.plotName, causes }];
  });
  return gaps.sort((left, right) => compareNamesNaturally(left.plotName, right.plotName) || compareNamesNaturally(left.bedName, right.bedName));
}

/**
 * « Débit réel du matériel plus faible que celui réglé » (F734, point 1) :
 * au moins trois irrigations de la planche, prévues puis faites en entier
 * avec le même réglage, chacune plus de 20 % plus longue que prévu. Le même
 * réglage : le même identifiant, et des débits copiés par chaque irrigation
 * égaux à ceux du réglage d'aujourd'hui — une irrigation faite avec d'autres
 * débits ne dit rien du réglage actuel. La proposition : le débit du réglage
 * multiplié par la médiane des rapports « durée prévue / durée réelle ».
 */
function flowCauses(irrigations: readonly BedIrrigation[], currentSettings: ReadonlyMap<string, CurrentSetting>): FlowCause[] {
  const bySetting = new Map<string, number[]>();
  for (const irrigation of irrigations) {
    if (!irrigation.planned || !irrigation.completed || irrigation.plannedSeconds <= 0) continue;
    if (!aboveByAFifth(irrigation.actualSeconds, irrigation.plannedSeconds)) continue;
    if (!currentRates(irrigation, currentSettings)) continue;
    bySetting.set(irrigation.settingId, [...(bySetting.get(irrigation.settingId) ?? []), irrigation.plannedSeconds / irrigation.actualSeconds]);
  }
  return [...bySetting.entries()]
    .filter(([, ratios]) => ratios.length >= MIN_LONGER_IRRIGATIONS)
    .map(([settingId, ratios]): FlowCause => {
      const current = currentSettings.get(settingId)!;
      const durationRatio = median(ratios);
      return {
        kind: 'flow',
        equipmentId: current.equipmentId, equipmentName: current.equipmentName,
        settingId, settingName: current.settingName,
        irrigations: ratios.length,
        durationRatio,
        current: current.rates,
        proposed: proposedRates(current.rates, durationRatio),
      };
    })
    .sort((left, right) => right.irrigations - left.irrigations || compareNamesNaturally(left.equipmentName, right.equipmentName));
}

/**
 * « Objectif plus haut que le besoin de la culture » (F734, point 2) :
 * l'objectif proposé de la semaine en cours est adoptable et plus bas de
 * plus de 20 % que l'objectif de la planche.
 */
function objectiveCause(reading: BedObjectiveReading | undefined): ObjectiveCause | null {
  if (!reading?.adoptable || reading.proposedMm === null || reading.objectiveMm === null) return null;
  const objective = hundredths(reading.objectiveMm);
  if (objective <= 0 || !belowByAFifth(hundredths(reading.proposedMm), objective)) return null;
  return { kind: 'objective', objectiveMm: roundToDecimals(reading.objectiveMm, PROPOSAL_DECIMALS), proposedMm: roundToDecimals(reading.proposedMm, PROPOSAL_DECIMALS) };
}

/**
 * L'ajustement que la cause de l'objectif demandait est déjà fait (F741) :
 * cette semaine, un objectif proposé a été adopté pour la planche, plus bas de
 * plus de 20 % que son objectif de la dernière semaine de la période. Ses
 * semaines passées ont été prévues avec l'ancien objectif : la planche se
 * jugera sur les semaines qui suivent.
 */
function objectiveAlreadyLowered(reading: BedObjectiveReading): boolean {
  if (reading.lastWeekObjectiveMm === null) return false;
  const before = hundredths(reading.lastWeekObjectiveMm);
  return before > 0 && reading.adoptedThisWeekMm.some((adopted) => belowByAFifth(hundredths(adopted), before));
}

/**
 * « Pluie mesurée différente de la réanalyse » (F734, point 3), pour une
 * planche hors abri : les jours de la période qui ont à la fois une mesure et
 * une réanalyse ont des sommes qui diffèrent de plus de 20 % de la réanalyse
 * et d'au moins 5 mm, dans le sens de l'écart — la mesure plus forte quand
 * moins d'eau a été apportée que prévu, plus faible quand plus d'eau l'a été
 * —, et au moins un jour de la période n'a pas de mesure, où le plan a compté
 * la réanalyse.
 */
function rainCause(direction: GapDirection, period: AppliedWaterGapPeriod, days: readonly RainDay[]): RainCause | null {
  const inPeriod = days.filter((day) => day.date >= period.start && day.date <= period.end);
  const both = inPeriod.filter((day) => day.measuredMm !== null && day.reanalysisMm !== null);
  const daysWithoutMeasure = inPeriod.filter((day) => day.measuredMm === null && day.reanalysisMm !== null).length;
  if (both.length === 0 || daysWithoutMeasure === 0) return null;
  const measured = sum(both.map((day) => hundredths(day.measuredMm!)));
  const reanalysis = sum(both.map((day) => hundredths(day.reanalysisMm!)));
  const difference = direction === 'less' ? measured - reanalysis : reanalysis - measured;
  if (difference < RAIN_MIN_DIFFERENCE_HUNDREDTHS || !(FIFTHS * difference > reanalysis)) return null;
  return { kind: 'rain', measuredMm: measured / HUNDREDTHS, reanalysisMm: reanalysis / HUNDREDTHS, measuredDays: both.length, daysWithoutMeasure };
}

/** Ce que l'écran propose d'adopter, tel qu'il l'a montré (F735, point 1). */
export type GapAdoption =
  | { kind: 'flow'; bedId: string; settingId: string; proposed: SettingRates }
  | { kind: 'objective'; bedId: string; proposedMm: number };

/**
 * La proposition que l'écran a montrée tient encore (F735, point 1) : l'écart
 * recalculé garde la planche, la cause et la même valeur proposée. Sinon
 * `null`, et rien ne s'écrit : une irrigation confirmée entre-temps, un
 * réglage retouché ou un objectif changé ont pu la défaire.
 */
export function heldProposal(gaps: readonly BedWaterGap[], adoption: GapAdoption): FlowCause | ObjectiveCause | null {
  const gap = gaps.find((item) => item.bedId === adoption.bedId);
  if (!gap) return null;
  if (adoption.kind === 'flow') {
    const cause = gap.causes.find((item): item is FlowCause => item.kind === 'flow' && item.settingId === adoption.settingId);
    return cause?.proposed && sameRates(cause.proposed, adoption.proposed) ? cause : null;
  }
  const cause = gap.causes.find((item): item is ObjectiveCause => item.kind === 'objective');
  return cause && hundredths(cause.proposedMm) === hundredths(adoption.proposedMm) ? cause : null;
}

/** Au plus 200 caractères pour un identifiant, au plus 50 points par côté : ce que l'écran peut envoyer. */
const MAX_ID_LENGTH = 200;
const MAX_PROFILE_POINTS = 50;

/** Ce que le navigateur envoie, relu sans rien croire : `null` dès qu'une valeur n'a pas la forme attendue. */
export function parseGapAdoption(input: unknown): GapAdoption | null {
  if (typeof input !== 'object' || input === null) return null;
  const value = input as Record<string, unknown>;
  if (!isId(value.bedId)) return null;
  if (value.kind === 'objective') {
    return isFiniteNumber(value.proposedMm) && value.proposedMm > 0 ? { kind: 'objective', bedId: value.bedId, proposedMm: value.proposedMm } : null;
  }
  if (value.kind !== 'flow' || !isId(value.settingId)) return null;
  const proposed = parseRates(value.proposed);
  return proposed ? { kind: 'flow', bedId: value.bedId, settingId: value.settingId, proposed } : null;
}

function parseRates(input: unknown): SettingRates | null {
  if (typeof input !== 'object' || input === null) return null;
  const value = input as Record<string, unknown>;
  if (value.kind === 'drip') return isFiniteNumber(value.rateMmPerHour) ? { kind: 'drip', rateMmPerHour: value.rateMmPerHour } : null;
  if (value.kind !== 'sprinkler') return null;
  const leftProfile = parseProfile(value.leftProfile);
  const rightProfile = parseProfile(value.rightProfile);
  return leftProfile && rightProfile ? { kind: 'sprinkler', leftProfile: sortedProfile(leftProfile), rightProfile: sortedProfile(rightProfile) } : null;
}

function parseProfile(input: unknown): SprinklerProfilePoint[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_PROFILE_POINTS) return null;
  const points = input.map((point: unknown) => {
    if (typeof point !== 'object' || point === null) return null;
    const { distanceMeters, rateMmPerHour } = point as Record<string, unknown>;
    return isFiniteNumber(distanceMeters) && isFiniteNumber(rateMmPerHour) ? { distanceMeters, rateMmPerHour } : null;
  });
  return points.every((point) => point !== null) ? points as SprinklerProfilePoint[] : null;
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** L'irrigation a été faite avec les débits d'aujourd'hui de son réglage, d'un matériel en service. */
function currentRates(irrigation: BedIrrigation, currentSettings: ReadonlyMap<string, CurrentSetting>): boolean {
  const current = currentSettings.get(irrigation.settingId);
  return current !== undefined && sameRates(ratesOf(irrigation.setting), current.rates);
}

/** Les débits d'un réglage, sans son nom ni sa place. */
export function ratesOf(setting: EquipmentSettingRecord): SettingRates {
  return setting.kind === 'drip'
    ? { kind: 'drip', rateMmPerHour: setting.rateMmPerHour }
    : { kind: 'sprinkler', leftProfile: sortedProfile(setting.leftProfile), rightProfile: sortedProfile(setting.rightProfile) };
}

function sameRates(left: SettingRates, right: SettingRates): boolean {
  if (left.kind === 'drip' || right.kind === 'drip') {
    return left.kind === 'drip' && right.kind === 'drip' && left.rateMmPerHour === right.rateMmPerHour;
  }
  return sameProfile(left.leftProfile, right.leftProfile) && sameProfile(left.rightProfile, right.rightProfile);
}

/**
 * Le réglage multiplié par le rapport, au dixième de mm/h : en goutte-à-goutte
 * le débit, en aspersion chaque point du profil. `null` quand l'arrondi ne
 * laisse rien d'utile : un débit nul, ou le réglage d'aujourd'hui.
 */
function proposedRates(current: SettingRates, ratio: number): SettingRates | null {
  const scale = (rate: number) => roundToDecimals(rate * ratio, PROPOSAL_DECIMALS);
  const proposed: SettingRates = current.kind === 'drip'
    ? { kind: 'drip', rateMmPerHour: scale(current.rateMmPerHour) }
    : {
        kind: 'sprinkler',
        leftProfile: current.leftProfile.map((point) => ({ distanceMeters: point.distanceMeters, rateMmPerHour: scale(point.rateMmPerHour) })),
        rightProfile: current.rightProfile.map((point) => ({ distanceMeters: point.distanceMeters, rateMmPerHour: scale(point.rateMmPerHour) })),
      };
  if (highestRate(proposed) <= 0 || sameRates(proposed, current)) return null;
  return proposed;
}

/** Le plus fort débit d'un réglage : le débit du goutte-à-goutte, le plus fort point du profil. */
function highestRate(rates: SettingRates): number {
  return rates.kind === 'drip'
    ? rates.rateMmPerHour
    : Math.max(0, ...rates.leftProfile.map((point) => point.rateMmPerHour), ...rates.rightProfile.map((point) => point.rateMmPerHour));
}

function sortedProfile(points: readonly SprinklerProfilePoint[]): SprinklerProfilePoint[] {
  return [...points]
    .map((point) => ({ distanceMeters: point.distanceMeters, rateMmPerHour: point.rateMmPerHour }))
    .sort((left, right) => left.distanceMeters - right.distanceMeters);
}

function sameProfile(left: readonly SprinklerProfilePoint[], right: readonly SprinklerProfilePoint[]): boolean {
  return left.length === right.length && left.every((point, index) => (
    point.distanceMeters === right[index].distanceMeters && point.rateMmPerHour === right[index].rateMmPerHour
  ));
}

/** `value` dépasse `reference` de plus d'un cinquième de `reference`. */
function aboveByAFifth(value: number, reference: number): boolean {
  return FIFTHS * (value - reference) > reference;
}

/** `value` est en dessous de `reference` de plus d'un cinquième de `reference`. */
function belowByAFifth(value: number, reference: number): boolean {
  return FIFTHS * (reference - value) > reference;
}

function hundredths(millimeters: number): number {
  return Math.round(millimeters * HUNDREDTHS);
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function optional<T>(value: T | null): T[] {
  return value === null ? [] : [value];
}
