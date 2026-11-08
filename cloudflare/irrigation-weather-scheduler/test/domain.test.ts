import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isParisDailyWeatherWindow,
  schedulerResponseRetriable,
  schedulerRetryDelayMs,
} from '../src/domain.ts';

test('le créneau quotidien reste 06:15 à Paris en hiver comme en été', () => {
  assert.equal(isParisDailyWeatherWindow(new Date('2026-01-15T05:15:00Z')), true);
  assert.equal(isParisDailyWeatherWindow(new Date('2026-01-15T04:15:00Z')), false);
  assert.equal(isParisDailyWeatherWindow(new Date('2026-07-15T04:15:00Z')), true);
  assert.equal(isParisDailyWeatherWindow(new Date('2026-07-15T05:15:00Z')), false);
});

test('le planificateur ne retente que les réponses temporaires avec une attente bornée', () => {
  assert.equal(schedulerResponseRetriable(429), true);
  assert.equal(schedulerResponseRetriable(503), true);
  assert.equal(schedulerResponseRetriable(401), false);
  assert.equal(schedulerRetryDelayMs(new Response(null, {
    status: 429,
    headers: { 'Retry-After': '60' },
  }), 1), 2_000);
  assert.equal(schedulerRetryDelayMs(new Response(null, { status: 503 }), 2), 500);
});
