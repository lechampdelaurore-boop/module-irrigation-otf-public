import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { FEATURE_IDS, type FeatureId } from '../lib/domain/features/catalogue';
import { FARM_CARD_LINES, farmCards } from '../lib/domain/features/farm-cards';
import { pageHelp } from '../lib/domain/features/help';
import { menuPlaces } from '../lib/domain/features/desktop-menu';
import {
  hasTodayPage,
  IRRIGATION_PAGE_IDS,
  isIrrigationPageId,
  landingPage,
  legacyRedirect,
  menuPages,
  pageAccess,
  pageEnabled,
  pageFromPathname,
  pageHref,
  pageLabel,
  pageUsesSeason,
  type IrrigationPageId,
} from '../lib/domain/features/pages';
import {
  enabledPlacePages,
  FARM_CARD_PAGES,
  farmCardPages,
  farmPlaces,
  PLACE_IDS,
  placeEntry,
  placeLabel,
  placeOfPage,
  placePages,
  type PlaceId,
} from '../lib/domain/features/places';
import { isCompleteSelection } from '../lib/domain/features/selection';
import type { UnfinishedStep } from '../lib/domain/onboarding/steps';
import { TECHNICAL_WORDS } from '../lib/domain/simple-words';

/**
 * Simplifier l'usage du module, lot S3, PR 1 : le rangement et « Ma ferme »
 * (docs/simplification-s3-contract.md, sections 3 et 5 ; D-331). La
 * correspondance page → endroit vit dans `lib/domain/features/places.ts`, la
 * page « Ma ferme » en fiches dans `lib/domain/features/farm-cards.ts`. Les
 * mesures (cible de 68 px, lignes à 390 px) se font dans le navigateur (P63).
 */

/** Chaque choix de cases que la fermeture des dépendances accepte, parmi les 2 048 parties des onze cases. */
function validSelections(): FeatureId[][] {
  const selections: FeatureId[][] = [];
  for (let mask = 1; mask < 2 ** FEATURE_IDS.length; mask += 1) {
    const selection = FEATURE_IDS.filter((_, index) => (mask >> index) & 1);
    if (isCompleteSelection(selection)) selections.push(selection);
  }
  return selections;
}

const SELECTIONS = validSelections();
const WEEK_PAGES: readonly IrrigationPageId[] = ['planning', 'besoins', 'historique'];

test('section 3.1 : chaque page du module est dans un endroit, et un seul', () => {
  for (const page of IRRIGATION_PAGE_IDS) {
    const places = PLACE_IDS.filter((place) => placePages(place).includes(page));
    assert.equal(places.length, 1, `${page} : ${places.length} endroit(s)`);
    assert.equal(placeOfPage(page), places[0]);
  }
  // Aucun endroit ne range une page qui n'existe pas, ni deux fois la même.
  const ranged = PLACE_IDS.flatMap((place) => placePages(place));
  assert.equal(new Set(ranged).size, ranged.length);
  assert.deepEqual([...ranged].sort(), [...IRRIGATION_PAGE_IDS].sort());
});

test('section 3.1 : le tableau du contrat, page par page', () => {
  const expected: Record<IrrigationPageId, PlaceId> = {
    aujourdhui: 'aujourdhui',
    arrosages: 'aujourdhui',
    planning: 'semaine',
    besoins: 'semaine',
    historique: 'semaine',
    materiel: 'ma-ferme',
    ressources: 'ma-ferme',
    cultures: 'ma-ferme',
    sol: 'ma-ferme',
    'alertes-meteo': 'ma-ferme',
    'alertes-cultures': 'ma-ferme',
    reglages: 'ma-ferme',
    'ma-ferme': 'ma-ferme',
    // Depuis le lot S4, la page « Semaine » est l'entrée de son endroit (docs/simplification-s4-contract.md, section 3).
    semaine: 'semaine',
  };
  for (const page of IRRIGATION_PAGE_IDS) assert.equal(placeOfPage(page), expected[page], page);
  assert.deepEqual(PLACE_IDS.map(placeLabel), ['Aujourd’hui', 'Semaine', 'Ma ferme']);
  // L'ordre des fiches de la maquette.
  assert.deepEqual(placePages('ma-ferme'), ['ma-ferme', 'materiel', 'ressources', 'cultures', 'sol', 'alertes-meteo', 'alertes-cultures', 'reglages']);
  assert.deepEqual(placePages('semaine'), ['semaine', 'planning', 'besoins', 'historique']);
  assert.deepEqual(placePages('aujourdhui'), ['aujourdhui', 'arrosages']);
});

