import { db } from './binding';
import { findWorkspaceIdForUser } from './workspace-repository';
import type { StoredOnboardingStep } from '@/lib/domain/onboarding/steps';

/**
 * L'état de l'accueil d'un espace (4.4, docs/tranche-4-contract.md, F417,
 * F581). Ce dépôt n'interprète rien : il rend les lignes de l'espace, lues
 * par sa clé (la personne et la ferme ensemble), et le domaine
 * (`resolveOnboarding`) en tire chaque étape. Lire ne crée rien : une
 * personne sans espace n'a encore rien confirmé.
 */
export async function readOnboardingStepsForUser(spaceKey: string): Promise<StoredOnboardingStep[]> {
  const workspaceId = await findWorkspaceIdForUser(spaceKey);
  if (workspaceId === null) return [];
  const result = await db.prepare(
    `SELECT step, state, origin, confirmed_at
     FROM irrigation_onboarding_steps WHERE workspace_id = ? ORDER BY step`,
  ).bind(workspaceId).all<{ step: string; state: string; origin: string; confirmed_at: string | null }>();
  return result.results.map((row) => ({ step: row.step, state: row.state, origin: row.origin, confirmedAt: row.confirmed_at }));
}
