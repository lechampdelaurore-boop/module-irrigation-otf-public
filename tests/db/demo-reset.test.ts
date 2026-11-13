import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { saveFeatureSelectionForUser } from '../../db/feature-selection-repository';
import { findWorkspaceIdForUser } from '../../db/workspace-repository';
import { demoOwnerUserId, resolveDemoChoice } from '../../lib/domain/demo/catalogue';
import { DemoResetRefusedError, recordDemoVisit, resetDemoSpace, resetInactiveDemoSpaces } from '../../lib/services/demo-reset';
import { prepareDemoSpace } from '../../lib/services/demo-space';
import { getFeatureSelectionForUser } from '../../lib/services/feature-selection-service';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';

/**
 * La remise à zéro de la démonstration (docs/demo-guided-contract.md,
 * section 8 ; D4) : le bouton rend à l'espace de l'invité, pour la ferme et
 * le moment ouverts, son premier jour ; la tâche de nuit fait de même pour
 * les espaces où personne n'est passé depuis plus de 24 heures. Rien n'est
 * effacé : l'espace mis de côté n'est plus celui de personne. Les autres
 * espaces ne bougent pas, et rien ne se fait hors démonstration.
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

const ETE = resolveDemoChoice('maraichage', 'ete');
const PENURIE = resolveDemoChoice('maraichage', 'penurie');

function owners(): string[] {
  return (database.sqlite.prepare('SELECT owner_user_id FROM irrigation_workspaces ORDER BY owner_user_id').all() as { owner_user_id: string }[])
    .map((row) => row.owner_user_id);
}

function setLastVisit(ownerUserId: string, modifier: string): void {
  database.sqlite.prepare(`UPDATE irrigation_workspaces SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?) WHERE owner_user_id = ?`)
    .run(modifier, ownerUserId);
}

function lastVisit(ownerUserId: string): string {
  return (database.sqlite.prepare('SELECT updated_at FROM irrigation_workspaces WHERE owner_user_id = ?').get(ownerUserId) as { updated_at: string }).updated_at;
}

test('« Remettre à zéro » rend à l’espace son premier jour, sans toucher aux autres', async () => {
  const mine = demoOwnerUserId('invite-a', ETE);
  const otherMoment = demoOwnerUserId('invite-a', PENURIE);
  const otherGuest = demoOwnerUserId('invite-b', ETE);
  for (const [owner, choice] of [[mine, ETE], [otherMoment, PENURIE], [otherGuest, ETE]] as const) await prepareDemoSpace(owner, choice);
  const before = await findWorkspaceIdForUser(mine);
  await saveFeatureSelectionForUser(mine, ['materiel'], new Date('2026-06-16T08:00:00.000Z'));
  await saveFeatureSelectionForUser(otherGuest, ['materiel'], new Date('2026-06-16T08:00:00.000Z'));

  await resetDemoSpace(mine);

  const after = await findWorkspaceIdForUser(mine);
  assert.ok(after && after !== before, 'un espace neuf');
  assert.deepEqual([...(await getFeatureSelectionForUser(mine)).enabled].sort(), [...ETE.profile.features].sort());
  // Les essais de l'autre invité restent ; l'autre moment n'a pas bougé.
  assert.deepEqual((await getFeatureSelectionForUser(otherGuest)).enabled, ['materiel']);
  assert.ok(await findWorkspaceIdForUser(otherMoment));
  // L'ancien espace est mis de côté, pas effacé : il n'est plus celui de personne.
  const archived = owners().filter((owner) => owner.startsWith(`${mine}·archive·`));
  assert.equal(archived.length, 1);
  assert.equal(owners().length, 4);
  const archivedWorkspace = database.sqlite.prepare('SELECT id FROM irrigation_workspaces WHERE owner_user_id = ?').get(archived[0]) as { id: string };
  assert.equal(archivedWorkspace.id, before);
});

test('deux remises à zéro de suite restent distinctes, et la ferme vierge revient à sa liste à cocher', async () => {
  const owner = demoOwnerUserId('invite-a', ETE);
  await prepareDemoSpace(owner, ETE);
  await resetDemoSpace(owner, new Date('2026-06-16T08:00:00.000Z'));
  await resetDemoSpace(owner, new Date('2026-06-16T08:00:00.000Z'));
  assert.equal(owners().filter((item) => item.includes('·archive·')).length, 2);

  const vierge = resolveDemoChoice('vierge', undefined);
  const blank = demoOwnerUserId('invite-a', vierge);
  await saveFeatureSelectionForUser(blank, ['materiel'], new Date('2026-06-16T08:00:00.000Z'));
  await resetDemoSpace(blank);
  assert.equal((await getFeatureSelectionForUser(blank)).firstVisit, true);
});

test('la remise à zéro est refusée hors démonstration et pour un espace qui n’est pas de démonstration', async () => {
  await assert.rejects(resetDemoSpace('local-demo-user'), DemoResetRefusedError);
  await assert.rejects(resetDemoSpace(`${demoOwnerUserId('invite-a', ETE)}·archive·x`), DemoResetRefusedError);
  delete process.env.DEMO_MODE;
  await assert.rejects(resetDemoSpace(demoOwnerUserId('invite-a', ETE)), DemoResetRefusedError);
  await assert.rejects(resetInactiveDemoSpaces(), DemoResetRefusedError);
});

test('la tâche de nuit remet à zéro les seuls espaces de démonstration inactifs depuis plus de 24 heures', async () => {
  const idle = demoOwnerUserId('invite-a', ETE);
  const active = demoOwnerUserId('invite-b', ETE);
  for (const owner of [idle, active]) await prepareDemoSpace(owner, ETE);
  // Une identité hors démonstration, même ancienne, n'est jamais visée.
  await saveFeatureSelectionForUser('ferme-ordinaire', ['materiel'], new Date('2026-06-16T08:00:00.000Z'));
  setLastVisit(idle, '-25 hours');
  setLastVisit(active, '-23 hours');
  setLastVisit('ferme-ordinaire', '-30 days');

  assert.equal(await resetInactiveDemoSpaces(), 1);
  assert.equal(await findWorkspaceIdForUser(idle), null);
  assert.ok(await findWorkspaceIdForUser(active));
  assert.ok(await findWorkspaceIdForUser('ferme-ordinaire'));
  // Un espace mis de côté ne l'est pas deux fois ; l'invité qui revient retrouve un espace neuf.
  assert.equal(await resetInactiveDemoSpaces(), 0);
  await prepareDemoSpace(idle, ETE);
  assert.deepEqual([...(await getFeatureSelectionForUser(idle)).enabled].sort(), [...ETE.profile.features].sort());
});

test('le passage de l’invité est noté au plus une fois par heure, et jamais hors démonstration', async () => {
  const owner = demoOwnerUserId('invite-a', ETE);
  await prepareDemoSpace(owner, ETE);
  setLastVisit(owner, '-30 minutes');
  const recent = lastVisit(owner);
  await recordDemoVisit(owner);
  assert.equal(lastVisit(owner), recent);

  setLastVisit(owner, '-2 hours');
  const old = lastVisit(owner);
  await recordDemoVisit(owner);
  assert.ok(lastVisit(owner) > old);

  setLastVisit(owner, '-2 hours');
  const untouched = lastVisit(owner);
  delete process.env.DEMO_MODE;
  await recordDemoVisit(owner);
  assert.equal(lastVisit(owner), untouched);
});
