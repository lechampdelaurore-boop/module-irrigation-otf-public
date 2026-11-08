'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './line-icon';

/**
 * « Fait comme prévu » en un geste (audit ergonomique, lot 3, point 6.5,
 * docs/audit-ergonomie-lot3-contract.md, section 3, cas 7, précision F43) :
 * sur une ligne « À traiter » de « Arrosages » et sur « Votre journée »
 * d'« Aujourd'hui ». Rien n'est enregistré au premier clic : une confirmation
 * d'une ligne répète l'irrigation, son heure et son volume, et dit qu'elle ne
 * se corrigera plus (D-006). Le bouton n'existe que pour une irrigation que la
 * règle de `lib/domain/done-as-planned.ts` accepte, la même que « Tout est
 * fait » ; le serveur la rejuge à l'enregistrement.
 */
export function DoneAsPlannedButton({ title, confirmation, pending, onConfirm }: {
  /** « Goutte-à-goutte B · Réglage 1 » : le nom que le bouton porte pour un lecteur d'écran. */
  title: string;
  /** La phrase de `doneAsPlannedConfirmation`. */
  confirmation: string;
  pending: boolean;
  /** La confirmation se ferme quand la promesse est tenue. */
  onConfirm: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);

  const confirm = async () => {
    await onConfirm();
    setOpen(false);
  };

  return (
    <>
      <button type="button" className="done-as-planned" disabled={pending} aria-label={`Fait comme prévu : ${title}`} onClick={() => setOpen(true)}>
        <Icon name="coche" />
        Fait comme prévu
      </button>
      <dialog ref={dialog} className="done-as-planned-dialog" aria-labelledby={titleId} onClose={() => setOpen(false)}>
        <h3 id={titleId}>Fait comme prévu ?</h3>
        <p>{confirmation}</p>
        <div className="irrigation-dialog-actions">
          <button type="button" disabled={pending} onClick={() => setOpen(false)}>Ne rien enregistrer</button>
          <button type="button" className="primary" disabled={pending} onClick={() => void confirm()}>
            {pending ? 'Enregistrement…' : 'Enregistrer comme faite'}
          </button>
        </div>
      </dialog>
    </>
  );
}
