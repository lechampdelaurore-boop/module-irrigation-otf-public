import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { duplicateEquipmentForUser } from '../../db/equipment/duplication';
import {
  createEquipmentForUser,
  deleteEquipmentForUser,
  setEquipmentArchivedForUser,
  updateEquipmentForUser,
} from '../../db/equipment/equipment';
import {
  EquipmentDuplicateKindMismatchError,
  EquipmentKindLockedBySettingsError,
  EquipmentNameAlreadyExistsError,
  EquipmentSettingKindMismatchError,
  EquipmentSettingNameAlreadyExistsError,
  EquipmentSettingsLimitError,
} from '../../db/equipment/errors';
import { listEquipmentForUser } from '../../db/equipment/read';
import { deleteEquipmentSettingForUser, saveEquipmentSettingForUser } from '../../db/equipment/settings';
import { listEquipmentPlacementsForUser } from '../../db/equipment-placement-repository';
import { createIrrigationEventForUser } from '../../db/irrigation-event/create';
import { ensureWorkspaceForUser, findWorkspaceIdForUser } from '../../db/workspace-repository';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { completedDraft, createDripFixture } from '../support/irrigation-fixtures';

const ALICE = 'alice';
const BOB = 'bob';

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

const drip = (rateMmPerHour: number, name = 'Réglage') => ({ name, kind: 'drip' as const, rateMmPerHour });
const sprinkler = (name = 'Portée') => ({
  name, kind: 'sprinkler' as const,
  leftProfile: [{ distanceMeters: 4, rateMmPerHour: 6 }, { distanceMeters: 2, rateMmPerHour: 10 }],
  rightProfile: [{ distanceMeters: 3, rateMmPerHour: 8 }],
});

async function equipmentOf(owner: string, id: string) {
  const item = (await listEquipmentForUser(owner)).find((entry) => entry.id === id);
  if (!item) throw new Error(`matériel ${id} introuvable`);
  return item;
}

test('créer et lister : espace créé au besoin, noms uniques sans tenir compte de la casse, actifs d’abord puis par nom', async () => {
  assert.deepEqual(await listEquipmentForUser(ALICE), []);
  assert.equal(await findWorkspaceIdForUser(ALICE), null);
  const tuyau = await createEquipmentForUser(ALICE, { name: 'tuyau poreux', kind: 'drip', mobility: 'fixed' });
  assert.notEqual(await findWorkspaceIdForUser(ALICE), null);
  const asperseur = await createEquipmentForUser(ALICE, { name: 'Asperseur', kind: 'sprinkler', mobility: 'mobile' });
  await assert.rejects(createEquipmentForUser(ALICE, { name: 'TUYAU POREUX', kind: 'drip', mobility: 'mobile' }), EquipmentNameAlreadyExistsError);

  const listed = await listEquipmentForUser(ALICE);
  assert.deepEqual(listed.map((item) => [item.name, item.kind, item.mobility, item.status, item.settingsCount, item.archivedAt]), [
    ['Asperseur', 'sprinkler', 'mobile', 'active', 0, null],
    ['tuyau poreux', 'drip', 'fixed', 'active', 0, null],
  ]);
  assert.deepEqual(listed.map((item) => item.id), [asperseur, tuyau]);
  assert.deepEqual(await listEquipmentForUser(BOB), [], 'un autre propriétaire ne voit rien');
  await createEquipmentForUser(BOB, { name: 'Asperseur', kind: 'sprinkler', mobility: 'mobile' });
  assert.equal((await listEquipmentForUser(BOB)).length, 1, 'le même nom est libre dans un autre espace');
});

