import assert from 'node:assert/strict';
import test from 'node:test';
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
