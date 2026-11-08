import assert from 'node:assert/strict';
import test from 'node:test';
import { unplacedFoldLabel } from '../lib/domain/planning/phone-week';

/**
 * La liste « Non placé » du planning est repliée par défaut derrière son
 * titre (demande du porteur du 8 novembre 2026) : le titre garde le nombre
 * de planches, au singulier comme au pluriel.
 */
test('le titre de la liste repliée dit le nombre de planches, en mots simples (lot 3, point 5, F48)', () => {
  assert.equal(unplacedFoldLabel(1), 'Planches non servies (1)');
  assert.equal(unplacedFoldLabel(2), 'Planches non servies (2)');
  assert.equal(unplacedFoldLabel(37), 'Planches non servies (37)');
});
