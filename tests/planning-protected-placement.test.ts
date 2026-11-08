import assert from 'node:assert/strict';
import test from 'node:test';
import type { PlanningInputs } from '../lib/domain/planning/contract.ts';
import { buildWeeklyPlan } from '../lib/domain/planning/engine.ts';
import { unplacedOrigin } from '../lib/domain/planning/origins.ts';
import { bedReasonLabels, doseReasonLabel, timingReasonLabel, unplacedReasonLabel } from '../lib/domain/planning/presentation.ts';
import type { ProtectedSlot, Weekday } from '../lib/domain/planning/protected-slots.ts';
import { minutesOfDay } from '../lib/domain/planning/settings.ts';
import { assertInvariants, BLOC_2, byEquipment, close, farm, PARIS_21H_TUESDAY, PARIS_21H_WEDNESDAY, realIrrigation, settings } from './support/planning-fixtures.ts';

/**
 * Le placement évite les créneaux protégés (docs/protected-slots-contract.md,
 * règles 5 et 6, cas 1 à 8, 16 et 17 ; D-062, précisions D-071) : la plage
 * R8 de chaque matériel est découpée autour d'eux, pour tout le matériel de
 * l'exploitation et sans exception ; le besoin se place dans ce qui reste, à
 * une autre heure ou un autre jour, ou se lit « non placé » avec le motif
 * « créneau protégé » et le nom du créneau. La semaine de test est en heure
 * d'été (UTC+2) ; `assertInvariants` vérifie aussi qu'aucun créneau planifié
 * ne recouvre un créneau protégé.
 */

