import { redirect } from 'next/navigation';
import { requireAuthenticatedUser, signOutPath } from '@/app/access-auth';
import type { IrrigationSnapshot } from '@/lib/domain/domain';
import type { FeatureId } from '@/lib/domain/features/catalogue';
import { featureBannerText } from '@/lib/domain/features/choice';
import { firstEnabledFeature } from '@/lib/domain/features/selection';
import {
  ABSENT_FEATURE_NOTICE,
  menuPages,
  pageAccess,
  pageHref,
  pageUsesSeason,
  WELCOME_PATH,
  type IrrigationPageId,
} from '@/lib/domain/features/pages';
import { parseIrrigationSeason, parseIrrigationWeek } from '@/lib/domain/irrigation-navigation';
import type { IrrigationUnavailableReason } from '@/lib/domain/snapshot-policy';
import { OtfSeasonUnavailableError } from '@/lib/adapters/otf/snapshot-reader';
import { logJsonLine } from '@/lib/adapters/log';
import { startStopwatch } from '@/lib/adapters/stopwatch';
import { getFeatureSelectionForUser } from '@/lib/services/feature-selection-service';
import { getIrrigationSnapshot, IrrigationDataUnavailableError } from '@/lib/services/irrigation-service';
import { isDemoDeployment } from '@/lib/services/deployment-mode';
import { todaySeason } from '@/lib/domain/today/today-view';
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
  const user = await requireAuthenticatedUser();
  const signOutHref = signOutPath();
  const stopwatch = startStopwatch();

  // Le choix des cases d'abord (section 4) : une ferme qui n'a jamais ouvert le
  // module choisit avant toute lecture d'Ouvre ta ferme (R5) ; une page non
  // cochée conduit à la première page cochée, qui le dit (R1, P14).
  const selection = await getFeatureSelectionForUser(user.userId);
  const access = pageAccess(page, selection.firstVisit, selection.enabled);
  if (access.kind === 'welcome') redirect(WELCOME_PATH);
  if (access.kind === 'not-enabled') {
    redirect(pageHref(access.page, { season: typeof params.season === 'string' ? linkSeason : null, zone, absent: true }));
  }
  const enabled: FeatureId[] = selection.enabled;
  stopwatch.lap('selection');

  const loaded = await loadSnapshot(user.userId, season, forceRefresh);
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
      },
    };
  }
  const snapshot = loaded.snapshot;
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
      banner: selection.banner ? featureBannerText(selection.banner) : null,
      notice: params.absente === '1' ? ABSENT_FEATURE_NOTICE : null,
      demo: isDemoDeployment(),
    },
    lap: (step) => stopwatch.lap(step),
    logLoaded: () => {
      // Les durées de l'affichage (docs/planning-contract.md, point ouvert 34) : des nombres et des dates, jamais d'identifiant de personne.
      const { durationsMs, totalMs } = stopwatch.report();
      logJsonLine('info', { event: 'irrigation_page_loaded', page, season, snapshotSource: snapshot.source, forceRefresh, durationsMs, totalMs, loadedAt: new Date().toISOString() });
    },
  };
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
