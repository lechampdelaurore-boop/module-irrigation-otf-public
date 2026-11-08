import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { recordPlanEventForUser, settlePlanEvent } from '../../db/planning-events-repository';
import {
  PlanningSettingsInvalidError,
  decidePlanProposalForUser,
  listPlanningSettingsHistoryForUser,
  readLatestPlanForUser,
  readPlanningSettingsForUser,
  savePlanCalculationForUser,
  savePlanningSettingsForUser,
} from '../../db/planning-repository';
import { ensureWorkspaceForUser } from '../../db/workspace-repository';
import type { PlanProposal, WeeklyPlan } from '../../lib/domain/planning/contract';
import { effectiveProposalStatus } from '../../lib/domain/planning/contract';
import { DEFAULT_PLANNING_SETTINGS } from '../../lib/domain/planning/settings';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';

const ALICE = 'alice';
const BOB = 'bob';
const WEEK = '2026-09-28';

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

function proposal(id: string, startAt: string, durationSeconds: number): PlanProposal {
  const endAt = new Date(Date.parse(startAt) + durationSeconds * 1000).toISOString();
  return {
    id, equipmentId: 'rampe-bloc-2', equipmentName: 'rampe bloc 2', kind: 'sprinkler', settingId: 'standard', settingName: 'Standard', placementId: 'placement',
    startAt, endAt, durationSeconds, doseMm: 15,
    applications: [{ otfZoneId: 'zone', otfPlotId: 'plot', otfBedId: 'B2-1', rateMmPerHour: 6.667, bedAreaSquareMeters: 16.5, wettedAreaSquareMeters: 28.04 }],
    bedApplications: [{ bedId: 'B2-1', bedName: 'B2-1', needBeforeMm: 20, appliedMm: 15, needAfterMm: 5, surplusMm: 0, wettedAreaSquareMeters: 28.04 }],
    volumeCubicMeters: 0.42, flowCubicMetersPerHour: 1.87, pumpId: 'pompe', pumpOriginId: 'origine',
    justification: {
      priority: 'normal', doseReason: 'maximum-dose', timingReason: 'earliest', limitingConstraint: null,
      pump: { pumpId: 'pompe', pumpName: 'La pompe', flowCubicMetersPerHour: 1.87, alreadyEngagedCubicMetersPerHour: 0 },
      supply: { originKey: 'reservoir:reserve', originName: 'Réserve tampon', projectedLevelAfterCubicMeters: 29.5 },
      hydraulicallyVerified: true,
    },
  };
}

function plan(proposals: PlanProposal[], computedAt: string): WeeklyPlan {
  return {
    weekStart: WEEK, weekEnd: '2026-10-04', computedAt, horizonStartAt: computedAt, horizonEndAt: '2026-10-04T22:00:00.000Z',
    proposals,
    beds: [{ bedId: 'B2-1', bedName: 'B2-1', plotName: 'bloc 2', priority: 'normal', needMm: 20, targetMm: 20, placedMm: 15, surplusMm: 0, deficitMm: 5, reasons: ['pump-time'], proposalIds: proposals.map((p) => p.id), equipmentId: 'rampe-bloc-2' }],
    deficit: { waterCubicMeters: 0, pumpTimeCubicMeters: 0.14, byReason: { 'pump-time': 0.14 }, bedCount: 1 },
    budgets: [{ originKey: 'reservoir:reserve', originName: 'Réserve tampon', availableCubicMeters: 97, dailyLimitRemainingCubicMeters: null, demandCubicMeters: 5.6, fractions: { high: 1, normal: 1, low: 1 } }],
    settings: DEFAULT_PLANNING_SETTINGS,
    assumptions: { forecastDays: 7, reservoirsObservedAt: [{ reservoirId: 'reserve', name: 'Réserve tampon', observedAt: '2026-09-29T10:00:00.000Z', currentCubicMeters: 30 }] },
    suggestions: [],
    overcommittedDays: [],
  };
}

