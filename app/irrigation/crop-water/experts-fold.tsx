'use client';

import type { ReactNode } from 'react';

/**
 * Le repli « Pour les experts » (audit ergonomique, lot 3, point 8) : le
 * détail technique — sources, formes des courbes, formule de l'ETM, lissage
 * des stades — reste le même, replié sous le texte en clair.
 */
export function ExpertsFold({ children }: { children: ReactNode }) {
  return (
    <details className="experts-fold" suppressHydrationWarning>
      <summary>Pour les experts</summary>
      <div className="experts-fold-body">{children}</div>
    </details>
  );
}
