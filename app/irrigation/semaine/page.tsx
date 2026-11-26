import { loadPageContext, type IrrigationSearchParams } from '../page-context';
import { loadSemainePage } from '../page-loaders';
import { IrrigationShell } from '../shell/irrigation-shell';
import { UnavailableState } from '../shell/unavailable-state';
import { PlanningPage } from '../pages/planning-page';
import { HistoryViews } from '../history-views';
import { IrrigationNeedsDashboardView } from '../irrigation-needs-dashboard';
import { WaterManagementDashboard } from '../water-management-dashboard';
import { pageMetadata } from '../page-metadata';
import { pageHref } from '@/lib/domain/features/pages';
import { isPartActive } from '@/lib/domain/features/socle';
import { MEASURED_RAIN_ANCHOR } from '@/lib/domain/today/reliability';
import '../irrigation.css';
import { renderOncePerRequest } from '../render-once';

export const dynamic = 'force-dynamic';
export const metadata = pageMetadata('semaine');

/**
 * La page « Semaine » (simplification, lot S4, docs/simplification-s4-contract.md,
 * section 3 ; PR 1 : une page, deux vues). La vue « La semaine » reprend,
 * dans l'ordre et sans rien changer, les blocs du « Planning de la semaine »
 * puis ceux d'« Objectifs et besoins », selon les cases ; la vue « Les
 * cumuls » est la page « Historique et cumuls ». Les trois anciennes adresses
 * mènent ici (`redirectToWeekPage`).
 */
async function computeSemainePage({ searchParams }: { searchParams: IrrigationSearchParams }) {
  const context = await loadPageContext('semaine', searchParams);
  if (context.kind === 'unavailable') return <UnavailableState {...context.props} />;
  const data = await loadSemainePage(context);
  context.logLoaded();
  const besoins = context.enabled.includes('besoins');
  if (data.view === 'cumuls') {
    return (
      <IrrigationShell {...context.shell}>
        <HistoryViews season={context.season} snapshot={context.snapshot} initialDashboard={data.irrigationHistory} cropWater={context.enabled.includes('cultures')}
          // La saisie au pluviomètre est dans l'autre vue de la page, « La semaine », quand la ferme a coché « Objectifs et besoins ».
          rainHref={besoins ? pageHref('semaine', { season: context.season, zone: context.zone }, MEASURED_RAIN_ANCHOR) : null}
        />
      </IrrigationShell>
    );
  }
  const { planning, besoins: needs } = data;
  // « Répartir l'eau » mène à la faisabilité de « Ressources », quand la ferme a coché sa partie (audit final, lot B, R4, F247).
  const repartitionHref = isPartActive(context.enabled, 'feasibility') ? pageHref('ressources', { season: context.season }, 'repartition') : null;
  return (
    <IrrigationShell {...context.shell}>
      {planning ? (
        <PlanningPage season={context.season} initialNowIso={context.nowIso} weeklyPlan={planning.weeklyPlan} planningSettings={planning.planningSettings} protectedSlots={planning.protectedSlots} soilNotes={planning.soilNotes} repartitionHref={repartitionHref} waterGap={planning.waterGap}
          // « Saisir la pluie mesurée » (amélioration n° 5, F734, point 3) : le pli de la pluie mesurée, plus bas sur la même page.
          rainHref={besoins ? `#${MEASURED_RAIN_ANCHOR}` : null}
        />
      ) : null}
      {needs ? (
        <>
          <WaterManagementDashboard season={context.season} snapshot={context.snapshot} initialDashboard={needs.waterDashboard} initialFarmObjective={{ weekStart: needs.irrigationNeeds.weekStart, objective: needs.irrigationNeeds.farmObjective }} />
          <IrrigationNeedsDashboardView season={context.season} initialDashboard={needs.irrigationNeeds} showProposals={context.enabled.includes('cultures')} />
        </>
      ) : null}
    </IrrigationShell>
  );
}

const computeSemainePageOnce = renderOncePerRequest(computeSemainePage);

// Une fonction exportée telle quelle : le greffon RSC y accroche les styles de la page.
export default async function SemainePage(props: Parameters<typeof computeSemainePage>[0]) {
  return computeSemainePageOnce(props);
}
