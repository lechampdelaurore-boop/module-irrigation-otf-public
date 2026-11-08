import assert from 'node:assert/strict';
import test from 'node:test';
import { formatWaterVolumeForMessage } from '../lib/domain/irrigation-format.ts';
import type { IrrigationNeedPriority } from '../lib/domain/irrigation-needs.ts';
import type { PlanningInputs, SupplyBudget, WeeklyPlan } from '../lib/domain/planning/contract.ts';
import { buildWeeklyPlan } from '../lib/domain/planning/engine.ts';
import { arbitrationNote, budgetLevelsText } from '../lib/domain/planning/presentation.ts';
import { MILLISECONDS_PER_HOUR, cubicMetersFromMillimeters } from '../lib/domain/units.ts';
import { assertInvariants, byEquipment, close, farm, NOW, plannedIrrigation, settings } from './support/planning-fixtures.ts';

/**
 * Les scénarios de pénurie de la 3.9 (docs/shortage-contract.md), en
 * commençant par les règles que le porteur a tranchées le 30 octobre 2026
 * (D-052). Décision 1 : sous un arbitrage 3.4 validé, chaque allocation est
 * une part réservée, sans redistribution entre planches ; ce qu'une planche
 * allouée ne peut pas recevoir reste non attribué, et l'écran le dit.
 * Décision 2 : le budget d'une réserve retire d'abord le manque sous son
 * minimum de sécurité, et la ligne de budget montre la part visée et la part
 * placée de chaque niveau (docs/planning-contract.md, « Pénurie »).
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

test('la note de l’arbitrage se tait sous le litre et compte les planches au singulier comme au pluriel (décision 1)', () => {
  const arbitration = { allocatedCubicMeters: 2, reservedCubicMeters: 1.9995, unreceivedCubicMeters: 0.0009, unreceivedBedCount: 1 };
  assert.equal(arbitrationNote({ arbitration }), 'Votre choix entre les demandes d’eau s’impose : 2 m³ alloués, chaque allocation réservée à sa planche.');
  assert.equal(
    arbitrationNote({ arbitration: { ...arbitration, unreceivedCubicMeters: 0.16 } }),
    'Votre choix entre les demandes d’eau s’impose : 2 m³ alloués, chaque allocation réservée à sa planche. '
      + '0,16 m³ alloués à 1 planche ne peuvent pas être reçus : ils restent non attribués, sans redistribution entre planches.',
  );
  assert.equal(arbitrationNote({}), null);
});

// Décision 2 : le budget net du manque sous le minimum ; la part visée et la part placée.

/** Les heures d'apport du forage d'ici la fin de l'horizon, du mardi 12 h 52 au dimanche minuit à la ferme. */
const HORIZON_HOURS = (Date.parse('2026-10-04T22:00:00.000Z') - NOW.getTime()) / MILLISECONDS_PER_HOUR;
/** La réserve de la ferme de test, 25 m³ pour un minimum de sécurité de 40 m³, le forage à 0,2 m³/h (S3). */
const S3 = { stock: 25, minimum: 40, flow: 0.2 };
const withSafetyMinimum = (inputs: PlanningInputs, minimumSafetyCubicMeters: number): PlanningInputs => ({
  ...inputs,
  infrastructure: { ...inputs.infrastructure, reservoirs: inputs.infrastructure.reservoirs.map((reservoir) => ({ ...reservoir, minimumSafetyCubicMeters })) },
});
const belowMinimum = () => withSafetyMinimum(farm({ extraTunnels: true, forageFlow: S3.flow, reservoirCubicMeters: S3.stock }).inputs, S3.minimum);
/** L'eau utile placée sur les planches d'un niveau, comptée sur la surface que leur propre matériel mouille. */
const placedOnLevel = (plan: WeeklyPlan, priority: IrrigationNeedPriority) =>
  plan.beds.filter((bed) => bed.priority === priority).reduce((sum, bed) => sum + cubicMetersFromMillimeters(bed.placedMm, wettedAreaOf(bed.bedId)), 0);

