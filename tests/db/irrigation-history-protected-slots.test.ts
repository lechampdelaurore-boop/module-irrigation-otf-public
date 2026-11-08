import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { saveFeatureSelectionForUser } from '../../db/feature-selection-repository';
import { createIrrigationEventForUser } from '../../db/irrigation-event/create';
import { createProtectedSlotForUser } from '../../db/protected-slots-repository';
import type { IrrigationSnapshot } from '../../lib/domain/domain';
import { withRequirements } from '../../lib/domain/features/selection';
import { minutesOfDay } from '../../lib/domain/planning/settings';
import { getIrrigationHistoryDashboardForUser } from '../../lib/services/irrigation-history-service';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { FIXTURE_PLOT_ID, FIXTURE_ZONE_ID, completedDraft, createDripFixture } from '../support/irrigation-fixtures';

/**
 * Le signal d'une irrigation faite pendant un créneau protégé, sur sa carte de
 * l'historique (docs/protected-slots-contract.md, règle 11, précisions S24 et
 * S25) : lu par le service depuis le journal des créneaux, il suit la case
 * du Planning, dont les créneaux sont un réglage (3.8, R1) ; une ferme d'avant
 * la 3.8 a tout coché (R6).
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
    { id: 'bed-2', zoneId: FIXTURE_ZONE_ID, plotId: FIXTURE_PLOT_ID, name: 'P2', length: 40, width: 0.75, alleyWidth: 0.45, area: 30, seasons: [2026] },
  ],
  source: 'cache',
  lastSuccessfulReadAt: '2026-09-29T00:00:00.000Z',
};

async function signals(): Promise<string[][]> {
  const dashboard = await getIrrigationHistoryDashboardForUser({
    ownerUserId: ALICE,
    season: 2026,
    snapshot,
    now: NOW,
    selection: { period: { mode: 'week', anchorDate: '2026-09-29' }, scope: { level: 'farm' }, page: 1 },
  });
  return dashboard.history.items.map((item) => item.protectedSlotNames);
}

test('3.8 ter, règle 11 : la carte d’une irrigation faite pendant un créneau protégé le nomme, Planning coché seulement (3.8, R1)', async () => {
  const fixture = await createDripFixture(ALICE, { beds: ['bed-1', 'bed-2'] });
  // Mardi 29 septembre, 22 h – 23 h à la ferme (UTC+2), saisie après coup.
  await createIrrigationEventForUser(ALICE, completedDraft(fixture, { startAt: '2026-09-29T20:00:00.000Z', endAt: '2026-09-29T21:00:00.000Z', durationSeconds: 3600 }));
  await createProtectedSlotForUser(ALICE, ALICE, { name: 'Lavage', weekdays: ['tuesday'], startMinute: minutesOfDay(22, 30), endMinute: minutesOfDay(23, 30) });
  // Le journal date chaque version de son geste : celle-ci est ramenée avant l'irrigation, comme un créneau posé en septembre.
  database.sqlite.prepare('UPDATE irrigation_protected_slots_log SET created_at = ?').run('2026-09-01T08:00:00.000Z');

  assert.deepEqual(await signals(), [['Lavage']], 'une ferme d’avant la 3.8 a tout coché (R6)');

  await saveFeatureSelectionForUser(ALICE, withRequirements(['arrosages']), NOW);
  assert.deepEqual(await signals(), [[]], 'Planning décoché : le créneau n’est ni affiché ni pris en compte');

  await saveFeatureSelectionForUser(ALICE, withRequirements(['arrosages', 'planning']), NOW);
  assert.deepEqual(await signals(), [['Lavage']], 'Planning recoché : le signal revient, le journal n’a pas bougé');
});