test('journal des réglages : deux enregistrements dans la même milliseconde gardent leur ordre, le plus récent d’abord', async () => {
  // La base pose created_at à la milliseconde et l'identifiant est un UUID tiré
  // au sort : celui de la première ligne peut se classer « après » celui de la
  // seconde. Le run de main du 4 octobre 2026 l'a produit (point ouvert 27) ;
  // ici l'égalité est posée, le test ne dépend d'aucune horloge
  // (docs/revision-order-contract.md).
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  const insert = database.sqlite.prepare('INSERT INTO irrigation_planning_settings_log (id, workspace_id, payload, actor_user_id, created_at) VALUES (?, ?, ?, ?, ?)');
  const sameMillisecond = '2026-10-04T18:59:30.123Z';
  insert.run('ffffffff-0000-4000-8000-000000000001', workspaceId, JSON.stringify({ ...DEFAULT_PLANNING_SETTINGS, waitForForecastRainAboveMm: 8 }), ALICE, sameMillisecond);
  insert.run('00000000-0000-4000-8000-000000000002', workspaceId, JSON.stringify(DEFAULT_PLANNING_SETTINGS), ALICE, sameMillisecond);
  const history = await listPlanningSettingsHistoryForUser(ALICE);
  assert.deepEqual(history.map((entry) => entry.settings.waitForForecastRainAboveMm), [5, 8], 'l’ordre d’insertion départage, jamais l’identifiant');
});

test('réglages : les valeurs de départ sans rien créer, puis enregistrés, journalisés, refusés quand ils sont absurdes', async () => {
  assert.deepEqual(await readPlanningSettingsForUser(ALICE), DEFAULT_PLANNING_SETTINGS);
  const changed = { ...DEFAULT_PLANNING_SETTINGS, waitForForecastRainAboveMm: 8, doses: { ...DEFAULT_PLANNING_SETTINGS.doses, sprinkler: { ...DEFAULT_PLANNING_SETTINGS.doses.sprinkler, maximumMm: 12 } } };
  await savePlanningSettingsForUser(ALICE, ALICE, changed);
  assert.deepEqual(await readPlanningSettingsForUser(ALICE), changed);
  await savePlanningSettingsForUser(ALICE, ALICE, DEFAULT_PLANNING_SETTINGS);
  const history = await listPlanningSettingsHistoryForUser(ALICE);
  assert.equal(history.length, 2, 'chaque enregistrement laisse une ligne au journal');
  assert.equal(history[0].settings.waitForForecastRainAboveMm, 5, 'le plus récent d’abord');
  assert.equal(history[1].settings.waitForForecastRainAboveMm, 8);
  assert.equal(database.sqlite.prepare('SELECT count(*) AS n FROM irrigation_planning_settings').get()?.n, 1, 'une seule ligne courante par espace');

  await assert.rejects(savePlanningSettingsForUser(ALICE, ALICE, { ...DEFAULT_PLANNING_SETTINGS, forecastRainShare: 2 }), PlanningSettingsInvalidError);
  assert.deepEqual(await readPlanningSettingsForUser(ALICE), DEFAULT_PLANNING_SETTINGS, 'un refus ne change rien');
  assert.deepEqual(await readPlanningSettingsForUser(BOB), DEFAULT_PLANNING_SETTINGS, 'un autre propriétaire ne voit rien');

  // Un cache qui contiendrait un réglage devenu invalide rend les valeurs de départ, jamais une erreur.
  database.sqlite.prepare("UPDATE irrigation_planning_settings SET payload = '{\"forecastRainShare\": 3}'").run();
  assert.deepEqual(await readPlanningSettingsForUser(ALICE), DEFAULT_PLANNING_SETTINGS);
});

test('réglages : un enregistrement antérieur au retrait de R1 (D-029) se lit tel quel, son heure de recalcul ignorée', async () => {
  const before = { ...DEFAULT_PLANNING_SETTINGS, forecastRainShare: 0.5 };
  await savePlanningSettingsForUser(ALICE, ALICE, before);
  // Un enregistrement d'avant le 5 octobre 2026 porte encore l'heure R1 ; ici absurde, pour prouver qu'elle n'est plus lue.
  database.sqlite.prepare('UPDATE irrigation_planning_settings SET payload = ?')
    .run(JSON.stringify({ dailyRecalculation: { hour: 99, minute: -1 }, ...before }));
  const read = await readPlanningSettingsForUser(ALICE);
  assert.equal(read.forecastRainShare, 0.5, 'l’enregistrement est lu, pas remplacé par les valeurs de départ');
  assert.equal(read.waitForForecastRainAboveMm, DEFAULT_PLANNING_SETTINGS.waitForForecastRainAboveMm);
});

