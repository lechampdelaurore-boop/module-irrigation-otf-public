import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { automaticWeatherRepository } from '../../db/automatic-weather-repository';
import { saveSpeciesCorrespondenceForUser } from '../../db/crop-water/entries';
import { listForecastArchive } from '../../db/forecast-archive-repository';
import { listOffSeasonRevisionsForUser, saveOffSeasonForUser } from '../../db/off-season-repository';
import { savePlanCalculationForUser } from '../../db/planning-repository';
import { addSoilObservationForUser, addSoilRecordForUser } from '../../db/soil-reserve/entries';
import {
  saveHydricGoalForUser,
  saveManualRainfallForUser,
  saveWeatherGeocodeForUser,
  saveWeatherPreferenceForUser,
  upsertWeatherDailyValuesForUser,
} from '../../db/water-management-repository';
import { createWeatherAlertCriterionForUser } from '../../db/weather-alert-repository';
import { ensureWorkspaceForUser, findWorkspaceIdForUser } from '../../db/workspace-repository';
import type { IrrigationSnapshot } from '../../lib/domain/domain';
import type { HistoryPeriodSelection, HistoryScopeInput, IrrigationHistorySummary } from '../../lib/domain/irrigation-history/contract';
import type { OffSeasonScope } from '../../lib/domain/off-season';
import type { WeeklyPlan } from '../../lib/domain/planning/contract';
import { DEFAULT_PLANNING_SETTINGS } from '../../lib/domain/planning/settings';
import { soilGardenBarRows } from '../../lib/domain/soil-reserve/garden-bars';
import type { SoilRecord } from '../../lib/domain/soil-reserve/soil';
import { addDaysToDateKey } from '../../lib/domain/water-management';
import { customWeatherLocationKey, weatherLocationKey } from '../../lib/domain/weather/location';
import type { WeatherAlertCriterionSettings } from '../../lib/domain/weather/weather-alerts';
import type { WeatherDailyValue, WeatherProvider, WeatherReadInput } from '../../lib/domain/weather/weather-provider';
import { getIrrigationHistoryDashboardForUser } from '../../lib/services/irrigation-history-service';
import { getIrrigationNeedsDashboardForUser } from '../../lib/services/irrigation-needs-service';
import { getSoilReserveViewForUser, soilReserveDaysForUser, type SoilReserveView } from '../../lib/services/soil-reserve-view';
import { getWaterDashboardForUser, type WaterDashboard } from '../../lib/services/water-dashboard';
import { runAutomaticWeatherSync } from '../../lib/services/weather/automatic-sync';
import { evaluateWeatherAlertsAfterForecastWrite } from '../../lib/services/weather-alerts-service';
import { readWeatherAlertsView } from '../../lib/services/weather-alerts-view';
import { cultivation, series, task } from '../support/crop-water-references';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { confirmFarmLocation } from '../support/onboarding';
import { FARM_SOIL } from '../support/soil-reserve-fixtures';
import { ALICE, BOB } from '../support/spaces';

/**
 * La garde de la pluie, PR B2, sur la base
 * (docs/objectif-automatique-saison-contract.md, sections 4.2 et 8 ; D-337,
 * D-352) : deux fermes pareilles, l'une avec toutes ses portées « hors
 * saison » (tout le plein champ, tout le sous-abri, la parcelle, le jardin
 * dehors, la planche sous abri), l'autre sans. La pluie du pluviomètre
 * (`0 mm` compris), la pluie estimée, la pluie prévue, la réserve du sol
 * (valeur et graphique), l'historique de la pluie par jour, par semaine et
 * par planche, l'archive des prévisions et les alertes météo donnent les
 * mêmes valeurs. Contre-épreuve : les besoins, eux, changent ; une semaine
 * close avant la pause garde tout, objectif compris.
 *
 * La semaine du lundi 11 au dimanche 17 mai 2026, vue le mercredi 13 à 10 h à
 * la ferme ; les portées sont mises hors saison le lundi 4 mai à 8 h.
 */

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

