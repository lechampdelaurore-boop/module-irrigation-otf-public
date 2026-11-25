import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { enforceDailyLimitForStart, enforceHydraulicLimitForStart } from '../../app/irrigation/irrigation-event/limits';
import { handledError } from '../../app/irrigation/irrigation-event/messages';
import { oneValidation, validateThenStart } from '../../app/irrigation/today/card-gestures';
import { listIrrigationEventsForUser } from '../../db/irrigation-event/read';
import { startIrrigationEventForUser } from '../../db/irrigation-event/timer';
import { readLatestPlanForUser } from '../../db/planning-repository';
import { saveDailyWaterLimitForUser, saveHydricGoalForUser } from '../../db/water-management-repository';
import { readHydraulicRevisionForUser, readWaterBudgetRevisionForUser } from '../../db/workspace-repository';
import type { IrrigationSnapshot } from '../../lib/domain/domain';
import { validateAndStartReply, validationReply, type TodayStart } from '../../lib/domain/today/card-action';
import { computeWeeklyPlanForUser } from '../../lib/services/planning-service';
import { refusePlanProposalForUser, validatePlanProposalForUser } from '../../lib/services/planning-validation-service';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { FIXTURE_PLOT_ID, FIXTURE_ZONE_ID, createDripFixture } from '../support/irrigation-fixtures';
import { validatePlanningSettings } from '../support/onboarding';
import { ALICE, BOB } from '../support/spaces';

/**
 * Simplifier l'usage du module, lot S2, PR 1 : les gestes de la carte
 * d'« Aujourd'hui » sur les vrais services, à deux fermes
 * (docs/simplification-s2-contract.md, sections 5 et 12). La composition est
 * celle de l'action `app/irrigation/today-card-actions.ts` : la validation du
 * planning (`validatePlanProposalForUser`, le service de
 * `validatePlanProposalsAction`), puis le démarrage d'« Arrosages », avec ses
 * deux gardes (`startIrrigationEventAction` : limite journalière, pompe,
 * démarrage). La session n'existe pas sous Node : le propriétaire est passé
 * comme l'action le lit.
 */

const NOW = new Date('2026-09-29T10:52:00.000Z');

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

const snapshot: IrrigationSnapshot = {
  configuration: { seasonFirst: 2025, seasonLast: 2026 },
  structure: { id: '17', name: 'Ferme', legalCity: 'Rennes', legalPostcode: '35000', legalCountry: 'FR' },
  zones: [{ id: FIXTURE_ZONE_ID, name: 'Zone', area: 1000, seasons: [2026] }],
  plots: [{ id: FIXTURE_PLOT_ID, zoneId: FIXTURE_ZONE_ID, name: 'Jardin', mode: 'garden', length: 40, width: 30, area: 1200, seasons: [2026] }],
  beds: [
    { id: 'bed-1', zoneId: FIXTURE_ZONE_ID, plotId: FIXTURE_PLOT_ID, name: 'P1', length: 40, width: 0.75, alleyWidth: 0.45, area: 30, seasons: [2026] },
    { id: 'bed-2', zoneId: FIXTURE_ZONE_ID, plotId: FIXTURE_PLOT_ID, name: 'P2', length: 40, width: 0.75, alleyWidth: 0.45, area: 30, seasons: [2026] },
  ],
  source: 'cache',
  lastSuccessfulReadAt: '2026-09-29T00:00:00.000Z',
};

async function farmWithPlan(owner: string) {
  await validatePlanningSettings(owner);
  await createDripFixture(owner, { beds: ['bed-1', 'bed-2'], rateMmPerHour: 14, bedAreaSquareMeters: 30 });
  await saveHydricGoalForUser(owner, { season: 2026, weekStart: '2026-09-21', scopeType: 'farm', otfZoneId: null, otfPlotId: null, otfBedId: null, amountMm: 20 });
  const plan = await computeWeeklyPlanForUser({ ownerUserId: owner, season: 2026, snapshot, now: NOW, actorUserId: owner });
  assert.ok(plan.proposals.length >= 2, 'deux propositions au moins');
  return plan;
}

