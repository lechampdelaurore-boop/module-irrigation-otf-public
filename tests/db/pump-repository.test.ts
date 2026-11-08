import assert from 'node:assert/strict';
import test, { afterEach, beforeEach, mock } from 'node:test';
import { createEquipmentForUser } from '../../db/equipment/equipment';
import { createIrrigationEventForUser } from '../../db/irrigation-event/create';
import {
  listPumpConfigurationForUser,
  listPumpUsagesForUser,
  saveEquipmentDefaultPumpForUser,
  savePumpForUser,
  setPumpArchivedForUser,
} from '../../db/pump-repository';
import { saveWaterReservoirForUser, saveWaterResourceForUser } from '../../db/water-resource-repository';
import { ensureWorkspaceForUser, readHydraulicRevisionForUser } from '../../db/workspace-repository';
import type { PumpDraft } from '../../lib/domain/pumps';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { createDripFixture, plannedDraft, runningDraft } from '../support/irrigation-fixtures';

const ALICE = 'alice';
const BOB = 'bob';

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  mock.timers.reset();
  database.dispose();
});

const pumpDraft = (name: string, overrides: Partial<PumpDraft> = {}): PumpDraft => ({
  name, maximumFlowCubicMetersPerHour: 8, status: 'active', notes: null, origins: [], ...overrides,
});

async function sources(owner: string) {
  const forage = await saveWaterResourceForUser(owner, owner, null, { name: 'Forage', type: 'borehole', nominalFlowCubicMetersPerHour: 1.125, status: 'active', availableFrom: null, availableUntil: null, notes: null });
  const tampon = await saveWaterReservoirForUser(owner, owner, null, { name: 'Tampon', type: 'buffer', capacityCubicMeters: 60, currentVolumeCubicMeters: 40, minimumSafetyCubicMeters: 5, exposedSurfaceSquareMeters: 30, receivesRain: true, evaporationEnabled: false, evaporationCoefficient: 0, status: 'active', notes: null }, '2026-06-15T08:00:00.000Z');
  return { forage, tampon };
}

test('pompes : création avec origines, modification remplaçant les origines, noms uniques, révision hydraulique avancée, journal', async () => {
  assert.deepEqual(await listPumpConfigurationForUser(ALICE), { pumps: [], equipmentDefaults: [] });
  const { forage, tampon } = await sources(ALICE);
  const revisionBefore = await readHydraulicRevisionForUser(ALICE);

  const pumpId = await savePumpForUser(ALICE, ALICE, null, pumpDraft('  Pompe   principale ', {
    origins: [
      { sourceKind: 'reservoir', resourceId: null, reservoirId: tampon, isDefault: true },
      { sourceKind: 'resource', resourceId: forage, reservoirId: null, isDefault: false },
    ],
  }));
  assert.equal(await readHydraulicRevisionForUser(ALICE), revisionBefore + 1, 'toute écriture de pompe avance la révision hydraulique');
  let { pumps } = await listPumpConfigurationForUser(ALICE);
  assert.deepEqual(pumps.map((pump) => [pump.name, pump.maximumFlowCubicMetersPerHour, pump.status, pump.archivedAt, pump.origins.map((origin) => [origin.sourceKind, origin.resourceId ?? origin.reservoirId, origin.isDefault])]), [
    ['Pompe principale', 8, 'active', null, [['reservoir', tampon, true], ['resource', forage, false]]],
  ], 'nom normalisé, origine par défaut en tête');

  await assert.rejects(savePumpForUser(ALICE, ALICE, null, pumpDraft('pompe principale')), /porte déjà ce nom/);
  await assert.rejects(savePumpForUser(ALICE, ALICE, null, pumpDraft('Sans débit', { maximumFlowCubicMetersPerHour: 0 })), /débit maximal/);
  await assert.rejects(savePumpForUser(ALICE, ALICE, null, pumpDraft('Deux défauts', { origins: [
    { sourceKind: 'reservoir', resourceId: null, reservoirId: tampon, isDefault: true },
    { sourceKind: 'resource', resourceId: forage, reservoirId: null, isDefault: true },
  ] })), /qu’une origine par défaut/);
  await assert.rejects(savePumpForUser(ALICE, ALICE, null, pumpDraft('Origine étrangère', { origins: [{ sourceKind: 'resource', resourceId: 'inconnue', reservoirId: null, isDefault: false }] })), /origine sélectionnée est introuvable/);
  await assert.rejects(savePumpForUser(ALICE, ALICE, 'inconnue', pumpDraft('X')), /Pompe introuvable/);

  assert.equal(await savePumpForUser(ALICE, ALICE, pumpId, pumpDraft('Pompe principale', { maximumFlowCubicMetersPerHour: 10, notes: 'révisée', origins: [{ sourceKind: 'resource', resourceId: forage, reservoirId: null, isDefault: true }] })), pumpId);
  ({ pumps } = await listPumpConfigurationForUser(ALICE));
  assert.deepEqual(pumps[0].origins.map((origin) => [origin.sourceKind, origin.isDefault]), [['resource', true]], 'les origines sont remplacées, pas fusionnées');
  assert.equal(pumps[0].notes, 'révisée');
  assert.equal(database.sqlite.prepare('SELECT count(*) AS n FROM irrigation_pump_origins').get()?.n, 1);
  const actions = (database.sqlite.prepare('SELECT action FROM irrigation_pump_log ORDER BY created_at, rowid').all() as { action: string }[]).map((row) => row.action);
  assert.deepEqual(actions, ['created', 'updated']);
  await ensureWorkspaceForUser(BOB);
  assert.deepEqual((await listPumpConfigurationForUser(BOB)).pumps, []);
});

