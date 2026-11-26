import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { TOURS } from '../lib/domain/demo/tours';
import { PAGE_HELP } from '../lib/domain/features/help';
import { PLACE_IDS, placeLabel } from '../lib/domain/features/places';

/**
 * Simplifier l'usage du module, lot S3, PR 4 : les liens et les visites
 * (docs/simplification-s3-contract.md, sections 2 et 9 ; D-331). La visite
 * guidée de la démonstration et le « ? » d'« Aujourd'hui » parlent des trois
 * endroits et du « + », plus d'un menu qui « ne montre que » les cases ni de
 * « Plus ». L'ancre `menu` désigne la barre du bas au téléphone et le menu de
 * gauche à l'ordinateur (docs/demo-guided-contract.md, section 7).
 */

const TOUR_TEXTS = TOURS.flatMap((tour) => [tour.title, tour.summary, ...tour.steps.flatMap((step) => [step.title, step.text])]);
const HELP_TEXTS = Object.values(PAGE_HELP).flatMap((help) => [help.purpose, help.reading, help.firstStep]);

test('la visite « Bienvenue » présente, sur l’ancre du menu, les trois endroits et le « + »', () => {
  const steps = TOURS.find((tour) => tour.id === 'bienvenue')?.steps.filter((step) => step.anchor === 'menu') ?? [];
  assert.equal(steps.length, 1);
  const [step] = steps;
  assert.equal(step?.title, 'Trois endroits');
  for (const place of PLACE_IDS) assert.ok(step?.text.includes(`« ${placeLabel(place)} »`), place);
  assert.match(step?.text ?? '', /Le « \+ » lance ou note un arrosage, ou note la pluie/);
});

test('« Le module à la carte » dit que les endroits suivent les cases, et que le « + » sans geste disparaît', () => {
  const step = TOURS.find((tour) => tour.id === 'a-la-carte')?.steps.find((item) => item.anchor === 'menu');
  assert.equal(step?.title, 'Les endroits suivent vos cases');
  assert.match(step?.text ?? '', /Un endroit qui n’a plus de page disparaît, comme le « \+ »/);
});

test('aucune visite ni aucun « ? » ne parle de « Plus » ni d’un menu qui ne montre que les cases cochées', () => {
  for (const text of [...TOUR_TEXTS, ...HELP_TEXTS]) {
    assert.doesNotMatch(text, /« Plus »|Plus de pages|Pages du module|[Ll]e menu ne montre|au menu que|du menu et des calculs|Arroser, Équiper/, text);
  }
});

test('le « ? » d’« Aujourd’hui » situe sa pastille dans la barre du bas et dans le menu', () => {
  assert.match(PAGE_HELP.aujourdhui.reading, /Le nombre à côté de « Aujourd’hui », dans la barre du bas ou le menu, compte/);
});

test('l’ancre « menu » est posée sur la barre du bas et sur le menu de l’ordinateur ; la visite prend celle qu’on voit', () => {
  const menu = readFileSync('app/irrigation/shell/feature-menu.tsx', 'utf8');
  assert.match(menu, /<nav className="phone-bar" data-tour="menu"/);
  assert.match(menu, /<nav className="feature-menu" data-tour="menu"/);
  const tour = readFileSync('app/irrigation/shell/guided-tour.tsx', 'utf8');
  assert.match(tour, /querySelectorAll<HTMLElement>\(`\[data-tour="\$\{name\}"\]`\)\) \{\s+if \(element\.getClientRects\(\)\.length > 0\) return element;/);
});
