import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { FEATURE_IDS, type FeatureId } from '../lib/domain/features/catalogue';
import { menuPlaces } from '../lib/domain/features/desktop-menu';
import { pageHelp } from '../lib/domain/features/help';
import {
  displayedPage,
  IRRIGATION_PAGE_IDS,
  isIrrigationPageId,
  legacyRedirect,
  menuPages,
  pageAccess,
  pageEnabled,
  pageFromPathname,
  pageHref,
  pageLabel,
  weekRedirectHref,
} from '../lib/domain/features/pages';
import { placeEntry, placeOfPage } from '../lib/domain/features/places';
import { isCompleteSelection } from '../lib/domain/features/selection';
import {
  resolveWeekView,
  SERIES_WATER_ANCHOR,
  WEEK_ANCHORS,
  WEEK_PAGE_FEATURES,
  WEEK_SECTIONS,
  weekAnchor,
  weekPageExists,
  weekSections,
  weekViewLabel,
  weekViewOfFeature,
  weekViews,
  weekViewSelector,
  type WeekPageFeature,
  type WeekSectionId,
  type WeekViewId,
} from '../lib/domain/features/week-page';
import { MEASURED_RAIN_ANCHOR } from '../lib/domain/today/reliability';
import { proposalAnchor } from '../lib/domain/today/today-irrigations';
import { needsGardenAnchor } from '../lib/domain/today/week';

/**
 * Simplifier l'usage du module, lot S4, PR 1 : une page, deux vues
 * (docs/simplification-s4-contract.md, sections 3, 7.4 et 9). La règle vit
 * dans `lib/domain/features/week-page.ts` ; la page dans
 * `app/irrigation/semaine/page.tsx` ; les anciennes adresses mènent à elle.
 * Les mesures (temps du serveur, hauteur) et le relevé des ancres à l'écran
 * se font dans le navigateur.
 */

function validSelections(): FeatureId[][] {
  const selections: FeatureId[][] = [];
  for (let mask = 1; mask < 2 ** FEATURE_IDS.length; mask += 1) {
    const selection = FEATURE_IDS.filter((_, index) => (mask >> index) & 1);
    if (isCompleteSelection(selection)) selections.push(selection);
  }
  return selections;
}

const SELECTIONS = validSelections();
const ALL: FeatureId[] = [...FEATURE_IDS];

/** Le tableau de la section 3.2 : pour les cases cochées parmi les trois, les vues, la vue ouverte et les sections de « La semaine ». */
const COMBINATIONS: readonly { week: readonly WeekPageFeature[]; views: WeekViewId[]; opens: WeekViewId | null; sections: WeekSectionId[] }[] = [
  { week: [], views: [], opens: null, sections: [] },
  { week: ['besoins'], views: ['semaine'], opens: 'semaine', sections: ['reste-a-arroser', 'eau-visee', 'pluie-mesuree', 'meteo', 'jours'] },
  { week: ['planning', 'besoins'], views: ['semaine'], opens: 'semaine', sections: ['reste-a-arroser', 'plan', 'eau-visee', 'pluie-mesuree', 'meteo', 'jours', 'ecart-du-prevu', 'reglages'] },
  { week: ['historique'], views: ['cumuls'], opens: 'cumuls', sections: [] },
  { week: ['besoins', 'historique'], views: ['semaine', 'cumuls'], opens: 'semaine', sections: ['reste-a-arroser', 'eau-visee', 'pluie-mesuree', 'meteo', 'jours'] },
  { week: ['planning', 'besoins', 'historique'], views: ['semaine', 'cumuls'], opens: 'semaine', sections: ['reste-a-arroser', 'plan', 'eau-visee', 'pluie-mesuree', 'meteo', 'jours', 'ecart-du-prevu', 'reglages'] },
];

function combinationOf(selection: readonly FeatureId[]) {
  const week = WEEK_PAGE_FEATURES.filter((feature) => selection.includes(feature));
  return COMBINATIONS.find((item) => item.week.length === week.length && item.week.every((feature) => week.includes(feature as WeekPageFeature)));
}

