import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  automaticObjectiveDayValues,
  automaticObjectivePeriod,
  type AutomaticObjectiveInput,
} from '../lib/domain/automatic-objective.ts';
import type { Bed, IrrigationSnapshot, Plot } from '../lib/domain/domain.ts';
import { farmObjective, farmObjectiveText, type FarmObjective } from '../lib/domain/farm-objective.ts';
import type { IrrigationEventRecord } from '../lib/domain/irrigation-event-record.ts';
import type {
  GoalRevisionLike,
  HistoryPeriod,
  HistoryScope,
  IrrigationHistorySummary,
  WeatherDailyLike,
} from '../lib/domain/irrigation-history/contract.ts';
import { dateKeys } from '../lib/domain/irrigation-history/dates.ts';
import { historyGapScopeText, historyObjectiveScopeText } from '../lib/domain/irrigation-history/objective-scope.ts';
import { resolveHistoryPeriod } from '../lib/domain/irrigation-history/period.ts';
import { buildIrrigationHistorySummary } from '../lib/domain/irrigation-history/summary.ts';
import { buildIrrigationHistoryCsv } from '../lib/domain/irrigation-history-csv.ts';
import { objectiveForBed } from '../lib/domain/irrigation-needs.ts';
import { addDaysToDateKey } from '../lib/domain/water-management.ts';

/**
 * Simplifier l'usage du module, lot S1, PR 3 bis : l'Historique compte
 * l'objectif comme « Aujourd'hui » (docs/simplification-s1-contract.md,
 * section 5 bis ; D-329, qui remplace D-036 sur ce point). Deux fermes :
 * l'une où chaque planche a un objectif, où rien ne change ; l'autre où une
 * partie seulement en a un, où l'objectif et l'écart se chiffrent sur elles.
 * Semaine du lundi 7 au dimanche 13 septembre 2026.
 */

const WEEK = resolveHistoryPeriod(2026, { mode: 'week', anchorDate: '2026-09-09' });
const DAYS = dateKeys(WEEK.startDate, WEEK.endDate);
const FARM: HistoryScope = { level: 'farm', zoneId: null, plotId: null, bedId: null };

type Farm = { plots: Plot[]; beds: Bed[] };

const plot = (id: string, zoneId: string, mode: Plot['mode']): Plot => ({
  id, zoneId, name: id, mode, length: 10, width: 10, area: 100, seasons: [2026],
});
const bed = (id: string, where: Plot, area: number): Bed => ({
  id, zoneId: where.zoneId, plotId: where.id, name: id, length: area, width: 1, alleyWidth: null, area, seasons: [2026],
});

let gesture = 0;
/** Un objectif posé le jour `day` (0 : lundi) de la semaine du lundi `monday`, à 7 h à la ferme ; `null` : un retrait. */
function revision(
  scopeType: GoalRevisionLike['scopeType'],
  where: { zoneId?: string; plotId?: string; bedId?: string },
  amountMm: number | null,
  day = 0,
  monday = WEEK.startDate,
): GoalRevisionLike {
  gesture += 1;
  return {
    id: `objectif-${gesture}`,
    weekStart: monday,
    scopeType,
    otfZoneId: where.zoneId ?? null,
    otfPlotId: where.plotId ?? null,
    otfBedId: where.bedId ?? null,
    amountMm,
    action: amountMm === null ? 'cleared' : 'set',
    // 7 h à Paris (UTC+2 en septembre) ; une milliseconde par geste, dans l'ordre où le test les écrit.
    createdAt: `${addDaysToDateKey(monday, day)}T05:00:00.${String(gesture % 1000).padStart(3, '0')}Z`,
  };
}
const onFarm = (amountMm: number | null, day = 0) => revision('farm', {}, amountMm, day);
const onZone = (zoneId: string, amountMm: number | null, day = 0) => revision('zone', { zoneId }, amountMm, day);
const onPlot = (where: Plot, amountMm: number | null, day = 0) => revision('plot', { zoneId: where.zoneId, plotId: where.id }, amountMm, day);
const onBed = (where: Bed, amountMm: number | null, day = 0, monday = WEEK.startDate) => (
  revision('bed', { zoneId: where.zoneId, plotId: where.plotId, bedId: where.id }, amountMm, day, monday)
);

