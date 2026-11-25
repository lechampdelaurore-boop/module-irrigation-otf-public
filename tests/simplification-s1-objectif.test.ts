import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { farmObjective, farmObjectiveScopeText, farmObjectiveText } from '../lib/domain/farm-objective.ts';
import { objectiveForBed } from '../lib/domain/irrigation-needs.ts';
import type { GoalRevisionLike } from '../lib/domain/irrigation-history/contract.ts';
import { todayWeek, type TodayWeekBed } from '../lib/domain/today/week.ts';
import { weekTotalsLine } from '../lib/domain/besoins-phone.ts';

/**
 * Simplifier l'usage du module, lot S1, PR 3 : un seul objectif, partout
 * (docs/simplification-s1-contract.md, section 5 et section 9.6 ; D-328).
 * Deux fermes : l'une où chaque planche a un objectif, de surfaces et
 * d'objectifs différents ; l'autre où une partie seulement en a un.
 */

const WEEK = { weekStart: '2026-11-23', weekEnd: '2026-11-29' };

const goal = (id: string, scope: GoalRevisionLike['scopeType'], amountMm: number, where: Partial<GoalRevisionLike> = {}): GoalRevisionLike => ({
  id, weekStart: WEEK.weekStart, scopeType: scope, otfZoneId: null, otfPlotId: null, otfBedId: null,
  amountMm, action: 'set', createdAt: `2026-11-23T0${id.length}:00:00.000Z`, ...where,
});

const todayBed = (plotId: string, areaSquareMeters: number, objectiveMm: number | null): TodayWeekBed => ({
  plotId, plotName: plotId, sheltered: false, areaSquareMeters, objectiveMm, actualRainMm: 0, actualIrrigationMm: 0,
  realRemainingMm: objectiveMm,
});

test('un seul calcul : la moyenne pondérée par la surface, sur les planches qui ont un objectif', () => {
  // Ferme 1 : 100 m² à 10 mm, 300 m² à 2 mm → (1 000 + 600) / 400 = 4 mm, pas (10 + 2) / 2 = 6 mm.
  const first = farmObjective([{ areaSquareMeters: 100, objectiveMm: 10 }, { areaSquareMeters: 300, objectiveMm: 2 }]);
  assert.deepEqual(first, { objectiveMm: 4, withObjective: 2, total: 2 });
  assert.equal(farmObjectiveText(first), '4 mm visés, ferme entière');
  // Ferme 2 : la planche sans objectif est comptée à voix haute, jamais à zéro (D-003).
  const second = farmObjective([{ areaSquareMeters: 50, objectiveMm: 20 }, { areaSquareMeters: 150, objectiveMm: 28 }, { areaSquareMeters: 800, objectiveMm: null }]);
  assert.deepEqual(second, { objectiveMm: 26, withObjective: 2, total: 3 });
  assert.equal(farmObjectiveText(second), '26 mm visés, 2 planches sur 3 ont un objectif');
  assert.equal(farmObjectiveScopeText({ objectiveMm: 5, withObjective: 1, total: 4 }), '1 planche sur 4 a un objectif');
  // Aucune planche n'a d'objectif : rien n'est inventé.
  assert.equal(farmObjectiveText(farmObjective([{ areaSquareMeters: 10, objectiveMm: null }])), 'aucune eau visée');
  assert.equal(farmObjective([]).objectiveMm, null);
  // Un objectif à 0 mm est un objectif (D-003 : un zéro saisi est une valeur).
  assert.deepEqual(farmObjective([{ areaSquareMeters: 10, objectiveMm: 0 }, { areaSquareMeters: 10, objectiveMm: null }]), { objectiveMm: 0, withObjective: 1, total: 2 });
});

