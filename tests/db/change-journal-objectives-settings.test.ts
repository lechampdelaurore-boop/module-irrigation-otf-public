import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { listChangeJournalForUser } from '../../db/change-journal/read';
import { saveCropAlertSettingsForUser, saveDryingDaysForUser, saveFrostLinkForUser } from '../../db/crop-alerts/inputs';
import { saveAdoptedGoalForUser } from '../../db/crop-water/adoptions';
import { saveFeatureSelectionForUser } from '../../db/feature-selection-repository';
import { saveIrrigationBedNeedDecisionForUser, saveIrrigationNeedThresholdForUser } from '../../db/irrigation-need-repository';
import { saveEveningReminderForUser, saveMorningMessageForUser } from '../../db/phone-notice-repository';
import { savePlanningSettingsForUser } from '../../db/planning-repository';
import { createProtectedSlotForUser, deleteProtectedSlotForUser, ProtectedSlotNotFoundError, updateProtectedSlotForUser } from '../../db/protected-slots-repository';
import { addRootingProfileForUser, addSoilRecordForUser, addSoilSettingsForUser } from '../../db/soil-reserve/entries';
import { clearHydricGoalsForUser, saveDailyWaterLimitForUser, saveHydricGoalForUser } from '../../db/water-management-repository';
import { saveWaterResourceForUser, saveWaterResourceLimitForUser } from '../../db/water-resource-repository';
import { createWeatherAlertCriterionForUser, deleteWeatherAlertCriterionForUser, updateWeatherAlertCriterionForUser } from '../../db/weather-alert-repository';
import type { ChangeJournalEntry } from '../../lib/domain/change-journal/entry';
import { FEATURE_IDS } from '../../lib/domain/features/catalogue';
import { DEFAULT_PLANNING_SETTINGS } from '../../lib/domain/planning/settings';
import { DEFAULT_SOIL_SETTINGS, type SoilRecord } from '../../lib/domain/soil-reserve/soil';
import { fieldsWithoutWords } from '../support/change-journal-words';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { FARM_SOIL } from '../support/soil-reserve-fixtures';
import { crossSpaceReferences } from '../support/space-coherence';
import { ALICE, BOB } from '../support/spaces';

/**
 * Les écrivains des objectifs et des réglages branchés au journal des
 * modifications (amélioration n° 7, PR 5 ; docs/ameliorations-6-2-3-7-contract.md,
 * §5.1 et §5.2 ; D-286) : chaque geste écrit sa ligne dans le même lot, avec
 * l'avant et l'après des seuls champs qui changent ; un geste qui ne change
 * rien n'écrit rien ; chaque ferme ne lit que son journal.
 */

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

const NOW = new Date('2026-11-21T10:00:00.000Z');
const LATER = new Date('2026-11-21T10:05:00.000Z');

/** Le journal d'une ferme, dans l'ordre des gestes (l'ordre d'écriture). */
async function journal(spaceKey = ALICE): Promise<ChangeJournalEntry[]> {
  const order = (database.sqlite.prepare('SELECT id FROM irrigation_change_journal ORDER BY rowid').all() as { id: string }[]).map(({ id }) => id);
  const entries = (await listChangeJournalForUser(spaceKey, { limit: 200 })).sort((left, right) => order.indexOf(left.id) - order.indexOf(right.id));
  // Chaque champ écrit a ses mots à l'écran (PR 7, D-288, F722).
  assert.deepEqual(fieldsWithoutWords(entries), []);
  return entries;
}

function summary(entry: ChangeJournalEntry) {
  return { family: entry.family, subject: entry.subject, action: entry.action, before: entry.before, after: entry.after };
}

