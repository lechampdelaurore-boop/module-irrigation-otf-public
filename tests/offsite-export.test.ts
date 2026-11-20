import assert from 'node:assert/strict';
import test from 'node:test';
import { OFFSITE_EXPORT_OLDEST_DAYS, frenchDay, offsiteExportDates, offsiteExportDecision } from '../lib/domain/operations/offsite-export.ts';
import { operatorWatchNotice, type WatchedTask } from '../lib/domain/operations/operator-watch.ts';
import { TASK_REGISTRY, taskDeclaration } from '../lib/domain/operations/task-registry.ts';
import { EMPTY_TASK_RUN, taskState } from '../lib/domain/operations/task-state.ts';
import { millisecondsFromDays, millisecondsFromHours } from '../lib/domain/units.ts';

/**
 * L'export hors de Cloudflare, au registre (4.5, PR 4 ; docs/tranche-4-contract.md,
 * F560, 10 bis.9, et 10 bis.14, F625) : une tâche faite à la main, une fois
 * par semaine, orange à 8 jours et rouge à 10, que la veille rappelle ; le
 * geste « J'ai fait l'export du … » note un jour passé ou le jour même, et
 * la dernière réussite ne recule jamais.
 */

/** Vendredi 20 novembre 2026, 21 h 30 à Paris. */
const NOW = new Date('2026-11-20T20:30:00.000Z');

test('la tâche du registre : une fois par semaine, orange à 8 jours, rouge à 10, jamais verte avant le premier export', () => {
  const task = taskDeclaration('offsite-export');
  assert.equal(task.lateAfterHours, 8 * 24);
  assert.equal(task.brokenAfterHours, 10 * 24);
  assert.equal(task.trigger, 'operator-gesture');
  assert.match(task.rhythm, /pnpm backup:export/);
  assert.equal(taskState(task, EMPTY_TASK_RUN, NOW).kind, 'never');
  const daysAgo = (days: number) => new Date(NOW.getTime() - millisecondsFromDays(days)).toISOString();
  assert.equal(taskState(task, { ...EMPTY_TASK_RUN, lastSuccessAt: daysAgo(7) }, NOW).kind, 'ok');
  assert.equal(taskState(task, { ...EMPTY_TASK_RUN, lastSuccessAt: daysAgo(9) }, NOW).kind, 'late');
  assert.equal(taskState(task, { ...EMPTY_TASK_RUN, lastSuccessAt: daysAgo(11) }, NOW).kind, 'broken');
});

test('la veille rappelle l’export manqué, par son nom et depuis quand', () => {
  const watched: WatchedTask[] = TASK_REGISTRY.map((declaration) => ({
    declaration,
    state: taskState(declaration, {
      ...EMPTY_TASK_RUN,
      lastSuccessAt: declaration.key === 'offsite-export' ? '2026-11-11T20:30:00.000Z' : new Date(NOW.getTime() - millisecondsFromHours(14)).toISOString(),
    }, NOW),
  }));
  const notice = operatorWatchNotice(watched, NOW);
  assert.equal(notice?.title, 'Module d\'irrigation : une tâche en retard');
  assert.equal(notice?.body, 'Export de la base hors de Cloudflare : en retard (aucune réussite depuis le 11/11 à 21 h 30).');
});

test('les jours proposés : d’aujourd’hui, à l’heure de Paris, à 30 jours avant', () => {
  assert.deepEqual(offsiteExportDates(NOW), { today: '2026-11-20', earliest: '2026-10-21' });
  assert.deepEqual(offsiteExportDates(new Date('2026-11-20T23:30:00.000Z')).today, '2026-11-21', 'après minuit à Paris, c’est le lendemain');
  assert.equal(OFFSITE_EXPORT_OLDEST_DAYS, 30);
  assert.equal(frenchDay('2026-11-08'), '08/11/2026');
});

test('le geste note le jour même à l’heure du geste, un jour passé à midi', () => {
  assert.deepEqual(offsiteExportDecision('2026-11-20', NOW, null), { ok: true, day: '2026-11-20', at: NOW.toISOString() });
  assert.deepEqual(offsiteExportDecision('2026-11-18', NOW, null), { ok: true, day: '2026-11-18', at: '2026-11-18T12:00:00.000Z' });
  assert.deepEqual(offsiteExportDecision('2026-11-18', NOW, '2026-11-12T19:00:00.000Z'), { ok: true, day: '2026-11-18', at: '2026-11-18T12:00:00.000Z' }, 'un export plus récent que le dernier noté');
});

test('le geste refuse un jour à venir, trop ancien, mal écrit, ou plus ancien que l’export déjà noté', () => {
  const refused = (day: unknown, last: string | null = null) => {
    const decision = offsiteExportDecision(day, NOW, last);
    assert.equal(decision.ok, false, String(day));
    return decision.ok ? '' : decision.message;
  };
  assert.match(refused('2026-11-21'), /à venir/);
  assert.match(refused('2026-10-20'), /plus de 30 jours/);
  assert.equal(offsiteExportDecision('2026-10-21', NOW, null).ok, true, '30 jours tout juste');
  for (const day of ['', '20/11/2026', '2026-02-30', '2026-13-01', null, 42, '2026-11-20T00:00']) assert.match(refused(day), /Choisissez le jour/);
  assert.equal(refused('2026-11-18', '2026-11-18T19:00:00.000Z'), 'L’export du 18/11/2026 est déjà noté.');
  assert.equal(refused('2026-11-15', '2026-11-18T19:00:00.000Z'), 'Un export plus récent est déjà noté : celui du 18/11/2026.');
  assert.equal(refused('2026-11-18', '2026-11-18T23:30:00.000Z'), 'Un export plus récent est déjà noté : celui du 19/11/2026.', 'le jour de Paris de la réussite notée');
});
