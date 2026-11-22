import assert from 'node:assert/strict';
import test, { afterEach, beforeEach, mock } from 'node:test';
import { addKcOverrideForUser, addStageDeclarationForUser, saveSpeciesCorrespondenceForUser } from '../../db/crop-water/entries';
import { saveFarmReferenceCropForUser } from '../../db/crop-water/references';
import { saveSensitiveStagesForUser } from '../../db/crop-water/sensitive-stages';
import { saveGardenGroupForUser } from '../../db/garden-group-repository';
import { savePumpForUser } from '../../db/pump-repository';
import { addRootingProfileForUser } from '../../db/soil-reserve/entries';
import { deleteResourceMeterReadingForUser, saveResourceMeterReadingForUser } from '../../db/water-resource-flow-repository';
import {
  correctWaterReservoirVolumeForUser,
  saveWaterReservoirForUser,
  saveWaterResourceForUser,
} from '../../db/water-resource-repository';
import { ensureWorkspaceForUser } from '../../db/workspace-repository';
import type { PumpDraft } from '../../lib/domain/pumps';
import type { ReferenceCrop } from '../../lib/domain/crop-water/reference';
import { resetFarmDurationsForUser } from '../../lib/services/crop-water-durations';
import { validatePumpAssignmentForUser } from '../../lib/services/pump-service';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { TOMATO } from '../support/crop-water-references';
import { ALICE, BOB } from '../support/spaces';

/**
 * « Bob désigne l'objet d'Alice » (docs/tranche-4-contract.md, F380 ;
 * constat C1 de la revue de l'isolation du 18 novembre 2026). Pour chaque
 * action qui reçoit du navigateur l'identifiant d'un objet et qui n'avait pas
 * encore ce test : Bob, dans son espace, nomme l'objet d'Alice ; l'action est
 * refusée, l'objet d'Alice ne change pas, et le contrôle de cohérence des
 * espaces, joué à la fin de chaque test, ne trouve aucune ligne de Bob qui
 * désigne une ligne d'Alice.
 */

let database: TestDatabase;

beforeEach(() => {
  database = installTestDatabase();
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-23T06:00:00.000Z') });
});

afterEach(() => {
  mock.timers.reset();
  database.dispose();
});

const resourceDraft = { name: 'Forage', type: 'borehole', nominalFlowCubicMetersPerHour: 2, status: 'active', availableFrom: null, availableUntil: null, notes: null } as const;
const reservoirDraft = {
  name: 'Tampon', type: 'buffer', capacityCubicMeters: 60, currentVolumeCubicMeters: 40, minimumSafetyCubicMeters: 5,
  exposedSurfaceSquareMeters: 30, receivesRain: true, evaporationEnabled: false, evaporationCoefficient: 0, status: 'active', notes: null,
} as const;
const pumpDraft = (name: string, overrides: Partial<PumpDraft> = {}): PumpDraft => ({
  name, maximumFlowCubicMetersPerHour: 8, status: 'active', notes: null, origins: [], ...overrides,
});

/** Une culture saisie par la ferme d'Alice, que le jeu commun n'a pas. */
const ALICE_CROP: ReferenceCrop = { ...TOMATO, id: 'tomate-de-la-ferme-d-alice', name: 'Tomate de la ferme d’Alice', source: 'local' };

const one = (sql: string, ...values: string[]) => database.sqlite.prepare(sql).get(...values) as Record<string, unknown> | undefined;

test('Bob corrige le volume de la réserve d’Alice : refusé, le volume d’Alice reste le sien', async () => {
  const tampon = await saveWaterReservoirForUser(ALICE, ALICE, null, reservoirDraft, '2026-09-21T06:00:00.000Z');
  await ensureWorkspaceForUser(BOB);
  await assert.rejects(
    correctWaterReservoirVolumeForUser(BOB, BOB, tampon, 10, '2026-09-22T06:00:00.000Z', 'mesure'),
    /Réserve introuvable/,
  );
  assert.equal(one('SELECT current_volume_cubic_meters AS volume FROM irrigation_water_reservoirs WHERE id = ?', tampon)?.volume, 40);
  assert.equal(one('SELECT count(*) AS count FROM irrigation_water_stock_movements WHERE reservoir_id = ?', tampon)?.count, 0);
});

test('Bob efface un relevé de compteur d’Alice : refusé, le relevé reste', async () => {
  const forage = await saveWaterResourceForUser(ALICE, ALICE, null, resourceDraft);
  const reading = await saveResourceMeterReadingForUser(ALICE, ALICE, forage, {
    takenAt: '2026-09-21T06:00:00.000Z', meterIndexCubicMeters: 1_240, stoppedSeconds: 0, meterReplaced: false, note: null,
  });
  await ensureWorkspaceForUser(BOB);
  await assert.rejects(deleteResourceMeterReadingForUser(BOB, reading), /Relevé introuvable/);
  assert.equal(one('SELECT count(*) AS count FROM irrigation_water_resource_meter_readings WHERE id = ?', reading)?.count, 1);
});

test('Bob renomme un groupe de jardins d’Alice : refusé, le groupe d’Alice garde son nom et ses jardins', async () => {
  const members = [{ otfZoneId: 'zone-1', otfPlotId: 'plot-1', position: 1, bedOrder: 'normal' as const, gapBeforeMeters: 0 }];
  const serres = await saveGardenGroupForUser(ALICE, null, { name: 'Serres', season: 2026, members });
  assert.ok(serres);
  assert.equal(await saveGardenGroupForUser(BOB, serres, { name: 'Pris par Bob', season: 2026, members: [] }), null);
  assert.equal(one('SELECT name FROM irrigation_garden_groups WHERE id = ?', serres)?.name, 'Serres');
  assert.equal(one('SELECT count(*) AS count FROM irrigation_garden_group_members WHERE group_id = ?', serres)?.count, 1);
});

