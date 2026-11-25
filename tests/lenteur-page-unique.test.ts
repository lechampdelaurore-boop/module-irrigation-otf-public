import assert from 'node:assert/strict';
import test from 'node:test';
import { renderOncePerRequest } from '../app/irrigation/render-once';

/**
 * Lenteur du module, N1 (D-322) : hors d'une requête, rien n'est gardé, la
 * page est appelée à chaque fois avec ses propres arguments ; dans une
 * requête, le parcours P59 et la mesure du contrat le montrent.
 */
test('hors d’une requête, la page est appelée à chaque fois', async () => {
  const appels: number[] = [];
  const page = renderOncePerRequest(async ({ n }: { n: number }) => {
    appels.push(n);
    return `page ${n}`;
  });
  assert.equal(await page({ n: 1 }), 'page 1');
  assert.equal(await page({ n: 2 }), 'page 2');
  assert.deepEqual(appels, [1, 2]);
});
