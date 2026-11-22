import { readDeploymentFarm, saveDeploymentFarm } from '@/db/otf-deployment-farm-repository';
import { readLatestCachedSnapshot } from '@/db/snapshot-cache';
import { attachPendingWorkspace, findWorkspaceIdForUser } from '@/db/workspace-repository';
import { logJsonLine } from '@/lib/adapters/log';
import { mockSnapshot } from '@/lib/adapters/mock-data';
import { farmSpaceKey } from '@/lib/domain/farm-space';
import { OtfApiError } from '@/lib/domain/otf/api-contract';
import { farmIdentityShape, otfFarmIdentity, snapshotFarmIdentity } from '@/lib/domain/otf/farm-identity';
import { readLatestCachedSnapshotOfSpace } from './irrigation-service';
import { createOtfReadClient, readOtfDataSource } from './otf-connection';
import { DEPLOYMENT_KEY_UNKNOWN_FARM_PACE, sharedPaceForLoneCalls } from './otf-farm-read';

/**
 * La ferme de la personne connectée (4.1, docs/tranche-4-contract.md, F327,
 * F330, F331, F339 à F341). Avant la 4.3, c'est la ferme de la clé du
 * déploiement ; la connexion en tire la clé d'espace, jamais du navigateur,
 * après avoir rattaché à sa ferme l'espace d'avant la 4.1 de la personne.
 */

/**
 * La ferme de la clé ne peut pas être établie : rien n'est montré (F341). La
 * connexion y joint le nom de la personne, pour la page qui le lui dit.
 */
export class FarmIdentityUnavailableError extends Error {
  readonly displayName: string | null;

  constructor(displayName: string | null = null) {
    super('Ouvre ta ferme n’a pas dit à quelle ferme mène la clé de ce module.');
    this.name = 'FarmIdentityUnavailableError';
    this.displayName = displayName;
  }
}

export type FarmIdentityDependencies = {
  dataSource: () => 'mock' | 'live';
  /** La réponse de `GET /me` pour la clé du déploiement. */
  readOtfMe: () => Promise<unknown>;
  now: () => Date;
};

const defaultDependencies: FarmIdentityDependencies = {
  dataSource: readOtfDataSource,
  // La ferme n'est pas encore connue : ce seul appel se compte à part (F381).
  readOtfMe: () => createOtfReadClient({ sharedPace: sharedPaceForLoneCalls(DEPLOYMENT_KEY_UNKNOWN_FARM_PACE) }).getCurrentStructures(),
  now: () => new Date(),
};

/**
 * La ferme du déploiement (F339) : celle qui est gardée ; sans elle, celle du
 * dernier instantané en cache, si elle est lisible ; sinon un appel à
 * `GET /me`. Avec les données fictives, la ferme fictive, sans rien écrire.
 * `null` si aucune ne peut être établie.
 */
export async function resolveDeploymentFarm(dependencies = defaultDependencies): Promise<string | null> {
  if (dependencies.dataSource() !== 'live') return mockSnapshot.structure.id;
  const kept = await readDeploymentFarm();
  if (kept) return kept.otfFarmId;

  const latest = await readLatestCachedSnapshot();
  const cachedFarm = latest ? snapshotFarmIdentity(latest) : null;
  if (latest && cachedFarm) {
    await saveDeploymentFarm(cachedFarm, latest.lastSuccessfulReadAt);
    return cachedFarm;
  }

  let me: unknown;
  try {
    me = await dependencies.readOtfMe();
  } catch (error) {
    // Le message d'une erreur du connecteur est écrit par le module ; d'une autre erreur, seule sa classe (F617).
    logJsonLine('warn', { event: 'otf_farm_identity_unreadable', ...(error instanceof OtfApiError ? { message: error.message } : { errorClass: error instanceof Error ? error.name : 'inconnue' }) });
    return null;
  }
  const observedFarm = otfFarmIdentity(me);
  if (observedFarm === null) {
    // La forme seule, jamais l'identifiant : de quoi comprendre un refus (F341).
    logJsonLine('warn', { event: 'otf_farm_identity_missing', ...farmIdentityShape(me) });
    return null;
  }
  await saveDeploymentFarm(observedFarm, dependencies.now().toISOString());
  return observedFarm;
}

/**
 * La ferme du déploiement déjà établie, sans rien appeler ni écrire (4.5,
 * F608) : la veille de l'exploitant et sa page la lisent, et la 4.5 n'ajoute
 * aucun appel à OTF. Avec les données fictives, la ferme fictive.
 */
export async function knownDeploymentFarm(dataSource: () => 'mock' | 'live' = readOtfDataSource): Promise<string | null> {
  if (dataSource() !== 'live') return mockSnapshot.structure.id;
  return (await readDeploymentFarm())?.otfFarmId ?? null;
}

/**
 * La clé d'espace de la personne (F327) : sa personne et la ferme du
 * déploiement. Avant de la rendre, son espace d'avant la 4.1, s'il existe,
 * reçoit la ferme d'où viennent ses données : celle de son dernier
 * instantané en cache, sinon celle du déploiement (F331, F340).
 */
export async function resolveSpaceKey(personId: string, dependencies = defaultDependencies): Promise<string> {
  const deploymentFarm = await resolveDeploymentFarm(dependencies);
  if (deploymentFarm === null) throw new FarmIdentityUnavailableError();
  if (await findWorkspaceIdForUser(personId)) {
    const evidence = dependencies.dataSource() === 'live' ? await readLatestCachedSnapshotOfSpace(personId) : null;
    const farmOfData = (evidence ? snapshotFarmIdentity(evidence) : null) ?? deploymentFarm;
    if (await attachPendingWorkspace(personId, farmOfData)) {
      // Des faits seulement, jamais l'identifiant de la personne ni de la ferme.
      logJsonLine('info', { event: 'irrigation_workspace_attached', sameFarmAsKey: farmOfData === deploymentFarm, fromCache: evidence !== null });
    }
  }
  return farmSpaceKey(personId, deploymentFarm);
}
