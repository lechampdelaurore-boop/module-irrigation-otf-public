import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { createIrrigationEventForUser } from '../../db/irrigation-event/create';
import { readLatestPlanForUser, savePlanCalculationForUser } from '../../db/planning-repository';
import { keepPlanSuggestionForUser, listKeptSuggestions } from '../../db/planning-suggestions-repository';
import { ensureWorkspaceForUser } from '../../db/workspace-repository';
import type { PlanSuggestion, WeeklyPlan } from '../../lib/domain/planning/contract';
import { DEFAULT_PLANNING_SETTINGS } from '../../lib/domain/planning/settings';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { createDripFixture, plannedDraft } from '../support/irrigation-fixtures';

/**
 * « Garder » une suggestion (3.7, docs/replanning-contract.md, règle 17) :
 * le registre retient la suggestion tue avec sa dose, par irrigation
 * planifiée de l'exploitation ; le plan relu la marque, et un calcul
 * antérieur à la 3.7 se relit sans suggestion.
 */

const ALICE = 'alice';
const BOB = 'bob';
const WEEK = '2026-09-28';
const START = '2026-09-30T06:00:00.000Z';
const END = '2026-09-30T06:34:17.000Z';

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

let fixtures = 0;

/** Une irrigation planifiée de la semaine, sur un matériel à elle, créée par le vrai dépôt ; rend sa ligne de matériel. */
async function plannedIrrigation(owner = ALICE): Promise<string> {
  fixtures += 1;
  const fixture = await createDripFixture(owner, { name: `Goutte-à-goutte ${fixtures}` });
  const created = await createIrrigationEventForUser(owner, plannedDraft(fixture, { startAt: START, endAt: END, durationSeconds: 2057 }));
  return created.eventEquipmentId;
}

function suggestion(eventEquipmentId: string, overrides: Partial<PlanSuggestion> = {}): PlanSuggestion {
  return {
    eventId: 'irrigation', eventEquipmentId, equipmentId: 'gag', equipmentName: 'Goutte-à-goutte', kind: 'drip', priority: 'normal',
    plannedStartAt: START, plannedEndAt: END, plannedDurationSeconds: 2057, plannedDoseMm: 8,
    suggestion: 'reduce', doseMm: 4.0017, durationSeconds: 1029, endAt: '2026-09-30T06:17:09.000Z', causes: [],
    ...overrides,
  };
}

function plan(suggestions: PlanSuggestion[], computedAt = '2026-09-30T05:00:00.000Z'): WeeklyPlan {
  return {
    weekStart: WEEK, weekEnd: '2026-10-04', computedAt, horizonStartAt: computedAt, horizonEndAt: '2026-10-04T22:00:00.000Z',
    proposals: [], beds: [], deficit: { waterCubicMeters: 0, pumpTimeCubicMeters: 0, byReason: {}, bedCount: 0 }, budgets: [],
    suggestions, overcommittedDays: [{ date: '2026-09-30', limitCubicMeters: 3, committedCubicMeters: 5.775 }],
    settings: DEFAULT_PLANNING_SETTINGS, assumptions: { forecastDays: 7, reservoirsObservedAt: [] },
  };
}

test('garder : une ligne par suggestion ; la même dose au dixième n’écrit pas deux fois ; une autre dose, ou « Annuler », en écrit une autre', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  const eventEquipmentId = await plannedIrrigation();
  const keep = (suggestion: 'cancel' | 'reduce', doseMm: number | null) => keepPlanSuggestionForUser(ALICE, { eventEquipmentId, suggestion, doseMm, actorUserId: ALICE });
  assert.equal(await keep('reduce', 4.0017), 'kept');
  assert.equal(await keep('reduce', 4), 'already-kept', '4,0017 mm et 4 mm s’affichent pareil');
  assert.equal(await keep('reduce', 3.96), 'already-kept');
  assert.equal(await keep('reduce', 4.1), 'kept', 'une autre dose');
  assert.equal(await keep('cancel', null), 'kept', '« Annuler » après « Réduire »');
  assert.equal(await keep('cancel', 7), 'already-kept', 'la dose d’une annulation ne compte pas');
  assert.deepEqual(await listKeptSuggestions(workspaceId, 2026), [
    { eventEquipmentId, suggestion: 'reduce', doseMm: 4.0017 },
    { eventEquipmentId, suggestion: 'reduce', doseMm: 4.1 },
    { eventEquipmentId, suggestion: 'cancel', doseMm: null },
  ]);
  assert.deepEqual(await listKeptSuggestions(workspaceId, 2025), [], 'la saison est celle de l’irrigation');
});

