import { loadPageContext, type IrrigationSearchParams } from '../page-context';
import { loadArrosagesPage } from '../page-loaders';
import { IrrigationShell } from '../shell/irrigation-shell';
import { UnavailableState } from '../shell/unavailable-state';
import { ArrosagesPage } from '../pages/arrosages-page';
import { pageMetadata } from '../page-metadata';
import '../irrigation.css';

export const dynamic = 'force-dynamic';
export const metadata = pageMetadata('arrosages');

/** La page « Arrosages » (3.8) : irriguer maintenant, planifier, saisir un arrosage fait, l'eau du jour et la limite journalière. */
export default async function ArrosagesRoutePage({ searchParams }: { searchParams: IrrigationSearchParams }) {
  const context = await loadPageContext('arrosages', searchParams);
  if (context.kind === 'unavailable') return <UnavailableState {...context.props} />;
  const data = await loadArrosagesPage(context);
  context.logLoaded();
  return (
    <IrrigationShell {...context.shell}>
      <ArrosagesPage
        season={context.season}
        initialNowIso={context.nowIso}
        snapshot={context.snapshot}
        equipment={data.equipment}
        equipmentPlacements={data.equipmentPlacements}
        equipmentPoses={data.equipmentPoses}
        equipmentPoseHistory={data.equipmentPoseHistory}
        gardenGroupConfiguration={data.gardenGroupConfiguration}
        irrigationEvents={data.irrigationEvents}
        pumpDashboard={data.pumpDashboard}
        lateToleranceMinutes={data.planningSettings.lateToleranceMinutes}
        protectedSlots={data.protectedSlots}
        waterDashboard={data.waterDashboard}
        planningEnabled={context.enabled.includes('planning')}
        pumpsEnabled={context.enabled.includes('ressources')}
      />
    </IrrigationShell>
  );
}
