'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/** L'ancre du pli, la même sur chaque page : `…#reglages-de-la-page` l'ouvre. */
export const PAGE_SETTINGS_ANCHOR = 'reglages-de-la-page';

/**
 * Le pli « Réglages de cette page » (audit ergonomique final, lot D, J2,
 * docs/audit-ergonomie-final-lot-d-contract.md, section 5, F305 à F307) : en
 * bas de la page, fermé, il range ce qui se règle une fois pour toutes, loin
 * du travail du jour. Rien n'y est retiré ni désactivé : il s'ouvre par son
 * ancre ou par celle d'un élément qu'il contient, au chargement comme à un
 * lien suivi dans la page, et la recherche du navigateur y trouve le texte
 * replié. Ouvert d'office quand `openReason` dit pourquoi.
 */
export function PageSettingsFold({ children, openReason = null }: { children: ReactNode; openReason?: string | null }) {
  return (
    <AnchoredFold
      id={PAGE_SETTINGS_ANCHOR}
      className="page-settings"
      initiallyOpen={openReason !== null}
      summary={(
        <>
          <strong>Réglages de cette page</strong>
          {openReason ? <small>{openReason}</small> : <small>Ce qui se règle une fois pour toutes ; rien n’y change le travail du jour.</small>}
        </>
      )}
      bodyClassName="page-settings-body"
    >
      {children}
    </AnchoredFold>
  );
}

/**
 * Un pli fermé qui s'ouvre par son ancre ou par celle d'un élément qu'il
 * contient, au chargement comme à un lien suivi dans la page : la règle du
 * pli « Réglages de cette page », reprise pour « Correspondance des
 * espèces » (audit du 19 novembre 2026, lot J, n° 15, F459).
 */
export function AnchoredFold({ id, className, summary, bodyClassName, initiallyOpen = false, children }: {
  id: string;
  className: string;
  summary: ReactNode;
  bodyClassName: string;
  initiallyOpen?: boolean;
  children: ReactNode;
}) {
  const fold = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(initiallyOpen);

  useEffect(() => {
    const openWhenTargeted = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const target = id ? document.getElementById(id) : null;
      if (!target || !fold.current?.contains(target)) return;
      setOpen(true);
      requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
    };
    openWhenTargeted();
    window.addEventListener('hashchange', openWhenTargeted);
    return () => window.removeEventListener('hashchange', openWhenTargeted);
  }, []);

  return (
    <details ref={fold} id={id} className={className} open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>{summary}</summary>
      <div className={bodyClassName}>{children}</div>
    </details>
  );
}