/** La validation de l'action du planning, pour une seule proposition, rendue comme elle. */
const validate = (owner: string, proposalId: string) => async () => ({
  ok: true as const,
  results: [await validatePlanProposalForUser({ ownerUserId: owner, season: 2026, snapshot, proposalId, actorUserId: owner, now: NOW })],
});

/** Le démarrage de l'action d'« Arrosages » : ses deux gardes, puis le démarrage, une erreur rendue en motif. */
const start = (owner: string) => async (eventEquipmentId: string): Promise<TodayStart> => {
  try {
    const revision = await readWaterBudgetRevisionForUser(owner);
    const hydraulicRevision = await readHydraulicRevisionForUser(owner);
    await enforceDailyLimitForStart(owner, eventEquipmentId);
    await enforceHydraulicLimitForStart(owner, eventEquipmentId);
    await startIrrigationEventForUser(owner, eventEquipmentId, revision, hydraulicRevision);
    return { ok: true, message: 'L’irrigation a démarré.' };
  } catch (error) {
    return handledError(error);
  }
};

test('« Valider » depuis la carte : la proposition devient une irrigation planifiée ordinaire, et la réponse suit sa carte', async () => {
  const plan = await farmWithPlan(ALICE);
  const [first] = plan.proposals;
  const reply = validationReply(oneValidation(await validate(ALICE, first.storedId)()));
  const events = await listIrrigationEventsForUser(ALICE, 2026);
  assert.equal(events.length, 1);
  assert.equal(events[0].equipment.status, 'planned');
  assert.equal(events[0].equipment.plannedStartAt, first.startAt);
  // Sans pompe renseignée, la réserve de la validation se dit à côté, comme au planning (contrat, section 5).
  assert.deepEqual(reply, {
    tone: 'notice',
    text: 'Validé : l’arrosage est planifié. Faisabilité hydraulique non vérifiée : aucune pompe renseignée.',
    eventEquipmentId: events[0].equipment.id,
  });
  const stored = await readLatestPlanForUser(ALICE, 2026, '2026-09-28');
  assert.equal(stored?.proposals.find((proposal) => proposal.storedId === first.storedId)?.status, 'validated');

  // Un second appui ne valide pas deux fois : le serveur le refuse, le motif s'écrit sous la carte.
  const again = validationReply(oneValidation(await validate(ALICE, first.storedId)()));
  assert.deepEqual(again, { tone: 'error', text: 'Cette proposition a déjà été validée.', eventEquipmentId: null });
  assert.equal((await listIrrigationEventsForUser(ALICE, 2026)).length, 1);
});

test('« Valider » est gardé comme au planning : la limite journalière refuse, rien n’est créé, la proposition reste à valider', async () => {
  const plan = await farmWithPlan(ALICE);
  const [first] = plan.proposals;
  await saveDailyWaterLimitForUser(ALICE, { season: 2026, enabled: true, maxCubicMetersPerDay: 0.1, validFrom: '2026-09-01', validUntil: null, note: 'arrêté' });
  const reply = validateAndStartReply(...Object.values(await validateThenStart({ validate: validate(ALICE, first.storedId), start: start(ALICE) })) as [never, never]);
  assert.equal(reply.tone, 'error');
  assert.match(reply.text, /Limite journalière dépassée/);
  assert.equal(reply.eventEquipmentId, null);
  assert.equal((await listIrrigationEventsForUser(ALICE, 2026)).length, 0, 'ni validée ni démarrée');
  const stored = await readLatestPlanForUser(ALICE, 2026, '2026-09-28');
  assert.equal(stored?.proposals.find((proposal) => proposal.storedId === first.storedId)?.status, 'proposed');
});

