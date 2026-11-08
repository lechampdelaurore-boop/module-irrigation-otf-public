import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import {
  EquipmentPlacementGroupError,
  EquipmentPlacementKindError,
  listEquipmentPlacementsForUser,
  removeEquipmentPlacementForUser,
  saveEquipmentPlacementForUser,
  updateEquipmentPlacementSettingForUser,
} from '../../db/equipment-placement-repository';
import { listEquipmentPoseHistoryForUser } from '../../db/equipment-placement-poses';
import { createEquipmentForUser, setEquipmentArchivedForUser } from '../../db/equipment/equipment';
import { saveEquipmentSettingForUser } from '../../db/equipment/settings';
import { createIrrigationEventForUser } from '../../db/irrigation-event/create';
import { ensureWorkspaceForUser } from '../../db/workspace-repository';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { FIXTURE_PLOT_ID, FIXTURE_ZONE_ID, completedDraft, createDripFixture } from '../support/irrigation-fixtures';

const ALICE = 'alice';
const BOB = 'bob';
const SEASON = 2026;
/** Lundi 2 mars 2026, 8 h à la ferme : la date de pose des tests, dans la saison et dans le passé. */
const POSE = '2026-03-02T07:00:00.000Z';
/** Mercredi 10 juin 2026, 10 h à la ferme. */
const JUIN = '2026-06-10T08:00:00.000Z';

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

const bed = (otfBedId: string) => ({ otfZoneId: FIXTURE_ZONE_ID, otfPlotId: FIXTURE_PLOT_ID, otfBedId });

async function dripEquipment(owner: string, name = 'Goutte') {
  const equipmentId = await createEquipmentForUser(owner, { name, kind: 'drip', mobility: 'mobile' });
  const settingId = await saveEquipmentSettingForUser(owner, equipmentId, null, { name: 'Réglage', kind: 'drip', rateMmPerHour: 10 });
  return { equipmentId, settingId: settingId! };
}

async function sprinklerEquipment(owner: string, name = 'Aspersion') {
  const equipmentId = await createEquipmentForUser(owner, { name, kind: 'sprinkler', mobility: 'mobile' });
  const settingId = await saveEquipmentSettingForUser(owner, equipmentId, null, { name: 'Portée', kind: 'sprinkler', leftProfile: [{ distanceMeters: 2, rateMmPerHour: 8 }], rightProfile: [] });
  return { equipmentId, settingId: settingId! };
}

test('une position par matériel et saison : posée, puis déplacée en place, planches dans l’ordre choisi', async () => {
  assert.deepEqual(await listEquipmentPlacementsForUser(ALICE, SEASON), []);
  const { equipmentId, settingId } = await dripEquipment(ALICE);
  const base = { equipmentId, settingId, season: SEASON, gardenGroupId: null, otfZoneId: FIXTURE_ZONE_ID, otfPlotId: FIXTURE_PLOT_ID };

  const saved = await saveEquipmentPlacementForUser(ALICE, { ...base, anchor: { type: 'bed_center', anchorBedOtfId: 'bed-2' }, selectedBeds: [bed('bed-2'), bed('bed-1')] }, POSE);
  assert.ok(saved);
  const [listed] = await listEquipmentPlacementsForUser(ALICE, SEASON);
  assert.deepEqual(listed, saved, 'la relecture rend exactement ce qui a été enregistré, planches dans l’ordre choisi');

  const moved = await saveEquipmentPlacementForUser(ALICE, { ...base, anchor: { type: 'bed_center', anchorBedOtfId: 'bed-3' }, selectedBeds: [bed('bed-3')] }, JUIN);
  assert.equal(moved?.id, saved.id, 'même matériel, même saison : la pose courante est mise à jour, pas dupliquée');
  const afterMove = await listEquipmentPlacementsForUser(ALICE, SEASON);
  assert.equal(afterMove.length, 1);
  assert.deepEqual(afterMove[0].selectedBeds.map((entry) => entry.otfBedId), ['bed-3']);
  assert.equal(database.sqlite.prepare('SELECT count(*) AS n FROM irrigation_placement_selected_beds').get()?.n, 1, 'les anciennes planches quittent la pose courante');
  const [closed] = await listEquipmentPoseHistoryForUser(ALICE, SEASON);
  assert.deepEqual(closed.selectedBeds.map((entry) => entry.otfBedId), ['bed-2', 'bed-1'], 'elles restent lisibles dans la pose fermée');

  const otherSeason = await saveEquipmentPlacementForUser(ALICE, { ...base, season: 2025, anchor: { type: 'bed_center', anchorBedOtfId: 'bed-1' }, selectedBeds: [bed('bed-1')] }, '2025-05-04T07:00:00.000Z');
  assert.notEqual(otherSeason?.id, saved.id, 'une autre saison a sa propre position');
  assert.equal((await listEquipmentPlacementsForUser(ALICE, SEASON)).length, 1);
  assert.equal((await listEquipmentPlacementsForUser(ALICE, 2025)).length, 1);
  await ensureWorkspaceForUser(BOB);
  assert.deepEqual(await listEquipmentPlacementsForUser(BOB, SEASON), []);
});

