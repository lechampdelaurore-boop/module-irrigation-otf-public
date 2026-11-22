import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { demoOwnerUserId, resolveDemoChoice } from '../../lib/domain/demo/catalogue';
import { featuresRequiring } from '../../lib/domain/features/selection';
import { addDaysToDateKey } from '../../lib/domain/water-management';
import { prepareDemoSpace } from '../../lib/services/demo-space';
import { installSimulatedDate, runOnSimulatedDay, uninstallSimulatedDate } from '../../lib/services/demo-clock';
import { getEnabledFeaturesForUser } from '../../lib/services/feature-selection-service';
import { getIrrigationFeasibilityScreenForUser, type FeasibilityScreen } from '../../lib/services/irrigation-feasibility-service';
import { adoptStageAdviceForUser } from '../../lib/services/stage-advice-adoption';
import { saveSensitiveStagesForUser } from '../../db/crop-water/sensitive-stages';
import { saveFeatureSelectionForUser } from '../../db/feature-selection-repository';
import { readIrrigationNeedSettingsForUser, saveIrrigationBedNeedDecisionForUser } from '../../db/irrigation-need-repository';
import { readPlanningSettingsForUser, savePlanningSettingsForUser } from '../../db/planning-repository';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';

/**
 * Amélioration n° 4 : le conseil selon le stade sensible, par le service,
 * sur la démonstration « Pic d'été, l'eau manque » telle que le Worker la
 * prépare (docs/ameliorations-4-5-contract.md, §3.2 et §3.3, F731 et F732) :
 * la répartition en pénurie, le conseil lu sans la changer, « Adopter » et
 * ce qu'il écrit. La règle elle-même se prouve dans tests/stades-sensibles.test.ts.
 */

/** L'heure réelle, figée comme dans les tests du lot I : la démonstration se prépare à l'heure réelle de la ferme. */
const OriginalDate = Date;
const realClockNow = OriginalDate.now;
const PINNED_REAL_NOW = OriginalDate.UTC(2026, 10, 18, 10, 30);
const SEASON = 2026;
const MANUAL_NEED_MM = 30;
const NEED_AT_OVERRIDE_MM = 20;

let database: TestDatabase;
const savedDemoMode = process.env.DEMO_MODE;
beforeEach(() => {
  database = installTestDatabase();
  process.env.DEMO_MODE = 'true';
});
afterEach(() => {
  uninstallSimulatedDate();
  OriginalDate.now = realClockNow;
  database.dispose();
  if (savedDemoMode === undefined) delete process.env.DEMO_MODE;
  else process.env.DEMO_MODE = savedDemoMode;
});

/** La démonstration « Pic d'été, l'eau manque », préparée au jour du moment ; `onDay` joue un geste ce jour-là. */
async function penurie() {
  const choice = resolveDemoChoice('maraichage', 'penurie');
  const owner = demoOwnerUserId('invite-a', choice);
  OriginalDate.now = () => PINNED_REAL_NOW;
  installSimulatedDate();
  const onDay = <T>(work: () => Promise<T>) => runOnSimulatedDay(choice.moment.dateKey, work);
  await onDay(() => prepareDemoSpace(owner, choice));
  const screen = () => onDay(() => getIrrigationFeasibilityScreenForUser({ ownerUserId: owner, season: SEASON }));
  return { owner, onDay, screen };
}

function advice(screen: FeasibilityScreen) {
  assert.equal(screen.stageAdvice?.kind, 'advice', 'en pénurie, un conseil');
  return screen.stageAdvice;
}

function groupsOf(screen: FeasibilityScreen) {
  return advice(screen).advice.groups.map((group) => [group.referenceCropName, group.beds.map((bed) => bed.bedName)]);
}

function needOf(screen: FeasibilityScreen, bedName: string) {
  const row = screen.dashboard.priorities.flatMap((level) => level.beds).find((candidate) => candidate.need.bedName === bedName);
  assert.ok(row, `la planche ${bedName} dans la répartition`);
  return row.need;
}

function decisionLog(bedId: string) {
  return database.sqlite.prepare('SELECT action, payload FROM irrigation_need_decision_log WHERE otf_bed_id = ? ORDER BY created_at, rowid').all(bedId)
    .map((row) => ({ action: String(row.action), payload: JSON.parse(String(row.payload)) as Record<string, unknown> }));
}

