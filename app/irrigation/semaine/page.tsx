import type { ReactNode } from 'react';
import { loadPageContext, type IrrigationSearchParams } from '../page-context';
import { loadSemainePage } from '../page-loaders';
import { IrrigationShell } from '../shell/irrigation-shell';
import { UnavailableState } from '../shell/unavailable-state';
import { AnchoredFold, PAGE_SETTINGS_ANCHOR } from '../shell/page-settings-fold';
import { HistoryViews } from '../history-views';
import { IrrigationNeedsDashboardView, NeedsThresholdSettings } from '../irrigation-needs-dashboard';
import { WaterManagementDashboard } from '../water-management-dashboard';
import { WeeklyPlanProvider } from '../planning/weekly-plan-state';
import { PlanSettings, WeeklyPlanSection } from '../planning/weekly-plan-view';
import { pageMetadata } from '../page-metadata';
import { pageHref } from '@/lib/domain/features/pages';
import { isPartActive } from '@/lib/domain/features/socle';
import { weekSections } from '@/lib/domain/features/week-page';
import { needsDetailLine, weekDetailSummary, WEEK_SECTION_TITLES, WEEK_SETTINGS_LINE } from '@/lib/domain/semaine/week-detail';
import { weekDayEvents } from '@/lib/domain/semaine/week-days';
import { farmRainMatters } from '@/lib/domain/today/rain-entry';
import { MEASURED_RAIN_ANCHOR } from '@/lib/domain/today/reliability';
import { todaySeason } from '@/lib/domain/today/today-view';
import { dateKeyInTimeZone, FARM_TIME_ZONE, weekStartDateKey } from '@/lib/domain/water-management';
import { WeekFirstLevel } from './week-first-level';
import { PlanDetailSection, WaterGapSection, WeekDetail, WeekDetailSection } from './week-detail';
import '../irrigation.css';
import { renderOncePerRequest } from '../render-once';

export const dynamic = 'force-dynamic';
export const metadata = pageMetadata('semaine');

/**
 * La page « Semaine » (simplification, lot S4, docs/simplification-s4-contract.md).
 * La vue « La semaine » (PR 2, sections 4 et 7) : le premier niveau, puis
 * « Le détail », un pli fermé où sont, chacun dans son pli, tous les blocs
 * du « Planning de la semaine » et d'« Objectifs et besoins », selon les
 * cases ; rien n'est retiré. La vue « Les cumuls » est la page « Historique
 * et cumuls ». Les trois anciennes adresses mènent ici (`redirectToWeekPage`).
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
  // La vue « La semaine » demande « Objectifs et besoins » (section 3.1) : sans elle, rien à montrer.
  if (!needs) return <IrrigationShell {...context.shell}>{null}</IrrigationShell>;
  const now = new Date(context.nowIso);
  const today = dateKeyInTimeZone(now, FARM_TIME_ZONE);
  const weekStart = needs.waterDashboard.weekStart;
  const current = weekStartDateKey(today) === weekStart;
  const rainMatters = farmRainMatters(context.snapshot, context.season);
  // « Répartir l'eau » mène à la faisabilité de « Ressources », quand la ferme a coché sa partie (audit final, lot B, R4, F247).
  const repartitionHref = isPartActive(context.enabled, 'feasibility') ? pageHref('ressources', { season: context.season }, 'repartition') : null;
  // L'écart du prévu se lit à l'ouverture de sa section (3.4, F918), pour la saison du jour seulement, comme avant (F735).
  const gapSection = planning !== null && context.season === todaySeason(now);
  const sections = weekSections(context.enabled).filter((section) => section !== 'ecart-du-prevu' || gapSection);
  const content = (
    <>
      <WeekFirstLevel
        season={context.season}
        currentSeason={todaySeason(now)}
        today={today}
        query={{ season: context.season, zone: context.zone }}
        initialWater={needs.waterDashboard}
        initialNeeds={needs.irrigationNeeds}
        initialEvents={weekDayEvents(needs.irrigationEvents, weekStart)}
        rainMatters={rainMatters}
      />
      <WeekDetail summary={weekDetailSummary(sections, needs.irrigationNeeds.gardens.length)}>
        <WeekDetailSection id="reste-a-arroser" section="reste-a-arroser" line={needsDetailLine(needs.irrigationNeeds.gardens.length)}>
          <IrrigationNeedsDashboardView season={context.season} initialDashboard={needs.irrigationNeeds} showProposals={context.enabled.includes('cultures')} />
        </WeekDetailSection>
        {planning ? <PlanDetailSection current={current} /> : null}
        <WaterManagementDashboard season={context.season} snapshot={context.snapshot} initialDashboard={needs.waterDashboard} initialFarmObjective={{ weekStart: needs.irrigationNeeds.weekStart, objective: needs.irrigationNeeds.farmObjective }} />
        {gapSection ? <WaterGapSection season={context.season} rainHref={`#${MEASURED_RAIN_ANCHOR}`} /> : null}
        <WeekSettings planning={planning !== null}>
          <NeedsThresholdSettings season={context.season} weekStart={needs.irrigationNeeds.weekStart} initialThresholdMm={needs.irrigationNeeds.thresholdMm} />
        </WeekSettings>
      </WeekDetail>
    </>
  );
  return (
    <IrrigationShell {...context.shell}>
      {planning ? (
        <WeeklyPlanProvider season={context.season} initialNowIso={context.nowIso} initialPlan={planning.weeklyPlan} initialSettings={planning.planningSettings} initialProtectedSlots={planning.protectedSlots} soilNotes={planning.soilNotes} repartitionHref={repartitionHref}>
          <WeeklyPlanSection>{content}</WeeklyPlanSection>
        </WeeklyPlanProvider>
      ) : <section className="week-page-section" aria-label="La semaine">{content}</section>}
    </IrrigationShell>
  );
}

/**
 * « Réglages de la semaine » (section 7.1, n° 8), le dernier pli du détail :
 * les réglages du planning, les heures où l'on n'arrose pas et le seuil du
 * besoin. Son ancre est celle du pli « Réglages de cette page » d'avant.
 */
function WeekSettings({ planning, children }: { planning: boolean; children: ReactNode }) {
  return (
    <AnchoredFold
      id={PAGE_SETTINGS_ANCHOR}
      className="page-settings week-detail-section"
      bodyClassName="page-settings-body week-detail-section-body"
      summary={<><h3>{WEEK_SECTION_TITLES.reglages}</h3><small>{WEEK_SETTINGS_LINE}</small></>}
    >
      {planning ? <PlanSettings /> : null}
      {children}
    </AnchoredFold>
  );
}

const computeSemainePageOnce = renderOncePerRequest(computeSemainePage);

// Une fonction exportée telle quelle : le greffon RSC y accroche les styles de la page.
export default async function SemainePage(props: Parameters<typeof computeSemainePage>[0]) {
  return computeSemainePageOnce(props);
}
