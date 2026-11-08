import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { readFeasibilityRevisionForUser } from '../../db/irrigation-arbitration-repository';
import {
  readIrrigationNeedSettingsForUser,
  saveIrrigationBedNeedDecisionForUser,
  saveIrrigationNeedThresholdForUser,
} from '../../db/irrigation-need-repository';
import { ensureWorkspaceForUser, findWorkspaceIdForUser } from '../../db/workspace-repository';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';

const ALICE = 'alice';
const BOB = 'bob';
const SEASON = 2026;
const WEEK = '2026-06-15';

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

function logActions(): string[] {
  return (database.sqlite.prepare('SELECT action FROM irrigation_need_decision_log ORDER BY created_at, rowid').all() as { action: string }[])
    .map((row) => row.action);
}

const decision = (otfBedId: string, overrides: Partial<Parameters<typeof saveIrrigationBedNeedDecisionForUser>[1]> = {}) => ({
  season: SEASON, weekStart: WEEK, otfZoneId: 'zone-1', otfPlotId: 'plot-1', otfBedId,
  priority: 'normal' as const, manualOverrideMm: null, overrideReason: null, calculatedNeedAtOverrideMm: null,
  ...overrides,
});

test('seuil minimal : zéro par défaut sans rien créer, puis enregistré, remplacé et journalisé ; borné par la base', async () => {
  assert.deepEqual(await readIrrigationNeedSettingsForUser(ALICE, SEASON, WEEK), { thresholdMm: 0, decisions: [] });
  assert.equal(await findWorkspaceIdForUser(ALICE), null);

  await saveIrrigationNeedThresholdForUser(ALICE, SEASON, WEEK, 5);
  assert.notEqual(await findWorkspaceIdForUser(ALICE), null, 'enregistrer crée l’espace');
  assert.equal((await readIrrigationNeedSettingsForUser(ALICE, SEASON, WEEK)).thresholdMm, 5);
  await saveIrrigationNeedThresholdForUser(ALICE, SEASON, WEEK, 8.5);
  assert.equal((await readIrrigationNeedSettingsForUser(ALICE, SEASON, WEEK)).thresholdMm, 8.5);
  assert.equal(database.sqlite.prepare('SELECT count(*) AS n FROM irrigation_need_preferences').get()?.n, 1, 'une seule préférence par espace');
  assert.deepEqual(logActions(), ['threshold_set', 'threshold_set']);
  assert.equal(await readFeasibilityRevisionForUser(ALICE), 2, 'chaque écriture de préférence avance la révision de faisabilité par déclencheur');

  await assert.rejects(saveIrrigationNeedThresholdForUser(ALICE, SEASON, WEEK, 600), /CHECK constraint failed/);
  await assert.rejects(saveIrrigationNeedThresholdForUser(ALICE, SEASON, WEEK, -1), /CHECK constraint failed/);
  assert.equal((await readIrrigationNeedSettingsForUser(ALICE, SEASON, WEEK)).thresholdMm, 8.5, 'un lot refusé ne change rien');
  assert.deepEqual(logActions().length, 2);
  assert.equal((await readIrrigationNeedSettingsForUser(BOB, SEASON, WEEK)).thresholdMm, 0);
});

test('décisions par planche : une ligne par planche et semaine, remplacée à chaque geste, avec la bonne action au journal', async () => {
  await saveIrrigationBedNeedDecisionForUser(ALICE, decision('bed-2', { priority: 'high' }));
  await saveIrrigationBedNeedDecisionForUser(ALICE, decision('bed-1', { manualOverrideMm: 60, overrideReason: 'recette 3.4', calculatedNeedAtOverrideMm: 12.5 }));
  let settings = await readIrrigationNeedSettingsForUser(ALICE, SEASON, WEEK);
  assert.deepEqual(
    settings.decisions.map((entry) => [entry.otfBedId, entry.priority, entry.manualOverrideMm, entry.overrideReason, entry.calculatedNeedAtOverrideMm]),
    [['bed-1', 'normal', 60, 'recette 3.4', 12.5], ['bed-2', 'high', null, null, null]],
    'triées par parcelle puis planche',
  );
  assert.deepEqual(logActions(), ['priority_set', 'override_set']);

  await saveIrrigationBedNeedDecisionForUser(ALICE, decision('bed-1', { priority: 'low' }));
  settings = await readIrrigationNeedSettingsForUser(ALICE, SEASON, WEEK);
  assert.deepEqual(settings.decisions.map((entry) => [entry.otfBedId, entry.priority, entry.manualOverrideMm]), [['bed-1', 'low', null], ['bed-2', 'high', null]]);
  assert.deepEqual(logActions(), ['priority_set', 'override_set', 'override_cleared'], 'retirer un remplacement est distingué d’un simple changement de priorité');
  await saveIrrigationBedNeedDecisionForUser(ALICE, decision('bed-2', { priority: 'normal' }));
  assert.deepEqual(logActions().at(-1), 'priority_set', 'sans remplacement avant ni après : changement de priorité');
  assert.equal(database.sqlite.prepare('SELECT count(*) AS n FROM irrigation_bed_need_decisions').get()?.n, 2, 'une ligne par planche');

  assert.deepEqual((await readIrrigationNeedSettingsForUser(ALICE, SEASON, '2026-06-22')).decisions, [], 'une autre semaine part de zéro');
  assert.deepEqual((await readIrrigationNeedSettingsForUser(ALICE, 2025, WEEK)).decisions, [], 'une autre saison aussi');
  await ensureWorkspaceForUser(BOB);
  assert.deepEqual((await readIrrigationNeedSettingsForUser(BOB, SEASON, WEEK)).decisions, [], 'un autre propriétaire ne voit rien');
});

test('décisions par planche : la base refuse un remplacement hors bornes ou un besoin calculé mémorisé sans remplacement', async () => {
  await assert.rejects(saveIrrigationBedNeedDecisionForUser(ALICE, decision('bed-1', { manualOverrideMm: 600, calculatedNeedAtOverrideMm: 10 })), /CHECK constraint failed/);
  await assert.rejects(saveIrrigationBedNeedDecisionForUser(ALICE, decision('bed-1', { manualOverrideMm: -1, calculatedNeedAtOverrideMm: 10 })), /CHECK constraint failed/);
  // La contrainte CHECK laissait passer ce cas (comparaison avec NULL indéterminée) ;
  // la migration 0014 le refuse par déclencheur, à l'insertion comme à la mise à jour.
  await assert.rejects(saveIrrigationBedNeedDecisionForUser(ALICE, decision('bed-1', { manualOverrideMm: null, calculatedNeedAtOverrideMm: 10 })), /bed_need_override_inconsistent/);
  await saveIrrigationBedNeedDecisionForUser(ALICE, decision('bed-1', { manualOverrideMm: 20, calculatedNeedAtOverrideMm: 10 }));
  await assert.rejects(saveIrrigationBedNeedDecisionForUser(ALICE, decision('bed-1', { manualOverrideMm: null, calculatedNeedAtOverrideMm: 10 })), /bed_need_override_inconsistent/, 'à la mise à jour aussi');
  const settings = await readIrrigationNeedSettingsForUser(ALICE, SEASON, WEEK);
  assert.deepEqual(settings.decisions.map((entry) => [entry.otfBedId, entry.manualOverrideMm, entry.calculatedNeedAtOverrideMm]), [['bed-1', 20, 10]], 'les lots refusés n’ont rien écrit');
  assert.deepEqual(logActions(), ['override_set'], 'un lot refusé n’écrit pas de journal');
});
