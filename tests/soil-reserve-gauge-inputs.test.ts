import assert from 'node:assert/strict';
import test from 'node:test';
import type { IrrigationEventRecord } from '../lib/domain/irrigation-event-record.ts';
import type { StoredWeeklyPlan } from '../lib/domain/planning/contract.ts';
import { actualIrrigationsByBed, dayRainFromWeather, gaugeStartDate, irrigationIntervalsByBed } from '../lib/domain/soil-reserve/gauge-inputs.ts';
import type { SoilObservation } from '../lib/domain/soil-reserve/gauge.ts';
import { gaugeShortDayLabel, unknownReasonText } from '../lib/domain/soil-reserve/gauge-view.ts';
import { plannedIrrigation, realIrrigation } from './support/planning-fixtures.ts';

/**
 * Ce que la jauge lit des autres modules (5 ter, PR 3b) : la pluie du jour
 * selon la règle existante, les irrigations réalisées sur leurs heures
 * réelles, les planifiées par la règle du planning, les propositions encore
 * proposées ; et le premier jour à suivre.
 */

const TODAY = '2026-06-10';
const row = (date: string, dataKind: 'forecast' | 'reanalysis' | 'manual_precipitation', precipitationMm: number | null, fetchedAt = `${date}T06:00:00.000Z`) =>
  ({ date, dataKind, precipitationMm, et0Mm: null, fetchedAt });

test('la pluie : le pluviomètre prime, 0 mm compris ; la réanalyse avant aujourd’hui, à défaut la prévision estimée ; la prévision ensuite', () => {
  const rain = dayRainFromWeather([
    row('2026-06-07', 'reanalysis', 5),
    row('2026-06-07', 'manual_precipitation', 0),
    row('2026-06-08', 'reanalysis', 3),
    row('2026-06-08', 'forecast', 9),
    row('2026-06-09', 'forecast', 2),
    row('2026-06-09', 'forecast', 4, '2026-06-09T12:00:00.000Z'),
    row(TODAY, 'reanalysis', 7),
    row(TODAY, 'forecast', 1),
    row('2026-06-11', 'forecast', 6),
    row('2026-06-12', 'forecast', null),
  ], TODAY);
  assert.deepEqual(rain.get('2026-06-07'), { mm: 0, nature: 'gauge' });
  assert.deepEqual(rain.get('2026-06-08'), { mm: 3, nature: 'reanalysis' });
  assert.deepEqual(rain.get('2026-06-09'), { mm: 4, nature: 'estimated' }, 'la dernière prévision lue');
  assert.deepEqual(rain.get(TODAY), { mm: 1, nature: 'forecast' });
  assert.deepEqual(rain.get('2026-06-11'), { mm: 6, nature: 'forecast' });
  assert.equal(rain.has('2026-06-12'), false, 'une pluie inconnue reste absente, jamais 0');
});

