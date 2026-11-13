import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { DEMO_PROFILES } from '../lib/domain/demo/catalogue.ts';
import {
  availableTours,
  isTourAvailable,
  nextAvailableTour,
  parsePosition,
  parseSeenTours,
  playableStep,
  serializePosition,
  stepCount,
  stepPage,
  withSeenTour,
  type TourContext,
} from '../lib/domain/demo/tour-engine.ts';
import { TOUR_ANCHORS, TOURS, tourById, type TourPage } from '../lib/domain/demo/tours.ts';
import { isIrrigationPageId, menuPages } from '../lib/domain/features/pages.ts';
import { farm, largeFarm } from './support/planning-fixtures.ts';

/**
 * Les visites guidées de la démonstration (docs/demo-guided-contract.md,
 * section 7 ; D3, D-105) : le contenu des sept visites, leurs points
 * d'ancrage dans le code des écrans, et le déroulé sans navigateur. Les
 * parcours navigateur (e2e-demo/) les jouent ensuite pour de vrai.
 */

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const full = path.join(directory, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

const APP_SOURCE = sourceFiles('app').map((file) => readFileSync(file, 'utf8')).join('\n');

/** Le menu de chaque ferme fictive, tel que le module le bâtit ; la ferme vierge est sur la première ouverture. */
function contextOf(profileId: string, current?: TourPage): TourContext {
  const profile = DEMO_PROFILES.find((item) => item.id === profileId)!;
  if (profile.features.length === 0) return { current: current ?? 'bienvenue', reachable: ['bienvenue'] };
  const menu = menuPages(profile.features);
  return { current: current ?? menu[0], reachable: menu };
}

// --- Le contenu -------------------------------------------------------------

test('les sept visites du contrat, dans son ordre, de deux à quatre minutes', () => {
  assert.deepEqual(TOURS.map((tour) => tour.title), [
    'Bienvenue',
    'Un arrosage de A à Z',
    'Le planning',
    'Quand l’eau manque',
    'Les alertes',
    'Le module à la carte',
    'Et pour ma ferme ?',
  ]);
  assert.equal(new Set(TOURS.map((tour) => tour.id)).size, TOURS.length);
  for (const tour of TOURS) {
    assert.ok(tour.minutes >= 2 && tour.minutes <= 4, tour.id);
    assert.ok(tour.steps.length >= 2 && tour.steps.length <= 7, `${tour.id} : ${tour.steps.length} étapes`);
  }
});

test('chaque repère des visites est posé dans le code des écrans par data-tour, et chaque repère posé sert', () => {
  for (const anchor of TOUR_ANCHORS) {
    assert.ok(APP_SOURCE.includes(`data-tour="${anchor}"`), `data-tour="${anchor}" absent de app/`);
  }
  const used = new Set(TOURS.flatMap((tour) => tour.steps.map((step) => step.anchor)).filter(Boolean));
  assert.deepEqual(TOUR_ANCHORS.filter((anchor) => !used.has(anchor)), []);
  const placed = [...APP_SOURCE.matchAll(/data-tour="([a-z-]+)"/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(placed)].filter((anchor) => !(TOUR_ANCHORS as readonly string[]).includes(anchor)), []);
});

test('chaque page d’étape existe, et la visite « Et pour ma ferme ? » est du texte seul', () => {
  for (const tour of TOURS) {
    for (const step of tour.steps) {
      for (const page of step.pages ?? []) assert.ok(page === 'bienvenue' || isIrrigationPageId(page), `${tour.id} : page ${page}`);
    }
  }
  assert.ok(tourById('ma-ferme')!.steps.every((step) => !step.anchor && !step.pages));
});

const TEXTS = TOURS.flatMap((tour) => [tour.title, tour.summary, tour.bestWith ?? '', ...tour.steps.flatMap((step) => [step.title, step.text])]);

test('des textes courts, sans emoji ni sigle laissé sans son sens', () => {
  for (const tour of TOURS) {
    for (const step of tour.steps) {
      assert.ok(step.title.length <= 50, `titre trop long : ${step.title}`);
      assert.ok(step.text.length <= 320, `texte trop long (${step.text.length}) : ${step.title}`);
    }
  }
  for (const text of TEXTS) {
    assert.doesNotMatch(text, /\p{Extended_Pictographic}/u, text);
    // Le Kc, la RFU, le K_abri, l'ETP : la visite dit les choses en clair (contrat, section 7).
    assert.doesNotMatch(text, /\b(Kc|RFU|K_abri|ETP|ET0|OTF|D1|D4)\b/, text);
  }
});

const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[’']/g, ' ').replace(/\s+/g, ' ').trim();

test('couche 4 : aucun nom de la ferme réelle dans les visites', () => {
  const real = new Set<string>(['Clémentière', 'Champ de l’Aurore', 'Tunnel 1']);
  const collect = (value: unknown, key = ''): void => {
    if (typeof value === 'string' && /name$/i.test(key)) real.add(value);
    else if (Array.isArray(value)) value.forEach((item) => collect(item, key));
    else if (value && typeof value === 'object') Object.entries(value).forEach(([childKey, child]) => collect(child, childKey));
  };
  collect(farm({ extraTunnels: true }));
  collect(largeFarm());
  const realNames = [...real].map(normalize).filter((name) => name.length > 3);
  const offending = TEXTS.filter((text) => {
    const normalized = normalize(text);
    const words = new Set(normalized.split(/[\s-]+/));
    return realNames.some((name) => (name.includes(' ') ? normalized.includes(name) : words.has(name)));
  });
  assert.deepEqual(offending, []);
});

// --- Le déroulé ------------------------------------------------------------

test('une étape se joue sur la page ouverte quand elle convient, sinon sur la première que la ferme peut ouvrir', () => {
  const step = { pages: ['reglages', 'bienvenue'] as const, title: 't', text: 't' };
  assert.equal(stepPage(step, { current: 'bienvenue', reachable: [] }), 'bienvenue');
  assert.equal(stepPage(step, { current: 'aujourdhui', reachable: ['aujourdhui', 'reglages'] }), 'reglages');
  assert.equal(stepPage({ pages: ['planning'], title: 't', text: 't' }, { current: 'aujourdhui', reachable: ['aujourdhui'] }), null);
  assert.equal(stepPage({ title: 't', text: 't' }, { current: 'materiel', reachable: [] }), 'materiel');
});

test('une étape d’une page non cochée est sautée, dans les deux sens', () => {
  const penurie = tourById('penurie')!;
  const petite = contextOf('petite-ferme', 'aujourdhui');
  // Ni « Ressources et pompes » ni « Planning » : seule l'eau d'« Aujourd'hui » se joue.
  assert.deepEqual(playableStep(penurie, 0, 1, petite), { index: 0, page: 'aujourdhui' });
  assert.equal(playableStep(penurie, 1, 1, petite), null);
  assert.deepEqual(playableStep(penurie, 4, -1, petite), { index: 0, page: 'aujourdhui' });
  const full = contextOf('maraichage', 'aujourdhui');
  assert.deepEqual(playableStep(penurie, 1, 1, full), { index: 1, page: 'ressources' });
});

test('les visites offertes à chaque ferme fictive', () => {
  const offered = (profileId: string) => availableTours(contextOf(profileId)).map((tour) => tour.id);
  assert.deepEqual(offered('maraichage'), ['bienvenue', 'arrosage', 'planning', 'penurie', 'alertes', 'a-la-carte', 'ma-ferme']);
  assert.deepEqual(offered('petite-ferme'), ['bienvenue', 'arrosage', 'a-la-carte', 'ma-ferme']);
  assert.deepEqual(offered('vannes-alertes'), ['bienvenue', 'alertes', 'a-la-carte', 'ma-ferme']);
  assert.deepEqual(offered('vierge'), ['bienvenue', 'a-la-carte', 'ma-ferme']);
  assert.equal(isTourAvailable(tourById('planning')!, contextOf('vierge')), false);
});

test('« Passer » mène à la visite offerte suivante, et à rien après la dernière', () => {
  const vierge = contextOf('vierge');
  assert.equal(nextAvailableTour('bienvenue', vierge)?.id, 'a-la-carte');
  assert.equal(nextAvailableTour('ma-ferme', vierge), null);
  assert.equal(nextAvailableTour('planning', contextOf('maraichage'))?.id, 'penurie');
});

test('« étape n sur N » ne compte que les étapes que la ferme peut voir', () => {
  const carte = tourById('a-la-carte')!;
  const vierge = contextOf('vierge');
  // Sur la première ouverture, le menu n'existe pas : la troisième étape sera sautée.
  const noMenu = (step: { anchor?: string }) => step.anchor !== 'menu';
  assert.deepEqual(stepCount(carte, 1, vierge, noMenu), { rank: 2, total: 2 });
  assert.deepEqual(stepCount(carte, 0, contextOf('maraichage', 'reglages')), { rank: 1, total: 3 });
  // Une étape d'une autre page compte d'avance.
  assert.deepEqual(stepCount(tourById('penurie')!, 0, contextOf('maraichage', 'aujourdhui'), () => false), { rank: 1, total: 5 });
});

test('l’étape rangée se relit telle quelle ; une valeur abîmée ne reprend rien', () => {
  assert.deepEqual(parsePosition(serializePosition({ tour: 'penurie', step: 3 })), { tour: 'penurie', step: 3 });
  for (const raw of [null, '', 'penurie', 'penurie.9', 'inconnue.0', 'penurie.-1', 'penurie.1.2', '<script>.0']) {
    assert.equal(parsePosition(raw), null, String(raw));
  }
  assert.deepEqual(parseSeenTours('bienvenue,inconnue,planning'), ['bienvenue', 'planning']);
  assert.deepEqual(parseSeenTours(null), []);
  assert.deepEqual(withSeenTour(['bienvenue'], 'bienvenue'), ['bienvenue']);
  assert.deepEqual(withSeenTour(['bienvenue'], 'planning'), ['bienvenue', 'planning']);
});
