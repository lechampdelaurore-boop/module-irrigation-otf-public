import { redirect } from 'next/navigation';
import { requireAuthenticatedUser } from '@/app/access-auth';
import { WELCOME_PATH } from '@/lib/domain/features/pages';
import { parseIrrigationWeek } from '@/lib/domain/irrigation-navigation';
import { getFeatureSelectionForUser } from '@/lib/services/feature-selection-service';
import type { IrrigationSearchParams } from './page-context';
import { LegacyRedirect } from './shell/legacy-redirect';
import './irrigation.css';

export const dynamic = 'force-dynamic';

/**
 * `/irrigation` (3.8, docs/feature-selection-contract.md, section 5) : il n'y
 * a plus de page unique ; l'adresse conduit à la page d'arrivée — « Aujourd'hui »
 * quand elle existe (audit ergonomique, lot 2, F1), sinon la première page
 * cochée —, et les anciennes adresses des notifications à la page qui porte
 * leur bloc (P14).
 */
export default async function IrrigationIndexPage({ searchParams }: { searchParams: IrrigationSearchParams }) {
  const params = await searchParams;
  const user = await requireAuthenticatedUser();
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
