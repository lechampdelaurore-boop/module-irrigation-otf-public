import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GESTURE_OLDEST_DAYS,
  OPERATOR_GESTURES,
  frenchDay,
  gestureDates,
  gestureDecision,
  gestureRecordedMessage,
  isGestureTask,
  type GestureTask,
} from '../lib/domain/operations/operator-gesture.ts';
import { operatorStatusView } from '../lib/domain/operations/operator-status-view.ts';
import { operatorWatchNotice, type WatchedTask } from '../lib/domain/operations/operator-watch.ts';
import { OPERATOR_GESTURE, TASK_REGISTRY, taskDeclaration } from '../lib/domain/operations/task-registry.ts';
import { EMPTY_TASK_RUN, taskState } from '../lib/domain/operations/task-state.ts';
import { millisecondsFromDays, millisecondsFromHours } from '../lib/domain/units.ts';

/**
 * Les tâches faites par l'exploitant, au registre (4.5, PR 4 ;
 * docs/tranche-4-contract.md, F560, 10 bis.9, 10 bis.14, F625, et 10 bis.16,
 * F636 et F637) : l'export hors de Cloudflare, une fois par semaine, orange à
 * 8 jours et rouge à 10 ; l'essai de restauration, une fois par trimestre,
 * orange à 100 jours et rouge à 120. La veille les rappelle ; leur geste
 * (« J'ai fait l'export du … », « J'ai fait l'essai du … ») note un jour
 * passé ou le jour même, et la dernière réussite ne recule jamais.
 */

