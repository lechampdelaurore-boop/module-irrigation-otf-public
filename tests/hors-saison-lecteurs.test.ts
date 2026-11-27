import assert from 'node:assert/strict';
import test from 'node:test';
import type { Bed, CropPlan, Plot } from '../lib/domain/domain.ts';
import type { IrrigationEventRecord } from '../lib/domain/irrigation-event-record.ts';
import { allocateIrrigationWater, type FeasibilityPool } from '../lib/domain/irrigation-feasibility.ts';
import type { GoalRevisionLike, HistoryScope, WeatherDailyLike } from '../lib/domain/irrigation-history/contract.ts';
import { resolveHistoryPeriod } from '../lib/domain/irrigation-history/period.ts';
import { buildIrrigationHistorySummary } from '../lib/domain/irrigation-history/summary.ts';
import type { BedIrrigationNeed, IrrigationNeedsDashboard } from '../lib/domain/irrigation-needs.ts';
import { FEATURE_IDS } from '../lib/domain/features/catalogue.ts';
import { needOffSeason, offSeasonSchedule, type OffSeasonByBed, type OffSeasonRevision, type OffSeasonScope } from '../lib/domain/off-season.ts';
import { startRoute, todayRouteBlock, type RouteCounts, type RouteStep } from '../lib/domain/onboarding/route.ts';
import { plannedIrrigationsUnderOffSeason } from '../lib/domain/off-season-planned.ts';
import { buildWeeklyPlan } from '../lib/domain/planning/engine.ts';
import { buildSeriesWaterReport } from '../lib/domain/series/water.ts';
import { todayWeek } from '../lib/domain/today/week.ts';
import {
  ABRI, at, BEFORE, dashboard, decision, FARM_BEDS, FRIDAY, garden, JARDIN_NORD, MONDAY, NEUVE, NEXT_MONDAY, near, NORD,
  plannedOn, PLEIN_CHAMP, put, resume, row, rowsOf, SATURDAY, snapshotOf, SUD, SUNDAY, THURSDAY, TUESDAY, untouched,
  VERGER, WEDNESDAY, WEEK, weekDays,
} from './support/off-season-fixtures.ts';
import { byEquipment, farm, PARIS_21H_WEDNESDAY, realIrrigation, settings, validatedIrrigation } from './support/planning-fixtures.ts';

/**
 * Le filtre « hors saison », PR B2 : chaque lecteur de l'objectif et du
 * planning reçoit le filtre (docs/objectif-automatique-saison-contract.md,
 * sections 4.1, 7 et 10 ; D-337, D-352). Le besoin, le planning, la
 * faisabilité, « Aujourd'hui », l'historique et l'eau des séries ; la liste
 * des arrosages planifiés que la fenêtre de B3 proposera d'annuler. La
 * ferme et la semaine du contrat : tests/support/off-season-fixtures.ts.
 */

/** Le vendredi 19 juin à 10 h à Paris : lundi à vendredi sont passés. */
const FRIDAY_MORNING = new Date(at(FRIDAY));
/** Tout le plein champ hors saison depuis le jeudi 18 juin, 10 h. */
const FROM_THURSDAY = [put(PLEIN_CHAMP, at(THURSDAY))];
const OUTSIDE = ['jardin-nord', 'jardin-sud', 'rangs'];

