'use client';

import Link from 'next/link';
import { BACK_TO_FARM_LABEL, weekBand, weekBandLabel } from '@/lib/domain/features/phone-bar';
import { pageHref, pageLabel, type IrrigationPageId, type PageQuery } from '@/lib/domain/features/pages';
import { Icon } from '../line-icon';
import { markMenuNavigation } from './feature-menu';

/**
 * Les chemins entre les pages d'un endroit, au téléphone (simplification,
 * lot S3, PR 2, docs/simplification-s3-contract.md, sections 3.3 et 5.1 ;
 * D-331) : la bande « La semaine », sous le titre d'une page de « Semaine »,
 * et le retour « ‹ » vers les fiches de « Ma ferme », au début de la ligne du
 * titre. Là où la barre du bas remplace le menu (jusqu'à 980 px) ; à
 * l'ordinateur, le menu de gauche montre déjà toutes les pages. Comme le
 * menu, ils changent de page sans recharger le module (D-322).
 */
export function WeekBand({ menu, current, query }: { menu: readonly IrrigationPageId[]; current: IrrigationPageId; query: PageQuery }) {
  const pages = weekBand(menu, current);
  if (!pages) return null;
  return (
    <nav className="week-band" aria-label="La semaine">
      <ul>
        {pages.map((page) => (
          <li key={page}>
            <Link
              href={pageHref(page, query)}
              prefetch={false}
              onClick={page === current ? undefined : markMenuNavigation}
              aria-label={pageLabel(page)}
              aria-current={page === current ? 'page' : undefined}
            >
              {weekBandLabel(page, pageLabel(page))}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Le retour « ‹ » de 44 px vers « Ma ferme », la saison gardée (section 5.1). */
export function BackToFarm({ query }: { query: PageQuery }) {
  return (
    <Link className="page-back" href={pageHref('ma-ferme', query)} prefetch={false} onClick={markMenuNavigation} aria-label={BACK_TO_FARM_LABEL}>
      <Icon name="retour" />
    </Link>
  );
}
