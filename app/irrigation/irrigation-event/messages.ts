import type { IrrigationEventCreationKind } from '@/lib/domain/irrigation-event-record';
import type { IrrigationEventActionResult } from './contract';
import { IrrigationDailyLimitExceededError, IrrigationHydraulicLimitExceededError } from './limits';

import {
  IrrigationEquipmentAlreadyRunningError,
  IrrigationEventInputError,
  IrrigationEventNotFoundError,
  IrrigationEventStateError,
} from '@/db/irrigation-event/errors';
import { IrrigationPushCancellationError } from '@/lib/services/irrigation-push-orchestration';

export function creationMessage(kind: IrrigationEventCreationKind) {
  if (kind === 'running') return 'L’irrigation a démarré.';
  if (kind === 'completed') return 'L’irrigation réalisée a été enregistrée.';
  return 'L’irrigation a été planifiée.';
}

export function warningMessage(result: {
  overlapBedCount: number;
  scheduleConflictCount: number;
}) {
  const warnings: string[] = [];
  if (result.overlapBedCount > 0) {
    warnings.push(
      `${result.overlapBedCount} planche${result.overlapBedCount > 1 ? 's sont' : ' est'} déjà irriguée${result.overlapBedCount > 1 ? 's' : ''} par un autre matériel en cours.`,
    );
  }
  if (result.scheduleConflictCount > 0) {
    warnings.push('Ce matériel possède déjà une irrigation planifiée sur ce créneau.');
  }
  return warnings.length > 0 ? warnings.join(' ') : undefined;
}

export function joinWarnings(...warnings: Array<string | undefined>) {
  const messages = warnings.filter((warning): warning is string => Boolean(warning));
  return messages.length > 0 ? messages.join(' ') : undefined;
}

export function handledError(error: unknown): IrrigationEventActionResult {
  if (error instanceof Error && /WATER_BUDGET_CHANGED/.test(error.message)) {
    return { ok: false, message: 'Le volume disponible a changé pendant la validation. Réessayez : la limite sera recalculée avant tout enregistrement.' };
  }
  if (error instanceof Error && /HYDRAULIC_CHANGED/.test(error.message)) {
    return { ok: false, message: 'La capacité hydraulique a changé pendant la validation. Réessayez : elle sera recalculée.' };
  }
  if (
    error instanceof IrrigationEventInputError ||
    error instanceof IrrigationEventNotFoundError ||
    error instanceof IrrigationEventStateError ||
    error instanceof IrrigationEquipmentAlreadyRunningError ||
    error instanceof IrrigationDailyLimitExceededError ||
    error instanceof IrrigationHydraulicLimitExceededError ||
    error instanceof IrrigationPushCancellationError
  ) {
    return { ok: false, message: error.message };
  }
  throw error;
}

export function expiredSession(): IrrigationEventActionResult {
  return { ok: false, message: 'Votre session a expiré.' };
}