test('besoin : vue le vendredi, une planche hors saison depuis jeudi n’a plus rien à recevoir ; l’objectif de ses jours d’avant reste écrit', () => {
  const days = weekDays({ today: FRIDAY });
  const decisions = [decision(NORD.id, 15)];
  const plain = dashboard({ days, decisions, now: FRIDAY_MORNING });
  const board = dashboard({ days, decisions, now: FRIDAY_MORNING, gestures: FROM_THURSDAY });
  const nord = row(board, NORD.id);
  near(nord.objectiveMm, 20 * 3 / 7, 'lundi à mercredi : l’objectif reste écrit, inactif');
  assert.deepEqual(nord.offSeasonDates, [THURSDAY, FRIDAY, SATURDAY, SUNDAY]);
  assert.equal(nord.offSeason, true, 'hors saison le jour du calcul : la semaine l’est (seul « Reprendre » le lève)');
  assert.equal(nord.realRemainingMm, null, 'rien à apporter, jamais un zéro');
  assert.equal(nord.rawPlanningNeedMm, null);
  assert.equal(nord.relativeDeficitPercent, null);
  assert.equal(nord.effectiveNeedMm, null, 'le besoin remplacé à la main reste inactif');
  assert.equal(nord.manualOverrideMm, 15, 'et reste enregistré');
  assert.equal(nord.effectiveVolumeCubicMeters, null);
  assert.equal(nord.completeness.missing.includes('objective'), false, 'pas un objectif manquant');
  assert.deepEqual(rowsOf(board).map(untouched), rowsOf(plain).map(untouched), 'la pluie, l’ET0 et l’irrigation de chaque planche ne bougent pas');
  for (const plotId of OUTSIDE) {
    const outside = garden(board, plotId);
    assert.deepEqual([outside.realRemainingMm, outside.effectiveNeedMm, outside.effectiveVolumeCubicMeters], [null, null, null], `${plotId} : ni reste ni volume`);
  }
  assert.deepEqual(garden(board, 'abri'), garden(plain, 'abri'), 'l’abri ne bouge pas');
  assert.deepEqual(board.farmObjective, { objectiveMm: 20, withObjective: 2, total: 6, offSeason: 4 });

  // Vue le mercredi, la même planche a encore des jours en saison : son besoin compte (F991).
  const wednesday = row(dashboard({ decisions, gestures: FROM_THURSDAY }), NORD.id);
  assert.equal('offSeason' in wednesday, false);
  near(wednesday.effectiveNeedMm, 15);
  // Le jour du calcul se lit en heure de Paris (D-004) : jeudi 0 h 30 à Paris, mercredi en temps universel.
  const thursdayNight = { decisions, now: new Date('2026-06-17T22:30:00.000Z'), gestures: [put(PLEIN_CHAMP, '2026-06-17T22:15:00.000Z')] };
  assert.equal(row(dashboard(thursdayNight), NORD.id).offSeason, true, 'mis hors saison à 0 h 15, vu à 0 h 30 : hors saison');
});

test('besoin : la règle du jour du calcul, et une semaine passée qui ne garde que son objectif', () => {
  const fromThursday = [THURSDAY, FRIDAY, SATURDAY, SUNDAY];
  assert.equal(needOffSeason({ objectiveMm: 12, offSeasonDates: fromThursday }, FRIDAY), true, 'hors saison ce jour-là');
  assert.equal(needOffSeason({ objectiveMm: 12, offSeasonDates: fromThursday }, WEDNESDAY), false, 'encore en saison ce jour-là');
  assert.equal(needOffSeason({ objectiveMm: 12, offSeasonDates: fromThursday }, NEXT_MONDAY), false, 'une semaine passée : seul son objectif compte, comme dans l’historique');
  assert.equal(needOffSeason({ objectiveMm: null, offSeasonDates: WEEK }, NEXT_MONDAY), true, 'aucun jour d’objectif : hors saison (F989)');
  assert.equal(needOffSeason({ objectiveMm: 12 }, FRIDAY), false);
  assert.equal(needOffSeason({ objectiveMm: null }, FRIDAY), false, 'sans objectif ni jour hors saison : « sans objectif », comme avant');
});

test('besoin : reprise le mercredi, la planche est servie le jour même, sur l’objectif de ses jours en saison (cas 9)', () => {
  const board = dashboard({ gestures: [put(PLEIN_CHAMP, BEFORE), resume(PLEIN_CHAMP, at(WEDNESDAY))] });
  const nord = row(board, NORD.id);
  assert.equal('offSeason' in nord, false);
  assert.deepEqual(nord.offSeasonDates, [MONDAY, TUESDAY]);
  near(nord.objectiveMm, 20 * 5 / 7, 'mercredi à dimanche');
  assert.ok((nord.effectiveNeedMm ?? 0) > 0, 'un besoin, que le planning sert');
  assert.equal(board.farmObjective.withObjective, 6);
  assert.equal('offSeason' in board.farmObjective, false);
});

/** Les planches du tunnel 1 de la ferme du planning (tests/support/planning-fixtures.ts). */
const T1 = Array.from({ length: 8 }, (_, index) => `T1-${index + 1}`);
/** Ce que le tableau des besoins rend d'une planche hors saison : son objectif et son besoin remplacé restent écrits, rien à recevoir. */
const OFF_SEASON_NEED: Partial<BedIrrigationNeed> = {
  offSeason: true, realRemainingMm: null, relativeDeficitPercent: null, rawPlanningNeedMm: null, calculatedNeedMm: null, effectiveNeedMm: null, effectiveVolumeCubicMeters: null,
};
const onTunnel1 = (patch: Partial<BedIrrigationNeed>) => Object.fromEntries(T1.map((id) => [id, patch]));

