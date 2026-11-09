import assert from 'node:assert/strict';
import test from 'node:test';
import type { PlanningInputs, StoredWeeklyPlan, UnplacedReason, WeeklyPlan } from '../lib/domain/planning/contract.ts';
import { buildWeeklyPlan } from '../lib/domain/planning/engine.ts';
import { waterDeficitExplanation } from '../lib/domain/planning/presentation.ts';
import { MILLISECONDS_PER_HOUR, cubicMetersFromMillimeters } from '../lib/domain/units.ts';
import { splitVolumeAcrossLocalDays } from '../lib/domain/water-management.ts';
import {
  assertInvariants, byEquipment, close, farm, largeFarm, NOW, PARIS_21H_TUESDAY, realIrrigation, settings, TZ, validatedIrrigation, withDirectChain,
} from './support/planning-fixtures.ts';

/**
 * Les scénarios de pénurie de la 3.9 que le moteur tient déjà, écrits en
 * tests sans changer son comportement (docs/shortage-contract.md,
 * « Découpage et preuve de fin », point 3) : la source du manque (S2, S4,
 * S7, S8, S9) et la semaine qui avance (S23, S24, S26). Ce que ces scénarios
 * attendent et que le moteur ne fait pas est un défaut, relevé en les
 * écrivant et corrigé à part, chacun avec son test rouge (points ouverts 51
 * à 57) : ces tests-ci ne vérifient que ce qui tient.
 */

const HORIZON_END = '2026-10-04T22:00:00.000Z';
/** Les heures d'apport d'ici la fin de l'horizon, du mardi 12 h 52 au dimanche minuit à la ferme. */
const HORIZON_HOURS = (Date.parse(HORIZON_END) - NOW.getTime()) / MILLISECONDS_PER_HOUR;
/** Les motifs d'eau du résumé (« Manque d'eau ») : une planche servie hors pénurie n'en porte aucun. */
const WATER_REASONS: readonly UnplacedReason[] = ['water-budget', 'deferred', 'reserve-timing', 'supply-unavailable', 'daily-limit', 'withdrawal-limit'];
const placedVolume = (plan: WeeklyPlan) => plan.proposals.reduce((sum, proposal) => sum + (proposal.volumeCubicMeters ?? 0), 0);
/** Le plan tel que le maraîcher le lit : chaque créneau, son matériel, ses heures et sa dose. */
const slots = (plan: WeeklyPlan, keep: (equipmentId: string) => boolean = () => true) => plan.proposals
  .filter((proposal) => keep(proposal.equipmentId))
  .map((proposal) => `${proposal.equipmentId} ${proposal.startAt} → ${proposal.endAt} ${proposal.doseMm.toFixed(2)} mm`);
const tunnelBeds = (tunnel: number) => Array.from({ length: 8 }, (_, index) => `T${tunnel}-${index + 1}`);
const withReservoir = (inputs: PlanningInputs, changes: Partial<PlanningInputs['infrastructure']['reservoirs'][number]>): PlanningInputs => ({
  ...inputs,
  infrastructure: { ...inputs.infrastructure, reservoirs: inputs.infrastructure.reservoirs.map((reservoir) => ({ ...reservoir, ...changes })) },
});

/** Le plan tel que le service l'enregistre, pour la note du manque d'eau, qui se lit sur le plan enregistré (D-038). */
function stored(plan: WeeklyPlan): StoredWeeklyPlan {
  const { weekStart, weekEnd, computedAt, horizonStartAt, horizonEndAt, beds, deficit, budgets, assumptions, suggestions, overcommittedDays } = plan;
  return {
    calculation: {
      id: 'calcul', season: 2026, weekStart, trigger: 'manual', triggerEvent: null, computedAt, horizonStartAt, horizonEndAt, settings: plan.settings,
      summary: { weekEnd, beds, deficit, budgets, assumptions, suggestions, overcommittedDays, changes: null },
    },
    proposals: plan.proposals.map((proposal) => ({
      ...proposal, storedId: `enregistrée-${proposal.id}`, calculationId: 'calcul', calculatedAt: computedAt, status: 'proposed',
      validatedEventId: null, irrigationStatus: null, replacedByCalculationId: null, decidedAt: null, actorUserId: null,
    })),
    suggestions: [],
    pendingEvent: null,
  };
}

// A. La source du manque.

