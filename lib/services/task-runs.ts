import { readTaskRuns, recordTaskRun } from '@/db/task-run-repository';
import { logJsonLine } from '../adapters/log';
import { morningTaskOutcomes, type MorningRunReport, type TaskOutcome } from '../domain/operations/morning-task-outcomes';
import { TASK_REGISTRY, type TaskDeclaration } from '../domain/operations/task-registry';
import { taskState, type TaskState } from '../domain/operations/task-state';

/**
 * Les exécutions des tâches du registre (4.5, PR 1 ; docs/tranche-4-contract.md,
 * F560, F602 à F604) : le matin les enregistre, l'exploitant les lit.
 */

/**
 * Enregistre ce que le matin a fait de chacune de ses tâches. Un échec de
 * l'enregistrement ne fait pas échouer le matin : il se journalise sous un
 * nom stable, et la tâche, sans réussite nouvelle, passera en retard d'elle-même.
 */
export async function recordMorningTaskRuns(report: MorningRunReport, options: RecordOptions = {}): Promise<void> {
  await recordTaskOutcomes(morningTaskOutcomes(report), options);
}

type RecordOptions = { at?: string; log?: typeof logJsonLine };

/** Enregistre l'exécution de chaque tâche, comme le matin (la veille de 9 h l'emploie aussi). */
export async function recordTaskOutcomes(
  outcomes: readonly TaskOutcome[],
  { at = new Date().toISOString(), log = logJsonLine }: RecordOptions = {},
): Promise<void> {
  for (const outcome of outcomes) {
    try {
      await recordTaskRun({ ...outcome, at });
    } catch (error) {
      log('warn', { event: 'task_run_record_failed', task: outcome.task, error: error instanceof Error ? error.name : 'unknown' });
    }
    // Une ligne par tâche et par matin : la preuve d'un déploiement se lit au journal du matin suivant (R6).
    if (outcome.successful) log('info', { event: 'task_run_succeeded', task: outcome.task });
    else log('warn', { event: 'task_run_failed', task: outcome.task, summary: outcome.error });
  }
}

export type RegisteredTaskState = { declaration: TaskDeclaration; state: TaskState };

/** L'état de chaque tâche du registre, calculé à l'heure donnée, dans l'ordre du registre. */
export async function readTaskStates(now = new Date()): Promise<RegisteredTaskState[]> {
  const runs = await readTaskRuns(TASK_REGISTRY.map((task) => task.key));
  return TASK_REGISTRY.map((declaration) => {
    const run = runs.get(declaration.key);
    if (!run) throw new Error(`Exécutions absentes pour la tâche ${declaration.key}`);
    return { declaration, state: taskState(declaration, run, now) };
  });
}
