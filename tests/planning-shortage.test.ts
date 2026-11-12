import assert from 'node:assert/strict';
import test from 'node:test';
import { formatWaterVolumeForMessage } from '../lib/domain/irrigation-format.ts';
import type { IrrigationNeedPriority } from '../lib/domain/irrigation-needs.ts';
import type { PlanningInputs, SupplyBudget, WeeklyPlan } from '../lib/domain/planning/contract.ts';
import { buildWeeklyPlan } from '../lib/domain/planning/engine.ts';
import { nextDeferredQueue } from '../lib/domain/planning/shortage.ts';
import { arbitrationNote, budgetLevelsText, doseReasonLabel } from '../lib/domain/planning/presentation.ts';
import { MILLISECONDS_PER_HOUR, cubicMetersFromMillimeters, millimetersFromCubicMeters } from '../lib/domain/units.ts';
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
 * Décision 4 : sous le report, les planches reportées ne passent devant
 * qu'au calcul qui suit un événement ; sans événement, le calcul reproduit
 * le précédent (« Le report sans bascule »). Décision 5 : le dernier jour,
 * une part sous la dose minimale est placée tant qu'une plage reste, comme
 * un reste hors pénurie (« La part du dernier jour »).
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

test('S10, trois niveaux : la part visée de la conduite, la part placée à côté, le motif de la basse et aucun sur la haute ; sous le report, une planche reportée compte zéro (décision 2)', () => {
  // Tunnels 1 et 2 en haute, blocs en normale, tunnels 3 et 4 en basse ; 12 m³ pour 17,83 m³ demandés.
  const { inputs } = farm({ extraTunnels: true, forageFlow: 0, reservoirCubicMeters: 12, priorities: { 'tunnel-1': 'high', 'tunnel-2': 'high', 'tunnel-3': 'low', 'tunnel-4': 'low' } });
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  const [budget] = plan.budgets;
  assert.deepEqual({ high: budget.fractions.high, low: budget.fractions.low }, { high: 1, low: 0 });
  close(budget.fractions.normal, (12 - 5.12) / 7.5878, 1e-9, 'la normale prend ce que la haute laisse');
  for (const level of ['high', 'normal', 'low'] as const) close(budget.placedByLevelCubicMeters?.[level] ?? null, placedOnLevel(plan, level), 1e-9, level);
  assert.match(budgetLevelsText(budget), /^haute 100 % visés, 100 % placés · normale 91 % visés, \d+ % placés · basse 0 % visés, 0 % placés$/);
  // La basse porte « stock et ressources insuffisants d'ici dimanche », et rien d'autre ; la haute, servie en entier, aucun motif.
  for (const bed of plan.beds.filter((item) => item.priority === 'low')) assert.deepEqual(bed.reasons, ['water-budget'], bed.bedName);
  for (const bed of plan.beds.filter((item) => item.priority === 'high')) assert.deepEqual([bed.reasons, bed.deficitMm], [[], 0], bed.bedName);
  assert.ok(placedVolume(plan) <= 12 + 1e-6, `${placedVolume(plan)} m³ placés pour 12 m³`);
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

// Décision 4 : le report sans bascule d'un calcul à l'autre.

/** S12 : les données de S10 — tunnels 1 et 2 en haute, blocs en normale, tunnels 3 et 4 en basse, 12 m³ pour 17,83 m³ —, sous le report. */
const deferSettings = { ...settings, shortageStrategy: 'defer' as const };
const s12 = () => farm({ extraTunnels: true, forageFlow: 0, reservoirCubicMeters: 12, priorities: { 'tunnel-1': 'high', 'tunnel-2': 'high', 'tunnel-3': 'low', 'tunnel-4': 'low' } }).inputs;
/** Les planches qu'un calcul a reportées, dans l'ordre de l'inventaire. */
const deferredBeds = (plan: WeeklyPlan) => plan.beds.filter((bed) => bed.reasons.includes('deferred')).map((bed) => bed.bedId);
/** Le plan tel que le maraîcher le lit : chaque créneau, son matériel, ses heures et sa dose. */
const slots = (plan: WeeklyPlan) => plan.proposals.map((proposal) => [proposal.equipmentId, proposal.startAt, proposal.endAt, proposal.doseMm]);

test('S12 sur deux calculs, sans événement : le second reproduit le premier, les reportées le restent (décision 4)', () => {
  // Aujourd'hui, le second calcul servait d'abord les reportées et reportait les premières : le plan basculait.
  const inputs = s12();
  const first = buildWeeklyPlan(inputs, deferSettings);
  assert.ok(deferredBeds(first).length > 0, 'des planches sont reportées');
  const second = buildWeeklyPlan({ ...inputs, deferredBedIds: nextDeferredQueue(first, false) }, deferSettings);
  assertInvariants(second, inputs, deferSettings);
  assert.deepEqual(deferredBeds(second), deferredBeds(first), 'les mêmes planches reportées');
  assert.deepEqual(slots(second), slots(first), 'les mêmes créneaux');
});

test('S12 sur deux calculs, après un événement : les reportées passent devant, et la file se garde jusqu’au suivant (décision 4)', () => {
  const inputs = s12();
  const first = buildWeeklyPlan(inputs, deferSettings);
  const queue = nextDeferredQueue(first, true);
  assert.deepEqual(queue, deferredBeds(first), 'après un événement, la file : les reportées du calcul précédent');
  const afterEvent = buildWeeklyPlan({ ...inputs, deferredBedIds: queue }, deferSettings);
  assertInvariants(afterEvent, inputs, deferSettings);
  assert.deepEqual(afterEvent.deferredQueue, queue, 'le plan retient la file qu’il a suivie');
  for (const bedId of queue) assert.ok(!deferredBeds(afterEvent).includes(bedId), `${bedId} passe devant`);
  assert.ok(deferredBeds(afterEvent).length > 0, 'le budget ne suffit toujours pas : d’autres attendent');
  // Sans nouvel événement, le calcul suivant garde la file : il reproduit le plan d'après l'événement, sans revenir au premier.
  const next = buildWeeklyPlan({ ...inputs, deferredBedIds: nextDeferredQueue(afterEvent, false) }, deferSettings);
  assert.deepEqual(next.deferredQueue, queue);
  assert.deepEqual(deferredBeds(next), deferredBeds(afterEvent));
  assert.deepEqual(slots(next), slots(afterEvent));
});

test('la file est vide au premier calcul de la semaine, et après un calcul enregistré avant la correction faute d’événement (décision 4)', () => {
  assert.deepEqual(nextDeferredQueue(null, true), []);
  assert.deepEqual(nextDeferredQueue(null, false), []);
  const first = buildWeeklyPlan(s12(), deferSettings);
  assert.equal(first.deferredQueue, undefined, 'une file vide ne s’enregistre pas');
  // Un calcul enregistré avant la correction n'a pas de file : sans événement, le calcul suivant part d'une file vide.
  const stored = { beds: first.beds };
  assert.deepEqual(nextDeferredQueue(stored, false), []);
  assert.deepEqual(nextDeferredQueue(stored, true), deferredBeds(first));
});

/** Samedi 22 h 30 à la ferme : la nuit de samedi reste, celle de dimanche vient après. */
const SATURDAY_22H30 = new Date('2026-10-03T20:30:00.000Z');
/** La part de chaque planche quand la réserve n'a que 26 % de la demande, au-dessus des 5 mm de l'aspersion. */
const SUNDAY_SHARE_MM = NEED_MM * 0.26;
/**
 * La ferme du point 36 à 26 % de sa demande : les rampes du tunnel 1 et du bloc 2 versent aussi sur le bloc 1 à
 * 2 mm/h, et ce débordement fait passer ce que leurs parts paient sous la dose minimale de l'aspersion. Sous
 * arbitrage, chaque planche reçoit la même part en allocation, la réserve égale aux allocations.
 */
function sundayFarm(now: Date, arbitrated = false): PlanningInputs {
  const { inputs } = farm({
    extraTunnels: true,
    forageFlow: 0,
    reservoirCubicMeters: DEMAND_CUBIC_METERS * 0.26,
    now,
    edges: [
      { equipmentId: 'rampe-tunnel-1', bedIds: ['B1-0', 'B1-1'], rateMmPerHour: 2 },
      { equipmentId: 'rampe-bloc-2', bedIds: ['B1-2', 'B1-3'], rateMmPerHour: 2 },
    ],
  });
  return arbitrated ? { ...inputs, arbitration: arbitrationOf(inputs, () => SUNDAY_SHARE_MM) } : inputs;
}
/** Les deux rampes qui débordent, et la parcelle de chacune. */
const SPILLING = [['rampe-tunnel-1', 'Tunnel 1'], ['rampe-bloc-2', 'bloc 2']] as const;

/** Une part sous la dose minimale : rien en semaine ; dimanche soir, un seul créneau, à ce que les parts paient. */
function assertPlacedOnSunday(plan: WeeklyPlan) {
  const minimum = settings.doses.sprinkler.minimumMm;
  for (const [equipmentId, plotName] of SPILLING) {
    for (const bed of plot(plan, plotName)) {
      // Sa part entière, que l'attente de la redistribution faisait fondre, moins ce que son créneau verse à côté.
      close(bed.targetMm, SUNDAY_SHARE_MM, 0.01, `${bed.bedName} : sa part`);
      assert.ok(bed.placedMm > 4.7 && bed.placedMm < minimum, `${bed.bedName} : ${bed.placedMm} mm, sous la dose minimale`);
    }
    const proposals = byEquipment(plan, equipmentId);
    assert.equal(proposals.length, 1, `${equipmentId} : un créneau`);
    const [proposal] = proposals;
    assert.ok(proposal.startAt >= '2026-10-04T19:00:00.000Z', `${equipmentId} : la nuit de dimanche, ${proposal.startAt}`);
    assert.equal(proposal.justification.doseReason, 'reserved-share');
    assert.equal(proposal.justification.limitingConstraint, 'part de la semaine atteinte, le reste est réservé aux autres planches');
  }
}

test('S18, une part sous la dose minimale : le matériel attend en semaine et le samedi ; dimanche, sa part est placée, comme un reste hors pénurie (décision 5)', () => {
  for (const now of [NOW, SATURDAY_22H30]) {
    const inputs = sundayFarm(now);
    const plan = buildWeeklyPlan(inputs, settings);
    assertInvariants(plan, inputs);
    for (const [equipmentId] of SPILLING) assert.equal(byEquipment(plan, equipmentId).length, 0, `${now.toISOString()} : ${equipmentId} attend une part plus grande`);
  }
  // Aujourd'hui, le dimanche, les deux rampes ne partaient qu'après les tours, leur part fondue à 2,3 mm, et 1,1 m³
  // restait dans la réserve.
  const inputs = sundayFarm(new Date(SUNDAY_00H30));
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  assertPlacedOnSunday(plan);
  const [budget] = plan.budgets;
  assert.ok(budget.availableCubicMeters !== null);
  close(placedVolume(plan), budget.availableCubicMeters, 0.01, 'rien ne reste dans la réserve : la somme des volumes est le budget');
});

test('S18 sous arbitrage : une allocation que son débordement fait passer sous la dose minimale attend en semaine ; dimanche, elle est placée au lieu de rester non attribuée (décision 5)', () => {
  const midweek = buildWeeklyPlan(sundayFarm(NOW, true), settings);
  for (const [equipmentId] of SPILLING) assert.equal(byEquipment(midweek, equipmentId).length, 0, `${equipmentId} attend`);
  assert.equal(midweek.arbitration?.unreceivedBedCount, 18, 'en semaine, le tunnel 1 et le bloc 2 attendent');
  // Aujourd'hui, le dimanche, 2,12 m³ alloués à dix-huit planches restaient non attribués.
  const inputs = sundayFarm(new Date(SUNDAY_00H30), true);
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  assertPlacedOnSunday(plan);
  assert.ok(plan.arbitration);
  assert.equal(plan.arbitration.unreceivedBedCount, 0);
  close(plan.arbitration.unreceivedCubicMeters, 0, 0.001, 'rien ne reste non attribué');
  assert.equal(arbitrationNote(plan), `Votre choix entre les demandes d’eau s’impose : ${formatWaterVolumeForMessage(plan.arbitration.allocatedCubicMeters)} m³ alloués, chaque allocation réservée à sa planche.`);
});

// ---------------------------------------------------------------------------
// Le motif de la dose en pénurie (point ouvert 61, D-092)
// ---------------------------------------------------------------------------

/** Les quatre tunnels seuls, le forage à l'arrêt : chaque rampe n'arrose que ses huit planches, rien ne déborde. */
const tunnelsFarm = (reservoirCubicMeters: number) => farm({
  extraTunnels: true, forageFlow: 0, reservoirCubicMeters,
  plotNeeds: { 'bloc-1': { rawPlanningNeedMm: 0, effectiveNeedMm: 0 }, 'bloc-2': { rawPlanningNeedMm: 0, effectiveNeedMm: 0 } },
}).inputs;
const SHARE_REASON = 'la part de la semaine réservée à ses planches';
const SHARE_CONSTRAINT = 'part de la semaine atteinte, le reste est réservé aux autres planches';

/** Chaque rampe de tunnel dit que sa dose est la part ; la contrainte du moment passe d'abord, la pompe pour celle qui l'attend. */
function assertSharedDoses(plan: WeeklyPlan, expectedMm: number) {
  const tunnels = plan.proposals.filter((proposal) => proposal.equipmentId.startsWith('rampe-tunnel-'));
  assert.equal(tunnels.length, 4);
  for (const { equipmentId, doseMm, justification } of tunnels) {
    close(doseMm, expectedMm, 0.01, `${equipmentId} : sa part`);
    assert.equal(justification.doseReason, 'shortage-share', equipmentId);
    assert.equal(doseReasonLabel(justification.doseReason), SHARE_REASON);
    if (['earliest', 'window'].includes(justification.timingReason)) assert.equal(justification.limitingConstraint, SHARE_CONSTRAINT, equipmentId);
  }
}

test('point ouvert 61 : en pénurie, une rampe que ses parts ne coupent pas dit que sa dose est la part de la semaine, non le besoin restant ; hors pénurie, le besoin restant (D-092)', () => {
  // 5 m³ pour quatre tunnels à 20 mm : 9,77 mm chacun, qui se disaient « le besoin restant de la planche la plus demandeuse ».
  const inputs = tunnelsFarm(5);
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  assertSharedDoses(plan, millimetersFromCubicMeters(5, 4 * 8 * 16));
  // Hors pénurie, la cible est le besoin : la dose maximale, puis le besoin restant.
  const ample = tunnelsFarm(30);
  const full = buildWeeklyPlan(ample, settings);
  assertInvariants(full, ample);
  const reasons = [...new Set(full.proposals.map((proposal) => proposal.justification.doseReason))].sort();
  assert.deepEqual(reasons, ['maximum-dose', 'remaining-need'], 'hors pénurie, aucune part');
});

test('point ouvert 61 sous un arbitrage : une allocation sous le besoin se dit part de la semaine (D-092)', () => {
  const base = tunnelsFarm(5);
  const inputs: PlanningInputs = { ...base, arbitration: arbitrationOf(base, tunnelsOnly(9)) };
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  assertSharedDoses(plan, 9);
});