test('S3, réserve sous son minimum : le budget retire d’abord le manque, et les parts se répartissent entre toutes les planches (décision 2)', () => {
  // Les 15 m³ manquants se comblent d'abord : il reste 0,2 × 131,1 h − 15 = 11,23 m³ pour 17,83 m³ demandés. Compter
  // zéro au lieu du manque annonçait 26,23 m³ et aucune pénurie : la garde arrêtait le placement, les tunnels 3 et 4
  // ne recevaient rien.
  const inputs = belowMinimum();
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  const [budget] = plan.budgets;
  const net = S3.stock - S3.minimum + S3.flow * HORIZON_HOURS;
  close(budget.availableCubicMeters, net, 1e-6, 'le budget net du manque sous le minimum');
  close(budget.fractions.normal, net / DEMAND_CUBIC_METERS, 1e-6, 'la part visée, prise sur ce budget');
  for (const bed of plan.beds) assert.ok(bed.placedMm > 1, `${bed.bedName} : ${bed.placedMm} mm, servie avec les autres`);
  assert.ok(placedVolume(plan) <= net + 1e-6, 'pas plus que le budget');
  // Aucun créneau avant l'heure où l'apport a comblé le manque (S3, « La garde de la réserve »).
  const filledAt = NOW.getTime() + (S3.minimum - S3.stock) / S3.flow * MILLISECONDS_PER_HOUR;
  for (const proposal of plan.proposals) assert.ok(Date.parse(proposal.startAt) >= filledAt - 1000, `${proposal.id} ${proposal.startAt} avant que la réserve soit à son minimum`);
});

test('la ligne de budget montre la part visée et la part placée de chaque niveau, « — » pour un niveau sans demande (décision 2)', () => {
  const plan = buildWeeklyPlan(belowMinimum(), settings);
  const [budget] = plan.budgets;
  assert.deepEqual(budget.demandByLevelCubicMeters && { ...budget.demandByLevelCubicMeters, normal: Math.round(budget.demandByLevelCubicMeters.normal * 1e4) / 1e4 }, { high: 0, normal: DEMAND_CUBIC_METERS, low: 0 });
  assert.ok(budget.placedByLevelCubicMeters);
  close(budget.placedByLevelCubicMeters.normal, placedOnLevel(plan, 'normal'), 1e-9, 'l’eau utile placée, comptée comme la demande');
  assert.equal(budgetLevelsText(budget), 'haute — · normale 63 % visés, 62 % placés · basse —');
});

test('S10, trois niveaux : la part visée de la conduite, la part placée à côté ; sous le report, une planche reportée compte zéro (décision 2)', () => {
  // Tunnels 1 et 2 en haute, blocs en normale, tunnels 3 et 4 en basse ; 12 m³ pour 17,83 m³ demandés.
  const { inputs } = farm({ extraTunnels: true, forageFlow: 0, reservoirCubicMeters: 12, priorities: { 'tunnel-1': 'high', 'tunnel-2': 'high', 'tunnel-3': 'low', 'tunnel-4': 'low' } });
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  const [budget] = plan.budgets;
  assert.deepEqual({ high: budget.fractions.high, low: budget.fractions.low }, { high: 1, low: 0 });
  close(budget.fractions.normal, (12 - 5.12) / 7.5878, 1e-9, 'la normale prend ce que la haute laisse');
  for (const level of ['high', 'normal', 'low'] as const) close(budget.placedByLevelCubicMeters?.[level] ?? null, placedOnLevel(plan, level), 1e-9, level);
  assert.match(budgetLevelsText(budget), /^haute 100 % visés, 100 % placés · normale 91 % visés, \d+ % placés · basse 0 % visés, 0 % placés$/);
  // Sous le report, la part visée d'un niveau est ce que la conduite sert au départ : une planche basse sur seize
  // tient dans ce qui reste, les quinze autres sont reportées. Les fractions restaient à 100 %.
  const deferSettings = { ...settings, shortageStrategy: 'defer' as const };
  const deferred = buildWeeklyPlan(inputs, deferSettings);
  assertInvariants(deferred, inputs, deferSettings);
  close(deferred.budgets[0].fractions.high, 1, 1e-9, 'la haute servie en entier');
  close(deferred.budgets[0].fractions.low, 1 / 16, 1e-9, 'une planche basse sur seize');
  assert.match(budgetLevelsText(deferred.budgets[0]), / · basse 6 % visés, \d+ % placés$/);
});

test('un stock au-dessus de son minimum garde le budget d’avant ; un calcul enregistré avant garde sa ligne d’avant (décision 2)', () => {
  const [above] = buildWeeklyPlan(farm().inputs, settings).budgets;
  close(above.availableCubicMeters, 30 + 0.511 * HORIZON_HOURS, 1e-6, 'minimum à zéro');
  const [withMinimum] = buildWeeklyPlan(withSafetyMinimum(farm({ reservoirCubicMeters: 25 }).inputs, 20), settings).budgets;
  close(withMinimum.availableCubicMeters, 25 - 20 + 0.511 * HORIZON_HOURS, 1e-6, 'stock au-dessus du minimum');
  const stored: SupplyBudget = { originKey: 'reservoir:reserve', originName: 'Réserve tampon', availableCubicMeters: 75.27, dailyLimitRemainingCubicMeters: null, demandCubicMeters: 82.7, fractions: { high: 1, normal: 0.91, low: 1 } };
  assert.equal(budgetLevelsText(stored), 'part réservée : haute 100 %, normale 91 %, basse 100 %');
});
