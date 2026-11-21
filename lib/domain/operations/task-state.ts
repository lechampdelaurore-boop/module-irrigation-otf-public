import { millisecondsFromHours } from '../units.ts';
import { REPEATED_FAILURES_FOR_BROKEN, type TaskDeclaration } from './task-registry.ts';

/**
 * L'état d'une tâche du registre (4.5, PR 1 ; docs/tranche-4-contract.md,
 * F560 et F603), calculé à la lecture, jamais recopié :
 *
 * 1. trois exécutions manquées de suite : « en panne », même avec une
 *    réussite récente (R2) ;
 * 2. aucune réussite enregistrée : « jamais réussie », en orange, jamais en
 *    vert (F560, ii) ;
 * 3. sinon, l'âge de la dernière **réussite** (R1), jamais celui de la
 *    dernière tentative : « ok » jusqu'au seuil orange compris, « en retard »
 *    jusqu'au seuil rouge compris, « en panne » au-delà (R3) ; une réussite
 *    qui manque est un défaut, même sans aucune erreur enregistrée.
 */

/** Ce que la base garde des exécutions d'une tâche. */
export type TaskRunRecord = {
  lastSuccessAt: string | null;
  /** La fin de la dernière exécution, réussie ou non. */
  lastAttemptAt: string | null;
  /** Le résumé de la dernière exécution manquée, sans valeur sensible. */
  lastError: string | null;
  /** Les exécutions manquées depuis la dernière réussite. */
  consecutiveFailures: number;
  /** La fin de la première exécution manquée depuis la dernière réussite. */
  failingSince: string | null;
};

export const EMPTY_TASK_RUN: TaskRunRecord = {
  lastSuccessAt: null,
  lastAttemptAt: null,
  lastError: null,
  consecutiveFailures: 0,
  failingSince: null,
};

type TaskStateKind = 'ok' | 'late' | 'broken' | 'never';

export type TaskState = {
  kind: TaskStateKind;
  /** Pourquoi la tâche est dans cet état. */
  reason: 'fresh' | 'old-success' | 'repeated-failures' | 'no-success';
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  failingSince: string | null;
};

export function taskState(declaration: TaskDeclaration, record: TaskRunRecord, now: Date): TaskState {
  const lastSuccessAt = validInstant(record.lastSuccessAt);
  const facts = {
    lastSuccessAt,
    lastAttemptAt: validInstant(record.lastAttemptAt),
    lastError: record.lastError?.trim() || null,
    consecutiveFailures: Math.max(0, Math.trunc(record.consecutiveFailures)),
    failingSince: validInstant(record.failingSince),
  };
  if (facts.consecutiveFailures >= REPEATED_FAILURES_FOR_BROKEN) {
    return { kind: 'broken', reason: 'repeated-failures', ...facts };
  }
  if (lastSuccessAt === null) return { kind: 'never', reason: 'no-success', ...facts };
  const ageMilliseconds = now.getTime() - Date.parse(lastSuccessAt);
  if (ageMilliseconds <= millisecondsFromHours(declaration.lateAfterHours)) {
    return { kind: 'ok', reason: 'fresh', ...facts };
  }
  if (ageMilliseconds <= millisecondsFromHours(declaration.brokenAfterHours)) {
    return { kind: 'late', reason: 'old-success', ...facts };
  }
  return { kind: 'broken', reason: 'old-success', ...facts };
}

function validInstant(value: string | null): string | null {
  return value !== null && Number.isFinite(Date.parse(value)) ? value : null;
}
