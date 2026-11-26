import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { millimetersNumber } from '../lib/domain/display-numbers';
import { FEATURE_IDS, type FeatureId } from '../lib/domain/features/catalogue';
import {
  manualRainfallRefusal,
  rainAlreadyText,
  rainButton,
  rainEntry,
  rainReadingProblem,
  rainSavedText,
  readRainMm,
  RAIN_ZERO_HINT,
} from '../lib/domain/today/rain-entry';
import { todayView, type TodayInputs } from '../lib/domain/today/today-view';

/**
 * Simplifier l'usage du module, lot S2, PR 4 : « Noter la pluie » d'un geste
 * (docs/simplification-s2-contract.md, section 7). Les jours, le jour par
 * défaut, la lecture du chiffre, le mot du bouton et la mesure déjà notée
 * vivent dans `lib/domain/today/rain-entry.ts` ; l'écriture est celle
 * d'« Objectifs et besoins », jouée sur la base dans
 * `tests/db/simplification-s2-pluie.test.ts`.
 */

const MEASURED = new Map([['2026-06-16', 8], ['2026-06-12', 0]]);

test('les jours : aujourd’hui, hier, avant-hier, puis sept jours en arrière au plus ; hier par défaut', () => {
  const entry = rainEntry({ today: '2026-06-17', measured: MEASURED });
  assert.deepEqual(entry.days.map((day) => day.label), [
    'Aujourd’hui', 'Hier', 'Avant-hier', 'Dim. 14 juin', 'Sam. 13 juin', 'Ven. 12 juin', 'Jeu. 11 juin', 'Mer. 10 juin',
  ]);
  assert.deepEqual(entry.days.map((day) => day.date), [
    '2026-06-17', '2026-06-16', '2026-06-15', '2026-06-14', '2026-06-13', '2026-06-12', '2026-06-11', '2026-06-10',
  ]);
  // Jamais un jour futur : le premier est aujourd'hui.
  assert.ok(entry.days.every((day) => day.date <= '2026-06-17'));
  assert.equal(entry.defaultDate, '2026-06-16');
  // La mesure déjà notée, 0 mm compris (D-003) ; aucune n'est `null`, jamais 0.
  assert.deepEqual(entry.days.map((day) => day.measuredMm), [null, 8, null, null, null, 0, null, null]);
});

test('les jours restent dans la saison du jour : le 1er janvier, aujourd’hui seul, et par défaut', () => {
  const first = rainEntry({ today: '2027-01-01', measured: new Map() });
  assert.deepEqual(first.days.map((day) => day.label), ['Aujourd’hui']);
  assert.equal(first.defaultDate, '2027-01-01');
  const third = rainEntry({ today: '2027-01-03', measured: new Map([['2026-12-31', 4]]) });
  assert.deepEqual(third.days.map((day) => day.date), ['2027-01-03', '2027-01-02', '2027-01-01']);
  assert.equal(third.defaultDate, '2027-01-02');
});

test('le chiffre lu : virgule ou point, 0 accepté, un champ vide n’est jamais 0, hors de 0 à 1 000 refusé', () => {
  assert.deepEqual(readRainMm('8,5'), { ok: true, mm: 8.5 });
  assert.deepEqual(readRainMm('8.5'), { ok: true, mm: 8.5 });
  assert.deepEqual(readRainMm(' 12 '), { ok: true, mm: 12 });
  assert.deepEqual(readRainMm('0'), { ok: true, mm: 0 });
  assert.deepEqual(readRainMm('1000'), { ok: true, mm: 1000 });
  assert.deepEqual(readRainMm(''), { ok: false, reason: 'empty' });
  assert.deepEqual(readRainMm('   '), { ok: false, reason: 'empty' });
  for (const text of ['abc', '8,5,2', '-2', '1e3', '8 mm', ',5', '8,']) {
    assert.deepEqual(readRainMm(text), { ok: false, reason: 'invalid' }, text);
  }
  assert.deepEqual(readRainMm('1000,1'), { ok: false, reason: 'out-of-range' });
  assert.deepEqual(readRainMm('1500'), { ok: false, reason: 'out-of-range' });
});

