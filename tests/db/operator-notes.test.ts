import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { listCostReadings, listSupportAccesses } from '../../db/operator-notes-repository';
import { ensureWorkspaceForUser } from '../../db/workspace-repository';
import { farmSpaceKey } from '../../lib/domain/farm-space';
import { noteCostReading, noteSupportAccess, readOperatorStatus } from '../../lib/services/operator-status';
import { runRetentionPurges } from '../../lib/services/retention-purge';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';

/**
 * Le journal d'accès du support et le relevé des coûts, sur la base de test
 * (4.5, PR 5 ; docs/tranche-4-contract.md, F567, F565 point 6, F568, et
 * 10 bis.21, F660 à F664) : un accès se note pour une ferme de la page
 * d'état, se lit 12 mois puis part à la purge du matin ; le journal du
 * Worker ne dit que le jour, jamais la raison ; un relevé du même mois
 * remplace l'autre ; la page d'état les montre.
 */

const DEPLOYMENT_FARM = '4394';
const NOW = new Date('2026-11-20T15:30:00.000Z');
const REASON = 'Claire Martin demande pourquoi son planning est vide';
const deploymentFarm = async () => DEPLOYMENT_FARM;

let database: TestDatabase;

beforeEach(async () => {
  database = installTestDatabase();
  await ensureWorkspaceForUser(farmSpaceKey('exploitant', DEPLOYMENT_FARM));
  await ensureWorkspaceForUser(farmSpaceKey('voisine', '5120'));
});
afterEach(() => {
  database.dispose();
});

function journal() {
  const lines: Record<string, unknown>[] = [];
  return { lines, log: (_level: string, entry: Record<string, unknown>) => { lines.push(entry); } };
}

test('un accès se note pour une ferme de la page d’état ; le journal du Worker ne dit que le jour, jamais la raison', async () => {
  const { lines, log } = journal();
  const status = await readOperatorStatus(NOW, deploymentFarm);
  assert.deepEqual([...status.support?.farms ?? []].sort(), [DEPLOYMENT_FARM, '5120'], 'chaque ferme portée par un espace, celle de la clé comprise');
  assert.deepEqual(status.support?.lines, []);

  assert.deepEqual(await noteSupportAccess({ otfFarmId: '7777', day: '2026-11-20', reason: REASON }, NOW, log, deploymentFarm), {
    ok: false,
    message: 'Choisissez la ferme dont vous avez regardé les données.',
  }, 'une ferme absente de la page ne se note pas');
  assert.deepEqual(await noteSupportAccess({ otfFarmId: DEPLOYMENT_FARM, day: '2026-11-19', reason: REASON }, NOW, log, deploymentFarm), {
    ok: true,
    message: 'L’accès du 19/11/2026 aux données de la ferme 4394 est noté.',
  });
  assert.deepEqual(lines, [{ event: 'support_access_recorded', day: '2026-11-19' }]);
  assert.ok(!JSON.stringify(lines).includes('Claire'), 'la raison reste dans la base');

  const after = await readOperatorStatus(NOW, deploymentFarm);
  assert.deepEqual(after.support?.lines.map(({ day, farm, reason }) => ({ day, farm, reason })), [{ day: '19/11/2026', farm: 'ferme 4394', reason: REASON }]);
});

test('douze mois sur la page, puis la purge du matin : le même jour un an plus tard, la note reste ; le lendemain, elle part', async () => {
  await noteSupportAccess({ otfFarmId: DEPLOYMENT_FARM, day: '2026-11-19', reason: REASON }, NOW, () => undefined, deploymentFarm);
  assert.equal((await listSupportAccesses('2025-11-20')).length, 1);

  const yearLater = new Date('2027-11-19T05:16:00.000Z');
  await runRetentionPurges({ now: yearLater, log: () => undefined });
  assert.equal((await readOperatorStatus(yearLater, deploymentFarm)).support?.lines.length, 1, 'le 19/11/2027 : encore là');

  const dayAfter = new Date('2027-11-20T05:16:00.000Z');
  assert.equal((await readOperatorStatus(dayAfter, deploymentFarm)).support?.lines.length, 0, 'la page ne la montre plus, même avant la purge');
  await runRetentionPurges({ now: dayAfter, log: () => undefined });
  assert.equal(Number((database.sqlite.prepare('SELECT COUNT(*) AS n FROM irrigation_support_accesses').get() as { n: number }).n), 0, 'la purge du matin l’a effacée');
});

const FIELDS = { month: '2026-10', workersRequests: '61 234', workersCpuMs: '18 400 000', d1RowsRead: '2 100 000', d1RowsWritten: '140 000', d1StorageMb: '12,5', billedUsd: '' };

test('le relevé du mois se note, un second du même mois le remplace, et la page d’état le compare à l’offre', async () => {
  const { lines, log } = journal();
  assert.equal((await readOperatorStatus(NOW, deploymentFarm)).costs?.headline, 'Aucun relevé noté.');
  assert.deepEqual((await readOperatorStatus(NOW, deploymentFarm)).costs?.months.slice(0, 2), [
    { value: '2026-11', label: 'novembre 2026' },
    { value: '2026-10', label: 'octobre 2026' },
  ]);

  assert.deepEqual(await noteCostReading({ ...FIELDS, workersRequests: '1,5 M' }, NOW, log), {
    ok: false,
    message: 'Requêtes des Workers : recopiez le nombre du tableau de bord, sans virgule ni lettre.',
  });
  assert.deepEqual(await noteCostReading(FIELDS, NOW, log), { ok: true, message: 'Le relevé d’octobre 2026 est noté.' });
  assert.deepEqual(await noteCostReading({ ...FIELDS, billedUsd: '5,00' }, NOW, log), { ok: true, message: 'Le relevé d’octobre 2026 est remplacé.' });
  assert.deepEqual(lines, [
    { event: 'cost_reading_recorded', month: '2026-10', replaced: false },
    { event: 'cost_reading_recorded', month: '2026-10', replaced: true },
  ]);

  const readings = await listCostReadings();
  assert.equal(readings.length, 1);
  assert.deepEqual({ ...readings[0], recordedAt: undefined }, {
    month: '2026-10', workersRequests: 61_234, workersCpuMs: 18_400_000, d1RowsRead: 2_100_000, d1RowsWritten: 140_000, d1StorageMb: 12.5, billedUsd: 5, recordedAt: undefined,
  });
  const costs = (await readOperatorStatus(NOW, deploymentFarm)).costs!;
  assert.equal(costs.tone, 'ok');
  assert.equal(costs.headline, 'Relevé d’octobre 2026, noté le 20/11/2026.');
  assert.equal(costs.missing, null);
  assert.match((costs.bill ?? '').replace(/[  ]/g, ' '), /^Facture : 5,00 \$ ; d’après ce relevé : 5,00 \$/);
});
