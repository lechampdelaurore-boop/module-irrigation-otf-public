import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { afterEach, beforeEach } from 'node:test';
import { listSpeciesCorrespondencesForWorkspace, saveSpeciesCorrespondenceForUser } from '../../db/crop-water/entries';
import { ensureWorkspaceForUser } from '../../db/workspace-repository';
import { mockSnapshot } from '../../lib/adapters/mock-data';
import type { SeasonSpecies } from '../../lib/domain/crop-water/species';
import type { LinkCandidate } from '../../lib/domain/crop-water/species-linking';
import { normalizedSpeciesName, speciesLinkProposals } from '../../lib/domain/onboarding/species';
import { SPECIES_MODEL_LINKS } from '../../lib/domain/onboarding/species-model-data';
import { unfinishedSteps, verificationLine } from '../../lib/domain/onboarding/steps';
import { getCropCoefficientsViewForUser } from '../../lib/services/crop-water-coefficients';
import { getOnboardingForUser } from '../../lib/services/onboarding-service';
import { confirmSpeciesStepOfUser, linkProposedSpeciesForUser } from '../../lib/services/onboarding-species';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { ALICE, BOB } from '../support/spaces';

/**
 * L'étape « Rattachez vos espèces » d'une ferme neuve (4.4,
 * docs/tranche-4-contract.md, F423, F428 réponse 4 ; PR 4c, F587 ; PR 4d,
 * F590) : une
 * proposition par espèce sans rattachement, du modèle sinon du nom ; la
 * personne garde celles qu'elle veut, d'un geste ; rien n'est rattaché à sa
 * place ; la ferme du porteur et la démonstration n'ont pas l'étape (F426).
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

const NOW = new Date('2026-11-20T09:00:00.000Z');
const SEASON = 2026;
const input = (ownerUserId: string) => ({ ownerUserId, season: SEASON, snapshot: mockSnapshot, now: NOW });

function markBeforeOnboarding(workspaceId: string) {
  for (const step of ['location', 'plots', 'soil', 'crops', 'settings']) {
    database.sqlite.prepare(
      'INSERT INTO irrigation_onboarding_steps (workspace_id, step, state, origin, proposed_value, confirmed_at, updated_at) VALUES (?, ?, \'confirmed\', \'before-onboarding\', NULL, ?, ?)',
    ).run(workspaceId, step, NOW.toISOString(), NOW.toISOString());
  }
}

async function stepOf(spaceKey: string) {
  const view = await getCropCoefficientsViewForUser(input(spaceKey));
  assert.equal(view.available, true);
  return view.available ? { step: view.speciesStep, species: view.species } : { step: null, species: [] };
}

const candidate = (id: string, name: string, extra: Partial<LinkCandidate> = {}): LinkCandidate => ({ id, name, source: 'criiam', fromCommonSet: true, usable: true, ...extra });
const species = (plantId: string, plantName: string, link: SeasonSpecies['link'] = null): SeasonSpecies => ({ plantId, plantName, series: [], link, exceptions: [] });

test('le modèle passe avant le nom ; il ne vise qu’une culture commune utilisable ; une espèce déjà rattachée n’est pas proposée', () => {
  const candidates = [candidate('criiam-tomate', 'Tomate'), candidate('fao-laitue', 'Laitue', { source: 'fao56' }), candidate('ferme-x', 'Courge', { fromCommonSet: false }), candidate('criiam-ko', 'Poireau', { usable: false })];
  const model = [
    { species: 'mache', referenceCropId: 'fao-laitue', analogy: true },
    { species: 'Tomate cerise', referenceCropId: 'fao-laitue', analogy: false },
    { species: 'courge butternut', referenceCropId: 'ferme-x', analogy: false },
    { species: 'Poireau', referenceCropId: 'criiam-ko', analogy: false },
  ];
  const proposals = speciesLinkProposals([
    species('p1', 'Mâche'),
    species('p2', 'TOMATE  cerise'),
    species('p3', 'Courge butternut'),
    species('p4', 'Poireau'),
    species('p5', 'Tomate ancienne', { plantId: 'p5', seriesId: null, target: { kind: 'without-reference' } }),
    species('p6', 'Tomate ronde'),
  ], candidates, model);
  assert.deepEqual(proposals.map((proposal) => [proposal.plantId, proposal.referenceCropId, proposal.analogy, proposal.from]), [
    ['p1', 'fao-laitue', true, 'model'],
    ['p2', 'fao-laitue', false, 'model'],
    ['p6', 'criiam-tomate', false, 'name'],
  ]);
  assert.equal(normalizedSpeciesName('  Mâche   de  Nantes '), 'mache de nantes');
});

test('ferme neuve : le modèle de la ferme du porteur d’abord, le nom ensuite ; rien n’est rattaché avant le geste', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  const { step, species: all } = await stepOf(ALICE);
  assert.ok(step);
  assert.equal(step.confirmed, false);
  assert.deepEqual(all.map((item) => item.plantName), ['Carotte', 'Mâche', 'Radis', 'Tomate']);
  assert.deepEqual(step.proposals.map((proposal) => [proposal.plantName, proposal.referenceCropId, proposal.analogy, proposal.from]), [
    ['Carotte', 'criiam-carotte', false, 'model'],
    ['Mâche', 'criiam-salade-ete', true, 'model'],
    ['Radis', 'fao-radis', false, 'name'],
    ['Tomate', 'criiam-tomate', false, 'model'],
  ]);
  assert.deepEqual(await listSpeciesCorrespondencesForWorkspace(workspaceId), []);
});

test('le modèle relevé : 40 liens, des noms tous différents, chacun vers une culture du jeu commun', () => {
  assert.equal(SPECIES_MODEL_LINKS.length, 40);
  assert.equal(SPECIES_MODEL_LINKS.filter((link) => link.analogy).length, 11);
  assert.equal(new Set(SPECIES_MODEL_LINKS.map((link) => normalizedSpeciesName(link.species))).size, SPECIES_MODEL_LINKS.length);
  const common = new Set(readFileSync('drizzle/0023_crop_water_need.sql', 'utf8').match(/'(criiam|fao)-[a-z-]+'/g)?.map((id) => id.slice(1, -1)));
  assert.deepEqual(SPECIES_MODEL_LINKS.filter((link) => !common.has(link.referenceCropId)), []);
});

test('les propositions gardées se rattachent d’un geste, les décochées non ; puis elles ne sont plus proposées', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  const { step } = await stepOf(ALICE);
  const [kept, ...dropped] = step!.proposals;
  assert.ok(dropped.length > 0);
  const result = await linkProposedSpeciesForUser({ ...input(ALICE), plantIds: [kept.plantId] });
  assert.deepEqual(result, { ok: true, count: 1 });
  assert.deepEqual(await listSpeciesCorrespondencesForWorkspace(workspaceId), [
    { plantId: kept.plantId, seriesId: null, target: { kind: 'reference', referenceCropId: kept.referenceCropId, analogy: false } },
  ]);
  const mache = dropped.find((proposal) => proposal.plantName === 'Mâche')!;
  assert.deepEqual(await linkProposedSpeciesForUser({ ...input(ALICE), plantIds: [mache.plantId] }), { ok: true, count: 1 });
  assert.deepEqual((await listSpeciesCorrespondencesForWorkspace(workspaceId)).find((link) => link.plantId === mache.plantId)?.target,
    { kind: 'reference', referenceCropId: 'criiam-salade-ete', analogy: true }, 'l’analogie du modèle est gardée');
  const after = (await stepOf(ALICE)).step!;
  assert.deepEqual(after.proposals.map((proposal) => proposal.plantId), dropped.filter((proposal) => proposal !== mache).map((proposal) => proposal.plantId));
});

test('une espèce non proposée refuse tout le geste : rien n’est écrit', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  const { step } = await stepOf(ALICE);
  const result = await linkProposedSpeciesForUser({ ...input(ALICE), plantIds: [step!.proposals[0].plantId, 'plante-inconnue'] });
  assert.equal(result.ok, false);
  assert.deepEqual(await listSpeciesCorrespondencesForWorkspace(workspaceId), []);
  assert.equal((await linkProposedSpeciesForUser({ ...input(ALICE), plantIds: [] })).ok, false);
});

test('une espèce rattachée à la main n’est plus proposée, et le geste ne la remplace pas', async () => {
  const { step } = await stepOf(ALICE);
  const first = step!.proposals[0];
  await saveSpeciesCorrespondenceForUser(ALICE, { plantId: first.plantId, seriesId: null, target: { kind: 'without-reference' } }, NOW);
  assert.ok(!(await stepOf(ALICE)).step!.proposals.some((proposal) => proposal.plantId === first.plantId));
  assert.equal((await linkProposedSpeciesForUser({ ...input(ALICE), plantIds: [first.plantId] })).ok, false);
});

test('confirmer l’étape garde le compte des espèces rattachées ; le bandeau ne les rappelle plus', async () => {
  const { step, species: all } = await stepOf(ALICE);
  await linkProposedSpeciesForUser({ ...input(ALICE), plantIds: step!.proposals.map((proposal) => proposal.plantId) });
  const before = await getOnboardingForUser(ALICE);
  assert.equal(unfinishedSteps(before, { weather: false, plotsToClassify: 0, speciesToLink: 2 }).find((item) => item.id === 'crops')?.text, '2 espèces à rattacher');
  assert.deepEqual(await confirmSpeciesStepOfUser(input(ALICE)), { ok: true, count: step!.proposals.length });
  const onboarding = await getOnboardingForUser(ALICE);
  assert.equal(onboarding.kind, 'onboarding');
  const crops = onboarding.kind === 'onboarding' ? onboarding.steps.find((item) => item.id === 'crops')! : null;
  assert.equal(crops?.state, 'confirmed');
  assert.match(verificationLine(crops!).text, new RegExp(`^Confirmé le .+ : ${step!.proposals.length} espèces? rattachées? sur ${all.length}\\.$`));
  assert.equal(unfinishedSteps(onboarding, { weather: false, plotsToClassify: 0, speciesToLink: 2 }).some((item) => item.id === 'crops'), false);
  assert.equal((await stepOf(ALICE)).step!.confirmed, true);
});

test('la ferme d’avant l’accueil et la démonstration n’ont pas l’étape ; le geste y est refusé (F426)', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  const proposed = (await stepOf(ALICE)).step!.proposals[0].plantId;
  markBeforeOnboarding(workspaceId);
  assert.equal((await stepOf(ALICE)).step, null);
  assert.equal((await linkProposedSpeciesForUser({ ...input(ALICE), plantIds: [proposed] })).ok, false);
  assert.equal((await confirmSpeciesStepOfUser(input(ALICE))).ok, false);
  assert.deepEqual(await listSpeciesCorrespondencesForWorkspace(workspaceId), []);
  assert.equal((await getOnboardingForUser(ALICE)).kind, 'before-onboarding');
  process.env.DEMO_MODE = 'true';
  assert.equal((await stepOf(BOB)).step, null);
});

test('les rattachements d’une ferme ne passent pas à l’autre', async () => {
  const { step } = await stepOf(ALICE);
  await linkProposedSpeciesForUser({ ...input(ALICE), plantIds: step!.proposals.map((proposal) => proposal.plantId) });
  await confirmSpeciesStepOfUser(input(ALICE));
  const bob = (await stepOf(BOB)).step!;
  assert.equal(bob.confirmed, false);
  assert.deepEqual(bob.proposals.map((proposal) => proposal.plantId), step!.proposals.map((proposal) => proposal.plantId));
  assert.deepEqual(await listSpeciesCorrespondencesForWorkspace(await ensureWorkspaceForUser(BOB)), []);
});
