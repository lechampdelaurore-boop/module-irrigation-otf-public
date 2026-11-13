import { archiveDemoWorkspace, archiveInactiveDemoWorkspaces, touchDemoWorkspace } from '@/db/demo-space-repository';
import { demoChoiceOfOwner } from '../domain/demo/catalogue.ts';
import { isDemoDeployment } from './deployment-mode.ts';
import { prepareDemoSpace } from './demo-space.ts';

/**
 * La remise à zéro de la démonstration (docs/demo-guided-contract.md,
 * section 8 ; D4) : le bouton de la bannière remet l'espace de l'invité, pour
 * la ferme et le moment ouverts, dans l'état de sa première ouverture ; la
 * tâche de nuit fait de même pour chaque espace où personne n'est passé
 * depuis plus de 24 heures. Refusée hors démonstration, et pour une identité
 * qui n'est pas celle d'un espace de démonstration : la production n'a rien
 * à remettre à zéro.
 */

export class DemoResetRefusedError extends Error {
  constructor() {
    super('La remise à zéro ne sert que la démonstration.');
    this.name = 'DemoResetRefusedError';
  }
}

/**
 * Remet à zéro l'espace de cet invité et le prépare aussitôt, pour que la
 * page rouverte montre la ferme fictive telle qu'au premier jour.
 */
export async function resetDemoSpace(ownerUserId: string, now: Date = new Date()): Promise<void> {
  const choice = demoChoiceOfOwner(ownerUserId);
  if (!isDemoDeployment() || choice === null) throw new DemoResetRefusedError();
  await archiveDemoWorkspace(ownerUserId, archiveStamp(now));
  await prepareDemoSpace(ownerUserId, choice);
}

/** Le passage de l'invité, pour la tâche de nuit ; rien hors démonstration. */
export async function recordDemoVisit(ownerUserId: string): Promise<void> {
  if (!isDemoDeployment() || demoChoiceOfOwner(ownerUserId) === null) return;
  await touchDemoWorkspace(ownerUserId);
}

/** La tâche de nuit : le nombre d'espaces remis à zéro. */
export async function resetInactiveDemoSpaces(now: Date = new Date()): Promise<number> {
  if (!isDemoDeployment()) throw new DemoResetRefusedError();
  return archiveInactiveDemoWorkspaces(archiveStamp(now));
}

/**
 * La marque d'un espace mis de côté : l'heure, et un suffixe tiré au hasard.
 * Dans le Worker de démonstration, `Date` suit le jour simulé de l'invité :
 * deux remises à zéro du même espace restent distinctes, même au même jour.
 */
function archiveStamp(now: Date): string {
  return `${now.toISOString()}-${crypto.randomUUID().slice(0, 8)}`;
}
