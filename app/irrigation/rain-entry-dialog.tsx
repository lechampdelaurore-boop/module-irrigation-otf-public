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
 * qui l'ouvre ; le « + » de S3 monte son formulaire dans sa feuille. Les
 * jours, le jour par défaut, la lecture du chiffre et le mot du bouton
 * viennent du domaine (`lib/domain/today/rain-entry.ts`). Un refus se lit
 * dans la fenêtre ;
 * l'enregistrement la ferme, et la page qui l'a ouverte écrit la réponse
 * sous son bouton.
 */
export function RainEntryDialog({ open, entry, season, planning, besoinsHref, besoinsLabel, onClose, onSaved }: {
  open: boolean;
  entry: RainEntry;
  season: number;
  /** « Le plan se recalcule » ne se dit que « Planning » coché. */
  planning: boolean;
  /** Retirer une mesure ou voir jour par jour reste dans « Pluie mesurée » de « Semaine » (lot S4, PR 4) ; `null` : pas de lien. */
  besoinsHref: string | null;
  /** Le mot du lien, quand il mène dans la page même (le pli « Pluie mesurée » de « Semaine », S4, PR 3). */
  besoinsLabel?: string;
  onClose: () => void;
  /** La réponse, à écrire sous le bouton qui a ouvert la fenêtre ; la page se relit. */
  onSaved: (text: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // Fermer pendant l'enregistrement laisserait la réponse sans fenêtre : le formulaire le dit.
  const [pending, setPending] = useState(false);
  // Un formulaire neuf à chaque ouverture : le jour par défaut, le champ vide, aucun refus d'avant. Il
  // se refait à la fermeture, jamais à l'ouverture : refait après `showModal`, il perdrait le clavier,
  // que la fenêtre vient de poser sur « Quel jour ? ».
  const [opening, setOpening] = useState(0);

  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) {
      dialog.current.close();
      setOpening((value) => value + 1);
    }
  }, [open]);

  const close = () => {
    if (pending) return;
    onClose();
  };

  return (
    <dialog
      ref={dialog}
      className="module-confirm-dialog rain-entry-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); close(); }}
    >
      <h3 id={titleId}>{RAIN_ENTRY_TITLE}</h3>
      <RainEntryForm
        key={opening}
        className="module-confirm-body rain-entry-form"
        entry={entry}
        season={season}
        planning={planning}
        besoinsHref={besoinsHref}
        besoinsLabel={besoinsLabel}
        onPending={setPending}
        onClose={close}
        onSaved={onSaved}
      />
    </dialog>
  );
}

/**
 * Le formulaire de « Noter la pluie », seul : la fenêtre d'« Aujourd'hui » le
 * monte dans sa boîte de dialogue, la feuille du « + » (S3, section 4.1) dans
 * la feuille, sans changer de page. Le même jour par défaut, la même lecture
 * du chiffre, le même bouton qui dit le chiffre, la même action.
 */
export function RainEntryForm({ className, entry, season, planning, besoinsHref, besoinsLabel = 'sur « Semaine », dans « Pluie mesurée »', onPending, onClose, onSaved }: {
  className: string;
  entry: RainEntry;
  season: number;
  planning: boolean;
  besoinsHref: string | null;
  besoinsLabel?: string;
  onPending?: (pending: boolean) => void;
  /** « Fermer » ; absent, le formulaire n'en a pas (la feuille a le sien). */
  onClose?: () => void;
  onSaved: (text: string) => void;
}) {
  const dayId = useId();
  const amountId = useId();
  const hintId = useId();
  const [date, setDate] = useState(entry.defaultDate);
  const [text, setText] = useState('');
  const [refusal, setRefusal] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    onPending?.(pending);
  }, [pending, onPending]);

  const day = entry.days.find((item) => item.date === date) ?? entry.days[0];
  const reading = readRainMm(text);
  const button = rainButton(day, reading);
  const problem = rainReadingProblem(reading);
  const already = rainAlreadyText(day);

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
    <form
      className={className}
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
          {/* Le lien ferme la fenêtre : sur la même page, le pli qu'il ouvre ne reste pas sous elle (S4, PR 3). */}
          Retirer une mesure, voir jour par jour : <a href={besoinsHref} onClick={onClose}>{besoinsLabel}</a>
        </p>
      ) : null}
      <div className="irrigation-dialog-actions">
        {onClose ? <button type="button" disabled={pending} onClick={onClose}>Fermer</button> : null}
        <button type="submit" className="primary" disabled={pending || !button.enabled}>
          {pending ? 'Enregistrement…' : button.label}
        </button>
      </div>
    </form>
  );
}