const NOW = new Date('2026-05-13T08:00:00.000Z');
const WEEK_START = '2026-05-11';
/** Le lundi 4 mai à 8 h à la ferme : la semaine du 4 est entière hors saison, celle du 27 avril est close avant. */
const PUT_AT = new Date('2026-05-04T06:00:00.000Z');
const FIELD = 'jardin-dehors';
const SHELTER = 'jardin-serre';
/** Une tomate dehors, une planche dehors sans culture, une tomate sous abri. */
const BED_A = 'planche-a';
const BED_B = 'planche-b';
const BED_S = 'planche-s';
const ALL_SCOPES: readonly OffSeasonScope[] = [
  { level: 'mode', mode: 'garden' },
  { level: 'mode', mode: 'greenhouse' },
  { level: 'zone', zoneId: 'parcelle' },
  { level: 'plot', plotId: FIELD },
  { level: 'bed', bedId: BED_S },
];

const tomatoSeries = series('tomate', [cultivation('tomate-c', 'plant-tomate', 'Tomate', { expected: ['2026-W27', '2026-W40'] })]);
const bed = (id: string, plotId: string, name: string) => ({ id, zoneId: 'parcelle', plotId, name, length: 10, width: 0.8, alleyWidth: 0.4, area: 8, seasons: [2026] });
const plot = (id: string, name: string, mode: 'garden' | 'greenhouse') => ({ id, zoneId: 'parcelle', name, mode, length: 10, width: 8, area: 80, seasons: [2025, 2026] });

const snapshot: IrrigationSnapshot = {
  configuration: { seasonFirst: 2025, seasonLast: 2027 },
  structure: { id: '17', name: 'Ferme', legalCity: 'Rennes', legalPostcode: '35000', legalCountry: 'FR' },
  zones: [{ id: 'parcelle', name: 'Parcelle', area: null, seasons: [2025, 2026] }],
  plots: [plot(FIELD, 'Dehors', 'garden'), plot(SHELTER, 'Serre', 'greenhouse')],
  beds: [bed(BED_A, FIELD, 'A'), bed(BED_B, FIELD, 'B'), bed(BED_S, SHELTER, 'S')],
  cropPlan: {
    series: [tomatoSeries],
    places: [
      { id: 'place-a', seriesId: 'tomate', bedId: BED_A, lengthMeters: null },
      { id: 'place-s', seriesId: 'tomate', bedId: BED_S, lengthMeters: null },
    ],
    implantationTasks: [task('tomate', 'planting', '2026-W17')],
    readSummary: { seriesRead: 1, placesRead: 2, tasksRead: 1, tasksRetained: 1, placesWithoutSeries: 0, placesOfUnknownSeries: 0, placesWithUnknownBed: 0 },
  },
  source: 'cache',
  lastSuccessfulReadAt: '2026-05-13T00:00:00.000Z',
};

const location = weatherLocationKey({ locationMode: 'otf', customCity: null, customPostcode: null, locationConfirmed: true }, snapshot.structure)!;
const dates = (from: string, to: string) => {
  const keys: string[] = [];
  for (let date = from; date <= to; date = addDaysToDateKey(date, 1)) keys.push(date);
  return keys;
};
/** La pluie estimée : 4 mm un jour sur trois, du 1er avril au mardi 12 mai (4 mm ce mardi-là). */
const REANALYSIS: WeatherDailyValue[] = dates('2026-04-01', '2026-05-12').map((date, index) => ({ date, precipitationMm: index % 3 === 2 ? 4 : 0, et0Mm: 3.5 }));
/** La pluie prévue : 6 mm le jeudi 14, rien les autres jours ; 2 °C au matin du vendredi 15. */
const FORECAST: WeatherDailyValue[] = dates('2026-05-11', '2026-05-20').map((date) => ({
  date, precipitationMm: date === '2026-05-14' ? 6 : 0, et0Mm: 4.5, minimumTemperatureCelsius: date === '2026-05-15' ? 2 : 9, maximumTemperatureCelsius: 19,
}));
/** Le sol de la ferme du porteur tel qu'il se saisit : l'heure d'enregistrement vient de la base. */
const SOIL_ENTRY = Object.fromEntries(Object.entries({ ...FARM_SOIL, zoneId: 'parcelle', plotId: null }).filter(([key]) => key !== 'recordedAt')) as Omit<SoilRecord, 'recordedAt'>;

