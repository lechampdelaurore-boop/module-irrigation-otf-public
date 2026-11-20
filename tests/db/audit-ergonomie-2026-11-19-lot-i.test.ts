import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { afterEach, beforeEach, mock } from 'node:test';
import { demoOwnerUserId, resolveDemoChoice } from '../../lib/domain/demo/catalogue';
import { DemoSpacePreparingError, prepareDemoSpace } from '../../lib/services/demo-space';
import { createWorkspaceIfAbsent } from '../../db/workspace-repository';
import { readFeatureSelectionForUser } from '../../db/feature-selection-repository';
import { listEquipmentForUser } from '../../db/equipment/read';
import { readLatestPlanForUser } from '../../db/planning-repository';
import { getIrrigationFeasibilityScreenForUser } from '../../lib/services/irrigation-feasibility-service';
import { beyondNeedSentence, shortageAction, waterBeyondNeed } from '../../lib/domain/planning/shortage-reading';
import { feasibilityPlanGap } from '../../lib/domain/feasibility-plan-gap';
import { volumeText } from '../../lib/domain/display-numbers';
import type { StoredWeeklyPlan } from '../../lib/domain/planning/contract';
import { installSimulatedDate, runOnSimulatedDay, uninstallSimulatedDate } from '../../lib/services/demo-clock';
import { listDailyWaterLimitsForUser, listHydricGoalsForUser, saveDailyWaterLimitForUser, saveHydricGoalForUser } from '../../db/water-management-repository';
import { goalRevisionFirstDate } from '../../lib/domain/hydric-goal-revisions';
import { FARM_TIME_ZONE, dateKeyInTimeZone } from '../../lib/domain/water-management';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';

/**
 * Audit ergonomique du 19 novembre 2026, lot I « Pénurie et démonstration »
 * (docs/audit-ergonomie-2026-11-19-lot-i-contract.md), sur la démonstration
 * telle que le Worker la prépare.
 */

let database: TestDatabase;
const savedDemoMode = process.env.DEMO_MODE;
beforeEach(() => {
  database = installTestDatabase();
  process.env.DEMO_MODE = 'true';
});
afterEach(() => {
  uninstallSimulatedDate();
  mock.restoreAll();
  database.dispose();
  if (savedDemoMode === undefined) delete process.env.DEMO_MODE;
  else process.env.DEMO_MODE = savedDemoMode;
});

/** 8 h à la ferme, un jour réel quelconque : l'heure où se jouent les épreuves de la pénurie. */
const FARM_MORNING_MS = Date.parse('2026-11-20T07:00:00.000Z');

/**
 * La démonstration se joue le jour du moment, à l'heure réelle de la ferme
 * (docs/demo-guided-contract.md, C3), et son plan change avec l'heure : vers
 * 21 h 14 à 21 h 30, celui de la pénurie verse moins de 0,4 m³ sur les
 * planches vides (0,378 m³ dans la CI du 20 novembre 2026 à 21 h 17). Les
 * épreuves de la pénurie mettent donc l'horloge réelle à 8 h, heure de la
 * ferme, et la laissent courir de là, quelle que soit l'heure où elles
 * tournent. L'horloge réelle reprend son cours après chaque épreuve.
 */
function realClockFromFarmMorning(): void {
  const realNow = Date.now;
  const shift = FARM_MORNING_MS - realNow();
  mock.method(Date, 'now', () => realNow() + shift);
}

/** La démonstration « Pic d'été, l'eau manque », préparée au jour du moment à 8 h, heure de la ferme, et son plan. */
async function penurie() {
  const choice = resolveDemoChoice('maraichage', 'penurie');
  const owner = demoOwnerUserId('invite-a', choice);
  realClockFromFarmMorning();
  installSimulatedDate();
  await runOnSimulatedDay(choice.moment.dateKey, () => prepareDemoSpace(owner, choice));
  const plan = (await readLatestPlanForUser(owner, 2026, '2026-07-20'))!;
  return { choice, owner, plan, now: new Date(plan.calculation.computedAt) };
}

// n° 5 — Le manque dit d'où il vient (PR 1, F445 à F447).

test('n° 5, F445 : la phrase du manque dit l’eau que les goutte-à-goutte versent sur les planches vides', async () => {
  const { plan, now } = await penurie();
  const beyond = waterBeyondNeed(plan, now)!;
  assert.equal(beyond.withoutNeed, true, 'les planches sans culture de la semaine');
  assert.deepEqual(beyond.bedNames, ['A03', 'C01', 'H01', 'H03']);
  assert.ok(beyond.cubicMeters > 0.4 && beyond.cubicMeters < 0.6, `${beyond.cubicMeters} m³`);
  const sentence = shortageAction(plan, volumeText, now)!.sentence;
  assert.match(sentence, /^Il manque [\d,]+ L d’eau d’ici dimanche : 5 planches ne recevront pas tout leur besoin\. Le matériel verse aussi [\d,]+ L sur des planches qui n’en ont pas besoin cette semaine \(A03, C01, H01 et 1 autre\)\.$/);
  // Sans l'heure ni les créneaux, la phrase reste celle du planning (lot B) : rien n'est ajouté.
  assert.doesNotMatch(shortageAction({ calculation: plan.calculation }, volumeText)!.sentence, /verse aussi/);
});