test('planning : une planche hors saison n’est pas servie, même avec un besoin remplacé à la main ; le plan est celui d’une ferme sans elle', () => {
  const served = farm({ needs: onTunnel1({ manualOverrideMm: 15 }) }).inputs;
  assert.ok(byEquipment(buildWeeklyPlan(served, settings), 'rampe-tunnel-1').length > 0, 'en saison, le tunnel 1 est arrosé');

  const { inputs } = farm({ needs: onTunnel1({ ...OFF_SEASON_NEED, manualOverrideMm: 15 }) });
  const plan = buildWeeklyPlan(inputs, settings);
  assert.deepEqual(byEquipment(plan, 'rampe-tunnel-1'), [], 'aucun créneau');
  assert.equal(plan.beds.some((bed) => T1.includes(bed.bedId)), false, 'ni ligne au plan, ni « sans objectif »');
  const without = { ...inputs, needs: inputs.needs.filter((need) => !T1.includes(need.bedId)) };
  assert.deepEqual(plan, buildWeeklyPlan(without, settings), 'ni pénurie, ni report : le plan d’une ferme sans ces planches');
});

test('planning : l’arrosage déjà validé d’une planche hors saison reste, sans dose utile suggérée ; l’annuler reste le geste de la personne', () => {
  const validated = validatedIrrigation('valide-t1', 'rampe-tunnel-1', PARIS_21H_WEDNESDAY, 3600, T1, { rate: 10 });
  const inSeason = farm({ events: [validated], needs: onTunnel1({ manualOverrideMm: 0 }) }).inputs;
  assert.deepEqual(buildWeeklyPlan(inSeason, settings).suggestions.map((item) => [item.eventId, item.suggestion]), [['valide-t1', 'cancel']], 'en saison, sans besoin : « Annuler » suggéré');

  const off = farm({ events: [validated], needs: onTunnel1({ ...OFF_SEASON_NEED, manualOverrideMm: 0 }) }).inputs;
  const plan = buildWeeklyPlan(off, settings);
  assert.deepEqual(plan.suggestions, [], 'hors saison : aucune suggestion, la fenêtre de B3 proposera de l’annuler');
  assert.deepEqual(byEquipment(plan, 'rampe-tunnel-1'), [], 'et rien de nouveau');
  assert.deepEqual(off.events, [validated], 'l’arrosage validé n’est pas réécrit');
});

const feasibilityBed = (id: string, need: number | null, patch: Partial<BedIrrigationNeed> = {}): BedIrrigationNeed => ({
  bedId: id, bedName: id, plotId: 'garden', plotName: 'Jardin', zoneId: 'zone', zoneName: 'Parcelle', sheltered: true,
  areaSquareMeters: 1000, wettedAreaSquareMeters: 1000, wettedAreaSource: 'drip', et0Mm: need, et0KnownMm: need, et0ReanalysisMm: need, et0ForecastMm: null,
  objectiveMm: need, objectiveSource: 'farm', objectiveOrigin: 'entered', automaticObjective: null, actualRainMm: 0, actualIrrigationMm: 0,
  realRemainingMm: need, relativeDeficitPercent: 100, forecastRainMm: 0, plannedIrrigationMm: 0, rawPlanningNeedMm: need,
  thresholdMm: 0, calculatedNeedMm: need, manualOverrideMm: null, overrideReason: null, effectiveNeedMm: need, effectiveVolumeCubicMeters: need,
  priority: 'high', weekStart: '2026-09-07', weekEnd: '2026-09-13', deadlineAt: '2026-09-13T22:00:00.000Z',
  completeness: { complete: need !== null, missing: [], demandComplete: need !== null, realComplete: need !== null, planningComplete: need !== null, missingDates: { et0: [], actualRain: [], forecastRain: [] }, estimatedDates: { actualRain: [] } },
  ...patch,
});

