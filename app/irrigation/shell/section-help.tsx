'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { SectionHelp } from '@/lib/domain/features/help';

/**
 * Le « ? » d'une partie de page (3.8, précision P38) : comme celui de la
 * page, il ouvre quelques entrées courtes, avec un schéma quand il en faut un,
 * et se referme d'un second geste, par « Fermer » ou par la touche Échap. La
 * partie place elle-même le bouton, à côté de son titre, et l'aide, sous son
 * en-tête.
 */
export function useSectionHelp(title: string, help: SectionHelp, figure?: ReactNode): { toggle: ReactNode; panel: ReactNode } {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  const toggle = (
    <button
      ref={button}
      type="button"
      className="page-help-toggle section-help-toggle"
      aria-expanded={open}
      aria-controls={panelId}
      aria-label={`Aide : ${title}`}
      title="Comment ça marche"
      onClick={() => setOpen((value) => !value)}
    >
      ?
    </button>
  );
  const panel = (
    <div id={panelId} className="page-help section-help" role="region" aria-label={`Aide : ${title}`} hidden={!open}>
      {figure}
      <dl>
        {help.entries.map((entry) => (
          <div key={entry.title}><dt>{entry.title}</dt><dd>{entry.text}</dd></div>
        ))}
      </dl>
      <button type="button" className="secondary-button page-help-close" onClick={() => { setOpen(false); button.current?.focus(); }}>
        Fermer
      </button>
    </div>
  );
  return { toggle, panel };
}
