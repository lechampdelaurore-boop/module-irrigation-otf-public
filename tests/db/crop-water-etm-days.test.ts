import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { addStageDeclarationForUser, saveSpeciesCorrespondenceForUser } from '../../db/crop-water/entries';
import { listEtmDaysForWorkspace, saveEtmDaysForWorkspace } from '../../db/crop-water/etm-days';
import { bedWaterSettings, readCropWaterInputsForWorkspace } from '../../db/crop-water/inputs';
import { saveBedMulchForUser } from '../../db/crop-water/settings';
import { ensureWorkspaceForUser } from '../../db/workspace-repository';
import type { CropSeries, ImplantationTask } from '../../lib/domain/domain';
import type { Et0Reading } from '../../lib/domain/crop-water/etm';
import { bedWaterDays, weekProposal } from '../../lib/domain/crop-water/proposal';
import { etmDayRecord, type EtmDayRecord } from '../../lib/domain/crop-water/records';
import { weekDateKeys } from '../../lib/domain/water-management';
import { cultivation, series, task } from '../support/crop-water-references';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';

/**
 * L'ETM du jour en base (docs/crop-water-need-contract.md, « La
 * traçabilité », « Les garde-fous », migration 0023) : le calcul du domaine
 * lit ses entrées en base, son résultat s'enregistre avec ce qui l'a produit
 * et se relit à l'identique ; une ETM recalculée remplace la précédente, un
 * jour bloqué n'écrase jamais la dernière valeur valide.
 */

const ALICE = 'alice';
const BOB = 'bob';
const BED = 'planche-a';
const SHELTER = 'jardin-serre';
const WEEK = '2026-05-11';
const MORNING = new Date('2026-05-11T05:00:00.000Z');
const NEXT_MORNING = new Date('2026-05-12T05:00:00.000Z');

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

const tomatoSeries = series('tomate', [cultivation('tomate-c', 'plant-tomate', 'Tomate', { expected: ['2026-W27', '2026-W40'] })]);
const zinniaSeries = series('zinnia', [cultivation('zinnia-c', 'plant-zinnia', 'Zinnia', { expected: ['2026-W30'] })]);
const tomatoTasks = [task('tomate', 'planting', '2026-W17')];

async function linkSpecies(owner: string) {
  await saveSpeciesCorrespondenceForUser(owner, { plantId: 'plant-tomate', seriesId: null, target: { kind: 'reference', referenceCropId: 'criiam-tomate', analogy: false } });
  await saveSpeciesCorrespondenceForUser(owner, { plantId: 'plant-zinnia', seriesId: null, target: { kind: 'without-reference' } });
}

/** Les jours de la planche calculés à partir de ce que la base contient pour l'exploitation. */
async function daysFromDatabase(
  workspaceId: string,
  seriesList: CropSeries[],
  tasks: ImplantationTask[],
  readings: Et0Reading[],
  dates: readonly string[],
  shelterId: string | null = SHELTER,
) {
  const inputs = await readCropWaterInputsForWorkspace(workspaceId, 2026);
  assert.deepEqual(inputs.unusableCrops, []);
  return bedWaterDays({
    bedId: BED,
    today: WEEK,
    cropPlan: {
      series: seriesList,
      places: seriesList.map((item) => ({ id: `place-${item.id}`, seriesId: item.id, bedId: BED, lengthMeters: null })),
      implantationTasks: tasks,
    },
    referenceCrops: inputs.referenceCrops,
    correspondences: inputs.correspondences,
    overrides: inputs.overrides,
    declarations: inputs.declarations,
    et0Readings: readings,
    settings: bedWaterSettings(inputs.settings, BED, shelterId),
    options: inputs.settings.options,
  }, dates).days;
}

function records(days: Awaited<ReturnType<typeof daysFromDatabase>>): EtmDayRecord[] {
  return days.flatMap((day) => {
    const record = etmDayRecord(BED, day);
    return record ? [record] : [];
  });
}

const forecastWeek = (mm: number) => weekDateKeys(WEEK).map((date) => ({ date, reanalysisMm: null, forecastMm: mm }));

