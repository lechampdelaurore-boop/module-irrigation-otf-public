import assert from 'node:assert/strict';
import test from 'node:test';
import { FEATURE_IDS, type FeatureId } from '../lib/domain/features/catalogue';
import type { IrrigationEventRecord } from '../lib/domain/irrigation-event-record';
import type { StoredProposal } from '../lib/domain/planning/contract';
import type { SoilGaugeZone } from '../lib/domain/soil-reserve/gauge-view';
import { dayTimeline, LATE_DAY_GROUP_MIN_COUNT, lateItems } from '../lib/domain/today/day-plan';
import { longDayTitle, todayHeadline } from '../lib/domain/today/headline';
import { reliabilityChecks, reliabilityLines, type ReliabilityInputs } from '../lib/domain/today/reliability';
import { todaySoil } from '../lib/domain/today/soil';
import { lateIrrigationLines, todayTodoLines, type TodayIrrigationLine } from '../lib/domain/today/today-irrigations';
import { todayView, weatherBlock, type TodayBlock, type TodayInputs } from '../lib/domain/today/today-view';
import { waterBlock } from '../lib/domain/today/water';
import { WEATHER_SCALE_MINIMUM_CELSIUS, weatherScale } from '../lib/domain/today/weather-days';
import { todayWeek, WEEK_GARDENS_SHOWN, type TodayWeekBed } from '../lib/domain/today/week';
import type { WaterInfrastructure, WaterReservoir } from '../lib/domain/water-resources';
import type { WeatherAlertCriterion, WeatherAlertForecastDay } from '../lib/domain/weather/weather-alerts';

/**
 * Le tableau de bord « Aujourd'hui », PR 1 : les valeurs à dessiner
 * (docs/aujourdhui-tableau-de-bord-contract.md, sections 3 à 5, précisions
 * T1 à T6). Rien ne se calcule de nouveau : chaque test vérifie que le
 * dessin dit ce que disent déjà les phrases et les tableaux existants.
 * Aujourd'hui = jeudi 12 novembre 2026, 6 h 00 à la ferme.
 */

const ALL: FeatureId[] = [...FEATURE_IDS];
const NOW = new Date('2026-11-12T05:00:00.000Z');
const BEDS = new Map([['b1', 'P1'], ['b2', 'P2'], ['b3', 'P3'], ['b4', 'P4'], ['b10', 'P10']]);

function event(id: string, startAt: string, minutes: number, overrides: { beds?: string[]; mm?: number; kind?: 'drip' | 'sprinkler' } = {}): IrrigationEventRecord {
  const endAt = new Date(Date.parse(startAt) + minutes * 60_000).toISOString();
  return {
    id: `event-${id}`,
    season: 2026,
    status: 'planned',
    note: null,
    remainingCanceledAt: null,
    canceledAt: null,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    equipment: {
      id,
      status: 'planned',
      plannedStartAt: startAt,
      plannedEndAt: endAt,
      plannedDurationSeconds: minutes * 60,
      timerState: null,
      timerStartedAt: null,
      remainingCanceledAt: null,
      canceledAt: null,
      equipmentSnapshot: { id: 'eq', name: 'Goutte-à-goutte B', kind: overrides.kind ?? 'drip', mobility: 'fixed' },
      settingSnapshot: { name: 'Réglage 1' },
      applications: (overrides.beds ?? ['b1']).map((otfBedId) => ({ otfBedId, plannedAmountMm: overrides.mm ?? 12 })),
    },
  } as unknown as IrrigationEventRecord;
}

function proposal(storedId: string, startAt: string): StoredProposal {
  return {
    storedId,
    status: 'proposed',
    startAt,
    endAt: new Date(Date.parse(startAt) + 3600_000).toISOString(),
    durationSeconds: 3600,
    doseMm: 8,
    equipmentName: 'Asperseur A',
    settingName: 'Buse 2',
    applications: [{ otfBedId: 'b2' }],
  } as unknown as StoredProposal;
}

