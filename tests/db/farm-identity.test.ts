import assert from 'node:assert/strict';
import test, { afterEach, beforeEach, mock } from 'node:test';
import type { IrrigationSnapshot } from '../../lib/domain/domain';
import { readDeploymentFarm, saveDeploymentFarm } from '../../db/otf-deployment-farm-repository';
import { readFeatureSelectionForUser, saveFeatureSelectionForUser } from '../../db/feature-selection-repository';
import { readLatestCachedSnapshot, readCachedSnapshot, saveCachedSnapshot } from '../../db/snapshot-cache';
import { attachPendingWorkspace, ensureWorkspaceForUser, findWorkspaceIdForUser } from '../../db/workspace-repository';
import { resetOtfRatePacer } from '../../lib/adapters/otf/read-client';
import { farmSpaceKey, InvalidFarmSpaceError } from '../../lib/domain/farm-space';
import { FEATURE_IDS } from '../../lib/domain/features/catalogue';
import { FARM_CHANGED_MESSAGE, IrrigationDataUnavailableError } from '../../lib/domain/snapshot-policy';
import {
  FarmIdentityUnavailableError,
  resolveDeploymentFarm,
  resolveSpaceKey,
  type FarmIdentityDependencies,
} from '../../lib/services/farm-identity-service';
import { getIrrigationSnapshot, readCachedIrrigationSnapshot, readLatestCachedSnapshotOfSpace } from '../../lib/services/irrigation-service';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';

/**
 * L'identité de la ferme et le rattachement (4.1, docs/tranche-4-contract.md,
 * F327, F330 à F332, F337 à F344), sur une base migrée : la ferme du
 * déploiement, l'espace d'avant la 4.1 qui reçoit sa ferme avec ses données,
 * et la garde qui empêche un espace de lire une autre ferme que la sienne.
 * Ces tests nomment leurs personnes et leurs fermes eux-mêmes : ils jouent
 * le passage d'un espace sans ferme à un espace de ferme, que les passages
 * d'isolation ne changent pas.
 */

const SNAPSHOT_CACHE_VERSION = 'v6-plan-de-culture';
const LEGACY_SNAPSHOT_CACHE_VERSION = 'v3-zone-fill-area';
const OTF_SETTINGS = ['OTF_DATA_SOURCE', 'OTF_API_BASE_URL', 'OTF_API_TOKEN', 'DEMO_MODE'] as const;

let database: TestDatabase;
const savedSettings = Object.fromEntries(OTF_SETTINGS.map((key) => [key, process.env[key]]));
const savedFetch = globalThis.fetch;

