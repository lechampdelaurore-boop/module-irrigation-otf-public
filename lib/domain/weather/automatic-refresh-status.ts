import { millisecondsFromHours } from '../units.ts';

/**
 * L'état de la mise à jour automatique de la météo d'une exploitation, tel que
 * l'écran le dit (correctif météo, PR 2, D-165 ; docs/weather-contract.md).
 *
 * La tâche du matin passe chaque jour à 6 h 15 : au-delà de 36 heures sans
 * réussite, au moins une mise à jour a manqué, et la date de la dernière
 * réussite ne se dit plus « en vert » comme si tout allait bien. Le retard se
 * dit avec la dernière erreur enregistrée, telle quelle.
 */
export const AUTOMATIC_REFRESH_LATE_AFTER_HOURS = 36;

export type AutomaticRefreshRecord = {
  lastAutomaticRefreshAttemptAt: string | null;
  lastAutomaticRefreshSuccessAt: string | null;
  lastAutomaticRefreshError: string | null;
};

export type AutomaticRefreshStatus =
  /** Aucune mise à jour automatique n'a encore été tentée : rien à dire. */
  | { kind: 'none' }
  /** La dernière réussite date de moins de 36 heures. */
  | { kind: 'fresh'; succeededAt: string }
  /** Plus de 36 heures sans réussite, ou des tentatives sans aucune réussite. */
  | { kind: 'late'; succeededAt: string | null; lastError: string | null };

export function automaticRefreshStatus(record: AutomaticRefreshRecord, now: Date): AutomaticRefreshStatus {
  const succeededAt = validInstant(record.lastAutomaticRefreshSuccessAt);
  const attemptedAt = validInstant(record.lastAutomaticRefreshAttemptAt);
  const lastError = record.lastAutomaticRefreshError?.trim() || null;
  if (succeededAt === null) {
    return attemptedAt === null ? { kind: 'none' } : { kind: 'late', succeededAt: null, lastError };
  }
  const ageMilliseconds = now.getTime() - Date.parse(succeededAt);
  if (ageMilliseconds <= millisecondsFromHours(AUTOMATIC_REFRESH_LATE_AFTER_HOURS)) {
    return { kind: 'fresh', succeededAt };
  }
  return { kind: 'late', succeededAt, lastError };
}

function validInstant(value: string | null): string | null {
  return value !== null && Number.isFinite(Date.parse(value)) ? value : null;
}
