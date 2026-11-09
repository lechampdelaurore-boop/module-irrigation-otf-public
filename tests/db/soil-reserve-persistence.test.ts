import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { listReferenceCropsForWorkspace } from '../../db/crop-water/references';
import { listSoilDaysForWorkspace, saveSoilDaysForWorkspace } from '../../db/soil-reserve/days';
import {
  addRootingProfileForUser,
  addSoilObservationForUser,
  addSoilRecordForUser,
  addSoilSettingsForUser,
  addSurfaceDeclarationForUser,
} from '../../db/soil-reserve/entries';
import { listRootingProfilesForWorkspace, readSoilReserveInputsForWorkspace } from '../../db/soil-reserve/inputs';
import { ensureWorkspaceForUser } from '../../db/workspace-repository';
import { curveStages } from '../../lib/domain/crop-water/reference';
import { bedSoilReserve } from '../../lib/domain/soil-reserve/gauge';
import { soilDayRecord, type SoilDayRecord } from '../../lib/domain/soil-reserve/records';
import { cropRooting, rootingProfileOn, rootingProfileProblems } from '../../lib/domain/soil-reserve/rooting';
import { DEFAULT_SOIL_SETTINGS, resolveBedSoil, soilSettingsOn, type SoilRecord } from '../../lib/domain/soil-reserve/soil';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { BED, bareDay, crop, cropDay, dates, FARM_SOIL, observation, staged } from '../support/soil-reserve-fixtures';

/**
 * La réserve du sol en base (docs/soil-reserve-contract.md, « Découpage et
 * preuve de fin », PR 2, migration 0025) : le jeu commun des profils
 * racinaires, les saisies de la ferme relues à l'identique et jamais
 * modifiées, les règles du domaine appliquées à l'enregistrement, chaque
 * exploitation chez elle, et l'état du jour qui se remplace quand il est
 * recalculé.
 */

const ALICE = 'alice';
const BOB = 'bob';
const NOW = new Date('2026-06-10T08:00:00.000Z');
/** Le sol de la ferme du porteur tel qu'il se saisit : l'heure d'enregistrement vient de la base. */
const FARM_SOIL_ENTRY = Object.fromEntries(Object.entries(FARM_SOIL).filter(([key]) => key !== 'recordedAt')) as Omit<SoilRecord, 'recordedAt'>;

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

test('le jeu commun : trente et un profils valides, sur des cultures et des stades qui existent (D-053, D-056)', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  const profiles = await listRootingProfilesForWorkspace(workspaceId);
  const crops = new Map((await listReferenceCropsForWorkspace(null)).map((stored) => [stored.crop.id, stored.crop]));
  assert.equal(profiles.length, 31);
  for (const profile of profiles) {
    assert.equal(profile.origin, 'common');
    assert.equal(profile.effectiveFrom, '1900-01-01');
    const reference = crops.get(profile.referenceCropId);
    assert.ok(reference, `${profile.referenceCropId} : culture de référence commune`);
    assert.deepEqual(rootingProfileProblems(profile, reference.name), []);
    const ranks = new Set(curveStages(reference.curve).map((stage) => stage.rank));
    for (const stage of profile.stages) {
      if (stage.rank !== null) assert.ok(ranks.has(stage.rank), `${profile.referenceCropId} : stade ${stage.rank}`);
    }
  }
  // La patate douce n'a pas de profil : 30 cm proposés, p 0,5 ; le céleri a son p, sans profondeur.
  assert.equal(profiles.some((profile) => profile.referenceCropId === 'fao-patate-douce'), false);
  const celery = profiles.find((profile) => profile.referenceCropId === 'fao-celeri');
  assert.deepEqual([celery?.p, celery?.stages.length], [0.2, 0]);
});