const forecast = (date: string, minimum: number | null = 6, maximum: number | null = 14, rain: number | null = 0): WeatherAlertForecastDay => ({
  date, minimumTemperatureCelsius: minimum, maximumTemperatureCelsius: maximum, precipitationMm: rain, forecastedAt: '2026-11-12T04:00:00.000Z',
});
const THREE_DAYS = [forecast('2026-11-12'), forecast('2026-11-13', 4, 12, 3), forecast('2026-11-14')];

function reservoir(id: string, name: string, observedAt: string | null, volume: number | null = 12): WaterReservoir {
  return {
    id, name, type: 'tank', capacityCubicMeters: 20, currentVolumeCubicMeters: volume, currentVolumeObservedAt: observedAt,
    minimumSafetyCubicMeters: 0, exposedSurfaceSquareMeters: 0, receivesRain: false, evaporationEnabled: false,
    evaporationCoefficient: 1, status: 'active', notes: null,
  };
}

function infrastructure(reservoirs: WaterReservoir[]): WaterInfrastructure {
  return { resources: [], resourceLimits: [], reservoirs, resourceReservoirLinks: [], reservoirLinks: [], defaultSupply: null, movements: [] };
}

function inputs(overrides: Partial<TodayInputs> = {}): TodayInputs {
  return {
    enabled: ALL,
    now: NOW,
    weather: { forecasts: THREE_DAYS, frost: [], criteria: [] },
    events: [],
    lateToleranceMinutes: 30,
    plan: { computedAt: '2026-11-12T05:02:00.000Z', proposals: [] },
    bedNames: BEDS,
    infrastructure: infrastructure([]),
    reliability: { actualRainMissingDates: [], soilGardensNeverObserved: [], speciesWithoutReference: [] },
    week: null,
    soil: null,
    ...overrides,
  };
}

function block<K extends TodayBlock['kind']>(blocks: TodayBlock[], kind: K): Extract<TodayBlock, { kind: K }> {
  const found = blocks.find((item) => item.kind === kind);
  assert.ok(found, `bloc ${kind}`);
  return found as Extract<TodayBlock, { kind: K }>;
}

function lines(events: IrrigationEventRecord[], proposals: StoredProposal[] = [], now = NOW): { late: TodayIrrigationLine[]; todo: TodayIrrigationLine[] } {
  const base = { enabled: ALL, now, events, lateToleranceMinutes: 30, bedNames: BEDS };
  return { late: lateIrrigationLines(base), todo: todayTodoLines({ ...base, proposals }) };
}

test('les lignes portent les valeurs à dessiner : heure, jour, durée, dose, planches et type de matériel', () => {
  const { todo } = lines([event('e1', '2026-11-12T06:00:00.000Z', 90, { beds: ['b2', 'b1'], kind: 'sprinkler', mm: 9.5 })], [proposal('p1', '2026-11-12T17:00:00.000Z')]);
  assert.deepEqual(todo.map((line) => [line.hour, line.day, line.durationText, line.doseText, line.bedsText, line.equipmentKind, line.equipmentName, line.settingName]), [
    ['7 h', '2026-11-12', '1 h 30', '9,5 mm', 'planches P1 et P2', 'sprinkler', 'Goutte-à-goutte B', 'Réglage 1'],
    ['18 h', '2026-11-12', '1 h', '8 mm', 'planche P2', null, 'Asperseur A', 'Buse 2'],
  ]);
  // Les phrases d'avant ne changent pas (lot 2, F29).
  assert.equal(todo[0].detail, 'planches P1 et P2 · 1 h 30 · 9,5 mm');
});

