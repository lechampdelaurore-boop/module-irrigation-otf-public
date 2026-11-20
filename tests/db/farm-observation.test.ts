import assert from 'node:assert/strict';
import test, { afterEach, beforeEach, mock } from 'node:test';
import { endOtfFarmRead, recordOtfCallOutcome } from '../../db/otf-call-ledger-repository';
import { ensureWorkspaceForUser } from '../../db/workspace-repository';
import { OtfReadClient, resetOtfRatePacer } from '../../lib/adapters/otf/read-client';
import { farmSpaceKey } from '../../lib/domain/farm-space';
import { readOperatorStatus } from '../../lib/services/operator-status';
import { DEPLOYMENT_KEY_UNKNOWN_FARM_PACE, sharedPaceForLoneCalls, startFarmRead } from '../../lib/services/otf-farm-read';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';

/**
 * L'observation par ferme, sur la base de test (4.5, PR 2 ;
 * docs/tranche-4-contract.md, F564, et 10 bis.13, F614 à F616) : les appels
 * envoyés à OTF comptés par ferme et par heure, la dernière lecture complète
 * gardée, et la page d'état qui montre chaque ferme, la plus en difficulté
 * d'abord, sans nom de ferme ni personne.
 */

const DEPLOYMENT_FARM = '4394';
const PILOT_FARM = '5120';
const PILOT_FARM_NAME = 'Ferme des Hirondelles';
/** Vendredi 20 novembre 2026, 10 h 30 à Paris. */
const NOW = new Date('2026-11-20T09:30:00.000Z');
const HOUR_MS = 3_600_000;

let database: TestDatabase;

beforeEach(() => {
  database = installTestDatabase();
  resetOtfRatePacer();
  mock.method(console, 'warn', () => {});
  mock.method(console, 'info', () => {});
});

afterEach(() => {
  mock.restoreAll();
  database.dispose();
});

function outcomeRows(paceKey: string) {
  return database.sqlite
    .prepare('SELECT hour_start_ms, outcome, calls FROM otf_call_outcomes WHERE pace_key = ? ORDER BY hour_start_ms, outcome')
    .all(paceKey) as { hour_start_ms: number; outcome: string; calls: number }[];
}

function lastCompleteAt(paceKey: string): string | null {
  const row = database.sqlite.prepare('SELECT last_complete_at FROM otf_farm_reads WHERE pace_key = ?').get(paceKey) as { last_complete_at: string | null } | undefined;
  return row?.last_complete_at ?? null;
}

test('chaque appel envoyé compte pour sa ferme, à son heure pleine et par résultat ; les heures de plus de huit jours partent', async () => {
  const at = NOW.getTime();
  await recordOtfCallOutcome('17', 'ok', at);
  await recordOtfCallOutcome('17', 'ok', at + 60_000);
  await recordOtfCallOutcome('17', 'timeout', at + 120_000);
  await recordOtfCallOutcome('17', 'ok', at + HOUR_MS);
  await recordOtfCallOutcome('18', 'server', at);
  const hour = Date.parse('2026-11-20T09:00:00.000Z');
  assert.deepEqual(outcomeRows('17').map((row) => ({ ...row })), [
    { hour_start_ms: hour, outcome: 'ok', calls: 2 },
    { hour_start_ms: hour, outcome: 'timeout', calls: 1 },
    { hour_start_ms: hour + HOUR_MS, outcome: 'ok', calls: 1 },
  ]);

  // Huit jours et une heure plus tard, à 11 h 30 : l'heure de 10 h du 20 est la plus vieille gardée, celle de 9 h est partie.
  await recordOtfCallOutcome('19', 'ok', at + (8 * 24 + 1) * HOUR_MS);
  assert.deepEqual(outcomeRows('17').map((row) => row.hour_start_ms), [hour + HOUR_MS]);
  // Une heure de plus : les heures du 20 sont parties, pour toutes les fermes.
  await recordOtfCallOutcome('19', 'ok', at + (8 * 24 + 2) * HOUR_MS);
  assert.deepEqual(outcomeRows('17'), []);
  assert.deepEqual(outcomeRows('18'), []);
  assert.equal(outcomeRows('19').length, 2);
});

