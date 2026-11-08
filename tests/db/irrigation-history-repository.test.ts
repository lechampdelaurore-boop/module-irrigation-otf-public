import assert from 'node:assert/strict';
import test, { afterEach, beforeEach, mock } from 'node:test';
import { cancelPlannedIrrigationForUser } from '../../db/irrigation-event/completion';
import { createIrrigationEventForUser } from '../../db/irrigation-event/create';
import { listIrrigationEventsForUser } from '../../db/irrigation-event/read';
import { listIrrigationHistoryForUser, type IrrigationHistoryScopeFilter } from '../../db/irrigation-history-repository';
import { ensureWorkspaceForUser } from '../../db/workspace-repository';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { completedDraft, createDripFixture, plannedDraft, runningDraft } from '../support/irrigation-fixtures';

const ALICE = 'alice';
const BOB = 'bob';
const FARM: IrrigationHistoryScopeFilter = { level: 'farm', zoneId: null, plotId: null, bedId: null };
const JUNE = { season: 2026, startAt: '2026-06-01T00:00:00.000Z', endAtExclusive: '2026-07-01T00:00:00.000Z', scope: FARM };

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-06-15T08:00:00.000Z') });
});
afterEach(() => {
  mock.timers.reset();
  database.dispose();
});

test('l’historique d’une période : réalisées par leurs dates réelles, planifiées par leurs dates prévues, annulées par leur annulation ; ordre décroissant', async () => {
  const fixture = await createDripFixture(ALICE, { beds: ['bed-1', 'bed-2'] });
  await createIrrigationEventForUser(ALICE, completedDraft(fixture, { startAt: '2026-06-10T06:00:00.000Z', endAt: '2026-06-10T07:00:00.000Z', durationSeconds: 3600 }, { note: 'réalisée' }));
  await createIrrigationEventForUser(ALICE, plannedDraft(fixture, { startAt: '2026-06-20T10:00:00.000Z', endAt: '2026-06-20T11:00:00.000Z', durationSeconds: 3600 }, { note: 'planifiée' }));
  await createIrrigationEventForUser(ALICE, plannedDraft(fixture, { startAt: '2026-06-05T10:00:00.000Z', endAt: '2026-06-05T11:00:00.000Z', durationSeconds: 3600 }, { note: 'annulée' }));
  const toCancel = (await listIrrigationEventsForUser(ALICE)).find((event) => event.note === 'annulée');
  await cancelPlannedIrrigationForUser(ALICE, toCancel!.equipment.id);
  await createIrrigationEventForUser(ALICE, completedDraft(fixture, { startAt: '2026-05-30T22:00:00.000Z', endAt: '2026-06-01T02:00:00.000Z', durationSeconds: 7200 }, { note: 'à cheval sur le 1er juin' }));
  await createIrrigationEventForUser(ALICE, completedDraft(fixture, { startAt: '2026-07-02T06:00:00.000Z', endAt: '2026-07-02T07:00:00.000Z', durationSeconds: 3600 }, { note: 'juillet' }));

  const history = await listIrrigationHistoryForUser(ALICE, JUNE);
  assert.deepEqual(history.map((event) => event.note), ['planifiée', 'réalisée', 'annulée', 'à cheval sur le 1er juin']);
  assert.deepEqual(history.map((event) => event.status), ['planned', 'completed', 'canceled', 'completed']);
  for (const event of history) {
    assert.ok(event.timerHistory && event.timerHistory.length >= 1, 'le journal accompagne chaque irrigation');
    assert.equal(event.equipment.applications.length, 2);
  }
  assert.deepEqual(history[2].timerHistory?.map((entry) => entry.action), ['created', 'canceled']);
  assert.deepEqual(await listIrrigationHistoryForUser(ALICE, { ...JUNE, season: 2025 }), [], 'autre saison');
  assert.deepEqual(await listIrrigationHistoryForUser(ALICE, { ...JUNE, startAt: '2026-08-01T00:00:00.000Z', endAtExclusive: '2026-09-01T00:00:00.000Z' }), [], 'période sans irrigation');
});

