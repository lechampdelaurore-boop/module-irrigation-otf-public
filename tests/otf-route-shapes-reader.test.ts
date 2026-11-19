import assert from 'node:assert/strict';
import test, { afterEach, beforeEach, mock } from 'node:test';
import { OtfReadClient, resetOtfRatePacer } from '../lib/adapters/otf/read-client.ts';
import { readCompleteOtfSnapshot, readOtfSeasonSnapshot } from '../lib/adapters/otf/snapshot-reader.ts';
import { OtfShapeError, type OtfReadRoute } from '../lib/domain/otf/api-contract.ts';
import { otfPayload, typicalOtfResponses } from './support/otf-typical-responses.ts';

/**
 * La vérification de forme dans la lecture (4.3, PR 5 ; docs/tranche-4-contract.md,
 * F370 point 5, F391, F392, F394) : un écart arrête la lecture avant l'appel
 * suivant, et le journal ne nomme que la route, le champ et le problème.
 */

const SECRET = 'valeur-secrete-7319';
const TOKEN = 'jeton-semé-4471';

let warnings: string[] = [];

beforeEach(() => {
  resetOtfRatePacer();
  warnings = [];
  mock.method(console, 'warn', (line: unknown) => { warnings.push(String(line)); });
  mock.method(console, 'info', () => {});
});

afterEach(() => mock.restoreAll());

type Responses = Record<OtfReadRoute, unknown>;

/** Ouvre ta ferme simulé, qui répond les réponses types, ou celles que le test change ; chaque route appelée est notée. */
function otfAnswering(change: (responses: Responses) => void = () => {}) {
  const responses = typicalOtfResponses();
  change(responses);
  const calls: string[] = [];
  const client = new OtfReadClient({
    baseUrl: 'https://api.ouvretaferme.org/0.1beta',
    token: TOKEN,
    fetchImpl: async (input) => {
      const route = `/${new URL(input).pathname.split('/').at(-1)}` as OtfReadRoute;
      calls.push(route);
      return Response.json(otfPayload(route, responses[route]));
    },
  });
  return { client, calls };
}

function shapeLogs() {
  return warnings.filter((line) => line.includes('otf_route_shape_changed')).map((line) => JSON.parse(line) as Record<string, unknown>);
}

function assertNothingSecretLogged() {
  for (const line of warnings) {
    assert.ok(!line.includes(SECRET), `aucune valeur au journal : ${line}`);
    assert.ok(!line.includes(TOKEN), `aucun jeton au journal : ${line}`);
  }
}

test('les réponses types se lisent de bout en bout, sans écart ni journal d’écart (F395)', async () => {
  const { client, calls } = otfAnswering();
  const snapshot = await readOtfSeasonSnapshot(client, 2026, new Date('2026-11-19T06:00:00.000Z'), '17');
  assert.equal(calls.length, 10);
  assert.equal(snapshot.beds.length, 2);
  assert.equal(snapshot.cropPlan?.implantationTasks.length, 3);
  assert.deepEqual(shapeLogs(), []);
});

test('un champ renommé sur `/bedList` arrête la lecture avant `/actionList` : l’écart et son journal nomment la route et le champ, jamais une valeur (F391, F393)', async () => {
  const { client, calls } = otfAnswering((responses) => {
    responses['/bedList'] = (responses['/bedList'] as Record<string, unknown>[]).map(({ alleyWidth, ...bed }) => ({ ...bed, name: SECRET, passePied: alleyWidth }));
  });
  await assert.rejects(
    () => readOtfSeasonSnapshot(client, 2026, new Date(), '17'),
    (error) => error instanceof OtfShapeError && error.route === '/bedList' && error.field === 'alleyWidth' && error.problem === 'missing-everywhere',
  );
  assert.deepEqual(calls, ['/me', '/configuration', '/zoneList', '/plotList', '/bedList'], 'aucun appel après la route en écart');
  assert.deepEqual(shapeLogs(), [{ event: 'otf_route_shape_changed', route: '/bedList', field: 'alleyWidth', problem: 'missing-everywhere' }]);
  assertNothingSecretLogged();
});

test('une page sans liste est un écart de sa route : la lecture s’arrête là (F391)', async () => {
  const { client, calls } = otfAnswering((responses) => {
    responses['/taskList'] = { count: 1, rows: [{ id: 1, name: SECRET }] };
  });
  await assert.rejects(
    () => readOtfSeasonSnapshot(client, 2026, new Date(), '17'),
    (error) => error instanceof OtfShapeError && error.route === '/taskList' && error.field === 'list' && error.problem === 'not-list',
  );
  assert.equal(calls.at(-1), '/taskList');
  assert.deepEqual(shapeLogs(), [{ event: 'otf_route_shape_changed', route: '/taskList', field: 'list', problem: 'not-list' }]);
  assertNothingSecretLogged();
});

test('`GET /me` à plusieurs structures arrête la lecture après `/me`, qu’une ferme soit attendue ou non (point D2, F392)', async () => {
  for (const expectedFarmId of ['17', undefined]) {
    warnings = [];
    const { client, calls } = otfAnswering((responses) => {
      responses['/me'] = [{ id: 17, name: SECRET }, { id: 18, name: SECRET }];
    });
    await assert.rejects(
      () => readOtfSeasonSnapshot(client, 2026, new Date(), expectedFarmId),
      (error) => error instanceof OtfShapeError && error.route === '/me' && error.field === 'structure' && error.problem === 'several-structures',
    );
    assert.deepEqual(calls, ['/me']);
    assert.deepEqual(shapeLogs(), [{ event: 'otf_route_shape_changed', route: '/me', field: 'structure', problem: 'several-structures' }]);
    assertNothingSecretLogged();
  }
});

test('la lecture de toutes les saisons vérifie aussi `/me` et chaque liste (F391, F392)', async () => {
  const { client, calls } = otfAnswering((responses) => {
    responses['/me'] = { count: 2, list: [{ id: 17 }, { id: 18 }] };
  });
  await assert.rejects(() => readCompleteOtfSnapshot(client), (error) => error instanceof OtfShapeError && error.route === '/me');
  assert.deepEqual(calls, ['/configuration', '/me']);

  const plots = otfAnswering((responses) => {
    responses['/plotList'] = [{ id: 68, name: SECRET }];
  });
  await assert.rejects(() => readCompleteOtfSnapshot(plots.client), (error) => error instanceof OtfShapeError && error.route === '/plotList' && error.field === 'zone');
  assert.equal(plots.calls.at(-1), '/plotList');
  assertNothingSecretLogged();
});

test('un écart que seule la traduction voit est journalisé de même : la planche d’un emplacement d’une série connue (F391)', async () => {
  const { client, calls } = otfAnswering((responses) => {
    const [first, ...others] = responses['/placeList'] as Record<string, unknown>[];
    const withoutBed: Record<string, unknown> = { ...first, name: SECRET };
    delete withoutBed.bed;
    responses['/placeList'] = [withoutBed, ...others];
  });
  await assert.rejects(
    () => readOtfSeasonSnapshot(client, 2026, new Date(), '17'),
    (error) => error instanceof OtfShapeError && error.route === '/placeList' && error.field === 'bed',
  );
  assert.equal(calls.at(-1), '/taskList', 'la traduction du plan suit la dernière route');
  assert.deepEqual(shapeLogs(), [{ event: 'otf_route_shape_changed', route: '/placeList', field: 'bed', problem: 'unreadable-relation' }]);
  assertNothingSecretLogged();
});
