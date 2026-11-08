import assert from 'node:assert/strict';
import test from 'node:test';
import type { IrrigationEventRecord } from '../lib/domain/irrigation-event-record.ts';
import { millimetersForDurationSeconds } from '../lib/domain/irrigation-timer.ts';
import { planningNeedMm, realRemainingMm, type BedIrrigationNeed } from '../lib/domain/irrigation-needs.ts';
import type { PlanningInputs, PlanSuggestion } from '../lib/domain/planning/contract.ts';
import { buildWeeklyPlan } from '../lib/domain/planning/engine.ts';
import { protectedSlotRealSignal, suggestionCauseLabel } from '../lib/domain/planning/follow-up.ts';
import { protectedNamesBetween, protectedSlotsInForceAt, type ProtectedSlot, type ProtectedSlotVersion, type Weekday } from '../lib/domain/planning/protected-slots.ts';
import { minutesOfDay } from '../lib/domain/planning/settings.ts';
import { markKeptSuggestions } from '../lib/domain/planning/suggestions.ts';
import { assertInvariants, BLOC_2, close, farm, PARIS_21H_TUESDAY, realIrrigation, settings, validatedIrrigation } from './support/planning-fixtures.ts';

/**
 * Un arrosage déjà validé qui tombe dans un créneau protégé, et une
 * irrigation réelle faite pendant l'un d'eux (docs/protected-slots-contract.md,
 * règles 9 à 11, cas 9 à 13 ; précisions D-071). Le moteur ne touche jamais à
 * l'arrosage validé : il compte comme avant jusqu'au geste du maraîcher, et le
 * plan suggère « Réduire à X mm » à la partie qui tient avant le créneau, ou
 * « Annuler ». Une irrigation en cours ou faite ne reçoit aucune suggestion ;
 * la faite se signale. La semaine de test est en heure d'été (UTC+2).
 */

/** 2 h d'aspersion à 6,667 mm/h : 13,334 mm prévus. */
const TWO_HOURS = 7200;
const PLANNED_MM = millimetersForDurationSeconds(6.667, TWO_HOURS);
const TUESDAY_22H = '2026-09-29T20:00:00.000Z';
const WEDNESDAY_8H = new Date('2026-09-30T06:00:00.000Z');
const FORMAT = { dateTime: (iso: string) => iso, time: (iso: string) => iso, day: (key: string) => key };

function slot(name: string, weekdays: Weekday[], start: [number, number], end: [number, number]): ProtectedSlot {
  return { id: `${name}-${weekdays.join('-')}-${start.join('h')}`, name, weekdays, startMinute: minutesOfDay(...start), endMinute: minutesOfDay(...end) };
}

/** Les termes du besoin d'une planche, cohérents entre eux comme la 3.3 les produit : l'arrosage validé y est déjà compté. */
function need(plannedIrrigationMm: number, objectiveMm = 20): Partial<BedIrrigationNeed> {
  const raw = planningNeedMm(objectiveMm, 0, 0, 0, plannedIrrigationMm);
  return {
    objectiveMm, actualRainMm: 0, forecastRainMm: 0, actualIrrigationMm: 0, plannedIrrigationMm,
    rawPlanningNeedMm: raw, calculatedNeedMm: raw, effectiveNeedMm: raw, realRemainingMm: realRemainingMm(objectiveMm, 0, 0), manualOverrideMm: null,
  };
}

/** La ferme de test, mardi 12 h 52, l'aspersion du bloc 2 validée pour mardi soir, et des créneaux protégés. */
function farmWith(events: IrrigationEventRecord[], protectedSlots: ProtectedSlot[], now?: Date): PlanningInputs {
  const { inputs } = farm({ now, events, plotNeeds: { 'bloc-2': need(PLANNED_MM) } });
  return { ...inputs, protectedSlots };
}

const tuesdayEvening = () => validatedIrrigation('bloc-2-mardi', 'rampe-bloc-2', PARIS_21H_TUESDAY, TWO_HOURS, BLOC_2);
const only = (plan: { suggestions: PlanSuggestion[] }, eventId: string) => plan.suggestions.filter((suggestion) => suggestion.eventId === eventId);
const protectedCause = (suggestion: PlanSuggestion) => {
  const cause = suggestion.causes.find((candidate) => candidate.kind === 'protected-slot');
  assert.ok(cause && cause.kind === 'protected-slot', 'une raison « créneau protégé »');
  return cause;
};
/** Ce que les propositions du plan donnent à chaque planche du bloc 2, et ce qui lui manque encore. */
const bloc2 = (plan: ReturnType<typeof buildWeeklyPlan>) => BLOC_2.map((bedId) => ({
  proposedMm: plan.proposals.flatMap((proposal) => proposal.bedApplications).filter((application) => application.bedId === bedId).reduce((sum, application) => sum + application.appliedMm, 0),
  deficitMm: plan.beds.find((bed) => bed.bedId === bedId)?.deficitMm ?? null,
}));

