import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { equipmentByGarden } from '../lib/domain/equipment-by-garden.ts';
import { FEATURE_IDS } from '../lib/domain/features/catalogue.ts';
import type { IrrigationEventRecord } from '../lib/domain/irrigation-event-record.ts';
import type { SoilGaugeZone } from '../lib/domain/soil-reserve/gauge-view.ts';
import { todayHeadline } from '../lib/domain/today/headline.ts';
import { nowIrrigationLines } from '../lib/domain/today/now-irrigations.ts';
import { todaySoil } from '../lib/domain/today/soil.ts';
import { pastRainOrigins, todayWeek, type RainOrigins, type TodayWeekBed } from '../lib/domain/today/week.ts';

const screenMm = (value: number) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value)} mm`;

/**
 * Audit ergonomique du 19 novembre 2026, lot H « Aujourd'hui dit vrai »
 * (docs/audit-ergonomie-2026-11-19-lot-h-contract.md).
 */

const bed = (plotId: string, values: Partial<TodayWeekBed> = {}): TodayWeekBed => ({
  plotId, plotName: plotId, sheltered: false, areaSquareMeters: 10, objectiveMm: 20, actualRainMm: 30.7, actualIrrigationMm: 0, realRemainingMm: 0, ...values,
});

const weekWith = (rainOrigins: RainOrigins | null | undefined, beds: TodayWeekBed[] = [bed('g1')]) =>
  todayWeek({ weekStart: '2026-11-16', weekEnd: '2026-11-22', beds, water: null, rainOrigins });

test('n° 3, F429 : la pluie des jours écoulés se range par origine, comme la compte le tableau des besoins (D-019)', () => {
  const day = (date: string, manualRainMm: number | null, reanalysisRainMm: number | null, forecastRainMm: number | null) =>
    ({ date, manualRainMm, reanalysisRainMm, forecastRainMm });
  assert.deepEqual(pastRainOrigins([
    day('2026-11-16', 4, 3, 9), // le pluviomètre l'emporte sur la réanalyse et la prévision
    day('2026-11-17', null, 2.5, 8), // la réanalyse l'emporte sur la prévision
    day('2026-11-18', null, null, 6.7), // la prévision reprise pour un jour passé
    day('2026-11-19', null, null, null), // aujourd'hui, rien de connu
    day('2026-11-20', 10, null, 13.5), // demain n'est pas encore écoulé
  ], '2026-11-19'), { measuredMm: 4, reanalysisMm: 2.5, forecastMm: 6.7 });
});

test('n° 3, F429 : « Eau reçue » dit d’où vient la pluie, jamais « mesurée » pour une pluie prévue', () => {
  assert.equal(weekWith({ measuredMm: 0, reanalysisMm: 0, forecastMm: 38.1 })?.tiles.receivedDetail,
    `${screenMm(0)} d’irrigation, ${screenMm(30.7)} de pluie prévue, non mesurée`);
  assert.equal(weekWith({ measuredMm: 30.7, reanalysisMm: 0, forecastMm: 0 })?.tiles.receivedDetail,
    `${screenMm(0)} d’irrigation, ${screenMm(30.7)} de pluie mesurée`);
  assert.equal(weekWith({ measuredMm: 0, reanalysisMm: 5, forecastMm: 0 })?.tiles.receivedDetail,
    `${screenMm(0)} d’irrigation, ${screenMm(30.7)} de pluie estimée après coup`);
  // Mêlée : chaque part au prorata de la pluie extérieure, dans l'ordre mesurée, estimée, prévue.
  assert.equal(weekWith({ measuredMm: 12, reanalysisMm: 0, forecastMm: 18.7 })?.tiles.receivedDetail,
    `${screenMm(0)} d’irrigation, ${screenMm(30.7)} de pluie, dont ${screenMm(12)} mesurés et ${screenMm(18.7)} prévus`);
  assert.equal(weekWith({ measuredMm: 10, reanalysisMm: 10, forecastMm: 20 })?.tiles.receivedDetail,
    `${screenMm(0)} d’irrigation, ${screenMm(30.7)} de pluie, dont ${screenMm(7.7)} mesurés, ${screenMm(7.7)} estimés après coup et ${screenMm(15.4)} prévus`);
  // Sans origine connue : « de pluie », sans adjectif.
  assert.equal(weekWith(undefined)?.tiles.receivedDetail, `${screenMm(0)} d’irrigation, ${screenMm(30.7)} de pluie`);
  // Tout sous abri : pas de pluie, et la raison.
  assert.equal(weekWith({ measuredMm: 0, reanalysisMm: 0, forecastMm: 9 }, [bed('t1', { sheltered: true, actualRainMm: 0 })])?.tiles.receivedDetail,
    `${screenMm(0)} d’irrigation, ${screenMm(0)} de pluie, sous abri`);
});

test('n° 3, F429 : la légende d’« Eau de la semaine » dit l’origine de la pluie', () => {
  assert.deepEqual([
    weekWith({ measuredMm: 0, reanalysisMm: 0, forecastMm: 9 }),
    weekWith({ measuredMm: 9, reanalysisMm: 0, forecastMm: 0 }),
    weekWith({ measuredMm: 0, reanalysisMm: 9, forecastMm: 0 }),
    weekWith({ measuredMm: 3, reanalysisMm: 0, forecastMm: 6 }),
    weekWith({ measuredMm: 3, reanalysisMm: 2, forecastMm: 6 }),
    weekWith({ measuredMm: 0, reanalysisMm: 0, forecastMm: 0 }),
    weekWith(null),
  ].map((week) => week?.rainLegend), [
    'Pluie prévue, non mesurée',
    'Pluie mesurée',
    'Pluie estimée après coup',
    'Pluie mesurée et prévue',
    'Pluie mesurée, estimée et prévue',
    'Pluie',
    'Pluie',
  ]);
});

// n° 4 : les jardins qui comptent d'abord (F430 à F432).

test('n° 4, F430 et F432 : « Eau de la semaine » montre d’abord les jardins arrosés aujourd’hui, puis les plus loin de leur objectif', () => {
  // Douze jardins de plein champ pleins, les tunnels à sec : l'ordre de la ferme réelle du 19 novembre 2026.
  const blocs = ['bloc 1', 'Bloc 10', 'Bloc 11', 'Bloc 2', 'bloc 3', 'bloc 4', 'bloc 5', 'bloc 6', 'bloc 7', 'bloc 8'].map((name) =>
    bed(`g-${name}`, { plotName: name, actualRainMm: 38.1, realRemainingMm: 0 }));
  const tunnels = ['T1', 'T2', 'T3', 'T4'].map((name, index) =>
    bed(`t-${name}`, { plotName: name, sheltered: true, actualRainMm: 0, actualIrrigationMm: index * 2, realRemainingMm: 20 - index * 2 }));
  const sansObjectif = bed('g-verger', { plotName: 'Verger', objectiveMm: null, realRemainingMm: null });
  const week = todayWeek({ weekStart: '2026-11-16', weekEnd: '2026-11-22', beds: [...blocs, sansObjectif, ...tunnels], water: null }, new Set(['t-T3']));
  assert.ok(week);
  assert.deepEqual(week.shown.map((row) => row.name), ['T3', 'T1', 'T2', 'T4', 'bloc 1', 'Bloc 2', 'bloc 3', 'bloc 4']);
  // Repliés dans l'ordre naturel : « bloc 5 » avant « Bloc 10 ».
  assert.deepEqual(week.hidden.map((row) => row.name), ['bloc 5', 'bloc 6', 'bloc 7', 'bloc 8', 'Bloc 10', 'Bloc 11', 'Verger']);
  assert.equal(week.moreLabel, 'Voir les 7 autres jardins');
});

test('n° 4, F430 : un reste inconnu passe après les restes connus, un jardin sans objectif après eux', () => {
  const week = todayWeek({ weekStart: '2026-11-16', weekEnd: '2026-11-22', water: null, beds: [
    bed('a', { plotName: 'A', objectiveMm: null, realRemainingMm: null }),
    bed('b', { plotName: 'B', actualRainMm: null, realRemainingMm: null }),
    bed('c', { plotName: 'C', realRemainingMm: 5 }),
    bed('d', { plotName: 'D', objectiveMm: 10, realRemainingMm: 5 }),
  ] });
  // D (5 sur 10) est plus loin que C (5 sur 20).
  assert.deepEqual(week?.shown.map((row) => row.name), ['D', 'C', 'B', 'A']);
});

const plot = (name: string, garden: Partial<SoilGaugeZone['plots'][number]['garden']>): SoilGaugeZone['plots'][number] => ({
  plotId: `p-${name}`, name, sheltered: false, week: [], observation: null, beds: [],
  garden: { percent: null, lowest: null, countedBeds: 0, unknownBeds: 0, withoutCrop: [], ...garden },
});

test('n° 4, F431 et F432 : « Réserve du sol » montre d’abord les jardins arrosés aujourd’hui, puis les plus secs, puis les inconnus', () => {
  const pleins = ['bloc 1', 'Bloc 10', 'Bloc 11', 'Bloc 2', 'bloc 3', 'bloc 4', 'bloc 5', 'bloc 6'].map((name) => plot(name, { percent: 100, countedBeds: 2 }));
  const tunnels = ['T1', 'T2', 'T3', 'T4'].map((name) => plot(name, { unknownBeds: 2 }));
  const soil = todaySoil({ zones: [{ plots: [...pleins, plot('Sec', { percent: 31, countedBeds: 2 }), plot('Friche', {}), ...tunnels] }] }, new Set(['p-T4']));
  assert.deepEqual(soil.shown.map((garden) => garden.name), ['T4', 'Sec', 'bloc 1', 'Bloc 2', 'bloc 3', 'bloc 4', 'bloc 5', 'bloc 6']);
  assert.deepEqual(soil.hidden.map((garden) => garden.name), ['Bloc 10', 'Bloc 11', 'Friche', 'T1', 'T2', 'T3']);
  assert.equal(soil.moreLabel, 'Voir les 6 autres jardins');
});

// n° 2 : en cours et reliquat (F433 à F435). Aujourd'hui = jeudi 19 novembre 2026, 11 h 00 à la ferme.

const NOW = new Date('2026-11-19T10:00:00.000Z');
const BED_NAMES = new Map([['b1', 'P1'], ['b2', 'P2']]);

function irrigation(id: string, values: { status?: string; timerState?: 'running' | 'paused' | null; timer?: Record<string, unknown>; remainingCanceledAt?: string | null; actualMm?: number }): IrrigationEventRecord {
  return {
    id: `event-${id}`, season: 2026, status: values.status ?? 'running', note: null,
    remainingCanceledAt: values.remainingCanceledAt ?? null, canceledAt: null,
    createdAt: '2026-11-19T07:00:00.000Z', updatedAt: '2026-11-19T07:00:00.000Z',
    equipment: {
      id, status: values.status ?? 'running',
      plannedStartAt: '2026-11-19T08:40:00.000Z', plannedEndAt: '2026-11-19T12:50:00.000Z',
      actualStartAt: '2026-11-19T08:40:00.000Z', actualEndAt: null,
      plannedDurationSeconds: 4 * 3600 + 10 * 60, actualDurationSeconds: 3600,
      timerState: values.timerState ?? null, timerStartedAt: null, timerResumedAt: null, timerPausedAt: null,
      timerTheoreticalEndAt: null, timerAccumulatedSeconds: 0, remainingCanceledAt: null, canceledAt: null,
      equipmentSnapshot: { id: 'eq', name: 'Goutte-à-goutte de l’abri', kind: 'drip', mobility: 'fixed' },
      settingSnapshot: { name: 'Réglage 1' },
      applications: [
        { otfBedId: 'b1', plannedAmountMm: 20, actualAmountMm: values.actualMm ?? 0, wettedAreaSquareMeters: 50 },
        { otfBedId: 'b2', plannedAmountMm: 20, actualAmountMm: values.actualMm ?? 0, wettedAreaSquareMeters: 50 },
      ],
      ...values.timer,
    },
  } as unknown as IrrigationEventRecord;
}

const running = irrigation('r', { timerState: 'running', timer: {
  timerStartedAt: '2026-11-19T08:40:00.000Z', timerResumedAt: '2026-11-19T08:40:00.000Z', timerTheoreticalEndAt: '2026-11-19T12:50:00.000Z',
} });

test('n° 2, F433 : une irrigation en cours, en pause ou à confirmer se lit en tête, avec « Arrêter / Terminer » vers sa carte', () => {
  const paused = irrigation('p', { timerState: 'paused', timer: {
    timerStartedAt: '2026-11-19T08:00:00.000Z', timerPausedAt: '2026-11-19T09:05:00.000Z', timerAccumulatedSeconds: 3900,
  } });
  const finished = irrigation('f', { timerState: 'running', timer: {
    timerStartedAt: '2026-11-19T04:00:00.000Z', timerResumedAt: '2026-11-19T04:00:00.000Z', timerTheoreticalEndAt: '2026-11-19T08:10:00.000Z',
  } });
  const lines = nowIrrigationLines({ enabled: [...FEATURE_IDS], now: NOW, events: [running, paused, finished], bedNames: BED_NAMES });
  assert.deepEqual(lines.map((line) => [line.status, line.title, line.detail, line.bedsText, line.canResume, line.open]), [
    ['Durée atteinte', 'Goutte-à-goutte de l’abri · Réglage 1', 'depuis 5 h, fermer la vanne', 'planches P1 et P2', false, { page: 'arrosages', anchor: 'irrigation-f' }],
    ['En pause', 'Goutte-à-goutte de l’abri · Réglage 1', 'en pause depuis 10 h 05', 'planches P1 et P2', false, { page: 'arrosages', anchor: 'irrigation-p' }],
    ['En cours', 'Goutte-à-goutte de l’abri · Réglage 1', 'depuis 9 h 40, fin prévue à 13 h 50', 'planches P1 et P2', false, { page: 'arrosages', anchor: 'irrigation-r' }],
  ]);
});

test('n° 2, F434 : le reliquat d’une irrigation partielle se lit avec « Reprendre le reliquat » ; annulé, il n’y est plus', () => {
  const partial = irrigation('q', { status: 'partially_completed', actualMm: 4.8 });
  const canceled = irrigation('c', { status: 'partially_completed', remainingCanceledAt: '2026-11-19T09:00:00.000Z' });
  const completed = irrigation('d', { status: 'completed' });
  const lines = nowIrrigationLines({ enabled: [...FEATURE_IDS], now: NOW, events: [partial, canceled, completed], bedNames: BED_NAMES });
  // 4 h 10 prévues, 1 h faite : reste 3 h 10 ; 2 m³ prévus, 0,48 m³ apportés.
  assert.deepEqual(lines.map((line) => [line.status, line.detail, line.canResume]), [['Reliquat', 'reste 3 h 10 · 1,52 m³', true]]);
});

test('n° 2, F435 : la phrase et les pastilles disent l’en-cours et le reliquat, jamais « Rien à arroser »', () => {
  const current = nowIrrigationLines({ enabled: [...FEATURE_IDS], now: NOW, events: [running, irrigation('q', { status: 'partially_completed' })], bedNames: BED_NAMES });
  const headline = todayHeadline({ today: '2026-11-19', irrigations: { current, late: [], todo: [] }, weather: null, reliabilityCount: null, tomorrow: null, shortage: null });
  assert.equal(headline.sentence, 'Une irrigation est en cours. Un reliquat est à reprendre.');
  assert.deepEqual(headline.chips.map((chip) => chip.text), ['1 en cours', '1 reliquat']);
  const calm = todayHeadline({ today: '2026-11-19', irrigations: { current: [], late: [], todo: [] }, weather: null, reliabilityCount: null, tomorrow: null, shortage: null });
  assert.deepEqual(calm.chips.map((chip) => chip.text), ['Rien à arroser']);
});

test('corrigé en passant (D-175) : une bulle « D’où vient ce chiffre ? » longue défile en elle-même, « Fermer » reste à l’écran', () => {
  const css = readFileSync('app/irrigation/styles/help.css', 'utf8');
  const bubble = css.slice(css.indexOf('.figure-origin-bubble {'));
  assert.match(bubble, /^\.figure-origin-bubble \{[^}]*max-height: calc\(100vh - 32px\);\s*overflow-y: auto;/);
  assert.match(css, /@media \(max-width: 980px\) \{\s*\.figure-origin-bubble \{[^}]*max-height: calc\(100dvh - 96px - 68px\);/);
});

// n° 14 : l'ordre naturel partout (F436, F437).

/**
 * Les seuls tris par nom qui ne passent pas par l'ordre naturel : ceux du
 * moteur du planning, qui fixent l'ordre du calcul et jamais un affichage ;
 * les changer changerait des plans (D-024).
 */
const COMPUTATION_ORDER = new Set(['lib/domain/planning/engine.ts', 'lib/domain/planning/demand.ts', 'lib/domain/planning/protected-slots.ts']);

function sources(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? sources(path) : /\.tsx?$/.test(entry) ? [path] : [];
  });
}

test('n° 14, F436 : chaque nom affiché se range dans l’ordre naturel, jamais caractère par caractère', () => {
  const offenders = [...sources('lib'), ...sources('app'), ...sources('db')]
    .filter((path) => !COMPUTATION_ORDER.has(path))
    .flatMap((path) => readFileSync(path, 'utf8').split('\n').flatMap((line, index, lines) =>
      // Une comparaison d'égalité (`sensitivity: 'base'`, « === 0 ») cherche un doublon, pas un ordre.
      /(?:[nN]ame|\bleft|\ba)\.localeCompare\(/.test(line) && /[nN]ame/.test(line) && !/sensitivity/.test(`${line}${lines[index + 1] ?? ''}`)
        ? [`${path}:${index + 1}`] : []));
  assert.deepEqual(offenders, []);
});

test('n° 14, F437 : la liste « Matériel » se regroupe par jardin, dans l’ordre naturel', () => {
  const items = ['gag10', 'gag2', 'rampe bloc 10', 'rampe bloc 2', 'Asperseur', 'Perdu'].map((name) => ({ id: `e-${name}`, name }));
  const placements = [
    { equipmentId: 'e-gag10', otfPlotId: 'p-t1', gardenGroupId: null },
    { equipmentId: 'e-gag2', otfPlotId: 'p-t1', gardenGroupId: null },
    { equipmentId: 'e-rampe bloc 10', otfPlotId: 'p-b10', gardenGroupId: null },
    { equipmentId: 'e-rampe bloc 2', otfPlotId: 'p-b2', gardenGroupId: null },
    { equipmentId: 'e-Asperseur', otfPlotId: 'p-b2', gardenGroupId: 'g-champ' },
  ];
  const groups = equipmentByGarden(items, placements, {
    plots: [{ id: 'p-t1', name: 'Tunnel 1' }, { id: 'p-b10', name: 'Bloc 10' }, { id: 'p-b2', name: 'bloc 2' }],
    groups: [{ id: 'g-champ', name: 'Plein champ' }],
  });
  assert.deepEqual(groups.map((group) => [group.label, group.items.map((item) => item.name)]), [
    ['bloc 2', ['rampe bloc 2']],
    ['Bloc 10', ['rampe bloc 10']],
    ['Plein champ', ['Asperseur']],
    ['Tunnel 1', ['gag2', 'gag10']],
    ['Sans jardin', ['Perdu']],
  ]);
});
