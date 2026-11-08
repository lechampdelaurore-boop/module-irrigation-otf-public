'use client';
import type { IrrigationEventRecord } from '@/lib/domain/irrigation-event-record';


export function FinishIrrigationDialog({
  event,
  finishAt,
  pending,
  onFinishAtChange,
  onCancel,
  onConfirm,
}: {
  event: IrrigationEventRecord;
  finishAt: string;
  pending: boolean;
  onFinishAtChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="irrigation-dialog-backdrop" role="presentation" onMouseDown={onCancel}>
      <div
        className="irrigation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="finish-irrigation-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <p className="eyebrow">Confirmation</p>
        <h3 id="finish-irrigation-title">Terminer l’irrigation</h3>
        <p>
          Vérifiez que la vanne de <strong>{event.equipment.equipmentSnapshot.name}</strong> est fermée, puis confirmez l’heure réelle.
        </p>
        <label>
          <span>Heure réelle de fin</span>
          <input
            type="datetime-local"
            step="1"
            value={finishAt}
            onChange={(event) => onFinishAtChange(event.target.value)}
          />
        </label>
        <div className="irrigation-dialog-actions">
          <button type="button" disabled={pending} onClick={onCancel}>Retour</button>
          <button type="button" className="primary" disabled={pending} onClick={onConfirm}>
            {pending ? 'Enregistrement…' : 'Irrigation terminée'}
          </button>
        </div>
      </div>
    </div>
  );
}
