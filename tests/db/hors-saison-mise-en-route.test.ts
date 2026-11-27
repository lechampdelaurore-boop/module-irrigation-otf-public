import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { saveHydricGoalForUser } from '../../db/water-management-repository';
import type { IrrigationSnapshot } from '../../lib/domain/domain';
import { FEATURE_IDS } from '../../lib/domain/features/catalogue';
import { startRoute, type RouteCounts } from '../../lib/domain/onboarding/route';
import { saveOffSeasonScopeForUser } from '../../lib/services/off-season-service';
import { chooseStartForUser } from '../../lib/services/start-choice';
import { startRouteCounts, startRouteReads } from '../../lib/services/start-route';
import { getTodayViewForUser } from '../../lib/services/today-service';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { FIXTURE_PLOT_ID, FIXTURE_ZONE_ID, createDripFixture } from '../support/irrigation-fixtures';
import { ALICE, BOB } from '../support/spaces';

/**
 * Le filtre « hors saison », PR B2, et la mise en route de S6 (D-352, F1071) :
 * l'étape « Combien je vise par semaine » lit le filtre de la ferme comme
 * « Aujourd'hui ». Ses comptes sont ceux de la semaine d'« Aujourd'hui »,
 * planches hors saison comprises, dites à part ; sans geste, rien ne change ;
 * le geste d'une ferme ne change rien chez sa voisine (quatre passages
 * d'isolation). Les règles sans base : tests/hors-saison-lecteurs.test.ts.
 */

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

const SEASON = 2026;
const WEEK = '2026-09-07';
/** Le mercredi 9 septembre 2026, 10 h à Paris. */
const NOW = new Date('2026-09-09T08:00:00.000Z');
/** Le mardi 1er septembre : un geste de la semaine d'avant. */
const BEFORE = new Date('2026-09-01T08:00:00.000Z');
const CHAMP = 'plot-champ';
const OTHER_ZONE = 'zone-2';
const ALL = [...FEATURE_IDS];

const SNAPSHOT: IrrigationSnapshot = {
  configuration: { seasonFirst: 2025, seasonLast: 2027 },
  structure: { id: '17', name: 'Ferme', legalCity: 'Rennes', legalPostcode: '35000', legalCountry: 'FR' },
  zones: [
    { id: FIXTURE_ZONE_ID, name: 'Parcelle', area: 1000, seasons: [SEASON] },
    { id: OTHER_ZONE, name: 'Parcelle du bas', area: 1000, seasons: [SEASON] },
  ],
  plots: [
    { id: FIXTURE_PLOT_ID, zoneId: FIXTURE_ZONE_ID, name: 'Serre', mode: 'greenhouse', length: 20, width: 10, area: 200, seasons: [SEASON] },
    { id: CHAMP, zoneId: OTHER_ZONE, name: 'Champ', mode: 'garden', length: 40, width: 20, area: 800, seasons: [SEASON] },
  ],
  beds: [
    { id: 'bed-1', zoneId: FIXTURE_ZONE_ID, plotId: FIXTURE_PLOT_ID, name: '1', length: 30, width: 1, alleyWidth: null, area: 30, seasons: [SEASON] },
    { id: 'bed-2', zoneId: FIXTURE_ZONE_ID, plotId: FIXTURE_PLOT_ID, name: '2', length: 30, width: 1, alleyWidth: null, area: 30, seasons: [SEASON] },
    { id: 'bed-c', zoneId: OTHER_ZONE, plotId: CHAMP, name: 'C', length: 800, width: 1, alleyWidth: null, area: 800, seasons: [SEASON] },
  ],
  source: 'cache',
  lastSuccessfulReadAt: '2026-09-07T00:00:00.000Z',
};

async function countsOf(owner: string): Promise<RouteCounts> {
  return startRouteCounts(startRouteReads(owner, SEASON, ALL, NOW), { ownerUserId: owner, season: SEASON, snapshot: SNAPSHOT, now: NOW });
}

