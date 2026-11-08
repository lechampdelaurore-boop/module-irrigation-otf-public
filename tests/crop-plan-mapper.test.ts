import assert from 'node:assert/strict';
import test from 'node:test';
import { mapCropPlan } from '../lib/domain/otf/crop-plan-mapper.ts';
import { OtfApiError } from '../lib/domain/otf/api-contract.ts';

// Réponses réduites, calquées sur celles constatées sur la ferme le
// 26 septembre 2026 (docs/series-contract.md, « Ce que l'API fournit »).
const actions = [
  { id: 288, name: 'Semis direct', fqn: 'semis-direct' },
  { id: 287, name: 'Plantation', fqn: 'plantation' },
  { id: 286, name: 'Semis en pépinière', fqn: 'semis-pepiniere' },
  { id: 270, name: 'Irrigation', fqn: null },
];
const plants = [
  { id: 937, name: 'Ail', fqn: 'ail' },
  { id: 975, name: 'Fève', fqn: 'feve' },
];
const series = [
  {
    id: 51010, name: 'Aillet', season: 2026, use: 'bed', cycle: 'annual', status: 'open',
    cultivations: [{
      id: 53064, series: 51010, plant: 937,
      harvestWeeks: ['2026-W14', '2026-W15'], harvestWeeksExpected: ['2026-W20', '2026-W21'],
    }],
  },
  {
    id: 54081, name: 'Fève', season: 2026, use: 'bed', cycle: 'annual', status: 'open',
    cultivations: [{ id: 56201, series: 54081, plant: 975, harvestWeeks: null, harvestWeeksExpected: ['2026-W22'] }],
  },
  { id: 60000, name: 'Endives', season: 2026, use: 'block', cycle: 'annual', status: 'open', cultivations: [] },
  { id: 70000, name: 'Aillet 2027', season: 2027, use: 'bed', cycle: 'annual', status: 'open', cultivations: [] },
];
const places = [
  { id: 125090, season: 2026, series: 51010, task: null, zone: 14, plot: 68, bed: 629, length: 32, width: 75, area: 38.4 },
  { id: 125091, season: 2026, series: 54081, task: null, zone: 14, plot: 68, bed: 630, length: 16, width: 75, area: 19.2 },
  { id: 125092, season: 2026, series: null, task: 1, zone: 14, plot: 68, bed: 629, length: 8, width: 75, area: 9.6 },
  { id: 125093, season: 2026, series: 51010, task: null, zone: 14, plot: 68, bed: 999, length: 8, width: 75, area: 9.6 },
  { id: 125094, season: 2026, series: 88888, task: null, zone: 14, plot: 68, bed: 629, length: 8, width: 75, area: 9.6 },
];
const tasks = [
  { id: 844280, cultivation: 53064, series: 51010, action: 288, plannedWeek: '2025-W45', doneWeek: '2025-W45', status: 'done' },
  { id: 855511, cultivation: 56201, series: 54081, action: 287, plannedWeek: '2025-W50', doneWeek: '2025-W51', status: 'done', description: 'à ne pas garder', time: 2.3 },
  { id: 855512, cultivation: null, series: 54081, action: 287, plannedWeek: '2026-W02', doneWeek: null, status: 'todo' },
  { id: 855513, cultivation: 53064, series: 51010, action: 286, plannedWeek: '2025-W40', doneWeek: '2025-W40', status: 'done' },
  { id: 855514, cultivation: 53064, series: 51010, action: 270, plannedWeek: '2026-W10', doneWeek: null, status: 'todo' },
  { id: 855515, cultivation: null, series: 70000, action: 288, plannedWeek: '2026-W45', doneWeek: null, status: 'todo' },
  { id: 855516, cultivation: null, series: null, action: 288, plannedWeek: '2026-W45', doneWeek: null, status: 'todo' },
];
const beds = [{ id: '629' }, { id: '630' }];

const plan = () => mapCropPlan({ rawActions: actions, rawPlants: plants, rawSeries: series, rawPlaces: places, rawTasks: tasks, season: 2026, beds });