test('retirer une aspersion, qui n’a aucune planche sélectionnée : elle est stockée, sa pose reste lisible', async () => {
  const sprinkler = await sprinklerEquipment(ALICE);
  await saveEquipmentPlacementForUser(ALICE, {
    equipmentId: sprinkler.equipmentId, settingId: sprinkler.settingId, season: SEASON,
    gardenGroupId: null, otfZoneId: FIXTURE_ZONE_ID, otfPlotId: FIXTURE_PLOT_ID,
    anchor: { type: 'between_beds', beforeBedOtfId: 'bed-1', afterBedOtfId: 'bed-2' },
    selectedBeds: [],
  }, POSE);
  assert.equal((await listEquipmentPlacementsForUser(ALICE, SEASON)).length, 1);

  assert.equal(
    await removeEquipmentPlacementForUser(ALICE, sprinkler.equipmentId, SEASON, JUIN),
    'removed',
    'une position sans planche sélectionnée se retire comme une autre',
  );
  assert.deepEqual(await listEquipmentPlacementsForUser(ALICE, SEASON), [], 'stockée, elle n’arrose plus rien');
  const [closed] = await listEquipmentPoseHistoryForUser(ALICE, SEASON);
  assert.deepEqual(closed.anchor, { type: 'between_beds', beforeBedOtfId: 'bed-1', afterBedOtfId: 'bed-2' });
  assert.deepEqual([closed.placedAt, closed.removedAt], [POSE, JUIN]);
});

test('changer le réglage appliqué ne touche ni l’ancrage ni les planches (docs/equipment-setting-change-contract.md)', async () => {
  const { equipmentId, settingId } = await dripEquipment(ALICE);
  const autreReglage = await saveEquipmentSettingForUser(ALICE, equipmentId, null, {
    name: 'Réglage fort', kind: 'drip', rateMmPerHour: 25,
  });
  assert.ok(autreReglage);
  const pose = await saveEquipmentPlacementForUser(ALICE, {
    equipmentId, settingId, season: SEASON, gardenGroupId: null,
    otfZoneId: FIXTURE_ZONE_ID, otfPlotId: FIXTURE_PLOT_ID,
    anchor: { type: 'bed_center', anchorBedOtfId: 'bed-2' },
    selectedBeds: [bed('bed-2'), bed('bed-1')],
  }, POSE);
  assert.ok(pose);

  const change = await updateEquipmentPlacementSettingForUser(ALICE, equipmentId, SEASON, autreReglage);
  assert.equal(change?.id, pose.id, 'la position est modifiée, pas remplacée');
  assert.equal(change?.settingId, autreReglage);
  assert.deepEqual(
    { ...change, settingId },
    pose,
    'seul le réglage change : ancrage, jardin, groupe et planches restent identiques',
  );
});

