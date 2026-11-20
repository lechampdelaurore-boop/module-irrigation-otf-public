import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { overrideDatabase } from '../../db/binding';
import { finishAutomaticWeatherSync, tryClaimAutomaticWeatherSync } from '../../db/automatic-weather-repository';
import { readTaskRuns, recordTaskRun } from '../../db/task-run-repository';
import { EMPTY_TASK_RUN } from '../../lib/domain/operations/task-state';
import type { MorningRunReport, WeatherFailureKind } from '../../lib/domain/operations/morning-task-outcomes';
import { readTaskStates, recordMorningTaskRuns } from '../../lib/services/task-runs';
import { applyMigrationsAfter, createMigratedSqliteDatabase, installTestDatabase, type TestDatabase } from '../support/d1-sqlite';

/**
 * Les exécutions des tâches du registre, gardées dans la base (4.5, PR 1 ;
 * docs/tranche-4-contract.md, F560, F603, F604).
 */

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

test('une exécution réussie, puis deux manquées, puis une réussie : la dernière réussite et le compte des échecs', async () => {
  assert.deepEqual((await readTaskRuns(['weather-reanalysis'])).get('weather-reanalysis'), EMPTY_TASK_RUN, 'jamais exécutée : rien de gardé');

  await recordTaskRun({ task: 'weather-reanalysis', at: '2026-11-13T05:16:00.000Z', successful: true, error: 'ignorée' });
  assert.deepEqual((await readTaskRuns(['weather-reanalysis'])).get('weather-reanalysis'), {
    lastSuccessAt: '2026-11-13T05:16:00.000Z', lastAttemptAt: '2026-11-13T05:16:00.000Z', lastError: null, consecutiveFailures: 0, failingSince: null,
  }, 'une réussite ne garde aucune erreur');

  await recordTaskRun({ task: 'weather-reanalysis', at: '2026-11-14T05:16:00.000Z', successful: false, error: '1 lieu sur 1 sans pluie estimée (réseau)' });
  await recordTaskRun({ task: 'weather-reanalysis', at: '2026-11-15T05:16:00.000Z', successful: false, error: '1 lieu sur 1 sans pluie estimée (délai dépassé)' });
  assert.deepEqual((await readTaskRuns(['weather-reanalysis'])).get('weather-reanalysis'), {
    lastSuccessAt: '2026-11-13T05:16:00.000Z',
    lastAttemptAt: '2026-11-15T05:16:00.000Z',
    lastError: '1 lieu sur 1 sans pluie estimée (délai dépassé)',
    consecutiveFailures: 2,
    failingSince: '2026-11-14T05:16:00.000Z',
  }, 'la réussite reste celle du 13, « en panne depuis » le premier échec');

  await recordTaskRun({ task: 'weather-reanalysis', at: '2026-11-16T05:16:00.000Z', successful: true, error: null });
  assert.deepEqual((await readTaskRuns(['weather-reanalysis'])).get('weather-reanalysis'), {
    lastSuccessAt: '2026-11-16T05:16:00.000Z', lastAttemptAt: '2026-11-16T05:16:00.000Z', lastError: null, consecutiveFailures: 0, failingSince: null,
  }, 'une réussite remet tout à zéro');
});

test('une première exécution manquée : un échec, pas de réussite inventée', async () => {
  await recordTaskRun({ task: 'otf-vault-morning', at: '2026-11-20T05:16:00.000Z', successful: false, error: 'erreur du coffre' });
  assert.deepEqual((await readTaskRuns(['otf-vault-morning', 'morning-calculation'])), new Map([
    ['otf-vault-morning', { lastSuccessAt: null, lastAttemptAt: '2026-11-20T05:16:00.000Z', lastError: 'erreur du coffre', consecutiveFailures: 1, failingSince: '2026-11-20T05:16:00.000Z' }],
    ['morning-calculation', EMPTY_TASK_RUN],
  ]));
});

test('les lignes des tâches ne touchent pas au verrou de la météo, ni lui à elles', async () => {
  const token = await tryClaimAutomaticWeatherSync('2026-11-20T05:15:00.000Z', '2026-11-20T05:25:00.000Z');
  assert.ok(token);
  await recordTaskRun({ task: 'weather-forecast', at: '2026-11-20T05:16:00.000Z', successful: false, error: 'réseau' });
  await finishAutomaticWeatherSync({ token: token!, at: '2026-11-20T05:16:00.000Z', successful: true, error: null });
  const rows = database.sqlite.prepare('SELECT job_key, last_successful_at, consecutive_failures FROM irrigation_background_jobs ORDER BY job_key').all();
  assert.deepEqual(rows.map((row) => ({ ...row })), [
    { job_key: 'automatic-weather-sync', last_successful_at: '2026-11-20T05:16:00.000Z', consecutive_failures: 0 },
    { job_key: 'task:weather-forecast', last_successful_at: null, consecutive_failures: 1 },
  ]);
});

