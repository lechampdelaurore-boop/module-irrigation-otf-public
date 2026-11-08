import assert from 'node:assert/strict';
import test from 'node:test';
import { FEATURE_IDS, PAGE_FEATURE_IDS, type FeatureId } from '../lib/domain/features/catalogue';
import { menuLayout } from '../lib/domain/features/menu-groups';
import { menuPages } from '../lib/domain/features/pages';

/**
 * Le menu du tableau de bord « Aujourd'hui »
 * (docs/aujourdhui-tableau-de-bord-contract.md, section 3.1, précision T1) :
 * « Aujourd'hui » détaché, les pages en trois groupes, Réglages à part.
 */

const ALL: FeatureId[] = [...FEATURE_IDS];

test('T1 : « Aujourd’hui » détaché, Arroser, Équiper, Surveiller, Réglages à part, dans l’ordre du menu', () => {
  const menu = menuPages(ALL);
  const layout = menuLayout(menu);
  assert.equal(layout.today, true);
  assert.equal(layout.settings, true);
  assert.deepEqual(layout.groups, [
    { title: 'Arroser', pages: ['arrosages', 'planning', 'besoins', 'sol', 'cultures'] },
    { title: 'Équiper', pages: ['materiel', 'ressources'] },
    { title: 'Surveiller', pages: ['alertes-meteo', 'alertes-cultures', 'historique'] },
  ]);
  // Les groupes ne changent pas l'ordre des pages : celui de la liste des cases (P36).
  assert.deepEqual(['aujourdhui', ...layout.groups.flatMap((group) => group.pages), 'reglages'], menu);
});

test('chaque page d’une case est dans un groupe, une seule fois', () => {
  const grouped = menuLayout(menuPages(ALL)).groups.flatMap((group) => group.pages);
  assert.deepEqual([...grouped].sort(), [...PAGE_FEATURE_IDS].sort());
  assert.equal(new Set(grouped).size, grouped.length);
});

test('un groupe sans page cochée disparaît ; sans « Aujourd’hui », pas d’encart', () => {
  const layout = menuLayout(menuPages(['materiel', 'calculateur']));
  assert.equal(layout.today, false);
  assert.deepEqual(layout.groups, [{ title: 'Équiper', pages: ['materiel'] }]);
  assert.equal(layout.settings, true);
  const weather = menuLayout(menuPages(['alertes-meteo', 'materiel']));
  assert.equal(weather.today, true);
  assert.deepEqual(weather.groups.map((group) => group.title), ['Équiper', 'Surveiller']);
});
