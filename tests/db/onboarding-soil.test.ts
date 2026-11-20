import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { readOnboardingStepsForUser } from '../../db/onboarding-repository';
import { addSoilRecordForUser, listZonesWithSoilForUser } from '../../db/soil-reserve/entries';
import { readSoilReserveInputsForWorkspace } from '../../db/soil-reserve/inputs';
import { ensureWorkspaceForUser } from '../../db/workspace-repository';
import { mockSnapshot } from '../../lib/adapters/mock-data';
import { parcelsWithoutSoil, soilStartingValues } from '../../lib/domain/onboarding/soil';
import { unfinishedSteps, verificationLine } from '../../lib/domain/onboarding/steps';
import { SOIL_DEFAULTS, type SoilRecord } from '../../lib/domain/soil-reserve/soil';
import { SOIL_TEXTURES, textureProposal, textureProposalText } from '../../lib/domain/soil-reserve/texture';
import { getOnboardingForUser } from '../../lib/services/onboarding-service';
import { getSoilReserveViewForUser } from '../../lib/services/soil-reserve-view';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { soilRecord } from '../support/soil-reserve-fixtures';
import { ALICE, BOB } from '../support/spaces';

/**
 * Le sol à l'accueil (4.4, docs/tranche-4-contract.md, F421, F584 ; preuves
 * 1, 2 et 3 de la section 8 bis.6) : une ferme neuve ne reçoit plus seule
 * l'eau évaporable d'un limon sableux ; la texture choisie propose TEW et REW
 * (FAO-56, tableau 19) ; le sol de chaque parcelle confirme l'étape.
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

const SEASON = 2026;
const NOW = new Date('2026-11-20T09:00:00.000Z');
const PLAN_ZONES = mockSnapshot.zones.filter((zone) => zone.seasons.includes(SEASON)).map((zone) => zone.id);

function markBeforeOnboarding(workspaceId: string) {
  for (const step of ['location', 'plots', 'soil', 'crops', 'settings']) {
    database.sqlite.prepare(
      'INSERT INTO irrigation_onboarding_steps (workspace_id, step, state, origin, proposed_value, confirmed_at, updated_at) VALUES (?, ?, \'confirmed\', \'before-onboarding\', NULL, ?, ?)',
    ).run(workspaceId, step, NOW.toISOString(), NOW.toISOString());
  }
}

/** Une saisie de parcelle comme le formulaire l'envoie, la texture choisie. */
function entry(zoneId: string, overrides: Partial<SoilRecord> = {}): Omit<SoilRecord, 'recordedAt'> {
  const record: Partial<SoilRecord> = soilRecord({ zoneId, plotId: null, texture: 'sandy-loam', tewMm: 17.5, rewMm: 8, ...overrides });
  delete record.recordedAt;
  return record as Omit<SoilRecord, 'recordedAt'>;
}

test('le tableau 19 de la FAO-56 : neuf textures, TEW et REW au milieu de leur fourchette, au demi-millimètre (F428, réponse 1)', () => {
  assert.equal(SOIL_TEXTURES.length, 9);
  const middles = Object.fromEntries(SOIL_TEXTURES.map((texture) => {
    const proposal = textureProposal(texture);
    return [texture, [proposal.tewMm, proposal.rewMm]];
  }));
  assert.deepEqual(middles, {
    sand: [9, 4.5],
    'loamy-sand': [11.5, 6],
    'sandy-loam': [17.5, 8],
    loam: [19, 9],
    'silt-loam': [21.5, 9.5],
    silt: [24, 9.5],
    'silty-clay-loam': [24.5, 9.5],
    'silty-clay': [25, 10],
    clay: [25.5, 10],
  });
  for (const texture of SOIL_TEXTURES) {
    const { tewMm, rewMm, tewRange, rewRange } = textureProposal(texture);
    assert.ok(tewRange.min <= tewMm && tewMm <= tewRange.max && rewRange.min <= rewMm && rewMm <= rewRange.max);
    assert.ok(rewMm < tewMm, 'REW reste sous TEW, comme la saisie l’exige');
  }
  assert.equal(textureProposalText('sandy-loam'), 'FAO-56, tableau 19, pour Ze = 10 cm : TEW de 15 à 20 mm, REW de 6 à 10 mm ; le milieu est proposé, à ajuster.');
});

test('ferme neuve : ni TEW 14 ni REW 7 préremplis, la part de référence et Ze dites proposées (défaut n° 4)', async () => {
  await ensureWorkspaceForUser(ALICE);
  const view = await getSoilReserveViewForUser({ ownerUserId: ALICE, season: SEASON, snapshot: mockSnapshot, now: NOW });
  assert.deepEqual(view.settings.starting, { referenceShare: SOIL_DEFAULTS.referenceShare, surfaceLayerCm: 10, tewMm: null, rewMm: null, proposed: true });
  assert.ok(view.settings.zones.every((zone) => zone.soil.current === null), 'aucun sol n’est en place');
  const onboarding = await getOnboardingForUser(ALICE);
  const withoutSoil = parcelsWithoutSoil(mockSnapshot.zones, SEASON, new Set(await listZonesWithSoilForUser(ALICE)));
  assert.deepEqual(withoutSoil, PLAN_ZONES);
  assert.deepEqual(
    unfinishedSteps(onboarding, { weather: false, plotsToClassify: 0, soilToEnter: { parcels: withoutSoil.length, anchor: `soil-parcel-${withoutSoil[0]}` } }),
    [{ id: 'soil', text: `sol de ${PLAN_ZONES.length} parcelles`, page: 'sol', anchor: `soil-parcel-${PLAN_ZONES[0]}`, count: PLAN_ZONES.length }],
  );
});

