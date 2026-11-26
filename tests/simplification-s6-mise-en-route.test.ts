import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { FEATURE_IDS, type FeatureId } from '../lib/domain/features/catalogue.ts';
import { isCompleteSelection } from '../lib/domain/features/selection.ts';
import { startWaySelection } from '../lib/domain/features/start.ts';
import { farmObjectiveScopeText } from '../lib/domain/farm-objective.ts';
import {
  continueLabel,
  routeCardVisible,
  routeProgressText,
  routeReadNeeded,
  routeStepCountText,
  routeStepsFor,
  startRoute,
  todayRouteBlock,
  whatFollowsText,
  type RouteCounts,
  type RouteStep,
  type StartRoute,
} from '../lib/domain/onboarding/route.ts';
import { unfinishedSteps } from '../lib/domain/onboarding/steps.ts';
import { TECHNICAL_WORDS } from '../lib/domain/simple-words.ts';

/**
 * Simplifier l'usage du module, lot S6, PR 2 : la mise en route
 * (docs/simplification-s6-contract.md, sections 5, 6, 8 et 14 ; D-336, suite).
 * Les règles qui se lisent sans base : les étapes, leurs états, la carte, le
 * bloc d'« Aujourd'hui ». La lecture, l'écriture de l'état de la carte et les
 * deux fermes sont dans `tests/db/simplification-s6-mise-en-route.test.ts`.
 */

/** Une ferme neuve : rien de décrit, cinq parcelles, dix-huit planches. */
const EMPTY: RouteCounts = {
  equipment: { drip: 0, sprinkler: 0, withoutSetting: 0 },
  placement: { watered: 0, total: 18 },
  water: { names: [], total: 0 },
  objective: { withObjective: 0, total: 18 },
  soil: { withoutSoil: 6, total: 6, anchor: 'soil-parcel-z1' },
};

/** La même ferme, tout décrit. */
const FULL: RouteCounts = {
  equipment: { drip: 4, sprinkler: 0, withoutSetting: 0 },
  placement: { watered: 10, total: 18 },
  water: { names: ['Bassin', 'Puits'], total: 2 },
  objective: { withObjective: 18, total: 18 },
  soil: { withoutSoil: 0, total: 6, anchor: null },
};

const ALL = [...FEATURE_IDS];

function route(counts: Partial<RouteCounts>, options: { enabled?: readonly FeatureId[]; routeState?: 'later' | 'done' | null; startMode?: 'all' | 'notes' | 'proposals' | 'custom' | null } = {}): StartRoute {
  return startRoute({
    startMode: options.startMode === undefined ? 'all' : options.startMode,
    routeState: options.routeState ?? null,
    enabled: options.enabled ?? ALL,
    counts: { ...EMPTY, ...counts },
  });
}

function card(value: StartRoute): Extract<StartRoute, { kind: 'card' }> {
  assert.equal(value.kind, 'card');
  return value as Extract<StartRoute, { kind: 'card' }>;
}

function step(value: StartRoute, id: RouteStep['id']): RouteStep {
  const found = card(value).steps.find((candidate) => candidate.id === id);
  assert.ok(found, id);
  return found;
}

/** Toutes les parties des onze cases que la fermeture de la 3.8 accepte (R3). */
function validSelections(): FeatureId[][] {
  const selections: FeatureId[][] = [];
  for (let mask = 1; mask < 1 << FEATURE_IDS.length; mask += 1) {
    const subset = FEATURE_IDS.filter((_, index) => mask & (1 << index));
    if (isCompleteSelection(subset)) selections.push(subset);
  }
  return selections;
}