test('cas 9 : aspersion validée mardi 21 h – 23 h, « Lavage » posé ensuite de 22 h à 23 h — « Réduire » à la partie avant, l’arrosage comptant comme avant', () => {
  const event = tuesdayEvening();
  const without = buildWeeklyPlan(farmWith([event], []), settings);
  assert.equal(only(without, 'bloc-2-mardi').length, 0, 'sans créneau protégé, aucune suggestion');

  const inputs = farmWith([event], [slot('Lavage des légumes', ['tuesday'], [22, 0], [23, 0])]);
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  const [suggestion, ...others] = only(plan, 'bloc-2-mardi');
  assert.equal(others.length, 0);
  assert.equal(suggestion.suggestion, 'reduce');
  close(suggestion.doseMm, PLANNED_MM / 2, 1e-9, 'la dose d’une heure sur deux');
  assert.equal(suggestion.durationSeconds, 3600, 'la durée suit la dose');
  assert.equal(suggestion.endAt, TUESDAY_22H, 'la fin suit le début : 22 h, au début du créneau protégé');
  close(suggestion.plannedDoseMm, PLANNED_MM, 1e-9, 'dose prévue');
  const cause = protectedCause(suggestion);
  assert.deepEqual(cause.slotNames, ['Lavage des légumes']);
  close(cause.partBeforeMm, PLANNED_MM / 2, 1e-9);
  assert.equal(cause.minimumMm, 5);
  assert.equal(suggestionCauseLabel(cause, FORMAT), 'cet arrosage tombe dans le créneau protégé « Lavage des légumes » ; la partie avant porte 6,7 mm');

  // Comptée comme avant tant que le geste manque : le bloc 2 ne reçoit rien de plus, et l'arrosage validé reste tel quel.
  assert.deepEqual(bloc2(plan), bloc2(without));
  assert.ok(bloc2(plan).every((bed) => Number.isFinite(bed.proposedMm) && bed.deficitMm !== null), 'des nombres, pas des valeurs absentes');
  assert.equal(event.equipment.plannedEndAt, '2026-09-29T21:00:00.000Z');
  assert.deepEqual(plan.overcommittedDays, without.overcommittedDays);

  // La partie avant sous la dose minimale : « Annuler ».
  const short = only(buildWeeklyPlan(farmWith([event], [slot('Lavage', ['tuesday'], [21, 30], [23, 0])]), settings), 'bloc-2-mardi');
  assert.equal(short.length, 1);
  assert.equal(short[0].suggestion, 'cancel');
  assert.equal(short[0].doseMm, null);
  close(protectedCause(short[0]).partBeforeMm, PLANNED_MM / 4, 1e-9, 'une demi-heure, 3,3 mm');
  assert.equal(suggestionCauseLabel(protectedCause(short[0]), FORMAT), 'cet arrosage tombe dans le créneau protégé « Lavage » ; la partie avant porte 3,3 mm, sous la dose minimale de 5 mm');
});

test('cas 9, dernier jour : la partie avant sous la dose minimale n’a pas de tolérance — « Annuler »', () => {
  const sunday = validatedIrrigation('bloc-2-dimanche', 'rampe-bloc-2', '2026-10-04T19:00:00.000Z', TWO_HOURS, BLOC_2);
  const [suggestion, ...others] = only(buildWeeklyPlan(farmWith([sunday], [slot('Repos', ['sunday'], [21, 30], [23, 0])], WEDNESDAY_8H), settings), 'bloc-2-dimanche');
  assert.equal(others.length, 0);
  assert.equal(suggestion.suggestion, 'cancel', 'règle 5 : pas de tolérance du dernier jour dans un créneau protégé');
  assert.deepEqual(suggestion.causes.map((cause) => cause.kind), ['protected-slot'], 'la dose utile, elle, ne suggère rien');
  close(protectedCause(suggestion).partBeforeMm, PLANNED_MM / 4, 1e-9);
});

