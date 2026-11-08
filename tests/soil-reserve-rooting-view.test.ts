import assert from 'node:assert/strict';
import test from 'node:test';
import { rootingDepthText, rootingProfileView, stageLineLabel } from '../lib/domain/soil-reserve/rooting-view.ts';
import { BROCCOLI, CARROT } from './support/crop-water-references.ts';
import { fixed, profile, progressive } from './support/soil-reserve-fixtures.ts';

/**
 * Le profil racinaire d'une culture tel que la page « Coefficients
 * culturaux » le montre (5 ter, PR 3c) : ce qui compte aujourd'hui, d'où cela
 * vient, le jeu commun à côté, les stades sans ligne et l'histoire.
 */

const TODAY = '2026-11-06';
const common = { ...profile(CARROT.id, 0.35, [fixed(1, 0.2), progressive(2, 0.4, 0.7, 40)]), effectiveFrom: '1900-01-01', origin: 'common' as const };
const farm = (effectiveFrom: string, recordedAt: string, p: number | null = 0.3) => ({
  ...profile(CARROT.id, p, [fixed(null, 0.25), fixed(1, 0.15)]),
  source: 'tarière',
  effectiveFrom,
  recordedAt,
  origin: 'farm' as const,
});

test('le jeu commun seul : ses lignes par stade, nommées, et sa part p', () => {
  const view = rootingProfileView(CARROT, [common], TODAY);
  assert.equal(view.inForce?.origin, 'common');
  assert.equal(view.common, null, 'le jeu commun n’est rappelé qu’à côté d’un profil de la ferme');
  assert.equal(view.p, 0.35);
  assert.equal(view.defaultP, false);
  assert.deepEqual(view.inForce?.lines.map((line) => [line.label, rootingDepthText(line)]), [
    ['Stade 1 · Semis → 30 j après', '0,20 m'],
    ['Stade 2 · 30 j → Récolte', 'de 0,40 à 0,70 m en 40 jours, puis 0,70 m'],
  ]);
  assert.deepEqual(view.proposedStages, []);
  assert.deepEqual(view.history, []);
});

test('un profil de la ferme compte à partir de son jour, le commun reste à côté ; un profil à venir est dans l’histoire', () => {
  const view = rootingProfileView(CARROT, [common, farm('2026-11-01', '2026-11-01T08:00:00.000Z'), farm('2026-12-01', '2026-11-05T08:00:00.000Z', 0.4)], TODAY);
  assert.equal(view.inForce?.origin, 'farm');
  assert.equal(view.inForce?.effectiveFrom, '2026-11-01');
  assert.equal(view.common?.origin, 'common');
  assert.equal(view.p, 0.3);
  assert.deepEqual(view.inForce?.lines.map((line) => line.label), ['Stade 1 · Semis → 30 j après', 'Tous les stades'], 'la ligne de tous les stades vient en dernier');
  assert.deepEqual(view.proposedStages, [], 'la ligne de tous les stades couvre les autres');
  assert.deepEqual(view.history.map((revision) => revision.effectiveFrom), ['2026-12-01', '2026-11-01']);
});

test('sans profil, 30 cm et p 0,5 sont proposés à chaque stade ; un stade sans ligne est dit', () => {
  const none = rootingProfileView(BROCCOLI, [common], TODAY);
  assert.equal(none.inForce, null);
  assert.equal(none.p, 0.5);
  assert.equal(none.defaultP, true);
  assert.deepEqual(none.proposedStages.map((stage) => stage.rank), [1, 2, 3, 4]);

  const partial = rootingProfileView(CARROT, [{ ...profile(CARROT.id, null, [fixed(1, 0.2)]), origin: 'farm' as const }], TODAY);
  assert.equal(partial.defaultP, true);
  assert.deepEqual(partial.proposedStages, [{ rank: 2, label: '30 j → Récolte' }]);
  assert.equal(stageLineLabel(5, partial.stages), 'Stade 5');
  assert.equal(rootingDepthText(progressive(null, 0.15, 0.5, 1)), 'de 0,15 à 0,50 m en 1 jour, puis 0,50 m');
});
