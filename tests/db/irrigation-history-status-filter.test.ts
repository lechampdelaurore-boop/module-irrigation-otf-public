import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { createIrrigationEventForUser } from '../../db/irrigation-event/create';
import type { IrrigationSnapshot } from '../../lib/domain/domain';
import {
  getIrrigationHistoryDashboardForUser,
  getIrrigationHistoryExportForUser,
  type IrrigationHistorySelection,
} from '../../lib/services/irrigation-history-service';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { FIXTURE_PLOT_ID, FIXTURE_ZONE_ID, completedDraft, createDripFixture, plannedDraft } from '../support/irrigation-fixtures';

/**
 * L'historique s'ouvre sur les irrigations réalisées (audit ergonomique,
 * point 11, 3.8 quater) : la liste et son nombre suivent le filtre, les
 * onglets disent combien chaque filtre en trouve, les cumuls ne changent pas,
 * et l'export suit le filtre — un lien sans filtre exporte tout, comme avant.
 */

const ALICE = 'alice';
const NOW = new Date('2026-09-30T10:00:00.000Z');

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
  ],
  source: 'cache',
  lastSuccessfulReadAt: '2026-09-29T00:00:00.000Z',
};

const week = (status?: IrrigationHistorySelection['status']): IrrigationHistorySelection => ({
  period: { mode: 'week', anchorDate: '2026-09-29' },
  scope: { level: 'farm' },
  status,
  page: 1,
});

async function seedOneDoneOnePlanned() {
  const fixture = await createDripFixture(ALICE, { beds: ['bed-1'] });
  const done = await createIrrigationEventForUser(ALICE, completedDraft(fixture, { startAt: '2026-09-29T06:00:00.000Z', endAt: '2026-09-29T07:00:00.000Z', durationSeconds: 3600 }));
  const planned = await createIrrigationEventForUser(ALICE, plannedDraft(fixture, { startAt: '2026-10-02T06:00:00.000Z', endAt: '2026-10-02T07:00:00.000Z', durationSeconds: 3600 }), { lateToleranceMinutes: 15 });
  return { doneId: done.eventId, plannedId: planned.eventId };
}

test('audit, point 11 : la liste s’ouvre sur les réalisées, les onglets comptent chaque filtre, les cumuls ne bougent pas', async () => {
  const { doneId, plannedId } = await seedOneDoneOnePlanned();
  const dashboard = await getIrrigationHistoryDashboardForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: NOW, selection: week() });
  assert.equal(dashboard.statusFilter, 'done');
  assert.deepEqual(dashboard.statusCounts, { done: 1, planned: 1, all: 2 });
  assert.deepEqual(dashboard.history.items.map((item) => item.id), [doneId]);
  assert.equal(dashboard.history.totalItems, 1);

  const planned = await getIrrigationHistoryDashboardForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: NOW, selection: week('planned') });
  assert.deepEqual(planned.history.items.map((item) => item.id), [plannedId]);
  assert.deepEqual(planned.summary, dashboard.summary, 'les cumuls ne comptent que l’eau réellement apportée, quel que soit le filtre');

  const all = await getIrrigationHistoryDashboardForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: NOW, selection: week('all') });
  assert.deepEqual(new Set(all.history.items.map((item) => item.id)), new Set([doneId, plannedId]), '« Toutes » garde la liste d’avant');
});

test('audit, point 11 : l’export suit le filtre de la liste ; un lien sans filtre exporte tout', async () => {
  const { doneId, plannedId } = await seedOneDoneOnePlanned();
  const exported = async (status?: IrrigationHistorySelection['status']) =>
    (await getIrrigationHistoryExportForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: NOW, selection: week(status) })).items.map((item) => item.id);
  assert.deepEqual(await exported('done'), [doneId]);
  assert.deepEqual(await exported('planned'), [plannedId]);
  assert.deepEqual(new Set(await exported()), new Set([doneId, plannedId]));
});
