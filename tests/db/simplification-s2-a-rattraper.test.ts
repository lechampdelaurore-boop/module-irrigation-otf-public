import assert from 'node:assert/strict';
import test, { afterEach, beforeEach, mock } from 'node:test';
import { enforceDailyLimitForStart, enforceHydraulicLimitForStart } from '../../app/irrigation/irrigation-event/limits';
import { handledError } from '../../app/irrigation/irrigation-event/messages';
import { cancelPlannedIrrigationForUser } from '../../db/irrigation-event/completion';
import { createIrrigationEventForUser } from '../../db/irrigation-event/create';
import { listIrrigationEventsForUser } from '../../db/irrigation-event/read';
import { startIrrigationEventForUser } from '../../db/irrigation-event/timer';
import { saveDailyWaterLimitForUser } from '../../db/water-management-repository';
import { FEATURE_IDS } from '../../lib/domain/features/catalogue';
import { allDone, doneAsPlannedConfirmations } from '../../lib/domain/today/all-done';
import { lateQuestion, todayCardActions, type TodayStart } from '../../lib/domain/today/card-action';
import { lateIrrigationLines, type TodayIrrigationLine } from '../../lib/domain/today/today-irrigations';
import { farmDateKey } from '../../lib/domain/today/today-text';
import { recordDoneAsPlannedForOwner } from '../../lib/services/done-as-planned-service';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { createDripFixture, plannedDraft } from '../support/irrigation-fixtures';
import { validatePlanningSettings } from '../support/onboarding';
import { ALICE, BOB } from '../support/spaces';

/**
 * Simplifier l'usage du module, lot S2, PR 3 : l'arrosage à rattraper, sur
 * les vrais services, à deux fermes (docs/simplification-s2-contract.md,
 * sections 4 et 9). La carte pose la question : « Je le fais maintenant »
 * est le démarrage d'« Arrosages », avec ses gardes ; « C'est fait » est
 * l'enregistrement « tel que prévu » de « Tout est fait », avec sa règle
 * (T15), jamais bloqué par une restriction d'eau ; « Ne pas le faire » est
 * l'annulation d'« Arrosages ». La carte se relit comme la page la relit.
 */

const SEASON = 2026;
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const NOW = Date.parse('2026-09-29T10:00:00.000Z');
const BED_NAMES = new Map([['bed-1', 'P1'], ['bed-2', 'P2']]);
/** La mise à jour du plan et des alertes ne sont pas l'objet ici : le service les reçoit sans effet. */
const QUIET = { cancelPushSchedule: async () => {}, recalculatePlan: async () => {} };

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
  mock.timers.enable({ apis: ['Date'], now: NOW - 3 * 24 * HOUR_MS });
});
afterEach(() => {
  mock.timers.reset();
  database.dispose();
});

/** Une irrigation d'une heure à `startAt`, planifiée trois jours avant ; rend son identifiant par matériel. */
async function planned(owner: string, startAt: number): Promise<string> {
  const fixture = await createDripFixture(owner, { beds: ['bed-1', 'bed-2'], name: `Goutte-à-goutte ${startAt}` });
  const created = await createIrrigationEventForUser(owner, plannedDraft(fixture, {
    startAt: new Date(startAt).toISOString(), endAt: new Date(startAt + HOUR_MS).toISOString(), durationSeconds: HOUR_MS / 1000,
  }));
  return created.eventEquipmentId;
}

/** Les cartes « À rattraper » de la ferme, à cette heure, et la confirmation de « C'est fait » de chacune. */
async function lateCards(owner: string): Promise<{ lines: TodayIrrigationLine[]; confirmations: ReadonlyMap<string, string> }> {
  const now = new Date();
  const events = await listIrrigationEventsForUser(owner, SEASON);
  const lines = lateIrrigationLines({ enabled: [...FEATURE_IDS], now, events, lateToleranceMinutes: 30, bedNames: BED_NAMES });
  return { lines, confirmations: doneAsPlannedConfirmations(allDone({ lines, events, now })) };
}

/** « Je le fais maintenant » : le démarrage d'« Arrosages », ses deux gardes, une erreur rendue en motif. */
async function startNow(owner: string, id: string): Promise<TodayStart> {
  try {
    await enforceDailyLimitForStart(owner, id);
    await enforceHydraulicLimitForStart(owner, id);
    await startIrrigationEventForUser(owner, id);
    return { ok: true, message: 'L’irrigation a démarré.' };
  } catch (error) {
    return handledError(error);
  }
}

async function setUp(owner: string): Promise<void> {
  await validatePlanningSettings(owner);
}