/** Une ferme passée par « Tout » : le goutte-à-goutte posé sur les deux planches de la serre, la serre visée à 20 mm depuis lundi ; le champ sans objectif. */
async function describe(owner: string) {
  await chooseStartForUser(owner, { startMode: 'all', enabled: [] }, NOW);
  await createDripFixture(owner, { beds: ['bed-1', 'bed-2'] });
  await saveHydricGoalForUser(owner, { season: SEASON, weekStart: WEEK, amountMm: 20, scopeType: 'plot', otfZoneId: FIXTURE_ZONE_ID, otfPlotId: FIXTURE_PLOT_ID, otfBedId: null });
  // Un objectif compte à partir de son jour de pose (D-034) : posé le lundi de la semaine lue.
  database.sqlite.prepare('UPDATE irrigation_hydric_goal_revisions SET created_at = ?').run('2026-09-07T05:00:00.000Z');
}

async function put(owner: string, scope: Parameters<typeof saveOffSeasonScopeForUser>[0]['scope'], now: Date) {
  assert.equal(await saveOffSeasonScopeForUser({ ownerUserId: owner, snapshot: SNAPSHOT, scope, offSeason: true, now }), true);
}

function objectiveLine(counts: RouteCounts): [string, string | null] {
  const route = startRoute({ startMode: 'all', routeState: null, enabled: ALL, counts });
  assert.equal(route.kind, 'card');
  const step = route.kind === 'card' ? route.steps.find((item) => item.id === 'objective') : undefined;
  return [step?.status ?? '∅', step?.line ?? null];
}

test('F1071 : sans geste, l’étape 4 compte comme avant ; le champ mis hors saison sort des comptes et se dit à part, comme sur « Aujourd’hui »', async () => {
  await describe(ALICE);
  await describe(BOB);
  const before = await countsOf(ALICE);
  assert.deepEqual(before.objective, { withObjective: 2, total: 3 }, 'filtre vide : le compte d’avant, sans clé de plus');
  // Sans ressource en eau, l'étape 3 est en cours : l'étape 4 dit son compte.
  assert.deepEqual(objectiveLine(before), ['todo', '2 planches sur 3 ont un objectif']);

  // Tout le plein champ hors saison depuis la semaine d'avant : la planche du champ n'a rien à viser.
  await put(ALICE, { level: 'mode', mode: 'garden' }, BEFORE);
  const paused = await countsOf(ALICE);
  assert.deepEqual(paused.objective, { withObjective: 2, total: 3, offSeason: 1 });
  assert.deepEqual(objectiveLine(paused), ['done', '2 planches sur 2 ont un objectif, 1 hors saison']);
  const today = await getTodayViewForUser({ ownerUserId: ALICE, season: SEASON, snapshot: SNAPSHOT, enabled: ALL, now: NOW });
  assert.ok(today.week, '« Aujourd’hui » lit la semaine');
  assert.deepEqual(paused.objective, today.week.farm.objectiveBeds, 'les comptes d’« Aujourd’hui », planches hors saison comprises');
  // Les autres étapes ne lisent pas le filtre : le matériel, la pose et les ressources sont les mêmes.
  assert.deepEqual({ ...paused, objective: null }, { ...before, objective: null });

  // Bob, la même ferme, aucun geste : rien ne change chez lui.
  assert.deepEqual((await countsOf(BOB)).objective, { withObjective: 2, total: 3 });
});

test('F1071 : la serre mise hors saison aujourd’hui sort des comptes, son objectif de lundi et mardi reste écrit ; toute la ferme hors saison, rien ne manque', async () => {
  await describe(ALICE);
  await put(ALICE, { level: 'mode', mode: 'garden' }, BEFORE);
  // Le geste de mercredi : lundi et mardi gardent leur objectif, mais la serre est hors saison le jour du calcul (D-352).
  await put(ALICE, { level: 'plot', plotId: FIXTURE_PLOT_ID }, NOW);
  const counts = await countsOf(ALICE);
  assert.deepEqual(counts.objective, { withObjective: 0, total: 3, offSeason: 3 });
  assert.deepEqual(objectiveLine(counts), ['done', 'aucune planche en saison, 3 hors saison']);
  const today = await getTodayViewForUser({ ownerUserId: ALICE, season: SEASON, snapshot: SNAPSHOT, enabled: ALL, now: NOW });
  assert.deepEqual(counts.objective, today.week?.farm.objectiveBeds);
  const goals = database.sqlite.prepare('SELECT COUNT(*) AS count FROM irrigation_hydric_goal_revisions').get() as { count: number };
  assert.equal(goals.count, 1, 'l’objectif saisi reste écrit');
});