test('S2, apport plafonné par la limite de prélèvement : le budget compte au plus 10 m³ par jour civil, et rien ne manque d’eau', () => {
  const base = farm({ extraTunnels: true, reservoirCubicMeters: 25 }).inputs;
  const inputs: PlanningInputs = {
    ...base,
    infrastructure: {
      ...base.infrastructure,
      resourceLimits: [{ id: 'limite-forage', resourceId: 'forage', enabled: true, maxCubicMetersPerDay: 10, validFrom: '2026-09-01', validUntil: null, referenceNote: 'autorisation de prélèvement', createdAt: '2026-09-01T00:00:00.000Z' }],
    },
  };
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  // Mardi, entamé à 12 h 52 : 11,13 h de forage à 0,511 m³/h, 5,69 m³ sous la limite ; puis cinq jours pleins, à 12,26 m³
  // chacun sans limite, plafonnés à 10 m³ par jour civil de Paris. Les apports à la réserve sont ceux que la limite laisse.
  const tuesdayHours = (Date.parse('2026-09-29T22:00:00.000Z') - NOW.getTime()) / MILLISECONDS_PER_HOUR;
  close(plan.budgets[0].availableCubicMeters, 25 + 0.511 * tuesdayHours + 5 * 10, 1e-6, 'stock et apport plafonné');
  close(buildWeeklyPlan(base, settings).budgets[0].availableCubicMeters, 25 + 0.511 * HORIZON_HOURS, 1e-6, 'sans limite, le forage entier');
  assert.deepEqual(plan.budgets[0].fractions, { high: 1, normal: 1, low: 1 }, 'pas de pénurie');
  assert.equal(plan.deficit.waterCubicMeters, 0, '« Manque d’eau 0,00 m³ »');
  for (const bed of plan.beds) {
    assert.deepEqual(bed.reasons.filter((reason) => WATER_REASONS.includes(reason)), [], `${bed.bedName} : jamais un motif d’eau`);
  }
});

test('S4, réserve engagée sous son minimum par deux irrigations planifiées à la main : aucun créneau nouveau tant que la projection y reste, puis les créneaux reprennent', () => {
  // Réserve à 25 m³ pour un minimum de 20, deux irrigations posées à la main cet après-midi, 4 m³ chacune — 20 mm sur
  // 25 m² mouillés par planche des tunnels 3 et 4 — : à 15 h, la projection tombe à 18,09 m³.
  const base = withReservoir(farm({ extraTunnels: true, reservoirCubicMeters: 25 }).inputs, { minimumSafetyCubicMeters: 20 });
  const handPlanned = [
    validatedIrrigation('main-3', 'rampe-tunnel-3', '2026-09-29T11:00:00.000Z', 3600, tunnelBeds(3), { rate: 20, wettedAreaSquareMeters: 25, fromReserve: true }),
    validatedIrrigation('main-4', 'rampe-tunnel-4', '2026-09-29T12:00:00.000Z', 3600, tunnelBeds(4), { rate: 20, wettedAreaSquareMeters: 25, fromReserve: true }),
  ];
  const inputs: PlanningInputs = {
    ...base,
    events: handPlanned,
    needs: base.needs.map((need) => (/^T[34]-/.test(need.bedId) ? { ...need, plannedIrrigationMm: 20, rawPlanningNeedMm: 0, effectiveNeedMm: 0 } : need)),
  };
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  close(plan.budgets[0].availableCubicMeters, 25 - 20 + 0.511 * HORIZON_HOURS - 8, 1e-6, 'le budget retire les deux irrigations planifiées');
  // Le forage remonte la projection au minimum vers 18 h 44 : rien ne part avant.
  const atThree = 25 + 0.511 * ((Date.parse('2026-09-29T13:00:00.000Z') - NOW.getTime()) / MILLISECONDS_PER_HOUR) - 8;
  const backAtMinimum = Date.parse('2026-09-29T13:00:00.000Z') + ((20 - atThree) / 0.511) * MILLISECONDS_PER_HOUR;
  assert.ok(atThree < 20, `projection à ${atThree} m³ à 15 h`);
  for (const proposal of plan.proposals) assert.ok(Date.parse(proposal.startAt) >= backAtMinimum, `${proposal.id} ${proposal.startAt} : avant que la projection revienne à 20 m³`);
  // Le premier créneau attend l'apport et le dit ; le moteur n'ajoute rien aux tunnels 3 et 4, et sert les autres ensuite.
  const [first] = [...plan.proposals].sort((left, right) => left.startAt.localeCompare(right.startAt));
  assert.equal(first.justification.timingReason, 'reserve-inflow');
  assert.equal(first.justification.limitingConstraint, 'réserve « Réserve tampon » au minimum de sécurité');
  assert.equal(byEquipment(plan, 'rampe-tunnel-3').length + byEquipment(plan, 'rampe-tunnel-4').length, 0);
  assert.equal(plan.deficit.waterCubicMeters, 0, 'la garde retarde, elle ne coupe pas : l’apport de la semaine suffit');
});

