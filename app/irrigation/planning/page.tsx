import { loadPageContext, type IrrigationSearchParams } from '../page-context';
import { loadPlanningPage } from '../page-loaders';
import { IrrigationShell } from '../shell/irrigation-shell';
import { UnavailableState } from '../shell/unavailable-state';
import { PlanningPage } from '../pages/planning-page';
import { pageMetadata } from '../page-metadata';
import { pageHref } from '@/lib/domain/features/pages';
import { isPartActive } from '@/lib/domain/features/socle';
import { MEASURED_RAIN_ANCHOR } from '@/lib/domain/today/reliability';
import '../irrigation.css';
import { renderOncePerRequest } from '../render-once';

export const dynamic = 'force-dynamic';
export const metadata = pageMetadata('planning');

/** La page « Planning de la semaine » (3.8) : le plan, ses réglages et son suivi. */
async function PlanningRoutePage({ searchParams }: { searchParams: IrrigationSearchParams }) {
  const context = await loadPageContext('planning', searchParams);
  if (context.kind === 'unavailable') return <UnavailableState {...context.props} />;
  const { weeklyPlan, planningSettings, protectedSlots, soilNotes, waterGap } = await loadPlanningPage(context);
  context.logLoaded();
  // « Répartir l'eau » mène à la faisabilité de « Ressources », quand la ferme a coché sa partie (audit final, lot B, R4, F247).
  const repartitionHref = isPartActive(context.enabled, 'feasibility') ? pageHref('ressources', { season: context.season }, 'repartition') : null;
  // « Saisir la pluie mesurée » (amélioration n° 5, F734, point 3) : la saisie au pluviomètre est sur « Objectifs et besoins ».
  const rainHref = context.enabled.includes('besoins') ? pageHref('besoins', { season: context.season, zone: context.zone }, MEASURED_RAIN_ANCHOR) : null;
  return (
    <IrrigationShell {...context.shell}>
      <PlanningPage season={context.season} initialNowIso={context.nowIso} weeklyPlan={weeklyPlan} planningSettings={planningSettings} protectedSlots={protectedSlots} soilNotes={soilNotes} repartitionHref={repartitionHref} waterGap={waterGap} rainHref={rainHref} />
    </IrrigationShell>
  );
}

export default renderOncePerRequest(PlanningRoutePage);
