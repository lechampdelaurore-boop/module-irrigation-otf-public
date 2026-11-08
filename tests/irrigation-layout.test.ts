import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bedColumns,
  bedRowCount,
  MAX_BEDS_PER_ROW,
} from '../lib/domain/irrigation-layout.ts';

test('un jardin affiche au maximum 33 planches par ligne', () => {
  assert.equal(MAX_BEDS_PER_ROW, 33);
  assert.equal(bedColumns(0), 1);
  assert.equal(bedColumns(12), 12);
  assert.equal(bedColumns(33), 33);
  assert.equal(bedColumns(34), 33);
  assert.equal(bedColumns(80), 33);
});

test('les planches supplémentaires créent automatiquement de nouvelles lignes', () => {
  assert.equal(bedRowCount(0), 0);
  assert.equal(bedRowCount(33), 1);
  assert.equal(bedRowCount(34), 2);
  assert.equal(bedRowCount(66), 2);
  assert.equal(bedRowCount(67), 3);
});
