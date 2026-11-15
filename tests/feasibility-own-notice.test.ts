import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { feasibilityNoticeSource } from '../lib/domain/feasibility-notifications.ts';

/**
 * Le tableau de la faisabilité ne relit pas la répartition qu'il vient de
 * valider (D-129) : sa propre notification, qui porte son nom, arrivait
 * 180 ms plus tard et rendait les cases indisponibles le temps d'un calcul
 * inutile, au moment où l'on change d'avis (P7, run 43667252295).
 */

test('D-129 : la source se lit sur l’événement de la fenêtre comme sur le message du canal ; aucune sur un ancien signal ou un signal sans source', () => {
  assert.equal(feasibilityNoticeSource(new CustomEvent('irrigation-feasibility-source-changed', { detail: { source: ':r1:' } })), ':r1:');
  assert.equal(feasibilityNoticeSource(new MessageEvent('message', { data: { source: ':r1:' } })), ':r1:');
  assert.equal(feasibilityNoticeSource(new CustomEvent('irrigation-feasibility-source-changed', { detail: { source: undefined } })), undefined);
  assert.equal(feasibilityNoticeSource(new MessageEvent('message', { data: 'changed' })), undefined, 'le message d’un onglet resté sur l’ancienne version');
  assert.equal(feasibilityNoticeSource(new CustomEvent('irrigation-events-changed')), undefined);
});

test('D-129 : le tableau signe sa notification après une répartition validée et ignore la sienne ; les autres blocs gardent la leur', () => {
  const view = readFileSync('app/irrigation/irrigation-feasibility-dashboard.tsx', 'utf8');
  assert.match(view, /const self = useId\(\);/);
  assert.match(view, /if \(result\.ok\) notifyFeasibilityChanged\(self\);/);
  assert.match(view, /if \(!activated\.current \|\| \(event && feasibilityNoticeSource\(event\) === self\)\) return;/);
  for (const file of ['app/irrigation/pump-manager.tsx', 'app/irrigation/irrigation-needs-dashboard.tsx', 'app/irrigation/planning/weekly-plan-view.tsx']) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /notifyFeasibilityChanged\([^)]/, `${file} prévient sans se nommer : la faisabilité relit`);
  }
});
