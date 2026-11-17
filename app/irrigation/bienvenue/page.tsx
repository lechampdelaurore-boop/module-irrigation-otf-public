import { redirect } from 'next/navigation';
import { requireAuthenticatedUser, signOutPath, type AuthenticatedUser } from '@/app/access-auth';
import { landingPage, pageHref } from '@/lib/domain/features/pages';
import { todaySeason } from '@/lib/domain/today/today-view';
import { FarmIdentityUnavailableError } from '@/lib/services/farm-identity-service';
import { getFeatureSelectionForUser } from '@/lib/services/feature-selection-service';
import { farmUnidentifiedState } from '../page-context';
import { UnavailableState } from '../shell/unavailable-state';
import { isDemoDeployment } from '@/lib/services/deployment-mode';
import { demoSelectionOfOwner } from '@/lib/domain/demo/catalogue';
import { WelcomeChoice } from './welcome-choice';
import { WELCOME_TITLE } from '../page-metadata';
import '../irrigation.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: WELCOME_TITLE };

/**
 * La première ouverture (docs/feature-selection-contract.md, R5) : la liste
 * des cases, rien coché d'avance, avant toute autre page et avant toute
 * lecture d'Ouvre ta ferme. Une ferme qui a déjà ouvert le module va à sa
 * page d'arrivée ; elle change son choix dans Réglages.
 */
export default async function BienvenuePage() {
  let user: AuthenticatedUser;
  try {
    user = await requireAuthenticatedUser();
  } catch (error) {
    // La ferme de la clé n'est pas établie : rien n'est montré (F341).
    if (error instanceof FarmIdentityUnavailableError) return <UnavailableState {...farmUnidentifiedState('aujourdhui', todaySeason(new Date()), error)} />;
    throw error;
  }
  const selection = await getFeatureSelectionForUser(user.userId);
  if (!selection.firstVisit) redirect(pageHref(landingPage(selection.enabled)));
  return <WelcomeChoice
    userName={user.displayName}
    signOutPath={signOutPath()}
    demo={isDemoDeployment()}
    demoSelection={isDemoDeployment() ? demoSelectionOfOwner(user.userId) : null}
  />;
}
