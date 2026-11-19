import assert from 'node:assert/strict';
import test, { afterEach, beforeEach, mock } from 'node:test';
import { claimOtfCallPlace, readOtfDailyCalls, readOtfFarmPace } from '../../db/otf-call-ledger-repository';
import { saveDeploymentFarm } from '../../db/otf-deployment-farm-repository';
import { saveCachedSnapshot } from '../../db/snapshot-cache';
import { OtfReadClient, resetOtfRatePacer } from '../../lib/adapters/otf/read-client';
import type { IrrigationSnapshot } from '../../lib/domain/domain';
import { farmSpaceKey } from '../../lib/domain/farm-space';
import { OtfReadDeferredError } from '../../lib/domain/otf/shared-call-pace';
import { DAY_LIMIT_MESSAGE } from '../../lib/domain/snapshot-policy';
import { getIrrigationSnapshot } from '../../lib/services/irrigation-service';
import { sharedPaceForLoneCalls, startFarmRead } from '../../lib/services/otf-farm-read';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';

/**
 * Une lecture complète à la fois par ferme, qui ne part que si elle peut
 * finir (4.3, PR 1 ; docs/tranche-4-contract.md, F361, F362, F370, F383 à
 * F388) : le service de lecture sur une base migrée, deux instances simulées
 * du connecteur, et la lecture d'un espace de bout en bout, Ouvre ta ferme
 * simulé.
 */

const OTF_SETTINGS = ['OTF_DATA_SOURCE', 'OTF_API_BASE_URL', 'OTF_API_TOKEN', 'DEMO_MODE'] as const;
const SNAPSHOT_CACHE_VERSION = 'v6-plan-de-culture';
const BASE_URL = 'https://api.ouvretaferme.org/0.1beta';
const SPACING_MS = 255;
const T0 = Date.parse('2026-11-18T10:00:00.000Z');

let database: TestDatabase;
const savedSettings = Object.fromEntries(OTF_SETTINGS.map((key) => [key, process.env[key]]));
const savedFetch = globalThis.fetch;

beforeEach(() => {
  database = installTestDatabase();
  resetOtfRatePacer();
  mock.method(console, 'error', () => {});
  mock.method(console, 'warn', () => {});
  mock.method(console, 'info', () => {});
});

afterEach(() => {
  mock.restoreAll();
  for (const key of OTF_SETTINGS) {
    if (savedSettings[key] === undefined) delete process.env[key];
    else process.env[key] = savedSettings[key];
  }
  globalThis.fetch = savedFetch;
  database.dispose();
});

/** Une horloge qui avance quand on l'attend : deux instances simulées la partagent, une minute se parcourt sans l'attendre. */
function virtualClock(start = T0) {
  let current = start;
  return {
    now: () => current,
    sleep: async (durationMs: number) => { current += Math.max(0, durationMs); },
  };
}

function rows(paceKey: string): { started_at_ms: number; reserved: number }[] {
  return database.sqlite
    .prepare('SELECT started_at_ms, reserved FROM otf_call_starts WHERE pace_key = ? ORDER BY started_at_ms, id')
    .all(paceKey) as { started_at_ms: number; reserved: number }[];
}

const realStarts = (paceKey: string) => rows(paceKey).filter((row) => row.reserved === 0).map((row) => row.started_at_ms);
const reservedPlaces = (paceKey: string) => rows(paceKey).filter((row) => row.reserved === 1).length;
const lonePlace = (paceKey: string, atMs: number) => claimOtfCallPlace({ paceKey, atMs, spacingMs: SPACING_MS, readId: null, fromReservation: false });
const isDeferral = (reason: string) => (error: unknown) => error instanceof OtfReadDeferredError && error.reason === reason;

/** Le plus grand nombre de départs dans une fenêtre de 61 secondes, et le plus petit écart entre deux départs. */
function paceOf(starts: readonly number[]): { busiestMinute: number; closestGapMs: number } {
  const sorted = [...starts].sort((first, second) => first - second);
  let busiestMinute = 0;
  let closestGapMs = Number.POSITIVE_INFINITY;
  sorted.forEach((startedAt, index) => {
    busiestMinute = Math.max(busiestMinute, sorted.filter((other) => other > startedAt - 61_000 && other <= startedAt).length);
    if (index > 0) closestGapMs = Math.min(closestGapMs, startedAt - sorted[index - 1]);
  });
  return { busiestMinute, closestGapMs };
}