const EVERY_DAY: Weekday[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const ZERO = { rawPlanningNeedMm: 0, effectiveNeedMm: 0 };
const TUESDAY_23H = '2026-09-29T21:00:00.000Z';
const WEDNESDAY_0H = '2026-09-29T22:00:00.000Z';

function slot(name: string, weekdays: Weekday[], start: [number, number], end: [number, number]): ProtectedSlot {
  return { id: `${name}-${weekdays.join('-')}`, name, weekdays, startMinute: minutesOfDay(...start), endMinute: minutesOfDay(...end) };
}

const withSlots = (inputs: PlanningInputs, protectedSlots: ProtectedSlot[]): PlanningInputs => ({ ...inputs, protectedSlots });
const sprinklerProposals = (plan: ReturnType<typeof buildWeeklyPlan>) => plan.proposals.filter((proposal) => proposal.kind === 'sprinkler');

test('cas 1 : sans créneau protégé, le plan est celui d’avant, octet pour octet ; une liste vide ou un créneau sans arrosage dedans n’y change rien', () => {
  const { inputs } = farm();
  const reference = JSON.stringify(buildWeeklyPlan(inputs, settings));
  assert.equal(JSON.stringify(buildWeeklyPlan(withSlots(inputs, []), settings)), reference);
  // Mardi 15 h – 16 h : ni le goutte-à-goutte (12 h 52) ni l'aspersion (21 h) n'y tombent.
  assert.equal(JSON.stringify(buildWeeklyPlan(withSlots(inputs, [slot('Pause', ['tuesday'], [15, 0], [16, 0])]), settings)), reference);
  assert.ok(!reference.includes('protectedSlotNames'), 'aucune planche ne porte de nom de créneau protégé');
});

test('cas 2 : « Lavage » mardi 21 h – 23 h, l’aspersion de mardi commence à 23 h avec sa durée entière, et la justification le dit', () => {
  const inputs = withSlots(farm().inputs, [slot('Lavage', ['tuesday'], [21, 0], [23, 0])]);
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  const reference = buildWeeklyPlan(farm().inputs, settings);
  const rampe = byEquipment(plan, 'rampe-bloc-2');
  assert.equal(byEquipment(reference, 'rampe-bloc-2')[0].startAt, PARIS_21H_TUESDAY, 'sans le créneau, mardi 21 h');
  assert.equal(rampe[0].startAt, TUESDAY_23H, 'mardi 23 h, à la fin du créneau protégé');
  assert.equal(rampe[0].durationSeconds, byEquipment(reference, 'rampe-bloc-2')[0].durationSeconds, 'la même durée, qui finit mercredi');
  assert.ok(rampe[0].endAt > WEDNESDAY_0H);
  assert.equal(rampe[0].justification.timingReason, 'after-protected-slot');
  assert.equal(timingReasonLabel('after-protected-slot'), 'après un créneau protégé');
  assert.equal(rampe[0].justification.limitingConstraint, 'créneau protégé « Lavage » évité');
  for (const id of ['rampe-tunnel-1', 'rampe-tunnel-2']) assert.equal(byEquipment(plan, id)[0].startAt, TUESDAY_23H, `${id} : 23 h aussi`);
  assert.ok(plan.beds.every((bed) => bed.deficitMm === 0 && bed.reasons.length === 0), 'tout le besoin est placé');
});

test('cas 3 : rien ne tient mardi (21 h – 8 h), le besoin se place mercredi ; toutes les nuits prises, non placé « créneau protégé : Lavage »', () => {
  const tuesday = withSlots(farm().inputs, [slot('Lavage', ['tuesday'], [21, 0], [8, 0])]);
  const moved = buildWeeklyPlan(tuesday, settings);
  assertInvariants(moved, tuesday);
  assert.ok(sprinklerProposals(moved).every((proposal) => proposal.startAt >= PARIS_21H_WEDNESDAY), 'aucune aspersion mardi soir');
  assert.equal(byEquipment(moved, 'rampe-bloc-2')[0].startAt, PARIS_21H_WEDNESDAY, 'mercredi 21 h');
  assert.ok(moved.beds.every((bed) => bed.deficitMm === 0), 'le besoin reste entier et finit placé');

  const everyNight = withSlots(farm().inputs, [slot('Lavage', EVERY_DAY, [21, 0], [8, 0])]);
  const blocked = buildWeeklyPlan(everyNight, settings);
  assertInvariants(blocked, everyNight);
  assert.equal(sprinklerProposals(blocked).length, 0, 'aucune aspersion de la semaine');
  const sprinklerBeds = blocked.beds.filter((bed) => bed.equipmentId?.startsWith('rampe-'));
  assert.equal(sprinklerBeds.length, 26);
  for (const bed of sprinklerBeds) {
    assert.deepEqual(bed.reasons, ['protected-slot'], bed.bedName);
    assert.deepEqual(bed.protectedSlotNames, ['Lavage'], bed.bedName);
    assert.deepEqual(bedReasonLabels(bed), ['créneau protégé : Lavage']);
  }
  assert.match(unplacedOrigin(sprinklerBeds[0]), /Motif : créneau protégé : Lavage\.$/);
  assert.ok((blocked.deficit.byReason['protected-slot'] ?? 0) > 0, 'le manque est compté sous son motif');
  assert.equal(byEquipment(blocked, 'gag1').length, 2, 'le goutte-à-goutte, de 8 h à 21 h, reste placé');
});

test('cas 4 : le créneau vaut pour tout le matériel, le goutte-à-goutte (6 h – 22 h) évite aussi 21 h – 22 h', () => {
  const lavage = [slot('Lavage', ['tuesday'], [21, 0], [23, 0])];
  const at2030 = new Date('2026-09-29T18:30:00.000Z');
  assert.ok(byEquipment(buildWeeklyPlan(farm({ now: at2030 }).inputs, settings), 'gag1')[0].endAt > '2026-09-29T19:12:00.000Z', 'sans le créneau, de 20 h 30 à 21 h 12 passé');

  const early = withSlots(farm({ now: at2030 }).inputs, lavage);
  const plan = buildWeeklyPlan(early, settings);
  assertInvariants(plan, early);
  const gag1 = byEquipment(plan, 'gag1');
  assert.equal(gag1[0].startAt, at2030.toISOString());
  assert.equal(gag1[0].endAt, '2026-09-29T19:00:00.000Z', 'coupé à 21 h : la demi-heure porte plus que la dose minimale');
  close(gag1[0].doseMm, 7, 0.01);
  assert.equal(gag1[0].justification.doseReason, 'protected-slot-fit');
  assert.equal(doseReasonLabel('protected-slot-fit'), 'ce qui tient avant un créneau protégé');
  assert.equal(gag1[0].justification.limitingConstraint, 'créneau protégé « Lavage » évité');

  // 20 h 50 : dix minutes avant le créneau ne portent pas les 3 mm de la dose minimale ; mercredi 6 h.
  const late = withSlots(farm({ now: new Date('2026-09-29T18:50:00.000Z') }).inputs, lavage);
  const later = buildWeeklyPlan(late, settings);
  assertInvariants(later, late);
  assert.equal(byEquipment(later, 'gag1')[0].startAt, '2026-09-30T04:00:00.000Z');
  assert.ok(later.beds.every((bed) => bed.deficitMm === 0), 'placé ailleurs, rien de perdu');
});

test('cas 5 : « Nuit calme » vendredi 22 h – 2 h protège vendredi soir et samedi jusqu’à 2 h, pas la nuit de samedi à dimanche', () => {
  const nightCalm = [slot('Nuit calme', ['friday'], [22, 0], [2, 0])];
  const friday = withSlots(farm({ now: new Date('2026-10-02T10:00:00.000Z') }).inputs, nightCalm);
  const plan = buildWeeklyPlan(friday, settings);
  assertInvariants(plan, friday);
  const rampe = byEquipment(plan, 'rampe-bloc-2');
  assert.equal(rampe[0].startAt, '2026-10-02T19:00:00.000Z', 'vendredi 21 h');
  assert.equal(rampe[0].endAt, '2026-10-02T20:00:00.000Z', 'coupé à 22 h');
  assert.equal(rampe[0].justification.doseReason, 'protected-slot-fit');
  assert.equal(rampe[0].justification.limitingConstraint, 'créneau protégé « Nuit calme » évité');

  // Samedi 2 h – 8 h reste utilisable : l'espacement d'un arrosage de jeudi 23 h 30 ouvre vendredi 23 h 30.
  const thursday = realIrrigation('jeudi', 'rampe-bloc-2', '2026-10-01T21:30:00.000Z', BLOC_2, 5, 6.667, 'sprinkler');
  const spaced = (slots: ProtectedSlot[]) => withSlots(farm({ now: new Date('2026-10-02T10:00:00.000Z'), events: [thursday] }).inputs, slots);
  assert.equal(byEquipment(buildWeeklyPlan(spaced([]), settings), 'rampe-bloc-2')[0].startAt, '2026-10-02T21:30:00.000Z', 'sans le créneau, vendredi 23 h 30');
  const early = buildWeeklyPlan(spaced(nightCalm), settings);
  assertInvariants(early, spaced(nightCalm));
  assert.equal(byEquipment(early, 'rampe-bloc-2')[0].startAt, '2026-10-03T00:00:00.000Z', 'samedi 2 h, à la fin du créneau');
  assert.equal(byEquipment(early, 'rampe-bloc-2')[0].justification.timingReason, 'after-protected-slot');

  // Samedi 23 h 30 : le créneau du vendredi est passé, dimanche 0 h – 2 h n'est pas protégé ; celui du samedi le protège.
  const saturdayNight = farm({ now: new Date('2026-10-03T21:30:00.000Z') }).inputs;
  assert.equal(JSON.stringify(buildWeeklyPlan(withSlots(saturdayNight, nightCalm), settings)), JSON.stringify(buildWeeklyPlan(saturdayNight, settings)));
  assert.ok(byEquipment(buildWeeklyPlan(saturdayNight, settings), 'rampe-bloc-2')[0].endAt > '2026-10-03T23:44:00.000Z', 'jusqu’à dimanche 1 h 44 passé');
  const saturdaySlot = withSlots(saturdayNight, [slot('Nuit calme', ['saturday'], [22, 0], [2, 0])]);
  const sunday = buildWeeklyPlan(saturdaySlot, settings);
  assertInvariants(sunday, saturdaySlot);
  assert.equal(byEquipment(sunday, 'rampe-bloc-2')[0].startAt, '2026-10-04T00:00:00.000Z', 'dimanche 2 h');
});

test('cas 6 : deux créneaux qui se chevauchent, 21 h – 23 h et 22 h – 24 h, protègent leur union et se nomment tous deux', () => {
  const inputs = withSlots(farm().inputs, [slot('Lavage', ['tuesday'], [21, 0], [23, 0]), slot('Passage', ['tuesday'], [22, 0], [0, 0])]);
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  const rampe = byEquipment(plan, 'rampe-bloc-2');
  assert.equal(rampe[0].startAt, WEDNESDAY_0H, 'mercredi 0 h, après l’union');
  assert.equal(rampe[0].justification.limitingConstraint, 'créneaux protégés « Lavage », « Passage » évités');
});

test('cas 7 : une planche prioritaire en pénurie n’entre pas dans le créneau protégé ; non placée « créneau protégé »', () => {
  const shortage = { reservoirCubicMeters: 5, forageFlow: 0.05, priorities: { 'bloc-2': 'high' as const } };
  const reference = buildWeeklyPlan(farm(shortage).inputs, settings);
  assert.ok(byEquipment(reference, 'rampe-bloc-2').length > 0, 'sans le créneau, le bloc 2 prioritaire est servi');
  const inputs = withSlots(farm(shortage).inputs, [slot('Lavage', EVERY_DAY, [21, 0], [8, 0])]);
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  assert.equal(sprinklerProposals(plan).length, 0, 'toujours rien dans le créneau');
  for (const bed of plan.beds.filter((outcome) => BLOC_2.includes(outcome.bedId))) {
    assert.equal(bed.priority, 'high');
    assert.ok(bed.reasons.includes('protected-slot'), `${bed.bedName} : ${bed.reasons.join(', ')}`);
    assert.deepEqual(bed.protectedSlotNames, ['Lavage']);
  }
});

test('cas 8 : le dernier jour, un reste sous la dose minimale n’a aucune tolérance : non placé « créneau protégé »', () => {
  const sunday = { now: new Date('2026-10-04T08:00:00.000Z'), plotNeeds: { 'bloc-1': ZERO, 'bloc-2': { rawPlanningNeedMm: 2, effectiveNeedMm: 2, calculatedNeedMm: 2, realRemainingMm: 2 }, 'tunnel-1': ZERO, 'tunnel-2': ZERO } };
  const reference = byEquipment(buildWeeklyPlan(farm(sunday).inputs, settings), 'rampe-bloc-2');
  assert.equal(reference[0].justification.doseReason, 'last-day-below-minimum', 'sans le créneau, les 2 mm partent dimanche soir');
  const inputs = withSlots(farm(sunday).inputs, [slot('Lavage', ['sunday'], [21, 0], [8, 0])]);
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  assert.equal(plan.proposals.length, 0);
  for (const bed of plan.beds.filter((outcome) => BLOC_2.includes(outcome.bedId))) {
    assert.deepEqual(bed.reasons, ['protected-slot'], bed.bedName);
    close(bed.deficitMm, 2, 1e-9);
  }
});

test('un morceau trop court avant un créneau protégé : le créneau se nomme quand la plage entière aurait suffi', () => {
  // 21 h – 21 h 30 chaque soir : 30 min ne portent pas les 5 mm de la rampe du bloc 2 (45 min), mais ceux des serres.
  const inputs = withSlots(farm().inputs, [slot('Repos', EVERY_DAY, [21, 30], [8, 0])]);
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  assert.equal(byEquipment(plan, 'rampe-bloc-2').length, 0);
  for (const bed of plan.beds.filter((outcome) => BLOC_2.includes(outcome.bedId))) {
    assert.deepEqual(bed.reasons, ['protected-slot'], bed.bedName);
    assert.deepEqual(bed.protectedSlotNames, ['Repos']);
  }
  const tunnel1 = byEquipment(plan, 'rampe-tunnel-1');
  assert.equal(tunnel1[0].endAt, '2026-09-29T19:30:00.000Z', 'la serre tient ses 5 mm avant 21 h 30');
  assert.equal(tunnel1[0].justification.doseReason, 'protected-slot-fit');
});

test('un créneau refusé après un créneau protégé : le refus, qui a repoussé le début, se nomme (D-030)', () => {
  const inputs = withSlots({ ...farm().inputs, refusedSlots: [{ equipmentId: 'rampe-bloc-2', startAt: TUESDAY_23H, endAt: '2026-09-29T21:30:00.000Z' }] }, [slot('Lavage', ['tuesday'], [21, 0], [23, 0])]);
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  const rampe = byEquipment(plan, 'rampe-bloc-2');
  assert.equal(rampe[0].startAt, '2026-09-29T21:30:00.000Z', 'mardi 23 h 30');
  assert.equal(rampe[0].justification.timingReason, 'after-refused-slot');
  assert.equal(rampe[0].justification.limitingConstraint, 'créneau refusé évité (D-030)');
  assert.equal(byEquipment(plan, 'rampe-tunnel-1')[0].justification.timingReason, 'after-protected-slot', 'le refus ne vaut que pour son matériel');
});

test('cas 16 : le jour du changement d’heure, le créneau garde ses heures murales, sans décalage d’une heure', () => {
  // La semaine du 19 au 25 octobre 2026 : dimanche 25, 3 h d'été redeviennent 2 h d'hiver (UTC+2 puis UTC+1).
  const now = new Date('2026-10-24T08:00:00.000Z');
  const { inputs } = farm({ now });
  const days = Array.from({ length: 7 }, (_, index) => `2026-10-${19 + index}`);
  const week: PlanningInputs = {
    ...inputs,
    weekStart: '2026-10-19',
    weekEnd: '2026-10-25',
    days: inputs.days.map((day, index) => ({ ...day, date: days[index] })),
    needs: inputs.needs.map((need) => ({ ...need, weekStart: '2026-10-19', weekEnd: '2026-10-25', deadlineAt: '2026-10-25T23:00:00.000Z' })),
    infrastructure: { ...inputs.infrastructure, reservoirs: inputs.infrastructure.reservoirs.map((reservoir) => ({ ...reservoir, currentVolumeObservedAt: now.toISOString() })) },
  };
  const reference = byEquipment(buildWeeklyPlan(week, settings), 'rampe-bloc-2');
  assert.deepEqual(reference.map((proposal) => proposal.startAt), ['2026-10-24T19:00:00.000Z', '2026-10-25T20:00:00.000Z'], 'sans le créneau : samedi et dimanche 21 h');
  const inputsWithSlot = withSlots(week, [slot('Lavage', ['saturday', 'sunday'], [21, 0], [23, 0])]);
  const plan = buildWeeklyPlan(inputsWithSlot, settings);
  assertInvariants(plan, inputsWithSlot);
  const rampe = byEquipment(plan, 'rampe-bloc-2');
  assert.equal(rampe[0].startAt, '2026-10-24T21:00:00.000Z', 'samedi 23 h, heure d’été');
  assert.equal(rampe[1].startAt, '2026-10-25T22:00:00.000Z', 'dimanche 23 h, heure d’hiver');
  assert.ok(rampe.every((proposal) => proposal.justification.timingReason === 'after-protected-slot'));
});

test('cas 17 : une planche sans besoin calculable garde son motif, sans manque ni nom de créneau', () => {
  const unknown = { needs: { 'B2-1': { objectiveMm: null, rawPlanningNeedMm: null } } };
  const reference = buildWeeklyPlan(farm(unknown).inputs, settings).beds.find((bed) => bed.bedId === 'B2-1');
  const inputs = withSlots(farm(unknown).inputs, [slot('Lavage', EVERY_DAY, [21, 0], [8, 0])]);
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  const bed = plan.beds.find((outcome) => outcome.bedId === 'B2-1');
  assert.ok(bed && reference);
  assert.deepEqual([bed.needMm, bed.targetMm, bed.deficitMm, bed.reasons], [reference.needMm, reference.targetMm, reference.deficitMm, reference.reasons], 'le même besoin, le même motif qu’avant');
  assert.deepEqual(bed.reasons, ['no-objective']);
  assert.equal(bed.deficitMm, 0, 'pas de manque inventé');
  assert.equal(bed.protectedSlotNames, undefined);
  assert.deepEqual(plan.beds.find((outcome) => outcome.bedId === 'B2-2')?.reasons, ['protected-slot'], 'ses voisines, elles, sont arrêtées par le créneau');
});

test('les libellés : le motif nomme ses créneaux, un ou plusieurs ; sans nom connu, le libellé général', () => {
  assert.equal(unplacedReasonLabel('protected-slot'), 'créneau protégé : ses seuls créneaux possibles tombent dans des créneaux protégés');
  assert.deepEqual(bedReasonLabels({ reasons: ['protected-slot'], protectedSlotNames: ['Lavage des légumes'] }), ['créneau protégé : Lavage des légumes']);
  assert.deepEqual(bedReasonLabels({ reasons: ['protected-slot', 'water-budget'], protectedSlotNames: ['Lavage', 'Passage'] }), ['créneaux protégés : Lavage, Passage', 'stock et ressources insuffisants d’ici dimanche']);
  assert.deepEqual(bedReasonLabels({ reasons: ['protected-slot'] }), [unplacedReasonLabel('protected-slot')]);
  assert.deepEqual(bedReasonLabels({ reasons: ['refused-slot'], protectedSlotNames: ['Lavage'] }), [unplacedReasonLabel('refused-slot')], 'les noms ne servent qu’au motif « créneau protégé »');
});
