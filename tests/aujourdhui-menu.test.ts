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
 * encart, en tête des trois endroits ; Réglages dans « Ma ferme ». Depuis le
 * lot S4 (docs/simplification-s4-contract.md, S4-m), « Semaine » est une page :
 * son titre y mène, ses deux vues la suivent.
 */

const ALL: FeatureId[] = [...FEATURE_IDS];

test('T1 devenu S3 : « Aujourd’hui » en tête dans son encart, puis Semaine et Ma ferme, Réglages dans Ma ferme', () => {
  const places = menuPlaces(menuPages(ALL), null);
  assert.deepEqual(places.map((group) => [group.place, group.entry, group.pages, group.views]), [
    ['aujourdhui', 'aujourdhui', ['arrosages'], []],
    ['semaine', 'semaine', [], ['semaine', 'cumuls']],
    ['ma-ferme', 'ma-ferme', ['materiel', 'ressources', 'cultures', 'sol', 'alertes-meteo', 'alertes-cultures', 'reglages'], []],
  ]);
});

test('chaque page d’une case est dans un endroit, une seule fois ; le planning, les besoins et l’historique, par les vues de « Semaine »', () => {
  const places = menuPlaces(menuPages(ALL), null);
  const listed = places.flatMap((group) => group.pages);
  const pages = listed.filter((page) => (PAGE_FEATURE_IDS as readonly string[]).includes(page));
  const week = ['planning', 'besoins', 'historique'];
  assert.deepEqual([...pages].sort(), PAGE_FEATURE_IDS.filter((page) => !week.includes(page)).sort());
  assert.equal(new Set(listed).size, listed.length);
  assert.deepEqual(places.find((group) => group.place === 'semaine')?.views, ['semaine', 'cumuls']);
});

test('un endroit sans page cochée disparaît ; sans « Aujourd’hui », pas d’encart', () => {
  const equipment = menuPlaces(menuPages(['materiel', 'calculateur']), null);
  assert.deepEqual(equipment.map((group) => [group.place, group.entry, group.pages]), [['ma-ferme', 'ma-ferme', ['materiel', 'reglages']]]);
  const weather = menuPlaces(menuPages(['alertes-meteo', 'materiel']), null);
  // « Aujourd'hui » sans « Arrosages » : l'encart seul.
  assert.deepEqual(weather.map((group) => [group.place, group.pages.length]), [['aujourdhui', 0], ['ma-ferme', 3]]);
});