test('un objectif hydrique posé, changé, inchangé puis retiré : créé, modifié, rien, supprimé', async () => {
  const scope = { season: 2026, weekStart: '2026-11-16', scopeType: 'bed' as const, otfZoneId: 'zone-1', otfPlotId: 'plot-1', otfBedId: 'bed-1' };
  await saveHydricGoalForUser(ALICE, { ...scope, amountMm: 20 });
  await saveHydricGoalForUser(ALICE, { ...scope, amountMm: 25 });
  await saveHydricGoalForUser(ALICE, { ...scope, amountMm: 25 });
  await saveHydricGoalForUser(ALICE, { ...scope, otfBedId: 'bed-2', amountMm: 10 });
  assert.equal(await clearHydricGoalsForUser(ALICE, 2026, '2026-11-16'), 2);
  const entries = await journal();
  assert.deepEqual(entries.slice(0, 3).map(summary), [
    { family: 'objectif', subject: 'objectif-hydrique', action: 'cree', before: null, after: { amountMm: 20 } },
    { family: 'objectif', subject: 'objectif-hydrique', action: 'modifie', before: { amountMm: 20 }, after: { amountMm: 25 } },
    { family: 'objectif', subject: 'objectif-hydrique', action: 'cree', before: null, after: { amountMm: 10 } },
  ]);
  // Le retrait de la semaine : une suppression par objectif, avec la hauteur qu'il avait.
  assert.deepEqual(entries.slice(3).map((entry) => [entry.objectId, entry.action, entry.before, entry.after]).sort(), [
    ['bed-1', 'supprime', { amountMm: 25 }, null],
    ['bed-2', 'supprime', { amountMm: 10 }, null],
  ]);
  assert.deepEqual(entries[0].context, { season: 2026, weekStart: '2026-11-16', scopeType: 'bed', zoneId: 'zone-1', plotId: 'plot-1', bedId: 'bed-1' });
  assert.equal(entries[0].objectId, 'bed-1');
  assert.equal(entries[0].actorUserId, ALICE);
  // Un objectif reposé après son retrait est créé à nouveau.
  await saveHydricGoalForUser(ALICE, { ...scope, amountMm: 25 });
  assert.equal((await journal()).at(-1)?.action, 'cree');
});

test('un objectif adopté d’une proposition s’écrit sous son sujet, l’avant étant l’objectif posé', async () => {
  await saveHydricGoalForUser(ALICE, { season: 2026, weekStart: '2026-11-16', scopeType: 'bed', otfZoneId: 'z', otfPlotId: 'p', otfBedId: 'b', amountMm: 12 });
  await saveAdoptedGoalForUser(ALICE, 2026, {
    weekStart: '2026-11-16', scopeType: 'bed', otfZoneId: 'z', otfPlotId: 'p', otfBedId: 'b', amountMm: 18, createdAt: LATER.toISOString(), origin: 'adopted-proposal',
  } as Parameters<typeof saveAdoptedGoalForUser>[2]);
  const adopted = (await journal()).find((entry) => entry.subject === 'objectif-adopte');
  assert.deepEqual(adopted && summary(adopted), { family: 'objectif', subject: 'objectif-adopte', action: 'modifie', before: { amountMm: 12 }, after: { amountMm: 18 } });
  assert.equal(adopted?.createdAt, LATER.toISOString());
});

test('le seuil de besoin et la décision d’une planche partent de leurs valeurs par défaut', async () => {
  await saveIrrigationNeedThresholdForUser(ALICE, 2026, '2026-11-16', 3);
  await saveIrrigationNeedThresholdForUser(ALICE, 2026, '2026-11-16', 3);
  const decision = { season: 2026, weekStart: '2026-11-16', otfZoneId: 'z', otfPlotId: 'p', otfBedId: 'b', calculatedNeedAtOverrideMm: null };
  await saveIrrigationBedNeedDecisionForUser(ALICE, { ...decision, priority: 'high', manualOverrideMm: null, overrideReason: null });
  await saveIrrigationBedNeedDecisionForUser(ALICE, { ...decision, priority: 'high', manualOverrideMm: 8, overrideReason: 'Repiquage', calculatedNeedAtOverrideMm: 5 });
  const entries = await journal();
  assert.deepEqual(entries.map(summary), [
    { family: 'objectif', subject: 'seuil-de-besoin', action: 'modifie', before: { thresholdMm: 0 }, after: { thresholdMm: 3 } },
    { family: 'objectif', subject: 'decision-de-planche', action: 'modifie', before: { priority: 'normal' }, after: { priority: 'high' } },
    { family: 'objectif', subject: 'decision-de-planche', action: 'modifie', before: { manualOverrideMm: null, overrideReason: null }, after: { manualOverrideMm: 8, overrideReason: 'Repiquage' } },
  ]);
  assert.equal(entries[1].objectId, 'b');
});

