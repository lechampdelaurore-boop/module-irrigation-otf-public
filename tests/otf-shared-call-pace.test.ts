import assert from 'node:assert/strict';
import test from 'node:test';
import { OtfApiError } from '../lib/domain/otf/api-contract.ts';
import { OTF_CALL_WINDOW_MS, OTF_CALLS_PER_MINUTE } from '../lib/domain/otf/call-pace.ts';
import {
  farmReadReserve,
  farmReadStart,
  nextReserveBasis,
  oldestKeptCountDay,
  OTF_MORNING_MINUTE_WAIT_MS,
  OtfReadDeferredError,
  otfRateLimitCode,
  parisDayOf,
  pauseAfterRateLimit,
  retryAfterMilliseconds,
  sharedPlaceRefusal,
  type OtfCallPause,
  type SharedPaceState,
} from '../lib/domain/otf/shared-call-pace.ts';

/**
 * Les règles pures du compteur partagé (4.3, PR 1 ; docs/tranche-4-contract.md,
 * F359, F361 à F363, F381 à F390) : la réserve d'une lecture, ce qui la
 * laisse partir, pourquoi une place est refusée et quand en redemander une,
 * et la pause qui suit une limite d'OTF.
 */

// L'espacement du connecteur : 250 ms et sa marge (lib/adapters/otf/read-client.ts).
const SPACING_MS = 255;

function state({ starts = [], reserved = [], pauses = [] }: { starts?: number[]; reserved?: number[]; pauses?: OtfCallPause[] }): SharedPaceState {
  return {
    lastStartedAtMs: starts.length > 0 ? Math.max(...starts) : null,
    windowPlacesMs: [...starts, ...reserved].sort((first, second) => first - second),
    pauses,
  };
}

function spacedStarts(first: number, count: number): number[] {
  return Array.from({ length: count }, (_, index) => first + index * SPACING_MS);
}

test('la réserve d’une lecture : les appels de la dernière lecture complète, plus deux, ou 25 sans elle (F362)', () => {
  assert.equal(farmReadReserve(null), 25);
  assert.equal(farmReadReserve(22), 24);
  assert.equal(farmReadReserve(0), 2);
});

test('la base de la réserve suivante : les appels d’une lecture complète, au moins un de plus après un manque de place, sinon celle d’avant (F362)', () => {
  assert.equal(nextReserveBasis(22, { kind: 'complete', calls: 19 }), 19, 'une ferme qui a rétréci réserve moins');
  assert.equal(nextReserveBasis(22, { kind: 'out-of-places', calls: 24 }), 25, 'l’appel refusé compte');
  assert.equal(nextReserveBasis(30, { kind: 'out-of-places', calls: 24 }), 30, 'jamais moins que la base d’avant');
  assert.equal(nextReserveBasis(null, { kind: 'out-of-places', calls: 25 }), 26);
  assert.equal(nextReserveBasis(22, { kind: 'failed' }), 22);
  assert.equal(nextReserveBasis(null, { kind: 'failed' }), null);
});

test('une place refusée par l’espacement se redemande à la fin de l’espacement ; sans raison visible, aussitôt (F361)', () => {
  assert.deepEqual(sharedPlaceRefusal(state({ starts: [10_000] }), 10_100, { spacingMs: SPACING_MS }), { kind: 'retry-at', atMs: 10_255 });
  // Une autre instance a pris la place entre-temps : rien n'empêche de redemander.
  assert.deepEqual(sharedPlaceRefusal(state({ starts: [9_000] }), 10_000, { spacingMs: SPACING_MS }), { kind: 'retry-at', atMs: 10_000 });
});

