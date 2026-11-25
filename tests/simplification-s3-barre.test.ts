import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { FEATURE_IDS, type FeatureId } from '../lib/domain/features/catalogue';
import { menuPages, type IrrigationPageId } from '../lib/domain/features/pages';
import { BACK_TO_FARM_LABEL, backToFarm, phoneBar, weekBand, weekBandLabel, type PhoneBarItem } from '../lib/domain/features/phone-bar';
import { farmCardPages, farmPlaces, menuPlacePages, PLACE_IDS, placeEntry, placeLabel, placeMark, placeOfPage } from '../lib/domain/features/places';
import { PLUS_BUTTON_LABEL, PLUS_SHEET_TITLE, plusGestures, WATERING_INTENT, wateringIntentForm } from '../lib/domain/features/plus-sheet';
import { isCompleteSelection } from '../lib/domain/features/selection';
import { farmRainMatters, rainEntry, rainEntryFirstDate } from '../lib/domain/today/rain-entry';

/**
 * Simplifier l'usage du module, lot S3, PR 2 : la barre du bas, le « + » et
 * les chemins (docs/simplification-s3-contract.md, sections 3.3, 3.4, 4,
 * 4.1, 5.1 et 8 ; D-331). Les règles vivent dans
 * `lib/domain/features/phone-bar.ts` et `plus-sheet.ts` ; les mesures
 * (hauteur de la barre, cibles, débord à 320 px, touches pour joindre chaque
 * page) se font dans le navigateur (P63).
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

function names(bar: readonly PhoneBarItem[]): string[] {
  return bar.map((item) => (item.kind === 'plus' ? 'plus' : item.place));
}

/**
 * Le nombre de touches pour ouvrir une page depuis n'importe quelle autre
 * (section 4, règle 2) : l'entrée d'un endroit à une touche ; une page de
 * « Semaine » par sa bande, une fiche de « Ma ferme », « Arrosages » par le
 * « + » ou « Tous les arrosages », à deux.
 */
function taps(page: IrrigationPageId, menu: readonly IrrigationPageId[], rainMatters: boolean): number | null {
  const bar = phoneBar(menu, null, plusGestures(menu, rainMatters).length > 0);
  if (bar.some((item) => item.kind === 'place' && item.page === page)) return 1;
  const place = placeOfPage(page);
  const entry = bar.find((item) => item.kind === 'place' && item.place === place);
  if (!entry || entry.kind !== 'place') return null;
  if (place === 'semaine') return weekBand(menu, entry.page)?.includes(page) ? 2 : null;
  if (place === 'ma-ferme') return (farmCardPagesOfMenu(menu) as readonly IrrigationPageId[]).includes(page) ? 2 : null;
  // « Arrosages » : par « Arroser maintenant » du « + », ou « Tous les arrosages » d'« Aujourd'hui » (section 3.4).
  if (page === 'arrosages') return plusGestures(menu, rainMatters).some((gesture) => gesture.id === 'arroser-maintenant') ? 2 : null;
  return null;
}

/** Les fiches de « Ma ferme » d'un menu : les pages de l'endroit présentes dans le menu, hors « Ma ferme » elle-même. */
function farmCardPagesOfMenu(menu: readonly IrrigationPageId[]): IrrigationPageId[] {
  return menuPlacePages('ma-ferme', menu).filter((page) => page !== 'ma-ferme');
}

test('règle 1 : Aujourd’hui, Semaine, « + », Ma ferme, dans cet ordre ; toutes cases cochées', () => {
  const menu = menuPages(ALL);
  assert.deepEqual(names(phoneBar(menu, null, true)), ['aujourdhui', 'semaine', 'plus', 'ma-ferme']);
  const bar = phoneBar(menu, null, true).filter((item) => item.kind === 'place');
  assert.deepEqual(bar.map((item) => item.kind === 'place' && item.page), ['aujourdhui', 'planning', 'ma-ferme']);
  assert.deepEqual(PLACE_IDS.map(placeLabel), ['Aujourd’hui', 'Semaine', 'Ma ferme']);
});

