import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appliedMillimeters,
  bedCenterMeters,
  displayFlowRate,
  interpolateSprinklerRate,
  litersPerHourForBed,
  resolveBedWettedArea,
  sprinklerRateForBed,
  totalLitersPerHour,
  wettedAreaSquareMeters,
} from '../lib/domain/irrigation-calculations.ts';

const profile = [
  { distanceMeters: 0, rateMmPerHour: 12 },
  { distanceMeters: 1, rateMmPerHour: 8 },
  { distanceMeters: 2, rateMmPerHour: 5 },
  { distanceMeters: 3, rateMmPerHour: 3 },
  { distanceMeters: 4, rateMmPerHour: 2 },
];

test('le débit est interpolé linéairement entre deux distances', () => {
  assert.equal(interpolateSprinklerRate(profile, 0.6), 9.6);
  assert.equal(interpolateSprinklerRate(profile, 1.8), 5.6);
  assert.equal(interpolateSprinklerRate(profile, 3), 3);
});

test('l’aspersion est nulle au-delà du dernier point', () => {
  assert.equal(interpolateSprinklerRate(profile, 4.01), 0);
  assert.equal(interpolateSprinklerRate(profile, -1), 0);
});

test('le débit d’une planche est calculé à son centre', () => {
  assertCloseTo(bedCenterMeters(0.225, 0.975), 0.6);
  assertCloseTo(sprinklerRateForBed(profile, 0.225, 0.975), 9.6);
  assertCloseTo(bedCenterMeters(1.425, 2.175), 1.8);
  assertCloseTo(sprinklerRateForBed(profile, 1.425, 2.175), 5.6);
});

function assertCloseTo(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);
}

test('la durée transforme un débit horaire en millimètres apportés', () => {
  assert.equal(appliedMillimeters(14, 90), 21);
});

test('un millimètre sur un mètre carré correspond à un litre', () => {
  assert.equal(litersPerHourForBed(14, 15), 210);
  assert.equal(
    totalLitersPerHour([
      { rateMmPerHour: 14, areaSquareMeters: 15 },
      { rateMmPerHour: 8, areaSquareMeters: 20 },
    ]),
    370,
  );
});

test('le débit reste en litres jusqu’à 1000 L/h puis passe en m³/h', () => {
  assert.deepEqual(displayFlowRate(1000), { value: 1000, unit: 'L/h' });
  assert.deepEqual(displayFlowRate(1250), { value: 1.25, unit: 'm³/h' });
});

// Surface mouillée (docs/wetted-surface-contract.md, D-022). B1-1 est une planche
// réelle de la ferme : 22 m × 0,75 m = 16,5 m², passe-pied 0,45 m.
const b11 = { area: 16.5, length: 22, alleyWidth: 0.45 };

test('5.0 le goutte-à-goutte mouille la planche seule, l’aspersion la planche et le passe-pied', () => {
  assert.equal(wettedAreaSquareMeters(b11, 'drip'), 16.5);
  assertCloseTo(wettedAreaSquareMeters(b11, 'sprinkler')!, 26.4);
  // Planche de démonstration N01 : 30 m × 0,75 m, passe-pied 0,45 m.
  assert.equal(wettedAreaSquareMeters({ area: 22.5, length: 30, alleyWidth: 0.45 }, 'drip'), 22.5);
  assert.equal(wettedAreaSquareMeters({ area: 22.5, length: 30, alleyWidth: 0.45 }, 'sprinkler'), 36);
});

test('5.0 un passe-pied inconnu rend la surface d’aspersion inconnue, jamais nulle ni réduite à la planche', () => {
  assert.equal(wettedAreaSquareMeters({ ...b11, alleyWidth: null }, 'sprinkler'), null);
  assert.equal(wettedAreaSquareMeters({ ...b11, alleyWidth: null }, 'drip'), 16.5, 'sans effet en goutte-à-goutte');
  assert.equal(wettedAreaSquareMeters({ ...b11, alleyWidth: 0 }, 'sprinkler'), 16.5, 'un zéro reçu est un zéro valide');
});

test('5.0 le besoin d’une planche prend la surface du matériel positionné, la plus grande si les deux y sont', () => {
  assert.deepEqual(resolveBedWettedArea(b11, []), { squareMeters: 16.5, source: 'bed-only' });
  assert.deepEqual(resolveBedWettedArea(b11, ['drip']), { squareMeters: 16.5, source: 'drip' });
  const sprinkler = resolveBedWettedArea(b11, ['sprinkler']);
  assert.equal(sprinkler.source, 'sprinkler');
  assertCloseTo(sprinkler.squareMeters!, 26.4);
  const mixed = resolveBedWettedArea(b11, ['drip', 'sprinkler']);
  assert.equal(mixed.source, 'sprinkler');
  assertCloseTo(mixed.squareMeters!, 26.4);
  assert.deepEqual(resolveBedWettedArea({ ...b11, alleyWidth: null }, ['drip', 'sprinkler']), { squareMeters: null, source: 'unknown-alley' });
});
