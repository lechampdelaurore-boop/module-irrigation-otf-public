import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import {
  EquipmentPlacementChangedError,
  EquipmentPlacementDateError,
  listEquipmentPlacementsForUser,
  removeEquipmentPlacementForUser,
  saveEquipmentPlacementForUser,
  updateEquipmentPlacementSettingForUser,
} from '../../db/equipment-placement-repository';
import { listEquipmentPoseHistoryForUser, listEquipmentPosesForUser } from '../../db/equipment-placement-poses';
import { createEquipmentForUser, deleteEquipmentForUser } from '../../db/equipment/equipment';
import { saveEquipmentSettingForUser } from '../../db/equipment/settings';
import { createIrrigationEventForUser } from '../../db/irrigation-event/create';
import { IrrigationEventInputError } from '../../db/irrigation-event/errors';
import { listIrrigationEventsForUser } from '../../db/irrigation-event/read';
import { startIrrigationEventForUser } from '../../db/irrigation-event/timer';
import { dateKeyInTimeZone } from '../../lib/domain/irrigation-history/dates';
import { millisecondsFromMinutes } from '../../lib/domain/units';
import { applyMigrationsAfter, createMigratedSqliteDatabase, installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import {
  FIXTURE_PLOT_ID,
  FIXTURE_ZONE_ID,
  completedDraft,
  createDripFixture,
  plannedDraft,
  runningDraft,
} from '../support/irrigation-fixtures';

/**
 * Pose datée et stockage du matériel, côté base (sous-tranche 2.11, PR 2 ;
 * docs/equipment-placement-periods-contract.md). Les règles de dates sont
 * éprouvées dans tests/equipment-placement-periods.test.ts ; ici, ce qui
 * s'écrit, ce qui se relit et ce qui ne s'efface pas.
 *
 * En juin 2026, la ferme est à UTC+2 : 06:00Z se lit 8 h 00.
 */

const ALICE = 'alice';
const SEASON = 2026;
const IRRIGATION = { startAt: '2026-06-10T06:00:00.000Z', endAt: '2026-06-10T07:00:00.000Z', durationSeconds: 3600 };
const PENDANT_L_IRRIGATION = '2026-06-10T06:30:00.000Z';
const APRES_L_IRRIGATION = '2026-06-10T08:00:00.000Z';
const REPOSE = '2026-06-12T06:00:00.000Z';

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

const historyCount = () => Number(database.sqlite.prepare('SELECT count(*) AS n FROM irrigation_equipment_placement_history').get()?.n);

async function refusal(promise: Promise<unknown>): Promise<EquipmentPlacementDateError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof EquipmentPlacementDateError) return error;
    throw error;
  }
  throw new Error('Un refus de date était attendu.');
}

test('scénario 1 : un goutte-à-goutte qui a déjà arrosé se retire — refusé avant la 2.11 — et son irrigation garde sa position', async () => {
  const fixture = await createDripFixture(ALICE);
  await createIrrigationEventForUser(ALICE, completedDraft(fixture, IRRIGATION));

  assert.equal(await removeEquipmentPlacementForUser(ALICE, fixture.equipment.id, SEASON, APRES_L_IRRIGATION), 'removed');

  assert.deepEqual(await listEquipmentPlacementsForUser(ALICE, SEASON), [], 'stocké : ni besoins, ni planning, ni saisie ne le voient');
  const [current] = await listEquipmentPosesForUser(ALICE, SEASON);
  assert.equal(current.id, fixture.placement.id, 'la ligne de position reste : rien ne s’efface');
  assert.deepEqual([current.placedAt, current.removedAt], ['2026-01-01T08:00:00.000Z', APRES_L_IRRIGATION]);

  const [closed] = await listEquipmentPoseHistoryForUser(ALICE, SEASON);
  assert.deepEqual(
    { ...closed, historyId: 'copie' },
    { ...fixture.placement, placedAt: '2026-01-01T08:00:00.000Z', removedAt: APRES_L_IRRIGATION, settingName: 'Réglage 1', historyId: 'copie' },
    'la pose fermée garde son endroit, ses planches, son réglage et ses dates',
  );

  const [irrigation] = await listIrrigationEventsForUser(ALICE, SEASON, true);
  assert.equal(irrigation.equipment.placementId, fixture.placement.id);
  assert.deepEqual(irrigation.equipment.placementSnapshot, fixture.placement, 'l’irrigation garde la copie de sa position (D-006)');
  assert.deepEqual(irrigation.equipment.applications.map((application) => application.actualAmountMm), [10, 10], 'ses apports ne changent pas');
});

