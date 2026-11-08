import assert from 'node:assert/strict';
import test from 'node:test';
import type { BedIrrigationNeed, IrrigationNeedPriority } from '../lib/domain/irrigation-needs.ts';
import type { PlanningInputs } from '../lib/domain/planning/contract.ts';
import { buildWeeklyPlan } from '../lib/domain/planning/engine.ts';
import { cubicMetersFromMillimeters, MILLISECONDS_PER_DAY } from '../lib/domain/units.ts';
import { splitVolumeAcrossLocalDays } from '../lib/domain/water-management.ts';
import { assertInvariants, BLOC_2, byEquipment, close, farm, largeFarm, NOW, PARIS_21H_TUESDAY, PARIS_21H_WEDNESDAY, plannedIrrigation, realIrrigation, settings, TZ } from './support/planning-fixtures.ts';

/**
 * Le moteur sur la ferme de test aux chiffres de la ferme réelle
 * (tests/support/planning-fixtures.ts) : les scénarios du contrat, les
 * invariants sur des semaines tirées au hasard, les chiffres de la ferme, le
 * budget de temps et les points ouverts corrigés.
 */

// Budget du calcul d'une semaine complète sur la grande ferme, en temps réel : une garde contre une
// régression de complexité du moteur, non une mesure de confort (D-027 ; 500 ms depuis D-031). Le calcul
// dure 209 à 237 ms sur le poste du porteur et 101 ms sur les machines partagées de GitHub (5 octobre 2026).
const WEEKLY_PLAN_BUDGET_MS = 500;

test('semaine ordinaire : tout est placé, aux doses tranchées, sous la pompe et dans les plages', () => {
  const { inputs } = farm({
    events: [
      realIrrigation('tunnel-1-matin', 'rampe-tunnel-1', '2026-09-29T04:00:00.000Z', Array.from({ length: 8 }, (_, i) => `T1-${i + 1}`), 10, 10, 'sprinkler'),
      realIrrigation('gag1-matin', 'gag1', '2026-09-29T05:00:00.000Z', ['B1-0', 'B1-1', 'B1-2', 'B1-3'], 14, 14),
    ],
    plotNeeds: { 'tunnel-1': { rawPlanningNeedMm: 10, actualIrrigationMm: 10, realRemainingMm: 10, calculatedNeedMm: 10, effectiveNeedMm: 10 } },
    needs: Object.fromEntries(['B1-0', 'B1-1', 'B1-2', 'B1-3'].map((id) => [id, { rawPlanningNeedMm: 6, actualIrrigationMm: 14, realRemainingMm: 6, calculatedNeedMm: 6, effectiveNeedMm: 6 }])),
  });
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  assert.equal(plan.deficit.waterCubicMeters, 0);
  assert.equal(plan.deficit.pumpTimeCubicMeters, 0);
  assert.ok(plan.beds.every((bed) => bed.deficitMm < 1e-6), 'aucun déficit');

  // Rampe du bloc 2 : 15 mm en 2 h 15 mardi soir, 5 mm en 45 min mercredi soir (« Valeurs exactes »).
  const bloc2 = byEquipment(plan, 'rampe-bloc-2');
  assert.equal(bloc2.length, 2);
  close(bloc2[0].doseMm, 15, 0.01, 'dose 1');
  assert.ok(Math.abs(bloc2[0].durationSeconds - 8100) <= 1, 'deux heures et quart, à la seconde d’arrondi près');
  close(bloc2[0].volumeCubicMeters, 4.205, 0.01, 'volume 1');
  assert.equal(bloc2[0].startAt, PARIS_21H_TUESDAY, 'mardi 21 h, la plage de l’aspersion');
  assert.equal(bloc2[0].justification.doseReason, 'maximum-dose');
  close(bloc2[1].doseMm, 5, 0.01, 'dose 2');
  assert.equal(bloc2[1].durationSeconds, 2700);
  close(bloc2[1].volumeCubicMeters, 1.402, 0.01, 'volume 2');
  assert.equal(bloc2[1].startAt, PARIS_21H_WEDNESDAY, 'mercredi 21 h : 24 h au moins entre deux débuts');
  assert.equal(bloc2[1].justification.timingReason, 'spacing');

  // Rampe de serre du tunnel 2 : 15 mm en 45 min, puis 5 mm en 15 min.
  const tunnel2 = byEquipment(plan, 'rampe-tunnel-2');
  assert.deepEqual(tunnel2.map((p) => p.durationSeconds), [2700, 900]);
  close(tunnel2[0].volumeCubicMeters, 1.92, 0.001);
  close(tunnel2[1].volumeCubicMeters, 0.64, 0.001);
  assert.equal(tunnel2[0].startAt, PARIS_21H_TUESDAY, 'en parallèle du bloc 2 : 1,87 + 2,56 < 8');

  // Tunnel 1 arrosé ce matin à 6 h : 10 mm restants, pas avant mercredi 6 h.
  const tunnel1 = byEquipment(plan, 'rampe-tunnel-1');
  assert.equal(tunnel1.length, 1);
  close(tunnel1[0].doseMm, 10, 0.01);
  assert.equal(tunnel1[0].durationSeconds, 3600);
  close(tunnel1[0].volumeCubicMeters, 1.28, 0.001);
  assert.ok(Date.parse(tunnel1[0].startAt) >= Date.parse('2026-09-30T04:00:00.000Z'), 'espacement de 24 h après 6 h mardi');

  // gag1 arrosé 14 mm ce matin : 6 mm restants en 26 min, pas avant mercredi 7 h.
  const gag1 = byEquipment(plan, 'gag1');
  assert.equal(gag1.length, 1);
  assert.equal(gag1[0].durationSeconds, 1543);
  close(gag1[0].volumeCubicMeters, 0.396, 0.001);
  assert.ok(Date.parse(gag1[0].startAt) >= Date.parse('2026-09-30T05:00:00.000Z'));

  // gag2 : 20 mm en deux fois 10 mm, 43 min et 0,33 m³ chacune, le premier dès maintenant.
  const gag2 = byEquipment(plan, 'gag2');
  assert.deepEqual(gag2.map((p) => p.durationSeconds), [2571, 2571]);
  close(gag2[0].volumeCubicMeters, 0.33, 0.001);
  assert.equal(gag2[0].startAt, '2026-09-29T10:52:00.000Z', 'goutte-à-goutte : dans sa plage, au plus tôt');
  assert.equal(gag2[0].justification.timingReason, 'earliest');
  assert.ok(gag2.every((p) => p.justification.hydraulicallyVerified));
  assert.equal(gag2[0].justification.supply?.originName, 'Réserve tampon');
});