test('Bob modifie la pompe d’Alice ou lui donne pour origine le forage d’Alice : refusé', async () => {
  const forage = await saveWaterResourceForUser(ALICE, ALICE, null, resourceDraft);
  const pump = await savePumpForUser(ALICE, ALICE, null, pumpDraft('Pompe du forage', {
    origins: [{ sourceKind: 'resource', resourceId: forage, reservoirId: null, isDefault: true }],
  }));
  await ensureWorkspaceForUser(BOB);
  await assert.rejects(savePumpForUser(BOB, BOB, pump, pumpDraft('Pompe de Bob')));
  await assert.rejects(savePumpForUser(BOB, BOB, null, pumpDraft('Pompe de Bob', {
    origins: [{ sourceKind: 'resource', resourceId: forage, reservoirId: null, isDefault: true }],
  })));
  assert.equal(one('SELECT name FROM irrigation_pumps WHERE id = ?', pump)?.name, 'Pompe du forage');
  assert.equal(one("SELECT count(*) AS count FROM irrigation_pumps WHERE name = 'Pompe de Bob'")?.count, 0);
});

test('Bob vérifie une irrigation sur la pompe d’Alice : la pompe est introuvable dans son espace', async () => {
  const forage = await saveWaterResourceForUser(ALICE, ALICE, null, resourceDraft);
  const pump = await savePumpForUser(ALICE, ALICE, null, pumpDraft('Pompe du forage', {
    origins: [{ sourceKind: 'resource', resourceId: forage, reservoirId: null, isDefault: true }],
  }));
  const origin = one('SELECT id FROM irrigation_pump_origins WHERE pump_id = ?', pump)?.id as string;
  await ensureWorkspaceForUser(BOB);
  const slot = { startsAt: '2026-09-23T08:00:00.000Z', endsAt: '2026-09-23T09:00:00.000Z' };
  for (const applications of [[{ rateMmPerHour: 10, wettedAreaSquareMeters: 30 }], [{ rateMmPerHour: 10, wettedAreaSquareMeters: null }]]) {
    await assert.rejects(
      validatePumpAssignmentForUser({ ownerUserId: BOB, pumpId: pump, pumpOriginId: origin, applications, ...slot }),
      /pompe sélectionnée est introuvable/,
    );
  }
});

test('Bob désigne la culture saisie par la ferme d’Alice : inconnue dans son espace, rien n’est écrit', async () => {
  assert.equal((await saveFarmReferenceCropForUser(ALICE, ALICE_CROP, { sourceUrl: null, datesSource: 'Ferme' })).ok, true);
  const unknown = `Culture de référence inconnue : ${ALICE_CROP.id}.`;

  const link = await saveSpeciesCorrespondenceForUser(BOB, {
    plantId: 'plant-tomate', seriesId: null, target: { kind: 'reference', referenceCropId: ALICE_CROP.id, analogy: false },
  });
  assert.deepEqual(link, { ok: false, problems: [unknown] });
  const override = await addKcOverrideForUser(BOB, { referenceCropId: ALICE_CROP.id, target: { rank: 2 }, kc: 0.6, effectiveFrom: '2026-09-01' });
  assert.deepEqual(override, { ok: false, problems: [unknown] });
  const declaration = await addStageDeclarationForUser(BOB, 2026, { seriesId: 's', bedId: null, referenceCropId: ALICE_CROP.id, rank: 1, date: '2026-09-01' });
  assert.equal(declaration.ok, false);
  const profile = await addRootingProfileForUser(BOB, {
    referenceCropId: ALICE_CROP.id, p: 0.3, stages: [{ rank: null, depthM: 0.25, endDepthM: null, progressionDays: null }],
    source: 'tarière', note: null, effectiveFrom: '2026-09-01',
  });
  assert.deepEqual(profile, { ok: false, problems: [unknown] });
  // Les stades sensibles au manque d'eau (amélioration n° 4, F730).
  assert.deepEqual(await saveSensitiveStagesForUser(BOB, { cropKey: ALICE_CROP.id, sensitiveRanks: [1] }), { ok: false, problems: [unknown] });

  for (const table of ['irrigation_crop_species_links', 'irrigation_crop_kc_overrides', 'irrigation_crop_stage_declarations', 'irrigation_soil_rooting_profiles', 'irrigation_crop_sensitive_stages']) {
    assert.equal(one(`SELECT count(*) AS count FROM ${table} WHERE crop_key = ?`, ALICE_CROP.id)?.count, 0, table);
  }
});

test('Bob remet les durées communes d’une culture qu’Alice a réglée : seule la version de Bob est en cause, celle d’Alice reste', async () => {
  const aliceVersion = { ...TOMATO, name: 'Tomate (ferme d’Alice)' };
  assert.equal((await saveFarmReferenceCropForUser(ALICE, aliceVersion, { sourceUrl: null, datesSource: 'Ferme' })).ok, true);
  await ensureWorkspaceForUser(BOB);
  assert.equal(await resetFarmDurationsForUser(BOB, TOMATO.id), false, 'Bob n’avait pas de version à lui');
  assert.equal(one('SELECT count(*) AS count FROM irrigation_crop_reference_crops WHERE crop_key = ? AND workspace_id IS NOT NULL', TOMATO.id)?.count, 1);
});
