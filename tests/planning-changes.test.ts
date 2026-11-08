import assert from 'node:assert/strict';
import test from 'node:test';
import { describePlanChanges, isBedUnplaced } from '../lib/domain/planning/changes.ts';
import type { PlanBedOutcome, PlanProposal, PlanSuggestion, StoredProposal, StoredWeeklyPlan, WeeklyPlan } from '../lib/domain/planning/contract.ts';
import { DEFAULT_PLANNING_SETTINGS } from '../lib/domain/planning/settings.ts';

/**
 * « Ce qui a changé » (docs/replanning-contract.md, règle 25) : la
 * comparaison d'un calcul avec le précédent de la même semaine. Une lecture
 * pure : les propositions apparues, retirées, déplacées ou de dose changée,
 * les suggestions nouvelles, les planches entrées dans « Non placé » ou
 * sorties, l'écart du manque d'eau.
 */

const FIRST_CALCULATION_AT = '2026-09-29T04:15:00.000Z'; // mardi 6 h 15 à la ferme
const SECOND_CALCULATION_AT = '2026-09-29T08:00:00.000Z'; // mardi 10 h
const TUESDAY_20H = '2026-09-29T18:00:00.000Z';
const TUESDAY_21H = '2026-09-29T19:00:00.000Z';
const TUESDAY_22H = '2026-09-29T20:00:00.000Z';
const TUESDAY_23H = '2026-09-29T21:00:00.000Z';
const THURSDAY_20H = '2026-10-01T18:00:00.000Z';
const THURSDAY_21H = '2026-10-01T19:00:00.000Z';

function proposal(id: string, startAt: string, endAt: string, overrides: Partial<PlanProposal> & { bedNames?: string[] } = {}): PlanProposal {
  const { bedNames = ['B1'], ...rest } = overrides;
  const equipmentId = rest.equipmentId ?? 'gag1';
  return {
    id,
    equipmentId,
    equipmentName: equipmentId,
    kind: 'drip',
    settingId: `${equipmentId}-setting`,
    settingName: 'standard',
    placementId: `${equipmentId}-placement`,
    startAt,
    endAt,
    durationSeconds: (Date.parse(endAt) - Date.parse(startAt)) / 1000,
    doseMm: 10,
    applications: [],
    bedApplications: bedNames.map((bedName) => ({ bedId: bedName, bedName, needBeforeMm: 10, appliedMm: 10, needAfterMm: 0, surplusMm: 0, wettedAreaSquareMeters: 20 })),
    volumeCubicMeters: 0.2,
    flowCubicMetersPerHour: 0.2,
    pumpId: null,
    pumpOriginId: null,
    justification: { priority: 'normal', doseReason: 'remaining-need', timingReason: 'earliest', limitingConstraint: null, pump: null, supply: null, hydraulicallyVerified: true },
    ...rest,
  };
}

function stored(base: PlanProposal, overrides: Partial<StoredProposal> = {}): StoredProposal {
  return {
    ...base,
    storedId: `stored-${base.id}`,
    calculationId: 'calc-1',
    calculatedAt: FIRST_CALCULATION_AT,
    status: 'proposed',
    validatedEventId: null, irrigationStatus: null,
    replacedByCalculationId: null,
    decidedAt: null,
    actorUserId: null,
    ...overrides,
  };
}

function bed(bedId: string, overrides: Partial<PlanBedOutcome> = {}): PlanBedOutcome {
  return { bedId, bedName: bedId, plotName: 'bloc 1', priority: 'normal', needMm: 20, targetMm: 20, placedMm: 20, surplusMm: 0, deficitMm: 0, reasons: [], proposalIds: [], equipmentId: 'gag1', ...overrides };
}

function suggestion(eventEquipmentId: string, kind: 'cancel' | 'reduce', doseMm: number | null = null): PlanSuggestion {
  return {
    eventId: `event-${eventEquipmentId}`, eventEquipmentId, equipmentId: 'asp1', equipmentName: 'asp1', kind: 'sprinkler', priority: 'normal',
    plannedStartAt: THURSDAY_20H, plannedEndAt: THURSDAY_21H, plannedDurationSeconds: 3600, plannedDoseMm: 10,
    suggestion: kind, doseMm, durationSeconds: doseMm === null ? null : 1800, endAt: doseMm === null ? null : '2026-10-01T18:30:00.000Z', causes: [],
  };
}

type Content = { proposals?: PlanProposal[]; beds?: PlanBedOutcome[]; suggestions?: PlanSuggestion[]; waterCubicMeters?: number };

