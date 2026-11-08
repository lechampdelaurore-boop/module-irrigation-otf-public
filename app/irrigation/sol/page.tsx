import { loadPageContext, type IrrigationSearchParams } from '../page-context';
import { loadSolPage } from '../page-loaders';
import { IrrigationShell } from '../shell/irrigation-shell';
import { UnavailableState } from '../shell/unavailable-state';
import { SoilReserveSection } from '../soil-reserve/soil-reserve-section';
import { pageMetadata } from '../page-metadata';
import '../irrigation.css';

export const dynamic = 'force-dynamic';
export const metadata = pageMetadata('sol');

/** La page « Réserve du sol » (3.8) : réglages du sol, jauges par jardin et par planche, observations, eau arrosée en trop. */
export default async function SolPage({ searchParams }: { searchParams: IrrigationSearchParams }) {
  const context = await loadPageContext('sol', searchParams);
  if (context.kind === 'unavailable') return <UnavailableState {...context.props} />;
  const { soilReserve } = await loadSolPage(context);
  context.logLoaded();
  return (
    <IrrigationShell {...context.shell}>
      <SoilReserveSection key={context.season} initialView={soilReserve} />
    </IrrigationShell>
  );
}
