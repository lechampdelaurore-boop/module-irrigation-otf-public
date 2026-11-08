import assert from 'node:assert/strict';
import test from 'node:test';
import { formatWaterVolumeForMessage } from '../lib/domain/irrigation-format.ts';
import type { StoredWeeklyPlan, WeeklyPlan } from '../lib/domain/planning/contract.ts';
import { buildWeeklyPlan } from '../lib/domain/planning/engine.ts';
import { waterDeficitExplanation } from '../lib/domain/planning/presentation.ts';
import { assertInvariants, byEquipment, close, farm, plannedIrrigation, settings } from './support/planning-fixtures.ts';

/**
 * La part réservée en pénurie (docs/planning-contract.md, « Pénurie », D-037,
 * point ouvert 36) et la note du manque d'eau (D-038) : chaque planche d'une
 * chaîne reçoit sa part, la dernière examinée comme la première ; le
 * débordement d'un créneau se prend sur les parts de ses propres planches ;
 * ce qu'une planche ne peut pas recevoir est libéré et redistribué ; l'écart
 * entre « demandé moins placé » et le manque d'eau est expliqué, pas corrigé.
 */

/** La demande de la ferme à quatre tunnels : 1,98 m³ du bloc 1, 5,608 m³ du bloc 2, 10,24 m³ des tunnels. */
const DEMAND_CUBIC_METERS = 17.8278;
/** La fraction servie quand la réserve n'a que 30 % de la demande. */
const SHARE = 0.3;
const NEED_MM = 20;
/** Dimanche 0 h 30 et 1 h 30 à la ferme. */
const SUNDAY_00H30 = '2026-10-03T22:30:00.000Z';
const SUNDAY_01H30 = '2026-10-03T23:30:00.000Z';

/**
 * La ferme en pénurie, avec deux rampes qui arrosent aussi des planches du
 * bloc 1 à 2 mm/h sans les commander (D-025) : la rampe du tunnel 1 mouille
 * B1-0 et B1-1, la rampe du bloc 2 mouille B1-2 et B1-3.
 */
function shortage() {
  return farm({
    extraTunnels: true,
    forageFlow: 0,
    reservoirCubicMeters: DEMAND_CUBIC_METERS * SHARE,
    edges: [
      { equipmentId: 'rampe-tunnel-1', bedIds: ['B1-0', 'B1-1'], rateMmPerHour: 2 },
      { equipmentId: 'rampe-bloc-2', bedIds: ['B1-2', 'B1-3'], rateMmPerHour: 2 },
    ],
  });
}

const plot = (plan: WeeklyPlan, plotName: string) => plan.beds.filter((bed) => bed.plotName === plotName);
const placedVolume = (plan: WeeklyPlan) => plan.proposals.reduce((sum, proposal) => sum + (proposal.volumeCubicMeters ?? 0), 0);
const tunnelBeds = (tunnel: number) => Array.from({ length: 8 }, (_, index) => `T${tunnel}-${index + 1}`);

/** Le plan tel que le registre le garde, toutes les propositions du même calcul, proposées. */
function stored(plan: WeeklyPlan): StoredWeeklyPlan {
  const calculationId = 'calcul-1';
  return {
    calculation: {
      id: calculationId, season: 2026, weekStart: plan.weekStart, trigger: 'manual', triggerEvent: null, computedAt: plan.computedAt,
      horizonStartAt: plan.horizonStartAt, horizonEndAt: plan.horizonEndAt, settings: plan.settings,
      summary: { beds: plan.beds, deficit: plan.deficit, budgets: plan.budgets, assumptions: plan.assumptions, weekEnd: plan.weekEnd, suggestions: plan.suggestions, overcommittedDays: plan.overcommittedDays, changes: null },
    },
    proposals: plan.proposals.map((proposal) => ({
      ...proposal, storedId: `stored-${proposal.id}`, calculationId, calculatedAt: plan.computedAt, status: 'proposed',
      validatedEventId: null, irrigationStatus: null, replacedByCalculationId: null, decidedAt: null, actorUserId: null,
    })),
    suggestions: [],
    pendingEvent: null,
  };
}

