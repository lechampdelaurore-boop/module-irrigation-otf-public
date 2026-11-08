import assert from 'node:assert/strict';
import test from 'node:test';
import type { Bed, CropPlan, Plot } from '../lib/domain/domain.ts';
import type { IrrigationEventRecord } from '../lib/domain/irrigation-event-record.ts';
import type { GoalRevisionLike, WeatherDailyLike } from '../lib/domain/irrigation-history/contract.ts';
import { buildSeriesWaterReport, periodBetween } from '../lib/domain/series/water.ts';

const TODAY = '2026-09-29';

// N01 : 30 m × 0,75 m, passe-pied 0,45 m, plein champ ; T01 : 16 m sous tunnel.
const plots: Plot[] = [
  { id: 'plot-nord', zoneId: 'zone', name: 'Jardin Nord', mode: 'garden', length: 40, width: 30, area: 1200, seasons: [2026] },
  { id: 'plot-tunnel', zoneId: 'zone', name: 'Tunnel 1', mode: 'greenhouse', length: 20, width: 8, area: 160, seasons: [2026] },
];
const beds: Bed[] = [
  { id: 'bed-n01', zoneId: 'zone', plotId: 'plot-nord', name: 'N01', length: 30, width: 0.75, alleyWidth: 0.45, area: 22.5, seasons: [2026] },
  { id: 'bed-n02', zoneId: 'zone', plotId: 'plot-nord', name: 'N02', length: 30, width: 0.75, alleyWidth: 0.45, area: 22.5, seasons: [2026] },
  { id: 'bed-t01', zoneId: 'zone', plotId: 'plot-tunnel', name: 'T01', length: 16, width: 0.75, alleyWidth: 0.25, area: 12, seasons: [2026] },
  { id: 'bed-x', zoneId: 'zone', plotId: 'plot-nord', name: 'X', length: 20, width: 0, alleyWidth: null, area: 0, seasons: [2026] },
];

function plan(input: Partial<CropPlan>): CropPlan {
  return {
    series: [],
    places: [],
    implantationTasks: [],
    readSummary: { seriesRead: 0, placesRead: 0, tasksRead: 0, tasksRetained: 0, placesWithoutSeries: 0, placesOfUnknownSeries: 0, placesWithUnknownBed: 0 },
    ...input,
  };
}

function series(id: string, name: string, harvestWeeksExpected: string[], extra: Partial<CropPlan['series'][number]> = {}) {
  return { id, name, season: 2026, use: 'bed' as const, cycle: 'annual' as const, cultivations: [{ id: `${id}-c`, plantId: 'p', plantName: name, harvestWeeks: [], harvestWeeksExpected }], ...extra };
}

function sowing(seriesId: string, week: string) {
  return { id: `t-${seriesId}`, seriesId, cultivationId: null, kind: 'direct-sowing' as const, plannedWeek: week, doneWeek: week, status: 'done' as const };
}

/** Une irrigation réelle d'une heure, commencée à `startAt` (UTC), avec ses applications par planche. */
function irrigation(id: string, startAt: string, applications: { bedId: string; mm: number; wetted?: number | null; area?: number }[]): IrrigationEventRecord {
  const endAt = new Date(new Date(startAt).getTime() + 3_600_000).toISOString();
  return {
    id, season: 2026, status: 'completed', note: null, remainingCanceledAt: null, canceledAt: null,
    createdAt: startAt, updatedAt: endAt,
    equipment: {
      id: `eq-${id}`, equipmentId: 'equipment', settingId: 'setting', placementId: 'placement', status: 'completed',
      plannedStartAt: null, plannedEndAt: null, actualStartAt: startAt, actualEndAt: endAt,
      plannedDurationSeconds: 3600, actualDurationSeconds: 3600,
      equipmentSnapshot: { id: 'equipment', name: 'gag', kind: 'drip', mobility: 'mobile' },
      settingSnapshot: { id: 'setting', name: 'standard', position: 1, kind: 'drip', rateMmPerHour: 10 },
      placementSnapshot: { id: 'placement', equipmentId: 'equipment', settingId: 'setting', season: 2026, gardenGroupId: null, otfZoneId: 'zone', otfPlotId: 'plot-nord', anchor: { type: 'bed_center', anchorBedOtfId: 'bed-n01' }, selectedBeds: [] },
      timerState: null, timerStartedAt: null, timerResumedAt: null, timerPausedAt: null, timerTheoreticalEndAt: null,
      timerAccumulatedSeconds: 0, timerAlarmRevision: null, timerAlarmStatus: null, timerAlarmSyncedAt: null,
      remainingCanceledAt: null, canceledAt: null,
      applications: applications.map((application) => ({
        otfZoneId: 'zone', otfPlotId: application.bedId === 'bed-t01' ? 'plot-tunnel' : 'plot-nord', otfBedId: application.bedId,
        rateMmPerHour: application.mm, bedAreaSquareMeters: application.area ?? 22.5,
        wettedAreaSquareMeters: application.wetted === undefined ? (application.area ?? 22.5) : application.wetted,
        plannedAmountMm: application.mm, actualAmountMm: application.mm,
      })),
    },
  };
}

