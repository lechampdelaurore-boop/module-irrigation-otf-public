'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { RAIN_ENTRY_TITLE, RAIN_ZERO_HINT, rainAlreadyText, rainButton, rainReadingProblem, rainSavedText, readRainMm, type RainEntry } from '@/lib/domain/today/rain-entry';
import { weekStartDateKey } from '@/lib/domain/water-management';
import { saveManualRainfallAction } from './water-actions';

/**
 * « Noter la pluie » (simplification, lot S2, PR 4,
 * docs/simplification-s2-contract.md, section 7) : la pluie du pluviomètre
 * d'un jour, notée d'un geste par l'action existante
 * `saveManualRainfallAction`, qui fait recalculer le plan de sa semaine.
 * Un composant partagé de `app/irrigation/` : il ne suppose rien de la page
 * qui l'ouvre (le « + » de S3 l'ouvrira aussi). Les jours, le jour par
 * défaut, la lecture du chiffre et le mot du bouton viennent du domaine
 * (`lib/domain/today/rain-entry.ts`). Un refus se lit dans la fenêtre ;
 * l'enregistrement la ferme, et la page qui l'a ouverte écrit la réponse
 * sous son bouton.
 */
export function RainEntryDialog({ open, entry, season, planning, besoinsHref, onClose, onSaved }: {
  open: boolean;
  entry: RainEntry;
  season: number;
  /** « Le plan se recalcule » ne se dit que « Planning » coché. */
  planning: boolean;
  /** Retirer une mesure ou voir jour par jour reste sur « Objectifs et besoins » ; `null` : pas de lien. */
  besoinsHref: string | null;
  onClose: () => void;
  /** La réponse, à écrire sous le bouton qui a ouvert la fenêtre ; la page se relit. */
  onSaved: (text: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const dayId = useId();
  const amountId = useId();
  const hintId = useId();
  const [date, setDate] = useState(entry.defaultDate);
  const [text, setText] = useState('');
  const [refusal, setRefusal] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);

  const day = entry.days.find((item) => item.date === date) ?? entry.days[0];
  const reading = readRainMm(text);
  const button = rainButton(day, reading);
  const problem = rainReadingProblem(reading);
  const already = rainAlreadyText(day);
  const close = () => {
    if (pending) return;
    setText('');
    setRefusal(null);
    setDate(entry.defaultDate);
    onClose();
  };

  const save = () => {
    if (!reading.ok) return;
    const mm = reading.mm;
    startTransition(async () => {
      const result = await saveManualRainfallAction({ season, weekStart: weekStartDateKey(date), date, precipitationMm: mm });
      if (!result.ok) {
        setRefusal(result.message);
        return;
      }
      setText('');
      setRefusal(null);
      setDate(entry.defaultDate);
      onSaved(rainSavedText(date, mm, planning));
    });
  };

  return (
    <dialog
      ref={dialog}
      className="module-confirm-dialog rain-entry-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); close(); }}
    >
      <h3 id={titleId}>{RAIN_ENTRY_TITLE}</h3>
      <form
        className="module-confirm-body rain-entry-form"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <label htmlFor={dayId}>Quel jour ?</label>
        <select id={dayId} value={date} disabled={pending} onChange={(event) => { setDate(event.target.value); setRefusal(null); }}>
          {entry.days.map((item) => <option key={item.date} value={item.date}>{item.label}</option>)}
        </select>
        {already ? <p className="rain-entry-already">{already}</p> : null}
        <label htmlFor={amountId}>Combien ?</label>
        <span className="rain-entry-amount">
          <input
            id={amountId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={text}
            disabled={pending}
            aria-describedby={hintId}
            aria-invalid={problem ? true : undefined}
            onChange={(event) => { setText(event.target.value); setRefusal(null); }}
          />
          <span aria-hidden="true">mm</span>
        </span>
        <p id={hintId} className="rain-entry-hint">{problem ?? RAIN_ZERO_HINT}</p>
        {refusal ? <p className="rain-entry-refusal" role="alert">{refusal}</p> : null}
        {besoinsHref ? (
          <p className="rain-entry-more">
            Retirer une mesure, voir jour par jour : <a href={besoinsHref}>sur « Objectifs et besoins »</a>
          </p>
        ) : null}
        <div className="irrigation-dialog-actions">
          <button type="button" disabled={pending} onClick={close}>Fermer</button>
          <button type="submit" className="primary" disabled={pending || !button.enabled}>
            {pending ? 'Enregistrement…' : button.label}
          </button>
        </div>
      </form>
    </dialog>
  );
}