test('deux instances simulées ne dépassent jamais 4 départs par seconde ni 30 par minute pour une ferme ; sans le compteur partagé, elles le feraient (F361, F370)', async () => {
  const clock = virtualClock();
  const sent: number[] = [];
  const instance = (memory: string, shared: boolean) => new OtfReadClient({
    baseUrl: BASE_URL,
    token: 'jeton-de-test-sans-valeur',
    farmKey: memory,
    clock,
    sharedPace: shared ? sharedPaceForLoneCalls('17') : undefined,
    fetchImpl: async () => { sent.push(clock.now()); return Response.json({ seasonFirst: 2026, seasonLast: 2026 }); },
  });

  // Témoin : chaque instance ne voit que ses propres départs.
  const [aloneA, aloneB] = [instance('témoin-a', false), instance('témoin-b', false)];
  await Promise.all([0, 1].map((side) => (async () => {
    for (let call = 0; call < 30; call += 1) await (side === 0 ? aloneA : aloneB).getConfiguration();
  })()));
  assert.ok(paceOf(sent).busiestMinute > 30, 'sans la base, les deux mémoires laissent passer plus de 30 départs dans la minute');

  sent.length = 0;
  const [first, second] = [instance('instance-a', true), instance('instance-b', true)];
  const outcomes = await Promise.allSettled(Array.from({ length: 25 }, () => [first.getConfiguration(), second.getConfiguration()]).flat());

  const starts = realStarts('17');
  assert.equal(sent.length, starts.length, 'rien n’est envoyé sans place');
  assert.equal(starts.length, 30);
  const { busiestMinute, closestGapMs } = paceOf(starts);
  assert.ok(busiestMinute <= 30, `départs dans la minute : ${busiestMinute}`);
  assert.ok(closestGapMs >= SPACING_MS, `écart le plus court : ${closestGapMs} ms`);
  const refused = outcomes.filter((outcome) => outcome.status === 'rejected');
  assert.equal(refused.length, 20);
  assert.ok(refused.every((outcome) => isDeferral('minute')(outcome.reason)), 'chaque refus est une minute pleine');
});

test('deux lectures simultanées de la même ferme n’en font qu’une : la seconde attend la fin de la première, cinq secondes au plus (F362)', async () => {
  const clock = virtualClock();
  const first = await startFarmRead('17', 'page', clock);
  const waitingSince = clock.now();
  const second = assert.rejects(startFarmRead('17', 'page', clock), isDeferral('read-in-progress'));
  await first.finish();
  await second;
  assert.ok(clock.now() - waitingSince < 5_000, 'elle repart dès que le bail est rendu');
  assert.equal(reservedPlaces('17'), 0, 'la seconde n’a rien réservé');

  // Une première lecture qui ne finit pas : la seconde renonce après cinq secondes.
  await startFarmRead('18', 'page', clock);
  const blockedSince = clock.now();
  await assert.rejects(startFarmRead('18', 'page', clock), isDeferral('read-in-progress'));
  assert.ok(clock.now() - blockedSince >= 5_000);
});

test('une lecture dont la réserve ne tient pas dans la minute n’a pas lieu et dit quand elle sera possible ; le calcul du matin, lui, attend (F362, F383)', async () => {
  const clock = virtualClock();
  for (let index = 0; index < 6; index += 1) await lonePlace('17', T0 - 10_000 + index * SPACING_MS);

  await assert.rejects(startFarmRead('17', 'page', clock), (error) =>
    isDeferral('minute')(error) && (error as OtfReadDeferredError).retryAtMs === T0 - 10_000 + 61_000);
  assert.equal(reservedPlaces('17'), 0);
  assert.equal((await readOtfFarmPace('17', clock.now())).leaseHeld, false, 'aucun bail pris');

  const morning = await startFarmRead('17', 'morning', clock);
  assert.ok(clock.now() >= T0 - 10_000 + 61_000, 'le matin attend que la place se libère');
  assert.equal(reservedPlaces('17'), 25);
  assert.equal(morning.minuteWaitLimitMs, 62_000);
  await morning.finish();
});

test('une lecture de plus de 30 appels ne se fait qu’au calcul du matin, qui part avec 30 places (F362)', async () => {
  const clock = virtualClock();
  database.sqlite.prepare("INSERT INTO otf_farm_reads (pace_key, lease_id, lease_until_ms, reserve_basis) VALUES ('17', NULL, 0, 29)").run();

  await assert.rejects(startFarmRead('17', 'page', clock), isDeferral('too-many-calls'));
  assert.equal(reservedPlaces('17'), 0);

  const morning = await startFarmRead('17', 'morning', clock);
  assert.equal(reservedPlaces('17'), 30);
  await morning.finish();
  assert.equal(reservedPlaces('17'), 0);
});