test('les séries de la saison sont retenues avec leurs mises en culture nommées, les autres saisons écartées', () => {
  const { series: mapped, readSummary } = plan();
  assert.deepEqual(mapped.map((item) => item.id), ['51010', '54081', '60000'], 'la série 2027 ne fait pas partie de la saison');
  assert.equal(readSummary.seriesRead, 4);
  const aillet = mapped[0];
  assert.equal(aillet.name, 'Aillet');
  assert.equal(aillet.use, 'bed');
  assert.equal(aillet.cycle, 'annual');
  assert.deepEqual(aillet.cultivations, [{
    id: '53064', plantId: '937', plantName: 'Ail',
    harvestWeeks: ['2026-W14', '2026-W15'], harvestWeeksExpected: ['2026-W20', '2026-W21'],
  }]);
  assert.deepEqual(mapped[1].cultivations[0].harvestWeeks, [], 'une liste absente est une liste vide, pas une erreur');
  assert.equal(mapped[2].use, 'block', 'une série en bloc est retenue telle quelle : le domaine décide de l’ignorer');
});

test('un emplacement garde son linéaire en mètres ; sans série, de série inconnue ou sur une planche absente, il est écarté et compté', () => {
  const { places: mapped, readSummary } = plan();
  assert.deepEqual(mapped, [
    { id: '125090', seriesId: '51010', bedId: '629', lengthMeters: 32 },
    { id: '125091', seriesId: '54081', bedId: '630', lengthMeters: 16 },
  ]);
  assert.equal(readSummary.placesRead, 5);
  assert.equal(readSummary.placesWithoutSeries, 1);
  assert.equal(readSummary.placesWithUnknownBed, 1);
  assert.equal(readSummary.placesOfUnknownSeries, 1);
});

test('seules les tâches de semis direct et de plantation des séries de la saison sont retenues, réduites aux champs utiles', () => {
  const { implantationTasks, readSummary } = plan();
  assert.deepEqual(implantationTasks, [
    { id: '844280', seriesId: '51010', cultivationId: '53064', kind: 'direct-sowing', plannedWeek: '2025-W45', doneWeek: '2025-W45', status: 'done' },
    { id: '855511', seriesId: '54081', cultivationId: '56201', kind: 'planting', plannedWeek: '2025-W50', doneWeek: '2025-W51', status: 'done' },
    { id: '855512', seriesId: '54081', cultivationId: null, kind: 'planting', plannedWeek: '2026-W02', doneWeek: null, status: 'todo' },
  ]);
  assert.equal(readSummary.tasksRead, 7);
  assert.equal(readSummary.tasksRetained, 3);
  assert.ok(!('description' in implantationTasks[1]), 'ni description, ni temps, ni récolte');
});

test('une semaine mal formée est refusée : rien ne remplace le cache', () => {
  assert.throws(
    () => mapCropPlan({
      rawActions: actions, rawPlants: plants, rawSeries: series, rawPlaces: places, season: 2026, beds,
      rawTasks: [{ id: 1, cultivation: null, series: 51010, action: 288, plannedWeek: '2025-45', doneWeek: null, status: 'todo' }],
    }),
    (error) => error instanceof OtfApiError && /semaine/i.test(error.message),
  );
  assert.throws(
    () => mapCropPlan({
      rawActions: actions, rawPlants: plants, rawPlaces: places, rawTasks: tasks, season: 2026, beds,
      rawSeries: [{ id: 1, name: 'X', season: 2026, use: 'bed', cycle: 'annual', cultivations: [{ id: 2, plant: 937, harvestWeeks: ['14'] }] }],
    }),
    (error) => error instanceof OtfApiError && /semaine/i.test(error.message),
  );
});

test('une espèce inconnue garde un nom explicite, jamais vide', () => {
  const { series: mapped } = mapCropPlan({
    rawActions: actions, rawPlants: [], rawSeries: series, rawPlaces: places, rawTasks: tasks, season: 2026, beds,
  });
  assert.equal(mapped[0].cultivations[0].plantName, 'Espèce 937');
});