test('archiver et réactiver : statut, date, classement après les actives ; pompe d’un autre propriétaire introuvable', async () => {
  const a = await savePumpForUser(ALICE, ALICE, null, pumpDraft('A'));
  const b = await savePumpForUser(ALICE, ALICE, null, pumpDraft('B'));
  await setPumpArchivedForUser(ALICE, ALICE, a, true);
  let { pumps } = await listPumpConfigurationForUser(ALICE);
  assert.deepEqual(pumps.map((pump) => [pump.id, pump.status]), [[b, 'active'], [a, 'archived']]);
  assert.ok(pumps[1].archivedAt);
  await setPumpArchivedForUser(ALICE, ALICE, a, false);
  ({ pumps } = await listPumpConfigurationForUser(ALICE));
  assert.deepEqual(pumps.map((pump) => [pump.id, pump.status, pump.archivedAt]), [[a, 'active', null], [b, 'active', null]]);
  await ensureWorkspaceForUser(BOB);
  await assert.rejects(setPumpArchivedForUser(BOB, BOB, a, true), /Pompe introuvable/);
  const actions = (database.sqlite.prepare('SELECT action FROM irrigation_pump_log ORDER BY created_at, rowid').all() as { action: string }[]).map((row) => row.action);
  assert.deepEqual(actions, ['created', 'created', 'archived', 'restored']);
});

test('pompe par défaut d’un matériel : posée, remplacée, exigée active, matériel et pompe contrôlés', async () => {
  const pumpA = await savePumpForUser(ALICE, ALICE, null, pumpDraft('A'));
  const pumpB = await savePumpForUser(ALICE, ALICE, null, pumpDraft('B'));
  const equipmentId = await createEquipmentForUser(ALICE, { name: 'Goutte', kind: 'drip', mobility: 'mobile' });

  await saveEquipmentDefaultPumpForUser(ALICE, ALICE, equipmentId, pumpA);
  assert.deepEqual((await listPumpConfigurationForUser(ALICE)).equipmentDefaults, [{ equipmentId, pumpId: pumpA }]);
  await saveEquipmentDefaultPumpForUser(ALICE, ALICE, equipmentId, pumpB);
  assert.deepEqual((await listPumpConfigurationForUser(ALICE)).equipmentDefaults, [{ equipmentId, pumpId: pumpB }], 'une seule pompe par défaut par matériel');

  await setPumpArchivedForUser(ALICE, ALICE, pumpA, true);
  await assert.rejects(saveEquipmentDefaultPumpForUser(ALICE, ALICE, equipmentId, pumpA), /doit être active/);
  await assert.rejects(saveEquipmentDefaultPumpForUser(ALICE, ALICE, 'inconnu', pumpB), /Matériel introuvable/);
  await assert.rejects(saveEquipmentDefaultPumpForUser(ALICE, ALICE, equipmentId, 'inconnue'), /Pompe introuvable/);
  await ensureWorkspaceForUser(BOB);
  await assert.rejects(saveEquipmentDefaultPumpForUser(BOB, BOB, equipmentId, pumpB), /Matériel introuvable/);
});

