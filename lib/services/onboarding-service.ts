import { readOnboardingStepsForUser } from '@/db/onboarding-repository';
import { resolveOnboarding, type ResolvedOnboarding } from '../domain/onboarding/steps.ts';
import { isDemoDeployment } from './deployment-mode.ts';

/**
 * L'accueil d'un espace, résolu (4.4, docs/tranche-4-contract.md, F417,
 * F426, F581). La démonstration n'a pas d'accueil : ses fermes fictives sont
 * déjà réglées, et aucune visite nouvelle n'est prévue en 4.4 (section 8).
 */
export async function getOnboardingForUser(spaceKey: string): Promise<ResolvedOnboarding> {
  if (isDemoDeployment()) return resolveOnboarding({ kind: 'demonstration' });
  return resolveOnboarding({ kind: 'stored', steps: await readOnboardingStepsForUser(spaceKey) });
}