test('section 5.1 : une ferme neuve, cinq étapes, la première en cours, ce qu’elle débloque, « Continuer l’étape 1 »', () => {
  const value = card(route({}));
  assert.deepEqual(value.steps.map((item) => [item.number, item.label, item.status]), [
    [1, 'Mon matériel', 'current'],
    [2, 'Où il est posé', 'todo'],
    [3, 'D’où vient l’eau', 'todo'],
    [4, 'Combien je vise par semaine', 'todo'],
    [5, 'Mon sol', 'todo'],
  ]);
  assert.equal(value.progress, '0 étape sur 5');
  assert.equal(value.done, 0);
  assert.equal(value.foldDone, false);
  const current = value.current;
  assert.ok(current);
  assert.equal(current.line, 'Aucun matériel pour l’instant.');
  assert.equal(current.unlocks, 'Après cette étape, vous pouvez noter un arrosage.');
  assert.deepEqual(current.link, { page: 'materiel', tab: 'materiel', anchor: 'equipment-title' });
  assert.equal(continueLabel(current), 'Continuer l’étape 1');
  // Ce qu'elles débloquent n'est dit que pour l'étape en cours.
  assert.deepEqual(value.steps.filter((item) => item.unlocks !== null).map((item) => item.id), ['equipment']);
  // L'étape 4 attend l'étape 2 : elle ne mène nulle part avant, et le dit.
  assert.equal(step(route({}), 'objective').line, 'Posez d’abord le matériel sur vos planches.');
  assert.equal(step(route({}), 'objective').link, null);
});

test('section 5.1 : chaque étape faite dit ce qui existe, avec les comptes de la ferme', () => {
  const value = route({
    equipment: { drip: 2, sprinkler: 1, withoutSetting: 3 },
    placement: { watered: 1, total: 18 },
    water: { names: ['Bassin', 'Puits'], total: 3 },
    objective: { withObjective: 7, total: 10 },
    soil: { withoutSoil: 2, total: 6, anchor: 'soil-parcel-z4' },
  });
  assert.equal(step(value, 'equipment').line, '2 goutte-à-goutte et 1 aspersion');
  assert.equal(step(value, 'placement').line, '1 planche arrosée sur 18');
  assert.equal(step(value, 'water').line, 'Bassin, Puits et 1 autre');
  // L'étape 4 en cours : ce qui manque, compté par la fonction de l'objectif de la ferme.
  const objective = step(value, 'objective');
  assert.equal(objective.status, 'current');
  assert.equal(objective.line, '3 planches n’ont pas encore d’eau visée.');
  assert.deepEqual(objective.link, { page: 'semaine', anchor: 'objectifs-de-la-semaine' });
  // L'étape 5 à faire dit ce qui existe déjà, et mène à la première parcelle sans sol.
  assert.equal(step(value, 'soil').line, 'sol de 4 parcelles saisi');
  assert.deepEqual(step(value, 'soil').link, { page: 'sol', anchor: 'soil-parcel-z4' });

  assert.equal(step(route({ equipment: { drip: 4, sprinkler: 0, withoutSetting: 0 } }), 'equipment').line, '4 goutte-à-goutte');
  assert.equal(step(route({ equipment: { drip: 0, sprinkler: 2, withoutSetting: 0 } }), 'equipment').line, '2 aspersions');
  assert.equal(step(route({ ...FULL, objective: { withObjective: 9, total: 10 } }), 'water').line, 'Bassin et Puits');
  assert.equal(step(route({ ...FULL, objective: { withObjective: 9, total: 10 }, water: { names: ['Puits'], total: 1 } }), 'water').line, 'Puits');
  // « ferme entière », la phrase d'« Aujourd'hui » (S6-i).
  assert.equal(step(route({ ...FULL, soil: { withoutSoil: 1, total: 6, anchor: 'soil-parcel-z6' } }), 'objective').line, farmObjectiveScopeText({ withObjective: 18, total: 18 }));
  assert.equal(step(route({ ...FULL, soil: { withoutSoil: 1, total: 6, anchor: 'soil-parcel-z6' } }), 'objective').line, 'ferme entière');
});

