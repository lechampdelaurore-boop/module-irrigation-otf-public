import assert from 'node:assert/strict';
import test, { afterEach, beforeEach, mock } from 'node:test';
import { listChangeJournalForUser } from '../../db/change-journal/read';
import { listAdoptionsForBedForUser } from '../../db/crop-water/adoptions';
import { saveSpeciesCorrespondenceForUser } from '../../db/crop-water/entries';
import { listEquipmentForUser } from '../../db/equipment/read';
import { saveEquipmentSettingForUser } from '../../db/equipment/settings';
import { saveFeatureSelectionForUser } from '../../db/feature-selection-repository';
import { finishIrrigationEventForUser } from '../../db/irrigation-event/completion';
import { createIrrigationEventForUser } from '../../db/irrigation-event/create';
import { listIrrigationEventsForUser } from '../../db/irrigation-event/read';
import { startIrrigationEventForUser } from '../../db/irrigation-event/timer';
import { saveHydricGoalForUser, saveManualRainfallForUser, upsertWeatherDailyValuesForUser } from '../../db/water-management-repository';
import type { GapAdoption } from '../../lib/domain/applied-water-gap';
import type { IrrigationSnapshot } from '../../lib/domain/domain';
import type { FeatureId } from '../../lib/domain/features/catalogue';
import { featurePart } from '../../lib/domain/features/socle';
import { withRequirements } from '../../lib/domain/features/selection';
import { weekDateKeys } from '../../lib/domain/water-management';
import { weatherLocationKey } from '../../lib/domain/weather/location';
import { getAppliedWaterGapsForUser } from '../../lib/services/applied-water-gap';
import { adoptAppliedWaterGapForUser } from '../../lib/services/applied-water-gap-adoption';
import { getBedCropWaterSheetForUser } from '../../lib/services/crop-water-bed';
import { cultivation, series, task } from '../support/crop-water-references';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { createDripFixture, FIXTURE_PLOT_ID, FIXTURE_ZONE_ID, plannedDraft, type IrrigationFixture } from '../support/irrigation-fixtures';
import { confirmFarmLocation, validatePlanningSettings } from '../support/onboarding';
import { ALICE, BOB } from '../support/spaces';

/**
 * L'écart prévu/réel expliqué, par le service (amélioration n° 5,
 * docs/ameliorations-4-5-contract.md, section 4, F733 à F735, D-291) : la
 * lecture des trois semaines dans la base — irrigations prévues, démarrées
 * et terminées au minuteur, réglages d'aujourd'hui, pluie, objectif et sa
 * proposition — et la vérification avant d'adopter. La règle elle-même se
 * prouve dans tests/ecart-prevu-reel.test.ts.
 */

const SEASON = 2026;
const BED = 'bed-1';
const HOUR_MS = 3_600_000;
/** La ferme s'équipe et pose son objectif le lundi 20 avril, avant la période. */
const SETUP = Date.parse('2026-04-20T06:00:00.000Z');
/** Un arrosage prévu chaque mardi des trois semaines comparées, à 8 h à la ferme, d'une heure à 6 mm/h. */
const TUESDAYS = ['2026-04-28T06:00:00.000Z', '2026-05-05T06:00:00.000Z', '2026-05-12T06:00:00.000Z'];
/** Le mercredi 20 mai, 10 h à la ferme : la semaine en cours commence le lundi 18. */
const NOW = new Date('2026-05-20T08:00:00.000Z');
const WEEK = '2026-05-18';
const OBJECTIVE_MM = 25;