test('pluie prévue : les planches de plein champ attendent le lendemain de la pluie, pas les tunnels', () => {
  const { inputs } = farm({
    forecast: { '2026-10-01': 12 },
    plotNeeds: { 'bloc-1': { rawPlanningNeedMm: 8, forecastRainMm: 12 }, 'bloc-2': { rawPlanningNeedMm: 8, forecastRainMm: 12 } },
  });
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  const bloc2 = byEquipment(plan, 'rampe-bloc-2');
  assert.equal(bloc2.length, 1);
  close(bloc2[0].doseMm, 8, 0.01);
  assert.equal(bloc2[0].startAt, '2026-10-02T19:00:00.000Z', 'vendredi 21 h : après la pluie de jeudi');
  assert.equal(bloc2[0].justification.timingReason, 'after-forecast-rain');
  assert.equal(byEquipment(plan, 'rampe-tunnel-2')[0].startAt, PARIS_21H_TUESDAY, 'sous abri, la pluie n’attend rien');

  // R2 à 50 % : la moitié de la pluie prévue revient dans le besoin.
  const half = buildWeeklyPlan(inputs, { ...settings, forecastRainShare: 0.5 });
  close(byEquipment(half, 'rampe-bloc-2')[0].doseMm, 14, 0.01, 'dose avec 50 % de pluie prévue');
});