test('une minute pleine : l’appel attend cinq secondes au plus à l’écran, sinon il s’arrête avec l’heure de la place (F361, F362)', () => {
  const full = state({ starts: spacedStarts(100_000, OTF_CALLS_PER_MINUTE) });
  const freesAt = 100_000 + OTF_CALL_WINDOW_MS;

  assert.deepEqual(sharedPlaceRefusal(full, 130_000, { spacingMs: SPACING_MS }), { kind: 'stop', reason: 'minute', retryAtMs: freesAt });
  assert.deepEqual(sharedPlaceRefusal(full, freesAt - 4_000, { spacingMs: SPACING_MS }), { kind: 'retry-at', atMs: freesAt });
  // Le calcul du matin attend une fenêtre entière et une seconde (F383).
  assert.deepEqual(
    sharedPlaceRefusal(full, 130_000, { spacingMs: SPACING_MS, maxWaitMs: OTF_MORNING_MINUTE_WAIT_MS }),
    { kind: 'retry-at', atMs: freesAt },
  );
});

test('une place réservée encore dans la minute y compte déjà : la prendre ne demande pas de place de plus ; sortie de la minute, si (F362, F384)', () => {
  const readStart = 100_000;
  const reservedMinute = state({ starts: spacedStarts(readStart, 5), reserved: Array.from({ length: 25 }, () => readStart) });
  const askedAt = readStart + 5 * SPACING_MS;

  assert.deepEqual(
    sharedPlaceRefusal(reservedMinute, askedAt, { spacingMs: SPACING_MS, reservedPlaceAtMs: readStart }),
    { kind: 'retry-at', atMs: askedAt },
    'la place réservée de la lecture n’attend que l’espacement',
  );
  assert.equal(sharedPlaceRefusal(reservedMinute, askedAt, { spacingMs: SPACING_MS }).kind, 'stop', 'une place neuve, elle, ne tient pas');

  // Une lecture de plus d'une minute : ses places réservées sont sorties de la minute, qui est pleine d'autres départs.
  const later = readStart + OTF_CALL_WINDOW_MS + 10_000;
  const othersFull = state({ starts: spacedStarts(later - 20_000, OTF_CALLS_PER_MINUTE) });
  assert.deepEqual(
    sharedPlaceRefusal(othersFull, later, { spacingMs: SPACING_MS, reservedPlaceAtMs: readStart }),
    { kind: 'stop', reason: 'minute', retryAtMs: later - 20_000 + OTF_CALL_WINDOW_MS },
  );
});

test('une pause arrête l’appel jusqu’à sa fin ; quand deux courent, celle qui finit la dernière donne l’heure (F359, F361)', () => {
  const farmPause: OtfCallPause = { scope: 'farm', untilMs: 20_000, reason: 'rate-limit' };
  const brake: OtfCallPause = { scope: 'module', untilMs: 15_000, reason: 'authentication-brake' };

  assert.deepEqual(sharedPlaceRefusal(state({ pauses: [farmPause] }), 10_000, { spacingMs: SPACING_MS }), { kind: 'stop', reason: 'rate-limit', retryAtMs: 20_000 });
  assert.deepEqual(sharedPlaceRefusal(state({ pauses: [brake, farmPause] }), 10_000, { spacingMs: SPACING_MS }), { kind: 'stop', reason: 'rate-limit', retryAtMs: 20_000 });
  assert.deepEqual(
    sharedPlaceRefusal(state({ pauses: [farmPause, { ...brake, untilMs: 20_000 }] }), 10_000, { spacingMs: SPACING_MS }),
    { kind: 'stop', reason: 'authentication-brake', retryAtMs: 20_000 },
    'à égalité, celle du module',
  );
  assert.deepEqual(sharedPlaceRefusal(state({ pauses: [farmPause] }), 20_000, { spacingMs: SPACING_MS }), { kind: 'retry-at', atMs: 20_000 }, 'une pause finie ne retient plus');
});

