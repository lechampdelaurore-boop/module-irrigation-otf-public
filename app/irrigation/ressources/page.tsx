import { loadPageContext, type IrrigationSearchParams } from '../page-context';
import { loadRessourcesPage } from '../page-loaders';
import { IrrigationShell } from '../shell/irrigation-shell';
import { UnavailableState } from '../shell/unavailable-state';
import { IrrigationFeasibilityDashboardView } from '../irrigation-feasibility-dashboard';
import { PumpManager } from '../pump-manager';
import { WaterResourceManager } from '../water-resource-manager';
import { featurePart, isPartActive } from '@/lib/domain/features/socle';
import { PartUnavailable } from '../shell/part-unavailable';
import { pageMetadata } from '../page-metadata';

import '../irrigation.css';
import { renderOncePerRequest } from '../render-once';

export const dynamic = 'force-dynamic';
export const metadata = pageMetadata('ressources');

/** La page « Ressources et pompes » (3.8) : ressources en eau, relevés et débit, pompes, puis la faisabilité et la répartition en cas de manque. */
async function computeRessourcesPage({ searchParams }: { searchParams: IrrigationSearchParams }) {
  const context = await loadPageContext('ressources', searchParams);
  if (context.kind === 'unavailable') return <UnavailableState {...context.props} />;
  const { equipment, irrigationEvents, waterResourceDashboard, pumpDashboard, decisionPending } = await loadRessourcesPage(context);
  context.logLoaded();
  const feasibility = isPartActive(context.enabled, 'feasibility')
    ? <IrrigationFeasibilityDashboardView season={context.season} />
    : <PartUnavailable part={featurePart('feasibility')} season={context.season} />;
  // Tant qu'une répartition attend, la faisabilité passe en tête de page (audit final, lot B, R4, F248).
  const first = decisionPending && isPartActive(context.enabled, 'feasibility');
  return (
    <IrrigationShell {...context.shell}>
      {first ? feasibility : null}
      {/* Les liaisons et les pompes dans le pli « Réglages de cette page », en bas, après la faisabilité (audit final, lot D, J2, F305). */}
      <WaterResourceManager
        season={context.season}
        initialNowIso={context.nowIso}
        initialDashboard={waterResourceDashboard}
        after={first ? null : feasibility}
        settings={<PumpManager equipment={equipment} events={irrigationEvents} initialDashboard={pumpDashboard} />}
      />
    </IrrigationShell>
  );
}

const computeRessourcesPageOnce = renderOncePerRequest(computeRessourcesPage);

// Une fonction exportée telle quelle : le greffon RSC y accroche les styles de la page.
export default async function RessourcesPage(props: Parameters<typeof computeRessourcesPage>[0]) {
  return computeRessourcesPageOnce(props);
}
