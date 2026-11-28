import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import type { DatabaseSync } from 'node:sqlite';
import { overrideDatabase } from '../../db/binding';
import { beginOtfFarmRead, recordOtfCallOutcome } from '../../db/otf-call-ledger-repository';
import { RETENTION_PURGES } from '../../db/retention-plan';
import { ensureWorkspaceForUser } from '../../db/workspace-repository';
import { runRetentionPurges } from '../../lib/services/retention-purge';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { ALICE, BOB } from '../support/spaces';
import { dataTables, fillEverySpaceTable } from '../support/synthetic-space-rows';

/**
 * Les purges de conservation, sur la base de test (4.5, PR 5 ;
 * docs/tranche-4-contract.md, F562, et 10 bis.18, F650 à F652) : chaque
 * table à durée limitée perd, pour toutes les fermes, les lignes qui ont
 * dépassé leur durée, à la limite exacte, et rien d'autre ; bornées, elles
 * reprennent au passage suivant ; une purge en échec n'arrête pas les
 * autres ; et les purges faites « au passage » par le compteur des appels
 * tiennent les mêmes durées.
 */

/** Samedi 28 novembre 2026, 6 h 16 à Paris : le matin. */
const NOW = new Date('2026-11-28T05:16:00.000Z');
const ms = (iso: string) => Date.parse(iso);
const FARMS = ['4394', '5120'];

let database: TestDatabase;

beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

/** Pour chaque ferme, une ligne juste trop vieille et une ligne juste à sa limite, dans chaque table purgée. */
function writeAgedRows(sqlite: DatabaseSync): void {
  for (const farm of FARMS) {
    const start = sqlite.prepare('INSERT INTO otf_call_starts (pace_key, started_at_ms, paris_day, read_id, reserved) VALUES (?, ?, ?, NULL, 1)');
    start.run(farm, ms('2026-11-26T05:15:59.999Z'), '2026-11-26');
    start.run(farm, ms('2026-11-26T05:16:00.000Z'), '2026-11-26');
    const outcome = sqlite.prepare('INSERT INTO otf_call_outcomes (pace_key, hour_start_ms, outcome, calls) VALUES (?, ?, ?, 3)');
    outcome.run(farm, ms('2026-11-20T04:00:00.000Z'), 'ok');
    outcome.run(farm, ms('2026-11-20T05:00:00.000Z'), 'ok');
    const daily = sqlite.prepare('INSERT INTO otf_daily_calls (pace_key, paris_day, calls) VALUES (?, ?, 22)');
    daily.run(farm, '2026-10-28');
    daily.run(farm, '2026-10-29');
  }
  sqlite.prepare('INSERT INTO otf_call_pauses (scope, paused_until_ms, reason) VALUES (?, ?, ?)').run('4394', NOW.getTime(), 'rate-limit');
  sqlite.prepare('INSERT INTO otf_call_pauses (scope, paused_until_ms, reason) VALUES (?, ?, ?)').run('5120', NOW.getTime() + 1, 'day-limit');
  const failure = sqlite.prepare('INSERT INTO otf_authentication_failures (failed_at_ms) VALUES (?)');
  failure.run(ms('2026-11-28T05:01:00.000Z'));
  failure.run(ms('2026-11-28T05:01:00.001Z'));
  const notice = sqlite.prepare('INSERT INTO irrigation_operator_notices (paris_day, kind, problems, claimed_at, sent_at) VALUES (?, ?, ?, ?, ?)');
  notice.run('2026-10-23', 'alert', 1, '2026-10-23T07:00:00.000Z', '2026-10-23T07:00:01.000Z');
  notice.run('2026-10-24', 'all-good', 0, '2026-10-24T07:00:00.000Z', '2026-10-24T07:00:01.000Z');
  const access = sqlite.prepare('INSERT INTO irrigation_support_accesses (id, otf_farm_id, accessed_on, reason, recorded_at) VALUES (?, ?, ?, ?, ?)');
  for (const farm of FARMS) {
    access.run(`trop-vieux-${farm}`, farm, '2025-11-27', 'La ferme demande pourquoi son planning est vide', '2025-11-27T10:00:00.000Z');
    access.run(`a-sa-limite-${farm}`, farm, '2025-11-28', 'La ferme demande pourquoi son planning est vide', '2025-11-28T10:00:00.000Z');
  }
  // L'archive des prévisions (D-297) : une table d'espace, 24 mois par jour d'émission ; un espace par ferme.
  const space = sqlite.prepare('INSERT OR IGNORE INTO irrigation_workspaces (id, owner_user_id, otf_farm_id) VALUES (?, ?, NULL)');
  const archive = sqlite.prepare(`INSERT INTO irrigation_weather_forecast_archive
    (workspace_id, location_key, issued_on, target_date, horizon_days, precipitation_mm, et0_mm, source, fetched_at)
    VALUES (?, 'otf:ferme', ?, date(?, '+1 days'), 1, 2.5, NULL, 'visual-crossing', ?)`);
  for (const farm of FARMS) {
    space.run(`archive-${farm}`, `archive-${farm}`);
    archive.run(`archive-${farm}`, '2024-11-27', '2024-11-27', '2024-11-27T05:15:00.000Z');
    archive.run(`archive-${farm}`, '2024-11-28', '2024-11-28', '2024-11-28T05:15:00.000Z');
  }
}

