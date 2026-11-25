'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

/**
 * « Le détail » (simplification, lot S2, PR 5, docs/simplification-s2-contract.md,
 * section 8) : un seul pli, fermé, sous le premier niveau. Rien n'en sort de
 * la page : les tuiles, l'eau et la réserve par jardin, l'eau disponible, la
 * fiabilité entière, les trois jours de « Gel ou chaleur » et la frise y
 * restent, avec leurs liens et leurs boutons, jusqu'à ce que « Semaine » (S4)
 * et « Ma ferme » (S3) leur donnent leur place.
 *
 * Les ancres existantes l'ouvrent seules (`#today-weather`,
 * `#today-reliability`, `#today-water`…), à l'arrivée sur la page comme au
 * changement d'adresse, comme `AnchoredFold` ailleurs : aucun lien d'une
 * notification, d'une pastille ou d'une autre page ne perd son effet.
 * `reveal` ouvre le pli sur un bloc même quand l'adresse porte déjà l'ancre.
 */
export function useTodayDetail() {
  const fold = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);

  const scrollTo = (id: string) => requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }));

  useEffect(() => {
    const openWhenTargeted = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const target = id ? document.getElementById(id) : null;
      if (!target || !fold.current?.contains(target) || target === fold.current) return;
      setOpen(true);
      scrollTo(id);
    };
    openWhenTargeted();
    window.addEventListener('hashchange', openWhenTargeted);
    return () => window.removeEventListener('hashchange', openWhenTargeted);
  }, []);

  const reveal = useCallback((id: string) => {
    setOpen(true);
    window.history.replaceState(window.history.state, '', `#${id}`);
    scrollTo(id);
  }, []);

  return { fold, open, setOpen, reveal };
}

export function TodayDetail({ foldRef, open, onOpenChange, summary, children }: {
  foldRef: RefObject<HTMLDetailsElement | null>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** « 4 chiffres · 3 jardins · 2 données à rafraîchir ». */
  summary: string;
  children: ReactNode;
}) {
  // Le navigateur ouvre seul un pli qui contient l'ancre de l'adresse, avant que React ne s'attache :
  // l'attribut `open` peut alors différer du rendu serveur, sans faute ; l'effet de l'ancre recale l'état.
  return (
    <details ref={foldRef} id="today-detail" className="today-detail" open={open} suppressHydrationWarning onToggle={(event) => onOpenChange(event.currentTarget.open)}>
      <summary>
        <span className="today-detail-title">Le détail</span>
        <span className="today-detail-count">{summary}</span>
      </summary>
      <div className="today-detail-body">{children}</div>
    </details>
  );
}
