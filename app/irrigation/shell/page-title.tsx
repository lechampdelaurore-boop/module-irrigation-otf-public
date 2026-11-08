'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { PageHelp } from '@/lib/domain/features/help';

/**
 * Le titre de la page et son « ? » (3.8, docs/feature-selection-contract.md,
 * section 6) : un bouton ouvre, sous le titre, à quoi sert la page, comment
 * la lire et par où commencer. Il se referme d'un second geste, par
 * « Fermer » ou par la touche Échap. Au téléphone, le choix de la saison se
 * pose à côté du « ? » (audit ergonomique, point 2, précision F7).
 */
export function PageTitle({ title, help, aside = null }: { title: string; help: PageHelp; aside?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const toggle = useRef<HTMLButtonElement>(null);

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

  return (
    <div className="page-heading">
      <div className="page-title-row">
        <h1 id="page-title">{title}</h1>
        <button
          ref={toggle}
          type="button"
          className="page-help-toggle"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={`Aide : ${title}`}
          title="Aide de la page"
          onClick={() => setOpen((value) => !value)}
        >
          ?
        </button>
        {aside}
      </div>
      <div id={panelId} className="page-help" role="region" aria-label={`Aide : ${title}`} hidden={!open}>
        <dl>
          <div><dt>À quoi sert cette page</dt><dd>{help.purpose}</dd></div>
          <div><dt>Comment la lire</dt><dd>{help.reading}</dd></div>
          <div><dt>Par où commencer</dt><dd>{help.firstStep}</dd></div>
        </dl>
        <button type="button" className="secondary-button page-help-close" onClick={() => { setOpen(false); toggle.current?.focus(); }}>
          Fermer
        </button>
      </div>
    </div>
  );
}