test('réglages : positions attribuées puis réutilisées, renommage, remplacement des courbes, limites et refus', async () => {
  const dripId = await createEquipmentForUser(ALICE, { name: 'Goutte', kind: 'drip', mobility: 'mobile' });
  const sprinklerId = await createEquipmentForUser(ALICE, { name: 'Aspersion', kind: 'sprinkler', mobility: 'mobile' });

  const first = await saveEquipmentSettingForUser(ALICE, dripId, null, drip(8, 'Faible'));
  const second = await saveEquipmentSettingForUser(ALICE, dripId, null, drip(12, 'Fort'));
  assert.ok(first && second);
  let settings = (await equipmentOf(ALICE, dripId)).settings;
  assert.deepEqual(settings.map((setting) => [setting.position, setting.name, setting.kind === 'drip' ? setting.rateMmPerHour : null]), [[1, 'Faible', 8], [2, 'Fort', 12]]);

  assert.equal(await saveEquipmentSettingForUser(ALICE, dripId, first, drip(9, 'Faible bis')), first, 'modifier garde l’identifiant');
  settings = (await equipmentOf(ALICE, dripId)).settings;
  assert.deepEqual(settings.map((setting) => [setting.position, setting.name, setting.kind === 'drip' ? setting.rateMmPerHour : null]), [[1, 'Faible bis', 9], [2, 'Fort', 12]]);
  assert.equal(database.sqlite.prepare('SELECT count(*) AS n FROM drip_setting_rates').get()?.n, 2, 'un seul débit par réglage');

  await assert.rejects(saveEquipmentSettingForUser(ALICE, dripId, null, drip(5, 'fort')), EquipmentSettingNameAlreadyExistsError, 'nom déjà pris, casse ignorée');
  await assert.rejects(saveEquipmentSettingForUser(ALICE, dripId, null, sprinkler()), EquipmentSettingKindMismatchError);
  assert.equal(await saveEquipmentSettingForUser(ALICE, dripId, 'inconnu', drip(5, 'X')), null, 'réglage inconnu');
  assert.equal(await saveEquipmentSettingForUser(BOB, dripId, null, drip(5, 'X')), null, 'matériel d’un autre propriétaire');
  assert.equal(await saveEquipmentSettingForUser(ALICE, 'inconnu', null, drip(5, 'X')), null);

  assert.equal(await deleteEquipmentSettingForUser(ALICE, dripId, first), 'deleted');
  const third = await saveEquipmentSettingForUser(ALICE, dripId, null, drip(6, 'Nouveau'));
  assert.equal((await equipmentOf(ALICE, dripId)).settings.find((setting) => setting.id === third)?.position, 1, 'la première position libre est reprise');
  assert.equal(await deleteEquipmentSettingForUser(ALICE, dripId, first), 'not_found');
  assert.equal(await deleteEquipmentSettingForUser(BOB, dripId, second), 'not_found');

  const profileId = await saveEquipmentSettingForUser(ALICE, sprinklerId, null, sprinkler());
  let profile = (await equipmentOf(ALICE, sprinklerId)).settings[0];
  assert.equal(profile.kind, 'sprinkler');
  if (profile.kind === 'sprinkler') {
    assert.deepEqual(profile.leftProfile, [{ distanceMeters: 2, rateMmPerHour: 10 }, { distanceMeters: 4, rateMmPerHour: 6 }], 'points triés par distance');
    assert.deepEqual(profile.rightProfile, [{ distanceMeters: 3, rateMmPerHour: 8 }]);
  }
  await saveEquipmentSettingForUser(ALICE, sprinklerId, profileId, { ...sprinkler('Portée courte'), leftProfile: [{ distanceMeters: 1, rateMmPerHour: 12 }], rightProfile: [] });
  profile = (await equipmentOf(ALICE, sprinklerId)).settings[0];
  if (profile.kind === 'sprinkler') {
    assert.deepEqual([profile.name, profile.leftProfile, profile.rightProfile], ['Portée courte', [{ distanceMeters: 1, rateMmPerHour: 12 }], []], 'les courbes sont remplacées, pas fusionnées');
  }

  for (let index = 2; index <= 10; index += 1) {
    assert.ok(await saveEquipmentSettingForUser(ALICE, sprinklerId, null, sprinkler(`Portée ${index}`)));
  }
  await assert.rejects(saveEquipmentSettingForUser(ALICE, sprinklerId, null, sprinkler('Onzième')), EquipmentSettingsLimitError);
  assert.equal((await equipmentOf(ALICE, sprinklerId)).settingsCount, 10);
});

