import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { morningTaskOutcomes } from '../lib/domain/operations/morning-task-outcomes.ts';
import {
  OPERATOR_GESTURE,
  REPEATED_FAILURES_FOR_BROKEN,
  TASK_REGISTRY,
  TASK_TRIGGERS,
  taskDeclaration,
  tasksOfTrigger,
} from '../lib/domain/operations/task-registry.ts';
import { EMPTY_TASK_RUN, taskState, type TaskRunRecord } from '../lib/domain/operations/task-state.ts';
import { millisecondsFromHours, millisecondsFromMinutes } from '../lib/domain/units.ts';
import { AUTOMATIC_REFRESH_LATE_AFTER_HOURS } from '../lib/domain/weather/automatic-refresh-status.ts';

/**
 * Le registre des tâches attendues (4.5, PR 1 ; docs/tranche-4-contract.md,
 * F560, F600 à F607) : chaque déclencheur planifié y est rangé, et chaque
 * tâche passe en orange puis en rouge quand on la sabote, jamais en vert
 * faute de réussite.
 */

/** Les configurations Wrangler du dépôt : celles de la racine et celles des Workers de `cloudflare/`. */
function wranglerConfigs(): string[] {
  const root = readdirSync('.').filter((name) => /^wrangler(\..+)?\.jsonc?$/.test(name));
  const workers = readdirSync('cloudflare', { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => readdirSync(`cloudflare/${entry.name}`)
      .filter((name) => /^wrangler(\..+)?\.jsonc?$/.test(name))
      .map((name) => `cloudflare/${entry.name}/${name}`));
  return [...root, ...workers].sort();
}

/** Les configurations ne portent que des commentaires sur des lignes entières (comme `tests/demo-deployment-config.test.ts`). */
function cronsOf(file: string): string[] {
  const text = readFileSync(file, 'utf8').split('\n').filter((line) => !/^\s*\/\//.test(line)).join('\n');
  const config = JSON.parse(text) as { triggers?: { crons?: string[] } };
  return config.triggers?.crons ?? [];
}

/** Les déclencheurs des configurations, « fichier cron », absents du registre. */
function unregistered(declared: readonly string[]): string[] {
  const registered = new Set(TASK_TRIGGERS.map((trigger) => `${trigger.config} ${trigger.cron}`));
  return declared.filter((entry) => !registered.has(entry));
}

test('chaque déclencheur planifié des configurations Wrangler est rangé au registre, et le registre n’en invente aucun', () => {
  const configs = wranglerConfigs();
  assert.ok(configs.includes('wrangler.jsonc'), 'la configuration du site est lue');
  assert.ok(configs.includes('wrangler.demo.jsonc'), 'celle de la démonstration aussi');
  assert.ok(configs.includes('cloudflare/irrigation-weather-scheduler/wrangler.jsonc'), 'et celle du planificateur');
  const declared = configs.flatMap((config) => cronsOf(config).map((cron) => `${config} ${cron}`));
  assert.ok(declared.length >= 2, 'les déclencheurs sont bien lus');
  assert.deepEqual(unregistered(declared), [], 'déclencheur absent du registre (lib/domain/operations/task-registry.ts) : l’y ranger avec son rythme attendu');
  const registered = TASK_TRIGGERS.map((trigger) => `${trigger.config} ${trigger.cron}`);
  assert.deepEqual(registered.filter((entry) => !declared.includes(entry)), [], 'déclencheur du registre absent des configurations');
  assert.equal(new Set(registered).size, registered.length, 'un déclencheur n’est rangé qu’une fois');
});

test('sabotage : un déclencheur ajouté ou déplacé sans être rangé fait échouer la couverture', () => {
  const declared = wranglerConfigs().flatMap((config) => cronsOf(config).map((cron) => `${config} ${cron}`));
  assert.deepEqual(unregistered([...declared, 'wrangler.jsonc 0 3 * * *']), ['wrangler.jsonc 0 3 * * *'], 'un nouveau déclencheur');
  assert.deepEqual(
    unregistered(['cloudflare/irrigation-weather-scheduler/wrangler.jsonc 30 4,5 * * *']),
    ['cloudflare/irrigation-weather-scheduler/wrangler.jsonc 30 4,5 * * *'],
    'un déclencheur dont l’heure change',
  );
});

test('le registre est cohérent : clés uniques, seuils croissants et expliqués, chaque tâche sur un déclencheur surveillé', () => {
  const keys = TASK_REGISTRY.map((task) => task.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const task of TASK_REGISTRY) {
    assert.ok(task.lateAfterHours > 0 && task.lateAfterHours < task.brokenAfterHours, `${task.key} : orange avant rouge`);
    for (const field of ['label', 'rhythm', 'thresholdReason', 'ifMissing', 'successKeptIn'] as const) {
      assert.ok(task[field].trim().length > 0, `${task.key} : ${field} écrit`);
    }
    if (task.trigger === OPERATOR_GESTURE) continue;
    const trigger = TASK_TRIGGERS.find((candidate) => candidate.key === task.trigger);
    assert.ok(trigger?.monitored, `${task.key} : son déclencheur existe et est surveillé`);
  }
  assert.deepEqual(
    TASK_REGISTRY.filter((task) => task.trigger === OPERATOR_GESTURE).map((task) => task.key),
    ['offsite-export', 'restore-rehearsal'],
    'deux tâches faites par l’exploitant : l’export hors de Cloudflare et l’essai de restauration',
  );
  for (const trigger of TASK_TRIGGERS) {
    if (trigger.monitored) assert.ok(tasksOfTrigger(trigger.key).length > 0, `${trigger.key} : au moins une tâche`);
    else assert.ok(trigger.reason.trim().length > 0, `${trigger.key} : hors veille, avec sa raison`);
  }
  assert.equal(REPEATED_FAILURES_FOR_BROKEN, 3);
});

test('les tâches du matin : 26 heures pour l’orange, 36 pour le rouge, le seuil de l’avertissement de la météo (D-165)', () => {
  assert.deepEqual(tasksOfTrigger('weather-morning'), ['weather-forecast', 'weather-reanalysis', 'morning-calculation', 'otf-vault-morning', 'farm-erasure', 'retention-purge']);
  for (const key of tasksOfTrigger('weather-morning')) {
    assert.equal(taskDeclaration(key).lateAfterHours, 26);
    assert.equal(taskDeclaration(key).brokenAfterHours, 36);
  }
  assert.equal(AUTOMATIC_REFRESH_LATE_AFTER_HOURS, taskDeclaration('weather-forecast').brokenAfterHours);
  assert.throws(() => taskDeclaration('inconnue' as never), /absente du registre/);
});

test('la veille de 9 h a son propre déclencheur, distinct de ceux qu’elle surveille (R5)', () => {
  assert.deepEqual(tasksOfTrigger('operator-watch'), ['operator-watch']);
  const watch = TASK_TRIGGERS.find((trigger) => trigger.key === 'operator-watch')!;
  const morning = TASK_TRIGGERS.find((trigger) => trigger.key === 'weather-morning')!;
  assert.equal(watch.config, morning.config, 'le même planificateur, sans service nouveau');
  assert.notEqual(watch.cron, morning.cron, 'un déclencheur à part : une panne du matin ne l’emporte pas');
  assert.equal(watch.cron, '0 7,8 * * *', '9 h à Paris, l’un des deux créneaux UTC selon l’heure d’été');
});

test('le rappel du soir a son déclencheur horaire, sa tâche, orange à 3 heures et rouge à 6 (amélioration n° 2, F705)', () => {
  assert.deepEqual(tasksOfTrigger('evening-reminder'), ['evening-reminder']);
  const evening = TASK_TRIGGERS.find((trigger) => trigger.key === 'evening-reminder')!;
  assert.equal(evening.cron, '5 * * * *', 'chaque heure, à l’heure et cinq minutes');
  assert.equal(evening.config, 'cloudflare/irrigation-weather-scheduler/wrangler.jsonc', 'le même planificateur, sans service nouveau');
  assert.ok(evening.monitored, 'surveillé par la veille');
  assert.equal(taskDeclaration('evening-reminder').lateAfterHours, 3);
  assert.equal(taskDeclaration('evening-reminder').brokenAfterHours, 6);
});

test('le matin rend une exécution pour chaque tâche de son déclencheur, ni plus ni moins', () => {
  const tasks = morningTaskOutcomes({
    weather: { status: 'completed', locations: 1, skippedBackoff: 0, forecastFailures: [], reanalysisFailures: [] },
    planning: { failed: 0 }, cropWater: { failed: 0 }, soilReserve: { failed: 0 }, cropDrying: { failed: 0 },
    otfVault: { status: 'dormant' },
    farmErasure: { due: 0, erased: 0, unfinished: 0, failures: [] },
    retentionPurge: { purged: 0, unfinished: 0, failures: [] },
  }).map((outcome) => outcome.task);
  assert.deepEqual(tasks, tasksOfTrigger('weather-morning'));
});

const NOW = new Date('2026-11-20T09:00:00.000Z');
const hoursAgo = (hours: number) => new Date(NOW.getTime() - millisecondsFromHours(hours)).toISOString();
const run = (overrides: Partial<TaskRunRecord>): TaskRunRecord => ({ ...EMPTY_TASK_RUN, ...overrides });

test('sabotage de chaque tâche : réussie, puis en retard, puis en panne, jamais en vert faute de réussite', async (t) => {
  for (const task of TASK_REGISTRY) {
    await t.test(task.key, () => {
      const late = millisecondsFromHours(task.lateAfterHours);
      const broken = millisecondsFromHours(task.brokenAfterHours);
      const at = (milliseconds: number) => new Date(NOW.getTime() - milliseconds).toISOString();

      assert.equal(taskState(task, run({ lastSuccessAt: hoursAgo(1) }), NOW).kind, 'ok', 'réussie il y a une heure');
      assert.equal(taskState(task, run({ lastSuccessAt: at(late) }), NOW).kind, 'ok', 'au seuil orange compris');
      assert.equal(taskState(task, run({ lastSuccessAt: at(late + millisecondsFromMinutes(1)) }), NOW).kind, 'late', 'une minute après le seuil orange');
      assert.equal(taskState(task, run({ lastSuccessAt: at(broken) }), NOW).kind, 'late', 'au seuil rouge compris');
      assert.equal(taskState(task, run({ lastSuccessAt: at(broken + millisecondsFromMinutes(1)) }), NOW).kind, 'broken', 'une minute après le seuil rouge');
      assert.deepEqual(
        { ...taskState(task, run({ lastSuccessAt: hoursAgo(task.brokenAfterHours + 1), lastAttemptAt: hoursAgo(1), lastError: 'réseau' }), NOW) },
        {
          kind: 'broken', reason: 'old-success', lastSuccessAt: hoursAgo(task.brokenAfterHours + 1),
          lastAttemptAt: hoursAgo(1), lastError: 'réseau', consecutiveFailures: 0, failingSince: null,
        },
        'plus de réussite depuis le seuil rouge et une heure : en panne, même si la dernière tentative est récente (R1)',
      );

      assert.equal(taskState(task, EMPTY_TASK_RUN, NOW).kind, 'never', 'jamais exécutée : orange, pas vert');
      assert.equal(taskState(task, run({ lastAttemptAt: hoursAgo(1), lastError: 'réseau', consecutiveFailures: 1, failingSince: hoursAgo(1) }), NOW).kind, 'never', 'tentée sans réussite');
      assert.equal(taskState(task, run({ lastSuccessAt: 'pas une date' }), NOW).kind, 'never', 'une date illisible ne vaut pas réussite');

      const twoFailures = run({ lastSuccessAt: hoursAgo(2), consecutiveFailures: REPEATED_FAILURES_FOR_BROKEN - 1, failingSince: hoursAgo(1) });
      assert.equal(taskState(task, twoFailures, NOW).kind, 'ok', 'deux échecs après une réussite récente : encore passagers');
      const threeFailures = { ...twoFailures, consecutiveFailures: REPEATED_FAILURES_FOR_BROKEN };
      assert.deepEqual(
        { kind: taskState(task, threeFailures, NOW).kind, reason: taskState(task, threeFailures, NOW).reason },
        { kind: 'broken', reason: 'repeated-failures' },
        'trois échecs de suite : en panne malgré une réussite récente (R2)',
      );
      assert.equal(taskState(task, run({ consecutiveFailures: REPEATED_FAILURES_FOR_BROKEN }), NOW).kind, 'broken', 'trois échecs sans aucune réussite : en panne');
    });
  }
});

test('un 6 h 15 manqué se voit à 9 h le matin même ; réussi, il reste vert jusqu’au lendemain', () => {
  const forecast = taskDeclaration('weather-forecast');
  const morning = (day: string) => `${day}T05:16:00.000Z`; // 6 h 16 à Paris, en hiver
  const nineOclock = new Date('2026-11-20T08:00:00.000Z');
  assert.equal(taskState(forecast, run({ lastSuccessAt: morning('2026-11-20') }), nineOclock).kind, 'ok', 'le matin même a réussi');
  assert.equal(taskState(forecast, run({ lastSuccessAt: morning('2026-11-19') }), nineOclock).kind, 'late', 'le matin même a manqué : vu à 9 h');
  assert.equal(taskState(forecast, run({ lastSuccessAt: morning('2026-11-19') }), new Date('2026-11-20T05:15:00.000Z')).kind, 'ok', 'juste avant 6 h 15 du lendemain, la réussite de la veille suffit');
  assert.equal(taskState(forecast, run({ lastSuccessAt: morning('2026-11-18') }), nineOclock).kind, 'broken', 'deux matins manqués : en panne');
  // Le dimanche du passage à l'heure d'hiver dure 25 heures : la réussite du samedi suffit encore le dimanche avant 6 h 15.
  assert.equal(taskState(forecast, run({ lastSuccessAt: '2026-10-24T04:16:00.000Z' }), new Date('2026-10-25T05:14:00.000Z')).kind, 'ok');
});

test('C1 (D-303) : la relecture des prévisions de la journée a son déclencheur et sa tâche, orange à 16 heures et rouge à 27', () => {
  assert.deepEqual(tasksOfTrigger('weather-intraday'), ['weather-intraday']);
  const intraday = TASK_TRIGGERS.find((trigger) => trigger.key === 'weather-intraday')!;
  assert.equal(intraday.cron, '30 7,8,10,11,13,14,16,17,19,20 * * *', '9 h 30 à 21 h 30 à Paris, toutes les trois heures, hiver et été');
  assert.equal(intraday.config, 'cloudflare/irrigation-weather-scheduler/wrangler.jsonc', 'le même planificateur, sans service nouveau');
  assert.ok(intraday.monitored, 'surveillé par la veille');
  const declaration = taskDeclaration('weather-intraday');
  assert.equal(declaration.lateAfterHours, 16, 'plus que les douze heures de la nuit, entre 21 h 30 et 9 h 30');
  assert.equal(declaration.brokenAfterHours, 27);
  const lastEvening = new Date('2026-11-23T20:30:00Z');
  const run = (at: Date): TaskRunRecord => ({ ...EMPTY_TASK_RUN, lastSuccessAt: at.toISOString(), lastAttemptAt: at.toISOString() });
  assert.equal(taskState(declaration, run(lastEvening), new Date('2026-11-24T08:00:00Z')).kind, 'ok', 'la veille de 9 h ne voit rien après une nuit normale');
  assert.equal(taskState(declaration, run(lastEvening), new Date('2026-11-24T12:31:00Z')).kind, 'late', '9 h 30 et 12 h 30 manqués');
  assert.equal(taskState(declaration, run(lastEvening), new Date('2026-11-25T00:00:00Z')).kind, 'broken', 'une journée entière manquée');
});