test('la frise : 5 h à 22 h, l’heure actuelle, une barre par irrigation du jour à sa place et à sa durée', () => {
  const { late, todo } = lines([event('e1', '2026-11-12T06:00:00.000Z', 90)], [proposal('p1', '2026-11-12T17:00:00.000Z')]);
  const timeline = dayTimeline([...late, ...todo], NOW);
  assert.ok(timeline);
  assert.equal(timeline.startHour, 5);
  assert.equal(timeline.endHour, 22);
  // 17 heures de frise, 1 020 minutes : 7 h est à 120 minutes du début.
  assert.deepEqual(timeline.bars.map((bar) => [bar.tone, bar.leftPercent, bar.widthPercent]), [['planned', 11.8, 8.8], ['proposed', 76.5, 5.9]]);
  assert.equal(timeline.bars[0].label, '7 h, Planifiée, Goutte-à-goutte B · Réglage 1');
  assert.deepEqual(timeline.now, { label: '6 h', percent: 5.9 });
  assert.deepEqual(timeline.ticks.map((tick) => tick.label), ['6 h', '8 h', '10 h', '12 h', '14 h', '16 h', '18 h', '20 h', '22 h']);
  assert.equal(timeline.ticks.at(-1)?.percent, 100);
  assert.deepEqual(timeline.legend, [{ tone: 'planned', label: 'Planifiée' }, { tone: 'proposed', label: 'À valider' }, { tone: 'past', label: 'Déjà passé' }]);
});

test('la légende de la frise dit chaque couleur présente, « Non faite » en tête, et seulement celles-là', () => {
  // 16 h à la ferme : minuit est passé sans démarrage, 15 h a dépassé sa tolérance, 18 h attend.
  const at = new Date('2026-11-12T15:00:00.000Z');
  const events = [event('e1', '2026-11-11T23:00:00.000Z', 60), event('e2', '2026-11-12T14:00:00.000Z', 120), event('e3', '2026-11-12T17:00:00.000Z', 60)];
  const { late, todo } = lines(events, [], at);
  const timeline = dayTimeline([...late, ...todo], at);
  assert.deepEqual(timeline?.bars.map((bar) => bar.tone), ['missed', 'late', 'planned']);
  assert.deepEqual(timeline?.legend.map((item) => [item.tone, item.label]), [
    ['missed', 'Non faite'], ['late', 'En retard'], ['planned', 'Planifiée'], ['past', 'Déjà passé'],
  ]);
  // La nuit, l'heure actuelle sort de la frise : rien de hachuré, pas de « Déjà passé ».
  const night = new Date('2026-11-12T02:00:00.000Z');
  const early = dayTimeline(lines([event('e1', '2026-11-12T03:00:00.000Z', 30)], [], night).todo, night);
  assert.deepEqual(early?.legend, [{ tone: 'planned', label: 'Planifiée' }]);
});

test('la frise s’élargit pour une irrigation de 4 h ou qui finit après 22 h, et disparaît sans irrigation du jour', () => {
  const early = dayTimeline(lines([event('e1', '2026-11-12T03:00:00.000Z', 30)], [], new Date('2026-11-12T02:00:00.000Z')).todo, new Date('2026-11-12T02:00:00.000Z'));
  assert.equal(early?.startHour, 4);
  assert.equal(early?.now, null, '3 h du matin sort de la frise');
  const late = dayTimeline(lines([event('e1', '2026-11-12T20:30:00.000Z', 120)]).todo, NOW);
  assert.equal(late?.endHour, 24);
  assert.equal(dayTimeline(lines([event('e1', '2026-11-13T06:00:00.000Z', 60)]).todo, NOW), null);
});

