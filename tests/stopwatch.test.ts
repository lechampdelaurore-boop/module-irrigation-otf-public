import assert from 'node:assert/strict';
import test from 'node:test';
import { startStopwatch } from '../lib/adapters/stopwatch.ts';

test('le chronomètre nomme chaque phase et rend des millisecondes entières', () => {
  let at = 1000;
  const stopwatch = startStopwatch(() => at);
  at = 1012.4;
  assert.equal(stopwatch.lap('snapshot'), 12);
  assert.equal(stopwatch.lap('inputs'), 0, 'une phase sans entrée-sortie mesure zéro : l’horloge n’a pas avancé');
  at = 1021;
  assert.equal(stopwatch.lap('engine'), 9);
  at = 1030;
  assert.deepEqual(stopwatch.report(), { durationsMs: { snapshot: 12, inputs: 0, engine: 9 }, totalMs: 30 });
});

test('une phase reprise sous le même nom cumule ses durées, dans l’ordre de sa première apparition', () => {
  let at = 0;
  const stopwatch = startStopwatch(() => at);
  at = 5;
  stopwatch.lap('reads');
  at = 7;
  stopwatch.lap('needs');
  at = 10;
  stopwatch.lap('reads');
  assert.deepEqual(stopwatch.report().durationsMs, { reads: 8, needs: 2 });
});
