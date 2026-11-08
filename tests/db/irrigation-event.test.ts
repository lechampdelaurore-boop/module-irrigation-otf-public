import assert from 'node:assert/strict';
import test, { afterEach, beforeEach, mock } from 'node:test';
import { saveEquipmentSettingForUser } from '../../db/equipment/settings';
import {
  cancelPlannedIrrigationForUser,
  cancelRemainingIrrigationForUser,
  finishIrrigationEventForUser,
} from '../../db/irrigation-event/completion';
import {
  createIrrigationEventForUser,
  updatePlannedIrrigationForUser,
} from '../../db/irrigation-event/create';
import {
  IrrigationEquipmentAlreadyRunningError,
  IrrigationEventInputError,
  IrrigationEventNotFoundError,
  IrrigationEventStateError,
} from '../../db/irrigation-event/errors';
import {
  getIrrigationPushScheduleForUser,
  markIrrigationPushScheduleStatusForUser,
} from '../../db/irrigation-event/push-schedule';
import {
  findIrrigationWorkspaceIdForUser,
  listIrrigationEventsForUser,
  readIrrigationStartLimitCandidateForUser,
} from '../../db/irrigation-event/read';
import {
  pauseIrrigationEventForUser,
  resumeIrrigationEventForUser,
  startIrrigationEventForUser,
} from '../../db/irrigation-event/timer';
import { ensureWorkspaceForUser, readHydraulicRevisionForUser, readWaterBudgetRevisionForUser } from '../../db/workspace-repository';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { completedDraft, createDripFixture, plannedDraft, runningDraft, type IrrigationFixture } from '../support/irrigation-fixtures';

const ALICE = 'alice';
const BOB = 'bob';
const T0 = '2026-06-15T08:00:00.000Z';
const MINUTE_MS = 60_000;

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  mock.timers.reset();
  database.dispose();
});

/** Horloge simulée : les dépôts lisent `new Date()`, le test fait avancer le temps. */
function startClock(startIso = T0) {
  mock.timers.enable({ apis: ['Date'], now: new Date(startIso) });
  return {
    tickMinutes: (minutes: number) => mock.timers.tick(minutes * MINUTE_MS),
    nowIso: () => new Date().toISOString(),
    plusMinutesIso: (minutes: number) => new Date(Date.now() + minutes * MINUTE_MS).toISOString(),
  };
}

async function onlyEvent(ownerUserId: string, includeHistory = false) {
  const events = await listIrrigationEventsForUser(ownerUserId, undefined, includeHistory);
  assert.equal(events.length, 1, 'une seule irrigation attendue');
  return events[0];
}

async function createPlanned(fixture: IrrigationFixture, durationSeconds = 3600, startAt = '2026-06-15T10:00:00.000Z', endAt = '2026-06-15T11:00:00.000Z') {
  const result = await createIrrigationEventForUser(fixture.ownerUserId, plannedDraft(fixture, { startAt, endAt, durationSeconds }));
  const events = await listIrrigationEventsForUser(fixture.ownerUserId);
  const created = events.find((event) => event.equipment.plannedStartAt === startAt && event.equipment.status === 'planned');
  if (!created) throw new Error('irrigation planifiée introuvable après création');
  return { result, event: created, eventEquipmentId: created.equipment.id };
}

test('sans espace ni irrigation : espace introuvable, liste vide, candidats absents', async () => {
  assert.equal(await findIrrigationWorkspaceIdForUser(ALICE), null);
  assert.deepEqual(await listIrrigationEventsForUser(ALICE), []);
  assert.equal(await readIrrigationStartLimitCandidateForUser(ALICE, 'inconnue'), null);
  assert.equal(await getIrrigationPushScheduleForUser(ALICE, 'inconnue'), null);
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  assert.equal(await findIrrigationWorkspaceIdForUser(ALICE), workspaceId);
});

