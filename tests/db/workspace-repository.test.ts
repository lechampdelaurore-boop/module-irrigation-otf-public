import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { db } from '../../db/binding';
import {
  createWorkspaceIfAbsent,
  ensureWorkspaceForUser,
  findWorkspaceIdForUser,
  hydraulicRevisionStatement,
  listWorkspaceOwnerIds,
  readHydraulicRevisionForUser,
  readWaterBudgetRevisionForUser,
  waterBudgetRevisionStatement,
} from '../../db/workspace-repository';
import { readWorkspaceOwner } from '../../db/crop-alerts/inputs';
import { farmSpaceKey, InvalidFarmSpaceError } from '../../lib/domain/farm-space';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

test('un propriétaire sans espace n’en a pas ; ensure en crée un seul, réutilisé ensuite', async () => {
  assert.equal(await findWorkspaceIdForUser('alice'), null);
  const created = await ensureWorkspaceForUser('alice');
  assert.match(created, /^[0-9a-f-]{36}$/);
  assert.equal(await ensureWorkspaceForUser('alice'), created);
  assert.equal(await findWorkspaceIdForUser('alice'), created);
  const rows = database.sqlite.prepare('SELECT owner_user_id, otf_farm_id FROM irrigation_workspaces').all();
  assert.deepEqual(rows.map((row) => ({ ...row })), [{ owner_user_id: 'alice', otf_farm_id: null }]);
});

test('deux propriétaires obtiennent deux espaces distincts et ne voient pas celui de l’autre', async () => {
  const alice = await ensureWorkspaceForUser('alice');
  const bob = await ensureWorkspaceForUser('bob');
  assert.notEqual(alice, bob);
  assert.equal(await findWorkspaceIdForUser('alice'), alice);
  assert.equal(await findWorkspaceIdForUser('bob'), bob);
});

test('un espace déjà rattaché à une ferme OTF n’est pas l’espace « en attente » du propriétaire', async () => {
  database.sqlite.prepare("INSERT INTO irrigation_workspaces (id, owner_user_id, otf_farm_id) VALUES ('ws-ferme', 'alice', 42)").run();
  assert.equal(await findWorkspaceIdForUser('alice'), null);
  const pending = await ensureWorkspaceForUser('alice');
  assert.notEqual(pending, 'ws-ferme');
});

test('la révision du budget d’eau part de zéro et avance par instruction de lot', async () => {
  assert.equal(await readWaterBudgetRevisionForUser('alice'), 0);
  await db.batch([waterBudgetRevisionStatement('alice')]);
  assert.equal(await readWaterBudgetRevisionForUser('alice'), 1);
  await db.batch([waterBudgetRevisionStatement('alice', 1)]);
  assert.equal(await readWaterBudgetRevisionForUser('alice'), 2);
  assert.equal(await readWaterBudgetRevisionForUser('bob'), 0, 'la révision d’un autre propriétaire ne bouge pas');
});

test('la révision hydraulique est indépendante de celle du budget d’eau', async () => {
  await ensureWorkspaceForUser('alice');
  assert.equal(await readHydraulicRevisionForUser('alice'), 0);
  await db.batch([hydraulicRevisionStatement('alice'), hydraulicRevisionStatement('alice', 1)]);
  assert.equal(await readHydraulicRevisionForUser('alice'), 2);
  assert.equal(await readWaterBudgetRevisionForUser('alice'), 0);
});

test('une instruction de révision échouée annule tout le lot', async () => {
  const workspaceId = await ensureWorkspaceForUser('alice');
  await assert.rejects(
    db.batch([
      waterBudgetRevisionStatement('alice'),
      db.prepare('INSERT INTO irrigation_workspaces (id, owner_user_id) VALUES (?, ?)').bind(workspaceId, 'doublon'),
    ]),
    /UNIQUE constraint failed/,
  );
  assert.equal(await readWaterBudgetRevisionForUser('alice'), 0);
});

// La clé d'espace (4.2, docs/tranche-4-contract.md, section 5 bis, F327 et F328).

