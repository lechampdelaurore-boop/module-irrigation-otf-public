import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hoursAndMinutesFromSeconds,
  LITERS_PER_CUBIC_METER,
  MILLISECONDS_PER_DAY,
  MILLISECONDS_PER_HOUR,
  cubicMetersForFlow,
  cubicMetersFromLiters,
  cubicMetersFromMillimeterSquareMeters,
  cubicMetersFromMillimeters,
  hoursFromSeconds,
  millimetersForRate,
  millimetersFromCubicMeters,
  millisecondsFromDays,
  millisecondsFromHours,
  millisecondsFromMinutes,
  millisecondsFromSeconds,
  secondsForMillimeters,
  secondsFromMilliseconds,
} from '../lib/domain/units.ts';

test('repères physiques : 1 mm sur 1 m² vaut 1 L, 1 000 L font 1 m³', () => {
  assert.equal(cubicMetersFromMillimeters(1, 1), 0.001);
  assert.equal(cubicMetersFromMillimeters(10, 30), 0.3, '10 mm sur une planche de 30 m²');
  assert.equal(cubicMetersFromLiters(LITERS_PER_CUBIC_METER), 1);
  assert.equal(cubicMetersFromMillimeterSquareMeters(2500), 2.5);
  assert.equal(millimetersFromCubicMeters(0.3, 30), 10, 'réciproque de la hauteur sur surface');
});

test('débits : hauteur, durée et volume se déduisent l’un de l’autre sans arrondi', () => {
  assert.equal(millimetersForRate(12, 600), 2, '12 mm/h pendant 10 minutes');
  assert.equal(secondsForMillimeters(10, 20), 1800, '10 mm à 20 mm/h : une demi-heure');
  assert.equal(cubicMetersForFlow(8, 1800), 4, '8 m³/h pendant une demi-heure');
  assert.equal(hoursFromSeconds(5400), 1.5);
});

test('temps : secondes, minutes, heures et jours en millisecondes', () => {
  assert.equal(millisecondsFromSeconds(90), 90_000);
  assert.equal(secondsFromMilliseconds(1500), 1.5);
  assert.equal(millisecondsFromMinutes(5), 300_000);
  assert.equal(millisecondsFromHours(4), 4 * MILLISECONDS_PER_HOUR);
  assert.equal(MILLISECONDS_PER_HOUR, 3_600_000);
  assert.equal(MILLISECONDS_PER_DAY, 86_400_000);
  assert.equal(millisecondsFromDays(7), 604_800_000);
});

test('les fonctions reproduisent l’arithmétique d’origine, à l’identique en virgule flottante', () => {
  const rate = 7.3, seconds = 1234, area = 41.7, cubic = 0.37;
  assert.equal(cubicMetersFromMillimeters(millimetersForRate(rate, seconds), area), rate * seconds / 3600 * area / 1000);
  assert.equal(millimetersFromCubicMeters(cubic, area), cubic * 1000 / area);
  assert.equal(secondsForMillimeters(rate, 12.5), (rate / 12.5) * 3600);
});

test('une durée d’arrêt se découpe en heures pleines et minutes, et se recompose', () => {
  // Les deux champs que le maraîcher remplit au forage, et leur inverse.
  assert.deepEqual(hoursAndMinutesFromSeconds(57_600), { hours: 16, minutes: 0 });
  assert.deepEqual(hoursAndMinutesFromSeconds(5_400), { hours: 1, minutes: 30 });
  assert.deepEqual(hoursAndMinutesFromSeconds(0), { hours: 0, minutes: 0 });
  // Une durée absente ou absurde vaut zéro plutôt que de produire « NaN h ».
  assert.deepEqual(hoursAndMinutesFromSeconds(-1), { hours: 0, minutes: 0 });
  assert.deepEqual(hoursAndMinutesFromSeconds(Number.NaN), { hours: 0, minutes: 0 });

  for (const seconds of [0, 60, 3_599, 3_600, 5_400, 57_600, 90_061]) {
    const { hours, minutes } = hoursAndMinutesFromSeconds(seconds);
    assert.ok(minutes >= 0 && minutes <= 60, `minutes hors bornes pour ${seconds}`);
    assert.ok(Math.abs(hours * 3_600 + minutes * 60 - seconds) < 60, `recomposition fausse pour ${seconds}`);
  }
});
