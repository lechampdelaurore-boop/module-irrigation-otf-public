'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { kcSourceLabel } from '@/lib/domain/crop-water/presentation';
import type { LinkCandidate } from '@/lib/domain/crop-water/species-linking';

/**
 * « Rattacher comme… » (audit ergonomique, lot 3, point 12, cas 9, précision
 * F44) : sous une espèce à rattacher, la culture du jeu commun que son nom
 * désigne. Rien n'est rattaché au premier clic : une confirmation nomme
 * l'espèce et la culture, dit que la proposition vient du nom seul, et
 * « Ne rien changer » ferme sans rien écrire. Le rattachement s'enregistre
 * sans analogie, comme un choix fait dans la liste.
 */
export function SpeciesLinkSuggestion({ plantName, crop, pending, onConfirm }: {
  plantName: string;
  crop: LinkCandidate;
  pending: boolean;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const source = kcSourceLabel(crop.source);

  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);

  return (
    <div className="species-link-suggestion">
      <span>D’après son nom : {crop.name} ({source})</span>
      <button type="button" disabled={pending} aria-label={`Rattacher ${plantName} comme ${crop.name}…`} onClick={() => setOpen(true)}>
        Rattacher comme {crop.name}…
      </button>
      <dialog ref={dialog} className="line-confirm-dialog" aria-labelledby={titleId} onClose={() => setOpen(false)}>
        <h3 id={titleId}>Rattacher {plantName} ?</h3>
        <p>
          L’espèce {plantName} suivra la culture de référence {crop.name} ({source}) : son besoin sera calculé avec ses Kc.
          La proposition vient du nom seul ; vous pourrez retirer le rattachement ensuite.
        </p>
        <div className="irrigation-dialog-actions">
          <button type="button" onClick={() => setOpen(false)}>Ne rien changer</button>
          <button type="button" className="primary" disabled={pending} onClick={() => { onConfirm(); setOpen(false); }}>Rattacher</button>
        </div>
      </dialog>
    </div>
  );
}
