import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { saveAutomaticObjectiveForUser } from '../../db/automatic-objective-repository';
import { saveAutomaticObjectiveWeekForWorkspace } from '../../db/automatic-objective-weeks';
import { addKcOverrideForUser, saveSpeciesCorrespondenceForUser } from '../../db/crop-water/entries';
import { saveFeatureSelectionForUser } from '../../db/feature-selection-repository';
import { upsertWeatherDailyValuesForUser } from '../../db/water-management-repository';
import { findWorkspaceIdForUser } from '../../db/workspace-repository';
import type { IrrigationSnapshot } from '../../lib/domain/domain';
import type { FeatureId } from '../../lib/domain/features/catalogue';
import { addDaysToDateKey } from '../../lib/domain/water-management';
import { weatherLocationKey } from '../../lib/domain/weather/location';
import {
  recordAutomaticObjectiveWeeksForAllWorkspaces,
  recordAutomaticObjectiveWeeksForUser,
} from '../../lib/services/automatic-objective-record';
import { getIrrigationHistoryDashboardForUser } from '../../lib/services/irrigation-history-service';
import { getIrrigationNeedsDashboardForUser } from '../../lib/services/irrigation-needs-service';
import { cultivation, series, task } from '../support/crop-water-references';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { confirmFarmLocation } from '../support/onboarding';
import { crossSpaceReferences } from '../support/space-coherence';
import { ALICE, BOB } from '../support/spaces';

/**
 * L'objectif automatique sur l'ET0, PR O3 : les semaines closes
 * (docs/objectif-automatique-contract.md, section 3, règle 6, et section 6 ;
 * D-318). Chaque matin, la tâche du matin enregistre l'objectif automatique
 * des semaines closes, une ligne par planche, jamais réécrite ; l'historique
 * et le besoin le lisent. Une semaine close pas encore enregistrée se relit
 * et l'historique la dit provisoire, jusqu'au matin qui la rattrape.
 *
 * Deux semaines : du lundi 15 au dimanche 21 juin 2026, ET0 4,0 · 4,2 · 3,8 ·
 * 4,5 · 5,0 · 4,6 · 3,9 mm, soit 30,0 mm ; puis du 22 au 28 juin, les mêmes.
 * Le réglage est allumé le lundi 15 juin au matin.
 */

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

const WEEK = '2026-06-15';
const NEXT_WEEK = '2026-06-22';
const ET0 = [4.0, 4.2, 3.8, 4.5, 5.0, 4.6, 3.9];
const TWO_WEEKS = Array.from({ length: 14 }, (_, index) => addDaysToDateKey(WEEK, index));
const SWITCHED_ON = new Date('2026-06-15T05:00:00.000Z');
/** Lundi 22 juin, 6 h 30 à Paris : la tâche du matin, après la météo. */
const MORNING = new Date('2026-06-22T04:30:00.000Z');
/** Mercredi 24 juin, midi à Paris. */
const WEDNESDAY = new Date('2026-06-24T10:00:00.000Z');
const NORTH = 'jardin-nord';
const SHELTER = 'serre';
const OPEN_BED = 'planche-a';
const SHELTERED_BED = 'planche-s';

const bed = (id: string, plotId: string) => ({ id, zoneId: 'parcelle', plotId, name: id, length: 10, width: 0.8, alleyWidth: 0.4, area: 8, seasons: [2026] });

const snapshot: IrrigationSnapshot = {
  configuration: { seasonFirst: 2025, seasonLast: 2027 },
  structure: { id: '17', name: 'Ferme', legalCity: 'Rennes', legalPostcode: '35000', legalCountry: 'FR' },
  zones: [{ id: 'parcelle', name: 'Parcelle', area: null, seasons: [2026] }],
  plots: [
    { id: NORTH, zoneId: 'parcelle', name: 'Nord', mode: 'garden', length: 10, width: 8, area: 80, seasons: [2026] },
    { id: SHELTER, zoneId: 'parcelle', name: 'Serre', mode: 'greenhouse', length: 10, width: 8, area: 80, seasons: [2026] },
  ],
  beds: [bed(OPEN_BED, NORTH), bed(SHELTERED_BED, SHELTER)],
  source: 'cache',
  lastSuccessfulReadAt: '2026-06-15T00:00:00.000Z',
};
const location = weatherLocationKey({ locationMode: 'otf', customCity: null, customPostcode: null, locationConfirmed: true }, snapshot.structure)!;

