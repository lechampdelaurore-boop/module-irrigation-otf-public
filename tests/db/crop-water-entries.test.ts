import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import {
  addKcOverrideForUser,
  addStageDeclarationForUser,
  deleteSpeciesCorrespondenceForUser,
  listKcOverridesForWorkspace,
  listSpeciesCorrespondencesForWorkspace,
  listStageDeclarationsForWorkspace,
  saveSpeciesCorrespondenceForUser,
} from '../../db/crop-water/entries';
import { listReferenceCropsForWorkspace, saveFarmReferenceCropForUser } from '../../db/crop-water/references';
import {
  addShadeNetForUser,
  addShelterFactorForUser,
  readCropWaterSettingsForWorkspace,
  removeShadeNetForUser,
  saveBedMulchForUser,
  saveCropWaterOptionsForUser,
} from '../../db/crop-water/settings';
import { ensureWorkspaceForUser } from '../../db/workspace-repository';
import { resolveCorrespondence } from '../../lib/domain/crop-water/species';
import { ARTICHOKE } from '../support/crop-water-references';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';

/**
 * Les saisies de la ferme en base (docs/crop-water-need-contract.md, « Les
 * données », « Les facteurs », migration 0023) : surcharges de Kc et stades
 * déclarés, révisions datées jamais modifiées ni effacées (D-006) ;
 * correspondance des espèces par espèce et par série ; K_abri, paillage,
 * filets et options. Chaque écriture reste dans son exploitation.
 */

const ALICE = 'alice';
const BOB = 'bob';
const MORNING = new Date('2026-11-06T07:00:00.000Z');
const LATER = new Date('2026-11-06T08:00:00.000Z');

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

test('une surcharge de Kc s\'ajoute, datée, et se relit ; elle n\'est jamais modifiée ni effacée', async () => {
  const added = await addKcOverrideForUser(ALICE, { referenceCropId: 'criiam-tomate', target: { rank: 2 }, kc: 0.65, effectiveFrom: '2026-05-01' }, MORNING);
  assert.deepEqual(added, {
    ok: true,
    value: { referenceCropId: 'criiam-tomate', target: { rank: 2 }, kc: 0.65, effectiveFrom: '2026-05-01', recordedAt: MORNING.toISOString() },
  });
  await addKcOverrideForUser(ALICE, { referenceCropId: 'fao-brocoli', target: { fao: 'mid' }, kc: 0.95, effectiveFrom: '2026-05-01' }, LATER);
  await addKcOverrideForUser(ALICE, { referenceCropId: 'criiam-tomate', target: { rank: 2 }, kc: null, effectiveFrom: '2026-07-01' }, LATER);
  const workspace = await ensureWorkspaceForUser(ALICE);
  assert.deepEqual(await listKcOverridesForWorkspace(workspace), [
    { referenceCropId: 'criiam-tomate', target: { rank: 2 }, kc: 0.65, effectiveFrom: '2026-05-01', recordedAt: MORNING.toISOString() },
    { referenceCropId: 'fao-brocoli', target: { fao: 'mid' }, kc: 0.95, effectiveFrom: '2026-05-01', recordedAt: LATER.toISOString() },
    { referenceCropId: 'criiam-tomate', target: { rank: 2 }, kc: null, effectiveFrom: '2026-07-01', recordedAt: LATER.toISOString() },
  ]);
  assert.throws(() => database.sqlite.exec('UPDATE irrigation_crop_kc_overrides SET kc = 0.1'), /CROP_KC_OVERRIDE_IMMUTABLE/);
  assert.throws(() => database.sqlite.exec('DELETE FROM irrigation_crop_kc_overrides'), /CROP_KC_OVERRIDE_IMMUTABLE/);
  assert.deepEqual(await listKcOverridesForWorkspace(await ensureWorkspaceForUser(BOB)), [], 'l\'autre ferme ne la voit pas');
});