beforeEach(() => {
  database = installTestDatabase();
  resetOtfRatePacer();
  // Les journaux des lectures refusées : attendus ici, ils ne disent rien au lecteur des tests.
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

const snapshot = (farmId: string, lastSuccessfulReadAt: string, season = 2026): IrrigationSnapshot => ({
  configuration: { seasonFirst: 2025, seasonLast: 2026 },
  structure: { id: farmId, name: `Ferme ${farmId}`, legalCity: 'Rennes', legalPostcode: '35000', legalCountry: 'FR' },
  zones: [{ id: '14', name: 'Clémentière', area: 10309, seasons: [season] }],
  plots: [],
  beds: [],
  source: 'live',
  lastSuccessfulReadAt,
});

/** La clé de cache telle que le service la compose (`lib/services/irrigation-service.ts`). */
const cacheKeyOf = (spaceKey: string, season: number) => JSON.stringify([SNAPSHOT_CACHE_VERSION, spaceKey, season]);

const NOW = '2026-11-17T21:00:00.000Z';

function dependencies(overrides: Partial<FarmIdentityDependencies> = {}): FarmIdentityDependencies {
  return {
    dataSource: () => 'live',
    readOtfMe: async () => {
      throw new Error('`GET /me` ne devait pas être appelé.');
    },
    now: () => new Date(NOW),
    ...overrides,
  };
}

function workspaceFarm(workspaceId: string): string | null {
  const row = database.sqlite.prepare('SELECT otf_farm_id FROM irrigation_workspaces WHERE id = ?').get(workspaceId) as { otf_farm_id: string | null } | undefined;
  assert.ok(row, 'l’espace existe toujours');
  return row.otf_farm_id;
}

function workspaceCount(): number {
  return Number((database.sqlite.prepare('SELECT count(*) AS n FROM irrigation_workspaces').get() as { n: number }).n);
}

// --- La ferme du déploiement (F339) -----------------------------------------

test('la ferme du déploiement tient en une ligne, et une observation plus ancienne ne remplace jamais une plus récente (F339)', async () => {
  assert.equal(await readDeploymentFarm(), null);
  await saveDeploymentFarm('17', '2026-11-17T20:00:00.000Z');
  assert.deepEqual(await readDeploymentFarm(), { otfFarmId: '17', observedAt: '2026-11-17T20:00:00.000Z' });

  await saveDeploymentFarm('18', '2026-11-17T19:00:00.000Z');
  assert.deepEqual(await readDeploymentFarm(), { otfFarmId: '17', observedAt: '2026-11-17T20:00:00.000Z' }, 'une observation plus ancienne est ignorée');

  await saveDeploymentFarm('18', '2026-11-17T21:00:00.000Z');
  assert.deepEqual(await readDeploymentFarm(), { otfFarmId: '18', observedAt: '2026-11-17T21:00:00.000Z' });
  assert.equal(database.sqlite.prepare('SELECT count(*) AS n FROM otf_deployment_farm').get()?.n, 1);
  assert.throws(
    () => database.sqlite.prepare("INSERT INTO otf_deployment_farm (id, otf_farm_id, observed_at) VALUES (2, '19', ?)").run(NOW),
    /CHECK constraint failed/,
    'une seconde ligne est refusée par la base',
  );
});

test('avec les données fictives, la ferme du déploiement est la ferme fictive, sans rien écrire ni appeler (F339)', async () => {
  assert.equal(await resolveDeploymentFarm(dependencies({ dataSource: () => 'mock' })), 'farm-demo');
  assert.equal(await readDeploymentFarm(), null);
});

test('en lecture réelle, la ferme gardée sert d’abord, sans appel à Ouvre ta ferme (F339)', async () => {
  await saveDeploymentFarm('17', '2026-11-17T20:00:00.000Z');
  await saveCachedSnapshot(cacheKeyOf('alice', 2026), snapshot('18', '2026-11-17T20:30:00.000Z'));
  assert.equal(await resolveDeploymentFarm(dependencies()), '17');
});

test('sans ferme gardée, celle du dernier instantané en cache lisible est gardée, avec l’heure de sa lecture (F339)', async () => {
  await saveCachedSnapshot(cacheKeyOf('alice', 2026), snapshot('17', '2026-11-17T18:00:00.000Z'));
  await saveCachedSnapshot(cacheKeyOf('bob', 2026), snapshot('18', '2026-11-17T19:00:00.000Z'));
  assert.equal(await resolveDeploymentFarm(dependencies()), '18', 'le plus récent, toutes clés confondues');
  assert.deepEqual(await readDeploymentFarm(), { otfFarmId: '18', observedAt: '2026-11-17T19:00:00.000Z' });
});

test('sans ferme gardée ni cache lisible, un seul appel à `GET /me`, dont la ferme est gardée (F338, F339)', async () => {
  // Un instantané d'avant la règle de F338, sans identité : il ne prouve rien.
  await saveCachedSnapshot(cacheKeyOf('alice', 2026), snapshot('unknown', '2026-11-17T19:00:00.000Z'));
  let calls = 0;
  const farm = await resolveDeploymentFarm(dependencies({
    readOtfMe: async () => {
      calls += 1;
      return [{ id: 17, name: 'Ferme' }];
    },
  }));
  assert.equal(farm, '17');
  assert.equal(calls, 1);
  assert.deepEqual(await readDeploymentFarm(), { otfFarmId: '17', observedAt: NOW });
});

test('un `GET /me` illisible ou en échec ne donne aucune ferme et n’écrit rien (F338, F341)', async () => {
  for (const readOtfMe of [
    async () => [],
    async () => [{ id: 17 }, { id: 18 }],
    async () => [{ name: 'Sans identifiant' }],
    async () => {
      throw new Error('Ouvre ta ferme ne répond pas.');
    },
  ]) {
    assert.equal(await resolveDeploymentFarm(dependencies({ readOtfMe })), null);
  }
  assert.equal(await readDeploymentFarm(), null);
});

// --- Le dernier instantané en cache ------------------------------------------

test('le dernier instantané en cache : toutes clés confondues, ou ceux d’un espace, sans confondre deux clés qui se prolongent', async () => {
  await saveCachedSnapshot(cacheKeyOf('alice', 2025), snapshot('17', '2026-11-17T07:00:00.000Z', 2025));
  await saveCachedSnapshot(cacheKeyOf('alice', 2026), snapshot('17', '2026-11-17T08:00:00.000Z'));
  await saveCachedSnapshot(cacheKeyOf('alice2', 2026), snapshot('18', '2026-11-17T09:00:00.000Z'));
  await saveCachedSnapshot(`${LEGACY_SNAPSHOT_CACHE_VERSION}:bob`, snapshot('19', '2026-11-17T06:00:00.000Z'));

  assert.equal((await readLatestCachedSnapshot())?.structure.id, '18');
  assert.equal((await readLatestCachedSnapshotOfSpace('alice'))?.lastSuccessfulReadAt, '2026-11-17T08:00:00.000Z');
  assert.equal((await readLatestCachedSnapshotOfSpace('alice2'))?.structure.id, '18');
  assert.equal((await readLatestCachedSnapshotOfSpace('bob'))?.structure.id, '19', 'l’ancienne clé de cache compte aussi');
  assert.equal(await readLatestCachedSnapshotOfSpace('Alice'), null, 'la clé se compare à la lettre près');
  assert.equal(await readLatestCachedSnapshotOfSpace('carole'), null);
});

// --- Le rattachement (F331, F340) --------------------------------------------

test('le rattachement donne sa ferme à l’espace sans ferme, une seule fois, et ses données suivent sous la clé de la ferme (F331)', async () => {
  await saveFeatureSelectionForUser('alice', FEATURE_IDS, new Date(NOW));
  const pending = await findWorkspaceIdForUser('alice');
  assert.ok(pending);

  assert.equal(await attachPendingWorkspace('alice', '17'), true);
  assert.equal(await findWorkspaceIdForUser('alice'), null, 'plus d’espace sans ferme');
  assert.equal(await findWorkspaceIdForUser(farmSpaceKey('alice', '17')), pending, 'le même espace, sans copie');
  const selection = await readFeatureSelectionForUser(farmSpaceKey('alice', '17'));
  assert.equal(selection.kind, 'stored', 'le choix fait avant le rattachement se lit sous la nouvelle clé');
  assert.equal(workspaceCount(), 1);

  assert.equal(await attachPendingWorkspace('alice', '17'), false, 'rien à rattacher la deuxième fois');
});

test('le rattachement n’écrit rien quand la personne a déjà un espace pour cette ferme : l’espace sans ferme reste à part (F340)', async () => {
  const pending = await ensureWorkspaceForUser('alice');
  const farm = await ensureWorkspaceForUser(farmSpaceKey('alice', '17'));
  assert.notEqual(pending, farm);

  assert.equal(await attachPendingWorkspace('alice', '17'), false);
  assert.equal(workspaceFarm(pending), null, 'jamais fusionné');
  assert.equal(workspaceFarm(farm), '17');
  assert.equal(await findWorkspaceIdForUser('alice'), pending);
});

test('le rattachement part d’une personne seule et refuse une ferme mal formée, avant toute écriture (F327)', async () => {
  const pending = await ensureWorkspaceForUser('alice');
  await assert.rejects(attachPendingWorkspace(farmSpaceKey('alice', '17'), '18'), InvalidFarmSpaceError);
  for (const farm of ['', 'a/b', '17 18', 'x'.repeat(65)]) {
    await assert.rejects(attachPendingWorkspace('alice', farm), InvalidFarmSpaceError, JSON.stringify(farm));
  }
  assert.equal(workspaceFarm(pending), null);
});

// --- La clé d'espace, à chaque connexion (F327, F340, F341) -------------------

test('sans ferme connue, la connexion s’arrête sur FarmIdentityUnavailableError et rien n’est écrit (F341)', async () => {
  const pending = await ensureWorkspaceForUser('alice');
  await assert.rejects(resolveSpaceKey('alice', dependencies({ readOtfMe: async () => [] })), FarmIdentityUnavailableError);
  assert.equal(workspaceFarm(pending), null);
  assert.equal(await readDeploymentFarm(), null);
});

test('une personne nouvelle reçoit la clé de la ferme du déploiement, sans qu’un espace soit créé à la connexion (F327)', async () => {
  await saveDeploymentFarm('17', '2026-11-17T20:00:00.000Z');
  assert.equal(await resolveSpaceKey('carole', dependencies()), farmSpaceKey('carole', '17'));
  assert.equal(workspaceCount(), 0);
});

test('l’espace d’avant la 4.1 prend la ferme de son dernier instantané, même si la clé mène ailleurs ; la clé rendue reste celle du déploiement (F340)', async () => {
  await saveDeploymentFarm('17', '2026-11-17T20:00:00.000Z');
  const pending = await ensureWorkspaceForUser('alice');
  await saveCachedSnapshot(cacheKeyOf('alice', 2026), snapshot('18', '2026-11-16T08:00:00.000Z'));

  assert.equal(await resolveSpaceKey('alice', dependencies()), farmSpaceKey('alice', '17'));
  assert.equal(workspaceFarm(pending), '18', 'les données de la ferme 18 restent avec la ferme 18');
  assert.equal(await findWorkspaceIdForUser(farmSpaceKey('alice', '17')), null, 'la ferme 17 commence un espace neuf');

  // À la connexion suivante, il n'y a plus rien à rattacher.
  assert.equal(await resolveSpaceKey('alice', dependencies()), farmSpaceKey('alice', '17'));
  assert.equal(workspaceFarm(pending), '18');
});

test('sans instantané lisible, l’espace d’avant la 4.1 prend la ferme du déploiement ; deux personnes d’une même ferme restent séparées (F327, F340)', async () => {
  await saveDeploymentFarm('17', '2026-11-17T20:00:00.000Z');
  const alice = await ensureWorkspaceForUser('alice');
  const bob = await ensureWorkspaceForUser('bob');

  assert.equal(await resolveSpaceKey('alice', dependencies()), farmSpaceKey('alice', '17'));
  assert.equal(await resolveSpaceKey('bob', dependencies()), farmSpaceKey('bob', '17'));
  assert.equal(await findWorkspaceIdForUser(farmSpaceKey('alice', '17')), alice);
  assert.equal(await findWorkspaceIdForUser(farmSpaceKey('bob', '17')), bob);
  assert.notEqual(alice, bob);
});

test('avec les données fictives, l’espace d’avant la 4.1 prend la ferme fictive, sans lire de preuve en cache (F339, F340)', async () => {
  const pending = await ensureWorkspaceForUser('local-demo-user');
  await saveCachedSnapshot(cacheKeyOf('local-demo-user', 2026), snapshot('18', '2026-11-16T08:00:00.000Z'));
  const key = await resolveSpaceKey('local-demo-user', dependencies({ dataSource: () => 'mock' }));
  assert.equal(key, farmSpaceKey('local-demo-user', 'farm-demo'));
  assert.equal(workspaceFarm(pending), 'farm-demo');
});

// --- La garde des lectures (F332, F337, F341 à F343) ---------------------------

type OtfAnswers = { me: unknown };

/** Le réseau d'Ouvre ta ferme, simulé : chaque route appelée est notée. */
function otfNetwork({ me }: OtfAnswers): string[] {
  process.env.OTF_DATA_SOURCE = 'live';
  process.env.OTF_API_BASE_URL = 'https://api.ouvretaferme.org/0.1beta';
  process.env.OTF_API_TOKEN = 'jeton-de-test-sans-valeur';
  delete process.env.DEMO_MODE;
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    calls.push(url.pathname);
    if (url.pathname.endsWith('/me')) return Response.json(me);
    if (url.pathname.endsWith('/configuration')) return Response.json({ seasonFirst: 2025, seasonLast: 2026 });
    return Response.json({ count: 0, list: [] });
  }) as typeof fetch;
  return calls;
}

