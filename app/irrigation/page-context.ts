import { redirect } from 'next/navigation';
import { requireAuthenticatedUser, signOutPath, type AuthenticatedUser } from '@/app/access-auth';
import type { IrrigationSnapshot } from '@/lib/domain/domain';
import type { FeatureId } from '@/lib/domain/features/catalogue';
import { featureBannerText } from '@/lib/domain/features/choice';
import { firstEnabledFeature } from '@/lib/domain/features/selection';
import {
  absentPageNotice,
  menuPages,
  pageAccess,
  pageHref,
  pageUsesSeason,
  weekRedirectHref,
  WELCOME_PATH,
  type IrrigationPageId,
} from '@/lib/domain/features/pages';
import { resolveWeekView, type WeekPageFeature, type WeekViewId } from '@/lib/domain/features/week-page';
import type { RouteState, StartMode } from '@/lib/domain/features/start-mode';
import { parseIrrigationSeason, parseIrrigationWeek } from '@/lib/domain/irrigation-navigation';
import type { IrrigationUnavailableReason } from '@/lib/domain/snapshot-policy';
import { otfReadLineReason } from '@/lib/domain/otf-read-line';
import { OtfSeasonUnavailableError } from '@/lib/adapters/otf/snapshot-reader';
import { logJsonLine } from '@/lib/adapters/log';
import { startStopwatch } from '@/lib/adapters/stopwatch';
import { getFeatureSelectionForUser } from '@/lib/services/feature-selection-service';
import { getIrrigationSnapshot, IrrigationDataUnavailableError } from '@/lib/services/irrigation-service';
import { isDemoDeployment } from '@/lib/services/deployment-mode';
import { FarmIdentityUnavailableError } from '@/lib/services/farm-identity-service';
import { DemoSpacePreparingError } from '@/lib/services/demo-space';
import { FarmFrozenError } from '@/lib/services/farm-erasure-request';
import { demoSelectionOfOwner } from '@/lib/domain/demo/catalogue';
import { todaySeason } from '@/lib/domain/today/today-view';
import { farmRainMatters } from '@/lib/domain/today/rain-entry';
import { unfinishedSteps } from '@/lib/domain/onboarding/steps';
import { usesPlotShelters, usesSpeciesCorrespondence, usesWeather } from '@/lib/domain/features/socle';
import { unclassifiedPlots } from '@/lib/domain/onboarding/plots';
import { getOnboardingForUser } from '@/lib/services/onboarding-service';
import { listZonesWithSoilForUser } from '@/db/soil-reserve/entries';
import { parcelsWithoutSoil } from '@/lib/domain/onboarding/soil';
import { soilParcelAnchor } from '@/lib/domain/today/reliability';
import { listSpeciesCorrespondencesForWorkspace } from '@/db/crop-water/entries';
import { findWorkspaceIdForUser } from '@/db/workspace-repository';
import { seasonSpecies } from '@/lib/domain/crop-water/species';
import { speciesNeedsLink } from '@/lib/domain/crop-water/species-linking';
import { planningAllowed } from '@/lib/domain/onboarding/settings-review';
import type { ShellProps } from './shell/irrigation-shell';
import type { UnavailableStateProps } from './shell/unavailable-state';

/**
 * Ce que toutes les pages du module lisent avant leurs blocs (3.8,
 * docs/feature-selection-contract.md, section 5) : la session, l'adresse
 * (saison, semaine, parcelle) et la lecture d'Ouvre ta ferme, toujours en
 * lecture seule (D-001, D-002). Chaque page ne lit ensuite que ses données.
 */

export type IrrigationSearchParams = Promise<{
  refresh?: string | string[];
  season?: string | string[];
  /** Un jour de la semaine à ouvrir, `AAAA-MM-JJ` : le clic sur une alerte météo (5 bis). */
  week?: string | string[];
  /** La parcelle choisie sur le plan (précision P12). */
  zone?: string | string[];
  /** La page demandée n'était pas cochée (précision P14). */
  absente?: string | string[];
  /** L'onglet de « Matériel » (audit du 19 novembre 2026, lot J, n° 15, F461). */
  onglet?: string | string[];
  /** La vue de « Semaine » : `cumuls` pour « Les cumuls » (simplification, lot S4, S4-b). */
  vue?: string | string[];
  /** Les autres paramètres, comme l'intention d'un lien (`recalculer`), qu'une ancienne adresse transmet à « Semaine ». */
  [key: string]: string | string[] | undefined;
}>;