/** Une irrigation faite le jour `day`, d'une heure, avec ses millimètres par planche. */
function irrigation(id: string, day: number, applications: readonly (readonly [Bed, number])[]): IrrigationEventRecord {
  const startAt = `${DAYS[day]}T06:00:00.000Z`;
  const endAt = `${DAYS[day]}T07:00:00.000Z`;
  const [[first]] = applications;
  return {
    id, season: 2026, status: 'completed', note: null, remainingCanceledAt: null, canceledAt: null,
    createdAt: startAt, updatedAt: endAt,
    equipment: {
      id: `materiel-${id}`, equipmentId: 'goutte', settingId: 'reglage', placementId: 'position', status: 'completed',
      plannedStartAt: null, plannedEndAt: null, actualStartAt: startAt, actualEndAt: endAt,
      plannedDurationSeconds: 3600, actualDurationSeconds: 3600,
      equipmentSnapshot: { id: 'goutte', name: 'Goutte-à-goutte', kind: 'drip', mobility: 'mobile' },
      settingSnapshot: { id: 'reglage', name: 'Réglage 1', position: 1, kind: 'drip', rateMmPerHour: 10 },
      placementSnapshot: {
        id: 'position', equipmentId: 'goutte', settingId: 'reglage', season: 2026, gardenGroupId: null,
        otfZoneId: first.zoneId, otfPlotId: first.plotId, anchor: { type: 'bed_center', anchorBedOtfId: first.id }, selectedBeds: [],
      },
      timerState: null, timerStartedAt: null, timerResumedAt: null, timerPausedAt: null, timerTheoreticalEndAt: null,
      timerAccumulatedSeconds: 0, timerAlarmRevision: null, timerAlarmStatus: null, timerAlarmSyncedAt: null,
      remainingCanceledAt: null, canceledAt: null,
      applications: applications.map(([target, mm]) => ({
        otfZoneId: target.zoneId, otfPlotId: target.plotId, otfBedId: target.id,
        rateMmPerHour: mm, bedAreaSquareMeters: target.area, wettedAreaSquareMeters: target.area,
        plannedAmountMm: mm, actualAmountMm: mm,
      })),
    },
  };
}

/** La pluie réelle, `mm` chaque jour de la semaine, sauf les jours `missing`. */
const rain = (mm: number, missing: readonly string[] = []): WeatherDailyLike[] => DAYS
  .filter((date) => !missing.includes(date))
  .map((date) => ({ date, dataKind: 'reanalysis', precipitationMm: mm, et0Mm: 4 }));

function summaryOf(farm: Farm, goalRevisions: readonly GoalRevisionLike[], options: {
  events?: readonly IrrigationEventRecord[];
  weather?: readonly WeatherDailyLike[];
  scope?: HistoryScope;
  scopeBeds?: readonly Bed[];
  period?: HistoryPeriod;
  automatic?: (target: Bed) => AutomaticObjectiveInput;
} = {}): IrrigationHistorySummary {
  const period = options.period ?? WEEK;
  const scopeBeds = options.scopeBeds ?? farm.beds;
  const automatic = options.automatic;
  return buildIrrigationHistorySummary({
    events: options.events ?? [], scopeBeds, plots: farm.plots, scope: options.scope ?? FARM, period,
    weather: options.weather ?? rain(0), goalRevisions,
    // Comme le service : la découpe de la période faite une fois, la valeur de chaque jour celle d'`objectiveForBed`.
    automaticObjective: automatic === undefined ? undefined : new Map(scopeBeds.map((target) => [
      target.id,
      automaticObjectiveDayValues(automatic(target), target, automaticObjectivePeriod(automatic(target).settings, dateKeys(period.startDate, period.endDate))),
    ])),
  });
}

/** L'objectif de la ferme que lit « Aujourd'hui » : celui de chaque planche par `objectiveForBed`, puis la fonction unique. */
function todayObjective(beds: readonly Bed[], goalRevisions: readonly GoalRevisionLike[], automatic?: (target: Bed) => AutomaticObjectiveInput): FarmObjective {
  return farmObjective(beds.map((target) => ({
    areaSquareMeters: target.area,
    objectiveMm: objectiveForBed(goalRevisions, target, WEEK.startDate, WEEK.endDate, automatic?.(target)).value,
  })));
}

