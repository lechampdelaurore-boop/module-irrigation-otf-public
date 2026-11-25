import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { demoFarmSnapshot } from '../../lib/adapters/demo/farms';
import { DEMO_PROFILES, demoOwnerUserId, resolveDemoChoice } from '../../lib/domain/demo/catalogue';
import { farmObjectiveText } from '../../lib/domain/farm-objective';
import { historyObjectiveScopeText } from '../../lib/domain/irrigation-history/objective-scope';
import { FEATURE_IDS } from '../../lib/domain/features/catalogue';
import { getIrrigationHistoryDashboardForUser } from '../../lib/services/irrigation-history-service';
import { getIrrigationNeedsDashboardForUser } from '../../lib/services/irrigation-needs-service';
import { getTodayViewForUser } from '../../lib/services/today-service';
import { installSimulatedDate, runOnSimulatedDay, uninstallSimulatedDate } from '../../lib/services/demo-clock';
import { prepareDemoSpace } from '../../lib/services/demo-space';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';

/**
 * Simplifier l'usage du module, lot S1, PR 3 bis, la démonstration rejouée
 * (D-329, docs/simplification-s1-contract.md, section 5 bis, « Preuve ») :
 * chaque ferme de démonstration, à chacun de ses moments, préparée comme le
 * Worker la prépare, au jour du moment. La semaine du moment, la ferme
 * entière : l'Historique dit l'objectif d'« Aujourd'hui » et d'« Objectifs et
 * besoins », le même chiffre sur les mêmes planches, avec la même phrase.
 */

/** L'heure réelle, figée comme dans les tests du lot I : la démonstration se prépare à l'heure réelle de la ferme. */
const OriginalDate = Date;
const realClockNow = OriginalDate.now;
const PINNED_REAL_NOW = OriginalDate.UTC(2026, 10, 25, 10, 30);
const SEASON = 2026;

let database: TestDatabase;
const savedDemoMode = process.env.DEMO_MODE;
beforeEach(() => {
  database = installTestDatabase();
  process.env.DEMO_MODE = 'true';
  OriginalDate.now = () => PINNED_REAL_NOW;
  installSimulatedDate();
});
afterEach(() => {
  uninstallSimulatedDate();
  OriginalDate.now = realClockNow;
  database.dispose();
  if (savedDemoMode === undefined) delete process.env.DEMO_MODE;
  else process.env.DEMO_MODE = savedDemoMode;
});

const near = (actual: number | null | undefined, expected: number | null, message: string) => {
  if (expected === null) assert.equal(actual, null, message);
  else assert.ok(typeof actual === 'number' && Math.abs(actual - expected) < 1e-9, `${message} : ${actual} au lieu de ${expected}`);
};

test('chaque ferme de démonstration, à chaque moment : la semaine de l’Historique dit l’objectif d’« Aujourd’hui »', async () => {
  let compared = 0;
  let partial = 0;
  for (const profile of DEMO_PROFILES) {
    for (const moment of profile.moments) {
      const choice = resolveDemoChoice(profile.id, moment.id);
      const label = `${profile.id} · ${moment.id}`;
      const owner = demoOwnerUserId('invite-historique', choice);
      const onDay = <T>(work: () => Promise<T>) => runOnSimulatedDay(moment.dateKey, work);
      await onDay(() => prepareDemoSpace(owner, choice));
      const snapshot = demoFarmSnapshot(profile.id, moment.dateKey);
      const { history, needs, today } = await onDay(async () => ({
        history: await getIrrigationHistoryDashboardForUser({
          ownerUserId: owner, season: SEASON, snapshot,
          selection: { period: { mode: 'week', anchorDate: moment.dateKey }, scope: { level: 'farm' }, page: 1 },
        }),
        needs: await getIrrigationNeedsDashboardForUser({ ownerUserId: owner, season: SEASON, snapshot }),
        today: (await getTodayViewForUser({ ownerUserId: owner, season: SEASON, snapshot, enabled: [...FEATURE_IDS] })).week,
      }));
      assert.equal(history.period.startDate, needs.weekStart, `${label} : la même semaine`);
      const summary = history.summary;
      const farm = needs.farmObjective;
      near(summary.objectiveMm, farm.objectiveMm, `${label} : l’objectif d’« Objectifs et besoins »`);
      assert.deepEqual([summary.objectiveBeds.withObjective, summary.objectiveBeds.total], [farm.withObjective, farm.total], `${label} : les mêmes planches`);
      assert.equal(
        farmObjectiveText({ objectiveMm: summary.objectiveMm, withObjective: summary.objectiveBeds.withObjective, total: summary.objectiveBeds.total }),
        farmObjectiveText(farm),
        `${label} : la même phrase`,
      );
      assert.ok(today, `${label} : « Aujourd’hui » lit la semaine`);
      near(today.farm.objectiveMm, farm.objectiveMm, `${label} : l’objectif d’« Aujourd’hui »`);
      compared += 1;
      if (farm.withObjective > 0 && farm.withObjective < farm.total) partial += 1;
      // La Ferme des Trois Noues au début de l'été : l'Historique disait 16,5 mm, la moyenne sur ses dix planches.
      if (profile.id === 'maraichage' && moment.id === 'ete') {
        assert.equal(farmObjectiveText(farm), '23,4 mm visés, 7 planches sur 10 ont un objectif', label);
        assert.ok(historyObjectiveScopeText(summary)?.startsWith('7 planches sur 10 ont un objectif'), label);
      }
    }
  }
  assert.equal(compared, DEMO_PROFILES.reduce((sum, profile) => sum + profile.moments.length, 0), 'chaque ferme, chaque moment');
  assert.ok(partial > 0, 'au moins un moment où une partie seulement des planches a un objectif');
});