function feasibility(beds: BedIrrigationNeed[], pool: FeasibilityPool) {
  const needs: IrrigationNeedsDashboard = {
    season: 2026, weekStart: '2026-09-07', weekEnd: '2026-09-13', timeZone: 'Europe/Paris', calculatedAt: '2026-09-08T12:00:00.000Z', thresholdMm: 0,
    farmObjective: { objectiveMm: null, withObjective: 0, total: beds.length },
    gardens: [{ plotId: 'garden', plotName: 'Jardin', zoneId: 'zone', zoneName: 'Parcelle', sheltered: true, areaSquareMeters: beds.length * 1000, bedCount: beds.length, priorityCounts: { high: beds.length, normal: 0, low: 0 }, realRemainingMm: null, effectiveNeedMm: null, effectiveVolumeCubicMeters: null, beds }],
    completeness: { complete: true, missing: [], demandComplete: true, realComplete: true, planningComplete: true, missingDates: { et0: [], actualRain: [], forecastRain: [] }, estimatedDates: { actualRain: [] } },
  };
  return allocateIrrigationWater({ needs, pools: [pool], decisions: [] });
}

test('faisabilité et pénurie : une planche hors saison n’entre pas dans la demande ; ni inconnue ni bloquante, elle est dite à part', () => {
  const offSeason = feasibilityBed('H', null, OFF_SEASON_NEED);
  const normal = feasibilityBed('N', 10, { priority: 'normal' });
  const pool: FeasibilityPool = { key: 'reservoir:r', name: 'Réserve', currentCubicMeters: 10, forecastCubicMeters: 10, reasons: [], paths: { H: 'confirmed', H2: 'confirmed', N: 'confirmed' } };
  const result = feasibility([offSeason, normal], pool);
  assert.equal(result.unknownNeedCount, 0, 'pas un besoin inconnu');
  near(result.totalNeedCubicMeters, 10, 'la demande sans elle');
  const allocated = result.priorities.flatMap((level) => level.beds);
  assert.deepEqual(allocated.map((bed) => bed.need.bedId), ['N'], 'elle ne retient aucune priorité');
  near(allocated[0].allocatedCubicMeters, 10, 'la priorité normale est servie : rien ne la bloque');
  assert.deepEqual(result.notes, ['1 planche hors saison : son irrigation est ignorée, elle n’est pas comptée ici.']);
  assert.deepEqual({ ...result, notes: [] }, { ...feasibility([normal], pool), notes: [] }, 'le reste est celui d’une ferme sans elle');
  assert.equal(feasibility([offSeason, feasibilityBed('H2', null, OFF_SEASON_NEED), normal], pool).notes[0], '2 planches hors saison : leur irrigation est ignorée, elles ne sont pas comptées ici.');

  // Sans le filtre, la même planche sans objectif serait un besoin inconnu.
  const unknown = feasibility([feasibilityBed('H', null), normal], pool);
  assert.equal(unknown.unknownNeedCount, 1);
  assert.equal(unknown.totalNeedCubicMeters, null);
  assert.equal(unknown.notes.some((note) => note.includes('hors saison')), false, 'filtre vide : aucune phrase de plus');
});

test('« Aujourd’hui » : les planches hors saison sortent des comptes de la semaine et y sont dites à part', () => {
  const week = todayWeek({ weekStart: MONDAY, weekEnd: SUNDAY, beds: rowsOf(dashboard({ gestures: [put(PLEIN_CHAMP, BEFORE)] })), water: null })!;
  assert.deepEqual(week.farm.objectiveBeds, { withObjective: 2, total: 6, offSeason: 4 });
  near(week.farm.objectiveMm, 20, 'la moyenne sur les planches en saison');
  assert.match(week.tiles.objectiveDetail, /^2 planches sur 2 ont un objectif, 4 hors saison, /, 'la phrase de l’objectif de la ferme (F992)');
  const north = [...week.shown, ...week.hidden].find((item) => item.key === 'jardin-nord')!;
  assert.deepEqual(north.objectiveBeds, { withObjective: 0, total: 2, offSeason: 2 });
  assert.equal(north.objectiveMm, null, 'jamais un zéro');
  assert.equal(north.remainingMm, null);

  // Vue le vendredi, hors saison depuis jeudi : l'objectif de leurs jours d'avant reste écrit, elles sortent quand même des comptes.
  const friday = todayWeek({ weekStart: MONDAY, weekEnd: SUNDAY, beds: rowsOf(dashboard({ gestures: FROM_THURSDAY, now: FRIDAY_MORNING, days: weekDays({ today: FRIDAY }) })), water: null })!;
  assert.deepEqual(friday.farm.objectiveBeds, { withObjective: 2, total: 6, offSeason: 4 });
  near(friday.farm.objectiveMm, 20);
  const fridayNorth = [...friday.shown, ...friday.hidden].find((item) => item.key === 'jardin-nord')!;
  assert.deepEqual(fridayNorth.objectiveBeds, { withObjective: 0, total: 2, offSeason: 2 });

  const plain = todayWeek({ weekStart: MONDAY, weekEnd: SUNDAY, beds: rowsOf(dashboard()), water: null })!;
  assert.deepEqual(plain.farm.objectiveBeds, { withObjective: 6, total: 6 }, 'filtre vide : le compte d’avant, sans champ de plus');
  assert.match(plain.tiles.objectiveDetail, /^ferme entière, /);
});

