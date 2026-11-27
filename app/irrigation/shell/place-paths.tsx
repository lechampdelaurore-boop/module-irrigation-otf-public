'use client';

import Link from 'next/link';
import { BACK_TO_FARM_LABEL } from '@/lib/domain/features/phone-bar';
import { pageHref, type IrrigationPageId, type PageQuery } from '@/lib/domain/features/pages';
import { weekViewLabel, weekViewSelector, type WeekViewId } from '@/lib/domain/features/week-page';
import { Icon } from '../line-icon';
import { markMenuNavigation } from './feature-menu';

/**
 * Les chemins entre les pages d'un endroit, au téléphone et à l'ordinateur
 * (simplification, lot S3, PR 2, docs/simplification-s3-contract.md,
 * section 5.1 ; lot S4, docs/simplification-s4-contract.md, section 3.2) :
 * le retour « ‹ » vers les fiches de « Ma ferme », au début de la ligne du
 * titre, et le sélecteur des deux vues de « Semaine », sous le titre, dans la
 * ligne que S3 réservait à la bande de la semaine, qu'il remplace. Comme le
 * menu, ils changent de page sans recharger le module (D-322).
 */
export function WeekViews({ menu, current, query }: { menu: readonly IrrigationPageId[]; current: WeekViewId; query: PageQuery }) {
  const views = weekViewSelector(menu);
  if (!views) return null;
  return (
    <nav className="week-views" aria-label="Vues de la semaine">
      <ul>
        {views.map((view) => (
          <li key={view}>
            <Link
              href={pageHref('semaine', { ...query, view })}
              prefetch={false}
              onClick={view === current ? undefined : markMenuNavigation}
              aria-current={view === current ? 'page' : undefined}
            >
              {weekViewLabel(view)}
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
