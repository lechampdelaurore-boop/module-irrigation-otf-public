import assert from 'node:assert/strict';
import test from 'node:test';
import { formatWaterVolumeForMessage } from '../lib/domain/irrigation-format.ts';
import type { PlanningInputs, WeeklyPlan } from '../lib/domain/planning/contract.ts';
import { buildWeeklyPlan } from '../lib/domain/planning/engine.ts';
import { arbitrationNote } from '../lib/domain/planning/presentation.ts';
import { cubicMetersFromMillimeters } from '../lib/domain/units.ts';
import { assertInvariants, byEquipment, close, farm, plannedIrrigation, settings } from './support/planning-fixtures.ts';

/**
 * Les scénarios de pénurie de la 3.9 (docs/shortage-contract.md), en
 * commençant par les règles que le porteur a tranchées le 30 octobre 2026
 * (D-052). Décision 1 : sous un arbitrage 3.4 validé, chaque allocation est
 * une part réservée, sans redistribution entre planches ; ce qu'une planche
 * allouée ne peut pas recevoir reste non attribué, et l'écran le dit
 * (docs/planning-contract.md, « Pénurie »).
 */

/** La demande de la ferme à quatre tunnels : 1,98 m³ du bloc 1, 5,608 m³ du bloc 2, 10,24 m³ des tunnels. */
const DEMAND_CUBIC_METERS = 17.8278;
const NEED_MM = 20;
/** Dimanche 0 h 30 et 1 h 30 à la ferme. */
const SUNDAY_00H30 = '2026-10-03T22:30:00.000Z';
const SUNDAY_01H30 = '2026-10-03T23:30:00.000Z';
const TUNNELS = ['Tunnel 1', 'Tunnel 2', 'Tunnel 3', 'Tunnel 4'];

/** La surface que le propre matériel de chaque planche mouille sur la ferme de test : gag1 et gag2, la rampe du bloc 2, les rampes de serre. */
const wettedAreaOf = (bedId: string) => (bedId.startsWith('B1-') ? 16.5 : bedId.startsWith('B2-') ? 28.039 : 16);
/** Un arbitrage validé qui alloue à chaque planche tant de millimètres sur la surface que son matériel mouille. */
const arbitrationOf = (inputs: PlanningInputs, mmOf: (bedId: string) => number): PlanningInputs['arbitration'] =>
  inputs.needs.map(({ bedId }) => ({ bedId, allocatedCubicMeters: cubicMetersFromMillimeters(mmOf(bedId), wettedAreaOf(bedId)) }));
const tunnelsOnly = (mm: number) => (bedId: string) => (bedId.startsWith('T') ? mm : 0);

const plot = (plan: WeeklyPlan, plotName: string) => plan.beds.filter((bed) => bed.plotName === plotName);
const placedVolume = (plan: WeeklyPlan) => plan.proposals.reduce((sum, proposal) => sum + (proposal.volumeCubicMeters ?? 0), 0);
const tunnelBeds = (tunnel: number) => Array.from({ length: 8 }, (_, index) => `T${tunnel}-${index + 1}`);

