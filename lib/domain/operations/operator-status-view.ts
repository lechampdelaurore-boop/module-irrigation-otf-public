import type { CostView } from './costs.ts';
import { farmErasureLine, type FarmErasureCounts, type FarmErasureLine } from './farm-erasure.ts';
import type { FarmObservationLine } from './farm-observation.ts';
import { isGestureTask, type GestureDates, type GestureTask } from './operator-gesture.ts';
import { parisMoment, stateWords, tasksToWatch, type WatchedTask } from './operator-watch.ts';
import type { SupportAccessLine } from './support-access.ts';
import type { OperatorErasureLine } from './farm-erasure-request.ts';
import type { TaskState } from './task-state.ts';

/**
 * La page d'état de l'exploitant (4.5, PR 2 ; docs/tranche-4-contract.md,
 * F565, et 10 bis.12, F612 ; 10 bis.13, F616) : ce qu'elle dit, en mots
 * simples. Un jugement d'ensemble en une ligne, puis chaque tâche du registre
 * avec sa dernière réussite, son état et le résumé de son dernier échec, puis
 * la dernière notification de la veille, puis chaque ferme, puis les
 * demandes d'effacement (10 bis.17, F646). Jamais un vert
 * qui cache un manque : une tâche jamais réussie est en orange, et le
 * jugement d'ensemble compte aussi les fermes en difficulté.
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
  /** La tâche faite par l'exploitant, dont la carte porte le geste (F625, F637), ou `null`. */
  gesture: GestureTask | null;
};

export type OperatorStatusView = {
  verdict: { tone: StatusTone; text: string };
  tasks: OperatorTaskLine[];
  /** La dernière notification partie vers l'exploitant, ou ce qu'il faut savoir de son absence. */
  lastNotice: string;
  /** Une ligne par ferme, la plus en difficulté d'abord (F616). */
  farms: FarmObservationLine[];
  /** Les jours que proposent les gestes « J'ai fait l'export du … » et « J'ai fait l'essai du … » (F625, F637), ou `null` hors de la page. */
  gestureDates: GestureDates | null;
  /** « Demandes d'effacement : 1 en attente, 2 faites ; dernière faite le … » (F646), ou `null` hors de la page. */
  erasures: FarmErasureLine | null;
  /** Le journal d'accès du support (F660, F661) : les fermes qu'il peut nommer et les accès des 12 derniers mois, ou `null` hors de la page. */
  support: { farms: string[]; lines: SupportAccessLine[] } | null;
  /** Les coûts du mois (F662, F663) et les mois qu'un relevé peut viser, ou `null` hors de la page. */
  costs: (CostView & { months: { value: string; label: string }[] }) | null;
  /** Les demandes d'effacement ouvertes (F668) : la ferme, le jour de la demande, le jour prévu ; `null` hors de la page. */
  erasureRequests: OperatorErasureLine[] | null;
};

export type LatestNotice = { kind: 'alert' | 'all-good'; problems: number; sentAt: string };

export function operatorStatusView(
  tasks: readonly WatchedTask[],
  latestNotice: LatestNotice | null,
  farms: readonly FarmObservationLine[] = [],
  gestureDates: GestureDates | null = null,
  erasures: FarmErasureCounts | null = null,
): OperatorStatusView {
  return {
    verdict: verdict(tasks, farms),
    tasks: tasks.map(taskLine),
    farms: [...farms],
    gestureDates,
    erasures: erasures ? farmErasureLine(erasures) : null,
    support: null,
    costs: null,
    erasureRequests: null,
    lastNotice: latestNotice
      ? `Dernière notification de la veille : ${latestNotice.kind === 'all-good'
        ? '« tout va bien »'
        : `alerte pour ${latestNotice.problems} tâche${latestNotice.problems > 1 ? 's' : ''}`}, le ${parisMoment(latestNotice.sentAt)}.`
      : 'Aucune notification de la veille enregistrée : la première alerte, ou le premier « tout va bien » du dimanche, la fera paraître ici.',
  };
}

/**
 * « Tout va bien », sinon les tâches en cause, la plus grave d'abord (« 1
 * tâche en panne, 2 en retard »), puis les fermes en cause (« 1 ferme en
 * difficulté, 2 à regarder »).
 */
function verdict(tasks: readonly WatchedTask[], farms: readonly FarmObservationLine[]): OperatorStatusView['verdict'] {
  const problems = tasksToWatch(tasks);
  const farmWords = farmCounts(farms);
  if (problems.length === 0 && farmWords === null) return { tone: 'ok', text: `Tout va bien : les ${tasks.length} tâches sont à l'heure.` };
  const taskWords = problems.length === 0
    ? `les ${tasks.length} tâches sont à l'heure`
    : (['broken', 'late', 'never'] as const)
      .map((kind) => ({ kind, count: problems.filter((task) => task.state.kind === kind).length }))
      .filter(({ count }) => count > 0)
      .map(({ kind, count }, index) => `${count}${index === 0 ? ` tâche${count > 1 ? 's' : ''}` : ''} ${stateWords(kind)}${kind === 'never' && count > 1 ? 's' : ''}`)
      .join(', ');
  const danger = problems.some((task) => task.state.kind === 'broken') || farms.some((farm) => farm.tone === 'danger');
  return {
    tone: danger ? 'danger' : 'warn',
    text: `${[taskWords, farmWords].filter(Boolean).join(' ; ')}.`.replace(/^./, (first) => first.toUpperCase()),
  };
}

/** « 1 ferme en difficulté, 2 à regarder », ou `null` quand toutes vont bien. */
function farmCounts(farms: readonly FarmObservationLine[]): string | null {
  const counts = ([['danger', 'en difficulté'], ['warn', 'à regarder']] as const)
    .map(([tone, words]) => ({ words, count: farms.filter((farm) => farm.tone === tone).length }))
    .filter(({ count }) => count > 0)
    .map(({ words, count }, index) => `${count}${index === 0 ? ` ferme${count > 1 ? 's' : ''}` : ''} ${words}`);
  return counts.length === 0 ? null : counts.join(', ');
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
    gesture: isGestureTask(declaration.key) ? declaration.key : null,
  };
}

function toneOf(kind: TaskState['kind']): StatusTone {
  if (kind === 'ok') return 'ok';
  return kind === 'broken' ? 'danger' : 'warn';
}