/** Ce que gardent les tables purgées, ligne par ligne, dans un ordre stable. */
function aged(sqlite: DatabaseSync) {
  const all = (query: string) => sqlite.prepare(query).all().map((row) => Object.values(row).join(' '));
  return {
    otf_call_starts: all('SELECT pace_key, started_at_ms FROM otf_call_starts ORDER BY pace_key, started_at_ms'),
    otf_call_outcomes: all('SELECT pace_key, hour_start_ms FROM otf_call_outcomes ORDER BY pace_key, hour_start_ms'),
    otf_daily_calls: all('SELECT pace_key, paris_day FROM otf_daily_calls ORDER BY pace_key, paris_day'),
    otf_call_pauses: all('SELECT scope FROM otf_call_pauses ORDER BY scope'),
    otf_authentication_failures: all('SELECT failed_at_ms FROM otf_authentication_failures ORDER BY failed_at_ms'),
    irrigation_operator_notices: all('SELECT paris_day FROM irrigation_operator_notices ORDER BY paris_day'),
    irrigation_support_accesses: all('SELECT otf_farm_id, accessed_on FROM irrigation_support_accesses ORDER BY otf_farm_id, accessed_on'),
    irrigation_weather_forecast_archive: all("SELECT workspace_id, issued_on FROM irrigation_weather_forecast_archive WHERE workspace_id LIKE 'archive-%' ORDER BY workspace_id, issued_on"),
  };
}

/** Ce que les purges doivent laisser : la ligne à sa limite, pour chaque ferme. */
const KEPT = {
  otf_call_starts: FARMS.map((farm) => `${farm} ${ms('2026-11-26T05:16:00.000Z')}`),
  otf_call_outcomes: FARMS.map((farm) => `${farm} ${ms('2026-11-20T05:00:00.000Z')}`),
  otf_daily_calls: FARMS.map((farm) => `${farm} 2026-10-29`),
  otf_call_pauses: ['5120'],
  otf_authentication_failures: [`${ms('2026-11-28T05:01:00.001Z')}`],
  irrigation_operator_notices: ['2026-10-24'],
  irrigation_support_accesses: FARMS.map((farm) => `${farm} 2025-11-28`),
  irrigation_weather_forecast_archive: FARMS.map((farm) => `archive-${farm} 2024-11-28`),
};

/** Le nombre de lignes de chaque table que les purges ne visent pas. */
function untouched(sqlite: DatabaseSync): Record<string, number> {
  const purged = new Set<string>(RETENTION_PURGES.map(({ table }) => table));
  return Object.fromEntries(dataTables(sqlite).filter((table) => !purged.has(table)).map((table) => [
    table,
    Number((sqlite.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get() as { n: number }).n),
  ]));
}

async function twoSpacesWithEverything(): Promise<void> {
  const alice = await ensureWorkspaceForUser(ALICE);
  const bob = await ensureWorkspaceForUser(BOB);
  fillEverySpaceTable(database.sqlite, [alice, bob]);
  writeAgedRows(database.sqlite);
}

test('chaque purge efface, pour toutes les fermes, ce qui a dépassé sa durée, à la limite exacte, et rien d’autre', async () => {
  await twoSpacesWithEverything();
  const before = untouched(database.sqlite);
  const lines: Record<string, unknown>[] = [];

  const report = await runRetentionPurges({ now: NOW, log: (_level, entry) => lines.push(entry) });

  assert.deepEqual(report, { purged: 13, unfinished: 0, failures: [] });
  assert.deepEqual(aged(database.sqlite), KEPT);
  assert.deepEqual(untouched(database.sqlite), before, 'aucune table d’espace ni table commune sans durée n’est touchée');
  assert.deepEqual(lines, [
    { event: 'retention_purge_step', table: 'otf_call_starts', rows: 2 },
    { event: 'retention_purge_step', table: 'otf_call_outcomes', rows: 2 },
    { event: 'retention_purge_step', table: 'otf_daily_calls', rows: 2 },
    { event: 'retention_purge_step', table: 'otf_call_pauses', rows: 1 },
    { event: 'retention_purge_step', table: 'otf_authentication_failures', rows: 1 },
    { event: 'retention_purge_step', table: 'irrigation_operator_notices', rows: 1 },
    { event: 'retention_purge_step', table: 'irrigation_support_accesses', rows: 2 },
    { event: 'retention_purge_step', table: 'irrigation_weather_forecast_archive', rows: 2 },
  ], 'le journal ne dit que des noms de table et des nombres');

  assert.deepEqual(await runRetentionPurges({ now: NOW, log: () => undefined }), { purged: 0, unfinished: 0, failures: [] }, 'un second passage n’a plus rien à faire');
  assert.deepEqual(aged(database.sqlite), KEPT);
});