test('scénarios 1 et 8 depuis la base : tomate sous abri, 3,50 mm/j sept jours, 24,5 mm la semaine, relus avec leur trace', async () => {
  const workspace = await ensureWorkspaceForUser(ALICE);
  await linkSpecies(ALICE);
  const days = await daysFromDatabase(workspace, [tomatoSeries], tomatoTasks, forecastWeek(7.3), weekDateKeys(WEEK));
  assert.equal(weekProposal({ days, objectiveMm: 20 }).proposedMm?.toFixed(1), '24.5');

  await saveEtmDaysForWorkspace(workspace, 2026, records(days), MORNING);
  const stored = await listEtmDaysForWorkspace(workspace, 2026, WEEK, '2026-05-17');
  assert.equal(stored.length, 7);
  assert.deepEqual(stored.map(({ computedAt, ...record }) => {
    assert.equal(computedAt, MORNING.toISOString());
    return record;
  }), records(days), 'chaque ligne se relit telle que le domaine l\'a produite');
  assert.deepEqual(stored[0], {
    bedId: BED,
    date: WEEK,
    status: 'computed',
    etmMm: stored[0].etmMm,
    et0Mm: 7.3,
    et0Nature: 'forecast',
    irrigationStop: false,
    trace: {
      seriesId: 'tomate', cultivationId: 'tomate-c', plantId: 'plant-tomate', referenceCropId: 'criiam-tomate', source: 'criiam',
      stageRank: 2, stageOrigin: 'calculated', kc: 0.6, referenceKc: 0.6, kcOverridden: false, abatement: 1, kcSmoothed: false,
      shelterFactor: 0.8, mulchFactor: 1, shadeFactor: 1, shadeNetRate: null,
    },
    computedAt: MORNING.toISOString(),
  });
  assert.equal(stored[0].etmMm?.toFixed(2), '3.50');
  assert.deepEqual(await listEtmDaysForWorkspace(await ensureWorkspaceForUser(BOB), 2026, WEEK, '2026-05-17'), [], 'l\'autre ferme ne voit rien');
  assert.deepEqual(await listEtmDaysForWorkspace(workspace, 2027, WEEK, '2026-05-17'), [], 'ni une autre saison');
});

test('une ETM recalculée remplace la précédente : stade déclaré et paillage lus en base, trace « observé »', async () => {
  const workspace = await ensureWorkspaceForUser(ALICE);
  await linkSpecies(ALICE);
  const date = '2026-05-13';
  await saveEtmDaysForWorkspace(workspace, 2026, records(await daysFromDatabase(workspace, [tomatoSeries], tomatoTasks, forecastWeek(5), [date])), MORNING);

  await addStageDeclarationForUser(ALICE, 2026, { seriesId: 'tomate', bedId: null, referenceCropId: 'criiam-tomate', rank: 3, date: '2026-05-12' });
  await saveBedMulchForUser(ALICE, { bedId: BED, season: 2026, plasticMulch: true });
  await saveEtmDaysForWorkspace(workspace, 2026, records(await daysFromDatabase(workspace, [tomatoSeries], tomatoTasks, forecastWeek(5), [date])), NEXT_MORNING);

  const [stored] = await listEtmDaysForWorkspace(workspace, 2026, date, date);
  assert.equal(stored.trace?.stageRank, 3);
  assert.equal(stored.trace?.stageOrigin, 'observed');
  assert.equal(stored.trace?.mulchFactor, 0.9);
  assert.equal(stored.etmMm?.toFixed(3), (5 * 0.8 * 0.9 * 0.9).toFixed(3));
  assert.equal(stored.computedAt, NEXT_MORNING.toISOString());
  assert.equal(database.sqlite.prepare('SELECT count(*) AS n FROM irrigation_crop_etm_days').get()?.n, 1, 'une ligne par planche et par jour');
});

test('un jour bloqué par une ET0 hors bornes n\'écrase pas la dernière valeur valide', async () => {
  const workspace = await ensureWorkspaceForUser(ALICE);
  await linkSpecies(ALICE);
  const date = '2026-05-13';
  await saveEtmDaysForWorkspace(workspace, 2026, records(await daysFromDatabase(workspace, [tomatoSeries], tomatoTasks, forecastWeek(5), [date])), MORNING);
  const blocked = await daysFromDatabase(workspace, [tomatoSeries], tomatoTasks, forecastWeek(15), [date]);
  assert.equal(blocked[0].status, 'blocked');
  assert.equal(etmDayRecord(BED, blocked[0]), null);
  await saveEtmDaysForWorkspace(workspace, 2026, records(blocked), NEXT_MORNING);
  const [stored] = await listEtmDaysForWorkspace(workspace, 2026, date, date);
  assert.equal(stored.et0Mm, 5);
  assert.equal(stored.computedAt, MORNING.toISOString());
});

