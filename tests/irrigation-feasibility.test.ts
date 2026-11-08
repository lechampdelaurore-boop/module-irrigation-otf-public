import assert from 'node:assert/strict';
import test from 'node:test';
import { allocateIrrigationWater, routeWater, type FeasibilityPool, type IrrigationArbitration } from '../lib/domain/irrigation-feasibility.ts';
import type { BedIrrigationNeed, IrrigationNeedsDashboard } from '../lib/domain/irrigation-needs.ts';
import { describeFeasibilityPaths } from '../lib/domain/feasibility-hydraulics.ts';

const close = (actual: number | null, expected: number) => assert.ok(actual !== null && Math.abs(actual - expected) < 1e-6, `${actual} ≠ ${expected}`);
const bed = (id: string, need: number | null, patch: Partial<BedIrrigationNeed> = {}): BedIrrigationNeed => ({
  bedId: id, bedName: id, plotId: 'garden', plotName: 'Jardin', zoneId: 'zone', zoneName: 'Parcelle', sheltered: true,
  areaSquareMeters: 1000, wettedAreaSquareMeters: 1000, wettedAreaSource: 'drip', et0Mm: need, et0KnownMm: need, et0ReanalysisMm: need, et0ForecastMm: null,
  objectiveMm: need, objectiveSource: 'farm', actualRainMm: 0, actualIrrigationMm: 0,
  realRemainingMm: need, relativeDeficitPercent: 100, forecastRainMm: 0, plannedIrrigationMm: 0, rawPlanningNeedMm: need,
  thresholdMm: 0, calculatedNeedMm: need, manualOverrideMm: null, overrideReason: null, effectiveNeedMm: need, effectiveVolumeCubicMeters: need,
  priority: 'high', weekStart: '2026-09-07', weekEnd: '2026-09-13', deadlineAt: '2026-09-13T22:00:00.000Z', completeness: { complete: need !== null, missing: [], demandComplete: need !== null, realComplete: need !== null, planningComplete: need !== null, missingDates: { et0: [], actualRain: [], forecastRain: [] }, estimatedDates: { actualRain: [] } }, ...patch,
});
const pool = (amount: number | null, beds: BedIrrigationNeed[], key = 'reservoir:r'): FeasibilityPool => ({ key, name: key, currentCubicMeters: amount, forecastCubicMeters: amount, reasons: [], paths: Object.fromEntries(beds.map((row) => [row.bedId, 'confirmed'])) });
const needs = (beds: BedIrrigationNeed[]): IrrigationNeedsDashboard => ({ season: 2026, weekStart: '2026-09-07', weekEnd: '2026-09-13', timeZone: 'Europe/Paris', calculatedAt: '2026-09-08T12:00:00.000Z', thresholdMm: 0,
  gardens: [{ plotId: 'garden', plotName: 'Jardin', zoneId: 'zone', zoneName: 'Parcelle', sheltered: true, areaSquareMeters: beds.length * 1000, bedCount: beds.length, priorityCounts: { high: beds.length, normal: 0, low: 0 }, realRemainingMm: null, effectiveNeedMm: null, effectiveVolumeCubicMeters: null, beds }], completeness: { complete: true, missing: [], demandComplete: true, realComplete: true, planningComplete: true, missingDates: { et0: [], actualRain: [], forecastRain: [] }, estimatedDates: { actualRain: [] } } });
const decision = (selected: string[], candidates: string[], priority: IrrigationArbitration['priority'] = 'high'): IrrigationArbitration => ({ priority, selectedBedIds: selected, candidateBedIds: candidates, decidedAt: '2026-09-08T11:00:00.000Z', invalidatedAt: null });
const run = (beds: BedIrrigationNeed[], amount: number | null, decisions: IrrigationArbitration[] = [], pools = [pool(amount, beds)]) => allocateIrrigationWater({ needs: needs(beds), pools, decisions });
const row = (result: ReturnType<typeof run>, id: string) => result.priorities.flatMap((level) => level.beds).find((item) => item.need.bedId === id)!;