test('créer une irrigation planifiée : statut, montants prévus par planche, journal, candidat de limite', async () => {
  const fixture = await createDripFixture(ALICE, { rateMmPerHour: 10, beds: ['bed-1', 'bed-2'], bedAreaSquareMeters: 30 });
  const { result, event } = await createPlanned(fixture, 3600);
  assert.deepEqual({ overlapBedCount: result.overlapBedCount, scheduleConflictCount: result.scheduleConflictCount, pushSchedule: result.pushSchedule }, { overlapBedCount: 0, scheduleConflictCount: 0, pushSchedule: null });
  assert.ok(result.eventId && result.eventEquipmentId, 'le résultat nomme l’irrigation créée, pour le planning');
  assert.equal(event.status, 'planned');
  assert.equal(event.season, 2026);
  assert.equal(event.equipment.status, 'planned');
  assert.equal(event.equipment.timerState, null);
  assert.equal(event.equipment.plannedDurationSeconds, 3600);
  assert.deepEqual(event.equipment.equipmentSnapshot, { id: fixture.equipment.id, name: 'Goutte-à-goutte', kind: 'drip', mobility: 'mobile' });
  assert.deepEqual(event.equipment.settingSnapshot, fixture.setting);
  assert.deepEqual(event.equipment.placementSnapshot, fixture.placement);
  assert.deepEqual(
    event.equipment.applications.map((application) => [application.otfBedId, application.plannedAmountMm, application.actualAmountMm]),
    [['bed-1', 10, 0], ['bed-2', 10, 0]],
  );
  const withHistory = await onlyEvent(ALICE, true);
  assert.deepEqual(withHistory.timerHistory?.map((entry) => entry.action), ['created']);
  assert.equal(withHistory.timerHistory?.[0].payload.kind, 'planned');

  const candidate = await readIrrigationStartLimitCandidateForUser(ALICE, event.equipment.id);
  assert.equal(candidate?.season, 2026);
  assert.equal(candidate?.plannedDurationSeconds, 3600);
  assert.equal(candidate?.actualDurationSeconds, 0);
  assert.ok(Math.abs((candidate?.plannedCubicMeters ?? 0) - 0.6) < 1e-9, '2 planches × 10 mm × 30 m² = 0,6 m³');
  assert.equal(candidate?.actualCubicMeters, 0);
});

test('créer une irrigation réalisée a posteriori : statut terminé, montants réels, révisions avancées', async () => {
  const fixture = await createDripFixture(ALICE, { rateMmPerHour: 10 });
  assert.equal(await readWaterBudgetRevisionForUser(ALICE), 0);
  await createIrrigationEventForUser(ALICE, completedDraft(fixture, {
    startAt: '2026-06-14T06:00:00.000Z', endAt: '2026-06-14T06:30:00.000Z', durationSeconds: 1800,
  }, { note: 'arrosage du matin' }));
  const event = await onlyEvent(ALICE);
  assert.equal(event.status, 'completed');
  assert.equal(event.note, 'arrosage du matin');
  assert.equal(event.equipment.actualStartAt, '2026-06-14T06:00:00.000Z');
  assert.equal(event.equipment.actualDurationSeconds, 1800);
  assert.deepEqual(event.equipment.applications.map((application) => application.actualAmountMm), [5, 5]);
  assert.equal(await readWaterBudgetRevisionForUser(ALICE), 1);
  assert.equal(await readHydraulicRevisionForUser(ALICE), 1);
});

test('modifier le réglage d’un matériel ne réécrit pas une irrigation déjà enregistrée (D-006)', async () => {
  const fixture = await createDripFixture(ALICE, { rateMmPerHour: 10 });
  await createIrrigationEventForUser(ALICE, completedDraft(fixture, {
    startAt: '2026-06-14T06:00:00.000Z', endAt: '2026-06-14T06:30:00.000Z', durationSeconds: 1800,
  }));
  const avant = await onlyEvent(ALICE);

  // Le maraîcher change la buse : le même réglage passe de 10 à 25 mm/h. C'est
  // une correction du présent, pas une relecture du passé.
  const settingId = await saveEquipmentSettingForUser(ALICE, fixture.equipment.id, fixture.setting.id, {
    name: fixture.setting.name, kind: 'drip', rateMmPerHour: 25,
  });
  assert.equal(settingId, fixture.setting.id, 'le réglage est modifié, pas recréé');

  const apres = await onlyEvent(ALICE);
  assert.deepEqual(
    apres.equipment.applications.map((application) => application.actualAmountMm),
    avant.equipment.applications.map((application) => application.actualAmountMm),
    'les millimètres réellement apportés ne bougent pas',
  );
  assert.deepEqual(
    apres.equipment.applications.map((application) => application.rateMmPerHour),
    [10, 10],
    'chaque planche garde le débit sous lequel elle a été arrosée',
  );
  const reglageArchive = apres.equipment.settingSnapshot;
  assert.equal(reglageArchive.kind, 'drip');
  assert.equal(
    reglageArchive.kind === 'drip' ? reglageArchive.rateMmPerHour : null,
    10,
    'la copie du réglage conserve la valeur utilisée ce jour-là',
  );
});

test('refus à la création : sans espace, sans planche, références d’un autre propriétaire ou d’une autre saison', async () => {
  const bobFixture = await createDripFixture(BOB);
  await assert.rejects(createIrrigationEventForUser(ALICE, plannedDraft(bobFixture, { startAt: T0, endAt: T0, durationSeconds: 60 })), IrrigationEventInputError);

  const fixture = await createDripFixture(ALICE);
  await assert.rejects(
    createIrrigationEventForUser(ALICE, plannedDraft(fixture, { startAt: T0, endAt: T0, durationSeconds: 60 }, { applications: [] })),
    /n’irrigue aucune planche/,
  );
  await assert.rejects(
    createIrrigationEventForUser(ALICE, plannedDraft(bobFixture, { startAt: T0, endAt: T0, durationSeconds: 60 })),
    /n’est plus disponible/,
  );
  await assert.rejects(
    createIrrigationEventForUser(ALICE, plannedDraft(fixture, { startAt: T0, endAt: T0, durationSeconds: 60 }, { season: 2025 })),
    /n’est plus disponible/,
  );
  assert.deepEqual(await listIrrigationEventsForUser(ALICE), []);
});