test('le départ d’une lecture : pas pendant une pause, ni pendant une autre lecture de la ferme ; sa réserve doit tenir dans la minute (F362)', () => {
  const atMs = 1_000_000;
  const empty = state({});
  const pause: OtfCallPause = { scope: 'farm', untilMs: atMs + 30_000, reason: 'day-limit' };

  assert.deepEqual(farmReadStart({ state: empty, leaseHeld: false, reserve: 25, atMs, context: 'page' }), { kind: 'start', places: 25 });
  assert.deepEqual(farmReadStart({ state: state({ pauses: [pause] }), leaseHeld: true, reserve: 25, atMs, context: 'page' }), {
    kind: 'deferred', reason: 'day-limit', retryAtMs: atMs + 30_000,
  });
  assert.deepEqual(farmReadStart({ state: empty, leaseHeld: true, reserve: 25, atMs, context: 'page' }), { kind: 'busy' });

  // Cinq places prises : 25 tiennent encore ; six, la plus ancienne doit sortir d'abord.
  const five = state({ starts: spacedStarts(atMs - 10_000, 5) });
  assert.deepEqual(farmReadStart({ state: five, leaseHeld: false, reserve: 25, atMs, context: 'page' }), { kind: 'start', places: 25 });
  const six = state({ starts: spacedStarts(atMs - 10_000, 6) });
  assert.deepEqual(farmReadStart({ state: six, leaseHeld: false, reserve: 25, atMs, context: 'page' }), {
    kind: 'deferred', reason: 'minute', retryAtMs: atMs - 10_000 + OTF_CALL_WINDOW_MS,
  });
});

test('une lecture de plus de 30 appels ne tient dans aucune minute : à l’écran elle n’a pas lieu, au calcul du matin elle part avec 30 places (F362)', () => {
  const empty = state({});
  assert.deepEqual(farmReadStart({ state: empty, leaseHeld: false, reserve: 31, atMs: 0, context: 'page' }), {
    kind: 'deferred', reason: 'too-many-calls', retryAtMs: null,
  });
  assert.deepEqual(farmReadStart({ state: empty, leaseHeld: false, reserve: 31, atMs: 0, context: 'morning' }), { kind: 'start', places: OTF_CALLS_PER_MINUTE });
  assert.deepEqual(farmReadStart({ state: empty, leaseHeld: false, reserve: 30, atMs: 0, context: 'page' }), { kind: 'start', places: 30 });
});

test('le code d’un 429 d’OTF : l’un des quatre documentés, lu dans `error`, `code` ou `error.code`, rien d’autre n’est deviné (F349, F382)', () => {
  assert.equal(otfRateLimitCode({ error: 'rate_limit_day' }), 'rate_limit_day');
  assert.equal(otfRateLimitCode({ code: 'rate_limit_minute' }), 'rate_limit_minute');
  assert.equal(otfRateLimitCode({ error: { code: 'rate_limit_authentication', message: 'Trop d’échecs' } }), 'rate_limit_authentication');
  assert.equal(otfRateLimitCode({ error: 'rate_limit_second' }), 'rate_limit_second');
  assert.equal(otfRateLimitCode({ error: 'rate_limit_week' }), null);
  assert.equal(otfRateLimitCode('rate_limit_day'), null);
  assert.equal(otfRateLimitCode(null), null);
  assert.equal(otfRateLimitCode(['rate_limit_day']), null);
});

test('l’en-tête `Retry-After` : des secondes ou une date HTTP ; absent ou illisible, rien (F361)', () => {
  const atMs = Date.parse('2026-11-18T22:00:00Z');
  assert.equal(retryAfterMilliseconds('30', atMs), 30_000);
  assert.equal(retryAfterMilliseconds(' 2 ', atMs), 2_000);
  assert.equal(retryAfterMilliseconds('Wed, 18 Nov 2026 22:05:00 GMT', atMs), 300_000);
  assert.equal(retryAfterMilliseconds('Wed, 18 Nov 2026 21:00:00 GMT', atMs), 0, 'une date passée ne fait pas attendre');
  assert.equal(retryAfterMilliseconds(null, atMs), null);
  assert.equal(retryAfterMilliseconds('bientôt', atMs), null);
  assert.equal(retryAfterMilliseconds('-5', atMs), null);
});

