import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { FEATURE_IDS, type FeatureId } from '../lib/domain/features/catalogue.ts';
import { landingPage } from '../lib/domain/features/pages.ts';
import { isCompleteSelection, resolveFeatureSelection, withRequirements } from '../lib/domain/features/selection.ts';
import {
  CHOOSE_MYSELF_LABEL,
  START_WAYS,
  WELCOME_HEADING,
  WELCOME_INTRO,
  firstArrivalPage,
  startWaySelection,
  startedWithText,
} from '../lib/domain/features/start.ts';
import { START_WAY_IDS, isStartWay, storedRouteState, storedStartMode } from '../lib/domain/features/start-mode.ts';
import { routeStepCountText, routeStepsFor, whatFollowsText } from '../lib/domain/onboarding/route.ts';
import { TECHNICAL_WORDS } from '../lib/domain/simple-words.ts';

/**
 * Simplifier l'usage du module, lot S6, PR 1 : les trois façons de commencer
 * (docs/simplification-s6-contract.md, sections 3, 4, 9 et 14 ; D-336). Les
 * règles qui se lisent sans base ; l'enregistrement, l'isolation et la
 * migration sont dans `tests/db/simplification-s6-trois-facons.test.ts`.
 */

/** Toutes les parties des onze cases que la fermeture de la 3.8 accepte (R3) : les choix valides de « Choisir moi-même ». */
function validSelections(): FeatureId[][] {
  const selections: FeatureId[][] = [];
  for (let mask = 1; mask < 1 << FEATURE_IDS.length; mask += 1) {
    const subset = FEATURE_IDS.filter((_, index) => mask & (1 << index));
    if (isCompleteSelection(subset)) selections.push(subset);
  }
  return selections;
}

test('section 3.1 : chaque façon coche exactement ses cases et celles dont elles ont besoin (S6-c)', () => {
  assert.deepEqual(START_WAYS.map((way) => way.id), [...START_WAY_IDS]);
  assert.deepEqual(startWaySelection('notes'), ['arrosages', 'materiel', 'historique']);
  assert.deepEqual(startWaySelection('proposals'), ['arrosages', 'planning', 'besoins', 'materiel', 'ressources', 'historique']);
  assert.deepEqual(startWaySelection('all'), [...FEATURE_IDS], 'les onze cases');
  for (const way of START_WAYS) {
    const selection = startWaySelection(way.id);
    assert.deepEqual(selection, withRequirements(way.checks), `${way.id} : la fermeture de la 3.8`);
    assert.ok(isCompleteSelection(selection), `${way.id} : un choix que la base accepte`);
    for (const id of way.checks) assert.ok(selection.includes(id), `${way.id} coche ${id}`);
  }
});

test('section 3.1 : les noms et les phrases de la maquette ; « Conseillé » désigne la deuxième façon, une seule', () => {
  assert.deepEqual(START_WAYS.map((way) => way.name), ['Je note mes arrosages', 'Le module me propose quoi arroser', 'Tout : sol, cultures et alertes']);
  assert.deepEqual(START_WAYS.filter((way) => way.recommended).map((way) => way.id), ['proposals']);
  assert.equal(WELCOME_HEADING, 'Comment voulez-vous commencer ?');
  assert.equal(WELCOME_INTRO, 'Choisissez ce qui vous ressemble. Vous pourrez changer à tout moment, sans rien perdre.');
  assert.equal(CHOOSE_MYSELF_LABEL, 'Choisir moi-même les fonctionnalités');
  // Aucun mot du calcul (test de garde de S1, section 3.2).
  const texts = [WELCOME_HEADING, WELCOME_INTRO, ...START_WAYS.flatMap((way) => [way.name, way.text])];
  for (const text of texts) {
    for (const word of [...TECHNICAL_WORDS, 'RFU', 'ET0', 'ETM', 'objectif hydrique', 'Kc']) assert.ok(!text.includes(word), `« ${word} » dans « ${text} »`);
  }
});

test('section 3.3 : la phrase qui dit ce qui suit le choix, le nombre tiré des étapes (S6-b)', () => {
  assert.equal(whatFollowsText(null), 'Ensuite, quelques étapes pour décrire votre ferme, en plusieurs fois si vous voulez.');
  assert.equal(whatFollowsText(startWaySelection('notes')), 'Ensuite, deux étapes pour décrire votre ferme : le matériel et où il est posé. En plusieurs fois si vous voulez.');
  assert.equal(
    whatFollowsText(startWaySelection('proposals')),
    'Ensuite, quatre étapes pour décrire votre ferme : le matériel, où il est posé, d’où vient l’eau et combien vous visez. En plusieurs fois si vous voulez.',
  );
  assert.equal(
    whatFollowsText(startWaySelection('all')),
    'Ensuite, cinq étapes pour décrire votre ferme : le matériel, où il est posé, d’où vient l’eau, combien vous visez et votre sol. En plusieurs fois si vous voulez.',
  );
  assert.equal(whatFollowsText(['alertes-meteo']), whatFollowsText(null), 'des cases sans étape ne promettent pas de nombre');
  assert.equal(routeStepCountText(1), 'une étape');
  assert.equal(routeStepCountText(3), 'trois étapes');
});

