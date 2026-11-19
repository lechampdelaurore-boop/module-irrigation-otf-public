import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { PlanBedOutcome } from '../lib/domain/planning/contract.ts';
import { informationalBedCount, unplacedDeficitCount, unplacedGroups, unplacedTileDetail, waitingBedCount } from '../lib/domain/planning/action-summary.ts';
import { dayValidateShown, unplacedFoldLabel } from '../lib/domain/planning/phone-week.ts';
import { adjustDoseText, adjustedDoseMm } from '../lib/domain/planning/adjust-dose.ts';

/**
 * Audit ergonomique du 19 novembre 2026, lot K « Finitions de charte »
 * (docs/audit-ergonomie-2026-11-19-lot-k-contract.md) : les règles qui se
 * lisent dans le code.
 */

// n° 17 — Planning : le rouge pour le manque d'eau seul (PR 1, F463 à F467).

const outcome = (id: string, reasons: PlanBedOutcome['reasons'], deficitMm: number): PlanBedOutcome => ({
  bedId: id, bedName: id, plotName: 'Jardin', priority: 'normal', needMm: deficitMm, targetMm: 0, placedMm: 0, surplusMm: 0,
  deficitMm, reasons, proposalIds: [], equipmentId: 'rampe',
});

test('n° 17, F463 : deux planches au besoin sous la dose minimale, une semaine normale : rien en rouge, « en attente », pour information', () => {
  const groups = unplacedGroups([outcome('B1', ['below-minimum-dose'], 1.1), outcome('B2', ['below-minimum-dose'], 1.1)]);
  assert.equal(unplacedDeficitCount(groups), 0, 'la tuile « Planches non servies » à 0, neutre');
  assert.equal(waitingBedCount(groups), 2);
  assert.equal(informationalBedCount(groups), 2);
  assert.deepEqual(groups.groups.map((group) => [group.key, group.informational]), [['below-minimum-dose', true]]);
  assert.equal(unplacedTileDetail(groups, 2), '0 avec un manque chiffré · 2 en attente d’un besoin plus grand, pour information');
  assert.equal(unplacedFoldLabel(unplacedDeficitCount(groups), informationalBedCount(groups), waitingBedCount(groups)), 'Planches en attente (2)');
});

test('n° 17, F463 : avec un vrai manque, le rouge le garde ; les planches en attente et sans objectif dites à part', () => {
  const groups = unplacedGroups([
    outcome('A1', ['water-budget'], 3.6),
    outcome('B1', ['below-minimum-dose'], 1.1),
    outcome('O1', ['no-objective'], 0),
    outcome('O2', ['no-objective'], 0),
  ]);
  assert.equal(unplacedDeficitCount(groups), 1);
  assert.equal(unplacedTileDetail(groups, 2), '1 avec un manque chiffré · 2 sans objectif et 1 en attente d’un besoin plus grand, pour information');
  assert.equal(unplacedFoldLabel(1, informationalBedCount(groups), waitingBedCount(groups)), 'Planches non servies (1) · 2 sans objectif · 1 en attente');
  assert.equal(unplacedFoldLabel(0, 3, 1), 'Planches sans objectif (2) · 1 en attente');
  assert.equal(unplacedFoldLabel(0, 2), 'Planches sans objectif (2)', 'sans planche en attente, le titre d’avant');
});

test('n° 17, F463 : un besoin sous la dose et un autre motif reste un manque', () => {
  const groups = unplacedGroups([outcome('B1', ['below-minimum-dose', 'spacing'], 1.1)]);
  assert.equal(unplacedDeficitCount(groups), 1);
  assert.equal(waitingBedCount(groups), 0);
});

test('n° 17, F464 : « Ajuster » montre la dose de la carte, et la rend exacte quand on n’y touche pas', () => {
  const parse = (text: string) => Number(text.replace(',', '.'));
  assert.equal(adjustDoseText(8.06), '8,1');
  assert.equal(adjustedDoseMm('8,1', 8.06, parse), 8.06, 'laissée telle quelle : la dose exacte');
  assert.equal(adjustedDoseMm(' 8,1 ', 8.06, parse), 8.06);
  assert.equal(adjustedDoseMm('8,15', 8.06, parse), 8.15, 'tapée : à sa précision');
  assert.equal(adjustedDoseMm('9', 8.06, parse), 9);
});

test('n° 17, F465 à F467 : la ligne d’état en deux lignes, un seul « Valider » pour une proposition, le pli des réglages signé', () => {
  assert.equal(dayValidateShown(0), false);
  assert.equal(dayValidateShown(1), false);
  assert.equal(dayValidateShown(2), true);
  const view = readFileSync('app/irrigation/planning/weekly-plan-view.tsx', 'utf8');
  assert.ok(view.indexOf('className="planning-meta-main"') < view.indexOf('className="planning-meta-sources"'));
  assert.ok(view.indexOf('className="planning-meta-sources"') < view.indexOf('Prévision météo sur'), 'la source météo dans la seconde ligne');
  const css = readFileSync('app/irrigation/styles/finitions-charte.css', 'utf8');
  assert.match(css, /\.planning-settings > summary::after \{/);
  const sheets = readFileSync('app/irrigation/irrigation.css', 'utf8');
  assert.ok(sheets.indexOf("'./styles/finitions-charte.css'") < sheets.indexOf("'./styles/gestes-surs.css'"), '« gestes-surs.css » reste la dernière');
});
