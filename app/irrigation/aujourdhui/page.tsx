import { loadPageContext, type IrrigationSearchParams } from '../page-context';
import { loadAujourdhuiPage } from '../page-loaders';
import { IrrigationShell } from '../shell/irrigation-shell';
import { UnavailableState } from '../shell/unavailable-state';
import { TodayPage } from '../today/today-page';
import { pageMetadata } from '../page-metadata';
import '../irrigation.css';
import { renderOncePerRequest } from '../render-once';

export const dynamic = 'force-dynamic';
export const metadata = pageMetadata('aujourdhui');

/**
 * La page « Aujourd'hui » (audit ergonomique, points 1 et 3, 3.8 quater lot 2,
 * docs/audit-ergonomie-lot2-contract.md, sections 5 et 6) : l'entrée du
 * module, la réponse à la question du matin, et la zone « Fiabilité du
 * calcul ». Elle ne calcule rien : elle lit le modèle construit côté serveur.
 */
async function computeAujourdhuiRoutePage({ searchParams }: { searchParams: IrrigationSearchParams }) {
  const context = await loadPageContext('aujourdhui', searchParams);
  if (context.kind === 'unavailable') return <UnavailableState {...context.props} />;
  const { view } = await loadAujourdhuiPage(context);
  context.logLoaded();
  return (
    <IrrigationShell {...context.shell} todayBadge={view.badge}>
      <TodayPage initialView={view} query={{ season: context.shell.season, zone: context.zone }} />
    </IrrigationShell>
  );
}

const computeAujourdhuiRoutePageOnce = renderOncePerRequest(computeAujourdhuiRoutePage);

// Une fonction exportée telle quelle : le greffon RSC y accroche les styles de la page.
export default async function AujourdhuiRoutePage(props: Parameters<typeof computeAujourdhuiRoutePage>[0]) {
  return computeAujourdhuiRoutePageOnce(props);
}