test('la fin d’une lecture garde la base de la réserve suivante : ses appels si elle est complète, un de plus si la place a manqué, sinon celle d’avant (F362)', async () => {
  const clock = virtualClock();
  const spend = async (read: Awaited<ReturnType<typeof startFarmRead>>, calls: number) => {
    for (let call = 0; call < calls; call += 1) {
      assert.equal(await read.sharedPace.claimPlace(clock.now(), SPACING_MS), true);
      await clock.sleep(SPACING_MS);
    }
  };

  const complete = await startFarmRead('17', 'page', clock);
  await spend(complete, 3);
  complete.markComplete();
  await complete.finish();
  await complete.finish();
  assert.equal((await readOtfFarmPace('17', clock.now())).reserveBasis, 3);

  // Réserve de 5 (3 + 2), toute dépensée, puis un appel de plus refusé faute de place.
  await clock.sleep(61_000);
  const grown = await startFarmRead('17', 'page', clock);
  assert.equal(reservedPlaces('17'), 5);
  await spend(grown, 5);
  await grown.finish(new OtfReadDeferredError('minute', null));
  assert.equal((await readOtfFarmPace('17', clock.now())).reserveBasis, 6);

  const failed = await startFarmRead('17', 'page', clock);
  await spend(failed, 1);
  await failed.finish(new Error('panne d’OTF'));
  const after = await readOtfFarmPace('17', clock.now());
  assert.equal(after.reserveBasis, 6, 'une lecture en échec ne change pas la réserve');
  assert.equal(after.leaseHeld, false);
  assert.equal(reservedPlaces('17'), 0);
});

// --- De bout en bout : la lecture d'un espace (lib/services/irrigation-service.ts) ---

type Answer = (path: string) => Response | undefined;

/** Ouvre ta ferme simulé : chaque route appelée est notée ; `answer` peut remplacer une réponse. */
function otfNetwork(answer?: Answer): string[] {
  process.env.OTF_DATA_SOURCE = 'live';
  process.env.OTF_API_BASE_URL = BASE_URL;
  process.env.OTF_API_TOKEN = 'jeton-de-test-sans-valeur';
  delete process.env.DEMO_MODE;
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const path = new URL(typeof input === 'string' || input instanceof URL ? input : input.url).pathname;
    calls.push(path);
    const replaced = answer?.(path);
    if (replaced) return replaced;
    if (path.endsWith('/me')) return Response.json([{ id: 17, name: 'Ferme' }]);
    if (path.endsWith('/configuration')) return Response.json({ seasonFirst: 2025, seasonLast: 2026 });
    return Response.json({ count: 0, list: [] });
  }) as typeof fetch;
  return calls;
}

const alice17 = farmSpaceKey('alice', '17');

const cachedSnapshot = (lastSuccessfulReadAt: string): IrrigationSnapshot => ({
  configuration: { seasonFirst: 2025, seasonLast: 2026 },
  structure: { id: '17', name: 'Ferme 17', legalCity: 'Rennes', legalPostcode: '35000', legalCountry: 'FR' },
  zones: [{ id: '14', name: 'Clémentière', area: 10309, seasons: [2026] }],
  plots: [],
  beds: [],
  source: 'live',
  lastSuccessfulReadAt,
});

async function farm17WithCache() {
  await saveDeploymentFarm('17', '2026-11-17T08:00:00.000Z');
  await saveCachedSnapshot(JSON.stringify([SNAPSHOT_CACHE_VERSION, alice17, 2026]), cachedSnapshot('2026-11-17T08:00:00.000Z'));
}

test('la lecture d’un espace passe par le compteur partagé : chaque appel envoyé a sa place et son compte du jour, et la réserve suivante est celle de la lecture (F361 à F363)', async () => {
  const calls = otfNetwork();
  await saveDeploymentFarm('17', '2026-11-17T08:00:00.000Z');

  const read = await getIrrigationSnapshot(alice17, { season: 2026, forceRefresh: true });
  assert.equal(read.source, 'live');
  assert.equal(realStarts('17').length, calls.length);
  assert.equal(reservedPlaces('17'), 0, 'les places inutilisées sont rendues');
  assert.deepEqual((await readOtfDailyCalls('17')).map((day) => day.calls), [calls.length]);
  const pace = await readOtfFarmPace('17', Date.now());
  assert.equal(pace.leaseHeld, false);
  assert.equal(pace.reserveBasis, calls.length);
});

