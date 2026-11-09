import assert from 'node:assert/strict';
import test from 'node:test';
import { allocateIrrigationWater, type FeasibilityPool, type IrrigationArbitration, type PriorityFeasibility } from '../lib/domain/irrigation-feasibility.ts';
import type { BedIrrigationNeed, IrrigationNeedsDashboard } from '../lib/domain/irrigation-needs.ts';
import { initialArbitrationSelection, previewArbitration } from '../lib/domain/arbitration-preview.ts';

/**
 * L'écran d'arbitrage façon plan d'assolement (docs/shortage-contract.md,
 * 2 bis, D-083) : la part se recalcule dans le navigateur à chaque case, par
 * le calcul même du serveur, et la validation retrouve ces chiffres. Au
 * départ, toutes les planches à choisir sont cochées.
 */

const close = (actual: number | null, expected: number) => assert.ok(actual !== null && Math.abs(actual - expected) < 1e-6, `${actual} ≠ ${expected}`);
const bed = (id: string, need: number, patch: Partial<BedIrrigationNeed> = {}): BedIrrigationNeed => ({
  bedId: id, bedName: id, plotId: 'jardin-a', plotName: 'Jardin A', zoneId: 'parcelle-sud', zoneName: 'Parcelle Sud', sheltered: false,
  areaSquareMeters: 1000, wettedAreaSquareMeters: 1000, wettedAreaSource: 'drip', et0Mm: need, et0KnownMm: need, et0ReanalysisMm: need, et0ForecastMm: null,
  objectiveMm: need, objectiveSource: 'farm', actualRainMm: 0, actualIrrigationMm: 0,
  realRemainingMm: need, relativeDeficitPercent: 100, forecastRainMm: 0, plannedIrrigationMm: 0, rawPlanningNeedMm: need,
  thresholdMm: 0, calculatedNeedMm: need, manualOverrideMm: null, overrideReason: null, effectiveNeedMm: need, effectiveVolumeCubicMeters: need,
  priority: 'normal', weekStart: '2026-07-20', weekEnd: '2026-07-26', deadlineAt: '2026-07-26T22:00:00.000Z',
  completeness: { complete: true, missing: [], demandComplete: true, realComplete: true, planningComplete: true, missingDates: { et0: [], actualRain: [], forecastRain: [] }, estimatedDates: { actualRain: [] } },
  ...patch,
});
const pool = (amount: number, beds: BedIrrigationNeed[]): FeasibilityPool => ({ key: 'reservoir:r', name: 'Réserve', currentCubicMeters: amount, forecastCubicMeters: amount, reasons: [], paths: Object.fromEntries(beds.map((row) => [row.bedId, 'confirmed'])) });
const needs = (beds: BedIrrigationNeed[]) => ({
  season: 2026, weekStart: '2026-07-20', weekEnd: '2026-07-26', timeZone: 'Europe/Paris', calculatedAt: '2026-07-22T08:00:00.000Z', thresholdMm: 0,
  gardens: [{ plotId: 'jardin-a', plotName: 'Jardin A', zoneId: 'parcelle-sud', zoneName: 'Parcelle Sud', sheltered: false, areaSquareMeters: beds.length * 1000, bedCount: beds.length, priorityCounts: { high: 0, normal: beds.length, low: 0 }, realRemainingMm: null, effectiveNeedMm: null, effectiveVolumeCubicMeters: null, beds }],
  completeness: { complete: true, missing: [], demandComplete: true, realComplete: true, planningComplete: true, missingDates: { et0: [], actualRain: [], forecastRain: [] }, estimatedDates: { actualRain: [] } },
}) as IrrigationNeedsDashboard;
const decision = (priority: IrrigationArbitration['priority'], selected: string[], candidates: string[]): IrrigationArbitration => ({ priority, selectedBedIds: selected, candidateBedIds: candidates, decidedAt: '2026-07-22T09:00:00.000Z', invalidatedAt: null });
const level = (result: ReturnType<typeof allocateIrrigationWater>, priority: PriorityFeasibility['priority']) => result.priorities.find((item) => item.priority === priority)!;
const allocations = (row: PriorityFeasibility) => Object.fromEntries(row.beds.map((item) => [item.need.bedId, [item.allocatedCubicMeters, item.status]]));

// Une planche haute servie d'abord (20 m³), trois planches normales qui
// demandent 60 m³ pour 30 m³ restants, une basse en attente.
const ferme = [bed('H1', 20, { priority: 'high' }), bed('A1', 15), bed('A2', 15), bed('A3', 30), bed('C1', 40, { priority: 'low' })];
const reservedUnassignedCubicMeters = 5;
const serveur = (decisions: IrrigationArbitration[] = []) => allocateIrrigationWater({ needs: needs(ferme), pools: [pool(55, ferme)], decisions, reservedUnassignedCubicMeters, reservedPlannedCubicMeters: 12 });