test('non fait hier : la question, « C’est fait » enregistre tel que prévu, et la carte part', async () => {
  await setUp(ALICE);
  const id = await planned(ALICE, NOW - 27 * HOUR_MS);
  mock.timers.setTime(NOW);
  const { lines, confirmations } = await lateCards(ALICE);
  assert.equal(lines.length, 1);
  const [line] = lines;
  assert.equal(line.status, 'Non faite');
  assert.match(lateQuestion(line, farmDateKey(new Date()))!, /^Prévu hier à \d{1,2} h( \d{2})?\. L’avez-vous fait \?$/);
  const actions = todayCardActions(line, { doneAsPlanned: confirmations.get(id) ?? null });
  assert.equal(actions?.primary.label, 'Je le fais maintenant');
  assert.equal(actions?.secondary?.label, 'C’est fait');
  assert.equal(actions?.twin, true);
  const done = actions?.secondary?.gesture;
  assert.ok(done?.kind === 'done-as-planned');
  assert.match(done.confirmation, /Elle ne se corrigera plus dans le module\./, 'la confirmation existante dit qu’elle ne se corrige plus (D-006)');

  const outcome = await recordDoneAsPlannedForOwner({ ownerUserId: ALICE, season: SEASON, eventEquipmentIds: [done.eventEquipmentId], now: new Date() }, QUIET);
  assert.deepEqual(outcome, { recorded: 1, refused: [] });
  const [event] = await listIrrigationEventsForUser(ALICE, SEASON);
  assert.equal(event.equipment.status, 'completed');
  assert.equal(event.equipment.actualDurationSeconds, HOUR_MS / 1000, 'tel que prévu : la durée prévue');
  assert.equal((await lateCards(ALICE)).lines.length, 0);
});

test('restriction d’eau : « Je le fais maintenant » est refusé, « C’est fait » reste accepté (section 9, AGENTS.md)', async () => {
  await setUp(ALICE);
  const id = await planned(ALICE, NOW - 5 * HOUR_MS);
  await saveDailyWaterLimitForUser(ALICE, { season: SEASON, enabled: true, maxCubicMetersPerDay: 0.01, validFrom: '2026-09-01', validUntil: null, note: 'arrêté' });
  mock.timers.setTime(NOW);
  const refused = await startNow(ALICE, id);
  assert.equal(refused.ok, false);
  assert.match(refused.message, /limite journalière dépassée/);
  const { confirmations } = await lateCards(ALICE);
  assert.ok(confirmations.has(id), '« C’est fait » est proposé');
  const outcome = await recordDoneAsPlannedForOwner({ ownerUserId: ALICE, season: SEASON, eventEquipmentIds: [id], now: new Date() }, QUIET);
  assert.equal(outcome.recorded, 1, 'une irrigation réelle déjà faite reste enregistrable');
});

test('en retard, créneau en cours : pas encore démarré, pas de « C’est fait » ; « Je le fais maintenant » démarre', async () => {
  await setUp(ALICE);
  const id = await planned(ALICE, NOW - 40 * MINUTE_MS);
  mock.timers.setTime(NOW);
  const { lines, confirmations } = await lateCards(ALICE);
  const [line] = lines;
  assert.equal(line.status, 'En retard');
  assert.match(lateQuestion(line, farmDateKey(new Date()))!, /^Prévu à \d{1,2} h( \d{2})?, pas encore démarré\.$/);
  const actions = todayCardActions(line, { doneAsPlanned: confirmations.get(id) ?? null });
  assert.equal(actions?.secondary, null, 'le créneau n’est pas fini (T15)');
  assert.equal(actions?.twin, undefined);
  assert.deepEqual(await startNow(ALICE, id), { ok: true, message: 'L’irrigation a démarré.' });
  assert.equal((await listIrrigationEventsForUser(ALICE, SEASON))[0].equipment.timerState, 'running');
});

test('« Ne pas le faire » annule ; Bob n’annule ni n’enregistre rien d’Alice, ni ne démarre son arrosage', async () => {
  await setUp(ALICE);
  await setUp(BOB);
  const aliceId = await planned(ALICE, NOW - 5 * HOUR_MS);
  const kept = await planned(ALICE, NOW - 4 * HOUR_MS);
  mock.timers.setTime(NOW);

  await assert.rejects(() => cancelPlannedIrrigationForUser(BOB, aliceId));
  assert.deepEqual(await recordDoneAsPlannedForOwner({ ownerUserId: BOB, season: SEASON, eventEquipmentIds: [aliceId], now: new Date() }, QUIET), {
    recorded: 0,
    refused: [{ eventEquipmentId: aliceId, title: 'Une irrigation', reason: 'Cette irrigation est introuvable.' }],
  });
  assert.equal((await startNow(BOB, aliceId)).ok, false);
  assert.equal((await lateCards(ALICE)).lines.length, 2, 'rien n’a bougé chez Alice');

  await cancelPlannedIrrigationForUser(ALICE, aliceId);
  const events = await listIrrigationEventsForUser(ALICE, SEASON);
  assert.equal(events.find((event) => event.equipment.id === aliceId)?.equipment.status, 'canceled');
  assert.deepEqual((await lateCards(ALICE)).lines.map((line) => line.eventEquipmentId), [kept]);
});