test('scénario 2 : un retrait daté avant la fin de la dernière irrigation est refusé, la nomme, et n’écrit rien', async () => {
  const fixture = await createDripFixture(ALICE);
  await createIrrigationEventForUser(ALICE, completedDraft(fixture, IRRIGATION));

  const refus = await refusal(removeEquipmentPlacementForUser(ALICE, fixture.equipment.id, SEASON, PENDANT_L_IRRIGATION));
  assert.equal(refus.refusal.code, 'before_last_irrigation');
  assert.equal(refus.message, 'Une irrigation sur ce matériel s’est terminée le 10 juin à 9 h 00 : il ne peut pas avoir été retiré avant.');
  assert.equal((await listEquipmentPlacementsForUser(ALICE, SEASON)).length, 1, 'toujours posé');
  assert.equal(historyCount(), 0);
});

test('scénario 3 : un retrait est refusé tant qu’une irrigation tourne au minuteur', async () => {
  const fixture = await createDripFixture(ALICE);
  await createIrrigationEventForUser(ALICE, runningDraft(fixture, 3600));

  const refus = await refusal(removeEquipmentPlacementForUser(ALICE, fixture.equipment.id, SEASON, new Date().toISOString()));
  assert.equal(refus.refusal.code, 'irrigation_in_progress');
  assert.equal(refus.message, 'Une irrigation est en cours sur ce matériel : arrêtez-la ou terminez-la avant de le retirer.');
  assert.equal((await listEquipmentPlacementsForUser(ALICE, SEASON)).length, 1);
  assert.equal(historyCount(), 0);
});

test('scénario 4 : stocké, puis reposé ailleurs ; le registre garde la première pose, la pose courante la seconde', async () => {
  const fixture = await createDripFixture(ALICE);
  await removeEquipmentPlacementForUser(ALICE, fixture.equipment.id, SEASON, APRES_L_IRRIGATION);

  const ailleurs = {
    equipmentId: fixture.equipment.id, settingId: fixture.setting.id, season: SEASON, gardenGroupId: null,
    otfZoneId: FIXTURE_ZONE_ID, otfPlotId: FIXTURE_PLOT_ID,
    anchor: { type: 'bed_center' as const, anchorBedOtfId: 'bed-5' },
    selectedBeds: [{ otfZoneId: FIXTURE_ZONE_ID, otfPlotId: FIXTURE_PLOT_ID, otfBedId: 'bed-5' }],
  };
  const avantLeRetrait = await refusal(saveEquipmentPlacementForUser(ALICE, ailleurs, IRRIGATION.endAt));
  assert.equal(avantLeRetrait.refusal.code, 'before_previous_removal', 'reposé avant d’avoir été retiré : refusé');

  const reposed = await saveEquipmentPlacementForUser(ALICE, ailleurs, REPOSE);
  assert.equal(reposed?.id, fixture.placement.id, 'la pose courante reprend, l’index « une position par matériel et par saison » tient');
  const [current] = await listEquipmentPosesForUser(ALICE, SEASON);
  assert.deepEqual([current.placedAt, current.removedAt], [REPOSE, null]);
  assert.deepEqual(current.selectedBeds.map((entry) => entry.otfBedId), ['bed-5']);
  assert.equal((await listEquipmentPlacementsForUser(ALICE, SEASON)).length, 1, 'reposé, il arrose de nouveau');

  const history = await listEquipmentPoseHistoryForUser(ALICE, SEASON);
  assert.equal(history.length, 1, 'reposer n’ajoute rien au registre : la pose fermée y est déjà');
  assert.deepEqual(history[0].selectedBeds.map((entry) => entry.otfBedId), ['bed-1', 'bed-2']);
});

