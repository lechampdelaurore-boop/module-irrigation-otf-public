import assert from 'node:assert/strict';
import test from 'node:test';
import {
  finishManualWeatherRefresh,
  tryStartManualWeatherRefresh,
  weatherGeocodingRequired,
} from '../lib/domain/weather/refresh-control.ts';

test('un double clic ne peut démarrer qu’une seule actualisation météo', () => {
  const gate = { running: false };
  assert.equal(tryStartManualWeatherRefresh(gate), true);
  assert.equal(tryStartManualWeatherRefresh(gate), false);
  finishManualWeatherRefresh(gate);
  assert.equal(tryStartManualWeatherRefresh(gate), true);
});

test('une commune déjà géocodée ne déclenche pas un second géocodage', () => {
  assert.equal(weatherGeocodingRequired(false), true);
  assert.equal(weatherGeocodingRequired(true), false);
});