/** Une ferme, réglage allumé le 15 juin ; « Besoin par culture » décochée, sauf mention : l'objectif suit l'ET0. */
async function prepareFarm(owner: string, features: FeatureId[] = ['materiel', 'arrosages', 'besoins', 'planning', 'historique']) {
  await saveFeatureSelectionForUser(owner, features, new Date('2026-06-01T07:00:00.000Z'));
  await confirmFarmLocation(owner, snapshot.structure);
  await upsertWeatherDailyValuesForUser(
    owner, location, 'forecast',
    TWO_WEEKS.map((date, index) => ({ date, precipitationMm: 0, et0Mm: ET0[index % 7] })),
    'test', '2026-06-15T04:15:00.000Z',
  );
  assert.equal(await saveAutomaticObjectiveForUser(owner, true, SWITCHED_ON), true);
}

/** La réanalyse relue après coup : 1 mm de plus chaque jour des deux semaines. */
async function rereadWeather(owner: string) {
  await upsertWeatherDailyValuesForUser(
    owner, location, 'reanalysis',
    TWO_WEEKS.map((date, index) => ({ date, precipitationMm: 0, et0Mm: ET0[index % 7] + 1 })),
    'test', '2026-06-24T04:15:00.000Z',
  );
}

const record = (owner: string, now: Date, farm = snapshot) => recordAutomaticObjectiveWeeksForUser({ ownerUserId: owner, now, readSnapshot: async () => farm });

const recordedRows = () => database.sqlite.prepare(
  `SELECT workspace_id, week_start, otf_bed_id, no_crop_week, json_array_length(days) AS days, recorded_at
   FROM irrigation_automatic_objective_weeks ORDER BY workspace_id, week_start, otf_bed_id`,
).all() as { workspace_id: string; week_start: string; otf_bed_id: string; no_crop_week: number; days: number; recorded_at: string }[];

async function historyOf(owner: string, now: Date, period: { mode: 'week'; anchorDate: string } | { mode: 'month'; anchorDate: string } = { mode: 'week', anchorDate: WEEK }, farm = snapshot) {
  return getIrrigationHistoryDashboardForUser({ ownerUserId: owner, season: 2026, snapshot: farm, now, selection: { period, scope: { level: 'farm' }, page: 1 } });
}

async function needsOf(owner: string, weekStart: string, now: Date, farm = snapshot) {
  const dashboard = await getIrrigationNeedsDashboardForUser({ ownerUserId: owner, season: 2026, snapshot: farm, weekStart, now });
  return new Map(dashboard.gardens.flatMap((garden) => garden.beds).map((row) => [row.bedId, row]));
}

const near = (actual: number | null | undefined, expected: number, message?: string) => {
  assert.ok(actual !== null && actual !== undefined && Math.abs(actual - expected) < 1e-9, `${message ?? ''} : ${actual} au lieu de ${expected}`);
};
const provisionalWarnings = (warnings: readonly string[]) => warnings.filter((warning) => warning.includes('provisoire'));

test('le lundi matin, la semaine close est enregistrée par planche, une fois, jamais réécrite (règle 6)', async () => {
  await prepareFarm(ALICE);
  const sunday = new Date('2026-06-21T18:00:00.000Z');
  assert.equal(await record(ALICE, sunday), 0, 'le dimanche, la semaine n’est pas close');
  assert.equal((await needsOf(ALICE, WEEK, sunday)).get(OPEN_BED)?.automaticObjective?.closure, 'open');
  assert.equal((await historyOf(ALICE, sunday)).summary.objectiveAutomatic?.provisionalWeeks, 0, 'ni provisoire');
  assert.equal(await record(ALICE, MORNING), 1);
  const rows = recordedRows();
  assert.deepEqual(rows.map((row) => [row.week_start, row.otf_bed_id, row.no_crop_week, row.days]), [
    [WEEK, OPEN_BED, 0, 7],
    [WEEK, SHELTERED_BED, 0, 7],
  ]);
  assert.equal(rows[0].recorded_at, MORNING.toISOString());
  const stored = database.sqlite.prepare('SELECT days FROM irrigation_automatic_objective_weeks WHERE otf_bed_id = ?').get(OPEN_BED) as { days: string };
  const workspaceId = await findWorkspaceIdForUser(ALICE);
  assert.ok(workspaceId);
  const rewrite = [{ bedId: OPEN_BED, week: { noCropWeek: true, days: JSON.parse(stored.days).slice(0, 1) } }];
  assert.equal(await saveAutomaticObjectiveWeekForWorkspace(workspaceId, 2026, WEEK, rewrite, WEDNESDAY), 0, 'écrite une seconde fois, la ligne ne change pas');

  assert.equal(await record(ALICE, new Date('2026-06-23T04:30:00.000Z')), 0, 'le lendemain, rien de plus');
  await rereadWeather(ALICE);
  assert.equal(await record(ALICE, new Date('2026-06-29T04:30:00.000Z')), 1, 'le lundi suivant, la semaine d’après seulement');
  assert.deepEqual(recordedRows().filter((row) => row.week_start === WEEK), rows, 'la semaine enregistrée n’est pas réécrite');
  assert.deepEqual(crossSpaceReferences(database.sqlite), []);
});