test('S13, dernière planche examinée sous arbitrage : chaque allocation est une part réservée, le tunnel 4 reçoit la sienne comme le tunnel 2 (décision 1)', () => {
  // La ferme du point 36 : la réserve tient exactement les allocations, 6 mm partout ; les rampes du tunnel 1 et du
  // bloc 2 arrosent aussi des planches du bloc 1 à 2 mm/h. Sans parts, leur débordement prenait l'eau du tunnel 4.
  const base = farm({
    extraTunnels: true,
    forageFlow: 0,
    reservoirCubicMeters: DEMAND_CUBIC_METERS * 0.3,
    edges: [
      { equipmentId: 'rampe-tunnel-1', bedIds: ['B1-0', 'B1-1'], rateMmPerHour: 2 },
      { equipmentId: 'rampe-bloc-2', bedIds: ['B1-2', 'B1-3'], rateMmPerHour: 2 },
    ],
  });
  const inputs = { ...base.inputs, arbitration: arbitrationOf(base.inputs, () => 6) };
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  assert.deepEqual(plan.budgets, [], 'aucune ligne de budget ni fraction sous un arbitrage');
  for (const tunnel of ['Tunnel 2', 'Tunnel 3', 'Tunnel 4']) {
    for (const bed of plot(plan, tunnel)) close(bed.placedMm, 6, 0.05, bed.bedName);
  }
  // Le débordement d'une rampe se prend sur la part de ses propres planches, sans entamer celle des autres.
  for (const plotName of ['Tunnel 1', 'bloc 2']) {
    for (const bed of plot(plan, plotName)) {
      assert.ok(bed.placedMm > 5.3 && bed.placedMm < 6 - 0.05, `${bed.bedName} : ${bed.placedMm} mm, sous son allocation par son propre débordement`);
      assert.ok(bed.reasons.includes('water-budget'), `${bed.bedName} : le motif de l’arbitrage`);
    }
  }
  assert.equal(byEquipment(plan, 'rampe-bloc-2')[0].justification.doseReason, 'reserved-share');
  for (const bed of plot(plan, 'bloc 1')) close(bed.placedMm, 6, 0.05, bed.bedName);
  close(placedVolume(plan), DEMAND_CUBIC_METERS * 0.3, 0.01, 'la somme des volumes est l’eau allouée');
  // Le plan dit l'arbitrage : l'eau allouée, réservée telle quelle, toute placée.
  assert.ok(plan.arbitration, 'le plan porte l’arbitrage');
  close(plan.arbitration.allocatedCubicMeters, DEMAND_CUBIC_METERS * 0.3, 0.001, 'alloué');
  close(plan.arbitration.reservedCubicMeters, DEMAND_CUBIC_METERS * 0.3, 0.001, 'réservé');
  assert.equal(plan.arbitration.unreceivedBedCount, 0);
  assert.equal(arbitrationNote(plan), `Votre choix entre les demandes d’eau s’impose : ${formatWaterVolumeForMessage(plan.arbitration.allocatedCubicMeters)} m³ alloués, chaque allocation réservée à sa planche.`);
});

test('sous arbitrage, rien n’est redistribué : ce qu’une planche allouée ne peut pas recevoir reste non attribué, et la note le dit (décision 1)', () => {
  // Tunnels 2 et 3 : une irrigation planifiée dimanche à 0 h 30, l'espacement repousse tout arrosage après la semaine.
  // Sous la conduite, leurs parts iraient aux tunnels 1 et 4 (D-037) ; sous l'arbitrage, elles restent non attribuées.
  const base = farm({
    extraTunnels: true,
    forageFlow: 0,
    reservoirCubicMeters: 6,
    events: [
      plannedIrrigation('planifiee-t2', 'rampe-tunnel-2', SUNDAY_00H30, SUNDAY_01H30, tunnelBeds(2)),
      plannedIrrigation('planifiee-t3', 'rampe-tunnel-3', SUNDAY_00H30, SUNDAY_01H30, tunnelBeds(3)),
    ],
  });
  const inputs = { ...base.inputs, arbitration: arbitrationOf(base.inputs, tunnelsOnly(10)) };
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  for (const tunnel of ['Tunnel 2', 'Tunnel 3']) {
    for (const bed of plot(plan, tunnel)) {
      assert.equal(bed.placedMm, 0, bed.bedName);
      assert.ok(bed.reasons.includes('spacing'), `${bed.bedName} : espacement`);
    }
  }
  for (const tunnel of ['Tunnel 1', 'Tunnel 4']) {
    for (const bed of plot(plan, tunnel)) close(bed.placedMm, 10, 0.05, `${bed.bedName} : son allocation, rien de plus`);
  }
  assert.equal(byEquipment(plan, 'rampe-tunnel-1').length, 1, 'une seule nuit : aucune part libérée ne la relève');
  for (const plotName of ['bloc 1', 'bloc 2']) {
    for (const bed of plot(plan, plotName)) assert.equal(bed.placedMm, 0, `${bed.bedName} : exclue de l’arbitrage`);
  }
  close(placedVolume(plan), 2.56, 0.01, 'seules les allocations des tunnels 1 et 4 sont placées');
  assert.ok(plan.arbitration);
  close(plan.arbitration.allocatedCubicMeters, 5.12, 0.001, 'alloué');
  close(plan.arbitration.reservedCubicMeters, 5.12, 0.001, 'réservé, sans réduction');
  close(plan.arbitration.unreceivedCubicMeters, 2.56, 0.001, 'les parts des tunnels 2 et 3');
  assert.equal(plan.arbitration.unreceivedBedCount, 16);
  assert.equal(
    arbitrationNote(plan),
    'Votre choix entre les demandes d’eau s’impose : 5,12 m³ alloués, chaque allocation réservée à sa planche. '
      + '2,56 m³ alloués à 16 planches ne peuvent pas être reçus : ils restent non attribués, sans redistribution entre planches.',
  );
});

