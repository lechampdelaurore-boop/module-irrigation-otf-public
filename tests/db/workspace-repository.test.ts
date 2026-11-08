import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { db } from '../../db/binding';
import {
  ensureWorkspaceForUser,
  findWorkspaceIdForUser,
  hydraulicRevisionStatement,
  readHydraulicRevisionForUser,
  readWaterBudgetRevisionForUser,
  waterBudgetRevisionStatement,
} from '../../db/workspace-repository';
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