test('le connecteur compte ses appels dans la base, sous la ferme de son compteur ; une lecture complète garde son heure', async () => {
  const answers = [new Response(null, { status: 502 }), Response.json({ seasonFirst: 2026 })];
  const client = new OtfReadClient({
    baseUrl: 'https://api.ouvretaferme.org/0.1beta',
    token: 'jeton',
    farmKey: DEPLOYMENT_KEY_UNKNOWN_FARM_PACE,
    sharedPace: sharedPaceForLoneCalls(DEPLOYMENT_KEY_UNKNOWN_FARM_PACE),
    fetchImpl: async () => answers.shift() ?? Response.json({}),
  });
  await client.getConfiguration();
  assert.deepEqual(outcomeRows(DEPLOYMENT_KEY_UNKNOWN_FARM_PACE).map((row) => [row.outcome, row.calls]), [['ok', 1], ['server', 1]]);

  // Une lecture qui n'a pas tout lu ne garde rien ; une lecture complète garde son heure, que la suivante, incomplète, ne retire pas.
  const failed = await startFarmRead(DEPLOYMENT_FARM, 'page');
  await failed.sharedPace.recordOutcome?.('timeout', Date.now());
  await failed.finish(new Error('coupée'));
  assert.equal(lastCompleteAt(DEPLOYMENT_FARM), null);
  assert.deepEqual(outcomeRows(DEPLOYMENT_FARM).map((row) => [row.outcome, row.calls]), [['timeout', 1]]);

  const complete = await startFarmRead(DEPLOYMENT_FARM, 'page');
  complete.markComplete();
  await complete.finish();
  const kept = lastCompleteAt(DEPLOYMENT_FARM);
  assert.ok(kept !== null && Number.isFinite(Date.parse(kept)));
  await endOtfFarmRead({ paceKey: DEPLOYMENT_FARM, readId: 'une-autre', reserveBasis: null, atMs: Date.now() + 1_000 });
  const next = await startFarmRead(DEPLOYMENT_FARM, 'page');
  await next.finish(new Error('coupée'));
  assert.equal(lastCompleteAt(DEPLOYMENT_FARM), kept);
});