test('section 3.1 : la page « Semaine », son adresse, son nom ; ce n’est pas une case', () => {
  assert.ok(isIrrigationPageId('semaine'));
  assert.ok(IRRIGATION_PAGE_IDS.includes('semaine'));
  assert.equal((FEATURE_IDS as readonly string[]).includes('semaine'), false, 'pas une case de plus');
  assert.equal(pageFromPathname('/irrigation/semaine'), 'semaine');
  assert.equal(pageLabel('semaine'), 'Semaine');
  assert.equal(placeOfPage('semaine'), 'semaine');
  assert.equal(pageHref('semaine', { season: 2026, week: '2026-11-25', zone: 'z-1' }), '/irrigation/semaine?season=2026&zone=z-1&week=2026-11-25');
  // La seconde vue a son paramètre ; la première n'en a pas (S4-b).
  assert.equal(pageHref('semaine', { season: 2026, view: 'cumuls' }), '/irrigation/semaine?season=2026&vue=cumuls');
  assert.equal(pageHref('semaine', { season: 2026, view: 'semaine' }), '/irrigation/semaine?season=2026');
  assert.equal(pageHref('semaine', { view: 'cumuls' }, MEASURED_RAIN_ANCHOR), '/irrigation/semaine?vue=cumuls#manual-rain');
  // Son « ? » dit ce qu'elle réunit.
  const help = pageHelp('semaine');
  assert.match(help.purpose, /semaine/);
  assert.ok(help.reading.length > 0 && help.firstStep.length > 0);
});

test('section 3.2 : seules les six combinaisons du contrat existent, chacune avec ses vues, sa vue ouverte et ses sections', () => {
  assert.equal(SELECTIONS.length, 235);
  const seen = new Set<string>();
  for (const selection of SELECTIONS) {
    const label = selection.join(', ');
    const combination = combinationOf(selection);
    assert.ok(combination, `${label} : combinaison hors du tableau`);
    seen.add(combination.week.join('+'));
    // La page existe dès l'une des trois cases ; sans aucune, ni page, ni vue, ni section.
    assert.equal(weekPageExists(selection), combination.week.length > 0, label);
    assert.equal(pageEnabled('semaine', selection), combination.week.length > 0, label);
    assert.equal(menuPages(selection).includes('semaine'), combination.week.length > 0, label);
    assert.deepEqual(weekViews(selection), combination.views, label);
    assert.equal(resolveWeekView(undefined, selection), combination.opens, label);
    assert.deepEqual(weekSections(selection), combination.sections, label);
    // Le sélecteur de vue n'existe que quand les deux vues existent.
    assert.deepEqual(weekViewSelector(selection), combination.views.length === 2 ? ['semaine', 'cumuls'] : null, label);
    // L'endroit « Semaine » s'ouvre sur la page dès qu'elle existe ; l'accès suit l'existence.
    assert.equal(placeEntry('semaine', selection), combination.week.length > 0 ? 'semaine' : null, label);
    assert.equal(pageAccess('semaine', false, selection).kind, combination.week.length > 0 ? 'open' : 'not-enabled', label);
    assert.deepEqual(pageAccess('semaine', true, selection), { kind: 'welcome' }, label);
    // Le menu et la barre lisent les mêmes vues que la page (une règle, un endroit).
    const group = menuPlaces(menuPages(selection), null).find((item) => item.place === 'semaine');
    assert.deepEqual(group?.views ?? null, combination.week.length > 0 ? weekViewSelector(selection) ?? [] : null, label);
  }
  assert.equal(seen.size, COMBINATIONS.length, 'chaque ligne du tableau est atteinte');
});

test('section 3.2 : une case décochée retire ses sections, et rien d’autre', () => {
  for (const feature of WEEK_PAGE_FEATURES) {
    const own = WEEK_SECTIONS.filter((section) => section.feature === feature).map((section) => section.id);
    const without = weekSections(ALL.filter((id) => id !== feature));
    for (const section of own) assert.equal(without.includes(section), false, `${feature} : ${section}`);
    assert.deepEqual(without, weekSections(ALL).filter((section) => !own.includes(section)), feature);
  }
  // L'ordre de la section 7.1, chaque section une fois.
  assert.deepEqual(WEEK_SECTIONS.map((section) => section.id), ['reste-a-arroser', 'plan', 'eau-visee', 'pluie-mesuree', 'meteo', 'jours', 'ecart-du-prevu', 'reglages']);
  assert.equal(new Set(WEEK_SECTIONS.map((section) => section.id)).size, WEEK_SECTIONS.length);
});

