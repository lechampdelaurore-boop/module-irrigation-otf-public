import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import type { DatabaseSync } from 'node:sqlite';
import { overrideDatabase } from '../../db/binding';
import { FARM_TABLES, KEPT_TABLES, SPACE_TABLES } from '../../db/farm-erasure-plan';
import {
  cancelFarmErasure,
  farmErasureBatches,
  finishFarmErasure,
  listErasingFarmErasures,
  readErasedSpace,
  readFarmErasureCounts,
  readOpenFarmErasure,
  requestFarmErasure,
  runErasureBatch,
  startDueFarmErasures,
} from '../../db/farm-erasure-repository';
import { listFarmsWithSelection } from '../../db/feature-selection-repository';
import { createIrrigationEventForUser } from '../../db/irrigation-event/create';
import { saveCachedSnapshot } from '../../db/snapshot-cache';
import { ensureWorkspaceForUser, findWorkspaceIdForUser } from '../../db/workspace-repository';
import type { IrrigationSnapshot } from '../../lib/domain/domain';
import { farmSpaceKey, farmSpaceOf } from '../../lib/domain/farm-space';
import { FARM_ERASURE_BATCH_ROWS, farmErasureLine } from '../../lib/domain/operations/farm-erasure';
import { legacySnapshotKey, seasonSnapshotKey, seasonSnapshotPrefix } from '../../lib/domain/otf/snapshot-keys';
import { readLatestCachedSnapshotOfSpace } from '../../lib/services/irrigation-service';
import { runDueFarmErasures } from '../../lib/services/farm-erasure';
import { farmSummary, isRevisionCounter, revisionCounters } from '../../scripts/backup/farm-rows';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { completedDraft, createDripFixture } from '../support/irrigation-fixtures';
import { ALICE, BOB } from '../support/spaces';
import { fillEverySpaceTable, spaceRowCount, spaceTables } from '../support/synthetic-space-rows';

/**
 * L'effacement d'une ferme, sur la base de test (4.5, PR 3 ;
 * docs/tranche-4-contract.md, F563, preuves 2 à 5, et 10 bis.17, F640 à
 * F648). ALICE demande l'effacement de son espace ; BOB n'en demande pas.
 * `pnpm test` rejoue ce fichier dans les quatre passages de l'isolation
 * (tests/support/spaces.ts) : deux personnes sans ferme, une personne sur
 * deux fermes, deux personnes sur une ferme, l'espace sans ferme d'une
 * personne à côté de son espace de ferme. Dans chacun, BOB reste
 * strictement inchangé.
 */

/** Vendredi 20 novembre 2026, 11 h à Paris : la demande. */
const REQUESTED = new Date('2026-11-20T10:00:00.000Z');
/** Six jours après : encore dans le délai. */
const SIX_DAYS_LATER = new Date('2026-11-26T05:15:00.000Z');
/** Le premier matin après les sept jours. */
const FIRST_MORNING_AFTER = new Date('2026-11-28T05:15:00.000Z');

let database: TestDatabase;
let aliceWorkspace: string;
let bobWorkspace: string;

beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

const silent = () => undefined;

/** Un espace comme les dépôts l'écrivent : du matériel, ses réglages, sa pose et deux irrigations. */
async function populate(spaceKey: string, label: string): Promise<string> {
  const workspaceId = await ensureWorkspaceForUser(spaceKey);
  const fixture = await createDripFixture(spaceKey, { name: `Goutte-à-goutte ${label}`, beds: [`planche-${label}-1`, `planche-${label}-2`] });
  for (const day of ['03', '06']) {
    await createIrrigationEventForUser(spaceKey, completedDraft(fixture, { startAt: `2026-06-${day}T06:00:00.000Z`, endAt: `2026-06-${day}T06:45:00.000Z`, durationSeconds: 2700 }));
  }
  return workspaceId;
}

function snapshotPayload(farm: string): string {
  return JSON.stringify({ structure: { id: farm, name: `Ferme ${farm}` }, zones: [], plots: [], beds: [] });
}

