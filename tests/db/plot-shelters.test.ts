import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { readOnboardingStepsForUser } from '../../db/onboarding-repository';
import { listPlotSheltersForUser, savePlotSheltersForUser } from '../../db/plot-shelter-repository';
import { ensureWorkspaceForUser } from '../../db/workspace-repository';
import type { IrrigationSnapshot, Plot } from '../../lib/domain/domain';
import {
  applyPlotShelters, plotShelterLines, proposedShelter, unclassifiedPlots,
} from '../../lib/domain/onboarding/plots';
import { resolveOnboarding, unfinishedSteps, verificationLine } from '../../lib/domain/onboarding/steps';
import { getIrrigationSnapshot } from '../../lib/services/irrigation-service';
import { getOnboardingForUser } from '../../lib/services/onboarding-service';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { ALICE, BOB } from '../support/spaces';

/**
 * Parcelles et abris (4.4, docs/tranche-4-contract.md, F420, F583 ; preuves
 * 1, 2 et 3 de la section 8 bis.6) : pour une ferme neuve, aucun jardin
 * n'est abri ou plein champ sans que la personne l'ait dit ; ce qu'elle dit
 * est gardé par espace, et l'étape suit.
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

const AT = '2026-11-20T09:00:00.000Z';
const SEASON = 2026;

function markBeforeOnboarding(workspaceId: string) {
  for (const step of ['location', 'plots', 'soil', 'crops', 'settings']) {
    database.sqlite.prepare(
      'INSERT INTO irrigation_onboarding_steps (workspace_id, step, state, origin, proposed_value, confirmed_at, updated_at) VALUES (?, ?, \'confirmed\', \'before-onboarding\', NULL, ?, ?)',
    ).run(workspaceId, step, AT, AT);
  }
}

const plot = (id: string, name: string, mode: Plot['mode']): Plot => ({ id, zoneId: 'zone', name, mode, length: 10, width: 4, area: 40, seasons: [SEASON] });

test('la proposition : le type du jardin dans Ouvre ta ferme, sinon un mot de son nom, « serre » et « châssis » compris', () => {
  assert.equal(proposedShelter(plot('a', 'Jardin Nord', 'greenhouse')), true);
  assert.equal(proposedShelter(plot('b', 'Jardin Nord', 'garden')), false);
  assert.equal(proposedShelter(plot('c', 'Serre 2', 'garden')), true);
  assert.equal(proposedShelter(plot('d', 'Châssis', 'garden')), true);
  assert.equal(proposedShelter(plot('e', 'Multichapelle est', 'garden')), true);
  assert.equal(proposedShelter(plot('f', 'Tunnel 1', 'garden')), true);
});

test('ferme neuve : chaque jardin est à classer, le tunnel d’Ouvre ta ferme compris (défaut n° 21)', async () => {
  await ensureWorkspaceForUser(ALICE);
  const snapshot = await getIrrigationSnapshot(ALICE, { season: SEASON });
  const plots = snapshot.plots.filter((item) => item.seasons.includes(SEASON));
  assert.ok(plots.length >= 3);
  assert.ok(plots.every((item) => item.mode === 'unclassified'), 'aucun jardin n’est classé à la place de la personne');
  const tunnel = snapshot.plots.find((item) => item.id === 'plot-tunnel-1')!;
  assert.equal(tunnel.classification?.proposedSheltered, true, 'Ouvre ta ferme le dit abri : c’est une proposition');
  assert.equal(snapshot.plots.find((item) => item.id === 'plot-nord')!.classification?.proposedSheltered, false);
  assert.equal(unclassifiedPlots(snapshot, SEASON).length, plots.length);
  const onboarding = await getOnboardingForUser(ALICE);
  assert.deepEqual(unfinishedSteps(onboarding, { weather: false, plotsToClassify: plots.length }).map((step) => step.text), [`${plots.length} jardins à classer`]);
});

test('un espace d’avant l’accueil garde le classement d’Ouvre ta ferme, sans une ligne écrite (F426)', async () => {
  markBeforeOnboarding(await ensureWorkspaceForUser(ALICE));
  const snapshot = await getIrrigationSnapshot(ALICE, { season: SEASON });
  assert.equal(snapshot.plots.find((item) => item.id === 'plot-tunnel-1')!.mode, 'greenhouse');
  assert.equal(snapshot.plots.find((item) => item.id === 'plot-nord')!.mode, 'garden');
  assert.ok(snapshot.plots.every((item) => item.classification === undefined));
  assert.equal(plotShelterLines(snapshot, SEASON), null, 'pas d’écran de classement pour lui');
  assert.deepEqual(await listPlotSheltersForUser(ALICE), []);
});

test('la démonstration garde le classement de ses fermes fictives', () => {
  const snapshot = { plots: [plot('t', 'Tunnel', 'greenhouse')] } as IrrigationSnapshot;
  assert.equal(applyPlotShelters(snapshot, { kind: 'demonstration' }, []), snapshot);
});

test('classer chaque jardin confirme l’étape avec son compte ; « je ne sais pas » la rouvre ; la provenance est dite', async () => {
  await ensureWorkspaceForUser(ALICE);
  const before = await getIrrigationSnapshot(ALICE, { season: SEASON });
  const lines = plotShelterLines(before, SEASON)!;
  const planPlotIds = lines.map((line) => line.plotId);
  // Le tunnel confirmé abri, un jardin corrigé en abri, les autres comme proposé.
  await savePlotSheltersForUser(ALICE, {
    answers: lines.map((line) => ({ plotId: line.plotId, sheltered: line.plotId === 'plot-sud' ? true : line.proposedSheltered, proposedSheltered: line.proposedSheltered })),
    planPlotIds,
    at: AT,
  });
  const after = await getIrrigationSnapshot(ALICE, { season: SEASON });
  assert.equal(after.plots.find((item) => item.id === 'plot-tunnel-1')!.mode, 'greenhouse');
  assert.equal(after.plots.find((item) => item.id === 'plot-sud')!.mode, 'greenhouse');
  assert.equal(after.plots.find((item) => item.id === 'plot-nord')!.mode, 'garden');
  const afterLines = plotShelterLines(after, SEASON)!;
  assert.equal(afterLines.find((line) => line.plotId === 'plot-sud')!.origin, 'proposition corrigée');
  assert.equal(afterLines.find((line) => line.plotId === 'plot-tunnel-1')!.origin, 'proposition confirmée');

  const step = (await readOnboardingStepsForUser(ALICE)).find((row) => row.step === 'plots')!;
  assert.equal(step.state, 'confirmed');
  assert.deepEqual(step.proposedValue, { sheltered: 2, openField: lines.length - 2 });
  const resolved = resolveOnboarding({ kind: 'stored', steps: await readOnboardingStepsForUser(ALICE) });
  const plotsStep = resolved.kind === 'onboarding' ? resolved.steps.find((item) => item.id === 'plots')! : null;
  assert.match(verificationLine(plotsStep!).text, new RegExp(`: 2 abris, ${lines.length - 2} jardins? de plein champ\\.$`));

  await savePlotSheltersForUser(ALICE, { answers: [{ plotId: 'plot-sud', sheltered: null, proposedSheltered: false }], planPlotIds, at: AT });
  assert.equal((await getIrrigationSnapshot(ALICE, { season: SEASON })).plots.find((item) => item.id === 'plot-sud')!.mode, 'unclassified');
  assert.equal((await readOnboardingStepsForUser(ALICE)).some((row) => row.step === 'plots'), false, 'l’étape redevient à faire');
});

test('une étape à moitié faite se reprend : les jardins déjà classés le restent', async () => {
  await ensureWorkspaceForUser(ALICE);
  const lines = plotShelterLines(await getIrrigationSnapshot(ALICE, { season: SEASON }), SEASON)!;
  await savePlotSheltersForUser(ALICE, { answers: [{ plotId: lines[0].plotId, sheltered: false, proposedSheltered: lines[0].proposedSheltered }], planPlotIds: lines.map((line) => line.plotId), at: AT });
  const again = await getIrrigationSnapshot(ALICE, { season: SEASON });
  assert.equal(again.plots.find((item) => item.id === lines[0].plotId)!.mode, 'garden');
  assert.equal(unclassifiedPlots(again, SEASON).length, lines.length - 1);
  assert.equal((await readOnboardingStepsForUser(ALICE)).some((row) => row.step === 'plots'), false);
});

test('le classement d’Alice ne se lit jamais chez Bob (isolation des fermes et des personnes)', async () => {
  await ensureWorkspaceForUser(ALICE);
  await ensureWorkspaceForUser(BOB);
  const lines = plotShelterLines(await getIrrigationSnapshot(ALICE, { season: SEASON }), SEASON)!;
  await savePlotSheltersForUser(ALICE, {
    answers: lines.map((line) => ({ plotId: line.plotId, sheltered: line.proposedSheltered, proposedSheltered: line.proposedSheltered })),
    planPlotIds: lines.map((line) => line.plotId),
    at: AT,
  });
  assert.equal(unclassifiedPlots(await getIrrigationSnapshot(ALICE, { season: SEASON }), SEASON).length, 0);
  const bob = await getIrrigationSnapshot(BOB, { season: SEASON });
  assert.ok(bob.plots.filter((item) => item.seasons.includes(SEASON)).every((item) => item.mode === 'unclassified'));
  assert.deepEqual(await listPlotSheltersForUser(BOB), []);
  assert.equal((await readOnboardingStepsForUser(BOB)).length, 0);
});
