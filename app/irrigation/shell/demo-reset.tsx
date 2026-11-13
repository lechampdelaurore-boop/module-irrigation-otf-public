'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { resetDemoSpaceAction } from '../demo-actions';

/** L'entrée du module : la page d'arrivée de la ferme, rouverte en entier après la remise à zéro. */
const MODULE_ENTRY = '/irrigation';

/**
 * Le bouton « Remettre à zéro » de la bannière de la démonstration
 * (docs/demo-guided-contract.md, section 8 ; D4) : rien ne s'efface sans
 * confirmation. La fenêtre dit ce qui revient au premier jour (la ferme et le
 * moment ouverts) et ce qui ne change pas (les autres) ; Échap ou « Annuler »
 * la ferment en rendant le focus au bouton.
 */
export function DemoReset({ farm, moment }: { farm: string; moment: string | null }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const id = useId();

  function close() {
    setOpen(false);
    setMessage(null);
    button.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || pending) return;
      setOpen(false);
      setMessage(null);
      button.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, pending]);

  async function confirm() {
    setPending(true);
    setMessage(null);
    const result = await resetDemoSpaceAction();
    if (result.ok) {
      window.location.assign(new URL(MODULE_ENTRY, window.location.origin));
      return;
    }
    setPending(false);
    setMessage(result.message);
  }

  const what = moment ? `« ${farm} », au moment « ${moment} »,` : `« ${farm} »`;
  return (
    <div className="demo-reset">
      <button
        ref={button}
        type="button"
        className="demo-reset-button"
        data-tour="remise-a-zero"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => (open ? close() : setOpen(true))}
      >
        Remettre à zéro
      </button>
      {open ? (
        <div ref={dialog} id={id} className="demo-reset-dialog" role="dialog" aria-modal="false" aria-labelledby={`${id}-title`}>
          <h2 id={`${id}-title`}>Remettre à zéro ?</h2>
          <p>La ferme {what} revient à son premier jour : vos essais y disparaissent. Les autres fermes et les autres moments ne changent pas.</p>
          {message ? <p role="alert" className="demo-reset-error">{message}</p> : null}
          <div className="demo-reset-actions">
            <button type="button" className="demo-reset-confirm" disabled={pending} onClick={confirm}>
              {pending ? 'Remise à zéro…' : 'Remettre à zéro'}
            </button>
            <button type="button" className="demo-reset-cancel" disabled={pending} onClick={close}>Annuler</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
