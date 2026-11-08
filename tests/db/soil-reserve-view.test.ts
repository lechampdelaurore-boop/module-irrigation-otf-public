import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { saveSpeciesCorrespondenceForUser } from '../../db/crop-water/entries';
import { savePlanCalculationForUser } from '../../db/planning-repository';
import { addSoilObservationForUser, addSoilRecordForUser, addSurfaceDeclarationForUser } from '../../db/soil-reserve/entries';
import { upsertWeatherDailyValuesForUser } from '../../db/water-management-repository';
import type { IrrigationSnapshot } from '../../lib/domain/domain';
import type { WeeklyPlan } from '../../lib/domain/planning/contract';
import { DEFAULT_PLANNING_SETTINGS } from '../../lib/domain/planning/settings';
import { addDaysToDateKey } from '../../lib/domain/water-management';
import type { SoilRecord } from '../../lib/domain/soil-reserve/soil';
import { weatherLocationKey } from '../../lib/domain/weather/location';
import { getSoilReserveViewForUser } from '../../lib/services/soil-reserve-view';
import { cultivation, series, task } from '../support/crop-water-references';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { FARM_SOIL } from '../support/soil-reserve-fixtures';

/**
 * La jauge du bloc « Réserve du sol » à partir de la base (5 ter, PR 3b) : le
 * sol saisi, l'observation du curseur, l'ETM de la 5 quater et la météo
 * enregistrée donnent l'état de chaque planche maintenant et jusqu'à
 * dimanche ; une planche sans culture est comptée à part avec son état de
 * surface ; sans sol saisi, la jauge est inconnue et le dit.
 */

const ALICE = 'alice';
const BED = 'planche-a';
const EMPTY_BED = 'planche-b';
const SHELTER = 'jardin-serre';
const TODAY = '2026-05-11';
const NOW = new Date('2026-05-11T05:00:00.000Z');

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

const tomatoSeries = series('tomate', [cultivation('tomate-c', 'plant-tomate', 'Tomate', { expected: ['2026-W27', '2026-W40'] })]);
const bed = (id: string, name: string) => ({ id, zoneId: 'parcelle', plotId: SHELTER, name, length: 10, width: 0.8, alleyWidth: 0.4, area: 8, seasons: [2026] });

const snapshot: IrrigationSnapshot = {
  configuration: { seasonFirst: 2025, seasonLast: 2027 },
  structure: { id: '17', name: 'Ferme', legalCity: 'Rennes', legalPostcode: '35000', legalCountry: 'FR' },
  zones: [{ id: 'parcelle', name: 'Parcelle', area: null, seasons: [2025, 2026] }],
  plots: [{ id: SHELTER, zoneId: 'parcelle', name: 'Serre', mode: 'greenhouse', length: 10, width: 8, area: 80, seasons: [2025, 2026] }],
  beds: [bed(BED, 'A'), bed(EMPTY_BED, 'B')],
  cropPlan: {
    series: [tomatoSeries],
    places: [{ id: 'place-tomate', seriesId: 'tomate', bedId: BED, lengthMeters: null }],
    implantationTasks: [task('tomate', 'planting', '2026-W17')],
    readSummary: { seriesRead: 1, placesRead: 1, tasksRead: 1, tasksRetained: 1, placesWithoutSeries: 0, placesOfUnknownSeries: 0, placesWithUnknownBed: 0 },
  },
  source: 'cache',
  lastSuccessfulReadAt: '2026-05-11T00:00:00.000Z',
};

const location = weatherLocationKey({ locationMode: 'otf', customCity: null, customPostcode: null }, snapshot.structure)!;
const days = (from: string, count: number) => Array.from({ length: count }, (_, index) => addDaysToDateKey(from, index));
/** Le sol de la ferme du porteur tel qu'il se saisit : l'heure d'enregistrement vient de la base. */
const SOIL_ENTRY = Object.fromEntries(Object.entries({ ...FARM_SOIL, zoneId: 'parcelle', plotId: null }).filter(([key]) => key !== 'recordedAt')) as Omit<SoilRecord, 'recordedAt'>;