test('le jeu commun donne les profondeurs du contrat : tomate, carotte progressive, poireau, melon, céleri sans profondeur', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  const profiles = await listRootingProfilesForWorkspace(workspaceId);
  const depth = (cropId: string, rank: number, startedOn: string, date: string) => {
    const profile = rootingProfileOn(profiles, cropId, date);
    return cropRooting(profile, staged(rank, startedOn), date);
  };
  assert.deepEqual(depth('criiam-tomate', 1, '2026-05-01', '2026-05-05'), { depthM: 0.2, proposedDepth: false, p: 0.4, defaultP: false });
  assert.equal(depth('criiam-tomate', 3, '2026-06-20', '2026-07-01').depthM, 0.65);
  // Carotte, stade 2 : de 0,40 à 0,70 sur 40 jours ; 20 jours dans le stade, 0,55.
  assert.equal(Math.round(depth('criiam-carotte', 2, '2026-06-01', '2026-06-21').depthM * 100) / 100, 0.55);
  assert.equal(depth('criiam-poireau', 1, '2026-06-01', '2026-09-01').depthM, 0.35);
  assert.equal(depth('criiam-melon', 4, '2026-08-01', '2026-08-10').depthM, 0.6);
  assert.deepEqual(depth('fao-celeri', 2, '2026-06-01', '2026-06-10'), { depthM: 0.3, proposedDepth: true, p: 0.2, defaultP: false });
});

test('le sol d\'une parcelle et la valeur propre d\'un jardin se relisent à l\'identique ; 62 mm/m et 18 % de cailloux donnent 51 mm/m', async () => {
  const zone = await addSoilRecordForUser(ALICE, FARM_SOIL_ENTRY, NOW);
  assert.equal(zone.ok, true);
  const own = await addSoilRecordForUser(ALICE, { ...FARM_SOIL_ENTRY, plotId: BED.plotId, labRfuMmPerMeter: 80, stoneSharePercent: null, effectiveFrom: '2026-06-01' }, NOW);
  assert.equal(own.ok, true);
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  const inputs = await readSoilReserveInputsForWorkspace(workspaceId, '2026-06-01');
  assert.deepEqual(inputs.soilRecords, [
    { ...FARM_SOIL_ENTRY, recordedAt: NOW.toISOString() },
    { ...FARM_SOIL_ENTRY, plotId: BED.plotId, labRfuMmPerMeter: 80, stoneSharePercent: null, effectiveFrom: '2026-06-01', recordedAt: NOW.toISOString() },
  ]);
  assert.equal(resolveBedSoil(inputs.soilRecords, BED, '2026-05-31')?.soilRfuMmPerMeter, 51);
  const garden = resolveBedSoil(inputs.soilRecords, BED, '2026-06-01');
  assert.deepEqual([garden?.origin, garden?.soilRfuMmPerMeter, garden?.stonesMissing], ['plot', 80, true]);
});

test('une saisie du sol hors règles est refusée avec ses raisons, et rien n\'est écrit', async () => {
  const result = await addSoilRecordForUser(ALICE, { ...FARM_SOIL_ENTRY, labRfuMmPerMeter: 0, rewMm: 14, effectiveFrom: '2026-13-01', zoneId: ' ' }, NOW);
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.problems.some((problem) => problem.startsWith('RFU du laboratoire invalide')));
  assert.ok(!result.ok && result.problems.some((problem) => problem.startsWith('Eau facilement évaporable (REW) invalide')));
  assert.ok(!result.ok && result.problems.includes('Jour de la saisie invalide : 2026-13-01.'));
  assert.ok(!result.ok && result.problems.includes('Parcelle ou jardin manquant.'));
  assert.equal(database.sqlite.prepare('SELECT count(*) AS n FROM irrigation_soil_records').get()?.n, 0);
});