test('un espace d’une autre ferme ne lit pas Ouvre ta ferme : son cache s’affiche avec le message de F332, et sans cache la lecture le dit (F342)', async () => {
  const calls = otfNetwork({ me: [{ id: 18 }] });
  await saveDeploymentFarm('18', '2026-11-17T20:00:00.000Z');
  const alice17 = farmSpaceKey('alice', '17');
  await saveCachedSnapshot(cacheKeyOf(alice17, 2026), snapshot('17', '2026-11-17T08:00:00.000Z'));

  const shown = await getIrrigationSnapshot(alice17, { season: 2026, forceRefresh: true });
  assert.equal(shown.source, 'cache');
  assert.equal(shown.structure.id, '17');
  assert.equal(shown.warning, FARM_CHANGED_MESSAGE);

  await assert.rejects(
    getIrrigationSnapshot(farmSpaceKey('bob', '17'), { season: 2026, forceRefresh: true }),
    (error) => error instanceof IrrigationDataUnavailableError && error.reason === 'farm-changed',
  );
  assert.deepEqual(calls, [], 'aucun appel à Ouvre ta ferme');
});

test('un espace sans ferme ne lit pas Ouvre ta ferme : son cache sert, sans appel (F342)', async () => {
  const calls = otfNetwork({ me: [{ id: 17 }] });
  await saveDeploymentFarm('17', '2026-11-17T20:00:00.000Z');
  await saveCachedSnapshot(cacheKeyOf('alice', 2026), snapshot('17', '2026-11-17T08:00:00.000Z'));

  const shown = await getIrrigationSnapshot('alice', { season: 2026, forceRefresh: true });
  assert.equal(shown.source, 'cache');
  assert.deepEqual(calls, []);
});

