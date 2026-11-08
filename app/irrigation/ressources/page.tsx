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

export const dynamic = 'force-dynamic';
export const metadata = pageMetadata('ressources');

/** La page « Ressources et pompes » (3.8) : ressources en eau, relevés et débit, pompes, puis la faisabilité et la répartition en cas de manque. */
export default async function RessourcesPage({ searchParams }: { searchParams: IrrigationSearchParams }) {
  const context = await loadPageContext('ressources', searchParams);
  if (context.kind === 'unavailable') return <UnavailableState {...context.props} />;
  const { equipment, irrigationEvents, waterResourceDashboard, pumpDashboard } = await loadRessourcesPage(context);
  context.logLoaded();
  return (
    <IrrigationShell {...context.shell}>
      <WaterResourceManager season={context.season} initialNowIso={context.nowIso} initialDashboard={waterResourceDashboard} />
      <PumpManager equipment={equipment} events={irrigationEvents} initialDashboard={pumpDashboard} />
      {isPartActive(context.enabled, 'feasibility')
        ? <IrrigationFeasibilityDashboardView season={context.season} />
        : <PartUnavailable part={featurePart('feasibility')} season={context.season} />}
    </IrrigationShell>
  );
}