test('la limite du jour arrête la ferme jusqu’à `Retry-After`, sinon jusqu’à minuit à Paris, changement d’heure compris (F363)', () => {
  const winterEvening = Date.parse('2026-11-18T22:30:00Z'); // 23 h 30 à Paris
  assert.deepEqual(pauseAfterRateLimit({ code: 'rate_limit_day', retryAfterMs: null, atMs: winterEvening }), {
    scope: 'farm', reason: 'day-limit', untilMs: Date.parse('2026-11-18T23:00:00Z'),
  });
  const summerEvening = Date.parse('2026-07-01T21:30:00Z'); // 23 h 30 à Paris, heure d'été
  assert.equal(pauseAfterRateLimit({ code: 'rate_limit_day', retryAfterMs: null, atMs: summerEvening }).untilMs, Date.parse('2026-07-01T22:00:00Z'));
  const springNight = Date.parse('2026-03-28T23:30:00Z'); // 0 h 30 le 29 mars, nuit du passage à l'heure d'été
  assert.equal(pauseAfterRateLimit({ code: 'rate_limit_day', retryAfterMs: null, atMs: springNight }).untilMs, Date.parse('2026-03-29T22:00:00Z'));
  assert.deepEqual(pauseAfterRateLimit({ code: 'rate_limit_day', retryAfterMs: 7_200_000, atMs: winterEvening }), {
    scope: 'farm', reason: 'day-limit', untilMs: winterEvening + 7_200_000,
  });
});

test('les autres limites : la ferme s’arrête la durée de `Retry-After`, une seconde au moins ; le blocage d’adresse arrête tout le module (F359, F361, F382)', () => {
  const atMs = 5_000_000;
  assert.deepEqual(pauseAfterRateLimit({ code: 'rate_limit_second', retryAfterMs: 0, atMs }), { scope: 'farm', reason: 'rate-limit', untilMs: atMs + 1_000 });
  assert.deepEqual(pauseAfterRateLimit({ code: 'rate_limit_minute', retryAfterMs: 42_000, atMs }), { scope: 'farm', reason: 'rate-limit', untilMs: atMs + 42_000 });
  assert.deepEqual(pauseAfterRateLimit({ code: null, retryAfterMs: null, atMs }), { scope: 'farm', reason: 'rate-limit', untilMs: atMs + 1_000 });
  assert.deepEqual(pauseAfterRateLimit({ code: 'rate_limit_authentication', retryAfterMs: null, atMs }), {
    scope: 'module', reason: 'authentication-limit', untilMs: atMs + 900_000,
  });
  assert.deepEqual(pauseAfterRateLimit({ code: 'rate_limit_authentication', retryAfterMs: 120_000, atMs }), {
    scope: 'module', reason: 'authentication-limit', untilMs: atMs + 120_000,
  });
});

test('une lecture reportée est une erreur d’OTF : une limite porte le statut 429, une lecture en cours ou trop longue n’en porte pas (F386)', () => {
  const minute = new OtfReadDeferredError('minute', 123);
  assert.ok(minute instanceof OtfApiError);
  assert.equal(minute.status, 429);
  assert.equal(minute.retryAtMs, 123);
  assert.match(minute.message, /30 appels par minute/);
  assert.equal(new OtfReadDeferredError('day-limit', null).status, 429);
  assert.equal(new OtfReadDeferredError('authentication-brake', null).status, 429);
  assert.equal(new OtfReadDeferredError('read-in-progress', null).status, undefined);
  assert.equal(new OtfReadDeferredError('too-many-calls', null).status, undefined);
});

test('le jour du compte est celui de Paris ; trente jours sont gardés (D-004, F363)', () => {
  assert.equal(parisDayOf(Date.parse('2026-11-18T22:59:59Z')), '2026-11-18');
  assert.equal(parisDayOf(Date.parse('2026-11-18T23:00:00Z')), '2026-11-19');
  assert.equal(parisDayOf(Date.parse('2026-07-01T22:00:00Z')), '2026-07-02');
  assert.equal(oldestKeptCountDay(Date.parse('2026-11-18T23:30:00Z')), '2026-10-20');
});