test('isolation : un autre propriétaire ne voit rien et chaque mutation lui répond « introuvable »', async () => {
  const fixture = await createDripFixture(ALICE);
  const { eventEquipmentId } = await createPlanned(fixture);
  await ensureWorkspaceForUser(BOB);
  assert.deepEqual(await listIrrigationEventsForUser(BOB), []);
  assert.equal(await readIrrigationStartLimitCandidateForUser(BOB, eventEquipmentId), null);
  assert.equal(await getIrrigationPushScheduleForUser(BOB, eventEquipmentId), null);
  for (const mutation of [
    () => updatePlannedIrrigationForUser(BOB, eventEquipmentId, plannedDraft(fixture, { startAt: T0, endAt: T0, durationSeconds: 60 })),
    () => startIrrigationEventForUser(BOB, eventEquipmentId),
    () => pauseIrrigationEventForUser(BOB, eventEquipmentId),
    () => resumeIrrigationEventForUser(BOB, eventEquipmentId),
    () => finishIrrigationEventForUser(BOB, eventEquipmentId, null),
    () => cancelPlannedIrrigationForUser(BOB, eventEquipmentId),
    () => cancelRemainingIrrigationForUser(BOB, eventEquipmentId),
  ]) {
    await assert.rejects(mutation(), IrrigationEventNotFoundError);
  }
  const untouched = await onlyEvent(ALICE);
  assert.equal(untouched.status, 'planned');
  assert.equal(untouched.equipment.timerState, null);
});

test('filtres de liste : saison, période et ordre (en cours d’abord)', async () => {
  const clock = startClock();
  const fixture2026 = await createDripFixture(ALICE, { season: 2026 });
  const fixture2025 = await createDripFixture(ALICE, { name: 'Ancien', season: 2025 });
  await createPlanned(fixture2026, 600, '2026-06-20T10:00:00.000Z', '2026-06-20T10:10:00.000Z');
  await createPlanned(fixture2025, 600, '2025-06-20T10:00:00.000Z', '2025-06-20T10:10:00.000Z');
  await createIrrigationEventForUser(ALICE, runningDraft(fixture2026, 600));
  clock.tickMinutes(1);

  const all = await listIrrigationEventsForUser(ALICE);
  assert.equal(all.length, 3);
  assert.equal(all[0].equipment.timerState, 'running', 'l’irrigation en cours vient en tête');
  assert.deepEqual((await listIrrigationEventsForUser(ALICE, 2025)).map((event) => event.season), [2025]);
  const june2026 = await listIrrigationEventsForUser(ALICE, 2026, false, { startAt: '2026-06-20T00:00:00.000Z', endAt: '2026-06-21T00:00:00.000Z' });
  assert.deepEqual(june2026.map((event) => event.equipment.timerState ?? event.equipment.plannedStartAt).sort(), ['2026-06-20T10:00:00.000Z', 'running']);
  const july2026 = await listIrrigationEventsForUser(ALICE, 2026, false, { startAt: '2026-07-01T00:00:00.000Z', endAt: '2026-08-01T00:00:00.000Z' });
  assert.deepEqual(july2026.map((event) => event.equipment.timerState), ['running'], 'une irrigation en cours appartient à toute période');
});

test('avertissements : conflit d’horaire sur le même matériel, chevauchement de planches déjà en cours', async () => {
  startClock();
  const fixture = await createDripFixture(ALICE, { beds: ['bed-1', 'bed-2'] });
  await createPlanned(fixture, 3600, '2026-06-15T10:00:00.000Z', '2026-06-15T11:00:00.000Z');
  const overlapping = await createIrrigationEventForUser(ALICE, plannedDraft(fixture, {
    startAt: '2026-06-15T10:30:00.000Z', endAt: '2026-06-15T11:30:00.000Z', durationSeconds: 3600,
  }));
  assert.equal(overlapping.scheduleConflictCount, 1);
  assert.equal(overlapping.overlapBedCount, 0);

  const other = await createDripFixture(ALICE, { name: 'Second', beds: ['bed-2', 'bed-3'] });
  await createIrrigationEventForUser(ALICE, runningDraft(other, 600));
  const onBusyBeds = await createIrrigationEventForUser(ALICE, plannedDraft(fixture, {
    startAt: '2026-06-16T10:00:00.000Z', endAt: '2026-06-16T11:00:00.000Z', durationSeconds: 3600,
  }));
  assert.equal(onBusyBeds.overlapBedCount, 1, 'bed-2 est arrosée par l’irrigation en cours');
  assert.equal(onBusyBeds.scheduleConflictCount, 0);
});