export type ReadyPageContext = {
  kind: 'ready';
  page: IrrigationPageId;
  userId: string;
  /** La saison des données de la page ; sur « Aujourd'hui », toujours celle du jour (F2). */
  season: number;
  week: string | null;
  zone: string | null;
  forceRefresh: boolean;
  nowIso: string;
  snapshot: IrrigationSnapshot;
  enabled: readonly FeatureId[];
  /** Comment la ferme a commencé (lot S6, section 4) ; `null` : une ferme d'avant S6. */
  startMode: StartMode | null;
  /** L'état de sa carte « Mise en route » (lot S6, section 5.3). */
  routeState: RouteState | null;
  /** La vue ouverte de « Semaine » (lot S4, section 3.2) ; `null` sur toute autre page. */
  weekView: WeekViewId | null;
  shell: ShellProps;
  /** Les durées de chaque étape de la lecture, pour le journal `irrigation_page_loaded`. */
  lap: (step: string) => void;
  logLoaded: () => void;
};

export type PageContext = ReadyPageContext | { kind: 'unavailable'; props: UnavailableStateProps };

export async function loadPageContext(page: IrrigationPageId, searchParams: IrrigationSearchParams): Promise<PageContext> {
  const params = await searchParams;
  const forceRefresh = params.refresh === '1';
  // La saison de l'adresse suit vers les autres pages ; « Aujourd'hui » lit
  // toujours la saison du jour (audit ergonomique, lot 2, F2).
  const linkSeason = parseIrrigationSeason(params.season);
  const season = page === 'aujourdhui' ? todaySeason(new Date()) : linkSeason;
  const week = parseIrrigationWeek(params.week);
  const zone = typeof params.zone === 'string' && params.zone.length > 0 ? params.zone : null;
  let user: AuthenticatedUser;
  try {
    user = await requireAuthenticatedUser();
  } catch (error) {
    const props = accessRefusedState(page, season, error);
    if (props) return { kind: 'unavailable', props };
    throw error;
  }
  const signOutHref = signOutPath();
  const stopwatch = startStopwatch();

  // Le choix des cases d'abord (section 4) : une ferme qui n'a jamais ouvert le
  // module choisit avant toute lecture d'Ouvre ta ferme (R5) ; une page non
  // cochée conduit à la première page cochée, qui le dit (R1, P14).
  const selection = await getFeatureSelectionForUser(user.userId);
  const access = pageAccess(page, selection.firstVisit, selection.enabled);
  if (access.kind === 'welcome') redirect(WELCOME_PATH);
  if (access.kind === 'not-enabled') {
    redirect(pageHref(access.page, { season: typeof params.season === 'string' ? linkSeason : null, zone, absent: access.requested }));
  }
  const enabled: FeatureId[] = selection.enabled;
  const weekView = page === 'semaine' ? resolveWeekView(params.vue, enabled) : null;
  stopwatch.lap('selection');

  // L'accueil de la ferme se lit avec le plan : le bandeau « À finir » de chaque page (4.4, F582).
  const [loaded, onboarding] = await Promise.all([loadSnapshot(user.userId, season, forceRefresh), getOnboardingForUser(user.userId)]);
  stopwatch.lap('snapshot');
  if (!loaded.snapshot) {
    return {
      kind: 'unavailable',
      props: {
        // « Aujourd'hui » ne propose pas d'autre saison (F2) : une saison du jour absente d'Ouvre ta ferme mène à la première page cochée.
        page: page === 'aujourdhui' && loaded.reason === 'season-unavailable' ? firstEnabledFeature(enabled) ?? 'reglages' : page,
        signOutPath: signOutHref,
        userName: user.displayName,
        season,
        reason: loaded.reason,
        seasonFirst: loaded.seasonFirst,
        seasonLast: loaded.seasonLast,
        demo: isDemoDeployment(),
        demoSelection: isDemoDeployment() ? demoSelectionOfOwner(user.userId) : null,
      },
    };
  }
  const snapshot = loaded.snapshot;
  // Le sol des parcelles ne se lit que pour un espace qui fait l'accueil et a coché la réserve du sol (F584).
  const withoutSoil = onboarding.kind === 'onboarding' && enabled.includes('sol')
    ? parcelsWithoutSoil(snapshot.zones, season, new Set(await listZonesWithSoilForUser(user.userId)))
    : [];
  // Les espèces à rattacher ne se comptent que tant que l'étape « Cultures » d'un espace qui fait l'accueil reste à faire (F587).
  const speciesToLink = await countSpeciesToLink(user.userId, snapshot, season, onboarding.kind === 'onboarding'
    && onboarding.remaining.some((step) => step.id === 'crops') && usesSpeciesCorrespondence(enabled));
  return {
    kind: 'ready',
    page,
    userId: user.userId,
    season,
    week,
    zone,
    forceRefresh,
    nowIso: new Date().toISOString(),
    snapshot,
    enabled,
    startMode: selection.startMode,
    routeState: selection.routeState,
    weekView,
    shell: {
      page,
      menu: menuPages(enabled),
      season: linkSeason,
      showSeason: pageUsesSeason(page, enabled),
      seasonFirst: snapshot.configuration.seasonFirst,
      seasonLast: snapshot.configuration.seasonLast,
      zone,
      userName: user.displayName,
      signOutPath: signOutHref,
      source: snapshot.source,
      lastSuccessfulReadAt: snapshot.lastSuccessfulReadAt,
      warning: snapshot.warning ?? null,
      // La ligne de lecture ne se montre que pour dire un problème (simplification S1, F822, F829).
      readLine: otfReadLineReason(snapshot, new Date()) !== null,
      banner: selection.banner ? featureBannerText(selection.banner) : null,
      notice: absentPageNotice(params.absente),
      demo: isDemoDeployment(),
      demoSelection: isDemoDeployment() ? demoSelectionOfOwner(user.userId) : null,
      unfinished: unfinishedSteps(onboarding, {
        weather: usesWeather(enabled),
        plotsToClassify: usesPlotShelters(enabled) ? unclassifiedPlots(snapshot, season).length : 0,
        soilToEnter: withoutSoil.length > 0 ? { parcels: withoutSoil.length, anchor: soilParcelAnchor(withoutSoil[0]) } : null,
        speciesToLink,
        planningToValidate: enabled.includes('planning') && !planningAllowed(onboarding),
      }),
      week,
      weekView,
      // Le « + » propose « Noter la pluie » sauf à une ferme toute sous abri (simplification S3, section 4.1, D-032).
      rainMatters: farmRainMatters(snapshot, season),
    },
    lap: (step) => stopwatch.lap(step),
    logLoaded: () => {
      // Les durées de l'affichage (docs/planning-contract.md, point ouvert 34) : des nombres et des dates, jamais d'identifiant de personne.
      const { durationsMs, totalMs } = stopwatch.report();
      logJsonLine('info', { event: 'irrigation_page_loaded', page, season, snapshotSource: snapshot.source, forceRefresh, durationsMs, totalMs, loadedAt: new Date().toISOString() });
    },
  };
}

