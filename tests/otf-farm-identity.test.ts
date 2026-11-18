import assert from 'node:assert/strict';
import test from 'node:test';
import { farmIdentityShape, otfFarmIdentity, snapshotFarmIdentity, UNKNOWN_STRUCTURE_ID } from '../lib/domain/otf/farm-identity.ts';

// L'identité de la ferme lue chez Ouvre ta ferme (docs/tranche-4-contract.md, F329 et F338).

test('une réponse de `GET /me` qui porte une seule structure donne son identifiant', () => {
  assert.equal(otfFarmIdentity([{ id: 17, name: 'Ferme', legalCity: 'Rennes' }]), '17');
  assert.equal(otfFarmIdentity({ id: 17, name: 'Ferme' }), '17');
  assert.equal(otfFarmIdentity({ list: [{ id: '4394' }] }), '4394');
  assert.equal(otfFarmIdentity({ 'hydra:member': [{ '@id': '/structures/7' }] }), '7');
  assert.equal(otfFarmIdentity([{ id: ' 4394 ' }]), '4394');
});

test('une réponse sans identifiant lisible, ou qui désigne plusieurs structures, n’est pas une identité (F329)', () => {
  for (const payload of [
    null,
    undefined,
    'ferme',
    17,
    [],
    {},
    { list: [] },
    [{ id: 17 }, { id: 18 }],
    { list: [{ id: 17 }, { id: 17 }] },
    [{ name: 'Sans identifiant' }],
    [{ id: 0 }],
    [{ id: -3 }],
    [{ id: 1.5 }],
    [{ id: '' }],
    [{ id: '7 8' }],
    [{ id: 'ferme·7' }],
    [{ id: 'x'.repeat(65) }],
    [{ id: null }],
    [{ id: true }],
    [{ id: UNKNOWN_STRUCTURE_ID }],
    ['17'],
  ]) {
    assert.equal(otfFarmIdentity(payload), null, JSON.stringify(payload) ?? String(payload));
  }
});

test('la ferme d’un instantané en cache compte seulement si elle est lisible (F338)', () => {
  const snapshotOf = (id: string) => ({ structure: { id } });
  assert.equal(snapshotFarmIdentity(snapshotOf('4394')), '4394');
  assert.equal(snapshotFarmIdentity(snapshotOf('farm-demo')), 'farm-demo');
  assert.equal(snapshotFarmIdentity(snapshotOf(UNKNOWN_STRUCTURE_ID)), null, 'le remplaçant d’un identifiant absent');
  assert.equal(snapshotFarmIdentity(snapshotOf('')), null);
  assert.equal(snapshotFarmIdentity(snapshotOf('7/8')), null);
});

test('la forme d’une réponse sans identité se décrit sans aucune de ses valeurs (F341)', () => {
  assert.deepEqual(farmIdentityShape([{ id: 17 }, { id: 18 }]), { structures: 2, identifier: 'number' });
  assert.deepEqual(farmIdentityShape([{ name: 'Ferme du Moulin', legalCity: 'Rennes' }]), { structures: 1, identifier: 'absent' });
  assert.deepEqual(farmIdentityShape({ '@id': '/structures/7 8' }), { structures: 1, identifier: 'string' });
  assert.deepEqual(farmIdentityShape([]), { structures: 0, identifier: 'aucun' });
  assert.deepEqual(farmIdentityShape('Ferme du Moulin'), { structures: 0, identifier: 'aucun' });
  for (const payload of [[{ id: 4394, name: 'Ferme du Moulin' }], { list: [{ id: 'secret-4394' }, { id: 7 }] }]) {
    const written = JSON.stringify(farmIdentityShape(payload));
    assert.doesNotMatch(written, /4394|Moulin|secret/, 'aucune valeur de la réponse');
  }
});
