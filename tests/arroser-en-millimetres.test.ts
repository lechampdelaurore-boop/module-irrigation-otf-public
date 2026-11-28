import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { planButton } from '../lib/domain/watering-plan-record.ts';
import {
  advisedAmountLabel,
  amountIsAdvised,
  chosenChip,
  DEFAULT_AMOUNT_ENTRY,
  howMuchHeading,
  MISSING_AMOUNT,
  MISSING_DURATION,
  MISSING_WHERE,
  missingHowMuch,
  moreOptionsOpenAtFirst,
  startButton,
} from '../lib/domain/watering-now.ts';

/**
 * Arroser en millimètres d'abord (D-354, docs/simplification-s5-contract.md,
 * section 15, F1087 à F1092) : quand on démarre ou planifie un arrosage, on
 * dit d'abord combien de millimètres apporter ; la durée en est le résultat,
 * calculée par la fonction existante. Le réglage en minutes passe dans « Plus
 * d'options ». « Déjà fait » ne change pas : la durée s'y lit des dates. Le
 * geste de bout en bout est dans les parcours P64 et P65.
 */

const FORM = 'app/irrigation/irrigation-manager/watering-form.tsx';
const STATE = 'app/irrigation/irrigation-manager/use-creation-form.ts';
const MANAGER = 'app/irrigation/irrigation-event-manager.tsx';
const read = (file: string) => readFileSync(file, 'utf8');

test('F1087 : un formulaire neuf, ou vidé après une réussite, dit « combien » en millimètres', () => {
  assert.equal(DEFAULT_AMOUNT_ENTRY, 'millimeters');
  const state = read(STATE);
  assert.match(state, /const \[millimetersEntry, setMillimetersEntry\] = useState\(DEFAULT_AMOUNT_ENTRY === 'millimeters'\);/);
  // Le mode de calcul de départ est déjà « Objectif en mm » : la saisie et le calcul vont ensemble.
  assert.match(state, /const \[preparationMode, setPreparationMode\] = useState<IrrigationPreparationMode>\('amount'\);/);
  const reset = state.slice(state.indexOf('const reset = () => {'));
  assert.match(reset, /setPreparationMode\('amount'\);/);
  assert.match(reset, /setMillimetersEntry\(DEFAULT_AMOUNT_ENTRY === 'millimeters'\);/);
});

test('F1088 : le deuxième bloc s’appelle « Combien de mm ? », ou « Combien de temps ? » quand on saisit une durée', () => {
  assert.equal(howMuchHeading('millimeters'), 'Combien de mm ?');
  assert.equal(howMuchHeading('duration'), 'Combien de temps ?');
  const form = read(FORM);
  assert.match(form, /const entry: AmountEntry = form\.millimetersEntry \? 'millimeters' : 'duration';/);
  assert.match(form, /\{n\('duration'\)\}\. \{howMuchHeading\(entry\)\}/);
  // Le champ des millimètres est au premier niveau, avant « Plus d'options » ; la durée dessous en est le résultat.
  const pli = form.indexOf('className="watering-more"');
  const amount = form.indexOf('<span>Quantité souhaitée</span>');
  assert.ok(amount > 0 && amount < pli);
  assert.match(form.slice(amount, pli), /<p className="watering-duration-result">soit <strong>\{durationText\(durationSeconds\)\}<\/strong>/);
});

test('F1089 : « Conseillé : 8 mm » dit la dose du jour et y ramène ; sans dose, aucune pastille', () => {
  assert.equal(advisedAmountLabel(8), 'Conseillé : 8 mm');
  assert.equal(advisedAmountLabel(2.5), 'Conseillé : 2,5 mm');
  assert.equal(advisedAmountLabel(null), null);
  assert.equal(advisedAmountLabel(0), null);
  assert.equal(advisedAmountLabel(Number.NaN), null);
  assert.equal(amountIsAdvised('8', 8), true);
  assert.equal(amountIsAdvised('2,5', 2.5), true);
  assert.equal(amountIsAdvised('7', 8), false);
  assert.equal(amountIsAdvised('', 8), false);
  assert.equal(amountIsAdvised('8', null), false);
  // La pastille « Conseillé » de la durée lit la même règle.
  assert.equal(chosenChip({ mode: 'amount', targetMillimeters: '8', durationMinutes: 60 }, 8), 'advised');
  const form = read(FORM);
  assert.match(form, /const advisedAmount = selectedEquipment \? advisedAmountLabel\(dose\) : null;/);
  // Elle écrit exactement la dose proposée au choix du matériel, en mm, sans arrondi (F409).
  assert.match(form, /aria-pressed=\{amountIsAdvised\(form\.targetMillimeters, dose\)\} onClick=\{\(\) => \{ form\.setPreparationMode\('amount'\); form\.setTargetMillimeters\(dose === null \? '' : String\(dose\)\); \}\}/);
  assert.match(read(MANAGER), /setTargetMillimeters\(dose === null \? '' : String\(dose\)\);/);
});