test('section 3.2 : pour chaque choix de cases valide, les endroits, leur entrée et les fiches de « Ma ferme »', () => {
  // 2 048 parties, dont celles que la fermeture des dépendances accepte (au moins une case cochée).
  assert.equal(SELECTIONS.length, 235);
  for (const selection of SELECTIONS) {
    const label = selection.join(', ');
    const week = WEEK_PAGES.filter((page) => selection.includes(page as FeatureId));
    // « Aujourd'hui » existe quand l'une des huit cases de F1 est cochée ; « Semaine », quand l'une des
    // trois pages de la semaine l'est ; « Ma ferme », toujours.
    const places: PlaceId[] = [...(hasTodayPage(selection) ? ['aujourdhui' as const] : []), ...(week.length > 0 ? ['semaine' as const] : []), 'ma-ferme'];
    assert.deepEqual(farmPlaces(selection), places, label);
    assert.equal(placeEntry('aujourdhui', selection), hasTodayPage(selection) ? 'aujourdhui' : null, label);
    // Depuis le lot S4, l'endroit s'ouvre sur la page « Semaine », qui porte les pages de ses cases.
    assert.equal(placeEntry('semaine', selection), week.length > 0 ? 'semaine' : null, label);
    assert.equal(placeEntry('ma-ferme', selection), 'ma-ferme', label);
    assert.deepEqual(enabledPlacePages('semaine', selection), week.length > 0 ? ['semaine', ...week] : [], label);
    // Les fiches : les cases cochées de l'endroit, dans l'ordre de la maquette, Réglages toujours.
    assert.deepEqual(farmCardPages(selection), FARM_CARD_PAGES.filter((page) => page === 'reglages' || selection.includes(page)), label);
    // Une case décochée retire sa page : les endroits rangent exactement les pages du menu.
    const ranged = farmPlaces(selection).flatMap((place) => enabledPlacePages(place, selection));
    assert.deepEqual([...ranged].sort(), [...menuPages(selection)].sort(), label);
    for (const page of IRRIGATION_PAGE_IDS) {
      assert.equal(pageEnabled(page, selection), pageAccess(page, false, selection).kind === 'open', `${label} : ${page}`);
    }
    // La page d'arrivée ne change pas (S3-j) : jamais « Ma ferme ».
    assert.notEqual(landingPage(selection), 'ma-ferme', label);
    assert.deepEqual(pageAccess('ma-ferme', false, selection), { kind: 'open' }, label);
    assert.deepEqual(pageAccess('ma-ferme', true, selection), { kind: 'welcome' }, label);
  }
});

test('section 8 : les états rares du rangement', () => {
  // Une ferme qui n'a coché que les alertes : « Ma ferme » seule, avec les alertes et Réglages… et « Aujourd'hui »,
  // qu'une alerte suffit à faire naître (F1).
  const alerts: FeatureId[] = ['alertes-meteo', 'alertes-cultures'];
  assert.deepEqual(farmPlaces(alerts), ['aujourdhui', 'ma-ferme']);
  assert.deepEqual(farmCardPages(alerts), ['alertes-meteo', 'alertes-cultures', 'reglages']);
  // Matériel et calculateur seuls : ni « Aujourd'hui » ni « Semaine ».
  assert.deepEqual(farmPlaces(['materiel', 'calculateur']), ['ma-ferme']);
  assert.deepEqual(farmCardPages(['materiel', 'calculateur']), ['materiel', 'reglages']);
  // L'historique seul (avec ce dont il a besoin) comme tout coché : la semaine s'ouvre sur sa page (lot S4).
  assert.equal(placeEntry('semaine', ['arrosages', 'materiel', 'historique']), 'semaine');
  assert.equal(placeEntry('semaine', [...FEATURE_IDS]), 'semaine');
  // Sans aucune des trois cases, pas d'endroit « Semaine ».
  assert.equal(placeEntry('semaine', ['arrosages', 'materiel']), null);
});