test('cycle complet : planifiée, démarrée, pause, reprise, arrêt anticipé, reprise, terminée, puis immuable', async () => {
  const clock = startClock();
  const fixture = await createDripFixture(ALICE, { rateMmPerHour: 12, beds: ['bed-1', 'bed-2'] });
  const { eventEquipmentId } = await createPlanned(fixture, 1200);

  const started = await startIrrigationEventForUser(ALICE, eventEquipmentId, 1, 1);
  assert.equal(started.pushSchedule?.dueAt, clock.plusMinutesIso(20));
  assert.equal(started.pushSchedule?.status, 'pending');
  assert.equal(started.pushSchedule?.equipmentName, 'Goutte-à-goutte');
  assert.deepEqual(await getIrrigationPushScheduleForUser(ALICE, eventEquipmentId), started.pushSchedule);
  let event = await onlyEvent(ALICE);
  assert.equal(event.equipment.timerState, 'running');
  assert.equal(event.equipment.timerStartedAt, clock.nowIso());
  assert.equal(await readWaterBudgetRevisionForUser(ALICE), 2, 'révision attendue 1 → 2');

  clock.tickMinutes(5);
  await pauseIrrigationEventForUser(ALICE, eventEquipmentId);
  event = await onlyEvent(ALICE);
  assert.equal(event.equipment.timerState, 'paused');
  assert.equal(event.equipment.timerAccumulatedSeconds, 300);
  assert.equal(event.equipment.timerAlarmRevision, null, 'l’alarme est levée pendant la pause');
  assert.equal(await getIrrigationPushScheduleForUser(ALICE, eventEquipmentId), null);

  clock.tickMinutes(2);
  const resumed = await resumeIrrigationEventForUser(ALICE, eventEquipmentId);
  assert.equal(resumed.pushSchedule?.dueAt, clock.plusMinutesIso(15), 'il reste 15 minutes sur 20');
  assert.notEqual(resumed.pushSchedule?.revision, started.pushSchedule?.revision);

  clock.tickMinutes(5);
  assert.equal(await finishIrrigationEventForUser(ALICE, eventEquipmentId, null), 'partially_completed');
  event = await onlyEvent(ALICE, true);
  assert.equal(event.status, 'partially_completed');
  assert.equal(event.equipment.actualDurationSeconds, 600);
  assert.equal(event.equipment.timerState, null);
  assert.equal(event.equipment.actualEndAt, clock.nowIso());
  for (const application of event.equipment.applications) {
    assert.ok(Math.abs(application.actualAmountMm - 2) < 1e-9, '12 mm/h pendant 10 minutes = 2 mm');
    assert.equal(application.plannedAmountMm, 4);
  }
  assert.deepEqual(
    event.timerHistory?.map((entry) => entry.payload.timerAction ?? entry.action),
    ['created', 'started', 'paused', 'resumed', 'partially_completed'],
  );

  const restarted = await startIrrigationEventForUser(ALICE, eventEquipmentId);
  assert.equal(restarted.pushSchedule?.dueAt, clock.plusMinutesIso(10), 'reprise du reliquat : 10 minutes restantes');
  clock.tickMinutes(10);
  assert.equal(await finishIrrigationEventForUser(ALICE, eventEquipmentId, null), 'completed');
  event = await onlyEvent(ALICE);
  assert.equal(event.status, 'completed');
  assert.equal(event.equipment.actualDurationSeconds, 1200);
  assert.deepEqual(event.equipment.applications.map((application) => application.actualAmountMm), [4, 4]);

  await assert.rejects(startIrrigationEventForUser(ALICE, eventEquipmentId), IrrigationEventStateError);
  await assert.rejects(updatePlannedIrrigationForUser(ALICE, eventEquipmentId, plannedDraft(fixture, { startAt: T0, endAt: T0, durationSeconds: 60 })), IrrigationEventStateError);
  await assert.rejects(cancelPlannedIrrigationForUser(ALICE, eventEquipmentId), IrrigationEventStateError);
  await assert.rejects(cancelRemainingIrrigationForUser(ALICE, eventEquipmentId), IrrigationEventStateError);
  await assert.rejects(pauseIrrigationEventForUser(ALICE, eventEquipmentId), IrrigationEventStateError);
  assert.equal(await finishIrrigationEventForUser(ALICE, eventEquipmentId, null), 'completed', 'terminer une irrigation terminée rend son statut sans rien changer');
  const frozen = await onlyEvent(ALICE);
  assert.deepEqual(frozen, event);
});