/** L'objectif de l'Historique dans la forme de la fonction unique, pour en écrire la phrase. */
const asFarmObjective = (summary: IrrigationHistorySummary): FarmObjective => ({
  objectiveMm: summary.objectiveMm,
  withObjective: summary.objectiveBeds.withObjective,
  total: summary.objectiveBeds.total,
});

function near(actual: number | null | undefined, expected: number, message = '') {
  assert.ok(typeof actual === 'number' && Math.abs(actual - expected) < 1e-9, `${message} : attendu ${expected}, obtenu ${actual}`);
}

/** Ferme 1 : un jardin de plein champ, deux planches de surfaces différentes, chacune avec un objectif. */
const F1_JARDIN = plot('f1-jardin', 'f1-parcelle', 'garden');
const F1_A = bed('f1-a', F1_JARDIN, 100);
const F1_B = bed('f1-b', F1_JARDIN, 300);
const FARM_1: Farm = { plots: [F1_JARDIN], beds: [F1_A, F1_B] };

/** Ferme 2 : une serre de deux planches avec un objectif, un champ sans. */
const F2_SERRE = plot('f2-serre', 'f2-parcelle', 'greenhouse');
const F2_CHAMP = plot('f2-champ', 'f2-parcelle', 'garden');
const F2_S = bed('f2-s', F2_SERRE, 50);
const F2_T = bed('f2-t', F2_SERRE, 150);
const F2_C = bed('f2-c', F2_CHAMP, 800);
const FARM_2: Farm = { plots: [F2_SERRE, F2_CHAMP], beds: [F2_S, F2_T, F2_C] };

test('ferme 1, chaque planche a un objectif : rien ne change, objectif 17,5 mm et écart 2,5 mm', () => {
  // « Toute la ferme » 14 mm, la planche A 28 mm : A vise 28 mm, B 14 mm.
  const goals = [onFarm(14), onBed(F1_A, 28)];
  const summary = summaryOf(FARM_1, goals, {
    events: [irrigation('f1', 2, [[F1_A, 20], [F1_B, 4]])],
    weather: rain(1),
  });
  // (28 × 100 + 14 × 300) / 400 = 17,5 mm ; la moyenne sur toute la surface d'avant D-329 donne la même chose.
  assert.equal(summary.objectiveMm, 17.5);
  assert.deepEqual(summary.objectiveBeds, { withObjective: 2, total: 2, bedDays: 14 });
  assert.deepEqual(summary.objectiveAvailability, { availableBedDays: 14, totalBedDays: 14, complete: true });
  // Irrigation (20 × 100 + 4 × 300) / 400 = 8 mm, pluie 7 × 1 mm : l'eau reçue de toute la ferme, comme avant.
  assert.equal(summary.irrigationMm, 8);
  assert.equal(summary.actualRainMm, 7);
  assert.equal(summary.irrigationAndRainMm, 15);
  assert.equal(summary.gapToObjectiveMm, 2.5);
  // Rien de plus à dire sous l'objectif ni sous l'écart.
  assert.equal(historyObjectiveScopeText(summary), null);
  assert.equal(historyGapScopeText(summary), null);
  // « Aujourd'hui » dit le même chiffre, avec la même phrase.
  assert.deepEqual(asFarmObjective(summary), todayObjective(FARM_1.beds, goals));
  assert.equal(farmObjectiveText(asFarmObjective(summary)), '17,5 mm visés, ferme entière');
});