test('sections 3.2 et 4 : pour chaque choix de cases valide, la barre, le « + » et chaque page à deux touches au plus', () => {
  assert.equal(SELECTIONS.length, 235);
  for (const selection of SELECTIONS) {
    const menu = menuPages(selection);
    for (const rainMatters of [true, false]) {
      const gestures = plusGestures(menu, rainMatters);
      const bar = phoneBar(menu, null, gestures.length > 0);
      const label = `${selection.join(', ')}${rainMatters ? '' : ' (toute sous abri)'}`;
      // Les endroits de la barre sont ceux de la ferme, chacun sur sa page d'entrée (même règle que `placeEntry`).
      const places = bar.flatMap((item) => (item.kind === 'place' ? [item] : []));
      assert.deepEqual(places.map((item) => item.place), farmPlaces(selection), label);
      for (const item of places) assert.equal(item.page, placeEntry(item.place, selection), label);
      // « Ma ferme » toujours, en dernier ; le « + » juste avant elle, s'il a un geste ; quatre places au plus.
      assert.equal(names(bar).at(-1), 'ma-ferme', label);
      assert.equal(names(bar).includes('plus'), gestures.length > 0, label);
      if (gestures.length > 0) assert.equal(names(bar).at(-2), 'plus', label);
      assert.ok(bar.length <= 4, label);
      // Chaque page du menu à deux touches au plus (règle 2) ; « Ma ferme » et l'entrée d'un endroit à une.
      for (const page of menu) {
        const count = taps(page, menu, rainMatters);
        assert.ok(count !== null && count <= 2, `${label} : ${page} à ${count ?? 'aucune'} touche`);
      }
      // Les fiches de « Ma ferme » de la barre sont celles de la page « Ma ferme » (PR 1).
      assert.deepEqual(farmCardPagesOfMenu(menu), farmCardPages(selection), label);
    }
  }
});

test('règle 2, le bilan honnête : Planning à une touche ; Ressources et Arrosages passent à deux ; Besoins, Historique, Matériel à deux', () => {
  const menu = menuPages(ALL);
  assert.equal(taps('aujourdhui', menu, true), 1);
  assert.equal(taps('planning', menu, true), 1);
  assert.equal(taps('ma-ferme', menu, true), 1);
  for (const page of ['arrosages', 'ressources', 'besoins', 'historique', 'materiel', 'sol', 'cultures', 'alertes-meteo', 'alertes-cultures', 'reglages'] as const) {
    assert.equal(taps(page, menu, true), 2, page);
  }
});

test('section 8 : les états rares de la barre', () => {
  // Les alertes seules : Ma ferme, une barre d'une entrée, sans « + ».
  const alerts = menuPages(['alertes-meteo', 'alertes-cultures']);
  assert.equal(plusGestures(alerts, true).length, 0);
  assert.deepEqual(names(phoneBar(alerts, null, false)), ['aujourdhui', 'ma-ferme'].filter((place) => place === 'ma-ferme' || menuPlacePages('aujourdhui', alerts).length > 0));
  // Matériel seul (sans aucune des huit cases de F1) : Ma ferme seule.
  const equipment = menuPages(['materiel']);
  assert.deepEqual(names(phoneBar(equipment, null, plusGestures(equipment, true).length > 0)), ['ma-ferme']);
  // Sans « Arrosages » ni « Objectifs et besoins » : pas de « + ».
  const history = menuPages(['historique']);
  assert.equal(plusGestures(history, true).length, 0);
  assert.deepEqual(names(phoneBar(history, null, false)), ['semaine', 'ma-ferme']);
  // La ferme toute sous abri : le « + » sans « Noter la pluie » (D-032).
  assert.deepEqual(plusGestures(menuPages(ALL), false).map((gesture) => gesture.id), ['arroser-maintenant', 'arrosage-fait']);
  // « Objectifs et besoins » sans « Arrosages » : le « + » n'a que « Noter la pluie ».
  const needs = menuPages(['besoins']);
  assert.equal(needs.includes('arrosages'), false);
  assert.deepEqual(plusGestures(needs, true).map((gesture) => gesture.id), ['noter-la-pluie']);
  assert.deepEqual(plusGestures(needs, false), []);
  // La page introuvable n'a pas de page ouverte : aucun endroit marqué.
  assert.ok(phoneBar(menuPages(ALL), null, true).every((item) => item.kind === 'plus' || item.current === null));
});