test('section 3.2 : la vue qu’ouvre une adresse', () => {
  assert.equal(resolveWeekView('cumuls', ALL), 'cumuls');
  assert.equal(resolveWeekView('semaine', ALL), 'semaine', 'la première vue n’a pas de paramètre, une valeur inconnue l’ouvre');
  assert.equal(resolveWeekView('inconnue', ALL), 'semaine');
  assert.equal(resolveWeekView(['cumuls', 'cumuls'], ALL), 'semaine', 'un paramètre répété ne vaut rien');
  assert.equal(resolveWeekView(undefined, ALL), 'semaine');
  // Sans l'historique, `vue=cumuls` ouvre « La semaine » ; sans les besoins, l'historique seul ouvre « Les cumuls ».
  assert.equal(resolveWeekView('cumuls', ['materiel', 'arrosages', 'besoins']), 'semaine');
  assert.equal(resolveWeekView(undefined, ['materiel', 'arrosages', 'historique']), 'cumuls');
  assert.equal(resolveWeekView('cumuls', ['materiel', 'arrosages']), null, 'pas de page');
  assert.deepEqual(['semaine', 'cumuls'].map((view) => weekViewLabel(view as WeekViewId)), ['La semaine', 'Les cumuls']);
});

test('section 3.3 : chaque ancienne adresse mène à « Semaine », sur la vue qui portait son contenu, tous ses paramètres gardés', () => {
  const params = { season: '2026', week: '2026-11-25', zone: 'z-1', refresh: '1', recalculer: '1' };
  assert.equal(weekRedirectHref('planning', params), '/irrigation/semaine?season=2026&week=2026-11-25&zone=z-1&refresh=1&recalculer=1');
  assert.equal(weekRedirectHref('besoins', params), '/irrigation/semaine?season=2026&week=2026-11-25&zone=z-1&refresh=1&recalculer=1');
  assert.equal(weekRedirectHref('historique', params), '/irrigation/semaine?season=2026&week=2026-11-25&zone=z-1&refresh=1&recalculer=1&vue=cumuls');
  assert.equal(weekRedirectHref('besoins', {}), '/irrigation/semaine');
  assert.equal(weekRedirectHref('historique', {}), '/irrigation/semaine?vue=cumuls');
  // Une vue demandée à l'ancienne adresse ne l'emporte pas sur celle de la page ; un paramètre répété reste répété.
  assert.equal(weekRedirectHref('planning', { vue: 'cumuls' }), '/irrigation/semaine');
  assert.equal(weekRedirectHref('besoins', { zone: ['a', 'b'], absente: undefined }), '/irrigation/semaine?zone=a&zone=b');
  for (const feature of WEEK_PAGE_FEATURES) assert.equal(weekViewOfFeature(feature), feature === 'historique' ? 'cumuls' : 'semaine');
  // La visite guidée joue les étapes des trois pages sur « Semaine » ; les autres pages restent les leurs.
  for (const page of IRRIGATION_PAGE_IDS) assert.equal(displayedPage(page), (WEEK_PAGE_FEATURES as readonly string[]).includes(page) ? 'semaine' : page);
});

