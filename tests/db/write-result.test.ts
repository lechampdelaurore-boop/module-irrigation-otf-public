import assert from 'node:assert/strict';
import test from 'node:test';
import { aEcritUneLigne } from '../../db/write-result';

/**
 * Le piège que ce module désamorce : le D1 réel ne renseigne pas toujours
 * `meta.changes` là où l'adaptateur SQLite des tests le fait. Un dépôt qui ne
 * lisait que `changes` annonçait donc un échec après une écriture réussie —
 * archivage d'un matériel et retrait d'une position, tous deux constatés sur le
 * site le 25 septembre 2026.
 */

test('une écriture est reconnue par `changes` ou par `rows_written`', () => {
  assert.equal(aEcritUneLigne({ changes: 1, rows_written: 1 }), true, 'les deux renseignés');
  assert.equal(
    aEcritUneLigne({ changes: 0, rows_written: 1 }),
    true,
    'le cas du D1 réel : `changes` muet, `rows_written` parle',
  );
  assert.equal(aEcritUneLigne({ rows_written: 2 }), true, '`changes` absent');
  assert.equal(aEcritUneLigne({ changes: 3 }), true, '`rows_written` absent');
});

test('une écriture qui n’a rien touché reste un échec', () => {
  assert.equal(aEcritUneLigne({ changes: 0, rows_written: 0 }), false);
  assert.equal(aEcritUneLigne({}), false, 'aucun des deux renseigné : rien ne prouve l’écriture');
  assert.equal(aEcritUneLigne(undefined), false, 'pas de méta du tout, par exemple un lot vide');
});