/** Ce que les tables communes gardent d'un espace et de sa ferme : instantanés, raccordement, journal des appels. */
function writeSharedRows(sqlite: DatabaseSync, spaceKey: string, connectionOwner: string | null) {
  const { otfFarmId } = farmSpaceOf(spaceKey);
  const snapshot = sqlite.prepare('INSERT INTO otf_snapshots (cache_key, payload, last_successful_read_at, updated_at) VALUES (?, ?, ?, ?)');
  for (const key of [seasonSnapshotKey(spaceKey, 2025), seasonSnapshotKey(spaceKey, 2026), legacySnapshotKey(spaceKey)]) {
    snapshot.run(key, snapshotPayload(otfFarmId ?? 'inconnue'), '2026-11-19T06:00:00.000Z', '2026-11-19T06:00:00.000Z');
  }
  if (otfFarmId === null) return;
  sqlite.prepare('INSERT OR IGNORE INTO otf_call_starts (pace_key, started_at_ms, paris_day) VALUES (?, ?, ?)').run(otfFarmId, 1_763_600_000_000, '2026-11-20');
  sqlite.prepare('INSERT OR IGNORE INTO otf_daily_calls (pace_key, paris_day, calls) VALUES (?, ?, ?)').run(otfFarmId, '2026-11-20', 12);
  sqlite.prepare('INSERT OR IGNORE INTO otf_call_outcomes (pace_key, hour_start_ms, outcome, calls) VALUES (?, ?, ?, ?)').run(otfFarmId, 1_763_600_000_000, 'ok', 12);
  sqlite.prepare('INSERT OR IGNORE INTO otf_call_pauses (scope, paused_until_ms, reason) VALUES (?, ?, ?)').run(otfFarmId, 1_763_600_000_000, 'rate-limit');
  sqlite.prepare('INSERT OR IGNORE INTO otf_farm_reads (pace_key, lease_until_ms, last_complete_at) VALUES (?, ?, ?)').run(otfFarmId, 0, '2026-11-19T06:00:00.000Z');
  if (connectionOwner !== null) {
    sqlite.prepare(`INSERT OR IGNORE INTO otf_farm_connections
      (otf_farm_id, owner_user_id, farm_name, state, access_token_sealed, access_expires_at_ms, refresh_token_sealed, connected_at)
      VALUES (?, ?, ?, 'linked', 'jeton-scellé-accès', 1, 'jeton-scellé-renouvellement', '2026-11-18T08:00:00.000Z')`).run(otfFarmId, connectionOwner, `Ferme ${otfFarmId}`);
  }
}

/** Ce qui reste quoi qu'il arrive : les tâches, la veille, la ferme du déploiement, les refus du module, et une autre ferme. */
function writeKeptRows(sqlite: DatabaseSync) {
  sqlite.prepare(`INSERT INTO irrigation_background_jobs (job_key, last_successful_at, updated_at) VALUES ('task:weather-forecast', '2026-11-20T05:16:00.000Z', '2026-11-20T05:16:00.000Z')`).run();
  sqlite.prepare(`INSERT INTO irrigation_operator_notices (paris_day, kind, problems, claimed_at, sent_at) VALUES ('2026-11-20', 'alert', 1, '2026-11-20T08:00:00.000Z', '2026-11-20T08:00:01.000Z')`).run();
  sqlite.prepare(`INSERT INTO otf_deployment_farm (id, otf_farm_id, observed_at) VALUES (1, '7', '2026-11-20T06:00:00.000Z')`).run();
  sqlite.prepare('INSERT INTO otf_authentication_failures (failed_at_ms) VALUES (?)').run(1_763_600_000_000);
  writeSharedRows(sqlite, farmSpaceKey('carole', '99'), 'carole');
}

/** Toutes les lignes d'une table, rangées, pour comparer avant et après. */
function rowsOf(sqlite: DatabaseSync, table: string): string[] {
  return (sqlite.prepare(`SELECT * FROM "${table}"`).all() as Record<string, unknown>[]).map((row) => JSON.stringify(row)).sort();
}

/** Les lignes des tables communes qui doivent partir avec ALICE, selon les règles du plan (F643). */
function goesWithAlice(table: string, row: Record<string, unknown>): boolean {
  const alice = farmSpaceOf(ALICE).otfFarmId;
  const bob = farmSpaceOf(BOB).otfFarmId;
  if (table === 'otf_snapshots') {
    const key = String(row.cache_key);
    return key.startsWith(seasonSnapshotPrefix(ALICE)) || key === legacySnapshotKey(ALICE);
  }
  const rule = FARM_TABLES[table];
  // La ferme d'ALICE part avec elle quand BOB n'est pas sur la même ; sinon BOB a fait le raccordement, qui reste.
  return rule !== undefined && rule.rule !== 'space-snapshots' && alice !== null && alice !== bob && row[rule.column] === alice;
}