test('les réglages du planning : seuls les champs changés, depuis les valeurs de départ', async () => {
  const changed = {
    ...DEFAULT_PLANNING_SETTINGS,
    forecastRainShare: 0.5,
    carryOverDeficit: true,
    doses: { ...DEFAULT_PLANNING_SETTINGS.doses, drip: { ...DEFAULT_PLANNING_SETTINGS.doses.drip, maximumMm: 12 } },
  };
  await savePlanningSettingsForUser(ALICE, ALICE, changed);
  await savePlanningSettingsForUser(ALICE, ALICE, changed);
  await savePlanningSettingsForUser(ALICE, ALICE, { ...changed, shortageStrategy: 'equal-share' });
  const entries = await journal();
  assert.deepEqual(entries.map(summary), [
    {
      family: 'reglage', subject: 'reglages-du-planning', action: 'modifie',
      before: { forecastRainShare: 1, dosesDripMaximumMm: 10, carryOverDeficit: 0 },
      after: { forecastRainShare: 0.5, dosesDripMaximumMm: 12, carryOverDeficit: 1 },
    },
    {
      family: 'reglage', subject: 'reglages-du-planning', action: 'modifie',
      before: { shortageStrategy: DEFAULT_PLANNING_SETTINGS.shortageStrategy }, after: { shortageStrategy: 'equal-share' },
    },
  ]);
});

test('un créneau protégé créé, modifié, supprimé ; un geste refusé n’écrit rien, une autre ferme ne voit rien', async () => {
  const draft = { name: 'Marché', weekdays: ['saturday'], startMinute: 360, endMinute: 720 };
  const slot = await createProtectedSlotForUser(ALICE, ALICE, draft);
  await updateProtectedSlotForUser(ALICE, ALICE, slot.id, { ...draft, weekdays: ['saturday', 'sunday'], endMinute: 780 });
  await updateProtectedSlotForUser(ALICE, ALICE, slot.id, { ...draft, weekdays: ['saturday', 'sunday'], endMinute: 780 });
  await assert.rejects(updateProtectedSlotForUser(BOB, BOB, slot.id, draft), ProtectedSlotNotFoundError);
  await deleteProtectedSlotForUser(ALICE, ALICE, slot.id);
  await assert.rejects(deleteProtectedSlotForUser(ALICE, ALICE, slot.id), ProtectedSlotNotFoundError);
  const entries = await journal();
  const days = { monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 1, sunday: 0 };
  assert.deepEqual(entries.map(summary), [
    { family: 'reglage', subject: 'creneau-protege', action: 'cree', before: null, after: { name: 'Marché', ...days, startMinute: 360, endMinute: 720 } },
    { family: 'reglage', subject: 'creneau-protege', action: 'modifie', before: { sunday: 0, endMinute: 720 }, after: { sunday: 1, endMinute: 780 } },
    { family: 'reglage', subject: 'creneau-protege', action: 'supprime', before: { name: 'Marché', ...days, sunday: 1, startMinute: 360, endMinute: 780 }, after: null },
  ]);
  assert.deepEqual(entries.map((entry) => [entry.objectId, entry.context]), entries.map(() => [slot.id, { name: 'Marché' }]));
  assert.deepEqual(await journal(BOB), []);
  assert.deepEqual(crossSpaceReferences(database.sqlite), []);
});

test('les limites d’eau : la journée par saison, la ressource avec son nom', async () => {
  const limit = { season: 2026, enabled: true, maxCubicMetersPerDay: 12, validFrom: '2026-06-01', validUntil: null, note: null };
  await saveDailyWaterLimitForUser(ALICE, limit);
  await saveDailyWaterLimitForUser(ALICE, { ...limit, enabled: false, maxCubicMetersPerDay: 99 });
  const resourceId = await saveWaterResourceForUser(ALICE, ALICE, null, {
    name: 'Forage', type: 'borehole', nominalFlowCubicMetersPerHour: 2, status: 'active', availableFrom: null, availableUntil: null, notes: null,
  });
  const resourceLimit = { enabled: true, maxCubicMetersPerDay: 30, validFrom: '2026-06-01', validUntil: null, referenceNote: 'Arrêté' };
  await saveWaterResourceLimitForUser(ALICE, ALICE, resourceId, resourceLimit);
  await saveWaterResourceLimitForUser(ALICE, ALICE, resourceId, { ...resourceLimit, maxCubicMetersPerDay: 25 });
  const entries = (await journal()).filter((entry) => entry.subject !== 'ressource');
  assert.deepEqual(entries.map(summary), [
    { family: 'reglage', subject: 'limite-d-eau-du-jour', action: 'cree', before: null, after: { enabled: 1, maxCubicMetersPerDay: 12, validFrom: '2026-06-01', validUntil: null, note: null } },
    { family: 'reglage', subject: 'limite-d-eau-du-jour', action: 'modifie', before: { enabled: 1, maxCubicMetersPerDay: 12 }, after: { enabled: 0, maxCubicMetersPerDay: null } },
    { family: 'reglage', subject: 'limite-de-ressource', action: 'cree', before: null, after: { ...resourceLimit, enabled: 1 } },
    { family: 'reglage', subject: 'limite-de-ressource', action: 'modifie', before: { maxCubicMetersPerDay: 30 }, after: { maxCubicMetersPerDay: 25 } },
  ]);
  assert.deepEqual(entries[3].context, { name: 'Forage' });
  assert.equal(entries[3].objectId, resourceId);
  assert.deepEqual(crossSpaceReferences(database.sqlite), []);
});

