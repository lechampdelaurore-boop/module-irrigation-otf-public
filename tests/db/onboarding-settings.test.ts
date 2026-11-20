import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { saveFeatureSelectionForUser } from '../../db/feature-selection-repository';
import { ensureWorkspaceForUser } from '../../db/workspace-repository';
import type { IrrigationSnapshot } from '../../lib/domain/domain';
import { FEATURE_IDS } from '../../lib/domain/features/catalogue';
import { planningAllowed, settingsGroupsFor } from '../../lib/domain/onboarding/settings-review';
import { unfinishedSteps, verificationLine } from '../../lib/domain/onboarding/steps';
import { getOnboardingForUser } from '../../lib/services/onboarding-service';
import { answerSettingsGroupOfUser, getSettingsReviewForUser } from '../../lib/services/onboarding-settings';
import { computeWeeklyPlanForUser, PlanningAwaitsSettingsError, readWeeklyPlanForUser, recalculateWeeklyPlansForAllWorkspaces } from '../../lib/services/planning-service';
import { recalculatePlanAfterEvent } from '../../lib/services/planning-recalculation';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { FIXTURE_PLOT_ID, FIXTURE_ZONE_ID, createDripFixture } from '../support/irrigation-fixtures';
import { ALICE, BOB } from '../support/spaces';

