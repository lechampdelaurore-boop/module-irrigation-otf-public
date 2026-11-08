import assert from 'node:assert/strict';
import test from 'node:test';
import type { PlanningInputs, RefusedSlot } from '../lib/domain/planning/contract.ts';
import { buildWeeklyPlan } from '../lib/domain/planning/engine.ts';
import { refusedIntervalsByEquipment, withoutRefusedIntervals } from '../lib/domain/planning/refusals.ts';
import { assertInvariants, byEquipment, close, farm, realIrrigation, settings } from './support/planning-fixtures.ts';

/**
 * Le moteur lit les refus (docs/planning-contract.md, « Les statuts » et
 * « Les refus », D-030, point ouvert 31 ; docs/replanning-contract.md,
 * règles 1 à 3) : un créneau refusé — ce matériel, à ces heures — n'est plus
 * proposé de la semaine, même en partie, quelle que soit la dose ; le besoin
 * reste entier et se place ailleurs, ou se lit « non placé » avec son motif.
 * Le cas de la recette du 5 octobre 2026 est rejoué : la rampe de serre du
 * tunnel 4, refusée mardi 22 h 30 – 23 h 00, revenait au même créneau.
 */

const RAMPE_TUNNEL_4 = 'rampe-tunnel-4';
const TUNNEL_4 = Array.from({ length: 8 }, (_, index) => `T4-${index + 1}`);
const ZERO = { rawPlanningNeedMm: 0, effectiveNeedMm: 0 };
/** Mardi 22 h 30 – 23 h 00 à la ferme, le créneau refusé le 5 octobre 2026 ; la semaine de test est en heure d'été (UTC+2). */
const TUESDAY_22H30 = '2026-09-29T20:30:00.000Z';
const TUESDAY_23H00 = '2026-09-29T21:00:00.000Z';
const TUESDAY_23H30 = '2026-09-29T21:30:00.000Z';

const refusal = (startAt: string, endAt: string, equipmentId = RAMPE_TUNNEL_4): RefusedSlot => ({ equipmentId, startAt, endAt });

/** Les nuits d'aspersion de mardi à dimanche, 21 h – 8 h, toutes refusées pour un matériel. */
function everyNightRefused(equipmentId: string, from = '2026-09-29'): RefusedSlot[] {
  const nights = ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'].filter((day) => day >= from);
  return nights.map((day) => refusal(`${day}T19:00:00.000Z`, new Date(Date.parse(`${day}T19:00:00.000Z`) + 11 * 3_600_000).toISOString(), equipmentId));
}

/**
 * La ferme du 5 octobre : la rampe du tunnel 4 a arrosé 5 mm lundi 22 h 30 ;
 * il lui reste 10 mm, soit 30 min à 20 mm/h, pas avant mardi 22 h 30 (R7).
 * Les autres planches n'ont pas de besoin, pour lire le tunnel 4 seul.
 */
function tunnel4Farm(options: { refusedSlots?: RefusedSlot[]; tunnel3NeedMm?: number } = {}) {
  const mondayNight = realIrrigation('tunnel-4-lundi', RAMPE_TUNNEL_4, '2026-09-28T20:30:00.000Z', TUNNEL_4, 5, 20, 'sprinkler');
  const { inputs } = farm({
    extraTunnels: true,
    events: [mondayNight],
    plotNeeds: {
      'bloc-1': ZERO, 'bloc-2': ZERO, 'tunnel-1': ZERO, 'tunnel-2': ZERO,
      'tunnel-3': options.tunnel3NeedMm === undefined ? ZERO : { rawPlanningNeedMm: options.tunnel3NeedMm, effectiveNeedMm: options.tunnel3NeedMm, calculatedNeedMm: options.tunnel3NeedMm, realRemainingMm: options.tunnel3NeedMm },
      'tunnel-4': { rawPlanningNeedMm: 10, effectiveNeedMm: 10, calculatedNeedMm: 10, realRemainingMm: 10, actualIrrigationMm: 5 },
    },
  });
  return { ...inputs, refusedSlots: options.refusedSlots } satisfies PlanningInputs;
}

const overlaps = (proposal: { startAt: string; endAt: string }, slot: RefusedSlot) => Date.parse(proposal.startAt) < Date.parse(slot.endAt) && Date.parse(proposal.endAt) > Date.parse(slot.startAt);