test('T2 : plus de trois retards d’un même jour passé se replient en une ligne ; trois restent en cartes ; ceux du jour aussi', () => {
  const yesterday = ['04', '06', '10', '14', '19'].map((hour, index) => event(`y${index}`, `2026-11-11T${hour}:00:00.000Z`, 60, { beds: [`b${index % 4 + 1}`] }));
  const before = ['06', '08', '10'].map((hour, index) => event(`d${index}`, `2026-11-09T${hour}:00:00.000Z`, 60));
  const thisMorning = event('t1', '2026-11-12T04:00:00.000Z', 30);
  const { late } = lines([thisMorning, ...yesterday, ...before]);
  assert.equal(late.length, 9);
  const items = lateItems(late, NOW);
  assert.deepEqual(items.map((item) => item.kind), ['line', 'line', 'line', 'day', 'line']);
  const group = items[3];
  assert.equal(group.kind, 'day');
  assert.equal(group.count, 5);
  assert.ok(group.count >= LATE_DAY_GROUP_MIN_COUNT);
  assert.equal(group.title, 'Hier : 5 irrigations à rattraper');
  assert.equal(group.detail, 'de 5 h à 20 h, sur 4 planches');
  assert.deepEqual(group.open, { page: 'arrosages', label: 'Voir les 5 sur « Arrosages »' });
  assert.deepEqual(group.lines.map((line) => line.eventEquipmentId), ['y0', 'y1', 'y2', 'y3', 'y4']);
  // Quatre un autre jour que la veille : son nom court.
  const four = lateItems(lines([...before, event('d3', '2026-11-09T12:00:00.000Z', 60)]).late, NOW);
  assert.deepEqual(four.map((item) => item.kind === 'day' ? item.title : item.kind), ['Lun. 9 nov. : 4 irrigations à rattraper']);
  // Sans les arrosages cochés, les cartes s'ouvrent sur le planning.
  const planningOnly = lateIrrigationLines({ enabled: ['planning'], now: NOW, events: yesterday, lateToleranceMinutes: 30, bedNames: BEDS });
  const onPlanning = lateItems(planningOnly, NOW)[0];
  assert.equal(onPlanning.kind === 'day' ? onPlanning.open.label : null, 'Voir les 5 sur « Planning de la semaine »');
});

test('la météo dessinée : l’échelle commune, le trait du zéro, l’icône, la pluie prévue et ce qui est annoncé chaque jour', () => {
  const frost = [{ date: '2026-11-14', minimumCelsius: -1, crops: ['Laitue', 'Fenouil', 'Chou', 'Poireau'].map((name) => ({ name, alertCelsius: 0, underShelter: false, alreadyAlerted: false })) }];
  const forecasts = [forecast('2026-11-12'), forecast('2026-11-13', 4, 12, 3), forecast('2026-11-14', -1, 9)];
  const result = weatherBlock({ forecasts, frost, criteria: [] }, ALL, NOW);
  assert.deepEqual(result.scale, { minimumCelsius: -4, maximumCelsius: 20, zeroPercent: 16.7 });
  assert.deepEqual(result.days.map((day) => [day.label, day.icon, day.tone, day.range]), [
    ['Aujourd’hui', 'sun', 'calm', { fromPercent: 41.7, toPercent: 75 }],
    ['ven. 13 nov.', 'rain', 'calm', { fromPercent: 33.3, toPercent: 66.7 }],
    ['sam. 14 nov.', 'frost', 'alert', { fromPercent: 12.5, toPercent: 54.2 }],
  ]);
  assert.deepEqual(result.days[2].notes, ['Gel à -1 °C : Laitue, Fenouil, Chou et 1 autre']);
  assert.equal(result.days[1].precipitationMm, 3);
  // Une alerte de l'exploitation se note le jour où elle se déclenche.
  const criterion: WeatherAlertCriterion = { id: 'c1', version: 1, field: 'maximum-temperature', direction: 'above', threshold: 30, horizonDays: 7, active: true, label: 'Chaleur' };
  const hot = weatherBlock({ forecasts: [forecast('2026-11-12'), forecast('2026-11-13', 10, 31.5), forecast('2026-11-14')], frost: null, criteria: [criterion] }, ['alertes-meteo'], NOW);
  assert.deepEqual(hot.days.map((day) => day.notes), [[], ['Chaleur : température maximale prévue 31,5 °C'], []]);
  // L'échelle s'élargit aux valeurs prévues.
  assert.deepEqual(weatherScale([forecast('2026-11-12', -7.4, 24.2)]), { minimumCelsius: -8, maximumCelsius: 25, zeroPercent: 24.2 });
  assert.equal(weatherScale([]).minimumCelsius, WEATHER_SCALE_MINIMUM_CELSIUS);
});

