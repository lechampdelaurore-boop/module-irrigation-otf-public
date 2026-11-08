'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { featureLabel, type FeatureId } from '@/lib/domain/features/catalogue';
import { checkConfirmation, joinLabels } from '@/lib/domain/features/choice';
import { pageHref } from '@/lib/domain/features/pages';
import { checkFeature, uncheckFeature, type FeatureSelection } from '@/lib/domain/features/selection';
import { uncheckWarning, type FeatureDataCounts } from '@/lib/domain/features/warnings';
import { saveFeatureSelectionAction } from '../feature-selection-actions';
import { FeatureChoiceList } from '../shell/feature-choice-list';

type PendingChange = { selection: FeatureId[]; title: string; text: string; confirm: string };

/**
 * La liste des cases dans Réglages (docs/feature-selection-contract.md, R2,
 * R3, R8, R9) : chaque geste s'applique tout de suite et la page se recharge
 * sur le nouveau choix. Cocher une case qui en entraîne d'autres le dit avant ;
 * décocher une case qui a des données ouvre l'avertissement.
 */
export function FeatureSettings({
  selection,
  counts,
  season,
  zone,
}: {
  selection: FeatureSelection;
  counts: FeatureDataCounts;
  season: number;
  zone: string | null;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [change, setChange] = useState<PendingChange | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (change && !dialog.current?.open) dialog.current?.showModal();
  }, [change]);

  const close = () => {
    dialog.current?.close();
    setChange(null);
  };

  const apply = (next: FeatureId[]) => {
    setError(null);
    startTransition(async () => {
      const result = await saveFeatureSelectionAction({ enabled: next, season });
      if (!result.ok) {
        dialog.current?.close();
        setChange(null);
        setError(result.message);
        return;
      }
      window.location.assign(pageHref('reglages', { season, zone }));
    });
  };

  const toggle = (id: FeatureId, checked: boolean) => {
    setError(null);
    const label = featureLabel(id);
    if (checked) {
      const next = checkFeature(selection, id);
      const text = checkConfirmation(selection, id);
      if (text) setChange({ selection: next, title: `Cocher « ${label} » ?`, text, confirm: 'Cocher' });
      else apply(next);
      return;
    }
    const result = uncheckFeature(selection, id);
    if (!result.ok) {
      setError(result.reason === 'last'
        ? 'Au moins une fonctionnalité reste cochée.'
        : `« ${label} » est nécessaire pour ${joinLabels(result.requiredBy.map(featureLabel))} : décochez d’abord ${result.requiredBy.length > 1 ? 'celles-ci' : 'celle-ci'}.`);
      return;
    }
    const text = uncheckWarning(id, counts);
    if (text) setChange({ selection: result.selection, title: `Décocher « ${label} » ?`, text, confirm: 'Décocher' });
    else apply(result.selection);
  };

  return (
    <section className="water-management-section feature-settings" aria-labelledby="feature-settings-title">
      <header className="water-management-heading">
        <div>
          <h2 id="feature-settings-title">Fonctionnalités de la ferme</h2>
          <p>
            Seules les fonctionnalités cochées s’affichent et tournent, pour toute la ferme. Décocher n’efface rien : les données
            reviennent telles quelles quand on recoche.
          </p>
        </div>
      </header>
      {error ? <p className="water-error" role="alert">{error}</p> : null}
      {pending && !change ? <p className="water-notice" role="status">Enregistrement du choix…</p> : null}
      <FeatureChoiceList selection={selection} disabled={pending} keepOne onToggle={toggle} />

      <dialog ref={dialog} className="irrigation-dialog feature-dialog" aria-labelledby="feature-dialog-title" onClose={() => setChange(null)}>
        <p className="eyebrow">Confirmation</p>
        <h3 id="feature-dialog-title">{change?.title}</h3>
        <p>{change?.text}</p>
        <div className="irrigation-dialog-actions">
          <button type="button" disabled={pending} onClick={close}>Annuler</button>
          <button type="button" className="primary" disabled={pending || !change} onClick={() => change && apply(change.selection)}>
            {pending ? 'Enregistrement…' : change?.confirm}
          </button>
        </div>
      </dialog>
    </section>
  );
}