function nextPlan({ proposals = [], beds = [], suggestions = [], waterCubicMeters = 0 }: Content, computedAt = SECOND_CALCULATION_AT): WeeklyPlan {
  return {
    weekStart: '2026-09-28', weekEnd: '2026-10-04', computedAt, horizonStartAt: computedAt, horizonEndAt: '2026-10-04T22:00:00.000Z',
    proposals, beds, deficit: { waterCubicMeters, pumpTimeCubicMeters: 0, byReason: {}, bedCount: 0 }, budgets: [], suggestions, overcommittedDays: [],
    settings: DEFAULT_PLANNING_SETTINGS, assumptions: { forecastDays: 6, reservoirsObservedAt: [] },
  };
}

function previousPlan(content: Content, storedProposals?: StoredProposal[]): StoredWeeklyPlan {
  const plan = nextPlan(content, FIRST_CALCULATION_AT);
  return {
    calculation: {
      id: 'calc-1', season: 2026, weekStart: plan.weekStart, trigger: 'daily', triggerEvent: null, computedAt: plan.computedAt,
      horizonStartAt: plan.horizonStartAt, horizonEndAt: plan.horizonEndAt, settings: plan.settings,
      summary: { weekEnd: plan.weekEnd, beds: plan.beds, deficit: plan.deficit, budgets: [], assumptions: plan.assumptions, suggestions: plan.suggestions, overcommittedDays: [], changes: null },
    },
    proposals: storedProposals ?? plan.proposals.map((item) => stored(item)),
    suggestions: [],
    pendingEvent: null,
  };
}

test('au premier calcul de la semaine, il n’y a rien à comparer', () => {
  assert.equal(describePlanChanges(null, nextPlan({ proposals: [proposal('p-1', TUESDAY_20H, TUESDAY_21H)] })), null);
});

test('un calcul qui reproduit le précédent ne liste rien, et nomme le calcul comparé', () => {
  const before = previousPlan({ proposals: [proposal('p-1', TUESDAY_20H, TUESDAY_21H)], beds: [bed('B1')], waterCubicMeters: 1.5 });
  const changes = describePlanChanges(before, nextPlan({ proposals: [proposal('p-1', TUESDAY_20H, TUESDAY_21H)], beds: [bed('B1')], waterCubicMeters: 1.5 }));
  assert.deepEqual(changes, {
    previousCalculationId: 'calc-1',
    previousComputedAt: FIRST_CALCULATION_AT,
    proposals: [],
    newSuggestions: [],
    bedsNowUnplaced: [],
    bedsNowPlaced: [],
    waterDeficitBeforeCubicMeters: 1.5,
    waterDeficitAfterCubicMeters: 1.5,
  });
});

test('une proposition apparue et une retirée se lisent avec leur créneau et leurs planches', () => {
  const gag = proposal('p-1', TUESDAY_20H, TUESDAY_21H);
  const before = previousPlan({ proposals: [gag, proposal('p-2', TUESDAY_22H, TUESDAY_23H, { equipmentId: 'asp1', bedNames: ['B2', 'B3'] })] });
  const after = nextPlan({ proposals: [gag, proposal('p-2', THURSDAY_20H, THURSDAY_21H, { equipmentId: 'asp2', doseMm: 8, bedNames: ['B4'] })] });
  assert.deepEqual(describePlanChanges(before, after)?.proposals, [
    { change: 'removed', equipmentId: 'asp1', equipmentName: 'asp1', settingName: 'standard', before: { startAt: TUESDAY_22H, endAt: TUESDAY_23H, doseMm: 10, bedNames: ['B2', 'B3'] }, after: null, proposalId: null },
    { change: 'appeared', equipmentId: 'asp2', equipmentName: 'asp2', settingName: 'standard', before: null, after: { startAt: THURSDAY_20H, endAt: THURSDAY_21H, doseMm: 8, bedNames: ['B4'] }, proposalId: 'p-2' },
  ]);
});

test('le même matériel à d’autres heures est déplacé ; à une autre dose, de dose changée ; les deux à la fois se disent', () => {
  const before = previousPlan({ proposals: [
    proposal('p-1', TUESDAY_20H, TUESDAY_21H),
    proposal('p-2', TUESDAY_22H, TUESDAY_23H, { equipmentId: 'asp1' }),
    proposal('p-3', THURSDAY_20H, THURSDAY_21H, { equipmentId: 'asp2' }),
  ] });
  const after = nextPlan({ proposals: [
    proposal('p-1', TUESDAY_22H, TUESDAY_23H),
    proposal('p-2', TUESDAY_22H, TUESDAY_23H, { equipmentId: 'asp1', doseMm: 7.5 }),
    proposal('p-3', THURSDAY_20H, '2026-10-01T18:30:00.000Z', { equipmentId: 'asp2', doseMm: 5 }),
  ] });
  assert.deepEqual(describePlanChanges(before, after)?.proposals.map((item) => [item.change, item.equipmentName, item.before?.startAt, item.after?.startAt, item.before?.doseMm, item.after?.doseMm, item.proposalId]), [
    ['dose-changed', 'asp1', TUESDAY_22H, TUESDAY_22H, 10, 7.5, 'p-2'],
    ['moved', 'gag1', TUESDAY_20H, TUESDAY_22H, 10, 10, 'p-1'],
    ['moved-and-dose-changed', 'asp2', THURSDAY_20H, THURSDAY_20H, 10, 5, 'p-3'],
  ]);
});

