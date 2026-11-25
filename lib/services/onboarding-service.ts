import { readOnboardingStepsForUser } from '@/db/onboarding-repository';
import { rememberedRead } from '@/db/request-memo';
import { resolveOnboarding, type ResolvedOnboarding } from '../domain/onboarding/steps.ts';
import { isDemoDeployment } from './deployment-mode.ts';

/**
 * L'accueil d'un espace, résolu (4.4, docs/tranche-4-contract.md, F417,
 * F426, F581). La démonstration n'a pas d'accueil : ses fermes fictives sont
 * déjà réglées, et aucune visite nouvelle n'est prévue en 4.4 (section 8).
 * Lu une fois par requête (section 5 sexies) : une page le demande à chaque
 * service qui lit la météo, jusqu'à douze fois pour « Aujourd'hui ».
 */
export async function getOnboardingForUser(spaceKey: string): Promise<ResolvedOnboarding> {
  if (isDemoDeployment()) return resolveOnboarding({ kind: 'demonstration' });
  return rememberedRead('onboarding', [spaceKey], async () => resolveOnboarding({ kind: 'stored', steps: await readOnboardingStepsForUser(spaceKey) }));
}
