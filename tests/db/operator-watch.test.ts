import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { overrideDatabase } from '../../db/binding';
import { claimOperatorNotice, readLatestOperatorNotice } from '../../db/operator-repository';
import { readTaskRuns, recordTaskRun } from '../../db/task-run-repository';
import { ensureWorkspaceForUser } from '../../db/workspace-repository';
import { farmSpaceKey } from '../../lib/domain/farm-space';
import type { IrrigationPushSendRequest } from '../../lib/domain/irrigation-push-contract';
import { tasksOfTrigger } from '../../lib/domain/operations/task-registry';
import type { IrrigationPushSendResult } from '../../lib/services/irrigation-push-service';
import { isOperator, readOperatorStatus, recordOffsiteExport } from '../../lib/services/operator-status';
import { runOperatorWatch } from '../../lib/services/operator-watch';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';

/**
 * La veille de l'exploitant, sur la base de test (4.5, PR 2 ;
 * docs/tranche-4-contract.md, F566, F608 à F611) : la notification part vers
 * les espaces de la ferme du déploiement, une fois par jour au plus ;
 * l'exécution de la veille s'enregistre comme celle de toute tâche ; rien
 * d'une ferme ni d'une personne au journal.
 */

const DEPLOYMENT_FARM = '4394';
const OPERATOR = farmSpaceKey('exploitant', DEPLOYMENT_FARM);
const OTHER_FARM_PERSON = farmSpaceKey('voisine', '5120');

/** Vendredi 20 novembre 2026, 9 h à Paris ; le matin a réussi à 6 h 16, sauf la réanalyse, en panne depuis le 18. */
const FRIDAY = new Date('2026-11-20T08:00:00.000Z');

let database: TestDatabase;
let operatorWorkspace: string;
let otherWorkspace: string;

beforeEach(async () => {
  database = installTestDatabase();
  operatorWorkspace = await ensureWorkspaceForUser(OPERATOR);
  otherWorkspace = await ensureWorkspaceForUser(OTHER_FARM_PERSON);
  // L'export de la semaine, noté la veille au soir : seules les tâches du matin sont en jeu ici.
  await recordTaskRun({ task: 'offsite-export', at: '2026-11-19T20:30:00.000Z', successful: true, error: null });
});
afterEach(() => {
  database.dispose();
});

async function morningAt(day: string, { reanalysis }: { reanalysis: boolean }) {
  for (const task of tasksOfTrigger('weather-morning')) {
    const successful = task !== 'weather-reanalysis' || reanalysis;
    await recordTaskRun({ task, at: `${day}T05:16:00.000Z`, successful, error: successful ? null : '1 lieu sur 1 sans pluie estimée (réseau)' });
  }
}

function sender(status: IrrigationPushSendResult['status'] = 'sent') {
  const requests: IrrigationPushSendRequest[] = [];
  const send = async (request: IrrigationPushSendRequest): Promise<IrrigationPushSendResult> => {
    requests.push(request);
    return status === 'unreachable' ? { status, message: 'Le service d’alerte ne répond pas.' } : { status } as IrrigationPushSendResult;
  };
  return { requests, send };
}

function journal() {
  const lines: Record<string, unknown>[] = [];
  return { lines, log: (_level: string, entry: Record<string, unknown>) => { lines.push(entry); } };
}

const deploymentFarm = async () => DEPLOYMENT_FARM;

async function watchRun() {
  return (await readTaskRuns(['operator-watch'])).get('operator-watch')!;
}

