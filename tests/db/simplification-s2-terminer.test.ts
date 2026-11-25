import assert from 'node:assert/strict';
import test, { afterEach, beforeEach, mock } from 'node:test';
import { finishIrrigationEventForUser } from '../../db/irrigation-event/completion';
import { createIrrigationEventForUser } from '../../db/irrigation-event/create';
import { listIrrigationEventsForUser } from '../../db/irrigation-event/read';
import { pauseIrrigationEventForUser, resumeIrrigationEventForUser, startIrrigationEventForUser } from '../../db/irrigation-event/timer';
import { handledError } from '../../app/irrigation/irrigation-event/messages';
import { FEATURE_IDS } from '../../lib/domain/features/catalogue';
import { CLOSE_THE_VALVE, eventReply, nowCountdownText, todayNowActions, type TodayStart } from '../../lib/domain/today/card-action';
import { nowIrrigationLines, type TodayNowLine } from '../../lib/domain/today/now-irrigations';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { createDripFixture, plannedDraft, type IrrigationFixture } from '../support/irrigation-fixtures';
import { validatePlanningSettings } from '../support/onboarding';
import { ALICE, BOB } from '../support/spaces';

/**
 * Simplifier l'usage du module, lot S2, PR 2 : terminer, mettre en pause,
 * reprendre depuis la carte d'« Aujourd'hui », sur les vrais services, à deux
 * fermes (docs/simplification-s2-contract.md, sections 3 et 6). Chaque geste
 * est l'écriture d'« Arrosages », la même ; la carte se relit après chacun
 * comme la page la relit (`nowIrrigationLines`), avec son bouton
 * (`todayNowActions`) et son compte à rebours (`nowCountdownText`).
 */

const SEASON = 2026;
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const T0 = Date.parse('2026-09-29T06:00:00.000Z');
const BED_NAMES = new Map([['bed-1', 'P1'], ['bed-2', 'P2']]);

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
  mock.timers.enable({ apis: ['Date'], now: T0 - 24 * HOUR_MS });
});
afterEach(() => {
  mock.timers.reset();
  database.dispose();
});

/** Une irrigation d'une heure à T0, prévue la veille. */
async function plannedHour(owner: string): Promise<{ fixture: IrrigationFixture; id: string }> {
  await validatePlanningSettings(owner);
  const fixture = await createDripFixture(owner, { beds: ['bed-1', 'bed-2'] });
  const created = await createIrrigationEventForUser(owner, plannedDraft(fixture, {
    startAt: new Date(T0).toISOString(), endAt: new Date(T0 + HOUR_MS).toISOString(), durationSeconds: HOUR_MS / 1000,
  }));
  return { fixture, id: created.eventEquipmentId };
}

/** La carte de l'irrigation en tête de « Votre journée », telle que la page la relit à cette heure. */
async function card(owner: string, id: string): Promise<TodayNowLine | undefined> {
  const now = new Date();
  const lines = nowIrrigationLines({ enabled: [...FEATURE_IDS], now, events: await listIrrigationEventsForUser(owner, SEASON), bedNames: BED_NAMES });
  return lines.find((line) => line.eventEquipmentId === id);
}

const at = (minutes: number) => mock.timers.setTime(T0 + minutes * MINUTE_MS);

/** Un geste d'« Arrosages », son erreur rendue en motif comme l'action la rend. */
async function gesture(write: () => Promise<unknown>, message: string): Promise<TodayStart> {
  try {
    await write();
    return { ok: true, message };
  } catch (error) {
    return handledError(error);
  }
}