test('modifier un matériel : nom, mobilité, type verrouillé par les réglages, matériel archivé ou étranger refusé', async () => {
  const id = await createEquipmentForUser(ALICE, { name: 'Rampe', kind: 'sprinkler', mobility: 'mobile' });
  const other = await createEquipmentForUser(ALICE, { name: 'Autre', kind: 'drip', mobility: 'fixed' });
  assert.equal(await updateEquipmentForUser(ALICE, id, { name: 'Rampe', kind: 'drip', mobility: 'fixed' }), true, 'sans réglage, le type peut changer');
  assert.deepEqual((await equipmentOf(ALICE, id)).kind, 'drip');
  await assert.rejects(updateEquipmentForUser(ALICE, id, { name: 'autre', kind: 'drip', mobility: 'fixed' }), EquipmentNameAlreadyExistsError);
  assert.equal(await updateEquipmentForUser(ALICE, id, { name: 'RAMPE', kind: 'drip', mobility: 'mobile' }), true, 'son propre nom, autre casse, reste permis');

  await saveEquipmentSettingForUser(ALICE, id, null, drip(10));
  await assert.rejects(updateEquipmentForUser(ALICE, id, { name: 'Rampe', kind: 'sprinkler', mobility: 'mobile' }), EquipmentKindLockedBySettingsError);
  assert.equal(await updateEquipmentForUser(ALICE, id, { name: 'Rampe nord', kind: 'drip', mobility: 'mobile' }), true);

  assert.equal(await updateEquipmentForUser(BOB, id, { name: 'Pirate', kind: 'drip', mobility: 'mobile' }), false);
  assert.equal(await updateEquipmentForUser(ALICE, 'inconnu', { name: 'X', kind: 'drip', mobility: 'mobile' }), false);
  assert.equal(await setEquipmentArchivedForUser(ALICE, id, true), true);
  assert.equal(await updateEquipmentForUser(ALICE, id, { name: 'Archivé', kind: 'drip', mobility: 'mobile' }), false, 'un matériel archivé ne se modifie plus');
  assert.equal(await saveEquipmentSettingForUser(ALICE, id, null, drip(3, 'Tard')), null, 'ni ne reçoit de réglage');
  assert.equal((await equipmentOf(ALICE, other)).name, 'Autre');
});

test('archiver : statut et date posés, classement après les actifs, réactivation ; propriétaire et existence contrôlés', async () => {
  const a = await createEquipmentForUser(ALICE, { name: 'A', kind: 'drip', mobility: 'mobile' });
  const b = await createEquipmentForUser(ALICE, { name: 'B', kind: 'drip', mobility: 'mobile' });
  assert.equal(await setEquipmentArchivedForUser(ALICE, a, true), true);
  let listed = await listEquipmentForUser(ALICE);
  assert.deepEqual(listed.map((item) => [item.id, item.status]), [[b, 'active'], [a, 'archived']]);
  assert.ok(listed[1].archivedAt, 'date d’archivage posée');
  assert.equal(await setEquipmentArchivedForUser(ALICE, a, false), true);
  listed = await listEquipmentForUser(ALICE);
  assert.deepEqual(listed.map((item) => [item.id, item.status, item.archivedAt]), [[a, 'active', null], [b, 'active', null]]);
  assert.equal(await setEquipmentArchivedForUser(BOB, a, true), false);
  assert.equal(await setEquipmentArchivedForUser(ALICE, 'inconnu', true), false);
});

