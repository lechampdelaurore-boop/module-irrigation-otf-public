import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { createEquipmentForUser, deleteEquipmentForUser } from '../../db/equipment/equipment';
import { listEquipmentForUser } from '../../db/equipment/read';
import { listSettingProvenancesForUser } from '../../db/equipment/setting-calculations';
import { deleteEquipmentSettingForUser, saveEquipmentSettingForUser } from '../../db/equipment/settings';
import { emptyCalculatorInputs, type CalculatorInputs } from '../../lib/domain/irrigation-calculator/inputs';
import { calculatorSettingValues, settingLabelOf } from '../../lib/domain/irrigation-calculator/provenance';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';

/**
 * La provenance des réglages (docs/irrigation-calculator-contract.md,
 * section 10, migration 0029) : écrite par le calculateur, effacée par une
 * retouche à la main, « mesuré » par la case seulement, supprimée avec son
 * réglage, isolée par espace de travail, sans toucher aux valeurs.
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

const amnon: CalculatorInputs = {
  ...emptyCalculatorInputs('drip_per_bed'),
  lineCount: 2,
  referenceFlowLitersPerHour: 1.6,
  spacingMeters: 0.3,
  bedWidthMeters: 0.75,
};
const cone: CalculatorInputs = {
  ...emptyCalculatorInputs('sprinkler_cone'),
  referenceFlowLitersPerHour: 450,
  spacingMeters: 6.4,
  reachMeters: 11,
  sprinklerCount: 4,
};
const drip = (rateMmPerHour: number, name = 'Deux lignes') => ({ name, kind: 'drip' as const, rateMmPerHour });

function rowCount() {
  return (database.sqlite.prepare('SELECT COUNT(*) AS n FROM irrigation_equipment_setting_calculations').get() as { n: number }).n;
}

async function dripEquipment(owner = ALICE) {
  return createEquipmentForUser(owner, { name: 'Goutte-à-goutte', kind: 'drip', mobility: 'fixed' });
}

test('le calculateur écrit la provenance de son résultat, la valeur du réglage est celle du calcul', async () => {
  const equipmentId = await dripEquipment();
  const settingId = await saveEquipmentSettingForUser(ALICE, equipmentId, null, drip(14.22), { calculation: amnon, measured: false });
  assert.ok(settingId);
  const provenances = await listSettingProvenancesForUser(ALICE);
  assert.equal(provenances[settingId]?.level, 'calculated');
  assert.equal(provenances[settingId]?.method, 'drip_per_bed');
  assert.deepEqual(provenances[settingId]?.inputs, amnon, 'les entrées rouvrent le calculateur prérempli');
  assert.equal(provenances[settingId]?.theoreticalRateMmPerHour, 14.22);
  assert.equal(provenances[settingId]?.zoneSharePercent, 100);
  const json = database.sqlite.prepare('SELECT inputs_json FROM irrigation_equipment_setting_calculations').get() as { inputs_json: string };
  assert.equal(JSON.parse(json.inputs_json).formulaVersion, 1);
  const [equipment] = await listEquipmentForUser(ALICE);
  assert.deepEqual(equipment?.settings.map((setting) => setting.kind === 'drip' && setting.rateMmPerHour), [14.22]);
});

test('une aspersion en cône : profil enregistré tel que calculé, estimé, eau pompée des quatre asperseurs', async () => {
  const equipmentId = await createEquipmentForUser(ALICE, { name: 'Rampe 427', kind: 'sprinkler', mobility: 'mobile' });
  const values = calculatorSettingValues(cone);
  assert.ok(values?.kind === 'sprinkler');
  const settingId = await saveEquipmentSettingForUser(ALICE, equipmentId, null, {
    name: 'Cône', kind: 'sprinkler', leftProfile: [...values.leftProfile], rightProfile: [...values.rightProfile],
  }, { calculation: cone, measured: false });
  const provenance = (await listSettingProvenancesForUser(ALICE))[settingId!];
  assert.equal(provenance?.level, 'estimated');
  assert.equal(provenance?.nominalFlowLitersPerHour, 1800);
  assert.equal(provenance?.zoneSharePercent, null, 'pas d’efficacité en cône');
});

test('un résultat retouché avant l’enregistrement n’est pas « calculé » : pas de provenance', async () => {
  const equipmentId = await dripEquipment();
  await saveEquipmentSettingForUser(ALICE, equipmentId, null, drip(14), { calculation: amnon, measured: false });
  assert.equal(rowCount(), 0);
});

test('modifier à la main les valeurs d’un réglage calculé efface sa provenance ; changer son nom la garde', async () => {
  const equipmentId = await dripEquipment();
  const settingId = await saveEquipmentSettingForUser(ALICE, equipmentId, null, drip(14.22), { calculation: amnon, measured: false });
  await saveEquipmentSettingForUser(ALICE, equipmentId, settingId, drip(14.22, 'Renommé'), { calculation: null, measured: false });
  assert.equal(settingLabelOf((await listSettingProvenancesForUser(ALICE))[settingId!] ?? null), 'calculated');
  await saveEquipmentSettingForUser(ALICE, equipmentId, settingId, drip(8, 'Renommé'), { calculation: null, measured: false });
  assert.equal(settingLabelOf((await listSettingProvenancesForUser(ALICE))[settingId!] ?? null), 'entered', 'le réglage redevient « saisi »');
  assert.equal(rowCount(), 0);
});

test('« mesuré » par la case seulement ; décochée, le réglage redevient « saisi » ; calculateur décoché, rien ne change', async () => {
  const equipmentId = await dripEquipment();
  const settingId = await saveEquipmentSettingForUser(ALICE, equipmentId, null, drip(8), { calculation: null, measured: true });
  assert.equal((await listSettingProvenancesForUser(ALICE))[settingId!]?.level, 'measured');
  const stored = database.sqlite.prepare('SELECT method, inputs_json FROM irrigation_equipment_setting_calculations').get();
  assert.deepEqual({ ...(stored as object) }, { method: null, inputs_json: null }, 'mesuré : sans entrées');
  await saveEquipmentSettingForUser(ALICE, equipmentId, settingId, drip(8, 'Autre nom'));
  assert.equal((await listSettingProvenancesForUser(ALICE))[settingId!]?.level, 'measured', 'calculateur décoché : ni pris en compte, ni effacé');
  await saveEquipmentSettingForUser(ALICE, equipmentId, settingId, drip(8), { calculation: null, measured: false });
  assert.equal((await listSettingProvenancesForUser(ALICE))[settingId!], undefined);
  const noProvenance = await saveEquipmentSettingForUser(ALICE, equipmentId, null, drip(9, 'Sans rien'));
  assert.equal((await listSettingProvenancesForUser(ALICE))[noProvenance!], undefined, 'le logiciel ne classe jamais de lui-même un chiffre en « mesuré »');
});

test('supprimer le réglage ou son matériel supprime sa provenance', async () => {
  const equipmentId = await dripEquipment();
  const first = await saveEquipmentSettingForUser(ALICE, equipmentId, null, drip(14.22), { calculation: amnon, measured: false });
  await saveEquipmentSettingForUser(ALICE, equipmentId, null, drip(8, 'Mesuré'), { calculation: null, measured: true });
  assert.equal(rowCount(), 2);
  assert.equal(await deleteEquipmentSettingForUser(ALICE, equipmentId, first!), 'deleted');
  assert.equal(rowCount(), 1);
  assert.equal(await deleteEquipmentForUser(ALICE, equipmentId), 'deleted');
  assert.equal(rowCount(), 0);
});

test('isolation : la provenance d’une ferme ne se lit ni ne s’écrit depuis une autre', async () => {
  const equipmentId = await dripEquipment(ALICE);
  const settingId = await saveEquipmentSettingForUser(ALICE, equipmentId, null, drip(14.22), { calculation: amnon, measured: false });
  await dripEquipment(BOB);
  assert.deepEqual(await listSettingProvenancesForUser(BOB), {});
  assert.equal(await saveEquipmentSettingForUser(BOB, equipmentId, settingId, drip(8), { calculation: null, measured: true }), null);
  assert.equal((await listSettingProvenancesForUser(ALICE))[settingId!]?.level, 'calculated');
  assert.deepEqual(await listSettingProvenancesForUser('carole'), {}, 'une ferme sans espace n’a rien');
});

test('la migration 0029 est additive : un réglage d’avant garde sa valeur et reste « saisi » ; la base refuse une provenance incohérente', async () => {
  const equipmentId = await dripEquipment();
  const settingId = await saveEquipmentSettingForUser(ALICE, equipmentId, null, drip(8, 'Réglage de la ferme'));
  assert.equal(rowCount(), 0);
  const [setting] = (await listEquipmentForUser(ALICE))[0]!.settings;
  assert.ok(setting?.kind === 'drip' && setting.rateMmPerHour === 8, 'aucun réglage existant ne change de valeur');
  const workspaceId = (database.sqlite.prepare('SELECT id FROM irrigation_workspaces').get() as { id: string }).id;
  const insert = (level: string, method: string | null, inputs: string | null) => database.sqlite.prepare(
    `INSERT INTO irrigation_equipment_setting_calculations (setting_id, workspace_id, level, method, inputs_json, calculated_at) VALUES (?, ?, ?, ?, ?, 'x')`,
  ).run(settingId, workspaceId, level, method, inputs);
  assert.throws(() => insert('measured', 'drip_per_bed', '{}'), /CHECK constraint failed/, 'mesuré : sans entrées');
  assert.throws(() => insert('calculated', null, null), /CHECK constraint failed/, 'calculé : avec sa manière et ses entrées');
  assert.throws(() => insert('deviné', null, null), /CHECK constraint failed/);
  assert.throws(() => database.sqlite.prepare(
    `INSERT INTO irrigation_equipment_setting_calculations (setting_id, workspace_id, level, calculated_at) VALUES ('absent', ?, 'measured', 'x')`,
  ).run(workspaceId), /FOREIGN KEY constraint failed/);
});

test('une ligne illisible en base ne vaut rien : le réglage reste « saisi », on ne devine pas', async () => {
  const equipmentId = await dripEquipment();
  const settingId = await saveEquipmentSettingForUser(ALICE, equipmentId, null, drip(14.22), { calculation: amnon, measured: false });
  database.sqlite.prepare(`UPDATE irrigation_equipment_setting_calculations SET inputs_json = '{"method":"drip_per_valve"}'`).run();
  assert.equal((await listSettingProvenancesForUser(ALICE))[settingId!], undefined);
});
