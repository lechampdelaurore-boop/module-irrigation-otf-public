'use client';
import { sortByNameNaturally } from '@/lib/domain/bed-order';
import type { Bed } from '@/lib/domain/domain';
import type { EquipmentListItem } from '@/lib/domain/equipment-record';
import type { IrrigationPreparationMode } from '../irrigation-event/contract';
import { formatRate } from './presentation';

/**
 * Le mode de calcul et sa saisie : la quantité souhaitée (et la planche de
 * référence d'un asperseur), ou la durée en heures et minutes.
 */
export function PreparationFields({
  preparationMode, onPreparationModeChange, targetMillimeters, onTargetMillimetersChange,
  equipment, applications, referenceBedId, onReferenceBedIdChange,
  durationHours, onDurationHoursChange, durationMinutes, onDurationMinutesChange,
}: {
  preparationMode: IrrigationPreparationMode;
  onPreparationModeChange: (mode: IrrigationPreparationMode) => void;
  targetMillimeters: string;
  onTargetMillimetersChange: (value: string) => void;
  equipment: EquipmentListItem | null;
  applications: ReadonlyArray<{ bed: Bed; rateMmPerHour: number }>;
  referenceBedId: string;
  onReferenceBedIdChange: (value: string) => void;
  durationHours: string;
  onDurationHoursChange: (value: string) => void;
  durationMinutes: string;
  onDurationMinutesChange: (value: string) => void;
}) {
  return (
    <>
    <div className="calculation-mode" role="group" aria-label="Mode de calcul">
      <button
        type="button"
        data-active={preparationMode === 'amount'}
        onClick={() => onPreparationModeChange('amount')}
      >
        Objectif en mm
      </button>
      <button
        type="button"
        data-active={preparationMode === 'duration'}
        onClick={() => onPreparationModeChange('duration')}
      >
        Durée d’irrigation
      </button>
    </div>
    {preparationMode === 'amount' ? (
      <>
        <label>
          <span>Quantité souhaitée</span>
          <span className="input-with-unit">
            <input
              type="number"
              min="0.01"
              step="0.1"
              inputMode="decimal"
              value={targetMillimeters}
              onChange={(event) => onTargetMillimetersChange(event.target.value)}
            />
            <b>mm</b>
          </span>
        </label>
        {equipment?.kind === 'sprinkler' ? (
          <label>
            <span>Planche de référence</span>
            <select
              value={referenceBedId}
              onChange={(event) => onReferenceBedIdChange(event.target.value)}
            >
              {sortByNameNaturally(applications, (application) => application.bed.name, (application) => application.bed.id).map((application) => (
                <option key={application.bed.id} value={application.bed.id}>
                  {application.bed.name} · {formatRate(application.rateMmPerHour)}
                </option>
              ))}
            </select>
            <small>La durée est calculée pour atteindre l’objectif sur cette planche.</small>
          </label>
        ) : null}
      </>
    ) : (
      <div className="duration-inputs">
        <label>
          <span>Heures</span>
          <input
            type="number"
            min="0"
            max="744"
            step="1"
            inputMode="numeric"
            value={durationHours}
            onChange={(event) => onDurationHoursChange(event.target.value)}
          />
        </label>
        <label>
          <span>Minutes</span>
          <input
            type="number"
            min="0"
            max="59"
            step="1"
            inputMode="numeric"
            value={durationMinutes}
            onChange={(event) => onDurationMinutesChange(event.target.value)}
          />
        </label>
      </div>
    )}
    </>
  );
}
