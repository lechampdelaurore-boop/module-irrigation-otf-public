import assert from 'node:assert/strict';
import test from 'node:test';
import type { CropSeries, ImplantationTask } from '../lib/domain/domain.ts';
import {
  implantationOfSeries,
  isIgnoredSeries,
  lastHarvestOfSeries,
  resolveSeriesOccupation,
} from '../lib/domain/series/occupation.ts';

const TODAY = '2026-09-29';

function series(input: Partial<CropSeries> & { id: string }): CropSeries {
  return {
    name: input.id,
    season: 2026,
    use: 'bed',
    cycle: 'annual',
    cultivations: [{ id: `${input.id}-c1`, plantId: 'p', plantName: 'Ail', harvestWeeks: ['2026-W24'], harvestWeeksExpected: ['2026-W25'] }],
    ...input,
  };
}

function task(input: Partial<ImplantationTask> & { id: string; seriesId: string }): ImplantationTask {
  return {
    cultivationId: `${input.seriesId}-c1`,
    kind: 'direct-sowing',
    plannedWeek: null,
    doneWeek: null,
    status: 'todo',
    ...input,
  };
}

test('les trois séries relevées sur la ferme le 26 septembre 2026 retrouvent leur semaine d’implantation', () => {
  // Aillet : semis direct fait en 2025-W45 ; Fève : plantation planifiée W50,
  // faite W51 ; Ail sec : semis direct fait W45 (docs/series-contract.md).
  const aillet = series({ id: 'aillet' });
  const feve = series({ id: 'feve' });
  const ailSec = series({ id: 'ail-sec' });
  const tasks = [
    task({ id: '1', seriesId: 'aillet', plannedWeek: '2025-W45', doneWeek: '2025-W45', status: 'done' }),
    task({ id: '2', seriesId: 'feve', kind: 'planting', plannedWeek: '2025-W50', doneWeek: '2025-W51', status: 'done' }),
    task({ id: '3', seriesId: 'ail-sec', plannedWeek: '2025-W45', doneWeek: '2025-W45', status: 'done' }),
  ];
  assert.deepEqual(implantationOfSeries(aillet, tasks), { week: '2025-W45', kind: 'direct-sowing', realized: true });
  assert.deepEqual(implantationOfSeries(feve, tasks), { week: '2025-W51', kind: 'planting', realized: true }, 'la semaine réalisée prime sur la planifiée');
  assert.deepEqual(implantationOfSeries(ailSec, tasks), { week: '2025-W45', kind: 'direct-sowing', realized: true });
});

test('une tâche non cochée compte pour sa semaine planifiée, la plus précoce l’emporte, et une tâche sans mise en culture vaut pour toutes', () => {
  const twoCultures = series({
    id: 's',
    cultivations: [
      { id: 's-c1', plantId: 'p1', plantName: 'Salade', harvestWeeks: [], harvestWeeksExpected: ['2026-W30'] },
      { id: 's-c2', plantId: 'p2', plantName: 'Radis', harvestWeeks: [], harvestWeeksExpected: ['2026-W20'] },
    ],
  });
  const tasks = [
    task({ id: '1', seriesId: 's', cultivationId: 's-c1', kind: 'planting', plannedWeek: '2026-W18', doneWeek: '2026-W19', status: 'todo' }),
    task({ id: '2', seriesId: 's', cultivationId: null, plannedWeek: '2026-W16', status: 'todo' }),
    task({ id: '3', seriesId: 'autre', cultivationId: null, plannedWeek: '2026-W01', status: 'done', doneWeek: '2026-W01' }),
  ];
  assert.deepEqual(implantationOfSeries(twoCultures, tasks), { week: '2026-W16', kind: 'direct-sowing', realized: false }, 'la tâche sur la série entière, planifiée, est la plus précoce');
  assert.deepEqual(
    implantationOfSeries(twoCultures, [tasks[0]]),
    { week: '2026-W18', kind: 'planting', realized: false },
    'non cochée : la semaine planifiée, même si une semaine réalisée traîne',
  );
  assert.equal(implantationOfSeries(twoCultures, [tasks[2]]), null, 'les tâches d’une autre série ne comptent pas');
  assert.equal(implantationOfSeries(twoCultures, [task({ id: '4', seriesId: 's', cultivationId: 's-c1' })]), null, 'une tâche sans semaine ne met rien au champ');
});

test('la dernière récolte est la dernière réalisée, sinon la dernière attendue, la plus tardive des mises en culture', () => {
  const s = series({
    id: 's',
    cultivations: [
      { id: 'a', plantId: 'p', plantName: 'A', harvestWeeks: ['2026-W14', '2026-W24', '2026-W20'], harvestWeeksExpected: ['2026-W30'] },
      { id: 'b', plantId: 'p', plantName: 'B', harvestWeeks: [], harvestWeeksExpected: ['2026-W22', '2026-W26'] },
    ],
  });
  assert.deepEqual(lastHarvestOfSeries(s), { week: '2026-W26', realized: false }, 'W26 attendue de B dépasse W24 réalisée de A ; l’attendu de A ne compte plus');
  assert.deepEqual(lastHarvestOfSeries(series({ id: 't', cultivations: [{ id: 'c', plantId: 'p', plantName: 'C', harvestWeeks: [], harvestWeeksExpected: [] }] })), null);
});