test('bornée, une purge reprend au passage suivant, sans rien effacer de plus', async () => {
  writeAgedRows(database.sqlite);
  const start = database.sqlite.prepare('INSERT INTO otf_call_starts (pace_key, started_at_ms, paris_day, read_id, reserved) VALUES (?, ?, ?, NULL, 1)');
  for (let index = 0; index < 1_200; index += 1) start.run('4394', ms('2026-11-01T05:16:00.000Z') + index, '2026-11-01');

  const cut = await runRetentionPurges({ now: NOW, statements: 2, log: () => undefined });
  assert.deepEqual(cut, { purged: 1_000, unfinished: 9, failures: [] }, 'deux lots de 500, puis plus rien de neuf : neuf purges à finir (la forme de la journée, D-349, en plus)');
  assert.equal(Number((database.sqlite.prepare('SELECT COUNT(*) AS n FROM otf_call_starts').get() as { n: number }).n), 1_202 - 1_000 + 2);

  assert.deepEqual(await runRetentionPurges({ now: NOW, log: () => undefined }), { purged: 1_202 - 1_000 + 11, unfinished: 0, failures: [] });
  assert.deepEqual(aged(database.sqlite), KEPT);
});

test('une purge en échec n’arrête pas les autres, et son message ne va pas au journal', async () => {
  writeAgedRows(database.sqlite);
  overrideDatabase(new Proxy(database.d1, {
    get(target, property) {
      if (property !== 'prepare') return Reflect.get(target, property, target);
      return (query: string) => {
        const statement = target.prepare(query);
        if (!query.startsWith('DELETE FROM "otf_call_outcomes"')) return statement;
        return { bind: () => ({ run: async () => { throw new Error('D1_ERROR: panne simulée'); } }) } as unknown as D1PreparedStatement;
      };
    },
  }));
  const lines: Record<string, unknown>[] = [];
  let report;
  try {
    report = await runRetentionPurges({ now: NOW, log: (_level, entry) => lines.push(entry) });
  } finally {
    overrideDatabase(database.d1);
  }
  assert.deepEqual(report, { purged: 11, unfinished: 0, failures: ['Error'] });
  assert.deepEqual(lines.filter((line) => line.event === 'retention_purge_failed'), [{ event: 'retention_purge_failed', table: 'otf_call_outcomes', error: 'Error' }]);
  assert.ok(!JSON.stringify(lines).includes('panne simulée'), 'le message de la base n’est pas recopié');
  assert.deepEqual(aged(database.sqlite), { ...KEPT, otf_call_outcomes: FARMS.flatMap((farm) => [`${farm} ${ms('2026-11-20T04:00:00.000Z')}`, `${farm} ${ms('2026-11-20T05:00:00.000Z')}`]) });
});

test('une seule durée par donnée : les purges faites au passage par le compteur des appels gardent les mêmes lignes', async () => {
  writeAgedRows(database.sqlite);
  assert.equal(await beginOtfFarmRead({ paceKey: '7001', readId: 'lecture', atMs: NOW.getTime(), places: 1 }), true);
  await recordOtfCallOutcome('7001', 'ok', NOW.getTime());
  const passing = aged(database.sqlite);
  assert.deepEqual(passing.otf_call_starts.filter((row) => !row.startsWith('7001')), KEPT.otf_call_starts);
  assert.deepEqual(passing.otf_call_outcomes.filter((row) => !row.startsWith('7001')), KEPT.otf_call_outcomes);
  assert.deepEqual(passing.otf_daily_calls.filter((row) => !row.startsWith('7001')), KEPT.otf_daily_calls);
  assert.deepEqual(passing.otf_call_pauses, KEPT.otf_call_pauses);
  assert.deepEqual(passing.otf_authentication_failures, KEPT.otf_authentication_failures);
});