test('une tâche en panne : la notification part vers l’exploitant seul, le nomme, et la veille est réussie', async () => {
  await morningAt('2026-11-17', { reanalysis: true });
  await morningAt('2026-11-18', { reanalysis: false });
  await morningAt('2026-11-19', { reanalysis: false });
  await morningAt('2026-11-20', { reanalysis: false });
  const { requests, send } = sender();
  const { lines, log } = journal();

  const result = await runOperatorWatch({ now: FRIDAY, send, deploymentFarm, log });

  assert.deepEqual(result, { notice: 'alert', problems: 1, successful: true });
  assert.deepEqual(requests.map((request) => request.recipientKey), [operatorWorkspace], 'l’espace de l’exploitant, jamais celui d’une autre ferme');
  assert.ok(!requests.some((request) => request.recipientKey === otherWorkspace));
  assert.equal(requests[0].notificationId, 'operator-watch-2026-11-20');
  assert.deepEqual(requests[0].notification, {
    title: 'Module d\'irrigation : une tâche en panne',
    body: 'Pluie estimée après coup (réanalyse) : en panne (en échec depuis le 18/11 à 6 h 16). Dernière erreur : 1 lieu sur 1 sans pluie estimée (réseau).',
    tag: 'operator-watch',
    data: { url: '/irrigation/exploitation' },
  });
  const run = await watchRun();
  assert.deepEqual({ lastSuccessAt: run.lastSuccessAt, consecutiveFailures: run.consecutiveFailures }, { lastSuccessAt: FRIDAY.toISOString(), consecutiveFailures: 0 });
  assert.deepEqual(await readLatestOperatorNotice(), { parisDay: '2026-11-20', kind: 'alert', problems: 1, sentAt: FRIDAY.toISOString() });
  assert.deepEqual(lines.filter((line) => String(line.event).startsWith('operator_watch')), [
    { event: 'operator_watch_completed', notice: 'alert', problems: 1, summary: undefined },
  ]);
  assert.deepEqual(lines.filter((line) => line.event === 'task_run_succeeded'), [{ event: 'task_run_succeeded', task: 'operator-watch' }]);
  const written = JSON.stringify(lines);
  for (const forbidden of [DEPLOYMENT_FARM, '5120', 'exploitant', 'voisine', operatorWorkspace, otherWorkspace]) {
    assert.ok(!written.includes(forbidden), `rien d’une ferme ni d’une personne au journal : ${forbidden}`);
  }
});

test('une panne qui dure ne renvoie pas la notification plus d’une fois par jour ; le lendemain, elle repart', async () => {
  await morningAt('2026-11-17', { reanalysis: true });
  await morningAt('2026-11-20', { reanalysis: false });
  const { requests, send } = sender();
  const silent = journal().log;

  assert.equal((await runOperatorWatch({ now: FRIDAY, send, deploymentFarm, log: silent })).notice, 'alert');
  const again = await runOperatorWatch({ now: new Date('2026-11-20T14:00:00.000Z'), send, deploymentFarm, log: silent });
  assert.deepEqual(again, { notice: 'already-sent', problems: 1, successful: true }, 'relancée l’après-midi : rien ne repart');
  assert.equal(requests.length, 1);

  await morningAt('2026-11-21', { reanalysis: false });
  await runOperatorWatch({ now: new Date('2026-11-21T08:00:00.000Z'), send, deploymentFarm, log: silent });
  assert.deepEqual(requests.map((request) => request.notificationId), ['operator-watch-2026-11-20', 'operator-watch-2026-11-21']);
});

test('aucun appareil de l’exploitant inscrit : la veille est manquée, avec la raison, et une relance du jour réessaie', async () => {
  await morningAt('2026-11-17', { reanalysis: true });
  await morningAt('2026-11-20', { reanalysis: false });
  const absent = sender('no-subscriber');
  const { lines, log } = journal();

  const result = await runOperatorWatch({ now: FRIDAY, send: absent.send, deploymentFarm, log });

  assert.deepEqual(result, { notice: 'alert', problems: 1, successful: false });
  const run = await watchRun();
  assert.deepEqual(
    { lastSuccessAt: run.lastSuccessAt, consecutiveFailures: run.consecutiveFailures, lastError: run.lastError },
    { lastSuccessAt: null, consecutiveFailures: 1, lastError: 'aucun appareil de l\'exploitant inscrit aux notifications' },
  );
  assert.deepEqual(lines.find((line) => line.event === 'operator_watch_failed'), {
    event: 'operator_watch_failed', notice: 'alert', problems: 1, summary: 'aucun appareil de l\'exploitant inscrit aux notifications',
  });
  assert.equal(await readLatestOperatorNotice(), null, 'rien n’est parti : rien de gardé');

  const present = sender('sent');
  const retried = await runOperatorWatch({ now: new Date('2026-11-20T08:10:00.000Z'), send: present.send, deploymentFarm, log });
  assert.deepEqual(retried, { notice: 'alert', problems: 1, successful: true }, 'une fois l’appareil inscrit, la relance du jour l’envoie');
  assert.equal(present.requests.length, 1);
});

