import { farmCards } from '@/lib/domain/features/farm-cards';
import { loadPageContext, type IrrigationSearchParams } from '../page-context';
import { IrrigationShell } from '../shell/irrigation-shell';
import { UnavailableState } from '../shell/unavailable-state';
import { FarmCards } from '../pages/ma-ferme-page';
import { pageMetadata } from '../page-metadata';
import '../irrigation.css';
import { renderOncePerRequest } from '../render-once';

export const dynamic = 'force-dynamic';
export const metadata = pageMetadata('ma-ferme');

/**
 * La page « Ma ferme » (simplification, lot S3, PR 1,
 * docs/simplification-s3-contract.md, section 5 ; D-331) : l'entrée de
 * l'endroit qui dit ce que le module sait de la ferme, en fiches. Elle ne lit
 * rien de plus que le gabarit de chaque page : la marque « À faire » vient de
 * l'accueil de la ferme, que le gabarit lit déjà (section 5).
 */
async function computeMaFermePage({ searchParams }: { searchParams: IrrigationSearchParams }) {
  const context = await loadPageContext('ma-ferme', searchParams);
  if (context.kind === 'unavailable') return <UnavailableState {...context.props} />;
  context.logLoaded();
  return (
    <IrrigationShell {...context.shell}>
      <FarmCards cards={farmCards(context.enabled, context.shell.unfinished)} query={{ season: context.shell.season, zone: context.zone }} />
    </IrrigationShell>
  );
}

const computeMaFermePageOnce = renderOncePerRequest(computeMaFermePage);

// Une fonction exportée telle quelle : le greffon RSC y accroche les styles de la page.
export default async function MaFermePage(props: Parameters<typeof computeMaFermePage>[0]) {
  return computeMaFermePageOnce(props);
}
