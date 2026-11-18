import assert from 'node:assert/strict';
import test from 'node:test';
import { farmSpaceOf } from '../../lib/domain/farm-space';
import { ALICE, BOB, ISOLATION_PASS } from '../support/spaces';

// Les passages d'isolation de `pnpm test` (4.2, docs/tranche-4-contract.md,
// section 5 bis, F336) : chaque test de `tests/db/` qui prouve que Bob ne voit
// rien d'Alice est rejoué pour deux fermes d'une même personne, pour deux
// personnes d'une même ferme, puis pour l'espace sans ferme d'une personne et
// son espace de ferme (F379). Ce test vérifie que le passage demandé est bien
// celui que les tests reçoivent.

test(`passage d’isolation « ${ISOLATION_PASS} » : Alice et Bob sont bien les espaces annoncés`, () => {
  const alice = farmSpaceOf(ALICE);
  const bob = farmSpaceOf(BOB);
  if (ISOLATION_PASS === 'fermes') {
    assert.equal(alice.ownerUserId, bob.ownerUserId, 'une même personne');
    assert.ok(alice.otfFarmId !== null && bob.otfFarmId !== null && alice.otfFarmId !== bob.otfFarmId, 'deux fermes');
  } else if (ISOLATION_PASS === 'personnes') {
    assert.notEqual(alice.ownerUserId, bob.ownerUserId, 'deux personnes');
    assert.ok(alice.otfFarmId !== null && alice.otfFarmId === bob.otfFarmId, 'une même ferme');
  } else if (ISOLATION_PASS === 'rattachement') {
    assert.equal(alice.ownerUserId, bob.ownerUserId, 'une même personne');
    assert.ok(alice.otfFarmId === null && bob.otfFarmId !== null, 'son espace sans ferme et son espace de ferme');
  } else {
    assert.deepEqual([alice, bob], [{ ownerUserId: 'alice', otfFarmId: null }, { ownerUserId: 'bob', otfFarmId: null }]);
  }
});

test('le script des passages d’isolation choisit bien un passage pour chaque processus de test', () => {
  // `pnpm test:isolation` lance les trois passages : si `--import` ne
  // parvenait plus aux processus de test, ils rejoueraient en silence le
  // passage sans ferme, et l'isolation des fermes ne serait plus prouvée.
  if (process.env.npm_lifecycle_event === 'test:isolation') assert.notEqual(ISOLATION_PASS, 'sans-ferme');
});