const tomatoSeries = series('tomate', [cultivation('tomate-c', 'plant-tomate', 'Tomate', { expected: ['2026-W27', '2026-W40'] })]);
const snapshot: IrrigationSnapshot = {
  configuration: { seasonFirst: 2025, seasonLast: 2027 },
  structure: { id: '17', name: 'Ferme', legalCity: 'Rennes', legalPostcode: '35000', legalCountry: 'FR' },
  zones: [{ id: FIXTURE_ZONE_ID, name: 'Les Prés', area: null, seasons: [SEASON] }],
  plots: [{ id: FIXTURE_PLOT_ID, zoneId: FIXTURE_ZONE_ID, name: 'Jardin Nord', mode: 'garden', length: 10, width: 8, area: 80, seasons: [SEASON] }],
  beds: [{ id: BED, zoneId: FIXTURE_ZONE_ID, plotId: FIXTURE_PLOT_ID, name: 'N01', length: 10, width: 0.8, alleyWidth: 0.4, area: 8, seasons: [SEASON] }],
  cropPlan: {
    series: [tomatoSeries],
    places: [{ id: 'place-tomate', seriesId: 'tomate', bedId: BED, lengthMeters: null }],
    implantationTasks: [task('tomate', 'planting', '2026-W17')],
    readSummary: { seriesRead: 1, placesRead: 1, tasksRead: 1, tasksRetained: 1, placesWithoutSeries: 0, placesOfUnknownSeries: 0, placesWithUnknownBed: 0 },
  },
  source: 'cache',
  lastSuccessfulReadAt: '2026-05-20T00:00:00.000Z',
};

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
  mock.timers.enable({ apis: ['Date'], now: SETUP });
});
afterEach(() => {
  mock.timers.reset();
  database.dispose();
});

/** La ferme : son goutte-à-goutte à 6 mm/h sur N01, ses cases, sa commune, son objectif de 25 mm, la tomate de N01. */
async function prepareFarm(owner: string, features: FeatureId[] = ['planning', 'cultures', 'besoins']): Promise<IrrigationFixture> {
  mock.timers.setTime(SETUP);
  const fixture = await createDripFixture(owner, { rateMmPerHour: 6, beds: [BED], bedAreaSquareMeters: 8, placedAt: new Date(SETUP).toISOString() });
  await saveFeatureSelectionForUser(owner, withRequirements(features), new Date());
  await confirmFarmLocation(owner, snapshot.structure);
  await validatePlanningSettings(owner);
  await saveHydricGoalForUser(owner, { season: SEASON, weekStart: '2026-04-20', scopeType: 'bed', otfZoneId: FIXTURE_ZONE_ID, otfPlotId: FIXTURE_PLOT_ID, otfBedId: BED, amountMm: OBJECTIVE_MM });
  await saveSpeciesCorrespondenceForUser(owner, { plantId: 'plant-tomate', seriesId: null, target: { kind: 'reference', referenceCropId: 'criiam-tomate', analogy: false } });
  return fixture;
}

/** Un arrosage d'une heure prévu la veille, démarré à l'heure au minuteur, terminé `minutes` plus tard. */
async function irrigate(fixture: IrrigationFixture, startAt: string, minutes: number): Promise<void> {
  const start = Date.parse(startAt);
  mock.timers.setTime(start - 24 * HOUR_MS);
  const created = await createIrrigationEventForUser(fixture.ownerUserId, plannedDraft(fixture, {
    startAt, endAt: new Date(start + HOUR_MS).toISOString(), durationSeconds: HOUR_MS / 1000,
  }));
  mock.timers.setTime(start);
  await startIrrigationEventForUser(fixture.ownerUserId, created.eventEquipmentId);
  mock.timers.setTime(start + minutes * 60_000);
  await finishIrrigationEventForUser(fixture.ownerUserId, created.eventEquipmentId, null);
}

const read = (owner: string, enabled?: FeatureId[]) => getAppliedWaterGapsForUser({ ownerUserId: owner, season: SEASON, snapshot, now: NOW, ...(enabled ? { enabled } : {}) });
const adopt = (owner: string, adoption: GapAdoption, weekStart = WEEK) => adoptAppliedWaterGapForUser({ ownerUserId: owner, season: SEASON, snapshot, weekStart, adoption, now: NOW });

function planEvents(): string[] {
  return database.sqlite.prepare('SELECT kind FROM irrigation_plan_events ORDER BY occurred_at, rowid').all().map((row) => String(row.kind));
}

/** Les lignes du journal des modifications d'un sujet, de la plus ancienne à la plus récente : l'action, l'avant et l'après. */
async function journalOf(owner: string, subject: string) {
  return (await listChangeJournalForUser(owner, { limit: 200 })).reverse()
    .filter((entry) => entry.subject === subject)
    .map((entry) => ({ action: entry.action, before: entry.before, after: entry.after, context: entry.context }));
}