test('ferme 2, une partie des planches a un objectif : 28,5 mm sur elles, l’écart sur la même eau, et la page le dit', () => {
  // La serre 21 mm dès le lundi, la planche T 35 mm posés le mercredi ; le champ n'a pas d'objectif.
  // S : 7 × 3 = 21 mm ; T : 2 × 3 + 5 × 5 = 31 mm.
  const goals = [onPlot(F2_SERRE, 21), onBed(F2_T, 35, 2)];
  const summary = summaryOf(FARM_2, goals, {
    events: [irrigation('f2', 1, [[F2_S, 12], [F2_T, 12], [F2_C, 30]])],
    weather: rain(2),
  });
  // (21 × 50 + 31 × 150) / 200 = 28,5 mm. L'Historique disait 5 700 / 1 000 = 5,7 mm, le champ compté à zéro.
  assert.equal(summary.objectiveMm, 28.5);
  assert.deepEqual(summary.objectiveBeds, { withObjective: 2, total: 3, bedDays: 14 });
  assert.deepEqual(summary.objectiveAvailability, { availableBedDays: 14, totalBedDays: 21, complete: false });
  // Les cumuls de la ferme restent ceux de toute sa surface : (12 × 50 + 12 × 150 + 30 × 800) / 1 000 = 26,4 mm ;
  // la pluie, 14 mm sur les 800 m² du champ, zéro sous la serre : 11,2 mm.
  near(summary.irrigationMm, 26.4, 'irrigation de la ferme');
  near(summary.actualRainMm, 11.2, 'pluie de la ferme');
  // L'écart compare l'objectif à l'eau des seules planches qui en ont un : 12 mm d'irrigation, 0 mm de pluie sous la serre.
  assert.equal(summary.irrigationAndRainMm, 12);
  assert.equal(summary.gapToObjectiveMm, 16.5, '28,5 − 12 ; il valait 5,7 − 37,6 = −31,9 mm, un excès qui n’existait pas');
  // Ce que la page écrit sous l'objectif et sous l'écart (règle 5).
  assert.equal(historyObjectiveScopeText(summary), '2 planches sur 3 ont un objectif');
  assert.equal(historyGapScopeText(summary), 'Eau reçue par ces 2 planches : 12 mm');
  // « Aujourd'hui » dit le même chiffre, avec la même phrase.
  assert.deepEqual(asFarmObjective(summary), todayObjective(FARM_2.beds, goals));
  assert.equal(farmObjectiveText(asFarmObjective(summary)), '28,5 mm visés, 2 planches sur 3 ont un objectif');
});

test('ferme 2 : les jours d’objectif manquants, une seule planche, le retrait, le zéro et l’absence d’objectif (règles 1, 4 et 5)', () => {
  // La serre 21 mm posés le jeudi seulement : quatre jours sur sept pour chacune de ses deux planches.
  const thursday = summaryOf(FARM_2, [onPlot(F2_SERRE, 21, 3)]);
  assert.equal(thursday.objectiveMm, 12, 'l’objectif posé en cours de période compte pour ses jours restants (D-036)');
  assert.deepEqual(thursday.objectiveBeds, { withObjective: 2, total: 3, bedDays: 14 });
  assert.equal(historyObjectiveScopeText(thursday), '2 planches sur 3 ont un objectif · objectif posé sur 8/14 journées-planche');

  // Une seule planche a un objectif : elle est nommée au singulier.
  const single = summaryOf(FARM_2, [onBed(F2_S, 14)], { events: [irrigation('s', 1, [[F2_S, 5], [F2_C, 40]])] });
  assert.equal(single.objectiveMm, 14);
  assert.equal(historyObjectiveScopeText(single), '1 planche sur 3 a un objectif');
  assert.equal(historyGapScopeText(single), 'Eau reçue par cette planche : 5 mm');
  assert.equal(single.gapToObjectiveMm, 9);

  // Le champ visé 7 mm, retiré le jeudi : il a un objectif sur la période, ses trois jours couverts (règle 1).
  const cleared = summaryOf(FARM_2, [onPlot(F2_SERRE, 21), onBed(F2_C, 7), onBed(F2_C, null, 3)]);
  assert.deepEqual(cleared.objectiveBeds, { withObjective: 3, total: 3, bedDays: 21 });
  near(cleared.objectiveMm, (21 * 50 + 21 * 150 + 3 * 800) / 1000, 'le champ compte ses 3 mm');
  assert.equal(historyObjectiveScopeText(cleared), 'objectif posé sur 17/21 journées-planche');

  // Un objectif de 0 mm est un objectif (D-003) : toutes les planches en ont un, la moyenne court sur la ferme entière.
  const zero = summaryOf(FARM_2, [onPlot(F2_SERRE, 21), onBed(F2_C, 0)]);
  assert.deepEqual(zero.objectiveBeds, { withObjective: 3, total: 3, bedDays: 21 });
  near(zero.objectiveMm, 4.2, '(21 × 200 + 0 × 800) / 1 000');
  assert.equal(historyObjectiveScopeText(zero), null);

  // Aucun objectif : ni objectif ni écart, et la page le dit (D-036).
  const none = summaryOf(FARM_2, [], { events: [irrigation('n', 1, [[F2_S, 5]])], weather: rain(2) });
  assert.equal(none.objectiveMm, null);
  assert.equal(none.gapToObjectiveMm, null);
  assert.deepEqual(none.objectiveBeds, { withObjective: 0, total: 3, bedDays: 0 });
  assert.equal(historyObjectiveScopeText(none), 'Aucun objectif sur la période');
  assert.equal(historyGapScopeText(none), null);
});

