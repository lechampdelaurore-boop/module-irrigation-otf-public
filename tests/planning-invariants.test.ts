import assert from 'node:assert/strict';
import test from 'node:test';
import type { BedIrrigationNeed, IrrigationNeedPriority } from '../lib/domain/irrigation-needs.ts';
import type { PlanningInputs, RefusedSlot, WeeklyPlan } from '../lib/domain/planning/contract.ts';
import { buildWeeklyPlan } from '../lib/domain/planning/engine.ts';
import { cubicMetersFromMillimeters, MILLISECONDS_PER_DAY } from '../lib/domain/units.ts';
import { assertInvariants, farm, NOW, settings, withDirectChain, withValidatedProposals } from './support/planning-fixtures.ts';

/**
 * Les invariants du contrat sur deux cents semaines tirées au hasard, étendus
 * à ce que la 3.9 a ajouté au moteur (docs/shortage-contract.md, « La preuve
 * de fin », point 2 ; recette de clôture, E2) : les parts sous les trois
 * conduites, une seconde chaîne d'eau, un arbitrage validé, une planche à la
 * surface mouillée inconnue, puis, au second calcul de la même semaine, des
 * créneaux refusés et des arrosages validés. Chaque semaine vérifie les
 * invariants sur ses deux calculs (`assertInvariants` : les créneaux refusés
 * évités, la limite journalière comptée avec l'eau déjà arrosée ou validée
 * du jour). Le test de `tests/planning-engine.test.ts`, sur la ferme seule,
 * reste tel quel (D-099).
 */

const PRIORITIES: readonly IrrigationNeedPriority[] = ['high', 'normal', 'low'];
const STRATEGIES = ['priority-then-equal-share', 'equal-share', 'defer'] as const;
const PLOTS = ['bloc-1', 'bloc-2', 'tunnel-1', 'tunnel-2', 'tunnel-3', 'tunnel-4'];
/** Les matériels qu'une seconde chaîne peut servir : un goutte-à-goutte, la rampe du bloc 2, une rampe de serre. */
const SECOND_CHAIN_EQUIPMENT = ['gag2', 'rampe-bloc-2', 'rampe-tunnel-4'];
const RESERVOIR_ORIGIN = 'reservoir:reserve';

/** Un passe-pied non renseigné : la surface mouillée de la planche est inconnue (point ouvert 63, D-097). */
function withUnknownWettedArea(inputs: PlanningInputs, bedId: string): PlanningInputs {
  return {
    ...inputs,
    beds: inputs.beds.map((bed) => (bed.id === bedId ? { ...bed, alleyWidth: null } : bed)),
    needs: inputs.needs.map((need) => (need.bedId === bedId ? { ...need, wettedAreaSquareMeters: null, wettedAreaSource: 'unknown-alley', effectiveVolumeCubicMeters: null } : need)),
  };
}

/** Sous un arbitrage validé, ni ligne de budget ni conduite : les allocations s'imposent, bornées (D-077, D-088). */
function assertArbitration(plan: WeeklyPlan, inputs: PlanningInputs, label: string) {
  if (!inputs.arbitration || inputs.arbitration.length === 0) {
    assert.equal(plan.arbitration, undefined, `${label} : aucun arbitrage sans allocation`);
    return;
  }
  assert.ok(plan.arbitration, `${label} : l'arbitrage s'impose`);
  assert.deepEqual(plan.budgets, [], `${label} : aucune ligne de budget sous un arbitrage`);
  const { allocatedCubicMeters, reservedCubicMeters, unreceivedCubicMeters } = plan.arbitration;
  assert.ok(reservedCubicMeters >= -1e-9 && reservedCubicMeters <= allocatedCubicMeters + 1e-6, `${label} : ${reservedCubicMeters} m³ réservés pour ${allocatedCubicMeters} alloués`);
  assert.ok(unreceivedCubicMeters >= 0, `${label} : ${unreceivedCubicMeters} m³ non reçus`);
}

