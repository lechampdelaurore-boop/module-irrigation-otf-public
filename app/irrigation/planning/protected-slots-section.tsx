'use client';

import { useState, useTransition } from 'react';
import { WEEKDAYS, validateProtectedSlotDraft, type ProtectedSlot, type Weekday } from '@/lib/domain/planning/protected-slots';
import {
  PROTECTED_SLOT_REFUSED,
  WEEKDAY_LABELS,
  protectedSlotDraftFromForm,
  protectedSlotForm,
  protectedSlotLine,
  protectedSlotVersionLine,
  type ProtectedSlotForm,
} from '@/lib/domain/planning/protected-slots-view';
import {
  deleteProtectedSlotAction,
  loadProtectedSlotHistoryAction,
  saveProtectedSlotAction,
  type ProtectedSlotHistoryEntry,
  type ProtectedSlotsActionResult,
} from '../protected-slots-actions';
import { capitalize, formatDateTime } from './format';

/** Le créneau en cours de saisie : un nouveau (`slotId` nul) ou un existant. */
type Editing = { slotId: string | null; form: ProtectedSlotForm };

/**
 * La section « Créneaux protégés » du pli « Réglages du planning »
 * (docs/protected-slots-contract.md, section 7, règles 7 et 8) : une ligne
 * par créneau, ajouter, modifier, supprimer, et le journal de leurs valeurs.
 * Un créneau vaut au prochain calcul, comme tout réglage du planning ; les
 * libellés et la saisie viennent de `lib/domain/planning/protected-slots-view.ts`.
 */