test('un espace par personne et par ferme : la clé de ferme crée sa ligne, sans toucher l’espace sans ferme ni la même ferme d’une autre personne', async () => {
  const pending = await ensureWorkspaceForUser('alice');
  const farm7 = await ensureWorkspaceForUser(farmSpaceKey('alice', '7'));
  const farm8 = await ensureWorkspaceForUser(farmSpaceKey('alice', '8'));
  const bobFarm7 = await ensureWorkspaceForUser(farmSpaceKey('bob', '7'));
  assert.equal(new Set([pending, farm7, farm8, bobFarm7]).size, 4);
  assert.equal(await findWorkspaceIdForUser(farmSpaceKey('alice', '7')), farm7);
  assert.equal(await findWorkspaceIdForUser(farmSpaceKey('alice', '9')), null);
  assert.equal(await findWorkspaceIdForUser('alice'), pending);
  assert.equal(await ensureWorkspaceForUser(farmSpaceKey('alice', '7')), farm7, 'réutilisé ensuite');
  const rows = database.sqlite.prepare('SELECT id, owner_user_id, otf_farm_id FROM irrigation_workspaces ORDER BY owner_user_id, otf_farm_id').all();
  assert.deepEqual(rows.map((row) => ({ ...row })), [
    { id: pending, owner_user_id: 'alice', otf_farm_id: null },
    { id: farm7, owner_user_id: 'alice', otf_farm_id: '7' },
    { id: farm8, owner_user_id: 'alice', otf_farm_id: '8' },
    { id: bobFarm7, owner_user_id: 'bob', otf_farm_id: '7' },
  ], 'la base garde la personne seule dans `owner_user_id` et la ferme à part');
});

test('création simultanée d’un espace de ferme : une seule ligne, un seul appel l’apprend', async () => {
  const key = farmSpaceKey('alice', '7');
  const [first, second] = await Promise.all([createWorkspaceIfAbsent(key), createWorkspaceIfAbsent(key)]);
  assert.deepEqual([first, second].sort(), [false, true]);
  assert.equal((database.sqlite.prepare('SELECT COUNT(*) AS n FROM irrigation_workspaces').get() as { n: number }).n, 1);
});

test('les révisions avancent dans l’espace de la ferme seul', async () => {
  const farm7 = farmSpaceKey('alice', '7');
  const farm8 = farmSpaceKey('alice', '8');
  await ensureWorkspaceForUser(farm7);
  await ensureWorkspaceForUser(farm8);
  await ensureWorkspaceForUser('alice');
  await db.batch([waterBudgetRevisionStatement(farm7), hydraulicRevisionStatement(farm7)]);
  assert.equal(await readWaterBudgetRevisionForUser(farm7), 1);
  assert.equal(await readHydraulicRevisionForUser(farm7), 1);
  assert.equal(await readWaterBudgetRevisionForUser(farm8), 0, 'l’autre ferme de la même personne ne bouge pas');
  assert.equal(await readWaterBudgetRevisionForUser('alice'), 0, 'l’espace sans ferme ne bouge pas');
});

test('les traitements d’arrière-plan reçoivent chaque espace sous sa clé, avec ou sans ferme', async () => {
  const farm7 = await ensureWorkspaceForUser(farmSpaceKey('alice', '7'));
  await ensureWorkspaceForUser('carol');
  await ensureWorkspaceForUser(farmSpaceKey('bob', '7'));
  assert.deepEqual(await listWorkspaceOwnerIds(), [farmSpaceKey('alice', '7'), farmSpaceKey('bob', '7'), 'carol']);
  assert.equal(await readWorkspaceOwner(farm7), farmSpaceKey('alice', '7'));
  assert.equal(await readWorkspaceOwner('absent'), null);
});

test('une clé d’espace mal formée est refusée avant toute lecture', async () => {
  await assert.rejects(findWorkspaceIdForUser('alice·ferme·7/8'), InvalidFarmSpaceError);
  await assert.rejects(ensureWorkspaceForUser('alice·ferme·'), InvalidFarmSpaceError);
  assert.equal((database.sqlite.prepare('SELECT COUNT(*) AS n FROM irrigation_workspaces').get() as { n: number }).n, 0);
});