test('la dernière planche examinée reçoit sa part comme la première ; le débordement d’un créneau se prend sur les parts de ses propres planches (D-037)', () => {
  const { inputs } = shortage();
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  const budget = plan.budgets[0];
  close(budget.fractions.normal, SHARE, 0.001, 'fraction');
  // Les tunnels 2, 3 et 4 — le 4 examiné en dernier — reçoivent leur part entière : 6 mm.
  for (const tunnel of ['Tunnel 2', 'Tunnel 3', 'Tunnel 4']) {
    for (const bed of plot(plan, tunnel)) close(bed.placedMm, NEED_MM * SHARE, 0.05, bed.bedName);
  }
  // La rampe du bloc 2 arrose B1-2 et B1-3 à côté, déjà servies par gag1 : ce débordement se prend sur la part du
  // bloc 2, dont le créneau est raccourci — 5,68 mm au lieu de 6 — et le dit.
  for (const bed of plot(plan, 'bloc 2')) {
    assert.ok(bed.placedMm > 5.5 && bed.placedMm < NEED_MM * SHARE - 0.05, `${bed.bedName} : ${bed.placedMm} mm, sous sa part par son propre débordement`);
    assert.ok(bed.reasons.includes('water-budget'), `${bed.bedName} : le motif de la coupe de la chaîne`);
  }
  const [bloc2] = byEquipment(plan, 'rampe-bloc-2');
  assert.equal(bloc2.justification.doseReason, 'reserved-share');
  assert.equal(bloc2.justification.limitingConstraint, 'part de la semaine atteinte, le reste est réservé aux autres planches');
  // Le tunnel 1, de même, pour B1-0 et B1-1.
  for (const bed of plot(plan, 'Tunnel 1')) assert.ok(bed.placedMm > 5.3 && bed.placedMm < NEED_MM * SHARE - 0.05, `${bed.bedName} : ${bed.placedMm} mm`);
  // Le bloc 1 reçoit sa part de gag1 et gag2 ; le surplus des rampes n'est pas un besoin couvert.
  for (const bed of plot(plan, 'bloc 1')) close(bed.placedMm, NEED_MM * SHARE, 0.05, bed.bedName);
  // La somme des volumes est le budget, à un arrondi à la seconde près.
  assert.ok(budget.availableCubicMeters !== null);
  close(placedVolume(plan), budget.availableCubicMeters, 0.01, 'volume total');
});

test('ce qu’une planche ne peut pas recevoir est libéré en fin de tour et redistribué par la conduite à celles qui le peuvent encore (D-037)', () => {
  // Tunnels 2 et 3 : une irrigation planifiée dimanche à 0 h 30, l'espacement repousse tout arrosage après la semaine.
  const { inputs } = farm({
    extraTunnels: true,
    forageFlow: 0,
    reservoirCubicMeters: 5.12,
    priorities: { 'bloc-1': 'low', 'bloc-2': 'low' },
    events: [
      plannedIrrigation('planifiee-t2', 'rampe-tunnel-2', SUNDAY_00H30, SUNDAY_01H30, tunnelBeds(2)),
      plannedIrrigation('planifiee-t3', 'rampe-tunnel-3', SUNDAY_00H30, SUNDAY_01H30, tunnelBeds(3)),
    ],
  });
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  const budget = plan.budgets[0];
  assert.ok(budget.availableCubicMeters !== null && budget.fractions.normal <= 0.5 + 1e-6 && budget.fractions.low === 0, 'les tunnels à moitié au plus, le plein champ à rien');
  for (const tunnel of ['Tunnel 2', 'Tunnel 3']) {
    for (const bed of plot(plan, tunnel)) {
      assert.equal(bed.placedMm, 0, bed.bedName);
      assert.ok(bed.reasons.includes('spacing'), `${bed.bedName} : espacement`);
    }
  }
  // Leur part libérée va aux tunnels 1 et 4, encore sous leur besoin, qui la reçoivent une seconde nuit.
  for (const tunnel of ['Tunnel 1', 'Tunnel 4']) {
    for (const bed of plot(plan, tunnel)) assert.ok(bed.placedMm > 15, `${bed.bedName} : ${bed.placedMm} mm, plus que sa part de départ`);
  }
  assert.equal(byEquipment(plan, 'rampe-tunnel-1').length, 2, 'deux nuits');
  // Le plein champ, de priorité basse, ne reçoit rien tant que les tunnels manquent.
  for (const plotName of ['bloc 1', 'bloc 2']) {
    for (const bed of plot(plan, plotName)) assert.equal(bed.placedMm, 0, bed.bedName);
  }
  close(placedVolume(plan), budget.availableCubicMeters, 0.05, 'tout le budget est placé');
});

