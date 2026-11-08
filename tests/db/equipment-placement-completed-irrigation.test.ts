import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { removeEquipmentPlacementForUser, saveEquipmentPlacementForUser } from '../../db/equipment-placement-repository';
import { createIrrigationEventForUser } from '../../db/irrigation-event/create';
import { IrrigationEventInputError } from '../../db/irrigation-event/errors';
import { listIrrigationEventsForUser } from '../../db/irrigation-event/read';
import { irrigationPlacementForUser } from '../../lib/services/irrigation-placement-service';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { FIXTURE_PLOT_ID, FIXTURE_ZONE_ID, completedDraft, createDripFixture } from '../support/irrigation-fixtures';

/**
 * Pose datée et stockage du matériel, la saisie après coup (sous-tranche
 * 2.11, PR 3b ; docs/equipment-placement-periods-contract.md, règles 5 et
 * 12). En juin 2026, la ferme est à UTC+2 : 06:00Z se lit 8 h 00.
 */

const ALICE = 'alice';
const SEASON = 2026;

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

// Lundi 8 juin : posé depuis le 1er janvier ; retiré jeudi 11 à 8 h 00, reposé
// samedi 13 à 8 h 00 sur la planche 5.
const RETRAIT = '2026-06-11T06:00:00.000Z';
const REPOSE = '2026-06-13T06:00:00.000Z';
const MERCREDI = { startAt: '2026-06-10T06:00:00.000Z', endAt: '2026-06-10T07:00:00.000Z', durationSeconds: 3600 };
const VENDREDI = { startAt: '2026-06-12T06:00:00.000Z', endAt: '2026-06-12T07:00:00.000Z', durationSeconds: 3600 };
const DIMANCHE = { startAt: '2026-06-14T06:00:00.000Z', endAt: '2026-06-14T07:00:00.000Z', durationSeconds: 3600 };
const A_CHEVAL = { startAt: '2026-06-11T05:00:00.000Z', endAt: '2026-06-11T07:00:00.000Z', durationSeconds: 7200 };

const bedFive = {
  anchor: { type: 'bed_center' as const, anchorBedOtfId: 'bed-5' },
  selectedBeds: [{ otfZoneId: FIXTURE_ZONE_ID, otfPlotId: FIXTURE_PLOT_ID, otfBedId: 'bed-5' }],
};

async function storedThenReposed() {
  const fixture = await createDripFixture(ALICE);
  await removeEquipmentPlacementForUser(ALICE, fixture.equipment.id, SEASON, RETRAIT);
  const reposed = await saveEquipmentPlacementForUser(ALICE, {
    equipmentId: fixture.equipment.id, settingId: fixture.setting.id, season: SEASON, gardenGroupId: null,
    otfZoneId: FIXTURE_ZONE_ID, otfPlotId: FIXTURE_PLOT_ID, ...bedFive,
  }, REPOSE);
  assert.ok(reposed);
  return { fixture, reposed };
}

const placementAt = (equipmentId: string, period: { startAt: string; endAt: string }) => irrigationPlacementForUser({
  ownerUserId: ALICE, season: SEASON, equipmentId, completed: { actualStartAt: period.startAt, actualEndAt: period.endAt },
});

async function inputRefusal(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof IrrigationEventInputError) return error.message;
    throw error;
  }
  throw new Error('Un refus était attendu.');
}

test('règle 12 : une irrigation saisie après coup prend la pose ouverte à son heure de début, même retirée depuis', async () => {
  const { fixture, reposed } = await storedThenReposed();

  const mercredi = await placementAt(fixture.equipment.id, MERCREDI);
  assert.ok(mercredi);
  assert.deepEqual(mercredi.selectedBeds.map((bed) => bed.otfBedId), ['bed-1', 'bed-2'], 'mercredi, il était sur les planches 1 et 2');
  const dimanche = await placementAt(fixture.equipment.id, DIMANCHE);
  assert.deepEqual(dimanche?.selectedBeds.map((bed) => bed.otfBedId), ['bed-5'], 'dimanche, sur la planche 5');
  assert.equal(mercredi.id, reposed.id, 'une seule ligne de position par matériel et par saison');

  // La base accepte l'irrigation de mercredi sur la pose de mercredi, et la garde telle quelle (D-006).
  await createIrrigationEventForUser(ALICE, { ...completedDraft(fixture, MERCREDI), placement: mercredi });
  const [irrigation] = await listIrrigationEventsForUser(ALICE, SEASON, true);
  assert.deepEqual(irrigation.equipment.placementSnapshot.selectedBeds.map((bed) => bed.otfBedId), ['bed-1', 'bed-2']);

  // À venir ou en cours : le matériel posé aujourd'hui.
  const now = await irrigationPlacementForUser({ ownerUserId: ALICE, season: SEASON, equipmentId: fixture.equipment.id, completed: null });
  assert.deepEqual(now?.selectedBeds.map((bed) => bed.otfBedId), ['bed-5']);
});

test('scénario 9 : stocké à l’heure de début, la saisie est refusée avec les dates qui l’entourent, au service comme en base', async () => {
  const { fixture } = await storedThenReposed();
  const message = 'Ce matériel était stocké à cette heure (retiré le 11 juin à 8 h 00, reposé le 13 juin à 8 h 00) : '
    + 'corrigez l’heure de l’irrigation ou les dates de pose.';
  assert.equal(await inputRefusal(placementAt(fixture.equipment.id, VENDREDI)), message);
  assert.equal(await inputRefusal(createIrrigationEventForUser(ALICE, completedDraft(fixture, VENDREDI))), message);
  assert.equal((await listIrrigationEventsForUser(ALICE, SEASON, true)).length, 0, 'rien n’est écrit');
});

test('règles 5 et 12 : une irrigation commencée avant le retrait ne se termine pas après', async () => {
  const { fixture } = await storedThenReposed();
  const message = 'Ce matériel a été retiré le 11 juin à 8 h 00 : une irrigation commencée avant ne peut pas se terminer après. '
    + 'Corrigez l’heure de fin de l’irrigation.';
  assert.equal(await inputRefusal(placementAt(fixture.equipment.id, A_CHEVAL)), message);
  assert.equal(await inputRefusal(createIrrigationEventForUser(ALICE, completedDraft(fixture, A_CHEVAL))), message);
});

test('la base refuse une irrigation saisie après coup qui ne porte pas la pose de son heure de début', async () => {
  const { fixture, reposed } = await storedThenReposed();
  const message = await inputRefusal(createIrrigationEventForUser(ALICE, { ...completedDraft(fixture, MERCREDI), placement: reposed }));
  assert.equal(message, 'Ce matériel n’était pas posé à cet endroit à l’heure de début : recommencez la saisie.');
});