test('sans refus, la rampe du tunnel 4 revient mardi 22 h 30 – 23 h 00, comme le 5 octobre 2026', () => {
  const inputs = tunnel4Farm();
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  const tunnel4 = byEquipment(plan, RAMPE_TUNNEL_4);
  assert.equal(tunnel4.length, 1);
  assert.equal(tunnel4[0].startAt, TUESDAY_22H30, 'mardi 22 h 30 : 24 h après l’arrosage de lundi (R7)');
  assert.equal(tunnel4[0].endAt, TUESDAY_23H00);
  close(tunnel4[0].doseMm, 10, 0.01);
  assert.equal(tunnel4[0].justification.timingReason, 'spacing');
});

test('le refus du tunnel 4 (mardi 22 h 30 – 23 h 00) : la rampe est placée ailleurs, jamais sur ces heures, le besoin entier (D-030)', () => {
  const refused = refusal(TUESDAY_22H30, TUESDAY_23H00);
  const inputs = tunnel4Farm({ refusedSlots: [refused] });
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  const tunnel4 = byEquipment(plan, RAMPE_TUNNEL_4);
  assert.equal(tunnel4.length, 1, 'une seule proposition : le besoin est placé ailleurs, pas perdu');
  assert.ok(!overlaps(tunnel4[0], refused), `${tunnel4[0].startAt} → ${tunnel4[0].endAt} ne recouvre pas le créneau refusé`);
  assert.equal(tunnel4[0].startAt, TUESDAY_23H00, 'mardi 23 h : juste après le créneau refusé, le même soir');
  assert.equal(tunnel4[0].endAt, TUESDAY_23H30);
  close(tunnel4[0].doseMm, 10, 0.01, 'la dose ne change pas');
  assert.equal(tunnel4[0].justification.timingReason, 'after-refused-slot');
  assert.equal(tunnel4[0].justification.limitingConstraint, 'créneau refusé évité (D-030)');
  for (const bed of plan.beds.filter((outcome) => TUNNEL_4.includes(outcome.bedId))) {
    assert.equal(bed.deficitMm, 0, `${bed.bedName} : besoin entier placé`);
    assert.deepEqual(bed.reasons, []);
  }
  // Déterminisme : le même refus donne le même plan.
  assert.deepEqual(buildWeeklyPlan(inputs, settings), plan);
});

test('un refus qui ne recouvre le créneau qu’en partie : rien ne le chevauche, le créneau est coupé avant lui et le reste placé un autre jour', () => {
  const refused = refusal('2026-09-29T20:45:00.000Z', TUESDAY_23H00);
  const inputs = tunnel4Farm({ refusedSlots: [refused] });
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  const tunnel4 = byEquipment(plan, RAMPE_TUNNEL_4);
  assert.ok(tunnel4.every((proposal) => !overlaps(proposal, refused)), 'aucun créneau sur les heures refusées, même en partie');
  assert.equal(tunnel4[0].startAt, TUESDAY_22H30);
  assert.equal(tunnel4[0].endAt, '2026-09-29T20:45:00.000Z', 'coupé juste avant le créneau refusé');
  close(tunnel4[0].doseMm, 5, 0.01, 'le quart d’heure qui tient : la dose minimale');
  assert.equal(tunnel4[0].justification.doseReason, 'refused-slot-fit');
  assert.equal(tunnel4[0].justification.limitingConstraint, 'créneau refusé évité (D-030)');
  assert.equal(tunnel4.length, 2, 'le reste est placé un autre jour (R6 : un arrosage par jour)');
  assert.ok(tunnel4[1].startAt >= '2026-09-30T', 'mercredi au plus tôt');
  const placed = plan.beds.filter((outcome) => TUNNEL_4.includes(outcome.bedId));
  assert.ok(placed.every((bed) => bed.deficitMm === 0), 'le besoin reste entier et finit placé');
});

test('deux refus excluent deux créneaux, pas le jour : la rampe suit le second, le même soir (D-030)', () => {
  const inputs = tunnel4Farm({ refusedSlots: [refusal(TUESDAY_23H00, TUESDAY_23H30), refusal(TUESDAY_22H30, TUESDAY_23H00)] });
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  const tunnel4 = byEquipment(plan, RAMPE_TUNNEL_4);
  assert.equal(tunnel4.length, 1);
  assert.equal(tunnel4[0].startAt, TUESDAY_23H30, 'mardi 23 h 30, après les deux créneaux refusés, pas mercredi');
  assert.equal(tunnel4[0].justification.timingReason, 'after-refused-slot');
});