test('les saisies de la réserve du sol ne se modifient ni ne s\'effacent (D-006)', async () => {
  await addSoilRecordForUser(ALICE, FARM_SOIL_ENTRY, NOW);
  await addSoilSettingsForUser(ALICE, { ...DEFAULT_SOIL_SETTINGS, effectiveFrom: '2026-06-01' }, NOW);
  await addSoilObservationForUser(ALICE, { zoneId: BED.zoneId, plotId: null, percent: 50, observedAt: NOW.toISOString() }, NOW);
  await addSurfaceDeclarationForUser(ALICE, { bedId: BED.id, date: '2026-06-01', state: 'mulched' }, NOW);
  await addRootingProfileForUser(ALICE, {
    referenceCropId: 'criiam-ail',
    p: 0.3,
    stages: [{ rank: null, depthM: 0.3, endDepthM: null, progressionDays: null }],
    source: 'test',
    note: null,
    effectiveFrom: '2026-06-01',
  }, NOW);
  for (const [table, column, message] of [
    ['irrigation_soil_records', 'lab_rfu_mm_per_meter = 70', 'SOIL_RECORD_IMMUTABLE'],
    ['irrigation_soil_settings', 'grass_kc = 0.7', 'SOIL_SETTINGS_IMMUTABLE'],
    ['irrigation_soil_observations', 'percent = 60', 'SOIL_OBSERVATION_IMMUTABLE'],
    ['irrigation_soil_surface_declarations', "state = 'bare'", 'SOIL_SURFACE_DECLARATION_IMMUTABLE'],
  ] as const) {
    assert.throws(() => database.sqlite.exec(`UPDATE ${table} SET ${column}`), new RegExp(message), table);
    assert.throws(() => database.sqlite.exec(`DELETE FROM ${table}`), new RegExp(message), table);
  }
  // Un profil, commun ou de la ferme, ne se modifie pas ; celui de la ferme ne s'efface pas.
  const farm = "(SELECT id FROM irrigation_soil_rooting_profiles WHERE workspace_id IS NOT NULL)";
  for (const statement of [
    'UPDATE irrigation_soil_rooting_profiles SET p = 0.5',
    'UPDATE irrigation_soil_rooting_stages SET depth_m = 0.5',
    `DELETE FROM irrigation_soil_rooting_stages WHERE profile_id IN ${farm}`,
    `DELETE FROM irrigation_soil_rooting_profiles WHERE id IN ${farm}`,
  ]) {
    assert.throws(() => database.sqlite.exec(statement), /SOIL_ROOTING_PROFILE_IMMUTABLE/, statement);
  }
});

test('le jeu commun appartient aux migrations : il se vide et se réécrit, comme le fait l\'import d\'un export', () => {
  database.sqlite.exec('DELETE FROM irrigation_soil_rooting_stages');
  database.sqlite.exec('DELETE FROM irrigation_soil_rooting_profiles');
  assert.equal(database.sqlite.prepare('SELECT count(*) AS n FROM irrigation_soil_rooting_profiles').get()?.n, 0);
});

test('le seuil réglé par l\'exploitation (D-059) : 50 % se relit, 47 % est refusé par le domaine et par la base', async () => {
  const saved = await addSoilSettingsForUser(ALICE, { ...DEFAULT_SOIL_SETTINGS, threshold: { mode: 'farm', percent: 50 }, plasticMulchRainShare: 0.6, effectiveFrom: '2026-06-01' }, NOW);
  assert.equal(saved.ok, true);
  const refused = await addSoilSettingsForUser(ALICE, { ...DEFAULT_SOIL_SETTINGS, threshold: { mode: 'farm', percent: 47 }, effectiveFrom: '2026-06-02' }, NOW);
  assert.deepEqual(refused, { ok: false, problems: ["Seuil d'arrosage invalide : de 20 à 80 % du plein, par pas de 5 %."] });
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  const { settings } = await readSoilReserveInputsForWorkspace(workspaceId, '2026-06-01');
  assert.deepEqual(soilSettingsOn(settings, '2026-05-31'), DEFAULT_SOIL_SETTINGS);
  assert.deepEqual(soilSettingsOn(settings, '2026-06-01'), {
    ...DEFAULT_SOIL_SETTINGS,
    threshold: { mode: 'farm', percent: 50 },
    plasticMulchRainShare: 0.6,
    effectiveFrom: '2026-06-01',
    recordedAt: NOW.toISOString(),
  });
  assert.throws(() => database.sqlite.exec(
    `INSERT INTO irrigation_soil_settings (id, workspace_id, threshold_mode, threshold_percent, permeable_tarp_evaporation,
       mulched_evaporation, green_manure_emergence_kc, green_manure_partial_kc, green_manure_full_kc, grass_kc,
       plastic_mulch_rain_share, effective_from, recorded_at)
     VALUES ('x', '${workspaceId}', 'farm', 47, 0.1, 0.5, 0.3, 0.6, 1, 0.6, 1, '2026-06-03', '2026-06-03T00:00:00.000Z')`,
  ), /CHECK constraint failed/);
});

