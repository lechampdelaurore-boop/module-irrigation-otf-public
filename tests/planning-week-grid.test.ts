import assert from 'node:assert/strict';
import test from 'node:test';
import type { StoredProposal } from '../lib/domain/planning/contract.ts';
import type { PlanDay } from '../lib/domain/planning/presentation.ts';
import { planDayCells, planWeekRows } from '../lib/domain/planning/week-grid.ts';

const proposal = (storedId: string, equipmentId: string, equipmentName: string, startAt: string) =>
  ({ storedId, equipmentId, equipmentName, startAt }) as unknown as StoredProposal;
const day = (dateKey: string, proposals: StoredProposal[]): PlanDay =>
  ({ dateKey, beforeHorizon: false, proposals, counts: {}, volumeCubicMeters: 0, unknownVolumeCount: 0 }) as unknown as PlanDay;

test('la semaine en tableau : une ligne par matériel proposé, une fois, dans l’ordre des noms (P46)', () => {
  const days = [
    day('2026-11-09', [proposal('a', 'e-2', 'Rampe 10', '2026-11-09T05:00:00Z'), proposal('b', 'e-1', 'Rampe 2', '2026-11-09T06:00:00Z')]),
    day('2026-11-10', []),
    day('2026-11-11', [proposal('c', 'e-3', 'Goutte-à-goutte A', '2026-11-11T05:00:00Z'), proposal('d', 'e-1', 'Rampe 2', '2026-11-11T07:00:00Z')]),
  ];
  assert.deepEqual(planWeekRows(days).map((row) => row.equipmentName), ['Goutte-à-goutte A', 'Rampe 2', 'Rampe 10']);
  assert.deepEqual(planWeekRows([day('2026-11-09', [])]), []);
});

test('les cases d’un jour : ses créneaux sous la ligne de leur matériel, deux créneaux du même matériel dans la même case (P46)', () => {
  const monday = day('2026-11-09', [
    proposal('a', 'e-2', 'Rampe 10', '2026-11-09T05:00:00Z'),
    proposal('b', 'e-1', 'Rampe 2', '2026-11-09T06:00:00Z'),
    proposal('c', 'e-2', 'Rampe 10', '2026-11-09T18:00:00Z'),
  ]);
  const rows = planWeekRows([monday]);
  assert.deepEqual(planDayCells(monday, rows).map((cell) => [cell.row, cell.proposals.map((item) => item.storedId)]), [[0, ['b']], [1, ['a', 'c']]]);
  assert.throws(() => planDayCells(monday, []), /absent des lignes/u);
});
