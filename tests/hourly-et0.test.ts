import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HIGH_DEMAND_SHARE_OF_DAILY_MAXIMUM,
  HOURLY_ET0_NATURES,
  type HourlyEt0Nature,
  NIGHT_NEGATIVE_TOLERANCE_MM,
  dayShape,
  elapsedShare,
  highDemandRange,
  hoursOfDay,
  readDayShape,
  sharesFromHourlyEt0,
  theoreticalShares,
} from '../lib/domain/weather/hourly-et0.ts';

/**
 * L'ET0 horaire, la forme de la journée, sans base ni réseau
 * (docs/et0-horaire-contract.md, D-340, PR HR1) : les scénarios 1 à 6, 8 et 9
 * de la section 11 du contrat. Les scénarios 7, 10 et 11 (sources, écriture,
 * deux fermes sur un lieu) viennent avec HR2 ; le scénario 12 (aucun chiffre
 * existant ne change) est tenu par les tests de la jauge, de l'ETM, de
 * l'objectif et des alertes, que cette PR ne modifie pas.
 */

const PARIS = 'Europe/Paris';
const NANTES = { latitude: 47.22, longitude: -1.55 };
const DAY = '2026-06-15';
const DAY_ET0_MM = 2.4;

/** L'ET0 horaire du fournisseur du jour d'exemple (§ 11), en mm, heures 0 à 23. */
const EXAMPLE_HOURLY_MM = [
  0, 0, 0, 0, 0, 0,
  0.01, 0.03, 0.07, 0.13, 0.20, 0.27, 0.31, 0.33, 0.31, 0.26, 0.19, 0.11, 0.05, 0.01,
  0, 0, 0, 0,
];
const EXAMPLE_SUM_MM = 2.28;

function exampleShape() {
  const shape = dayShape({ date: DAY, timeZone: PARIS, location: NANTES, providerHourlyEt0Mm: EXAMPLE_HOURLY_MM });
  assert.ok(shape);
  return shape;
}

/** L'instant d'une heure d'horloge de Paris le jour d'exemple (heure d'été, UTC+2). */
function parisSummer(hour: number, minute = 0): string {
  return new Date(Date.UTC(2026, 5, 15, hour - 2, minute)).toISOString();
}

