import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  EVENING_REMINDER_CRON,
  EVENING_REMINDER_TIMEOUT_MS,
  OPERATOR_WATCH_CRON,
  OPERATOR_WATCH_TIMEOUT_MS,
  SITE_SYNC_TIMEOUT_MS,
  WEATHER_CRON,
  isParisDailyWeatherWindow,
  scheduledJob,
  schedulerErrorRetriable,
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

test('un délai dépassé ne relance pas la synchronisation, une coupure réseau si (D-166)', () => {
  assert.equal(SITE_SYNC_TIMEOUT_MS, 90_000);
  assert.equal(schedulerErrorRetriable(new DOMException('The operation timed out.', 'TimeoutError')), false);
  assert.equal(schedulerErrorRetriable(new DOMException('aborted', 'AbortError')), false);
  assert.equal(schedulerErrorRetriable(new TypeError('Network connection lost.')), true);
  assert.equal(schedulerErrorRetriable('inconnue'), true);
});

test('4.5 (F608) : la veille de l’exploitant part à 9 h à Paris, en hiver comme en été, la météo à 6 h 15', () => {
  assert.equal(scheduledJob(OPERATOR_WATCH_CRON, new Date('2026-01-15T08:00:00Z')), 'operator-watch', '9 h en hiver');
  assert.equal(scheduledJob(OPERATOR_WATCH_CRON, new Date('2026-01-15T07:00:00Z')), null, '8 h en hiver : le créneau d’été est sauté');
  assert.equal(scheduledJob(OPERATOR_WATCH_CRON, new Date('2026-07-15T07:00:00Z')), 'operator-watch', '9 h en été');
  assert.equal(scheduledJob(OPERATOR_WATCH_CRON, new Date('2026-07-15T08:00:00Z')), null, '10 h en été');
  assert.equal(scheduledJob(WEATHER_CRON, new Date('2026-01-15T05:15:00Z')), 'weather');
  assert.equal(scheduledJob(WEATHER_CRON, new Date('2026-01-15T04:15:00Z')), null);
  assert.equal(scheduledJob('0 3 * * *', new Date('2026-01-15T08:00:00Z')), null, 'une expression inconnue ne lance rien');
  assert.equal(scheduledJob(WEATHER_CRON, new Date('2026-01-15T08:00:00Z')), null, 'une heure ne lance pas l’autre tâche');
  assert.ok(OPERATOR_WATCH_TIMEOUT_MS < SITE_SYNC_TIMEOUT_MS);
});

test('les trois déclencheurs du code sont exactement ceux de la configuration', () => {
  const text = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8')
    .split('\n').filter((line) => !/^\s*\/\//.test(line)).join('\n');
  const config = JSON.parse(text) as { triggers: { crons: string[] } };
  assert.deepEqual(config.triggers.crons, [WEATHER_CRON, OPERATOR_WATCH_CRON, EVENING_REMINDER_CRON]);
});

test('amélioration n° 2 (F705) : le passage du rappel du soir part à chaque heure, été comme hiver ; le site trie les fermes dues', () => {
  assert.equal(EVENING_REMINDER_CRON, '5 * * * *');
  assert.equal(scheduledJob(EVENING_REMINDER_CRON, new Date('2026-01-15T18:05:00Z')), 'evening-reminder', '19 h 05 en hiver');
  assert.equal(scheduledJob(EVENING_REMINDER_CRON, new Date('2026-07-15T17:05:00Z')), 'evening-reminder', '19 h 05 en été');
  assert.equal(scheduledJob(EVENING_REMINDER_CRON, new Date('2026-07-15T03:05:00Z')), 'evening-reminder', 'la nuit aussi : le site ne lit rien avant 17 h');
  assert.equal(scheduledJob(OPERATOR_WATCH_CRON, new Date('2026-01-15T18:05:00Z')), null, 'une heure ne lance pas l’autre tâche');
  assert.ok(EVENING_REMINDER_TIMEOUT_MS < SITE_SYNC_TIMEOUT_MS);
});
