import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { listEquipmentPlacementsForUser, saveEquipmentPlacementForUser } from '../../db/equipment-placement-repository';
import { createEquipmentForUser } from '../../db/equipment/equipment';
import { saveEquipmentSettingForUser } from '../../db/equipment/settings';
import {
  GardenAlreadyGroupedError,
  GardenGroupNameAlreadyExistsError,
  deleteGardenGroupForUser,
  listGardenGroupConfigurationForUser,
  saveGardenGroupForUser,
} from '../../db/garden-group-repository';
import { ensureWorkspaceForUser, findWorkspaceIdForUser } from '../../db/workspace-repository';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';

const ALICE = 'alice';
const BOB = 'bob';
const SEASON = 2026;
const GARDENS = [
  { otfZoneId: 'zone-1', otfPlotId: 'plot-1' },
  { otfZoneId: 'zone-1', otfPlotId: 'plot-2' },
  { otfZoneId: 'zone-2', otfPlotId: 'plot-3' },
];

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

const member = (otfPlotId: string, position: number, otfZoneId = 'zone-1', gapBeforeMeters = 0) => ({
  otfZoneId, otfPlotId, position, bedOrder: 'normal' as const, gapBeforeMeters,
});

test('groupes de jardins : création avec position croissante, membres ordonnés, renommage et remplacement des membres, unicité du nom et des jardins', async () => {
  assert.deepEqual(await listGardenGroupConfigurationForUser(ALICE, SEASON, GARDENS), { groups: [], copiedFromSeason: null });
  assert.equal(await findWorkspaceIdForUser(ALICE), null, 'lister sans espace ne crée rien');

  const first = await saveGardenGroupForUser(ALICE, null, { name: 'Serres', season: SEASON, members: [member('plot-2', 1), member('plot-1', 2, 'zone-1', 1.5)] });
  const second = await saveGardenGroupForUser(ALICE, null, { name: 'Plein champ', season: SEASON, members: [member('plot-3', 1, 'zone-2')] });
  assert.ok(first && second);
  let configuration = await listGardenGroupConfigurationForUser(ALICE, SEASON, GARDENS);
  assert.equal(configuration.copiedFromSeason, null);
  assert.deepEqual(configuration.groups.map((group) => [group.name, group.position, group.copiedFromGroupId, group.members.map((entry) => [entry.otfPlotId, entry.position, entry.gapBeforeMeters])]), [
    ['Serres', 1, null, [['plot-2', 1, 0], ['plot-1', 2, 1.5]]],
    ['Plein champ', 2, null, [['plot-3', 1, 0]]],
  ]);

  await assert.rejects(saveGardenGroupForUser(ALICE, null, { name: 'serres', season: SEASON, members: [] }), GardenGroupNameAlreadyExistsError, 'nom pris, casse ignorée');
  await assert.rejects(saveGardenGroupForUser(ALICE, null, { name: 'Doublon', season: SEASON, members: [member('plot-1', 1)] }), GardenAlreadyGroupedError, 'un jardin ne peut appartenir qu’à un groupe');

  assert.equal(await saveGardenGroupForUser(ALICE, first, { name: 'Serres nord', season: SEASON, members: [member('plot-1', 1)] }), first, 'modifier garde l’identifiant');
  configuration = await listGardenGroupConfigurationForUser(ALICE, SEASON, GARDENS);
  assert.deepEqual(configuration.groups.map((group) => [group.name, group.position, group.members.map((entry) => entry.otfPlotId)]), [
    ['Serres nord', 1, ['plot-1']],
    ['Plein champ', 2, ['plot-3']],
  ], 'la position d’un groupe modifié ne change pas, ses membres sont remplacés');
  assert.equal(await saveGardenGroupForUser(ALICE, 'inconnu', { name: 'X', season: SEASON, members: [] }), null);
  assert.equal(await saveGardenGroupForUser(ALICE, first, { name: 'Ailleurs', season: 2027, members: [] }), null, 'un groupe appartient à sa saison');

  assert.deepEqual((await listGardenGroupConfigurationForUser(ALICE, 2025, GARDENS)).groups, [], 'saison antérieure vide');
  await ensureWorkspaceForUser(BOB);
  assert.deepEqual((await listGardenGroupConfigurationForUser(BOB, SEASON, GARDENS)).groups, [], 'un autre propriétaire ne voit rien');
  await assert.rejects(saveGardenGroupForUser(ALICE, null, { name: 'Négatif', season: SEASON, members: [member('plot-9', 1, 'zone-1', -1)] }), /CHECK constraint failed/);
});

