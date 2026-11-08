import assert from 'node:assert/strict';
import test from 'node:test';
import { validateGardenGroupInput } from '../lib/domain/garden-group-domain.ts';

test('un groupe normalise son nom, ses positions et sa première distance', () => {
  const result = validateGardenGroupInput({
    name: '  Blocs   1 à 6 ',
    season: 2026,
    members: [
      {
        otfZoneId: 'zone-1',
        otfPlotId: 'plot-1',
        bedOrder: 'normal',
        gapBeforeMeters: 12,
      },
      {
        otfZoneId: 'zone-1',
        otfPlotId: 'plot-2',
        bedOrder: 'reversed',
        gapBeforeMeters: 1.2,
      },
    ],
  });

  assert.deepEqual(result, {
    value: {
      name: 'Blocs 1 à 6',
      season: 2026,
      members: [
        {
          otfZoneId: 'zone-1',
          otfPlotId: 'plot-1',
          position: 1,
          bedOrder: 'normal',
          gapBeforeMeters: 0,
        },
        {
          otfZoneId: 'zone-1',
          otfPlotId: 'plot-2',
          position: 2,
          bedOrder: 'reversed',
          gapBeforeMeters: 1.2,
        },
      ],
    },
    errors: [],
  });
});

test('un groupe exige deux jardins distincts et des distances positives', () => {
  const result = validateGardenGroupInput({
    name: 'Groupe invalide',
    season: 2026,
    members: [
      {
        otfZoneId: 'zone-1',
        otfPlotId: 'plot-1',
        bedOrder: 'normal',
        gapBeforeMeters: -1,
      },
    ],
  });

  assert.equal(result.value, null);
  assert.ok(result.errors.some((error) => /au moins deux/.test(error)));
  assert.ok(result.errors.some((error) => /distance/.test(error)));
});

test('un jardin ne peut pas être répété dans un groupe', () => {
  const result = validateGardenGroupInput({
    name: 'Doublon',
    season: 2027,
    members: [
      {
        otfZoneId: 'zone-1',
        otfPlotId: 'plot-1',
        bedOrder: 'normal',
        gapBeforeMeters: 0,
      },
      {
        otfZoneId: 'zone-1',
        otfPlotId: 'plot-1',
        bedOrder: 'normal',
        gapBeforeMeters: 1,
      },
    ],
  });

  assert.equal(result.value, null);
  assert.ok(result.errors.some((error) => /qu’une fois/.test(error)));
});
