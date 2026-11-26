'use client';

import Link from 'next/link';
import { menuPlaces } from '@/lib/domain/features/desktop-menu';
import { phoneBar } from '@/lib/domain/features/phone-bar';
import { pageHref, pageLabel, type IrrigationPageId, type PageQuery } from '@/lib/domain/features/pages';
import { placeLabel } from '@/lib/domain/features/places';
import { plusGestures } from '@/lib/domain/features/plus-sheet';
import { weekViewLabel, type WeekViewId } from '@/lib/domain/features/week-page';
import { Icon } from '../line-icon';
import { PAGE_ICONS, PLACE_ICONS } from './page-icons';
import { PlusSheet } from './plus-sheet';
import { TodayBadge, todayBadgeLabel, useTodayBadge } from './today-badge';

/**
 * Le menu des pages du module (charte, deuxième passe de la refonte) : à
 * gauche sur ordinateur ; au téléphone et à la tablette, jusqu'à 980 px, une
 * barre du bas (audit ergonomique, point 2, 3.8 quater lot 2 ; lot K, F481).
 * Il sert au gabarit de chaque page et à la page introuvable (audit
 * ergonomique, point 7), qui n'a pas de page courante : les deux
 * gardent le même menu. « Aujourd'hui » y porte sa pastille (F12).
 *
 * Depuis la simplification, lot S3 (D-331), les deux se rangent en trois
 * endroits, de la même fonction du domaine. La barre du téléphone (PR 2)
 * montre les trois endroits et le « + » (`phoneBar`) : « Plus » et sa
 * feuille n'existent plus ; le bouton rond qui dépasse est le « + ». Le menu
 * de l'ordinateur (PR 3, section 6) montre le bouton « + Arroser ou noter »
 * en tête, puis les trois endroits dépliés (`menuPlaces`) : « Aujourd'hui »
 * dans son encart, les titres « Semaine » et « Ma ferme » qui sont des
 * liens, Réglages dans « Ma ferme ». Depuis le lot S4, « Semaine » est une
 * page : son titre y mène, et ses deux vues, « La semaine » et « Les
 * cumuls », la suivent quand la ferme a les deux (S4-m).
 *
 * Un clic du menu ne recharge plus toute l'application (D-322) : `Link`
 * demande au serveur la seule page voulue, sans relancer les scripts ni
 * réhydrater l'écran, ce qui coûtait l'essentiel de l'attente au téléphone.
 * Rien n'est demandé d'avance (`prefetch={false}`) : chaque page est calculée
 * à la demande, et lire d'avance les quatre pages de la barre multipliait le
 * travail du serveur à l'ouverture.
 */
/**
 * Un clic du menu vient de lancer le changement de page (D-322) : la page
 * suivante le lit une fois pour porter le clavier sur son contenu.
 */
let menuNavigation = false;

/** Un lien qui change de page comme le menu (les fiches de « Ma ferme ») le marque aussi. */
export function markMenuNavigation(): void {
  menuNavigation = true;
}

export function takeMenuNavigation(): boolean {
  const taken = menuNavigation;
  menuNavigation = false;
  return taken;
}