test('section 5.1 : une étape existe quand sa case est cochée, pour chaque choix valide des onze cases ; la phrase de l’écran et le total de la carte ne divergent pas', () => {
  const selections = validSelections();
  assert.ok(selections.length > 100, `${selections.length} choix valides`);
  const seen = new Set<string>();
  for (const selection of selections) {
    const steps = routeStepsFor(selection).map((step) => step.id);
    const expected = [
      ...(selection.includes('materiel') ? ['equipment', 'placement'] : []),
      ...(selection.includes('ressources') ? ['water'] : []),
      ...(selection.includes('besoins') ? ['objective'] : []),
      ...(selection.includes('sol') ? ['soil'] : []),
    ];
    assert.deepEqual(steps, expected, selection.join(','));
    seen.add(steps.join(','));
    // La phrase de la première ouverture compte les mêmes étapes que la carte.
    if (steps.length > 0) assert.ok(whatFollowsText(selection).startsWith(`Ensuite, ${routeStepCountText(steps.length)} pour décrire`), selection.join(','));
    // La première arrivée : « Ma ferme » quand la mise en route a une étape, sinon la page d'arrivée de F31.
    assert.equal(firstArrivalPage(selection), steps.length > 0 ? 'ma-ferme' : landingPage(selection), selection.join(','));
  }
  // Toute case d'étape demande le matériel : les étapes 1 et 2 viennent toujours en tête.
  assert.deepEqual([...seen].sort(), [
    '',
    'equipment,placement',
    'equipment,placement,objective',
    'equipment,placement,objective,soil',
    'equipment,placement,water',
    'equipment,placement,water,objective',
    'equipment,placement,water,objective,soil',
  ]);
});

test('section 3.4 : la première arrivée des trois façons est « Ma ferme » ; des alertes seules arrivent là où elles arrivaient', () => {
  for (const way of START_WAY_IDS) assert.equal(firstArrivalPage(startWaySelection(way)), 'ma-ferme', way);
  assert.equal(firstArrivalPage(['alertes-meteo', 'alertes-cultures']), 'aujourdhui');
  assert.equal(firstArrivalPage(['alertes-meteo']), landingPage(['alertes-meteo']));
});

test('section 4 : ce que la base garde se lit, et rien d’autre ; une ferme d’avant S6 n’a ni façon ni état de carte', () => {
  for (const mode of ['notes', 'proposals', 'all', 'custom'] as const) assert.equal(storedStartMode(mode), mode);
  for (const value of [null, undefined, '', 'tout', 'NOTES', 3]) assert.equal(storedStartMode(value), null, String(value));
  assert.equal(storedRouteState('later'), 'later');
  assert.equal(storedRouteState('done'), 'done');
  for (const value of [null, undefined, 'plus-tard', 1]) assert.equal(storedRouteState(value), null, String(value));
  assert.ok(isStartWay('notes') && !isStartWay('custom'), '« Choisir moi-même » n’est pas une des trois façons');

  const stored = { kind: 'stored', enabled: ['arrosages'], known: [...FEATURE_IDS], chosenAt: '2026-11-26T08:00:00.000Z', bannerDismissedAt: null } as const;
  assert.deepEqual([resolveFeatureSelection(stored).startMode, resolveFeatureSelection(stored).routeState], [null, null], 'une ferme d’avant S6');
  const chosen = resolveFeatureSelection({ ...stored, startMode: 'proposals', routeState: 'later' });
  assert.deepEqual([chosen.startMode, chosen.routeState], ['proposals', 'later']);
  const unreadable = resolveFeatureSelection({ ...stored, startMode: 'inconnue', routeState: 'jamais' });
  assert.deepEqual([unreadable.startMode, unreadable.routeState], [null, null], 'une valeur illisible ne fait pas naître de carte');
  assert.deepEqual([resolveFeatureSelection({ kind: 'before-selection' }).startMode, resolveFeatureSelection({ kind: 'first-visit' }).startMode], [null, null]);
});

test('section 9 : la ligne de Réglages dit comment la ferme a commencé ; rien pour une ferme d’avant S6', () => {
  assert.equal(startedWithText('proposals'), 'Vous avez commencé par : « Le module me propose quoi arroser ».');
  assert.equal(startedWithText('notes'), 'Vous avez commencé par : « Je note mes arrosages ».');
  assert.equal(startedWithText('custom'), 'Vous avez choisi vous-même vos fonctionnalités.');
  assert.equal(startedWithText(null), null);
  const settings = readFileSync('app/irrigation/reglages/feature-settings.tsx', 'utf8');
  assert.match(settings, /\{startedWith \? <p className="feature-started-with">\{startedWith\}<\/p> : null\}/);
  assert.doesNotMatch(settings, /Refaire/, 'pas de bouton « Refaire le choix de départ »');
  assert.match(readFileSync('app/irrigation/reglages/page.tsx', 'utf8'), /startedWith=\{startedWithText\(context\.startMode\)\}/);
});