test('déplacer un matériel posé ferme sa pose et en ouvre une à la même date ; au même endroit, rien ne se ferme', async () => {
  const fixture = await createDripFixture(ALICE);
  await createIrrigationEventForUser(ALICE, completedDraft(fixture, IRRIGATION));
  const memesPlanches = {
    equipmentId: fixture.equipment.id, settingId: fixture.setting.id, season: SEASON, gardenGroupId: null,
    otfZoneId: FIXTURE_ZONE_ID, otfPlotId: FIXTURE_PLOT_ID,
    anchor: { type: 'bed_center' as const, anchorBedOtfId: 'bed-2' },
    selectedBeds: ['bed-2', 'bed-1'].map((otfBedId) => ({ otfZoneId: FIXTURE_ZONE_ID, otfPlotId: FIXTURE_PLOT_ID, otfBedId })),
  };

  await saveEquipmentPlacementForUser(ALICE, memesPlanches, APRES_L_IRRIGATION);
  const [inchangee] = await listEquipmentPosesForUser(ALICE, SEASON);
  assert.equal(inchangee.placedAt, '2026-01-01T08:00:00.000Z', 'mêmes planches, dans un autre ordre : la pose garde sa date');
  assert.equal(historyCount(), 0);

  const ailleurs = { ...memesPlanches, anchor: { type: 'bed_center' as const, anchorBedOtfId: 'bed-3' }, selectedBeds: [{ otfZoneId: FIXTURE_ZONE_ID, otfPlotId: FIXTURE_PLOT_ID, otfBedId: 'bed-3' }] };
  const tropTot = await refusal(saveEquipmentPlacementForUser(ALICE, ailleurs, PENDANT_L_IRRIGATION));
  assert.equal(tropTot.refusal.code, 'before_last_irrigation', 'un déplacement est un retrait : la règle 5 vaut');
  assert.equal(historyCount(), 0);

  await saveEquipmentPlacementForUser(ALICE, ailleurs, APRES_L_IRRIGATION);
  const [deplacee] = await listEquipmentPosesForUser(ALICE, SEASON);
  assert.deepEqual([deplacee.placedAt, deplacee.removedAt], [APRES_L_IRRIGATION, null]);
  const [fermee] = await listEquipmentPoseHistoryForUser(ALICE, SEASON);
  assert.deepEqual([fermee.placedAt, fermee.removedAt], ['2026-01-01T08:00:00.000Z', APRES_L_IRRIGATION]);
  assert.deepEqual(fermee.selectedBeds.map((entry) => entry.otfBedId), ['bed-2', 'bed-1'], 'le registre garde l’ordre enregistré');
});

test('scénario 7 : une irrigation planifiée sur un matériel retiré reste, ne démarre ni stocké ni reposé ailleurs, redémarre reposé au même endroit', async () => {
  const fixture = await createDripFixture(ALICE);
  const planned = await createIrrigationEventForUser(ALICE, plannedDraft(fixture, { startAt: '2026-06-11T06:00:00.000Z', endAt: '2026-06-11T07:00:00.000Z', durationSeconds: 3600 }));
  await removeEquipmentPlacementForUser(ALICE, fixture.equipment.id, SEASON, APRES_L_IRRIGATION);

  const [restee] = await listIrrigationEventsForUser(ALICE, SEASON);
  assert.equal(restee.status, 'planned', 'un retrait ne supprime jamais une irrigation planifiée');
  await assert.rejects(startIrrigationEventForUser(ALICE, planned.eventEquipmentId), {
    message: 'Matériel stocké depuis le 10 juin à 10 h 00 : reposez-le ou annulez cette irrigation.',
  });

  const place = (beds: string[]) => ({
    equipmentId: fixture.equipment.id, settingId: fixture.setting.id, season: SEASON, gardenGroupId: null,
    otfZoneId: FIXTURE_ZONE_ID, otfPlotId: FIXTURE_PLOT_ID,
    anchor: { type: 'bed_center' as const, anchorBedOtfId: beds[0] },
    selectedBeds: beds.map((otfBedId) => ({ otfZoneId: FIXTURE_ZONE_ID, otfPlotId: FIXTURE_PLOT_ID, otfBedId })),
  });
  await saveEquipmentPlacementForUser(ALICE, place(['bed-5']), REPOSE);
  await assert.rejects(startIrrigationEventForUser(ALICE, planned.eventEquipmentId), {
    message: 'Matériel reposé ailleurs : annulez cette irrigation et planifiez-en une nouvelle.',
  });

  await saveEquipmentPlacementForUser(ALICE, place(['bed-2', 'bed-1']), '2026-06-13T06:00:00.000Z');
  const started = await startIrrigationEventForUser(ALICE, planned.eventEquipmentId);
  assert.equal(started.eventEquipmentId, planned.eventEquipmentId, 'reposé sur les mêmes planches, elle démarre');
});

