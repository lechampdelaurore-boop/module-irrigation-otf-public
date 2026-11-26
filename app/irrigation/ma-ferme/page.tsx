import { farmCards } from '@/lib/domain/features/farm-cards';
import { routeCardVisible } from '@/lib/domain/onboarding/route';
import { loadPageContext, type IrrigationSearchParams } from '../page-context';
import { IrrigationShell } from '../shell/irrigation-shell';
import { UnavailableState } from '../shell/unavailable-state';
import { FarmCards } from '../pages/ma-ferme-page';
import { StartRouteCard } from '../pages/start-route-card';
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
 *
 * En tête, à la place que S3 a gardée, la carte « Mise en route » (lot S6,
 * PR 2, docs/simplification-s6-contract.md, section 5) : seulement pour une
 * ferme passée par les trois façons, lue par le gabarit avec le plan
 * (section 6). Quand elle est à l'écran, le bandeau « À finir » n'y est pas
 * répété (S6-d) : ses lignes restent sur les fiches, avec « À faire ».
 */
async function computeMaFermePage({ searchParams }: { searchParams: IrrigationSearchParams }) {
  const context = await loadPageContext('ma-ferme', searchParams);
  if (context.kind === 'unavailable') return <UnavailableState {...context.props} />;
  context.logLoaded();
  const query = { season: context.shell.season, zone: context.zone };
  return (
    <IrrigationShell {...context.shell} unfinished={routeCardVisible(context.route) ? [] : context.shell.unfinished}>
      {/* Toujours à la même place, même sans carte : la réponse de « Terminer » reste quand la page se relit. */}
      {context.startMode !== null ? <StartRouteCard route={context.route ?? { kind: 'none' }} query={query} /> : null}
      <FarmCards cards={farmCards(context.enabled, context.shell.unfinished)} query={query} />
    </IrrigationShell>
  );
}

const computeMaFermePageOnce = renderOncePerRequest(computeMaFermePage);

// Une fonction exportée telle quelle : le greffon RSC y accroche les styles de la page.
export default async function MaFermePage(props: Parameters<typeof computeMaFermePage>[0]) {
  return computeMaFermePageOnce(props);
}