test('l’écart de la ferme 2 se chiffre sur l’eau des planches de l’objectif : la pluie et l’eau des autres ne comptent pas (règle 3)', () => {
  const goals = [onPlot(F2_SERRE, 21), onBed(F2_T, 35, 2)];
  const events = [irrigation('f2', 1, [[F2_S, 12], [F2_T, 12], [F2_C, 30]])];

  // La pluie du dimanche manque : la ferme n'a pas sa pluie complète, mais les planches de l'objectif sont sous la serre.
  const sunday = summaryOf(FARM_2, goals, { events, weather: rain(2, [WEEK.endDate]) });
  assert.equal(sunday.actualRainAvailability.complete, false);
  assert.equal(sunday.irrigationAndRainMm, 12);
  assert.equal(sunday.gapToObjectiveMm, 16.5, 'sous abri, la pluie vaut zéro ; l’écart reste calculable');

  // Les planches de l'objectif comptent une planche de plein champ : sans la pluie du dimanche, pas d'écart.
  const mixed = [onBed(F2_S, 21), onBed(F2_C, 7)];
  const open = summaryOf(FARM_2, mixed, { events, weather: rain(2, [WEEK.endDate]) });
  assert.deepEqual(open.objectiveBeds, { withObjective: 2, total: 3, bedDays: 14 });
  assert.equal(open.irrigationAndRainMm, null);
  assert.equal(open.gapToObjectiveMm, null);
  assert.equal(historyGapScopeText(open), null, 'rien à dire d’une eau inconnue');
  // Avec la pluie de toute la semaine : (12 × 50 + 30 × 800) / 850 d'irrigation, 14 × 800 / 850 de pluie.
  const complete = summaryOf(FARM_2, mixed, { events, weather: rain(2) });
  near(complete.irrigationAndRainMm, (12 * 50 + 30 * 800 + 14 * 800) / 850, 'eau reçue par S et le champ');
  near(complete.gapToObjectiveMm, (21 * 50 + 7 * 800) / 850 - (12 * 50 + 30 * 800 + 14 * 800) / 850, 'écart');

  // Une planche arrosée hors du plan de la saison : elle compte dans l'eau de la ferme, pas dans l'écart.
  const outside = { ...F2_S, id: 'f2-hors-plan', area: 50 };
  const extra = summaryOf(FARM_2, goals, { events: [...events, irrigation('hors', 3, [[outside, 40]])], weather: rain(2) });
  near(extra.irrigationMm, (12 * 50 + 12 * 150 + 30 * 800 + 40 * 50) / 1050, 'la ferme compte la planche hors plan');
  assert.equal(extra.irrigationAndRainMm, 12);
  assert.equal(extra.gapToObjectiveMm, 16.5);
});

test('une période de deux semaines : chaque planche compte ses jours couverts, la moyenne porte sur celles qui en ont (règles 1 et 2)', () => {
  const jardin = plot('m-jardin', 'm', 'garden');
  const x = bed('m-x', jardin, 100);
  const y = bed('m-y', jardin, 300);
  const z = bed('m-z', jardin, 600);
  const farm: Farm = { plots: [jardin], beds: [x, y, z] };
  const nextMonday = addDaysToDateKey(WEEK.startDate, 7);
  // Y vise 7 mm la première semaine et son objectif est retiré le second lundi ; X vise 14 mm la seconde semaine.
  const goals = [onBed(y, 7), onBed(y, null, 0, nextMonday), onBed(x, 14, 0, nextMonday)];
  const period = resolveHistoryPeriod(2026, { mode: 'custom', customStartDate: WEEK.startDate, customEndDate: addDaysToDateKey(nextMonday, 6) });
  const summary = summaryOf(farm, goals, { period, weather: [] });
  // (14 × 100 + 7 × 300) / 400 = 8,75 mm ; la somme jour par jour sur toute la surface disait 2,1 + 1,4 = 3,5 mm.
  assert.equal(summary.objectiveMm, 8.75);
  assert.deepEqual(summary.objectiveBeds, { withObjective: 2, total: 3, bedDays: 28 });
  assert.deepEqual(summary.objectiveAvailability, { availableBedDays: 14, totalBedDays: 42, complete: false });
  assert.equal(historyObjectiveScopeText(summary), '2 planches sur 3 ont un objectif · objectif posé sur 14/28 journées-planche');
});