test('des heures qui ne bougent pas à la minute n’ont pas changé : une fin décalée de vingt secondes par l’arrondi de la durée', () => {
  const before = previousPlan({ proposals: [proposal('p-1', TUESDAY_20H, '2026-09-29T19:00:10.000Z', { doseMm: 10 })] });
  assert.deepEqual(describePlanChanges(before, nextPlan({ proposals: [proposal('p-1', TUESDAY_20H, '2026-09-29T19:00:30.000Z', { doseMm: 10.04 })] }))?.proposals, []);
  assert.equal(describePlanChanges(before, nextPlan({ proposals: [proposal('p-1', TUESDAY_20H, '2026-09-29T19:01:00.000Z', { doseMm: 10 })] }))?.proposals[0]?.change, 'moved');
});

test('une dose qui ne bouge pas au dixième de millimètre n’a pas changé', () => {
  const before = previousPlan({ proposals: [proposal('p-1', TUESDAY_20H, TUESDAY_21H, { doseMm: 10 })] });
  assert.deepEqual(describePlanChanges(before, nextPlan({ proposals: [proposal('p-1', TUESDAY_20H, TUESDAY_21H, { doseMm: 10.04 })] }))?.proposals, []);
  assert.equal(describePlanChanges(before, nextPlan({ proposals: [proposal('p-1', TUESDAY_20H, TUESDAY_21H, { doseMm: 10.2 })] }))?.proposals[0]?.change, 'dose-changed');
});

test('les propositions d’un même matériel s’apparient à la plus proche en heure : une de moins est une retirée, pas deux déplacées', () => {
  const before = previousPlan({ proposals: [proposal('p-1', TUESDAY_20H, TUESDAY_21H), proposal('p-2', THURSDAY_20H, THURSDAY_21H)] });
  const after = nextPlan({ proposals: [proposal('p-1', THURSDAY_20H, THURSDAY_21H)] });
  assert.deepEqual(describePlanChanges(before, after)?.proposals.map((item) => [item.change, item.before?.startAt]), [['removed', TUESDAY_20H]]);
  // Et l'inverse : une de plus est une apparue.
  assert.deepEqual(describePlanChanges(previousPlan({ proposals: [proposal('p-1', THURSDAY_20H, THURSDAY_21H)] }), nextPlan({ proposals: before.proposals.map((item) => proposal(item.id, item.startAt, item.endAt)) }))?.proposals
    .map((item) => [item.change, item.after?.startAt]), [['appeared', TUESDAY_20H]]);
});

test('une proposition validée, refusée, expirée ou d’un calcul plus ancien ne se compare pas : le maraîcher en a décidé', () => {
  const current = proposal('p-9', THURSDAY_20H, THURSDAY_21H, { equipmentId: 'asp9' });
  const before = previousPlan({}, [
    stored(proposal('p-1', TUESDAY_20H, TUESDAY_21H), { status: 'validated', validatedEventId: 'event-1' }),
    stored(proposal('p-2', TUESDAY_22H, TUESDAY_23H, { equipmentId: 'asp1' }), { status: 'refused' }),
    stored(proposal('p-3', '2026-09-29T05:00:00.000Z', '2026-09-29T06:00:00.000Z', { equipmentId: 'asp2' })), // finie avant le nouveau calcul : expirée
    stored(proposal('p-4', THURSDAY_20H, THURSDAY_21H, { equipmentId: 'asp3' }), { calculationId: 'calc-0', status: 'replaced' }),
    stored(current),
  ]);
  assert.deepEqual(describePlanChanges(before, nextPlan({ proposals: [current] }))?.proposals, []);
});

