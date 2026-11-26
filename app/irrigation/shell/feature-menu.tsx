'use client';

import { useId } from 'react';
import Link from 'next/link';
import { menuLayout } from '@/lib/domain/features/menu-groups';
import { phoneBar } from '@/lib/domain/features/phone-bar';
import { pageHref, pageLabel, type IrrigationPageId, type PageQuery } from '@/lib/domain/features/pages';
import { placeLabel } from '@/lib/domain/features/places';
import { plusGestures } from '@/lib/domain/features/plus-sheet';
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
 * Depuis le tableau de bord (docs/aujourdhui-tableau-de-bord-contract.md,
 * section 3.1), « Aujourd'hui » est détaché en tête dans son encart, les
 * autres pages rangées en trois groupes titrés, Réglages à part en bas.
 *
 * Depuis la simplification, lot S3, PR 2 (D-331), la barre du téléphone
 * montre les trois endroits et le « + » (`phoneBar`) : « Plus » et sa
 * feuille n'existent plus ; le bouton rond qui dépasse est le « + ». Le menu
 * de l'ordinateur reste celui d'avant jusqu'à la PR 3 du lot.
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
  /** Le jour ouvert de la page courante : l'entrée « Semaine » le garde, comme la bande (section 3.3). */
  week?: string | null;
}) {
  const gestures = plusGestures(menu, rainMatters);
  const bar = phoneBar(menu, current, gestures.length > 0);
  const layout = menuLayout(menu);
  const badge = useTodayBadge(menu, todayBadge);
  const badgeOf = (item: IrrigationPageId) => (item === 'aujourdhui' && badge !== null ? badge : null);
  const menuId = useId();

  return (
    <>
      <nav className="phone-bar" data-tour="menu" aria-label="Pages principales" data-entries={bar.length}>
        <ul>
          {bar.map((item) => (item.kind === 'plus' ? (
            <li key="plus" data-plus>
              <PlusSheet
                gestures={gestures}
                season={query.season ?? null}
                planning={menu.includes('planning')}
                besoinsHref={menu.includes('besoins') ? pageHref('besoins', query) : null}
              />
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
      <nav id={menuId} className="feature-menu" data-tour="menu" aria-label="Pages du module">
        <ul>
          {layout.today ? (
            <li className="menu-home-item">
              <Link
                className="menu-home"
                prefetch={false}
                onClick={current === 'aujourdhui' ? undefined : markMenuNavigation}
                href={pageHref('aujourdhui', query)}
                aria-label={todayBadgeLabel(pageLabel('aujourdhui'), badgeOf('aujourdhui'))}
                aria-current={current === 'aujourdhui' ? 'page' : undefined}
              >
                <span className="menu-home-badge"><Icon name={PAGE_ICONS.aujourdhui} /></span>
                <span className="menu-home-text">
                  <strong>{pageLabel('aujourdhui')}</strong>
                  <small>Tableau de bord</small>
                </span>
                <TodayBadge count={badgeOf('aujourdhui')} />
              </Link>
            </li>
          ) : null}
          {layout.groups.map((group) => (
            <li key={group.title} className="menu-group">
              <span className="menu-group-title" id={`${menuId}-${group.title}`}>{group.title}</span>
              <ul aria-labelledby={`${menuId}-${group.title}`}>
                {group.pages.map((item) => <MenuLink key={item} item={item} current={current} query={query} />)}
              </ul>
            </li>
          ))}
          {layout.farm || layout.settings ? (
            <li className="menu-settings-item">
              <ul>
                {layout.farm ? <MenuLink item="ma-ferme" current={current} query={query} /> : null}
                {layout.settings ? <MenuLink item="reglages" current={current} query={query} /> : null}
              </ul>
            </li>
          ) : null}
        </ul>
      </nav>
    </>
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