test('la page d’état montre chaque ferme, la plus en difficulté d’abord, sans nom de ferme ni personne', async () => {
  const operatorWorkspace = await ensureWorkspaceForUser(farmSpaceKey('exploitante', DEPLOYMENT_FARM));
  const pilotWorkspace = await ensureWorkspaceForUser(farmSpaceKey('pilote', PILOT_FARM));
  // La ferme du déploiement : lue en entier ce matin, météo et calcul du matin faits à 6 h 16.
  database.sqlite.prepare("INSERT INTO otf_farm_reads (pace_key, lease_until_ms, last_complete_at) VALUES (?, 0, '2026-11-20T05:16:30.000Z')").run(DEPLOYMENT_FARM);
  for (const workspace of [operatorWorkspace, pilotWorkspace]) {
    database.sqlite.prepare("INSERT INTO irrigation_weather_preferences (workspace_id, last_automatic_refresh_success_at) VALUES (?, '2026-11-20T05:16:00.000Z')").run(workspace);
  }
  database.sqlite.prepare(
    `INSERT INTO irrigation_plan_calculations (id, workspace_id, season, week_start, trigger, computed_at, horizon_start_at, horizon_end_at, settings, summary)
     VALUES ('calcul-du-matin', ?, 2026, '2026-11-16', 'daily', '2026-11-20T05:17:00.000Z', '2026-11-20T00:00:00.000Z', '2026-11-27T00:00:00.000Z', '{}', '{}')`,
  ).run(operatorWorkspace);
  // Ses appels : 9 réussis et un délai dépassé dans l'heure, deux erreurs d'OTF il y a trois jours.
  for (let call = 0; call < 9; call += 1) await recordOtfCallOutcome(DEPLOYMENT_FARM, 'ok', NOW.getTime() - 60_000);
  await recordOtfCallOutcome(DEPLOYMENT_FARM, 'timeout', NOW.getTime() - 60_000);
  await recordOtfCallOutcome(DEPLOYMENT_FARM, 'server', NOW.getTime() - 3 * 24 * HOUR_MS);
  await recordOtfCallOutcome(DEPLOYMENT_FARM, 'server', NOW.getTime() - 3 * 24 * HOUR_MS);
  database.sqlite.prepare("INSERT INTO otf_daily_calls (pace_key, paris_day, calls) VALUES (?, '2026-11-20', 10)").run(DEPLOYMENT_FARM);
  // La ferme pilote : son raccordement révoqué par OTF ; son calcul du matin n'a jamais tourné.
  database.sqlite.prepare(
    `INSERT INTO otf_farm_connections (otf_farm_id, owner_user_id, farm_name, state, connected_at)
     VALUES (?, 'pilote', ?, 'reconnect-required', '2026-11-19T10:00:00.000Z')`,
  ).run(PILOT_FARM, PILOT_FARM_NAME);
  // Le premier `GET /me` de la clé, avant que sa ferme soit connue : une erreur réseau.
  await recordOtfCallOutcome(DEPLOYMENT_KEY_UNKNOWN_FARM_PACE, 'network', NOW.getTime() - 2 * HOUR_MS);

  const status = await readOperatorStatus(NOW, async () => DEPLOYMENT_FARM);
  assert.deepEqual(status.farms.map((farm) => [farm.title, farm.tone, farm.state]), [
    ['Ferme n° 5120', 'danger', 'En difficulté'],
    ['Clé du déploiement, avant que sa ferme soit connue', 'danger', 'En difficulté'],
    ['Ferme n° 4394, celle de la clé du déploiement', 'warn', 'À regarder'],
  ]);
  const [pilot, withoutFarm, deployment] = status.farms;
  assert.equal(pilot.verdict, 'Raccordement révoqué par Ouvre ta ferme. Aucun calcul du matin.');
  assert.equal(pilot.connection, 'Révoquée par Ouvre ta ferme : sa personne doit la relier de nouveau.');
  assert.equal(pilot.lastOtfRead, 'aucune : la ferme n’est pas lue');
  assert.equal(pilot.lastMorning, 'aucun enregistré');
  assert.equal(withoutFarm.verdict, '1 erreur d’Ouvre ta ferme sur 1 appel en 24 heures.');
  assert.equal(withoutFarm.errors24h, '1 erreur sur 1 appel (100 %) : 1 erreur réseau');
  assert.deepEqual(deployment, {
    farmKey: DEPLOYMENT_FARM,
    title: 'Ferme n° 4394, celle de la clé du déploiement',
    tone: 'warn',
    state: 'À regarder',
    verdict: '1 erreur d’Ouvre ta ferme sur 10 appels en 24 heures.',
    connection: 'Lue avec la clé du déploiement.',
    callsToday: '10 appels à Ouvre ta ferme aujourd’hui ; la part du quota de la ferme laissée au module n’est pas encore fixée.',
    errors24h: '1 erreur sur 10 appels (10 %) : 1 délai dépassé',
    errors7d: '3 erreurs sur 12 appels (25 %) : 2 erreurs d’OTF (5xx), 1 délai dépassé',
    lastOtfRead: 'le 20/11 à 6 h 16',
    lastWeather: 'le 20/11 à 6 h 16',
    lastMorning: 'le 20/11 à 6 h 17',
  });
  // Le jugement d'ensemble compte les fermes : jamais « tout va bien » quand une ferme est en difficulté.
  assert.match(status.verdict.text, /; 2 fermes en difficulté, 1 à regarder\.$/);
  assert.equal(status.verdict.tone, 'danger');
  const shown = JSON.stringify(status);
  for (const secret of [PILOT_FARM_NAME, 'exploitante', 'pilote', operatorWorkspace, pilotWorkspace]) {
    assert.ok(!shown.includes(secret), `rien de « ${secret} » sur la page`);
  }
});