test('scénario 5 : une date dans le futur, ou hors de la saison, est refusée', async () => {
  const fixture = await createDripFixture(ALICE);
  assert.equal(
    (await refusal(removeEquipmentPlacementForUser(ALICE, fixture.equipment.id, SEASON, '2999-06-10T08:00:00.000Z'))).refusal.code,
    'future',
  );
  assert.equal(
    (await refusal(removeEquipmentPlacementForUser(ALICE, fixture.equipment.id, SEASON, '2025-12-31T22:00:00.000Z'))).refusal.code,
    'outside_season',
    '31 décembre 2025 à 23 h à la ferme : la saison 2025',
  );
  assert.equal(
    (await refusal(removeEquipmentPlacementForUser(ALICE, fixture.equipment.id, SEASON, 'pas une date'))).refusal.code,
    'invalid_date',
  );
  assert.equal(historyCount(), 0);
});

test('point ouvert 47 : un retrait daté de la minute qui vient est accepté et enregistré à l’heure du serveur', async () => {
  // L'horloge de l'appareil peut avancer sur celle du serveur : un retrait
  // saisi « maintenant » arrive un peu dans le futur. Saison et pose suivent
  // l'heure réelle, puisque le dépôt lit son propre « maintenant ».
  const maintenant = Date.now();
  const saison = Number(dateKeyInTimeZone(new Date(maintenant)).slice(0, 4));
  const fixture = await createDripFixture(ALICE, {
    season: saison,
    placedAt: new Date(maintenant - millisecondsFromMinutes(60)).toISOString(),
  });
  const enAvance = new Date(maintenant + millisecondsFromMinutes(1)).toISOString();

  assert.equal(await removeEquipmentPlacementForUser(ALICE, fixture.equipment.id, saison, enAvance), 'removed');

  const [current] = await listEquipmentPosesForUser(ALICE, saison);
  assert.ok(current.removedAt !== null && Date.parse(current.removedAt) <= Date.now(), 'jamais de retrait enregistré dans le futur');
  assert.ok(Date.parse(current.removedAt) >= maintenant, 'à l’heure du serveur, pas plus tôt');
});

test('un matériel stocké : retrait, changement de réglage et nouvelle irrigation refusés', async () => {
  const fixture = await createDripFixture(ALICE);
  const autreReglage = await saveEquipmentSettingForUser(ALICE, fixture.equipment.id, null, { name: 'Fort', kind: 'drip', rateMmPerHour: 20 });
  await removeEquipmentPlacementForUser(ALICE, fixture.equipment.id, SEASON, APRES_L_IRRIGATION);

  assert.equal((await refusal(removeEquipmentPlacementForUser(ALICE, fixture.equipment.id, SEASON, REPOSE))).refusal.code, 'already_stored');
  assert.equal(
    await updateEquipmentPlacementSettingForUser(ALICE, fixture.equipment.id, SEASON, autreReglage!),
    null,
    'son réglage se choisit quand on le repose',
  );
  await assert.rejects(
    createIrrigationEventForUser(ALICE, completedDraft(fixture, { ...IRRIGATION, startAt: '2026-06-11T06:00:00.000Z', endAt: '2026-06-11T07:00:00.000Z' })),
    IrrigationEventInputError,
    'une irrigation ne s’enregistre pas sur un matériel stocké',
  );
  assert.equal(historyCount(), 1);
});

test('deux retraits simultanés ne copient la pose qu’une fois', async () => {
  const fixture = await createDripFixture(ALICE);
  const outcomes = await Promise.allSettled([
    removeEquipmentPlacementForUser(ALICE, fixture.equipment.id, SEASON, APRES_L_IRRIGATION),
    removeEquipmentPlacementForUser(ALICE, fixture.equipment.id, SEASON, REPOSE),
  ]);
  assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1, 'un seul retrait aboutit');
  const rejected = outcomes.find((outcome) => outcome.status === 'rejected');
  assert.ok(
    rejected?.reason instanceof EquipmentPlacementChangedError || rejected?.reason instanceof EquipmentPlacementDateError,
    'l’autre est refusé, avec un motif',
  );
  assert.equal(historyCount(), 1);
});