test('manque d’eau : prioritaires servies en entier, les autres à part égale, déficit exact', () => {
  const { inputs } = farm({ reservoirCubicMeters: 2, forageFlow: 0.03, priorities: { 'tunnel-1': 'high', 'tunnel-2': 'high' } });
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  const budget = plan.budgets[0];
  // 2 m³ de stock et 0,03 m³/h sur 131 h : 5,9 m³ pour 12,1 m³ demandés, dont 5,12 en priorité haute.
  close(budget.availableCubicMeters, 2 + 0.03 * ((Date.parse(plan.horizonEndAt) - inputs.now.getTime()) / 3_600_000), 0.01, 'budget');
  assert.equal(budget.fractions.high, 1, 'les tunnels sont servis en entier');
  assert.ok(budget.fractions.normal > 0 && budget.fractions.normal < 1, 'le bloc 2 et les gag à part égale');
  assert.equal(budget.fractions.low, 1, 'aucune planche basse : fraction sans objet');
  const placed = plan.proposals.reduce((sum, p) => sum + (p.volumeCubicMeters ?? 0), 0);
  assert.ok(placed <= (budget.availableCubicMeters ?? 0) + 1e-6, 'pas plus placé que le budget');
  assert.ok(plan.deficit.waterCubicMeters > 0);
  const normals = plan.beds.filter((bed) => bed.priority === 'normal' && bed.needMm > 0);
  assert.ok(normals.every((bed) => bed.reasons.includes('water-budget')));
  const fractions = new Set(normals.map((bed) => Math.round(bed.targetMm / bed.needMm * 1000)));
  assert.equal(fractions.size, 1, 'même fraction pour chaque planche normale');
  for (const bed of plan.beds.filter((b) => b.priority === 'high')) assert.ok(bed.deficitMm < 1e-6, `${bed.bedName} servie`);

  const equal = buildWeeklyPlan(inputs, { ...settings, shortageStrategy: 'equal-share' });
  assert.ok(equal.budgets[0].fractions.high < 1 && equal.budgets[0].fractions.high === equal.budgets[0].fractions.normal, 'part égale pour toutes');

  const defer = buildWeeklyPlan(inputs, { ...settings, shortageStrategy: 'defer' });
  assertInvariants(defer, inputs);
  assert.ok(defer.beds.some((bed) => bed.reasons.includes('deferred')), 'des planches sont reportées');
  assert.ok(defer.beds.filter((bed) => bed.priority === 'high').every((bed) => bed.deficitMm < 1e-6));
});

test('restriction : aucun jour ne dépasse la limite journalière, réalisé compris, et le manque est nommé', () => {
  const { inputs } = farm({ dailyLimit: 3 });
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  const shortened = plan.proposals.find((p) => p.justification.doseReason === 'daily-limit');
  assert.ok(shortened, 'un créneau a été raccourci par la limite');
  assert.equal(shortened?.justification.limitingConstraint, 'limite journalière d’irrigation atteinte');

  const tight = farm({ dailyLimit: 1 });
  const short = buildWeeklyPlan(tight.inputs, settings);
  assertInvariants(short, tight.inputs);
  assert.ok(short.deficit.waterCubicMeters > 0, 'six jours à 1 m³ ne couvrent pas 10 m³');
  assert.equal(short.budgets[0].dailyLimitRemainingCubicMeters, 6);
});

test('pompe saturée : les rampes de serre se succèdent sous 8 m³/h, jamais quatre à la fois', () => {
  const { inputs } = farm({ extraTunnels: true, plotNeeds: { 'bloc-1': { rawPlanningNeedMm: 0, effectiveNeedMm: 0 }, 'bloc-2': { rawPlanningNeedMm: 0, effectiveNeedMm: 0 } } });
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  const firstNight = plan.proposals.filter((p) => p.startAt.startsWith('2026-09-29T'));
  assert.ok(firstNight.length >= 3, 'au moins trois rampes la première nuit');
  assert.ok(plan.proposals.some((p) => p.justification.timingReason === 'pump-capacity' || p.justification.doseReason === 'pump-gap'), 'une rampe a attendu la pompe');
  assert.equal(plan.deficit.pumpTimeCubicMeters, 0, 'la semaine suffit à tout enchaîner');
});