test('D-003 : un jour sans prévision se dessine inconnu, jamais calme', () => {
  const result = weatherBlock({ forecasts: THREE_DAYS.slice(0, 2), frost: [], criteria: [] }, ALL, NOW);
  const missing = result.days[2];
  assert.deepEqual([missing.tone, missing.icon, missing.range, missing.minimumCelsius], ['unknown', 'unknown', null, null]);
});

test('l’eau en jauges : remplissage, relevé vieux de plus de sept jours, volume jamais saisi, limite du jour', () => {
  const water: WaterInfrastructure = {
    ...infrastructure([
      reservoir('r1', 'Cuve', '2026-11-12T05:00:00.000Z', 12),
      reservoir('r2', 'Bassin', '2026-11-04T08:00:00.000Z', 25),
      reservoir('r3', 'Citerne', null, null),
    ]),
    resources: [{ id: 'f1', name: 'Forage', type: 'borehole', nominalFlowCubicMetersPerHour: 3, status: 'active', availableFrom: null, availableUntil: null, notes: null }],
    resourceLimits: [{ id: 'l1', resourceId: 'f1', enabled: true, maxCubicMetersPerDay: 12, validFrom: '2026-01-01', validUntil: null, referenceNote: null, createdAt: '2026-01-01T00:00:00.000Z' }],
    movements: [{ kind: 'direct_irrigation_withdrawal', resourceId: 'f1', occurredAt: '2026-11-12T04:30:00.000Z', volumeDeltaCubicMeters: -4 }] as unknown as WaterInfrastructure['movements'],
  };
  const result = waterBlock(water, NOW);
  assert.deepEqual(result.reservoirs.map((gauge) => [gauge.name, gauge.volumeText, gauge.capacityText, gauge.fillPercent, gauge.observedText, gauge.stale]), [
    ['Bassin', '25 m³', 'sur 20 m³', 100, 'observé le 4 nov. 2026 (8 jours)', true],
    ['Citerne', null, 'sur 20 m³', null, 'volume jamais saisi', true],
    ['Cuve', '12 m³', 'sur 20 m³', 60, 'observé aujourd’hui', false],
  ]);
  assert.deepEqual(result.limits.map((gauge) => [gauge.name, gauge.takenPercent, gauge.text, gauge.takenText]), [
    ['Forage', 33, '8 m³ restants aujourd’hui sur 12 m³', '4 m³ prélevés'],
  ]);
  // Les phrases d'avant ne changent pas (lot 2, cas 10 et 10 bis).
  assert.deepEqual(result.lines, [
    'Bassin : 25 m³ sur 20 m³, observé le 4 nov. 2026 (8 jours).',
    'Citerne : volume jamais saisi.',
    'Cuve : 12 m³ sur 20 m³, observé aujourd’hui.',
    'Forage : 8 m³ restants aujourd’hui sur 12 m³ (4 m³ prélevés).',
  ]);
});

const bed = (plotId: string, plotName: string, area: number, values: Partial<TodayWeekBed> = {}): TodayWeekBed => ({
  plotId, plotName, sheltered: false, areaSquareMeters: area, objectiveMm: 20, actualRainMm: 2, actualIrrigationMm: 0, realRemainingMm: 18, ...values,
});

