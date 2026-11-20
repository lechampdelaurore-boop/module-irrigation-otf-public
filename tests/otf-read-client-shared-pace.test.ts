import assert from 'node:assert/strict';
import test, { afterEach, beforeEach, mock } from 'node:test';
import { OtfReadClient, otfRatePacerCount, resetOtfRatePacer, type OtfSharedCallPace } from '../lib/adapters/otf/read-client.ts';
import { OtfApiError } from '../lib/domain/otf/api-contract.ts';
import { OtfReadDeferredError, type OtfCallPause, type PlaceRefusal } from '../lib/domain/otf/shared-call-pace.ts';

/**
 * Le connecteur et le compteur partagé (4.3, PR 1 ; docs/tranche-4-contract.md,
 * F359, F361, F363, F382, F385) : un port simulé tient lieu de base. Rien ne
 * part sans place ; une limite d'OTF devient une pause pour toutes les
 * instances ; un refus d'accès compte pour le frein ; les régulateurs en
 * mémoire des fermes sans départ récent sont oubliés (point D5).
 */

const baseUrl = 'https://api.ouvretaferme.org/0.1beta';
let logs: string[] = [];

beforeEach(() => {
  resetOtfRatePacer();
  logs = [];
  mock.method(console, 'warn', (line: string) => { logs.push(line); });
  mock.method(console, 'info', (line: string) => { logs.push(line); });
});

afterEach(() => mock.restoreAll());

function fakeClock(start = 1_000_000) {
  let current = start;
  return {
    now: () => current,
    sleep: async (durationMs: number) => { current += Math.max(0, durationMs); },
    advance: (durationMs: number) => { current += durationMs; },
  };
}

/** Un compteur partagé simulé : il accorde ou refuse les places comme on le lui dit, et note ce qu'on lui confie. */
function fakeSharedPace(overrides: Partial<OtfSharedCallPace> = {}) {
  const claims: number[] = [];
  const holds: OtfCallPause[] = [];
  const failures: number[] = [];
  const pace: OtfSharedCallPace = {
    claimPlace: async (atMs) => { claims.push(atMs); return true; },
    placeRefusal: async (atMs): Promise<PlaceRefusal> => ({ kind: 'retry-at', atMs }),
    holdCalls: async (pause) => { holds.push(pause); },
    recordAuthenticationFailure: async (atMs) => { failures.push(atMs); return null; },
    ...overrides,
  };
  return { pace, claims, holds, failures };
}

const events = () => logs.map((line) => JSON.parse(line) as { event: string; [key: string]: unknown });

test('une place refusée par la base n’envoie rien : l’appel attend l’heure dite puis redemande sa place (F361)', async () => {
  const clock = fakeClock();
  let granted = false;
  const shared = fakeSharedPace({
    claimPlace: async () => { const answer = granted; granted = true; return answer; },
    placeRefusal: async (atMs) => ({ kind: 'retry-at', atMs: atMs + 200 }),
  });
  const sent: number[] = [];
  const client = new OtfReadClient({ baseUrl, token: 'jeton', farmKey: 'ferme-a', clock, sharedPace: shared.pace, fetchImpl: async () => { sent.push(clock.now()); return Response.json({}); } });

  const askedAt = clock.now();
  await client.getConfiguration();
  assert.deepEqual(sent, [askedAt + 200]);
});

test('une pause ou une minute pleine dans la base arrête l’appel, avec la raison et l’heure ; rien n’est envoyé (F361, F362)', async () => {
  const clock = fakeClock();
  let sent = 0;
  const stop = (reason: 'day-limit' | 'minute') => fakeSharedPace({
    claimPlace: async () => false,
    placeRefusal: async () => ({ kind: 'stop', reason, retryAtMs: 4_242 }),
  });
  for (const reason of ['day-limit', 'minute'] as const) {
    const client = new OtfReadClient({ baseUrl, token: 'jeton', farmKey: 'ferme-a', clock, sharedPace: stop(reason).pace, fetchImpl: async () => { sent += 1; return Response.json({}); } });
    await assert.rejects(client.getConfiguration(), (error) =>
      error instanceof OtfReadDeferredError && error.reason === reason && error.retryAtMs === 4_242 && error.status === 429);
  }
  assert.equal(sent, 0);
});

test('vingt refus de suite sans raison visible : l’appel n’est pas envoyé, et le journal le dit (F385)', async () => {
  const clock = fakeClock();
  let sent = 0;
  const shared = fakeSharedPace({ claimPlace: async () => false });
  const client = new OtfReadClient({ baseUrl, token: 'jeton', farmKey: 'ferme-a', clock, sharedPace: shared.pace, fetchImpl: async () => { sent += 1; return Response.json({}); } });

  await assert.rejects(client.getConfiguration(), (error) => error instanceof OtfReadDeferredError && error.reason === 'minute');
  assert.equal(sent, 0);
  assert.deepEqual(events().map((entry) => entry.event), ['otf_shared_place_unavailable']);
});

test('la mémoire de l’instance refuse avant la base : trente départs dans la minute, la place trop lointaine, rien n’est demandé ni envoyé (F334, F384)', async () => {
  const clock = fakeClock();
  const shared = fakeSharedPace();
  const client = new OtfReadClient({ baseUrl, token: 'jeton', farmKey: 'ferme-a', clock, sharedPace: shared.pace, fetchImpl: async () => Response.json({}) });
  for (let call = 0; call < 30; call += 1) await client.getConfiguration();
  const firstStart = shared.claims[0];

  await assert.rejects(client.getConfiguration(), (error) =>
    error instanceof OtfReadDeferredError && error.reason === 'minute' && error.retryAtMs === firstStart + 61_000);
  assert.equal(shared.claims.length, 30);
});

