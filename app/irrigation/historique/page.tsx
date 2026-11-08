import { loadPageContext, type IrrigationSearchParams } from '../page-context';
import { loadHistoriquePage } from '../page-loaders';
import { IrrigationShell } from '../shell/irrigation-shell';
import { UnavailableState } from '../shell/unavailable-state';
import { HistoryViews } from '../history-views';
import { pageHref } from '@/lib/domain/features/pages';
import { pageMetadata } from '../page-metadata';
import '../irrigation.css';

export const dynamic = 'force-dynamic';
export const metadata = pageMetadata('historique');

/** La page « Historique et cumuls » (3.8) : cumuls, historique, suivi par série, export CSV. */
export default async function HistoriquePage({ searchParams }: { searchParams: IrrigationSearchParams }) {
  const context = await loadPageContext('historique', searchParams);
  if (context.kind === 'unavailable') return <UnavailableState {...context.props} />;
  const { irrigationHistory } = await loadHistoriquePage(context);
  context.logLoaded();
  return (
    <IrrigationShell {...context.shell}>
      <HistoryViews season={context.season} snapshot={context.snapshot} initialDashboard={irrigationHistory} cropWater={context.enabled.includes('cultures')}
        rainHref={context.enabled.includes('besoins') ? pageHref('besoins', { season: context.season, zone: context.zone }, 'manual-rain') : null}
      />
    </IrrigationShell>
  );
}