test('preuve d’O3 : la météo relue ne change pas une semaine close, la ferme d’à côté sans enregistrement relit la sienne et la dit provisoire', async () => {
  await prepareFarm(ALICE);
  await prepareFarm(BOB);
  assert.equal(await record(ALICE, MORNING), 1, 'la tâche du matin passe chez ALICE ; chez BOB, elle a manqué');
  await rereadWeather(ALICE);
  await rereadWeather(BOB);

  const alice = await historyOf(ALICE, WEDNESDAY);
  near(alice.summary.objectiveMm, (30 + 24) / 2, 'la valeur du lundi matin, plein champ et sous abri (× 0,8)');
  assert.deepEqual(alice.summary.objectiveAutomatic, { bedDays: 14, missingBedDays: 0, provisionalWeeks: 0 });
  assert.deepEqual(provisionalWarnings(alice.warnings), []);
  const aliceNeeds = await needsOf(ALICE, WEEK, WEDNESDAY);
  near(aliceNeeds.get(OPEN_BED)?.objectiveMm, 30, 'le besoin de la semaine close lit le même enregistrement');
  assert.equal(aliceNeeds.get(OPEN_BED)?.automaticObjective?.closure, 'recorded');
  near(aliceNeeds.get(OPEN_BED)?.automaticObjective?.byNature.estimated, 30, 'les natures du lundi matin : la prévision des jours passés');
  near((await needsOf(ALICE, NEXT_WEEK, WEDNESDAY)).get(OPEN_BED)?.objectiveMm, 5.0 + 5.2 + 3.8 + 4.5 + 5.0 + 4.6 + 3.9, 'la semaine en cours suit la météo : lundi et mardi relus, la suite prévue');

  const bob = await historyOf(BOB, WEDNESDAY);
  near(bob.summary.objectiveMm, (37 + 37 * 0.8) / 2, 'sans enregistrement, la semaine se relit');
  assert.deepEqual(bob.summary.objectiveAutomatic, { bedDays: 14, missingBedDays: 0, provisionalWeeks: 1 });
  assert.deepEqual(provisionalWarnings(bob.warnings), [
    'L’objectif automatique d’une semaine close est provisoire : elle n’est pas encore enregistrée, la tâche du matin le fera. D’ici là, il se relit sur la météo et le plan de culture du jour.',
  ]);
  assert.equal((await needsOf(BOB, WEEK, WEDNESDAY)).get(OPEN_BED)?.automaticObjective?.closure, 'provisional');
});

test('une tâche du matin manquée : les semaines closes se disent provisoires, le matin suivant les rattrape (section 6)', async () => {
  await prepareFarm(ALICE);
  const july = new Date('2026-07-01T04:30:00.000Z');
  const june = { mode: 'month' as const, anchorDate: '2026-06-01' };
  const before = await historyOf(ALICE, july, june);
  assert.equal(before.summary.objectiveAutomatic?.provisionalWeeks, 2, 'les semaines du 15 et du 22 juin ; celle du 29 n’est pas close');
  assert.ok(provisionalWarnings(before.warnings)[0]?.startsWith('L’objectif automatique de 2 semaines closes est provisoire'), before.warnings.join(' | '));

  assert.equal(await record(ALICE, july), 2, 'les deux semaines manquées, d’un coup');
  const after = await historyOf(ALICE, july, june);
  assert.equal(after.summary.objectiveAutomatic?.provisionalWeeks, 0);
  assert.deepEqual(provisionalWarnings(after.warnings), []);
  near(after.summary.objectiveMm, before.summary.objectiveMm ?? Number.NaN, 'rien n’a changé entre-temps : la même valeur, désormais fixée');
});

test('le rattrapage : au plus huit semaines par ferme et par matin, les plus anciennes d’abord (F785)', async () => {
  await prepareFarm(ALICE);
  assert.equal(await record(ALICE, new Date('2026-08-24T04:30:00.000Z')), 8, 'dix semaines closes manquent, du 15 juin au 17 août : huit ce matin');
  assert.deepEqual(
    [...new Set(recordedRows().map((row) => row.week_start))],
    Array.from({ length: 8 }, (_, index) => addDaysToDateKey(WEEK, 7 * index)),
    'les plus anciennes d’abord',
  );
  assert.equal(await record(ALICE, new Date('2026-08-25T04:30:00.000Z')), 2, 'les deux dernières le matin suivant');
  assert.equal(await record(ALICE, new Date('2026-08-26T04:30:00.000Z')), 0);
});

