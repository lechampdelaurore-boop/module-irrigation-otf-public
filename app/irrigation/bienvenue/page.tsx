import { redirect } from 'next/navigation';
import { requireAuthenticatedUser, signOutPath } from '@/app/access-auth';
import { landingPage, pageHref } from '@/lib/domain/features/pages';
import { getFeatureSelectionForUser } from '@/lib/services/feature-selection-service';
import { isDemoDeployment } from '@/lib/services/deployment-mode';
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
  const user = await requireAuthenticatedUser();
  const selection = await getFeatureSelectionForUser(user.userId);
  if (!selection.firstVisit) redirect(pageHref(landingPage(selection.enabled)));
  return <WelcomeChoice userName={user.displayName} signOutPath={signOutPath()} demo={isDemoDeployment()} />;
}
