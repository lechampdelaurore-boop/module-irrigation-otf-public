import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { listReferenceCropsForWorkspace } from '../../db/crop-water/references';
import { findWorkspaceIdForUser } from '../../db/workspace-repository';
import type { IrrigationSnapshot } from '../../lib/domain/domain';
import { farmDurationsOf } from '../../lib/domain/crop-water/farm-durations';
import { getCropCoefficientsViewForUser } from '../../lib/services/crop-water-coefficients';
import { resetFarmDurationsForUser, saveFarmDurationsForUser } from '../../lib/services/crop-water-durations';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';

/**
 * Les durées propres à la ferme, enregistrées (5 quater, PR 3e) : la version
 * de la ferme remplace la culture commune pour elle seule ; la commune reste
 * lisible à côté ; des durées égales aux communes, ou « Revenir aux durées
 * communes », rétablissent le jeu commun.
 */

const ALICE = 'alice';
const BOB = 'bob';

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

const snapshot: IrrigationSnapshot = {
  configuration: { seasonFirst: 2025, seasonLast: 2027 },
  structure: { id: '17', name: 'Ferme', legalCity: 'Rennes', legalPostcode: '35000', legalCountry: 'FR' },
  zones: [],
  plots: [],
  beds: [],
  cropPlan: {
    series: [],
    places: [],
    implantationTasks: [],
    readSummary: { seriesRead: 0, placesRead: 0, tasksRead: 0, tasksRetained: 0, placesWithoutSeries: 0, placesOfUnknownSeries: 0, placesWithUnknownBed: 0 },
  },
  source: 'cache',
  lastSuccessfulReadAt: '2026-11-06T00:00:00.000Z',
};

async function cropOf(ownerUserId: string, id: string) {
  const crops = await listReferenceCropsForWorkspace(await findWorkspaceIdForUser(ownerUserId));
  const stored = crops.find((candidate) => candidate.crop.id === id);
  assert.ok(stored, id);
  return stored;
}

test('les durées de la ferme remplacent la commune pour elle seule, et la commune reste lisible à côté', async () => {
  const common = await cropOf(ALICE, 'fao-cruciferes');
  const durations = farmDurationsOf(common.crop);
  const result = await saveFarmDurationsForUser(ALICE, 'fao-cruciferes', {
    ...durations,
    emergence: { directSowing: durations.emergence.directSowing + 2, planting: durations.emergence.planting },
    abatement: 0.8,
  });
  assert.deepEqual(result, { ok: true, outcome: 'saved', cropName: common.crop.name });

  const farm = await cropOf(ALICE, 'fao-cruciferes');
  assert.equal(farm.origin, 'farm');
  assert.deepEqual(farm.problems, []);
  assert.equal(farm.crop.curve.shape === 'trapezoid' && farm.crop.curve.abatement, 0.8);
  assert.equal(farm.crop.emergenceDelayDays['direct-sowing'], durations.emergence.directSowing + 2);
  assert.equal(farm.sourceUrl, common.sourceUrl, 'la source de la culture reste celle du jeu commun');
  assert.equal(farm.datesSource, 'durées réglées par la ferme');
  assert.equal((await cropOf(BOB, 'fao-cruciferes')).origin, 'common', 'une autre ferme garde le jeu commun');

  const view = await getCropCoefficientsViewForUser({ ownerUserId: ALICE, season: 2026, snapshot });
  assert.ok(view.available);
  assert.equal(view.crops.filter((stored) => stored.crop.id === 'fao-cruciferes').length, 1);
  assert.deepEqual(Object.keys(view.commonVersions), ['fao-cruciferes']);
  assert.equal(view.commonVersions['fao-cruciferes'].curve.shape === 'trapezoid' && view.commonVersions['fao-cruciferes'].curve.abatement, 1);
});

test('des durées égales à celles du jeu commun, ou un retour demandé, rétablissent la commune', async () => {
  const common = await cropOf(ALICE, 'criiam-tomate');
  const durations = farmDurationsOf(common.crop);
  const changed = { ...durations, emergence: { directSowing: durations.emergence.directSowing, planting: durations.emergence.planting + 3 } };
  assert.equal((await saveFarmDurationsForUser(ALICE, 'criiam-tomate', changed)).ok, true);
  assert.equal((await cropOf(ALICE, 'criiam-tomate')).origin, 'farm');

  assert.deepEqual(await saveFarmDurationsForUser(ALICE, 'criiam-tomate', durations), { ok: true, outcome: 'common', cropName: common.crop.name });
  assert.equal((await cropOf(ALICE, 'criiam-tomate')).origin, 'common');

  await saveFarmDurationsForUser(ALICE, 'criiam-tomate', changed);
  assert.equal(await resetFarmDurationsForUser(ALICE, 'criiam-tomate'), true);
  assert.equal((await cropOf(ALICE, 'criiam-tomate')).origin, 'common');
  assert.equal(await resetFarmDurationsForUser(ALICE, 'criiam-tomate'), false, 'rien à retirer');
});

test('une durée illisible, une forme qui ne suit pas la culture ou une culture hors du jeu commun sont refusées, sans rien écrire', async () => {
  const common = await cropOf(ALICE, 'criiam-tomate');
  const durations = farmDurationsOf(common.crop);
  const invalid = await saveFarmDurationsForUser(ALICE, 'criiam-tomate', { ...durations, emergence: { directSowing: -1, planting: 7 } });
  assert.equal(invalid.ok, false);
  const shape = await saveFarmDurationsForUser(ALICE, 'criiam-tomate', { ...durations, stepDays: [] });
  assert.deepEqual(shape, { ok: false, problems: ['Tomate : les durées ne suivent pas les stades et les jeux de saison de la culture.'] });
  const unknown = await saveFarmDurationsForUser(ALICE, 'culture-inconnue', durations);
  assert.equal(unknown.ok, false);
  assert.equal((await cropOf(ALICE, 'criiam-tomate')).origin, 'common');
});
