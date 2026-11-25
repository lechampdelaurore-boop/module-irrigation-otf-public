'use client';

import { useId, useRef, useState, type ReactNode } from 'react';
import { OTHER_CHOICES_LABEL } from '@/lib/domain/today/card-action';

/**
 * « Autres choix » d'une carte d'« Aujourd'hui » (simplification, lot S2,
 * docs/simplification-s2-contract.md, section 3) : un bouton qui déplie une
 * courte liste juste en dessous (`aria-expanded`). Échap la referme et rend
 * le focus au bouton ; un choix la referme aussi. Chaque entrée garde la
 * cible de 44 px.
 */
export function OtherChoices({ title, pending, children }: {
  /** Le nom de la carte, pour un lecteur d'écran : « Autres choix : Asperseur A · Buse 2, 7 h ». */
  title: string;
  pending: boolean;
  /** Les entrées : des liens ou des boutons, chacun dans un `<li>`. */
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    toggle.current?.focus();
  };
  return (
    <div
      className="today-other-choices"
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !open) return;
        event.stopPropagation();
        close();
      }}
    >
      <button
        ref={toggle}
        type="button"
        className="today-other-choices-toggle"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${OTHER_CHOICES_LABEL} : ${title}`}
        disabled={pending}
        onClick={() => setOpen((value) => !value)}
      >
        {OTHER_CHOICES_LABEL}
      </button>
      <ul
        id={listId}
        className="today-other-choices-list"
        hidden={!open}
        // Un choix fait referme la liste.
        onClick={(event) => {
          if (event.target instanceof HTMLElement && event.target.closest('a, button')) setOpen(false);
        }}
      >
        {children}
      </ul>
    </div>
  );
}