const screen = readFileSync('app/irrigation/bienvenue/welcome-choice.tsx', 'utf8');

test('section 3.2 : trois boutons radio natifs, rien choisi d’avance, « Continuer » attend un appui (S6-a)', () => {
  assert.match(screen, /role="radiogroup" aria-labelledby="welcome-title"/);
  assert.match(screen, /type="radio"\s+name="start-way"/);
  assert.match(screen, /useState<StartWay \| null>\(null\)/, 'aucune façon enfoncée d’avance');
  assert.doesNotMatch(screen, /useState<StartWay \| null>\('proposals'\)/);
  assert.match(screen, /aria-labelledby=\{`start-way-\$\{candidate\.id\}-name`\}/, 'le nom en étiquette');
  assert.match(screen, /aria-describedby=\{`\$\{candidate\.recommended \? `start-way-\$\{candidate\.id\}-tag ` : ''\}start-way-\$\{candidate\.id\}-text`\}/, 'la phrase en description');
  assert.match(screen, /const ready = custom \? selection\.length > 0 : way !== null;/);
  assert.match(screen, /disabled=\{pending \|\| !ready\}/);
  assert.match(screen, /\{pending \? 'Enregistrement…' : 'Continuer'\}/);
  // La coche avec la bordure : la couleur seule ne dit pas le choix.
  assert.match(screen, /\{checked \? <Icon name="coche" \/> : null\}/);
  // L'erreur du serveur sous le bouton.
  assert.ok(screen.indexOf('welcome-continue') < screen.indexOf('role="alert"'));
});

test('section 3.2 : le navigateur n’envoie que la façon ; « Choisir moi-même » montre la liste, « ‹ Revenir » la referme sans rien écrire', () => {
  assert.match(screen, /saveFeatureSelectionAction\(custom \? \{ startMode: 'custom', enabled: selection \} : \{ startMode: way \?\? '' \}\)/);
  assert.match(screen, /setSelection\(way \? startWaySelection\(way\) : \[\]\)/, 'les cases de la façon enfoncée, déjà cochées');
  assert.match(screen, /‹ Revenir aux trois façons/);
  assert.match(screen, /<FeatureChoiceList selection=\{selection\} disabled=\{pending\} keepOne=\{false\} onToggle=\{toggle\} \/>/);
  assert.match(screen, /Cochez ce dont votre ferme a besoin/, 'le texte de la 3.8 passe sur la liste');
  const backToWays = screen.slice(screen.indexOf('const backToWays'), screen.indexOf('const toggle'));
  assert.doesNotMatch(backToWays, /saveFeatureSelectionAction/);
  assert.doesNotMatch(screen, /Commencer par l’essentiel/, 'F452 retiré');
  // La phrase de ce qui suit vient de la fonction de la mise en route, jamais écrite en double.
  assert.match(screen, /\{whatFollowsText\(way \? startWaySelection\(way\) : null\)\}/);
  assert.doesNotMatch(screen, /cinq étapes|quatre étapes|deux étapes/);
});

test('section 3.4 : le serveur calcule les cases des trois façons ; il ignore celles du navigateur', () => {
  const service = readFileSync('lib/services/start-choice.ts', 'utf8');
  assert.match(service, /if \(isStartWay\(input\.startMode\)\) \{\s+startMode = input\.startMode;\s+enabled = startWaySelection\(input\.startMode\);/);
  const action = readFileSync('app/irrigation/feature-selection-actions.ts', 'utf8');
  assert.match(action, /if \(input\.startMode !== undefined\) return saveStartChoice\(user\.userId, input\.startMode, enabledInput\);/);
  assert.match(action, /if \(\(await getFeatureSelectionForUser\(user\.userId\)\)\.firstVisit\) return saveStartChoice\(user\.userId, 'custom', enabledInput\);/);
});

test('section 3.1 : la page garde la barre du haut et « Aller au contenu », jamais la barre du bas ; ses styles', () => {
  assert.match(screen, /<a className="skip-link" href="#contenu">Aller au contenu<\/a>/);
  assert.match(screen, /<Topbar /);
  assert.doesNotMatch(screen, /PhoneBar|phone-bar|BottomBar/);
  const css = readFileSync('app/irrigation/styles/mise-en-route.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /\.start-way \{[^}]*min-height: 72px;/);
  assert.match(css, /\.start-way\[data-checked="true"\] \{[^}]*border: 3px solid var\(--green\);/);
  assert.match(css, /\.welcome-actions \.welcome-continue \{[^}]*min-height: 50px;/);
  assert.match(css, /\.welcome-link \{[^}]*min-height: var\(--touch-target\);/);
  for (const weight of css.matchAll(/font-weight: (\d+)/g)) assert.ok(['300', '400', '500', '700'].includes(weight[1]), weight[1]);
  const entry = readFileSync('app/irrigation/irrigation.css', 'utf8');
  assert.match(entry, /@import '\.\/styles\/mise-en-route\.css';\n@import '\.\/styles\/trois-endroits\.css';\n@import '\.\/styles\/gestes-surs\.css';/);
});