const HISTORY_WEEK = resolveHistoryPeriod(2026, { mode: 'week', anchorDate: WEDNESDAY });
const FARM_SCOPE: HistoryScope = { level: 'farm', zoneId: null, plotId: null, bedId: null };
/** La pluie de la semaine : 2 mm de réanalyse par jour, et 12 mm au pluviomètre le lundi, qui prime. */
const WEATHER: WeatherDailyLike[] = [
  ...WEEK.map((date): WeatherDailyLike => ({ date, dataKind: 'reanalysis', precipitationMm: 2, et0Mm: 4 })),
  { date: MONDAY, dataKind: 'manual_precipitation', precipitationMm: 12, et0Mm: null },
];
const byBed = (gestures: readonly OffSeasonRevision[]): OffSeasonByBed => {
  const schedule = offSeasonSchedule(gestures);
  return new Map(FARM_BEDS.map((bed) => [bed.id, schedule.daysOf(bed)]));
};

function history(offSeason?: OffSeasonByBed, goals: GoalRevisionLike[] = [{ id: 'ferme', weekStart: MONDAY, scopeType: 'farm', otfZoneId: null, otfPlotId: null, otfBedId: null, amountMm: 14, action: 'set', createdAt: '2026-06-01T07:00:00.000Z' }]) {
  const snapshot = snapshotOf(FARM_BEDS);
  const events = [realIrrigation('arrosage-mardi', 'goutte-a-goutte', '2026-06-16T05:00:00.000Z', [NORD.id], 10, 10)];
  return buildIrrigationHistorySummary({ events, scopeBeds: snapshot.beds, plots: snapshot.plots, scope: FARM_SCOPE, period: HISTORY_WEEK, weather: WEATHER, goalRevisions: goals, ...(offSeason ? { offSeason } : {}) });
}

/** Ce que le filtre ne touche jamais d'un historique : la pluie et l'irrigation réelle, leurs jours et leurs planches. */
function waterOf(summary: ReturnType<typeof history>) {
  const { objectiveMm, objectiveAvailability, objectiveBeds, objectiveAutomatic, irrigationAndRainMm, gapToObjectiveMm, ...water } = summary;
  void [objectiveMm, objectiveAvailability, objectiveBeds, objectiveAutomatic, irrigationAndRainMm, gapToObjectiveMm];
  return water;
}

test('historique : un jour hors saison n’a pas d’objectif ; la pluie et l’irrigation de la semaine restent les mêmes', () => {
  const plain = history();
  assert.deepEqual(history(byBed([])), plain, 'filtre vide : rien ne change');
  const partial = history(byBed(FROM_THURSDAY));
  assert.deepEqual(waterOf(partial), waterOf(plain), 'la pluie du pluviomètre et de la réanalyse, l’irrigation réelle');
  assert.deepEqual(partial.objectiveAvailability, { availableBedDays: 26, totalBedDays: 26, complete: true }, 'quatre jours hors saison sur quatre planches ne sont pas à couvrir');
  assert.deepEqual(partial.objectiveBeds, { withObjective: 6, total: 6, bedDays: 42 }, 'chaque planche garde ses jours d’objectif');
  near(partial.objectiveMm, (330 * 6 + 100 * 14) / 430, 'lundi à mercredi dehors, la semaine sous abri et au jardin à classer');

  const whole = history(byBed([put(PLEIN_CHAMP, BEFORE)]));
  assert.deepEqual(waterOf(whole), waterOf(plain));
  assert.deepEqual(whole.objectiveBeds, { withObjective: 2, total: 6, bedDays: 14, offSeason: 4 });
  near(whole.objectiveMm, 14, 'la moyenne sur les planches en saison');
  assert.deepEqual(whole.objectiveAvailability, { availableBedDays: 14, totalBedDays: 14, complete: true });
});

