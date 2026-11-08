/**
 * Contrat de lecture OTF partagé par le domaine et l'adaptateur : l'erreur
 * d'API et la forme des collections renvoyées. Aucune dépendance : le domaine
 * (mapper, politique d'instantané) et l'adaptateur (client de lecture)
 * l'importent tous deux.
 */
export type OtfApiErrorCode = 'season-unavailable';

export class OtfApiError extends Error {
  readonly status?: number;
  readonly code?: OtfApiErrorCode;

  constructor(message: string, status?: number, code?: OtfApiErrorCode) {
    super(message);
    this.name = 'OtfApiError';
    this.status = status;
    this.code = code;
  }
}

export function extractCollection(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) {
    throw new OtfApiError('Réponse OTF invalide : collection attendue.');
  }

  const candidates = [
    payload['hydra:member'],
    payload.member,
    payload.items,
    payload.data,
    payload.list,
  ];
  const collection = candidates.find(Array.isArray);

  if (!collection) {
    throw new OtfApiError('Réponse OTF invalide : éléments absents.');
  }

  return collection;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