test('réglages : un enregistrement antérieur à R14 (3.7, règle 18) se lit avec trente minutes de tolérance, sans réécriture', async () => {
  const before: Partial<typeof DEFAULT_PLANNING_SETTINGS> = { ...DEFAULT_PLANNING_SETTINGS, commandingRateShare: 0.4 };
  delete before.lateToleranceMinutes;
  await savePlanningSettingsForUser(ALICE, ALICE, DEFAULT_PLANNING_SETTINGS);
  database.sqlite.prepare('UPDATE irrigation_planning_settings SET payload = ?').run(JSON.stringify(before));
  const read = await readPlanningSettingsForUser(ALICE);
  assert.equal(read.lateToleranceMinutes, 30);
  assert.equal(read.commandingRateShare, 0.4, 'le reste est lu tel quel');
  assert.equal(database.sqlite.prepare('SELECT payload FROM irrigation_planning_settings').get()!.payload, JSON.stringify(before), 'rien n’est réécrit');
  // Une tolérance absurde est refusée comme les autres réglages.
  await assert.rejects(savePlanningSettingsForUser(ALICE, ALICE, { ...DEFAULT_PLANNING_SETTINGS, lateToleranceMinutes: 30.5 }), PlanningSettingsInvalidError);
  await assert.rejects(savePlanningSettingsForUser(ALICE, ALICE, { ...DEFAULT_PLANNING_SETTINGS, lateToleranceMinutes: -1 }), PlanningSettingsInvalidError);
  await savePlanningSettingsForUser(ALICE, ALICE, { ...DEFAULT_PLANNING_SETTINGS, lateToleranceMinutes: 45 });
  assert.equal((await readPlanningSettingsForUser(ALICE)).lateToleranceMinutes, 45);
});

