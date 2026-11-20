import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { saveWeatherPreferenceForUser } from '../../db/water-management-repository';
import { ensureWorkspaceForUser } from '../../db/workspace-repository';
import { mockSnapshot } from '../../lib/adapters/mock-data';
import { cropOriginText, cropRegionWarning, regionOfPostcode } from '../../lib/domain/onboarding/regions';
import { getCropCoefficientsViewForUser } from '../../lib/services/crop-water-coefficients';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { confirmFarmLocation } from '../support/onboarding';
import { ALICE, BOB } from '../support/spaces';

/**
 * La région d'origine des cultures (4.4, docs/tranche-4-contract.md, F422,
 * F428 réponse 3, F586) : chaque culture dit d'où viennent ses dates de
 * stade ; une ferme neuve d'une autre région que le Sud / Occitanie est
 * avertie sur les cultures du CRIIAM, jamais sur celles de la FAO-56 ; la
 * ferme d'avant l'accueil et la démonstration ne le sont pas (F426).
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
const CRIIAM = 'criiam-asperge';

function markBeforeOnboarding(workspaceId: string) {
  for (const step of ['location', 'plots', 'soil', 'crops', 'settings']) {
    database.sqlite.prepare(
      'INSERT INTO irrigation_onboarding_steps (workspace_id, step, state, origin, proposed_value, confirmed_at, updated_at) VALUES (?, ?, \'confirmed\', \'before-onboarding\', NULL, ?, ?)',
    ).run(workspaceId, step, NOW.toISOString(), NOW.toISOString());
  }
}

async function regionsOf(spaceKey: string) {
  const view = await getCropCoefficientsViewForUser({ ownerUserId: spaceKey, season: 2026, snapshot: mockSnapshot, now: NOW });
  assert.equal(view.available, true);
  return view.available ? { regions: view.regions, crops: view.crops } : { regions: {}, crops: [] };
}

const warned = (regions: Awaited<ReturnType<typeof regionsOf>>['regions']) => Object.entries(regions).filter(([, region]) => region.warning !== null).map(([id]) => id);

test('le code postal donne l’une des treize régions ; outre-mer et codes inconnus : aucune', () => {
  assert.deepEqual(regionOfPostcode('35000'), { id: 'bre', label: 'Bretagne' });
  assert.equal(regionOfPostcode('84000')?.id, 'pac');
  assert.equal(regionOfPostcode('34000')?.id, 'occ');
  assert.equal(regionOfPostcode('26400')?.id, 'ara');
  assert.equal(regionOfPostcode('20000')?.id, 'cor');
  assert.equal(regionOfPostcode(' 75011 ')?.label, 'Île-de-France');
  for (const unknown of ['97400', '98800', '00000', '3500', 'abcde', '', null, undefined]) assert.equal(regionOfPostcode(unknown), null, String(unknown));
});

test('chaque culture dit d’où viennent ses dates de stade', () => {
  assert.match(cropOriginText('criiam', 'common'), /Sud \/ Occitanie/);
  assert.match(cropOriginText('fao56', 'common'), /générales \(FAO-56\), sans région/);
  assert.equal(cropOriginText('criiam', 'farm'), 'Dates de stade de votre ferme.');
});

test('ferme neuve en Bretagne : avertie sur les cultures du CRIIAM, jamais sur celles de la FAO-56 (F422)', async () => {
  await confirmFarmLocation(ALICE, mockSnapshot.structure);
  const { regions, crops } = await regionsOf(ALICE);
  const criiam = crops.filter((stored) => stored.crop.source === 'criiam').map((stored) => stored.crop.id).sort();
  assert.ok(criiam.length > 0);
  assert.deepEqual(warned(regions).sort(), criiam);
  assert.equal(regions[CRIIAM].warning, 'Ces dates viennent d’une autre région que la vôtre (Bretagne) : vérifiez-les.');
  const fao = crops.find((stored) => stored.crop.source === 'fao56')!;
  assert.equal(regions[fao.crop.id].warning, null);
  assert.match(regions[fao.crop.id].origin, /FAO-56/);
});

test('ferme neuve du Vaucluse : la région des dates est la sienne, aucun avertissement', async () => {
  await saveWeatherPreferenceForUser(ALICE, { locationMode: 'custom', customCity: 'Avignon', customPostcode: '84000' });
  assert.deepEqual(warned((await regionsOf(ALICE)).regions), []);
});

test('ferme neuve sans commune confirmée : la région n’est pas connue, aucun avertissement', async () => {
  await ensureWorkspaceForUser(ALICE);
  const { regions } = await regionsOf(ALICE);
  assert.deepEqual(warned(regions), []);
  assert.match(regions[CRIIAM].origin, /Sud \/ Occitanie/);
});

test('la ferme d’avant l’accueil et la démonstration ne sont pas averties (F426)', async () => {
  markBeforeOnboarding(await ensureWorkspaceForUser(ALICE));
  await saveWeatherPreferenceForUser(ALICE, { locationMode: 'custom', customCity: 'Rennes', customPostcode: '35000' });
  assert.deepEqual(warned((await regionsOf(ALICE)).regions), []);
  process.env.DEMO_MODE = 'true';
  assert.deepEqual(warned((await regionsOf(BOB)).regions), []);
});

test('la région d’une ferme ne passe pas à l’autre', async () => {
  await confirmFarmLocation(ALICE, mockSnapshot.structure);
  await saveWeatherPreferenceForUser(BOB, { locationMode: 'custom', customCity: 'Avignon', customPostcode: '84000' });
  assert.ok(warned((await regionsOf(ALICE)).regions).includes(CRIIAM));
  assert.deepEqual(warned((await regionsOf(BOB)).regions), []);
});

test('l’avertissement ne vaut que pour une culture commune du CRIIAM d’une ferme qui fait l’accueil', () => {
  const brittany = regionOfPostcode('35000');
  const onboarding: Parameters<typeof cropRegionWarning>[0]['onboarding'] = { kind: 'onboarding', steps: [], remaining: [] };
  assert.notEqual(cropRegionWarning({ source: 'criiam', origin: 'common', farmRegion: brittany, onboarding }), null);
  assert.equal(cropRegionWarning({ source: 'criiam', origin: 'farm', farmRegion: brittany, onboarding }), null, 'dates de la ferme');
  assert.equal(cropRegionWarning({ source: 'local', origin: 'common', farmRegion: brittany, onboarding }), null);
  assert.equal(cropRegionWarning({ source: 'criiam', origin: 'common', farmRegion: regionOfPostcode('34000'), onboarding }), null, 'Occitanie');
});
