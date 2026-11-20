import assert from 'node:assert/strict';
import test, { afterEach, beforeEach, mock } from 'node:test';
import { OtfReadClient, resetOtfRatePacer, type OtfSharedCallPace } from '../lib/adapters/otf/read-client.ts';
import { OtfApiError } from '../lib/domain/otf/api-contract.ts';
import {
  OTF_CALL_OUTCOMES,
  otfErrorRate,
  outcomeHourStartMs,
  outcomeOfSendFailure,
  outcomeOfStatus,
  type OtfCallOutcome,
} from '../lib/domain/otf/call-outcome.ts';
import { OtfReadDeferredError } from '../lib/domain/otf/shared-call-pace.ts';

/**
 * Le compte des appels à Ouvre ta ferme (4.5, PR 2 ; docs/tranche-4-contract.md,
 * F564, et 10 bis.13, F614) : chaque essai envoyé compte une fois, par le
 * statut de sa réponse ou par l'envoi resté sans réponse ; un échec se
 * journalise sous le nom stable `otf_call_failed`, avec ses seuls champs
 * listés ; un compte impossible n'arrête pas la lecture.
 */

const baseUrl = 'https://api.ouvretaferme.org/0.1beta';
const TOKEN = 'jeton-du-compte-des-appels';
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
  };
}

/** Un compteur partagé qui accorde chaque place et note les résultats qu'on lui confie. */
function countingPace(recordOutcome?: OtfSharedCallPace['recordOutcome']) {
  const outcomes: OtfCallOutcome[] = [];
  const pace: OtfSharedCallPace = {
    claimPlace: async () => true,
    placeRefusal: async (atMs) => ({ kind: 'retry-at', atMs }),
    holdCalls: async () => {},
    recordAuthenticationFailure: async () => null,
    recordOutcome: recordOutcome ?? (async (outcome) => { outcomes.push(outcome); }),
  };
  return { pace, outcomes };
}

/** Un client dont chaque envoi joue la réponse suivante : une réponse, ou une erreur levée par l'envoi. */
function clientAnswering(answers: (Response | Error)[], pace: OtfSharedCallPace, clock = fakeClock()) {
  let sent = 0;
  const client = new OtfReadClient({
    baseUrl,
    token: TOKEN,
    farmKey: 'ferme-a',
    clock,
    sharedPace: pace,
    fetchImpl: async () => {
      sent += 1;
      const answer = answers.shift() ?? Response.json({});
      if (answer instanceof Error) throw answer;
      return answer;
    },
  });
  return { client, sent: () => sent };
}

const events = () => logs.map((line) => JSON.parse(line) as Record<string, unknown>);

test('le résultat d’un appel se lit à son statut, ou à l’envoi resté sans réponse', () => {
  assert.deepEqual(
    [200, 204, 401, 403, 404, 400, 429, 500, 503].map(outcomeOfStatus),
    ['ok', 'ok', 'unauthorized', 'forbidden', 'refused', 'refused', 'rate-limited', 'server', 'server'],
  );
  assert.equal(outcomeOfSendFailure(new DOMException('coupé', 'AbortError')), 'timeout');
  assert.equal(outcomeOfSendFailure(new DOMException('trop long', 'TimeoutError')), 'timeout');
  assert.equal(outcomeOfSendFailure(new TypeError('fetch failed')), 'network');
  assert.equal(outcomeOfSendFailure('pas une erreur'), 'network');
  // Les heures pleines : 20 novembre 2026, 9 h 59 et 10 h 00 à Paris, deux heures différentes.
  assert.equal(outcomeHourStartMs(Date.parse('2026-11-20T08:59:59.999Z')), Date.parse('2026-11-20T08:00:00.000Z'));
  assert.equal(outcomeHourStartMs(Date.parse('2026-11-20T09:00:00.000Z')), Date.parse('2026-11-20T09:00:00.000Z'));
});

test('le taux d’erreurs compte chaque résultat, et dit les erreurs en mots, la plus fréquente d’abord', () => {
  assert.deepEqual(otfErrorRate({}), { calls: 0, errors: 0, detail: '' });
  assert.deepEqual(otfErrorRate({ ok: 12 }), { calls: 12, errors: 0, detail: '' });
  assert.deepEqual(otfErrorRate({ ok: 7, timeout: 2, 'rate-limited': 1 }), {
    calls: 10,
    errors: 3,
    detail: '2 délais dépassés, 1 limite atteinte (429)',
  });
  const everyError = Object.fromEntries(OTF_CALL_OUTCOMES.map((outcome) => [outcome, 1]));
  assert.deepEqual(otfErrorRate(everyError).detail.split(', '), [
    '1 accès refusé (401)',
    '1 lecture interdite (403)',
    '1 limite atteinte (429)',
    '1 erreur d’OTF (5xx)',
    '1 autre refus d’OTF',
    '1 délai dépassé',
    '1 erreur réseau',
  ]);
});