test('un calcul enregistre ses propositions ; le suivant remplace celles restées proposées et garde les décidées', async () => {
  const first = await savePlanCalculationForUser(ALICE, { season: 2026, weekStart: WEEK, trigger: 'manual', actorUserId: ALICE, plan: plan([proposal('p-1', '2026-09-29T19:00:00.000Z', 8100), proposal('p-2', '2026-09-30T19:00:00.000Z', 2700)], '2026-09-29T10:52:00.000Z') });
  let stored = await readLatestPlanForUser(ALICE, 2026, WEEK);
  assert.ok(stored);
  assert.equal(stored.calculation.id, first);
  assert.equal(stored.calculation.trigger, 'manual');
  assert.deepEqual(stored.calculation.settings, DEFAULT_PLANNING_SETTINGS);
  assert.equal(stored.calculation.summary.deficit.pumpTimeCubicMeters, 0.14);
  assert.deepEqual(stored.proposals.map((p) => [p.id, p.status, p.durationSeconds, p.doseMm]), [['p-1', 'proposed', 8100, 15], ['p-2', 'proposed', 2700, 15]]);
  assert.deepEqual(stored.proposals[0].justification.supply, { originKey: 'reservoir:reserve', originName: 'Réserve tampon', projectedLevelAfterCubicMeters: 29.5 });
  assert.equal(stored.proposals[0].applications[0].wettedAreaSquareMeters, 28.04);

  // Décider : la première est validée en irrigation planifiée, la seconde reste proposée.
  assert.equal(await decidePlanProposalForUser(ALICE, { proposalId: stored.proposals[0].storedId, status: 'validated', validatedEventId: 'event-42', actorUserId: ALICE }), true);
  assert.equal(await decidePlanProposalForUser(ALICE, { proposalId: stored.proposals[0].storedId, status: 'refused', validatedEventId: null, actorUserId: ALICE }), false, 'une proposition décidée ne se redécide pas');
  assert.equal(await decidePlanProposalForUser(BOB, { proposalId: stored.proposals[1].storedId, status: 'refused', validatedEventId: null, actorUserId: BOB }), false, 'pas d’un autre propriétaire');

  // Le second calcul propose autre chose pour mercredi : une heure plus tard. Reproduite à l'identique, la proposition aurait gardé son identité (3.7, règle 10, test suivant).
  const second = await savePlanCalculationForUser(ALICE, { season: 2026, weekStart: WEEK, trigger: 'daily', actorUserId: null, plan: plan([proposal('p-1', '2026-09-30T20:00:00.000Z', 2700)], '2026-09-30T04:30:00.000Z') });
  stored = await readLatestPlanForUser(ALICE, 2026, WEEK);
  assert.ok(stored);
  assert.equal(stored.calculation.id, second);
  assert.equal(stored.calculation.triggerEvent, null);
  assert.equal(stored.pendingEvent, null);
  assert.deepEqual(
    stored.proposals.map((p) => [p.calculationId === first ? 'premier' : 'second', p.id, p.status, p.validatedEventId, p.calculatedAt]),
    [['premier', 'p-1', 'validated', 'event-42', '2026-09-29T10:52:00.000Z'], ['second', 'p-1', 'proposed', null, '2026-09-30T04:30:00.000Z']],
    'la validée du premier calcul reste lisible, datée de son calcul ; sa proposée a été remplacée et ne se lit plus ici',
  );
  const replaced = database.sqlite.prepare("SELECT status, replaced_by_calculation_id FROM irrigation_plan_proposals WHERE calculation_id = ? AND local_id = 'p-2'").get(first) as { status: string; replaced_by_calculation_id: string };
  assert.equal(replaced.status, 'replaced');
  assert.equal(replaced.replaced_by_calculation_id, second);

  // Isolation par semaine et par propriétaire.
  assert.equal(await readLatestPlanForUser(ALICE, 2026, '2026-10-05'), null);
  await ensureWorkspaceForUser(BOB);
  assert.equal(await readLatestPlanForUser(BOB, 2026, WEEK), null);
});

test('une proposition reproduite à l’identique garde son identité et passe au nouveau calcul ; seules celles qui changent sont remplacées (3.7, règle 10)', async () => {
  const first = await savePlanCalculationForUser(ALICE, { season: 2026, weekStart: WEEK, trigger: 'manual', actorUserId: ALICE, plan: plan([proposal('p-1', '2026-09-29T19:00:00.000Z', 8100), proposal('p-2', '2026-09-30T19:00:00.000Z', 2700)], '2026-09-29T10:52:00.000Z') });
  const before = await readLatestPlanForUser(ALICE, 2026, WEEK);
  assert.ok(before);
  const wednesday = before.proposals.find((p) => p.id === 'p-2')!;

  // Le calcul suivant — sur événement, une pluie saisie — déplace mardi d'une heure, refait mercredi tel quel et ajoute jeudi.
  const reproduced = { ...proposal('p-1', '2026-09-30T19:00:00.000Z', 2700), justification: { ...proposal('p-1', '2026-09-30T19:00:00.000Z', 2700).justification, timingReason: 'window' as const } };
  const second = await savePlanCalculationForUser(ALICE, {
    season: 2026, weekStart: WEEK, trigger: 'event', triggerEvent: 'rain-recorded', actorUserId: null,
    plan: plan([proposal('p-0', '2026-09-29T20:00:00.000Z', 8100), reproduced, proposal('p-2', '2026-10-01T19:00:00.000Z', 2700)], '2026-09-29T11:00:00.000Z'),
  });
  const after = await readLatestPlanForUser(ALICE, 2026, WEEK);
  assert.ok(after);
  assert.equal(after.calculation.trigger, 'event');
  assert.equal(after.calculation.triggerEvent, 'rain-recorded', 'le déclencheur est nommé (règle 7)');
  assert.deepEqual(after.proposals.map((p) => [p.id, p.status, p.calculationId === second, p.calculatedAt]), [
    ['p-0', 'proposed', true, '2026-09-29T11:00:00.000Z'],
    ['p-1', 'proposed', true, '2026-09-29T11:00:00.000Z'],
    ['p-2', 'proposed', true, '2026-09-29T11:00:00.000Z'],
  ], 'trois proposées du dernier calcul, datées de lui');
  const kept = after.proposals.find((p) => p.id === 'p-1')!;
  assert.equal(kept.storedId, wednesday.storedId, 'la même proposition : une carte restée ouverte se valide encore par cet identifiant');
  assert.equal(kept.justification.timingReason, 'window', 'sa justification est celle du dernier calcul');
  assert.equal(kept.replacedByCalculationId, null);
  // Les lignes de node:sqlite sont sans prototype : copiées pour la comparaison.
  const rows = (database.sqlite.prepare('SELECT local_id, status, replaced_by_calculation_id FROM irrigation_plan_proposals WHERE calculation_id = ? ORDER BY local_id').all(first) as { local_id: string; status: string; replaced_by_calculation_id: string | null }[]).map((row) => ({ ...row }));
  assert.deepEqual(rows, [{ local_id: 'p-1', status: 'replaced', replaced_by_calculation_id: second }], 'seul mardi, déplacé, est remplacé ; mercredi a quitté le premier calcul');
  assert.equal(await decidePlanProposalForUser(ALICE, { proposalId: wednesday.storedId, status: 'validated', validatedEventId: 'event-7', actorUserId: ALICE }), true, 'validée par l’identifiant lu avant le recalcul');
});