test('invariants sur deux cents semaines tirées au hasard, étendus aux parts, aux refus, à l’arbitrage et à deux chaînes', () => {
  let seed = 3_009;
  const random = () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    return seed / 2_147_483_648;
  };
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
  const played = { shortage: 0, twoChains: 0, unknownArea: 0, arbitration: 0, refused: 0, validated: 0 };
  for (let run = 0; run < 200; run += 1) {
    const chosen: Record<string, IrrigationNeedPriority> = {};
    for (const plotId of PLOTS) chosen[plotId] = pick(PRIORITIES);
    const { inputs: base, beds } = farm({
      extraTunnels: true,
      // La réserve et le forage tirés vers le bas, pour que le manque d'eau et ses parts se jouent souvent.
      reservoirCubicMeters: random() < 0.1 ? null : Math.round(random() * random() * 60),
      forageFlow: random() * random() * 1.2,
      dailyLimit: random() < 0.3 ? Math.round(1 + random() * 9) : null,
      priorities: chosen,
      forecast: random() < 0.5 ? { '2026-10-01': Math.round(random() * 20) } : {},
      now: new Date(NOW.getTime() + Math.floor(random() * 5) * MILLISECONDS_PER_DAY),
    });
    const drawn = new Map<string, Partial<BedIrrigationNeed>>();
    for (const item of beds) {
      const mm = Math.round(random() * 30 * 10) / 10;
      drawn.set(item.id, { rawPlanningNeedMm: mm, effectiveNeedMm: mm, calculatedNeedMm: mm, realRemainingMm: mm });
    }
    let inputs: PlanningInputs = { ...base, needs: base.needs.map((need) => ({ ...need, ...drawn.get(need.bedId) })) };
    // Une seconde chaîne : une source prélevée directement, sa pompe et sa limite par jour, pour un à trois matériels (S9).
    if (random() < 0.35) {
      const equipmentIds = SECOND_CHAIN_EQUIPMENT.filter(() => random() < 0.5);
      if (equipmentIds.length === 0) equipmentIds.push(pick(SECOND_CHAIN_EQUIPMENT));
      inputs = withDirectChain(inputs, {
        equipmentIds,
        dailyLimitCubicMeters: Math.round(random() * 60) / 10,
        resourceFlow: Math.round(random() * 30) / 10,
        pumpFlow: 1 + Math.round(random() * 40) / 10,
      });
      played.twoChains += 1;
    }
    if (random() < 0.15) {
      inputs = withUnknownWettedArea(inputs, pick(beds).id);
      played.unknownArea += 1;
    }
    // Un arbitrage validé : une planche sur deux, de zéro à 1,2 fois son besoin (S13).
    if (random() < 0.3) {
      const arbitration = inputs.needs.flatMap((need) => {
        if (random() >= 0.5 || need.wettedAreaSquareMeters === null) return [];
        return [{ bedId: need.bedId, allocatedCubicMeters: random() * 1.2 * cubicMetersFromMillimeters(need.effectiveNeedMm ?? 0, need.wettedAreaSquareMeters) }];
      });
      if (arbitration.length > 0) {
        inputs = { ...inputs, arbitration };
        played.arbitration += 1;
      }
    }
    const used = { ...settings, shortageStrategy: pick(STRATEGIES) };
    const first = buildWeeklyPlan(inputs, used);
    assertInvariants(first, inputs, used);
    assertArbitration(first, inputs, `semaine ${run}, premier calcul`);
    if (first.budgets.some((budget) => Object.values(budget.fractions).some((fraction) => fraction < 1))) played.shortage += 1;

    // Le second calcul : de zéro à deux créneaux du premier refusés (D-030, S21), et les créneaux d'un autre matériel
    // de la réserve validés, leur eau comptée (S20).
    const refusedSlots: RefusedSlot[] = [];
    for (let count = Math.floor(random() * 3); count > 0 && first.proposals.length > 0; count -= 1) {
      const { equipmentId, startAt, endAt } = pick(first.proposals);
      refusedSlots.push({ equipmentId, startAt, endAt });
    }
    let next: PlanningInputs = refusedSlots.length > 0 ? { ...inputs, refusedSlots } : inputs;
    if (refusedSlots.length > 0) played.refused += 1;
    const refused = new Set(refusedSlots.map((slot) => slot.equipmentId));
    const validable = [...new Set(first.proposals
      .filter((proposal) => proposal.justification.supply?.originKey === RESERVOIR_ORIGIN && proposal.volumeCubicMeters !== null && !refused.has(proposal.equipmentId))
      .map((proposal) => proposal.equipmentId))];
    if (validable.length > 0 && random() < 0.4) {
      next = withValidatedProposals(next, first, [pick(validable)]);
      played.validated += 1;
    }
    const second = buildWeeklyPlan(next, used);
    assertInvariants(second, next, used);
    assertArbitration(second, next, `semaine ${run}, second calcul`);
  }
  // Chaque extension est jouée assez de fois pour compter.
  for (const [extension, weeks] of Object.entries(played)) assert.ok(weeks >= 20, `${extension} : ${weeks} semaines sur 200`);
});