test('section 4.1 : les trois gestes de la feuille, leurs mots, et ce qu’ils ouvrent', () => {
  assert.equal(PLUS_BUTTON_LABEL, 'Arroser ou noter');
  assert.equal(PLUS_SHEET_TITLE, 'Que voulez-vous faire ?');
  assert.deepEqual(plusGestures(menuPages(ALL), true).map(({ title, text }) => [title, text]), [
    ['Arroser maintenant', 'Je choisis où et combien de temps'],
    ['Noter la pluie', 'Ce que dit votre pluviomètre'],
    ['Noter un arrosage déjà fait', 'J’ai arrosé sans le module'],
  ]);
  assert.equal(WATERING_INTENT, 'arroser');
  assert.equal(wateringIntentForm('maintenant'), 'running');
  assert.equal(wateringIntentForm('fait'), 'completed');
  assert.equal(wateringIntentForm('planifier'), null, 'une demande inconnue n’ouvre rien');
  assert.equal(wateringIntentForm(''), null);
});

test('S3-e : l’endroit de la page ouverte porte la marque, `page` sur son entrée, `true` sur ses autres pages', () => {
  const menu = menuPages(ALL);
  const mark = (current: IrrigationPageId) => Object.fromEntries(phoneBar(menu, current, true).flatMap((item) => (item.kind === 'place' ? [[item.place, item.current]] : [])));
  assert.deepEqual(mark('aujourdhui'), { aujourdhui: 'page', semaine: null, 'ma-ferme': null });
  assert.deepEqual(mark('arrosages'), { aujourdhui: 'true', semaine: null, 'ma-ferme': null });
  assert.deepEqual(mark('planning'), { aujourdhui: null, semaine: 'page', 'ma-ferme': null });
  assert.deepEqual(mark('historique'), { aujourdhui: null, semaine: 'true', 'ma-ferme': null });
  assert.deepEqual(mark('ma-ferme'), { aujourdhui: null, semaine: null, 'ma-ferme': 'page' });
  assert.deepEqual(mark('reglages'), { aujourdhui: null, semaine: null, 'ma-ferme': 'true' });
  // Sans Planning, la semaine s'ouvre sur « Objectifs et besoins » : c'est son entrée.
  const withoutPlanning = menuPages(['besoins', 'historique']);
  assert.equal(placeMark('semaine', menuPlacePages('semaine', withoutPlanning)[0], 'besoins'), 'page');
  assert.equal(placeMark('semaine', 'besoins', null), null);
});

test('section 3.3 : la bande de la semaine, sur ses trois pages, à partir de deux pages cochées', () => {
  const menu = menuPages(ALL);
  for (const page of ['planning', 'besoins', 'historique'] as const) assert.deepEqual(weekBand(menu, page), ['planning', 'besoins', 'historique'], page);
  for (const page of ['aujourdhui', 'arrosages', 'ma-ferme', 'materiel', 'reglages'] as const) assert.equal(weekBand(menu, page), null, page);
  // Zéro, une, deux, trois pages cochées.
  assert.equal(weekBand(menuPages(['historique']), 'historique'), null, 'une page : pas de bande');
  assert.deepEqual(weekBand(menuPages(['besoins', 'historique']), 'historique'), ['besoins', 'historique']);
  assert.deepEqual(weekBand(menuPages(['planning', 'historique']), 'planning'), menuPlacePages('semaine', menuPages(['planning', 'historique'])));
  assert.equal(weekBand(menuPages(['materiel']), null), null);
  // Les noms courts d'avant, le nom complet restant celui du lien.
  assert.deepEqual(['planning', 'besoins', 'historique'].map((page) => weekBandLabel(page as IrrigationPageId, page)), ['Planning', 'Besoins', 'Historique']);
});

test('section 5.1 : le retour « ‹ Ma ferme » sur toute page de « Ma ferme », hors « Ma ferme » elle-même', () => {
  assert.equal(BACK_TO_FARM_LABEL, 'Retour à Ma ferme');
  for (const page of menuPages(ALL)) assert.equal(backToFarm(page), placeOfPage(page) === 'ma-ferme' && page !== 'ma-ferme', page);
  assert.equal(backToFarm(null), false, 'la page introuvable');
  assert.equal(backToFarm('besoins'), false, 'une page de « Semaine » n’a pas de retour : sa bande suffit');
});