/** Vendredi 20 novembre 2026, 21 h 30 à Paris. */
const NOW = new Date('2026-11-20T20:30:00.000Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - millisecondsFromDays(days)).toISOString();

test('chaque tâche faite par l’exploitant a son geste, et seules elles en ont un', () => {
  assert.deepEqual(
    TASK_REGISTRY.filter((task) => task.trigger === OPERATOR_GESTURE).map((task) => task.key),
    Object.keys(OPERATOR_GESTURES),
  );
  assert.equal(isGestureTask('restore-rehearsal'), true);
  for (const value of ['weather-forecast', 'operator-watch', 'toString', '__proto__', '', null, 42]) assert.equal(isGestureTask(value), false, String(value));
  const events = Object.values(OPERATOR_GESTURES).flatMap((gesture) => [gesture.recordedEvent, gesture.notRecordedEvent]);
  assert.equal(new Set(events).size, events.length, 'un nom de journal par geste et par issue');
});

test('l’export au registre : une fois par semaine, orange à 8 jours, rouge à 10, jamais vert avant le premier export', () => {
  const task = taskDeclaration('offsite-export');
  assert.equal(task.lateAfterHours, 8 * 24);
  assert.equal(task.brokenAfterHours, 10 * 24);
  assert.equal(task.trigger, 'operator-gesture');
  assert.match(task.rhythm, /pnpm backup:export/);
  assert.equal(taskState(task, EMPTY_TASK_RUN, NOW).kind, 'never');
  assert.equal(taskState(task, { ...EMPTY_TASK_RUN, lastSuccessAt: daysAgo(7) }, NOW).kind, 'ok');
  assert.equal(taskState(task, { ...EMPTY_TASK_RUN, lastSuccessAt: daysAgo(9) }, NOW).kind, 'late');
  assert.equal(taskState(task, { ...EMPTY_TASK_RUN, lastSuccessAt: daysAgo(11) }, NOW).kind, 'broken');
});

test('l’essai de restauration au registre : une fois par trimestre, orange à 100 jours, rouge à 120, jamais vert avant le premier essai', () => {
  const task = taskDeclaration('restore-rehearsal');
  assert.equal(task.label, 'Essai de restauration');
  assert.equal(task.lateAfterHours, 100 * 24);
  assert.equal(task.brokenAfterHours, 120 * 24);
  assert.equal(task.trigger, 'operator-gesture');
  assert.match(task.rhythm, /trimestre/);
  assert.match(task.rhythm, /changement de schéma important/);
  assert.match(task.rhythm, /Essai de restauration/, 'le flux qui le joue');
  assert.match(task.successKeptIn, /task:restore-rehearsal/);
  assert.equal(taskState(task, EMPTY_TASK_RUN, NOW).kind, 'never');
  assert.equal(taskState(task, { ...EMPTY_TASK_RUN, lastSuccessAt: daysAgo(91) }, NOW).kind, 'ok', 'un trimestre tout juste');
  assert.equal(taskState(task, { ...EMPTY_TASK_RUN, lastSuccessAt: daysAgo(101) }, NOW).kind, 'late');
  assert.equal(taskState(task, { ...EMPTY_TASK_RUN, lastSuccessAt: daysAgo(121) }, NOW).kind, 'broken');
});

test('la veille rappelle l’export et l’essai manqués, par leur nom et depuis quand', () => {
  const late: Partial<Record<string, string>> = { 'offsite-export': '2026-11-11T20:30:00.000Z', 'restore-rehearsal': '2026-08-10T12:00:00.000Z' };
  for (const key of Object.keys(late)) {
    const watched: WatchedTask[] = TASK_REGISTRY.map((declaration) => ({
      declaration,
      state: taskState(declaration, {
        ...EMPTY_TASK_RUN,
        lastSuccessAt: declaration.key === key ? late[key]! : new Date(NOW.getTime() - millisecondsFromHours(14)).toISOString(),
      }, NOW),
    }));
    const notice = operatorWatchNotice(watched, NOW);
    assert.equal(notice?.title, 'Module d\'irrigation : une tâche en retard', key);
    assert.equal(notice?.body, key === 'offsite-export'
      ? 'Export de la base hors de Cloudflare : en retard (aucune réussite depuis le 11/11 à 21 h 30).'
      : 'Essai de restauration : en retard (aucune réussite depuis le 10/08 à 14 h 00).');
  }
});

test('la page porte le geste sur la carte de chaque tâche faite par l’exploitant, et sur elles seules', () => {
  const view = operatorStatusView(TASK_REGISTRY.map((declaration) => ({ declaration, state: taskState(declaration, EMPTY_TASK_RUN, NOW) })), null, [], gestureDates(NOW));
  assert.deepEqual(view.tasks.filter((task) => task.gesture !== null).map((task) => [task.key, task.gesture]), [
    ['offsite-export', 'offsite-export'],
    ['restore-rehearsal', 'restore-rehearsal'],
  ]);
  assert.deepEqual(view.gestureDates, { today: '2026-11-20', earliest: '2026-10-21' });
});

test('les jours proposés : d’aujourd’hui, à l’heure de Paris, à 30 jours avant', () => {
  assert.deepEqual(gestureDates(NOW), { today: '2026-11-20', earliest: '2026-10-21' });
  assert.deepEqual(gestureDates(new Date('2026-11-20T23:30:00.000Z')).today, '2026-11-21', 'après minuit à Paris, c’est le lendemain');
  assert.equal(GESTURE_OLDEST_DAYS, 30);
  assert.equal(frenchDay('2026-11-08'), '08/11/2026');
});

for (const task of Object.keys(OPERATOR_GESTURES) as GestureTask[]) {
  test(`${task} : le geste note le jour même à l’heure du geste, un jour passé à midi`, () => {
    assert.deepEqual(gestureDecision(task, '2026-11-20', NOW, null), { ok: true, day: '2026-11-20', at: NOW.toISOString() });
    assert.deepEqual(gestureDecision(task, '2026-11-18', NOW, null), { ok: true, day: '2026-11-18', at: '2026-11-18T12:00:00.000Z' });
    assert.deepEqual(gestureDecision(task, '2026-11-18', NOW, '2026-11-12T19:00:00.000Z'), { ok: true, day: '2026-11-18', at: '2026-11-18T12:00:00.000Z' }, 'plus récent que le dernier noté');
  });
}

test('le geste refuse un jour à venir, trop ancien, mal écrit, ou plus ancien que celui déjà noté, en nommant ce qui est noté', () => {
  const refused = (task: GestureTask, day: unknown, last: string | null = null) => {
    const decision = gestureDecision(task, day, NOW, last);
    assert.equal(decision.ok, false, `${task} ${String(day)}`);
    return decision.ok ? '' : decision.message;
  };
  for (const task of Object.keys(OPERATOR_GESTURES) as GestureTask[]) {
    assert.match(refused(task, '2026-11-21'), /à venir/);
    assert.match(refused(task, '2026-10-20'), /plus de 30 jours/);
    assert.equal(gestureDecision(task, '2026-10-21', NOW, null).ok, true, '30 jours tout juste');
    for (const day of ['', '20/11/2026', '2026-02-30', '2026-13-01', null, 42, '2026-11-20T00:00']) assert.match(refused(task, day), /Choisissez le jour/);
    assert.match(refused(task, '2026-11-18', '2026-11-18T23:30:00.000Z'), /celui du 19\/11\/2026\.$/, 'le jour de Paris de la réussite notée');
  }
  assert.equal(refused('offsite-export', '2026-11-21'), 'Ce jour est à venir : notez l’export une fois fait.');
  assert.equal(refused('offsite-export', '2026-10-20'), 'Un export de plus de 30 jours ne compte plus : faites-en un nouveau.');
  assert.equal(refused('offsite-export', 'hier'), 'Choisissez le jour de l’export.');
  assert.equal(refused('offsite-export', '2026-11-18', '2026-11-18T19:00:00.000Z'), 'L’export du 18/11/2026 est déjà noté.');
  assert.equal(refused('offsite-export', '2026-11-15', '2026-11-18T19:00:00.000Z'), 'Un export plus récent est déjà noté : celui du 18/11/2026.');
  assert.equal(refused('restore-rehearsal', '2026-11-21'), 'Ce jour est à venir : notez l’essai une fois fait.');
  assert.equal(refused('restore-rehearsal', '2026-10-20'), 'Un essai de plus de 30 jours ne compte plus : faites-en un nouveau.');
  assert.equal(refused('restore-rehearsal', 'hier'), 'Choisissez le jour de l’essai.');
  assert.equal(refused('restore-rehearsal', '2026-11-18', '2026-11-18T19:00:00.000Z'), 'L’essai du 18/11/2026 est déjà noté.');
  assert.equal(refused('restore-rehearsal', '2026-11-15', '2026-11-18T19:00:00.000Z'), 'Un essai plus récent est déjà noté : celui du 18/11/2026.');
  assert.equal(gestureRecordedMessage('offsite-export', '2026-11-20'), 'L’export du 20/11/2026 est noté.');
  assert.equal(gestureRecordedMessage('restore-rehearsal', '2026-11-20'), 'L’essai du 20/11/2026 est noté.');
});