test('3.4 couverture complète 50/70 : 50 satisfaits, déficit zéro, 100 %', () => {
  const result = run([bed('A', 20), bed('B', 30)], 70);
  close(result.allocatedCubicMeters, 50); close(result.residualDeficitCubicMeters, 0); close(result.coveragePercent, 100);
});
test('3.4 pénurie 120/90 : maximum 90, déficit 30, couverture 75 avant sélection', () => {
  const result = run([bed('A', 60), bed('B', 60)], 90);
  close(result.allocatableCubicMeters, 90); close(result.residualDeficitCubicMeters, 30); close(result.coveragePercent, 75);
  close(result.allocatedCubicMeters, 0); assert.equal(result.requiresManualArbitration, true);
});
test('3.4 priorités strictes et blocage du niveau suivant avant arbitrage', () => {
  const result = run([bed('H', 20), bed('N1', 15, { priority: 'normal' }), bed('N2', 15, { priority: 'normal' }), bed('L', 40, { priority: 'low' })], 40);
  close(row(result, 'H').allocatedCubicMeters, 20); assert.equal(row(result, 'N1').status, 'arbitration_required'); close(row(result, 'L').allocatedCubicMeters, 0);
});
test('3.4 déficit relatif ne remplace pas la priorité', () => {
  const result = run([bed('H', 5, { relativeDeficitPercent: 10 }), bed('N', 10, { priority: 'normal', relativeDeficitPercent: 80 })], 5);
  close(row(result, 'H').allocatedCubicMeters, 5); close(row(result, 'N').allocatedCubicMeters, 0);
});
test('3.4 avant arbitrage aucune sélection automatique entre A10 B20 avec15', () => {
  const result = run([bed('A', 10), bed('B', 20)], 15);
  assert.equal(result.requiresManualArbitration, true); close(row(result, 'A').allocatedCubicMeters, 0); close(row(result, 'B').allocatedCubicMeters, 0);
});
test('3.4 sélection A seule, B exclue, reliquat5 vers normale', () => {
  const result = run([bed('A', 10), bed('B', 20), bed('C', 5, { priority: 'normal' })], 15, [decision(['A'], ['A', 'B'])]);
  close(row(result, 'A').allocatedCubicMeters, 10); assert.equal(row(result, 'B').status, 'not_selected'); close(row(result, 'C').allocatedCubicMeters, 5);
});
test('3.4 sélection A+B donne5+10 indépendamment de l’ordre', () => {
  for (const beds of [[bed('A', 10), bed('B', 20)], [bed('B', 20), bed('A', 10)]]) {
    const result = run(beds, 15, [decision(['B', 'A'], ['A', 'B'])]);
    close(row(result, 'A').allocatedCubicMeters, 5); close(row(result, 'B').allocatedCubicMeters, 10); close(row(result, 'B').satisfactionPercent, 50);
  }
});
test('3.4 sélection vide explicite libère l’eau pour le niveau inférieur', () => {
  const result = run([bed('A', 10), bed('B', 20), bed('C', 5, { priority: 'normal' })], 15, [decision([], ['A', 'B'])]);
  assert.equal(row(result, 'A').status, 'not_selected'); close(row(result, 'C').allocatedCubicMeters, 5);
});
test('3.4 une seule planche reçoit12mm sur20 sans arbitrage,60%,résidu8mm', () => {
  const result = run([bed('A', 20)], 12); close(row(result, 'A').allocatedMm, 12); close(row(result, 'A').satisfactionPercent, 60); close(row(result, 'A').residualMm, 8);
});
test('3.4 allocation0,8 sous seuil2 retenue zéro et aucun transfert à3.5 ni au niveau suivant', () => {
  const result = run([bed('A', 20, { thresholdMm: 2 }), bed('C', 10, { priority: 'normal' })], .8);
  assert.equal(row(result, 'A').status, 'below_threshold'); close(row(result, 'A').usableForPlanningCubicMeters, 0); close(result.withheldBelowThresholdCubicMeters, .8); close(row(result, 'C').allocatedCubicMeters, 0);
  close(result.coveragePercent, 0); close(result.residualDeficitCubicMeters, 30);
});
test('3.4 seuil exact autorisé', () => { close(row(run([bed('A', 10, { thresholdMm: 2 })], 2), 'A').allocatedMm, 2); });
test('3.4 la couverture finale respecte les exclusions manuelles', () => {
  const result = run([bed('A', 10), bed('B', 20)], 15, [decision(['A'], ['A', 'B'])]); close(result.coveragePercent, 100 / 3); close(result.residualDeficitCubicMeters, 20);
});
test('3.4 réserve inconnue reste null, besoin et incertitude conservés', () => {
  const result = run([bed('A', 20)], null); assert.equal(result.forecastAvailableCubicMeters, null); assert.equal(result.currentAvailableCubicMeters, null); assert.equal(row(result, 'A').status, 'unknown'); close(result.totalNeedCubicMeters, 20);
});
test('3.4 sans pompe l’eau reste potentielle, non impossible, non exécutable', () => {
  const beds = [bed('A', 20)]; const result = run(beds, 20, [], [{ ...pool(20, beds), paths: { A: 'unverified' } }]);
  close(result.allocatedCubicMeters, 20); close(result.confirmedAllocatedCubicMeters, 0); close(row(result, 'A').usableForPlanningCubicMeters, 0); assert.equal(row(result, 'A').hydraulicQuality, 'unverified');
});
test('3.4 disponibilités actuelle20 et prévue35 restent distinctes', () => {
  const beds = [bed('A', 40)]; const result = run(beds, 20, [], [{ ...pool(35, beds), currentCubicMeters: 20 }]); close(result.currentAvailableCubicMeters, 20); close(result.forecastAvailableCubicMeters, 35);
});
test('3.4 aucun double retrait du planifié : budget net40 et besoin effectif40', () => {
  const result = run([bed('A', 40, { plannedIrrigationMm: 20 })], 40); close(result.allocatedCubicMeters, 40); close(result.coveragePercent, 100);
});
test('3.4 changements météo/besoins/stocks conservent la sélection et recalculent', () => {
  const saved = decision(['A', 'B'], ['A', 'B']); const result = run([bed('A', 20), bed('B', 40)], 24, [saved]);
  assert.equal(result.priorities[0].arbitration, 'validated'); close(row(result, 'A').allocatedCubicMeters, 8); close(row(result, 'B').allocatedCubicMeters, 16);
});
test('3.4 changement priorité, besoin nul ou nouveau candidat impose revalidation', () => {
  for (const beds of [[bed('A', 10), bed('B', 20, { priority: 'normal' }), bed('C', 20)], [bed('A', 0), bed('B', 20), bed('C', 10)], [bed('A', 10), bed('B', 20), bed('C', 10)]]) {
    const result = run(beds, 5, [decision(['A'], ['A', 'B'])]); assert.equal(result.priorities[0].arbitration, 'revalidation_required');
  }
});
test('3.4 pénurie disparue rend les exclusions obsolètes, sans résurrection', () => {
  const saved = decision(['A'], ['A', 'B']); const beds = [bed('A', 10), bed('B', 20)];
  assert.equal(run(beds, 40, [saved]).priorities[0].arbitration, 'obsolete');
  assert.equal(run(beds, 15, [{ ...saved, invalidatedAt: '2026-09-08T12:00:00Z' }]).priorities[0].arbitration, 'revalidation_required');
});
test('3.4 ressources incompatibles respectées et sources réorientées pour préserver les priorités', () => {
  const beds = [bed('H', 10), bed('L', 10, { priority: 'low' })];
  const pools = [{ ...pool(10, beds, 'r1'), paths: { H: 'confirmed', L: 'confirmed' } }, { ...pool(10, beds, 'r2'), paths: { H: 'confirmed', L: 'incompatible' } }] as FeasibilityPool[];
  for (const sources of [pools, [...pools].reverse()]) { const result = run(beds, 20, [], sources); close(result.allocatedCubicMeters, 20); }
});
test('3.4 proportion commune respecte les sources exclusives et laisse un reliquat explicite', () => {
  const beds = [bed('A', 10), bed('B', 10)]; const pools = [{ ...pool(1, beds, 'r1'), paths: { A: 'confirmed', B: 'incompatible' } }, { ...pool(100, beds, 'r2'), paths: { A: 'incompatible', B: 'confirmed' } }] as FeasibilityPool[];
  const result = run(beds, 101, [decision(['A', 'B'], ['A', 'B'])], pools); close(row(result, 'A').allocatedCubicMeters, 1); close(row(result, 'B').allocatedCubicMeters, 1); close(result.unallocatedCubicMeters, 99);
});
test('3.4 les volumes confirmés suivent les priorités, pas le tri des identifiants', () => {
  const beds = [bed('z', 10), bed('a', 10, { priority: 'low' })]; const result = run(beds, 20, [], [pool(10, beds), { ...pool(10, beds, 'r2'), paths: { z: 'unverified', a: 'unverified' } }]);
  close(row(result, 'z').confirmedCubicMeters, 10); close(row(result, 'a').confirmedCubicMeters, 0);
});
test('3.4 besoin nul =100%, surface nulle ou besoin manquant non calculables', () => {
  close(row(run([bed('A', 0)], 0), 'A').satisfactionPercent, 100);
  assert.equal(run([bed('A', null)], 20).totalNeedCubicMeters, null);
  // La surface qui convertit est la surface mouillée (D-022) ; nulle ou inconnue, la dose l'est aussi.
  assert.equal(row(run([bed('A', 5, { wettedAreaSquareMeters: 0 })], 20), 'A').allocatedMm, null);
});
test('3.4 conversion des volumes selon la surface sans moyenne simple', () => { const beds = [bed('A', .2, { wettedAreaSquareMeters: 10, effectiveNeedMm: 20 })]; close(row(run(beds, .12), 'A').allocatedMm, 12); });
test('3.4 un planifié sans origine réserve le volume une seule fois', () => { const beds = [bed('A', 40)]; const result = allocateIrrigationWater({ needs: needs(beds), pools: [pool(60, beds)], decisions: [], reservedUnassignedCubicMeters: 20 }); close(result.allocatedCubicMeters, 40); close(result.forecastAvailableCubicMeters, 40); });
test('3.4 aucune chaîne connue quand pompe ou placement manque', () => { const beds = [bed('A', 20)]; const result = describeFeasibilityPaths({ pools: [pool(20, beds)], beds, coverage: { beds: [], equipment: [], overlapBedCount: 0, maxRateMmPerHour: 0 }, pumps: [], equipmentDefaults: [] }); assert.equal(result[0].paths.A, 'unverified'); });
test('3.4 aucun flot à travers une incompatibilité explicite', () => { const beds = [bed('A', 10)]; close(routeWater([{ ...pool(20, beds), paths: { A: 'incompatible' } }], { A: 10 }, 20).total, 0); });

