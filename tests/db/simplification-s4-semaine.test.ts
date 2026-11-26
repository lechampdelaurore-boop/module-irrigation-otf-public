import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { cancelPlannedIrrigationForUser } from '../../db/irrigation-event/completion';
import { createIrrigationEventForUser } from '../../db/irrigation-event/create';
import { getWeekDayEventsForUser } from '../../lib/services/week-service';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { createDripFixture, plannedDraft, type IrrigationFixture } from '../support/irrigation-fixtures';
import { ALICE, BOB } from '../support/spaces';

/**
 * « Jour par jour » de la page « Semaine », lu en base (simplification,
 * lot S4, PR 2, docs/simplification-s4-contract.md, sections 5 et 11) : les
 * irrigations de la semaine affichée, du lundi 0 h au lundi suivant à la
 * ferme, celles du propriétaire seulement ; la ferme d'à côté ne voit rien.
 * La règle des lignes se prouve dans tests/simplification-s4-premier-niveau.test.ts.
 */

/** La semaine du lundi 23 au dimanche 29 novembre 2026. */
const WEEK = '2026-11-23';

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

async function plan(fixture: IrrigationFixture, startAt: string): Promise<string> {
  const start = Date.parse(startAt);
  const created = await createIrrigationEventForUser(fixture.ownerUserId, plannedDraft(fixture, {
    startAt, endAt: new Date(start + 3_600_000).toISOString(), durationSeconds: 3600,
  }));
  return created.eventEquipmentId;
}

test('« Jour par jour » lit les irrigations de la semaine à la ferme : le lundi 0 h compte, le lundi suivant non, les annulées non ; l’autre ferme ne voit rien', async () => {
  const alice = await createDripFixture(ALICE, { name: 'Goutte-à-goutte d’Alice', beds: ['bed-1'] });
  // Lundi 23 novembre, 0 h 30 à Paris (23 h 30 UTC la veille) : dans la semaine.
  await plan(alice, '2026-11-22T23:30:00.000Z');
  // Mercredi 25, 7 h à Paris.
  await plan(alice, '2026-11-25T06:00:00.000Z');
  // Dimanche 22, 23 h à Paris : la semaine d'avant.
  await plan(alice, '2026-11-22T22:00:00.000Z');
  // Lundi 30, 0 h 30 à Paris : la semaine d'après.
  await plan(alice, '2026-11-29T23:30:00.000Z');
  // Jeudi 26, annulée : pas de ligne.
  await cancelPlannedIrrigationForUser(ALICE, await plan(alice, '2026-11-26T06:00:00.000Z'));
  const bob = await createDripFixture(BOB, { name: 'Asperseur de Bob', beds: ['bed-1'] });
  await plan(bob, '2026-11-24T06:00:00.000Z');

  const events = await getWeekDayEventsForUser({ ownerUserId: ALICE, season: 2026, weekStart: WEEK });
  // L'ordre est celui de la lecture ; les lignes rangent par jour.
  assert.deepEqual(events.map((event) => event.dateKey).sort(), ['2026-11-23', '2026-11-25']);
  assert.ok(events.every((event) => event.equipmentName === 'Goutte-à-goutte d’Alice' && event.status === 'planned' && !event.running));
  // Un jour quelconque de la semaine désigne la même semaine (`week`, S4-g).
  assert.deepEqual(await getWeekDayEventsForUser({ ownerUserId: ALICE, season: 2026, weekStart: '2026-11-27' }), events);

  const seenByBob = await getWeekDayEventsForUser({ ownerUserId: BOB, season: 2026, weekStart: WEEK });
  assert.deepEqual(seenByBob.map((event) => [event.dateKey, event.equipmentName]), [['2026-11-24', 'Asperseur de Bob']]);
  assert.ok(!JSON.stringify(seenByBob).includes('Alice'));
  // Une ferme sans irrigation cette semaine-là : aucune ligne, jamais celles d'une autre.
  assert.deepEqual(await getWeekDayEventsForUser({ ownerUserId: BOB, season: 2026, weekStart: '2026-11-30' }), []);
});
