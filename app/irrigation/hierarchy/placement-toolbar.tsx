'use client';
import { settingSummary } from './presentation';
import type { PlacementEditor } from './use-placement-editor';

import type { EquipmentPlacementRecord } from '@/lib/domain/equipment-placement-record';
import type { EquipmentListItem } from '@/lib/domain/equipment-record';
import type { GardenGroupConfiguration } from '@/lib/domain/garden-group-record';
import type { Bed } from '@/lib/domain/domain';
import { localDateTimeInputValue } from '@/lib/domain/irrigation-timer';


export function placementPreviewFromEditor(
  editor: PlacementEditor,
  season: number,
  bedById: ReadonlyMap<string, Bed>,
  groups: GardenGroupConfiguration['groups'],
): EquipmentPlacementRecord | null {
  const anchor = editor.anchor;
  if (!anchor) return null;
  const anchorBed = anchor.type === 'bed_center'
    ? bedById.get(anchor.anchorBedOtfId)
    : bedById.get(anchor.afterBedOtfId);
  if (!anchorBed) return null;
  const selectedBeds = editor.selectedBedIds.flatMap((bedId) => {
    const bed = bedById.get(bedId);
    return bed
      ? [{
          otfZoneId: bed.zoneId,
          otfPlotId: bed.plotId,
          otfBedId: bed.id,
        }]
      : [];
  });
  const gardenGroupId = groups.find((group) =>
    group.members.some((member) => member.otfPlotId === anchorBed.plotId),
  )?.id ?? null;

  return {
    id: `preview-${editor.equipmentId}`,
    equipmentId: editor.equipmentId,
    settingId: editor.settingId,
    season,
    gardenGroupId,
    otfZoneId: anchorBed.zoneId,
    otfPlotId: anchorBed.plotId,
    anchor,
    selectedBeds,
  };
}

export function PlacementToolbar({
  season,
  equipment,
  editor,
  existingPlacement,
  stored,
  placementDate,
  bedById,
  error,
  pending,
  onPlacementDateChange,
  onSettingChange,
  onCancel,
  onRemove,
  onSave,
}: {
  season: number;
  equipment: EquipmentListItem;
  editor: PlacementEditor;
  existingPlacement: EquipmentPlacementRecord | null;
  /** Le matériel est stocké : l'enregistrement le repose. */
  stored: boolean;
  /** La date de la pose, au format d'un champ date et heure. */
  placementDate: string;
  bedById: ReadonlyMap<string, Bed>;
  error: string | null;
  pending: boolean;
  onPlacementDateChange: (value: string) => void;
  onSettingChange: (settingId: string) => void;
  onCancel: () => void;
  onRemove: () => void;
  onSave: () => void;
}) {
  const setting = equipment.settings.find(
    (item) => item.id === editor.settingId,
  );
  const position = placementEditorDescription(equipment, editor, bedById);

  return (
    <section className="placement-toolbar" aria-labelledby="placement-toolbar-title">
      <div className="placement-toolbar-heading">
        <span className="placement-symbol" aria-hidden="true">↕</span>
        <div>
          <small>Placement · saison {season}</small>
          <h2 id="placement-toolbar-title">{equipment.name}</h2>
          <p>
            {equipment.kind === 'sprinkler'
              ? 'Cliquez sur une planche ou sur le trait entre deux planches.'
              : 'Cliquez sur chaque planche alimentée par ce matériel.'}
          </p>
        </div>
      </div>
      <label className="placement-setting-field">
        <span>Réglage utilisé</span>
        <select
          value={editor.settingId}
          disabled={pending}
          onChange={(event) => onSettingChange(event.target.value)}
        >
          {equipment.settings.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
      </label>
      <div className="placement-current-choice" data-ready={Boolean(editor.anchor)}>
        <small>Position choisie</small>
        <strong>{position}</strong>
        <span>{setting ? settingSummary(setting) : 'Réglage indisponible'}</span>
      </div>
      <label className="placement-setting-field">
        <span>{existingPlacement ? 'Date du déplacement' : stored ? 'Date de repose' : 'Date de pose'}</span>
        <input
          type="datetime-local"
          max={localDateTimeInputValue(new Date())}
          value={placementDate}
          disabled={pending}
          onChange={(event) => onPlacementDateChange(event.target.value)}
        />
        {existingPlacement ? <small>Sans effet si le matériel reste au même endroit.</small> : null}
      </label>
      {error ? <p className="equipment-error placement-toolbar-error" role="alert">{error}</p> : null}
      <div className="placement-toolbar-actions">
        {existingPlacement ? (
          <button
            className="placement-remove-button"
            type="button"
            disabled={pending}
            onClick={onRemove}
          >
            Retirer (stocker)
          </button>
        ) : null}
        <button className="secondary-button" type="button" disabled={pending} onClick={onCancel}>
          Annuler
        </button>
        <button className="primary-button" type="button" disabled={pending || !editor.anchor} onClick={onSave}>
          {pending ? 'Enregistrement…' : 'Enregistrer la position'}
        </button>
      </div>
    </section>
  );
}

function placementEditorDescription(
  equipment: EquipmentListItem,
  editor: PlacementEditor,
  bedById: ReadonlyMap<string, Bed>,
) {
  if (equipment.kind === 'drip') {
    const count = editor.selectedBedIds.length;
    return count === 0
      ? 'Aucune planche sélectionnée'
      : `${count} planche${count > 1 ? 's' : ''} sélectionnée${count > 1 ? 's' : ''}`;
  }
  if (!editor.anchor) return 'Aucune position choisie';
  if (editor.anchor.type === 'bed_center') {
    const bed = bedById.get(editor.anchor.anchorBedOtfId);
    return bed ? `Sur ${bed.name}` : 'Sur une planche indisponible';
  }
  const before = bedById.get(editor.anchor.beforeBedOtfId);
  const after = bedById.get(editor.anchor.afterBedOtfId);
  return before && after
    ? `Entre ${before.name} et ${after.name}`
    : 'Entre deux planches indisponibles';
}
