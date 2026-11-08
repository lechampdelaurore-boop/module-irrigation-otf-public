import type { CreateIrrigationEventActionInput } from './contract';

import { IrrigationEventInputError } from '@/db/irrigation-event/errors';

const MAX_NOTE_LENGTH = 500;

export function validateBaseInput(input: CreateIrrigationEventActionInput) {
  if (!Number.isInteger(input.season) || input.season < 1900 || input.season > 9999) {
    throw new IrrigationEventInputError('Saison invalide.');
  }
  if (!input.equipmentId || !input.settingId) {
    throw new IrrigationEventInputError('Choisissez un matériel et un réglage.');
  }
  if (!['planned', 'completed', 'running'].includes(input.kind)) {
    throw new IrrigationEventInputError('Type d’irrigation invalide.');
  }
  if (!['amount', 'duration'].includes(input.preparationMode)) {
    throw new IrrigationEventInputError('Mode de calcul invalide.');
  }
  const note = input.note?.trim() ?? '';
  if (note.length > MAX_NOTE_LENGTH) {
    throw new IrrigationEventInputError(
      `La note ne peut pas dépasser ${MAX_NOTE_LENGTH} caractères.`,
    );
  }
}

export function normalizeNote(value: string | null | undefined) {
  const note = value?.trim().replace(/\s+/g, ' ') ?? '';
  return note || null;
}
