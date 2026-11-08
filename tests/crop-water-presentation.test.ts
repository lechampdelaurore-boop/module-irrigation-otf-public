import assert from 'node:assert/strict';
import test from 'node:test';
import type { CropSeries } from '../lib/domain/domain.ts';
import { correspondenceTargetLabel, et0NatureLabel, kcSourceLabel, monthsLabel, noEtmReasonLabel, proposalStatusLabel, stageAnchorLabel } from '../lib/domain/crop-water/presentation.ts';
import { seasonSpecies, type CorrespondenceEntry } from '../lib/domain/crop-water/species.ts';

/**
 * Les libellés de la page « Coefficients culturaux » et la liste des espèces
 * à rattacher (docs/crop-water-need-contract.md, « L'écran », 5 quater,
 * PR 3) : des phrases, jamais des codes ; une espèce sans rattachement est
 * dite telle, jamais devinée.
 */

test('les mois d’un jeu de saison se lisent en suites, y compris par-dessus la fin de l’année', () => {
  assert.equal(monthsLabel([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), 'toute l’année');
  assert.equal(monthsLabel([3, 4, 5, 6, 7, 8]), 'mars à août');
  // Le jeu d'automne du chou-fleur, du brocoli et des crucifères, rangé par la base dans l'ordre des mois.
  assert.equal(monthsLabel([1, 2, 9, 10, 11, 12]), 'septembre à février');
  assert.equal(monthsLabel([4, 6]), 'avril, juin');
  assert.equal(monthsLabel([4, 5]), 'avril, mai');
  assert.equal(monthsLabel([]), 'aucun mois');
});

test('le début d’un stade se dit comme le contrat le dit', () => {
  assert.equal(stageAnchorLabel({ from: 'implantation', days: 0 }), 'dès l’implantation');
  assert.equal(stageAnchorLabel({ from: 'implantation', days: 15 }), '15 j après l’implantation');
  assert.equal(stageAnchorLabel({ from: 'emergence', days: 30 }), '30 j après la levée');
  assert.equal(stageAnchorLabel({ from: 'before-harvest', days: 45 }), '45 j avant la dernière récolte');
  assert.equal(stageAnchorLabel({ from: 'first-harvest' }), 'à la première récolte');
  assert.equal(stageAnchorLabel({ from: 'mid-harvest' }), 'à la mi-récolte');
});

test('la source et le rattachement d’une espèce se lisent en clair', () => {
  assert.equal(kcSourceLabel('criiam'), 'CRIIAM Sud');
  assert.equal(kcSourceLabel('fao56'), 'FAO-56');
  assert.equal(kcSourceLabel('local'), 'Saisie de la ferme');
  const name = (id: string) => (id === 'criiam-salade-ete' ? 'Salade d’été' : null);
  assert.equal(correspondenceTargetLabel(null, name), 'Non rattachée');
  assert.equal(correspondenceTargetLabel({ kind: 'reference', referenceCropId: 'criiam-salade-ete', analogy: false }, name), 'Salade d’été');
  assert.equal(correspondenceTargetLabel({ kind: 'reference', referenceCropId: 'criiam-salade-ete', analogy: true }, name), 'Salade d’été, par analogie');
  assert.equal(correspondenceTargetLabel({ kind: 'reference', referenceCropId: 'disparue', analogy: false }, name), 'culture inconnue (disparue)');
  assert.equal(correspondenceTargetLabel({ kind: 'without-reference' }, name), 'Sans référence Kc');
  assert.equal(correspondenceTargetLabel({ kind: 'surface-state' }, name), 'Engrais vert : état de la surface du sol');
});

const cultivation = (id: string, plantId: string, plantName: string) => ({ id, plantId, plantName, harvestWeeks: [], harvestWeeksExpected: [] });
const series = (id: string, name: string, use: CropSeries['use'], cultivations: CropSeries['cultivations']): CropSeries => ({
  id, name, season: 2026, use, cycle: 'annual', cultivations,
});

test('les espèces à rattacher sont celles des séries sur planches, avec leur rattachement et les exceptions de leurs séries', () => {
  const plan = [
    series('ail-sec', 'Ail sec', 'bed', [cultivation('c1', 'ail', 'Ail')]),
    series('aillet', 'Aillet', 'bed', [cultivation('c2', 'ail', 'Ail')]),
    series('laitue', 'Laitues d’été', 'bed', [cultivation('c3', 'laitue', 'Laitue'), cultivation('c4', 'mache', 'Mâche')]),
    // Une série en bloc n'a pas de planche (D-022, règle 3) : son espèce n'est pas à rattacher.
    series('endives', 'Endives', 'block', [cultivation('c5', 'endive', 'Endive')]),
  ];
  const entries: CorrespondenceEntry[] = [
    { plantId: 'ail', seriesId: null, target: { kind: 'reference', referenceCropId: 'criiam-ail', analogy: false } },
    { plantId: 'ail', seriesId: 'aillet', target: { kind: 'reference', referenceCropId: 'fao-oignon-vert', analogy: false } },
    { plantId: 'mache', seriesId: null, target: { kind: 'reference', referenceCropId: 'criiam-salade-ete', analogy: true } },
  ];
  assert.deepEqual(seasonSpecies(plan, entries), [
    {
      plantId: 'ail',
      plantName: 'Ail',
      series: [{ id: 'ail-sec', name: 'Ail sec' }, { id: 'aillet', name: 'Aillet' }],
      link: entries[0],
      exceptions: [entries[1]],
    },
    { plantId: 'laitue', plantName: 'Laitue', series: [{ id: 'laitue', name: 'Laitues d’été' }], link: null, exceptions: [] },
    { plantId: 'mache', plantName: 'Mâche', series: [{ id: 'laitue', name: 'Laitues d’été' }], link: entries[2], exceptions: [] },
  ]);
});

test('la fiche de la planche dit en clair pourquoi une culture n\'a pas d\'ETM, la nature de l\'ET0 et l\'état de la proposition', () => {
  assert.equal(noEtmReasonLabel('missing-correspondence'), 'espèce non rattachée à une culture de référence');
  assert.equal(noEtmReasonLabel('without-reference'), 'espèce sans référence Kc');
  assert.equal(noEtmReasonLabel('off-calendar'), 'hors de son calendrier');
  assert.equal(et0NatureLabel('reanalysis'), 'réanalyse');
  assert.equal(et0NatureLabel('estimated'), 'prévision reprise pour un jour passé');
  assert.equal(et0NatureLabel('forecast'), 'prévision');
  assert.match(proposalStatusLabel('complete'), /^Complète/);
  assert.match(proposalStatusLabel('partial'), /ne s’adopte pas/);
  assert.match(proposalStatusLabel('no-crop'), /rien à proposer/);
  assert.match(proposalStatusLabel('unavailable'), /l’objectif saisi reste seul/);
});