function rain(date: string, mm: number | null, kind: WeatherDailyLike['dataKind'] = 'reanalysis'): WeatherDailyLike {
  return { date, dataKind: kind, precipitationMm: mm, et0Mm: 2 };
}

function farmGoal(amountMm: number, weekStart = '2026-01-05'): GoalRevisionLike {
  return { id: `goal-${weekStart}`, weekStart, scopeType: 'farm', otfZoneId: null, otfPlotId: null, otfBedId: null, amountMm, action: 'set', createdAt: `${weekStart}T00:00:00Z` };
}

function days(from: string, to: string, mm: number): WeatherDailyLike[] {
  const out: WeatherDailyLike[] = [];
  for (let d = new Date(`${from}T12:00:00Z`); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) out.push(rain(d.toISOString().slice(0, 10), mm));
  return out;
}

test('une série ne reçoit que les millimètres de sa période, en entier, et deux séries sur la même planche les reçoivent chacune', () => {
  // Carottes semées 2026-W12 (lundi 16 mars), récolte jusqu'à W26 (dimanche 28 juin) ;
  // mâche semée W26 (lundi 22 juin) sur la même planche : la semaine 26 compte pour les deux.
  const cropPlan = plan({
    series: [series('carottes', 'Carottes', ['2026-W26']), series('mache', 'Mâche', ['2026-W40'])],
    places: [{ id: 'p1', seriesId: 'carottes', bedId: 'bed-n01', lengthMeters: 30 }, { id: 'p2', seriesId: 'mache', bedId: 'bed-n01', lengthMeters: 30 }],
    implantationTasks: [sowing('carottes', '2026-W12'), sowing('mache', '2026-W26')],
  });
  const events = [
    irrigation('avant', '2026-03-10T06:00:00Z', [{ bedId: 'bed-n01', mm: 7 }]),
    irrigation('pendant', '2026-04-10T06:00:00Z', [{ bedId: 'bed-n01', mm: 10 }]),
    irrigation('commune', '2026-06-24T06:00:00Z', [{ bedId: 'bed-n01', mm: 5 }]),
    irrigation('apres', '2026-07-10T06:00:00Z', [{ bedId: 'bed-n01', mm: 20 }]),
  ];
  const report = buildSeriesWaterReport({ cropPlan, beds, plots, events, weather: [], goalRevisions: [], today: TODAY });
  const [carottes, mache] = report.series;
  assert.equal(carottes.name, 'Carottes');
  assert.deepEqual(carottes.observedPeriod, { startDate: '2026-03-16', endDate: '2026-06-28' });
  assert.equal(carottes.irrigationMm, 15, '10 pendant + 5 la semaine commune ; rien avant, rien après');
  assert.equal(carottes.beds[0].irrigationMm, 15);
  assert.equal(carottes.irrigationCubicMeters, 0.3375, '15 mm × 22,5 m² mouillés');
  assert.equal(mache.irrigationMm, 25, '5 la semaine commune + 20 après : la totalité, pas une part');
  assert.deepEqual(mache.observedPeriod, { startDate: '2026-06-22', endDate: TODAY }, 'en cours : observé jusqu’à aujourd’hui');
  assert.equal(carottes.occupation.status, 'finished');
  assert.equal(mache.occupation.status, 'ongoing');
});

test('les millimètres se pondèrent par la surface de planche occupée, les volumes s’additionnent au prorata du linéaire', () => {
  // N01 entière (22,5 m²) à 10 mm, N02 sur 10 m (7,5 m²) à 20 mm : (10×22,5 + 20×7,5) / 30 = 12,5 mm.
  const cropPlan = plan({
    series: [series('s', 'Salades', ['2026-W40'])],
    places: [{ id: 'p1', seriesId: 's', bedId: 'bed-n01', lengthMeters: 30 }, { id: 'p2', seriesId: 's', bedId: 'bed-n02', lengthMeters: 10 }],
    implantationTasks: [sowing('s', '2026-W20')],
  });
  const events = [
    irrigation('a', '2026-06-01T06:00:00Z', [{ bedId: 'bed-n01', mm: 10, wetted: 36 }]),
    irrigation('b', '2026-06-02T06:00:00Z', [{ bedId: 'bed-n02', mm: 20, wetted: 22.5 }]),
  ];
  const [s] = buildSeriesWaterReport({ cropPlan, beds, plots, events, weather: [], goalRevisions: [], today: TODAY }).series;
  assert.equal(s.areaSquareMeters, 30);
  assert.equal(s.irrigationMm, 12.5);
  // Aspersion sur N01 : 10 mm × 36 m² = 0,36 m³ ; goutte-à-goutte sur N02 : 20 mm × 22,5 m² × (10/30) = 0,15 m³.
  assert.equal(s.beds[0].irrigationCubicMeters, 0.36);
  assert.equal(s.beds[1].irrigationCubicMeters, 0.15);
  assert.equal(s.irrigationCubicMeters, 0.51);
  assert.equal(s.irrigationVolumeIncomplete, false);
});