export function ProtectedSlotsSection({ initialSlots }: { initialSlots: ProtectedSlot[] }) {
  const [slots, setSlots] = useState(initialSlots);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ProtectedSlotHistoryEntry[] | null>(null);
  const [pending, startTransition] = useTransition();

  const open = (slot: ProtectedSlot | null) => {
    setEditing({ slotId: slot?.id ?? null, form: protectedSlotForm(slot) });
    setErrors([]);
    setNotice(null);
    setError(null);
  };
  const update = (patch: Partial<ProtectedSlotForm>) => setEditing((current) => (current ? { ...current, form: { ...current.form, ...patch } } : current));
  const toggleDay = (day: Weekday, checked: boolean) => setEditing((current) => (current ? { ...current, form: { ...current.form, weekdays: { ...current.form.weekdays, [day]: checked } } } : current));

  const receive = (result: ProtectedSlotsActionResult, success: string) => {
    if (result.ok) {
      setSlots(result.slots);
      setEditing(null);
      setErrors([]);
      setHistory(null);
      setNotice(success);
    } else {
      setErrors(result.errors ?? []);
      setError(result.message);
    }
  };

  const save = () => {
    if (!editing) return;
    setNotice(null);
    setError(null);
    const { slotId, form } = editing;
    const draft = protectedSlotDraftFromForm(form);
    // La vérification du domaine d'abord, sans aller-retour ; le dépôt la refait avant d'écrire (S27).
    const checked = validateProtectedSlotDraft(draft);
    if (checked.value === null) {
      setErrors(checked.errors);
      setError(PROTECTED_SLOT_REFUSED);
      return;
    }
    const { name } = checked.value;
    startTransition(async () => {
      receive(await saveProtectedSlotAction({ slotId, draft }), `Créneau protégé « ${name} » enregistré : il vaut au prochain calcul.`);
    });
  };

  const remove = (slot: ProtectedSlot) => {
    if (!window.confirm(`Supprimer le créneau protégé « ${slot.name} » ? Le prochain calcul pourra de nouveau proposer des arrosages à ces heures ; le journal le garde.`)) return;
    setNotice(null);
    setError(null);
    startTransition(async () => {
      receive(await deleteProtectedSlotAction({ slotId: slot.id }), `Créneau protégé « ${slot.name} » supprimé : il ne vaut plus au prochain calcul.`);
    });
  };

  const loadHistory = () => startTransition(async () => {
    const result = await loadProtectedSlotHistoryAction();
    if (result.ok) setHistory(result.history);
    else setError(result.message);
  });

  return (
    <section className="protected-slots" aria-labelledby="protected-slots-title" data-tour="planning-creneaux">
      <h3 id="protected-slots-title">Créneaux protégés</h3>
      <p className="planning-settings-note">
        Des heures où le planning ne propose jamais d’arrosage, pour tout le matériel : le lavage des légumes, un passage, une livraison. Un créneau vaut au prochain calcul ; « Recalculer le plan » le prend tout de suite. Un arrosage déjà validé qui y tombe reçoit une suggestion ; rien n’est annulé sans vous.
      </p>
      {slots.length === 0 ? (
        <p className="planning-empty">Aucun créneau protégé : le planning peut arroser à toutes les heures des plages R8.</p>
      ) : (
        <ul className="protected-slot-list" aria-label="Créneaux protégés enregistrés">
          {slots.map((slot) => (
            <li key={slot.id}>
              <span>{protectedSlotLine(slot)}</span>
              <div className="planning-settings-actions">
                <button type="button" disabled={pending} aria-label={`Modifier le créneau protégé ${slot.name}`} onClick={() => open(slot)}>Modifier</button>
                <button type="button" className="danger-outline" disabled={pending} aria-label={`Supprimer le créneau protégé ${slot.name}`} onClick={() => remove(slot)}>Supprimer</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing ? (
        <form className="planning-settings-form protected-slot-form" aria-label={editing.slotId ? 'Modifier un créneau protégé' : 'Ajouter un créneau protégé'} onSubmit={(event) => { event.preventDefault(); save(); }}>
          <label>
            <span>Nom du créneau</span>
            <input value={editing.form.name} maxLength={80} placeholder="Ex. Lavage des légumes" onChange={(event) => update({ name: event.target.value })} />
          </label>
          <fieldset className="protected-slot-days">
            <legend>Jours où il commence</legend>
            {WEEKDAYS.map((day) => (
              <label key={day} className="planning-settings-toggle">
                <input type="checkbox" checked={editing.form.weekdays[day]} onChange={(event) => toggleDay(day, event.target.checked)} />
                <span>{capitalize(WEEKDAY_LABELS[day])}</span>
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Heures</legend>
            <label><span>Début</span><input type="time" aria-label="Début du créneau protégé" value={editing.form.start} onChange={(event) => update({ start: event.target.value })} /></label>
            <label>
              <span>Fin</span>
              <input type="time" aria-label="Fin du créneau protégé" value={editing.form.end} onChange={(event) => update({ end: event.target.value })} />
              <small>Une fin avant le début passe minuit : 22:00 – 02:00 protège jusqu’à 2 h le lendemain. Une journée entière : 00:00 – 23:59.</small>
            </label>
          </fieldset>
          {/* Le message d'un refus se lit avant ce qu'il annonce : « … n'est pas enregistré : » puis la liste. */}
          {error ? <p className="planning-error" role="alert">{error}</p> : null}
          {errors.length > 0 ? (
            <ul className="planning-issues" role="alert">
              {errors.map((message) => <li key={message}>{message}</li>)}
            </ul>
          ) : null}
          <div className="planning-settings-actions">
            <button type="submit" className="primary" disabled={pending}>Enregistrer le créneau</button>
            <button type="button" disabled={pending} onClick={() => { setEditing(null); setErrors([]); setError(null); }}>Abandonner</button>
          </div>
        </form>
      ) : null}
      {error && !editing ? <p className="planning-error" role="alert">{error}</p> : null}
      {notice ? <p className="planning-notice" role="status">{notice}</p> : null}
      {editing ? null : (
        <div className="planning-settings-actions">
          <button type="button" disabled={pending} onClick={() => open(null)}>Ajouter un créneau</button>
          <button type="button" disabled={pending} onClick={loadHistory}>Voir l’historique des créneaux</button>
        </div>
      )}
      {history ? (
        history.length === 0
          ? <p className="planning-empty">Aucun créneau protégé n’a encore été enregistré.</p>
          : (
            <ol className="planning-settings-history" aria-label="Historique des créneaux protégés">
              {history.map((entry, index) => (
                <li key={`${entry.id}-${entry.createdAt}-${index}`}>
                  <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
                  <span>{protectedSlotVersionLine(entry)}</span>
                </li>
              ))}
            </ol>
          )
      ) : null}
    </section>
  );
}
