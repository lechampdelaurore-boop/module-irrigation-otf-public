import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { demoOwnerUserId, resolveDemoChoice } from '../../lib/domain/demo/catalogue';
import { prepareDemoSpace } from '../../lib/services/demo-space';
import { listFrostLinks } from '../../db/crop-alerts/inputs';
import { listSpeciesCorrespondencesForWorkspace } from '../../db/crop-water/entries';
import { saveFeatureSelectionForUser } from '../../db/feature-selection-repository';
import { upsertWeatherDailyValuesForUser } from '../../db/water-management-repository';
import { createWorkspaceIfAbsent, findWorkspaceIdForUser } from '../../db/workspace-repository';
import { demoFarmSnapshot } from '../../lib/adapters/demo/farms';
import { DEMO_FROST_COMMON_KEYS, DEMO_SPECIES_REFERENCES } from '../../lib/adapters/demo/module-data';
import { demoSeasonWeatherProvider } from '../../lib/adapters/weather/demo-season-provider';
import { addDaysToDateKey } from '../../lib/domain/water-management';
import { readCropAlertsView } from '../../lib/services/crop-alerts-view';
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

async function workspaceOf(owner: string): Promise<string> {
  const id = await findWorkspaceIdForUser(owner);
  assert.ok(id, owner);
  return id;
}

test('les espèces de la ferme sont rattachées au catalogue Kc, et au jeu commun des seuils de gel quand elle a les alertes cultures', async () => {
  const choice = resolveDemoChoice('maraichage', 'ete');
  const owner = demoOwnerUserId('invite-a', choice);
  await prepareDemoSpace(owner, choice);
  const workspaceId = await workspaceOf(owner);
  const links = await listSpeciesCorrespondencesForWorkspace(workspaceId);
  const plants = [...new Set(demoFarmSnapshot('maraichage', '2026-06-16').cropPlan!.series.flatMap((series) => series.cultivations.map((item) => item.plantId)))].sort();
  assert.deepEqual(links.map((link) => link.plantId).sort(), plants);
  for (const link of links) {
    assert.deepEqual(link.target, { kind: 'reference', referenceCropId: DEMO_SPECIES_REFERENCES[link.plantId], analogy: false });
  }
  const frost = await listFrostLinks(workspaceId);
  assert.deepEqual(frost.map((link) => [link.plantId, link.commonKey, link.damageCelsius]).sort(),
    plants.map((plantId) => [plantId, DEMO_FROST_COMMON_KEYS[plantId], null]).sort());

  const small = resolveDemoChoice('petite-ferme', 'ete');
  const smallOwner = demoOwnerUserId('invite-a', small);
  await prepareDemoSpace(smallOwner, small);
  assert.deepEqual(await listFrostLinks(await workspaceOf(smallOwner)), [], 'sans les alertes cultures, aucun seuil de gel');
});

test('deux premières ouvertures simultanées ne préparent l’espace qu’une fois', async () => {
  const choice = resolveDemoChoice('maraichage', 'automne');
  const owner = demoOwnerUserId('invite-b', choice);
  await Promise.all([prepareDemoSpace(owner, choice), prepareDemoSpace(owner, choice)]);
  const workspaceId = await workspaceOf(owner);
  const links = await listSpeciesCorrespondencesForWorkspace(workspaceId);
  assert.equal(links.length, new Set(links.map((link) => link.plantId)).size);
  assert.equal((await listFrostLinks(workspaceId)).length, links.length);
  assert.equal(await createWorkspaceIfAbsent(owner), false, 'l’espace existe déjà : personne ne le recrée');
});

test('moment « gel de printemps » : les nuits du 15 et du 16 avril menacent des cultures en place, que l’encart nomme', async () => {
  const choice = resolveDemoChoice('maraichage', 'gel-printemps');
  const owner = demoOwnerUserId('invite-a', choice);
  await prepareDemoSpace(owner, choice);
  const workspaceId = await workspaceOf(owner);
  const today = choice.moment.dateKey;
  const now = new Date(`${today}T08:00:00.000Z`);
  const location = 'otf:nantes:44000';
  const forecast = await demoSeasonWeatherProvider.readForecast({
    latitude: 47.2181, longitude: -1.5528, timezone: 'Europe/Paris', startDate: today, endDate: addDaysToDateKey(today, 6),
  });
  await upsertWeatherDailyValuesForUser(owner, location, 'forecast', forecast, demoSeasonWeatherProvider.id, now.toISOString());
  const snapshot = demoFarmSnapshot('maraichage', today);
  const view = await readCropAlertsView({ ownerUserId: owner, workspaceId, locationKey: location, snapshot, season: 2026, now });
  assert.ok(view);
  const frostDays = view.upcoming.frost.filter((day) => day.crops.length > 0);
  // Le 14 au matin, la nuit à 1,8 °C menace déjà les cultures sensibles (marge du contrat) ; les 15 et 16, les gelées.
  for (const date of ['2026-04-15', '2026-04-16']) {
    assert.ok(frostDays.some((day) => day.date === date && day.crops.length > 0), date);
  }
  assert.ok(frostDays.every((day) => day.date <= '2026-04-16'), 'le gel s’arrête avec l’épisode annoncé');
  assert.equal(view.withoutThreshold.filter((row) => row.status === 'missing').length, 0, 'aucune espèce à rattacher');
});