test('une surface mouillée inconnue rend le volume inconnu et signalé ; une largeur inconnue interdit la moyenne, pas les millimètres par planche', () => {
  const cropPlan = plan({
    series: [series('s', 'Salades', ['2026-W40'])],
    places: [{ id: 'p1', seriesId: 's', bedId: 'bed-n01', lengthMeters: 30 }, { id: 'p2', seriesId: 's', bedId: 'bed-x', lengthMeters: 20 }],
    implantationTasks: [sowing('s', '2026-W20')],
  });
  const events = [
    irrigation('a', '2026-06-01T06:00:00Z', [{ bedId: 'bed-n01', mm: 10, wetted: null }]),
    irrigation('b', '2026-06-02T06:00:00Z', [{ bedId: 'bed-x', mm: 4, area: 0, wetted: 0.5 }]),
  ];
  const [s] = buildSeriesWaterReport({ cropPlan, beds, plots, events, weather: [], goalRevisions: [], today: TODAY }).series;
  assert.equal(s.beds[0].irrigationCubicMeters, null);
  assert.equal(s.irrigationVolumeIncomplete, true);
  assert.equal(s.beds[0].irrigationMm, 10, 'les millimètres restent la vérité');
  assert.equal(s.beds[1].irrigationMm, 4);
  assert.equal(s.areaSquareMeters, null, 'X sans largeur : pas de surface');
  assert.equal(s.irrigationMm, null, 'pas de moyenne, jamais un zéro');
});

test('pluie : pluviomètre avant réanalyse, zéro sous abri, absente signalée ; objectif proratisé par jour ; écart = objectif − (irrigation + pluie)', () => {
  // Tomates plantées W36 (lundi 31 août), en cours ; observé du 31 août au 29 septembre : 30 jours.
  const cropPlan = plan({
    series: [series('tomates', 'Tomates', ['2026-W44']), series('choux', 'Choux', ['2026-W44'])],
    places: [{ id: 'p1', seriesId: 'tomates', bedId: 'bed-t01', lengthMeters: 16 }, { id: 'p2', seriesId: 'choux', bedId: 'bed-n01', lengthMeters: 30 }],
    implantationTasks: [sowing('tomates', '2026-W36'), sowing('choux', '2026-W36')],
  });
  const weather = [...days('2026-08-31', '2026-09-29', 1), rain('2026-09-01', 5, 'manual_precipitation')];
  const events = [irrigation('a', '2026-09-10T06:00:00Z', [{ bedId: 'bed-t01', mm: 10, area: 12 }, { bedId: 'bed-n01', mm: 10 }])];
  const report = buildSeriesWaterReport({ cropPlan, beds, plots, events, weather, goalRevisions: [farmGoal(14)], today: TODAY });
  const choux = report.series.find((item) => item.name === 'Choux');
  const tomates = report.series.find((item) => item.name === 'Tomates');
  assert.ok(choux && tomates);
  assert.equal(choux.rainMm, 34, '29 jours à 1 mm de réanalyse et un jour à 5 mm au pluviomètre, qui prime');
  assert.equal(choux.rainAvailability.complete, true);
  assert.equal(tomates.rainMm, 0, 'sous abri, zéro explicite');
  assert.equal(tomates.rainAvailability.complete, true);
  assert.equal(choux.objectiveMm, 60, '14 mm/semaine × 30 jours / 7');
  assert.equal(choux.irrigationAndRainMm, 44);
  assert.equal(choux.gapToObjectiveMm, 16, 'déficit positif');
  assert.equal(tomates.gapToObjectiveMm, 50);
  assert.equal(choux.et0Mm, 60, '2 mm × 30 jours, pour information');
  // Objectif restant : du 30 septembre au 1er novembre (dimanche de W44), 33 jours.
  assert.equal(choux.objectiveRemainingMm, 66);

  const absent = buildSeriesWaterReport({ cropPlan, beds, plots, events, weather: days('2026-08-31', '2026-09-15', 1), goalRevisions: [], today: TODAY });
  const chouxAbsent = absent.series.find((item) => item.name === 'Choux');
  assert.equal(chouxAbsent?.rainMm, null, 'quinze jours sans donnée : la pluie reste absente, pas zéro');
  assert.equal(chouxAbsent?.rainAvailability.availableDays, 16);
  // Recette du 29 septembre 2026 : la ligne d'une planche affichait la somme des
  // jours disponibles comme si elle était complète.
  assert.equal(chouxAbsent?.beds[0].rainMm, null, 'la planche ne montre pas une somme partielle');
  const tomatesAbsent = absent.series.find((item) => item.name === 'Tomates');
  assert.equal(tomatesAbsent?.beds[0].rainMm, 0, 'sous abri, zéro reste zéro même sans météo');
  assert.equal(chouxAbsent?.objectiveMm, null, 'sans objectif fixé, pas d’écart');
  assert.equal(chouxAbsent?.gapToObjectiveMm, null);
});

