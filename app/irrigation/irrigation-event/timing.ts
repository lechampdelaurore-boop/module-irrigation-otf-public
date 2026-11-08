import type { IrrigationBedApplicationDraft } from '@/lib/domain/irrigation-event-record';
import {
  millisecondsFromMinutes,
  millisecondsFromSeconds,
  secondsFromMilliseconds,
} from '@/lib/domain/units';
import type { CreateIrrigationEventActionInput } from './contract';

import { IrrigationEventInputError } from '@/db/irrigation-event/errors';
import { durationSecondsForTarget } from '@/lib/domain/irrigation-timer';

const MAX_DURATION_SECONDS = 31 * 24 * 60 * 60;

export function resolveTiming(
  input: CreateIrrigationEventActionInput,
  equipmentKind: 'sprinkler' | 'drip',
  applications: readonly IrrigationBedApplicationDraft[],
) {
  if (input.kind === 'completed') return resolveCompletedTiming(input);

  const plannedDurationSeconds = resolvePlannedDuration(
    input,
    equipmentKind,
    applications,
  );
  assertDuration(plannedDurationSeconds);
  const start = input.kind === 'running'
    ? new Date()
    : parseRequiredDate(
        input.plannedStartAt,
        'Indiquez la date et l’heure de l’irrigation planifiée.',
      );
  const end = new Date(start.getTime() + millisecondsFromSeconds(plannedDurationSeconds));
  return {
    plannedStartAt: start.toISOString(),
    plannedEndAt: end.toISOString(),
    actualStartAt: null,
    actualEndAt: null,
    plannedDurationSeconds,
    actualDurationSeconds: 0,
  };
}

/** Les heures réelles d'une irrigation saisie après coup : début, fin, durée. */
export function resolveCompletedTiming(input: CreateIrrigationEventActionInput) {
  const actualStart = parseRequiredDate(input.actualStartAt, 'Indiquez l’heure de début.');
  const actualEnd = parseRequiredDate(input.actualEndAt, 'Indiquez l’heure de fin.');
  if (actualEnd <= actualStart) {
    throw new IrrigationEventInputError(
      'L’heure de fin doit être postérieure à l’heure de début.',
    );
  }
  if (actualEnd.getTime() > Date.now() + millisecondsFromMinutes(1)) {
    throw new IrrigationEventInputError(
      'Une irrigation réalisée ne peut pas se terminer dans le futur.',
    );
  }
  const actualDurationSeconds = Math.floor(
    secondsFromMilliseconds(actualEnd.getTime() - actualStart.getTime()),
  );
  assertDuration(actualDurationSeconds);
  return {
    plannedStartAt: null,
    plannedEndAt: null,
    actualStartAt: actualStart.toISOString(),
    actualEndAt: actualEnd.toISOString(),
    plannedDurationSeconds: 0,
    actualDurationSeconds,
  };
}

function resolvePlannedDuration(
  input: CreateIrrigationEventActionInput,
  equipmentKind: 'sprinkler' | 'drip',
  applications: readonly IrrigationBedApplicationDraft[],
) {
  if (input.preparationMode === 'duration') {
    const minutes = Number(input.durationMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      throw new IrrigationEventInputError('Indiquez une durée supérieure à zéro.');
    }
    return Math.round(minutes * 60);
  }

  const target = Number(input.targetMillimeters);
  if (!Number.isFinite(target) || target <= 0) {
    throw new IrrigationEventInputError('Indiquez un objectif en mm supérieur à zéro.');
  }
  const reference = equipmentKind === 'sprinkler'
    ? applications.find((application) => application.otfBedId === input.referenceBedId)
    : applications[0];
  if (!reference) {
    throw new IrrigationEventInputError(
      'Choisissez une planche de référence pour calculer la durée.',
    );
  }
  const duration = durationSecondsForTarget(target, reference.rateMmPerHour);
  if (duration <= 0) {
    throw new IrrigationEventInputError(
      'La planche de référence ne reçoit pas assez d’eau avec ce réglage.',
    );
  }
  return duration;
}

function assertDuration(seconds: number) {
  if (!Number.isInteger(seconds) || seconds <= 0) {
    throw new IrrigationEventInputError('La durée calculée est invalide.');
  }
  if (seconds > MAX_DURATION_SECONDS) {
    throw new IrrigationEventInputError(
      'La durée d’une irrigation ne peut pas dépasser 31 jours.',
    );
  }
}

function parseRequiredDate(value: string | null | undefined, message: string) {
  const date = new Date(value ?? '');
  if (!Number.isFinite(date.getTime())) throw new IrrigationEventInputError(message);
  return date;
}
