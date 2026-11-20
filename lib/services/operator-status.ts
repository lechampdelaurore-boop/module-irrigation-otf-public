import { readLatestOperatorNotice } from '@/db/operator-repository';
import { farmSpaceOf } from '../domain/farm-space';
import { operatorStatusView, type OperatorStatusView } from '../domain/operations/operator-status-view';
import { isDemoDeployment } from './deployment-mode';
import { knownDeploymentFarm } from './farm-identity-service';
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

export async function readOperatorStatus(now = new Date()): Promise<OperatorStatusView> {
  const [tasks, latestNotice] = await Promise.all([readTaskStates(now), readLatestOperatorNotice()]);
  return operatorStatusView(tasks, latestNotice);
}