test('un objectif posé après l’implantation se somme sur les jours qu’il couvre ; les jours d’avant comptent zéro (D-036)', () => {
  // Point ouvert 39 : Choux plantés W36 (31 août), observé jusqu'au 29 septembre, 30 jours ; premier objectif de la ferme
  // posé la semaine du 14 septembre, 14 mm : seize jours couverts, 14 × 16 / 7 = 32 mm, et l'écart se calcule.
  const cropPlan = plan({
    series: [series('choux', 'Choux', ['2026-W44'])],
    places: [{ id: 'p2', seriesId: 'choux', bedId: 'bed-n01', lengthMeters: 30 }],
    implantationTasks: [sowing('choux', '2026-W36')],
  });
  const weather = days('2026-08-31', '2026-09-29', 0);
  const [choux] = buildSeriesWaterReport({ cropPlan, beds, plots, events: [], weather, goalRevisions: [farmGoal(14, '2026-09-14')], today: TODAY }).series;
  assert.equal(choux.objectiveMm, 32);
  assert.deepEqual(choux.objectiveAvailability, { availableBedDays: 16, totalBedDays: 30, complete: false });
  assert.equal(choux.gapToObjectiveMm, 32, 'objectif 32 − irrigation 0 − pluie 0');
});

test('les séries à venir sont à part sans cumul, les séries en bloc et sans implantation comptées sans ligne', () => {
  const cropPlan = plan({
    series: [
      series('mache', 'Mâche', ['2026-W50']),
      series('radis', 'Radis', ['2026-W20']),
      series('endives', 'Endives', ['2026-W48'], { use: 'block' }),
      series('epinards', 'Épinards', ['2026-W48']),
    ],
    places: [{ id: 'p1', seriesId: 'mache', bedId: 'bed-n01', lengthMeters: 16 }, { id: 'p2', seriesId: 'epinards', bedId: 'bed-n02', lengthMeters: 30 }],
    implantationTasks: [
      { id: 't1', seriesId: 'mache', cultivationId: null, kind: 'planting', plannedWeek: '2026-W42', doneWeek: null, status: 'todo' },
      sowing('endives', '2026-W20'),
      sowing('epinards', '2026-W38'),
    ],
  });
  const events = [irrigation('a', '2026-09-20T06:00:00Z', [{ bedId: 'bed-n01', mm: 10 }])];
  const report = buildSeriesWaterReport({ cropPlan, beds, plots, events, weather: [], goalRevisions: [], today: TODAY });
  assert.deepEqual(report.series.map((item) => item.name), ['Épinards']);
  assert.deepEqual(report.upcoming.map((item) => item.name), ['Mâche']);
  assert.equal(report.upcoming[0].observedPeriod, null);
  assert.equal(report.upcoming[0].irrigationMm, null, 'rien n’est attribué avant l’implantation');
  assert.equal(report.upcoming[0].occupation.implantation.realized, false);
  assert.deepEqual(report.ignored, { block: 1, noImplantation: 1 });
});

test('la période d’une série commence au lundi 00:00 à la ferme, pas en UTC', () => {
  const period = periodBetween('2026-06-22', '2026-06-28');
  assert.equal(period.startAt, '2026-06-21T22:00:00.000Z', 'lundi 22 juin, minuit heure d’été');
  assert.equal(period.endAtExclusive, '2026-06-28T22:00:00.000Z');
  const winter = periodBetween('2025-11-03', '2025-11-09');
  assert.equal(winter.startAt, '2025-11-02T23:00:00.000Z', 'heure d’hiver');
});