test('n° 5, F445 : sous le litre, ni phrase ni volume ; un surplus sur une planche qui a un besoin se dit autrement', async () => {
  const { plan, now } = await penurie();
  const withoutSurplus: StoredWeeklyPlan = { ...plan, proposals: plan.proposals.map((proposal) => ({ ...proposal, bedApplications: proposal.bedApplications.map((application) => ({ ...application, surplusMm: 0 })) })) };
  assert.equal(waterBeyondNeed(withoutSurplus, now), null);
  const onNeeded = beyondNeedSentence({ cubicMeters: 0.25, unknownVolume: true, bedNames: ['B2'], withoutNeed: false }, volumeText);
  assert.equal(onNeeded, 'Le matériel verse aussi au moins 250 L au-delà du besoin des planches qu’il arrose (B2).');
});

test('n° 5, F446 et point 5 : le bassin de la démonstration à 5 m³, la répartition a quelque chose à répartir', async () => {
  const { choice, owner } = await penurie();
  const screen = await runOnSimulatedDay(choice.moment.dateKey, () => getIrrigationFeasibilityScreenForUser({ ownerUserId: owner, season: 2026 }));
  assert.equal(screen.dashboard.requiresManualArbitration, true, 'un choix attend : l’écran de répartition s’ouvre');
  assert.equal(screen.planGap, null, 'la faisabilité voit le manque : rien à expliquer');
  assert.deepEqual(screen.dashboard.notes, [
    '5 planches sans objectif adopté : leur besoin n’est pas compté ici.',
    'Calcul en volume seulement : les heures, les pompes et le remplissage des réserves sont vérifiés par le planning.',
  ]);
  assert.ok(screen.dashboard.warnings.every((warning) => !/non calculable|Analyse volumétrique/.test(warning)), 'plus d’avertissement en jargon');
});

test('n° 5, F446 : un manque que la faisabilité ne voit pas se dit, d’où il vient et quoi faire', async () => {
  const { plan, now } = await penurie();
  const sees = { priorities: [], knownNeedCubicMeters: 1.2, forecastAvailableCubicMeters: 2, requiresManualArbitration: false };
  const gap = feasibilityPlanGap({ plan, feasibility: sees, now })!;
  assert.match(gap.lead, /^Le planning compte un manque de [\d,]+ L d’ici dimanche, que cette répartition ne voit pas\.$/);
  assert.match(gap.cause, /^Les besoins des planches qui ont un objectif \(1,2 m³\) tiennent dans l’eau disponible \(2 m³\)\. Le matériel verse aussi [\d,]+ L sur des planches qui n’en ont pas besoin cette semaine \(A03, C01, H01 et 1 autre\)\. Le manque vient de là\. Fermez leurs lignes, retirez ces planches du matériel, ou fixez leur objectif\.$/);
  assert.deepEqual(gap.links.map((link) => link.page), ['materiel', 'besoins']);
  // Sans eau versée au-delà du besoin : les heures, les pompes, le remplissage, et le lien vers le planning.
  const withoutSurplus: StoredWeeklyPlan = { ...plan, proposals: plan.proposals.map((proposal) => ({ ...proposal, bedApplications: proposal.bedApplications.map((application) => ({ ...application, surplusMm: 0 })) })) };
  const timing = feasibilityPlanGap({ plan: withoutSurplus, feasibility: sees, now })!;
  assert.match(timing.cause, /Le manque vient des heures, des pompes ou du remplissage des réserves/);
  assert.deepEqual(timing.links.map((link) => link.page), ['planning']);
  // La faisabilité voit le manque, une répartition s'applique, ou le plan ne manque de rien : rien à dire.
  assert.equal(feasibilityPlanGap({ plan, feasibility: { ...sees, requiresManualArbitration: true }, now }), null);
  const arbitrated: StoredWeeklyPlan = { ...plan, calculation: { ...plan.calculation, summary: { ...plan.calculation.summary, arbitration: { allocatedCubicMeters: 1, unreceivableCubicMeters: 0, unreceivableBedCount: 0 } as never } } };
  assert.equal(feasibilityPlanGap({ plan: arbitrated, feasibility: sees, now }), null);
  assert.equal(feasibilityPlanGap({ plan: null, feasibility: sees, now }), null);
});

// n° 10 — La démonstration à son jour (PR 2, F449).

