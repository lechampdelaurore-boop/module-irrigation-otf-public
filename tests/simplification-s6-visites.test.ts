import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DEMO_PROFILES } from '../lib/domain/demo/catalogue.ts';
import { TOURS, allStepWords, stepWords, tourById } from '../lib/domain/demo/tours.ts';
import { pageHelp } from '../lib/domain/features/help.ts';
import { CHOOSE_MYSELF_LABEL } from '../lib/domain/features/start.ts';

/**
 * Les visites guidées et la ferme vierge de la démonstration (simplification,
 * lot S6, PR 4, docs/simplification-s6-contract.md, section 10 ; D-336) :
 * sur l'écran de la première ouverture, les deux étapes de « Le module à la
 * carte » disent les trois façons de commencer, plus la liste des cases ;
 * aucune étape n'est ajoutée ni retirée, l'ancre et la règle de saut (F177)
 * restent. La ferme vierge s'ouvre sur les trois façons, et la remise à zéro
 * la rend vierge (tests/db/demo-reset.test.ts).
 */

const carte = tourById('a-la-carte')!;

test('sur la première ouverture, les deux étapes de « Le module à la carte » disent les trois façons de commencer', () => {
  const [coche, perdre] = carte.steps;
  assert.deepEqual(stepWords(coche, 'bienvenue').title, 'Trois façons de commencer');
  assert.match(stepWords(coche, 'bienvenue').text, /Noter vos arrosages, laisser le module proposer quoi arroser, ou tout/);
  assert.ok(stepWords(coche, 'bienvenue').text.includes(`« ${CHOOSE_MYSELF_LABEL} » montre la liste des cases`));
  assert.equal(stepWords(perdre, 'bienvenue').title, 'Rien n’est choisi d’avance');
  // Ce que l'écran dit (S6-a, D-028) : l'étiquette désigne sans choisir, rien ne s'écrit avant « Continuer ».
  assert.match(stepWords(perdre, 'bienvenue').text, /« Conseillé » désigne une façon sans la choisir à votre place/);
  assert.match(stepWords(perdre, 'bienvenue').text, /rien ne s’enregistre avant « Continuer »/);
  assert.match(stepWords(perdre, 'bienvenue').text, /décocher ne perd rien/);
});

test('dans Réglages, les mêmes étapes gardent leurs mots : la liste des cases', () => {
  const [coche, perdre, menu] = carte.steps;
  assert.deepEqual(stepWords(coche, 'reglages'), { title: 'Cochez ce qui vous sert', text: coche.text });
  assert.deepEqual(stepWords(perdre, 'reglages'), { title: 'Sans rien perdre', text: perdre.text });
  assert.equal(stepWords(menu, 'bienvenue').title, 'Les endroits suivent vos cases', 'une étape sans mots propres garde les siens');
});

test('aucune étape ajoutée ni retirée, même ancre, mêmes pages (section 10, F177)', () => {
  assert.deepEqual(
    Object.fromEntries(TOURS.map((tour) => [tour.id, tour.steps.length])),
    { bienvenue: 7, arrosage: 6, planning: 4, penurie: 5, alertes: 4, 'a-la-carte': 3, 'ma-ferme': 3 },
  );
  for (const step of carte.steps.slice(0, 2)) {
    assert.equal(step.anchor, 'fonctionnalites');
    assert.deepEqual(step.pages, ['reglages', 'bienvenue']);
  }
  // Seules ces deux étapes ont des mots propres à une page.
  const withOwnWords = TOURS.flatMap((tour) => tour.steps.filter((step) => step.on).map((step) => `${tour.id}:${step.title}`));
  assert.deepEqual(withOwnWords, ['a-la-carte:Cochez ce qui vous sert', 'a-la-carte:Sans rien perdre']);
});

test('aucune étape jouable sur la première ouverture n’y parle de cocher la liste', () => {
  for (const tour of TOURS) {
    for (const step of tour.steps) {
      if (step.pages && !step.pages.includes('bienvenue')) continue;
      const words = stepWords(step, 'bienvenue');
      // Le menu n'existe pas sur la première ouverture : l'étape qui le vise y est sautée (F177).
      if (step.anchor === 'menu') continue;
      assert.doesNotMatch(`${words.title} ${words.text}`, /Cochez|Chaque case est/, `${tour.id} : ${words.title}`);
    }
  }
});

test('tous les mots d’une étape sont relus par les tests de garde, ceux de la première ouverture compris', () => {
  const titles = carte.steps.flatMap(allStepWords).map((words) => words.title);
  assert.deepEqual(titles, ['Cochez ce qui vous sert', 'Trois façons de commencer', 'Sans rien perdre', 'Rien n’est choisi d’avance', 'Les endroits suivent vos cases']);
  for (const words of carte.steps.flatMap(allStepWords)) {
    assert.ok(words.title.length <= 50 && words.text.length <= 320, words.title);
  }
});

test('la bulle et l’annonce du lecteur d’écran disent les mots de la page ouverte', () => {
  const source = readFileSync('app/irrigation/shell/guided-tour.tsx', 'utf8');
  assert.equal(source.match(/stepWords\(tour\.steps\[[^\]]+\], context\.current\)/g)?.length, 2);
  // La bulle rend ces mots-là, titre et texte, et aucun autre titre d'étape.
  assert.match(source, /<h2 id=\{titleId\} ref=\{headingRef\} tabIndex=\{-1\}>\{words\.title\}<\/h2>\s*<p id=\{textId\}>\{words\.text\}<\/p>/);
  assert.doesNotMatch(source, /\{step\.title\}|\{step\.text\}|\.steps\[[^\]]+\]\.(title|text)/);
});

test('la ferme vierge du catalogue s’ouvre sur les trois façons de commencer', () => {
  const vierge = DEMO_PROFILES.find((profile) => profile.id === 'vierge')!;
  assert.deepEqual(vierge.features, []);
  assert.equal(vierge.description, 'La première ouverture : rien de choisi, rien de réglé.');
  assert.deepEqual(vierge.moments.map((moment) => moment.shows), ['La première ouverture : les trois façons de commencer, et rien de réglé.']);
  for (const profile of DEMO_PROFILES) {
    for (const text of [profile.description, ...profile.moments.map((moment) => moment.shows)]) {
      assert.doesNotMatch(text, /à cocher|rien de coché/, profile.id);
    }
  }
});

test('le « ? » de « Ma ferme » dit les lignes d’état des fiches et la mise en route en tête', () => {
  const help = pageHelp('ma-ferme');
  assert.match(help.reading, /dit en une ligne où elle en est, comme « 4 goutte-à-goutte, tous posés »/);
  assert.match(help.reading, /voit sa mise en route en tête/);
  assert.match(help.firstStep, /^Suivez la mise en route si elle est en tête, ou touchez une fiche « À faire »/);
  assert.doesNotMatch(help.reading, /à quoi elle sert/);
});
