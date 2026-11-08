import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  weatherRefreshClaimed,
  weatherRefreshRequired,
  weatherRequestRanges,
  automaticWeatherRequestRanges,
  oldestWeatherReadingInUse,
} from '../lib/domain/weather/cache-policy.ts';
import { locationKeyForCandidate, weatherLocationKey } from '../lib/domain/weather/location.ts';

const structure = {
  id: '17', name: 'Ferme', legalCity: 'Saint-Aubin',
  legalPostcode: '03160', legalCountry: 'FR',
};

test('la commune du siège OTF est la référence par défaut sans être recopiée', () => {
  assert.equal(weatherLocationKey({
    locationMode: 'otf', customCity: null, customPostcode: null,
  }, structure), 'otf:saint-aubin:03160');
});

test('une commune personnalisée possède une clé distincte et le retour OTF est déterministe', () => {
  const candidate = {
    displayName: 'Tronget · 03240', city: 'Tronget', postcode: '03240',
    latitude: 46.42, longitude: 3.07, timezone: 'Europe/Paris', countryCode: 'FR',
  };
  assert.equal(locationKeyForCandidate(candidate), 'custom:tronget:03240');
  assert.equal(weatherLocationKey({
    locationMode: 'custom', customCity: 'Tronget', customPostcode: '03240',
  }, structure), 'custom:tronget:03240');
});

test('le cache météo évite les appels à chaque interaction et reste forçable', () => {
  const now = new Date('2026-09-02T12:00:00Z');
  assert.equal(weatherRefreshRequired({
    force: false, selectedWeek: '2026-08-31', currentWeek: '2026-08-31',
    hasCachedValues: true, lastSuccessfulRefreshAt: '2026-09-02T10:00:00Z',
    now, refreshIntervalMs: 3 * 3_600_000,
  }), false);
  assert.equal(weatherRefreshRequired({
    force: true, selectedWeek: '2026-08-31', currentWeek: '2026-08-31',
    hasCachedValues: true, lastSuccessfulRefreshAt: '2026-09-02T10:00:00Z',
    now, refreshIntervalMs: 3 * 3_600_000,
  }), true);
  assert.equal(weatherRefreshRequired({
    force: false, selectedWeek: '2026-08-17', currentWeek: '2026-08-31',
    hasCachedValues: false, lastSuccessfulRefreshAt: '2026-09-02T10:00:00Z',
    now, refreshIntervalMs: 3 * 3_600_000,
  }), true);
  assert.equal(weatherRefreshRequired({
    force: false, selectedWeek: '2026-08-31', currentWeek: '2026-08-31',
    hasCachedValues: true, lastSuccessfulRefreshAt: '2026-09-02T05:00:00Z',
    now, refreshIntervalMs: 3 * 3_600_000,
  }), true);
});

test('le schéma 2.8 ne contient aucun système de niveaux hydriques', () => {
  const sources = [
    readFileSync('db/schema.ts', 'utf8'),
    readFileSync('drizzle/0006_water_objectives_weather_limits.sql', 'utf8'),
  ].join('\n').toLocaleLowerCase('fr-FR');
  assert.doesNotMatch(sources, /hydric[_ -]?level|niveau[_ -]?hydrique/);
});

test('une panne météo ne déclenche pas une nouvelle tentative à chaque action', () => {
  assert.equal(weatherRefreshRequired({
    force: false, selectedWeek: '2026-08-31', currentWeek: '2026-08-31',
    hasCachedValues: false, lastSuccessfulRefreshAt: null,
    lastRefreshAttemptAt: '2026-09-02T11:59:00Z', now: new Date('2026-09-02T12:00:00Z'),
    refreshIntervalMs: 3 * 3_600_000,
  }), false);
});

test('Retry-After bloque aussi une actualisation manuelle jusqu’à son échéance', () => {
  const base = {
    selectedWeek: '2026-08-31', currentWeek: '2026-08-31',
    hasCachedValues: true, lastSuccessfulRefreshAt: '2026-09-02T10:00:00Z',
    lastRefreshAttemptAt: '2026-09-02T11:59:00Z',
    refreshNotBeforeAt: '2026-09-02T12:01:30Z',
    refreshIntervalMs: 3 * 3_600_000,
  };
  assert.equal(weatherRefreshRequired({
    ...base, force: true, now: new Date('2026-09-02T12:00:00Z'),
  }), false);
  assert.equal(weatherRefreshRequired({
    ...base, force: true, now: new Date('2026-09-02T12:01:30Z'),
  }), true);
});