/** La même ferme pour chacun : culture, commune, météo, pluviomètre, sol, curseurs, 20 mm d'objectif depuis le 27 avril. */
async function farm(owner: string): Promise<void> {
  await saveSpeciesCorrespondenceForUser(owner, { plantId: 'plant-tomate', seriesId: null, target: { kind: 'reference', referenceCropId: 'criiam-tomate', analogy: false } });
  await confirmFarmLocation(owner, snapshot.structure);
  await upsertWeatherDailyValuesForUser(owner, location, 'reanalysis', REANALYSIS, 'test', '2026-05-13T04:00:00.000Z');
  await upsertWeatherDailyValuesForUser(owner, location, 'forecast', FORECAST, 'test', '2026-05-13T04:00:00.000Z');
  await saveManualRainfallForUser(owner, '2026-05-05', 7);
  // Le lundi 11, 12 mm au pluviomètre (cas 3) ; le mardi 12, 0 mm, qui prime sur les 4 mm estimés.
  await saveManualRainfallForUser(owner, '2026-05-11', 12);
  await saveManualRainfallForUser(owner, '2026-05-12', 0);
  assert.equal((await addSoilRecordForUser(owner, SOIL_ENTRY, NOW)).ok, true);
  // Les curseurs à 70 %, posés le lundi 4 mai à 7 h : la jauge suit la pluie depuis ce jour-là.
  const observedAt = '2026-05-04T05:00:00.000Z';
  const recordedAt = new Date('2026-05-04T05:30:00.000Z');
  assert.equal((await addSoilObservationForUser(owner, { zoneId: 'parcelle', plotId: null, percent: 70, observedAt }, recordedAt)).ok, true);
  assert.equal((await addSoilObservationForUser(owner, { zoneId: 'parcelle', plotId: SHELTER, percent: 70, observedAt }, recordedAt)).ok, true);
  await saveHydricGoalForUser(owner, { season: 2026, weekStart: '2026-04-27', scopeType: 'farm', otfZoneId: null, otfPlotId: null, otfBedId: null, amountMm: 20 });
  // La base date l'objectif à l'heure réelle ; posé ici le lundi 27 avril à 8 h, il compte dès sa semaine (D-039).
  database.sqlite.prepare('UPDATE irrigation_hydric_goal_revisions SET created_at = ? WHERE workspace_id = ?')
    .run('2026-04-27T06:00:00.000Z', await findWorkspaceIdForUser(owner));
}

async function putEverythingOffSeason(owner: string): Promise<void> {
  for (const scope of ALL_SCOPES) assert.equal(await saveOffSeasonForUser(owner, scope, true, PUT_AT), true);
}

/** Les deux fermes ; celle d'Alice a toutes ses portées hors saison depuis le lundi 4 mai. */
async function twoFarms(): Promise<void> {
  await farm(ALICE);
  await farm(BOB);
  await putEverythingOffSeason(ALICE);
  assert.equal((await listOffSeasonRevisionsForUser(ALICE)).length, ALL_SCOPES.length);
  assert.deepEqual(await listOffSeasonRevisionsForUser(BOB), []);
}

const water = (owner: string, weekStart = WEEK_START) => getWaterDashboardForUser({
  ownerUserId: owner, season: 2026, weekStart, snapshot, now: NOW, allowWeatherRefresh: false, includeWeatherAlerts: true,
});
/** La pluie et l'ET0 de la page de la météo, jour par jour et en total ; les objectifs et les alertes ont leurs identifiants de ferme. */
const rainOfWater = (dashboard: WaterDashboard) => ({ days: dashboard.days, todayWater: dashboard.todayWater, totals: dashboard.totals, locationKey: dashboard.weather.locationKey });

const FARM: HistoryScopeInput = { level: 'farm' };
const inPlot = (plotId: string): HistoryScopeInput => ({ level: 'plot', zoneId: 'parcelle', plotId });
const onBed = (bedId: string): HistoryScopeInput => ({ level: 'bed', zoneId: 'parcelle', plotId: bedId === BED_S ? SHELTER : FIELD, bedId });
const summary = async (owner: string, period: HistoryPeriodSelection, scope = FARM) =>
  (await getIrrigationHistoryDashboardForUser({ ownerUserId: owner, season: 2026, snapshot, selection: { period, scope }, now: NOW })).summary;