test('en pénurie, la courgette puis la tomate : chaque planche à son stade d’après le calendrier, la répartition inchangée', async () => {
  const { owner, screen } = await penurie();
  const before = await screen();
  const { advice: read, equalSharePlanning } = advice(before);
  assert.equal(before.dashboard.forecastAvailableCubicMeters !== null, true, 'l’eau disponible est connue');
  assert.deepEqual(groupsOf(before), [['Courgette', ['H02']], ['Tomate', ['A01', 'A02']]]);
  assert.deepEqual(read.bedIds, ['bed-h02', 'bed-a01', 'bed-a02']);
  assert.equal(equalSharePlanning, false);
  const [courgette, tomate] = read.groups;
  assert.deepEqual(courgette.beds[0].crops.map((crop) => [crop.plantName, crop.seriesName, crop.stageLabel, crop.fromCalendar]),
    [['Courgette', 'Courgettes', 'Floraison → Mi-récolte', true]]);
  assert.deepEqual(tomate.beds[0].crops.map((crop) => [crop.plantName, crop.stageLabel, crop.fromCalendar]),
    [['Tomate', 'Floraison 3e bouquet → Mi-récolte', true]]);
  assert.ok(courgette.beds[0].relativeDeficitPercent! > tomate.beds[0].relativeDeficitPercent!, 'le plus fort déficit d’abord');
  // C02 et S01, servies en partie, n'ont aucune culture à un stade sensible : aucun conseil.
  assert.equal(needOf(before, 'C02').priority, 'normal');
  assert.ok(!read.bedIds.includes(needOf(before, 'C02').bedId));
  // Lire le conseil n'écrit rien : la répartition relue est la même.
  const decisions = (await readIrrigationNeedSettingsForUser(owner, SEASON, before.dashboard.weekStart)).decisions;
  const again = await screen();
  assert.deepEqual(again.dashboard.priorities.map((level) => level.beds.map((row) => [row.need.bedId, row.status])),
    before.dashboard.priorities.map((level) => level.beds.map((row) => [row.need.bedId, row.status])));
  assert.deepEqual((await readIrrigationNeedSettingsForUser(owner, SEASON, before.dashboard.weekStart)).decisions, decisions);
});

test('« Adopter » : la priorité haute pour cette semaine seulement, le besoin manuel gardé, l’origine au journal, la planche hors du conseil', async () => {
  const { owner, onDay, screen } = await penurie();
  const first = await screen();
  const weekStart = first.dashboard.weekStart;
  const a01 = needOf(first, 'A01');
  // Un besoin manuel posé à la main pour la semaine, avant le geste.
  await onDay(() => saveIrrigationBedNeedDecisionForUser(owner, {
    season: SEASON, weekStart, otfZoneId: a01.zoneId, otfPlotId: a01.plotId, otfBedId: a01.bedId, priority: 'normal',
    manualOverrideMm: MANUAL_NEED_MM, overrideReason: 'essai', calculatedNeedAtOverrideMm: NEED_AT_OVERRIDE_MM,
  }));
  assert.ok(advice(await screen()).advice.bedIds.includes(a01.bedId), 'toujours conseillée avec son besoin manuel');

  const adopted = await onDay(() => adoptStageAdviceForUser({ ownerUserId: owner, season: SEASON, weekStart, bedId: a01.bedId }));
  assert.equal(adopted.message, 'Priorité haute enregistrée pour A01, pour cette semaine seulement. Les quantités ont été recalculées.');
  const decision = (await readIrrigationNeedSettingsForUser(owner, SEASON, weekStart)).decisions.find((item) => item.otfBedId === a01.bedId);
  assert.deepEqual([decision?.priority, decision?.manualOverrideMm, decision?.overrideReason, decision?.calculatedNeedAtOverrideMm],
    ['high', MANUAL_NEED_MM, 'essai', NEED_AT_OVERRIDE_MM]);
  // La semaine suivante reprend sa propre priorité : rien n'y est écrit.
  const next = (await readIrrigationNeedSettingsForUser(owner, SEASON, addDaysToDateKey(weekStart, 7))).decisions;
  assert.equal(next.some((item) => item.otfBedId === a01.bedId), false);
  // Le journal garde l'origine du geste ; le choix à la main n'en a pas.
  const log = decisionLog(a01.bedId);
  assert.equal(log.length, 2);
  assert.equal(log[0].payload.origin, undefined);
  assert.deepEqual(log[1].payload, { priority: 'high', manualOverrideMm: MANUAL_NEED_MM, overrideReason: 'essai', calculatedNeedAtOverrideMm: NEED_AT_OVERRIDE_MM, origin: 'stage-advice' });
  // La répartition relue : A01 en priorité haute, hors du conseil ; les autres conseils restent.
  assert.equal(needOf(adopted, 'A01').priority, 'high');
  assert.deepEqual(groupsOf(adopted), [['Courgette', ['H02']], ['Tomate', ['A02']]]);
});

