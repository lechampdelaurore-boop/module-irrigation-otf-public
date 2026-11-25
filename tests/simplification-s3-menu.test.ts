import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { FEATURE_IDS, type FeatureId } from '../lib/domain/features/catalogue';
import { menuPlaces } from '../lib/domain/features/desktop-menu';
import { menuPages } from '../lib/domain/features/pages';
import { phoneBar } from '../lib/domain/features/phone-bar';
import { enabledPlacePages, farmPlaces, placeEntry, placeOfPage } from '../lib/domain/features/places';
import { PLUS_BUTTON_LABEL } from '../lib/domain/features/plus-sheet';
import { isCompleteSelection } from '../lib/domain/features/selection';

/**
 * Simplifier l'usage du module, lot S3, PR 3 : le menu de l'ordinateur
 * (docs/simplification-s3-contract.md, section 6, S3-i, S3-l ; D-331). La
 * règle vit dans `lib/domain/features/desktop-menu.ts` (`menuPlaces`), qui
 * range comme la barre du bas, de la même fonction (`menuPlacePages`) ; le
 * dessin à 1 440 px se mesure dans le navigateur (P63).
 */

function validSelections(): FeatureId[][] {
  const selections: FeatureId[][] = [];
  for (let mask = 1; mask < 2 ** FEATURE_IDS.length; mask += 1) {
    const selection = FEATURE_IDS.filter((_, index) => (mask >> index) & 1);
    if (isCompleteSelection(selection)) selections.push(selection);
  }
  return selections;
}

const ALL: FeatureId[] = [...FEATURE_IDS];

test('section 6 : pour chaque choix de cases valide, les endroits de la barre, chacun avec ses pages cochées, une fois chacune', () => {
  const selections = validSelections();
  assert.equal(selections.length, 235);
  for (const selection of selections) {
    const menu = menuPages(selection);
    const places = menuPlaces(menu, null);
    const label = selection.join(', ');
    // Les mêmes endroits que la barre du bas, dans le même ordre, chacun sur la même entrée.
    assert.deepEqual(places.map((group) => group.place), farmPlaces(selection), label);
    const bar = phoneBar(menu, null, false).flatMap((item) => (item.kind === 'place' ? [item] : []));
    assert.deepEqual(places.map((group) => group.entry), bar.map((item) => item.page), label);
    for (const group of places) {
      assert.equal(group.entry, placeEntry(group.place, selection), label);
      // Le titre et la liste disent ensemble les pages cochées de l'endroit, dans son ordre ; l'entrée qui porte le nom
      // de l'endroit n'est pas répétée, celle de « Semaine » l'est (S3-a).
      const own = group.entry === group.place;
      assert.deepEqual(own ? [group.entry, ...group.pages] : group.pages, enabledPlacePages(group.place, selection), label);
      assert.equal(own, group.place !== 'semaine', label);
    }
    // Chaque page du menu y est une fois, Réglages en dernier, dans « Ma ferme » (S3-i).
    const shown = places.flatMap((group) => (group.entry === group.place ? [group.entry, ...group.pages] : group.pages));
    assert.deepEqual([...shown].sort(), [...menu].sort(), label);
    assert.equal(new Set(shown).size, shown.length, label);
    assert.equal(shown.at(-1), 'reglages', label);
    assert.equal(placeOfPage('reglages'), places.at(-1)?.place, label);
  }
});

test('S3-e : la page ouverte marquée une fois ; le titre de son endroit `true` quand la liste la porte ; rien sur la page introuvable', () => {
  const menu = menuPages(ALL);
  for (const current of menu) {
    const places = menuPlaces(menu, current);
    for (const group of places) {
      const label = `${group.place} sur ${current}`;
      if (placeOfPage(current) !== group.place) {
        assert.equal(group.mark, null, label);
        continue;
      }
      // « Aujourd'hui » et « Ma ferme » sur leur page : `page` ; « Semaine » sur Planning : `true`, Planning porte `page`.
      const titleIsThePage = group.entry === current && !group.pages.includes(current);
      assert.equal(group.mark, titleIsThePage ? 'page' : 'true', label);
    }
  }
  assert.deepEqual(menuPlaces(menu, null).map((group) => group.mark), [null, null, null]);
});