test('S7, stock inconnu : créneaux « eau non vérifiée », aucun budget chiffré, aucune coupe, et la note du manque d’eau se tait', () => {
  // Le résumé, lui, écrit encore « Manque d’eau 0,00 m³ » au lieu de dire que le manque ne peut pas être chiffré (point ouvert 51).
  const { inputs } = farm({ extraTunnels: true, reservoirCubicMeters: null });
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  assert.equal(plan.budgets.length, 1);
  assert.equal(plan.budgets[0].availableCubicMeters, null, 'l’eau mobilisable reste inconnue, jamais zéro (D-003)');
  assert.deepEqual(plan.budgets[0].fractions, { high: 1, normal: 1, low: 1 }, 'sans budget, aucune part n’est coupée');
  assert.ok(plan.proposals.length > 0);
  for (const proposal of plan.proposals) {
    assert.equal(proposal.justification.hydraulicallyVerified, false, `${proposal.id} : eau non vérifiée`);
    assert.equal(proposal.justification.supply?.projectedLevelAfterCubicMeters ?? null, null, `${proposal.id} : aucun niveau projeté`);
  }
  assert.equal(plan.deficit.waterCubicMeters, 0, 'aucun manque d’eau compté sur un stock inconnu');
  assert.equal(waterDeficitExplanation(stored(plan)), null);
});

test('S8, réserve inactive : aucun créneau sur sa chaîne, motif « origine d’eau ou pompe indisponible » ; la chaîne de la source reste la même', () => {
  // La pompe archivée et la ressource inactive sur la période ne se lisent pas encore ainsi (points ouverts 52 et 53).
  const twoChains = withDirectChain(farm().inputs, { equipmentIds: ['rampe-bloc-2'], dailyLimitCubicMeters: 10 });
  const reference = buildWeeklyPlan(twoChains, settings);
  const inputs = withReservoir(twoChains, { status: 'inactive' });
  const plan = buildWeeklyPlan(inputs, settings);
  assertInvariants(plan, inputs);
  const onSource = (equipmentId: string) => equipmentId === 'rampe-bloc-2';
  assert.ok(plan.proposals.every((proposal) => onSource(proposal.equipmentId)), 'rien sur la chaîne de la réserve');
  assert.deepEqual(slots(plan), slots(reference, onSource), 'la chaîne de la source inchangée');
  const reserveBeds = plan.beds.filter((bed) => bed.needMm > 0 && !onSource(bed.equipmentId ?? ''));
  assert.equal(reserveBeds.length, 22);
  for (const bed of reserveBeds) assert.deepEqual(bed.reasons, ['supply-unavailable'], bed.bedName);
  // 1,32 m³ de gag1, 0,66 de gag2, 2,56 par tunnel : toute la demande de la chaîne, comptée en manque d'eau.
  close(plan.deficit.byReason['supply-unavailable'] ?? null, 1.32 + 0.66 + 2 * 2.56, 1e-6);
  close(plan.deficit.waterCubicMeters, 7.1, 1e-6);
});