test('une ferme révise le profil d\'une culture à partir d\'un jour ; le profil commun reste, l\'autre ferme ne voit rien', async () => {
  const revision = {
    referenceCropId: 'criiam-tomate',
    p: 0.4,
    stages: [{ rank: 1, depthM: 0.2, endDepthM: null, progressionDays: null }, { rank: null, depthM: 0.3, endDepthM: null, progressionDays: null }],
    source: 'Contrôle à la tarière sous abri',
    note: 'Racines dans les 30 premiers cm',
    effectiveFrom: '2026-06-15',
  };
  const saved = await addRootingProfileForUser(ALICE, revision, NOW);
  assert.equal(saved.ok, true);
  const alice = await listRootingProfilesForWorkspace(await ensureWorkspaceForUser(ALICE));
  const bob = await listRootingProfilesForWorkspace(await ensureWorkspaceForUser(BOB));
  assert.equal(alice.length, 32);
  assert.equal(bob.length, 31);
  assert.equal(rootingProfileOn(alice, 'criiam-tomate', '2026-06-14')?.source.startsWith('Maximum : ITAB 50-80 cm'), true);
  assert.deepEqual(rootingProfileOn(alice, 'criiam-tomate', '2026-06-15'), { ...revision, recordedAt: NOW.toISOString(), origin: 'farm' });
  assert.equal(cropRooting(rootingProfileOn(alice, 'criiam-tomate', '2026-07-01'), staged(3, '2026-06-20'), '2026-07-01').depthM, 0.3);
  assert.equal(cropRooting(rootingProfileOn(bob, 'criiam-tomate', '2026-07-01'), staged(3, '2026-06-20'), '2026-07-01').depthM, 0.65);
});

test('revue de sécurité (D2) : rien de ce qu’une ferme saisit pour son sol ne se lit chez une autre', async () => {
  const bobWorkspace = await ensureWorkspaceForUser(BOB);
  const before = await readSoilReserveInputsForWorkspace(bobWorkspace, '2026-06-01');
  assert.equal((await addSoilRecordForUser(ALICE, FARM_SOIL_ENTRY, NOW)).ok, true);
  assert.equal((await addSoilSettingsForUser(ALICE, { ...DEFAULT_SOIL_SETTINGS, threshold: { mode: 'farm', percent: 50 }, effectiveFrom: '2026-06-01' }, NOW)).ok, true);
  assert.equal((await addSoilObservationForUser(ALICE, { zoneId: BED.zoneId, plotId: null, percent: 50, observedAt: '2026-06-10T07:00:00.000Z' }, NOW)).ok, true);
  assert.equal((await addSurfaceDeclarationForUser(ALICE, { bedId: BED.id, date: '2026-06-01', state: 'impermeable-tarp' }, NOW)).ok, true);
  assert.equal((await addRootingProfileForUser(ALICE, {
    referenceCropId: 'criiam-tomate',
    p: 0.4,
    stages: [{ rank: 1, depthM: 0.2, endDepthM: null, progressionDays: null }, { rank: null, depthM: 0.3, endDepthM: null, progressionDays: null }],
    source: 'Contrôle à la tarière sous abri',
    note: 'Racines dans les 30 premiers cm',
    effectiveFrom: '2026-06-15',
  }, NOW)).ok, true);

  const alice = await readSoilReserveInputsForWorkspace(await ensureWorkspaceForUser(ALICE), '2026-06-01');
  assert.deepEqual(
    [alice.soilRecords.length, alice.settings.length, alice.observations.length, alice.surfaceDeclarations.length, alice.rootingProfiles.filter((profile) => profile.origin === 'farm').length],
    [1, 1, 1, 1, 1],
    'chez Alice, ses cinq saisies se relisent',
  );
  assert.deepEqual(await readSoilReserveInputsForWorkspace(bobWorkspace, '2026-06-01'), before, 'chez Bob, rien n’a changé : ni sol, ni seuil, ni observation, ni état de surface, ni profil');
});

test('un profil sur une culture inconnue ou hors règles est refusé', async () => {
  const base = { p: 0.4, stages: [], source: 'test', note: null, effectiveFrom: '2026-06-15' };
  assert.deepEqual(await addRootingProfileForUser(ALICE, { ...base, referenceCropId: 'inconnue' }, NOW), { ok: false, problems: ['Culture de référence inconnue : inconnue.'] });
  const invalid = await addRootingProfileForUser(ALICE, {
    ...base,
    referenceCropId: 'criiam-tomate',
    p: 1,
    stages: [{ rank: 1, depthM: 0.2, endDepthM: 0.5, progressionDays: null }],
  }, NOW);
  assert.deepEqual(invalid, {
    ok: false,
    problems: [
      'Tomate : part utilisable p invalide (1), strictement entre 0 et 1.',
      'Tomate : profondeur progressive incomplète (profondeur finale et nombre de jours).',
    ],
  });
});

