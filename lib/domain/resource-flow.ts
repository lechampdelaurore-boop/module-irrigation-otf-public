import { hoursFromSeconds, secondsFromMilliseconds } from './units.ts';
import { FARM_TIME_ZONE, dateKeyInTimeZone } from './water-management.ts';
import { waterText } from './figure-origin.ts';

/**
 * Mesure du débit d'une ressource à partir des relevés de son compteur
 * (`docs/resource-flow-contract.md`).
 *
 * Deux relevés consécutifs donnent une mesure. La durée d'arrêt, saisie par le
 * maraîcher, sépare le temps où la pompe a tourné du temps où elle était à
 * l'arrêt : sans elle, un forage relevé à vingt-quatre heures d'intervalle
 * paraîtrait aussi faible que s'il avait coulé toute la nuit.
 */

/** Au-delà de cet écart relatif, le changement de référence est mis en évidence. */
export const NOTABLE_FLOW_CHANGE_RATIO = 0.2;

export type ResourceMeterReading = {
  id: string;
  takenAt: string;
  meterIndexCubicMeters: number;
  /** Nulle sur le premier relevé d'une chaîne, où elle n'a pas de sens. */
  stoppedSeconds: number | null;
  meterReplaced: boolean;
};

export type ResourceFlowMeasurement = {
  fromReadingId: string;
  toReadingId: string;
  fromTakenAt: string;
  toTakenAt: string;
  producedCubicMeters: number;
  elapsedSeconds: number;
  stoppedSeconds: number;
  runningSeconds: number;
  averageFlowCubicMetersPerHour: number;
  /**
   * Nul quand la pompe n'a pas tourné du tout : il n'y a alors pas de débit à
   * annoncer, et zéro serait un chiffre inventé.
   */
  runningFlowCubicMetersPerHour: number | null;
};

export type MeterReadingDraft = {
  takenAt: string;
  meterIndexCubicMeters: number;
  stoppedSeconds: number;
  meterReplaced: boolean;
};

export type MeterReadingRejection =
  | 'invalid_date'
  | 'future_date'
  | 'invalid_index'
  | 'negative_index'
  | 'invalid_stopped'
  | 'negative_stopped'
  | 'duplicate_instant'
  | 'index_went_backwards'
  | 'stopped_exceeds_elapsed'
  | 'production_without_running_time';

/**
 * Vérifie un relevé contre ses voisins immédiats dans la chaîne.
 *
 * Les deux côtés sont contrôlés, et non le seul précédent : un relevé oublié
 * puis rattrapé s'intercale entre deux relevés existants, et raccourcit
 * l'intervalle du suivant. Une durée d'arrêt qui était possible sur l'ancien
 * intervalle peut ne plus l'être sur le nouveau.
 */
export function validateMeterReading(
  draft: MeterReadingDraft,
  neighbours: { previous?: ResourceMeterReading | null; next?: ResourceMeterReading | null },
  now: Date,
): MeterReadingRejection | null {
  const takenAt = Date.parse(draft.takenAt);
  if (!Number.isFinite(takenAt)) return 'invalid_date';
  if (takenAt > now.getTime()) return 'future_date';
  if (!Number.isFinite(draft.meterIndexCubicMeters)) return 'invalid_index';
  if (draft.meterIndexCubicMeters < 0) return 'negative_index';
  if (!Number.isFinite(draft.stoppedSeconds)) return 'invalid_stopped';
  if (draft.stoppedSeconds < 0) return 'negative_stopped';

  const asReading: ResourceMeterReading = { id: '', ...draft, stoppedSeconds: draft.stoppedSeconds };
  const previous = neighbours.previous ?? null;
  const next = neighbours.next ?? null;

  const before = previous ? validatePair(previous, asReading) : null;
  if (before) return before;

  return next ? validatePair(asReading, next) : null;
}

