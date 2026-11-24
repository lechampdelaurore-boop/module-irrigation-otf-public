'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import type { IrrigationSnapshot } from '@/lib/domain/domain';
import { isPageFeatureId } from '@/lib/domain/features/catalogue';
import { pageHelp } from '@/lib/domain/features/help';
import { FEATURE_SETTINGS_ANCHOR, pageHref, pageLabel, pagePath, type AbsentPageNotice, type IrrigationPageId } from '@/lib/domain/features/pages';
import { usesPushNotifications } from '@/lib/domain/features/socle';
import type { DemoSelection } from '@/lib/domain/demo/catalogue';
import type { UnfinishedStep } from '@/lib/domain/onboarding/steps';
import { createSeasons, sourceLabel } from '../hierarchy/presentation';
import { Icon } from '../line-icon';
import { FeatureBanner } from './feature-banner';
import { FeatureMenu, takeMenuNavigation } from './feature-menu';
import { UnfinishedBanner } from './unfinished-banner';
import { PageTitle } from './page-title';
import { Topbar } from './topbar';
import { dateClockText } from '@/lib/domain/clock-text';

/**
 * Le gabarit commun des pages du module (3.8, docs/feature-selection-contract.md,
 * section 5) : l'en-tête, la navigation de la charte (menu à gauche sur
 * ordinateur, bande de pages en bas sur téléphone), la lecture d'Ouvre ta
 * ferme et le choix de la saison, là où elle change ce que la page montre
 * (audit ergonomique, point 9). Chaque page y pose ses blocs, dans l'ordre
 * d'avant la 3.8 (précision P13).
 */

export type ShellProps = {
  page: IrrigationPageId;
  /** Les pages du menu, dans l'ordre de la liste, Réglages en dernier. */
  menu: readonly IrrigationPageId[];
  season: number;
  /** Faux là où la saison ne change rien à la page : le choix n'est pas montré (audit ergonomique, point 9). */
  showSeason: boolean;
  seasonFirst: number;
  seasonLast: number;
  /** La parcelle choisie sur le plan, gardée d'une page à l'autre (P12). */
  zone: string | null;
  userName: string;
  signOutPath: string;
  source: IrrigationSnapshot['source'];
  lastSuccessfulReadAt: string;
  warning: string | null;
  /** Le bandeau du choix des fonctionnalités, jusqu'à ce qu'on le ferme (R6, R7). */
  banner: string | null;
  /** La page demandée n'était pas cochée : la ligne qui la nomme et mène à Réglages (P14, F265). */
  notice: AbsentPageNotice | null;
  /** Un déploiement de démonstration (docs/demo-guided-contract.md) : bannière permanente, aucune notification. */
  demo: boolean;
  /** En démonstration, la ferme fictive et le moment de l'invité. */
  demoSelection: DemoSelection | null;
  /** Les étapes de l'accueil à finir, dites sur chaque page (4.4, F582) ; vide pour une ferme réglée. */
  unfinished: readonly UnfinishedStep[];
};