test('« Démarrer tout de suite » : valide puis démarre ; le démarrage refusé laisse l’arrosage validé et planifié, et le dit', async () => {
  const plan = await farmWithPlan(ALICE);
  const [first, second] = plan.proposals;

  const done = await validateThenStart({ validate: validate(ALICE, first.storedId), start: start(ALICE) });
  const validation = done.validation;
  assert.ok(validation.ok);
  const reply = validateAndStartReply(validation, done.start);
  assert.deepEqual(reply, {
    tone: 'notice',
    text: 'Validé. L’irrigation a démarré. Faisabilité hydraulique non vérifiée : aucune pompe renseignée.',
    eventEquipmentId: validation.eventEquipmentId,
  });
  const running = (await listIrrigationEventsForUser(ALICE, 2026)).find((event) => event.equipment.id === validation.eventEquipmentId);
  assert.equal(running?.equipment.timerState, 'running');

  // Le même matériel coule déjà : la seconde se valide, mais son démarrage est refusé ; rien n'est annulé.
  const refused = await validateThenStart({ validate: validate(ALICE, second.storedId), start: start(ALICE) });
  const kept = refused.validation;
  assert.ok(kept.ok, 'la validation tient');
  assert.equal(refused.start?.ok, false);
  const refusedReply = validateAndStartReply(kept, refused.start);
  assert.equal(refusedReply.tone, 'error');
  assert.equal(refusedReply.text, 'Validé, mais pas démarré : Ce matériel est déjà utilisé par une irrigation en cours. L’arrosage reste planifié. Faisabilité hydraulique non vérifiée : aucune pompe renseignée.');
  assert.equal(refusedReply.eventEquipmentId, kept.eventEquipmentId, 'la réponse suit la carte de l’irrigation planifiée');
  const planned = (await listIrrigationEventsForUser(ALICE, 2026)).find((event) => event.equipment.id === kept.eventEquipmentId);
  assert.equal(planned?.equipment.status, 'planned');
  assert.equal(planned?.equipment.timerState, null);
  const stored = await readLatestPlanForUser(ALICE, 2026, '2026-09-28');
  assert.equal(stored?.proposals.find((proposal) => proposal.storedId === second.storedId)?.status, 'validated');
});

test('isolation : Bob ne valide, ne démarre ni ne refuse une proposition d’Alice ; chacun garde sa ferme', async () => {
  const alice = await farmWithPlan(ALICE);
  await farmWithPlan(BOB);
  const [first] = alice.proposals;

  const fromBob = await validateThenStart({ validate: validate(BOB, first.storedId), start: start(BOB) });
  assert.equal(fromBob.validation.ok, false, 'la proposition d’Alice n’existe pas pour Bob');
  assert.equal(fromBob.start, null, 'aucun démarrage tenté');
  assert.equal(await refusePlanProposalForUser({ ownerUserId: BOB, proposalId: first.storedId, actorUserId: BOB }), false);
  assert.equal((await listIrrigationEventsForUser(ALICE, 2026)).length, 0);
  assert.equal((await listIrrigationEventsForUser(BOB, 2026)).length, 0);
  assert.equal((await readLatestPlanForUser(ALICE, 2026, '2026-09-28'))?.proposals.find((proposal) => proposal.storedId === first.storedId)?.status, 'proposed');

  // L'irrigation d'Alice, une fois validée, ne se démarre pas depuis la ferme de Bob.
  const validated = oneValidation(await validate(ALICE, first.storedId)());
  assert.ok(validated.ok);
  const startedByBob = await start(BOB)(validated.eventEquipmentId);
  assert.equal(startedByBob.ok, false);
  assert.equal((await listIrrigationEventsForUser(ALICE, 2026))[0].equipment.timerState, null);
});

test('« Pas à cette heure » : le refus du planning ; un second refus dit que la proposition était déjà décidée', async () => {
  const plan = await farmWithPlan(ALICE);
  const [first] = plan.proposals;
  assert.equal(await refusePlanProposalForUser({ ownerUserId: ALICE, proposalId: first.storedId, actorUserId: ALICE }), true);
  assert.equal(await refusePlanProposalForUser({ ownerUserId: ALICE, proposalId: first.storedId, actorUserId: ALICE }), false);
  assert.equal((await readLatestPlanForUser(ALICE, 2026, '2026-09-28'))?.proposals.find((proposal) => proposal.storedId === first.storedId)?.status, 'refused');
  assert.equal((await listIrrigationEventsForUser(ALICE, 2026)).length, 0);
});