test('jour inconnu, planche sans culture, espèce sans référence et planche partielle : jamais 0 à la place d\'une valeur inconnue', async () => {
  const workspace = await ensureWorkspaceForUser(ALICE);
  await linkSpecies(ALICE);
  const readings = [{ date: '2026-05-12', reanalysisMm: null, forecastMm: 5 }];
  const unknown = records(await daysFromDatabase(workspace, [tomatoSeries], tomatoTasks, [], ['2026-05-11']));
  const empty = records(await daysFromDatabase(workspace, [], [], readings, ['2026-05-12']));
  const zinnia = records(await daysFromDatabase(workspace, [zinniaSeries], [task('zinnia', 'planting', '2026-W17')], readings, ['2026-05-12']));
  const partial = records(await daysFromDatabase(workspace, [tomatoSeries, zinniaSeries], [...tomatoTasks, task('zinnia', 'planting', '2026-W17')], readings, ['2026-05-12'], null));
  await saveEtmDaysForWorkspace(workspace, 2026, unknown);
  for (const [bed, rows] of [['vide', empty], ['zinnia', zinnia], ['partielle', partial]] as const) {
    await saveEtmDaysForWorkspace(workspace, 2026, rows.map((row) => ({ ...row, bedId: bed })));
  }
  const stored = await listEtmDaysForWorkspace(workspace, 2026, '2026-05-11', '2026-05-12');
  assert.deepEqual(stored.map((row) => [row.bedId, row.status, row.etmMm, row.et0Mm, row.trace?.referenceCropId ?? null]), [
    [BED, 'unknown', null, null, 'criiam-tomate'],
    ['partielle', 'partial', 5 * 0.6, 5, 'criiam-tomate'],
    ['vide', 'no-crop', 0, 5, null],
    ['zinnia', 'no-etm', null, 5, null],
  ]);
});

test('la base refuse une ETM incohérente : calculée sans trace, inconnue chiffrée, ET0 hors bornes, nature sans valeur', async () => {
  const workspace = await ensureWorkspaceForUser(ALICE);
  const insert = (status: string, etm: string, et0: string, nature: string) => () => database.sqlite.exec(`INSERT INTO irrigation_crop_etm_days
    (workspace_id, season, otf_bed_id, date, status, etm_mm, et0_mm, et0_nature, computed_at)
    VALUES ('${workspace}', 2026, 'p', '2026-05-11', '${status}', ${etm}, ${et0}, ${nature}, '2026-05-11T05:00:00.000Z')`);
  assert.throws(insert('computed', '3.5', '7.3', "'forecast'"), /CHECK constraint failed/);
  assert.throws(insert('unknown', '0', 'NULL', 'NULL'), /CHECK constraint failed/);
  assert.throws(insert('no-crop', '0', '13', "'forecast'"), /CHECK constraint failed/);
  assert.throws(insert('no-crop', '0', 'NULL', "'forecast'"), /CHECK constraint failed/);
  assert.throws(insert('blocked', 'NULL', 'NULL', 'NULL'), /CHECK constraint failed/);
  insert('no-crop', '0', 'NULL', 'NULL')();
  assert.equal((await listEtmDaysForWorkspace(workspace, 2026, '2026-05-11', '2026-05-11')).length, 1);
});

test('scénario 12 depuis la base : deux cultures sur la planche, la ligne garde la trace de celle qui a le plus soif', async () => {
  const workspace = await ensureWorkspaceForUser(ALICE);
  await linkSpecies(ALICE);
  await saveSpeciesCorrespondenceForUser(ALICE, { plantId: 'plant-laitue', seriesId: null, target: { kind: 'reference', referenceCropId: 'criiam-salade-ete', analogy: false } });
  const saladSeries = series('salade', [cultivation('salade-c', 'plant-laitue', 'Laitue', { expected: ['2026-W24'] })]);
  const tasks = [...tomatoTasks, task('salade', 'planting', '2026-W17')];
  // Jours à venir le 11 mai : l'ET0 prévue.
  const readings = [{ date: '2026-05-26', reanalysisMm: null, forecastMm: 4 }, { date: '2026-05-13', reanalysisMm: null, forecastMm: 4 }];
  // Plein champ le 26 mai : tomate 3,6 mm/j, salade 2,8 ; sous abri le 13 mai : salade 2,24, tomate 1,92.
  const [openField] = records(await daysFromDatabase(workspace, [saladSeries, tomatoSeries], tasks, readings, ['2026-05-26'], null));
  const [sheltered] = records(await daysFromDatabase(workspace, [saladSeries, tomatoSeries], tasks, readings, ['2026-05-13']));
  assert.equal(openField.etmMm?.toFixed(2), '3.60');
  assert.equal(openField.et0Nature, 'forecast');
  assert.equal(openField.trace?.referenceCropId, 'criiam-tomate');
  assert.equal(sheltered.etmMm?.toFixed(2), '2.24');
  assert.equal(sheltered.trace?.referenceCropId, 'criiam-salade-ete');
  await saveEtmDaysForWorkspace(workspace, 2026, [openField, sheltered]);
  assert.deepEqual((await listEtmDaysForWorkspace(workspace, 2026, '2026-05-01', '2026-05-31')).map((row) => row.trace?.plantId), ['plant-laitue', 'plant-tomate']);
});