test('les suggestions nouvelles : celles que le calcul précédent ne faisait pas, ou pas à cette dose', () => {
  const before = previousPlan({ suggestions: [suggestion('ee-1', 'cancel'), suggestion('ee-2', 'reduce', 4)] });
  const after = nextPlan({ suggestions: [suggestion('ee-1', 'cancel'), suggestion('ee-2', 'reduce', 4.04), suggestion('ee-3', 'reduce', 6), suggestion('ee-4', 'cancel')] });
  assert.deepEqual(describePlanChanges(before, after)?.newSuggestions, [
    { eventId: 'event-ee-3', eventEquipmentId: 'ee-3', equipmentName: 'asp1', plannedStartAt: THURSDAY_20H, suggestion: 'reduce', doseMm: 6 },
    { eventId: 'event-ee-4', eventEquipmentId: 'ee-4', equipmentName: 'asp1', plannedStartAt: THURSDAY_20H, suggestion: 'cancel', doseMm: null },
  ]);
  // « Réduire » qui passe à une autre dose, ou devient « Annuler », est nouvelle.
  assert.deepEqual(describePlanChanges(before, nextPlan({ suggestions: [suggestion('ee-2', 'reduce', 3), suggestion('ee-1', 'reduce', 5)] }))?.newSuggestions.map((item) => [item.eventEquipmentId, item.suggestion, item.doseMm]),
    [['ee-2', 'reduce', 3], ['ee-1', 'reduce', 5]]);
});

test('les planches entrées dans « Non placé » et celles qui en sont sorties, servies ou sans besoin désormais, par nom', () => {
  const before = previousPlan({ beds: [
    bed('B1'),
    bed('B3', { placedMm: 15, deficitMm: 5, reasons: ['water-budget'] }),
    bed('B2', { placedMm: 0, deficitMm: 0, reasons: ['no-equipment'], priority: 'high' }),
  ] });
  const after = nextPlan({ beds: [
    bed('B1', { placedMm: 17, deficitMm: 3, reasons: ['daily-limit'] }),
    bed('B3'),
    bed('B4', { placedMm: 0, deficitMm: 20, reasons: ['refused-slot'], plotName: 'tunnel 4' }),
  ] });
  const changes = describePlanChanges(before, after);
  assert.deepEqual(changes?.bedsNowUnplaced, [
    { bedId: 'B1', bedName: 'B1', plotName: 'bloc 1', priority: 'normal', deficitMm: 3, reasons: ['daily-limit'] },
    { bedId: 'B4', bedName: 'B4', plotName: 'tunnel 4', priority: 'normal', deficitMm: 20, reasons: ['refused-slot'] },
  ]);
  assert.deepEqual(changes?.bedsNowPlaced, [
    { bedId: 'B2', bedName: 'B2', plotName: 'bloc 1', priority: 'high', deficitMm: 0, reasons: [] },
    { bedId: 'B3', bedName: 'B3', plotName: 'bloc 1', priority: 'normal', deficitMm: 0, reasons: [] },
  ]);
});

test('« Non placé » se lit d’une seule règle : un manque, ou rien de placé avec un motif', () => {
  assert.equal(isBedUnplaced({ deficitMm: 0.02, reasons: [], placedMm: 10 }), true);
  assert.equal(isBedUnplaced({ deficitMm: 0, reasons: ['no-equipment'], placedMm: 0 }), true);
  assert.equal(isBedUnplaced({ deficitMm: 0.005, reasons: ['deferred'], placedMm: 10 }), false);
  assert.equal(isBedUnplaced({ deficitMm: 0, reasons: [], placedMm: 0 }), false);
});

test('l’écart du manque d’eau se lit d’un calcul à l’autre, dans les deux sens', () => {
  assert.deepEqual(
    [describePlanChanges(previousPlan({ waterCubicMeters: 2.5 }), nextPlan({ waterCubicMeters: 1.25 }))].map((item) => [item?.waterDeficitBeforeCubicMeters, item?.waterDeficitAfterCubicMeters]),
    [[2.5, 1.25]],
  );
  assert.deepEqual(
    [describePlanChanges(previousPlan({ waterCubicMeters: 0 }), nextPlan({ waterCubicMeters: 3 }))].map((item) => [item?.waterDeficitBeforeCubicMeters, item?.waterDeficitAfterCubicMeters]),
    [[0, 3]],
  );
});

test('la liste est dans l’ordre du temps puis du matériel, et la même deux fois de suite', () => {
  const before = previousPlan({ proposals: [proposal('p-1', THURSDAY_20H, THURSDAY_21H, { equipmentId: 'zz' }), proposal('p-2', TUESDAY_20H, TUESDAY_21H, { equipmentId: 'aa' })] });
  const after = nextPlan({ proposals: [proposal('p-1', THURSDAY_20H, THURSDAY_21H, { equipmentId: 'bb' }), proposal('p-2', THURSDAY_20H, THURSDAY_21H, { equipmentId: 'aa' })] });
  const first = describePlanChanges(before, after);
  assert.deepEqual(first?.proposals.map((item) => [item.change, item.equipmentName]), [['moved', 'aa'], ['appeared', 'bb'], ['removed', 'zz']]);
  assert.deepEqual(describePlanChanges(before, after), first);
});