test('le menu de l’ordinateur : le « + Arroser ou noter » en tête, les trois endroits dépliés, les titres en liens, la semaine garde son jour', () => {
  const source = readFileSync('app/irrigation/shell/feature-menu.tsx', 'utf8');
  const desktop = source.slice(source.indexOf('<nav className="feature-menu"'));
  // Le « + » en tête, avant le premier endroit, la même feuille que la barre.
  const plus = desktop.indexOf('<PlusSheet variant="menu" {...plusProps} />');
  assert.ok(plus >= 0 && plus < desktop.indexOf('places.map('), 'le « + » en tête du menu');
  assert.match(source, /<PlusSheet variant="bar" \{\.\.\.plusProps\} \/>/);
  // Pas de « + » sans geste (section 8), au menu comme à la barre.
  assert.match(desktop, /\{gestures\.length > 0 \? \(\s*<li className="menu-plus-item">/);
  assert.match(source, /const places = menuPlaces\(menu, current\);/);
  // « Aujourd'hui » dans son encart ; les autres titres, des liens vers l'entrée de l'endroit, marqués par le domaine.
  assert.match(desktop, /group\.entry === 'aujourdhui' \? \(\s*<Link\s+className="menu-home"/);
  assert.match(desktop, /className="menu-place-title"\s+href=\{pageHref\(group\.entry, groupQuery\)\}/);
  // La marque du domaine, sur l'encart comme sur les titres.
  assert.equal(desktop.match(/aria-current=\{group\.mark \?\? undefined\}/g)?.length, 2);
  assert.match(desktop, /<ul aria-label=\{placeLabel\(group\.place\)\}>/);
  // La semaine garde le jour ouvert, au titre comme à ses pages, comme la bande du téléphone (F885).
  assert.match(desktop, /const groupQuery = group\.place === 'semaine' \? \{ \.\.\.query, week \} : query;/);
  assert.match(desktop, /<MenuLink key=\{item\} item=\{item\} current=\{current\} query=\{groupQuery\} \/>/);
  // Les groupes d'avant ne sont plus.
  assert.doesNotMatch(source, /menuLayout|menu-group|menu-settings-item|Équiper|Surveiller/);

  const sheet = readFileSync('app/irrigation/shell/plus-sheet.tsx', 'utf8');
  // À l'ordinateur, le nom se lit sur le bouton ; au téléphone, le rond le porte en nom accessible.
  assert.match(sheet, /className=\{variant === 'bar' \? 'phone-bar-plus' : 'menu-plus'\}/);
  assert.match(sheet, /aria-label=\{variant === 'bar' \? PLUS_BUTTON_LABEL : undefined\}/);
  assert.match(sheet, /<Icon name="plus" \/><span>\{PLUS_BUTTON_LABEL\}<\/span>/);
  assert.equal(PLUS_BUTTON_LABEL, 'Arroser ou noter');

  const css = readFileSync('app/irrigation/styles/navigation.css', 'utf8');
  assert.match(css, /\.feature-menu button\.menu-plus \{[^}]*min-height: var\(--touch-target\);[^}]*background: var\(--green\);/);
  assert.match(css, /\.menu-place \+ \.menu-place \{[^}]*border-top:/);
  assert.match(css, /\.feature-menu a\.menu-place-title\[aria-current="true"\] \{\s+color: var\(--green\);/);
  assert.doesNotMatch(css, /menu-group|menu-settings-item|menu-home-item/);
  // Pas de capitales aux titres : un lecteur d'écran lirait le nom lettre à lettre (F888).
  assert.doesNotMatch(css, /\.menu-place-title \{[^}]*text-transform/);
  // La feuille, en boîte de dialogue au milieu de la page à l'ordinateur, sans la poignée du téléphone.
  const sheetCss = readFileSync('app/irrigation/styles/trois-endroits.css', 'utf8');
  assert.match(sheetCss, /@media \(min-width: 981px\) \{\s+\.plus-sheet \{[^}]*margin: auto;[^}]*border-radius: var\(--radius\);[^}]*\}\s+\.plus-sheet-handle \{\s+display: none;/);
});
