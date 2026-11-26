'use client';

/**
 * La fenêtre de fin d'une irrigation : la vanne à vérifier, l'heure réelle
 * à confirmer. Elle reçoit le nom du matériel et l'heure proposée, pas la
 * fiche entière : « Arrosages » et « Aujourd'hui » l'ouvrent tous deux
 * (simplification, lot S2, section 6).
 */
export function FinishIrrigationDialog({
  equipmentName,
  finishAt,
  pending,
  onFinishAtChange,
  onCancel,
  onConfirm,
}: {
  equipmentName: string;
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
          Vérifiez que la vanne de <strong>{equipmentName}</strong> est fermée, puis confirmez l’heure réelle.
        </p>
        <label>
          <span>Heure réelle de fin</span>
          <input
            type="datetime-local"
            step="60"
            value={finishAt}
            onChange={(event) => onFinishAtChange(event.target.value)}
          />
        </label>
        <div className="irrigation-dialog-actions">
          <button type="button" disabled={pending} onClick={onCancel}>Retour</button>
          <button type="button" className="primary" disabled={pending} onClick={onConfirm}>
            {pending ? 'Enregistrement…' : 'Terminer l’irrigation'}
          </button>
        </div>
      </div>
    </div>
  );
}