test('un 5xx retenté puis réussi fait une erreur et une réussite ; le journal dit l’échec sous un nom stable, sans adresse ni jeton', async () => {
  const counting = countingPace();
  const clock = fakeClock();
  const { client } = clientAnswering([new Response(null, { status: 503 }), Response.json({ seasonFirst: 2026 })], counting.pace, clock);

  await client.getConfiguration();
  assert.deepEqual(counting.outcomes, ['server', 'ok']);
  assert.deepEqual(events(), [{ event: 'otf_call_failed', route: '/configuration', attempt: 1, outcome: 'server', status: 503, durationMs: 0 }]);
  assert.ok(!logs.join('').includes(TOKEN), 'aucun jeton au journal');
  assert.ok(!logs.join('').includes('api.ouvretaferme.org'), 'aucune adresse au journal');
});

test('chaque refus d’OTF compte une fois, sans nouvel essai : 401, 403, autre refus, et la limite (429)', async () => {
  const cases: { status: number; outcome: OtfCallOutcome }[] = [
    { status: 401, outcome: 'unauthorized' },
    { status: 403, outcome: 'forbidden' },
    { status: 404, outcome: 'refused' },
    { status: 429, outcome: 'rate-limited' },
  ];
  for (const { status, outcome } of cases) {
    resetOtfRatePacer();
    logs = [];
    const counting = countingPace();
    const { client, sent } = clientAnswering([new Response(null, { status })], counting.pace);
    await assert.rejects(client.getConfiguration(), (error) =>
      status === 429 ? error instanceof OtfReadDeferredError : error instanceof OtfApiError && error.status === status);
    assert.equal(sent(), 1, `un seul envoi pour ${status}`);
    assert.deepEqual(counting.outcomes, [outcome], `statut ${status}`);
    const failed = events().filter((entry) => entry.event === 'otf_call_failed');
    assert.deepEqual(failed.map((entry) => [entry.outcome, entry.status]), [[outcome, status]]);
  }
});

test('un envoi sans réponse compte selon sa cause : délai dépassé, ou réseau ; le journal n’a pas de statut', async () => {
  const counting = countingPace();
  const abort = new DOMException('The operation was aborted.', 'AbortError');
  const { client } = clientAnswering([abort, new TypeError('fetch failed'), Response.json({})], counting.pace);

  await client.getConfiguration();
  assert.deepEqual(counting.outcomes, ['timeout', 'network', 'ok']);
  const failed = events().filter((entry) => entry.event === 'otf_call_failed');
  assert.deepEqual(failed.map((entry) => [entry.attempt, entry.outcome, 'status' in entry]), [[1, 'timeout', false], [2, 'network', false]]);
});

test('une réponse reçue dont le corps se lit mal n’est pas recomptée comme une erreur réseau', async () => {
  const counting = countingPace();
  const unreadable = () => new Response('pas du JSON', { status: 200, headers: { 'Content-Type': 'application/json' } });
  const { client } = clientAnswering([unreadable(), unreadable(), unreadable()], counting.pace);

  await assert.rejects(client.getConfiguration(), OtfApiError);
  assert.deepEqual(counting.outcomes, ['ok', 'ok', 'ok'], 'trois réponses reçues, trois statuts 200');
  assert.deepEqual(events().filter((entry) => entry.event === 'otf_call_failed'), []);
});

test('un appel que le compteur partagé n’a pas laissé partir ne compte pas : rien n’est parti vers OTF', async () => {
  const outcomes: OtfCallOutcome[] = [];
  const pace: OtfSharedCallPace = {
    claimPlace: async () => false,
    placeRefusal: async () => ({ kind: 'stop', reason: 'day-limit', retryAtMs: 4_242 }),
    holdCalls: async () => {},
    recordAuthenticationFailure: async () => null,
    recordOutcome: async (outcome) => { outcomes.push(outcome); },
  };
  const { client, sent } = clientAnswering([], pace);

  await assert.rejects(client.getConfiguration(), OtfReadDeferredError);
  assert.equal(sent(), 0);
  assert.deepEqual(outcomes, []);
});

test('un compte que la base ne peut pas garder n’arrête pas la lecture : le journal le dit, sans le message de la base', async () => {
  const counting = countingPace(async () => { throw new Error('D1 indisponible : SQLITE_BUSY sur otf_call_outcomes'); });
  const { client } = clientAnswering([Response.json({ seasonFirst: 2026 })], counting.pace);

  assert.deepEqual(await client.getConfiguration(), { seasonFirst: 2026 });
  assert.deepEqual(events(), [{ event: 'otf_call_outcome_not_recorded', outcome: 'ok', errorClass: 'Error' }]);
});
