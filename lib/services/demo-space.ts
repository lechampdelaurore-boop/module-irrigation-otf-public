import type { DemoChoice } from '../domain/demo/catalogue.ts';
import { saveFeatureSelectionForUser } from '@/db/feature-selection-repository';
import { findWorkspaceIdForUser } from '@/db/workspace-repository';
import { isDemoDeployment } from './deployment-mode.ts';

/**
 * L'espace d'un invité de la démonstration, pour une ferme fictive et un
 * moment (docs/demo-guided-contract.md, sections 5 et 6) : créé à sa première
 * ouverture avec les cases que la ferme coche d'avance. La ferme vierge
 * n'a pas d'espace tant que l'invité n'a rien coché : c'est ainsi qu'une
 * ferme qui n'a jamais ouvert le module arrive sur la liste à cocher (R5). Le plan de la ferme
 * vient de `lib/adapters/demo/farms.ts`, la météo du fournisseur de la
 * démonstration. Refusé hors démonstration : le module en production n'a
 * aucun peuplement.
 */
export async function prepareDemoSpace(ownerUserId: string, choice: DemoChoice): Promise<void> {
  if (!isDemoDeployment()) throw new Error('Un espace de démonstration ne se prépare qu’en démonstration.');
  if (choice.profile.features.length === 0) return;
  if (await findWorkspaceIdForUser(ownerUserId)) return;
  await saveFeatureSelectionForUser(ownerUserId, choice.profile.features, new Date());
}
