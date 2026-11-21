import { otfErrorRate, type OtfCallCounts, type OtfErrorRate } from '../otf/call-outcome.ts';
import { parisMoment } from './operator-watch.ts';
import { taskDeclaration, type TaskKey } from './task-registry.ts';
import { EMPTY_TASK_RUN, taskState, type TaskState } from './task-state.ts';

/**
 * Chaque ferme sur la page d'état de l'exploitant (4.5, PR 2 ;
 * docs/tranche-4-contract.md, F564, F565, et 10 bis.13, F614 à F616) : une
 * ligne par ferme, la plus en difficulté d'abord, calculée à la lecture.
 * Son raccordement, ses appels du jour, ses erreurs d'Ouvre ta ferme sur
 * 24 heures et 7 jours, sa dernière lecture complète, sa dernière météo et
 * son dernier calcul du matin. Des identifiants, des états, des heures et des
 * nombres : jamais un nom de ferme ni un contenu.
 *
 * Les âges se jugent avec les seuils du registre (F600) : la lecture d'OTF et
 * le calcul du matin avec ceux du calcul du matin, qui lit la ferme chaque
 * matin ; la météo avec ceux des prévisions. Jamais un vert qui cache un
 * manque : une ferme jamais lue, ou sans météo, est en orange.
 */

export type FarmConnectionState = 'linked' | 'reconnect-required' | 'read-refused';

/** Ce que la base sait d'une ferme (`db/farm-observation-repository.ts`). */
export type FarmObservationRecord = {
  /** L'identifiant d'Ouvre ta ferme, ou la clé du compteur d'appels sans ferme connue. */
  farmKey: string;
  /** Les espaces du module sur cette ferme. */
  spaces: number;
  /** Le raccordement de la ferme par sa personne (4.3), `null` sans raccordement. */
  connection: FarmConnectionState | null;
  callsToday: number;
  outcomes24h: OtfCallCounts;
  outcomes7d: OtfCallCounts;
  lastCompleteReadAt: string | null;
  lastWeatherAt: string | null;
  lastMorningPlanAt: string | null;
};

type FarmTone = 'ok' | 'warn' | 'danger';

export type FarmObservationLine = {
  farmKey: string;
  title: string;
  tone: FarmTone;
  /** L'état en deux mots, à côté du titre : « Va bien », « À regarder », « En difficulté ». */
  state: string;
  /** Ce qui ne va pas, le plus grave d'abord ; `null` quand tout va bien. */
  verdict: string | null;
  connection: string;
  callsToday: string;
  errors24h: string;
  errors7d: string;
  lastOtfRead: string;
  lastWeather: string;
  lastMorning: string;
};

export type FarmObservationContext = {
  now: Date;
  /** La ferme de la clé du déploiement, lue sans raccordement ; `null` tant qu'elle n'est pas connue. */
  deploymentFarm: string | null;
  /** La clé du compteur des appels de la clé du déploiement avant que sa ferme soit connue. */
  unknownFarmKey: string;
  /** Les fermes dont au moins un espace a coché le Planning : elles seules reçoivent le calcul du matin. */
  planningFarms: ReadonlySet<string>;
};

type Problem = { tone: Exclude<FarmTone, 'ok'>; text: string };

const TONE_RANK: Record<FarmTone, number> = { danger: 2, warn: 1, ok: 0 };

const TONE_WORDS: Record<FarmTone, string> = { ok: 'Va bien', warn: 'À regarder', danger: 'En difficulté' };

/**
 * Les lignes des fermes, la plus en difficulté d'abord, puis par identifiant.
 * La ferme de la clé du déploiement a toujours sa ligne, même sans rien
 * d'enregistré : son absence cacherait qu'elle n'est jamais lue.
 */
export function farmObservationLines(records: readonly FarmObservationRecord[], context: FarmObservationContext): FarmObservationLine[] {
  const { deploymentFarm } = context;
  const all = deploymentFarm !== null && !records.some((record) => record.farmKey === deploymentFarm)
    ? [...records, emptyFarmObservation(deploymentFarm)]
    : records;
  return all
    .map((record) => farmLine(record, context))
    .sort((left, right) => TONE_RANK[right.line.tone] - TONE_RANK[left.line.tone]
      || right.problems - left.problems
      || left.line.farmKey.localeCompare(right.line.farmKey))
    .map(({ line }) => line);
}

export function emptyFarmObservation(farmKey: string): FarmObservationRecord {
  return {
    farmKey,
    spaces: 0,
    connection: null,
    callsToday: 0,
    outcomes24h: {},
    outcomes7d: {},
    lastCompleteReadAt: null,
    lastWeatherAt: null,
    lastMorningPlanAt: null,
  };
}