test('T4 : la semaine pondère les millimètres par la surface, pour la ferme et par jardin', () => {
  const week = todayWeek({
    weekStart: '2026-11-09',
    weekEnd: '2026-11-15',
    beds: [
      bed('g1', 'Jardin Nord', 10, { actualIrrigationMm: 8, realRemainingMm: 10 }),
      bed('g1', 'Jardin Nord', 30, { actualIrrigationMm: 4, realRemainingMm: 14 }),
      bed('g2', 'Tunnel', 20, { sheltered: true, objectiveMm: 25, actualRainMm: 0, actualIrrigationMm: 14, realRemainingMm: 11 }),
    ],
    water: { weekCubicMeters: 18.04, todayCubicMeters: 4, incomplete: false },
  });
  assert.ok(week);
  assert.equal(week.label, 'du lun. 9 nov. au dim. 15 nov.');
  assert.equal(week.scaleMaxMm, 25);
  assert.deepEqual(week.shown.map((row) => [row.name, row.objectiveMm, row.irrigationMm, row.rainMm, row.remainingMm, row.text, row.sheltered]), [
    ['Jardin Nord', 20, 5, 2, 13, '7 / 20 mm', false],
    ['Tunnel', 25, 14, 0, 11, '14 / 25 mm', true],
  ]);
  assert.deepEqual(week.shown[1].bars, { irrigationPercent: 56, rainPercent: 0, objectivePercent: 100 });
  assert.deepEqual(week.shown[0].bars, { irrigationPercent: 20, rainPercent: 8, objectivePercent: 80 });
  // La ferme : (20×10 + 20×30 + 25×20) / 60 = 21,7 mm d'objectif.
  assert.equal(week.farm.text, '9,3 / 21,7 mm');
  assert.deepEqual(week.tiles, {
    objective: '21,7 mm',
    received: '9,3 mm',
    receivedDetail: '8 mm d’irrigation, 1,3 mm de pluie mesurée',
    remaining: '12,3 mm',
    water: '18,04 m³',
    waterToday: 'dont 4 m³ aujourd’hui',
  });
});

test('D-003 : une pluie ou un objectif inconnus laissent le total inconnu, jamais zéro', () => {
  const week = todayWeek({
    weekStart: '2026-11-09',
    weekEnd: '2026-11-15',
    beds: [bed('g1', 'Jardin Nord', 10, { actualRainMm: null, realRemainingMm: null, actualIrrigationMm: 6 }), bed('g2', 'Sud', 10, { objectiveMm: null, realRemainingMm: null })],
    water: { weekCubicMeters: 3, todayCubicMeters: 0, incomplete: true },
  });
  assert.ok(week);
  assert.deepEqual(week.shown.map((row) => row.text), ['6 mm irrigués / 20 mm, pluie inconnue', '2 mm reçus, objectif non fixé']);
  assert.deepEqual([week.tiles.objective, week.tiles.received, week.tiles.remaining], [null, null, null]);
  assert.equal(week.tiles.receivedDetail, '3 mm d’irrigation, pluie inconnue');
  assert.equal(week.tiles.water, 'au moins 3 m³');
  assert.equal(week.shown[0].bars.objectivePercent, 100 * 20 / 20);
  assert.equal(todayWeek({ weekStart: '2026-11-09', weekEnd: '2026-11-15', beds: [], water: null }), null);
});

test('au-delà de huit jardins, les autres derrière « Voir les n autres jardins »', () => {
  const beds = Array.from({ length: WEEK_GARDENS_SHOWN + 2 }, (_, index) => bed(`g${index}`, `Jardin ${index}`, 10));
  const week = todayWeek({ weekStart: '2026-11-09', weekEnd: '2026-11-15', beds, water: null });
  assert.equal(week?.shown.length, WEEK_GARDENS_SHOWN);
  assert.equal(week?.moreLabel, 'Voir les 2 autres jardins');
  assert.equal(week?.tiles.water, null);
});

function plot(name: string, garden: Partial<SoilGaugeZone['plots'][number]['garden']>): SoilGaugeZone['plots'][number] {
  return {
    plotId: `p-${name}`, name, sheltered: false, week: [], observation: null, beds: [],
    garden: { percent: null, lowest: null, countedBeds: 0, unknownBeds: 0, withoutCrop: [], ...garden },
  };
}