test('une surcharge est refusée pour une culture inconnue, un stade absent, une cible de la mauvaise forme ou un Kc hors bornes', async () => {
  const refusals = await Promise.all([
    addKcOverrideForUser(ALICE, { referenceCropId: 'inconnue', target: { rank: 1 }, kc: 0.5, effectiveFrom: '2026-05-01' }),
    addKcOverrideForUser(ALICE, { referenceCropId: 'criiam-tomate', target: { rank: 9 }, kc: 0.5, effectiveFrom: '2026-05-01' }),
    addKcOverrideForUser(ALICE, { referenceCropId: 'criiam-tomate', target: { fao: 'mid' }, kc: 0.5, effectiveFrom: '2026-05-01' }),
    addKcOverrideForUser(ALICE, { referenceCropId: 'fao-brocoli', target: { rank: 1 }, kc: 0.5, effectiveFrom: '2026-05-01' }),
    addKcOverrideForUser(ALICE, { referenceCropId: 'criiam-tomate', target: { rank: 1 }, kc: 1.4, effectiveFrom: '2026-05-01' }),
    addKcOverrideForUser(ALICE, { referenceCropId: 'criiam-tomate', target: { rank: 1 }, kc: 0.5, effectiveFrom: '2026-02-30' }),
  ]);
  assert.deepEqual(refusals.map((result) => (result.ok ? 'accepté' : result.problems[0])), [
    'Culture de référence inconnue : inconnue.',
    "Tomate : le stade 9 n'existe pas.",
    'Tomate : une surcharge porte sur un stade.',
    'Brocoli : une culture de la FAO se surcharge par ses Kc de début, de pleine saison et de fin.',
    'Kc hors bornes pour Tomate : 1,4 (entre 0 et 1,3).',
    'Jour de la surcharge invalide : 2026-02-30.',
  ]);
  assert.equal(database.sqlite.prepare('SELECT count(*) AS n FROM irrigation_crop_kc_overrides').get()?.n, 0);
});

test('la correspondance des espèces : par espèce, une exception par série, remplacée au même niveau, retirée, jamais vers une culture inconnue', async () => {
  const workspace = await ensureWorkspaceForUser(ALICE);
  const garlic = { plantId: 'plant-ail', seriesId: null, target: { kind: 'reference', referenceCropId: 'criiam-ail', analogy: false } } as const;
  assert.equal((await saveSpeciesCorrespondenceForUser(ALICE, garlic)).ok, true);
  await saveSpeciesCorrespondenceForUser(ALICE, { plantId: 'plant-ail', seriesId: 'aillet', target: { kind: 'reference', referenceCropId: 'fao-oignon-vert', analogy: false } });
  await saveSpeciesCorrespondenceForUser(ALICE, { plantId: 'plant-ail', seriesId: 'allium', target: { kind: 'without-reference' } });
  await saveSpeciesCorrespondenceForUser(ALICE, { plantId: 'plant-mache', seriesId: null, target: { kind: 'reference', referenceCropId: 'criiam-salade-ete', analogy: true } });
  await saveSpeciesCorrespondenceForUser(ALICE, { plantId: 'plant-engrais-vert', seriesId: null, target: { kind: 'surface-state' } });
  // Un rattachement nouveau remplace le précédent au même niveau.
  await saveSpeciesCorrespondenceForUser(ALICE, { plantId: 'plant-mache', seriesId: null, target: { kind: 'without-reference' } });

  const entries = await listSpeciesCorrespondencesForWorkspace(workspace);
  assert.deepEqual(entries, [
    garlic,
    { plantId: 'plant-ail', seriesId: 'aillet', target: { kind: 'reference', referenceCropId: 'fao-oignon-vert', analogy: false } },
    { plantId: 'plant-ail', seriesId: 'allium', target: { kind: 'without-reference' } },
    { plantId: 'plant-engrais-vert', seriesId: null, target: { kind: 'surface-state' } },
    { plantId: 'plant-mache', seriesId: null, target: { kind: 'without-reference' } },
  ]);
  assert.deepEqual(resolveCorrespondence(entries, 'aillet', 'plant-ail'), { kind: 'reference', referenceCropId: 'fao-oignon-vert', analogy: false, exception: true });
  assert.deepEqual(resolveCorrespondence(entries, 'ail-sec', 'plant-ail'), { kind: 'reference', referenceCropId: 'criiam-ail', analogy: false, exception: false });

  assert.equal(await deleteSpeciesCorrespondenceForUser(ALICE, 'plant-ail', 'allium'), true);
  assert.equal(await deleteSpeciesCorrespondenceForUser(ALICE, 'plant-ail', 'allium'), false);
  assert.equal(await deleteSpeciesCorrespondenceForUser(BOB, 'plant-ail', null), false, 'une autre ferme ne retire rien');
  assert.equal((await listSpeciesCorrespondencesForWorkspace(workspace)).length, 4);

  const unknown = await saveSpeciesCorrespondenceForUser(ALICE, { plantId: 'plant-x', seriesId: null, target: { kind: 'reference', referenceCropId: 'local-oseille', analogy: false } });
  assert.deepEqual(unknown, { ok: false, problems: ['Culture de référence inconnue : local-oseille.'] });
  assert.deepEqual(await listSpeciesCorrespondencesForWorkspace(await ensureWorkspaceForUser(BOB)), []);
  assert.throws(() => database.sqlite.exec(`INSERT INTO irrigation_crop_species_links (id, workspace_id, plant_id, series_id, target_kind, crop_key, analogy)
    VALUES ('x', '${workspace}', 'plant-y', NULL, 'without-reference', NULL, 1)`), /CHECK constraint failed/, 'une analogie suppose une culture de référence');
});

