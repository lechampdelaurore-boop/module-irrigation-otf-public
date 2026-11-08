'use client';

import { featureLabel } from '@/lib/domain/features/catalogue';
import { pageHref } from '@/lib/domain/features/pages';
import type { FeaturePart } from '@/lib/domain/features/socle';

/**
 * La ligne qui remplace une partie de case quand la case dont elle a besoin
 * n'est pas cochée (docs/feature-selection-contract.md, précision P1) : elle
 * le dit, sans imposer cette case.
 */
export function PartUnavailable({ part, season }: { part: FeaturePart; season: number }) {
  return (
    <p className="feature-part-unavailable" role="note" data-part={part.id}>
      {part.missingNotice}{' '}
      <a href={pageHref('reglages', { season })}>Cocher « {featureLabel(part.needs)} » dans Réglages</a>
    </p>
  );
}
