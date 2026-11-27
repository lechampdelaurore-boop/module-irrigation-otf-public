import { redirect } from 'next/navigation';
import { requireAuthenticatedUser, signOutPath, type AuthenticatedUser } from '@/app/access-auth';
import { landingPage, pageHref } from '@/lib/domain/features/pages';
import { todaySeason } from '@/lib/domain/today/today-view';
import { getFeatureSelectionForUser } from '@/lib/services/feature-selection-service';
import { accessRefusedState } from '../page-context';
import { UnavailableState } from '../shell/unavailable-state';
import { isDemoDeployment } from '@/lib/services/deployment-mode';
import { demoSelectionOfOwner } from '@/lib/domain/demo/catalogue';
import { WelcomeChoice } from './welcome-choice';
import { WELCOME_TITLE } from '../page-metadata';
import '../irrigation.css';
import { renderOncePerRequest } from '../render-once';

export const dynamic = 'force-dynamic';
export const metadata = { title: WELCOME_TITLE };

/**
 * La première ouverture (docs/feature-selection-contract.md, R5, changée par
 * le lot S6 de la simplification, docs/simplification-s6-contract.md,
 * section 3) : trois façons de commencer, ou la liste des cases, rien choisi
 * d'avance, avant toute autre page et avant toute lecture d'Ouvre ta ferme.
 * Une ferme qui a déjà ouvert le module va à sa page d'arrivée ; elle change
 * son choix dans Réglages.
 */
async function computeBienvenuePage() {
  let user: AuthenticatedUser;
  try {
    user = await requireAuthenticatedUser();
  } catch (error) {
    // La ferme de la clé n'est pas établie (F341), la démonstration se prépare
    // (lot I, n° 11, F450) ou l'espace est figé par une demande d'effacement
    // (F666) : la page le dit, sans rien lire d'autre.
    const refused = accessRefusedState('aujourdhui', todaySeason(new Date()), error);
    if (refused) return <UnavailableState {...refused} />;
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

const computeBienvenuePageOnce = renderOncePerRequest(computeBienvenuePage);

// Une fonction exportée telle quelle : le greffon RSC y accroche les styles de la page.
export default async function BienvenuePage() {
  return computeBienvenuePageOnce(undefined);
}