test('le registre des poses est en ajout seul ; il ne s’efface qu’avec un matériel qui n’a jamais arrosé', async () => {
  const fixture = await createDripFixture(ALICE);
  await removeEquipmentPlacementForUser(ALICE, fixture.equipment.id, SEASON, APRES_L_IRRIGATION);
  assert.throws(
    () => database.sqlite.prepare('UPDATE irrigation_equipment_placement_history SET removed_at = ?').run(REPOSE),
    /placement_history_append_only/,
  );

  assert.equal(await deleteEquipmentForUser(ALICE, fixture.equipment.id), 'deleted');
  assert.equal(historyCount(), 0, 'supprimé, le matériel emporte ses poses');

  const irrigue = await createDripFixture(ALICE, { name: 'Irrigué' });
  await createIrrigationEventForUser(ALICE, completedDraft(irrigue, IRRIGATION));
  await removeEquipmentPlacementForUser(ALICE, irrigue.equipment.id, SEASON, APRES_L_IRRIGATION);
  assert.equal(await deleteEquipmentForUser(ALICE, irrigue.equipment.id), 'has_history');
  assert.equal(historyCount(), 1, 'un matériel qui a arrosé garde tout');
});

test('scénario 10 : une position antérieure à la migration reste posée, sans date de pose inventée, et se retire', async () => {
  const sqlite = createMigratedSqliteDatabase('drizzle', '0017_planning.sql');
  sqlite.exec(`
    INSERT INTO irrigation_workspaces (id, owner_user_id) VALUES ('workspace', 'alice');
    INSERT INTO irrigation_equipment (id, workspace_id, name, kind, mobility) VALUES ('equipment', 'workspace', 'Rampe', 'sprinkler', 'mobile');
    INSERT INTO irrigation_equipment_settings (id, equipment_id, name, position) VALUES ('setting', 'equipment', 'Réglage', 1);
    INSERT INTO irrigation_equipment_placements (id, workspace_id, equipment_id, setting_id, season, otf_zone_id, otf_plot_id, anchor_type, anchor_bed_otf_id)
      VALUES ('placement', 'workspace', 'equipment', 'setting', 2026, 'zone', 'plot', 'bed_center', 'bed');
  `);
  applyMigrationsAfter(sqlite, '0017_planning.sql');
  const row = sqlite.prepare('SELECT placed_at, removed_at FROM irrigation_equipment_placements').get() as { placed_at: string | null; removed_at: string | null };
  assert.deepEqual({ ...row }, { placed_at: null, removed_at: null }, 'posée, date de pose non renseignée (règle 7)');
  sqlite.close();

  const sprinklerId = await createEquipmentForUser(ALICE, { name: 'Rampe', kind: 'sprinkler', mobility: 'mobile' });
  const settingId = await saveEquipmentSettingForUser(ALICE, sprinklerId, null, { name: 'Portée', kind: 'sprinkler', leftProfile: [{ distanceMeters: 2, rateMmPerHour: 8 }], rightProfile: [] });
  await saveEquipmentPlacementForUser(ALICE, {
    equipmentId: sprinklerId, settingId: settingId!, season: SEASON, gardenGroupId: null,
    otfZoneId: FIXTURE_ZONE_ID, otfPlotId: FIXTURE_PLOT_ID,
    anchor: { type: 'bed_center', anchorBedOtfId: 'bed-1' }, selectedBeds: [],
  }, '2026-03-02T07:00:00.000Z');
  database.sqlite.prepare('UPDATE irrigation_equipment_placements SET placed_at = NULL').run();

  assert.equal(await removeEquipmentPlacementForUser(ALICE, sprinklerId, SEASON, APRES_L_IRRIGATION), 'removed');
  const [closed] = await listEquipmentPoseHistoryForUser(ALICE, SEASON);
  assert.deepEqual([closed.placedAt, closed.removedAt], [null, APRES_L_IRRIGATION], 'la date inconnue reste inconnue dans le registre');
});
