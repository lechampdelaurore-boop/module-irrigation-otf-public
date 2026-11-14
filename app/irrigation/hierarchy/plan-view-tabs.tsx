'use client';
import { useRef, type KeyboardEvent } from 'react';

export type PlanView = 'plan' | 'satellite';

const VIEWS: { id: PlanView; label: string }[] = [
  { id: 'plan', label: 'Plan' },
  { id: 'satellite', label: 'Vue satellite' },
];

/**
 * Les onglets du bloc de la parcelle (S3, F204) : le plan des jardins et de
 * leurs planches, ou la vue satellite. Flèches gauche et droite, Début et Fin
 * passent d'un onglet à l'autre, comme le veut le motif des onglets.
 */
export function PlanViewTabs({ view, onChange }: { view: PlanView; onChange: (view: PlanView) => void }) {
  const buttons = useRef<Partial<Record<PlanView, HTMLButtonElement | null>>>({});
  const moveTo = (index: number) => {
    const next = VIEWS[(index + VIEWS.length) % VIEWS.length].id;
    onChange(next);
    buttons.current[next]?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const target = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: VIEWS.length - 1 }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    moveTo(target);
  };
  return (
    <div className="plan-view-tabs" role="tablist" aria-label="Vue de la parcelle">
      {VIEWS.map(({ id, label }, index) => (
        <button
          key={id}
          ref={(element) => {
            buttons.current[id] = element;
          }}
          id={`plan-view-tab-${id}`}
          type="button"
          role="tab"
          aria-selected={view === id}
          aria-controls="plan-view-panel"
          tabIndex={view === id ? 0 : -1}
          data-active={view === id}
          onClick={() => onChange(id)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
