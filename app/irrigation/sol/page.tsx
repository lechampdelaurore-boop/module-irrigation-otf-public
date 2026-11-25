import { loadPageContext, type IrrigationSearchParams } from '../page-context';
import { loadSolPage } from '../page-loaders';
import { IrrigationShell } from '../shell/irrigation-shell';
import { UnavailableState } from '../shell/unavailable-state';
import { SoilReserveSection } from '../soil-reserve/soil-reserve-section';
import { pageMetadata } from '../page-metadata';
import '../irrigation.css';
import { renderOncePerRequest } from '../render-once';

export const dynamic = 'force-dynamic';
export const metadata = pageMetadata('sol');

/** La page « Réserve du sol » (3.8) : réglages du sol, jauges par jardin et par planche, observations, eau arrosée en trop. */
async function computeSolPage({ searchParams }: { searchParams: IrrigationSearchParams }) {
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

const computeSolPageOnce = renderOncePerRequest(computeSolPage);

// Une fonction exportée telle quelle : le greffon RSC y accroche les styles de la page.
export default async function SolPage(props: Parameters<typeof computeSolPage>[0]) {
  return computeSolPageOnce(props);
}
