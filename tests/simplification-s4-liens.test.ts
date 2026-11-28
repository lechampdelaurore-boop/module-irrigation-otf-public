import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { tourById } from '../lib/domain/demo/tours';
import { stepPage } from '../lib/domain/demo/tour-engine';
import { pageHref, weekRedirectHref } from '../lib/domain/features/pages';
import { PAGE_HELP } from '../lib/domain/features/help';
import { NEEDS_SECTION_ANCHOR, PLAN_SECTION_ANCHOR, WEEK_RAIN_INTENT } from '../lib/domain/features/week-page';
import { settingsGroupsFor } from '../lib/domain/onboarding/settings-review';
import { SEE_THE_WEEK } from '../lib/domain/today/essential';
import { irrigationPage } from '../lib/domain/today/today-irrigations';

/**
 * Simplifier l'usage du module, lot S4, PR 4 : les liens, la visite, les
 * contrats (docs/simplification-s4-contract.md, sections 2, 9 et 10). Tout
 * ce qui menait aux trois anciennes pages, le planning, les besoins et
 * l'historique, mène à « Semaine » et à son ancre : les liens d'« Aujourd'hui »
 * et des pages entre elles, la fiabilité (la pluie ouvre la fenêtre), les
 * notifications des alertes cultures, la relecture des réglages, la visite
 * guidée. Les anciennes adresses restent servies : les notifications déjà
 * envoyées les portent (S4-o).
 */

const read = (file: string) => readFileSync(file, 'utf8');

/** Les fichiers du code : l'application et le domaine, sans les tests. */
function sources(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const file = path.join(directory, name);
    if (statSync(file).isDirectory()) return sources(file);
    return /\.(ts|tsx)$/.test(name) ? [file] : [];
  });
}

const CODE = [...sources('app'), ...sources('lib')];

/** Les trois anciennes pages, qui ne gardent que leur redirection (section 3.3). */
const REDIRECT_PAGES = ['app/irrigation/planning/page.tsx', 'app/irrigation/besoins/page.tsx', 'app/irrigation/historique/page.tsx'];

// Les liens (section 9).