// Défaut révélé par ce test le 19 septembre 2026 et corrigé le lendemain : le
// journal de la pompe recevait « none » comme identifiant de pompe quand on
// retirait la pompe par défaut, et la clé étrangère de irrigation_pump_log le
// refusait. Le journal accepte désormais l'absence de pompe (colonne nullable).
test('retirer la pompe par défaut d’un matériel : la ligne disparaît et le journal note le retrait sans pompe', async () => {
  const pump = await savePumpForUser(ALICE, ALICE, null, pumpDraft('A'));
  const equipmentId = await createEquipmentForUser(ALICE, { name: 'Goutte', kind: 'drip', mobility: 'mobile' });
  await saveEquipmentDefaultPumpForUser(ALICE, ALICE, equipmentId, pump);
  await saveEquipmentDefaultPumpForUser(ALICE, ALICE, equipmentId, null);
  assert.deepEqual((await listPumpConfigurationForUser(ALICE)).equipmentDefaults, []);
  const log = database.sqlite.prepare("SELECT pump_id, action FROM irrigation_pump_log WHERE action = 'configured' ORDER BY rowid").all() as { pump_id: string | null; action: string }[];
  assert.deepEqual(log.map((row) => [row.pump_id, row.action]), [[pump, 'configured'], [null, 'configured']]);
});

test('usages d’une pompe sur une période : planifiées non annulées et minuteurs en cours, avec leur débit demandé', async () => {
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-06-15T08:00:00.000Z') });
  const { forage } = await sources(ALICE);
  const pump = await savePumpForUser(ALICE, ALICE, null, pumpDraft('Pompe', { origins: [{ sourceKind: 'resource', resourceId: forage, reservoirId: null, isDefault: true }] }));
  const fixture = await createDripFixture(ALICE);
  const assignment = { pumpId: pump, pumpOriginId: null, requestedFlowCubicMetersPerHour: 4, pumpSnapshot: { id: pump, name: 'Pompe', maximumFlowCubicMetersPerHour: 8 }, pumpOriginSnapshot: null };

  await createIrrigationEventForUser(ALICE, plannedDraft(fixture, { startAt: '2026-06-15T10:00:00.000Z', endAt: '2026-06-15T11:00:00.000Z', durationSeconds: 3600 }, { pumpAssignment: assignment }));
  await createIrrigationEventForUser(ALICE, plannedDraft(fixture, { startAt: '2026-06-16T10:00:00.000Z', endAt: '2026-06-16T11:00:00.000Z', durationSeconds: 3600 }, { pumpAssignment: assignment, note: 'demain' }));
  await createIrrigationEventForUser(ALICE, plannedDraft(fixture, { startAt: '2026-06-15T12:00:00.000Z', endAt: '2026-06-15T13:00:00.000Z', durationSeconds: 3600 }, { note: 'sans pompe' }));
  await createIrrigationEventForUser(ALICE, runningDraft(fixture, 1800, { pumpAssignment: { ...assignment, requestedFlowCubicMetersPerHour: 2 } }));

  const usages = await listPumpUsagesForUser(ALICE, pump, '2026-06-15T00:00:00.000Z', '2026-06-16T00:00:00.000Z');
  assert.deepEqual(usages.map((usage) => [usage.startsAt, usage.endsAt, usage.requestedFlowCubicMetersPerHour, usage.label]).sort(), [
    ['2026-06-15T08:00:00.000Z', '2026-06-15T08:30:00.000Z', 2, 'Goutte-à-goutte'],
    ['2026-06-15T10:00:00.000Z', '2026-06-15T11:00:00.000Z', 4, 'Goutte-à-goutte'],
  ], 'l’irrigation au minuteur compte de sa reprise à sa fin théorique ; celle sans pompe et celle de demain sont ignorées');
  const running = usages.find((usage) => usage.requestedFlowCubicMetersPerHour === 2);
  assert.deepEqual(await listPumpUsagesForUser(ALICE, pump, '2026-06-15T00:00:00.000Z', '2026-06-16T00:00:00.000Z', running!.eventEquipmentId), usages.filter((usage) => usage !== running), 'l’irrigation exclue disparaît du décompte');
  assert.deepEqual(await listPumpUsagesForUser(ALICE, pump, '2026-06-17T00:00:00.000Z', '2026-06-18T00:00:00.000Z'), []);
  assert.deepEqual(await listPumpUsagesForUser(BOB, pump, '2026-06-15T00:00:00.000Z', '2026-06-16T00:00:00.000Z'), []);
});
