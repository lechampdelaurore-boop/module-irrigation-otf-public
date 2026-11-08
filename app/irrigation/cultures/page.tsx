import { loadPageContext, type IrrigationSearchParams } from '../page-context';
import { loadCulturesPage } from '../page-loaders';
import { IrrigationShell } from '../shell/irrigation-shell';
import { UnavailableState } from '../shell/unavailable-state';
import { CropCoefficientsPanel } from '../crop-water/crop-coefficients-panel';
import { pageMetadata } from '../page-metadata';
import '../irrigation.css';

export const dynamic = 'force-dynamic';
export const metadata = pageMetadata('cultures');

/** La page « Besoin par culture » (3.8) : coefficients culturaux, profils racinaires et durées propres à la ferme. */
export default async function CulturesPage({ searchParams }: { searchParams: IrrigationSearchParams }) {
  const context = await loadPageContext('cultures', searchParams);
  if (context.kind === 'unavailable') return <UnavailableState {...context.props} />;
  const { cropCoefficients } = await loadCulturesPage(context);
  context.logLoaded();
  return (
    <IrrigationShell {...context.shell}>
      <CropCoefficientsPanel season={context.season} initialView={cropCoefficients} />
    </IrrigationShell>
  );
}
