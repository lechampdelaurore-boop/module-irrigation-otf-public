import assert from 'node:assert/strict';
import test from 'node:test';
import { compareNamesNaturally, sortByNameNaturally } from '../lib/domain/bed-order';
import type { Bed, Plot, Zone } from '../lib/domain/domain';
import { FEATURE_IDS } from '../lib/domain/features/catalogue';
import {
  NOT_FOUND_LABEL,
  menuPages,
  notFoundReturnLink,
  pageDocumentTitle,
  pageLabel,
  pageUsesSeason,
  type IrrigationPageId,
} from '../lib/domain/features/pages';
import { withRequirements } from '../lib/domain/features/selection';
import { countGoalScopeMatches, filterGoalScopeChoices, goalScopeChoiceGroups } from '../lib/domain/goal-scope-choices';
import {
  DEFAULT_HISTORY_STATUS_FILTER,
  countHistoryStatuses,
  historyEmptyText,
  historyExportLabel,
  historyListCountText,
  isHistoryStatusFilter,
  matchesHistoryStatusFilter,
} from '../lib/domain/irrigation-history/status-filter';
import { matchesSearch } from '../lib/domain/name-search';

/**
 * Le lot 1 de l'audit ergonomique du 7 novembre 2026 (3.8 quater, D-069) :
 * titres de pages et page introuvable (point 7), tri naturel et recherche dans
 * les listes (point 4), saison et commune là où elles servent (point 9),
 * historique ouvert sur les irrigations réalisées (point 11).
 */

const ALL = [...FEATURE_IDS];

// Point 7 — titres de pages et page introuvable.

test('point 7 : chaque page donne son nom à l’onglet, suivi du module', () => {
  assert.equal(pageDocumentTitle(pageLabel('planning')), 'Planning de la semaine · Irrigation');
  assert.equal(pageDocumentTitle(pageLabel('reglages')), 'Réglages · Irrigation');
  assert.equal(pageDocumentTitle(NOT_FOUND_LABEL), 'Page introuvable · Irrigation');
  const titles = menuPages(ALL).map((page) => pageDocumentTitle(pageLabel(page)));
  assert.equal(new Set(titles).size, titles.length, 'deux pages n’ont jamais le même titre');
});

test('point 7 : la page introuvable ramène à la page d’arrivée, au choix des cases, ou à l’entrée du module', () => {
  // « Aujourd'hui » quand elle existe (lot 2, F1).
  assert.deepEqual(notFoundReturnLink({ firstVisit: false, enabled: ALL }), { href: '/irrigation/aujourdhui', label: 'Revenir à « Aujourd’hui »' });
  // Une ferme qui n'a coché que le calculateur n'est pas renvoyée vers une page qu'elle n'a pas.
  assert.deepEqual(notFoundReturnLink({ firstVisit: false, enabled: withRequirements(['calculateur']) }), { href: '/irrigation/materiel', label: 'Revenir à « Matériel et placement »' });
  assert.deepEqual(notFoundReturnLink({ firstVisit: false, enabled: [] }), { href: '/irrigation/reglages', label: 'Revenir à « Réglages »' });
  assert.deepEqual(notFoundReturnLink({ firstVisit: true, enabled: [] }), { href: '/irrigation/bienvenue', label: 'Choisir vos fonctionnalités' });
  assert.deepEqual(notFoundReturnLink(null), { href: '/irrigation', label: 'Revenir au module d’irrigation' });
});

// Point 4 — tri naturel et recherche.

test('point 4 : les noms se rangent dans l’ordre naturel, la planche zéro en premier', () => {
  const sort = (names: string[]) => [...names].sort(compareNamesNaturally);
  assert.deepEqual(sort(['B9-10', 'B9-9', 'B1-0', 'B10-1', 'B1-1']), ['B1-0', 'B1-1', 'B9-9', 'B9-10', 'B10-1']);
  assert.deepEqual(sort(['BF-1', 'BF-5', 'BF-4', 'BF-3', 'BF-2', 'BF-0']), ['BF-0', 'BF-1', 'BF-2', 'BF-3', 'BF-4', 'BF-5']);
  assert.deepEqual(sort(['rampe bloc 2', 'rampe bloc 10', 'rampe bloc 1', 'Rampe BF']), ['Rampe BF', 'rampe bloc 1', 'rampe bloc 2', 'rampe bloc 10']);
  assert.deepEqual(sort(['gag10', 'gag9', 'gag2']), ['gag2', 'gag9', 'gag10']);
  // Deux noms égaux, majuscules ou accents près, se départagent par l'identifiant.
  const items = [{ id: 'b', name: 'Serre' }, { id: 'a', name: 'serre' }, { id: 'c', name: 'Abri' }];
  assert.deepEqual(sortByNameNaturally(items, (item) => item.name, (item) => item.id).map((item) => item.id), ['c', 'a', 'b']);
});