test('section 3.3 : les trois routes redirigent par le serveur, l’export CSV et la page ne changent pas d’adresse', () => {
  for (const feature of WEEK_PAGE_FEATURES) {
    const route = readFileSync(`app/irrigation/${feature}/page.tsx`, 'utf8');
    assert.match(route, new RegExp(`redirectToWeekPage\\('${feature}', searchParams\\)`), feature);
    assert.match(route, new RegExp(`pageMetadata\\('${feature}'\\)`), feature);
    // Plus rien n'y est lu ni montré : la page « Semaine » le fait.
    assert.doesNotMatch(route, /page-loaders|IrrigationShell|loadPageContext/, feature);
  }
  const context = readFileSync('app/irrigation/page-context.ts', 'utf8');
  const redirect = context.slice(context.indexOf('export async function redirectToWeekPage'));
  // La personne vérifiée, la ferme lue, puis l'accès d'avant : bienvenue, page non cochée et sa ligne (P14), ou « Semaine ».
  assert.match(redirect, /requireAuthenticatedUser\(\)/);
  assert.match(redirect, /pageAccess\(feature, selection\.firstVisit, selection\.enabled\)/);
  assert.match(redirect, /if \(access\.kind === 'welcome'\) redirect\(WELCOME_PATH\);/);
  assert.match(redirect, /absent: access\.requested/);
  assert.match(redirect, /redirect\(weekRedirectHref\(feature, params\)\);/);
  assert.match(readFileSync('app/irrigation/historique.csv/route.ts', 'utf8'), /export async function GET/);
  const page = readFileSync('app/irrigation/semaine/page.tsx', 'utf8');
  assert.match(page, /loadPageContext\('semaine', searchParams\)/);
  assert.match(page, /pageMetadata\('semaine'\)/);
  assert.match(page, /renderOncePerRequest\(computeSemainePage\)/);
});

