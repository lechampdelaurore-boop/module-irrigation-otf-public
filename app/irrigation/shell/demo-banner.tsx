'use client';

import { DEMO_BANNER_TEXT } from '@/lib/domain/demo/deployment-mode';
import { Icon } from '../line-icon';

/**
 * La bannière permanente de la démonstration (docs/demo-guided-contract.md,
 * sections 4 et 9) : au-dessus de la barre du haut, sur toutes les pages, sans
 * bouton pour la fermer. Le bouton « Remettre la démonstration à zéro » s'y
 * ajoutera avec la remise à zéro (D4).
 */
export function DemoBanner() {
  return (
    <aside className="demo-banner" aria-label="Démonstration" data-demo-banner="true">
      <span className="demo-banner-icon"><Icon name="bouclier" /></span>
      <p>{DEMO_BANNER_TEXT}</p>
    </aside>
  );
}