test('arrosage partiel : le reste revient au besoin, 24 h après le début de l’arrosage réel', () => {
  const partial = realIrrigation('bloc-2-partiel', 'rampe-bloc-2', '2026-09-28T19:00:00.000Z', Array.from({ length: 10 }, (_, i) => `B2-${i + 1}`), 6, 6.667, 'sprinkler', 'partially_completed');
  const { inputs } = farm({ events: [partial], plotNeeds: { 'bloc-2': { rawPlanningNeedMm: 8.6, actualIrrigationMm: 6 } } });
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  const bloc2 = byEquipment(plan, 'rampe-bloc-2');
  assert.equal(bloc2.length, 1);
  close(bloc2[0].doseMm, 8.6, 0.01);
  assert.ok(Date.parse(bloc2[0].startAt) >= Date.parse('2026-09-29T19:00:00.000Z'));
});

test('dernier jour : un reste sous la dose minimale est placé dimanche soir ; la semaine finie, rien ne se place', () => {
  const sunday = new Date('2026-10-04T20:30:00.000Z'); // dimanche 22 h 30
  const { inputs } = farm({ now: sunday, plotNeeds: { 'bloc-2': { rawPlanningNeedMm: 4 }, 'bloc-1': { rawPlanningNeedMm: 0 }, 'tunnel-1': { rawPlanningNeedMm: 0 }, 'tunnel-2': { rawPlanningNeedMm: 0 } } });
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  const bloc2 = byEquipment(plan, 'rampe-bloc-2');
  assert.equal(bloc2.length, 1);
  close(bloc2[0].doseMm, 4, 0.01);
  assert.equal(bloc2[0].justification.doseReason, 'last-day-below-minimum');
  assert.ok(Date.parse(bloc2[0].endAt) <= Date.parse('2026-10-04T22:00:00.000Z'), 'fini avant minuit');

  const saturday = buildWeeklyPlan({ ...inputs, now: new Date('2026-10-03T20:30:00.000Z') }, settings);
  assert.equal(byEquipment(saturday, 'rampe-bloc-2').length, 0, 'samedi, 4 mm attendent que le besoin grandisse');

  const over = buildWeeklyPlan({ ...inputs, now: new Date('2026-10-04T22:00:00.000Z') }, settings);
  assert.equal(over.proposals.length, 0);
  assert.ok(over.beds.filter((bed) => bed.needMm > 0).every((bed) => bed.reasons.includes('no-time-left')));
});

test('matériel sans pompe : proposé « non vérifié », sans consommer la pompe ni la réserve', () => {
  const { inputs } = farm({ withoutPumpFor: ['gag1'] });
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  const gag1 = byEquipment(plan, 'gag1');
  assert.ok(gag1.length >= 1);
  assert.equal(gag1[0].pumpId, null);
  assert.equal(gag1[0].justification.hydraulicallyVerified, false);
  assert.equal(gag1[0].justification.pump, null);
  assert.equal(gag1[0].justification.supply, null);
});

test('planche sans objectif ou sans matériel : rien de placé, le motif est donné', () => {
  const { inputs } = farm({ needs: { 'B2-1': { objectiveMm: null, rawPlanningNeedMm: null } } });
  const withoutBed = { ...inputs, coverage: inputs.coverage.filter((entry) => entry.bedId !== 'T2-1') };
  const plan = buildWeeklyPlan(withoutBed, settings);
  assertInvariants(plan, withoutBed);
  assert.deepEqual(plan.beds.find((bed) => bed.bedId === 'B2-1')?.reasons, ['no-objective']);
  assert.deepEqual(plan.beds.find((bed) => bed.bedId === 'T2-1')?.reasons, ['no-equipment']);
  assert.ok(byEquipment(plan, 'rampe-bloc-2').length >= 1, 'les autres planches du bloc sont servies');
});

test('planche sans objectif mais au besoin fixé à la main : planifiable, comme la faisabilité la sert (D-033)', () => {
  // Point ouvert 15 : le remplacement manuel tient lieu de besoin, avec ou sans objectif.
  const { inputs } = farm({ needs: { 'B2-1': { objectiveMm: null, rawPlanningNeedMm: null, calculatedNeedMm: null, manualOverrideMm: 12, overrideReason: 'semis à lever', effectiveNeedMm: 12 } } });
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  const planned = plan.beds.find((bed) => bed.bedId === 'B2-1');
  assert.ok(planned);
  assert.ok(!planned.reasons.includes('no-objective'), 'le besoin manuel remplace l’objectif absent');
  assert.equal(planned.targetMm, 12);
  assert.ok(planned.placedMm > 0, 'la planche est servie');
});