const close = (actual: number | null, expected: number, tolerance = 0.005) => {
  assert.ok(actual !== null, 'valeur inconnue');
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} au lieu de ${expected}`);
};

test('un jour ordinaire compte 24 heures, de minuit à minuit au fuseau du lieu', () => {
  const hours = hoursOfDay(DAY, PARIS);
  assert.equal(hours.length, 24);
  assert.deepEqual(hours.map((hour) => hour.localHour), Array.from({ length: 24 }, (_, index) => index));
  assert.equal(hours[0].startsAt, '2026-06-14T22:00:00.000Z');
  assert.equal(hours[23].endsAt, '2026-06-15T22:00:00.000Z');
  assert.ok(hours.every((hour, index) => hour.index === index));
});

test('le fuseau est celui du lieu, jamais Paris par défaut (D-028)', () => {
  const hours = hoursOfDay(DAY, 'America/Martinique');
  assert.equal(hours.length, 24);
  assert.equal(hours[0].startsAt, '2026-06-15T04:00:00.000Z');
});

test('scénario 1 : la part d’une heure et ses millimètres sur le total du jour', () => {
  const shape = exampleShape();
  assert.equal(shape.nature, 'provider-hourly');
  close(shape.shares.reduce((total, share) => total + share, 0), 1, 1e-12);
  close(shape.shares[14], 0.31 / EXAMPLE_SUM_MM, 1e-12);
  close(shape.shares[14], 0.136, 0.0005);
  close(shape.shares[14] * DAY_ET0_MM, 0.33, 0.005);
});

test('le total du jour reste la référence : la somme des heures n’a pas à l’égaler', () => {
  const shape = exampleShape();
  // À 20 h, toute la consommation du jour est passée : 2,4 mm, le total du jour, et non 2,28 mm, la somme des heures.
  const evening = readDayShape(shape, DAY_ET0_MM, parisSummer(20));
  close(evening.consumedMm, DAY_ET0_MM, 1e-12);
  assert.notEqual(EXAMPLE_SUM_MM, DAY_ET0_MM);
  const afterDay = readDayShape(shape, DAY_ET0_MM, '2026-06-16T08:00:00.000Z');
  close(afterDay.consumedMm, DAY_ET0_MM, 1e-12);
  close(afterDay.remainingMm, 0, 1e-12);
});

test('scénario 2 : à 12 h, 31,1 % consommés, 0,75 mm passés, 1,65 mm à venir', () => {
  const shape = exampleShape();
  close(elapsedShare(shape, parisSummer(12)), 0.311, 0.0005);
  const reading = readDayShape(shape, DAY_ET0_MM, parisSummer(12));
  close(reading.consumedMm, 0.75, 0.005);
  close(reading.remainingMm, 1.65, 0.005);
});

test('scénario 3 : une planche à ETM de 3,0 mm garde la même forme, 2,07 mm à venir à 12 h', () => {
  const reading = readDayShape(exampleShape(), 3.0, parisSummer(12));
  close(reading.remainingMm, 2.07, 0.005);
});

test('scénario 4 : à 12 h 30, la moitié de l’heure 12 est comptée, 37,9 %', () => {
  close(elapsedShare(exampleShape(), parisSummer(12, 30)), 0.379, 0.0005);
});

test('avant le début du jour rien n’est consommé', () => {
  const reading = readDayShape(exampleShape(), DAY_ET0_MM, '2026-06-14T21:00:00.000Z');
  assert.equal(reading.consumedMm, 0);
  assert.equal(reading.remainingMm, DAY_ET0_MM);
});

test('scénario 5 : les heures à 75 % du maximum, de 11 h à 16 h', () => {
  assert.equal(HIGH_DEMAND_SHARE_OF_DAILY_MAXIMUM, 0.75);
  const shape = exampleShape();
  const range = highDemandRange(shape);
  assert.ok(range);
  assert.equal(range.firstHourIndex, 11);
  assert.equal(range.lastHourIndex, 15);
  assert.equal(range.startsAt, parisSummer(11));
  assert.equal(range.endsAt, parisSummer(16));
  assert.deepEqual(readDayShape(shape, DAY_ET0_MM, parisSummer(9)).highDemand, range);
});

test('les heures de forte évaporation se regroupent en une seule plage', () => {
  const twoPeaks = [...EXAMPLE_HOURLY_MM];
  twoPeaks[13] = 0.10;
  const shape = dayShape({ date: DAY, timeZone: PARIS, location: NANTES, providerHourlyEt0Mm: twoPeaks });
  assert.ok(shape);
  const range = highDemandRange(shape);
  assert.ok(range);
  assert.equal(range.firstHourIndex, 11);
  assert.equal(range.lastHourIndex, 15);
});

test('scénario 6 : le jour du passage à l’heure d’été compte 23 heures, sans 2 h', () => {
  const hours = hoursOfDay('2026-03-29', PARIS);
  assert.equal(hours.length, 23);
  assert.ok(!hours.some((hour) => hour.localHour === 2));
  const shape = dayShape({ date: '2026-03-29', timeZone: PARIS, location: NANTES });
  assert.ok(shape);
  assert.equal(shape.shares.length, 23);
  close(shape.shares.reduce((total, share) => total + share, 0), 1, 1e-12);
  assert.equal(sharesFromHourlyEt0(EXAMPLE_HOURLY_MM, hours.length), null, '24 valeurs pour 23 heures : refusées');
  assert.ok(sharesFromHourlyEt0(EXAMPLE_HOURLY_MM.slice(0, 23), hours.length));
});

test('le jour du retour à l’heure d’hiver compte 25 heures, 2 h comptée deux fois dans l’ordre', () => {
  const hours = hoursOfDay('2026-10-25', PARIS);
  assert.equal(hours.length, 25);
  assert.deepEqual(hours.slice(0, 5).map((hour) => hour.localHour), [0, 1, 2, 2, 3]);
  assert.ok(Date.parse(hours[2].startsAt) < Date.parse(hours[3].startsAt));
  const shape = dayShape({ date: '2026-10-25', timeZone: PARIS, location: NANTES });
  assert.ok(shape);
  assert.equal(shape.shares.length, 25);
  close(shape.shares.reduce((total, share) => total + share, 0), 1, 1e-12);
});

test('une heure absente refuse la forme du fournisseur ; jamais 0 pour cette heure', () => {
  const withHole: (number | null)[] = [...EXAMPLE_HOURLY_MM];
  withHole[13] = null;
  assert.equal(sharesFromHourlyEt0(withHole, 24), null);
  const notANumber = [...EXAMPLE_HOURLY_MM];
  notANumber[13] = Number.NaN;
  assert.equal(sharesFromHourlyEt0(notANumber, 24), null);
});

test('une petite valeur négative de nuit vaut 0 ; une valeur franchement négative est absente', () => {
  const nightNegative = [...EXAMPLE_HOURLY_MM];
  nightNegative[2] = -0.02;
  const shares = sharesFromHourlyEt0(nightNegative, 24);
  assert.ok(shares);
  assert.equal(shares[2], 0);
  close(shares[14], 0.31 / EXAMPLE_SUM_MM, 1e-12);
  const tooNegative = [...EXAMPLE_HOURLY_MM];
  tooNegative[2] = -(NIGHT_NEGATIVE_TOLERANCE_MM + 0.01);
  assert.equal(sharesFromHourlyEt0(tooNegative, 24), null);
});

test('une journée dont la somme est nulle n’a pas de forme du fournisseur', () => {
  assert.equal(sharesFromHourlyEt0(Array.from({ length: 24 }, () => 0), 24), null);
});

test('trois sources, de la plus fine à la plus simple (§ 2, choix 3)', () => {
  const order: readonly HourlyEt0Nature[] = ['provider-hourly', 'computed-hourly', 'theoretical'];
  assert.deepEqual(HOURLY_ET0_NATURES, order);
});

test('la source suivante est prise quand la précédente est refusée, et la nature le dit', () => {
  const withHole: (number | null)[] = [...EXAMPLE_HOURLY_MM];
  withHole[13] = null;
  const computed = dayShape({
    date: DAY, timeZone: PARIS, location: NANTES, providerHourlyEt0Mm: withHole, computedHourlyEt0Mm: EXAMPLE_HOURLY_MM,
  });
  assert.equal(computed?.nature, 'computed-hourly');
  const theoretical = dayShape({
    date: DAY, timeZone: PARIS, location: NANTES, providerHourlyEt0Mm: withHole, computedHourlyEt0Mm: withHole,
  });
  assert.equal(theoretical?.nature, 'theoretical');
});

test('scénario 8 : ET0 du jour manquante, la forme existe mais aucune valeur n’est dite', () => {
  const shape = exampleShape();
  for (const total of [null, undefined, Number.NaN, -1]) {
    assert.deepEqual(readDayShape(shape, total, parisSummer(12)), { consumedMm: null, remainingMm: null, highDemand: null });
  }
  assert.equal(shape.shares.length, 24);
});

test('scénario 9 : sans heures du fournisseur, la forme théorique, symétrique autour du midi solaire', () => {
  const shape = dayShape({ date: DAY, timeZone: PARIS, location: NANTES, providerHourlyEt0Mm: null });
  assert.ok(shape);
  assert.equal(shape.nature, 'theoretical');
  close(shape.shares.reduce((total, share) => total + share, 0), 1, 1e-12);
  // Le midi solaire de Nantes tombe vers 14 h 06 en été (UTC+2, longitude −1,55°) : le maximum est à l'heure 13 ou 14.
  const peak = shape.shares.indexOf(Math.max(...shape.shares));
  assert.ok(peak === 13 || peak === 14, `maximum à l'heure ${peak}`);
  assert.equal(shape.shares[2], 0, 'la nuit ne consomme rien');

  // À l'équinoxe, sur le méridien de Greenwich, à l'heure UTC : symétrie exacte autour de midi.
  const equinox = theoreticalShares('2026-03-20', 'UTC', { latitude: 45, longitude: 0 });
  assert.ok(equinox);
  for (let hour = 0; hour < 12; hour += 1) close(equinox[hour], equinox[23 - hour], 1e-12);
});

test('la forme théorique est inconnue pendant la nuit polaire, jamais inventée', () => {
  assert.equal(theoreticalShares('2026-12-21', 'UTC', { latitude: 80, longitude: 0 }), null);
  assert.equal(dayShape({ date: '2026-12-21', timeZone: 'UTC', location: { latitude: 80, longitude: 0 } }), null);
});

test('sous abri, même forme que le plein champ : seul le total change (question 2)', () => {
  const shape = exampleShape();
  const openField = readDayShape(shape, DAY_ET0_MM, parisSummer(12));
  const underCover = readDayShape(shape, DAY_ET0_MM * 0.8, parisSummer(12));
  assert.ok(openField.remainingMm !== null && underCover.remainingMm !== null);
  close(underCover.remainingMm / openField.remainingMm, 0.8, 1e-12);
  assert.deepEqual(underCover.highDemand, openField.highDemand);
});

test('un jour invalide est refusé', () => {
  assert.throws(() => hoursOfDay('2026-02-30', PARIS), /Jour invalide/);
  assert.throws(() => elapsedShare(exampleShape(), 'pas une date'), /Instant invalide/);
});
