import assert from 'node:assert/strict';
import test from 'node:test';
import type { Bed } from '../lib/domain/domain.ts';
import { sortBedsByName } from '../lib/domain/bed-order.ts';

test('les noms de planches sont triés naturellement avec la planche zéro en premier', () => {
  const names = ['B1-10', 'B1-2', 'B1-0', 'B1-1'];
  const beds = names.map((name): Bed => ({
    id: name,
    zoneId: 'z1',
    plotId: 'p1',
    name,
    length: 20,
    width: 0.75,
    alleyWidth: 0.45,
    area: 15,
    seasons: [2026],
  }));

  assert.deepEqual(
    sortBedsByName(beds).map((bed) => bed.name),
    ['B1-0', 'B1-1', 'B1-2', 'B1-10'],
  );
});
