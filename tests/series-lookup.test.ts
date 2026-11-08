import assert from 'node:assert/strict';
import test from 'node:test';
import type { CropPlan } from '../lib/domain/domain.ts';
import { seriesNamesOccupyingBedsOn } from '../lib/domain/series/lookup.ts';

const cropPlan: CropPlan = {
  series: [
    { id: 'carottes', name: 'Carottes', season: 2026, use: 'bed', cycle: 'annual', cultivations: [{ id: 'c1', plantId: 'p', plantName: 'Carotte', harvestWeeks: ['2026-W26'], harvestWeeksExpected: [] }] },
    { id: 'mache', name: 'Mâche', season: 2026, use: 'bed', cycle: 'annual', cultivations: [{ id: 'c2', plantId: 'p', plantName: 'Mâche', harvestWeeks: [], harvestWeeksExpected: ['2026-W40'] }] },
    { id: 'radis', name: 'Radis', season: 2026, use: 'bed', cycle: 'annual', cultivations: [] },
    { id: 'endives', name: 'Endives', season: 2026, use: 'block', cycle: 'annual', cultivations: [] },
  ],
  places: [
    { id: 'p1', seriesId: 'carottes', bedId: 'bed-n01', lengthMeters: 30 },
    { id: 'p2', seriesId: 'mache', bedId: 'bed-n01', lengthMeters: 16 },
    { id: 'p3', seriesId: 'radis', bedId: 'bed-n01', lengthMeters: 30 },
  ],
  implantationTasks: [
    { id: 't1', seriesId: 'carottes', cultivationId: null, kind: 'direct-sowing', plannedWeek: '2026-W12', doneWeek: '2026-W12', status: 'done' },
    { id: 't2', seriesId: 'mache', cultivationId: null, kind: 'direct-sowing', plannedWeek: '2026-W26', doneWeek: '2026-W26', status: 'done' },
    { id: 't3', seriesId: 'endives', cultivationId: null, kind: 'direct-sowing', plannedWeek: '2026-W10', doneWeek: '2026-W10', status: 'done' },
  ],
  readSummary: { seriesRead: 4, placesRead: 3, tasksRead: 3, tasksRetained: 3, placesWithoutSeries: 0, placesOfUnknownSeries: 0, placesWithUnknownBed: 0 },
};

test('les séries présentes sur une planche un jour donné sont celles dont la période contient ce jour, ignorées exclues', () => {
  assert.deepEqual(seriesNamesOccupyingBedsOn(cropPlan, ['bed-n01'], '2026-04-10'), ['Carottes']);
  assert.deepEqual(seriesNamesOccupyingBedsOn(cropPlan, ['bed-n01'], '2026-06-24'), ['Carottes', 'Mâche'], 'la semaine commune compte pour les deux');
  assert.deepEqual(seriesNamesOccupyingBedsOn(cropPlan, ['bed-n01'], '2026-07-10'), ['Mâche']);
  assert.deepEqual(seriesNamesOccupyingBedsOn(cropPlan, ['bed-n01'], '2026-03-01'), [], 'avant toute implantation');
  assert.deepEqual(seriesNamesOccupyingBedsOn(cropPlan, ['bed-n02'], '2026-06-24'), [], 'une autre planche');
  assert.deepEqual(seriesNamesOccupyingBedsOn(undefined, ['bed-n01'], '2026-06-24'), [], 'plan non lu : rien, sans erreur');
});