test('section 5.1 : ce qui manque à l’étape en cours, cas par cas (section 12)', () => {
  assert.equal(route({ equipment: { drip: 0, sprinkler: 0, withoutSetting: 1 } }).kind, 'card');
  assert.equal(step(route({ equipment: { drip: 0, sprinkler: 0, withoutSetting: 1 } }), 'equipment').line, 'Un matériel n’a pas encore de réglage.');
  assert.equal(step(route({ equipment: { drip: 0, sprinkler: 0, withoutSetting: 2 } }), 'equipment').line, '2 matériels n’ont pas encore de réglage.');
  const posed = { equipment: FULL.equipment };
  assert.equal(step(route(posed), 'placement').line, 'Aucune planche n’a encore de matériel posé.');
  assert.deepEqual(step(route(posed), 'placement').link, { page: 'materiel', anchor: 'farm-plan' });
  // Aucune planche dans Ouvre ta ferme : l'étape 2 mène au plan que le module lit, la phrase dit où les ajouter ; 4 et 5 attendent.
  const empty = route({ ...posed, placement: { watered: 0, total: 0 }, objective: { withObjective: 0, total: 0 }, soil: { withoutSoil: 0, total: 0, anchor: null } });
  assert.equal(step(empty, 'placement').status, 'current');
  assert.equal(step(empty, 'placement').line, 'Aucune planche dans votre plan. Ajoutez-les dans Ouvre ta ferme.');
  assert.equal(step(empty, 'objective').line, 'Posez d’abord le matériel sur vos planches.');
  assert.equal(step(empty, 'soil').status, 'todo');
  assert.equal(step(empty, 'soil').line, 'Aucune parcelle dans votre plan. Ajoutez-les dans Ouvre ta ferme.');
  assert.equal(step(empty, 'soil').link, null);
  // Une ressource sans volume est une ressource : l'étape est faite (section 12).
  assert.equal(step(route({ water: { names: ['Puits'], total: 1 } }), 'water').status, 'done');
  // Le sol : le texte du bandeau « À finir », la même ancre (S6-i).
  const soil = step(route({ ...FULL, soil: { withoutSoil: 4, total: 6, anchor: 'soil-parcel-z3' } }), 'soil');
  const banner = unfinishedSteps({ kind: 'onboarding', remaining: [], steps: [] } as never, { weather: false, plotsToClassify: 0, soilToEnter: { parcels: 4, anchor: 'soil-parcel-z3' } });
  assert.equal(banner[0]?.text, 'sol de 4 parcelles');
  assert.equal(soil.line, 'Sol de 4 parcelles à saisir.');
  assert.ok(soil.line?.toLowerCase().includes(banner[0]?.text ?? '∅'));
  assert.equal(soil.link?.anchor, banner[0]?.anchor);
});

test('section 5.1 : rien n’oblige à l’ordre ; une étape faite plus loin est dite faite ; l’étape en cours est la première non faite', () => {
  const value = route({ water: { names: ['Puits'], total: 1 }, soil: { withoutSoil: 0, total: 6, anchor: null } });
  assert.deepEqual(card(value).steps.map((item) => item.status), ['current', 'todo', 'done', 'todo', 'done']);
  assert.equal(card(value).progress, '2 étapes sur 5');
  // Le matériel posé, l'étape 4 n'attend plus : chaque ligne à faire est un lien.
  const later = route({ equipment: FULL.equipment, placement: FULL.placement });
  assert.equal(card(later).current?.id, 'water');
  assert.deepEqual(step(later, 'objective').link, { page: 'semaine', anchor: 'objectifs-de-la-semaine' });
  // Une étape qui attend n'est jamais en cours : la suivante l'est.
  const waiting = route({ equipment: FULL.equipment, water: FULL.water, placement: { watered: 0, total: 0 }, objective: { withObjective: 0, total: 0 } }, { enabled: ['arrosages', 'besoins', 'ressources', 'materiel'] });
  assert.deepEqual(card(waiting).steps.map((item) => [item.id, item.status]), [['equipment', 'done'], ['placement', 'current'], ['water', 'done'], ['objective', 'todo']]);
});

