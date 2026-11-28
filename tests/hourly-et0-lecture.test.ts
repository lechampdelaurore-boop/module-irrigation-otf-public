import assert from 'node:assert/strict';
import test from 'node:test';
import { OpenMeteoWeatherProvider } from '../lib/adapters/weather/open-meteo-provider.ts';
import { VisualCrossingWeatherProvider } from '../lib/adapters/weather/visual-crossing-provider.ts';
import {
  computedHourlyEt0Mm,
  fao56HourlyEt0Mm,
  hourlyExtraterrestrialRadiationMj,
  saturationVaporPressureKpa,
  type ForecastHourInput,
} from '../lib/domain/weather/fao56-hourly.ts';
import {
  DAY_SHAPES_KEPT_DAYS,
  dayShapesToRecord,
  hourlyValuesInLocalOrder,
  hourlyValuesOnDayHours,
  hoursOfDay,
  oldestKeptDayShapeDay,
  type HourlyEt0Series,
} from '../lib/domain/weather/hourly-et0.ts';
import { RETENTION_LIMITS, RETENTION_WORDS } from '../lib/domain/operations/retention.ts';
import { megajoulesPerSquareMeterPerHourFromWattsPerSquareMeter } from '../lib/domain/units.ts';
import type { WeatherDailyValue, WeatherProvider, WeatherReadInput } from '../lib/domain/weather/weather-provider.ts';
import { recordDayShapes } from '../lib/services/weather/day-shapes.ts';
import {
  runAutomaticWeatherSync,
  type AutomaticWeatherSyncRepository,
  type AutomaticWeatherTarget,
} from '../lib/services/weather/automatic-sync.ts';

/**
 * L'ET0 horaire, la lecture et l'écriture de la forme de la journée
 * (docs/et0-horaire-contract.md, D-349, PR HR2) : l'ET0 FAO-56 à l'heure,
 * les heures du fournisseur rangées sur les heures du jour, les formes
 * écrites (J0 à J+2, par source), et les scénarios 7, 10 et 11 de la
 * section 11 du contrat. La table elle-même est éprouvée par
 * `tests/db/day-shapes.test.ts`.
 */

const PARIS = 'Europe/Paris';
const TRONGET = { latitude: 46.4225, longitude: 3.068 };
const READ: WeatherReadInput = { ...TRONGET, timezone: PARIS, startDate: '2026-06-15', endDate: '2026-06-17' };
const close = (actual: number | null, expected: number, tolerance: number) => {
  assert.ok(actual !== null, 'valeur inconnue');
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} au lieu de ${expected}`);
};

test('ET0 horaire FAO-56 : l’exemple 19 du bulletin, 0,63 mm de 14 h à 15 h et 0,00 mm la nuit', () => {
  // N'Diaye (Sénégal), 16°13' N, 8 m, 1er octobre (FAO-56, exemple 19).
  close(fao56HourlyEt0Mm({
    temperatureCelsius: 38, actualVaporPressureKpa: saturationVaporPressureKpa(38) * 0.52,
    windAtTwoMetersMetersPerSecond: 3.3, netRadiationMj: 1.749, elevationMeters: 8, daytime: true,
  }), 0.63, 0.005);
  close(fao56HourlyEt0Mm({
    temperatureCelsius: 28, actualVaporPressureKpa: saturationVaporPressureKpa(28) * 0.90,
    windAtTwoMetersMetersPerSecond: 1.9, netRadiationMj: -0.100, elevationMeters: 8, daytime: false,
  }), 0.00, 0.005);
  // Ra = 3,543 MJ/m² de 14 h à 15 h, heure locale du fuseau de 15° O, soit 15 h à 16 h UTC.
  close(hourlyExtraterrestrialRadiationMj(Date.UTC(2026, 9, 1, 15), { latitude: 16 + 13 / 60, longitude: -16.25 }), 3.543, 0.002);
  assert.equal(hourlyExtraterrestrialRadiationMj(Date.UTC(2026, 9, 1, 2), { latitude: 16 + 13 / 60, longitude: -16.25 }), 0);
  close(megajoulesPerSquareMeterPerHourFromWattsPerSquareMeter(680.6), 2.450, 0.001);
});

/** Une journée d'été prévue heure par heure à Tronget, comme la donne Visual Crossing (heure de Paris, UTC+2). */
function summerHours(date = '2026-06-15'): ForecastHourInput[] {
  return hoursOfDay(date, PARIS).map((hour) => {
    const local = hour.localHour;
    const sun = Math.max(0, Math.sin(Math.PI * (local - 6) / 16));
    return {
      startsAtMs: Date.parse(hour.startsAt),
      temperatureCelsius: 14 + 12 * sun,
      dewPointCelsius: 11,
      windSpeedAtTenMetersKilometersPerHour: 8 + 6 * sun,
      solarRadiationWattsPerSquareMeter: 850 * sun,
    };
  });
}

test('ET0 horaire calculée d’une journée : presque rien la nuit, le plus fort l’après-midi', () => {
  const values = computedHourlyEt0Mm(summerHours(), { ...TRONGET, elevationMeters: 400 });
  assert.equal(values.length, 24);
  assert.ok(values.every((value) => value !== null));
  const night = values[2] ?? 0;
  assert.ok(Math.abs(night) < 0.05, `nuit : ${night}`);
  const peak = values.indexOf(Math.max(...values.map((value) => value ?? 0)));
  assert.ok(peak >= 12 && peak <= 15, `maximum à l'heure ${peak}`);
  const total = values.reduce((sum: number, value) => sum + (value ?? 0), 0);
  assert.ok(total > 3 && total < 7, `total ${total} mm, une journée d'été`);
});

