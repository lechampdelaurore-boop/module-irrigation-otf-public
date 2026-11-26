import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { overrideDatabase } from '../../db/binding';
import { readFeatureSelectionForUser, saveFeatureSelectionForUser, saveRouteStateForUser } from '../../db/feature-selection-repository';
import { addSoilRecordForUser } from '../../db/soil-reserve/entries';
import { saveHydricGoalForUser } from '../../db/water-management-repository';
import { saveWaterReservoirForUser, saveWaterResourceForUser } from '../../db/water-resource-repository';
import type { IrrigationSnapshot } from '../../lib/domain/domain';
import { FEATURE_IDS } from '../../lib/domain/features/catalogue';
import { startWaySelection } from '../../lib/domain/features/start';
import { startRoute, todayRouteBlock, type RouteCounts } from '../../lib/domain/onboarding/route';
import { parcelsWithoutSoil } from '../../lib/domain/onboarding/soil';
import { unfinishedSteps } from '../../lib/domain/onboarding/steps';
import { soilParcelAnchor } from '../../lib/domain/today/reliability';
import type { SoilRecord } from '../../lib/domain/soil-reserve/soil';
import { getIrrigationNeedsDashboardForUser } from '../../lib/services/irrigation-needs-service';
import { chooseStartForUser } from '../../lib/services/start-choice';
import { changeRouteStateForUser, startRouteCounts, startRouteReads } from '../../lib/services/start-route';
import { getTodayViewForUser } from '../../lib/services/today-service';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { FIXTURE_PLOT_ID, FIXTURE_ZONE_ID, createDripFixture } from '../support/irrigation-fixtures';
import { FARM_SOIL } from '../support/soil-reserve-fixtures';
import { ALICE, BOB } from '../support/spaces';

/**
 * Simplifier l'usage du module, lot S6, PR 2 : la mise en route lue en base
 * (docs/simplification-s6-contract.md, sections 4, 5.4, 6 et 14 ; D-336,
 * suite). L'état de la carte écrit par un appui, dans l'espace de la
 * personne seulement ; les comptes de chaque étape, lus sans rien écrire,
 * égaux à ceux d'« Aujourd'hui » et du bandeau « À finir » ; Alice et Bob
 * aux quatre passages d'isolation ; une ferme de trois cents planches coûte
 * autant de requêtes qu'une ferme de trois.
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
const NOW = new Date('2026-09-09T08:00:00.000Z');
const CHAMP = 'plot-champ';
const OTHER_ZONE = 'zone-2';

function snapshotWith(extraBeds = 0): IrrigationSnapshot {
  return {
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
      ...Array.from({ length: extraBeds }, (_, index) => ({
        id: `bed-x${index}`, zoneId: OTHER_ZONE, plotId: CHAMP, name: `X${index}`, length: 10, width: 1, alleyWidth: null, area: 10, seasons: [SEASON],
      })),
    ],
    source: 'cache',
    lastSuccessfulReadAt: '2026-09-07T00:00:00.000Z',
  };
}

const ALL = [...FEATURE_IDS];

async function countsOf(owner: string, snapshot: IrrigationSnapshot = snapshotWith(), enabled = ALL): Promise<RouteCounts> {
  return startRouteCounts(startRouteReads(owner, SEASON, enabled, NOW), { ownerUserId: owner, season: SEASON, snapshot, now: NOW });
}

/** La ferme d'Alice, passée par « Tout » : un goutte-à-goutte posé sur les deux planches de la serre, un puits et un bassin, la serre visée, le sol d'une parcelle. */
async function describeAlice() {
  await createDripFixture(ALICE, { beds: ['bed-1', 'bed-2'] });
  await saveWaterResourceForUser(ALICE, ALICE, null, { name: 'Puits', type: 'well', nominalFlowCubicMetersPerHour: 2, status: 'active', availableFrom: null, availableUntil: null, notes: null });
  await saveWaterResourceForUser(ALICE, ALICE, null, { name: 'Ancien forage', type: 'borehole', nominalFlowCubicMetersPerHour: 1, status: 'inactive', availableFrom: null, availableUntil: null, notes: null });
  // Une réserve compte comme une ressource (« un puits, un bassin », section 5.1) ; une réserve arrêtée, non.
  const reservoir = { type: 'pond', capacityCubicMeters: 40, currentVolumeCubicMeters: 30, minimumSafetyCubicMeters: 0, exposedSurfaceSquareMeters: 0, receivesRain: false, evaporationEnabled: false, evaporationCoefficient: 1, notes: null } as const;
  await saveWaterReservoirForUser(ALICE, ALICE, null, { ...reservoir, name: 'Bassin des noues', status: 'active' }, '2026-09-10T07:00:00.000Z');
  await saveWaterReservoirForUser(ALICE, ALICE, null, { ...reservoir, name: 'Vieille cuve', status: 'inactive' }, '2026-09-10T07:00:00.000Z');
  await saveHydricGoalForUser(ALICE, { season: SEASON, weekStart: WEEK, amountMm: 20, scopeType: 'plot', otfZoneId: FIXTURE_ZONE_ID, otfPlotId: FIXTURE_PLOT_ID, otfBedId: null });
  // Un objectif compte à partir de son jour de pose (D-034) : posé le lundi de la semaine lue.
  database.sqlite.prepare('UPDATE irrigation_hydric_goal_revisions SET created_at = ?').run('2026-09-07T05:00:00.000Z');
  const soil = Object.fromEntries(Object.entries({ ...FARM_SOIL, zoneId: FIXTURE_ZONE_ID, plotId: null }).filter(([key]) => key !== 'recordedAt')) as Omit<SoilRecord, 'recordedAt'>;
  assert.equal((await addSoilRecordForUser(ALICE, soil, NOW)).ok, true);
}