test('une clé qui mène à une autre ferme : seule `/me` est lue, la nouvelle ferme est gardée et le cache s’affiche avec le message de F332 (F332, F337)', async () => {
  const calls = otfNetwork({ me: [{ id: 18, name: 'Autre ferme' }] });
  await saveDeploymentFarm('17', '2026-11-17T08:00:00.000Z');
  const alice17 = farmSpaceKey('alice', '17');
  await saveCachedSnapshot(cacheKeyOf(alice17, 2026), snapshot('17', '2026-11-17T08:00:00.000Z'));

  const shown = await getIrrigationSnapshot(alice17, { season: 2026, forceRefresh: true });
  assert.equal(shown.warning, FARM_CHANGED_MESSAGE);
  assert.deepEqual(calls, ['/0.1beta/me']);
  assert.equal((await readDeploymentFarm())?.otfFarmId, '18', 'la connexion suivante ouvre l’espace de la ferme 18');
  assert.equal((await readCachedSnapshot(cacheKeyOf(alice17, 2026)))?.structure.id, '17', 'rien n’est rangé sous la clé de la ferme 17');
});

test('un `/me` sans identité : rien n’est lu de plus, la ferme gardée ne change pas, le cache s’affiche avec le message de F341', async () => {
  const calls = otfNetwork({ me: [] });
  await saveDeploymentFarm('17', '2026-11-17T08:00:00.000Z');
  const alice17 = farmSpaceKey('alice', '17');
  await saveCachedSnapshot(cacheKeyOf(alice17, 2026), snapshot('17', '2026-11-17T08:00:00.000Z'));

  const shown = await getIrrigationSnapshot(alice17, { season: 2026, forceRefresh: true });
  assert.equal(shown.warning, "Ouvre ta ferme n'a pas dit à quelle ferme mène la clé de ce module. La dernière lecture réussie est affichée.");
  assert.deepEqual(calls, ['/0.1beta/me']);
  assert.deepEqual(await readDeploymentFarm(), { otfFarmId: '17', observedAt: '2026-11-17T08:00:00.000Z' });
});