test('deux calculs croisés : celui qui arrive après un calcul plus récent ne laisse rien, et la relecture rend le plus récent (3.7, règle 8)', async () => {
  const newer = await savePlanCalculationForUser(ALICE, { season: 2026, weekStart: WEEK, trigger: 'event', triggerEvent: 'proposal-refused', actorUserId: null, plan: plan([proposal('p-1', '2026-09-29T19:00:00.000Z', 8100)], '2026-09-29T10:52:00.000Z') });
  // Un calcul du matin commencé plus tôt — calculé à 10 h 00 — et enregistré après : il ne remplace rien et n'ajoute rien.
  const older = await savePlanCalculationForUser(ALICE, { season: 2026, weekStart: WEEK, trigger: 'daily', actorUserId: null, plan: plan([proposal('p-1', '2026-09-30T19:00:00.000Z', 2700)], '2026-09-29T10:00:00.000Z') });
  const stored = await readLatestPlanForUser(ALICE, 2026, WEEK);
  assert.ok(stored);
  assert.equal(stored.calculation.id, newer);
  assert.deepEqual(stored.proposals.map((p) => [p.id, p.status, p.startAt]), [['p-1', 'proposed', '2026-09-29T19:00:00.000Z']], 'les propositions du plus récent restent proposées');
  assert.equal((database.sqlite.prepare('SELECT COUNT(*) AS n FROM irrigation_plan_calculations WHERE id = ?').get(older) as { n: number }).n, 0, 'aucune ligne pour le calcul dépassé');
});

