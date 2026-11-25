import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { createIrrigationEventForUser } from '../../db/irrigation-event/create';
import { saveHydricGoalForUser } from '../../db/water-management-repository';
import { findWorkspaceIdForUser } from '../../db/workspace-repository';
import type { IrrigationSnapshot } from '../../lib/domain/domain';
import { farmObjectiveText } from '../../lib/domain/farm-objective';
import { FEATURE_IDS } from '../../lib/domain/features/catalogue';
import { historyGapScopeText, historyObjectiveScopeText } from '../../lib/domain/irrigation-history/objective-scope';
import { getIrrigationHistoryDashboardForUser } from '../../lib/services/irrigation-history-service';
import { getIrrigationNeedsDashboardForUser } from '../../lib/services/irrigation-needs-service';
import { getTodayViewForUser } from '../../lib/services/today-service';
import type { HydricGoal } from '../../lib/domain/water-management';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { FIXTURE_PLOT_ID, FIXTURE_ZONE_ID, completedDraft, createDripFixture } from '../support/irrigation-fixtures';
import { ALICE, BOB } from '../support/spaces';

/**
 * Simplifier l'usage du module, lot S1, PR 3 bis, lu en base (D-329,
 * docs/simplification-s1-contract.md, section 5 bis) : deux fermes, les
 * mêmes planches d'Ouvre ta ferme. Celle d'Alice n'a d'objectif que sous sa
 * serre ; celle de Bob en a un sur chaque planche. Pour chacune, la semaine
 * de l'Historique dit l'objectif d'« Aujourd'hui » et d'« Objectifs et
 * besoins », et l'écart se chiffre sur l'eau que la page d'accueil dit reçue ;
 * l'une ne lit rien de l'autre. Semaine du lundi 7 au dimanche 13 septembre
 * 2026, lue le vendredi à 7 h.
 */

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

const WEEK = '2026-09-07';
const NOW = new Date('2026-09-11T05:00:00.000Z');
const SERRE = FIXTURE_PLOT_ID;
const CHAMP = 'plot-champ';

const snapshot: IrrigationSnapshot = {
  configuration: { seasonFirst: 2025, seasonLast: 2027 },
  structure: { id: '17', name: 'Ferme', legalCity: 'Rennes', legalPostcode: '35000', legalCountry: 'FR' },
  zones: [{ id: FIXTURE_ZONE_ID, name: 'Parcelle', area: 1000, seasons: [2026] }],
  plots: [
    { id: SERRE, zoneId: FIXTURE_ZONE_ID, name: 'Serre', mode: 'greenhouse', length: 20, width: 10, area: 200, seasons: [2026] },
    { id: CHAMP, zoneId: FIXTURE_ZONE_ID, name: 'Champ', mode: 'garden', length: 40, width: 20, area: 800, seasons: [2026] },
  ],
  beds: [
    { id: 'bed-s', zoneId: FIXTURE_ZONE_ID, plotId: SERRE, name: 'S', length: 50, width: 1, alleyWidth: null, area: 50, seasons: [2026] },
    { id: 'bed-t', zoneId: FIXTURE_ZONE_ID, plotId: SERRE, name: 'T', length: 150, width: 1, alleyWidth: null, area: 150, seasons: [2026] },
    { id: 'bed-c', zoneId: FIXTURE_ZONE_ID, plotId: CHAMP, name: 'C', length: 800, width: 1, alleyWidth: null, area: 800, seasons: [2026] },
  ],
  source: 'cache',
  lastSuccessfulReadAt: '2026-09-07T00:00:00.000Z',
};

/** Un objectif de la semaine, posé à `createdAt` : le jour de pose compte (D-034). */
async function goal(owner: string, target: Pick<HydricGoal, 'scopeType' | 'otfZoneId' | 'otfPlotId' | 'otfBedId'>, amountMm: number, createdAt: string) {
  await saveHydricGoalForUser(owner, { season: 2026, weekStart: WEEK, amountMm, ...target });
  database.sqlite.prepare(`UPDATE irrigation_hydric_goal_revisions SET created_at = ?
    WHERE rowid = (SELECT max(rowid) FROM irrigation_hydric_goal_revisions WHERE workspace_id = ?)`)
    .run(createdAt, await findWorkspaceIdForUser(owner));
}

