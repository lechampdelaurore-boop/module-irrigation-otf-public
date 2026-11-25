import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { IrrigationCoverageResult } from '../lib/domain/irrigation-coverage.ts';
import {
  chosenChip,
  durationChips,
  durationMinutesOf,
  durationText,
  endClockText,
  FIRST_PLUS_MINUTES,
  hoursAndMinutes,
  MAXIMUM_DURATION_MINUTES,
  MINIMUM_DURATION_MINUTES,
  MISSING_BEDS,
  MISSING_DURATION,
  MISSING_WHERE,
  MORE_OPTIONS_LABEL,
  moreOptionsOpenAtFirst,
  precautionLevel,
  preselectedEquipmentId,
  reachedBedCount,
  resultSentence,
  resultSentenceText,
  startButton,
  stepAvailable,
  stepDuration,
  UNKNOWN_VOLUME_TEXT,
  WHERE_RADIO_LIMIT,
  whereListKind,
  whereRowDetail,
} from '../lib/domain/watering-now.ts';

/**
 * Simplifier l'usage du module, lot S5, PR 1 : « Arroser maintenant » en
 * trois champs (docs/simplification-s5-contract.md, sections 3, 9.3, 10 et
 * 11 ; D-332, F894 à F901). Les règles d'écran vivent dans
 * `lib/domain/watering-now.ts` ; l'interface est lue dans ses fichiers, comme
 * les autres lots ; le geste de bout en bout et les mesures à 390 px sont
 * dans le parcours P64.
 */

const FORM = 'app/irrigation/irrigation-manager/watering-now-form.tsx';
const PANEL = 'app/irrigation/irrigation-manager/creation-panel.tsx';
const STATE = 'app/irrigation/irrigation-manager/use-creation-form.ts';
const MANAGER = 'app/irrigation/irrigation-event-manager.tsx';
const read = (file: string) => readFileSync(file, 'utf8');

test('S5-h : « 30 min » et « 1 h » toujours ; « Conseillé » seulement avec une dose du jour, dite en durée', () => {
  assert.deepEqual(durationChips(null).map((chip) => chip.label), ['30 min', '1 h']);
  assert.deepEqual(durationChips(0).map((chip) => chip.label), ['30 min', '1 h']);
  const chips = durationChips(4_800);
  assert.deepEqual(chips.map((chip) => chip.label), ['30 min', '1 h', 'Conseillé : 1 h 20']);
  // « Conseillé » écrit une quantité, jamais une durée arrondie.
  assert.equal(chips[2].minutes, null);
  assert.deepEqual(chips.slice(0, 2).map((chip) => chip.minutes), [30, 60]);
});

test('la pastille choisie se lit sur le formulaire : la dose exacte en mm, ou une durée fixe', () => {
  assert.equal(chosenChip({ mode: 'amount', targetMillimeters: '8', durationMinutes: 60 }, 8), 'advised');
  assert.equal(chosenChip({ mode: 'amount', targetMillimeters: '2,5', durationMinutes: 60 }, 2.5), 'advised');
  assert.equal(chosenChip({ mode: 'amount', targetMillimeters: '7', durationMinutes: 60 }, 8), null);
  assert.equal(chosenChip({ mode: 'amount', targetMillimeters: '', durationMinutes: 60 }, null), null, 'sans dose ni quantité, rien de choisi (D-028)');
  assert.equal(chosenChip({ mode: 'duration', targetMillimeters: '8', durationMinutes: 30 }, 8), 'thirty');
  assert.equal(chosenChip({ mode: 'duration', targetMillimeters: '', durationMinutes: 60 }, null), 'hour');
  assert.equal(chosenChip({ mode: 'duration', targetMillimeters: '', durationMinutes: 35 }, null), null);
});

