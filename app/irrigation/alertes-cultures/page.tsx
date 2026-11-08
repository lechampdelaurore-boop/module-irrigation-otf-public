import { loadPageContext, type IrrigationSearchParams } from '../page-context';
import { loadWaterDashboardPage } from '../page-loaders';
import { IrrigationShell } from '../shell/irrigation-shell';
import { UnavailableState } from '../shell/unavailable-state';
import { CropAlertsPage } from '../pages/alerts-pages';
import { PartUnavailable } from '../shell/part-unavailable';
import { featurePart, isPartActive } from '@/lib/domain/features/socle';
import { pageMetadata } from '../page-metadata';
import '../irrigation.css';

export const dynamic = 'force-dynamic';
export const metadata = pageMetadata('alertes-cultures');

/** La page « Alertes cultures » (3.8) : gel selon la culture, arrêt d'arrosage avant récolte, aspersions à reconsidérer, microclimat. */
export default async function AlertesCulturesPage({ searchParams }: { searchParams: IrrigationSearchParams }) {
  const context = await loadPageContext('alertes-cultures', searchParams);
  if (context.kind === 'unavailable') return <UnavailableState {...context.props} />;
  const { waterDashboard } = await loadWaterDashboardPage(context, true);
  context.logLoaded();
  return (
    <IrrigationShell {...context.shell}>
      <CropAlertsPage
        season={context.season}
        initialDashboard={waterDashboard}
        sprinklerUnavailable={isPartActive(context.enabled, 'sprinkler-reconsideration')
          ? null
          : <PartUnavailable part={featurePart('sprinkler-reconsideration')} season={context.season} />}
      />
    </IrrigationShell>
  );
}
