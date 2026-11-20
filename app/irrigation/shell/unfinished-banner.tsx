'use client';

import { pageHref } from '@/lib/domain/features/pages';
import type { UnfinishedStep } from '@/lib/domain/onboarding/steps';

/**
 * Le bandeau « À finir » de l'accueil (4.4, docs/tranche-4-contract.md,
 * section 8 bis.3, F582) : chaque page dit ce qui manque encore à la ferme et
 * renvoie à l'endroit de Réglages où le faire, sans erreur ni zéro. Il ne se
 * ferme pas : il part quand l'étape est faite.
 */
export function UnfinishedBanner({ steps, query }: { steps: readonly UnfinishedStep[]; query: { season: number; zone: string | null } }) {
  if (steps.length === 0) return null;
  return (
    <aside className="onboarding-unfinished" aria-label="Accueil de la ferme à finir">
      <p>
        <strong>À finir :</strong>{' '}
        {steps.map((step, index) => (
          <span key={step.id}>
            {index > 0 ? ', ' : null}
            <a href={pageHref('reglages', query, step.anchor)}>{step.text}</a>
          </span>
        ))}
        .
      </p>
    </aside>
  );
}
