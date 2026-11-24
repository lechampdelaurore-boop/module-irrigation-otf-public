import { redirect } from 'next/navigation';
import { requireAuthenticatedUser, type AuthenticatedUser } from '@/app/access-auth';
import { WELCOME_PATH } from '@/lib/domain/features/pages';
import { parseIrrigationWeek } from '@/lib/domain/irrigation-navigation';
import { todaySeason } from '@/lib/domain/today/today-view';
import { getFeatureSelectionForUser } from '@/lib/services/feature-selection-service';
import { accessRefusedState, type IrrigationSearchParams } from './page-context';
import { LegacyRedirect } from './shell/legacy-redirect';
import { UnavailableState } from './shell/unavailable-state';
import './irrigation.css';
import { renderOncePerRequest } from './render-once';

export const dynamic = 'force-dynamic';

/**
 * `/irrigation` (3.8, docs/feature-selection-contract.md, section 5) : il n'y
 * a plus de page unique ; l'adresse conduit à la page d'arrivée — « Aujourd'hui »
 * quand elle existe (audit ergonomique, lot 2, F1), sinon la première page
 * cochée —, et les anciennes adresses des notifications à la page qui porte
 * leur bloc (P14).
 */
async function IrrigationIndexPage({ searchParams }: { searchParams: IrrigationSearchParams }) {
  const params = await searchParams;
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
  // Une ferme qui n'a jamais ouvert le module choisit d'abord ses cases (R5).
  if (selection.firstVisit) redirect(WELCOME_PATH);
  const season = typeof params.season === 'string' && /^\d{4}$/.test(params.season) ? Number(params.season) : null;
  return (
    <LegacyRedirect
      enabled={selection.enabled}
      season={season}
      week={typeof params.week === 'string' ? parseIrrigationWeek(params.week) : null}
      refresh={params.refresh === '1'}
    />
  );
}

export default renderOncePerRequest(IrrigationIndexPage);
