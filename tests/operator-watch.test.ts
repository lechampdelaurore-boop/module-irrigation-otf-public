import assert from 'node:assert/strict';
import test from 'node:test';
import { validateIrrigationPushNotification } from '../lib/domain/irrigation-push-contract.ts';
import { operatorStatusView } from '../lib/domain/operations/operator-status-view.ts';
import {
  OPERATOR_PAGE_PATH,
  operatorWatchNotice,
  parisDay,
  parisMoment,
  type OperatorNotice,
  type WatchedTask,
} from '../lib/domain/operations/operator-watch.ts';
import { REPEATED_FAILURES_FOR_BROKEN, TASK_REGISTRY, taskDeclaration, type TaskKey } from '../lib/domain/operations/task-registry.ts';
import { EMPTY_TASK_RUN, taskState, type TaskRunRecord } from '../lib/domain/operations/task-state.ts';
import { millisecondsFromHours, millisecondsFromMinutes } from '../lib/domain/units.ts';

/**
 * La veille de l'exploitant et sa page d'état (4.5, PR 2 ;
 * docs/tranche-4-contract.md, F565, F566, F608 à F613) : chaque tâche
 * sabotée fait partir une notification qui la nomme et dit depuis quand,
 * dans les limites du service de notification ; « tout va bien » le dimanche
 * seulement ; jamais un vert faute de réussite.
 */

/** Vendredi 20 novembre 2026, 9 h à Paris. */
const FRIDAY = new Date('2026-11-20T08:00:00.000Z');
/** Dimanche 22 novembre 2026, 9 h à Paris. */
const SUNDAY = new Date('2026-11-22T08:00:00.000Z');

const ago = (now: Date, milliseconds: number) => new Date(now.getTime() - milliseconds).toISOString();
const fresh = (now: Date): TaskRunRecord => ({ ...EMPTY_TASK_RUN, lastSuccessAt: ago(now, millisecondsFromHours(3)), lastAttemptAt: ago(now, millisecondsFromHours(3)) });

/** Le registre à l'heure donnée : chaque tâche réussie il y a trois heures, sauf celles qu'on sabote. */
function registry(now: Date, sabotaged: Partial<Record<TaskKey, TaskRunRecord>> = {}): WatchedTask[] {
  return TASK_REGISTRY.map((declaration) => ({
    declaration,
    state: taskState(declaration, sabotaged[declaration.key] ?? fresh(now), now),
  }));
}

function assertDeliverable(notice: OperatorNotice, label: string) {
  assert.ok(
    validateIrrigationPushNotification({ title: notice.title, body: notice.body, tag: notice.tag, data: { url: notice.url } }),
    `${label} : le service de notification l'accepte (titre de 80 caractères, texte de 160, adresse du module) — « ${notice.title} » / « ${notice.body} » (${notice.body.length})`,
  );
  assert.equal(notice.url, OPERATOR_PAGE_PATH);
}

const WATCHED = TASK_REGISTRY.filter((task) => task.key !== 'operator-watch');

test('sabotage de chaque tâche surveillée : la notification part, la nomme, dit depuis quand, et tient dans les limites du service', async (t) => {
  for (const declaration of WATCHED) {
    await t.test(declaration.key, () => {
      const late = millisecondsFromHours(declaration.lateAfterHours) + millisecondsFromMinutes(1);
      const broken = millisecondsFromHours(declaration.brokenAfterHours + 1);
      const sabotages: { name: string; run: TaskRunRecord; state: string; since: string }[] = [
        {
          name: 'plus de réussite depuis le seuil orange',
          run: { ...EMPTY_TASK_RUN, lastSuccessAt: ago(FRIDAY, late), lastAttemptAt: ago(FRIDAY, late) },
          state: 'en retard',
          since: `aucune réussite depuis le ${parisMoment(ago(FRIDAY, late))}`,
        },
        {
          name: 'plus de réussite depuis le seuil rouge et une heure',
          run: { ...EMPTY_TASK_RUN, lastSuccessAt: ago(FRIDAY, broken), lastAttemptAt: ago(FRIDAY, broken) },
          state: 'en panne',
          since: `aucune réussite depuis le ${parisMoment(ago(FRIDAY, broken))}`,
        },
        {
          name: 'trois échecs de suite après une réussite récente',
          run: {
            lastSuccessAt: ago(FRIDAY, millisecondsFromHours(4)),
            lastAttemptAt: ago(FRIDAY, millisecondsFromHours(1)),
            lastError: 'erreur du coffre',
            consecutiveFailures: REPEATED_FAILURES_FOR_BROKEN,
            failingSince: ago(FRIDAY, millisecondsFromHours(3)),
          },
          state: 'en panne',
          since: `en échec depuis le ${parisMoment(ago(FRIDAY, millisecondsFromHours(3)))}`,
        },
        { name: 'jamais réussie', run: EMPTY_TASK_RUN, state: 'jamais réussie', since: '' },
      ];
      for (const sabotage of sabotages) {
        const notice = operatorWatchNotice(registry(FRIDAY, { [declaration.key]: sabotage.run }), FRIDAY);
        assert.ok(notice, `${sabotage.name} : une notification part`);
        assert.equal(notice.kind, 'alert');
        assert.equal(notice.problems, 1);
        assert.equal(notice.title, `Module d'irrigation : une tâche ${sabotage.state}`);
        assert.ok(notice.body.startsWith(`${declaration.label} : ${sabotage.state}`), `${sabotage.name} : la tâche est nommée — « ${notice.body} »`);
        assert.ok(notice.body.includes(sabotage.since), `${sabotage.name} : depuis quand — « ${notice.body} »`);
        assertDeliverable(notice, sabotage.name);
      }
    });
  }
});