test('dupliquer : réglages, positions et courbes copiés sous de nouveaux identifiants ; nom et type contrôlés', async () => {
  const sourceId = await createEquipmentForUser(ALICE, { name: 'Original', kind: 'sprinkler', mobility: 'mobile' });
  await saveEquipmentSettingForUser(ALICE, sourceId, null, sprinkler('Courte'));
  await saveEquipmentSettingForUser(ALICE, sourceId, null, sprinkler('Longue'));
  const result = await duplicateEquipmentForUser(ALICE, sourceId, { name: 'Copie', kind: 'sprinkler', mobility: 'fixed' });
  assert.equal(result?.settingsCount, 2);
  const copy = await equipmentOf(ALICE, result!.equipmentId);
  const source = await equipmentOf(ALICE, sourceId);
  assert.deepEqual([copy.name, copy.kind, copy.mobility], ['Copie', 'sprinkler', 'fixed']);
  assert.deepEqual(
    copy.settings.map((setting) => ({ ...setting, id: 'x' })),
    source.settings.map((setting) => ({ ...setting, id: 'x' })),
    'mêmes réglages, positions et courbes',
  );
  assert.equal(new Set([...copy.settings, ...source.settings].map((setting) => setting.id)).size, 4, 'identifiants distincts');

  await assert.rejects(duplicateEquipmentForUser(ALICE, sourceId, { name: 'copie', kind: 'sprinkler', mobility: 'mobile' }), EquipmentNameAlreadyExistsError);
  await assert.rejects(duplicateEquipmentForUser(ALICE, sourceId, { name: 'Goutte', kind: 'drip', mobility: 'mobile' }), EquipmentDuplicateKindMismatchError);
  assert.equal(await duplicateEquipmentForUser(ALICE, 'inconnu', { name: 'X', kind: 'sprinkler', mobility: 'mobile' }), null);
  await ensureWorkspaceForUser(BOB);
  assert.equal(await duplicateEquipmentForUser(BOB, sourceId, { name: 'Vol', kind: 'sprinkler', mobility: 'mobile' }), null);
  assert.equal((await listEquipmentForUser(ALICE)).length, 2);
});

test('supprimer : refusé tant qu’une irrigation s’y réfère, sinon réglage, position et planches disparaissent ensemble', async () => {
  const fixture = await createDripFixture(ALICE);
  await createIrrigationEventForUser(ALICE, completedDraft(fixture, { startAt: '2026-06-10T06:00:00.000Z', endAt: '2026-06-10T07:00:00.000Z', durationSeconds: 3600 }));
  assert.equal(await deleteEquipmentSettingForUser(ALICE, fixture.equipment.id, fixture.setting.id), 'has_history');
  assert.equal(await deleteEquipmentForUser(ALICE, fixture.equipment.id), 'has_history');
  assert.equal(await deleteEquipmentForUser(BOB, fixture.equipment.id), 'not_found');
  assert.equal(await deleteEquipmentForUser(ALICE, 'inconnu'), 'not_found');

  const spare = await createDripFixture(ALICE, { name: 'Sans historique', beds: ['bed-7'] });
  assert.equal((await listEquipmentPlacementsForUser(ALICE, spare.season)).length, 2);
  assert.equal(await deleteEquipmentSettingForUser(ALICE, spare.equipment.id, spare.setting.id), 'deleted');
  assert.equal((await equipmentOf(ALICE, spare.equipment.id)).settingsCount, 0);
  assert.equal((await listEquipmentPlacementsForUser(ALICE, spare.season)).length, 1, 'la position qui utilisait le réglage est retirée');
  assert.equal(database.sqlite.prepare('SELECT count(*) AS n FROM irrigation_placement_selected_beds WHERE placement_id = ?').get(spare.placement.id)?.n, 0);

  assert.equal(await deleteEquipmentForUser(ALICE, spare.equipment.id), 'deleted');
  assert.deepEqual((await listEquipmentForUser(ALICE)).map((item) => item.id), [fixture.equipment.id]);
  assert.equal(await deleteEquipmentForUser(ALICE, spare.equipment.id), 'not_found');
});
