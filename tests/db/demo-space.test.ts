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
import { computeWeeklyPlanForUser } from '../../lib/services/planning-service';
import { listEquipmentForUser } from '../../db/equipment/read';
import { listIrrigationEventsForUser } from '../../db/irrigation-event/read';
import { DEMO_PROFILES } from '../../lib/domain/demo/catalogue';
import { listWaterInfrastructureForUser } from '../../db/water-resource-repository';
import { installSimulatedDate, runOnSimulatedDay, uninstallSimulatedDate } from '../../lib/services/demo-clock';
import { listHydricGoalsForUser, listWeatherDailyValuesForUser } from '../../db/water-management-repository';
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
  uninstallSimulatedDate();
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

/** Prépare l'espace comme le Worker de démonstration : au jour du moment. */
async function prepareOnMoment(guest: string, profile: string, moment: string) {
  const choice = resolveDemoChoice(profile, moment);
  const owner = demoOwnerUserId(guest, choice);
  installSimulatedDate();
  await runOnSimulatedDay(choice.moment.dateKey, () => prepareDemoSpace(owner, choice));
  return { choice, owner };
}

test('la météo des semaines passées est en base : la semaine du moment est complète, sans trou', async () => {
  const { choice, owner } = await prepareOnMoment('invite-a', 'maraichage', 'ete');
  const today = choice.moment.dateKey;
  const rows = await listWeatherDailyValuesForUser(owner, 'otf:nantes:44000', addDaysToDateKey(today, -28), addDaysToDateKey(today, 6));
  const days = new Set(rows.map((row) => row.date));
  for (let offset = -28; offset <= 6; offset += 1) assert.ok(days.has(addDaysToDateKey(today, offset)), addDaysToDateKey(today, offset));
  assert.ok(rows.filter((row) => row.date <= addDaysToDateKey(today, -5)).every((row) => row.dataKind === 'reanalysis'));
});

test('les objectifs de la semaine sont les propositions du module, adoptées pour chaque planche cultivée', async () => {
  const { choice, owner } = await prepareOnMoment('invite-a', 'maraichage', 'ete');
  const weekStart = '2026-06-15';
  const goals = await listHydricGoalsForUser(owner, 2026, weekStart);
  const cultivated = new Set(demoFarmSnapshot('maraichage', choice.moment.dateKey).cropPlan!.places.map((place) => place.bedId));
  assert.ok(goals.length > 0, 'des objectifs');
  for (const goal of goals) {
    assert.equal(goal.scopeType, 'bed');
    assert.ok(cultivated.has(goal.otfBedId!), `${goal.otfBedId} est cultivée`);
    assert.ok(goal.amountMm! > 0 && goal.amountMm! < 80, `${goal.otfBedId} : ${goal.amountMm} mm`);
  }
  // Sans « Besoin par culture », la ferme n'a pas de proposition à adopter : ses objectifs restent à fixer.
  const small = await prepareOnMoment('invite-a', 'petite-ferme', 'ete');
  assert.deepEqual(await listHydricGoalsForUser(small.owner, 2026, weekStart), []);
});

async function planOnMoment(profile: string, moment: string) {
  const { choice, owner } = await prepareOnMoment('invite-a', profile, moment);
  const snapshot = demoFarmSnapshot(choice.profile.id, choice.moment.dateKey);
  const stored = await runOnSimulatedDay(choice.moment.dateKey, () => computeWeeklyPlanForUser({ ownerUserId: owner, season: 2026, snapshot, log: () => undefined }));
  return { owner, proposals: stored.proposals, plan: stored.calculation.summary };
}