test('changer le réglage appliqué : refus d’un réglage étranger, d’un matériel sans position, d’un autre propriétaire', async () => {
  const { equipmentId, settingId } = await dripEquipment(ALICE);
  const voisin = await dripEquipment(ALICE, 'Autre goutte');

  assert.equal(
    await updateEquipmentPlacementSettingForUser(ALICE, equipmentId, SEASON, settingId),
    null,
    'sans position enregistrée, il n’y a rien à changer : c’est « Placer » qu’il faut',
  );

  await saveEquipmentPlacementForUser(ALICE, {
    equipmentId, settingId, season: SEASON, gardenGroupId: null,
    otfZoneId: FIXTURE_ZONE_ID, otfPlotId: FIXTURE_PLOT_ID,
    anchor: { type: 'bed_center', anchorBedOtfId: 'bed-1' },
    selectedBeds: [bed('bed-1')],
  }, POSE);

  assert.equal(
    await updateEquipmentPlacementSettingForUser(ALICE, equipmentId, SEASON, voisin.settingId),
    null,
    'un réglage qui appartient à un autre matériel est refusé',
  );
  await ensureWorkspaceForUser(BOB);
  assert.equal(
    await updateEquipmentPlacementSettingForUser(BOB, equipmentId, SEASON, settingId),
    null,
    'un autre propriétaire ne voit rien : « introuvable », sans distinction',
  );
  assert.equal(
    await updateEquipmentPlacementSettingForUser(ALICE, equipmentId, 2027, settingId),
    null,
    'la position d’une autre saison n’est pas touchée',
  );
  const [inchange] = await listEquipmentPlacementsForUser(ALICE, SEASON);
  assert.equal(inchange.settingId, settingId, 'après tous ces refus, rien n’a bougé');
});

test('règles de type : l’aspersion se place sans planche, le goutte-à-goutte exige ses planches et son ancrage parmi elles', async () => {
  const sprinkler = await sprinklerEquipment(ALICE);
  const between = await saveEquipmentPlacementForUser(ALICE, {
    equipmentId: sprinkler.equipmentId, settingId: sprinkler.settingId, season: SEASON, gardenGroupId: null,
    otfZoneId: FIXTURE_ZONE_ID, otfPlotId: FIXTURE_PLOT_ID, anchor: { type: 'between_beds', beforeBedOtfId: 'bed-1', afterBedOtfId: 'bed-2' }, selectedBeds: [],
  }, POSE);
  assert.deepEqual((await listEquipmentPlacementsForUser(ALICE, SEASON))[0]?.anchor, { type: 'between_beds', beforeBedOtfId: 'bed-1', afterBedOtfId: 'bed-2' });
  assert.equal(between?.selectedBeds.length, 0);
  await assert.rejects(saveEquipmentPlacementForUser(ALICE, {
    equipmentId: sprinkler.equipmentId, settingId: sprinkler.settingId, season: SEASON, gardenGroupId: null,
    otfZoneId: FIXTURE_ZONE_ID, otfPlotId: FIXTURE_PLOT_ID, anchor: { type: 'bed_center', anchorBedOtfId: 'bed-1' }, selectedBeds: [bed('bed-1')],
  }, POSE), EquipmentPlacementKindError);

  const drip = await dripEquipment(ALICE);
  const dripBase = { equipmentId: drip.equipmentId, settingId: drip.settingId, season: SEASON, gardenGroupId: null, otfZoneId: FIXTURE_ZONE_ID, otfPlotId: FIXTURE_PLOT_ID };
  await assert.rejects(saveEquipmentPlacementForUser(ALICE, { ...dripBase, anchor: { type: 'bed_center', anchorBedOtfId: 'bed-1' }, selectedBeds: [] }, POSE), /au moins une planche/);
  await assert.rejects(saveEquipmentPlacementForUser(ALICE, { ...dripBase, anchor: { type: 'between_beds', beforeBedOtfId: 'bed-1', afterBedOtfId: 'bed-2' }, selectedBeds: [bed('bed-1')] }, POSE), /au moins une planche/);
  await assert.rejects(saveEquipmentPlacementForUser(ALICE, { ...dripBase, anchor: { type: 'bed_center', anchorBedOtfId: 'bed-9' }, selectedBeds: [bed('bed-1')] }, POSE), /ancrage doit faire partie/);
  await assert.rejects(saveEquipmentPlacementForUser(ALICE, { ...dripBase, gardenGroupId: 'groupe-inconnu', anchor: { type: 'bed_center', anchorBedOtfId: 'bed-1' }, selectedBeds: [bed('bed-1')] }, POSE), EquipmentPlacementGroupError);
  assert.equal((await listEquipmentPlacementsForUser(ALICE, SEASON)).length, 1, 'aucun refus n’a écrit de position');
});