test('S5-h, S5-i : « + » et « − » de cinq en cinq, le premier « + » donne 30 min, plancher 5 min, plafond 744 h', () => {
  assert.equal(stepDuration(null, 1), FIRST_PLUS_MINUTES);
  assert.equal(FIRST_PLUS_MINUTES, 30);
  assert.equal(stepDuration(null, -1), null);
  assert.equal(stepAvailable(null, -1), false);
  assert.equal(stepAvailable(null, 1), true);
  assert.equal(stepDuration(30, 1), 35);
  assert.equal(stepDuration(35, -1), 30);
  // Hors grille (« Conseillé : 1 h 23 ») : la grille voisine.
  assert.equal(stepDuration(83, 1), 85);
  assert.equal(stepDuration(83, -1), 80);
  assert.equal(MINIMUM_DURATION_MINUTES, 5);
  assert.equal(stepDuration(5, -1), 5);
  assert.equal(stepDuration(3, -1), 5);
  assert.equal(stepAvailable(5, -1), false);
  assert.equal(stepAvailable(10, -1), true);
  assert.equal(MAXIMUM_DURATION_MINUTES, 744 * 60);
  assert.equal(stepDuration(MAXIMUM_DURATION_MINUTES, 1), MAXIMUM_DURATION_MINUTES);
  assert.equal(stepDuration(MAXIMUM_DURATION_MINUTES - 2, 1), MAXIMUM_DURATION_MINUTES);
  assert.equal(stepAvailable(MAXIMUM_DURATION_MINUTES, 1), false);
  assert.deepEqual(hoursAndMinutes(85), { hours: 1, minutes: 25 });
  assert.deepEqual(hoursAndMinutes(30), { hours: 0, minutes: 30 });
});

test('la durée affichée : « — » quand elle est inconnue ou nulle, jamais une durée inventée (D-028, D-003)', () => {
  assert.equal(durationText(null), '—');
  assert.equal(durationText(0), '—');
  assert.equal(durationText(Number.NaN), '—');
  assert.equal(durationText(4_800), '1 h 20');
  assert.equal(durationText(3_600), '1 h');
  assert.equal(durationText(30), '1 min');
  assert.equal(durationMinutesOf(null), null);
  assert.equal(durationMinutesOf(0), null);
  assert.equal(durationMinutesOf(4_980), 83);
});

test('« Où ? » : une ligne dit le type et les planches atteintes ; cases rondes jusqu’à six, liste au-delà (S5-c) ; un seul matériel choisi d’office (S5-b)', () => {
  assert.equal(whereRowDetail('drip', 3), 'Goutte-à-goutte · 3 planches');
  assert.equal(whereRowDetail('drip', 1), 'Goutte-à-goutte · 1 planche');
  assert.equal(whereRowDetail('sprinkler', 0), 'Aspersion · 0 planche');
  const coverage = {
    beds: [
      { bedId: 'n01', contributions: [{ equipmentId: 'a' }, { equipmentId: 'b' }] },
      { bedId: 'n02', contributions: [{ equipmentId: 'a' }] },
      { bedId: 'n03', contributions: [{ equipmentId: 'c' }] },
    ],
  } as unknown as IrrigationCoverageResult;
  assert.equal(reachedBedCount(coverage, 'a'), 2);
  assert.equal(reachedBedCount(coverage, 'b'), 1);
  assert.equal(reachedBedCount(coverage, 'z'), 0);
  assert.equal(WHERE_RADIO_LIMIT, 6);
  assert.equal(whereListKind(1), 'radios');
  assert.equal(whereListKind(6), 'radios');
  assert.equal(whereListKind(7), 'select');
  assert.equal(preselectedEquipmentId([{ id: 'a' }]), 'a');
  assert.equal(preselectedEquipmentId([{ id: 'a' }, { id: 'b' }]), null);
  assert.equal(preselectedEquipmentId([]), null);
});