test('aucun lien du code ne vise plus le planning, les besoins ou l’historique : tous visent « Semaine »', () => {
  const found: string[] = [];
  for (const file of CODE) {
    if (REDIRECT_PAGES.includes(file)) continue;
    const text = read(file);
    for (const pattern of [
      /pageHref\(\s*'(planning|besoins|historique)'/g,
      /pagePath\(\s*'(planning|besoins|historique)'/g,
      /\bpage: '(planning|besoins|historique)'/g,
      /href="\/irrigation\/(planning|besoins|historique)[?#"]/g,
    ]) {
      for (const match of text.matchAll(pattern)) found.push(`${file} : ${match[0]}`);
    }
  }
  assert.deepEqual(found, []);
  // Les trois pages gardent leur redirection, paramètres compris : une notification déjà envoyée s'ouvre.
  for (const file of REDIRECT_PAGES) assert.match(read(file), /redirectToWeekPage\('(planning|besoins|historique)', searchParams\)/);
  assert.equal(weekRedirectHref('planning', { season: '2026', week: '2026-11-09' }), '/irrigation/semaine?season=2026&week=2026-11-09');
});

test('aucun mot ne nomme plus une page disparue : « Voir la semaine », « Ouvrir la semaine », « Semaine »', () => {
  const gone = ['Voir au planning', 'Voir le planning de la semaine', 'Ouvrir le planning', 'Ouvrir Objectifs et besoins', 'sur « Objectifs et besoins »', '>Objectifs et besoins<', 'label="Objectifs et besoins"'];
  const found = CODE.flatMap((file) => gone.filter((words) => read(file).includes(words)).map((words) => `${file} : ${words}`));
  assert.deepEqual(found, []);
  assert.equal(SEE_THE_WEEK, 'Voir la semaine');
  const gauges = read('app/irrigation/today/today-gauges.tsx');
  assert.match(gauges, /<a className="today-block-more" href=\{pageHref\('semaine', query\)\}>\{SEE_THE_WEEK\}<\/a>/);
  assert.match(gauges, /<BlockFootLink href=\{pageHref\('semaine', query\)\} label=\{SEE_THE_WEEK\} \/>/);
  assert.match(read('app/irrigation/today/today-day.tsx'), /<a href=\{pageHref\(tomorrow\.link\.page, query, tomorrow\.link\.anchor\)\}>\{SEE_THE_WEEK\}<\/a>/);
  // La fenêtre de « Noter la pluie » mène à « Pluie mesurée », sur « Semaine ».
  assert.match(read('app/irrigation/rain-entry-dialog.tsx'), /besoinsLabel = 'sur « Semaine », dans « Pluie mesurée »'/);
  assert.match(read('app/irrigation/shell/feature-menu.tsx'), /besoinsHref: menu\.includes\('besoins'\) \? pageHref\('semaine', query, MEASURED_RAIN_ANCHOR\) : null,/);
  // La carte d'une irrigation, sans « Arrosages » coché : « Ouvrir sur « Semaine » ».
  assert.equal(irrigationPage(['planning', 'materiel']), 'semaine');
  assert.equal(irrigationPage(['arrosages', 'planning']), 'arrosages');
  assert.match(read('lib/domain/today/day-plan.ts'), /\{ arrosages: 'Arrosages', semaine: 'Semaine' \}/, 'les retards d’un jour repliés : « Voir les n sur « Semaine » »');
});

test('« Noter la pluie » de la fiabilité : « Semaine » ouvre la fenêtre à l’arrivée (`?pluie=1`), une fois', () => {
  assert.equal(WEEK_RAIN_INTENT, 'pluie');
  assert.equal(pageHref('semaine', { season: 2026, rain: true }), '/irrigation/semaine?season=2026&pluie=1');
  assert.equal(pageHref('semaine', { season: 2026 }), '/irrigation/semaine?season=2026', 'sans la demande, rien');
  const zone = read('app/irrigation/today/reliability-zone.tsx');
  assert.match(zone, /: <a className="today-action-link" href=\{pageHref\(action\.page, \{ \.\.\.query, rain: true \}\)\}>\{action\.label\}<\/a>;/);
  const rain = read('app/irrigation/semaine/week-rain.tsx');
  // Lue une fois puis retirée de l'adresse (`useUrlIntent`) ; la réponse s'écrit sous le bilan ; rien sous abri (D-032).
  assert.match(rain, /useUrlIntent\(WEEK_RAIN_INTENT, \(\) => \{\s+if \(rainMatters\) open\(BILAN_ORIGIN\);\s+\}\);/);
  assert.match(read('app/irrigation/semaine/week-first-level.tsx'), /reply: rain\.reply\(BILAN_ORIGIN\)/);
  assert.match(read('app/irrigation/shell/url-intent.ts'), /url\.searchParams\.delete\(name\);/);
});

test('les autres pages visent la section de « Semaine » qui porte leur contenu', () => {
  // « Matériel » : le besoin de la planche, dans « Ce qu'il reste à arroser ».
  assert.match(read('app/irrigation/hierarchy-browser.tsx'), /<a href=\{pageHref\('semaine', \{ season \}, NEEDS_SECTION_ANCHOR\)\}>Semaine<\/a>, dans « \{SIMPLE_WORDS\.leftToWater\} »/);
  assert.match(read('app/irrigation/semaine/page.tsx'), /<WeekDetailSection id=\{NEEDS_SECTION_ANCHOR\} section="reste-a-arroser"/);
  assert.equal(NEEDS_SECTION_ANCHOR, 'reste-a-arroser');
  // « Ressources » : le manque que la faisabilité ne voit pas, dans « Le plan, chaîne par chaîne ».
  assert.match(read('app/irrigation/semaine/week-detail.tsx'), /<WeekDetailSection id=\{PLAN_SECTION_ANCHOR\} section="plan"/);
  assert.equal(PLAN_SECTION_ANCHOR, 'le-plan');
  assert.match(read('app/irrigation/irrigation-feasibility-dashboard.tsx'), /href=\{pageHref\(link\.page, \{ season \}, link\.anchor\)\}/);
  // « Arrosages » : « Recalculer le plan » d'un arrosage en retard recalcule sur « Semaine ».
  assert.match(read('app/irrigation/pages/arrosages-page.tsx'), /hrefWithIntent\(pagePath\('semaine'\), season, 'recalculer', '1'\)/);
  assert.match(read('app/irrigation/planning/weekly-plan-state.tsx'), /useUrlIntent\('recalculer', \(\) => compute\(\)\);/);
  // « Réglages à relire » : les réglages du planning s'ajustent dans « Réglages de la semaine ».
  const planning = settingsGroupsFor(['planning', 'besoins']).find((group) => group.id === 'planning');
  assert.deepEqual([planning?.page, planning?.anchor], ['semaine', 'reglages-de-la-page']);
  assert.match(read('app/irrigation/reglages/settings-review.tsx'), /<a href=\{pageHref\(group\.page, \{ season \}, group\.anchor\)\}>Ajuster<\/a>/);
});

// Les notifications (section 9).

test('les alertes cultures visent « Semaine » et la semaine de l’alerte ; leur historique aussi', () => {
  assert.match(read('lib/domain/crop-alerts/sprinkler.ts'), /url: pageHref\('semaine', \{ season: Number\(monday\.slice\(0, 4\)\), week: monday \}\),/);
  assert.match(read('lib/services/crop-alerts-view.ts'), /return pageHref\('semaine', \{ season: Number\(monday\.slice\(0, 4\)\), week: monday \}\);/);
  // Le service worker n'est pas touché ; l'application installée garde sa page d'arrivée (D-323).
  assert.doesNotMatch(read('public/irrigation-notifications-sw.js'), /semaine/);
});

// La visite guidée (section 10, `demo-guided-contract.md`).

test('la visite « Le planning » se joue sur « Semaine » ; ses quatre repères y sont posés', () => {
  const tour = tourById('planning')!;
  const context = { current: 'aujourdhui' as const, reachable: ['aujourdhui', 'planning', 'besoins', 'semaine'] as const };
  assert.deepEqual(tour.steps.map((step) => stepPage(step, { ...context, reachable: [...context.reachable] })), ['semaine', 'semaine', 'semaine', 'semaine']);
  const posed = ['app/irrigation/planning/weekly-plan-view.tsx', 'app/irrigation/planning/protected-slots-section.tsx', 'app/irrigation/semaine/week-days.tsx'].map(read).join('\n');
  for (const step of tour.steps) assert.match(posed, new RegExp(`data-tour="${step.anchor}"`), step.anchor);
});

test('la visite ouvre les plis fermés de la page qui portent son repère, comme le détail de la bannière', () => {
  const tour = read('app/irrigation/shell/guided-tour.tsx');
  assert.match(tour, /if \(isOnScreen\(element\)\) return element;/, 'le contenu d’un pli fermé n’est pas à l’écran');
  assert.match(tour, /if \(!fold\.open\) folds\.push\(fold\);/);
  assert.match(tour, /if \(folded\) for \(const fold of closedFoldsAround\(folded\)\.reverse\(\)\) fold\.open = true;\s+else openDemoDetail\(\);/);
  assert.match(tour, /\.some\(isInFoldedDemoDetail\) \|\| inClosedPageFold\(name\) !== null;/, 'l’étape compte, elle n’est pas sautée');
  // `AnchoredFold` suit l'ouverture par `toggle` : l'état du pli reste juste.
  assert.match(read('app/irrigation/shell/page-settings-fold.tsx'), /onToggle=\{\(event\) => \{\s+const opened = event\.currentTarget\.open;\s+setOpen\(opened\);/);
  assert.match(read('app/irrigation/shell/on-screen.ts'), /element\.closest\('details:not\(\[open\]\) > :not\(summary\)'\) === null/);
});

// Le « ? » de la page (section 12, « Le porteur ne reconnaît pas les habitudes »).

test('le « ? » de « Semaine » dit où est chaque chose : le bilan, « Jour par jour », « Jardin par jardin », « Le détail »', () => {
  const help = PAGE_HELP.semaine;
  for (const words of ['le bilan', '« Jour par jour »', '« Jardin par jardin »', '« Le détail »']) assert.ok(help.reading.includes(words), words);
  assert.match(help.firstStep, /« Noter la pluie », sous le bilan\.$/);
  assert.match(PAGE_HELP.cultures.reading, /allumé dans « Eau visée », sur « Semaine »\.$/);
});