test('le service de notification en panne, ou la ferme du déploiement inconnue : la veille est manquée, sans rien inventer', async () => {
  await morningAt('2026-11-17', { reanalysis: true });
  await morningAt('2026-11-20', { reanalysis: false });
  const silent = journal().log;

  const throwing = async (): Promise<IrrigationPushSendResult> => { throw new Error('connexion refusée par 10.0.0.1'); };
  assert.equal((await runOperatorWatch({ now: FRIDAY, send: throwing, deploymentFarm, log: silent })).successful, false);
  assert.equal((await watchRun()).lastError, 'service de notification injoignable', 'le message de l’erreur n’est pas recopié');

  assert.equal((await runOperatorWatch({ now: FRIDAY, send: sender('disabled').send, deploymentFarm, log: silent })).successful, false);
  assert.equal((await watchRun()).lastError, 'service de notification non configuré');

  const unknownFarm = sender();
  const result = await runOperatorWatch({ now: FRIDAY, send: unknownFarm.send, deploymentFarm: async () => null, log: silent });
  assert.equal(result.successful, false);
  assert.equal(unknownFarm.requests.length, 0);
  const run = await watchRun();
  assert.deepEqual(
    { lastError: run.lastError, consecutiveFailures: run.consecutiveFailures },
    { lastError: 'ferme du déploiement inconnue : aucun exploitant à prévenir', consecutiveFailures: 3 },
    'trois veilles manquées de suite : la page d’état la montrera en panne',
  );
});

test('la base hors d’usage : la veille ne lève pas, elle dit qu’elle a été interrompue, sans recopier le message de la base', async () => {
  const { requests, send } = sender();
  const { lines, log } = journal();
  overrideDatabase({ prepare: () => { throw new TypeError('D1_ERROR: base indisponible'); } } as unknown as D1Database);
  let result;
  try {
    result = await runOperatorWatch({ now: FRIDAY, send, deploymentFarm, log });
  } finally {
    overrideDatabase(database.d1);
  }
  assert.deepEqual(result, { notice: 'none', problems: 0, successful: false });
  assert.equal(requests.length, 0);
  assert.deepEqual(lines.find((line) => line.event === 'operator_watch_failed'), {
    event: 'operator_watch_failed', notice: 'none', problems: 0, summary: 'interrompue avant la fin (erreur TypeError)',
  });
  assert.deepEqual(lines.find((line) => line.event === 'task_run_record_failed'), { event: 'task_run_record_failed', task: 'operator-watch', error: 'TypeError' });
  assert.ok(!JSON.stringify(lines).includes('base indisponible'));
});

test('rien à signaler : aucune notification en semaine, « tout va bien » le dimanche, et la veille réussie dans les deux cas', async () => {
  await morningAt('2026-11-20', { reanalysis: true });
  const { requests, send } = sender();
  const silent = journal().log;
  assert.deepEqual(await runOperatorWatch({ now: FRIDAY, send, deploymentFarm, log: silent }), { notice: 'none', problems: 0, successful: true });
  assert.equal(requests.length, 0);
  assert.equal((await watchRun()).lastSuccessAt, FRIDAY.toISOString());

  await morningAt('2026-11-22', { reanalysis: true });
  const sunday = new Date('2026-11-22T08:00:00.000Z');
  assert.deepEqual(await runOperatorWatch({ now: sunday, send, deploymentFarm, log: silent }), { notice: 'all-good', problems: 0, successful: true });
  assert.equal(requests[0].notification.title, 'Module d\'irrigation : tout va bien');
  assert.deepEqual(await readLatestOperatorNotice(), { parisDay: '2026-11-22', kind: 'all-good', problems: 0, sentAt: sunday.toISOString() });
});