test('la panne du 14 novembre 2026 rejouée : le 15 à 9 h, l’exploitant lit quelle tâche, depuis quand, et la dernière erreur', () => {
  const now = new Date('2026-11-15T08:00:00.000Z');
  const notice = operatorWatchNotice(registry(now, {
    'weather-reanalysis': {
      lastSuccessAt: '2026-11-13T05:16:00.000Z',
      lastAttemptAt: '2026-11-15T05:16:00.000Z',
      lastError: '1 lieu sur 1 sans pluie estimée (réseau)',
      consecutiveFailures: 2,
      failingSince: '2026-11-14T05:16:00.000Z',
    },
  }), now);
  assert.deepEqual(notice, {
    kind: 'alert',
    problems: 1,
    title: 'Module d\'irrigation : une tâche en panne',
    body: 'Pluie estimée après coup (réanalyse) : en panne (en échec depuis le 14/11 à 6 h 16). Dernière erreur : 1 lieu sur 1 sans pluie estimée (réseau).',
    tag: 'operator-watch',
    url: '/irrigation/exploitation',
  });
  assertDeliverable(notice!, '14 novembre');
});

test('tout le matin en panne : la plus grave d’abord, autant de tâches que le texte en tient, puis « Et N autres »', () => {
  const stale = { ...EMPTY_TASK_RUN, lastSuccessAt: ago(FRIDAY, millisecondsFromHours(40)), lastAttemptAt: ago(FRIDAY, millisecondsFromHours(40)) };
  const late = { ...EMPTY_TASK_RUN, lastSuccessAt: ago(FRIDAY, millisecondsFromHours(30)), lastAttemptAt: ago(FRIDAY, millisecondsFromHours(30)) };
  const notice = operatorWatchNotice(registry(FRIDAY, {
    'weather-forecast': late,
    'weather-reanalysis': stale,
    'morning-calculation': stale,
    'otf-vault-morning': EMPTY_TASK_RUN,
  }), FRIDAY);
  assert.ok(notice);
  assert.equal(notice.title, 'Module d\'irrigation : 4 tâches à regarder');
  assert.equal(notice.problems, 4);
  assert.ok(notice.body.startsWith('Pluie estimée après coup (réanalyse) : en panne'), `la plus grave d’abord, dans l’ordre du registre — « ${notice.body} »`);
  assert.match(notice.body, /Et [1-3] autres?\.$/, 'les autres sont comptées');
  assert.ok(!notice.body.includes('Dernière erreur'), 'la dernière erreur ne se dit que pour une tâche seule');
  assertDeliverable(notice, 'quatre tâches');
});

test('la veille ne se nomme pas elle-même : jamais réussie à sa première exécution, elle ne prévient pas pour rien', () => {
  const firstRun = registry(FRIDAY, { 'operator-watch': EMPTY_TASK_RUN });
  assert.equal(firstRun.find((task) => task.declaration.key === 'operator-watch')!.state.kind, 'never');
  assert.equal(operatorWatchNotice(firstRun, FRIDAY), null, 'un vendredi où tout va bien : rien');
  const sunday = operatorWatchNotice(registry(SUNDAY, { 'operator-watch': EMPTY_TASK_RUN }), SUNDAY);
  assert.equal(sunday?.kind, 'all-good');
  assert.equal(sunday?.body, `Les ${WATCHED.length} tâches sont à l'heure. Ce message revient chaque dimanche : s'il manque, regardez la page d'état.`);
});

test('rien à signaler : « tout va bien » le dimanche seulement, pas de bruit les autres jours', () => {
  assert.equal(operatorWatchNotice(registry(FRIDAY), FRIDAY), null, 'vendredi');
  assert.equal(operatorWatchNotice(registry(new Date('2026-11-23T08:00:00.000Z')), new Date('2026-11-23T08:00:00.000Z')), null, 'lundi');
  const notice = operatorWatchNotice(registry(SUNDAY), SUNDAY);
  assert.ok(notice);
  assert.deepEqual({ kind: notice.kind, problems: notice.problems, title: notice.title }, { kind: 'all-good', problems: 0, title: 'Module d\'irrigation : tout va bien' });
  assertDeliverable(notice, 'tout va bien');
  // Le dimanche de Paris, même quand l'heure UTC est encore samedi (23 h 30 UTC un samedi d'été = dimanche 1 h 30 à Paris).
  const parisSunday = new Date('2026-07-11T23:30:00.000Z');
  assert.equal(operatorWatchNotice(registry(parisSunday), parisSunday)?.kind, 'all-good');
});