test('la réserve du sol par jardin : la part estimée, la plus sèche, l’inconnu dit inconnu (D-003, D-041)', () => {
  const soil = todaySoil({ zones: [{ plots: [
    plot('Tunnel', { percent: 72.4, countedBeds: 3, lowest: { bedId: 'b3', bedName: 'T3', percent: 41.6 } }),
    plot('Nord', { percent: null, unknownBeds: 2 }),
    plot('Verger', {}),
    plot('Sud', { percent: 112, countedBeds: 1, lowest: { bedId: 'b9', bedName: 'S1', percent: 112 } }),
  ] }] });
  assert.deepEqual(soil.shown.map((garden) => [garden.name, garden.text, garden.barPercent, garden.lowestText]), [
    ['Tunnel', '72 %', 72, 'la plus sèche : T3, 42 %'],
    ['Nord', 'inconnue', null, null],
    ['Verger', 'aucune planche cultivée', null, null],
    ['Sud', '112 %', 100, null],
  ]);
  assert.equal(soil.unavailable, null);
  assert.deepEqual(todaySoil({ unavailable: 'Aucune planche cultivée.' }), { shown: [], hidden: [], moreLabel: null, unavailable: 'Aucune planche cultivée.' });
});

const FRESH_RELIABILITY: Omit<ReliabilityInputs, 'enabled' | 'now'> = {
  reservoirs: [{ id: 'r1', name: 'Cuve', observedAt: '2026-11-11T08:00:00.000Z' }],
  actualRainMissingDates: [],
  soilGardensNeverObserved: [],
  speciesWithoutReference: [],
  planComputedAt: '2026-11-12T05:02:00.000Z',
};

test('T6 : l’anneau de la fiabilité, une ligne par donnée suivie, à jour ou à rafraîchir avec ses gestes', () => {
  const input: ReliabilityInputs = {
    ...FRESH_RELIABILITY,
    enabled: ALL,
    now: NOW,
    reservoirs: [{ id: 'r1', name: 'Bassin', observedAt: '2026-11-01T08:00:00.000Z' }],
    actualRainMissingDates: ['2026-11-09', '2026-11-10'],
  };
  const checks = reliabilityChecks(input, reliabilityLines(input));
  assert.deepEqual(checks.map((check) => [check.label, check.ok, check.summary, check.lines.length]), [
    ['Volume des réserves', false, '1 réserve à relever', 1],
    ['Pluie mesurée', false, '2 jours manquants : le besoin est surévalué', 1],
    ['Réserve du sol', true, 'Tous les jardins ont été observés', 0],
    ['Espèces', true, 'Toutes ont une culture de référence', 0],
    ['Plan de la semaine', true, 'Calculé il y a moins de 48 heures', 0],
  ]);
  assert.equal(checks[0].lines[0].action.label, 'Saisir le volume de Bassin');
  // Une case décochée ne compte pas ; une ferme tout sous abri n'a pas de pluie à noter ; sans réserve, rien à relever.
  const fewer: ReliabilityInputs = { ...FRESH_RELIABILITY, enabled: ['ressources', 'besoins', 'planning'], now: NOW, reservoirs: [], actualRainMissingDates: null, planComputedAt: null };
  assert.deepEqual(reliabilityChecks(fewer, reliabilityLines(fewer)).map((check) => [check.label, check.ok, check.summary]), [
    ['Volume des réserves', true, 'Aucune réserve à relever'],
    ['Pluie mesurée', true, 'Tout est sous abri : pas de pluie à noter'],
    ['Plan de la semaine', false, 'Jamais calculé'],
  ]);
});

