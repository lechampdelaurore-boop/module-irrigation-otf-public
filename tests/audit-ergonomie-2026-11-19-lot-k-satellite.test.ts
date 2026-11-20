import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { shortenedLabels, type LabelBox } from '../lib/domain/satellite-view/labels.ts';

/**
 * Audit ergonomique du 19 novembre 2026, lot K, n° 16 (F468) : sur la vue
 * satellite, un nom de jardin qui en chevaucherait un autre devient son
 * numéro, celui de la liste à côté de la carte.
 */

const box = (x: number, y: number, width = 80, height = 20): LabelBox => ({ x, y, width, height, shortWidth: 24 });

test('n° 16, F468 : des noms éloignés gardent tous leur nom', () => {
  assert.deepEqual(shortenedLabels([box(50, 50), box(200, 50), box(50, 200)]), [false, false, false]);
});

test('n° 16, F468 : quatre tunnels serrés côte à côte : le premier garde son nom, les voisins qui le chevauchent deviennent des numéros', () => {
  // Quatre noms de 80 px dont les centres sont à 30 px l'un de l'autre, comme « Tunnel 1 » à « Tunnel 4 ».
  const tunnels = [box(100, 100), box(130, 100), box(160, 100), box(190, 100)];
  const shortened = shortenedLabels(tunnels);
  assert.equal(shortened[0], false, 'le premier de la liste garde son nom');
  assert.ok(shortened.slice(1).every(Boolean), 'les trois autres, posés sur lui, deviennent des numéros');
});

test('n° 16, F468 : un nom loin du premier mais posé sur un numéro garde la place qui reste', () => {
  // Le deuxième chevauche le premier (numéro) ; le troisième, à 90 px du premier, ne chevauche ni lui ni le numéro.
  assert.deepEqual(shortenedLabels([box(100, 100), box(140, 100), box(230, 100)]), [false, true, false]);
});

test('n° 16, F468 : deux noms l’un au-dessus de l’autre, sans air entre eux, se gênent', () => {
  assert.deepEqual(shortenedLabels([box(100, 100), box(100, 121)]), [false, true], 'un pixel d’écart ne suffit pas');
  assert.deepEqual(shortenedLabels([box(100, 100), box(100, 124)]), [false, false]);
});

test('n° 16, F468 : la carte et le dessin posent les noms par la même règle ; la liste porte les numéros', () => {
  const map = readFileSync('app/irrigation/hierarchy/satellite/satellite-map.tsx', 'utf8');
  assert.match(map, /created\.on\('zoomend', fitLabels\)/, 'refait à chaque zoom');
  assert.match(map, /element\.dataset\.number = String\(index \+ 1\)/);
  assert.match(readFileSync('app/irrigation/hierarchy/satellite/satellite-svg-drawing.tsx', 'utf8'), /data-number=\{index \+ 1\}/);
  assert.match(readFileSync('app/irrigation/hierarchy/satellite/satellite-garden-list.tsx', 'utf8'), /className="satellite-garden-number" aria-hidden="true">\{index \+ 1\}/);
});
