import assert from 'node:assert/strict';
import test from 'node:test';
import { mapOtfSnapshot } from '../lib/domain/otf/mapper.ts';
import { OtfApiError } from '../lib/domain/otf/api-contract.ts';

test('les réponses OTF sont transformées en hiérarchie stable', () => {
  const snapshot = mapOtfSnapshot(
    [{ seasonFirst: 2025, seasonLast: 2026 }],
    [{ id: 10, name: 'Les Prés', area: 480, seasonFirst: 2026, seasonLast: 2026 }],
    [
      {
        '@id': '/0.1beta/plot/20',
        zone: { id: 10 },
        name: 'Tunnel 1',
        mode: 'greenhouse',
        length: 30,
        width: 8,
        area: 240,
        seasonFirst: 2025,
        seasonLast: 2026,
      },
    ],
    [
      {
        id: 30,
        zone: '/0.1beta/zone/10',
        plot: '/0.1beta/plot/20',
        name: 'T01',
        length: 20,
        width: 75,
        alleyWidth: 45,
        seasonFirst: 2026,
        seasonLast: 2026,
      },
    ],
    new Date('2026-08-26T10:00:00.000Z'),
  );

  assert.equal(snapshot.source, 'live');
  assert.equal(snapshot.zones[0].area, 480);
  assert.deepEqual(snapshot.zones[0].seasons, [2026]);
  assert.deepEqual(snapshot.plots[0].seasons, [2025, 2026]);
  assert.deepEqual(snapshot.beds[0].seasons, [2026]);
  assert.equal(snapshot.plots[0].id, '20');
  assert.equal(snapshot.plots[0].mode, 'greenhouse');
  assert.equal(snapshot.beds[0].plotId, '20');
  assert.equal(snapshot.beds[0].width, 0.75);
  assert.equal(snapshot.beds[0].alleyWidth, 0.45);
  assert.equal(snapshot.beds[0].area, 15);
});

test('un remplissage technique de parcelle est masqué sans masquer un vrai jardin vide', () => {
  const snapshot = mapOtfSnapshot(
    [{ seasonFirst: 2026, seasonLast: 2026 }],
    [{ id: 14, name: 'Clémentière', area: 10309 }],
    [
      {
        id: 38,
        zone: 14,
        zoneFill: true,
        name: null,
        mode: 'open-field',
        length: null,
        width: null,
        area: 10309,
      },
      {
        id: 39,
        zone: 14,
        name: 'Jardin vide',
        mode: 'open-field',
        area: 120,
      },
    ],
    [],
  );

  assert.equal(snapshot.zones[0].area, 10309);
  assert.deepEqual(snapshot.plots.map(({ id }) => id), ['39']);
});

test('une surface de parcelle absente reste non renseignée', () => {
  const snapshot = mapOtfSnapshot(
    [{ seasonFirst: 2026, seasonLast: 2026 }],
    [{ id: 10, name: 'Les Prés' }],
    [],
    [],
  );

  assert.equal(snapshot.zones[0].area, null);
});

test('les largeurs de planche OTF sont converties des centimètres vers les mètres', () => {
  const snapshot = mapOtfSnapshot(
    [{ seasonFirst: 2026, seasonLast: 2026 }],
    [{ id: 10, name: 'Les Prés' }],
    [{ id: 20, zone: 10, name: 'Nord', mode: 'open-field', area: 120 }],
    [{ id: 30, plot: 20, name: 'P01', length: 10, width: 120, alleyWidth: null }],
  );

  assert.equal(snapshot.beds[0].width, 1.2);
  assert.equal(snapshot.beds[0].alleyWidth, null);
  assert.equal(snapshot.beds[0].area, 12);
});

test('un jardin de plein champ accepte des dimensions absentes', () => {
  const snapshot = mapOtfSnapshot(
    { count: 1, list: [{ seasonFirst: 2026, seasonLast: 2026 }] },
    [{ id: 10, name: 'Les Prés' }],
    [{ id: 20, zone: 10, name: 'Nord', mode: 'open-field', length: null, width: null, area: 120 }],
    [],
  );

  assert.equal(snapshot.plots[0].length, 0);
  assert.equal(snapshot.plots[0].width, 0);
  assert.equal(snapshot.plots[0].area, 120);
});

test('une planche accepte des dimensions nulles et déduit sa parcelle du jardin', () => {
  const snapshot = mapOtfSnapshot(
    [{ seasonFirst: 2026, seasonLast: 2026 }],
    [{ id: 10, name: 'Les Prés' }],
    [{ id: 20, zone: 10, name: 'Nord', mode: 'open-field', area: 120 }],
    [{ id: 30, plot: 20, name: 'P01', length: null, width: null, alleyWidth: null, area: 0 }],
  );

  assert.equal(snapshot.beds[0].zoneId, '10');
  assert.equal(snapshot.beds[0].length, 0);
  assert.equal(snapshot.beds[0].width, 0);
  assert.equal(snapshot.beds[0].alleyWidth, null);
});

test("une planche absente de plotList n'empêche pas l'actualisation des planches rattachables", () => {
  const snapshot = mapOtfSnapshot(
    [{ seasonFirst: 2026, seasonLast: 2026 }],
    [{ id: 10, name: 'Les Prés' }],
    [{ id: 20, zone: 10, name: 'Nord', mode: 'open-field', area: 120 }],
    [
      { id: 30, zone: 10, plot: 20, name: 'P01', length: 10, width: 75, alleyWidth: 45 },
      { id: 31, zone: 10, plot: 999, name: 'Orpheline', length: 10, width: 75, alleyWidth: 25 },
    ],
  );

  assert.deepEqual(snapshot.beds.map(({ id }) => id), ['30']);
  assert.equal(snapshot.beds[0].alleyWidth, 0.45);
});

test('une relation orpheline invalide toute la nouvelle lecture', () => {
  assert.throws(
    () =>
      mapOtfSnapshot(
        [{ seasonFirst: 2026, seasonLast: 2026 }],
        [{ id: 10, name: 'Les Prés' }],
        [
          {
            id: 20,
            zone: 999,
            name: 'Jardin isolé',
            length: 10,
            width: 10,
          },
        ],
        [],
      ),
    (error) =>
      error instanceof OtfApiError && /parcelle inconnue/.test(error.message),
  );
});

test('une plage de saisons incohérente est rejetée', () => {
  assert.throws(
    () => mapOtfSnapshot([{ seasonFirst: 2028, seasonLast: 2026 }], [], [], []),
    OtfApiError,
  );
});
