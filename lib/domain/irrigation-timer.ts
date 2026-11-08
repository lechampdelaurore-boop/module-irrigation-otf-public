import { millisecondsFromMinutes, millisecondsFromSeconds, secondsForMillimeters, secondsFromMilliseconds } from './units.ts';
import { appliedMillimeters } from './irrigation-calculations.ts';
import type { IrrigationEventCreationKind } from './irrigation-event-record.ts';
import { mmText, rateText } from './figure-origin.ts';

export type IrrigationTimerState = 'running' | 'paused';

export type IrrigationTimerSnapshot = {
  state: IrrigationTimerState;
  resumedAt: string | null;
  pausedAt: string | null;
  accumulatedSeconds: number;
  targetDurationSeconds: number;
};

export function durationSecondsForTarget(
  targetMillimeters: number,
  rateMmPerHour: number,
): number {
  if (
    !Number.isFinite(targetMillimeters) ||
    targetMillimeters <= 0 ||
    !Number.isFinite(rateMmPerHour) ||
    rateMmPerHour <= 0
  ) {
    return 0;
  }

  return Math.max(1, Math.round(secondsForMillimeters(targetMillimeters, rateMmPerHour)));
}

export function millimetersForDurationSeconds(
  rateMmPerHour: number,
  durationSeconds: number,
): number {
  return appliedMillimeters(rateMmPerHour, durationSeconds / 60);
}

export function activeTimerSeconds(
  timer: IrrigationTimerSnapshot,
  now: Date = new Date(),
): number {
  const accumulated = nonNegativeInteger(timer.accumulatedSeconds);
  if (timer.state !== 'running' || !timer.resumedAt) return accumulated;

  const resumedAt = Date.parse(timer.resumedAt);
  const nowMs = now.getTime();
  if (!Number.isFinite(resumedAt) || !Number.isFinite(nowMs) || nowMs <= resumedAt) {
    return accumulated;
  }

  return accumulated + Math.floor(secondsFromMilliseconds(nowMs - resumedAt));
}

export function remainingTimerSeconds(
  timer: IrrigationTimerSnapshot,
  now: Date = new Date(),
): number {
  return Math.max(
    0,
    nonNegativeInteger(timer.targetDurationSeconds) - activeTimerSeconds(timer, now),
  );
}

export function isTimerAwaitingConfirmation(
  timer: IrrigationTimerSnapshot,
  now: Date = new Date(),
): boolean {
  return timer.state === 'running' && remainingTimerSeconds(timer, now) === 0;
}

export function timerTheoreticalEndAt(
  targetDurationSeconds: number,
  accumulatedSeconds: number,
  resumedAt: Date,
): string {
  const remainingSeconds = Math.max(
    0,
    nonNegativeInteger(targetDurationSeconds) - nonNegativeInteger(accumulatedSeconds),
  );
  return new Date(resumedAt.getTime() + millisecondsFromSeconds(remainingSeconds)).toISOString();
}

/**
 * Le créneau qu'éprouve l'aperçu de faisabilité, en instants lisibles. Un
 * champ de date vide ou incomplet, comme pendant la frappe au clavier, donne
 * un début illisible : le créneau part alors de maintenant au lieu de fermer
 * la page (point ouvert 44). Une fin illisible ou antérieure au début laisse un
 * créneau d'une seconde.
 */
export function previewSlot(
  start: number,
  end: number,
  now: number,
): { startsAt: string; endsAt: string } {
  const from = Number.isFinite(start) ? start : now;
  const to = Number.isFinite(end) && end > from ? end : from + millisecondsFromSeconds(1);
  return { startsAt: new Date(from).toISOString(), endsAt: new Date(to).toISOString() };
}

export function localDateTimeInputValue(
  date: Date,
  includeSeconds = false,
): string {
  if (!Number.isFinite(date.getTime())) return '';
  const offset = millisecondsFromMinutes(date.getTimezoneOffset());
  return new Date(date.getTime() - offset)
    .toISOString()
    .slice(0, includeSeconds ? 19 : 16);
}

function nonNegativeInteger(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

/**
 * La durée d'une irrigation déjà réalisée, lue sur son début et sa fin réels.
 * Inconnue, et non nulle, tant que l'un des deux champs est vide ou incomplet,
 * ou que la fin ne suit pas le début : l'aperçu dit alors le volume inconnu au
 * lieu de « 0 L » (D-003, point ouvert 45).
 */
export function completedDurationSeconds(start: number, end: number): number | null {
  return Number.isFinite(start) && Number.isFinite(end) && end > start
    ? Math.floor(secondsFromMilliseconds(end - start))
    : null;
}

/**
 * Une irrigation planifiée ne s'enregistre pas sans début lisible : tant que
 * son champ de date est vide ou incomplet, le bouton « Planifier l'irrigation »
 * reste grisé, comme celui d'une irrigation déjà réalisée sans dates lisibles
 * (point ouvert 46). Lancée maintenant ou déjà réalisée, une irrigation ne lit
 * pas ce champ.
 */
export function plannedStartKnown(kind: IrrigationEventCreationKind, plannedStart: number): boolean {
  return kind !== 'planned' || Number.isFinite(plannedStart);
}

/**
 * La bulle « d'où vient ce chiffre » d'une irrigation en préparation (3.8,
 * docs/feature-selection-contract.md, section 6) : d'où vient la durée (la
 * dose et le taux de la planche de référence, la durée saisie, ou le début et
 * la fin d'une irrigation déjà faite), ce que chaque planche reçoit, et le
 * volume. Les textes de la durée et du volume sont ceux de l'écran.
 */
export function irrigationPreviewOrigin(input: {
  source: 'amount' | 'duration' | 'completed';
  targetMm: number;
  reference: { bedName: string; rateMmPerHour: number } | null;
  durationText: string;
  applications: readonly { bedName: string; amountMm: number | null; wettedAreaSquareMeters: number | null }[];
  volumeText: string | null;
}): string {
  const duration = input.source === 'completed'
    ? `${input.durationText} : du début à la fin saisis.`
    : input.source === 'duration' || input.reference === null
      ? `${input.durationText} : la durée saisie.`
      : `${input.durationText} : le temps pour que ${input.reference.bedName} reçoive ${mmText(input.targetMm)} à ${rateText(input.reference.rateMmPerHour)}.`;
  const received = input.applications.filter((application) => application.amountMm !== null);
  const shares = received.length === 0 ? '' : ` Pendant ce temps, chaque planche reçoit au taux de son réglage : ${received.map((application) => `${application.bedName} ${mmText(application.amountMm ?? 0)}`).join(' ; ')}.`;
  const unknown = input.applications.find((application) => (application.amountMm ?? 0) > 0 && application.wettedAreaSquareMeters === null);
  const volume = input.volumeText === null || unknown
    ? ` Volume inconnu : la surface mouillée de ${unknown?.bedName ?? 'une planche'} n’est pas connue (son passe-pied manque).`
    : ` Volume : ${received.filter((application) => (application.amountMm ?? 0) > 0).map((application) => `${mmText(application.amountMm ?? 0)} sur ${squareMeters.format(application.wettedAreaSquareMeters ?? 0)} m²`).join(' + ')} = ${input.volumeText} (1 mm sur 1 m², c’est 1 litre).`;
  return `${duration}${shares}${volume}`;
}

const squareMeters = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2, useGrouping: false });