test('un espace d’avant l’accueil et la démonstration gardent leurs valeurs de départ d’avant (F426)', async () => {
  markBeforeOnboarding(await ensureWorkspaceForUser(ALICE));
  const kept = { referenceShare: SOIL_DEFAULTS.referenceShare, surfaceLayerCm: 10, tewMm: 14, rewMm: 7, proposed: false };
  assert.deepEqual((await getSoilReserveViewForUser({ ownerUserId: ALICE, season: SEASON, snapshot: mockSnapshot, now: NOW })).settings.starting, kept);
  assert.deepEqual(unfinishedSteps(await getOnboardingForUser(ALICE), { weather: true, plotsToClassify: 0, soilToEnter: { parcels: 3, anchor: 'x' } }), []);
  process.env.DEMO_MODE = 'true';
  assert.deepEqual(soilStartingValues(await getOnboardingForUser(BOB)), kept);
});

test('le sol de chaque parcelle du plan confirme l’étape, avec leur nombre ; la texture est gardée', async () => {
  const [first, second, third] = PLAN_ZONES;
  assert.equal((await addSoilRecordForUser(ALICE, entry(first), NOW, PLAN_ZONES)).ok, true);
  assert.equal((await addSoilRecordForUser(ALICE, entry(third, { texture: null, tewMm: 20, rewMm: 9 }), NOW, PLAN_ZONES)).ok, true);
  assert.deepEqual(await readOnboardingStepsForUser(ALICE), [], 'deux parcelles sur trois : l’étape reste à faire');
  // La valeur propre d'un jardin ne fait pas le sol de sa parcelle.
  assert.equal((await addSoilRecordForUser(ALICE, entry(second, { plotId: 'plot-x' }), NOW, PLAN_ZONES)).ok, true);
  assert.deepEqual(await readOnboardingStepsForUser(ALICE), [], 'le jardin seul ne compte pas pour sa parcelle');
  assert.equal((await addSoilRecordForUser(ALICE, entry(second, { texture: null, tewMm: 20, rewMm: 9 }), NOW, PLAN_ZONES)).ok, true);
  const rows = await readOnboardingStepsForUser(ALICE);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].step, 'soil');
  assert.equal(rows[0].state, 'confirmed');
  assert.deepEqual(rows[0].proposedValue, { parcels: PLAN_ZONES.length });
  const onboarding = await getOnboardingForUser(ALICE);
  const soil = onboarding.kind === 'onboarding' ? onboarding.steps.find((step) => step.id === 'soil')! : null;
  assert.match(verificationLine(soil!).text, /^Confirmé le \d+ \S+ \d{4} : sol de 3 parcelles saisi\.$/);

  const workspaceId = await ensureWorkspaceForUser(ALICE);
  const records = (await readSoilReserveInputsForWorkspace(workspaceId, '2026-01-01')).soilRecords;
  assert.deepEqual(records.map((record) => record.texture), ['sandy-loam', null, 'sandy-loam', null]);
  assert.deepEqual(parcelsWithoutSoil(mockSnapshot.zones, SEASON, new Set(await listZonesWithSoilForUser(ALICE))), []);
});

test('une texture inconnue est refusée, rien n’est écrit', async () => {
  const result = await addSoilRecordForUser(ALICE, entry(PLAN_ZONES[0], { texture: 'loess' as SoilRecord['texture'] }), NOW, PLAN_ZONES);
  assert.equal(result.ok, false);
  assert.deepEqual(await listZonesWithSoilForUser(ALICE), []);
});

test('un espace d’avant l’accueil qui saisit un sol reste d’avant l’accueil (F426)', async () => {
  markBeforeOnboarding(await ensureWorkspaceForUser(ALICE));
  for (const zoneId of PLAN_ZONES) await addSoilRecordForUser(ALICE, entry(zoneId), NOW, PLAN_ZONES);
  const rows = await readOnboardingStepsForUser(ALICE);
  assert.ok(rows.every((row) => row.origin === 'before-onboarding'));
  assert.equal((await getOnboardingForUser(ALICE)).kind, 'before-onboarding');
});

test('le sol saisi par Alice ne confirme rien pour Bob (isolation des fermes et des personnes)', async () => {
  for (const zoneId of PLAN_ZONES) await addSoilRecordForUser(ALICE, entry(zoneId), NOW, PLAN_ZONES);
  await ensureWorkspaceForUser(BOB);
  assert.deepEqual(await readOnboardingStepsForUser(BOB), []);
  assert.deepEqual(await listZonesWithSoilForUser(BOB), []);
  assert.equal((await readOnboardingStepsForUser(ALICE)).length, 1);
});