const RAIN_FIELDS = [
  'actualRainMm', 'actualRainAvailability', 'et0Mm', 'et0Availability',
  'irrigationCubicMeters', 'irrigationVolumeIncomplete', 'irrigationMm', 'irrigatedAreaSquareMeters', 'scopeAreaSquareMeters',
] as const satisfies readonly (keyof IrrigationHistorySummary)[];
const rainOf = (history: IrrigationHistorySummary) => Object.fromEntries(RAIN_FIELDS.map((field) => [field, history[field]]));
const day = (date: string): HistoryPeriodSelection => ({ mode: 'custom', customStartDate: date, customEndDate: date });
const week = (anchorDate: string): HistoryPeriodSelection => ({ mode: 'week', anchorDate });

const soil = (owner: string) => getSoilReserveViewForUser({ ownerUserId: owner, season: 2026, snapshot, now: NOW });
/** La jauge de chaque planche, le graphique de chaque jardin, l'eau perdue en drainage, les notes des propositions. */
const soilOf = (view: SoilReserveView) => ({
  gauge: view.gauge,
  gaugeUnavailable: view.gaugeUnavailable,
  bars: view.gauge?.zones.map(soilGardenBarRows),
  waterSurplus: view.waterSurplus,
  notes: Object.values(view.proposalSoilNotes),
});
const recordedSoilDays = async (owner: string) => {
  const days = await soilReserveDaysForUser({ ownerUserId: owner, season: 2026, snapshot, now: NOW });
  return days && { today: days.today, daysByBed: Object.fromEntries(days.daysByBed) };
};

test('la page de la météo : le pluviomètre, 0 mm compris, la pluie estimée, la pluie prévue et l’ET0 sont les mêmes, filtre actif ou non', async () => {
  await farm(ALICE);
  await farm(BOB);
  const before = { current: await water(ALICE), past: await water(ALICE, '2026-05-04') };
  await putEverythingOffSeason(ALICE);

  for (const weekStart of ['2026-04-27', '2026-05-04', WEEK_START]) {
    assert.deepEqual(rainOfWater(await water(ALICE, weekStart)), rainOfWater(await water(BOB, weekStart)), `la semaine du ${weekStart}`);
  }
  const current = await water(ALICE);
  assert.deepEqual(current, before.current, 'chez Alice, toute la page, objectifs et alertes compris, est celle d’avant la pause');
  assert.deepEqual(await water(ALICE, '2026-05-04'), before.past);

  const byDate = new Map(current.days.map((item) => [item.date, item]));
  assert.deepEqual(
    ['2026-05-11', '2026-05-12', '2026-05-14'].map((date) => {
      const { manualRainMm, reanalysisRainMm, effectiveActualRainMm, forecastRainMm } = byDate.get(date)!;
      return [date, manualRainMm, reanalysisRainMm, effectiveActualRainMm, forecastRainMm];
    }),
    [['2026-05-11', 12, 0, 12, 0], ['2026-05-12', 0, 4, 0, 0], ['2026-05-14', null, null, null, 6]],
    'les valeurs comparées sont bien là : 12 mm lundi, 0 mm qui prime mardi, 6 mm prévus jeudi',
  );
  assert.equal(current.totals.actualRainMm, 12);
  assert.equal(current.totals.remainingForecastRainMm, 6);
});

test('l’historique de la pluie : chaque jour, chaque semaine, la saison, la ferme, le jardin dehors, chaque planche, filtre actif ou non', async () => {
  await twoFarms();
  for (const date of dates('2026-04-27', '2026-05-13')) {
    assert.deepEqual(rainOf(await summary(ALICE, day(date))), rainOf(await summary(BOB, day(date))), `le ${date}`);
  }
  const scopes = [FARM, { level: 'zone', zoneId: 'parcelle' } as const, inPlot(FIELD), inPlot(SHELTER), onBed(BED_A), onBed(BED_B), onBed(BED_S)];
  for (const period of [week('2026-04-27'), week('2026-05-04'), week(WEEK_START), { mode: 'season' } as const]) {
    for (const scope of scopes) {
      assert.deepEqual(rainOf(await summary(ALICE, period, scope)), rainOf(await summary(BOB, period, scope)), `${JSON.stringify(period)} sur ${JSON.stringify(scope)}`);
    }
  }

  assert.equal((await summary(ALICE, day('2026-05-11'), onBed(BED_A))).actualRainMm, 12, 'les 12 mm du pluviomètre restent sur la planche dehors');
  assert.equal((await summary(ALICE, day('2026-05-12'), onBed(BED_A))).actualRainMm, 0, 'le 0 mm du mardi prime sur les 4 mm estimés');
  assert.equal((await summary(ALICE, day('2026-05-11'), onBed(BED_S))).actualRainMm, 0, 'sous abri, la pluie vaut 0, comme avant');
  assert.equal((await summary(ALICE, week('2026-05-04'), inPlot(FIELD))).actualRainMm, 7 + 4 + 4, 'le 5 au pluviomètre, le 6 et le 9 estimés');
  assert.equal((await summary(ALICE, week('2026-05-04'))).actualRainMm, 10, 'sur la ferme, la serre compte 0 : 15 mm sur deux tiers de la surface');
});