test('un arbitrage 3.4 validé s’impose : la cible d’une planche est ce qui lui a été alloué', () => {
  const { inputs } = farm({ arbitration: [{ bedId: 'B2-1', allocatedCubicMeters: cubicMetersFromMillimeters(5, 28.039) }] });
  const plan = buildWeeklyPlan(inputs, settings);
  const bed = plan.beds.find((item) => item.bedId === 'B2-1');
  close(bed?.targetMm ?? null, 5, 0.01);
  assert.ok(bed?.reasons.includes('water-budget'));
});

test('un arbitrage vide vaut absence d’arbitrage : la conduite en pénurie s’applique', () => {
  // Point 26 : quand aucun niveau n’est validé, le service transmet `[]` et non `null` ;
  // le moteur doit alors borner les cibles comme sans arbitrage, budgets compris. La coupe vient ici de la
  // limite journalière : elle porte son nom, non « stock et ressources » (point 35, 9 octobre 2026).
  const { inputs } = farm({ extraTunnels: true, dailyLimit: 1 });
  const withoutArbitration = buildWeeklyPlan({ ...inputs, arbitration: null }, settings);
  const withEmptyArbitration = buildWeeklyPlan({ ...inputs, arbitration: [] }, settings);
  assert.ok(withoutArbitration.budgets.length > 0, 'sans arbitrage, chaque origine a son budget');
  assert.ok(
    withoutArbitration.beds.some((bed) => bed.reasons.includes('daily-limit') || bed.reasons.includes('deferred')),
    'sans arbitrage, la pénurie borne au moins une planche',
  );
  assert.deepEqual(withEmptyArbitration, withoutArbitration);
});

test('même calcul deux fois : le second reproduit exactement le premier', () => {
  const { inputs } = farm({ extraTunnels: true, dailyLimit: 6 });
  const first = buildWeeklyPlan(inputs, settings);
  const second = buildWeeklyPlan(inputs, settings);
  assert.deepEqual(second, first);
});

test('invariants sur deux cents semaines tirées au hasard', () => {
  let seed = 2026;
  const random = () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    return seed / 2_147_483_648;
  };
  const priorities: IrrigationNeedPriority[] = ['high', 'normal', 'low'];
  for (let run = 0; run < 200; run += 1) {
    const needs: Record<string, Partial<BedIrrigationNeed>> = {};
    const chosen: Record<string, IrrigationNeedPriority> = {};
    const plotIds = ['bloc-1', 'bloc-2', 'tunnel-1', 'tunnel-2', 'tunnel-3', 'tunnel-4'];
    for (const plotId of plotIds) chosen[plotId] = priorities[Math.floor(random() * 3)];
    const { inputs, beds } = farm({
      extraTunnels: true,
      reservoirCubicMeters: random() < 0.1 ? null : Math.round(random() * 60),
      forageFlow: random() * 1.2,
      dailyLimit: random() < 0.4 ? Math.round(1 + random() * 9) : null,
      priorities: chosen,
      forecast: random() < 0.5 ? { '2026-10-01': Math.round(random() * 20) } : {},
      now: new Date(NOW.getTime() + Math.floor(random() * 5) * MILLISECONDS_PER_DAY),
    });
    for (const item of beds) {
      const mm = Math.round(random() * 30 * 10) / 10;
      needs[item.id] = { rawPlanningNeedMm: mm, effectiveNeedMm: mm, calculatedNeedMm: mm, realRemainingMm: mm };
    }
    const randomInputs: PlanningInputs = { ...inputs, needs: inputs.needs.map((need) => ({ ...need, ...needs[need.bedId] })) };
    const strategy = (['priority-then-equal-share', 'equal-share', 'defer'] as const)[Math.floor(random() * 3)];
    const used = { ...settings, shortageStrategy: strategy };
    const plan = buildWeeklyPlan(randomInputs, used);
    assertInvariants(plan, randomInputs, used);
  }
});