test('S9, deux chaînes d’eau : une ligne de budget par chaîne, la pénurie de l’une ne touche pas l’autre, chaque planche comptée sur la chaîne de son matériel', () => {
  // La ferme en taille, sans goutte-à-goutte de bloc : les rampes des blocs 3 et 4 sur une source à sa pompe de 3 m³/h,
  // toutes les autres sur la réserve, le forage à l'arrêt.
  const twoChains = (reservoir: number, sourceLimit: number) => withDirectChain(
    largeFarm({ blocDrips: false, forageFlow: 0, reservoirCubicMeters: reservoir }).inputs,
    { equipmentIds: ['rampe-bloc-3', 'rampe-bloc-4'], dailyLimitCubicMeters: sourceLimit },
  );
  const onSource = (equipmentId: string) => equipmentId === 'rampe-bloc-3' || equipmentId === 'rampe-bloc-4';
  const plan = (reservoir: number, sourceLimit: number) => {
    const inputs = twoChains(reservoir, sourceLimit);
    const result = buildWeeklyPlan(inputs, settings);
    assertInvariants(result, inputs);
    // R12 : un créneau puise dans la chaîne de son matériel, et une planche n'est servie que par elle.
    for (const proposal of result.proposals) {
      assert.equal(proposal.justification.supply?.originKey, onSource(proposal.equipmentId) ? 'resource:source' : 'reservoir:reserve', proposal.id);
    }
    return result;
  };
  // Vingt planches de bloc de 26,4 m² mouillés à 20 mm sur la source ; 54,79 m³ sur la réserve.
  const SOURCE_DEMAND = 20 * cubicMetersFromMillimeters(20, 26.4);
  const RESERVE_DEMAND = 54.7878;
  const plenty = plan(60, 2);

  // La réserve en pénurie, la source non : la source sert ses planches comme si la réserve était pleine.
  const reserveShort = plan(20, 2);
  assert.deepEqual(reserveShort.budgets.map((budget) => budget.originKey), ['reservoir:reserve', 'resource:source']);
  const [reserve, source] = reserveShort.budgets;
  close(reserve.availableCubicMeters, 20, 1e-6);
  close(reserve.demandCubicMeters, RESERVE_DEMAND, 1e-4, 'la demande de la réserve, sans les blocs 3 et 4');
  close(reserve.fractions.normal, 20 / reserve.demandCubicMeters, 1e-9);
  close(source.availableCubicMeters, 6 * 2, 1e-6, 'six jours civils à 2 m³');
  close(source.demandCubicMeters, SOURCE_DEMAND, 1e-6);
  assert.deepEqual(source.fractions, { high: 1, normal: 1, low: 1 });
  assert.deepEqual(slots(reserveShort, onSource), slots(plenty, onSource), 'la source inchangée');
  for (const bed of reserveShort.beds.filter((item) => onSource(item.equipmentId ?? ''))) {
    assert.deepEqual(bed.reasons.filter((reason) => WATER_REASONS.includes(reason)), [], `${bed.bedName} : aucun motif d’eau sur la source`);
  }

  // L'inverse : la source à 1,5 m³ par jour, en pénurie, et la réserve pleine, servie comme avant.
  const sourceShort = plan(60, 1.5);
  const [full, scarce] = sourceShort.budgets;
  assert.deepEqual(full.fractions, { high: 1, normal: 1, low: 1 });
  close(scarce.availableCubicMeters, 6 * 1.5, 1e-6);
  close(scarce.fractions.normal, 9 / SOURCE_DEMAND, 1e-9);
  assert.deepEqual(slots(sourceShort, (id) => !onSource(id)), slots(plenty, (id) => !onSource(id)), 'la réserve inchangée');
  for (const bed of sourceShort.beds.filter((item) => item.needMm > 0 && !onSource(item.equipmentId ?? ''))) {
    assert.ok(bed.deficitMm < 1e-6, `${bed.bedName} : servie en entier sur la réserve`);
  }
  close(sourceShort.deficit.waterCubicMeters, SOURCE_DEMAND - 9, 1e-6, 'le manque d’eau est celui de la source seule');
});

// D. La pénurie dans le temps de la semaine.