async function prepare(): Promise<void> {
  await saveSpeciesCorrespondenceForUser(ALICE, { plantId: 'plant-tomate', seriesId: null, target: { kind: 'reference', referenceCropId: 'criiam-tomate', analogy: false } });
  await upsertWeatherDailyValuesForUser(ALICE, location, 'forecast', days('2026-04-01', 47).map((date) => ({ date, precipitationMm: 0, et0Mm: 5 })), 'test', '2026-04-01T04:00:00.000Z');
}

test('sans sol saisi, la jauge de la planche cultivée est inconnue et dit pourquoi', async () => {
  await prepare();
  const view = await getSoilReserveViewForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: NOW });
  assert.equal(view.gaugeUnavailable, null);
  const [plot] = view.gauge!.zones[0].plots;
  const tomato = plot.beds.find((item) => item.bedId === BED)!;
  assert.equal(tomato.summary.current, null);
  assert.equal(tomato.summary.unknown?.kind, 'no-soil');
  assert.equal(plot.garden.percent, null);
});

test('le sol saisi et une observation à 60 % : l’état maintenant, le prévu jusqu’à dimanche, la planche sans culture à part', async () => {
  await prepare();
  assert.equal((await addSoilRecordForUser(ALICE, SOIL_ENTRY, NOW)).ok, true);
  const observed = await addSoilObservationForUser(ALICE, { zoneId: 'parcelle', plotId: SHELTER, percent: 60, observedAt: '2026-05-11T04:30:00.000Z' }, NOW);
  assert.equal(observed.ok, true);

  const view = await getSoilReserveViewForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: NOW });
  const zone = view.gauge!.zones[0];
  assert.equal(zone.fieldPlotCount, 0, 'un abri n’est pas réglé par le curseur de sa parcelle');
  const [plot] = zone.plots;
  assert.equal(plot.observation?.percent, 60);
  const tomato = plot.beds.find((item) => item.bedId === BED)!;
  assert.equal(tomato.today?.mode, 'crop');
  assert.ok(tomato.summary.current, 'la jauge est connue');
  assert.equal(Math.round(tomato.summary.current.percent), 60);
  assert.equal(tomato.summary.confidence.kind, 'observation');
  assert.deepEqual(tomato.week.map((day) => day.date), days(TODAY, 7), 'd’aujourd’hui à dimanche');
  assert.ok(tomato.week.every((day) => day.nature === 'forecast' && day.percent !== null));
  assert.ok(tomato.week[6].percent! < tomato.week[0].percent!, 'sans pluie sous abri ni arrosage, la jauge baisse');
  assert.equal(Math.round(plot.garden.percent ?? 0), 60, 'le jardin ne compte que sa planche cultivée');
  assert.deepEqual(plot.garden.withoutCrop.map((item) => [item.bedName, item.surfaceState, item.declared]), [['B', 'bare', false]]);

  const declared = await addSurfaceDeclarationForUser(ALICE, { bedId: EMPTY_BED, date: TODAY, state: 'impermeable-tarp' }, NOW);
  assert.equal(declared.ok, true);
  const after = await getSoilReserveViewForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: NOW });
  const empty = after.gauge!.zones[0].plots[0].beds.find((item) => item.bedId === EMPTY_BED)!;
  assert.equal(empty.today?.surfaceState, 'impermeable-tarp');
  assert.equal(empty.today?.surfaceStateDeclared, true);
});

test('une observation sur une culture sans Kc nomme la culture, au lieu d’attendre un départ', async () => {
  await upsertWeatherDailyValuesForUser(ALICE, location, 'forecast', days('2026-04-01', 47).map((date) => ({ date, precipitationMm: 0, et0Mm: 5 })), 'test', '2026-04-01T04:00:00.000Z');
  assert.equal((await addSoilRecordForUser(ALICE, SOIL_ENTRY, NOW)).ok, true);
  assert.equal((await addSoilObservationForUser(ALICE, { zoneId: 'parcelle', plotId: SHELTER, percent: 60, observedAt: '2026-05-11T04:30:00.000Z' }, NOW)).ok, true);
  const view = await getSoilReserveViewForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: NOW });
  const tomato = view.gauge!.zones[0].plots[0].beds.find((item) => item.bedId === BED)!;
  assert.equal(tomato.summary.current, null);
  assert.deepEqual(tomato.summary.unknown, { kind: 'crop-without-etm', date: TODAY, crops: [{ seriesName: 'tomate', plantName: 'Tomate' }] });
});

