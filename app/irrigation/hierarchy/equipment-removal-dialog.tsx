'use client';
import { localDateTimeInputValue } from '@/lib/domain/irrigation-timer';

/**
 * « Retirer (stocker) » : la confirmation, avec la date du retrait proposée à
 * maintenant et reportable dans le passé (2.11, règles 2 à 5). Le matériel
 * est stocké, rien ne s'efface ; un refus dit pourquoi.
 */
export function EquipmentRemovalDialog({
  equipmentName,
  removedAt,
  error,
  pending,
  onRemovedAtChange,
  onCancel,
  onConfirm,
}: {
  equipmentName: string;
  removedAt: string;
  error: string | null;
  pending: boolean;
  onRemovedAtChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="irrigation-dialog-backdrop" role="presentation" onMouseDown={() => !pending && onCancel()}>
      <div
        className="irrigation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="equipment-removal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <p className="eyebrow">Confirmation</p>
        <h3 id="equipment-removal-title">Retirer et stocker {equipmentName}</h3>
        <p>
          Le matériel sera stocké : il n’arrosera plus rien, ses irrigations passées
          restent dans l’historique, et il pourra être reposé.
        </p>
        <label>
          <span>Date du retrait</span>
          <input
            type="datetime-local"
            max={localDateTimeInputValue(new Date())}
            value={removedAt}
            onChange={(event) => onRemovedAtChange(event.target.value)}
          />
        </label>
        {error ? <p className="equipment-error" role="alert">{error}</p> : null}
        <div className="irrigation-dialog-actions">
          <button type="button" disabled={pending} onClick={onCancel}>Annuler</button>
          <button type="button" className="primary" disabled={pending || !removedAt} onClick={onConfirm}>
            {pending ? 'Enregistrement…' : 'Retirer et stocker'}
          </button>
        </div>
      </div>
    </div>
  );
}