export function IrrigationShell({
  children,
  controls,
  todayBadge,
  ...props
}: ShellProps & {
  children: ReactNode;
  /** Des choix propres à la page, posés à côté de la saison : la parcelle sur le plan. */
  controls?: ReactNode;
  /** La pastille de « Aujourd'hui » quand la page la connaît (F12) ; absente, le menu la lit après l'affichage. */
  todayBadge?: number | null;
}) {
  const { page, menu, season, showSeason, seasonFirst, seasonLast, zone, userName, signOutPath, source, lastSuccessfulReadAt, warning, banner, notice, demo, demoSelection, unfinished } = props;

  const shell = useRef<HTMLElement>(null);

  // Rejoué à chaque page : sans rechargement, le gabarit peut rester en place d'une page à l'autre (D-322).
  useEffect(() => {
    // La page répond aux clics : les parcours navigateur l'attendent avant d'agir
    // (docs/browser-journeys-contract.md), au lieu de réessayer leur premier clic.
    shell.current?.setAttribute('data-interactive', 'true');
    // Après un clic du menu, la page change sans rechargement (D-322) : le
    // clavier et le lecteur d'écran repartent du contenu de la nouvelle page,
    // comme après un chargement, au lieu de rester sur le lien du menu.
    if (takeMenuNavigation()) document.getElementById('contenu')?.focus({ preventScroll: true });
    // « Actualiser » relit Ouvre ta ferme une fois, et la ligne d'une page non
    // cochée se dit une fois : l'adresse ne garde ni l'une ni l'autre.
    const url = new URL(window.location.href);
    if (!url.searchParams.has('refresh') && !url.searchParams.has('absente')) return;
    url.searchParams.delete('refresh');
    url.searchParams.delete('absente');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, [page]);

  const updatedAt = dateClockText(lastSuccessfulReadAt, 'Europe/Paris', 'long');
  const title = pageLabel(page);

  return (
    <main ref={shell} className="app-shell" data-page={page}>
      {/* Le premier arrêt du clavier saute la barre et le menu (audit ergonomique, lot 3, point 14). */}
      <a className="skip-link" href="#contenu">Aller au contenu</a>
      <Topbar
        userName={userName}
        signOutPath={signOutPath}
        demo={demo}
        demoSelection={demoSelection}
        tour={demo ? { current: page, reachable: menu, query: { season, zone } } : null}
        notificationsHref={usesPushNotifications(menu.filter(isPageFeatureId)) ? pageHref('reglages', { season, zone }, 'notifications-title') : null}
      />

      <div className="feature-layout">
        {/* Un menu neuf à chaque page, comme après un rechargement (D-322) : la feuille « Plus » refermée, la pastille relue. */}
        <FeatureMenu key={page} menu={menu} current={page} query={{ season, zone }} todayBadge={todayBadge} />

        <div className="feature-page" id="contenu" tabIndex={-1}>
          <section className="intro" aria-labelledby="page-title">
            <PageTitle
              title={title}
              help={pageHelp(page)}
              aside={showSeason ? <SeasonPicker page={page} season={season} seasonFirst={seasonFirst} seasonLast={seasonLast} compact /> : null}
            />
            <div className="sync-card" data-source={source} role="status">
              <span className="status-dot" aria-hidden="true" />
              <span className="sync-copy">
                <strong>{sourceLabel(source)}</strong>
                <small>Dernière lecture réussie le {updatedAt}</small>
              </span>
              <a className="refresh-link" href={pageHref(page, { season, zone, refresh: true })}>
                Actualiser
              </a>
            </div>
          </section>

          {notice ? (
            <p className="feature-notice" role="status">
              {notice.text}{' '}
              <a href={pageHref('reglages', { season, zone }, FEATURE_SETTINGS_ANCHOR)}>{notice.settingsLabel}</a>
            </p>
          ) : null}

          <UnfinishedBanner steps={unfinished} query={{ season, zone }} />

          {banner ? <FeatureBanner text={banner} settingsHref={page === 'reglages' ? null : pageHref('reglages', { season, zone })} /> : null}

          {warning ? (
            <aside className="cache-warning" role="alert">
              <strong>Données en cache</strong>
              <span>{warning} Dernière synchronisation : {updatedAt}.</span>
            </aside>
          ) : null}

          {showSeason || controls ? (
            // Au téléphone, la saison passe dans la ligne du titre (F7) : un bloc qui ne porte qu'elle disparaît.
            <section className={controls ? 'plan-controls' : 'plan-controls plan-controls-season-only'} aria-label={controls ? 'Choix du plan affiché' : 'Choix de la saison'}>
              {showSeason ? <SeasonPicker page={page} season={season} seasonFirst={seasonFirst} seasonLast={seasonLast} /> : null}
              {controls}
            </section>
          ) : null}

          {children}

          <footer className="read-only-note">
            <span><Icon name="coche" /></span>
            <p>
              <strong>Données OTF protégées.</strong> Le module lit le plan de la ferme sans jamais le modifier. Le matériel est enregistré uniquement dans le module d’irrigation.
            </p>
          </footer>
        </div>
      </div>
    </main>
  );
}

/**
 * Le choix de la saison : sous le titre à l'ordinateur, dans la ligne du
 * titre au téléphone, en un petit menu de 44 px (audit ergonomique, point 2,
 * précision F7). Les deux existent ; la feuille de style montre celui de la
 * largeur. Un choix recharge la page sur la saison choisie.
 */
function SeasonPicker({ page, season, seasonFirst, seasonLast, compact = false }: {
  page: IrrigationPageId;
  season: number;
  seasonFirst: number;
  seasonLast: number;
  compact?: boolean;
}) {
  const select = (
    <select
      name="season"
      value={season}
      aria-label={compact ? 'Saison' : undefined}
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
    >
      {createSeasons(seasonFirst, seasonLast).map((item) => (
        <option key={item} value={item}>
          Saison {item}
        </option>
      ))}
    </select>
  );
  return (
    <form className={compact ? 'title-season' : 'season-form'} action={pagePath(page)} method="get">
      {compact ? select : (
        <label className="control-field">
          <span>Saison</span>
          {select}
        </label>
      )}
    </form>
  );
}