test('section 6 : un compte inconnu est « à vérifier », jamais fait ni à zéro (D-003) ; tout inconnu, la carte est omise', () => {
  // Le matériel et sa pose se lisent ensemble : un échec les rend inconnus tous deux.
  const value = route({ equipment: null, placement: null, water: null });
  assert.equal(step(value, 'equipment').status, 'unknown');
  assert.equal(step(value, 'placement').status, 'unknown');
  assert.equal(step(value, 'equipment').line, 'À vérifier : ce compte n’a pas pu être lu.');
  assert.equal(step(value, 'water').status, 'unknown');
  // Le matériel inconnu : l'étape 4 n'attend pas une étape qu'on ne sait pas lire ; elle est en cours.
  assert.equal(card(value).current?.id, 'objective');
  assert.equal(card(value).done, 0);
  // Inconnu n'est jamais compté fait : « Terminer » ne vient pas.
  const almost = route({ ...FULL, soil: null });
  assert.equal(almost.kind, 'card');
  assert.equal(card(almost).current, null);
  assert.equal(card(almost).progress, '4 étapes sur 5');
  assert.deepEqual(route({ equipment: null, placement: null, water: null, objective: null, soil: null }), { kind: 'unreadable' });
});

test('section 5.2 : le total est celui des étapes qui existent ; la phrase de la première ouverture compte les mêmes', () => {
  assert.equal(card(route({}, { enabled: startWaySelection('notes'), startMode: 'notes' })).progress, '0 étape sur 2');
  assert.equal(card(route({}, { enabled: startWaySelection('proposals'), startMode: 'proposals' })).progress, '0 étape sur 4');
  for (const selection of validSelections()) {
    const value = route({}, { enabled: selection, startMode: 'custom' });
    const steps = routeStepsFor(selection);
    if (steps.length === 0) {
      assert.deepEqual(value, { kind: 'none' }, selection.join(','));
      continue;
    }
    assert.equal(card(value).total, steps.length, selection.join(','));
    // « Ensuite, quatre étapes… » et « 0 étape sur 4 » : le même nombre, d'une seule fonction.
    assert.ok(whatFollowsText(selection).includes(routeStepCountText(card(value).total)), selection.join(','));
  }
});

test('section 5.2 : les étapes faites se replient dès trois ; le pli ne cache jamais l’étape en cours', () => {
  assert.equal(card(route({ equipment: FULL.equipment, placement: FULL.placement })).foldDone, false);
  const three = card(route({ equipment: FULL.equipment, placement: FULL.placement, water: FULL.water }));
  assert.equal(three.foldDone, true);
  assert.equal(three.current?.status, 'current');
  const four = card(route({ ...FULL, soil: { withoutSoil: 3, total: 6, anchor: 'soil-parcel-z4' } }));
  assert.equal(four.foldDone, true);
  assert.equal(four.progress, '4 étapes sur 5');
  assert.equal(four.current?.id, 'soil');
});