test('F1090 : sans quantité, le bouton dit « Indiquez combien de mm apporter. » ; avec une durée, « Choisissez une durée. »', () => {
  const now = new Date('2026-06-16T08:30:00Z');
  assert.equal(MISSING_AMOUNT, 'Indiquez combien de mm apporter.');
  assert.equal(missingHowMuch('millimeters'), MISSING_AMOUNT);
  assert.equal(missingHowMuch('duration'), MISSING_DURATION);
  assert.equal(startButton({ equipmentName: 'Goutte nord', durationSeconds: 0, reachedBeds: 3, now, entry: 'millimeters' }).missing, MISSING_AMOUNT);
  assert.equal(startButton({ equipmentName: 'Goutte nord', durationSeconds: null, reachedBeds: 3, now, entry: 'duration' }).missing, MISSING_DURATION);
  // « Où » manque toujours d'abord.
  assert.equal(startButton({ equipmentName: null, durationSeconds: null, reachedBeds: 0, now, entry: 'millimeters' }).missing, MISSING_WHERE);
  // Une quantité qui donne une durée : le bouton est le même qu'avant.
  assert.deepEqual(startButton({ equipmentName: 'Goutte nord', durationSeconds: 4_800, reachedBeds: 3, now, entry: 'millimeters' }), {
    label: 'Démarrer · fin vers 11 h 50',
    accessibleName: 'Démarrer l’arrosage de Goutte nord, fin vers 11 h 50',
    disabled: false,
    missing: null,
  });
  const ready = { equipmentName: 'Goutte nord', start: new Date('2026-11-26T05:00:00.000Z'), durationSeconds: 0, reachedBeds: 3, now: new Date('2026-11-25T09:00:00.000Z'), entry: 'millimeters' as const };
  assert.equal(planButton(ready).missing, MISSING_AMOUNT);
  const form = read(FORM);
  assert.match(form, /planButton\(\{ [^}]*now: clock, entry \}\)/);
  assert.match(form, /startButton\(\{ equipmentName, durationSeconds, reachedBeds: reachedBedsCount, now: clock, entry \}\)/);
});

test('F1091 : « Saisir une durée » est dans « Plus d’options » ; décoché, on revient aux millimètres, en « Objectif en mm »', () => {
  const form = read(FORM);
  const pli = form.indexOf('className="watering-more"');
  const more = form.slice(pli, form.indexOf('className="watering-start"'));
  assert.match(more, /<input type="checkbox" checked=\{!form\.millimetersEntry\} onChange=\{\(event\) => \{ form\.setMillimetersEntry\(!event\.target\.checked\); if \(!event\.target\.checked\) form\.setPreparationMode\('amount'\); \}\} \/>\s*<span>Saisir une durée<\/span>/);
  assert.doesNotMatch(form, /Saisir en mm/);
  // Les « − », « + » et pastilles de durée gardent leurs règles (S5-h, S5-i) et ne paraissent qu'en saisie d'une durée.
  const howLong = form.slice(form.indexOf('const howLong ='), form.indexOf('return ('));
  assert.ok(howLong.indexOf('{form.millimetersEntry ? (') < howLong.indexOf('aria-label="Cinq minutes de moins"'));
  // La planche de référence d'un asperseur reste dans le pli, en saisie en mm seulement.
  assert.match(more, /\{form\.millimetersEntry && selectedEquipment\?\.kind === 'sprinkler' \? \(/);
});

test('F1092 : modifier une irrigation planifiée relit sa durée telle quelle, en saisie d’une durée, « Plus d’options » ouvert', () => {
  assert.equal(moreOptionsOpenAtFirst({ pumpChosen: false, pumpIsDefault: true, note: '', durationEntry: true }), true);
  assert.equal(moreOptionsOpenAtFirst({ pumpChosen: false, pumpIsDefault: true, note: '', durationEntry: false }), false);
  const manager = read(MANAGER);
  const edit = manager.slice(manager.indexOf('const editPlanned = '), manager.indexOf('const notificationReadiness'));
  assert.match(edit, /form\.setMillimetersEntry\(false\);\s*setPreparationMode\('duration'\);/);
  // « Déjà fait » n'a pas de saisie d'une durée : le pli ne s'ouvre pas pour elle.
  assert.match(read(FORM), /durationEntry: kind !== 'completed' && !form\.millimetersEntry \}\);/);
});
