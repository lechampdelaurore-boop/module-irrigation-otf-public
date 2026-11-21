import { DEMO_PUSH_NOTICE } from '@/lib/domain/demo/deployment-mode';
import { usesPushNotifications } from '@/lib/domain/features/socle';
import { pageHref } from '@/lib/domain/features/pages';
import { CropCoefficientsPanel } from '../crop-water/crop-coefficients-panel';
import { loadPageContext, type IrrigationSearchParams } from '../page-context';
import { loadReglagesPage } from '../page-loaders';
import { IrrigationShell } from '../shell/irrigation-shell';
import { UnavailableState } from '../shell/unavailable-state';
import { WaterManagementDashboard } from '../water-management-dashboard';
import { FeatureSettings } from './feature-settings';
import { NotificationSettings } from './notification-settings';
import { OnboardingSettings } from './onboarding-settings';
import { SettingsReviewSection } from './settings-review';
import { remainingUnknowns, settingsGroupsText } from '@/lib/domain/onboarding/verification';
import { SPECIES_FOLD_ANCHOR, speciesNeedsLink } from '@/lib/domain/crop-water/species-linking';
import { PlotShelterSettings } from './plot-shelter-settings';
import { pageMetadata } from '../page-metadata';
import '../irrigation.css';

export const dynamic = 'force-dynamic';
export const metadata = pageMetadata('reglages');

/**
 * La page « Réglages » (3.8, docs/feature-selection-contract.md, section 3) :
 * la liste des cases, toujours, puis le socle que les cases cochées demandent :
 * le lieu de la météo (cases 3, 6, 7, 8, 9), les notifications du téléphone
 * (cases 2, 4, 8, 9) et la correspondance des espèces (cases 7, 9, P3) ;
 * le classement des jardins d'une ferme qui fait l'accueil (4.4, F583) ;
 * l'étape « Rattachez vos espèces » d'une ferme qui fait l'accueil, en tête
 * de la correspondance des espèces (4.4, F587) ; « Réglages à relire »
 * (4.4, F588) ; enfin, l'accueil de la
 * ferme (4.4, F581), replié.
 */
export default async function ReglagesPage({ searchParams }: { searchParams: IrrigationSearchParams }) {
  const context = await loadPageContext('reglages', searchParams);
  if (context.kind === 'unavailable') return <UnavailableState {...context.props} />;
  const { counts, onboarding, waterDashboard, cropCoefficients, plotShelters, settingsReview, phoneNotices } = await loadReglagesPage(context);
  context.logLoaded();
  // Le sol se saisit sur la page « Réserve du sol » : l'étape y mène, comme le bandeau (F584).
  const soilStep = context.shell.unfinished.find((step) => step.id === 'soil');
  return (
    <IrrigationShell {...context.shell}>
      <FeatureSettings selection={context.enabled} counts={counts} season={context.season} zone={context.zone} />
      {waterDashboard ? <WaterManagementDashboard season={context.season} snapshot={context.snapshot} initialDashboard={waterDashboard} part="reglages" /> : null}
      {usesPushNotifications(context.enabled)
        ? context.shell.demo ? <DemoNotificationSettings /> : <NotificationSettings season={context.season} morningMessage={phoneNotices?.morningMessage ?? null} />
        : null}
      {cropCoefficients ? <CropCoefficientsPanel season={context.season} initialView={cropCoefficients} part="especes" /> : null}
      {plotShelters ? <PlotShelterSettings season={context.season} initialLines={plotShelters} /> : null}
      {settingsReview ? <SettingsReviewSection season={context.season} initialReview={settingsReview} /> : null}
      <OnboardingSettings
        onboarding={onboarding}
        locationHere={waterDashboard !== null}
        plotsHere={plotShelters !== null}
        soilHref={soilStep ? pageHref(soilStep.page, { season: context.season, zone: context.zone }, soilStep.anchor) : null}
        speciesHere={cropCoefficients?.available === true && cropCoefficients.speciesStep !== null}
        settingsHere={settingsReview !== null && settingsReview.groups.length > 0}
        unknowns={remainingUnknowns({
          speciesToLink: cropCoefficients?.available ? cropCoefficients.species.filter(speciesNeedsLink).length : 0,
          plotsToClassify: plotShelters?.filter((line) => line.state === 'unclassified').length ?? 0,
          soil: soilStep ? { parcels: soilStep.count ?? 0, href: pageHref(soilStep.page, { season: context.season, zone: context.zone }, soilStep.anchor) } : null,
          hrefs: { species: `#${SPECIES_FOLD_ANCHOR}`, plots: '#parcelles-et-abris' },
        })}
        settingsGroups={settingsReview ? settingsGroupsText(settingsReview.groups) : []}
      />
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