test('F784 : une planche apparue après l’enregistrement n’a pas d’objectif automatique pour la semaine close', async () => {
  await prepareFarm(ALICE);
  const onlyOpen = { ...snapshot, beds: [bed(OPEN_BED, NORTH)] };
  assert.equal(await record(ALICE, MORNING, onlyOpen), 1);
  const history = await historyOf(ALICE, WEDNESDAY);
  assert.deepEqual(history.summary.objectiveAvailability, { availableBedDays: 7, totalBedDays: 14, complete: false }, 'la planche sous abri n’a pas de jour couvert');
  assert.deepEqual(history.summary.objectiveAutomatic, { bedDays: 7, missingBedDays: 0, provisionalWeeks: 0 }, 'ni provisoire : la semaine est enregistrée');
  assert.equal((await needsOf(ALICE, WEEK, WEDNESDAY)).get(SHELTERED_BED)?.objectiveMm, null);
});

test('la tâche du matin ne tourne que pour les fermes qui ont allumé le réglage et coché « Objectifs et besoins »', async () => {
  const failures: string[] = [];
  assert.deepEqual(await recordAutomaticObjectiveWeeksForAllWorkspaces({ now: MORNING, log: (line) => failures.push(line) }), { recorded: 0, failed: 0 }, 'personne ne l’a allumé');
  await prepareFarm(ALICE);
  await prepareFarm(BOB, ['materiel', 'arrosages', 'historique']);
  const result = await recordAutomaticObjectiveWeeksForAllWorkspaces({ now: MORNING, log: (line) => failures.push(line), readSnapshot: async () => snapshot });
  assert.deepEqual(result, { recorded: 1, failed: 0 });
  assert.deepEqual(failures, []);
  const workspaces = new Set(recordedRows().map((row) => row.workspace_id));
  assert.equal(workspaces.size, 1, 'BOB a décoché « Objectifs et besoins » : rien n’est enregistré pour lui');
});

test('« Besoin par culture » cochée : un Kc corrigé après coup ne change pas la semaine close, il change la semaine en cours', async () => {
  const cropped: IrrigationSnapshot = {
    ...snapshot,
    beds: [bed(OPEN_BED, NORTH)],
    cropPlan: {
      series: [series('tomate', [cultivation('tomate-c', 'plant-tomate', 'Tomate', { expected: ['2026-W30', '2026-W40'] })])],
      places: [{ id: 'place-tomate', seriesId: 'tomate', bedId: OPEN_BED, lengthMeters: null }],
      implantationTasks: [task('tomate', 'planting', '2026-W17')],
      readSummary: { seriesRead: 1, placesRead: 1, tasksRead: 1, tasksRetained: 1, placesWithoutSeries: 0, placesOfUnknownSeries: 0, placesWithUnknownBed: 0 },
    },
  };
  await prepareFarm(ALICE, ['materiel', 'arrosages', 'besoins', 'planning', 'historique', 'cultures']);
  await saveSpeciesCorrespondenceForUser(ALICE, { plantId: 'plant-tomate', seriesId: null, target: { kind: 'reference', referenceCropId: 'criiam-tomate', analogy: false } });
  const closedBefore = (await needsOf(ALICE, WEEK, MORNING, cropped)).get(OPEN_BED);
  const openBefore = (await needsOf(ALICE, NEXT_WEEK, MORNING, cropped)).get(OPEN_BED);
  assert.equal(closedBefore?.automaticObjective?.basis, 'crop', 'l’objectif suit le besoin de la tomate');
  assert.ok((closedBefore?.objectiveMm ?? 0) > 0);
  assert.equal(await record(ALICE, MORNING, cropped), 1);

  // Le Kc de la tomate corrigé à 0,3 à tous ses stades, depuis avril : le besoin de chaque jour change.
  for (const rank of [1, 2, 3, 4]) await addKcOverrideForUser(ALICE, { referenceCropId: 'criiam-tomate', target: { rank }, kc: 0.3, effectiveFrom: '2026-04-01' }, WEDNESDAY);
  const openAfter = (await needsOf(ALICE, NEXT_WEEK, WEDNESDAY, cropped)).get(OPEN_BED);
  assert.notEqual(openAfter?.objectiveMm, openBefore?.objectiveMm, 'la semaine en cours suit le Kc corrigé');
  const closedAfter = (await needsOf(ALICE, WEEK, WEDNESDAY, cropped)).get(OPEN_BED);
  near(closedAfter?.objectiveMm, closedBefore?.objectiveMm ?? Number.NaN, 'la semaine close garde la valeur de son lundi');
  assert.equal(closedAfter?.automaticObjective?.closure, 'recorded');
});
