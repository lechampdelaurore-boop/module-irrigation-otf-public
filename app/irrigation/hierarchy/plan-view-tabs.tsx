'use client';
import { useRef, type KeyboardEvent } from 'react';

/** La largeur du téléphone, celle de responsive.css. */
const PHONE_SCREEN = '(max-width: 600px)';
/** Moins que cela de la carte à l'écran, et elle se cherche : les onglets montent en haut (F271). */
const VISIBLE_MAP_MIN_PX = 200;

export type PlanView = 'plan' | 'satellite';

const VIEWS: { id: PlanView; label: string }[] = [
  { id: 'plan', label: 'Plan' },
  { id: 'satellite', label: 'Vue satellite' },
];

/**
 * Les onglets du bloc de la parcelle (S3, F204) : le plan des jardins et de
 * leurs planches, ou la vue satellite. Flèches gauche et droite, Début et Fin
 * passent d'un onglet à l'autre, comme le veut le motif des onglets. Au
 * téléphone, choisir « Vue satellite » amène les onglets en haut de l'écran
 * quand la carte commencerait sous l'écran (audit final, lot E, J15, F271).
 */
export function PlanViewTabs({ view, onChange }: { view: PlanView; onChange: (view: PlanView) => void }) {
  const buttons = useRef<Partial<Record<PlanView, HTMLButtonElement | null>>>({});
  const tabList = useRef<HTMLDivElement | null>(null);
  const choose = (next: PlanView) => {
    onChange(next);
    if (next === 'satellite' && view !== 'satellite') bringSatelliteIntoView(tabList.current);
  };
  const moveTo = (index: number) => {
    const next = VIEWS[(index + VIEWS.length) % VIEWS.length].id;
    choose(next);
    buttons.current[next]?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const target = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: VIEWS.length - 1 }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    moveTo(target);
  };
  return (
    <div ref={tabList} className="plan-view-tabs" role="tablist" aria-label="Vue de la parcelle">
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
          onClick={() => choose(id)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Après l'affichage du panneau : au téléphone, s'il reste moins de 200 px de la carte à l'écran, les onglets montent en haut. */
function bringSatelliteIntoView(tabs: HTMLDivElement | null): void {
  if (!tabs || !window.matchMedia(PHONE_SCREEN).matches) return;
  window.requestAnimationFrame(() => {
    // La carte, une fois le panneau affiché ; les onglets eux-mêmes tant qu'elle n'y est pas.
    const map = document.querySelector('#plan-view-panel .satellite-map-frame') ?? tabs;
    if (window.innerHeight - map.getBoundingClientRect().top >= VISIBLE_MAP_MIN_PX) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    tabs.scrollIntoView({ block: 'start', behavior: reducedMotion ? 'auto' : 'smooth' });
  });
}