/** Une ferme de deux parcelles, quatre jardins dont une serre et un jardin à classer, cinq planches. */
const P_JARDIN = plot('p-jardin', 'p1', 'garden');
const P_SERRE = plot('p-serre', 'p1', 'greenhouse');
const P_CHAMP = plot('p-champ', 'p2', 'garden');
const P_CLASSER = plot('p-classer', 'p2', 'unclassified');
const B1 = bed('b1', P_JARDIN, 120);
const B2 = bed('b2', P_JARDIN, 80);
const B3 = bed('b3', P_SERRE, 60);
const B4 = bed('b4', P_CHAMP, 500);
const B5 = bed('b5', P_CLASSER, 40);
const FARM_P: Farm = { plots: [P_JARDIN, P_SERRE, P_CHAMP, P_CLASSER], beds: [B1, B2, B3, B4, B5] };
const ET0 = [4.0, 4.2, 3.8, 4.5, 5.0, 4.6, 3.9];

/** L'objectif automatique allumé avant la semaine, d'après l'ET0 (D-309) ; le jardin à classer n'a pas de valeur (F769). */
function automatic(overrides: Partial<AutomaticObjectiveInput> = {}) {
  return (target: Bed): AutomaticObjectiveInput => ({
    settings: [{ enabled: true, createdAt: '2026-09-01T07:00:00.000Z' }],
    today: '2026-09-14',
    et0Readings: DAYS.map((date, index) => ({ date, reanalysisMm: ET0[index], forecastMm: null })),
    plotMode: FARM_P.plots.find((item) => item.id === target.plotId)?.mode ?? 'unclassified',
    shelterFactors: [],
    cropNeed: { status: 'off' },
    ...overrides,
  });
}

test('une semaine de l’Historique dit l’objectif d’« Aujourd’hui » : même chiffre, mêmes planches, même phrase, à chaque niveau', () => {
  const scenarios: [string, GoalRevisionLike[], ((target: Bed) => AutomaticObjectiveInput)?][] = [
    ['aucun objectif', []],
    ['« Toute la ferme » seule', [onFarm(10)]],
    ['S1-O1 : « Toute la ferme » et la serre', [onFarm(2.7), onPlot(P_SERRE, 7)]],
    ['un jardin posé le mercredi, une planche du champ', [onPlot(P_JARDIN, 14, 2), onBed(B4, 21)]],
    ['une parcelle, une planche retirée le jeudi', [onZone('p1', 7), onBed(B1, 28), onBed(B1, null, 3)]],
    ['« Toute la ferme » retirée le vendredi', [onFarm(12), onFarm(null, 4), onBed(B3, 9, 5)]],
    ['un objectif de 0 mm', [onBed(B2, 0)]],
    ['l’objectif automatique seul', [], automatic()],
    ['l’objectif automatique et des objectifs saisis', [onBed(B4, 35, 2), onPlot(P_SERRE, 0)], automatic()],
    ['l’objectif automatique éteint le jeudi', [onBed(B1, 14)], automatic({
      settings: [{ enabled: true, createdAt: '2026-09-01T07:00:00.000Z' }, { enabled: false, createdAt: '2026-09-10T06:00:00.000Z' }],
    })],
    ['l’objectif automatique sans l’ET0 du dimanche', [], automatic({
      et0Readings: DAYS.slice(0, 6).map((date, index) => ({ date, reanalysisMm: ET0[index], forecastMm: null })),
    })],
  ];
  const levels: [string, HistoryScope, Bed[]][] = [
    ['ferme', FARM, FARM_P.beds],
    ['parcelle p1', { level: 'zone', zoneId: 'p1', plotId: null, bedId: null }, [B1, B2, B3]],
    ['jardin p-jardin', { level: 'plot', zoneId: 'p1', plotId: 'p-jardin', bedId: null }, [B1, B2]],
  ];
  for (const [name, goals, automaticInput] of scenarios) {
    for (const [level, scope, scopeBeds] of levels) {
      const label = `${name}, ${level}`;
      const summary = summaryOf(FARM_P, goals, { scope, scopeBeds, automatic: automaticInput });
      const today = todayObjective(scopeBeds, goals, automaticInput);
      if (today.objectiveMm === null) assert.equal(summary.objectiveMm, null, label);
      else near(summary.objectiveMm, today.objectiveMm, label);
      assert.deepEqual([summary.objectiveBeds.withObjective, summary.objectiveBeds.total], [today.withObjective, today.total], label);
      assert.equal(farmObjectiveText(asFarmObjective(summary)), farmObjectiveText(today), label);
    }
  }
  // Le jardin à classer n'a jamais de valeur automatique : il est compté à part, jamais à zéro.
  const automaticOnly = summaryOf(FARM_P, [], { automatic: automatic() });
  assert.deepEqual(automaticOnly.objectiveBeds, { withObjective: 4, total: 5, bedDays: 28 });
  assert.equal(historyObjectiveScopeText(automaticOnly), '4 planches sur 5 ont un objectif');
});