test('le sol : la saisie d’une parcelle, les réglages depuis ceux de départ, le profil racinaire depuis le commun', async () => {
  const record = Object.fromEntries(Object.entries({ ...FARM_SOIL, zoneId: 'parcelle', plotId: null }).filter(([key]) => key !== 'recordedAt')) as Omit<SoilRecord, 'recordedAt'>;
  assert.equal((await addSoilRecordForUser(ALICE, record, NOW)).ok, true);
  assert.equal((await addSoilRecordForUser(ALICE, { ...record, labRfuMmPerMeter: record.labRfuMmPerMeter + 10, effectiveFrom: '2026-07-01' }, LATER)).ok, true);
  assert.equal((await addSoilSettingsForUser(ALICE, { ...DEFAULT_SOIL_SETTINGS, threshold: { mode: 'farm', percent: 50 }, effectiveFrom: '2026-06-01' }, NOW)).ok, true);
  const rooting = { referenceCropId: 'criiam-ail', p: 0.3, stages: [{ rank: null, depthM: 0.3, endDepthM: null, progressionDays: null }], source: 'test', note: null, effectiveFrom: '2026-06-01' };
  assert.equal((await addRootingProfileForUser(ALICE, rooting, NOW)).ok, true);
  assert.equal((await addRootingProfileForUser(ALICE, { ...rooting, stages: [{ rank: null, depthM: 1, endDepthM: null, progressionDays: null }] }, LATER)).ok, true);
  assert.equal((await addRootingProfileForUser(ALICE, { ...rooting, stages: [{ rank: null, depthM: 1, endDepthM: null, progressionDays: null }] }, LATER)).ok, true);
  const entries = await journal();
  assert.deepEqual(entries.map((entry) => [entry.subject, entry.action]), [
    ['sol-de-parcelle', 'cree'],
    ['sol-de-parcelle', 'modifie'],
    ['reglages-du-sol', 'modifie'],
    ['profil-racinaire', 'modifie'],
    ['profil-racinaire', 'modifie'],
  ]);
  assert.deepEqual(entries[1].before, { labRfuMmPerMeter: record.labRfuMmPerMeter, effectiveFrom: record.effectiveFrom });
  assert.deepEqual(entries[1].after, { labRfuMmPerMeter: record.labRfuMmPerMeter + 10, effectiveFrom: '2026-07-01' });
  assert.deepEqual(entries[1].context, { zoneId: 'parcelle', plotId: null });
  assert.deepEqual(entries[2].before, { thresholdMode: 'crop', thresholdPercent: null, effectiveFrom: null });
  assert.deepEqual(entries[2].after, { thresholdMode: 'farm', thresholdPercent: 50, effectiveFrom: '2026-06-01' });
  // Le profil de la ferme part du profil commun de la culture ; une profondeur d'un mètre se relit comme écrite.
  assert.equal(entries[3].objectId, 'criiam-ail');
  assert.equal(typeof entries[3].context.name, 'string');
  assert.deepEqual(entries[4].before, { stages: '[[null,0.3,null,null]]' });
  assert.deepEqual(entries[4].after, { stages: '[[null,1,null,null]]' });
});

