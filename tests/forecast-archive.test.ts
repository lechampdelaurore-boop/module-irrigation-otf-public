import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FORECAST_ARCHIVE_FIRST_HORIZON_DAYS,
  FORECAST_ARCHIVE_KEPT_MONTHS,
  FORECAST_ARCHIVE_LAST_HORIZON_DAYS,
  forecastArchiveRows,
  oldestKeptForecastArchiveDay,
} from '../lib/domain/weather/forecast-archive.ts';
import { addDaysToDateKey } from '../lib/domain/water-management.ts';
import type { WeatherDailyValue } from '../lib/domain/weather/weather-provider.ts';
import { archiveForecastReading } from '../lib/services/weather/forecast-archive.ts';

/**
 * L'archive des prévisions, sans base (docs/forecast-archive-contract.md,
 * D-297) : quelles lignes une lecture donne, jusqu'où remonte la
 * conservation, et ce qu'une écriture en échec laisse derrière elle. Les
 * preuves sur la base sont dans `tests/db/forecast-archive.test.ts`.
 */

const ISSUED_ON = '2026-11-23';

/** Une lecture de J0 à J+14, comme la tâche de 6 h 15 (docs/weather-contract.md). */
function fifteenDays(): WeatherDailyValue[] {
  return Array.from({ length: 15 }, (_, index) => ({
    date: addDaysToDateKey(ISSUED_ON, index),
    precipitationMm: index,
    et0Mm: 1 + index / 10,
    minimumTemperatureCelsius: -1 + index,
    maximumTemperatureCelsius: 10 + index,
    solarEnergyMegajoulesPerSquareMeter: 5 + index,
  }));
}

test('les horizons gardés vont de J+1 à J+7, sur 24 mois (règles 3 et 7)', () => {
  assert.equal(FORECAST_ARCHIVE_FIRST_HORIZON_DAYS, 1);
  assert.equal(FORECAST_ARCHIVE_LAST_HORIZON_DAYS, 7);
  assert.equal(FORECAST_ARCHIVE_KEPT_MONTHS, 24);
});

test('test 4 : une lecture de J0 à J+14 donne sept lignes, J+1 à J+7, ni J0 ni J+8 et au-delà', () => {
  const rows = forecastArchiveRows(ISSUED_ON, fifteenDays());
  assert.deepEqual(rows.map((row) => [row.targetDate, row.horizonDays]), [
    ['2026-11-24', 1], ['2026-11-25', 2], ['2026-11-26', 3], ['2026-11-27', 4],
    ['2026-11-28', 5], ['2026-11-29', 6], ['2026-11-30', 7],
  ]);
  assert.deepEqual(rows[0], {
    targetDate: '2026-11-24',
    horizonDays: 1,
    precipitationMm: 1,
    et0Mm: 1.1,
    minimumTemperatureCelsius: 0,
    maximumTemperatureCelsius: 11,
    solarEnergyMegajoulesPerSquareMeter: 6,
  }, 'les valeurs de la lecture, telles quelles, même 0 mm de pluie');
});

test('test 3 : une valeur absente reste nulle, jamais 0 ; un horizon absent ou vide n’a pas de ligne (règle 5)', () => {
  const values: WeatherDailyValue[] = [
    { date: '2026-11-24', precipitationMm: null, et0Mm: 2.1 },
    { date: '2026-11-25', precipitationMm: null, et0Mm: null, minimumTemperatureCelsius: null, maximumTemperatureCelsius: null, solarEnergyMegajoulesPerSquareMeter: null },
    { date: '2026-11-27', precipitationMm: 0, et0Mm: null },
  ];
  const rows = forecastArchiveRows(ISSUED_ON, values);
  assert.deepEqual(rows.map((row) => row.horizonDays), [1, 4], 'J+2 entièrement vide et J+3 absent : pas de ligne');
  assert.equal(rows[0].precipitationMm, null);
  assert.equal(rows[0].minimumTemperatureCelsius, null, 'une température non fournie reste nulle');
  assert.equal(rows[0].solarEnergyMegajoulesPerSquareMeter, null);
  assert.equal(rows[1].precipitationMm, 0, 'un 0 fourni reste 0');
  assert.equal(rows[1].et0Mm, null);
});