test('la période va du lundi de l’implantation au dimanche de la dernière récolte, sans être bornée par l’année civile', () => {
  const aillet = series({ id: 'aillet', cultivations: [{ id: 'aillet-c1', plantId: 'p', plantName: 'Ail', harvestWeeks: ['2026-W24'], harvestWeeksExpected: ['2026-W25'] }] });
  const occupation = resolveSeriesOccupation(aillet, [task({ id: '1', seriesId: 'aillet', plannedWeek: '2025-W45', doneWeek: '2025-W45', status: 'done' })], TODAY);
  assert.ok(!isIgnoredSeries(occupation));
  assert.equal(occupation.startDate, '2025-11-03', 'lundi de 2025-W45, pour une série de la saison 2026');
  assert.equal(occupation.endDate, '2026-06-14', 'dimanche de 2026-W24');
  assert.equal(occupation.status, 'finished');
  assert.deepEqual(occupation.lastHarvest, { week: '2026-W24', realized: true });
});

test('en cours, à venir, fin inconnue : trois statuts qui ne se confondent pas', () => {
  const ongoing = resolveSeriesOccupation(
    series({ id: 'tomates', cultivations: [{ id: 'tomates-c1', plantId: 'p', plantName: 'Tomate', harvestWeeks: [], harvestWeeksExpected: ['2026-W44'] }] }),
    [task({ id: '1', seriesId: 'tomates', kind: 'planting', plannedWeek: '2026-W16', doneWeek: '2026-W16', status: 'done' })],
    TODAY,
  );
  assert.ok(!isIgnoredSeries(ongoing) && ongoing.status === 'ongoing' && ongoing.endDate === '2026-11-01');

  const upcoming = resolveSeriesOccupation(
    series({ id: 'mache' }),
    [task({ id: '2', seriesId: 'mache', kind: 'planting', plannedWeek: '2026-W42', status: 'todo' })],
    TODAY,
  );
  assert.ok(!isIgnoredSeries(upcoming) && upcoming.status === 'upcoming' && upcoming.startDate === '2026-10-12');
  assert.ok(!isIgnoredSeries(upcoming) && upcoming.implantation.realized === false, 'implantation planifiée, pas réalisée');

  const open = resolveSeriesOccupation(
    series({ id: 'sans-recolte', cultivations: [{ id: 'sans-recolte-c1', plantId: 'p', plantName: 'X', harvestWeeks: [], harvestWeeksExpected: [] }] }),
    [task({ id: '3', seriesId: 'sans-recolte', plannedWeek: '2026-W10', doneWeek: '2026-W10', status: 'done' })],
    TODAY,
  );
  assert.ok(!isIgnoredSeries(open) && open.status === 'ongoing' && open.endDate === null && open.lastHarvest === null);
});

test('une série en bloc et une série sans implantation sont ignorées, avec leur motif', () => {
  assert.deepEqual(resolveSeriesOccupation(series({ id: 'endives', use: 'block' }), [task({ id: '1', seriesId: 'endives', plannedWeek: '2026-W20', doneWeek: '2026-W20', status: 'done' })], TODAY), { seriesId: 'endives', reason: 'block' });
  assert.deepEqual(resolveSeriesOccupation(series({ id: 'radis' }), [], TODAY), { seriesId: 'radis', reason: 'no-implantation' });
});

test('une pérenne implantée avant la saison commence au 1er janvier de la saison', () => {
  const perennial = series({ id: 'rhubarbe', cycle: 'perennial', cultivations: [{ id: 'rhubarbe-c1', plantId: 'p', plantName: 'Rhubarbe', harvestWeeks: [], harvestWeeksExpected: ['2026-W30'] }] });
  const occupation = resolveSeriesOccupation(perennial, [task({ id: '1', seriesId: 'rhubarbe', kind: 'planting', plannedWeek: '2024-W12', doneWeek: '2024-W12', status: 'done' })], TODAY);
  assert.ok(!isIgnoredSeries(occupation) && occupation.startDate === '2026-01-01' && occupation.implantation.week === '2024-W12');
  const annual = resolveSeriesOccupation(series({ id: 'aillet' }), [task({ id: '2', seriesId: 'aillet', plannedWeek: '2025-W45', doneWeek: '2025-W45', status: 'done' })], TODAY);
  assert.ok(!isIgnoredSeries(annual) && annual.startDate === '2025-11-03', 'une annuelle garde son implantation de l’année précédente');
});
