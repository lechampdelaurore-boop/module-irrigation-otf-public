import { dateKeyInTimeZone, FARM_TIME_ZONE } from '../water-management.ts';
import type { TaskDeclaration } from './task-registry.ts';
import type { TaskState } from './task-state.ts';
import { undeliveredAlertsWatchSentence, type UndeliveredAlertsOfDay } from './undelivered-alerts.ts';

/**
 * La veille de l'exploitant (4.5, PR 2 ; docs/tranche-4-contract.md, F566,
 * et 10 bis.12, F608 à F613) : chaque jour à 9 h, elle lit le registre des
 * tâches et dit ce qu'elle doit envoyer à l'exploitant.
 *
 * - Au moins une tâche en panne, en retard ou jamais réussie : une alerte qui
 *   dit **quelle tâche et depuis quand**, avec le lien vers la page d'état.
 * - Au moins une alerte d'une ferme partie sans atteindre un appareil dans
 *   les 24 dernières heures (C3, D-305) : la même alerte, qui le dit en
 *   premier, avec le nombre de fermes et les causes.
 * - Rien à signaler un dimanche : « tout va bien », qui prouve que la veille
 *   elle-même tourne ; s'il manque, l'exploitant sait qu'il doit regarder.
 * - Rien à signaler un autre jour : rien (pas de bruit).
 *
 * Une tâche se nomme par son nom du registre ; le texte ne porte que des
 * dates et le résumé sans valeur de la tâche (F604), jamais un nom de ferme.
 * Il tient dans les limites du service de notification (titre de 80
 * caractères, texte de 160) : au-delà, la notification serait refusée.
 */

export const OPERATOR_PAGE_PATH = '/irrigation/exploitation';

const TITLE_MAX_LENGTH = 80;
const BODY_MAX_LENGTH = 160;
const SUNDAY = 'Sun';

export type WatchedTask = { declaration: TaskDeclaration; state: TaskState };

export type OperatorNotice = {
  kind: 'alert' | 'all-good';
  /** Les tâches à regarder (0 pour « tout va bien »). */
  problems: number;
  title: string;
  body: string;
  tag: string;
  url: string;
};

const PROBLEM_ORDER = { broken: 0, late: 1, never: 2 } as const;

/** Les tâches à regarder, la plus grave d'abord : en panne, puis en retard, puis jamais réussie. */
export function tasksToWatch(tasks: readonly WatchedTask[]): WatchedTask[] {
  return tasks
    .filter((task) => task.state.kind !== 'ok')
    .map((task, index) => ({ task, index }))
    .sort((left, right) => problemRank(left.task) - problemRank(right.task) || left.index - right.index)
    .map(({ task }) => task);
}

/**
 * La notification due ce matin, ou `null`. La veille ne se nomme pas
 * elle-même : quand elle tourne, elle est à l'heure, et quand elle ne tourne
 * plus, c'est le dimanche manquant et la page d'état qui le disent (F566).
 */
export function operatorWatchNotice(
  registered: readonly WatchedTask[],
  now: Date,
  undeliveredAlerts: UndeliveredAlertsOfDay | null = null,
): OperatorNotice | null {
  const tasks = registered.filter((task) => task.declaration.key !== 'operator-watch');
  const problems = tasksToWatch(tasks);
  const alertsSentence = undeliveredAlerts ? undeliveredAlertsWatchSentence(undeliveredAlerts) : null;
  const count = problems.length + (alertsSentence ? 1 : 0);
  if (count > 0) {
    return {
      kind: 'alert',
      problems: count,
      title: fitted(alertTitle(problems, alertsSentence !== null), TITLE_MAX_LENGTH),
      body: alertBody(problems, alertsSentence),
      tag: 'operator-watch',
      url: OPERATOR_PAGE_PATH,
    };
  }
  if (parisWeekday(now) !== SUNDAY) return null;
  return {
    kind: 'all-good',
    problems: 0,
    title: 'Module d\'irrigation : tout va bien',
    body: `Les ${tasks.length} tâches sont à l'heure. Ce message revient chaque dimanche : s'il manque, regardez la page d'état.`,
    tag: 'operator-watch',
    url: OPERATOR_PAGE_PATH,
  };
}

function alertTitle(problems: readonly WatchedTask[], undeliveredAlerts: boolean): string {
  if (!undeliveredAlerts) {
    return problems.length === 1
      ? `Module d'irrigation : une tâche ${stateWords(problems[0].state.kind)}`
      : `Module d'irrigation : ${problems.length} tâches à regarder`;
  }
  if (problems.length === 0) return 'Module d\'irrigation : alertes non délivrées';
  return `Module d'irrigation : alertes non délivrées et ${problems.length === 1 ? 'une tâche' : `${problems.length} tâches`} à regarder`;
}

