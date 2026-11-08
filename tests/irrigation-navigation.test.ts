import assert from 'node:assert/strict';
import test from 'node:test';
import {
  closestAvailableSeason,
  irrigationHref,
  parseIrrigationSeason,
  parseIrrigationWeek,
} from '../lib/domain/irrigation-navigation.ts';

test('la saison de l’URL est validée strictement', () => {
  assert.equal(parseIrrigationSeason('2027', 2026), 2027);
  assert.equal(parseIrrigationSeason('2027abc', 2026), 2026);
  assert.equal(parseIrrigationSeason(['2026', '2027'], 2025), 2025);
  assert.equal(parseIrrigationSeason('2300', 2026), 2026);
});

test('les liens de navigation conservent toujours la saison', () => {
  assert.equal(irrigationHref(2027), '/irrigation?season=2027');
  assert.equal(
    irrigationHref(2027, true),
    '/irrigation?season=2027&refresh=1',
  );
});

test('une saison hors plage est ramenée vers la borne OTF la plus proche', () => {
  assert.equal(closestAvailableSeason(2021, 2022, 2027), 2022);
  assert.equal(closestAvailableSeason(2028, 2022, 2027), 2027);
  assert.equal(closestAvailableSeason(2026, 2022, 2027), 2026);
});

test('la semaine de l’URL, ouverte par le clic sur une alerte météo, est ramenée à son lundi ; invalide, elle est ignorée', () => {
  assert.equal(parseIrrigationWeek('2026-11-02'), '2026-11-02');
  assert.equal(parseIrrigationWeek('2026-11-05'), '2026-11-02');
  assert.equal(parseIrrigationWeek('2026-11-08'), '2026-11-02');
  assert.equal(parseIrrigationWeek('2026-02-30'), null);
  assert.equal(parseIrrigationWeek('lundi'), null);
  assert.equal(parseIrrigationWeek(['2026-11-02', '2026-11-09']), null);
  assert.equal(parseIrrigationWeek(undefined), null);
});