test('section 5.3 : les états de la carte, de la ferme d’avant S6 à « Terminer »', () => {
  assert.deepEqual(route({}, { startMode: null }), { kind: 'none' }, 'ferme d’avant S6 : rien, jamais');
  assert.deepEqual(route(FULL, { startMode: null }), { kind: 'none' });
  assert.deepEqual(route({}, { routeState: 'done' }), { kind: 'none' }, 'terminée : rien, même si une étape redevient fausse (S6-k)');
  assert.deepEqual(route({}, { routeState: 'later' }), { kind: 'later', progress: '0 étape sur 5' });
  assert.deepEqual(route({ equipment: FULL.equipment, placement: FULL.placement, water: FULL.water }, { routeState: 'later' }), { kind: 'later', progress: '3 étapes sur 5' });
  assert.deepEqual(route(FULL), { kind: 'complete', total: 5, progress: '5 étapes sur 5' });
  assert.deepEqual(route({}, { enabled: ['alertes-meteo'], startMode: 'custom' }), { kind: 'none' }, 'aucune étape : pas de carte');
  // Une case décochée retire son étape (S6-e) : la ferme sans « Réserve du sol », sol inconnu, est décrite.
  assert.deepEqual(route({ ...FULL, soil: null }, { enabled: ALL.filter((id) => id !== 'sol') }), { kind: 'complete', total: 4, progress: '4 étapes sur 4' });
  assert.equal(routeProgressText(1, 2), '1 étape sur 2');
  assert.equal(routeCardVisible(route({})), true);
  assert.equal(routeCardVisible(route(FULL)), true);
  assert.equal(routeCardVisible(route({}, { routeState: 'later' })), false);
  assert.equal(routeCardVisible(null), false);
});

test('section 6 : la lecture, seulement sur « Ma ferme » et « Aujourd’hui », seulement quand la carte existe', () => {
  const fresh = { startMode: 'all' as const, routeState: null, enabled: ALL };
  assert.equal(routeReadNeeded('ma-ferme', fresh), true);
  assert.equal(routeReadNeeded('aujourdhui', fresh), true);
  for (const page of ['reglages', 'materiel', 'semaine', 'arrosages', 'sol', 'ressources'] as const) assert.equal(routeReadNeeded(page, fresh), false, page);
  assert.equal(routeReadNeeded('ma-ferme', { ...fresh, startMode: null }), false);
  assert.equal(routeReadNeeded('ma-ferme', { ...fresh, routeState: 'done' }), false);
  assert.equal(routeReadNeeded('ma-ferme', { ...fresh, routeState: 'later' }), true, 'la ligne « Reprendre » compte les étapes');
  assert.equal(routeReadNeeded('aujourdhui', { ...fresh, routeState: 'later' }), false, 'pas de bloc quand la carte est remise');
  assert.equal(routeReadNeeded('ma-ferme', { ...fresh, enabled: ['alertes-meteo'] }), false);
});

test('section 8 : le bloc d’« Aujourd’hui » dit l’étape en cours de la carte, la même, avec son lien', () => {
  const value = route({ equipment: FULL.equipment, placement: FULL.placement, water: FULL.water, objective: { withObjective: 15, total: 18 } });
  const block = todayRouteBlock(value, ALL);
  assert.deepEqual(block, {
    title: 'Votre ferme n’est pas encore prête à proposer des arrosages.',
    sentence: 'Combien vous visez par semaine : 3 planches n’ont pas encore d’eau visée.',
    label: 'Continuer l’étape 4',
    link: { page: 'semaine', anchor: 'objectifs-de-la-semaine' },
  });
  // La même étape que la carte : son numéro, son lien, ce qui lui manque.
  const current = card(value).current;
  assert.equal(block?.label, continueLabel(current as RouteStep));
  assert.deepEqual(block?.link, current?.link);
  assert.ok(block?.sentence.endsWith(current?.missing ?? '∅'));
  // La première façon ne propose rien : sa ferme n'est « pas encore décrite ».
  const notes = todayRouteBlock(route({}, { enabled: startWaySelection('notes'), startMode: 'notes' }), startWaySelection('notes'));
  assert.deepEqual(notes, {
    title: 'Votre ferme n’est pas encore décrite.',
    sentence: 'Votre matériel : aucun matériel pour l’instant.',
    label: 'Continuer l’étape 1',
    link: { page: 'materiel', tab: 'materiel', anchor: 'equipment-title' },
  });
  for (const value2 of [route(FULL), route({}, { routeState: 'later' }), route({}, { startMode: null }), route({ ...FULL, soil: null })]) {
    assert.equal(todayRouteBlock(value2, ALL), null, value2.kind);
  }
  assert.equal(todayRouteBlock(null, ALL), null);
});