test('section 6 : les comptes d’une ferme décrite en partie, et rien de celle d’à côté', async () => {
  await chooseStartForUser(ALICE, { startMode: 'all', enabled: [] }, NOW);
  await chooseStartForUser(BOB, { startMode: 'all', enabled: [] }, NOW);
  await describeAlice();

  assert.deepEqual(await countsOf(ALICE), {
    equipment: { drip: 1, sprinkler: 0, withoutSetting: 0 },
    placement: { watered: 2, total: 3 },
    // Une ressource ou une réserve arrêtée ne compte pas.
    water: { names: ['Bassin des noues', 'Puits'], total: 2 },
    objective: { withObjective: 2, total: 3 },
    soil: { withoutSoil: 1, total: 2, anchor: soilParcelAnchor(OTHER_ZONE) },
  });
  // Bob, les mêmes planches d'Ouvre ta ferme, rien de décrit : aucune ligne d'Alice.
  assert.deepEqual(await countsOf(BOB), {
    equipment: { drip: 0, sprinkler: 0, withoutSetting: 0 },
    placement: { watered: 0, total: 3 },
    water: { names: [], total: 0 },
    objective: { withObjective: 0, total: 3 },
    soil: { withoutSoil: 2, total: 2, anchor: soilParcelAnchor(FIXTURE_ZONE_ID) },
  });

  const alice = startRoute({ startMode: 'all', routeState: null, enabled: ALL, counts: await countsOf(ALICE) });
  assert.equal(alice.kind, 'card');
  if (alice.kind !== 'card') return;
  assert.deepEqual(alice.steps.map((step) => [step.id, step.status, step.line]), [
    ['equipment', 'done', '1 goutte-à-goutte'],
    ['placement', 'done', '2 planches arrosées sur 3'],
    ['water', 'done', 'Bassin des noues et Puits'],
    ['objective', 'current', '1 planche n’a pas encore d’eau visée.'],
    ['soil', 'todo', 'sol de 1 parcelle saisi'],
  ]);
  assert.equal(alice.progress, '3 étapes sur 5');
});

test('S6-i : l’étape 4 compte comme « Aujourd’hui » et « Objectifs et besoins », l’étape 5 comme le bandeau « À finir »', async () => {
  await chooseStartForUser(ALICE, { startMode: 'all', enabled: [] }, NOW);
  await describeAlice();
  const snapshot = snapshotWith();
  const counts = await countsOf(ALICE, snapshot);
  const today = await getTodayViewForUser({ ownerUserId: ALICE, season: SEASON, snapshot, enabled: ALL, now: NOW });
  assert.ok(today.week, '« Aujourd’hui » lit la semaine');
  assert.deepEqual(counts.objective, today.week.farm.objectiveBeds);
  const needs = await getIrrigationNeedsDashboardForUser({ ownerUserId: ALICE, season: SEASON, snapshot, weekStart: WEEK, now: NOW });
  assert.deepEqual(counts.objective, { withObjective: needs.farmObjective.withObjective, total: needs.farmObjective.total });

  // Le bandeau « À finir » : les mêmes parcelles, la même ancre, le même texte.
  const { listZonesWithSoilForUser } = await import('../../db/soil-reserve/entries');
  const withoutSoil = parcelsWithoutSoil(snapshot.zones, SEASON, new Set(await listZonesWithSoilForUser(ALICE)));
  const banner = unfinishedSteps({ kind: 'onboarding', remaining: [], steps: [] } as never, {
    weather: false, plotsToClassify: 0, soilToEnter: { parcels: withoutSoil.length, anchor: soilParcelAnchor(withoutSoil[0] ?? '') },
  });
  assert.equal(counts.soil?.withoutSoil, withoutSoil.length);
  assert.equal(counts.soil?.anchor, banner[0]?.anchor);
  const route = startRoute({ startMode: 'all', routeState: null, enabled: ALL, counts: { ...counts, objective: { withObjective: 3, total: 3 } } });
  assert.equal(route.kind, 'card');
  if (route.kind !== 'card') return;
  assert.equal(route.current?.id, 'soil');
  assert.ok(route.current?.line?.toLowerCase().includes(banner[0]?.text ?? '∅'), route.current?.line ?? '');
  // Et la phrase d'« Aujourd'hui » dit la même étape que la carte.
  assert.equal(todayRouteBlock(route, ALL)?.sentence, 'Votre sol : sol de 1 parcelle à saisir.');
});