test('un événement postérieur au calcul se lit avec le plan tant que son recalcul n’a pas abouti, en cours ou échoué (3.7, règle 6)', async () => {
  const calculationId = await savePlanCalculationForUser(ALICE, { season: 2026, weekStart: WEEK, trigger: 'manual', actorUserId: ALICE, plan: plan([proposal('p-1', '2026-09-29T19:00:00.000Z', 8100)], '2026-09-29T10:52:00.000Z') });
  const earlier = await recordPlanEventForUser(ALICE, { season: 2026, weekStart: WEEK, kind: 'rain-recorded', occurredAt: '2026-09-29T10:00:00.000Z' });
  assert.equal((await readLatestPlanForUser(ALICE, 2026, WEEK))?.pendingEvent, null, 'un événement antérieur au calcul est couvert par lui');
  const rain = await recordPlanEventForUser(ALICE, { season: 2026, weekStart: WEEK, kind: 'rain-recorded', occurredAt: '2026-09-29T11:10:00.000Z' });
  assert.deepEqual((await readLatestPlanForUser(ALICE, 2026, WEEK))?.pendingEvent, { kind: 'rain-recorded', occurredAt: '2026-09-29T11:10:00.000Z', status: 'pending' });
  await settlePlanEvent(rain, { calculationId }, '2026-09-29T11:10:05.000Z');
  assert.equal((await readLatestPlanForUser(ALICE, 2026, WEEK))?.pendingEvent, null, 'recalculé : plus rien à signaler');
  const refusal = await recordPlanEventForUser(ALICE, { season: 2026, weekStart: WEEK, kind: 'proposal-refused', occurredAt: '2026-09-29T11:20:00.000Z' });
  await settlePlanEvent(refusal, { failed: true }, '2026-09-29T11:20:03.000Z');
  assert.deepEqual((await readLatestPlanForUser(ALICE, 2026, WEEK))?.pendingEvent, { kind: 'proposal-refused', occurredAt: '2026-09-29T11:20:00.000Z', status: 'failed' }, 'échoué : l’écran dira « recalculez »');
  await settlePlanEvent(refusal, { calculationId }, '2026-09-29T11:21:00.000Z');
  assert.equal((await readLatestPlanForUser(ALICE, 2026, WEEK))?.pendingEvent?.status, 'failed', 'un événement réglé ne se règle pas deux fois');
  // Isolation par semaine, et la base garde la liste fermée des événements et la cohérence du règlement.
  assert.equal((await readLatestPlanForUser(ALICE, 2026, '2026-10-05')), null);
  assert.equal(typeof earlier, 'string');
  await assert.rejects(recordPlanEventForUser(ALICE, { season: 2026, weekStart: WEEK, kind: 'weather-refreshed' as 'rain-recorded', occurredAt: '2026-09-29T11:30:00.000Z' }), /CHECK constraint failed/);
  assert.throws(() => database.sqlite.prepare("UPDATE irrigation_plan_events SET status = 'recalculated' WHERE id = ?").run(earlier), /CHECK constraint failed/, 'recalculé sans calcul ni heure : refusé');
});

test('une proposition jamais décidée dont le créneau est passé se lit « expirée » ; la base refuse un créneau vide ou un statut inconnu', async () => {
  await savePlanCalculationForUser(ALICE, { season: 2026, weekStart: WEEK, trigger: 'event', actorUserId: ALICE, plan: plan([proposal('p-1', '2026-09-29T19:00:00.000Z', 8100)], '2026-09-29T10:52:00.000Z') });
  const stored = await readLatestPlanForUser(ALICE, 2026, WEEK);
  assert.ok(stored);
  assert.equal(effectiveProposalStatus(stored.proposals[0], new Date('2026-09-29T20:00:00.000Z')), 'proposed');
  assert.equal(effectiveProposalStatus(stored.proposals[0], new Date('2026-09-30T06:00:00.000Z')), 'expired');
  assert.equal(stored.proposals[0].status, 'proposed', 'le registre garde ce que le calcul a proposé');

  const broken = proposal('p-x', '2026-09-29T19:00:00.000Z', 0);
  await assert.rejects(
    savePlanCalculationForUser(ALICE, { season: 2026, weekStart: WEEK, trigger: 'manual', actorUserId: ALICE, plan: plan([broken], '2026-09-29T12:00:00.000Z') }),
    /CHECK constraint failed/,
  );
  assert.equal((await readLatestPlanForUser(ALICE, 2026, WEEK))?.proposals.length, 1, 'un lot refusé ne remplace rien');
  assert.throws(
    () => database.sqlite.prepare("UPDATE irrigation_plan_proposals SET status = 'perdue'").run(),
    /CHECK constraint failed/,
  );
});

