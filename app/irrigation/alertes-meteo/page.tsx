import { loadPageContext, type IrrigationSearchParams } from '../page-context';
import { loadWaterDashboardPage } from '../page-loaders';
import { IrrigationShell } from '../shell/irrigation-shell';
import { UnavailableState } from '../shell/unavailable-state';
import { WeatherAlertsPage } from '../pages/alerts-pages';
import { pageHref } from '@/lib/domain/features/pages';
import { pageMetadata } from '../page-metadata';
import '../irrigation.css';

export const dynamic = 'force-dynamic';
export const metadata = pageMetadata('alertes-meteo');

/** La page « Alertes météo » (3.8) : l'encart des alertes météo et leurs réglages. */
export default async function AlertesMeteoPage({ searchParams }: { searchParams: IrrigationSearchParams }) {
  const context = await loadPageContext('alertes-meteo', searchParams);
  if (context.kind === 'unavailable') return <UnavailableState {...context.props} />;
  const { waterDashboard } = await loadWaterDashboardPage(context, true);
  context.logLoaded();
  return (
    <IrrigationShell {...context.shell}>
      <WeatherAlertsPage
        season={context.season}
        initialDashboard={waterDashboard}
        demo={context.shell.demo}
        cropAlertsHref={context.enabled.includes('alertes-cultures') ? pageHref('alertes-cultures', { season: context.season }) : null}
      />
    </IrrigationShell>
  );
}