test('reliquat : annulable une fois après un arrêt anticipé, puis plus aucun démarrage', async () => {
  const clock = startClock();
  const fixture = await createDripFixture(ALICE);
  const { eventEquipmentId } = await createPlanned(fixture, 1200);
  await assert.rejects(cancelRemainingIrrigationForUser(ALICE, eventEquipmentId), /reliquat/);
  await startIrrigationEventForUser(ALICE, eventEquipmentId);
  clock.tickMinutes(3);
  assert.equal(await finishIrrigationEventForUser(ALICE, eventEquipmentId, null), 'partially_completed');
  await cancelRemainingIrrigationForUser(ALICE, eventEquipmentId);
  const event = await onlyEvent(ALICE);
  assert.equal(event.remainingCanceledAt, clock.nowIso());
  assert.equal(event.equipment.remainingCanceledAt, clock.nowIso());
  assert.equal(event.status, 'partially_completed');
  await assert.rejects(cancelRemainingIrrigationForUser(ALICE, eventEquipmentId), IrrigationEventStateError);
  await assert.rejects(startIrrigationEventForUser(ALICE, eventEquipmentId), /ne peut pas être démarrée/);
});

test('démarrer : refusé si le matériel est déjà en cours, si l’irrigation est terminée ou déjà entièrement réalisée', async () => {
  startClock();
  const fixture = await createDripFixture(ALICE);
  const { eventEquipmentId: first } = await createPlanned(fixture, 600, '2026-06-15T10:00:00.000Z', '2026-06-15T10:10:00.000Z');
  const { eventEquipmentId: second } = await createPlanned(fixture, 600, '2026-06-15T12:00:00.000Z', '2026-06-15T12:10:00.000Z');
  await startIrrigationEventForUser(ALICE, first);
  await assert.rejects(startIrrigationEventForUser(ALICE, second), IrrigationEquipmentAlreadyRunningError);
  await assert.rejects(createIrrigationEventForUser(ALICE, runningDraft(fixture, 600)), IrrigationEquipmentAlreadyRunningError);
  await assert.rejects(startIrrigationEventForUser(ALICE, first), /ne peut pas être démarrée/, 'déjà en cours');

  await createIrrigationEventForUser(ALICE, completedDraft(fixture, { startAt: '2026-06-14T06:00:00.000Z', endAt: '2026-06-14T06:10:00.000Z', durationSeconds: 600 }));
  const completed = (await listIrrigationEventsForUser(ALICE)).find((event) => event.status === 'completed');
  await assert.rejects(startIrrigationEventForUser(ALICE, completed!.equipment.id), /ne peut pas être démarrée/);

  // Durée prévue nulle mais période valide : rien à réaliser, le démarrage est refusé.
  const { eventEquipmentId: empty } = await createPlanned(fixture, 0, '2026-06-15T14:00:00.000Z', '2026-06-15T14:10:00.000Z');
  await assert.rejects(startIrrigationEventForUser(ALICE, empty), /déjà entièrement réalisée/);
});

test('pause et reprise refusées hors de leur état', async () => {
  startClock();
  const fixture = await createDripFixture(ALICE);
  const { eventEquipmentId } = await createPlanned(fixture, 600);
  await assert.rejects(pauseIrrigationEventForUser(ALICE, eventEquipmentId), /n’est pas en cours/);
  await assert.rejects(resumeIrrigationEventForUser(ALICE, eventEquipmentId), /n’est pas en pause/);
  await startIrrigationEventForUser(ALICE, eventEquipmentId);
  await assert.rejects(resumeIrrigationEventForUser(ALICE, eventEquipmentId), /n’est pas en pause/);
});

test('terminer : heure de fin contrôlée, durée nulle refusée, planifiée non démarrée refusée', async () => {
  const clock = startClock();
  const fixture = await createDripFixture(ALICE);
  const { eventEquipmentId } = await createPlanned(fixture, 1200);
  await assert.rejects(finishIrrigationEventForUser(ALICE, eventEquipmentId, null), /n’est pas en cours/);

  await startIrrigationEventForUser(ALICE, eventEquipmentId);
  await assert.rejects(finishIrrigationEventForUser(ALICE, eventEquipmentId, null), /heure réelle de fin est invalide/, 'fin égale au démarrage');
  mock.timers.tick(500);
  await assert.rejects(finishIrrigationEventForUser(ALICE, eventEquipmentId, null), /durée réelle/, 'moins d’une seconde écoulée');
  await assert.rejects(finishIrrigationEventForUser(ALICE, eventEquipmentId, clock.plusMinutesIso(-60)), /heure réelle de fin est invalide/);
  await assert.rejects(finishIrrigationEventForUser(ALICE, eventEquipmentId, clock.plusMinutesIso(120)), /heure réelle de fin est invalide/);
  await assert.rejects(finishIrrigationEventForUser(ALICE, eventEquipmentId, 'pas une date'), IrrigationEventInputError);

  clock.tickMinutes(4);
  await pauseIrrigationEventForUser(ALICE, eventEquipmentId);
  clock.tickMinutes(4);
  await resumeIrrigationEventForUser(ALICE, eventEquipmentId);
  await assert.rejects(finishIrrigationEventForUser(ALICE, eventEquipmentId, clock.plusMinutesIso(-2)), /précéder la dernière reprise/);
  clock.tickMinutes(2);
  assert.equal(await finishIrrigationEventForUser(ALICE, eventEquipmentId, clock.plusMinutesIso(-1)), 'partially_completed');
  const event = await onlyEvent(ALICE);
  assert.equal(event.equipment.actualDurationSeconds, 300, '4 minutes avant la pause + 1 minute après la reprise');
  assert.equal(event.equipment.actualEndAt, clock.plusMinutesIso(-1));
});

