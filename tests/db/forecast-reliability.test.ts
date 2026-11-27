import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { writeForecastArchive } from '../../db/forecast-archive-repository';
import { readForecastReliabilityInputsForUser } from '../../db/forecast-reliability-repository';
import { saveManualRainfallForUser, upsertWeatherDailyValuesForUser } from '../../db/water-management-repository';
import { ensureWorkspaceForUser } from '../../db/workspace-repository';
import { addDaysToDateKey } from '../../lib/domain/water-management';
import { forecastArchiveRows } from '../../lib/domain/weather/forecast-archive';
import { customWeatherLocationKey } from '../../lib/domain/weather/location';
import { getForecastReliabilityForUser } from '../../lib/services/forecast-reliability';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { ALICE, BOB } from '../support/spaces';

/**
 * La météo prévue contre la météo réalisée, sur la base de test
 * (docs/forecast-reliability-contract.md, section 8, tests 7 et 8 ; D-338,
 * PR 1) : la lecture en lecture seule, l'archive et le réalisé d'une seule
 * exploitation et de son lieu actuel.
 */

const VANNES = customWeatherLocationKey('Vannes', '56000');
const AURAY = customWeatherLocationKey('Auray', '56400');
/** Jeudi 31 décembre 2026, midi à Paris : la fenêtre va du 2 octobre au 30 décembre. */
const NOW = new Date('2026-12-31T11:00:00.000Z');
const FIRST_TARGET = '2026-12-01';
const DAYS = 14;

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

/** Quatorze jours visés, annoncés la veille (`rainMm`), et leur réanalyse (`realisedMm`), pour une exploitation et un lieu. */
async function seed(owner: string, locationKey: string, rainMm: number, realisedMm: number) {
  const workspaceId = await ensureWorkspaceForUser(owner);
  for (let index = 0; index < DAYS; index += 1) {
    const target = addDaysToDateKey(FIRST_TARGET, index);
    const issuedOn = addDaysToDateKey(target, -1);
    await writeForecastArchive({
      workspaceId, locationKey, issuedOn, source: 'visual-crossing', fetchedAt: `${issuedOn}T05:15:00.000Z`,
      rows: forecastArchiveRows(issuedOn, [{ date: target, precipitationMm: rainMm, et0Mm: 1 }]),
    });
  }
  await upsertWeatherDailyValuesForUser(owner, locationKey, 'reanalysis',
    Array.from({ length: DAYS }, (_, index) => ({ date: addDaysToDateKey(FIRST_TARGET, index), precipitationMm: realisedMm, et0Mm: 1.5 })),
    'open-meteo', '2026-12-30T05:15:00.000Z');
}

test('test 8 : deux fermes au même lieu ; chacune ne lit que ses prévisions, sa réanalyse et son pluviomètre', async () => {
  await seed(ALICE, VANNES, 5, 1);
  await seed(BOB, VANNES, 2, 2);
  for (let index = 0; index < DAYS; index += 1) await saveManualRainfallForUser(BOB, addDaysToDateKey(FIRST_TARGET, index), 7);

  const alice = await getForecastReliabilityForUser({ ownerUserId: ALICE, locationKey: VANNES, now: NOW });
  assert.equal(alice.status, 'ready');
  assert.deepEqual(alice.rainEstimated.daily[0].gaps, { meanGapMm: 4, meanAbsoluteGapMm: 4 }, 'les 5 mm annoncés à Alice, son 1 mm estimé');
  assert.equal(alice.rainMeasured.measuredDays, 0, 'le pluviomètre de Bob n’est pas celui d’Alice');
  assert.equal(alice.rainMeasured.result, null);

  const bob = await getForecastReliabilityForUser({ ownerUserId: BOB, locationKey: VANNES, now: NOW });
  assert.deepEqual(bob.rainEstimated.daily[0].gaps, { meanGapMm: 0, meanAbsoluteGapMm: 0 });
  assert.equal(bob.rainMeasured.measuredDays, DAYS);
  assert.deepEqual(bob.rainMeasured.result?.daily[0].gaps, { meanGapMm: -5, meanAbsoluteGapMm: 5 }, '2 mm annoncés, 7 notés');

  const inputs = await readForecastReliabilityInputsForUser(ALICE, VANNES, { startDate: '2026-10-02', endDate: '2026-12-30' });
  assert.equal(inputs.archive.length, DAYS);
  assert.ok(inputs.archive.every((row) => row.precipitationMm === 5), 'aucune ligne de Bob');
  assert.equal(inputs.realised.length, DAYS);
  assert.ok(inputs.realised.every((row) => row.dataKind === 'reanalysis' && row.precipitationMm === 1));
});

test('test 7 : après un changement de commune, seuls le lieu actuel et le pluviomètre de la ferme entrent', async () => {
  await seed(ALICE, VANNES, 9, 1);
  await seed(ALICE, AURAY, 3, 1);
  await saveManualRainfallForUser(ALICE, FIRST_TARGET, 2);
  const inputs = await readForecastReliabilityInputsForUser(ALICE, AURAY, { startDate: '2026-10-02', endDate: '2026-12-30' });
  assert.ok(inputs.archive.every((row) => row.locationKey === AURAY));
  assert.deepEqual([...new Set(inputs.realised.map((row) => `${row.dataKind}:${row.locationKey}`))].sort(), ['manual_precipitation:farm:manual', `reanalysis:${AURAY}`]);
  const atAuray = await getForecastReliabilityForUser({ ownerUserId: ALICE, locationKey: AURAY, now: NOW });
  assert.deepEqual(atAuray.rainEstimated.daily[0].gaps, { meanGapMm: 2, meanAbsoluteGapMm: 2 }, 'les 3 mm d’Auray, jamais les 9 mm de Vannes');
});

test('les prévisions des jours hors de la fenêtre ne sont pas lues ; sans lieu ni ferme, rien n’est lu', async () => {
  await seed(ALICE, VANNES, 5, 1);
  const later = await getForecastReliabilityForUser({ ownerUserId: ALICE, locationKey: VANNES, now: new Date('2027-03-07T11:00:00.000Z') });
  assert.equal(later.rainEstimated.daily[3].pairCount, 8, 'le 7 mars, la fenêtre commence le 7 décembre : les six premiers jours de décembre sont sortis');

  const noLocation = await getForecastReliabilityForUser({ ownerUserId: ALICE, locationKey: null, now: NOW });
  assert.equal(noLocation.status, 'noLocation');
  assert.deepEqual(await readForecastReliabilityInputsForUser('personne', VANNES, { startDate: '2026-10-02', endDate: '2026-12-30' }), { archive: [], realised: [] });
});

test('la lecture n’écrit rien', async () => {
  await seed(ALICE, VANNES, 5, 1);
  const count = () => Number((database.sqlite.prepare(
    `SELECT (SELECT COUNT(*) FROM irrigation_weather_forecast_archive) + (SELECT COUNT(*) FROM irrigation_weather_daily_values) AS n`,
  ).get() as { n: number }).n);
  const before = count();
  await getForecastReliabilityForUser({ ownerUserId: ALICE, locationKey: VANNES, now: NOW });
  assert.equal(count(), before);
});