test('le matériel et l’eau de la ferme : un goutte-à-goutte par parcelle, le puits, le bassin au niveau du moment', async () => {
  const { owner } = await prepareOnMoment('invite-a', 'maraichage', 'penurie');
  const equipment = await listEquipmentForUser(owner);
  assert.equal(equipment.length, 4);
  assert.ok(equipment.every((item) => item.kind === 'drip' && item.settings.length === 1));
  const water = await listWaterInfrastructureForUser(owner);
  assert.deepEqual(water.resources.map((resource) => [resource.name, resource.status]), [['Puits des noues', 'inactive']]);
  assert.deepEqual(water.reservoirs.map((reservoir) => [reservoir.name, reservoir.currentVolumeCubicMeters]), [['Bassin des noues', 6]]);
  const summer = await prepareOnMoment('invite-a', 'maraichage', 'ete');
  assert.deepEqual((await listWaterInfrastructureForUser(summer.owner)).resources.map((resource) => resource.status), ['active']);
});

test('moment « début d’été » : le planning place tout le besoin de la semaine, sans manque, et aucun gel n’est annoncé', async () => {
  const { plan, proposals, owner } = await planOnMoment('maraichage', 'ete');
  const workspaceId = await workspaceOf(owner);
  const view = await readCropAlertsView({
    ownerUserId: owner, workspaceId, locationKey: 'otf:nantes:44000', snapshot: demoFarmSnapshot('maraichage', '2026-06-16'), season: 2026, now: new Date('2026-06-16T08:00:00.000Z'),
  });
  assert.deepEqual(view?.upcoming.frost.filter((day) => day.crops.length > 0), []);
  assert.ok(proposals.length > 0, 'des arrosages proposés');
  const needing = plan.beds.filter((bed) => bed.needMm > 0);
  assert.ok(needing.length > 0);
  // Un reste sous la dose minimale du goutte-à-goutte (3 mm) n'est pas un manque : le planning ne place pas d'arrosage pour si peu.
  const short = needing.filter((bed) => bed.deficitMm > 0 && !(bed.deficitMm < 3 && bed.reasons.every((reason) => reason === 'below-minimum-dose')));
  assert.deepEqual(short.map((bed) => [bed.bedName, bed.deficitMm, bed.reasons]), []);
  assert.equal(plan.deficit.byReason['water-budget'] ?? 0, 0, 'l’eau ne manque pas');
});

test('moment « pic d’été » : le puits à sec et le bassin bas, l’eau manque et le planning le dit', async () => {
  const { plan } = await planOnMoment('maraichage', 'penurie');
  const short = plan.beds.filter((bed) => bed.deficitMm > 0);
  assert.ok(short.length > 0, 'des planches en manque');
  assert.ok(plan.budgets.length > 0, 'un budget de pénurie');
});

test('moment « automne » : la saison passée est dans l’historique, arrosages faits avant le jour du moment', async () => {
  const { choice, owner } = await prepareOnMoment('invite-a', 'maraichage', 'automne');
  const events = await listIrrigationEventsForUser(owner, 2026);
  assert.equal(events.length, 4 * 27, 'un arrosage par semaine et par goutte-à-goutte, du lundi 20 avril au lundi 19 octobre');
  assert.ok(events.some((event) => event.equipment.actualStartAt?.startsWith('2026-10-19')), 'la semaine du moment a déjà le sien');
  assert.ok(events.every((event) => event.status === 'completed'));
  assert.ok(events.every((event) => (event.equipment.actualStartAt ?? '') < `${choice.moment.dateKey}T00:00:00.000Z`));
  // La ferme qui ne coche pas « Arrosages » n'a pas d'historique.
  const valves = await prepareOnMoment('invite-a', 'vannes-alertes', 'automne');
  assert.deepEqual(await listIrrigationEventsForUser(valves.owner, 2026), []);
});

test('chaque ferme et chaque moment se préparent sans erreur', async () => {
  for (const profile of DEMO_PROFILES) {
    for (const moment of profile.moments) {
      const started = Date.now();
      await prepareOnMoment('invite-c', profile.id, moment.id);
      assert.ok(Date.now() - started < 10_000, `${profile.id} · ${moment.id}`);
    }
  }
});