test('sous le champ : l’aide du 0, ou le motif d’un chiffre refusé ; rien pour un champ vide', () => {
  assert.equal(RAIN_ZERO_HINT, 'Pas de pluie ? Notez 0 : c’est une vraie mesure, elle compte.');
  assert.equal(rainReadingProblem(readRainMm('')), null);
  assert.equal(rainReadingProblem(readRainMm('8,5')), null);
  assert.equal(rainReadingProblem(readRainMm('beaucoup')), 'Tapez un nombre de millimètres, par exemple 8,5.');
  assert.equal(rainReadingProblem(readRainMm('1500')), `La pluie se note de 0 à ${millimetersNumber(1000)} mm.`);
});

test('le bouton dit le chiffre ; « Remplacer par » quand une mesure existe ; inactif tant que le chiffre n’est pas lisible', () => {
  const [today, yesterday] = rainEntry({ today: '2026-06-17', measured: MEASURED }).days;
  assert.deepEqual(rainButton(today, readRainMm('')), { label: 'Enregistrer', enabled: false });
  assert.deepEqual(rainButton(today, readRainMm('abc')), { label: 'Enregistrer', enabled: false });
  assert.deepEqual(rainButton(today, readRainMm('8,5')), { label: 'Enregistrer 8,5 mm', enabled: true });
  assert.deepEqual(rainButton(today, readRainMm('0')), { label: 'Enregistrer 0 mm', enabled: true });
  assert.deepEqual(rainButton(yesterday, readRainMm('5')), { label: 'Remplacer par 5 mm', enabled: true });
});

test('la mesure déjà notée se dit, jamais d’écrasement silencieux', () => {
  const days = rainEntry({ today: '2026-06-17', measured: new Map([['2026-06-17', 1.5], ['2026-06-16', 8], ['2026-06-12', 0]]) }).days;
  assert.deepEqual(days.map(rainAlreadyText), [
    '1,5 mm déjà noté pour aujourd’hui.',
    '8 mm déjà notés pour hier.',
    null, null, null,
    '0 mm déjà noté pour le ven. 12 juin.',
    null, null,
  ]);
});

test('la réponse dit le chiffre et le jour ; « Le plan se recalcule » seulement avec « Planning »', () => {
  assert.equal(rainSavedText('2026-06-15', 8, true), 'Pluie enregistrée : 8 mm le lundi 15 juin. Le plan se recalcule.');
  assert.equal(rainSavedText('2026-06-15', 0, false), 'Pluie enregistrée : 0 mm le lundi 15 juin.');
  assert.equal(rainSavedText('2026-11-01', 12.4, true), 'Pluie enregistrée : 12,4 mm le dimanche 1 novembre. Le plan se recalcule.');
});

