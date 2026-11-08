import type { EquipmentPlacementRecord } from '../lib/domain/equipment-placement-record.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  removeEquipmentPlacement,
  upsertEquipmentPlacement,
} from '../lib/domain/equipment-placement-state.ts';

const placement = (id: string, equipmentId: string): EquipmentPlacementRecord => ({
  id,
  equipmentId,
  settingId: 'setting-1',
  season: 2026,
  gardenGroupId: null,
  otfZoneId: 'zone-1',
  otfPlotId: 'plot-1',
  anchor: { type: 'bed_center', anchorBedOtfId: 'bed-1' },
  selectedBeds: [],
});

test('un déplacement remplace la position sans modifier son ordre visuel', () => {
  const first = placement('placement-1', 'equipment-1');
  const second = placement('placement-2', 'equipment-2');
  const moved = { ...first, otfPlotId: 'plot-2' };

  assert.deepEqual(
    upsertEquipmentPlacement([first, second], moved),
    [moved, second],
  );
});

test('une nouvelle position est ajoutée et une suppression ne retire que le matériel visé', () => {
  const first = placement('placement-1', 'equipment-1');
  const second = placement('placement-2', 'equipment-2');

  assert.deepEqual(upsertEquipmentPlacement([first], second), [first, second]);
  assert.deepEqual(removeEquipmentPlacement([first, second], 'equipment-1'), [second]);
});