test('des allocations que la chaîne ne peut pas toutes fournir sont réduites dans la même proportion : la dernière planche examinée comme la première (décision 1)', () => {
  // 10 mm alloués à chaque planche des tunnels, 5,12 m³, pour une réserve de 3,6 m³ : 70,3 % de chaque allocation.
  const base = farm({ extraTunnels: true, forageFlow: 0, reservoirCubicMeters: 3.6 });
  const inputs = { ...base.inputs, arbitration: arbitrationOf(base.inputs, tunnelsOnly(10)) };
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  for (const tunnel of TUNNELS) {
    for (const bed of plot(plan, tunnel)) {
      close(bed.placedMm, 10 * 3.6 / 5.12, 0.05, bed.bedName);
      assert.ok(bed.reasons.includes('water-budget'), `${bed.bedName} : la coupe de la chaîne`);
    }
  }
  close(placedVolume(plan), 3.6, 0.01, 'toute l’eau de la chaîne');
  assert.ok(plan.arbitration);
  close(plan.arbitration.allocatedCubicMeters, 5.12, 0.001, 'alloué');
  close(plan.arbitration.reservedCubicMeters, 3.6, 0.001, 'réservé après réduction');
  assert.equal(plan.arbitration.unreceivedBedCount, 0);
  assert.equal(
    arbitrationNote(plan),
    'Votre choix entre les demandes d’eau s’impose : 5,12 m³ alloués, chaque allocation réservée à sa planche. '
      + 'Le moteur ne peut en placer que 3,6 m³ d’ici dimanche : chaque allocation est réduite dans la même proportion.',
  );
});

test('les planches qu’un arbitrage ne nomme pas puisent dans l’eau non attribuée ; sans arbitrage, le plan reste celui d’avant (décision 1)', () => {
  // Seul le tunnel 1 est nommé, à 10 mm ; les autres planches gardent leur besoin pour cible et prennent l'eau non attribuée.
  const base = farm({ extraTunnels: true, forageFlow: 0, reservoirCubicMeters: 6 });
  const named = base.inputs.needs.filter(({ bedId }) => bedId.startsWith('T1-'));
  const inputs = { ...base.inputs, arbitration: named.map(({ bedId }) => ({ bedId, allocatedCubicMeters: cubicMetersFromMillimeters(10, wettedAreaOf(bedId)) })) };
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  for (const bed of plot(plan, 'Tunnel 1')) close(bed.placedMm, 10, 0.05, `${bed.bedName} : son allocation`);
  close(placedVolume(plan), 6, 0.05, 'l’eau non attribuée sert les autres planches');
  assert.ok(plan.beds.filter((bed) => !bed.bedId.startsWith('T1-')).every((bed) => bed.targetMm === NEED_MM), 'les autres gardent leur besoin pour cible');
  assert.ok(plan.arbitration);
  close(plan.arbitration.allocatedCubicMeters, 1.28, 0.001, 'les seules allocations du tunnel 1');
  const without = buildWeeklyPlan({ ...base.inputs, arbitration: null }, settings);
  assert.equal('arbitration' in without, false, 'sans arbitrage, aucun champ nouveau');
  assert.equal(arbitrationNote(without), null);
});
