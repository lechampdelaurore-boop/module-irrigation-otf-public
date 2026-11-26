import assert from 'node:assert/strict';
import test from 'node:test';
import { FEATURE_IDS, PAGE_FEATURE_IDS, type FeatureId } from '../lib/domain/features/catalogue';
import { menuPlaces } from '../lib/domain/features/desktop-menu';
import { menuPages } from '../lib/domain/features/pages';

/**
 * Le menu du tableau de bord « Aujourd'hui »
 * (docs/aujourdhui-tableau-de-bord-contract.md, section 3.1, précision T1),
 * tel que la simplification, lot S3, PR 3, le range
 * (docs/simplification-s3-contract.md, section 6) : « Aujourd'hui » dans son
 * encart, en tête des trois endroits ; Réglages dans « Ma ferme ».
 */

const ALL: FeatureId[] = [...FEATURE_IDS];

test('T1 devenu S3 : « Aujourd’hui » en tête dans son encart, puis Semaine et Ma ferme, Réglages dans Ma ferme', () => {
  const places = menuPlaces(menuPages(ALL), null);
  assert.deepEqual(places.map((group) => [group.place, group.entry, group.pages]), [
    ['aujourdhui', 'aujourdhui', ['arrosages']],
    ['semaine', 'planning', ['planning', 'besoins', 'historique']],
    ['ma-ferme', 'ma-ferme', ['materiel', 'ressources', 'cultures', 'sol', 'alertes-meteo', 'alertes-cultures', 'reglages']],
  ]);
});

test('chaque page d’une case est dans un endroit, une seule fois', () => {
  const listed = menuPlaces(menuPages(ALL), null).flatMap((group) => group.pages);
  const pages = listed.filter((page) => (PAGE_FEATURE_IDS as readonly string[]).includes(page));
  assert.deepEqual([...pages].sort(), [...PAGE_FEATURE_IDS].sort());
  assert.equal(new Set(listed).size, listed.length);
});

test('un endroit sans page cochée disparaît ; sans « Aujourd’hui », pas d’encart', () => {
  const equipment = menuPlaces(menuPages(['materiel', 'calculateur']), null);
  assert.deepEqual(equipment.map((group) => [group.place, group.entry, group.pages]), [['ma-ferme', 'ma-ferme', ['materiel', 'reglages']]]);
  const weather = menuPlaces(menuPages(['alertes-meteo', 'materiel']), null);
  // « Aujourd'hui » sans « Arrosages » : l'encart seul.
  assert.deepEqual(weather.map((group) => [group.place, group.pages.length]), [['aujourdhui', 0], ['ma-ferme', 3]]);
});
