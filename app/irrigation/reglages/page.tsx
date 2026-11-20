import { DEMO_PUSH_NOTICE } from '@/lib/domain/demo/deployment-mode';
import { usesPushNotifications } from '@/lib/domain/features/socle';
import { CropCoefficientsPanel } from '../crop-water/crop-coefficients-panel';
import { loadPageContext, type IrrigationSearchParams } from '../page-context';
import { loadReglagesPage } from '../page-loaders';
import { IrrigationShell } from '../shell/irrigation-shell';
import { UnavailableState } from '../shell/unavailable-state';
import { WaterManagementDashboard } from '../water-management-dashboard';
import { FeatureSettings } from './feature-settings';
import { NotificationSettings } from './notification-settings';
import { OnboardingSettings } from './onboarding-settings';
import { pageMetadata } from '../page-metadata';
import '../irrigation.css';

export const dynamic = 'force-dynamic';
export const metadata = pageMetadata('reglages');

/**
 * La page « Réglages » (3.8, docs/feature-selection-contract.md, section 3) :
 * la liste des cases, toujours, puis le socle que les cases cochées demandent :
 * le lieu de la météo (cases 3, 6, 7, 8, 9), les notifications du téléphone
 * (cases 2, 4, 8, 9) et la correspondance des espèces (cases 7, 9, P3) ;
 * enfin, l'accueil de la ferme (4.4, F581), replié.
 */
export default async function ReglagesPage({ searchParams }: { searchParams: IrrigationSearchParams }) {
  const context = await loadPageContext('reglages', searchParams);
  if (context.kind === 'unavailable') return <UnavailableState {...context.props} />;
  const { counts, onboarding, waterDashboard, cropCoefficients } = await loadReglagesPage(context);
  context.logLoaded();
  return (
    <IrrigationShell {...context.shell}>
      <FeatureSettings selection={context.enabled} counts={counts} season={context.season} zone={context.zone} />
      {waterDashboard ? <WaterManagementDashboard season={context.season} snapshot={context.snapshot} initialDashboard={waterDashboard} part="reglages" /> : null}
      {usesPushNotifications(context.enabled)
        ? context.shell.demo ? <DemoNotificationSettings /> : <NotificationSettings season={context.season} />
        : null}
      {cropCoefficients ? <CropCoefficientsPanel season={context.season} initialView={cropCoefficients} part="especes" /> : null}
      <OnboardingSettings onboarding={onboarding} locationHere={waterDashboard !== null} />
    </IrrigationShell>
  );
}

/**
 * En démonstration, la ligne qui dit les notifications coupées se lit sous
 * le titre de leur section, à la place de leurs réglages, et non plus seule
 * entre deux encarts (audit du 19 novembre 2026, lot I, n° 25, F455).
 */
function DemoNotificationSettings() {
  return (
    <section className="water-management-section" aria-labelledby="notifications-title">
      <header className="water-management-heading">
        <div>
          <h2 id="notifications-title">Notifications du téléphone</h2>
        </div>
      </header>
      <p className="demo-push-notice" role="note">{DEMO_PUSH_NOTICE}</p>
    </section>
  );
}