/**
 * Les trois anciennes pages de la semaine (simplification, lot S4,
 * docs/simplification-s4-contract.md, section 3.3, précision S4-o) : leur
 * adresse mène à « Semaine », sur la vue qui porte leur contenu, avec tous
 * ses paramètres ; le navigateur garde l'ancre. Avant, la conduite d'avant
 * tient : une ferme qui n'a jamais ouvert le module choisit ses cases (R5),
 * une case décochée mène à la page d'arrivée, qui nomme la page demandée
 * (P14, F265). Rien d'Ouvre ta ferme n'est lu pour une redirection.
 */
export async function redirectToWeekPage(feature: WeekPageFeature, searchParams: IrrigationSearchParams): Promise<UnavailableStateProps> {
  const params = await searchParams;
  let user: AuthenticatedUser;
  try {
    user = await requireAuthenticatedUser();
  } catch (error) {
    const props = accessRefusedState(feature, parseIrrigationSeason(params.season), error);
    if (props) return props;
    throw error;
  }
  const selection = await getFeatureSelectionForUser(user.userId);
  const access = pageAccess(feature, selection.firstVisit, selection.enabled);
  if (access.kind === 'welcome') redirect(WELCOME_PATH);
  if (access.kind === 'not-enabled') {
    const zone = typeof params.zone === 'string' && params.zone.length > 0 ? params.zone : null;
    redirect(pageHref(access.page, { season: typeof params.season === 'string' ? parseIrrigationSeason(params.season) : null, zone, absent: access.requested }));
  }
  redirect(weekRedirectHref(feature, params));
}