test('D-032, appelée par la barre : la pluie compte dès qu’une planche de la saison est hors abri', () => {
  const plots = [{ id: 'serre', mode: 'greenhouse' as const }, { id: 'champ', mode: 'garden' as const }];
  assert.equal(farmRainMatters({ plots, beds: [{ plotId: 'serre', seasons: [2026] }, { plotId: 'champ', seasons: [2026] }] }, 2026), true);
  assert.equal(farmRainMatters({ plots, beds: [{ plotId: 'serre', seasons: [2026] }] }, 2026), false, 'toute sous abri');
  assert.equal(farmRainMatters({ plots, beds: [{ plotId: 'serre', seasons: [2026] }, { plotId: 'champ', seasons: [2025] }] }, 2026), false, 'la planche de plein champ n’est pas de la saison');
  assert.equal(farmRainMatters({ plots, beds: [] }, 2026), false, 'aucune planche');
  // « Aujourd'hui » et le « + » appellent la même règle, jamais recopiée.
  assert.match(readFileSync('lib/services/today-service.ts', 'utf8'), /const rainMatters = farmRainMatters\(snapshot, season\);/);
  assert.match(readFileSync('app/irrigation/page-context.ts', 'utf8'), /rainMatters: farmRainMatters\(snapshot, season\),/);
  assert.doesNotMatch(readFileSync('lib/services/today-service.ts', 'utf8'), /mode === 'greenhouse'/);
});

test('section 4.1 : « Noter la pluie » lit les mesures déjà notées à l’ouverture du geste, sur les mêmes jours que la fenêtre de S2', () => {
  assert.equal(rainEntryFirstDate('2026-11-25'), '2026-11-18');
  const entry = rainEntry({ today: '2026-11-25', measured: new Map([['2026-11-24', 8]]) });
  assert.equal(entry.days.at(-1)?.date, rainEntryFirstDate('2026-11-25'));
  const actions = readFileSync('app/irrigation/water-actions.ts', 'utf8');
  const read = actions.slice(actions.indexOf('export async function readRainEntryAction'));
  assert.match(read, /listWeatherDailyValuesForUser\(user\.userId, 'farm:manual', rainEntryFirstDate\(today\), today\)/);
  assert.match(read, /row\.dataKind === 'manual_precipitation'/);
  // Aucune lecture de plus au chargement d'une page (section 7) : le gabarit ne lit pas la pluie.
  assert.doesNotMatch(readFileSync('app/irrigation/page-context.ts', 'utf8'), /readRainEntryAction|listWeatherDailyValuesForUser/);
});