test('une semaine close avant la pause garde tout, objectif compris ; la semaine d’après perd l’objectif, pas la pluie (contre-épreuve)', async () => {
  await twoFarms();
  const closed = week('2026-04-27');
  assert.deepEqual(await summary(ALICE, closed), await summary(BOB, closed), 'la semaine du 27 avril, mot pour mot');
  assert.equal((await summary(ALICE, closed)).objectiveMm, 20);

  const paused = await summary(ALICE, week('2026-05-04'));
  const running = await summary(BOB, week('2026-05-04'));
  assert.equal(running.objectiveMm, 20);
  assert.equal(paused.objectiveMm, null, 'hors saison toute la semaine : aucun objectif');
  assert.deepEqual(paused.objectiveBeds, { withObjective: 0, total: 3, bedDays: 0, offSeason: 3 });
  assert.equal(paused.gapToObjectiveMm, null);
  assert.deepEqual(rainOf(paused), rainOf(running), 'la pluie, elle, est la même');
  assert.equal(paused.irrigationAndRainMm, running.irrigationAndRainMm, 'aucune planche n’a d’objectif : l’eau reçue est celle du périmètre, comme chez Bob');
});

test('la réserve du sol : la jauge, le graphique, le drainage et les jours enregistrés sont les mêmes, filtre actif ou non', async () => {
  await twoFarms();
  assert.deepEqual(soilOf(await soil(ALICE)), soilOf(await soil(BOB)));
  assert.deepEqual(await recordedSoilDays(ALICE), await recordedSoilDays(BOB), 'les jours que la tâche du matin enregistre');

  const view = await soil(ALICE);
  const beds = new Map(view.gauge!.zones.flatMap((zone) => zone.plots).flatMap((item) => item.beds).map((item) => [item.bedId, item]));
  assert.ok(beds.get(BED_A)!.summary.current, 'la jauge de la tomate dehors est connue');
  assert.ok(beds.get(BED_S)!.summary.current, 'celle de la tomate sous abri aussi');
  const recorded = (await recordedSoilDays(ALICE))!.daysByBed;
  const outside = new Map(recorded[BED_A].map((item) => [item.date, item]));
  assert.deepEqual(
    ['2026-05-10', '2026-05-11', '2026-05-12', '2026-05-14'].map((date) => [date, outside.get(date)?.rainNature]),
    [['2026-05-10', 'reanalysis'], ['2026-05-11', 'gauge'], ['2026-05-12', 'gauge'], ['2026-05-14', 'forecast']],
    'la jauge dehors lit la pluie estimée, le pluviomètre et la pluie prévue',
  );
  assert.equal(outside.get('2026-05-12')?.rainMm, 0);
  assert.ok((outside.get('2026-05-11')?.rainMm ?? 0) > 0, 'les 12 mm du lundi entrent dans le sol');
});

