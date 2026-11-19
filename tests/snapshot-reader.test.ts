import assert from 'node:assert/strict';
import test from 'node:test';
import { OtfReadClient, resetOtfRatePacer } from '../lib/adapters/otf/read-client.ts';
import {
  readCompleteOtfSnapshot,
  readOtfSeasonSnapshot,
  OtfSeasonUnavailableError,
} from '../lib/adapters/otf/snapshot-reader.ts';
import { OtfFarmMismatchError } from '../lib/domain/otf/farm-identity.ts';

// Chaque test est une lecture à part : sans remise à zéro, les appels des
// tests précédents rempliraient la minute de la ferme (trente appels, F334).
test.beforeEach(() => resetOtfRatePacer());

test('la lecture ciblée utilise exactement les dix routes GET nécessaires, dans l’ordre, `/me` d’abord (F337)', async () => {
  const calls: string[] = [];
  const client = new OtfReadClient({
    baseUrl: 'https://api.ouvretaferme.org/0.1beta',
    token: 'server-secret',
    fetchImpl: async (input) => {
      const url = new URL(input);
      calls.push(`${url.pathname}:${url.searchParams.get('season') ?? '-'}`);

      if (url.pathname.endsWith('/configuration')) {
        return Response.json({ seasonFirst: 2022, seasonLast: 2027 });
      }
      if (url.pathname.endsWith('/me')) {
        return Response.json([{ id: 17, name: 'Ferme', legalCity: 'Rennes', legalPostcode: '35000', legalCountry: 'FR' }]);
      }
      if (url.pathname.endsWith('/zoneList')) {
        return Response.json({ count: 1, list: [{ id: 1, name: 'Ferme' }] });
      }
      if (url.pathname.endsWith('/plotList')) {
        return Response.json({
          count: 1,
          list: [{ id: 10, zone: 1, name: 'Nord', area: 100 }],
        });
      }
      if (url.pathname.endsWith('/bedList')) {
        return Response.json({
          count: 1,
          list: [{ id: 20, zone: 1, plot: 10, name: 'P01', length: 20, width: 75, alleyWidth: 45 }],
        });
      }
      if (url.pathname.endsWith('/actionList')) {
        return Response.json({ count: 1, list: [{ id: 288, name: 'Semis direct', fqn: 'semis-direct' }] });
      }
      if (url.pathname.endsWith('/plantList')) {
        return Response.json({ count: 1, list: [{ id: 937, name: 'Ail' }] });
      }
      if (url.pathname.endsWith('/seriesList')) {
        assert.equal(url.searchParams.get('withCultivations'), 'true');
        return Response.json({ count: 1, list: [{ id: 51010, name: 'Aillet', season: 2026, use: 'bed', cycle: 'annual', cultivations: [{ id: 53064, plant: 937, harvestWeeks: ['2026-W14'], harvestWeeksExpected: [] }] }] });
      }
      if (url.pathname.endsWith('/placeList')) {
        return Response.json({ count: 1, list: [{ id: 125090, series: 51010, bed: 20, length: 20 }] });
      }
      return Response.json({ count: 1, list: [{ id: 844280, cultivation: 53064, series: 51010, action: 288, plannedWeek: '2025-W45', doneWeek: '2025-W45', status: 'done' }] });
    },
  });

  const snapshot = await readOtfSeasonSnapshot(
    client,
    2026,
    new Date('2026-08-27T12:00:00.000Z'),
  );

  assert.deepEqual(calls, [
    '/0.1beta/me:-',
    '/0.1beta/configuration:-',
    '/0.1beta/zoneList:2026',
    '/0.1beta/plotList:2026',
    '/0.1beta/bedList:2026',
    '/0.1beta/actionList:-',
    '/0.1beta/plantList:-',
    '/0.1beta/seriesList:2026',
    '/0.1beta/placeList:2026',
    '/0.1beta/taskList:-',
  ]);
  assert.deepEqual(snapshot.zones[0].seasons, [2026]);
  assert.equal(snapshot.cropPlan?.series[0].name, 'Aillet');
  assert.equal(snapshot.cropPlan?.series[0].cultivations[0].plantName, 'Ail');
  assert.deepEqual(snapshot.cropPlan?.places, [{ id: '125090', seriesId: '51010', bedId: '20', lengthMeters: 20 }]);
  assert.equal(snapshot.cropPlan?.implantationTasks[0].kind, 'direct-sowing');
  assert.equal(snapshot.cropPlan?.readSummary.tasksRetained, 1);
  assert.deepEqual(snapshot.plots[0].seasons, [2026]);
  assert.deepEqual(snapshot.beds[0].seasons, [2026]);
  assert.equal(snapshot.beds[0].width, 0.75);
  assert.equal(snapshot.beds[0].area, 15);
  assert.equal(snapshot.structure.legalCity, 'Rennes');
});

