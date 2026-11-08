import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canTransitionIrrigationEvent,
  isFinalizedIrrigationStatus,
  validateEquipmentDraft,
  validateEquipmentSettingInput,
  validateEquipmentSettings,
  type EquipmentSettingDraft,
} from '../lib/domain/irrigation-domain.ts';

test('le formulaire normalise le nom et valide le type de matériel', () => {
  assert.deepEqual(
    validateEquipmentDraft({
      name: '  Rampe   mobile 1 ',
      kind: 'sprinkler',
      mobility: 'mobile',
    }),
    {
      value: {
        name: 'Rampe mobile 1',
        kind: 'sprinkler',
        mobility: 'mobile',
      },
      errors: [],
    },
  );

  const invalid = validateEquipmentDraft({
    name: '',
    kind: 'inconnu',
    mobility: 'ailleurs',
  });
  assert.equal(invalid.value, null);
  assert.equal(invalid.errors.length, 3);
});

test('un réglage d’aspersion est normalisé dans l’ordre des distances', () => {
  const result = validateEquipmentSettingInput({
    name: '  Réglage   moyen ',
    kind: 'sprinkler',
    leftProfile: [
      { distanceMeters: 2, rateMmPerHour: 5 },
      { distanceMeters: 0, rateMmPerHour: 12 },
    ],
    rightProfile: [
      { distanceMeters: 1, rateMmPerHour: 8 },
      { distanceMeters: 0, rateMmPerHour: 12 },
    ],
  });

  assert.equal(result.errors.length, 0);
  assert.equal(result.value?.name, 'Réglage moyen');
  assert.deepEqual(
    result.value?.kind === 'sprinkler' ? result.value.leftProfile : null,
    [
      { distanceMeters: 0, rateMmPerHour: 12 },
      { distanceMeters: 2, rateMmPerHour: 5 },
    ],
  );
});

test('un réglage goutte-à-goutte exige un débit valide', () => {
  const result = validateEquipmentSettingInput({
    name: 'Goutte-à-goutte',
    kind: 'drip',
    rateMmPerHour: Number.NaN,
  });
  assert.equal(result.value, null);
  assert.ok(result.errors.some((error) => /débit/.test(error)));
});

test('un matériel accepte au maximum dix réglages', () => {
  const settings: EquipmentSettingDraft[] = Array.from(
    { length: 11 },
    (_, index) => ({
      id: `setting-${index + 1}`,
      name: `Réglage ${index + 1}`,
      position: index + 1,
      kind: 'drip',
      rateMmPerHour: 14,
    }),
  );

  const errors = validateEquipmentSettings('drip', settings);
  assert.ok(errors.some((error) => /plus de 10 réglages/.test(error)));
});

test('un profil d’aspersion accepte des distances libres des deux côtés', () => {
  const settings: EquipmentSettingDraft[] = [
    {
      id: 'setting-1',
      name: 'Réglage doux',
      position: 1,
      kind: 'sprinkler',
      leftProfile: [
        { distanceMeters: 0, rateMmPerHour: 12 },
        { distanceMeters: 1.25, rateMmPerHour: 8 },
        { distanceMeters: 4, rateMmPerHour: 2 },
      ],
      rightProfile: [
        { distanceMeters: 0, rateMmPerHour: 11 },
        { distanceMeters: 0.5, rateMmPerHour: 9 },
        { distanceMeters: 3.75, rateMmPerHour: 0 },
      ],
    },
  ];

  assert.deepEqual(validateEquipmentSettings('sprinkler', settings), []);
});

test('un profil d’aspersion doit commencer à zéro mètre', () => {
  const settings: EquipmentSettingDraft[] = [
    {
      id: 'setting-1',
      name: 'Réglage incomplet',
      position: 1,
      kind: 'sprinkler',
      leftProfile: [{ distanceMeters: 1, rateMmPerHour: 8 }],
      rightProfile: [{ distanceMeters: 0, rateMmPerHour: 8 }],
    },
  ];

  const errors = validateEquipmentSettings('sprinkler', settings);
  assert.ok(errors.some((error) => /gauche.*commencer à 0 m/.test(error)));
});

test('les réglages ne mélangent pas aspersion et goutte-à-goutte', () => {
  const settings: EquipmentSettingDraft[] = [
    {
      id: 'setting-1',
      name: 'Goutte-à-goutte',
      position: 1,
      kind: 'drip',
      rateMmPerHour: 14,
    },
  ];

  const errors = validateEquipmentSettings('sprinkler', settings);
  assert.ok(errors.some((error) => /ne correspond pas au type/.test(error)));
});

test('une irrigation réalisée ou annulée devient immuable', () => {
  assert.equal(
    canTransitionIrrigationEvent('planned', 'partially_completed'),
    true,
  );
  assert.equal(
    canTransitionIrrigationEvent('partially_completed', 'completed'),
    true,
  );
  assert.equal(canTransitionIrrigationEvent('completed', 'planned'), false);
  assert.equal(canTransitionIrrigationEvent('canceled', 'planned'), false);
});

test('une seconde confirmation retrouve un état final déjà enregistré', () => {
  assert.equal(isFinalizedIrrigationStatus('completed'), true);
  assert.equal(isFinalizedIrrigationStatus('partially_completed'), true);
  assert.equal(isFinalizedIrrigationStatus('planned'), false);
  assert.equal(isFinalizedIrrigationStatus('canceled'), false);
});