const morning = (reanalysisFailures: WeatherFailureKind[]): MorningRunReport => ({
  weather: { status: 'completed', locations: 1, skippedBackoff: 0, forecastFailures: [], reanalysisFailures },
  planning: { failed: 0 }, cropWater: { failed: 0 }, soilReserve: { failed: 0 }, cropDrying: { failed: 0 },
  otfVault: { status: 'dormant' },
});

test('la panne du 14 novembre 2026 rejouée : la réanalyse passe en retard, puis en panne, pendant que les prévisions restent vertes', async () => {
  const silent = () => undefined;
  await recordMorningTaskRuns(morning([]), { at: '2026-11-13T05:16:00.000Z', log: silent });
  const states = async (now: string) => Object.fromEntries((await readTaskStates(new Date(now)))
    .map(({ declaration, state }) => [declaration.key, state.kind]));
  assert.deepEqual(await states('2026-11-13T08:00:00.000Z'), {
    'weather-forecast': 'ok', 'weather-reanalysis': 'ok', 'morning-calculation': 'ok', 'otf-vault-morning': 'ok',
  });

  await recordMorningTaskRuns(morning(['network']), { at: '2026-11-14T05:16:00.000Z', log: silent });
  assert.deepEqual(await states('2026-11-14T08:00:00.000Z'), {
    'weather-forecast': 'ok', 'weather-reanalysis': 'late', 'morning-calculation': 'ok', 'otf-vault-morning': 'ok',
  }, 'à 9 h le 14, la réanalyse manquée est déjà en retard (avant la 4.5, l’écran restait vert cinq jours)');

  await recordMorningTaskRuns(morning(['network']), { at: '2026-11-15T05:16:00.000Z', log: silent });
  const fifteenth = await readTaskStates(new Date('2026-11-15T08:00:00.000Z'));
  const reanalysis = fifteenth.find(({ declaration }) => declaration.key === 'weather-reanalysis')!.state;
  assert.deepEqual(
    { kind: reanalysis.kind, lastSuccessAt: reanalysis.lastSuccessAt, failingSince: reanalysis.failingSince, lastError: reanalysis.lastError },
    { kind: 'broken', lastSuccessAt: '2026-11-13T05:16:00.000Z', failingSince: '2026-11-14T05:16:00.000Z', lastError: '1 lieu sur 1 sans pluie estimée (réseau)' },
    'le 15, en panne depuis le 14, dernière réussite le 13',
  );
  assert.equal(fifteenth.find(({ declaration }) => declaration.key === 'weather-forecast')!.state.kind, 'ok');
});

test('un enregistrement impossible ne fait pas échouer le matin : il se journalise sous un nom stable', async () => {
  const lines: Record<string, unknown>[] = [];
  overrideDatabase({ prepare: () => { throw new Error('D1_ERROR: base indisponible'); } } as unknown as D1Database);
  try {
    await recordMorningTaskRuns(morning(['network']), { at: '2026-11-20T05:16:00.000Z', log: (_level, entry) => lines.push(entry) });
  } finally {
    overrideDatabase(database.d1);
  }
  assert.deepEqual(
    lines.filter((line) => line.event === 'task_run_record_failed').map((line) => line.task),
    ['weather-forecast', 'weather-reanalysis', 'morning-calculation', 'otf-vault-morning'],
  );
  assert.deepEqual(lines.filter((line) => line.event === 'task_run_failed'), [
    { event: 'task_run_failed', task: 'weather-reanalysis', summary: '1 lieu sur 1 sans pluie estimée (réseau)' },
  ]);
  assert.deepEqual(
    lines.filter((line) => line.event === 'task_run_succeeded').map((line) => line.task),
    ['weather-forecast', 'morning-calculation', 'otf-vault-morning'],
    'chaque tâche dit son matin au journal, même quand la base ne l’a pas gardé',
  );
  assert.ok(lines.every((line) => !JSON.stringify(line).includes('base indisponible')), 'le message de la base n’est pas recopié');
});

test('la migration 0034 garde la ligne du verrou de la météo telle quelle, sans échec compté', () => {
  const sqlite = createMigratedSqliteDatabase('drizzle', '0033_otf_token_vault.sql');
  sqlite.exec(`INSERT INTO irrigation_background_jobs (job_key, last_successful_at, last_error) VALUES ('automatic-weather-sync', '2026-11-19T05:16:00.000Z', NULL)`);
  applyMigrationsAfter(sqlite, '0033_otf_token_vault.sql');
  assert.deepEqual({ ...sqlite.prepare('SELECT job_key, last_successful_at, consecutive_failures, failing_since FROM irrigation_background_jobs').get() }, {
    job_key: 'automatic-weather-sync', last_successful_at: '2026-11-19T05:16:00.000Z', consecutive_failures: 0, failing_since: null,
  });
  sqlite.close();
});