test('la phrase du résultat : une valeur ou une fourchette, l’origine connue seulement, la pompe dite (S5-k, S5-l)', () => {
  const one = resultSentence({ amountsMm: [8, 8, 8], volumeLiters: 470, originName: 'Bassin', pumpName: 'P1' });
  assert.equal(resultSentenceText(one), 'Soit 8 mm sur les 3 planches, et 470 L pris à « Bassin ». Avec la pompe P1.');
  // Égales au dixième : une seule valeur.
  assert.equal(resultSentence({ amountsMm: [8.02, 8.04], volumeLiters: 470, originName: null, pumpName: null }).amount, '8 mm');
  const range = resultSentence({ amountsMm: [6, 9.04, 7], volumeLiters: 1_250, originName: null, pumpName: null });
  assert.equal(resultSentenceText(range), 'Soit de 6 à 9 mm selon les planches, et 1,25 m³.');
  assert.equal(resultSentenceText(resultSentence({ amountsMm: [5], volumeLiters: 112.5, originName: null, pumpName: null })), 'Soit 5 mm sur la planche, et 113 L.');
  // Un volume inconnu se dit avec sa raison, jamais « 0 L » ; l'origine ne se dit pas sans volume.
  const unknownVolume = resultSentence({ amountsMm: [8, 8], volumeLiters: null, originName: 'Bassin', pumpName: null });
  assert.equal(unknownVolume.origin, null);
  assert.equal(resultSentenceText(unknownVolume), `Soit 8 mm sur les 2 planches, ${UNKNOWN_VOLUME_TEXT}.`);
  // Un apport inconnu se dit, jamais zéro (D-003).
  const partial = resultSentence({ amountsMm: [8, null, 8], volumeLiters: null, originName: null, pumpName: null });
  assert.equal(resultSentenceText(partial), `Soit 8 mm sur 2 planches, apport inconnu sur 1 planche, ${UNKNOWN_VOLUME_TEXT}.`);
  assert.equal(resultSentenceText(resultSentence({ amountsMm: [null, null], volumeLiters: null, originName: null, pumpName: 'P1' })), 'Soit apport inconnu sur 2 planches. Avec la pompe P1.');
  assert.equal(resultSentence({ amountsMm: [8], volumeLiters: 100, originName: null, pumpName: null }).pump, null);
});

test('S5-j : l’heure de fin est l’heure du formulaire plus la durée, à l’heure de la ferme, autour de minuit et d’un changement d’heure', () => {
  // 16 juin 2026, 10 h 30 à Paris (UTC+2), plus 1 h 20.
  assert.equal(endClockText(new Date('2026-06-16T08:30:00Z'), 4_800), '11 h 50');
  // 23 h 50 plus 30 min : le lendemain, 0 h 20.
  assert.equal(endClockText(new Date('2026-06-16T21:50:00Z'), 1_800), '0 h 20');
  // Nuit du 25 octobre 2026 : 2 h 30 (heure d'été) plus une heure réelle, il est 2 h 30 (heure d'hiver).
  assert.equal(endClockText(new Date('2026-10-25T00:30:00Z'), 3_600), '2 h 30');
  // Hiver (UTC+1).
  assert.equal(endClockText(new Date('2026-11-25T09:00:00Z'), 600), '10 h 10');
  assert.equal(endClockText(new Date('2026-11-25T09:00:00Z'), null), null);
  assert.equal(endClockText(new Date('2026-11-25T09:00:00Z'), 0), null);
});