test('une irrigation d’une autre exploitation, ou inconnue : introuvable, rien n’est écrit', async () => {
  const eventEquipmentId = await plannedIrrigation(ALICE);
  assert.equal(await keepPlanSuggestionForUser(BOB, { eventEquipmentId, suggestion: 'cancel', doseMm: null, actorUserId: BOB }), 'not-found');
  assert.equal(await keepPlanSuggestionForUser(ALICE, { eventEquipmentId: 'inconnue', suggestion: 'cancel', doseMm: null, actorUserId: ALICE }), 'not-found');
  assert.deepEqual(await listKeptSuggestions(await ensureWorkspaceForUser(BOB), 2026), []);
  assert.deepEqual(await listKeptSuggestions(await ensureWorkspaceForUser(ALICE), 2026), []);
});

test('la base refuse une réduction sans dose ou à dose nulle, une annulation avec dose, et une suggestion inconnue', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  const eventEquipmentId = await plannedIrrigation();
  const insert = database.sqlite.prepare('INSERT INTO irrigation_plan_suggestion_keeps (id, workspace_id, season, event_equipment_id, suggestion, dose_mm) VALUES (?, ?, 2026, ?, ?, ?)');
  assert.throws(() => insert.run('k-1', workspaceId, eventEquipmentId, 'reduce', null), /chk_plan_keep_dose/);
  assert.throws(() => insert.run('k-2', workspaceId, eventEquipmentId, 'reduce', 0), /chk_plan_keep_dose/);
  assert.throws(() => insert.run('k-3', workspaceId, eventEquipmentId, 'cancel', 4), /chk_plan_keep_dose/);
  assert.throws(() => insert.run('k-4', workspaceId, eventEquipmentId, 'keep', null), /chk_plan_keep_suggestion/);
  assert.throws(() => insert.run('k-5', workspaceId, 'irrigation-inconnue', 'cancel', null), /FOREIGN KEY/);
  insert.run('k-6', workspaceId, eventEquipmentId, 'reduce', 4);
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) AS n FROM irrigation_plan_suggestion_keeps').get()!.n, 1);
});

test('le plan relu marque les suggestions gardées, et garde les jours dépassés ; un calcul antérieur à la 3.7 se relit sans suggestion', async () => {
  const first = await plannedIrrigation();
  const second = await plannedIrrigation();
  await savePlanCalculationForUser(ALICE, { season: 2026, weekStart: WEEK, trigger: 'event', triggerEvent: 'rain-recorded', actorUserId: null, plan: plan([
    suggestion(first),
    suggestion(second, { eventId: 'autre', suggestion: 'cancel', doseMm: null, durationSeconds: null, endAt: null }),
  ]) });
  const kept = async () => (await readLatestPlanForUser(ALICE, 2026, WEEK))!.suggestions.map((item) => [item.eventEquipmentId, item.kept]);
  assert.deepEqual(await kept(), [[first, false], [second, false]]);
  await keepPlanSuggestionForUser(ALICE, { eventEquipmentId: first, suggestion: 'reduce', doseMm: 4, actorUserId: ALICE });
  assert.deepEqual(await kept(), [[first, true], [second, false]]);
  await keepPlanSuggestionForUser(ALICE, { eventEquipmentId: second, suggestion: 'reduce', doseMm: 2, actorUserId: ALICE });
  assert.deepEqual(await kept(), [[first, true], [second, false]], '« Réduire » gardé ne tait pas « Annuler »');
  await keepPlanSuggestionForUser(ALICE, { eventEquipmentId: second, suggestion: 'cancel', doseMm: null, actorUserId: ALICE });
  assert.deepEqual(await kept(), [[first, true], [second, true]]);
  const stored = (await readLatestPlanForUser(ALICE, 2026, WEEK))!;
  assert.deepEqual(stored.calculation.summary.overcommittedDays, [{ date: '2026-09-30', limitCubicMeters: 3, committedCubicMeters: 5.775 }]);
  assert.deepEqual(stored.calculation.summary.suggestions.map((item) => item.suggestion), ['reduce', 'cancel']);
  assert.deepEqual(stored.suggestions[0].causes, []);

  // Un calcul enregistré avant la 3.7 : son résumé n'a ni suggestions ni jours dépassés.
  const legacy = { weekEnd: '2026-10-04', beds: [], deficit: stored.calculation.summary.deficit, budgets: [], assumptions: stored.calculation.summary.assumptions };
  database.sqlite.prepare('UPDATE irrigation_plan_calculations SET summary = ? WHERE id = ?').run(JSON.stringify(legacy), stored.calculation.id);
  const reread = (await readLatestPlanForUser(ALICE, 2026, WEEK))!;
  assert.deepEqual(reread.calculation.summary.suggestions, []);
  assert.deepEqual(reread.calculation.summary.overcommittedDays, []);
  assert.deepEqual(reread.suggestions, []);
  assert.equal(reread.calculation.summary.weekEnd, '2026-10-04');
});