test('section 5 : « Ma ferme » a son adresse, son nom, sa saison ; aucune adresse d’avant ne change', () => {
  assert.ok(isIrrigationPageId('ma-ferme'));
  assert.equal(pageFromPathname('/irrigation/ma-ferme'), 'ma-ferme');
  assert.equal(pageFromPathname('/irrigation/ma-ferme/'), 'ma-ferme');
  assert.equal(pageLabel('ma-ferme'), 'Ma ferme');
  assert.equal(pageHref('ma-ferme', { season: 2026, zone: 'z-1' }), '/irrigation/ma-ferme?season=2026&zone=z-1');
  // La page montre la saison et la transmet à chaque fiche, quelles que soient les cases.
  for (const selection of SELECTIONS) assert.equal(pageUsesSeason('ma-ferme', selection), true, selection.join(', '));
  // Les adresses d'avant : chacune désigne toujours sa page ; les anciennes ancres ne mènent jamais à « Ma ferme ».
  for (const page of IRRIGATION_PAGE_IDS) assert.equal(pageFromPathname(`/irrigation/${page}`), page);
  for (const anchor of ['', '#weather', '#irrigation-eq-1', '#series-water-title', '#planning', '#planning-title', '#inconnue']) {
    for (const selection of SELECTIONS) assert.notEqual(legacyRedirect(anchor, selection).page, 'ma-ferme', `${anchor} : ${selection.join(', ')}`);
  }
});