/** Une heure d'irrigation le mardi, `mm` par planche. */
async function irrigate(owner: string, applications: readonly { bedId: string; plotId: string; area: number; mm: number }[]) {
  // Le goutte-à-goutte posé dans la serre ; l'irrigation dit elle-même ses planches, le champ compris.
  const fixture = await createDripFixture(owner, { beds: ['bed-s', 'bed-t'] });
  await createIrrigationEventForUser(owner, completedDraft(fixture, {
    startAt: '2026-09-08T06:00:00.000Z', endAt: '2026-09-08T07:00:00.000Z', durationSeconds: 3600,
  }, {
    applications: applications.map(({ bedId, plotId, area, mm }) => ({
      otfZoneId: FIXTURE_ZONE_ID, otfPlotId: plotId, otfBedId: bedId, rateMmPerHour: mm, bedAreaSquareMeters: area, wettedAreaSquareMeters: area,
    })),
  }));
}

/** La ferme d'Alice : la serre 21 mm dès le lundi, la planche T 35 mm posés le mercredi ; le champ n'a pas d'objectif. */
async function seedAlice() {
  await goal(ALICE, { scopeType: 'plot', otfZoneId: FIXTURE_ZONE_ID, otfPlotId: SERRE, otfBedId: null }, 21, '2026-09-07T05:00:00.000Z');
  await goal(ALICE, { scopeType: 'bed', otfZoneId: FIXTURE_ZONE_ID, otfPlotId: SERRE, otfBedId: 'bed-t' }, 35, '2026-09-09T05:00:00.000Z');
  await irrigate(ALICE, [
    { bedId: 'bed-s', plotId: SERRE, area: 50, mm: 12 },
    { bedId: 'bed-t', plotId: SERRE, area: 150, mm: 12 },
    { bedId: 'bed-c', plotId: CHAMP, area: 800, mm: 30 },
  ]);
}

/** La ferme de Bob : « Toute la ferme » 14 mm, la planche S 28 mm, dès le lundi ; aucune irrigation. */
async function seedBob() {
  await goal(BOB, { scopeType: 'farm', otfZoneId: null, otfPlotId: null, otfBedId: null }, 14, '2026-09-07T05:00:00.000Z');
  await goal(BOB, { scopeType: 'bed', otfZoneId: FIXTURE_ZONE_ID, otfPlotId: SERRE, otfBedId: 'bed-s' }, 28, '2026-09-07T05:00:01.000Z');
}

/** Ce que disent de la semaine l'Historique, « Objectifs et besoins » et « Aujourd'hui ». */
async function readWeek(owner: string) {
  const history = await getIrrigationHistoryDashboardForUser({
    ownerUserId: owner, season: 2026, snapshot, now: NOW,
    selection: { period: { mode: 'week', anchorDate: WEEK }, scope: { level: 'farm' }, page: 1 },
  });
  const needs = await getIrrigationNeedsDashboardForUser({ ownerUserId: owner, season: 2026, snapshot, weekStart: WEEK, now: NOW });
  const today = await getTodayViewForUser({ ownerUserId: owner, season: 2026, snapshot, enabled: [...FEATURE_IDS], now: NOW });
  assert.ok(today.week, '« Aujourd’hui » lit la semaine');
  return { history, needs, today: today.week };
}

const near = (actual: number | null | undefined, expected: number, message: string) => {
  assert.ok(typeof actual === 'number' && Math.abs(actual - expected) < 1e-9, `${message} : ${actual} au lieu de ${expected}`);
};