test('les chiffres de la ferme : la première nuit ne tire pas plus que la réserve n’a, le forage sert les nuits suivantes', () => {
  // 30 m³ à 12 h 52 et 0,511 m³/h, minimum de sécurité 0 : neuf rampes de bloc, le bloc 2 et quatre
  // rampes de serre demandent 48 m³ la première nuit pour 40 disponibles d’ici mercredi 8 h (recette du
  // 29 septembre 2026). Sans goutte-à-goutte sur les blocs : il repousserait leur rampe à jeudi (R7).
  const { inputs } = largeFarm({ blocDrips: false });
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  const wednesdayMorning = Date.parse('2026-09-30T06:00:00.000Z'); // mercredi 8 h, fin de la plage d'aspersion
  const firstNight = plan.proposals.filter((proposal) => Date.parse(proposal.endAt) <= wednesdayMorning);
  const withdrawn = firstNight.reduce((sum, proposal) => sum + (proposal.volumeCubicMeters ?? 0), 0);
  const available = 30 + 0.511 * (wednesdayMorning - NOW.getTime()) / 3_600_000;
  assert.ok(withdrawn <= available + 1e-6, `${withdrawn.toFixed(2)} m³ tirés d’ici mercredi 8 h pour ${available.toFixed(2)} disponibles`);
  assert.ok(withdrawn >= 20, `${withdrawn.toFixed(2)} m³ la première nuit : la réserve sert ce qu’elle a`);
  const total = plan.proposals.reduce((sum, proposal) => sum + (proposal.volumeCubicMeters ?? 0), 0);
  assert.ok(total > 30 + 20, `${total.toFixed(2)} m³ sur la semaine : l’apport du forage est placé les nuits suivantes`);
  assert.ok(plan.proposals.some((proposal) => proposal.justification.doseReason === 'reserve-level' || proposal.justification.timingReason === 'reserve-inflow'), 'la réserve a décalé ou raccourci un créneau');
  // Le niveau affiché est le niveau physique : jamais négatif.
  for (const proposal of plan.proposals) {
    const level = proposal.justification.supply?.projectedLevelAfterCubicMeters ?? null;
    assert.ok(level === null || level >= 0, `${proposal.id} : niveau projeté ${level}`);
  }
});

test('une semaine complète sur une ferme de la taille de la ferme réelle se calcule dans le budget de 500 ms (D-027, D-031)', () => {
  const { inputs: large } = largeFarm({ dailyLimit: 12 });
  const startedAt = performance.now();
  const plan = buildWeeklyPlan(large, settings);
  const elapsedMs = performance.now() - startedAt;
  assertInvariants(plan, large);
  assert.ok(large.beds.length >= 130, `${large.beds.length} planches`);
  assert.ok(plan.proposals.length >= 30, `${plan.proposals.length} propositions`);
  assert.ok(elapsedMs < WEEKLY_PLAN_BUDGET_MS, `${Math.round(elapsedMs)} ms pour une semaine complète, budget ${WEEKLY_PLAN_BUDGET_MS} ms`);
  console.log(`planning : ${plan.proposals.length} propositions pour ${large.beds.length} planches en ${Math.round(elapsedMs)} ms`);
});

test('pompe tenue par une irrigation validée : le motif nomme ce qui la tenait, même après un creux d’une minute (point 33)', () => {
  // La rampe du bloc 2, validée d'un calcul précédent, tient 7 m³/h de 21 h 00 à 21 h 46 min 12 s :
  // les rampes de serre partent à 21 h 47, la minute suivante, et doivent la nommer.
  const held = plannedIrrigation('bloc-2-valide', 'rampe-bloc-2', PARIS_21H_TUESDAY, '2026-09-29T19:46:12.000Z', BLOC_2, { flow: 7 });
  const { inputs } = farm({ extraTunnels: true, events: [held], plotNeeds: { 'bloc-1': { rawPlanningNeedMm: 0, effectiveNeedMm: 0 }, 'bloc-2': { rawPlanningNeedMm: 0, effectiveNeedMm: 0 } } });
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  const waiting = plan.proposals.filter((proposal) => proposal.startAt === '2026-09-29T19:47:00.000Z');
  assert.ok(waiting.length >= 2, `${waiting.length} rampe(s) à 21 h 47, la minute après la fin de la rampe validée`);
  for (const proposal of waiting) {
    assert.equal(proposal.justification.timingReason, 'pump-capacity', `${proposal.equipmentName} a attendu la pompe`);
    assert.equal(proposal.justification.limitingConstraint, 'pompe « La pompe » saturée avant 21:47 : rampe-bloc-2', proposal.equipmentName);
  }
  const fourth = plan.proposals.find((proposal) => proposal.startAt === '2026-09-29T20:32:00.000Z');
  assert.ok(fourth, 'la quatrième rampe attend la fin des deux rampes de 45 min');
  assert.equal(fourth?.justification.timingReason, 'pump-capacity');
  assert.equal(fourth?.justification.limitingConstraint, 'pompe « La pompe » saturée avant 22:32 : Rampe de serre tunnel 1, Rampe de serre tunnel 2, Rampe de serre tunnel 3');
});