test('l’en-tête : la date en toutes lettres, la phrase et les pastilles d’une journée chargée', () => {
  const frost = [{ date: '2026-11-14', minimumCelsius: -1, crops: [{ name: 'Laitue', alertCelsius: 0, underShelter: false, alreadyAlerted: false }] }];
  const view = todayView(inputs({
    weather: { forecasts: [forecast('2026-11-12'), forecast('2026-11-13'), forecast('2026-11-14', -1, 9)], frost, criteria: [] },
    events: [event('y1', '2026-11-11T06:00:00.000Z', 60), event('y2', '2026-11-11T16:00:00.000Z', 60), event('t1', '2026-11-12T09:00:00.000Z', 60)],
    plan: { computedAt: '2026-11-12T05:02:00.000Z', proposals: [proposal('p1', '2026-11-12T17:00:00.000Z')] },
    reliability: { actualRainMissingDates: ['2026-11-10'], soilGardensNeverObserved: [], speciesWithoutReference: [] },
  }));
  assert.equal(view.headline.title, 'Jeudi 12 novembre');
  assert.equal(view.headline.sentence, '2 irrigations sont à rattraper. 2 irrigations sont prévues aujourd’hui, dont 1 à valider. Gel annoncé le sam. 14 nov. : -1 °C. Une donnée est à rafraîchir pour que le calcul soit fiable.');
  assert.deepEqual(view.headline.chips.map((chip) => [chip.tone, chip.text, chip.target]), [
    ['late', '2 à rattraper', 'day'],
    ['todo', '2 à faire aujourd’hui', 'day'],
    ['alert', 'Gel le sam. 14 nov.', 'weather'],
    ['data', '1 donnée à rafraîchir', 'reliability'],
  ]);
  assert.equal(view.timeline?.bars.length, 2);
  assert.deepEqual(block(view.blocks, 'late').items.map((item) => item.kind), ['line', 'line']);
});

test('l’en-tête d’une journée calme, et celui d’une prévision indisponible', () => {
  const calm = todayView(inputs());
  assert.equal(calm.headline.sentence, 'Rien d’urgent aujourd’hui. Pas de gel annoncé pour vos cultures ni d’alerte météo d’ici le sam. 14 nov.');
  assert.deepEqual(calm.headline.chips.map((chip) => [chip.tone, chip.text]), [
    ['ok', 'Rien à arroser'],
    ['ok', 'Rien d’annoncé sur trois jours'],
    ['ok', 'Données à jour'],
  ]);
  assert.equal(calm.timeline, null);
  const unknown = todayView(inputs({ weather: { forecasts: [], frost: [], criteria: [] } }));
  assert.equal(unknown.headline.sentence, 'Prévision indisponible : à vérifier.');
  assert.deepEqual(unknown.headline.chips[1], { key: 'weather', tone: 'unknown', icon: 'cloud', text: 'Prévision à vérifier', target: 'weather' });
  // Une alerte de l'exploitation, sans gel des cultures.
  const criterion: WeatherAlertCriterion = { id: 'c1', version: 1, field: 'maximum-temperature', direction: 'above', threshold: 30, horizonDays: 7, active: true, label: 'Chaleur' };
  const hot = todayHeadline({
    today: '2026-11-12',
    irrigations: null,
    weather: { tone: 'alert', days: weatherBlock({ forecasts: [forecast('2026-11-12', 10, 31)], frost: null, criteria: [criterion] }, ['alertes-meteo'], NOW).days, calmText: null },
    reliabilityCount: null,
  });
  assert.equal(hot.sentence, 'Chaleur : température maximale prévue 31 °C aujourd’hui.');
  assert.deepEqual(hot.chips.map((chip) => chip.text), ['Alerte météo aujourd’hui']);
  assert.equal(longDayTitle('2027-01-01'), 'Vendredi 1 janvier');
});

test('une case décochée ne parle ni dans l’en-tête ni dans les blocs ; cochée, la semaine et le sol apparaissent', () => {
  const week = { weekStart: '2026-11-09', weekEnd: '2026-11-15', beds: [bed('g1', 'Nord', 10)], water: null };
  const soil = { zones: [{ plots: [plot('Nord', { percent: 50, countedBeds: 1 })] }] };
  const only = todayView(inputs({ enabled: ['materiel', 'arrosages'], week, soil }));
  assert.deepEqual(only.headline.chips.map((chip) => chip.key), ['nothing']);
  assert.equal(only.week, null);
  assert.equal(only.soil, null);
  const all = todayView(inputs({ week, soil }));
  assert.equal(all.week?.farm.text, '2 / 20 mm');
  assert.equal(all.soil?.shown[0].text, '50 %');
  assert.equal(block(all.blocks, 'reliability').checks.length, 5);
});