function validatePair(
  previous: ResourceMeterReading,
  current: ResourceMeterReading,
): MeterReadingRejection | null {
  const elapsedSeconds = secondsBetween(previous.takenAt, current.takenAt);
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return 'duplicate_instant';

  // Un compteur remplacé repart d'un index quelconque : la chaîne est coupée,
  // il n'y a donc rien à comparer ni à calculer entre ces deux relevés.
  if (current.meterReplaced) return null;

  const producedCubicMeters = current.meterIndexCubicMeters - previous.meterIndexCubicMeters;
  if (producedCubicMeters < 0) return 'index_went_backwards';

  const stoppedSeconds = current.stoppedSeconds ?? 0;
  if (stoppedSeconds > elapsedSeconds) return 'stopped_exceeds_elapsed';
  if (stoppedSeconds === elapsedSeconds && producedCubicMeters > 0) return 'production_without_running_time';

  return null;
}

/**
 * La mesure portée par deux relevés consécutifs, ou `null` quand la chaîne est
 * coupée par un changement de compteur.
 */
export function measureResourceFlow(
  previous: ResourceMeterReading,
  current: ResourceMeterReading,
): ResourceFlowMeasurement | null {
  if (current.meterReplaced) return null;

  const elapsedSeconds = secondsBetween(previous.takenAt, current.takenAt);
  const stoppedSeconds = current.stoppedSeconds ?? 0;
  const runningSeconds = elapsedSeconds - stoppedSeconds;
  const producedCubicMeters = current.meterIndexCubicMeters - previous.meterIndexCubicMeters;

  return {
    fromReadingId: previous.id,
    toReadingId: current.id,
    fromTakenAt: previous.takenAt,
    toTakenAt: current.takenAt,
    producedCubicMeters,
    elapsedSeconds,
    stoppedSeconds,
    runningSeconds,
    averageFlowCubicMetersPerHour: producedCubicMeters / hoursFromSeconds(elapsedSeconds),
    runningFlowCubicMetersPerHour: runningSeconds > 0
      ? producedCubicMeters / hoursFromSeconds(runningSeconds)
      : null,
  };
}

/**
 * Toutes les mesures d'une ressource, dans l'ordre. Les relevés sont triés par
 * date : l'ordre d'enregistrement ne dit rien de l'ordre des lectures, un
 * relevé pouvant être rattrapé après coup.
 */
export function resourceFlowSeries(
  readings: readonly ResourceMeterReading[],
): ResourceFlowMeasurement[] {
  const ordered = [...readings].sort((left, right) => left.takenAt.localeCompare(right.takenAt));
  const measurements: ResourceFlowMeasurement[] = [];
  for (let index = 1; index < ordered.length; index += 1) {
    const measurement = measureResourceFlow(ordered[index - 1], ordered[index]);
    if (measurement) measurements.push(measurement);
  }
  return measurements;
}

export type FlowReferenceChange = {
  fromCubicMetersPerHour: number;
  toCubicMetersPerHour: number;
  /** Écart relatif signé : négatif quand le forage a faibli. */
  ratio: number;
  notable: boolean;
};

/**
 * Ce que la mise à jour du débit de la ressource changerait. `null` quand la
 * mesure n'a pas de débit en fonctionnement, donc rien à appliquer.
 */
export function flowReferenceChange(
  measurement: ResourceFlowMeasurement,
  currentReferenceCubicMetersPerHour: number,
): FlowReferenceChange | null {
  const measured = measurement.runningFlowCubicMetersPerHour;
  if (measured === null) return null;

  // Une référence nulle ou absurde n'a pas d'écart relatif calculable ; le
  // changement reste possible et se présente alors comme notable.
  const comparable = Number.isFinite(currentReferenceCubicMetersPerHour)
    && currentReferenceCubicMetersPerHour > 0;
  const ratio = comparable
    ? (measured - currentReferenceCubicMetersPerHour) / currentReferenceCubicMetersPerHour
    : Number.POSITIVE_INFINITY;

  return {
    fromCubicMetersPerHour: currentReferenceCubicMetersPerHour,
    toCubicMetersPerHour: measured,
    ratio,
    notable: !comparable || Math.abs(ratio) >= NOTABLE_FLOW_CHANGE_RATIO,
  };
}