test('cas 10 : aspersion validée 22 h – minuit, créneau 21 h – 23 h — elle y commence, « Annuler » seulement', () => {
  const late = validatedIrrigation('bloc-2-tard', 'rampe-bloc-2', TUESDAY_22H, TWO_HOURS, BLOC_2);
  const inputs = farmWith([late], [slot('Lavage', ['tuesday'], [21, 0], [23, 0])]);
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  const [suggestion] = only(plan, 'bloc-2-tard');
  assert.equal(suggestion.suggestion, 'cancel');
  const cause = protectedCause(suggestion);
  assert.equal(cause.partBeforeMm, null);
  assert.equal(suggestionCauseLabel(cause, FORMAT), 'cet arrosage tombe dans le créneau protégé « Lavage » et y commence : rien ne tient avant');
});

test('deux créneaux traversés : la partie avant le premier, les deux noms ; un créneau qui finit quand l’arrosage commence ne compte pas', () => {
  const event = tuesdayEvening();
  const [suggestion] = only(buildWeeklyPlan(farmWith([event], [
    slot('Passage', ['tuesday'], [22, 30], [22, 45]),
    slot('Lavage', ['tuesday'], [22, 0], [22, 15]),
    slot('Avant', ['tuesday'], [20, 0], [21, 0]),
  ]), settings), 'bloc-2-mardi');
  assert.equal(suggestion.suggestion, 'reduce');
  assert.equal(suggestion.durationSeconds, 3600, 'jusqu’au premier, 22 h');
  assert.deepEqual(protectedCause(suggestion).slotNames, ['Lavage', 'Passage']);
  assert.equal(suggestionCauseLabel(protectedCause(suggestion), FORMAT), 'cet arrosage tombe dans les créneaux protégés « Lavage », « Passage » ; la partie avant porte 6,7 mm');
  assert.equal(only(buildWeeklyPlan(farmWith([event], [slot('Avant', ['tuesday'], [20, 0], [21, 0]), slot('Après', ['tuesday'], [23, 0], [23, 30])]), settings), 'bloc-2-mardi').length, 0,
    'ni celui qui finit à 21 h ni celui qui commence à 23 h');
});

test('la partie avant à la minute entière inférieure : réduite, la fin n’entre jamais dans le créneau, même pour un début à la seconde', () => {
  const odd = validatedIrrigation('bloc-2-seconde', 'rampe-bloc-2', '2026-09-29T18:59:30.000Z', TWO_HOURS, BLOC_2);
  const [suggestion] = only(buildWeeklyPlan(farmWith([odd], [slot('Lavage', ['tuesday'], [22, 0], [23, 0])]), settings), 'bloc-2-seconde');
  assert.equal(suggestion.durationSeconds, 3600, '60 min et 30 s avant 22 h : 60 min');
  assert.ok(suggestion.endAt !== null && suggestion.endAt <= TUESDAY_22H);
});

test('avec la dose utile : la plus forte des deux réductions l’emporte, et les deux raisons se lisent', () => {
  const event = tuesdayEvening();
  // L'objectif baissé à 8 mm : dose utile 8 mm, écart de 5,3 mm sur les 13,3 prévus.
  const { inputs } = farm({ events: [event], plotNeeds: { 'bloc-2': need(PLANNED_MM, 8) } });
  const useful = only(buildWeeklyPlan(inputs, settings), 'bloc-2-mardi');
  assert.equal(useful[0].suggestion, 'reduce');
  close(useful[0].doseMm, 8, 0.01);
  const [both] = only(buildWeeklyPlan({ ...inputs, protectedSlots: [slot('Lavage', ['tuesday'], [22, 0], [23, 0])] }, settings), 'bloc-2-mardi');
  assert.equal(both.suggestion, 'reduce');
  close(both.doseMm, PLANNED_MM / 2, 1e-9, 'la partie avant, plus basse que la dose utile');
  assert.deepEqual(both.causes.map((cause) => cause.kind).sort(), ['protected-slot', 'useful-dose']);
});