test('point 4 : la recherche ignore majuscules et accents, et chaque mot tapé doit se trouver', () => {
  assert.ok(matchesSearch('Planche · B9-3 Clémentière bloc 9', 'b9'));
  assert.ok(matchesSearch('Planche · B9-3 Clémentière bloc 9', 'CLEM b9'));
  assert.ok(!matchesSearch('Planche · B1-3 Clémentière bloc 1', 'b9'));
  assert.ok(matchesSearch('Parcelle Clémentière', '   '), 'une recherche vide garde tout');
});

const season = 2026;
const zone = (id: string, name: string): Zone => ({ id, name, area: null, seasons: [season] });
const plot = (id: string, zoneId: string, name: string): Plot => ({ id, zoneId, name, mode: 'garden', length: 10, width: 10, area: 100, seasons: [season] });
const bed = (id: string, plotId: string, zoneId: string, name: string, seasons = [season]): Bed => ({ id, zoneId, plotId, name, length: 10, width: 1, alleyWidth: 0.5, area: 10, seasons });

const farm = {
  zones: [zone('z1', 'Clémentière'), zone('z2', 'Verger')],
  plots: [plot('p10', 'z1', 'bloc 10'), plot('p9', 'z1', 'bloc 9'), plot('pv', 'z2', 'Tunnel 1')],
  beds: [
    bed('b910', 'p9', 'z1', 'B9-10'),
    bed('b99', 'p9', 'z1', 'B9-9'),
    bed('b90', 'p9', 'z1', 'B9-0'),
    bed('old', 'p9', 'z1', 'B9-11', [2025]),
    bed('b101', 'p10', 'z1', 'B10-1'),
    bed('t1', 'pv', 'z2', 'T1-2'),
  ],
};

test('point 4 : le périmètre d’un objectif se range par jardin, dans l’ordre naturel, avec les valeurs d’avant', () => {
  const groups = goalScopeChoiceGroups(farm, season);
  assert.deepEqual(groups.map((group) => group.label), ['Ferme et parcelles', 'bloc 9 · Clémentière', 'bloc 10 · Clémentière', 'Tunnel 1 · Verger']);
  assert.deepEqual(groups[0].choices.map((choice) => [choice.value, choice.label]), [
    ['farm', 'Toute la ferme'],
    ['zone:z1', 'Parcelle · Clémentière'],
    ['zone:z2', 'Parcelle · Verger'],
  ]);
  assert.deepEqual(groups[1].choices.map((choice) => [choice.value, choice.label]), [
    ['plot:z1:p9', 'Jardin / abri · bloc 9'],
    ['bed:z1:p9:b90', 'Planche · B9-0'],
    ['bed:z1:p9:b99', 'Planche · B9-9'],
    ['bed:z1:p9:b910', 'Planche · B9-10'],
  ], 'une planche hors de la saison n’est pas proposée');
  // Une seule parcelle : le groupe porte le nom du jardin seul.
  const single = goalScopeChoiceGroups({ ...farm, zones: [farm.zones[0]] }, season);
  assert.deepEqual(single.map((group) => group.label), ['Ferme et parcelles', 'bloc 9', 'bloc 10']);
});