test('le verrou météo reconnaît les deux formats de résultat D1 déployés', () => {
  assert.equal(weatherRefreshClaimed({ changes: 1 }), true);
  assert.equal(weatherRefreshClaimed({ rows_written: 1 }), true);
  assert.equal(weatherRefreshClaimed({ changes: 0, rows_written: 1 }), true);
  assert.equal(weatherRefreshClaimed({ changes: 0, rows_written: 0 }), false);
});

test('la semaine courante mélange passé indisponible et prévisions sans décaler les dates', () => {
  assert.deepEqual(weatherRequestRanges({
    weekStart: '2026-09-14',
    today: '2026-09-15',
  }), {
    forecast: { startDate: '2026-09-15', endDate: '2026-09-20' },
    reanalysis: null,
  });
});

test('une semaine historique complète utilise uniquement la réanalyse', () => {
  assert.deepEqual(weatherRequestRanges({
    weekStart: '2026-08-31',
    today: '2026-09-15',
  }), {
    forecast: null,
    reanalysis: { startDate: '2026-08-31', endDate: '2026-09-06' },
  });
});

test('une semaine future dans l’horizon utilise ses sept dates du lundi au dimanche', () => {
  assert.deepEqual(weatherRequestRanges({
    weekStart: '2026-09-21',
    today: '2026-09-15',
  }), {
    forecast: { startDate: '2026-09-21', endDate: '2026-09-27' },
    reanalysis: null,
  });
});

test('la tâche serveur couvre les prévisions et rattrape dix jours glissants', () => {
  assert.deepEqual(automaticWeatherRequestRanges({ today: '2026-09-16' }), {
    forecast: { startDate: '2026-09-16', endDate: '2026-09-30' },
    reanalysis: { startDate: '2026-09-06', endDate: '2026-09-11' },
  });
});

test('la date météo affichée ignore les prévisions figées des jours passés (recette 3.4, ligne A2)', () => {
  type Kind = 'forecast' | 'reanalysis' | 'manual_precipitation';
  const reading = (date: string, dataKind: Kind, fetchedAt: string) => ({ date, dataKind, fetchedAt });
  const frozenForecasts = ['2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19']
    .map((date) => reading(date, 'forecast', '2026-09-15T16:24:00.000Z'));
  const morningSync = [
    reading('2026-09-14', 'reanalysis', '2026-09-20T04:15:00.000Z'),
    reading('2026-09-15', 'reanalysis', '2026-09-20T04:15:00.000Z'),
    reading('2026-09-20', 'forecast', '2026-09-20T04:15:00.000Z'),
  ];
  const gauge = reading('2026-09-17', 'manual_precipitation', '2026-09-17T18:00:00.000Z');
  // Le 20 septembre : les prévisions du 15 au 19 ne servent plus, la synchronisation du matin fait foi.
  assert.equal(oldestWeatherReadingInUse([...frozenForecasts, ...morningSync, gauge], '2026-09-20'), '2026-09-20T04:15:00.000Z');
  // Le 16 septembre : les prévisions du 16 au 19 sont encore à venir, leur lecture du 15 compte.
  assert.equal(oldestWeatherReadingInUse([...frozenForecasts, ...morningSync], '2026-09-16'), '2026-09-15T16:24:00.000Z');
  // Une réanalyse compte toujours, même ancienne : elle porte la pluie réelle.
  assert.equal(
    oldestWeatherReadingInUse([reading('2026-09-14', 'reanalysis', '2026-09-01T00:00:00.000Z'), morningSync[2]], '2026-09-20'),
    '2026-09-01T00:00:00.000Z',
  );
  // Seulement des prévisions passées ou des mesures du pluviomètre : aucune date fournisseur à afficher.
  assert.equal(oldestWeatherReadingInUse([frozenForecasts[1], gauge], '2026-09-20'), null);
});