test('le calcul du matin attend qu’une place de la minute se libère, au lieu de renoncer après cinq secondes (F362, F383)', async () => {
  const clock = fakeClock();
  const sent: number[] = [];
  const client = new OtfReadClient({
    baseUrl, token: 'jeton', farmKey: 'ferme-a', clock, minuteWaitLimitMs: 62_000,
    sharedPace: fakeSharedPace().pace,
    fetchImpl: async () => { sent.push(clock.now()); return Response.json({}); },
  });
  for (let call = 0; call < 31; call += 1) await client.getConfiguration();
  assert.equal(sent.length, 31);
  assert.equal(sent[30], sent[0] + 61_000);
});

test('un 429 d’OTF devient une pause pour toutes les instances : la limite du jour pour la ferme, le blocage d’adresse pour le module (F361, F363, F382)', async () => {
  const clock = fakeClock(Date.parse('2026-11-18T20:00:00Z'));
  const shared = fakeSharedPace();
  const answers = [
    Response.json({ error: 'rate_limit_day' }, { status: 429 }),
    Response.json({ error: 'rate_limit_authentication' }, { status: 429, headers: { 'Retry-After': '120' } }),
  ];
  const client = new OtfReadClient({ baseUrl, token: 'jeton', farmKey: 'ferme-a', clock, sharedPace: shared.pace, fetchImpl: async () => answers.shift() ?? Response.json({}) });

  await assert.rejects(client.getConfiguration(), (error) =>
    error instanceof OtfReadDeferredError && error.reason === 'day-limit' && error.retryAtMs === Date.parse('2026-11-18T23:00:00Z'));
  const second = clock.now();
  await assert.rejects(client.getConfiguration(), (error) => error instanceof OtfReadDeferredError && error.reason === 'authentication-limit');
  assert.deepEqual(shared.holds.map((pause) => [pause.scope, pause.reason]), [['farm', 'day-limit'], ['module', 'authentication-limit']]);
  assert.ok(shared.holds[1].untilMs >= second + 120_000);
});

test('une base indisponible au moment d’un 429 : la limite remonte quand même, et le journal dit que la pause n’est pas notée (F361)', async () => {
  const clock = fakeClock();
  const shared = fakeSharedPace({ holdCalls: async () => { throw new Error('D1 indisponible'); } });
  const client = new OtfReadClient({ baseUrl, token: 'jeton', farmKey: 'ferme-a', clock, sharedPace: shared.pace, fetchImpl: async () => new Response(null, { status: 429 }) });

  await assert.rejects(client.getConfiguration(), (error) => error instanceof OtfReadDeferredError && error.reason === 'rate-limit');
  assert.deepEqual(events().map((entry) => [entry.event, entry.reason]), [['otf_call_failed', undefined], ['otf_pause_not_recorded', 'rate-limit']]);
});

test('chaque refus d’accès compte pour le frein ; quand il serre, le journal dit jusqu’à quand, sans rien d’autre que l’appel manqué (F359, F614)', async () => {
  const clock = fakeClock(Date.parse('2026-11-18T20:00:00Z'));
  const brake: OtfCallPause = { scope: 'module', untilMs: Date.parse('2026-11-18T20:15:00Z'), reason: 'authentication-brake' };
  const shared = fakeSharedPace({ recordAuthenticationFailure: async () => brake });
  const client = new OtfReadClient({ baseUrl, token: 'jeton-secret-de-test', farmKey: 'ferme-a', clock, sharedPace: shared.pace, fetchImpl: async () => new Response(null, { status: 401 }) });

  await assert.rejects(client.getConfiguration(), (error) => error instanceof OtfApiError && error.status === 401);
  assert.deepEqual(events(), [
    { event: 'otf_call_failed', route: '/configuration', attempt: 1, outcome: 'unauthorized', status: 401, durationMs: 0 },
    { event: 'otf_authentication_brake', pausedUntil: '2026-11-18T20:15:00.000Z' },
  ]);
  assert.ok(!logs.join('').includes('jeton-secret-de-test'), 'aucun jeton au journal');
});

test('un refus d’accès que la base ne peut pas noter n’arrête rien : l’erreur d’OTF remonte, le journal le dit (F359)', async () => {
  const clock = fakeClock();
  const shared = fakeSharedPace({ recordAuthenticationFailure: async () => { throw new Error('D1 indisponible'); } });
  const client = new OtfReadClient({ baseUrl, token: 'jeton', farmKey: 'ferme-a', clock, sharedPace: shared.pace, fetchImpl: async () => new Response(null, { status: 401 }) });

  await assert.rejects(client.getConfiguration(), (error) => error instanceof OtfApiError && error.status === 401);
  assert.deepEqual(events().map((entry) => entry.event), ['otf_call_failed', 'otf_authentication_failure_not_recorded']);
});

test('les régulateurs en mémoire des fermes sans départ depuis plus de 61 secondes sont oubliés ; celui d’une ferme partie dans la minute est gardé (point D5, F361)', async () => {
  const clock = fakeClock();
  const clientOf = (farmKey: string) => new OtfReadClient({ baseUrl, token: 'jeton', farmKey, clock, fetchImpl: async () => Response.json({}) });

  await clientOf('ferme-a').getConfiguration();
  await clientOf('ferme-b').getConfiguration();
  assert.equal(otfRatePacerCount(), 2);

  clock.advance(61_001);
  await clientOf('ferme-c').getConfiguration();
  assert.equal(otfRatePacerCount(), 1, 'les fermes A et B sont oubliées');

  // La ferme C est partie il y a trente secondes : sa minute compte encore, son régulateur reste.
  clock.advance(30_000);
  await clientOf('ferme-d').getConfiguration();
  assert.equal(otfRatePacerCount(), 2);
});