test('eau des séries : une planche hors saison n’a d’objectif que ses jours en saison ; l’objectif restant ne compte pas ses jours à venir', () => {
  // Vu le 29 septembre 2026, tout le plein champ hors saison depuis le mardi 15 septembre : choux semés en semaine 36 en
  // plein champ, tomates sous abri, salades sur une planche de chaque, mâche semée en semaine 39, après le geste.
  const plots: Plot[] = [
    { id: 'plot-nord', zoneId: 'zone', name: 'Jardin Nord', mode: 'garden', length: 40, width: 30, area: 1200, seasons: [2026] },
    { id: 'plot-tunnel', zoneId: 'zone', name: 'Tunnel 1', mode: 'greenhouse', length: 20, width: 8, area: 160, seasons: [2026] },
  ];
  const beds: Bed[] = [
    { id: 'bed-n01', zoneId: 'zone', plotId: 'plot-nord', name: 'N01', length: 30, width: 0.75, alleyWidth: 0.45, area: 22.5, seasons: [2026] },
    { id: 'bed-t01', zoneId: 'zone', plotId: 'plot-tunnel', name: 'T01', length: 16, width: 0.75, alleyWidth: 0.25, area: 12, seasons: [2026] },
  ];
  const series = (id: string, name: string) => ({ id, name, season: 2026, use: 'bed' as const, cycle: 'annual' as const, cultivations: [{ id: `${id}-c`, plantId: 'p', plantName: name, harvestWeeks: [], harvestWeeksExpected: ['2026-W44'] }] });
  const sowing = (seriesId: string, week = '2026-W36') => ({ id: `t-${seriesId}`, seriesId, cultivationId: null, kind: 'direct-sowing' as const, plannedWeek: week, doneWeek: week, status: 'done' as const });
  const cropPlan: CropPlan = {
    series: [series('choux', 'Choux'), series('tomates', 'Tomates'), series('salades', 'Salades'), series('mache', 'Mâche')],
    places: [
      { id: 'p1', seriesId: 'choux', bedId: 'bed-n01', lengthMeters: 30 }, { id: 'p2', seriesId: 'tomates', bedId: 'bed-t01', lengthMeters: 16 },
      { id: 'p3', seriesId: 'salades', bedId: 'bed-n01', lengthMeters: 30 }, { id: 'p4', seriesId: 'salades', bedId: 'bed-t01', lengthMeters: 16 },
      { id: 'p5', seriesId: 'mache', bedId: 'bed-n01', lengthMeters: 30 },
    ],
    implantationTasks: [sowing('choux'), sowing('tomates'), sowing('salades'), sowing('mache', '2026-W39')],
    readSummary: { seriesRead: 0, placesRead: 0, tasksRead: 0, tasksRetained: 0, placesWithoutSeries: 0, placesOfUnknownSeries: 0, placesWithUnknownBed: 0 },
  };
  const weather = Array.from({ length: 30 }, (_, index): WeatherDailyLike => ({ date: new Date(Date.UTC(2026, 7, 31 + index)).toISOString().slice(0, 10), dataKind: 'reanalysis', precipitationMm: 1, et0Mm: 2 }));
  const goalRevisions: GoalRevisionLike[] = [{ id: 'ferme', weekStart: '2026-01-05', scopeType: 'farm', otfZoneId: null, otfPlotId: null, otfBedId: null, amountMm: 14, action: 'set', createdAt: '2026-01-05T00:00:00Z' }];
  const report = (offSeason?: OffSeasonByBed) => buildSeriesWaterReport({ cropPlan, beds, plots, events: [], weather, goalRevisions, today: '2026-09-29', ...(offSeason ? { offSeason } : {}) });
  const schedule = offSeasonSchedule([put(PLEIN_CHAMP, '2026-09-15T08:00:00.000Z')]);
  const filtered = report(new Map(beds.map((bed) => [bed.id, schedule.daysOf({ ...bed, plotMode: bed.plotId === 'plot-nord' ? 'garden' : 'greenhouse' })])));
  const named = (from: ReturnType<typeof report>, name: string) => from.series.find((item) => item.name === name)!;
  const [choux, tomates, salades, mache] = ['Choux', 'Tomates', 'Salades', 'Mâche'].map((name) => named(filtered, name));
  const plain = (name: string) => named(report(), name);

  near(plain('Choux').objectiveMm, 60, 'sans filtre : 14 mm par semaine sur 30 jours');
  near(choux.objectiveMm, 30, 'du 31 août au 14 septembre : 14 × 15 / 7');
  assert.deepEqual(choux.objectiveBeds, { withObjective: 1, total: 1 }, 'ses jours en saison gardent leur objectif');
  assert.equal(plain('Choux').objectiveRemainingMm, 66);
  assert.equal(choux.objectiveRemainingMm, null, 'hors saison jusqu’à la reprise : aucun objectif restant, jamais un zéro');
  for (const name of ['Choux', 'Salades', 'Mâche']) {
    const [after, before] = [named(filtered, name), plain(name)];
    assert.deepEqual([after.rainMm, after.irrigationAndRainMm], [before.rainMm, before.irrigationAndRainMm], `${name} : la pluie et l’eau reçues ne bougent pas`);
  }
  near(salades.objectiveRemainingMm, 66, 'l’objectif restant des salades : celui de la planche sous abri seule');
  assert.equal(salades.objectiveBeds.offSeason, undefined, 'chacune de ses planches garde des jours d’objectif');
  assert.deepEqual(mache.objectiveBeds, { withObjective: 0, total: 1, offSeason: 1 }, 'semée après le geste : hors saison, pas « sans objectif »');
  assert.equal(mache.objectiveMm, null);
  assert.equal(mache.gapToObjectiveMm, null, 'aucun écart, aucun dépassement inventé');
  assert.deepEqual(tomates, plain('Tomates'), 'sous abri, rien ne change');
});

