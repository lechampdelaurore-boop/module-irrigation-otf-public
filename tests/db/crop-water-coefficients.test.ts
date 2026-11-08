import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { addKcOverrideForUser, saveSpeciesCorrespondenceForUser } from '../../db/crop-water/entries';
import { addShadeNetForUser, addShelterFactorForUser, saveBedMulchForUser, saveCropWaterOptionsForUser } from '../../db/crop-water/settings';
import { addRootingProfileForUser } from '../../db/soil-reserve/entries';
import type { IrrigationSnapshot } from '../../lib/domain/domain';
import { getCropCoefficientsViewForUser } from '../../lib/services/crop-water-coefficients';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';

/**
 * La page « Coefficients culturaux » lue depuis la base (5 quater, PR 3) :
 * le jeu commun de la migration, utilisable tel quel ; les espèces de la
 * saison et leur rattachement, propres à chaque ferme ; la liste « sans
 * référence Kc ».
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

const cultivation = (id: string, plantId: string, plantName: string) => ({ id, plantId, plantName, harvestWeeks: [], harvestWeeksExpected: [] });

const snapshot = (withPlan = true): IrrigationSnapshot => ({
  configuration: { seasonFirst: 2025, seasonLast: 2027 },
  structure: { id: '17', name: 'Ferme', legalCity: 'Rennes', legalPostcode: '35000', legalCountry: 'FR' },
  zones: [],
  plots: [
    { id: 'tunnel', zoneId: 'z', name: 'Tunnel 1', mode: 'greenhouse', length: 30, width: 8, area: 240, seasons: [2026] },
    { id: 'nord', zoneId: 'z', name: 'Jardin Nord', mode: 'garden', length: 40, width: 18, area: 720, seasons: [2026] },
  ],
  beds: [
    { id: 't1', zoneId: 'z', plotId: 'tunnel', name: 'T01', length: 30, width: 0.8, alleyWidth: null, area: 24, seasons: [2026] },
    { id: 'n1', zoneId: 'z', plotId: 'nord', name: 'N01', length: 40, width: 0.8, alleyWidth: null, area: 32, seasons: [2026] },
  ],
  cropPlan: withPlan
    ? {
        series: [
          { id: 'tomates', name: 'Tomates', season: 2026, use: 'bed', cycle: 'annual', cultivations: [cultivation('c1', 'tomate', 'Tomate')] },
          { id: 'cosmos', name: 'Cosmos', season: 2026, use: 'bed', cycle: 'annual', cultivations: [cultivation('c2', 'cosmos', 'Cosmos')] },
          { id: 'endives', name: 'Endives', season: 2026, use: 'block', cycle: 'annual', cultivations: [cultivation('c3', 'endive', 'Endive')] },
          // Une série d'une autre saison n'est pas à rattacher pour celle-ci.
          { id: 'oignons', name: 'Oignons', season: 2027, use: 'bed', cycle: 'annual', cultivations: [cultivation('c4', 'oignon', 'Oignon')] },
        ],
        places: [],
        implantationTasks: [],
        readSummary: { seriesRead: 4, placesRead: 0, tasksRead: 0, tasksRetained: 0, placesWithoutSeries: 0, placesOfUnknownSeries: 0, placesWithUnknownBed: 0 },
      }
    : undefined,
  source: 'cache',
  lastSuccessfulReadAt: '2026-11-06T00:00:00.000Z',
});

test('sans plan de culture lu, la page se dit indisponible plutôt que vide', async () => {
  assert.deepEqual(
    await getCropCoefficientsViewForUser({ ownerUserId: ALICE, season: 2026, snapshot: snapshot(false) }),
    { available: false, season: 2026, reason: 'crop-plan-not-read' },
  );
});

test('une ferme sans aucune saisie lit les 32 cultures du jeu commun, toutes utilisables, et toutes ses espèces non rattachées', async () => {
  const view = await getCropCoefficientsViewForUser({ ownerUserId: ALICE, season: 2026, snapshot: snapshot() });
  assert.equal(view.available, true);
  if (!view.available) return;
  assert.equal(view.crops.length, 32);
  assert.deepEqual(view.crops.filter((stored) => stored.problems.length > 0), []);
  assert.ok(view.crops.every((stored) => stored.origin === 'common'));
  assert.deepEqual(view.species.map((species) => [species.plantName, species.link]), [['Cosmos', null], ['Tomate', null]]);
  assert.deepEqual(view.withoutReference.map((item) => [item.plantName, item.reason, item.seriesIds]), [
    ['Cosmos', 'missing', ['cosmos']],
    ['Tomate', 'missing', ['tomates']],
  ]);
});

test('un rattachement enregistré sort l’espèce de la liste « sans référence » de sa ferme seulement', async () => {
  await saveSpeciesCorrespondenceForUser(ALICE, { plantId: 'tomate', seriesId: null, target: { kind: 'reference', referenceCropId: 'criiam-tomate', analogy: false } });
  await saveSpeciesCorrespondenceForUser(ALICE, { plantId: 'cosmos', seriesId: null, target: { kind: 'without-reference' } });
  const alice = await getCropCoefficientsViewForUser({ ownerUserId: ALICE, season: 2026, snapshot: snapshot() });
  const bob = await getCropCoefficientsViewForUser({ ownerUserId: BOB, season: 2026, snapshot: snapshot() });
  assert.ok(alice.available && bob.available);
  if (!alice.available || !bob.available) return;
  assert.deepEqual(alice.species.map((species) => [species.plantName, species.link?.target]), [
    ['Cosmos', { kind: 'without-reference' }],
    ['Tomate', { kind: 'reference', referenceCropId: 'criiam-tomate', analogy: false }],
  ]);
  assert.deepEqual(alice.withoutReference.map((item) => [item.plantName, item.reason]), [['Cosmos', 'without-reference']]);
  assert.deepEqual(bob.withoutReference.map((item) => [item.plantName, item.reason]), [['Cosmos', 'missing'], ['Tomate', 'missing']]);
});

test('les surcharges de Kc et les réglages enregistrés paraissent dans la page de leur ferme seulement', async () => {
  const now = new Date('2026-11-06T09:00:00.000Z');
  assert.ok((await addKcOverrideForUser(ALICE, { referenceCropId: 'criiam-tomate', target: { rank: 2 }, kc: 0.55, effectiveFrom: '2026-11-01' }, now)).ok);
  assert.ok((await addShelterFactorForUser(ALICE, { shelterId: 'tunnel', value: 0.7, effectiveFrom: '2026-11-01' }, now)).ok);
  await saveBedMulchForUser(ALICE, { bedId: 'n1', season: 2026, plasticMulch: true }, now);
  assert.ok((await addShadeNetForUser(ALICE, { bedId: 'n1', rate: 0.25, from: '2026-11-02', to: null }, now)).ok);
  await saveCropWaterOptionsForUser(ALICE, { smoothing: true, shading: false }, now);

  const alice = await getCropCoefficientsViewForUser({ ownerUserId: ALICE, season: 2026, snapshot: snapshot(), now });
  const bob = await getCropCoefficientsViewForUser({ ownerUserId: BOB, season: 2026, snapshot: snapshot(), now });
  assert.ok(alice.available && bob.available);
  if (!alice.available || !bob.available) return;
  assert.deepEqual(alice.overrides.map((item) => [item.referenceCropId, item.target, item.kc, item.effectiveFrom]), [['criiam-tomate', { rank: 2 }, 0.55, '2026-11-01']]);
  assert.equal(alice.settings.today, '2026-11-06');
  assert.deepEqual(alice.settings.options, { smoothing: true, shading: false });
  assert.deepEqual(alice.settings.shelters.map((shelter) => [shelter.name, shelter.factor, shelter.isDefault]), [['Tunnel 1', 0.7, false]]);
  assert.deepEqual(alice.settings.beds.map((item) => [item.name, item.plasticMulch, item.nets.map((net) => [net.rate, net.from, net.to])]), [
    ['T01', false, []],
    ['N01', true, [[0.25, '2026-11-02', null]]],
  ]);

  assert.deepEqual(bob.overrides, []);
  assert.deepEqual(bob.settings.options, { smoothing: false, shading: false });
  assert.deepEqual(bob.settings.shelters.map((shelter) => [shelter.factor, shelter.isDefault]), [[0.8, true]]);
  assert.ok(bob.settings.beds.every((item) => !item.plasticMulch && item.nets.length === 0));
});

test('les profils racinaires : le jeu commun pour toute ferme, même sans espace ; une révision pour sa ferme seulement (5 ter, PR 3c)', async () => {
  const fresh = await getCropCoefficientsViewForUser({ ownerUserId: BOB, season: 2026, snapshot: snapshot() });
  assert.ok(fresh.available);
  assert.equal(fresh.rootingProfiles.length, 31, 'les trente et un profils communs');
  assert.ok(fresh.rootingProfiles.every((profile) => profile.origin === 'common'));

  const saved = await addRootingProfileForUser(ALICE, {
    referenceCropId: 'criiam-carotte',
    p: 0.3,
    stages: [{ rank: null, depthM: 0.25, endDepthM: null, progressionDays: null }],
    source: 'tarière',
    note: null,
    effectiveFrom: '2026-11-06',
  });
  assert.equal(saved.ok, true);
  const alice = await getCropCoefficientsViewForUser({ ownerUserId: ALICE, season: 2026, snapshot: snapshot() });
  const bob = await getCropCoefficientsViewForUser({ ownerUserId: BOB, season: 2026, snapshot: snapshot() });
  assert.ok(alice.available && bob.available);
  const carrots = alice.rootingProfiles.filter((profile) => profile.referenceCropId === 'criiam-carotte');
  assert.deepEqual(carrots.map((profile) => profile.origin), ['common', 'farm']);
  assert.equal(bob.rootingProfiles.filter((profile) => profile.origin === 'farm').length, 0);
});