function secondsBetween(from: string, to: string): number {
  return secondsFromMilliseconds(Date.parse(to) - Date.parse(from));
}

export type ResourceConsumptionPeriod = {
  /** Mois civil à l'heure de la ferme, au format `2026-09`. */
  month: string;
  producedCubicMeters: number;
  measurementCount: number;
  days: number;
};

/**
 * Le volume réellement sorti de la ressource, mois par mois.
 *
 * Une mesure porte son volume au mois de son relevé d'arrivée, sans être
 * répartie au prorata quand elle chevauche deux mois. Répartir supposerait un
 * débit constant sur l'intervalle, ce qui est faux : la pompe tourne par
 * à-coups. Mieux vaut un rattachement net et explicable qu'une répartition qui
 * invente. Relever une fois par mois suffit à rendre le rattachement exact.
 */
export function resourceConsumptionByMonth(
  measurements: readonly ResourceFlowMeasurement[],
  timeZone = FARM_TIME_ZONE,
): ResourceConsumptionPeriod[] {
  const byMonth = new Map<string, ResourceConsumptionPeriod>();
  for (const measurement of measurements) {
    const month = dateKeyInTimeZone(measurement.toTakenAt, timeZone).slice(0, 7);
    const existing = byMonth.get(month)
      ?? { month, producedCubicMeters: 0, measurementCount: 0, days: daysInMonth(month) };
    existing.producedCubicMeters += measurement.producedCubicMeters;
    existing.measurementCount += 1;
    byMonth.set(month, existing);
  }
  return [...byMonth.values()].sort((left, right) => left.month.localeCompare(right.month));
}

/**
 * Le volume que la limite de prélèvement autorise sur une période, et la part
 * qu'en occupe le volume réellement sorti.
 *
 * C'est une **enveloppe**, pas une preuve de conformité : une limite
 * journalière peut être dépassée un jour sans que le total du mois le montre.
 * Seuls des relevés quotidiens le diraient.
 */
export function authorisedEnvelope(
  period: ResourceConsumptionPeriod,
  maxCubicMetersPerDay: number | null,
): { allowedCubicMeters: number; usedRatio: number } | null {
  if (maxCubicMetersPerDay === null || !Number.isFinite(maxCubicMetersPerDay) || maxCubicMetersPerDay <= 0) {
    return null;
  }
  const allowedCubicMeters = maxCubicMetersPerDay * period.days;
  return { allowedCubicMeters, usedRatio: period.producedCubicMeters / allowedCubicMeters };
}

function daysInMonth(month: string): number {
  const [year, index] = month.split('-').map(Number);
  return new Date(Date.UTC(year, index, 0)).getUTCDate();
}

const oneDecimal = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const hoursText = (seconds: number) => `${oneDecimal.format(hoursFromSeconds(seconds))} h`;

/**
 * La bulle « d'où vient ce chiffre » du débit mesuré entre deux relevés
 * (3.8, docs/feature-selection-contract.md, section 6) : le volume produit,
 * le temps entre les relevés et les arrêts déclarés que la mesure a gardés.
 */
export function flowMeasurementOrigin(measurement: Pick<ResourceFlowMeasurement, 'producedCubicMeters' | 'elapsedSeconds' | 'stoppedSeconds' | 'runningSeconds' | 'runningFlowCubicMetersPerHour'>): string | null {
  if (measurement.runningFlowCubicMetersPerHour === null) return null;
  const running = measurement.stoppedSeconds > 0
    ? `Le temps de marche est le temps entre les deux relevés, ${hoursText(measurement.elapsedSeconds)}, moins les arrêts déclarés, ${hoursText(measurement.stoppedSeconds)}.`
    : 'Le temps de marche est le temps entre les deux relevés : aucun arrêt déclaré.';
  return `Volume produit ${oneDecimal.format(measurement.producedCubicMeters)} m³ ÷ temps de marche ${hoursText(measurement.runningSeconds)} = ${waterText(measurement.runningFlowCubicMetersPerHour, 'm³/h')}. ${running}`;
}