/**
 * « Réglages à relire » d'une ferme neuve (4.4, docs/tranche-4-contract.md,
 * F424, réponse Q10 ; PR 5a, F588) : chaque groupe et sa source, validé ou
 * passé ; aucun planning avant la validation du groupe « Planning » ; la
 * ferme du porteur et la démonstration gardent leur planning (F426).
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

const NOW = new Date('2026-09-29T10:52:00.000Z');
const ALL = [...FEATURE_IDS];
const snapshot: IrrigationSnapshot = {
  configuration: { seasonFirst: 2025, seasonLast: 2026 },
  structure: { id: '17', name: 'Ferme', legalCity: 'Rennes', legalPostcode: '35000', legalCountry: 'FR' },
  zones: [{ id: FIXTURE_ZONE_ID, name: 'Zone', area: 1000, seasons: [2026] }],
  plots: [{ id: FIXTURE_PLOT_ID, zoneId: FIXTURE_ZONE_ID, name: 'Jardin', mode: 'garden', length: 40, width: 30, area: 1200, seasons: [2026] }],
  beds: [{ id: 'bed-1', zoneId: FIXTURE_ZONE_ID, plotId: FIXTURE_PLOT_ID, name: 'P1', length: 40, width: 0.75, alleyWidth: 0.45, area: 30, seasons: [2026] }],
  source: 'cache',
  lastSuccessfulReadAt: '2026-09-29T00:00:00.000Z',
};

function markBeforeOnboarding(workspaceId: string) {
  for (const step of ['location', 'plots', 'soil', 'crops', 'settings']) {
    database.sqlite.prepare(
      'INSERT INTO irrigation_onboarding_steps (workspace_id, step, state, origin, proposed_value, confirmed_at, updated_at) VALUES (?, ?, \'confirmed\', \'before-onboarding\', NULL, ?, ?)',
    ).run(workspaceId, step, NOW.toISOString(), NOW.toISOString());
  }
}

const answer = (spaceKey: string, group: Parameters<typeof answerSettingsGroupOfUser>[0]['group'], value: 'validated' | 'skipped', enabled = ALL) =>
  answerSettingsGroupOfUser({ spaceKey, enabled, group, answer: value, now: NOW });

test('les groupes des cases cochées, dans l’ordre, avec les valeurs du calcul et leur source', () => {
  assert.deepEqual(settingsGroupsFor(ALL).map((group) => group.id), ['abris', 'calcul', 'sol', 'gel', 'alertes', 'planning']);
  assert.deepEqual(settingsGroupsFor(['planning']).map((group) => group.id), ['abris', 'calcul', 'planning']);
  assert.deepEqual(settingsGroupsFor(['arrosages']).map((group) => group.id), []);
  const [abris, calcul] = settingsGroupsFor(ALL);
  assert.deepEqual(abris.lines[0], { label: 'Coefficient d’abri (K_abri)', value: '0,8 sous abri, réglable de 0,6 à 1, à confirmer pour chaque abri', source: 'CRIIAM, tunnel' });
  assert.equal(calcul.lines[1].value, 'de 0 à 12 mm par jour');
  const planning = settingsGroupsFor(ALL).at(-1)!;
  assert.equal(planning.lines[0].value, 'aspersion de 21 h à 8 h, goutte-à-goutte de 6 h à 22 h');
  assert.equal(planning.lines[1].value, 'aspersion de 5 à 15 mm, goutte-à-goutte de 3 à 10 mm');
});

test('ferme neuve : aucun planning avant la validation du groupe « Planning », rien d’enregistré (réponse Q10)', async () => {
  await createDripFixture(ALICE, { beds: ['bed-1'] });
  assert.equal(planningAllowed(await getOnboardingForUser(ALICE)), false);
  await assert.rejects(computeWeeklyPlanForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: NOW }), PlanningAwaitsSettingsError);
  assert.equal(await readWeeklyPlanForUser({ ownerUserId: ALICE, season: 2026, now: NOW }), null);
  assert.deepEqual(unfinishedSteps(await getOnboardingForUser(ALICE), { weather: false, plotsToClassify: 0, planningToValidate: true }).map((item) => item.text), ['réglages du planning à valider']);
});

test('passer le planning ne le permet pas ; le valider, si', async () => {
  await createDripFixture(ALICE, { beds: ['bed-1'] });
  assert.deepEqual(await answer(ALICE, 'planning', 'skipped'), { ok: true });
  assert.equal(planningAllowed(await getOnboardingForUser(ALICE)), false);
  assert.deepEqual(await answer(ALICE, 'planning', 'validated'), { ok: true });
  assert.equal(planningAllowed(await getOnboardingForUser(ALICE)), true);
  const plan = await computeWeeklyPlanForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: NOW });
  assert.equal(plan.calculation.season, 2026);
});

test('l’étape reste proposée tant qu’un groupe est sans réponse, puis se confirme avec son compte', async () => {
  await ensureWorkspaceForUser(ALICE);
  for (const group of ['abris', 'calcul', 'sol', 'alertes'] as const) await answer(ALICE, group, 'validated');
  await answer(ALICE, 'gel', 'skipped');
  let review = await getSettingsReviewForUser(ALICE, ALL);
  assert.equal(review?.confirmed, false);
  assert.deepEqual(review?.groups.map((group) => group.answer), ['validated', 'validated', 'validated', 'skipped', 'validated', null]);
  const proposed = (await getOnboardingForUser(ALICE));
  assert.equal(proposed.kind === 'onboarding' && proposed.steps.find((step) => step.id === 'settings')?.state, 'proposed');
  await answer(ALICE, 'planning', 'validated');
  review = await getSettingsReviewForUser(ALICE, ALL);
  assert.equal(review?.confirmed, true);
  const onboarding = await getOnboardingForUser(ALICE);
  const settings = onboarding.kind === 'onboarding' ? onboarding.steps.find((step) => step.id === 'settings')! : null;
  assert.equal(settings?.state, 'confirmed');
  assert.match(verificationLine(settings!).text, /^Confirmé le .+ : 5 groupes validés, 1 groupe passé\.$/);
});

test('un groupe que les cases cochées ne montrent pas est refusé, sans rien écrire', async () => {
  await ensureWorkspaceForUser(ALICE);
  const refused = await answer(ALICE, 'sol', 'validated', ['planning']);
  assert.equal(refused.ok, false);
  assert.deepEqual((await getSettingsReviewForUser(ALICE, ALL))?.groups.map((group) => group.answer), [null, null, null, null, null, null]);
});

test('la ferme d’avant l’accueil et la démonstration gardent leur planning et n’ont rien à relire (F426)', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  await createDripFixture(ALICE, { beds: ['bed-1'] });
  markBeforeOnboarding(workspaceId);
  assert.equal(planningAllowed(await getOnboardingForUser(ALICE)), true);
  assert.equal(await getSettingsReviewForUser(ALICE, ALL), null);
  assert.equal((await answer(ALICE, 'planning', 'skipped')).ok, false);
  assert.equal((await computeWeeklyPlanForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: NOW })).calculation.season, 2026);
  assert.equal((await getOnboardingForUser(ALICE)).kind, 'before-onboarding');
  process.env.DEMO_MODE = 'true';
  assert.equal(planningAllowed(await getOnboardingForUser(BOB)), true);
  assert.equal(await getSettingsReviewForUser(BOB, ALL), null);
});

test('la validation d’une ferme ne vaut pas pour l’autre', async () => {
  await createDripFixture(ALICE, { beds: ['bed-1'] });
  await createDripFixture(BOB, { beds: ['bed-1'] });
  await answer(ALICE, 'planning', 'validated');
  assert.equal(planningAllowed(await getOnboardingForUser(ALICE)), true);
  assert.equal(planningAllowed(await getOnboardingForUser(BOB)), false);
  await assert.rejects(computeWeeklyPlanForUser({ ownerUserId: BOB, season: 2026, snapshot, now: NOW }), PlanningAwaitsSettingsError);
});

test('le calcul du matin et le recalcul sur événement passent une ferme neuve sans planning validé, sans échec compté', async () => {
  await createDripFixture(ALICE, { beds: ['bed-1'] });
  await saveFeatureSelectionForUser(ALICE, ALL, NOW);
  const lines: string[] = [];
  assert.deepEqual(await recalculateWeeklyPlansForAllWorkspaces({ now: NOW, log: (line) => { lines.push(line); } }), { recalculated: 0, failed: 0 });
  assert.deepEqual(lines, []);
  let computed = false;
  await recalculatePlanAfterEvent(ALICE, { kind: 'rain-recorded', season: 2026, at: NOW.toISOString(), lasting: false }, {
    now: NOW,
    compute: async () => { computed = true; throw new Error('ne doit pas calculer'); },
    runAfterResponse: async (work) => { await work(); },
  });
  assert.equal(computed, false);
});