test('la jauge suit la saison en cours ; une ferme sans espace lit les valeurs de départ', async () => {
  await prepare();
  const other = await getSoilReserveViewForUser({ ownerUserId: ALICE, season: 2025, snapshot, now: NOW });
  assert.equal(other.gauge, null);
  assert.match(other.gaugeUnavailable ?? '', /saison en cours/);
  const unread = await getSoilReserveViewForUser({ ownerUserId: ALICE, season: 2026, snapshot: { ...snapshot, cropPlan: undefined }, now: NOW });
  assert.match(unread.gaugeUnavailable ?? '', /plan de culture/);
  const bob = await getSoilReserveViewForUser({ ownerUserId: 'bob', season: 2026, snapshot, now: NOW });
  assert.equal(bob.gauge, null);
  assert.equal(bob.waterSurplus, null, 'sans jauge, pas de pastille');
  assert.equal(bob.settings.farm.isDefault, true);
});

/** Un plan de la semaine à une seule proposition : 60 mm sur la planche A, ce matin à 8 h. */
function planWithProposal(): WeeklyPlan {
  const startAt = '2026-05-11T06:00:00.000Z';
  const endAt = '2026-05-11T07:00:00.000Z';
  return {
    weekStart: TODAY, weekEnd: '2026-05-17', computedAt: NOW.toISOString(), horizonStartAt: NOW.toISOString(), horizonEndAt: '2026-05-17T22:00:00.000Z',
    proposals: [{
      id: 'p-1', equipmentId: 'goutte', equipmentName: 'Goutte-à-goutte', kind: 'drip', settingId: 'standard', settingName: 'Standard', placementId: 'pose',
      startAt, endAt, durationSeconds: 3600, doseMm: 60,
      applications: [{ otfZoneId: 'parcelle', otfPlotId: SHELTER, otfBedId: BED, rateMmPerHour: 60, bedAreaSquareMeters: 8, wettedAreaSquareMeters: 8 }],
      bedApplications: [{ bedId: BED, bedName: 'A', needBeforeMm: 60, appliedMm: 60, needAfterMm: 0, surplusMm: 0, wettedAreaSquareMeters: 8 }],
      volumeCubicMeters: 0.48, flowCubicMetersPerHour: 0.48, pumpId: null, pumpOriginId: null,
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

test('une proposition qui apporte plus que ce que le sol peut encore retenir le dit, avec les mm perdus en drainage (PR 3d)', async () => {
  await prepare();
  assert.equal((await addSoilRecordForUser(ALICE, SOIL_ENTRY, NOW)).ok, true);
  assert.equal((await addSoilObservationForUser(ALICE, { zoneId: 'parcelle', plotId: SHELTER, percent: 60, observedAt: '2026-05-11T04:30:00.000Z' }, NOW)).ok, true);
  const before = await getSoilReserveViewForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: NOW });
  assert.deepEqual(before.proposalSoilNotes, {}, 'sans plan, rien');
  assert.deepEqual(before.waterSurplus && { from: before.waterSurplus.from, to: before.waterSurplus.to, beds: before.waterSurplus.beds }, { from: '2026-05-04', to: '2026-05-10', beds: [] }, 'sans irrigation réalisée, rien en trop');

  await savePlanCalculationForUser(ALICE, { season: 2026, weekStart: TODAY, trigger: 'manual', actorUserId: ALICE, plan: planWithProposal() });
  const view = await getSoilReserveViewForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: NOW });
  const notes = Object.values(view.proposalSoilNotes);
  assert.equal(notes.length, 1);
  assert.equal(notes[0][0].bedName, 'A');
  const tomato = view.gauge!.zones[0].plots[0].beds.find((item) => item.bedId === BED)!;
  const room = tomato.summary.current!.capacityMm - tomato.summary.current!.mm;
  assert.ok(Math.abs(notes[0][0].beyondMm - (60 - room)) < 1, `60 mm moins la place du sol (${room.toFixed(1)} mm), à la consommation des premières heures près`);
});