/**
 * Les alertes non délivrées d'abord, quand il y en a : une alerte de gel vue
 * par personne touche une ferme dès aujourd'hui. Puis autant de tâches
 * nommées que le texte en tient, la plus grave d'abord, puis « Et N
 * autres. » ; la dernière erreur quand une seule tâche est en cause et qu'il
 * reste la place. Le détail est sur la page d'état.
 */
function alertBody(problems: readonly WatchedTask[], alertsSentence: string | null): string {
  if (problems.length === 0) return fitted(`${alertsSentence} Le détail est sur la page d'état.`, BODY_MAX_LENGTH);
  // Après les alertes, la place manque souvent : les tâches se disent alors sans « depuis quand ».
  const wordings = alertsSentence ? [problemSentence, shortProblemSentence] : [problemSentence];
  for (const wording of wordings) {
    const sentences = problems.map(wording);
    for (let named = problems.length; named >= 1; named -= 1) {
      const others = problems.length - named;
      const body = [alertsSentence, ...sentences.slice(0, named), others > 0 ? `Et ${others} autre${others > 1 ? 's' : ''}.` : null]
        .filter((line): line is string => line !== null)
        .join(' ');
      if (body.length > BODY_MAX_LENGTH) continue;
      const lastError = problems.length === 1 ? problems[0].state.lastError : null;
      const withError = lastError ? `${body} Dernière erreur : ${lastError}.` : body;
      return withError.length <= BODY_MAX_LENGTH ? withError : body;
    }
  }
  const tasks = `${problems.length} tâche${problems.length > 1 ? 's' : ''} à regarder`;
  const detailed = `${tasks} : le détail est sur la page d'état.`;
  if (!alertsSentence) return fitted(detailed, BODY_MAX_LENGTH);
  const both = `${alertsSentence} Et ${detailed}`;
  return fitted(both.length <= BODY_MAX_LENGTH ? both : `${alertsSentence} Et ${tasks}.`, BODY_MAX_LENGTH);
}

/**
 * « Pluie estimée après coup (réanalyse) : en panne (en échec depuis le 14/11 à 6 h 16). »
 * Depuis quand : le premier échec, sinon la dernière réussite (une tâche qui ne
 * tourne plus n'enregistre pas d'échec), sinon « jamais réussie ».
 */
function problemSentence({ declaration, state }: WatchedTask): string {
  if (state.failingSince) return `${declaration.label} : ${stateWords(state.kind)} (en échec depuis le ${parisMoment(state.failingSince)}).`;
  if (state.lastSuccessAt) return `${declaration.label} : ${stateWords(state.kind)} (aucune réussite depuis le ${parisMoment(state.lastSuccessAt)}).`;
  return `${declaration.label} : jamais réussie.`;
}

/** « Pluie estimée après coup (réanalyse) : en panne. » */
function shortProblemSentence({ declaration, state }: WatchedTask): string {
  return `${declaration.label} : ${stateWords(state.kind)}.`;
}

export function stateWords(kind: TaskState['kind']): string {
  switch (kind) {
    case 'broken': return 'en panne';
    case 'late': return 'en retard';
    case 'never': return 'jamais réussie';
    case 'ok': return 'à l\'heure';
  }
}

function problemRank({ state }: WatchedTask): number {
  return state.kind === 'ok' ? Number.POSITIVE_INFINITY : PROBLEM_ORDER[state.kind];
}

/** Un texte qui dépasserait la limite est coupé sur un mot, avec « … » : jamais refusé. */
function fitted(text: string, maximumLength: number): string {
  if (text.length <= maximumLength) return text;
  const cut = text.slice(0, maximumLength - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 1))}…`;
}

/** « 14/11 à 6 h 16 », à l'heure de Paris. */
export function parisMoment(instant: string): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('fr-FR', {
    timeZone: FARM_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
  return `${parts.day}/${parts.month} à ${Number(parts.hour)} h ${parts.minute}`;
}

/** Le jour de Paris d'un instant (« 2026-11-14 ») : une notification au plus par jour. */
export function parisDay(now: Date): string {
  return dateKeyInTimeZone(now, FARM_TIME_ZONE);
}

function parisWeekday(now: Date): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: FARM_TIME_ZONE, weekday: 'short' }).format(now);
}
