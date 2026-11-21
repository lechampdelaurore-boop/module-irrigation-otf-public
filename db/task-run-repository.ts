import { db } from './binding';
import type { TaskKey } from '@/lib/domain/operations/task-registry';
import { EMPTY_TASK_RUN, type TaskRunRecord } from '@/lib/domain/operations/task-state';

/**
 * Les exécutions des tâches du registre (4.5, PR 1 ; docs/tranche-4-contract.md,
 * F560 et F604). Chaque tâche a sa ligne dans `irrigation_background_jobs`,
 * de clé `task:<tâche>`, à côté du verrou de la météo qu'elle ne touche pas.
 * Une table commune : elle ne garde que des heures, des nombres et des
 * résumés sans valeur, jamais une donnée d'une ferme.
 */

const TASK_JOB_PREFIX = 'task:';

type TaskRunRow = {
  job_key: string;
  last_completed_at: string | null;
  last_successful_at: string | null;
  last_error: string | null;
  consecutive_failures: number;
  failing_since: string | null;
};

/**
 * Enregistre une exécution. Réussie : sa fin devient la dernière réussite et
 * le compte des échecs revient à zéro. Manquée : le compte augmente, la
 * dernière réussite reste, et « en panne depuis » garde la première fin
 * manquée depuis cette réussite.
 */
export async function recordTaskRun(input: {
  task: TaskKey;
  at: string;
  successful: boolean;
  error: string | null;
}): Promise<void> {
  const error = input.successful ? null : input.error;
  await db.prepare(
    `INSERT INTO irrigation_background_jobs
       (job_key, last_completed_at, last_successful_at, last_error, consecutive_failures, failing_since, updated_at)
     VALUES (?, ?, CASE WHEN ? = 1 THEN ? END, ?, CASE WHEN ? = 1 THEN 0 ELSE 1 END, CASE WHEN ? = 1 THEN NULL ELSE ? END, ?)
     ON CONFLICT (job_key) DO UPDATE SET
       last_completed_at = excluded.last_completed_at,
       last_successful_at = CASE WHEN ? = 1 THEN excluded.last_completed_at
                                 ELSE irrigation_background_jobs.last_successful_at END,
       last_error = excluded.last_error,
       consecutive_failures = CASE WHEN ? = 1 THEN 0
                                   ELSE irrigation_background_jobs.consecutive_failures + 1 END,
       failing_since = CASE WHEN ? = 1 THEN NULL
                            ELSE COALESCE(irrigation_background_jobs.failing_since, excluded.last_completed_at) END,
       updated_at = excluded.updated_at`,
  ).bind(
    TASK_JOB_PREFIX + input.task,
    input.at,
    successFlag(input.successful),
    input.at,
    error,
    successFlag(input.successful),
    successFlag(input.successful),
    input.at,
    input.at,
    successFlag(input.successful),
    successFlag(input.successful),
    successFlag(input.successful),
  ).run();
}

/** Les exécutions gardées de chaque tâche demandée ; une tâche jamais exécutée n'a rien de gardé. */
export async function readTaskRuns(tasks: readonly TaskKey[]): Promise<Map<TaskKey, TaskRunRecord>> {
  const runs = new Map<TaskKey, TaskRunRecord>(tasks.map((task) => [task, EMPTY_TASK_RUN]));
  if (tasks.length === 0) return runs;
  const result = await db.prepare(
    `SELECT job_key, last_completed_at, last_successful_at, last_error, consecutive_failures, failing_since
     FROM irrigation_background_jobs
     WHERE job_key IN (${tasks.map(() => '?').join(', ')})`,
  ).bind(...tasks.map((task) => TASK_JOB_PREFIX + task)).all<TaskRunRow>();
  for (const row of result.results) {
    const task = row.job_key.slice(TASK_JOB_PREFIX.length) as TaskKey;
    runs.set(task, {
      lastSuccessAt: row.last_successful_at,
      lastAttemptAt: row.last_completed_at,
      lastError: row.last_error,
      consecutiveFailures: Number(row.consecutive_failures),
      failingSince: row.failing_since,
    });
  }
  return runs;
}

function successFlag(successful: boolean): number {
  return successful ? 1 : 0;
}