test('une lecture qui ne peut pas finir n’envoie rien : le dernier instantané s’affiche avec la raison (F362, F386)', async () => {
  const calls = otfNetwork();
  await farm17WithCache();
  const now = Date.now();
  for (let index = 0; index < 6; index += 1) await lonePlace('17', now - 2_000 + index * SPACING_MS);

  const shown = await getIrrigationSnapshot(alice17, { season: 2026, forceRefresh: true });
  assert.equal(shown.source, 'cache');
  assert.match(shown.warning ?? '', /Limite de requêtes OTF atteinte/);
  assert.deepEqual(calls, []);
});

test('la limite du jour d’OTF arrête la ferme jusqu’à minuit : plus aucun appel, le dernier instantané s’affiche avec le message de F363', async () => {
  const calls = otfNetwork((path) => (path.endsWith('/bedList') ? Response.json({ error: 'rate_limit_day' }, { status: 429 }) : undefined));
  await farm17WithCache();

  const shown = await getIrrigationSnapshot(alice17, { season: 2026, forceRefresh: true });
  assert.equal(shown.warning, DAY_LIMIT_MESSAGE);
  assert.equal(calls.at(-1), '/0.1beta/bedList', 'la lecture s’arrête au 429');
  const sentBefore = calls.length;

  const again = await getIrrigationSnapshot(alice17, { season: 2026, forceRefresh: true });
  assert.equal(again.warning, DAY_LIMIT_MESSAGE);
  assert.equal(calls.length, sentBefore, 'rien ne part avant minuit');
  const [pause] = (await readOtfFarmPace('17', Date.now())).state.pauses;
  assert.equal(pause.reason, 'day-limit');
  assert.ok(pause.untilMs > Date.now());
});

test('une limite d’OTF à la minute arrête la ferme la durée de `Retry-After`, pour toutes les instances ; le dernier instantané s’affiche (F361, F386)', async () => {
  const calls = otfNetwork((path) => (path.endsWith('/actionList')
    ? Response.json({ error: 'rate_limit_minute' }, { status: 429, headers: { 'Retry-After': '30' } })
    : undefined));
  await farm17WithCache();

  const before = Date.now();
  const shown = await getIrrigationSnapshot(alice17, { season: 2026, forceRefresh: true });
  assert.equal(shown.source, 'cache');
  assert.match(shown.warning ?? '', /^Limite de requêtes OTF atteinte/);
  assert.equal(calls.at(-1), '/0.1beta/actionList');
  const [pause] = (await readOtfFarmPace('17', Date.now())).state.pauses;
  assert.equal(pause.reason, 'rate-limit');
  assert.ok(pause.untilMs >= before + 30_000 && pause.untilMs <= Date.now() + 30_000);
});

test('le frein des refus d’accès : au dixième en quinze minutes, plus aucun appel ne part, pour aucune ferme (F359)', async () => {
  const clock = virtualClock();
  let sent = 0;
  const client = (farm: string) => new OtfReadClient({
    baseUrl: BASE_URL,
    token: 'jeton-de-test-sans-valeur',
    farmKey: farm,
    clock,
    sharedPace: sharedPaceForLoneCalls(farm),
    fetchImpl: async () => { sent += 1; return new Response(null, { status: 401 }); },
  });

  for (let index = 0; index < 10; index += 1) {
    await assert.rejects(client('17').getConfiguration(), (error) => error instanceof Error && !(error instanceof OtfReadDeferredError));
  }
  assert.equal(sent, 10);
  await assert.rejects(client('17').getConfiguration(), isDeferral('authentication-brake'));
  await assert.rejects(client('18').getConfiguration(), isDeferral('authentication-brake'));
  assert.equal(sent, 10, 'le frein n’envoie rien');
});

test('deux pages ouvertes en même temps sur un espace : une seule lecture part, la seconde prend ce que la première a rangé (F362, F388)', async () => {
  const calls = otfNetwork();
  await saveDeploymentFarm('17', '2026-11-17T08:00:00.000Z');

  const [first, second] = await Promise.all([
    getIrrigationSnapshot(alice17, { season: 2026, forceRefresh: true }),
    getIrrigationSnapshot(alice17, { season: 2026, forceRefresh: true }),
  ]);
  assert.equal(calls.filter((path) => path.endsWith('/me')).length, 1, 'une seule lecture');
  assert.deepEqual([first.source, second.source].sort(), ['cache', 'live']);
  assert.equal(first.lastSuccessfulReadAt, second.lastSuccessfulReadAt);
  assert.equal(second.warning ?? first.warning, undefined, 'aucun avertissement : c’est la lecture du moment');
});
