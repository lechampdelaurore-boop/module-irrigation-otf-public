'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import type { FeatureId } from '@/lib/domain/features/catalogue';
import { checkFeature, uncheckFeature, type FeatureSelection } from '@/lib/domain/features/selection';
import { saveFeatureSelectionAction } from '../feature-selection-actions';
import { FeatureChoiceList } from '../shell/feature-choice-list';
import type { DemoSelection } from '@/lib/domain/demo/catalogue';
import { Topbar } from '../shell/topbar';

/** La ferme vierge de la démonstration n'a pas encore de menu : ses visites se jouent sur cette page (D3). */
const WELCOME_TOUR = { current: 'bienvenue', reachable: [], query: {} } as const;

/** Le choix de la première ouverture (R5) : il faut au moins une case pour continuer (P7). */
export function WelcomeChoice({ userName, signOutPath, demo, demoSelection }: {
  userName: string;
  signOutPath: string;
  demo: boolean;
  demoSelection: DemoSelection | null;
}) {
  const shell = useRef<HTMLElement>(null);
  const [selection, setSelection] = useState<FeatureSelection>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    // La page répond aux clics (docs/browser-journeys-contract.md).
    shell.current?.setAttribute('data-interactive', 'true');
  }, []);

  const toggle = (id: FeatureId, checked: boolean) => {
    setError(null);
    if (checked) {
      setSelection(checkFeature(selection, id));
      return;
    }
    const result = uncheckFeature(selection, id);
    // Le brouillon peut redevenir vide : « Continuer » attend alors une case.
    if (result.ok) setSelection(result.selection);
    else if (result.reason === 'last') setSelection([]);
  };

  const submit = () => {
    startTransition(async () => {
      const result = await saveFeatureSelectionAction({ enabled: selection });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      window.location.assign(result.firstPage);
    });
  };

  return (
    <main ref={shell} className="app-shell welcome-shell">
      <Topbar userName={userName} signOutPath={signOutPath} demo={demo} demoSelection={demoSelection} tour={demo ? WELCOME_TOUR : null} />
      <section className="welcome-choice" aria-labelledby="welcome-title">
        <p className="eyebrow">Première ouverture</p>
        <h1 id="welcome-title">Choisissez vos fonctionnalités</h1>
        <p>
          Cochez ce dont votre ferme a besoin : seules les fonctionnalités cochées s’affichent et tournent. Une fonctionnalité qui
          en demande d’autres les coche avec elle. Vous pourrez changer ce choix à tout moment dans Réglages, sans rien perdre.
        </p>
        <FeatureChoiceList selection={selection} disabled={pending} keepOne={false} onToggle={toggle} />
        {error ? <p className="water-error" role="alert">{error}</p> : null}
        <div className="welcome-actions">
          <p role="status">
            {selection.length === 0
              ? 'Cochez au moins une fonctionnalité pour continuer.'
              : `${selection.length} fonctionnalité${selection.length > 1 ? 's' : ''} cochée${selection.length > 1 ? 's' : ''}.`}
          </p>
          <button type="button" className="primary-button" disabled={pending || selection.length === 0} onClick={submit}>
            {pending ? 'Enregistrement…' : 'Continuer'}
          </button>
        </div>
      </section>
    </main>
  );
}
