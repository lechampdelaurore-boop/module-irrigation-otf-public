import { parisMoment, stateWords, tasksToWatch, type WatchedTask } from './operator-watch.ts';
import type { TaskState } from './task-state.ts';

/**
 * La page d'état de l'exploitant (4.5, PR 2 ; docs/tranche-4-contract.md,
 * F565, et 10 bis.12, F612) : ce qu'elle dit, en mots simples. Un jugement
 * d'ensemble en une ligne, puis chaque tâche du registre avec sa dernière
 * réussite, son état et le résumé de son dernier échec, puis la dernière
 * notification de la veille. Jamais un vert qui cache un manque : une tâche
 * jamais réussie est en orange.
 */

type StatusTone = 'ok' | 'warn' | 'danger';

type OperatorTaskLine = {
  key: string;
  label: string;
  rhythm: string;
  state: string;
  tone: StatusTone;
  /** « 20/11 à 6 h 16 », ou « aucune enregistrée ». */
  lastSuccess: string;
  /** « en échec depuis le 14/11 à 6 h 16 (3 exécutions manquées) », quand la tâche échoue. */
  failing: string | null;
  lastError: string | null;
  ifMissing: string;
};

export type OperatorStatusView = {
  verdict: { tone: StatusTone; text: string };
  tasks: OperatorTaskLine[];
  /** La dernière notification partie vers l'exploitant, ou ce qu'il faut savoir de son absence. */
  lastNotice: string;
};

export type LatestNotice = { kind: 'alert' | 'all-good'; problems: number; sentAt: string };

export function operatorStatusView(tasks: readonly WatchedTask[], latestNotice: LatestNotice | null): OperatorStatusView {
  return {
    verdict: verdict(tasks),
    tasks: tasks.map(taskLine),
    lastNotice: latestNotice
      ? `Dernière notification de la veille : ${latestNotice.kind === 'all-good'
        ? '« tout va bien »'
        : `alerte pour ${latestNotice.problems} tâche${latestNotice.problems > 1 ? 's' : ''}`}, le ${parisMoment(latestNotice.sentAt)}.`
      : 'Aucune notification de la veille enregistrée : la première alerte, ou le premier « tout va bien » du dimanche, la fera paraître ici.',
  };
}

/** « Tout va bien », sinon les tâches en cause, la plus grave d'abord : « 1 tâche en panne, 2 en retard ». */
function verdict(tasks: readonly WatchedTask[]): OperatorStatusView['verdict'] {
  const problems = tasksToWatch(tasks);
  if (problems.length === 0) return { tone: 'ok', text: `Tout va bien : les ${tasks.length} tâches automatiques sont à l'heure.` };
  const counts = (['broken', 'late', 'never'] as const)
    .map((kind) => ({ kind, count: problems.filter((task) => task.state.kind === kind).length }))
    .filter(({ count }) => count > 0)
    .map(({ kind, count }, index) => `${count}${index === 0 ? ` tâche${count > 1 ? 's' : ''}` : ''} ${stateWords(kind)}${kind === 'never' && count > 1 ? 's' : ''}`);
  return {
    tone: problems.some((task) => task.state.kind === 'broken') ? 'danger' : 'warn',
    text: `${counts.join(', ')}.`.replace(/^./, (first) => first.toUpperCase()),
  };
}

function taskLine({ declaration, state }: WatchedTask): OperatorTaskLine {
  return {
    key: declaration.key,
    label: declaration.label,
    rhythm: declaration.rhythm,
    state: stateWords(state.kind).replace(/^./, (first) => first.toUpperCase()),
    tone: toneOf(state.kind),
    lastSuccess: state.lastSuccessAt ? parisMoment(state.lastSuccessAt) : 'aucune enregistrée',
    failing: state.consecutiveFailures > 0
      ? `en échec${state.failingSince ? ` depuis le ${parisMoment(state.failingSince)}` : ''} (${state.consecutiveFailures} exécution${state.consecutiveFailures > 1 ? 's' : ''} manquée${state.consecutiveFailures > 1 ? 's' : ''} de suite)`
      : null,
    lastError: state.consecutiveFailures > 0 ? state.lastError : null,
    ifMissing: declaration.ifMissing,
  };
}

function toneOf(kind: TaskState['kind']): StatusTone {
  if (kind === 'ok') return 'ok';
  return kind === 'broken' ? 'danger' : 'warn';
}
