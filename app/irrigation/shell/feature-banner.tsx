'use client';

import { useState, useTransition } from 'react';
import { Icon } from '../line-icon';
import { dismissFeatureBannerAction } from '../feature-selection-actions';

/**
 * Le bandeau du choix des fonctionnalités (docs/feature-selection-contract.md,
 * R6 et R7) : affiché jusqu'à ce qu'on le ferme d'un geste, ou qu'on fasse son
 * choix dans Réglages. Le fermer ne coche ni ne décoche rien.
 */
export function FeatureBanner({ text, settingsHref }: { text: string; settingsHref: string | null }) {
  const [open, setOpen] = useState(true);
  const [, startTransition] = useTransition();
  if (!open) return null;
  return (
    <aside className="feature-banner" aria-label="Choix des fonctionnalités">
      <span className="feature-banner-icon"><Icon name="reglages" /></span>
      <p>{text}</p>
      <div className="feature-banner-actions">
        {settingsHref ? <a href={settingsHref}>Choisir dans Réglages</a> : null}
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            startTransition(async () => {
              await dismissFeatureBannerAction();
            });
          }}
        >
          Fermer
        </button>
      </div>
    </aside>
  );
}
