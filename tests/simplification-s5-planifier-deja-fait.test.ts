import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { MISSING_BEDS, MISSING_DURATION, MISSING_WHERE, moreOptionsLabel } from '../lib/domain/watering-now.ts';
import {
  MISSING_PERIOD,
  MISSING_START,
  planButton,
  plannedDayText,
  recordButton,
  unplacedChoiceText,
  WATERING_TAB_LABELS,
  wateringBlocks,
} from '../lib/domain/watering-plan-record.ts';

/**
 * Simplifier l'usage du module, lot S5, PR 2 : « Planifier » et « Déjà fait »
 * sur le squelette d'« Arroser maintenant » (docs/simplification-s5-contract.md,
 * sections 4, 5, 6 et 10 ; D-333). Les règles d'écran vivent dans
 * `lib/domain/watering-plan-record.ts` ; l'interface est lue dans ses
 * fichiers ; les gestes de bout en bout sont dans P2, P3, P31 et P65.
 */

const FORM = 'app/irrigation/irrigation-manager/watering-form.tsx';
const PANEL = 'app/irrigation/irrigation-manager/creation-panel.tsx';
const MANAGER = 'app/irrigation/irrigation-event-manager.tsx';
const read = (path: string) => readFileSync(path, 'utf8');

// Mercredi 25 novembre 2026, 10 h à Paris (9 h UTC).
const NOW = new Date('2026-11-25T09:00:00.000Z');

test('les noms des onglets (section 6, S5-a, S5-e) : « Arroser maintenant », « Planifier », « Déjà fait »', () => {
  assert.deepEqual(WATERING_TAB_LABELS, { running: 'Arroser maintenant', planned: 'Planifier', completed: 'Déjà fait' });
});

test('l’ordre des blocs : « Quand ? » avant « Combien de temps ? » ; « De quand à quand ? » avant « Où ? » (règle 12)', () => {
  assert.deepEqual(wateringBlocks('running'), ['where', 'duration']);
  assert.deepEqual(wateringBlocks('planned'), ['where', 'when', 'duration']);
  assert.deepEqual(wateringBlocks('completed'), ['period', 'where']);
  assert.ok(!wateringBlocks('completed').includes('duration'), 'la durée de « Déjà fait » se lit des dates');
});

test('le jour d’un début planifié, à la ferme : aujourd’hui, demain, le jour de la semaine, la date au-delà', () => {
  assert.equal(plannedDayText(new Date('2026-11-25T17:00:00.000Z'), NOW), 'aujourd’hui');
  // 23 h 30 UTC le 25 est déjà le 26 à Paris.
  assert.equal(plannedDayText(new Date('2026-11-25T23:30:00.000Z'), NOW), 'demain');
  assert.equal(plannedDayText(new Date('2026-11-27T05:00:00.000Z'), NOW), 'le vendredi 27');
  // Le mois change : il se dit ; le premier du mois s'écrit « 1er ».
  assert.equal(plannedDayText(new Date('2026-12-01T05:00:00.000Z'), NOW), 'le mardi 1er décembre');
  assert.equal(plannedDayText(new Date('2026-12-09T05:00:00.000Z'), NOW), 'le mercredi 9 décembre');
  // Un jour passé se planifie aussi (pour le noter) : sa date entière.
  assert.equal(plannedDayText(new Date('2026-11-24T05:00:00.000Z'), NOW), 'le mardi 24 novembre');
});

test('« Planifier · demain à 6 h » : ce qui manque dans l’ordre des blocs, où, quand, combien de temps', () => {
  const start = new Date('2026-11-26T05:00:00.000Z');
  const ready = { equipmentName: 'Goutte nord', start, durationSeconds: 1800, reachedBeds: 3, now: NOW };
  assert.deepEqual(planButton(ready), {
    label: 'Planifier · demain à 6 h',
    accessibleName: 'Planifier l’arrosage de Goutte nord, demain à 6 h',
    disabled: false,
    missing: null,
  });
  assert.equal(planButton({ ...ready, equipmentName: null, start: null, durationSeconds: null }).missing, MISSING_WHERE);
  assert.equal(planButton({ ...ready, equipmentName: null }).accessibleName, 'Planifier');
  const noStart = planButton({ ...ready, start: null, durationSeconds: null });
  assert.equal(noStart.missing, MISSING_START);
  assert.equal(noStart.label, 'Planifier');
  assert.equal(noStart.accessibleName, 'Planifier l’arrosage de Goutte nord');
  assert.equal(planButton({ ...ready, start: new Date(Number.NaN) }).missing, MISSING_START, 'un début illisible (point ouvert 46)');
  assert.equal(planButton({ ...ready, durationSeconds: 0 }).missing, MISSING_DURATION);
  assert.equal(planButton({ ...ready, reachedBeds: 0 }).missing, MISSING_BEDS);
});