test('le périmètre OTF filtre par zone, parcelle ou planche, et un autre propriétaire ne voit rien', async () => {
  const north = await createDripFixture(ALICE, { name: 'Nord', beds: ['bed-1', 'bed-2'] });
  await createIrrigationEventForUser(ALICE, completedDraft(north, { startAt: '2026-06-10T06:00:00.000Z', endAt: '2026-06-10T07:00:00.000Z', durationSeconds: 3600 }, { note: 'nord' }));
  await createIrrigationEventForUser(ALICE, completedDraft(north, {
    startAt: '2026-06-11T06:00:00.000Z', endAt: '2026-06-11T07:00:00.000Z', durationSeconds: 3600,
  }, { note: 'nord, planche 2 seule', applications: [north.applications[1]] }));

  const byBed = (bedId: string) => listIrrigationHistoryForUser(ALICE, { ...JUNE, scope: { level: 'bed', zoneId: 'zone-1', plotId: 'plot-1', bedId } });
  assert.deepEqual((await byBed('bed-1')).map((event) => event.note), ['nord']);
  assert.deepEqual((await byBed('bed-2')).map((event) => event.note).sort(), ['nord', 'nord, planche 2 seule']);
  assert.deepEqual(await byBed('bed-9'), []);
  const bed2Only = (await byBed('bed-2')).find((event) => event.note === 'nord');
  assert.deepEqual(bed2Only?.equipment.applications.map((application) => application.otfBedId), ['bed-2'], 'seules les applications du périmètre sont rapportées');

  assert.equal((await listIrrigationHistoryForUser(ALICE, { ...JUNE, scope: { level: 'plot', zoneId: 'zone-1', plotId: 'plot-1', bedId: null } })).length, 2);
  assert.deepEqual(await listIrrigationHistoryForUser(ALICE, { ...JUNE, scope: { level: 'zone', zoneId: 'zone-9', plotId: null, bedId: null } }), []);
  await ensureWorkspaceForUser(BOB);
  assert.deepEqual(await listIrrigationHistoryForUser(BOB, JUNE), []);
});

test('une irrigation en cours sans dates prévues apparaît par sa date de création', async () => {
  const fixture = await createDripFixture(ALICE);
  await createIrrigationEventForUser(ALICE, runningDraft(fixture, 600, { note: 'au minuteur' }));
  // created_at est posé par la base avec l'heure réelle : la période couvre l'année entière.
  const wide = await listIrrigationHistoryForUser(ALICE, { ...JUNE, startAt: '2026-01-01T00:00:00.000Z', endAtExclusive: '2027-01-01T00:00:00.000Z' });
  assert.deepEqual(wide.map((event) => [event.note, event.equipment.timerState]), [['au minuteur', 'running']]);
});

test('une lecture sans saison rapporte les irrigations de toutes les saisons dans la fenêtre d’instants, pour le suivi par série', async () => {
  // Une série de la saison 2026 implantée en novembre 2025 : ses irrigations
  // d'automne ont été enregistrées sous la saison 2025 (docs/series-contract.md).
  const autumn = await createDripFixture(ALICE, { season: 2025, name: 'Automne' });
  const spring = await createDripFixture(ALICE, { season: 2026, name: 'Printemps' });
  await createIrrigationEventForUser(ALICE, completedDraft(autumn, { startAt: '2025-11-05T06:00:00.000Z', endAt: '2025-11-05T07:00:00.000Z', durationSeconds: 3600 }, { note: 'novembre 2025' }));
  await createIrrigationEventForUser(ALICE, completedDraft(spring, { startAt: '2026-04-05T06:00:00.000Z', endAt: '2026-04-05T07:00:00.000Z', durationSeconds: 3600 }, { note: 'avril 2026' }));

  const window = { startAt: '2025-11-03T00:00:00.000Z', endAtExclusive: '2026-06-15T00:00:00.000Z', scope: FARM };
  assert.deepEqual((await listIrrigationHistoryForUser(ALICE, { ...window, season: null })).map((event) => [event.note, event.season]), [['avril 2026', 2026], ['novembre 2025', 2025]]);
  assert.deepEqual((await listIrrigationHistoryForUser(ALICE, { ...window, season: 2026 })).map((event) => event.note), ['avril 2026'], 'la saison, quand elle est donnée, filtre toujours');
  await ensureWorkspaceForUser(BOB);
  assert.deepEqual(await listIrrigationHistoryForUser(BOB, { ...window, season: null }), [], 'toutes saisons ne veut pas dire tous propriétaires');
});