test('un stade déclaré s\'ajoute pour une saison et ne s\'efface jamais : une correction est une déclaration nouvelle', async () => {
  const declaration = { seriesId: 'tomate', bedId: null, referenceCropId: 'criiam-tomate', rank: 2, date: '2026-05-10' };
  const added = await addStageDeclarationForUser(ALICE, 2026, declaration, MORNING);
  assert.deepEqual(added, { ok: true, value: { ...declaration, recordedAt: MORNING.toISOString() } });
  await addStageDeclarationForUser(ALICE, 2026, { ...declaration, bedId: 'planche-a', date: '2026-05-12' }, LATER);
  await addStageDeclarationForUser(ALICE, 2025, { ...declaration, date: '2025-05-10' }, LATER);
  const workspace = await ensureWorkspaceForUser(ALICE);
  assert.deepEqual(await listStageDeclarationsForWorkspace(workspace, 2026), [
    { ...declaration, recordedAt: MORNING.toISOString() },
    { ...declaration, bedId: 'planche-a', date: '2026-05-12', recordedAt: LATER.toISOString() },
  ]);
  assert.equal((await listStageDeclarationsForWorkspace(workspace, 2025)).length, 1, 'chaque saison garde les siennes');
  assert.deepEqual(await listStageDeclarationsForWorkspace(await ensureWorkspaceForUser(BOB), 2026), []);
  assert.throws(() => database.sqlite.exec('UPDATE irrigation_crop_stage_declarations SET stage_rank = 3'), /CROP_STAGE_DECLARATION_IMMUTABLE/);
  assert.throws(() => database.sqlite.exec('DELETE FROM irrigation_crop_stage_declarations'), /CROP_STAGE_DECLARATION_IMMUTABLE/);

  const refusals = await Promise.all([
    addStageDeclarationForUser(ALICE, 2026, { ...declaration, rank: 7 }),
    addStageDeclarationForUser(ALICE, 2026, { ...declaration, referenceCropId: 'inconnue' }),
    addStageDeclarationForUser(ALICE, 2026, { ...declaration, date: '10/05/2026' }),
  ]);
  assert.deepEqual(refusals.map((result) => (result.ok ? 'accepté' : result.problems[0])), [
    "Tomate : le stade 7 n'existe pas.",
    'Culture de référence inconnue : inconnue.',
    'Jour du stade invalide : 10/05/2026.',
  ]);
  // Une culture de la FAO se déclare par ses quatre phases.
  assert.equal((await addStageDeclarationForUser(ALICE, 2026, { ...declaration, referenceCropId: 'fao-brocoli', rank: 4 })).ok, true);
  assert.equal((await addStageDeclarationForUser(ALICE, 2026, { ...declaration, referenceCropId: 'fao-brocoli', rank: 5 })).ok, false);
});