test('une prise sans envoi est celle d’une veille en cours : respectée cinq minutes, reprise au-delà', async () => {
  assert.equal(await claimOperatorNotice('2026-11-20', { kind: 'alert', problems: 1 }, '2026-11-20T08:00:00.000Z'), true);
  assert.equal(await claimOperatorNotice('2026-11-20', { kind: 'alert', problems: 1 }, '2026-11-20T08:04:00.000Z'), false, 'une veille en cours');
  assert.equal(await claimOperatorNotice('2026-11-20', { kind: 'alert', problems: 2 }, '2026-11-20T08:05:00.000Z'), true, 'une veille coupée en route');
  database.sqlite.prepare('UPDATE irrigation_operator_notices SET sent_at = ? WHERE paris_day = ?').run('2026-11-20T08:05:01.000Z', '2026-11-20');
  assert.equal(await claimOperatorNotice('2026-11-20', { kind: 'alert', problems: 3 }, '2026-11-20T18:00:00.000Z'), false, 'partie : plus jamais reprise ce jour-là');
});

test('l’exploitant est une personne de la ferme du déploiement ; la page d’état lit le registre et la dernière notification', async () => {
  assert.equal(await isOperator(OPERATOR, deploymentFarm), true);
  assert.equal(await isOperator(OTHER_FARM_PERSON, deploymentFarm), false, 'une autre ferme');
  assert.equal(await isOperator('exploitant', deploymentFarm), false, 'un espace sans ferme');
  assert.equal(await isOperator(OPERATOR, async () => null), false, 'ferme du déploiement inconnue');

  await morningAt('2026-11-20', { reanalysis: true });
  const status = await readOperatorStatus(FRIDAY, deploymentFarm);
  // La veille, avant sa première exécution ; les deux fermes, jamais lues ni servies en météo sur cette base neuve (F616).
  assert.deepEqual(status.verdict, { tone: 'warn', text: '1 tâche jamais réussie ; 2 fermes à regarder.' });
  assert.deepEqual(status.tasks.map((task) => task.tone), ['ok', 'ok', 'ok', 'ok', 'ok', 'warn']);
  assert.deepEqual(status.farms.map((farm) => farm.title), ['Ferme n° 4394, celle de la clé du déploiement', 'Ferme n° 5120']);
  assert.deepEqual(status.exportDates, { today: '2026-11-20', earliest: '2026-10-21' });
});

test('le geste « J’ai fait l’export du … » : le jour noté devient la dernière réussite de l’export, sans jamais reculer', async () => {
  const { lines, log } = journal();
  const exportRun = async () => (await readTaskRuns(['offsite-export'])).get('offsite-export')!;
  const now = new Date('2026-11-27T20:30:00.000Z');

  assert.deepEqual(await recordOffsiteExport('2026-11-19', now), { ok: false, message: 'L’export du 19/11/2026 est déjà noté.' });
  assert.deepEqual(await recordOffsiteExport('2026-11-26', now, log), { ok: true, message: 'L’export du 26/11/2026 est noté.' });
  assert.equal((await exportRun()).lastSuccessAt, '2026-11-26T12:00:00.000Z');
  assert.deepEqual(await recordOffsiteExport('2026-11-22', now), { ok: false, message: 'Un export plus récent est déjà noté : celui du 26/11/2026.' });
  assert.deepEqual(await recordOffsiteExport('2026-11-27', now, log), { ok: true, message: 'L’export du 27/11/2026 est noté.' });
  assert.equal((await exportRun()).lastSuccessAt, now.toISOString(), 'le jour même : l’heure du geste');
  assert.deepEqual(lines, [{ event: 'offsite_export_recorded', day: '2026-11-26' }, { event: 'offsite_export_recorded', day: '2026-11-27' }], 'un jour, rien d’autre');

  database.sqlite.prepare("DELETE FROM irrigation_background_jobs WHERE job_key = 'task:offsite-export'").run();
  await morningAt('2026-11-27', { reanalysis: true });
  const before = await readOperatorStatus(now, deploymentFarm);
  assert.equal(before.tasks.find((task) => task.key === 'offsite-export')?.state, 'Jamais réussie', 'avant le premier export : orange, jamais vert');
  await recordOffsiteExport('2026-11-27', now);
  assert.equal((await readOperatorStatus(now, deploymentFarm)).tasks.find((task) => task.key === 'offsite-export')?.state, 'À l\'heure');
});