function farmLine(record: FarmObservationRecord, context: FarmObservationContext): { line: FarmObservationLine; problems: number } {
  const withoutFarm = record.farmKey === context.unknownFarmKey;
  const isDeploymentFarm = record.farmKey === context.deploymentFarm;
  const problems: Problem[] = [];
  const day = otfErrorRate(record.outcomes24h);
  if (day.errors > 0) {
    problems.push({
      tone: day.errors * 2 >= day.calls ? 'danger' : 'warn',
      text: `${day.errors} erreur${day.errors > 1 ? 's' : ''} d’Ouvre ta ferme sur ${day.calls} appel${day.calls > 1 ? 's' : ''} en 24 heures.`,
    });
  }

  const connection = connectionWords(record, isDeploymentFarm, withoutFarm);
  if (connection.problem) problems.push(connection.problem);

  const readExpected = !withoutFarm && (isDeploymentFarm || record.connection === 'linked');
  const otfRead = ageOf('morning-calculation', record.lastCompleteReadAt, context.now);
  if (readExpected) pushAgeProblem(problems, otfRead, 'Ouvre ta ferme jamais lu en entier.', 'Ouvre ta ferme pas lu en entier depuis le');

  const hasSpaces = record.spaces > 0;
  const weather = ageOf('weather-forecast', record.lastWeatherAt, context.now);
  if (hasSpaces) pushAgeProblem(problems, weather, 'Aucune météo automatique réussie.', 'Aucune météo automatique réussie depuis le');

  const morningExpected = hasSpaces && context.planningFarms.has(record.farmKey);
  const morning = ageOf('morning-calculation', record.lastMorningPlanAt, context.now);
  if (morningExpected) pushAgeProblem(problems, morning, 'Aucun calcul du matin.', 'Aucun calcul du matin depuis le');

  problems.sort((left, right) => TONE_RANK[right.tone] - TONE_RANK[left.tone]);
  const tone: FarmTone = problems[0]?.tone ?? 'ok';
  const line: FarmObservationLine = {
    farmKey: record.farmKey,
    title: withoutFarm
      ? 'Clé du déploiement, avant que sa ferme soit connue'
      : `Ferme n° ${record.farmKey}${isDeploymentFarm ? ', celle de la clé du déploiement' : ''}`,
    tone,
    state: TONE_WORDS[tone],
    verdict: problems.length === 0 ? null : problems.map((problem) => problem.text).join(' '),
    connection: connection.words,
    callsToday: callsTodayWords(record.callsToday),
    errors24h: errorWords(day),
    errors7d: errorWords(otfErrorRate(record.outcomes7d)),
    lastOtfRead: withoutFarm
      ? 'sans objet : seul l’appel qui fait connaître la ferme de la clé passe par ici'
      : momentWords(otfRead, readExpected ? 'aucune enregistrée' : 'aucune : la ferme n’est pas lue'),
    lastWeather: hasSpaces ? momentWords(weather, 'aucune enregistrée') : 'sans objet : aucun espace sur cette ferme',
    lastMorning: morningExpected
      ? momentWords(morning, 'aucun enregistré')
      : hasSpaces ? 'sans objet : le Planning n’est coché sur aucun de ses espaces' : 'sans objet : aucun espace sur cette ferme',
  };
  return { line, problems: problems.length };
}

function connectionWords(record: FarmObservationRecord, isDeploymentFarm: boolean, withoutFarm: boolean): { words: string; problem: Problem | null } {
  if (withoutFarm) return { words: 'Appels de la clé du déploiement avant que sa ferme soit connue.', problem: null };
  switch (record.connection) {
    case 'linked':
      return { words: 'Reliée à Ouvre ta ferme par sa personne.', problem: null };
    case 'reconnect-required':
      return {
        words: 'Révoquée par Ouvre ta ferme : sa personne doit la relier de nouveau.',
        problem: { tone: 'danger', text: 'Raccordement révoqué par Ouvre ta ferme.' },
      };
    case 'read-refused':
      return {
        words: 'Hors d’usage : Ouvre ta ferme refuse la lecture de cette ferme.',
        problem: { tone: 'danger', text: 'Lecture refusée par Ouvre ta ferme.' },
      };
    case null:
      return isDeploymentFarm
        ? { words: 'Lue avec la clé du déploiement.', problem: null }
        : { words: 'Pas reliée à Ouvre ta ferme : rien n’est lu pour elle.', problem: { tone: 'warn', text: 'Pas reliée à Ouvre ta ferme.' } };
  }
}

/** L'âge d'une dernière réussite, jugé avec les seuils d'une tâche du registre. */
function ageOf(task: TaskKey, at: string | null, now: Date): TaskState {
  return taskState(taskDeclaration(task), { ...EMPTY_TASK_RUN, lastSuccessAt: at }, now);
}

function pushAgeProblem(problems: Problem[], state: TaskState, never: string, since: string) {
  if (state.kind === 'ok') return;
  if (state.kind === 'never' || state.lastSuccessAt === null) {
    problems.push({ tone: 'warn', text: never });
    return;
  }
  problems.push({ tone: state.kind === 'broken' ? 'danger' : 'warn', text: `${since} ${parisMoment(state.lastSuccessAt)}.` });
}

function momentWords(state: TaskState, none: string): string {
  return state.lastSuccessAt === null ? none : `le ${parisMoment(state.lastSuccessAt)}`;
}

function callsTodayWords(calls: number): string {
  const counted = calls === 0 ? 'Aucun appel à Ouvre ta ferme aujourd’hui' : `${calls} appel${calls > 1 ? 's' : ''} à Ouvre ta ferme aujourd’hui`;
  return `${counted} ; la part du quota de la ferme laissée au module n’est pas encore fixée.`;
}

function errorWords(rate: OtfErrorRate): string {
  if (rate.calls === 0) return 'aucun appel';
  if (rate.errors === 0) return `aucune erreur sur ${rate.calls} appel${rate.calls > 1 ? 's' : ''}`;
  const percent = Math.round((rate.errors / rate.calls) * 100);
  return `${rate.errors} erreur${rate.errors > 1 ? 's' : ''} sur ${rate.calls} appel${rate.calls > 1 ? 's' : ''} (${percent} %) : ${rate.detail}`;
}
