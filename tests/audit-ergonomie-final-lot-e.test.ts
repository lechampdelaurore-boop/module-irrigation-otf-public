import assert from 'node:assert/strict';
import test from 'node:test';
import { millimetersNumber, millimetersText, volumeText } from '../lib/domain/display-numbers.ts';

/**
 * Audit ergonomique final, lot E, mots et chiffres
 * (docs/audit-ergonomie-final-lot-e-contract.md). Les cas chiffrés de la
 * section 10, un affichage seulement : le calcul garde sa précision.
 */

test('J8 : un volume en m³ à deux décimales au plus, sans zéro inutile (F258, cas 1 et 6)', () => {
  assert.equal(volumeText(3.138), '3,14 m³');
  assert.equal(volumeText(12), '12 m³');
  assert.equal(volumeText(1.5), '1,5 m³');
  assert.equal(volumeText(1.004), '1 m³');
});

test('J8 : sous 1 m³, des litres entiers ; jamais « 0 L » pour un volume non nul (F258, cas 2, 3 et 5)', () => {
  assert.equal(volumeText(0.425), '425 L');
  assert.equal(volumeText(0.0005), '1 L');
  assert.equal(volumeText(0.0004), 'moins de 1 L');
  assert.equal(volumeText(0.9994), '999 L');
  assert.equal(volumeText(0.9996), '1 m³', 'un volume qui s’arrondit à 1 000 L se lit en m³');
});

test('J8 : zéro se lit « 0 m³ », le signe d’un écart se garde (F258, cas 4 et 7)', () => {
  assert.equal(volumeText(0), '0 m³');
  assert.equal(volumeText(-0.3), '-300 L');
  assert.equal(volumeText(-2.5), '-2,5 m³');
  assert.equal(volumeText(Number.NaN), '—');
});

test('J8 : des millimètres à une décimale au plus (F259, cas 8)', () => {
  assert.equal(millimetersText(16.54), '16,5 mm');
  assert.equal(millimetersText(12), '12 mm');
  assert.equal(millimetersNumber(0.04), '0');
});