async function rateOf(owner: string, settingId: string): Promise<number | null> {
  const setting = (await listEquipmentForUser(owner)).flatMap((item) => item.settings).find((item) => item.id === settingId);
  return setting?.kind === 'drip' ? setting.rateMmPerHour : null;
}

test('la lecture des trois semaines : arrosages terminés au minuteur, réglage d’aujourd’hui, pluie mesurée et réanalyse ; l’autre ferme ne voit rien', async () => {
  const fixture = await prepareFarm(ALICE);
  await prepareFarm(BOB);
  for (const tuesday of TUESDAYS) await irrigate(fixture, tuesday, 90);
  // La réanalyse a compté 12 mm les 4 et 5 mai ; le pluviomètre en a mesuré 2 : le plan a cru le sol mieux arrosé.
  const location = weatherLocationKey({ locationMode: 'otf', customCity: null, customPostcode: null, locationConfirmed: true }, snapshot.structure);
  assert.ok(location);
  await upsertWeatherDailyValuesForUser(ALICE, location, 'reanalysis', [
    { date: '2026-05-04', precipitationMm: 6, et0Mm: 3 },
    { date: '2026-05-05', precipitationMm: 6, et0Mm: 3 },
    { date: '2026-05-06', precipitationMm: 4, et0Mm: 3 },
  ], 'test', '2026-05-07T04:00:00.000Z');
  await saveManualRainfallForUser(ALICE, '2026-05-04', 1);
  await saveManualRainfallForUser(ALICE, '2026-05-05', 1);
  mock.timers.setTime(NOW.getTime());

  const view = await read(ALICE);
  assert.equal(view.weekStart, WEEK);
  assert.deepEqual(view.weeks.map((week) => week.weekStart), ['2026-04-27', '2026-05-04', '2026-05-11']);
  assert.equal(view.objectiveCauseNotice, null);
  assert.equal(view.gaps.length, 1);
  const [gap] = view.gaps;
  assert.deepEqual([gap.bedId, gap.bedName, gap.plotName, gap.direction, gap.doneIrrigations], [BED, 'N01', 'Jardin Nord', 'more', 3]);
  assert.deepEqual(gap.weeks.map((week) => [week.plannedMm, week.appliedMm, week.gapPercent]), [[6, 9, 50], [6, 9, 50], [6, 9, 50]]);
  assert.deepEqual(gap.causes, [
    {
      kind: 'flow', equipmentId: fixture.equipment.id, equipmentName: 'Goutte-à-goutte', settingId: fixture.setting.id, settingName: 'Réglage 1',
      irrigations: 3, durationRatio: 1 / 1.5, current: { kind: 'drip', rateMmPerHour: 6 }, proposed: { kind: 'drip', rateMmPerHour: 4 },
    },
    // Les deux jours mesurés : 2 mm contre 12 de réanalyse ; le 6 mai, sans mesure, le plan a compté la réanalyse.
    { kind: 'rain', measuredMm: 2, reanalysisMm: 12, measuredDays: 2, daysWithoutMeasure: 1 },
  ]);

  assert.deepEqual((await read(BOB)).gaps, [], 'la ferme B ne lit ni les arrosages ni la pluie de A');
  assert.deepEqual((await read(ALICE, ['arrosages', 'materiel'])).gaps, [], 'sans « Planning de la semaine », pas d’eau prévue ni de bloc');
});