test('S23, pluie prévue en pénurie : le plein champ attend vendredi avec sa part du besoin réduit ; vendredi, la réanalyse à 2 mm fait grandir le manque, et le plan le dit', () => {
  // 12 mm annoncés jeudi, R2 à 100 % : le besoin du plein champ tombe à 8 mm ; la réserve à 10 m³, le forage à l'arrêt.
  const blocsAfterForecast = { rawPlanningNeedMm: 8, effectiveNeedMm: 8, forecastRainMm: 12 };
  const tuesday = farm({ extraTunnels: true, forageFlow: 0, reservoirCubicMeters: 10, forecast: { '2026-10-01': 12 }, plotNeeds: { 'bloc-1': blocsAfterForecast, 'bloc-2': blocsAfterForecast } }).inputs;
  const first = buildWeeklyPlan(tuesday, settings);
  assertInvariants(first, tuesday);
  // Le plein champ — 99 m² sous goutte-à-goutte, 280,39 m² sous la rampe du bloc 2 — à 8 mm ; les tunnels à 20 mm.
  const OPEN_FIELD_SQUARE_METERS = 99 + 280.39;
  close(first.budgets[0].demandCubicMeters, cubicMetersFromMillimeters(8, OPEN_FIELD_SQUARE_METERS) + 4 * 2.56, 1e-4, 'la part se calcule sur le besoin réduit');
  close(first.budgets[0].fractions.normal, 10 / first.budgets[0].demandCubicMeters, 1e-9);
  for (const equipmentId of ['gag1', 'gag2', 'rampe-bloc-2']) {
    for (const proposal of byEquipment(first, equipmentId)) {
      assert.ok(proposal.startAt >= '2026-10-01T22:00:00.000Z', `${proposal.id} ${proposal.startAt} : vendredi au plus tôt (R3)`);
      assert.equal(proposal.justification.timingReason, 'after-forecast-rain');
    }
  }
  for (const tunnel of [1, 2, 3]) assert.equal(byEquipment(first, `rampe-tunnel-${tunnel}`)[0].startAt, PARIS_21H_TUESDAY, 'sous abri, servis sans attendre');

  // Vendredi 10 h : les tunnels ont reçu 15 mm mardi soir (7,68 m³ tirés) ; jeudi n'a donné que 2 mm. Le plein champ
  // remonte de 10 mm, à 18 mm ; l'eau versée aux tunnels reste versée, le budget part du stock observé.
  const FRIDAY = new Date('2026-10-02T08:00:00.000Z');
  const blocsAfterRain = { rawPlanningNeedMm: 18, effectiveNeedMm: 18, actualRainMm: 2, forecastRainMm: 0 };
  const tunnelsServed = { rawPlanningNeedMm: 5, effectiveNeedMm: 5, actualIrrigationMm: 15 };
  const realized = [1, 2, 3, 4].map((tunnel) => realIrrigation(`mardi-${tunnel}`, `rampe-tunnel-${tunnel}`, PARIS_21H_TUESDAY, tunnelBeds(tunnel), 15, tunnel === 1 ? 10 : 20, 'sprinkler'));
  const friday = withReservoir(farm({
    extraTunnels: true, forageFlow: 0, now: FRIDAY, events: realized,
    plotNeeds: { 'bloc-1': blocsAfterRain, 'bloc-2': blocsAfterRain, 'tunnel-1': tunnelsServed, 'tunnel-2': tunnelsServed, 'tunnel-3': tunnelsServed, 'tunnel-4': tunnelsServed },
  }).inputs, { currentVolumeCubicMeters: 10 - 7.68, currentVolumeObservedAt: FRIDAY.toISOString() });
  const second = buildWeeklyPlan(friday, settings);
  assertInvariants(second, friday);
  close(second.budgets[0].availableCubicMeters, 2.32, 1e-6, 'le stock observé, rien de repris aux tunnels');
  close(second.budgets[0].demandCubicMeters, cubicMetersFromMillimeters(18, OPEN_FIELD_SQUARE_METERS) + 4 * cubicMetersFromMillimeters(5, 128), 1e-4);
  assert.ok(second.deficit.waterCubicMeters > first.deficit.waterCubicMeters + 1, `le manque grandit : ${first.deficit.waterCubicMeters} puis ${second.deficit.waterCubicMeters} m³`);
  for (const bed of second.beds.filter((item) => !item.bedId.startsWith('T'))) assert.ok(bed.reasons.includes('water-budget'), `${bed.bedName} : le manque est dit`);
});