test('espacement après une irrigation validée du vendredi matin : samedi dit « espacement », pas « après la pluie prévue » (point 33)', () => {
  const fridayMorning = plannedIrrigation('b2-vendredi', 'gag-b2', '2026-10-02T04:00:00.000Z', '2026-10-02T04:30:00.000Z', BLOC_2, { kind: 'drip' });
  const { inputs } = farm({
    forecast: { '2026-10-01': 12 },
    plotNeeds: { 'bloc-1': { rawPlanningNeedMm: 8, forecastRainMm: 12 }, 'bloc-2': { rawPlanningNeedMm: 8, forecastRainMm: 12 } },
    events: [fridayMorning],
  });
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  const bloc2 = byEquipment(plan, 'rampe-bloc-2');
  assert.equal(bloc2.length, 1);
  assert.equal(bloc2[0].startAt, '2026-10-03T19:00:00.000Z', 'samedi 21 h : 24 h après vendredi 06 h, puis l’ouverture de la plage');
  assert.equal(bloc2[0].justification.timingReason, 'spacing');
  assert.equal(bloc2[0].justification.limitingConstraint, 'espacement entre deux arrosages');
});

test('restriction qui borne : le manque est nommé « limite journalière », pas « stock et ressources » (point 35)', () => {
  const { inputs } = farm({ dailyLimit: 1 });
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  const budget = plan.budgets[0];
  assert.equal(budget.dailyLimitRemainingCubicMeters, 6, 'six jours limités à 1 m³');
  assert.ok((budget.availableCubicMeters ?? 0) > budget.demandCubicMeters, 'le stock et le forage suffisent : seule la limite coupe');
  const reduced = plan.beds.filter((bed) => bed.targetMm < bed.needMm - 1e-6);
  assert.ok(reduced.length > 0, 'des planches sont réduites par la limite');
  for (const bed of reduced) {
    assert.ok(bed.reasons.includes('daily-limit'), `${bed.bedName} : ${bed.reasons.join(', ')}`);
    assert.ok(!bed.reasons.includes('water-budget'), `${bed.bedName} ne manque pas d’eau`);
  }
  assert.ok((plan.deficit.byReason['daily-limit'] ?? 0) > 0, 'le manque est compté sous la limite journalière');
  assert.equal(plan.deficit.byReason['water-budget'], undefined, 'rien n’est compté sur le stock et les ressources');
});

test('restriction à partir de mercredi : mardi, sans limite, prend ce que ses plages permettent, la limite ne borne pas le budget (point 35)', () => {
  const { inputs } = farm({ dailyLimit: 1, dailyLimitFrom: '2026-09-30' });
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  assert.equal(plan.budgets[0].dailyLimitRemainingCubicMeters, null, 'un jour de l’horizon sans limite : la limite ne borne pas la semaine');
  let tuesday = 0;
  for (const proposal of plan.proposals) {
    for (const [date, volume] of splitVolumeAcrossLocalDays({ startAt: proposal.startAt, endAt: proposal.endAt, cubicMeters: proposal.volumeCubicMeters ?? 0, timeZone: TZ })) {
      if (date === '2026-09-29') tuesday += volume;
    }
  }
  assert.ok(tuesday > 1, `mardi reçoit ${tuesday} m³, plus que la limite du lendemain`);
  assert.ok(plan.beds.every((bed) => !bed.reasons.includes('water-budget')), 'rien ne manque d’eau : le stock et le forage suffisent');
  assert.ok((plan.deficit.byReason['daily-limit'] ?? 0) > 0, 'ce que les jours limités ne prennent pas est nommé limite journalière');
});