test('annuler une planifiée : les deux lignes passent canceled avec leur horodatage ; refusé une fois démarrée', async () => {
  const clock = startClock();
  const fixture = await createDripFixture(ALICE);
  const { eventEquipmentId } = await createPlanned(fixture, 600);
  await cancelPlannedIrrigationForUser(ALICE, eventEquipmentId);
  const canceled = await onlyEvent(ALICE, true);
  assert.equal(canceled.status, 'canceled');
  assert.equal(canceled.canceledAt, clock.nowIso());
  assert.equal(canceled.equipment.status, 'canceled');
  assert.equal(canceled.equipment.canceledAt, clock.nowIso());
  assert.deepEqual(canceled.timerHistory?.map((entry) => entry.action), ['created', 'canceled']);
  await assert.rejects(cancelPlannedIrrigationForUser(ALICE, eventEquipmentId), IrrigationEventStateError);
  await assert.rejects(startIrrigationEventForUser(ALICE, eventEquipmentId), IrrigationEventStateError);

  const { eventEquipmentId: running } = await createPlanned(fixture, 600, '2026-06-15T12:00:00.000Z', '2026-06-15T12:10:00.000Z');
  await startIrrigationEventForUser(ALICE, running);
  await assert.rejects(cancelPlannedIrrigationForUser(ALICE, running), /ne peut pas être annulée/);
});

test('modifier une planifiée : période, note et planches remplacées ; refus si démarrée ou si le brouillon n’est plus planifié', async () => {
  startClock();
  const fixture = await createDripFixture(ALICE, { rateMmPerHour: 10, beds: ['bed-1', 'bed-2'] });
  const { eventEquipmentId } = await createPlanned(fixture, 3600);
  const result = await updatePlannedIrrigationForUser(ALICE, eventEquipmentId, plannedDraft(fixture, {
    startAt: '2026-06-16T10:00:00.000Z', endAt: '2026-06-16T12:00:00.000Z', durationSeconds: 7200,
  }, { note: 'décalée', applications: [fixture.applications[0]] }));
  assert.deepEqual({ overlapBedCount: result.overlapBedCount, scheduleConflictCount: result.scheduleConflictCount, pushSchedule: result.pushSchedule }, { overlapBedCount: 0, scheduleConflictCount: 0, pushSchedule: null });
  assert.ok(result.eventId && result.eventEquipmentId, 'le résultat nomme l’irrigation créée, pour le planning');
  const updated = await onlyEvent(ALICE, true);
  assert.equal(updated.note, 'décalée');
  assert.equal(updated.equipment.plannedStartAt, '2026-06-16T10:00:00.000Z');
  assert.equal(updated.equipment.plannedDurationSeconds, 7200);
  assert.deepEqual(updated.equipment.applications.map((application) => [application.otfBedId, application.plannedAmountMm]), [['bed-1', 20]]);
  assert.deepEqual(updated.timerHistory?.map((entry) => entry.payload.timerAction ?? entry.action), ['created', 'planning_modified']);

  await assert.rejects(
    updatePlannedIrrigationForUser(ALICE, eventEquipmentId, completedDraft(fixture, { startAt: T0, endAt: T0, durationSeconds: 60 })),
    /conserver une période planifiée/,
  );
  await assert.rejects(updatePlannedIrrigationForUser(ALICE, 'inconnue', plannedDraft(fixture, { startAt: T0, endAt: T0, durationSeconds: 60 })), IrrigationEventNotFoundError);
  await startIrrigationEventForUser(ALICE, eventEquipmentId);
  await assert.rejects(
    updatePlannedIrrigationForUser(ALICE, eventEquipmentId, plannedDraft(fixture, { startAt: T0, endAt: T0, durationSeconds: 60 })),
    /Seule une irrigation planifiée/,
  );
});

test('alarme push : le marquage n’agit qu’avec la révision courante et pour le propriétaire', async () => {
  const clock = startClock();
  const fixture = await createDripFixture(ALICE);
  const created = await createIrrigationEventForUser(ALICE, runningDraft(fixture, 600));
  const eventEquipmentId = (await onlyEvent(ALICE)).equipment.id;
  const revision = created.pushSchedule?.revision;
  assert.ok(revision, 'une irrigation démarrée porte une révision d’alarme');
  assert.equal(created.pushSchedule?.dueAt, clock.plusMinutesIso(10));

  await markIrrigationPushScheduleStatusForUser(ALICE, eventEquipmentId, 'revision-perimee', 'scheduled');
  assert.equal((await onlyEvent(ALICE)).equipment.timerAlarmStatus, 'pending');
  await markIrrigationPushScheduleStatusForUser(BOB, eventEquipmentId, revision, 'scheduled');
  assert.equal((await onlyEvent(ALICE)).equipment.timerAlarmStatus, 'pending');
  await markIrrigationPushScheduleStatusForUser(ALICE, eventEquipmentId, revision, 'scheduled');
  const marked = await onlyEvent(ALICE);
  assert.equal(marked.equipment.timerAlarmStatus, 'scheduled');
  assert.equal(marked.equipment.timerAlarmSyncedAt, clock.nowIso());
  assert.equal((await getIrrigationPushScheduleForUser(ALICE, eventEquipmentId))?.status, 'scheduled');
});