test('les déclarations et surcharges d\'une culture de la ferme se valident sur sa version : l\'artichaut garde ses stades', async () => {
  assert.equal((await saveFarmReferenceCropForUser(ALICE, {
    ...ARTICHOKE,
    curve: ARTICHOKE.curve.shape === 'calendar' ? { ...ARTICHOKE.curve, stages: ARTICHOKE.curve.stages.map((stage) => (stage.rank === 3 ? { ...stage, start: '07-25' } : stage)) } : ARTICHOKE.curve,
  }, { sourceUrl: null, datesSource: 'Ferme' })).ok, true);
  const workspace = await ensureWorkspaceForUser(ALICE);
  const farm = (await listReferenceCropsForWorkspace(workspace)).find((stored) => stored.crop.id === ARTICHOKE.id);
  assert.equal(farm?.origin, 'farm');
  assert.deepEqual(farm?.problems, []);
  assert.equal(farm?.crop.curve.shape === 'calendar' ? farm.crop.curve.stages[0].start : null, '07-25');
  assert.deepEqual(farm?.crop.curve.shape === 'calendar' ? farm.crop.curve.establishment : null, ARTICHOKE.curve.shape === 'calendar' ? ARTICHOKE.curve.establishment : null);
  assert.equal((await addStageDeclarationForUser(ALICE, 2026, { seriesId: 's', bedId: null, referenceCropId: ARTICHOKE.id, rank: 1, date: '2026-04-01' })).ok, true, 'l\'installation se déclare');
  assert.equal((await addKcOverrideForUser(ALICE, { referenceCropId: ARTICHOKE.id, target: { rank: 2 }, kc: 0.6, effectiveFrom: '2026-04-01' })).ok, false, 'le rang 2 n\'est pas dans son calendrier');
});

test('les réglages : K_abri daté et immuable, paillage par planche et par saison, filets posés puis retirés, options désactivées par défaut', async () => {
  const workspace = await ensureWorkspaceForUser(ALICE);
  assert.deepEqual(await readCropWaterSettingsForWorkspace(workspace), {
    shelterFactors: [], mulch: [], shadeNets: [], options: { smoothing: false, shading: false },
  });

  assert.equal((await addShelterFactorForUser(ALICE, { shelterId: 'jardin-serre', value: 0.7, effectiveFrom: '2026-06-01' }, MORNING)).ok, true);
  const refused = await addShelterFactorForUser(ALICE, { shelterId: 'jardin-serre', value: 0.55, effectiveFrom: '2026-06-01' });
  assert.deepEqual(refused, { ok: false, problems: ['K_abri invalide : il se règle de 0,6 à 1.'] });
  assert.throws(() => database.sqlite.exec('UPDATE irrigation_crop_shelter_factors SET factor = 0.9'), /CROP_SHELTER_FACTOR_IMMUTABLE/);
  assert.throws(() => database.sqlite.exec('DELETE FROM irrigation_crop_shelter_factors'), /CROP_SHELTER_FACTOR_IMMUTABLE/);

  await saveBedMulchForUser(ALICE, { bedId: 'planche-a', season: 2026, plasticMulch: true });
  await saveBedMulchForUser(ALICE, { bedId: 'planche-a', season: 2026, plasticMulch: false });
  await saveBedMulchForUser(ALICE, { bedId: 'planche-a', season: 2027, plasticMulch: true });

  const net = await addShadeNetForUser(ALICE, { bedId: 'planche-a', rate: 0.45, from: '2026-06-01', to: null });
  assert.equal(net.ok, true);
  if (!net.ok) return;
  assert.deepEqual(await addShadeNetForUser(ALICE, { bedId: 'planche-a', rate: 1, from: '2026-06-01', to: null }), {
    ok: false, problems: ["Taux d'ombrage invalide : de 0 à moins de 100 %."],
  });
  assert.deepEqual(await removeShadeNetForUser(ALICE, net.value.id, '2026-05-31'), {
    ok: false, problems: ["Le filet d'ombrage est retiré avant d'être posé."],
  });
  assert.equal(await removeShadeNetForUser(BOB, net.value.id, '2026-08-31'), null, 'une autre ferme ne retire pas ce filet');
  assert.equal((await removeShadeNetForUser(ALICE, net.value.id, '2026-08-31'))?.ok, true);

  await saveCropWaterOptionsForUser(ALICE, { smoothing: false, shading: true });
  assert.deepEqual(await readCropWaterSettingsForWorkspace(workspace), {
    shelterFactors: [{ shelterId: 'jardin-serre', value: 0.7, effectiveFrom: '2026-06-01', recordedAt: MORNING.toISOString() }],
    mulch: [{ bedId: 'planche-a', season: 2026, plasticMulch: false }, { bedId: 'planche-a', season: 2027, plasticMulch: true }],
    shadeNets: [{ id: net.value.id, bedId: 'planche-a', rate: 0.45, from: '2026-06-01', to: '2026-08-31' }],
    options: { smoothing: false, shading: true },
  });
  assert.deepEqual(await readCropWaterSettingsForWorkspace(await ensureWorkspaceForUser(BOB)), {
    shelterFactors: [], mulch: [], shadeNets: [], options: { smoothing: false, shading: false },
  }, 'rien ne franchit la frontière entre exploitations');
});