test('S5-d : le bouton dit ce qu’il fait, et la seule chose qui manque, dans l’ordre : où, puis combien de temps', () => {
  const now = new Date('2026-06-16T08:30:00Z');
  const nothing = startButton({ equipmentName: null, durationSeconds: null, reachedBeds: 0, now });
  assert.deepEqual(nothing, { label: 'Démarrer', accessibleName: 'Démarrer', disabled: true, missing: MISSING_WHERE });
  assert.equal(MISSING_WHERE, 'Choisissez où arroser.');
  // Sans matériel, même avec une durée, c'est « où » qui manque d'abord.
  assert.equal(startButton({ equipmentName: null, durationSeconds: 1_800, reachedBeds: 0, now }).missing, MISSING_WHERE);
  const noDuration = startButton({ equipmentName: 'Goutte nord', durationSeconds: 0, reachedBeds: 3, now });
  assert.equal(noDuration.missing, MISSING_DURATION);
  assert.equal(MISSING_DURATION, 'Choisissez une durée.');
  assert.equal(noDuration.disabled, true);
  assert.equal(noDuration.accessibleName, 'Démarrer l’arrosage de Goutte nord');
  assert.equal(startButton({ equipmentName: 'Goutte nord', durationSeconds: 1_800, reachedBeds: 0, now }).missing, MISSING_BEDS);
  const ready = startButton({ equipmentName: 'Goutte nord', durationSeconds: 4_800, reachedBeds: 3, now });
  assert.deepEqual(ready, { label: 'Démarrer · fin vers 11 h 50', accessibleName: 'Démarrer l’arrosage de Goutte nord, fin vers 11 h 50', disabled: false, missing: null });
});

test('les précautions restent au premier niveau : le créneau protégé, la pompe dépassée ; « ok » et « inconnu » dans « Plus d’options »', () => {
  assert.equal(precautionLevel({ kind: 'protected-slot' }), 'first-level');
  assert.equal(precautionLevel({ kind: 'hydraulic', tone: 'exceeded' }), 'first-level');
  assert.equal(precautionLevel({ kind: 'hydraulic', tone: 'ok' }), 'more-options');
  assert.equal(precautionLevel({ kind: 'hydraulic', tone: 'unknown' }), 'more-options');
  // Dans l'écran : le dépassement avant le pli, les autres états dedans.
  const form = read(FORM);
  const pli = form.indexOf('className="watering-more"');
  assert.ok(pli > 0);
  assert.ok(form.indexOf('{hydraulicFirst ? <HydraulicIndicator') > 0 && form.indexOf('{hydraulicFirst ? <HydraulicIndicator') < pli);
  assert.ok(form.indexOf('!hydraulicFirst ? <HydraulicIndicator') > pli);
  assert.ok(form.indexOf('preview.protectedSlotWarning ?') > 0 && form.indexOf('preview.protectedSlotWarning ?') < pli);
});

test('« Plus d’options » : fermé par défaut, ouvert seul quand une valeur y est déjà posée, `aria-expanded`', () => {
  assert.equal(MORE_OPTIONS_LABEL, 'Plus d’options (pompe, note, saisir en mm)');
  assert.equal(moreOptionsOpenAtFirst({ pumpChosen: false, pumpIsDefault: true, note: '', millimetersEntry: false }), false);
  // La pompe habituelle du matériel ne l'ouvre pas : elle est dite dans la phrase (S5-k).
  assert.equal(moreOptionsOpenAtFirst({ pumpChosen: true, pumpIsDefault: true, note: '', millimetersEntry: false }), false);
  assert.equal(moreOptionsOpenAtFirst({ pumpChosen: true, pumpIsDefault: false, note: '', millimetersEntry: false }), true);
  assert.equal(moreOptionsOpenAtFirst({ pumpChosen: false, pumpIsDefault: true, note: ' vanne nord ', millimetersEntry: false }), true);
  assert.equal(moreOptionsOpenAtFirst({ pumpChosen: false, pumpIsDefault: true, note: '   ', millimetersEntry: false }), false);
  assert.equal(moreOptionsOpenAtFirst({ pumpChosen: false, pumpIsDefault: true, note: '', millimetersEntry: true }), true);
  const form = read(FORM);
  assert.match(form, /aria-expanded=\{moreOpen\}/);
  assert.match(form, /aria-controls=\{`\$\{moreId\}-options`\}/);
  assert.match(form, /hidden=\{!moreOpen\}/);
  assert.match(form, /\{MORE_OPTIONS_LABEL\}/);
});