test('point 4 : la recherche réduit la liste, garde le choix en cours et dit combien elle trouve', () => {
  const groups = goalScopeChoiceGroups(farm, season);
  const found = filterGoalScopeChoices(groups, 'b9', 'farm');
  assert.deepEqual(found.map((group) => [group.label, group.choices.map((choice) => choice.value)]), [
    ['Ferme et parcelles', ['farm']],
    ['bloc 9 · Clémentière', ['bed:z1:p9:b90', 'bed:z1:p9:b99', 'bed:z1:p9:b910']],
  ]);
  assert.equal(countGoalScopeMatches(groups, 'b9'), 3, 'le choix en cours, gardé pour l’affichage, n’est pas compté');
  assert.deepEqual(filterGoalScopeChoices(groups, 'tunnel', 'zone:z1').flatMap((group) => group.choices.map((choice) => choice.value)), ['zone:z1', 'plot:z2:pv', 'bed:z2:pv:t1']);
  assert.equal(countGoalScopeMatches(groups, 'introuvable'), 0);
  assert.deepEqual(filterGoalScopeChoices(groups, '', 'farm'), groups, 'sans recherche, tout reste');
});

// Point 9 — la saison là où elle sert.

test('point 9 : la saison n’est pas proposée là où elle ne change rien', () => {
  const pages: IrrigationPageId[] = menuPages(ALL);
  const without = pages.filter((page) => !pageUsesSeason(page, ALL));
  assert.deepEqual(without, ['aujourdhui', 'alertes-meteo'], 'avec toutes les cases, Réglages garde la saison pour la correspondance des espèces ; « Aujourd’hui » montre le jour du jour (lot 2, F2)');
  // Sans « Besoin par culture » ni « Alertes cultures », Réglages ne montre rien qui dépende de la saison.
  assert.equal(pageUsesSeason('reglages', withRequirements(['arrosages', 'alertes-meteo'])), false);
  assert.equal(pageUsesSeason('reglages', withRequirements(['alertes-cultures'])), true);
});

// Point 11 — l'historique ouvert sur les irrigations réalisées.

test('point 11 : réalisées par défaut, planifiées en option, toutes comme avant', () => {
  assert.equal(DEFAULT_HISTORY_STATUS_FILTER, 'done');
  assert.ok(matchesHistoryStatusFilter('completed', 'done'));
  assert.ok(matchesHistoryStatusFilter('partially_completed', 'done'), 'une irrigation arrêtée en cours a réellement apporté de l’eau');
  assert.ok(!matchesHistoryStatusFilter('planned', 'done'));
  assert.ok(!matchesHistoryStatusFilter('canceled', 'done'));
  assert.ok(matchesHistoryStatusFilter('planned', 'planned'));
  assert.ok(!matchesHistoryStatusFilter('completed', 'planned'));
  assert.ok(['planned', 'completed', 'partially_completed', 'canceled'].every((status) => matchesHistoryStatusFilter(status as 'planned', 'all')));
  assert.deepEqual(countHistoryStatuses(['planned', 'completed', 'canceled', 'partially_completed', 'planned']), { done: 2, planned: 2, all: 5 });
  assert.ok(isHistoryStatusFilter('planned'));
  assert.ok(!isHistoryStatusFilter('canceled'));
});

test('point 11 : la liste, la liste vide et le bouton d’export disent ce qu’ils montrent', () => {
  assert.equal(historyListCountText(3, 'done'), '3 irrigations réalisées dans la sélection.');
  assert.equal(historyListCountText(1, 'planned'), '1 irrigation planifiée dans la sélection.');
  assert.equal(historyListCountText(28, 'all'), '28 irrigations dans la sélection.');
  assert.equal(
    historyEmptyText('done', { done: 0, planned: 28, all: 28 }),
    'Aucune irrigation réalisée dans cette période et ce périmètre. 28 irrigations sont planifiées : voir « Planifiées ». Les cumuls météo et l’objectif restent disponibles ci-dessus.',
  );
  assert.equal(historyEmptyText('planned', { done: 2, planned: 0, all: 2 }), 'Aucune irrigation planifiée dans cette période et ce périmètre. Les cumuls météo et l’objectif restent disponibles ci-dessus.');
  assert.equal(historyExportLabel('done', 'du 02/11/2026 au 08/11/2026'), 'Exporter CSV · réalisées, du 02/11/2026 au 08/11/2026');
  assert.equal(historyExportLabel('all', 'saison 2026'), 'Exporter CSV · toutes, saison 2026');
});