test('« Adopter » le débit : le réglage change sous son nom, provenance « saisi » ; les arrosages passés gardent leur copie ; le plan se recalcule ; le bloc disparaît', async () => {
  const fixture = await prepareFarm(ALICE);
  for (const tuesday of TUESDAYS) await irrigate(fixture, tuesday, 90);
  mock.timers.setTime(NOW.getTime());
  const before = planEvents().length;

  const result = await adopt(ALICE, { kind: 'flow', bedId: BED, settingId: fixture.setting.id, proposed: { kind: 'drip', rateMmPerHour: 4 } });
  assert.equal(result.adopted, true);
  assert.equal(result.message, 'Le réglage « Réglage 1 » de Goutte-à-goutte est enregistré : 4 mm/h. Les irrigations passées gardent l’ancien débit ; le plan se recalcule.');
  assert.equal(await rateOf(ALICE, fixture.setting.id), 4);
  const setting = (await listEquipmentForUser(ALICE)).flatMap((item) => item.settings).find((item) => item.id === fixture.setting.id);
  assert.equal(setting?.name, 'Réglage 1', 'le réglage garde son nom');
  const provenance = database.sqlite.prepare('SELECT COUNT(*) AS count FROM irrigation_equipment_setting_calculations WHERE setting_id = ?').get(fixture.setting.id);
  assert.equal(Number(provenance?.count), 0, 'aucune provenance : le débit est « saisi »');
  const past = await listIrrigationEventsForUser(ALICE);
  assert.equal(past.length, 3);
  for (const event of past) {
    assert.deepEqual([event.equipment.settingSnapshot.kind === 'drip' && event.equipment.settingSnapshot.rateMmPerHour, event.equipment.applications[0].actualAmountMm], [6, 9], 'l’historique reste immuable (D-006)');
  }
  assert.deepEqual(planEvents().slice(before), ['equipment-setting-changed'], 'le plan se recalcule, comme après un réglage appliqué changé');
  assert.deepEqual(result.gaps, [], 'les semaines faites avec l’ancien débit ne se jugent plus (F741)');
  // Le journal des modifications (n° 7) garde le geste comme un réglage changé à la main : le débit seul, de 6 à 4 mm/h.
  assert.deepEqual((await journalOf(ALICE, 'reglage-de-materiel')).slice(-1), [{
    action: 'modifie', before: { rateMmPerHour: 6 }, after: { rateMmPerHour: 4 }, context: { equipment: 'Goutte-à-goutte', name: 'Réglage 1' },
  }]);
});

test('la vérification avant d’adopter : semaine changée, proposition différente, réglage retouché depuis, autre ferme ; rien n’est écrit', async () => {
  const fixture = await prepareFarm(ALICE);
  await prepareFarm(BOB);
  for (const tuesday of TUESDAYS) await irrigate(fixture, tuesday, 90);
  mock.timers.setTime(NOW.getTime());
  const flow: GapAdoption = { kind: 'flow', bedId: BED, settingId: fixture.setting.id, proposed: { kind: 'drip', rateMmPerHour: 4 } };
  const stale = 'Cette proposition ne tient plus : rien n’a été changé. Voici l’écart à jour.';

  await assert.rejects(adopt(ALICE, flow, '2026-05-11'), /La semaine a changé/);
  const other = await adopt(ALICE, { ...flow, proposed: { kind: 'drip', rateMmPerHour: 4.5 } });
  assert.deepEqual([other.adopted, other.message, other.gaps.length], [false, stale, 1], 'l’écart à jour, toujours là');
  const fromB = await adopt(BOB, flow);
  assert.deepEqual([fromB.adopted, fromB.message, fromB.gaps.length], [false, stale, 0], 'la ferme B ne voit pas l’écart de A');
  assert.equal(await rateOf(ALICE, fixture.setting.id), 6, 'rien n’a été écrit');
  const settingLines = (await journalOf(ALICE, 'reglage-de-materiel')).length;

  // Le réglage retouché à la main depuis l'affichage : la proposition ne tient plus.
  await saveEquipmentSettingForUser(ALICE, fixture.equipment.id, fixture.setting.id, { name: 'Réglage 1', kind: 'drip', rateMmPerHour: 5 });
  const retouched = await adopt(ALICE, flow);
  assert.deepEqual([retouched.adopted, retouched.message, retouched.gaps.length], [false, stale, 0]);
  assert.equal(await rateOf(ALICE, fixture.setting.id), 5, 'le geste à la main reste');
  assert.equal(planEvents().length, 0, 'aucun recalcul sans écriture');
  // Au journal, le seul geste à la main : une proposition refusée n'écrit aucune ligne.
  assert.deepEqual((await journalOf(ALICE, 'reglage-de-materiel')).slice(settingLines).map((line) => [line.before, line.after]), [[{ rateMmPerHour: 6 }, { rateMmPerHour: 5 }]]);
});