test('section 14 : aucun mot du calcul dans aucune phrase de la mise en route (test de garde de S1)', () => {
  const phrases = new Set<string>();
  const cases: Partial<RouteCounts>[] = [
    {}, FULL, { equipment: { drip: 0, sprinkler: 0, withoutSetting: 2 } },
    { equipment: FULL.equipment, placement: { watered: 0, total: 0 }, objective: { withObjective: 0, total: 0 }, soil: { withoutSoil: 0, total: 0, anchor: null } },
    { equipment: FULL.equipment, placement: FULL.placement, water: FULL.water, objective: { withObjective: 3, total: 18 } },
    { ...FULL, soil: { withoutSoil: 2, total: 6, anchor: 'soil-parcel-z1' } }, { equipment: null },
  ];
  for (const counts of cases) {
    const value = route(counts);
    if (value.kind === 'card') {
      for (const item of value.steps) [item.label, item.yourLabel, item.line, item.missing, item.unlocks].forEach((text) => text && phrases.add(text));
    }
    const block = todayRouteBlock(value, ALL);
    if (block) [block.title, block.sentence, block.label].forEach((text) => phrases.add(text));
  }
  assert.ok(phrases.size > 30, `${phrases.size} phrases relues`);
  for (const phrase of phrases) {
    for (const word of TECHNICAL_WORDS) assert.ok(!phrase.includes(word), `« ${phrase} » contient « ${word} »`);
    assert.doesNotMatch(phrase, /\b0 planche|\bzéro\b|undefined|null|NaN/, phrase);
  }
});

test('interface : la carte, sa barre en image, ses cibles ; le bandeau « À finir » non répété sur « Ma ferme » seulement', () => {
  const page = readFileSync('app/irrigation/ma-ferme/page.tsx', 'utf8');
  assert.match(page, /unfinished=\{routeCardVisible\(context\.route\) \? \[\] : context\.shell\.unfinished\}/);
  // Les fiches gardent « À faire » : leur ligne vient toujours de l'accueil de la ferme.
  assert.match(page, /farmCards\(context\.enabled, context\.shell\.unfinished\)/);
  assert.match(page, /context\.startMode !== null \? <StartRouteCard/);
  const component = readFileSync('app/irrigation/pages/start-route-card.tsx', 'utf8');
  assert.match(component, /className="start-route-bar" role="img" aria-label=\{route\.progress\}/);
  assert.match(component, /role="img" aria-label=\{STATUS_WORDS\[step\.status\]\}/);
  assert.match(component, /done: 'fait'/);
  assert.match(component, /saveRouteStateAction\(\{ gesture: choice \}\)/);
  assert.match(component, /router\.refresh\(\)/);
  const css = readFileSync('app/irrigation/styles/mise-en-route.css', 'utf8');
  assert.match(css, /\.start-route-step-link \{[^}]*min-height: var\(--touch-target\);/);
  assert.match(css, /\.start-route \.start-route-continue \{[^}]*min-height: 48px;/);
  assert.match(css, /\.start-route-link \{[^}]*min-height: var\(--touch-target\);/);
  // Le bandeau reste sur toute autre page : le gabarit ne le retire nulle part ailleurs.
  const shell = readFileSync('app/irrigation/shell/irrigation-shell.tsx', 'utf8');
  assert.match(shell, /<UnfinishedBanner steps=\{unfinished\}/);
  // « Aujourd'hui » : le bloc seulement quand aucune carte d'arrosage n'est à montrer.
  const day = readFileSync('app/irrigation/today/today-day.tsx', 'utf8');
  assert.match(day, /\{nothing && routeBlock \? \(/);
  assert.match(readFileSync('app/irrigation/aujourdhui/page.tsx', 'utf8'), /routeBlock=\{todayRouteBlock\(context\.route, context\.enabled\)\}/);
});