test('révisions optimistes : une révision attendue périmée est rejetée par la base et tout le lot est annulé', async () => {
  startClock();
  const fixture = await createDripFixture(ALICE);
  assert.equal(await readWaterBudgetRevisionForUser(ALICE), 0);
  const { eventEquipmentId } = await createPlanned(fixture, 600);
  assert.equal(await readWaterBudgetRevisionForUser(ALICE), 1, 'création sans révision attendue : +1');
  assert.equal(await readHydraulicRevisionForUser(ALICE), 1);

  // Le déclencheur SQL refuse toute révision qui ne vaut pas l'ancienne + 1 :
  // c'est le message que l'action serveur reconnaît pour demander d'actualiser.
  await assert.rejects(startIrrigationEventForUser(ALICE, eventEquipmentId, 7, 1), /WATER_BUDGET_CHANGED/);
  await assert.rejects(startIrrigationEventForUser(ALICE, eventEquipmentId, 1, 4), /HYDRAULIC_CHANGED/);
  const untouched = await onlyEvent(ALICE);
  assert.equal(untouched.equipment.timerState, null, 'le démarrage périmé n’a rien écrit');
  assert.equal(await readWaterBudgetRevisionForUser(ALICE), 1);
  assert.equal(await readHydraulicRevisionForUser(ALICE), 1);

  await startIrrigationEventForUser(ALICE, eventEquipmentId, 1, 1);
  assert.equal(await readWaterBudgetRevisionForUser(ALICE), 2, 'révision attendue 1 → 2');
  assert.equal(await readHydraulicRevisionForUser(ALICE), 2);
  await pauseIrrigationEventForUser(ALICE, eventEquipmentId);
  assert.equal(await readWaterBudgetRevisionForUser(ALICE), 3, 'une mutation sans révision attendue avance toujours de 1');
  assert.equal(await readHydraulicRevisionForUser(ALICE), 3);
  assert.equal(await readWaterBudgetRevisionForUser(BOB), 0, 'les compteurs d’un autre propriétaire ne bougent pas');
});

test('une application enregistre sa surface mouillée, NULL quand elle est inconnue, et la relit telle quelle', async () => {
  startClock();
  const fixture = await createDripFixture(ALICE, { beds: ['bed-1', 'bed-2'], bedAreaSquareMeters: 30 });
  // Deux planches : l'une mouillée sur 48 m² (aspersion, passe-pied compris), l'autre sans passe-pied connu.
  fixture.applications[0].wettedAreaSquareMeters = 48;
  fixture.applications[1].wettedAreaSquareMeters = null;
  await createIrrigationEventForUser(ALICE, completedDraft(fixture, { startAt: '2026-06-15T06:00:00.000Z', endAt: '2026-06-15T07:00:00.000Z', durationSeconds: 3600 }));
  const event = await onlyEvent(ALICE);
  const byBed = new Map(event.equipment.applications.map((application) => [application.otfBedId, application]));
  assert.equal(byBed.get('bed-1')?.bedAreaSquareMeters, 30, 'la surface de planche ne change pas');
  assert.equal(byBed.get('bed-1')?.wettedAreaSquareMeters, 48);
  assert.equal(byBed.get('bed-2')?.wettedAreaSquareMeters, null, 'inconnue reste inconnue, jamais la planche seule');
  // Le candidat de limite journalière somme les surfaces connues et signale l'incomplétude.
  const candidate = await readIrrigationStartLimitCandidateForUser(ALICE, event.equipment.id);
  assert.equal(candidate?.volumeComplete, false);
  assert.equal(candidate?.actualCubicMeters, 0.48, '10 mm sur 48 m²');
});

test('la surface mouillée d’une application ne bouge plus une fois enregistrée', async () => {
  startClock();
  const fixture = await createDripFixture(ALICE, { wettedAreaSquareMeters: 45 });
  await createIrrigationEventForUser(ALICE, completedDraft(fixture, { startAt: '2026-06-15T06:00:00.000Z', endAt: '2026-06-15T07:00:00.000Z', durationSeconds: 3600 }));
  const event = await onlyEvent(ALICE);
  assert.ok(event.equipment.applications.every((application) => application.wettedAreaSquareMeters === 45));
  const candidate = await readIrrigationStartLimitCandidateForUser(ALICE, event.equipment.id);
  assert.equal(candidate?.volumeComplete, true);
});