export function FeatureMenu({
  menu,
  current,
  query,
  todayBadge,
  rainMatters = false,
  week = null,
  weekView = null,
}: {
  menu: readonly IrrigationPageId[];
  current: IrrigationPageId | null;
  query: PageQuery;
  /** Le nombre de la pastille quand la page le connaît déjà ; absent, il est lu après l'affichage. */
  todayBadge?: number | null;
  /**
   * La pluie compte pour la ferme (`farmRainMatters`, D-032) : le « + »
   * propose « Noter la pluie ». Faux sur la page introuvable, qui ne lit pas
   * le plan de la ferme.
   */
  rainMatters?: boolean;
  /** Le jour ouvert de la page courante : l'entrée « Semaine » le garde (S3, section 3.3). */
  week?: string | null;
  /** La vue ouverte de « Semaine », que sa ligne du menu marque (lot S4, S4-m). */
  weekView?: WeekViewId | null;
}) {
  const gestures = plusGestures(menu, rainMatters);
  const bar = phoneBar(menu, current, gestures.length > 0);
  const places = menuPlaces(menu, current);
  // Le « + » de la barre et celui du menu de l'ordinateur ouvrent la même feuille (section 6, S3-l).
  const plusProps = {
    gestures,
    season: query.season ?? null,
    planning: menu.includes('planning'),
    besoinsHref: menu.includes('besoins') ? pageHref('besoins', query) : null,
  };
  const badge = useTodayBadge(menu, todayBadge);
  const badgeOf = (item: IrrigationPageId) => (item === 'aujourdhui' && badge !== null ? badge : null);

  return (
    <>
      <nav className="phone-bar" data-tour="menu" aria-label="Pages principales" data-entries={bar.length}>
        <ul>
          {bar.map((item) => (item.kind === 'plus' ? (
            <li key="plus" data-plus>
              <PlusSheet variant="bar" {...plusProps} />
            </li>
          ) : (
            <li key={item.place} data-place={item.place}>
              <Link
                href={pageHref(item.page, item.place === 'semaine' ? { ...query, week } : query)}
                prefetch={false}
                onClick={item.current === 'page' ? undefined : markMenuNavigation}
                aria-label={item.place === 'aujourdhui' ? todayBadgeLabel(placeLabel(item.place), badgeOf(item.page)) : undefined}
                aria-current={item.current ?? undefined}
              >
                <Icon name={PLACE_ICONS[item.place]} />
                <span>{placeLabel(item.place)}</span>
                {item.place === 'aujourdhui' ? <TodayBadge count={badgeOf(item.page)} /> : null}
              </Link>
            </li>
          )))}
        </ul>
      </nav>
      <nav className="feature-menu" data-tour="menu" aria-label="Pages du module">
        <ul>
          {gestures.length > 0 ? (
            <li className="menu-plus-item">
              <PlusSheet variant="menu" {...plusProps} />
            </li>
          ) : null}
          {places.map((group) => {
            // La semaine garde le jour ouvert, comme la bande du téléphone (section 3.3, F885).
            const groupQuery = group.place === 'semaine' ? { ...query, week } : query;
            return (
              <li key={group.place} className="menu-place" data-place={group.place}>
                {group.entry === 'aujourdhui' ? (
                  <Link
                    className="menu-home"
                    prefetch={false}
                    onClick={group.mark === 'page' ? undefined : markMenuNavigation}
                    href={pageHref('aujourdhui', query)}
                    aria-label={todayBadgeLabel(pageLabel('aujourdhui'), badgeOf('aujourdhui'))}
                    aria-current={group.mark ?? undefined}
                  >
                    <span className="menu-home-badge"><Icon name={PAGE_ICONS.aujourdhui} /></span>
                    <span className="menu-home-text">
                      <strong>{pageLabel('aujourdhui')}</strong>
                      <small>Tableau de bord</small>
                    </span>
                    <TodayBadge count={badgeOf('aujourdhui')} />
                  </Link>
                ) : (
                  <Link
                    className="menu-place-title"
                    href={pageHref(group.entry, groupQuery)}
                    prefetch={false}
                    onClick={group.entry === current ? undefined : markMenuNavigation}
                    aria-current={group.mark ?? undefined}
                  >
                    <span>{placeLabel(group.place)}</span>
                    <Icon name="chevron" />
                  </Link>
                )}
                {group.pages.length > 0 ? (
                  <ul aria-label={placeLabel(group.place)}>
                    {group.pages.map((item) => <MenuLink key={item} item={item} current={current} query={groupQuery} />)}
                  </ul>
                ) : null}
                {group.views.length > 0 ? (
                  <ul aria-label={placeLabel(group.place)}>
                    {group.views.map((view) => <MenuViewLink key={view} view={view} current={current === 'semaine' ? weekView : null} query={groupQuery} />)}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

/** Une vue de « Semaine » dans le menu de l'ordinateur (S4-m) : « La semaine », « Les cumuls ». */
function MenuViewLink({ view, current, query }: { view: WeekViewId; current: WeekViewId | null; query: PageQuery }) {
  return (
    <li>
      <Link href={pageHref('semaine', { ...query, view })} prefetch={false} onClick={view === current ? undefined : markMenuNavigation} aria-current={view === current ? 'page' : undefined}>
        <Icon name={view === 'cumuls' ? PAGE_ICONS.historique : PAGE_ICONS.semaine} />
        <span>{weekViewLabel(view)}</span>
      </Link>
    </li>
  );
}

/** Une page du menu, hors « Aujourd'hui » : l'icône et le nom. */
function MenuLink({ item, current, query }: { item: IrrigationPageId; current: IrrigationPageId | null; query: PageQuery }) {
  return (
    <li>
      <Link href={pageHref(item, query)} prefetch={false} onClick={item === current ? undefined : markMenuNavigation} aria-current={item === current ? 'page' : undefined}>
        <Icon name={PAGE_ICONS[item]} />
        <span>{pageLabel(item)}</span>
      </Link>
    </li>
  );
}