test('la note du manque d’eau explique l’écart entre demandé, placé et manque sur le plan enregistré, sans changer le calcul (D-038)', () => {
  const { inputs } = shortage();
  const plan = buildWeeklyPlan(inputs, settings);
  const demanded = plan.budgets.reduce((sum, budget) => sum + budget.demandCubicMeters, 0);
  const placed = placedVolume(plan);
  const counted = Object.values(plan.deficit.byReason).reduce((sum, value) => sum + value, 0);
  // Le manque se compte planche par planche, sur la surface que son matériel mouille : il diffère de « demandé moins
  // placé » de l'eau versée à côté — le surplus des rampes sur le bloc 1 — et le calcul ne le corrige pas.
  assert.ok(plan.deficit.waterCubicMeters > demanded - placed + 0.1, `manque d’eau ${plan.deficit.waterCubicMeters} m³, demandé moins placé ${demanded - placed} m³`);
  close(counted, plan.deficit.waterCubicMeters, 1e-6, 'tout le manque est un manque d’eau');
  const beside = placed - (demanded - counted);
  assert.ok(beside > 0.1 && beside < 0.2, `${beside} m³ placés à côté`);
  const note = waterDeficitExplanation(stored(plan));
  assert.ok(note !== null, 'une note explique l’écart');
  const expected = `Demandés ${formatWaterVolumeForMessage(demanded)} m³, placés ${formatWaterVolumeForMessage(placed)} m³, manque d’eau ${formatWaterVolumeForMessage(plan.deficit.waterCubicMeters)} m³ : l’écart tient à ${formatWaterVolumeForMessage(beside)} m³ placés sans couvrir de besoin compté`;
  assert.ok(note.startsWith(expected), `${note}\n  devrait commencer par\n${expected}`);
  assert.doesNotMatch(note, /autre raison que l’eau/, 'rien ne manque pour une autre raison');
});

test('la note se tait sur le résidu d’arrondi des secondes que le moteur tient pour reçu (D-040, point 41)', () => {
  // 5,12256 m³ pour les 10,24 m³ des tunnels : 10,005 mm par planche, 3 601,8 s à 10 mm/h et 1 800,9 s à 20 mm/h,
  // coupées à la seconde entière ; le reste, sous un centième de millimètre, est tenu pour reçu.
  const { inputs } = farm({ extraTunnels: true, forageFlow: 0, reservoirCubicMeters: 5.12256, priorities: { 'bloc-1': 'low', 'bloc-2': 'low' } });
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  const demanded = plan.budgets.reduce((sum, budget) => sum + budget.demandCubicMeters, 0);
  const counted = Object.values(plan.deficit.byReason).reduce((sum, value) => sum + value, 0);
  const beside = placedVolume(plan) - (demanded - counted);
  assert.ok(beside < -0.001 && beside > -0.00512, `${beside} m³ : un résidu d’arrondi entre un litre et un centième de millimètre sur 512 m²`);
  assert.equal(waterDeficitExplanation(stored(plan)), null);
});