test('un refus ne vaut que pour son matériel : la rampe du tunnel 3 garde ces heures', () => {
  const inputs = tunnel4Farm({ refusedSlots: everyNightRefused(RAMPE_TUNNEL_4), tunnel3NeedMm: 10 });
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  const tunnel3 = byEquipment(plan, 'rampe-tunnel-3');
  assert.equal(tunnel3.length, 1);
  assert.equal(tunnel3[0].startAt, '2026-09-29T19:00:00.000Z', 'mardi 21 h, dans les heures refusées au tunnel 4');
  assert.equal(tunnel3[0].justification.timingReason, 'window', 'à l’ouverture de sa plage, sans rien savoir du refus');
  assert.equal(byEquipment(plan, RAMPE_TUNNEL_4).length, 0);
});

test('toutes les plages refusées : la planche lit « créneau refusé » dans « Non placé », le besoin reste', () => {
  const inputs = tunnel4Farm({ refusedSlots: everyNightRefused(RAMPE_TUNNEL_4) });
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  assert.equal(byEquipment(plan, RAMPE_TUNNEL_4).length, 0);
  for (const bed of plan.beds.filter((outcome) => TUNNEL_4.includes(outcome.bedId))) {
    assert.deepEqual(bed.reasons, ['refused-slot'], bed.bedName);
    close(bed.deficitMm, 10, 0.01, `${bed.bedName} : le besoin n’est pas perdu`);
  }
  assert.ok((plan.deficit.byReason['refused-slot'] ?? 0) > 0, 'le manque est compté sous son motif');
  assert.equal(plan.deficit.waterCubicMeters, 0, 'ce n’est pas un manque d’eau');
});

test('trop court avant un refus alors que la plage aurait suffi : c’est le refus qui est nommé', () => {
  // Mardi, dix minutes restent avant un refus qui couvre le reste de la nuit ; les autres nuits sont refusées entières.
  const inputs = tunnel4Farm({ refusedSlots: [refusal('2026-09-29T20:40:00.000Z', '2026-09-30T06:00:00.000Z'), ...everyNightRefused(RAMPE_TUNNEL_4, '2026-09-30')] });
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  assert.equal(byEquipment(plan, RAMPE_TUNNEL_4).length, 0, 'dix minutes ne font pas la dose minimale');
  for (const bed of plan.beds.filter((outcome) => TUNNEL_4.includes(outcome.bedId))) assert.deepEqual(bed.reasons, ['refused-slot'], bed.bedName);
});

test('quand une autre contrainte aurait suffi, c’est elle qui est nommée : l’espacement l’emporte sur le refus', () => {
  // Dimanche 22 h 30, le bloc 2 arrosé le matin même : l'espacement renvoie à lundi, il n'y a plus de plage ;
  // un refus sur la nuit de dimanche n'y change rien et ne se nomme pas.
  const sunday = new Date('2026-10-04T20:30:00.000Z');
  const bloc2 = Array.from({ length: 10 }, (_, index) => `B2-${index + 1}`);
  const morning = realIrrigation('bloc-2-dimanche-matin', 'rampe-bloc-2', '2026-10-04T04:00:00.000Z', bloc2, 6, 6.667, 'sprinkler');
  const { inputs } = farm({ now: sunday, events: [morning], plotNeeds: { 'bloc-2': { rawPlanningNeedMm: 4 }, 'bloc-1': ZERO, 'tunnel-1': ZERO, 'tunnel-2': ZERO } });
  const withRefusal: PlanningInputs = { ...inputs, refusedSlots: [refusal('2026-10-04T19:00:00.000Z', '2026-10-04T22:00:00.000Z', 'rampe-bloc-2')] };
  const plan = buildWeeklyPlan(withRefusal, settings);
  assertInvariants(plan, withRefusal);
  assert.equal(byEquipment(plan, 'rampe-bloc-2').length, 0);
  for (const bed of plan.beds.filter((outcome) => bloc2.includes(outcome.bedId))) assert.deepEqual(bed.reasons, ['spacing'], bed.bedName);

  // Sans l'arrosage du matin, le même refus est la seule cause : il se nomme.
  const onlyRefusal: PlanningInputs = { ...withRefusal, events: [] };
  const refusedPlan = buildWeeklyPlan(onlyRefusal, settings);
  assertInvariants(refusedPlan, onlyRefusal);
  assert.equal(byEquipment(refusedPlan, 'rampe-bloc-2').length, 0);
  for (const bed of refusedPlan.beds.filter((outcome) => bloc2.includes(outcome.bedId))) assert.deepEqual(bed.reasons, ['refused-slot'], bed.bedName);
});