/**
 * Ce que montre une page quand la personne n'entre pas dans son espace : la
 * ferme de la clé n'est pas établie (F341), la démonstration se prépare
 * (F450), ou l'espace est figé par une demande d'effacement (F666). `null` :
 * une autre erreur, que l'appelant relance.
 */
export function accessRefusedState(page: IrrigationPageId, season: number, error: unknown): UnavailableStateProps | null {
  if (error instanceof FarmIdentityUnavailableError) return farmUnidentifiedState(page, season, error);
  if (error instanceof DemoSpacePreparingError) return demoPreparingState(page, season);
  if (error instanceof FarmFrozenError) return farmFrozenState(page, season, error);
  return null;
}

/**
 * La ferme de la clé n'est pas établie (docs/tranche-4-contract.md, F341) :
 * aucune page ne s'affiche, et celle-ci le dit à la personne.
 */
function farmUnidentifiedState(page: IrrigationPageId, season: number, error: FarmIdentityUnavailableError): UnavailableStateProps {
  return {
    page,
    signOutPath: signOutPath(),
    userName: error.displayName ?? '',
    season,
    reason: 'farm-unidentified',
    demo: false,
    demoSelection: null,
  };
}

/**
 * L'espace de la démonstration se prépare dans une autre requête (audit du
 * 19 novembre 2026, lot I, n° 11, F450) : la page le dit, et se relit seule.
 */
function demoPreparingState(page: IrrigationPageId, season: number): UnavailableStateProps {
  return { page, signOutPath: signOutPath(), userName: '', season, reason: 'demo-preparing', demo: true, demoSelection: null };
}

/**
 * L'espace a une demande d'effacement ouverte (docs/tranche-4-contract.md,
 * F666) : aucune page ne s'affiche, aucune lecture d'Ouvre ta ferme ne part ;
 * l'écran dit le jour de l'effacement et, tant qu'il n'a pas commencé, offre
 * l'annulation.
 */
function farmFrozenState(page: IrrigationPageId, season: number, error: FarmFrozenError): UnavailableStateProps {
  return { page, signOutPath: signOutPath(), userName: error.displayName, season, reason: 'farm-frozen', demo: false, demoSelection: null, frozen: error.view };
}

type SnapshotLoadResult =
  | { snapshot: IrrigationSnapshot; reason?: never; seasonFirst?: never; seasonLast?: never }
  | { snapshot: null; reason: IrrigationUnavailableReason; seasonFirst?: never; seasonLast?: never }
  | { snapshot: null; reason: 'season-unavailable'; seasonFirst: number; seasonLast: number };

async function loadSnapshot(userId: string, season: number, forceRefresh: boolean): Promise<SnapshotLoadResult> {
  try {
    return { snapshot: await getIrrigationSnapshot(userId, { season, forceRefresh }) };
  } catch (error) {
    if (error instanceof OtfSeasonUnavailableError) {
      return { snapshot: null, reason: 'season-unavailable', seasonFirst: error.seasonFirst, seasonLast: error.seasonLast };
    }
    if (error instanceof IrrigationDataUnavailableError) {
      return { snapshot: null, reason: error.reason };
    }
    throw error;
  }
}

/** Les espèces de la saison à rattacher (F587), lues seulement quand le bandeau peut les nommer. */
async function countSpeciesToLink(spaceKey: string, snapshot: IrrigationSnapshot, season: number, wanted: boolean): Promise<number> {
  if (!wanted || !snapshot.cropPlan) return 0;
  const workspaceId = await findWorkspaceIdForUser(spaceKey);
  const entries = workspaceId === null ? [] : await listSpeciesCorrespondencesForWorkspace(workspaceId);
  return seasonSpecies(snapshot.cropPlan.series.filter((item) => item.season === season), entries).filter(speciesNeedsLink).length;
}