test('un conseil qui ne tient plus n’écrit rien ; une planche déjà haute le dit ; une semaine changée est refusée', async () => {
  const { owner, onDay, screen } = await penurie();
  const first = await screen();
  const weekStart = first.dashboard.weekStart;
  const c02 = needOf(first, 'C02');
  const stale = await onDay(() => adoptStageAdviceForUser({ ownerUserId: owner, season: SEASON, weekStart, bedId: c02.bedId }));
  assert.equal(stale.message, 'Ce conseil ne tient plus : rien n’a été changé. Voici la répartition à jour.');
  assert.deepEqual(decisionLog(c02.bedId), []);
  const unknown = await onDay(() => adoptStageAdviceForUser({ ownerUserId: owner, season: SEASON, weekStart, bedId: 'planche-inconnue' }));
  assert.equal(unknown.message, 'Ce conseil ne tient plus : rien n’a été changé. Voici la répartition à jour.');

  const h02 = needOf(first, 'H02');
  await onDay(() => adoptStageAdviceForUser({ ownerUserId: owner, season: SEASON, weekStart, bedId: h02.bedId }));
  const twice = await onDay(() => adoptStageAdviceForUser({ ownerUserId: owner, season: SEASON, weekStart, bedId: h02.bedId }));
  assert.equal(twice.message, 'H02 est déjà en priorité haute cette semaine.');
  assert.equal(decisionLog(h02.bedId).length, 1, 'un seul geste écrit');

  await assert.rejects(
    onDay(() => adoptStageAdviceForUser({ ownerUserId: owner, season: SEASON, weekStart: addDaysToDateKey(weekStart, -7), bedId: needOf(first, 'A02').bedId })),
    /La semaine a changé\. Rechargez la faisabilité\./,
  );
  assert.deepEqual(decisionLog(needOf(first, 'A02').bedId), []);
});

test('le réglage de la ferme compte ; la part égale le dit ; sans « Besoin par culture », une ligne le dit à la place du conseil', async () => {
  const { owner, onDay, screen } = await penurie();
  // La floraison de la courgette décochée par la ferme : plus de conseil pour H02.
  const saved = await onDay(() => saveSensitiveStagesForUser(owner, { cropKey: 'criiam-courgette', sensitiveRanks: [] }));
  assert.equal(saved.ok, true);
  assert.deepEqual(groupsOf(await screen()), [['Tomate', ['A01', 'A02']]]);

  // Le planning à parts égales ne lit pas les priorités : la phrase le dit.
  const settings = await readPlanningSettingsForUser(owner);
  await onDay(() => savePlanningSettingsForUser(owner, owner, { ...settings, shortageStrategy: 'equal-share' }));
  assert.equal(advice(await screen()).equalSharePlanning, true);

  // Sans « Besoin par culture », le module ne connaît pas les stades : en pénurie, une ligne le dit.
  const enabled = await getEnabledFeaturesForUser(owner);
  const without = enabled.filter((id) => id !== 'cultures' && !featuresRequiring(enabled, 'cultures').includes(id));
  await onDay(() => saveFeatureSelectionForUser(owner, without, new Date()));
  assert.deepEqual((await screen()).stageAdvice, { kind: 'missing-part', notice: 'Le conseil selon le stade sensible des cultures demande Besoin par culture.' });
});