test('la ferme de l’espace : `/me` d’abord, la lecture complète est rangée sous la clé de l’espace et l’observation est gardée (F328, F337)', async () => {
  const calls = otfNetwork({ me: [{ id: 17, name: 'Ferme' }] });
  await saveDeploymentFarm('17', '2026-11-17T08:00:00.000Z');
  const alice17 = farmSpaceKey('alice', '17');

  const read = await getIrrigationSnapshot(alice17, { season: 2026, forceRefresh: true });
  assert.equal(read.source, 'live');
  assert.equal(read.structure.id, '17');
  assert.equal(calls[0], '/0.1beta/me');
  assert.ok(calls.includes('/0.1beta/configuration') && calls.length > 2, 'la lecture continue après `/me`');
  assert.equal((await readCachedSnapshot(cacheKeyOf(alice17, 2026)))?.structure.id, '17');
  assert.deepEqual(await readDeploymentFarm(), { otfFarmId: '17', observedAt: read.lastSuccessfulReadAt });
});

test('continuité du cache : la nouvelle clé lit le dernier instantané de sa personne d’avant la 4.1, seulement s’il est de la même ferme, sans le copier (F343)', async () => {
  otfNetwork({ me: [{ id: 17 }] });
  await saveCachedSnapshot(cacheKeyOf('alice', 2026), snapshot('17', '2026-11-17T08:00:00.000Z'));
  await saveCachedSnapshot(cacheKeyOf('bob', 2026), snapshot('18', '2026-11-17T08:00:00.000Z'));

  assert.equal((await readCachedIrrigationSnapshot(farmSpaceKey('alice', '17'), 2026))?.structure.id, '17');
  assert.equal(await readCachedIrrigationSnapshot(farmSpaceKey('bob', '17'), 2026), null, 'un instantané d’une autre ferme ne sert jamais');
  assert.equal(await readCachedIrrigationSnapshot(farmSpaceKey('carole', '17'), 2026), null);
  assert.equal(await readCachedSnapshot(cacheKeyOf(farmSpaceKey('alice', '17'), 2026)), null, 'rien n’est copié');
});