test('nouvelle saison : les groupes de la saison précédente sont recopiés une seule fois, avec les seuls jardins encore présents', async () => {
  await saveGardenGroupForUser(ALICE, null, { name: 'Serres', season: 2025, members: [member('plot-1', 1), member('plot-2', 2, 'zone-1', 2), member('plot-9', 3, 'zone-1', 3)] });
  await saveGardenGroupForUser(ALICE, null, { name: 'Isolé', season: 2025, members: [member('plot-3', 1, 'zone-2'), member('plot-8', 2, 'zone-2', 1)] });

  const copied = await listGardenGroupConfigurationForUser(ALICE, SEASON, [...GARDENS.slice(0, 2), { otfZoneId: 'zone-3', otfPlotId: 'plot-3' }]);
  assert.equal(copied.copiedFromSeason, 2025);
  assert.deepEqual(copied.groups.map((group) => [group.name, group.position, group.members.map((entry) => [entry.otfPlotId, entry.otfZoneId, entry.position, entry.gapBeforeMeters])]), [
    ['Serres', 1, [['plot-1', 'zone-1', 1, 0], ['plot-2', 'zone-1', 2, 2]]],
  ], 'plot-9 disparu est retiré ; « Isolé » n’a plus qu’un jardin et n’est pas copié ; la zone est reprise du plan courant');
  const sourceId = (await listGardenGroupConfigurationForUser(ALICE, 2025, GARDENS)).groups.find((group) => group.name === 'Serres')?.id;
  assert.equal(copied.groups[0].copiedFromGroupId, sourceId, 'la copie cite son groupe source');

  const again = await listGardenGroupConfigurationForUser(ALICE, SEASON, GARDENS);
  assert.deepEqual(again.groups.map((group) => group.id), copied.groups.map((group) => group.id), 'une seconde lecture ne recopie pas');
  assert.equal(again.copiedFromSeason, 2025);

  assert.equal(await deleteGardenGroupForUser(ALICE, SEASON, copied.groups[0].id), true);
  const emptied = await listGardenGroupConfigurationForUser(ALICE, SEASON, GARDENS);
  assert.deepEqual(emptied, { groups: [], copiedFromSeason: 2025 }, 'une saison déjà initialisée reste vide si l’on supprime ses groupes');

  assert.deepEqual(await listGardenGroupConfigurationForUser(ALICE, 2028, GARDENS), { groups: [], copiedFromSeason: null }, 'sans saison précédente immédiate, rien n’est copié');
});

test('supprimer un groupe : membres retirés, positions de matériel détachées, refus hors saison ou hors propriétaire', async () => {
  const groupId = await saveGardenGroupForUser(ALICE, null, { name: 'Serres', season: SEASON, members: [member('plot-1', 1), member('plot-2', 2)] });
  const equipmentId = await createEquipmentForUser(ALICE, { name: 'Goutte', kind: 'drip', mobility: 'mobile' });
  const settingId = await saveEquipmentSettingForUser(ALICE, equipmentId, null, { name: 'Réglage', kind: 'drip', rateMmPerHour: 10 });
  const placement = await saveEquipmentPlacementForUser(ALICE, {
    equipmentId, settingId: settingId!, season: SEASON, gardenGroupId: groupId, otfZoneId: 'zone-1', otfPlotId: 'plot-1',
    anchor: { type: 'bed_center', anchorBedOtfId: 'bed-1' }, selectedBeds: [{ otfZoneId: 'zone-1', otfPlotId: 'plot-1', otfBedId: 'bed-1' }],
  }, `${SEASON}-03-02T07:00:00.000Z`);
  assert.equal(placement?.gardenGroupId, groupId, 'la position peut viser un groupe existant de la saison');

  assert.equal(await deleteGardenGroupForUser(ALICE, 2027, groupId!), false, 'autre saison');
  assert.equal(await deleteGardenGroupForUser(BOB, SEASON, groupId!), false, 'autre propriétaire');
  assert.equal(await deleteGardenGroupForUser(ALICE, SEASON, groupId!), true);
  assert.deepEqual((await listGardenGroupConfigurationForUser(ALICE, SEASON, GARDENS)).groups, []);
  assert.equal(database.sqlite.prepare('SELECT count(*) AS n FROM irrigation_garden_group_members').get()?.n, 0);
  assert.equal((await listEquipmentPlacementsForUser(ALICE, SEASON))[0]?.gardenGroupId, null, 'la position est conservée mais détachée du groupe');
  assert.equal(await deleteGardenGroupForUser(ALICE, SEASON, groupId!), false, 'déjà supprimé');
});
