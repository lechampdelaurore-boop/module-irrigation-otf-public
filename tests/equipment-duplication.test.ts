import assert from 'node:assert/strict';
import test from 'node:test';
import { copyEquipmentSettings } from '../lib/domain/equipment-duplication.ts';

test('la duplication copie les profils gauche et droite dans leur position', () => {
  const leftProfile = [
    { distanceMeters: 0, rateMmPerHour: 12 },
    { distanceMeters: 2, rateMmPerHour: 5 },
  ];
  const rightProfile = [
    { distanceMeters: 0, rateMmPerHour: 10 },
    { distanceMeters: 3, rateMmPerHour: 2 },
  ];
  const copies = copyEquipmentSettings([
    {
      name: 'Réglage fort',
      position: 2,
      kind: 'sprinkler',
      leftProfile,
      rightProfile,
    },
  ]);

  assert.deepEqual(copies, [{
    position: 2,
    setting: {
      name: 'Réglage fort',
      kind: 'sprinkler',
      leftProfile,
      rightProfile,
    },
  }]);
  const setting = copies[0].setting;
  assert.equal(setting.kind, 'sprinkler');
  if (setting.kind === 'sprinkler') {
    assert.notEqual(setting.leftProfile, leftProfile);
    assert.notEqual(setting.leftProfile[0], leftProfile[0]);
    assert.notEqual(setting.rightProfile, rightProfile);
  }
});

test('la duplication copie le débit du goutte-à-goutte et trie les réglages', () => {
  const copies = copyEquipmentSettings([
    {
      name: 'Débit faible',
      position: 3,
      kind: 'drip',
      rateMmPerHour: 8,
    },
    {
      name: 'Débit nominal',
      position: 1,
      kind: 'drip',
      rateMmPerHour: 14,
    },
  ]);

  assert.deepEqual(copies.map((copy) => copy.position), [1, 3]);
  assert.deepEqual(copies.map((copy) => copy.setting), [
    { name: 'Débit nominal', kind: 'drip', rateMmPerHour: 14 },
    { name: 'Débit faible', kind: 'drip', rateMmPerHour: 8 },
  ]);
});
