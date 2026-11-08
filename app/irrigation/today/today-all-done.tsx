'use client';

import { useEffect, useRef, useState } from 'react';
import { ALL_DONE_TEXT, type AllDone } from '@/lib/domain/today/all-done';
import { countText } from '@/lib/domain/today/today-text';
import { Icon } from '../line-icon';

/**
 * « Tout est fait » (docs/aujourdhui-tableau-de-bord-contract.md,
 * section 3.4) : le bouton en tête de « Votre journée », puis la
 * confirmation. Rien n'est enregistré au premier clic : la confirmation liste
 * par jour ce qui sera enregistré, chaque ligne cochée ; on décoche ce qui n'a
 * pas été fait, un jour entier ou une irrigation ; le bouton dit le nombre
 * exact ; « Annuler » ferme sans rien écrire.
 */
export function TodayAllDone({ allDone, pending, onConfirm }: {
  allDone: AllDone;
  pending: boolean;
  /** Les irrigations cochées ; la confirmation se ferme quand la promesse est tenue. */
  onConfirm: (eventEquipmentIds: string[]) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [unchecked, setUnchecked] = useState<ReadonlySet<string>>(new Set());
  const ids = allDone.days.flatMap((day) => day.items.map((item) => item.eventEquipmentId));
  const selected = ids.filter((id) => !unchecked.has(id));

  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);

  const show = () => {
    setUnchecked(new Set());
    setOpen(true);
  };
  const toggle = (toggled: readonly string[], checked: boolean) => setUnchecked((current) => {
    const next = new Set(current);
    for (const id of toggled) {
      if (checked) next.delete(id);
      else next.add(id);
    }
    return next;
  });
  const confirm = async () => {
    await onConfirm(selected);
    setOpen(false);
  };

  return (
    <>
      <button type="button" className="today-all-done" disabled={pending} onClick={show}>
        <Icon name="coche" />
        Tout est fait ({allDone.count})
      </button>
      <dialog ref={dialog} className="today-done-dialog" aria-labelledby="today-done-title" onClose={() => setOpen(false)}>
        <p className="eyebrow">Confirmation</p>
        <h3 id="today-done-title">Enregistrer comme faites</h3>
        <p>{ALL_DONE_TEXT.recordedAs}</p>
        <p className="today-done-final">{ALL_DONE_TEXT.final}</p>
        <div className="today-done-days">
          {allDone.days.map((day) => {
            const dayIds = day.items.map((item) => item.eventEquipmentId);
            const dayChecked = dayIds.filter((id) => !unchecked.has(id)).length;
            return (
              <fieldset key={day.day} className="today-done-day">
                <legend className="sr-only">{day.title}</legend>
                <label className="today-done-check" data-kind="day">
                  <DayCheckbox
                    checked={dayChecked === dayIds.length}
                    indeterminate={dayChecked > 0 && dayChecked < dayIds.length}
                    disabled={pending}
                    onChange={(checked) => toggle(dayIds, checked)}
                  />
                  <span><b>{day.title}</b><small>{day.summary}</small></span>
                </label>
                <ul>
                  {day.items.map((item) => (
                    <li key={item.eventEquipmentId}>
                      <label className="today-done-check">
                        <input
                          type="checkbox"
                          checked={!unchecked.has(item.eventEquipmentId)}
                          disabled={pending}
                          onChange={(event) => toggle([item.eventEquipmentId], event.target.checked)}
                        />
                        <span><b>{item.hours}</b> {item.title}<small>{item.detail}</small></span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            );
          })}
        </div>
        {allDone.notOver.length > 0 ? (
          <p className="today-done-note">
            Pas encore finie{allDone.notOver.length > 1 ? 's' : ''} : {allDone.notOver.map((item) => `${item.title}, jusqu’à ${item.endHour}`).join(' ; ')}.
          </p>
        ) : null}
        <p className="today-done-note">{ALL_DONE_TEXT.notHere}</p>
        <div className="irrigation-dialog-actions">
          <button type="button" disabled={pending} onClick={() => setOpen(false)}>Annuler</button>
          <button type="button" className="primary" disabled={pending || selected.length === 0} onClick={() => void confirm()}>
            {pending ? 'Enregistrement…' : `Enregistrer ${countText(selected.length, 'irrigation', 'irrigations')}`}
          </button>
        </div>
      </dialog>
    </>
  );
}

/** La case d'un jour : cochée quand toutes ses irrigations le sont, à moitié quand certaines seulement. */
function DayCheckbox({ checked, indeterminate, disabled, onChange }: {
  checked: boolean;
  indeterminate: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (input.current) input.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return <input ref={input} type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />;
}