test('section 6 : une case décochée n’est pas lue ; la lecture n’écrit rien', async () => {
  await chooseStartForUser(ALICE, { startMode: 'notes', enabled: [] }, NOW);
  await describeAlice();
  const before = database.sqlite.prepare('SELECT COUNT(*) AS count FROM irrigation_season_geometry').get() as { count: number };
  const counts = await countsOf(ALICE, snapshotWith(), startWaySelection('notes'));
  assert.deepEqual(counts.water, null, 'pas de « Ressources » : rien lu');
  assert.deepEqual(counts.objective, null);
  assert.deepEqual(counts.soil, null);
  assert.deepEqual(counts.placement, { watered: 2, total: 3 });
  // Les groupes se lisent sans marquer la saison (S6-h).
  assert.deepEqual(database.sqlite.prepare('SELECT COUNT(*) AS count FROM irrigation_season_geometry').get(), before);
});

test('section 6 : trois cents planches, autant de requêtes que trois ; aucune requête par planche ni par jardin', async () => {
  await chooseStartForUser(ALICE, { startMode: 'all', enabled: [] }, NOW);
  await describeAlice();
  const real = database.d1;
  let prepared = 0;
  const counting = new Proxy(real, {
    get(target, property) {
      const value = Reflect.get(target, property) as unknown;
      if (property === 'prepare' && typeof value === 'function') {
        return (sql: string) => {
          prepared += 1;
          return (value as (sql: string) => D1PreparedStatement).call(target, sql);
        };
      }
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value;
    },
  });
  overrideDatabase(counting);
  try {
    const small = await countsOf(ALICE, snapshotWith(0));
    const smallQueries = prepared;
    prepared = 0;
    const large = await countsOf(ALICE, snapshotWith(297));
    assert.equal(large.placement?.total, 300);
    assert.equal(large.objective?.total, 300);
    assert.equal(small.placement?.total, 3);
    assert.equal(prepared, smallQueries, `${prepared} requêtes pour 300 planches, ${smallQueries} pour 3`);
    // Sans la mémoire d'une requête des pages, chaque lecture retrouve l'espace : une vingtaine au plus.
    assert.ok(smallQueries <= 20, `${smallQueries} requêtes`);
  } finally {
    overrideDatabase(real);
  }
});

test('section 5.4 : « Plus tard », « Reprendre », « Terminer » écrivent l’état de la carte, dans l’espace de la personne seulement', async () => {
  await chooseStartForUser(ALICE, { startMode: 'proposals', enabled: [] }, NOW);
  await chooseStartForUser(BOB, { startMode: 'notes', enabled: [] }, NOW);
  const state = async (owner: string) => {
    const stored = await readFeatureSelectionForUser(owner);
    return stored.kind === 'stored' ? stored.routeState : 'aucune ligne';
  };

  assert.deepEqual(await changeRouteStateForUser(ALICE, 'later', NOW), { ok: true, message: 'La mise en route est remise à plus tard. Elle vous attend ici.' });
  assert.deepEqual([await state(ALICE), await state(BOB)], ['later', null], 'Bob ne voit rien changer');
  assert.deepEqual(await changeRouteStateForUser(ALICE, 'resume', NOW), { ok: true, message: 'La mise en route est reprise.' });
  assert.equal(await state(ALICE), null);
  assert.deepEqual(await changeRouteStateForUser(ALICE, 'done', NOW), { ok: true, message: 'La mise en route est terminée.' });
  assert.equal(await state(ALICE), 'done');
  // Terminée, elle le reste : ni « Plus tard » ni « Reprendre » ne la font revenir (S6-k).
  assert.deepEqual(await changeRouteStateForUser(ALICE, 'resume', NOW), { ok: false, message: 'La mise en route est déjà terminée.' });
  assert.deepEqual(await changeRouteStateForUser(ALICE, 'later', NOW), { ok: false, message: 'La mise en route est déjà terminée.' });
  assert.equal(await state(ALICE), 'done');
  assert.equal(await state(BOB), null);
  assert.deepEqual(await changeRouteStateForUser(BOB, 'effacer', NOW), { ok: false, message: 'Ce geste n’est pas connu.' });
  // Rien d'autre ne change : les cases et la façon de commencer restent.
  const alice = await readFeatureSelectionForUser(ALICE);
  assert.equal(alice.kind === 'stored' ? alice.startMode : null, 'proposals');
  assert.deepEqual(alice.kind === 'stored' ? alice.enabled : null, startWaySelection('proposals'));
});

test('section 4 : une ferme d’avant S6, ou sans espace, n’a pas de carte à changer', async () => {
  await saveFeatureSelectionForUser(ALICE, ['arrosages', 'materiel'], NOW);
  assert.equal(await saveRouteStateForUser(ALICE, 'later', NOW), false);
  const stored = await readFeatureSelectionForUser(ALICE);
  assert.equal(stored.kind === 'stored' ? stored.routeState : 'aucune ligne', null);
  assert.equal(await saveRouteStateForUser(BOB, 'done', NOW), false);
  assert.deepEqual(await changeRouteStateForUser(BOB, 'done', NOW), { ok: false, message: 'La mise en route est déjà terminée.' });
});