test('ET0 horaire calculée : une heure incomplète reste absente, jamais 0 (D-003)', () => {
  const hours = summerHours();
  hours[13] = { ...hours[13], solarRadiationWattsPerSquareMeter: null };
  hours[3] = { ...hours[3], dewPointCelsius: null };
  const values = computedHourlyEt0Mm(hours, { ...TRONGET, elevationMeters: 400 });
  assert.equal(values[13], null);
  assert.equal(values[3], null);
  assert.ok(values[12] !== null);
});

test('les heures d’un instant exact se rangent sur les heures du jour ; une heure sans valeur reste absente', () => {
  const hours = hoursOfDay('2026-06-15', PARIS);
  const points = hours.slice(1).map((hour) => ({ startsAtMs: Date.parse(hour.startsAt), valueMm: 0.1 }));
  const values = hourlyValuesOnDayHours('2026-06-15', PARIS, [...points, { startsAtMs: Date.parse('2026-06-16T10:00:00Z'), valueMm: 9 }]);
  assert.equal(values.length, 24);
  assert.equal(values[0], null);
  assert.ok(values.slice(1).every((value) => value === 0.1));
});

test('les heures d’horloge locales ne se rangent que si leur nombre est celui des heures du jour (F1039)', () => {
  const day = (date: string, count: number) => Array.from({ length: count }, (_, index) => `${date}T${String(index).padStart(2, '0')}:00`);
  const ordinary = hourlyValuesInLocalOrder('2026-06-15', PARIS, [...day('2026-06-15', 24), '2026-06-16T00:00'], [...Array(24).fill(0.1), 7]);
  assert.equal(ordinary?.length, 24);
  assert.ok(ordinary?.every((value) => value === 0.1));
  // Passage à l'heure d'été : 24 heures annoncées pour un jour qui en compte 23, refusées plutôt que décalées.
  assert.equal(hourlyValuesInLocalOrder('2026-03-29', PARIS, day('2026-03-29', 24), Array(24).fill(0.1)), null);
  const spring = ['00', '01', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23']
    .map((hour) => `2026-03-29T${hour}:00`);
  assert.equal(hourlyValuesInLocalOrder('2026-03-29', PARIS, spring, Array(23).fill(0.1))?.length, 23);
  assert.equal(hourlyValuesInLocalOrder('2026-06-15', PARIS, day('2026-06-15', 24), Array(23).fill(0.1)), null, 'séries de longueurs différentes');
  const withText = hourlyValuesInLocalOrder('2026-06-15', PARIS, day('2026-06-15', 24), [...Array(23).fill(0.1), 'x']);
  assert.equal(withText?.[23], null, 'une valeur illisible reste absente');
});

const series = (nature: HourlyEt0Series['nature'], valuesMm: (number | null)[]): HourlyEt0Series => ({ nature, valuesMm });
const shapeOf = (count = 24) => Array.from({ length: count }, (_, index) => (index >= 6 && index < 20 ? 0.1 : 0));

test('formes écrites : J0 à J+2 seulement, un jour sans heure lisible n’a pas de ligne (scénario 7)', () => {
  const withHole: (number | null)[] = shapeOf();
  withHole[13] = null;
  const rows = dayShapesToRecord({
    today: '2026-06-15',
    timeZone: PARIS,
    days: [
      { date: '2026-06-14', hourlyEt0: series('provider-hourly', shapeOf()) },
      { date: '2026-06-15', hourlyEt0: series('provider-hourly', shapeOf()) },
      { date: '2026-06-16', hourlyEt0: series('computed-hourly', shapeOf()) },
      { date: '2026-06-17', hourlyEt0: series('provider-hourly', withHole) },
      { date: '2026-06-18', hourlyEt0: series('provider-hourly', shapeOf()) },
      { date: '2026-06-19' },
    ],
  });
  assert.deepEqual(rows.map((row) => [row.date, row.nature]), [['2026-06-15', 'provider-hourly'], ['2026-06-16', 'computed-hourly']]);
  close(rows[0].shares.reduce((total, share) => total + share, 0), 1, 1e-12);
});

test('conservation : 8 jours, purgés chaque matin par jour', () => {
  assert.equal(DAY_SHAPES_KEPT_DAYS, 8);
  assert.equal(oldestKeptDayShapeDay('2026-06-15'), '2026-06-07');
  assert.equal(RETENTION_LIMITS.irrigation_weather_day_shapes(Date.parse('2026-06-15T04:30:00Z')), '2026-06-07');
  assert.equal(RETENTION_WORDS.irrigation_weather_day_shapes, '8 jours');
});

/** Une réponse de Visual Crossing à heures, pour deux jours. */
function visualCrossingPayload() {
  return {
    queryCost: 1,
    elevation: 400,
    days: ['2026-06-15', '2026-06-16'].map((date) => ({
      datetime: date, precip: 0, tempmax: 26, tempmin: 14, temp: 20, dew: 11, windspeedmean: 10, solarenergy: 25,
      hours: summerHours(date).map((hour) => ({
        datetimeEpoch: hour.startsAtMs / 1_000,
        temp: hour.temperatureCelsius,
        dew: hour.dewPointCelsius,
        windspeed: hour.windSpeedAtTenMetersKilometersPerHour,
        solarradiation: hour.solarRadiationWattsPerSquareMeter,
      })),
    })),
  };
}

test('Visual Crossing : les heures avec la prévision seulement, l’ET0 de l’heure calculée, le coût de la requête journalisé', async () => {
  const includes: Record<string, string | null> = {};
  const lines: Record<string, unknown>[] = [];
  const provider = new VisualCrossingWeatherProvider('secret-test', async (input) => {
    const url = new URL(input);
    const endpoint = url.pathname.includes('2026-06-10') ? 'reanalysis' : 'forecast';
    includes[endpoint] = url.searchParams.get('include');
    return Response.json(endpoint === 'forecast' ? visualCrossingPayload() : { queryCost: 3, days: [] });
  }, { searchLocations: async () => [] }, (_level, entry) => lines.push(entry));
  const days = await provider.readForecast(READ);
  await provider.readReanalysis({ ...READ, startDate: '2026-06-10', endDate: '2026-06-12' });
  assert.deepEqual(includes, { forecast: 'days,hours', reanalysis: 'days' }, 'jamais les heures de l’historique, une heure par enregistrement');
  assert.equal(days[0].hourlyEt0?.nature, 'computed-hourly');
  assert.equal(days[0].hourlyEt0?.valuesMm.length, 24);
  assert.ok(days[0].hourlyEt0?.valuesMm.every((value) => value !== null));
  assert.equal(days[0].et0Mm !== null, true, 'le total du jour reste celui du calcul du jour');
  const costs = lines.filter((line) => line.event === 'weather_external_query_cost');
  assert.deepEqual(costs.map((line) => [line.endpoint, line.queryCost, line.withHours]), [['forecast', 1, true], ['reanalysis', 3, false]]);
  assert.ok(costs.every((line) => !JSON.stringify(line).includes('46.42')), 'jamais les coordonnées');
});

test('Open-Meteo : l’ET0 de l’heure du fournisseur dans le même appel, pour le modèle de chaque jour (§ 9)', async () => {
  const calls: URL[] = [];
  const time = ['2026-06-15', '2026-06-16'].flatMap((date) => Array.from({ length: 24 }, (_, hour) => `${date}T${String(hour).padStart(2, '0')}:00`));
  const reader = new OpenMeteoWeatherProvider(async (input) => {
    const url = new URL(input);
    calls.push(url);
    return Response.json({
      daily: {
        time: ['2026-06-15', '2026-06-16'],
        ...Object.fromEntries(['meteofrance_seamless', 'best_match'].flatMap((model) => [
          [`precipitation_sum_${model}`, model === 'best_match' ? [0, 0] : [0, null]],
          [`temperature_2m_min_${model}`, [12, 12]],
          [`temperature_2m_max_${model}`, [25, 25]],
          [`et0_fao_evapotranspiration_${model}`, [4, 4]],
          [`shortwave_radiation_sum_${model}`, [25, 25]],
        ])),
      },
      hourly: {
        time,
        et0_fao_evapotranspiration_meteofrance_seamless: time.map((stamp) => (stamp.startsWith('2026-06-15') ? 0.2 : null)),
        et0_fao_evapotranspiration_best_match: time.map(() => 0.1),
      },
    });
  }, () => undefined);
  const days = await reader.readModelForecast(READ, 'meteofrance_seamless');
  assert.equal(calls.length, 1, 'aucun appel de plus');
  assert.equal(calls[0].searchParams.get('hourly'), 'et0_fao_evapotranspiration');
  assert.deepEqual(days.map((day) => [day.date, day.source, day.hourlyEt0?.nature, day.hourlyEt0?.valuesMm[12]]), [
    ['2026-06-15', 'open-meteo:meteofrance_seamless', 'provider-hourly', 0.2],
    ['2026-06-16', 'open-meteo:best_match', 'provider-hourly', 0.1],
  ], 'un jour complété porte les heures d’« Automatique d’Open-Meteo », jamais celles du modèle');
});

test('Open-Meteo : sans heures dans la réponse, les jours se lisent comme avant, sans forme', async () => {
  const provider = new OpenMeteoWeatherProvider(async () => Response.json({
    daily: { time: ['2026-06-15'], precipitation_sum: [0], et0_fao_evapotranspiration: [4] },
  }), () => undefined);
  assert.deepEqual(await provider.readForecast(READ), [{ date: '2026-06-15', precipitationMm: 0, et0Mm: 4 }]);
});

const target = (workspaceId: string, overrides: Partial<AutomaticWeatherTarget> = {}): AutomaticWeatherTarget => ({
  workspaceId, locationKey: 'custom:tronget:03240', ...TRONGET, timezone: PARIS, refreshNotBeforeAt: null, ...overrides,
});

class HourlyProvider implements WeatherProvider {
  readonly id = 'fake';
  calls = 0;
  async searchLocations() { return []; }
  async readForecast(): Promise<WeatherDailyValue[]> {
    this.calls += 1;
    return ['2026-06-15', '2026-06-16', '2026-06-17', '2026-06-18'].map((date) => ({
      date, precipitationMm: 0, et0Mm: 4, hourlyEt0: series('computed-hourly', shapeOf()),
    }));
  }
  async readReanalysis(): Promise<WeatherDailyValue[]> { return []; }
}

class ShapeRepository implements AutomaticWeatherSyncRepository {
  shapes: Parameters<NonNullable<AutomaticWeatherSyncRepository['writeDayShapes']>>[0][] = [];
  values: string[] = [];
  recorded: boolean[] = [];
  fails = false;
  private readonly targets: AutomaticWeatherTarget[];
  constructor(targets: AutomaticWeatherTarget[]) {
    this.targets = targets;
  }
  async claimJob() { return 'jeton'; }
  async finishJob() {}
  async listTargets() { return this.targets; }
  async upsertValues(input: Parameters<AutomaticWeatherSyncRepository['upsertValues']>[0]) {
    this.values.push(...input.values.map((value) => `${input.target.workspaceId}:${value.date}`));
  }
  async archiveForecast() { return 0; }
  async writeDayShapes(input: Parameters<NonNullable<AutomaticWeatherSyncRepository['writeDayShapes']>>[0]) {
    if (this.fails) throw new Error('D1_ERROR: écriture refusée');
    this.shapes.push(input);
    return input.rows.length;
  }
  async recordWorkspaceResult(input: { successful: boolean }) { this.recorded.push(input.successful); }
}

test('scénario 11 : deux fermes sur un lieu, une lecture, une forme écrite une fois pour le lieu', async () => {
  const repository = new ShapeRepository([target('a'), target('b')]);
  const provider = new HourlyProvider();
  await runAutomaticWeatherSync({
    repository, provider, now: new Date('2026-06-15T04:15:00Z'), retry: { sleep: async () => undefined }, log: () => undefined,
  });
  assert.equal(provider.calls, 1);
  assert.equal(repository.shapes.length, 1);
  assert.equal(repository.shapes[0].placeKey, '46.422500:3.068000:Europe/Paris', 'le lieu, jamais une ferme');
  assert.equal(repository.shapes[0].source, 'fake');
  assert.deepEqual(repository.shapes[0].rows.map((row) => row.date), ['2026-06-15', '2026-06-16', '2026-06-17']);
  assert.equal(repository.values.length, 8, 'chaque ferme écrit ses lignes du jour, comme avant');
});

test('scénario 10 : une écriture de la forme qui échoue ne fait échouer ni la lecture ni ce qu’elle écrit', async () => {
  const repository = new ShapeRepository([target('a')]);
  repository.fails = true;
  const lines: Record<string, unknown>[] = [];
  const result = await runAutomaticWeatherSync({
    repository, provider: new HourlyProvider(), now: new Date('2026-06-15T04:15:00Z'), retry: { sleep: async () => undefined },
    log: (_level, entry) => lines.push(entry),
  });
  assert.equal(result.successfulTargets, 1);
  assert.equal(result.failedTargets, 0);
  assert.deepEqual(repository.recorded, [true]);
  assert.equal(repository.values.length, 4, 'la météo du jour est écrite');
  assert.deepEqual(lines.filter((line) => line.event === 'weather_day_shape_failed').map((line) => Object.keys(line).sort()),
    [['event', 'failedAt', 'service', 'status']], 'le statut et la date seulement');
});

test('les jours d’une lecture s’écrivent sous la source de leur ligne du jour, jamais mélangés', async () => {
  const written: { source: string; dates: string[] }[] = [];
  const count = await recordDayShapes({
    write: async (input) => {
      written.push({ source: input.source, dates: input.rows.map((row) => row.date) });
      return input.rows.length;
    },
    placeKey: 'lieu',
    timeZone: PARIS,
    values: [
      { date: '2026-06-15', precipitationMm: 0, et0Mm: 4, source: 'open-meteo:meteofrance_seamless', hourlyEt0: series('provider-hourly', shapeOf()) },
      { date: '2026-06-16', precipitationMm: 0, et0Mm: 4, source: 'open-meteo:best_match', hourlyEt0: series('provider-hourly', shapeOf()) },
      { date: '2026-06-17', precipitationMm: 0, et0Mm: 4, source: 'open-meteo:best_match' },
    ],
    providerSource: 'visual-crossing',
    fetchedAt: '2026-06-15T04:15:00.000Z',
    now: new Date('2026-06-15T04:15:00Z'),
    log: () => undefined,
  });
  assert.equal(count, 2);
  assert.deepEqual(written, [
    { source: 'open-meteo:meteofrance_seamless', dates: ['2026-06-15'] },
    { source: 'open-meteo:best_match', dates: ['2026-06-16'] },
  ]);
});

test('sans écriture prévue par le dépôt (démonstration), rien ne s’écrit et la lecture se fait comme avant', async () => {
  const repository = new ShapeRepository([target('a')]);
  const withoutShapes: AutomaticWeatherSyncRepository = {
    claimJob: () => repository.claimJob(),
    finishJob: () => repository.finishJob(),
    listTargets: () => repository.listTargets(),
    upsertValues: (input) => repository.upsertValues(input),
    archiveForecast: () => repository.archiveForecast(),
    recordWorkspaceResult: (input) => repository.recordWorkspaceResult(input),
  };
  const result = await runAutomaticWeatherSync({
    repository: withoutShapes, provider: new HourlyProvider(), now: new Date('2026-06-15T04:15:00Z'), retry: { sleep: async () => undefined }, log: () => undefined,
  });
  assert.equal(result.successfulTargets, 1);
  assert.equal(repository.shapes.length, 0);
});