test('l’export CSV garde ses colonnes : l’objectif, l’eau que l’écart compare et l’écart se lisent ensemble', () => {
  const goals = [onPlot(F2_SERRE, 21), onBed(F2_T, 35, 2)];
  const summary = summaryOf(FARM_2, goals, {
    events: [irrigation('f2', 1, [[F2_S, 12], [F2_T, 12], [F2_C, 30]])],
    weather: rain(2),
  });
  const snapshot: IrrigationSnapshot = {
    configuration: { seasonFirst: 2025, seasonLast: 2027 },
    structure: { id: 'f2', name: 'Ferme 2', legalCity: 'Tronget', legalPostcode: '03240', legalCountry: 'FR' },
    zones: [{ id: 'f2-parcelle', name: 'Parcelle', area: 1000, seasons: [2026] }],
    plots: FARM_2.plots,
    beds: FARM_2.beds,
    source: 'cache',
    lastSuccessfulReadAt: '2026-09-07T00:00:00Z',
  };
  const csv = buildIrrigationHistoryCsv({
    season: 2026, period: WEEK, scope: FARM, scopeLabel: 'Ferme 2', farmName: 'Ferme 2', summary, items: [], snapshot,
  });
  const [header, row] = csv.replace('﻿', '').split('\r\n').map((line) => line.split(';'));
  const cell = (name: string) => row[header.indexOf(name)];
  assert.equal(cell('Objectif hydrique (mm)'), '28,5');
  assert.equal(cell('Irrigation + pluie réelle (mm)'), '12', 'l’eau des planches de l’objectif, celle que l’écart compare');
  assert.equal(cell("Écart à l'objectif (mm)"), '16,5');
  assert.equal(cell('Apport irrigation (mm)'), '26,4', 'l’irrigation de la ferme reste celle de toute sa surface');
  assert.equal(cell('Pluie réelle (mm)'), '11,2');
});

test('aucune page ne refait la moyenne de l’objectif : l’Historique et les séries appellent la fonction unique (règle 2 de la PR 3)', () => {
  const summary = readFileSync('lib/domain/irrigation-history/summary.ts', 'utf8');
  assert.match(summary, /const objective = farmObjective\(scopeBeds\.map\(/);
  assert.doesNotMatch(summary, /weightedDaily|objectiveMm \+= /, 'plus de somme jour par jour sur toute la surface');
  const series = readFileSync('lib/domain/series/water.ts', 'utf8');
  assert.match(series, /const seriesObjective = farmObjective\(received\.map\(/);
  assert.doesNotMatch(series, /objectiveMillimeterSquareMeters/);
  const dashboard = readFileSync('app/irrigation/irrigation-history-dashboard.tsx', 'utf8');
  assert.match(dashboard, /historyObjectiveScopeText\(dashboard\.summary\)/);
  assert.match(dashboard, /historyGapScopeText\(dashboard\.summary\)/);
  assert.doesNotMatch(dashboard, /comptées à 0|Moyenne sur toute la surface/, 'la phrase F444 a disparu');
  assert.match(readFileSync('app/irrigation/series-water-view.tsx', 'utf8'), /farmObjectiveScopeText\(item\.objectiveBeds\)/);
});
