'use client';

import { useEffect, useId, useRef } from 'react';

/**
 * La fenêtre de confirmation du module (audit du 19 novembre 2026, lot G,
 * F408) : un titre, une phrase, deux boutons, le geste qui ne fait rien à
 * gauche. Échap et ce bouton-là la ferment sans rien faire. Le bouton qui
 * confirme est vert pour ce qui ajoute, rouge pour ce qui efface ou annule.
 * Elle remplace la boîte grise du navigateur.
 */
export function ConfirmDialog({ open, title, children, confirmLabel, cancelLabel, tone = 'add', pending = false, onConfirm, onCancel }: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  /** `erase` : ce qui efface ou annule, confirmé en rouge. */
  tone?: 'add' | 'erase';
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className="module-confirm-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); if (!pending) onCancel(); }}
    >
      <h3 id={titleId}>{title}</h3>
      <div className="module-confirm-body">{children}</div>
      <div className="irrigation-dialog-actions">
        <button type="button" disabled={pending} onClick={onCancel}>{cancelLabel}</button>
        <button type="button" className={tone === 'erase' ? 'confirm-erase' : 'primary'} disabled={pending} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