test('S3-f : une ligne fixe par fiche, une seule phrase, sans mot du calcul', () => {
  assert.deepEqual(Object.keys(FARM_CARD_LINES).sort(), [...FARM_CARD_PAGES].sort());
  const calculation = [...TECHNICAL_WORDS, 'RFU', 'ET0', 'ETM', 'K_abri', 'coefficient', 'évapotranspiration'];
  for (const [page, line] of Object.entries(FARM_CARD_LINES)) {
    assert.match(line, /^[A-ZÀ-Ý]/u, `${page} : une majuscule`);
    assert.doesNotMatch(line, /[.;:!?\n]/u, `${page} : une seule phrase, sans point`);
    assert.doesNotMatch(line, /'/u, `${page} : apostrophe typographique`);
    // Deux lignes au plus à 390 px : la mesure est celle de P63 ; ici, une borne de longueur.
    assert.ok(line.length <= 60, `${page} : ${line.length} caractères`);
    for (const word of calculation) assert.ok(!line.toLocaleLowerCase('fr-FR').includes(word.toLocaleLowerCase('fr-FR')), `${page} : « ${word} »`);
  }
  // Les lignes du contrat, telles quelles, sauf « Alertes cultures », relue contre son « ? » (S3-f).
  assert.equal(FARM_CARD_LINES.materiel, 'Vos goutte-à-goutte et vos aspersions, et où ils sont posés');
  assert.equal(FARM_CARD_LINES.reglages, 'Météo, messages du téléphone, fonctionnalités');
  assert.equal(FARM_CARD_LINES['alertes-cultures'], 'Gel selon la culture, arrêt avant la récolte, aspersions');
  // Ce que dit le « ? » de « Alertes cultures » : les trois alertes de la ligne.
  const cropAlerts = pageHelp('alertes-cultures').purpose;
  for (const part of ['gel selon la culture', 'arrêt d’arrosage avant la récolte', 'aspersions']) assert.ok(cropAlerts.includes(part), part);
});

const SOIL: UnfinishedStep = { id: 'soil', text: 'sol de 3 parcelles', page: 'sol', anchor: 'sol-p-1', count: 3 };
const LOCATION: UnfinishedStep = { id: 'location', text: 'commune de la ferme', page: 'reglages', anchor: 'water-weather-title' };
const PLOTS: UnfinishedStep = { id: 'plots', text: '2 jardins à classer', page: 'reglages', anchor: 'parcelles-et-abris' };

test('S3-f : « À faire » vient de l’accueil de la ferme, avec le texte de l’étape, sur la fiche de sa page', () => {
  const all = [...FEATURE_IDS];
  const cards = farmCards(all, [SOIL, LOCATION, PLOTS]);
  assert.deepEqual(cards.map((card) => card.page), ['materiel', 'ressources', 'cultures', 'sol', 'alertes-meteo', 'alertes-cultures', 'reglages']);
  const todo = Object.fromEntries(cards.map((card) => [card.page, card.todo]));
  assert.equal(todo.sol, 'À faire : sol de 3 parcelles');
  assert.equal(todo.reglages, 'À faire : commune de la ferme, 2 jardins à classer');
  for (const page of ['materiel', 'ressources', 'cultures', 'alertes-meteo', 'alertes-cultures']) assert.equal(todo[page], null, page);
  // Une ferme réglée : aucune marque.
  assert.ok(farmCards(all, []).every((card) => card.todo === null));
  // Une étape dont la page n'est pas une fiche de la ferme ne marque rien.
  assert.deepEqual(farmCards(['alertes-meteo'], [SOIL]).map((card) => card.todo), [null, null]);
  for (const card of cards) assert.equal(card.line, FARM_CARD_LINES[card.page]);
});

test('section 5 : « Ma ferme » ne lit rien de plus que le gabarit de chaque page', () => {
  const page = readFileSync('app/irrigation/ma-ferme/page.tsx', 'utf8');
  assert.match(page, /loadPageContext\('ma-ferme', searchParams\)/);
  // Ni chargeur de page, ni service, ni base : la marque « À faire » vient de `context.shell.unfinished`.
  assert.doesNotMatch(page, /page-loaders|@\/lib\/services|@\/db\//);
  // Les lignes d'état des fiches viennent aussi du gabarit (lot S6, PR 3, section 7).
  assert.match(page, /farmCards\(context\.enabled, context\.shell\.unfinished, context\.farmCardLines\)/);
  assert.match(page, /pageMetadata\('ma-ferme'\)/);
});

test('section 5 : chaque fiche est un lien vers sa page, qui garde la saison et la parcelle, sur 68 px au moins', () => {
  const cards = readFileSync('app/irrigation/pages/ma-ferme-page.tsx', 'utf8');
  assert.match(cards, /<nav className="farm-cards" aria-label="Les fiches de Ma ferme">/);
  assert.match(cards, /href=\{pageHref\(card\.page, query\)\}/);
  assert.match(cards, /<Icon name=\{PAGE_ICONS\[card\.page\]\} \/>/);
  assert.match(cards, /<strong>\{pageLabel\(card\.page\)\}<\/strong>/);
  assert.match(cards, /<Icon name="chevron" \/>/);
  // Comme le menu : sans rechargement, le clavier porté sur le contenu de la page ouverte (D-322).
  assert.match(cards, /prefetch=\{false\} onClick=\{markMenuNavigation\}/);
  const css = readFileSync('app/irrigation/styles/ma-ferme.css', 'utf8');
  assert.match(css, /\.farm-card \{[^}]*min-height: 68px;/);
  assert.match(css, /\.farm-card-todo \{[^}]*color: var\(--warn-ink\);/);
  assert.match(readFileSync('app/irrigation/irrigation.css', 'utf8'), /@import '\.\/styles\/ma-ferme\.css';/);
});

test('« Ma ferme » est une page du menu, avant Réglages ; à l’ordinateur, le titre de son endroit (PR 3)', () => {
  const all = [...FEATURE_IDS];
  const menu = menuPages(all);
  assert.deepEqual(menu.slice(-2), ['ma-ferme', 'reglages']);
  // Le titre de l'endroit mène à « Ma ferme », ses fiches dessous, Réglages comprise (section 6).
  const farm = menuPlaces(menu, null).find((group) => group.place === 'ma-ferme');
  assert.equal(farm?.entry, 'ma-ferme');
  assert.deepEqual(farm?.pages, FARM_CARD_PAGES);
  assert.match(readFileSync('app/irrigation/shell/page-icons.ts', 'utf8'), /'ma-ferme': 'ferme',/);
});

test('son « ? » dit à quoi sert l’endroit, comment lire les fiches et par où commencer', () => {
  const help = pageHelp('ma-ferme');
  assert.match(help.purpose, /ce que le module sait de votre ferme/);
  assert.match(help.reading, /« À faire »/);
  assert.match(help.firstStep, /Matériel et placement/);
});
