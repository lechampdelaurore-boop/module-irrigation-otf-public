import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { planningSettingCodesNote, type PlanningSettingGroup } from '../lib/domain/planning/setting-codes.ts';
import { settingsIssueLabel } from '../lib/domain/planning/presentation.ts';

const GROUPS: readonly PlanningSettingGroup[] = ['forecast-rain', 'equipment', 'shortage', 'reach', 'tracking'];

test('chaque réglage R2 à R14 a son numéro dans une bulle « Pour les experts », une fois (audit final, lot D, J6, F297)', () => {
  const notes = GROUPS.map(planningSettingCodesNote);
  const codes = notes.flatMap((note) => [...note.matchAll(/Réglage (R\d+)/g)].map((match) => match[1]));
  assert.deepEqual(codes, ['R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R11', 'R12', 'R13', 'R14']);
  assert.equal(planningSettingCodesNote('reach'), 'Pour les experts : Réglage R13, part du débit le plus fort qui commande l’arrosage.');
  assert.ok(notes.every((note) => note.startsWith('Pour les experts : Réglage R')));
});

test('aucun libellé visible du formulaire du planning ne commence par son numéro (cas 1, F297)', () => {
  const source = readFileSync(new URL('../app/irrigation/planning/planning-settings-form.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /<span>R\d+ ·/);
  assert.doesNotMatch(source, /<legend>[^<]*R\d+/);
});

test('un refus nomme le réglage en mots simples, sans son numéro (F298)', () => {
  const paths = ['forecastRainShare', 'waitForForecastRainAboveMm', 'doses.sprinkler', 'doses.drip', 'windows.sprinkler', 'windows.drip', 'shortageStrategy', 'carryOverDeficit', 'collectiveDoseRule', 'preferredKindWhenBoth', 'commandingRateShare', 'lateToleranceMinutes'];
  for (const path of paths) {
    const label = settingsIssueLabel(path);
    assert.notEqual(label, path, `${path} a un libellé`);
    assert.doesNotMatch(label, /\bR\d+\b/, `${path} : ${label}`);
  }
  assert.equal(settingsIssueLabel('windows.drip'), 'Plage horaire du goutte-à-goutte');
});