test('une saison hors configuration est rejetée après `/me` et la configuration, avant les trois listes', async () => {
  let calls = 0;
  const client = new OtfReadClient({
    baseUrl: 'https://api.ouvretaferme.org/0.1beta',
    token: 'server-secret',
    fetchImpl: async () => {
      calls += 1;
      return Response.json({ seasonFirst: 2025, seasonLast: 2027 });
    },
  });

  await assert.rejects(
    () => readOtfSeasonSnapshot(client, 2024),
    (error) =>
      error instanceof OtfSeasonUnavailableError &&
      error.requestedSeason === 2024 &&
      error.seasonFirst === 2025 &&
      error.seasonLast === 2027,
  );
  assert.equal(calls, 2);
});

/** Un client dont `/me` répond `me` ; les autres routes, une configuration et des listes vides. */
function clientAnswering(me: unknown, calls: string[]) {
  return new OtfReadClient({
    baseUrl: 'https://api.ouvretaferme.org/0.1beta',
    token: 'server-secret',
    fetchImpl: async (input) => {
      const url = new URL(input);
      calls.push(url.pathname);
      if (url.pathname.endsWith('/me')) return Response.json(me);
      if (url.pathname.endsWith('/configuration')) return Response.json({ seasonFirst: 2026, seasonLast: 2026 });
      return Response.json({ count: 0, list: [] });
    },
  });
}

test('la garde de la ferme (F332) : une clé qui mène à la ferme attendue lit la suite', async () => {
  const calls: string[] = [];
  const snapshot = await readOtfSeasonSnapshot(clientAnswering([{ id: 17, name: 'Ferme' }], calls), 2026, new Date(), '17');
  assert.equal(snapshot.structure.id, '17');
  assert.equal(calls[0], '/0.1beta/me');
  assert.ok(calls.length > 2, 'la lecture continue après `/me`');
});

test('la garde de la ferme (F332) : une clé qui mène à une autre ferme s’arrête après `/me`, sans autre route', async () => {
  const calls: string[] = [];
  await assert.rejects(
    () => readOtfSeasonSnapshot(clientAnswering([{ id: 18, name: 'Autre ferme' }], calls), 2026, new Date(), '17'),
    (error) => error instanceof OtfFarmMismatchError && error.observedFarmId === '18',
  );
  assert.deepEqual(calls, ['/0.1beta/me']);
});

test('la garde de la ferme (F341) : un `/me` sans identité lisible arrête la lecture, sans rien deviner', async () => {
  for (const me of [[], [{ name: 'Sans identifiant' }], { list: [] }]) {
    const calls: string[] = [];
    await assert.rejects(
      () => readOtfSeasonSnapshot(clientAnswering(me, calls), 2026, new Date(), '17'),
      (error) => error instanceof OtfFarmMismatchError && error.observedFarmId === null,
      JSON.stringify(me),
    );
    assert.deepEqual(calls, ['/0.1beta/me'], JSON.stringify(me));
  }
});

test('la lecture complète parcourt les saisons et fusionne les identifiants', async () => {
  const calls: string[] = [];
  const client = new OtfReadClient({
    baseUrl: 'https://api.ouvretaferme.org/0.1beta',
    token: 'server-secret',
    fetchImpl: async (input) => {
      const url = new URL(input);
      calls.push(`${url.pathname}:${url.searchParams.get('season') ?? '-'}`);

      if (url.pathname.endsWith('/configuration')) {
        return Response.json({ seasonFirst: 2025, seasonLast: 2026 });
      }
      if (url.pathname.endsWith('/me')) {
        return Response.json([{ id: 17, name: 'Ferme', legalCity: 'Rennes' }]);
      }

      const season = Number(url.searchParams.get('season'));
      if (url.pathname.endsWith('/zoneList')) {
        return Response.json({
          count: season === 2026 ? 1 : 2,
          list: season === 2026
            ? [{ id: 1, name: 'Ferme', seasonFirst: 2025, seasonLast: 2026 }]
            : [
                { id: 1, name: 'Ferme', seasonFirst: 2025, seasonLast: 2026 },
                { id: 2, name: 'Ancienne', seasonFirst: 2025, seasonLast: 2025 },
              ],
        });
      }
      if (url.pathname.endsWith('/plotList')) {
        return Response.json({
          count: 1,
          list: [{ id: 10, zone: 1, name: 'Nord', mode: 'open-field', area: 100 }],
        });
      }
      return Response.json({
        count: 1,
        list: [{ id: 20, zone: 1, plot: 10, name: 'P01', length: 25, width: 80, alleyWidth: null }],
      });
    },
  });

  const snapshot = await readCompleteOtfSnapshot(
    client,
    new Date('2026-08-26T12:00:00.000Z'),
  );

  assert.equal(calls.length, 8);
  assert.deepEqual(calls.slice(2), [
    '/0.1beta/zoneList:2026',
    '/0.1beta/plotList:2026',
    '/0.1beta/bedList:2026',
    '/0.1beta/zoneList:2025',
    '/0.1beta/plotList:2025',
    '/0.1beta/bedList:2025',
  ]);
  assert.equal(snapshot.zones.length, 2);
  assert.equal(snapshot.plots.length, 1);
  assert.equal(snapshot.beds.length, 1);
  assert.equal(snapshot.beds[0].width, 0.8);
});