test('matériel introuvable, archivé, réglage d’un autre matériel ou propriétaire étranger : rien n’est écrit', async () => {
  const drip = await dripEquipment(ALICE);
  const other = await dripEquipment(ALICE, 'Autre');
  const input = { equipmentId: drip.equipmentId, settingId: drip.settingId, season: SEASON, gardenGroupId: null, otfZoneId: FIXTURE_ZONE_ID, otfPlotId: FIXTURE_PLOT_ID, anchor: { type: 'bed_center' as const, anchorBedOtfId: 'bed-1' }, selectedBeds: [bed('bed-1')] };
  assert.equal(await saveEquipmentPlacementForUser(BOB, input, POSE), null, 'sans espace');
  await ensureWorkspaceForUser(BOB);
  assert.equal(await saveEquipmentPlacementForUser(BOB, input, POSE), null, 'matériel d’un autre propriétaire');
  assert.equal(await saveEquipmentPlacementForUser(ALICE, { ...input, settingId: other.settingId }, POSE), null, 'réglage d’un autre matériel');
  assert.equal(await saveEquipmentPlacementForUser(ALICE, { ...input, equipmentId: 'inconnu' }, POSE), null);
  await setEquipmentArchivedForUser(ALICE, drip.equipmentId, true);
  assert.equal(await saveEquipmentPlacementForUser(ALICE, input, POSE), null, 'matériel archivé');
  assert.deepEqual(await listEquipmentPlacementsForUser(ALICE, SEASON), []);
});

test('retirer une position : introuvable pour une autre saison ou un autre propriétaire ; les planches restent à la pose stockée', async () => {
  const fixture = await createDripFixture(ALICE);
  await createIrrigationEventForUser(ALICE, completedDraft(fixture, { startAt: '2026-06-10T06:00:00.000Z', endAt: '2026-06-10T07:00:00.000Z', durationSeconds: 3600 }));
  assert.equal(await removeEquipmentPlacementForUser(ALICE, fixture.equipment.id, 2025, '2025-06-10T08:00:00.000Z'), 'not_found');
  await ensureWorkspaceForUser(BOB);
  assert.equal(await removeEquipmentPlacementForUser(BOB, fixture.equipment.id, fixture.season, JUIN), 'not_found');

  const spare = await createDripFixture(ALICE, { name: 'Libre', beds: ['bed-7', 'bed-8'] });
  assert.equal(await removeEquipmentPlacementForUser(ALICE, spare.equipment.id, spare.season, JUIN), 'removed');
  assert.deepEqual((await listEquipmentPlacementsForUser(ALICE, SEASON)).map((placement) => placement.id), [fixture.placement.id]);
  assert.equal(
    database.sqlite.prepare('SELECT count(*) AS n FROM irrigation_placement_selected_beds WHERE placement_id = ?').get(spare.placement.id)?.n,
    2,
    'les planches restent attachées à la pose stockée, pour la reposer au même endroit',
  );
});