test('en cours, en pause, repris, terminé avant la fin : chaque carte a son bouton, son compte à rebours, et ce qui reste se reprend', async () => {
  const { id } = await plannedHour(ALICE);
  at(0);
  await startIrrigationEventForUser(ALICE, id);

  at(20);
  const running = await card(ALICE, id);
  assert.equal(running?.status, 'En cours');
  assert.equal(todayNowActions(running!).primary.label, 'Terminer');
  assert.deepEqual(todayNowActions(running!).others.map((choice) => choice.label), ['Mettre en pause', 'Ouvrir sur « Arrosages »']);
  assert.equal(nowCountdownText(running!, new Date()), 'Reste 40 min', 'le minuteur, jamais un calcul de la page');

  // « Mettre en pause » : la carte dit « Reprendre », et « Terminer » propose l'heure de la pause.
  const paused = await gesture(() => pauseIrrigationEventForUser(ALICE, id), 'L’irrigation est en pause.');
  assert.deepEqual(eventReply(id, paused), { tone: 'notice', text: 'L’irrigation est en pause.', eventEquipmentId: id });
  at(25);
  const pausedCard = await card(ALICE, id);
  const pausedActions = todayNowActions(pausedCard!);
  assert.equal(pausedCard?.status, 'En pause');
  assert.equal(pausedActions.primary.label, 'Reprendre');
  assert.deepEqual(pausedActions.secondary?.gesture, { kind: 'finish', eventEquipmentId: id, equipmentName: 'Goutte-à-goutte', suggestedEndAt: new Date(T0 + 20 * MINUTE_MS).toISOString() });
  assert.equal(nowCountdownText(pausedCard!, new Date()), null);

  // « Reprendre » : le minuteur repart d'où il s'était arrêté.
  at(30);
  await resumeIrrigationEventForUser(ALICE, id);
  assert.equal(nowCountdownText((await card(ALICE, id))!, new Date()), 'Reste 40 min');

  // « Terminer » après 40 min sur 60 : partielle ; la carte devient ce qui reste, la réponse la suit.
  at(50);
  const status = await finishIrrigationEventForUser(ALICE, id, null);
  assert.equal(status, 'partially_completed');
  const remainder = await card(ALICE, id);
  assert.equal(remainder?.tone, 'remainder');
  assert.equal(todayNowActions(remainder!).primary.label, 'Reprendre ce qui reste');
  assert.deepEqual(todayNowActions(remainder!).primary.gesture, { kind: 'start', eventEquipmentId: id });
  assert.equal(nowCountdownText(remainder!, new Date()), null);

  // « Reprendre ce qui reste », puis terminé à la durée : la carte quitte la tête de la journée.
  at(60);
  await startIrrigationEventForUser(ALICE, id);
  at(81);
  const finished = await card(ALICE, id);
  assert.equal(finished?.status, 'Durée atteinte');
  assert.equal(nowCountdownText(finished!, new Date()), CLOSE_THE_VALVE);
  assert.equal(todayNowActions(finished!).primary.label, 'Terminer');
  assert.equal(await finishIrrigationEventForUser(ALICE, id, null), 'completed');
  assert.equal(await card(ALICE, id), undefined);
});

test('« Terminer » à l’heure de la pause : l’heure proposée est celle de la pause, la durée réelle s’arrête là', async () => {
  const { id } = await plannedHour(ALICE);
  at(0);
  await startIrrigationEventForUser(ALICE, id);
  at(15);
  await pauseIrrigationEventForUser(ALICE, id);
  at(90);
  const paused = await card(ALICE, id);
  const finish = todayNowActions(paused!).secondary!.gesture;
  assert.equal(finish.kind, 'finish');
  assert.equal(await finishIrrigationEventForUser(ALICE, id, finish.kind === 'finish' ? finish.suggestedEndAt : null), 'partially_completed');
  const [event] = await listIrrigationEventsForUser(ALICE, SEASON);
  assert.equal(event.equipment.actualDurationSeconds, 15 * 60);
});

test('un geste refusé se dit sous la carte : reprendre ce qui n’est pas en pause', async () => {
  const { id } = await plannedHour(ALICE);
  at(0);
  await startIrrigationEventForUser(ALICE, id);
  const refused = await gesture(() => resumeIrrigationEventForUser(ALICE, id), 'L’irrigation a repris.');
  assert.deepEqual(eventReply(id, refused), { tone: 'error', text: 'Cette irrigation n’est pas en pause.', eventEquipmentId: id });
});

test('isolation : Bob ne met en pause, ne reprend ni ne termine l’irrigation d’Alice ; chacun garde la sienne', async () => {
  const alice = await plannedHour(ALICE);
  const bob = await plannedHour(BOB);
  at(0);
  await startIrrigationEventForUser(ALICE, alice.id);
  await startIrrigationEventForUser(BOB, bob.id);
  at(10);
  for (const write of [() => pauseIrrigationEventForUser(BOB, alice.id), () => resumeIrrigationEventForUser(BOB, alice.id), () => finishIrrigationEventForUser(BOB, alice.id, null)]) {
    const result = await gesture(write, 'fait');
    assert.equal(result.ok, false);
  }
  assert.equal((await card(ALICE, alice.id))?.status, 'En cours');
  assert.equal(await card(BOB, alice.id), undefined, 'la carte d’Alice n’est pas sur la page de Bob');
  assert.equal((await card(BOB, bob.id))?.status, 'En cours');
});
