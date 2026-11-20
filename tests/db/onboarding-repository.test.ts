import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { readOnboardingStepsForUser } from '../../db/onboarding-repository';
import { ensureWorkspaceForUser, findWorkspaceIdForUser } from '../../db/workspace-repository';
import { getOnboardingForUser } from '../../lib/services/onboarding-service';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { ALICE, BOB } from '../support/spaces';

// L'état de l'accueil d'une ferme, dans la base (4.4, docs/tranche-4-contract.md, F417, F426, F581 ; preuve 3 de la section 8 bis.6).

let database: TestDatabase;
const savedDemoMode = process.env.DEMO_MODE;
beforeEach(() => {
  database = installTestDatabase();
  delete process.env.DEMO_MODE;
});
afterEach(() => {
  database.dispose();
  if (savedDemoMode === undefined) delete process.env.DEMO_MODE;
  else process.env.DEMO_MODE = savedDemoMode;
});

const AT = '2026-11-20T09:00:00.000Z';

function insertStep(workspaceId: string, step: string, state: string, origin: string, confirmedAt: string | null) {
  database.sqlite.prepare(
    'INSERT INTO irrigation_onboarding_steps (workspace_id, step, state, origin, proposed_value, confirmed_at, updated_at) VALUES (?, ?, ?, ?, NULL, ?, ?)',
  ).run(workspaceId, step, state, origin, confirmedAt, AT);
}

test('un espace créé après la migration commence l’accueil : aucune ligne, chaque étape à faire', async () => {
  await ensureWorkspaceForUser(ALICE);
  assert.deepEqual(await readOnboardingStepsForUser(ALICE), []);
  const resolved = await getOnboardingForUser(ALICE);
  assert.equal(resolved.kind, 'onboarding');
  assert.equal(resolved.kind === 'onboarding' ? resolved.remaining.length : null, 5);
});

test('lire l’accueil ne crée pas d’espace', async () => {
  assert.deepEqual(await readOnboardingStepsForUser(ALICE), []);
  assert.equal(await findWorkspaceIdForUser(ALICE), null);
});

test('l’accueil d’Alice n’est jamais lu pour Bob, ni l’inverse (isolation des fermes et des personnes)', async () => {
  const alice = await ensureWorkspaceForUser(ALICE);
  const bob = await ensureWorkspaceForUser(BOB);
  for (const step of ['location', 'plots', 'soil', 'crops', 'settings']) insertStep(alice, step, 'confirmed', 'before-onboarding', AT);
  insertStep(bob, 'soil', 'skipped', 'onboarding', null);

  assert.equal((await getOnboardingForUser(ALICE)).kind, 'before-onboarding');
  assert.deepEqual(await readOnboardingStepsForUser(BOB), [{ step: 'soil', state: 'skipped', origin: 'onboarding', confirmedAt: null }]);
  const bobResolved = await getOnboardingForUser(BOB);
  assert.equal(bobResolved.kind, 'onboarding');
  assert.deepEqual(bobResolved.kind === 'onboarding' ? bobResolved.remaining.map((step) => step.id) : null, ['location', 'plots', 'crops', 'settings']);
});

test('la base refuse une étape inconnue, un état inconnu, un « avant l’accueil » non confirmé et une confirmation sans date', async () => {
  const workspace = await ensureWorkspaceForUser(ALICE);
  assert.throws(() => insertStep(workspace, 'meteo', 'todo', 'onboarding', null), /CHECK constraint failed/);
  assert.throws(() => insertStep(workspace, 'soil', 'valide', 'onboarding', null), /CHECK constraint failed/);
  assert.throws(() => insertStep(workspace, 'soil', 'todo', 'before-onboarding', null), /CHECK constraint failed/, 'un espace d’avant la 4.4 n’a que des étapes confirmées');
  assert.throws(() => insertStep(workspace, 'soil', 'confirmed', 'onboarding', null), /CHECK constraint failed/, 'confirmé porte sa date');
  assert.throws(() => insertStep(workspace, 'soil', 'skipped', 'onboarding', AT), /CHECK constraint failed/, 'seul le confirmé porte une date de confirmation');
  assert.throws(() => insertStep('espace-absent', 'soil', 'todo', 'onboarding', null), /FOREIGN KEY constraint failed/);
  assert.throws(
    () => database.sqlite.prepare(
      "INSERT INTO irrigation_onboarding_steps (workspace_id, step, state, origin, proposed_value, confirmed_at, updated_at) VALUES (?, 'soil', 'proposed', 'onboarding', 'pas du JSON', NULL, ?)",
    ).run(workspace, AT),
    /CHECK constraint failed/,
    'la valeur proposée gardée est du JSON',
  );
  insertStep(workspace, 'soil', 'todo', 'onboarding', null);
  assert.throws(() => insertStep(workspace, 'soil', 'skipped', 'onboarding', null), /UNIQUE|PRIMARY KEY/, 'une ligne par étape');
});

test('en démonstration, pas d’accueil : les fermes fictives sont déjà réglées', async () => {
  process.env.DEMO_MODE = 'true';
  await ensureWorkspaceForUser(ALICE);
  assert.deepEqual(await getOnboardingForUser(ALICE), { kind: 'demonstration' });
});
