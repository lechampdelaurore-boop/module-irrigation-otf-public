import { loadPageContext, type IrrigationSearchParams } from '../page-context';
import { loadPlanningPage } from '../page-loaders';
import { IrrigationShell } from '../shell/irrigation-shell';
import { UnavailableState } from '../shell/unavailable-state';
import { PlanningPage } from '../pages/planning-page';
import { pageMetadata } from '../page-metadata';
import '../irrigation.css';

export const dynamic = 'force-dynamic';
export const metadata = pageMetadata('planning');

/** La page « Planning de la semaine » (3.8) : le plan, ses réglages et son suivi. */
export default async function PlanningRoutePage({ searchParams }: { searchParams: IrrigationSearchParams }) {
  const context = await loadPageContext('planning', searchParams);
  if (context.kind === 'unavailable') return <UnavailableState {...context.props} />;
  const { weeklyPlan, planningSettings, protectedSlots, soilNotes } = await loadPlanningPage(context);
  context.logLoaded();
  return (
    <IrrigationShell {...context.shell}>
      <PlanningPage season={context.season} initialNowIso={context.nowIso} weeklyPlan={weeklyPlan} planningSettings={planningSettings} protectedSlots={protectedSlots} soilNotes={soilNotes} />
    </IrrigationShell>
  );
}