test('les gardes de l’action, inchangées : jamais un jour futur, de 0 à 1 000 mm', () => {
  const today = '2026-06-17';
  const futur = 'Une mesure réelle doit concerner une date valide, aujourd’hui ou dans le passé.';
  const bornes = 'La pluie mesurée doit être comprise entre 0 et 1 000 mm.';
  assert.equal(manualRainfallRefusal({ date: '2026-06-17', precipitationMm: 0, today }), null);
  assert.equal(manualRainfallRefusal({ date: '2026-06-10', precipitationMm: 1000, today }), null);
  assert.equal(manualRainfallRefusal({ date: '2026-06-18', precipitationMm: 8, today }), futur);
  assert.equal(manualRainfallRefusal({ date: '2026-02-30', precipitationMm: 8, today }), futur);
  assert.equal(manualRainfallRefusal({ date: 'hier', precipitationMm: 8, today }), futur);
  assert.equal(manualRainfallRefusal({ date: '2026-06-16', precipitationMm: -1, today }), bornes);
  assert.equal(manualRainfallRefusal({ date: '2026-06-16', precipitationMm: 1000.5, today }), bornes);
  assert.equal(manualRainfallRefusal({ date: '2026-06-16', precipitationMm: Number.NaN, today }), bornes);
  // L'action les lit ici, avec la date du jour à la ferme.
  const action = readFileSync('app/irrigation/water-actions.ts', 'utf8');
  assert.match(action, /manualRainfallRefusal\(\{ date: input\.date, precipitationMm: input\.precipitationMm, today: dateKeyInTimeZone\(new Date\(\)\) \}\);\n {2}if \(refusal\) return \{ ok: false, message: refusal \};\n {2}await saveManualRainfallForUser\(/);
});

const ALL: FeatureId[] = [...FEATURE_IDS];
function inputs(overrides: Partial<TodayInputs> = {}): TodayInputs {
  return {
    enabled: ALL,
    now: new Date('2026-06-17T05:00:00.000Z'),
    weather: { forecasts: [], frost: null, criteria: null },
    events: [],
    lateToleranceMinutes: 30,
    plan: null,
    shortagePlan: null,
    bedNames: new Map(),
    infrastructure: null,
    reliability: { actualRainMissingDates: [], soilGardensNeverObserved: [], speciesWithoutReference: [] },
    week: null,
    soil: null,
    rain: { measured: MEASURED, rainMatters: true },
    ...overrides,
  };
}

test('la fenêtre n’existe qu’avec « Objectifs et besoins », et jamais pour une ferme toute sous abri (D-032)', () => {
  const view = todayView(inputs());
  assert.equal(view.rain?.defaultDate, '2026-06-16');
  assert.equal(view.rain?.days[1].measuredMm, 8);
  assert.equal(todayView(inputs({ enabled: ALL.filter((id) => id !== 'besoins') })).rain, null);
  assert.equal(todayView(inputs({ rain: { measured: MEASURED, rainMatters: false } })).rain, null);
  assert.equal(todayView(inputs({ rain: undefined })).rain, null);
});

test('l’interface : une fenêtre partagée, au clavier, qui écrit par l’action existante ; deux entrées sur « Aujourd’hui »', () => {
  const dialog = readFileSync('app/irrigation/rain-entry-dialog.tsx', 'utf8');
  // Partagée : rien de la page « Aujourd'hui » (le « + » de S3 l'ouvrira aussi).
  assert.doesNotMatch(dialog, /from '\.\/today\//);
  assert.match(dialog, /saveManualRainfallAction\(\{ season, weekStart: weekStartDateKey\(date\), date, precipitationMm: mm \}\)/);
  assert.match(dialog, /showModal\(\)/);
  assert.match(dialog, /onCancel=\{\(event\) => \{ event\.preventDefault\(\); close\(\); \}\}/);
  assert.match(dialog, /<label htmlFor=\{dayId\}>Quel jour \?<\/label>/);
  assert.match(dialog, /<label htmlFor=\{amountId\}>Combien \?<\/label>/);
  assert.match(dialog, /inputMode="decimal"/);
  assert.match(dialog, /aria-describedby=\{hintId\}/);
  assert.match(dialog, /role="alert">\{refusal\}/);
  // Aucun bouton actif pendant l'enregistrement.
  assert.match(dialog, /disabled=\{pending \|\| !button\.enabled\}/);
  // Le formulaire est partagé avec la feuille du « + » (S3), qui a son propre « Fermer ».
  assert.match(dialog, /\{onClose \? <button type="button" disabled=\{pending\} onClick=\{onClose\}>Fermer<\/button> : null\}/);
  assert.match(dialog, /onClose=\{close\}/);

  const week = readFileSync('app/irrigation/today/today-week.tsx', 'utf8');
  assert.match(week, /onOpen=\{links\.received\.rain \? onOpenRain : undefined\}/);
  assert.match(week, /<button type="button" className="today-kpi" data-tone=\{tone\} disabled=\{pending\} onClick=\{onOpen\}>/);
  const zone = readFileSync('app/irrigation/today/reliability-zone.tsx', 'utf8');
  assert.match(zone, /if \(action\.kind === 'rain'\) \{/);
  assert.match(zone, /origin=\{RAIN_RELIABILITY_REPLY\}/);
  const page = readFileSync('app/irrigation/today/today-page.tsx', 'utf8');
  assert.match(page, /onOpenRain=\{openRain\?\.\(RAIN_WEEK_REPLY\)\}/);
  assert.match(page, /onOpenRain=\{openRain\?\.\(RAIN_RELIABILITY_REPLY\)\}/);
  // « Retirer une mesure » mène à « Pluie mesurée » de « Semaine » (S4, PR 4).
  assert.match(page, /besoinsHref=\{pageHref\('semaine', dayQuery, MEASURED_RAIN_ANCHOR\)\}/);
});