function sharedTables(): string[] {
  return [...Object.keys(FARM_TABLES), ...Object.keys(KEPT_TABLES)].filter((table) => table !== 'irrigation_farm_erasures');
}

async function twoFarms(): Promise<void> {
  aliceWorkspace = await populate(ALICE, 'A');
  bobWorkspace = await populate(BOB, 'B');
  fillEverySpaceTable(database.sqlite, [aliceWorkspace, bobWorkspace]);
  const sameFarm = farmSpaceOf(ALICE).otfFarmId !== null && farmSpaceOf(ALICE).otfFarmId === farmSpaceOf(BOB).otfFarmId;
  // Deux personnes sur une ferme : BOB a fait le raccordement, il reste à BOB.
  writeSharedRows(database.sqlite, BOB, farmSpaceOf(BOB).ownerUserId);
  writeSharedRows(database.sqlite, ALICE, sameFarm ? null : farmSpaceOf(ALICE).ownerUserId);
  writeKeptRows(database.sqlite);
}

/**
 * ALICE est l'espace sans ferme de la personne de BOB (passage
 * « rattachement ») : BOB lisait les instantanés d'ALICE avant d'avoir les
 * siens (F343). Quand ils partent, le déclencheur des instantanés fait
 * avancer le compteur de faisabilité de BOB : ce qu'il calculait sur eux est
 * tenu pour périmé. C'est le seul changement de BOB, et il est juste.
 */
const BOB_READ_ALICE_SNAPSHOTS = farmSpaceOf(ALICE).otfFarmId === null
  && farmSpaceOf(BOB).otfFarmId !== null
  && farmSpaceOf(ALICE).ownerUserId === farmSpaceOf(BOB).ownerUserId;

type Picture = { bob: ReturnType<typeof farmSummary>; counters: Record<string, number>; shared: Record<string, string[]> };

/** BOB, table par table, ses compteurs de révision, et les tables communes privées de ce qui doit partir avec ALICE. */
function picture(sqlite: DatabaseSync, withoutAlice: boolean): Picture {
  const shared = Object.fromEntries(sharedTables().map((table) => [table, (sqlite.prepare(`SELECT * FROM "${table}"`).all() as Record<string, unknown>[])
    .filter((row) => !withoutAlice || !goesWithAlice(table, row))
    .map((row) => JSON.stringify(row))
    .sort()]));
  const { feasibility_revision: feasibility, ...counters } = revisionCounters(sqlite, bobWorkspace);
  return {
    bob: farmSummary(sqlite, bobWorkspace, isRevisionCounter),
    counters: BOB_READ_ALICE_SNAPSHOTS ? counters : { ...counters, feasibility_revision: feasibility },
    shared,
  };
}

function assertAliceGone(sqlite: DatabaseSync) {
  const left = spaceTables(sqlite)
    .filter((table) => table !== 'irrigation_farm_erasures')
    .map((table) => ({ table, rows: spaceRowCount(sqlite, table, aliceWorkspace) }))
    .filter(({ rows }) => rows > 0);
  assert.deepEqual(left, [], 'aucune ligne d’ALICE ne subsiste');
  for (const table of sharedTables()) {
    const rows = (sqlite.prepare(`SELECT * FROM "${table}"`).all() as Record<string, unknown>[]).filter((row) => goesWithAlice(table, row));
    assert.deepEqual(rows, [], `${table} : rien d’ALICE`);
  }
}