test('les dates sont à l’heure de Paris, en hiver comme en été ; une notification par jour de Paris', () => {
  assert.equal(parisMoment('2026-11-14T05:16:00.000Z'), '14/11 à 6 h 16');
  assert.equal(parisMoment('2026-07-14T04:05:00.000Z'), '14/07 à 6 h 05');
  assert.equal(parisDay(new Date('2026-11-14T08:00:00.000Z')), '2026-11-14');
  assert.equal(parisDay(new Date('2026-07-11T23:30:00.000Z')), '2026-07-12', 'minuit passé à Paris : le jour suivant');
});

test('la page d’état : un jugement d’ensemble en une ligne, chaque tâche avec son état, jamais un vert faute de réussite', () => {
  const allGood = operatorStatusView(registry(FRIDAY), null);
  assert.deepEqual(allGood.verdict, { tone: 'ok', text: `Tout va bien : les ${TASK_REGISTRY.length} tâches sont à l'heure.` });
  assert.ok(allGood.tasks.every((task) => task.tone === 'ok' && task.state === 'À l\'heure' && task.failing === null));
  assert.equal(
    allGood.lastNotice,
    'Aucune notification de la veille enregistrée : la première alerte, ou le premier « tout va bien » du dimanche, la fera paraître ici.',
  );

  const firstDay = operatorStatusView(registry(FRIDAY, { 'operator-watch': EMPTY_TASK_RUN }), null);
  assert.deepEqual(firstDay.verdict, { tone: 'warn', text: '1 tâche jamais réussie.' }, 'la veille jamais réussie se voit sur la page, en orange');
  const watch = firstDay.tasks.find((task) => task.key === 'operator-watch')!;
  assert.deepEqual(
    { state: watch.state, tone: watch.tone, lastSuccess: watch.lastSuccess, failing: watch.failing },
    { state: 'Jamais réussie', tone: 'warn', lastSuccess: 'aucune enregistrée', failing: null },
  );

  const mixed = operatorStatusView(registry(FRIDAY, {
    'weather-reanalysis': {
      lastSuccessAt: '2026-11-18T05:16:00.000Z',
      lastAttemptAt: '2026-11-20T05:16:00.000Z',
      lastError: '1 lieu sur 1 sans pluie estimée (réseau)',
      consecutiveFailures: 2,
      failingSince: '2026-11-19T05:16:00.000Z',
    },
    'morning-calculation': { ...EMPTY_TASK_RUN, lastSuccessAt: '2026-11-19T05:16:00.000Z', lastAttemptAt: '2026-11-19T05:16:00.000Z' },
    'otf-vault-morning': { ...EMPTY_TASK_RUN, lastSuccessAt: '2026-11-19T05:16:00.000Z', lastAttemptAt: '2026-11-19T05:16:00.000Z' },
  }), { kind: 'alert', problems: 3, sentAt: '2026-11-20T08:00:02.000Z' });
  assert.deepEqual(mixed.verdict, { tone: 'danger', text: '1 tâche en panne, 2 en retard.' });
  const reanalysis = mixed.tasks.find((task) => task.key === 'weather-reanalysis')!;
  assert.deepEqual(
    { state: reanalysis.state, tone: reanalysis.tone, lastSuccess: reanalysis.lastSuccess, failing: reanalysis.failing, lastError: reanalysis.lastError },
    {
      state: 'En panne',
      tone: 'danger',
      lastSuccess: '18/11 à 6 h 16',
      failing: 'en échec depuis le 19/11 à 6 h 16 (2 exécutions manquées de suite)',
      lastError: '1 lieu sur 1 sans pluie estimée (réseau)',
    },
  );
  assert.equal(mixed.lastNotice, 'Dernière notification de la veille : alerte pour 3 tâches, le 20/11 à 9 h 00.');
  assert.equal(
    operatorStatusView(registry(SUNDAY), { kind: 'all-good', problems: 0, sentAt: '2026-11-22T08:00:02.000Z' }).lastNotice,
    'Dernière notification de la veille : « tout va bien », le 22/11 à 9 h 00.',
  );
  assert.equal(mixed.tasks.length, TASK_REGISTRY.length, 'toutes les tâches du registre, la veille comprise');
  const empty = operatorStatusView(registry(FRIDAY, Object.fromEntries(TASK_REGISTRY.map((task) => [task.key, EMPTY_TASK_RUN]))), null);
  assert.deepEqual(empty.verdict, { tone: 'warn', text: `${TASK_REGISTRY.length} tâches jamais réussies.` }, 'une base neuve : orange, jamais vert');
  assert.equal(taskDeclaration('operator-watch').label, 'Veille de l\'exploitant');
});