test('S24, semaine entamée : jeudi midi, le budget part du stock observé, les parts des besoins restants, et la limite du jeudi compte le réalisé du jeudi', () => {
  const THURSDAY_NOON = new Date('2026-10-01T10:00:00.000Z');
  // Les tunnels arrosés lundi et mercredi soir (15 mm), gag1 jeudi matin (14 mm, 0,924 m³) ; la réserve observée à
  // 4 m³ jeudi midi, le forage à l'arrêt, une limite de 2 m³ par jour.
  const tunnelsServed = { rawPlanningNeedMm: 5, effectiveNeedMm: 5, actualIrrigationMm: 15 };
  const gag1Served = { rawPlanningNeedMm: 6, effectiveNeedMm: 6, actualIrrigationMm: 14 };
  const week = (thursdayMorning: boolean) => {
    const events = [
      ...[1, 2, 3, 4].map((tunnel) => realIrrigation(`lundi-${tunnel}`, `rampe-tunnel-${tunnel}`, '2026-09-28T19:00:00.000Z', tunnelBeds(tunnel), 10, tunnel === 1 ? 10 : 20, 'sprinkler')),
      ...[1, 2, 3, 4].map((tunnel) => realIrrigation(`mercredi-${tunnel}`, `rampe-tunnel-${tunnel}`, '2026-09-30T19:00:00.000Z', tunnelBeds(tunnel), 5, tunnel === 1 ? 10 : 20, 'sprinkler')),
      ...(thursdayMorning ? [realIrrigation('jeudi-gag1', 'gag1', '2026-10-01T06:00:00.000Z', ['B1-0', 'B1-1', 'B1-2', 'B1-3'], 14, 14)] : []),
    ];
    const inputs = withReservoir(farm({
      extraTunnels: true, forageFlow: 0, now: THURSDAY_NOON, events, dailyLimit: 2,
      plotNeeds: { 'tunnel-1': tunnelsServed, 'tunnel-2': tunnelsServed, 'tunnel-3': tunnelsServed, 'tunnel-4': tunnelsServed },
      needs: { 'B1-0': gag1Served, 'B1-1': gag1Served, 'B1-2': gag1Served, 'B1-3': gag1Served },
    }).inputs, { currentVolumeCubicMeters: 4, currentVolumeObservedAt: THURSDAY_NOON.toISOString() });
    const plan = buildWeeklyPlan(inputs, settings);
    assertInvariants(plan, inputs);
    return plan;
  };
  const plan = week(true);
  const [budget] = plan.budgets;
  close(budget.availableCubicMeters, 4, 1e-6, 'le stock observé maintenant, sans apport');
  // Les besoins restants : 5 mm sur les tunnels, 6 mm sous gag1, 20 mm sous gag2 et sur le bloc 2.
  const remaining = 4 * cubicMetersFromMillimeters(5, 128) + cubicMetersFromMillimeters(6, 66) + cubicMetersFromMillimeters(20, 33) + 5.6078;
  close(budget.demandCubicMeters, remaining, 1e-4);
  close(budget.fractions.normal, 4 / remaining, 1e-9);
  for (const proposal of plan.proposals) assert.ok(Date.parse(proposal.startAt) >= THURSDAY_NOON.getTime(), `${proposal.id} : rien sur les jours écoulés`);
  const thursday = plan.proposals.reduce((sum, proposal) => sum + (splitVolumeAcrossLocalDays({ startAt: proposal.startAt, endAt: proposal.endAt, cubicMeters: proposal.volumeCubicMeters ?? 0, timeZone: TZ }).get('2026-10-01') ?? 0), 0);
  assert.ok(thursday + 0.924 <= 2 + 1e-6, `jeudi : ${thursday} m³ proposés en plus des 0,924 réalisés`);
  // Sans l'arrosage du matin, la rampe du bloc 2 part jeudi soir ; avec lui, le reste du jeudi ne tient pas sa dose
  // minimale : elle part à minuit, sur le vendredi, sa plage continuant jusqu'à 8 h (D-085).
  assert.equal(byEquipment(week(false), 'rampe-bloc-2')[0].startAt, '2026-10-01T19:00:00.000Z');
  const [friday] = byEquipment(plan, 'rampe-bloc-2');
  assert.equal(friday.startAt, '2026-10-01T22:00:00.000Z');
  assert.equal(friday.justification.timingReason, 'daily-limit');
});

test('S26, sensibilité à l’heure du calcul : deux minutes plus tard, les deux plans tiennent les invariants ; créneaux déplacés et écart de volume relevés', (t) => {
  // Un relevé, pas une garde : l'écart se lit au compte rendu de la recette (docs/shortage-contract.md, S26).
  const { inputs } = farm({ extraTunnels: true, forageFlow: 0.05, reservoirCubicMeters: 5 });
  const later = { ...inputs, now: new Date(NOW.getTime() + 2 * 60_000) };
  const first = buildWeeklyPlan(inputs, settings);
  const second = buildWeeklyPlan(later, settings);
  assertInvariants(first, inputs);
  assertInvariants(second, later);
  const before = new Set(slots(first));
  const after = new Set(slots(second));
  const moved = [...before].filter((slot) => !after.has(slot));
  const gap = placedVolume(second) - placedVolume(first);
  t.diagnostic(`S26 : ${moved.length} créneaux sur ${before.size} déplacés ou de dose changée ; volume placé ${placedVolume(first).toFixed(4)} puis ${placedVolume(second).toFixed(4)} m³, écart ${gap.toFixed(4)} m³ pour ${(0.05 * 2 / 60).toFixed(4)} m³ d’apport perdu`);
  for (const slot of moved) t.diagnostic(`  12 h 52 : ${slot}`);
  for (const slot of [...after].filter((item) => !before.has(item))) t.diagnostic(`  12 h 54 : ${slot}`);
});