test('les créneaux refusés se lisent par matériel ; un créneau illisible ou vide est ignoré', () => {
  const byEquipmentId = refusedIntervalsByEquipment([
    refusal(TUESDAY_23H00, TUESDAY_23H30),
    refusal(TUESDAY_22H30, TUESDAY_23H00),
    refusal('pas une date', TUESDAY_23H00),
    refusal(TUESDAY_23H00, TUESDAY_23H00),
    refusal(TUESDAY_22H30, TUESDAY_23H00, 'rampe-tunnel-3'),
  ]);
  assert.deepEqual([...byEquipmentId.keys()].sort(), ['rampe-tunnel-3', RAMPE_TUNNEL_4]);
  assert.deepEqual(byEquipmentId.get(RAMPE_TUNNEL_4), [
    { startMs: Date.parse(TUESDAY_22H30), endMs: Date.parse(TUESDAY_23H00) },
    { startMs: Date.parse(TUESDAY_23H00), endMs: Date.parse(TUESDAY_23H30) },
  ], 'dans l’ordre du temps, sans les créneaux illisibles');
  assert.equal(refusedIntervalsByEquipment(undefined).size, 0);
});

test('une plage se découpe autour des refus : coupée en deux, rognée, retirée, ou laissée entière quand le refus ne fait que la toucher', () => {
  const night = { dateKey: '2026-09-29', startAt: new Date('2026-09-29T19:00:00.000Z'), endAt: new Date('2026-09-30T06:00:00.000Z') };
  const at = (iso: string) => Date.parse(iso);
  const middle = withoutRefusedIntervals([night], [{ startMs: at(TUESDAY_22H30), endMs: at(TUESDAY_23H00) }]);
  assert.deepEqual(middle.map((piece) => [piece.startAt.toISOString(), piece.endAt.toISOString(), piece.startsAfterRefusal, piece.endsBeforeRefusal]), [
    ['2026-09-29T19:00:00.000Z', TUESDAY_22H30, false, true],
    [TUESDAY_23H00, '2026-09-30T06:00:00.000Z', true, false],
  ]);
  assert.ok(middle.every((piece) => piece.dateKey === '2026-09-29' && piece.windowEndAt.getTime() === night.endAt.getTime()), 'chaque morceau garde son jour de planning et la fin de sa plage');

  const trimmedStart = withoutRefusedIntervals([night], [{ startMs: at('2026-09-29T18:00:00.000Z'), endMs: at('2026-09-29T20:00:00.000Z') }]);
  assert.deepEqual(trimmedStart.map((piece) => [piece.startAt.toISOString(), piece.endAt.toISOString()]), [['2026-09-29T20:00:00.000Z', '2026-09-30T06:00:00.000Z']]);

  const removed = withoutRefusedIntervals([night], [{ startMs: at('2026-09-29T18:00:00.000Z'), endMs: at('2026-09-30T07:00:00.000Z') }]);
  assert.deepEqual(removed, []);

  const touching = withoutRefusedIntervals([night], [{ startMs: at('2026-09-29T18:00:00.000Z'), endMs: at('2026-09-29T19:00:00.000Z') }, { startMs: at('2026-09-30T06:00:00.000Z'), endMs: at('2026-09-30T07:00:00.000Z') }]);
  assert.deepEqual(touching.map((piece) => [piece.startAt.toISOString(), piece.endAt.toISOString(), piece.startsAfterRefusal, piece.endsBeforeRefusal]), [['2026-09-29T19:00:00.000Z', '2026-09-30T06:00:00.000Z', false, false]]);

  const twice = withoutRefusedIntervals([night], [{ startMs: at(TUESDAY_22H30), endMs: at(TUESDAY_23H00) }, { startMs: at(TUESDAY_23H00), endMs: at(TUESDAY_23H30) }]);
  assert.deepEqual(twice.map((piece) => [piece.startAt.toISOString(), piece.endAt.toISOString()]), [['2026-09-29T19:00:00.000Z', TUESDAY_22H30], [TUESDAY_23H30, '2026-09-30T06:00:00.000Z']], 'deux refus contigus : rien entre eux');
  assert.deepEqual(withoutRefusedIntervals([night], []), [{ ...night, startsAfterRefusal: false, endsBeforeRefusal: false, windowEndAt: night.endAt }]);
});