/** Un arrosage planifié, pas démarré, sur des planches de la ferme du contrat, à leurs jardin et parcelle. */
function plannedFor(id: string, startAt: string, bedIds: readonly string[], patch: Partial<IrrigationEventRecord['equipment']> = {}): IrrigationEventRecord {
  const base = plannedOn(bedIds[0], startAt, 6);
  const placed = (bedId: string) => {
    const bed = FARM_BEDS.find((item) => item.id === bedId)!;
    return { ...base.equipment.applications[0], otfZoneId: bed.zoneId, otfPlotId: bed.plotId, otfBedId: bedId };
  };
  return { ...base, id, equipment: { ...base.equipment, id: `${id}-eq`, applications: bedIds.map(placed), ...patch } };
}

test('les arrosages planifiés que la mise hors saison toucherait : pas démarrés, du jour du geste ou après, avec les planches qu’ils arrosent aussi', () => {
  // Le geste du mercredi : à partir de mercredi 0 h à Paris.
  const from = new Date('2026-06-16T22:00:00.000Z');
  const canceled = plannedFor('annule', at(FRIDAY), [NORD.id]);
  const events = [
    plannedFor('vendredi-nord-abri', at(FRIDAY), [NORD.id, ABRI.id]),
    plannedFor('jeudi-sud', at(THURSDAY), [SUD.id]),
    plannedFor('mardi-nord', at(TUESDAY), [NORD.id]),
    plannedFor('abri-seul', at(FRIDAY), [ABRI.id]),
    plannedFor('jardin-neuf', at(FRIDAY), [NEUVE.id]),
    plannedFor('demarre', at(WEDNESDAY), [NORD.id], { actualStartAt: at(WEDNESDAY) }),
    plannedFor('minuteur', at(WEDNESDAY, '09:00'), [NORD.id], { timerState: 'running' }),
    { ...canceled, status: 'canceled' as const },
    plannedFor('reste-annule', at(FRIDAY), [SUD.id], { remainingCanceledAt: at(WEDNESDAY) }),
    plannedFor('rien-a-donner', at(FRIDAY), [VERGER.id], { applications: [{ ...plannedFor('x', at(FRIDAY), [VERGER.id]).equipment.applications[0], plannedAmountMm: 0 }] }),
    realIrrigation('fait', 'goutte-a-goutte', at(WEDNESDAY), [NORD.id], 10, 10),
  ];
  const plots = snapshotOf(FARM_BEDS).plots;
  const before = structuredClone(events);
  const listed = (scope: OffSeasonScope, given = plots) => plannedIrrigationsUnderOffSeason({ scope, events, plots: given, from })
    .map((item) => [item.eventId, item.coveredBedIds, item.otherBedIds]);
  assert.deepEqual(listed(PLEIN_CHAMP), [
    ['jeudi-sud', [SUD.id], []],
    ['vendredi-nord-abri', [NORD.id], [ABRI.id]],
  ], 'dans l’ordre du temps ; l’annuler prive aussi l’abri de son eau, l’écran le dira');
  const [first] = plannedIrrigationsUnderOffSeason({ scope: PLEIN_CHAMP, events, plots, from });
  assert.deepEqual(first, {
    eventId: 'jeudi-sud', eventEquipmentId: 'jeudi-sud-eq', equipmentName: 'rampe',
    plannedStartAt: at(THURSDAY), plannedEndAt: '2026-06-18T09:00:00.000Z', coveredBedIds: [SUD.id], otherBedIds: [],
  });
  assert.deepEqual(listed(JARDIN_NORD), [['vendredi-nord-abri', [NORD.id], [ABRI.id]]]);
  assert.deepEqual(listed({ level: 'plot', plotId: 'jardin-neuf' }), [['jardin-neuf', [NEUVE.id], []]], 'un jardin à classer, par son nom');
  assert.deepEqual(listed({ level: 'mode', mode: 'greenhouse' }), [['abri-seul', [ABRI.id], []], ['vendredi-nord-abri', [ABRI.id], [NORD.id]]]);
  // Un jardin que l'instantané ne connaît plus se lit comme à classer : aucune portée de mode ne le couvre (D-003).
  assert.deepEqual(listed(PLEIN_CHAMP, plots.filter((plot) => plot.id !== 'jardin-sud')), [['vendredi-nord-abri', [NORD.id], [ABRI.id]]]);
  assert.deepEqual(events, before, 'la liste ne réécrit rien : l’annulation reste le geste du planning');
});