test('les alertes météo : critère créé, modifié, désactivé, supprimé, à la condition de chaque écriture', async () => {
  const settings = { field: 'precipitation' as const, direction: 'above' as const, threshold: 10, horizonDays: 2, active: true, label: 'Grosse pluie' };
  const criterion = await createWeatherAlertCriterionForUser(ALICE, settings, NOW);
  await updateWeatherAlertCriterionForUser(ALICE, criterion.id, { ...settings, threshold: 15 }, LATER);
  await updateWeatherAlertCriterionForUser(ALICE, criterion.id, { ...settings, threshold: 15, active: false }, LATER);
  await updateWeatherAlertCriterionForUser(ALICE, criterion.id, { ...settings, threshold: 15, active: false }, LATER);
  assert.equal(await updateWeatherAlertCriterionForUser(BOB, criterion.id, settings, LATER), null);
  assert.equal(await deleteWeatherAlertCriterionForUser(ALICE, criterion.id, LATER), true);
  assert.equal(await deleteWeatherAlertCriterionForUser(ALICE, criterion.id, LATER), false);
  const entries = await journal();
  assert.deepEqual(entries.map(summary), [
    { family: 'reglage', subject: 'critere-meteo', action: 'cree', before: null, after: { active: 1, field: 'precipitation', direction: 'above', threshold: 10, horizonDays: 2, label: 'Grosse pluie' } },
    { family: 'reglage', subject: 'critere-meteo', action: 'modifie', before: { threshold: 10 }, after: { threshold: 15 } },
    { family: 'reglage', subject: 'critere-meteo', action: 'modifie', before: { active: 1 }, after: { active: 0 } },
    { family: 'reglage', subject: 'critere-meteo', action: 'supprime', before: { active: 0, field: 'precipitation', direction: 'above', threshold: 15, horizonDays: 2, label: 'Grosse pluie' }, after: null },
  ]);
  assert.ok(entries.every((entry) => entry.objectId === criterion.id && entry.context.label === 'Grosse pluie'));
  assert.deepEqual(crossSpaceReferences(database.sqlite), []);
});

test('les alertes par culture : réglages depuis ceux du contrat, gel et séchage depuis leur révision', async () => {
  assert.equal((await saveCropAlertSettingsForUser(ALICE, { horizonDays: 5, frostActive: false }, NOW)).ok, true);
  assert.equal((await saveCropAlertSettingsForUser(ALICE, { horizonDays: 5 }, NOW)).ok, true);
  assert.equal((await saveFrostLinkForUser(ALICE, { plantId: 'plante-tomate', seriesId: null, commonKey: 'tomate' }, NOW)).ok, true);
  assert.equal((await saveFrostLinkForUser(ALICE, { plantId: 'plante-tomate', seriesId: null, commonKey: 'tomate', damageCelsius: -1 }, LATER)).ok, true);
  assert.equal((await saveDryingDaysForUser(ALICE, { plantId: 'plante-ail', dryingDays: 4 }, NOW)).ok, true);
  assert.equal((await saveDryingDaysForUser(ALICE, { plantId: 'plante-ail', dryingDays: '' }, LATER)).ok, true);
  const entries = await journal();
  assert.deepEqual(entries.map(summary), [
    { family: 'reglage', subject: 'alertes-de-culture', action: 'modifie', before: { frostActive: 1, horizonDays: 3 }, after: { frostActive: 0, horizonDays: 5 } },
    { family: 'reglage', subject: 'seuil-de-gel', action: 'cree', before: null, after: { commonKey: 'tomate', damageCelsius: null } },
    { family: 'reglage', subject: 'seuil-de-gel', action: 'modifie', before: { damageCelsius: null }, after: { damageCelsius: -1 } },
    { family: 'reglage', subject: 'jours-de-sechage', action: 'cree', before: null, after: { dryingDays: 4 } },
    { family: 'reglage', subject: 'jours-de-sechage', action: 'modifie', before: { dryingDays: 4 }, after: { dryingDays: null } },
  ]);
  assert.deepEqual(entries[1].context, { plantId: 'plante-tomate', seriesId: null });
});

test('les fonctionnalités, le message du matin et le rappel du soir : une case par champ, depuis les défauts', async () => {
  // Avant le premier choix, une ferme a les cases d'alors (R6) : « Historique » en est, le calculateur non.
  const enabled = FEATURE_IDS.filter((feature) => feature !== 'historique' && feature !== 'calculateur');
  await saveFeatureSelectionForUser(ALICE, enabled, NOW);
  await saveFeatureSelectionForUser(ALICE, enabled, LATER);
  await saveMorningMessageForUser(ALICE, ALICE, false, NOW.toISOString());
  await saveMorningMessageForUser(ALICE, ALICE, false, LATER.toISOString());
  await saveEveningReminderForUser(ALICE, ALICE, { enabled: true, time: '20:30' }, NOW.toISOString());
  const entries = await journal();
  assert.deepEqual(entries.map(summary), [
    { family: 'reglage', subject: 'fonctionnalites', action: 'modifie', before: { historique: 1 }, after: { historique: 0 } },
    { family: 'reglage', subject: 'message-du-matin', action: 'modifie', before: { enabled: 1 }, after: { enabled: 0 } },
    { family: 'reglage', subject: 'rappel-du-soir', action: 'modifie', before: { time: '19:00' }, after: { time: '20:30' } },
  ]);
});