test('les irrigations : réalisées sur leurs heures, planifiées par la règle du planning, propositions encore proposées', () => {
  const now = new Date('2026-06-10T08:00:00.000Z');
  const horizonEnd = new Date('2026-06-14T22:00:00.000Z');
  const done = realIrrigation('faite', 'goutte', '2026-06-09T05:00:00.000Z', ['A', 'B'], 12, 6);
  const canceled = realIrrigation('annulee', 'goutte', '2026-06-09T05:00:00.000Z', ['A'], 30, 6, 'drip', 'canceled');
  const planned = plannedIrrigation('prevue', 'goutte', '2026-06-11T05:00:00.000Z', '2026-06-11T07:00:00.000Z', ['A']);
  const plannedRemaining: IrrigationEventRecord = {
    ...planned,
    equipment: { ...planned.equipment, applications: planned.equipment.applications.map((application) => ({ ...application, plannedAmountMm: 8, actualAmountMm: 0 })) },
  };
  const plan = {
    proposals: [
      { status: 'proposed', startAt: '2026-06-12T05:00:00.000Z', endAt: '2026-06-12T06:00:00.000Z', bedApplications: [{ bedId: 'B', appliedMm: 5 }] },
      { status: 'proposed', startAt: '2026-06-09T05:00:00.000Z', endAt: '2026-06-09T06:00:00.000Z', bedApplications: [{ bedId: 'B', appliedMm: 7 }] },
      { status: 'refused', startAt: '2026-06-13T05:00:00.000Z', endAt: '2026-06-13T06:00:00.000Z', bedApplications: [{ bedId: 'A', appliedMm: 9 }] },
    ],
  } as unknown as StoredWeeklyPlan;
  const byBed = irrigationIntervalsByBed({ events: [done, canceled, plannedRemaining], plan, now, horizonEnd });
  assert.deepEqual(byBed.get('A'), [
    { startAt: '2026-06-09T05:00:00.000Z', endAt: '2026-06-09T06:00:00.000Z', mm: 12, nature: 'actual' },
    { startAt: '2026-06-11T05:00:00.000Z', endAt: '2026-06-11T07:00:00.000Z', mm: 8, nature: 'planned' },
  ]);
  assert.deepEqual(byBed.get('B'), [
    { startAt: '2026-06-09T05:00:00.000Z', endAt: '2026-06-09T06:00:00.000Z', mm: 12, nature: 'actual' },
    { startAt: '2026-06-12T05:00:00.000Z', endAt: '2026-06-12T06:00:00.000Z', mm: 5, nature: 'proposed' },
  ], 'une proposition échue ou refusée ne compte pas');
  assert.deepEqual(actualIrrigationsByBed([done, canceled, plannedRemaining], now).get('A'), [
    { startAt: '2026-06-09T05:00:00.000Z', endAt: '2026-06-09T06:00:00.000Z', mm: 12, nature: 'actual', wettedAreaSquareMeters: 16.5 },
  ], 'les réalisées seules, avec la surface qui convertit leurs mm en volume');
});

test('le départ : la dernière observation de chaque jardin, sinon trente jours, jamais plus de quatre-vingt-dix ni avant la saison', () => {
  const observation = (zoneId: string, plotId: string | null, observedAt: string): SoilObservation =>
    ({ zoneId, plotId, percent: 60, observedAt, recordedAt: observedAt });
  const plots = [{ id: 'jardin', zoneId: 'parcelle', sheltered: false }, { id: 'abri', zoneId: 'parcelle', sheltered: true }];
  const start = (observations: SoilObservation[], today = TODAY, season = 2026) =>
    gaugeStartDate({ today, season, plots, observations, observedDate: (item) => item.observedAt.slice(0, 10) });

  assert.equal(start([]), '2026-05-11', 'sans observation, trente jours en arrière');
  assert.equal(start([], '2026-01-20'), '2026-01-01', 'jamais avant le 1er janvier de la saison');
  assert.equal(
    start([observation('parcelle', 'jardin', '2026-04-20T08:00:00.000Z'), observation('parcelle', 'abri', '2026-06-01T08:00:00.000Z')]),
    '2026-04-20',
    'le plus ancien des départs des jardins',
  );
  assert.equal(
    start([observation('parcelle', null, '2026-06-05T08:00:00.000Z'), observation('parcelle', 'abri', '2026-06-08T08:00:00.000Z')]),
    '2026-06-05',
    'la parcelle couvre son jardin de plein champ, pas l’abri',
  );
  assert.equal(
    start([observation('parcelle', null, '2026-06-05T08:00:00.000Z')]),
    '2026-05-11',
    'l’abri sans observation part trente jours en arrière',
  );
  assert.equal(start([observation('parcelle', 'jardin', '2026-02-01T08:00:00.000Z')]), '2026-05-11', 'une observation de plus de quatre-vingt-dix jours ne sert plus');
});

test('une jauge inconnue nomme le jour et la donnée qui manquent, ou la culture (D-003)', () => {
  assert.equal(unknownReasonText({ kind: 'missing-rain', date: '2026-11-03' }), 'Inconnue depuis le mardi 3 novembre : la pluie de ce jour manque.');
  assert.equal(
    unknownReasonText({ kind: 'crop-without-etm', date: '2026-11-03', crops: [{ seriesName: 'Carottes du verger', plantName: 'Carotte' }] }),
    'Inconnue depuis le mardi 3 novembre : pas d’ETM pour Carotte (Carottes du verger), culture sans Kc ou sans stade.',
  );
  assert.match(unknownReasonText({ kind: 'not-started' }), /pas encore de départ/);
  assert.equal(gaugeShortDayLabel('2026-11-03'), 'mar. 3');
});