test('preuve 2 : l’effacement d’ALICE, sept jours après sa demande, laisse BOB strictement inchangé', async () => {
  await twoFarms();
  for (const table of spaceTables(database.sqlite).filter((name) => name !== 'irrigation_farm_erasures')) {
    assert.ok(spaceRowCount(database.sqlite, table, aliceWorkspace) > 0, `${table} : ALICE y a des lignes avant`);
    assert.ok(spaceRowCount(database.sqlite, table, bobWorkspace) > 0, `${table} : BOB y a des lignes avant`);
  }
  const expected = picture(database.sqlite, true);
  const before = revisionCounters(database.sqlite, bobWorkspace);

  const request = await requestFarmErasure(ALICE, REQUESTED);
  assert.deepEqual(request && { state: request.state, requestedAt: request.requestedAt, eraseAfter: request.eraseAfter }, {
    state: 'pending', requestedAt: '2026-11-20T10:00:00.000Z', eraseAfter: '2026-11-27T10:00:00.000Z',
  });

  assert.deepEqual(await runDueFarmErasures({ now: SIX_DAYS_LATER, log: silent }), { due: 0, erased: 0, unfinished: 0, failures: [] });
  assert.ok(spaceRowCount(database.sqlite, 'irrigation_equipment', aliceWorkspace) > 0, 'rien n’est effacé pendant le délai');

  const lines: Record<string, unknown>[] = [];
  const report = await runDueFarmErasures({ now: FIRST_MORNING_AFTER, log: (_level, entry) => lines.push(entry) });
  assert.deepEqual(report, { due: 1, erased: 1, unfinished: 0, failures: [] });

  assertAliceGone(database.sqlite);
  assert.equal(await findWorkspaceIdForUser(ALICE), null, 'l’espace lui-même est effacé');
  const after = picture(database.sqlite, false);
  assert.deepEqual(after.bob.tables, expected.bob.tables, 'BOB, table par table : même nombre de lignes, même empreinte');
  assert.equal(after.bob.digest, expected.bob.digest);
  assert.deepEqual(after.counters, expected.counters, 'les compteurs de révision de BOB n’ont pas bougé');
  assert.deepEqual(after.shared, expected.shared, 'les tables communes n’ont perdu que ce qui était à ALICE');
  if (BOB_READ_ALICE_SNAPSHOTS) {
    assert.ok(revisionCounters(database.sqlite, bobWorkspace).feasibility_revision > before.feasibility_revision, 'BOB ne lit plus les instantanés d’ALICE : sa faisabilité est à refaire');
  }

  // Ce qui reste : la note minimale de la demande, ni nom, ni personne, ni ferme, ni contenu (F640).
  const notes = database.sqlite.prepare('SELECT * FROM irrigation_farm_erasures').all() as Record<string, unknown>[];
  assert.deepEqual(notes.map((note) => ({ ...note, id: typeof note.id })), [{
    id: 'string',
    workspace_id: aliceWorkspace,
    state: 'erased',
    requested_at: '2026-11-20T10:00:00.000Z',
    erase_after: '2026-11-27T10:00:00.000Z',
    cancelled_at: null,
    started_at: '2026-11-28T05:15:00.000Z',
    erased_at: notes[0].erased_at,
  }]);
  assert.match(String(notes[0].erased_at), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

  // Le journal : l'identifiant de la demande, des tables et des nombres, jamais une personne ni une ferme.
  assert.deepEqual([...new Set(lines.map((line) => line.event))], ['farm_erasure_step', 'farm_erasure_done']);
  const journal = JSON.stringify(lines);
  for (const value of [ALICE, BOB, farmSpaceOf(ALICE).ownerUserId, aliceWorkspace, 'Goutte-à-goutte']) assert.ok(!journal.includes(value), 'le journal ne nomme rien');

  // Une seconde fois : rien à faire, rien d'autre d'effacé.
  assert.deepEqual(await runDueFarmErasures({ now: new Date('2026-11-29T05:15:00.000Z'), log: silent }), { due: 0, erased: 0, unfinished: 0, failures: [] });
  assert.deepEqual(picture(database.sqlite, false), after);
});

test('preuve 3 : coupé à chaque borne, puis par une panne, l’effacement reprend sans rien oublier ni rien effacer d’autre', async () => {
  await twoFarms();
  const expected = picture(database.sqlite, true);
  await requestFarmErasure(ALICE, REQUESTED);

  // Des passages de quelques instructions seulement : l'effacement avance par morceaux, d'un passage à l'autre.
  let passes = 0;
  let morning = FIRST_MORNING_AFTER.getTime();
  for (;;) {
    passes += 1;
    const report = await runDueFarmErasures({ now: new Date(morning), budget: { statements: 9, milliseconds: 60_000 }, log: silent });
    assert.deepEqual(report.failures, []);
    const now = picture(database.sqlite, false);
    assert.deepEqual({ bob: now.bob, counters: now.counters }, { bob: expected.bob, counters: expected.counters }, `passage ${passes} : BOB n’a pas bougé`);
    if (report.erased === 1) break;
    assert.deepEqual(report, { due: 1, erased: 0, unfinished: 1, failures: [] });
    assert.equal((await listErasingFarmErasures()).length, 1, 'toujours « en cours », jamais notée faite à moitié');
    assert.ok(await findWorkspaceIdForUser(ALICE), 'l’espace reste tant que tout n’est pas effacé');
    morning += 3_600_000;
    assert.ok(passes < 200, 'l’effacement finit');
  }
  assert.ok(passes > 5, `coupé plusieurs fois (${passes} passages)`);
  assertAliceGone(database.sqlite);
  assert.deepEqual(picture(database.sqlite, false), expected);
});

test('preuve 3 : une panne au milieu laisse l’effacement « en cours », et le passage suivant le finit', async () => {
  await twoFarms();
  const expected = picture(database.sqlite, true);
  await requestFarmErasure(ALICE, REQUESTED);

  let deletes = 0;
  overrideDatabase(new Proxy(database.d1, {
    get(target, property) {
      if (property !== 'prepare') return Reflect.get(target, property, target);
      return (query: string) => {
        const statement = target.prepare(query);
        if (!query.startsWith('DELETE') || ++deletes !== 30) return statement;
        return { bind: () => ({ run: async () => { throw new Error('D1_ERROR: panne simulée'); } }) } as unknown as D1PreparedStatement;
      };
    },
  }));
  const lines: Record<string, unknown>[] = [];
  let report;
  try {
    report = await runDueFarmErasures({ now: FIRST_MORNING_AFTER, log: (_level, entry) => lines.push(entry) });
  } finally {
    overrideDatabase(database.d1);
  }
  assert.deepEqual(report, { due: 1, erased: 0, unfinished: 0, failures: ['Error'] });
  assert.deepEqual(lines.filter((line) => line.event === 'farm_erasure_failed').map((line) => line.error), ['Error']);
  assert.ok(!JSON.stringify(lines).includes('panne simulée'), 'le message de la base n’est pas recopié');
  assert.equal((await listErasingFarmErasures()).length, 1);
  assert.deepEqual(picture(database.sqlite, false).bob, expected.bob);
  assert.deepEqual(picture(database.sqlite, false).counters, expected.counters);

  assert.deepEqual(await runDueFarmErasures({ now: new Date('2026-11-28T06:15:00.000Z'), log: silent }), { due: 1, erased: 1, unfinished: 0, failures: [] });
  assertAliceGone(database.sqlite);
  assert.deepEqual(picture(database.sqlite, false), expected);
});

test('jamais faite à moitié : une ligne écrite pendant l’effacement fait refuser la fin, qui reprend au passage suivant', async () => {
  aliceWorkspace = await populate(ALICE, 'A');
  bobWorkspace = await populate(BOB, 'B');
  await requestFarmErasure(ALICE, REQUESTED);
  // Tout ce que l'espace garde est effacé, lot par lot, sauf l'espace lui-même.
  await startDueFarmErasures(FIRST_MORNING_AFTER.toISOString());
  const [erasing] = await listErasingFarmErasures();
  const space = await readErasedSpace(erasing.workspaceId);
  assert.ok(space);
  for (const batch of farmErasureBatches(space)) while (await runErasureBatch(batch, FARM_ERASURE_BATCH_ROWS) === FARM_ERASURE_BATCH_ROWS);
  // Une irrigation arrive tard, pendant l'effacement.
  const fixture = await createDripFixture(ALICE, { name: 'Arrivé tard', beds: ['planche-tard'] });
  await createIrrigationEventForUser(ALICE, completedDraft(fixture, { startAt: '2026-06-09T06:00:00.000Z', endAt: '2026-06-09T06:45:00.000Z', durationSeconds: 2700 }));
  await assert.rejects(finishFarmErasure(erasing, '2026-11-28T05:16:00.000Z'), /FOREIGN KEY constraint failed/);
  assert.ok(await findWorkspaceIdForUser(ALICE), 'rien n’est écrit : l’espace reste');
  assert.equal((await listErasingFarmErasures()).length, 1, 'la demande reste « en cours »');

  assert.deepEqual(await runDueFarmErasures({ now: new Date('2026-11-28T06:15:00.000Z'), log: silent }), { due: 1, erased: 1, unfinished: 0, failures: [] });
  assertAliceGone(database.sqlite);
});

test('preuve 4 : annulée pendant les sept jours, la demande n’efface rien, et une nouvelle demande reste possible', async () => {
  aliceWorkspace = await populate(ALICE, 'A');
  bobWorkspace = await populate(BOB, 'B');
  const before = farmSummary(database.sqlite, aliceWorkspace);
  const first = await requestFarmErasure(ALICE, REQUESTED);
  assert.deepEqual(await requestFarmErasure(ALICE, new Date('2026-11-21T10:00:00.000Z')), first, 'une seconde demande ne repousse rien');
  assert.deepEqual(await readOpenFarmErasure(ALICE), first);
  assert.equal(await readOpenFarmErasure(BOB), null);

  assert.equal(await cancelFarmErasure(ALICE, new Date('2026-11-23T10:00:00.000Z')), true);
  assert.equal(await cancelFarmErasure(ALICE, new Date('2026-11-23T10:01:00.000Z')), false, 'plus rien à annuler');
  assert.equal(await readOpenFarmErasure(ALICE), null);
  assert.deepEqual(await runDueFarmErasures({ now: FIRST_MORNING_AFTER, log: silent }), { due: 0, erased: 0, unfinished: 0, failures: [] });
  const withoutNote = (summary: typeof before) => summary.tables.filter((table) => table.name !== 'irrigation_farm_erasures');
  assert.deepEqual(withoutNote(farmSummary(database.sqlite, aliceWorkspace)), withoutNote(before), 'ALICE est intacte');
  assert.deepEqual(
    { ...(database.sqlite.prepare('SELECT state, cancelled_at, started_at, erased_at FROM irrigation_farm_erasures').get() as object) },
    { state: 'cancelled', cancelled_at: '2026-11-23T10:00:00.000Z', started_at: null, erased_at: null },
  );

  const second = await requestFarmErasure(ALICE, new Date('2026-11-29T10:00:00.000Z'));
  assert.ok(second && second.id !== first?.id && second.eraseAfter === '2026-12-06T10:00:00.000Z');
  assert.deepEqual(await runDueFarmErasures({ now: new Date('2026-12-07T05:15:00.000Z'), log: silent }), { due: 1, erased: 1, unfinished: 0, failures: [] });
  assert.equal(await cancelFarmErasure(ALICE, new Date('2026-12-07T06:00:00.000Z')), false, 'l’espace n’existe plus');
  assert.equal(await requestFarmErasure(ALICE, new Date('2026-12-07T06:00:00.000Z')), null);
});

test('commencé, l’effacement ne s’annule plus', async () => {
  aliceWorkspace = await populate(ALICE, 'A');
  await requestFarmErasure(ALICE, REQUESTED);
  await runDueFarmErasures({ now: FIRST_MORNING_AFTER, budget: { statements: 3, milliseconds: 60_000 }, log: silent });
  assert.equal((await readOpenFarmErasure(ALICE))?.state, 'erasing');
  assert.equal(await cancelFarmErasure(ALICE, FIRST_MORNING_AFTER), false);
});

test('pendant le délai et l’effacement, l’espace est figé : les traitements du matin le sautent', async () => {
  aliceWorkspace = await populate(ALICE, 'A');
  bobWorkspace = await populate(BOB, 'B');
  const farms = async () => (await listFarmsWithSelection(() => true)).map((farm) => farm.workspaceId).sort();
  assert.deepEqual(await farms(), [aliceWorkspace, bobWorkspace].sort());
  await requestFarmErasure(ALICE, REQUESTED);
  assert.deepEqual(await farms(), [bobWorkspace]);
  await cancelFarmErasure(ALICE, SIX_DAYS_LATER);
  assert.deepEqual(await farms(), [aliceWorkspace, bobWorkspace].sort(), 'annulée, la ferme repart');
});

test('hors d’un effacement en cours, les tables qui ne s’effacent pas refusent toujours qu’on y efface', async () => {
  aliceWorkspace = await populate(ALICE, 'A');
  bobWorkspace = await populate(BOB, 'B');
  fillEverySpaceTable(database.sqlite, [aliceWorkspace, bobWorkspace], 1);
  // Dans l'ordre du plan : les filles d'abord.
  const order = SPACE_TABLES.map(({ table }) => table);
  const immutable = (database.sqlite.prepare("SELECT tbl_name AS name FROM sqlite_schema WHERE type = 'trigger' AND name LIKE '%no_delete'").all() as { name: string }[])
    .map(({ name }) => name)
    .sort((left, right) => order.indexOf(left) - order.indexOf(right));
  assert.equal(immutable.length, 12);
  const deleteOne = (table: string, workspaceId: string) => {
    const condition = table === 'irrigation_soil_rooting_stages'
      ? 'profile_id IN (SELECT id FROM irrigation_soil_rooting_profiles WHERE workspace_id = ?)'
      : 'workspace_id = ?';
    return () => database.sqlite.prepare(`DELETE FROM "${table}" WHERE ${condition}`).run(workspaceId);
  };
  await requestFarmErasure(ALICE, REQUESTED);
  for (const table of immutable) assert.throws(deleteOne(table, aliceWorkspace), /IMMUTABLE/, `${table} : en attente, rien ne s’efface`);
  database.sqlite.prepare(`UPDATE irrigation_farm_erasures SET state = 'erasing', started_at = ? WHERE workspace_id = ?`).run(FIRST_MORNING_AFTER.toISOString(), aliceWorkspace);
  for (const table of immutable) assert.throws(deleteOne(table, bobWorkspace), /IMMUTABLE/, `${table} : BOB n’est pas effacé`);
  for (const table of immutable) assert.doesNotThrow(deleteOne(table, aliceWorkspace), `${table} : ALICE s’efface`);
});

test('le raccordement part avec la personne qui l’a fait ; le journal des appels reste tant qu’un autre espace garde la ferme', async () => {
  const erin = farmSpaceKey('erin', '5');
  const fred = farmSpaceKey('fred', '5');
  await ensureWorkspaceForUser(erin);
  await ensureWorkspaceForUser(fred);
  writeSharedRows(database.sqlite, erin, 'fred');
  writeSharedRows(database.sqlite, fred, null);
  const count = (table: string, column: string) => Number((database.sqlite.prepare(`SELECT COUNT(*) AS n FROM "${table}" WHERE "${column}" = '5'`).get() as { n: number }).n);

  await requestFarmErasure(erin, REQUESTED);
  await runDueFarmErasures({ now: FIRST_MORNING_AFTER, log: silent });
  assert.equal(count('otf_farm_connections', 'otf_farm_id'), 1, 'fait par fred, le raccordement reste à fred');
  assert.equal(count('otf_daily_calls', 'pace_key'), 1, 'fred garde la ferme : son journal reste');

  database.sqlite.prepare("UPDATE otf_farm_connections SET owner_user_id = 'erin' WHERE otf_farm_id = '5'").run();
  const gina = farmSpaceKey('gina', '5');
  await ensureWorkspaceForUser(gina);
  await requestFarmErasure(gina, REQUESTED);
  database.sqlite.prepare("UPDATE otf_farm_connections SET owner_user_id = 'gina' WHERE otf_farm_id = '5'").run();
  await runDueFarmErasures({ now: FIRST_MORNING_AFTER, log: silent });
  assert.equal(count('otf_farm_connections', 'otf_farm_id'), 0, 'fait par gina, il part avec elle, jetons compris');
  assert.equal(count('otf_daily_calls', 'pace_key'), 1, 'fred garde encore la ferme');

  await requestFarmErasure(fred, REQUESTED);
  await runDueFarmErasures({ now: FIRST_MORNING_AFTER, log: silent });
  for (const [table, { column }] of Object.entries(FARM_TABLES).filter(([, { rule }]) => rule === 'farm-calls')) {
    assert.equal(count(table, column), 0, `${table} : le dernier espace de la ferme parti, son journal part`);
  }
});

test('les instantanés d’avant le rattachement, gardés sous la personne seule, partent avec son espace de la même ferme', async () => {
  const hugo = farmSpaceKey('hugo', '6');
  await ensureWorkspaceForUser(hugo);
  const write = database.sqlite.prepare('INSERT INTO otf_snapshots (cache_key, payload, last_successful_read_at, updated_at) VALUES (?, ?, ?, ?)');
  write.run(seasonSnapshotKey('hugo', 2025), snapshotPayload('6'), '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
  write.run(legacySnapshotKey('hugo'), snapshotPayload('6'), '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
  write.run(seasonSnapshotKey('hugo', 2026), snapshotPayload('9'), '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
  write.run(seasonSnapshotKey('hugo', 2024), 'illisible', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
  await requestFarmErasure(hugo, REQUESTED);
  assert.deepEqual(await runDueFarmErasures({ now: FIRST_MORNING_AFTER, log: silent }), { due: 1, erased: 1, unfinished: 0, failures: [] });
  assert.deepEqual(rowsOf(database.sqlite, 'otf_snapshots').map((row) => JSON.parse(row).cache_key).sort(), [
    seasonSnapshotKey('hugo', 2024),
    seasonSnapshotKey('hugo', 2026),
  ], 'ceux d’une autre ferme, ou illisibles, restent');

  const ines = farmSpaceKey('ines', '6');
  await ensureWorkspaceForUser(ines);
  await ensureWorkspaceForUser('ines');
  write.run(seasonSnapshotKey('ines', 2025), snapshotPayload('6'), '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
  await requestFarmErasure(ines, REQUESTED);
  await runDueFarmErasures({ now: FIRST_MORNING_AFTER, log: silent });
  assert.ok(rowsOf(database.sqlite, 'otf_snapshots').some((row) => JSON.parse(row).cache_key === seasonSnapshotKey('ines', 2025)), 'son espace sans ferme les garde');
});

test('les clés des instantanés sont celles que le service lit', async () => {
  const space = farmSpaceKey('jade', '4');
  const snapshot = (season: number): IrrigationSnapshot => ({
    configuration: { seasonFirst: 2025, seasonLast: 2026 },
    structure: { id: '4', name: 'Ferme', legalCity: 'Rennes', legalPostcode: '35000', legalCountry: 'FR' },
    zones: [{ id: '14', name: 'Zone', area: 100, seasons: [season] }],
    plots: [],
    beds: [],
    source: 'live',
    lastSuccessfulReadAt: `${season}-06-15T07:59:00.000Z`,
  });
  await saveCachedSnapshot(seasonSnapshotKey(space, 2025), snapshot(2025));
  assert.equal((await readLatestCachedSnapshotOfSpace(space))?.lastSuccessfulReadAt, '2025-06-15T07:59:00.000Z');
  await saveCachedSnapshot(legacySnapshotKey(space), snapshot(2026));
  assert.equal((await readLatestCachedSnapshotOfSpace(space))?.lastSuccessfulReadAt, '2026-06-15T07:59:00.000Z');
});

test('preuve 5 : la page d’état compte les demandes, et dit la dernière faite', async () => {
  const counts = () => readFarmErasureCounts(FIRST_MORNING_AFTER);
  assert.deepEqual(farmErasureLine(await counts()), { tone: 'ok', text: 'Aucune demande d’effacement.' });
  for (const person of ['kim', 'lou', 'max']) await ensureWorkspaceForUser(farmSpaceKey(person, '3'));
  await requestFarmErasure(farmSpaceKey('kim', '3'), REQUESTED);
  await requestFarmErasure(farmSpaceKey('lou', '3'), REQUESTED);
  await requestFarmErasure(farmSpaceKey('max', '3'), new Date('2026-11-27T12:00:00.000Z'));
  assert.deepEqual(await counts(), { waiting: 1, due: 2, erased: 0, lastErasedAt: null });
  assert.deepEqual(farmErasureLine(await counts()), { tone: 'warn', text: 'Demandes d’effacement : 1 en attente, 2 à effacer, aucune faite.' });
  await runDueFarmErasures({ now: FIRST_MORNING_AFTER, clock: () => Date.parse('2026-11-28T05:16:00.000Z'), log: silent });
  assert.deepEqual(await counts(), { waiting: 1, due: 0, erased: 2, lastErasedAt: '2026-11-28T05:16:00.000Z' });
  assert.deepEqual(farmErasureLine(await counts()), { tone: 'ok', text: 'Demandes d’effacement : 1 en attente, 2 faites ; dernière faite le 28/11 à 6 h 16.' });
});