test('« Enregistrer cet arrosage » : les dates d’abord, puis où ; rien d’autre ne le bloque', () => {
  const ready = { equipmentName: 'Goutte nord', durationSeconds: 5400, reachedBeds: 2 };
  assert.deepEqual(recordButton(ready), {
    label: 'Enregistrer cet arrosage',
    accessibleName: 'Enregistrer l’arrosage de Goutte nord',
    disabled: false,
    missing: null,
  });
  assert.equal(recordButton({ ...ready, durationSeconds: null, equipmentName: null }).missing, MISSING_PERIOD);
  assert.equal(recordButton({ ...ready, durationSeconds: 0 }).missing, MISSING_PERIOD);
  assert.equal(recordButton({ ...ready, equipmentName: null }).missing, MISSING_WHERE);
  assert.equal(recordButton({ ...ready, reachedBeds: 0 }).missing, MISSING_BEDS);
  assert.equal(MISSING_PERIOD, 'Choisissez une fin après le début.');
});

test('un matériel qui n’était pas posé à l’heure de début : décoché, et dit (section 4)', () => {
  assert.equal(unplacedChoiceText('Goutte nord'), 'Goutte nord n’était pas posé à cette heure de début : choisissez où vous avez arrosé.');
  const manager = read(MANAGER);
  assert.match(manager, /const unplacedChoice = equipmentId !== '' && selectedEquipment === null \? equipment\.find\(\(item\) => item\.id === equipmentId\)\?\.name \?\? null : null;/);
  assert.match(manager, /unplacedChoice=\{unplacedChoice\}/);
  assert.match(read(FORM), /\{unplacedChoice !== null \? <p className="watering-note" role="status">\{unplacedChoiceText\(unplacedChoice\)\}<\/p> : null\}/);
});

test('le squelette : « De quand à quand ? » avant « Où ? », « Quand ? » avant « Combien de temps ? », chacun au premier niveau', () => {
  const form = read(FORM);
  assert.match(form, /\{period\}\s*\{where\}\s*\{when\}\s*\{howLong\}/);
  assert.match(form, /const howLong = kind === 'completed' \? null : \(/);
  assert.match(form, /\{n\('period'\)\}\. De quand à quand \?/);
  assert.match(form, /\{n\('when'\)\}\. Quand \?/);
  assert.match(form, /<span>Début réel<\/span>/);
  assert.match(form, /<span>Fin réelle<\/span>/);
  assert.match(form, /<span>Date et heure de début<\/span>/);
  // La durée de « Déjà fait » se lit des dates, sous elles.
  const period = form.slice(form.indexOf('const period ='), form.indexOf('const where ='));
  assert.match(period, /soit <strong>\{durationText\(durationSeconds\)\}<\/strong>/);
  // Sa phrase du résultat dit ce qui s'enregistrera, sous « Où ? ».
  assert.match(form.slice(form.indexOf('const where ='), form.indexOf('const when =')), /\{kind === 'completed' \? results : null\}/);
});

test('« Déjà fait » : pas de saisie en mm ni de durée exacte ; faisabilité lue au passé ; pas de promesse du minuteur', () => {
  const form = read(FORM);
  const more = form.slice(form.indexOf('className="watering-more"'), form.indexOf('className="watering-start"'));
  assert.match(more, /\{kind === 'completed' \? null : \(<>\s*<label className="watering-switch">/);
  assert.equal(moreOptionsLabel('completed'), 'Plus d’options (pompe, note)');
  assert.match(form, /hydraulicMessage\(preview\.hydraulicPreview, kind === 'completed'\)/);
  assert.match(more, /historical=\{kind === 'completed'\}/);
  assert.match(form, /\{kind === 'running' \? <small>Le minuteur retrouvera son état après une actualisation de la page\.<\/small> : null\}/);
  assert.match(form, /kind === 'completed'\s*\? recordButton\(/);
  assert.match(form, /: kind === 'planned'\s*\? planButton\(/);
});

test('les onglets au téléphone : trois de 44 px sur une ligne, sans phrase de description (S5-e)', () => {
  const css = read('app/irrigation/styles/arroser-maintenant.css');
  const phone = css.slice(css.indexOf('@media (max-width: 560px)'));
  assert.match(phone, /\.irrigation-action-tabs \{\s*grid-template-columns: repeat\(3, 1fr\);/);
  assert.match(phone, /\.irrigation-action-tabs button \{\s*min-height: var\(--touch-target\);/);
  assert.match(phone, /\.irrigation-action-tabs button span \{\s*display: none;/);
  assert.match(read(PANEL), /role="tablist"/);
});

test('les mots de la section 6 : plus de « Déjà réalisée » ni d’« Irriguer maintenant » dans l’application', () => {
  for (const file of [FORM, PANEL, MANAGER, 'app/irrigation/pages/arrosages-page.tsx', 'lib/domain/features/help.ts', 'lib/domain/demo/tours.ts', 'lib/domain/features/plus-sheet.ts', 'lib/domain/irrigation-history/items.ts']) {
    assert.doesNotMatch(read(file), /Déjà réalisée|Irriguer maintenant|Enregistrer l’irrigation réalisée|Planifier l’irrigation/, file);
  }
  // L'Historique dit comment l'arrosage a été noté, avec les mêmes mots que l'onglet.
  const items = read('lib/domain/irrigation-history/items.ts');
  assert.match(items, /payload\.kind === 'completed'\) return 'Déjà fait';/);
  assert.match(items, /payload\.kind === 'running'\) return 'Arroser maintenant';/);
});
