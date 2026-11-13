import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { demoOwnerUserId, resolveDemoChoice } from '../../lib/domain/demo/catalogue';
import { prepareDemoSpace } from '../../lib/services/demo-space';
import { saveFeatureSelectionForUser } from '../../db/feature-selection-repository';
import { getFeatureSelectionForUser } from '../../lib/services/feature-selection-service';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';

/**
 * L'espace d'un invité de la démonstration (docs/demo-guided-contract.md,
 * sections 5 et 6) : préparé à sa première ouverture avec les cases de la
 * ferme fictive, jamais réécrit ensuite ; la ferme vierge s'ouvre sur la
 * liste à cocher ; hors démonstration, rien ne se prépare.
 */

let database: TestDatabase;
const savedDemoMode = process.env.DEMO_MODE;
beforeEach(() => {
  database = installTestDatabase();
  process.env.DEMO_MODE = 'true';
});
afterEach(() => {
  database.dispose();
  if (savedDemoMode === undefined) delete process.env.DEMO_MODE;
  else process.env.DEMO_MODE = savedDemoMode;
});

test('un espace de démonstration s’ouvre avec les cases que sa ferme coche d’avance', async () => {
  const choice = resolveDemoChoice('petite-ferme', 'penurie');
  const owner = demoOwnerUserId('invite-a', choice);
  await prepareDemoSpace(owner, choice);
  const selection = await getFeatureSelectionForUser(owner);
  assert.equal(selection.firstVisit, false);
  assert.deepEqual([...selection.enabled].sort(), [...choice.profile.features].sort());
});

test('les essais de l’invité restent : un espace déjà ouvert n’est pas réécrit', async () => {
  const choice = resolveDemoChoice('maraichage', 'ete');
  const owner = demoOwnerUserId('invite-a', choice);
  await prepareDemoSpace(owner, choice);
  await saveFeatureSelectionForUser(owner, ['materiel'], new Date('2026-06-16T08:00:00.000Z'));
  await prepareDemoSpace(owner, choice);
  assert.deepEqual((await getFeatureSelectionForUser(owner)).enabled, ['materiel']);
});

test('la ferme vierge s’ouvre sur la liste à cocher, comme une ferme qui n’a jamais ouvert le module', async () => {
  const choice = resolveDemoChoice('vierge', 'ete');
  const owner = demoOwnerUserId('invite-a', choice);
  await prepareDemoSpace(owner, choice);
  assert.equal((await getFeatureSelectionForUser(owner)).firstVisit, true);
});

test('hors démonstration, aucun espace ne se prépare', async () => {
  delete process.env.DEMO_MODE;
  const choice = resolveDemoChoice('maraichage', 'ete');
  const owner = demoOwnerUserId('invite-a', choice);
  await assert.rejects(prepareDemoSpace(owner, choice), /qu’en démonstration/);
  assert.equal((await getFeatureSelectionForUser(owner)).firstVisit, true);
});