test('tableau 9.3 : chaque champ d’aujourd’hui a sa place, au premier niveau ou dans « Plus d’options »', () => {
  const form = read(FORM);
  const pli = form.indexOf('className="watering-more"');
  const firstLevel = form.slice(0, pli);
  const more = form.slice(pli, form.indexOf('className="watering-start"'));
  const start = form.slice(form.indexOf('className="watering-start"'));
  // Matériel : « 1. Où ? », cases rondes nommées par le matériel, la liste au-delà de six.
  assert.match(firstLevel, /<h3 id=\{`\$\{moreId\}-ou`\}>1\. Où \?<\/h3>/);
  assert.match(firstLevel, /type="radio"/);
  assert.match(firstLevel, /whereListKind\(usableEquipment\.length\) === 'radios'/);
  assert.match(firstLevel, /<span>Où arroser \?<\/span>/);
  // La ligne « n planches atteintes » : dans chaque ligne.
  assert.match(firstLevel, /whereRowDetail\(item\.kind, reachedBeds\.get\(item\.id\) \?\? 0\)/);
  // Réglage : seulement quand le matériel en a plusieurs.
  assert.match(firstLevel, /selectedEquipment\.settings\.length > 1 \? \(\s*<label className="watering-setting">/);
  // Heures et minutes : « Combien de temps ? », « − », « + », pastilles ; la saisie exacte dans le pli.
  assert.match(firstLevel, /2\. Combien de temps \?/);
  assert.match(firstLevel, /aria-label="Cinq minutes de moins"/);
  assert.match(firstLevel, /aria-label="Cinq minutes de plus"/);
  assert.match(firstLevel, /role="group" aria-label="Durées proposées"/);
  assert.match(more, /<legend>Durée exacte<\/legend>/);
  assert.match(more, /<span>Heures<\/span>/);
  assert.match(more, /<span>Minutes<\/span>/);
  // Objectif en mm, Quantité souhaitée, Planche de référence : « Saisir en mm » dans le pli, la quantité au premier niveau.
  assert.match(more, /<span>Saisir en mm<\/span>/);
  assert.match(firstLevel, /<span>Quantité souhaitée<\/span>/);
  assert.match(more, /<span>Planche de référence<\/span>/);
  assert.match(more, /selectedEquipment\?\.kind === 'sprinkler'/);
  // Pompe et origine, la faisabilité « ok » et « inconnu », la note : dans le pli.
  assert.match(more, /<PumpFields /);
  assert.match(more, /<NoteField form=\{form\} \/>/);
  assert.doesNotMatch(firstLevel, /<NoteField|<PumpFields/);
  // La note est le dernier champ du pli, dans lui : juste avant sa fermeture, avant le bouton.
  assert.match(form, /<NoteField form=\{form\} \/>\s*<\/div>\s*<\/div>\s*<div className="watering-start">/);
  // « Résultat calculé » : la phrase ; l'intensité, l'étendue et l'apport par planche sous « Voir planche par planche ».
  assert.match(firstLevel, /<ResultLine sentence=\{sentence\} \/>/);
  assert.match(firstLevel, /<summary>Voir planche par planche<\/summary>/);
  assert.match(firstLevel, /Intensité : /);
  assert.match(firstLevel, /Étendue : /);
  assert.match(firstLevel, /<caption>Apport estimé par planche<\/caption>/);
  assert.doesNotMatch(form, /Résultat calculé/);
  // La réponse du module sous le bouton (F404) ; la promesse du minuteur gardée.
  assert.match(start, /\{reply\}/);
  assert.match(start, /Le minuteur retrouvera son état après une actualisation de la page\./);
  assert.match(start, /aria-label=\{pending \? undefined : button\.accessibleName\}/);
  assert.match(start, /\{button\.missing && !pending \? <p className="watering-missing">/);
});

test('« Conseillé » enregistre exactement la valeur d’avant : la dose du jour en mm, sans arrondi à la minute (F409)', () => {
  const form = read(FORM);
  assert.match(form, /form\.setPreparationMode\('amount'\);\s*form\.setMillimetersEntry\(false\);\s*form\.setTargetMillimeters\(dose === null \? '' : String\(dose\)\);/);
  // La même valeur que la dose proposée au choix du matériel.
  assert.match(read(MANAGER), /setTargetMillimeters\(dose === null \? '' : String\(dose\)\);/);
  // Une pastille fixe, « + » et « − » : le mode « Durée d'irrigation », en minutes entières.
  assert.match(form, /form\.setPreparationMode\('duration'\);\s*form\.setMillimetersEntry\(false\);\s*form\.setDurationHours\(String\(hours\)\);\s*form\.setDurationMinutes\(String\(rest\)\);/);
});

test('les trois onglets : « Arroser maintenant » a son premier niveau ; « Planifier » et « Déjà réalisée » gardent leur formulaire jusqu’à la PR 2', () => {
  const panel = read(PANEL);
  assert.match(panel, /title="Arroser maintenant"/);
  assert.doesNotMatch(panel, /title="Irriguer maintenant"/);
  assert.match(panel, /title="Planifier"/);
  assert.match(panel, /title="Déjà réalisée"/);
  assert.match(panel, /creationKind === 'running' \? \(\s*<WateringNowForm/);
  assert.match(panel, /<PreparationFields/);
  // Le formulaire a son propre fichier : la page redescend sous la limite de 600 lignes.
  const counted = read(MANAGER).split('\n').filter((line) => line.trim() !== '' && !line.trim().startsWith('//')).length;
  assert.ok(counted < 500, `${counted} lignes comptées`);
});

test('un seul matériel prêt est choisi d’office sur « Arroser maintenant », et le formulaire vidé repart sans durée (F406)', () => {
  const manager = read(MANAGER);
  assert.match(manager, /creationKind === 'running' && editingEventEquipmentId === null \? preselectedEquipmentId\(usableEquipment\) : null/);
  assert.match(manager, /if \(onlyEquipmentId !== null && equipmentId === ''\) \{\s*chooseEquipment\(onlyEquipmentId\);\s*setAutoChosenId\(onlyEquipmentId\);/);
  assert.match(read(FORM), /Le seul matériel prêt à arroser est choisi\./);
  // Le choix d'office ne passe pas aux autres onglets : « Planifier » et « Déjà réalisée » reprennent sans matériel (lot 3, point 6, cas 3).
  assert.match(manager, /if \(creationKind !== 'running' && autoChosenId !== null\) \{\s*if \(equipmentId === autoChosenId\) \{\s*setEquipmentId\(''\);/);
  assert.match(manager, /onChooseEquipment=\{chooseByHand\}/);
  const reset = read(STATE).slice(read(STATE).indexOf('const reset = () => {'));
  assert.match(reset, /setPreparationMode\('amount'\);/);
  assert.match(reset, /setTargetMillimeters\(''\);/);
  assert.match(reset, /setMillimetersEntry\(false\);/);
});

test('les cibles : « − » et « + » ronds de 52 px, pastilles, lignes de « Où ? » et « Plus d’options » à 44 px', () => {
  const css = read('app/irrigation/styles/arroser-maintenant.css');
  const rule = (selector: string) => css.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`))?.[1] ?? '';
  assert.match(rule('.watering-stepper button'), /width: 52px;[\s\S]*height: 52px;[\s\S]*border-radius: 50%;/);
  assert.match(rule('.watering-chips button'), /min-height: var\(--touch-target\);/);
  assert.match(rule('.watering-where-row'), /min-height: var\(--touch-target\);/);
  assert.match(rule('.watering-more-toggle'), /min-height: var\(--touch-target\);/);
  assert.match(read('app/irrigation/irrigation.css'), /@import '\.\/styles\/arroser-maintenant\.css';/);
});