test('cas 11 : « Garder » fait taire la suggestion au calcul identique ; un créneau changé qui change la suggestion la fait revenir', () => {
  const event = tuesdayEvening();
  const [first] = buildWeeklyPlan(farmWith([event], [slot('Lavage', ['tuesday'], [22, 0], [23, 0])]), settings).suggestions;
  const kept = [{ eventEquipmentId: first.eventEquipmentId, suggestion: first.suggestion, doseMm: first.doseMm }];
  const again = buildWeeklyPlan(farmWith([event], [slot('Lavage', ['tuesday'], [22, 0], [23, 0])]), settings).suggestions;
  assert.equal(markKeptSuggestions(again, kept)[0].kept, true, 'le même calcul : elle se tait');
  const moved = buildWeeklyPlan(farmWith([event], [slot('Lavage', ['tuesday'], [22, 30], [23, 0])]), settings).suggestions;
  close(moved[0].doseMm, PLANNED_MM * 0.75, 1e-9, 'une heure et demie avant');
  assert.equal(markKeptSuggestions(moved, kept)[0].kept, false, 'une autre dose : elle revient');
  const covering = buildWeeklyPlan(farmWith([event], [slot('Lavage', ['tuesday'], [21, 0], [23, 0])]), settings).suggestions;
  assert.equal(covering[0].suggestion, 'cancel');
  assert.equal(markKeptSuggestions(covering, kept)[0].kept, false, '« Annuler » après « Réduire » : elle revient');
});

test('cas 12 : une irrigation saisie après coup de 22 h à 23 h, dans le créneau, ne reçoit aucune suggestion', () => {
  const done = realIrrigation('bloc-2-fait', 'rampe-bloc-2', TUESDAY_22H, BLOC_2, 6.667, 6.667, 'sprinkler');
  const inputs = farmWith([done], [slot('Lavage', ['tuesday'], [21, 0], [23, 0])], WEDNESDAY_8H);
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  assert.equal(only(plan, 'bloc-2-fait').length, 0);
});

test('cas 13 : un arrosage en cours dans un créneau protégé ne reçoit aucune suggestion', () => {
  const base = tuesdayEvening();
  const running: IrrigationEventRecord = {
    ...base,
    equipment: { ...base.equipment, actualStartAt: PARIS_21H_TUESDAY, timerState: 'running', timerStartedAt: PARIS_21H_TUESDAY },
  };
  const plan = buildWeeklyPlan(farmWith([running], [slot('Lavage', ['tuesday'], [21, 0], [23, 0])], new Date('2026-09-29T19:30:00.000Z')), settings);
  assert.equal(only(plan, 'bloc-2-mardi').length, 0);
});

test('les créneaux en vigueur à un instant se lisent dans leur journal ; le signal d’une irrigation faite les nomme', () => {
  const version = (id: string, change: ProtectedSlotVersion['change'], createdAt: string, name = id): ProtectedSlotVersion => ({
    ...slot(name, ['tuesday'], [21, 0], [23, 0]), id, change, createdAt, actorUserId: 'alice',
  });
  // Du plus récent au plus ancien, comme le dépôt les rend.
  const journal = [
    version('lavage', 'updated', '2026-09-30T08:00:00.000Z', 'Lavage du soir'),
    version('passage', 'deleted', '2026-09-29T08:00:00.000Z'),
    version('lavage', 'created', '2026-09-28T08:00:00.000Z', 'Lavage'),
    version('passage', 'created', '2026-09-27T08:00:00.000Z'),
  ];
  assert.deepEqual(protectedSlotsInForceAt(journal, new Date('2026-09-26T00:00:00.000Z')), [], 'avant toute version, aucun');
  assert.deepEqual(protectedSlotsInForceAt(journal, new Date('2026-09-28T12:00:00.000Z')).map((entry) => entry.name), ['Lavage', 'passage']);
  assert.deepEqual(protectedSlotsInForceAt(journal, new Date('2026-09-29T12:00:00.000Z')).map((entry) => entry.name), ['Lavage'], 'supprimé, il ne vaut plus');
  assert.deepEqual(protectedSlotsInForceAt(journal, new Date('2026-10-01T00:00:00.000Z')).map((entry) => entry.name), ['Lavage du soir'], 'la dernière version');

  const slots = protectedSlotsInForceAt(journal, new Date('2026-09-28T12:00:00.000Z'));
  assert.deepEqual(protectedNamesBetween(slots, new Date(TUESDAY_22H), new Date('2026-09-29T21:00:00.000Z')), ['Lavage', 'passage']);
  assert.deepEqual(protectedNamesBetween(slots, new Date('2026-09-29T21:00:00.000Z'), new Date('2026-09-29T22:00:00.000Z')), [], 'de 23 h à minuit, rien');
  assert.equal(protectedSlotRealSignal(['Lavage des légumes']), 'Faite pendant le créneau protégé « Lavage des légumes »');
  assert.equal(protectedSlotRealSignal(['Lavage', 'Passage']), 'Faite pendant les créneaux protégés « Lavage », « Passage »');
  assert.equal(protectedSlotRealSignal([]), null);
});
