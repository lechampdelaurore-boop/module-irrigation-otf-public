import assert from 'node:assert/strict';
import test from 'node:test';
import { validateEquipmentPlacementInput } from '../lib/domain/equipment-placement-domain.ts';

const basePlacement = {
  equipmentId: 'equipment-1',
  settingId: 'setting-1',
  season: 2026,
  gardenGroupId: 'group-1',
  otfZoneId: 'zone-1',
  otfPlotId: 'plot-1',
  anchor: { type: 'bed_center' as const, anchorBedOtfId: 'bed-1' },
  selectedBeds: [],
};

test('un placement sur une planche est normalisé', () => {
  const result = validateEquipmentPlacementInput({
    ...basePlacement,
    equipmentId: ' equipment-1 ',
  });

  assert.equal(result.errors.length, 0);
  assert.equal(result.value?.equipmentId, 'equipment-1');
  assert.deepEqual(result.value?.anchor, {
    type: 'bed_center',
    anchorBedOtfId: 'bed-1',
  });
});

test('un placement entre deux planches exige deux identifiants distincts', () => {
  const result = validateEquipmentPlacementInput({
    ...basePlacement,
    anchor: {
      type: 'between_beds',
      beforeBedOtfId: 'bed-1',
      afterBedOtfId: 'bed-1',
    },
  });

  assert.equal(result.value, null);
  assert.match(result.errors[0], /deux planches voisines distinctes/i);
});

test('les planches sélectionnées ne peuvent pas être répétées', () => {
  const bed = {
    otfZoneId: 'zone-1',
    otfPlotId: 'plot-1',
    otfBedId: 'bed-1',
  };
  const result = validateEquipmentPlacementInput({
    ...basePlacement,
    selectedBeds: [bed, bed],
  });

  assert.equal(result.value, null);
  assert.match(result.errors.at(-1) ?? '', /qu’une fois/i);
});

test('une saison hors limites est refusée', () => {
  const result = validateEquipmentPlacementInput({
    ...basePlacement,
    season: 12,
  });

  assert.equal(result.value, null);
  assert.match(result.errors[0], /saison valide/i);
});

test('un identifiant de groupe invalide ne devient pas silencieusement vide', () => {
  const result = validateEquipmentPlacementInput({
    ...basePlacement,
    gardenGroupId: '   ',
  });

  assert.equal(result.value, null);
  assert.match(result.errors[0], /groupe de jardins valide/i);
});