test('moins d’eau que prévu : l’objectif plus haut que le besoin de la culture, adopté par le geste de la 5 quater ; sans « Besoin par culture », la cause ne se cherche pas', async () => {
  const fixture = await prepareFarm(ALICE);
  // Arrêtés en route à 42 minutes : 4,2 mm apportés pour 6 prévus, −30 % chaque semaine.
  for (const tuesday of TUESDAYS) await irrigate(fixture, tuesday, 42);
  const location = weatherLocationKey({ locationMode: 'otf', customCity: null, customPostcode: null, locationConfirmed: true }, snapshot.structure);
  assert.ok(location);
  await upsertWeatherDailyValuesForUser(ALICE, location, 'forecast', weekDateKeys(WEEK).map((date) => ({ date, precipitationMm: 0, et0Mm: 2 })), 'test', '2026-05-18T04:00:00.000Z');
  mock.timers.setTime(NOW.getTime());

  const sheet = await getBedCropWaterSheetForUser({ ownerUserId: ALICE, season: SEASON, snapshot, bedId: BED, weekStart: WEEK, now: NOW });
  assert.ok(sheet.available && sheet.bed.week.adoptable && sheet.bed.week.proposedMm !== null);
  const proposedMm = Math.round(sheet.bed.week.proposedMm * 10) / 10;
  assert.ok(proposedMm < OBJECTIVE_MM * 0.8, `la proposition de la semaine (${proposedMm} mm) est plus basse de plus de 20 %`);

  const view = await read(ALICE);
  assert.equal(view.gaps.length, 1);
  assert.deepEqual(view.gaps[0].weeks.map((week) => [week.plannedMm, week.appliedMm, week.gapPercent]), [[6, 4.2, -30], [6, 4.2, -30], [6, 4.2, -30]]);
  assert.deepEqual(view.gaps[0].causes, [{ kind: 'objective', objectiveMm: OBJECTIVE_MM, proposedMm }]);

  const without = await read(ALICE, withRequirements(['planning', 'besoins']));
  assert.deepEqual(without.gaps[0].causes, [], 'sans « Besoin par culture » : cause non déterminée');
  assert.equal(without.objectiveCauseNotice, featurePart('gap-objective-cause').missingNotice, 'une ligne le dit (P1)');

  const stale = await adopt(ALICE, { kind: 'objective', bedId: BED, proposedMm: proposedMm + 1 });
  assert.equal(stale.adopted, false);
  assert.deepEqual(await listAdoptionsForBedForUser(ALICE, SEASON, BED), [], 'une autre valeur que celle recalculée : rien n’est écrit');
  assert.deepEqual(await journalOf(ALICE, 'objectif-adopte'), [], 'ni au journal des modifications');

  const result = await adopt(ALICE, { kind: 'objective', bedId: BED, proposedMm });
  assert.equal(result.adopted, true);
  assert.equal(result.message, `L’objectif proposé est adopté : ${String(proposedMm).replace('.', ',')} mm par semaine deviennent l’objectif de N01 à partir d’aujourd’hui ; le plan se recalcule.`);
  assert.deepEqual((await listAdoptionsForBedForUser(ALICE, SEASON, BED)).map((adoption) => [adoption.weekStart, adoption.amountMm]), [[WEEK, proposedMm]], 'origine « proposition adoptée »');
  assert.deepEqual(planEvents(), ['objective-changed'], 'le plan se recalcule comme après tout objectif enregistré');
  assert.deepEqual((await journalOf(ALICE, 'objectif-adopte')).map((line) => [line.action, line.before?.amountMm ?? null, line.after?.amountMm]), [['cree', null, proposedMm]], 'au journal, sous « Objectif proposé adopté »');
  assert.deepEqual(result.gaps, [], 'l’objectif abaissé cette semaine : la planche se juge sur les semaines qui suivent (F741)');
});