test('la part recalculée dans le navigateur égale celle que le serveur calcule une fois le choix enregistré', () => {
  const avant = serveur();
  assert.equal(level(avant, 'normal').arbitration, 'required');
  for (const choix of [['A1', 'A2', 'A3'], ['A1', 'A3'], ['A2'], []]) {
    const apercu = previewArbitration(avant, 'normal', choix);
    const apres = serveur([decision('normal', choix, ['A1', 'A2', 'A3'])]);
    assert.deepEqual(allocations(apercu.level), allocations(level(apres, 'normal')), `choix ${choix.join(', ') || 'vide'}`);
    close(apercu.level.allocatedCubicMeters, level(apres, 'normal').allocatedCubicMeters);
  }
});

test('décocher une planche monte la part des autres, la même pour toutes les cochées', () => {
  const avant = serveur();
  const toutes = previewArbitration(avant, 'normal', ['A1', 'A2', 'A3']);
  close(toutes.share, 0.5);
  close(toutes.selectedNeedCubicMeters, 60);
  close(toutes.availableCubicMeters, 30);
  close(toutes.allocatedCubicMeters, 30);
  close(toutes.leftoverCubicMeters, 0);
  const deux = previewArbitration(avant, 'normal', ['A1', 'A2']);
  close(deux.share, 1);
  close(deux.allocatedCubicMeters, 30);
  const une = previewArbitration(avant, 'normal', ['A2']);
  close(une.share, 1);
  close(une.leftoverCubicMeters, 15);
  const a3 = une.level.beds.find((row) => row.need.bedId === 'A3')!;
  assert.equal(a3.status, 'not_selected');
  close(a3.allocatedCubicMeters, 0);
});

test('aucune planche cochée : rien n’est réparti et toute l’eau du niveau reste', () => {
  const vide = previewArbitration(serveur(), 'normal', []);
  assert.equal(vide.share, null);
  close(vide.allocatedCubicMeters, 0);
  close(vide.leftoverCubicMeters, 30);
  assert.ok(vide.level.beds.every((row) => row.status === 'not_selected' || row.need.priority !== 'normal'));
});

test('une part sous le seuil n’est pas transmise : la ligne le dit et le bilan la compte à part', () => {
  const seuil = ferme.map((row) => ({ ...row, thresholdMm: 10 }));
  const avant = allocateIrrigationWater({ needs: needs(seuil), pools: [pool(55, seuil)], decisions: [], reservedUnassignedCubicMeters });
  // 30 m³ pour 60 : 7,5 mm sur A1 et A2, sous les 10 mm ; 15 mm sur A3.
  const toutes = previewArbitration(avant, 'normal', ['A1', 'A2', 'A3']);
  assert.deepEqual(toutes.belowThresholdBedIds, ['A1', 'A2']);
  close(toutes.belowThresholdCubicMeters, 15);
  close(toutes.allocatedCubicMeters, 15);
  close(toutes.leftoverCubicMeters, 0);
  assert.equal(toutes.level.beds.find((row) => row.need.bedId === 'A1')!.status, 'below_threshold');
  // Servir moins de planches : chacune reçoit davantage, au-dessus du seuil.
  const moins = previewArbitration(avant, 'normal', ['A1', 'A2']);
  assert.deepEqual(moins.belowThresholdBedIds, []);
  close(moins.allocatedCubicMeters, 30);
});

test('le choix d’un niveau ne touche ni les niveaux d’avant ni leurs décisions', () => {
  const haute = [bed('H1', 20, { priority: 'high' }), bed('H2', 20, { priority: 'high' }), bed('A1', 15), bed('A2', 15)];
  const avec = (decisions: IrrigationArbitration[]) => allocateIrrigationWater({ needs: needs(haute), pools: [pool(30, haute)], decisions });
  const avant = avec([decision('high', ['H1'], ['H1', 'H2'])]);
  assert.equal(level(avant, 'high').arbitration, 'validated');
  const apercu = previewArbitration(avant, 'normal', ['A1']);
  const apres = avec([decision('high', ['H1'], ['H1', 'H2']), decision('normal', ['A1'], ['A1', 'A2'])]);
  assert.deepEqual(allocations(apercu.level), allocations(level(apres, 'normal')));
  close(apercu.availableCubicMeters, 10);
});

test('au départ, toutes les planches à choisir sont cochées ; un choix caduc repart de la proposition', () => {
  const avant = serveur();
  assert.deepEqual(initialArbitrationSelection(level(avant, 'normal')), ['A1', 'A2', 'A3']);
  const enregistre = serveur([decision('normal', ['A1'], ['A1', 'A2', 'A3'])]);
  assert.equal(level(enregistre, 'normal').arbitration, 'validated');
  assert.deepEqual(initialArbitrationSelection(level(enregistre, 'normal')), ['A1']);
  // Une planche de plus parmi les candidates : le choix d'avant est caduc, ses exclusions ne ressuscitent pas.
  const caduc = serveur([decision('normal', ['A1'], ['A1', 'A2'])]);
  assert.equal(level(caduc, 'normal').arbitration, 'revalidation_required');
  assert.deepEqual(initialArbitrationSelection(level(caduc, 'normal')), ['A1', 'A2', 'A3']);
});
