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
  const fold = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(openReason !== null);

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
    <details ref={fold} id={PAGE_SETTINGS_ANCHOR} className="page-settings" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>
        <strong>Réglages de cette page</strong>
        {openReason ? <small>{openReason}</small> : <small>Ce qui se règle une fois pour toutes ; rien n’y change le travail du jour.</small>}
      </summary>
      <div className="page-settings-body">{children}</div>
    </details>
  );
}