test('n° 10, F449 : un objectif posé dans la démonstration est daté du jour simulé et compte dès ce jour', async () => {
  const { choice, owner } = await penurie();
  const today = choice.moment.dateKey;
  const weekStart = '2026-07-20';
  await runOnSimulatedDay(today, () => saveHydricGoalForUser(owner, { season: 2026, weekStart, scopeType: 'farm', otfZoneId: null, otfPlotId: null, otfBedId: null, amountMm: 60 }));
  const farm = (await listHydricGoalsForUser(owner, 2026, weekStart)).find((goal) => goal.scopeType === 'farm')!;
  assert.equal(dateKeyInTimeZone(farm.createdAt, FARM_TIME_ZONE), today, 'le jour simulé, pas le jour réel');
  assert.equal(goalRevisionFirstDate({ weekStart, createdAt: farm.createdAt, copiedFromGoalId: null }), today, 'il compte dès sa pose, dans sa semaine');
  // La limite journalière aussi, que la plus récente l'emporte entre les écritures de la démonstration.
  await runOnSimulatedDay(today, () => saveDailyWaterLimitForUser(owner, { season: 2026, enabled: true, maxCubicMetersPerDay: 3, validFrom: today, validUntil: null, note: null }));
  const [limit] = await listDailyWaterLimitsForUser(owner);
  assert.equal(dateKeyInTimeZone(limit.createdAt, FARM_TIME_ZONE), today);
});

test('n° 10, F449 : hors démonstration, la date d’écriture reste l’heure réelle', async () => {
  delete process.env.DEMO_MODE;
  const before = Date.now();
  await saveHydricGoalForUser('ferme-reelle', { season: 2026, weekStart: '2026-11-16', scopeType: 'farm', otfZoneId: null, otfPlotId: null, otfBedId: null, amountMm: 20 });
  const [goal] = await listHydricGoalsForUser('ferme-reelle', 2026, '2026-11-16');
  assert.ok(Date.parse(goal.createdAt) >= before - 1000 && Date.parse(goal.createdAt) <= Date.now() + 1000, goal.createdAt);
});

// n° 11 — La démonstration se prépare jusqu'au bout (PR 3, F450).

/** Un espace créé il y a `minutes` minutes, dont la préparation s'est arrêtée avant d'écrire quoi que ce soit d'autre. */
async function interruptedSpace(minutes: number) {
  const choice = resolveDemoChoice('maraichage', 'ete');
  const owner = demoOwnerUserId('invite-b', choice);
  installSimulatedDate();
  assert.equal(await createWorkspaceIfAbsent(owner), true);
  database.sqlite.prepare(`UPDATE irrigation_workspaces SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?) WHERE owner_user_id = ?`).run(`-${minutes} minutes`, owner);
  return { choice, owner };
}

test('n° 11, F450 : une préparation interrompue depuis plus de deux minutes est reprise jusqu’au bout, une seule fois', async () => {
  const { choice, owner } = await interruptedSpace(3);
  assert.equal((await readFeatureSelectionForUser(owner)).kind, 'before-selection', 'à moitié prête : aucune case');
  // Deux requêtes arrivent ensemble : une seule reprend, l'autre attend qu'elle ait fini.
  await Promise.all([
    runOnSimulatedDay(choice.moment.dateKey, () => prepareDemoSpace(owner, choice)),
    runOnSimulatedDay(choice.moment.dateKey, () => prepareDemoSpace(owner, choice).catch((error: unknown) => assert.ok(error instanceof DemoSpacePreparingError))),
  ]);
  assert.equal((await readFeatureSelectionForUser(owner)).kind, 'stored', 'les cases, écrites en dernier');
  assert.equal((await listEquipmentForUser(owner)).length, 4, 'le matériel, une seule fois');
  const spaces = database.sqlite.prepare('SELECT owner_user_id FROM irrigation_workspaces WHERE owner_user_id LIKE ?').all(`${owner}%`) as { owner_user_id: string }[];
  assert.equal(spaces.length, 2, 'l’espace interrompu mis de côté, un espace neuf');
  assert.equal(spaces.filter((space) => space.owner_user_id.includes('·archive·')).length, 1);
});

test('n° 11, F450 : une préparation en cours depuis moins de deux minutes n’est pas reprise ; la page dit qu’elle se prépare', async () => {
  const { choice, owner } = await interruptedSpace(0);
  await assert.rejects(runOnSimulatedDay(choice.moment.dateKey, () => prepareDemoSpace(owner, choice)), DemoSpacePreparingError);
  assert.equal((await readFeatureSelectionForUser(owner)).kind, 'before-selection', 'rien n’est écrit à sa place');
  const spaces = database.sqlite.prepare('SELECT owner_user_id FROM irrigation_workspaces WHERE owner_user_id LIKE ?').all(`${owner}%`);
  assert.equal(spaces.length, 1, 'rien n’est mis de côté');
});

test('n° 11, F450 : la page d’attente se relit seule toutes les deux secondes', () => {
  const source = readFileSync('app/irrigation/shell/unavailable-state.tsx', 'utf8');
  assert.match(source, /title: 'Préparation de votre démonstration…'/);
  assert.match(source, /PREPARING_RELOAD_SECONDS = 2;/);
  assert.match(source, /window\.location\.reload\(\)/);
  for (const page of ['app/irrigation/page-context.ts', 'app/irrigation/page.tsx', 'app/irrigation/bienvenue/page.tsx']) {
    assert.match(readFileSync(page, 'utf8'), /instanceof DemoSpacePreparingError/, page);
  }
});