test('« Ce qui a changé » s’enregistre avec le calcul et se relit ; un calcul qui n’en a pas se relit sans (3.7, règle 25)', async () => {
  const first = await savePlanCalculationForUser(ALICE, { season: 2026, weekStart: WEEK, trigger: 'daily', actorUserId: null, plan: plan([proposal('p-1', '2026-09-29T19:00:00.000Z', 8100)], '2026-09-29T04:15:00.000Z') });
  let stored = await readLatestPlanForUser(ALICE, 2026, WEEK);
  assert.equal(stored?.calculation.summary.changes, null, 'au premier calcul, rien à comparer');

  const changes = {
    previousCalculationId: first,
    previousComputedAt: '2026-09-29T04:15:00.000Z',
    proposals: [{ change: 'moved' as const, equipmentId: 'rampe-bloc-2', equipmentName: 'rampe bloc 2', settingName: 'Standard', proposalId: 'p-1',
      before: { startAt: '2026-09-29T19:00:00.000Z', endAt: '2026-09-29T21:15:00.000Z', doseMm: 15, bedNames: ['B2-1'] },
      after: { startAt: '2026-09-29T20:00:00.000Z', endAt: '2026-09-29T22:15:00.000Z', doseMm: 15, bedNames: ['B2-1'] } }],
    newSuggestions: [{ eventId: 'event-7', eventEquipmentId: 'ee-7', equipmentName: 'gag1', plannedStartAt: '2026-09-30T18:00:00.000Z', suggestion: 'reduce' as const, doseMm: 4 }],
    bedsNowUnplaced: [{ bedId: 'B2-1', bedName: 'B2-1', plotName: 'bloc 2', priority: 'normal' as const, deficitMm: 5, reasons: ['pump-time' as const] }],
    bedsNowPlaced: [],
    waterDeficitBeforeCubicMeters: 0,
    waterDeficitAfterCubicMeters: 0.5,
  };
  const second = await savePlanCalculationForUser(ALICE, { season: 2026, weekStart: WEEK, trigger: 'event', triggerEvent: 'rain-recorded', actorUserId: ALICE, plan: plan([proposal('p-1', '2026-09-29T20:00:00.000Z', 8100)], '2026-09-29T08:00:00.000Z'), changes });
  stored = await readLatestPlanForUser(ALICE, 2026, WEEK);
  assert.equal(stored?.calculation.id, second);
  assert.deepEqual(stored?.calculation.summary.changes, changes, 'relue telle quelle, dans l’ordre enregistré');

  // Un calcul antérieur à cette PR n'a pas la clé : il se relit sans comparaison, sans réécriture.
  const legacy = { ...stored!.calculation.summary };
  delete (legacy as Partial<typeof legacy>).changes;
  database.sqlite.prepare('UPDATE irrigation_plan_calculations SET summary = ? WHERE id = ?').run(JSON.stringify(legacy), second);
  const reread = await readLatestPlanForUser(ALICE, 2026, WEEK);
  assert.equal(reread?.calculation.summary.changes, null);
  assert.deepEqual(reread?.calculation.summary.beds, stored!.calculation.summary.beds);
});

test('l’arbitrage du plan s’enregistre avec le calcul et se relit ; un calcul sans arbitrage n’en a pas la clé (décision 1 de la 3.9, D-052)', async () => {
  await savePlanCalculationForUser(ALICE, { season: 2026, weekStart: WEEK, trigger: 'manual', actorUserId: ALICE, plan: plan([proposal('p-1', '2026-09-29T19:00:00.000Z', 8100)], '2026-09-29T04:15:00.000Z') });
  let stored = await readLatestPlanForUser(ALICE, 2026, WEEK);
  assert.equal(stored && 'arbitration' in stored.calculation.summary, false, 'sans arbitrage, le résumé reste celui d’avant');

  const arbitration = { allocatedCubicMeters: 5.12, reservedCubicMeters: 5.12, unreceivedCubicMeters: 2.56, unreceivedBedCount: 16 };
  const arbitrated = { ...plan([proposal('p-1', '2026-09-29T20:00:00.000Z', 8100)], '2026-09-29T08:00:00.000Z'), budgets: [], arbitration };
  await savePlanCalculationForUser(ALICE, { season: 2026, weekStart: WEEK, trigger: 'event', triggerEvent: 'arbitration-validated', actorUserId: ALICE, plan: arbitrated });
  stored = await readLatestPlanForUser(ALICE, 2026, WEEK);
  assert.deepEqual(stored?.calculation.summary.arbitration, arbitration, 'relu tel quel');
  assert.deepEqual(stored?.calculation.summary.budgets, [], 'aucune ligne de budget sous un arbitrage');
});