test('une lecture de la semaine affichée, qui ne va que jusqu’au dimanche, ne donne que ses horizons', () => {
  const rows = forecastArchiveRows('2026-11-28', fifteenDays().filter((value) => value.date >= '2026-11-28' && value.date <= '2026-11-29'));
  assert.deepEqual(rows.map((row) => [row.targetDate, row.horizonDays]), [['2026-11-29', 1]]);
});

test('test 8 : la conservation garde le même jour, vingt-quatre mois plus tôt, et pas la veille', () => {
  assert.equal(oldestKeptForecastArchiveDay('2026-11-28'), '2024-11-28');
  assert.equal(oldestKeptForecastArchiveDay('2026-01-01'), '2024-01-01');
  assert.equal(oldestKeptForecastArchiveDay('2026-02-28'), '2024-02-28');
  assert.equal(oldestKeptForecastArchiveDay('2028-02-29'), '2026-02-28', 'un 29 février sans pareil deux ans plus tôt : le dernier jour du mois');
});

test('le jour d’émission est le jour civil de Paris de la lecture, pas celui de l’UTC (D-004)', async () => {
  const written: { issuedOn: string; targetDates: string[] }[] = [];
  const write = async (snapshot: { issuedOn: string; rows: readonly { targetDate: string }[] }) => {
    written.push({ issuedOn: snapshot.issuedOn, targetDates: snapshot.rows.map((row) => row.targetDate) });
    return snapshot.rows.length;
  };
  // 23 h 30 UTC le 22 novembre : déjà le 23 à Paris.
  const count = await archiveForecastReading({
    write, locationKey: 'otf:ferme', values: fifteenDays(), source: 'visual-crossing',
    fetchedAt: '2026-11-22T23:30:00.000Z', now: new Date('2026-11-22T23:30:00.000Z'), log: () => undefined,
  });
  assert.equal(count, 7);
  assert.equal(written[0].issuedOn, '2026-11-23');
  assert.equal(written[0].targetDates[0], '2026-11-24');
});

test('test 5 : une écriture en échec ne remonte pas ; le journal dit le service, le statut et la date, sans coordonnées ni adresse ni message', async () => {
  const lines: { level: string; entry: Record<string, unknown> }[] = [];
  const count = await archiveForecastReading({
    write: async () => { throw new Error('D1_ERROR: https://api.example/v1?latitude=46.42&longitude=3.06 refusé'); },
    locationKey: 'custom:tronget:03240',
    values: fifteenDays(),
    source: 'visual-crossing',
    fetchedAt: '2026-11-23T05:15:00.000Z',
    now: new Date('2026-11-23T05:15:00.000Z'),
    log: (level, entry) => lines.push({ level, entry }),
  });
  assert.equal(count, null, 'l’échec est rendu, jamais levé');
  assert.equal(lines.length, 1);
  assert.equal(lines[0].level, 'warn');
  assert.deepEqual(Object.keys(lines[0].entry).sort(), ['event', 'failedAt', 'service', 'status']);
  assert.equal(lines[0].entry.event, 'weather_forecast_archive_failed');
  assert.equal(lines[0].entry.service, 'forecast-archive');
  assert.equal(lines[0].entry.status, 'failed');
  const text = JSON.stringify(lines);
  for (const forbidden of ['latitude', '46.42', 'https://', 'tronget', 'D1_ERROR']) assert.ok(!text.includes(forbidden), forbidden);
});

test('une lecture sans aucun horizon gardé n’écrit rien et ne journalise rien', async () => {
  let calls = 0;
  const lines: unknown[] = [];
  const count = await archiveForecastReading({
    write: async () => { calls += 1; return 0; },
    locationKey: 'otf:ferme',
    values: [{ date: ISSUED_ON, precipitationMm: 3, et0Mm: 1 }],
    source: 'visual-crossing',
    fetchedAt: '2026-11-23T05:15:00.000Z',
    now: new Date('2026-11-23T05:15:00.000Z'),
    log: (_level, entry) => lines.push(entry),
  });
  assert.equal(count, 0);
  assert.equal(calls, 0, 'J0 seul : aucune écriture');
  assert.deepEqual(lines, []);
});
