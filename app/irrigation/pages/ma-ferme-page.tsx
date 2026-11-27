'use client';

import Link from 'next/link';
import type { FarmCard } from '@/lib/domain/features/farm-cards';
import { pageHref, pageLabel, type PageQuery } from '@/lib/domain/features/pages';
import { Icon } from '../line-icon';
import { markMenuNavigation } from '../shell/feature-menu';
import { PAGE_ICONS } from '../shell/page-icons';

/**
 * Les fiches de « Ma ferme » (simplification, lot S3, PR 1,
 * docs/simplification-s3-contract.md, section 5) : l'icône de la page, son
 * nom, une ligne fixe, un chevron, une cible de 68 px au moins. Le lien garde
 * la saison et la parcelle de la page (P12). Comme le menu, il change de page
 * sans recharger le module (D-322) et porte le clavier sur le contenu de la
 * page ouverte. « À faire », en orange, quand l'accueil de la ferme attend une
 * étape de cette page. La ligne dit l'état de la fiche quand il est connu
 * (lot S6, PR 3), sinon la ligne fixe : `data-line` le dit aux parcours.
 */
export function FarmCards({ cards, query }: { cards: readonly FarmCard[]; query: PageQuery }) {
  return (
    <nav className="farm-cards" aria-label="Les fiches de Ma ferme">
      <ul>
        {cards.map((card) => (
          <li key={card.page}>
            <Link className="farm-card" href={pageHref(card.page, query)} prefetch={false} onClick={markMenuNavigation} data-todo={card.todo ? 'true' : undefined}>
              <span className="farm-card-icon"><Icon name={PAGE_ICONS[card.page]} /></span>
              <span className="farm-card-text">
                <strong>{pageLabel(card.page)}</strong>
                <span className="farm-card-line" data-line={card.lineKind}>{card.line}</span>
                {card.todo ? <span className="farm-card-todo">{card.todo}</span> : null}
              </span>
              <span className="farm-card-chevron"><Icon name="chevron" /></span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
