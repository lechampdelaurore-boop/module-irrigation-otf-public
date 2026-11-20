import { readFarmObservations } from '@/db/farm-observation-repository';
import { readLatestOperatorNotice } from '@/db/operator-repository';
import { readTaskRuns, recordTaskRun } from '@/db/task-run-repository';
import { logJsonLine } from '../adapters/log';
import { farmSpaceOf } from '../domain/farm-space';
import { farmObservationLines } from '../domain/operations/farm-observation';
import { offsiteExportDates, offsiteExportDecision, frenchDay } from '../domain/operations/offsite-export';
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
  return operatorStatusView(tasks, latestNotice, farms, offsiteExportDates(now));
}

/**
 * Le geste « J'ai fait l'export du … » (10 bis.9 ; 10 bis.14, F625) : le
 * jour noté devient la dernière réussite de la tâche « Export hors
 * Cloudflare », sans jamais reculer. L'appelant a vérifié que la personne
 * est l'exploitant.
 */
export async function recordOffsiteExport(day: unknown, now = new Date(), log = logJsonLine): Promise<{ ok: boolean; message: string }> {
  const runs = await readTaskRuns(['offsite-export']);
  const decision = offsiteExportDecision(day, now, runs.get('offsite-export')?.lastSuccessAt ?? null);
  if (!decision.ok) return decision;
  await recordTaskRun({ task: 'offsite-export', at: decision.at, successful: true, error: null });
  log('info', { event: 'offsite_export_recorded', day: decision.day });
  return { ok: true, message: `L’export du ${frenchDay(decision.day)} est noté.` };
}