test('S1-O1 : l’objectif « Toute la ferme » saisi n’est pas l’objectif de la ferme quand un jardin a le sien', () => {
  // La situation de la ferme réelle, en petit : 2,7 mm « Toute la ferme », 7 mm sur le jardin des tunnels.
  const revisions = [goal('f', 'farm', 2.7), goal('jardin', 'plot', 7, { otfZoneId: 'z', otfPlotId: 'tunnels' })];
  const beds = [
    { id: 'a', zoneId: 'z', plotId: 'tunnels', area: 300 },
    { id: 'b', zoneId: 'z', plotId: 'tunnels', area: 300 },
    { id: 'c', zoneId: 'z', plotId: 'champ', area: 200 },
  ];
  const objectives = beds.map((bed) => ({ areaSquareMeters: bed.area, objectiveMm: objectiveForBed(revisions, bed, WEEK.weekStart, WEEK.weekEnd).value }));
  const objective = farmObjective(objectives);
  // (7 × 600 + 2,7 × 200) / 800 = 5,925 mm : ce qu'« Aujourd'hui » dit, pas les 2,7 mm saisis.
  assert.ok(Math.abs((objective.objectiveMm ?? 0) - 5.925) < 1e-9);
  assert.equal(farmObjectiveText(objective), '5,9 mm visés, ferme entière');
});

test('« Aujourd’hui » et « Objectifs et besoins » disent le même chiffre, avec la même phrase', () => {
  for (const beds of [
    [todayBed('A', 100, 10), todayBed('B', 300, 2)],
    [todayBed('A', 50, 20), todayBed('A', 150, 28), todayBed('B', 800, null)],
  ]) {
    const week = todayWeek({ ...WEEK, beds, water: null });
    assert.ok(week);
    const objective = farmObjective(beds);
    assert.equal(week.farm.objectiveMm, objective.objectiveMm);
    assert.ok(week.tiles.objectiveDetail.startsWith(`${farmObjectiveScopeText(objective)}, `));
    const line = weekTotalsLine({ objective, realizedIrrigationMm: 0, actualRainMm: 0, remainingForecastRainMm: 0, et0Mm: 0, partial: false });
    assert.ok(line.startsWith(`${farmObjectiveText(objective)} · `), line);
  }
  // Les besoins de la semaine relus, et pas encore arrivés : la ligne ne montre pas un chiffre d'une autre semaine.
  assert.match(weekTotalsLine({ objective: null, realizedIrrigationMm: 0, actualRainMm: 0, remainingForecastRainMm: 0, et0Mm: 0, partial: false }), /^eau visée en cours de lecture · /);
});

test('règle 2 : aucune page ne refait sa moyenne de l’objectif', () => {
  const besoins = readFileSync('app/irrigation/water-management-dashboard.tsx', 'utf8');
  assert.doesNotMatch(besoins, /farmGoalMm|label="Objectif ferme"/, 'la ligne et la tuile ne lisent plus l’objectif « Toute la ferme » saisi');
  assert.match(besoins, /objective: farmObjective,/);
  assert.match(besoins, /farmObjectiveNotice\?\.weekStart === dashboard\.weekStart/, 'jamais l’objectif d’une autre semaine');
  assert.match(readFileSync('lib/domain/irrigation-needs.ts', 'utf8'), /farmObjective: farmObjective\(allBeds\),/);
  assert.match(readFileSync('app/irrigation/irrigation-needs-dashboard.tsx', 'utf8'), /notifyFarmObjectiveRead\(\{ weekStart: dashboard\.weekStart, objective: dashboard\.farmObjective \}\)/);
  assert.match(readFileSync('app/irrigation/besoins/page.tsx', 'utf8'), /initialFarmObjective=\{\{ weekStart: irrigationNeeds\.weekStart, objective: irrigationNeeds\.farmObjective \}\}/);
  const week = readFileSync('lib/domain/today/week.ts', 'utf8');
  assert.match(week, /const objective = farmObjective\(beds\);/);
  assert.doesNotMatch(week, /weighted\(scope, \(bed\) => bed\.objectiveMm\)/);
});