test('deux fermes : l’Historique dit l’objectif d’« Aujourd’hui », sur les planches qui en ont un, et l’écart sur leur eau', async () => {
  await seedAlice();
  await seedBob();

  // Alice : (21 × 50 + 31 × 150) / 200 = 28,5 mm sur la serre ; le champ est dit, jamais compté à zéro.
  const alice = await readWeek(ALICE);
  const summary = alice.history.summary;
  assert.equal(summary.objectiveMm, 28.5);
  assert.deepEqual(summary.objectiveBeds, { withObjective: 2, total: 3, bedDays: 14 });
  assert.deepEqual(alice.needs.farmObjective, { objectiveMm: 28.5, withObjective: 2, total: 3 });
  assert.equal(alice.today.farm.objectiveMm, 28.5);
  assert.equal(alice.today.tiles.objective, '28,5 mm');
  assert.ok(alice.today.tiles.objectiveDetail.startsWith('2 planches sur 3 ont un objectif, '), alice.today.tiles.objectiveDetail);
  assert.equal(historyObjectiveScopeText(summary), '2 planches sur 3 ont un objectif');
  assert.equal(farmObjectiveText(alice.needs.farmObjective), '28,5 mm visés, 2 planches sur 3 ont un objectif');
  // L'eau de toute la ferme reste celle de toute sa surface ; l'écart compare l'objectif à l'eau de la serre, celle qu'« Aujourd'hui » dit reçue.
  near(summary.irrigationMm, 26.4, 'irrigation de la ferme');
  assert.equal(summary.irrigationAndRainMm, 12);
  assert.equal(alice.today.farm.receivedMm, summary.irrigationAndRainMm, '« Aujourd’hui » dit la même eau reçue');
  assert.equal(summary.gapToObjectiveMm, 16.5);
  near(alice.today.farm.remainingMm, 16.5, 'le reste à apporter d’« Aujourd’hui », aucune planche au-dessus de son objectif');
  assert.equal(historyGapScopeText(summary), 'Eau reçue par ces 2 planches : 12 mm');
  // La pluie de la ferme manque, pas celle de la serre : la page ne dit pas l'écart indisponible.
  assert.ok(alice.history.warnings.includes('La pluie réelle est indisponible sur cette période.'), alice.history.warnings.join(' | '));
  assert.ok(alice.history.warnings.every((warning) => !warning.includes('L’écart')), alice.history.warnings.join(' | '));

  // Bob : chaque planche a un objectif, (28 × 50 + 14 × 150 + 14 × 800) / 1 000 = 14,7 mm, comme avant D-329.
  const bob = await readWeek(BOB);
  near(bob.history.summary.objectiveMm, 14.7, 'objectif de Bob');
  assert.deepEqual(bob.history.summary.objectiveBeds, { withObjective: 3, total: 3, bedDays: 21 });
  assert.equal(bob.needs.farmObjective.withObjective, 3);
  near(bob.needs.farmObjective.objectiveMm, 14.7, 'objectif de Bob dans « Objectifs et besoins »');
  near(bob.today.farm.objectiveMm, 14.7, 'objectif de Bob sur « Aujourd’hui »');
  assert.ok(bob.today.tiles.objectiveDetail.startsWith('ferme entière, '), bob.today.tiles.objectiveDetail);
  assert.equal(historyObjectiveScopeText(bob.history.summary), null);
  // Le champ de Bob a un objectif et pas de pluie connue : son écart est indisponible, et la page le dit.
  assert.equal(bob.history.summary.irrigationAndRainMm, null);
  assert.equal(bob.history.summary.gapToObjectiveMm, null);
  assert.equal(historyGapScopeText(bob.history.summary), null);
  assert.ok(
    bob.history.warnings.includes('La pluie réelle est indisponible sur cette période. L’écart à l’objectif ne peut pas être calculé.'),
    bob.history.warnings.join(' | '),
  );
  assert.equal(bob.history.summary.irrigationMm, 0, 'l’irrigation d’Alice ne se lit pas chez Bob');
});

test('la serre d’Alice seule : toutes ses planches ont un objectif, la moyenne et l’écart portent sur elle entière', async () => {
  await seedAlice();
  await seedBob();
  const serre = await getIrrigationHistoryDashboardForUser({
    ownerUserId: ALICE, season: 2026, snapshot, now: NOW,
    selection: { period: { mode: 'week', anchorDate: WEEK }, scope: { level: 'plot', zoneId: FIXTURE_ZONE_ID, plotId: SERRE }, page: 1 },
  });
  assert.equal(serre.summary.objectiveMm, 28.5);
  assert.deepEqual(serre.summary.objectiveBeds, { withObjective: 2, total: 2, bedDays: 14 });
  assert.equal(serre.summary.irrigationMm, 12);
  assert.equal(serre.summary.actualRainMm, 0, 'sous abri, zéro explicite');
  assert.equal(serre.summary.gapToObjectiveMm, 16.5);
  assert.equal(historyObjectiveScopeText(serre.summary), null);
  assert.equal(historyGapScopeText(serre.summary), null);
  // Le champ d'Alice, sans objectif : ni objectif ni écart, et la page le dit.
  const champ = await getIrrigationHistoryDashboardForUser({
    ownerUserId: ALICE, season: 2026, snapshot, now: NOW,
    selection: { period: { mode: 'week', anchorDate: WEEK }, scope: { level: 'plot', zoneId: FIXTURE_ZONE_ID, plotId: CHAMP }, page: 1 },
  });
  assert.equal(champ.summary.objectiveMm, null);
  assert.equal(champ.summary.gapToObjectiveMm, null);
  assert.equal(historyObjectiveScopeText(champ.summary), 'Aucun objectif sur la période');
  assert.ok(champ.warnings.includes('Aucune eau visée n’est enregistrée sur cette période.'), champ.warnings.join(' | '));
});