test('section 3.4 : la vue « Les cumuls » ne lit que l’historique ; « La semaine » lit le planning et les besoins ensemble, selon les cases', () => {
  const loaders = readFileSync('app/irrigation/page-loaders.ts', 'utf8');
  const semaine = loaders.slice(loaders.indexOf('export async function loadSemainePage'));
  assert.match(semaine, /if \(context\.weekView === 'cumuls'\)/);
  assert.match(semaine, /Promise\.all\(\[/);
  assert.match(semaine, /context\.enabled\.includes\('planning'\) \? readPlanning\(context\) : null/);
  assert.match(semaine, /context\.enabled\.includes\('besoins'\) \? readBesoins\(context\) : null/);
  // Les anciennes pages ne lisent plus rien : il n'y a plus de chargeur par page.
  assert.doesNotMatch(loaders, /export async function load(Planning|Besoins|Historique)Page/);
});

test('section 9 : les anciennes ancres de `/irrigation` désignent « Semaine » quand la case qui portait leur contenu est cochée', () => {
  for (const selection of SELECTIONS) {
    const label = selection.join(', ');
    const weather = legacyRedirect('#weather', selection);
    if (selection.includes('besoins')) assert.deepEqual(weather, { page: 'semaine', notEnabled: false }, label);
    const series = legacyRedirect(`#${SERIES_WATER_ANCHOR}`, selection);
    if (selection.includes('historique')) assert.deepEqual(series, { page: 'semaine', view: 'cumuls', notEnabled: false }, label);
    for (const anchor of ['#planning', '#planning-title']) {
      const target = legacyRedirect(anchor, selection);
      if (selection.includes('planning')) assert.deepEqual(target, { page: 'semaine', notEnabled: false }, label);
      // Une case décochée garde la conduite d'avant : la page des alertes, ou la page d'arrivée et sa ligne.
      else assert.notEqual(target.page, 'semaine', label);
    }
    // Les ancres de « Semaine » visent toujours une page que la ferme a.
    for (const anchor of ['#weather', `#${SERIES_WATER_ANCHOR}`, '#planning', '#planning-title']) {
      const target = legacyRedirect(anchor, selection);
      assert.equal(pageEnabled(target.page, selection), true, `${anchor} : ${label}`);
    }
  }
});

/**
 * Où chaque ancre du relevé est posée dans le code de la page (section 7.4).
 * La page rend ces composants (`semaine/page.tsx`) ; le parcours vérifie
 * qu'elles existent à l'écran.
 */
const ANCHOR_SOURCES: Readonly<Record<string, { file: string; pattern: RegExp }>> = {
  'irrigation-needs-title': { file: 'app/irrigation/irrigation-needs-dashboard.tsx', pattern: /id="irrigation-needs-title"/ },
  'besoin-jardin-': { file: 'app/irrigation/irrigation-needs-dashboard.tsx', pattern: /id=\{needsGardenAnchor\(garden\.plotId\)\}/ },
  planning: { file: 'app/irrigation/planning/weekly-plan-view.tsx', pattern: /<section id="planning" className="planning-section"/ },
  'planning-title': { file: 'app/irrigation/planning/weekly-plan-view.tsx', pattern: /<h2 id="planning-title"/ },
  'proposal-': { file: 'app/irrigation/planning/proposal-card.tsx', pattern: /<article id=\{proposalAnchor\(proposal\.storedId\)\}/ },
  'objectifs-de-la-semaine': { file: 'app/irrigation/water-management-dashboard.tsx', pattern: /id="objectifs-de-la-semaine"/ },
  'manual-rain': { file: 'app/irrigation/water-management-dashboard.tsx', pattern: /id="manual-rain"/ },
  'meteo-de-reference': { file: 'app/irrigation/water-management-dashboard.tsx', pattern: /id="meteo-de-reference"/ },
  weather: { file: 'app/irrigation/water-management-dashboard.tsx', pattern: /id="weather"/ },
  'reglages-de-la-page': { file: 'app/irrigation/irrigation-needs-dashboard.tsx', pattern: /<PageSettingsFold>/ },
  'series-water-title': { file: 'app/irrigation/series-water-view.tsx', pattern: /<h2 id="series-water-title"/ },
};

test('section 7.4 : chaque ancre du relevé est posée dans le code de la page, par la case qui la porte', () => {
  assert.deepEqual(Object.keys(ANCHOR_SOURCES).sort(), WEEK_ANCHORS.map((entry) => entry.anchor).sort(), 'le relevé et ses sources disent les mêmes ancres');
  for (const entry of WEEK_ANCHORS) {
    const source = ANCHOR_SOURCES[entry.anchor];
    assert.ok(source, entry.anchor);
    assert.match(readFileSync(source.file, 'utf8'), source.pattern, `${entry.anchor} : ${source.file}`);
  }
  // Les composants qui les posent sont ceux que la page rend, selon la case.
  const page = readFileSync('app/irrigation/semaine/page.tsx', 'utf8');
  for (const component of ['PlanningPage', 'WaterManagementDashboard', 'IrrigationNeedsDashboardView', 'HistoryViews']) assert.match(page, new RegExp(`<${component} `), component);
  assert.match(readFileSync('app/irrigation/shell/page-settings-fold.tsx', 'utf8'), /export const PAGE_SETTINGS_ANCHOR = 'reglages-de-la-page';/);
  // Les ancres des fonctions du domaine.
  assert.equal(weekAnchor(MEASURED_RAIN_ANCHOR)?.feature, 'besoins');
  assert.equal(weekAnchor(needsGardenAnchor('jardin-1'))?.anchor, 'besoin-jardin-');
  assert.equal(weekAnchor(`#${proposalAnchor('p-1')}`)?.anchor, 'proposal-');
  assert.equal(weekAnchor('proposal-'), null, 'un préfixe seul n’est pas une ancre');
  assert.equal(weekAnchor('#planning')?.feature, 'planning');
  assert.equal(weekAnchor('#repartition'), null, 'une ancre de « Ressources »');
  // Le suivi par série ouvre sa lecture sur son ancre : sans cela, son titre n'existe pas avant le clic sur « Par série ».
  const views = readFileSync('app/irrigation/history-views.tsx', 'utf8');
  assert.match(views, /if \(decodeURIComponent\(window\.location\.hash\.slice\(1\)\) === SERIES_WATER_ANCHOR\) setView\('series'\);/);
  assert.match(views, /window\.addEventListener\('hashchange', openTargetedView\);/);
});

/** Les ancres qu'un lien du code, d'un test ou d'un parcours vise sur l'une des trois anciennes pages ou sur « Semaine ». */
function citedAnchors(): Map<string, string> {
  const cited = new Map<string, string>();
  const files = [
    'lib/domain/today/week.ts',
    'lib/domain/today/reliability.ts',
    'lib/domain/today/essential.ts',
    'lib/domain/today/missing-by-bed.ts',
    'lib/domain/today/ahead.ts',
    'lib/domain/today/today-irrigations.ts',
    'app/irrigation/today/today-page.tsx',
    'app/irrigation/today/today-gauges.tsx',
    'app/irrigation/semaine/page.tsx',
    'tests/aujourdhui-liens.test.ts',
    'tests/feature-selection.test.ts',
    'e2e/p13-alertes-meteo.spec.ts',
    'e2e/p40-pages-courtes.spec.ts',
  ];
  const sources = files.map((file) => [file, readFileSync(file, 'utf8')] as const);
  // Les constantes d'ancre, par leur nom (`WEEK_DAYS_ANCHOR`, `MEASURED_RAIN_ANCHOR`…).
  const constants = new Map(sources.flatMap(([, source]) => [...source.matchAll(/const ([A-Z_]+ANCHOR) = '([a-z0-9-]+)';/g)].map((match) => [match[1] ?? '', match[2] ?? ''] as const)));
  const value = (token: string) => (token.startsWith("'") ? token.slice(1, -1) : constants.get(token) ?? `constante inconnue ${token}`);
  for (const [file, source] of sources) {
    // Un lien du domaine : `page: 'besoins', anchor: MEASURED_RAIN_ANCHOR`, ou l'aide `besoins(label, WEEK_DAYS_ANCHOR)` de `week.ts`.
    for (const match of source.matchAll(/page: '(?:planning|besoins|historique|semaine)', anchor: ([A-Z_]+|'[a-z0-9-]+')/g)) cited.set(value(match[1] ?? ''), file);
    for (const match of source.matchAll(/\bbesoins\([^,]+, ([A-Z_]+ANCHOR)\)/g)) cited.set(value(match[1] ?? ''), file);
    // Une adresse écrite en entier, dans un test ou un parcours ; un `pageHref` à ancre littérale.
    for (const match of source.matchAll(/irrigation\/(?:planning|besoins|historique|semaine)[^#'"`\s]*#([a-z0-9-]+)/g)) cited.set(match[1] ?? '', file);
    for (const match of source.matchAll(/pageHref\('(?:planning|besoins|historique|semaine)', [^)]*?, '([a-z0-9-]+)'\)/g)) cited.set(match[1] ?? '', file);
  }
  return cited;
}

test('section 7.4 : le relevé est complet, toute ancre citée par un lien, un test ou un parcours y est', () => {
  const cited = citedAnchors();
  // Au moins les ancres que le contrat nomme (section 7.4) : le relevé lit vraiment les liens.
  for (const anchor of ['weather', 'manual-rain', 'objectifs-de-la-semaine', 'meteo-de-reference', 'irrigation-needs-title', 'besoin-jardin-g2']) assert.ok(cited.has(anchor), anchor);
  for (const [anchor, file] of cited) assert.ok(weekAnchor(anchor), `${anchor}, cité par ${file}, manque au relevé`);
  // Les fonctions d'ancre du domaine.
  for (const anchor of [MEASURED_RAIN_ANCHOR, needsGardenAnchor('g2'), proposalAnchor('p-1')]) assert.ok(weekAnchor(anchor), anchor);
});

test('contre-épreuve : une ancre qui manque, une case qui n’a pas sa section, une redirection qui perd un paramètre, chacune se voit', () => {
  // Une ancre retirée du code : le relevé ne la trouve plus.
  const water = readFileSync('app/irrigation/water-management-dashboard.tsx', 'utf8').replace('id="manual-rain"', 'id="pluie"');
  assert.doesNotMatch(water, ANCHOR_SOURCES['manual-rain']?.pattern ?? /$^/);
  // Une ancre citée qui n'est pas au relevé.
  assert.equal(weekAnchor('pluie-mesuree-du-jour'), null);
  // Une section montrée sans sa case.
  assert.equal(weekSections(['materiel', 'arrosages', 'besoins']).includes('plan'), false);
  assert.equal(weekSections(['materiel', 'arrosages', 'historique']).length, 0);
  // Une redirection qui perdrait la saison ou la semaine.
  assert.match(weekRedirectHref('besoins', { season: '2025', week: '2025-06-02' }), /season=2025&week=2025-06-02/);
  // Le sélecteur montré pour une seule vue.
  assert.equal(weekViewSelector(['materiel', 'arrosages', 'besoins', 'planning']), null);
});