test('le curseur se règle maintenant ou la veille, jamais plus tôt ni dans le futur ; il se relit depuis la veille du jour demandé', async () => {
  const place = { zoneId: BED.zoneId, plotId: null };
  assert.equal((await addSoilObservationForUser(ALICE, { ...place, percent: 75, observedAt: '2026-06-10T07:30:00.000Z' }, NOW)).ok, true);
  assert.equal((await addSoilObservationForUser(ALICE, { ...place, percent: 50, observedAt: '2026-06-09T05:00:00.000Z' }, NOW)).ok, true);
  assert.deepEqual(await addSoilObservationForUser(ALICE, { ...place, percent: 50, observedAt: '2026-06-07T21:00:00.000Z' }, NOW), {
    ok: false,
    problems: ['Une observation se reporte au jour même ou à la veille, jamais plus tôt.'],
  });
  assert.deepEqual(await addSoilObservationForUser(ALICE, { ...place, percent: 120, observedAt: '2026-06-10T09:00:00.000Z' }, NOW), {
    ok: false,
    problems: ['État observé invalide : de 0 à 100 % du plein.', "L'heure de l'observation est dans le futur."],
  });
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  const { observations } = await readSoilReserveInputsForWorkspace(workspaceId, '2026-06-10');
  assert.deepEqual(observations.map((item) => [item.percent, item.observedAt]), [[50, '2026-06-09T05:00:00.000Z'], [75, '2026-06-10T07:30:00.000Z']]);
});

test('« maintenant » d\'un appareil dont l\'horloge avance de quelques secondes vaut l\'heure du serveur ; au-delà de deux minutes, il reste refusé', async () => {
  const place = { zoneId: BED.zoneId, plotId: null };
  const ahead = await addSoilObservationForUser(ALICE, { ...place, percent: 50, observedAt: '2026-06-10T08:00:13.000Z' }, NOW);
  assert.deepEqual(ahead, { ok: true, value: { ...place, percent: 50, observedAt: NOW.toISOString(), recordedAt: NOW.toISOString() } });
  assert.deepEqual(await addSoilObservationForUser(ALICE, { ...place, percent: 50, observedAt: '2026-06-10T08:02:01.000Z' }, NOW), {
    ok: false,
    problems: ["L'heure de l'observation est dans le futur."],
  });
  assert.deepEqual((await readSoilReserveInputsForWorkspace(await ensureWorkspaceForUser(BOB), '2026-06-10')).observations, []);
});

test('l\'état de surface d\'une planche se relit ; un état inconnu est refusé', async () => {
  assert.equal((await addSurfaceDeclarationForUser(ALICE, { bedId: BED.id, date: '2026-06-01', state: 'impermeable-tarp' }, NOW)).ok, true);
  const refused = await addSurfaceDeclarationForUser(ALICE, { bedId: BED.id, date: '2026-06-01', state: 'gravier' as never }, NOW);
  assert.deepEqual(refused, { ok: false, problems: ['État de surface inconnu : gravier.'] });
  const { surfaceDeclarations } = await readSoilReserveInputsForWorkspace(await ensureWorkspaceForUser(ALICE), '2026-06-01');
  assert.deepEqual(surfaceDeclarations, [{ bedId: BED.id, date: '2026-06-01', state: 'impermeable-tarp', recordedAt: NOW.toISOString() }]);
});