/** Une ferme décrite sauf son sol : la carte reste, et l'étape 4 se lit faite ou en cours (S6, section 5.1). */
const DESCRIBED: RouteCounts = {
  equipment: { drip: 4, sprinkler: 0, withoutSetting: 0 },
  placement: { watered: 10, total: 10 },
  water: { names: ['Bassin', 'Puits'], total: 2 },
  objective: { withObjective: 10, total: 10 },
  soil: { withoutSoil: 1, total: 6, anchor: 'soil-parcel-z6' },
};

function objectiveStep(objective: RouteCounts['objective']): RouteStep {
  const value = startRoute({ startMode: 'all', routeState: null, enabled: [...FEATURE_IDS], counts: { ...DESCRIBED, objective } });
  assert.equal(value.kind, 'card');
  const step = value.kind === 'card' ? value.steps.find((item) => item.id === 'objective') : undefined;
  assert.ok(step, 'l’étape « Combien je vise par semaine »');
  return step;
}

test('F1071 : l’étape « Combien je vise par semaine » de la mise en route compte les planches en saison et dit les autres à part', () => {
  // Filtre vide : le résultat d'avant, mot pour mot.
  assert.deepEqual([objectiveStep({ withObjective: 10, total: 10 }).status, objectiveStep({ withObjective: 10, total: 10 }).line], ['done', 'ferme entière']);
  const before = objectiveStep({ withObjective: 7, total: 10 });
  assert.deepEqual([before.status, before.line], ['current', '3 planches n’ont pas encore d’eau visée.']);

  // Trois planches hors saison : les sept en saison ont leur eau visée, l'étape est faite et le dit.
  const paused = objectiveStep({ withObjective: 7, total: 10, offSeason: 3 });
  assert.deepEqual([paused.status, paused.line], ['done', '7 planches sur 7 ont un objectif, 3 hors saison']);
  // Une planche hors saison ne manque jamais : deux planches en saison sans eau visée, pas cinq.
  const missing = objectiveStep({ withObjective: 5, total: 10, offSeason: 3 });
  assert.deepEqual([missing.status, missing.line], ['current', '2 planches n’ont pas encore d’eau visée.']);
  const card = startRoute({ startMode: 'all', routeState: null, enabled: [...FEATURE_IDS], counts: { ...DESCRIBED, objective: { withObjective: 5, total: 10, offSeason: 3 } } });
  assert.equal(todayRouteBlock(card, [...FEATURE_IDS])?.sentence, 'Combien vous visez par semaine : 2 planches n’ont pas encore d’eau visée.');
  // Toute la ferme hors saison : rien à viser, rien ne manque.
  const all = objectiveStep({ withObjective: 0, total: 10, offSeason: 10 });
  assert.deepEqual([all.status, all.line], ['done', 'aucune planche en saison, 10 hors saison']);
});
