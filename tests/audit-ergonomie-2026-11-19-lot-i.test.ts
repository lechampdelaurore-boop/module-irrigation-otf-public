import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

/**
 * Audit ergonomique du 19 novembre 2026, lot I « Pénurie et démonstration »
 * (docs/audit-ergonomie-2026-11-19-lot-i-contract.md) : les règles qui se
 * lisent sans base. Les autres sont dans
 * `tests/db/audit-ergonomie-2026-11-19-lot-i.test.ts`.
 */

const sheet = (path: string) => readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// n° 12 — Le bandeau sur tablette (PR 4, F451).

test('n° 12, F451 : la bannière compacte du téléphone vaut jusqu’à 1 000 px ; au-dessus, la phrase passe à la ligne sans rétrécir', () => {
  const css = sheet('app/irrigation/styles/demo.css');
  assert.doesNotMatch(css, /max-width: 600px/, 'plus de bascule à 600 px');
  const compact = css.match(/@media \(max-width: 1000px\) \{\s*\.demo-banner \{([\s\S]*?)\}/)?.[1] ?? '';
  assert.match(compact, /flex-wrap: wrap;/);
  assert.match(css, /@media \(max-width: 1000px\) \{[\s\S]*?\.demo-banner \.demo-banner-line \{[\s\S]*?display: -webkit-box;/);
  const wide = css.match(/@media \(min-width: 1001px\) \{([\s\S]*?)\n\}/)?.[1] ?? '';
  assert.match(wide, /\.demo-banner \{\s*flex-wrap: wrap;\s*\}/);
  assert.match(wide, /\.demo-banner > p \{\s*min-width: 18em;\s*\}/, 'la phrase ne descend plus jusqu’à zéro');
  assert.doesNotMatch(wide, /\.demo-banner p \{/, 'l’annonce cachée de la visite, hors écran, ne prend pas cette largeur');
});