test('alarme de retard (3.7, règle 24) : une irrigation planifiée la porte pour son début plus R14 ; la modification la reprogramme, le démarrage la remplace, l’annulation la retire', async () => {
  const clock = startClock();
  const fixture = await createDripFixture(ALICE, { rateMmPerHour: 12, beds: ['bed-1', 'bed-2'] });
  const created = await createIrrigationEventForUser(
    ALICE,
    plannedDraft(fixture, { startAt: '2026-06-15T10:00:00.000Z', endAt: '2026-06-15T11:00:00.000Z', durationSeconds: 3600 }),
    { lateToleranceMinutes: 30 },
  );
  const eventEquipmentId = created.eventEquipmentId;
  assert.equal(created.pushSchedule?.kind, 'late');
  assert.equal(created.pushSchedule?.dueAt, '2026-06-15T10:30:00.000Z', 'le début plus 30 minutes');
  assert.equal(created.pushSchedule?.status, 'pending');
  assert.equal(created.pushSchedule?.equipmentName, 'Goutte-à-goutte');
  assert.deepEqual(await getIrrigationPushScheduleForUser(ALICE, eventEquipmentId), created.pushSchedule);
  assert.equal((await onlyEvent(ALICE)).equipment.timerAlarmStatus, 'pending');

  clock.tickMinutes(1);
  const updated = await updatePlannedIrrigationForUser(
    ALICE,
    eventEquipmentId,
    plannedDraft(fixture, { startAt: '2026-06-15T12:00:00.000Z', endAt: '2026-06-15T13:00:00.000Z', durationSeconds: 3600 }),
    { lateToleranceMinutes: 45 },
  );
  assert.equal(updated.pushSchedule?.kind, 'late');
  assert.equal(updated.pushSchedule?.dueAt, '2026-06-15T12:45:00.000Z', 'le nouveau créneau, la tolérance du moment');
  assert.ok(updated.pushSchedule && created.pushSchedule && updated.pushSchedule.revision > created.pushSchedule.revision, 'une révision plus récente, que le Worker préfère');
  assert.deepEqual(await getIrrigationPushScheduleForUser(ALICE, eventEquipmentId), updated.pushSchedule);

  clock.tickMinutes(1);
  const started = await startIrrigationEventForUser(ALICE, eventEquipmentId, 2, 2);
  assert.equal(started.pushSchedule?.kind, 'finished');
  assert.equal(started.pushSchedule?.dueAt, clock.plusMinutesIso(60));
  assert.ok(started.pushSchedule && updated.pushSchedule && started.pushSchedule.revision > updated.pushSchedule.revision);
  assert.deepEqual(await getIrrigationPushScheduleForUser(ALICE, eventEquipmentId), started.pushSchedule, 'l’échéance de retard est effacée : une seule alarme, celle de la fin');

  const second = await createIrrigationEventForUser(
    ALICE,
    plannedDraft(fixture, { startAt: '2026-06-16T10:00:00.000Z', endAt: '2026-06-16T11:00:00.000Z', durationSeconds: 3600 }),
    { lateToleranceMinutes: 30 },
  );
  assert.equal(second.pushSchedule?.kind, 'late');
  await cancelPlannedIrrigationForUser(ALICE, second.eventEquipmentId);
  assert.equal(await getIrrigationPushScheduleForUser(ALICE, second.eventEquipmentId), null, 'l’annulation retire l’alarme de la ligne');
});

test('alarme de retard : rien sans tolérance donnée, rien quand la tolérance atteint la fin du créneau, rien pour un créneau passé', async () => {
  startClock();
  const fixture = await createDripFixture(ALICE);
  const slot = (day: string) => ({ startAt: `2026-06-${day}T10:00:00.000Z`, endAt: `2026-06-${day}T11:00:00.000Z`, durationSeconds: 3600 });
  assert.equal((await createIrrigationEventForUser(ALICE, plannedDraft(fixture, slot('15')))).pushSchedule, null, 'sans tolérance, pas d’alerte');
  assert.equal((await createIrrigationEventForUser(ALICE, plannedDraft(fixture, slot('16')), { lateToleranceMinutes: 60 })).pushSchedule, null, '« non faite » avant « en retard »');
  assert.equal((await createIrrigationEventForUser(ALICE, plannedDraft(fixture, { startAt: '2026-06-15T06:00:00.000Z', endAt: '2026-06-15T07:00:00.000Z', durationSeconds: 3600 }), { lateToleranceMinutes: 30 })).pushSchedule, null, 'créneau passé');
  const events = await listIrrigationEventsForUser(ALICE);
  assert.equal(events.length, 3);
  assert.ok(events.every((event) => event.equipment.timerAlarmRevision === null && event.equipment.timerAlarmStatus === null), 'aucune ligne ne porte de révision d’alarme');
});
