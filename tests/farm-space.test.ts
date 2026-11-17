import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { farmSpaceKey, farmSpaceOf, InvalidFarmSpaceError, isFarmId, spaceKeyOf } from '../lib/domain/farm-space.ts';

// La clé d'espace (docs/tranche-4-contract.md, section 5 bis, F327 et F328).

test('la clé d’un espace de ferme porte la personne et la ferme, et se relit telle quelle', () => {
  const key = farmSpaceKey('3f2a-sujet-access', '4394');
  assert.equal(key, '3f2a-sujet-access·ferme·4394');
  assert.deepEqual(farmSpaceOf(key), { ownerUserId: '3f2a-sujet-access', otfFarmId: '4394' });
  assert.equal(spaceKeyOf(farmSpaceOf(key)), key);
});

test('une clé sans ferme est celle d’un espace sans ferme : la démonstration et les espaces d’avant la 4.1 ne changent pas', () => {
  assert.deepEqual(farmSpaceOf('alice'), { ownerUserId: 'alice', otfFarmId: null });
  const demo = 'sujet·demo·maraichage·pic-ete';
  assert.deepEqual(farmSpaceOf(demo), { ownerUserId: demo, otfFarmId: null });
  assert.equal(spaceKeyOf({ ownerUserId: 'alice', otfFarmId: null }), 'alice');
});

test('deux fermes d’une même personne, ou une même ferme de deux personnes, ont deux clés différentes', () => {
  assert.notEqual(farmSpaceKey('alice', '7'), farmSpaceKey('alice', '8'));
  assert.notEqual(farmSpaceKey('alice', '7'), farmSpaceKey('bob', '7'));
  assert.notEqual(farmSpaceKey('alice', '7'), 'alice');
});

test('une ferme mal formée est refusée, jamais lue comme « sans ferme » (D-003)', () => {
  for (const farm of ['', ' ', '7/8', '7 8', 'ferme·7', '../7', 'x'.repeat(65)]) {
    assert.equal(isFarmId(farm), false, farm);
    assert.throws(() => farmSpaceKey('alice', farm), InvalidFarmSpaceError, farm);
  }
  assert.throws(() => farmSpaceOf('alice·ferme·'), InvalidFarmSpaceError);
  assert.throws(() => farmSpaceOf('alice·ferme·7 8'), InvalidFarmSpaceError);
  assert.throws(() => farmSpaceOf('alice·ferme·7·ferme·8'), InvalidFarmSpaceError, 'une seule ferme par clé');
  assert.equal(isFarmId('farm-demo'), true);
  assert.equal(isFarmId('x'.repeat(64)), true);
});

test('une personne absente ou qui porte déjà une ferme est refusée', () => {
  assert.throws(() => farmSpaceKey('', '7'), InvalidFarmSpaceError);
  assert.throws(() => farmSpaceKey('alice·ferme·7', '8'), InvalidFarmSpaceError);
  assert.throws(() => farmSpaceOf('·ferme·7'), InvalidFarmSpaceError);
  assert.throws(() => farmSpaceOf(''), InvalidFarmSpaceError);
});

/** Tous les fichiers `.ts` de `db/`, sous-dossiers compris. */
function databaseSources(directory = 'db'): string[] {
  return readdirSync(directory).flatMap((name) => {
    const file = path.join(directory, name);
    if (statSync(file).isDirectory()) return databaseSources(file);
    return file.endsWith('.ts') ? [file] : [];
  });
}

test('garde-fou (F328) : aucune requête de la persistance ne retrouve un espace par la seule personne', () => {
  // La démonstration seule garde ses espaces sans ferme, par contrat
  // (docs/demo-guided-contract.md, D4 ; section 5 du contrat de la Tranche 4).
  const allowed = new Set([path.join('db', 'workspace-scope.ts'), path.join('db', 'demo-space-repository.ts'), path.join('db', 'schema.ts')]);
  const offenders = databaseSources()
    .filter((file) => !allowed.has(file))
    .flatMap((file) => readFileSync(file, 'utf8').split('\n').map((line, index) => ({ file, line: index + 1, text: line })))
    .filter(({ text }) => /owner_user_id\s*=\s*\?|otf_farm_id\s+IS\s+NULL/i.test(text));
  assert.deepEqual(offenders, [], 'toute recherche d’espace passe par SPACE_FILTER ou WORKSPACE_SPACE_FILTER (db/workspace-scope.ts)');
});
