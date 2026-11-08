import assert from 'node:assert/strict';
import test, { afterEach, beforeEach, mock } from 'node:test';
import type { IrrigationSnapshot } from '../../lib/domain/domain';
import { readCachedSnapshot, saveCachedSnapshot } from '../../db/snapshot-cache';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-06-15T08:00:00.000Z') });
});
afterEach(() => {
  mock.timers.reset();
  database.dispose();
});

const snapshot = (overrides: Partial<IrrigationSnapshot> = {}): IrrigationSnapshot => ({
  configuration: { seasonFirst: 2025, seasonLast: 2026 },
  structure: { id: '17', name: 'Ferme', legalCity: 'Rennes', legalPostcode: '35000', legalCountry: 'FR' },
  zones: [{ id: '14', name: 'Clémentière', area: 10309, seasons: [2026] }],
  plots: [],
  beds: [],
  source: 'live',
  lastSuccessfulReadAt: '2026-06-15T07:59:00.000Z',
  ...overrides,
});

/** Clé de cache telle que le service la compose : un utilisateur, une saison. */
const cacheKey = (userId: string, season: number) => `${userId}:${season}`;

test('un cache absent rend null, un cache enregistré revient marqué « cache » avec sa date de lecture', async () => {
  assert.equal(await readCachedSnapshot(cacheKey('alice', 2026)), null);
  await saveCachedSnapshot(cacheKey('alice', 2026), snapshot());
  const cached = await readCachedSnapshot(cacheKey('alice', 2026));
  assert.equal(cached?.source, 'cache', 'la provenance devient « cache » à la relecture');
  assert.equal(cached?.lastSuccessfulReadAt, '2026-06-15T07:59:00.000Z');
  assert.deepEqual(cached?.zones, snapshot().zones);
  assert.deepEqual(cached?.structure, snapshot().structure);
});

test('le cache est isolé par utilisateur et par saison', async () => {
  await saveCachedSnapshot(cacheKey('alice', 2026), snapshot({ structure: { id: '17', name: 'Ferme d’Alice', legalCity: 'Rennes', legalPostcode: '35000', legalCountry: 'FR' } }));
  await saveCachedSnapshot(cacheKey('alice', 2025), snapshot({ structure: { id: '17', name: 'Alice 2025', legalCity: 'Rennes', legalPostcode: '35000', legalCountry: 'FR' } }));
  assert.equal((await readCachedSnapshot(cacheKey('alice', 2026)))?.structure.name, 'Ferme d’Alice');
  assert.equal((await readCachedSnapshot(cacheKey('alice', 2025)))?.structure.name, 'Alice 2025');
  assert.equal(await readCachedSnapshot(cacheKey('bob', 2026)), null);
  assert.equal(database.sqlite.prepare('SELECT count(*) AS n FROM otf_snapshots').get()?.n, 2);
});

test('une nouvelle lecture remplace la précédente pour la même clé', async () => {
  await saveCachedSnapshot(cacheKey('alice', 2026), snapshot());
  mock.timers.tick(3_600_000);
  await saveCachedSnapshot(cacheKey('alice', 2026), snapshot({
    zones: [{ id: '14', name: 'Clémentière', area: 10309, seasons: [2026] }, { id: '15', name: 'Serre', area: 400, seasons: [2026] }],
    lastSuccessfulReadAt: '2026-06-15T09:00:00.000Z',
  }));
  const cached = await readCachedSnapshot(cacheKey('alice', 2026));
  assert.equal(cached?.zones.length, 2);
  assert.equal(cached?.lastSuccessfulReadAt, '2026-06-15T09:00:00.000Z');
  const row = database.sqlite.prepare('SELECT updated_at, count(*) AS n FROM otf_snapshots').get() as { updated_at: string; n: number };
  assert.equal(row.n, 1, 'une seule ligne par clé');
  assert.equal(row.updated_at, '2026-06-15T09:00:00.000Z', 'horodatage de la mise à jour');
});

test('un cache illisible ou d’un ancien format est ignoré plutôt que servi', async () => {
  database.sqlite.prepare("INSERT INTO otf_snapshots (cache_key, payload, last_successful_read_at, updated_at) VALUES (?, ?, ?, ?)")
    .run(cacheKey('alice', 2026), '{pas du json', '2026-06-15T07:00:00.000Z', '2026-06-15T07:00:00.000Z');
  assert.equal(await readCachedSnapshot(cacheKey('alice', 2026)), null, 'JSON invalide');
  database.sqlite.prepare("UPDATE otf_snapshots SET payload = ? WHERE cache_key = ?")
    .run(JSON.stringify({ ...snapshot(), zones: [{ id: '14', name: 'Sans surface', seasons: [2026] }] }), cacheKey('alice', 2026));
  assert.equal(await readCachedSnapshot(cacheKey('alice', 2026)), null, 'ancien format sans surface de parcelle');
});

test('le plan de culture fait partie de l’instantané mis en cache et en revient entier', async () => {
  const cropPlan = {
    series: [{ id: 'serie-1', name: 'Aillet', season: 2026, use: 'bed' as const, cycle: 'annual' as const, cultivations: [{ id: 'culture-1', plantId: '937', plantName: 'Ail', harvestWeeks: ['2026-W14'], harvestWeeksExpected: [] }] }],
    places: [{ id: 'place-1', seriesId: 'serie-1', bedId: 'bed-1', lengthMeters: 32 }],
    implantationTasks: [{ id: 'tache-1', seriesId: 'serie-1', cultivationId: null, kind: 'direct-sowing' as const, plannedWeek: '2025-W45', doneWeek: '2025-W45', status: 'done' as const }],
    readSummary: { seriesRead: 1, placesRead: 1, tasksRead: 13, tasksRetained: 1, placesWithoutSeries: 0, placesOfUnknownSeries: 0, placesWithUnknownBed: 0 },
  };
  await saveCachedSnapshot(cacheKey('alice', 2026), snapshot({ cropPlan }));
  const cached = await readCachedSnapshot(cacheKey('alice', 2026));
  assert.deepEqual(cached?.cropPlan, cropPlan);

  // Un plan de culture tronqué invalide le cache entier : rien n'est servi à moitié.
  database.sqlite.prepare('UPDATE otf_snapshots SET payload = ? WHERE cache_key = ?')
    .run(JSON.stringify({ ...snapshot(), cropPlan: { series: [] } }), cacheKey('alice', 2026));
  assert.equal(await readCachedSnapshot(cacheKey('alice', 2026)), null);
});
