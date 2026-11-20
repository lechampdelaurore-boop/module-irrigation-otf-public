import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { addRootingProfileForUser } from '../../db/soil-reserve/entries';
import { listRootingProfilesForWorkspace } from '../../db/soil-reserve/inputs';
import { ensureWorkspaceForUser } from '../../db/workspace-repository';
import { mockSnapshot } from '../../lib/adapters/mock-data';
import { CORRECTED_COMMON_PROFILES, rootingProfilesForSpace } from '../../lib/domain/onboarding/rooting';
import { rootingProfileOn } from '../../lib/domain/soil-reserve/rooting';
import { getCropCoefficientsViewForUser } from '../../lib/services/crop-water-coefficients';
import { getOnboardingForUser } from '../../lib/services/onboarding-service';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { ALICE, BOB } from '../support/spaces';

/**
 * Les racines d'une ferme neuve (4.4, docs/tranche-4-contract.md, F423,
 * F585 ; preuve 1 de la section 8 bis.6, défaut n° 14) : le plafond de
 * 0,60 m de l'asperge et du melon, celui de la ferme du porteur, n'est pas
 * hérité ; la ferme du porteur et la démonstration le gardent.
 */

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

const DAY = '2026-06-15';
const NOW = new Date('2026-11-20T09:00:00.000Z');

function markBeforeOnboarding(workspaceId: string) {
  for (const step of ['location', 'plots', 'soil', 'crops', 'settings']) {
    database.sqlite.prepare(
      'INSERT INTO irrigation_onboarding_steps (workspace_id, step, state, origin, proposed_value, confirmed_at, updated_at) VALUES (?, ?, \'confirmed\', \'before-onboarding\', NULL, ?, ?)',
    ).run(workspaceId, step, NOW.toISOString(), NOW.toISOString());
  }
}

async function profilesOf(spaceKey: string) {
  const workspaceId = await ensureWorkspaceForUser(spaceKey);
  return rootingProfilesForSpace(await listRootingProfilesForWorkspace(workspaceId), await getOnboardingForUser(spaceKey));
}

const deepest = (profiles: Awaited<ReturnType<typeof profilesOf>>, cropId: string) => Math.max(
  ...(rootingProfileOn(profiles, cropId, DAY)?.stages.map((stage) => stage.depthM) ?? []),
);

test('le jeu commun garde le plafond du porteur en base : la correction se pose à la lecture', async () => {
  const stored = await listRootingProfilesForWorkspace(await ensureWorkspaceForUser(ALICE));
  for (const cropId of CORRECTED_COMMON_PROFILES) {
    assert.equal(Math.max(...rootingProfileOn(stored, cropId, DAY)!.stages.map((stage) => stage.depthM)), 0.6);
  }
});

test('ferme neuve : l’asperge et le melon partent de la FAO, pas du plafond de 0,60 m du porteur (défaut n° 14)', async () => {
  const profiles = await profilesOf(ALICE);
  assert.equal(deepest(profiles, 'criiam-asperge'), 1.2);
  assert.equal(deepest(profiles, 'criiam-melon'), 0.8);
  const asparagus = rootingProfileOn(profiles, 'criiam-asperge', DAY)!;
  assert.match(asparagus.source, /^Maximum : FAO 1,2-1,8 m, borne basse\./);
  assert.match(asparagus.note ?? '', /^Estimation\./);
  assert.equal(asparagus.p, 0.45, 'p du tableau 22, inchangé');
  assert.equal(deepest(profiles, 'criiam-tomate'), deepest(await listRootingProfilesForWorkspace(null), 'criiam-tomate'), 'les autres profils ne changent pas');
});

test('ferme neuve, vue « Besoin par culture » : le profil de l’asperge est celui de la FAO', async () => {
  await ensureWorkspaceForUser(ALICE);
  const view = await getCropCoefficientsViewForUser({ ownerUserId: ALICE, season: 2026, snapshot: mockSnapshot, now: NOW });
  assert.equal(view.available, true);
  const profiles = view.available ? view.rootingProfiles : [];
  assert.equal(Math.max(...rootingProfileOn(profiles, 'criiam-asperge', DAY)!.stages.map((stage) => stage.depthM)), 1.2);
});

test('la ferme d’avant l’accueil et la démonstration gardent le jeu commun tel quel (F426)', async () => {
  markBeforeOnboarding(await ensureWorkspaceForUser(ALICE));
  assert.equal(deepest(await profilesOf(ALICE), 'criiam-asperge'), 0.6);
  assert.equal(deepest(await profilesOf(ALICE), 'criiam-melon'), 0.6);
  process.env.DEMO_MODE = 'true';
  assert.equal(deepest(await profilesOf(BOB), 'criiam-asperge'), 0.6);
});

test('une révision de la ferme neuve remplace la proposition de la FAO, et ne touche pas l’autre ferme', async () => {
  const saved = await addRootingProfileForUser(ALICE, {
    referenceCropId: 'criiam-asperge',
    p: 0.45,
    stages: [{ rank: null, depthM: 0.9, endDepthM: null, progressionDays: null }],
    source: 'Contrôle à la tarière',
    note: null,
    effectiveFrom: '2026-06-01',
  }, NOW);
  assert.equal(saved.ok, true);
  assert.equal(deepest(await profilesOf(ALICE), 'criiam-asperge'), 0.9);
  assert.equal(deepest(await profilesOf(BOB), 'criiam-asperge'), 1.2);
});
