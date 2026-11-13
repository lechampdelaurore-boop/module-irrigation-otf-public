'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { menuLayout } from '@/lib/domain/features/menu-groups';
import { phoneBar, phoneBarLabel } from '@/lib/domain/features/phone-bar';
import { pageHref, pageLabel, type IrrigationPageId, type PageQuery } from '@/lib/domain/features/pages';
import { Icon } from '../line-icon';
import { PAGE_ICONS } from './page-icons';
import { TodayBadge, todayBadgeLabel, useTodayBadge } from './today-badge';

/**
 * Le menu des pages du module (charte, deuxième passe de la refonte) : à
 * gauche sur ordinateur, en bande en bas sur tablette. Au téléphone (audit
 * ergonomique, point 2, 3.8 quater lot 2, précision F6), une barre du bas à
 * quatre entrées et « Plus », qui ouvre le menu entier en feuille au-dessus
 * de la barre. Il sert au gabarit de chaque page et à la page introuvable
 * (audit ergonomique, point 7), qui n'a pas de page courante : les deux
 * gardent le même menu. « Aujourd'hui » y porte sa pastille (F12).
 * Depuis le tableau de bord (docs/aujourdhui-tableau-de-bord-contract.md,
 * section 3.1), « Aujourd'hui » est détaché en tête dans son encart, les
 * autres pages rangées en trois groupes titrés, Réglages à part en bas ; au
 * téléphone, son entrée de la barre est un bouton rond qui dépasse.
 */
export function FeatureMenu({
  menu,
  current,
  query,
  todayBadge,
}: {
  menu: readonly IrrigationPageId[];
  current: IrrigationPageId | null;
  query: PageQuery;
  /** Le nombre de la pastille quand la page le connaît déjà ; absent, il est lu après l'affichage. */
  todayBadge?: number | null;
}) {
  const bar = phoneBar(menu, current);
  const layout = menuLayout(menu);
  const badge = useTodayBadge(menu, todayBadge);
  const badgeOf = (item: IrrigationPageId) => (item === 'aujourdhui' && badge !== null ? badge : null);
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const moreButton = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    // La feuille se referme par Échap ou par un geste en dehors d'elle.
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      moreButton.current?.focus();
    };
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && (sheet.current?.contains(target) || moreButton.current?.contains(target))) return;
      setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOutside);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('pointerdown', closeOutside);
    };
  }, [open]);

  return (
    <>
      <nav className="phone-bar" data-tour="menu" aria-label="Pages principales" data-entries={bar.entries.length + (bar.more ? 1 : 0)}>
        <ul>
          {bar.entries.map((item) => (
            <li key={item} data-home={item === 'aujourdhui' || undefined}>
              <a
                href={pageHref(item, query)}
                aria-label={todayBadgeLabel(pageLabel(item), badgeOf(item))}
                aria-current={item === current ? 'page' : undefined}
              >
                {item === 'aujourdhui' ? <span className="menu-home-badge"><Icon name={PAGE_ICONS[item]} /></span> : <Icon name={PAGE_ICONS[item]} />}
                <span>{phoneBarLabel(item, pageLabel(item))}</span>
                <TodayBadge count={badgeOf(item)} />
              </a>
            </li>
          ))}
          {bar.more ? (
            <li>
              <button
                ref={moreButton}
                type="button"
                className="phone-bar-more"
                aria-expanded={open}
                aria-controls={menuId}
                aria-label={bar.moreMarked ? `Plus de pages, dont la page ouverte : ${current ? pageLabel(current) : ''}` : 'Plus de pages'}
                data-marked={bar.moreMarked}
                onClick={() => setOpen((value) => !value)}
              >
                <Icon name="plus" />
                <span>Plus</span>
              </button>
            </li>
          ) : null}
        </ul>
      </nav>
      <nav ref={sheet} id={menuId} className="feature-menu" data-tour="menu" aria-label="Pages du module" data-open={open} data-phone-bar-only={!bar.more}>
        <ul>
          {layout.today ? (
            <li className="menu-home-item">
              <a
                className="menu-home"
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
              </a>
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
          {layout.settings ? (
            <li className="menu-settings-item">
              <ul>
                <MenuLink item="reglages" current={current} query={query} />
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
      <a href={pageHref(item, query)} aria-current={item === current ? 'page' : undefined}>
        <Icon name={PAGE_ICONS[item]} />
        <span>{pageLabel(item)}</span>
      </a>
    </li>
  );
}