test('la jauge se calcule sur les entrées lues en base ; l\'état des jours passés s\'enregistre et un recalcul le remplace', async () => {
  await addSoilRecordForUser(ALICE, FARM_SOIL_ENTRY, NOW);
  await addSoilObservationForUser(ALICE, { zoneId: BED.zoneId, plotId: null, percent: 100, observedAt: '2026-06-09T04:00:00.000Z' }, NOW);
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  const days = dates('2026-06-08', 5);
  const waterDays = [
    bareDay(days[0], 4),
    bareDay(days[1], 4),
    ...days.slice(2).map((date) => cropDay(date, [crop({ referenceCropId: 'criiam-tomate', rank: 1, startedOn: '2026-06-10', etmMm: 2 })])),
  ];
  const compute = async () => {
    const inputs = await readSoilReserveInputsForWorkspace(workspaceId, days[0]);
    return bedSoilReserve({
      bed: BED,
      today: '2026-06-10',
      waterDays,
      rain: new Map(days.map((date) => [date, { mm: 0, nature: 'gauge' as const }])),
      irrigations: [],
      soilRecords: inputs.soilRecords,
      rootingProfiles: inputs.rootingProfiles,
      referenceCrops: [],
      upcomingCrops: [{ presenceStart: '2026-06-10', referenceCropId: 'criiam-tomate' }],
      observations: inputs.observations,
      surfaceDeclarations: inputs.surfaceDeclarations,
      settings: inputs.settings,
      waterSettings: { bedId: BED.id, shelterId: null, shelterFactors: [], mulch: [] },
      forecastRainShare: 1,
    });
  };
  const gauge = await compute();
  assert.deepEqual(gauge.map((day) => day.unknown?.kind ?? null), ['not-started', null, null, null, null]);
  // Plein le 9 au matin à 30 cm, la profondeur de la tomate qui suit ; la tomate à 0,20 m le 10 : 10,2 mm.
  assert.equal(gauge[2].capacityMm, 51 * 0.2);
  const records = gauge.map((day) => soilDayRecord(BED.id, day)).filter((record): record is SoilDayRecord => record !== null);
  assert.deepEqual(records.map((record) => record.date), ['2026-06-08', '2026-06-09']);
  await saveSoilDaysForWorkspace(workspaceId, records, NOW);
  const stored = await listSoilDaysForWorkspace(workspaceId, '2026-06-01', '2026-06-30');
  assert.deepEqual(stored, records.map((record) => ({ ...record, computedAt: NOW.toISOString() })));
  assert.equal(stored[1].mode, 'bare');
  assert.equal(stored[1].restart, 'observation');
  assert.equal(stored[0].unknownKind, 'not-started');

  // Une observation de la veille, plus basse, change le 9 : la ligne recalculée remplace l'ancienne.
  await addSoilObservationForUser(ALICE, { zoneId: BED.zoneId, plotId: null, percent: 40, observedAt: '2026-06-09T06:00:00.000Z' }, NOW);
  const later = new Date('2026-06-10T09:00:00.000Z');
  const recomputed = (await compute()).map((day) => soilDayRecord(BED.id, day)).filter((record): record is SoilDayRecord => record !== null);
  await saveSoilDaysForWorkspace(workspaceId, recomputed, later);
  const replaced = await listSoilDaysForWorkspace(workspaceId, '2026-06-01', '2026-06-30');
  assert.equal(replaced.length, 2);
  assert.ok((replaced[1].stateMm ?? Infinity) < (stored[1].stateMm ?? 0));
  assert.equal(replaced[1].computedAt, later.toISOString());
  assert.deepEqual(await listSoilDaysForWorkspace(await ensureWorkspaceForUser(BOB), '2026-06-01', '2026-06-30'), []);
});

test('la base refuse ce que le domaine refuse : profondeur nulle, % hors bornes, état de surface inconnu', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  assert.throws(() => database.sqlite.exec(
    `INSERT INTO irrigation_soil_observations (id, workspace_id, otf_zone_id, percent, observed_at, recorded_at)
     VALUES ('o', '${workspaceId}', 'parcelle', 101, '2026-06-10T08:00:00.000Z', '2026-06-10T08:00:00.000Z')`,
  ), /CHECK constraint failed/);
  assert.throws(() => database.sqlite.exec(
    `INSERT INTO irrigation_soil_surface_declarations (id, workspace_id, otf_bed_id, date, state, recorded_at)
     VALUES ('d', '${workspaceId}', 'planche', '2026-06-10', 'gravier', '2026-06-10T08:00:00.000Z')`,
  ), /CHECK constraint failed/);
  assert.throws(() => database.sqlite.exec(
    `INSERT INTO irrigation_soil_rooting_stages (profile_id, position, stage_rank, depth_m) VALUES ('soil-criiam-ail', 9, 7, 0)`,
  ), /CHECK constraint failed/);
  assert.throws(() => database.sqlite.exec(
    `INSERT INTO irrigation_soil_rooting_stages (profile_id, position, stage_rank, depth_m) VALUES ('soil-criiam-ail', 9, 1, 0.4)`,
  ), /UNIQUE constraint failed/);
  // Observation de la fixture : la forme du domaine est celle que la base relit.
  assert.deepEqual(Object.keys(observation(50, '2026-06-10T08:00:00.000Z')).sort(), ['observedAt', 'percent', 'plotId', 'recordedAt', 'zoneId']);
});
