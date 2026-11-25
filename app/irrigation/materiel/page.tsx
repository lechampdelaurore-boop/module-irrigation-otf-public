import { HierarchyBrowser } from '../hierarchy-browser';
import { loadPageContext, type IrrigationSearchParams } from '../page-context';
import { loadMaterielPage } from '../page-loaders';
import { UnavailableState } from '../shell/unavailable-state';
import { pageMetadata } from '../page-metadata';
import { parseMaterielTab } from '@/lib/domain/materiel-tabs';
import '../irrigation.css';
import { renderOncePerRequest } from '../render-once';

export const dynamic = 'force-dynamic';
export const metadata = pageMetadata('materiel');

/** La page « Matériel et placement » (3.8) : trois onglets, le plan et la fiche de la planche, le matériel, les groupes de jardins (lot J, F461). */
async function computeMaterielPage({ searchParams }: { searchParams: IrrigationSearchParams }) {
  const context = await loadPageContext('materiel', searchParams);
  if (context.kind === 'unavailable') return <UnavailableState {...context.props} />;
  const data = await loadMaterielPage(context);
  // L'onglet demandé par l'adresse, le plan sinon (audit du 19 novembre 2026, lot J, n° 15, F461).
  const { onglet } = await searchParams;
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
      initialTab={parseMaterielTab(onglet)}
    />
  );
}

const computeMaterielPageOnce = renderOncePerRequest(computeMaterielPage);

// Une fonction exportée telle quelle : le greffon RSC y accroche les styles de la page.
export default async function MaterielPage(props: Parameters<typeof computeMaterielPage>[0]) {
  return computeMaterielPageOnce(props);
}