/** Un plan de la semaine à une proposition : 30 mm sur la planche A, ce mercredi à 14 h. */
function planWithProposal(): WeeklyPlan {
  return {
    weekStart: WEEK_START, weekEnd: '2026-05-17', computedAt: PUT_AT.toISOString(), horizonStartAt: NOW.toISOString(), horizonEndAt: '2026-05-17T22:00:00.000Z',
    proposals: [{
      id: 'p-1', equipmentId: 'goutte', equipmentName: 'Goutte-à-goutte', kind: 'drip', settingId: 'standard', settingName: 'Standard', placementId: 'pose',
      startAt: '2026-05-13T12:00:00.000Z', endAt: '2026-05-13T13:00:00.000Z', durationSeconds: 3600, doseMm: 30,
      applications: [{ otfZoneId: 'parcelle', otfPlotId: FIELD, otfBedId: BED_A, rateMmPerHour: 30, bedAreaSquareMeters: 8, wettedAreaSquareMeters: 8 }],
      bedApplications: [{ bedId: BED_A, bedName: 'A', needBeforeMm: 30, appliedMm: 30, needAfterMm: 0, surplusMm: 0, wettedAreaSquareMeters: 8 }],
      volumeCubicMeters: 0.24, flowCubicMetersPerHour: 0.24, pumpId: null, pumpOriginId: null,
      justification: { priority: 'normal', doseReason: 'maximum-dose', timingReason: 'earliest', limitingConstraint: null, pump: null, supply: null, hydraulicallyVerified: false },
    }],
    beds: [],
    deficit: { waterCubicMeters: 0, pumpTimeCubicMeters: 0, byReason: {}, bedCount: 0 },
    budgets: [],
    settings: DEFAULT_PLANNING_SETTINGS,
    assumptions: { forecastDays: 7, reservoirsObservedAt: [] },
    suggestions: [],
    overcommittedDays: [],
  } as WeeklyPlan;
}

test('un plan enregistré avant la pause : la réserve du sol lit l’arrosage proposé, jamais le filtre ; c’est le planning recalculé qui n’en propose plus', async () => {
  await farm(ALICE);
  await farm(BOB);
  for (const owner of [ALICE, BOB]) {
    await savePlanCalculationForUser(owner, { season: 2026, weekStart: WEEK_START, trigger: 'manual', actorUserId: owner, plan: planWithProposal() });
  }
  const before = { view: await soil(ALICE), days: await recordedSoilDays(ALICE) };
  await putEverythingOffSeason(ALICE);
  assert.deepEqual(await soil(ALICE), before.view, 'chez Alice, toute la vue, réglages compris, est celle d’avant le geste');
  assert.deepEqual(await recordedSoilDays(ALICE), before.days);
  assert.deepEqual(soilOf(await soil(ALICE)), soilOf(await soil(BOB)));
  assert.deepEqual(await recordedSoilDays(ALICE), await recordedSoilDays(BOB));
  const wednesday = before.days!.daysByBed[BED_A].find((item) => item.date === '2026-05-13');
  assert.equal(wednesday?.irrigationMm, 30, 'l’arrosage proposé entre dans la jauge prévue');

  // Contre-épreuve : les besoins lisent le filtre ; la jauge, non.
  const needs = async (owner: string) => (await getIrrigationNeedsDashboardForUser({ ownerUserId: owner, season: 2026, snapshot, now: NOW }))
    .gardens.flatMap((garden) => garden.beds).map((item) => [item.bedId, item.offSeason === true, item.objectiveMm]);
  assert.deepEqual(await needs(ALICE), [[BED_A, true, null], [BED_B, true, null], [BED_S, true, null]]);
  assert.deepEqual(await needs(BOB), [[BED_A, false, 20], [BED_B, false, 20], [BED_S, false, 20]]);
});

const VANNES = customWeatherLocationKey('Vannes', '56000');
/** Lundi 23 novembre 2026, 6 h 15 à Paris : la tâche du matin ; puis 9 h, l'actualisation à l'écran du lendemain. */
const SYNC_AT = new Date('2026-11-23T05:15:00.000Z');
const SCREEN_AT = new Date('2026-11-24T08:00:00.000Z');

/** Un fournisseur qui compte ses appels et rend J0 à J+14 ; 3 mm chaque jour (tests/db/forecast-archive.test.ts). */
class ArchiveProvider implements WeatherProvider {
  readonly id = 'visual-crossing';
  forecastCalls: WeatherReadInput[] = [];
  async searchLocations() { return []; }
  async readForecast(input: WeatherReadInput): Promise<WeatherDailyValue[]> {
    this.forecastCalls.push(input);
    return dates(input.startDate, input.endDate).map((date) => ({ date, precipitationMm: 3, et0Mm: 1.5, minimumTemperatureCelsius: 2, maximumTemperatureCelsius: 11 }));
  }
  async readReanalysis() { return []; }
}

