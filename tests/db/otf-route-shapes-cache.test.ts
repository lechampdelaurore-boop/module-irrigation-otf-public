import assert from 'node:assert/strict';
import test, { afterEach, beforeEach, mock } from 'node:test';
import { saveDeploymentFarm } from '../../db/otf-deployment-farm-repository';
import { readCachedSnapshot } from '../../db/snapshot-cache';
import { resetOtfRatePacer } from '../../lib/adapters/otf/read-client';
import type { OtfReadRoute } from '../../lib/domain/otf/api-contract';
import { farmSpaceKey } from '../../lib/domain/farm-space';
import { IrrigationDataUnavailableError, SHAPE_CHANGED_MESSAGE } from '../../lib/domain/snapshot-policy';
import { getIrrigationSnapshot } from '../../lib/services/irrigation-service';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { otfPayload, typicalOtfResponses } from '../support/otf-typical-responses';

/**
 * Un écart de forme ne range rien (4.3, PR 5 ; docs/tranche-4-contract.md,
 * T4-15 : « une réponse invalide ne remplace jamais le cache », F370 point 5,
 * F394) : la lecture d'un espace de bout en bout, Ouvre ta ferme simulé par
 * ses réponses types, sur une base migrée.
 */

const OTF_SETTINGS = ['OTF_DATA_SOURCE', 'OTF_API_BASE_URL', 'OTF_API_TOKEN', 'DEMO_MODE'] as const;
const SNAPSHOT_CACHE_VERSION = 'v6-plan-de-culture';
const SECRET = 'valeur-secrete-7319';

let database: TestDatabase;
let warnings: string[] = [];
const savedSettings = Object.fromEntries(OTF_SETTINGS.map((key) => [key, process.env[key]]));
const savedFetch = globalThis.fetch;

beforeEach(() => {
  database = installTestDatabase();
  resetOtfRatePacer();
  warnings = [];
  mock.method(console, 'error', (...parts: unknown[]) => { warnings.push(parts.map((part) => JSON.stringify(part)).join(' ')); });
  mock.method(console, 'warn', (line: unknown) => { warnings.push(String(line)); });
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

type Responses = Record<OtfReadRoute, unknown>;

/** Ouvre ta ferme simulé par ses réponses types ; `change` les modifie d'une lecture à l'autre. Chaque route appelée est notée. */
function otfNetwork() {
  process.env.OTF_DATA_SOURCE = 'live';
  process.env.OTF_API_BASE_URL = 'https://api.ouvretaferme.org/0.1beta';
  process.env.OTF_API_TOKEN = 'jeton-de-test-sans-valeur';
  delete process.env.DEMO_MODE;
  const network = { responses: typicalOtfResponses() as Responses, calls: [] as string[] };
  globalThis.fetch = (async (input: string | URL | Request) => {
    const path = new URL(typeof input === 'string' || input instanceof URL ? input : input.url).pathname;
    const route = `/${path.split('/').at(-1)}` as OtfReadRoute;
    network.calls.push(route);
    return Response.json(otfPayload(route, network.responses[route]));
  }) as typeof fetch;
  return network;
}

const alice17 = farmSpaceKey('alice', '17');
const cacheKey = JSON.stringify([SNAPSHOT_CACHE_VERSION, alice17, 2026]);

test('une lecture réussie, puis un champ renommé : la seconde lecture ne range rien, la première s’affiche avec le message de F370', async () => {
  const network = otfNetwork();
  await saveDeploymentFarm('17', '2026-11-18T08:00:00.000Z');

  const first = await getIrrigationSnapshot(alice17, { season: 2026, forceRefresh: true });
  assert.equal(first.source, 'live');
  const stored = await readCachedSnapshot(cacheKey);
  assert.ok(stored, 'la lecture réussie est rangée');

  network.responses['/taskList'] = (network.responses['/taskList'] as Record<string, unknown>[])
    .map(({ plannedWeek, ...task }) => ({ ...task, description: SECRET, plannedWeekIso: plannedWeek }));
  network.calls.length = 0;

  const second = await getIrrigationSnapshot(alice17, { season: 2026, forceRefresh: true });
  assert.equal(second.source, 'cache');
  assert.equal(second.warning, SHAPE_CHANGED_MESSAGE);
  assert.equal(second.lastSuccessfulReadAt, first.lastSuccessfulReadAt);
  assert.deepEqual(await readCachedSnapshot(cacheKey), stored, 'le cache reste celui de la lecture réussie');
  assert.equal(network.calls.at(-1), '/taskList');

  const shapeLines = warnings.filter((line) => line.includes('otf_route_shape_changed'));
  assert.deepEqual(shapeLines.map((line) => JSON.parse(line)), [{ event: 'otf_route_shape_changed', route: '/taskList', field: 'plannedWeek', problem: 'missing-everywhere' }]);
  for (const line of warnings) assert.ok(!line.includes(SECRET), `aucune valeur au journal : ${line}`);
});

test('sans lecture précédente, un écart de forme garde son motif : la page d’état « forme changée », rien n’est rangé (F394)', async () => {
  const network = otfNetwork();
  await saveDeploymentFarm('17', '2026-11-18T08:00:00.000Z');
  network.responses['/me'] = [{ id: 17, name: SECRET }, { id: 18, name: SECRET }];

  await assert.rejects(
    () => getIrrigationSnapshot(alice17, { season: 2026, forceRefresh: true }),
    (error) => error instanceof IrrigationDataUnavailableError && error.reason === 'shape-changed',
  );
  assert.deepEqual(network.calls, ['/me']);
  assert.equal(await readCachedSnapshot(cacheKey), null);
  for (const line of warnings) assert.ok(!line.includes(SECRET), `aucune valeur au journal : ${line}`);
});
