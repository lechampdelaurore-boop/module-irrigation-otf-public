import { readFarmObservations } from '@/db/farm-observation-repository';
import { readLatestOperatorNotice } from '@/db/operator-repository';
import { readTaskRuns, recordTaskRun } from '@/db/task-run-repository';
import { logJsonLine } from '../adapters/log';
import { farmSpaceOf } from '../domain/farm-space';
import { farmObservationLines } from '../domain/operations/farm-observation';
import { gestureDates, gestureDecision, gestureRecordedMessage, OPERATOR_GESTURES, type GestureTask } from '../domain/operations/operator-gesture';
import { operatorStatusView, type OperatorStatusView } from '../domain/operations/operator-status-view';
import { outcomeHourStartMs } from '../domain/otf/call-outcome';
import { parisDayOf } from '../domain/otf/shared-call-pace';
import { HOURS_PER_DAY, millisecondsFromHours } from '../domain/units';
import { isDemoDeployment } from './deployment-mode';
import { knownDeploymentFarm } from './farm-identity-service';
import { listFarmsWithFeature } from './feature-selection-service';
import { DEPLOYMENT_KEY_UNKNOWN_FARM_PACE } from './otf-farm-read';
import { readTaskStates } from './task-runs';

/**
 * La page d'état de l'exploitant (4.5, PR 2 ; docs/tranche-4-contract.md,
 * F565, F608, F612) : réservée à l'exploitant, le droit se lisant côté
 * serveur, jamais depuis le navigateur.
 */

/**
 * L'exploitant, c'est une personne dont l'espace est sur la ferme du
 * déploiement (F608). Jamais en démonstration, dont les espaces n'ont pas de
 * ferme ; aucun appel à OTF : la ferme du déploiement est celle déjà établie.
 */
export async function isOperator(spaceKey: string, deploymentFarm = knownDeploymentFarm): Promise<boolean> {
  if (isDemoDeployment()) return false;
  const { otfFarmId } = farmSpaceOf(spaceKey);
  if (otfFarmId === null) return false;
  return otfFarmId === await deploymentFarm();
}

/**
 * Ce que montre la page : les tâches du registre, la dernière notification
 * de la veille et chaque ferme (F616). Les erreurs d'OTF se comptent par
 * heure pleine : « 24 heures », c'est l'heure en cours et les 23 d'avant.
 */
export async function readOperatorStatus(now = new Date(), deploymentFarm = knownDeploymentFarm): Promise<OperatorStatusView> {
  const hourStartMs = outcomeHourStartMs(now.getTime());
  const [tasks, latestNotice, records, farm, planning] = await Promise.all([
    readTaskStates(now),
    readLatestOperatorNotice(),
    readFarmObservations({
      parisDay: parisDayOf(now.getTime()),
      dayStartMs: hourStartMs - millisecondsFromHours(HOURS_PER_DAY - 1),
      weekStartMs: hourStartMs - millisecondsFromHours(7 * HOURS_PER_DAY - 1),
    }),
    deploymentFarm(),
    listFarmsWithFeature('planning'),
  ]);
  const planningFarms = new Set(planning.flatMap(({ ownerUserId }) => farmSpaceOf(ownerUserId).otfFarmId ?? []));
  const farms = farmObservationLines(records, { now, deploymentFarm: farm, unknownFarmKey: DEPLOYMENT_KEY_UNKNOWN_FARM_PACE, planningFarms });
  return operatorStatusView(tasks, latestNotice, farms, gestureDates(now));
}

/**
 * Les gestes « J'ai fait l'export du … » et « J'ai fait l'essai du … »
 * (10 bis.14, F625 ; 10 bis.16, F637) : le jour noté devient la dernière
 * réussite de la tâche du registre, sans jamais reculer. L'appelant a vérifié
 * que la personne est l'exploitant. Le journal ne dit que le jour.
 */
export async function recordOperatorGesture(task: GestureTask, day: unknown, now = new Date(), log = logJsonLine): Promise<{ ok: boolean; message: string }> {
  const runs = await readTaskRuns([task]);
  const decision = gestureDecision(task, day, now, runs.get(task)?.lastSuccessAt ?? null);
  if (!decision.ok) return decision;
  await recordTaskRun({ task, at: decision.at, successful: true, error: null });
  log('info', { event: OPERATOR_GESTURES[task].recordedEvent, day: decision.day });
  return { ok: true, message: gestureRecordedMessage(task, decision.day) };
}
