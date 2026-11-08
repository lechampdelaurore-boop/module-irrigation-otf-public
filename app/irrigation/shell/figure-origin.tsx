'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

/** Au-delà, la bulle se pose sous son bouton ; en deçà, au-dessus de la barre des pages (help.css). */
const WIDE_SCREEN = '(min-width: 981px)';
const BUBBLE_WIDTH_PX = 320;
const MARGIN_PX = 16;
const GAP_PX = 8;

/**
 * La bulle « d'où vient ce chiffre » (3.8, docs/feature-selection-contract.md,
 * section 6), posée à côté d'un chiffre principal : un bouton l'ouvre et la
 * referme, la touche Échap aussi. Le texte vient du module du calcul ; sans
 * texte (chiffre non calculable), rien ne s'affiche. Fermée, elle n'ajoute
 * aucun texte au chiffre : le « i » est dessiné par la feuille de style et la
 * bulle n'existe qu'ouverte.
 *
 * Sur un écran large, la bulle est fixée sous son bouton, dans la fenêtre :
 * un tableau qui défile ne la coupe pas et elle ne fait jamais déborder la
 * page ; elle suit son bouton quand la page défile.
 */
export function FigureOrigin({ text }: { text: string | null }) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<CSSProperties | undefined>(undefined);
  const bubbleId = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  const bubble = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      toggle.current?.focus();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  // Sous le bouton, dans la fenêtre, et au-dessus quand la place manque en
  // bas ; reposée quand la page ou un tableau défile.
  useLayoutEffect(() => {
    if (!open || !window.matchMedia(WIDE_SCREEN).matches) return;
    let frame = 0;
    const reposition = () => {
      if (!toggle.current) return;
      const anchor = toggle.current.getBoundingClientRect();
      const width = Math.min(BUBBLE_WIDTH_PX, window.innerWidth - 2 * MARGIN_PX);
      const left = Math.min(Math.max(MARGIN_PX, anchor.left - 12), window.innerWidth - width - MARGIN_PX);
      const height = bubble.current?.getBoundingClientRect().height ?? 0;
      const below = anchor.bottom + GAP_PX;
      const top = below + height > window.innerHeight - MARGIN_PX ? Math.max(MARGIN_PX, anchor.top - GAP_PX - height) : below;
      setPlace({ position: 'fixed', top, left, width });
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(reposition);
    };
    reposition();
    window.addEventListener('scroll', schedule, { capture: true, passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule, { capture: true });
      window.removeEventListener('resize', schedule);
    };
  }, [open]);

  if (!text) return null;
  const wide = open && window.matchMedia(WIDE_SCREEN).matches;
  return (
    <span className="figure-origin" data-open={open ? 'true' : undefined}>
      <button
        ref={toggle}
        type="button"
        className="figure-origin-toggle"
        aria-expanded={open}
        aria-controls={open ? bubbleId : undefined}
        aria-label="D’où vient ce chiffre ?"
        title="D’où vient ce chiffre ?"
        onClick={() => setOpen((value) => !value)}
      />
      {open ? (
        <span ref={bubble} id={bubbleId} className="figure-origin-bubble" role="note" style={wide ? place : undefined}>
          {text}
          <button type="button" className="figure-origin-close" aria-label="Fermer" onClick={() => { setOpen(false); toggle.current?.focus(); }}>×</button>
        </span>
      ) : null}
    </span>
  );
}
