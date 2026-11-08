import { HierarchyBrowser } from '../hierarchy-browser';
import { loadPageContext, type IrrigationSearchParams } from '../page-context';
import { loadMaterielPage } from '../page-loaders';
import { UnavailableState } from '../shell/unavailable-state';
import { pageMetadata } from '../page-metadata';
import '../irrigation.css';

export const dynamic = 'force-dynamic';
export const metadata = pageMetadata('materiel');

/** La page « Matériel et placement » (3.8) : le plan, la fiche de la planche, les groupes de jardins et le matériel. */
export default async function MaterielPage({ searchParams }: { searchParams: IrrigationSearchParams }) {
  const context = await loadPageContext('materiel', searchParams);
  if (context.kind === 'unavailable') return <UnavailableState {...context.props} />;
  const data = await loadMaterielPage(context);
  context.logLoaded();
  return (
    <HierarchyBrowser
      key={context.season}
      shell={context.shell}
      snapshot={context.snapshot}
      selectedSeason={context.season}
      equipment={data.equipment}
      equipmentPlacements={data.equipmentPlacements}
      equipmentPoses={data.equipmentPoses}
      equipmentPoseHistory={data.equipmentPoseHistory}
      gardenGroupConfiguration={data.gardenGroupConfiguration}
      showBedCropWater={context.enabled.includes('cultures')}
      calculator={data.calculator}
    />
  );
}