test('3.4 une planche sans liaison confirmée ne masque pas les autres confirmations', () => {
  const beds = [bed('A', 10), bed('B', 10)];
  const result = run(beds, 20, [], [{ ...pool(10, beds, 'r1'), paths: { A: 'confirmed', B: 'unverified' } }, { ...pool(10, beds, 'r2'), paths: { A: 'unverified', B: 'unverified' } }]);
  close(row(result, 'A').confirmedCubicMeters, 10); close(row(result, 'B').confirmedCubicMeters, 0); close(result.potentialAdditionalCubicMeters, 10);
});

test('3.4 confirmer A ne peut pas reprendre l’unique eau nécessaire à B', () => {
  const beds = [bed('A', 10), bed('B', 10)];
  const result = run(beds, 20, [], [pool(10, beds, 'r1'), { ...pool(10, beds, 'r2'), paths: { A: 'unverified', B: 'incompatible' } }]);
  close(result.allocatedCubicMeters, 20); close(row(result, 'A').confirmedCubicMeters, 0); close(row(result, 'B').confirmedCubicMeters, 10);
});

test('5.0 la dose en mm d’une allocation se calcule sur la surface mouillée, pas sur la planche', () => {
  // 16 m³ font 10 mm sur 1 600 m² mouillés (1 000 m² de planche et son passe-pied) : l'aller-retour
  // mm → m³ → mm rend la valeur de départ (docs/wetted-surface-contract.md).
  const result = run([bed('A', 16, { effectiveNeedMm: 10, wettedAreaSquareMeters: 1600, wettedAreaSource: 'sprinkler' })], 16);
  close(row(result, 'A').allocatedMm, 10); close(row(result, 'A').residualMm, 0);
  const shortage = run([bed('A', 16, { effectiveNeedMm: 10, wettedAreaSquareMeters: 1600, wettedAreaSource: 'sprinkler' })], 8);
  close(row(shortage, 'A').allocatedMm, 5); close(row(shortage, 'A').residualMm, 5);
});
test('5.0 une surface mouillée inconnue laisse le besoin inconnu et le signale, sans toucher aux autres', () => {
  const result = run([bed('A', 10, { effectiveVolumeCubicMeters: null, wettedAreaSquareMeters: null, wettedAreaSource: 'unknown-alley' }), bed('B', 10)], 20);
  assert.equal(row(result, 'A').status, 'unknown'); assert.equal(result.unknownNeedCount, 1); assert.equal(result.totalNeedCubicMeters, null);
  close(row(result, 'B').allocatedCubicMeters, 10);
  assert.ok(result.warnings.some((warning) => warning.includes('non calculable')));
});
test('3.4 réutilise les contraintes pompe : défaut explicite exclu, donnée manquante inconnue', () => {
  const beds = [bed('A', 10)];
  const input: Parameters<typeof describeFeasibilityPaths>[0] = {
    pools: [pool(20, beds)], beds,
    coverage: { beds: [{ bedId: 'A', totalRateMmPerHour: 2, contributions: [{ equipmentId: 'e', equipmentName: 'Rampe', settingId: 's', settingName: 'Standard', rateMmPerHour: 2, kind: 'sprinkler' }] }], equipment: [{ equipmentId: 'e', equipmentName: 'Rampe', settingId: 's', settingName: 'Standard', bedCount: 1, unknownAreaBedCount: 0, totalLitersPerHour: 2000 }], overlapBedCount: 0, maxRateMmPerHour: 2 },
    pumps: [{ id: 'p', name: 'Pompe', maximumFlowCubicMetersPerHour: 1, status: 'active', archivedAt: null, notes: null, origins: [{ id: 'o', pumpId: 'p', sourceKind: 'reservoir', resourceId: null, reservoirId: 'r', isDefault: true }] }], equipmentDefaults: [{ equipmentId: 'e', pumpId: 'p' }],
  };
  assert.equal(describeFeasibilityPaths(input)[0].paths.A, 'incompatible');
  input.pumps[0].maximumFlowCubicMetersPerHour = 3;
  assert.equal(describeFeasibilityPaths(input)[0].paths.A, 'confirmed');
  input.pumps[0].status = 'archived';
  assert.equal(describeFeasibilityPaths(input)[0].paths.A, 'incompatible');
  input.equipmentDefaults = [];
  assert.equal(describeFeasibilityPaths(input)[0].paths.A, 'unverified');
});
