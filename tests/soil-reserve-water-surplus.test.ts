import assert from 'node:assert/strict';
import test from 'node:test';
import { bedSoilReserve } from '../lib/domain/soil-reserve/gauge.ts';
import { waterSurplus, type ActualIrrigation } from '../lib/domain/soil-reserve/water-surplus.ts';
import { BED, crop, cropDay, observation, rain, soilInput } from './support/soil-reserve-fixtures.ts';

/**
 * La pastille « eau arrosée en trop » (D-060) : l'eau d'irrigation des sept
 * derniers jours que le sol n'a pas pu retenir, partagée avec la pluie au
 * prorata de leurs mm, en mm et en m³ ; une planche arrosée un jour où sa
 * jauge est inconnue est dite à part.
 */

const MONDAY = '2026-06-01';
const TUESDAY = '2026-06-02';
const MONDAY_MIDNIGHT = '2026-05-31T22:00:00.000Z';
const close = (actual: number | null | undefined, expected: number) => {
  assert.ok(actual !== null && actual !== undefined, `valeur attendue ${expected}, obtenue ${actual}`);
  assert.equal(Number(actual.toFixed(3)), Number(expected.toFixed(3)));
};

const watering = (mm: number, wettedAreaSquareMeters: number | null = 8): ActualIrrigation => ({
  startAt: '2026-06-01T06:00:00.000Z', endAt: '2026-06-01T07:00:00.000Z', mm, nature: 'actual', wettedAreaSquareMeters,
});

/** Une planche pleine au début du lundi, sans consommation : tout ce qui entre ressort en drainage. */
function surplus(options: { irrigation: ActualIrrigation[]; rainMm?: number; observed?: boolean; percent?: number }) {
  const days = bedSoilReserve(soilInput({
    today: TUESDAY,
    waterDays: [cropDay(MONDAY, [crop({ etmMm: 0 })]), cropDay(TUESDAY, [crop({ etmMm: 0 })])],
    observations: options.observed === false ? [] : [observation(options.percent ?? 100, MONDAY_MIDNIGHT)],
    rain: rain({ [MONDAY]: options.rainMm ?? 0, [TUESDAY]: 0 }),
    irrigations: options.irrigation,
  }));
  return waterSurplus({
    today: TUESDAY,
    beds: [{ id: BED.id, name: 'A' }, { id: 'sans-arrosage', name: 'B' }],
    daysByBed: new Map([[BED.id, days]]),
    actualByBed: new Map([[BED.id, options.irrigation]]),
  });
}

test('une planche pleine arrosée de 10 mm : 10 mm perdus, 0,08 m³ sur 8 m² mouillés', () => {
  const result = surplus({ irrigation: [watering(10)] });
  assert.equal(result.from, '2026-05-26');
  assert.equal(result.to, MONDAY);
  assert.equal(result.beds.length, 1);
  close(result.beds[0].drainedMm, 10);
  close(result.beds[0].cubicMeters, 0.08);
  assert.deepEqual(result.beds[0].days, [MONDAY]);
  close(result.cubicMeters, 0.08);
  assert.equal(result.volumeIncomplete, false);
  assert.deepEqual(result.unknownBeds, [], 'une planche sans arrosage n’est pas citée');
});

test('le drainage se partage avec la pluie au prorata des mm ; une surface mouillée inconnue laisse le volume inconnu', () => {
  // 21 mm sur 31 : la place de 10 mm, 10 mm de pluie et 10 mm d'irrigation, 10 mm drainés, la moitié à l'irrigation.
  const shared = surplus({ irrigation: [watering(10)], rainMm: 10, percent: Math.round(21 / 31 * 1e6) / 1e4 });
  close(shared.beds[0].drainedMm, 5);
  close(shared.beds[0].cubicMeters, 0.04);
  const unknownVolume = surplus({ irrigation: [watering(10, null)] });
  assert.equal(unknownVolume.beds[0].cubicMeters, null);
  assert.equal(unknownVolume.cubicMeters, null);
  assert.equal(unknownVolume.volumeIncomplete, true);
});

test('une planche dont la jauge est inconnue le jour de l’arrosage est dite à part, jamais comptée pour 0', () => {
  const result = surplus({ irrigation: [watering(10)], observed: false });
  assert.deepEqual(result.beds, []);
  assert.deepEqual(result.unknownBeds, [{ bedId: BED.id, bedName: 'A' }]);
  assert.equal(result.cubicMeters, null);
});

test('une irrigation qui tient dans le sol ne compte pas', () => {
  const days = bedSoilReserve(soilInput({
    today: TUESDAY,
    waterDays: [cropDay(MONDAY, [crop({ etmMm: 0 })]), cropDay(TUESDAY, [crop({ etmMm: 0 })])],
    observations: [observation(50, MONDAY_MIDNIGHT)],
    rain: rain({ [MONDAY]: 0, [TUESDAY]: 0 }),
    irrigations: [watering(5)],
  }));
  const result = waterSurplus({ today: TUESDAY, beds: [{ id: BED.id, name: 'A' }], daysByBed: new Map([[BED.id, days]]), actualByBed: new Map([[BED.id, [watering(5)]]]) });
  assert.deepEqual(result.beds, []);
  assert.deepEqual(result.unknownBeds, []);
});
