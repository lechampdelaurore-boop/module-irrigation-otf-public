import { loadPageContext, type IrrigationSearchParams } from '../page-context';
import { loadBesoinsPage } from '../page-loaders';
import { IrrigationShell } from '../shell/irrigation-shell';
import { UnavailableState } from '../shell/unavailable-state';
import { IrrigationNeedsDashboardView } from '../irrigation-needs-dashboard';
import { WaterManagementDashboard } from '../water-management-dashboard';
import { pageMetadata } from '../page-metadata';
import '../irrigation.css';
import { renderOncePerRequest } from '../render-once';

export const dynamic = 'force-dynamic';
export const metadata = pageMetadata('besoins');

/** La page « Objectifs et besoins » (3.8) : objectifs, météo de la semaine, pluie mesurée, tableau des jours, puis les besoins et priorités par planche. */
async function computeBesoinsPage({ searchParams }: { searchParams: IrrigationSearchParams }) {
  const context = await loadPageContext('besoins', searchParams);
  if (context.kind === 'unavailable') return <UnavailableState {...context.props} />;
  const { waterDashboard, irrigationNeeds } = await loadBesoinsPage(context);
  context.logLoaded();
  return (
    <IrrigationShell {...context.shell}>
      <WaterManagementDashboard season={context.season} snapshot={context.snapshot} initialDashboard={waterDashboard} initialFarmObjective={{ weekStart: irrigationNeeds.weekStart, objective: irrigationNeeds.farmObjective }} />
      <IrrigationNeedsDashboardView season={context.season} initialDashboard={irrigationNeeds} showProposals={context.enabled.includes('cultures')} />
    </IrrigationShell>
  );
}

const computeBesoinsPageOnce = renderOncePerRequest(computeBesoinsPage);

// Une fonction exportée telle quelle : le greffon RSC y accroche les styles de la page.
export default async function BesoinsPage(props: Parameters<typeof computeBesoinsPage>[0]) {
  return computeBesoinsPageOnce(props);
}