async function farmAtVannes(owner: string): Promise<string> {
  await saveWeatherPreferenceForUser(owner, { locationMode: 'custom', customCity: 'Vannes', customPostcode: '56000' });
  await saveWeatherGeocodeForUser(owner, VANNES, { displayName: 'Vannes', city: 'Vannes', postcode: '56000', latitude: 47.66, longitude: -2.76, timezone: 'Europe/Paris', countryCode: 'FR' }, 'open-meteo');
  return (await findWorkspaceIdForUser(owner))!;
}
const archiveOf = (workspaceId: string) => listForecastArchive(workspaceId, VANNES, { startDate: '2026-01-01', endDate: '2027-12-31' });

test('l’archive des prévisions : la tâche du matin et l’actualisation à l’écran photographient pareil, filtre actif ou non', async () => {
  const alice = await farmAtVannes(ALICE);
  const bob = await farmAtVannes(BOB);
  await putEverythingOffSeason(ALICE);
  const provider = new ArchiveProvider();
  await runAutomaticWeatherSync({ repository: automaticWeatherRepository, provider, now: SYNC_AT, retry: { sleep: async () => undefined }, log: () => undefined });
  assert.equal(provider.forecastCalls.length, 1, 'un seul appel pour les deux fermes au même lieu, comme avant');
  assert.equal((await archiveOf(alice)).length, 7);
  assert.deepEqual(await archiveOf(alice), await archiveOf(bob));

  const screen: IrrigationSnapshot = { ...snapshot, zones: [], plots: [], beds: [], cropPlan: undefined };
  for (const owner of [ALICE, BOB]) {
    await getWaterDashboardForUser({ ownerUserId: owner, season: 2026, snapshot: screen, now: SCREEN_AT, provider: new ArchiveProvider(), forceWeatherRefresh: true });
  }
  assert.equal((await archiveOf(alice)).length, 7 + 5, 'mardi 9 h : J+1 à J+5, jusqu’au dimanche de la semaine affichée');
  assert.deepEqual(await archiveOf(alice), await archiveOf(bob));
});

const LOCATION = 'custom:tronget:03240';
const MORNING = new Date('2026-11-02T05:15:00.000Z');
const FROST: WeatherAlertCriterionSettings = {
  field: 'minimum-temperature', direction: 'below', threshold: 5, horizonDays: 3, active: true, label: 'Gel sur les poireaux',
};

/** Sans les identifiants, propres à chaque ferme. */
function withoutIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutIds);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'id' && key !== 'criterionId').map(([key, item]) => [key, withoutIds(item)]));
}

test('les alertes météo : le même gel prévu part pareil des deux fermes, filtre actif ou non', async () => {
  const workspaces = { [ALICE]: await ensureWorkspaceForUser(ALICE), [BOB]: await ensureWorkspaceForUser(BOB) };
  await putEverythingOffSeason(ALICE);
  const sent: string[] = [];
  for (const owner of [ALICE, BOB]) {
    await createWeatherAlertCriterionForUser(owner, FROST);
    const values: WeatherDailyValue[] = [7, 4, 6].map((minimum, index) => ({
      date: addDaysToDateKey('2026-11-02', index), precipitationMm: 0, et0Mm: 1.2, minimumTemperatureCelsius: minimum, maximumTemperatureCelsius: 13.8,
    }));
    await upsertWeatherDailyValuesForUser(owner, LOCATION, 'forecast', values, 'visual-crossing', MORNING.toISOString());
    await evaluateWeatherAlertsAfterForecastWrite({
      workspaceId: workspaces[owner], locationKey: LOCATION, now: MORNING, send: async () => { sent.push(owner); return { status: 'sent' as const }; }, log: () => undefined,
    });
  }
  assert.deepEqual(sent, [ALICE, BOB], 'une alerte part de chaque ferme');
  const view = async (owner: string) => withoutIds(await readWeatherAlertsView({ workspaceId: workspaces[owner], locationKey: LOCATION, now: MORNING }));
  assert.deepEqual(await view(ALICE), await view(BOB));
  const alice = await readWeatherAlertsView({ workspaceId: workspaces[ALICE], locationKey: LOCATION, now: MORNING });
  assert.deepEqual(alice.history.map((entry) => [entry.targetDate, entry.forecastValue, entry.label]), [['2026-11-03', '4 °C', 'Gel sur les poireaux']]);
});
