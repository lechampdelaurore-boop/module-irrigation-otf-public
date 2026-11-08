'use client';

import type { EquipmentPlacementRecord } from '@/lib/domain/equipment-placement-record';
import type { EquipmentSettingRecord } from '@/lib/domain/equipment-record';
import { useId, useState, useTransition } from 'react';
import { changeEquipmentPlacementSettingAction } from './equipment-placement-actions';

/**
 * Change le réglage appliqué à un matériel déjà posé, sans ouvrir le plan
 * (`docs/equipment-setting-change-contract.md`).
 *
 * Sur la ferme, on ne déplace pas une rampe pour changer sa buse : ce sont deux
 * gestes distincts, et l'écran les sépare. La liste n'apparaît qu'à partir de
 * deux réglages, faute de quoi il n'y aurait rien à choisir.
 */
export function EquipmentSettingPicker({
  settings,
  placement,
  disabled,
  onPlacementChanged,
}: {
  settings: EquipmentSettingRecord[];
  placement: EquipmentPlacementRecord;
  disabled: boolean;
  onPlacementChanged: (placement: EquipmentPlacementRecord) => void;
}) {
  const fieldId = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (settings.length < 2) return null;

  const change = (settingId: string) => {
    if (settingId === placement.settingId) return;
    setError(null);
    startTransition(async () => {
      const result = await changeEquipmentPlacementSettingAction({
        equipmentId: placement.equipmentId,
        season: placement.season,
        settingId,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onPlacementChanged(result.placement);
    });
  };

  return (
    <div className="equipment-setting-picker">
      <label htmlFor={fieldId}>Réglage appliqué</label>
      <select
        id={fieldId}
        value={placement.settingId}
        disabled={disabled || pending}
        onChange={(event) => change(event.target.value)}
      >
        {settings.map((setting) => (
          <option key={setting.id} value={setting.id}>
            {setting.name}
          </option>
        ))}
      </select>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