test('règles 3 à 5 : la barre dessine le domaine, le « + » est un bouton qui ouvre une feuille modale', () => {
  const menu = readFileSync('app/irrigation/shell/feature-menu.tsx', 'utf8');
  assert.match(menu, /const bar = phoneBar\(menu, current, gestures\.length > 0\);/);
  assert.match(menu, /aria-current=\{item\.current \?\? undefined\}/);
  // Section 3.3 : l'entrée « Semaine » garde le jour ouvert, comme la bande ; les autres entrées, comme le menu.
  assert.match(menu, /href=\{pageHref\(item\.page, item\.place === 'semaine' \? \{ \.\.\.query, week \} : query\)\}/);
  assert.match(menu, /<span>\{placeLabel\(item\.place\)\}<\/span>/);
  // F12 : la pastille reste sur l'entrée « Aujourd'hui », jamais ailleurs.
  assert.match(menu, /item\.place === 'aujourdhui' \? <TodayBadge count=\{badgeOf\(item\.page\)\} \/> : null/);
  assert.doesNotMatch(menu, /Plus de pages|phone-bar-more|data-open/);
  const sheet = readFileSync('app/irrigation/shell/plus-sheet.tsx', 'utf8');
  assert.match(sheet, /<button\s+ref=\{button\}\s+type="button"\s+className="phone-bar-plus"\s+aria-label=\{PLUS_BUTTON_LABEL\}\s+aria-haspopup="dialog"/);
  assert.match(sheet, /sheet\.current\.showModal\(\)/);
  // Échap, un geste sur le voile et « Fermer » referment ; le clavier revient sur le « + ».
  assert.match(sheet, /onCancel=\{\(event\) => \{ event\.preventDefault\(\); close\(\); \}\}/);
  assert.match(sheet, /if \(event\.target === event\.currentTarget\) close\(\);/);
  // Une pluie enregistrée replie le formulaire : la feuille ne reste pas « en cours », « Fermer » répond (P63 l'a pris en défaut).
  assert.match(sheet, /onSaved=\{\(text\) => \{[^}]*setPending\(false\);\s*setRain\(\{ kind: 'closed' \}\);\s*setSaved\(text\);/);
  // La feuille se ferme avant de rendre le clavier : modale, elle laisse le « + » inerte (P63 l'a pris en défaut).
  assert.match(sheet, /sheet\.current\?\.close\(\);\s*setOpen\(false\);\s*setRain\(\{ kind: 'closed' \}\);\s*button\.current\?\.focus\(\);/);
  assert.match(sheet, /button\.current\?\.focus\(\);/);
  // La fenêtre de la pluie de S2, montée dans la feuille ; les deux autres gestes ouvrent « Arrosages » par la demande d'adresse.
  assert.match(sheet, /<RainEntryForm/);
  assert.match(sheet, /params\.set\(WATERING_INTENT, WATERING_INTENT_VALUES\[id\]\);/);
  assert.match(readFileSync('app/irrigation/pages/arrosages-page.tsx', 'utf8'), /useUrlIntent\(WATERING_INTENT, \(value\) => \{/);
  assert.match(readFileSync('app/irrigation/irrigation-event-manager.tsx', 'utf8'), /window\.addEventListener\(IRRIGATION_FORM_REQUESTED, openRequestedForm\);/);
  // Le formulaire de la pluie est le même dans la fenêtre d'« Aujourd'hui » et dans la feuille.
  const dialog = readFileSync('app/irrigation/rain-entry-dialog.tsx', 'utf8');
  assert.match(dialog, /<RainEntryForm\s+key=\{opening\}/);
  // Refait à la fermeture, jamais à l'ouverture : refait après `showModal`, il perdrait le clavier de « Quel jour ? » (P62).
  assert.match(dialog, /if \(open && !dialog\.current\?\.open\) dialog\.current\?\.showModal\(\);\s+if \(!open && dialog\.current\?\.open\) \{\s+dialog\.current\.close\(\);\s+setOpening\(\(value\) => value \+ 1\);/);
  assert.equal((dialog.match(/setOpening\(/g) ?? []).length, 1);
  assert.equal((dialog.match(/saveManualRainfallAction\(/g) ?? []).length, 1);
});

test('sections 3.3 et 5.1 : la bande et le retour, au gabarit, au téléphone seulement', () => {
  const shell = readFileSync('app/irrigation/shell/irrigation-shell.tsx', 'utf8');
  assert.match(shell, /<FeatureMenu key=\{page\} menu=\{menu\} current=\{page\} query=\{\{ season, zone \}\} todayBadge=\{todayBadge\} rainMatters=\{rainMatters\} week=\{week\} \/>/);
  assert.match(shell, /back=\{backToFarm\(page\) \? <BackToFarm query=\{\{ season, zone \}\} \/> : null\}/);
  assert.match(shell, /<WeekBand menu=\{menu\} current=\{page\} query=\{\{ season, zone, week \}\} \/>/);
  const paths = readFileSync('app/irrigation/shell/place-paths.tsx', 'utf8');
  assert.match(paths, /aria-current=\{page === current \? 'page' : undefined\}/);
  assert.match(paths, /aria-label=\{BACK_TO_FARM_LABEL\}/);
  assert.match(readFileSync('app/irrigation/shell/page-title.tsx', 'utf8'), /<div className="page-title-row">\s*\{back\}\s*<h1/);
});

test('la charte : 52 px pour le « + », 72 px pour un geste, 44 px pour la bande et le retour ; la bande et le retour seulement sous la barre', () => {
  const css = readFileSync('app/irrigation/styles/trois-endroits.css', 'utf8');
  assert.match(css, /^\.week-band,\n\.page-back \{\n  display: none;\n\}/m);
  const phone = css.slice(css.indexOf('@media (max-width: 980px)'));
  assert.match(phone, /\.phone-bar-plus-badge \{[^}]*width: 52px;\s*height: 52px;/);
  assert.match(css, /\.plus-gesture \{[^}]*min-height: 72px;/);
  assert.match(phone, /\.week-band a \{[^}]*min-height: var\(--touch-target\);/);
  assert.match(phone, /\.page-back \{[^}]*width: 44px;\s*height: 44px;/);
  assert.match(phone, /\.week-band \{\s*display: block;/);
  assert.match(readFileSync('app/irrigation/irrigation.css', 'utf8'), /@import '\.\/styles\/trois-endroits\.css';\n@import '\.\/styles\/gestes-surs\.css';/);
  // Les noms de la barre tiennent sur une ligne à 320 px (règle 6) : courts.
  for (const place of PLACE_IDS) assert.ok(placeLabel(place).length <= 11, place);
});
