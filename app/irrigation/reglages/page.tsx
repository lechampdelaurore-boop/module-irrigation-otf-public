import { usesPushNotifications } from '@/lib/domain/features/socle';
import { CropCoefficientsPanel } from '../crop-water/crop-coefficients-panel';
import { loadPageContext, type IrrigationSearchParams } from '../page-context';
import { loadReglagesPage } from '../page-loaders';
import { IrrigationShell } from '../shell/irrigation-shell';
import { UnavailableState } from '../shell/unavailable-state';
import { WaterManagementDashboard } from '../water-management-dashboard';
import { FeatureSettings } from './feature-settings';
import { NotificationSettings } from './notification-settings';
import { pageMetadata } from '../page-metadata';
import '../irrigation.css';

export const dynamic = 'force-dynamic';
export const metadata = pageMetadata('reglages');

/**
 * La page « Réglages » (3.8, docs/feature-selection-contract.md, section 3) :
 * la liste des cases, toujours, puis le socle que les cases cochées demandent :
 * le lieu de la météo (cases 3, 6, 7, 8, 9), les notifications du téléphone
 * (cases 2, 4, 8, 9) et la correspondance des espèces (cases 7, 9, P3).
 */
export default async function ReglagesPage({ searchParams }: { searchParams: IrrigationSearchParams }) {
  const context = await loadPageContext('reglages', searchParams);
  if (context.kind === 'unavailable') return <UnavailableState {...context.props} />;
  const { counts, waterDashboard, cropCoefficients } = await loadReglagesPage(context);
  context.logLoaded();
  return (
    <IrrigationShell {...context.shell}>
      <FeatureSettings selection={context.enabled} counts={counts} season={context.season} zone={context.zone} />
      {waterDashboard ? <WaterManagementDashboard season={context.season} snapshot={context.snapshot} initialDashboard={waterDashboard} part="reglages" /> : null}
      {usesPushNotifications(context.enabled) ? <NotificationSettings season={context.season} /> : null}
      {cropCoefficients ? <CropCoefficientsPanel season={context.season} initialView={cropCoefficients} part="especes" /> : null}
    </IrrigationShell>
  );
}
