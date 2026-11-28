import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { demoFarmSnapshot } from '../../lib/adapters/demo/farms';
import { demoOwnerUserId, resolveDemoChoice, type DemoChoice } from '../../lib/domain/demo/catalogue';
import { reliabilityTableRows } from '../../lib/domain/weather/forecast-reliability';
import { installSimulatedDate, runOnSimulatedDay, uninstallSimulatedDate } from '../../lib/services/demo-clock';
import { prepareDemoSpace } from '../../lib/services/demo-space';
import { getForecastReliabilityForSpace } from '../../lib/services/forecast-reliability';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';

/**
 * « La météo s'est-elle vérifiée ? » sur la démonstration
 * (docs/forecast-reliability-contract.md, §6, D-338, PR 2) : l'espace d'un
 * invité, préparé comme le Worker de démonstration le prépare, reçoit une
 * archive semée ; au jour du moment, le pli a ses chiffres. Déterministe :
 * deux invités voient les mêmes. Les lignes ne vivent que dans l'espace de
 * l'invité.
 */

const OriginalDate = Date;
const realClockNow = OriginalDate.now;
const PINNED_REAL_NOW = OriginalDate.UTC(2026, 10, 26, 10, 30);
const ETE = resolveDemoChoice('maraichage', 'ete');

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

async function openDemo(guest: string, choice: DemoChoice = ETE) {
  const owner = demoOwnerUserId(guest, choice);
  const onDay = <T>(work: () => Promise<T>) => runOnSimulatedDay(choice.moment.dateKey, work);
  await onDay(() => prepareDemoSpace(owner, choice));
  const snapshot = demoFarmSnapshot(choice.profile.id, choice.moment.dateKey);
  return { owner, read: () => onDay(() => getForecastReliabilityForSpace({ ownerUserId: owner, snapshot, now: new Date() })) };
}

test('au début de l’été, le pli de la démonstration a ses chiffres pour la pluie et la soif', async () => {
  const { read } = await openDemo('invite-a');
  const reliability = await read();
  assert.equal(reliability.status, 'ready');
  assert.equal(reliability.window.endDate, '2026-06-15', 'au mardi 16 juin 2026');
  for (const result of [reliability.rainEstimated, reliability.thirst]) {
    for (const line of result.daily) assert.ok(line.gaps !== null, `${result.reading} ${line.group} : ${line.pairCount} couples`);
    const rows = reliabilityTableRows(result);
    assert.equal(rows.length, 5, 'trois lignes d’horizon, le total et le cumul de la semaine');
  }
  // Le jour du moment est un mardi : la réanalyse semée couvre trois semaines entières (F1005).
  assert.equal(reliability.rainEstimated.week.weekCount, 3);
  assert.equal(reliability.rainEstimated.week.gaps, null);
  assert.equal(reliability.rainMeasured.measuredDays, 0, 'la démonstration n’a pas de pluie notée');
  // L'écart de la soif à J+1 porte la différence de méthode semée.
  const dayAhead = reliability.thirst.byHorizon.find((horizon) => horizon.horizonDays === 1);
  assert.ok(dayAhead && dayAhead.meanAbsoluteGapMm > 0);
  // L'écart grandit avec l'horizon, comme l'annonce semée.
  const [near, , far] = reliability.rainEstimated.daily;
  assert.ok(near.gaps && far.gaps && far.gaps.meanAbsoluteGapMm > near.gaps.meanAbsoluteGapMm);
});

test('deux invités voient les mêmes chiffres ; chacun a sa propre archive', async () => {
  const first = await openDemo('invite-a');
  const second = await openDemo('invite-b');
  assert.deepEqual(await first.read(), await second.read());
  const owners = database.sqlite.prepare(
    `SELECT w.owner_user_id AS owner, COUNT(*) AS n FROM irrigation_weather_forecast_archive a
     JOIN irrigation_workspaces w ON w.id = a.workspace_id GROUP BY w.owner_user_id ORDER BY w.owner_user_id`,
  ).all() as { owner: string; n: number }[];
  assert.deepEqual(owners.map((row) => row.owner).sort(), [first.owner, second.owner].sort());
  assert.equal(Number(owners[0].n), Number(owners[1].n));
});

test('rouverte, la démonstration ne réécrit pas l’archive', async () => {
  const { owner, read } = await openDemo('invite-a');
  const count = () => Number((database.sqlite.prepare('SELECT COUNT(*) AS n FROM irrigation_weather_forecast_archive').get() as { n: number }).n);
  const before = count();
  await runOnSimulatedDay(ETE.moment.dateKey, () => prepareDemoSpace(owner, ETE));
  assert.equal(count(), before);
  assert.equal((await read()).status, 'ready');
});
